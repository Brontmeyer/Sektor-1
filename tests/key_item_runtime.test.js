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

function createRuntimeHarness() {
  const items = readData("Items.json");
  const runtimeItems = clone(items);
  runtimeItems[4] = {
    id: 4,
    article: "a",
    name: "Permanent Pass",
    pluralName: "Permanent Passes",
    description: "A permanent key item used by focused runtime tests.",
    type: "item",
    keyItem: true,
    consumable: false,
    sellable: false,
    price: 0,
    effect: null,
  };

  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    DebugManager: { log() {} },
    Game_Actor: class {},
    DatabaseManager: {
      item(id) {
        return runtimeItems[id] || null;
      },
    },
  });

  const source = [
    "js/objects/Game_Party.js",
    "js/objects/Game_Interpreter.js",
  ]
    .map((relativePath) => read(relativePath))
    .join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__classes = { Game_Party, Game_Interpreter };`,
    context,
  );

  const party = new context.__classes.Game_Party();
  const interpreter = new context.__classes.Game_Interpreter(
    { isOpen() { return false; }, show() {} },
    { isOpen() { return false; }, hasResult() { return false; } },
  );

  context.$gameParty = party;

  return { context, party, interpreter, runtimeItems };
}

function loadValidator() {
  const context = vm.createContext({ console, DebugManager: { log() {} } });
  vm.runInContext(
    `${read("js/core/DatabaseValidator.js")}\nglobalThis.__DatabaseValidator = DatabaseValidator;`,
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

function testPartyOwnsAndConsumesOnlyConsumableKeyItems() {
  const { party } = createRuntimeHarness();

  party.gainItem(3, 2);
  party.gainItem(4, 1);
  party.gainItem(1, 1);

  assert.equal(party.hasKeyItem(3), true);
  assert.equal(party.hasKeyItem(3, 2), true);
  assert.equal(party.hasKeyItem(3, 3), false);
  assert.equal(party.hasKeyItem(4), true);
  assert.equal(party.hasKeyItem(1), false);

  assert.equal(party.consumeKeyItem(3), true);
  assert.equal(party.itemCount(3), 1);

  assert.equal(party.consumeKeyItem(4), false);
  assert.equal(party.itemCount(4), 1, "permanent key items must never be removed");

  assert.equal(party.consumeKeyItem(1), false);
  assert.equal(party.itemCount(1), 1, "ordinary items are not event key items");
}

function testIfKeyItemBranchesAndOptionalConsumption() {
  const { party, interpreter } = createRuntimeHarness();

  party.gainItem(3, 1);
  interpreter.commands = [
    {
      code: "ifKeyItem",
      itemId: 3,
      consume: true,
      trueCommands: [{ code: "text", text: "Unlocked" }],
      falseCommands: [{ code: "text", text: "Locked" }],
    },
  ];
  interpreter.index = 0;

  assert.equal(interpreter.commandIfKeyItem(interpreter.commands[0]), false);
  assert.equal(party.itemCount(3), 0);
  assert.equal(interpreter.commands[0].text, "Unlocked");

  interpreter.commands = [
    {
      code: "ifKeyItem",
      itemId: 3,
      consume: true,
      trueCommands: [{ code: "text", text: "Unlocked" }],
      falseCommands: [{ code: "text", text: "Locked" }],
    },
  ];
  interpreter.index = 0;
  assert.equal(interpreter.commandIfKeyItem(interpreter.commands[0]), false);
  assert.equal(interpreter.commands[0].text, "Locked");

  party.gainItem(4, 1);
  interpreter.commands = [
    {
      code: "ifKeyItem",
      itemId: 4,
      trueCommands: [{ code: "text", text: "Permanent pass accepted" }],
      falseCommands: [{ code: "text", text: "Missing pass" }],
    },
  ];
  interpreter.index = 0;
  assert.equal(interpreter.commandIfKeyItem(interpreter.commands[0]), false);
  assert.equal(interpreter.commands[0].text, "Permanent pass accepted");
  assert.equal(party.itemCount(4), 1);
}

function testIfKeyItemValidationProtectsAuthoringContract() {
  const DatabaseValidator = loadValidator();
  const database = databaseContext();
  const map = clone(readData("Map001.json"));

  assert.equal(DatabaseValidator.validateMapData(map, database, 1), true);

  const lock = map.events.find((event) => event.id === 14);
  assert.ok(lock, "Map001 should contain the consumable Test Key lock fixture");
  const command = lock.pages[0].commands.find((entry) => entry.code === "ifKeyItem");
  assert.ok(command);
  assert.equal(command.itemId, 3);
  assert.equal(command.consume, true);

  const permanentItems = clone(database.items);
  permanentItems[3].consumable = false;
  const permanentDatabase = { ...database, items: permanentItems };

  assert.throws(
    () => DatabaseValidator.validateMapData(map, permanentDatabase, 1),
    /cannot consume permanent key item 3/,
  );

  const wrongTypeMap = clone(map);
  const wrongTypeLock = wrongTypeMap.events.find((event) => event.id === 14);
  wrongTypeLock.pages[0].commands[0].itemId = 1;
  assert.throws(
    () => DatabaseValidator.validateMapData(wrongTypeMap, database, 1),
    /itemId must reference an item with keyItem: true/,
  );
}

function run() {
  testPartyOwnsAndConsumesOnlyConsumableKeyItems();
  testIfKeyItemBranchesAndOptionalConsumption();
  testIfKeyItemValidationProtectsAuthoringContract();
  console.log("Key item runtime regression tests passed.");
}

run();
