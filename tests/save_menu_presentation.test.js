"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

function createHarness() {
  const actions = new Set();
  const drawCalls = [];
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
    fillText(...args) { drawCalls.push(String(args[0])); },
    measureText(text) { return { width: String(text).length * 8 }; },
  };
  const saveData = {
    version: 11,
    metadata: {
      actorName: "Tyler",
      level: 12,
      mapName: "Sector Gate",
      timestamp: 1760000000000,
    },
    actors: [
      { actorId: 1, name: "Tyler", level: 12 },
      { actorId: 2, name: "Sarah", level: 11 },
    ],
    party: { gil: 2345 },
    location: { mapId: 2, x: 4, y: 8 },
  };

  const globals = {
    console,
    Graphics: { width: 1280, height: 720, context: context2d },
    Input: {
      isActionTriggered(action) { return actions.has(action); },
      isActionRepeated(action) { return actions.has(action); },
      actionLabel(action) { return action; },
    },
    SaveManager: {
      exists(slotId) { return slotId === 1; },
      read(slotId) { return slotId === 1 ? saveData : null; },
    },
  };

  const context = vm.createContext(globals);
  const source = [
    "js/windows/Window_ActorSummary.js",
    "js/windows/Window_SaveSlots.js",
  ].map(read).join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__Window = Window_SaveSlots;`,
    context,
  );

  return {
    window: new context.__Window(),
    actions,
    drawCalls,
  };
}

function press(harness, action) {
  harness.actions.clear();
  harness.actions.add(action);
  harness.window.update();
  harness.actions.clear();
}

function drawText(harness) {
  harness.drawCalls.length = 0;
  harness.window.draw();
  return harness.drawCalls.slice();
}

function includes(texts, expected) {
  return texts.some((text) => text === expected || text.includes(expected));
}

function testSaveUsesFullScreenSharedMenuPresentation() {
  const harness = createHarness();
  harness.window.show("save");
  const texts = drawText(harness);

  assert.equal(includes(texts, "SAVE"), true);
  assert.equal(includes(texts, "SAVE PROGRESS"), true);
  assert.equal(includes(texts, "3 SLOTS"), true);
  assert.equal(includes(texts, "▶ SLOT 1"), true);
  assert.equal(includes(texts, "Tyler   LV 12"), true);
  assert.equal(includes(texts, "Sector Gate"), true);
  assert.equal(includes(texts, "Tyler Lv 12"), true);
  assert.equal(includes(texts, "Sarah Lv 11"), true);
  assert.equal(includes(texts, "RUNES 2,345"), true);
  assert.equal(includes(texts, "Empty Slot"), true);
}

function testSaveSlotNavigationAndResultRemainRuntimeCompatible() {
  const harness = createHarness();
  harness.window.show("save");

  press(harness, "down");
  assert.equal(harness.window.currentSlotId(), 2);
  press(harness, "confirm");
  assert.equal(harness.window.isOpen(), false);
  assert.equal(harness.window.hasResult(), true);
  assert.equal(harness.window.takeResult(), 2);
  assert.equal(harness.window.hasResult(), false);
}

function testLoadReusesPresentationWithoutInventingPlayTime() {
  const harness = createHarness();
  harness.window.show("load");
  const texts = drawText(harness);

  assert.equal(includes(texts, "LOAD"), true);
  assert.equal(includes(texts, "SAVED PROGRESS"), true);
  assert.equal(includes(texts, "Choose a slot to load saved progress."), true);

  const source = read("js/windows/Window_SaveSlots.js");
  assert.doesNotMatch(source, /playTime|PLAY TIME|session time/i);
}

function run() {
  testSaveUsesFullScreenSharedMenuPresentation();
  testSaveSlotNavigationAndResultRemainRuntimeCompatible();
  testLoadReusesPresentationWithoutInventingPlayTime();
  console.log("Save menu presentation regression tests passed.");
}

run();
