"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const source = fs.readFileSync(
  path.join(projectRoot, "js/windows/Window_MainMenuParty.js"),
  "utf8",
);

function loadWindow(members) {
  let triggered = null;
  const audioCalls = [];
  const context = vm.createContext({
    console,
    Input: { isActionTriggered(action) { return triggered === action; } },
    AudioManager: { playSe(key) { audioCalls.push(key); return true; } },
  });
  vm.runInContext(
    `${source}\nglobalThis.__Window = Window_MainMenuParty;`,
    context,
  );
  const party = { battleFormationMembers: () => members };
  const window = new context.__Window(party, { width: 900, height: 600 });
  return {
    window,
    audioCalls,
    trigger(action) { triggered = action; },
  };
}

function testSingleActorDoesNotReportFakeMovement() {
  const actor = { actorId: 1 };
  const harness = loadWindow([actor]);
  harness.window.activate("actor");
  harness.trigger("down");
  assert.equal(harness.window.update(), null);
  assert.equal(harness.window.index, 0);
  assert.deepEqual(harness.audioCalls, []);
}

function testMultipleActorsMoveWithoutTouchingEmptySlots() {
  const actors = [{ actorId: 1 }, { actorId: 2 }];
  const harness = loadWindow(actors);
  harness.window.activate("actor");
  harness.trigger("down");
  const result = harness.window.update();
  assert.equal(result.type, "move");
  assert.equal(result.actor.actorId, 2);
  assert.equal(harness.window.index, 1);
  assert.deepEqual(harness.audioCalls, ["ui.cursor"]);

  harness.trigger("down");
  assert.equal(harness.window.update().actor.actorId, 1);
  assert.equal(harness.window.index, 0);
}

function testSelectedCardUsesBorderIndicatorWithoutSelectorRail() {
  assert.doesNotMatch(source, /selectorRailWidth/);
  assert.match(source, /cardX = this\.x \+ 12/);
  assert.match(source, /context\.strokeRect\(cardX \+ 2, cardY \+ 2/);
  assert.match(source, /const pulse = swapSource/);
  assert.match(source, /Math\.sin/);
}

function run() {
  testSingleActorDoesNotReportFakeMovement();
  testMultipleActorsMoveWithoutTouchingEmptySlots();
  testSelectedCardUsesBorderIndicatorWithoutSelectorRail();
  console.log("Main menu actor focus-stability regression tests passed.");
}

run();
