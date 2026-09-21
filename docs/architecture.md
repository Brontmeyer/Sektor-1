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
data/Accessories.json
data/Actors.json
data/Armors.json
data/Encounters.json
data/Enemies.json
data/Essences.json
data/Items.json
data/MapInfos.json
data/Magick.json
data/Skills.json
data/Statuses.json
data/System.json
data/Weapons.json
```

Map data is also stored as JSON files such as `Map001.json` and `Map002.json`.

## Canonical Gameplay Databases

The current major gameplay databases are:

```text
data/Magick.json
data/Skills.json
data/Essences.json
data/Statuses.json
```

These files are the canonical definitions of their game content. Documentation may explain their design and behavior, but should not duplicate them as a second source of truth.

The data layer should answer questions such as:

- What is this Magick?
- What is this non-Magick Skill?
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

At the current stage of development it loads system, map, item, actor, weapon, armor, accessory, Magick, Skills, Essence, status, enemy, and encounter data.

On-demand map files pass through `DatabaseValidator.validateMapData()` before `Game_Map` or the event runtime can consume them. The requested map ID must match the loaded map, and current map geometry, transfers, events, pages, conditions, commands, and database references are validated at this boundary.

`Statuses.json` is runtime-active and is exposed through both numeric-ID and keyed status lookup helpers.

All indexed database accessors share the same null-safe record helper. Name helpers use one diagnostic fallback convention (`Unknown <Type> <ID>`), while keyed status lookup includes the missing key in its fallback. This keeps missing-data behavior consistent regardless of which database collection a caller uses.

## DatabaseValidator

`DatabaseValidator` protects the engine from malformed or inconsistent loaded data.

The current validator establishes field-level contracts for runtime-active actor and enemy combat data, actor starter Skill references, enemy EXP/Gil/Resonance/drop rewards, battle-sprite metadata, item/weapon/armor/accessory schemas, Magick targeting/effect/combat metadata, Skills metadata for physical damage, percentage healing, status application, explicit Valor gain, battle-local Scan analysis, targeting/scope, and Valor-Art classification, the canonical nested status schema, encounters, Essence progression/ability/mastery definitions, and on-demand map/event data. Essence progression ordering and database references are validated before `Game_Essence` can consume them. Map validation recursively checks event pages and supported interpreter commands before world runtime objects are constructed.

Validation describes the shape and references of canonical data; it does not imply that every designed mechanic is runtime-complete. Gravity, percentage healing, and multi-hit Magick metadata are now runtime-active; Essence passive metadata still belongs to later runtime passes. As new database systems become runtime-active, their validation rules should be extended here or delegated to appropriately focused helpers.

## Input

`Input` centralizes player input through named actions rather than exposing physical keyboard codes to gameplay consumers. `isActionPressed()` and `isActionTriggered()` resolve the current Config Runtime bindings for actions such as `up`, `down`, `left`, `right`, `confirm`, `cancel`, `menu`, `interact`, `help`, and `scope`. Raw code state remains private infrastructure for keyboard event capture and the Controls rebinding screen.

## Graphics

`Graphics` owns shared graphics and canvas-level concerns used by the engine.


## ConfigManager

`ConfigManager` owns player preferences that should survive independently of game-save slots. Config Runtime v2 uses its own versioned local-storage key, validates both ordinary options and keyboard bindings, and migrates Config Runtime v1 preferences without discarding them. `SaveManager` remains responsible only for game-state persistence; loading another save slot must not replace battle speed, message speed, cursor-memory, presentation-order, or control preferences.

Current consumers remain deliberately narrow: `Scene_Battle` asks Config Runtime for battle and banner delta-time scaling, `Window_Message` asks for field-message reveal speed, `BattleManager` asks whether fresh battle selector entry should preserve cursor position, and field/battle Magick windows ask for presentation ordering. `Scene_Options` / `Window_Options` edit ordinary preferences, while `Scene_Controls` / `Window_Controls` edit keyboard bindings; none of those UI layers become configuration authority. Field Message Speed controls a Unicode-safe typewriter reveal rate; confirm reveals unfinished text first and closes only after the message is complete.

Custom Controls / Input Mapping v1 gives each named action two persistent binding slots. Required navigation/confirm/cancel/menu/interact actions may not be cleared completely; optional Help/Scope actions may be unbound. Identical physical keys may intentionally appear on different actions because those actions can belong to different contexts, preserving canonical defaults such as E for Confirm + Interact and Escape for Cancel + Menu. Player-facing control hints call `Input.actionLabel()` so remapped keys remain truthful.

## SaveManager

`SaveManager` owns serialization, migration, validation, and restoration of persistent game progress.

Save Runtime v9 serializes the full `Game_Party` actor roster rather than only the legacy leader alias. Actor state includes mutable progression, HP/MP, persistent Valor, combat stats, Weapon / Armor / Accessory equipment, learned Magick, learned non-Magick Skills, save-eligible runtime statuses, persistent Essence progression, and explicit Essence slot assignments. Party state persists Gil plus item, weapon, armor, and accessory inventory alongside active battle composition. Status restoration does not re-run initial application effects; canonical derived statuses are recomputed from restored battler state. Save versions 1 through 8 migrate into the current schema; v1-v8 migration also injects each actor's newly canonical Pass-38 starter Valor Art so older saves receive the new baseline content. The historical `skills` array from pre-Pass-29 saves remains a migration-only alias for old Magick ownership; current Skills persist separately as `skillIds`.

The loader recognizes the legacy version-1 leader-only shape plus later full-party save generations, filling newly introduced fields through versioned migration before validation. Unknown/future save versions and malformed structures fail through a normal error result instead of flowing directly into state mutation. Inventory quantities and location values are normalized at the save boundary, and storage-write failures are caught by the save layer.

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

Active status instances, status-effect queries, incoming physical/magical damage modifiers, elemental-Magick absorption, Reflect capability/limits, damage-triggered status removal, shared action/Magick/Skill availability rules, forced-action control flags, and the combined turn-speed multiplier live at this layer because those rules apply equally to actors and enemies. `Game_Battler` also owns shared Skill legality, physical-power lookup, percentage-healing calculation, reusable Skill status application, and relative target-validity contracts so techniques can reuse established battler rules without becoming Magick. Action-facing systems can calculate an attack, technique, or spell, then delegate target-side status, damage, restriction, control-authority, and speed questions to the battler instead of reimplementing status rules.

## Game_Actor

`Game_Actor` represents a playable combatant and actor-specific runtime state. Canonical starter Magick come from validated `Actors.json` `initialMagickIds` data rather than constructor-time setup in `Game_System`. Learned non-Magick techniques are owned independently through validated `initialSkillIds` / runtime `skillIds` plus explicit learn, forget, query, and list APIs; the two ability namespaces never share ownership arrays. Conventional equipment mutation is owned here through explicit Weapon, Armor, and Accessory equip / unequip APIs. Accessory combat bonuses flow through the actor's derived-stat methods instead of mutating base stats. `Game_Actor` also owns Valor gauge state, its data-driven maximum, hostile-damage-to-Valor conversion, ready-state detection, and full-gauge consumption; Save Runtime v9 persists both the current gauge value and learned Skill IDs. The generic damage result may carry battle-supplied `source` / `valorEligible` provenance, but only actor Valor consumes that flag. Self-damage, friendly-fire, absorbed damage, and unrelated HP changes therefore cannot fill Valor unless an explicit effect calls the actor's Valor API. `BattleRenderer` and `Window_Status` only present that actor-owned state and never mutate it. Actor data also defines the Essence slot count. Essence progression is stored separately from slot assignment so unequipping does not destroy Resonance; slot APIs validate IDs, prevent duplicate assignment on the same actor, and expose the equipped `Game_Essence` instances used by battle Resonance.

Actor behavior should build on shared battler behavior while retaining responsibilities that only make sense for player-controlled characters.

## Game_Enemy

`Game_Enemy` represents enemy combatants.

Enemy-specific runtime behavior, including future AI integration, belongs here or in dedicated battle/AI systems rather than being embedded into actor logic.

## Game_Party

`Game_Party` owns the player's party-level state, actor roster, leader resolution, active battle composition, inventory, Gil currency, and party operations. Weapon, armor, and accessory inventory use one shared equipment-count / mutation path while retaining type-specific public APIs. Shops also terminate at this ownership boundary: `purchaseMerchandise()` resolves the canonical merchandise record and price, validates the requested quantity and available Gil, routes inventory gain through the existing type-specific APIs, and spends Gil only as part of the successful transaction. Shop windows therefore never become currency or inventory authority. Leader-default actions resolve through party ownership rather than the legacy `$gameActor` global. Inventory-only reset behavior is exposed explicitly as `clearInventory()`.

It forms the runtime foundation for multi-character gameplay and future party-management features.

## Game_Essence

`Game_Essence` represents runtime Essence progression state.

The canonical Essence definitions live in `data/Essences.json`; mutable Resonance lives on `Game_Essence` instances instead of modifying database definitions. Resonance is capped at the canonical Mastery threshold, level progression is derived from validated thresholds, and the runtime reports the next progression milestone and when an Essence becomes Mastery Ready. Actor-owned Essence progression and slot assignments are serialized independently through the current Save Runtime v9 so unequipping preserves progression.

`Window_Essence` provides the first player-facing equipment surface: party-member switching, data-driven slots, a scrollable canonical Essence catalog, and progression / Magick-awakening details. The v1 catalog is intentionally not an ownership system; long-term acquisition rules can later filter the selectable catalog without changing the slot API. Ability grants, passives, Mastery Trials, and evolution remain later work.

## World Runtime Objects

`Game_Map`, `Game_Player`, `Game_Event`, and `Game_Interpreter` form the foundation of world exploration and event execution. Loaded map/event JSON is validated before these objects receive it, including nested event conditions and command payloads. Shop commands define only a merchant name and a list of merchandise type/ID references; prices remain canonical item/equipment data. The interpreter advances past the shop command before pushing `Scene_Shop`, so returning to the map resumes the event instead of reopening the merchant. The interpreter still performs runtime checks at mutation boundaries so direct or future callers cannot rely solely on file validation.

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

It also owns battle-relative effect routing that requires knowledge of both sides of the encounter. Reflect is resolved here because redirecting a Magick requires identifying the Reflect holder's side, choosing a living battler on the opposing side, preserving the original cast cost, and presenting the redirected result without turning reflection into a second cast. Forced-action control is coordinated here for the same reason: Berserk can begin a party action without player input, while Confuse may need a legal random target drawn from one or both battle sides. Battle-local fractional turn progress also lives here so party and enemy scheduling consume one shared Haste/Slow speed contract rather than implementing separate timing rules. Valor & Escape Rules v1 adds two more battle-relative responsibilities: it derives hostile damage provenance from source/target sides before actor Valor reacts, and it owns normal Escape probability plus battle-local retry pressure. `Scene_Battle` only requests the attempt and performs the existing scene handoff after a successful escape outcome.

It should orchestrate battle systems rather than permanently absorbing every specialized mechanic into itself.

## BattlePartyController

`BattlePartyController` handles battle-facing party coordination and supports the multi-character battle structure. It asks `BattleManager` for the party's scheduled turn-slot queue at the start of each party side round, then advances through those slots while preserving formation order and repeated Haste turns.

`BattleFormationManager` owns side-view battlefield geometry independently from turn order. It resolves the encounter's `normal`, `backAttack`, or `pincer` formation into four stable party lanes and formation-aware enemy positions, computes safe sprite scaling, and exposes facing/advance directions used by rendering and animation. Enemy Formation Rows v1 extends that same owner to a maximum of eight encounter members, with `front` / `back` rows and four slots per row. Omitting `slot` enables automatic centering within that side/row; explicit `slot: 0..3` selects a fixed handcrafted position. Pincer applies the row contract independently to each left/right flank while the encounter-wide cap remains eight. `BattlePartyController` delegates battle-position lookup to this manager instead of embedding actor-specific coordinates. `BattleRenderer`, `BattleEffects`, `BattleTargetManager`, and `BattleAnimationController` consume those shared positions so targeting, effects, cursor anchors, and motion stay aligned. Row metadata is geometry-only and does not own target legality or combat formulas.

## BattleScanManager

`BattleScanManager` owns battle-local enemy-analysis state. It records which concrete enemy instances have been scanned, exposes the currently targeted enemy only while enemy target selection owns input, and derives read-only elemental Weak / Resist / Immune groups from each enemy's existing `elementRates`. The manager does not persist knowledge, modify combat rates, or own rendering. `BattleManager` invokes it through the generic Skill `scan` effect; `BattleRenderer` reads it for Tactical Help presentation.

## BattleTargetManager

`BattleTargetManager` owns targeting responsibilities such as selecting and resolving valid battle targets. Battle Targeting & Scope Navigation v2 extends that boundary with four-direction spatial movement, formation-aware target buckets, effective scope calculation, and pincer flank selection. Single-target navigation compares legal battler positions across the target groups allowed by the current action; it does not wrap when no legal target exists farther in the requested direction. All-target resolution works through the currently selected bucket: normal enemy battles use the whole enemy side, allies use the whole legal ally side, and pincer enemy targeting splits left/right flanks into separate buckets. Optional `single`/`all` actions collapse to `single` when the current bucket contains only one legal battler, while intrinsically `all`-only actions remain all-target.

It can also bind an already-resolved battler back into the current ally/enemy selection state, allowing forced targeting to reuse the same downstream attack and Magick execution paths as manual selection. Targeting rules should remain centralized enough that Magick, items, Scan/Tactical Help, and future battle systems can use consistent target behavior. Scan itself does not alter target legality; it consumes the enemy target already resolved by the shared Skill/targeting contract.

## BattleEffects

`BattleEffects` handles battle effect resolution responsibilities.

As Magick, Statuses, and Essences gain more runtime behavior, reusable effect mechanics should be preferred over hard-coded branches for individual named abilities whenever practical.

## BattleAnimationController

`BattleAnimationController` coordinates battle animation behavior separately from the underlying gameplay result.

A Magick's mechanical resolution and its visual presentation should remain separable so visual changes do not require rewriting game rules.

## BattleRenderer

`BattleRenderer` presents the visual battle state. `BattleHudLayout` is the presentation-only geometry owner for the bottom HUD, four stable party rows, fixed name / command-reserve / resource columns, compact transient banner bounds, and contextual hint placement. This keeps layout arithmetic reusable without giving the HUD ownership of turn state, targeting legality, or resource mutation. Battle UI / Presentation Polish v1 keeps this ownership intact while tightening the HUD/command proportions, centering a smaller Tactical Help region above the HUD, reducing transient-banner dimensions, and deriving all control-copy from named Input actions. `BattleRenderer` applies transparency, fades, selection accents, and target-cursor styling only after authoritative scene/manager state has already been resolved.

Battle Presentation & Feedback v1 established the presentation boundary and contextual control hints. Battle Presentation & Feedback v2 keeps that boundary while simplifying the screen after playtesting: there is no permanent encounter/active header and no permanently visible combat-message strip. `Scene_Battle` owns a short transient banner queue for meaningful action/state names, while `BattleRenderer` only draws the current banner when one exists. Ordinary Attack is communicated by animation and floating results rather than a redundant banner.

Battle HUD & Message Layout v1 supplied the reusable four-row foundation. Pass 46 refines the hierarchy into three stable bottom-HUD regions: actor names on the left, a middle reserve overlaid by the command window only while command input owns focus, and HP/MP/Valor columns on the right. The unused middle reserve intentionally leaves room for future Barrier/MBarrier-style presentation without fabricating mechanics that do not exist yet.

Battle Command Navigation & Side Actions v1 keeps command-navigation state inside `Window_BattleCommand` while leaving action authority where it already belongs. The main list contains only Attack, Skills, Magick, and Item. Horizontal command input opens exactly one temporary side action: Escape on the left or Defend on the right. `Scene_Battle` confirms Escape through its established battle-finalization path and forwards Defend through `BattleManager`; the renderer only draws the current command-window state. Target-cancel flow is likewise one-level navigation: `Scene_Battle` clears pending target state, then reopens the originating Skill/Magick selector with its existing list cursor rather than dropping directly to the main command list.

Back Attack and Pincer rear exposure now have one explicit combat consequence: `BattleFormationManager` determines whether an enemy is physically behind a party target, while `BattleManager.applyPhysicalDamage()` applies the shared 1.5x rear multiplier. Magick resolution never consults rear exposure. Back Attack keeps the party on the left, initially facing away; an actor turns permanently after being physically struck from behind, and all remaining actors turn after the opening enemy round. Pincer continues to derive exposure from current side-facing geometry.

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
Scene_Shop.js
```

## Scene_Base

`Scene_Base` provides shared scene behavior.

## Scene_Map

`Scene_Map` coordinates world exploration and map-facing gameplay. During field choices it continues advancing `Window_Message` reveal timing while disabling message-owned confirm handling, leaving `Window_Choice` as the sole owner of E/Enter until the selection resolves.

## Scene_Menu

`Scene_Menu` coordinates the main menu experience and its windows. Character-specific field menus receive `Game_Party` rather than a fixed leader reference so they can resolve and switch their own current actor through the shared navigation helper.

## Scene_Battle

`Scene_Battle` coordinates the battle experience between battle systems, player commands, windows, and presentation. Victory now finalizes the authoritative battle result before presenting `Window_BattleResults`; the scene remains open until the player confirms, while the completion callback and scene pop still occur only once at exit.

## Scene_Shop

`Scene_Shop` coordinates the merchant interaction pushed from a map event. `Window_Shop` reports purchase/cancel requests; the scene forwards purchase requests to `Game_Party.purchaseMerchandise()` and translates the returned structured result into player-facing feedback. The scene does not calculate prices or mutate inventory itself. Closing the shop pops back to the existing map scene and its suspended interpreter state.

A scene may coordinate several systems, but it should avoid becoming the permanent implementation home for mechanics that logically belong to battlers, targeting, effects, data, or other dedicated modules.

---

# 🪟 Window and UI Layer

The `js/windows/` directory contains interactive menus and UI windows.

Current windows include battle commands, battle items, battle Skills, battle Magick, battle results, choices, equipment, Essence equipment, inventory, Skills, Magick, menu commands, messages, save slots, shops, and status display. Character-specific field-menu windows receive explicit party context from `Scene_Menu`. `Window_ActorNavigator` centralizes party-member indexing, left/right input, wraparound behavior, and the shared `◀ Actor ▶` header used by Skills, Magick, Status, Equipment, and Essence; each consuming window owns only its local selection reset when the actor changes. Battle Skill and Magick windows resolve their current battler through the party controller with a party-owned battle-leader fallback. Selectable list windows that can outgrow their fixed layout use the shared `Window_ListViewport` helper so keyboard selection remains visible without drawing into reserved detail regions. `Window_BattleResults` consumes the already-finalized structured battle result and never owns reward mutation, preserving the exactly-once reward boundary in `BattleManager`.

Windows should primarily be responsible for:

- Displaying information
- Accepting player selection
- Managing UI navigation
- Reporting player choices back to the controlling scene or system

They should not become the canonical owner of gameplay rules simply because those rules are visible in the interface.

For example, a Magick window may display whether a Magick is usable, but the underlying rule that determines usability should live in an appropriate gameplay layer.

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

## Magick

`Magick.json` defines the current Essence-linked supernatural ability system. **Skills** is now a separate canonical non-Magick namespace with its own database, ownership state, UI, and battle entry path. Shared lower-level combat helpers may be reused, but Magick storage, MP costs, spell effects, and terminology are not aliases for Skills.

`Game_Battler` owns the reusable Magick runtime shared by actors and enemies, including MP payment, damage/healing/revival formulas, status-payload routing, and relative ally/enemy target legality. `Game_Actor` keeps actor-specific learned-Magick ownership, while `Game_Enemy` exposes Magick knowledge from its validated action definitions. Status application, refresh, removal, toggle behavior, resistance, immunity, defeated-state evaluation, and revivability remain on the same shared battler layer so enemy spellcasting does not create a second Magick engine.

`BattleTargetManager` asks the acting player's shared Magick-target contract whether a battler is selectable. Enemy AI uses the same `Game_Battler.isValidMagickTarget()` contract through `BattleEnemyAI`, so ally/enemy labels remain relative to the caster on either side of battle. Revival can select revivable defeated battlers and status cleansing can select a defeated battler when the chosen Magick can remove that defeat status.

`BattleManager` coordinates battle targeting and presentation, then consumes the status-resolution results produced by the caster so status feedback is shown without making individual Magick names part of battle-flow logic. Battle outcome and reward paths consume the shared `isDefeated()` contract rather than assuming every defeated battler must have zero HP. Victory finalization owns exactly-once aggregation of EXP, Gil, item drops, and encounter Resonance; party/inventory/Essence objects own the resulting persistent state mutations.

Windows present available commands and Magick to the player. `Window_BattleCommand` reads the active battler's shared action-availability rules so forbidden commands are dimmed and skipped, while `BattleManager` rechecks the same rule before execution.

## Skills

`Skills.json` defines non-Magick techniques. Character Valor Arts v1 supplies the first four actor-owned records, and Enemy Skills & AI Integration v1 adds the first canonical enemy technique without creating a second Skill database. The validated metadata supports `physical`, `support`, and `control` categories; `damage`, `heal`, `inflictStatus`, and explicit `valor` effects; positive `powerMultiplier` for physical damage; bounded `healPercent` for percentage healing; positive `valorGain` for deliberate gauge support; validated status-chance maps; relative `self` / `ally` / `enemy` targeting; and `single` / `all` scope.

`Game_Actor` owns learned Skill IDs independently from learned Magick. `Game_Battler` owns shared Skill legality, action-restriction checks, physical-power lookup, percentage-healing calculation, reusable status application, relative target validity, and generic `canPaySkillCost()` / `paySkillCost()` hooks. `BattleTargetManager` treats `self` as the ally-side selection group while `isValidSkillTarget()` still restricts self-only techniques to the acting battler and excludes full-HP battlers from healing-Skill target sets. `BattleManager` dispatches the validated Skill effect type while reusing existing physical damage, HP, status, defeat, and Valor contracts instead of branching on Skill or actor names.

Valor Arts Runtime v1 uses `valorArt: true` Skill metadata. `Game_Actor` specializes the generic Skill-cost hooks so Valor Arts require `isValorReady()` and consume the full gauge through `consumeValor()`. The shared battler layer does not own Valor state, and `BattleManager` only asks the generic cost hook after confirming at least one legal target. This prevents failed/invalid target resolution from spending Valor while still charging once for a committed action even if a later physical hit misses or a status attempt is resisted.

`Window_BattleSkills` presents known usable Skills during battle and marks Valor Arts with `[VALOR]`; `Window_Skills` is the field/menu read-only learned-Skill viewer, labels the same classification, and uses the shared `Window_ActorNavigator` contract. `BattleRenderer` treats Skills, Magick, and Item selectors as one presentation group: any open selector suppresses the command window and every selector is drawn through the same rendering loop. Field Skills and Magick details use shared `Window_TextLayout` wrapping so canonical descriptions remain bounded by their panels. Character Valor Arts v1 populates the actor side of the canonical Skills catalog, while Enemy Skills & AI Integration v1 lets `Enemies.json` action definitions reference ordinary Skills through `skillId`. Shared Skill execution supports physical damage, percentage healing, and status application for both battle sides; long-term unlock/progression rules and additional effect families remain future work.

## Essences

`Essences.json` defines Essence content, ability assignments, progression thresholds, passives, and mastery metadata.

`Game_Essence` owns mutable Resonance progression and Mastery-Ready state. `Game_Actor` owns both persistent Essence progression instances and a separate slot assignment list, so removing an Essence from a slot does not destroy its Resonance. Victory finalization awards the encounter's Resonance to every currently equipped Essence on each surviving active battle participant exactly once.

`Window_Essence` is a presentation layer over those actor APIs: it switches party-member context, displays slot state and progression, and asks the actor whether a catalog entry is legal before mutating the loadout. Future Essence Runtime work will add acquisition / ownership filtering, Essence-granted ability availability, passives, Mastery Trials, and evolution without moving progression state back into canonical data.

## Statuses

`Statuses.json` defines Status System v1.

The active Status Runtime provides reusable application, removal, duration, countdown, derived-state, modifier, immunity/resistance, stacking, interaction, defeat-state, revival, and turn-progression behavior. `effects.countsAsDefeated` contributes to the shared defeated-state contract, while `effects.canBeRevived` controls whether a status-defined defeat can be removed through revival. `effects.haltsTurnProgression` freezes scheduled personal turns and ordinary battler-relative status progression while the halting status advances on the side-round clock so it can expire. The shared damage path consumes data-driven incoming damage, outgoing physical damage, physical accuracy, wake-on-hit, and elemental absorption properties without checking individual status names. `Game_Battler.valorGainMultiplier()` exposes the canonical Fury/Sadness/Near-Death modifier contract. The shared direct-damage path invokes a generic post-damage hook after derived statuses update; `Game_Actor` uses that hook to generate actor-owned Valor from actual HP loss without making enemy or Status Runtime own the gauge.

Battlers own their active status state while battle systems trigger and coordinate status effects at the appropriate points in combat.

UI systems will display the result without owning the underlying rules.

---

# 📐 Dependency and Responsibility Rules

When adding a new feature, prefer the narrowest layer that genuinely owns the behavior.

Use these rules as a guide:

1. **Content definition belongs in data.**
   A new Magick, Essence, status, item, enemy, or equipment entry should normally begin as data rather than a named hard-coded branch.

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
   If several Magick or statuses can share one engine behavior, represent that behavior generically and drive it from data.

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

Enemy Actions & AI v1 is active, with Enemy Skills & AI Integration v1 extending the same action vocabulary to canonical Skills. `Enemies.json` supplies validated Attack, Magick, and Skill action definitions; `BattleEnemyAI` owns weighted/conditional decision-making and target strategy; `BattleManager` executes chosen Magick and Skill effects through their existing shared runtimes. `Game_Enemy` derives known Magick/Skills from its complete configured action data, ordinary enemy Skills remain cost-neutral, and actor-owned Valor Arts are explicitly unusable by enemies. Unusable configured actions are filtered before selection, and legal basic Attack remains the safe fallback.

Boss / Phase AI v1 extends `Game_Enemy` with optional validated `phases` data instead of creating a boss-only AI engine. Each phase has a stable ID/name, a strictly descending `hpRateAtOrBelow` threshold, its own normal enemy-action list, and an optional entry message. `Game_Enemy` owns the battle-local `phaseIndex` and advances it monotonically: healing never reverts a phase, while a large HP drop can skip directly to the deepest eligible phase. `BattleEnemyAI` continues to call `actionDefinitions()` and therefore automatically sees only the active phase pool. `BattleManager` refreshes the phase at enemy-turn start and owns presentation of the one-time transition message. Phase state is battle-local and requires no Save Runtime field.

Advanced scripted threshold effects, encounter-specific state machines beyond action-pool phases, specialized targeting rules, and richer boss mechanics remain future work. They should extend these same ownership boundaries rather than creating a separate boss battle engine.

## Event and Cutscene Expansion

The existing map, event, interpreter, switch, variable, and scene foundations can be expanded as world exploration, scripted sequences, quests, towns, dungeons, and story content grow.

## Additional Battle Systems

Future battle architecture is expected to support systems such as:

- Summon Magick
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
