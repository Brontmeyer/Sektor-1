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
  return loadClasses(
    [
      "js/objects/Game_Battler.js",
      "js/objects/Game_Actor.js",
      "js/objects/Game_Enemy.js",
      "js/objects/Game_Party.js",
    ],
    "{ Game_Battler, Game_Actor, Game_Enemy, Game_Party }",
    {
      DatabaseManager: makeDatabaseManager(),
      DebugManager: { log() {} },
      console: { log() {}, warn() {}, error() {} },
    },
  );
}

function testPetrifyCountsAsDefeatedWithoutForcingHpToZero() {
  const { Game_Actor } = loadCombatClasses();
  const actor = new Game_Actor(1);
  const hpBefore = actor.hp;

  actor.addStatus("petrify");

  assert.equal(actor.hp, hpBefore);
  assert.equal(actor.isDead(), false);
  assert.equal(actor.isDefeated(), true);
  assert.equal(actor.isAlive(), false);
  assert.equal(actor.canAct(), false);
  assert.equal(actor.canBeRevived(), false);
}

function testOrdinaryKoAndDeathCanBeRevived() {
  const { Game_Actor } = loadCombatClasses();
  const caster = new Game_Actor(1);
  const target = new Game_Actor(2);

  caster.maxMp = 500;
  caster.mp = 500;
  caster.learnMagick(7); // Rekindle
  caster.learnMagick(8); // Reawakening

  target.setHp(0);
  assert.equal(target.canBeRevived(), true);

  const mpBeforeRekindle = caster.mp;
  assert.equal(caster.useMagick(7, target), true);
  assert.equal(target.hp, Math.max(1, Math.floor(target.maxHp * 0.25)));
  assert.equal(target.isDefeated(), false);
  assert.equal(caster.mp, mpBeforeRekindle - magick[7].mpCost);

  target.addStatus("death");
  assert.equal(target.hp, 0);
  assert.equal(target.hasStatus("death"), true);
  assert.equal(target.canBeRevived(), true);

  const mpBeforeReawakening = caster.mp;
  assert.equal(caster.useMagick(8, target), true);
  assert.equal(target.hp, target.maxHp);
  assert.equal(target.hasStatus("death"), false);
  assert.equal(target.isDefeated(), false);
  assert.equal(caster.mp, mpBeforeReawakening - magick[8].mpCost);
}

function testPetrifyRequiresCleansingInsteadOfRevival() {
  const { Game_Actor } = loadCombatClasses();
  const caster = new Game_Actor(1);
  const target = new Game_Actor(2);

  caster.maxMp = 500;
  caster.mp = 500;
  caster.learnMagick(5); // Soul Cleanse
  caster.learnMagick(7); // Rekindle
  target.addStatus("petrify");

  const mpBeforeFailedRevive = caster.mp;
  assert.equal(caster.useMagick(7, target), false);
  assert.equal(caster.mp, mpBeforeFailedRevive);
  assert.equal(target.hasStatus("petrify"), true);
  assert.equal(target.isDefeated(), true);

  assert.equal(caster.isValidMagickTarget(magick[5], target), true);
  assert.equal(caster.useMagick(5, target, true, "single", () => 0), true);
  assert.equal(target.hasStatus("petrify"), false);
  assert.equal(target.isDefeated(), false);
}

function testNormalHealingCannotTargetDefeatedBattlers() {
  const { Game_Actor } = loadCombatClasses();
  const caster = new Game_Actor(1);
  const target = new Game_Actor(2);

  caster.learnMagick(1); // Mend
  target.setHp(0);

  assert.equal(caster.isValidMagickTarget(magick[1], target), false);
  assert.equal(caster.useMagick(1, target), false);
}

function testPartyLivingMembersExcludePetrifiedActors() {
  const { Game_Actor, Game_Party } = loadCombatClasses();
  const first = new Game_Actor(1);
  const second = new Game_Actor(2);
  const party = new Game_Party([first, second]);

  second.addStatus("petrify");

  assert.deepEqual(
    Array.from(party.livingBattleMembers(), (actor) => actor.actorId),
    [first.actorId],
  );
}

function testBattleTargetManagerUnderstandsReviveAndPetrifyCleansing() {
  const { Game_Actor, Game_Party } = loadCombatClasses();
  const caster = new Game_Actor(1);
  const livingAlly = new Game_Actor(2);
  const koAlly = new Game_Actor(3);
  const petrifiedAlly = new Game_Actor(4);
  const party = new Game_Party([caster, livingAlly, koAlly, petrifiedAlly]);

  koAlly.setHp(0);
  petrifiedAlly.addStatus("petrify");

  const scene = {
    enemies: [],
    selectedAllyIndex: 0,
    selectedEnemyIndex: 0,
    pendingMagick: magick[7],
    partyController: {
      currentBattler() {
        return caster;
      },
    },
    getAllyPosition(actor) {
      return { x: actor.actorId * 100, y: 100 };
    },
    getEnemyPosition() {
      return { x: 900, y: 100 };
    },
  };

  const { BattleTargetManager } = loadClasses(
    ["js/battle/BattleTargetManager.js"],
    "{ BattleTargetManager }",
    { $gameParty: party },
  );
  const manager = new BattleTargetManager(scene);

  assert.equal(manager.isSelectableTarget(livingAlly, magick[7]), false);
  assert.equal(manager.isSelectableTarget(koAlly, magick[7]), true);
  assert.equal(manager.isSelectableTarget(petrifiedAlly, magick[7]), false);
  assert.equal(manager.selectFirstSelectableAlly(magick[7]), koAlly);

  assert.equal(manager.isSelectableTarget(petrifiedAlly, magick[5]), true);
  assert.equal(manager.isSelectableTarget(petrifiedAlly, magick[1]), false);
}

function testPetrifyAppliedByMagickDeclaresVictoryWithoutHpZero() {
  const { Game_Actor, Game_Enemy, Game_Party } = loadCombatClasses();
  const caster = new Game_Actor(1);
  const enemy = new Game_Enemy(1);
  const party = new Game_Party([caster]);

  enemy.maxHp = 10000;
  enemy.setHp(enemy.maxHp);
  caster.maxMp = 500;
  caster.mp = 500;
  caster.learnMagick(49); // Stone Prison

  let enemyState = null;
  const scene = {
    encounter: { id: 1, name: "Stone Test" },
    enemies: [enemy],
    outcome: null,
    victory: false,
    defeat: false,
    pendingEnemyTurn: false,
    enemyTurnDelay: 0,
    battleInputLocked: false,
    partyController: {
      currentBattler() {
        return caster;
      },
    },
    addBattleMessage() {},
    addBattlePopup() {},
    setActorState() {},
    setEnemyState(state) {
      enemyState = state;
    },
  };

  const { BattleManager } = loadClasses(
    ["js/battle/BattleEnemyAI.js", "js/battle/BattleManager.js"],
    "{ BattleManager }",
    {
      $gameParty: party,
      DebugManager: { log() {} },
    },
  );
  const manager = new BattleManager(scene);

  const result = manager.resolveMagickEffectOnTarget(
    caster,
    magick[49],
    enemy,
    true,
    "single",
    () => 0,
  );

  assert.equal(result.success, true);
  assert.equal(enemy.hasStatus("petrify"), true);
  assert.equal(enemy.isDead(), false);
  assert.equal(enemy.isDefeated(), true);
  assert.equal(enemyState, "defeat");
  assert.equal(scene.outcome, BattleManager.OUTCOME_VICTORY);
}

function testReflectedRevivalUsesARevivableOpposingTarget() {
  const { Game_Actor, Game_Enemy, Game_Party } = loadCombatClasses();
  const caster = new Game_Actor(1);
  const ally = new Game_Actor(2);
  const defeatedEnemy = new Game_Enemy(1);
  const livingEnemy = new Game_Enemy(1);
  const party = new Game_Party([caster, ally]);

  caster.maxMp = 500;
  caster.mp = 500;
  caster.learnMagick(7); // Rekindle
  ally.addStatus("reflect");
  ally.setHp(0);
  defeatedEnemy.setHp(0);

  const scene = {
    enemies: [defeatedEnemy, livingEnemy],
    outcome: null,
    victory: false,
    defeat: false,
    pendingEnemyTurn: false,
    enemyTurnDelay: 0,
    battleInputLocked: false,
    partyController: {
      currentBattler() {
        return caster;
      },
    },
    addBattleMessage() {},
    addBattlePopup() {},
    setActorState() {},
    setEnemyState() {},
  };

  const { BattleManager } = loadClasses(
    ["js/battle/BattleEnemyAI.js", "js/battle/BattleManager.js"],
    "{ BattleManager }",
    {
      $gameParty: party,
      DebugManager: { log() {} },
    },
  );
  const manager = new BattleManager(scene);
  const mpBefore = caster.mp;

  const result = manager.resolveMagickEffectOnTarget(
    caster,
    magick[7],
    ally,
    true,
    "single",
    () => 0,
  );

  assert.equal(result.success, true);
  assert.equal(result.reflected, true);
  assert.equal(result.target, defeatedEnemy);
  assert.equal(ally.isDefeated(), true);
  assert.equal(defeatedEnemy.isDefeated(), false);
  assert.equal(
    defeatedEnemy.hp,
    Math.max(1, Math.floor(defeatedEnemy.maxHp * magick[7].revivePercent)),
  );
  assert.equal(caster.mp, mpBefore - magick[7].mpCost);
}

function testBattleOutcomeAndRewardsTreatPetrifyAsDefeat() {
  const { Game_Actor, Game_Enemy, Game_Party } = loadCombatClasses();
  const actor = new Game_Actor(1);
  const enemy = new Game_Enemy(1);
  const party = new Game_Party([actor]);

  enemy.addStatus("petrify");

  const messages = [];
  const scene = {
    encounter: { id: 1, name: "Petrify Test" },
    enemies: [enemy],
    partyController: {},
    outcome: null,
    victory: false,
    defeat: false,
    pendingEnemyTurn: false,
    enemyTurnDelay: 0,
    battleInputLocked: false,
    addBattleMessage(message) {
      messages.push(message);
    },
  };

  const { BattleManager } = loadClasses(
    ["js/battle/BattleEnemyAI.js", "js/battle/BattleManager.js"],
    "{ BattleManager }",
    {
      $gameParty: party,
      DebugManager: { log() {} },
    },
  );
  const manager = new BattleManager(scene);
  manager.rewardRandom = () => 1;

  assert.equal(manager.detectBattleOutcome(), BattleManager.OUTCOME_VICTORY);

  const expBefore = actor.exp;
  const result = manager.finalizeBattle(BattleManager.OUTCOME_VICTORY);

  assert.equal(result.outcome, BattleManager.OUTCOME_VICTORY);
  assert.equal(result.defeatedEnemies.length, 1);
  assert.equal(result.defeatedEnemies[0].enemyId, enemy.enemyId);
  assert.equal(result.rewards.exp, enemy.expReward);
  assert.equal(actor.exp, expBefore + enemy.expReward);

  const petrifiedPartyActor = new Game_Actor(2);
  const defeatedParty = new Game_Party([petrifiedPartyActor]);
  petrifiedPartyActor.addStatus("petrify");
  const defeatScene = {
    ...scene,
    enemies: [new Game_Enemy(1)],
    outcome: null,
    victory: false,
    defeat: false,
    addBattleMessage() {},
  };
  const { BattleManager: DefeatBattleManager } = loadClasses(
    ["js/battle/BattleEnemyAI.js", "js/battle/BattleManager.js"],
    "{ BattleManager }",
    {
      $gameParty: defeatedParty,
      DebugManager: { log() {} },
    },
  );
  const defeatManager = new DefeatBattleManager(defeatScene);

  assert.equal(
    defeatManager.detectBattleOutcome(),
    DefeatBattleManager.OUTCOME_DEFEAT,
  );
}

function testDefeatAndRevivalMetadataValidation() {
  const { DatabaseValidator } = loadClasses(
    ["js/core/DatabaseValidator.js"],
    "{ DatabaseValidator }",
    { DebugManager: { log() {} } },
  );

  const validMagickErrors = [];
  const validStatusErrors = [];
  DatabaseValidator.validateMagick(magick, validMagickErrors);
  DatabaseValidator.validateStatuses(statuses, validStatusErrors);
  assert.deepEqual(Array.from(validMagickErrors), []);
  assert.deepEqual(Array.from(validStatusErrors), []);

  const invalidMagick = JSON.parse(JSON.stringify(magick));
  invalidMagick[7].revivePercent = 0;
  invalidMagick[8].effect = "resurrectMaybe";
  const invalidMagickErrors = [];
  DatabaseValidator.validateMagick(invalidMagick, invalidMagickErrors);

  assert.equal(
    invalidMagickErrors.some((error) => error.includes("revivePercent")),
    true,
  );
  assert.equal(
    invalidMagickErrors.some((error) => error.includes("unsupported effect")),
    true,
  );

  const invalidStatuses = JSON.parse(JSON.stringify(statuses));
  invalidStatuses[13].effects.countsAsDefeated = "yes";
  invalidStatuses[14].effects.countsAsDefeated = false;
  const invalidStatusErrors = [];
  DatabaseValidator.validateStatuses(invalidStatuses, invalidStatusErrors);

  assert.equal(
    invalidStatusErrors.some((error) => error.includes("countsAsDefeated")),
    true,
  );
  assert.equal(
    invalidStatusErrors.some((error) => error.includes("canBeRevived")),
    true,
  );
}

testPetrifyCountsAsDefeatedWithoutForcingHpToZero();
testOrdinaryKoAndDeathCanBeRevived();
testPetrifyRequiresCleansingInsteadOfRevival();
testNormalHealingCannotTargetDefeatedBattlers();
testPartyLivingMembersExcludePetrifiedActors();
testBattleTargetManagerUnderstandsReviveAndPetrifyCleansing();
testPetrifyAppliedByMagickDeclaresVictoryWithoutHpZero();
testReflectedRevivalUsesARevivableOpposingTarget();
testBattleOutcomeAndRewardsTreatPetrifyAsDefeat();
testDefeatAndRevivalMetadataValidation();

console.log("Defeat and revival regression tests passed.");
