"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
const readData = (name) =>
  JSON.parse(fs.readFileSync(path.join(projectRoot, "data", name), "utf8"));

function createHarness() {
  const actors = readData("Actors.json");
  const weapons = readData("Weapons.json");
  const armors = readData("Armors.json");
  const accessories = readData("Accessories.json");
  const items = readData("Items.json");
  const magick = readData("Magick.json");
  const skills = readData("Skills.json");
  const essences = readData("Essences.json");
  const statuses = readData("Statuses.json");

  const DatabaseManager = {
    actors, weapons, armors, accessories, items, magick, skills, essences, statuses,
    actor(id) { return actors[id] || null; },
    weapon(id) { return weapons[id] || null; },
    armor(id) { return armors[id] || null; },
    accessory(id) { return accessories[id] || null; },
    item(id) { return items[id] || null; },
    magickName(id) { return magick[id]?.name || "Unknown"; },
    magick: (id) => magick[id] || null,
    skill: (id) => skills[id] || null,
    essence: (id) => essences[id] || null,
    statusByKey(key) { return statuses.find((status) => status?.key === key) || null; },
  };

  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    DatabaseManager,
    DebugManager: { log() {} },
  });

  vm.runInContext(
    `${read("js/objects/Game_Battler.js")}\n` +
      `${read("js/objects/Game_Actor.js")}\n` +
      `${read("js/objects/Game_Party.js")}\n` +
      `globalThis.__classes = { Game_Actor, Game_Party };`,
    context,
  );

  const party = new context.__classes.Game_Party([
    new context.__classes.Game_Actor(1),
    new context.__classes.Game_Actor(2),
    new context.__classes.Game_Actor(3),
    new context.__classes.Game_Actor(4),
  ]);

  return { context, party };
}

function testOnePhysicalCopyCannotBeSharedAcrossActors() {
  const { party } = createHarness();
  const [first, second] = party.members();

  party.gainWeapon(2, 1);

  assert.equal(party.equipActorMerchandise(first, "weapon", 2), true);
  assert.equal(first.weaponId, 2);
  assert.equal(party.availableEquipmentCount("weapon", 2, second), 0);
  assert.equal(party.equipActorMerchandise(second, "weapon", 2), false);
  assert.equal(second.weaponId, 0);

  party.gainWeapon(2, 1);
  assert.equal(party.availableEquipmentCount("weapon", 2, second), 1);
  assert.equal(party.equipActorMerchandise(second, "weapon", 2), true);
  assert.equal(second.weaponId, 2);
}

function testCurrentActorKeepsAccessToItsOwnEquippedCopy() {
  const { party } = createHarness();
  const actor = party.members()[0];

  party.gainArmor(1, 1);
  assert.equal(party.equipActorMerchandise(actor, "armor", 1), true);
  assert.equal(party.availableEquipmentCount("armor", 1, actor), 1);
  assert.equal(party.canActorEquipMerchandise(actor, "armor", 1), true);
}

function testLegacyOverEquippedStateIsReconciledToOwnedQuantity() {
  const { party } = createHarness();
  const members = party.members();

  party.gainAccessory(1, 1);
  for (const actor of members) {
    actor.equipAccessory(1);
  }
  assert.equal(party.equippedMerchandiseCount("accessory", 1), 4);

  party.reconcileEquipmentOwnership();

  assert.equal(party.equippedMerchandiseCount("accessory", 1), 1);
  assert.equal(members[0].accessoryId, 1);
  assert.equal(members.slice(1).every((actor) => actor.accessoryId === 0), true);
}

function testEquipMenuUsesPartyOwnershipAuthority() {
  const equipmentSource = read("js/windows/Window_Equipment.js");
  const selectSource = read("js/windows/Window_EquipSelect.js");
  const saveSource = read("js/core/SaveManager.js");

  assert.match(equipmentSource, /equipActorMerchandise/);
  assert.match(selectSource, /availableEquipmentCount/);
  assert.match(saveSource, /reconcileEquipmentOwnership/);
}

function run() {
  testOnePhysicalCopyCannotBeSharedAcrossActors();
  testCurrentActorKeepsAccessToItsOwnEquippedCopy();
  testLegacyOverEquippedStateIsReconciledToOwnedQuantity();
  testEquipMenuUsesPartyOwnershipAuthority();
  console.log("Equipment inventory ownership regression tests passed.");
}

run();
