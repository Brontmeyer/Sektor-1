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
const magick = readData("Magick.json");
const canonicalSkills = readData("Skills.json");
const statuses = readData("Statuses.json");

const testSkills = clone(canonicalSkills);
testSkills[6] = {
  id: 6,
  name: "Gel Mend",
  description: "Test-only enemy support technique.",
  type: "skill",
  category: "support",
  effect: "heal",
  healPercent: 0.2,
  target: ["ally"],
  scope: ["single"],
};
testSkills[7] = {
  id: 7,
  name: "Sticky Field",
  description: "Test-only enemy control technique.",
  type: "skill",
  category: "control",
  effect: "inflictStatus",
  status: { slow: 1 },
  target: ["enemy"],
  scope: ["all"],
};

function sequenceRandom(values, fallback = 0) {
  const queue = [...values];
  return () => (queue.length > 0 ? queue.shift() : fallback);
}

function createFixture({ partyCount = 2, enemyCount = 2 } = {}) {
  const DatabaseManager = {
    actors,
    enemies,
    magickData: magick,
    skills: testSkills,
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
    skill(id) {
      return testSkills[id] || null;
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
    `${source}\nglobalThis.__classes = { Game_Actor, Game_Enemy, BattleManager };`,
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
    addBattlePopup() {},
    setEnemyState() {},
    setActorState() {},
    startBattleEffect() {},
  };

  const manager = new BattleManager(scene);
  manager.completeEnemyTurn = () => true;

  return { party, enemies: battleEnemies, manager, messages };
}

function testCanonicalEnemySkillIsSeparateFromValorArts() {
  const skill = canonicalSkills[5];
  const action = enemies[1].actions.find((entry) => entry.type === "skill");

  assert.equal(skill.name, "Goo Rush");
  assert.equal(skill.valorArt, undefined);
  assert.equal(action.skillId, 5);
  assert.equal(action.scope, "single");
  assert.equal(canonicalSkills.slice(1, 5).every((entry) => entry.valorArt === true), true);
}

function testEnemyExecutesSharedDamageAndStatusSkillRuntime() {
  const fixture = createFixture({ partyCount: 1, enemyCount: 1 });
  const enemy = fixture.enemies[0];
  const target = fixture.party[0];
  const hpBefore = target.hp;
  const mpBefore = enemy.mp;
  const random = sequenceRandom([0.6, 0, 0, 0]);

  fixture.manager.performEnemyTurn(enemy, random);

  assert.ok(target.hp < hpBefore);
  assert.equal(target.hasStatus("slow"), true);
  assert.equal(enemy.mp, mpBefore, "non-Magick Skills must not spend MP");
  assert.equal(
    fixture.messages.some((message) => message.includes("uses Goo Rush")),
    true,
  );
}

function testEnemySupportSkillUsesMeaningfulAllyTargeting() {
  const fixture = createFixture({ partyCount: 1, enemyCount: 2 });
  const caster = fixture.enemies[0];
  const injuredAlly = fixture.enemies[1];
  caster.actions = [
    {
      type: "skill",
      skillId: 6,
      weight: 1,
      targetGroup: "ally",
      targetStrategy: "lowestHpRate",
      scope: "single",
    },
  ];
  injuredAlly.setHp(20);
  const hpBefore = injuredAlly.hp;

  const action = fixture.manager.enemyAI.selectAction(caster, () => 0);
  const target = fixture.manager.enemyAI.selectTarget(caster, action, () => 0);

  assert.equal(action.skillId, 6);
  assert.equal(target, injuredAlly);
  assert.equal(fixture.manager.performEnemySkillAction(caster, action, () => 0), true);
  assert.ok(injuredAlly.hp > hpBefore);
}

function testEnemyAllTargetControlSkillUsesSharedStatusRuntime() {
  const fixture = createFixture({ partyCount: 2, enemyCount: 1 });
  const caster = fixture.enemies[0];
  caster.actions = [
    {
      type: "skill",
      skillId: 7,
      weight: 1,
      targetGroup: "enemy",
      targetStrategy: "first",
      scope: "all",
    },
  ];
  const action = fixture.manager.enemyAI.selectAction(caster, () => 0);

  assert.equal(fixture.manager.performEnemySkillAction(caster, action, () => 0), true);
  assert.equal(fixture.party[0].hasStatus("slow"), true);
  assert.equal(fixture.party[1].hasStatus("slow"), true);
}

function testEnemyCannotUseActorOwnedValorArtAsSkillAction() {
  const fixture = createFixture({ partyCount: 1, enemyCount: 1 });
  const enemy = fixture.enemies[0];
  enemy.actions = [
    {
      type: "skill",
      skillId: 1,
      weight: 1,
      targetGroup: "enemy",
      targetStrategy: "first",
      scope: "single",
    },
  ];

  assert.equal(enemy.knowsSkill(1), true);
  assert.equal(enemy.canUseSkill(1), false);
  const action = fixture.manager.enemyAI.selectAction(enemy, () => 0);
  assert.equal(action.type, "attack");
  assert.equal(action.fallback, true);
}

function run() {
  testCanonicalEnemySkillIsSeparateFromValorArts();
  testEnemyExecutesSharedDamageAndStatusSkillRuntime();
  testEnemySupportSkillUsesMeaningfulAllyTargeting();
  testEnemyAllTargetControlSkillUsesSharedStatusRuntime();
  testEnemyCannotUseActorOwnedValorArtAsSkillAction();

  console.log("Enemy Skill action regression tests passed.");
}

run();
