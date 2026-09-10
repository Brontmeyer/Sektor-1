"use strict";

async function startGame() {
  DebugManager.log("Maggot Corpse Engine starting...");

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

  window.$gameParty = $gameSystem.party;

  // Backward-compatible leader alias. Existing systems can keep using
  // $gameActor while party-aware systems use $gameParty.battleMembers().
  window.$gameActor = $gameParty.leader() || $gameSystem.actor;

  // =====================================
  // START GAME
  // =====================================

  SceneManager.goto(Scene_Map);

  GameLoop.start();
}

startGame();
