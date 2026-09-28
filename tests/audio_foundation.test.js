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

function localStorageHarness(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); },
    store,
  };
}

class FakeAudio {
  static instances = [];
  static playErrors = [];

  constructor(src) {
    this.src = src;
    this.volume = 1;
    this.loop = false;
    this.preload = "";
    this.paused = true;
    this.currentTime = 0;
    this.listeners = new Map();
    this.playCount = 0;
    this.pauseCount = 0;
    this.readyState = 4;
    this.networkState = 1;
    FakeAudio.instances.push(this);
  }

  addEventListener(type, callback) {
    this.listeners.set(type, callback);
  }

  play() {
    this.playCount += 1;
    const error = FakeAudio.playErrors.shift() || null;
    if (error) {
      this.paused = true;
      return Promise.reject(error);
    }
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
    this.pauseCount += 1;
  }
}

function loadAudioHarness() {
  FakeAudio.instances = [];
  FakeAudio.playErrors = [];
  const localStorage = localStorageHarness();
  const context = vm.createContext({
    console,
    localStorage,
    Audio: FakeAudio,
    DebugManager: { log() {} },
    window: { addEventListener() {} },
  });

  vm.runInContext(
    `${read("js/core/ConfigManager.js")}\n${read("js/core/AudioManager.js")}\n` +
      `globalThis.__classes = { ConfigManager, AudioManager };`,
    context,
  );

  const { ConfigManager, AudioManager } = context.__classes;
  ConfigManager.initialize();
  AudioManager.initialize();
  AudioManager.configure(readData("Audio.json"));
  return { ConfigManager, AudioManager, localStorage };
}

function testRegistryAssetsAndStableKeys() {
  const audio = readData("Audio.json");
  const expected = [
    "field.devZone1",
    "field.devZone2",
    "battle.standard",
  ];
  assert.deepEqual(Object.keys(audio.bgm), expected);
  assert.deepEqual(Object.keys(audio.se), ["ui.cursor", "ui.confirm", "ui.cancel"]);

  for (const group of [audio.bgm, audio.se]) {
    for (const definition of Object.values(group)) {
      assert.equal(
        fs.existsSync(path.join(projectRoot, definition.file)),
        true,
        `${definition.file} must exist`,
      );
    }
  }

  assert.equal(readData("Map001.json").bgmKey, "field.devZone1");
  assert.equal(readData("Map002.json").bgmKey, "field.devZone2");
  assert.equal(readData("System.json").defaultBattleBgmKey, "battle.standard");
}

function testConfigRuntimeV6PersistsAndMigratesAudioVolumes() {
  const storage = localStorageHarness({
    Sektor1_Config_v5: JSON.stringify({
      version: 5,
      options: {
        battleSpeed: "fast",
        atbMode: "wait",
        battleCursorMemory: "memory",
      },
    }),
  });
  const context = vm.createContext({ console, localStorage: storage });
  vm.runInContext(
    `${read("js/core/ConfigManager.js")}\nglobalThis.__ConfigManager = ConfigManager;`,
    context,
  );
  const ConfigManager = context.__ConfigManager;
  ConfigManager.initialize();

  assert.equal(ConfigManager.currentVersion(), 6);
  assert.equal(ConfigManager.storageKey(), "Sektor1_Config_v6");
  assert.equal(ConfigManager.get("battleSpeed"), "fast");
  assert.equal(ConfigManager.get("atbMode"), "wait");
  assert.equal(ConfigManager.get("masterVolume"), 100);
  assert.equal(ConfigManager.get("bgmVolume"), 80);
  assert.equal(ConfigManager.get("seVolume"), 90);
  assert.equal(storage.store.has("Sektor1_Config_v6"), true);

  ConfigManager.set("masterVolume", 55);
  ConfigManager.set("bgmVolume", 35);
  ConfigManager.set("seVolume", 75);
  ConfigManager.data = null;
  ConfigManager.initialize();
  assert.equal(ConfigManager.get("masterVolume"), 55);
  assert.equal(ConfigManager.get("bgmVolume"), 35);
  assert.equal(ConfigManager.get("seVolume"), 75);
  assert.equal(ConfigManager.displayValue("bgmVolume"), "35%");
}

function testBgmCrossfadeSeAndLiveVolumeRefresh() {
  const { ConfigManager, AudioManager } = loadAudioHarness();

  AudioManager.unlock();
  assert.equal(AudioManager.playBgm("field.devZone1", { fadeSeconds: 0.5 }), true);
  const field = FakeAudio.instances.at(-1);
  assert.equal(field.loop, true);
  assert.equal(field.playCount, 1);
  AudioManager.update(0.5);
  assert.ok(Math.abs(field.volume - 0.8) < 0.0001);

  assert.equal(AudioManager.playBgm("battle.standard", { fadeSeconds: 0.5 }), true);
  const battle = FakeAudio.instances.at(-1);
  assert.equal(AudioManager.currentBgmKey(), "battle.standard");
  AudioManager.update(0.5);
  assert.equal(field.paused, true, "previous BGM is retired after crossfade");
  assert.ok(Math.abs(battle.volume - 0.8) < 0.0001);

  ConfigManager.set("masterVolume", 50, { persist: false });
  AudioManager.update(0);
  assert.ok(Math.abs(battle.volume - 0.4) < 0.0001);

  assert.equal(AudioManager.playSe("ui.confirm"), true);
  const confirm = FakeAudio.instances.at(-1);
  assert.equal(confirm.loop, false);
  assert.ok(Math.abs(confirm.volume - 0.351) < 0.0001);

  assert.equal(AudioManager.playBgm("missing"), false);
  assert.equal(AudioManager.playSe("missing"), false);
}


async function testStartupBgmWaitsForUserGesture() {
  const { AudioManager } = loadAudioHarness();

  assert.equal(AudioManager.playBgm("field.devZone1", { fadeSeconds: 0 }), true);
  const field = FakeAudio.instances.at(-1);
  assert.equal(field.playCount, 0, "startup must not call play() before a user gesture");
  assert.equal(field.paused, true);
  assert.equal(AudioManager.summary().userInteracted, false);
  assert.equal(AudioManager.summary().bgmPlayback.pendingRetry, true);
  assert.equal(AudioManager.summary().bgmPlayback.lastError, null);

  AudioManager.unlock();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(field.playCount, 1);
  assert.equal(field.paused, false);
  assert.equal(AudioManager.summary().userInteracted, true);
  assert.equal(AudioManager.summary().bgmPlayback.pendingRetry, false);
  assert.equal(AudioManager.summary().bgmPlayback.lastError, null);
}

async function testBlockedOrAbortedBgmRetriesOnLaterUserGesture() {
  const { AudioManager } = loadAudioHarness();
  const error = new Error("playback blocked during first user gesture");
  error.name = "AbortError";
  FakeAudio.playErrors.push(error);

  assert.equal(AudioManager.playBgm("field.devZone1", { fadeSeconds: 0 }), true);
  const field = FakeAudio.instances.at(-1);
  assert.equal(field.playCount, 0);

  AudioManager.unlock();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(field.playCount, 1);
  assert.equal(field.paused, true);
  assert.equal(AudioManager.summary().bgmPlayback.pendingRetry, true);
  assert.equal(AudioManager.summary().bgmPlayback.lastError, "AbortError");

  AudioManager.unlock();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(field.playCount, 2);
  assert.equal(field.paused, false);
  assert.equal(AudioManager.summary().bgmPlayback.pendingRetry, false);
  assert.equal(AudioManager.summary().bgmPlayback.lastError, null);
}

function testSceneAudioOwnershipInheritsMenusAndRestoresMapAfterBattle() {
  const calls = [];
  const AudioManager = {
    playBgm(key) { calls.push(["play", key]); return true; },
    stopBgm() { calls.push(["stop"]); return true; },
  };
  const context = vm.createContext({
    console,
    AudioManager,
    DebugManager: { log() {} },
    DatabaseManager: { encounter() { return null; } },
  });
  vm.runInContext(
    `${read("js/core/SceneManager.js")}\nglobalThis.__SceneManager = SceneManager;`,
    context,
  );
  const SceneManager = context.__SceneManager;
  SceneManager.initialize();

  const map = { audioBgmKey: () => "field.devZone1" };
  const menu = {};
  const battle = { audioBgmKey: () => "battle.standard" };
  SceneManager.currentScene = map;
  SceneManager.syncAudioForCurrentScene();
  SceneManager.sceneStack = [map];
  SceneManager.currentScene = menu;
  SceneManager.syncAudioForCurrentScene();
  SceneManager.sceneStack = [map, menu];
  SceneManager.currentScene = battle;
  SceneManager.syncAudioForCurrentScene();
  SceneManager.sceneStack = [map];
  SceneManager.currentScene = menu;
  SceneManager.syncAudioForCurrentScene();

  assert.deepEqual(calls, [
    ["play", "field.devZone1"],
    ["play", "field.devZone1"],
    ["play", "battle.standard"],
    ["play", "field.devZone1"],
  ]);
}

function testAudioDatabaseValidationAndAccessors() {
  const audio = readData("Audio.json");
  const context = vm.createContext({ console, DebugManager: { log() {} } });
  vm.runInContext(
    `${read("js/core/DatabaseValidator.js")}\n${read("js/core/DatabaseManager.js")}\n` +
      `globalThis.__classes = { DatabaseValidator, DatabaseManager };`,
    context,
  );
  const { DatabaseValidator, DatabaseManager } = context.__classes;
  const errors = [];
  DatabaseValidator.validateAudio(audio, errors);
  assert.deepEqual(errors, []);

  DatabaseManager.audio = audio;
  assert.equal(DatabaseManager.bgm("field.devZone2").loop, true);
  assert.equal(DatabaseManager.se("ui.confirm").file.includes("ui_confirm"), true);
  assert.equal(DatabaseManager.bgm("missing"), null);

  const systemErrors = [];
  DatabaseValidator.validateSystem(
    readData("System.json"),
    readData("MapInfos.json"),
    systemErrors,
    readData("Actors.json"),
    readData("BattleBackgrounds.json"),
    audio,
  );
  assert.deepEqual(systemErrors, []);

  const map = readData("Map001.json");
  assert.equal(
    DatabaseValidator.validateMapData(
      map,
      { battleBackgrounds: readData("BattleBackgrounds.json"), audio },
      1,
    ),
    true,
  );
  const badMap = JSON.parse(JSON.stringify(map));
  badMap.bgmKey = "missing";
  assert.throws(
    () => DatabaseValidator.validateMapData(
      badMap,
      { battleBackgrounds: readData("BattleBackgrounds.json"), audio },
      1,
    ),
    /unknown BGM key/,
  );

  const malformed = JSON.parse(JSON.stringify(audio));
  malformed.bgm["field.devZone1"].volume = 2;
  malformed.se["ui.confirm"].file = "";
  const malformedErrors = [];
  DatabaseValidator.validateAudio(malformed, malformedErrors);
  assert.equal(malformedErrors.some((error) => error.includes("volume")), true);
  assert.equal(malformedErrors.some((error) => error.includes("file")), true);
}

function testLoadOrderAndRuntimeHooks() {
  const index = read("index.html");
  const configIndex = index.indexOf("js/core/ConfigManager.js");
  const audioIndex = index.indexOf("js/core/AudioManager.js");
  const sceneManagerIndex = index.indexOf("js/core/SceneManager.js");
  assert.ok(configIndex >= 0 && audioIndex > configIndex);
  assert.ok(sceneManagerIndex > audioIndex);

  const main = read("js/main.js");
  assert.match(main, /AudioManager\.initialize\(\)/);
  assert.match(main, /AudioManager\.configure\(DatabaseManager\.audio\)/);
  assert.match(read("js/core/GameLoop.js"), /AudioManager\.update\(deltaTime\)/);
}

async function run() {
  testRegistryAssetsAndStableKeys();
  testConfigRuntimeV6PersistsAndMigratesAudioVolumes();
  testBgmCrossfadeSeAndLiveVolumeRefresh();
  await testStartupBgmWaitsForUserGesture();
  await testBlockedOrAbortedBgmRetriesOnLaterUserGesture();
  testSceneAudioOwnershipInheritsMenusAndRestoresMapAfterBattle();
  testAudioDatabaseValidationAndAccessors();
  testLoadOrderAndRuntimeHooks();
  console.log("Audio foundation regression tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
