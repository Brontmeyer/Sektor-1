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

function testLayoutSeparatesNamesCommandReserveAndStableStats() {
  const Graphics = { width: 1600, height: 900 };
  const { BattleHudLayout } = loadPresentation({ Graphics });
  const layout = new BattleHudLayout({});
  const hud = layout.hudBounds();
  const names = layout.nameColumnBounds();
  const command = layout.commandBounds();
  const stats = layout.statsBounds();
  const rows = Array.from({ length: 4 }, (_, index) =>
    layout.partyRowBounds(index),
  );

  assert.equal(names.x, hud.x);
  assert.equal(command.x, names.x + names.width);
  assert.equal(stats.x, command.x + command.width);
  assert.equal(stats.x + stats.width, hud.x + hud.width);
  assert.equal(rows.every((row) => row.height === rows[0].height), true);
  assert.equal(rows[1].y > rows[0].y, true);
  assert.equal(layout.hintY() < hud.y, true);
}

function testBannerIsCompactAndDoesNotSpanTheScreen() {
  const Graphics = { width: 1600, height: 900 };
  const { BattleHudLayout } = loadPresentation({ Graphics });
  const layout = new BattleHudLayout({});
  const short = layout.bannerBounds(80);
  const long = layout.bannerBounds(2000);

  assert.equal(short.width < Graphics.width * 0.5, true);
  assert.equal(long.width <= Graphics.width * 0.46, true);
  assert.equal(short.x > 0, true);
}

function testTacticalHelpIsCompactAndCenteredAboveHud() {
  const Graphics = { width: 1600, height: 900 };
  const scene = { scanManager: { isHelpVisible: () => true } };
  const { BattleHudLayout } = loadPresentation({ Graphics });
  const layout = new BattleHudLayout(scene);
  const hud = layout.hudBounds();
  const help = layout.tacticalHelpBounds();

  assert.equal(help.height < 60, true);
  assert.equal(help.width < hud.width, true);
  assert.equal(help.x > hud.x, true);
  assert.equal(help.x + help.width < hud.x + hud.width, true);
  assert.equal(help.y + help.height < hud.y, true);
  assert.equal(layout.hintY() < help.y, true);
}

function testHudRendersFourNamesAndKeepsResourceColumnsRightOfCommandReserve() {
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
    outcome: null,
    pendingEnemyTurn: false,
    battleManager: { currentTurnState: () => "command" },
    partyController: { currentBattler: () => party[1] },
  };
  scene.hudLayout = new BattleHudLayout(scene);
  const renderer = new BattleRenderer(scene);

  renderer.drawBattleHud(context);

  const textCalls = context.calls.filter((call) => call[0] === "fillText");
  const text = textCalls.map((call) => call[2]);
  const statsX = scene.hudLayout.statsBounds().x;

  for (const battler of party) {
    assert.equal(text.includes(battler.name), true);
  }

  assert.equal(text.includes("VALOR READY"), true);
  assert.equal(text.includes("DEFEATED"), true);
  assert.equal(
    textCalls.some(
      (call) => call[1] === "#ffd75a" && call[2] === "Sarah",
    ),
    true,
  );

  for (const call of textCalls.filter((call) => /^(HP|MP|VALOR)/.test(call[2]))) {
    assert.equal(call[3] >= statsX, true);
  }
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
  testLayoutSeparatesNamesCommandReserveAndStableStats();
  testBannerIsCompactAndDoesNotSpanTheScreen();
  testTacticalHelpIsCompactAndCenteredAboveHud();
  testHudRendersFourNamesAndKeepsResourceColumnsRightOfCommandReserve();
  testHudLayoutLoadsBeforeRendererAndBattleScene();

  console.log("Battle HUD and message layout regression tests passed.");
}

run();
