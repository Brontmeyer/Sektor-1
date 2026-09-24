"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

function createHarness() {
  const actions = new Set();
  const drawCalls = [];
  const context2d = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "",
    textBaseline: "",
    save() {},
    restore() {},
    fillRect() {},
    strokeRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fillText(...args) { drawCalls.push(String(args[0])); },
    measureText(text) { return { width: String(text).length * 8 }; },
  };

  function actor(actorId, name) {
    return {
      actorId,
      name,
      level: 1,
      hp: 500,
      maxHp: 500,
      mp: 100,
      maxMp: 100,
      valor: 0,
      maxValor: 100,
      exp: 0,
      expForNextLevel() { return 100; },
      statusSummary() { return "Normal"; },
    };
  }

  const members = [
    actor(1, "Tyler"),
    actor(2, "Sarah"),
    actor(3, "Aboo"),
    actor(4, "G Prime"),
  ];
  const formation = [...members];
  const rows = new Map(members.map((member) => [member.actorId, "front"]));
  const party = {
    battleFormationMembers() { return formation; },
    battleMembers() { return members; },
    battleRow(actorOrId) {
      const id = Number(actorOrId?.actorId ?? actorOrId);
      return rows.get(id) || "front";
    },
    setBattleRow(actorOrId, row) {
      const id = Number(actorOrId?.actorId ?? actorOrId);
      const normalized = String(row || "").toLowerCase();
      if (!rows.has(id) || !["front", "back"].includes(normalized)) {
        return false;
      }
      rows.set(id, normalized);
      return true;
    },
    toggleBattleRow(actorOrId) {
      const id = Number(actorOrId?.actorId ?? actorOrId);
      if (!rows.has(id)) return false;
      rows.set(id, rows.get(id) === "front" ? "back" : "front");
      return true;
    },
    swapBattleFormationSlots(firstIndex, secondIndex) {
      if (
        !Number.isInteger(firstIndex) ||
        !Number.isInteger(secondIndex) ||
        firstIndex < 0 ||
        secondIndex < 0 ||
        firstIndex >= formation.length ||
        secondIndex >= formation.length ||
        firstIndex === secondIndex
      ) {
        return false;
      }
      [formation[firstIndex], formation[secondIndex]] = [
        formation[secondIndex],
        formation[firstIndex],
      ];
      return true;
    },
  };

  const globals = {
    console,
    Graphics: { width: 1280, height: 720, context: context2d },
    Input: {
      isActionTriggered(action) { return actions.has(action); },
      isActionRepeated(action) { return actions.has(action); },
    },
  };
  const context = vm.createContext(globals);
  const source = [
    "js/core/UIResourcePalette.js",
    "js/core/UIThemePalette.js",
    "js/windows/Window_TextLayout.js",
    "js/windows/Window_ActorSummary.js",
    "js/windows/CharacterMenuLayout.js",
    "js/windows/Window_MainMenuParty.js",
    "js/windows/Window_Order.js",
  ].map(read).join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__WindowOrder = Window_Order;`,
    context,
  );

  return {
    window: new context.__WindowOrder(party),
    actions,
    drawCalls,
    members,
    formation,
    rows,
  };
}

function press(harness, action) {
  harness.actions.clear();
  harness.actions.add(action);
  harness.window.update();
  harness.actions.clear();
}

function drawText(harness) {
  harness.drawCalls.length = 0;
  harness.window.draw();
  return harness.drawCalls.slice();
}

function includes(texts, expected) {
  return texts.some((text) => text === expected || text.includes(expected));
}

function testOrderUsesDedicatedFullScreenPresentation() {
  const harness = createHarness();
  harness.window.show();
  const texts = drawText(harness);

  assert.equal(harness.window.isOpen(), true);
  assert.equal(harness.window.formationWindow.mode, "order");
  assert.equal(includes(texts, "BATTLE FORMATION"), true);
  assert.equal(includes(texts, "ORDER"), true);
  assert.equal(includes(texts, "FORMATION"), true);
  assert.equal(includes(texts, "Tyler"), true);
  assert.equal(includes(texts, "Sarah"), true);
  assert.equal(includes(texts, "Aboo"), true);
  assert.equal(includes(texts, "G Prime"), true);
  assert.equal(includes(texts, "Active Party"), true);
  assert.equal(includes(texts, "Front Row"), true);
  assert.equal(includes(texts, "Back Row"), true);
}

function testOrderDelegatesRowsAndSlotSwapsToExistingPartyRuntime() {
  const harness = createHarness();
  harness.window.show();

  assert.equal(harness.rows.get(1), "front");
  press(harness, "left");
  assert.equal(harness.rows.get(1), "back");
  assert.equal(harness.window.selectedRow(), "back");

  press(harness, "right");
  assert.equal(harness.rows.get(1), "front");

  press(harness, "confirm");
  assert.equal(harness.window.formationWindow.hasPendingSwap(), true);
  assert.equal(harness.window.swapActor(), harness.members[0]);

  press(harness, "down");
  press(harness, "down");
  press(harness, "confirm");
  assert.deepEqual(
    harness.formation.map((member) => member.name),
    ["Aboo", "Sarah", "Tyler", "G Prime"],
  );
  assert.equal(harness.window.formationWindow.hasPendingSwap(), false);
}

function testOrderCancelIsHierarchical() {
  const harness = createHarness();
  harness.window.show();

  press(harness, "confirm");
  assert.equal(harness.window.formationWindow.hasPendingSwap(), true);
  press(harness, "cancel");
  assert.equal(harness.window.isOpen(), true);
  assert.equal(harness.window.formationWindow.hasPendingSwap(), false);

  press(harness, "cancel");
  assert.equal(harness.window.isOpen(), false);
}

function testOrderPresentationAvoidsPermanentFooterHints() {
  const source = read("js/windows/Window_Order.js");
  assert.doesNotMatch(source, /actionLabel/);
  assert.doesNotMatch(source, /footer/i);
  assert.match(source, /new Window_MainMenuParty\([\s\S]*this\.party,[\s\S]*this\.contentBounds/);
}

function run() {
  testOrderUsesDedicatedFullScreenPresentation();
  testOrderDelegatesRowsAndSlotSwapsToExistingPartyRuntime();
  testOrderCancelIsHierarchical();
  testOrderPresentationAvoidsPermanentFooterHints();
  console.log("Order menu presentation regression tests passed.");
}

run();
