# Sektor 1 — Audit Improvement Pass 1

This build applies the first low-risk/high-value fixes from the full project audit.

## Battle correctness
- Removed the duplicate `updateBattleEffect(deltaTime)` call, so battle effects no longer advance twice per frame.
- Magic victory now requires every enemy to be defeated, matching normal Attack victory behavior.
- Enemy turn sequencing now stops immediately when the player is defeated.
- Pending enemy turns are cancelled while battle is already in victory/defeat state.
- Multi-target damaging magic now distinguishes allies from enemies when applying hurt/defeat state.
- All-target mode (`R`) is limited to Magic targeting for now; Attack remains single-target until physical multi-target actions are intentionally designed.
- Cancelling target selection resets target side/scope to Enemy + Single.

## First Scene_Battle modularization
- Added `js/battle/BattleTargetManager.js`.
- Moved target lookup, living-enemy selection, target cycling, and current-target resolution out of `Scene_Battle.js`.
- `Scene_Battle.js` now delegates those responsibilities to `BattleTargetManager`.
- Added the new battle-system script to `index.html` before `Scene_Battle.js`.

## General project fixes
- Save/load confirmation timing in `Scene_Menu` is now delta-time based (3 seconds) instead of frame-count based (180 frames).
- `Window_Message.drawWrappedText()` now respects explicit newline characters while still wrapping long lines.
- Solid map events now participate in player collision through `Game_Map.getCollisionObstacles()`.

## Validation performed
- Every JavaScript file passes `node --check`.
- Every JSON file in `data/` parses successfully.

## Intentionally deferred to later passes
- Per-enemy sprite image cache / battles with different enemy species.
- Full per-enemy animation-state migration and removal of the legacy enemy-state bridge.
- `BattleEffects`, `BattleAnimationController`, `BattleRenderer`, and `BattleManager` extraction.
- Shared `Game_Battler` base class.
- Further data cleanup and asset archival.

Runtime-test this build before the next extraction pass. Recommended checks: map movement/collision, messages, save confirmation, Attack targeting, Fire single/all on enemy/ally, enemy turns, victory, defeat, and returning to the map.

## Improvement Pass 2 — BattleEffects extraction

- Added `js/battle/BattleEffects.js`.
- Moved battle-effect lifetime/update logic out of `Scene_Battle.js`.
- Moved Fire rendering, Cure rendering, and multi-target Fire rendering out of `Scene_Battle.js`.
- `Scene_Battle.js` now owns only thin delegation methods for starting/updating/drawing battle effects.
- Added `BattleEffects.js` to `index.html` before `Scene_Battle.js`.
- Preserved current Fire/Cure timing, actor/enemy positioning, and All-target visuals.
- Reduced `Scene_Battle.js` from 1,945 lines to 1,687 lines.
- Re-ran JavaScript syntax checks and JSON parsing checks after extraction.

### Recommended browser regression test for Pass 2

1. Start a test battle.
2. Cast Fire on one enemy.
3. Cast Fire with All on both enemies.
4. Cast Fire on the ally side.
5. Cast Cure.
6. Confirm effects disappear normally and battle input resumes.
7. Win and leave the battle.

## Improvement Pass 3 — BattleAnimationController extraction

- Added `js/battle/BattleAnimationController.js`.
- Moved battler state timers, actor/enemy animation-frame updates, visual movement, state setters, and animation metadata out of `Scene_Battle.js`.
- `Scene_Battle.js` keeps thin delegation methods so existing battle/action/render code can continue calling the same method names without a risky rewrite.
- Preserved the existing per-enemy battle-data model and the temporary legacy active-enemy bridge for compatibility; the bridge will be removed only after enemy rendering is fully migrated.
- Added `BattleAnimationController.js` to `index.html` before `Scene_Battle.js`.
- Re-ran JavaScript syntax checks and JSON parsing checks after extraction.

### Recommended browser regression test for Pass 3

1. Start a battle and watch actor/enemy idle animation.
2. Attack each enemy and confirm lunge, hurt, return, and input unlock.
3. Cast Fire single/all and confirm hurt states and effect timing.
4. Cast Fire on the ally and confirm actor hurt pose/recoil.
5. Cast Cure and use an item; confirm actor cast/use motion still matches the previous build.
6. Let both enemies attack and confirm their movement/state timers still reset.
7. Win and lose a battle and confirm defeat/victory flow still works.


## Improvement Pass 4 — Battle Renderer extraction

- Added `js/battle/BattleRenderer.js`.
- Moved battle presentation/rendering out of `Scene_Battle.js`: actor/enemy sprites, enemy groups, target cursors, front/side layouts, HUD, battle effects, messages, command windows, and test-battle hint.
- `Scene_Battle.js` now delegates rendering to `BattleRenderer`, reducing it from 1,377 lines to about 1,010 lines.
- Updated `index.html` load order so `BattleRenderer.js` loads before `Scene_Battle.js`.
- Improved enemy sprite rendering to pass each enemy's `battleData` into the renderer and use that enemy's own animation state row. This advances the per-enemy animation migration without removing the legacy compatibility bridge yet.
- Preserved the existing battle layout, target cursor positions, HUD, Fire/Cure effects, and command-window behavior.
- Revalidated JavaScript syntax and JSON parsing after the extraction.

## Improvement Pass 5 — Battle Manager extraction

- Added `js/battle/BattleManager.js`.
- Moved battle action/turn-flow responsibilities out of `Scene_Battle.js`, including:
  - attack sequencing and damage resolution,
  - magic action resolution,
  - item action resolution,
  - enemy-turn sequencing,
  - pending enemy-turn timing,
  - action-phase progression,
  - command execution for Attack/Magic/Item.
- `Scene_Battle.js` now delegates those responsibilities to `BattleManager` and acts much more like a scene coordinator.
- Reduced `Scene_Battle.js` from about 1,010 lines to about 492 lines.
- Added `BattleManager.js` to `index.html` before `Scene_Battle.js`.
- Removed a duplicate `setActorState("magic", 0.9)` call in the Magic command path.
- Updated remaining battle victory checks in the moved action flow to use the full enemy group instead of only the currently selected enemy where appropriate.
- Preserved the existing targeting, animation, rendering, Fire/Cure effects, item behavior, enemy-turn delays, and action timings.
- Kept compatibility delegate methods on `Scene_Battle` so existing components can continue using the same scene API during later cleanup passes.
- Revalidated all JavaScript syntax and all JSON database files after the extraction.

### Recommended browser regression test for Pass 5

1. Start a battle and use Attack on each enemy.
2. Cast Fire on one enemy, All enemies, and the ally side.
3. Cast Cure and use both battle items.
4. Let both enemies take turns and confirm turn order returns to the player.
5. Defeat one enemy first, then the other, and confirm victory only happens when all enemies are defeated.
6. Let the player be defeated and confirm no later enemy continues attacking.
7. Cancel targeting/windows with Q/Escape and confirm input returns normally.
8. Leave victory/defeat and confirm the map scene restores correctly.


## Improvement Pass 6 — Battle cleanup and consolidation

- Removed the legacy single-enemy animation/state fields from `Scene_Battle`: `enemyState`, `enemyStateTimer`, `enemyAnimationFrame`, `enemyAnimationTimer`, and `enemyVisualX`.
- Removed the temporary compatibility bridge from `BattleAnimationController.setEnemyState()`. Enemy state/timers/frames/visual offsets now live exclusively in each enemy's `enemyBattleData`.
- Updated `BattleEffects` so effects follow the actual target enemy's per-enemy visual offset.
- Updated `BattleRenderer` to render an explicit enemy object instead of temporarily swapping `scene.enemy`.
- Replaced the single shared enemy image with an enemy sprite-image cache keyed by sprite filename. This prepares battles for multiple different enemy species without forcing them to share one sprite.
- Made enemy visual alpha target-specific.
- Fixed `BattleManager.performEnemyTurn()`'s default enemy lookup to use the battle scene's enemy list.
- Decoupled single-target magic resolution from the selected-enemy alias so it resolves directly against the actual target object.
- Updated Cure's database target metadata from `["ally", "enemy"]` to `["ally"]` so the data matches its current battle behavior.
- Removed the unused `getBattleAnimationFrameDuration()` compatibility method.
- Kept `Player_Battle_.png` untouched even though it is currently unreferenced; no user asset was deleted in this pass.

### Recommended browser regression test for Pass 6

1. Attack each enemy and confirm independent hurt/defeat animation state.
2. Cast Fire on the first enemy, second enemy, All enemies, and the ally.
3. Confirm Fire effects follow each enemy correctly while they move/recoil.
4. Cast Cure and verify ally healing still behaves normally.
5. Let both enemies attack and confirm each animation/turn is independent.
6. Defeat one enemy and continue fighting the other.
7. Confirm victory, defeat, and return-to-map flow.

## Pass 7 — Engine foundation and data-safety cleanup

This pass moves beyond the original Scene_Battle rescue and strengthens shared engine foundations without changing intended gameplay.

### Added `js/objects/Game_Battler.js`
- Introduced a shared base class for `Game_Actor` and `Game_Enemy`.
- Centralized common HP/MP state and helpers.
- Centralized shared physical/magic stat calculations.
- Added `isAlive()`, `hpRate()`, and `mpRate()` helpers for future party/HUD systems.
- `Game_Actor` keeps actor-only equipment, skills, EXP, growth, and equipment-aware Attack/Defense overrides.
- `Game_Enemy` now contains only enemy-specific database/sprite setup and inherits normal battler behavior.

### Added `js/core/DatabaseValidator.js`
- Database validation now runs automatically after the JSON database is loaded.
- Checks indexed database IDs and names.
- Checks `System.startMapId` and battle-view values.
- Checks map-info IDs/files for malformed or duplicate entries.
- Checks skill target types, scopes, and MP costs.
- Future malformed database edits should now fail early with a useful startup error instead of producing a harder-to-trace runtime bug.

### Added `js/core/DebugManager.js`
- Routed normal development `console.log` output through one debug switch.
- Added `debugMode` to `data/System.json` and left it `true` so current development behavior is unchanged.
- Set `"debugMode": false` later to silence normal development logs.
- Warnings and errors intentionally remain visible regardless of debug mode.

### Load-order updates
- `DebugManager.js` loads first in the Core section.
- `DatabaseValidator.js` loads before `DatabaseManager.js`.
- `Game_Battler.js` loads before `Game_Actor.js` and `Game_Enemy.js`.

### Validation performed
- Every JavaScript file passes `node --check`.
- Every JSON database file parses successfully.
- Every script referenced by `index.html` exists.
- Current database passes the new runtime validator.
- Actor/enemy inheritance and shared HP/MP/stat behavior were exercised in a Node VM sanity test.

### Recommended browser regression test
1. Start a new game/map and confirm normal startup.
2. Open menu/status/equipment/inventory/magic.
3. Save and load an existing slot.
4. Start battle and test Attack, Fire, Cure, Items, enemy turns, victory, and defeat.
5. Check DevTools: normal development logs should still appear because `System.debugMode` is currently `true`.


## Pass 8 — Party System Foundation

- Added a real party roster to `Game_Party` while preserving the existing single-player behavior.
- Added separate active battle-member IDs with a three-member maximum.
- Added party APIs: `members()`, `leader()`, `actorById()`, `battleMembers()`, `livingBattleMembers()`, `battleLeader()`, `battleMemberIndex()`, `addActor()`, `removeActor()`, and `setBattleActorIds()`.
- `Game_System` now registers the current actor with the party at startup.
- `$gameActor` remains a backward-compatible alias to the party leader so existing menus/battle code continue to work.
- Save data now records the active battle-party IDs while remaining compatible with older saves that do not contain them.
- Expanded `BattleTargetManager` with ally selection, ally cycling, and All Allies support.
- Added `selectedAllyIndex` and ally W/S target cycling to `Scene_Battle`.
- Added reusable ally battle-position helpers for up to three active members.
- Battle target cursors now use party member positions instead of hard-coded player-only coordinates.
- Battle HUD now reads from `battleMembers()` and is ready to display up to three member status blocks.
- Fire/Cure effect positioning now recognizes any active party member as an ally target.
- Enemy attacks now select a living active party member instead of being permanently hard-wired to `$gameActor`.
- Defeat checks now use the active party as a group.

### Intentionally deferred

Pass 8 prepares the architecture but does not add Actor #2 or #3 yet. The current actor remains the only active member, so existing battle visuals and action ownership remain unchanged. Per-actor battle animation state, individual actor sprite caches, turn ownership, and a PHS-style roster screen should be added when additional actors actually exist.
