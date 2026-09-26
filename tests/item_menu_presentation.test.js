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
  const drawMetrics = [];
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
    fillText(...args) {
      drawCalls.push(String(args[0]));
      drawMetrics.push({
        text: String(args[0]),
        x: Number(args[1]),
        y: Number(args[2]),
        font: this.font,
        textAlign: this.textAlign,
        textBaseline: this.textBaseline,
      });
    },
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
      weaponId: 0,
      armorId: 0,
      accessoryId: 0,
      gainHp(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); },
      isFullHp() { return this.hp >= this.maxHp; },
    };
  }

  const firstActor = createActor(1, "Tyler", 100, 150);
  const secondActor = createActor(2, "Sarah", 40, 150);
  firstActor.weaponId = 1;
  secondActor.armorId = 1;
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
      weapons: { 1: 2 },
      armors: { 1: 1 },
      accessories: { 1: 1 },
      itemIds() { return Object.keys(this.items).map(Number); },
      itemCount(id) { return this.items[id] || 0; },
      merchandiseCount(type, id) {
        const store = type === "weapon"
          ? this.weapons
          : type === "armor"
            ? this.armors
            : type === "accessory"
              ? this.accessories
              : this.items;
        return store[id] || 0;
      },
      equippedMerchandiseCount(type, id) {
        const field = type === "weapon"
          ? "weaponId"
          : type === "armor"
            ? "armorId"
            : type === "accessory"
              ? "accessoryId"
              : null;
        return field
          ? [firstActor, secondActor].filter((actor) => actor[field] === id).length
          : 0;
      },
      unequippedMerchandiseCount(type, id) {
        return Math.max(
          0,
          this.merchandiseCount(type, id) - this.equippedMerchandiseCount(type, id),
        );
      },
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
    drawMetrics,
    firstActor,
    secondActor,
    gameParty: globals.$gameParty,
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
  harness.drawMetrics.length = 0;
  harness.window.draw();
  return harness.drawCalls.slice();
}

function drawMetric(harness, text) {
  return harness.drawMetrics.find((entry) => entry.text === text) || null;
}

function drawMetricAtY(harness, text, y) {
  return harness.drawMetrics.find(
    (entry) => entry.text === text && entry.y === y,
  ) || null;
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

function testUseFlowKeepsChosenItemArmedUntilCancelOrQuantityRunsOut() {
  const harness = createHarness();
  harness.firstActor.hp = 25;
  harness.secondActor.hp = 40;
  harness.gameParty.items[1] = 5;
  harness.window.show();

  press(harness, "confirm");
  assert.equal(harness.window.focusArea, "items");
  let texts = drawText(harness);
  assert.equal(includes(texts, "▶"), true);
  assert.equal(includes(texts, "Potion"), true);
  assert.equal(includes(texts, "SELECT ITEM"), true);
  assert.equal(includes(texts, "Restores a small amount of HP."), true);

  press(harness, "confirm");
  assert.equal(harness.window.focusArea, "targets");
  assert.equal(harness.window.pendingItemId, 1);
  texts = drawText(harness);
  assert.equal(includes(texts, "◆"), true);
  assert.equal(includes(texts, "Potion"), true);
  assert.equal(includes(texts, "▶ Tyler"), true);
  assert.equal(includes(texts, "Use Potion on Tyler."), true);
  assert.equal(includes(texts, "Quantity"), true);
  assert.equal(includes(texts, "x5"), true);

  // Multiple confirmations keep using the same selected item on the same
  // actor while the actor can still benefit and copies remain.
  press(harness, "confirm");
  assert.equal(harness.firstActor.hp, 75);
  assert.equal(harness.window.itemCount(1), 4);
  assert.equal(harness.window.focusArea, "targets");
  assert.equal(harness.window.pendingItemId, 1);

  press(harness, "confirm");
  assert.equal(harness.firstActor.hp, 125);
  assert.equal(harness.window.itemCount(1), 3);
  assert.equal(harness.window.focusArea, "targets");

  press(harness, "confirm");
  assert.equal(harness.firstActor.hp, 150);
  assert.equal(harness.window.itemCount(1), 2);
  assert.equal(harness.window.focusArea, "targets");

  // A full target rejects the use without consuming another copy or leaving
  // targeting mode, allowing the player to move directly to another actor.
  press(harness, "confirm");
  assert.equal(harness.firstActor.hp, 150);
  assert.equal(harness.window.itemCount(1), 2);
  assert.equal(harness.window.focusArea, "targets");
  assert.equal(harness.window.pendingItemId, 1);

  press(harness, "down");
  assert.equal(harness.window.targetIndex, 1);
  press(harness, "confirm");
  assert.equal(harness.secondActor.hp, 90);
  assert.equal(harness.window.itemCount(1), 1);
  assert.equal(harness.window.focusArea, "targets");
  assert.equal(harness.window.pendingItemId, 1);

  // Cancel is the explicit return to the item list while copies remain.
  press(harness, "cancel");
  assert.equal(harness.window.focusArea, "items");
  assert.equal(harness.window.pendingItemId, null);
  assert.equal(harness.window.itemCount(1), 1);

  // Re-enter targeting and consume the last copy. Running out automatically
  // returns to the item list because there is no longer an armed item.
  press(harness, "confirm");
  assert.equal(harness.window.focusArea, "targets");
  press(harness, "confirm");
  assert.equal(harness.secondActor.hp, 140);
  assert.equal(harness.window.itemCount(1), 0);
  assert.equal(harness.window.focusArea, "items");
  assert.equal(harness.window.pendingItemId, null);
}

function testArrangeApplyReturnsFocusToArrangeHeading() {
  const harness = createHarness();
  harness.window.show();

  press(harness, "right");
  assert.equal(harness.window.pageIndex, 1);
  assert.equal(harness.window.focusArea, "tabs");

  let texts = drawText(harness);
  assert.equal(includes(texts, "Tyler"), true);
  assert.equal(includes(texts, "Sarah"), true);
  assert.equal(includes(texts, "SORT ORDER"), false);

  press(harness, "confirm");
  assert.equal(harness.window.focusArea, "arrange");
  texts = drawText(harness);
  assert.equal(includes(texts, "SORT ORDER"), true);
  assert.equal(includes(texts, "Tyler"), true);
  assert.equal(includes(texts, "Sarah"), true);

  press(harness, "down");
  press(harness, "down");
  assert.equal(harness.window.currentArrangeOption().mode, "most");
  press(harness, "confirm");

  assert.equal(harness.window.sortMode, "most");
  assert.equal(harness.window.pageIndex, 1);
  assert.equal(harness.window.focusArea, "tabs");
  texts = drawText(harness);
  assert.equal(includes(texts, "▶ Arrange"), true);
  assert.equal(includes(texts, "SORT ORDER"), false);
  assert.equal(includes(texts, "Order"), true);
  assert.equal(includes(texts, "Most"), true);
  assert.equal(includes(texts, "Tyler"), true);

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

  let texts = drawText(harness);
  assert.equal(includes(texts, "Tyler"), true);
  assert.equal(includes(texts, "Sarah"), true);
  assert.equal(includes(texts, "Quantity"), false);

  press(harness, "confirm");
  assert.equal(harness.window.focusArea, "keyItems");

  texts = drawText(harness);
  assert.equal(includes(texts, "Bronze Pass"), true);
  assert.equal(includes(texts, "A stamped transit key item."), true);
  assert.equal(includes(texts, "Quantity"), true);

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


function testOnlyUnequippedEquipmentAppearsInItemInventoryAndCannotBeUsed() {
  const harness = createHarness();
  harness.window.show();
  press(harness, "confirm");

  const texts = drawText(harness);
  assert.equal(includes(texts, "Steel Sword [WEAPON]"), true);
  assert.equal(includes(texts, "x1"), true);
  assert.equal(includes(texts, "Iron Armor [ARMOR]"), false);
  assert.equal(includes(texts, "Power Wrist [ACC]"), true);

  const entries = harness.window.inventoryDisplayEntries();
  const steel = entries.find((entry) => entry.type === "weapon");
  assert.equal(steel?.quantity, 1, "only the unequipped Steel Sword copy is listed");
  assert.equal(entries.some((entry) => entry.type === "armor"), false);

  const steelIndex = entries.findIndex((entry) => entry.type === "weapon");
  assert.equal(steelIndex >= 0, true);
  harness.window.itemIndex = steelIndex;
  const beforeFocus = harness.window.focusArea;
  press(harness, "confirm");
  assert.equal(harness.window.focusArea, beforeFocus);
  assert.equal(harness.window.pendingItemId, null);

  const selectedTexts = drawText(harness);
  assert.equal(includes(selectedTexts, "Manage it from EQUIP"), true);
  assert.equal(includes(selectedTexts, "Equip Menu"), false);
}


function testUseAndArrangeShareTheSameColumnGeometryWithoutPartyHeading() {
  const source = read("js/windows/Window_Inventory.js");

  assert.match(source, /contentColumns\(bounds = this\.contentBounds\)/);
  assert.match(source, /drawUsePage\(context, columns\)/);
  assert.match(source, /drawArrangePage\(context, columns\)/);
  assert.match(source, /drawPartyRoster\(context, columns\)/);
  assert.match(source, /drawArrangeOverlay\(context, columns\)/);
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


function testItemHeaderKeepsOnlyDecisionUsefulInformation() {
  const harness = createHarness();
  harness.window.show();

  let texts = drawText(harness);
  assert.equal(includes(texts, "PARTY INVENTORY"), true);
  assert.equal(includes(texts, "Shared inventory for the active party."), true);
  assert.equal(includes(texts, "Active Party"), false);
  assert.equal(includes(texts, "Item Stacks"), false);
  assert.equal(includes(texts, "Total Units"), false);
  assert.equal(includes(texts, "Action"), false);
  assert.equal(includes(texts, "Confirm"), false);

  press(harness, "confirm");
  texts = drawText(harness);
  assert.equal(includes(texts, "Item"), true);
  assert.equal(includes(texts, "Potion"), true);
  assert.equal(includes(texts, "Quantity"), true);

  harness.window.returnToTabs();
  harness.window.changePage(1);
  texts = drawText(harness);
  assert.equal(includes(texts, "Order"), true);
  assert.equal(includes(texts, "Default"), true);
  assert.equal(includes(texts, "Confirm"), false);

  harness.window.changePage(1);
  texts = drawText(harness);
  assert.equal(includes(texts, "Type"), false);
}

function testItemPagesShareOneContentRhythmAndActorCardsLeaveDividerGutter() {
  const harness = createHarness();
  harness.window.show();
  const columns = harness.window.contentColumns();
  const rhythm = harness.window.contentRhythm(columns);

  assert.equal(rhythm.headingY > columns.rightBodyY, true);
  assert.equal(rhythm.firstRowY > rhythm.headingY, true);
  assert.equal(rhythm.emptyY, rhythm.firstRowY);

  const source = read("js/windows/Window_Inventory.js");
  assert.match(source, /const rhythm = this\.contentRhythm\(columns\)/);
  assert.match(source, /width: Math\.max\(0, columns\.leftWidth - 14\)/);
  assert.doesNotMatch(source, /columns\.rightBodyY \+ 46/);
}

function testPopulatedItemPagesShareVisibleTextAnchorWithoutWhitespacePadding() {
  const harness = createHarness();
  harness.window.show();

  // Use page: item focus renders a marker in its own gutter and the label at a stable X.
  press(harness, "confirm");
  drawText(harness);
  const columns = harness.window.contentColumns();
  const row = harness.window.contentRowGeometry(columns);
  const usePotion = drawMetricAtY(harness, "Potion", row.firstRowY);
  const useMarker = drawMetricAtY(harness, "▶", row.firstRowY);
  assert.ok(usePotion, "Use should draw Potion as its own text token");
  assert.ok(useMarker, "Use should draw the cursor separately from Potion");
  assert.equal(/^\s/.test(usePotion.text), false);
  assert.equal(useMarker.x < usePotion.x, true);

  // Arrange preview must use the same visible-text anchor as Use.
  harness.window.returnToTabs();
  harness.window.changePage(1);
  drawText(harness);
  const arrangePotion = drawMetricAtY(harness, "Potion", row.firstRowY);
  assert.ok(arrangePotion, "Arrange preview should draw Potion");
  assert.equal(arrangePotion.x, usePotion.x);
  assert.equal(arrangePotion.y, usePotion.y);
  assert.equal(arrangePotion.font, usePotion.font.replace(/^600 /, ""));

  // Key Items use the same first-column label anchor and no whitespace cursor padding.
  harness.window.changePage(1);
  press(harness, "confirm");
  drawText(harness);
  const keyItem = drawMetricAtY(harness, "Bronze Pass", row.firstRowY);
  assert.ok(keyItem, "Key Items should draw the key-item name independently");
  assert.equal(/^\s/.test(keyItem.text), false);
  assert.equal(keyItem.x, usePotion.x);
  assert.equal(keyItem.y, usePotion.y);

  const source = read("js/windows/Window_Inventory.js");
  assert.match(source, /contentRowGeometry\(columns/);
  assert.match(source, /drawRowMarker\(context/);
  assert.doesNotMatch(source, /`\$\{itemFocus \? "▶ " : pending \? "◆ " : "  "\}/);
  assert.doesNotMatch(source, /`\$\{focused \? "▶ " : "  "\}\$\{item\?\.name/);
}

function testEmptyKeyItemsTabIsDisabledAndSkippedByNavigation() {
  const harness = createHarness();
  delete harness.gameParty.items[3];
  harness.window.show();

  assert.equal(harness.window.pageEnabled(2), false);
  press(harness, "right");
  assert.equal(harness.window.pageIndex, 1);
  press(harness, "right");
  assert.equal(harness.window.pageIndex, 0, "navigation skips the disabled Key Items tab");
  press(harness, "left");
  assert.equal(harness.window.pageIndex, 1);

  const texts = drawText(harness);
  assert.equal(includes(texts, "Key Items"), true, "disabled tab remains visible");
}

function testSceneRoutesItemMenuToPartyBackedInventoryWindow() {
  const scene = read("js/scenes/Scene_Menu.js");

  assert.match(scene, /this\.inventoryWindow = new Window_Inventory\(\$gameParty\)/);
  assert.match(scene, /this\.inventoryWindow\.update\(\)/);
  assert.match(scene, /this\.inventoryWindow\.draw\(\)/);
}

function run() {
  testItemStartsOnUseTabOnly();
  testUseFlowKeepsChosenItemArmedUntilCancelOrQuantityRunsOut();
  testArrangeApplyReturnsFocusToArrangeHeading();
  testKeyItemsKeepReferenceTabFlowAndPartyRowsShowHpAndMp();
  testCancelMovesBackOneInteractionLevel();
  testOnlyUnequippedEquipmentAppearsInItemInventoryAndCannotBeUsed();
  testUseAndArrangeShareTheSameColumnGeometryWithoutPartyHeading();
  testItemTabsShareEqualGridAndPartyInventoryHeaderReplacesActorHeader();
  testItemHeaderKeepsOnlyDecisionUsefulInformation();
  testItemPagesShareOneContentRhythmAndActorCardsLeaveDividerGutter();
  testPopulatedItemPagesShareVisibleTextAnchorWithoutWhitespacePadding();
  testEmptyKeyItemsTabIsDisabledAndSkippedByNavigation();
  testSceneRoutesItemMenuToPartyBackedInventoryWindow();
  console.log("Item menu presentation regression tests passed.");
}

run();
