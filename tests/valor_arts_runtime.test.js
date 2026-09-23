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
const canonicalSkills = readData("Skills.json");

const testSkills = [
  null,
  {
    id: 1,
    name: "Test Technique",
    description: "Test-only regular Skill.",
    type: "skill",
    category: "physical",
    effect: "damage",
    powerMultiplier: 1.5,
    target: ["enemy"],
    scope: ["single"],
  },
  {
    id: 2,
    name: "Test Valor Art",
    description: "Test-only Valor Art.",
    type: "skill",
    category: "physical",
    effect: "damage",
    powerMultiplier: 2,
    valorArt: true,
    target: ["enemy"],
    scope: ["single"],
  },
  {
    id: 3,
    name: "Test Valor Wave",
    description: "Test-only all-target Valor Art.",
    type: "skill",
    category: "physical",
    effect: "damage",
    powerMultiplier: 1,
    valorArt: true,
    target: ["enemy"],
    scope: ["all"],
  },
];

function createHarness() {
  const partyMembers = [];
  const DatabaseManager = {
    actors,
    enemies,
    statuses,
    magick,
    skills: testSkills,
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
    skillName(id) {
      return testSkills[id]?.name || `Unknown Skill ${id}`;
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
    Graphics: { width: 1280, height: 720 },
    Input: { isTriggered() { return false; } },
  });
  const source = [
    "js/objects/Game_Battler.js",
    "js/objects/Game_Actor.js",
    "js/objects/Game_Enemy.js",
    "js/battle/BattleTargetManager.js",
    "js/battle/BattleEnemyAI.js",
    "js/battle/BattleManager.js",
    "js/windows/Window_BattleCommand.js",
    "js/windows/Window_TextLayout.js",
    "js/windows/Window_BattleSkills.js",
    "js/windows/Window_Skills.js",
  ]
    .map((relativePath) =>
      fs.readFileSync(path.join(projectRoot, relativePath), "utf8"),
    )
    .join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__classes = { Game_Actor, Game_Enemy, BattleManager, Window_BattleCommand, Window_BattleSkills, Window_Skills };`,
    context,
  );
  vm.runInContext("Math.random = () => 0;", context);

  const {
    Game_Actor,
    Game_Enemy,
    BattleManager,
    Window_BattleCommand,
    Window_BattleSkills,
    Window_Skills,
  } = context.__classes;
  const actor = new Game_Actor(1);
  actor.skillIds = [];
  const enemy = new Game_Enemy(1);
  partyMembers.push(actor);

  return {
    context,
    actor,
    enemy,
    partyMembers,
    Game_Enemy,
    BattleManager,
    Window_BattleCommand,
    Window_BattleSkills,
    Window_Skills,
  };
}

function createSkillEffectScene(actor, enemiesList, skill, targetScope = "single") {
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
    pendingSkillTarget: enemiesList[0] || null,
    partyController: { currentBattler: () => actor },
    targetManager: { getCurrentTargets: () => enemiesList },
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

function testCanonicalContentDefinesCharacterSpecificValorArts() {
  const skills = canonicalSkills.filter((skill) => skill?.valorArt === true);

  assert.deepEqual(
    skills.map((skill) => [skill.id, skill.name, skill.valorArt]),
    [
      [1, "Unbroken", true],
      [2, "Rallyheart", true],
      [3, "Wild Arc", true],
      [4, "Zero Lock", true],
    ],
  );
  assert.deepEqual(
    actors
      .filter(Boolean)
      .map((actor) =>
        actor.initialSkillIds.filter((skillId) => canonicalSkills[skillId]?.valorArt === true),
      ),
    [[1], [2], [3], [4]],
  );
}

function testValorArtReadinessLivesOnActorSkillCostHook() {
  const { actor } = createHarness();
  actor.learnSkill(2);

  assert.equal(actor.isValorArt(testSkills[2]), true);
  assert.equal(actor.canUseSkill(2), false);

  actor.setValor(actor.maxValor - 0.001);
  assert.equal(actor.canUseSkill(2), false);

  actor.setValor(actor.maxValor);
  assert.equal(actor.canUseSkill(2), true);

  actor.addStatus("frog");
  assert.equal(
    actor.canUseSkill(2),
    false,
    "Shared action restrictions still gate a ready Valor Art",
  );
}

function testRegularSkillsRemainCostNeutral() {
  const { actor } = createHarness();
  actor.learnSkill(1);
  actor.setValor(0);

  assert.equal(actor.canUseSkill(1), true);
  assert.equal(actor.paySkillCost(testSkills[1]), true);
  assert.equal(actor.valor, 0);
}

function testValorArtConsumesFullGaugeOnceWhenCommitted() {
  const { actor, enemy, BattleManager } = createHarness();
  actor.learnSkill(2);
  actor.setValor(actor.maxValor);
  const { scene } = createSkillEffectScene(actor, [enemy], testSkills[2]);
  const manager = new BattleManager(scene);
  let consumeCalls = 0;
  const consumeValor = actor.consumeValor.bind(actor);
  actor.consumeValor = () => {
    consumeCalls += 1;
    return consumeValor();
  };
  const hpBefore = enemy.hp;

  assert.equal(manager.performSkillEffect(), true);
  assert.equal(consumeCalls, 1);
  assert.equal(actor.valor, 0);
  assert.equal(actor.isValorReady(), false);
  assert.equal(hpBefore - enemy.hp, 20);
}

function testValorArtMissStillSpendsCommittedGauge() {
  const { context, actor, enemy, BattleManager } = createHarness();
  actor.learnSkill(2);
  actor.setValor(actor.maxValor);
  actor.attackPercent = 0;
  vm.runInContext("Math.random = () => 0.5;", context);
  const { scene, popups } = createSkillEffectScene(actor, [enemy], testSkills[2]);
  const manager = new BattleManager(scene);
  const hpBefore = enemy.hp;

  assert.equal(manager.performSkillEffect(), false);
  assert.equal(actor.valor, 0);
  assert.equal(enemy.hp, hpBefore);
  assert.equal(popups.some((popup) => popup.text === "MISS"), true);
}

function testInvalidTargetDoesNotSpendValor() {
  const { actor, enemy, BattleManager } = createHarness();
  actor.learnSkill(2);
  actor.setValor(actor.maxValor);
  const { scene } = createSkillEffectScene(actor, [enemy], testSkills[2]);
  scene.pendingSkillTarget = actor;
  const manager = new BattleManager(scene);

  assert.equal(manager.performSkillEffect(), false);
  assert.equal(actor.valor, actor.maxValor);
  assert.equal(scene.pendingSkill, null);
  assert.equal(scene.pendingSkillTarget, null);
}

function testAllTargetValorArtConsumesOnlyOnce() {
  const { actor, enemy, Game_Enemy, BattleManager } = createHarness();
  const secondEnemy = new Game_Enemy(1);
  actor.learnSkill(3);
  actor.setValor(actor.maxValor);
  const { scene } = createSkillEffectScene(
    actor,
    [enemy, secondEnemy],
    testSkills[3],
    "all",
  );
  const manager = new BattleManager(scene);
  let consumeCalls = 0;
  const consumeValor = actor.consumeValor.bind(actor);
  actor.consumeValor = () => {
    consumeCalls += 1;
    return consumeValor();
  };
  const firstHp = enemy.hp;
  const secondHp = secondEnemy.hp;

  assert.equal(manager.performSkillEffect(), true);
  assert.equal(consumeCalls, 1);
  assert.equal(actor.valor, 0);
  assert.equal(enemy.hp < firstHp, true);
  assert.equal(secondEnemy.hp < secondHp, true);
}

function testSkillsCommandTracksValorReadiness() {
  const { actor, Window_BattleCommand } = createHarness();
  actor.learnSkill(2);
  const scene = { partyController: { currentBattler: () => actor } };
  const window = new Window_BattleCommand(scene);

  assert.equal(window.isCommandEnabled("Skills"), false);
  actor.setValor(actor.maxValor);
  assert.equal(window.isCommandEnabled("Skills"), true);
}

function testValorArtPresentationStaysInBattleSkillsButLeavesFieldSkillMenu() {
  const { actor, Window_BattleSkills, Window_Skills } = createHarness();
  const art = testSkills[2];
  const regular = testSkills[1];

  assert.equal(
    Window_BattleSkills.prototype.skillLabel(art),
    "[VALOR] Test Valor Art",
  );
  assert.equal(
    Window_BattleSkills.prototype.skillLabel(regular),
    "Test Technique",
  );

  actor.learnSkill(1);
  actor.learnSkill(2);
  const fieldWindow = Object.create(Window_Skills.prototype);
  fieldWindow.actorNavigation = { actor: () => actor };
  const fieldSkills = fieldWindow.skillList();

  assert.equal(fieldSkills.includes(regular), true);
  assert.equal(fieldSkills.includes(art), false);
}

function run() {
  testCanonicalContentDefinesCharacterSpecificValorArts();
  testValorArtReadinessLivesOnActorSkillCostHook();
  testRegularSkillsRemainCostNeutral();
  testValorArtConsumesFullGaugeOnceWhenCommitted();
  testValorArtMissStillSpendsCommittedGauge();
  testInvalidTargetDoesNotSpendValor();
  testAllTargetValorArtConsumesOnlyOnce();
  testSkillsCommandTracksValorReadiness();
  testValorArtPresentationStaysInBattleSkillsButLeavesFieldSkillMenu();

  console.log("Valor Arts runtime regression tests passed.");
}

run();
