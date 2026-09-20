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

function loadFormationManager(members, formation = "normal") {
  const actors = Array.from({ length: 4 }, (_, index) => ({
    actorId: index + 1,
    battleSpriteWidth: 190,
    battleSpriteHeight: 166,
  }));
  const enemies = members.map((member, index) => ({
    name: `Enemy ${index + 1}`,
    battleSpriteWidth: 128,
    battleSpriteHeight: 96,
    alive: true,
  }));
  enemies.forEach((enemy) => {
    enemy.isAlive = () => enemy.alive;
  });
  const Graphics = { width: 1600, height: 900 };
  const $gameParty = {
    battleMembers: () => actors,
    battleMemberIndex(actor) {
      return actors.indexOf(actor);
    },
  };
  const context = vm.createContext({ console, Graphics, $gameParty });
  vm.runInContext(
    `${read("js/battle/BattleFormationManager.js")}\nglobalThis.__Manager = BattleFormationManager;`,
    context,
  );
  const scene = {
    encounter: { formation, members },
    enemies,
    partyController: { currentBattler: () => actors[0] },
    targetManager: { getSelectedTarget: () => null },
    selectingEnemyTarget: false,
    actionPhase: "none",
    hasActorTurnedInBackAttack: () => false,
  };
  const manager = new context.__Manager(scene);

  return { manager, scene, actors, enemies, Graphics };
}

function testCanonicalEightEnemyRowsAreAutoCentered() {
  const encounters = readData("Encounters.json");
  const encounter = encounters[5];
  const { manager } = loadFormationManager(encounter.members, encounter.formation);
  const front = encounter.members
    .map((member, index) => ({ member, position: manager.enemyPosition(index) }))
    .filter(({ member }) => member.row === "front");
  const back = encounter.members
    .map((member, index) => ({ member, position: manager.enemyPosition(index) }))
    .filter(({ member }) => member.row === "back");

  assert.equal(encounter.members.length, 8);
  assert.equal(front.length, 4);
  assert.equal(back.length, 4);
  assert.equal(new Set(front.map(({ position }) => position.x)).size, 1);
  assert.equal(new Set(back.map(({ position }) => position.x)).size, 1);
  assert.equal(front[0].position.x < back[0].position.x, true);
  assert.equal(new Set(front.map(({ position }) => position.y)).size, 4);
  assert.equal(new Set(back.map(({ position }) => position.y)).size, 4);
}

function testAutomaticRowsCenterOneTwoAndThreeMembers() {
  for (const count of [1, 2, 3]) {
    const members = Array.from({ length: count }, () => ({
      enemyId: 1,
      row: "front",
    }));
    const { manager } = loadFormationManager(members);
    const positions = members.map((_member, index) => manager.enemyPosition(index));
    const center = (manager.battlefieldTop() + manager.battlefieldBottom()) / 2;

    if (count === 1) {
      assert.equal(positions[0].y, center);
    } else {
      const average =
        positions.reduce((sum, position) => sum + position.y, 0) / positions.length;
      assert.ok(Math.abs(average - center) < 0.0001);
    }
  }
}

function testExplicitSlotsAllowHandcraftedEncounterPlacement() {
  const members = [
    { enemyId: 1, row: "front", slot: 3 },
    { enemyId: 1, row: "front", slot: 0 },
    { enemyId: 1, row: "back", slot: 2 },
    { enemyId: 1, row: "back", slot: 1 },
  ];
  const { manager } = loadFormationManager(members);
  const positions = members.map((_member, index) => manager.enemyPosition(index));

  assert.equal(positions[0].y > positions[1].y, true);
  assert.equal(positions[2].y > positions[3].y, true);
  assert.equal(positions[0].x < positions[2].x, true);
}

function testEnemyPositionsRemainStableAfterDeaths() {
  const encounters = readData("Encounters.json");
  const members = encounters[5].members;
  const { manager, enemies } = loadFormationManager(members);
  const before = members.map((_member, index) => manager.enemyPosition(index));

  enemies[1].alive = false;
  enemies[5].alive = false;

  const after = members.map((_member, index) => manager.enemyPosition(index));
  assert.deepEqual(after, before);
}

function testPincerRowsAreRelativeToPartyOnEachFlank() {
  const encounters = readData("Encounters.json");
  const encounter = encounters[6];
  const { manager } = loadFormationManager(encounter.members, "pincer");
  const partyX = manager.partyPosition(0).x;
  const findIndex = (side, row) =>
    encounter.members.findIndex(
      (member) => member.side === side && member.row === row,
    );

  const leftFront = manager.enemyPosition(findIndex("left", "front"));
  const leftBack = manager.enemyPosition(findIndex("left", "back"));
  const rightFront = manager.enemyPosition(findIndex("right", "front"));
  const rightBack = manager.enemyPosition(findIndex("right", "back"));

  assert.equal(leftBack.x < leftFront.x, true);
  assert.equal(leftFront.x < partyX, true);
  assert.equal(rightFront.x > partyX, true);
  assert.equal(rightBack.x > rightFront.x, true);
}

function testRowSchemaValidationCatchesAmbiguousAndInvalidLayouts() {
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
      name: "Too Many",
      canEscape: true,
      formation: "normal",
      members: Array.from({ length: 9 }, () => ({ enemyId: 1, row: "front" })),
    },
    {
      id: 2,
      name: "Overfull Row",
      canEscape: true,
      formation: "normal",
      members: Array.from({ length: 5 }, () => ({ enemyId: 1, row: "front" })),
    },
    {
      id: 3,
      name: "Mixed Row Mode",
      canEscape: true,
      formation: "normal",
      members: [
        { enemyId: 1, row: "front", slot: 1 },
        { enemyId: 1, row: "front" },
      ],
    },
    {
      id: 4,
      name: "Duplicate Slot",
      canEscape: true,
      formation: "normal",
      members: [
        { enemyId: 1, row: "back", slot: 2 },
        { enemyId: 1, row: "back", slot: 2 },
      ],
    },
    {
      id: 5,
      name: "Bad Values",
      canEscape: true,
      formation: "normal",
      members: [{ enemyId: 1, row: "middle", slot: 4 }],
    },
  ];
  const errors = [];

  context.__Validator.validateEncounters(encounters, enemies, errors);

  assert.equal(errors.some((error) => error.includes("at most 8 enemy members")), true);
  assert.equal(errors.some((error) => error.includes("front row may contain at most 4 enemies")), true);
  assert.equal(errors.some((error) => error.includes("all explicit slots or all automatic centering")), true);
  assert.equal(errors.some((error) => error.includes("back row slot 2 more than once")), true);
  assert.equal(errors.some((error) => error.includes("row must be front or back")), true);
  assert.equal(errors.some((error) => error.includes("slot must be an integer from 0 to 3")), true);
}

function testCanonicalMapExposesRowPlaytestEncounters() {
  const map = readData("Map001.json");
  const battleIds = map.events.flatMap((event) =>
    (event.pages || []).flatMap((page) =>
      (page.commands || [])
        .filter((command) => command.code === "battle")
        .map((command) => command.encounterId),
    ),
  );

  assert.equal(battleIds.includes(5), true);
  assert.equal(battleIds.includes(6), true);
}

function run() {
  testCanonicalEightEnemyRowsAreAutoCentered();
  testAutomaticRowsCenterOneTwoAndThreeMembers();
  testExplicitSlotsAllowHandcraftedEncounterPlacement();
  testEnemyPositionsRemainStableAfterDeaths();
  testPincerRowsAreRelativeToPartyOnEachFlank();
  testRowSchemaValidationCatchesAmbiguousAndInvalidLayouts();
  testCanonicalMapExposesRowPlaytestEncounters();

  console.log("Enemy formation row regression tests passed.");
}

run();
