"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

function localStorageHarness(initial = {}) {
  const store = new Map(Object.entries(initial));

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    store,
  };
}

function loadCore(localStorage = localStorageHarness()) {
  const context = vm.createContext({
    console,
    localStorage,
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
  Input.keys = {};
  Input.triggeredKeys = {};

  return { context, ConfigManager, Input, localStorage };
}

function testLegacyConfigMigratesWithoutLosingOptions() {
  const legacy = JSON.stringify({
    version: 1,
    options: {
      battleSpeed: "fast",
      battleMessageSpeed: "slow",
      fieldMessageSpeed: "fast",
      battleCursorMemory: "memory",
      magickOrder: "element",
    },
  });
  const storage = localStorageHarness({ Sektor1_Config_v1: legacy });
  const { ConfigManager } = loadCore(storage);

  assert.equal(ConfigManager.currentVersion(), 3);
  assert.equal(ConfigManager.get("battleSpeed"), "fast");
  assert.equal(ConfigManager.get("battleCursorMemory"), "memory");
  assert.deepEqual(Array.from(ConfigManager.bindingSlots("confirm")), ["KeyE", "Enter"]);
  assert.deepEqual(Array.from(ConfigManager.bindingSlots("help")), ["KeyH", null]);
  assert.deepEqual(
    JSON.parse(JSON.stringify(ConfigManager.getWindowColors())),
    JSON.parse(JSON.stringify(ConfigManager.windowColorDefaults())),
  );
  assert.equal(storage.store.has("Sektor1_Config_v3"), true);
}

function testNamedActionsReadRemappedPrimaryAndSecondaryBindings() {
  const { ConfigManager, Input } = loadCore();

  ConfigManager.setBinding("confirm", 0, "Space", { persist: false });
  assert.equal(ConfigManager.clearBinding("confirm", 1, { persist: false }), true);

  Input.triggeredKeys = { Space: true };
  assert.equal(Input.isActionTriggered("confirm"), true);
  assert.equal(Input.isActionTriggered("interact"), false);

  Input.triggeredKeys = { KeyE: true };
  assert.equal(Input.isActionTriggered("confirm"), false);
  assert.equal(Input.isActionTriggered("interact"), true);

  ConfigManager.resetBindings({ persist: false });
  Input.triggeredKeys = { KeyE: true };
  assert.equal(Input.isActionTriggered("confirm"), true);
  assert.equal(Input.isActionTriggered("interact"), true);

  Input.triggeredKeys = { Escape: true };
  assert.equal(Input.isActionTriggered("cancel"), true);
  assert.equal(Input.isActionTriggered("menu"), true);
}

function testBindingRulesProtectRequiredActionsAndPermitContextSharing() {
  const { ConfigManager } = loadCore();

  assert.equal(ConfigManager.setBinding("confirm", 0, "Space", { persist: false }), true);
  assert.equal(ConfigManager.clearBinding("confirm", 1, { persist: false }), true);
  assert.equal(
    ConfigManager.clearBinding("confirm", 0, { persist: false }),
    false,
    "required controls must keep at least one binding",
  );

  assert.equal(ConfigManager.clearBinding("help", 0, { persist: false }), true);
  assert.equal(ConfigManager.bindingLabel("help"), "Unbound");

  assert.equal(ConfigManager.setBinding("confirm", 1, "Space", { persist: false }), true);
  assert.deepEqual(Array.from(ConfigManager.bindingSlots("confirm")), [null, "Space"]);

  assert.equal(ConfigManager.setBinding("interact", 0, "Space", { persist: false }), true);
  assert.equal(ConfigManager.bindingSlots("interact")[0], "Space");
}

function loadControlsHarness() {
  const storage = localStorageHarness();
  const drawCalls = [];
  const drawContext = {
    fillStyle: "", strokeStyle: "", lineWidth: 0, font: "",
    textAlign: "", textBaseline: "",
    save() {}, restore() {}, fillRect() {}, strokeRect() {},
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
    fillText(...args) { drawCalls.push(args); },
  };
  const context = vm.createContext({
    console,
    localStorage: storage,
    DebugManager: { log() {} },
    window: { addEventListener() {} },
    Graphics: { width: 1280, height: 720, context: drawContext },
  });

  vm.runInContext(
    `${read("js/core/ConfigManager.js")}\n${read("js/core/Input.js")}\n` +
      `${read("js/windows/ConfigMenuLayout.js")}\n` +
      `${read("js/windows/Window_Controls.js")}\n` +
      `globalThis.__classes = { ConfigManager, Input, Window_Controls };`,
    context,
  );

  const { ConfigManager, Input, Window_Controls } = context.__classes;
  ConfigManager.initialize();
  Input.keys = {};
  Input.triggeredKeys = {};

  return {
    ConfigManager,
    Input,
    window: new Window_Controls(),
    drawCalls,
  };
}

function trigger(Input, code) {
  Input.triggeredKeys = { [code]: true };
}

function clear(Input) {
  Input.triggeredKeys = {};
}

function testControlsWindowCapturesClearsCancelsAndResetsBindings() {
  const { ConfigManager, Input, window, drawCalls } = loadControlsHarness();

  trigger(Input, "KeyE");
  assert.equal(window.update(), true);
  assert.equal(window.capturing, true);

  clear(Input);
  trigger(Input, "KeyZ");
  assert.equal(window.update(), true);
  assert.equal(window.capturing, false);
  assert.equal(ConfigManager.bindingSlots("up")[0], "KeyZ");

  window.index = ConfigManager.controlDefinitions().findIndex(
    (definition) => definition.action === "help",
  );
  window.slotIndex = 0;
  clear(Input);
  trigger(Input, "KeyE");
  window.update();
  assert.equal(window.capturing, true);

  clear(Input);
  trigger(Input, "Delete");
  window.update();
  assert.equal(ConfigManager.bindingSlots("help")[0], null);

  window.index = 0;
  window.slotIndex = 0;
  clear(Input);
  trigger(Input, "KeyE");
  window.update();
  assert.equal(window.capturing, true);
  const before = ConfigManager.bindingSlots("up")[0];

  clear(Input);
  trigger(Input, "Backspace");
  window.update();
  assert.equal(window.capturing, false);
  assert.equal(ConfigManager.bindingSlots("up")[0], before);

  window.index = window.entries.length - 1;
  clear(Input);
  trigger(Input, "KeyE");
  window.update();
  assert.deepEqual(Array.from(ConfigManager.bindingSlots("up")), ["KeyW", "ArrowUp"]);
  assert.deepEqual(Array.from(ConfigManager.bindingSlots("help")), ["KeyH", null]);

  assert.doesNotThrow(() => window.draw());
  assert.equal(
    drawCalls.some((call) => String(call[0]).includes("Reset Controls to Defaults")),
    true,
  );
}

function testOptionsExposeControlsSceneAndRuntimeHasNoRawGameplayKeys() {
  const index = read("index.html");
  const options = read("js/windows/Window_Options.js");
  const sceneOptions = read("js/scenes/Scene_Options.js");
  const battleRenderer = read("js/battle/BattleRenderer.js");

  assert.match(index, /Window_Controls\.js/);
  assert.match(index, /Scene_Controls\.js/);
  assert.equal(index.indexOf("Scene_Controls.js") < index.indexOf("Scene_Options.js"), true);
  assert.match(options, /label: "Controls"/);
  assert.match(sceneOptions, /SceneManager\.push\(Scene_Controls\)/);
  assert.match(battleRenderer, /Input\.actionLabel\("help"\)/);
  assert.match(battleRenderer, /Input\.actionLabel\("scope"\)/);

  const runtimeFiles = [];
  for (const root of ["js/objects", "js/windows", "js/scenes", "js/battle"]) {
    const directory = path.join(projectRoot, root);
    for (const name of fs.readdirSync(directory)) {
      if (name.endsWith(".js")) runtimeFiles.push(path.join(directory, name));
    }
  }

  const rawInputPattern = /Input\.(?:isPressed|isTriggered)\("(?:Key[A-Z]|Arrow(?:Up|Down|Left|Right)|Escape|Enter|Space)/;
  const offenders = runtimeFiles
    .filter((filename) => rawInputPattern.test(fs.readFileSync(filename, "utf8")))
    .map((filename) => path.relative(projectRoot, filename));

  assert.deepEqual(offenders, []);
}

function run() {
  testLegacyConfigMigratesWithoutLosingOptions();
  testNamedActionsReadRemappedPrimaryAndSecondaryBindings();
  testBindingRulesProtectRequiredActionsAndPermitContextSharing();
  testControlsWindowCapturesClearsCancelsAndResetsBindings();
  testOptionsExposeControlsSceneAndRuntimeHasNoRawGameplayKeys();

  console.log("Input mapping and controls regression tests passed.");
}

run();
