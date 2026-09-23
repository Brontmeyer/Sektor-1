"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

function localStorageHarness() {
  const store = new Map();
  return {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); },
  };
}

function loadInput() {
  const context = vm.createContext({
    console,
    localStorage: localStorageHarness(),
    DebugManager: { log() {} },
    window: { addEventListener() {} },
  });

  vm.runInContext(
    `${read("js/core/ConfigManager.js")}\n${read("js/core/Input.js")}\n` +
      `globalThis.__classes = { ConfigManager, Input };`,
    context,
  );

  const { ConfigManager, Input } = context.__classes;
  ConfigManager.initialize();
  Input.initialize();
  return { ConfigManager, Input };
}

function testInitialPressAndHeldRepeatTiming() {
  const { Input } = loadInput();

  Input.onKeyDown({ code: "ArrowDown" });
  Input.update(0);
  assert.equal(Input.isActionRepeated("down"), true, "initial press moves immediately");
  Input.endFrame();

  Input.update(0.2);
  assert.equal(Input.isActionRepeated("down"), false, "repeat waits through initial delay");

  Input.update(0.13);
  assert.equal(Input.isActionRepeated("down"), true, "held direction repeats after delay");
  Input.endFrame();

  Input.update(0.04);
  assert.equal(Input.isActionRepeated("down"), false);
  Input.update(0.05);
  assert.equal(Input.isActionRepeated("down"), true, "continued hold repeats steadily");

  Input.onKeyUp({ code: "ArrowDown" });
  Input.endFrame();
  Input.update(1);
  assert.equal(Input.isActionRepeated("down"), false, "release resets repeat state");

  Input.onKeyDown({ code: "ArrowDown" });
  Input.update(0);
  assert.equal(Input.isActionRepeated("down"), true, "new press is immediate after release");
}

function testRemappedDirectionUsesSameRepeatContract() {
  const { ConfigManager, Input } = loadInput();
  ConfigManager.setBinding("right", 0, "KeyL", { persist: false });
  ConfigManager.clearBinding("right", 1, { persist: false });

  Input.onKeyDown({ code: "KeyL" });
  Input.update(0);
  assert.equal(Input.isActionRepeated("right"), true);
  assert.equal(Input.isActionRepeated("left"), false);
}

function testGameLoopAdvancesInputBeforeScenes() {
  const source = read("js/core/GameLoop.js");
  const inputIndex = source.indexOf("Input.update(deltaTime)");
  const sceneIndex = source.indexOf("SceneManager.update(deltaTime)");

  assert.equal(inputIndex >= 0, true);
  assert.equal(inputIndex < sceneIndex, true);
}

function run() {
  testInitialPressAndHeldRepeatTiming();
  testRemappedDirectionUsesSameRepeatContract();
  testGameLoopAdvancesInputBeforeScenes();
  console.log("Input repeat navigation regression tests passed.");
}

run();
