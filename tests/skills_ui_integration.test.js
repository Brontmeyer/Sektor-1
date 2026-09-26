"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");

function loadClass(relativePath, className, globals = {}) {
  const source = fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
  const context = vm.createContext({ console, ...globals });

  vm.runInContext(
    `${source}\nglobalThis.__Class = ${className};`,
    context,
  );

  return context.__Class;
}

function createDrawContext() {
  return {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    font: "",
    textAlign: "",
    textBaseline: "",
    globalAlpha: 1,
    save() {},
    restore() {},
    fillRect() {},
    strokeRect() {},
    fillText() {},
    measureText(text) {
      return { width: String(text).length * 8 };
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
  };
}

function testBattleRendererKeepsCommandWindowVisibleBehindSelectors() {
  const context = createDrawContext();
  const Graphics = { width: 1600, height: 900, context };
  const BattleRenderer = loadClass(
    "js/battle/BattleRenderer.js",
    "BattleRenderer",
    { Graphics },
  );
  const calls = {
    command: 0,
    skills: 0,
    magick: 0,
    item: 0,
  };
  let skillsOpen = true;
  const scene = {
    battleView: "front",
    battleMessages: [],
    victory: false,
    defeat: false,
    battleInputLocked: false,
    partyController: { currentBattler: () => ({ actorId: 1 }) },
    commandWindow: {
      draw() {
        calls.command++;
      },
    },
    skillsWindow: {
      isOpen: () => skillsOpen,
      draw() {
        calls.skills++;
      },
    },
    magickWindow: {
      isOpen: () => false,
      draw() {
        calls.magick++;
      },
    },
    itemWindow: {
      isOpen: () => false,
      draw() {
        calls.item++;
      },
    },
  };
  const renderer = new BattleRenderer(scene);

  renderer.drawBattleHeader = () => {};
  renderer.drawFrontView = () => {};
  renderer.drawSideView = () => {};
  renderer.drawBattleHud = () => {};
  renderer.drawBattleEffect = () => {};
  renderer.drawBattlePopups = () => {};
  renderer.drawBattleMessages = () => {};
  renderer.drawBattleHint = () => {};

  renderer.draw();

  assert.equal(calls.command, 1);
  assert.equal(calls.skills, 1);
  assert.equal(calls.magick, 1);
  assert.equal(calls.item, 1);

  skillsOpen = false;
  renderer.draw();

  assert.equal(calls.command, 2);
  assert.equal(calls.skills, 2);
}

function testSharedTextLayoutWrapsAndTruncatesInsideBounds() {
  const fillCalls = [];
  const context = {
    measureText(text) {
      return { width: String(text).length * 8 };
    },
    fillText(text, x, y) {
      fillCalls.push({ text, x, y });
    },
  };
  const Window_TextLayout = loadClass(
    "js/windows/Window_TextLayout.js",
    "Window_TextLayout",
  );
  const result = Window_TextLayout.drawWrappedText(
    context,
    "One two three four five six seven eight nine ten eleven twelve thirteen fourteen",
    20,
    40,
    96,
    22,
    3,
  );

  assert.equal(result.truncated, true);
  assert.equal(fillCalls.length, 3);
  assert.equal(fillCalls.at(-1).text.endsWith("…"), true);
  assert.equal(
    fillCalls.every((call) => context.measureText(call.text).width <= 96),
    true,
  );
}

function testFieldAbilityWindowsUseSharedBoundedDescriptionLayout() {
  const skillsSource = fs.readFileSync(
    path.join(projectRoot, "js/windows/Window_Skills.js"),
    "utf8",
  );
  const magickSource = fs.readFileSync(
    path.join(projectRoot, "js/windows/Window_Magick.js"),
    "utf8",
  );
  const indexSource = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");

  assert.match(skillsSource, /Window_TextLayout\.drawWrappedText/);
  assert.match(magickSource, /Window_TextLayout\.drawWrappedText/);

  const helperIndex = indexSource.indexOf("Window_TextLayout.js");
  const magickIndex = indexSource.indexOf("Window_Magick.js");
  const skillsIndex = indexSource.indexOf("Window_Skills.js");

  assert.equal(helperIndex >= 0, true);
  assert.equal(helperIndex < magickIndex, true);
  assert.equal(helperIndex < skillsIndex, true);
}

function run() {
  testBattleRendererKeepsCommandWindowVisibleBehindSelectors();
  testSharedTextLayoutWrapsAndTruncatesInsideBounds();
  testFieldAbilityWindowsUseSharedBoundedDescriptionLayout();

  console.log("Skills UI integration regression tests passed.");
}

run();
