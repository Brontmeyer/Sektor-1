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
    `${read("js/windows/Window_AreaMap.js")}\nglobalThis.__WindowAreaMap = Window_AreaMap;`,
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
        name: "Alpha",
        type: "landmark",
        x: 100,
        y: 100,
        discovered: true,
      },
      { id: "b", name: "Beta", type: "exit", x: 200, y: 200, discovered: true },
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
    ["Alpha", "Beta"],
  );
  triggered.add("down");
  window.update();
  triggered.clear();
  assert.equal(window.currentLocation().name, "Beta");
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
}

function testAreaMapIsAFirstClassMainMenuDestination() {
  const command = read("js/windows/Window_MenuCommand.js");
  const sceneMenu = read("js/scenes/Scene_Menu.js");
  const sceneMap = read("js/scenes/Scene_Map.js");
  const html = read("index.html");

  assert.match(command, /"ROSTER",\s*"Valor",\s*"Config",\s*"Save",\s*"Load",\s*"Map"/);
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
  testAreaMapIsAFirstClassMainMenuDestination();
  console.log("Area Map runtime regression tests passed.");
}

run();
