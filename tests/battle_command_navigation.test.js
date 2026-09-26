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
    ["Attack", "Magick", "Skills", "Item"],
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


function testSurgeChipAppearsOnlyWhenReadyAndOpensAboveAttack() {
  let ready = false;
  const art = { id: 1, name: "Unbroken", valorArt: true };
  const actor = {
    isValorSurgeReady: () => ready,
    selectedValorArts: () => [art],
    canUseSkill: () => true,
    canUseValorArt: () => true,
    canUseBattleAction: () => true,
    isPlayerControlled: () => true,
    knownSkills: () => [],
  };
  const { window, context, trigger, clear } = loadBattleCommand({ actor });
  const drawContext = context.Graphics.context;

  window.draw();
  let text = drawContext.calls
    .filter((call) => call[0] === "fillText")
    .map((call) => String(call[1]));
  assert.equal(text.some((value) => value.includes("SURGE")), false);

  ready = true;
  drawContext.calls.length = 0;
  window.draw();
  text = drawContext.calls
    .filter((call) => call[0] === "fillText")
    .map((call) => String(call[1]));
  assert.equal(text.includes("SURGE"), true);

  window.index = 0;
  trigger("ArrowUp");
  window.update();
  clear();
  assert.equal(window.currentCommand(), "Surge");
  assert.equal(window.hasSideCommandOpen(), true);

  trigger("ArrowDown");
  window.update();
  clear();
  assert.equal(window.hasSideCommandOpen(), false);
  assert.equal(window.currentCommand(), "Attack");
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

  fake.commandWindow.currentCommand = () => "Surge";
  assert.equal(prototype.confirmCommandSelection.call(fake), "Surge");
  assert.equal(executed, "Surge");
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
    { id: 1, name: "Potion", effect: { type: "healHp", value: 50 } },
    { id: 2, name: "Ether", effect: { type: "healHp", value: 20 } },
    { id: 3, name: "Test Key", keyItem: true, effect: null },
  ];
  const Window_BattleItem = loadSelector(
    "js/windows/Window_BattleItem.js",
    "Window_BattleItem",
    {
      Graphics: { height: 720, context: createDrawContext() },
      Input: { isTriggered: () => false },
      $gameParty: {
        itemIds: () => [1, 2, 3],
        itemCount: () => 1,
      },
      DatabaseManager: { item: (id) => itemEntries[id - 1] || null },
    },
  );
  const itemWindow = new Window_BattleItem();

  assert.deepEqual(
    Array.from(itemWindow.items(), (item) => item.name),
    ["Potion", "Ether"],
  );

  itemWindow.show();
  itemWindow.index = 1;
  itemWindow.hide();
  itemWindow.show({ preserveIndex: true });
  assert.equal(itemWindow.index, 1);
}

function testBattleSelectorsAnchorAbovePersistentCommandWindow() {
  const commandBounds = { x: 190, y: 540, width: 220, height: 156 };
  const actor = {
    knownSkills: () => [{ id: 6, name: "Scan", type: "skill" }],
    selectedValorArts: () => [
      { id: 1, name: "Unbroken", type: "valor", valorLevel: 1 },
      { id: 7, name: "Second Art", type: "valor", valorLevel: 1 },
    ],
    canUseSkill: () => true,
    canUseValorArt: () => true,
    knownMagick: () => [{ id: 10, name: "Ember", type: "magick", mpCost: 4 }],
    canUseMagick: () => true,
  };
  const scene = {
    hudLayout: { commandBounds: () => commandBounds },
    partyController: { currentBattler: () => actor },
  };
  const globals = {
    Graphics: { height: 720, context: createDrawContext() },
    Input: { isActionTriggered: () => false },
    $gameParty: {
      battleLeader: () => actor,
      itemIds: () => [1],
      itemCount: () => 1,
    },
    DatabaseManager: {
      item: () => ({ id: 1, name: "Potion", effect: { type: "healHp", value: 50 } }),
    },
  };

  const Skills = loadSelector("js/windows/Window_BattleSkills.js", "Window_BattleSkills", globals);
  const Magick = loadSelector("js/windows/Window_BattleMagick.js", "Window_BattleMagick", globals);
  const Item = loadSelector("js/windows/Window_BattleItem.js", "Window_BattleItem", globals);

  const skills = new Skills(scene);
  skills.show({ mode: "skills" });
  assert.equal(skills.x, commandBounds.x);
  assert.equal(skills.y + skills.height, commandBounds.y);

  skills.show({ mode: "surge" });
  assert.equal(skills.x, commandBounds.x);
  assert.equal(skills.width, commandBounds.width);
  assert.equal(skills.y + skills.height, commandBounds.y);
  assert.equal(skills.height < 160, true, "two-Art Surge selector stays compact");

  const magick = new Magick(scene);
  magick.show();
  assert.equal(magick.x, commandBounds.x);
  assert.equal(magick.y + magick.height, commandBounds.y);

  const item = new Item(scene);
  item.show();
  assert.equal(item.x, commandBounds.x);
  assert.equal(item.y + item.height, commandBounds.y);
}

function run() {
  testMainCommandListContainsOnlyFourCoreCommands();
  testSideCommandsStayHiddenUntilHorizontalInputRequestsThem();
  testSurgeChipAppearsOnlyWhenReadyAndOpensAboveAttack();
  testSideWindowsAreFlushWithMainCommandTopAndEdges();
  testBossEscapeSideActionRemainsFocusableButDisabled();
  testSideCommandConfirmationDelegatesEscapeAndDefendPaths();
  testTargetCancelReturnsToOriginatingSelectorWithCursorPreserved();
  testSelectorShowCanPreserveCursorForTargetCancel();
  testMagickAndItemSelectorsAlsoSupportPreservedReopen();
  testBattleSelectorsAnchorAbovePersistentCommandWindow();

  console.log("Battle command navigation regression tests passed.");
}

run();
