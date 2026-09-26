"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
const actors = JSON.parse(read("data/Actors.json"));

function createHarness() {
  const pushed = [];
  const context = vm.createContext({
    console,
    DebugManager: { log() {} },
    DatabaseManager: {
      actors,
      statuses: [],
      actor(id) { return actors[id] || null; },
      statusByKey() { return null; },
      item() { return null; },
      weapon() { return null; },
      armor() { return null; },
      accessory() { return null; },
      magick() { return null; },
      skill() { return null; },
      essence() { return null; },
    },
    SceneManager: {
      push(...args) { pushed.push(args); },
    },
    Scene_NameEntry: function Scene_NameEntry() {},
  });

  const source = [
    "js/objects/Game_Battler.js",
    "js/objects/Game_Actor.js",
    "js/objects/Game_Party.js",
    "js/objects/Game_SelfSwitches.js",
    "js/objects/Game_Switches.js",
    "js/objects/Game_Variables.js",
    "js/objects/Game_System.js",
    "js/objects/Game_Interpreter.js",
  ].map(read).join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__classes = { Game_Actor, Game_System, Game_Interpreter };`,
    context,
  );

  const system = new context.__classes.Game_System();
  context.$gameSystem = system;
  context.$gameParty = system.party;

  return { context, system, pushed, ...context.__classes };
}

function testActorNamesAreRuntimeIdentityWithCanonicalFallback() {
  const { system } = createHarness();
  const actor = system.actor(1);

  assert.ok(actor);
  assert.equal(actor.defaultName(), actors[1].name);
  assert.equal(actor.name, "Unknown");
  assert.equal(system.actorName(1), "Unknown");
  assert.equal(system.actor(2).name, system.actor(2).defaultName());
  assert.equal(system.actor(3).name, system.actor(3).defaultName());
  assert.equal(system.actor(4).name, system.actor(4).defaultName());
  assert.equal(system.actor(999), null);

  assert.equal(system.renameActor(1, "  Nova   Prime  "), true);
  assert.equal(actor.name, "Nova Prime");
  assert.equal(actor.actorId, 1);
  assert.equal(system.actorName(1), "Nova Prime");

  assert.equal(actor.rename("   "), false);
  assert.equal(actor.name, "Nova Prime");

  assert.equal(actor.rename("!@#Rook_%^&*()"), true);
  assert.equal(actor.name, "Rook");
  assert.equal(actor.rename("!@#$%^&*()"), false);
  assert.equal(actor.name, "Rook");
  assert.equal(actor.rename("1323532547648569"), false);
  assert.equal(actor.name, "Rook");

  assert.equal(actor.rename("Anne-Marie 7"), true);
  assert.equal(actor.name, "AnneMarie");

  assert.equal(actor.rename("Élodie Prime"), true);
  assert.equal(actor.name, "Élodie Prime");

  assert.equal(actor.rename("ABCDEFGHIJKLMNOPQRSTUV"), true);
  assert.equal(Array.from(actor.name).length, actor.nameMaxLength());

  assert.equal(actor.resetName(), actors[1].name);
  assert.equal(actor.name, actors[1].name);
}

function testDialogueActorTokensResolveRuntimeNames() {
  const { context, system, Game_Interpreter } = createHarness();
  const shown = [];
  const messageWindow = {
    open: false,
    isOpen() { return this.open; },
    show(text, speaker, options) {
      shown.push({ text, speaker, options });
      this.open = true;
    },
    hide() { this.open = false; },
    isMessageFullyRevealed() { return true; },
  };
  const choiceWindow = {
    isOpen() { return false; },
    hasResult() { return false; },
    show() {},
  };

  assert.equal(system.renameActor(1, "Rook"), true);
  const interpreter = new Game_Interpreter(messageWindow, choiceWindow);
  interpreter.setup([
    {
      code: "text",
      speaker: "{actor:1}",
      text: "Stay close, {actor:1}.",
    },
  ]);
  interpreter.update();

  assert.equal(shown.length, 1);
  assert.equal(shown[0].speaker, "Rook");
  assert.equal(shown[0].text, "Stay close, Rook.");
  assert.equal(
    interpreter.resolveActorReferences("Unknown {actor:999}"),
    "Unknown {actor:999}",
  );

  // Keep context live so the VM does not optimize away the global contract.
  assert.equal(context.$gameSystem.actorName(1), "Rook");
}

function testNameActorEventPushesReusableNamingSceneAndAdvancesInterpreter() {
  const { system, pushed, Game_Interpreter } = createHarness();
  const messageWindow = {
    isOpen() { return false; },
    show() {},
    hide() {},
  };
  const choiceWindow = {
    isOpen() { return false; },
    hasResult() { return false; },
  };
  const interpreter = new Game_Interpreter(messageWindow, choiceWindow);

  assert.equal(system.renameActor(2, actors[2].name), true);
  interpreter.setup([
    {
      code: "nameActor",
      actorId: 2,
      prompt: "What should {actor:2} be called?",
    },
    { code: "text", text: "Welcome." },
  ]);
  interpreter.update();

  assert.equal(pushed.length, 1);
  assert.equal(pushed[0][1], 2);
  assert.equal(pushed[0][2].title, "NAME");
  assert.equal(pushed[0][2].prompt, `What should ${actors[2].name} be called?`);
  assert.equal(interpreter.index, 1);
}

function testUnidentifiedProtagonistNamingStartsFromCanonicalDefault() {
  const { system, pushed, Game_Interpreter } = createHarness();
  const messageWindow = {
    isOpen() { return false; },
    show() {},
    hide() {},
  };
  const choiceWindow = {
    isOpen() { return false; },
    hasResult() { return false; },
  };
  const interpreter = new Game_Interpreter(messageWindow, choiceWindow);

  assert.equal(system.actor(1).name, "Unknown");
  interpreter.setup([{ code: "nameActor", actorId: 1, prompt: "What is your name?" }]);
  interpreter.update();

  assert.equal(pushed.length, 1);
  assert.equal(pushed[0][1], 1);
  assert.equal(pushed[0][2].startFromDefault, true);
}

function testStartupDefersNamingUntilStoryEvent() {
  const main = read("js/main.js");
  const index = read("index.html");
  const map = JSON.parse(read("data/Map001.json"));
  const namingEvent = map.events.find((event) => event?.id === 19);

  assert.doesNotMatch(main, /SceneManager\.goto\(Scene_NameEntry/);
  assert.match(main, /SceneManager\.goto\(Scene_Map\)/);
  assert.ok(namingEvent, "Map001 should contain the protagonist naming fixture.");
  assert.equal(
    namingEvent.pages[0].commands.some(
      (command) => command.code === "nameActor" && command.actorId === 1,
    ),
    true,
  );
  assert.deepEqual(namingEvent.pages[0].conditions.selfSwitches, [
    { letter: "A", value: false },
  ]);
  assert.equal(
    namingEvent.pages[0].commands.some(
      (command) =>
        command.code === "setSelfSwitch" &&
        command.letter === "A" &&
        command.value === true,
    ),
    true,
  );
  assert.match(index, /js\/windows\/Window_NameEntry\.js/);
  assert.match(index, /js\/scenes\/Scene_NameEntry\.js/);
}

function run() {
  testActorNamesAreRuntimeIdentityWithCanonicalFallback();
  testDialogueActorTokensResolveRuntimeNames();
  testNameActorEventPushesReusableNamingSceneAndAdvancesInterpreter();
  testUnidentifiedProtagonistNamingStartsFromCanonicalDefault();
  testStartupDefersNamingUntilStoryEvent();
  console.log("Actor naming runtime regression tests passed.");
}

run();
