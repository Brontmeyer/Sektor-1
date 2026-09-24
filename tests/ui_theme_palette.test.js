"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

function loadPalette() {
  const context = vm.createContext({});
  vm.runInContext(
    `${read("js/core/UIThemePalette.js")}\nglobalThis.__Palette = UIThemePalette;`,
    context,
  );
  return context.__Palette;
}

function testSemanticUiPalette() {
  const Palette = loadPalette();

  assert.equal(Palette.focus(), "#ffd75a");
  assert.equal(Palette.accent(), "#7ff0d5");
  assert.equal(Palette.positive(), "#7dff8a");
  assert.equal(Palette.negative(), "#ff6b6b");
  assert.equal(Palette.primary(), "#ffffff");
  assert.equal(Palette.secondary(), "#aebbd0");
  assert.equal(Palette.muted(), "#8897ac");
  assert.equal(Palette.hint(), "#c7a7ff");
  assert.equal(Palette.keyItem(), "#ff9ed8");
  assert.equal(Palette.backdrop(), "#0b0e13");
}

function testPaletteLoadsBeforeFieldAndShopConsumers() {
  const source = read("index.html");
  const paletteIndex = source.indexOf("UIThemePalette.js");

  assert.equal(paletteIndex >= 0, true);
  for (const consumer of ["Window_Choice.js", "Window_Message.js", "Window_Shop.js"]) {
    assert.equal(
      paletteIndex < source.indexOf(consumer),
      true,
      `${consumer} should load after the semantic UI palette`,
    );
  }
}

function testFirstConsumersUseSemanticPalette() {
  for (const relativePath of [
    "js/windows/Window_Choice.js",
    "js/windows/Window_Message.js",
    "js/windows/Window_Shop.js",
  ]) {
    assert.match(read(relativePath), /UIThemePalette/);
  }
}

function run() {
  testSemanticUiPalette();
  testPaletteLoadsBeforeFieldAndShopConsumers();
  testFirstConsumersUseSemanticPalette();
  console.log("UI theme palette regression tests passed.");
}

run();
