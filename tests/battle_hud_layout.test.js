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
    "js/core/UIResourcePalette.js",
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

function testIdleBattleHudSuppressesTopRightCommandLegend() {
  const Graphics = { width: 1600, height: 900 };
  const { BattleHudLayout, BattleRenderer } = loadPresentation({
    Graphics,
    Input: { actionLabel: (action) => action },
  });
  const scene = {
    outcome: null,
    selectingEnemyTarget: false,
    skillsWindow: { isOpen: () => false },
    magickWindow: { isOpen: () => false },
    itemWindow: { isOpen: () => false },
    commandWindow: { hasSideCommandOpen: () => false },
  };
  scene.hudLayout = new BattleHudLayout(scene);
  const renderer = new BattleRenderer(scene);

  assert.equal(renderer.shouldDrawBattleHint(), false);

  scene.commandWindow.hasSideCommandOpen = () => true;
  assert.equal(renderer.shouldDrawBattleHint(), true);
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
  const formation = [party[2], party[1], party[3], party[0]];
  const globals = {
    Graphics,
    $gameParty: {
      battleMembers: () => party,
      battleFormationMembers: () => formation,
    },
  };
  const { BattleHudLayout, BattleRenderer } = loadPresentation(globals);
  const timeValues = new Map([
    [party[0], 25],
    [party[1], 100],
    [party[2], 60],
    [party[3], 0],
  ]);
  const scene = {
    outcome: null,
    pendingEnemyTurn: false,
    battleManager: { currentTurnState: () => "command" },
    partyController: { currentBattler: () => party[1] },
    timeManager: {
      value: (battler) => timeValues.get(battler) || 0,
      maximum: () => 100,
      isReady: (battler) => (timeValues.get(battler) || 0) >= 100,
    },
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

  const renderedNames = text.filter((entry) =>
    party.some((battler) => battler.name === entry),
  );
  assert.deepEqual(
    renderedNames,
    ["Aboo", "Sarah", "G Prime", "Tyler"],
    "battle HUD roster must follow visual formation order",
  );

  for (const battler of formation.filter((entry) => !entry.isDefeated())) {
    const rowIndex = formation.indexOf(battler);
    const row = scene.hudLayout.partyRowBounds(rowIndex);
    const expectedCenterY = row.y + row.height / 2;
    const nameCall = textCalls.find((call) => call[2] === battler.name);

    assert.ok(nameCall, `expected ${battler.name} to render`);
    assert.equal(
      nameCall[4],
      expectedCenterY,
      `${battler.name} should sit on the centerline of battle row ${rowIndex + 1}`,
    );
  }

  assert.equal(text.includes("VALOR"), true);
  assert.equal(text.includes("TIME"), true);
  assert.equal(text.includes("DEFEATED"), true);
  assert.equal(
    text.filter((entry) => entry === "READY").length,
    1,
    "only Valor should render READY text; Time readiness is communicated by its full gauge",
  );
  assert.equal(text.includes("25/100"), false);
  assert.equal(text.includes("60/100"), false);
  assert.equal(
    textCalls.some(
      (call) => call[1] === "#ffd75a" && call[2] === "Sarah",
    ),
    true,
  );
  assert.equal(
    textCalls.some(
      (call) => call[1] === "#66d7ff" && call[2] === "HP",
    ),
    true,
    "HP label should use the shared blue-cyan resource color",
  );
  assert.equal(
    textCalls.some(
      (call) => call[1] === "#ffffff" && call[2] === "67/100",
    ),
    true,
    "HP numbers should remain neutral white",
  );
  assert.equal(
    textCalls.some(
      (call) => call[1] === "#78ef91" && call[2] === "MP",
    ),
    true,
    "MP label should use the shared green resource color",
  );
  assert.equal(
    textCalls.some(
      (call) => call[1] === "#ffffff" && call[2] === "18/30",
    ),
    true,
    "MP numbers should remain neutral white",
  );
  assert.equal(
    textCalls.some(
      (call) => call[1] === "#e3a0ff" && call[2] === "VALOR",
    ),
    true,
    "Valor label should use the shared magenta resource color",
  );
  assert.equal(
    textCalls.some(
      (call) => call[1] === "#ffffff" && call[2] === "10/100",
    ),
    true,
    "Valor numbers should remain neutral white",
  );
  assert.equal(
    textCalls.some(
      (call) => call[1] === "#f0c4ff" && call[2] === "VALOR",
    ),
    true,
    "Valor Ready should brighten the Valor label within its color family",
  );
  assert.equal(
    textCalls.some(
      (call) => call[1] === "#ffd166" && call[2] === "TIME",
    ),
    true,
    "Time should use the shared warm-gold battle resource color",
  );
  assert.equal(
    textCalls.some(
      (call) => call[1] === "#ffe29a" && call[2] === "TIME",
    ),
    true,
    "Ready Time should brighten within the same color family",
  );
  assert.equal(
    textCalls.some(
      (call) => call[1] === "#ffffff" && call[2] === "READY",
    ),
    true,
    "Valor Ready value should remain neutral white",
  );

  for (const call of textCalls.filter((call) => /^(HP|MP|VALOR|TIME)/.test(call[2]))) {
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
  testIdleBattleHudSuppressesTopRightCommandLegend();
  testBannerIsCompactAndDoesNotSpanTheScreen();
  testTacticalHelpIsCompactAndCenteredAboveHud();
  testHudRendersFourNamesAndKeepsResourceColumnsRightOfCommandReserve();
  testHudLayoutLoadsBeforeRendererAndBattleScene();

  console.log("Battle HUD and message layout regression tests passed.");
}

run();
