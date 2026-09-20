"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const statuses = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "data", "Statuses.json"), "utf8"),
);
const actors = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "data", "Actors.json"), "utf8"),
);
const enemies = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "data", "Enemies.json"), "utf8"),
);
const magick = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "data", "Magick.json"), "utf8"),
);

function loadClasses(relativePaths, exportExpression, globals = {}) {
  const context = vm.createContext({ console, ...globals });
  const source = relativePaths
    .map((relativePath) =>
      fs.readFileSync(path.join(projectRoot, relativePath), "utf8"),
    )
    .join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__loadedClasses = ${exportExpression};`,
    context,
    { filename: relativePaths.join(", ") },
  );

  return context.__loadedClasses;
}

function makeDatabaseManager() {
  return {
    statuses,
    actors,
    enemies,
    magick,
    statusByKey(key) {
      return statuses.find((status) => status?.key === key) || null;
    },
    actor(id) {
      return actors[id] || null;
    },
    enemy(id) {
      return enemies[id] || null;
    },
    magick(id) {
      return magick[id] || null;
    },
    magickName(id) {
      return magick[id]?.name || "Unknown Magick";
    },
    weapon() {
      return null;
    },
    armor() {
      return null;
    },
  };
}

function loadCombatClasses() {
  const partyMembers = [];
  const gameParty = {
    battleMembers: () => partyMembers,
    livingBattleMembers: () => partyMembers.filter((battler) => battler.isAlive()),
  };
  const classes = loadClasses(
    [
      "js/objects/Game_Battler.js",
      "js/objects/Game_Actor.js",
      "js/objects/Game_Enemy.js",
      "js/battle/BattleEnemyAI.js",
      "js/battle/BattleManager.js",
    ],
    "{ Game_Battler, Game_Actor, Game_Enemy, BattleManager }",
    {
      DatabaseManager: makeDatabaseManager(),
      DebugManager: { log() {} },
      $gameParty: gameParty,
    },
  );

  return { ...classes, partyMembers, gameParty };
}

function testIncomingDamageStatusModifiers() {
  const { Game_Battler } = loadCombatClasses();

  const barrierTarget = new Game_Battler({ name: "Barrier", maxHp: 1000 });
  barrierTarget.addStatus("barrier");
  const barrierResult = barrierTarget.receiveDamage(100, {
    category: "physical",
  });

  assert.equal(barrierResult.damage, 50);
  assert.equal(barrierTarget.hp, 950);

  const mbarrierTarget = new Game_Battler({ name: "MBarrier", maxHp: 1000 });
  mbarrierTarget.addStatus("mbarrier");
  const mbarrierResult = mbarrierTarget.receiveDamage(100, {
    category: "magical",
    element: "fire",
  });

  assert.equal(mbarrierResult.damage, 50);
  assert.equal(mbarrierTarget.hp, 950);

  const stackedTarget = new Game_Battler({ name: "Stacked", maxHp: 1000 });
  stackedTarget.addStatus("barrier");
  stackedTarget.addStatus("sadness");
  const stackedResult = stackedTarget.receiveDamage(100, {
    category: "physical",
  });

  assert.equal(stackedResult.damage, 35);
  assert.equal(stackedTarget.hp, 965);
}

function testShieldPhysicalImmunityAndElementalAbsorption() {
  const { Game_Battler } = loadCombatClasses();

  const target = new Game_Battler({ name: "Shielded", maxHp: 1000 });
  target.setHp(500);
  target.addStatus("shield");

  const physicalResult = target.receiveDamage(120, { category: "physical" });

  assert.equal(physicalResult.damage, 0);
  assert.equal(target.hp, 500);

  target.addStatus("mbarrier");
  const absorbed = target.receiveDamage(100, {
    category: "magical",
    element: "fire",
  });

  assert.equal(absorbed.absorbed, true);
  assert.equal(absorbed.damage, 0);
  assert.equal(absorbed.healing, 50);
  assert.equal(target.hp, 550);

  const nonElemental = target.receiveDamage(100, {
    category: "magical",
    element: "none",
  });

  assert.equal(nonElemental.absorbed, false);
  assert.equal(nonElemental.damage, 50);
  assert.equal(target.hp, 500);
}

function testPhysicalDamageWakeRules() {
  const { Game_Battler } = loadCombatClasses();

  const target = new Game_Battler({ name: "Sleeping", maxHp: 1000 });
  target.addStatus("sleep");
  target.addStatus("confuse");

  const physical = target.receiveDamage(100, { category: "physical" });

  assert.equal(physical.damage, 100);
  assert.equal(target.hasStatus("sleep"), false);
  assert.equal(target.hasStatus("confuse"), false);
  assert.deepEqual(
    Array.from(physical.removedStatuses).sort(),
    ["confuse", "sleep"],
  );

  target.addStatus("sleep");
  target.receiveDamage(100, { category: "magical", element: "none" });
  assert.equal(target.hasStatus("sleep"), true);

  target.addStatus("shield");
  target.receiveDamage(100, { category: "physical" });
  assert.equal(target.hasStatus("sleep"), true);
}

function testPhysicalOutgoingDamageAndAccuracyModifiers() {
  const { Game_Battler, Game_Enemy, BattleManager } = loadCombatClasses();
  const attacker = new Game_Battler({
    name: "Attacker",
    maxHp: 100,
    attack: 100,
    attackPercent: 100,
  });
  const target = new Game_Battler({ name: "Target", maxHp: 1000 });
  const manager = new BattleManager({ partyController: null });

  const enemy = new Game_Enemy(1);
  assert.equal(manager.physicalHitChance(enemy), 90);
  enemy.addStatus("darkness");
  assert.equal(manager.physicalHitChance(enemy), 45);

  attacker.addStatus("darkness");
  assert.equal(manager.physicalHitChance(attacker), 50);

  attacker.addStatus("fury");
  assert.equal(manager.physicalHitChance(attacker), 35);

  attacker.removeStatus("darkness");
  attacker.removeStatus("fury");
  attacker.addStatus("small");
  target.addStatus("barrier");

  const result = manager.applyPhysicalDamage(attacker, target);

  assert.equal(result.requestedDamage, 10);
  assert.equal(result.damage, 5);
  assert.equal(target.hp, 995);
}

function testRearExposureBoostsOnlyPhysicalDamagePath() {
  const { Game_Battler, BattleManager } = loadCombatClasses();
  const attacker = new Game_Battler({
    name: "Rear Attacker",
    maxHp: 100,
    attack: 100,
  });
  const rearTarget = new Game_Battler({ name: "Rear Target", maxHp: 1000 });
  const frontTarget = new Game_Battler({ name: "Front Target", maxHp: 1000 });
  let turned = null;
  const rearManager = new BattleManager({
    partyController: null,
    formationManager: { physicalRearDamageMultiplier: () => 1.5 },
    turnActorTowardEnemies(target) {
      turned = target;
    },
  });
  const frontManager = new BattleManager({
    partyController: null,
    formationManager: { physicalRearDamageMultiplier: () => 1 },
  });

  const rear = rearManager.applyPhysicalDamage(attacker, rearTarget);
  const front = frontManager.applyPhysicalDamage(attacker, frontTarget);

  assert.equal(rear.damage, Math.floor(front.damage * 1.5));
  assert.equal(rear.rearExposed, true);
  assert.equal(rear.rearMultiplier, 1.5);
  assert.equal(front.rearExposed, false);
  assert.equal(turned, rearTarget);
}

function testMagickUsesSharedDamageResolution() {
  const { Game_Actor, Game_Enemy } = loadCombatClasses();
  const actor = new Game_Actor(1);
  const target = new Game_Enemy(1);

  actor.learnMagick(10);
  target.setHp(100);
  target.addStatus("shield");

  const mpBefore = actor.mp;
  const success = actor.useMagick(10, target, true, "single");

  assert.equal(success, true);
  assert.equal(actor.mp, mpBefore - magick[10].mpCost);
  assert.ok(target.hp > 100);

  const mbarrierTarget = new Game_Enemy(1);
  mbarrierTarget.addStatus("mbarrier");
  const expectedBeforeBarrier = actor.magickDamage(
    magick[10],
    mbarrierTarget,
    "single",
  );
  const hpBefore = mbarrierTarget.hp;

  actor.useMagick(10, mbarrierTarget, false, "single");

  assert.equal(
    hpBefore - mbarrierTarget.hp,
    Math.floor(expectedBeforeBarrier * 0.5),
  );
}

testIncomingDamageStatusModifiers();
testShieldPhysicalImmunityAndElementalAbsorption();
testPhysicalDamageWakeRules();
testPhysicalOutgoingDamageAndAccuracyModifiers();
testRearExposureBoostsOnlyPhysicalDamagePath();
testMagickUsesSharedDamageResolution();

console.log("Combat modifier regression tests passed.");
