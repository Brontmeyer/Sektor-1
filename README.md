# 🎮 Sektor 1

**Sektor 1** is a modern JRPG built from scratch in JavaScript.

Inspired by classic JRPGs, Sektor 1 combines traditional turn-based RPG
design with a custom engine built to remain clean, modular, and
expandable as the game grows.

Rather than relying on a prebuilt battle engine, the game's major
systems are being designed and implemented specifically for Sektor 1.

------------------------------------------------------------------------

# ⚔️ Current Development Focus

## Post-Audit Feature Development

The historical repository-audit backlog is now fully reconciled against the current codebase. Core battle resolution, status/Magick runtime, persistence, validation, ownership, UI resilience, and battle rewards have dedicated runtime paths and regression coverage.

New development can now be selected primarily from the active roadmap and TODO priorities, while continuing to verify current code before implementing overlapping work.

### Recently Completed

-   ✅ Magick System v1
-   ✅ 54 initial Magick abilities
-   ✅ Essence System v1
-   ✅ 19 initial Essences
-   ✅ Essence Resonance and Mastery design
-   ✅ Status System v1
-   ✅ 25 initial status effects
-   ✅ Reusable status families and duration models
-   ✅ Countdown and derived status architecture
-   ✅ Battle EXP / Gil / item-drop rewards
-   ✅ Battle Essence Resonance progression
-   ✅ Repository-audit closure
-   ✅ Magick Terminology Migration v1

------------------------------------------------------------------------

# 🛠️ Engine Foundation

Sektor 1 uses a modular JavaScript engine designed to allow individual
systems to grow without tightly coupling unrelated parts of the game.

Completed foundations include:

-   ✅ Modular engine architecture
-   ✅ Shared `Game_Battler` system
-   ✅ Party foundation
-   ✅ Multi-character turn system
-   ✅ Turn queue
-   ✅ Save / Load (version-aware Save Runtime v5)
-   ✅ Equipment system
-   ✅ Inventory system

------------------------------------------------------------------------

# ⚔️ Battle System

The battle system is being built specifically for Sektor 1.

Current battle features include:

-   ✅ Side-view battles
-   ✅ Multi-character turns
-   ✅ Single-target actions
-   ✅ All-target actions
-   ✅ Ally targeting
-   ✅ Enemy targeting
-   ✅ Battle effects
-   ✅ Animation controller
-   ✅ Magick foundation
-   ✅ Idempotent battle resolution and structured rewards
-   ✅ Gil, enemy item drops, and Essence Resonance rewards

Systems currently being expanded include:

-   ✅ Essence Equipment & Menu v1
-   🚧 Essence ability grants and passive runtime
-   🚧 Enemy AI
-   🚧 Boss mechanics
-   🚧 Limit Skills

------------------------------------------------------------------------

# ✨ Magick

The initial Magick database contains **54 Magick abilities** divided across several
major categories:

-   Restore Magick
-   Attack Magick
-   Indirect Magick
-   Advanced Magick

Magick is data-driven through `data/Magick.json`, allowing battle
behavior to be expanded without hard-coding individual spells throughout
the engine.

Summon Magick is a future Magick category. The separate **Skills** namespace is reserved for future non-Magick techniques, including concepts such as Limit Skills once their design is approved.

Combat-stat terminology remains **Magic**, **Magic Attack**, and **Magic Defense**. Those names describe character statistics rather than the Magick ability namespace.

------------------------------------------------------------------------

# 🥋 Skills (Future Non-Magick Techniques)

**Skills** is intentionally reserved for future physical, technical, tactical, or otherwise non-Magick abilities. It does not currently have a canonical database or runtime.

This separation keeps Essence-linked supernatural abilities under **Magick** while leaving a clean namespace for future techniques that should not behave like spells.

------------------------------------------------------------------------

# 💎 Essence System

Essences are one of Sektor 1's primary character-progression systems.

The initial database contains **19 Essences**, with all 54 current
Magick abilities assigned to an Essence.

Essences can grow through **Resonance**, unlocking abilities and unique
passive effects as they develop.

At maximum Resonance, an Essence becomes **Mastery Ready**. Completing
its eventual Mastery Trial allows it to reach its mastered state.

The system is also designed to support future **Essence Evolution**.

Essence Equipment & Menu v1 gives every current actor **3 data-driven Essence slots**, party-member switching in the menu, progression details, and a scrollable canonical Essence catalog. Resonance belongs to the actor's Essence progression state rather than to the slot, so unequipping and re-equipping an Essence preserves its growth.

The v1 selector intentionally exposes the canonical Essence catalog while long-term acquisition / ownership rules remain undecided. Future acquisition can filter that catalog without changing the actor slot API.

------------------------------------------------------------------------

# 🧪 Status System

Sektor 1 currently defines **25 status effects** through
`data/Statuses.json`.

The system is designed around reusable mechanics rather than hard-coded
status behavior.

The status architecture supports concepts including:

-   Positive and negative statuses
-   Status families
-   Turn-based durations
-   Persistent statuses
-   Damage and healing over time
-   Action restrictions
-   Damage and accuracy modifiers
-   Turn-speed modifiers
-   Transformations
-   Defeat states
-   Countdown statuses
-   Derived battle states
-   Status interaction and removal
-   Defensive effects
-   Elemental Magick absorption

The database design is complete for Status System v1. Runtime
implementation is the current development focus.

------------------------------------------------------------------------

# 🗃️ Data-Driven Design

Core gameplay definitions are stored separately from engine code.

Canonical game data currently includes:

``` text
data/Magick.json
data/Essences.json
data/Statuses.json
```

This separation allows gameplay content to expand while keeping the
underlying engine maintainable.

------------------------------------------------------------------------

# 🌎 Future Development

Major systems still planned include:

-   Enemy AI
-   Boss scripting
-   Party switching
-   Limit Skills
-   Summon Magick
-   World exploration
-   Towns and dungeons
-   Side quests
-   Event scripting
-   Cutscenes
-   Essence Mastery Trials
-   Essence Evolution
-   Story campaign

------------------------------------------------------------------------

# 📚 Documentation

Technical and design documentation lives in the `docs/` directory.

``` text
docs/
├── architecture.md
├── audit_closure.md
├── battle_system.md
├── coding_style.md
├── design_bible.md
├── ideas.md
├── repo_audit.md
└── roadmap.md
```

Each document has a specific purpose:

-   **architecture.md** - Engine structure and system relationships
-   **audit_closure.md** - Completed reconciliation of historical audit findings
-   **battle_system.md** - Canonical battle rules and mechanics
-   **coding_style.md** - Project coding and data conventions
-   **design_bible.md** - Core game-design principles and terminology
-   **ideas.md** - Experimental and unapproved concepts
-   **repo_audit.md** - Historical static repository audit
-   **roadmap.md** - High-level development milestones

`TODO.md` tracks active unfinished development work.

------------------------------------------------------------------------

# 💻 Technology

Sektor 1 is currently built with:

-   JavaScript
-   HTML5 Canvas
-   JSON
-   Git
-   GitHub
-   Visual Studio Code

------------------------------------------------------------------------

# 🧭 Development Philosophy

Sektor 1 is developed **one system at a time**.

Every new feature should make the engine easier to understand, maintain,
and expand.

Gameplay data should remain separate from engine logic whenever
practical, allowing new Magick abilities, Skills, statuses, Essences, enemies, and other
content to be added without rewriting unrelated systems.

The goal is not simply to finish one game.

The goal is to build a foundation capable of supporting Sektor 1 as it
continues to grow.

------------------------------------------------------------------------

# 📌 Project Status

### Completed Design Milestones

-   ✅ Magick System v1
-   ✅ Essence System v1
-   ✅ Status System v1

### Current Focus

> 🚧 **Post-audit feature development**

See [`TODO.md`](TODO.md) for the current development checklist.

------------------------------------------------------------------------

Built with ❤️ by **Sarah & Tyler**
