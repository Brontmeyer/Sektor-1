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
const canonicalEnemySkills = readData("EnemySkill.json");
const canonicalValorArts = readData("Valor.json");

const testSkills = [
  null,
  {
    id: 1,
    name: "Test Technique",
    description: "Test-only physical technique.",
    type: "skill",
    category: "physical",
    effect: "damage",
    powerMultiplier: 1.5,
    target: ["enemy"],
    scope: ["single"],
  },
  {
    id: 2,
    name: "Test Focus",
    description: "Test-only self technique.",
    type: "skill",
    category: "physical",
    effect: "damage",
    powerMultiplier: 1,
    target: ["self"],
    scope: ["single"],
  },
  {
    id: 3,
    name: "Test Sweep",
    description: "Test-only all-target technique.",
    type: "skill",
    category: "physical",
    effect: "damage",
    powerMultiplier: 1,
    target: ["enemy", "ally"],
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
    "js/battle/BattleTargetManager.js",
    "js/battle/BattleEnemyAI.js",
    "js/battle/BattleManager.js",
  ]
    .map((relativePath) =>
      fs.readFileSync(path.join(projectRoot, relativePath), "utf8"),
    )
    .join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__classes = { Game_Actor, Game_Enemy, BattleTargetManager, BattleManager };`,
    context,
  );
  vm.runInContext("Math.random = () => 0;", context);

  const { Game_Actor, Game_Enemy, BattleTargetManager, BattleManager } =
    context.__classes;
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
    BattleTargetManager,
    BattleManager,
  };
}

function testCanonicalSkillsDatabaseIsSeparateFromValorArts() {
  const skills = canonicalSkills.filter(Boolean);
  const enemyTechnique = canonicalEnemySkills[1];

  assert.equal(skills.every((skill) => skill.type === "skill"), true);
  assert.equal(enemyTechnique.name, "Goo Rush");
  assert.equal(canonicalSkills[5], null);
  assert.equal(canonicalSkills[6].name, "Scan");
  assert.deepEqual(
    canonicalValorArts.filter(Boolean).map((art) => art.id),
    [1, 2, 3, 4],
  );
  assert.deepEqual(
    actors.filter(Boolean).map((actor) => actor.initialValorArtIds),
    [[1], [2], [3], [4]],
  );
}

function testActorSkillOwnershipIsSeparateFromMagick() {
  const { actor } = createHarness();

  assert.deepEqual(Array.from(actor.skillIds), []);
  assert.equal(actor.learnSkill(1), true);
  assert.equal(actor.learnSkill(1), false);
  assert.equal(actor.knowsSkill(1), true);
  assert.equal(actor.knownSkills()[0].name, "Test Technique");
  assert.deepEqual(Array.from(actor.magickIds), [1, 10]);
  assert.equal(actor.forgetSkill(1), true);
  assert.equal(actor.knowsSkill(1), false);
}

function testSkillLegalityUsesSharedActionRestrictions() {
  const { actor } = createHarness();
  actor.learnSkill(1);

  assert.equal(actor.canUseSkill(1), true);
  actor.addStatus("silence");
  assert.equal(actor.canUseSkill(1), true, "Silence blocks Magick, not Skills");
  actor.addStatus("frog");
  assert.equal(actor.canUseSkill(1), false, "Frog's attack-only allow list blocks Skills");
}

function testSkillTargetingUsesSkillDefinitionNotMagickRules() {
  const { actor, enemy, BattleTargetManager } = createHarness();
  actor.learnSkill(1);
  const skill = testSkills[1];
  const scene = {
    enemies: [enemy],
    pendingSkill: skill,
    pendingMagick: null,
    targetGroup: "enemy",
    targetScope: "single",
    selectedEnemyIndex: 0,
    selectedAllyIndex: 0,
    partyController: { currentBattler: () => actor },
  };
  const manager = new BattleTargetManager(scene);

  assert.equal(actor.isValidSkillTarget(skill, enemy), true);
  assert.equal(actor.isValidSkillTarget(skill, actor), false);
  assert.deepEqual(Array.from(manager.selectableBattlers("enemy")), [enemy]);
  assert.deepEqual(Array.from(manager.selectableBattlers("ally")), []);
}


function testSelfTargetSkillsUseAllySelectorWithoutTargetingOtherAllies() {
  const { actor, enemy, BattleTargetManager } = createHarness();
  actor.learnSkill(2);
  const skill = testSkills[2];
  const scene = {
    enemies: [enemy],
    pendingSkill: skill,
    pendingMagick: null,
    targetGroup: "ally",
    targetScope: "single",
    selectedEnemyIndex: 0,
    selectedAllyIndex: 0,
    partyController: { currentBattler: () => actor },
  };
  const manager = new BattleTargetManager(scene);

  assert.deepEqual(Array.from(manager.allowedTargetGroups(skill)), ["ally"]);
  assert.equal(actor.isValidSkillTarget(skill, actor), true);
  assert.equal(actor.isValidSkillTarget(skill, enemy), false);
  assert.equal(manager.selectFirstSelectableAlly(skill), actor);
}


function testConfuseOwnsAllTargetSkillGroupSelection() {
  const { actor, enemy, BattleTargetManager, BattleManager } = createHarness();
  actor.learnSkill(3);
  actor.addStatus("confuse");
  const messages = [];
  const scene = {
    enemies: [enemy],
    pendingSkill: null,
    pendingSkillTarget: null,
    pendingMagick: null,
    targetGroup: "enemy",
    targetScope: "single",
    selectedEnemyIndex: 0,
    selectedAllyIndex: 0,
    selectingEnemyTarget: false,
    enemyTargetAction: null,
    battleInputLocked: false,
    partyController: { currentBattler: () => actor },
    skillsWindow: {
      currentSkill: () => testSkills[3],
      hide() {},
    },
    addBattleMessage(message) {
      messages.push(message);
    },
    setActorState() {},
    setActionPhase(phase) {
      this.actionPhase = phase;
    },
  };
  scene.targetManager = new BattleTargetManager(scene);
  const manager = new BattleManager(scene);

  manager.executeSkill();

  assert.equal(scene.targetScope, "all");
  assert.equal(scene.targetGroup, "enemy");
  assert.equal(scene.pendingSkill, testSkills[3]);
  assert.equal(scene.pendingSkillTarget, null);
  assert.equal(scene.selectingEnemyTarget, false);
  assert.equal(scene.enemyTargetAction, null);
  assert.equal(scene.battleInputLocked, true);
  assert.equal(scene.actionPhase, "skillUse");
  assert.equal(messages.some((message) => message.includes("confused")), true);
}

function testSkillExecutionReusesPhysicalDamagePipeline() {
  const { actor, enemy, BattleManager } = createHarness();
  actor.learnSkill(1);
  const messages = [];
  const popups = [];
  const scene = {
    enemies: [enemy],
    outcome: null,
    victory: false,
    defeat: false,
    pendingEnemyTurn: false,
    enemyTurnDelay: 0,
    battleInputLocked: true,
    targetScope: "single",
    pendingSkill: testSkills[1],
    pendingSkillTarget: enemy,
    partyController: { currentBattler: () => actor },
    targetManager: { getCurrentTargets: () => [enemy] },
    addBattleMessage(message) {
      messages.push(message);
    },
    addBattlePopup(target, text, type) {
      popups.push({ target, text, type });
    },
    setActorState() {},
    setEnemyState() {},
  };
  const manager = new BattleManager(scene);
  const hpBefore = enemy.hp;

  assert.equal(manager.performSkillEffect(), true);
  assert.equal(hpBefore - enemy.hp, 15);
  assert.equal(scene.pendingSkill, null);
  assert.equal(scene.pendingSkillTarget, null);
  assert.equal(popups.some((popup) => popup.text === "-15"), true);
  assert.equal(messages.some((message) => message.includes("Test Technique")), true);
}

function run() {
  testCanonicalSkillsDatabaseIsSeparateFromValorArts();
  testActorSkillOwnershipIsSeparateFromMagick();
  testSkillLegalityUsesSharedActionRestrictions();
  testSkillTargetingUsesSkillDefinitionNotMagickRules();
  testSelfTargetSkillsUseAllySelectorWithoutTargetingOtherAllies();
  testConfuseOwnsAllTargetSkillGroupSelection();
  testSkillExecutionReusesPhysicalDamagePipeline();

  console.log("Skills runtime regression tests passed.");
}

run();
