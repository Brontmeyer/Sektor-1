"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");

function loadClass(relativePath, className, globals = {}) {
  const source = fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
  const context = vm.createContext({ console, ...globals });

  vm.runInContext(
    `${source}\nglobalThis.__Class = ${className};`,
    context,
  );

  return context.__Class;
}

function testListViewportKeepsSelectionVisible() {
  const Window_ListViewport = loadClass(
    "js/windows/Window_ListViewport.js",
    "Window_ListViewport",
  );
  const viewport = new Window_ListViewport(5);

  assert.deepEqual(
    { ...viewport.visibleRange(0, 8) },
    { start: 0, end: 5 },
  );
  assert.equal(viewport.hasPrevious(), false);
  assert.equal(viewport.hasNext(8), true);

  assert.deepEqual(
    { ...viewport.visibleRange(5, 8) },
    { start: 1, end: 6 },
  );
  assert.equal(viewport.hasPrevious(), true);
  assert.equal(viewport.hasNext(8), true);

  assert.deepEqual(
    { ...viewport.visibleRange(7, 8) },
    { start: 3, end: 8 },
  );
  assert.equal(viewport.hasNext(8), false);

  assert.deepEqual(
    { ...viewport.visibleRange(0, 8) },
    { start: 0, end: 5 },
  );
}

function testAllAuditedListWindowsUseSharedViewport() {
  const windowFiles = [
    "js/windows/Window_Inventory.js",
    "js/windows/Window_EquipSelect.js",
    "js/windows/Window_Magic.js",
    "js/windows/Window_BattleItem.js",
    "js/windows/Window_BattleMagic.js",
  ];

  for (const relativePath of windowFiles) {
    const source = fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

    assert.equal(
      source.includes("new Window_ListViewport(5)"),
      true,
      `${relativePath} should use the shared list viewport`,
    );
    assert.equal(
      source.includes("visibleRange("),
      true,
      `${relativePath} should render only the visible list range`,
    );
    assert.equal(
      source.includes("ensureVisible("),
      true,
      `${relativePath} should keep keyboard selection visible`,
    );
  }

  const indexSource = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
  const helperIndex = indexSource.indexOf("Window_ListViewport.js");
  const firstWindowIndex = indexSource.indexOf("Window_BattleCommand.js");

  assert.equal(helperIndex >= 0, true);
  assert.equal(helperIndex < firstWindowIndex, true);
}

function testBattleSpriteLoadFailureReportsAndRecovers() {
  const warnings = [];

  class FakeImage {
    constructor() {
      this.src = "";
      this.onload = null;
      this.onerror = null;
      this.loadFailed = false;
    }
  }

  const Scene_Battle = loadClass("js/scenes/Scene_Battle.js", "Scene_Battle", {
    Scene_Base: class {},
    Image: FakeImage,
    console: {
      log() {},
      error() {},
      warn(message) {
        warnings.push(String(message));
      },
    },
  });
  const scene = {
    battleSpriteLoadFailures: new Set(),
  };
  const pathName = "js/sprites/actors/missing.png";
  const image = Scene_Battle.prototype.createBattleSpriteImage.call(
    scene,
    pathName,
    "actor Tyler",
  );

  assert.equal(image.src, pathName);
  assert.equal(image.loadFailed, false);

  image.onerror();

  assert.equal(image.loadFailed, true);
  assert.equal(scene.battleSpriteLoadFailures.has(pathName), true);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].includes("actor Tyler"), true);
  assert.equal(warnings[0].includes(pathName), true);

  image.onload();

  assert.equal(image.loadFailed, false);
  assert.equal(scene.battleSpriteLoadFailures.has(pathName), false);
}

function testMissingSpriteFallbackIsNamed() {
  const BattleRenderer = loadClass(
    "js/battle/BattleRenderer.js",
    "BattleRenderer",
  );
  const renderer = new BattleRenderer({});
  const calls = [];
  const context = {
    strokeStyle: "",
    lineWidth: 0,
    fillStyle: "",
    font: "",
    textAlign: "",
    textBaseline: "",
    strokeRect(...args) {
      calls.push(["strokeRect", ...args]);
    },
    fillText(...args) {
      calls.push(["fillText", ...args]);
    },
  };

  renderer.drawMissingSpriteFallback(context, 96, 128, "Sarah");

  assert.equal(calls.some((call) => call[0] === "strokeRect"), true);
  assert.equal(
    calls.some((call) => call[0] === "fillText" && call[1] === "Sarah"),
    true,
  );
}

function run() {
  testListViewportKeepsSelectionVisible();
  testAllAuditedListWindowsUseSharedViewport();
  testBattleSpriteLoadFailureReportsAndRecovers();
  testMissingSpriteFallbackIsNamed();

  console.log("UI resilience regression tests passed.");
}

run();
