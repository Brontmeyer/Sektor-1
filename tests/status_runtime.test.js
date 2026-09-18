"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const statuses = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "data", "Statuses.json"), "utf8"),
);

function loadClass(relativePath, className, globals = {}) {
  const filename = path.join(projectRoot, relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const context = vm.createContext({ console, ...globals });

  vm.runInContext(
    `${source}\nglobalThis.__loadedClass = ${className};`,
    context,
    { filename },
  );

  return context.__loadedClass;
}

function makeDatabaseManager() {
  return {
    statuses,
    statusByKey(key) {
      return statuses.find((status) => status?.key === key) || null;
    },
  };
}

function loadBattlerClass() {
  return loadClass("js/objects/Game_Battler.js", "Game_Battler", {
    DatabaseManager: makeDatabaseManager(),
    DebugManager: { log() {} },
  });
}

function makeBattler(data = {}) {
  const Game_Battler = loadBattlerClass();

  return new Game_Battler({
    name: "Test Battler",
    maxHp: 1000,
    maxMp: 100,
    ...data,
  });
}


function testDatabaseStatusLookup() {
  const DatabaseManager = loadClass(
    "js/core/DatabaseManager.js",
    "DatabaseManager",
    { DebugManager: { log() {} } },
  );

  DatabaseManager.statuses = statuses;

  assert.equal(DatabaseManager.statusByKey("poison").id, 1);
  assert.equal(DatabaseManager.statusNameByKey("regen"), "Regen");
  assert.equal(DatabaseManager.statusByKey("missing"), null);
}

function testStatusApplicationRefreshAndInteractions() {
  const battler = makeBattler();

  assert.equal(battler.addStatus("barrier"), true);
  assert.equal(battler.statusRuntime("barrier").turnsRemaining, 4);

  battler.tickStatusDurations();
  battler.tickStatusDurations();
  assert.equal(battler.statusRuntime("barrier").turnsRemaining, 2);

  assert.equal(battler.addStatus("barrier"), true);
  assert.equal(battler.statusRuntime("barrier").turnsRemaining, 4);
  assert.equal(
    battler.statuses.filter((status) => status.key === "barrier").length,
    1,
  );

  assert.equal(battler.addStatus("fury"), true);
  assert.equal(battler.hasStatus("fury"), true);
  assert.equal(battler.addStatus("sadness"), true);
  assert.equal(battler.hasStatus("fury"), false);
  assert.equal(battler.hasStatus("sadness"), true);

  // Reapplication also repairs an invalid loaded state containing both
  // mutually exclusive statuses.
  battler.statuses.push({ key: "fury" });
  assert.equal(battler.hasStatus("fury"), true);
  battler.addStatus("sadness");
  assert.equal(battler.hasStatus("fury"), false);
  assert.equal(battler.hasStatus("sadness"), true);
}

function testStatusResistanceAndImmunity() {
  const immuneBattler = makeBattler({ statusRates: { poison: 0 } });
  const immuneResult = immuneBattler.tryAddStatus("poison", 1, () => 0);

  assert.equal(immuneResult.applied, false);
  assert.equal(immuneResult.reason, "immune");
  assert.equal(immuneBattler.hasStatus("poison"), false);

  const resistantBattler = makeBattler({
    statusFamilyRates: { mental: 0.5 },
  });
  const resisted = resistantBattler.tryAddStatus("sleep", 0.8, () => 0.4);

  assert.equal(resisted.applied, false);
  assert.equal(resisted.reason, "resisted");
  assert.equal(resisted.chance, 0.4);

  const applied = resistantBattler.tryAddStatus("sleep", 0.8, () => 0.39);

  assert.equal(applied.applied, true);
  assert.equal(applied.reason, "applied");
  assert.equal(resistantBattler.hasStatus("sleep"), true);
}

function testDerivedStatusesAndRemovalRules() {
  const battler = makeBattler();

  battler.setHp(250);
  assert.equal(battler.hasStatus("nearDeath"), true);
  assert.equal(battler.removeStatus("nearDeath"), false);

  battler.setHp(251);
  assert.equal(battler.hasStatus("nearDeath"), false);

  const result = battler.tryAddStatus("nearDeath", 1, () => 0);
  assert.equal(result.applied, false);
  assert.equal(result.reason, "derivedStatus");
}

function testTurnStartDamageAndHealing() {
  const battler = makeBattler();

  battler.setHp(500);
  battler.addStatus("poison");
  battler.addStatus("regen");

  const results = battler.processStatusTrigger("turnStart");
  const poison = results.find((result) => result.key === "poison");
  const regen = results.find((result) => result.key === "regen");

  assert.equal(poison.damage, 30);
  assert.equal(regen.healing, 30);
  assert.equal(battler.hp, 500);
}

function testCountdownExpirationAndActionPrevention() {
  const battler = makeBattler();

  battler.addStatus("paralyze");
  assert.equal(battler.canAct(), false);
  battler.tickStatusDurations();
  assert.equal(battler.statusRuntime("paralyze").turnsRemaining, 1);
  battler.tickStatusDurations();
  assert.equal(battler.hasStatus("paralyze"), false);
  assert.equal(battler.canAct(), true);

  battler.addStatus("deathSentence");
  battler.tickStatusDurations();
  battler.tickStatusDurations();
  assert.equal(battler.statusRuntime("deathSentence").turnsRemaining, 1);
  battler.tickStatusDurations();

  assert.equal(battler.hasStatus("deathSentence"), false);
  assert.equal(battler.hasStatus("death"), true);
  assert.equal(battler.hp, 0);

  const petrifyTarget = makeBattler();
  petrifyTarget.addStatus("slowNumb");
  petrifyTarget.tickStatusDurations();
  petrifyTarget.tickStatusDurations();
  petrifyTarget.tickStatusDurations();

  assert.equal(petrifyTarget.hasStatus("slowNumb"), false);
  assert.equal(petrifyTarget.hasStatus("petrify"), true);
  assert.equal(petrifyTarget.canAct(), false);
}

function testStatusSummary() {
  const battler = makeBattler();

  battler.addStatus("barrier");
  battler.addStatus("poison");
  battler.addStatus("regen");

  assert.equal(battler.statusSummary(2), "Barrier 4, Poison, +1");
}

function testBattleManagerTicksSkippedTurnsAndStartsNewRoundStatuses() {
  const Game_Battler = loadBattlerClass();
  const first = new Game_Battler({ name: "First", maxHp: 100, maxMp: 0 });
  const second = new Game_Battler({ name: "Second", maxHp: 100, maxMp: 0 });
  const enemy = new Game_Battler({ name: "Enemy", maxHp: 100, maxMp: 0 });
  const partyMembers = [first, second];

  const partyController = {
    partyTurnQueue: partyMembers,
    currentPartyTurn: 0,
    activeBattler: first,
    currentBattler() {
      return this.activeBattler;
    },
    hasNextBattler() {
      return this.currentPartyTurn + 1 < this.partyTurnQueue.length;
    },
    nextBattler() {
      this.currentPartyTurn++;
      this.activeBattler = this.partyTurnQueue[this.currentPartyTurn] || null;
      return this.activeBattler;
    },
    resetPartyTurnQueue() {
      this.partyTurnQueue = partyMembers.filter((battler) => battler.isAlive());
      this.currentPartyTurn = 0;
      this.activeBattler = this.partyTurnQueue[0] || null;
    },
  };

  const gameParty = {
    battleMembers: () => partyMembers,
    livingBattleMembers: () => partyMembers.filter((battler) => battler.isAlive()),
  };

  const BattleManager = loadClass("js/battle/BattleManager.js", "BattleManager", {
    DebugManager: { log() {} },
    $gameParty: gameParty,
  });

  const scene = {
    partyController,
    enemies: [enemy],
    enemyTurnIndex: 0,
    pendingEnemyTurn: false,
    enemyTurnDelay: 0,
    battleInputLocked: true,
    outcome: null,
    victory: false,
    defeat: false,
    actionPhase: "none",
    setActionPhase() {},
    addBattlePopup() {},
    addBattleMessage() {},
    setActorState() {},
    setEnemyState() {},
    queueEnemyTurn(delay) {
      this.pendingEnemyTurn = true;
      this.enemyTurnDelay = delay;
    },
  };
  const manager = new BattleManager(scene);

  first.addStatus("paralyze");
  assert.equal(manager.beginPartyTurn(), false);
  manager.skipPartyTurn();
  assert.equal(first.statusRuntime("paralyze").turnsRemaining, 1);
  assert.equal(partyController.activeBattler, second);
  assert.equal(manager.currentTurnState(), BattleManager.TURN_COMMAND);

  first.removeStatus("paralyze");
  first.addStatus("poison");
  first.setHp(100);
  partyController.activeBattler = second;
  partyController.currentPartyTurn = 1;
  scene.enemyTurnIndex = 0;

  manager.advanceEnemyTurn(true);

  assert.equal(partyController.activeBattler, first);
  assert.equal(first.hp, 97);
  assert.equal(manager.currentTurnState(), BattleManager.TURN_COMMAND);
  assert.equal(scene.battleInputLocked, false);
}


function testEnemyActionPreventionTicksAndSkipsDamage() {
  const Game_Battler = loadBattlerClass();
  const actor = new Game_Battler({ name: "Actor", maxHp: 100, maxMp: 0 });
  const enemy = new Game_Battler({
    name: "Paralyzed Enemy",
    maxHp: 100,
    maxMp: 0,
    attack: 50,
  });
  const partyMembers = [actor];

  const partyController = {
    partyTurnQueue: partyMembers,
    currentPartyTurn: 0,
    activeBattler: actor,
    currentBattler() {
      return this.activeBattler;
    },
    hasNextBattler() {
      return false;
    },
    nextBattler() {
      return null;
    },
    resetPartyTurnQueue() {
      this.partyTurnQueue = partyMembers.filter((battler) => battler.isAlive());
      this.currentPartyTurn = 0;
      this.activeBattler = this.partyTurnQueue[0] || null;
    },
  };

  const gameParty = {
    battleMembers: () => partyMembers,
    livingBattleMembers: () => partyMembers.filter((battler) => battler.isAlive()),
  };

  const BattleManager = loadClass("js/battle/BattleManager.js", "BattleManager", {
    DebugManager: { log() {} },
    $gameParty: gameParty,
  });

  const messages = [];
  const scene = {
    partyController,
    enemies: [enemy],
    enemyTurnIndex: 0,
    pendingEnemyTurn: false,
    enemyTurnDelay: 0,
    battleInputLocked: true,
    outcome: null,
    victory: false,
    defeat: false,
    actionPhase: "none",
    setActionPhase() {},
    addBattlePopup() {},
    addBattleMessage(message) {
      messages.push(message);
    },
    setActorState() {},
    setEnemyState() {},
    queueEnemyTurn(delay) {
      this.pendingEnemyTurn = true;
      this.enemyTurnDelay = delay;
    },
  };
  const manager = new BattleManager(scene);

  enemy.addStatus("paralyze");
  manager.performEnemyTurn(enemy);

  assert.equal(actor.hp, 100);
  assert.equal(enemy.statusRuntime("paralyze").turnsRemaining, 1);
  assert.equal(messages.includes("Paralyzed Enemy cannot act!"), true);
  assert.equal(scene.enemyTurnIndex, 0);
  assert.equal(manager.currentTurnState(), BattleManager.TURN_COMMAND);
}


function testCountdownOutcomeStopsActionSequence() {
  const Game_Battler = loadBattlerClass();
  const actor = new Game_Battler({ name: "Countdown Actor", maxHp: 100, maxMp: 0 });
  const enemy = new Game_Battler({ name: "Enemy", maxHp: 100, maxMp: 0 });
  const partyMembers = [actor];
  let queuedEnemyTurns = 0;

  const partyController = {
    activeBattler: actor,
    currentBattler() {
      return this.activeBattler;
    },
    hasNextBattler() {
      return false;
    },
  };
  const gameParty = {
    battleMembers: () => partyMembers,
    livingBattleMembers: () => partyMembers.filter((battler) => battler.isAlive()),
  };
  const BattleManager = loadClass("js/battle/BattleManager.js", "BattleManager", {
    DebugManager: { log() {} },
    $gameParty: gameParty,
  });
  const scene = {
    partyController,
    enemies: [enemy],
    encounter: { id: 1, name: "Test" },
    outcome: null,
    victory: false,
    defeat: false,
    pendingEnemyTurn: false,
    enemyTurnDelay: 0,
    battleInputLocked: true,
    setActionPhase() {},
    addBattlePopup() {},
    addBattleMessage() {},
    setActorState() {},
    setEnemyState() {},
    queueEnemyTurn() {
      queuedEnemyTurns++;
    },
  };
  const manager = new BattleManager(scene);

  actor.addStatus("deathSentence");
  actor.statusRuntime("deathSentence").turnsRemaining = 1;

  manager.finishPartyActionSequence();

  assert.equal(scene.outcome, BattleManager.OUTCOME_DEFEAT);
  assert.equal(actor.hasStatus("death"), true);
  assert.equal(actor.hp, 0);
  assert.equal(queuedEnemyTurns, 0);
}

testDatabaseStatusLookup();
testStatusApplicationRefreshAndInteractions();
testStatusResistanceAndImmunity();
testDerivedStatusesAndRemovalRules();
testTurnStartDamageAndHealing();
testCountdownExpirationAndActionPrevention();
testStatusSummary();
testBattleManagerTicksSkippedTurnsAndStartsNewRoundStatuses();
testEnemyActionPreventionTicksAndSkipsDamage();
testCountdownOutcomeStopsActionSequence();

console.log("Status runtime regression tests passed.");
