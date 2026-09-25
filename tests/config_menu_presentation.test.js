"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

function createHarness() {
  const drawCalls = [];
  const actions = new Set();
  const store = new Map();
  const context2d = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "",
    textBaseline: "",
    save() {},
    restore() {},
    fillRect() {},
    strokeRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fillText(...args) { drawCalls.push(args); },
  };
  const localStorage = {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); },
  };
  const context = vm.createContext({
    console,
    localStorage,
    Graphics: { width: 1280, height: 720, context: context2d },
    Input: {
      isActionTriggered(action) { return actions.has(action); },
      actionLabel(action) { return action; },
    },
  });

  vm.runInContext(
    `${read("js/core/ConfigManager.js")}\n${read("js/windows/ConfigMenuLayout.js")}\n${read("js/windows/Window_Options.js")}\nglobalThis.__classes = { ConfigManager, Window_Options };`,
    context,
  );

  context.__classes.ConfigManager.initialize();
  return {
    window: new context.__classes.Window_Options(),
    actions,
    drawCalls,
  };
}

function texts(harness) {
  harness.drawCalls.length = 0;
  harness.window.draw();
  return harness.drawCalls.map((call) => String(call[0]));
}

function testConfigUsesUnifiedHeaderContentAndGoldFocusLanguage() {
  const harness = createHarness();
  const drawn = texts(harness);

  assert.equal(drawn.includes("CONFIG"), true);
  assert.equal(drawn.includes("SYSTEM"), true);
  assert.equal(drawn.includes("▶ Battle Speed"), true);
  assert.equal(drawn.some((text) => text.includes("ATB Mode")), true);
  assert.equal(drawn.some((text) => text.includes("Window Color")), true);
  assert.equal(drawn.some((text) => text.includes("Controls")), true);
  assert.equal(
    drawn.includes("Changes battle animation, action, and Time gauge pacing."),
    true,
  );
}

function testConfigNavigationPreservesRuntimeOwnership() {
  const harness = createHarness();
  harness.actions.add("down");
  harness.window.update();
  harness.actions.clear();
  assert.equal(harness.window.currentOption().key, "atbMode");

  harness.actions.add("right");
  harness.window.update();
  harness.actions.clear();
  assert.equal(harness.window.currentOption().key, "atbMode");
}

function testConfigSceneDropsLegacyGrayGradientChrome() {
  const scene = read("js/scenes/Scene_Options.js");
  assert.match(scene, /fillStyle = "#0b0e13"/);
  assert.match(scene, /this\.optionsWindow\.draw\(\)/);
  assert.doesNotMatch(scene, /createLinearGradient/);
}

function run() {
  testConfigUsesUnifiedHeaderContentAndGoldFocusLanguage();
  testConfigNavigationPreservesRuntimeOwnership();
  testConfigSceneDropsLegacyGrayGradientChrome();
  console.log("Config menu presentation regression tests passed.");
}

run();
