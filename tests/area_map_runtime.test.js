"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
const readData = (filename) => JSON.parse(read(`data/${filename}`));

function testGameSystemOwnsPersistentSharedDiscoveryState() {
  const actors = readData("Actors.json");
  const context = vm.createContext({
    console,
    DatabaseManager: {
      actors,
      system: {
        protagonistActorId: 1,
        unidentifiedActorName: "Unknown",
        startingActorIds: [1],
      },
      actor(id) {
        return actors[id] || null;
      },
    },
    Game_Actor: class {
      constructor(id) {
        this.actorId = id;
        this.name = actors[id]?.name || "";
      }
      static normalizeName(value) {
        return String(value || "").trim();
      }
      rename(name) {
        this.name = String(name);
        return true;
      }
    },
    Game_Party: class {
      constructor() {}
    },
    Game_SelfSwitches: class {},
    Game_Switches: class {},
    Game_Variables: class {},
  });

  vm.runInContext(
    `${read("js/objects/Game_System.js")}\nglobalThis.__GameSystem = Game_System;`,
    context,
  );

  const system = new context.__GameSystem();
  assert.equal(system.discoverLocation(1, "test-plaza"), true);
  assert.equal(system.discoverLocation(1, "test-plaza"), false);
  assert.equal(system.discoverLocation(1, "merchant-row"), true);
  assert.equal(system.isLocationDiscovered(1, "merchant-row"), true);
  assert.deepEqual(Array.from(system.discoveredLocationIds(1)), [
    "test-plaza",
    "merchant-row",
  ]);

  const state = JSON.parse(JSON.stringify(system.areaDiscoveryState()));
  const restored = new context.__GameSystem();
  assert.equal(restored.restoreAreaDiscoveryState(state), true);
  assert.equal(restored.isLocationDiscovered(1, "test-plaza"), true);
  assert.equal(restored.isLocationDiscovered(1, "merchant-row"), true);
}

function testGameMapDiscoversNearbyLocationsAndBuildsSnapshot() {
  const mapData = readData("Map001.json");
  mapData.areaMap = {
    enabled: true,
    locations: [
      {
        id: "test-plaza",
        name: "Test Plaza",
        type: "landmark",
        x: 630,
        y: 325,
        discoverRadius: 140,
        initiallyDiscovered: true,
        description: "Nearby landmark fixture.",
      },
      {
        id: "north-passage",
        name: "North Passage",
        type: "exit",
        x: 630,
        y: 125,
        discoverRadius: 135,
        initiallyDiscovered: false,
        description: "Undiscovered exit fixture.",
      },
      {
        id: "merchant-row",
        name: "Merchant Row",
        type: "landmark",
        x: 385,
        y: 325,
        discoverRadius: 105,
        initiallyDiscovered: false,
        description: "Second landmark fixture.",
      },
    ],
  };
  const discoveries = new Map();
  const key = (mapId, locationId) => `${mapId}:${locationId}`;
  const context = vm.createContext({
    console,
    DebugManager: { log() {} },
    Game_Event: class {
      constructor(data) {
        Object.assign(this, data);
      }
    },
    Graphics: { context: {} },
    $gameSystem: {
      discoverLocation(mapId, locationId) {
        const id = key(mapId, locationId);
        if (discoveries.has(id)) return false;
        discoveries.set(id, true);
        return true;
      },
      isLocationDiscovered(mapId, locationId) {
        return discoveries.has(key(mapId, locationId));
      },
      discoveredLocationIds(mapId) {
        const prefix = `${mapId}:`;
        return [...discoveries.keys()]
          .filter((entry) => entry.startsWith(prefix))
          .map((entry) => entry.slice(prefix.length));
      },
    },
  });

  vm.runInContext(
    `${read("js/objects/Game_Map.js")}\nglobalThis.__GameMap = Game_Map;`,
    context,
  );

  const map = new context.__GameMap(mapData);
  const player = { x: 610, y: 300, width: 32, height: 32 };
  const first = Array.from(map.updateAreaDiscovery(player));

  assert.equal(map.areaMapEnabled(), true);
  assert.equal(first.includes("test-plaza"), true);
  assert.equal(discoveries.has("1:merchant-row"), false);
  assert.equal(discoveries.has("1:north-passage"), false);

  player.x = 360;
  player.y = 340;
  const second = Array.from(map.updateAreaDiscovery(player));
  assert.equal(second.includes("merchant-row"), true);

  const snapshot = map.areaMapSnapshot(player);
  assert.equal(snapshot.mapId, 1);
  assert.equal(snapshot.name, mapData.name);
  assert.equal(
    snapshot.locations.find((location) => location.id === "merchant-row")
      .discovered,
    true,
  );
  assert.equal(
    snapshot.locations.find((location) => location.id === "north-passage")
      .discovered,
    false,
  );
  assert.equal(
    snapshot.locations.find((location) => location.id === "test-plaza")
      .discoveryOrder,
    0,
  );
  assert.equal(
    snapshot.locations.find((location) => location.id === "merchant-row")
      .discoveryOrder,
    1,
  );
}

function testAreaMapWindowShowsOnlyDiscoveredLocationsAndSupportsSelection() {
  const triggered = new Set();
  const calls = [];
  const context = vm.createContext({
    console,
    UIThemePalette: {
      primary() {
        return "#fff";
      },
      secondary() {
        return "#aaa";
      },
    },
    Input: {
      isActionTriggered(action) {
        return triggered.has(action);
      },
      isActionRepeated(action) {
        return triggered.has(action);
      },
      actionLabel() {
        return "Q";
      },
    },
    Graphics: {
      width: 1280,
      height: 720,
      context: {
        fillStyle: "",
        strokeStyle: "",
        lineWidth: 1,
        font: "",
        textAlign: "",
        textBaseline: "",
        save() {},
        restore() {},
        fillRect(...args) {
          calls.push(["fillRect", ...args]);
        },
        strokeRect(...args) {
          calls.push(["strokeRect", ...args]);
        },
        fillText(...args) {
          calls.push(["fillText", ...args]);
        },
        beginPath() {},
        moveTo() {},
        lineTo() {},
        stroke() {},
      },
    },
  });

  vm.runInContext(
    `${read("js/windows/MenuScreenLayout.js")}\n${read("js/windows/Window_AreaMap.js")}\nglobalThis.__WindowAreaMap = Window_AreaMap;`,
    context,
  );

  const window = new context.__WindowAreaMap({
    mapId: 1,
    name: "Test Zone",
    width: 1000,
    height: 800,
    player: { x: 100, y: 100 },
    obstacles: [],
    locations: [
      {
        id: "a",
        name: "Zulu Plaza",
        type: "landmark",
        x: 100,
        y: 100,
        discoveryOrder: 0,
        sourceIndex: 0,
        discovered: true,
      },
      {
        id: "b",
        name: "Beta Exit",
        type: "exit",
        x: 200,
        y: 200,
        discoveryOrder: 1,
        sourceIndex: 1,
        discovered: true,
      },
      {
        id: "d",
        name: "Alpha Row",
        type: "landmark",
        x: 500,
        y: 500,
        discoveryOrder: 2,
        sourceIndex: 2,
        discovered: true,
      },
      {
        id: "e",
        name: "Alpha Exit",
        type: "exit",
        x: 120,
        y: 120,
        discoveryOrder: 3,
        sourceIndex: 3,
        discovered: true,
      },
      {
        id: "c",
        name: "Secret",
        type: "landmark",
        x: 300,
        y: 300,
        discovered: false,
      },
    ],
  });

  assert.deepEqual(
    Array.from(window.discoveredLocations(), (location) => location.name),
    ["Zulu Plaza", "Beta Exit", "Alpha Row", "Alpha Exit"],
  );
  assert.deepEqual(
    Array.from(window.organizedLocations(), (location) => location.name),
    ["Zulu Plaza", "Alpha Row", "Beta Exit", "Alpha Exit"],
    "Discovery order is preserved within separate Landmark and Exit groups",
  );

  triggered.add("right");
  window.update();
  triggered.clear();
  assert.equal(window.sortMode, "name");
  assert.deepEqual(
    Array.from(window.organizedLocations(), (location) => location.name),
    ["Alpha Row", "Zulu Plaza", "Alpha Exit", "Beta Exit"],
  );

  triggered.add("right");
  window.update();
  triggered.clear();
  assert.equal(window.sortMode, "distance");
  assert.deepEqual(
    Array.from(window.organizedLocations(), (location) => location.name),
    ["Zulu Plaza", "Alpha Row", "Alpha Exit", "Beta Exit"],
  );

  triggered.add("down");
  window.update();
  triggered.clear();
  assert.equal(window.currentLocation().name, "Alpha Row");
  assert.doesNotThrow(() => window.draw());

  const text = calls
    .filter((call) => call[0] === "fillText")
    .map((call) => String(call[1]));
  assert.equal(
    text.some((value) => value.includes("Alpha")),
    true,
  );
  assert.equal(
    text.some((value) => value.includes("Beta")),
    true,
  );
  assert.equal(
    text.some((value) => value.includes("Secret")),
    false,
  );
  assert.equal(text.some((value) => value.includes("LANDMARKS")), true);
  assert.equal(text.some((value) => value.includes("EXITS")), true);
  assert.equal(text.some((value) => value.includes("Distance")), true);
}

function testQuickMapInputRoutesFieldExplorationIntoCurrentAreaMap() {
  const config = read("js/core/ConfigManager.js");
  const sceneMap = read("js/scenes/Scene_Map.js");

  assert.match(
    config,
    /action: "map", label: "Quick Map", defaults: \["KeyM", null\]/,
  );
  assert.match(sceneMap, /Input\.isActionTriggered\("map"\)/);
  assert.match(sceneMap, /scope: "area"/);
  assert.match(sceneMap, /sceneClass: Scene_AreaMap/);

  const pushes = [];
  const snapshot = { mapId: 1, name: "Dev Zone 1" };
  const context = vm.createContext({
    console,
    Scene_Base: class {},
    Window_Message: class {},
    Window_Choice: class {},
    Game_Interpreter: class {},
    Scene_AreaMap: class Scene_AreaMap {},
    SceneManager: {
      push(sceneClass, ...args) {
        pushes.push([sceneClass, ...args]);
      },
    },
    Input: {},
    DebugManager: { log() {} },
    CollisionManager: {},
    Graphics: {},
    DatabaseManager: {},
    Game_Map: class {},
    Game_Player: class {},
    Camera: class {},
  });

  vm.runInContext(
    `${sceneMap}\nglobalThis.__SceneMap = Scene_Map;`,
    context,
  );

  const fake = {
    map: {
      areaMapEnabled: () => true,
      areaMapSnapshot: () => snapshot,
    },
    player: {},
  };
  fake.quickMapRoute = context.__SceneMap.prototype.quickMapRoute;

  const route = context.__SceneMap.prototype.quickMapRoute.call(fake);
  assert.equal(route.scope, "area");
  assert.equal(route.args[0], snapshot);
  assert.equal(context.__SceneMap.prototype.openQuickMap.call(fake), true);
  assert.equal(pushes.length, 1);
  assert.equal(pushes[0][1], snapshot);
}

function testAreaMapIsAFirstClassMainMenuDestination() {
  const command = read("js/windows/Window_MenuCommand.js");
  const sceneMenu = read("js/scenes/Scene_Menu.js");
  const sceneMap = read("js/scenes/Scene_Map.js");
  const html = read("index.html");

  assert.match(command, /"Status",\s*"Valor",\s*"Order",\s*"ROSTER",\s*"Config",\s*"Save",\s*"Load",\s*"Map"/);
  assert.match(sceneMenu, /case "Map":\s*SceneManager\.push\(Scene_AreaMap/);
  assert.match(
    sceneMap,
    /areaMap: this\.map\?\.areaMapSnapshot\?\.\(this\.player\)/,
  );
  assert.match(
    sceneMap,
    /enabled: this\.map\?\.areaMapEnabled\?\.\(\) === true/,
  );
  assert.match(html, /js\/windows\/Window_AreaMap\.js/);
  assert.match(html, /js\/scenes\/Scene_AreaMap\.js/);
  assert.equal(
    html.indexOf("js/windows/Window_AreaMap.js") <
      html.indexOf("js/scenes/Scene_AreaMap.js"),
    true,
  );
}

function run() {
  testGameSystemOwnsPersistentSharedDiscoveryState();
  testGameMapDiscoversNearbyLocationsAndBuildsSnapshot();
  testAreaMapWindowShowsOnlyDiscoveredLocationsAndSupportsSelection();
  testQuickMapInputRoutesFieldExplorationIntoCurrentAreaMap();
  testAreaMapIsAFirstClassMainMenuDestination();
  console.log("Area Map runtime regression tests passed.");
}

run();
