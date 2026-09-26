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
const accessories = readData("Accessories.json");
const magick = readData("Magick.json");
const skills = readData("Skills.json");
const testSkills = [
  ...skills,
  {
    id: 1,
    name: "Test Technique",
    description: "Save-runtime test Skill.",
    type: "skill",
    category: "physical",
    effect: "damage",
    powerMultiplier: 1.5,
    target: ["enemy"],
    scope: ["single"],
  },
];
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
    accessories,
    magick,
    skills: testSkills,
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
    accessory(id) {
      return accessories[id] || null;
    },
    accessoryName(id) {
      return accessories[id]?.name || `Unknown Accessory ${id}`;
    },
    magick(id) {
      return magick[id] || null;
    },
    magickName(id) {
      return magick[id]?.name || "Unknown Magick";
    },
    skill(id) {
      return testSkills[id] || null;
    },
    skillName(id) {
      return testSkills[id]?.name || `Unknown Skill ${id}`;
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
  const gameSystem = {
    seconds: 0,
    areaDiscoveries: {},
    playTimeSeconds() { return Math.max(0, Math.floor(this.seconds)); },
    setPlayTimeSeconds(value) {
      this.seconds = Math.max(0, Number(value) || 0);
      return true;
    },
    areaDiscoveryState() {
      return JSON.parse(JSON.stringify(this.areaDiscoveries));
    },
    restoreAreaDiscoveryState(state) {
      this.areaDiscoveries = JSON.parse(JSON.stringify(state || {}));
      return true;
    },
  };
  context.$gameSystem = gameSystem;

  return {
    context,
    localStorage,
    scene,
    party,
    partyActors,
    SaveManager,
    gameSystem,
  };
}

function rawSave(localStorage, SaveManager, slotId = 1) {
  return JSON.parse(localStorage.getItem(SaveManager.saveKey(slotId)));
}

function testV12SaveSerializesSkillStateValorEquipmentCurrencyEssencesStatusesRowsFormationAndDiscovery() {
  const { localStorage, party, partyActors, SaveManager, gameSystem } = createHarness();
  const second = partyActors[1];

  second.exp = 321;
  second.level = 4;
  assert.equal(second.rename("Mira"), true);
  second.setHp(222);
  second.learnMagick(2);
  assert.equal(second.learnSkill(1), true);
  second.addStatus("fury");
  second.addStatus("barrier");
  second.setValor(67.5);
  assert.equal(second.equipEssence(1, 145), true);
  assert.equal(second.equipAccessory(3), true);

  party.items = { 1: 2 };
  party.weapons = { 1: 1 };
  party.armors = { 1: 1 };
  party.accessories = { 1: 2, 3: 1 };
  assert.equal(party.gainGil(77), true);
  assert.equal(party.setBattleRow(second, "back"), true);
  assert.equal(party.swapBattleFormationSlots(0, 2), true);
  gameSystem.seconds = 5025.9;
  gameSystem.areaDiscoveries = { 1: ["test-plaza", "merchant-row"] };

  assert.equal(SaveManager.save(1), true);

  const saveData = rawSave(localStorage, SaveManager);
  const savedSecond = saveData.actors.find((actor) => actor.actorId === 2);

  assert.equal(saveData.version, 12);
  assert.equal(saveData.metadata.playTimeSeconds, 5025);
  assert.deepEqual(saveData.world.areaDiscoveries, {
    1: ["test-plaza", "merchant-row"],
  });
  assert.equal(saveData.actors.length, 4);
  assert.equal(Object.hasOwn(saveData, "actor"), false);
  assert.equal(savedSecond.exp, 321);
  assert.equal(savedSecond.name, "Mira");
  assert.equal(savedSecond.level, 4);
  assert.equal(savedSecond.hp, 222);
  assert.equal(savedSecond.valor, 67.5);
  assert.deepEqual(Array.from(savedSecond.magickIds), [1, 10, 2]);
  assert.deepEqual(Array.from(savedSecond.skillIds), [2, 1]);
  assert.equal(Object.hasOwn(savedSecond, "skills"), false);
  assert.deepEqual(
    Array.from(savedSecond.statuses, (status) => status.key),
    ["fury"],
  );
  assert.deepEqual(saveData.party.battleActorIds, [1, 2, 3, 4]);
  assert.deepEqual(saveData.party.battleFormationActorIds, [3, 2, 1, 4]);
  assert.deepEqual(saveData.party.battleRows, {
    1: "front",
    2: "back",
    3: "front",
    4: "front",
  });
  assert.equal(saveData.party.gil, 77);
  assert.equal(savedSecond.accessoryId, 3);
  assert.deepEqual(saveData.party.accessories, { 1: 2, 3: 1 });
  assert.deepEqual(Array.from(savedSecond.essenceProgress), [
    { essenceId: 1, resonance: 145 },
  ]);
  assert.deepEqual(Array.from(savedSecond.equippedEssenceIds), [1, null, null]);
}

async function testV12LoadRestoresSkillStateValorAccessoryRowsFormationDiscoveryAndNormalizesInventory() {
  const { localStorage, party, partyActors, SaveManager, gameSystem } = createHarness();
  const second = partyActors[1];

  second.exp = 450;
  second.level = 5;
  assert.equal(second.rename("Rhea"), true);
  second.maxHp = 900;
  second.setHp(300);
  second.addStatus("sadness");
  second.setValor(88);
  assert.equal(second.learnSkill(1), true);
  assert.equal(second.equipEssence(4, 299), true);
  assert.equal(second.equipAccessory(1), true);
  party.items = { 1: 2 };
  party.accessories = { 1: 1, 2: 2 };
  assert.equal(party.gainGil(120), true);
  assert.equal(party.setBattleRow(second, "back"), true);
  assert.equal(party.swapBattleFormationSlots(0, 3), true);
  gameSystem.seconds = 3723;
  gameSystem.areaDiscoveries = { 1: ["test-plaza"] };

  assert.equal(SaveManager.save(1), true);

  const saveData = rawSave(localStorage, SaveManager);
  saveData.party.items = { 1: "198", 2: "bad", 999: 4 };
  saveData.party.accessories = { 1: "1", 2: "2", 999: 4 };
  localStorage.setItem(SaveManager.saveKey(1), JSON.stringify(saveData));

  second.exp = 0;
  second.level = 1;
  assert.equal(second.rename("Sarah"), true);
  second.maxHp = 100;
  second.setHp(100);
  second.statuses = [];
  second.setValor(0);
  second.skillIds = [];
  second.restoreEssenceLoadout([], []);
  second.accessoryId = 0;
  party.items = {};
  party.accessories = {};
  party.setGil(0);
  party.setBattleRow(second, "front");
  assert.equal(party.swapBattleFormationSlots(0, 1), true);
  gameSystem.seconds = 9;
  gameSystem.areaDiscoveries = {};

  assert.equal(await SaveManager.load(1), true);
  assert.deepEqual(Array.from(second.skillIds), [2, 1]);
  assert.equal(second.exp, 450);
  assert.equal(second.name, "Rhea");
  assert.equal(second.level, 5);
  assert.equal(second.maxHp, 900);
  assert.equal(second.hp, 300);
  assert.equal(second.valor, 88);
  assert.equal(second.hasStatus("sadness"), true);
  assert.equal(second.hasStatus("barrier"), false);
  assert.equal(party.itemCount(1), 99);
  assert.equal(party.itemCount(2), 0);
  assert.equal(party.itemCount(999), 0);
  assert.equal(party.gil(), 120);
  assert.equal(party.battleRow(second), "back");
  assert.deepEqual(Array.from(party.battleFormationActorIds()), [4, 2, 3, 1]);
  assert.deepEqual(Array.from(party.battleActorIds()), [1, 2, 3, 4]);
  assert.equal(second.accessoryId, 1);
  assert.equal(party.accessoryCount(1), 1);
  assert.equal(party.accessoryCount(2), 2);
  assert.equal(party.accessoryCount(999), 0);
  assert.equal(second.equippedEssence(4).resonance, 299);
  assert.equal(gameSystem.playTimeSeconds(), 3723);
  assert.deepEqual(gameSystem.areaDiscoveries, { 1: ["test-plaza"] });
}


async function testVersionElevenSaveMigratesEmptyAreaDiscoveryState() {
  const { localStorage, partyActors, SaveManager, gameSystem } = createHarness();
  const legacySave = {
    version: 11,
    metadata: { actorName: partyActors[0].name, level: 1, timestamp: Date.now() },
    actors: partyActors.map((actor) => SaveManager.serializeActor(actor)),
    party: {
      items: {},
      weapons: {},
      armors: {},
      accessories: {},
      actorIds: [1, 2, 3, 4],
      metActorIds: [1, 2, 3, 4],
      battleActorIds: [1, 2, 3, 4],
      battleFormationActorIds: [1, 2, 3, 4],
      battleRows: {},
      gil: 0,
    },
    switches: { data: {} },
    variables: { data: {} },
    selfSwitches: { data: {} },
    location: { mapId: 1, x: 7, y: 8 },
  };

  gameSystem.areaDiscoveries = { 2: ["stale"] };
  localStorage.setItem(SaveManager.saveKey(1), JSON.stringify(legacySave));

  assert.equal(await SaveManager.load(1), true);
  assert.deepEqual(gameSystem.areaDiscoveries, {});
}

async function testVersionTenSaveMigratesFormationWithoutReinjectingForgottenSkills() {
  const { localStorage, party, partyActors, SaveManager } = createHarness();
  const second = partyActors[1];

  assert.equal(second.forgetSkill(2), true);
  assert.deepEqual(Array.from(second.skillIds), []);

  const v10 = {
    version: 10,
    metadata: { actorName: partyActors[0].name, level: 1, timestamp: Date.now() },
    actors: partyActors.map((actor) => SaveManager.serializeActor(actor)),
    party: {
      items: {},
      weapons: {},
      armors: {},
      accessories: {},
      battleActorIds: [1, 2, 3, 4],
      battleRows: { 1: "front", 2: "back", 3: "front", 4: "front" },
      gil: 0,
    },
    switches: { data: {} },
    variables: { data: {} },
    selfSwitches: { data: {} },
    location: { mapId: 1, x: 7, y: 8 },
  };

  localStorage.setItem(SaveManager.saveKey(1), JSON.stringify(v10));
  second.skillIds = [2];

  assert.equal(await SaveManager.load(1), true);
  assert.deepEqual(Array.from(second.skillIds), []);
  assert.deepEqual(Array.from(party.battleFormationActorIds()), [1, 2, 3, 4]);
  assert.equal(party.battleRow(second), "back");
}

async function testVersionNineSaveMigratesRowsWithoutReinjectingForgottenSkills() {
  const { localStorage, party, partyActors, SaveManager } = createHarness();
  const second = partyActors[1];

  assert.equal(second.forgetSkill(2), true);
  assert.deepEqual(Array.from(second.skillIds), []);

  const v9 = {
    version: 9,
    metadata: { actorName: partyActors[0].name, level: 1, timestamp: Date.now() },
    actors: partyActors.map((actor) => SaveManager.serializeActor(actor)),
    party: {
      items: {},
      weapons: {},
      armors: {},
      accessories: {},
      battleActorIds: [1, 2, 3, 4],
      gil: 0,
    },
    switches: { data: {} },
    variables: { data: {} },
    selfSwitches: { data: {} },
    location: { mapId: 1, x: 7, y: 8 },
  };

  localStorage.setItem(SaveManager.saveKey(1), JSON.stringify(v9));
  second.skillIds = [2];
  party.setBattleRow(second, "back");

  assert.equal(await SaveManager.load(1), true);
  assert.deepEqual(Array.from(second.skillIds), []);
  assert.deepEqual(JSON.parse(JSON.stringify(party.battleRows())), {
    1: "front",
    2: "front",
    3: "front",
    4: "front",
  });
}

async function testVersionEightSaveMigratesCanonicalStarterSkills() {
  const { localStorage, partyActors, SaveManager } = createHarness();

  const v8 = {
    version: 8,
    metadata: { actorName: partyActors[0].name, level: 1, timestamp: Date.now() },
    actors: partyActors.map((actor) => ({
      ...SaveManager.serializeActor(actor),
      skillIds: [],
    })),
    party: {
      items: {},
      weapons: {},
      armors: {},
      accessories: {},
      battleActorIds: [1, 2, 3, 4],
      gil: 0,
    },
    switches: { data: {} },
    variables: { data: {} },
    selfSwitches: { data: {} },
    location: { mapId: 1, x: 7, y: 8 },
  };

  for (const actor of partyActors) {
    actor.skillIds = [];
  }
  localStorage.setItem(SaveManager.saveKey(1), JSON.stringify(v8));

  assert.equal(await SaveManager.load(1), true);
  assert.deepEqual(
    partyActors.map((actor) => Array.from(actor.skillIds)),
    [[1, 6], [2], [3], [4]],
  );
}

async function testVersionSevenSaveMigratesSkillDefaults() {
  const { localStorage, partyActors, SaveManager } = createHarness();
  const second = partyActors[1];

  const v7 = {
    version: 7,
    metadata: { actorName: partyActors[0].name, level: 1, timestamp: Date.now() },
    actors: partyActors.map((actor) => {
      const serialized = SaveManager.serializeActor(actor);
      const { skillIds: _skillIds, ...legacy } = serialized;
      return legacy;
    }),
    party: {
      items: {},
      weapons: {},
      armors: {},
      accessories: {},
      battleActorIds: [1, 2, 3, 4],
      gil: 0,
    },
    switches: { data: {} },
    variables: { data: {} },
    selfSwitches: { data: {} },
    location: { mapId: 1, x: 7, y: 8 },
  };

  second.skillIds = [99];
  localStorage.setItem(SaveManager.saveKey(1), JSON.stringify(v7));

  assert.equal(await SaveManager.load(1), true);
  assert.deepEqual(Array.from(second.skillIds), [2]);
}

async function testVersionSixSaveMigratesValorDefault() {
  const { localStorage, party, partyActors, SaveManager } = createHarness();
  const second = partyActors[1];

  const v6 = {
    version: 6,
    metadata: { actorName: party.leader().name, level: 1, timestamp: Date.now() },
    actors: partyActors.map((actor) => {
      const serialized = SaveManager.serializeActor(actor);
      const { valor: _valor, skillIds: _skillIds, ...legacy } = serialized;
      return legacy;
    }),
    party: {
      items: {},
      weapons: {},
      armors: {},
      accessories: {},
      battleActorIds: [1, 2, 3, 4],
      gil: 25,
    },
    switches: { data: {} },
    variables: { data: {} },
    selfSwitches: { data: {} },
    location: { mapId: 1, x: 7, y: 8 },
  };

  second.setValor(90);
  localStorage.setItem(SaveManager.saveKey(1), JSON.stringify(v6));

  assert.equal(await SaveManager.load(1), true);
  assert.equal(second.valor, 0);
  assert.equal(party.gil(), 25);
}

async function testVersionFiveSaveMigratesAccessoryDefaults() {
  const { localStorage, party, partyActors, SaveManager } = createHarness();
  const second = partyActors[1];

  const v5 = {
    version: 5,
    metadata: { actorName: party.leader().name, level: 1, timestamp: Date.now() },
    actors: partyActors.map((actor) => {
      const serialized = SaveManager.serializeActor(actor);
      const {
        accessoryId: _accessoryId,
        skillIds: _skillIds,
        ...legacy
      } = serialized;
      return legacy;
    }),
    party: {
      items: {},
      weapons: {},
      armors: {},
      battleActorIds: [1, 2, 3, 4],
      gil: 15,
    },
    switches: { data: {} },
    variables: { data: {} },
    selfSwitches: { data: {} },
    location: { mapId: 1, x: 5, y: 6 },
  };

  second.accessoryId = 3;
  localStorage.setItem(SaveManager.saveKey(1), JSON.stringify(v5));

  assert.equal(await SaveManager.load(1), true);
  assert.equal(second.accessoryId, 0);
  assert.deepEqual(Object.keys(party.accessories), []);
  assert.equal(party.gil(), 15);
}

async function testVersionFourSaveMigratesLegacyEssenceLoadout() {
  const { localStorage, party, partyActors, SaveManager } = createHarness();
  const second = partyActors[1];

  const v4 = {
    version: 4,
    metadata: { actorName: party.leader().name, level: 1, timestamp: Date.now() },
    actors: partyActors.map((actor) => {
      const serialized = SaveManager.serializeActor(actor);
      const {
        essenceProgress: _progress,
        equippedEssenceIds: _equipped,
        skillIds: _skillIds,
        ...legacy
      } = serialized;

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
      const {
        magickIds,
        essenceProgress: _progress,
        equippedEssenceIds: _equipped,
        skillIds: _skillIds,
        ...legacy
      } = serialized;
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
      const {
        magickIds,
        essenceProgress: _progress,
        equippedEssenceIds: _equipped,
        skillIds: _skillIds,
        ...legacy
      } = serialized;
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

async function testInvalidBattleRowsAreRejected() {
  const { localStorage, partyActors, SaveManager } = createHarness();
  const saveData = {
    version: 10,
    metadata: { actorName: partyActors[0].name, level: 1, timestamp: Date.now() },
    actors: partyActors.map((actor) => SaveManager.serializeActor(actor)),
    party: {
      items: {},
      weapons: {},
      armors: {},
      accessories: {},
      battleActorIds: [1, 2, 3, 4],
      battleRows: { 1: "front", 2: "sideways" },
      gil: 0,
    },
    switches: { data: {} },
    variables: { data: {} },
    selfSwitches: { data: {} },
    location: { mapId: 1, x: 7, y: 8 },
  };

  localStorage.setItem(SaveManager.saveKey(1), JSON.stringify(saveData));
  assert.equal(await SaveManager.load(1), false);
  assert.match(SaveManager.errorMessage(), /battleRows actor 2 must be front or back/i);
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
  testV12SaveSerializesSkillStateValorEquipmentCurrencyEssencesStatusesRowsFormationAndDiscovery();
  await testV12LoadRestoresSkillStateValorAccessoryRowsFormationDiscoveryAndNormalizesInventory();
  await testVersionElevenSaveMigratesEmptyAreaDiscoveryState();
  await testVersionTenSaveMigratesFormationWithoutReinjectingForgottenSkills();
  await testVersionNineSaveMigratesRowsWithoutReinjectingForgottenSkills();
  await testVersionEightSaveMigratesCanonicalStarterSkills();
  await testVersionSevenSaveMigratesSkillDefaults();
  await testVersionSixSaveMigratesValorDefault();
  await testVersionFiveSaveMigratesAccessoryDefaults();
  await testVersionFourSaveMigratesLegacyEssenceLoadout();
  await testVersionThreeSaveMigratesLegacySkillsToMagickIds();
  await testVersionTwoSaveMigratesCurrencyAndEssenceDefaults();
  await testVersionOneSaveMigratesLeaderWithoutOverwritingOtherActors();
  await testInvalidBattleRowsAreRejected();
  await testMalformedAndFutureSavesFailWithoutThrowing();
  testSaveStorageFailureReturnsFalse();

  console.log("Save runtime regression tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
