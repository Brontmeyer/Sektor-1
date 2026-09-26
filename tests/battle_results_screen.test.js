"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");

const defaultActionCodes = {
  up: ["KeyW", "ArrowUp"],
  down: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  confirm: ["KeyE", "Enter"],
  cancel: ["KeyQ", "Escape"],
  menu: ["Escape"],
  interact: ["KeyE"],
  help: ["KeyH"],
  scope: ["KeyR"],
};

function actionTriggered(triggered, action) {
  return (defaultActionCodes[action] || []).some((code) => triggered.has(code));
}

function actionLabel(action) {
  const labels = {
    up: "W / ↑", down: "S / ↓", left: "A / ←", right: "D / →",
    confirm: "E / Enter", cancel: "Q / Esc", menu: "Esc",
    interact: "E", help: "H", scope: "R",
  };
  return labels[action] || action;
}

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

  return { classes: context.__loadedClasses, context };
}

function sampleResult() {
  return {
    outcome: "victory",
    encounter: { id: 1, name: "Test Slime Pair" },
    rewards: {
      exp: 100,
      currency: 20,
      resonance: 10,
      drops: [{ itemId: 1, name: "Potion", quantity: 2 }],
    },
    party: [
      {
        actorId: 1,
        name: "Tyler",
        expGained: 100,
        levelBefore: 2,
        levelAfter: 3,
        levelsGained: 1,
        wasDefeated: false,
        essenceRewards: [
          {
            essenceId: 1,
            name: "Ember Essence",
            gained: 5,
            oldResonance: 1495,
            newResonance: 1500,
            oldLevel: 3,
            newLevel: 4,
            leveledUp: true,
            becameMasteryReady: true,
            awakenedMagick: [{ id: 47, name: "Meteor Barrage" }],
          },
        ],
      },
      {
        actorId: 2,
        name: "Sarah",
        expGained: 100,
        levelBefore: 2,
        levelAfter: 2,
        levelsGained: 0,
        wasDefeated: true,
        essenceRewards: [],
      },
    ],
  };
}

function createResultsWindow() {
  const triggered = new Set();
  const { classes } = loadClasses(
    [
      "js/windows/Window_ListViewport.js",
      "js/windows/Window_BattleResults.js",
    ],
    "({ Window_ListViewport, Window_BattleResults })",
    {
      Graphics: {
        width: 1240,
        height: 720,
        context: {},
      },
      Input: {
        isTriggered(code) {
          return triggered.has(code);
        },
        isActionTriggered(action) {
          return actionTriggered(triggered, action);
        },
        actionLabel,
      },
    },
  );

  return {
    window: new classes.Window_BattleResults(),
    triggered,
  };
}

function testVictoryResultsSplitProgressionFromRunesAndDrops() {
  const { window } = createResultsWindow();
  const result = sampleResult();

  assert.equal(window.show(result), true);
  assert.equal(window.isOpen(), true);
  assert.equal(window.pageIndex, 0);
  assert.equal(window.pageTitle(), "EXP & RESONANCE");

  const progression = window.lines.map((line) => line.text).join("\n");

  assert.equal(progression.includes("Potion ×2"), false);
  assert.equal(progression.includes("Tyler   +100 EXP"), true);
  assert.equal(progression.includes("Level 2 → 3!"), true);
  assert.equal(progression.includes("Ember Essence +5 Resonance (1500/1500)"), true);
  assert.equal(progression.includes("Essence Level 3 → 4!"), true);
  assert.equal(progression.includes("Awakened: Meteor Barrage"), true);
  assert.equal(progression.includes("Ember Essence is MASTERY READY!"), true);
  assert.equal(
    progression.includes("Defeated in battle — EXP awarded, no Essence Resonance"),
    true,
  );

  assert.equal(window.advancePage(), true);
  assert.equal(window.pageIndex, 1);
  assert.equal(window.pageTitle(), "RUNES & ITEMS");
  assert.equal(window.isFinalPage(), true);
  assert.equal(window.lines.map((line) => line.text).join("\n").includes("Potion ×2"), true);
  assert.equal(window.advancePage(), false);
}

function testResultsWindowRejectsNonVictoryAndScrollsOverflow() {
  const { window, triggered } = createResultsWindow();

  assert.equal(window.show({ outcome: "defeat" }), false);
  assert.equal(window.isOpen(), false);

  const result = sampleResult();
  result.party = Array.from({ length: 10 }, (_, index) => ({
    actorId: index + 1,
    name: `Actor ${index + 1}`,
    expGained: 10,
    levelBefore: 1,
    levelAfter: 1,
    wasDefeated: false,
    essenceRewards: [],
  }));

  window.show(result);
  triggered.add("ArrowDown");

  for (let index = 0; index < 20; index++) {
    window.update();
  }

  assert.equal(window.scrollIndex > 0, true);
  assert.equal(window.viewport.offset > 0, true);
}

function testVictorySceneFinalizesOnceBeforeExit() {
  let finalizeCount = 0;
  let showCount = 0;
  let open = false;
  const result = sampleResult();

  class Scene_Base {}
  class BattleManager {
    static OUTCOME_VICTORY = "victory";
  }

  const { classes } = loadClasses(
    ["js/scenes/Scene_Battle.js"],
    "({ Scene_Battle })",
    { Scene_Base, BattleManager },
  );
  const Scene_Battle = classes.Scene_Battle;
  const scene = {
    outcome: "victory",
    result: null,
    battleManager: {
      finalizeBattle() {
        finalizeCount++;
        return result;
      },
    },
    resultsWindow: {
      isOpen() {
        return open;
      },
      show(received) {
        assert.equal(received, result);
        showCount++;
        open = true;
      },
    },
  };

  assert.equal(Scene_Battle.prototype.prepareBattleResults.call(scene), result);
  assert.equal(Scene_Battle.prototype.prepareBattleResults.call(scene), result);
  assert.equal(finalizeCount, 1);
  assert.equal(showCount, 1);
}

function testVictoryUpdatePresentsResultsBeforeContinue() {
  let prepareCount = 0;
  let resultUpdateCount = 0;
  let finishCount = 0;
  let confirm = false;
  let pageAdvanceCount = 0;

  class Scene_Base {}
  class BattleManager {
    static OUTCOME_VICTORY = "victory";
  }

  const { classes } = loadClasses(
    ["js/scenes/Scene_Battle.js"],
    "({ Scene_Battle })",
    {
      Scene_Base,
      BattleManager,
      Input: {
        isTriggered(code) {
          return confirm && code === "Enter";
        },
        isActionTriggered(action) {
          return confirm && action === "confirm";
        },
        actionLabel,
      },
    },
  );
  const Scene_Battle = classes.Scene_Battle;
  const scene = {
    outcome: "victory",
    updateBattleTime() {},
    updateBattlerStates() {},
    updateActionPhase() {},
    updateBattlerVisuals() {},
    updateBattleAnimations() {},
    updateBattleEffect() {},
    updateBattlePopups() {},
    updatePendingEnemyTurn() {},
    prepareBattleResults() {
      prepareCount++;
    },
    resultsWindow: {
      update() {
        resultUpdateCount++;
      },
      advancePage() {
        pageAdvanceCount++;
        return pageAdvanceCount === 1;
      },
    },
    finishBattle() {
      finishCount++;
    },
  };

  Scene_Battle.prototype.update.call(scene, 1 / 60);
  assert.equal(prepareCount, 1);
  assert.equal(resultUpdateCount, 1);
  assert.equal(finishCount, 0);

  confirm = true;
  Scene_Battle.prototype.update.call(scene, 1 / 60);
  assert.equal(prepareCount, 2);
  assert.equal(resultUpdateCount, 2);
  assert.equal(pageAdvanceCount, 1);
  assert.equal(finishCount, 0, "first confirmation advances to the Runes / Items page");

  Scene_Battle.prototype.update.call(scene, 1 / 60);
  assert.equal(prepareCount, 3);
  assert.equal(resultUpdateCount, 3);
  assert.equal(pageAdvanceCount, 2);
  assert.equal(finishCount, 1, "second confirmation exits the victory results");
}

function testSceneDrawsResultsAfterBattleRenderer() {
  const calls = [];
  class Scene_Base {}
  class BattleManager {
    static OUTCOME_VICTORY = "victory";
  }
  const { classes } = loadClasses(
    ["js/scenes/Scene_Battle.js"],
    "({ Scene_Battle })",
    { Scene_Base, BattleManager },
  );
  const Scene_Battle = classes.Scene_Battle;

  Scene_Battle.prototype.draw.call({
    renderer: { draw: () => calls.push("battle") },
    resultsWindow: { draw: () => calls.push("results") },
  });

  assert.deepEqual(calls, ["battle", "results"]);
}

function testResultsWindowLoadsBeforeBattleScene() {
  const indexSource = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
  const resultsIndex = indexSource.indexOf("Window_BattleResults.js");
  const sceneIndex = indexSource.indexOf("Scene_Battle.js");

  assert.equal(resultsIndex >= 0, true);
  assert.equal(sceneIndex >= 0, true);
  assert.equal(resultsIndex < sceneIndex, true);
}

function run() {
  testVictoryResultsSplitProgressionFromRunesAndDrops();
  testResultsWindowRejectsNonVictoryAndScrollsOverflow();
  testVictorySceneFinalizesOnceBeforeExit();
  testVictoryUpdatePresentsResultsBeforeContinue();
  testSceneDrawsResultsAfterBattleRenderer();
  testResultsWindowLoadsBeforeBattleScene();

  console.log("Battle results screen regression tests passed.");
}

run();
