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
  const skills = Array.from({ length: 24 }, (_, index) => ({
    id: index + 10,
    name: `Technique ${String(index + 1).padStart(2, "0")}`,
    description: `Description for technique ${index + 1}.`,
    type: "skill",
    category: index % 2 === 0 ? "physical" : "support",
    effect: index % 2 === 0 ? "damage" : "scan",
    target: ["enemy"],
    scope: index % 3 === 0 ? ["single", "all"] : ["single"],
  }));
  const valorArt = {
    id: 2,
    name: "Rallyheart",
    description: "Valor-only technique.",
    type: "skill",
    category: "support",
    effect: "heal",
    valorArt: true,
    target: ["ally"],
    scope: ["all"],
  };
  const actor = {
    actorId: 2,
    name: "Sarah",
    level: 7,
    hp: 432,
    maxHp: 500,
    mp: 81,
    maxMp: 100,
    knownSkills: () => [valorArt, ...skills],
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
        return { up: "↑", down: "↓", left: "←", right: "→", cancel: "Q" }[action] || action;
      },
    },
    UIResourcePalette: {
      text(resource) { return resource === "hp" ? "#66d7ff" : "#78ef91"; },
      fill(resource) { return resource === "hp" ? "#35baf3" : "#55d872"; },
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
      `${read("js/windows/Window_Skills.js")}\n` +
      `globalThis.__Window = Window_Skills;`,
    context,
  );

  return {
    window: new context.__Window(party),
    actor,
    skills,
    valorArt,
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

function textCalls(harness) {
  return harness.calls
    .filter((call) => call[0] === "fillText")
    .map((call) => ({ text: String(call[2]), x: call[3], y: call[4] }));
}

function testFieldSkillListExcludesValorArts() {
  const harness = createHarness();
  const list = harness.window.skillList();

  assert.equal(list.length, harness.skills.length);
  assert.equal(list.some((skill) => skill.valorArt === true), false);
  assert.equal(list.includes(harness.valorArt), false);
}

function testThreeColumnGridConsumesAllDirectionsAndKeepsActorFixed() {
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
  assert.equal(window.actor, actor);
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

function testSkillReferenceHierarchyAndActorSummary() {
  const harness = createHarness();
  harness.window.show();
  harness.window.draw();
  const text = textCalls(harness);
  const values = text.map((call) => call.text);

  assert.equal(values.includes("SKILL"), true);
  assert.equal(values.includes("Sarah"), true);
  assert.equal(values.includes("LV"), true);
  assert.equal(values.includes("7"), true);
  assert.equal(values.includes("HP"), true);
  assert.equal(values.includes("432/500"), true);
  assert.equal(values.includes("MP"), true);
  assert.equal(values.includes("81/100"), true);
  assert.equal(values.includes("Category"), true);
  assert.equal(values.includes("Effect"), true);
  assert.equal(values.includes("Target"), true);
  assert.equal(values.includes("Scope"), true);
  assert.equal(values.some((value) => value.includes("Technique 01")), true);
  assert.equal(values.some((value) => value.includes("Rallyheart")), false);

  const gaugeCalls = harness.calls.filter((call) => call[0] === "drawGauge");
  assert.equal(gaugeCalls.length, 2, "HP and MP each get one mini gauge");
}

function testLevelAndVitalsUseSharedStackedLayout() {
  const harness = createHarness();
  harness.window.show();
  harness.window.draw();
  const calls = textCalls(harness);
  const name = calls.find((call) => call.text === "Sarah");
  const level = calls.find((call) => call.text === "LV");
  const hp = calls.find((call) => call.text === "HP");
  const mp = calls.find((call) => call.text === "MP");

  assert.notEqual(name, undefined);
  assert.notEqual(level, undefined);
  assert.notEqual(hp, undefined);
  assert.notEqual(mp, undefined);
  assert.equal(level.y > name.y, true, "LV sits below the character name");
  assert.equal(Math.abs(level.x - name.x) <= 2, true);
  assert.equal(Math.abs(mp.x - hp.x) <= 2, true);
  assert.equal(mp.y > hp.y, true, "MP stacks beneath HP");
  assert.equal(mp.y - hp.y <= 36, true);
}

function testSkillUsesSharedHeldDirectionContract() {
  const source = read("js/windows/Window_Skills.js");
  assert.match(source, /Input\.isActionRepeated/);
  assert.match(source, /directionRepeated\("up"\)/);
  assert.match(source, /directionRepeated\("down"\)/);
  assert.match(source, /directionRepeated\("left"\)/);
  assert.match(source, /directionRepeated\("right"\)/);
  assert.match(source, /new Window_ListViewport\(this\.visibleRows\)/);
}

function run() {
  testFieldSkillListExcludesValorArts();
  testThreeColumnGridConsumesAllDirectionsAndKeepsActorFixed();
  testGridScrollsByRowsAndShowsOnlyNeededArrows();
  testSkillReferenceHierarchyAndActorSummary();
  testLevelAndVitalsUseSharedStackedLayout();
  testSkillUsesSharedHeldDirectionContract();
  console.log("Skill menu presentation regression tests passed.");
}

run();
