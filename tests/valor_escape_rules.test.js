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
const magick = readData("Magick.json");
const skills = readData("Skills.json");
const statuses = readData("Statuses.json");

function createFixture({ canEscape = true, partySize = 2 } = {}) {
  const partyMembers = [];
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
    statusByKey(key) {
      return statuses.find((status) => status?.key === key) || null;
    },
    weapon() {
      return null;
    },
    armor() {
      return null;
    },
  };
  const gameParty = {
    battleMembers() {
      return partyMembers;
    },
    livingBattleMembers() {
      return partyMembers.filter((actor) => actor.isAlive());
    },
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
    "js/battle/BattlePartyController.js",
    "js/battle/BattleManager.js",
  ]
    .map((relativePath) =>
      fs.readFileSync(path.join(projectRoot, relativePath), "utf8"),
    )
    .join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__classes = { Game_Actor, Game_Enemy, BattlePartyController, BattleManager };`,
    context,
  );

  const { Game_Actor, Game_Enemy, BattlePartyController, BattleManager } =
    context.__classes;

  for (let index = 0; index < partySize; index++) {
    partyMembers.push(new Game_Actor(Math.min(index + 1, 4)));
  }

  const battleEnemies = [new Game_Enemy(1)];
  const messages = [];
  const banners = [];
  const scene = {
    encounter: { id: 99, name: "Escape Test", canEscape },
    enemies: battleEnemies,
    outcome: null,
    victory: false,
    defeat: false,
    pendingEnemyTurn: false,
    enemyTurnDelay: 0,
    enemyTurnIndex: 0,
    battleInputLocked: false,
    formationManager: {
      physicalRearDamageMultiplier() {
        return 1;
      },
    },
    addBattleMessage(message) {
      messages.push(message);
    },
    showBattleBanner(text) {
      banners.push(text);
    },
    addBattlePopup() {},
    setActorState() {},
    setEnemyState() {},
    startBattleEffect() {},
    turnActorTowardEnemies() {},
    queueEnemyTurn(delay) {
      this.pendingEnemyTurn = true;
      this.enemyTurnDelay = delay;
    },
  };

  const manager = new BattleManager(scene);
  scene.battleManager = manager;
  const partyController = new BattlePartyController(scene);
  scene.partyController = partyController;
  partyController.initializePartyTurnQueue();
  manager.startForcedPartyAction = () => false;

  return {
    context,
    partyMembers,
    enemies: battleEnemies,
    scene,
    manager,
    partyController,
    messages,
    banners,
  };
}

function testPassiveValorRequiresHostileBattleActionDamage() {
  const fixture = createFixture();
  const [tyler, sarah] = fixture.partyMembers;
  const enemy = fixture.enemies[0];

  tyler.setValor(0);
  fixture.manager.applyPhysicalDamage(tyler, tyler);
  assert.equal(tyler.valor, 0, "self damage must not generate Valor");

  tyler.recoverAllHp();
  tyler.setValor(0);
  fixture.manager.applyPhysicalDamage(sarah, tyler);
  assert.equal(tyler.valor, 0, "friendly damage must not generate Valor");

  tyler.recoverAllHp();
  tyler.setValor(0);
  fixture.manager.applyPhysicalDamage(enemy, tyler);
  assert.ok(tyler.valor > 0, "enemy physical damage must generate Valor");

  tyler.recoverAllHp();
  tyler.setValor(0);
  const magickResolution = fixture.manager.resolveMagickEffectOnTarget(
    enemy,
    magick[10],
    tyler,
    true,
    "single",
    () => 0,
  );
  assert.equal(magickResolution.success, true);
  assert.ok(tyler.valor > 0, "enemy Magick damage must generate Valor");

  tyler.recoverAllHp();
  tyler.setValor(0);
  const skillSuccess = fixture.manager.performSkillDamageTarget(
    enemy,
    skills[5],
    tyler,
    () => 0,
  );
  assert.equal(skillSuccess, true);
  assert.ok(tyler.valor > 0, "enemy Skill damage must generate Valor");
}

function testMissAndZeroDamageDoNotGenerateValor() {
  const fixture = createFixture({ partySize: 1 });
  const actor = fixture.partyMembers[0];
  const enemy = fixture.enemies[0];
  const hpBefore = actor.hp;

  actor.setValor(0);
  assert.equal(
    fixture.manager.performEnemyPhysicalAction(enemy, actor, () => 0.999999),
    true,
  );
  assert.equal(actor.hp, hpBefore);
  assert.equal(actor.valor, 0, "a missed hostile Attack must not generate Valor");

  actor.receiveDamage(0, {
    category: "physical",
    ...fixture.manager.damageContext(enemy, actor),
  });
  assert.equal(actor.valor, 0, "zero resolved damage must not generate Valor");
}

function testDirectDamageWithoutHostileProvenanceDoesNotGenerateValor() {
  const fixture = createFixture({ partySize: 1 });
  const actor = fixture.partyMembers[0];

  actor.setValor(0);
  actor.receiveDamage(100, { category: "physical" });
  assert.equal(actor.valor, 0);

  actor.recoverAllHp();
  actor.receiveDamage(100, { category: "physical", valorEligible: true });
  assert.equal(actor.valor, 20);
}

function testExplicitValorSkillEffectUsesNarrowSkillHook() {
  const fixture = createFixture();
  const [caster, target] = fixture.partyMembers;
  const valorSkill = {
    id: 999,
    name: "Rally Test",
    type: "skill",
    category: "support",
    effect: "valor",
    valorGain: 25,
    target: ["ally"],
    scope: ["single"],
  };

  target.setValor(0);
  assert.equal(caster.isValidSkillTarget(valorSkill, target), true);
  assert.equal(
    fixture.manager.performSkillValorTarget(caster, valorSkill, target),
    true,
  );
  assert.equal(target.valor, 25);

  target.setValor(100);
  assert.equal(caster.isValidSkillTarget(valorSkill, target), false);
}

function testEscapeChanceUsesAgilityAndFailurePressure() {
  const fixture = createFixture();

  // Current canonical party Agility is 10 and Test Slime Agility is 4:
  // 45% base + (6 * 2.5%) = 60% first-attempt chance.
  assert.equal(fixture.manager.escapeChance(), 0.6);

  const firstActor = fixture.partyController.currentBattler();
  const failed = fixture.manager.attemptEscape(() => 0.99);

  assert.equal(failed.allowed, true);
  assert.equal(failed.success, false);
  assert.equal(failed.chance, 0.6);
  assert.equal(fixture.manager.escapeFailures, 1);
  assert.notEqual(fixture.partyController.currentBattler(), firstActor);
  assert.equal(fixture.manager.escapeChance(), 0.75);

  const succeeded = fixture.manager.attemptEscape(() => 0.7);
  assert.equal(succeeded.success, true);
  assert.equal(succeeded.chance, 0.75);
  assert.equal(fixture.scene.outcome, "escape");
}

function testEscapeChanceIsClampedAndBossEscapeNeverRolls() {
  const fixture = createFixture({ canEscape: true, partySize: 1 });
  fixture.partyMembers[0].agility = 0;
  fixture.enemies[0].agility = 100;
  assert.equal(fixture.manager.escapeChance(), 0.1);

  fixture.partyMembers[0].agility = 100;
  fixture.enemies[0].agility = 0;
  fixture.manager.escapeFailures = 20;
  assert.equal(fixture.manager.escapeChance(), 0.95);

  const boss = createFixture({ canEscape: false, partySize: 2 });
  const currentActor = boss.partyController.currentBattler();
  let rolled = false;
  const result = boss.manager.attemptEscape(() => {
    rolled = true;
    return 0;
  });

  assert.equal(result.allowed, false);
  assert.equal(result.success, false);
  assert.equal(result.chance, 0);
  assert.equal(rolled, false);
  assert.equal(boss.manager.escapeFailures, 0);
  assert.equal(boss.partyController.currentBattler(), currentActor);
  assert.equal(boss.messages.at(-1), "You cannot escape!");
}

function testEscapeMagickCannotBypassNoEscapeEncounter() {
  const fixture = createFixture({ canEscape: false, partySize: 1 });
  const actor = fixture.partyMembers[0];
  const retreat = magick[43];

  actor.learnMagick(retreat.id);
  const mpBefore = actor.mp;
  const success = fixture.manager.performEscapeMagick(actor, retreat);

  assert.equal(success, false);
  assert.equal(actor.mp, mpBefore);
  assert.equal(fixture.scene.outcome, null);
  assert.equal(fixture.messages.at(-1), "You cannot escape!");
}

function testBlockedRetreatIsRejectedBeforeCastingOrSpendingTurn() {
  const fixture = createFixture({ canEscape: false, partySize: 2 });
  const actor = fixture.partyController.currentBattler();
  const retreat = magick[43];
  let hidden = false;

  actor.learnMagick(retreat.id);
  fixture.scene.magickWindow = {
    currentMagick() {
      return retreat;
    },
    hide() {
      hidden = true;
    },
  };

  const mpBefore = actor.mp;
  const currentBefore = fixture.partyController.currentBattler();
  fixture.manager.executeMagick();

  assert.equal(actor.mp, mpBefore);
  assert.equal(fixture.partyController.currentBattler(), currentBefore);
  assert.equal(fixture.scene.battleInputLocked, false);
  assert.equal(fixture.scene.pendingMagick, undefined);
  assert.equal(hidden, false);
  assert.equal(fixture.messages.at(-1), "You cannot escape!");
}

function testValorSkillSchemaIsValidatedExplicitly() {
  const validatorSource = fs.readFileSync(
    path.join(projectRoot, "js/core/DatabaseValidator.js"),
    "utf8",
  );
  const context = vm.createContext({ console, DebugManager: { log() {} } });
  vm.runInContext(
    `${validatorSource}\nglobalThis.__DatabaseValidator = DatabaseValidator;`,
    context,
  );

  const validSkills = [
    null,
    {
      id: 1,
      name: "Rally Test",
      description: "Raises an ally's Valor directly.",
      type: "skill",
      category: "support",
      effect: "valor",
      valorGain: 20,
      target: ["ally"],
      scope: ["single"],
    },
  ];
  const validErrors = [];
  context.__DatabaseValidator.validateSkills(validSkills, statuses, validErrors);
  assert.deepEqual(Array.from(validErrors), []);

  validSkills[1].valorGain = 0;
  const invalidErrors = [];
  context.__DatabaseValidator.validateSkills(validSkills, statuses, invalidErrors);
  assert.equal(
    invalidErrors.some((error) => error.includes("valorGain")),
    true,
  );
}

function run() {
  testPassiveValorRequiresHostileBattleActionDamage();
  testMissAndZeroDamageDoNotGenerateValor();
  testDirectDamageWithoutHostileProvenanceDoesNotGenerateValor();
  testExplicitValorSkillEffectUsesNarrowSkillHook();
  testEscapeChanceUsesAgilityAndFailurePressure();
  testEscapeChanceIsClampedAndBossEscapeNeverRolls();
  testEscapeMagickCannotBypassNoEscapeEncounter();
  testBlockedRetreatIsRejectedBeforeCastingOrSpendingTurn();
  testValorSkillSchemaIsValidatedExplicitly();

  console.log("Valor and escape rules regression tests passed.");
}

run();
