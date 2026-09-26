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
const items = readData("Items.json");
const statuses = readData("Statuses.json");

function createHarness() {
  const partyMembers = [];
  let inventoryCount = 2;
  const itemUses = [];
  const DatabaseManager = {
    actors,
    enemies,
    items,
    statuses,
    actor(id) { return actors[id] || null; },
    enemy(id) { return enemies[id] || null; },
    item(id) { return items[id] || null; },
    statusByKey(key) {
      return statuses.find((status) => status?.key === key) || null;
    },
    weapon() { return null; },
    armor() { return null; },
    accessory() { return null; },
    magick() { return null; },
    skill() { return null; },
    valorArt() { return null; },
    enemySkill() { return null; },
  };
  const gameParty = {
    battleMembers() { return partyMembers; },
    itemCount() { return inventoryCount; },
    useItem(itemId, target) {
      const item = items[itemId];
      if (!item || inventoryCount <= 0 || !target) return false;
      if (item.effect?.type !== "healHp" || target.isFullHp()) return false;
      target.gainHp(Number(item.effect.value) || 0);
      inventoryCount--;
      itemUses.push({ itemId, target });
      return true;
    },
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
  const actor = new Game_Actor(1);
  const enemy = new Game_Enemy(1);
  actor.setHp(Math.max(1, actor.maxHp - 100));
  enemy.setHp(Math.max(1, enemy.maxHp - 100));
  partyMembers.push(actor);

  const messages = [];
  let itemWindowHidden = false;
  const scene = {
    enemies: [enemy],
    pendingItem: null,
    pendingItemTarget: null,
    pendingSkill: null,
    pendingMagick: null,
    targetGroup: "enemy",
    targetScope: "single",
    selectedEnemyIndex: 0,
    selectedAllyIndex: 0,
    selectingEnemyTarget: false,
    enemyTargetAction: null,
    battleInputLocked: false,
    actionPhase: "none",
    activeTimeClaimDelay: 0,
    pendingEnemyTurn: false,
    partyController: {
      currentBattler: () => actor,
      battleMembers: () => partyMembers,
    },
    itemWindow: {
      currentItem: () => items[1],
      hide() { itemWindowHidden = true; },
    },
    addBattleMessage(message) { messages.push(message); },
    showBattleBanner() {},
    setActionPhase(phase) { this.actionPhase = phase; },
    setActorState() {},
  };
  scene.targetManager = new BattleTargetManager(scene);
  const manager = new BattleManager(scene);

  return {
    actor,
    enemy,
    gameParty,
    itemUses,
    messages,
    scene,
    manager,
    BattleTargetManager,
    get inventoryCount() { return inventoryCount; },
    get itemWindowHidden() { return itemWindowHidden; },
  };
}

function testItemsDefaultToAnyLivingBattlerButMayNarrowTargets() {
  const { actor, enemy, scene } = createHarness();
  const potion = items[1];

  assert.deepEqual(
    Array.from(scene.targetManager.allowedTargetGroups(potion)),
    ["ally", "enemy"],
  );
  assert.equal(actor.isValidItemTarget(potion, actor), true);
  assert.equal(actor.isValidItemTarget(potion, enemy), true);

  const enemyOnly = { ...potion, target: ["enemy"] };
  assert.deepEqual(
    Array.from(scene.targetManager.allowedTargetGroups(enemyOnly)),
    ["enemy"],
  );
  assert.equal(actor.isValidItemTarget(enemyOnly, actor), false);
  assert.equal(actor.isValidItemTarget(enemyOnly, enemy), true);
}

function testChoosingItemEntersTargetSelectionWithoutConsumingIt() {
  const harness = createHarness();
  const { scene, manager, actor } = harness;

  assert.equal(manager.executeItem(), true);
  assert.equal(scene.pendingItem, items[1]);
  assert.equal(scene.pendingItemTarget, null);
  assert.equal(scene.selectingEnemyTarget, true);
  assert.equal(scene.enemyTargetAction, "item");
  assert.equal(scene.targetGroup, "ally");
  assert.equal(scene.targetManager.getSelectedTarget(), actor);
  assert.equal(harness.itemWindowHidden, true);
  assert.equal(harness.itemUses.length, 0);
  assert.equal(harness.inventoryCount, 2);
}

function testConfirmedEnemyTargetReceivesItemAndOnlyThenConsumesInventory() {
  const harness = createHarness();
  const { scene, manager, enemy } = harness;
  const hpBefore = enemy.hp;

  manager.executeItem();
  scene.targetManager.selectBattler(enemy);
  scene.pendingItemTarget = enemy;
  scene.selectingEnemyTarget = false;
  scene.enemyTargetAction = null;

  assert.equal(harness.itemUses.length, 0);
  assert.equal(harness.inventoryCount, 2);
  assert.equal(manager.performItemEffect(), true);
  assert.equal(enemy.hp > hpBefore, true);
  assert.equal(harness.itemUses.length, 1);
  assert.equal(harness.itemUses[0].target, enemy);
  assert.equal(harness.inventoryCount, 1);
  assert.equal(scene.pendingItem, null);
  assert.equal(scene.pendingItemTarget, null);
  assert.equal(
    harness.messages.some((message) => message.includes(`on ${enemy.name}`)),
    true,
  );
}

function run() {
  testItemsDefaultToAnyLivingBattlerButMayNarrowTargets();
  testChoosingItemEntersTargetSelectionWithoutConsumingIt();
  testConfirmedEnemyTargetReceivesItemAndOnlyThenConsumesInventory();
  console.log("Battle item targeting regression tests passed.");
}

run();
