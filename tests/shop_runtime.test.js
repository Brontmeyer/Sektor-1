"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");

const defaultActionCodes = {
  up: ["KeyW", "ArrowUp"],
  down: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  confirm: ["KeyE", "Enter"],
  cancel: ["KeyQ", "Escape"],
  menu: ["Escape"],
  interact: ["KeyE"],
  help: ["KeyH"],
  scope: ["KeyR"],
};

function actionTriggered(triggered, action) {
  return (defaultActionCodes[action] || []).some((code) => triggered.has(code));
}

function actionLabel(action) {
  const labels = {
    up: "W / ↑", down: "S / ↓", left: "A / ←", right: "D / →",
    confirm: "E / Enter", cancel: "Q / Esc", menu: "Esc",
    interact: "E", help: "H", scope: "R",
  };
  return labels[action] || action;
}
const readData = (filename) =>
  JSON.parse(fs.readFileSync(path.join(projectRoot, "data", filename), "utf8"));

const items = readData("Items.json");
const weapons = readData("Weapons.json");
const armors = readData("Armors.json");
const accessories = readData("Accessories.json");
const mapInfos = readData("MapInfos.json");
const map001 = readData("Map001.json");

function databaseManager() {
  return {
    items,
    weapons,
    armors,
    accessories,
    item(id) { return items[id] || null; },
    weapon(id) { return weapons[id] || null; },
    armor(id) { return armors[id] || null; },
    accessory(id) { return accessories[id] || null; },
  };
}

function loadGameParty() {
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    DatabaseManager: databaseManager(),
    DebugManager: { log() {} },
    Game_Actor: class Game_Actor {},
  });
  const source = fs.readFileSync(
    path.join(projectRoot, "js/objects/Game_Party.js"),
    "utf8",
  );

  vm.runInContext(`${source}\nglobalThis.__Game_Party = Game_Party;`, context);
  return context.__Game_Party;
}

function testPurchasesUseCanonicalPricesAndPartyInventory() {
  const Game_Party = loadGameParty();
  const party = new Game_Party();

  assert.equal(party.gainGil(1000), true);

  const itemPurchase = party.purchaseMerchandise("item", 1, 2);
  assert.equal(itemPurchase.success, true);
  assert.equal(itemPurchase.unitPrice, 50);
  assert.equal(itemPurchase.totalPrice, 100);
  assert.equal(party.itemCount(1), 2);
  assert.equal(party.gil(), 900);

  const weaponPurchase = party.purchaseMerchandise("weapon", 1);
  const armorPurchase = party.purchaseMerchandise("armor", 1);
  const accessoryPurchase = party.purchaseMerchandise("accessory", 1);

  assert.equal(weaponPurchase.success, true);
  assert.equal(armorPurchase.success, true);
  assert.equal(accessoryPurchase.success, true);
  assert.equal(party.weaponCount(1), 1);
  assert.equal(party.armorCount(1), 1);
  assert.equal(party.accessoryCount(1), 1);
  assert.equal(party.gil(), 550);
}

function testFailedPurchaseDoesNotMutateGilOrInventory() {
  const Game_Party = loadGameParty();
  const party = new Game_Party();

  party.gainGil(49);

  const result = party.purchaseMerchandise("item", 1);

  assert.equal(result.success, false);
  assert.equal(result.reason, "insufficientGil");
  assert.equal(result.requiredGil, 50);
  assert.equal(party.gil(), 49);
  assert.equal(party.itemCount(1), 0);

  const unknownType = party.purchaseMerchandise("relic", 1);
  assert.equal(unknownType.success, false);
  assert.equal(unknownType.reason, "unknownMerchandise");
  assert.equal(party.gil(), 49);
}

function testInventoryLimitBlocksDirectAndRepeatedShopPurchases() {
  const Game_Party = loadGameParty();
  const party = new Game_Party();

  party.gainGil(10000);
  assert.equal(party.inventoryLimit(), 99);
  assert.equal(party.gainItem(1, 99), true);
  assert.equal(party.itemCount(1), 99);
  assert.equal(party.itemCapacity(1), 0);
  assert.equal(party.gainItem(1, 1), false);
  assert.equal(party.itemCount(1), 99);

  const blocked = party.purchaseMerchandise("item", 1, 1);
  assert.equal(blocked.success, false);
  assert.equal(blocked.reason, "inventoryFull");
  assert.equal(blocked.limit, 99);
  assert.equal(party.itemCount(1), 99);
  assert.equal(party.gil(), 10000);

  party.loseItem(1, 1);
  assert.equal(party.itemCount(1), 98);
  assert.equal(party.purchaseMerchandise("item", 1, 2).reason, "inventoryFull");
  assert.equal(party.purchaseMerchandise("item", 1, 1).success, true);
  assert.equal(party.itemCount(1), 99);
}

function testShopBuyQuantityHonorsRemainingInventoryCapacity() {
  const { party, triggered, Window_Shop } = createShopUiHarness();
  const window = new Window_Shop({
    name: "Test Merchant",
    goods: [{ type: "item", id: 1 }],
  });

  party.gainGil(10000);
  party.gainItem(1, 99);

  triggered.add("Enter");
  window.update();
  triggered.clear();
  assert.equal(window.state, "buy");
  assert.equal(window.buyQuantityMax(window.currentEntry()), 0);

  triggered.add("Enter");
  window.update();
  triggered.clear();
  assert.equal(window.state, "buy");
  assert.match(window.message, /inventory limit/i);

  party.loseItem(1, 1);
  assert.equal(window.buyQuantityMax(window.currentEntry()), 1);
}

function testSellingReturnsHalfPriceWithoutCorruptingInventory() {
  const Game_Party = loadGameParty();
  const party = new Game_Party();

  party.gainItem(1, 3);

  const sale = party.sellMerchandise("item", 1, 2);
  assert.equal(sale.success, true);
  assert.equal(sale.unitPrice, 25);
  assert.equal(sale.totalPrice, 50);
  assert.equal(party.itemCount(1), 1);
  assert.equal(party.gil(), 50);

  const failed = party.sellMerchandise("item", 1, 2);
  assert.equal(failed.success, false);
  assert.equal(failed.reason, "insufficientInventory");
  assert.equal(party.itemCount(1), 1);
  assert.equal(party.gil(), 50);
}

function makeDrawContext(calls) {
  return {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
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
}

function createShopUiHarness() {
  const Game_Party = loadGameParty();
  const party = new Game_Party();
  const calls = [];
  const triggered = new Set();
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    DatabaseManager: databaseManager(),
    DebugManager: { log() {} },
    Graphics: {
      width: 1280,
      height: 720,
      context: makeDrawContext(calls),
    },
    Input: {
      isTriggered(code) { return triggered.has(code); },
      isActionTriggered(action) { return actionTriggered(triggered, action); },
      isActionRepeated(action) { return actionTriggered(triggered, action); },
      actionLabel,
    },
    $gameParty: party,
  });
  const source = [
    "js/windows/Window_ListViewport.js",
    "js/windows/Window_Shop.js",
  ]
    .map((relativePath) =>
      fs.readFileSync(path.join(projectRoot, relativePath), "utf8"),
    )
    .join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__Window_Shop = Window_Shop;`,
    context,
  );

  return {
    party,
    calls,
    triggered,
    Window_Shop: context.__Window_Shop,
  };
}

function testShopWindowSupportsCommandEntryAndScrollableBuyPresentation() {
  const { party, calls, triggered, Window_Shop } = createShopUiHarness();
  const goods = [
    { type: "item", id: 1 },
    { type: "item", id: 2 },
    { type: "weapon", id: 1 },
    { type: "weapon", id: 2 },
    { type: "armor", id: 1 },
    { type: "armor", id: 2 },
    { type: "accessory", id: 1 },
    { type: "accessory", id: 2 },
    { type: "accessory", id: 3 },
  ];
  const window = new Window_Shop({ name: "Test Merchant", goods });

  party.gainGil(100);
  window.draw();

  assert.equal(
    calls.some((call) => call[0] === "fillText" && call[1] === "Test Merchant"),
    true,
  );
  assert.equal(
    calls.some((call) => call[0] === "fillText" && call[1] === "Runes"),
    true,
  );
  assert.equal(
    calls.some((call) => call[0] === "fillText" && call[1] === "100 R"),
    true,
  );
  assert.equal(
    calls.some((call) => call[0] === "fillText" && call[1] === "Potion"),
    false,
    "the welcome screen should introduce the merchant instead of exposing wares before Buy is opened",
  );
  assert.equal(party.gil(), 100, "drawing must not spend Gil");
  assert.equal(party.itemCount(1), 0, "drawing must not grant merchandise");

  triggered.add("Enter");
  window.update();
  triggered.clear();
  assert.equal(window.state, "buy");

  triggered.add("Enter");
  window.update();
  triggered.clear();
  assert.equal(window.state, "quantity");

  triggered.add("Enter");
  window.update();
  triggered.clear();
  const request = window.takeResult();

  assert.deepEqual(
    { ...request },
    { action: "purchase", type: "item", id: 1, quantity: 1 },
  );
  assert.equal(party.gil(), 100, "shop window only requests a purchase");
  assert.equal(party.itemCount(1), 0);

  window.buyIndex = goods.length - 1;
  window.state = "buy";
  calls.length = 0;
  window.draw();
  assert.equal(
    calls.some((call) => call[0] === "fillText" && String(call[1]).includes(accessories[3].name)),
    true,
    "the shared list viewport should render the final shop entry",
  );
}



function testSellMenuProtectsEquippedCopiesAndUsesQuantityConfirmation() {
  const { party, triggered, Window_Shop } = createShopUiHarness();
  const window = new Window_Shop({
    name: "Test Merchant",
    goods: [{ type: "weapon", id: 1 }],
  });

  party.gainWeapon(1, 2);
  party._actors = [{ actorId: 1, name: "Tyler", weaponId: 1, armorId: 0, accessoryId: 0 }];

  window.commandIndex = 1;
  triggered.add("Enter");
  window.update();
  triggered.clear();

  assert.equal(window.state, "sell");
  assert.equal(window.orderedSellEntries().length, 1);
  assert.equal(window.currentSellEntry().available, 1);

  triggered.add("Enter");
  window.update();
  triggered.clear();

  assert.equal(window.state, "quantity");
  assert.equal(window.quantityMode, "sell");
  assert.equal(window.quantityMax(), 1);

  triggered.add("Enter");
  window.update();
  triggered.clear();

  assert.deepEqual(
    { ...window.takeResult() },
    { action: "sell", type: "weapon", id: 1, quantity: 1 },
  );

  party.loseWeapon(1, 1);
  assert.equal(
    window.orderedSellEntries().some((entry) => entry.type === "weapon" && entry.id === 1),
    false,
    "the final equipped copy must not appear as saleable inventory",
  );
}

function testShopSceneOwnsPurchaseRequestsButPartyOwnsMutation() {
  const Game_Party = loadGameParty();
  const party = new Game_Party();
  const calls = [];
  let popCount = 0;
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    DatabaseManager: databaseManager(),
    DebugManager: { log() {} },
    Graphics: {
      width: 1280,
      height: 720,
      context: makeDrawContext(calls),
    },
    Input: { isTriggered() { return false; }, isActionTriggered() { return false; }, isActionRepeated() { return false; }, actionLabel },
    $gameParty: party,
    SceneManager: {
      pop() { popCount += 1; },
    },
  });
  const source = [
    "js/windows/Window_ListViewport.js",
    "js/windows/Window_Shop.js",
    "js/scenes/Scene_Base.js",
    "js/scenes/Scene_Shop.js",
  ]
    .map((relativePath) =>
      fs.readFileSync(path.join(projectRoot, relativePath), "utf8"),
    )
    .join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__Scene_Shop = Scene_Shop;`,
    context,
  );

  const Scene_Shop = context.__Scene_Shop;
  const scene = new Scene_Shop({
    name: "Test Merchant",
    goods: [{ type: "item", id: 1 }],
  });

  party.gainGil(50);
  scene.shopWindow.result = { action: "purchase", type: "item", id: 1 };
  scene.update();

  assert.equal(party.gil(), 0);
  assert.equal(party.itemCount(1), 1);
  assert.equal(scene.shopWindow.message, `Purchased ${items[1].name} for 50 R.`);

  scene.shopWindow.result = { action: "purchase", type: "item", id: 1 };
  scene.update();
  assert.equal(party.gil(), 0);
  assert.equal(party.itemCount(1), 1);
  assert.equal(scene.shopWindow.message, "Not enough Runes. Need 50 R, have 0 R.");

  party.gainItem(1, 1);
  scene.shopWindow.result = { action: "sell", type: "item", id: 1, quantity: 1 };
  scene.update();
  assert.equal(party.gil(), 25);
  assert.equal(party.itemCount(1), 1);
  assert.equal(scene.shopWindow.message, `Sold ${items[1].name} for 25 R.`);

  scene.shopWindow.result = { action: "cancel" };
  scene.update();
  assert.equal(popCount, 1);
}

function testInterpreterPausesAfterStartingShop() {
  const started = [];
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    DebugManager: { log() {} },
    SceneManager: {
      startShop(shopData) {
        started.push(shopData);
        return true;
      },
    },
  });
  const source = fs.readFileSync(
    path.join(projectRoot, "js/objects/Game_Interpreter.js"),
    "utf8",
  );

  vm.runInContext(
    `${source}\nglobalThis.__Game_Interpreter = Game_Interpreter;`,
    context,
  );

  const Game_Interpreter = context.__Game_Interpreter;
  const messageWindow = { isOpen() { return false; } };
  const choiceWindow = {
    isOpen() { return false; },
    hasResult() { return false; },
  };
  const interpreter = new Game_Interpreter(messageWindow, choiceWindow);
  const command = {
    code: "shop",
    name: "Test Merchant",
    goods: [{ type: "item", id: 1 }],
  };

  interpreter.index = 3;
  assert.equal(interpreter.commandShop(command), false);
  assert.equal(interpreter.index, 4);
  assert.deepEqual(JSON.parse(JSON.stringify(started)), [
    {
      name: "Test Merchant",
      shopType: "general",
      goods: [{ type: "item", id: 1 }],
    },
  ]);
}


function testSceneManagerStartsValidatedShopScene() {
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    DebugManager: { log() {} },
    DatabaseManager: { encounter() { return null; } },
    Scene_Battle: class Scene_Battle {},
    Scene_Shop: class Scene_Shop {
      constructor(shopData) {
        this.shopData = shopData;
      }
      start() {}
      terminate() {}
    },
  });
  const source = fs.readFileSync(
    path.join(projectRoot, "js/core/SceneManager.js"),
    "utf8",
  );

  vm.runInContext(
    `${source}\nglobalThis.__SceneManager = SceneManager;`,
    context,
  );

  const SceneManager = context.__SceneManager;
  SceneManager.initialize();

  assert.equal(SceneManager.startShop({ name: "Empty", goods: [] }), false);
  assert.equal(SceneManager.currentScene, null);

  const shopData = {
    name: "Test Merchant",
    goods: [{ type: "item", id: 1 }],
  };
  assert.equal(SceneManager.startShop(shopData), true);
  assert.equal(SceneManager.currentScene.shopData, shopData);
}

function testBrowserLoadOrderIncludesShopUiBeforeSceneManager() {
  const indexSource = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
  const windowIndex = indexSource.indexOf("Window_Shop.js");
  const sceneIndex = indexSource.indexOf("Scene_Shop.js");
  const managerIndex = indexSource.indexOf("SceneManager.js");

  assert.equal(windowIndex >= 0, true);
  assert.equal(sceneIndex > windowIndex, true);
  assert.equal(managerIndex > sceneIndex, true);
}

function testShopEventValidationChecksGoodsAndDuplicates() {
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    DebugManager: { log() {} },
  });
  const source = fs.readFileSync(
    path.join(projectRoot, "js/core/DatabaseValidator.js"),
    "utf8",
  );

  vm.runInContext(
    `${source}\nglobalThis.__DatabaseValidator = DatabaseValidator;`,
    context,
  );

  const DatabaseValidator = context.__DatabaseValidator;
  const database = {
    mapInfos,
    items,
    weapons,
    armors,
    accessories,
  };

  assert.equal(DatabaseValidator.validateMapData(map001, database, 1), true);

  const fractionalPriceItems = JSON.parse(JSON.stringify(items));
  fractionalPriceItems[1].price = 12.5;
  const priceErrors = [];
  DatabaseValidator.validateItems(fractionalPriceItems, priceErrors);
  assert.equal(
    priceErrors.some((error) => error.includes("Item 1 price")),
    true,
    "shop prices must be integer Gil values",
  );

  const invalid = JSON.parse(JSON.stringify(map001));
  const invalidShopCommand = invalid.events
    .flatMap((event) => event.pages || [])
    .flatMap((page) => page.commands || [])
    .find((command) => command.code === "shop");
  invalidShopCommand.goods = [{ type: "item", id: 999 }];
  assert.throws(
    () => DatabaseValidator.validateMapData(invalid, database, 1),
    /unknown item ID 999/,
  );

  const invalidShopType = JSON.parse(JSON.stringify(map001));
  const invalidTypeCommand = invalidShopType.events
    .flatMap((event) => event.pages || [])
    .flatMap((page) => page.commands || [])
    .find((command) => command.code === "shop");
  invalidTypeCommand.shopType = "magic";
  assert.throws(
    () => DatabaseValidator.validateMapData(invalidShopType, database, 1),
    /shopType must be general, item, weapon, armor, or accessory/,
  );

  const mismatchedShop = JSON.parse(JSON.stringify(map001));
  const mismatchedCommand = mismatchedShop.events
    .flatMap((event) => event.pages || [])
    .flatMap((page) => page.commands || [])
    .find((command) => command.code === "shop");
  mismatchedCommand.shopType = "weapon";
  mismatchedCommand.goods = [{ type: "item", id: 1 }];
  assert.throws(
    () => DatabaseValidator.validateMapData(mismatchedShop, database, 1),
    /type must be weapon for a weapon shop/,
  );

  const duplicate = JSON.parse(JSON.stringify(map001));
  const duplicateShopCommand = duplicate.events
    .flatMap((event) => event.pages || [])
    .flatMap((page) => page.commands || [])
    .find((command) => command.code === "shop");
  duplicateShopCommand.goods = [
    { type: "item", id: 1 },
    { type: "item", id: 1 },
  ];
  assert.throws(
    () => DatabaseValidator.validateMapData(duplicate, database, 1),
    /duplicates shop good item:1/,
  );
}

function run() {
  testPurchasesUseCanonicalPricesAndPartyInventory();
  testFailedPurchaseDoesNotMutateGilOrInventory();
  testInventoryLimitBlocksDirectAndRepeatedShopPurchases();
  testShopBuyQuantityHonorsRemainingInventoryCapacity();
  testSellingReturnsHalfPriceWithoutCorruptingInventory();
  testShopWindowSupportsCommandEntryAndScrollableBuyPresentation();
  testSellMenuProtectsEquippedCopiesAndUsesQuantityConfirmation();
  testShopSceneOwnsPurchaseRequestsButPartyOwnsMutation();
  testInterpreterPausesAfterStartingShop();
  testSceneManagerStartsValidatedShopScene();
  testBrowserLoadOrderIncludesShopUiBeforeSceneManager();
  testShopEventValidationChecksGoodsAndDuplicates();

  console.log("Shop runtime regression tests passed.");
}

run();
