"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

function createHarness() {
  const context = vm.createContext({
    console,
    Graphics: { width: 1280, height: 720 },
    Window_ActorSummary: { drawPanel() {} },
  });

  vm.runInContext(
    [
      "js/windows/MenuScreenLayout.js",
      "js/windows/CharacterMenuLayout.js",
      "js/windows/ConfigMenuLayout.js",
      "js/windows/MainMenuLayout.js",
      "js/windows/Window_ListViewport.js",
      "js/windows/Window_Roster.js",
      "js/windows/Window_SaveSlots.js",
      "js/windows/Window_AreaMap.js",
    ].map(read).join("\n") +
      "\nglobalThis.__classes = { MenuScreenLayout, CharacterMenuLayout, ConfigMenuLayout, MainMenuLayout, Window_Roster, Window_SaveSlots, Window_AreaMap };",
    context,
  );

  return context.__classes;
}

function testMenuFamiliesShareOneFullScreenShell() {
  const {
    MenuScreenLayout,
    CharacterMenuLayout,
    ConfigMenuLayout,
    MainMenuLayout,
    Window_Roster,
    Window_SaveSlots,
    Window_AreaMap,
  } = createHarness();

  const screen = MenuScreenLayout.metrics(1280, 720);
  assert.equal(screen.margin, 12);
  assert.equal(screen.gap, 8);
  assert.equal(screen.headerHeight, 70);
  assert.equal(screen.width, 1256);
  assert.equal(screen.height, 696);
  assert.equal(screen.bottom, 708);

  const character = CharacterMenuLayout.calculate();
  const config = ConfigMenuLayout.calculate();
  const main = MainMenuLayout.calculate(1280, 720);
  const save = new Window_SaveSlots();
  const area = new Window_AreaMap().layout();
  const roster = new Window_Roster({ battleMembers: () => [] });

  for (const layout of [character, config]) {
    assert.equal(layout.x, screen.x);
    assert.equal(layout.y, screen.y);
    assert.equal(layout.width, screen.width);
    assert.equal(layout.height, screen.height);
  }

  for (const header of [
    main.header,
    save.headerBounds,
    area.header,
    roster.headerBounds,
  ]) {
    assert.equal(header.x, screen.x);
    assert.equal(header.y, screen.y);
    assert.equal(header.width, screen.width);
    assert.equal(header.height, screen.headerHeight);
  }

  assert.equal(main.party.y, screen.y + screen.headerHeight + screen.gap);
  assert.equal(main.party.y + main.party.height, screen.bottom);
  assert.equal(save.listBounds.y + save.listBounds.height, screen.bottom);
  assert.equal(area.map.y + area.map.height, screen.bottom);
  assert.equal(area.side.y + area.side.height, screen.bottom);
  assert.equal(roster.footerBounds.y + roster.footerBounds.height, screen.bottom);
}

function testMenuScenesShareOneBackdropAndSubwindowsPreserveIt() {
  for (const scene of [
    "js/scenes/Scene_Menu.js",
    "js/scenes/Scene_AreaMap.js",
    "js/scenes/Scene_Options.js",
    "js/scenes/Scene_Controls.js",
    "js/scenes/Scene_WindowColor.js",
  ]) {
    assert.match(
      read(scene),
      /MenuScreenLayout\.drawBackdrop\(context\)/,
      `${scene} should use the shared menu backdrop`,
    );
  }

  for (const window of [
    "js/windows/Window_Inventory.js",
    "js/windows/Window_Magick.js",
    "js/windows/Window_Skills.js",
    "js/windows/Window_Equipment.js",
    "js/windows/Window_Status.js",
    "js/windows/Window_Valor.js",
    "js/windows/Window_Roster.js",
    "js/windows/Window_SaveSlots.js",
  ]) {
    assert.doesNotMatch(
      read(window),
      /fillRect\(0, 0, Graphics\.width, Graphics\.height\)/,
      `${window} should preserve the scene-owned backdrop`,
    );
  }
}

function testSharedShellLoadsBeforeEveryConsumer() {
  const index = read("index.html");
  const shellIndex = index.indexOf("MenuScreenLayout.js");
  assert.equal(shellIndex >= 0, true);

  for (const consumer of [
    "Window_AreaMap.js",
    "CharacterMenuLayout.js",
    "ConfigMenuLayout.js",
    "MainMenuLayout.js",
    "Window_Roster.js",
    "Window_SaveSlots.js",
  ]) {
    assert.equal(
      shellIndex < index.indexOf(consumer),
      true,
      `MenuScreenLayout should load before ${consumer}`,
    );
  }
}

function run() {
  testMenuFamiliesShareOneFullScreenShell();
  testMenuScenesShareOneBackdropAndSubwindowsPreserveIt();
  testSharedShellLoadsBeforeEveryConsumer();
  console.log("Menu screen layout consistency regression tests passed.");
}

run();
