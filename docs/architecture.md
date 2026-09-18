# 🏗️ Sektor 1 Architecture

This document describes the technical structure of the Sektor 1 engine, the responsibilities of its major layers, and the relationships between game data, runtime objects, gameplay systems, scenes, and presentation.

It documents the architecture that exists now while clearly separating systems that are still planned or under development.

---

# 🧭 Architectural Principle

Sektor 1 follows a simple separation of responsibilities:

> **Data defines what game content is. Runtime systems define how that content behaves. Scenes coordinate gameplay flow. Rendering and windows present the result to the player.**

The engine is intentionally modular. A feature should live in the layer that owns its responsibility rather than spreading its logic throughout unrelated files.

This keeps systems easier to understand, test, replace, and expand as the game grows.

---

# 🗺️ Layer Map

At a high level, Sektor 1 is organized like this:

```text
JSON Game Data
      ↓
DatabaseManager / DatabaseValidator
      ↓
Runtime Game Objects
      ↓
Gameplay Systems and Managers
      ↓
Scenes
      ↓
Windows / Battle Rendering / Canvas
      ↓
Player
```

The flow is not strictly one-way in every case. Player input enters through the input layer and scenes coordinate changes to runtime state, but the diagram represents the primary ownership of game information.

The major project directories are:

```text
data/          Canonical game-content definitions
js/core/       Engine-wide services and managers
js/objects/    Runtime game-state objects
js/battle/     Battle-specific systems
js/scenes/     High-level game-flow controllers
js/windows/    Menus and interactive UI windows
js/sprites/    Visual game assets
```

---

# 🗃️ Data Layer

The `data/` directory contains definitions used by the engine to construct and operate on game content.

Examples include:

```text
data/Actors.json
data/Armors.json
data/Encounters.json
data/Enemies.json
data/Essences.json
data/Items.json
data/MapInfos.json
data/Skills.json
data/Statuses.json
data/System.json
data/Weapons.json
```

Map data is also stored as JSON files such as `Map001.json` and `Map002.json`.

## Canonical Gameplay Databases

The current major gameplay databases are:

```text
data/Skills.json
data/Essences.json
data/Statuses.json
```

These files are the canonical definitions of their game content. Documentation may explain their design and behavior, but should not duplicate them as a second source of truth.

The data layer should answer questions such as:

- What is this skill?
- Which abilities belong to this Essence?
- What properties define this status?
- What are an actor's base definitions?
- What item or equipment entry corresponds to an ID?

It should not become the place where large pieces of runtime control flow are implemented.

---

# ⚙️ Core Engine Layer

The `js/core/` directory contains engine-wide services that are not owned by one specific gameplay object or scene.

Current core modules include:

```text
Camera.js
CollisionManager.js
DatabaseManager.js
DatabaseValidator.js
DebugManager.js
GameLoop.js
Graphics.js
Input.js
SaveManager.js
SceneManager.js
```

## GameLoop

`GameLoop` drives the engine's repeating update cycle.

It provides the heartbeat through which the active game state can continue updating and rendering.

## SceneManager

`SceneManager` owns high-level scene transitions and the currently active scene.

Scenes should not need to manually recreate the entire application lifecycle when moving between map, menu, battle, or other future game states.

`SceneManager.startBattle(encounterId)` is the authoritative battle-entry API.
It resolves validated encounter data before pushing `Scene_Battle`, keeping map
events independent from battle-scene construction details.

## DatabaseManager

`DatabaseManager` loads JSON databases and exposes convenient accessors for loaded game definitions.

At the current stage of development it loads system, map, item, actor, weapon, armor, skill, Essence, status, enemy, and encounter data.

`Statuses.json` is runtime-active and is exposed through both numeric-ID and keyed status lookup helpers.

## DatabaseValidator

`DatabaseValidator` protects the engine from malformed or inconsistent loaded data.

As new database systems become runtime-active, their validation rules should be added here or delegated to appropriately focused validation helpers.

## Input

`Input` centralizes player input rather than requiring every scene or window to implement raw keyboard handling independently.

## Graphics

`Graphics` owns shared graphics and canvas-level concerns used by the engine.

## SaveManager

`SaveManager` owns serialization and restoration of persistent game progress.

Save data should represent runtime state that must survive between sessions rather than duplicating canonical database definitions unnecessarily.

## CollisionManager and Camera

`CollisionManager` provides shared collision responsibilities for world movement.

`Camera` provides shared camera behavior for the game world.

## DebugManager

`DebugManager` centralizes development logging and debug behavior so diagnostic output can be controlled without scattering debug switches throughout the engine.

---

# 🧩 Runtime Object Layer

The `js/objects/` directory contains objects representing active game state.

Current runtime objects include:

```text
Game_Actor.js
Game_Battler.js
Game_Enemy.js
Game_Essence.js
Game_Event.js
Game_Interpreter.js
Game_Map.js
Game_Party.js
Game_Player.js
Game_SelfSwitches.js
Game_Switches.js
Game_System.js
Game_Variables.js
```

## Game_Battler

`Game_Battler` is the shared battler foundation.

Battle behavior that is genuinely common to actors and enemies belongs at this level rather than being independently duplicated in both actor and enemy implementations.

Active status instances, status-effect queries, incoming physical/magical damage modifiers, elemental-magic absorption, Reflect capability/limits, and damage-triggered status removal live at this layer because those rules apply equally to actors and enemies. Action-facing systems can calculate an attack or spell, then delegate target-side status and damage questions to the battler instead of reimplementing defensive status rules.

## Game_Actor

`Game_Actor` represents a playable combatant and actor-specific runtime state.

Actor behavior should build on shared battler behavior while retaining responsibilities that only make sense for player-controlled characters.

## Game_Enemy

`Game_Enemy` represents enemy combatants.

Enemy-specific runtime behavior, including future AI integration, belongs here or in dedicated battle/AI systems rather than being embedded into actor logic.

## Game_Party

`Game_Party` owns the player's party-level state and party operations.

It forms the runtime foundation for multi-character gameplay and future party-management features.

## Game_Essence

`Game_Essence` represents runtime Essence state.

The canonical Essence definitions live in `data/Essences.json`; runtime information such as owned Essence progression should be represented through game state rather than by modifying the canonical database definitions during play.

The complete Essence Runtime system is still under development.

## World Runtime Objects

`Game_Map`, `Game_Player`, `Game_Event`, and `Game_Interpreter` form the foundation of world exploration and event execution.

`Game_Switches`, `Game_SelfSwitches`, and `Game_Variables` provide persistent or event-facing state used to drive game logic.

`Game_System` stores broader runtime system state that belongs to the current game rather than to a single actor, map, or battle.

---

# ⚔️ Battle Layer

Battle-specific responsibilities live primarily in `js/battle/`.

Current battle modules include:

```text
BattleAnimationController.js
BattleEffects.js
BattleManager.js
BattlePartyController.js
BattleRenderer.js
BattleTargetManager.js
```

The battle layer should coordinate combat without turning one file into a container for every battle mechanic.

## BattleManager

`BattleManager` coordinates the overall battle state and battle flow.

It also owns battle-relative effect routing that requires knowledge of both sides of the encounter. Reflect is resolved here because redirecting a skill requires identifying the Reflect holder's side, choosing a living battler on the opposing side, preserving the original cast cost, and presenting the redirected result without turning reflection into a second cast.

It should orchestrate battle systems rather than permanently absorbing every specialized mechanic into itself.

## BattlePartyController

`BattlePartyController` handles battle-facing party coordination and supports the multi-character battle structure.

## BattleTargetManager

`BattleTargetManager` owns targeting responsibilities such as selecting and resolving valid battle targets.

Targeting rules should remain centralized enough that skills, items, and future battle systems can use consistent target behavior.

## BattleEffects

`BattleEffects` handles battle effect resolution responsibilities.

As Skills, Statuses, and Essences gain more runtime behavior, reusable effect mechanics should be preferred over hard-coded branches for individual named abilities whenever practical.

## BattleAnimationController

`BattleAnimationController` coordinates battle animation behavior separately from the underlying gameplay result.

A skill's mechanical resolution and its visual presentation should remain separable so visual changes do not require rewriting game rules.

## BattleRenderer

`BattleRenderer` presents the visual battle state.

Rendering should read battle state and display it rather than becoming the authoritative owner of battle rules.

---

# 🎬 Scene Layer

The `js/scenes/` directory contains high-level gameplay states.

Current scenes include:

```text
Scene_Base.js
Scene_Battle.js
Scene_Map.js
Scene_Menu.js
```

## Scene_Base

`Scene_Base` provides shared scene behavior.

## Scene_Map

`Scene_Map` coordinates world exploration and map-facing gameplay.

## Scene_Menu

`Scene_Menu` coordinates the main menu experience and its windows.

## Scene_Battle

`Scene_Battle` coordinates the battle experience between battle systems, player commands, windows, and presentation.

A scene may coordinate several systems, but it should avoid becoming the permanent implementation home for mechanics that logically belong to battlers, targeting, effects, data, or other dedicated modules.

---

# 🪟 Window and UI Layer

The `js/windows/` directory contains interactive menus and UI windows.

Current windows include battle commands, battle items, battle magic, choices, equipment, inventory, magic, menu commands, messages, save slots, and status display.

Windows should primarily be responsible for:

- Displaying information
- Accepting player selection
- Managing UI navigation
- Reporting player choices back to the controlling scene or system

They should not become the canonical owner of gameplay rules simply because those rules are visible in the interface.

For example, a magic window may display whether a skill is usable, but the underlying rule that determines usability should live in an appropriate gameplay layer.

---

# 🖼️ Assets and Presentation

Visual assets are stored under `js/sprites/`, currently including actor and enemy battle sprites.

Presentation code may use these assets through scenes, battle rendering, windows, or other future rendering systems.

Game mechanics should not depend on a particular sprite existing in order to determine their mechanical result.

---

# 💾 Canonical Data vs Runtime State

Sektor 1 distinguishes between definitions and state.

A canonical database entry describes what something is. Runtime state describes what is happening to a particular instance during the current game.

For example:

```text
Essences.json
    ↓ defines
Healing Essence
    ↓ instantiated/tracked as
player-owned Essence progression
```

Likewise:

```text
Statuses.json
    ↓ defines
Poison
    ↓ runtime system applies
Poison on a particular battler with active duration/state
```

Canonical JSON files should not be mutated during gameplay to represent temporary or save-specific changes.

Runtime state that must persist should be captured by the save system.

---

# 🔗 System Relationships

Several major systems intentionally cross architectural boundaries while retaining clear ownership.

## Skills

`Skills.json` defines skills.

`Game_Actor` owns reusable skill execution details that belong to the acting battler, including MP payment, damage/healing formulas, and routing a skill's `status` payload into the shared Status Runtime. Status application, refresh, removal, toggle behavior, resistance, and immunity remain owned by `Game_Battler`; skill execution does not duplicate those rules.

`BattleManager` coordinates battle targeting and presentation, then consumes the status-resolution results produced by the caster so status feedback is shown without making individual skill names part of battle-flow logic.

Windows present available skills to the player.

## Essences

`Essences.json` defines Essence content, ability assignments, progression thresholds, passives, and mastery metadata.

`Game_Essence` and the future Essence Runtime system own active progression and runtime interpretation of those definitions.

Battle systems consume Essence-granted abilities and passive effects where appropriate.

## Statuses

`Statuses.json` defines Status System v1.

The active Status Runtime provides reusable application, removal, duration, countdown, derived-state, modifier, immunity/resistance, stacking, and interaction behavior. The shared damage path consumes data-driven incoming damage, outgoing physical damage, physical accuracy, wake-on-hit, and elemental absorption properties without checking individual status names.

Battlers own their active status state while battle systems trigger and coordinate status effects at the appropriate points in combat.

UI systems will display the result without owning the underlying rules.

---

# 📐 Dependency and Responsibility Rules

When adding a new feature, prefer the narrowest layer that genuinely owns the behavior.

Use these rules as a guide:

1. **Content definition belongs in data.**
   A new skill, Essence, status, item, enemy, or equipment entry should normally begin as data rather than a named hard-coded branch.

2. **Persistent game state belongs in runtime objects and saves.**
   Do not modify canonical JSON to remember what happened in one player's game.

3. **Shared battler mechanics belong at the shared battler level.**
   Avoid implementing the same combat rule separately for actors and enemies when both use it.

4. **Battle coordination belongs in battle systems.**
   Specialized responsibilities such as targeting, effects, animation, and rendering should remain separated where practical.

5. **Scenes coordinate.**
   A scene connects systems and controls flow, but should not become the default home for unrelated mechanics.

6. **Windows present and collect choices.**
   UI code should not silently become the source of gameplay truth.

7. **Rendering presents results.**
   Visual code should not determine mechanical outcomes.

8. **Prefer reusable mechanics over named exceptions.**
   If several skills or statuses can share one engine behavior, represent that behavior generically and drive it from data.

9. **Keep unfinished architecture explicit.**
   Documentation must distinguish implemented systems from planned systems instead of describing future work as already functional.

---

# 🚧 Planned Architecture

The following systems are part of Sektor 1's intended architecture but are not yet complete runtime systems.

## Status System Runtime

The current development focus is turning `Statuses.json` into active reusable battle behavior.

Planned responsibilities include:

- Database loading and validation
- Status application and removal
- Duration processing
- Countdown processing
- Derived-status evaluation
- Immunity and resistance handling
- Status stacking and interactions
- Battler status state
- Battle hooks for status effects
- UI status indicators
- Special interaction rules such as Fury/Sadness mutual exclusion
- Post-battle Death recovery behavior

## Essence Runtime

Future Essence work will connect the completed Essence design to gameplay systems including:

- Equipping Essences
- Resonance gain
- Level progression
- Ability availability
- Passive activation
- Mastery Ready state
- Mastery Trials
- Mastered state
- Essence Evolution

## Enemy AI and Boss Systems

Enemy decision-making and boss-specific mechanics should build on the existing battler and battle foundations without requiring separate battle engines.

## Event and Cutscene Expansion

The existing map, event, interpreter, switch, variable, and scene foundations can be expanded as world exploration, scripted sequences, quests, towns, dungeons, and story content grow.

## Additional Battle Systems

Future battle architecture is expected to support systems such as:

- Summon Magic
- Limit Skills
- Party switching
- Dual Techniques
- More advanced enemy and boss behavior

These systems should follow the same responsibility boundaries established by the current architecture.

---

# 🧱 Architectural Goal

Sektor 1 is not intended to become a collection of isolated special cases.

The architecture should allow a growing amount of game content to be expressed through stable, reusable systems.

When a new feature is added, the preferred question is not:

> "Where can this code be made to work?"

It is:

> **"Which system should own this responsibility?"**

Keeping that distinction clear is what allows Sektor 1 to grow without making every new feature harder to build than the last.

---

Built with ❤️ by **Sarah & Tyler**
