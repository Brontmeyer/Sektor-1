"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
const readData = (filename) => JSON.parse(read(`data/${filename}`));
const clone = (value) => JSON.parse(JSON.stringify(value));

function loadValidator() {
  const source = read("js/core/DatabaseValidator.js");
  const context = vm.createContext({
    console,
    DebugManager: { log() {} },
  });

  vm.runInContext(
    `${source}\nglobalThis.__DatabaseValidator = DatabaseValidator;`,
    context,
  );

  return context.__DatabaseValidator;
}

function databaseContext() {
  return {
    mapInfos: readData("MapInfos.json"),
    items: readData("Items.json"),
    weapons: readData("Weapons.json"),
    armors: readData("Armors.json"),
    accessories: readData("Accessories.json"),
    encounters: readData("Encounters.json"),
  };
}

function testCanonicalTestKeyUsesKeyItemContract() {
  const items = readData("Items.json");
  const key = items[3];

  assert.equal(key.id, 3);
  assert.equal(key.name, "Test Key");
  assert.equal(key.keyItem, true);
  assert.equal(key.consumable, true);
  assert.equal(key.sellable, false);
  assert.equal(key.price, 0);
  assert.equal(key.effect, null);

  const errors = [];
  loadValidator().validateItems(items, errors);
  assert.deepEqual(errors, []);
}

function testMalformedKeyItemsAreRejectedWithoutWeakeningUsableItems() {
  const DatabaseValidator = loadValidator();
  const items = clone(readData("Items.json"));
  const malformed = clone(items);

  malformed[3].effect = { type: "healHp", value: 1 };
  malformed[3].keyItem = "yes";

  const errors = [];
  DatabaseValidator.validateItems(malformed, errors);

  assert.equal(
    errors.some((error) => error.includes("keyItem must be true or false")),
    true,
  );

  malformed[3].keyItem = true;
  const keyErrors = [];
  DatabaseValidator.validateItems(malformed, keyErrors);
  assert.equal(
    keyErrors.some((error) => error.includes("key items must use a null effect")),
    true,
  );

  const permanentKey = clone(items);
  permanentKey[3].consumable = false;
  const permanentErrors = [];
  DatabaseValidator.validateItems(permanentKey, permanentErrors);
  assert.deepEqual(permanentErrors, []);

  const normal = clone(items);
  normal[1].effect = null;
  const normalErrors = [];
  DatabaseValidator.validateItems(normal, normalErrors);
  assert.equal(
    normalErrors.some((error) => error.includes("effect must be an object")),
    true,
  );
}

function testMapCommentsAndTestKeyFixtureAreCanonical() {
  const DatabaseValidator = loadValidator();
  const database = databaseContext();
  const map = readData("Map001.json");
  assert.equal(DatabaseValidator.validateMapData(map, database, 1), true);

  const chest = map.events.find((event) => event.id === 13);
  assert.ok(chest, "Map001 should contain the Test Key development chest");
  assert.equal(chest.name, "Test Key Chest");

  const grant = chest.pages[0].commands.find(
    (command) => command.code === "gainItemMessage",
  );
  assert.ok(grant);
  assert.equal(grant.itemId, 3);
  assert.equal(grant.amount, 1);
}

function testAuthoringCommentsAreAllowedAcrossMapStructures() {
  const DatabaseValidator = loadValidator();
  const database = databaseContext();
  const map = clone(readData("Map001.json"));

  map._comment = "Map note";
  map.playerStart._comment = "Spawn note";
  map.obstacles[0]._comment = "Obstacle note";
  map.transfers[0]._comment = "Transfer note";
  map.events[0]._comment = "Event note";
  map.events[0].pages[0]._comment = "Page note";
  map.events[0].pages[0].conditions._comment = "Conditions note";
  const choice = map.events[0].pages[0].commands[0];
  choice._comment = "Command note";
  choice.choices[0]._comment = "Choice note";
  choice.choices[0].commands[0]._comment = "Nested command note";

  assert.equal(DatabaseValidator.validateMapData(map, database, 1), true);

  map.events[0].totallyUnknownAuthoringField = true;
  assert.throws(
    () => DatabaseValidator.validateMapData(map, database, 1),
    /unsupported property "totallyUnknownAuthoringField"/,
  );
}

function testBattleSelectorExcludesKeyItemsAndEffectlessRecords() {
  const source = read("js/windows/Window_BattleItem.js");
  const items = readData("Items.json");
  const context = vm.createContext({
    console,
    Graphics: { height: 720, context: {} },
    Input: { isActionTriggered() { return false; } },
    Window_ListViewport: class {
      constructor() { this.offset = 0; }
      ensureVisible() {}
      reset() {}
    },
    $gameParty: {
      itemIds() { return [1, 2, 3]; },
      itemCount() { return 1; },
    },
    DatabaseManager: {
      item(id) { return items[id] || null; },
    },
  });

  vm.runInContext(
    `${source}\nglobalThis.__Window_BattleItem = Window_BattleItem;`,
    context,
  );

  const window = new context.__Window_BattleItem();
  assert.deepEqual(
    Array.from(window.items(), (item) => item.name),
    ["Potion", "Hi-Potion"],
  );
}

function run() {
  testCanonicalTestKeyUsesKeyItemContract();
  testMalformedKeyItemsAreRejectedWithoutWeakeningUsableItems();
  testMapCommentsAndTestKeyFixtureAreCanonical();
  testAuthoringCommentsAreAllowedAcrossMapStructures();
  testBattleSelectorExcludesKeyItemsAndEffectlessRecords();
  console.log("Key item foundation regression tests passed.");
}

run();
