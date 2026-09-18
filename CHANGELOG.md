# 📜 Sektor 1 Changelog

Notable completed changes to Sektor 1 are recorded here.

`TODO.md` tracks unfinished work. This changelog records work that has actually been completed.

Until formal versioning begins, new completed work is collected under **Unreleased** while the original development-pass history is preserved below.

---

## Unreleased

### Added

- Completed `Skills.json` v1
- Added 54 initial skills
- Defined Restore Magic
- Defined Attack Magic
- Defined Indirect Magic
- Defined Advanced Magic
- Completed `Essences.json` v1
- Added 19 initial Essences
- Assigned all 54 current skills across the Essence system
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
- Added Sleep / Confuse physical-damage removal and Shield elemental-magic absorption
- Added dedicated combat-modifier regression coverage
- Added Skill / Status Integration v1 so skill status payloads route through the shared Status Runtime
- Added ally-specific status chances, reversible status toggles, status removal, and damage-plus-status resolution
- Added battle feedback for applied, refreshed, removed, resisted, and immune skill-driven statuses
- Added dedicated skill/status integration regression coverage
- Added Reflect Runtime v1 with per-target skill redirection and canonical one-bounce protection
- Added reflection-aware magic resolution that preserves the original caster, scope, status payload, and single MP cost
- Added dedicated Reflect regression coverage for direct, all-target, ally-only, non-reflectable, and healing cases
- Added Action Restrictions v1 with data-driven `allowedActions` and `blockedSkillTypes` handling
- Added Silence magic blocking and Frog Attack-only command restrictions through the shared battler runtime
- Added battle-command availability feedback plus dedicated action-restriction regression coverage
- Added Defeat & Revival Runtime v1 with a shared data-driven defeated-state contract
- Added Petrify defeat handling without forcing HP to zero
- Added Rekindle / Reawakening revival execution, defeated-target selection, and revival-aware Reflect routing
- Added dedicated defeat/revival regression coverage for battle outcomes, rewards, cleansing, targeting, and metadata validation

### Changed

- Expanded the project from single-character battle assumptions toward a multi-character party architecture
- Established canonical terminology across Skills, Essences, and Statuses
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
- Routed magical skill damage through target-side incoming-damage resolution
- Made enemy physical accuracy use enemy `attackPercent` safely instead of inheriting actor-only weapon assumptions
- Standardized Soul Cleanse's Slow-Numb reference on the canonical `slowNumb` runtime key
- Made skill status metadata validate status chances, ally-specific chances, and toggle flags before runtime use
- Made skill metadata require an explicit `reflectable` flag and validated Reflect status metadata before runtime use
- Centralized single-target and all-target magic effect presentation through one reflection-aware per-target resolver
- Made actor skill usability and battle command execution honor the same shared status-driven action restrictions
- Made skill metadata require a non-empty `type` because status restrictions depend on reusable skill categories
- Distinguished HP-zero death from the broader `isDefeated()` battle state so status-defined defeat can participate in outcome, targeting, animation, and reward logic
- Made skill validation enforce the current effect vocabulary and validate `revivePercent` plus defeat/revival status metadata
- Corrected the stale `Game_Party` comment to the canonical four-member active battle limit

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
```

`docs/ideas.md` remains intentionally non-canonical so experimental concepts have somewhere to develop before becoming established design.

---

# 🏺 Development History

The following entries preserve Sektor 1's original development-pass history.

---

## Pass 17 - Defeat & Revival Runtime v1

- Added `isDefeated()` as the shared battle-state contract for HP-zero and status-defined defeat
- Connected Petrify's `countsAsDefeated` metadata to battle outcome, targeting, turn, presentation, and reward paths
- Implemented data-driven revival for Rekindle and Reawakening, including Death-status removal and percentage HP restoration
- Allowed status-cleansing skills to target Petrified battlers while ordinary healing continues to reject defeated targets
- Added revive-aware reflection candidates and target-selection behavior
- Added defeat/revival schema validation and dedicated regression tests
- Corrected the active battle-party comment from three members to four

---

## Pass 16 - Action Restrictions v1

- Implemented shared battler action allowlists and blocked skill-type rules from status data
- Connected Silence to magic-skill availability and Frog to Attack-only battle commands
- Added command-window dimming/skipping plus execution-time guards against restricted actions
- Added validation for skill types and status restriction metadata
- Added dedicated regression tests for runtime, UI, and battle-flow restrictions

---

## Pass 15 - Reflect Runtime v1

- Implemented data-driven Reflect routing for canonical reflectable skills
- Resolved all-target reflection independently per original target while preserving one MP payment per cast
- Allowed reflected effects to land across normal ally/enemy selection restrictions without becoming a second cast
- Enforced the canonical one-reflection cap to prevent bounce loops
- Added reflection metadata validation and dedicated regression tests

---

## Pass 14 - Skill / Status Integration v1

- Routed `Skills.json` status payloads through the shared Status Runtime for status-only and damaging skills
- Added ally-specific application chances and reusable toggle semantics for reversible statuses
- Added reusable skill-driven status removal and battle presentation of status outcomes
- Corrected Soul Cleanse to use the canonical `slowNumb` status key
- Added validation and regression tests for skill/status metadata and runtime behavior
- Kept legacy `resist` and `deathforce` skill references non-canonical until their owning status designs are approved

---

## Pass 13 - Status Combat Modifiers v1

- Added one shared target-side damage resolver for status-driven physical and magical mitigation
- Connected Barrier, MBarrier, Sadness, Small, Shield, Berserk, Frog, Fury, and Darkness modifier data to reusable combat paths
- Added Shield elemental-magic absorption and physical immunity
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
