"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
const readData = (filename) =>
  JSON.parse(fs.readFileSync(path.join(projectRoot, "data", filename), "utf8"));
const clone = (value) => JSON.parse(JSON.stringify(value));

function loadClass(relativePath, className, globals = {}) {
  const context = vm.createContext({ console, ...globals });
  vm.runInContext(
    `${read(relativePath)}\nglobalThis.__Class = ${className};`,
    context,
    { filename: relativePath },
  );
  return { Class: context.__Class, context };
}

function testRegistryAndPrototypeAssets() {
  const backgrounds = readData("BattleBackgrounds.json");
  assert.equal(backgrounds[1].key, "devZone1");
  assert.equal(backgrounds[2].key, "devZone2");
  assert.notEqual(backgrounds[1].key, backgrounds[2].key);

  for (const background of backgrounds.filter(Boolean)) {
    const images = Array.isArray(background.layers)
      ? background.layers.map((layer) => layer.image)
      : [background.image];
    for (const image of images) {
      assert.equal(
        fs.existsSync(path.join(projectRoot, image)),
        true,
        `${image} must exist`,
      );
    }
  }
  assert.deepEqual(
    backgrounds[1].layers.map((layer) => path.basename(layer.image)),
    ["GrassMaze.png", "Forest.png"],
    "layered battlebacks draw the ground before the transparent upper scenery",
  );

  const map1 = readData("Map001.json");
  const map2 = readData("Map002.json");
  assert.equal(map1.battleBackgroundKey, "devZone1");
  assert.equal(map2.battleBackgroundKey, "devZone2");
  assert.equal(readData("System.json").defaultBattleBackgroundKey, "devZone1");
}

function testDatabaseAccessUsesStableKey() {
  const { Class: DatabaseManager } = loadClass(
    "js/core/DatabaseManager.js",
    "DatabaseManager",
  );
  DatabaseManager.battleBackgrounds = readData("BattleBackgrounds.json");

  const zone1 = DatabaseManager.battleBackgroundByKey("devZone1");
  assert.equal(zone1.id, 1);
  assert.equal(DatabaseManager.battleBackground(2).key, "devZone2");
  assert.equal(DatabaseManager.battleBackgroundByKey("missing"), null);

  zone1.name = "Renamed Presentation Only";
  assert.equal(DatabaseManager.battleBackgroundByKey("devZone1"), zone1);
}

function testBackgroundManagerPriorityFallbackAndCoverCrop() {
  const backgrounds = readData("BattleBackgrounds.json");
  const DatabaseManager = {
    system: { defaultBattleBackgroundKey: "devZone1" },
    battleBackgroundByKey(key) {
      return backgrounds.find((entry) => entry?.key === key) || null;
    },
  };
  const { Class: BattleBackgroundManager } = loadClass(
    "js/battle/BattleBackgroundManager.js",
    "BattleBackgroundManager",
    { DatabaseManager },
  );

  const encounterOverride = new BattleBackgroundManager(
    { encounter: { battleBackgroundKey: "devZone2" } },
    { battleBackgroundKey: "devZone1" },
  );
  assert.equal(encounterOverride.key, "devZone2");

  const mapDefault = new BattleBackgroundManager(
    { encounter: {} },
    { battleBackgroundKey: "devZone2" },
  );
  assert.equal(mapDefault.key, "devZone2");

  const systemDefault = new BattleBackgroundManager({ encounter: {} }, {});
  assert.equal(systemDefault.key, "devZone1");

  const calls = [];
  const context = {
    fillStyle: "",
    fillRect(...args) {
      calls.push(["fillRect", this.fillStyle, ...args]);
    },
    drawImage(...args) {
      calls.push(["drawImage", ...args]);
    },
  };
  systemDefault.image = {
    complete: true,
    naturalWidth: 1600,
    naturalHeight: 900,
  };
  assert.equal(systemDefault.draw(context, 1280, 720), true);
  assert.equal(calls[0][0], "fillRect", "fallback is painted before the image");
  assert.equal(calls[1][0], "drawImage");
  assert.equal(calls[1][4], 1600);
  assert.equal(calls[1][5], 900);
  assert.equal(calls[1][8], 1280);
  assert.equal(calls[1][9], 720);

  const fallbackCalls = [];
  const fallbackContext = {
    fillStyle: "",
    fillRect(...args) {
      fallbackCalls.push([this.fillStyle, ...args]);
    },
  };
  systemDefault.image = null;
  assert.equal(systemDefault.draw(fallbackContext, 1280, 720), false);
  assert.equal(fallbackCalls[0][0], backgrounds[1].fallbackColor);
}


function testLayeredBackgroundDrawsBottomToTop() {
  const backgrounds = readData("BattleBackgrounds.json");
  const DatabaseManager = {
    system: { defaultBattleBackgroundKey: "devZone1" },
    battleBackgroundByKey(key) {
      return backgrounds.find((entry) => entry?.key === key) || null;
    },
  };

  class FakeImage {
    constructor() {
      this.complete = true;
      this.naturalWidth = 1000;
      this.naturalHeight = 740;
      this.loadFailed = false;
      this._src = "";
    }
    set src(value) { this._src = value; }
    get src() { return this._src; }
  }

  const { Class: BattleBackgroundManager } = loadClass(
    "js/battle/BattleBackgroundManager.js",
    "BattleBackgroundManager",
    { DatabaseManager, Image: FakeImage },
  );
  const manager = new BattleBackgroundManager({ encounter: {} }, {});
  assert.equal(manager.layers.length, 2);
  assert.match(manager.layers[0].image.src, /GrassMaze\.png$/);
  assert.match(manager.layers[1].image.src, /Forest\.png$/);

  const calls = [];
  const context = {
    fillStyle: "",
    fillRect() {},
    drawImage(image) { calls.push(image.src); },
  };
  assert.equal(manager.draw(context, 1280, 720), true);
  assert.match(calls[0], /GrassMaze\.png$/);
  assert.match(calls[1], /Forest\.png$/);
}

function testGameMapCarriesStableBackgroundKey() {
  const { Class: Game_Map } = loadClass(
    "js/objects/Game_Map.js",
    "Game_Map",
    { DebugManager: { log() {} }, Game_Event: class {} },
  );
  const map = new Game_Map({
    id: 2,
    name: "Renamed Zone",
    width: 100,
    height: 100,
    playerStart: { x: 0, y: 0 },
    battleBackgroundKey: "devZone2",
    obstacles: [],
    transfers: [],
    events: [],
  });
  assert.equal(map.battleBackgroundKey, "devZone2");
}

function testSceneManagerCarriesMapContextIntoBattle() {
  const encounter = { id: 1, name: "Test", members: [], canEscape: true };
  class Scene_Battle {
    constructor(receivedEncounter, onComplete, battleContext) {
      this.encounter = receivedEncounter;
      this.onComplete = onComplete;
      this.battleContext = battleContext;
    }
    start() {}
    terminate() {}
  }
  const { Class: SceneManager } = loadClass(
    "js/core/SceneManager.js",
    "SceneManager",
    {
      DatabaseManager: { encounter: (id) => (id === 1 ? encounter : null) },
      DebugManager: { log() {} },
      Scene_Battle,
    },
  );

  SceneManager.initialize();
  SceneManager.currentScene = {
    map: {
      id: 2,
      name: "Renamed Zone",
      battleBackgroundKey: "devZone2",
    },
    terminate() {},
  };
  assert.equal(SceneManager.startBattle(1), true);
  assert.equal(SceneManager.currentScene.battleContext.mapId, 2);
  assert.equal(SceneManager.currentScene.battleContext.mapName, "Renamed Zone");
  assert.equal(
    SceneManager.currentScene.battleContext.battleBackgroundKey,
    "devZone2",
  );
}

function testMapAndEncounterBackgroundValidation() {
  const backgrounds = readData("BattleBackgrounds.json");
  const { Class: DatabaseValidator } = loadClass(
    "js/core/DatabaseValidator.js",
    "DatabaseValidator",
    { DebugManager: { log() {} } },
  );

  const validErrors = [];
  DatabaseValidator.validateBattleBackgrounds(backgrounds, validErrors);
  assert.deepEqual(validErrors, []);

  const duplicate = clone(backgrounds);
  duplicate[2].key = duplicate[1].key;
  const duplicateErrors = [];
  DatabaseValidator.validateBattleBackgrounds(duplicate, duplicateErrors);
  assert.equal(
    duplicateErrors.some((error) => error.includes("must be unique")),
    true,
  );

  const map = clone(readData("Map001.json"));
  map.battleBackgroundKey = "missing";
  assert.throws(
    () =>
      DatabaseValidator.validateMapData(
        map,
        { battleBackgrounds: backgrounds },
        1,
      ),
    /unknown battle background key/,
  );

  const encounters = clone(readData("Encounters.json"));
  encounters[1].battleBackgroundKey = "missing";
  const encounterErrors = [];
  DatabaseValidator.validateEncounters(
    encounters,
    readData("Enemies.json"),
    encounterErrors,
    backgrounds,
  );
  assert.equal(
    encounterErrors.some((error) => error.includes("unknown battle background key")),
    true,
  );
}

function testRendererDelegatesBackgroundBeforeBattlePresentation() {
  const source = read("js/battle/BattleRenderer.js");
  const backgroundIndex = source.indexOf("this.drawBattleBackground(context)");
  const sideViewIndex = source.indexOf("this.drawSideView(context)");
  assert.ok(backgroundIndex >= 0);
  assert.ok(sideViewIndex > backgroundIndex);

  const calls = [];
  const Graphics = {
    width: 1280,
    height: 720,
    context: {
      save() {},
      restore() {},
      fillRect() {},
    },
  };
  const { Class: BattleRenderer } = loadClass(
    "js/battle/BattleRenderer.js",
    "BattleRenderer",
    { Graphics },
  );
  const renderer = new BattleRenderer({
    backgroundManager: {
      draw(_context, width, height) {
        calls.push([width, height]);
      },
    },
  });
  renderer.drawBattleBackground(Graphics.context);
  assert.deepEqual(calls, [[1280, 720]]);
}

function testLoadOrder() {
  const source = read("index.html");
  const backgroundIndex = source.indexOf("js/battle/BattleBackgroundManager.js");
  const rendererIndex = source.indexOf("js/battle/BattleRenderer.js");
  const sceneIndex = source.indexOf("js/scenes/Scene_Battle.js");
  assert.ok(backgroundIndex >= 0);
  assert.ok(rendererIndex > backgroundIndex);
  assert.ok(sceneIndex > rendererIndex);
}

function run() {
  testRegistryAndPrototypeAssets();
  testDatabaseAccessUsesStableKey();
  testBackgroundManagerPriorityFallbackAndCoverCrop();
  testLayeredBackgroundDrawsBottomToTop();
  testGameMapCarriesStableBackgroundKey();
  testSceneManagerCarriesMapContextIntoBattle();
  testMapAndEncounterBackgroundValidation();
  testRendererDelegatesBackgroundBeforeBattlePresentation();
  testLoadOrder();
  console.log("Battle background foundation regression tests passed.");
}

run();
