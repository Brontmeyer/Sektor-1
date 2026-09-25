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

const actors = readData("Actors.json");
const systemData = readData("System.json");
const items = readData("Items.json");
const weapons = readData("Weapons.json");
const armors = readData("Armors.json");
const accessories = readData("Accessories.json");
const magick = readData("Magick.json");
const statuses = readData("Statuses.json");
const skills = readData("Skills.json");
const essences = readData("Essences.json");

function createLocalStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
}

function createHarness() {
  const localStorage = createLocalStorage();
  const databaseManager = {
    system: systemData,
    actors,
    items,
    weapons,
    armors,
    accessories,
    magick,
    statuses,
    skills,
    essences,
    mapInfos: [{ id: 1, name: "Test Map", file: "Map001.json" }],
    actor(id) { return actors[id] || null; },
    item(id) { return items[id] || null; },
    weapon(id) { return weapons[id] || null; },
    armor(id) { return armors[id] || null; },
    accessory(id) { return accessories[id] || null; },
    magick(id) { return magick[id] || null; },
    skill(id) { return skills[id] || null; },
    essence(id) { return essences[id] || null; },
    statusByKey(key) { return statuses.find((status) => status?.key === key) || null; },
  };
  const scene = {
    map: { id: 1, name: "Test Map" },
    player: { x: 4, y: 5, velocityX: 0, velocityY: 0 },
    camera: { follow() {} },
    async performTransfer({ targetMapId, targetX, targetY }) {
      this.map.id = targetMapId;
      this.player.x = targetX;
      this.player.y = targetY;
    },
  };
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    DatabaseManager: databaseManager,
    DebugManager: { log() {} },
    localStorage,
    SceneManager: { currentScene: scene, sceneStack: [] },
  });
  const source = [
    "js/objects/Game_Battler.js",
    "js/objects/Game_Essence.js",
    "js/objects/Game_Actor.js",
    "js/objects/Game_Party.js",
    "js/objects/Game_SelfSwitches.js",
    "js/objects/Game_Switches.js",
    "js/objects/Game_Variables.js",
    "js/objects/Game_System.js",
    "js/objects/Game_Interpreter.js",
    "js/core/SaveManager.js",
    "js/core/DatabaseValidator.js",
  ].map(read).join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__classes = { Game_System, Game_Interpreter, SaveManager, DatabaseValidator };`,
    context,
  );

  const system = new context.__classes.Game_System();
  context.$gameSystem = system;
  context.$gameParty = system.party;
  context.$gameSwitches = system.switches;
  context.$gameVariables = system.variables;
  context.$gameSelfSwitches = system.selfSwitches;

  return {
    context,
    system,
    party: system.party,
    localStorage,
    scene,
    ...context.__classes,
  };
}

function testNewGameStartsWithConfiguredHeroOnly() {
  const { system, party } = createHarness();

  assert.deepEqual(system.startingActorIds(), [1]);
  assert.deepEqual(Array.from(system.actors, (actor) => actor.actorId), [1, 2, 3, 4]);
  assert.deepEqual(Array.from(party.members(), (actor) => actor.actorId), [1]);
  assert.deepEqual(Array.from(party.battleActorIds()), [1]);
  assert.equal(party.hasMetActor(1), true);
  assert.equal(party.hasMetActor(2), false);
  assert.equal(party.isActorRecruited(2), false);
}

function testRecruitmentAddsExistingRuntimeActorToRosterAndBattleParty() {
  const { system, party } = createHarness();
  const sarah = system.actor(2);

  assert.equal(party.addActorToParty(2), true);
  assert.equal(party.addActorToParty(2), false);
  assert.equal(party.actorById(2), sarah);
  assert.deepEqual(Array.from(party.members(), (actor) => actor.actorId), [1, 2]);
  assert.deepEqual(Array.from(party.battleActorIds()), [1, 2]);
  assert.equal(party.hasMetActor(2), true);
  assert.equal(party.isActorRecruited(2), true);

  assert.equal(party.removeActorFromParty(2), true);
  assert.equal(party.hasMetActor(2), true);
  assert.equal(party.isActorRecruited(2), false);
  assert.deepEqual(Array.from(party.battleActorIds()), [1]);
}

function testInterpreterRecruitActorCommandUsesSharedPartyAuthority() {
  const { party, Game_Interpreter } = createHarness();
  const shown = [];
  const messageWindow = {
    open: false,
    isOpen() { return this.open; },
    show(text, speaker) { this.open = true; shown.push({ text, speaker }); },
  };
  const choiceWindow = { isOpen() { return false; }, hasResult() { return false; } };
  const interpreter = new Game_Interpreter(messageWindow, choiceWindow);

  assert.equal(interpreter.commandRecruitActor({ actorId: 2, message: "{actor:2} joined." }), false);
  assert.equal(party.isActorRecruited(2), true);
  assert.deepEqual(shown, [{ text: `${actors[2].name} joined.`, speaker: "System" }]);
}

async function testSaveLoadRestoresRecruitmentAgainstFreshHeroOnlyParty() {
  const first = createHarness();
  const { SaveManager } = first;

  first.system.actor(2).rename("Mira");
  assert.equal(first.party.addActorToParty(2), true);
  assert.equal(SaveManager.save(1), true);
  const savedJson = first.localStorage.getItem(SaveManager.saveKey(1));
  const saveData = JSON.parse(savedJson);

  assert.deepEqual(saveData.party.actorIds, [1, 2]);
  assert.equal(saveData.actors.find((actor) => actor.actorId === 2).name, "Mira");

  const second = createHarness();
  second.localStorage.setItem(SaveManager.saveKey(1), savedJson);
  assert.deepEqual(Array.from(second.party.members(), (actor) => actor.actorId), [1]);

  assert.equal(await second.SaveManager.load(1), true);
  assert.deepEqual(Array.from(second.party.members(), (actor) => actor.actorId), [1, 2]);
  assert.deepEqual(Array.from(second.party.battleActorIds()), [1, 2]);
  assert.equal(second.system.actor(2).name, "Mira");
}

function testRecruitmentCommandValidationAndMapFixture() {
  const { DatabaseValidator } = createHarness();
  const map = readData("Map001.json");
  const errors = [];
  const event = map.events.find((entry) => entry.id === 15);

  assert.ok(event, "Map001 should contain the Sarah recruitment fixture.");
  assert.equal(event.pages[0].commands.some((command) => command.code === "recruitActor"), true);

  DatabaseValidator.validateMapData(map, {
    system: systemData,
    actors,
    items,
    weapons,
    armors,
    accessories,
    magickData: magick,
    skills,
    essences,
    statuses,
  }, 1);

  DatabaseValidator.validateEventCommand(
    { code: "recruitActor", actorId: 999 },
    "Test recruitActor",
    { actors },
    errors,
    0,
  );
  assert.equal(errors.some((error) => error.includes("unknown actor")), true);
}

async function run() {
  testNewGameStartsWithConfiguredHeroOnly();
  testRecruitmentAddsExistingRuntimeActorToRosterAndBattleParty();
  testInterpreterRecruitActorCommandUsesSharedPartyAuthority();
  await testSaveLoadRestoresRecruitmentAgainstFreshHeroOnlyParty();
  testRecruitmentCommandValidationAndMapFixture();
  console.log("Recruitment runtime regression tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
