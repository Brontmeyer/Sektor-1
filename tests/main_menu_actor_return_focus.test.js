"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

function loadSceneMenuClass() {
  const context = vm.createContext({ console });
  vm.runInContext(
    `class Scene_Base {}\n${read("js/scenes/Scene_Menu.js")}\n` +
      `globalThis.__Scene_Menu = Scene_Menu;`,
    context,
  );
  return context.__Scene_Menu;
}

function makeScene(Scene_Menu) {
  const scene = Object.create(Scene_Menu.prototype);
  const calls = [];
  scene.pendingActorCommand = null;
  scene.partyWindow = {
    selected: null,
    active: false,
    selectActor(actor) {
      calls.push(["selectActor", actor.actorId]);
      this.selected = actor;
      return true;
    },
    activate(mode) {
      calls.push(["activate", mode]);
      this.active = mode === "actor";
      return this.active;
    },
  };
  return { scene, calls };
}

function makeClosingWindow(actor) {
  return {
    actor,
    visible: true,
    update() {
      this.visible = false;
    },
    isOpen() {
      return this.visible;
    },
  };
}

function testMagickAndSkillReturnToActorCards() {
  const Scene_Menu = loadSceneMenuClass();

  for (const command of ["Magick", "Skill"]) {
    const actor = { actorId: command === "Magick" ? 2 : 3 };
    const { scene, calls } = makeScene(Scene_Menu);
    const window = makeClosingWindow(actor);

    scene.updateActorDestination(window, command);

    assert.equal(scene.partyWindow.selected, actor);
    assert.equal(scene.partyWindow.active, true);
    assert.equal(scene.pendingActorCommand, command);
    assert.deepEqual(calls, [
      ["selectActor", actor.actorId],
      ["activate", "actor"],
    ]);
  }
}

function testOtherCharacterDestinationsKeepTheirOwnReturnContract() {
  const Scene_Menu = loadSceneMenuClass();
  const actor = { actorId: 4 };

  for (const command of ["Equip", "Essence", "Status", "Valor"]) {
    const { scene, calls } = makeScene(Scene_Menu);
    assert.equal(scene.returnToActorSelection(command, actor), false);
    assert.equal(scene.partyWindow.active, false);
    assert.equal(scene.pendingActorCommand, null);
    assert.deepEqual(calls, []);
  }
}

function testSceneUpdateRoutesOnlyMagickAndSkillThroughReturnHelper() {
  const source = read("js/scenes/Scene_Menu.js");

  assert.match(
    source,
    /updateActorDestination\(this\.magickWindow, "Magick"\)/,
  );
  assert.match(
    source,
    /updateActorDestination\(this\.skillsWindow, "Skill"\)/,
  );
  assert.doesNotMatch(
    source,
    /updateActorDestination\(this\.equipmentWindow, "Equip"\)/,
  );
  assert.doesNotMatch(
    source,
    /updateActorDestination\(this\.essenceWindow, "Essence"\)/,
  );
}

function run() {
  testMagickAndSkillReturnToActorCards();
  testOtherCharacterDestinationsKeepTheirOwnReturnContract();
  testSceneUpdateRoutesOnlyMagickAndSkillThroughReturnHelper();
  console.log("Main menu actor return-focus regression tests passed.");
}

run();
