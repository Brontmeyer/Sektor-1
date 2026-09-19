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

function makeDatabaseManager() {
  return {
    statuses,
    statusByKey(key) {
      return statuses.find((status) => status?.key === key) || null;
    },
  };
}

function makeFixture() {
  const loaded = loadClasses(
    [
      "js/objects/Game_Battler.js",
      "js/battle/BattleManager.js",
      "js/battle/BattlePartyController.js",
    ],
    "{ Game_Battler, BattleManager, BattlePartyController }",
    {
      DatabaseManager: makeDatabaseManager(),
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
    addBattleMessage() {},
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
    BattleManager,
    manager,
    partyController,
    party,
    enemies,
    scene,
  };
}

function makeBattler(Game_Battler, name) {
  return new Game_Battler({
    name,
    maxHp: 100,
    maxMp: 10,
  });
}

function names(queue) {
  return Array.from(queue, (battler) => battler.name);
}

function testTurnSpeedMultiplierIsDataDriven() {
  const { Game_Battler } = makeFixture();
  const battler = makeBattler(Game_Battler, "Speedy");

  assert.equal(battler.turnSpeedMultiplier(), 1);

  battler.addStatus("haste");
  assert.equal(battler.turnSpeedMultiplier(), 2);

  battler.addStatus("slow");
  assert.equal(battler.turnSpeedMultiplier(), 1);

  battler.removeStatus("haste");
  assert.equal(battler.turnSpeedMultiplier(), 0.5);
}

function testFractionalTurnProgressBuildsInterleavedQueues() {
  const { Game_Battler, manager } = makeFixture();
  const haste = makeBattler(Game_Battler, "Haste");
  const normal = makeBattler(Game_Battler, "Normal");
  const slow = makeBattler(Game_Battler, "Slow");

  haste.addStatus("haste");
  slow.addStatus("slow");

  assert.deepEqual(
    names(manager.buildTurnQueue([haste, normal, slow])),
    ["Haste", "Normal", "Slow", "Haste"],
  );

  assert.deepEqual(
    names(manager.buildTurnQueue([haste, normal, slow])),
    ["Haste", "Normal", "Haste"],
  );

  assert.deepEqual(
    names(manager.buildTurnQueue([haste, normal, slow])),
    ["Haste", "Normal", "Slow", "Haste"],
  );
}

function testPartyControllerConsumesScheduledTurnSlots() {
  const { Game_Battler, party, partyController } = makeFixture();
  const haste = makeBattler(Game_Battler, "Haste");
  const normal = makeBattler(Game_Battler, "Normal");
  const slow = makeBattler(Game_Battler, "Slow");

  haste.addStatus("haste");
  slow.addStatus("slow");
  party.push(haste, normal, slow);

  partyController.initializePartyTurnQueue();

  assert.deepEqual(names(partyController.partyTurnQueue), [
    "Haste",
    "Normal",
    "Slow",
    "Haste",
  ]);
  assert.equal(partyController.currentBattler(), haste);

  partyController.nextBattler();
  assert.equal(partyController.currentBattler(), normal);
  partyController.nextBattler();
  assert.equal(partyController.currentBattler(), slow);
  partyController.nextBattler();
  assert.equal(partyController.currentBattler(), haste);
}

function testEnemySchedulingUsesTheSameProgressContract() {
  const { Game_Battler, manager, enemies } = makeFixture();
  const haste = makeBattler(Game_Battler, "Fast Enemy");
  const slow = makeBattler(Game_Battler, "Slow Enemy");

  haste.addStatus("haste");
  slow.addStatus("slow");
  enemies.push(haste, slow);

  assert.deepEqual(names(manager.prepareEnemyTurnQueue()), [
    "Fast Enemy",
    "Slow Enemy",
    "Fast Enemy",
  ]);
  assert.deepEqual(names(manager.prepareEnemyTurnQueue()), [
    "Fast Enemy",
    "Fast Enemy",
  ]);
  assert.deepEqual(names(manager.prepareEnemyTurnQueue()), [
    "Fast Enemy",
    "Slow Enemy",
    "Fast Enemy",
  ]);
}

function testBattlerRelativeCountdownPacingFollowsScheduledTurns() {
  const { Game_Battler, manager } = makeFixture();
  const haste = makeBattler(Game_Battler, "Haste Countdown");
  const slow = makeBattler(Game_Battler, "Slow Countdown");

  haste.addStatus("haste");
  haste.addStatus("deathSentence");
  slow.addStatus("slow");
  slow.addStatus("deathSentence");

  const hasteRound = manager.buildTurnQueue([haste]);
  assert.equal(hasteRound.length, 2);
  for (const battler of hasteRound) {
    battler.tickStatusDurations();
  }
  assert.equal(haste.statusRuntime("deathSentence").turnsRemaining, 1);

  const slowRoundOne = manager.buildTurnQueue([slow]);
  assert.equal(slowRoundOne.length, 1);
  slowRoundOne[0].tickStatusDurations();
  assert.equal(slow.statusRuntime("deathSentence").turnsRemaining, 2);

  const slowRoundTwo = manager.buildTurnQueue([slow]);
  assert.equal(slowRoundTwo.length, 0);
  assert.equal(slow.statusRuntime("deathSentence").turnsRemaining, 2);

  const slowRoundThree = manager.buildTurnQueue([slow]);
  assert.equal(slowRoundThree.length, 1);
  slowRoundThree[0].tickStatusDurations();
  assert.equal(slow.statusRuntime("deathSentence").turnsRemaining, 1);
}



function testAllSlowSidesAdvancePastAnEmptyFractionalRound() {
  const {
    Game_Battler,
    BattleManager,
    manager,
    partyController,
    party,
    enemies,
    scene,
  } = makeFixture();
  const actor = makeBattler(Game_Battler, "Slow Actor");
  const enemy = makeBattler(Game_Battler, "Slow Enemy");

  actor.addStatus("slow");
  enemy.addStatus("slow");
  party.push(actor);
  enemies.push(enemy);

  // Consume each side's seeded opening turn so both sides carry zero progress.
  partyController.initializePartyTurnQueue();
  assert.equal(partyController.partyTurnQueue.length, 1);
  assert.equal(manager.prepareEnemyTurnQueue().length, 1);

  // The next side round has no slots for either Slow battler. The scheduler
  // must advance through that empty fractional round and reach the following
  // party turn instead of stalling or recursing forever.
  manager.startNextPartyRound(true);

  assert.equal(partyController.currentBattler(), actor);
  assert.equal(partyController.partyTurnQueue.length, 1);
  assert.equal(manager.currentTurnState(), BattleManager.TURN_COMMAND);
  assert.equal(scene.battleInputLocked, false);
}

function testSceneBattleDefersEnemySelectionToScheduledQueue() {
  const Scene_Battle = loadClasses(
    ["js/scenes/Scene_Battle.js"],
    "Scene_Battle",
    { Scene_Base: class {} },
  ).classes;
  let received = "sentinel";
  const fakeScene = {
    battleManager: {
      performEnemyTurn(enemy) {
        received = enemy;
      },
    },
  };

  Scene_Battle.prototype.performEnemyTurn.call(fakeScene);

  assert.equal(received, undefined);
}

function testTurnSpeedMetadataValidation() {
  const DatabaseValidator = loadClasses(
    ["js/core/DatabaseValidator.js"],
    "DatabaseValidator",
  ).classes;
  const invalidStatuses = JSON.parse(JSON.stringify(statuses));
  const haste = invalidStatuses.find((status) => status?.key === "haste");
  const errors = [];

  haste.effects.turnSpeedMultiplier = 0;
  DatabaseValidator.validateStatuses(invalidStatuses, errors);

  assert.equal(
    errors.some((error) => error.includes("turnSpeedMultiplier")),
    true,
  );
}

function run() {
  testTurnSpeedMultiplierIsDataDriven();
  testFractionalTurnProgressBuildsInterleavedQueues();
  testPartyControllerConsumesScheduledTurnSlots();
  testEnemySchedulingUsesTheSameProgressContract();
  testBattlerRelativeCountdownPacingFollowsScheduledTurns();
  testAllSlowSidesAdvancePastAnEmptyFractionalRound();
  testSceneBattleDefersEnemySelectionToScheduledQueue();
  testTurnSpeedMetadataValidation();

  console.log("Turn speed runtime regression tests passed.");
}

run();
