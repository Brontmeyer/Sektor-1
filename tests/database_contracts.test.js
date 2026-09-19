"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const readData = (filename) =>
  JSON.parse(fs.readFileSync(path.join(projectRoot, "data", filename), "utf8"));
const clone = (value) => JSON.parse(JSON.stringify(value));

function loadValidator() {
  const filename = path.join(projectRoot, "js/core/DatabaseValidator.js");
  const source = fs.readFileSync(filename, "utf8");
  const context = vm.createContext({
    console,
    DebugManager: { log() {} },
  });

  vm.runInContext(
    `${source}\nglobalThis.__DatabaseValidator = DatabaseValidator;`,
    context,
    { filename },
  );

  return context.__DatabaseValidator;
}

function projectDatabase() {
  return {
    system: readData("System.json"),
    mapInfos: readData("MapInfos.json"),
    actors: readData("Actors.json"),
    enemies: readData("Enemies.json"),
    encounters: readData("Encounters.json"),
    items: readData("Items.json"),
    weapons: readData("Weapons.json"),
    armors: readData("Armors.json"),
    skills: readData("Skills.json"),
    essences: readData("Essences.json"),
    statuses: readData("Statuses.json"),
  };
}

function testCurrentProjectPassesExpandedValidation() {
  const DatabaseValidator = loadValidator();
  assert.equal(DatabaseValidator.validate(projectDatabase()), true);
}

function testActorGrowthExpAndSpriteContracts() {
  const DatabaseValidator = loadValidator();
  const actors = clone(readData("Actors.json"));
  const errors = [];

  actors[1].exp = "0";
  actors[2].growth.magicAttack = null;
  actors[3].battleSpriteFrames = 0;

  DatabaseValidator.validateActors(actors, errors);

  assert.equal(errors.some((error) => error.includes("Actor 1 exp")), true);
  assert.equal(
    errors.some((error) => error.includes("Actor 2 growth.magicAttack")),
    true,
  );
  assert.equal(
    errors.some((error) => error.includes("Actor 3 battleSpriteFrames")),
    true,
  );
}

function testEnemyElementRateAndSpriteContracts() {
  const DatabaseValidator = loadValidator();
  const enemies = clone(readData("Enemies.json"));
  const errors = [];

  enemies[1].elementRates.fire = "weak";
  enemies[1].battleSpriteWidth = -1;

  DatabaseValidator.validateEnemies(enemies, errors);

  assert.equal(
    errors.some((error) => error.includes("elementRates.fire")),
    true,
  );
  assert.equal(
    errors.some((error) => error.includes("battleSpriteWidth")),
    true,
  );
}

function testItemAndEquipmentContracts() {
  const DatabaseValidator = loadValidator();
  const items = clone(readData("Items.json"));
  const weapons = clone(readData("Weapons.json"));
  const armors = clone(readData("Armors.json"));
  const itemErrors = [];
  const weaponErrors = [];
  const armorErrors = [];

  items[1].effect.type = "mystery";
  items[2].effect.value = 0;
  weapons[1].attackPercent = "90";
  armors[1].defense = -1;

  DatabaseValidator.validateItems(items, itemErrors);
  DatabaseValidator.validateWeapons(weapons, weaponErrors);
  DatabaseValidator.validateArmors(armors, armorErrors);

  assert.equal(
    itemErrors.some((error) => error.includes("unsupported effect type")),
    true,
  );
  assert.equal(
    itemErrors.some((error) => error.includes("effect.value")),
    true,
  );
  assert.equal(
    weaponErrors.some((error) => error.includes("attackPercent")),
    true,
  );
  assert.equal(
    armorErrors.some((error) => error.includes("defense")),
    true,
  );
}

function testSkillRuntimeMetadataContracts() {
  const DatabaseValidator = loadValidator();
  const skills = clone(readData("Skills.json"));
  const statuses = readData("Statuses.json");
  const errors = [];

  skills[1].category = "healz";
  skills[10].element = "flameish";
  skills[11].power = Number.NaN;
  skills[12].scopePower.single = -1;
  skills[28].status.typoStatus = 0.5;

  DatabaseValidator.validateSkills(skills, statuses, errors);

  assert.equal(errors.some((error) => error.includes("unsupported category")), true);
  assert.equal(errors.some((error) => error.includes("unsupported element")), true);
  assert.equal(errors.some((error) => error.includes("Skill 11 power")), true);
  assert.equal(errors.some((error) => error.includes("scopePower.single")), true);
  assert.equal(errors.some((error) => error.includes("unknown status key")), true);
}

function testStatusNestedSchemaRejectsUnknownAndMalformedFields() {
  const DatabaseValidator = loadValidator();
  const statuses = clone(readData("Statuses.json"));
  const errors = [];

  statuses[1].effects.hpDamgePercent = 0.5;
  statuses[2].effects.hpHealPercent = "0.03";
  statuses[23].conditions.hpPercentOops = 0.5;

  DatabaseValidator.validateStatuses(statuses, errors);

  assert.equal(
    errors.some((error) => error.includes('unsupported property "hpDamgePercent"')),
    true,
  );
  assert.equal(
    errors.some((error) => error.includes("effects.hpHealPercent")),
    true,
  );
  assert.equal(
    errors.some((error) => error.includes('unsupported property "hpPercentOops"')),
    true,
  );
}

function testEssenceProgressionAndReferencesAreValidated() {
  const DatabaseValidator = loadValidator();
  const essences = clone(readData("Essences.json"));
  const skills = readData("Skills.json");
  const statuses = readData("Statuses.json");
  const errors = [];

  essences[1].levels[2].resonanceRequired = 50;
  essences[2].abilities[0].skillId = 999;
  essences[3].passive.status = "notAStatus";

  DatabaseValidator.validateEssences(essences, skills, statuses, errors);

  assert.equal(
    errors.some((error) => error.includes("resonance requirements must be strictly increasing")),
    true,
  );
  assert.equal(errors.some((error) => error.includes("unknown skill ID 999")), true);
  assert.equal(
    errors.some((error) => error.includes("must reference a canonical status key")),
    true,
  );
}

function run() {
  testCurrentProjectPassesExpandedValidation();
  testActorGrowthExpAndSpriteContracts();
  testEnemyElementRateAndSpriteContracts();
  testItemAndEquipmentContracts();
  testSkillRuntimeMetadataContracts();
  testStatusNestedSchemaRejectsUnknownAndMalformedFields();
  testEssenceProgressionAndReferencesAreValidated();

  console.log("Database contract regression tests passed.");
}

run();
