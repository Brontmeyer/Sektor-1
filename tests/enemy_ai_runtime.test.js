"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const readData = (filename) =>
  JSON.parse(fs.readFileSync(path.join(projectRoot, "data", filename), "utf8"));
const clone = (value) => JSON.parse(JSON.stringify(value));

const actors = readData("Actors.json");
const enemies = readData("Enemies.json");
const items = readData("Items.json");
const magick = readData("Magick.json");
const skills = readData("Skills.json");
const statuses = readData("Statuses.json");

function createFixture({ partyCount = 2, enemyCount = 2 } = {}) {
  const DatabaseManager = {
    actors,
    enemies,
    magickData: magick,
    skills,
    statuses,
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
      return magick[id]?.name || `Unknown Magick ${id}`;
    },
    skill(id) {
      return skills[id] || null;
    },
    skillName(id) {
      return skills[id]?.name || `Unknown Skill ${id}`;
    },
    statusByKey(key) {
      return statuses.find((status) => status?.key === key) || null;
    },
  };

  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    DatabaseManager,
    DebugManager: { log() {} },
  });
  const source = [
    "js/objects/Game_Battler.js",
    "js/objects/Game_Actor.js",
    "js/objects/Game_Enemy.js",
    "js/battle/BattleEnemyAI.js",
    "js/battle/BattleManager.js",
  ]
    .map((relativePath) =>
      fs.readFileSync(path.join(projectRoot, relativePath), "utf8"),
    )
    .join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__classes = { Game_Actor, Game_Enemy, BattleEnemyAI, BattleManager };`,
    context,
  );

  const { Game_Actor, Game_Enemy, BattleManager } = context.__classes;
  const party = Array.from({ length: partyCount }, (_, index) => {
    const actor = new Game_Actor(Math.min(index + 1, actors.length - 1));
    actor.name = `Actor ${index + 1}`;
    return actor;
  });
  const battleEnemies = Array.from({ length: enemyCount }, (_, index) => {
    const enemy = new Game_Enemy(1);
    enemy.name = `Enemy ${index + 1}`;
    return enemy;
  });

  context.$gameParty = {
    battleMembers() {
      return party;
    },
    livingBattleMembers() {
      return party.filter((actor) => !actor.isDefeated());
    },
  };

  const messages = [];
  const popups = [];
  const effects = [];
  const scene = {
    enemies: battleEnemies,
    enemyTurnIndex: 0,
    pendingEnemyTurn: false,
    enemyTurnDelay: 0,
    outcome: null,
    victory: false,
    defeat: false,
    battleInputLocked: false,
    partyController: {
      currentBattler() {
        return party[0] || null;
      },
    },
    addBattleMessage(message) {
      messages.push(message);
    },
    addBattlePopup(target, text, type) {
      popups.push({ target, text, type });
    },
    setEnemyState() {},
    setActorState() {},
    startBattleEffect(type, target, duration) {
      effects.push({ type, target, duration });
    },
  };

  const manager = new BattleManager(scene);
  manager.completeEnemyTurn = () => true;

  return {
    context,
    DatabaseManager,
    party,
    enemies: battleEnemies,
    scene,
    manager,
    messages,
    popups,
    effects,
  };
}

function testEnemyLoadsDataDrivenActionsAndSharedMagickRuntime() {
  const fixture = createFixture();
  const enemy = fixture.enemies[0];
  const actor = fixture.party[0];

  assert.equal(enemy.actionDefinitions().length, 4);
  assert.equal(enemy.knowsMagick(10), true);
  assert.equal(enemy.knowsMagick(1), true);
  assert.equal(enemy.knowsMagick(13), false);
  assert.equal(enemy.knowsSkill(5), true);
  assert.equal(enemy.knowsSkill(1), false);
  assert.equal(enemy.canUseMagick(10), true);
  assert.equal(enemy.canUseSkill(5), true);
  assert.equal(enemy.isValidMagickTarget(magick[10], actor), true);
}

function testWeightedSelectionAndHpCondition() {
  const fixture = createFixture();
  const enemy = fixture.enemies[0];

  assert.equal(fixture.manager.enemyAI.selectAction(enemy, () => 0).type, "attack");
  assert.equal(
    fixture.manager.enemyAI.selectAction(enemy, () => 0.6).skillId,
    5,
  );
  assert.equal(
    fixture.manager.enemyAI.selectAction(enemy, () => 0.8).magickId,
    10,
  );

  enemy.setHp(Math.floor(enemy.maxHp * 0.4));
  assert.equal(
    fixture.manager.enemyAI.selectAction(enemy, () => 0.8).magickId,
    1,
  );
}

function testEnemyCastsDamageMagickAndPaysMp() {
  const fixture = createFixture({ partyCount: 1, enemyCount: 1 });
  const enemy = fixture.enemies[0];
  const target = fixture.party[0];
  const hpBefore = target.hp;
  const mpBefore = enemy.mp;

  fixture.manager.performEnemyTurn(enemy, () => 0.8);

  assert.ok(target.hp < hpBefore);
  assert.equal(enemy.mp, mpBefore - magick[10].mpCost);
  assert.equal(
    fixture.messages.some((message) => message.includes("casts Ember")),
    true,
  );
}

function testEnemyHealingTargetsLowestHpAlly() {
  const fixture = createFixture({ partyCount: 1, enemyCount: 2 });
  const caster = fixture.enemies[0];
  const ally = fixture.enemies[1];

  caster.setHp(Math.floor(caster.maxHp * 0.4));
  ally.setHp(20);
  const hpBefore = ally.hp;
  const mpBefore = caster.mp;

  fixture.manager.performEnemyTurn(caster, () => 0.8);

  assert.ok(ally.hp > hpBefore);
  assert.equal(caster.mp, mpBefore - magick[1].mpCost);
  assert.equal(
    fixture.messages.some((message) => message.includes("casts Mend")),
    true,
  );
}

function testUnusableConfiguredMagickFallsBackToAttack() {
  const fixture = createFixture({ partyCount: 1, enemyCount: 1 });
  const enemy = fixture.enemies[0];

  enemy.actions = [
    {
      type: "magick",
      magickId: 10,
      weight: 1,
      targetGroup: "enemy",
      targetStrategy: "first",
      scope: "single",
      condition: null,
    },
  ];
  enemy.mp = 0;

  const action = fixture.manager.enemyAI.selectAction(enemy, () => 0.5);
  assert.equal(action.type, "attack");
  assert.equal(action.fallback, true);
}

function testConfusionOverridesNormalEnemyTargetStrategy() {
  const fixture = createFixture({ partyCount: 1, enemyCount: 2 });
  const enemy = fixture.enemies[0];

  enemy.addStatus("confuse");
  const action = fixture.manager.enemyAI.selectAction(enemy, () => 0.2);
  assert.equal(action.type, "attack");

  const target = fixture.manager.enemyAI.selectTarget(enemy, action, () => 0.6);
  assert.equal(target, enemy);
}

function testEnemyActionSchemaValidation() {
  const validatorSource = fs.readFileSync(
    path.join(projectRoot, "js/core/DatabaseValidator.js"),
    "utf8",
  );
  const context = vm.createContext({ console, DebugManager: { log() {} } });
  vm.runInContext(
    `${validatorSource}\nglobalThis.__DatabaseValidator = DatabaseValidator;`,
    context,
  );

  const invalidEnemies = clone(enemies);
  invalidEnemies[1].actions[0].weight = 0;
  invalidEnemies[1].actions[2].magickId = 999;
  invalidEnemies[1].actions[3].condition.value = 2;
  const errors = [];

  invalidEnemies[1].actions[1].skillId = 999;
  invalidEnemies[1].actions.push({
    type: "skill",
    skillId: 1,
    weight: 1,
    targetGroup: "enemy",
    targetStrategy: "first",
    scope: "single",
  });

  context.__DatabaseValidator.validateEnemies(
    invalidEnemies,
    items,
    errors,
    magick,
    skills,
  );

  assert.equal(errors.some((error) => error.includes("actions[0].weight")), true);
  assert.equal(errors.some((error) => error.includes("valid Skill")), true);
  assert.equal(errors.some((error) => error.includes("valid Magick")), true);
  assert.equal(errors.filter((error) => error.includes("valid Skill")).length >= 2, true);
  assert.equal(
    errors.some((error) => error.includes("condition.value")),
    true,
  );
}

function run() {
  testEnemyLoadsDataDrivenActionsAndSharedMagickRuntime();
  testWeightedSelectionAndHpCondition();
  testEnemyCastsDamageMagickAndPaysMp();
  testEnemyHealingTargetsLowestHpAlly();
  testUnusableConfiguredMagickFallsBackToAttack();
  testConfusionOverridesNormalEnemyTargetStrategy();
  testEnemyActionSchemaValidation();

  console.log("Enemy AI runtime regression tests passed.");
}

run();
