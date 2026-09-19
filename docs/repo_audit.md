# Corpse Engine Repository Audit

> Audit status: Static review complete; production fixes deferred  
> Project: Sektor 1 / Corpse Engine
> Terminology note: Pass 29 normalized references to the former Skills/Magic ability namespace to the current **Magick** terminology. The findings remain historical descriptions of the repository state at audit time.

## Audit Goals

- Improve architecture and separation of responsibilities.
- Find duplicate, obsolete, or conflicting code.
- Identify unsafe or inconsistent state mutation paths.
- Verify database schemas match runtime expectations.
- Check naming and coding-style consistency.
- Find dead code and unused assets.
- Compare implementation against project documentation.
- Record and verify findings before making production-code changes.

## Audit Method

Use this sequence throughout the audit:

**Observe -> Trace -> Record -> Verify -> Refactor later**

During the audit, findings are recorded before fixes are attempted. A suspicious pattern is not automatically a defect. Findings should be classified only after enough evidence has been gathered.

## Executive Summary

This static repository review identified confirmed runtime and persistence gaps,
along with validation, architecture, and maintainability improvements. The most
important risks are:

- Save data represents only the legacy leader actor and omits active battler
  statuses.
- Several Magick and status behaviors are present in data but have no complete
  runtime execution path.
- The battle scene has no identified runtime entry path and currently constructs
  a hard-coded encounter.
- Battle victory processing does not award EXP, currency, item drops, or Essence
  Resonance.
- Several database schemas are consumed at runtime without sufficiently specific
  load-time validation.

No production code was changed during this audit. Findings should be addressed
through focused implementation passes with save-migration planning and runtime
tests. This report is based on static inspection and repository-wide searches;
dynamic playtesting remains necessary before release.

**----------------------------------------------------------------------------------------**

## Findings

### Confirmed Issues

#### Essences database lacks validation

**Files:** `js/core/DatabaseManager.js`, `js/core/DatabaseValidator.js`, `data/Essences.json`

`DatabaseManager.loadDatabase()` loads `Essences.json`, but `DatabaseValidator.validate()` does not validate `database.essences`.

Unlike Actors, Enemies, Items, Weapons, Armors, Magick, and Statuses, Essences do not currently receive even generic indexed-database validation.

The Essence schema is substantial. It contains abilities, progression levels, mastery configuration, and multiple passive-effect schemas with type-specific fields. `Game_Essence` also establishes runtime contracts for progression and ability data.

Known runtime expectations include:

- Level entries provide `level` and `resonanceRequired`.
- Ability entries provide `unlockLevel` and `magickId`.
- Ability Magick IDs are expected to resolve through the Magick database.

**Deferred fix:** Design Essence-specific validation after the Essence runtime-consumer audit is complete. Validation should protect the real runtime contract rather than adding only superficial checks.

The future passive runtime will introduce additional validation requirements. When Essence validation is implemented, passive schemas should be validated against supported runtime passive types rather than treated as arbitrary objects.

#### Game_Party battle-member comment disagrees with implementation

**File:** `js/objects/Game_Party.js`

The constructor comment states that the active battle party has a maximum
of three members, while the implementation consistently permits four.

The current battle system also uses four active actors.

**Classification:** Confirmed documentation/code-comment defect.

**Deferred fix:** Update the stale comment after confirming four members is
the intended canonical battle-party limit.

#### SaveManager persists only the legacy leader actor

**Files:** `js/core/SaveManager.js`, `js/objects/Game_System.js`,
`js/objects/Game_Party.js`

The engine currently constructs and supports multiple party actors, but
SaveManager serializes and restores runtime actor state only through the
legacy `$gameActor` leader alias.

Party save data preserves inventory and `battleActorIds`, but does not
serialize the runtime state of the remaining party actors.

As a result, mutable state belonging to non-leader actors is not represented
by the current save format.

This includes potentially relevant actor state such as HP, MP, EXP, level,
equipment, and learned Magick.

Runtime status persistence is tracked separately because it introduces
additional save/load semantics beyond the broader multi-actor serialization
problem.

Review of `Game_Actor` confirms that each actor owns independently mutable
progression state including EXP, equipment IDs, and learned Magick, in
addition to mutable state inherited from `Game_Battler`.

This strengthens the requirement for future save serialization to operate
per actor rather than only through the leader alias.

**Classification:** Confirmed issue.

**Deferred fix:** Redesign actor serialization around the party/actor
collection after the complete save-state contract has been audited.

Preserve compatibility with existing version-1 saves when designing the
migration.

#### Runtime battler statuses are not persisted by SaveManager

**Files:** `js/core/SaveManager.js`, `js/objects/Game_Battler.js`

`Game_Battler` now maintains runtime status state through its `statuses`
array, including duration state such as `turnsRemaining`.

SaveManager does not serialize or restore this runtime status state.

Repository searches for `statuses:` and `.statuses` found status data and
runtime handling, but no SaveManager persistence path.

Therefore active persistent statuses would be lost when saving and loading.

**Classification:** Confirmed issue.

**Deferred fix:** Define which statuses are allowed to persist through
saving/loading and serialize only the appropriate runtime state.

Status restoration must preserve required runtime metadata such as remaining
duration without incorrectly reapplying initial status effects.

#### Magick.json defines effects that Game_Actor.useMagick() cannot execute

**Files:** `data/Magick.json`, `js/objects/Game_Actor.js`

Repository search for `Math.random` found only two runtime random rolls,
both in `BattleManager.js` for hit and critical-hit resolution.

No random roll for status application or removal probability was found.

Therefore the numeric probabilities stored in Magick `status` mappings are
currently data definitions without an identified runtime execution path.

This includes ordinary status probabilities such as Poison at `0.48` or
`0.72`, as well as specialized fields such as `allyStatusChance`.

Status probability resolution should be designed as part of the eventual
Magick/status integration rather than implemented independently in individual
Magick.

Repository inspection found multiple Magick effect types in `magick.json`,
including:

- `heal`
- `damage`
- `removeStatus`
- `inflictStatus`
- `revive`
- `escape`
- `banish`

`Game_Actor.useMagick()` currently implements explicit runtime handling only
for `heal` and `damage`.

All other effect values reach the fallback path that reports the effect as
not implemented and returns `false`.

**Classification:** Confirmed issue / incomplete runtime implementation.

The Magick database therefore currently describes behavior that the Magick
runtime cannot execute.

This overlaps with ongoing status-system development because
`inflictStatus` and `removeStatus` should eventually integrate with the
centralized status APIs rather than introduce separate status mutation
logic.

Do not implement these effects during the audit. First inventory the full
Magick-effect schema and identify the intended runtime owner for each effect.

#### Magick `status` metadata has no identified runtime consumer

**Files:** `data/Magick.json`, `js/objects/Game_Actor.js`

`magick.json` uses a `status` object to attach status behavior to Magick.

Repository searches for direct and bracket-style access patterns, including
`magick.status`, `magick["status"]`, `["status"]`, and `.status[`, found no
runtime consumer of this Magick property.

A broader `.status` search found status-database access, battler runtime
status storage, and status-window UI references, but no code that reads a
Magick's `status` metadata.

This affects more than Magick whose primary `effect` is `inflictStatus` or
`removeStatus`. Some Magick with another primary effect, such as `damage`,
also define secondary `status` metadata.

Therefore status processing cannot be modeled solely as an
`inflictStatus` branch of the current primary-effect dispatcher. The
eventual Magick runtime must account for status metadata that can accompany
other primary effects.

A complete inventory of the current `magick.json` confirms that all 54
Magick entries define exactly one top-level `effect`.

The observed effect vocabulary is:

- `damage` — 25 Magick
- `inflictStatus` — 17 Magick
- `heal` — 4 Magick
- `removeStatus` — 4 Magick
- `revive` — 2 Magick
- `escape` — 1 Magick
- `banish` — 1 Magick

This is therefore not sparse or experimental metadata. `effect` is a
consistently populated part of the current Magick schema, with seven
observed values.

`validateMagick()` does not currently validate the presence or vocabulary
of `effect`, so a missing, misspelled, or unsupported effect value could
pass database validation.

**Classification:** Confirmed issue / incomplete runtime implementation.

Do not implement a fix during the audit. First inventory the remaining
Magick metadata and determine whether primary effects and secondary effects
should be resolved through separate runtime stages.

#### Status and Magick combat metadata are only partially integrated

**Files:** `data/Magick.json`, `data/Statuses.json`, `docs/battle_system.md`

`magick.json` defines `reflectable` metadata on Magick, including both
`true` and `false` values.

`Statuses.json` also defines Reflect behavior through
`reflectableMagick: true`, and the battle-system documentation describes
Reflect as redirecting reflectable Magick.

Repository search for `reflectable` found these data and documentation
definitions but no JavaScript runtime consumer.

Therefore the engine currently has an expressed Reflect design contract
without an identified runtime path that evaluates a Magick's `reflectable`
value or performs the corresponding reflection behavior.

The Reflect status also defines a coordinated set of effect metadata:

- `reflectableMagick: true`
- `perTarget: true`
- `maxReflections: 1`

Repository searches found each of these fields only in the Reflect definition in
`Statuses.json` and existing documentation. No JavaScript runtime consumer was
identified for any of the three fields.

The metadata therefore describes an intended Reflect contract in which eligible
Magick may be reflected on a per-target basis with a bounded number of
reflections, but no identified runtime path currently consumes these status
effect fields.

This should eventually be integrated with the existing Magick `reflectable`
metadata through a centralized reflection mechanic rather than implemented as
status-ID or Magick-ID-specific behavior.

`classification.persistsAfterBattle` is defined across the status database and is
explicitly validated as a boolean by `validateStatuses()`. Repository search found
no identified JavaScript runtime consumer beyond that validation.

Repository search for `removeStatus(` likewise found no identified
battle-completion status-cleanup path. The only JavaScript occurrences are the
`Game_Battler.removeStatus()` method itself and its use by derived-status
reevaluation.

The current repository evidence therefore establishes validation of
`classification.persistsAfterBattle`, but no identified runtime process that
removes non-persistent statuses after battle while preserving persistent ones
such as Fury and Sadness.

`classification.removable` is likewise validated but has no identified runtime
consumer.

All 25 current status definitions provide the field, with Near-Death uniquely
setting `removable: false`. `DatabaseValidator` verifies that the field is a
boolean, but repository search found no JavaScript runtime read of the value
outside validation.

The existing `Game_Battler.removeStatus()` path therefore has no identified
enforcement of `classification.removable`. In particular,
`updateDerivedStatuses()` can remove Near-Death through `removeStatus()` when
its HP conditions cease to match despite Near-Death declaring
`removable: false`.

The current repository evidence does not establish whether `removable` is
intended to restrict manual/status-cleansing removal while permitting automatic
derived-status removal, so that distinction should not be assumed without an
explicit runtime contract.

`classification.negative` is also validated but has no identified behavioral
runtime consumer.

All 25 current status definitions provide the field, with both `true` and
`false` values representing the data model's distinction between negative and
non-negative statuses. `DatabaseValidator` verifies that
`classification.negative` is a boolean.

A broader repository search found no identified JavaScript runtime consumer
outside validation. References elsewhere describe positive and negative
statuses in documentation, but no identified runtime path currently uses the
classification to control status application, removal, targeting, cleansing,
or other battle behavior.

The field therefore currently forms part of the validated status data contract
without an identified behavioral integration.

`classification.family` is likewise validated and documented but has no
identified behavioral runtime consumer.

All 25 current status definitions provide a classification family, representing
categories such as damage-over-time, healing-over-time, defensive, time,
control, mental, defeat, sensory, transformation, countdown, and critical
status concepts.

`DatabaseValidator` requires `classification.family` to be a non-empty string.
A broader repository search found no identified JavaScript runtime consumer of
status family classification outside validation.

Repository documentation discusses status-family concepts, and `Essences.json`
also contains separate family-related metadata, but those data and
documentation references do not by themselves establish runtime status-family
behavior.

The field therefore currently forms part of the validated status data contract
without an identified behavioral integration.

Inspection of the current victory/defeat path in `Scene_Battle.update()` also found
no post-battle status cleanup. Once `this.victory` or `this.defeat` is set, the
scene waits for confirmation input and then calls `SceneManager.pop()`.

This is consistent with `battle_system.md`, which describes post-battle status
cleanup as future victory processing. `persistsAfterBattle` therefore currently
forms part of the validated status data contract, but its intended persistence
behavior has no identified runtime integration.

The status effect field `countsAsDefeated` is currently defined by two statuses:
Petrify and Death. Both set `countsAsDefeated: true`, indicating that the data
model distinguishes the broader concept of being defeated from Death-specific
behavior.

Death separately defines effects such as `setsHpToZero` and `canBeRevived`,
while Petrify does not. This allows multiple status states to represent defeat
without requiring them to share all Death mechanics.

Status effect metadata is only partially connected to runtime behavior.

`DatabaseValidator` validates the status `effects` container generically,
requiring it to exist as an object rather than an array. The identified
validator does not establish a field-by-field contract for the individual
effect properties stored inside that object.

Runtime support is instead selective: identified `Game_Battler` paths consume
particular effect fields such as `setsHpToZero`, `trigger`, `hpDamagePercent`,
`canKill`, and `onExpire`, while numerous other effect fields remain without
identified JavaScript consumers.

The existence and structural validity of a status `effects` object therefore
does not establish that every effect property contained within it is
implemented.

For example, `physicalDamageTakenMultiplier` is defined by Barrier, Sadness,
Small, and Shield, with values of `0.5`, `0.7`, `0.5`, and `0.0` respectively.
Repository search found this field only in `Statuses.json`, with no identified
JavaScript runtime consumer.

This is distinct from fields such as `setsHpToZero`, which have an identified
runtime consumer in `Game_Battler`. The presence of an effect field in
`Statuses.json` therefore does not by itself establish that the corresponding
behavior is implemented.

Status duration and expiration metadata have an identified generic runtime
execution path.

For statuses with a numeric duration, `Game_Battler` initializes
`turnsRemaining` from `definition.duration.turns`. Runtime status progression
decrements this counter and handles the status when it reaches zero.

Statuses with `duration.type === "turns"` are removed when their counter
expires. Statuses with `duration.type === "countdown"` instead call
`resolveStatusExpiration()` before removal.

Death-Sentence and Slow-Numb define `effects.onExpire.applyStatus`, with values
of `death` and `petrify` respectively. `resolveStatusExpiration()` reads this
metadata and passes the configured status key to `addStatus()`.

The duration lifecycle is also connected to battle orchestration.
`BattleManager.endPartyTurn()` calls `battler.tickStatusDurations()` for the
party's active battler.

Status duration progression therefore occurs at the end of that battler's
party turn. `tickStatusDurations()` decrements valid `turnsRemaining` counters.
When a counter reaches zero, statuses with `duration.type === "turns"` are
removed directly, while statuses with `duration.type === "countdown"` first
execute `resolveStatusExpiration()` and are then removed.

This establishes an end-to-end, data-driven runtime path from status duration
metadata through countdown expiration and subsequent status application,
without status-ID-specific handling.

Death-Sentence and Slow-Numb define `effects.onExpire.applyStatus`, with values
of `death` and `petrify` respectively. `Game_Battler` reads
`definition.effects?.onExpire` and, when `applyStatus` is present, passes that
status key to `addStatus()`.

Unlike several other fields currently present only in `Statuses.json`, this
metadata is therefore connected to a generic runtime execution path rather than
being handled through status-specific IDs.

Triggered status metadata also shows partial runtime coverage.

Poison and Dual have an identified end-to-end generic runtime path for their
triggered percentage-damage metadata.

Both statuses define `trigger: "turnStart"` and provide `hpDamagePercent`
values of `0.03` and `0.06` respectively, with `canKill: true`.

`Game_Battler.processStatusTrigger(trigger)` iterates the battler's runtime
statuses, resolves each status definition by key, and processes only definitions
whose `effects.trigger` matches the supplied trigger. Matching definitions are
passed to `applyTriggeredStatusEffects()`.

`applyTriggeredStatusEffects()` calculates damage as
`Math.floor(maxHp * hpDamagePercent)`. It sets the minimum permitted HP to `0`
when `canKill === true` and to `1` otherwise, then applies the result through
`setHp()`.

Because `setHp()` also calls `updateDerivedStatuses()`, triggered status damage
passes through the same derived-status reevaluation path used by HP-dependent
statuses.

The trigger path is also connected to the battle lifecycle. `BattleManager`
calls `battler.processStatusTrigger(BattleManager.TURN_START)` when beginning
the active battler's party turn. Immediately afterward, it checks
`battler.isDead()` and prevents the turn from continuing if triggered status
processing reduced the battler to a defeated state.

This connects `trigger: "turnStart"` status metadata to actual battle-turn
orchestration rather than leaving the trigger processor as an isolated battler
utility.

This establishes `trigger`, `hpDamagePercent`, and `canKill` as functional parts
of a generic triggered-status damage contract rather than Poison- or Dual-
specific runtime handling.

`Game_Battler` has an identified generic runtime path that reads
`definition.effects.hpDamagePercent` when processing triggered status effects.
The same runtime machinery therefore supports both status definitions without
status-ID-specific handling.

The shared `canKill: true` metadata is also consumed by this runtime path.
`Game_Battler.applyTriggeredStatusEffects()` calculates percentage damage from
`maxHp * definition.effects.hpDamagePercent`, rounded down with `Math.floor()`.

The method sets `minimumHp` to `0` when `canKill === true` and to `1`
otherwise, then clamps the resulting HP against that minimum before passing it
through `setHp()`.

This establishes both `hpDamagePercent` and `canKill` as functional parts of
the generic triggered-status damage contract. Poison and Dual can therefore
reduce a battler to 0 HP through this path, while triggered damage without
`canKill: true` would leave at least 1 HP.

This establishes `canKill` as part of the generic triggered-damage contract
rather than merely descriptive metadata on Poison and Dual.

Regen defines `hpHealPercent: 0.03` with `trigger: "turnStart"`.

Its trigger metadata is partially connected to the generic status-trigger
runtime. `BattleManager` invokes `processStatusTrigger(BattleManager.TURN_START)`,
and `Game_Battler.processStatusTrigger()` selects active status definitions whose
`effects.trigger` matches that trigger, meaning Regen can reach
`applyTriggeredStatusEffects()` through the same dispatch path as Poison and
Dual.

However, repository search found `hpHealPercent` only in Regen's definition in
`Statuses.json`, and the identified `applyTriggeredStatusEffects()` implementation
handles `hpDamagePercent` but has no corresponding `hpHealPercent` branch.

Regen therefore has an identified runtime path through trigger dispatch, but no
identified runtime implementation for its configured healing effect.

The `valorGainMultiplier` field is defined by Fury, Sadness, and Near-Death,
with values of `2.0`, `0.5`, and `2.0` respectively. Repository search found
all three occurrences only in `Statuses.json`, with no identified JavaScript
runtime consumer.

Near-Death's derived activation conditions are separately connected to runtime
behavior.

Near-Death uses `duration.type: "derived"` with `hpPercentAbove: 0` and
`hpPercentAtOrBelow: 0.25`. `Game_Battler.updateDerivedStatuses()` generically
discovers derived statuses, evaluates these HP conditions using `hpRate()`, and
adds or removes the corresponding status as the conditions begin or cease to
match.

`Game_Battler.setHp()` calls `updateDerivedStatuses()` immediately after
clamping and assigning HP. This establishes an end-to-end runtime path from HP
changes through derived-condition evaluation to automatic Near-Death status
activation and removal.

This is distinct from Near-Death's `valorGainMultiplier: 2.0`, for which no
JavaScript runtime consumer has been identified.

The `turnSpeedMultiplier` field is defined by Haste and Slow, with values of
`2.0` and `0.5` respectively. Repository search found both occurrences only in
`Statuses.json`, with no identified JavaScript runtime consumer.

The `physicalDamageMultiplier` field is defined by Berserk, Frog, and Small,
with values of `1.5`, `0.1`, and `0.1` respectively. Repository search found
all three occurrences only in `Statuses.json`, with no identified JavaScript
runtime consumer.

The `physicalAccuracyMultiplier` field is defined by Fury and Darkness, with
values of `0.7` and `0.5` respectively. Repository search found both
occurrences only in `Statuses.json`, with no identified JavaScript runtime
consumer.

The `blockedActionTypes` field is defined only by Silence, with the value
`["magick"]`. Repository search found this field only in `Statuses.json`, with
no identified JavaScript runtime consumer. The current repository evidence
therefore does not establish runtime enforcement of this status metadata.

The `removeOnPhysicalDamage` field is defined by Sleep and Confuse, with both
definitions setting it to `true`. Repository search found both occurrences only
in `Statuses.json`, with no identified JavaScript runtime consumer. The current
repository evidence therefore does not establish runtime behavior associated
with this metadata.

Confuse additionally defines `forceRandomTarget: true`. Repository search found
this field only in the Confuse definition in `Statuses.json`, with no identified
JavaScript runtime consumer. The current repository evidence therefore does not
establish runtime random-target behavior associated with this status metadata.

Berserk defines `playerControl: false` and `forcePhysicalAttack: true`.
Repository searches found each field only in the Berserk definition in
`Statuses.json`, with no identified JavaScript runtime consumer.

Frog defines `allowedActions: ["attack"]`. Repository search found this field
in `Statuses.json` and battle-system documentation, but no JavaScript runtime
consumer was identified.

Shield additionally defines `absorbElementalMagic: true`. Repository search
found this field only in the Shield definition in `Statuses.json`, with no
identified JavaScript runtime consumer.

Together with Shield's `physicalDamageTakenMultiplier: 0.0`, the field is
present in the status data, but the current repository evidence does not
establish runtime behavior associated with it.

The field therefore has supporting documentation in addition to its data
definition, while its runtime integration remains unidentified.

Together with Berserk's `physicalDamageMultiplier`, these fields are present in
the status data, but the current repository evidence does not establish runtime
behavior associated with them.

These findings further demonstrate that the presence of metadata within a status
`effects` object does not by itself establish corresponding runtime behavior.

The corresponding `magicalDamageTakenMultiplier` field is defined by MBarrier
and Sadness, with values of `0.5` and `0.7` respectively. Repository search
likewise found this field only in `Statuses.json`, with no identified JavaScript
runtime consumer.

Repository search found no JavaScript runtime consumer for `countsAsDefeated`.

`Game_Battler.isDead()`, which is widely consumed by battle management,
targeting, animation, rendering, and party-control paths, defines death solely
as `hp <= 0`. It does not inspect `countsAsDefeated` or other status metadata.

Death has an identified end-to-end bridge into the HP-based defeat model.
When a status is added, `Game_Battler.addStatus()` stores the runtime status and
calls `applyStatusEffects(statusKey)`. For Death,
`applyStatusEffects()` consumes `setsHpToZero: true` and calls `setHp(0)`.

Death also defines `canBeRevived: true`, but repository search found this field
only in the Death definition in `Statuses.json` and existing audit
documentation, with no identified JavaScript runtime consumer.

Death therefore provides another example of partial status-effect integration:
its `setsHpToZero` effect is connected to runtime behavior, while
`canBeRevived` is present in the data without an identified runtime connection.

`setHp()` clamps and assigns the new HP value and then calls
`updateDerivedStatuses()`. Subsequent calls to `isDead()` therefore return
`true` because the battler's HP is zero.

Because the HP change passes through `setHp()`, derived statuses are also
reevaluated. Near-Death, whose conditions require HP to remain above zero, no
longer matches at 0 HP and is removed by the generic derived-status path.

Petrify also defines `countsAsDefeated: true`, but no equivalent HP-zero effect
or runtime consumer of `countsAsDefeated` has been identified. The current
repository evidence therefore does not establish Petrify as defeated for
battle paths that rely on `isDead()`.

Additional status effect metadata includes `canAct: false` on five status
definitions: Stop, Paralyze, Sleep, Petrify, and Death.

Repository search found no JavaScript consumer of the status `effects.canAct`
field. Matches for `canAct` in `BattleManager.js` and `Scene_Battle.js` are
unrelated local variables rather than reads of status metadata.

Stop additionally defines `haltsTurnProgression: true`. Repository search found
this field only in the Stop definition in `Statuses.json` and existing audit
documentation, with no identified JavaScript runtime consumer.

This is consistent with the separate `canAct: false` finding. The identified
party-turn lifecycle in `BattleManager` processes turn-start status triggers,
checks `isDead()`, and advances status durations at the end of the active
battler's turn, but no identified path consults either Stop field to prevent
that battler from acting or progressing through its turn.

The current repository evidence therefore establishes Stop's duration lifecycle,
but not the action-prevention or turn-progression behavior described by these
status effect fields.

The `canAct` and `haltsTurnProgression` fields are therefore present in the
status data, but the current repository evidence does not establish them as
runtime mechanics. Their intended role should be confirmed before implementing
or validating behavior around them.

**Classification:** Confirmed issue / incomplete runtime implementation.

Do not implement these mechanics piecemeal during the audit. Their eventual
implementation should use centralized status, targeting, and effect-resolution
paths rather than status-ID- or Magick-ID-specific behavior.

#### `allyStatusChance` currently has no runtime consumer

**File:** `data/Magick.json`

Some Magick entries define `allyStatusChance` separately from their normal status
probability. Repository search found three data definitions but no JavaScript
runtime references to `allyStatusChance`.

For example, Diminish defines `"small": 0.72` together with
`allyStatusChance: 1.0`, matching its intended 72% enemy / 100% ally behavior.

Because no runtime consumer was found, the ally-specific probability may
currently be ignored when the Magick is executed.

**Classification:** Confirmed issue.

Determine where status application probability is resolved before implementing
a fix. Do not change the Magick data yet.

**----------------------------------------------------------------------------------------**

### Possible Improvements

#### Legacy `$gameActor` dependency remains widespread

**Files observed:** `js/main.js`, `js/core/SaveManager.js`, `js/objects/Game_Interpreter.js`, `js/objects/Game_Party.js`, `js/windows/Window_BattleMagick.js`, `js/windows/Window_Equipment.js`, `js/windows/Window_EquipSelect.js`, `js/windows/Window_Inventory.js`, `js/windows/Window_Magick.js`, `js/windows/Window_Status.js`

`main.js` describes `$gameActor` as a backward-compatible leader alias, but a repository search found substantial active usage across saving/loading, menus, equipment, Magick, inventory, interpreter logic, and battle UI.

`SaveManager.js` contains particularly heavy `$gameActor` usage.

Examples worth later investigation include:

- `Game_Party.useItem(itemId, target = $gameActor)`
- Battle Magick code that can fall back from the current battler to `$gameActor`

`Game_Party.useItem()` defaults its target to the global `$gameActor`
compatibility alias even though Game_Party already owns the roster and
provides `leader()`.

Determine whether leader-default item use is intentional and, if so,
whether the default should eventually be resolved through party ownership
rather than the legacy global alias.

SaveManager confirms that the legacy alias is not merely used for UI
convenience. The current version-1 save format is structurally centered
on `$gameActor` and persists only that actor's runtime state.

The missing persistence of additional party actors has therefore been
promoted to a separate Confirmed Issue. The broader question of removing
or reducing `$gameActor` dependencies remains open.

`Game_Interpreter.commandGainExp()` and `commandGainExpMessage()` award EXP
directly through `$gameActor`.

The interpreter methods consume only the EXP amount and contain no
party-aware or actor-target selection logic.

This appears consistent with legacy single-actor event-command behavior,
but may no longer match the engine's multi-actor party architecture.

Determine the intended EXP distribution model before changing this:
leader only, selected actor, active battle party, or full party roster.

`Window_Equipment` performs weapon and armor equipment changes through the
legacy `$gameActor` alias.

The mutation APIs themselves are correctly centralized in `Game_Actor`;
the remaining audit question is whether the equipment UI should continue
to operate specifically on the party leader or eventually receive an
explicit actor context.

**Audit question:** Determine whether these systems intentionally operate only on the party leader or whether they retain assumptions from the engine's earlier single-actor architecture.

**Do not refactor yet:** Save-data compatibility and ownership boundaries should be understood first.

#### Database accessor consistency

**File:** `js/core/DatabaseManager.js`

Database accessors follow the same general ID-to-record pattern, but implementation and fallback behavior vary slightly.

Examples:

- Some collections use optional chaining, such as `enemies?.[id]`, while others assume the collection exists, such as `actors[actorId]`.
- Some unknown-name fallbacks include the requested ID, while others return only a generic `"Unknown X"` string.

**Audit question:** Determine whether these differences are intentional before standardizing them.

#### Status nested-schema validation is permissive

**File:** `js/core/DatabaseValidator.js`

Known derived HP conditions are range-validated, but unknown condition properties are not rejected. Status effects are currently validated primarily as an object rather than through a complete per-effect schema.

This may allow misspelled or unsupported condition/effect properties to pass database validation and then be silently ignored by runtime code.

**Audit question:** Audit `Statuses.json` and all status runtime consumers before deciding whether nested schemas should reject unsupported properties.

#### Essence level calculation assumes ordered progression data

**File:** `js/objects/Game_Essence.js`

`level()` iterates Essence level entries in database order and assigns each qualifying level to `currentLevel`.

The current Essence data is ordered as progression data, but the runtime does not independently enforce that ordering. Malformed or out-of-order level data could therefore produce an incorrect calculated level.

**Audit question:** Prefer considering validator enforcement of monotonically increasing progression data rather than making runtime code compensate for malformed database content.

#### Small validation duplication in duration rules

**File:** `js/core/DatabaseValidator.js`

Status duration validation for `"turns"` and `"countdown"` performs the same positive-integer `turns` check in separate blocks.

This is readable and not currently a defect. It may be worth consolidating only if validator helper patterns emerge elsewhere during the audit.

#### Game_System actor ownership is individually hard-coded

**File:** `js/objects/Game_System.js`

`Game_System` constructs four actors through individually named properties
(`actor`, `actor2`, `actor3`, `actor4`) and then passes those instances
into `Game_Party`.

This may reflect the engine's earlier single-actor architecture and later
party expansion.

**Classification:** Possible improvement.

Audit Game_Party and SaveManager before determining whether actor ownership
should remain individually exposed or move toward a collection-based model.
Do not change this structure until save/load compatibility is understood.

#### Temporary party Magick setup lives in Game_System

**File:** `js/objects/Game_System.js`

`Game_System` currently teaches Magick 1 and 10 directly to actors 2, 3,
and 4 during construction. The block is explicitly marked `TEMP`.

This mixes temporary development/test party configuration with construction
of the persistent game-state root.

Repository search for `learnMagick(` confirms that all current external
Magick-learning calls originate from this temporary Game_System setup.

No separate production Magick-acquisition caller was identified during
this search.

**Classification:** Possible improvement.

Determine where development/test party configuration should eventually live
so `Game_System` can construct canonical game state without embedding
temporary test behavior.

#### Game_Party.clear() clears inventory only

**File:** `js/objects/Game_Party.js`

`clear()` resets items, weapons, and armors but does not clear the actor
roster or active battle-party composition.

This may be intentional, but the generic method name does not communicate
that the operation is inventory-specific.

Repository searches for `$gameParty.clear` and `.party.clear` returned no
call sites. A broader `.clear()` search found only unrelated clear methods.

Therefore `Game_Party.clear()` currently appears to have no active runtime
consumer.

Before changing or removing it, perform a later dead-code audit that also
checks indirect/dynamic access patterns.

Its inventory-only behavior remains noteworthy because the generic method
name does not describe that limited responsibility.

**Classification:** Possible improvement.

#### Save version is written but not consumed during loading

**File:** `js/core/SaveManager.js`

SaveManager writes:

`version: 1`

into save data, but repository search found no code that reads or evaluates
the saved version.

The current loader therefore does not use the version field to validate,
migrate, or reject incompatible save formats.

**Classification:** Possible improvement.

This is not necessarily a defect while only one save schema exists, but it
will become important when the save format changes.

The planned multi-actor and runtime-status persistence work will likely
require a new save schema. Before that change, define explicit version-aware
loading and migration behavior so existing version-1 saves can be handled
deliberately.

#### Window_Equipment bypasses Game_Actor APIs when unequipping

**Files:** `js/windows/Window_Equipment.js`,
`js/objects/Game_Actor.js`

Weapon and armor equipment changes normally delegate through
`Game_Actor.equipWeapon()` and `Game_Actor.equipArmor()`.

Repository searches for `weaponId =` and `armorId =` found that
`Window_Equipment` directly assigns:

`$gameActor.weaponId = 0`

and:

`$gameActor.armorId = 0`

when unequipping.

This creates inconsistent ownership of equipment mutation: equipping is
performed through `Game_Actor` methods, while unequipping directly modifies
the actor's equipment IDs.

SaveManager also assigns these fields directly during state restoration,
but that is a separate serialization/restoration responsibility.

**Classification:** Possible improvement.

Inspection of `Game_Actor.equipWeapon()` and `equipArmor()` confirms that
neither method currently supports equipment ID `0`. Both require a valid
database record before changing the actor's equipment ID.

Therefore `Window_Equipment` currently has no Game_Actor API available for
representing an unequip operation and directly assigns `0` instead.

During the later cleanup phase, determine whether Game_Actor should expose
explicit unequip methods or whether its existing equipment methods should
deliberately support equipment ID `0` as the unequipped state.

Keep equipment-state mutation centralized in Game_Actor where practical.

#### Magick validation covers only target, scope, and MP cost

**File:** `js/core/DatabaseValidator.js`

`validateMagick()` currently validates:

- Magick target values
- Magick scope values
- non-negative numeric MP cost

It does not currently validate other major portions of the Magick schema,
including `effect`, `status`, `allyStatusChance`, `power`, `type`,
`category`, `element`, or `reflectable`.

This is particularly relevant to status-related Magick. `magick.json`
contains `inflictStatus` and `removeStatus` effects whose `status` objects
map status keys to probability values, but `validateMagick()` does not
validate those effect names, status keys, or probability ranges.

As a result, misspelled or unsupported effect names, unknown status keys,
and malformed status probabilities may pass database validation and only
be discovered later through runtime behavior.

Current `magick.json` target data uses `ally` and `enemy`, either
individually or together.

`DatabaseValidator.validateMagick()` also permits `self`, but repository
inspection found no current Magick whose `target` data uses `self`.

Runtime code does recognize `self` as a valid targeting concept, so this
appears to be supported engine vocabulary that is simply unused by the
current Magick database.

No unsupported target value was identified during this audit.

Current `magick.json` scope data uses the validator-supported `single` and
`all` vocabulary.

Magick entries may support one scope or multiple scopes depending on their design.
No unsupported scope value was identified during this audit.

The currently observed target and scope data therefore agrees with the
vocabulary enforced by `validateMagick()`.

Current `magick.json` category data uses exactly four observed values:

- `attack`
- `restore`
- `indirect`
- `advanced`

All 54 current Magick records define a `category`, but `validateMagick()` does not currently validate that field.

All 54 current Magick records also use `"type": "magick"`. Runtime consumers such as `Window_BattleMagick` and `Window_Magick` explicitly test `magick.type === "magick"`, while `validateMagick()` does not currently validate `type`.

The current data is internally consistent, but unsupported or misspelled `category` and `type` values could therefore pass database validation and later produce incorrect runtime or UI behavior.

All 54 current Magick records also define an `element`.

The observed Magick-element vocabulary is:

- `none`
- `restorative`
- `fire`
- `ice`
- `lightning`
- `earth`
- `poison`
- `gravity`
- `wind`

Unlike purely descriptive metadata, `element` is actively consumed by runtime
combat code. Repository search found `magick.element` usage in both
`BattleManager.js` and `Game_Actor.js`, including calls to
`elementRate(magick.element)`.

No corresponding `magick.element` validation was found in
`DatabaseValidator.validateMagick()`.

Therefore, an absent, misspelled, or unsupported Magick element could pass
database validation even though runtime combat calculations depend on that
value.

#### Gravity Magick percentage metadata has no identified runtime consumer

`magick.json` defines three Gravity-style Magick using `gravityPercent` values of
`0.25`, `0.5`, and `0.75`.

Repository searches for both `gravityPercent` and the broader term `gravity`
found no JavaScript runtime consumer for this metadata. The remaining matches
are confined to Magick and Essence data or documentation.

The Magick descriptions define these abilities as dealing damage equal to a
percentage of the target's current HP, but no identified runtime path currently
reads `gravityPercent` to perform that calculation.

Therefore, the Gravity Magick definitions currently describe intended behavior
that is not yet connected to an identified battle execution path.

This should be implemented as part of the eventual Magick-effect runtime rather
than by hard-coding the three individual Gravity Magick.

#### Multi-hit and per-hit random-target metadata have no identified runtime consumer

`magick.json` defines Meteor Barrage (ID 47) with:

- `hits: 4`
- `randomTargetPerHit: true`

The Magick description specifies four attacks against random enemies, indicating
that these fields describe a coordinated multi-hit targeting mechanic.

Repository searches found no JavaScript runtime consumer for `hits` or
`randomTargetPerHit`. A specific search for `magick.hits` also returned no
results.

Therefore, the current Magick data describes repeated attacks with independent
per-hit target selection, but no identified runtime execution path currently
consumes the metadata required to perform that behavior.

This mechanic should eventually be implemented generically through Magick data
rather than as a Meteor Barrage or Magick-ID-specific special case.

#### Magick effect vocabulary exceeds the implemented runtime dispatcher

Current `magick.json` data uses seven observed `effect` values:

- `heal`
- `damage`
- `inflictStatus`
- `removeStatus`
- `revive`
- `escape`
- `banish`

`Game_Actor.useMagick()` confirms this limitation explicitly. After validating the
Magick and target, the method contains dedicated execution branches for `heal`
and `damage`. If neither branch matches, it logs that the Magick's effect is
"not implemented yet" and returns `false`.

The missing effect handling is therefore not inferred solely from the absence
of repository search results. The current generic actor Magick-execution path
explicitly treats effect values outside its implemented branches as unsupported.

MP-cost payment is also performed inside the implemented `heal` and `damage`
branches. Future effect integration therefore needs to preserve coherent cost,
target-validation, and execution behavior rather than merely adding isolated
effect-specific calls.

The inspected multi-target battle path delegates actual Magick execution to
`caster.useMagick(...)`. `BattleManager` records the target's HP before that
call and, after successful execution, performs battle-layer follow-up such as
damage measurement, elemental feedback, battle popups, and hurt/defeat state
updates.

This indicates a division of responsibility rather than a separate
`BattleManager` implementation of the damage effect: `Game_Actor.useMagick()`
performs the identified HP-changing effect execution, while `BattleManager`
reacts to the result in battle context.

Because `BattleManager` continues to the next target when `useMagick()` returns
`false`, unsupported effect values rejected by `Game_Actor.useMagick()` also do
not reach this successful post-effect path.

The inspected single-target Magick path follows the same execution boundary.
`BattleManager` records the target's HP, calls `caster.useMagick(...)`, and
immediately clears the pending Magick state and returns when that call fails.

Successful single-target damage handling then measures the HP change produced
by `useMagick()` and performs battle-context follow-up such as elemental
feedback, battle messages, and hurt/defeat state changes.

Unsupported Magick effects are therefore rejected at the shared
`Game_Actor.useMagick()` boundary before successful post-effect processing in
both the inspected single-target and multi-target Magick paths.

The inspected `BattleManager.executeMagick()` setup is more permissive than the
eventual effect executor. It validates that the selected Magick exists, that the
actor can use it, and that the target manager provides supported target groups
and scopes before storing the Magick as `pendingMagick`.

Target-group selection is driven by the allowed target metadata rather than by
`magick.effect`; the implementation explicitly notes that its initial targeting
choice should not depend on the effect value.

An effect value unsupported by `Game_Actor.useMagick()` can therefore progress
through Magick selection and target setup when its other metadata is valid. The
identified rejection occurs later at the shared Magick-execution boundary rather
than during initial Magick selection.

The normal battle action-phase lifecycle also reaches this execution boundary.
During the `"magickCast"` action phase, `BattleManager.updateActionPhase()` calls
the scene-facing `battle.performMagickEffect()` method. `Scene_Battle` delegates
that call to `BattleManager.performMagickEffect()`, which ultimately invokes
`caster.useMagick(...)`.

Afterward, the action sequence progresses through `"magickEffect"`,
`"magickRecover"`, and `"magickWait"`, with the final phase performing normal
victory/defeat and party-turn progression.

This establishes that the identified `Game_Actor.useMagick()` effect limitation
lies on the normal player-Magick battle execution path rather than only in an
isolated or unconfirmed helper.

The inspected enemy-turn path is separate from this player Magick-execution
pipeline. `BattleManager.performEnemyTurn()` currently selects the first living
party member, calculates a direct physical attack from `enemy.totalAttack()` and
`target.totalDefense()`, applies the defending reduction when applicable, and
calls `target.loseHp(damage)`.

The class hierarchy intentionally separates shared and actor/enemy-specific
responsibilities. `Game_Battler` documents itself as the shared combat
foundation, with actor-specific equipment, Magick, and EXP remaining in
`Game_Actor`, while enemy-specific sprite/database behavior remains in
`Game_Enemy`.

The current `Game_Enemy` implementation extends `Game_Battler` and adds enemy
database identity and battle-sprite metadata, but no enemy Magick collection,
Magick-selection logic, AI/action-selection logic, or Magick-effect executor was
identified there.

The inspected enemy-turn implementation therefore currently establishes a
direct basic physical-attack path rather than an enemy equivalent of the player
Magick execution pipeline. This does not by itself establish that enemies
should reuse `Game_Actor.useMagick()`; the repository architecture explicitly
separates actor-specific and enemy-specific behavior.

The current `Enemies.json` data also contains no identified enemy Magick,
action-selection, or AI-behavior metadata. The inspected Test Slime definition
provides identity, elemental-rate, battle-sprite, and combat-stat data, but no
`Magick`, action list, spell list, or equivalent behavior configuration.

This is consistent with the currently identified `Game_Enemy` and
`BattleManager.performEnemyTurn()` implementations: the enemy data supplies
combatant statistics and presentation metadata, while the inspected runtime
enemy-turn path performs a direct basic physical attack.

The current repository evidence therefore does not establish an enemy
Magick-effect pipeline equivalent to the actor Magick system. This should be
treated as a description of the current implementation rather than evidence
that enemies are intended to reuse actor-specific Magick behavior.

Enemy elemental-rate data has an identified end-to-end runtime path.

`Enemies.json` defines `elementRates`, and `Game_Enemy` passes the enemy
definition into the shared `Game_Battler` constructor. `Game_Battler` stores
the configured elemental rates and exposes them through
`elementRate(element)`.

`elementRate()` returns `1` when no element is supplied or when the configured
rate is not a finite number, and clamps valid configured rates to a minimum of
`0`.

Player Magick consumes this data during actual damage calculation.
`Game_Actor.magickDamage()` resolves the target's elemental multiplier through
`target.elementRate(magick.element)` and calculates final damage from
`rawDamage * elementMultiplier * scopeMultiplier`, rounded down with
`Math.floor()` and clamped to a minimum of zero.

`BattleManager` separately queries the same elemental rate after Magick
execution for battle feedback. A rate of `0` produces immune feedback, a rate
greater than `1` produces weak feedback, and a rate below `1` produces resist
feedback.

Elemental-rate metadata is therefore connected both to actual Magick damage and
to the corresponding battle feedback rather than existing only as descriptive
enemy data.

#### Enemy `elementRates` is runtime-consumed but not specifically validated

`Enemies.json` participates in the generic indexed-database validation path
through `validateIndexedDatabase("Enemies", database.enemies, errors)`.

However, `validateIndexedDatabase()` validates only generic database structure:
the database must be an array, each present record's `id` must match its array
index, and each record must provide a string `name`.

No identified validation inspects the enemy-specific `elementRates` field or
its individual multiplier values.

This differs from the runtime behavior, where `Game_Battler.elementRate()`
actively consumes the data. Missing or non-finite rates fall back to `1`, while
valid values are clamped to a minimum of `0`.

The runtime therefore handles malformed elemental-rate data defensively, but
the database validator does not identify those malformed values at load time.

**Classification:** Confirmed validation gap.

The inspected enemy-turn path is separate from this player Magick-execution
pipeline...

#### Battle-sprite metadata is runtime-consumed but not specifically validated

Actor and enemy battle data define `battleSpriteWidth`,
`battleSpriteHeight`, `battleSpriteFrames`, and `battleSpriteRows`.

These fields have identified runtime consumers. `Game_Actor` and `Game_Enemy`
read the configured values and provide defaults when they are absent.
`BattleRenderer` uses width and height as the destination dimensions when
drawing battler sprites, while `battleSpriteFrames` and `battleSpriteRows`
determine how the source sprite sheet is divided into animation cells.

`battleSpriteHeight` is also consumed by `BattleEffects` when positioning
visual effects relative to battlers.

Both `Actors.json` and `Enemies.json` participate in generic indexed-database
validation, but repository search found no identified field-specific validation
for `battleSpriteWidth`, `battleSpriteHeight`, `battleSpriteFrames`, or
`battleSpriteRows`.

The constructors provide fallback values when these fields are absent, but
malformed configured values are not identified by the current database
validator before reaching rendering code.

**Classification:** Confirmed validation gap.

#### Actor `growth` data is runtime-consumed but not specifically validated

`Actors.json` defines a `growth` object for actor stat progression, and
`Game_Actor` stores that object directly as `this.growth`.

`Game_Actor.levelUp()` actively consumes the configured growth values when
increasing Max HP, Max MP, Strength, Vitality, Dexterity, Agility, Magic,
Spirit, Luck, Attack, Defense, Magic Attack, and Magic Defense.

The actor database participates in the generic indexed-database validation
path, but repository search found no identified field-specific validation for
the `growth` object or its individual stat-growth values.

Unlike some other runtime data accessors, the identified level-up path does not
provide fallback values when reading growth properties. A missing `growth`
object could therefore cause property access to fail during level-up, while a
missing or invalid individual growth value could propagate an invalid numeric
result into actor statistics.

The actor growth configuration is therefore functionally connected to runtime
level progression but lacks an identified load-time schema check for the
structure and numeric values that `levelUp()` expects.

**Classification:** Confirmed validation gap.

#### Actor initial `exp` data is runtime-consumed but not specifically validated

`Actors.json` provides the actor's initial EXP value, and `Game_Actor` assigns
that value directly through `this.exp = actorData.exp`.

The progression runtime actively consumes `this.exp`.
`Game_Actor.checkLevelUp()` compares it against `expForNextLevel()`, subtracts
the required EXP when a threshold is reached, and invokes `levelUp()`.

Incoming EXP awards are separately protected at runtime:
`gainExp(amount)` converts the supplied amount to a number and rejects
non-finite or non-positive values before adding them to `this.exp`.

However, no identified field-specific database validation checks the initial
actor `exp` value loaded from `Actors.json`. The actor database receives generic
indexed-database validation, but that validation only establishes database
structure, record IDs, and names.

The runtime therefore validates later EXP gains while relying on the initial
actor EXP value to already satisfy the numeric contract expected by the
level-progression system.

**Classification:** Confirmed validation gap.

#### Battle-sprite asset failures are handled safely but silently

Actor `sideBattleSprite` and enemy `battleSprite` values are consumed by
`Scene_Battle.loadBattleSprites()`. Missing sprite values are intentionally
skipped, while configured values are used directly to construct actor or enemy
sprite image paths.

`BattleRenderer` only draws a loaded battler image when the image is complete
and has a positive natural width, so a missing or invalid sprite asset does not
appear to cause the renderer to draw an unusable image.

However, repository search found no identified `Image.onerror` handler,
`addEventListener("error", ...)` handler, fallback battle sprite, or explicit
warning for a failed battle-sprite load.

Invalid sprite filenames therefore appear to fail safely from a rendering
perspective but silently, leaving the affected battler without its configured
visual and without an identified runtime diagnostic.

**Classification:** Confirmed diagnostics gap / graceful visual failure.

#### Save data declares a version but is not schema- or version-validated during load

`SaveManager.save()` writes each save with `version: 1`, establishing an
explicit save-format version in persisted data.

However, repository search found no identified runtime consumer of
`saveData.version`. The inspected load path therefore does not use the saved
version to reject incompatible data, select a migration path, or otherwise
adapt older save structures.

`SaveManager.read()` catches JSON parsing failures, but successfully parsed
data then proceeds into `SaveManager.load()` without an identified schema
validation step.

The actor restore path expects `saveData.actor` and directly restores values
including actor identity, level, EXP, HP/MP, combat statistics, equipment IDs,
and Magick. Most restored numeric values are accepted through nullish fallback
rather than type, range, or finite-number validation. The Magick collection
receives an array-shape check, but its individual entries are not validated in
this restore block.

Saved location values are converted with `Number()`, but the inspected path
does not establish finite-number validation before applying the resulting map
ID and coordinates.

The save system therefore protects against syntactically invalid JSON but does
not currently establish a corresponding version/schema-validation boundary for
successfully parsed save data.

The menu load caller does not establish an additional error boundary around this
operation. `Scene_Menu` checks only that the selected save-slot key exists and
then calls `SaveManager.load(slotId).then(...)`.

No identified `.catch(...)` handler or equivalent rejection handling surrounds
that promise. Because `SaveManager.load()` is asynchronous, an exception during
restoration therefore becomes a rejected load promise rather than the normal
`false` result used for an unsuccessful load.

For example, successfully parsed save data with no `actor` object can reach
`const actorData = saveData.actor` and then attempt to access properties such
as `actorData.actorId`. The inspected menu caller does not convert such a load
failure into a user-facing save message or other graceful failure path.

The missing save-schema boundary therefore also has an identified propagation
path into the menu load workflow rather than being contained entirely inside
`SaveManager`.

`SaveManager.load()` has one explicit normal failure result: it returns `false`
when `SaveManager.read()` produces no usable save object. `read()` returns
`null` both when no save JSON exists and when stored JSON cannot be parsed.

The menu checks `SaveManager.exists(slotId)` before calling `load()`, so a
completely absent slot receives an explicit `"Slot ... is empty."` message.
However, a slot containing malformed JSON still exists and proceeds into
`load()`. After the parse failure causes `load()` to resolve to `false`, the
inspected `Scene_Menu` promise callback has no `else` branch for that result.

Malformed JSON is therefore caught by the save layer and reported to the
console, but the identified menu workflow provides no corresponding
user-facing load-failure message.

This is distinct from structurally invalid but successfully parsed JSON, which
can throw during restoration and reject the load promise because no schema
validation or caller-side rejection handler was identified.

Saved inventory state provides another concrete example of this missing schema
boundary.

`SaveManager.load()` shallow-copies saved `items`, `weapons`, and `armors`
objects directly into `$gameParty` without identified validation of their
stored IDs or quantity values.

These quantities are later consumed as numeric inventory counts by
`Game_Party`. `gainItem()` adds its incoming amount directly to the existing
stored count, while `gainWeapon()` and `gainArmor()` convert the incoming
amount with `Number()` but still add it to the existing restored count.

A malformed saved quantity can therefore affect later inventory arithmetic.
For example, a restored string count such as `"3"` can participate in string
concatenation rather than numeric addition when inventory changes.

The save loader therefore relies on persisted inventory quantities already
satisfying the numeric contract expected by `Game_Party`, with no identified
load-time normalization or validation of those restored counts.

**Classification:** Confirmed save compatibility / validation gap.

#### Save writes do not handle storage failures

`SaveManager.save()` constructs and serializes the save payload and then writes
it directly through `localStorage.setItem()`.

The save method contains no identified `try/catch` around either
`JSON.stringify()` or the storage write. Repository inspection found the only
`try/catch` in `SaveManager` around JSON parsing in the read path.

If the browser rejects the storage write, for example because storage is
unavailable or its quota has been exceeded, the exception can therefore escape
from `SaveManager.save()` instead of being converted into the method's normal
`false` failure result.

The method logs a successful save and returns `true` only after the storage
write completes, so a thrown storage exception does not falsely report success.
However, the current caller path has no save-layer error boundary for this
failure mode.

**Classification:** Confirmed save-write error-handling gap.

#### Item gain commands do not validate quantities consistently with equipment gain commands

The event-interpreter item gain paths do not establish the same numeric
validation used by the corresponding armor and weapon commands.

`Game_Interpreter.commandGainItem()` and
`commandGainItemMessage()` obtain their quantity with
`command.amount || 1` and pass that value directly to
`Game_Party.gainItem()`.

`Game_Party.gainItem()` then calculates the new inventory quantity with
`currentAmount + amount` without converting or validating the supplied amount.

A string quantity can therefore participate in string concatenation rather
than numeric addition. For example, an existing count of `2` combined with a
supplied amount of `"3"` produces `"23"` rather than `5`.

The `|| 1` fallback also means an explicit numeric amount of `0` is replaced
with `1`, while negative or otherwise truthy malformed values are not rejected
by the item-command path.

This differs from the armor and weapon event commands, which convert their
configured amount through `Number()` and reject non-finite or non-positive
values before modifying inventory.

The item-message path additionally compares the unnormalized value using
`amount === 1`, so numeric strings can also produce message behavior that does
not match their numerical meaning.

**Classification:** Confirmed runtime input-validation inconsistency.

#### Item runtime schema is not specifically validated at database load time

The current `Items.json` definitions are internally consistent with the
identified item-use runtime. Both current items define `type: "item"`,
`consumable: true`, and an `effect` object using `type: "healHp"` with a
positive numeric `value`.

`Game_Party.useItem()` actively consumes this metadata. It requires an effect,
dispatches behavior using `effect.type`, converts `effect.value` with
`Number()`, rejects non-finite or non-positive healing values, and removes the
item only when `consumable === true`.

However, repository inspection found no item-specific `validateItems()`
validation path. Items receive generic indexed-database validation, but that
generic validation does not establish the runtime-specific contract for fields
such as `type`, `consumable`, `price`, `effect.type`, or `effect.value`.

Malformed effect data is handled defensively when an item is actually used,
so the identified gap does not currently imply an item-use crash. It means
invalid item definitions can pass database loading and remain undetected until
the runtime attempts to use them.

**Classification:** Confirmed item schema-validation gap with defensive runtime handling.

#### Weapon and armor combat schemas are not specifically validated at database load time

The current weapon and armor records use numeric values consistently for the
equipment fields inspected during this audit.

These fields are actively consumed by runtime systems. Weapon `attack` contributes
to total physical attack, `attackPercent` scales attack output, `magicAttack`
contributes to spell damage and healing calculations, and `criticalBonus`
contributes to critical resolution. Armor `defense` contributes to total defense
and therefore reduces physical damage.

The same calculated values are also presented by status and equipment windows,
making this metadata part of both the combat and user-interface contracts.

However, repository inspection identified only generic indexed-database validation
for Weapons and Armors. No equipment-specific validation establishes that these
combat fields exist where required, contain finite numeric values, or fall within
valid gameplay ranges before the records reach runtime consumers.

Several runtime calculations provide fallback values for missing properties, but
those fallbacks do not validate supplied values. A malformed string, non-finite
number, or otherwise invalid equipment statistic could therefore pass database
loading and later produce coercion, `NaN`, or incorrect combat and display results.

The current equipment records shown during this audit are correctly typed, so this
finding does not establish malformed existing content. It establishes that future
or edited equipment data lacks an identified load-time schema boundary for its
active combat fields.

A repository search for direct `.price` property access returned no results.
Equipment `price` metadata is therefore not included in the confirmed active
runtime contract described by this finding.

**Classification:** Confirmed weapon and armor schema-validation gap.

#### Several selectable list windows do not support more entries than their fixed layouts

`Window_EquipSelect` and `Window_Inventory` both build complete selectable lists
and render every entry into fixed-height windows.

Neither implementation provides a scrolling offset, visible-row limit, pagination,
or canvas clipping boundary. Keyboard navigation continues across each complete
array regardless of whether the selected entry remains inside the usable drawing
area.

`Window_EquipSelect` has a fixed height of 360 pixels. It begins rendering entries
at `y + 110`, advances by 40 pixels per entry, and draws the stat preview at
approximately `y + 315`.

Because the equipment list includes a `"None"` entry, the sixth rendered row
appears at approximately `y + 310` and overlaps the stat preview. Later rows
continue toward and beyond the window border.

`Window_Inventory` has a fixed height of 420 pixels. It begins rendering items at
`y + 105`, advances by 40 pixels per item, and reserves the region beginning at
approximately `y + 295` for the selected-item description and HP display.

The sixth unique inventory item is therefore drawn at approximately `y + 305`,
inside the reserved details region. Additional items overlap the description and
HP display and eventually extend beyond the window.

`Window_BattleItem` follows the same pattern. Its fixed height is 260 pixels,
its first item is drawn at `y + 75`, and subsequent items advance by 40 pixels.

The sixth battle item is therefore drawn at `y + 275`, below the bottom of the
window at `y + 260`. The update logic nevertheless navigates across the complete
item array, allowing the active selection to move to an item that is not visible.

The current Items, Weapons, and Armors databases shown during this audit contain
only two records each, so current content does not reach these capacity limits.
The defects become visible as the databases and the party's owned collections
grow.

`Window_Magick` also renders its complete list of known Magick into a fixed
420-pixel-high window. Magick rows begin at `y + 105` and advance by 40 pixels,
while the selected Magick's MP, description, and category occupy the bottom region
beginning at approximately `y + 325`.

The seventh Magick is drawn at `y + 345`, directly inside that details
region. Later Magick overlap the remaining details and eventually extend beyond
the window. Navigation continues across the complete filtered Magick array without
keeping the selected entry inside a visible range.

This window is used for field-menu Magick and does not establish the presence of a
separate battle-Magick selection window.

`Window_BattleMagick` uses the same 360-by-260-pixel layout and 40-pixel row
spacing as `Window_BattleItem`. Its first Magick is drawn at `y + 75`, so
the sixth Magick is drawn at `y + 275`, below the window's bottom boundary at
`y + 260`.

The complete Magick array remains keyboard-selectable despite entries beyond
the fifth not being visible inside the battle window.

#### The battle scene has no identified runtime entry path and hardcodes its encounter

Application startup initializes `SceneManager` and transitions directly to
`Scene_Map`.

Repository-wide searches for `Scene_Battle` and `SceneManager` usage found no
identified runtime transition that pushes or goes to `Scene_Battle`.
`Scene_Map` can push `Scene_Menu`, while `Scene_Menu` and `Scene_Battle` contain
calls that return through `SceneManager.pop()`. However, no corresponding entry
into `Scene_Battle` was identified.

The battle scene therefore contains a return path without an identified runtime
entry path.

Additionally, `Scene_Battle` constructs its encounter directly as two
`Game_Enemy(1)` instances:

```js
this.enemies = [new Game_Enemy(1), new Game_Enemy(1)];

**Classification:** Confirmed inventory and equipment list scalability and visibility defects.

#### `addVariable` performs arithmetic without numeric normalization

`Game_Interpreter.commandAddVariable()` passes `command.value` directly to
`Game_Variables.addValue()`.

Repository search found no additional runtime caller of `addValue()`, making
the event-interpreter command the identified entry point for this additive
variable operation.

`Game_Variables.addValue()` calculates the result through
`this.value(id) + amount` and stores that result without converting or
validating the supplied amount.

Because JavaScript's `+` operator also performs string concatenation, a
numeric-looking string can change the operation's meaning. For example, an
existing variable value of `2` combined with an amount of `"3"` produces
`"23"` rather than numeric `5`.

This finding applies specifically to the additive variable command. The
variable system also supports direct value assignment through `setValue()`,
so the repository evidence does not establish that all game variables are
intended to be numeric. However, the `addVariable` path itself does not enforce
the numeric contract implied by arithmetic addition.

**Classification:** Confirmed runtime coercion risk in additive variable handling.

#### Individual map data is loaded without an identified schema-validation boundary

`DatabaseManager.loadDatabase()` loads the core database collections and then
passes the resulting database object through `DatabaseValidator.validate()`.

`MapInfos.json` therefore participates in database validation, and
`DatabaseManager.loadMap()` also checks that a requested map ID resolves to a
known map-info record.

However, individual map files are loaded separately on demand.
`DatabaseManager.loadMap()` resolves the configured map filename, loads and
parses that JSON through `loadJSON()`, and returns the resulting map object
directly.

No identified validation step inspects the loaded map object's structure before
it is consumed by `Scene_Map` and the event runtime.

The unvalidated surface includes map-level and nested event data such as event
pages, conditions, commands, command payloads, transfers, coordinates, and
other map-specific properties.

This also provides a broader context for runtime command-validation findings.
For example, `addVariable` can receive an unnormalized command value that is
later used with JavaScript addition, while `setSwitch` ultimately converts its
supplied value through `Boolean()`. A malformed string value such as `"false"`
would therefore be truthy rather than equivalent to boolean `false`.

The current `Map001.json` data uses correctly typed values, so these behaviors
do not establish that the existing map content is malformed. They establish
that individual map/event data lacks an identified load-time schema boundary
that would reject malformed future data before it reaches runtime consumers.

Repository search found no current map/event data using the non-message
`"gainItem"` command directly. The weaker `commandGainItem()` path therefore
remains an exposed runtime/API inconsistency, but no current map content was
identified that exercises it.

**Classification:** Confirmed map/event schema-validation gap.

The inspected enemy-turn path is separate from this player Magick-execution
pipeline. `BattleManager.performEnemyTurn()` selects the first living party
member as its target and directly calculates physical damage from
`enemy.totalAttack()` and `target.totalDefense()`.

It applies a defending reduction when appropriate and then calls
`target.loseHp(damage)`, followed by battle-state, message, defeat, and
enemy-turn progression handling.

No Magick lookup, `magick.effect` dispatch, or call to `Game_Actor.useMagick()`
was identified in this enemy-turn method. The inspected enemy turn therefore
implements a direct basic physical attack rather than reusing the player
Magick execution pipeline.

This means the identified unsupported-effect behavior in
`Game_Actor.useMagick()` describes the normal player-Magick execution path, while
the inspected enemy-turn implementation does not currently establish an
equivalent enemy Magick-effect path.

Repository inspection found explicit `magick.effect` runtime handling for `heal`
and `damage` in `BattleManager.js` and `Game_Actor.js`.

No corresponding Magick-effect dispatch path was identified for
`inflictStatus`, `removeStatus`, `revive`, `escape`, or `banish`.

The two current `revive` Magick also define `revivePercent` values of `0.25`
and `1.0`, representing revival at 25% and 100% HP respectively. Repository
search found no JavaScript runtime consumer for `revivePercent`, consistent
with the absence of an identified `revive` Magick-effect execution path.

Revival-related metadata also appears outside the Magick schema. Death defines
`canBeRevived: true` in `Statuses.json`, while `Essences.json` contains an
Essence entry with `type: "reviveGrantStatus"`.

Repository searches found no identified JavaScript runtime consumer for
`canBeRevived` or `reviveGrantStatus`. Combined with the absence of identified
runtime consumers for the `revive` Magick effect and `revivePercent`, revival
vocabulary is currently present across the Magick, status, and Essence data
schemas without an identified runtime execution path connecting those concepts.

The presence of these fields does not by itself establish their intended
runtime semantics.

Three current Magick entries with `inflictStatus` define `allyStatusChance: 1.0`. Their
descriptions specify a different status-application probability for allies than
for enemies, indicating that `allyStatusChance` is intended as a target-dependent
status-chance override.

Two of those Magick, Diminish and Beastshape, additionally define
`toggleStatus: true`. Their descriptions specify that the Magick can either
inflict or cure its associated status, indicating that `toggleStatus` is
intended to switch behavior based on the target's current status state.

Repository searches found no JavaScript runtime consumer for either
`allyStatusChance` or `toggleStatus`.

These fields therefore describe additional status-Magick behavior that should be
integrated with the eventual `inflictStatus` / `removeStatus` execution path
rather than implemented as isolated Magick-specific cases.

Repository searches for `magick.status`, `magick["status"]`, and `.status` found
no identified JavaScript runtime consumer of the `status` object stored on
Magick definitions.

The broader `.status` search did identify existing status infrastructure,
including the status database managed by `DatabaseManager` and runtime battler
status state maintained by `Game_Battler`. This indicates that status
functionality exists independently of the Magick-effect execution path.

The missing integration is therefore not status support in general, but an
identified bridge from a Magick's `status` metadata and status-related effect
fields into the existing battler status APIs.

The underlying engine may already contain portions of the functionality needed
by some of these effects. For example, `Game_Battler` exposes status-removal
behavior through `removeStatus()`. However, no identified Magick-effect path
connects `"effect": "removeStatus"` to that battler API.

Similarly, repository searches for `escape` found runtime uses associated with
the Escape input action, but no identified execution path for a Magick whose
`effect` is `"escape"`.

The current Magick database therefore defines a broader effect vocabulary than
the identified Magick runtime dispatcher currently executes.

This should be resolved through a centralized, data-driven Magick-effect
execution path rather than by adding Magick-ID-specific special cases.

**Classification:** Possible improvement.

Before expanding validation, inventory the complete `magick.json` schema
and its runtime consumers. Validation should reflect the intended data
contract rather than prematurely rejecting fields that are still under
development.

#### Magick `scopePower` metadata is consumed but not validated

**Files:** `data/Magick.json`, `js/core/DatabaseValidator.js`,
`js/objects/Game_Actor.js`

`magick.json` currently contains 19 Magick with `scopePower` metadata.
The inspected definitions consistently use `single` and `all` keys with
numeric multiplier values.

`Game_Actor.skillScopeMultiplier()` actively consumes this metadata for
both `magickHealing()` and `magickDamage()`.

Missing `scopePower` is intentionally supported and falls back to a
multiplier of `1`. If `scopePower` exists but the requested value cannot
be converted to a finite number, runtime also falls back to `1`.

Repository inspection found no corresponding `scopePower` validation in
`DatabaseValidator.validateMagick()`.

The current Magick data appears internally consistent, so no present data
defect was identified. However, malformed values, unsupported keys, or
scope/data mismatches could potentially pass database validation and be
silently replaced by the runtime fallback.

**Classification:** Possible improvement.

When Magick-schema validation is expanded, consider validating that
`scopePower`, when present, is an object whose keys correspond to supported
Magick scopes and whose values are finite numeric multipliers.

#### Magick `power` metadata is consumed but not validated

**Files:** `data/Magick.json`, `js/core/DatabaseValidator.js`,
`js/objects/Game_Actor.js`

`magick.json` defines numeric `power` values across the Magick database,
including legitimate zero-power Magick.

`Game_Actor` actively consumes `magick.power` in both `magickHealing()` and
`magickDamage()`, so this field directly participates in runtime HP
calculation.

Repository search found no corresponding `power` validation in
`DatabaseValidator.validateMagick()`.

The current inspected Magick data uses numeric values, and no present data
defect was identified. However, malformed `power` values could pass
database validation and reach arithmetic performed by the runtime.

**Classification:** Possible improvement.

When Magick-schema validation is expanded, consider requiring `power` to be
a finite number while continuing to permit `0` as a valid value.

#### Battle victories do not award experience

Repository search for `gainExp(` found only the `Game_Actor.gainExp()` implementation, event-command handling in `Game_Interpreter`, and audit documentation. No battle victory path calls `gainExp()`, so defeating enemies does not automatically award experience.

**Impact:** Battles can end successfully without advancing the party’s experience or levels.

**Recommendation:** When victory is finalized, total the EXP rewards from every defeated enemy and distribute the result through the appropriate party/actor progression API. Ensure rewards are granted exactly once.

#### Currency rewards are not implemented

Repository searches for `gainGold(` and `gold` returned no results. The project currently has no identified currency property, currency-management API, or battle currency reward path.

**Impact:** Battles and events cannot award or spend conventional currency, limiting progression and future shop functionality.

**Recommendation:** Define the intended currency system before implementing battle rewards. Store currency in the appropriate persistent party or game-state object, provide validated gain/spend methods, include it in save data, and have victories total rewards from all defeated enemies.

#### Battle item drops are not implemented

Repository search for `drop` found only a planning reference in `docs/battle_system.md`. No enemy drop data, drop-selection logic, inventory award call, or victory-screen integration was identified.

**Impact:** Defeated enemies cannot provide item rewards, leaving the battle reward loop incomplete.

**Recommendation:** Define enemy drop tables with item IDs, quantities, and probabilities. Resolve drops once during victory finalization, validate referenced items, add awarded items through the inventory API, and present the results alongside EXP and currency rewards.

#### Battle victories do not award Essence Resonance

`Game_Essence` stores Resonance, derives Essence levels from configured thresholds, and provides `addResonance(amount)`. However, repository search found no battle or victory code calling that method. `TODO.md` also leaves “Implement Resonance gain” unchecked.

**Impact:** Essence progression cannot advance through battles despite the documented design requiring surviving equipped Essences to gain full battle Resonance.

**Recommendation:** During victory finalization, calculate the encounter’s Resonance reward and call `addResonance()` once for each eligible equipped Essence. Enforce the 1500-point cap, prevent duplicate awards, persist the updated values, and clearly report Mastery Ready transitions.

**----------------------------------------------------------------------------------------**

### Verified Behavior and Design Context

#### Startup sequence

**File:** `js/main.js`

The startup sequence is coherent:

1. Initialize Graphics.
2. Initialize Input.
3. Initialize SceneManager.
4. Load and validate the database.
5. Create `$gameSystem`.
6. Expose switches, variables, self-switches, party, and the backward-compatible leader alias.
7. Enter `Scene_Map`.
8. Start the game loop.

No confirmed startup defect was identified during the initial review.

#### Global game-object aliases

**File:** `js/main.js`

`startGame()` exposes several game objects through `window`, including `$gameSystem`, `$gameSwitches`, `$gameVariables`, `$gameSelfSwitches`, `$gameParty`, and `$gameActor`.

The `$gameActor` alias is explicitly documented in the code as backward-compatible while party-aware systems transition toward `$gameParty`.

The existence of these globals is intentional engine behavior. The _extent of dependency_ on the legacy `$gameActor` alias remains an audit question and is recorded separately under Possible Improvements.

#### Database loading boundary

**File:** `js/core/DatabaseManager.js`

- Core database JSON is loaded centrally by `loadDatabase()`.
- `System.json` is loaded first so debug configuration can be established.
- Database validation occurs before loading is reported complete.
- Map data is loaded separately on demand through `loadMap()`.
- `DatabaseManager` provides centralized ID-based accessors for major database record types.

No confirmed defect was identified in the loading boundary during the initial review.

#### Game_Essence runtime ownership

**File:** `js/objects/Game_Essence.js`

`Game_Essence` provides runtime progression state for an Essence.

It:

- Stores `essenceId` and current resonance.
- Resolves canonical Essence data through `DatabaseManager`.
- Derives Essence level from resonance thresholds.
- Adds positive finite resonance.
- Detects level increases.
- Determines unlocked abilities from unlock levels.
- Resolves unlocked ability Magick IDs through `DatabaseManager`.

The class does not currently process Essence passives, mastery, type, element, or max-level behavior directly.

#### Essence passive system is designed but not yet implemented

**Files:** `data/Essences.json`, `TODO.md`, `CHANGELOG.md`, `README.md`, `docs/battle_system.md`, `docs/design_bible.md`, `docs/roadmap.md`

Repository searches show Essence passive definitions are extensively represented in data and documentation, but no JavaScript runtime currently consumes the passive definitions.

A search for `.passive` produced no runtime result. A broader search for `passive` found the data and documentation, and a search for the concrete passive type `elementDamageBoost` returned only its definition in `Essences.json`.

Project documentation and TODO entries explicitly identify Essence passive runtime/effects as future implementation work.

**Classification:** The passive data is forward-designed content awaiting its planned runtime implementation, not obsolete data.

#### Essence Mastery is designed but not yet implemented

**Files:** `data/Essences.json`, `README.md`, `TODO.md`, `CHANGELOG.md`, `docs/architecture.md`, `docs/battle_system.md`, `docs/coding_style.md`, `docs/design_bible.md`, `docs/roadmap.md`

Repository search for `mastery` found extensive Essence data and project documentation, but no active JavaScript runtime implementation was identified during this audit step.

Project documentation establishes the intended Mastery lifecycle, including Mastery Ready at 1500 Resonance, Mastery Trials, future quest integration, and eventual Mastery completion.

TODO entries distinguish completed Mastery design work from remaining runtime implementation.

**Classification:** Mastery metadata in `Essences.json` is forward-designed data for a planned runtime system and should not be classified as dead or obsolete data.

#### Game_System is the root game-state container

**File:** `js/objects/Game_System.js`

`Game_System` currently constructs and owns the primary persistent
game-state objects used by `main.js`, including:

- Actor instances.
- The party.
- Self switches.
- Global switches.
- Global variables.

`main.js` then exposes references to these owned objects through the
engine's global aliases.

**Classification:** Intentional / verified design.

The ownership relationship between `Game_System` and the global aliases
is internally consistent with the current startup architecture.

#### Game_Party separates roster membership from battle membership

**File:** `js/objects/Game_Party.js`

`Game_Party` maintains the complete actor roster separately from the
currently active battle-member IDs.

The class provides explicit APIs for roster membership, leader lookup,
battle membership, battle leadership, and living battle members.

`members()` and `battleActorIds()` return copies rather than exposing the
internal arrays directly.

`setBattleActorIds()` validates actor IDs, rejects duplicates, limits the
active party to four members, and falls back to the party leader when an
otherwise empty battle party would be produced.

**Classification:** Intentional / verified design.

This supports the engine's transition toward a larger roster while keeping
battle-party composition independently manageable.

#### Game_Actor extends battler state with actor-specific progression

**File:** `js/objects/Game_Actor.js`

`Game_Actor` extends `Game_Battler` rather than duplicating general battler
state.

Actor-specific ownership includes:

- Actor database identity.
- Battle-sprite configuration.
- EXP and growth configuration.
- Weapon and armor IDs.
- Learned Magick.
- Magick use and targeting.
- Actor level progression.
- Equipment-aware combat-stat calculations.

General battler state and behavior remain inherited from `Game_Battler`.

**Classification:** Intentional / verified design.

The current inheritance boundary provides a clear distinction between
general combatant behavior and actor-specific RPG progression.

#### Actor EXP mutation is centralized through Game_Actor

**Files:** `js/objects/Game_Actor.js`, `js/objects/Game_Interpreter.js`

Repository search for `gainExp(` found the implementation in Game_Actor
and event-command callers in Game_Interpreter.

Game_Interpreter delegates EXP changes to `Game_Actor.gainExp()` rather
than directly modifying EXP or duplicating level-up calculations.

**Classification:** Intentional / verified design.

The remaining audit question concerns which actor or actors should receive
event-command EXP, not the EXP mutation mechanism itself.

#### Actor Magick acquisition is centralized through Game_Actor

**Files:** `js/objects/Game_Actor.js`, `js/objects/Game_System.js`

Repository search for `learnMagick(` found one implementation in
`Game_Actor` and six callers in `Game_System`.

Magick acquisition is therefore routed through `Game_Actor.learnMagick()`
rather than being independently implemented by multiple systems.

**Classification:** Intentional / verified design.

#### Actor equipment mutation is centralized through Game_Actor

**Files:** `js/objects/Game_Actor.js`, `js/windows/Window_Equipment.js`

Repository searches for `equipWeapon(` and `equipArmor(` found one
authoritative implementation of each operation in `Game_Actor`.

`Window_Equipment` delegates equipment changes through these methods rather
than directly modifying the actor's weapon or armor IDs.

**Classification:** Intentional / verified design.

Equipment mutation is therefore centralized at the actor level.

#### Game_Actor centralizes Magick ownership and basic usability

**File:** `js/objects/Game_Actor.js`

`Game_Actor` owns learned Magick IDs and provides explicit APIs for learning,
forgetting, querying, and resolving known Magick.

`learnMagick()` validates the Magick database record and prevents duplicate
Magick acquisition.

`canUseMagick()` centralizes the basic runtime requirements for Magick use,
including Magick existence, learned-Magick ownership, and MP affordability.

`useMagick()` delegates to this usability check when MP cost payment is
required.

**Classification:** Intentional / verified design.

#### Magick status data uses canonical status-key mappings

**File:** `data/Magick.json`

Status-related Magick represent their affected statuses through a `status`
object whose property names identify individual statuses and whose numeric values
encode additional per-status metadata.

The numeric value associated with each status key represents its application
or removal probability, expressed from `0.0` to `1.0`.

This is confirmed directly by Magick descriptions. For example, Venom stores
`"poison": 0.48` and describes a 48% chance to inflict Poison, while Plague
Nova stores `"poison": 0.72` and describes a 72% chance.

Some Magick also define special probability behavior separately. Diminish,
for example, stores `"small": 0.72` while defining `allyStatusChance: 1.0`,
matching its 72% enemy / 100% ally behavior.

The same schema supports both single-status and multi-status Magick.

Examples include `removeStatus` Magick such as Purge Venom, Soul Cleanse,
Wardbreaker, and Nullify.

Repository searches found no separate `statusId` or `statusKey` fields in
the Magick data.

**Classification:** Intentional / verified design.

This representation is compatible in principle with the status runtime's
key-based APIs, although the Magick-effect runtime does not yet consume
these status mappings.

#### Magick elemental metadata has active runtime integration

**Files:** `data/Magick.json`, `js/battle/BattleManager.js`,
`js/objects/Game_Actor.js`, `js/objects/Game_Battler.js`

`magick.json` defines elemental metadata through each Magick's `element`
property.

Repository inspection confirmed active runtime consumers of
`magick.element` in both `BattleManager.js` and `Game_Actor.js`.

Elemental damage resolution queries the target battler through
`elementRate(magick.element)`, while `Game_Battler` owns the underlying
element-rate data and lookup behavior.

Further inspection confirmed that these element-rate lookups serve distinct
responsibilities rather than applying elemental damage multiple times.

`Game_Actor.magickDamage()` uses the target's element rate as an actual
damage multiplier before HP loss is applied.

`BattleManager` queries the element rate afterward for battle presentation,
including elemental outcome reporting such as immunity, weakness, and
resistance. Its separate lookups correspond to different targeting paths.

No duplicate elemental damage application was identified.

Repository search found no external runtime caller of
`Game_Actor.magickDamage()`. Its only identified runtime call site is
`Game_Actor.useMagick()`, confirming that elemental Magick damage currently
flows through the normal Magick-execution path.

This establishes an active data-to-runtime path from Magick elemental
metadata through battler elemental rates into damage resolution.

Unlike currently unconsumed Magick metadata such as `status` and
`reflectable`, the `element` property is actively integrated with combat
resolution.

**Classification:** Intentional / verified design.

#### Magick scope-power scaling is centralized in Game_Actor

**Files:** `data/Magick.json`, `js/objects/Game_Actor.js`

`Game_Actor.skillScopeMultiplier()` provides the runtime interpretation of
Magick `scopePower` metadata.

Repository search found three references to `skillScopeMultiplier()`, all
within `Game_Actor.js`: the method definition and calls from
`magickHealing()` and `magickDamage()`.

Both restorative and damaging Magick therefore share the same scope-scaling
helper rather than implementing separate multiplier rules.

If `scopePower` is absent, or the requested scope does not resolve to a
finite numeric multiplier, the helper falls back to `1`.

**Classification:** Intentional / verified design.

#### Magick `type` metadata is consumed but not validated

**Files:** `data/Magick.json`, `js/core/DatabaseValidator.js`,
`js/windows/Window_BattleMagick.js`, `js/windows/Window_Magick.js`

Current `magick.json` data uses `"magick"` for the observed `type` values.

`Window_BattleMagick` and `Window_Magick` actively consume `magick.type` by
filtering Magick whose type is exactly `"magick"`.

Repository searches for `magick.type`, `magick.type ===`, `validTypes`, and
the exact `"magick"` string found no corresponding action-type validation in
`DatabaseValidator`.

The string `"magick"` also appears elsewhere in the repository for unrelated
concepts, including battle commands, battle targeting state, and status
action-type restrictions. These uses should not be treated as a shared
repository-wide `type` schema.

The currently inspected Magick data is consistent with its runtime consumers,
and no present data defect was identified. However, an unsupported or
misspelled Magick `type` could pass database validation and cause that Magick
to be omitted from Magick filtering.

**Classification:** Possible improvement.

When Magick-schema validation is expanded, consider defining and validating
the supported action-type vocabulary explicitly.

#### Magick MP-cost metadata has validation and runtime integration

**Files:** `data/Magick.json`, `js/core/DatabaseValidator.js`,
`js/objects/Game_Actor.js`, `js/windows/Window_BattleMagick.js`,
`js/windows/Window_Magick.js`

`DatabaseValidator.validateMagick()` requires `magick.mpCost` to be a
finite, non-negative number.

`Game_Actor` actively consumes the value for Magick MP-cost handling, while
both the battle-Magick and menu-Magick windows use it when displaying Magick
costs.

This establishes a complete data contract in which Magick MP-cost metadata
is validated before being consumed by gameplay and presentation systems.

Zero MP cost is explicitly permitted by the validator.

**Classification:** Intentional / verified design.

**----------------------------------------------------------------------------------------**

## Core Files Explicitly Tracked

This checklist records the foundational files followed in depth. Additional
runtime, battle, window, scene, data, and documentation files cited throughout
the findings were also inspected through targeted review and repository-wide
searches.

- [x] `js/main.js`
  - Startup order reviewed.
  - Global game-object initialization documented.
  - `$gameActor` compatibility dependency traced for later investigation.
  - No confirmed startup defect identified.

- [x] `js/core/DatabaseManager.js`
  - Database loading and validation boundary reviewed.
  - Centralized accessors reviewed.
  - Accessor/fallback consistency recorded as a possible improvement.
  - No confirmed loading defect identified.

- [x] `js/core/DatabaseValidator.js`
  - Validation dispatch reviewed.
  - Essences omission identified as a confirmed issue.
  - Status nested-schema strictness recorded for further investigation.
  - Minor duration-validation duplication noted.
  - No production changes made during audit.

- [x] `data/Essences.json`
  - Schema breadth reviewed in connection with `Game_Essence`.
  - Abilities, progression, passive metadata, and mastery metadata considered.
  - Passive and Mastery data classified as forward-designed rather than obsolete.
  - Missing Essence validation remains a confirmed issue.

- [x] `js/objects/Game_Essence.js`
  - Essence progression and ability-unlock runtime reviewed.
  - Runtime contracts for levels and abilities documented.
  - Level calculation's dependency on ordered progression data recorded.
  - Passive processing confirmed to belong to planned future work.
  - No production code changed during audit.

- [x] `js/objects/Game_System.js`
  - Root game-state ownership reviewed.
  - Ownership relationship with main.js globals verified.
  - Temporary Magick-learning setup recorded.
  - Individually hard-coded actor ownership recorded for party/save audit.
  - No production code changed during audit.

- [x] `js/objects/Game_Party.js`
  - Roster and active battle-party ownership reviewed.
  - Defensive copying of party arrays verified.
  - Four-member battle-party implementation identified.
  - Stale three-member comment recorded as a confirmed issue.
  - `$gameActor` item-target fallback added to the legacy-alias investigation.
  - Inventory-only `clear()` semantics recorded for call-site investigation.
  - No production code changed during audit.
- [x] `js/core/SaveManager.js`
  - Save serialization and restoration paths reviewed.
  - Save format confirmed to persist only the legacy leader actor.
  - Missing runtime-status persistence recorded as a confirmed issue.
  - Party inventory and battle-party ID persistence reviewed.
  - Save version field confirmed to be written but not consumed.
  - Version-aware migration recorded for future schema evolution.
  - Existing save compatibility identified as a requirement for later fixes.
  - No production code changed during audit.

**----------------------------------------------------------------------------------------**

## Prioritized Remediation Plan

Production changes remain deliberately separate from this audit. Address them
in focused passes with regression tests.

1. **Protect save integrity and party progression.**
   - Serialize every party actor rather than only `$gameActor`.
   - Define status-persistence rules and migrate version-1 saves safely.
   - Validate save versions and schema before restoring state.
   - Handle serialization and storage-write failures without uncaught errors.

2. **Complete the battle lifecycle.**
   - Provide an explicit, data-driven entry path into `Scene_Battle`.
   - Replace the hard-coded encounter with validated encounter input.
   - Implement exactly-once victory finalization for EXP, currency, item drops,
     Essence Resonance, and post-battle status cleanup.

3. **Centralize Magick and status execution.**
   - Implement the declared Magick-effect vocabulary through one dispatcher.
   - Bridge Magick status metadata into `Game_Battler` status APIs.
   - Integrate reflectability, action restrictions, status modifiers, revival,
     target overrides, and per-hit behavior without ID-specific special cases.

4. **Strengthen database and event validation.**
   - Add specific validation for Essences, Items, Weapons, Armors, Actors,
     Enemies, Magick, battle-sprite metadata, and individual map files.
   - Validate numeric command payloads before arithmetic or inventory mutation.
   - Reject unsupported vocabulary and invalid cross-database references early.

5. **Remove transitional architecture debt.**
   - Reduce legacy `$gameActor` dependencies in favor of party ownership.
   - Centralize equipment mutation, including unequip operations.
   - Standardize database accessors and clarify `Game_Party.clear()` semantics.
   - Add scrolling or pagination to fixed-layout selectable windows.

**----------------------------------------------------------------------------------------**

## Audit Closure

The audit began at the engine entry point and followed foundational dependencies:

`js/main.js`
-> `js/core/DatabaseManager.js`
-> `js/core/DatabaseValidator.js`
-> `data/Essences.json`
-> `js/objects/Game_Essence.js`

Essence passive and Mastery searches established that those systems are deliberately forward-designed and not yet active runtime features.

The review then expanded through game-state ownership, party and actor behavior,
save/load persistence, Magick and status metadata, equipment and inventory,
windows, map/event input, battle orchestration, targeting, scene reachability,
and victory rewards.

This closes the static audit phase. The next phase should implement the
prioritized remediation plan in small passes, with save compatibility tests,
database-validation tests, battle-flow tests, and end-to-end playtesting after
each pass.
