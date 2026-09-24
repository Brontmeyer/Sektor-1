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

  // New games begin with the protagonist's canonical database name selected.
  // Enter accepts it immediately; typing replaces it. The same generic scene
  // can later be pushed by recruitment events for companion naming.
  SceneManager.goto(Scene_NameEntry, 1, {
    title: "NAME YOUR HERO",
    prompt: "Choose the name your protagonist will use throughout Sektor 1.",
    onComplete() {
      // Do not count time spent on the mandatory new-game identity screen as
      // play time. Future in-story naming scenes keep the existing clock.
      $gameSystem.setPlayTimeSeconds(0);
      SceneManager.goto(Scene_Map);
    },
  });

  GameLoop.start();
}

startGame();
