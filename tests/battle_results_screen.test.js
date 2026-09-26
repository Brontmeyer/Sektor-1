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

function createDrawContext() {
  const calls = [];
  return {
    calls,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    font: "",
    textAlign: "",
    textBaseline: "",
    save() {},
    restore() {},
    fillRect(...args) { calls.push(["fillRect", ...args]); },
    strokeRect(...args) { calls.push(["strokeRect", ...args]); },
    fillText(...args) { calls.push(["fillText", ...args]); },
  };
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
    runesBefore: 80,
    runesAfter: 100,
    party: [
      {
        actorId: 1,
        name: "Tyler",
        expGained: 100,
        expBefore: 100,
        expAfter: 0,
        levelBefore: 2,
        levelAfter: 3,
        levelsGained: 1,
        wasDefeated: false,
        essenceRewards: [
          {
            essenceId: 1,
            name: "Ember Essence",
            gained: 10,
            oldResonance: 295,
            newResonance: 305,
            oldLevel: 2,
            newLevel: 3,
            leveledUp: true,
            becameMasteryReady: false,
            awakenedMagick: [{ id: 47, name: "Meteor Barrage" }],
          },
        ],
      },
      {
        actorId: 2,
        name: "Sarah",
        expGained: 100,
        expBefore: 0,
        expAfter: 100,
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
  const drawContext = createDrawContext();
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
        context: drawContext,
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
    drawContext,
  };
}

function runUntilComplete(window, maxSeconds = 10) {
  const step = 0.05;
  let elapsed = 0;
  while (!window.isComplete() && elapsed < maxSeconds) {
    window.update(step);
    elapsed += step;
  }
  assert.equal(window.isComplete(), true, "reward animation completes in bounded time");
}

function testVictoryResultsWaitForConfirmBeforeAnimatingExp() {
  const { window } = createResultsWindow();
  const result = sampleResult();

  assert.equal(window.show(result), true);
  assert.equal(window.isOpen(), true);
  assert.equal(window.pageIndex, 0);
  assert.equal(window.pageTitle(), "EXP & RESONANCE");
  assert.equal(window.pageState, "waiting");
  assert.equal(window.actorRows[0].visualLevel, 2);
  assert.equal(window.actorRows[0].visualExp, 100);

  window.update(2);
  assert.equal(window.actorRows[0].visualLevel, 2, "idle results do not animate themselves");
  assert.equal(window.actorRows[0].visualExp, 100);

  assert.equal(window.handleConfirm(), false);
  assert.equal(window.pageState, "animating");
  assert.equal(window.pageIndex, 0, "first confirm starts animation instead of changing pages");

  window.update(0.5);
  assert.equal(window.actorRows[0].visualExp > 100, true, "EXP bar advances in real time");
  assert.equal(window.actorRows[0].visualExp < 200, true, "EXP is not granted visually all at once");

  runUntilComplete(window);
  assert.equal(window.actorRows[0].visualLevel, 3);
  assert.equal(window.actorRows[0].visualExp, 0);
  assert.equal(window.actorRows[1].visualLevel, 2);
  assert.equal(window.actorRows[1].visualExp, 100);
  assert.equal(window.essencePopupQueue.length, 0, "Essence level-up callout is consumed during animation");
}

function testCompletedExpAdvancesToFrozenRunePageThenTicksTotal() {
  const { window } = createResultsWindow();
  window.show(sampleResult());
  window.handleConfirm();
  runUntilComplete(window);

  assert.equal(window.handleConfirm(), false);
  assert.equal(window.pageIndex, 1);
  assert.equal(window.pageTitle(), "RUNES & ITEMS");
  assert.equal(window.pageState, "waiting");
  assert.equal(window.visualRunes, 80);
  assert.equal(window.formatRunes(20), "20 R");
  assert.equal(window.lootLines[0].text, "Potion ×2");

  window.update(2);
  assert.equal(window.visualRunes, 80, "Rune total remains frozen until confirm");

  assert.equal(window.handleConfirm(), false);
  assert.equal(window.pageState, "animating");
  window.update(0.35);
  assert.equal(window.visualRunes > 80, true);
  assert.equal(window.visualRunes < 100, true, "Rune total counts upward rather than jumping");

  runUntilComplete(window);
  assert.equal(window.visualRunes, 100);
  assert.equal(window.handleConfirm(), true, "only completed final page requests battle exit");
}

function testResultsPresentationIsFullScreenAndOmitsEssenceProgressClutter() {
  const { window, drawContext } = createResultsWindow();
  window.show(sampleResult());
  window.draw();

  assert.equal(window.x, 8);
  assert.equal(window.y, 8);
  assert.equal(window.width, 1224);
  assert.equal(window.height, 704);

  const text = drawContext.calls
    .filter((call) => call[0] === "fillText")
    .map((call) => String(call[1]));

  assert.equal(text.includes("Gained EXP."), true);
  assert.equal(text.includes("Tyler"), true);
  assert.equal(text.includes("Sarah"), true);
  assert.equal(text.some((value) => value.includes("Ember Essence +")), false);
  assert.equal(text.some((value) => value.includes("Meteor Barrage")), false);
}

function testResultsWindowRejectsNonVictoryAndScrollsLootOverflow() {
  const { window, triggered } = createResultsWindow();

  assert.equal(window.show({ outcome: "defeat" }), false);
  assert.equal(window.isOpen(), false);

  const result = sampleResult();
  result.rewards.drops = Array.from({ length: 18 }, (_, index) => ({
    itemId: index + 1,
    name: `Drop ${index + 1}`,
    quantity: 1,
  }));
  window.show(result);
  window.pageIndex = 1;
  window.resetPageState();
  window.viewport.maxVisibleRows = 4;
  triggered.add("ArrowDown");

  for (let index = 0; index < 12; index++) {
    window.update(0);
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

function testVictoryUpdateDelegatesConfirmToRewardStateMachine() {
  let prepareCount = 0;
  let resultUpdateCount = 0;
  let finishCount = 0;
  let confirm = false;
  let shouldFinish = false;
  let handleConfirmCount = 0;
  let receivedDelta = null;

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
    prepareBattleResults() { prepareCount++; },
    resultsWindow: {
      update(deltaTime) {
        resultUpdateCount++;
        receivedDelta = deltaTime;
      },
      handleConfirm() {
        handleConfirmCount++;
        return shouldFinish;
      },
    },
    finishBattle() { finishCount++; },
  };

  Scene_Battle.prototype.update.call(scene, 0.25);
  assert.equal(prepareCount, 1);
  assert.equal(resultUpdateCount, 1);
  assert.equal(receivedDelta, 0.25);
  assert.equal(handleConfirmCount, 0);
  assert.equal(finishCount, 0);

  confirm = true;
  Scene_Battle.prototype.update.call(scene, 0.25);
  assert.equal(handleConfirmCount, 1);
  assert.equal(finishCount, 0, "early confirms are consumed by the results state machine");

  shouldFinish = true;
  Scene_Battle.prototype.update.call(scene, 0.25);
  assert.equal(handleConfirmCount, 2);
  assert.equal(finishCount, 1, "completed Runes page hands control back to battle exit");
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
  testVictoryResultsWaitForConfirmBeforeAnimatingExp();
  testCompletedExpAdvancesToFrozenRunePageThenTicksTotal();
  testResultsPresentationIsFullScreenAndOmitsEssenceProgressClutter();
  testResultsWindowRejectsNonVictoryAndScrollsLootOverflow();
  testVictorySceneFinalizesOnceBeforeExit();
  testVictoryUpdateDelegatesConfirmToRewardStateMachine();
  testSceneDrawsResultsAfterBattleRenderer();
  testResultsWindowLoadsBeforeBattleScene();

  console.log("Battle results screen regression tests passed.");
}

run();
