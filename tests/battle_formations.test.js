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

function loadClass(relativePath, className, globals = {}) {
  const context = vm.createContext({ console, ...globals });
  vm.runInContext(
    `${read(relativePath)}\nglobalThis.__Class = ${className};`,
    context,
  );
  return { Class: context.__Class, context };
}

function createFormationFixture(formation, members) {
  const actors = Array.from({ length: 4 }, (_, index) => ({
    actorId: index + 1,
    name: `Actor ${index + 1}`,
    battleSpriteWidth: 190,
    battleSpriteHeight: 166,
  }));
  const enemies = members.map((member, index) => ({
    enemyId: member.enemyId,
    name: `Enemy ${index + 1}`,
    battleSpriteWidth: 128,
    battleSpriteHeight: 96,
  }));
  const Graphics = { width: 1600, height: 900 };
  const party = {
    battleMembers: () => actors,
    battleMemberIndex(actor) {
      return actors.indexOf(actor);
    },
  };
  const { Class: BattleFormationManager } = loadClass(
    "js/battle/BattleFormationManager.js",
    "BattleFormationManager",
    { Graphics, $gameParty: party },
  );
  const scene = {
    encounter: { formation, members },
    enemies,
    pendingAttackTarget: null,
    selectingEnemyTarget: false,
    partyController: { currentBattler: () => actors[0] },
    targetManager: { getSelectedTarget: () => null },
  };
  const manager = new BattleFormationManager(scene);

  return { manager, scene, actors, enemies, Graphics };
}

function testCanonicalEncounterFormationData() {
  const encounters = readData("Encounters.json");

  assert.equal(encounters[1].formation, "normal");
  assert.equal(encounters[2].formation, "normal");
  assert.equal(encounters[3].formation, "backAttack");
  assert.equal(encounters[4].formation, "pincer");
  assert.deepEqual(
    encounters[4].members.map((member) => `${member.side}:${member.slot}`),
    ["left:0", "left:1", "right:0", "right:1"],
  );
}

function testNormalFormationUsesFourVerticalPartyLanesAndSafeScale() {
  const { manager, actors } = createFormationFixture("normal", [
    { enemyId: 1, slot: 0 },
    { enemyId: 1, slot: 1 },
  ]);
  const positions = actors.map((_actor, index) => manager.partyPosition(index));

  assert.equal(new Set(positions.map((position) => position.x)).size, 1);
  assert.equal(positions[0].x < manager.enemyPosition(0).x, true);
  assert.equal(positions.every((position, index) => index === 0 || position.y > positions[index - 1].y), true);
  assert.equal(manager.partyScale() < 1, true);
  assert.equal(manager.partyScale() >= 0.35, true);
  assert.equal(manager.actorFacing(actors[0]), 1);
  assert.equal(manager.enemyFacing(manager.scene.enemies[0]), 1);
}

function testBackAttackMirrorsSidesAndFacing() {
  const { manager, actors, enemies } = createFormationFixture("backAttack", [
    { enemyId: 1, slot: 0 },
    { enemyId: 1, slot: 1 },
  ]);

  assert.equal(manager.partyPosition(0).x > manager.enemyPosition(0).x, true);
  assert.equal(manager.actorFacing(actors[0]), -1);
  assert.equal(manager.enemyFacing(enemies[0]), -1);
  assert.equal(manager.actorAdvanceDirection(actors[0]), -1);
  assert.equal(manager.enemyAdvanceDirection(enemies[0]), 1);
}

function testPincerPlacesEnemiesOnBothSidesOfCenteredParty() {
  const { manager, scene, actors, enemies, Graphics } = createFormationFixture(
    "pincer",
    [
      { enemyId: 1, slot: 0, side: "left" },
      { enemyId: 1, slot: 1, side: "left" },
      { enemyId: 1, slot: 0, side: "right" },
      { enemyId: 1, slot: 1, side: "right" },
    ],
  );

  assert.equal(manager.partyPosition(0).x, Graphics.width * 0.5);
  assert.equal(manager.enemyPosition(0).x < manager.partyPosition(0).x, true);
  assert.equal(manager.enemyPosition(2).x > manager.partyPosition(0).x, true);
  assert.equal(manager.enemyFacing(enemies[0]), -1);
  assert.equal(manager.enemyFacing(enemies[2]), 1);

  // Idle pincer actors split their facing so the vertical formation covers both flanks.
  assert.equal(manager.actorFacing(actors[0]), -1);
  assert.equal(manager.actorFacing(actors[1]), 1);

  // The active actor turns toward the side currently being targeted.
  scene.selectingEnemyTarget = true;
  scene.targetManager.getSelectedTarget = () => enemies[2];
  assert.equal(manager.actorFacing(actors[0]), 1);
  scene.targetManager.getSelectedTarget = () => enemies[0];
  assert.equal(manager.actorFacing(actors[0]), -1);
}

function testFormationSchemaValidation() {
  const { Class: DatabaseValidator } = loadClass(
    "js/core/DatabaseValidator.js",
    "DatabaseValidator",
  );
  const enemies = readData("Enemies.json");
  const errors = [];
  const encounters = [
    null,
    {
      id: 1,
      name: "Bad Formation",
      canEscape: true,
      formation: "ambushFromTheMoon",
      members: [{ enemyId: 1, slot: 0 }],
    },
    {
      id: 2,
      name: "Bad Pincer",
      canEscape: true,
      formation: "pincer",
      members: [
        { enemyId: 1, slot: 0, side: "left" },
        { enemyId: 1, slot: 0, side: "left" },
        { enemyId: 1, slot: 1 },
      ],
    },
    {
      id: 3,
      name: "Bad Normal Side",
      canEscape: true,
      formation: "normal",
      members: [{ enemyId: 1, slot: 0, side: "right" }],
    },
  ];

  DatabaseValidator.validateEncounters(encounters, enemies, errors);

  assert.equal(errors.some((error) => error.includes("formation must be normal")), true);
  assert.equal(errors.some((error) => error.includes("left slot 0 more than once")), true);
  assert.equal(errors.some((error) => error.includes("side must be left or right")), true);
  assert.equal(errors.some((error) => error.includes("side is only valid for a pincer")), true);
}

function testFormationManagerLoadsBeforeFormationConsumers() {
  const indexSource = read("index.html");
  const managerIndex = indexSource.indexOf("BattleFormationManager.js");
  const animationIndex = indexSource.indexOf("BattleAnimationController.js");
  const partyIndex = indexSource.indexOf("BattlePartyController.js");
  const sceneIndex = indexSource.indexOf("Scene_Battle.js");

  assert.equal(managerIndex >= 0, true);
  assert.equal(managerIndex < animationIndex, true);
  assert.equal(managerIndex < partyIndex, true);
  assert.equal(managerIndex < sceneIndex, true);
}

function testFormationAwareAnimationDirectionsRemainRuntimeSafe() {
  const actor = { name: "Actor" };
  const enemy = { name: "Enemy", isAlive: () => true };
  const actorData = {
    state: "idle",
    stateTimer: 0,
    animationFrame: 0,
    animationTimer: 0,
    visualX: 0,
    visualY: 0,
  };
  const enemyData = {
    state: "attack",
    stateTimer: 0,
    animationFrame: 0,
    animationTimer: 0,
    visualX: 0,
  };
  const { Class: BattleAnimationController } = loadClass(
    "js/battle/BattleAnimationController.js",
    "BattleAnimationController",
    {
      $gameParty: { battleMembers: () => [actor] },
      BattleManager: { TURN_COMMAND: "command" },
    },
  );
  const scene = {
    actionPhase: "lunge",
    actionPhaseTimer: 0,
    battleInputLocked: false,
    pendingEnemyTurn: false,
    victory: false,
    defeat: false,
    enemies: [enemy],
    enemyBattleData: [enemyData],
    partyController: { currentBattler: () => actor },
    getPartyBattleData: () => actorData,
    formationManager: {
      actorAdvanceDirection: () => -1,
      enemyAdvanceDirection: () => 1,
    },
    battleManager: { isTurnState: () => false },
    moveToward(_current, target) {
      return target;
    },
  };
  const controller = new BattleAnimationController(scene);

  assert.equal(controller.getActorTargetOffset(), -45);

  controller.updateEnemyVisual(enemy, enemyData, 1 / 60);
  assert.equal(enemyData.visualX, 35);

  scene.actionPhase = "none";
  assert.doesNotThrow(() => controller.updateBattlerStates(1 / 60));
}

function testRendererAndEffectsUseFormationAwareSpriteGeometry() {
  const rendererSource = read("js/battle/BattleRenderer.js");
  const effectsSource = read("js/battle/BattleEffects.js");
  const animationSource = read("js/battle/BattleAnimationController.js");

  assert.match(rendererSource, /getActorRenderScale/);
  assert.match(rendererSource, /getEnemyFormationScale/);
  assert.match(rendererSource, /getActorFacing/);
  assert.match(rendererSource, /getEnemyFacing/);
  assert.match(rendererSource, /getActorSpriteHeight/);
  assert.match(rendererSource, /getEnemySpriteHeight/);
  assert.match(effectsSource, /getActorSpriteHeight/);
  assert.match(effectsSource, /getEnemySpriteHeight/);
  assert.match(animationSource, /actorAdvanceDirection/);
  assert.match(animationSource, /enemyAdvanceDirection/);
}

function run() {
  testCanonicalEncounterFormationData();
  testNormalFormationUsesFourVerticalPartyLanesAndSafeScale();
  testBackAttackMirrorsSidesAndFacing();
  testPincerPlacesEnemiesOnBothSidesOfCenteredParty();
  testFormationSchemaValidation();
  testFormationManagerLoadsBeforeFormationConsumers();
  testFormationAwareAnimationDirectionsRemainRuntimeSafe();
  testRendererAndEffectsUseFormationAwareSpriteGeometry();

  console.log("Battle formation and party layout regression tests passed.");
}

run();
