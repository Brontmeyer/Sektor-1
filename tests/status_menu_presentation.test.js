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
    fillText(...args) { drawCalls.push(args); },
    measureText(text) { return { width: String(text).length * 8 }; },
  };
  const statusDefinitions = [
    {
      key: "poison",
      name: "Poison",
      classification: { negative: true },
      duration: { type: "untilRemoved" },
    },
    {
      key: "sleep",
      name: "Sleep",
      classification: { negative: true },
      duration: { type: "turns", turns: 3 },
    },
    {
      key: "nearDeath",
      name: "Near-Death",
      classification: { negative: true },
      duration: { type: "derived" },
    },
  ];
  const actor = {
    actorId: 1,
    name: "Tyler",
    level: 7,
    hp: 420,
    maxHp: 500,
    mp: 80,
    maxMp: 100,
    exp: 125,
    valor: 55.9,
    maxValor: 100,
    strength: 18,
    dexterity: 14,
    vitality: 16,
    magic: 15,
    spirit: 13,
    agility: 12,
    luck: 11,
    attack: 10,
    attackPercent: 100,
    defense: 8,
    defensePercent: 0,
    magicAttack: 10,
    magicDefense: 8,
    magicDefensePercent: 0,
    elementRates: { fire: 0.5, ice: 1.5 },
    expForNextLevel: () => 700,
    isValorReady: () => false,
    totalAttack: () => 30,
    totalAttackPercent: () => 105,
    totalDefense: () => 24,
    totalDefensePercent: () => 5,
    totalMagicAttack: () => 25,
    totalMagicDefense: () => 21,
    totalMagicDefensePercent: () => 4,
    totalCritical: () => 3,
    weapon: () => ({ name: "Iron Sword" }),
    armor: () => ({ name: "Leather Armor" }),
    accessory: () => ({ name: "Power Wrist" }),
    essenceSlotCount: () => 2,
    equippedEssenceAt(slot) {
      return slot === 0 ? { name: () => "Flame Essence" } : null;
    },
    statusDisplayEntries: () => [
      { key: "poison", name: "Poison", turnsRemaining: null },
    ],
    statusDefinitions: () => statusDefinitions,
    statusRate(key) {
      if (key === "poison") return 0;
      if (key === "sleep") return 0.5;
      return 1;
    },
    elementRate(key) {
      return this.elementRates[key] ?? 1;
    },
  };
  const secondActor = { ...actor, actorId: 2, name: "Sarah" };
  const party = {
    members: () => [actor, secondActor],
    battleFormationMembers: () => [actor, secondActor],
  };
  const globals = {
    console,
    Graphics: { width: 1280, height: 720, context: context2d },
    Input: {
      isActionTriggered(action) { return actions.has(action); },
      actionLabel(action) { return action; },
    },
    DatabaseManager: {
      magickData: [
        null,
        { element: "fire" },
        { element: "ice" },
        { element: "wind" },
        { element: "restorative" },
      ],
    },
  };
  const context = vm.createContext(globals);
  const source = [
    "js/core/UIResourcePalette.js",
    "js/windows/Window_TextLayout.js",
    "js/windows/Window_ActorNavigator.js",
    "js/windows/Window_ActorSummary.js",
    "js/windows/CharacterMenuLayout.js",
    "js/windows/Window_Status.js",
  ].map(read).join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__Window = Window_Status;`,
    context,
  );

  return {
    window: new context.__Window(party),
    actions,
    drawCalls,
    actor,
    secondActor,
  };
}

function trigger(window, actions, action) {
  actions.clear();
  actions.add(action);
  window.update();
  actions.clear();
}

function drawn(drawCalls, text) {
  return drawCalls.some((call) => call[0] === text);
}

function testStatusUsesThreeReferenceInspiredPages() {
  const { window, drawCalls } = createHarness();
  window.show();
  window.draw();

  assert.equal(window.pageIndex, 0);
  assert.equal(drawn(drawCalls, "STATUS"), true);
  assert.equal(drawn(drawCalls, "MAIN  1/3"), true);
  assert.equal(drawn(drawCalls, "PARAMETERS"), true);
  assert.equal(drawn(drawCalls, "COMBAT"), true);
  assert.equal(drawn(drawCalls, "EQUIPMENT"), true);
  assert.equal(drawn(drawCalls, "Valor:"), true);
  assert.equal(drawn(drawCalls, "55.9 / 100"), true);
}

function testPageSwitchingUsesDedicatedVerticalAndConfirmInputs() {
  const { window, actions, drawCalls } = createHarness();
  window.show();

  trigger(window, actions, "down");
  assert.equal(window.pageIndex, 1);
  window.draw();
  assert.equal(drawn(drawCalls, "ELEMENT  2/3"), true);
  assert.equal(drawn(drawCalls, "ELEMENTAL AFFINITY"), true);
  assert.equal(drawn(drawCalls, "Fire"), true);
  assert.equal(drawn(drawCalls, "Resist 50%"), true);
  assert.equal(drawn(drawCalls, "Weak 150%"), true);

  drawCalls.length = 0;
  trigger(window, actions, "confirm");
  assert.equal(window.pageIndex, 2);
  window.draw();
  assert.equal(drawn(drawCalls, "EFFECT  3/3"), true);
  assert.equal(drawn(drawCalls, "STATUS EFFECTS"), true);
  assert.equal(drawn(drawCalls, "STATUS RESISTANCE"), true);
  assert.equal(drawn(drawCalls, "Immune"), true);
  assert.equal(drawn(drawCalls, "Resist 50%"), true);

  trigger(window, actions, "down");
  assert.equal(window.pageIndex, 0);
  trigger(window, actions, "up");
  assert.equal(window.pageIndex, 2);
}


function testActiveStatusUsesResistanceStyleLabelValueRow() {
  const { window, drawCalls } = createHarness();
  window.show();
  window.changePage(2);
  window.draw();

  const active = drawCalls.find((call) => String(call[0]) === "Active");
  const poisonEntries = drawCalls.filter((call) => String(call[0]) === "Poison");
  const activeValue = poisonEntries[0];
  const poison = poisonEntries.find((call) => call[2] > active[2]);
  const poisonValue = drawCalls.find(
    (call) => String(call[0]) === "Immune" && call[2] === poison?.[2],
  );

  assert.ok(active);
  assert.ok(activeValue);
  assert.ok(poison);
  assert.ok(poisonValue);
  assert.equal(active[1], poison[1]);
  assert.equal(active[2] < poison[2], true);
  assert.equal(activeValue[2], active[2]);
  assert.equal(activeValue[1], poisonValue[1]);
}

function testActorNavigationRemainsLeftRightAcrossPages() {
  const { window, actions, secondActor } = createHarness();
  window.show();
  window.changePage(1);
  trigger(window, actions, "right");
  assert.equal(window.actor, secondActor);
  assert.equal(window.pageIndex, 1);
}

function testStatusPagesDoNotInventUnsupportedReferenceMechanics() {
  const source = read("js/windows/Window_Status.js");

  assert.match(source, /actor\?\.elementRate\?\./);
  assert.match(source, /actor\?\.statusRate\?\./);
  assert.match(source, /statusDisplayEntries/);
  assert.doesNotMatch(source, /Water|Holy|Absorb Element|Element Attack/);
}

function run() {
  testStatusUsesThreeReferenceInspiredPages();
  testPageSwitchingUsesDedicatedVerticalAndConfirmInputs();
  testActiveStatusUsesResistanceStyleLabelValueRow();
  testActorNavigationRemainsLeftRightAcrossPages();
  testStatusPagesDoNotInventUnsupportedReferenceMechanics();
  console.log("Status menu presentation regression tests passed.");
}

run();
