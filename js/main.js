"use strict";

async function startGame() {
  console.log("Sektor 1 Engine starting...");

  Graphics.initialize();

  Input.initialize();

  SceneManager.initialize();

  window.$gameSystem = new Game_System();

  window.$gameSwitches = $gameSystem.switches;

  window.$gameVariables = $gameSystem.variables;

  await DatabaseManager.loadDatabase();

  SceneManager.goto(Scene_Map);

  GameLoop.start();
}

startGame();
