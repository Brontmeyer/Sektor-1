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
    Input: { isTriggered: () => false },
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

function run() {
  testChoicePromptContinuesRevealingWithoutStealingConfirm();
  testSceneMapAlwaysAdvancesMessageButDisablesMessageInputForChoice();

  console.log("Field choice prompt reveal regression tests passed.");
}

run();
