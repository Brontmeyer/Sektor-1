"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

function loadBattleManager() {
  const context = vm.createContext({
    console,
    BattleEnemyAI: class BattleEnemyAI {},
  });

  vm.runInContext(
    `${read("js/battle/BattleManager.js")}\nglobalThis.__Class = BattleManager;`,
    context,
  );

  return { context, BattleManager: context.__Class };
}

function battler(name) {
  return {
    name,
    hp: 100,
    isDefeated() { return this.hp <= 0; },
    haltsTurnProgression() { return false; },
    processStatusTrigger() { return []; },
    canAct() { return true; },
    stopDefending() { this.defending = false; },
    tickStatusDurations() {},
  };
}

function makeHarness(nextReady) {
  const { context, BattleManager } = loadBattleManager();
  const actor = battler("Actor");
  const enemy = battler("Enemy");
  const partyMembers = [actor];
  const partyController = {
    activeBattler: null,
    currentBattler() { return this.activeBattler; },
    setActiveBattler(value) { this.activeBattler = value; return value; },
    clearActiveBattler(value = this.activeBattler) {
      if (value && this.activeBattler && value !== this.activeBattler) return false;
      this.activeBattler = null;
      return true;
    },
  };
  let claimed = nextReady;
  const timeManager = {
    activeBattler: null,
    claimNextReadyBattler() {
      if (!claimed || this.activeBattler) return null;
      this.activeBattler = claimed;
      const result = claimed;
      claimed = null;
      return result;
    },
    releaseActiveBattler(value) {
      if (this.activeBattler !== value) return false;
      this.activeBattler = null;
      return true;
    },
    reset() {},
  };
  const scene = {
    outcome: null,
    enemies: [enemy],
    partyController,
    timeManager,
    actionPhase: "none",
    battleInputLocked: true,
    usesActiveTimeAuthority() { return true; },
    addBattleMessage() {},
    performEnemyTurn(value) { this.enemyPerformed = value; },
  };

  context.$gameParty = {
    battleMembers() { return partyMembers; },
    livingBattleMembers() { return partyMembers.filter((entry) => !entry.isDefeated()); },
  };

  const manager = new BattleManager(scene);
  return { context, BattleManager, manager, scene, actor, enemy, partyController, timeManager };
}

function testReadyActorBecomesTheOnlyCommandOwner() {
  const harness = makeHarness(null);
  harness.timeManager.activeBattler = null;
  harness.timeManager.claimNextReadyBattler = function claimActor() {
    this.activeBattler = harness.actor;
    return harness.actor;
  };
  harness.manager.processTurnStartStatuses = () => [];
  harness.manager.battlerCanAct = () => true;
  harness.manager.startForcedPartyAction = () => false;

  assert.equal(harness.manager.updateActiveTimeAuthority(), harness.actor);
  assert.equal(harness.partyController.currentBattler(), harness.actor);
  assert.equal(harness.scene.battleInputLocked, false);
  assert.equal(
    harness.manager.currentTurnState(),
    harness.BattleManager?.TURN_COMMAND || "command",
  );
}

function testReadyEnemyUsesSameAuthorityInsteadOfWaitingForEnemyRound() {
  const harness = makeHarness(null);
  harness.timeManager.claimNextReadyBattler = function claimEnemy() {
    this.activeBattler = harness.enemy;
    return harness.enemy;
  };

  assert.equal(harness.manager.updateActiveTimeAuthority(), harness.enemy);
  assert.equal(harness.scene.enemyPerformed, harness.enemy);
  assert.equal(harness.scene.battleInputLocked, true);
}

function testFinishingActorActionReturnsBattleToWaitingForTime() {
  const harness = makeHarness(null);
  harness.partyController.setActiveBattler(harness.actor);
  harness.timeManager.activeBattler = harness.actor;
  harness.scene.battleInputLocked = false;

  harness.manager.finishPartyAction();

  assert.equal(harness.partyController.currentBattler(), null);
  assert.equal(harness.timeManager.activeBattler, null);
  assert.equal(harness.scene.battleInputLocked, true);
  assert.equal(harness.manager.currentTurnState(), "turnStart");
}

function testLiveSceneStartsIdleUntilSomeoneIsReady() {
  const source = read("js/scenes/Scene_Battle.js");

  assert.match(source, /usesActiveTimeAuthority\(\) \{\s*return true;/);
  assert.match(source, /this\.updateBattleTime\(battleDeltaTime\);\s*Scene_Battle\.prototype\.updateActiveTimeAuthority\.call\(this\);/);
  assert.match(source, /this\.partyController\.clearActiveBattler\(\)/);
}

function run() {
  testReadyActorBecomesTheOnlyCommandOwner();
  testReadyEnemyUsesSameAuthorityInsteadOfWaitingForEnemyRound();
  testFinishingActorActionReturnsBattleToWaitingForTime();
  testLiveSceneStartsIdleUntilSomeoneIsReady();
  console.log("Battle Time authority regression tests passed.");
}

run();
