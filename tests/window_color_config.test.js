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

function loadConfig(storage = localStorageHarness()) {
  const context = vm.createContext({ console, localStorage: storage });
  vm.runInContext(
    `${read("js/core/ConfigManager.js")}\nglobalThis.__Config = ConfigManager;`,
    context,
  );
  context.__Config.initialize();
  return { ConfigManager: context.__Config, storage };
}

function testConfigV4PersistsAndMigratesWindowColors() {
  const oldPayload = JSON.stringify({
    version: 2,
    options: {
      battleSpeed: "fast",
      battleMessageSpeed: "slow",
      fieldMessageSpeed: "normal",
      battleCursorMemory: "memory",
      magickOrder: "element",
    },
    bindings: {
      confirm: ["Space", "Enter"],
    },
  });
  const storage = localStorageHarness({ Sektor1_Config_v2: oldPayload });
  const { ConfigManager } = loadConfig(storage);

  assert.equal(ConfigManager.currentVersion(), 4);
  assert.equal(ConfigManager.storageKey(), "Sektor1_Config_v4");
  assert.equal(ConfigManager.get("battleSpeed"), "fast");
  assert.equal(ConfigManager.get("atbMode"), "active");
  assert.deepEqual(Array.from(ConfigManager.bindingSlots("confirm")), ["Space", "Enter"]);
  assert.deepEqual(
    JSON.parse(JSON.stringify(ConfigManager.getWindowColors())),
    JSON.parse(JSON.stringify(ConfigManager.windowColorDefaults())),
  );
  assert.equal(storage.store.has("Sektor1_Config_v4"), true);
}

function testWindowColorsSanitizePersistAndClampChannels() {
  const { ConfigManager, storage } = loadConfig();

  assert.equal(ConfigManager.setWindowColor("topLeft", "#A1B2C3"), true);
  assert.equal(ConfigManager.windowColor("topLeft"), "#a1b2c3");
  assert.equal(ConfigManager.setWindowColor("topRight", "blue"), false);

  ConfigManager.setWindowColor("bottomRight", "#fefefe", { persist: false });
  assert.equal(
    ConfigManager.adjustWindowColorChannel("bottomRight", "r", 16, { persist: false }),
    true,
  );
  assert.equal(ConfigManager.windowColorChannel("bottomRight", "r"), 255);
  assert.equal(
    ConfigManager.setWindowColorChannel("bottomRight", "b", -40, { persist: false }),
    true,
  );
  assert.equal(ConfigManager.windowColorChannel("bottomRight", "b"), 0);

  ConfigManager.save();
  const payload = JSON.parse(storage.store.get("Sektor1_Config_v4"));
  assert.equal(payload.version, 4);
  assert.equal(payload.windowColors.topLeft, "#a1b2c3");
  assert.equal(payload.windowColors.bottomRight, "#fffe00");

  ConfigManager.windowColors = null;
  ConfigManager.initialize();
  assert.equal(ConfigManager.windowColor("topLeft"), "#a1b2c3");
  assert.equal(ConfigManager.windowColor("bottomRight"), "#fffe00");
}

function testInvalidStoredWindowColorsFallBackPerCorner() {
  const payload = JSON.stringify({
    version: 3,
    options: {},
    bindings: {},
    windowColors: {
      topLeft: "#123456",
      topRight: "nope",
      bottomLeft: "#ABCDEF",
      bottomRight: 42,
    },
  });
  const storage = localStorageHarness({ Sektor1_Config_v3: payload });
  const { ConfigManager } = loadConfig(storage);
  const defaults = ConfigManager.windowColorDefaults();

  assert.equal(ConfigManager.windowColor("topLeft"), "#123456");
  assert.equal(ConfigManager.windowColor("topRight"), defaults.topRight);
  assert.equal(ConfigManager.windowColor("bottomLeft"), "#abcdef");
  assert.equal(ConfigManager.windowColor("bottomRight"), defaults.bottomRight);
}

function colorEditorHarness() {
  const storage = localStorageHarness();
  let triggered = new Set();
  let pops = 0;
  const drawCalls = [];
  const context2d = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "",
    textBaseline: "",
    save() {},
    restore() {},
    fillRect(...args) { drawCalls.push(["fillRect", this.fillStyle, ...args]); },
    strokeRect(...args) { drawCalls.push(["strokeRect", this.strokeStyle, ...args]); },
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
    fillText(...args) { drawCalls.push(["fillText", ...args]); },
  };
  const actionCodes = {
    up: ["ArrowUp"],
    down: ["ArrowDown"],
    left: ["ArrowLeft"],
    right: ["ArrowRight"],
    confirm: ["Enter"],
    cancel: ["Escape"],
  };
  const context = vm.createContext({
    console,
    localStorage: storage,
    Graphics: { width: 1280, height: 720, context: context2d },
    Input: {
      isActionTriggered(action) {
        return (actionCodes[action] || []).some((code) => triggered.has(code));
      },
      actionLabel(action) {
        return { up: "↑", down: "↓", left: "←", right: "→", confirm: "Enter", cancel: "Esc" }[action] || action;
      },
    },
    UIAssetManager: {
      drawPanel(...args) { drawCalls.push(["drawPanel", args[1], ...args.slice(2, 6)]); return true; },
      drawSelectionPanel(...args) { drawCalls.push(["drawSelectionPanel", ...args.slice(1, 5)]); return true; },
    },
    Scene_Base: class {},
    SceneManager: { pop() { pops++; } },
  });

  vm.runInContext(
    `${read("js/core/ConfigManager.js")}\n` +
      `${read("js/windows/MenuScreenLayout.js")}\n${read("js/windows/ConfigMenuLayout.js")}\n` +
      `${read("js/windows/Window_WindowColor.js")}\n` +
      `${read("js/scenes/Scene_WindowColor.js")}\n` +
      `globalThis.__classes = { ConfigManager, Window_WindowColor, Scene_WindowColor };`,
    context,
  );

  context.__classes.ConfigManager.initialize();

  return {
    ...context.__classes,
    trigger(code) { triggered = new Set([code]); },
    clear() { triggered = new Set(); },
    drawCalls,
    popCount() { return pops; },
  };
}

function testWindowColorEditorEditsLiveAndResetsOnlyColors() {
  const harness = colorEditorHarness();
  const { ConfigManager, Window_WindowColor } = harness;
  const window = new Window_WindowColor({ onBack: () => {} });
  const original = ConfigManager.windowColor("topLeft");
  const originalGreen = ConfigManager.windowColorChannel("topLeft", "g");

  harness.trigger("Enter");
  assert.equal(window.update(), true);
  assert.equal(window.editing, true);

  harness.trigger("ArrowRight");
  window.update();
  assert.notEqual(ConfigManager.windowColor("topLeft"), original);

  harness.trigger("ArrowDown");
  window.update();
  assert.equal(window.currentChannel(), "g");

  harness.trigger("ArrowLeft");
  window.update();
  assert.equal(
    ConfigManager.windowColorChannel("topLeft", "g"),
    Math.max(0, originalGreen - 1),
  );

  harness.trigger("Enter");
  window.update();
  assert.equal(window.editing, false);

  ConfigManager.set("battleSpeed", "fast", { persist: false });
  window.index = window.entries.length - 1;
  harness.trigger("Enter");
  window.update();
  assert.deepEqual(
    JSON.parse(JSON.stringify(ConfigManager.getWindowColors())),
    JSON.parse(JSON.stringify(ConfigManager.windowColorDefaults())),
  );
  assert.equal(ConfigManager.get("battleSpeed"), "fast");

  assert.doesNotThrow(() => window.draw());
  assert.equal(
    harness.drawCalls.filter((call) => call[0] === "drawPanel").length >= 2,
    true,
    "editor and live preview both use shared panel rendering",
  );
}

function gradientContext() {
  const calls = [];
  return {
    calls,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    save() { calls.push(["save"]); },
    restore() { calls.push(["restore"]); },
    beginPath() {},
    roundRect() {},
    clip() {},
    fill() {},
    stroke() {},
    fillRect(...args) { calls.push(["fillRect", this.fillStyle, this.globalCompositeOperation, ...args]); },
    strokeRect() {},
    createLinearGradient(...args) {
      const stops = [];
      calls.push(["gradient", args, stops]);
      return { addColorStop(offset, color) { stops.push([offset, color]); } };
    },
  };
}

function testSharedPanelRendererConsumesFourCornerColorsCentrally() {
  const storage = localStorageHarness();
  const context = vm.createContext({ console, localStorage: storage });
  vm.runInContext(
    `${read("js/core/ConfigManager.js")}\n${read("js/core/UIAssetManager.js")}\n` +
      `globalThis.__classes = { ConfigManager, UIAssetManager };`,
    context,
  );
  const { ConfigManager, UIAssetManager } = context.__classes;
  ConfigManager.initialize();
  ConfigManager.setWindowColor("topLeft", "#ff0000", { persist: false });
  ConfigManager.setWindowColor("topRight", "#00ff00", { persist: false });
  ConfigManager.setWindowColor("bottomLeft", "#0000ff", { persist: false });
  ConfigManager.setWindowColor("bottomRight", "#ffffff", { persist: false });

  const draw = gradientContext();
  UIAssetManager.drawPanel(draw, "menuPanel", 10, 20, 320, 180, { shadow: false });

  const gradientCalls = draw.calls.filter((call) => call[0] === "gradient");
  assert.equal(gradientCalls.length, 24);
  assert.deepEqual(gradientCalls[0][2], [
    [0, "rgb(255, 0, 0)"],
    [1, "rgb(0, 0, 255)"],
  ]);
  assert.deepEqual(gradientCalls.at(-1)[2], [
    [0, "rgb(0, 255, 0)"],
    [1, "rgb(255, 255, 255)"],
  ]);
  assert.equal(
    draw.calls.some((call) => call[0] === "fillRect" && call[2] === "source-atop"),
    true,
  );

  draw.calls.length = 0;
  UIAssetManager.drawPanel(draw, "menuPanel", 10, 20, 320, 180, {
    shadow: false,
    windowTint: false,
  });
  assert.equal(draw.calls.filter((call) => call[0] === "gradient").length, 0);
}

function testOptionsRouteAndScriptOrderExposeWindowColorEditor() {
  const options = read("js/windows/Window_Options.js");
  const sceneOptions = read("js/scenes/Scene_Options.js");
  const index = read("index.html");

  assert.match(options, /label: "Window Color"/);
  assert.match(options, /type: "windowColor"/);
  assert.match(sceneOptions, /SceneManager\.push\(Scene_WindowColor\)/);
  assert.equal(index.indexOf("Window_WindowColor.js") < index.indexOf("Scene_WindowColor.js"), true);
  assert.equal(index.indexOf("Scene_WindowColor.js") < index.indexOf("Scene_Options.js"), true);
}

function run() {
  testConfigV4PersistsAndMigratesWindowColors();
  testWindowColorsSanitizePersistAndClampChannels();
  testInvalidStoredWindowColorsFallBackPerCorner();
  testWindowColorEditorEditsLiveAndResetsOnlyColors();
  testSharedPanelRendererConsumesFourCornerColorsCentrally();
  testOptionsRouteAndScriptOrderExposeWindowColorEditor();

  console.log("Window color customization regression tests passed.");
}

run();
