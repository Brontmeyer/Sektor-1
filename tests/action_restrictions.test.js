"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const readData = (filename) =>
  JSON.parse(fs.readFileSync(path.join(projectRoot, "data", filename), "utf8"));

const statuses = readData("Statuses.json");
const actors = readData("Actors.json");
const magick = readData("Magick.json");

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
    magick,
    statusByKey(key) {
      return statuses.find((status) => status?.key === key) || null;
    },
    actor(id) {
      return actors[id] || null;
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
  return loadClasses(
    ["js/objects/Game_Battler.js", "js/objects/Game_Actor.js"],
    "{ Game_Battler, Game_Actor }",
    {
      DatabaseManager: makeDatabaseManager(),
      DebugManager: { log() {} },
    },
  );
}

function testSilenceBlocksMagicButNotOrdinaryCommands() {
  const { Game_Actor } = loadCombatClasses();
  const actor = new Game_Actor(1);

  actor.learnMagick(10); // Ember
  assert.equal(actor.canUseMagick(10), true);

  actor.addStatus("silence");

  assert.equal(actor.canUseBattleAction("attack"), true);
  assert.equal(actor.canUseBattleAction("magick"), false);
  assert.equal(actor.canUseBattleAction("item"), true);
  assert.equal(actor.canUseBattleAction("defend"), true);
  assert.equal(actor.canUseMagick(10), false);

  actor.removeStatus("silence");
  assert.equal(actor.canUseMagick(10), true);
}

function testFrogRestrictsBattlerToAttack() {
  const { Game_Actor } = loadCombatClasses();
  const actor = new Game_Actor(1);

  actor.learnMagick(10); // Ember
  actor.addStatus("frog");

  assert.deepEqual(Array.from(actor.allowedBattleActions()), ["attack"]);
  assert.equal(actor.canUseBattleAction("attack"), true);
  assert.equal(actor.canUseBattleAction("magick"), false);
  assert.equal(actor.canUseBattleAction("item"), false);
  assert.equal(actor.canUseBattleAction("defend"), false);
  assert.equal(actor.canUseMagick(10), false);
}

function testActionAllowListsIntersectAndBlockingStillWins() {
  const { Game_Battler } = loadCombatClasses();
  const battler = new Game_Battler({ name: "Restricted", maxHp: 100, maxMp: 10 });

  const originalDefinitions = battler.activeStatusDefinitions.bind(battler);
  battler.activeStatusDefinitions = () => [
    { effects: { allowedActions: ["attack", "magick"] } },
    { effects: { allowedActions: ["magick", "item"] } },
    { effects: { blockedActionTypes: ["magick"] } },
  ];

  assert.deepEqual(Array.from(battler.allowedBattleActions()), ["magick"]);
  assert.equal(battler.canUseBattleAction("magick"), false);
  assert.equal(battler.canUseBattleAction("attack"), false);

  battler.activeStatusDefinitions = originalDefinitions;
}

function testActionPreventionOverridesSpecificRestrictions() {
  const { Game_Actor } = loadCombatClasses();
  const actor = new Game_Actor(1);

  actor.addStatus("paralyze");

  assert.equal(actor.canUseBattleAction("attack"), false);
  assert.equal(actor.canUseBattleAction("magick"), false);
}

function testBattleCommandWindowDisablesAndSkipsRestrictedCommands() {
  const { Game_Actor } = loadCombatClasses();
  const actor = new Game_Actor(1);
  actor.addStatus("frog");

  const Window_BattleCommand = loadClasses(
    ["js/windows/Window_BattleCommand.js"],
    "Window_BattleCommand",
    {
      Graphics: { height: 720, context: {} },
      Input: { isTriggered() { return false; } },
    },
  );

  const scene = {
    partyController: {
      currentBattler() {
        return actor;
      },
    },
  };
  const window = new Window_BattleCommand(scene);

  assert.equal(window.isCommandEnabled("Attack"), true);
  assert.equal(window.isCommandEnabled("Magick"), false);
  assert.equal(window.isCommandEnabled("Item"), false);
  assert.equal(window.isCommandEnabled("Defend"), false);

  window.index = 1;
  assert.equal(window.ensureEnabledSelection(), true);
  assert.equal(window.currentCommand(), "Attack");
  assert.equal(window.moveSelection(1), true);
  assert.equal(window.currentCommand(), "Attack");
}

function testBattleManagerRejectsRestrictedCommandWithoutConsumingTurn() {
  const { Game_Actor } = loadCombatClasses();
  const actor = new Game_Actor(1);
  actor.addStatus("silence");

  const partyMembers = [actor];
  const messages = [];
  let magickOpened = false;

  const partyController = {
    currentBattler() {
      return actor;
    },
  };
  const commandWindow = {
    currentCommand() {
      return "Magick";
    },
    commandActionKey() {
      return "magick";
    },
  };
  const scene = {
    partyController,
    commandWindow,
    magickWindow: {
      show() {
        magickOpened = true;
      },
    },
    itemWindow: { show() {} },
    targetManager: {},
    outcome: null,
    victory: false,
    defeat: false,
    battleInputLocked: false,
    enemies: [],
    addBattleMessage(message) {
      messages.push(message);
    },
  };

  const BattleManager = loadClasses(
    ["js/battle/BattleManager.js"],
    "BattleManager",
    {
      DebugManager: { log() {} },
      $gameParty: {
        battleMembers: () => partyMembers,
        livingBattleMembers: () => partyMembers,
      },
    },
  );
  const manager = new BattleManager(scene);

  manager.executeCommand();

  assert.equal(magickOpened, false);
  assert.equal(scene.battleInputLocked, false);
  assert.equal(messages.at(-1), `${actor.name} cannot use Magick right now!`);
}

function testRestrictionMetadataValidation() {
  const { DatabaseValidator } = loadClasses(
    ["js/core/DatabaseValidator.js"],
    "{ DatabaseValidator }",
    { DebugManager: { log() {} } },
  );

  const validMagickErrors = [];
  const validStatusErrors = [];
  DatabaseValidator.validateMagick(magick, validMagickErrors);
  DatabaseValidator.validateStatuses(statuses, validStatusErrors);

  assert.deepEqual(Array.from(validMagickErrors), []);
  assert.deepEqual(Array.from(validStatusErrors), []);

  const invalidMagickErrors = [];
  DatabaseValidator.validateMagick(
    [
      null,
      {
        id: 1,
        name: "Typeless",
        target: ["enemy"],
        scope: ["single"],
        mpCost: 0,
        reflectable: true,
        status: {},
      },
    ],
    invalidMagickErrors,
  );
  assert.equal(
    invalidMagickErrors.some((error) => error.includes("non-empty string type")),
    true,
  );

  const invalidStatuses = JSON.parse(JSON.stringify(statuses));
  invalidStatuses[12].effects.blockedActionTypes = "magick";
  invalidStatuses[19].effects.allowedActions = [];
  const invalidStatusErrors = [];
  DatabaseValidator.validateStatuses(invalidStatuses, invalidStatusErrors);

  assert.equal(
    invalidStatusErrors.some((error) => error.includes("blockedActionTypes")),
    true,
  );
  assert.equal(
    invalidStatusErrors.some((error) => error.includes("allowedActions")),
    true,
  );
}

testSilenceBlocksMagicButNotOrdinaryCommands();
testFrogRestrictsBattlerToAttack();
testActionAllowListsIntersectAndBlockingStillWins();
testActionPreventionOverridesSpecificRestrictions();
testBattleCommandWindowDisablesAndSkipsRestrictedCommands();
testBattleManagerRejectsRestrictedCommandWithoutConsumingTurn();
testRestrictionMetadataValidation();

console.log("Action restriction regression tests passed.");
