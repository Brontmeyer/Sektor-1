"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const actors = JSON.parse(fs.readFileSync(path.join(projectRoot, "data", "Actors.json"), "utf8"));
const essences = JSON.parse(fs.readFileSync(path.join(projectRoot, "data", "Essences.json"), "utf8"));
const magick = JSON.parse(fs.readFileSync(path.join(projectRoot, "data", "Magick.json"), "utf8"));
const statuses = JSON.parse(fs.readFileSync(path.join(projectRoot, "data", "Statuses.json"), "utf8"));

function makeDatabaseManager() {
  return {
    actors,
    essences,
    magick,
    statuses,
    actor(id) { return actors[id] || null; },
    essence(id) { return essences[id] || null; },
    magick(id) { return magick[id] || null; },
    magickName(id) { return magick[id]?.name || `Magick ${id}`; },
    statusByKey(key) { return statuses.find((status) => status?.key === key) || null; },
    statusNameByKey(key) { return this.statusByKey(key)?.name || key; },
    weapon() { return null; },
    armor() { return null; },
    accessory() { return null; },
    skill() { return null; },
    valorArt() { return null; },
  };
}

function loadRuntime() {
  const DatabaseManager = makeDatabaseManager();
  const context = vm.createContext({
    console,
    DatabaseManager,
    DebugManager: { log() {} },
    BattleEnemyAI: class BattleEnemyAI {},
    $gameParty: null,
  });
  const files = [
    "js/objects/Game_Battler.js",
    "js/objects/Game_Essence.js",
    "js/objects/Game_Actor.js",
    "js/battle/BattleManager.js",
  ];
  const source = files
    .map((file) => fs.readFileSync(path.join(projectRoot, file), "utf8"))
    .join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__runtime = { Game_Battler, Game_Essence, Game_Actor, BattleManager };`,
    context,
    { filename: "essence-passive-runtime.js" },
  );

  return { ...context.__runtime, context, DatabaseManager };
}

function makeHarness() {
  const runtime = loadRuntime();
  const { Game_Battler, Game_Actor } = runtime;

  class TestEnemy extends Game_Battler {
    constructor(name = "Test Enemy") {
      super({
        name,
        level: 1,
        maxHp: 1000,
        maxMp: 100,
        attack: 50,
        attackPercent: 100,
        defense: 10,
        magicDefense: 10,
      });
      this._banished = false;
    }

    battleSideType() { return "enemy"; }

    banish() {
      if (this.isDefeated()) return { success: false };
      this._banished = true;
      this.setHp(0);
      return { success: true };
    }

    isBanished() { return this._banished; }
  }

  const actor = (id = 1) => new Game_Actor(id);
  const enemy = (name) => new TestEnemy(name);
  const equipLevel4 = (battler, essenceId, slot = 0) => {
    assert.equal(battler.equipEssenceInSlot(slot, essenceId, 700), true);
    assert.equal(battler.equippedEssenceAt(slot).level(), 4);
    return battler.equippedEssenceAt(slot);
  };

  return { ...runtime, TestEnemy, actor, enemy, equipLevel4 };
}

function sequenceRandom(values, fallback = 0) {
  const queue = [...values];
  return () => (queue.length > 0 ? queue.shift() : fallback);
}

function testPassiveUnlockBoundaryAndHealingCostReduction() {
  const { actor } = makeHarness();
  const caster = actor();
  const mend = magick[1];

  assert.equal(caster.equipEssenceInSlot(0, 1, 699), true);
  assert.equal(caster.equippedEssenceAt(0).level(), 3);
  assert.equal(caster.activeEssencePassives().length, 0);
  assert.equal(caster.magickMpCost(mend), 5);

  caster.equippedEssenceAt(0).setResonance(700);
  assert.equal(caster.activeEssencePassives("essenceAbilityMpCostReduction").length, 1);
  assert.equal(caster.magickMpCost(mend), 4);

  caster.unequipEssenceSlot(0);
  assert.equal(caster.magickMpCost(mend), 5);
}

function testPurityCleanseHealingAndRenewalReviveStatus() {
  const { actor, equipLevel4 } = makeHarness();
  const caster = actor(1);
  const ally = actor(2);

  equipLevel4(caster, 2);
  ally.setHp(250);
  ally.addStatus("poison");
  assert.equal(caster.useMagick(4, ally, false, "single", () => 0), true);
  assert.equal(ally.hasStatus("poison"), false);
  assert.equal(ally.hp, 300, "successful cleanse heals 10% Max HP");
  assert.equal(caster.magickPassiveResults()[0].type, "essenceCleanseHeal");

  caster.unequipEssenceSlot(0);
  equipLevel4(caster, 3);
  ally.setHp(0);
  assert.equal(caster.useMagick(7, ally, false, "single", () => 0), true);
  assert.equal(ally.hp, 125);
  assert.equal(ally.hasStatus("regen"), true);
}

function testElementDamageAndElementStatusPassives() {
  const { actor, enemy, equipLevel4 } = makeHarness();
  const caster = actor();
  const target = enemy();

  assert.equal(caster.equipEssenceInSlot(0, 4, 699), true);
  const baseFire = caster.magickDamage(magick[10], target);
  caster.equippedEssenceAt(0).setResonance(700);
  const boostedFire = caster.magickDamage(magick[10], target);
  assert.equal(boostedFire, Math.floor(baseFire * 1.1));

  caster.unequipEssenceSlot(0);
  equipLevel4(caster, 5);
  assert.equal(caster.useMagick(13, target, false, "single", () => 0), true);
  assert.equal(target.hasStatus("slow"), true);

  target.removeStatus("slow", { force: true });
  caster.unequipEssenceSlot(0);
  equipLevel4(caster, 6);
  assert.equal(caster.useMagick(16, target, false, "single", () => 0), true);
  assert.equal(target.hasStatus("paralyze"), true);
}

function testElementSelfStatusAndPoisonPotency() {
  const { actor, enemy, equipLevel4 } = makeHarness();
  const caster = actor();
  const target = enemy();

  equipLevel4(caster, 7);
  assert.equal(caster.useMagick(19, target, true, "single", () => 0), true);
  assert.equal(caster.hasStatus("barrier"), true);

  caster.removeStatus("barrier", { force: true });
  caster.unequipEssenceSlot(0);
  equipLevel4(caster, 9);
  assert.equal(caster.useMagick(25, target, true, "single", () => 0), true);
  assert.equal(caster.hasStatus("haste"), true);

  caster.unequipEssenceSlot(0);
  equipLevel4(caster, 8);
  target.setHp(target.maxHp);
  assert.equal(caster.useMagick(22, target, false, "single", () => 0), true);
  assert.equal(target.hasStatus("poison"), true);
  assert.equal(target.statusRuntime("poison").statusDamageMultiplier, 1.25);
  const poison = target.processStatusTrigger("turnStart").find((result) => result.key === "poison");
  assert.equal(poison.damage, 37);
}

function testMindMetamorphAndNullStatusDefense() {
  const { actor, enemy, equipLevel4 } = makeHarness();
  const defender = actor();
  const hostile = enemy();

  equipLevel4(defender, 10);
  assert.equal(defender.statusRate("sleep"), 0.75);
  const resisted = defender.tryAddStatus(
    "sleep",
    1,
    () => 0.8,
    { source: hostile },
  );
  assert.equal(resisted.applied, false);
  assert.equal(resisted.reason, "resisted");

  defender.unequipEssenceSlot(0);
  equipLevel4(defender, 14);
  const negated = defender.tryAddStatus(
    "poison",
    1,
    sequenceRandom([0.1, 0]),
    { source: hostile },
  );
  assert.equal(negated.applied, false);
  assert.equal(negated.reason, "negated");

  const selfApplied = defender.tryAddStatus(
    "poison",
    1,
    () => 0,
    { source: defender },
  );
  assert.equal(selfApplied.applied, true, "Null does not negate self-applied states");

  const caster = actor(2);
  const target = enemy("Metamorph Target");
  equipLevel4(caster, 11);
  assert.equal(caster.magickStatusChance(magick[31], target, 0.72), 0.87);
  assert.equal(caster.useMagick(31, target, false, "single", () => 0.8), true);
  assert.equal(target.hasStatus("small"), true);
}

function testTimeAndAstralMpRefunds() {
  const { actor, enemy, equipLevel4 } = makeHarness();
  const caster = actor();

  equipLevel4(caster, 12);
  caster.mp = 100;
  assert.equal(
    caster.useMagick(34, caster, true, "single", sequenceRandom([0, 0])),
    true,
  );
  assert.equal(caster.mp, 100, "Time passive refunds the full paid MP cost");
  assert.equal(caster.magickPassiveResults().some((result) => result.mpRefund === 18), true);

  caster.unequipEssenceSlot(0);
  equipLevel4(caster, 15);
  caster.mp = 100;
  const target = enemy();
  assert.equal(caster.useMagick(46, target, true, "single", () => 0), true);
  assert.equal(caster.mp, 65, "Astral refunds half of Starfall's 70 MP cost");
  assert.equal(caster.magickPassiveResults().some((result) => result.mpRefund === 35), true);
}

function testWardWindAndFuryCombatPassives() {
  const { actor, enemy, equipLevel4, BattleManager, context } = makeHarness();
  const wardActor = actor();
  equipLevel4(wardActor, 13);
  wardActor.setHp(126);
  wardActor.beginEssenceBattleState();
  wardActor.drainEssencePassiveEvents();
  wardActor.setHp(125);
  assert.equal(wardActor.hasStatus("barrier"), true);
  assert.equal(wardActor.hasStatus("mbarrier"), true);
  assert.equal(wardActor.drainEssencePassiveEvents().length, 1);

  wardActor.setHp(300);
  wardActor.removeStatus("barrier", { force: true });
  wardActor.removeStatus("mbarrier", { force: true });
  wardActor.setHp(125);
  assert.equal(wardActor.hasStatus("barrier"), false, "Ward fires only once per battle");
  wardActor.beginEssenceBattleState();
  assert.equal(wardActor.hasStatus("barrier"), true, "new battle resets Ward trigger");

  const windActor = actor(2);
  equipLevel4(windActor, 16);
  const attacker = enemy();
  const party = { battleMembers: () => [windActor], livingBattleMembers: () => [windActor] };
  context.$gameParty = party;
  const manager = new BattleManager({ enemies: [attacker], addBattleMessage() {}, addBattlePopup() {} });
  assert.ok(Math.abs(windActor.physicalEvasionBonus() - 0.15) < 1e-9);
  assert.equal(manager.physicalHitChance(attacker, windActor), 85);

  const furyActor = actor(3);
  equipLevel4(furyActor, 17);
  const furyDisplay = String(essences[17].name || "Essence")
    .replace(/\s+Essence$/i, "")
    .trim();
  const furyLabel = furyDisplay ? `${furyDisplay.toUpperCase()} ESS` : "ESSENCE";
  furyActor.setHp(300);
  assert.equal(furyActor.physicalDamageMultiplier(), 1);
  assert.equal(furyActor.essenceBattleStatusSummary(), "");
  furyActor.setHp(250);
  assert.equal(furyActor.physicalDamageMultiplier(), 1.1);
  assert.equal(furyActor.essenceBattleStatusSummary(), `${furyLabel} +10%`);
  furyActor.setHp(125);
  assert.equal(furyActor.physicalDamageMultiplier(), 1.2);
  assert.equal(furyActor.essenceBattleStatusSummary(), `${furyLabel} +20%`);
  furyActor.setHp(0);
  assert.equal(furyActor.essenceBattleStatusSummary(), "");
}

function testWayfarerEscapeRecovery() {
  const { actor, equipLevel4, BattleManager, context } = makeHarness();
  const wayfarer = actor(1);
  const ally = actor(2);
  equipLevel4(wayfarer, 18);
  wayfarer.setHp(200);
  wayfarer.mp = 20;
  ally.setHp(300);
  ally.mp = 40;

  const party = {
    battleMembers: () => [wayfarer, ally],
    livingBattleMembers: () => [wayfarer, ally],
  };
  context.$gameParty = party;
  const messages = [];
  const scene = {
    outcome: null,
    enemies: [],
    addBattleMessage(message) { messages.push(message); },
  };
  const manager = new BattleManager(scene);

  assert.equal(manager.declareBattleOutcome(BattleManager.OUTCOME_ESCAPE), true);
  assert.equal(wayfarer.hp, 250);
  assert.equal(wayfarer.mp, 30);
  assert.equal(ally.hp, 350);
  assert.equal(ally.mp, 50);
  assert.equal(messages.some((message) => message.includes(essences[18].name)), true);
}

function testRiftBanishChain() {
  const { actor, enemy, equipLevel4, BattleManager, context } = makeHarness();
  const caster = actor();
  equipLevel4(caster, 19);
  const first = enemy("First Target");
  const second = enemy("Second Target");
  const party = { battleMembers: () => [caster], livingBattleMembers: () => [caster] };
  context.$gameParty = party;
  const scene = {
    outcome: null,
    victory: false,
    defeat: false,
    enemies: [first, second],
    addBattleMessage() {},
    addBattlePopup() {},
    setActorState() {},
    setEnemyState() {},
  };
  const manager = new BattleManager(scene);

  assert.equal(caster.useMagick(44, first, false, "single", () => 0), true);
  assert.equal(first.isBanished(), true);
  const chained = manager.resolveBanishEssenceChains(
    caster,
    magick[44],
    first,
    () => 0,
  );
  assert.equal(chained.length, 1);
  assert.equal(second.isBanished(), true);
}

function testEffectiveMpCostPresentationContract() {
  const fieldSource = fs.readFileSync(
    path.join(projectRoot, "js/windows/Window_Magick.js"),
    "utf8",
  );
  const battleSource = fs.readFileSync(
    path.join(projectRoot, "js/windows/Window_BattleMagick.js"),
    "utf8",
  );

  assert.match(fieldSource, /magickMpCost\(magick\)/);
  assert.match(battleSource, /magickMpCost\(magick\)/);
}

function run() {
  testPassiveUnlockBoundaryAndHealingCostReduction();
  testPurityCleanseHealingAndRenewalReviveStatus();
  testElementDamageAndElementStatusPassives();
  testElementSelfStatusAndPoisonPotency();
  testMindMetamorphAndNullStatusDefense();
  testTimeAndAstralMpRefunds();
  testWardWindAndFuryCombatPassives();
  testWayfarerEscapeRecovery();
  testRiftBanishChain();
  testEffectiveMpCostPresentationContract();
  console.log("Essence passive runtime regression tests passed.");
}

run();
