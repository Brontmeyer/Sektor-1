# Repository Audit Closure Tracker

## Post-Audit Terminology Migration

Pass 29 does not reopen any audit finding. It renames the current supernatural ability system to **Magick**, reserves **Skills** for future non-Magick techniques, and bumps Save Runtime to v4 so legacy v1-v3 `skills` save fields migrate safely into `magickIds`. The historical audit text has been terminology-normalized for readability while retaining its original findings.

Pass 30 likewise does not reopen the audit. Essence Equipment & Menu v1 builds on the already-closed Essence reward/persistence foundation, and Save Runtime v5 migrates v1-v4 saves into slot-aware Essence progression without changing any historical audit classification.

Pass 31 likewise adds no reopened audit item. Accessories Equipment v1 extends the already-closed equipment/database/save boundaries with a third conventional equipment type, and Save Runtime v6 migrates v1-v5 saves without changing any historical finding status.

Pass 32 likewise adds no reopened audit item. Shops & Gil Spending v1 consumes the already-closed Gil, inventory, database-price, map/event-validation, and UI-list boundaries. It adds no new persistent state, so Save Runtime remains v6.

Pass 33 likewise adds no reopened audit item. Character Menu Navigation Consistency v1 replaces fixed leader context in Magick, Status, and Equipment with the same explicit party-context navigation contract already established by Essence, using one shared UI helper without changing gameplay state or persistence.

Pass 34 likewise adds no reopened audit item. Enemy Actions & AI v1 is new post-audit gameplay development built on the already-closed battle, validation, action-restriction, targeting, and Magick boundaries. The pass moves shared Magick execution from actor-only ownership to `Game_Battler` so enemies reuse the same runtime rather than duplicating it; Save Runtime remains v6 because enemy AI state is defined by canonical battle data rather than persisted per-save state.

Pass 35 likewise adds no reopened audit item. Valor Runtime v1 consumes the already-closed Fury/Sadness/Near-Death multiplier boundary, renames the placeholder Limit terminology to Sektor 1's canonical **Valor** vocabulary, and persists actor gauge state through Save Runtime v7 with v1-v6 migration. The historical audit terminology is normalized where it names that same mechanic, without changing the original finding status.

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

After Pass 27, the 42 actionable audit headings reconcile to:

- **Fixed / superseded:** 42
- **Partial:** 0
- **Open:** 0

The audit's later "Verified Behavior and Design Context" section is reference
material, not a fix backlog, and is therefore not counted in the 42 actionable
headings.

| # | Audit finding | Current status | Current-repo reconciliation |
|---:|---|---|---|
| 1 | Essences database lacks validation | Fixed | Pass 21 adds Essence-specific progression, ability-reference, mastery, passive-shape, and canonical status-reference validation. |
| 2 | Game_Party battle-member comment disagrees with implementation | Fixed | Pass 17 corrected the comment to the canonical four-member limit. |
| 3 | SaveManager persists only the legacy leader actor | Fixed | Pass 20 Save Runtime v2 serializes/restores every actor owned by `Game_Party`. |
| 4 | Runtime battler statuses are not persisted by SaveManager | Fixed | Pass 20 persists/restores status runtime state whose canonical status is allowed to persist after battle; derived states are recomputed. |
| 5 | Magick.json defines effects that Game_Actor.useMagick() cannot execute | Fixed | Pass 23 completes the current effect vocabulary: escape is battle-owned, banish uses the shared Death/defeat bridge, and the previously completed heal/damage/status/revive effects remain on their reusable paths. |
| 6 | Magick `status` metadata has no identified runtime consumer | Fixed | Pass 14 routes Magick status payloads through the shared status runtime. |
| 7 | Status and Magick combat metadata are only partially integrated | Fixed | Pass 26 finishes Stop's `haltsTurnProgression` contract by freezing scheduled turns, personal turn progress, turn-start triggers, and ordinary battler-relative status timers while advancing Stop itself once per side round so it can expire. `Game_Battler.valorGainMultiplier()` exposes Fury/Sadness/Near-Death modifier data as the reusable boundary now consumed by post-audit Valor Runtime; gauge ownership remains outside Status Runtime. |
| 8 | `allyStatusChance` currently has no runtime consumer | Fixed | Pass 14 applies ally-specific status chances through the shared Magick/status resolver. |
| 9 | Legacy `$gameActor` dependency remains widespread | Fixed | Pass 24 removes active engine dependencies on `$gameActor`; menu/interpreter/battle fallbacks resolve actors through `Game_Party` or explicit actor context. `main.js` retains only the compatibility alias for external/legacy integrations. |
| 10 | Database accessor consistency | Fixed | Pass 26 routes all indexed database accessors through one null-safe helper and standardizes unknown-name fallbacks to include the requested ID; keyed status-name fallback likewise includes the missing key. |
| 11 | Status nested-schema validation is permissive | Fixed | Pass 21 validates the current classification/duration/condition/effect vocabularies, consumed field types/ranges, expiration references, and rejects unsupported nested keys. |
| 12 | Essence level calculation assumes ordered progression data | Fixed | Pass 21 enforces strictly increasing Essence levels and Resonance thresholds, including the canonical level-1 / zero-Resonance start. |
| 13 | Small validation duplication in duration rules | Fixed | Pass 21 consolidates turn/countdown positive-integer duration validation into one shared rule while hardening the surrounding nested schema. |
| 14 | Game_System actor ownership is individually hard-coded | Fixed | Pass 24 builds the actor collection from validated `Actors.json` records and gives that collection to `Game_Party`; individually named actor2/actor3/actor4 ownership is removed. |
| 15 | Temporary party Magick setup lives in Game_System | Fixed | Pass 24 moves current starter Magick into validated actor `initialMagickIds` data and removes the constructor-time `TEMP` learning block. |
| 16 | Game_Party.clear() clears inventory only | Fixed | Pass 24 removes the unused ambiguous `clear()` API and exposes the intent explicitly as `clearInventory()`, which leaves actor roster/battle composition untouched. |
| 17 | Save version is written but not consumed during loading | Fixed | Pass 20 introduces version-aware Save Runtime v2 plus v1 migration and future/unknown-version rejection. |
| 18 | Window_Equipment bypasses Game_Actor APIs when unequipping | Fixed | Pass 24 adds `Game_Actor.unequipWeapon()` / `unequipArmor()` and routes the equipment UI through those APIs instead of direct ID mutation. |
| 19 | Magick validation covers only target, scope, and MP cost | Fixed | Pass 21 validates current type/category/element vocabularies plus power, scopePower, gravity/heal percentages, multi-hit metadata, canonical status references, and the previously added effect/status/revival/Reflect contracts. |
| 20 | Gravity Magick percentage metadata has no identified runtime consumer | Fixed | Pass 23 resolves configured Gravity percentages from target current HP and routes the result through shared elemental / incoming magical-damage handling. |
| 21 | Multi-hit and per-hit random-target metadata have no identified runtime consumer | Fixed | Pass 23 consumes `hits` / `randomTargetPerHit` through one cast-level resolver that rebuilds legal candidates per hit and charges MP once. |
| 22 | Magick effect vocabulary exceeds the implemented runtime dispatcher | Fixed | Pass 23 adds reusable escape and banish execution, completing the current seven-value effect vocabulary. |
| 23 | Enemy `elementRates` is runtime-consumed but not specifically validated | Fixed | Pass 21 validates enemy element-rate objects and requires every configured multiplier to be a finite non-negative number. |
| 24 | Battle-sprite metadata is runtime-consumed but not specifically validated | Fixed | Pass 21 validates configured actor/enemy sprite names, positive dimensions, and positive integer frame/row counts before rendering code sees them. |
| 25 | Actor `growth` data is runtime-consumed but not specifically validated | Fixed | Pass 21 requires the complete current growth-stat contract and finite non-negative values before `Game_Actor.levelUp()` can consume it. |
| 26 | Actor initial `exp` data is runtime-consumed but not specifically validated | Fixed | Pass 21 validates initial actor EXP as a finite non-negative number at database load. |
| 27 | Battle-sprite asset failures are handled safely but silently | Fixed | Pass 25 reports actor/enemy battle-sprite load failures through explicit warnings, tracks failed paths, and renders a named outline fallback without affecting battle mechanics. |
| 28 | Save data declares a version but is not schema- or version-validated during load | Fixed | Pass 20 establishes migration, structural validation, numeric normalization, safe failure, and menu-facing failure handling. |
| 29 | Save writes do not handle storage failures | Fixed | Pass 20 catches serialization/storage failures and returns a normal failure result with diagnostic text. |
| 30 | Item gain commands do not validate quantities consistently with equipment gain commands | Fixed | Pass 22 normalizes item quantities in both interpreter commands and `Game_Party.gainItem()`, rejects invalid direct input, and preserves numeric inventory arithmetic. |
| 31 | Item runtime schema is not specifically validated at database load time | Fixed | Pass 21 validates the current item type/consumable/price contract plus the runtime-supported `healHp` effect and positive value. |
| 32 | Weapon and armor combat schemas are not specifically validated at database load time | Fixed | Pass 21 validates current weapon price/attack/accuracy/magic/critical fields and armor price/defense values as finite non-negative numbers. |
| 33 | Several selectable list windows do not support more entries than their fixed layouts | Fixed | Pass 25 adds one shared five-row viewport with automatic selection scrolling and overflow indicators to inventory, equipment-select, field Magick, battle item, and battle Magick windows. |
| 34 | The battle scene has no identified runtime entry path and hardcodes its encounter | Fixed | `SceneManager.startBattle()` / interpreter battle commands provide runtime entry and `Scene_Battle` consumes validated encounter data. |
| 35 | `addVariable` performs arithmetic without numeric normalization | Fixed | Pass 22 normalizes additive variable input at the interpreter boundary and again in `Game_Variables.addValue()`, preventing string concatenation while leaving direct `setVariable` values unrestricted. |
| 36 | Individual map data is loaded without an identified schema-validation boundary | Fixed | Pass 22 validates each loaded map before runtime construction, including identity, geometry, transfers, event pages/conditions, recursive command payloads, and current database references. |
| 37 | Magick `scopePower` metadata is consumed but not validated | Fixed | Pass 21 validates scopePower as a supported-scope multiplier map with finite non-negative values. |
| 38 | Magick `power` metadata is consumed but not validated | Fixed | Pass 21 validates configured Magick power as a finite non-negative number before the damage/healing formulas consume it. |
| 39 | Battle victories do not award experience | Fixed | Pass 11 awards defeated-enemy EXP exactly once to active battle-party members. |
| 40 | Currency rewards are not implemented | Fixed | Pass 27 adds persistent party Gil state/APIs and victory-time Gil rewards; Banished enemies contribute no Gil. |
| 41 | Battle item drops are not implemented | Fixed | Pass 27 adds validated enemy drop tables, exactly-once victory resolution, aggregation, inventory awards, and structured drop results. |
| 42 | Battle victories do not award Essence Resonance | Fixed | Pass 27 awards encounter Resonance exactly once to equipped Essences on surviving active battle participants, caps progression at Mastery Ready, reports transitions, and persists equipped Essence state in Save Runtime v3; Pass 29 subsequently migrates that state through Save Runtime v4. |

## Post-Audit Feature Note: Skills Runtime v1

Pass 36 intentionally activates the **Skills** namespace that Pass 29 reserved for future non-Magick techniques. This does not reopen the historical terminology finding: current supernatural abilities remain Magick, current non-Magick techniques use `Skills.json` / `skillIds`, and the old unqualified save field `skills` remains migration-only input for pre-Pass-29 Magick saves. The historical audit stays closed.

## Post-Audit Feature Note: Valor Arts Runtime v1

Pass 37 extends the post-audit Skills foundation rather than reopening an audit item. Valor Arts are represented by validated `valorArt: true` Skill metadata, use generic Skill-cost hooks, and delegate full-gauge readiness/payment to actor-owned Valor APIs. No new persistent state is introduced, so Save Runtime remains v8. Canonical character-specific Art content remains future design work.

## Post-Audit Feature Note: Character Valor Arts v1

Pass 38 remains post-audit feature development. It populates the already-closed Skills/Valor architecture with one starter Valor Art per current actor and widens the shared Skill effect vocabulary to percentage healing and status application only where those canonical Arts require it. Battle execution remains data-driven with no actor-name branches. Save Runtime v9 migrates v1-v8 saves so existing actors receive their newly canonical starter Arts without changing any historical audit classification.

## Post-Audit Feature Note: Skills UI Integration Cleanup v1

Pass 39 fixes post-audit UI integration defects found during hands-on Character Valor Arts testing rather than reopening a historical audit item. `BattleRenderer` now renders Skills alongside Magick and Items through one selection-window group, field Skills/Magick descriptions use shared bounded text layout, and the newer Skills windows are included in shared viewport regression coverage. No gameplay or save-state contract changes, so Save Runtime remains v9.

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

## Audit Closure Complete

All 42 actionable audit headings are now **Fixed**, **Superseded**, or otherwise closed by documented implementation. No Partial or Open audit item remains.

The historical audit remains valuable reference material, but it is no longer the primary pass-selection backlog. New Sektor 1 feature work may now be selected from `TODO.md`, `docs/roadmap.md`, and approved design priorities, while still checking the current repository before implementing overlapping work.

Valor gauge implementation was not an audit-closure dependency. Status Runtime closed the finding by exposing the canonical multiplier boundary, which Pass 35 later renamed to `valorGainMultiplier()` and consumed through actor-owned Valor Runtime.
