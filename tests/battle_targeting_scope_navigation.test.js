"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");

function loadTargetManager(gameParty) {
  const source = fs.readFileSync(
    path.join(projectRoot, "js/battle/BattleTargetManager.js"),
    "utf8",
  );
  const context = vm.createContext({ console, $gameParty: gameParty });

  vm.runInContext(
    `${source}\nglobalThis.__BattleTargetManager = BattleTargetManager;`,
    context,
  );

  return context.__BattleTargetManager;
}

function battler(name, side, x, y, flank = null) {
  return {
    name,
    side,
    x,
    y,
    flank,
    isAlive: () => true,
  };
}

function createFixture({
  formation = "normal",
  allies = [],
  enemies = [],
  definition = null,
  selectedEnemyIndex = 0,
  selectedAllyIndex = 0,
  targetGroup = "enemy",
  targetScope = "single",
  action = "magick",
} = {}) {
  const gameParty = {
    battleMembers() {
      return allies;
    },
  };
  const BattleTargetManager = loadTargetManager(gameParty);
  const caster = allies[0] || battler("Caster", "ally", 500, 300);

  caster.isValidMagickTarget = (ability, target) =>
    ability.target.includes(target.side);
  caster.isValidSkillTarget = (ability, target) =>
    ability.target.includes(target.side);

  const scene = {
    enemies,
    pendingMagick: action === "magick" ? definition : null,
    pendingSkill: action === "skill" ? definition : null,
    enemyTargetAction: action,
    targetGroup,
    targetScope,
    selectedEnemyIndex,
    selectedAllyIndex,
    partyController: { currentBattler: () => caster },
    getFormationType: () => formation,
    getAllyPosition: (target) => ({ x: target.x, y: target.y }),
    getEnemyPosition: (target) => ({ x: target.x, y: target.y }),
    formationManager: {
      formation: () => formation,
      memberSide(index) {
        return enemies[index]?.flank || "right";
      },
    },
  };

  scene.targetManager = new BattleTargetManager(scene);
  return { scene, manager: scene.targetManager, caster };
}

function dualEnemyMagick() {
  return {
    id: 10,
    name: "Test Burst",
    type: "magick",
    target: ["enemy"],
    scope: ["single", "all"],
  };
}

function testDualScopeCollapsesToSingleWithOneEnemy() {
  const enemy = battler("Solo", "enemy", 900, 240);
  const { scene, manager } = createFixture({
    enemies: [enemy],
    definition: dualEnemyMagick(),
  });

  assert.deepEqual(Array.from(manager.effectiveAllowedScopes()), ["single"]);
  assert.equal(manager.toggleScope(), "single");
  assert.equal(scene.targetScope, "single");
}

function testDualScopeAllowsAllWithMultipleEnemies() {
  const enemies = [
    battler("A", "enemy", 900, 180),
    battler("B", "enemy", 900, 320),
  ];
  const { scene, manager } = createFixture({
    enemies,
    definition: dualEnemyMagick(),
  });

  assert.deepEqual(Array.from(manager.effectiveAllowedScopes()), [
    "single",
    "all",
  ]);
  assert.equal(manager.toggleScope(), "all");
  assert.equal(scene.targetScope, "all");
  assert.deepEqual(Array.from(manager.getCurrentTargets()), enemies);
}

function testAllOnlyAbilityRemainsAllWithOneTarget() {
  const enemy = battler("Solo", "enemy", 900, 240);
  const definition = {
    id: 54,
    name: "Test Nova",
    type: "magick",
    target: ["enemy"],
    scope: ["all"],
  };
  const { scene, manager } = createFixture({
    enemies: [enemy],
    definition,
    targetScope: "all",
  });

  assert.deepEqual(Array.from(manager.effectiveAllowedScopes()), ["all"]);
  assert.equal(manager.normalizeScope(), "all");
  assert.deepEqual(Array.from(manager.getCurrentTargets()), [enemy]);
  assert.equal(scene.targetScope, "all");
}

function testPincerSingleTargetMovesAcrossBothFlanksSpatially() {
  const enemies = [
    battler("L1", "enemy", 120, 180, "left"),
    battler("L2", "enemy", 120, 340, "left"),
    battler("R1", "enemy", 900, 180, "right"),
    battler("R2", "enemy", 900, 340, "right"),
  ];
  const { scene, manager } = createFixture({
    formation: "pincer",
    enemies,
    definition: dualEnemyMagick(),
    selectedEnemyIndex: 2,
  });

  assert.equal(manager.getSelectedEnemy(), enemies[2]);
  assert.equal(manager.moveDirectionalSelection(-1, 0), true);
  assert.equal(manager.getSelectedEnemy(), enemies[0]);
  assert.equal(scene.targetGroup, "enemy");

  assert.equal(manager.moveDirectionalSelection(0, 1), true);
  assert.equal(manager.getSelectedEnemy(), enemies[1]);

  assert.equal(manager.moveDirectionalSelection(1, 0), true);
  assert.equal(manager.getSelectedEnemy(), enemies[3]);

  assert.equal(manager.moveDirectionalSelection(0, 1), false);
  assert.equal(manager.getSelectedEnemy(), enemies[3]);
}

function testFiveEnemyNavigationDoesNotWrapOffscreen() {
  const enemies = Array.from({ length: 5 }, (_, index) =>
    battler(`Enemy ${index + 1}`, "enemy", 900, 100 + index * 100),
  );
  const { manager } = createFixture({
    enemies,
    definition: dualEnemyMagick(),
    selectedEnemyIndex: 2,
  });

  assert.equal(manager.moveDirectionalSelection(0, -1), true);
  assert.equal(manager.getSelectedEnemy(), enemies[1]);
  assert.equal(manager.moveDirectionalSelection(0, -1), true);
  assert.equal(manager.getSelectedEnemy(), enemies[0]);
  assert.equal(manager.moveDirectionalSelection(0, -1), false);
  assert.equal(manager.getSelectedEnemy(), enemies[0]);

  assert.equal(manager.moveDirectionalSelection(0, 1), true);
  assert.equal(manager.getSelectedEnemy(), enemies[1]);
}

function testPincerAllTargetsOnlySelectedFlankAndCanSwitchFlanks() {
  const enemies = [
    battler("L1", "enemy", 120, 180, "left"),
    battler("L2", "enemy", 120, 340, "left"),
    battler("R1", "enemy", 900, 180, "right"),
    battler("R2", "enemy", 900, 340, "right"),
  ];
  const { scene, manager } = createFixture({
    formation: "pincer",
    enemies,
    definition: dualEnemyMagick(),
    selectedEnemyIndex: 2,
  });

  assert.equal(manager.toggleScope(), "all");
  assert.deepEqual(Array.from(manager.getCurrentTargets()), enemies.slice(2));
  assert.equal(manager.selectedEnemyFlank(), "right");

  assert.equal(manager.moveTargetBucket(-1, 0), true);
  assert.equal(scene.targetScope, "all");
  assert.equal(manager.selectedEnemyFlank(), "left");
  assert.deepEqual(Array.from(manager.getCurrentTargets()), enemies.slice(0, 2));

  assert.equal(manager.moveTargetBucket(-1, 0), false);
  assert.deepEqual(Array.from(manager.getCurrentTargets()), enemies.slice(0, 2));

  assert.equal(manager.moveTargetBucket(1, 0), true);
  assert.equal(manager.selectedEnemyFlank(), "right");
}

function testPincerDualScopeDoesNotOfferAllForSingleEnemyFlank() {
  const enemies = [
    battler("Left", "enemy", 120, 240, "left"),
    battler("Right", "enemy", 900, 240, "right"),
  ];
  const { manager } = createFixture({
    formation: "pincer",
    enemies,
    definition: dualEnemyMagick(),
    selectedEnemyIndex: 1,
  });

  assert.deepEqual(Array.from(manager.effectiveAllowedScopes()), ["single"]);
  assert.equal(manager.toggleScope(), "single");
}

function testAlliedSingleAllScopeUsesWholePartyBucket() {
  const allies = [
    battler("A1", "ally", 480, 140),
    battler("A2", "ally", 480, 240),
    battler("A3", "ally", 480, 340),
    battler("A4", "ally", 480, 440),
  ];
  const definition = {
    id: 1,
    name: "Test Mend",
    type: "magick",
    target: ["ally"],
    scope: ["single", "all"],
  };
  const { scene, manager } = createFixture({
    allies,
    definition,
    targetGroup: "ally",
  });

  assert.equal(manager.toggleScope(), "all");
  assert.equal(scene.targetScope, "all");
  assert.deepEqual(Array.from(manager.getCurrentTargets()), allies);
}

function testSceneAndRendererUseSharedTargetingContract() {
  const sceneSource = fs.readFileSync(
    path.join(projectRoot, "js/scenes/Scene_Battle.js"),
    "utf8",
  );
  const rendererSource = fs.readFileSync(
    path.join(projectRoot, "js/battle/BattleRenderer.js"),
    "utf8",
  );

  assert.match(sceneSource, /moveDirectionalSelection\(dx, dy, definition\)/);
  assert.match(sceneSource, /moveTargetBucket\(dx, dy, definition\)/);
  assert.match(rendererSource, /effectiveAllowedScopes\(definition\)/);
  assert.match(rendererSource, /targetManager\.getCurrentTargets\(\)/);
}

function run() {
  testDualScopeCollapsesToSingleWithOneEnemy();
  testDualScopeAllowsAllWithMultipleEnemies();
  testAllOnlyAbilityRemainsAllWithOneTarget();
  testPincerSingleTargetMovesAcrossBothFlanksSpatially();
  testFiveEnemyNavigationDoesNotWrapOffscreen();
  testPincerAllTargetsOnlySelectedFlankAndCanSwitchFlanks();
  testPincerDualScopeDoesNotOfferAllForSingleEnemyFlank();
  testAlliedSingleAllScopeUsesWholePartyBucket();
  testSceneAndRendererUseSharedTargetingContract();

  console.log("Battle targeting and scope navigation regression tests passed.");
}

run();
