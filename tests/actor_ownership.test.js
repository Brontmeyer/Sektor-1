"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const readData = (filename) =>
  JSON.parse(fs.readFileSync(path.join(projectRoot, "data", filename), "utf8"));
const clone = (value) => JSON.parse(JSON.stringify(value));

const actors = readData("Actors.json");
const items = readData("Items.json");
const weapons = readData("Weapons.json");
const armors = readData("Armors.json");
const magick = readData("Magick.json");
const statuses = readData("Statuses.json");

function makeDatabaseManager() {
  return {
    actors,
    items,
    weapons,
    armors,
    magick,
    statuses,
    actor(id) {
      return actors[id] || null;
    },
    item(id) {
      return items[id] || null;
    },
    weapon(id) {
      return weapons[id] || null;
    },
    armor(id) {
      return armors[id] || null;
    },
    magick(id) {
      return magick[id] || null;
    },
    magickName(id) {
      return magick[id]?.name || "Unknown Magick";
    },
    statusByKey(key) {
      return statuses.find((status) => status?.key === key) || null;
    },
  };
}

function createHarness() {
  const DatabaseManager = makeDatabaseManager();
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    DatabaseManager,
    DebugManager: { log() {} },
  });

  const source = [
    "js/objects/Game_Battler.js",
    "js/objects/Game_Actor.js",
    "js/objects/Game_Party.js",
    "js/objects/Game_SelfSwitches.js",
    "js/objects/Game_Switches.js",
    "js/objects/Game_Variables.js",
    "js/objects/Game_System.js",
    "js/objects/Game_Interpreter.js",
  ]
    .map((relativePath) =>
      fs.readFileSync(path.join(projectRoot, relativePath), "utf8"),
    )
    .join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__classes = { Game_Actor, Game_Party, Game_System, Game_Interpreter };`,
    context,
  );

  return { context, DatabaseManager, ...context.__classes };
}

function testGameSystemBuildsActorsFromDatabaseAndInitialMagick() {
  const { Game_System } = createHarness();
  const system = new Game_System();

  assert.equal(system.actors.length, 4);
  assert.deepEqual(
    Array.from(system.actors, (actor) => actor.actorId),
    [1, 2, 3, 4],
  );
  assert.deepEqual(
    Array.from(system.party.members(), (actor) => actor.actorId),
    [1, 2, 3, 4],
  );
  assert.equal(Object.hasOwn(system, "actor2"), false);
  assert.equal(Object.hasOwn(system, "actor3"), false);
  assert.equal(Object.hasOwn(system, "actor4"), false);

  assert.deepEqual(Array.from(system.actors[0].magickIds), []);
  assert.deepEqual(Array.from(system.actors[1].magickIds), [1, 10]);
  assert.deepEqual(Array.from(system.actors[2].magickIds), [1, 10]);
  assert.deepEqual(Array.from(system.actors[3].magickIds), [1, 10]);
}

function testPartyOwnedDefaultItemTargetAndExplicitInventoryClear() {
  const { Game_System } = createHarness();
  const system = new Game_System();
  const party = system.party;
  const leader = party.leader();

  leader.setHp(100);
  party.gainItem(1, 1);
  party.gainWeapon(1, 1);
  party.gainArmor(1, 1);

  assert.equal(party.useItem(1), true);
  assert.equal(leader.hp > 100, true);
  assert.equal(party.itemCount(1), 0);

  party.clearInventory();

  assert.equal(party.itemCount(1), 0);
  assert.equal(party.weaponCount(1), 0);
  assert.equal(party.armorCount(1), 0);
  assert.equal(party.members().length, 4);
  assert.equal(typeof party.clear, "undefined");
}

function testEquipmentMutationStaysOnGameActorApi() {
  const { Game_System } = createHarness();
  const actor = new Game_System().party.leader();

  assert.equal(actor.equipWeapon(1), true);
  assert.equal(actor.weaponId, 1);
  assert.equal(actor.unequipWeapon(), true);
  assert.equal(actor.weaponId, 0);
  assert.equal(actor.unequipWeapon(), false);

  assert.equal(actor.equipArmor(1), true);
  assert.equal(actor.armorId, 1);
  assert.equal(actor.unequipArmor(), true);
  assert.equal(actor.armorId, 0);
  assert.equal(actor.unequipArmor(), false);
}

function testInterpreterExpUsesPartyLeaderWithoutGameActorAlias() {
  const { context, Game_System, Game_Interpreter } = createHarness();
  const system = new Game_System();
  const leader = system.party.leader();
  const startingExp = leader.exp;

  context.$gameParty = system.party;
  assert.equal(Object.hasOwn(context, "$gameActor"), false);

  const messageWindow = {
    opened: false,
    isOpen() {
      return this.opened;
    },
    show() {
      this.opened = true;
    },
  };
  const choiceWindow = { isOpen() { return false; }, hasResult() { return false; } };
  const interpreter = new Game_Interpreter(messageWindow, choiceWindow);

  assert.equal(interpreter.commandGainExp({ amount: 25 }), true);
  assert.equal(leader.exp, startingExp + 25);
}

function testRuntimeHasNoActiveGameActorDependencyOutsideCompatibilityAlias() {
  const jsRoot = path.join(projectRoot, "js");
  const offenders = [];

  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith(".js")) {
        continue;
      }

      const relativePath = path.relative(projectRoot, fullPath).replaceAll("\\", "/");
      const source = fs.readFileSync(fullPath, "utf8");

      if (relativePath !== "js/main.js" && source.includes("$gameActor")) {
        offenders.push(relativePath);
      }
    }
  }

  walk(jsRoot);
  assert.deepEqual(offenders, []);
}

function testActorInitialMagickValidation() {
  const validatorSource = fs.readFileSync(
    path.join(projectRoot, "js/core/DatabaseValidator.js"),
    "utf8",
  );
  const context = vm.createContext({
    console,
    DebugManager: { log() {} },
  });

  vm.runInContext(
    `${validatorSource}\nglobalThis.__DatabaseValidator = DatabaseValidator;`,
    context,
  );

  const actorData = clone(actors);
  const errors = [];

  actorData[2].initialMagickIds = [1, 1, 999];
  actorData[3].initialMagickIds = "1,10";

  context.__DatabaseValidator.validateActors(actorData, errors, magick);

  assert.equal(
    errors.some((error) => error.includes("duplicate magick ID 1")),
    true,
  );
  assert.equal(
    errors.some((error) => error.includes("unknown magick ID 999")),
    true,
  );
  assert.equal(
    errors.some((error) => error.includes("Actor 3 initialMagickIds must be an array")),
    true,
  );
}

function run() {
  testGameSystemBuildsActorsFromDatabaseAndInitialMagick();
  testPartyOwnedDefaultItemTargetAndExplicitInventoryClear();
  testEquipmentMutationStaysOnGameActorApi();
  testInterpreterExpUsesPartyLeaderWithoutGameActorAlias();
  testRuntimeHasNoActiveGameActorDependencyOutsideCompatibilityAlias();
  testActorInitialMagickValidation();

  console.log("Actor ownership regression tests passed.");
}

run();
