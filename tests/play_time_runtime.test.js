"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

function testGameSystemTracksAndFormatsPersistentPlayTime() {
  const context = vm.createContext({
    console,
    DatabaseManager: { actors: [] },
    Game_Actor: class {},
    Game_Party: class { constructor() {} },
    Game_SelfSwitches: class {},
    Game_Switches: class {},
    Game_Variables: class {},
  });

  vm.runInContext(
    `${read("js/objects/Game_System.js")}\nglobalThis.__Game_System = Game_System;`,
    context,
  );

  const Game_System = context.__Game_System;
  const system = new Game_System();
  system.updatePlayTime(1.25);
  system.updatePlayTime(2.8);
  assert.equal(system.playTimeSeconds(), 4);
  assert.equal(system.formattedPlayTime(), "00:00:04");
  system.setPlayTimeSeconds(5025);
  assert.equal(system.formattedPlayTime(), "01:23:45");
  assert.equal(Game_System.formatPlayTime(360000), "100:00:00");
}

function testSceneManagerAdvancesClockBeforeSceneUpdate() {
  const calls = [];
  const context = vm.createContext({
    console,
    DebugManager: { log() {} },
    $gameSystem: {
      updatePlayTime(deltaTime) { calls.push(["clock", deltaTime]); },
    },
  });

  vm.runInContext(
    `${read("js/core/SceneManager.js")}\nglobalThis.__SceneManager = SceneManager;`,
    context,
  );

  const manager = context.__SceneManager;
  manager.currentScene = {
    update(deltaTime) { calls.push(["scene", deltaTime]); },
  };
  manager.update(0.5);
  assert.deepEqual(calls, [["clock", 0.5], ["scene", 0.5]]);
}

function testSaveManagerStoresAndRestoresPlayTimeWithoutVersionBump() {
  const source = read("js/core/SaveManager.js");
  assert.match(source, /playTimeSeconds: globalThis\.\$gameSystem\?\.playTimeSeconds\?\.\(\) \?\? 0/);
  assert.match(source, /setPlayTimeSeconds\?\.\(saveData\.metadata\?\.playTimeSeconds \?\? 0\)/);
  assert.match(source, /currentVersion\(\) \{\s*return 12;/);
}

function run() {
  testGameSystemTracksAndFormatsPersistentPlayTime();
  testSceneManagerAdvancesClockBeforeSceneUpdate();
  testSaveManagerStoresAndRestoresPlayTimeWithoutVersionBump();
  console.log("Play time runtime regression tests passed.");
}

run();
