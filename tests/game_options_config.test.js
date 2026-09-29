"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");

const defaultActionCodes = {
  up: ["KeyW", "ArrowUp"], down: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"], right: ["KeyD", "ArrowRight"],
  confirm: ["KeyE", "Enter"], cancel: ["KeyQ", "Escape"],
  menu: ["Escape"], map: ["KeyM"], interact: ["KeyE"], help: ["KeyH"], scope: ["KeyR"],
};
function actionTriggered(triggered, action) {
  return (defaultActionCodes[action] || []).some((code) => triggered.has(code));
}
function actionLabel(action) {
  return { up: "W / ↑", down: "S / ↓", left: "A / ←", right: "D / →", confirm: "E / Enter", cancel: "Q / Esc", menu: "Esc" }[action] || action;
}
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

function localStorageHarness() {
  const store = new Map();

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

function loadConfig(extra = {}) {
  const localStorage = extra.localStorage || localStorageHarness();
  const context = vm.createContext({ console, localStorage, ...extra });

  vm.runInContext(
    `${read("js/core/ConfigManager.js")}\nglobalThis.__ConfigManager = ConfigManager;`,
    context,
  );

  return { ConfigManager: context.__ConfigManager, context, localStorage };
}

function testConfigSnapshotsAsGameState() {
  const localStorage = localStorageHarness();
  const { ConfigManager } = loadConfig({ localStorage });

  ConfigManager.initialize();
  assert.equal(ConfigManager.get("battleSpeed"), "normal");
  assert.equal(ConfigManager.set("battleSpeed", "fast"), true);
  assert.equal(ConfigManager.set("battleCursorMemory", "memory"), true);
  const snapshot = ConfigManager.snapshot();
  assert.equal(localStorage.store.has(ConfigManager.storageKey()), false);

  ConfigManager.initialize();
  assert.equal(ConfigManager.get("battleSpeed"), "normal");
  ConfigManager.restoreSnapshot(snapshot);
  assert.equal(ConfigManager.get("battleSpeed"), "fast");
  assert.equal(ConfigManager.get("battleCursorMemory"), "memory");
  assert.equal(ConfigManager.set("battleSpeed", "warp"), false);
}

function testSpeedMappingsAndMagickOrderingAreDeterministic() {
  const { ConfigManager } = loadConfig();
  ConfigManager.initialize();

  ConfigManager.set("battleSpeed", "slow", { persist: false });
  assert.equal(ConfigManager.battleDeltaTime(2), 1.5);
  ConfigManager.set("battleSpeed", "fast", { persist: false });
  assert.equal(ConfigManager.battleDeltaTime(2), 2.7);

  ConfigManager.set("battleMessageSpeed", "slow", { persist: false });
  assert.equal(ConfigManager.battleMessageDeltaTime(2), 1.4);
  ConfigManager.set("fieldMessageSpeed", "fast", { persist: false });
  assert.equal(ConfigManager.fieldMessageCharactersPerSecond(), 70);

  const magick = [
    { id: 31, name: "Diminish", element: "none", category: "indirect" },
    { id: 10, name: "Ember", element: "fire", category: "attack" },
    { id: 4, name: "Purge Venom", element: "restorative", category: "restore" },
    { id: 1, name: "Mend", element: "restorative", category: "restore" },
    { id: 46, name: "Starfall", element: "none", category: "advanced" },
    { id: 13, name: "Frost", element: "ice", category: "attack" },
  ];

  assert.deepEqual(
    Array.from(ConfigManager.magickCategoryOrder()),
    ["restore", "attack", "indirect", "advanced"],
  );
  assert.deepEqual(
    Array.from(ConfigManager.sortMagick(magick), (entry) => [entry.category, entry.id]),
    [
      ["restore", 1],
      ["restore", 4],
      ["attack", 10],
      ["attack", 13],
      ["indirect", 31],
      ["advanced", 46],
    ],
  );

  assert.equal(
    ConfigManager.setMagickCategoryOrder(
      ["indirect", "restore", "attack", "advanced"],
      { persist: false },
    ),
    true,
  );
  assert.deepEqual(
    Array.from(ConfigManager.sortMagick(magick), (entry) => [entry.category, entry.id]),
    [
      ["indirect", 31],
      ["restore", 1],
      ["restore", 4],
      ["attack", 10],
      ["attack", 13],
      ["advanced", 46],
    ],
  );
  assert.equal(
    ConfigManager.magickCategoryOrderLabel(),
    "Indirect > Restore > Attack > Advanced",
  );

  assert.equal(
    ConfigManager.setMagickCategoryOrder(
      ["restore", "restore", "attack", "advanced"],
      { persist: false },
    ),
    false,
  );
  assert.deepEqual(
    Array.from(ConfigManager.magickCategoryOrder()),
    ["indirect", "restore", "attack", "advanced"],
  );
}

function testOptionsWindowCyclesAndPersistsSettings() {
  const localStorage = localStorageHarness();
  let triggered = new Set();
  const Graphics = { width: 1280, height: 720 };
  const context = vm.createContext({
    console,
    localStorage,
    Graphics,
    Input: {
      isTriggered(code) {
        return triggered.has(code);
      },
      isActionTriggered(action) { return actionTriggered(triggered, action); },
      actionLabel,
    },
  });

  vm.runInContext(
    `${read("js/core/ConfigManager.js")}\n${read("js/windows/MenuScreenLayout.js")}\n${read("js/windows/ConfigMenuLayout.js")}\n${read("js/windows/Window_Options.js")}\nglobalThis.__classes = { ConfigManager, Window_Options };`,
    context,
  );

  const { ConfigManager, Window_Options } = context.__classes;
  ConfigManager.initialize();
  const window = new Window_Options();

  triggered = new Set(["ArrowRight"]);
  window.update();
  assert.equal(ConfigManager.get("battleSpeed"), "fast");

  triggered = new Set(["ArrowDown"]);
  window.update();
  assert.equal(window.currentOption().key, "atbMode");

  triggered = new Set(["ArrowLeft"]);
  window.update();
  assert.equal(ConfigManager.get("atbMode"), "wait");
  assert.equal(localStorage.store.has(ConfigManager.storageKey()), false);

  while (window.currentOption().type !== "magickOrder") {
    triggered = new Set(["ArrowDown"]);
    window.update();
  }

  triggered = new Set(["Enter"]);
  window.update();
  assert.equal(window.isEditingMagickOrder(), true);
  assert.equal(window.magickOrderIndex, 0);

  triggered = new Set(["ArrowRight"]);
  window.update();
  assert.deepEqual(
    Array.from(ConfigManager.magickCategoryOrder()),
    ["attack", "restore", "indirect", "advanced"],
  );
  assert.equal(window.magickOrderIndex, 1);

  triggered = new Set(["ArrowDown"]);
  window.update();
  assert.equal(window.magickOrderIndex, 2);

  triggered = new Set(["ArrowLeft"]);
  window.update();
  assert.deepEqual(
    Array.from(ConfigManager.magickCategoryOrder()),
    ["attack", "indirect", "restore", "advanced"],
  );
  assert.equal(window.magickOrderIndex, 1);

  triggered = new Set(["Enter"]);
  window.update();
  assert.equal(window.isEditingMagickOrder(), false);
  assert.equal(
    ConfigManager.magickCategoryOrderLabel(),
    "Attack > Indirect > Restore > Advanced",
  );
}

function testFieldMessageSpeedControlsRevealAndConfirmBehavior() {
  let triggered = new Set();
  const localStorage = localStorageHarness();
  const context = vm.createContext({
    console,
    localStorage,
    Graphics: { width: 1280, height: 720 },
    Input: {
      isTriggered(code) {
        return triggered.has(code);
      },
      isActionTriggered(action) { return actionTriggered(triggered, action); },
      actionLabel,
    },
  });

  vm.runInContext(
    `${read("js/core/ConfigManager.js")}\n${read("js/windows/Window_Message.js")}\nglobalThis.__classes = { ConfigManager, Window_Message };`,
    context,
  );

  const { ConfigManager, Window_Message } = context.__classes;
  ConfigManager.initialize();
  const message = new Window_Message();
  const text = "abcdefghijklmnopqrstuvwxyz";

  ConfigManager.set("fieldMessageSpeed", "slow", { persist: false });
  message.show(text);
  message.update(0.25);
  const slowCount = message.visibleText().length;

  ConfigManager.set("fieldMessageSpeed", "fast", { persist: false });
  message.show(text);
  message.update(0.25);
  const fastCount = message.visibleText().length;
  assert.equal(fastCount > slowCount, true);

  triggered = new Set(["KeyE"]);
  message.update(0);
  assert.equal(message.isOpen(), true);
  assert.equal(message.isFullyRevealed(), true);

  message.update(0);
  assert.equal(message.isOpen(), false);
}

function testAtbModePausesOnlyDeepSelectionInWaitMode() {
  const localStorage = localStorageHarness();
  const context = vm.createContext({
    console,
    localStorage,
    Scene_Base: class {},
    BattleManager: { OUTCOME_VICTORY: "victory" },
  });

  vm.runInContext(
    `${read("js/core/ConfigManager.js")}\n${read("js/scenes/Scene_Battle.js")}\n` +
      `globalThis.__classes = { ConfigManager, Scene_Battle };`,
    context,
  );

  const { ConfigManager, Scene_Battle } = context.__classes;
  ConfigManager.initialize();
  const actor = { name: "Actor" };
  const scene = Object.create(Scene_Battle.prototype);
  scene.outcome = null;
  scene.enemies = [];
  scene.partyController = { currentBattler: () => actor };
  scene.actionPhase = "none";
  scene.battleInputLocked = false;
  scene.selectingEnemyTarget = false;
  scene.skillsWindow = { isOpen: () => false };
  scene.magickWindow = { isOpen: () => false };
  scene.itemWindow = { isOpen: () => false };

  ConfigManager.set("atbMode", "active", { persist: false });
  scene.magickWindow.isOpen = () => true;
  assert.equal(scene.battleTimeDeltaTime(0.5), 0.5);

  ConfigManager.set("atbMode", "wait", { persist: false });

  // The main command bar is not a pause button.
  scene.magickWindow.isOpen = () => false;
  assert.equal(scene.battleTimeDeltaTime(0.5), 0.5);

  // Deep selectors and target selection freeze Time in Wait mode.
  scene.magickWindow.isOpen = () => true;
  assert.equal(scene.battleTimeDeltaTime(0.5), 0);
  scene.magickWindow.isOpen = () => false;
  scene.selectingEnemyTarget = true;
  assert.equal(scene.battleTimeDeltaTime(0.5), 0);

  // Committed/resolving actions resume the clock.
  scene.selectingEnemyTarget = false;
  scene.battleInputLocked = true;
  assert.equal(scene.battleTimeDeltaTime(0.5), 0.5);
  scene.battleInputLocked = false;
  scene.actionPhase = "lunge";
  assert.equal(scene.battleTimeDeltaTime(0.5), 0.5);
}

function testBattleSpeedAndMessageSpeedUseSeparateClocks() {
  const localStorage = localStorageHarness();
  const calls = [];
  const context = vm.createContext({
    console,
    localStorage,
    Scene_Base: class {},
    BattleManager: { OUTCOME_VICTORY: "victory" },
    Input: { isTriggered: () => false, isActionTriggered: () => false, actionLabel },
  });

  vm.runInContext(
    `${read("js/core/ConfigManager.js")}\n${read("js/scenes/Scene_Battle.js")}\nglobalThis.__classes = { ConfigManager, Scene_Battle };`,
    context,
  );

  const { ConfigManager, Scene_Battle } = context.__classes;
  ConfigManager.initialize();
  ConfigManager.set("battleSpeed", "fast", { persist: false });
  ConfigManager.set("battleMessageSpeed", "slow", { persist: false });

  const fake = {
    outcome: "escape",
    updateActiveTimeClaimDelay(value) { calls.push(["cadence", value]); },
    battleTimeDeltaTime(value) { return value; },
    updateBattleTime(value) { calls.push(["time", value]); },
    updateBattlerStates(value) { calls.push(["states", value]); },
    updateActionPhase(value) { calls.push(["phase", value]); },
    updateBattlerVisuals(value) { calls.push(["visuals", value]); },
    updateBattleAnimations(value) { calls.push(["animation", value]); },
    updateBattleEffect(value) { calls.push(["effect", value]); },
    updateBattlePopups(value) { calls.push(["popups", value]); },
    updateBattleBanner(value) { calls.push(["banner", value]); },
    updatePendingEnemyTurn(value) { calls.push(["enemy", value]); },
  };

  Scene_Battle.prototype.update.call(fake, 0.2);

  const battleValues = calls
    .filter(([name]) => !["banner"].includes(name))
    .map(([, value]) => value);
  assert.equal(battleValues.every((value) => Math.abs(value - 0.27) < 1e-9), true);
  const banner = calls.find(([name]) => name === "banner");
  assert.equal(Math.abs(banner[1] - 0.14) < 1e-9, true);
}

function testCursorMemoryPassesStableRememberedIdsIntoSelectors() {
  const localStorage = localStorageHarness();
  const context = vm.createContext({
    console,
    localStorage,
    BattleEnemyAI: class {},
    DebugManager: { log() {} },
    $gameParty: { battleMembers: () => [] },
  });

  vm.runInContext(
    `${read("js/core/ConfigManager.js")}\n${read("js/battle/BattleManager.js")}\nglobalThis.__classes = { ConfigManager, BattleManager };`,
    context,
  );

  const { ConfigManager, BattleManager } = context.__classes;
  ConfigManager.initialize();
  const shown = [];
  const actor = {
    actorId: 1,
    name: "Actor",
    canAct: () => true,
    isPlayerControlled: () => true,
    canUseBattleAction: () => true,
  };
  const scene = {
    partyController: { currentBattler: () => actor },
    commandWindow: { commandActionKey: (command) => command.toLowerCase() },
    skillsWindow: { show(options) { shown.push(options); } },
    magickWindow: { show(options) { shown.push(options); } },
    itemWindow: { show(options) { shown.push(options); } },
    rememberBattleCommand() {},
    rememberedBattleSelectionId(_actor, kind) {
      return kind === "magick" && ConfigManager.battleCursorMemoryEnabled()
        ? 10
        : null;
    },
  };
  const manager = new BattleManager(scene);

  ConfigManager.set("battleCursorMemory", "initial", { persist: false });
  manager.executeCommand("Magick");
  assert.equal(shown.at(-1).preserveIndex, false);
  assert.equal(shown.at(-1).preferredId, null);

  ConfigManager.set("battleCursorMemory", "memory", { persist: false });
  manager.executeCommand("Magick");
  assert.equal(shown.at(-1).preserveIndex, false);
  assert.equal(shown.at(-1).preferredId, 10);
}

function testFullscreenOptionsSceneDrawsAndReturnsToMenu() {
  let triggered = new Set();
  let pops = 0;
  const drawCalls = [];
  const drawContext = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    font: "",
    textAlign: "",
    textBaseline: "",
    save() {},
    restore() {},
    fillRect(...args) { drawCalls.push(["fillRect", ...args]); },
    strokeRect(...args) { drawCalls.push(["strokeRect", ...args]); },
    fillText(...args) { drawCalls.push(["fillText", ...args]); },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    createLinearGradient() {
      return { addColorStop() {} };
    },
  };
  const localStorage = localStorageHarness();
  const context = vm.createContext({
    console,
    localStorage,
    Graphics: { width: 1280, height: 720, context: drawContext },
    Input: {
      isTriggered(code) {
        return triggered.has(code);
      },
      isActionTriggered(action) { return actionTriggered(triggered, action); },
      actionLabel,
    },
    SceneManager: { pop() { pops++; } },
  });

  vm.runInContext(
    `${read("js/core/ConfigManager.js")}\n${read("js/windows/MenuScreenLayout.js")}\n${read("js/windows/ConfigMenuLayout.js")}\n${read("js/windows/Window_Options.js")}\n${read("js/scenes/Scene_Base.js")}\n${read("js/scenes/Scene_Options.js")}\nglobalThis.__classes = { ConfigManager, Scene_Options };`,
    context,
  );

  const { ConfigManager, Scene_Options } = context.__classes;
  ConfigManager.initialize();
  const scene = new Scene_Options();
  scene.draw();

  const text = drawCalls
    .filter((call) => call[0] === "fillText")
    .map((call) => call[1]);
  assert.equal(text.includes("CONFIG"), true);
  assert.equal(text.includes("OPTION"), false);
  assert.equal(text.some((value) => String(value).includes("Battle Speed")), true);

  scene.optionsWindow.index = scene.optionsWindow.options.findIndex(
    (option) => option.type === "magickOrder",
  );
  triggered = new Set(["Enter"]);
  scene.update();
  assert.equal(scene.optionsWindow.isEditingMagickOrder(), true);

  triggered = new Set(["Escape"]);
  scene.update();
  assert.equal(scene.optionsWindow.isEditingMagickOrder(), false);
  assert.equal(pops, 0);

  triggered = new Set(["Escape"]);
  scene.update();
  assert.equal(pops, 1);
}

function testOptionsAreReachableAndLoadBeforeConsumers() {
  const index = read("index.html");
  const menu = read("js/scenes/Scene_Menu.js");
  const main = read("js/main.js");

  assert.equal(index.indexOf("ConfigManager.js") < index.indexOf("Window_Message.js"), true);
  assert.equal(index.indexOf("Window_Options.js") < index.indexOf("Scene_Options.js"), true);
  assert.match(index, /Scene_Options\.js/);
  assert.match(menu, /SceneManager\.push\(Scene_Options\)/);
  assert.match(main, /ConfigManager\.initialize\(\)/);
  assert.match(read("js/windows/Window_BattleMagick.js"), /ConfigManager\.sortMagick/);
  assert.match(read("js/windows/Window_Magick.js"), /ConfigManager\.sortMagick/);
}

function run() {
  testConfigSnapshotsAsGameState();
  testSpeedMappingsAndMagickOrderingAreDeterministic();
  testOptionsWindowCyclesAndPersistsSettings();
  testFieldMessageSpeedControlsRevealAndConfirmBehavior();
  testAtbModePausesOnlyDeepSelectionInWaitMode();
  testBattleSpeedAndMessageSpeedUseSeparateClocks();
  testCursorMemoryPassesStableRememberedIdsIntoSelectors();
  testFullscreenOptionsSceneDrawsAndReturnsToMenu();
  testOptionsAreReachableAndLoadBeforeConsumers();

  console.log("Game options and configuration regression tests passed.");
}

run();
