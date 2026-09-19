"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const readData = (filename) =>
  JSON.parse(fs.readFileSync(path.join(projectRoot, "data", filename), "utf8"));

const actors = readData("Actors.json");
const enemies = readData("Enemies.json");
const items = readData("Items.json");
const weapons = readData("Weapons.json");
const armors = readData("Armors.json");
const magick = readData("Magick.json");
const essences = readData("Essences.json");
const statuses = readData("Statuses.json");

function makeDatabaseManager() {
  return {
    actors,
    enemies,
    items,
    weapons,
    armors,
    magick,
    essences,
    statuses,
    actor(id) {
      return actors[id] || null;
    },
    enemy(id) {
      return enemies[id] || null;
    },
    item(id) {
      return items[id] || null;
    },
    itemName(id) {
      return items[id]?.name || `Unknown Item ${id}`;
    },
    weapon(id) {
      return weapons[id] || null;
    },
    armor(id) {
      return armors[id] || null;
    },
    magick(id) {
      return magick[id] || null;
    },
    magickName(id) {
      return magick[id]?.name || `Unknown Magick ${id}`;
    },
    essence(id) {
      return essences[id] || null;
    },
    statusByKey(key) {
      return statuses.find((status) => status?.key === key) || null;
    },
  };
}

function createBattleHarness() {
  const DatabaseManager = makeDatabaseManager();
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    DatabaseManager,
    DebugManager: { log() {} },
  });
  const source = [
    "js/objects/Game_Battler.js",
    "js/objects/Game_Essence.js",
    "js/objects/Game_Actor.js",
    "js/objects/Game_Enemy.js",
    "js/objects/Game_Party.js",
    "js/battle/BattleEnemyAI.js",
    "js/battle/BattleManager.js",
  ]
    .map((relativePath) =>
      fs.readFileSync(path.join(projectRoot, relativePath), "utf8"),
    )
    .join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__classes = { Game_Actor, Game_Enemy, Game_Party, BattleManager };`,
    context,
  );

  const { Game_Actor, Game_Enemy, Game_Party, BattleManager } = context.__classes;
  const first = new Game_Actor(1);
  const second = new Game_Actor(2);
  const party = new Game_Party([first, second]);
  const firstEnemy = new Game_Enemy(1);
  const secondEnemy = new Game_Enemy(1);
  const scene = {
    encounter: { id: 1, name: "Reward Test" },
    enemies: [firstEnemy, secondEnemy],
    outcome: null,
    victory: false,
    defeat: false,
    pendingEnemyTurn: false,
    enemyTurnDelay: 0,
    battleInputLocked: false,
    result: null,
    messages: [],
    addBattleMessage(message) {
      this.messages.push(message);
    },
  };

  context.$gameParty = party;

  return {
    context,
    DatabaseManager,
    BattleManager,
    party,
    first,
    second,
    firstEnemy,
    secondEnemy,
    scene,
  };
}

function testCurrencyApi() {
  const { party } = createBattleHarness();

  assert.equal(party.gil(), 0);
  assert.equal(party.gainGil(75), true);
  assert.equal(party.gil(), 75);
  assert.equal(party.spendGil(20), true);
  assert.equal(party.gil(), 55);
  assert.equal(party.spendGil(100), false);
  assert.equal(party.gil(), 55);
  assert.equal(party.gainGil(-1), false);
  assert.equal(party.setGil(12), true);
  assert.equal(party.gil(), 12);
}

function testRewardSchemaValidation() {
  const source = fs.readFileSync(
    path.join(projectRoot, "js/core/DatabaseValidator.js"),
    "utf8",
  );
  const context = vm.createContext({ console, DebugManager: { log() {} } });
  vm.runInContext(
    `${source}\nglobalThis.__DatabaseValidator = DatabaseValidator;`,
    context,
  );
  const DatabaseValidator = context.__DatabaseValidator;
  const validErrors = [];

  DatabaseValidator.validateEnemies(enemies, items, validErrors);
  assert.deepEqual(Array.from(validErrors), []);

  const broken = {
    ...enemies[1],
    gilReward: -1,
    resonanceReward: "5",
    dropTable: [
      { itemId: 999, quantity: 0, chance: 2 },
    ],
  };
  const errors = [];
  DatabaseValidator.validateEnemies([null, broken], items, errors);

  assert.equal(errors.some((error) => error.includes("gilReward")), true);
  assert.equal(errors.some((error) => error.includes("resonanceReward")), true);
  assert.equal(errors.some((error) => error.includes("valid item")), true);
  assert.equal(errors.some((error) => error.includes("positive integer")), true);
  assert.equal(errors.some((error) => error.includes("chance")), true);
}

function testVictoryAwardsCurrencyDropsAndSurvivingEssenceResonanceOnce() {
  const {
    BattleManager,
    party,
    first,
    second,
    firstEnemy,
    secondEnemy,
    scene,
  } = createBattleHarness();

  assert.equal(first.equipEssence(1, 1495), true);
  assert.equal(second.equipEssence(4, 0), true);

  firstEnemy.setHp(0);
  assert.equal(secondEnemy.banish().success, true);
  second.setHp(0);

  const manager = new BattleManager(scene);
  manager.rewardRandom = () => 0.1;

  const result = manager.finalizeBattle(BattleManager.OUTCOME_VICTORY);

  assert.equal(result.rewards.exp, 100);
  assert.equal(result.rewards.currency, 10);
  assert.equal(result.rewards.resonance, 10);
  assert.deepEqual(
    Array.from(result.rewards.drops, (drop) => ({ ...drop })),
    [{ itemId: 1, name: "Potion", quantity: 2 }],
  );
  assert.equal(party.gil(), 10);
  assert.equal(party.itemCount(1), 2);

  const firstResult = result.party.find((entry) => entry.actorId === 1);
  const secondResult = result.party.find((entry) => entry.actorId === 2);
  const firstEssence = first.equippedEssence(1);
  const secondEssence = second.equippedEssence(4);

  assert.equal(firstEssence.resonance, 1500);
  assert.equal(firstEssence.isMasteryReady(), true);
  assert.equal(firstResult.essenceRewards.length, 1);
  assert.equal(firstResult.essenceRewards[0].gained, 5);
  assert.equal(firstResult.essenceRewards[0].becameMasteryReady, true);

  assert.equal(secondEssence.resonance, 0);
  assert.equal(secondResult.essenceRewards.length, 0);
  assert.equal(secondResult.wasDefeated, true);
  assert.equal(second.hp, 1);

  const again = manager.finalizeBattle(BattleManager.OUTCOME_VICTORY);
  assert.equal(again, result);
  assert.equal(party.gil(), 10);
  assert.equal(party.itemCount(1), 2);
  assert.equal(firstEssence.resonance, 1500);
}

function run() {
  testCurrencyApi();
  testRewardSchemaValidation();
  testVictoryAwardsCurrencyDropsAndSurvivingEssenceResonanceOnce();

  console.log("Battle reward regression tests passed.");
}

run();
