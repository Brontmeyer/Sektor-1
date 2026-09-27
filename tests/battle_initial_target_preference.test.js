"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const readData = (filename) =>
  JSON.parse(fs.readFileSync(path.join(projectRoot, "data", filename), "utf8"));

const actors = readData("Actors.json");
const enemies = readData("Enemies.json");
const magick = readData("Magick.json");
const statuses = readData("Statuses.json");

function createHarness(magickId) {
  const partyMembers = [];
  const DatabaseManager = {
    actor: (id) => actors[id] || null,
    enemy: (id) => enemies[id] || null,
    magick: (id) => magick[id] || null,
    magickName: (id) => magick[id]?.name || `Unknown Magick ${id}`,
    statusByKey: (key) => statuses.find((status) => status?.key === key) || null,
    weapon: () => null,
    armor: () => null,
    accessory: () => null,
    essence: () => null,
    skill: () => null,
    valorArt: () => null,
    enemySkill: () => null,
  };
  const gameParty = {
    battleMembers: () => partyMembers,
    livingBattleMembers: () => partyMembers.filter((battler) => battler.isAlive()),
    gainItem() {},
    gainGil() {},
  };
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    DatabaseManager,
    DebugManager: { log() {} },
    $gameParty: gameParty,
  });
  const source = [
    "js/objects/Game_Battler.js",
    "js/objects/Game_Actor.js",
    "js/objects/Game_Enemy.js",
    "js/battle/BattleTargetManager.js",
    "js/battle/BattleEnemyAI.js",
    "js/battle/BattleManager.js",
  ]
    .map((relativePath) =>
      fs.readFileSync(path.join(projectRoot, relativePath), "utf8"),
    )
    .join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__classes = { Game_Actor, Game_Enemy, BattleTargetManager, BattleManager };`,
    context,
  );

  const { Game_Actor, Game_Enemy, BattleTargetManager, BattleManager } =
    context.__classes;
  const ally = new Game_Actor(2);
  const caster = new Game_Actor(1);
  const enemy = new Game_Enemy(1);

  // Keep the acting battler away from party index zero so this regression
  // proves caster preference rather than merely inheriting party order.
  partyMembers.push(ally, caster);
  ally.setHp(Math.max(1, ally.maxHp - 100));
  caster.setHp(Math.max(1, caster.maxHp - 100));
  enemy.setHp(Math.max(1, enemy.maxHp - 100));
  caster.maxMp = Math.max(caster.maxMp, 500);
  caster.mp = caster.maxMp;
  caster.learnMagick(magickId);

  const selectedMagick = magick[magickId];
  const scene = {
    encounter: { canEscape: true },
    enemies: [enemy],
    pendingSkill: null,
    pendingMagick: null,
    pendingMagickTarget: null,
    pendingItem: null,
    targetGroup: "enemy",
    targetScope: "single",
    selectedEnemyIndex: 0,
    selectedAllyIndex: 0,
    selectingEnemyTarget: false,
    enemyTargetAction: null,
    battleInputLocked: false,
    partyController: { currentBattler: () => caster },
    magickWindow: {
      currentMagick: () => selectedMagick,
      hide() {},
    },
    addBattleMessage() {},
    showBattleBanner() {},
    setActorState() {},
    setEnemyState() {},
    getFormationType: () => "normal",
  };
  scene.targetManager = new BattleTargetManager(scene);
  const manager = new BattleManager(scene);

  return { ally, caster, enemy, selectedMagick, scene, manager };
}

function testRestorativeMagickOpensOnCaster() {
  const { caster, selectedMagick, scene, manager } = createHarness(1);

  assert.equal(selectedMagick.effect, "heal");
  assert.deepEqual(Array.from(selectedMagick.target), ["ally", "enemy"]);
  manager.executeMagick();

  assert.equal(scene.pendingMagick, selectedMagick);
  assert.equal(scene.targetGroup, "ally");
  assert.equal(scene.targetManager.getSelectedTarget(), caster);
  assert.equal(scene.selectedAllyIndex, 1);
  assert.equal(scene.selectingEnemyTarget, true);
}

function testOffensiveMagickStillOpensOnEnemy() {
  const { enemy, selectedMagick, scene, manager } = createHarness(10);

  assert.equal(selectedMagick.effect, "damage");
  assert.deepEqual(Array.from(selectedMagick.target), ["ally", "enemy"]);
  manager.executeMagick();

  assert.equal(scene.pendingMagick, selectedMagick);
  assert.equal(scene.targetGroup, "enemy");
  assert.equal(scene.targetManager.getSelectedTarget(), enemy);
  assert.equal(scene.selectedEnemyIndex, 0);
  assert.equal(scene.selectingEnemyTarget, true);
}

function testHealSkipsFullHpLivingCasterButKeepsInjuredAllyLegal() {
  const { ally, caster, selectedMagick, scene, manager } = createHarness(1);

  caster.setHp(caster.maxHp);
  ally.setHp(Math.max(1, ally.maxHp - 50));
  manager.executeMagick();

  assert.equal(caster.isValidMagickTarget(selectedMagick, caster), false);
  assert.equal(caster.isValidMagickTarget(selectedMagick, ally), true);
  assert.equal(scene.targetGroup, "ally");
  assert.equal(scene.targetManager.getSelectedTarget(), ally);
}

function testStatusCuresOnlySelectTargetsTheyCanActuallyCleanse() {
  const { ally, caster, selectedMagick, scene, manager } = createHarness(4);

  assert.equal(selectedMagick.effect, "removeStatus");
  assert.equal(caster.isValidMagickTarget(selectedMagick, caster), false);
  assert.equal(caster.isValidMagickTarget(selectedMagick, ally), false);

  ally.addStatus("poison");
  assert.equal(caster.isValidMagickTarget(selectedMagick, ally), true);
  manager.executeMagick();

  assert.equal(scene.targetGroup, "ally");
  assert.equal(scene.targetManager.getSelectedTarget(), ally);
}

function run() {
  testRestorativeMagickOpensOnCaster();
  testOffensiveMagickStillOpensOnEnemy();
  testHealSkipsFullHpLivingCasterButKeepsInjuredAllyLegal();
  testStatusCuresOnlySelectTargetsTheyCanActuallyCleanse();
  console.log("Battle initial target preference regression tests passed.");
}

run();
