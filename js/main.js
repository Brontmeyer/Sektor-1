"use strict";

async function startGame() {
  console.log("Maggot Corpse Engine starting...");

  Graphics.initialize();
  Input.initialize();
  SceneManager.initialize();

  // =====================================
  // LOAD DATABASE FIRST
  // =====================================

  await DatabaseManager.loadDatabase();

  // =====================================
  // CREATE GAME OBJECTS
  // =====================================

  window.$gameSystem = new Game_System();

  window.$gameSwitches = $gameSystem.switches;

  window.$gameVariables = $gameSystem.variables;

  window.$gameSelfSwitches = $gameSystem.selfSwitches;

  window.$gameActor = $gameSystem.actor;

  window.$gameParty = $gameSystem.party;

  // =====================================
  // START GAME
  // =====================================

  SceneManager.goto(Scene_Map);

  GameLoop.start();
}

startGame();
