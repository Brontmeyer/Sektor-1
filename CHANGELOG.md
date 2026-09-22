# 📜 Sektor 1 Changelog

Notable completed changes to Sektor 1 are recorded here.

`TODO.md` tracks unfinished work. This changelog records work that has actually been completed.

Until formal versioning begins, new completed work is collected under **Unreleased** while the original development-pass history is preserved below.

---

## Unreleased

### Fixed

- Fixed field choice prompts introduced by Config Runtime v1 so typewriter text continues revealing while `Window_Choice` owns confirm input
- Prevented choice-owned E/Enter presses from also revealing or closing `Window_Message`, preserving one input owner per field-dialogue state
- Added focused regression coverage for the Guard-style prompt flow and Scene_Map message/choice update ordering

### Added

- Added Main Menu Information & Command Layout v1 with four active-party information cards, singular command naming, utility/location panels, and a dedicated MAIN MENU heading
- Added exact main-menu destinations for Item / Magick / Skill / Essence / Equip / Status / Order / Valor / Option / ROSTER / Save / Exit, with no extra COMMANDS or game-title banner
- Added active-party HP/MP/Valor gauges, Level, Status, and Next Level EXP presentation using live actor state; portrait slots remain deliberate placeholders until character portrait art is selected
- Added current map-location handoff from `Scene_Map` into `Scene_Menu`, while leaving play-time visibly unresolved (`--:--:--`) until a canonical persistent timer exists
- Added honest temporary feedback for planned Order, Valor, and ROSTER destinations without half-implementing those systems
- Added dedicated Main Menu Information Layout regression coverage for the naming contract, four-member party display, layout separation, destination placeholders, singular screen headings, and script load order

- Added Menu Window Softening & Frame Polish v1 through centralized rounded panel clipping, soft outer shadows, and inset highlight strokes in `UIAssetManager`
- Softened battle/menu/accent panels without changing semantic asset roles or individual window ownership
- Rounded selected-row asset clipping and HP/MP/Valor fallback fills so controls, selectors, and gauges share one cushioned visual language
- Added role-aware corner radii for large menu panels, battle panels, and compact accent surfaces while retaining no-image/vector fallbacks
- Added dedicated UI window softening regression coverage for rounded clipping, shadow/inset framing, proportional radii, gauge capsules, and centralized ownership

- Added UI Style Integration Prototype v1 using a curated soft-framed Adventure UI family behind semantic `UIAssetManager` roles
- Added image-backed battle HUD, command, battle selector, Options, Controls, and main-menu framing while preserving existing vector fallbacks
- Added reusable soft selection-panel drawing and capsule-style gauge framing while retaining Sektor 1's HP/MP/Valor fill colors
- Added restrained asset-backed treatment for battle action/state banners and Tactical Help without changing battle rules or information ownership
- Added dedicated UI style integration regression coverage for semantic-role isolation, nine-slice fallback behavior, optional selection/gauge art, curated asset/license presence, and primary consumer boundaries

- Added Asset / UI Skinning Foundation v1 with centralized `UIAssetManager` loading, named presentation slots, optional windowskin nine-slice drawing, icon-sheet extraction, and safe asset fallbacks
- Curated the user-provided RPG Maker MZ system assets down to `Window.png`, `IconSet.png`, `ButtonSet.png`, and `Shadow2.png` rather than importing engine/plugin code wholesale
- Added asset-backed side-view battler shadows as the first visible skinning proof while keeping all battle mechanics and existing vector UI fallbacks unchanged
- Added `docs/ui_asset_skinning.md` to record selected, deferred, and deliberately excluded asset families and the presentation ownership boundary
- Added dedicated UI asset skinning regression coverage for manifest contracts, non-browser fallback, nine-slice drawing, icon extraction, battle-shadow rendering, and repository asset presence

- Added Battle UI / Presentation Polish v1 with a tighter four-row HUD, reduced command-reserve proportions, and softer Sektor 1 battle framing
- Reworked Tactical Help into a smaller centered translucent panel with compact two-line scanned/unknown enemy information and remapped Help-key labeling
- Added transient battle-banner fade-in/fade-out presentation while preserving Battle Message Speed ownership and the existing banner queue
- Polished the battle command window with restrained blue-gray framing, active-row highlighting, gold selection accents, and side tabs sized to the command row
- Added softer contextual hint backing and gold outlined target cursors while retaining dynamic remapped control labels
- Added dedicated Battle UI Presentation Polish regression coverage and expanded HUD / Tactical Help / transient-banner tests

- Added Custom Controls / Input Mapping v1 with centralized named input actions for movement, confirmation, cancellation, menu access, interaction, Tactical Help, and target-scope switching
- Added Config Runtime v2 keyboard binding persistence with automatic migration from Config Runtime v1 while preserving existing battle/message/cursor/Magick preferences
- Added two binding slots per action, required-action lockout protection, context-sensitive shared defaults, key-label formatting, and reset-to-default controls
- Added fullscreen `Scene_Controls` / `Window_Controls` flow reachable from Options, including live key capture, Backspace capture cancel, Delete slot clearing, and dynamic binding display
- Migrated runtime gameplay consumers away from raw physical key checks to `Input.isActionPressed()` / `Input.isActionTriggered()` named-action queries
- Updated battle, dialogue, equipment, Essence, shop, result, and Options hints to display the player’s current bindings instead of hard-coded default keys
- Added dedicated Input Mapping regression coverage for Config v1 migration, remapped action resolution, required binding safety, context sharing, capture/reset behavior, Options reachability, and raw-key-consumer elimination

- Added Game Options / Config Foundation v1 with versioned save-slot-independent configuration persistence through `ConfigManager`
- Added a fullscreen `Scene_Options` / `Window_Options` flow reachable from the main menu
- Added live Battle Speed, Battle Message Speed, Field Message Speed, Battle Cursor Memory, and Magick Order settings
- Added battle-speed scaling for battle-local animation/action/enemy-turn clocks while keeping temporary battle-banner pacing independently configurable
- Added field-message typewriter reveal with configurable speed; confirm reveals unfinished text first and closes only after the message is fully visible
- Added battle selector cursor-memory behavior for Skills, Magick, and Items while preserving hierarchical target-cancel cursor restoration regardless of the global preference
- Added shared Magick ordering in both battle and field menus with Default, Alphabetical, and Element presentation modes
- Added dedicated Game Options regression coverage for persistence, timing separation, field text reveal, cursor memory, Magick ordering, menu reachability, and script load order

- Added Scan & Tactical Help v1 with a canonical `Scan` Skill, battle-local per-enemy knowledge, and an optional H-key tactical information bar
- Added `BattleScanManager` as the battle-local owner of Scan state, current tactical target lookup, and elemental Weak / Resist / Immune classification
- Added unknown tactical presentation (`??`) for unscanned enemy HP/MP and affinity data, with live HP/MP values after that specific enemy instance is scanned
- Added Scan Skill runtime integration through the shared Skill execution/targeting path rather than a special battle command
- Added narrow Scan schema validation requiring enemy-only single-target Skills and granted Scan to Tyler's canonical starter Skill list for playtesting
- Added dedicated Scan/Tactical Help regression coverage for battle-local instance knowledge, live resource display, elemental affinity classification, H-key toggling, rendering, Skill execution, schema validation, and script load order

- Added Enemy Formation Rows v1 with a validated eight-enemy encounter cap, four front-row slots, four back-row slots, and row-aware battlefield geometry
- Added automatic row centering when `slot` is omitted and handcrafted `slot: 0..3` placement when an encounter needs an exact formation
- Added pincer-aware front/back rows on independent left/right flanks while keeping the eight-enemy cap global to the encounter
- Kept enemy positions stable after defeat by resolving row geometry from canonical encounter membership rather than the living-enemy subset
- Added Eight Enemy Rows and Eight Slime Pincer Rows playtest encounters plus Map001 tester events
- Added dedicated Enemy Formation Row regression coverage for automatic centering, explicit slots, stable survivor geometry, pincer-relative rows, schema validation, and playtest exposure

- Added Valor & Escape Rules v1 so passive Valor reacts only to hostile opposing-side battle-action damage rather than any HP loss
- Added explicit damage provenance (`source` / `valorEligible`) through the shared damage path so self-damage and friendly-fire cannot accidentally generate Valor
- Added a reusable Skill `valor` effect with validated positive `valorGain` metadata for future techniques that deliberately manipulate the gauge
- Added stat-driven Escape attempts: 45% base chance, ±2.5 percentage points per average Agility difference, +15 percentage points after each failed legal attempt, clamped to 10-95%
- Added turn-cost failure handling for normal Escape attempts while preserving encounter `canEscape` as an absolute no-roll gate
- Added dedicated Valor/Escape regression coverage for hostile Attack/Magick/Skill gain, self/friendly exclusion, explicit Valor Skills, Escape probability/retries, boss escape blocking, and Retreat no-escape enforcement

- Added Battle Targeting & Scope Navigation v2 with shared four-direction spatial targeting across allies/enemies and formation-aware target buckets
- Collapsed optional All scope to Single when the current target bucket contains only one legal battler, while preserving intrinsically all-target actions
- Added pincer flank-aware All targeting so multi-target actions affect only the selected enemy flank and can switch between left/right flanks through normal directional input
- Updated all-target cursor rendering and battle hints to use the resolved target bucket rather than every selectable enemy in the battle
- Added dedicated regression coverage for one-target scope collapse, two-target All, eight-enemy directional navigation, pincer cross-flank selection, flank-limited All targeting, allied All targeting, and no-wrap screen-edge behavior

- Added Battle Presentation & Feedback v2, replacing the persistent top encounter/active header and recent-message strip with compact transient action/state banners
- Added scene-owned banner queuing so formation/boss state announcements cannot be immediately overwritten by a following Magick/Skill/Item name
- Added brief Critical screen flash while preserving existing floating damage plus Weak / Resist / Immune / Critical battlefield popups
- Refined the bottom HUD into stable actor-name, command-reserve, and HP/MP/Valor regions; the command panel now overlays the middle reserve and Escape/Defend tabs sit flush against its top side edges
- Established the initial fixed enemy-slot groundwork later expanded by Enemy Formation Rows v1
- Corrected Back Attack presentation so the party remains on the left facing away initially, with temporary action-facing and permanent turn-around after rear physical hits / the opening enemy round
- Added explicit 1.5x rear-exposure damage for enemy physical damage against party members in Back Attack/Pincer geometry while leaving Magick damage facing-neutral
- Expanded regression coverage for compact banner presentation, banner queuing, Critical flash, flush side-command geometry, enemy-slot groundwork, back-attack facing/exposure, and rear physical damage
- Added Battle HUD & Message Layout v1 with a stable four-row party HUD, compact HP/MP/Valor gauges, active-actor emphasis, top-of-screen battle messaging, and target-name feedback during target selection
- Added `BattleHudLayout` as the presentation-only geometry owner for the top battle strip, four fixed party HUD slots, command-window reserve, and battle hint placement
- Added dedicated Battle HUD regression coverage for stable four-actor rows, active-row emphasis, target feedback, message/HUD geometry, and script-load order
- Added Battle Formation & Party Layout v1 with reusable `normal`, `backAttack`, and `pincer` encounter formation contracts
- Added `BattleFormationManager` as the single owner of battlefield geometry, four-actor vertical party lanes, formation-aware enemy sides, sprite-facing direction, and safe sprite scaling
- Added formation-aware actor/enemy movement, target cursors, and effect/pop-up anchoring so mirrored and pincer layouts reuse existing battle systems without hard-coded battler names
- Added Back Attack and Pincer test encounters plus Map001 testers for hands-on playtesting
- Added dedicated battle-formation regression coverage for canonical encounter data, four-actor layout/scaling, mirrored facing, pincer side placement, schema validation, and script load order

- Added Battle Command Navigation & Side Actions v1 with a permanent four-command core list: Attack, Skills, Magick, and Item
- Added temporary Escape-left and Defend-right side command panels that remain invisible until horizontal input requests them, then require normal confirm input before execution
- Kept boss/non-escapable Escape discoverable but disabled, preserving explicit "You cannot escape!" feedback instead of silently removing the option
- Added one-level target-cancel navigation so backing out of Skill or Magick targeting reopens the originating selector with its cursor position preserved
- Added optional selector cursor preservation hooks for battle Skills, Magick, and Items without introducing global cursor-memory settings ahead of the planned Options system
- Added dedicated Battle Command Navigation regression coverage for four-command layout, hidden side actions, boss Escape behavior, existing Escape/Defend execution paths, target back-navigation, and selector cursor restoration

- Added Boss / Phase AI v1 with validated, data-driven enemy phase definitions, strictly descending HP thresholds, per-phase action pools, and optional one-time entry messages
- Added battle-local monotonic phase state to `Game_Enemy`; healing does not roll a boss backward into an earlier phase, while large HP drops may advance directly to the deepest eligible phase
- Kept `BattleEnemyAI` focused on choosing from the active action pool while `BattleManager` refreshes phase state at enemy-turn start and presents phase-entry feedback
- Added the non-escapable **Test Slime Alpha** boss encounter plus a Map001 boss tester so phase behavior can be exercised in normal playtest flow
- Added dedicated Boss Phase AI regression coverage for active action pools, irreversible threshold progression, multi-threshold jumps, one-time transition feedback, and phase-schema validation
- Normalized decorative Unicode em-dash escapes in `Skills.json` comments to regular hyphens for raw-data consistency

- Added Enemy Skills & AI Integration v1 so enemy action definitions can reference canonical non-Magick Skills through validated `skillId`, target-group, scope, weight, and condition metadata
- Added Test Slime's first canonical enemy technique, **Goo Rush**, as a regular physical Skill with a Slow status rider rather than an enemy-only combat special case
- Reused the shared Skill target/effect runtime for enemy damage, healing, and control techniques while keeping `BattleEnemyAI` responsible only for decision-making and target strategy
- Added enemy Skill ownership checks and explicit Valor-Art rejection so actor-owned Valor resources do not silently become available to enemies
- Added dedicated Enemy Skill action regression coverage for damage/status resolution, support targeting, all-target control, Valor-Art exclusion, weighted selection, and database validation

- Added Battle Presentation & Feedback v1 with encounter-aware battle headers, active-party-battler context, and state-sensitive control hints instead of permanent test-battle copy
- Added a bounded recent-message panel that reuses `Window_TextLayout` so long combat feedback wraps/truncates inside the battle presentation instead of overflowing the battlefield
- Tightened battle-window state presentation so the command window remains suppressed during target selection as well as Skills/Magick/Item selection
- Added dedicated Battle Presentation & Feedback regression coverage for encounter/turn context, target-selection command suppression, contextual controls, and bounded combat messages
- Added Skills UI Integration Cleanup v1 so the battle Skills selector is rendered as a first-class battle selection window and suppresses the command window while open
- Added shared `Window_TextLayout` wrapping/truncation for bounded ability descriptions and applied it to field Skills and Magick detail panels
- Added dedicated Skills UI integration regression coverage for battle-window rendering, command-window suppression, bounded description layout, and script-load order
- Added Character Valor Arts v1 with one canonical starter Art per current actor: Tyler's **Unbroken**, Sarah's **Rallyheart**, Aboo's **Wild Arc**, and G Prime's **Zero Lock**
- Expanded the shared Skills effect vocabulary only as required by the approved Arts: percentage healing, reusable status application, and optional status payloads on physical-damage Skills
- Added data-driven support/control Skill categories and status-reference validation without introducing character-name checks in battle execution
- Added Save Runtime v9 with v1-v8 migration so pre-Pass-38 saves receive each actor's newly canonical starter Valor Art while current v9 saves preserve explicit learned-Skill state
- Added dedicated Character Valor Arts regression coverage for canonical ownership, single-target burst damage, party healing, all-target damage/status application, battlefield control, and Valor consumption
- Added Valor Arts Runtime v1 as a thin specialization of the existing Skills runtime through optional validated `valorArt: true` metadata
- Added generic Skill-cost hooks to shared Skill legality/execution while keeping full-gauge Valor ownership and payment in `Game_Actor`
- Added Valor-ready gating, one-time full-gauge consumption on committed legal use, no-cost behavior for regular Skills, and protection against spending Valor when no legal target remains
- Added `[VALOR]` presentation in battle/field Skills windows plus dedicated regression coverage for readiness, restrictions, misses, invalid targets, all-target use, command availability, and actor-only resource ownership
- Kept `data/Skills.json` content-neutral and Save Runtime at v8 because Valor Arts introduce no new persistent state; canonical character-specific Arts remain deferred
- Added Skills Runtime v1 as Sektor 1's canonical non-Magick technique foundation, with a separate `data/Skills.json` database and actor-owned `initialSkillIds` / `skillIds` state
- Added validated physical-damage Skill metadata (`powerMultiplier`, target groups, and single/all scope) while intentionally leaving the canonical Skills catalog content-neutral until actual techniques are designed
- Added shared Skill legality and target validation on `Game_Battler`, reusing existing action restrictions and the established physical hit/damage/status/defeat/Valor pipeline instead of creating parallel combat rules
- Added battle and field Skills windows, shared actor navigation in the character menu, and battle command availability based on learned usable Skills
- Added Save Runtime v8 with learned-Skill persistence plus v1-v7 migration, preserving the historical pre-Pass-29 `skills` save field solely as the legacy bridge into `magickIds`
- Added dedicated Skills runtime regression coverage and evolved the Magick terminology guard so canonical non-Magick Skills can coexist with the old-save Magick migration contract
- Added Valor Runtime v1 as Sektor 1's original pressure-response battle resource, replacing the earlier placeholder Limit terminology
- Added actor-owned, data-driven Valor capacity and gauge state with damage-based generation, ready-state detection, capped gain, and full-gauge consumption APIs
- Added Valor gain through the shared incoming-damage hook so actual resolved HP loss drives the gauge while nullified, absorbed, and lethal damage do not generate Valor
- Added battle-HUD and Status-window Valor presentation with explicit ready feedback and dedicated regression coverage for Fury, Sadness, Near-Death, persistence, and rendering
- Added Enemy Actions & AI v1 with validated, data-driven enemy action lists, weighted action selection, conditional decisions, target strategies, and safe Attack fallback
- Added `BattleEnemyAI` as the decision layer for enemy action eligibility, target selection, HP-based conditions, and weighted choice while `BattleManager` remains responsible for effect execution and presentation
- Added enemy Magick execution through the same shared battler Magick runtime used by actors, including MP costs, action restrictions, status payloads, Reflect, elemental damage, healing, and legal targeting
- Added dedicated Enemy AI regression coverage for weighted choices, HP conditions, Magick costs, healing priorities, fallback behavior, Confuse targeting, and schema validation
- Added Character Menu Navigation Consistency v1 with shared left/right party-member switching across Magick, Status, Equipment, and Essence
- Added `Window_ActorNavigator` to centralize party-member indexing, wraparound navigation, A/D and arrow-key input, and the shared `◀ Actor ▶` header
- Added dedicated character-menu navigation regression coverage for actor switching, selection resets, equipment-selector synchronization, header rendering, and Scene_Menu party-context wiring
- Added Shops & Gil Spending v1 with validated event-defined merchant inventories, canonical database pricing, and purchases across items, weapons, armor, and accessories
- Added an atomic `Game_Party.purchaseMerchandise()` transaction boundary so shop UI requests purchases while party ownership performs Gil and inventory mutation
- Added `Scene_Shop` / `Window_Shop` with a scrollable merchandise list, live Gil and owned-count display, purchase feedback, and a test merchant in Map001
- Added dedicated shop regression coverage for canonical pricing, insufficient-funds safety, UI presentation boundaries, event flow, and shop-data validation
- Added Accessories Equipment v1 with a canonical `Accessories.json` database, one actor accessory slot, inventory ownership, equipment-menu selection, and additive combat-stat bonuses
- Added `Game_Actor` accessory equip/unequip APIs and shared equipment-inventory helpers in `Game_Party` so weapons, armor, and accessories follow the same party storage contract
- Added validated `gainAccessory` / `gainAccessoryMessage` event commands and a test-chest accessory pickup path
- Added dedicated accessory regression coverage for ownership, combat bonuses, shared selector behavior, UI rendering, validation, and persistence
- Added Essence Equipment & Menu v1 with party-member switching, data-driven actor slot counts, a scrollable Essence catalog, and progression / Magick-awakening details
- Added slot-aware Essence APIs that preserve Resonance when unequipped and prevent duplicate Essence assignment within the same actor loadout
- Added dedicated Essence equipment regression coverage for slot rules, progression preservation, menu integration, actor switching, and validation
- Added Magick Terminology Migration v1, moving the current supernatural ability system from the legacy Skills/Magic namespace to canonical **Magick** terminology
- Renamed the canonical supernatural ability database to `data/Magick.json`, the field/battle Magick windows, Magick runtime APIs, Essence ability references, status metadata, regression suites, and player-facing command labels
- Added a dedicated future **Skills** namespace for non-Magick techniques without implementing a premature Skills runtime
- Added Save Runtime v4 migration so v1-v3 saves using legacy `skills` arrays restore into canonical `magickIds` state
- Added dedicated Magick terminology regression coverage guarding canonical files, APIs, data keys, docs, and legacy-save compatibility
- Completed `Magick.json` v1
- Added 54 initial Magick abilities
- Defined Restore Magick
- Defined Attack Magick
- Defined Indirect Magick
- Defined Advanced Magick
- Completed `Essences.json` v1
- Added 19 initial Essences
- Assigned all 54 current Magick abilities across the Essence system
- Defined Resonance progression
- Defined Mastery Ready at 1500 Resonance
- Defined Level 4 Essence passives
- Defined the Mastery Trial concept
- Defined Essence Evolution eligibility
- Completed `Statuses.json` v1
- Added 25 initial statuses
- Defined reusable status families
- Defined reusable status duration models
- Defined countdown statuses
- Defined derived statuses
- Added canonical status-effect data architecture
- Added project architecture documentation
- Added battle-system documentation
- Added coding and data conventions
- Added the Sektor 1 Design Bible
- Added the high-level development roadmap
- Added validated, data-driven battle encounters
- Added map-event battle entry through `SceneManager.startBattle()`
- Added Battle Resolution v1 with idempotent victory, defeat, and escape finalization
- Added enemy EXP rewards and active-battle-party EXP distribution
- Added structured battle results returned to the originating map event
- Added regression coverage for duplicate battle rewards and post-battle cleanup
- Added Status Runtime Core v1 with reusable status lookup, application, removal, duration refresh, resistance/immunity rates, derived-state evaluation, and runtime summaries
- Added battler-relative status timing for party and enemy turns, including skipped-turn duration progression
- Added turn-start Poison / Dual damage and Regen healing processing
- Added generic `canAct` enforcement for Stop, Paralyze, and other action-blocking statuses
- Added battle HUD and enemy-field status indicators with remaining-turn summaries
- Added dedicated status-runtime regression coverage
- Added Status Combat Modifiers v1 with shared physical/magical incoming-damage resolution
- Added data-driven outgoing physical-damage and physical-accuracy status modifiers
- Added Sleep / Confuse physical-damage removal and Shield elemental-Magick absorption
- Added dedicated combat-modifier regression coverage
- Added Magick / Status Integration v1 so Magick status payloads route through the shared Status Runtime
- Added ally-specific status chances, reversible status toggles, status removal, and damage-plus-status resolution
- Added battle feedback for applied, refreshed, removed, resisted, and immune Magick-driven statuses
- Added dedicated Magick/status integration regression coverage
- Added Reflect Runtime v1 with per-target Magick redirection and canonical one-bounce protection
- Added reflection-aware Magick resolution that preserves the original caster, scope, status payload, and single MP cost
- Added dedicated Reflect regression coverage for direct, all-target, ally-only, non-reflectable, and healing cases
- Added Action Restrictions v1 with data-driven `allowedActions` and `blockedActionTypes` handling
- Added Silence Magick blocking and Frog Attack-only command restrictions through the shared battler runtime
- Added battle-command availability feedback plus dedicated action-restriction regression coverage
- Added Defeat & Revival Runtime v1 with a shared data-driven defeated-state contract
- Added Petrify defeat handling without forcing HP to zero
- Added Rekindle / Reawakening revival execution, defeated-target selection, and revival-aware Reflect routing
- Added dedicated defeat/revival regression coverage for battle outcomes, rewards, cleansing, targeting, and metadata validation
- Added Forced Action Control v1 with data-driven Confuse target randomization and Berserk automatic physical attacks
- Added cross-side Confuse targeting for basic attacks, legal-target randomization for single-target Magick, and enemy friendly-fire support
- Added forced-control metadata validation and dedicated regression coverage
- Added Turn Speed Runtime v1 with data-driven Haste / Slow scheduling for party and enemy turns
- Added fractional turn progress, interleaved bonus slots, and battler-relative countdown pacing under Haste / Slow
- Added turn-speed metadata validation and dedicated scheduler regression coverage
- Added Save Runtime v2 with full-party actor serialization, save-eligible status persistence, version-aware loading, and version-1 migration
- Added save-schema validation, inventory normalization, safe malformed/future-save rejection, and storage-write failure handling
- Added menu-facing save/load failure feedback and dedicated save-runtime regression coverage
- Added `docs/audit_closure.md` to reconcile the historical repository audit against current code before selecting future passes
- Added Database Contract Hardening v1 with field-level validation for actors, enemies, battle sprites, items, equipment, Magick, statuses, and Essences
- Added Essence progression/reference validation, including monotonic Resonance thresholds and canonical Magick/status references
- Added dedicated database-contract regression coverage for malformed runtime-consumed data
- Added Map & Event Contract v1 with load-time validation for map geometry, transfers, events, pages, conditions, recursive commands, and database references
- Added dedicated map/event contract regression coverage for malformed world/event data and runtime input normalization
- Added Magick Runtime Completion v1 with data-driven Gravity damage, percentage healing, multi-hit/random-per-hit casting, Retreat escape, and Banish execution
- Added battle-local Banish provenance so future currency rewards can honor the canonical no-Gil rule without Magick-name checks
- Added dedicated Magick-runtime completion regression coverage
- Added Actor / Party Ownership Cleanup v1 with data-driven actor construction, validated starter Magick, explicit actor-context menus, and dedicated ownership regression coverage
- Added UI Resilience v1 with shared scrolling list viewports for inventory, equipment selection, field Magick, battle items, and battle Magick
- Added explicit battle-sprite load diagnostics plus named visual fallbacks and dedicated UI-resilience regression coverage

- Added Audit Runtime Cleanup v1 with completed Stop turn-progression semantics and a reusable Valor-gain multiplier contract
- Added dedicated regression coverage for Stop personal-clock freezing, Valor multiplier composition, and database-accessor fallback consistency
- Added Battle Rewards v1 with persistent Gil, validated enemy drop tables, exactly-once drop resolution, and battle Resonance rewards
- Added actor-owned equipped Essence progression state with 1500-Resonance Mastery-Ready capping and Save Runtime v3 persistence
- Added dedicated battle-reward regression coverage for Banish no-Gil behavior, drop aggregation, surviving-participant Resonance, Mastery Ready transitions, and duplicate-finalization protection
- Added Battle Results Screen v1 with victory summaries for EXP, Gil, item drops, party level-ups, Essence Resonance, awakened Magick, and Mastery Ready transitions
- Added scrollable battle-results progression details while preserving exactly-once reward finalization
- Added dedicated battle-results regression coverage for presentation data, overflow scrolling, and finalize-before-exit scene flow

### Changed

- Moved battle messages from above the bottom HUD into a fixed top message strip so combat feedback no longer competes with four-actor party information
- Reworked the bottom party HUD from horizontally expanding actor blocks into four stable vertical rows with name/status plus readable HP, MP, and Valor presentation
- Moved contextual battle-control hints immediately above the bottom HUD and made the top battle header surface either active-actor context or the currently selected target
- Hardened Map001 regression tests so battle/shop validation locates semantic commands instead of depending on event-array positions that can shift as tester events are added
- Centralized battle selection-window rendering over Skills, Magick, and Items so a newly opened selector cannot remain input-active but visually omitted from `BattleRenderer`
- Extended shared list-viewport regression coverage to the Skills field/battle windows introduced after the original UI-resilience audit
- Reconciled stale documentation that still described the first canonical character Valor Arts as future work
- Renamed the active `limitGainMultiplier` status contract to canonical `valorGainMultiplier` terminology and reserved future character-specific techniques as **Valor Arts** within the non-Magick Skills namespace
- Upgraded persistent saves to version 7 so actor Valor survives save/load, with compatibility migration from save versions 1 through 6
- Moved reusable Magick execution and relative ally/enemy target legality from `Game_Actor` to `Game_Battler` so actors and enemies share one Magick engine instead of duplicating spell logic
- Upgraded the Test Slime from basic-attack-only behavior to a weighted Attack / Ember / conditional Mend action profile while preserving basic Attack as the universal fallback when configured actions are unusable
- Updated `Scene_Menu` so Magick, Status, Equipment, and Essence receive explicit `Game_Party` context instead of fixed leader references
- Refactored Essence actor switching onto the same reusable navigation helper now used by the other character-specific field menus
- Upgraded persistent saves to version 6 so actor accessory equipment and party accessory inventory persist, with compatibility migration from save versions 1 through 5
- Extended the equipment selector and equipment overview to handle Weapon, Armor, and Accessory through the same UI path, including accessory stat previews
- Upgraded persistent saves to version 5 so Essence progression and equipped slot IDs persist independently, with compatibility migration from save versions 1 through 4
- Reconciled the stale actor-ownership regression with canonical `Actors.json` starter-Magick data instead of hard-coding a previous actor setup
- Made the defeat/revival regression deterministic by disabling unrelated random item-drop resolution inside that test
- Normalized the complete documentation suite, including the historical repository audit, to distinguish current **Magick** from future non-Magick **Skills** while preserving Magic / Magic Attack / Magic Defense as combat-stat terminology
- Upgraded persistent saves to version 4 for the Magick terminology migration, with compatibility migration from save versions 1, 2, and 3
- Upgraded persistent saves to version 3 so Gil and equipped Essence progression survive save/load, with migration from v1 and v2 formats
- Replaced Pass 11's currency/drop/Resonance reward extension stubs with live data-driven reward resolution
- Marked the repository-audit closure phase complete after reconciling all 42 actionable findings
- Standardized all indexed `DatabaseManager` record/name accessors behind one null-safe convention with diagnostic unknown-ID fallbacks
- Made Stop freeze personal turn slots, turn-start triggers, fractional speed progress, and ordinary battler-relative timers while its own duration advances on the side-round clock
- Reclassified Fury / Sadness / Near-Death Valor modifiers as a complete Status Runtime contract; gauge accumulation is now owned by Valor Runtime
- Reconciled the audit tracker to 42 fixed / 0 partial / 0 open items after Pass 27; repository-audit closure is complete
- Expanded the project from single-character battle assumptions toward a multi-character party architecture
- Established canonical terminology across Magick, Essences, and Statuses
- Standardized status terminology including `paralyze` and `confuse`
- Clarified the separation between canonical data, runtime implementation, active TODO work, experimental ideas, and documentation
- Established Status Runtime as the current major development focus
- Removed hard-coded enemy construction from `Scene_Battle`
- Centralized terminal battle outcomes and final reward processing in `BattleManager`
- Made post-battle status cleanup honor `persistsAfterBattle` and restore defeated participants to 1 HP
- Made status reapplication refresh turn/countdown duration instead of creating duplicate runtime instances
- Made Fury and Sadness mutually exclusive at the shared battler-runtime layer
- Made the first party member of every new round receive the same turn-start status processing as later party members
- Routed player and enemy physical attacks through one status-aware physical damage path
- Routed Magick damage through target-side incoming-damage resolution
- Made enemy physical accuracy use enemy `attackPercent` safely instead of inheriting actor-only weapon assumptions
- Standardized Soul Cleanse's Slow-Numb reference on the canonical `slowNumb` runtime key
- Made Magick status metadata validate status chances, ally-specific chances, and toggle flags before runtime use
- Made Magick metadata require an explicit `reflectable` flag and validated Reflect status metadata before runtime use
- Centralized single-target and all-target Magick effect presentation through one reflection-aware per-target resolver
- Made actor Magick usability and battle command execution honor the same shared status-driven action restrictions
- Made Magick metadata require a non-empty `type` because status restrictions depend on reusable Magick categories
- Distinguished HP-zero death from the broader `isDefeated()` battle state so status-defined defeat can participate in outcome, targeting, animation, and reward logic
- Made Magick validation enforce the current effect vocabulary and validate `revivePercent` plus defeat/revival status metadata
- Corrected the stale `Game_Party` comment to the canonical four-member active battle limit
- Moved persistent save ownership from the legacy `$gameActor` alias to the full `Game_Party` actor roster
- Made persistent status restoration bypass initial application effects and recompute derived states from restored HP
- Marked Essence database loading complete in `TODO.md` because current `DatabaseManager` already loads `Essences.json`
- Hardened Magick validation for current type/category/element vocabularies, power, scopePower, special percentage fields, and multi-hit metadata
- Hardened the canonical status nested schema so unsupported condition/effect keys and malformed consumed values fail at database load
- Reconciled the validation audit cluster from 10 fixed / 5 partial / 27 open to 23 fixed / 3 partial / 16 open
- Replaced individually named `Game_System` actor ownership and temporary Magick grants with a canonical actor collection plus `Actors.json` `initialMagickIds`
- Removed active engine dependence on the `$gameActor` compatibility alias; party, interpreter, battle, and menu paths now resolve actor context through party ownership or explicit references
- Centralized equipment removal through `Game_Actor.unequipWeapon()` / `unequipArmor()` and renamed the unused ambiguous party clear operation to `clearInventory()`
- Reconciled the actor/party ownership audit cluster to 35 fixed / 1 partial / 6 open
- Reconciled the UI scalability / sprite-diagnostics audit cluster to 37 fixed / 1 partial / 4 open
- Removed the stale roadmap task to implement Essence database loading because the current engine already loads it and Pass 21 now validates it
- Made on-demand map loading validate the loaded map ID and runtime-consumed event contract before constructing world objects
- Normalized item-gain and additive-variable arithmetic so numeric-looking strings cannot silently concatenate runtime state
- Reconciled the map/event audit cluster from 23 fixed / 3 partial / 16 open to 26 fixed / 3 partial / 13 open
- Made Gravity damage derive from target current HP while continuing through shared elemental and incoming magical-damage handling
- Made percentage-healing metadata restore target HP through the shared healing path
- Made random-per-hit Magick own target selection at cast resolution and pay MP only once per cast
- Reconciled the remaining Magick-runtime audit cluster from 26 fixed / 3 partial / 13 open to 30 fixed / 1 partial / 11 open

### Documentation

The core documentation suite now defines distinct responsibilities for:

```text
README.md              Public project overview
TODO.md                Active unfinished work
CHANGELOG.md           Completed development history

docs/architecture.md   Technical structure and system ownership
docs/battle_system.md  Canonical battle mechanics
docs/coding_style.md   Coding and data conventions
docs/design_bible.md   Design identity and principles
docs/ideas.md          Experimental, non-canonical concepts
docs/roadmap.md        High-level development direction
docs/audit_closure.md  Current reconciliation of historical audit findings
```

`docs/ideas.md` remains intentionally non-canonical so experimental concepts have somewhere to develop before becoming established design.

---

# 🏺 Development History

The following entries preserve Sektor 1's original development-pass history.

---

## Pass 29 - Magick Terminology Migration v1

- Renamed the current supernatural ability system from legacy Skills/Magic terminology to canonical Magick terminology across data, runtime APIs, windows, tests, and documentation
- Reserved Skills as a future non-Magick namespace rather than aliasing it to the Magick system
- Bumped Save Runtime to v4 and migrated legacy `skills` arrays from v1-v3 saves into `magickIds`
- Preserved Magic, Magic Attack, and Magic Defense as combat-stat terminology
- Added terminology regression coverage so legacy current-system identifiers cannot silently return

---

## Pass 23 - Magick Runtime Completion v1

- Cross-referenced the remaining Magick-runtime audit findings against current `Magick.json`, battle execution, and regression coverage before implementation
- Connected `gravityPercent` to current-HP magical damage without Magick-name checks
- Connected `healPercent` to target maximum-HP restoration, closing an additional current-data gap that the historical audit did not explicitly list
- Implemented generic multi-hit / random-target-per-hit casting with one MP payment per cast and candidate rebuilding between hits
- Implemented the reusable `escape` effect through BattleManager's authoritative escape outcome, preserving zero-reward finalization
- Implemented the reusable `banish` effect through the canonical Death/defeat bridge and preserved banishment provenance for future no-Gil currency handling
- Added dedicated Magick-runtime completion regression tests and updated audit closure status

---

## Pass 22 - Map & Event Contract v1

- Cross-referenced the map/event and runtime-input audit findings against the current repository before implementation
- Added a `DatabaseValidator.validateMapData()` boundary to every on-demand map load
- Validated map identity, dimensions, player start, obstacles, transfers, event geometry, event pages, and page conditions
- Added recursive schema validation for every currently supported interpreter command, including nested choices and switch branches
- Validated item/weapon/armor/encounter references used by event commands before runtime execution
- Normalized item-gain quantities in both the interpreter and `Game_Party`, eliminating string-concatenation inventory arithmetic
- Normalized additive variable arithmetic in both the interpreter and `Game_Variables` while preserving unrestricted direct variable assignment
- Added dedicated map/event contract regression tests and updated audit closure status

---

## Pass 21 - Database Contract Hardening v1

- Cross-referenced the validation-related audit findings against the current runtime before changing schemas
- Added field-level actor/enemy combat-data validation, including actor growth/EXP and enemy element-rate contracts
- Added actor/enemy battle-sprite metadata validation plus item, weapon, and armor runtime-schema checks
- Expanded Magick validation across category, element, power, scopePower, special percentage fields, multi-hit metadata, and canonical status references
- Hardened Statuses.json nested classification/duration/condition/effect validation and rejected unsupported nested keys
- Added Essence-specific validation for ordered progression, Magick references, passive/common metadata, mastery data, and canonical status references
- Consolidated duplicated turn/countdown duration validation
- Added dedicated database-contract regression tests and updated audit closure status

---

## Pass 20 - Save Runtime v2 & Audit Reconciliation

- Reconciled all 42 actionable `repo_audit.md` headings against the current repository before selecting implementation work
- Added a persistent audit-closure tracker so future passes check current code/tests before rebuilding historical findings
- Replaced leader-only save serialization with full-party actor state persistence
- Persisted canonical post-battle statuses without re-running initial status application effects on load
- Added explicit Save Runtime v2 schema handling and migration from version-1 leader-only saves
- Added safe validation/normalization for actor state, inventories, location data, and malformed/future save versions
- Added save-write error handling and user-facing save/load failure messages
- Added dedicated Save Runtime regression tests

---

## Pass 19 - Turn Speed Runtime v1

- Connected Haste / Slow `turnSpeedMultiplier` metadata to shared party and enemy turn scheduling
- Added battle-local fractional turn progress with an opening-turn fairness seed for sub-normal speed
- Interleaved extra Haste slots after each battler's first available slot instead of stacking consecutive bonus turns
- Made battler-relative countdown pacing naturally accelerate under Haste and decelerate under Slow
- Added turn-speed metadata validation and dedicated regression tests
- Kept Stop's separate `haltsTurnProgression` semantics explicitly unfinished pending a deliberate expiration rule

---

## Pass 18 - Forced Action Control v1

- Connected Confuse `forceRandomTarget` metadata to player attacks, single-target Magick, and enemy physical turns
- Connected Berserk `playerControl` / `forcePhysicalAttack` metadata to automatic party attacks
- Added reusable target rebinding so forced selections reuse normal attack and Magick execution paths
- Added control-effect schema validation and dedicated regression tests

---

## Pass 17 - Defeat & Revival Runtime v1

- Added `isDefeated()` as the shared battle-state contract for HP-zero and status-defined defeat
- Connected Petrify's `countsAsDefeated` metadata to battle outcome, targeting, turn, presentation, and reward paths
- Implemented data-driven revival for Rekindle and Reawakening, including Death-status removal and percentage HP restoration
- Allowed status-cleansing Magick to target Petrified battlers while ordinary healing continues to reject defeated targets
- Added revive-aware reflection candidates and target-selection behavior
- Added defeat/revival schema validation and dedicated regression tests
- Corrected the active battle-party comment from three members to four

---

## Pass 16 - Action Restrictions v1

- Implemented shared battler action allowlists and blocked action-type rules from status data
- Connected Silence to Magick availability and Frog to Attack-only battle commands
- Added command-window dimming/skipping plus execution-time guards against restricted actions
- Added validation for Magick types and status restriction metadata
- Added dedicated regression tests for runtime, UI, and battle-flow restrictions

---

## Pass 15 - Reflect Runtime v1

- Implemented data-driven Reflect routing for canonical reflectable Magick
- Resolved all-target reflection independently per original target while preserving one MP payment per cast
- Allowed reflected effects to land across normal ally/enemy selection restrictions without becoming a second cast
- Enforced the canonical one-reflection cap to prevent bounce loops
- Added reflection metadata validation and dedicated regression tests

---

## Pass 14 - Magick / Status Integration v1

- Routed `Magick.json` status payloads through the shared Status Runtime for status-only and damaging Magick
- Added ally-specific application chances and reusable toggle semantics for reversible statuses
- Added reusable Magick-driven status removal and battle presentation of status outcomes
- Corrected Soul Cleanse to use the canonical `slowNumb` status key
- Added validation and regression tests for Magick/status metadata and runtime behavior
- Kept legacy `resist` and `deathforce` Magick references non-canonical until their owning status designs are approved

---

## Pass 13 - Status Combat Modifiers v1

- Added one shared target-side damage resolver for status-driven physical and magical mitigation
- Connected Barrier, MBarrier, Sadness, Small, Shield, Berserk, Frog, Fury, and Darkness modifier data to reusable combat paths
- Added Shield elemental-Magick absorption and physical immunity
- Added physical-damage wake rules for Sleep and Confuse
- Added regression tests for modifier stacking, accuracy, wake rules, and absorption

---

## Pass 12 - Status Runtime Core v1

- Audited the partially implemented status foundation and completed the reusable runtime core
- Added status chance, resistance, immunity, refresh, interaction, and derived-state rules
- Connected status timing to party and enemy turn flow
- Added initial data-driven turn-start status mechanics and status presentation
- Added regression tests for runtime behavior and turn-loop edge cases

---

## Pass 9 - Awakening ***

The battle engine now thinks in terms of an entire party
instead of a single player.

This lays the foundation for multiple controllable
characters and future turn queue mechanics.

---

## Pass 8 - Foundation

- Added Game_Party battle foundation
- Added shared Game_Battler architecture
- Added ally targeting
- Added multi-party battle preparation
- Added battle member APIs
- Added Database Validator
- Added Debug Manager

---

## Pass 7 - Target

- Completed Targeting System v1.0

---

## Earlier Passes

- Equipment
- Inventory
- Save / Load
- Battle animations
- Fire / Cure
- Side-view battles

---

# 📝 Changelog Rules

Use this file for notable work that has been completed.

Use `TODO.md` for work that still needs to be done.

While Sektor 1 remains without formal release version numbers, completed work can be recorded under **Unreleased**.

When formal versioning begins, the Unreleased entries can be moved beneath the appropriate version heading without rewriting the historical development passes.

Do not add speculative features to the changelog. Planned systems belong in `TODO.md` or `docs/roadmap.md`, and experimental concepts belong in `docs/ideas.md`.

The changelog answers:

> **What did we actually change?**

If the answer is still "we plan to," it does not belong here yet. 😄

---

Built with ❤️ by **Sarah & Tyler**
