"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");

function loadPresentation(globals = {}) {
  const source = [
    "js/windows/Window_TextLayout.js",
    "js/battle/BattleHudLayout.js",
    "js/battle/BattleRenderer.js",
  ]
    .map((relativePath) =>
      fs.readFileSync(path.join(projectRoot, relativePath), "utf8"),
    )
    .join("\n");
  const context = vm.createContext({ console, ...globals });

  vm.runInContext(
    `${source}\nglobalThis.__classes = { Window_TextLayout, BattleHudLayout, BattleRenderer };`,
    context,
  );

  return context.__classes;
}

function createContext() {
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
    strokeText(...args) {
      calls.push(["strokeText", ...args]);
    },
    measureText(text) {
      return { width: String(text).length * 8 };
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
  };
}

function baseScene() {
  return {
    encounter: { name: "Test Slime Pair", canEscape: true },
    outcome: null,
    victory: false,
    defeat: false,
    battleInputLocked: false,
    pendingEnemyTurn: false,
    selectingEnemyTarget: false,
    targetGroup: "enemy",
    targetScope: "single",
    enemyTargetAction: null,
    pendingSkill: null,
    pendingMagick: null,
    battleMessages: [],
    battleManager: { currentTurnState: () => "command" },
    partyController: { currentBattler: () => ({ name: "Tyler" }) },
    targetManager: { allowedScopes: () => ["single"] },
    skillsWindow: { isOpen: () => false },
    magickWindow: { isOpen: () => false },
    itemWindow: { isOpen: () => false },
  };
}

function testHeaderShowsEncounterAndActiveBattler() {
  const context = createContext();
  const Graphics = { width: 1600, height: 900, context };
  const { BattleHudLayout, BattleRenderer } = loadPresentation({ Graphics });
  const scene = baseScene();
  scene.hudLayout = new BattleHudLayout(scene);
  const renderer = new BattleRenderer(scene);

  renderer.drawBattleHeader(context);

  const drawnText = context.calls
    .filter((call) => call[0] === "fillText")
    .map((call) => call[1]);

  assert.equal(drawnText.includes("BATTLE // Test Slime Pair"), true);
  assert.equal(drawnText.includes("ACTIVE // Tyler"), true);

  context.calls.length = 0;
  scene.battleManager.currentTurnState = () => "action";
  renderer.drawBattleHeader(context);

  assert.equal(
    context.calls.some(
      (call) => call[0] === "fillText" && call[1] === "ACTIVE // Tyler",
    ),
    false,
  );
}

function testCommandWindowIsSuppressedDuringTargetSelection() {
  const Graphics = { width: 1600, height: 900, context: createContext() };
  const { BattleHudLayout, BattleRenderer } = loadPresentation({ Graphics });
  const scene = baseScene();
  scene.hudLayout = new BattleHudLayout(scene);
  const renderer = new BattleRenderer(scene);

  assert.equal(renderer.shouldDrawCommandWindow(false), true);

  scene.selectingEnemyTarget = true;
  assert.equal(renderer.shouldDrawCommandWindow(false), false);

  scene.selectingEnemyTarget = false;
  scene.battleInputLocked = true;
  assert.equal(renderer.shouldDrawCommandWindow(false), false);

  scene.battleInputLocked = false;
  assert.equal(renderer.shouldDrawCommandWindow(true), false);
}

function testContextualHintsMatchBattleState() {
  const Graphics = { width: 1600, height: 900, context: createContext() };
  const { BattleHudLayout, BattleRenderer } = loadPresentation({ Graphics });
  const scene = baseScene();
  scene.hudLayout = new BattleHudLayout(scene);
  const renderer = new BattleRenderer(scene);

  assert.match(renderer.battleHint(), /Escape/);
  assert.doesNotMatch(renderer.battleHint(), /Test Battle/);

  scene.encounter.canEscape = false;
  assert.match(renderer.battleHint(), /Escape/);
  assert.match(renderer.battleHint(), /Defend/);

  scene.selectingEnemyTarget = true;
  scene.enemyTargetAction = "skill";
  scene.pendingSkill = { id: 1, scope: ["single", "all"] };
  scene.targetManager.allowedScopes = () => ["single", "all"];

  assert.match(renderer.battleHint(), /Single Enemies/);
  assert.match(renderer.battleHint(), /R: Scope/);
  assert.match(renderer.battleHint(), /Confirm/);

  scene.selectingEnemyTarget = false;
  scene.skillsWindow.isOpen = () => true;
  assert.match(renderer.battleHint(), /Choose/);
  assert.match(renderer.battleHint(), /Back/);

  scene.skillsWindow.isOpen = () => false;
  scene.battleInputLocked = true;
  assert.equal(renderer.battleHint(), "Resolving battle...");

  scene.battleInputLocked = false;
  scene.outcome = "victory";
  assert.equal(renderer.battleHint(), "E / Enter / Esc: Continue");
}

function testBattleMessagesWrapInsideBoundedPanel() {
  const context = createContext();
  const Graphics = { width: 1000, height: 720, context };
  const { BattleHudLayout, BattleRenderer } = loadPresentation({ Graphics });
  const scene = baseScene();
  scene.hudLayout = new BattleHudLayout(scene);
  scene.battleMessages = [
    "Tyler uses an intentionally long battle action message that should remain inside the feedback panel instead of spilling across the battlefield.",
    "Test Slime takes an equally long amount of descriptive feedback so the second recent message is bounded too.",
  ];
  const renderer = new BattleRenderer(scene);

  renderer.drawBattleMessages(context);

  const panel = context.calls.find((call) => call[0] === "fillRect");
  const textCalls = context.calls.filter((call) => call[0] === "fillText");

  assert.notEqual(panel, undefined);
  assert.equal(textCalls.length > 0, true);
  assert.equal(textCalls.length <= 3, true);

  const [, panelX, , panelWidth] = panel;
  const innerWidth = panelWidth - 32;

  for (const call of textCalls) {
    const [, text, x] = call;
    assert.equal(x >= panelX + 16, true);
    assert.equal(context.measureText(text).width <= innerWidth, true);
  }
}

function testRendererNoLongerHardCodesTestBattleExitCopy() {
  const source = fs.readFileSync(
    path.join(projectRoot, "js/battle/BattleRenderer.js"),
    "utf8",
  );

  assert.equal(source.includes("Leave Test Battle"), false);
  assert.equal(source.includes("drawBattleHint"), true);
  assert.equal(source.includes("Window_TextLayout.wrapLines"), true);
}

function run() {
  testHeaderShowsEncounterAndActiveBattler();
  testCommandWindowIsSuppressedDuringTargetSelection();
  testContextualHintsMatchBattleState();
  testBattleMessagesWrapInsideBoundedPanel();
  testRendererNoLongerHardCodesTestBattleExitCopy();

  console.log("Battle presentation feedback regression tests passed.");
}

run();
