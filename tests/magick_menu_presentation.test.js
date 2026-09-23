"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

function createHarness() {
  const calls = [];
  const context2d = {
    fillStyle: "", strokeStyle: "", lineWidth: 1, font: "",
    textAlign: "", textBaseline: "", globalAlpha: 1,
    save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
    fillRect(...args) { calls.push(["fillRect", this.fillStyle, ...args]); },
    strokeRect(...args) { calls.push(["strokeRect", this.strokeStyle, ...args]); },
    fillText(...args) { calls.push(["fillText", this.fillStyle, ...args]); },
    measureText(text) { return { width: String(text).length * 8 }; },
  };
  const actions = new Set();
  const magick = Array.from({ length: 24 }, (_, index) => ({
    id: index + 1,
    name: `Spell ${String(index + 1).padStart(2, "0")}`,
    description: `Description for spell ${index + 1}.`,
    type: "magick",
    category: index % 2 === 0 ? "attack" : "restore",
    element: index % 2 === 0 ? "fire" : "restorative",
    effect: index % 2 === 0 ? "damage" : "heal",
    mpCost: index + 3,
    target: ["ally", "enemy"],
    scope: ["single", "all"],
  }));
  const actor = {
    actorId: 2,
    name: "Sarah",
    level: 7,
    hp: 432,
    maxHp: 500,
    mp: 81,
    maxMp: 100,
    knownMagick: () => magick,
    canUseMagick: () => true,
    useMagick() { return true; },
  };
  const party = {
    battleFormationMembers: () => [actor],
    battleMembers: () => [actor],
    members: () => [actor],
  };
  const globals = {
    console,
    Graphics: { width: 1280, height: 720, context: context2d },
    Input: {
      isActionTriggered(action) { return actions.has(action); },
      isActionRepeated(action) { return actions.has(action); },
      actionLabel(action) {
        return { up: "↑", down: "↓", left: "←", right: "→", confirm: "E", cancel: "Q" }[action] || action;
      },
    },
    ConfigManager: { sortMagick(list) { return [...list]; } },
    DebugManager: { log() {} },
    UIResourcePalette: {
      text(resource) { return resource === "hp" ? "#66d7ff" : "#78ef91"; },
      valueText() { return "#ffffff"; },
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
  };
  const context = vm.createContext(globals);
  vm.runInContext(
    `${read("js/windows/Window_ListViewport.js")}\n` +
      `${read("js/windows/Window_TextLayout.js")}\n` +
      `${read("js/windows/Window_ActorNavigator.js")}\n` +
      `${read("js/windows/Window_ActorSummary.js")}\n` +
      `${read("js/windows/CharacterMenuLayout.js")}\n` +
      `${read("js/windows/Window_Magick.js")}\n` +
      `globalThis.__Window = Window_Magick;`,
    context,
  );

  return {
    window: new context.__Window(party),
    actor,
    calls,
    actions,
  };
}

function press(harness, action) {
  harness.actions.clear();
  harness.actions.add(action);
  harness.window.update();
  harness.actions.clear();
}

function testThreeColumnGridConsumesAllDirections() {
  const harness = createHarness();
  const { window, actor } = harness;
  window.show();

  assert.equal(window.columns, 3);
  assert.equal(window.actor, actor);
  assert.equal(window.index, 0);

  press(harness, "right");
  assert.equal(window.index, 1);
  press(harness, "down");
  assert.equal(window.index, 4);
  press(harness, "left");
  assert.equal(window.index, 3);
  press(harness, "up");
  assert.equal(window.index, 0);
  assert.equal(window.actor, actor, "grid movement does not switch actors");
}

function testGridScrollsByRowsAndShowsOnlyNeededArrows() {
  const harness = createHarness();
  const { window, calls } = harness;
  window.show();
  window.index = 21;
  window.ensureSelectionVisible();

  assert.equal(window.listViewport.hasPrevious(), true);
  assert.equal(window.listViewport.hasNext(window.rowCount()), false);

  window.draw();
  const text = calls.filter((call) => call[0] === "fillText").map((call) => call[2]);
  assert.equal(text.includes("▲"), true);
  assert.equal(text.includes("▼"), false);
}

function testReferenceHierarchyUsesRealActorAndMagickData() {
  const harness = createHarness();
  harness.window.show();
  harness.window.draw();
  const text = harness.calls
    .filter((call) => call[0] === "fillText")
    .map((call) => String(call[2]));

  assert.equal(text.includes("MAGICK"), true);
  assert.equal(text.includes("Sarah"), true);
  assert.equal(text.includes("LV"), true);
  assert.equal(text.includes("HP"), true);
  assert.equal(text.includes("432/500"), true);
  assert.equal(text.includes("MP"), true);
  assert.equal(text.includes("81/100"), true);
  assert.equal(text.includes("Category"), true);
  assert.equal(text.includes("Element"), true);
  assert.equal(text.includes("Scope"), true);
  assert.equal(text.includes("MP NEEDED"), true);
  assert.equal(text.includes("003"), true);
  assert.equal(text.some((value) => value.includes("Spell 01")), true);
}

function testActorSummaryUsesStackedLevelAndVitals() {
  const harness = createHarness();
  harness.window.show();
  harness.window.draw();
  const text = harness.calls
    .filter((call) => call[0] === "fillText")
    .map((call) => ({ text: String(call[2]), x: call[3], y: call[4] }));
  const name = text.find((call) => call.text === "Sarah");
  const level = text.find((call) => call.text === "LV");
  const hp = text.find((call) => call.text === "HP");
  const mp = text.find((call) => call.text === "MP");

  assert.notEqual(name, undefined);
  assert.notEqual(level, undefined);
  assert.notEqual(hp, undefined);
  assert.notEqual(mp, undefined);
  assert.equal(level.y > name.y, true);
  assert.equal(Math.abs(level.x - name.x) <= 2, true);
  assert.equal(Math.abs(mp.x - hp.x) <= 2, true);
  assert.equal(mp.y > hp.y, true);
  assert.equal(mp.y - hp.y <= 36, true);
  assert.equal(
    harness.calls.filter((call) => call[0] === "drawGauge").length,
    2,
    "HP and MP each render a mini gauge",
  );
}

function testConfigRenameAndWhiteRunesValueArePlayerFacingOnly() {
  const menu = read("js/windows/Window_MenuCommand.js");
  const sceneMenu = read("js/scenes/Scene_Menu.js");
  const sceneOptions = read("js/scenes/Scene_Options.js");
  const optionsWindow = read("js/windows/Window_Options.js");

  assert.match(menu, /"Config"/);
  assert.doesNotMatch(menu, /"Option"/);
  assert.match(sceneMenu, /case "Config":/);
  assert.doesNotMatch(sceneMenu, /case "Option":/);
  assert.match(optionsWindow, /fillText\("CONFIG"/);
  assert.match(sceneOptions, /this\.optionsWindow\.draw\(\)/);
  assert.match(
    sceneMenu,
    /context\.fillStyle = "#ffffff";[\s\S]*Number\(\$gameParty\.gil\?\.\(\) \|\| 0\)\.toLocaleString\(\)/,
  );
  assert.match(sceneMenu, /SceneManager\.push\(Scene_Options\)/, "internal scene name stays stable");
}

function testMagickUsesSharedHeldDirectionContract() {
  const source = read("js/windows/Window_Magick.js");
  assert.match(source, /Input\.isActionRepeated/);
  assert.match(source, /directionRepeated\("up"\)/);
  assert.match(source, /directionRepeated\("down"\)/);
  assert.match(source, /directionRepeated\("left"\)/);
  assert.match(source, /directionRepeated\("right"\)/);
  assert.match(source, /new Window_ListViewport\(this\.visibleRows\)/);
}

function run() {
  testThreeColumnGridConsumesAllDirections();
  testGridScrollsByRowsAndShowsOnlyNeededArrows();
  testReferenceHierarchyUsesRealActorAndMagickData();
  testActorSummaryUsesStackedLevelAndVitals();
  testConfigRenameAndWhiteRunesValueArePlayerFacingOnly();
  testMagickUsesSharedHeldDirectionContract();
  console.log("Magick menu presentation regression tests passed.");
}

run();
