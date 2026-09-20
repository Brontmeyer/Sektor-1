"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

function loadPresentation(globals = {}) {
  const source = [
    "js/windows/Window_TextLayout.js",
    "js/battle/BattleHudLayout.js",
    "js/battle/BattleRenderer.js",
  ]
    .map(read)
    .join("\n");
  const context = vm.createContext({ console, ...globals });

  vm.runInContext(
    `${source}\nglobalThis.__classes = { BattleHudLayout, BattleRenderer };`,
    context,
  );

  return { ...context.__classes, context };
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
    measureText(text) {
      return { width: String(text).length * 8 };
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
  };
}

function actor(name, hp = 100, mp = 30, valor = 0) {
  return {
    name,
    hp,
    maxHp: 100,
    mp,
    maxMp: 30,
    valor,
    maxValor: 100,
    isValorReady() {
      return this.valor >= this.maxValor;
    },
    isDefeated() {
      return this.hp <= 0;
    },
    statusSummary() {
      return "";
    },
  };
}

function testLayoutProvidesStableFourActorRowsAndTopMessageStrip() {
  const Graphics = { width: 1600, height: 900 };
  const { BattleHudLayout } = loadPresentation({ Graphics });
  const scene = {
    commandWindow: {
      x: 180,
      width: 220,
      sideGap: 12,
      sideWidth: 132,
    },
  };
  const layout = new BattleHudLayout(scene);
  const party = layout.partyBounds();
  const rows = Array.from({ length: 4 }, (_, index) =>
    layout.partyRowBounds(index),
  );

  assert.equal(rows.every((row) => row.x === party.x), true);
  assert.equal(rows.every((row) => row.width === party.width), true);
  assert.equal(rows.every((row) => row.height === rows[0].height), true);
  assert.equal(rows[1].y > rows[0].y, true);
  assert.equal(layout.messageBounds().y < layout.hudBounds().y, true);
  assert.equal(layout.hintY() < layout.hudBounds().y, true);
  assert.equal(party.x > scene.commandWindow.x + scene.commandWindow.width, true);
}

function testHudRendersFourActorsAndHighlightsActiveRow() {
  const context = createContext();
  const Graphics = { width: 1600, height: 900, context };
  const party = [
    actor("Tyler", 85, 22, 40),
    actor("Sarah", 100, 30, 100),
    actor("Aboo", 67, 18, 10),
    actor("G Prime", 0, 12, 0),
  ];
  const globals = {
    Graphics,
    $gameParty: { battleMembers: () => party },
  };
  const { BattleHudLayout, BattleRenderer } = loadPresentation(globals);
  const scene = {
    commandWindow: {
      x: 180,
      width: 220,
      sideGap: 12,
      sideWidth: 132,
    },
    outcome: null,
    pendingEnemyTurn: false,
    battleManager: { currentTurnState: () => "command" },
    partyController: { currentBattler: () => party[1] },
  };
  scene.hudLayout = new BattleHudLayout(scene);
  const renderer = new BattleRenderer(scene);

  renderer.drawBattleHud(context);

  const text = context.calls
    .filter((call) => call[0] === "fillText")
    .map((call) => call[2]);

  for (const battler of party) {
    assert.equal(text.includes(battler.name), true);
  }

  assert.equal(text.includes("VALOR READY"), true);
  assert.equal(text.includes("DEFEATED"), true);
  assert.equal(
    context.calls.some(
      (call) => call[0] === "fillText" && call[1] === "#ffd75a" && call[2] === "Sarah",
    ),
    true,
  );
}

function testTargetFeedbackNamesCurrentTargetAndAllTargetScope() {
  const Graphics = { width: 1600, height: 900 };
  const { BattleRenderer } = loadPresentation({ Graphics });
  const enemy = { name: "Test Slime Alpha" };
  const scene = {
    selectingEnemyTarget: true,
    targetScope: "single",
    targetGroup: "enemy",
    targetManager: { getSelectedTarget: () => enemy },
  };
  const renderer = new BattleRenderer(scene);

  assert.equal(renderer.targetFeedback(), "TARGET // Test Slime Alpha");

  scene.targetScope = "all";
  assert.equal(renderer.targetFeedback(), "TARGET // ALL ENEMIES");

  scene.targetGroup = "ally";
  assert.equal(renderer.targetFeedback(), "TARGET // ALL ALLIES");
}

function testHudLayoutLoadsBeforeRendererAndBattleScene() {
  const source = read("index.html");
  const layoutIndex = source.indexOf("BattleHudLayout.js");
  const rendererIndex = source.indexOf("BattleRenderer.js");
  const sceneIndex = source.indexOf("Scene_Battle.js");

  assert.equal(layoutIndex >= 0, true);
  assert.equal(layoutIndex < rendererIndex, true);
  assert.equal(layoutIndex < sceneIndex, true);
}

function run() {
  testLayoutProvidesStableFourActorRowsAndTopMessageStrip();
  testHudRendersFourActorsAndHighlightsActiveRow();
  testTargetFeedbackNamesCurrentTargetAndAllTargetScope();
  testHudLayoutLoadsBeforeRendererAndBattleScene();

  console.log("Battle HUD and message layout regression tests passed.");
}

run();
