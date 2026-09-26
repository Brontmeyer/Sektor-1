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
  const actors = readData("Actors.json");
  const skills = readData("Skills.json");
  const statuses = readData("Statuses.json");
  const actions = new Set();
  const drawCalls = [];

  const DatabaseManager = {
    actor(id) { return actors[id] || null; },
    skill(id) { return skills[id] || null; },
    skillName(id) { return skills[id]?.name || `Unknown Skill ${id}`; },
    statusByKey(key) { return statuses.find((status) => status?.key === key) || null; },
    weapon() { return null; },
    armor() { return null; },
    accessory() { return null; },
  };

  const graphicsContext = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "",
    textBaseline: "",
    globalAlpha: 1,
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

  const Input = {
    isActionTriggered(action) { return actions.has(action); },
    isActionRepeated(action) { return actions.has(action); },
    actionLabel(action) {
      return {
        up: "W / ↑",
        down: "S / ↓",
        left: "A / ←",
        right: "D / →",
        cancel: "Q / Esc",
      }[action] || action;
    },
  };

  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    DatabaseManager,
    DebugManager: { log() {} },
    Graphics: { width: 1280, height: 720, context: graphicsContext },
    Input,
  });

  const source = [
    "js/core/UIResourcePalette.js",
    "js/objects/Game_Battler.js",
    "js/objects/Game_Actor.js",
    "js/windows/Window_TextLayout.js",
    "js/windows/Window_ActorNavigator.js",
    "js/windows/Window_ActorSummary.js",
    "js/windows/CharacterMenuLayout.js",
    "js/windows/Window_Valor.js",
  ]
    .map(read)
    .join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__classes = { Game_Actor, Window_Valor };`,
    context,
  );

  const { Game_Actor, Window_Valor } = context.__classes;
  const partyActors = [1, 2, 3, 4].map((id) => new Game_Actor(id));
  const party = {
    members() { return partyActors; },
    battleFormationMembers() { return partyActors; },
  };

  return {
    actors,
    skills,
    actions,
    drawCalls,
    Game_Actor,
    Window_Valor,
    partyActors,
    party,
  };
}

function textValues(harness) {
  return harness.drawCalls.map((call) => String(call[0]));
}

function press(harness, window, action) {
  harness.actions.clear();
  harness.actions.add(action);
  window.update();
  harness.actions.clear();
}

function testCanonicalValorArtsDeclareLevelOne() {
  const skills = readData("Skills.json").filter((skill) => skill?.valorArt === true);

  assert.deepEqual(
    skills.map((skill) => [skill.name, skill.valorLevel]),
    [
      ["Unbroken", 1],
      ["Rallyheart", 1],
      ["Wild Arc", 1],
      ["Zero Lock", 1],
    ],
  );
}

function testActorOwnsValorProgressionGroupingWithoutDuplicatingSkillRuntime() {
  const harness = createHarness();
  const actor = harness.partyActors[0];

  assert.deepEqual(
    Array.from(actor.knownValorArts(), (art) => art.name),
    ["Unbroken"],
  );
  assert.deepEqual(
    Array.from(actor.valorArtsForLevel(1), (art) => art.name),
    ["Unbroken"],
  );
  assert.equal(actor.highestKnownValorLevel(), 1);

  harness.skills[7] = {
    id: 7,
    name: "Test Level Two Art",
    description: "Test-only progression entry.",
    type: "skill",
    category: "physical",
    effect: "damage",
    powerMultiplier: 1,
    valorArt: true,
    valorLevel: 2,
    target: ["enemy"],
    scope: ["single"],
  };
  actor.skillIds.push(7);

  assert.deepEqual(
    Array.from(actor.knownValorArts(), (art) => art.name),
    ["Unbroken", "Test Level Two Art"],
  );
  assert.deepEqual(
    Array.from(actor.valorArtsForLevel(2), (art) => art.name),
    ["Test Level Two Art"],
  );
  assert.equal(actor.highestKnownValorLevel(), 2);
}

function testValorScreenUsesSharedCharacterLanguageAndLimitInspiredLevels() {
  const harness = createHarness();
  const actor = harness.partyActors[0];
  actor.setValor(42.5);
  const window = new harness.Window_Valor(harness.party);
  window.show();
  window.draw();

  const text = textValues(harness);
  assert.equal(text.includes("Tyler"), true);
  assert.equal(text.includes("LV"), true);
  assert.equal(text.includes("HP"), true);
  assert.equal(text.includes("MP"), true);
  assert.equal(text.includes("VALOR"), true);
  assert.equal(text.includes("SET LEVEL 1"), true);
  assert.equal(text.includes("42.5 / 100"), true);
  assert.equal(text.includes("Viewing"), true);
  assert.equal(text.some((value) => value.includes("Unbroken")), true);
  assert.equal(text.includes("Set Level"), true);
  assert.equal(text.includes("Arts"), false);
  assert.equal(text.includes("State"), false);
  assert.equal(text.some((value) => value.startsWith("LEVEL 1")), true);
  assert.equal(text.includes("LEVEL 2"), true);
  assert.equal(text.includes("LEVEL 3"), true);
  assert.equal(text.includes("LEVEL 4"), true);
  assert.equal(text.some((value) => value.includes("Unbroken")), true);
  assert.equal(text.includes("No Arts learned"), true);
  assert.equal(
    text.includes(
      "A decisive single-target strike that converts a full Valor gauge into overwhelming physical force.",
    ),
    true,
  );
}

function testValorScreenSwitchesActorsAndKeepsArtSelectionVertical() {
  const harness = createHarness();
  const window = new harness.Window_Valor(harness.party);
  window.show();

  assert.equal(window.actor.name, harness.partyActors[0].name);
  press(harness, window, "right");
  assert.equal(window.actor.name, harness.partyActors[1].name);
  assert.equal(window.currentArt().name, "Rallyheart");
  assert.equal(window.index, 0);

  press(harness, window, "left");
  assert.equal(window.actor.name, harness.partyActors[0].name);

  const source = read("js/windows/Window_Valor.js");
  assert.match(source, /actorNavigation\.update\(\)/);
  assert.match(source, /directionRepeated\("up"\)/);
  assert.match(source, /directionRepeated\("down"\)/);
  assert.doesNotMatch(source, /planned for a focused pass/);
}


function testValorLevelSelectionPreservesEarnedGauge() {
  const harness = createHarness();
  const actor = harness.partyActors[0];
  harness.skills[7] = {
    id: 7,
    name: "Test Level Two Art",
    description: "Second-level test Art.",
    type: "skill",
    category: "physical",
    effect: "damage",
    powerMultiplier: 1,
    valorArt: true,
    valorLevel: 2,
    target: ["enemy"],
    scope: ["single"],
  };
  actor.skillIds.push(7);
  actor.setValor(63.5);

  assert.equal(actor.selectedValorLevel(), 1);
  assert.equal(actor.setValorLevel(2), true);
  assert.equal(actor.selectedValorLevel(), 2);
  assert.equal(actor.valor, 63.5);
  assert.deepEqual(
    Array.from(actor.selectedValorArts(), (art) => art.name),
    ["Test Level Two Art"],
  );
}

function testSceneRoutesValorToDedicatedWindowAndLoadsItAfterSharedHelpers() {
  const scene = read("js/scenes/Scene_Menu.js");
  const index = read("index.html");

  assert.match(scene, /this\.valorWindow = new Window_Valor\(\$gameParty\)/);
  assert.match(scene, /Valor: this\.valorWindow/);
  assert.match(scene, /this\.valorWindow\.update\(\)/);
  assert.match(scene, /this\.valorWindow\.draw\(\)/);
  assert.doesNotMatch(scene, /Valor progression is planned for a focused pass/);

  const navigatorIndex = index.indexOf("Window_ActorNavigator.js");
  const summaryIndex = index.indexOf("Window_ActorSummary.js");
  const valorIndex = index.indexOf("Window_Valor.js");
  assert.equal(navigatorIndex >= 0, true);
  assert.equal(summaryIndex > navigatorIndex, true);
  assert.equal(valorIndex > summaryIndex, true);
}

function run() {
  testCanonicalValorArtsDeclareLevelOne();
  testActorOwnsValorProgressionGroupingWithoutDuplicatingSkillRuntime();
  testValorScreenUsesSharedCharacterLanguageAndLimitInspiredLevels();
  testValorScreenSwitchesActorsAndKeepsArtSelectionVertical();
  testValorLevelSelectionPreservesEarnedGauge();
  testSceneRoutesValorToDedicatedWindowAndLoadsItAfterSharedHelpers();
  console.log("Valor menu presentation regression tests passed.");
}

run();
