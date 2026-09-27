"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");

function loadResultsWindow() {
  const context = vm.createContext({
    console,
    Graphics: { width: 1240, height: 720, context: {} },
    Input: {
      isActionTriggered() { return false; },
      actionLabel(action) { return action === "confirm" ? "E / Enter" : action; },
    },
  });
  const source = [
    "js/windows/Window_ListViewport.js",
    "js/windows/Window_BattleResults.js",
  ].map((relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), "utf8")).join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__Window_BattleResults = Window_BattleResults;`,
    context,
  );
  return new context.__Window_BattleResults();
}

function sampleResult() {
  return {
    outcome: "victory",
    encounter: { id: 1, name: "Pacing Test" },
    rewards: {
      exp: 10000,
      currency: 10000,
      resonance: 10,
      drops: [{ itemId: 1, name: "Potion", quantity: 1 }],
    },
    runesBefore: 500,
    runesAfter: 10500,
    party: [{
      actorId: 1,
      name: "Tyler",
      expGained: 10000,
      expBefore: 0,
      expAfter: 0,
      levelBefore: 1,
      levelAfter: 15,
      wasDefeated: false,
      essenceRewards: [{
        essenceId: 4,
        name: "Flame Essence",
        oldLevel: 3,
        newLevel: 4,
        leveledUp: true,
        becameMasteryReady: false,
      }],
    }],
  };
}

function testDialogueStyleConfirmPacing() {
  const window = loadResultsWindow();
  assert.equal(window.show(sampleResult()), true);

  // EXP page: begin -> finish immediately -> next page.
  assert.equal(window.pageState, "waiting");
  assert.equal(window.footerText(), "E / Enter: Begin");
  assert.equal(window.handleConfirm(), false);
  assert.equal(window.pageState, "animating");
  assert.equal(window.footerText(), "E / Enter: Finish");

  window.update(0.01);
  assert.equal(window.actorRows[0].remainingExp > 0, true);
  assert.equal(window.handleConfirm(), false);
  assert.equal(window.pageState, "complete");
  assert.equal(window.actorRows[0].visualLevel, 15);
  assert.equal(window.actorRows[0].visualExp, 0);
  assert.equal(window.actorRows[0].remainingExp, 0);
  assert.equal(window.essencePopupQueue.length, 0);
  assert.equal(window.activeEssencePopup, null);
  assert.equal(window.footerText(), "E / Enter: Next");

  assert.equal(window.handleConfirm(), false);
  assert.equal(window.pageIndex, 1);
  assert.equal(window.pageState, "waiting");
  assert.equal(window.visualRunes, 500);

  // Runes page: begin -> finish immediately -> exit.
  assert.equal(window.handleConfirm(), false);
  assert.equal(window.pageState, "animating");
  window.update(0.01);
  assert.equal(window.visualRunes > 500, true);
  assert.equal(window.visualRunes < 10500, true);
  assert.equal(window.handleConfirm(), false);
  assert.equal(window.pageState, "complete");
  assert.equal(window.visualRunes, 10500);
  assert.equal(window.footerText(), "E / Enter: Continue");
  assert.equal(window.handleConfirm(), true);
}

function testFinishOnlyActsDuringAnimation() {
  const window = loadResultsWindow();
  window.show(sampleResult());

  assert.equal(window.finishCurrentAnimation(), false);
  window.handleConfirm();
  assert.equal(window.finishCurrentAnimation(), true);
  assert.equal(window.finishCurrentAnimation(), false);
}

testDialogueStyleConfirmPacing();
testFinishOnlyActsDuringAnimation();
console.log("Battle results pacing regression tests passed.");
