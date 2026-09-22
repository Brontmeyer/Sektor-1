"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

function loadManager() {
  const context = vm.createContext({ console });
  vm.runInContext(
    `${read("js/core/UIAssetManager.js")}\nglobalThis.__Manager = UIAssetManager;`,
    context,
  );
  return context.__Manager;
}

function createSoftContext() {
  const calls = [];

  return {
    calls,
    globalAlpha: 1,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    shadowColor: "",
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    save() {
      calls.push(["save"]);
    },
    restore() {
      calls.push(["restore"]);
    },
    beginPath() {
      calls.push(["beginPath"]);
    },
    roundRect(...args) {
      calls.push(["roundRect", ...args]);
    },
    clip() {
      calls.push(["clip"]);
    },
    fill() {
      calls.push([
        "fill",
        this.fillStyle,
        this.shadowColor,
        this.shadowBlur,
        this.shadowOffsetY,
      ]);
    },
    stroke() {
      calls.push(["stroke", this.strokeStyle, this.lineWidth]);
    },
    fillRect(...args) {
      calls.push(["fillRect", this.fillStyle, ...args]);
    },
    strokeRect(...args) {
      calls.push(["strokeRect", this.strokeStyle, ...args]);
    },
    drawImage(...args) {
      calls.push(["drawImage", ...args]);
    },
    translate(...args) {
      calls.push(["translate", ...args]);
    },
    rotate(...args) {
      calls.push(["rotate", ...args]);
    },
  };
}

function readyImage(width, height) {
  return {
    complete: true,
    naturalWidth: width,
    naturalHeight: height,
  };
}

function testPanelsUseRoundedClipShadowAndInsetFrame() {
  const Manager = loadManager();
  const context = createSoftContext();
  Manager._images.set("battlePanel", readyImage(64, 64));

  assert.equal(
    Manager.drawPanel(context, "battlePanel", 20, 30, 420, 150),
    true,
  );

  assert.equal(
    context.calls.some(
      (call) => call[0] === "roundRect" && call[5] === 12,
    ),
    true,
    "battle panels use the role-aware soft corner radius",
  );
  assert.equal(
    context.calls.some((call) => call[0] === "clip"),
    true,
    "asset art is clipped into the softened panel silhouette",
  );
  assert.equal(
    context.calls.some(
      (call) =>
        call[0] === "fill" &&
        call[2] === "rgba(0, 0, 0, 0.42)" &&
        call[3] === 12,
    ),
    true,
    "the shared panel renderer supplies a gentle outer shadow",
  );
  assert.equal(
    context.calls.filter((call) => call[0] === "stroke").length >= 2,
    true,
    "outer and inset strokes give the window a cushioned frame",
  );
}

function testRoleRadiiStaySoftButProportional() {
  const Manager = loadManager();

  assert.equal(Manager.panelCornerRadius("menuPanel", 900, 500), 14);
  assert.equal(Manager.panelCornerRadius("battlePanel", 900, 150), 12);
  assert.equal(Manager.panelCornerRadius("accentPanel", 180, 36), 10);
  assert.equal(Manager.panelCornerRadius("accentPanel", 30, 12), 4);
}

function testSelectionPanelsAndGaugesUseRoundedClipping() {
  const Manager = loadManager();
  const selectionContext = createSoftContext();
  Manager._images.set("selectionPanel", readyImage(48, 24));

  assert.equal(
    Manager.drawSelectionPanel(selectionContext, 10, 20, 240, 36),
    true,
  );
  assert.equal(
    selectionContext.calls.some((call) => call[0] === "clip"),
    true,
  );

  const gaugeContext = createSoftContext();
  Manager.drawGauge(gaugeContext, 60, 100, 10, 20, 180, 8, "#63d471");

  assert.equal(
    gaugeContext.calls.some(
      (call) => call[0] === "roundRect" && call[5] === 4,
    ),
    true,
    "gauge fallback fill uses a capsule radius equal to half its height",
  );
  assert.equal(
    gaugeContext.calls.some((call) => call[0] === "clip"),
    true,
  );
}

function testSofteningStaysCentralizedInAssetManager() {
  const manager = read("js/core/UIAssetManager.js");
  const consumers = [
    "js/battle/BattleRenderer.js",
    "js/windows/Window_BattleCommand.js",
    "js/windows/Window_BattleSkills.js",
    "js/windows/Window_BattleMagick.js",
    "js/windows/Window_BattleItem.js",
    "js/windows/Window_MenuCommand.js",
    "js/windows/Window_Options.js",
    "js/windows/Window_Controls.js",
  ].map(read);

  assert.match(manager, /panelCornerRadius/);
  assert.match(manager, /roundedRectPath/);
  assert.match(manager, /drawSoftPanelShadow/);

  for (const source of consumers) {
    assert.equal(source.includes("roundRect("), false);
  }
}

function run() {
  testPanelsUseRoundedClipShadowAndInsetFrame();
  testRoleRadiiStaySoftButProportional();
  testSelectionPanelsAndGaugesUseRoundedClipping();
  testSofteningStaysCentralizedInAssetManager();

  console.log("UI window softening regression tests passed.");
}

run();
