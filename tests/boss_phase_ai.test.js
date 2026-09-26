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
const items = readData("Items.json");
const magick = readData("Magick.json");
const skills = readData("Skills.json");
const statuses = readData("Statuses.json");

function createFixture() {
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
    skillName(id) {
      return skills[id]?.name || `Unknown Skill ${id}`;
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
  const party = [new Game_Actor(1)];
  const boss = new Game_Enemy(2);
  const messages = [];

  context.$gameParty = {
    battleMembers() {
      return party;
    },
    livingBattleMembers() {
      return party.filter((actor) => !actor.isDefeated());
    },
  };

  const scene = {
    enemies: [boss],
    enemyTurnIndex: 0,
    pendingEnemyTurn: false,
    enemyTurnDelay: 0,
    outcome: null,
    victory: false,
    defeat: false,
    battleInputLocked: false,
    partyController: {
      currentBattler() {
        return party[0];
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

  return { context, party, boss, scene, manager, messages };
}

function testBossStartsInOpeningPhaseAndUsesOnlyItsActionPool() {
  const { boss, manager } = createFixture();

  assert.equal(boss.currentPhase().id, "opening");
  assert.deepEqual(
    boss.actionDefinitions().map((action) => action.type),
    ["attack", "skill", "magick"],
  );
  assert.equal(boss.actionDefinitions().some((action) => action.magickId === 1), false);

  // Knowledge spans every configured phase even though AI selection only sees
  // the active phase's action pool.
  assert.equal(boss.knowsMagick(1), true);
  assert.equal(boss.knowsSkill(5), true);

  const usable = manager.enemyAI.usableActions(boss);
  assert.equal(usable.some((action) => action.magickId === 1), false);
}

function testHpThresholdsAdvancePhasesWithoutRevertingAfterHealing() {
  const { boss, manager, messages } = createFixture();

  boss.setHp(Math.floor(boss.maxHp * 0.6));
  const pressure = manager.refreshEnemyPhase(boss);

  assert.equal(pressure.changed, true);
  assert.equal(pressure.from.id, "opening");
  assert.equal(pressure.to.id, "pressure");
  assert.equal(boss.actionDefinitions().some((action) => action.magickId === 1), true);
  assert.equal(messages.at(-1), "Test Slime Alpha tightens its rhythm!");

  boss.setHp(boss.maxHp);
  const noRevert = manager.refreshEnemyPhase(boss);
  assert.equal(noRevert.changed, false);
  assert.equal(boss.currentPhase().id, "pressure");

  boss.setHp(Math.floor(boss.maxHp * 0.2));
  const frenzy = manager.refreshEnemyPhase(boss);
  assert.equal(frenzy.changed, true);
  assert.equal(frenzy.from.id, "pressure");
  assert.equal(frenzy.to.id, "frenzy");
  assert.equal(messages.at(-1), "Test Slime Alpha erupts into a frenzy!");
  assert.equal(boss.actionDefinitions().some((action) => action.magickId === 1), false);

  const messageCount = messages.length;
  const repeated = manager.refreshEnemyPhase(boss);
  assert.equal(repeated.changed, false);
  assert.equal(messages.length, messageCount);
}

function testLargeHpDropCanAdvanceDirectlyToTheDeepestEligiblePhase() {
  const { boss, manager } = createFixture();

  boss.setHp(Math.floor(boss.maxHp * 0.1));
  const transition = manager.refreshEnemyPhase(boss);

  assert.equal(transition.changed, true);
  assert.equal(transition.from.id, "opening");
  assert.equal(transition.to.id, "frenzy");
  assert.equal(boss.currentPhase().id, "frenzy");
}

function testPhaseSchemaValidationRejectsAmbiguousOrMalformedBossData() {
  const validatorSource = fs.readFileSync(
    path.join(projectRoot, "js/core/DatabaseValidator.js"),
    "utf8",
  );
  const context = vm.createContext({ console, DebugManager: { log() {} } });
  vm.runInContext(
    `${validatorSource}\nglobalThis.__DatabaseValidator = DatabaseValidator;`,
    context,
  );

  const invalid = clone(enemies);
  invalid[2].actions = [];
  invalid[2].phases[0].hpRateAtOrBelow = 0.9;
  invalid[2].phases[1].id = "opening";
  invalid[2].phases[2].hpRateAtOrBelow = 0.7;
  invalid[2].phases[1].actions[0].weight = 0;
  invalid[2].phases[1].actions.push({
    type: "skill",
    skillId: 1,
    weight: 1,
    targetGroup: "enemy",
    targetStrategy: "first",
    scope: "single",
  });

  const errors = [];
  context.__DatabaseValidator.validateEnemies(
    invalid,
    items,
    errors,
    magick,
    skills,
  );

  assert.equal(
    errors.some((error) => error.includes("either actions or phases")),
    true,
  );
  assert.equal(
    errors.some((error) => error.includes("must be 1 for the opening phase")),
    true,
  );
  assert.equal(
    errors.some((error) => error.includes("must be unique within the enemy")),
    true,
  );
  assert.equal(
    errors.some((error) => error.includes("lower than the previous phase threshold")),
    true,
  );
  assert.equal(
    errors.some((error) => error.includes("weight must be a finite number")),
    true,
  );
  assert.equal(
    errors.some((error) => error.includes("must reference valid Skill")),
    true,
  );
}

function run() {
  testBossStartsInOpeningPhaseAndUsesOnlyItsActionPool();
  testHpThresholdsAdvancePhasesWithoutRevertingAfterHealing();
  testLargeHpDropCanAdvanceDirectlyToTheDeepestEligiblePhase();
  testPhaseSchemaValidationRejectsAmbiguousOrMalformedBossData();

  console.log("Boss phase AI regression tests passed.");
}

run();
