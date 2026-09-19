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

On-demand map files pass through `DatabaseValidator.validateMapData()` before `Game_Map` or the event runtime can consume them. The requested map ID must match the loaded map, and current map geometry, transfers, events, pages, conditions, commands, and database references are validated at this boundary.

`Statuses.json` is runtime-active and is exposed through both numeric-ID and keyed status lookup helpers.

All indexed database accessors share the same null-safe record helper. Name helpers use one diagnostic fallback convention (`Unknown <Type> <ID>`), while keyed status lookup includes the missing key in its fallback. This keeps missing-data behavior consistent regardless of which database collection a caller uses.

## DatabaseValidator

`DatabaseValidator` protects the engine from malformed or inconsistent loaded data.

The current validator establishes field-level contracts for runtime-active actor and enemy combat data, enemy EXP/Gil/Resonance/drop rewards, battle-sprite metadata, item/equipment schemas, skill targeting/effect/combat metadata, the canonical nested status schema, encounters, Essence progression/ability/mastery definitions, and on-demand map/event data. Essence progression ordering and database references are validated before `Game_Essence` can consume them. Map validation recursively checks event pages and supported interpreter commands before world runtime objects are constructed.

Validation describes the shape and references of canonical data; it does not imply that every designed mechanic is runtime-complete. Gravity, percentage healing, and multi-hit skill metadata are now runtime-active; Essence passive metadata still belongs to later runtime passes. As new database systems become runtime-active, their validation rules should be extended here or delegated to appropriately focused helpers.

## Input

`Input` centralizes player input rather than requiring every scene or window to implement raw keyboard handling independently.

## Graphics

`Graphics` owns shared graphics and canvas-level concerns used by the engine.

## SaveManager

`SaveManager` owns serialization, migration, validation, and restoration of persistent game progress.

Save Runtime v3 serializes the full `Game_Party` actor roster rather than only the legacy leader alias. Actor state includes mutable progression, HP/MP, combat stats, equipment, learned skills, save-eligible runtime statuses, and equipped Essence progression state. Party state also persists Gil alongside inventory and active battle composition. Status restoration does not re-run initial application effects; canonical derived statuses are recomputed from restored battler state.

The loader recognizes both the legacy version-1 leader-only shape and version-2 full-party saves, migrating either into the version-3 structure before validation. Unknown/future save versions and malformed structures fail through a normal error result instead of flowing directly into state mutation. Inventory quantities and location values are normalized at the save boundary, and storage-write failures are caught by the save layer.

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

Active status instances, status-effect queries, incoming physical/magical damage modifiers, elemental-magic absorption, Reflect capability/limits, damage-triggered status removal, shared action/skill availability rules, forced-action control flags, and the combined turn-speed multiplier live at this layer because those rules apply equally to actors and enemies. Action-facing systems can calculate an attack or spell, then delegate target-side status, damage, restriction, control-authority, and speed questions to the battler instead of reimplementing status rules.

## Game_Actor

`Game_Actor` represents a playable combatant and actor-specific runtime state. Canonical starter skills come from validated `Actors.json` `initialSkills` data rather than constructor-time setup in `Game_System`. Equipment mutation is owned here, including explicit equip and unequip APIs. Actors also own the currently equipped `Game_Essence` runtime instances used by battle Resonance; player-facing Essence slot rules and UI remain future Essence Runtime work.

Actor behavior should build on shared battler behavior while retaining responsibilities that only make sense for player-controlled characters.

## Game_Enemy

`Game_Enemy` represents enemy combatants.

Enemy-specific runtime behavior, including future AI integration, belongs here or in dedicated battle/AI systems rather than being embedded into actor logic.

## Game_Party

`Game_Party` owns the player's party-level state, actor roster, leader resolution, active battle composition, inventory, Gil currency, and party operations. Leader-default actions resolve through party ownership rather than the legacy `$gameActor` global. Inventory-only reset behavior is exposed explicitly as `clearInventory()`.

It forms the runtime foundation for multi-character gameplay and future party-management features.

## Game_Essence

`Game_Essence` represents runtime Essence progression state.

The canonical Essence definitions live in `data/Essences.json`; mutable Resonance lives on `Game_Essence` instances instead of modifying database definitions. Resonance is capped at the canonical Mastery threshold, level progression is derived from validated thresholds, and the runtime reports when an Essence becomes Mastery Ready. Equipped Essence state is serialized through the owning actor in Save Runtime v3.

The complete player-facing Essence Runtime is still under development: slot/UI rules, ability grants, passives, Mastery Trials, and evolution remain later work.

## World Runtime Objects

`Game_Map`, `Game_Player`, `Game_Event`, and `Game_Interpreter` form the foundation of world exploration and event execution. Loaded map/event JSON is validated before these objects receive it, including nested event conditions and command payloads. The interpreter still performs runtime checks at mutation boundaries so direct or future callers cannot rely solely on file validation.

`Game_Switches`, `Game_SelfSwitches`, and `Game_Variables` provide persistent or event-facing state used to drive game logic. Additive variable operations normalize numeric input, while direct variable assignment remains intentionally capable of storing non-numeric event state.

`Game_System` stores broader runtime system state that belongs to the current game rather than to a single actor, map, or battle. It constructs the playable actor collection from canonical `Actors.json` records and passes that collection to `Game_Party` instead of owning individually named actor2/actor3/actor4 fields.

`$gameActor` remains initialized in `main.js` only as a backward-compatible leader alias for external or legacy integrations. Current engine systems resolve actors through `Game_Party`, battle-party controllers, or explicit actor context passed into UI windows.

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

It also owns battle-relative effect routing that requires knowledge of both sides of the encounter. Reflect is resolved here because redirecting a skill requires identifying the Reflect holder's side, choosing a living battler on the opposing side, preserving the original cast cost, and presenting the redirected result without turning reflection into a second cast. Forced-action control is coordinated here for the same reason: Berserk can begin a party action without player input, while Confuse may need a legal random target drawn from one or both battle sides. Battle-local fractional turn progress also lives here so party and enemy scheduling consume one shared Haste/Slow speed contract rather than implementing separate timing rules.

It should orchestrate battle systems rather than permanently absorbing every specialized mechanic into itself.

## BattlePartyController

`BattlePartyController` handles battle-facing party coordination and supports the multi-character battle structure. It asks `BattleManager` for the party's scheduled turn-slot queue at the start of each party side round, then advances through those slots while preserving formation order and repeated Haste turns.

## BattleTargetManager

`BattleTargetManager` owns targeting responsibilities such as selecting and resolving valid battle targets. It can also bind an already-resolved battler back into the current ally/enemy selection state, allowing forced targeting to reuse the same downstream attack and skill execution paths as manual selection.

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

Current windows include battle commands, battle items, battle magic, choices, equipment, inventory, magic, menu commands, messages, save slots, and status display. Field-menu actor windows receive explicit leader context from `Scene_Menu`; battle magic resolves its current battler through the party controller with a party-owned battle-leader fallback. Selectable list windows that can outgrow their fixed layout use the shared `Window_ListViewport` helper so keyboard selection remains visible without drawing into reserved detail regions.

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

Presentation code may use these assets through scenes, battle rendering, windows, or other future rendering systems. `Scene_Battle` reports configured battle-sprite load failures explicitly, while `BattleRenderer` falls back to a named outline placeholder so a missing visual remains diagnosable without changing combat state.

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

`Game_Actor` owns reusable skill execution details that belong to the acting battler, including MP payment, damage/healing/revival formulas, and routing a skill's `status` payload into the shared Status Runtime. Status application, refresh, removal, toggle behavior, resistance, immunity, defeated-state evaluation, revivability, and status-driven skill availability remain owned by `Game_Battler`; skill execution does not duplicate those rules.

`BattleTargetManager` asks the acting actor's shared skill-target contract whether a battler is selectable. This allows ordinary actions to continue targeting active battlers while revival can select revivable defeated battlers and status cleansing can select a defeated battler when the chosen skill can remove that defeat status.

`BattleManager` coordinates battle targeting and presentation, then consumes the status-resolution results produced by the caster so status feedback is shown without making individual skill names part of battle-flow logic. Battle outcome and reward paths consume the shared `isDefeated()` contract rather than assuming every defeated battler must have zero HP. Victory finalization owns exactly-once aggregation of EXP, Gil, item drops, and encounter Resonance; party/inventory/Essence objects own the resulting persistent state mutations.

Windows present available commands and skills to the player. `Window_BattleCommand` reads the active battler's shared action-availability rules so forbidden commands are dimmed and skipped, while `BattleManager` rechecks the same rule before execution.

## Essences

`Essences.json` defines Essence content, ability assignments, progression thresholds, passives, and mastery metadata.

`Game_Essence` owns mutable Resonance progression and Mastery-Ready state, while `Game_Actor` owns the currently equipped Essence instances. Victory finalization awards the encounter's Resonance to every equipped Essence on each surviving active battle participant exactly once.

Future Essence Runtime work will add player-facing equipment rules, Essence-granted ability availability, passives, Mastery Trials, and evolution without moving progression state back into canonical data.

## Statuses

`Statuses.json` defines Status System v1.

The active Status Runtime provides reusable application, removal, duration, countdown, derived-state, modifier, immunity/resistance, stacking, interaction, defeat-state, revival, and turn-progression behavior. `effects.countsAsDefeated` contributes to the shared defeated-state contract, while `effects.canBeRevived` controls whether a status-defined defeat can be removed through revival. `effects.haltsTurnProgression` freezes scheduled personal turns and ordinary battler-relative status progression while the halting status advances on the side-round clock so it can expire. The shared damage path consumes data-driven incoming damage, outgoing physical damage, physical accuracy, wake-on-hit, and elemental absorption properties without checking individual status names. `Game_Battler.limitGainMultiplier()` exposes the canonical Fury/Sadness/Near-Death modifier contract for the future Limit system without making Status Runtime own Limit-gauge state.

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
