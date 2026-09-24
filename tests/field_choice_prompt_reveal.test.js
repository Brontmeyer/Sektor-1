"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

function testChoicePromptContinuesRevealingWithoutStealingConfirm() {
  let triggered = new Set(["KeyE"]);
  const context = vm.createContext({
    console,
    Graphics: { width: 1280, height: 720 },
    ConfigManager: {
      fieldMessageCharactersPerSecond() {
        return 40;
      },
    },
    Input: {
      isTriggered(code) {
        return triggered.has(code);
      },
      isActionTriggered(action) {
        return action === "confirm" &&
          (["KeyE", "Enter"].some((code) => triggered.has(code)));
      },
      actionLabel(action) { return action; },
    },
  });

  vm.runInContext(
    `${read("js/windows/Window_Message.js")}\nglobalThis.__WindowMessage = Window_Message;`,
    context,
  );

  const message = new context.__WindowMessage();
  message.show("Do you want to enter the city?", "Guard");
  message.update(0.25, { allowInput: false });

  assert.equal(message.isOpen(), true);
  assert.equal(message.visibleText().length, 10);
  assert.equal(message.isFullyRevealed(), false);

  message.update(1, { allowInput: false });
  assert.equal(message.isOpen(), true);
  assert.equal(message.isFullyRevealed(), true);

  triggered = new Set(["KeyE"]);
  message.update(0, { allowInput: false });
  assert.equal(
    message.isOpen(),
    true,
    "choice-owned confirm must not close the prompt message",
  );
}

function testSceneMapAlwaysAdvancesMessageButDisablesMessageInputForChoice() {
  const context = vm.createContext({
    console,
    Scene_Base: class {},
    Window_Message: class {},
    Window_Choice: class {},
    Game_Interpreter: class {},
    Input: { isTriggered: () => false, isActionTriggered: () => false, actionLabel: (action) => action },
    SceneManager: { push() {} },
    Scene_Menu: class {},
    DebugManager: { log() {} },
    CollisionManager: { intersects: () => false },
    Graphics: { width: 1280, height: 720, context: {} },
    DatabaseManager: {},
    Game_Map: class {},
    Game_Player: class {},
    Camera: class {},
  });

  vm.runInContext(
    `${read("js/scenes/Scene_Map.js")}\nglobalThis.__SceneMap = Scene_Map;`,
    context,
  );

  const calls = [];
  const fake = {
    loading: false,
    transferring: false,
    messageWindow: {
      isOpen: () => true,
      update(deltaTime, options) {
        calls.push(["message", deltaTime, options]);
      },
    },
    choiceWindow: {
      isOpen: () => true,
      update() {
        calls.push(["choice"]);
      },
    },
    interpreter: {
      isRunning: () => true,
      update() {
        calls.push(["interpreter"]);
      },
    },
    map: { events: [] },
    player: { update() {} },
    camera: { follow() {} },
    checkEventInteraction() {},
    checkTransfers() {},
  };

  context.__SceneMap.prototype.update.call(fake, 0.25);

  assert.equal(calls[0][0], "message");
  assert.equal(calls[0][1], 0.25);
  assert.equal(calls[0][2].allowInput, false);
  assert.equal(calls[1][0], "choice");
  assert.equal(calls[2][0], "interpreter");
}


function testInterpreterMarksSameSpeakerContinuationAndChoicePrompts() {
  const calls = [];
  const context = vm.createContext({
    console,
    DebugManager: { log() {} },
  });

  vm.runInContext(
    `${read("js/objects/Game_Interpreter.js")}\nglobalThis.__Interpreter = Game_Interpreter;`,
    context,
  );

  const messageWindow = {
    open: false,
    isOpen() { return this.open; },
    show(text, speaker, options) {
      calls.push(["show", text, speaker, options]);
      this.open = true;
    },
    hide() { this.open = false; },
  };
  const choiceWindow = {
    open: false,
    result: null,
    isOpen() { return this.open; },
    hasResult() { return this.result !== null; },
    getResult() { return this.result; },
    clearResult() { this.result = null; },
    show(choices) { calls.push(["choices", choices]); this.open = true; },
  };

  const interpreter = new context.__Interpreter(messageWindow, choiceWindow);
  interpreter.setup([
    { code: "text", speaker: "Guard", text: "First." },
    { code: "text", speaker: "Guard", text: "Second." },
    { code: "text", speaker: "Merchant", text: "Different speaker." },
  ]);

  interpreter.update();
  assert.equal(calls[0][3].indicatorMode, "continue");

  messageWindow.open = false;
  interpreter.update();
  assert.equal(calls[1][3].indicatorMode, "end");

  const choiceInterpreter = new context.__Interpreter(messageWindow, choiceWindow);
  messageWindow.open = false;
  choiceWindow.open = false;
  choiceInterpreter.setup([
    {
      code: "choice",
      speaker: "Guard",
      prompt: "Enter?",
      choices: [{ text: "Yes", commands: [] }],
    },
  ]);
  choiceInterpreter.update();
  const choiceShow = calls.find((call) => call[0] === "show" && call[1] === "Enter?");
  assert.equal(choiceShow[3].indicatorMode, "hidden");
}

function testChoiceAppearsOnlyAfterPromptIsFullyRevealedAndConfirmDoesNotLeak() {
  let triggered = new Set();
  const drawContext = {
    font: "24px sans-serif",
    measureText(text) { return { width: String(text).length * 10 }; },
    save() {}, restore() {}, fillRect() {}, strokeRect() {}, fillText() {},
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
  };
  const context = vm.createContext({
    console,
    Graphics: { width: 1280, height: 720, context: drawContext },
    ConfigManager: { fieldMessageCharactersPerSecond() { return 20; } },
    Input: {
      isTriggered(code) { return triggered.has(code); },
      isActionTriggered(action) {
        return action === "confirm" && ["KeyE", "Enter"].some((code) => triggered.has(code));
      },
      actionLabel(action) { return action; },
    },
    DebugManager: { log() {} },
  });

  vm.runInContext(
    `${read("js/core/UIThemePalette.js")}\n` +
      `${read("js/windows/Window_TextLayout.js")}\n` +
      `${read("js/windows/Window_Message.js")}\n` +
      `${read("js/windows/Window_Choice.js")}\n` +
      `${read("js/objects/Game_Interpreter.js")}\n` +
      `globalThis.__classes = { Window_Message, Window_Choice, Game_Interpreter };`,
    context,
  );

  const message = new context.__classes.Window_Message();
  const choice = new context.__classes.Window_Choice();
  const interpreter = new context.__classes.Game_Interpreter(message, choice);
  interpreter.setup([{
    code: "choice",
    speaker: "Guard",
    prompt: "Do you want to enter the city?",
    choices: [
      { text: "Yes", commands: [] },
      { text: "No", commands: [] },
    ],
  }]);

  interpreter.update();
  assert.equal(message.isOpen(), true);
  assert.equal(choice.isOpen(), false, "choice must not appear with unrevealed prompt text");

  triggered = new Set(["KeyE"]);
  message.update(0, { allowInput: true });
  choice.update();
  interpreter.update();

  assert.equal(message.isMessageFullyRevealed(), true);
  assert.equal(choice.isOpen(), true, "choice opens only after the prompt has fully revealed");
  assert.equal(choice.hasResult(), false, "the reveal press must not choose the default option");

  triggered = new Set();
  choice.update();
  assert.equal(choice.hasResult(), false);
}

function run() {
  testChoicePromptContinuesRevealingWithoutStealingConfirm();
  testSceneMapAlwaysAdvancesMessageButDisablesMessageInputForChoice();
  testInterpreterMarksSameSpeakerContinuationAndChoicePrompts();
  testChoiceAppearsOnlyAfterPromptIsFullyRevealedAndConfirmDoesNotLeak();

  console.log("Field choice prompt reveal regression tests passed.");
}

run();
