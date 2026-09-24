"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");

function source(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function loadCharacterMenuLayout() {
  const context = vm.createContext({
    console,
    Graphics: { width: 1280, height: 720 },
  });
  vm.runInContext(source("js/windows/CharacterMenuLayout.js"), context);
  return vm.runInContext("CharacterMenuLayout", context);
}

function testSharedHeaderMetrics() {
  const CharacterMenuLayout = loadCharacterMenuLayout();
  const bounds = { x: 900, y: 12, width: 320, height: 170 };
  const plain = CharacterMenuLayout.infoHeadingMetrics(bounds);
  const paged = CharacterMenuLayout.infoHeadingMetrics(bounds, { subtitle: "MAIN 1/3" });

  assert.equal(plain.titleY, 42);
  assert.equal(plain.rowStartY, 78);
  assert.equal(paged.titleY, 42);
  assert.equal(paged.subtitleY, 64);
  assert.equal(paged.rowStartY, 92);
  assert.equal(plain.rowSpacing, paged.rowSpacing);
  assert.equal(plain.labelX, paged.labelX);
  assert.equal(plain.valueX, paged.valueX);
}

function testCharacterAndPartyMenusUseSharedHeaderContract() {
  const infoMenus = [
    "js/windows/Window_Magick.js",
    "js/windows/Window_Skills.js",
    "js/windows/Window_Essence.js",
    "js/windows/Window_Equipment.js",
    "js/windows/Window_Status.js",
    "js/windows/Window_Valor.js",
    "js/windows/Window_Inventory.js",
    "js/windows/Window_Order.js",
  ];

  for (const file of infoMenus) {
    const text = source(file);
    assert.match(
      text,
      /CharacterMenuLayout\.drawInfoHeading\(/,
      `${file} should use the shared metadata heading renderer`,
    );
  }

  for (const file of ["js/windows/Window_Inventory.js", "js/windows/Window_Order.js"]) {
    const text = source(file);
    assert.match(
      text,
      /CharacterMenuLayout\.drawContextHeading\(/,
      `${file} should use the shared party/system context heading renderer`,
    );
  }
}

function testConfigFamilyKeepsItsSharedCompactHeader() {
  for (const file of [
    "js/windows/Window_Options.js",
    "js/windows/Window_Controls.js",
    "js/windows/Window_WindowColor.js",
  ]) {
    assert.match(
      source(file),
      /ConfigMenuLayout\.drawHeader\(/,
      `${file} should stay on the Config-family header contract`,
    );
  }
}

function run() {
  testSharedHeaderMetrics();
  testCharacterAndPartyMenusUseSharedHeaderContract();
  testConfigFamilyKeepsItsSharedCompactHeader();
  console.log("Menu header consistency regression tests passed.");
}

run();
