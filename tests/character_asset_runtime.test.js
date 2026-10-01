"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(projectRoot, relative), "utf8");
const readData = (filename) =>
  JSON.parse(fs.readFileSync(path.join(projectRoot, "data", filename), "utf8"));

function loadManager(extraGlobals = {}) {
  const filename = path.join(projectRoot, "js/core/CharacterAssetManager.js");
  const source = fs.readFileSync(filename, "utf8");
  const drawCalls = [];

  class FakeImage {
    constructor() {
      this.complete = true;
      this.naturalWidth = 512;
      this.naturalHeight = 512;
      this.width = 512;
      this.height = 512;
      this.listeners = {};
    }

    addEventListener(type, callback) {
      this.listeners[type] = callback;
    }

    set src(value) {
      this._src = value;
      this.listeners.load?.();
    }

    get src() {
      return this._src;
    }
  }

  const context = vm.createContext({ console, Image: FakeImage, ...extraGlobals });
  vm.runInContext(
    `${source}\nglobalThis.__CharacterAssetManager = CharacterAssetManager;`,
    context,
    { filename },
  );

  return {
    CharacterAssetManager: context.__CharacterAssetManager,
    context: {
      drawImage(...args) {
        drawCalls.push(args);
      },
      save() {},
      restore() {},
      beginPath() {},
      rect() {},
      clip() {},
    },
    drawCalls,
  };
}

function testLeadActorCharacterVisualContracts() {
  const actors = readData("Actors.json");
  const tyler = actors[1];
  const sarah = actors[2];

  assert.equal(tyler.characterVisual.portrait, "portraits/Tyler.png");
  assert.equal(sarah.characterVisual.portrait, "portraits/Sarah.png");
  assert.equal(tyler.characterVisual.effects.attack, "#e7b84d");
  assert.equal(sarah.characterVisual.effects.attack, "#e7b84d");
  assert.equal(tyler.characterVisual.effects.magick, "#4aa3ff");
  assert.equal(sarah.characterVisual.effects.magick, "#ff4f6d");

  for (const filename of ["Tyler.png", "Sarah.png"]) {
    assert.equal(
      fs.existsSync(path.join(projectRoot, "js/sprites/actors/portraits", filename)),
      true,
      `${filename} should ship as a runtime portrait asset`,
    );
  }
}

function testPortraitLoaderUsesSharedActorAssetPath() {
  const { CharacterAssetManager, context, drawCalls } = loadManager();
  const actor = {
    characterVisual: {
      portrait: "portraits/Tyler.png",
      expressions: {},
    },
  };

  assert.equal(
    CharacterAssetManager.portraitPath(actor),
    "js/sprites/actors/portraits/Tyler.png",
  );
  assert.equal(
    CharacterAssetManager.drawPortrait(context, actor, 10, 20, 96, 96),
    true,
  );
  assert.equal(drawCalls.length, 1);
  assert.equal(drawCalls[0][5], 10);
  assert.equal(drawCalls[0][6], 20);
  assert.equal(drawCalls[0][7], 96);
  assert.equal(drawCalls[0][8], 96);
}

function testSaveSnapshotActorsResolveDatabaseCharacterVisuals() {
  const actors = readData("Actors.json");
  const { CharacterAssetManager, context, drawCalls } = loadManager({
    DatabaseManager: {
      actor(actorId) {
        return actors[actorId] || null;
      },
    },
  });
  const savedActor = { actorId: 1, name: "Tyler", level: 12 };

  assert.equal(
    CharacterAssetManager.portraitPath(savedActor),
    "js/sprites/actors/portraits/Tyler.png",
  );
  assert.equal(
    CharacterAssetManager.drawPortrait(context, savedActor, 0, 0, 96, 96),
    true,
  );
  assert.equal(drawCalls.length, 1);
}

function testUnsafeCharacterAssetPathsAreRejected() {
  const { CharacterAssetManager } = loadManager();
  assert.equal(CharacterAssetManager.assetPath("../secret.png"), null);
  assert.equal(CharacterAssetManager.assetPath("/absolute.png"), null);
  assert.equal(CharacterAssetManager.assetPath("portraits/Sarah.png"), "js/sprites/actors/portraits/Sarah.png");
}

function testCharacterWindowsUseRuntimePortraitsWithFallbacks() {
  const summary = read("js/windows/Window_ActorSummary.js");
  const mainParty = read("js/windows/Window_MainMenuParty.js");

  assert.match(summary, /CharacterAssetManager\.drawPortrait/);
  assert.match(mainParty, /CharacterAssetManager\.drawPortrait/);
  assert.match(summary, /if \(portraitDrawn\)/);
  assert.match(mainParty, /if \(!portraitDrawn\)/);
}

function testLeadBattlersKeepLivingIdleMotionContract() {
  const actors = readData("Actors.json");

  for (const actor of [actors[1], actors[2]]) {
    assert.equal(actor.battleVisual.animations.idle.loop, true);
    assert.ok(actor.battleVisual.animations.idle.frames >= 2);
    assert.ok(actor.battleVisual.animations.idle.frameDuration > 0);
  }
}

function testApprovedMasterReferencesShipWithTheProject() {
  for (const filename of ["Tyler_Master.png", "Sarah_Master.png"]) {
    assert.equal(
      fs.existsSync(path.join(projectRoot, "docs/character_refs", filename)),
      true,
      `${filename} should remain available as an approved design reference`,
    );
  }
}

function run() {
  testLeadActorCharacterVisualContracts();
  testPortraitLoaderUsesSharedActorAssetPath();
  testSaveSnapshotActorsResolveDatabaseCharacterVisuals();
  testUnsafeCharacterAssetPathsAreRejected();
  testCharacterWindowsUseRuntimePortraitsWithFallbacks();
  testLeadBattlersKeepLivingIdleMotionContract();
  testApprovedMasterReferencesShipWithTheProject();
  console.log("Character asset runtime regression tests passed.");
}

run();
