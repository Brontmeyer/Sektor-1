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
const statuses = readData("Statuses.json");
const magick = readData("Magick.json");
const skills = readData("Skills.json");
const valorArts = readData("Valor.json");

function createHarness() {
  const partyMembers = [];
  const DatabaseManager = {
    actors,
    enemies,
    statuses,
    magick,
    skills,
    valorArts,
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
      return skills[id] || null;
    },
    skillName(id) {
      return skills[id]?.name || `Unknown Skill ${id}`;
    },
    valorArt(id) {
      return valorArts[id] || null;
    },
    valorArtName(id) {
      return valorArts[id]?.name || `Unknown Valor Art ${id}`;
    },
    statusByKey(key) {
      return statuses.find((status) => status?.key === key) || null;
    },
    weapon() {
      return null;
    },
    armor() {
      return null;
    },
    accessory() {
      return null;
    },
  };
  const gameParty = {
    battleMembers() {
      return partyMembers;
    },
    livingBattleMembers() {
      return partyMembers.filter((battler) => battler.isAlive());
    },
    battleLeader() {
      return partyMembers[0] || null;
    },
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
  vm.runInContext("Math.random = () => 0;", context);

  const { Game_Actor, Game_Enemy, BattleManager } = context.__classes;
  const party = [1, 2, 3, 4].map((actorId) => new Game_Actor(actorId));
  partyMembers.push(...party);

  return { party, Game_Enemy, BattleManager };
}

function createScene(caster, party, enemiesList, skill, targets, targetScope) {
  const messages = [];
  const popups = [];
  const scene = {
    enemies: enemiesList,
    outcome: null,
    victory: false,
    defeat: false,
    pendingEnemyTurn: false,
    enemyTurnDelay: 0,
    battleInputLocked: true,
    targetScope,
    pendingSkill: skill,
    pendingSkillTarget: targetScope === "single" ? targets[0] || null : null,
    partyController: { currentBattler: () => caster },
    targetManager: { getCurrentTargets: () => targets },
    addBattleMessage(message) {
      messages.push(message);
    },
    addBattlePopup(target, text, type) {
      popups.push({ target, text, type });
    },
    setActorState() {},
    setEnemyState() {},
  };

  return { scene, messages, popups };
}

function ready(actor) {
  actor.setValor(actor.maxValor);
  assert.equal(actor.isValorReady(), true);
}

function testCanonicalArtsAndOwnership() {
  assert.deepEqual(
    valorArts.filter(Boolean).map((art) => ({
      id: art.id,
      effect: art.effect,
      category: art.category,
      type: art.type,
    })),
    [
      { id: 1, effect: "damage", category: "physical", type: "valor" },
      { id: 2, effect: "heal", category: "support", type: "valor" },
      { id: 3, effect: "damage", category: "physical", type: "valor" },
      { id: 4, effect: "inflictStatus", category: "control", type: "valor" },
    ],
  );
  assert.deepEqual(
    actors.filter(Boolean).map((actor) => actor.initialValorArtIds),
    [[1], [2], [3], [4]],
  );
  assert.equal(skills.filter((skill) => skill?.type === "valor").length, 0);
}

function testActorOneValorArtIsSingleTargetBurst() {
  const { party, Game_Enemy, BattleManager } = createHarness();
  const tyler = party[0];
  const enemy = new Game_Enemy(1);
  const skill = valorArts[1];
  ready(tyler);

  const expectedDamage = new BattleManager({ enemies: [enemy] }).calculatePhysicalDamage(
    tyler,
    enemy,
    { powerMultiplier: skill.powerMultiplier },
  );
  const hpBefore = enemy.hp;
  const { scene } = createScene(tyler, party, [enemy], skill, [enemy], "single");
  const manager = new BattleManager(scene);

  assert.equal(manager.performSkillEffect(), true);
  assert.equal(hpBefore - enemy.hp, expectedDamage);
  assert.equal(tyler.valor, 0);
}

function testRallyheartHealsOnlyInjuredAllies() {
  const { party, Game_Enemy, BattleManager } = createHarness();
  const sarah = party[1];
  const skill = valorArts[2];
  const enemy = new Game_Enemy(1);

  for (const actor of party) {
    actor.setHp(200);
  }
  party[3].setHp(party[3].maxHp);
  ready(sarah);

  assert.equal(sarah.isValidSkillTarget(skill, party[0]), true);
  assert.equal(sarah.isValidSkillTarget(skill, party[3]), false);

  const injured = party.slice(0, 3);
  const { scene } = createScene(sarah, party, [enemy], skill, injured, "all");
  const manager = new BattleManager(scene);

  assert.equal(manager.performSkillEffect(), true);
  for (const actor of injured) {
    assert.equal(actor.hp, 375);
  }
  assert.equal(party[3].hp, party[3].maxHp);
  assert.equal(sarah.valor, 0);
}

function testWildArcDamagesAllEnemiesAndCanInflictDarkness() {
  const { party, Game_Enemy, BattleManager } = createHarness();
  const aboo = party[2];
  const skill = valorArts[3];
  const enemyA = new Game_Enemy(1);
  const enemyB = new Game_Enemy(1);
  ready(aboo);

  const hpBefore = [enemyA.hp, enemyB.hp];
  const { scene } = createScene(
    aboo,
    party,
    [enemyA, enemyB],
    skill,
    [enemyA, enemyB],
    "all",
  );
  const manager = new BattleManager(scene);

  assert.equal(manager.performSkillEffect(), true);
  assert.equal(enemyA.hp < hpBefore[0], true);
  assert.equal(enemyB.hp < hpBefore[1], true);
  assert.equal(enemyA.hasStatus("darkness"), true);
  assert.equal(enemyB.hasStatus("darkness"), true);
  assert.equal(aboo.valor, 0);
}

function testZeroLockControlsAllEnemiesWithoutPhysicalDamage() {
  const { party, Game_Enemy, BattleManager } = createHarness();
  const gPrime = party[3];
  const skill = valorArts[4];
  const enemyA = new Game_Enemy(1);
  const enemyB = new Game_Enemy(1);
  ready(gPrime);

  const hpBefore = [enemyA.hp, enemyB.hp];
  const { scene } = createScene(
    gPrime,
    party,
    [enemyA, enemyB],
    skill,
    [enemyA, enemyB],
    "all",
  );
  const manager = new BattleManager(scene);

  assert.equal(manager.performSkillEffect(), true);
  assert.deepEqual([enemyA.hp, enemyB.hp], hpBefore);
  assert.equal(enemyA.hasStatus("slow"), true);
  assert.equal(enemyB.hasStatus("slow"), true);
  assert.equal(gPrime.valor, 0);
}

function run() {
  testCanonicalArtsAndOwnership();
  testActorOneValorArtIsSingleTargetBurst();
  testRallyheartHealsOnlyInjuredAllies();
  testWildArcDamagesAllEnemiesAndCanInflictDarkness();
  testZeroLockControlsAllEnemiesWithoutPhysicalDamage();

  console.log("Character Valor Arts regression tests passed.");
}

run();
