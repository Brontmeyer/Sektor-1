"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

function loadClass(relativePath, className, globals = {}) {
  const context = vm.createContext({ console, ...globals });
  vm.runInContext(
    `${read(relativePath)}\nglobalThis.__Class = ${className};`,
    context,
  );
  return context.__Class;
}

function createFormationFixture(formation = "normal") {
  const actors = Array.from({ length: 4 }, (_, index) => ({
    actorId: index + 1,
    name: `Actor ${index + 1}`,
    battleSpriteWidth: 190,
    battleSpriteHeight: 166,
  }));
  const rows = new Map(actors.map((actor) => [actor.actorId, "front"]));
  const formationOrder = [...actors];
  const Graphics = { width: 1600, height: 900 };
  const party = {
    battleMembers: () => actors,
    battleMemberIndex(actor) {
      return actors.indexOf(actor);
    },
    battleFormationIndex(actor) {
      return formationOrder.indexOf(actor);
    },
    battleRow(actor) {
      return rows.get(actor.actorId) || "front";
    },
    setBattleRow(actor, row) {
      rows.set(actor.actorId, row);
      return true;
    },
  };
  const BattleFormationManager = loadClass(
    "js/battle/BattleFormationManager.js",
    "BattleFormationManager",
    { Graphics, $gameParty: party },
  );
  const enemy = {
    enemyId: 1,
    name: "Enemy",
    battleSpriteWidth: 128,
    battleSpriteHeight: 96,
  };
  const turnedActors = new Set();
  const scene = {
    encounter: {
      formation,
      members: formation === "pincer"
        ? [
            { enemyId: 1, side: "left", row: "front", slot: 0 },
            { enemyId: 1, side: "right", row: "front", slot: 0 },
          ]
        : [{ enemyId: 1, row: "front", slot: 0 }],
    },
    enemies: formation === "pincer" ? [enemy, { ...enemy }] : [enemy],
    pendingAttackTarget: null,
    selectingEnemyTarget: false,
    actionPhase: "none",
    partyController: { currentBattler: () => actors[0] },
    targetManager: { getSelectedTarget: () => null },
    hasActorTurnedInBackAttack(actor) {
      return turnedActors.has(actor);
    },
  };
  const manager = new BattleFormationManager(scene);

  return {
    actors,
    rows,
    formationOrder,
    Graphics,
    party,
    scene,
    manager,
  };
}

function testNormalAndBackAttackRowsChangeOnlyVisualX() {
  for (const formation of ["normal", "backAttack"]) {
    const { actors, party, manager } = createFormationFixture(formation);
    const actor = actors[0];
    const frontVisual = manager.positionForActor(actor);
    const frontTarget = manager.targetPositionForActor(actor);

    party.setBattleRow(actor, "back");
    const backVisual = manager.positionForActor(actor);
    const backTarget = manager.targetPositionForActor(actor);

    assert.equal(frontVisual.x, frontTarget.x);
    assert.equal(backVisual.x < frontVisual.x, true);
    assert.equal(backVisual.y, frontVisual.y);
    assert.deepEqual(backTarget, frontTarget);
  }
}

function testPincerRowsUseStableMechanicalFlanks() {
  const { actors, party, manager, formationOrder, Graphics, scene } =
    createFormationFixture("pincer");
  const leftActor = actors[0];
  const rightActor = actors[1];
  const centerX = Graphics.width * 0.5;

  assert.equal(manager.positionForActor(leftActor).x < centerX, true);
  assert.equal(manager.positionForActor(rightActor).x > centerX, true);

  party.setBattleRow(leftActor, "back");
  party.setBattleRow(rightActor, "back");
  assert.equal(manager.positionForActor(leftActor).x, centerX);
  assert.equal(manager.positionForActor(rightActor).x, centerX);

  party.setBattleRow(leftActor, "front");
  party.setBattleRow(rightActor, "front");
  const leftX = manager.positionForActor(leftActor).x;
  const rightX = manager.positionForActor(rightActor).x;

  scene.selectingEnemyTarget = true;
  scene.targetManager.getSelectedTarget = () => scene.enemies[1];
  assert.equal(manager.actorFacing(leftActor), 1);
  assert.equal(manager.positionForActor(leftActor).x, leftX);

  [formationOrder[0], formationOrder[1]] = [formationOrder[1], formationOrder[0]];
  assert.equal(manager.positionForActor(leftActor).x, leftX);
  assert.equal(manager.positionForActor(rightActor).x, rightX);
  assert.equal(
    manager.positionForActor(leftActor).y > manager.positionForActor(rightActor).y,
    true,
  );
}

function testRowDoesNotChangeRearDamageRules() {
  const { actors, party, manager, scene } = createFormationFixture("backAttack");
  const actor = actors[0];
  const enemy = scene.enemies[0];

  const frontMultiplier = manager.physicalRearDamageMultiplier(enemy, actor);
  party.setBattleRow(actor, "back");
  const backMultiplier = manager.physicalRearDamageMultiplier(enemy, actor);

  assert.equal(frontMultiplier, 1.5);
  assert.equal(backMultiplier, frontMultiplier);
}

function testPartyControllerUsesVisualRowPosition() {
  const actor = { actorId: 1 };
  const visualPosition = { x: 222, y: 333 };
  const party = {
    battleFormationIndex: () => 0,
    battleMemberIndex: () => 0,
    livingBattleMembers: () => [actor],
    battleMembers: () => [actor],
  };
  const BattlePartyController = loadClass(
    "js/battle/BattlePartyController.js",
    "BattlePartyController",
    { Graphics: { height: 900 }, $gameParty: party },
  );
  const scene = {
    formationManager: {
      positionForActor(battler) {
        assert.equal(battler, actor);
        return visualPosition;
      },
    },
  };
  const controller = new BattlePartyController(scene);

  assert.deepEqual(controller.positionForBattler(actor), visualPosition);
}

function testTargetingUsesRowNeutralPartyGeometry() {
  const allies = [
    {
      name: "Visual Front",
      side: "ally",
      x: 850,
      y: 300,
      targetX: 500,
      targetY: 100,
      isAlive: () => true,
    },
    {
      name: "Neutral Closest",
      side: "ally",
      x: 300,
      y: 300,
      targetX: 500,
      targetY: 300,
      isAlive: () => true,
    },
  ];
  const enemy = {
    name: "Enemy",
    side: "enemy",
    x: 900,
    y: 300,
    isAlive: () => true,
  };
  const gameParty = { battleMembers: () => allies };
  const BattleTargetManager = loadClass(
    "js/battle/BattleTargetManager.js",
    "BattleTargetManager",
    { $gameParty: gameParty },
  );
  const definition = {
    id: 1,
    name: "Test",
    type: "magick",
    target: ["ally"],
    scope: ["single"],
  };
  allies[0].isValidMagickTarget = () => true;
  allies[1].isValidMagickTarget = () => true;
  const scene = {
    enemies: [enemy],
    pendingMagick: definition,
    pendingSkill: null,
    enemyTargetAction: "magick",
    targetGroup: "ally",
    targetScope: "single",
    selectedEnemyIndex: 0,
    selectedAllyIndex: 0,
    partyController: { currentBattler: () => allies[0] },
    getFormationType: () => "normal",
    getAllyPosition: (target) => ({ x: target.x, y: target.y }),
    getAllyTargetPosition: (target) => ({
      x: target.targetX,
      y: target.targetY,
    }),
    getEnemyPosition: (target) => ({ x: target.x, y: target.y }),
    formationManager: {
      formation: () => "normal",
      memberSide: () => "right",
    },
  };
  const manager = new BattleTargetManager(scene);
  scene.targetManager = manager;

  assert.deepEqual(
    manager.targetPosition("ally", allies[0]),
    { x: 500, y: 100 },
  );
  assert.equal(manager.selectFrontSelectableAlly(definition), allies[1]);
  assert.equal(scene.selectedAllyIndex, 1);
}

function testSceneExposesSeparateVisualAndTargetPositions() {
  const scene = read("js/scenes/Scene_Battle.js");
  const manager = read("js/battle/BattleFormationManager.js");
  const targeting = read("js/battle/BattleTargetManager.js");

  assert.match(scene, /getAllyPosition\(actor\)/);
  assert.match(scene, /getAllyTargetPosition\(actor\)/);
  assert.match(manager, /targetPositionForActor\(actor\)/);
  assert.match(manager, /partyVisualX\(actor\)/);
  assert.match(targeting, /getAllyTargetPosition/);
}

function run() {
  testNormalAndBackAttackRowsChangeOnlyVisualX();
  testPincerRowsUseStableMechanicalFlanks();
  testRowDoesNotChangeRearDamageRules();
  testPartyControllerUsesVisualRowPosition();
  testTargetingUsesRowNeutralPartyGeometry();
  testSceneExposesSeparateVisualAndTargetPositions();

  console.log("Player battle row geometry regression tests passed.");
}

run();
