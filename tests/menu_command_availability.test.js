"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

function loadPolicy() {
  const context = vm.createContext({ console });
  vm.runInContext(
    `${read("js/core/MenuAccessPolicy.js")}\nglobalThis.__Policy = MenuAccessPolicy;`,
    context,
  );
  return context.__Policy;
}

function loadWindow(policy) {
  const drawCalls = [];
  const triggered = new Set();
  const context = vm.createContext({
    console,
    Input: {
      isActionTriggered(action) {
        return triggered.has(action);
      },
    },
    Graphics: {
      context: {
        fillStyle: "",
        strokeStyle: "",
        lineWidth: 1,
        font: "",
        textAlign: "",
        textBaseline: "",
        save() {},
        restore() {},
        fillRect(...args) { drawCalls.push(["fillRect", this.fillStyle, ...args]); },
        strokeRect(...args) { drawCalls.push(["strokeRect", this.strokeStyle, ...args]); },
        fillText(...args) { drawCalls.push(["fillText", this.fillStyle, ...args]); },
      },
    },
  });

  vm.runInContext(
    `${read("js/windows/Window_MenuCommand.js")}\nglobalThis.__Window = Window_MenuCommand;`,
    context,
  );

  return {
    window: new context.__Window({ x: 0, y: 0, width: 260, height: 460 }, policy),
    drawCalls,
    triggered,
  };
}

function testMapRestrictionsDisableSaveAndLoadOutsideDebugMode() {
  const Policy = loadPolicy();
  const policy = new Policy({
    debugMode: false,
    mapAccess: { allowSave: false, allowLoad: false },
  });

  assert.equal(policy.isEnabled("Save"), false);
  assert.equal(policy.isEnabled("Load"), false);
  assert.match(policy.state("Save").reason, /not available in this area/i);
  assert.match(policy.state("Load").reason, /not available in this area/i);
}

function testDebugModeKeepsSaveAndLoadPermissiveForDevelopment() {
  const Policy = loadPolicy();
  const policy = new Policy({
    debugMode: true,
    mapAccess: { allowSave: false, allowLoad: false },
  });

  assert.equal(policy.isEnabled("Save"), true);
  assert.equal(policy.isEnabled("Load"), true);
}


function testRosterIsHiddenByDefaultUntilExplicitStoryUnlock() {
  const Policy = loadPolicy();
  const lockedPolicy = new Policy();
  const locked = loadWindow(lockedPolicy).window;

  assert.equal(locked.commands.includes("ROSTER"), false);
  assert.equal(lockedPolicy.isVisible("ROSTER"), false);

  const unlockedPolicy = new Policy({
    commandStates: {
      ROSTER: { visible: true, enabled: true },
    },
  });
  const unlocked = loadWindow(unlockedPolicy).window;

  assert.equal(unlocked.commands.includes("ROSTER"), true);
  assert.equal(unlockedPolicy.isVisible("ROSTER"), true);
}

function testFutureStoryUnlocksCanHideOrDisableCommands() {
  const Policy = loadPolicy();
  const policy = new Policy({
    commandStates: {
      ROSTER: {
        visible: false,
        enabled: false,
        reason: "ROSTER has not been learned yet.",
      },
      Valor: {
        visible: true,
        enabled: false,
        reason: "Valor progression has not been unlocked yet.",
      },
    },
  });

  const { window } = loadWindow(policy);

  assert.equal(window.commands.includes("ROSTER"), false);
  assert.equal(window.commands.includes("Valor"), true);
  assert.equal(policy.isEnabled("Valor"), false);
  assert.match(policy.state("Valor").reason, /not been unlocked/i);
}

function testDevelopmentMenuRestoresLoadAndStillOmitsExit() {
  const Policy = loadPolicy();
  const policy = new Policy({
    commandStates: {
      Save: { enabled: false, reason: "Saving is temporarily disabled." },
      ROSTER: { visible: true, enabled: true },
    },
  });
  const { window, drawCalls } = loadWindow(policy);

  assert.equal(window.commands.includes("Load"), true);
  assert.equal(window.commands.includes("Exit"), false);
  assert.equal(window.commands.includes("ROSTER"), true);

  const saveIndex = window.commands.indexOf("Save");
  window.index = saveIndex;
  window.draw();

  const saveDraw = drawCalls.find(
    (call) => call[0] === "fillText" && String(call[2]).includes("Save"),
  );

  assert.notEqual(saveDraw, undefined);
  assert.equal(saveDraw[1], "rgba(180, 190, 210, 0.45)");
  assert.equal(window.currentCommandState().enabled, false);
}

function testPolicyLoadsBeforeMenuConsumers() {
  const html = read("index.html");
  const policyIndex = html.indexOf("js/core/MenuAccessPolicy.js");
  const commandIndex = html.indexOf("js/windows/Window_MenuCommand.js");
  const sceneIndex = html.indexOf("js/scenes/Scene_Menu.js");

  assert.equal(policyIndex >= 0, true);
  assert.equal(policyIndex < commandIndex, true);
  assert.equal(commandIndex < sceneIndex, true);
}

function run() {
  testMapRestrictionsDisableSaveAndLoadOutsideDebugMode();
  testDebugModeKeepsSaveAndLoadPermissiveForDevelopment();
  testRosterIsHiddenByDefaultUntilExplicitStoryUnlock();
  testFutureStoryUnlocksCanHideOrDisableCommands();
  testDevelopmentMenuRestoresLoadAndStillOmitsExit();
  testPolicyLoadsBeforeMenuConsumers();

  console.log("Menu command availability regression tests passed.");
}

run();
