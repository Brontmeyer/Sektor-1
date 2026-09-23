"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

function createSelectorHarness() {
  const actions = new Set();
  const weapons = [
    null,
    {
      id: 1,
      name: "Iron Sword",
      description: "A simple iron Sword.",
      attack: 5,
      attackPercent: 90,
      magicAttack: 0,
      criticalBonus: 0,
    },
    {
      id: 2,
      name: "Steel Sword",
      description: "A stronger sword forged from steel.",
      attack: 10,
      attackPercent: 95,
      magicAttack: 0,
      criticalBonus: 5,
    },
  ];
  const actor = {
    weaponId: 1,
    armorId: 0,
    accessoryId: 0,
    defensePercent: 2,
    magicDefensePercent: 3,
    weapon: () => weapons[1],
    armor: () => null,
    accessory: () => null,
    totalAttack: () => 20,
    totalAttackPercent: () => 90,
    totalDefense: () => 14,
    totalDefensePercent: () => 2,
    totalMagicAttack: () => 12,
    totalMagicDefense: () => 11,
    totalMagicDefensePercent: () => 3,
    totalCritical: () => 0,
    attackWithWeapon: (weapon) => 15 + (weapon?.attack || 0),
    attackPercentWithWeapon: (weapon) => weapon?.attackPercent ?? 100,
    defenseWithArmor: () => 14,
    magicAttackWithWeapon: (weapon) => 12 + (weapon?.magicAttack || 0),
    magicDefenseWithAccessory: () => 11,
    criticalWithWeapon: (weapon) => weapon?.criticalBonus || 0,
  };
  const globals = {
    console,
    Graphics: { width: 1280, height: 720, context: {} },
    Input: {
      isActionTriggered(action) { return actions.has(action); },
      isActionRepeated(action) { return actions.has(action); },
      actionLabel(action) { return action; },
    },
    DatabaseManager: {
      weapon(id) { return weapons[id] || null; },
      armor() { return null; },
      accessory() { return null; },
    },
    $gameParty: {
      weapons: { 1: 1, 2: 1 },
      armors: {},
      accessories: {},
      weaponCount(id) { return this.weapons[id] || 0; },
      armorCount(id) { return this.armors[id] || 0; },
      accessoryCount(id) { return this.accessories[id] || 0; },
    },
    Window_ActorSummary: { drawPanel() { return true; } },
  };
  const context = vm.createContext(globals);
  vm.runInContext(
    `${read("js/windows/Window_ListViewport.js")}\n` +
      `${read("js/windows/Window_EquipSelect.js")}\n` +
      `globalThis.__Window = Window_EquipSelect;`,
    context,
  );

  return { selector: new context.__Window(actor), actor, actions };
}

function testMainMenuPortraitsAreSquareLikeActorSummary() {
  const source = read("js/windows/Window_MainMenuParty.js");
  const portraitBlock = source.slice(
    source.indexOf("drawPortraitPlaceholder(context, actor"),
    source.indexOf("drawGauge(context", source.indexOf("drawPortraitPlaceholder(context, actor")),
  );

  assert.match(portraitBlock, /fillRect\(x, y, size, size\)/);
  assert.match(portraitBlock, /strokeRect\(x, y, size, size\)/);
  assert.doesNotMatch(portraitBlock, /roundedRectPath/);
}

function testEquipUsesFullLabelsAndSharedActorSummary() {
  const source = read("js/windows/Window_Equipment.js");

  assert.match(source, /\{ type: "weapon", label: "Weapon" \}/);
  assert.match(source, /\{ type: "armor", label: "Armor" \}/);
  assert.match(source, /\{ type: "accessory", label: "Accessories" \}/);
  assert.match(source, /Window_ActorSummary\.draw\(context, this\.actor, this\.actorBounds\)/);
  assert.match(source, /drawEquippedSummary/);
  assert.match(source, /drawDescription/);
  assert.match(source, /drawSlotAndStats/);
  assert.match(source, /Essence Growth/);
}

function testEquipmentPreviewIncludesReferenceStyleStats() {
  const { selector } = createSelectorHarness();
  selector.show("weapon");
  selector.index = 2;
  const rows = selector.previewStats();
  const names = Array.from(rows, (row) => row.name);

  assert.deepEqual(names, [
    "Attack",
    "Attack %",
    "Defense",
    "Defense %",
    "Magic Attack",
    "Magic Defense",
    "Magic Defense %",
    "Critical",
  ]);

  const attack = rows.find((row) => row.name === "Attack");
  const accuracy = rows.find((row) => row.name === "Attack %");
  const critical = rows.find((row) => row.name === "Critical");
  assert.equal(attack.current, 20);
  assert.equal(attack.preview, 25);
  assert.equal(accuracy.preview, 95);
  assert.equal(critical.preview, 5);
}

function testSelectionListUsesHeldRepeatAndViewport() {
  const source = read("js/windows/Window_EquipSelect.js");
  assert.match(source, /Input\.isActionRepeated/);
  assert.match(source, /directionRepeated\("up"\)/);
  assert.match(source, /directionRepeated\("down"\)/);
  assert.match(source, /new Window_ListViewport/);
  assert.match(source, /listViewport\.maxVisibleRows = this\.visibleRows/);
  assert.match(source, /hasPrevious\(\)/);
  assert.match(source, /hasNext\(entries\.length\)/);
}

function testEssenceGrowthIsPresentationOnlyDefault() {
  const { selector } = createSelectorHarness();
  selector.show("weapon");
  selector.index = 1;
  assert.equal(selector.essenceGrowthLabel(), "Normal");

  const source = read("js/windows/Window_EquipSelect.js");
  assert.match(source, /equipment\?\.essenceGrowth \|\| "Normal"/);
  assert.doesNotMatch(source, /gainEssence|resonanceMultiplier|applyEssenceGrowth/);
}

function run() {
  testMainMenuPortraitsAreSquareLikeActorSummary();
  testEquipUsesFullLabelsAndSharedActorSummary();
  testEquipmentPreviewIncludesReferenceStyleStats();
  testSelectionListUsesHeldRepeatAndViewport();
  testEssenceGrowthIsPresentationOnlyDefault();
  console.log("Equip menu presentation regression tests passed.");
}

run();
