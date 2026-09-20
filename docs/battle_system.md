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
- Flexible enough for unusual Magick, statuses, Essences, bosses, and future mechanics
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

Skill
skillUse → skillEffect → skillRecover → skillWait

Magick
magickCast → magickEffect → magickRecover → magickWait

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
- Magick usability
- Skill usability and relative target legality
- Active status effects and status durations

Actor-specific behavior belongs in `Game_Actor`.

Enemy-specific behavior belongs in `Game_Enemy`.

Rules that apply equally to both should normally live at the shared battler level or in an appropriate battle system.

---

# 🎮 Player Commands

The current battle command foundation supports:

```text
Attack
Skills
Magick
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
- Magick and Skills that permit more than one target group
- Magick and Skills that permit more than one target scope
- Self-only Skill targeting through the ally-side selector while only the caster remains legal

Action data should determine which target groups and scopes are legal.

The battle scene and target manager handle the player's current selection. Effect resolution should not redefine an action's targeting rules.

When a Magick permits both allies and enemies, the current Magick command flow prefers the enemy group as the initial selection while still allowing the legal target groups defined by the Magick.

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

# 🥋 Skills

Canonical non-Magick Skill definitions live in:

```text
data/Skills.json
```

Skills Runtime v1 establishes a deliberately narrow physical-technique contract. A v1 Skill has `type: "skill"`, `category: "physical"`, `effect: "damage"`, a positive `powerMultiplier`, one or more legal `target` values (`self`, `ally`, `enemy`), and one or more legal scopes (`single`, `all`). The canonical catalog intentionally begins as `[null]`; current actors begin with no learned Skills so the runtime does not invent character content before those designs are approved.

Actor Skill ownership is separate from Magick ownership. `initialSkillIds` seed actor knowledge and runtime `skillIds` are persisted through Save Runtime v9. The old pre-Pass-29 save field named `skills` is not current Skill ownership; it remains migration-only input for historical Magick saves.

Battle Skills reuse existing combat contracts rather than defining a second combat engine. Physical-damage Skills use the normal physical hit chance and Attack-versus-Defense formula with `powerMultiplier`; resolved damage still passes through defending, physical status modifiers, damage-triggered status removal, defeated-state handling, and target-side Valor generation. Percentage-heal Skills use target Max HP through `healPercent`, while status Skills and optional damage-Skill status riders call the shared battler status application/resistance API. Skills are not Magick, do not pay MP by default, and are not reflected by Reflect. Silence therefore does not block a Skill unless a status explicitly restricts the `skill` action type; broader restrictions such as Frog's Attack-only allow list still apply through the shared action contract.

Skills may target self, allies, or enemies according to their data. `self` uses the ally-side selector internally but `Game_Battler.isValidSkillTarget()` restricts the legal target to the acting battler. Healing Skills exclude already-full targets so a full-gauge Art cannot be committed when no healing target exists. Confuse removes player target authority for Skills just as it does for Attack and Magick: single-target Skills choose a random legal battler, while all-target Skills choose a random legal target group.

Character Valor Arts v1 establishes the first canonical Skill content: **Unbroken** (Tyler, high-power single-enemy damage), **Rallyheart** (Sarah, 35% Max-HP healing to all injured allies), **Wild Arc** (Aboo, all-enemy physical damage with a 60% base Darkness chance), and **Zero Lock** (G Prime, all-enemy Slow attempt). These behaviors are expressed entirely through reusable Skill metadata.

Valor Arts Runtime v1 remains the resource specialization: `valorArt: true` requires an actor to be Valor Ready and consumes the full gauge through the generic Skill-cost hook. Valor is paid only after the action still has at least one legal target, and it is paid once per committed Skill action rather than once per target. A later physical miss still spends the committed gauge. The battle and field Skills windows mark these entries with `[VALOR]`. Long-term Art unlock/progression rules remain intentionally undefined.

---

# ✨ Magick

Canonical Magick definitions live in:

```text
data/Magick.json
```

The initial Magick System v1 contains 54 Magick abilities across Restore, Attack, Indirect, and Advanced Magick categories.

Magick can describe behavior such as:

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

The engine should interpret reusable Magick properties rather than hard-code individual spell names whenever practical.

For all-target Magick, MP cost is paid once for the cast even though the effect is resolved against multiple targets. Multi-hit Magick follow the same cast-cost rule: `hits` controls the number of effect resolutions, and `randomTargetPerHit: true` rebuilds the legal target pool before each hit so defeated targets do not remain selectable when another legal target exists.

Gravity-style Magick abilities use `gravityPercent` against the target's **current HP** rather than the normal spell-power / Magic Defense formula. The resulting amount still passes through shared elemental and incoming magical-damage handling. Because the percentage is floored from current HP, the current Gravity definitions naturally stop dealing damage at the final sliver of HP rather than requiring a Magick-name exception.

Percentage-healing Magick abilities use `healPercent` against the target's maximum HP. This is the data-driven path used by Perfect Renewal's full restoration.

The `escape` effect is battle-owned: a successful cast declares the authoritative escape outcome and finalizes with no rewards. The `banish` effect routes through the canonical Death/defeat state while preserving a separate banished marker so future currency rewards can exclude Gil from that enemy without re-parsing the originating Magick.

The current battle presentation can report elemental outcomes such as:

```text
IMMUNE
WEAK
RESIST
```

based on the target's elemental interaction with the Magick.

---

# 🌐 Scope Power

Some power-based Magick support both single-target and all-target casting.

`scopePower` exists to allow the power component of a spell to change with scope without silently changing unrelated mechanics.

Status application chance is not automatically reduced merely because a Magick is cast on all targets.

This distinction is important:

> **Scope modifies the properties explicitly designed to scale with scope. It does not globally weaken every part of the Magick.**

---

# ❤️ Restore Magick and Unusual Targets

Restore Magick is intentionally capable of supporting unusual ally/enemy interactions.

Some restorative Magick may legally target enemies. This is necessary for planned undead-style interactions where healing or restorative power can become harmful to an appropriate target.

Target legality and effect interpretation are separate responsibilities.

A Magick being restorative does not automatically mean its target must be an ally.

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
- Data-driven action allowlists and blocked Magick types for status restrictions
- Shared physical and magical incoming-damage modifiers
- Shared outgoing physical-damage and physical-accuracy modifiers
- Physical-damage status-removal triggers
- Elemental magical absorption for defensive statuses
- Party and enemy status indicators during battle

Status behavior should be driven by properties in `Statuses.json` wherever practical rather than by checks for individual status names.

Battlers may optionally define `statusRates` for a specific status key and `statusFamilyRates` for a complete status family. A rate of `1.0` is normal susceptibility, values below `1.0` reduce the final application chance, values above `1.0` increase it up to the final 100% cap, and `0` grants immunity. Specific-status and family rates multiply together.

Ordinary status application uses the calling effect's base chance multiplied by the target's effective status rate. Derived statuses are not rolled or manually inflicted; the runtime evaluates them from their conditions.

Magick status payloads now route through this same runtime. `Game_Actor.useMagick()` interprets the reusable `status` object for damage Magick, pure status application, and status removal. Magick-defined base chances continue to respect target status resistance and immunity when applying a status. `allyStatusChance` can override the base chance for allied targets, and `toggleStatus` lets reversible transformations such as Small and Frog use the same Magick to apply or remove their status. Status-removal Magick abilities use their own per-status chance without being blocked by the target's resistance to receiving that status.

The runtime records the most recent per-status resolution so battle presentation can distinguish applied, refreshed, removed, resisted, immune, unchanged, and unsupported status references without hard-coding individual Magick names.

`Magick.json` still contains the legacy keys `resist` and `deathforce`, but neither is part of the approved 25-status `Statuses.json` v1 set. The runtime therefore reports those references as unsupported instead of inventing ad-hoc status behavior. They remain future design work unless they are formally added to the canonical status database.

---

# ⏳ Status Timing

Sektor 1's status architecture distinguishes multiple duration models.

Turn-based statuses expire after their defined number of battler turns. Reapplying a turn-based or countdown status refreshes its remaining turns instead of creating a duplicate runtime instance.

Until-removed statuses remain until a valid removal condition occurs. Statuses marked `removable: false` reject ordinary removal attempts, while internal runtime maintenance can still remove them when their defining condition stops being true.

Countdown statuses use a remaining-turn counter. Their countdown advances when the afflicted battler completes or forfeits that battler's turn, rather than after every global battle action. This prevents action-blocking statuses such as Paralyze from becoming permanent simply because the battler could not choose an action.

Turn-start triggers are processed for the active party member and for enemies. When the enemy sequence finishes, the first party member of the next round receives the same turn-start processing as later party members.

Haste and Slow alter how quickly battlers receive future turn slots through the shared battle scheduler. Each side accumulates fractional turn progress at its round boundary using the battler's combined `turnSpeedMultiplier`. Normal speed produces one slot per side round, Haste's `2.0` produces two, and Slow's `0.5` carries fractional progress so the battler acts every other side round after receiving an opening turn.

Turn slots are interleaved in formation order: every battler's first available slot is placed before any battler's second slot. This prevents a Hasted battler from consuming both actions consecutively ahead of otherwise-ready allies or enemies. Speed changes affect the next side schedule that is built rather than rewriting a queue that is already in progress.

Because status durations and countdowns advance when the afflicted battler completes or forfeits one of its scheduled turns, Haste naturally advances battler-relative timers more quickly while Slow advances them more slowly.

Derived statuses are evaluated from current battle conditions instead of being manually applied and removed like ordinary statuses.

Near-Death is the initial derived example and is active at or below 25% Max HP.

---

# ☠️ Status Runtime Rules

The initial status design establishes several rules that the runtime must preserve.

Poison and Dual are distinct statuses even though both belong to the damage-over-time family. Poison-specific mechanics do not automatically apply to Dual. Their current turn-start damage is resolved from each status's own `hpDamagePercent` data.

Regen and damaging-over-time statuses may coexist. Their turn-start effects resolve independently according to their own definitions.

Stop and Paralyze are intentionally distinct. Both prevent acting through the shared `canAct` runtime rule, but Stop additionally freezes personal turn progression through `effects.haltsTurnProgression`. A stopped battler receives no scheduled turn slots, does not process turn-start triggers, does not advance ordinary battler-relative status timers, and preserves any fractional Haste/Slow turn progress already accumulated. Stop's own duration advances once per side round after that round's queue is determined; when it expires, the battler resumes eligibility on the next side round rather than gaining a turn immediately in the expiration round.

Sleep and Confuse are removed when the afflicted battler actually takes physical damage. A miss or a fully nullified physical hit does not remove them. Confuse reads `effects.forceRandomTarget` through the shared battler runtime: a chosen basic Attack targets a random living battler on either side, enemy basic attacks can likewise redirect to either side, and a chosen single-target Magick selects randomly from the targets that are legal for that Magick. If a future Magick only supports all-target scope, Confuse instead chooses a random legal target group and resolves the Magick against that side. Confuse changes target authority rather than choosing a different action for the battler.

Physical combat modifiers are read from status data rather than status names. Outgoing `physicalDamageMultiplier` values affect basic physical damage, `physicalAccuracyMultiplier` values affect physical hit chance, and target-side `physicalDamageTakenMultiplier` values are applied by the shared incoming-damage resolver. This makes the damage portions of Berserk, Fury, Darkness, Frog, Small, Sadness, Barrier, and Shield reusable even while their unrelated mechanics remain separate work.

Action restrictions are resolved from status data rather than status names. `effects.allowedActions` narrows the battler to the intersection of all active allowlists, while `effects.blockedActionTypes` blocks matching Magick/action types. Frog currently uses `allowedActions: ["attack"]`, so Attack remains available while Magick, Item, and Defend are disabled. Silence uses `blockedActionTypes: ["magick"]`, so physical attacks, items, and Defend remain available while Magick actions are unusable. The battle command window dims/skips restricted commands, and the execution layer rechecks the same shared rule before resolving an action.

Forced action ownership is also data-driven. `effects.playerControl: false` removes command-window authority from the player, while `effects.forcePhysicalAttack: true` tells the battle flow to begin a basic physical attack automatically when that battler's turn starts. Berserk currently combines those fields, so a Berserked party member attacks automatically instead of opening the command window. Without Confuse, that forced attack uses the normal opposing-side target preference; when Confuse is also active, `forceRandomTarget` expands the candidate set to living battlers on either side.

Death-Sentence applies Death when its countdown expires. Slow-Numb applies Petrify when its countdown expires.

Fury and Sadness are intended to be mutually exclusive. That relationship is an engine interaction rule rather than duplicated inside each status definition.

Fury, Sadness, and Near-Death expose their data-driven Valor modifiers through `Game_Battler.valorGainMultiplier()`. Status Runtime owns only the multiplier contract; actor-owned Valor Runtime consumes it when direct incoming damage generates gauge.

Death is a battle defeat state that can be revived. Post-battle processing restores defeated party members to 1 HP after battle rather than encoding that behavior inside the Death status object.

The shared battler model distinguishes **dead** from **defeated**. `isDead()` remains the HP-zero check. `isDefeated()` is the battle-state check and is true when HP is zero or when an active status defines `effects.countsAsDefeated: true`. Death therefore reaches defeat through both HP zero and status metadata, while Petrify counts as defeated without changing the battler's HP. Battle outcome, active-turn, ordinary target-selection, defeat-presentation, and defeated-enemy reward paths use the broader defeated-state contract.

Revival is data-driven through Magick with `effect: "revive"` and a valid `revivePercent`. A normal HP-zero KO can be revived even when no Death status object is present. A revivable defeat status such as Death is removed before HP is restored. A non-revivable defeat status such as Petrify blocks revival and must instead be removed by an appropriate cleansing Magick such as Soul Cleanse. Ordinary healing does not target defeated battlers.

Battle target selection uses the same Magick-target validity contract as execution. Rekindle and Reawakening can therefore select revivable defeated allies, Soul Cleanse can select a Petrified ally because it can remove Petrify, and normal healing continues to select active battlers only. If a reflectable revival is redirected, Reflect chooses a revivable battler on the opposing side rather than a living target that cannot receive revival.

Battle presentation exposes active status names for both sides. Turn-based and countdown statuses include their remaining-turn value, and compact summaries collapse additional statuses behind a `+N` suffix when space is limited.

---

# 🛡️ Defensive Status Rules

Barrier and MBarrier now reduce their respective physical or magical incoming damage categories through the shared battler damage resolver. Multiple compatible incoming-damage multipliers combine multiplicatively.

Reflect redirects eligible Magick at the per-target resolution layer. A Magick only reflects when its canonical definition has `reflectable: true` and the current target has an active status whose effects enable `reflectableMagick`.

The initial Reflect status uses `perTarget: true` and `maxReflections: 1`. Each original target of an all-target cast therefore resolves reflection independently, while the spell's MP cost is still paid only once for the cast. Reflected Magick normally redirect to a random living battler on the side opposing the Reflect holder. Revival is the state-aware exception: a reflected revive selects a random revivable defeated battler on the opposing side so the redirected effect still has a legal revival destination.

Reflection changes the resolved target; it does not create a second cast. The reflected effect therefore keeps the original caster, scope, power, status chances, and paid MP cost. Because the redirection happens after the player has already chosen a legal original target, the reflected destination is allowed to receive the effect even when that battler could not have been manually selected under the Magick's normal ally/enemy targeting rules.

The reflection count is capped by the Reflect status that first redirects the Magick. With the current one-reflection cap, a redirected Magick lands on its new target even if that target also has Reflect, preventing infinite bounce loops. Magick marked `reflectable: false`, including Mirror Ward and Wardbreaker, ignore Reflect entirely.

Shield is a specialized defensive status. Its implemented damage rules are:

- Physical damage is nullified
- Incoming elemental magical damage is absorbed as HP recovery
- Recovery is capped at Max HP
- Non-elemental magical damage resolves normally

Elemental absorption occurs after the normal Magick formula, elemental rate, scope power, and incoming magical-damage modifiers have produced the damage amount. The resulting elemental damage is then converted into healing. An elemental immunity rate of `0` remains immunity rather than absorption.

---

# 💎 Essence Interaction

Canonical Essence definitions live in:

```text
data/Essences.json
```

Essences connect character progression to the battle system by granting abilities and passive effects.

The initial design contains 19 Essences with all 54 current Magick abilities assigned exactly once across the Essence set.

Equipped Essences are designed to gain full battle Resonance regardless of whether one of their granted abilities was cast during that battle.

At 1500 Resonance, an Essence becomes **Mastery Ready** and stops gaining Resonance. It does not automatically become Level 5.

Completing that Essence's future Mastery Trial promotes it to Level 5 MASTERED.

Battle Resonance awards and persistent Essence progression are active. Essence Equipment & Menu v1 adds data-driven actor slots and preserves Resonance when an Essence is unequipped. The remaining Essence Runtime work is long-term acquisition / ownership rules, ability availability, passive evaluation, Mastery Trials, and Essence Evolution.

---

# 🧬 Essence Passive Effects

Essence passives should be implemented as reusable engine behaviors rather than one-off checks for specific Essence names.

The current design includes passive concepts such as:

- Element damage bonuses
- Element status-chance bonuses
- Status-family resistance
- Magick MP refunds
- Low-HP self-status effects
- Incoming-status negation
- Physical evasion bonuses
- MP cost reduction
- Cleanse-triggered healing
- Revival bonuses
- Low-HP physical damage bonuses
- Escape recovery
- Banish chaining

Where multiple multipliers legitimately apply, the battle engine should use the documented stacking rule for that mechanic. For the current Fury and Near-Death Valor-gain design, the multipliers stack multiplicatively.

---

# 🎒 Items

Items use their own battle selection window and action sequence.

The current flow stores the selected item, closes the item window, locks battle input while the action resolves, and proceeds through the item action phases.

Item effects should ultimately follow the same architectural principle as Magick and statuses: content data describes the item, while reusable runtime systems interpret its behavior.

---

# 🔥 Valor

Valor is an actor-owned battle resource generated by surviving direct incoming damage. The base gain is proportional to actual HP lost rather than requested damage:

```text
base Valor gain = (actual HP lost / Max HP) × Max Valor
final Valor gain = base gain × combined valorGainMultiplier
```

Current actors define `maxValor: 100` in `Actors.json`. Valor may be fractional internally so many small hits accumulate accurately; the HUD displays whole-number progress. Gauge state is clamped between `0` and `maxValor`, persists outside battle, and is serialized by Save Runtime v9. At full gauge the actor is **Valor Ready**. Valor Arts Runtime v1 now consumes the existing full-gauge boundary through Skills while leaving gauge state and consumption ownership in `Game_Actor`.

Only actual direct damage routed through `receiveDamage()` generates Valor in v1. Fully nullified damage, absorbed elemental Magick, and damage that defeats the actor generate none. Damage-over-time and other HP changes that bypass the shared direct-damage path also do not generate Valor unless a future design explicitly extends that contract.

Derived statuses are updated before Valor is awarded. Therefore a hit that leaves an actor in Near-Death receives the Near-Death multiplier on that same hit. Fury and Near-Death stack multiplicatively, while Sadness remains mutually exclusive with Fury. Because Sadness also reduces incoming damage, it lowers Valor both by reducing actual HP loss and by applying its own `0.5` Valor multiplier.

---

# 🛡️ Defend

Defend is a battle command rather than a Magick.

The current physical attack path checks whether the target is defending and reduces incoming basic physical attack damage by 50%.

As battle mechanics expand, any broader Defend interactions should be documented here and implemented in the appropriate shared battle layer.

---

# 💥 Battle Effects and Presentation

Battle resolution and battle presentation are separate responsibilities.

`BattleEffects` supports reusable effect processing.

`BattleAnimationController` coordinates visual action timing and animations.

`BattleRenderer` draws the battle state. Skills, Magick, and Item selectors are treated as one rendered selection-window group so opening any selector suppresses the command window and cannot leave an input-active menu invisible.

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

Victory occurs when all enemies are defeated under the shared `isDefeated()` contract. This includes status-defined defeat such as Petrify, not only HP-zero enemies.

Defeat occurs when the party has no active, non-defeated battle members remaining.

Escape is a third terminal outcome when the encounter permits it.

`BattleManager` owns the authoritative finalization path. Finalization is idempotent: once a battle has produced its final result, later calls return that same result and cannot award rewards or perform post-battle restoration a second time.

## Battle Rewards

Victory totals `expReward` from every defeated enemy in the encounter. That full total is awarded once to every member of `$gameParty.battleMembers()` that participated in the battle.

This includes active party members who were defeated when victory was earned. Reserve roster members who were not in the active battle party receive no battle EXP.

Defeat and escape award no battle rewards. Victory resolves every reward exactly once through the same idempotent finalization path:

- **EXP:** total `expReward` from every defeated enemy; awarded in full to every active battle-party participant, including defeated participants.
- **Gil:** total `gilReward` from defeated enemies, except enemies removed by Banish contribute no Gil. The result is added to persistent `Game_Party` currency state.
- **Item drops:** each defeated enemy resolves its validated `dropTable` independently. Successful rolls are aggregated by item ID and awarded through `Game_Party.gainItem()`.
- **Essence Resonance:** total `resonanceReward` from defeated enemies. Every equipped Essence on each **surviving active battle-party participant** receives the full encounter Resonance amount. Defeated participants and reserve roster members receive none.

Essence Resonance caps at the canonical Mastery threshold (1500 with the current data). Per-actor reward results report Essence level changes, awakened Magick IDs, and Mastery-Ready transitions without automatically promoting an Essence to Level 5.

## Battle Results Presentation

On victory, `Scene_Battle` finalizes the authoritative result before leaving the scene and opens `Window_BattleResults`. The window is presentation-only: it reads `scene.result` and does not recalculate EXP, reroll drops, mutate Gil, or award Resonance. This preserves the idempotent reward contract established by `BattleManager.finalizeBattle()`.

The initial results screen presents:

- Total EXP, Gil, and encounter Resonance
- Aggregated item drops
- Per-participant EXP
- Character level-up transitions
- Equipped-Essence Resonance gains
- Essence level-up transitions
- Newly awakened Essence Magick
- Mastery Ready transitions

Long progression output scrolls inside the results panel while the battle scene remains visible underneath. `E` / `Enter` confirms the results and completes the existing callback / scene-pop handoff to the originating map event. Defeat and escape retain their existing no-reward completion behavior.

## Post-Battle State

Battle finalization deliberately restores map-safe party state:

- Defeated active battle members return at 1 HP, including participants whose defeat came from a temporary `countsAsDefeated` status such as Petrify.
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

Enemy Actions & AI v1 is data-driven through each enemy's `actions` list in `Enemies.json`. Ordinary enemy turns no longer assume a basic physical attack: `BattleEnemyAI` filters unusable actions, checks conditions, chooses by positive weights, and selects a legal target through the configured strategy.

Current action types are:

```text
attack
magick
```

Current target strategies are `first`, `random`, `lowestHp`, and `lowestHpRate`. Magick actions may constrain their relative target group (`ally`, `enemy`, or `self`) and legal scope (`single` / `all`) according to the referenced Magick definition. Current condition types include `always`, `selfHpBelow`, `selfHpAbove`, `allyHpBelow`, and `allyDefeated`.

Enemy Magick uses the same `Game_Battler` runtime as actor Magick. MP payment, Silence/action restrictions, damage, healing, status payloads, Reflect, elemental rules, defeated-state handling, and target legality therefore stay shared rather than being reimplemented in AI. If every configured action is unusable, AI falls back to a normal Attack when Attack itself remains legal. Confuse still overrides ordinary target preference through the shared forced-random-target contract.

The Test Slime currently demonstrates weighted Attack / Ember behavior and conditionally considers Mend while below half HP.

AI chooses what an enemy attempts to do. Shared battle systems remain responsible for mechanical legality and effect resolution.

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
- Advanced enemy / boss behavior
- Boss mechanics
- Summon Magick
- Party switching
- Dual Techniques
- Additional enemy and encounter systems
- Expanded item behavior

These are planned architecture, not claims about currently completed runtime behavior.

---

# 🧱 Responsibility Rules

When adding a battle feature, ask which layer owns the responsibility.

```text
Magick.json / Statuses.json / Essences.json
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
    Present commands, Magick, items, and other player choices
```

A new mechanic should be placed in the narrowest system that truly owns it.

Avoid making `Scene_Battle` or `BattleManager` the permanent home of every new rule simply because they can access most of the battle state.

---

# 📚 Canonical Sources

Battle documentation and data have different responsibilities.

```text
data/Magick.json       Canonical Magick definitions
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

A new Magick should mostly be data.

A new status should mostly be data.

A new Essence should mostly be data.

The engine should provide the vocabulary that makes those combinations possible.

That keeps the battle system understandable today while leaving room for the strange, powerful, and wonderfully unusual things Sektor 1 may need tomorrow.

---

Built with ❤️ by **Sarah & Tyler**
