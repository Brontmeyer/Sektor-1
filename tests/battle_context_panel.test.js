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
    measureText(text) {
      return { width: String(text).length * 8 };
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
  };
}

function renderedText(context) {
  return context.calls
    .filter((call) => call[0] === "fillText")
    .map((call) => String(call[2]));
}

function loadRenderer(scene, drawContext) {
  const Graphics = { width: 1280, height: 720, context: drawContext };
  const context = vm.createContext({
    console,
    Graphics,
    Input: { actionLabel: (action) => action },
    $gameParty: { battleMembers: () => [] },
  });
  const source = [
    "js/windows/Window_TextLayout.js",
    "js/battle/BattleHudLayout.js",
    "js/battle/BattleRenderer.js",
  ]
    .map(read)
    .join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__classes = { BattleHudLayout, BattleRenderer };`,
    context,
  );
  scene.hudLayout = new context.__classes.BattleHudLayout(scene);
  return new context.__classes.BattleRenderer(scene);
}

function testContextPanelShowsHighlightedActionWithoutRedundantHeading() {
  const drawContext = createDrawContext();
  const mend = {
    id: 1,
    name: "Mend",
    description: "Heal a small amount of HP.",
  };
  const scene = {
    outcome: null,
    selectingEnemyTarget: false,
    magickWindow: {
      isOpen: () => true,
      currentMagick: () => mend,
      currentDescription: () => mend.description,
    },
    skillsWindow: { isOpen: () => false },
    itemWindow: { isOpen: () => false },
    scanManager: { isHelpVisible: () => false },
  };
  const renderer = loadRenderer(scene, drawContext);

  assert.equal(renderer.shouldDrawContextPanel(), true);
  renderer.drawTacticalHelp(drawContext);

  const text = renderedText(drawContext);
  assert.equal(text.includes("Mend"), true);
  assert.equal(text.includes("Heal a small amount of HP."), true);
  assert.equal(text.includes("TACTICAL"), false);
  assert.equal(text.includes("Magick"), false);
}

function testSurgeContextPanelShowsArtDescriptionWithoutRepeatingArtName() {
  const drawContext = createDrawContext();
  const unbroken = {
    id: 1,
    name: "Unbroken",
    description: "Convert a full Valor gauge into overwhelming physical force.",
  };
  const scene = {
    outcome: null,
    selectingEnemyTarget: false,
    skillsWindow: {
      isOpen: () => true,
      mode: "surge",
      x: 170,
      y: 420,
      width: 220,
      lineHeight: 34,
      index: 0,
      currentSkill: () => unbroken,
    },
    magickWindow: { isOpen: () => false },
    itemWindow: { isOpen: () => false },
    scanManager: { isHelpVisible: () => false },
  };
  const renderer = loadRenderer(scene, drawContext);

  renderer.drawTacticalHelp(drawContext);

  const text = renderedText(drawContext);
  assert.equal(
    text.some((entry) => entry.includes("overwhelming physical force")),
    true,
  );
  assert.equal(
    text.includes("Unbroken"),
    false,
    "the compact Surge selector already names the selected Art",
  );
}

function testContextPanelBecomesScannedTargetReadoutDuringTargeting() {
  const drawContext = createDrawContext();
  const target = { name: "Test Slime" };
  const scene = {
    outcome: null,
    selectingEnemyTarget: true,
    targetGroup: "enemy",
    magickWindow: { isOpen: () => false },
    skillsWindow: { isOpen: () => false },
    itemWindow: { isOpen: () => false },
    targetManager: { getSelectedTarget: () => target },
    scanManager: {
      isHelpVisible: () => false,
      tacticalProfile: () => ({
        scanned: true,
        name: "Test Slime",
        hp: 125,
        maxHp: 250,
        mp: 6,
        maxMp: 12,
        weak: ["Fire"],
        resist: ["Ice"],
        immune: ["Lightning"],
      }),
    },
  };
  const renderer = loadRenderer(scene, drawContext);

  renderer.drawTacticalHelp(drawContext);

  const text = renderedText(drawContext);
  assert.equal(text.some((entry) => entry.includes("Test Slime")), true);
  assert.equal(text.some((entry) => entry.includes("HP 125/250")), true);
  assert.equal(text.some((entry) => entry.includes("Weak Fire")), true);
  assert.equal(text.some((entry) => entry.includes("Immune Lightning")), true);
}

function loadSelector(relativePath, className, globals) {
  const context = vm.createContext({ console, ...globals });
  const source = ["js/windows/Window_ListViewport.js", relativePath]
    .map(read)
    .join("\n");
  vm.runInContext(`${source}\nglobalThis.__Window = ${className};`, context);
  return context.__Window;
}

function testNormalBattleSelectorsDropRedundantCategoryHeadings() {
  const drawContext = createDrawContext();
  const actor = {
    knownMagick: () => [
      {
        id: 1,
        name: "Mend",
        description: "Heal a small amount of HP.",
        type: "magick",
        mpCost: 5,
      },
    ],
    canUseMagick: () => true,
    knownSkills: () => [
      { id: 6, name: "Scan", description: "Analyze one enemy.", type: "skill" },
    ],
    selectedValorArts: () => [
      { id: 1, name: "Unbroken", description: "Strike one enemy.", type: "valor" },
    ],
    selectedValorLevel: () => 1,
    canUseSkill: () => true,
    canUseValorArt: () => true,
  };
  const selectorBounds = { x: 360, y: 552, width: 420, height: 156 };
  const commandBounds = { x: 160, y: 552, width: 200, height: 156 };
  const scene = {
    hudLayout: {
      selectorBounds: () => selectorBounds,
      commandBounds: () => commandBounds,
    },
    partyController: { currentBattler: () => actor },
  };
  const globals = {
    Graphics: { height: 720, context: drawContext },
    Input: { isActionTriggered: () => false },
    $gameParty: {
      battleLeader: () => actor,
      itemIds: () => [1],
      itemCount: () => 3,
    },
    DatabaseManager: {
      item: () => ({
        id: 1,
        name: "Potion",
        description: "Restores a small amount of HP.",
        effect: { type: "healHp", value: 50 },
      }),
    },
  };

  const Magick = loadSelector(
    "js/windows/Window_BattleMagick.js",
    "Window_BattleMagick",
    globals,
  );
  const Skills = loadSelector(
    "js/windows/Window_BattleSkills.js",
    "Window_BattleSkills",
    globals,
  );
  const Item = loadSelector(
    "js/windows/Window_BattleItem.js",
    "Window_BattleItem",
    globals,
  );

  const windows = [
    [new Magick(scene), "Magick", "Mend"],
    [new Skills(scene), "Skills", "Scan"],
    [new Item(scene), "Items", "Potion"],
  ];

  for (const [window, redundantHeading, expectedEntry] of windows) {
    drawContext.calls.length = 0;
    window.show({ mode: "skills" });
    window.draw();
    const text = renderedText(drawContext);
    assert.equal(text.some((entry) => entry.includes(expectedEntry)), true);
    assert.equal(text.includes(redundantHeading), false);
    assert.equal(window.listViewport.maxVisibleRows, 4);
  }

  drawContext.calls.length = 0;
  const surge = new Skills(scene);
  surge.show({ mode: "surge" });
  surge.draw();
  assert.equal(
    renderedText(drawContext).some((entry) => entry.includes("Surge · Level 1")),
    true,
    "the compact Surge selector keeps its prepared-level label",
  );
}

function run() {
  testContextPanelShowsHighlightedActionWithoutRedundantHeading();
  testSurgeContextPanelShowsArtDescriptionWithoutRepeatingArtName();
  testContextPanelBecomesScannedTargetReadoutDuringTargeting();
  testNormalBattleSelectorsDropRedundantCategoryHeadings();

  console.log("Battle context panel regression tests passed.");
}

run();
