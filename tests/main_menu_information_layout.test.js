"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

function createDrawContext() {
  const calls = [];
  const context = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "",
    textBaseline: "",
    globalAlpha: 1,
    save() {},
    restore() {},
    fillRect(...args) { calls.push(["fillRect", ...args]); },
    strokeRect(...args) { calls.push(["strokeRect", ...args]); },
    fillText(...args) { calls.push(["fillText", ...args]); },
    measureText(text) { return { width: String(text).length * 8 }; },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    createLinearGradient() {
      return { addColorStop() {} };
    },
  };

  return { context, calls };
}

function loadMenuWindows() {
  const { context: drawContext, calls } = createDrawContext();
  const triggered = new Set();
  const Input = {
    isActionTriggered(action) {
      return triggered.has(action);
    },
  };
  const context = vm.createContext({
    console,
    Graphics: { width: 1280, height: 720, context: drawContext },
    Input,
  });

  vm.runInContext(
    `${read("js/core/UIResourcePalette.js")}\n` +
      `${read("js/windows/MainMenuLayout.js")}\n` +
      `${read("js/windows/Window_MainMenuParty.js")}\n` +
      `${read("js/windows/Window_MenuCommand.js")}\n` +
      `globalThis.__classes = { MainMenuLayout, Window_MainMenuParty, Window_MenuCommand };`,
    context,
  );

  return { ...context.__classes, calls, triggered };
}

function actor(name, level, hp, maxHp, mp, maxMp, valor, maxValor, exp) {
  return {
    name,
    level,
    hp,
    maxHp,
    mp,
    maxMp,
    valor,
    maxValor,
    exp,
    expForNextLevel: () => level * 100,
    statusSummary: () => "",
  };
}

function testCommandNamingContractAndNoCommandHeading() {
  const { Window_MenuCommand, calls } = loadMenuWindows();
  const window = new Window_MenuCommand({
    x: 960,
    y: 82,
    width: 280,
    height: 440,
  });

  assert.deepEqual(Array.from(window.commands), [
    "Item",
    "Magick",
    "Skill",
    "Essence",
    "Equip",
    "Status",
    "Order",
    "ROSTER",
    "Map",
    "Valor",
    "Config",
    "Save",
    "Load",
  ]);

  window.draw();
  const text = calls
    .filter((call) => call[0] === "fillText")
    .map((call) => call[1]);

  assert.equal(text.includes("COMMANDS"), false);
  assert.equal(text.includes("Menu"), false);
  assert.equal(text.includes("Skills"), false);
  assert.equal(text.includes("Essences"), false);
  assert.equal(text.includes("Option"), false);
  assert.equal(text.includes("Options"), false);
}

function testPartyWindowDrawsTheActiveFourWithRealStats() {
  const { Window_MainMenuParty, calls } = loadMenuWindows();
  const members = [
    actor("Tyler", 21, 640, 750, 124, 145, 45, 100, 68),
    actor("Sarah", 19, 890, 920, 82, 95, 90, 100, 34),
    actor("Aboo", 20, 580, 680, 105, 120, 15, 100, 58),
    actor("G Prime", 20, 510, 620, 155, 175, 65, 100, 42),
  ];
  const party = { battleMembers: () => members };
  const window = new Window_MainMenuParty(party, {
    x: 24,
    y: 82,
    width: 900,
    height: 614,
  });

  window.draw();
  const text = calls
    .filter((call) => call[0] === "fillText")
    .map((call) => String(call[1]));

  assert.equal(text.includes("PARTY INFORMATION"), false);
  for (const member of members) {
    assert.equal(text.includes(member.name), true);
  }
  assert.equal(text.includes("HP"), true);
  assert.equal(text.includes("640/750"), true);
  assert.equal(text.includes("MP"), true);
  assert.equal(text.includes("124/145"), true);
  assert.equal(text.includes("VALOR"), true);
  assert.equal(text.includes("45/100"), true);
  assert.equal(text.includes("Status:"), true);
  assert.equal(text.includes("Next Level:"), true);
}

function testActorIdentityAndStatsUseTheCardWidthMoreEvenly() {
  const { Window_MainMenuParty, calls } = loadMenuWindows();
  const members = [
    actor("Tyler", 21, 640, 750, 124, 145, 45, 100, 68),
  ];
  const party = { battleMembers: () => members };
  const window = new Window_MainMenuParty(party, {
    x: 24,
    y: 82,
    width: 900,
    height: 614,
  });

  window.draw();
  const textCalls = calls.filter((call) => call[0] === "fillText");
  const nameCall = textCalls.find((call) => call[1] === "Tyler");
  const levelCall = textCalls.find((call) => call[1] === "LV");
  const hpCall = textCalls.find((call) => call[1] === "HP");
  const statusCall = textCalls.find((call) => call[1] === "Status:");
  const nextLevelCall = textCalls.find((call) => call[1] === "Next Level:");

  assert.notEqual(nameCall, undefined);
  assert.notEqual(levelCall, undefined);
  assert.notEqual(hpCall, undefined);
  assert.equal(levelCall[3] > nameCall[3], true);
  assert.equal(Math.abs(levelCall[2] - nameCall[2]) <= 2, true);
  assert.equal(hpCall[2] - nameCall[2] <= 230, true);
  assert.equal(statusCall[3] > levelCall[3], true);
  assert.equal(nextLevelCall[3] > statusCall[3], true);
}

function testLayoutKeepsPartyAndUtilityAreasSeparate() {
  const { MainMenuLayout } = loadMenuWindows();
  const layout = MainMenuLayout.calculate(1280, 720);

  assert.equal(layout.party.x < layout.commands.x, true);
  assert.equal(layout.party.x + layout.party.width < layout.commands.x, true);
  assert.equal(layout.utility.y > layout.commands.y, true);
  assert.equal(
    layout.utility.y,
    layout.commands.y + layout.commands.height + 10,
  );
  assert.equal(layout.location.y > layout.utility.y, true);
  assert.equal(
    layout.location.y + layout.location.height <= 720,
    true,
  );
}

function testSceneUsesMainMenuHeadingAndHonestPlaceholderDestinations() {
  const scene = read("js/scenes/Scene_Menu.js");
  const map = read("js/scenes/Scene_Map.js");

  assert.match(scene, /"MAIN MENU"/);
  assert.equal(scene.includes("DatabaseManager.system.gameTitle"), false);
  assert.equal(scene.includes('case "Items"'), false);
  assert.equal(scene.includes('case "Skills"'), false);
  assert.equal(scene.includes('case "Options"'), false);
  assert.equal(scene.includes('case "Option"'), false);
  assert.match(scene, /case "Item":/);
  assert.match(scene, /case "Skill":/);
  assert.match(scene, /case "Config":/);
  assert.match(scene, /case "Order":/);
  assert.match(scene, /case "Map":/);
  assert.match(scene, /case "Valor":/);
  assert.match(scene, /case "ROSTER":/);
  assert.match(scene, /case "Load":/);
  assert.doesNotMatch(scene, /case "Exit":/);
  assert.match(scene, /globalThis\.\$gameSystem\?\.formattedPlayTime\?\.\(\)/);
  assert.match(scene, /fillText\("RUNES"/);
  assert.equal(scene.includes('fillText("GIL"'), false);
  assert.match(map, /SceneManager\.push\([\s\S]*Scene_Menu/);
  assert.match(map, /mapAccess: this\.map\?\.menuAccess \|\| \{\}/);
  assert.match(map, /areaMap: this\.map\?\.areaMapSnapshot/);
}

function testPlayerFacingCurrencyUsesRunesAcrossCurrentUi() {
  const sceneMenu = read("js/scenes/Scene_Menu.js");
  const battleResults = read("js/windows/Window_BattleResults.js");
  const shopWindow = read("js/windows/Window_Shop.js");
  const shopScene = read("js/scenes/Scene_Shop.js");

  assert.match(sceneMenu, /fillText\("RUNES"/);
  assert.match(battleResults, /\["RUNES"/);
  assert.match(shopWindow, /\["Runes"/);
  assert.match(shopWindow, /"Owned"/);
  assert.match(shopScene, /for \$\{purchase\.totalPrice\} Runes\./);
  assert.match(shopScene, /Not enough Runes\./);

  for (const source of [sceneMenu, battleResults, shopWindow, shopScene]) {
    assert.equal(source.includes('"GIL"'), false);
    assert.equal(source.includes(" Gil."), false);
  }
}

function testSingularHeadingContractAndLoadOrder() {
  const index = read("index.html");
  const inventory = read("js/windows/Window_Inventory.js");
  const skills = read("js/windows/Window_Skills.js");
  const essence = read("js/windows/Window_Essence.js");
  const equipment = read("js/windows/Window_Equipment.js");
  const options = read("js/windows/Window_Options.js");

  assert.match(inventory, /title: "ITEM"/);
  assert.match(skills, /"SKILL"/);
  assert.match(essence, /"ESSENCE"/);
  assert.match(equipment, /"EQUIP"/);
  assert.match(options, /title: "CONFIG"/);

  const layoutIndex = index.indexOf("MainMenuLayout.js");
  const partyIndex = index.indexOf("Window_MainMenuParty.js");
  const commandIndex = index.indexOf("Window_MenuCommand.js");
  const sceneIndex = index.indexOf("Scene_Menu.js");

  assert.equal(layoutIndex >= 0, true);
  assert.equal(layoutIndex < partyIndex, true);
  assert.equal(partyIndex < commandIndex, true);
  assert.equal(commandIndex < sceneIndex, true);
}

function run() {
  testCommandNamingContractAndNoCommandHeading();
  testPartyWindowDrawsTheActiveFourWithRealStats();
  testActorIdentityAndStatsUseTheCardWidthMoreEvenly();
  testLayoutKeepsPartyAndUtilityAreasSeparate();
  testSceneUsesMainMenuHeadingAndHonestPlaceholderDestinations();
  testPlayerFacingCurrencyUsesRunesAcrossCurrentUi();
  testSingularHeadingContractAndLoadOrder();

  console.log("Main menu information layout regression tests passed.");
}

run();
