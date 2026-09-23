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

Each encounter defines its enemy members, optional formation placement, optional formation type, and whether the party may escape. Enemy IDs reference `Enemies.json`; formation metadata is validated before the game begins. Enemy Formation Rows v1 allows up to eight members. Every member defaults to the `front` row but may declare `row: "front"` or `row: "back"`. A side/row group that omits `slot` is automatically centered; a handcrafted group may give every member an explicit `slot` from 0 through 3. Mixing automatic and explicit placement inside the same side/row group is rejected so placement is deterministic. `pincer` encounters additionally require every member to declare a `left` or `right` side, and each flank receives its own front/back geometry while the total encounter cap remains eight.

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

The visible battle command foundation contains four persistent commands:

```text
Attack
Skills
Magick
Item
```

Battle Command Navigation & Side Actions v1 exposes **Escape** and **Defend** as temporary horizontal side actions rather than permanent rows. Left input from the main command list reveals only the smaller Escape panel; right input reveals only the smaller Defend panel. The opposite side remains invisible. `E` / Enter confirms the focused side action, while `Q` / Escape or movement back toward the center closes it without acting.

Escape remains governed by the encounter's existing `canEscape` contract, but escapable encounters now use a real roll. `BattleManager.escapeChance()` starts at 45%, adjusts by 2.5 percentage points for each point of living-party average Agility above/below living-enemy average Agility, adds 15 percentage points per previous failed legal attempt, and clamps the final chance to 10-95%. A failed legal attempt consumes the active party battler's turn through the normal turn controller; the retry bonus is battle-local. A non-escapable encounter can still reveal the Escape side panel, but confirming it never rolls or consumes a turn and reports `You cannot escape!`. Retreat Magick remains guaranteed in escapable encounters but respects the same absolute no-escape gate; an impossible Retreat is rejected before casting, so it spends neither MP nor the actor's turn. Defend still resolves through `BattleManager.performDefend()` and the shared action-restriction contract.

`BattleManager` interprets Attack / Skills / Magick / Item / Defend after command confirmation and now owns normal Escape probability/retry rules. `Scene_Battle` owns navigation and the final scene handoff after a successful Escape outcome. Future commands and special character mechanics should extend these boundaries without forcing unrelated command logic into rendering classes.

---

# 🎯 Targeting

Targeting is coordinated through `BattleTargetManager`.

Target cancel is hierarchical. Backing out of Attack targeting returns to the main command list. Backing out of Skill or Magick targeting reopens the selector that launched targeting and always preserves that selector's current cursor/viewport position. Game Options / Config Foundation v1 separately controls **fresh** selector entry: `Initial` resets Skills/Magick/Item lists to the first entry, while `Memory` preserves the selector's last valid cursor within the current battle. Hierarchical cancel restoration is not disabled by the global preference. Custom Controls / Input Mapping v1 does not change those navigation rules: battle input now asks for named actions (`confirm`, `cancel`, directions, `help`, `scope`) and the renderer resolves current binding labels for hints, so remapping keys changes input presentation without changing battle semantics.

The battle system currently supports concepts including:

- Ally targets
- Enemy targets
- Single targets
- All targets
- Selection of living targets
- Four-direction spatial target movement without selection wraparound at screen/formation edges
- Magick and Skills that permit more than one target group
- Magick and Skills that permit more than one target scope
- Self-only Skill targeting through the ally-side selector while only the caster remains legal
- Formation-aware All-target buckets

Battle Targeting & Scope Navigation v2 treats targeting geometry and action scope as one shared contract. For actions that support both `single` and `all`, All is offered only when the currently selected target bucket contains at least two legal battlers. This means a one-enemy battle stays Single even when the selected Magick technically supports both scopes. An intrinsically all-target action remains All even if only one legal target currently exists.

Normal and Back Attack enemy All targeting resolves against the legal enemy side. In a Pincer encounter, the left and right enemy flanks are separate All-target buckets: choosing All marks only the currently selected flank, and left/right input can switch the active flank. Single-target pincer navigation uses the same spatial movement contract, so left-side and right-side enemies can both be reached with ordinary directional input.

Action data should determine which target groups and scopes are legal. `BattleTargetManager` determines the effective scope and current target bucket; effect resolution consumes those resolved targets rather than redefining targeting rules. When a Magick permits both allies and enemies, the command flow still prefers the enemy group as the initial selection while allowing spatial movement into every legal target group.

---

# 🔎 Scan & Tactical Help

Scan & Tactical Help v1 is battle-local. `Scan` is an ordinary support Skill with `effect: "scan"`, `target: ["enemy"]`, and `scope: ["single"]`; it follows the same Skills window, spatial target selection, action restriction, turn cost, and action-phase execution as other Skills. There is no separate Scan command.

`BattleScanManager` records concrete enemy instances rather than enemy species IDs. Scanning one slime therefore does not reveal every other slime in the encounter. The information also does not persist after battle in v1, so Save Runtime remains unchanged.

Triggering the configurable **Help** action (H by default) toggles Tactical Help without spending an action. While an enemy is actively targeted, an unscanned target displays its name but shows `??/??` for HP/MP and `??` for Weak / Resist / Immune. After that target has been scanned, the same bar reads live current/max HP and MP plus elemental affinity categories derived from `elementRates`: rates above `1` are Weak, rates between `0` and `1` are Resist, and rate `0` is Immune. Neutral/unspecified elements are omitted, and an empty known category displays `None`.

The Tactical Help bar is presentation-only. It does not change damage, reveal status resistance in v1, alter target legality, or create a second weakness database. Battle UI / Presentation Polish v1 reduces the panel to a centered translucent two-line strip above the HUD while preserving the same battle-local knowledge contract and dynamic Help binding label.

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

Skills Runtime v1 established the separate non-Magick technique contract, and later passes expanded that same schema without replacing it. Current Skills use `type: "skill"`, a validated `physical` / `support` / `control` category, a `damage` / `heal` / `inflictStatus` / `valor` / `scan` effect, one or more legal `target` values (`self`, `ally`, `enemy`), and one or more legal scopes (`single`, `all`). Effect-specific metadata remains narrow: physical damage uses positive `powerMultiplier`, percentage healing uses bounded `healPercent`, reusable status application uses validated `status` chance maps, deliberate gauge support uses positive `valorGain`, and Scan uses no duplicate combat metadata at all; it reads the target's existing battle state and element rates. The canonical catalog now contains the four starter Valor Arts, Tyler's Scan support Skill, and the first enemy technique, Goo Rush.

Actor Skill ownership is separate from Magick ownership. `initialSkillIds` seed actor knowledge and runtime `skillIds` are persisted through Save Runtime v11. The old pre-Pass-29 save field named `skills` is not current Skill ownership; it remains migration-only input for historical Magick saves.

Battle Skills reuse existing combat contracts rather than defining a second combat engine. Physical-damage Skills use the normal physical hit chance and Attack-versus-Defense formula with `powerMultiplier`; resolved damage still passes through defending, physical status modifiers, damage-triggered status removal, defeated-state handling, and hostile-source Valor eligibility. Percentage-heal Skills use target Max HP through `healPercent`, while status Skills and optional damage-Skill status riders call the shared battler status application/resistance API. Skills are not Magick, do not pay MP by default, and are not reflected by Reflect. Silence therefore does not block a Skill unless a status explicitly restricts the `skill` action type; broader restrictions such as Frog's Attack-only allow list still apply through the shared action contract.

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

Fury, Sadness, and Near-Death expose their data-driven Valor modifiers through `Game_Battler.valorGainMultiplier()`. Status Runtime owns only the multiplier contract; actor-owned Valor Runtime consumes it when hostile opposing-side battle-action damage is explicitly marked as Valor-eligible.

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

Valor is an actor-owned battle resource. Passive generation occurs only when surviving direct damage is explicitly marked as coming from a hostile opposing-side battle action. Self-damage, friendly-fire, and unprovenanced/direct test damage do not generate Valor. The base gain remains proportional to actual HP lost rather than requested damage:

```text
base Valor gain = (actual HP lost / Max HP) × Max Valor
final Valor gain = base gain × combined valorGainMultiplier
```

Current actors define `maxValor: 100` in `Actors.json`. Valor may be fractional internally so many small hits accumulate accurately; Valor presentation now shows one decimal when needed so low-damage gains remain visible instead of being floored away. Gauge state is clamped between `0` and `maxValor`, persists outside battle, and is serialized by Save Runtime v11. At full gauge the actor is **Valor Ready**. Valor Arts Runtime v1 now consumes the existing full-gauge boundary through Skills while leaving gauge state and consumption ownership in `Game_Actor`.

Only actual hostile battle-action damage routed through `receiveDamage()` with `valorEligible: true` generates passive Valor. `BattleManager` derives that flag from the source and target battle sides for physical Attacks/Skills and Magick after reflection resolves. Fully nullified damage, absorbed elemental Magick, self-damage, friendly-fire, and damage that defeats the actor generate none. Damage-over-time and other HP changes that bypass the shared hostile direct-damage path also do not generate Valor. Skills may deliberately raise Valor through the explicit `effect: "valor"` + positive `valorGain` contract; this is not treated as damage.

Visual party formation order is independent from combat authority. Reordering the four active members changes their main-menu card order, battle HUD roster order, battlefield vertical positions, and the row-neutral positions used by spatial selection, but it does not change active-party membership, turn scheduling, stats, damage, range, targeting eligibility, or action priority. Front/back row preference is layered on top as visual X geometry only and is intentionally excluded from targeting heuristics and rear-damage resolution.

Derived statuses are updated before Valor is awarded. Therefore a hit that leaves an actor in Near-Death receives the Near-Death multiplier on that same hit. Fury and Near-Death stack multiplicatively, while Sadness remains mutually exclusive with Fury. Because Sadness also reduces incoming damage, it lowers Valor both by reducing actual HP loss and by applying its own `0.5` Valor multiplier.

---

# 🛡️ Defend

Defend is a battle action rather than Magick. It is reached through the temporary right-side command panel instead of occupying a permanent row in the four-command list.

The current physical attack path checks whether the target is defending and reduces incoming basic physical attack damage by 50%.

As battle mechanics expand, any broader Defend interactions should be documented here and implemented in the appropriate shared battle layer.

---

# ⚙️ Battle Configuration Hooks

Config Runtime v2 keeps player pacing and control preferences outside battle rules. **Battle Speed** scales battle-local elapsed time used by battler state timers, action phases, animation updates, visual movement, battle effects, popups, and enemy-turn delay. It does not change formulas, turn eligibility, Haste/Slow slot scheduling, or player input polling. **Battle Message Speed** uses a separate clock for transient action/state banners so banner readability can be tuned independently from animation pacing.

Battle selector cursor memory is also configuration-driven. Fresh Skills/Magick/Item entry can reset to the first entry or preserve the last valid index, while target-cancel navigation always returns to the originating selector position. Magick ordering is presentation-only and is shared by field and battle Magick windows.

# 🧭 Battle Formations

Battle Formation & Party Layout v1 supports three side-view encounter layouts:

- `normal` - party on the left, enemies on the right
- `backAttack` - party remains on the left but begins facing away from enemies
- `pincer` - the four-actor party is centered while enemies occupy explicit left/right flanks

`BattleFormationManager` owns this geometry. It places all active party members into a stable four-lane vertical stack, scales the party uniformly only when required by available battlefield height, scales oversized enemies conservatively, and provides the facing/advance direction used by battle animation. Player Battle Row Geometry v1 layers the saved party row state onto actor X presentation: Normal and Back Attack preserve the established Front line while Back actors shift away from the enemy side; Pincer assigns a stable outward flank from mechanical active-party parity, with Front stepping outward and Back remaining at party center. Target cursors, effects, popups, and sprites resolve their anchors from the visible positions, while target-selection scoring and rear-exposure combat checks deliberately use a separate row-neutral party position.

Formation owns battlefield geometry, facing, and attack/recoil direction. The only current formation-sensitive combat rule is rear exposure: enemy physical attacks deal the shared 1.5x multiplier when the party target is genuinely facing away from that attacker. Magick remains facing-neutral. Front/back enemy rows and player rows are geometry-only and do not imply row damage, protection, targeting eligibility, ranged/melee rules, stat changes, or action-order changes.

Canonical test coverage includes Encounter 3 (`backAttack`) and Encounter 4 (`pincer`), plus Encounter 5 with eight automatically centered front/back enemies and Encounter 6 with eight handcrafted pincer-row positions. All are reachable from Map001 tester events for hands-on verification. Player-row regression coverage additionally verifies Normal/Back Attack X offsets, stable Pincer flanks, visual-formation swaps, row-neutral targeting, and unchanged rear-damage behavior. Rows are presentation/geometry only: no front/back damage, targeting advantage, or ranged/melee rules are implied yet.

---

# 💥 Battle Effects and Presentation

Battle resolution and battle presentation are separate responsibilities.

`BattleEffects` supports reusable effect processing.

`BattleAnimationController` coordinates visual action timing and animations.

`BattleRenderer` draws the battle state. Skills, Magick, and Item selectors are treated as one rendered selection-window group so opening any selector suppresses the command window and cannot leave an input-active menu invisible.

Battle Presentation & Feedback v1 established contextual control hints and the read-only presentation boundary. Battle Presentation & Feedback v2 simplifies the top of the battlefield after hands-on playtesting: there is no permanent encounter/active header and no persistent battle-message panel. Meaningful actions and state events instead use a compact transient banner: Magick names, Skill names, Item names, Back Attack, Pincer Attack, boss-phase transitions, and similar state announcements. Basic Attack is intentionally excluded because animation plus floating damage already communicates it. A short queue preserves a boss/formation announcement before an immediately following action banner can replace it.

Floating battlefield feedback remains the primary result language. Damage/healing numbers, Miss, Weak, Resist, Immune, status feedback, and Critical stay above the affected battler. Critical also triggers a brief presentation-only screen flash through `BattleEffects`; it does not alter critical-damage math. Temporary action/state banners now fade in and out according to the existing Battle Message Speed clock rather than appearing/disappearing as hard cuts. Target cursors use the shared gold battle accent with a dark outline, and contextual control hints sit on a low-opacity backing so changing battlefield art cannot make them unreadable.

The bottom HUD still reserves four stable party rows, but its information hierarchy is now split into a left name roster, a dedicated middle command/status reserve, and stable right-side HP/MP/Valor columns. `Window_BattleCommand` overlays only that middle reserve while an actor owns command input. Escape and Defend appear only when horizontally requested and are flush with the main command panel's upper-left / upper-right edges. The middle reserve remains blank outside command input until real Barrier/MBarrier-style mechanics earn presentation there. `BattleHudLayout` owns only geometry; turn ownership remains in `BattlePartyController` / `BattleManager`. Battle UI / Presentation Polish v1 reduces the overall HUD height and narrows the name/command regions without changing their roles. Command focus now uses a subtle row highlight and gold accent, while Escape/Defend side tabs inherit the active command-row height so they read as attached tabs rather than separate boxes.

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

Back Attack now keeps the party on the left rather than mirroring battle sides. Party members begin facing away from enemies; targeting/action presentation can turn the acting character temporarily, rear physical hits turn the struck actor permanently, and the remaining party turns after the opening enemy round. A physical hit from an enemy positioned behind a party target receives a shared 1.5x rear-exposure multiplier. The same geometric rule works in Pincer when a party member is facing the opposite flank. Magick damage is unchanged by front/back exposure. Enemy Formation Rows v1 supports up to eight enemies through four front and four back positions, with automatic centering or explicit per-row slots. Enemy positions remain fixed for the battle after defeats; survivors do not slide into newly empty slots.

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
- **Runes:** total `gilReward` from defeated enemies, except enemies removed by Banish contribute no currency. The result is added to persistent `Game_Party` currency state; `gilReward` remains the legacy internal data key.
- **Item drops:** each defeated enemy resolves its validated `dropTable` independently. Successful rolls are aggregated by item ID and awarded through `Game_Party.gainItem()`.
- **Essence Resonance:** total `resonanceReward` from defeated enemies. Every equipped Essence on each **surviving active battle-party participant** receives the full encounter Resonance amount. Defeated participants and reserve roster members receive none.

Essence Resonance caps at the canonical Mastery threshold (1500 with the current data). Per-actor reward results report Essence level changes, awakened Magick IDs, and Mastery-Ready transitions without automatically promoting an Essence to Level 5.

## Battle Results Presentation

On victory, `Scene_Battle` finalizes the authoritative result before leaving the scene and opens `Window_BattleResults`. The window is presentation-only: it reads `scene.result` and does not recalculate EXP, reroll drops, mutate Gil, or award Resonance. This preserves the idempotent reward contract established by `BattleManager.finalizeBattle()`.

The initial results screen presents:

- Total EXP, Runes, and encounter Resonance
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
skill
```

Current target strategies are `first`, `random`, `lowestHp`, and `lowestHpRate`. Magick and Skill actions may constrain their relative target group (`ally`, `enemy`, or `self`) and legal scope (`single` / `all`) according to the referenced canonical definition. Current condition types include `always`, `selfHpBelow`, `selfHpAbove`, `allyHpBelow`, and `allyDefeated`.

Enemy Magick uses the same `Game_Battler` runtime as actor Magick. MP payment, Silence/action restrictions, damage, healing, status payloads, Reflect, elemental rules, defeated-state handling, and target legality therefore stay shared rather than being reimplemented in AI. Enemy Skills likewise reuse the canonical Skill legality, physical-damage, percentage-healing, status-application, and target-validation paths. `BattleManager.performSkillTarget()` is the shared effect-dispatch boundary used by party and enemy Skills; enemy AI only chooses the action and target set. Valor Arts remain actor-owned: `Game_Enemy` refuses their Skill cost contract and database validation rejects Valor-Art `skillId` references in enemy actions.

If every configured action is unusable, AI falls back to a normal Attack when Attack itself remains legal. Confuse still overrides ordinary target preference through the shared forced-random-target contract. The Test Slime currently demonstrates weighted Attack / Goo Rush / Ember behavior and conditionally considers Mend while below half HP. Goo Rush is the first canonical enemy Skill and applies its Slow rider through the same status runtime as actor Skills.

AI chooses what an enemy attempts to do. Shared battle systems remain responsible for mechanical legality and effect resolution.

---

# 👹 Boss Battles

Boss / Phase AI v1 is active. Bosses can define a validated `phases` array in `Enemies.json`; phased enemies use that array instead of a top-level `actions` list. Each phase declares a stable `id`, display `name`, an `hpRateAtOrBelow` threshold, an ordinary Attack/Magick/Skill action pool, and an optional `enterMessage`. The opening phase must begin at `1.0`, later thresholds must strictly decrease, and every phase action is validated through the same enemy-action contract as ordinary enemies.

Phase progression is battle-local and monotonic. `Game_Enemy.refreshPhase()` advances only forward when current HP reaches a later threshold, never rolls backward after healing, and may skip directly to a deeper phase after a large hit. `BattleManager` refreshes phase state at the start of that enemy's turn and emits the one-time entry message. `BattleEnemyAI` itself does not contain boss branches: it continues to request `enemy.actionDefinitions()`, which now returns the active phase action pool.

**Test Slime Alpha** is the first canonical phase boss. Its opening pool mixes Attack, Goo Rush, and Ember; the Pressure phase raises Goo Rush/Ember pressure and introduces Mend; the Frenzy phase drops healing and strongly favors offense. Encounter 2 is non-escapable and is reachable through the Map001 Boss Battle Tester for hands-on verification.

Advanced boss work may later add scripted transition effects, summons, environment changes, unique status interactions, specialized targeting, or encounter-level state machines. Those mechanics should extend reusable battle systems rather than duplicating the core combat engine.

---

# 🌟 Future Battle Systems

Major battle features still planned include:

- Complete Status Runtime
- Complete Essence Runtime
- Advanced enemy / boss behavior
- Advanced boss transition effects and encounter-specific mechanics
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
