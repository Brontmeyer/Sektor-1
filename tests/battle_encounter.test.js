"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");

function loadClass(relativePath, className, globals = {}) {
  const filename = path.join(projectRoot, relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const context = vm.createContext({ console, ...globals });

  vm.runInContext(
    `${source}\nglobalThis.__loadedClass = ${className};`,
    context,
    { filename },
  );

  return { Class: context.__loadedClass, context };
}

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

  return { classes: context.__loadedClasses, context };
}

function testEncounterValidation() {
  const { Class: DatabaseValidator } = loadClass(
    "js/core/DatabaseValidator.js",
    "DatabaseValidator",
  );
  const enemies = [null, { id: 1, name: "Test Slime" }];
  const validEncounters = [
    null,
    {
      id: 1,
      name: "Test",
      canEscape: true,
      members: [
        { enemyId: 1, slot: 0 },
        { enemyId: 1, slot: 1 },
      ],
    },
  ];
  const validErrors = [];

  DatabaseValidator.validateEncounters(validEncounters, enemies, validErrors);
  assert.deepEqual(validErrors, []);

  const invalidErrors = [];
  const invalidEncounters = [
    null,
    {
      id: 1,
      name: "Broken",
      canEscape: "yes",
      members: [
        { enemyId: 99, slot: 0 },
        { enemyId: 1, slot: 0 },
      ],
    },
  ];

  DatabaseValidator.validateEncounters(
    invalidEncounters,
    enemies,
    invalidErrors,
  );
  assert.equal(invalidErrors.length, 3);
}

function testEnemyRewardValidation() {
  const { Class: DatabaseValidator } = loadClass(
    "js/core/DatabaseValidator.js",
    "DatabaseValidator",
  );
  const readData = (filename) =>
    JSON.parse(fs.readFileSync(path.join(projectRoot, "data", filename), "utf8"));
  const baseEnemy = readData("Enemies.json")[1];
  const validErrors = [];

  DatabaseValidator.validateEnemies(
    [null, { ...baseEnemy, expReward: 25 }],
    validErrors,
  );
  assert.deepEqual(validErrors, []);

  const invalidErrors = [];
  DatabaseValidator.validateEnemies(
    [
      null,
      { ...baseEnemy, id: 1, expReward: undefined },
      { ...baseEnemy, id: 2, expReward: -1 },
      { ...baseEnemy, id: 3, expReward: "50" },
      { ...baseEnemy, id: 4, expReward: 2.5 },
    ],
    invalidErrors,
  );
  assert.equal(
    invalidErrors.filter((error) => error.includes("expReward")).length,
    4,
  );
}

function testProjectDatabaseValidation() {
  const { Class: DatabaseValidator } = loadClass(
    "js/core/DatabaseValidator.js",
    "DatabaseValidator",
    { DebugManager: { log() {} } },
  );
  const readData = (filename) =>
    JSON.parse(fs.readFileSync(path.join(projectRoot, "data", filename), "utf8"));
  const database = {
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
    valorArts: readData("Valor.json"),
    essences: readData("Essences.json"),
    statuses: readData("Statuses.json"),
  };

  assert.equal(DatabaseValidator.validate(database), true);
}

function testBattleEntryApi() {
  const encounter = {
    id: 1,
    name: "Test",
    canEscape: true,
    members: [{ enemyId: 1, slot: 0 }],
  };
  class Scene_Battle {
    constructor(receivedEncounter, onComplete) {
      this.encounter = receivedEncounter;
      this.onComplete = onComplete;
      this.started = false;
    }

    start() {
      this.started = true;
    }
  }

  const { Class: SceneManager } = loadClass(
    "js/core/SceneManager.js",
    "SceneManager",
    {
      DatabaseManager: {
        encounter(id) {
          return id === 1 ? encounter : null;
        },
      },
      DebugManager: { log() {} },
      Scene_Battle,
    },
  );

  SceneManager.initialize();
  const mapScene = { constructor: { name: "Scene_Map" } };
  SceneManager.currentScene = mapScene;

  assert.equal(SceneManager.startBattle(1), true);
  assert.equal(SceneManager.sceneStack[0], mapScene);
  assert.equal(SceneManager.currentScene.encounter, encounter);
  assert.equal(SceneManager.currentScene.started, true);
  assert.equal(SceneManager.startBattle(999), false);
}

function testBattleSceneConstructionAndExit() {
  let popCount = 0;
  const results = [];

  class Scene_Base {
    start() {}
    terminate() {}
  }

  class Game_Enemy {
    constructor(enemyId) {
      this.enemyId = enemyId;
      this.name = `Enemy ${enemyId}`;
      this.battleSprite = null;
    }
  }

  class EmptySystem {
    constructor() {}
  }

  class BattleManager extends EmptySystem {
    static TURN_COMMAND = "command";

    constructor(scene) {
      super();
      this.scene = scene;
      this.finalResult = null;
    }

    finalizeBattle(outcome) {
      if (this.finalResult) {
        return this.finalResult;
      }

      this.scene.outcome = outcome;
      this.finalResult = {
        outcome,
        rewards: { exp: 0, currency: 0, drops: [], resonance: 0 },
      };
      this.scene.result = this.finalResult;
      return this.finalResult;
    }
  }

  const { Class: Scene_Battle } = loadClass(
    "js/scenes/Scene_Battle.js",
    "Scene_Battle",
    {
      Scene_Base,
      Game_Enemy,
      Image: class {},
      Window_BattleCommand: EmptySystem,
      Window_BattleMagick: EmptySystem,
      Window_BattleSkills: EmptySystem,
      Window_BattleItem: EmptySystem,
      Window_BattleResults: EmptySystem,
      BattleTargetManager: EmptySystem,
      BattleScanManager: EmptySystem,
      BattleEffects: EmptySystem,
      BattleAnimationController: EmptySystem,
      BattleManager,
      BattleTimeManager: class {
        constructor(scene) {
          this.scene = scene;
        }

        initialize() {}
        update() {}
      },
      BattleHudLayout: class {
        constructor(scene) {
          this.scene = scene;
        }
      },
      BattleFormationManager: class {
        constructor(scene) {
          this.scene = scene;
        }

        enemyPosition(index) {
          const positions = [
            { x: 900, y: 400 },
            { x: 800, y: 290 },
            { x: 920, y: 220 },
          ];
          return positions[this.scene.encounter.members[index]?.slot] || positions[0];
        }
      },
      BattlePartyController: EmptySystem,
      BattleRenderer: EmptySystem,
      DatabaseManager: { system: { battleView: "side" } },
      Graphics: { width: 1000, height: 720 },
      DebugManager: { log() {} },
      SceneManager: {
        pop() {
          popCount++;
        },
      },
      $gameParty: { battleMembers: () => [] },
    },
  );
  const encounter = {
    id: 1,
    name: "Test",
    canEscape: true,
    members: [
      { enemyId: 1, slot: 1 },
      { enemyId: 1, slot: 0 },
    ],
  };
  const scene = new Scene_Battle(encounter, (result) => results.push(result));

  assert.deepEqual(
    scene.enemies.map((enemy) => enemy.enemyId),
    [1, 1],
  );
  const position = scene.getEnemyBattlePosition(0);
  assert.equal(position.x, 800);
  assert.equal(position.y, 290);

  const firstResult = scene.finishBattle("victory");
  const secondResult = scene.finishBattle("escape");
  assert.equal(firstResult.outcome, "victory");
  assert.equal(secondResult, firstResult);
  assert.equal(results.length, 1);
  assert.equal(results[0], firstResult);
  assert.equal(popCount, 1);
}

function testInterpreterPausesForBattle() {
  const encounterIds = [];
  const messages = [];
  let battleCallback = null;
  const { Class: Game_Interpreter } = loadClass(
    "js/objects/Game_Interpreter.js",
    "Game_Interpreter",
    {
      DebugManager: { log() {} },
      SceneManager: {
        startBattle(encounterId, onComplete) {
          encounterIds.push(encounterId);
          battleCallback = onComplete;
          return true;
        },
      },
    },
  );
  const messageWindow = {
    isOpen: () => false,
    show(text, speaker) {
      messages.push({ text, speaker });
    },
  };
  const choiceWindow = {
    isOpen: () => false,
    hasResult: () => false,
  };
  const interpreter = new Game_Interpreter(messageWindow, choiceWindow);
  const event = { id: 7 };

  interpreter.setup(
    [
      { code: "battle", encounterId: 1 },
      { code: "text", speaker: "System", text: "Battle complete." },
    ],
    event,
  );
  interpreter.update();

  assert.deepEqual(encounterIds, [1]);
  assert.equal(interpreter.index, 1);
  assert.equal(interpreter.isRunning(), true);

  const result = {
    outcome: "victory",
    rewards: { exp: 50, currency: 0, drops: [], resonance: 0 },
  };
  battleCallback(result);

  assert.equal(interpreter.battleResult(), result);
  assert.equal(event.lastBattleResult, result);

  interpreter.update();
  assert.equal(messages.length, 1);
  assert.equal(messages[0].text, "Battle complete.");
  assert.equal(interpreter.isRunning(), true);

  interpreter.update();
  assert.equal(interpreter.isRunning(), false);
}

function makeResolutionActor({ id, name, hp = 100, mp = 20, level = 1 }) {
  return {
    actorId: id,
    name,
    hp,
    mp,
    level,
    exp: 0,
    gainExpCalls: 0,
    restoreCalls: 0,
    isDead() {
      return this.hp <= 0;
    },
    gainExp(amount) {
      this.gainExpCalls++;
      this.exp += amount;
      return 0;
    },
    restorePostBattleState(snapshot) {
      this.restoreCalls++;
      this.hp = snapshot.wasDefeated ? 1 : snapshot.hp;
      this.mp = snapshot.mp;

      return {
        wasDefeated: snapshot.wasDefeated,
        hp: this.hp,
        mp: this.mp,
        removedStatuses: [],
        persistentStatuses: [],
      };
    },
  };
}

function makeResolutionEnemy(enemyId, name, expReward, dead = true) {
  return {
    enemyId,
    name,
    expReward,
    isDead: () => dead,
  };
}

function loadBattleManagerForParty(party) {
  return loadClasses(
    ["js/battle/BattleEnemyAI.js", "js/battle/BattleManager.js"],
    "{ BattleManager }",
    {
      DebugManager: { log() {} },
      $gameParty: party,
    },
  ).classes.BattleManager;
}

function testBattleResolutionAwardsActivePartyExactlyOnce() {
  const tyler = makeResolutionActor({ id: 1, name: "Tyler", hp: 72 });
  const sarah = makeResolutionActor({ id: 2, name: "Sarah", hp: 0 });
  const reserve = makeResolutionActor({ id: 3, name: "Reserve", hp: 100 });
  const activeMembers = [tyler, sarah];
  const party = {
    battleMembers: () => activeMembers,
    livingBattleMembers: () => activeMembers.filter((actor) => !actor.isDead()),
  };
  const BattleManager = loadBattleManagerForParty(party);
  const messages = [];
  const scene = {
    encounter: { id: 12, name: "Two Slimes", canEscape: true },
    enemies: [
      makeResolutionEnemy(1, "Slime A", 20),
      makeResolutionEnemy(1, "Slime B", 30),
    ],
    outcome: null,
    result: null,
    victory: false,
    defeat: false,
    pendingEnemyTurn: true,
    enemyTurnDelay: 1,
    battleInputLocked: true,
    addBattleMessage(message) {
      messages.push(message);
    },
  };
  const manager = new BattleManager(scene);

  const first = manager.finalizeBattle("victory");
  const second = manager.finalizeBattle("victory");

  assert.equal(second, first);
  assert.equal(first.outcome, "victory");
  assert.equal(first.rewards.exp, 50);
  assert.equal(first.rewards.currency, 0);
  assert.deepEqual(Array.from(first.rewards.drops), []);
  assert.equal(first.rewards.resonance, 0);
  assert.equal(first.defeatedEnemies.length, 2);
  assert.equal(tyler.exp, 50);
  assert.equal(sarah.exp, 50);
  assert.equal(reserve.exp, 0);
  assert.equal(tyler.gainExpCalls, 1);
  assert.equal(sarah.gainExpCalls, 1);
  assert.equal(reserve.gainExpCalls, 0);
  assert.equal(tyler.hp, 72);
  assert.equal(sarah.hp, 1);
  assert.equal(tyler.restoreCalls, 1);
  assert.equal(sarah.restoreCalls, 1);
  assert.deepEqual(messages, ["Victory!"]);
}

function testBattleResolutionNoRewardsForDefeatOrEscape() {
  for (const outcome of ["defeat", "escape"]) {
    const actor = makeResolutionActor({ id: 1, name: "Tyler", hp: 10 });
    const party = {
      battleMembers: () => [actor],
      livingBattleMembers: () => (actor.isDead() ? [] : [actor]),
    };
    const BattleManager = loadBattleManagerForParty(party);
    const scene = {
      encounter: { id: 1, name: "Test", canEscape: true },
      enemies: [makeResolutionEnemy(1, "Test Slime", 999)],
      outcome: null,
      result: null,
      victory: false,
      defeat: false,
      pendingEnemyTurn: false,
      enemyTurnDelay: 0,
      battleInputLocked: false,
      addBattleMessage() {},
    };
    const manager = new BattleManager(scene);
    const result = manager.finalizeBattle(outcome);

    assert.equal(result.outcome, outcome);
    assert.equal(result.rewards.exp, 0);
    assert.equal(result.rewards.currency, 0);
    assert.deepEqual(Array.from(result.rewards.drops), []);
    assert.equal(result.rewards.resonance, 0);
    assert.equal(actor.exp, 0);
    assert.equal(actor.gainExpCalls, 0);
  }
}

function testRealActorBattleResolutionPreservesPostBattleState() {
  const actors = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "data", "Actors.json"), "utf8"),
  );
  const statuses = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "data", "Statuses.json"), "utf8"),
  );
  const activeMembers = [];
  const party = {
    battleMembers: () => activeMembers,
    livingBattleMembers: () => activeMembers.filter((actor) => actor.isAlive()),
  };
  const DatabaseManager = {
    statuses,
    actor(actorId) {
      return actors[actorId] || null;
    },
    weapon() {
      return null;
    },
    armor() {
      return null;
    },
    magick() {
      return null;
    },
  };
  const { classes } = loadClasses(
    [
      "js/objects/Game_Battler.js",
      "js/objects/Game_Actor.js",
      "js/battle/BattleEnemyAI.js",
      "js/battle/BattleManager.js",
    ],
    "{ Game_Actor, BattleManager }",
    {
      DatabaseManager,
      DebugManager: { log() {} },
      $gameParty: party,
    },
  );
  const tyler = new classes.Game_Actor(1);
  const sarah = new classes.Game_Actor(2);
  const reserve = new classes.Game_Actor(3);

  activeMembers.push(tyler, sarah);
  tyler.setHp(275);
  tyler.mp = 61;
  sarah.addStatus("poison");
  sarah.addStatus("fury");
  sarah.setHp(0);
  sarah.mp = 19;

  const scene = {
    encounter: { id: 1, name: "Integration Battle" },
    enemies: [
      makeResolutionEnemy(1, "Slime A", 50),
      makeResolutionEnemy(1, "Slime B", 50),
    ],
    outcome: null,
    result: null,
    victory: false,
    defeat: false,
    pendingEnemyTurn: false,
    enemyTurnDelay: 0,
    battleInputLocked: false,
    addBattleMessage() {},
  };
  const manager = new classes.BattleManager(scene);
  const result = manager.finalizeBattle("victory");

  assert.equal(result.rewards.exp, 100);
  assert.equal(tyler.level, 2);
  assert.equal(sarah.level, 2);
  assert.equal(reserve.level, 1);
  assert.equal(tyler.exp, 0);
  assert.equal(sarah.exp, 0);
  assert.equal(reserve.exp, 0);
  assert.equal(tyler.hp, 275);
  assert.equal(tyler.mp, 61);
  assert.equal(sarah.hp, 1);
  assert.equal(sarah.mp, 19);
  assert.equal(sarah.hasStatus("poison"), false);
  assert.equal(sarah.hasStatus("fury"), true);
}

function testPostBattleStatusCleanupPreservesPersistentStatuses() {
  const statuses = [
    null,
    {
      key: "poison",
      classification: { persistsAfterBattle: false },
      duration: { type: "untilRemoved" },
      effects: {},
    },
    {
      key: "fury",
      classification: { persistsAfterBattle: true },
      duration: { type: "untilRemoved" },
      effects: {},
    },
  ];
  const { Class: Game_Battler } = loadClass(
    "js/objects/Game_Battler.js",
    "Game_Battler",
    {
      DatabaseManager: { statuses },
      DebugManager: { log() {} },
    },
  );
  const battler = new Game_Battler({ name: "Tyler", maxHp: 100, maxMp: 20 });

  battler.addStatus("poison");
  battler.addStatus("fury");
  battler.startDefending();
  battler.setHp(0);

  const restored = battler.restorePostBattleState({
    hp: 0,
    mp: 7,
    wasDefeated: true,
  });

  assert.equal(battler.hp, 1);
  assert.equal(battler.mp, 7);
  assert.equal(battler.isDefending(), false);
  assert.equal(battler.hasStatus("poison"), false);
  assert.equal(battler.hasStatus("fury"), true);
  assert.deepEqual(Array.from(restored.removedStatuses), ["poison"]);
  assert.deepEqual(Array.from(restored.persistentStatuses), ["fury"]);
}

testEncounterValidation();
testEnemyRewardValidation();
testProjectDatabaseValidation();
testBattleEntryApi();
testBattleSceneConstructionAndExit();
testInterpreterPausesForBattle();
testBattleResolutionAwardsActivePartyExactlyOnce();
testBattleResolutionNoRewardsForDefeatOrEscape();
testRealActorBattleResolutionPreservesPostBattleState();
testPostBattleStatusCleanupPreservesPersistentStatuses();

console.log("Battle encounter and resolution regression tests passed.");
