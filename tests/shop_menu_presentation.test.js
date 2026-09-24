"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
const readData = (filename) =>
  JSON.parse(fs.readFileSync(path.join(projectRoot, "data", filename), "utf8"));

const items = readData("Items.json");
const weapons = readData("Weapons.json");
const armors = readData("Armors.json");
const accessories = readData("Accessories.json");

function makeActor(actorId, name) {
  return {
    actorId,
    name,
    weaponId: 2,
    armorId: 2,
    accessoryId: 1,
    weapon() { return weapons[this.weaponId] || null; },
    armor() { return armors[this.armorId] || null; },
    accessory() { return accessories[this.accessoryId] || null; },
    totalAttack() { return 33; },
    totalDefense() { return 26; },
    totalMagicAttack() { return 20; },
    totalMagicDefense() { return 18; },
    totalCritical() { return 5; },
    attackWithWeapon(weapon, accessory) {
      return 20 + (weapon?.attack || 0) + (accessory?.bonuses?.attack || 0);
    },
    defenseWithArmor(armor, accessory) {
      return 18 + (armor?.defense || 0) + (accessory?.bonuses?.defense || 0);
    },
    magicAttackWithWeapon(weapon, accessory) {
      return 20 + (weapon?.magicAttack || 0) + (accessory?.bonuses?.magicAttack || 0);
    },
    magicDefenseWithAccessory(accessory) {
      return 18 + (accessory?.bonuses?.magicDefense || 0);
    },
    criticalWithWeapon(weapon, accessory) {
      return (weapon?.criticalBonus || 0) + (accessory?.bonuses?.criticalBonus || 0);
    },
  };
}

function createHarness(shopType = "general") {
  const calls = [];
  const triggered = new Set();
  const actors = [
    makeActor(1, "Tyler"),
    makeActor(2, "Sarah"),
    makeActor(3, "Aboo"),
    makeActor(4, "G Prime"),
  ];
  const inventory = {
    items: { 1: 5, 2: 15 },
    weapons: { 2: 1 },
    armors: { 2: 1 },
    accessories: { 1: 1 },
  };
  let runes = 999;

  const context2d = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "left",
    textBaseline: "middle",
    save() {},
    restore() {},
    fillRect(...args) { calls.push(["fillRect", ...args]); },
    strokeRect(...args) { calls.push(["strokeRect", ...args]); },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fillText(...args) { calls.push(["fillText", ...args]); },
    measureText(text) { return { width: String(text).length * 8 }; },
  };

  const db = {
    item(id) { return items[id] || null; },
    weapon(id) { return weapons[id] || null; },
    armor(id) { return armors[id] || null; },
    accessory(id) { return accessories[id] || null; },
  };

  const party = {
    ...inventory,
    members() { return actors; },
    gil() { return runes; },
    merchandiseRecord(type, id) {
      return db[type]?.(id) || null;
    },
    merchandiseCount(type, id) {
      const store = type === "item" ? this.items : type === "weapon" ? this.weapons : type === "armor" ? this.armors : this.accessories;
      return store[id] || 0;
    },
    equippedMerchandiseCount(type, id) {
      const key = type === "weapon" ? "weaponId" : type === "armor" ? "armorId" : type === "accessory" ? "accessoryId" : null;
      return key ? actors.filter((actor) => actor[key] === id).length : 0;
    },
    sellableMerchandiseCount(type, id) {
      return Math.max(0, this.merchandiseCount(type, id) - this.equippedMerchandiseCount(type, id));
    },
    merchandiseSellPrice(type, id) {
      return Math.floor((this.merchandiseRecord(type, id)?.price || 0) / 2);
    },
  };

  const globals = {
    console,
    Graphics: { width: 1280, height: 720, context: context2d },
    Input: {
      isActionTriggered(action) { return triggered.has(action); },
      isActionRepeated(action) { return triggered.has(action); },
    },
    DatabaseManager: db,
    $gameParty: party,
  };

  const context = vm.createContext(globals);
  vm.runInContext(
    `${read("js/windows/Window_ListViewport.js")}\n${read("js/windows/Window_Shop.js")}\nglobalThis.__Window = Window_Shop;`,
    context,
  );

  return {
    window: new context.__Window({
      name: "Test Merchant",
      shopType,
      goods: [
        { type: "item", id: 1 },
        { type: "item", id: 2 },
        { type: "weapon", id: 1 },
        { type: "weapon", id: 2 },
        { type: "armor", id: 1 },
        { type: "armor", id: 2 },
        { type: "accessory", id: 1 },
        { type: "accessory", id: 2 },
        { type: "accessory", id: 3 },
      ],
    }),
    calls,
    triggered,
  };
}

function texts(harness) {
  harness.calls.length = 0;
  harness.window.draw();
  return harness.calls
    .filter((call) => call[0] === "fillText")
    .map((call) => String(call[1]));
}

function includes(values, text) {
  return values.some((value) => value === text || value.includes(text));
}

function press(harness, action) {
  harness.triggered.clear();
  harness.triggered.add(action);
  harness.window.update();
  harness.triggered.clear();
}

function testWelcomeIntroducesMerchantWithoutPreviewingStock() {
  const harness = createHarness();
  const values = texts(harness);

  assert.equal(includes(values, "Welcome!"), true);
  assert.equal(includes(values, "SHOPKEEPER"), true);
  assert.equal(includes(values, "Test Merchant"), true);
  assert.equal(includes(values, "Buy"), true);
  assert.equal(includes(values, "Sell"), true);
  assert.equal(includes(values, "Exit"), true);
  assert.equal(includes(values, "Potion"), false);
  assert.equal(includes(values, "MERCHANDISE"), false);
}

function testBuyPresentationAvoidsOldPanelHeadingsAndKeepsRosterComparison() {
  const harness = createHarness();
  press(harness, "confirm");
  harness.window.buyIndex = 2;
  const values = texts(harness);

  assert.equal(includes(values, "BUY"), true);
  assert.equal(includes(values, "DETAILS"), true);
  assert.equal(includes(values, "Iron Sword"), true);
  assert.equal(includes(values, "Tyler"), true);
  assert.equal(includes(values, "ATK"), true);
  assert.equal(includes(values, "ROSTER PREVIEW"), false);
  assert.equal(includes(values, "PARTY"), false);
}

function testSellUsesSharedQuantityPopupAndNoFooterPrice() {
  const harness = createHarness();
  harness.window.commandIndex = 1;
  press(harness, "confirm");
  let values = texts(harness);

  assert.equal(includes(values, "SELL"), true);
  assert.equal(includes(values, "Sell Price:"), false);

  press(harness, "confirm");
  values = texts(harness);
  assert.equal(harness.window.state, "quantity");
  assert.equal(harness.window.quantityMode, "sell");
  assert.equal(includes(values, "Sell Price"), true);
  assert.equal(includes(values, "Available"), true);
  assert.equal(includes(values, "Quantity"), true);
  assert.equal(includes(values, "Receive"), true);
}


function testShopTypeControlsIdentityAndMerchandiseScope() {
  const weaponHarness = createHarness("weapon");
  const welcome = texts(weaponHarness);

  assert.equal(includes(welcome, "Weapon Shop"), true);

  press(weaponHarness, "confirm");
  const buyValues = texts(weaponHarness);
  assert.equal(includes(buyValues, "Iron Sword"), true);
  assert.equal(includes(buyValues, "Steel Sword"), true);
  assert.equal(includes(buyValues, "Potion"), false);

  weaponHarness.window.commandIndex = 1;
  weaponHarness.window.state = "command";
  press(weaponHarness, "confirm");
  const sellValues = texts(weaponHarness);
  assert.equal(includes(sellValues, "Steel Sword"), false, "equipped weapon copies remain protected");
  assert.equal(includes(sellValues, "Potion"), false, "weapon shops do not buy item inventory");
}

function testRosterNamesShareTheStatTextColumn() {
  const harness = createHarness();
  press(harness, "confirm");
  harness.window.buyIndex = 2;
  harness.calls.length = 0;
  harness.window.draw();

  const tyler = harness.calls.find(
    (call) => call[0] === "fillText" && call[1] === "Tyler",
  );
  const atk = harness.calls.find(
    (call) => call[0] === "fillText" && call[1] === "ATK",
  );

  assert.ok(tyler, "Tyler comparison label should be drawn");
  assert.ok(atk, "ATK comparison label should be drawn");
  assert.equal(tyler[2], atk[2], "actor name and affected stats share one left edge");
}

function run() {
  testWelcomeIntroducesMerchantWithoutPreviewingStock();
  testBuyPresentationAvoidsOldPanelHeadingsAndKeepsRosterComparison();
  testSellUsesSharedQuantityPopupAndNoFooterPrice();
  testShopTypeControlsIdentityAndMerchandiseScope();
  testRosterNamesShareTheStatTextColumn();
  console.log("Shop menu presentation regression tests passed.");
}

run();
