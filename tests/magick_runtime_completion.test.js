"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const readData = (filename) =>
  JSON.parse(fs.readFileSync(path.join(projectRoot, "data", filename), "utf8"));

const statuses = readData("Statuses.json");
const actors = readData("Actors.json");
const enemies = readData("Enemies.json");
const magick = readData("Magick.json");

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

  return context.__loadedClasses;
}

function makeDatabaseManager() {
  return {
    statuses,
    actors,
    enemies,
    magick,
    statusByKey(key) {
      return statuses.find((status) => status?.key === key) || null;
    },
    actor(id) {
      return actors[id] || null;
    },
    enemy(id) {
      return enemies[id] || null;
    },
    magick(id) {
      return magick[id] || null;
    },
    magickName(id) {
      return magick[id]?.name || "Unknown Magick";
    },
    weapon() {
      return null;
    },
    armor() {
      return null;
    },
  };
}

function loadCombatClasses() {
  const partyMembers = [];
  const gameParty = {
    battleMembers: () => partyMembers,
    livingBattleMembers: () => partyMembers.filter((battler) => battler.isAlive()),
    gainItem() {},
    gainGil() {},
  };

  const classes = loadClasses(
    [
      "js/objects/Game_Battler.js",
      "js/objects/Game_Actor.js",
      "js/objects/Game_Enemy.js",
      "js/battle/BattleManager.js",
    ],
    "{ Game_Battler, Game_Actor, Game_Enemy, BattleManager }",
    {
      DatabaseManager: makeDatabaseManager(),
      DebugManager: { log() {} },
      $gameParty: gameParty,
    },
  );

  return { ...classes, partyMembers, gameParty };
}

function makeBattleScene(caster, enemiesInBattle = []) {
  const messages = [];
  const popups = [];

  const scene = {
    encounter: { id: 1, name: "Magick Runtime Test", canEscape: true },
    enemies: enemiesInBattle,
    outcome: null,
    victory: false,
    defeat: false,
    result: null,
    targetGroup: "enemy",
    targetScope: "single",
    pendingMagick: null,
    pendingMagickTarget: null,
    magickEffect: null,
    magickEffectTarget: null,
    pendingEnemyTurn: false,
    enemyTurnDelay: 0,
    battleInputLocked: false,
    partyController: {
      currentBattler() {
        return caster;
      },
    },
    targetManager: {
      allowedTargetGroups(magick) {
        return Array.isArray(magick?.target) ? magick.target : [];
      },
      allowedScopes(magick) {
        return Array.isArray(magick?.scope) ? magick.scope : [];
      },
      selectableBattlers(group, magick) {
        const battlers = group === "ally" ? scene.partyMembers : enemiesInBattle;
        return battlers.filter((battler) => caster.isValidMagickTarget(magick, battler));
      },
      getCurrentTargets() {
        const battlers =
          scene.targetGroup === "ally" ? scene.partyMembers : enemiesInBattle;
        return battlers.filter((battler) => caster.isValidMagickTarget(scene.pendingMagick, battler));
      },
    },
    addBattleMessage(message) {
      messages.push(message);
    },
    addBattlePopup(target, text, type) {
      popups.push({ target, text, type });
    },
    startBattleEffect() {},
    setActorState() {},
    setEnemyState() {},
    setActionPhase(phase) {
      this.actionPhase = phase;
    },
    messages,
    popups,
    partyMembers: [],
  };

  return scene;
}

function testGravityUsesCurrentHpPercentage() {
  const { Game_Actor, Game_Enemy } = loadCombatClasses();
  const caster = new Game_Actor(1);
  const target = new Game_Enemy(1);

  caster.learnMagick(25); // Burden, 25% current HP.
  const firstHp = target.hp;

  assert.equal(caster.useMagick(25, target, false, "single", () => 0), true);
  const firstDamage = firstHp - target.hp;
  assert.equal(firstDamage, Math.floor(firstHp * magick[25].gravityPercent));

  const secondHp = target.hp;
  assert.equal(caster.useMagick(25, target, false, "single", () => 0), true);
  const secondDamage = secondHp - target.hp;
  assert.equal(secondDamage, Math.floor(secondHp * magick[25].gravityPercent));
  assert.ok(secondDamage < firstDamage);
}

function testPerfectRenewalUsesHealPercent() {
  const { Game_Actor } = loadCombatClasses();
  const caster = new Game_Actor(1);
  const ally = new Game_Actor(2);

  caster.maxMp = 500;
  caster.mp = 500;
  caster.learnMagick(52); // Perfect Renewal.
  ally.setHp(1);

  const mpBefore = caster.mp;
  const success = caster.useMagick(52, ally, true, "single", () => 0);

  assert.equal(success, true);
  assert.equal(ally.hp, ally.maxHp);
  assert.equal(caster.mp, mpBefore - magick[52].mpCost);
}

function testMeteorBarrageResolvesFourRandomHitsAndPaysOnce() {
  const { Game_Actor, Game_Enemy, BattleManager, partyMembers } =
    loadCombatClasses();
  const caster = new Game_Actor(1);
  const targets = [
    new Game_Enemy(1),
    new Game_Enemy(1),
    new Game_Enemy(1),
    new Game_Enemy(1),
  ];

  caster.maxMp = 500;
  caster.mp = 500;
  caster.learnMagick(47); // Meteor Barrage.
  partyMembers.push(caster);

  const scene = makeBattleScene(caster, targets);
  scene.partyMembers = partyMembers;
  const manager = new BattleManager(scene);
  const mpBefore = caster.mp;
  const hpBefore = targets.map((target) => target.hp);
  const rolls = [0.0, 0.26, 0.51, 0.76];
  let rollIndex = 0;
  const random = () => rolls[rollIndex++] ?? 0;

  const resolutions = manager.resolveRandomMultiHitMagick(
    caster,
    magick[47],
    random,
  );

  assert.equal(resolutions.length, 4);
  assert.deepEqual(
    Array.from(resolutions, (resolution) => targets.indexOf(resolution.target)),
    [0, 1, 2, 3],
  );
  assert.equal(caster.mp, mpBefore - magick[47].mpCost);

  for (let index = 0; index < targets.length; index++) {
    assert.ok(targets[index].hp < hpBefore[index]);
  }
}

function testRandomPerHitMagickSkipsManualTargetSelection() {
  const { Game_Actor, Game_Enemy, BattleManager, partyMembers } =
    loadCombatClasses();
  const caster = new Game_Actor(1);
  const enemy = new Game_Enemy(1);

  caster.maxMp = 500;
  caster.mp = 500;
  caster.learnMagick(47); // Meteor Barrage.
  partyMembers.push(caster);

  const scene = makeBattleScene(caster, [enemy]);
  scene.partyMembers = partyMembers;
  scene.selectingEnemyTarget = false;
  scene.enemyTargetAction = null;
  scene.actionPhase = "none";
  scene.magickWindow = {
    hidden: false,
    currentMagick() {
      return magick[47];
    },
    hide() {
      this.hidden = true;
    },
  };

  const manager = new BattleManager(scene);
  manager.executeMagick();

  assert.equal(scene.pendingMagick, magick[47]);
  assert.equal(scene.pendingMagickTarget, null);
  assert.equal(scene.selectingEnemyTarget, false);
  assert.equal(scene.enemyTargetAction, null);
  assert.equal(scene.battleInputLocked, true);
  assert.equal(scene.actionPhase, "magickCast");
  assert.equal(scene.magickWindow.hidden, true);
}

function testRetreatDeclaresEscapeAndFinalizesWithoutRewards() {
  const { Game_Actor, Game_Enemy, BattleManager, partyMembers } =
    loadCombatClasses();
  const caster = new Game_Actor(1);
  const enemy = new Game_Enemy(1);

  caster.learnMagick(43); // Retreat.
  partyMembers.push(caster);

  const scene = makeBattleScene(caster, [enemy]);
  scene.partyMembers = partyMembers;
  const manager = new BattleManager(scene);
  const mpBefore = caster.mp;

  assert.equal(manager.performEscapeMagick(caster, magick[43]), true);
  assert.equal(scene.outcome, BattleManager.OUTCOME_ESCAPE);
  assert.equal(caster.mp, mpBefore - magick[43].mpCost);
  assert.ok(scene.messages.some((message) => message.includes("party escapes")));

  const result = manager.finalizeBattle();
  assert.equal(result.outcome, BattleManager.OUTCOME_ESCAPE);
  assert.deepEqual(
    JSON.parse(JSON.stringify(result.rewards)),
    { exp: 0, currency: 0, drops: [], resonance: 0 },
  );
}

function testBanishUsesDeathBridgeAndPreservesRewardReason() {
  const { Game_Actor, Game_Enemy, BattleManager, partyMembers } =
    loadCombatClasses();
  const caster = new Game_Actor(1);
  const target = new Game_Enemy(1);

  caster.maxMp = 200;
  caster.mp = 200;
  caster.learnMagick(44); // Banish.
  partyMembers.push(caster);

  const scene = makeBattleScene(caster, [target]);
  scene.partyMembers = partyMembers;
  const manager = new BattleManager(scene);
  const mpBefore = caster.mp;

  const resolution = manager.resolveMagickEffectOnTarget(
    caster,
    magick[44],
    target,
    true,
    "single",
    () => 0,
  );

  assert.equal(resolution.success, true);
  assert.equal(target.isBanished(), true);
  assert.equal(target.hasStatus("death"), true);
  assert.equal(target.isDead(), true);
  assert.equal(target.isDefeated(), true);
  assert.equal(target.canBeRevived(), false);
  assert.equal(caster.mp, mpBefore - magick[44].mpCost);
  assert.ok(scene.popups.some((popup) => popup.text === "BANISHED"));

  manager.declareBattleOutcome(BattleManager.OUTCOME_VICTORY);
  const result = manager.finalizeBattle();

  assert.equal(result.defeatedEnemies.length, 1);
  assert.equal(result.defeatedEnemies[0].banished, true);
  assert.equal(result.rewards.exp, target.expReward);
}

function run() {
  testGravityUsesCurrentHpPercentage();
  testPerfectRenewalUsesHealPercent();
  testMeteorBarrageResolvesFourRandomHitsAndPaysOnce();
  testRandomPerHitMagickSkipsManualTargetSelection();
  testRetreatDeclaresEscapeAndFinalizesWithoutRewards();
  testBanishUsesDeathBridgeAndPreservesRewardReason();

  console.log("Magick runtime completion regression tests passed.");
}

run();
