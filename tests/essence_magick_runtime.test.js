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

const actors = readData("Actors.json");
const essences = readData("Essences.json");
const magick = readData("Magick.json");
const statuses = readData("Statuses.json");

function createHarness() {
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
    weapon() { return null; },
    armor() { return null; },
    accessory() { return null; },
  };
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    DatabaseManager,
    DebugManager: { log() {} },
    ConfigManager: undefined,
    Graphics: { width: 1280, height: 720 },
  });
  const source = [
    "js/objects/Game_Battler.js",
    "js/objects/Game_Essence.js",
    "js/objects/Game_Actor.js",
    "js/windows/Window_ListViewport.js",
    "js/windows/Window_BattleMagick.js",
  ]
    .map((relativePath) => read(relativePath))
    .join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__classes = { Game_Actor, Window_BattleMagick };`,
    context,
  );

  return { ...context.__classes, DatabaseManager };
}

function ids(entries) {
  return Array.from(entries, (entry) => entry.id);
}

function testEquippedEssenceGrantsOnlyUnlockedMagick() {
  const { Game_Actor } = createHarness();
  const actor = new Game_Actor(1);

  assert.equal(actor.knowsMagick(13), false);
  assert.equal(actor.equipEssenceInSlot(0, 5, 0), true);
  assert.equal(actor.equippedEssenceAt(0).level(), 1);
  assert.equal(actor.knowsMagick(13), true);
  assert.equal(actor.knowsMagick(14), false);
  assert.equal(actor.canUseMagick(13), true);
  assert.deepEqual(Array.from(actor.essenceGrantedMagickIds()), [13]);

  actor.equippedEssenceAt(0).setResonance(350);
  assert.equal(actor.equippedEssenceAt(0).level(), 3);
  assert.deepEqual(Array.from(actor.essenceGrantedMagickIds()), [13, 14, 15]);
  assert.equal(actor.knowsMagick(14), true);
  assert.equal(actor.knowsMagick(15), true);
}

function testResonanceAwakeningBecomesAvailableImmediately() {
  const { Game_Actor } = createHarness();
  const actor = new Game_Actor(1);

  assert.equal(actor.equipEssenceInSlot(0, 5, 90), true);
  assert.equal(actor.knowsMagick(14), false);

  const [result] = actor.gainEquippedEssenceResonance(20);

  assert.ok(result);
  assert.equal(result.newLevel, 2);
  assert.deepEqual(Array.from(result.awakenedMagickIds), [14]);
  assert.equal(actor.knowsMagick(14), true);
  assert.equal(ids(actor.knownMagick()).includes(14), true);
}

function testUnequippingRemovesTemporaryAccessButPreservesProgress() {
  const { Game_Actor } = createHarness();
  const actor = new Game_Actor(1);

  assert.equal(actor.equipEssenceInSlot(0, 5, 350), true);
  assert.equal(actor.knowsMagick(15), true);
  assert.equal(actor.unequipEssenceSlot(0), true);
  assert.equal(actor.knowsMagick(13), false);
  assert.equal(actor.knowsMagick(14), false);
  assert.equal(actor.knowsMagick(15), false);
  assert.equal(actor.essenceProgress(5).resonance, 350);

  assert.equal(actor.equipEssenceInSlot(2, 5), true);
  assert.equal(actor.knowsMagick(15), true);
  assert.equal(actor.equippedEssenceAt(2).resonance, 350);
}

function testPermanentLearningRemainsIndependentFromEssenceAccess() {
  const { Game_Actor } = createHarness();
  const actor = new Game_Actor(1);

  assert.equal(actor.equipEssenceInSlot(0, 5, 0), true);
  assert.equal(actor.knowsMagick(13), true);
  assert.equal(actor.learnMagick(13), true);
  assert.equal(actor.magickIds.includes(13), true);
  assert.equal(actor.unequipEssenceSlot(0), true);
  assert.equal(actor.knowsMagick(13), true);

  assert.equal(actor.equipEssenceInSlot(0, 5), true);
  assert.equal(actor.forgetMagick(13), true);
  assert.equal(actor.magickIds.includes(13), false);
  assert.equal(actor.knowsMagick(13), true);
  assert.equal(actor.unequipEssenceSlot(0), true);
  assert.equal(actor.knowsMagick(13), false);
}

function testKnownMagickDeduplicatesPermanentAndEssenceSources() {
  const { Game_Actor } = createHarness();
  const actor = new Game_Actor(1);

  assert.equal(actor.magickIds.includes(10), true);
  assert.equal(actor.equipEssenceInSlot(0, 4, 0), true);

  const knownIds = ids(actor.knownMagick());
  assert.equal(knownIds.filter((id) => id === 10).length, 1);
  assert.deepEqual(Array.from(actor.essenceGrantedMagickIds()), [10]);
}

function testBattleSelectorReadsEssenceGrantedKnownMagick() {
  const { Game_Actor, Window_BattleMagick } = createHarness();
  const actor = new Game_Actor(1);
  assert.equal(actor.equipEssenceInSlot(0, 5, 100), true);

  const scene = {
    partyController: { currentBattler() { return actor; } },
    hudLayout: {
      selectorBounds() { return { x: 0, y: 0, width: 360, height: 156 }; },
      commandBounds() { return { x: 0, y: 0, width: 280, height: 156 }; },
    },
  };
  const window = new Window_BattleMagick(scene);
  const listIds = ids(window.magickList());

  assert.equal(listIds.includes(13), true);
  assert.equal(listIds.includes(14), true);
  assert.equal(listIds.includes(15), false);

  const fieldSource = read("js/windows/Window_Magick.js");
  assert.match(fieldSource, /\.knownMagick\?\.\(\)/);
}

function run() {
  testEquippedEssenceGrantsOnlyUnlockedMagick();
  testResonanceAwakeningBecomesAvailableImmediately();
  testUnequippingRemovesTemporaryAccessButPreservesProgress();
  testPermanentLearningRemainsIndependentFromEssenceAccess();
  testKnownMagickDeduplicatesPermanentAndEssenceSources();
  testBattleSelectorReadsEssenceGrantedKnownMagick();

  console.log("Essence-granted Magick runtime regression tests passed.");
}

run();
