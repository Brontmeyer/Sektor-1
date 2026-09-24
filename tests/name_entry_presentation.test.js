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
      triggered.add(code);
      window.update();
      triggered.clear();
    },
    type(...characters) {
      textCharacters.push(...characters);
      window.update();
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
  harness.trigger("Enter");
  assert.equal(harness.window.isComplete(), true);
  assert.equal(harness.actor.name, "Ren");
}

function testBackspaceAndEscapeRestoreDefaultWithoutLeavingNameScreen() {
  const harness = createHarness();
  harness.type("N", "o", "v", "a");
  harness.trigger("Backspace");
  assert.equal(harness.window.value, "Nov");

  harness.trigger("Escape");
  assert.equal(harness.window.value, "Tyler");
  assert.equal(harness.window.isComplete(), false);

  harness.trigger("Enter");
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

function run() {
  testTypingReplacesDefaultAndLetterEDoesNotConfirm();
  testBackspaceAndEscapeRestoreDefaultWithoutLeavingNameScreen();
  testWhitespaceAndMaximumLengthStayPresentationSafe();
  console.log("Name entry presentation regression tests passed.");
}

run();
