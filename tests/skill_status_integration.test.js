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
const skills = readData("Skills.json");

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
    skills,
    statusByKey(key) {
      return statuses.find((status) => status?.key === key) || null;
    },
    actor(id) {
      return actors[id] || null;
    },
    enemy(id) {
      return enemies[id] || null;
    },
    skill(id) {
      return skills[id] || null;
    },
    skillName(id) {
      return skills[id]?.name || "Unknown Skill";
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
    ],
    "{ Game_Battler, Game_Actor, Game_Enemy }",
    {
      DatabaseManager: makeDatabaseManager(),
      DebugManager: { log() {} },
    },
  );
}

function testPureStatusSkillUsesRuntimeAndMp() {
  const { Game_Actor, Game_Enemy } = loadCombatClasses();
  const caster = new Game_Actor(1);
  const target = new Game_Enemy(1);

  caster.learnSkill(28); // Dreambind
  const mpBefore = caster.mp;

  const success = caster.useSkill(28, target, true, "single", () => 0);

  assert.equal(success, true);
  assert.equal(caster.mp, mpBefore - skills[28].mpCost);
  assert.equal(target.hasStatus("sleep"), true);
  assert.equal(caster.skillStatusResults()[0].reason, "applied");
}

function testDamageSkillCarriesStatusPayload() {
  const { Game_Actor, Game_Enemy } = loadCombatClasses();
  const caster = new Game_Actor(1);
  const target = new Game_Enemy(1);

  caster.learnSkill(22); // Venom
  const hpBefore = target.hp;

  const success = caster.useSkill(22, target, true, "single", () => 0);

  assert.equal(success, true);
  assert.ok(target.hp < hpBefore);
  assert.equal(target.hasStatus("poison"), true);
  assert.equal(caster.skillStatusResults()[0].key, "poison");
}

function testStatusResistanceStillAppliesToSkillPayloads() {
  const { Game_Actor, Game_Enemy } = loadCombatClasses();
  const caster = new Game_Actor(1);
  const target = new Game_Enemy(1);

  caster.learnSkill(22); // Venom
  target.statusRates.poison = 0;

  const success = caster.useSkill(22, target, true, "single", () => 0);
  const result = caster.skillStatusResults()[0];

  assert.equal(success, true);
  assert.equal(target.hasStatus("poison"), false);
  assert.equal(result.reason, "immune");
}

function testAllyStatusChanceAndToggleBehavior() {
  const { Game_Actor, Game_Enemy } = loadCombatClasses();
  const caster = new Game_Actor(1);
  const ally = new Game_Actor(2);
  const enemy = new Game_Enemy(1);

  caster.learnSkill(31); // Diminish

  // Diminish is guaranteed on allies even with a roll above its enemy chance.
  assert.equal(caster.useSkill(31, ally, true, "single", () => 0.99), true);
  assert.equal(ally.hasStatus("small"), true);
  assert.equal(caster.skillStatusResults()[0].chance, 1);

  // Recasting the toggle on an afflicted ally cures the same status.
  assert.equal(caster.useSkill(31, ally, true, "single", () => 0.99), true);
  assert.equal(ally.hasStatus("small"), false);
  assert.equal(caster.skillStatusResults()[0].reason, "removed");

  // The enemy path keeps the skill's normal 72% base chance.
  assert.equal(caster.useSkill(31, enemy, false, "single", () => 0.8), true);
  assert.equal(enemy.hasStatus("small"), false);
  assert.equal(caster.skillStatusResults()[0].chance, 0.72);
}

function testStatusRemovalUsesCanonicalRuntimeKeys() {
  const { Game_Actor } = loadCombatClasses();
  const caster = new Game_Actor(1);
  const ally = new Game_Actor(2);

  caster.learnSkill(5); // Soul Cleanse
  ally.addStatus("poison");
  ally.addStatus("slowNumb");

  assert.equal(ally.hasStatus("poison"), true);
  assert.equal(ally.hasStatus("slowNumb"), true);

  const success = caster.useSkill(5, ally, true, "single", () => 0);
  const removedKeys = caster
    .skillStatusResults()
    .filter((result) => result.removed)
    .map((result) => result.key);

  assert.equal(success, true);
  assert.equal(ally.hasStatus("poison"), false);
  assert.equal(ally.hasStatus("slowNumb"), false);
  assert.ok(removedKeys.includes("poison"));
  assert.ok(removedKeys.includes("slowNumb"));
  assert.equal(skills[5].status.slowNumb, 1);
  assert.equal(skills[5].status["slow-numb"], undefined);
}

function testDeathStatusSkillUsesSharedStatusEffects() {
  const { Game_Actor, Game_Enemy } = loadCombatClasses();
  const caster = new Game_Actor(1);
  const target = new Game_Enemy(1);

  caster.learnSkill(42); // Final Tol

  const success = caster.useSkill(42, target, true, "single", () => 0);

  assert.equal(success, true);
  assert.equal(target.hasStatus("death"), true);
  assert.equal(target.hp, 0);
  assert.equal(target.isDead(), true);
}

function testMultipleStatusesResolveFromOneSkill() {
  const { Game_Actor } = loadCombatClasses();
  const caster = new Game_Actor(1);
  const ally = new Game_Actor(2);

  caster.learnSkill(45); // Twin Aegis
  const success = caster.useSkill(45, ally, true, "single", () => 0);

  assert.equal(success, true);
  assert.equal(ally.hasStatus("barrier"), true);
  assert.equal(ally.hasStatus("mbarrier"), true);
  assert.deepEqual(
    Array.from(caster.skillStatusResults(), (result) => result.key).sort(),
    ["barrier", "mbarrier"],
  );
}

function testLegacyUnknownStatusReferenceFailsSafely() {
  const { Game_Actor } = loadCombatClasses();
  const caster = new Game_Actor(1);
  const ally = new Game_Actor(2);

  caster.maxMp = 200;
  caster.mp = 200;
  caster.learnSkill(6); // Unchanging Will currently references legacy Resist.

  const success = caster.useSkill(6, ally, true, "single", () => 0);
  const result = caster.skillStatusResults()[0];

  assert.equal(success, true);
  assert.equal(result.key, "resist");
  assert.equal(result.reason, "unknownStatus");
  assert.equal(ally.hasStatus("resist"), false);
}

function testLegacyUnknownRemovalReferencesFailSafely() {
  const { Game_Actor } = loadCombatClasses();
  const caster = new Game_Actor(1);
  const ally = new Game_Actor(2);

  caster.learnSkill(41); // Nulify still names legacy Death Force / Resist.
  ally.addStatus("regen");

  const success = caster.useSkill(41, ally, true, "single", () => 0);
  const results = caster.skillStatusResults();
  const regen = results.find((result) => result.key === "regen");
  const deathforce = results.find((result) => result.key === "deathforce");
  const resist = results.find((result) => result.key === "resist");

  assert.equal(success, true);
  assert.equal(regen.reason, "removed");
  assert.equal(ally.hasStatus("regen"), false);
  assert.equal(deathforce.reason, "unknownStatus");
  assert.equal(resist.reason, "unknownStatus");
}

function testSkillStatusMetadataValidation() {
  const { DatabaseValidator } = loadClasses(
    ["js/core/DatabaseValidator.js"],
    "{ DatabaseValidator }",
  );

  const validErrors = [];
  DatabaseValidator.validateSkills(skills, validErrors);
  assert.deepEqual(Array.from(validErrors), []);

  const invalid = [
    null,
    {
      id: 1,
      name: "Broken",
      target: ["enemy"],
      scope: ["single"],
      mpCost: 0,
      status: { poison: 1.5 },
      allyStatusChance: -0.1,
      toggleStatus: "yes",
    },
  ];
  const invalidErrors = [];

  DatabaseValidator.validateSkills(invalid, invalidErrors);

  assert.equal(invalidErrors.length, 3);
}

testPureStatusSkillUsesRuntimeAndMp();
testDamageSkillCarriesStatusPayload();
testStatusResistanceStillAppliesToSkillPayloads();
testAllyStatusChanceAndToggleBehavior();
testStatusRemovalUsesCanonicalRuntimeKeys();
testDeathStatusSkillUsesSharedStatusEffects();
testMultipleStatusesResolveFromOneSkill();
testLegacyUnknownStatusReferenceFailsSafely();
testLegacyUnknownRemovalReferencesFailSafely();
testSkillStatusMetadataValidation();

console.log("Skill/status integration regression tests passed.");
