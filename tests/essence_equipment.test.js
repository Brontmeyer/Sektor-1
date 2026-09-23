"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const readData = (filename) =>
  JSON.parse(fs.readFileSync(path.join(projectRoot, "data", filename), "utf8"));
const clone = (value) => JSON.parse(JSON.stringify(value));

const actors = readData("Actors.json");
const essences = readData("Essences.json");
const magick = readData("Magick.json");
const statuses = readData("Statuses.json");

function makeDatabaseManager() {
  return {
    actors,
    essences,
    magick,
    statuses,
    actor(id) {
      return actors[id] || null;
    },
    essence(id) {
      return essences[id] || null;
    },
    essenceName(id) {
      return essences[id]?.name || `Unknown Essence ${id}`;
    },
    magick(id) {
      return magick[id] || null;
    },
    magickName(id) {
      return magick[id]?.name || `Unknown Magick ${id}`;
    },
    statusByKey(key) {
      return statuses.find((status) => status?.key === key) || null;
    },
  };
}

function createHarness() {
  const DatabaseManager = makeDatabaseManager();
  const drawCalls = [];
  const graphicsContext = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    font: "",
    textAlign: "",
    textBaseline: "",
    globalAlpha: 1,
    save() {},
    restore() {},
    fillRect(...args) { drawCalls.push(["fillRect", ...args]); },
    strokeRect(...args) { drawCalls.push(["strokeRect", ...args]); },
    fillText(...args) { drawCalls.push(["fillText", ...args]); },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    measureText(text) { return { width: String(text).length * 8 }; },
  };
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    DatabaseManager,
    DebugManager: { log() {} },
    Graphics: { width: 1280, height: 720, context: graphicsContext },
    Input: { isTriggered() { return false; }, isActionTriggered() { return false; }, actionLabel(action) { return action; } },
  });

  const source = [
    "js/objects/Game_Battler.js",
    "js/objects/Game_Essence.js",
    "js/objects/Game_Actor.js",
    "js/objects/Game_Party.js",
    "js/windows/Window_ListViewport.js",
    "js/windows/Window_ActorNavigator.js",
    "js/windows/Window_ActorSummary.js",
    "js/windows/Window_Essence.js",
  ]
    .map((relativePath) =>
      fs.readFileSync(path.join(projectRoot, relativePath), "utf8"),
    )
    .join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__classes = { Game_Actor, Game_Essence, Game_Party, Window_Essence };`,
    context,
  );

  const { Game_Actor, Game_Essence, Game_Party, Window_Essence } = context.__classes;
  const partyActors = [1, 2, 3, 4].map((actorId) => new Game_Actor(actorId));
  const party = new Game_Party(partyActors);

  return {
    context,
    DatabaseManager,
    Game_Actor,
    Game_Essence,
    Game_Party,
    Window_Essence,
    partyActors,
    party,
    drawCalls,
  };
}

function testActorSlotRulesAreDataDrivenAndPreserveProgress() {
  const { partyActors } = createHarness();
  const actor = partyActors[0];

  assert.equal(actor.essenceSlotCount(), actors[1].essenceSlots);
  assert.equal(actor.essenceSlotCount(), 3);
  assert.deepEqual(Array.from(actor.equippedEssenceIds()), [null, null, null]);

  assert.equal(actor.equipEssenceInSlot(0, 4, 145), true);
  assert.equal(actor.equippedEssenceAt(0).essenceId, 4);
  assert.equal(actor.equippedEssenceAt(0).resonance, 145);
  assert.equal(actor.equipEssenceInSlot(1, 4), false);

  assert.equal(actor.unequipEssenceSlot(0), true);
  assert.equal(actor.equippedEssenceAt(0), null);
  assert.equal(actor.essenceProgress(4).resonance, 145);

  assert.equal(actor.equipEssenceInSlot(2, 4), true);
  assert.equal(actor.equippedEssenceAt(2), actor.essenceProgress(4));
  assert.equal(actor.equippedEssenceAt(2).resonance, 145);

  assert.equal(actor.equipEssenceInSlot(0, 1), true);
  assert.equal(actor.equipEssenceInSlot(1, 2), true);
  assert.equal(actor.equipEssence(3), false);
}

function testEssenceProgressionHelpersExposeNextMilestone() {
  const { Game_Essence } = createHarness();
  const essence = new Game_Essence(4, 250);

  assert.equal(essence.level(), 2);
  assert.deepEqual(
    { ...essence.nextProgressionMilestone() },
    { label: "Level 3", resonanceRequired: 300 },
  );
  assert.equal(essence.resonanceToNextMilestone(), 50);

  essence.setResonance(1490);
  assert.deepEqual(
    { ...essence.nextProgressionMilestone() },
    { label: "Mastery Ready", resonanceRequired: 1500 },
  );
  assert.equal(essence.resonanceToNextMilestone(), 10);

  essence.setResonance(1500);
  assert.equal(essence.isMasteryReady(), true);
  assert.equal(essence.nextProgressionMilestone(), null);
  assert.equal(essence.resonanceToNextMilestone(), 0);
}

function testEssenceWindowUsesActorRulesAndPartySwitching() {
  const { party, partyActors, Window_Essence, drawCalls } = createHarness();
  const first = partyActors[0];
  const second = partyActors[1];
  const window = new Window_Essence(party);

  assert.equal(window.catalogEssences().length, 19);
  window.show();
  assert.equal(window.actor(), first);
  window.draw();
  assert.equal(
    drawCalls.some((call) => call[0] === "fillText" && call[1] === "ESSENCE"),
    true,
  );

  window.changeActor(1);
  assert.equal(window.actor(), second);

  assert.equal(second.equipEssenceInSlot(0, 4, 90), true);
  window.slotIndex = 1;
  window.openCatalog();

  const flameIndex = window
    .catalogEntries()
    .findIndex((essence) => essence?.id === 4);
  window.catalogIndex = flameIndex;

  assert.equal(window.catalogEntryEnabled(window.currentCatalogEssence()), false);

  const iceIndex = window
    .catalogEntries()
    .findIndex((essence) => essence?.id === 5);
  window.catalogIndex = iceIndex;
  window.draw();
  assert.equal(window.applyCatalogSelection(), true);
  assert.equal(second.equippedEssenceAt(1).essenceId, 5);

  window.slotIndex = 0;
  window.openCatalog();
  window.catalogIndex = 0;
  assert.equal(window.applyCatalogSelection(), true);
  assert.equal(second.equippedEssenceAt(0), null);
  assert.equal(second.essenceProgress(4).resonance, 90);
}

function testActorEssenceSlotValidationAndMenuIntegration() {
  const validatorSource = fs.readFileSync(
    path.join(projectRoot, "js/core/DatabaseValidator.js"),
    "utf8",
  );
  const context = vm.createContext({ console, DebugManager: { log() {} } });
  vm.runInContext(
    `${validatorSource}\nglobalThis.__DatabaseValidator = DatabaseValidator;`,
    context,
  );

  const actorData = clone(actors);
  actorData[1].essenceSlots = 0;
  actorData[2].essenceSlots = 2.5;
  const errors = [];

  context.__DatabaseValidator.validateActors(actorData, errors, magick);
  assert.equal(errors.some((error) => error.includes("Actor 1 essenceSlots")), true);
  assert.equal(errors.some((error) => error.includes("Actor 2 essenceSlots")), true);

  const menuCommandSource = fs.readFileSync(
    path.join(projectRoot, "js/windows/Window_MenuCommand.js"),
    "utf8",
  );
  const sceneMenuSource = fs.readFileSync(
    path.join(projectRoot, "js/scenes/Scene_Menu.js"),
    "utf8",
  );
  const indexSource = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");

  assert.equal(menuCommandSource.includes('"Essence"'), true);
  assert.equal(sceneMenuSource.includes("new Window_Essence($gameParty)"), true);
  assert.equal(sceneMenuSource.includes('case "Essence"'), true);
  assert.equal(indexSource.includes("js/windows/Window_Essence.js"), true);
}

function run() {
  testActorSlotRulesAreDataDrivenAndPreserveProgress();
  testEssenceProgressionHelpersExposeNextMilestone();
  testEssenceWindowUsesActorRulesAndPartySwitching();
  testActorEssenceSlotValidationAndMenuIntegration();

  console.log("Essence equipment regression tests passed.");
}

run();
