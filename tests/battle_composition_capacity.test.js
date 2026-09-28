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

function testPartyRuntimeKeepsFourthRecruitInReserve() {
  class Game_Actor {
    constructor(actorId) {
      this.actorId = actorId;
    }
  }

  const context = vm.createContext({
    console,
    Game_Actor,
    DatabaseManager: {},
    DebugManager: { log() {} },
  });
  context.globalThis = context;
  context.$gameSystem = { actor: () => null };
  vm.runInContext(
    `${read("js/objects/Game_Party.js")}\nglobalThis.__Party = Game_Party;`,
    context,
  );

  const Party = context.__Party;
  const party = new Party([1, 2, 3, 4].map((id) => new Game_Actor(id)));

  assert.equal(Party.MAX_BATTLE_MEMBERS, 3);
  assert.deepEqual(Array.from(party.battleActorIds()), [1, 2, 3]);
  assert.deepEqual(Array.from(party.reserveMembers(), (actor) => actor.actorId), [4]);
  assert.equal(party.activateBattleActor(4), false);
}

function testFormationGeometryOwnsThreePartyLanesAndSixEnemyCap() {
  const actors = [1, 2, 3].map((actorId) => ({
    actorId,
    battleSpriteWidth: 190,
    battleSpriteHeight: 166,
  }));
  const Graphics = { width: 1600, height: 900 };
  const $gameParty = {
    battleMembers: () => actors,
    battleMemberIndex: (actor) => actors.indexOf(actor),
    battleFormationIndex: (actor) => actors.indexOf(actor),
    battleRow: () => "front",
  };
  const context = vm.createContext({ console, Graphics, $gameParty });
  vm.runInContext(
    `${read("js/battle/BattleFormationManager.js")}\nglobalThis.__Formation = BattleFormationManager;`,
    context,
  );

  const Formation = context.__Formation;
  const encounter = readData("Encounters.json")[5];
  const enemies = encounter.members.map(() => ({
    battleSpriteWidth: 128,
    battleSpriteHeight: 96,
  }));
  const scene = {
    encounter,
    enemies,
    partyController: { currentBattler: () => actors[0] },
    targetManager: { getSelectedTarget: () => null },
    selectingEnemyTarget: false,
    actionPhase: "none",
    hasActorTurnedInBackAttack: () => false,
  };
  const manager = new Formation(scene);
  const partyPositions = actors.map((actor) => manager.positionForActor(actor));

  assert.equal(Formation.MAX_ENEMIES, 6);
  assert.equal(Formation.ROW_SLOT_COUNT, 3);
  assert.equal(encounter.members.length, 6);
  assert.equal(new Set(partyPositions.map((position) => position.y)).size, 3);
  assert.equal(partyPositions[0].y < partyPositions[1].y, true);
  assert.equal(partyPositions[1].y < partyPositions[2].y, true);
}

function testDatabaseValidatorRejectsSeventhEnemyAndFourthRowSlot() {
  const context = vm.createContext({ console });
  vm.runInContext(
    `${read("js/core/DatabaseValidator.js")}\nglobalThis.__Validator = DatabaseValidator;`,
    context,
  );
  const enemies = readData("Enemies.json");
  const encounters = [
    null,
    {
      id: 1,
      name: "Seven Enemies",
      canEscape: true,
      formation: "normal",
      members: Array.from({ length: 7 }, () => ({ enemyId: 1, row: "front" })),
    },
    {
      id: 2,
      name: "Fourth Slot",
      canEscape: true,
      formation: "normal",
      members: [{ enemyId: 1, row: "back", slot: 3 }],
    },
  ];
  const errors = [];

  context.__Validator.validateEncounters(encounters, enemies, errors);

  assert.equal(errors.some((error) => error.includes("at most 6 enemy members")), true);
  assert.equal(errors.some((error) => error.includes("front row may contain at most 3 enemies")), true);
  assert.equal(errors.some((error) => error.includes("slot must be an integer from 0 to 2")), true);
}

function testBattleHudAndShadowsMatchNewComposition() {
  const context = vm.createContext({
    console,
    Graphics: { width: 1280, height: 720 },
    UIAssetManager: { drawBattleShadow: () => true },
  });
  vm.runInContext(
    `${read("js/battle/BattleHudLayout.js")}\n${read("js/battle/BattleRenderer.js")}\n` +
      `globalThis.__classes = { BattleHudLayout, BattleRenderer };`,
    context,
  );

  const { BattleHudLayout, BattleRenderer } = context.__classes;
  const renderer = new BattleRenderer({});
  const actorShadow = renderer.actorShadowMetrics({
    battleSpriteWidth: 190,
    battleSpriteHeight: 166,
  });
  const enemyShadow = renderer.enemyShadowMetrics({
    battleSpriteWidth: 128,
    battleSpriteHeight: 96,
  });

  assert.equal(BattleHudLayout.PARTY_SLOTS, 3);
  assert.equal(actorShadow.width > actorShadow.height * 5, true);
  assert.equal(enemyShadow.width > enemyShadow.height * 5, true);
  assert.equal(actorShadow.width > enemyShadow.width, true);
}

function run() {
  testPartyRuntimeKeepsFourthRecruitInReserve();
  testFormationGeometryOwnsThreePartyLanesAndSixEnemyCap();
  testDatabaseValidatorRejectsSeventhEnemyAndFourthRowSlot();
  testBattleHudAndShadowsMatchNewComposition();
  console.log("Battle composition capacity regression tests passed.");
}

run();
