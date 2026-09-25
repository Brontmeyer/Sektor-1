"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
const statuses = JSON.parse(read("data/Statuses.json"));

function loadRuntime() {
  const DatabaseManager = {
    statuses,
    statusByKey(key) {
      return statuses.find((status) => status?.key === key) || null;
    },
  };
  const context = vm.createContext({ console, DatabaseManager });
  const source = [
    "js/objects/Game_Battler.js",
    "js/battle/BattleTimeManager.js",
  ]
    .map(read)
    .join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__classes = { Game_Battler, BattleTimeManager };`,
    context,
  );

  return context.__classes;
}

function makeFixture() {
  const { Game_Battler, BattleTimeManager } = loadRuntime();
  const party = [];
  const enemies = [];
  const scene = {
    enemies,
    outcome: null,
    getBattlePartyMembers() {
      return party;
    },
  };
  const manager = new BattleTimeManager(scene);

  function battler(name, agility = 10) {
    return new Game_Battler({ name, maxHp: 100, maxMp: 10, agility });
  }

  return { Game_Battler, BattleTimeManager, manager, scene, party, enemies, battler };
}

function testTimeInitializesForBothBattleSides() {
  const { manager, party, enemies, battler } = makeFixture();
  const actor = battler("Actor");
  const enemy = battler("Enemy");
  party.push(actor);
  enemies.push(enemy);

  manager.setValue(actor, 75);
  manager.setValue(enemy, 40);
  manager.initialize();

  assert.equal(manager.value(actor), 0);
  assert.equal(manager.value(enemy), 0);
  assert.equal(manager.maximum(), 100);
}

function testAgilityChangesContinuousFillRate() {
  const { manager, party, battler } = makeFixture();
  const slow = battler("Slow Feet", 5);
  const fast = battler("Fast Feet", 20);
  party.push(slow, fast);
  manager.initialize();

  manager.update(1);

  assert.equal(manager.value(fast) > manager.value(slow), true);
  assert.equal(manager.value(slow) > 0, true);
}

function testHasteAndSlowModifyTimeFill() {
  const { manager, party, battler } = makeFixture();
  const haste = battler("Haste", 10);
  const normal = battler("Normal", 10);
  const slow = battler("Slow", 10);
  haste.addStatus("haste");
  slow.addStatus("slow");
  party.push(haste, normal, slow);
  manager.initialize();

  manager.update(1);

  assert.equal(manager.value(haste), manager.value(normal) * 2);
  assert.equal(manager.value(slow), manager.value(normal) * 0.5);
}

function testStopFreezesAndDefeatClearsTime() {
  const { manager, party, battler } = makeFixture();
  const stopped = battler("Stopped", 10);
  const defeated = battler("Defeated", 10);
  party.push(stopped, defeated);
  manager.initialize();
  manager.setValue(stopped, 42);
  manager.setValue(defeated, 60);
  stopped.addStatus("stop");
  defeated.hp = 0;

  manager.update(2);

  assert.equal(manager.value(stopped), 42);
  assert.equal(manager.value(defeated), 0);
}

function testStopDurationStillExpiresWhileVisibleTimeIsFrozen() {
  const { manager, party, battler } = makeFixture();
  const stopped = battler("Stopped", 10);
  party.push(stopped);
  manager.initialize();
  manager.setValue(stopped, 42);
  stopped.addStatus("stop");

  manager.update(10);

  assert.equal(manager.value(stopped), 42);
  assert.equal(stopped.hasStatus("stop"), false);

  manager.update(1);
  assert.equal(manager.value(stopped) > 42, true);
}

function testTimeClampsAtReadyAndCanResetAfterAction() {
  const { manager, party, battler } = makeFixture();
  const actor = battler("Ready", 50);
  party.push(actor);
  manager.initialize();

  manager.update(10);

  assert.equal(manager.value(actor), manager.maximum());
  assert.equal(manager.isReady(actor), true);
  manager.reset(actor);
  assert.equal(manager.value(actor), 0);
  assert.equal(manager.isReady(actor), false);
}

function testReadyBattlersQueueAcrossBothSidesAndClaimInReadyOrder() {
  const { manager, party, enemies, battler } = makeFixture();
  const actor = battler("Actor", 10);
  const enemy = battler("Enemy", 10);
  party.push(actor);
  enemies.push(enemy);
  manager.initialize();

  manager.setValue(enemy, 100);
  manager.setValue(actor, 100);

  assert.deepEqual(
    Array.from(manager.queuedBattlers()).map((entry) => entry.name),
    ["Enemy", "Actor"],
  );

  assert.equal(manager.claimNextReadyBattler(), enemy);
  assert.equal(manager.claimNextReadyBattler(), null);
  assert.equal(manager.releaseActiveBattler(enemy), true);
  manager.reset(enemy);
  assert.equal(manager.claimNextReadyBattler(), actor);
}

function testStoppedReadyBattlerWaitsWithoutBlockingOtherReadyBattlers() {
  const { manager, party, enemies, battler } = makeFixture();
  const stopped = battler("Stopped", 10);
  const enemy = battler("Enemy", 10);
  party.push(stopped);
  enemies.push(enemy);
  manager.initialize();

  manager.setValue(stopped, 100);
  manager.setValue(enemy, 100);
  stopped.addStatus("stop");

  assert.equal(manager.claimNextReadyBattler(), enemy);
  assert.equal(manager.releaseActiveBattler(enemy), true);
  manager.reset(enemy);
  assert.equal(manager.claimNextReadyBattler(), null);

  manager.update(10);
  assert.equal(stopped.hasStatus("stop"), false);
  assert.equal(manager.claimNextReadyBattler(), stopped);
}

function testDefeatedQueuedBattlerIsDiscardedBeforeClaim() {
  const { manager, party, enemies, battler } = makeFixture();
  const actor = battler("Actor", 10);
  const enemy = battler("Enemy", 10);
  party.push(actor);
  enemies.push(enemy);
  manager.initialize();

  manager.setValue(enemy, 100);
  manager.setValue(actor, 100);
  enemy.hp = 0;

  assert.equal(manager.claimNextReadyBattler(), actor);
}

function testSceneUsesBattleSpeedScaledDeltaForTime() {
  const Scene_Battle = vm.runInNewContext(
    `${read("js/scenes/Scene_Battle.js")}\nScene_Battle;`,
    { Scene_Base: class {} },
  );
  const calls = [];
  const fakeScene = {
    timeManager: {
      update(deltaTime) {
        calls.push(deltaTime);
      },
    },
  };

  Scene_Battle.prototype.updateBattleTime.call(fakeScene, 1.35);
  assert.deepEqual(calls, [1.35]);

  const source = read("js/scenes/Scene_Battle.js");
  assert.match(source, /this\.updateBattleTime\(battleDeltaTime\)/);
}

function testCompletedTurnsResetTheirBattleLocalClock() {
  const source = read("js/battle/BattleManager.js");

  assert.match(source, /this\.scene\.timeManager\?\.reset\?\.\(battler\)/);
  assert.match(source, /this\.scene\.timeManager\?\.reset\?\.\(enemy\)/);
}

function testTimeManagerLoadsBeforeBattleScene() {
  const source = read("index.html");
  const timeIndex = source.indexOf("BattleTimeManager.js");
  const sceneIndex = source.indexOf("Scene_Battle.js");

  assert.equal(timeIndex >= 0, true);
  assert.equal(sceneIndex >= 0, true);
  assert.equal(timeIndex < sceneIndex, true);
}

function run() {
  testTimeInitializesForBothBattleSides();
  testAgilityChangesContinuousFillRate();
  testHasteAndSlowModifyTimeFill();
  testStopFreezesAndDefeatClearsTime();
  testStopDurationStillExpiresWhileVisibleTimeIsFrozen();
  testTimeClampsAtReadyAndCanResetAfterAction();
  testReadyBattlersQueueAcrossBothSidesAndClaimInReadyOrder();
  testStoppedReadyBattlerWaitsWithoutBlockingOtherReadyBattlers();
  testDefeatedQueuedBattlerIsDiscardedBeforeClaim();
  testSceneUsesBattleSpeedScaledDeltaForTime();
  testCompletedTurnsResetTheirBattleLocalClock();
  testTimeManagerLoadsBeforeBattleScene();

  console.log("Battle Time foundation regression tests passed.");
}

run();
