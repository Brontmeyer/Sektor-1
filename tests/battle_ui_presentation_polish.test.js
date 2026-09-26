"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

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

function testCompactBattleHudGeometry() {
  const Graphics = { width: 1600, height: 900 };
  const context = vm.createContext({ console, Graphics });

  vm.runInContext(
    `${read("js/battle/BattleHudLayout.js")}\nglobalThis.__Layout = BattleHudLayout;`,
    context,
  );

  const scene = { scanManager: { isHelpVisible: () => true } };
  const layout = new context.__Layout(scene);
  const hud = layout.hudBounds();
  const help = layout.tacticalHelpBounds();
  const banner = layout.bannerBounds(200);

  assert.equal(hud.height, 156);
  assert.equal(help.height, 64);
  assert.equal(help.width > hud.width * 0.7, true);
  assert.equal(help.width < hud.width, true);
  assert.equal(help.x > hud.x, true);
  assert.equal(help.x + help.width < hud.x + hud.width, true);
  assert.equal(banner.height, 36);
  assert.equal(banner.width < Graphics.width * 0.5, true);
}

function testCommandWindowMatchesHudReserveAndFlushSideTabHeight() {
  const drawContext = createContext();
  const Graphics = { width: 1280, height: 720, context: drawContext };
  const Input = { isActionTriggered: () => false };
  const context = vm.createContext({ console, Graphics, Input });

  vm.runInContext(
    `${read("js/windows/Window_BattleCommand.js")}\nglobalThis.__Window = Window_BattleCommand;`,
    context,
  );

  const scene = {
    encounter: { canEscape: true },
    partyController: { currentBattler: () => null },
    hudLayout: {
      commandBounds() {
        return { x: 190, y: 540, width: 216, height: 156 };
      },
    },
  };
  const window = new context.__Window(scene);

  assert.equal(window.x, 190);
  assert.equal(window.y, 540);
  assert.equal(window.width, 216);
  assert.equal(window.height, 156);
  assert.equal(window.lineHeight, 39);
  assert.equal(window.sideHeight, 39);

  window.openSide("Escape");
  window.draw();
  const sideOutline = drawContext.calls.find(
    (call) =>
      call[0] === "strokeRect" &&
      call[2] === window.x - window.sideWidth &&
      call[3] === window.y,
  );

  assert.notEqual(sideOutline, undefined);
  assert.equal(sideOutline[5], window.sideHeight);
}

function testTargetCursorUsesBattleAccentAndOutline() {
  const drawContext = createContext();
  const Graphics = { width: 1280, height: 720, context: drawContext };
  const Input = { actionLabel: (action) => action };
  const $gameParty = { battleMembers: () => [] };
  const context = vm.createContext({ console, Graphics, Input, $gameParty });
  const source = [
    "js/windows/Window_TextLayout.js",
    "js/battle/BattleRenderer.js",
  ]
    .map(read)
    .join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__Renderer = BattleRenderer;`,
    context,
  );

  const enemy = { name: "Target" };
  const scene = {
    selectingEnemyTarget: true,
    targetScope: "single",
    targetGroup: "enemy",
    selectedEnemyIndex: 0,
    enemies: [enemy],
    getEnemyBattlePosition: () => ({ x: 900, y: 300 }),
    getEnemySpriteHeight: () => 96,
  };
  const renderer = new context.__Renderer(scene);

  renderer.drawEnemyTargetCursor(drawContext);

  assert.equal(
    drawContext.calls.some(
      (call) => call[0] === "strokeText" && call[2] === "▼",
    ),
    true,
  );
  assert.equal(
    drawContext.calls.some(
      (call) =>
        call[0] === "fillText" && call[1] === "#ffd75a" && call[2] === "▼",
    ),
    true,
  );
}

function run() {
  testCompactBattleHudGeometry();
  testCommandWindowMatchesHudReserveAndFlushSideTabHeight();
  testTargetCursorUsesBattleAccentAndOutline();

  console.log("Battle UI presentation polish regression tests passed.");
}

run();
