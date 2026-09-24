"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

function createContext() {
  const calls = [];
  const drawContext = {
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
    fillText(text, x, y) { calls.push(["text", String(text), x, y]); },
    measureText(text) { return { width: String(text).length * 10 }; },
  };

  const globals = {
    console,
    Graphics: { width: 1280, height: 720, context: drawContext },
    ConfigManager: {
      fieldMessageCharactersPerSecond() { return 42; },
    },
    Input: {
      isActionTriggered() { return false; },
      actionLabel(action) { return action === "confirm" ? "E / Enter" : action; },
    },
    UIAssetManager: {
      drawPanel(_context, role, x, y, width, height, options) {
        calls.push(["panel", role, x, y, width, height, options]);
        return true;
      },
      drawSelectionPanel(_context, x, y, width, height, options) {
        calls.push(["selection", x, y, width, height, options]);
        return true;
      },
    },
  };

  const context = vm.createContext(globals);
  vm.runInContext(
    `${read("js/windows/Window_Message.js")}\n` +
      `${read("js/windows/Window_Choice.js")}\n` +
      `globalThis.__classes = { Window_Message, Window_Choice };`,
    context,
  );

  return { context, calls };
}

function testDialogueUsesSharedTintablePanelRoles() {
  const harness = createContext();
  const message = new harness.context.__classes.Window_Message();
  message.show("Do you want to enter the city?", "Guard");
  message.revealAll();
  message.draw();

  const roles = harness.calls
    .filter((call) => call[0] === "panel")
    .map((call) => call[1]);

  assert.equal(roles.includes("menuPanel"), true);
  assert.equal(roles.includes("accentPanel"), true);

  const source = read("js/windows/Window_Message.js");
  assert.match(source, /UIAssetManager\.drawPanel/);
  assert.match(source, /"menuPanel"/);
  assert.match(source, /"accentPanel"/);
  assert.doesNotMatch(source, /rgba\(0, 0, 0, 0\.85\)/);
}

function testChoiceUsesSamePanelFamilyAndStandardSelectionLanguage() {
  const harness = createContext();
  const choice = new harness.context.__classes.Window_Choice();
  choice.show(["Yes", "No"]);
  choice.draw();

  assert.equal(
    harness.calls.some((call) => call[0] === "panel" && call[1] === "menuPanel"),
    true,
  );
  assert.equal(harness.calls.some((call) => call[0] === "selection"), true);
  assert.equal(
    harness.calls.some((call) => call[0] === "text" && call[1] === "▶ Yes"),
    true,
  );

  const source = read("js/windows/Window_Choice.js");
  assert.match(source, /UIAssetManager\.drawPanel/);
  assert.match(source, /UIAssetManager\.drawSelectionPanel/);
  assert.match(source, /#ffd75a/);
}


function testDialogueUsesChevronInsteadOfPersistentKeyLegend() {
  const harness = createContext();
  const message = new harness.context.__classes.Window_Message();

  message.show("One line.", "Guard", { indicatorMode: "end" });
  message.revealAll();
  message.draw();

  const texts = harness.calls
    .filter((call) => call[0] === "text")
    .map((call) => call[1]);

  assert.equal(texts.includes("▼"), true);
  assert.equal(texts.some((text) => text.includes("E / Enter")), false);

  const source = read("js/windows/Window_Message.js");
  assert.match(source, /ADVANCE_COLOR = "#7ff0d5"/);
  assert.doesNotMatch(source, /actionLabel\("confirm"\)/);
}

function testContinuationChevronBlinksButEndChevronStaysSolid() {
  const harness = createContext();
  const message = new harness.context.__classes.Window_Message();

  message.show("More follows.", "Guard", { indicatorMode: "continue" });
  message.revealAll();
  message.indicatorElapsed = 0;
  assert.equal(message.indicatorShouldDraw(), true);
  message.indicatorElapsed = 0.4;
  assert.equal(message.indicatorShouldDraw(), false);
  message.indicatorElapsed = 0.8;
  assert.equal(message.indicatorShouldDraw(), true);

  message.show("This is the stop.", "Guard", { indicatorMode: "end" });
  message.revealAll();
  message.indicatorElapsed = 999;
  assert.equal(message.indicatorShouldDraw(), true);

  message.show("Choose.", "Guard", { indicatorMode: "hidden" });
  message.revealAll();
  assert.equal(message.indicatorShouldDraw(), false);
}

function run() {
  testDialogueUsesSharedTintablePanelRoles();
  testChoiceUsesSamePanelFamilyAndStandardSelectionLanguage();
  testDialogueUsesChevronInsteadOfPersistentKeyLegend();
  testContinuationChevronBlinksButEndChevronStaysSolid();
  console.log("Field dialogue window presentation regression tests passed.");
}

run();
