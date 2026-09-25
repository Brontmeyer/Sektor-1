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
    activeTimeClaimDelay: 0,
    battleInputLocked: true,
    scheduleActiveTimeClaimDelay(delay) {
      this.activeTimeClaimDelay = Math.max(this.activeTimeClaimDelay, delay);
      return this.activeTimeClaimDelay;
    },
    usesActiveTimeAuthority() { return true; },
    addBattleMessage() {},
    setActorState(state, duration) { this.actorState = [state, duration]; },
    setActionPhase(phase, duration = 0) {
      this.actionPhase = phase;
      this.actionPhaseTimer = duration;
    },
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

function testReadyEnemyActsWithoutInterruptingOpenActorCommand() {
  const harness = makeHarness(null);
  harness.partyController.setActiveBattler(harness.actor);
  harness.timeManager.activeBattler = null;
  harness.scene.battleInputLocked = false;
  harness.timeManager.claimNextReadyBattler = function claimEnemy(predicate) {
    assert.equal(typeof predicate, "function");
    assert.equal(predicate(harness.enemy), true);
    assert.equal(predicate(harness.actor), false);
    this.activeBattler = harness.enemy;
    return harness.enemy;
  };

  assert.equal(harness.manager.updateActiveTimeAuthority(), harness.enemy);
  assert.equal(harness.scene.enemyPerformed, harness.enemy);
  assert.equal(harness.partyController.currentBattler(), harness.actor);
  assert.equal(harness.scene.battleInputLocked, false);
}

function testActiveInterruptDefeatClearsReservedActorCommand() {
  const harness = makeHarness(null);
  harness.partyController.setActiveBattler(harness.actor);
  harness.timeManager.activeBattler = null;
  harness.actor.hp = 0;
  let resetBattler = null;
  harness.timeManager.reset = (battler) => {
    resetBattler = battler;
  };
  harness.timeManager.claimNextReadyBattler = () => null;

  assert.equal(harness.manager.updateActiveTimeAuthority(), null);
  assert.equal(resetBattler, harness.actor);
  assert.equal(harness.partyController.currentBattler(), null);
  assert.equal(harness.scene.battleInputLocked, true);
}

function testEnemyCompletionRestoresReservedPlayerCommand() {
  const harness = makeHarness(null);
  harness.partyController.setActiveBattler(harness.actor);
  harness.timeManager.activeBattler = harness.enemy;
  harness.timeManager.reset = () => {};
  harness.manager.detectBattleOutcome = () => null;
  harness.scene.battleInputLocked = true;

  harness.manager.completeEnemyTurn(harness.enemy, false);

  assert.equal(harness.partyController.currentBattler(), harness.actor);
  assert.equal(harness.scene.battleInputLocked, false);
  assert.equal(harness.manager.currentTurnState(), "command");
  assert.equal(harness.scene.activeTimeClaimDelay, 0.45);
}

function testPlayerActionChosenDuringEnemyRecoveryQueuesThenExecutesFirst() {
  const harness = makeHarness(null);
  harness.partyController.setActiveBattler(harness.actor);
  harness.scene.activeTimeClaimDelay = 0.3;
  harness.scene.battleInputLocked = false;

  assert.equal(harness.manager.commitPartyAction("attack"), "queued");
  assert.equal(harness.manager.queuedPartyAction.battler, harness.actor);
  assert.equal(harness.scene.actionPhase, "none");
  assert.equal(harness.scene.battleInputLocked, true);

  let enemyClaims = 0;
  harness.timeManager.claimNextReadyBattler = () => {
    enemyClaims++;
    return harness.enemy;
  };

  assert.equal(harness.manager.updateActiveTimeAuthority(), null);
  assert.equal(enemyClaims, 0);

  harness.scene.activeTimeClaimDelay = 0;
  assert.equal(harness.manager.updateActiveTimeAuthority(), true);
  assert.equal(harness.manager.queuedPartyAction, null);
  assert.equal(harness.scene.actionPhase, "lunge");
  assert.equal(harness.scene.pendingAttackDamage, true);
  assert.equal(enemyClaims, 0);
}

function testEnemyCompletionAddsCadenceBeforeNextReadyClaim() {
  const harness = makeHarness(null);
  harness.timeManager.activeBattler = harness.enemy;
  harness.timeManager.reset = () => {};
  harness.manager.detectBattleOutcome = () => null;

  harness.manager.completeEnemyTurn(harness.enemy, false);

  assert.equal(harness.timeManager.activeBattler, null);
  assert.equal(harness.scene.activeTimeClaimDelay, 0.45);

  let claims = 0;
  harness.timeManager.claimNextReadyBattler = () => {
    claims++;
    return harness.actor;
  };

  assert.equal(harness.manager.updateActiveTimeAuthority(), null);
  assert.equal(claims, 0);

  harness.scene.activeTimeClaimDelay = 0;
  harness.manager.processTurnStartStatuses = () => [];
  harness.manager.battlerCanAct = () => true;
  harness.manager.startForcedPartyAction = () => false;
  assert.equal(harness.manager.updateActiveTimeAuthority(), harness.actor);
  assert.equal(claims, 1);
}

function testLiveSceneStartsIdleUntilSomeoneIsReady() {
  const source = read("js/scenes/Scene_Battle.js");

  assert.match(source, /usesActiveTimeAuthority\(\) \{\s*return true;/);
  assert.match(source, /Scene_Battle\.prototype\.battleTimeDeltaTime\.call\([\s\S]*?this\.updateBattleTime\(timeDeltaTime\);\s*Scene_Battle\.prototype\.updateActiveTimeAuthority\.call\(this\);/);
  assert.match(source, /this\.partyController\.clearActiveBattler\(\)/);
}

function run() {
  testReadyActorBecomesTheOnlyCommandOwner();
  testReadyEnemyUsesSameAuthorityInsteadOfWaitingForEnemyRound();
  testFinishingActorActionReturnsBattleToWaitingForTime();
  testReadyEnemyActsWithoutInterruptingOpenActorCommand();
  testActiveInterruptDefeatClearsReservedActorCommand();
  testEnemyCompletionRestoresReservedPlayerCommand();
  testPlayerActionChosenDuringEnemyRecoveryQueuesThenExecutesFirst();
  testEnemyCompletionAddsCadenceBeforeNextReadyClaim();
  testLiveSceneStartsIdleUntilSomeoneIsReady();
  console.log("Battle Time authority regression tests passed.");
}

run();
