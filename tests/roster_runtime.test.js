"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

function loadPartyClass() {
  class Game_Actor {
    constructor(actorId, name = `Actor ${actorId}`) {
      this.actorId = actorId;
      this.name = name;
      this.level = 1;
      this.hp = 100;
      this.maxHp = 100;
      this.mp = 50;
      this.maxMp = 50;
    }
  }

  const context = vm.createContext({
    console,
    Game_Actor,
    globalThis: null,
  });
  context.globalThis = context;
  context.$gameSystem = { actor: () => null };

  vm.runInContext(
    `${read("js/objects/Game_Party.js")}\nglobalThis.__Party = Game_Party;`,
    context,
  );

  return { Game_Party: context.__Party, Game_Actor };
}

function testPartyOwnsActiveReserveSwitchingContract() {
  const { Game_Party, Game_Actor } = loadPartyClass();
  const actors = [
    new Game_Actor(1, "Tyler"),
    new Game_Actor(2, "Sarah"),
    new Game_Actor(3, "Aboo"),
    new Game_Actor(4, "G Prime"),
    new Game_Actor(5, "Reserve"),
  ];
  const party = new Game_Party(actors);

  assert.deepEqual(Array.from(party.battleActorIds()), [1, 2, 3, 4]);
  assert.deepEqual(Array.from(party.reserveMembers(), (actor) => actor.actorId), [5]);
  assert.equal(party.isBattleActor(2), true);
  assert.equal(party.isBattleActor(5), false);

  assert.equal(party.replaceBattleActor(2, 5), true);
  assert.deepEqual(Array.from(party.battleActorIds()), [1, 5, 3, 4]);
  assert.deepEqual(Array.from(party.battleFormationActorIds()), [1, 5, 3, 4]);
  assert.deepEqual(Array.from(party.reserveMembers(), (actor) => actor.actorId), [2]);

  assert.equal(party.reserveBattleActor(3), true);
  assert.deepEqual(Array.from(party.battleActorIds()), [1, 5, 4]);
  assert.equal(party.activateBattleActor(2), true);
  assert.deepEqual(Array.from(party.battleActorIds()), [1, 5, 4, 2]);
}

function testRosterWindowFullPartySwapFlow() {
  const triggered = new Set();
  const active = [
    { actorId: 1, name: "Tyler" },
    { actorId: 2, name: "Sarah" },
    { actorId: 3, name: "Aboo" },
    { actorId: 4, name: "G Prime" },
  ];
  const reserve = [{ actorId: 5, name: "Reserve" }];
  const all = [...active, ...reserve];
  const party = {
    battleMembers: () => active,
    members: () => all,
    reserveMembers: () => reserve,
    actorById(id) {
      return all.find((actor) => actor.actorId === Number(id)) || null;
    },
    replaceBattleActor(activeActor, reserveActor) {
      const activeIndex = active.indexOf(activeActor);
      const reserveIndex = reserve.indexOf(reserveActor);
      if (activeIndex < 0 || reserveIndex < 0) return false;
      active[activeIndex] = reserveActor;
      reserve[reserveIndex] = activeActor;
      return true;
    },
    reserveBattleActor() { return false; },
    activateBattleActor() { return false; },
  };
  const context = vm.createContext({
    console,
    Graphics: { width: 1280, height: 720 },
    Input: {
      isActionTriggered(action) {
        return triggered.has(action);
      },
    },
  });

  vm.runInContext(
    `${read("js/windows/Window_ListViewport.js")}\n${read("js/windows/Window_Roster.js")}\nglobalThis.__Roster = Window_Roster;`,
    context,
  );

  const window = new context.__Roster(party);
  window.show();
  window.switchFocus("reserve");
  assert.equal(window.currentActor().name, "Reserve");
  assert.equal(window.confirmSelection(), true);
  assert.equal(window.pendingReserveId, 5);
  assert.equal(window.focus, "active");
  assert.equal(window.confirmSelection(), true);
  assert.equal(window.pendingReserveId, 0);
  assert.equal(active[0].name, "Reserve");
  assert.equal(reserve[0].name, "Tyler");
}

function testRosterTerminologyAndMenuRouting() {
  const roster = read("js/windows/Window_Roster.js");
  const scene = read("js/scenes/Scene_Menu.js");
  const map = read("js/scenes/Scene_Map.js");

  assert.match(
    roster,
    /Remote Operative Selection Tactical Engagement Registry/,
  );
  assert.match(scene, /this\.rosterWindow = new Window_Roster\(\$gameParty\)/);
  assert.match(scene, /case "ROSTER":\s*this\.rosterWindow\.show\(\)/);
  assert.match(map, /ROSTER:\s*\{[\s\S]*members\?\.\(\)[\s\S]*length > 1/);
}

function run() {
  testPartyOwnsActiveReserveSwitchingContract();
  testRosterWindowFullPartySwapFlow();
  testRosterTerminologyAndMenuRouting();
  console.log("ROSTER runtime regression tests passed.");
}

run();
