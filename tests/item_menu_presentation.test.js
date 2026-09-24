"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

function createHarness() {
  const actions = new Set();
  const drawCalls = [];
  const context2d = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "",
    textBaseline: "",
    save() {},
    restore() {},
    fillRect() {},
    strokeRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fillText(...args) { drawCalls.push(String(args[0])); },
    measureText(text) { return { width: String(text).length * 8 }; },
  };

  const items = {
    1: {
      id: 1,
      name: "Potion",
      description: "Restores a small amount of HP.",
      type: "item",
      consumable: true,
      effect: { type: "healHp", value: 50 },
    },
    2: {
      id: 2,
      name: "Hi-Potion",
      description: "Restores a moderate amount of HP.",
      type: "item",
      consumable: true,
      effect: { type: "healHp", value: 200 },
    },
    3: {
      id: 3,
      name: "Bronze Pass",
      description: "A stamped transit key item.",
      type: "item",
      keyItem: true,
      consumable: false,
      effect: null,
    },
  };

  const weapons = { 1: { id: 1, name: "Steel Sword", description: "A steel weapon." } };
  const armors = { 1: { id: 1, name: "Iron Armor", description: "Iron protection." } };
  const accessories = { 1: { id: 1, name: "Power Wrist", description: "Raises attack." } };

  function createActor(actorId, name, hp, maxHp) {
    return {
      actorId,
      name,
      level: actorId + 4,
      hp,
      maxHp,
      mp: 20 + actorId * 5,
      maxMp: 40,
      statusDisplayEntries() { return []; },
      statusSummary() { return "Normal"; },
      gainHp(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); },
      isFullHp() { return this.hp >= this.maxHp; },
    };
  }

  const firstActor = createActor(1, "Tyler", 100, 150);
  const secondActor = createActor(2, "Sarah", 40, 150);
  const party = {
    members() { return [firstActor, secondActor]; },
    battleFormationMembers() { return [firstActor, secondActor]; },
  };

  const globals = {
    console,
    Graphics: { width: 1280, height: 720, context: context2d },
    Input: {
      isActionTriggered(action) { return actions.has(action); },
      isActionRepeated(action) { return actions.has(action); },
      actionLabel(action) { return action; },
    },
    DatabaseManager: {
      item(id) { return items[id] || null; },
      weapon(id) { return weapons[id] || null; },
      armor(id) { return armors[id] || null; },
      accessory(id) { return accessories[id] || null; },
    },
    $gameParty: {
      items: { 1: 3, 2: 1, 3: 1 },
      weapons: { 1: 1 },
      armors: { 1: 1 },
      accessories: { 1: 1 },
      itemIds() { return Object.keys(this.items).map(Number); },
      itemCount(id) { return this.items[id] || 0; },
      useItem(itemId, target) {
        if (!this.itemCount(itemId)) {
          return false;
        }

        const item = items[itemId];

        if (item?.effect?.type === "healHp") {
          if (target.isFullHp()) {
            return false;
          }

          target.gainHp(item.effect.value);
        }

        if (item?.consumable === true) {
          this.items[itemId] -= 1;

          if (this.items[itemId] <= 0) {
            delete this.items[itemId];
          }
        }

        return true;
      },
    },
  };

  const context = vm.createContext(globals);
  const source = [
    "js/core/UIResourcePalette.js",
    "js/windows/Window_ListViewport.js",
    "js/windows/Window_TextLayout.js",
    "js/windows/Window_ActorSummary.js",
    "js/windows/CharacterMenuLayout.js",
    "js/windows/Window_Inventory.js",
  ]
    .map(read)
    .join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__Window = Window_Inventory;`,
    context,
  );

  return {
    window: new context.__Window(party),
    actions,
    drawCalls,
    firstActor,
    secondActor,
  };
}

function press(harness, action) {
  harness.actions.clear();
  harness.actions.add(action);
  harness.window.update();
  harness.actions.clear();
}

function drawText(harness) {
  harness.drawCalls.length = 0;
  harness.window.draw();
  return harness.drawCalls.slice();
}

function includes(texts, expected) {
  return texts.some((text) => text === expected || text.includes(expected));
}

function testItemStartsOnUseTabOnly() {
  const harness = createHarness();
  harness.window.show();
  const texts = drawText(harness);

  assert.equal(harness.window.focusArea, "tabs");
  assert.equal(harness.window.pageIndex, 0);
  assert.equal(includes(texts, "▶ Use"), true);
  assert.equal(includes(texts, "▶ Potion"), false);
  assert.equal(includes(texts, "▶ Tyler"), false);
  assert.equal(includes(texts, "Choose an item to use."), true);
  assert.equal(includes(texts, "Owned"), false);
}

function testUseFlowIsTabThenItemThenTargetThenBackToItem() {
  const harness = createHarness();
  harness.window.show();

  press(harness, "confirm");
  assert.equal(harness.window.focusArea, "items");
  let texts = drawText(harness);
  assert.equal(includes(texts, "▶ Potion"), true);
  assert.equal(includes(texts, "SELECT ITEM"), true);
  assert.equal(includes(texts, "Restores a small amount of HP."), true);

  press(harness, "confirm");
  assert.equal(harness.window.focusArea, "targets");
  assert.equal(harness.window.pendingItemId, 1);
  texts = drawText(harness);
  assert.equal(includes(texts, "◆ Potion"), true);
  assert.equal(includes(texts, "▶ Tyler"), true);
  assert.equal(includes(texts, "Use Potion on Tyler."), true);
  assert.equal(includes(texts, "Quantity"), true);
  assert.equal(includes(texts, "x3"), true);

  press(harness, "down");
  assert.equal(harness.window.targetIndex, 1);
  press(harness, "confirm");
  assert.equal(harness.secondActor.hp, 90);
  assert.equal(harness.window.itemCount(1), 2);
  assert.equal(harness.window.focusArea, "items");
  assert.equal(harness.window.pendingItemId, null);
}

function testArrangeApplyReturnsFocusToArrangeHeading() {
  const harness = createHarness();
  harness.window.show();

  press(harness, "right");
  assert.equal(harness.window.pageIndex, 1);
  assert.equal(harness.window.focusArea, "tabs");
  press(harness, "confirm");
  assert.equal(harness.window.focusArea, "arrange");

  press(harness, "down");
  press(harness, "down");
  assert.equal(harness.window.currentArrangeOption().mode, "most");
  press(harness, "confirm");

  assert.equal(harness.window.sortMode, "most");
  assert.equal(harness.window.pageIndex, 1);
  assert.equal(harness.window.focusArea, "tabs");
  const texts = drawText(harness);
  assert.equal(includes(texts, "▶ Arrange"), true);
  assert.equal(includes(texts, "Current"), true);
  assert.equal(includes(texts, "Most"), true);

  const source = read("js/windows/Window_Inventory.js");
  assert.doesNotMatch(source, /Customize|Field|Battle|Throw/);
}

function testKeyItemsKeepReferenceTabFlowAndPartyRowsShowHpAndMp() {
  const harness = createHarness();
  harness.window.show();
  press(harness, "right");
  press(harness, "right");
  assert.equal(harness.window.pageIndex, 2);
  assert.equal(harness.window.focusArea, "tabs");
  press(harness, "confirm");
  assert.equal(harness.window.focusArea, "keyItems");

  const texts = drawText(harness);
  assert.equal(includes(texts, "Bronze Pass"), true);
  assert.equal(includes(texts, "A stamped transit key item."), true);

  harness.window.changePage(-2);
  press(harness, "confirm");
  const useTexts = drawText(harness);
  assert.equal(includes(useTexts, "HP 100/150"), true);
  assert.equal(includes(useTexts, "MP 25/40"), true);
}

function testCancelMovesBackOneInteractionLevel() {
  const harness = createHarness();
  harness.window.show();
  press(harness, "confirm");
  press(harness, "confirm");
  assert.equal(harness.window.focusArea, "targets");

  press(harness, "cancel");
  assert.equal(harness.window.focusArea, "items");
  press(harness, "cancel");
  assert.equal(harness.window.focusArea, "tabs");
  press(harness, "cancel");
  assert.equal(harness.window.isOpen(), false);
}


function testOwnedEquipmentAppearsInItemInventoryButCannotBeUsed() {
  const harness = createHarness();
  harness.window.show();
  press(harness, "confirm");

  const texts = drawText(harness);
  assert.equal(includes(texts, "Steel Sword [WEAPON]"), true);
  assert.equal(includes(texts, "Iron Armor [ARMOR]"), true);
  assert.equal(includes(texts, "Power Wrist [ACC]"), true);

  const entries = harness.window.inventoryDisplayEntries();
  const steelIndex = entries.findIndex((entry) => entry.type === "weapon");
  assert.equal(steelIndex >= 0, true);
  harness.window.itemIndex = steelIndex;
  const beforeFocus = harness.window.focusArea;
  press(harness, "confirm");
  assert.equal(harness.window.focusArea, beforeFocus);
  assert.equal(harness.window.pendingItemId, null);

  const selectedTexts = drawText(harness);
  assert.equal(includes(selectedTexts, "Manage it from EQUIP"), true);
  assert.equal(includes(selectedTexts, "Equip Menu"), true);
}


function testUseAndArrangeShareTheSameColumnGeometryWithoutPartyHeading() {
  const source = read("js/windows/Window_Inventory.js");

  assert.match(source, /contentColumns\(bounds = this\.contentBounds\)/);
  assert.match(source, /drawUsePage\(context, columns\)/);
  assert.match(source, /drawArrangePage\(context, columns\)/);
  assert.doesNotMatch(source, /\? "SELECT TARGET"[\s\S]*: "PARTY"/);
}


function testItemTabsShareEqualGridAndPartyInventoryHeaderReplacesActorHeader() {
  const harness = createHarness();
  harness.window.show();
  const columns = harness.window.contentColumns();
  const texts = drawText(harness);

  assert.equal(columns.rightX > columns.dividerX, true);
  assert.equal(columns.tabTop < columns.rightBodyY, true);
  assert.equal(columns.leftTop < columns.rightBodyY, true);
  assert.equal(includes(texts, "PARTY INVENTORY"), true);
  assert.equal(includes(texts, "Shared inventory"), true);

  const source = read("js/windows/Window_Inventory.js");
  assert.match(source, /drawTabs\(context, columns\)/);
  assert.match(source, /const tabWidth = columns\.rightWidth \/ labels\.length/);
  assert.match(source, /context\.moveTo\(columns\.dividerX, columns\.innerY\)/);
  assert.match(
    source,
    /context\.lineTo\(columns\.dividerX, columns\.innerY \+ columns\.innerHeight\)/,
  );
  assert.doesNotMatch(source, /footerText\(/);
  assert.doesNotMatch(source, /Input\.actionLabel/);
}

function testSceneRoutesItemMenuToPartyBackedInventoryWindow() {
  const scene = read("js/scenes/Scene_Menu.js");

  assert.match(scene, /this\.inventoryWindow = new Window_Inventory\(\$gameParty\)/);
  assert.match(scene, /this\.inventoryWindow\.update\(\)/);
  assert.match(scene, /this\.inventoryWindow\.draw\(\)/);
}

function run() {
  testItemStartsOnUseTabOnly();
  testUseFlowIsTabThenItemThenTargetThenBackToItem();
  testArrangeApplyReturnsFocusToArrangeHeading();
  testKeyItemsKeepReferenceTabFlowAndPartyRowsShowHpAndMp();
  testCancelMovesBackOneInteractionLevel();
  testOwnedEquipmentAppearsInItemInventoryButCannotBeUsed();
  testUseAndArrangeShareTheSameColumnGeometryWithoutPartyHeading();
  testItemTabsShareEqualGridAndPartyInventoryHeaderReplacesActorHeader();
  testSceneRoutesItemMenuToPartyBackedInventoryWindow();
  console.log("Item menu presentation regression tests passed.");
}

run();
