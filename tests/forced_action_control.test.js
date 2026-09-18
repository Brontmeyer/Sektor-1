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
const skills = readData("Skills.json");
const enemiesData = readData("Enemies.json");

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
    skills,
    statusByKey(key) {
      return statuses.find((status) => status?.key === key) || null;
    },
    actor(id) {
      return actors[id] || null;
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
    enemy(id) {
      return enemiesData[id] || null;
    },
  };
}

function loadBattleClasses(random = Math.random) {
  const math = Object.create(Math);
  math.random = random;

  return loadClasses(
    [
      "js/objects/Game_Battler.js",
      "js/objects/Game_Actor.js",
      "js/battle/BattleTargetManager.js",
      "js/battle/BattleManager.js",
    ],
    "{ Game_Battler, Game_Actor, BattleTargetManager, BattleManager }",
    {
      DatabaseManager: makeDatabaseManager(),
      DebugManager: { log() {} },
      Math: math,
      $gameParty: null,
    },
  );
}

function makeBattleFixture({ random = () => 0, partyCount = 2, enemyCount = 2 } = {}) {
  const math = Object.create(Math);
  math.random = random;

  const context = vm.createContext({
    console,
    DatabaseManager: makeDatabaseManager(),
    DebugManager: { log() {} },
    Math: math,
  });
  const source = [
    "js/objects/Game_Battler.js",
    "js/objects/Game_Actor.js",
    "js/objects/Game_Enemy.js",
    "js/battle/BattleTargetManager.js",
    "js/battle/BattleManager.js",
  ]
    .map((relativePath) =>
      fs.readFileSync(path.join(projectRoot, relativePath), "utf8"),
    )
    .join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__loadedClasses = { Game_Battler, Game_Actor, Game_Enemy, BattleTargetManager, BattleManager };`,
    context,
  );

  const { Game_Battler, Game_Actor, Game_Enemy, BattleTargetManager, BattleManager } =
    context.__loadedClasses;
  const party = Array.from({ length: partyCount }, (_, index) => {
    const actor = new Game_Actor(Math.min(index + 1, actors.length - 1));
    actor.name = `Actor ${index + 1}`;
    actor.attackPercent = 100;
    return actor;
  });
  const enemies = Array.from({ length: enemyCount }, (_, index) => {
    const enemy = new Game_Enemy(1);
    enemy.name = `Enemy ${index + 1}`;
    enemy.attackPercent = 100;
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
  const popups = [];
  const partyController = {
    activeBattler: party[0],
    currentBattler() {
      return this.activeBattler;
    },
  };
  const scene = {
    partyController,
    enemies,
    enemy: enemies[0],
    selectedEnemyIndex: 0,
    selectedAllyIndex: 0,
    targetGroup: "enemy",
    targetScope: "single",
    pendingAttackTarget: null,
    pendingAttackDamage: false,
    pendingMagicSkill: null,
    pendingMagicTarget: null,
    enemyTargetAction: null,
    selectingEnemyTarget: false,
    battleInputLocked: false,
    actionPhase: "none",
    outcome: null,
    victory: false,
    defeat: false,
    enemyTurnIndex: 0,
    pendingEnemyTurn: false,
    enemyTurnDelay: 0,
    addBattleMessage(message) {
      messages.push(message);
    },
    addBattlePopup(target, text, type) {
      popups.push({ target, text, type });
    },
    setActorState() {},
    setEnemyState() {},
    setActionPhase(phase) {
      this.actionPhase = phase;
    },
  };

  scene.targetManager = new BattleTargetManager(scene);
  const manager = new BattleManager(scene);

  return {
    context,
    Game_Battler,
    Game_Actor,
    BattleTargetManager,
    BattleManager,
    party,
    enemies,
    scene,
    manager,
    messages,
    popups,
  };
}

function testStatusControlFlagsAreDataDriven() {
  const fixture = makeBattleFixture({ partyCount: 1, enemyCount: 1 });
  const actor = fixture.party[0];

  actor.addStatus("confuse");
  assert.equal(actor.forcesRandomTarget(), true);
  assert.equal(actor.forcesPhysicalAttack(), false);
  assert.equal(actor.isPlayerControlled(), true);

  actor.addStatus("berserk");
  assert.equal(actor.forcesPhysicalAttack(), true);
  assert.equal(actor.isPlayerControlled(), false);
}

function testBerserkStartsForcedPhysicalAttack() {
  const fixture = makeBattleFixture({ partyCount: 1, enemyCount: 1 });
  const actor = fixture.party[0];
  const target = fixture.enemies[0];

  actor.addStatus("berserk");

  assert.equal(fixture.manager.startForcedPartyAction(() => 0), true);
  assert.equal(fixture.scene.pendingAttackTarget, target);
  assert.equal(fixture.scene.pendingAttackDamage, true);
  assert.equal(fixture.scene.battleInputLocked, true);
  assert.equal(fixture.scene.actionPhase, "lunge");
  assert.equal(
    fixture.messages.some((message) => message.includes("attacks uncontrollably")),
    true,
  );
}

function testBerserkAndConfuseCanForceFriendlyFire() {
  const fixture = makeBattleFixture({ partyCount: 2, enemyCount: 1 });
  const actor = fixture.party[0];
  const ally = fixture.party[1];

  actor.addStatus("berserk");
  actor.addStatus("confuse");

  // Candidate order is living party first, then living enemies.
  assert.equal(fixture.manager.startForcedPartyAction(() => 0.34), true);
  assert.equal(fixture.scene.pendingAttackTarget, ally);
  assert.equal(fixture.scene.targetGroup, "ally");
}

function testConfuseRandomizesChosenAttackTarget() {
  const fixture = makeBattleFixture({ random: () => 0.34, partyCount: 2, enemyCount: 1 });
  const actor = fixture.party[0];
  const ally = fixture.party[1];

  actor.addStatus("confuse");
  fixture.scene.commandWindow = {
    currentCommand() {
      return "Attack";
    },
    commandActionKey() {
      return "attack";
    },
  };

  fixture.manager.executeCommand();

  assert.equal(fixture.scene.pendingAttackTarget, ally);
  assert.equal(fixture.scene.selectingEnemyTarget, false);
  assert.equal(
    fixture.messages.some((message) => message.includes("is confused and lashes out")),
    true,
  );
}

function testConfuseRandomizesSingleTargetMagic() {
  const fixture = makeBattleFixture({ random: () => 0.75, partyCount: 2, enemyCount: 2 });
  const actor = fixture.party[0];
  const skill = skills[10]; // Ember supports ally/enemy and single/all.

  actor.learnSkill(skill.id);
  actor.addStatus("confuse");
  fixture.scene.magicWindow = {
    currentSkill() {
      return skill;
    },
    hide() {},
  };
  fixture.scene.setActorState = () => {};

  fixture.manager.executeMagic();

  assert.ok(fixture.scene.pendingMagicTarget);
  assert.equal(fixture.scene.selectingEnemyTarget, false);
  assert.equal(fixture.scene.battleInputLocked, true);
  assert.equal(fixture.scene.actionPhase, "magicCast");
  assert.equal(
    fixture.messages.some((message) => message.includes("is confused and targets")),
    true,
  );
}

function testConfuseRandomizesAllTargetOnlyGroup() {
  const originalScope = skills[10].scope;
  skills[10].scope = ["all"];

  try {
    const fixture = makeBattleFixture({
      random: () => 0.75,
      partyCount: 2,
      enemyCount: 2,
    });
    const actor = fixture.party[0];
    const skill = skills[10];

    actor.learnSkill(skill.id);
    actor.addStatus("confuse");
    fixture.scene.magicWindow = {
      currentSkill() {
        return skill;
      },
      hide() {},
    };

    fixture.manager.executeMagic();

    assert.equal(fixture.scene.targetScope, "all");
    assert.equal(fixture.scene.targetGroup, "enemy");
    assert.equal(fixture.scene.pendingMagicTarget, null);
    assert.equal(fixture.scene.selectingEnemyTarget, false);
    assert.equal(fixture.scene.actionPhase, "magicCast");
  } finally {
    skills[10].scope = originalScope;
  }
}

function testConfusedEnemyCanAttackItsOwnSide() {
  const fixture = makeBattleFixture({ random: () => 0.6, partyCount: 1, enemyCount: 2 });
  const attacker = fixture.enemies[0];

  attacker.addStatus("confuse");
  fixture.manager.completeEnemyTurn = () => true;

  const hpBefore = attacker.hp;
  fixture.manager.performEnemyTurn(attacker);

  assert.ok(attacker.hp < hpBefore);
  assert.equal(
    fixture.messages.some((message) => message.includes(`${attacker.name} attacks!`)),
    true,
  );
}

function testBattleManagerRejectsManualCommandWhileBerserk() {
  const fixture = makeBattleFixture({ partyCount: 1, enemyCount: 1 });
  const actor = fixture.party[0];
  actor.addStatus("berserk");

  fixture.scene.commandWindow = {
    currentCommand() {
      return "Magic";
    },
    commandActionKey() {
      return "magic";
    },
  };
  let magicOpened = false;
  fixture.scene.magicWindow = {
    show() {
      magicOpened = true;
    },
  };

  fixture.manager.executeCommand();

  assert.equal(magicOpened, false);
  assert.equal(
    fixture.messages.at(-1),
    `${actor.name} cannot use Magic right now!`,
  );
}

function testBerserkCommandWindowIsNotPlayerControllable() {
  const fixture = makeBattleFixture({ partyCount: 1, enemyCount: 1 });
  const actor = fixture.party[0];
  actor.addStatus("berserk");

  const Window_BattleCommand = loadClasses(
    ["js/windows/Window_BattleCommand.js"],
    "Window_BattleCommand",
    {
      Graphics: { height: 720, context: {} },
      Input: { isTriggered() { return false; } },
    },
  );
  const window = new Window_BattleCommand({
    partyController: {
      currentBattler() {
        return actor;
      },
    },
  });

  assert.equal(window.isCommandEnabled("Attack"), false);
  assert.equal(window.isCommandEnabled("Magic"), false);
  assert.equal(window.isCommandEnabled("Item"), false);
  assert.equal(window.isCommandEnabled("Defend"), false);
  assert.equal(window.ensureEnabledSelection(), false);
}

function testForcedActionMetadataValidation() {
  const { DatabaseValidator } = loadClasses(
    ["js/core/DatabaseValidator.js"],
    "{ DatabaseValidator }",
    { DebugManager: { log() {} } },
  );

  const validErrors = [];
  DatabaseValidator.validateStatuses(statuses, validErrors);
  assert.deepEqual(Array.from(validErrors), []);

  const invalid = JSON.parse(JSON.stringify(statuses));
  invalid[11].effects.forceRandomTarget = "yes";
  invalid[15].effects.playerControl = "no";
  invalid[15].effects.forcePhysicalAttack = 1;
  const errors = [];

  DatabaseValidator.validateStatuses(invalid, errors);

  assert.equal(errors.some((error) => error.includes("forceRandomTarget")), true);
  assert.equal(errors.some((error) => error.includes("playerControl")), true);
  assert.equal(errors.some((error) => error.includes("forcePhysicalAttack")), true);
}

testStatusControlFlagsAreDataDriven();
testBerserkStartsForcedPhysicalAttack();
testBerserkAndConfuseCanForceFriendlyFire();
testConfuseRandomizesChosenAttackTarget();
testConfuseRandomizesSingleTargetMagic();
testConfuseRandomizesAllTargetOnlyGroup();
testConfusedEnemyCanAttackItsOwnSide();
testBattleManagerRejectsManualCommandWhileBerserk();
testBerserkCommandWindowIsNotPlayerControllable();
testForcedActionMetadataValidation();

console.log("Forced action control regression tests passed.");
