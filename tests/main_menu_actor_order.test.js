"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

function createHarness() {
  const triggered = new Set();
  const calls = [];
  const context2d = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "",
    textBaseline: "",
    save() {},
    restore() {},
    fillRect(...args) { calls.push(["fillRect", ...args]); },
    strokeRect(...args) { calls.push(["strokeRect", ...args]); },
    fillText(...args) { calls.push(["fillText", ...args]); },
    measureText(text) { return { width: String(text).length * 8 }; },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
  };
  const Input = {
    isActionTriggered(action) {
      return triggered.has(action);
    },
    actionLabel(action) {
      return action;
    },
  };
  const context = vm.createContext({
    console,
    Graphics: { width: 1280, height: 720, context: context2d },
    Input,
  });

  vm.runInContext(
    `${read("js/windows/Window_MainMenuParty.js")}\n` +
      `${read("js/windows/Window_ActorNavigator.js")}\n` +
      `globalThis.__classes = { Window_MainMenuParty, Window_ActorNavigator };`,
    context,
  );

  return {
    ...context.__classes,
    triggered,
    calls,
    context2d,
  };
}

function actor(id, name) {
  return {
    actorId: id,
    name,
    level: 1,
    hp: 100,
    maxHp: 100,
    mp: 20,
    maxMp: 20,
    valor: 0,
    maxValor: 100,
    exp: 0,
    expForNextLevel: () => 100,
    statusSummary: () => "",
  };
}

function createParty() {
  const members = [
    actor(1, "Tyler"),
    actor(2, "Sarah"),
    actor(3, "Aboo"),
    actor(4, "G Prime"),
  ];
  const rows = new Map(members.map((member) => [member.actorId, "front"]));

  return {
    members,
    rows,
    party: {
      members: () => members,
      battleMembers: () => members,
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
    },
  };
}

function trigger(window, triggered, action) {
  triggered.clear();
  triggered.add(action);
  const result = window.update();
  triggered.clear();
  return result;
}

function testActorSelectionFocusWrapsAndConfirms() {
  const { Window_MainMenuParty, triggered } = createHarness();
  const { party, members } = createParty();
  const window = new Window_MainMenuParty(party, {
    x: 20,
    y: 80,
    width: 900,
    height: 610,
  });

  assert.equal(window.activate("actor"), true);
  assert.equal(window.currentActor(), members[0]);

  let result = trigger(window, triggered, "up");
  assert.equal(result.type, "move");
  assert.equal(window.currentActor(), members[3]);

  result = trigger(window, triggered, "down");
  assert.equal(result.type, "move");
  assert.equal(window.currentActor(), members[0]);

  result = trigger(window, triggered, "confirm");
  assert.equal(result.type, "confirm");
  assert.equal(result.actor, members[0]);

  result = trigger(window, triggered, "cancel");
  assert.equal(result.type, "cancel");
}

function testOrderModeMovesRowsWithoutCombatRules() {
  const { Window_MainMenuParty, triggered } = createHarness();
  const { party, members, rows } = createParty();
  const window = new Window_MainMenuParty(party, {
    x: 20,
    y: 80,
    width: 900,
    height: 610,
  });

  assert.equal(window.activate("order"), true);
  assert.equal(window.mode, "order");

  let result = trigger(window, triggered, "left");
  assert.equal(result.type, "row");
  assert.equal(result.actor, members[0]);
  assert.equal(result.row, "back");
  assert.equal(rows.get(1), "back");

  result = trigger(window, triggered, "right");
  assert.equal(result.type, "row");
  assert.equal(result.actor, members[0]);
  assert.equal(result.row, "front");
  assert.equal(rows.get(1), "front");

  result = trigger(window, triggered, "confirm");
  assert.equal(result.type, "row");
  assert.equal(result.row, "back");
  assert.equal(rows.get(1), "back");
  assert.equal(window.setActorRow(members[0], "sideways"), false);
  assert.equal(rows.get(1), "back");
}

function testPortraitOffsetIsTheOnlyRowLabel() {
  const { Window_MainMenuParty, context2d, calls } = createHarness();
  const { party, members, rows } = createParty();
  const window = new Window_MainMenuParty(party, {
    x: 20,
    y: 80,
    width: 900,
    height: 610,
  });
  const portraitCalls = [];
  window.drawPortraitPlaceholder = (_context, currentActor, x, y, size) => {
    portraitCalls.push({ actor: currentActor.name, x, y, size });
  };

  rows.set(1, "back");
  rows.set(2, "front");

  window.drawActorCard(context2d, members[0], 0, 30, 100, 840, 130);
  window.drawActorCard(context2d, members[1], 1, 30, 240, 840, 130);

  assert.equal(portraitCalls.length, 2);
  assert.equal(portraitCalls[1].x > portraitCalls[0].x, true);

  const text = calls
    .filter((call) => call[0] === "fillText")
    .map((call) => String(call[1]));
  assert.equal(text.includes("FRONT"), false);
  assert.equal(text.includes("BACK"), false);
}

function testActorNavigatorUsesActivePartyAndCanSelectExplicitActor() {
  const { Window_ActorNavigator } = createHarness();
  const { members } = createParty();
  const reserve = actor(5, "Reserve");
  const party = {
    members: () => [...members, reserve],
    battleMembers: () => members,
  };
  const navigator = new Window_ActorNavigator(party);

  assert.equal(navigator.members().length, 4);
  assert.equal(navigator.selectActor(members[2]), true);
  assert.equal(navigator.actor(), members[2]);
  assert.equal(navigator.selectActor(reserve), false);
  assert.equal(navigator.actor(), members[2]);
}

function testSceneMenuUsesSharedActorSelectionContract() {
  const scene = read("js/scenes/Scene_Menu.js");

  for (const command of ["Magick", "Skill", "Essence", "Equip", "Status", "Valor"]) {
    assert.equal(scene.includes(`case "${command}":`), true);
  }

  assert.match(scene, /beginActorSelection\(command\)/);
  assert.match(scene, /beginOrderSelection\(\)/);
  assert.match(scene, /partyWindow\.activate\("actor"\)/);
  assert.match(scene, /partyWindow\.activate\("order"\)/);
  assert.match(scene, /actorNavigation\?\.selectActor/);
  assert.match(scene, /Valor progression is planned for a focused pass/);
}

function run() {
  testActorSelectionFocusWrapsAndConfirms();
  testOrderModeMovesRowsWithoutCombatRules();
  testPortraitOffsetIsTheOnlyRowLabel();
  testActorNavigatorUsesActivePartyAndCanSelectExplicitActor();
  testSceneMenuUsesSharedActorSelectionContract();

  console.log("Main menu actor selection and Order regression tests passed.");
}

run();
