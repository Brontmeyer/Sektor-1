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

function makeDeterministicMath(randomValue = 0) {
  const deterministicMath = Object.create(Math);
  deterministicMath.random = () => randomValue;
  return deterministicMath;
}

function loadCombatClasses(randomValue = 0) {
  const partyMembers = [];
  const gameParty = {
    battleMembers: () => partyMembers,
    livingBattleMembers: () => partyMembers.filter((battler) => battler.isAlive()),
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
      Math: makeDeterministicMath(randomValue),
    },
  );

  return { ...classes, partyMembers, gameParty };
}

function makeBattleScene(caster, enemiesInBattle = []) {
  const messages = [];
  const popups = [];
  const effects = [];

  return {
    enemies: enemiesInBattle,
    outcome: null,
    targetScope: "single",
    pendingMagick: null,
    pendingMagickTarget: null,
    magickEffect: null,
    magickEffectTarget: null,
    partyController: {
      currentBattler() {
        return caster;
      },
    },
    targetManager: {
      getCurrentTargets() {
        return enemiesInBattle.filter((enemy) => enemy.isAlive());
      },
    },
    addBattleMessage(message) {
      messages.push(message);
    },
    addBattlePopup(target, text, type) {
      popups.push({ target, text, type });
    },
    startBattleEffect(type, target, duration) {
      effects.push({ type, target, duration });
    },
    setActorState() {},
    setEnemyState() {},
    setActionPhase() {},
    messages,
    popups,
    effects,
  };
}

function testReflectStatusExposesReusableRuntimeProperties() {
  const { Game_Enemy } = loadCombatClasses();
  const target = new Game_Enemy(1);

  assert.equal(target.reflectsMagick(), false);
  assert.equal(target.maxMagickReflections(), 0);

  target.addStatus("reflect");

  assert.equal(target.reflectsMagick(), true);
  assert.equal(target.maxMagickReflections(), 1);
}

function testReflectableDamageRedirectsAndChargesMpOnce() {
  const { Game_Actor, Game_Enemy, BattleManager, partyMembers } =
    loadCombatClasses();
  const caster = new Game_Actor(1);
  const ally = new Game_Actor(2);
  const target = new Game_Enemy(1);

  partyMembers.push(caster, ally);
  target.addStatus("reflect");
  caster.learnMagick(10); // Ember

  const scene = makeBattleScene(caster, [target]);
  const manager = new BattleManager(scene);
  const casterHpBefore = caster.hp;
  const targetHpBefore = target.hp;
  const mpBefore = caster.mp;

  const result = manager.resolveMagickEffectOnTarget(
    caster,
    magick[10],
    target,
    true,
    "single",
    () => 0,
  );

  assert.equal(result.success, true);
  assert.equal(result.reflected, true);
  assert.equal(result.reflections.length, 1);
  assert.equal(result.target, caster);
  assert.equal(target.hp, targetHpBefore);
  assert.ok(caster.hp < casterHpBefore);
  assert.equal(caster.mp, mpBefore - magick[10].mpCost);
  assert.ok(scene.messages.some((message) => message.includes("Reflect redirects")));
  assert.ok(scene.popups.some((popup) => popup.text === "REFLECT"));
}

function testReflectedAllyOnlyStatusCanLandOnEnemy() {
  const { Game_Actor, Game_Enemy, BattleManager, partyMembers } =
    loadCombatClasses();
  const caster = new Game_Actor(1);
  const ally = new Game_Actor(2);
  const enemy = new Game_Enemy(1);

  partyMembers.push(caster, ally);
  ally.addStatus("reflect");
  enemy.addStatus("reflect");
  caster.learnMagick(34); // Quickening, normally ally-only.

  const scene = makeBattleScene(caster, [enemy]);
  const manager = new BattleManager(scene);
  const mpBefore = caster.mp;

  const result = manager.resolveMagickEffectOnTarget(
    caster,
    magick[34],
    ally,
    true,
    "single",
    () => 0,
  );

  assert.equal(result.success, true);
  assert.equal(result.reflected, true);
  assert.equal(result.reflections.length, 1);
  assert.equal(result.target, enemy);
  assert.equal(ally.hasStatus("haste"), false);
  assert.equal(enemy.hasStatus("haste"), true);
  assert.equal(caster.mp, mpBefore - magick[34].mpCost);
}

function testNonReflectableMagickIgnoresReflect() {
  const { Game_Actor, BattleManager, partyMembers } = loadCombatClasses();
  const caster = new Game_Actor(1);
  const ally = new Game_Actor(2);

  partyMembers.push(caster, ally);
  ally.addStatus("reflect");
  caster.learnMagick(39); // Mirror Ward explicitly cannot be reflected.

  const scene = makeBattleScene(caster, []);
  const manager = new BattleManager(scene);
  const reflection = manager.resolveMagickReflection(magick[39], ally, () => 0);

  assert.equal(reflection.reflected, false);
  assert.equal(reflection.target, ally);
  assert.equal(reflection.reflections.length, 0);
}

function testAllTargetReflectionIsPerTargetAndPaysOneMpCost() {
  const { Game_Actor, Game_Enemy, BattleManager, partyMembers } =
    loadCombatClasses(0);
  const caster = new Game_Actor(1);
  const ally = new Game_Actor(2);
  const reflectedEnemy = new Game_Enemy(1);
  const directEnemy = new Game_Enemy(1);

  partyMembers.push(caster, ally);
  reflectedEnemy.addStatus("reflect");
  caster.learnMagick(10); // Ember supports all-target scope.

  const scene = makeBattleScene(caster, [reflectedEnemy, directEnemy]);
  scene.targetScope = "all";
  scene.pendingMagick = magick[10];
  scene.targetManager.getCurrentTargets = () => [reflectedEnemy, directEnemy];

  const manager = new BattleManager(scene);
  const casterHpBefore = caster.hp;
  const reflectedHpBefore = reflectedEnemy.hp;
  const directHpBefore = directEnemy.hp;
  const mpBefore = caster.mp;

  manager.performMagickEffect();

  assert.equal(reflectedEnemy.hp, reflectedHpBefore);
  assert.ok(directEnemy.hp < directHpBefore);
  assert.ok(caster.hp < casterHpBefore);
  assert.equal(caster.mp, mpBefore - magick[10].mpCost);
  assert.equal(scene.pendingMagick, null);
  assert.equal(scene.pendingMagickTarget, null);
  assert.equal(
    scene.messages.filter((message) => message.includes("Reflect redirects")).length,
    1,
  );
}

function testReflectedHealingStillConsumesTheOriginalCast() {
  const { Game_Actor, Game_Enemy, BattleManager, partyMembers } =
    loadCombatClasses();
  const caster = new Game_Actor(1);
  const ally = new Game_Actor(2);
  const enemy = new Game_Enemy(1);

  partyMembers.push(caster, ally);
  ally.setHp(Math.floor(ally.maxHp / 2));
  ally.addStatus("reflect");
  caster.learnMagick(1); // Mend

  const scene = makeBattleScene(caster, [enemy]);
  const manager = new BattleManager(scene);
  const allyHpBefore = ally.hp;
  const enemyHpBefore = enemy.hp;
  const mpBefore = caster.mp;

  const result = manager.resolveMagickEffectOnTarget(
    caster,
    magick[1],
    ally,
    true,
    "single",
    () => 0,
  );

  assert.equal(result.success, true);
  assert.equal(result.target, enemy);
  assert.equal(ally.hp, allyHpBefore);
  assert.equal(enemy.hp, enemyHpBefore);
  assert.equal(caster.mp, mpBefore - magick[1].mpCost);
}

function testReflectionMetadataValidation() {
  const { DatabaseValidator } = loadClasses(
    ["js/core/DatabaseValidator.js"],
    "{ DatabaseValidator }",
  );

  const magickErrors = [];
  const statusErrors = [];

  DatabaseValidator.validateMagick(magick, magickErrors);
  DatabaseValidator.validateStatuses(statuses, statusErrors);

  assert.deepEqual(Array.from(magickErrors), []);
  assert.deepEqual(Array.from(statusErrors), []);

  const invalidMagick = [
    null,
    {
      id: 1,
      name: "Broken Reflection Magick",
      target: ["enemy"],
      scope: ["single"],
      mpCost: 0,
      status: {},
    },
  ];
  const invalidMagickErrors = [];

  DatabaseValidator.validateMagick(invalidMagick, invalidMagickErrors);
  assert.ok(
    invalidMagickErrors.some((error) => error.includes("reflectable must be true or false")),
  );

  const invalidStatuses = [
    null,
    {
      id: 1,
      key: "brokenReflect",
      name: "Broken Reflect",
      classification: {
        family: "defensive",
        negative: false,
        removable: true,
        persistsAfterBattle: false,
      },
      duration: { type: "turns", turns: 1 },
      effects: { reflectableMagick: true, perTarget: true },
    },
  ];
  const invalidStatusErrors = [];

  DatabaseValidator.validateStatuses(invalidStatuses, invalidStatusErrors);
  assert.ok(
    invalidStatusErrors.some((error) => error.includes("maxReflections")),
  );
}

testReflectStatusExposesReusableRuntimeProperties();
testReflectableDamageRedirectsAndChargesMpOnce();
testReflectedAllyOnlyStatusCanLandOnEnemy();
testNonReflectableMagickIgnoresReflect();
testAllTargetReflectionIsPerTargetAndPaysOneMpCost();
testReflectedHealingStillConsumesTheOriginalCast();
testReflectionMetadataValidation();

console.log("Reflect runtime regression tests passed.");
