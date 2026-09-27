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
const magick = readData("Magick.json");
const statuses = readData("Statuses.json");

function createHarness() {
  const partyMembers = [];
  const DatabaseManager = {
    actor: (id) => actors[id] || null,
    enemy: (id) => enemies[id] || null,
    magick: (id) => magick[id] || null,
    magickName: (id) => magick[id]?.name || `Unknown Magick ${id}`,
    statusByKey: (key) => statuses.find((status) => status?.key === key) || null,
    weapon: () => null,
    armor: () => null,
    accessory: () => null,
    essence: () => null,
    skill: () => null,
    valorArt: () => null,
    enemySkill: () => null,
  };
  const gameParty = {
    battleMembers: () => partyMembers,
    livingBattleMembers: () => partyMembers.filter((battler) => battler.isAlive()),
    gainItem() {},
    gainGil() {},
  };
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    DatabaseManager,
    DebugManager: { log() {} },
    $gameParty: gameParty,
  });
  const source = [
    "js/objects/Game_Battler.js",
    "js/objects/Game_Actor.js",
    "js/objects/Game_Enemy.js",
    "js/battle/BattleTargetManager.js",
    "js/battle/BattleEnemyAI.js",
    "js/battle/BattleManager.js",
  ]
    .map((relativePath) =>
      fs.readFileSync(path.join(projectRoot, relativePath), "utf8"),
    )
    .join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__classes = { Game_Actor, Game_Enemy, BattleTargetManager, BattleManager };`,
    context,
  );

  const { Game_Actor, Game_Enemy, BattleTargetManager, BattleManager } =
    context.__classes;
  const caster = new Game_Actor(1);
  const ally = new Game_Actor(2);
  const enemy = new Game_Enemy(1);
  const retreat = magick[43];

  partyMembers.push(caster, ally);
  caster.maxMp = Math.max(caster.maxMp, 200);
  caster.mp = caster.maxMp;
  caster.learnMagick(retreat.id);

  let hidden = false;
  let actorState = "idle";
  let finishedOutcome = null;
  const scene = {
    encounter: { canEscape: true },
    enemies: [enemy],
    pendingSkill: null,
    pendingMagick: null,
    pendingMagickTarget: null,
    pendingItem: null,
    targetGroup: "enemy",
    targetScope: "single",
    selectedEnemyIndex: 0,
    selectedAllyIndex: 0,
    selectingEnemyTarget: false,
    enemyTargetAction: null,
    battleInputLocked: false,
    actionPhase: "none",
    partyController: { currentBattler: () => caster },
    magickWindow: {
      currentMagick: () => retreat,
      hide() {
        hidden = true;
      },
    },
    addBattleMessage() {},
    showBattleBanner() {},
    setActorState(state) {
      actorState = state;
    },
    setEnemyState() {},
    setActionPhase(phase, duration = 0) {
      this.actionPhase = phase;
      this.actionPhaseTimer = duration;
    },
    finishBattle(outcome) {
      finishedOutcome = outcome;
      return outcome;
    },
    performMagickEffect() {
      return this.battleManager.performMagickEffect();
    },
    getFormationType: () => "normal",
  };
  scene.targetManager = new BattleTargetManager(scene);
  const manager = new BattleManager(scene);
  scene.battleManager = manager;

  return {
    caster,
    ally,
    retreat,
    scene,
    manager,
    magickWindowHidden: () => hidden,
    actorState: () => actorState,
    finishedOutcome: () => finishedOutcome,
  };
}

function testRetreatWaitsForBattlefieldConfirmation() {
  const { caster, retreat, scene, manager, magickWindowHidden } = createHarness();
  const mpBefore = caster.mp;

  manager.executeMagick();

  assert.equal(scene.pendingMagick, retreat);
  assert.equal(scene.pendingMagickTarget, null);
  assert.equal(scene.targetGroup, "ally");
  assert.equal(scene.targetScope, "all");
  assert.equal(scene.targetManager.getSelectedTarget(), caster);
  assert.deepEqual(
    Array.from(scene.targetManager.getCurrentTargets(), (actor) => actor.actorId),
    [1, 2],
  );
  assert.equal(scene.enemyTargetAction, "magick");
  assert.equal(scene.selectingEnemyTarget, true);
  assert.equal(scene.battleInputLocked, false);
  assert.equal(scene.actionPhase, "none");
  assert.equal(caster.mp, mpBefore);
  assert.equal(magickWindowHidden(), true);
}

function testConfirmedRetreatAnimatesThenAutomaticallyLeavesBattle() {
  const {
    caster,
    retreat,
    scene,
    manager,
    actorState,
    finishedOutcome,
  } = createHarness();
  const mpBefore = caster.mp;

  manager.executeMagick();
  scene.pendingMagickTarget = caster;
  scene.selectingEnemyTarget = false;
  scene.enemyTargetAction = null;

  assert.equal(manager.commitPartyAction("magick"), true);
  assert.equal(scene.actionPhase, "magickCast");
  assert.equal(actorState(), "magick");
  assert.equal(finishedOutcome(), null);
  assert.equal(caster.mp, mpBefore);

  manager.updateActionPhase(0.4);
  assert.equal(scene.outcome, "escape");
  assert.equal(scene.actionPhase, "magickEffect");
  assert.equal(caster.mp, mpBefore - retreat.mpCost);
  assert.equal(finishedOutcome(), null);

  manager.updateActionPhase(0.25);
  assert.equal(scene.actionPhase, "magickRecover");
  assert.equal(finishedOutcome(), null);

  manager.updateActionPhase(0.25);
  assert.equal(scene.actionPhase, "magickWait");
  assert.equal(finishedOutcome(), null);

  manager.updateActionPhase(0.25);
  assert.equal(scene.actionPhase, "none");
  assert.equal(finishedOutcome(), "escape");
}

function testRetreatStillRejectsNoEscapeEncounterBeforeTargeting() {
  const { caster, scene, manager, magickWindowHidden } = createHarness();
  const messages = [];
  const mpBefore = caster.mp;

  scene.encounter.canEscape = false;
  scene.addBattleMessage = (message) => messages.push(message);
  manager.executeMagick();

  assert.equal(scene.pendingMagick, null);
  assert.equal(scene.selectingEnemyTarget, false);
  assert.equal(scene.enemyTargetAction, null);
  assert.equal(scene.battleInputLocked, false);
  assert.equal(caster.mp, mpBefore);
  assert.equal(magickWindowHidden(), false);
  assert.equal(messages.at(-1), "You cannot escape!");
}

function run() {
  testRetreatWaitsForBattlefieldConfirmation();
  testConfirmedRetreatAnimatesThenAutomaticallyLeavesBattle();
  testRetreatStillRejectsNoEscapeEncounterBeforeTargeting();
  console.log("Battle action confirmation regression tests passed.");
}

run();
