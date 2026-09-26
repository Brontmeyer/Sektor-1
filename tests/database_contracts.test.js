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
    accessories: readData("Accessories.json"),
    magickData: readData("Magick.json"),
    skills: readData("Skills.json"),
    enemySkills: readData("EnemySkill.json"),
    valorArts: readData("Valor.json"),
    essences: readData("Essences.json"),
    statuses: readData("Statuses.json"),
  };
}

function testCurrentProjectPassesExpandedValidation() {
  const DatabaseValidator = loadValidator();
  assert.equal(DatabaseValidator.validate(projectDatabase()), true);
}

function testStoryIdentitySystemContract() {
  const DatabaseValidator = loadValidator();
  const database = projectDatabase();
  const errors = [];

  DatabaseValidator.validateSystem(
    database.system,
    database.mapInfos,
    errors,
    database.actors,
  );
  assert.deepEqual(errors, []);

  const malformed = clone(database.system);
  malformed.protagonistActorId = 999;
  malformed.unidentifiedActorName = "???";
  const malformedErrors = [];
  DatabaseValidator.validateSystem(
    malformed,
    database.mapInfos,
    malformedErrors,
    database.actors,
  );

  assert.equal(
    malformedErrors.some((error) => error.includes("unknown actor ID 999")),
    true,
  );
  assert.equal(
    malformedErrors.some((error) => error.includes("letters and spaces only")),
    true,
  );
}

function testActorGrowthExpAndSpriteContracts() {
  const DatabaseValidator = loadValidator();
  const actors = clone(readData("Actors.json"));
  const errors = [];

  actors[1].exp = "0";
  actors[2].growth.magicAttack = null;
  actors[3].battleSpriteFrames = 0;
  actors[4].maxValor = 0;

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
  assert.equal(
    errors.some((error) => error.includes("Actor 4 maxValor")),
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
  const accessories = clone(readData("Accessories.json"));
  const itemErrors = [];
  const weaponErrors = [];
  const armorErrors = [];
  const accessoryErrors = [];

  items[1].effect.type = "mystery";
  items[1].target = ["enemy"];
  items[1].scope = ["single"];
  items[2].effect.value = 0;
  items[2].target = ["somewhere"];
  items[2].scope = ["wide"];
  weapons[1].attackPercent = "90";
  armors[1].defense = -1;
  accessories[1].bonuses.attack = -1;
  accessories[2].bonuses.typoBonus = 5;

  DatabaseValidator.validateItems(items, itemErrors);
  DatabaseValidator.validateWeapons(weapons, weaponErrors);
  DatabaseValidator.validateArmors(armors, armorErrors);
  DatabaseValidator.validateAccessories(accessories, accessoryErrors);

  assert.equal(
    itemErrors.some((error) => error.includes("unsupported effect type")),
    true,
  );
  assert.equal(
    itemErrors.some((error) => error.includes("effect.value")),
    true,
  );
  assert.equal(
    itemErrors.some((error) => error.includes('target has unsupported value "somewhere"')),
    true,
  );
  assert.equal(
    itemErrors.some((error) => error.includes('scope has unsupported value "wide"')),
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
  assert.equal(
    accessoryErrors.some((error) => error.includes("bonuses.attack")),
    true,
  );
  assert.equal(
    accessoryErrors.some((error) => error.includes('unsupported property "typoBonus"')),
    true,
  );
}

function testMagickRuntimeMetadataContracts() {
  const DatabaseValidator = loadValidator();
  const magick = clone(readData("Magick.json"));
  const statuses = readData("Statuses.json");
  const errors = [];

  magick[1].category = "healz";
  magick[10].element = "flameish";
  magick[11].power = Number.NaN;
  magick[12].scopePower.single = -1;
  magick[28].status.typoStatus = 0.5;

  DatabaseValidator.validateMagick(magick, statuses, errors);

  assert.equal(errors.some((error) => error.includes("unsupported category")), true);
  assert.equal(errors.some((error) => error.includes("unsupported element")), true);
  assert.equal(errors.some((error) => error.includes("Magick 11 power")), true);
  assert.equal(errors.some((error) => error.includes("scopePower.single")), true);
  assert.equal(errors.some((error) => error.includes("unknown status key")), true);
}


function testSkillsRuntimeMetadataContracts() {
  const DatabaseValidator = loadValidator();
  const statuses = readData("Statuses.json");
  const skills = [
    null,
    {
      id: 1,
      name: "Test Technique",
      description: "Test-only physical technique.",
      type: "skill",
      category: "physical",
      effect: "damage",
      powerMultiplier: 1.5,
      status: { darkness: 0.5 },
      target: ["enemy"],
      scope: ["single"],
    },
  ];
  const errors = [];

  DatabaseValidator.validateSkills(skills, statuses, errors);
  assert.deepEqual(errors, []);

  const invalid = clone(skills);
  invalid[1].type = "magick";
  invalid[1].powerMultiplier = 0;
  invalid[1].valorLevel = 1;
  invalid[1].target = ["somewhere"];
  invalid[1].status.typoStatus = 0.5;
  const invalidErrors = [];
  DatabaseValidator.validateSkills(invalid, statuses, invalidErrors);

  assert.equal(invalidErrors.some((error) => error.includes('type must be "skill"')), true);
  assert.equal(invalidErrors.some((error) => error.includes("powerMultiplier")), true);
  assert.equal(
    invalidErrors.some((error) => error.includes('unsupported property "valorLevel"')),
    true,
  );
  assert.equal(invalidErrors.some((error) => error.includes("unsupported value")), true);
  assert.equal(
    invalidErrors.some((error) => error.includes('unknown status key "typoStatus"')),
    true,
  );
}

function testValorArtsHaveDedicatedDatabaseContract() {
  const DatabaseValidator = loadValidator();
  const statuses = readData("Statuses.json");
  const valorArts = clone(readData("Valor.json"));
  const errors = [];

  DatabaseValidator.validateValorArts(valorArts, statuses, errors);
  assert.deepEqual(errors, []);

  valorArts[1].type = "skill";
  valorArts[1].valorLevel = 5;
  valorArts[2].healPercent = 2;
  valorArts[3].status.typoStatus = 0.5;
  const invalidErrors = [];
  DatabaseValidator.validateValorArts(valorArts, statuses, invalidErrors);

  assert.equal(invalidErrors.some((error) => error.includes('type must be "valor"')), true);
  assert.equal(invalidErrors.some((error) => error.includes("valorLevel")), true);
  assert.equal(invalidErrors.some((error) => error.includes("healPercent")), true);
  assert.equal(
    invalidErrors.some((error) => error.includes('unknown status key "typoStatus"')),
    true,
  );
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
  const magick = readData("Magick.json");
  const statuses = readData("Statuses.json");
  const errors = [];

  essences[1].levels[2].resonanceRequired = 50;
  essences[2].abilities[0].magickId = 999;
  essences[3].passive.status = "notAStatus";

  DatabaseValidator.validateEssences(essences, magick, statuses, errors);

  assert.equal(
    errors.some((error) => error.includes("resonance requirements must be strictly increasing")),
    true,
  );
  assert.equal(errors.some((error) => error.includes("unknown magick ID 999")), true);
  assert.equal(
    errors.some((error) => error.includes("must reference a canonical status key")),
    true,
  );
}

function run() {
  testCurrentProjectPassesExpandedValidation();
  testStoryIdentitySystemContract();
  testActorGrowthExpAndSpriteContracts();
  testEnemyElementRateAndSpriteContracts();
  testItemAndEquipmentContracts();
  testMagickRuntimeMetadataContracts();
  testSkillsRuntimeMetadataContracts();
  testValorArtsHaveDedicatedDatabaseContract();
  testStatusNestedSchemaRejectsUnknownAndMalformedFields();
  testEssenceProgressionAndReferencesAreValidated();

  console.log("Database contract regression tests passed.");
}

run();
