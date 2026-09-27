"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(projectRoot, file), "utf8");

function makeHarness(debugMode = true) {
  const essences = [
    null,
    {
      id: 1,
      name: "Test Essence",
      levels: [
        { level: 1, resonanceRequired: 0 },
        { level: 2, resonanceRequired: 100 },
        { level: 3, resonanceRequired: 300 },
        { level: 4, resonanceRequired: 700 },
      ],
      mastery: { resonanceRequired: 1500 },
      passive: { unlockLevel: 4, type: "elementDamageBoost", element: "fire", value: 0.1 },
    },
  ];
  const statuses = [
    null,
    { id: 1, key: "poison", name: "Poison", classification: { family: "ailment" } },
    { id: 2, key: "sleep", name: "Sleep", classification: { family: "mental" } },
  ];
  const encounters = [null, { id: 1, name: "Test Encounter", members: [{ enemyId: 1 }], canEscape: true }];
  const items = [null, { id: 1, name: "Potion" }];

  class FakeEssence {
    constructor(data) { this._data = data; this.resonance = 0; }
    data() { return this._data; }
    setResonance(value) { this.resonance = value; return true; }
    level() {
      return this._data.levels.reduce(
        (level, entry) => this.resonance >= entry.resonanceRequired ? entry.level : level,
        1,
      );
    }
    activePassive() { return this.level() >= 4 ? this._data.passive : null; }
  }

  const actor = {
    actorId: 1,
    maxHp: 500,
    hp: 500,
    maxMp: 100,
    mp: 100,
    maxValor: 100,
    valor: 0,
    statuses: [],
    _slots: [null, null, null],
    essenceSlotCount() { return 3; },
    equippedEssenceSlot(id) { return this._slots.findIndex((entry) => entry?.data().id === Number(id)); },
    unequipEssenceSlot(slot) { this._slots[slot] = null; return true; },
    equipEssenceInSlot(slot, id) { this._slots[slot] = new FakeEssence(essences[id]); return true; },
    equippedEssenceAt(slot) { return this._slots[slot]; },
    setHp(value) { this.hp = Math.max(0, Math.min(this.maxHp, Number(value))); return this.hp; },
    setValor(value) { this.valor = Math.max(0, Math.min(this.maxValor, Number(value))); return this.valor; },
    recoverAllHp() { this.hp = this.maxHp; },
    recoverAllMp() { this.mp = this.maxMp; },
    updateDerivedStatuses() {},
    addStatus(key) { if (!this.statuses.some((status) => status.key === key)) this.statuses.push({ key }); return true; },
    removeStatus(key) { const before = this.statuses.length; this.statuses = this.statuses.filter((status) => status.key !== key); return this.statuses.length !== before; },
    statusRate(key) { return key === "sleep" ? 0.75 : 1; },
  };

  const party = {
    _runes: 0,
    _items: {},
    members: () => [actor],
    actorById: (id) => Number(id) === 1 ? actor : null,
    gainItem(id, amount) { this._items[id] = (this._items[id] || 0) + amount; return true; },
    gainRunes(amount) { this._runes += amount; return true; },
    spendRunes(amount) { if (amount > this._runes) return false; this._runes -= amount; return true; },
  };
  const system = {
    party,
    actor: (id) => Number(id) === 1 ? actor : null,
    isActorRecruited: (id) => Number(id) === 1,
    recruitActor: () => true,
  };
  const SceneManager = {
    currentScene: null,
    startedEncounterId: null,
    startBattle(id) { this.startedEncounterId = id; return true; },
  };
  const DatabaseManager = {
    system: { debugMode },
    actors: [null, { id: 1, name: "Actor" }],
    essences,
    statuses,
    encounters,
    item: (id) => items[id] || null,
    essence: (id) => essences[id] || null,
    statusByKey: (key) => statuses.find((status) => status?.key === key) || null,
    encounter: (id) => encounters[id] || null,
  };
  const context = vm.createContext({
    console: { log() {}, warn() {}, table() {} },
    DatabaseManager,
    DebugManager: { log() {} },
    SceneManager,
    $gameParty: party,
    $gameSystem: system,
  });

  vm.runInContext(`${read("js/core/DevTools.js")}\nglobalThis.__DevTools = DevTools;`, context);
  return { context, DevTools: context.__DevTools, actor, party, system, SceneManager };
}

function testInstallIsDebugOnlyAndExposesShortRuntimeAliases() {
  const enabled = makeHarness(true);
  const tools = enabled.DevTools.install();
  assert.equal(enabled.context.$dev, tools);
  assert.equal(tools.P, enabled.party);
  assert.equal(tools.S, enabled.system);
  assert.equal(tools.A(1), enabled.actor);

  const disabled = makeHarness(false);
  assert.equal(disabled.DevTools.install(), null);
  assert.equal(disabled.context.$dev, undefined);
}

function testResourceStatusAndBattleHelpersUseRuntimeContracts() {
  const { DevTools, actor, party, SceneManager } = makeHarness(true);
  const tools = DevTools.install();

  assert.equal(tools.hp(1, 250), 250);
  assert.equal(tools.hpRate(1, 0.25), 125);
  assert.equal(tools.mp(1, 40), 40);
  assert.equal(tools.valor(1), 100);
  assert.equal(tools.status(1, "poison"), true);
  assert.equal(actor.statuses.some((status) => status.key === "poison"), true);
  assert.equal(tools.clearStatus(1, "poison"), true);
  const chance = tools.statusChance(1, "sleep", 0.72);
  assert.equal(chance.family, "mental");
  assert.equal(chance.targetRate, 0.75);
  assert.ok(Math.abs(chance.effectiveChance - 0.54) < 1e-9);
  assert.equal(tools.item(1, 3), true);
  assert.equal(party._items[1], 3);
  assert.equal(tools.runes(500), true);
  assert.equal(typeof tools.gil, "undefined");
  assert.equal(party._runes, 500);
  assert.equal(tools.battle(1), true);
  assert.equal(SceneManager.startedEncounterId, 1);
}

function testEssenceLevelFourMasteryAndPassivePrepUseStableIds() {
  const { DevTools, actor } = makeHarness(true);
  const tools = DevTools.install();

  const level4 = tools.level4(1, 1, 0);
  assert.equal(level4.level(), 4);
  assert.equal(level4.resonance, 700);
  assert.equal(actor.equippedEssenceAt(0), level4);

  const prepared = tools.passive(1, 1, 1);
  assert.equal(prepared.essenceId, 1);
  assert.equal(prepared.level, 4);
  assert.equal(prepared.passiveType, "elementDamageBoost");
  assert.equal(prepared.hint.includes("fire"), true);

  const mastered = tools.master(1, 1, 2);
  assert.equal(mastered.resonance, 1500);
}

function testReferenceTablesAndLoadOrderAreDocumentedByRuntime() {
  const { DevTools } = makeHarness(true);
  const tools = DevTools.install();
  assert.equal(tools.help().some((entry) => entry.command.includes("$dev.passive")), true);
  assert.equal(tools.help().some((entry) => entry.command.includes("$dev.statusChance")), true);
  assert.equal(tools.passives()[0].id, 1);
  assert.equal(tools.statuses()[0].key, "poison");
  assert.equal(tools.encounters()[0].id, 1);

  const index = read("index.html");
  const main = read("js/main.js");
  assert.ok(index.indexOf("js/core/DevTools.js") < index.indexOf("js/main.js"));
  assert.ok(main.indexOf("window.$gameSystem") < main.indexOf("DevTools.install()"));
}

function run() {
  testInstallIsDebugOnlyAndExposesShortRuntimeAliases();
  testResourceStatusAndBattleHelpersUseRuntimeContracts();
  testEssenceLevelFourMasteryAndPassivePrepUseStableIds();
  testReferenceTablesAndLoadOrderAreDocumentedByRuntime();
  console.log("Development console helper regression tests passed.");
}

run();
