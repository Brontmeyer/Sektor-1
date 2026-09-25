"use strict";

async function startGame() {
  DebugManager.log("Corpse Engine starting...");

  Graphics.initialize();
  Input.initialize();
  ConfigManager.initialize();
  SceneManager.initialize();

  // Presentation assets load before the first scene. Failures are non-fatal:
  // every consumer retains its existing vector/fallback rendering path.
  await UIAssetManager.initialize();

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

  // Backward-compatible leader alias for external/legacy integrations.
  // Current engine runtime resolves actor ownership through $gameParty.
  window.$gameActor = $gameParty.leader();

  // =====================================
  // START GAME
  // =====================================

  // Identity is now story-driven. A new game enters the map immediately with
  // the protagonist's configured unidentified display name. Story events use
  // the reusable nameActor command when the character learns/chooses a name.
  SceneManager.goto(Scene_Map);

  GameLoop.start();
}

startGame();
