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
    `${read("js/core/UIResourcePalette.js")}\nglobalThis.__Palette = UIResourcePalette;`,
    context,
  );
  return context.__Palette;
}

function testCanonicalResourcePalette() {
  const Palette = loadPalette();

  assert.equal(Palette.text("hp"), "#66d7ff");
  assert.equal(Palette.fill("hp"), "#4db8ff");
  assert.equal(Palette.text("mp"), "#78ef91");
  assert.equal(Palette.fill("mp"), "#4fd46b");
  assert.equal(Palette.text("valor"), "#e3a0ff");
  assert.equal(Palette.fill("valor"), "#c06cff");
  assert.equal(Palette.text("valor", { ready: true }), "#f0c4ff");
  assert.equal(Palette.fill("valor", { ready: true }), "#d98cff");
  assert.equal(Palette.text("time"), "#ffd166");
  assert.equal(Palette.fill("time"), "#e9b949");
  assert.equal(Palette.text("time", { ready: true }), "#ffe29a");
  assert.equal(Palette.fill("time", { ready: true }), "#ffd166");
  assert.equal(Palette.valueText(), "#ffffff");
}

function testPrimaryPartyResourceConsumersUseSharedPalette() {
  const consumers = [
    "js/battle/BattleRenderer.js",
    "js/windows/Window_MainMenuParty.js",
    "js/windows/Window_Status.js",
    "js/windows/Window_Inventory.js",
  ];

  for (const relativePath of consumers) {
    const source = read(relativePath);
    assert.match(
      source,
      /UIResourcePalette/,
      `${relativePath} should consume the shared resource palette`,
    );
    assert.match(
      source,
      /UIResourcePalette\.valueText\(\)/,
      `${relativePath} should keep dynamic resource values neutral white`,
    );
  }
}

function testPaletteLoadsBeforeUiConsumers() {
  const source = read("index.html");
  const paletteIndex = source.indexOf("UIResourcePalette.js");
  const mainMenuIndex = source.indexOf("Window_MainMenuParty.js");
  const statusIndex = source.indexOf("Window_Status.js");
  const battleIndex = source.indexOf("BattleRenderer.js");

  assert.equal(paletteIndex >= 0, true);
  assert.equal(paletteIndex < mainMenuIndex, true);
  assert.equal(paletteIndex < statusIndex, true);
  assert.equal(paletteIndex < battleIndex, true);
}

function testLegacySwappedResourceColorsAreGoneFromPrimaryConsumers() {
  const sources = [
    read("js/battle/BattleRenderer.js"),
    read("js/windows/Window_MainMenuParty.js"),
  ].join("\n");

  for (const legacyColor of ["#63d471", "#5cd477", "#45aaff", "#4fa3ff", "#f2aa3f"]) {
    assert.equal(
      sources.includes(legacyColor),
      false,
      `legacy per-screen resource color ${legacyColor} should be retired`,
    );
  }
}

function run() {
  testCanonicalResourcePalette();
  testPrimaryPartyResourceConsumersUseSharedPalette();
  testPaletteLoadsBeforeUiConsumers();
  testLegacySwappedResourceColorsAreGoneFromPrimaryConsumers();

  console.log("Resource color consistency regression tests passed.");
}

run();
