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
      name: "Ether",
      description: "Restores a modest amount of MP.",
      type: "item",
      consumable: true,
      effect: { type: "healMp", value: 20 },
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
    },
    $gameParty: {
      items: { 1: 3, 2: 1, 3: 1 },
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
    party,
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

function testItemMenuUsesSharedCharacterLanguageAndReferenceTabs() {
  const harness = createHarness();
  harness.window.show();
  const texts = drawText(harness);

  assert.equal(includes(texts, "ITEM"), true);
  assert.equal(includes(texts, "USE  1/3"), true);
  assert.equal(includes(texts, "Use"), true);
  assert.equal(includes(texts, "Arrange"), true);
  assert.equal(includes(texts, "Key Items"), true);
  assert.equal(includes(texts, "Tyler"), true);
  assert.equal(includes(texts, "Potion"), true);
  assert.equal(includes(texts, "Restores a small amount of HP."), true);
  assert.equal(includes(texts, "PARTY"), false);
  assert.equal(includes(texts, "ITEMS"), true);
  assert.equal(includes(texts, "MP 25/40"), true);

  press(harness, "up");
  const tabTexts = drawText(harness);
  assert.equal(includes(tabTexts, "▶ Use"), true);

  press(harness, "down");
  press(harness, "left");
  const targetTexts = drawText(harness);
  assert.equal(includes(targetTexts, "▶ Tyler"), true);
}

function testItemMenuSupportsArrangePageAndAvoidsUnsupportedReferenceOptions() {
  const harness = createHarness();
  harness.window.show();

  press(harness, "up");
  assert.equal(harness.window.focusArea, "tabs");
  press(harness, "right");
  assert.equal(harness.window.pageIndex, 1);
  press(harness, "down");
  assert.equal(harness.window.focusArea, "content");

  const texts = drawText(harness);
  assert.equal(includes(texts, "ARRANGE  2/3"), true);
  assert.equal(includes(texts, "SORT"), true);
  assert.equal(includes(texts, "PREVIEW"), true);
  assert.equal(includes(texts, "Default"), true);
  assert.equal(includes(texts, "Name"), true);
  assert.equal(includes(texts, "Most"), true);
  assert.equal(includes(texts, "Least"), true);

  press(harness, "down");
  press(harness, "down");
  assert.equal(harness.window.currentArrangeOption().mode, "most");
  press(harness, "confirm");
  assert.equal(harness.window.sortMode, "most");

  const source = read("js/windows/Window_Inventory.js");
  assert.doesNotMatch(source, /Customize|Field|Battle|Throw/);
}

function testItemMenuUsesSelectedTargetAndShowsKeyItemPage() {
  const harness = createHarness();
  harness.window.show();

  assert.equal(harness.secondActor.hp, 40);
  press(harness, "left");
  assert.equal(harness.window.useFocus, "targets");
  press(harness, "down");
  assert.equal(harness.window.targetIndex, 1);
  press(harness, "right");
  assert.equal(harness.window.useFocus, "items");
  press(harness, "confirm");
  assert.equal(harness.secondActor.hp, 90);
  assert.equal(harness.window.itemCount(1), 2);

  press(harness, "up");
  assert.equal(harness.window.focusArea, "tabs");
  press(harness, "right");
  press(harness, "right");
  assert.equal(harness.window.pageIndex, 2);
  press(harness, "down");

  const texts = drawText(harness);
  assert.equal(includes(texts, "KEY ITEMS  3/3"), true);
  assert.equal(includes(texts, "Bronze Pass"), true);
  assert.equal(includes(texts, "A stamped transit key item."), true);
}

function testSceneRoutesItemMenuToPartyBackedInventoryWindow() {
  const scene = read("js/scenes/Scene_Menu.js");

  assert.match(scene, /this\.inventoryWindow = new Window_Inventory\(\$gameParty\)/);
  assert.match(scene, /this\.inventoryWindow\.update\(\)/);
  assert.match(scene, /this\.inventoryWindow\.draw\(\)/);
}

function run() {
  testItemMenuUsesSharedCharacterLanguageAndReferenceTabs();
  testItemMenuSupportsArrangePageAndAvoidsUnsupportedReferenceOptions();
  testItemMenuUsesSelectedTargetAndShowsKeyItemPage();
  testSceneRoutesItemMenuToPartyBackedInventoryWindow();
  console.log("Item menu presentation regression tests passed.");
}

run();
