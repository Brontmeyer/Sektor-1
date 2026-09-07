"use strict";

async function startGame() {
  console.log("Sektor 1 Engine starting...");

  Graphics.initialize();

  Input.initialize();

  SceneManager.initialize();

  window.$gameSystem = new Game_System();

  window.$gameActor = $gameSystem.actor;

  window.$gameParty = $gameSystem.party;

  window.$gameSwitches = $gameSystem.switches;

  window.$gameVariables = $gameSystem.variables;

  window.$gameSelfSwitches = $gameSystem.selfSwitches;

  await DatabaseManager.loadDatabase();

  SceneManager.goto(Scene_Map);

  GameLoop.start();
}

startGame();
