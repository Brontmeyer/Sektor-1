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
  const triggered = new Set();
  const actions = new Set();
  let textCharacters = [];
  const context = vm.createContext({
    console,
    DatabaseManager: {
      actor(id) { return actors[id] || null; },
      statuses: [],
      statusByKey() { return null; },
    },
    Input: {
      isTriggered(code) { return triggered.has(code); },
      isActionTriggered(action) { return actions.has(action); },
      isTextConfirmTriggered() {
        return triggered.has("Enter") || triggered.has("NumpadEnter");
      },
      isTextBackspaceTriggered() { return triggered.has("Backspace"); },
      isTextResetTriggered() { return triggered.has("Escape"); },
      consumeTextCharacters() {
        const result = [...textCharacters];
        textCharacters = [];
        return result;
      },
    },
    Graphics: {
      width: 1280,
      height: 720,
      context: {
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
        fillText() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        stroke() {},
        measureText(text) { return { width: String(text).length * 8 }; },
      },
    },
  });

  const source = [
    "js/objects/Game_Battler.js",
    "js/objects/Game_Actor.js",
    "js/windows/Window_NameEntry.js",
  ].map(read).join("\n");

  vm.runInContext(
    `${source}\nglobalThis.__classes = { Game_Actor, Window_NameEntry };`,
    context,
  );

  const actor = new context.__classes.Game_Actor(1);
  const window = new context.__classes.Window_NameEntry(actor);

  return {
    actor,
    window,
    trigger(code) {
      triggered.clear();
      actions.clear();
      triggered.add(code);
      window.update();
      triggered.clear();
    },
    action(action) {
      triggered.clear();
      actions.clear();
      actions.add(action);
      window.update();
      actions.clear();
    },
    type(...characters) {
      textCharacters.push(...characters);
      window.update();
    },
    typeWithAction(action, character) {
      actions.clear();
      actions.add(action);
      textCharacters.push(character);
      window.update();
      actions.clear();
    },
  };
}

function testTypingReplacesDefaultAndLetterEDoesNotConfirm() {
  const harness = createHarness();

  assert.equal(harness.window.value, "Tyler");
  harness.type("R", "e");
  assert.equal(harness.window.value, "Re");
  assert.equal(harness.window.isComplete(), false);
  assert.equal(harness.actor.name, "Tyler");

  harness.type("n");
  harness.window.focus = "commands";
  harness.window.commandIndex = 2;
  harness.action("confirm");
  assert.equal(harness.window.isComplete(), true);
  assert.equal(harness.actor.name, "Ren");
}

function testBackspaceAndDefaultCommandRestoreCanonicalName() {
  const harness = createHarness();
  harness.type("N", "o", "v", "a");
  harness.trigger("Backspace");
  assert.equal(harness.window.value, "Nov");

  harness.window.focus = "commands";
  harness.window.commandIndex = 3;
  harness.action("confirm");
  assert.equal(harness.window.value, "Tyler");
  assert.equal(harness.window.isComplete(), false);

  harness.window.commandIndex = 2;
  harness.action("confirm");
  assert.equal(harness.actor.name, "Tyler");
}

function testWhitespaceAndMaximumLengthStayPresentationSafe() {
  const harness = createHarness();
  harness.type(" ", "A", " ", " ", "B");
  assert.equal(harness.window.value, "A B");

  harness.type(...Array(30).fill("Z"));
  assert.equal(
    Array.from(harness.window.value).length,
    harness.actor.nameMaxLength(),
  );
  assert.doesNotThrow(() => harness.window.draw());
}

function testSymbolsAreIgnoredUntilAValidNameCharacterIsTyped() {
  const harness = createHarness();

  harness.type("!", "@", "#");
  assert.equal(harness.window.value, "Tyler");

  harness.type("R", "_", "o", "-", "o", "k", "2");
  assert.equal(harness.window.value, "Rook");
}

function testOnScreenKeyboardAndSideCommandsAreNavigable() {
  const harness = createHarness();
  harness.window.value = "";
  harness.window.replaceOnType = false;
  harness.window.focus = "grid";
  harness.window.gridRow = 0;
  harness.window.gridColumn = 0;

  harness.trigger("Enter");
  assert.equal(harness.window.value, "A");

  harness.window.gridColumn = harness.window.keyboardRows()[0].length - 1;
  harness.action("right");
  assert.equal(harness.window.focus, "commands");
  assert.equal(harness.window.currentSideCommand(), "Space");

  harness.action("confirm");
  assert.equal(harness.window.value, "A ");

  harness.action("down");
  assert.equal(harness.window.currentSideCommand(), "Delete");
  harness.action("confirm");
  assert.equal(harness.window.value, "A");
}

function testPrintableMovementBindingsStillTypeWhileGridHasFocus() {
  const harness = createHarness();

  harness.typeWithAction("left", "a");
  harness.typeWithAction("right", "d");
  harness.typeWithAction("up", "w");
  harness.typeWithAction("down", "s");

  assert.equal(harness.window.value, "adws");
  assert.equal(harness.window.focus, "grid");
}

function testStoryRevealCanPresentCanonicalDefaultOverUnknownRuntimeName() {
  const harness = createHarness();
  harness.actor.rename("Unknown");
  const window = new harness.window.constructor(harness.actor, { startFromDefault: true });

  assert.equal(harness.actor.name, "Unknown");
  assert.equal(window.defaultValue, "Tyler");
  assert.equal(window.value, "Tyler");
}

function testReferenceStyleKeyboardContractStaysVisibleInSource() {
  const source = read("js/windows/Window_NameEntry.js");

  assert.match(source, /KEYBOARD_ROWS/);
  assert.match(source, /\["Space", "Delete", "Select", "Default"\]/);
  assert.match(source, /drawNameSlots/);
  assert.match(source, /drawKeyboard/);
  assert.match(source, /drawSideCommands/);
  assert.match(source, /Window_ActorSummary\.drawPortraitPlaceholder/);
}

function run() {
  testTypingReplacesDefaultAndLetterEDoesNotConfirm();
  testBackspaceAndDefaultCommandRestoreCanonicalName();
  testWhitespaceAndMaximumLengthStayPresentationSafe();
  testSymbolsAreIgnoredUntilAValidNameCharacterIsTyped();
  testOnScreenKeyboardAndSideCommandsAreNavigable();
  testPrintableMovementBindingsStillTypeWhileGridHasFocus();
  testStoryRevealCanPresentCanonicalDefaultOverUnknownRuntimeName();
  testReferenceStyleKeyboardContractStaysVisibleInSource();
  console.log("Name entry presentation regression tests passed.");
}

run();
