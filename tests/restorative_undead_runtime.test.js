"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const items = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "data/Items.json"), "utf8"),
);
const magick = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "data/Magick.json"), "utf8"),
);

function loadRuntime() {
  const DatabaseManager = {
    items,
    magickData: magick,
    statuses: [],
    item(id) {
      return items[id] || null;
    },
    magick(id) {
      return magick[id] || null;
    },
    statusByKey() {
      return null;
    },
    skill() {
      return null;
    },
  };
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    DatabaseManager,
    DebugManager: { log() {} },
  });
  const source = [
    "js/objects/Game_Battler.js",
    "js/objects/Game_Party.js",
  ]
    .map((relativePath) =>
      fs.readFileSync(path.join(projectRoot, relativePath), "utf8"),
    )
    .join("\n");

  vm.runInContext(
    `${source}\n` +
      `class TestActor extends Game_Battler { battleSideType() { return "actor"; } }\n` +
      `class TestEnemy extends Game_Battler { battleSideType() { return "enemy"; } }\n` +
      `globalThis.__runtime = { Game_Party, TestActor, TestEnemy };`,
    context,
  );

  return { ...context.__runtime, context };
}

function battlerData(name, undead = false) {
  return {
    name,
    undead,
    level: 10,
    maxHp: 500,
    maxMp: 100,
    strength: 20,
    vitality: 20,
    dexterity: 20,
    agility: 20,
    magic: 20,
    spirit: 20,
    luck: 20,
    attack: 20,
    attackPercent: 100,
    defense: 20,
    defensePercent: 0,
    magicAttack: 20,
    magicDefense: 20,
    magicDefensePercent: 0,
  };
}

function testUndeadIdentityIsBattlerOwned() {
  const { TestEnemy } = loadRuntime();
  const undead = new TestEnemy(battlerData("Revenant", true));
  const living = new TestEnemy(battlerData("Living Target", false));

  assert.equal(undead.isUndead(), true);
  assert.equal(living.isUndead(), false);
}

function testRestoreMagickDamagesUndeadEvenAtFullHp() {
  const { TestActor, TestEnemy } = loadRuntime();
  const caster = new TestActor(battlerData("Caster"));
  const undead = new TestEnemy(battlerData("Revenant", true));
  const living = new TestEnemy(battlerData("Living Target"));
  const undeadHpBefore = undead.hp;

  assert.equal(caster.isValidMagickTarget(magick[1], undead), true);
  assert.equal(caster.useMagick(1, undead, false, "single", () => 0), true);
  assert.equal(undead.hp < undeadHpBefore, true);

  // A normal full-HP target still rejects a pure HP-restoration cast.
  assert.equal(caster.useMagick(1, living, false, "single", () => 0), false);
}

function testHealingSkillsTreatFullHpUndeadAsLegalTargets() {
  const { TestActor, TestEnemy } = loadRuntime();
  const caster = new TestActor(battlerData("Caster"));
  const undead = new TestEnemy(battlerData("Revenant", true));
  const living = new TestEnemy(battlerData("Living Target"));
  const healingSkill = {
    id: 99,
    name: "Test Restore Skill",
    type: "skill",
    effect: "heal",
    healPercent: 0.25,
    target: ["enemy"],
    scope: ["single"],
  };

  assert.equal(caster.isValidSkillTarget(healingSkill, undead), true);
  assert.equal(caster.isValidSkillTarget(healingSkill, living), false);
}

function testHealingItemsDamageUndeadAndConsumeOnlyOnSuccess() {
  const { Game_Party, TestEnemy } = loadRuntime();
  const party = new Game_Party();
  const undead = new TestEnemy(battlerData("Revenant", true));
  const living = new TestEnemy(battlerData("Living Target"));
  const undeadHpBefore = undead.hp;

  party.gainItem(1, 2);

  assert.equal(party.useItem(1, undead), true);
  assert.equal(undead.hp < undeadHpBefore, true);
  assert.equal(party.itemCount(1), 1);

  assert.equal(party.useItem(1, living), false);
  assert.equal(living.hp, living.maxHp);
  assert.equal(party.itemCount(1), 1);
}

function run() {
  testUndeadIdentityIsBattlerOwned();
  testRestoreMagickDamagesUndeadEvenAtFullHp();
  testHealingSkillsTreatFullHpUndeadAsLegalTargets();
  testHealingItemsDamageUndeadAndConsumeOnlyOnSuccess();
  console.log("Restorative-vs-undead runtime regression tests passed.");
}

run();
