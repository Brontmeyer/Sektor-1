"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

function testEstablishedMenuDestinationsDoNotCarryPermanentKeyHintFooters() {
  const filenames = [
    "Window_Magick.js",
    "Window_Skills.js",
    "Window_Essence.js",
    "Window_Equipment.js",
    "Window_EquipSelect.js",
    "Window_Status.js",
    "Window_Valor.js",
    "Window_Inventory.js",
    "Window_Options.js",
    "Window_SaveSlots.js",
  ];

  for (const filename of filenames) {
    const source = read(`js/windows/${filename}`);
    assert.doesNotMatch(
      source,
      /Input\.actionLabel|actionLabel\(/,
      `${filename} should communicate focus visually instead of carrying a permanent key legend`,
    );
  }
}

function testContextHeavyEditorsPutInstructionsInTheSharedHeader() {
  const controls = read("js/windows/Window_Controls.js");
  const windowColor = read("js/windows/Window_WindowColor.js");

  assert.match(controls, /currentDescription\(\)/);
  assert.match(controls, /ConfigMenuLayout\.drawHeader/);
  assert.match(windowColor, /currentDescription\(\)/);
  assert.match(windowColor, /ConfigMenuLayout\.drawHeader/);
  assert.doesNotMatch(controls, /actionLabel/);
  assert.doesNotMatch(windowColor, /actionLabel/);
}

function run() {
  testEstablishedMenuDestinationsDoNotCarryPermanentKeyHintFooters();
  testContextHeavyEditorsPutInstructionsInTheSharedHeader();
  console.log("Menu hint cleanup regression tests passed.");
}

run();
