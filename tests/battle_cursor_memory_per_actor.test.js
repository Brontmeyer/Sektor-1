"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

function storageHarness() {
  const store = new Map();
  return {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); },
  };
}

function loadScenePrototype() {
  const gameParty = {
    members: [],
    battleMembers() { return this.members; },
  };
  const context = vm.createContext({
    console,
    localStorage: storageHarness(),
    Scene_Base: class {},
    BattleManager: { OUTCOME_VICTORY: "victory" },
    $gameParty: gameParty,
  });

  vm.runInContext(
    `${read("js/core/ConfigManager.js")}\n${read("js/scenes/Scene_Battle.js")}\n` +
      `globalThis.__classes = { ConfigManager, Scene_Battle };`,
    context,
  );

  context.__classes.ConfigManager.initialize();
  return { ...context.__classes, gameParty };
}

function makeSceneMemoryHarness(Scene_Battle) {
  const scene = Object.create(Scene_Battle.prototype);
  scene.battleCursorMemory = new Map();
  scene.commandWindow = {
    commands: ["Attack", "Magick", "Skills", "Item"],
    index: 0,
    sideCommand: null,
    closeSide() { this.sideCommand = null; },
    ensureEnabledSelection() { return true; },
  };
  return scene;
}

function testMemoryIsActorSpecificAndUsesStableIds() {
  const { ConfigManager, Scene_Battle } = loadScenePrototype();
  const scene = makeSceneMemoryHarness(Scene_Battle);
  const tyler = { actorId: 1, name: "Renamable Protagonist" };
  const sarah = { actorId: 2, name: "Renamable Companion" };

  ConfigManager.set("battleCursorMemory", "memory", { persist: false });

  assert.equal(scene.rememberBattleCommand(tyler, "Magick"), true);
  assert.equal(scene.rememberBattleSelection(tyler, "magick", { id: 10, name: "Renamed Ember" }), true);
  assert.equal(scene.rememberBattleCommand(sarah, "Item"), true);
  assert.equal(scene.rememberBattleSelection(sarah, "item", { id: 2, name: "Renamed Grenade" }), true);

  scene.prepareBattleCommandCursor(tyler);
  assert.equal(scene.commandWindow.commands[scene.commandWindow.index], "Magick");
  assert.equal(scene.rememberedBattleSelectionId(tyler, "magick"), 10);
  assert.equal(scene.rememberedBattleSelectionId(tyler, "item"), null);

  scene.prepareBattleCommandCursor(sarah);
  assert.equal(scene.commandWindow.commands[scene.commandWindow.index], "Item");
  assert.equal(scene.rememberedBattleSelectionId(sarah, "item"), 2);
  assert.equal(scene.rememberedBattleSelectionId(sarah, "magick"), null);
}

function loadSelector(relativePath, className, globals) {
  const context = vm.createContext({ console, ...globals });
  vm.runInContext(
    `${read("js/windows/Window_ListViewport.js")}\n${read(relativePath)}\n` +
      `globalThis.__Class = ${className};`,
    context,
  );
  return context.__Class;
}

function testSelectorsRestoreByIdAndFallbackWhenEntryDisappears() {
  const magick = [
    { id: 10, name: "Ember", type: "magick", mpCost: 4 },
    { id: 13, name: "Frost", type: "magick", mpCost: 4 },
  ];
  const actor = {
    knownMagick: () => magick,
    canUseMagick: (id) => id !== 10,
  };
  const globals = {
    Graphics: { height: 720, context: {} },
    Input: { isActionTriggered: () => false },
    $gameParty: { battleLeader: () => actor },
  };
  const Window_BattleMagick = loadSelector(
    "js/windows/Window_BattleMagick.js",
    "Window_BattleMagick",
    globals,
  );
  const window = new Window_BattleMagick({
    partyController: { currentBattler: () => actor },
  });

  window.show({ preferredId: 13 });
  assert.equal(window.currentMagick().id, 13);

  // Remembered entries remain selectable even when temporarily unusable.
  window.show({ preferredId: 10 });
  assert.equal(window.currentMagick().id, 10);
  assert.equal(actor.canUseMagick(window.currentMagick().id), false);

  magick.splice(0, 1);
  window.show({ preferredId: 10 });
  assert.equal(window.index, 0);
  assert.equal(window.currentMagick().id, 13);
}

function testInitialModeResetsCommandCursor() {
  const { ConfigManager, Scene_Battle } = loadScenePrototype();
  const scene = makeSceneMemoryHarness(Scene_Battle);
  const actor = { actorId: 1 };

  ConfigManager.set("battleCursorMemory", "memory", { persist: false });
  scene.rememberBattleCommand(actor, "Item");
  scene.prepareBattleCommandCursor(actor);
  assert.equal(scene.commandWindow.index, 3);

  ConfigManager.set("battleCursorMemory", "initial", { persist: false });
  scene.prepareBattleCommandCursor(actor);
  assert.equal(scene.commandWindow.index, 0);
  assert.equal(scene.rememberedBattleSelectionId(actor, "item"), null);
}

function testTargetMemoryIsPerActorPerActionAndFallsBackWhenIllegal() {
  const { ConfigManager, Scene_Battle, gameParty } = loadScenePrototype();
  const scene = makeSceneMemoryHarness(Scene_Battle);
  const tyler = { actorId: 1, isValorArt: () => false };
  const sarah = { actorId: 2, isValorArt: () => false };
  const enemyA = { name: "A", alive: true };
  const enemyB = { name: "B", alive: true };
  const ember = { id: 10, name: "Renamed Ember" };
  const frost = { id: 13, name: "Renamed Frost" };

  gameParty.members = [tyler, sarah];
  scene.enemies = [enemyA, enemyB];
  scene.targetGroup = "enemy";
  scene.selectedEnemyIndex = 0;
  scene.targetManager = {
    isSelectableTarget(target) { return target?.alive !== false; },
    selectBattler(target) {
      const enemyIndex = scene.enemies.indexOf(target);
      if (enemyIndex >= 0) {
        scene.targetGroup = "enemy";
        scene.selectedEnemyIndex = enemyIndex;
        return target;
      }
      const allyIndex = gameParty.members.indexOf(target);
      if (allyIndex >= 0) {
        scene.targetGroup = "ally";
        scene.selectedAllyIndex = allyIndex;
        return target;
      }
      return null;
    },
  };

  ConfigManager.set("battleCursorMemory", "memory", { persist: false });
  assert.equal(scene.rememberBattleTarget(tyler, "magick", ember, enemyB), true);
  assert.equal(scene.rememberBattleTarget(sarah, "magick", ember, enemyA), true);

  // Stable action ID, not display name, owns the remembered target.
  assert.equal(
    scene.restoreRememberedBattleTarget(
      tyler,
      "magick",
      { id: 10, name: "Ember Renamed Again" },
    ),
    enemyB,
  );
  assert.equal(scene.selectedEnemyIndex, 1);
  assert.equal(scene.rememberedBattleTarget(tyler, "magick", frost), null);
  assert.equal(scene.rememberedBattleTarget(sarah, "magick", ember), enemyA);

  // Dead/removed/otherwise illegal targets are forgotten and callers may use
  // their normal first-target fallback.
  enemyB.alive = false;
  assert.equal(scene.restoreRememberedBattleTarget(tyler, "magick", ember), null);
  assert.equal(scene.rememberedBattleTarget(tyler, "magick", ember), null);

  ConfigManager.set("battleCursorMemory", "initial", { persist: false });
  assert.equal(scene.rememberBattleTarget(tyler, "attack", null, enemyA), false);
  assert.equal(scene.rememberedBattleTarget(sarah, "magick", ember), null);
}

function testBattleTargetMemoryIsWiredIntoActionOpenAndConfirmation() {
  const managerSource = read("js/battle/BattleManager.js");
  const sceneSource = read("js/scenes/Scene_Battle.js");
  const restores = managerSource.match(/restoreRememberedBattleTarget\?\.\(/g) || [];

  assert.equal(restores.length, 4);
  assert.match(managerSource, /restoreRememberedBattleTarget\?\.\(battler, "attack", null\)/);
  assert.match(managerSource, /restoreRememberedBattleTarget\?\.\(battler, "skill", skill\)/);
  assert.match(managerSource, /restoreRememberedBattleTarget\?\.\(battler, "magick", magick\)/);
  assert.match(managerSource, /restoreRememberedBattleTarget\?\.\(battler, "item", item\)/);
  assert.match(sceneSource, /rememberBattleTarget\(actor, action, definition, target\)/);
}

function run() {
  testMemoryIsActorSpecificAndUsesStableIds();
  testSelectorsRestoreByIdAndFallbackWhenEntryDisappears();
  testInitialModeResetsCommandCursor();
  testTargetMemoryIsPerActorPerActionAndFallsBackWhenIllegal();
  testBattleTargetMemoryIsWiredIntoActionOpenAndConfirmation();
  console.log("Per-actor battle cursor memory regression tests passed.");
}

run();
