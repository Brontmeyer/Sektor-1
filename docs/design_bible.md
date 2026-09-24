# 📖 Sektor 1 Design Bible

This document defines the design identity of Sektor 1.

It exists to answer a question deeper than how the engine works:

> **What makes Sektor 1 feel like Sektor 1?**

Architecture explains where systems belong. Battle documentation explains how combat rules behave. Coding style explains how the project is written.

The Design Bible protects the ideas underneath all of them.

It records established design principles and terminology without pretending unfinished story, world, character, or progression details have already been decided.

---

# 🌌 Game Identity

Sektor 1 is a modern JRPG built from scratch in JavaScript and inspired by classic turn-based JRPG design.

Its identity comes from combining familiar RPG foundations with a custom engine and original systems that can interact in increasingly unusual ways.

The goal is not to reproduce one existing RPG.

The goal is to understand what makes classic systems satisfying, then build a game whose mechanics develop their own vocabulary, relationships, and surprises.

Sektor 1 should feel understandable at first glance and deeper the longer the player experiments with it.

---

# 🧭 Core Design Pillars

## Familiar Foundations, Original Combinations

Players should recognize the language of a classic JRPG: party members, enemies, turns, physical attacks, Magick, items, equipment, elements, statuses, progression, bosses, towns, dungeons, and exploration.

Sektor 1 can then use those familiar foundations to create its own combinations through Essences, unusual targeting, status interactions, Mastery, future Evolution, and character-specific mechanics.

Familiarity is the doorway, not the destination.

## Systems Should Interact

Mechanics become more interesting when they affect one another.

A status should not exist only as an icon. An Essence passive should not exist only as a percentage buried in a menu. Targeting rules should matter because unusual interactions make them useful.

Whenever practical, new mechanics should connect to the game's existing vocabulary rather than forming isolated islands.

## Data Creates Possibility

Magick, Essences, statuses, enemies, and other content should be expressible through reusable rules wherever practical.

This is both an engineering principle and a design principle.

A reusable rule creates future design space.

If the engine understands elemental absorption, countdown effects, derived states, status families, multiple hits, scope-dependent power, and unusual target groups, future content can recombine those ideas without requiring an entirely new combat engine each time.

## Complexity Should Earn Its Place

Sektor 1 can become deep without becoming needlessly obscure.

A mechanic should create a meaningful choice, interaction, strategy, discovery, or emotional payoff.

Complexity that exists only to make a system look sophisticated should be questioned.

## Growth Should Feel Meaningful

Progression should change what the player can do, not merely inflate numbers.

The Essence system expresses this especially strongly through ability unlocks, passives, Resonance, Mastery Ready, Mastery Trials, and eventual Essence Evolution.

Growth should reveal possibilities.

---

# ⚔️ Battle Identity

Sektor 1 uses a custom side-view, turn-based battle system.

Battle should reward understanding the relationships between:

- Party composition
- Magick
- Elements
- Status effects
- Targeting
- Equipment
- Essences
- Passive effects
- Enemy behavior
- Future character-specific mechanics

The battle system should support straightforward play while leaving room for players who enjoy discovering stronger or stranger combinations.

Not every battle needs to be a puzzle. The underlying systems should nevertheless be coherent enough that clever use of them feels intentional rather than accidental.

Canonical mechanical rules belong in `docs/battle_system.md`.

---

# 🔥 Valor Identity

Valor represents a character's ability to turn battle pressure into decisive potential. It is not Magick, Essence Resonance, or a renamed copy of another game's special gauge. It belongs to Sektor 1's non-Magick character-combat identity.

Valor should reward surviving hostile danger rather than merely waiting or exploiting self/friendly damage. Only opposing-side battle-action damage is eligible for passive gain, and the gauge still grows in proportion to the percentage of Max HP actually lost. Fury accelerates that response, Sadness suppresses it, and Near-Death intensifies it. These interactions make emotional and critical states part of the same pressure-response language without hard-coding individual status names into the gauge. Skills that deliberately raise Valor use an explicit Valor effect rather than pretending to deal damage.

A full Valor gauge means the actor is **Valor Ready**. **Valor Arts Runtime v1** consumes that readiness through the established Skills side of the combat vocabulary: a Skill marked `valorArt: true` requires a full gauge and spends it once when the action is committed against at least one legal target. Character Valor Arts v1 now gives the four current actors distinct first mechanical signatures without making battle code branch on their names; future unlock/progression rules and later Arts remain open design space.

---

# 🥋 Skills Identity

Skills represent deliberate non-Magick techniques: physical, technical, tactical, or character-specific actions that should not inherit spell identity merely because they are selectable battle abilities. The namespace is intentionally separate from Essence-linked Magick.

Skills Runtime v1 established that identity before populating the catalog. Character Valor Arts v1 first expanded the reusable Skill vocabulary for physical damage, percentage healing, and status application; Valor & Escape Rules v1 adds a narrow explicit Valor-gain effect for future techniques that intentionally manipulate the gauge. That does not imply every future Skill must fit those effects or use Valor; new effects and resource models should still be added only when approved designs need them.

**Valor Arts** belong here. Valor Arts Runtime v1 treats them as special Skills that consume Valor readiness through the existing Valor API rather than spawning a third unrelated ability engine. `Game_Actor` owns the Valor-specific cost behavior while the shared Skill runtime remains resource-agnostic. The first canonical set is **Unbroken** (Tyler), **Rallyheart** (Sarah), **Wild Arc** (Aboo), and **Zero Lock** (G Prime). These establish mechanical signatures, not a complete final character canon.

---

# ✨ Magick Identity

Magick is not intended to be only a ladder of progressively larger damage numbers.

The initial 54 Magick abilities establish four major categories:

```text
Restore Magick
Attack Magick
Indirect Magick
Advanced Magick
```

Summon Magick is a future Magick category. **Skills** is the separate non-Magick technique namespace and is now the canonical home of Valor Arts.

The Magick system should support:

- Direct damage
- Restoration
- Status manipulation
- Transformation
- Battlefield control
- Defensive effects
- Multi-target decisions
- Unusual ally/enemy interactions
- High-impact advanced abilities

A spell's identity can come from what it changes, not merely how much HP it removes.

---

# 🎯 Targeting as Design Space

Targeting is part of a Magick's design rather than a menu afterthought.

Sektor 1 supports Magick that can distinguish between:

```text
Ally / Enemy
Single / All
```

Some Magick may permit unusual combinations, including restorative abilities that can legally target enemies.

This creates room for mechanics such as planned undead restorative damage and other future interactions where the meaning of an effect depends on the target.

The design principle is:

> **Target legality and effect interpretation are separate decisions.**

Do not unnecessarily restrict a Magick's targeting merely because its most common use suggests one obvious target.

---

# 🧪 Status Identity

Statuses are a major part of Sektor 1's battle vocabulary.

Status System v1 defines 25 initial statuses:

```text
Poison
Regen
Barrier
MBarrier
Reflect
Haste
Slow
Stop
Paralyze
Sleep
Confuse
Silence
Petrify
Death
Berserk
Fury
Sadness
Darkness
Frog
Small
Death-Sentence
Slow-Numb
Near-Death
Dual
Shield
```

The goal is not simply to reproduce a checklist of classic status effects.

The system is designed so statuses can express reusable concepts such as damage over time, healing over time, control, transformation, countdowns, derived states, defensive modifiers, action restrictions, and elemental absorption.

Different statuses may deliberately share a family without becoming identical.

Poison and Dual are an important example. Both belong to the damage-over-time family, but Poison-specific mechanics do not automatically affect Dual.

This allows the game to have relationships without erasing individuality.

---

# ⏳ Time and Status Design

Time-related statuses should affect the battler experiencing them rather than behaving like disconnected global counters.

Countdown statuses such as Death-Sentence and Slow-Numb advance when the afflicted battler completes a turn.

This means Haste and Slow can naturally influence countdown pacing through the battler's turn progression.

Derived states such as Near-Death are different again. They exist because the battler currently satisfies a condition rather than because something manually applied a timer.

The broader principle is:

> **Use the duration model that expresses the fantasy and gameplay of the effect.**

---

# 💎 Essence Identity

Essences are one of Sektor 1's defining progression systems.

The initial Essence System contains 19 Essences:

```text
Healing
Purity
Renewal
Flame
Ice
Lightning
Earth
Poison
Gravity
Mind
Metamorph
Time
Ward
Null
Astral
Wind
Fury
Wayfarer
Rift
```

All 54 current Magick abilities are assigned exactly once across the 19 Essences.

Essences are not merely containers for spells.

They are intended to grow with the player, unlock abilities, awaken passive effects, reach Mastery Ready, undergo Mastery Trials, and eventually participate in Essence Evolution.

An Essence should develop an identity through the combination of:

```text
Theme
Abilities
Passive behavior
Progression
Mastery Trial
Future evolution possibilities
```

---

# 💍 Conventional Equipment

Each actor currently has three conventional equipment slots:

```text
Weapon
Armor
Accessory
```

Accessories are a distinct data-driven equipment category rather than a special-case item. Accessories Equipment v1 gives each actor one accessory slot and supports additive Attack, Defense, Magic Attack, Magic Defense, and Critical bonuses. More exotic accessory behavior such as status resistance, elemental rules, or Essence interaction should be added only when those effects have an approved runtime contract.

Equip Menu Presentation & Stat Preview v1 presents conventional gear through full **Weapon / Armor / Accessory** labels and previews candidate gear using the actor's real derived-stat methods before mutation. The comparison surface includes Attack, Attack %, Defense, Defense %, Magic Attack, Magic Defense, Magic Defense %, and Critical. An **Essence Growth** row is reserved for future gear interaction and currently reads `Normal`; no Resonance multiplier exists until a dedicated equipment-growth contract is implemented.

Item Menu Presentation & Inventory Navigation v1 keeps **Item** as a direct main-menu destination rather than an actor-picked command, but it adopts the same full-screen presentation family as the other menu surfaces. The screen uses **Use / Arrange / Key Items** tabs above the item-side pane, leaving the actor side free for four complete LV / status / HP / MP cards; the actor/item divider spans the full lower-content height. Use follows a strict interaction ladder: opening ITEM focuses the **Use** heading only; Confirm enters the item list; confirming an item records that item as the pending choice and then enters target selection; successful use returns to the item list. Cancel reverses exactly one level. The pending item must stay visibly identified while target focus is active, and the metadata/description surfaces repeat the item, quantity, and target so the player never has to infer the choice from inventory loss. Arrange is limited to the inventory sort behaviors the engine actually supports (`Default`, `Name`, `Most`, `Least`), and applying an order returns focus to the Arrange heading. Focus uses the same dim selection rectangle plus gold `▶` cursor language used throughout the project. Reference-only categories such as Field/Battle/Throw remain omitted until the runtime can justify them. Key Items presentation may exist ahead of canonical key-item content, but an empty inventory must say so plainly.

Character-menu geometry is a shared presentation contract rather than a per-window aesthetic choice. MAGICK, SKILL, ESSENCE, EQUIP, STATUS, VALOR, and ITEM use one outer header/metadata geometry helper; EQUIP and ESSENCE intentionally meet at the same center split in their lower two-panel layouts, while other screens remain free to divide lower content according to their mechanic. SAVE follows the same visual family but is slot-owned rather than actor-owned. Save presentation may summarize information already present in Save Runtime data, but it must not fabricate play time, silently mutate the save schema, or duplicate persistence authority outside `SaveManager`. Mature menu destinations should not reserve permanent footer space for ordinary key legends once focus and controls are visually obvious; contextual instructions remain appropriate for uncommon stateful interactions such as rebinding, RGB editing, shops, results, and dialogue progression.

Field dialogue and choices belong to the same configurable window family as menus. `Window_Message` and `Window_Choice` should request semantic tintable panel roles from `UIAssetManager`, allowing Config Window Color to affect conversations without making dialogue own palette data. Choice selection follows the same dim-row + gold `▶` focus language as the menus. Dialogue continuation uses a mint-teal `▼` instead of permanent input text: blink means more consecutive text from the same speaker, solid means a deliberate/end pause, and choices suppress it. Typewriter timing and choice input ownership remain runtime concerns rather than presentation rules.

Owned accessories live in party inventory, while the equipped accessory ID belongs to the actor. Equipment changes must continue through actor equip / unequip APIs rather than direct field mutation.

---

# 💰 Shops and Runes

**Runes** are the player-facing purchase currency. Battle rewards feed the existing persistent party currency runtime, and Shops & Runes Spending v1 lets map merchants exchange those Runes for Items, Weapons, Armor, and Accessories. The older `gil` method/field naming remains an internal compatibility detail until a deliberate runtime rename is worthwhile.

Merchant event data chooses **what is offered**, not **what it costs**. Price authority stays on the canonical merchandise record in its database, preventing a Potion or Steel Sword from accidentally acquiring conflicting prices in different map events. Buy and Sell transactions are owned by `Game_Party` so currency and inventory mutation succeed or fail together.

Shop identity is explicit event data rather than inferred from stock. `shopType` may be `general`, `item`, `weapon`, `armor`, or `accessory`; specialized shops buy and sell only the matching category, while general stores may mix categories. The current economy contract uses unlimited merchant stock and quantity-aware purchases. Sale value is 50% of canonical purchase price. Equipment copies currently assigned to roster members are reserved from sale, but surplus copies remain available; a merchandise record may additionally declare `sellable: false` for future key/protected content. `Window_Shop` may explain and preview these rules, but it must never become their authority. Limited stock, discounts, reputation pricing, and other economy modifiers remain future design work.

---

# 💠 Essence Equipment

Current playable actors have **3 Essence slots**, with the count defined in actor data so later characters can differ without changing menu or runtime code.

An actor cannot equip the same Essence definition in more than one of their own slots at the same time. Slot assignment and Essence progression are separate: removing an Essence from a slot does **not** erase its Resonance, level, or Mastery Ready progress.

Essence Equipment & Menu v1 exposes the complete canonical Essence catalog because acquisition / ownership rules have not yet been established as canon. When those rules are designed, they should filter which Essences appear as equippable without changing the underlying slot or progression contracts.

---

# 🌱 Resonance

Equipped Essences gain full battle Resonance regardless of whether one of their abilities was cast during the battle.

This is intentional.

Resonance represents growth through being carried into battle and participating in the character's journey, not a requirement to repeatedly spam one particular ability.

The established progression thresholds are:

```text
Level 1       0 Resonance
Level 2     100 Resonance
Level 3     300 Resonance
Level 4     700 Resonance
Mastery    1500 Resonance
```

At 1500 Resonance, the Essence becomes **Mastery Ready** and caps.

It does **not** automatically become Level 5.

This distinction is central to the system.

---

# 👑 Mastery

Mastery is meant to be an accomplishment rather than another automatic experience threshold.

When an Essence reaches 1500 Resonance, the player receives a cryptic indication that something has changed.

The game should not immediately turn Mastery into a giant quest-marker checklist.

Each Essence can eventually have its own **Mastery Trial**.

Completing that trial promotes the Essence to:

> **Level 5 · MASTERED**

The Mastery Trial gives the Essence's progression a gameplay or narrative climax rather than allowing the final level to arrive silently through arithmetic.

Until the quest system exists, Mastery quest IDs remain intentionally unassigned.

---

# 🌠 Essence Evolution

Mastered Essences are intended to become eligible for a future Essence Evolution system.

The detailed recipes and combinations are not yet designed and should not be treated as canonical until they are deliberately established.

The current principle is that Evolution should build on mastery rather than replace it.

Original mastered Essences are not intended to be consumed simply to create an evolution.

Evolution should expand the player's possibility space rather than punish completion by deleting the progress that enabled it.

---

# 🧬 Passive Design

Essence passives are an important part of Essence identity.

Passives should generally interact with existing battle vocabulary rather than exist as disconnected bonuses.

Current passive concepts include interactions with:

- Elements
- Status chance
- Status families
- MP costs and refunds
- Low-HP conditions
- Status negation
- Evasion
- Cleansing
- Revival
- Physical damage
- Escape
- Banish behavior

Level 4 is generally the point where an Essence awakens its unique passive.

A passive should help make the Essence feel different even when two Essences grant abilities of similar numerical strength.

---

# 🔗 Stacking and Combination

Sektor 1 should allow mechanics to combine when their rules legitimately overlap.

The player should be rewarded for understanding those relationships.

For example, the current design allows Fury and Near-Death Valor-gain multipliers to stack multiplicatively, producing a ×4 result when both conditions apply.

This is not a universal rule that every modifier must multiply.

Each category of modifier should have a documented stacking rule when ambiguity becomes possible.

The design goal is predictable depth rather than accidental arithmetic.

---

# 🧟 Exceptions Should Create Gameplay

Exceptions are valuable when they create strategy.

Examples already present in the design include:

- Restore Magick being allowed to target enemies for future undead interaction
- Shield converting elemental magical damage into healing while leaving non-elemental Magick normal
- Frog restricting actions without becoming identical to Stop or Paralyze
- Poison and Dual sharing a family without sharing every interaction
- Near-Death being derived rather than cleansable
- Death-Sentence and Slow-Numb using battler-relative countdowns

These are good exceptions because they create meaningful behavior.

Exceptions that exist only because two implementations accidentally disagree should be treated as bugs, not lore.

---

# 👥 Party Design

Sektor 1 is designed around a multi-character party rather than a permanently single-character battle model.

The engine already contains the foundation for multiple party members and a party turn queue.

Future character design should make party composition matter through differences in abilities, equipment, statistics, Essences, Valor Arts, and other character-specific mechanics as those systems are designed.

Characters should ideally create different tactical possibilities rather than feeling like identical stat containers with different portraits.

Detailed character identities, personalities, backstories, and final combat roles are not defined in this document until they become canonical.

---

# 👹 Enemy and Boss Design

Enemies should eventually interact with the same battle vocabulary the player learns.

An enemy can become interesting through behavior, resistances, weaknesses, status relationships, target priorities, or combinations of familiar mechanics rather than through inflated HP alone.

Bosses should be able to introduce additional structure such as phases, threshold reactions, conditional actions, and specialized mechanics.

Boss encounters should use the reusable battle engine wherever possible so their unusuality feels like the system being pushed creatively rather than the rules being discarded.

Enemy Actions & AI v1 lets ordinary enemies express weighted and conditional combat personalities through data, and Enemy Skills & AI Integration v1 lets those action lists use the same canonical non-Magick Skills vocabulary as the party. The first enemy technique, Goo Rush, is a normal `Skills.json` record rather than bespoke slime logic. Actor-owned Valor Arts remain unavailable to enemies, preserving the resource boundary while still sharing damage/healing/status execution. Boss / Phase AI v1 now adds monotonic HP-threshold phases whose only special responsibility is choosing which ordinary action pool is active. Test Slime Alpha is the first canonical example. More elaborate transition effects and encounter-specific boss mechanics remain future extensions of that foundation.

---

# 🌎 World and Exploration

World exploration, towns, dungeons, side quests, event scripting, cutscenes, and the story campaign are planned parts of Sektor 1.

Their detailed design is not yet established enough to canonize here.

When those systems are designed, they should support the same broader philosophy as battle:

- Exploration should reward curiosity
- Locations should have gameplay identity as well as visual identity
- Progression should create new possibilities
- Systems should reinforce the world rather than feel detached from it

Unapproved concepts belong in `docs/ideas.md` until they are intentionally promoted into canonical design.

---

# 🎭 Story and Characters

Sektor 1's detailed story, cast, themes, cultures, factions, and world history should only enter this Design Bible when they have been deliberately established.

This document should not invent canon merely to fill empty headings.

When story canon grows, the Design Bible can record durable principles and established facts while more detailed narrative material can live in dedicated documents if needed.

A useful rule is:

> **Empty canon is better than fake canon.**

---

# 🎨 Presentation

Sektor 1 currently uses a side-view battle presentation and HTML5 Canvas rendering.

Visual and audio identity should reinforce readability first. Players need to understand targets, damage, healing, critical hits, weaknesses, resistances, immunities, status changes, and battle outcomes without fighting the interface. Tactical Help follows the same principle: it is optional rather than permanently occupying the battlefield, unknown enemy information stays visibly unknown, and Scan reveals information already owned by combat data instead of inventing a separate UI-only truth. Scan knowledge is battle-local in v1 and applies to the specific enemy instance analyzed.

Side-view formation should preserve that readability with four active actors. The canonical layout foundation uses a stable vertical party stack and reusable `normal`, `backAttack`, and `pincer` encounter formations. Pass 46 deliberately adds one mechanical consequence instead of inferring one silently: when an enemy physically attacks a party member from behind, rear exposure multiplies physical damage by 1.5. Magick is unchanged by facing. Back Attack keeps the party on the left facing away at battle start; Pincer derives exposure from which flank each actor currently faces. Enemy Formation Rows v1 allows up to eight enemies in four front and four back positions. Rows are deliberately spatial only for now: they may be auto-centered or handcrafted per encounter, but no row penalty, protection, melee restriction, or ranged advantage exists until weapon/Skill range contracts are intentionally designed.

Battle feedback should make the current interaction state legible without turning presentation into gameplay authority. The current direction deliberately keeps the upper battlefield empty during ordinary idle/Attack flow. Compact transient banners appear only for meaningful action names or state announcements, while damage numbers and Weak/Resist/Immune/Critical feedback remain spatially attached to battlers.

The current HUD direction favors a polished, soft-framed Sektor 1 JRPG presentation rather than reproducing another game's window language or leaving raw programmer rectangles as final art. Four party members receive stable rows with names on the left, a middle reserve for command/defensive presentation, and HP/MP/Valor on the right. Resource identity is intentionally stable across screens: **HP is blue-cyan, MP is green, and Valor is magenta-purple**. Resource labels and gauge fills carry that identity while live current/max values stay neutral white for quick reading; Valor Ready brightens the Valor label/gauge within the same family while its READY value remains white. The command panel overlays the middle reserve only during player command input; future Barrier/MBarrier-style indicators can use that space once those mechanics are intentionally implemented. Battle UI / Presentation Polish v1 tightens those proportions and favors translucent information surfaces with gold focus accents. Asset / UI Skinning Foundation v1 keeps the visual language authoritative even when imported art is available: curated assets are ingredients, not permission to turn Sektor 1 into a stock RPG Maker skin. UI Style Integration Prototype v1 deliberately tests softer beveled blue-gray frames, neutral menu panels, subtle button-backed selection rows, and capsule gauge borders while leaving all source art swappable. Menu Window Softening & Frame Polish v1 pushes that language toward gentler JRPG window silhouettes through rounded clipping, restrained depth/shadow, and inset highlights rather than hard rectangular outlines. Image-backed frames, portraits, icons, gauges, and effects may continue to replace vector placeholders gradually as long as the same layout/ownership contracts and fallbacks remain intact.

Escape should be a tactical decision rather than a free scene exit. Escapable encounters use party-versus-enemy Agility plus battle-local retry pressure; a failed legal Escape attempt costs the active actor's turn, while boss/no-escape encounters never roll. Guaranteed escape effects may exist as explicit abilities, but they still respect the encounter's absolute no-escape gate.

The core battle command presentation should stay compact. The persistent list is Attack, Skills, Magick, and Item; Escape and Defend are contextual horizontal side actions that remain hidden until the player deliberately requests them. Back navigation should move one interaction level at a time so choosing a Skill or Magick, entering target selection, and backing out returns to the originating selector instead of discarding navigation context.

Style can become expressive without sacrificing information.

Detailed final art direction, UI language, animation standards, music direction, and audio identity remain open design areas until deliberately established.

---

# 🔍 Discovery

Not every system needs to explain its deepest possibility immediately.

The Essence Mastery design already establishes one example: reaching Mastery Ready should produce a cryptic message rather than an enormous marker telling the player exactly where to go and what to do.

Sektor 1 should leave room for discovery where discovery is enjoyable.

The player should be able to understand the rules needed to make informed decisions while still having interactions, combinations, secrets, and progression moments worth uncovering.

Mystery should invite experimentation, not require guessing basic controls. Player preferences should follow the player rather than a particular save slot: pacing, message presentation, cursor behavior, ordering choices, and control bindings belong to configuration state. Input hints should follow the player’s current bindings instead of teaching stale defaults. Functional settings should connect to real runtime behavior before final UI skinning is treated as complete.

---

# ⚖️ Balance Philosophy

Balance should protect meaningful choices rather than force every option to produce identical numbers.

Different abilities can be strong for different reasons:

```text
Damage
Efficiency
Reliability
Target flexibility
Status utility
Defense
Tempo
Synergy
Recovery
Risk / reward
```

A strange Magick does not need to compete with a direct-damage spell on raw damage alone.

Likewise, a powerful combination is not automatically a problem if it requires meaningful setup, investment, timing, or discovery and does not erase the rest of the game's decision space.

Exact numerical balance will evolve through implementation and testing.

---

# 🧪 Experimental Ideas vs Canon

Sektor 1 needs somewhere to be messy.

That place is:

```text
docs/ideas.md
```

An idea in `ideas.md` is not canonical merely because it is exciting or detailed.

The Design Bible should contain concepts that have been deliberately accepted as part of Sektor 1's identity.

The flow is:

```text
Idea
  ↓
Discussion / Experimentation
  ↓
Decision
  ↓
Canonical Design
  ↓
Implementation
```

Implementation can reveal that a design needs revision. If the design intentionally changes, update the canonical documentation rather than allowing contradictory rules to accumulate.

---

# 📚 Canonical Design Sources

Each project source has a specific job.

```text
README.md              Public overview
TODO.md                Active unfinished work

data/*.json            Canonical content definitions

docs/architecture.md   Technical structure and ownership
docs/battle_system.md  Canonical battle mechanics
docs/coding_style.md   Coding and data conventions
docs/design_bible.md   Design identity and principles
docs/ideas.md          Experimental, non-canonical concepts
docs/roadmap.md        High-level development direction
```

Do not force every detail into the Design Bible.

Its job is to preserve the game's identity and durable design decisions so future systems can be judged against something more useful than memory.

---

# 🧭 The Sektor 1 Design Test

When considering a new mechanic, ask:

```text
Does it create an interesting choice or possibility?
Does it interact with systems we already have?
Can the player understand enough of it to make decisions?
Does its complexity earn its place?
Can it be expressed through reusable rules where practical?
Does progression make something meaningfully different?
Does it feel like it belongs beside the rest of Sektor 1?
```

Not every mechanic must answer every question perfectly.

The questions exist to keep the game moving in a coherent direction as it grows.

---

# ❤️ The Heart of Sektor 1

Sektor 1 should feel like a game that respects curiosity.

It gives the player recognizable pieces, then allows those pieces to form combinations that are stranger, deeper, and more personal than they first appeared.

Its systems should be understandable without being exhausted at first glance. Its progression should reveal possibilities. Its unusual rules should create stories the player remembers rather than exceptions they merely memorize.

And as the project grows, we should never become so attached to complexity that we forget the simplest test of all:

> **Is this fun to discover, understand, and use?**

If the answer is yes, we're probably somewhere interesting.

---

Built with ❤️ by **Sarah & Tyler**

## Main Menu Information Language

The main menu uses the screen heading **MAIN MENU** rather than repeating the game title or adding a redundant COMMANDS label. Player-facing menu destination names are intentionally singular: **Item, Magick, Skill, Essence, Equip, Status, Order, Valor, Config, ROSTER, Save, Load, Exit**. Subscreens should follow the same singular heading language (`ITEM`, `MAGICK`, `SKILL`, `ESSENCE`, `EQUIP`, `STATUS`, `CONFIG`, and future equivalents).

The left side represents the currently active four-member party, not the full character roster. Its information hierarchy is square portrait, name with LV directly beneath it, HP/MP/Valor, Status, and Next Level EXP. The panel does not need a redundant PARTY INFORMATION heading; reclaimed space should make the actor cards themselves more useful. Character portraits may use placeholders until canonical portrait art is deliberately selected. Party-card proportions should use the available width rather than leaving an oversized dead strip between identity information and gauges. When player rows are edited, the portrait position itself communicates the row: **back shifts left; front shifts right**. No FRONT/BACK text label is required. The right side owns commands, followed by compact **RUNES**/time and location panels. RUNES is the player-facing currency label even while existing internal economy APIs retain their older generic/Gil naming. TIME is the canonical persistent elapsed-play clock owned by `Game_System`; it advances during active scene updates, displays as `HH:MM:SS`, and is restored from save metadata rather than inferred from wall-clock timestamps.

**Order** and **ROSTER** are deliberately different concepts. Order transfers focus into the active-party cards. Pass 59 establishes persistent front/back row choice there, expressed by portrait horizontal position and saved as party state; Pass 60 adds persistent positions 1-4 as a visual battlefield formation order. Player Battle Row Geometry v1 carries that same row language onto the battlefield: Back stands farther from the enemy side in Normal/Back Attack, while Pincer Front steps outward toward a stable actor flank and Back remains closer to party center. Row offsets are presentation-only and are excluded from target-selection scoring and rear-damage calculation. Formation slots and rows do not grant stat, damage, range, targeting eligibility, initiative, or other combat advantages. The battler's own stats and abilities remain authoritative. **ROSTER** means **Remote Organization & Strategic Team Evaluation Registry** and will own active/reserve party switching when the roster grows beyond four. ROSTER is the one main-menu destination that starts hidden and should appear only after the story explicitly unlocks the system.


**Actor-targeted menu commands** share one interaction grammar: Magick, Skill, Essence, Equip, Status, and Valor first transfer focus into the active-party cards; confirming a member opens that destination for the selected actor. Item, Config, Save, and Load remain direct commands. Character screens may continue cycling through the active four after entry so the player does not have to back out merely to inspect another active member.

**Skill** is the player-facing home for ordinary non-Magick techniques such as Scan and future physical/technical/support abilities. **Valor** is intended to become its own multi-level progression/menu concept with multiple Arts. The existing Valor-Art implementation in the Skills runtime is reusable engine groundwork, not a requirement that Valor remain visually nested under Skill forever.

MAGICK, SKILL, ESSENCE, EQUIP, STATUS, and VALOR establish the shared character-screen identity language: portrait placeholder (until canonical portraits exist), actor name/LV, then HP and MP stacked close to that identity block with one mini gauge beneath each value. Unused header width should remain quiet until a real contextual mechanic earns the space. ESSENCE then diverges into its own slot/catalog and Resonance progression surfaces rather than pretending to be a spell list. STATUS uses three pages inspired by classic JRPG status screens while remaining faithful to Sektor 1 data: Main presents parameters/loadout, Element presents the current `elementRate()` contract, and Effect presents active statuses plus the current `statusRate()` contract. Reference-only categories such as elemental Absorb/Halve or status Attack/Defend must not be shown unless the runtime genuinely acquires those mechanics. Description strips remain left-aligned but are vertically centered within their compact middle band, including wrapped two-line descriptions, so selected-text rhythm does not hug the top edge.

**Menu availability** is a gameplay/presentation contract, not a reason for every command to exist from the beginning. A destination may be hidden until learned, visible-but-disabled with an explanation, or enabled normally. ROSTER is a clear future example of a learned system. Save and Load are intended to become area-sensitive through map contracts; development/debug mode may deliberately bypass those restrictions for testing.

**Save / Load file presentation** shares one file-browser language without merging the actions themselves. Three large file cards follow the approved reference hierarchy: enlarged party portraits at left, leader/level/location in the center, and truthful saved timestamp plus persistent TIME and RUNES at right. The center location box must retain visible breathing room before the metadata divider. The header identifies the currently highlighted file and whether the player is saving or loading. TIME comes from the canonical `Game_System` elapsed clock and resumes from save metadata; it is never inferred from the saved wall-clock timestamp.

**Config Menu Presentation v1** gives CONFIG the same framed Sektor 1 language as the rest of the menu family: a compact description/title header split, spacious setting rows, and the shared dim selection rectangle plus gold `▶` focus cursor. **Config Submenu Presentation Consistency v1** extends that exact outer grammar to CONTROLS and WINDOW COLOR through `ConfigMenuLayout`, while their specialized instructions move into the contextual header rather than permanent footer legends. Presentation does not own setting values. `ConfigManager` remains authoritative, and Window Color / Controls continue through their dedicated editors.

**Window Color** is now a player-configurable presentation system rather than a fixed menu identity. Its editor shares the CONFIG header/content frame, keeps the color list and live preview in a stable two-pane body, and exposes RGB editing without introducing a second palette owner. The Config screen opens a dedicated editor for Top Left / Top Right / Bottom Left / Bottom Right colors, with RGB-channel editing, live preview, and reset-to-default. Config Runtime v3 persists the four corners independently from save slots, and `UIAssetManager` blends them across compatible semantic panels. Individual windows must not own copies of the selected RGB values. HP / MP / Valor colors remain independent through `UIResourcePalette`, so resource identity stays stable even when the window palette changes.


**Magick screen grammar** follows the approved classic-JRPG reference hierarchy without copying its exact content. The player chooses an active actor before entry. MAGICK then reserves the top area for that actor's portrait placeholder, name with LV directly beneath it, compact neighboring HP/MP values with mini gauges, and selected-Magick metadata (Category, Element, Scope, MP Needed), followed by a compact description strip and a three-column learned-Magick grid. Long lists scroll by row with contextual up/down arrows. All four directions navigate the grid and support held repeat; they do not switch actors inside this screen. Field-invalid Magick stays visible but subdued so learned knowledge is not hidden merely because it cannot be cast from the field.

**Skill screen grammar** deliberately reuses that same actor-summary / metadata / description / three-column-list rhythm for consistency. The field SKILL screen shows ordinary non-Valor techniques only, with Category / Effect / Target / Scope metadata. Valor Arts remain in the shared Skill runtime and battle selector, while VALOR owns their separate player-facing progression presentation. SKILL is informational/read-only in the field for now; the pass does not invent field-use rules for battle techniques.

**Valor screen grammar** takes structural inspiration from classic Limit menus without importing unsupported mechanics. The shared actor-summary header remains on the left; the right header owns VALOR LEVEL, the live Valor gauge, learned-Art count, and Ready/Building state. A bounded description strip follows, then LEVEL 1-4 groups occupy a two-by-two progression field. Canonical starter Arts are Level 1 through validated `valorLevel` metadata, while empty future tiers say **No Arts learned** instead of fabricating unlock requirements. The actor's known Skill IDs remain the sole ability-ownership source; the Valor screen is a progression view over the shared Skill action engine, not a duplicate runtime. Long-term unlock rules and additional Arts remain future design work.
