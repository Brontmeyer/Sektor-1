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
    "js/battle/BattleEffects.js",
  ]
    .map((relativePath) =>
      fs.readFileSync(path.join(projectRoot, relativePath), "utf8"),
    )
    .join("\n");
  const context = vm.createContext({ console, ...globals });

  vm.runInContext(
    `${source}\nglobalThis.__classes = { Window_TextLayout, BattleHudLayout, BattleRenderer, BattleEffects };`,
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
      calls.push(["fillRect", this.fillStyle, ...args]);
    },
    strokeRect(...args) {
      calls.push(["strokeRect", this.strokeStyle, ...args]);
    },
    fillText(...args) {
      calls.push(["fillText", this.fillStyle, ...args]);
    },
    strokeText(...args) {
      calls.push(["strokeText", this.strokeStyle, ...args]);
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
    battleBanner: null,
    battleManager: { currentTurnState: () => "command" },
    partyController: { currentBattler: () => ({ name: "Tyler" }) },
    targetManager: {
      allowedScopes: () => ["single"],
      effectiveAllowedScopes: () => ["single"],
    },
    skillsWindow: { isOpen: () => false },
    magickWindow: { isOpen: () => false },
    itemWindow: { isOpen: () => false },
  };
}

function testNoPersistentTopHeaderOrMessagePanel() {
  const source = fs.readFileSync(
    path.join(projectRoot, "js/battle/BattleRenderer.js"),
    "utf8",
  );

  assert.equal(source.includes("drawBattleHeader"), false);
  assert.equal(source.includes("drawBattleMessages"), false);
  assert.equal(source.includes("BATTLE //"), false);
  assert.equal(source.includes("ACTIVE //"), false);
}

function testBannerAppearsOnlyWhenTransientPresentationStateExists() {
  const context = createContext();
  const Graphics = { width: 1600, height: 900, context };
  const { BattleHudLayout, BattleRenderer } = loadPresentation({ Graphics });
  const scene = baseScene();
  scene.hudLayout = new BattleHudLayout(scene);
  const renderer = new BattleRenderer(scene);

  renderer.drawBattleBanner(context);
  assert.equal(context.calls.length, 0);

  scene.battleBanner = { text: "BACK ATTACK", type: "state", timer: 1 };
  renderer.drawBattleBanner(context);

  const panel = context.calls.find((call) => call[0] === "fillRect");
  const text = context.calls.find((call) => call[0] === "fillText");

  assert.notEqual(panel, undefined);
  assert.equal(panel[4] < Graphics.width * 0.5, true);
  assert.equal(text[2], "BACK ATTACK");
}

function testTransientBannerQueuePreservesStateAnnouncementsBeforeActions() {
  const source = fs.readFileSync(
    path.join(projectRoot, "js/scenes/Scene_Battle.js"),
    "utf8",
  );
  const context = vm.createContext({
    console,
    Scene_Base: class {},
    BattleManager: {},
  });

  vm.runInContext(
    `${source}\nglobalThis.__SceneBattle = Scene_Battle;`,
    context,
  );

  const prototype = context.__SceneBattle.prototype;
  const fake = { battleBanner: null, battleBannerQueue: [] };

  assert.equal(prototype.showBattleBanner.call(fake, "BOSS TRANSFORMS", 1, "state"), true);
  assert.equal(prototype.showBattleBanner.call(fake, "Ember", 1, "magick"), true);
  assert.equal(fake.battleBanner.text, "BOSS TRANSFORMS");
  assert.equal(fake.battleBannerQueue.length, 1);

  prototype.updateBattleBanner.call(fake, 1.1);
  assert.equal(fake.battleBanner.text, "Ember");
  assert.equal(fake.battleBannerQueue.length, 0);
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
  assert.match(renderer.battleHint(), /Defend/);

  scene.selectingEnemyTarget = true;
  scene.enemyTargetAction = "skill";
  scene.pendingSkill = { id: 1, scope: ["single", "all"] };
  scene.targetManager.allowedScopes = () => ["single", "all"];
  scene.targetManager.effectiveAllowedScopes = () => ["single", "all"];

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

function testCriticalFlashIsBriefGlobalPresentationEffect() {
  const context = createContext();
  const Graphics = { width: 1280, height: 720, context };
  const { BattleEffects } = loadPresentation({ Graphics });
  const effects = new BattleEffects({});

  effects.start("criticalFlash", null, 0.16);
  effects.draw(context);

  assert.equal(
    context.calls.some(
      (call) =>
        call[0] === "fillRect" &&
        call[2] === 0 &&
        call[3] === 0 &&
        call[4] === Graphics.width &&
        call[5] === Graphics.height,
    ),
    true,
  );
}

function run() {
  testNoPersistentTopHeaderOrMessagePanel();
  testBannerAppearsOnlyWhenTransientPresentationStateExists();
  testTransientBannerQueuePreservesStateAnnouncementsBeforeActions();
  testCommandWindowIsSuppressedDuringTargetSelection();
  testContextualHintsMatchBattleState();
  testCriticalFlashIsBriefGlobalPresentationEffect();

  console.log("Battle presentation feedback regression tests passed.");
}

run();
