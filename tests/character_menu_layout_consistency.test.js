"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

function testSharedGeometryProducesOneHeaderContract() {
  const context = vm.createContext({ Graphics: { width: 1280, height: 720 } });
  vm.runInContext(
    `${read("js/windows/MenuScreenLayout.js")}\n${read("js/windows/CharacterMenuLayout.js")}\nglobalThis.__Layout = CharacterMenuLayout;`,
    context,
  );

  const standard = context.__Layout.calculate();
  const noDescription = context.__Layout.calculate({ description: false });

  assert.equal(standard.actorBounds.y, standard.infoBounds.y);
  assert.equal(standard.actorBounds.height, standard.infoBounds.height);
  assert.equal(
    standard.actorBounds.x + standard.actorBounds.width + standard.gap,
    standard.infoBounds.x,
  );
  assert.equal(noDescription.actorBounds.width, standard.actorBounds.width);
  assert.equal(noDescription.infoBounds.width, standard.infoBounds.width);
  assert.equal(noDescription.headerHeight, standard.headerHeight);
}

function testCharacterScreensConsumeSharedGeometryHelper() {
  const screens = [
    "Window_Magick.js",
    "Window_Skills.js",
    "Window_Essence.js",
    "Window_Equipment.js",
    "Window_Status.js",
    "Window_Valor.js",
    "Window_Inventory.js",
  ];

  for (const filename of screens) {
    const source = read(`js/windows/${filename}`);
    assert.match(
      source,
      /CharacterMenuLayout\.calculate/,
      `${filename} should use the shared character-menu geometry contract`,
    );
  }
}

function testSharedLayoutLoadsBeforeConsumers() {
  const index = read("index.html");
  const helperIndex = index.indexOf("CharacterMenuLayout.js");
  assert.equal(helperIndex >= 0, true);

  for (const filename of [
    "Window_Magick.js",
    "Window_Skills.js",
    "Window_Essence.js",
    "Window_Equipment.js",
    "Window_Status.js",
    "Window_Valor.js",
    "Window_Inventory.js",
  ]) {
    assert.equal(helperIndex < index.indexOf(filename), true);
  }
}


function testEquipAndEssenceShareTheSameCenterSplit() {
  const equipment = read("js/windows/Window_Equipment.js");
  const essence = read("js/windows/Window_Essence.js");

  assert.match(
    equipment,
    /CharacterMenuLayout\.split\(layout\.contentBounds, 0\.5/,
  );
  assert.match(
    essence,
    /CharacterMenuLayout\.split\(layout\.contentBounds, 0\.5/,
  );
}

function run() {
  testSharedGeometryProducesOneHeaderContract();
  testCharacterScreensConsumeSharedGeometryHelper();
  testSharedLayoutLoadsBeforeConsumers();
  testEquipAndEssenceShareTheSameCenterSplit();
  console.log("Character menu layout consistency regression tests passed.");
}

run();
