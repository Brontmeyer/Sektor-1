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
    skills: readData("Skills.json"),
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
  }

  const { Class: Scene_Battle } = loadClass(
    "js/scenes/Scene_Battle.js",
    "Scene_Battle",
    {
      Scene_Base,
      Game_Enemy,
      Image: class {},
      Window_BattleCommand: EmptySystem,
      Window_BattleMagic: EmptySystem,
      Window_BattleItem: EmptySystem,
      BattleTargetManager: EmptySystem,
      BattleEffects: EmptySystem,
      BattleAnimationController: EmptySystem,
      BattleManager,
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

  scene.finishBattle("victory");
  scene.finishBattle("escape");
  assert.deepEqual(results, ["victory"]);
  assert.equal(popCount, 1);
}

function testInterpreterPausesForBattle() {
  const encounterIds = [];
  const messages = [];
  const { Class: Game_Interpreter } = loadClass(
    "js/objects/Game_Interpreter.js",
    "Game_Interpreter",
    {
      DebugManager: { log() {} },
      SceneManager: {
        startBattle(encounterId) {
          encounterIds.push(encounterId);
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

  interpreter.setup([
    { code: "battle", encounterId: 1 },
    { code: "text", speaker: "System", text: "Battle complete." },
  ]);
  interpreter.update();

  assert.deepEqual(encounterIds, [1]);
  assert.equal(interpreter.index, 1);
  assert.equal(interpreter.isRunning(), true);

  interpreter.update();
  assert.equal(messages.length, 1);
  assert.equal(messages[0].text, "Battle complete.");
  assert.equal(interpreter.isRunning(), true);

  interpreter.update();
  assert.equal(interpreter.isRunning(), false);
}

testEncounterValidation();
testProjectDatabaseValidation();
testBattleEntryApi();
testBattleSceneConstructionAndExit();
testInterpreterPausesForBattle();

console.log("Battle encounter regression tests passed.");
