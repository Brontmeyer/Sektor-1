"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const readData = (filename) =>
  JSON.parse(fs.readFileSync(path.join(projectRoot, "data", filename), "utf8"));

function createHarness() {
  const actors = readData("Actors.json");
  const weapons = readData("Weapons.json");
  const armors = readData("Armors.json");
  const accessories = readData("Accessories.json");
  const magick = readData("Magick.json");
  const essences = readData("Essences.json");
  const statuses = readData("Statuses.json");

  const DatabaseManager = {
    actors,
    weapons,
    armors,
    accessories,
    magickData: magick,
    essences,
    statuses,
    actor(id) {
      return actors[id] || null;
    },
    weapon(id) {
      return weapons[id] || null;
    },
    armor(id) {
      return armors[id] || null;
    },
    accessory(id) {
      return accessories[id] || null;
    },
    magick(id) {
      return magick[id] || null;
    },
    magickName(id) {
      return magick[id]?.name || `Unknown Magick ${id}`;
    },
    essence(id) {
      return essences[id] || null;
    },
    statusByKey(key) {
      return statuses.find((status) => status?.key === key) || null;
    },
  };

  const drawCalls = [];
  const graphicsContext = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
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
      drawCalls.push(args);
    },
  };

  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    DatabaseManager,
    DebugManager: { log() {} },
    Graphics: { width: 1280, height: 720, context: graphicsContext },
    Input: { isTriggered() { return false; }, isActionTriggered() { return false; }, actionLabel(action) { return action; } },
  });

  const source = [
    "js/objects/Game_Battler.js",
    "js/objects/Game_Essence.js",
    "js/objects/Game_Actor.js",
    "js/objects/Game_Party.js",
    "js/objects/Game_Interpreter.js",
    "js/windows/Window_ListViewport.js",
    "js/windows/Window_ActorNavigator.js",
    "js/windows/Window_EquipSelect.js",
    "js/windows/Window_Equipment.js",
  ]
    .map((relativePath) =>
      fs.readFileSync(path.join(projectRoot, relativePath), "utf8"),
    )
    .join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__classes = { Game_Actor, Game_Party, Game_Interpreter, Window_EquipSelect, Window_Equipment };`,
    context,
  );

  const {
    Game_Actor,
    Game_Party,
    Game_Interpreter,
    Window_EquipSelect,
    Window_Equipment,
  } = context.__classes;
  const actor = new Game_Actor(1);
  const party = new Game_Party([actor]);
  context.$gameParty = party;

  return {
    actor,
    party,
    accessories,
    drawCalls,
    Game_Interpreter,
    Window_EquipSelect,
    Window_Equipment,
    context,
  };
}

function testAccessoryInventoryAndActorOwnership() {
  const { actor, party } = createHarness();

  assert.equal(party.gainAccessory(1, 2), true);
  assert.equal(party.accessoryCount(1), 2);
  assert.equal(party.hasAccessory(1), true);
  assert.equal(party.loseAccessory(1, 1), true);
  assert.equal(party.accessoryCount(1), 1);

  const baseAttack = actor.totalAttack();
  assert.equal(actor.equipAccessory(1), true);
  assert.equal(actor.accessoryId, 1);
  assert.equal(actor.accessory().name, "Power Wrist");
  assert.equal(actor.totalAttack(), baseAttack + 3);

  assert.equal(actor.equipAccessory(999), false);
  assert.equal(actor.accessoryId, 1);
  assert.equal(actor.unequipAccessory(), true);
  assert.equal(actor.accessoryId, 0);
  assert.equal(actor.unequipAccessory(), false);
}

function testAccessoryBonusesFlowThroughDerivedCombatStats() {
  const { actor } = createHarness();
  const baseDefense = actor.totalDefense();
  const baseMagicAttack = actor.totalMagicAttack();
  const baseMagicDefense = actor.totalMagicDefense();

  assert.equal(actor.equipAccessory(2), true);
  assert.equal(actor.totalDefense(), baseDefense + 3);

  assert.equal(actor.equipAccessory(3), true);
  assert.equal(actor.totalMagicAttack(), baseMagicAttack + 3);
  assert.equal(actor.totalMagicDefense(), baseMagicDefense + 3);
  assert.equal(actor.totalDefense(), baseDefense);
}

function testAccessoryEventCommandsUsePartyInventoryApi() {
  const { context, party, Game_Interpreter } = createHarness();
  const messageWindow = {
    opened: false,
    lastMessage: "",
    lastSpeaker: "",
    isOpen() {
      return this.opened;
    },
    show(message, speaker) {
      this.opened = true;
      this.lastMessage = message;
      this.lastSpeaker = speaker;
    },
  };
  const choiceWindow = {
    isOpen() { return false; },
    hasResult() { return false; },
  };
  const interpreter = new Game_Interpreter(messageWindow, choiceWindow);

  context.$gameParty = party;

  assert.equal(
    interpreter.commandGainAccessory({ accessoryId: 1, amount: 2 }),
    true,
  );
  assert.equal(party.accessoryCount(1), 2);

  assert.equal(
    interpreter.commandGainAccessoryMessage({
      accessoryId: 2,
      amount: 1,
      source: "Chest",
    }),
    false,
  );
  assert.equal(party.accessoryCount(2), 1);
  assert.equal(messageWindow.lastMessage, "You found a Guard Ring!");
  assert.equal(messageWindow.lastSpeaker, "Chest");
}

function testAccessorySelectorUsesSharedEquipmentPath() {
  const { actor, party, Window_EquipSelect } = createHarness();

  party.gainAccessory(1, 1);
  party.gainAccessory(2, 1);
  actor.equipAccessory(2);

  const selector = new Window_EquipSelect(actor);
  selector.show("accessory");

  assert.deepEqual(
    Array.from(selector.entries(), (entry) => entry.name),
    ["None", "Power Wrist", "Guard Ring"],
  );
  assert.equal(selector.currentEntry().id, 2);

  selector.index = 1;
  const attackPreview = selector
    .previewStats()
    .find((stat) => stat.name === "Attack");

  assert.ok(attackPreview);
  assert.equal(attackPreview.preview, attackPreview.current + 3);
}

function testEquipmentWindowAddsOneAccessorySlotAndDrawsSafely() {
  const { actor, party, drawCalls, Window_Equipment } = createHarness();

  party.gainAccessory(1, 1);
  const window = new Window_Equipment(actor);

  assert.deepEqual(
    Array.from(window.slots, (slot) => slot.type),
    ["weapon", "armor", "accessory"],
  );
  assert.equal(window.applySelection("accessory", 1), true);
  assert.equal(actor.accessoryId, 1);

  window.show();
  window.draw();

  assert.equal(
    drawCalls.some((call) => String(call[0]).includes("Accessory")),
    true,
  );
  assert.equal(
    drawCalls.some((call) => String(call[0]).includes("Power Wrist")),
    true,
  );
}

function run() {
  testAccessoryInventoryAndActorOwnership();
  testAccessoryBonusesFlowThroughDerivedCombatStats();
  testAccessoryEventCommandsUsePartyInventoryApi();
  testAccessorySelectorUsesSharedEquipmentPath();
  testEquipmentWindowAddsOneAccessorySlotAndDrawsSafely();

  console.log("Accessory equipment regression tests passed.");
}

run();
