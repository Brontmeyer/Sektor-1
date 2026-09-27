"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");

function source(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function testLowLevelBattlerTracingIsVerboseOnly() {
  const logs = [];
  const context = vm.createContext({
    console: { ...console, log: (...args) => logs.push(args.join(" ")) },
    DatabaseManager: {
      statuses: [],
      statusByKey() { return null; },
    },
  });

  vm.runInContext(
    `${source("js/core/DebugManager.js")}\n${source("js/objects/Game_Battler.js")}\n` +
      "globalThis.__classes = { DebugManager, Game_Battler };",
    context,
  );

  const { DebugManager, Game_Battler } = context.__classes;
  const battler = new Game_Battler({ name: "Sarah", maxHp: 100, maxMp: 20 });

  battler.receiveDamage(10);
  battler.payMpCost(5);
  assert.deepEqual(logs, [], "routine HP/MP mutations stay out of the normal console");

  DebugManager.setVerboseEnabled(true);
  battler.receiveDamage(10);
  battler.payMpCost(5);
  assert.equal(logs.some((line) => line.includes("lost 10 HP")), true);
  assert.equal(logs.some((line) => line.includes("used 5 MP")), true);
}

function loadBattleManager({ warnings = [] } = {}) {
  const context = vm.createContext({
    console: {
      ...console,
      warn: (...args) => warnings.push(args.join(" ")),
    },
    BattleEnemyAI: class BattleEnemyAI {},
    $gameParty: {
      battleMembers() { return []; },
      livingBattleMembers() { return []; },
    },
  });

  vm.runInContext(
    `${source("js/core/DatabaseValidator.js")}\n${source("js/battle/BattleManager.js")}\n` +
      "globalThis.__classes = { DatabaseValidator, BattleManager };",
    context,
  );

  return context.__classes;
}

function testLegacyStatusPlaceholdersDoNotSpamWarnings() {
  const warnings = [];
  const { BattleManager } = loadBattleManager({ warnings });
  const messages = [];
  const manager = new BattleManager({
    addBattlePopup() {},
    addBattleMessage(message) { messages.push(message); },
  });
  const caster = { name: "Tyler" };
  const target = { name: "Aboo" };
  const magick = { name: "Nulify", effect: "removeStatus" };

  manager.presentMagickStatusResults(caster, magick, target, [
    { key: "slow", name: "Slow", removed: true, reason: "removed" },
    { key: "deathforce", reason: "unknownStatus" },
    { key: "resist", reason: "unknownStatus" },
  ]);

  assert.equal(warnings.length, 0, "known legacy placeholders are intentionally quiet");
  assert.equal(messages.length, 1);
  assert.match(messages[0], /Slow removed from Aboo/);

  manager.presentMagickStatusResults(caster, magick, target, [
    { key: "definitely_not_real", reason: "unknownStatus" },
  ]);
  assert.equal(warnings.length, 1, "unexpected status typos still warn developers");
  assert.match(warnings[0], /definitely_not_real/);
}

function testElementalMagickMessageNamesDamageElement() {
  const { BattleManager } = loadBattleManager();
  const messages = [];
  const target = {
    name: "G Prime",
    hp: 75,
    elementRate() { return 1; },
    absorbsElementalMagick() { return false; },
    isDefeated() { return false; },
  };
  const scene = {
    enemies: [target],
    addBattlePopup() {},
    addBattleMessage(message) { messages.push(message); },
    setActorState() {},
    setEnemyState() {},
  };
  const manager = new BattleManager(scene);

  manager.presentMagickDamage(
    { name: "Test Slime" },
    { name: "Ember", element: "fire" },
    target,
    100,
  );

  assert.equal(
    messages[0],
    "Test Slime casts Ember! G Prime takes 25 Fire damage!",
  );
}

function run() {
  testLowLevelBattlerTracingIsVerboseOnly();
  testLegacyStatusPlaceholdersDoNotSpamWarnings();
  testElementalMagickMessageNamesDamageElement();
  console.log("Battle console clarity regression tests passed.");
}

run();
