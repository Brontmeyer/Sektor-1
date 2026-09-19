"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const readData = (filename) =>
  JSON.parse(fs.readFileSync(path.join(projectRoot, "data", filename), "utf8"));

const actors = readData("Actors.json");
const items = readData("Items.json");
const weapons = readData("Weapons.json");
const armors = readData("Armors.json");
const magick = readData("Magick.json");
const essences = readData("Essences.json");
const statuses = readData("Statuses.json");
const mapInfos = readData("MapInfos.json");

function createLocalStorage() {
  const values = new Map();

  return {
    throwOnSet: false,
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      if (this.throwOnSet) {
        throw new Error("storage unavailable");
      }

      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function makeDatabaseManager() {
  return {
    actors,
    items,
    weapons,
    armors,
    magick,
    essences,
    statuses,
    mapInfos,
    actor(id) {
      return actors[id] || null;
    },
    item(id) {
      return items[id] || null;
    },
    itemName(id) {
      return items[id]?.name || `Unknown Item ${id}`;
    },
    weapon(id) {
      return weapons[id] || null;
    },
    weaponName(id) {
      return weapons[id]?.name || `Unknown Weapon ${id}`;
    },
    armor(id) {
      return armors[id] || null;
    },
    armorName(id) {
      return armors[id]?.name || `Unknown Armor ${id}`;
    },
    magick(id) {
      return magick[id] || null;
    },
    magickName(id) {
      return magick[id]?.name || "Unknown Magick";
    },
    essence(id) {
      return essences[id] || null;
    },
    essenceName(id) {
      return essences[id]?.name || `Unknown Essence ${id}`;
    },
    statusByKey(key) {
      return statuses.find((status) => status?.key === key) || null;
    },
  };
}

function createHarness() {
  const localStorage = createLocalStorage();
  const DatabaseManager = makeDatabaseManager();
  const scene = {
    map: { id: 1, name: "Test Map" },
    player: { x: 128, y: 256, velocityX: 0, velocityY: 0 },
    camera: { follow() {} },
    async performTransfer({ targetMapId, targetX, targetY }) {
      this.map.id = targetMapId;
      this.map.name = `Map ${targetMapId}`;
      this.player.x = targetX;
      this.player.y = targetY;
    },
  };
  const SceneManager = {
    currentScene: scene,
    sceneStack: [],
  };
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    DatabaseManager,
    DebugManager: { log() {} },
    SceneManager,
    localStorage,
  });
  const source = [
    "js/objects/Game_Battler.js",
    "js/objects/Game_Essence.js",
    "js/objects/Game_Actor.js",
    "js/objects/Game_Party.js",
    "js/core/SaveManager.js",
  ]
    .map((relativePath) =>
      fs.readFileSync(path.join(projectRoot, relativePath), "utf8"),
    )
    .join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__classes = { Game_Actor, Game_Party, SaveManager };`,
    context,
  );

  const { Game_Actor, Game_Party, SaveManager } = context.__classes;
  const partyActors = [1, 2, 3, 4].map((actorId) => new Game_Actor(actorId));
  const party = new Game_Party(partyActors);

  context.$gameParty = party;
  context.$gameActor = party.leader();
  context.$gameSwitches = { data: {} };
  context.$gameVariables = { data: {} };
  context.$gameSelfSwitches = { data: {} };

  return {
    context,
    localStorage,
    scene,
    party,
    partyActors,
    SaveManager,
  };
}

function rawSave(localStorage, SaveManager, slotId = 1) {
  return JSON.parse(localStorage.getItem(SaveManager.saveKey(slotId)));
}

function testV5SaveSerializesPartyCurrencyEssencesAndPersistentStatuses() {
  const { localStorage, party, partyActors, SaveManager } = createHarness();
  const second = partyActors[1];

  second.exp = 321;
  second.level = 4;
  second.setHp(222);
  second.learnMagick(2);
  second.addStatus("fury");
  second.addStatus("barrier");
  assert.equal(second.equipEssence(1, 145), true);

  party.items = { 1: 2 };
  party.weapons = { 1: 1 };
  party.armors = { 1: 1 };
  assert.equal(party.gainGil(77), true);

  assert.equal(SaveManager.save(1), true);

  const saveData = rawSave(localStorage, SaveManager);
  const savedSecond = saveData.actors.find((actor) => actor.actorId === 2);

  assert.equal(saveData.version, 5);
  assert.equal(saveData.actors.length, 4);
  assert.equal(Object.hasOwn(saveData, "actor"), false);
  assert.equal(savedSecond.exp, 321);
  assert.equal(savedSecond.level, 4);
  assert.equal(savedSecond.hp, 222);
  assert.deepEqual(Array.from(savedSecond.magickIds), [1, 10, 2]);
  assert.equal(Object.hasOwn(savedSecond, "skills"), false);
  assert.deepEqual(
    Array.from(savedSecond.statuses, (status) => status.key),
    ["fury"],
  );
  assert.deepEqual(saveData.party.battleActorIds, [1, 2, 3, 4]);
  assert.equal(saveData.party.gil, 77);
  assert.deepEqual(Array.from(savedSecond.essenceProgress), [
    { essenceId: 1, resonance: 145 },
  ]);
  assert.deepEqual(Array.from(savedSecond.equippedEssenceIds), [1, null, null]);
}

async function testV5LoadRestoresActorStateCurrencyEssencesAndNormalizesInventory() {
  const { localStorage, party, partyActors, SaveManager } = createHarness();
  const second = partyActors[1];

  second.exp = 450;
  second.level = 5;
  second.maxHp = 900;
  second.setHp(300);
  second.addStatus("sadness");
  assert.equal(second.equipEssence(4, 299), true);
  party.items = { 1: 2 };
  assert.equal(party.gainGil(120), true);

  assert.equal(SaveManager.save(1), true);

  const saveData = rawSave(localStorage, SaveManager);
  saveData.party.items = { 1: "3", 2: "bad", 999: 4 };
  localStorage.setItem(SaveManager.saveKey(1), JSON.stringify(saveData));

  second.exp = 0;
  second.level = 1;
  second.maxHp = 100;
  second.setHp(100);
  second.statuses = [];
  second.restoreEssenceLoadout([], []);
  party.items = {};
  party.setGil(0);

  assert.equal(await SaveManager.load(1), true);
  assert.equal(second.exp, 450);
  assert.equal(second.level, 5);
  assert.equal(second.maxHp, 900);
  assert.equal(second.hp, 300);
  assert.equal(second.hasStatus("sadness"), true);
  assert.equal(second.hasStatus("barrier"), false);
  assert.equal(party.itemCount(1), 3);
  assert.equal(party.itemCount(2), 0);
  assert.equal(party.itemCount(999), 0);
  assert.equal(party.gil(), 120);
  assert.equal(second.equippedEssence(4).resonance, 299);
}

async function testVersionFourSaveMigratesLegacyEssenceLoadout() {
  const { localStorage, party, partyActors, SaveManager } = createHarness();
  const second = partyActors[1];

  const v4 = {
    version: 4,
    metadata: { actorName: party.leader().name, level: 1, timestamp: Date.now() },
    actors: partyActors.map((actor) => {
      const serialized = SaveManager.serializeActor(actor);
      const { essenceProgress: _progress, equippedEssenceIds: _equipped, ...legacy } = serialized;

      return {
        ...legacy,
        essences:
          actor.actorId === 2
            ? [
                { essenceId: 4, resonance: 345 },
                { essenceId: 5, resonance: 200 },
                { essenceId: 6, resonance: 100 },
                { essenceId: 7, resonance: 50 },
              ]
            : [],
      };
    }),
    party: {
      items: {},
      weapons: {},
      armors: {},
      battleActorIds: [1, 2, 3, 4],
      gil: 20,
    },
    switches: { data: {} },
    variables: { data: {} },
    selfSwitches: { data: {} },
    location: { mapId: 1, x: 6, y: 7 },
  };

  localStorage.setItem(SaveManager.saveKey(1), JSON.stringify(v4));

  assert.equal(await SaveManager.load(1), true);
  assert.equal(second.equippedEssence(4)?.resonance, 345);
  assert.deepEqual(Array.from(second.equippedEssenceIds()), [4, 5, 6]);
  assert.equal(second.essenceProgress(7)?.resonance, 50);
}

async function testVersionThreeSaveMigratesLegacySkillsToMagickIds() {
  const { localStorage, party, partyActors, SaveManager } = createHarness();
  const second = partyActors[1];

  const v3 = {
    version: 3,
    metadata: { actorName: party.leader().name, level: 1, timestamp: Date.now() },
    actors: partyActors.map((actor) => {
      const serialized = SaveManager.serializeActor(actor);
      const { magickIds, essenceProgress: _progress, equippedEssenceIds: _equipped, ...legacy } = serialized;
      return {
        ...legacy,
        skills: actor.actorId === 2 ? [2, 3] : magickIds,
        essences: [],
      };
    }),
    party: {
      items: {},
      weapons: {},
      armors: {},
      battleActorIds: [1, 2, 3, 4],
      gil: 44,
    },
    switches: { data: {} },
    variables: { data: {} },
    selfSwitches: { data: {} },
    location: { mapId: 1, x: 7, y: 8 },
  };

  localStorage.setItem(SaveManager.saveKey(1), JSON.stringify(v3));

  second.magickIds = [];
  party.setGil(0);

  assert.equal(await SaveManager.load(1), true);
  assert.deepEqual(Array.from(second.magickIds), [2, 3]);
  assert.equal(party.gil(), 44);
}

async function testVersionTwoSaveMigratesCurrencyAndEssenceDefaults() {
  const { localStorage, party, partyActors, SaveManager } = createHarness();
  const second = partyActors[1];
  second.exp = 999;

  const v2 = {
    version: 2,
    metadata: { actorName: party.leader().name, level: 1, timestamp: Date.now() },
    actors: partyActors.map((actor) => {
      const serialized = SaveManager.serializeActor(actor);
      const { magickIds, essenceProgress: _progress, equippedEssenceIds: _equipped, ...legacy } = serialized;
      return { ...legacy, skills: magickIds };
    }),
    party: { items: {}, weapons: {}, armors: {}, battleActorIds: [1, 2, 3, 4] },
    switches: { data: {} },
    variables: { data: {} },
    selfSwitches: { data: {} },
    location: { mapId: 1, x: 4, y: 5 },
  };

  localStorage.setItem(SaveManager.saveKey(1), JSON.stringify(v2));

  assert.equal(await SaveManager.load(1), true);
  assert.equal(party.gil(), 0);
  assert.equal(second.equippedEssences().length, 0);
}

async function testVersionOneSaveMigratesLeaderWithoutOverwritingOtherActors() {
  const { localStorage, partyActors, SaveManager } = createHarness();
  const leader = partyActors[0];
  const second = partyActors[1];
  const secondExpBefore = 777;

  second.exp = secondExpBefore;

  const legacySave = {
    version: 1,
    metadata: { actorName: leader.name, level: 3, timestamp: Date.now() },
    actor: {
      actorId: 1,
      name: leader.name,
      level: 3,
      exp: 222,
      hp: 123,
      maxHp: 500,
      mp: 40,
      maxMp: 100,
      strength: leader.strength,
      vitality: leader.vitality,
      dexterity: leader.dexterity,
      agility: leader.agility,
      magic: leader.magic,
      spirit: leader.spirit,
      luck: leader.luck,
      attack: leader.attack,
      attackPercent: leader.attackPercent,
      defense: leader.defense,
      defensePercent: leader.defensePercent,
      magicAttack: leader.magicAttack,
      magicDefense: leader.magicDefense,
      magicDefensePercent: leader.magicDefensePercent,
      weaponId: 0,
      armorId: 0,
      skills: [1],
    },
    party: {
      items: {},
      weapons: {},
      armors: {},
      battleActorIds: [1, 2, 3, 4],
    },
    switches: { data: {} },
    variables: { data: {} },
    selfSwitches: { data: {} },
    location: { mapId: 1, x: 12, y: 34 },
  };

  localStorage.setItem(SaveManager.saveKey(1), JSON.stringify(legacySave));

  assert.equal(await SaveManager.load(1), true);
  assert.equal(leader.level, 3);
  assert.equal(leader.exp, 222);
  assert.equal(leader.hp, 123);
  assert.deepEqual(Array.from(leader.magickIds), [1]);
  assert.equal(second.exp, secondExpBefore);
}

async function testMalformedAndFutureSavesFailWithoutThrowing() {
  const { localStorage, partyActors, SaveManager } = createHarness();
  const leader = partyActors[0];
  const originalHp = leader.hp;

  localStorage.setItem(
    SaveManager.saveKey(1),
    JSON.stringify({ version: 99, actors: [], party: {}, location: {} }),
  );

  assert.equal(await SaveManager.load(1), false);
  assert.match(SaveManager.errorMessage(), /unsupported|unrecognized/i);
  assert.equal(leader.hp, originalHp);

  localStorage.setItem(
    SaveManager.saveKey(1),
    JSON.stringify({ version: 2, actors: "broken", party: {}, location: {} }),
  );

  assert.equal(await SaveManager.load(1), false);
  assert.match(SaveManager.errorMessage(), /validation failed/i);
  assert.equal(leader.hp, originalHp);
}

function testSaveStorageFailureReturnsFalse() {
  const { localStorage, SaveManager } = createHarness();

  localStorage.throwOnSet = true;

  assert.equal(SaveManager.save(1), false);
  assert.match(SaveManager.errorMessage(), /could not save/i);
}

async function run() {
  testV5SaveSerializesPartyCurrencyEssencesAndPersistentStatuses();
  await testV5LoadRestoresActorStateCurrencyEssencesAndNormalizesInventory();
  await testVersionFourSaveMigratesLegacyEssenceLoadout();
  await testVersionThreeSaveMigratesLegacySkillsToMagickIds();
  await testVersionTwoSaveMigratesCurrencyAndEssenceDefaults();
  await testVersionOneSaveMigratesLeaderWithoutOverwritingOtherActors();
  await testMalformedAndFutureSavesFailWithoutThrowing();
  testSaveStorageFailureReturnsFalse();

  console.log("Save runtime regression tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
