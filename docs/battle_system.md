# ⚔️ Sektor 1 Battle System

This document describes the architecture, rules, and current behavior of Sektor 1's battle system.

It is intended to answer a simple question:

> **How is battle supposed to work?**

Canonical gameplay definitions belong in the JSON databases. This document explains how those definitions are interpreted during battle and records the rules that should remain consistent as the system grows.

---

# 🧭 Battle Design Principles

Sektor 1 uses a custom side-view, turn-based battle system built specifically for the game.

The battle system should remain:

- Data-driven wherever practical
- Modular rather than concentrated in one giant class
- Shared between actors and enemies through `Game_Battler`
- Capable of supporting multiple party members and multiple enemies
- Flexible enough for unusual skills, statuses, Essences, bosses, and future mechanics
- Clear about the difference between game data, runtime state, battle rules, and presentation

Battle data describes an action. Runtime systems decide how that action behaves.

---

# 🔄 Battle Flow

## Encounter Entry

Canonical encounter definitions live in:

```text
data/Encounters.json
```

Each encounter defines its enemy members, formation slots, and whether the
party may escape. Enemy IDs reference `Enemies.json`; formation slots are
validated before the game begins.

Map events start an encounter through the `battle` event command and an
`encounterId`. `Game_Interpreter` delegates that request to
`SceneManager.startBattle()`, which resolves the canonical encounter and pushes
`Scene_Battle`. The paused map scene and event interpreter remain on the scene
stack and resume after victory, defeat, or escape.

`Scene_Battle` constructs fresh `Game_Enemy` runtime objects from the validated
encounter members. It does not own hard-coded enemy composition.

The current battle turn state model is:

```text
TURN_START
    ↓
TURN_COMMAND
    ↓
TURN_ACTION
    ↓
TURN_END
```

During the party phase, living party members act through the party turn queue. When one party member finishes an action, control advances to the next available battler. When the party has finished acting, battle advances to the enemy phase.

The current action sequences are timed phases rather than instantaneous state changes.

Examples include:

```text
Physical Attack
lunge → hit → return → wait

Magic
magicCast → magicEffect → magicRecover → magicWait

Item
itemUse → itemEffect → itemRecover → itemWait
```

These phases allow gameplay resolution, animation, timing, popups, and messages to remain coordinated.

---

# 👥 Battlers

Actors and enemies share common battle behavior through `Game_Battler`.

A battler can own runtime values such as:

- HP and MP
- Core statistics
- Equipment-derived statistics where applicable
- Element interactions
- Battle state
- Defending state
- Skill usability
- Future active status effects and status durations

Actor-specific behavior belongs in `Game_Actor`.

Enemy-specific behavior belongs in `Game_Enemy`.

Rules that apply equally to both should normally live at the shared battler level or in an appropriate battle system.

---

# 🎮 Player Commands

The current battle command foundation supports:

```text
Attack
Magic
Item
Defend
```

`BattleManager` interprets the selected command and begins the appropriate targeting or action sequence.

Future commands and special character mechanics should extend this system without forcing unrelated command logic into rendering or UI classes.

---

# 🎯 Targeting

Targeting is coordinated through `BattleTargetManager`.

The battle system currently supports concepts including:

- Ally targets
- Enemy targets
- Single targets
- All targets
- Selection of living targets
- Skills that permit more than one target group
- Skills that permit more than one target scope

Skill data should determine which target groups and scopes are legal.

The battle scene and target manager handle the player's current selection. Effect resolution should not redefine the skill's targeting rules.

When a skill permits both allies and enemies, the current magic command flow prefers the enemy group as the initial selection while still allowing the legal target groups defined by the skill.

---

# 🗡️ Physical Attacks

The current basic physical attack foundation uses the attacker's total Attack and the target's total Defense.

The base damage relationship is currently:

```text
Damage = max(1, Total Attack - Total Defense)
```

Physical attacks also perform an accuracy roll using the attacker's total attack percentage.

Critical hits currently use a 2× damage multiplier. Critical chance is influenced by the attacker's Luck, level difference, and total critical bonus.

Defending currently reduces incoming basic physical attack damage by 50% while still allowing a minimum of 1 damage in this attack path.

These are current engine rules, not permanent balance promises. If formulas are deliberately rebalanced later, this document should be updated with the engine.

---

# ✨ Magic and Skills

Canonical skill definitions live in:

```text
data/Skills.json
```

The initial Skills System v1 contains 54 skills across Restore, Attack, Indirect, and Advanced magic categories.

Skills can describe behavior such as:

- Damage
- Healing
- Status application
- Status removal
- Revival
- Gravity-style HP effects
- Multiple hits
- Random targeting per hit
- Single-target and all-target scopes
- Ally and enemy targeting
- Elemental behavior

The engine should interpret reusable skill properties rather than hard-code individual spell names whenever practical.

For all-target magic, MP cost is paid once for the cast even though the effect is resolved against multiple targets.

The current battle presentation can report elemental outcomes such as:

```text
IMMUNE
WEAK
RESIST
```

based on the target's elemental interaction with the skill.

---

# 🌐 Scope Power

Some power-based skills support both single-target and all-target casting.

`scopePower` exists to allow the power component of a spell to change with scope without silently changing unrelated mechanics.

Status application chance is not automatically reduced merely because a skill is cast on all targets.

This distinction is important:

> **Scope modifies the properties explicitly designed to scale with scope. It does not globally weaken every part of the skill.**

---

# ❤️ Restore Magic and Unusual Targets

Restore magic is intentionally capable of supporting unusual ally/enemy interactions.

Some restorative skills may legally target enemies. This is necessary for planned undead-style interactions where healing or restorative power can become harmful to an appropriate target.

Target legality and effect interpretation are separate responsibilities.

A skill being restorative does not automatically mean its target must be an ally.

The complete undead restorative-damage interaction remains future runtime work.

---

# 🧪 Status System

Canonical status definitions live in:

```text
data/Statuses.json
```

Status System v1 defines 25 initial statuses using reusable data structures.

The core Status Runtime is implemented. `Game_Battler` owns active status instances, duration state, derived-state evaluation, application/removal rules, resistance checks, and reusable status-effect queries. Individual advanced mechanics are still being completed in later passes.

The runtime currently supports:

- Status application and removal
- Positive and negative statuses
- Status families
- Turn-based durations
- Until-removed durations
- Countdown durations
- Derived states
- Persistent-after-battle states
- Status immunity and resistance multipliers
- Non-stacking runtime instances with duration refresh on reapplication
- Fury / Sadness mutual exclusivity
- Turn-start damage and healing triggers
- Generic action prevention through `effects.canAct`
- Data-driven action allowlists and blocked skill types for status restrictions
- Shared physical and magical incoming-damage modifiers
- Shared outgoing physical-damage and physical-accuracy modifiers
- Physical-damage status-removal triggers
- Elemental magical absorption for defensive statuses
- Party and enemy status indicators during battle

Status behavior should be driven by properties in `Statuses.json` wherever practical rather than by checks for individual status names.

Battlers may optionally define `statusRates` for a specific status key and `statusFamilyRates` for a complete status family. A rate of `1.0` is normal susceptibility, values below `1.0` reduce the final application chance, values above `1.0` increase it up to the final 100% cap, and `0` grants immunity. Specific-status and family rates multiply together.

Ordinary status application uses the calling effect's base chance multiplied by the target's effective status rate. Derived statuses are not rolled or manually inflicted; the runtime evaluates them from their conditions.

Skill status payloads now route through this same runtime. `Game_Actor.useSkill()` interprets the reusable `status` object for damage skills, pure status application, and status removal. Skill-defined base chances continue to respect target status resistance and immunity when applying a status. `allyStatusChance` can override the base chance for allied targets, and `toggleStatus` lets reversible transformations such as Small and Frog use the same skill to apply or remove their status. Status-removal skills use their own per-status chance without being blocked by the target's resistance to receiving that status.

The runtime records the most recent per-status resolution so battle presentation can distinguish applied, refreshed, removed, resisted, immune, unchanged, and unsupported status references without hard-coding individual skill names.

`Skills.json` still contains the legacy keys `resist` and `deathforce`, but neither is part of the approved 25-status `Statuses.json` v1 set. The runtime therefore reports those references as unsupported instead of inventing ad-hoc status behavior. They remain future design work unless they are formally added to the canonical status database.

---

# ⏳ Status Timing

Sektor 1's status architecture distinguishes multiple duration models.

Turn-based statuses expire after their defined number of battler turns. Reapplying a turn-based or countdown status refreshes its remaining turns instead of creating a duplicate runtime instance.

Until-removed statuses remain until a valid removal condition occurs. Statuses marked `removable: false` reject ordinary removal attempts, while internal runtime maintenance can still remove them when their defining condition stops being true.

Countdown statuses use a remaining-turn counter. Their countdown advances when the afflicted battler completes or forfeits that battler's turn, rather than after every global battle action. This prevents action-blocking statuses such as Paralyze from becoming permanent simply because the battler could not choose an action.

Turn-start triggers are processed for the active party member and for enemies. When the enemy sequence finishes, the first party member of the next round receives the same turn-start processing as later party members.

Haste and Slow are intended to alter how quickly battlers reach future turns once turn-speed modifiers are connected to the turn scheduler.

Derived statuses are evaluated from current battle conditions instead of being manually applied and removed like ordinary statuses.

Near-Death is the initial derived example and is active at or below 25% Max HP.

---

# ☠️ Status Runtime Rules

The initial status design establishes several rules that the runtime must preserve.

Poison and Dual are distinct statuses even though both belong to the damage-over-time family. Poison-specific mechanics do not automatically apply to Dual. Their current turn-start damage is resolved from each status's own `hpDamagePercent` data.

Regen and damaging-over-time statuses may coexist. Their turn-start effects resolve independently according to their own definitions.

Stop and Paralyze are intentionally distinct. Both currently prevent acting through the shared `canAct` runtime rule. Stop's additional `haltsTurnProgression` behavior remains part of the time-system work that will connect Haste, Slow, and Stop to turn scheduling.

Sleep and Confuse are removed when the afflicted battler actually takes physical damage. A miss or a fully nullified physical hit does not remove them. Confuse random targeting remains future runtime work.

Physical combat modifiers are read from status data rather than status names. Outgoing `physicalDamageMultiplier` values affect basic physical damage, `physicalAccuracyMultiplier` values affect physical hit chance, and target-side `physicalDamageTakenMultiplier` values are applied by the shared incoming-damage resolver. This makes the damage portions of Berserk, Fury, Darkness, Frog, Small, Sadness, Barrier, and Shield reusable even while their unrelated mechanics remain separate work.

Action restrictions are resolved from status data rather than status names. `effects.allowedActions` narrows the battler to the intersection of all active allowlists, while `effects.blockedSkillTypes` blocks matching skill/action types. Frog currently uses `allowedActions: ["attack"]`, so Attack remains available while Magic, Item, and Defend are disabled. Silence uses `blockedSkillTypes: ["magic"]`, so physical attacks, items, and Defend remain available while magic skills are unusable. The battle command window dims/skips restricted commands, and the execution layer rechecks the same shared rule before resolving an action.

Death-Sentence applies Death when its countdown expires. Slow-Numb applies Petrify when its countdown expires.

Fury and Sadness are intended to be mutually exclusive. That relationship is an engine interaction rule rather than duplicated inside each status definition.

Death is a battle defeat state that can be revived. Post-battle processing restores defeated party members to 1 HP after battle rather than encoding that behavior inside the Death status object.

Battle presentation exposes active status names for both sides. Turn-based and countdown statuses include their remaining-turn value, and compact summaries collapse additional statuses behind a `+N` suffix when space is limited.

---

# 🛡️ Defensive Status Rules

Barrier and MBarrier now reduce their respective physical or magical incoming damage categories through the shared battler damage resolver. Multiple compatible incoming-damage multipliers combine multiplicatively.

Reflect redirects eligible skills at the per-target resolution layer. A skill only reflects when its canonical definition has `reflectable: true` and the current target has an active status whose effects enable `reflectableSkills`.

The initial Reflect status uses `perTarget: true` and `maxReflections: 1`. Each original target of an all-target cast therefore resolves reflection independently, while the spell's MP cost is still paid only once for the cast. A reflected skill is redirected to a random living battler on the side opposing the Reflect holder.

Reflection changes the resolved target; it does not create a second cast. The reflected effect therefore keeps the original caster, scope, power, status chances, and paid MP cost. Because the redirection happens after the player has already chosen a legal original target, the reflected destination is allowed to receive the effect even when that battler could not have been manually selected under the skill's normal ally/enemy targeting rules.

The reflection count is capped by the Reflect status that first redirects the skill. With the current one-reflection cap, a redirected skill lands on its new target even if that target also has Reflect, preventing infinite bounce loops. Skills marked `reflectable: false`, including Mirror Ward and Wardbreaker, ignore Reflect entirely.

Shield is a specialized defensive status. Its implemented damage rules are:

- Physical damage is nullified
- Incoming elemental magical damage is absorbed as HP recovery
- Recovery is capped at Max HP
- Non-elemental magical damage resolves normally

Elemental absorption occurs after the normal magic formula, elemental rate, scope power, and incoming magical-damage modifiers have produced the damage amount. The resulting elemental damage is then converted into healing. An elemental immunity rate of `0` remains immunity rather than absorption.

---

# 💎 Essence Interaction

Canonical Essence definitions live in:

```text
data/Essences.json
```

Essences connect character progression to the battle system by granting abilities and passive effects.

The initial design contains 19 Essences with all 54 current skills assigned exactly once across the Essence set.

Equipped Essences are designed to gain full battle Resonance regardless of whether one of their granted abilities was cast during that battle.

At 1500 Resonance, an Essence becomes **Mastery Ready** and stops gaining Resonance. It does not automatically become Level 5.

Completing that Essence's future Mastery Trial promotes it to Level 5 MASTERED.

The full Essence runtime, passive evaluation, battle Resonance awards, Mastery Trials, and Essence Evolution remain future implementation work.

---

# 🧬 Essence Passive Effects

Essence passives should be implemented as reusable engine behaviors rather than one-off checks for specific Essence names.

The current design includes passive concepts such as:

- Element damage bonuses
- Element status-chance bonuses
- Status-family resistance
- Skill MP refunds
- Low-HP self-status effects
- Incoming-status negation
- Physical evasion bonuses
- MP cost reduction
- Cleanse-triggered healing
- Revival bonuses
- Low-HP physical damage bonuses
- Escape recovery
- Banish chaining

Where multiple multipliers legitimately apply, the battle engine should use the documented stacking rule for that mechanic. For the current Fury and Near-Death Limit-gain design, the multipliers stack multiplicatively.

---

# 🎒 Items

Items use their own battle selection window and action sequence.

The current flow stores the selected item, closes the item window, locks battle input while the action resolves, and proceeds through the item action phases.

Item effects should ultimately follow the same architectural principle as skills and statuses: content data describes the item, while reusable runtime systems interpret its behavior.

---

# 🛡️ Defend

Defend is a battle command rather than a skill.

The current physical attack path checks whether the target is defending and reduces incoming basic physical attack damage by 50%.

As battle mechanics expand, any broader Defend interactions should be documented here and implemented in the appropriate shared battle layer.

---

# 💥 Battle Effects and Presentation

Battle resolution and battle presentation are separate responsibilities.

`BattleEffects` supports reusable effect processing.

`BattleAnimationController` coordinates visual action timing and animations.

`BattleRenderer` draws the battle state.

The battle scene can present:

- Damage popups
- Healing popups
- Misses
- Critical-hit feedback
- Weakness feedback
- Resistance feedback
- Immunity feedback
- Battle messages
- Actor and enemy hurt/defeat states

Presentation should report the result of battle logic rather than becoming the authority that decides the result.

---

# 🏆 Battle Resolution

Victory occurs when all enemies are defeated.

Defeat occurs when the party has no living battle members remaining.

Escape is a third terminal outcome when the encounter permits it.

`BattleManager` owns the authoritative finalization path. Finalization is idempotent: once a battle has produced its final result, later calls return that same result and cannot award rewards or perform post-battle restoration a second time.

## Experience Rewards

Victory totals `expReward` from every defeated enemy in the encounter. That full total is awarded once to every member of `$gameParty.battleMembers()` that participated in the battle.

This includes active party members who were defeated when victory was earned. Reserve roster members who were not in the active battle party receive no battle EXP.

Defeat and escape award no EXP. Currency, item drops, and Essence Resonance are represented in the reward result but intentionally remain zero or empty until their owning systems are implemented.

## Post-Battle State

Battle finalization deliberately restores map-safe party state:

- Defeated active battle members return at 1 HP.
- Surviving HP and MP values carry out of battle unchanged, even when battle EXP causes a level-up.
- Defending is cleared.
- Statuses with `classification.persistsAfterBattle: true` are preserved.
- Other battle statuses are removed.

The cleanup rules are data-driven, so future persistent statuses do not require special-case battle-resolution code.

## Structured Result

The originating map event receives one structured battle result through the battle completion callback. The result records the outcome, encounter identity, rewards, defeated enemies, and per-participant progression/restoration details.

Conceptually:

```text
{
  outcome: victory | defeat | escape,
  encounter: { id, name },
  rewards: { exp, currency, drops, resonance },
  defeatedEnemies: [...],
  party: [...]
}
```

`Game_Interpreter.battleResult()` exposes the latest result, and the originating event also receives it as `lastBattleResult`. This establishes the handoff point for future event branching without coupling map-event logic to the battle scene.

---

# 🤖 Enemy Turns and AI

The current engine has an enemy-turn foundation and can queue an enemy turn after the party finishes acting.

The complete Enemy AI system remains unfinished.

Future AI should be responsible for decisions such as:

- Selecting actions
- Selecting legal targets
- Responding to battle conditions
- Weighted or conditional skill use
- Boss-specific behavior

AI chooses what an enemy attempts to do. Shared battle systems should still resolve targeting legality, damage, statuses, and effects.

---

# 👹 Boss Battles

Boss scripting is planned but not yet a completed runtime system.

The battle architecture should eventually support mechanics such as:

- Phase changes
- Conditional actions
- Threshold reactions
- Unique status interactions
- Scripted battle events
- Specialized targeting behavior

Boss-specific logic should use reusable battle systems rather than duplicating the core combat engine.

---

# 🌟 Future Battle Systems

Major battle features still planned include:

- Complete Status Runtime
- Complete Essence Runtime
- Enemy AI
- Boss mechanics
- Summon Magic
- Limit Skills
- Party switching
- Dual Techniques
- Additional enemy and encounter systems
- Expanded item behavior
- Currency, item-drop, and Essence Resonance reward integration

These are planned architecture, not claims about currently completed runtime behavior.

---

# 🧱 Responsibility Rules

When adding a battle feature, ask which layer owns the responsibility.

```text
Skills.json / Statuses.json / Essences.json
    Define canonical content

Game_Battler / Game_Actor / Game_Enemy
    Own battler state and shared battler behavior

BattleManager
    Coordinates turn and action flow

BattleTargetManager
    Owns target-selection rules and current target state

BattleEffects
    Resolves reusable battle effects

BattleAnimationController
    Coordinates battle animation behavior

BattleRenderer
    Draws battle presentation

Scene_Battle
    Coordinates the complete battle scene

Windows
    Present commands, skills, items, and other player choices
```

A new mechanic should be placed in the narrowest system that truly owns it.

Avoid making `Scene_Battle` or `BattleManager` the permanent home of every new rule simply because they can access most of the battle state.

---

# 📚 Canonical Sources

Battle documentation and data have different responsibilities.

```text
data/Skills.json       Canonical skill definitions
data/Essences.json     Canonical Essence definitions
data/Statuses.json     Canonical status definitions

docs/battle_system.md  Canonical battle rules and interactions
docs/architecture.md   Engine structure and ownership
TODO.md                Unfinished development work
```

If this document disagrees with an intentionally updated canonical data file, the data file defines the content and this document should be updated.

If implementation temporarily disagrees with an agreed battle rule because that feature is unfinished, the unfinished runtime should be tracked in `TODO.md` rather than rewriting the intended rule to match incomplete code.

---

# ❤️ Battle System Philosophy

Sektor 1's battle system is not a collection of isolated spell scripts.

It is a set of reusable rules that can combine in increasingly interesting ways as the game grows.

A new skill should mostly be data.

A new status should mostly be data.

A new Essence should mostly be data.

The engine should provide the vocabulary that makes those combinations possible.

That keeps the battle system understandable today while leaving room for the strange, powerful, and wonderfully unusual things Sektor 1 may need tomorrow.

---

Built with ❤️ by **Sarah & Tyler**
