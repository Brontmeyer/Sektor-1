"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");

const defaultActionCodes = {
  up: ["KeyW", "ArrowUp"],
  down: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  confirm: ["KeyE", "Enter"],
  cancel: ["KeyQ", "Escape"],
  menu: ["Escape"],
  interact: ["KeyE"],
  help: ["KeyH"],
  scope: ["KeyR"],
};

function actionTriggered(triggered, action) {
  return (defaultActionCodes[action] || []).some((code) => triggered.has(code));
}

function actionLabel(action) {
  const labels = {
    up: "W / ↑", down: "S / ↓", left: "A / ←", right: "D / →",
    confirm: "E / Enter", cancel: "Q / Esc", menu: "Esc",
    interact: "E", help: "H", scope: "R",
  };
  return labels[action] || action;
}

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function loadBattleCommand({ actor = null, canEscape = true } = {}) {
  let triggered = new Set();
  const context = vm.createContext({
    console,
    Graphics: { height: 720, context: createDrawContext() },
    Input: {
      isTriggered(code) {
        return triggered.has(code);
      },
      isActionTriggered(action) {
        return actionTriggered(triggered, action);
      },
      actionLabel,
    },
  });

  vm.runInContext(
    `${read("js/windows/Window_BattleCommand.js")}\nglobalThis.__Class = Window_BattleCommand;`,
    context,
  );

  const scene = {
    encounter: { canEscape },
    partyController: { currentBattler: () => actor },
  };
  const window = new context.__Class(scene);

  return {
    window,
    context,
    trigger(...codes) {
      triggered = new Set(codes);
    },
    clear() {
      triggered = new Set();
    },
  };
}

function createDrawContext() {
  const calls = [];

  return {
    calls,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    font: "",
    textAlign: "",
    textBaseline: "",
    globalAlpha: 1,
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
  };
}

function testMainCommandListContainsOnlyFourCoreCommands() {
  const { window } = loadBattleCommand();

  assert.deepEqual(
    Array.from(window.commands),
    ["Attack", "Skills", "Magick", "Item"],
  );
  assert.equal(window.hasSideCommandOpen(), false);
  assert.equal(window.currentCommand(), "Attack");
}

function testSideCommandsStayHiddenUntilHorizontalInputRequestsThem() {
  const { window, context, trigger, clear } = loadBattleCommand();
  const drawContext = context.Graphics.context;

  window.draw();
  let text = drawContext.calls
    .filter((call) => call[0] === "fillText")
    .map((call) => call[1]);
  assert.equal(text.includes("Escape"), false);
  assert.equal(text.includes("Defend"), false);

  trigger("ArrowLeft");
  window.update();
  clear();
  assert.equal(window.currentCommand(), "Escape");
  assert.equal(window.hasSideCommandOpen(), true);

  drawContext.calls.length = 0;
  window.draw();
  text = drawContext.calls
    .filter((call) => call[0] === "fillText")
    .map((call) => call[1]);
  assert.equal(text.includes("Escape"), true);
  assert.equal(text.includes("Defend"), false);

  trigger("ArrowRight");
  window.update();
  clear();
  assert.equal(window.hasSideCommandOpen(), false);

  trigger("ArrowRight");
  window.update();
  clear();
  assert.equal(window.currentCommand(), "Defend");

  drawContext.calls.length = 0;
  window.draw();
  text = drawContext.calls
    .filter((call) => call[0] === "fillText")
    .map((call) => call[1]);
  assert.equal(text.includes("Escape"), false);
  assert.equal(text.includes("Defend"), true);
}

function testSideWindowsAreFlushWithMainCommandTopAndEdges() {
  const { window, context } = loadBattleCommand();
  const drawContext = context.Graphics.context;

  window.openSide("Escape");
  window.draw();

  const rects = drawContext.calls.filter((call) => call[0] === "strokeRect");
  const main = rects.find(
    (call) => call[1] === window.x && call[2] === window.y && call[3] === window.width,
  );
  const escape = rects.find(
    (call) => call[1] === window.x - window.sideWidth && call[2] === window.y,
  );

  assert.notEqual(main, undefined);
  assert.notEqual(escape, undefined);
  assert.equal(window.sideGap, 0);

  window.closeSide();
  drawContext.calls.length = 0;
  window.openSide("Defend");
  window.draw();

  const defend = drawContext.calls.find(
    (call) =>
      call[0] === "strokeRect" &&
      call[1] === window.x + window.width &&
      call[2] === window.y,
  );

  assert.notEqual(defend, undefined);
}

function testBossEscapeSideActionRemainsFocusableButDisabled() {
  const { window, trigger, clear } = loadBattleCommand({ canEscape: false });

  trigger("ArrowLeft");
  window.update();
  clear();

  assert.equal(window.currentCommand(), "Escape");
  assert.equal(window.isCommandEnabled("Escape"), false);
}

function loadSceneBattlePrototype() {
  const context = vm.createContext({
    console,
    Scene_Base: class {},
    BattleManager: { OUTCOME_ESCAPE: "escape" },
  });

  vm.runInContext(
    `${read("js/scenes/Scene_Battle.js")}\nglobalThis.__Class = Scene_Battle;`,
    context,
  );

  return context.__Class.prototype;
}

function testSideCommandConfirmationDelegatesEscapeAndDefendPaths() {
  const prototype = loadSceneBattlePrototype();
  let closed = 0;
  let executed = null;
  let finished = null;
  let escapeAttempt = { allowed: false, success: false };
  const fake = {
    commandWindow: {
      currentCommand: () => "Escape",
      hasSideCommandOpen: () => true,
      closeSide() {
        closed++;
      },
    },
    battleManager: {
      attemptEscape() {
        return escapeAttempt;
      },
    },
    finishBattle(outcome) {
      finished = outcome;
      return outcome;
    },
    executeCommand(command) {
      executed = command;
      return command;
    },
  };

  assert.equal(prototype.confirmCommandSelection.call(fake), false);
  assert.equal(closed, 1);
  assert.equal(finished, null);
  assert.equal(executed, null);

  escapeAttempt = { allowed: true, success: true };
  assert.equal(prototype.confirmCommandSelection.call(fake), "escape");
  assert.equal(finished, "escape");

  fake.commandWindow.currentCommand = () => "Defend";
  assert.equal(prototype.confirmCommandSelection.call(fake), "Defend");
  assert.equal(executed, "Defend");
}

function testTargetCancelReturnsToOriginatingSelectorWithCursorPreserved() {
  const prototype = loadSceneBattlePrototype();
  const shown = [];
  const fake = {
    selectingEnemyTarget: true,
    enemyTargetAction: "magick",
    pendingSkill: { id: 1 },
    pendingSkillTarget: {},
    pendingMagick: { id: 10 },
    pendingMagickTarget: {},
    targetGroup: "ally",
    targetScope: "all",
    skillsWindow: { show(options) { shown.push(["skills", options]); } },
    magickWindow: { show(options) { shown.push(["magick", options]); } },
    itemWindow: { show(options) { shown.push(["item", options]); } },
  };

  assert.equal(prototype.cancelTargetSelection.call(fake), "magick");
  assert.equal(shown.length, 1);
  assert.equal(shown[0][0], "magick");
  assert.equal(shown[0][1].preserveIndex, true);
  assert.equal(fake.selectingEnemyTarget, false);
  assert.equal(fake.enemyTargetAction, null);
  assert.equal(fake.pendingSkill, null);
  assert.equal(fake.pendingSkillTarget, null);
  assert.equal(fake.pendingMagick, null);
  assert.equal(fake.pendingMagickTarget, null);
  assert.equal(fake.targetGroup, "enemy");
  assert.equal(fake.targetScope, "single");

  shown.length = 0;
  fake.enemyTargetAction = "skill";
  assert.equal(prototype.cancelTargetSelection.call(fake), "skill");
  assert.equal(shown.length, 1);
  assert.equal(shown[0][0], "skills");
  assert.equal(shown[0][1].preserveIndex, true);
}

function loadSelector(relativePath, className, globals) {
  const context = vm.createContext({ console, ...globals });
  vm.runInContext(
    `${read("js/windows/Window_ListViewport.js")}\n${read(relativePath)}\nglobalThis.__Class = ${className};`,
    context,
  );
  return context.__Class;
}

function testSelectorShowCanPreserveCursorForTargetCancel() {
  const skills = [
    { id: 1, name: "One", type: "skill" },
    { id: 2, name: "Two", type: "skill" },
    { id: 3, name: "Three", type: "skill" },
  ];
  const actor = {
    knownSkills: () => skills,
    canUseSkill: () => true,
  };
  const Window_BattleSkills = loadSelector(
    "js/windows/Window_BattleSkills.js",
    "Window_BattleSkills",
    {
      Graphics: { height: 720, context: createDrawContext() },
      Input: { isTriggered: () => false },
      $gameParty: { battleLeader: () => actor },
    },
  );
  const window = new Window_BattleSkills({
    partyController: { currentBattler: () => actor },
  });

  window.show();
  window.index = 2;
  window.hide();
  window.show({ preserveIndex: true });
  assert.equal(window.index, 2);

  window.hide();
  window.show();
  assert.equal(window.index, 0);
}


function testMagickAndItemSelectorsAlsoSupportPreservedReopen() {
  const magickEntries = [
    { id: 10, name: "Ember", type: "magick", mpCost: 4 },
    { id: 11, name: "Frost", type: "magick", mpCost: 4 },
  ];
  const actor = {
    knownMagick: () => magickEntries,
    canUseMagick: () => true,
  };
  const Window_BattleMagick = loadSelector(
    "js/windows/Window_BattleMagick.js",
    "Window_BattleMagick",
    {
      Graphics: { height: 720, context: createDrawContext() },
      Input: { isTriggered: () => false },
      $gameParty: { battleLeader: () => actor },
    },
  );
  const magickWindow = new Window_BattleMagick({
    partyController: { currentBattler: () => actor },
  });

  magickWindow.show();
  magickWindow.index = 1;
  magickWindow.hide();
  magickWindow.show({ preserveIndex: true });
  assert.equal(magickWindow.index, 1);

  const itemEntries = [
    { id: 1, name: "Potion" },
    { id: 2, name: "Ether" },
  ];
  const Window_BattleItem = loadSelector(
    "js/windows/Window_BattleItem.js",
    "Window_BattleItem",
    {
      Graphics: { height: 720, context: createDrawContext() },
      Input: { isTriggered: () => false },
      $gameParty: {
        itemIds: () => [1, 2],
        itemCount: () => 1,
      },
      DatabaseManager: { item: (id) => itemEntries[id - 1] || null },
    },
  );
  const itemWindow = new Window_BattleItem();

  itemWindow.show();
  itemWindow.index = 1;
  itemWindow.hide();
  itemWindow.show({ preserveIndex: true });
  assert.equal(itemWindow.index, 1);
}

function run() {
  testMainCommandListContainsOnlyFourCoreCommands();
  testSideCommandsStayHiddenUntilHorizontalInputRequestsThem();
  testSideWindowsAreFlushWithMainCommandTopAndEdges();
  testBossEscapeSideActionRemainsFocusableButDisabled();
  testSideCommandConfirmationDelegatesEscapeAndDefendPaths();
  testTargetCancelReturnsToOriginatingSelectorWithCursorPreserved();
  testSelectorShowCanPreserveCursorForTargetCancel();
  testMagickAndItemSelectorsAlsoSupportPreservedReopen();

  console.log("Battle command navigation regression tests passed.");
}

run();
