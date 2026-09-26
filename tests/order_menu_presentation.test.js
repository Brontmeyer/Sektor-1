"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

function testOrderStaysInsideMainMenuPartyCards() {
  const scene = read("js/scenes/Scene_Menu.js");
  const html = read("index.html");

  assert.match(scene, /beginOrderSelection\(\)/);
  assert.match(scene, /this\.pendingActorCommand = "Order"/);
  assert.match(scene, /this\.partyWindow\.activate\("order"\)/);
  assert.match(scene, /this\.pendingActorCommand === "Order"/);
  assert.doesNotMatch(scene, /new Window_Order/);
  assert.doesNotMatch(scene, /orderWindow/);
  assert.equal(html.includes("Window_Order.js"), false);
}

function testOrderUsesExistingPartyCardRowAndSwapControls() {
  const partyWindow = read("js/windows/Window_MainMenuParty.js");

  assert.match(partyWindow, /this\.mode === "order"/);
  assert.match(partyWindow, /Input\.isActionTriggered\("left"\)/);
  assert.match(partyWindow, /this\.setActorRow\(actor, "back"\)/);
  assert.match(partyWindow, /Input\.isActionTriggered\("right"\)/);
  assert.match(partyWindow, /this\.setActorRow\(actor, "front"\)/);
  assert.match(partyWindow, /this\.swapFormationSlots\(fromIndex, toIndex\)/);
}

function testOrderMainMenuHeaderExplainsDirectControls() {
  const scene = read("js/scenes/Scene_Menu.js");

  assert.match(scene, /ORDER: Up\/Down move/);
  assert.match(scene, /Left\/Right row/);
  assert.match(scene, /Swap/);
}

function run() {
  testOrderStaysInsideMainMenuPartyCards();
  testOrderUsesExistingPartyCardRowAndSwapControls();
  testOrderMainMenuHeaderExplainsDirectControls();
  console.log("Direct Order presentation regression tests passed.");
}

run();
