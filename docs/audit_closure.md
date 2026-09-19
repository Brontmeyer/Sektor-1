# Sektor 1 Audit Closure Tracker

This document reconciles the historical static review in `docs/repo_audit.md`
against the **current repository**.

The audit is evidence from the point in time when it was written. It is not a
current TODO list by itself. Before implementing any audit finding, compare it
against current code, tests, `CHANGELOG.md`, `TODO.md`, and `docs/roadmap.md` so
completed work is not rebuilt under a new pass name.

## Closure Rule

An audit item is considered closed only when it is one of:

- **Fixed** — the current runtime/data/docs now address the finding and relevant
  regression coverage exists where practical.
- **Superseded** — later architecture deliberately replaced the assumption that
  produced the finding.
- **Closed by decision** — the item was a possible improvement rather than a
  defect, and the project deliberately chose not to change it. The reason must
  be documented here.

**Partial** and **Open** items keep audit closure active.

When no actionable item remains Partial or Open, the audit-closure phase is
complete and normal new-feature development can become the primary focus.

## Current Reconciliation

After Pass 20, the 42 actionable audit headings reconcile to:

- **Fixed / superseded:** 10
- **Partial:** 5
- **Open:** 27

The audit's later "Verified Behavior and Design Context" section is reference
material, not a fix backlog, and is therefore not counted in the 42 actionable
headings.

| # | Audit finding | Current status | Current-repo reconciliation |
|---:|---|---|---|
| 1 | Essences database lacks validation | Open | `Essences.json` loads, but `DatabaseValidator` still has no Essence-specific validation. |
| 2 | Game_Party battle-member comment disagrees with implementation | Fixed | Pass 17 corrected the comment to the canonical four-member limit. |
| 3 | SaveManager persists only the legacy leader actor | Fixed | Pass 20 Save Runtime v2 serializes/restores every actor owned by `Game_Party`. |
| 4 | Runtime battler statuses are not persisted by SaveManager | Fixed | Pass 20 persists/restores status runtime state whose canonical status is allowed to persist after battle; derived states are recomputed. |
| 5 | Skills.json defines effects that Game_Actor.useSkill() cannot execute | Partial | Heal, damage, status application/removal, and revive execute. Escape and banish remain unsupported; specialized damage metadata is tracked separately below. |
| 6 | Skill `status` metadata has no identified runtime consumer | Fixed | Pass 14 routes skill status payloads through the shared status runtime. |
| 7 | Status and skill combat metadata are only partially integrated | Partial | Passes 11–19 connected cleanup, removability, duration, triggers, modifiers, Reflect, action restrictions, defeat/revival, forced control, and Haste/Slow. Stop turn-progression halt semantics and Fury/Sadness Limit gain remain intentionally unfinished. |
| 8 | `allyStatusChance` currently has no runtime consumer | Fixed | Pass 14 applies ally-specific status chances through the shared skill/status resolver. |
| 9 | Legacy `$gameActor` dependency remains widespread | Open | Pass 20 removes SaveManager's actor-state dependence on the alias, but menus/interpreter/equipment and other leader-centric paths still use it. |
| 10 | Database accessor consistency | Open | Accessor fallback/optional-chaining conventions still vary. Low-risk cleanup decision remains. |
| 11 | Status nested-schema validation is permissive | Partial | Later passes validate many consumed fields, but unsupported/unknown nested status effect keys are not comprehensively rejected. |
| 12 | Essence level calculation assumes ordered progression data | Open | `Game_Essence.level()` still trusts database order; validator does not enforce monotonic level/resonance progression. |
| 13 | Small validation duplication in duration rules | Open | Readability-only cleanup remains; no runtime defect. May be closed by decision later. |
| 14 | Game_System actor ownership is individually hard-coded | Open | `actor`, `actor2`, `actor3`, and `actor4` remain individually constructed. |
| 15 | Temporary party skill setup lives in Game_System | Open | The explicit `TEMP` skill-learning block remains in `Game_System`. |
| 16 | Game_Party.clear() clears inventory only | Open | Method remains inventory-only and apparently unused; dead-code/rename decision remains. |
| 17 | Save version is written but not consumed during loading | Fixed | Pass 20 introduces version-aware Save Runtime v2 plus v1 migration and future/unknown-version rejection. |
| 18 | Window_Equipment bypasses Game_Actor APIs when unequipping | Open | Window still assigns `weaponId = 0` / `armorId = 0` directly. |
| 19 | Skill validation covers only target, scope, and MP cost | Partial | Later passes added type, effect, revive, reflection, and status validation. Category, element, power, scopePower, gravity, and multi-hit contracts still need validation alongside their runtime work. |
| 20 | Gravity skill percentage metadata has no identified runtime consumer | Open | `gravityPercent` still has no runtime consumer. |
| 21 | Multi-hit and per-hit random-target metadata have no identified runtime consumer | Open | `hits` / `randomTargetPerHit` still have no runtime consumer. |
| 22 | Skill effect vocabulary exceeds the implemented runtime dispatcher | Partial | Status and revive effects are now implemented. Escape and banish remain unsupported. |
| 23 | Enemy `elementRates` is runtime-consumed but not specifically validated | Open | Enemy validation currently checks EXP rewards but not elemental-rate schema. |
| 24 | Battle-sprite metadata is runtime-consumed but not specifically validated | Open | Actor/enemy battle sprite dimensions/frame metadata still lack field-specific validation. |
| 25 | Actor `growth` data is runtime-consumed but not specifically validated | Open | Level-up still trusts the growth object. |
| 26 | Actor initial `exp` data is runtime-consumed but not specifically validated | Open | Actor database load still lacks initial EXP validation. |
| 27 | Battle-sprite asset failures are handled safely but silently | Open | No explicit image-load error diagnostic/fallback is present. |
| 28 | Save data declares a version but is not schema- or version-validated during load | Fixed | Pass 20 establishes migration, structural validation, numeric normalization, safe failure, and menu-facing failure handling. |
| 29 | Save writes do not handle storage failures | Fixed | Pass 20 catches serialization/storage failures and returns a normal failure result with diagnostic text. |
| 30 | Item gain commands do not validate quantities consistently with equipment gain commands | Open | Item event commands and `Game_Party.gainItem()` still accept unnormalized arithmetic input. |
| 31 | Item runtime schema is not specifically validated at database load time | Open | Items still receive only generic indexed validation. |
| 32 | Weapon and armor combat schemas are not specifically validated at database load time | Open | Equipment records still lack field-specific combat-schema validation. |
| 33 | Several selectable list windows do not support more entries than their fixed layouts | Open | Inventory, equipment-select, field magic, battle item, and battle magic still render full lists without scrolling/paging. |
| 34 | The battle scene has no identified runtime entry path and hardcodes its encounter | Fixed | `SceneManager.startBattle()` / interpreter battle commands provide runtime entry and `Scene_Battle` consumes validated encounter data. |
| 35 | `addVariable` performs arithmetic without numeric normalization | Open | `commandAddVariable()` still passes unnormalized input to additive variable arithmetic. |
| 36 | Individual map data is loaded without an identified schema-validation boundary | Open | `DatabaseManager.loadMap()` still returns parsed map JSON without map/event schema validation. |
| 37 | Skill `scopePower` metadata is consumed but not validated | Open | Runtime consumes `scopePower`; validator still does not validate its keys/multipliers. |
| 38 | Skill `power` metadata is consumed but not validated | Open | Runtime consumes `power`; validator still does not enforce a finite-number contract. |
| 39 | Battle victories do not award experience | Fixed | Pass 11 awards defeated-enemy EXP exactly once to active battle-party members. |
| 40 | Currency rewards are not implemented | Open | No currency state/API/reward path exists yet. |
| 41 | Battle item drops are not implemented | Open | No enemy drop-table schema or victory drop resolver exists yet. |
| 42 | Battle victories do not award Essence Resonance | Open | Essence Resonance is not yet connected to victory processing/equipped Essence progression. |

## Pass Selection Gate

Before starting a new improvement pass:

1. Read the relevant audit finding(s).
2. Search the **current repository** for the claimed missing behavior.
3. Check current tests, changelog, TODO, roadmap, and this tracker.
4. If current runtime already implements the behavior, update this tracker instead
   of rebuilding it.
5. Prefer a pass that closes one coherent current gap end-to-end.
6. Update this tracker after the pass so the audit backlog always reflects the
   code that actually exists.

## Current Highest-Value Audit Buckets

The remaining work clusters naturally into these areas:

1. **Save / ownership cleanup aftermath** — reduce remaining `$gameActor`
   assumptions and centralize actor/equipment ownership boundaries.
2. **Database and map validation** — Essences, actors, enemies, equipment,
   items, skills, status nested schemas, and map/event data.
3. **Remaining skill runtime** — Gravity, multi-hit/random-per-hit, escape, and
   banish.
4. **UI scalability / diagnostics** — scrolling list windows and sprite-load
   diagnostics.
5. **Battle rewards / Essence progression** — currency, drops, and Resonance.
6. **Small correctness/cleanup findings** — item/addVariable normalization,
   accessor consistency, unused/ambiguous APIs, and temporary setup code.
7. **Status dependencies awaiting future systems** — Stop's turn-progression
   semantics and Fury/Sadness Limit gain behavior.
