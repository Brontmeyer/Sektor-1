"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const readData = (filename) =>
  JSON.parse(fs.readFileSync(path.join(projectRoot, "data", filename), "utf8"));
const clone = (value) => JSON.parse(JSON.stringify(value));

function databaseContext() {
  return {
    actors: readData("Actors.json"),
    mapInfos: readData("MapInfos.json"),
    items: readData("Items.json"),
    weapons: readData("Weapons.json"),
    armors: readData("Armors.json"),
    accessories: readData("Accessories.json"),
    encounters: readData("Encounters.json"),
  };
}

function testActorNamingEventCommandIsValidated() {
  const DatabaseValidator = loadValidator();
  const database = databaseContext();
  const map = clone(readData("Map001.json"));
  const commands = map.events[0].pages[0].commands;

  commands.unshift({
    code: "nameActor",
    actorId: 2,
    prompt: "Choose {actor:2}'s name.",
  });

  assert.equal(DatabaseValidator.validateMapData(map, database, 1), true);

  commands[0].actorId = 999;
  assert.throws(
    () => DatabaseValidator.validateMapData(map, database, 1),
    /unknown actor ID 999/,
  );
}

function loadValidator() {
  const filename = path.join(projectRoot, "js/core/DatabaseValidator.js");
  const source = fs.readFileSync(filename, "utf8");
  const context = vm.createContext({
    console,
    DebugManager: { log() {} },
  });

  vm.runInContext(
    `${source}\nglobalThis.__DatabaseValidator = DatabaseValidator;`,
    context,
    { filename },
  );

  return context.__DatabaseValidator;
}

function testCurrentMapsPassValidation() {
  const DatabaseValidator = loadValidator();
  const database = databaseContext();

  assert.equal(
    DatabaseValidator.validateMapData(readData("Map001.json"), database, 1),
    true,
  );
  assert.equal(
    DatabaseValidator.validateMapData(readData("Map002.json"), database, 2),
    true,
  );
}

function testMapIdentityGeometryAndTransferContracts() {
  const DatabaseValidator = loadValidator();
  const database = databaseContext();
  const map = clone(readData("Map001.json"));

  map.id = 2;
  map.playerStart.x = map.width;
  map.obstacles[0].width = map.width;
  map.transfers[0].targetMapId = 999;

  assert.throws(
    () => DatabaseValidator.validateMapData(map, database, 1),
    (error) => {
      assert.match(error.message, /does not match requested map id 1/);
      assert.match(error.message, /playerStart\.x must be inside the map width/);
      assert.match(error.message, /extends beyond the map width/);
      assert.match(error.message, /unknown target map ID 999/);
      return true;
    },
  );
}

function testOptionalMenuAccessContractIsValidated() {
  const DatabaseValidator = loadValidator();
  const database = databaseContext();
  const allowed = clone(readData("Map001.json"));

  allowed.menuAccess = { allowSave: false, allowLoad: true };
  assert.equal(DatabaseValidator.validateMapData(allowed, database, 1), true);

  const malformed = clone(readData("Map001.json"));
  malformed.menuAccess = {
    allowSave: "sometimes",
    allowLoad: false,
    mysteryRule: true,
  };

  assert.throws(
    () => DatabaseValidator.validateMapData(malformed, database, 1),
    (error) => {
      assert.match(error.message, /unsupported property "mysteryRule"/);
      assert.match(error.message, /menuAccess\.allowSave must be true or false/);
      return true;
    },
  );
}

function testNestedEventContractsRejectMalformedCommands() {
  const DatabaseValidator = loadValidator();
  const database = databaseContext();
  const map = clone(readData("Map001.json"));
  const firstCommands = map.events[0].pages[0].commands;

  firstCommands[0].choices[0].commands.push(
    { code: "setSwitch", id: "BadBool", value: "false" },
    { code: "addVariable", id: "Visits", value: "3" },
    { code: "gainItem", itemId: 999, amount: 1 },
    { code: "gainAccessory", accessoryId: 999, amount: 1 },
    { code: "mysteryCommand" },
  );
  const battleEvent = map.events.find((event) =>
    event.pages?.some((page) =>
      page.commands?.some((command) => command.code === "battle"),
    ),
  );
  const battleCommand = battleEvent.pages
    .flatMap((page) => page.commands || [])
    .find((command) => command.code === "battle");

  battleCommand.encounterId = 999;

  assert.throws(
    () => DatabaseValidator.validateMapData(map, database, 1),
    (error) => {
      assert.match(error.message, /value must be true or false/);
      assert.match(error.message, /value must be a finite number/);
      assert.match(error.message, /unknown item ID 999/);
      assert.match(error.message, /unknown accessory ID 999/);
      assert.match(error.message, /unsupported command code "mysteryCommand"/);
      assert.match(error.message, /unknown encounter ID 999/);
      return true;
    },
  );
}

function testEventConditionsAndDuplicateIdsAreValidated() {
  const DatabaseValidator = loadValidator();
  const database = databaseContext();
  const map = clone(readData("Map001.json"));

  map.events[1].id = map.events[0].id;
  map.events[0].pages[1].conditions.switches[0].value = "true";
  map.events[0].pages[1].conditions.variables = [
    { id: "Visits", value: 2, operator: "approximately" },
  ];

  assert.throws(
    () => DatabaseValidator.validateMapData(map, database, 1),
    (error) => {
      assert.match(error.message, /duplicate event id 1/);
      assert.match(error.message, /switches\[0\]\.value must be true or false/);
      assert.match(error.message, /unsupported value "approximately"/);
      return true;
    },
  );
}


function testMap001ContainsDedicatedShopkeeperFixtures() {
  const map = readData("Map001.json");
  const shops = map.events
    .flatMap((event) =>
      (event?.pages || []).flatMap((page) =>
        (page.commands || [])
          .filter((command) => command.code === "shop")
          .map((command) => ({ event, command })),
      ),
    );

  assert.equal(shops.length, 4);

  const byType = Object.fromEntries(
    shops.map(({ event, command }) => [command.shopType, { event, command }]),
  );

  assert.equal(byType.general.command.name, "Test Merchant");
  assert.deepEqual(
    byType.general.command.goods.map((good) => good.type),
    ["item", "item"],
  );

  const dedicatedShopTypes = ["general", "weapon", "armor", "accessory"];
  for (const shopType of dedicatedShopTypes) {
    assert.ok(byType[shopType], `Missing ${shopType} shop fixture.`);
    assert.equal(typeof byType[shopType].event.x, "number");
    assert.equal(typeof byType[shopType].event.y, "number");
  }
  assert.equal(
    new Set(dedicatedShopTypes.map((shopType) => byType[shopType].event.id)).size,
    dedicatedShopTypes.length,
  );
  assert.deepEqual(
    byType.weapon.command.goods.map((good) => good.type),
    ["weapon", "weapon"],
  );
  assert.deepEqual(
    byType.armor.command.goods.map((good) => good.type),
    ["armor", "armor"],
  );
  assert.deepEqual(
    byType.accessory.command.goods.map((good) => good.type),
    ["accessory", "accessory", "accessory"],
  );
}

function testLegacyDirectEventCommandsRemainSupported() {
  const DatabaseValidator = loadValidator();
  const database = databaseContext();
  const map = clone(readData("Map002.json"));

  map.events = [
    {
      id: 1,
      name: "Legacy Event",
      x: 64,
      y: 64,
      commands: [{ code: "text", text: "Legacy path still works." }],
    },
  ];

  assert.equal(DatabaseValidator.validateMapData(map, database, 2), true);
}

async function testDatabaseManagerValidatesMapsBeforeReturningThem() {
  const validatorSource = fs.readFileSync(
    path.join(projectRoot, "js/core/DatabaseValidator.js"),
    "utf8",
  );
  const managerSource = fs.readFileSync(
    path.join(projectRoot, "js/core/DatabaseManager.js"),
    "utf8",
  );
  const context = vm.createContext({
    console,
    DebugManager: { log() {}, setEnabled() {} },
    fetch: async () => {
      throw new Error("fetch should not be used in this focused test");
    },
  });

  vm.runInContext(
    `${validatorSource}\n${managerSource}\nglobalThis.__classes = { DatabaseValidator, DatabaseManager };`,
    context,
  );

  const { DatabaseManager } = context.__classes;
  const database = databaseContext();
  Object.assign(DatabaseManager, database);
  DatabaseManager.loadJSON = async () => {
    const map = clone(readData("Map001.json"));
    map.events[0].pages[0].commands[0].code = "notReal";
    return map;
  };

  await assert.rejects(
    () => DatabaseManager.loadMap(1),
    /Map validation failed:[\s\S]*unsupported command code "notReal"/,
  );
}

function createRuntimeHarness() {
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    DebugManager: { log() {} },
    DatabaseManager: {
      item(id) {
        return id === 1 ? { id: 1, name: "Potion" } : null;
      },
      itemName(id) {
        return id === 1 ? "Potion" : `Unknown Item ${id}`;
      },
    },
  });

  const source = [
    "js/objects/Game_Variables.js",
    "js/objects/Game_Switches.js",
    "js/objects/Game_SelfSwitches.js",
    "js/objects/Game_Party.js",
    "js/objects/Game_Interpreter.js",
  ]
    .map((relativePath) =>
      fs.readFileSync(path.join(projectRoot, relativePath), "utf8"),
    )
    .join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__classes = { Game_Variables, Game_Switches, Game_SelfSwitches, Game_Party, Game_Interpreter };`,
    context,
  );

  const {
    Game_Variables,
    Game_Switches,
    Game_SelfSwitches,
    Game_Party,
    Game_Interpreter,
  } = context.__classes;
  const variables = new Game_Variables();
  const switches = new Game_Switches();
  const selfSwitches = new Game_SelfSwitches();
  const party = new Game_Party();
  const messageWindow = {
    open: false,
    text: "",
    source: "",
    isOpen() { return this.open; },
    show(text, source) {
      this.text = text;
      this.source = source;
      this.open = true;
    },
    close() { this.open = false; },
  };
  const interpreter = new Game_Interpreter(
    messageWindow,
    { isOpen() { return false; }, hasResult() { return false; } },
  );

  context.$gameVariables = variables;
  context.$gameSwitches = switches;
  context.$gameSelfSwitches = selfSwitches;
  context.$gameParty = party;

  return {
    variables,
    switches,
    selfSwitches,
    party,
    interpreter,
    messageWindow,
  };
}

function testAddVariableNormalizesArithmeticInputs() {
  const { variables, interpreter } = createRuntimeHarness();

  variables.setValue("Visits", 2);
  assert.equal(interpreter.commandAddVariable({ id: "Visits", value: "3" }), true);
  assert.equal(variables.value("Visits"), 5);

  assert.equal(
    interpreter.commandAddVariable({ id: "Visits", value: "not-a-number" }),
    true,
  );
  assert.equal(variables.value("Visits"), 5);

  variables.setValue("NumericString", "4");
  assert.equal(variables.addValue("NumericString", 2), true);
  assert.equal(variables.value("NumericString"), 6);
}


function testSwitchCommandsRejectTruthyStringBooleans() {
  const { switches, selfSwitches, interpreter } = createRuntimeHarness();

  assert.equal(
    interpreter.commandSetSwitch({ id: "GateOpen", value: "false" }),
    true,
  );
  assert.equal(switches.value("GateOpen"), false);

  interpreter.event = { mapId: 1, id: 7 };
  assert.equal(
    interpreter.commandSetSelfSwitch({ letter: "A", value: "false" }),
    true,
  );
  assert.equal(selfSwitches.value(1, 7, "A"), false);
}


function testTreasureCapacityBlocksWholeChestWithoutConsumingIt() {
  const { party, selfSwitches, interpreter, messageWindow } = createRuntimeHarness();

  assert.equal(party.gainItem(1, 98), true);
  interpreter.setup(
    [
      { code: "gainItemMessage", itemId: 1, amount: 1, source: "Chest" },
      { code: "gainItemMessage", itemId: 1, amount: 1, source: "Chest" },
      { code: "setSelfSwitch", letter: "A", value: true },
    ],
    { mapId: 1, id: 77 },
  );

  interpreter.update();

  assert.equal(party.itemCount(1), 98);
  assert.equal(messageWindow.isOpen(), true);
  assert.match(messageWindow.text, /inventory limit of 99/i);
  assert.equal(selfSwitches.value(1, 77, "A"), false);
  assert.equal(interpreter.isRunning(), true);

  messageWindow.close();
  interpreter.update();

  assert.equal(interpreter.isRunning(), false);
  assert.equal(selfSwitches.value(1, 77, "A"), false);
  assert.equal(party.itemCount(1), 98);
}

function testItemGainNormalizesQuantitiesAndRejectsInvalidInput() {
  const { party, interpreter } = createRuntimeHarness();

  assert.equal(interpreter.commandGainItem({ itemId: 1, amount: "3" }), true);
  assert.equal(party.itemCount(1), 3);

  assert.equal(party.gainItem(1, "2"), true);
  assert.equal(party.itemCount(1), 5);

  assert.equal(interpreter.commandGainItem({ itemId: 1, amount: 0 }), true);
  assert.equal(party.itemCount(1), 5);

  assert.equal(party.gainItem(1, "bad"), false);
  assert.equal(party.itemCount(1), 5);
  assert.equal(party.gainItem(999, 1), false);
  assert.equal(party.itemCount(999), 0);
}

function testMap001ContainsStoryDrivenNamingFixtures() {
  const map = readData("Map001.json");
  const protagonistEvent = map.events.find((event) => event?.id === 19);

  assert.ok(protagonistEvent, "Map001 should contain the protagonist naming fixture.");
  assert.equal(
    protagonistEvent.pages[0].commands.some(
      (command) => command.code === "nameActor" && command.actorId === 1,
    ),
    true,
  );

  for (const [eventId, actorId] of [[15, 2], [16, 3], [17, 4]]) {
    const event = map.events.find((entry) => entry?.id === eventId);
    const commands = event?.pages?.[0]?.commands || [];
    const recruitIndex = commands.findIndex(
      (command) => command.code === "recruitActor" && command.actorId === actorId,
    );
    const nameIndex = commands.findIndex(
      (command) => command.code === "nameActor" && command.actorId === actorId,
    );

    assert.ok(recruitIndex >= 0, `Event ${eventId} should recruit actor ${actorId}.`);
    assert.ok(
      nameIndex > recruitIndex,
      `Event ${eventId} should offer actor ${actorId} naming after recruitment.`,
    );
  }
}

async function run() {
  testCurrentMapsPassValidation();
  testActorNamingEventCommandIsValidated();
  testMap001ContainsStoryDrivenNamingFixtures();
  testMapIdentityGeometryAndTransferContracts();
  testOptionalMenuAccessContractIsValidated();
  testNestedEventContractsRejectMalformedCommands();
  testEventConditionsAndDuplicateIdsAreValidated();
  testMap001ContainsDedicatedShopkeeperFixtures();
  testLegacyDirectEventCommandsRemainSupported();
  await testDatabaseManagerValidatesMapsBeforeReturningThem();
  testAddVariableNormalizesArithmeticInputs();
  testSwitchCommandsRejectTruthyStringBooleans();
  testTreasureCapacityBlocksWholeChestWithoutConsumingIt();
  testItemGainNormalizesQuantitiesAndRejectsInvalidInput();

  console.log("Map/event contract regression tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
