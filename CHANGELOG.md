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

### Changed

- Expanded the project from single-character battle assumptions toward a multi-character party architecture
- Established canonical terminology across Skills, Essences, and Statuses
- Standardized status terminology including `paralyze` and `confuse`
- Clarified the separation between canonical data, runtime implementation, active TODO work, experimental ideas, and documentation
- Established Status Runtime as the current major development focus

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
