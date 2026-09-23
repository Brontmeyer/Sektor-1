"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
const readData = (filename) =>
  JSON.parse(fs.readFileSync(path.join(projectRoot, "data", filename), "utf8"));

function createHarness() {
  const calls = [];
  const actions = new Set();
  const context2d = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "",
    textBaseline: "",
    globalAlpha: 1,
    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fillRect(...args) { calls.push(["fillRect", this.fillStyle, ...args]); },
    strokeRect(...args) { calls.push(["strokeRect", this.strokeStyle, ...args]); },
    fillText(...args) { calls.push(["fillText", this.fillStyle, ...args]); },
    measureText(text) { return { width: String(text).length * 8 }; },
  };
  const actors = readData("Actors.json");
  const essences = readData("Essences.json");
  const magick = readData("Magick.json");
  const statuses = readData("Statuses.json");
  const DatabaseManager = {
    actors,
    essences,
    magick,
    statuses,
    actor(id) { return actors[id] || null; },
    essence(id) { return essences[id] || null; },
    essenceName(id) { return essences[id]?.name || `Unknown Essence ${id}`; },
    magick(id) { return magick[id] || null; },
    magickName(id) { return magick[id]?.name || `Unknown Magick ${id}`; },
    statusByKey(key) {
      return statuses.find((status) => status?.key === key) || null;
    },
  };
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    DatabaseManager,
    DebugManager: { log() {} },
    Graphics: { width: 1280, height: 720, context: context2d },
    Input: {
      isActionTriggered(action) { return actions.has(action); },
      isActionRepeated(action) { return actions.has(action); },
      actionLabel(action) {
        return {
          up: "↑",
          down: "↓",
          left: "←",
          right: "→",
          confirm: "E",
          cancel: "Q",
        }[action] || action;
      },
    },
    UIResourcePalette: {
      text(resource) { return resource === "hp" ? "#66d7ff" : "#78ef91"; },
      valueText() { return "#ffffff"; },
      fill(resource) { return resource === "hp" ? "#4db8ff" : "#4fd46b"; },
    },
    UIAssetManager: {
      drawPanel(_context, role, x, y, width, height) {
        calls.push(["drawPanel", role, x, y, width, height]);
        return true;
      },
      drawSelectionPanel(_context, x, y, width, height) {
        calls.push(["drawSelectionPanel", x, y, width, height]);
        return true;
      },
      drawGauge(_context, value, maximum, x, y, width, height, color) {
        calls.push(["drawGauge", value, maximum, x, y, width, height, color]);
        return true;
      },
    },
  });

  const source = [
    "js/objects/Game_Battler.js",
    "js/objects/Game_Essence.js",
    "js/objects/Game_Actor.js",
    "js/objects/Game_Party.js",
    "js/windows/Window_ListViewport.js",
    "js/windows/Window_TextLayout.js",
    "js/windows/Window_ActorNavigator.js",
    "js/windows/Window_ActorSummary.js",
    "js/windows/CharacterMenuLayout.js",
    "js/windows/Window_Essence.js",
  ]
    .map((relativePath) => read(relativePath))
    .join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__classes = { Game_Actor, Game_Party, Window_Essence };`,
    context,
  );

  const { Game_Actor, Game_Party, Window_Essence } = context.__classes;
  const actor = new Game_Actor(1);
  actor.setHp?.(432);
  actor.setMp?.(81);
  actor.level = 7;
  const party = new Game_Party([actor]);
  const window = new Window_Essence(party);

  return { window, actor, calls, actions, essences };
}

function press(harness, action) {
  harness.actions.clear();
  harness.actions.add(action);
  harness.window.update();
  harness.actions.clear();
}

function textCalls(harness) {
  return harness.calls
    .filter((call) => call[0] === "fillText")
    .map((call) => ({ text: String(call[2]), x: call[3], y: call[4] }));
}

function testEssenceUsesSharedActorSummaryAndRealProgressionData() {
  const harness = createHarness();
  const { window, actor } = harness;
  assert.equal(actor.equipEssenceInSlot(0, 4, 250), true);

  window.show();
  window.draw();
  const text = textCalls(harness);
  const values = text.map((call) => call.text);
  const hp = text.find((call) => call.text === "HP");
  const mp = text.find((call) => call.text === "MP");

  assert.equal(values.includes("ESSENCE"), true);
  assert.equal(values.includes("Tyler"), true);
  assert.equal(values.includes("LV"), true);
  assert.equal(values.includes("HP"), true);
  assert.equal(values.includes("MP"), true);
  assert.equal(values.includes("Type"), true);
  assert.equal(values.includes("Element"), true);
  assert.equal(values.includes("Level"), true);
  assert.equal(values.includes("Resonance"), true);
  assert.equal(values.includes("PROGRESSION"), true);
  assert.equal(values.includes("MAGICK AWAKENING"), true);
  assert.equal(values.includes("Flame Essence"), true);
  assert.equal(values.includes("250 / 300"), true);
  assert.equal(
    values.some((value) => value.includes("50 to Level 3")),
    true,
  );
  assert.notEqual(hp, undefined);
  assert.notEqual(mp, undefined);
  assert.equal(Math.abs(mp.x - hp.x) <= 2, true);
  assert.equal(mp.y > hp.y, true);

  const gaugeCalls = harness.calls.filter((call) => call[0] === "drawGauge");
  assert.equal(gaugeCalls.length >= 3, true, "HP, MP, and Resonance render gauges");
}

function testCatalogUsesTwoDimensionalHeldNavigation() {
  const harness = createHarness();
  const { window } = harness;
  window.show();
  assert.equal(window.openCatalog(), true);
  assert.equal(window.catalogColumns, 2);
  assert.equal(window.catalogIndex, 0);

  press(harness, "right");
  assert.equal(window.catalogIndex, 1);
  press(harness, "down");
  assert.equal(window.catalogIndex, 3);
  press(harness, "left");
  assert.equal(window.catalogIndex, 2);
  press(harness, "up");
  assert.equal(window.catalogIndex, 0);
}

function testCatalogScrollsByRowsAndUsesContextualArrows() {
  const harness = createHarness();
  const { window } = harness;
  window.show();
  window.openCatalog();

  window.catalogIndex = window.catalogEntries().length - 1;
  window.ensureCatalogSelectionVisible();
  assert.equal(window.catalogViewport.hasPrevious(), true);
  assert.equal(
    window.catalogViewport.hasNext(window.catalogRowCount()),
    false,
  );

  window.draw();
  const values = textCalls(harness).map((call) => call.text);
  assert.equal(values.includes("▲"), true);
  assert.equal(values.includes("▼"), false);
}

function testCatalogPreviewPreservesDuplicateSlotRules() {
  const harness = createHarness();
  const { window, actor } = harness;
  assert.equal(actor.equipEssenceInSlot(0, 4, 145), true);
  window.show();
  window.slotIndex = 1;
  window.openCatalog();

  const flameIndex = window
    .catalogEntries()
    .findIndex((essence) => essence?.id === 4);
  window.catalogIndex = flameIndex;

  assert.equal(window.catalogEntryEnabled(window.currentCatalogEssence()), false);
  assert.equal(window.applyCatalogSelection(), false);
  assert.equal(actor.equippedEssenceAt(1), null);
}

function testEssenceUsesSharedHeldDirectionAndSummaryContracts() {
  const essence = read("js/windows/Window_Essence.js");
  const magick = read("js/windows/Window_Magick.js");
  const skills = read("js/windows/Window_Skills.js");
  const html = read("index.html");

  assert.match(essence, /Input\.isActionRepeated/);
  assert.match(essence, /directionRepeated\("up"\)/);
  assert.match(essence, /directionRepeated\("down"\)/);
  assert.match(essence, /directionRepeated\("left"\)/);
  assert.match(essence, /directionRepeated\("right"\)/);
  assert.match(essence, /Window_ActorSummary\.draw/);
  assert.match(magick, /Window_ActorSummary\.draw/);
  assert.match(skills, /Window_ActorSummary\.draw/);

  const summaryIndex = html.indexOf("Window_ActorSummary.js");
  assert.equal(summaryIndex > html.indexOf("Window_ActorNavigator.js"), true);
  assert.equal(summaryIndex < html.indexOf("Window_Essence.js"), true);
  assert.equal(summaryIndex < html.indexOf("Window_Magick.js"), true);
  assert.equal(summaryIndex < html.indexOf("Window_Skills.js"), true);
}

function run() {
  testEssenceUsesSharedActorSummaryAndRealProgressionData();
  testCatalogUsesTwoDimensionalHeldNavigation();
  testCatalogScrollsByRowsAndUsesContextualArrows();
  testCatalogPreviewPreservesDuplicateSlotRules();
  testEssenceUsesSharedHeldDirectionAndSummaryContracts();

  console.log("Essence menu presentation regression tests passed.");
}

run();
