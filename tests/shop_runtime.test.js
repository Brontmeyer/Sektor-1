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

function testShopWindowIsScrollablePresentationOnly() {
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
    calls.some((call) => call[0] === "fillText" && call[1] === "Runes: 100"),
    true,
  );
  assert.equal(party.gil(), 100, "drawing must not spend Gil");
  assert.equal(party.itemCount(1), 0, "drawing must not grant merchandise");

  triggered.add("Enter");
  window.update();
  const request = window.takeResult();

  assert.deepEqual(
    { ...request },
    { action: "purchase", type: "item", id: 1 },
  );
  assert.equal(party.gil(), 100, "shop window only requests a purchase");
  assert.equal(party.itemCount(1), 0);

  triggered.clear();
  window.index = goods.length - 1;
  window.listViewport.ensureVisible(window.index, goods.length);
  calls.length = 0;
  window.draw();
  assert.equal(
    calls.some((call) => call[0] === "fillText" && String(call[1]).includes("Mystic Charm")),
    true,
    "the shared list viewport should render the final shop entry",
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
    Input: { isTriggered() { return false; }, isActionTriggered() { return false; }, actionLabel },
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
  assert.equal(scene.shopWindow.message, "Purchased Potion for 50 Runes.");

  scene.shopWindow.result = { action: "purchase", type: "item", id: 1 };
  scene.update();
  assert.equal(party.gil(), 0);
  assert.equal(party.itemCount(1), 1);
  assert.equal(scene.shopWindow.message, "Not enough Runes. Need 50, have 0.");

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
    { name: "Test Merchant", goods: [{ type: "item", id: 1 }] },
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
  testShopWindowIsScrollablePresentationOnly();
  testShopSceneOwnsPurchaseRequestsButPartyOwnsMutation();
  testInterpreterPausesAfterStartingShop();
  testSceneManagerStartsValidatedShopScene();
  testBrowserLoadOrderIncludesShopUiBeforeSceneManager();
  testShopEventValidationChecksGoodsAndDuplicates();

  console.log("Shop runtime regression tests passed.");
}

run();
