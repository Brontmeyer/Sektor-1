"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const statuses = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "data", "Statuses.json"), "utf8"),
);

function loadClasses(relativePaths, exportExpression, globals = {}) {
  const context = vm.createContext({ console, ...globals });
  const source = relativePaths
    .map((relativePath) =>
      fs.readFileSync(path.join(projectRoot, relativePath), "utf8"),
    )
    .join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__loadedClasses = ${exportExpression};`,
    context,
    { filename: relativePaths.join(", ") },
  );

  return { context, classes: context.__loadedClasses };
}

function makeStatusDatabaseManager() {
  return {
    statuses,
    statusByKey(key) {
      return statuses.find((status) => status?.key === key) || null;
    },
  };
}

function makeBattleFixture() {
  const loaded = loadClasses(
    [
      "js/objects/Game_Battler.js",
      "js/battle/BattleManager.js",
      "js/battle/BattlePartyController.js",
    ],
    "{ Game_Battler, BattleManager, BattlePartyController }",
    {
      DatabaseManager: makeStatusDatabaseManager(),
      DebugManager: { log() {} },
      Graphics: { height: 720 },
    },
  );
  const { Game_Battler, BattleManager, BattlePartyController } = loaded.classes;
  const party = [];
  const enemies = [];

  loaded.context.$gameParty = {
    battleMembers() {
      return party;
    },
    livingBattleMembers() {
      return party.filter((battler) => !battler.isDefeated());
    },
  };

  const messages = [];
  const scene = {
    enemies,
    enemyTurnIndex: 0,
    pendingEnemyTurn: false,
    enemyTurnDelay: 0,
    battleInputLocked: false,
    outcome: null,
    victory: false,
    defeat: false,
    actionPhase: "none",
    addBattleMessage(message) {
      messages.push(message);
    },
    addBattlePopup() {},
    setActorState() {},
    setEnemyState() {},
    setActionPhase() {},
  };

  const manager = new BattleManager(scene);
  const partyController = new BattlePartyController(scene);
  scene.battleManager = manager;
  scene.partyController = partyController;

  return {
    Game_Battler,
    manager,
    partyController,
    party,
    enemies,
    scene,
    messages,
  };
}

function makeBattler(Game_Battler, name) {
  return new Game_Battler({
    name,
    maxHp: 100,
    maxMp: 10,
  });
}

function testDatabaseAccessorsShareOneSafeConvention() {
  const DatabaseManager = loadClasses(
    ["js/core/DatabaseManager.js"],
    "DatabaseManager",
    { DebugManager: { log() {} }, DatabaseValidator: { validate() {} } },
  ).classes;

  DatabaseManager.actors = [null, { id: 1, name: "Tyler" }];
  DatabaseManager.enemies = [null, { id: 1, name: "Slime" }];
  DatabaseManager.encounters = [null, { id: 1, name: "Test Battle" }];
  DatabaseManager.items = [null, { id: 1, name: "Potion" }];
  DatabaseManager.weapons = [null, { id: 1, name: "Sword" }];
  DatabaseManager.armors = [null, { id: 1, name: "Armor" }];
  DatabaseManager.skills = [null, { id: 1, name: "Mend" }];
  DatabaseManager.essences = [null, { id: 1, name: "Restore" }];
  DatabaseManager.statuses = [null, { id: 1, key: "poison", name: "Poison" }];

  assert.equal(DatabaseManager.actor(1).name, "Tyler");
  assert.equal(DatabaseManager.enemy(1).name, "Slime");
  assert.equal(DatabaseManager.encounter(1).name, "Test Battle");
  assert.equal(DatabaseManager.item(1).name, "Potion");
  assert.equal(DatabaseManager.weapon(1).name, "Sword");
  assert.equal(DatabaseManager.armor(1).name, "Armor");
  assert.equal(DatabaseManager.skill(1).name, "Mend");
  assert.equal(DatabaseManager.essence(1).name, "Restore");
  assert.equal(DatabaseManager.status(1).name, "Poison");

  DatabaseManager.enemies = undefined;
  assert.equal(DatabaseManager.enemy(1), null);

  assert.equal(DatabaseManager.actorName(99), "Unknown Actor 99");
  assert.equal(DatabaseManager.enemyName(99), "Unknown Enemy 99");
  assert.equal(DatabaseManager.encounterName(99), "Unknown Encounter 99");
  assert.equal(DatabaseManager.itemName(99), "Unknown Item 99");
  assert.equal(DatabaseManager.weaponName(99), "Unknown Weapon 99");
  assert.equal(DatabaseManager.armorName(99), "Unknown Armor 99");
  assert.equal(DatabaseManager.skillName(99), "Unknown Skill 99");
  assert.equal(DatabaseManager.essenceName(99), "Unknown Essence 99");
  assert.equal(DatabaseManager.statusName(99), "Unknown Status 99");
  assert.equal(
    DatabaseManager.statusNameByKey("missing"),
    "Unknown Status missing",
  );
}

function testStopFreezesPersonalTurnsButExpiresOnSideRounds() {
  const { Game_Battler, manager } = makeBattleFixture();
  const battler = makeBattler(Game_Battler, "Stopped");

  battler.addStatus("slow");
  battler.addStatus("deathSentence");
  battler.addStatus("stop");

  assert.equal(battler.haltsTurnProgression(), true);
  assert.equal(battler.statusRuntime("stop").turnsRemaining, 2);
  assert.equal(battler.statusRuntime("deathSentence").turnsRemaining, 3);

  assert.deepEqual(Array.from(manager.buildTurnQueue([battler])), []);
  assert.equal(battler.statusRuntime("stop").turnsRemaining, 1);
  assert.equal(battler.statusRuntime("deathSentence").turnsRemaining, 3);

  assert.deepEqual(Array.from(manager.buildTurnQueue([battler])), []);
  assert.equal(battler.hasStatus("stop"), false);
  assert.equal(battler.statusRuntime("deathSentence").turnsRemaining, 3);

  const resumedQueue = Array.from(manager.buildTurnQueue([battler]));
  assert.equal(resumedQueue.length, 1);
  assert.equal(resumedQueue[0], battler);

  battler.tickStatusDurations({ mode: "turn" });
  assert.equal(battler.statusRuntime("deathSentence").turnsRemaining, 2);
}

function testStopSkipsTurnStartTriggersForAlreadyQueuedTurns() {
  const { Game_Battler, manager, partyController } = makeBattleFixture();
  const battler = makeBattler(Game_Battler, "Frozen Mid-Round");

  battler.addStatus("poison");
  battler.addStatus("deathSentence");
  battler.addStatus("stop");
  partyController.activeBattler = battler;

  assert.equal(manager.beginPartyTurn(), false);
  assert.equal(battler.hp, 100);

  manager.endPartyTurn();
  assert.equal(battler.statusRuntime("deathSentence").turnsRemaining, 3);
  assert.equal(battler.statusRuntime("stop").turnsRemaining, 2);
}

function testHaltedProgressionRequiresFiniteExpiration() {
  const DatabaseValidator = loadClasses(
    ["js/core/DatabaseValidator.js"],
    "DatabaseValidator",
  ).classes;
  const invalidStatuses = JSON.parse(JSON.stringify(statuses));
  const stop = invalidStatuses.find((status) => status?.key === "stop");
  const errors = [];

  stop.duration = { type: "untilRemoved" };
  DatabaseValidator.validateStatuses(invalidStatuses, errors);

  assert.equal(
    errors.some((error) =>
      error.includes("haltsTurnProgression must use a finite turns/countdown duration"),
    ),
    true,
  );
}

function testLimitGainMultiplierContractIsDataDriven() {
  const { Game_Battler } = makeBattleFixture();
  const battler = makeBattler(Game_Battler, "Limit Contract");

  assert.equal(battler.limitGainMultiplier(), 1);

  battler.setHp(20);
  assert.equal(battler.hasStatus("nearDeath"), true);
  assert.equal(battler.limitGainMultiplier(), 2);

  battler.addStatus("fury");
  assert.equal(battler.limitGainMultiplier(), 4);

  battler.addStatus("sadness");
  assert.equal(battler.hasStatus("fury"), false);
  assert.equal(battler.limitGainMultiplier(), 1);

  battler.setHp(100);
  assert.equal(battler.hasStatus("nearDeath"), false);
  assert.equal(battler.limitGainMultiplier(), 0.5);
}

function run() {
  testDatabaseAccessorsShareOneSafeConvention();
  testStopFreezesPersonalTurnsButExpiresOnSideRounds();
  testStopSkipsTurnStartTriggersForAlreadyQueuedTurns();
  testHaltedProgressionRequiresFiniteExpiration();
  testLimitGainMultiplierContractIsDataDriven();

  console.log("Audit runtime cleanup regression tests passed.");
}

run();
