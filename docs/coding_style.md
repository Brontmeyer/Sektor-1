# 🧹 Sektor 1 Coding Style

This document defines the coding and data conventions used by Sektor 1.

It exists to answer the deeply technical question:

> **How are we supposed to write this darn stuff?**

Consistency matters more than personal preference. New code should resemble the surrounding Sektor 1 code unless there is a deliberate reason to improve the convention itself.

---

# 🧭 Core Principles

Sektor 1 code should favor:

- Readability over cleverness
- Small, clearly owned responsibilities
- Reusable systems over one-off content checks
- Data-driven behavior where practical
- Explicit state over hidden side effects
- Early returns over deeply nested control flow
- Descriptive names over abbreviations
- Comments that explain intent rather than narrate obvious syntax
- Existing project conventions over introducing a second competing style

A future reader should be able to answer three questions quickly:

```text
What does this code own?
What data does it need?
What happens next?
```

---

# 📁 File and Folder Conventions

JavaScript classes use PascalCase filenames matching the primary class when practical.

Examples:

```text
BattleManager.js
BattleTargetManager.js
DatabaseManager.js
Game_Battler.js
Game_Actor.js
Scene_Battle.js
Window_Magick.js
```

Files belong in the narrowest folder that describes their responsibility.

```text
js/core/       Engine-wide infrastructure
js/objects/    Runtime game objects
js/battle/     Battle-specific systems
js/scenes/     Scene coordination
js/windows/    UI windows and selection interfaces
js/sprites/    Sprite and presentation objects
js/managers/   Specialized managers where applicable
data/          Canonical game-content JSON
docs/          Architecture, rules, conventions, and design documentation
```

Do not place a file in a broad folder merely because that folder can access the system it needs.

---

# 🏷️ JavaScript Naming

Use **PascalCase** for classes:

```js
class BattleManager {}
class Game_Battler {}
class Scene_Battle {}
```

Use **camelCase** for methods, local variables, properties, and parameters:

```js
currentBattler
pendingMagick
battleInputLocked
performMagickEffect()
queueEnemyTurn()
```

Use descriptive boolean names that read naturally as true or false:

```js
battleInputLocked
pendingEnemyTurn
randomTargetPerHit
questRequired
```

Prefer established project terminology. If the canonical concept is `paralyze`, do not introduce `paralyzed` or `paralysis` as alternate internal names for the same status.

The current Essence-linked supernatural ability system is **Magick**. Use `magick`, `magickId`, `magickIds`, and Magick-named APIs for that system. **Skills** is the separate non-Magick technique namespace; use `skill`, `skillId`, `skillIds`, and Skill-named APIs for current Skill state. Never use either namespace as an alias for the other. The bare legacy save key `skills` is retained only inside SaveManager migration code because pre-Pass-29 saves used that name for what is now Magick. New runtime code and new save data must use `skillIds`. Combat-stat names such as `magic`, `magicAttack`, and `magicDefense` remain unchanged because they describe statistics rather than the ability namespace.

---

# 🥋 Skill Data Conventions

Non-Magick Skill content belongs in `data/Skills.json`. The current consumed vocabulary includes `type`, `category`, `effect`, targeting/scope, `powerMultiplier` for physical damage, `healPercent` for percentage healing, `status` chance maps for reusable status application, and `valorArt` for the established Valor cost specialization. Current categories are `physical`, `support`, and `control`; current effects are `damage`, `heal`, and `inflictStatus`. Do not add speculative costs, cooldowns, effect fields, or categories until a runtime contract exists for them.

Skill behavior should be expressed through reusable metadata and shared combat helpers. Do not branch on a Skill's display name or owning actor name to decide damage, healing, statuses, targeting, or future special behavior when a general data contract can represent the rule.

---

# 🔒 Strict Mode

Existing JavaScript engine files use strict mode.

New engine files should begin with:

```js
"use strict";
```

unless the project's module architecture is deliberately changed in the future.

---

# ✍️ Formatting

Follow the formatting already established throughout the project.

Use two spaces for indentation.

Use braces for class methods and control-flow blocks.

Prefer double quotes for JavaScript strings:

```js
const state = "command";
```

Terminate ordinary JavaScript statements with semicolons.

Use trailing commas where the existing formatter/style naturally produces them in multiline argument lists or structures.

Keep blank lines between logical operations when they improve readability.

Avoid compressing several unrelated operations onto one line merely to reduce file length.

---

# 🧱 Class Organization

Large classes should be divided into recognizable responsibility sections when useful.

The project currently uses comment banners such as:

```js
// =================================
// Party Methods
// =================================
```

For especially important development sections, longer banners are also acceptable:

```js
// =============================================================
// Battle Turn State
// =============================================================
```

Group related methods together. A class should read like a map of its responsibilities rather than a shuffled deck of functions.

Suggested ordering when it fits the class:

```text
Constants / static fields
Constructor
Initialization
Public interface
Update methods
Execution / behavior methods
Helpers
Setters and getters
```

This is a readability guideline, not a reason to rearrange stable code pointlessly.

---

# 🚪 Early Returns

Prefer early returns when a method cannot continue safely.

Good:

```js
if (!magick) {
  return;
}

if (!battler.canUseMagick(magick.id)) {
  return;
}
```

This keeps the successful path readable and avoids unnecessary nesting.

Do not use early returns to hide important cleanup. If a method owns cleanup or state restoration, make sure every exit path preserves that responsibility.

---

# 🧠 Method Responsibilities

A method should have one clear job even when that job contains several steps.

Good conceptual boundaries include:

```text
executeMagick()        interpret the selected Magick command
performMagickEffect()  resolve the selected Magick effect
queueEnemyTurn()      schedule the enemy phase
setTurnState()        change turn state
```

If a method begins handling unrelated targeting, persistence, rendering, database loading, and battle resolution at once, it is probably becoming too broad.

Enemy AI follows the same ownership rule: enemy action definitions belong in `Enemies.json`, `BattleEnemyAI` decides among legal configured choices, and shared battler/battle systems resolve the chosen action. Do not hard-code named enemies into `BattleManager` when a reusable action, condition, or target-strategy contract can express the behavior.

Before adding logic to an existing large method, ask whether the behavior belongs in a smaller reusable helper or another system entirely.

---

# 🧩 System Ownership

Follow the responsibility map defined in `docs/architecture.md`.

As a practical rule:

```text
JSON data        defines canonical content
Game objects     own runtime game state
Managers         coordinate reusable systems
Scenes           coordinate scene flow
Windows          present choices and UI state
Renderers        draw results
```

Presentation code should not quietly become gameplay authority.

A window may display whether a command is available, but the underlying game system should determine whether it is actually legal.

Character-specific field-menu windows should receive party context and use the shared `Window_ActorNavigator` helper for left/right actor switching and actor-header presentation. Window-specific code should only handle the local state that must reset when the selected actor changes.

Long descriptive text inside fixed UI panels should use shared `Window_TextLayout` wrapping instead of a raw unbounded `fillText()` call. Battle selection windows should be registered with the renderer as one selection group so input-active selectors are also visible and suppress the underlying command window consistently.

Battle control hints and active-turn labels should be derived from existing scene/manager state. Do not create a second UI-only source of truth for whether escape is legal, whose turn it is, or which input mode currently owns control. Target selection should suppress the underlying command window just as an open selection window does.

---

# 🗃️ Data-Driven Gameplay

Magick, Essences, statuses, enemies, items, and similar content should be represented as data wherever practical.

Avoid code such as:

```js
if (magick.name === "Inferno") {
  // special implementation of Inferno
}
```

when the behavior can instead be represented by reusable properties such as:

```json
{
  "element": "fire",
  "effect": "damage",
  "power": 100
}
```

The engine should learn reusable vocabulary. Content should combine that vocabulary.

A named-content check is acceptable only when the mechanic is genuinely unique and deliberately cannot be expressed through an existing or worthwhile reusable rule.

---

# 🔢 Database IDs

Canonical database arrays use a leading `null` so numeric IDs can map directly to array positions.

Example:

```json
[
  null,
  {
    "id": 1,
    "name": "Example"
  }
]
```

For these databases:

```text
array index === object id
```

IDs should remain sequential unless a database explicitly adopts another documented rule.

Do not silently renumber established IDs merely to reorganize presentation order. IDs are references, not decoration.

---

# 🧾 JSON Property Conventions

Canonical JSON should remain valid JSON. Do not use JavaScript comments inside JSON files.

Where human-readable collapsed-file labels are useful, Sektor 1 may use a data property such as `_comment`:

```json
{
  "_comment": "🔥 Flame",
  "id": 4,
  "name": "Flame"
}
```

For Essence records, `_comment` is the first object property so collapsed entries remain easy to identify in VS Code.

Use camelCase for JSON keys:

```text
resonanceRequired
questRequired
evolutionEligible
randomTargetPerHit
revivePercent
gravityPercent
healPercent
```

Use the same property name everywhere for the same concept.

Do not create near-duplicate vocabulary such as `revivalPercent`, `revivePct`, and `revivePercent` for one mechanic.

---

# 🔤 Internal Keys vs Display Names

Internal identifiers should be stable and code-friendly. Display names may use capitalization, spaces, punctuation, or stylistic wording.

Example:

```json
{
  "key": "deathSentence",
  "name": "Death-Sentence"
}
```

Code should prefer the stable internal key when identifying a reusable concept.

Do not derive internal behavior from how a display name happens to be punctuated or capitalized.

---

# 🧪 Status Naming

Status keys use canonical internal terminology.

Examples:

```text
poison
regen
barrier
mbarrier
reflect
haste
slow
stop
paralyze
sleep
confuse
silence
petrify
death
berserk
fury
sadness
darkness
frog
small
deathSentence
slowNumb
nearDeath
dual
shield
```

Use `paralyze`, not `paralyzed` or `paralysis`, when referring to the canonical internal status.

Use `confuse`, not `confusion`.

These distinctions prevent tiny vocabulary differences from becoming very large debugging adventures.

---

# 💎 Essence Data Conventions

Essence records use the established Essence schema rather than inventing fields per Essence.

Core fields include:

```text
_comment
id
name
description
type
element
maxLevel
abilities
passive
levels
mastery
```

Normal progression levels are represented in `levels`.

Level 5 is not a normal Resonance level entry. At 1500 Resonance the Essence becomes Mastery Ready, and its Mastery Trial later promotes it to Level 5 MASTERED.

Until the quest system exists, Mastery records may intentionally use:

```json
"questId": null
```

Do not invent placeholder numeric quest IDs merely to avoid `null`.

Actor Essence capacity belongs in actor data through the positive-integer `essenceSlots` field. UI code must query the actor's slot API rather than assuming a fixed slot count. Essence progression and slot assignment are separate runtime concepts so unequipping does not reset Resonance.

---

# ✨ Magick Data Conventions

Magick records should describe mechanics through reusable fields.

Established vocabulary includes concepts such as:

```text
status
revivePercent
gravityPercent
healPercent
toggleStatus
allyStatusChance
hits
randomTargetPerHit
scopePower
```

Use `scopePower` only for the portion of a power-based Magick intentionally modified by target scope.

Do not assume all-target casting automatically modifies status chance or every other property of the Magick.

When adding a new field, define one mechanic clearly rather than creating an ambiguous catch-all property.

---

# 🔥 Valor Conventions

Use **Valor** as the canonical name for Sektor 1's pressure-response gauge. Do not introduce `Limit`, `Limit Break`, or parallel gauge terminology in active code or data.

Actor capacity belongs in `Actors.json` as the positive-integer `maxValor` field. Runtime gauge state belongs to `Game_Actor`; shared status data may modify gain through `effects.valorGainMultiplier`. The shared damage layer may notify actor-specific systems after resolved damage, but `Game_Battler` must not become the owner of actor Valor state.

Character-specific Valor actions are referred to as **Valor Arts** and belong to the non-Magick Skills namespace. Mark the Skill definition with `valorArt: true`; do not add a separate Valor action engine or move Valor state out of `Game_Actor`. Shared Skill execution should use the generic cost hook rather than checking Valor directly.

---

# 🛡️ Status Data Conventions

Status records should express reusable behavior through properties rather than status-name checks.

Core concepts include:

```text
classification
duration
effects
conditions
```

Duration models may include turn-based, until-removed, countdown, or derived behavior.

If two statuses share a family, that does not make them interchangeable. Family-level mechanics should explicitly operate on the family, while status-specific mechanics should explicitly identify the status.

Cross-status relationships that do not naturally belong to one status record may remain engine rules and should be documented in `docs/battle_system.md`.

---

# 🧮 Numbers and Percentages

Use the established representation for the mechanic being edited.

Some percentages are stored as decimal multipliers:

```json
"hpDamagePercent": 0.03
```

Other established fields may represent percentage values according to their own documented engine contract.

Do not convert between `3`, `0.03`, and `3%` based on appearance alone. Confirm how the consuming runtime interprets the field.

Name new percentage fields clearly enough that their intended meaning can be documented and validated.

---

# 🌐 Cross-File References

When one data file references another, use stable IDs or established keys rather than duplicating entire objects.

References should be validated where practical.

Examples include:

- Essence abilities referencing Magick IDs
- Mastery records eventually referencing quest IDs
- Status expiration effects referencing canonical status keys

When adding or renaming a referenced identifier, search the repository for every consumer before committing the change.

---

# 🧹 Comments

Comments should explain **why**, **intent**, or **non-obvious rules**.

Useful:

```js
// Pay the MP cost only once, even though the spell
// is being applied to multiple targets.
```

Less useful:

```js
// Set x to 5
x = 5;
```

Temporary historical comments such as pass names can be useful during active development, but permanent code should not depend on archaeological excavation to explain its current purpose.

When an old comment no longer describes the current system, update or remove it.

---

# 🐛 Debugging and Logging

Use the project's debugging infrastructure when appropriate rather than scattering permanent `console.log()` calls throughout gameplay code.

Warnings are appropriate when the engine encounters an invalid or unsupported state that developers should see, for example a Magick with no legal target group.

Debug output should help answer a specific question.

Remove temporary noise after the problem is solved unless the log remains useful for future diagnostics.

---

# ⚠️ Error Handling and Validation

Fail safely when ordinary runtime state can legitimately be missing.

Use guards such as:

```js
if (!target) {
  return;
}
```

For malformed canonical data, prefer validation and clear developer-facing errors over silently inventing defaults that conceal the problem.

`DatabaseValidator` exists to keep database problems close to the data boundary. As new canonical systems are loaded, their validation should grow alongside them.

---

# 🔄 State Changes

Make important state transitions explicit.

Prefer named state values and focused setters when they improve clarity:

```js
this.setTurnState(BattleManager.TURN_COMMAND);
```

over scattered magic strings whose meaning must be rediscovered in every method.

When a state transition locks input, schedules another phase, clears pending data, or performs cleanup, keep those responsibilities predictable.

---

# 🧙 Magic Strings and Constants

Repeated structural state names should become constants when doing so reduces errors and clarifies ownership.

Example:

```js
static TURN_START = "turnStart";
static TURN_COMMAND = "command";
static TURN_ACTION = "action";
static TURN_END = "turnEnd";
```

Not every string needs a constant. Display text, one-time messages, and data-defined names should not be converted into constants merely for ceremony.

---

# ♻️ Reuse Before Duplication

Before writing a second implementation of a mechanic, check whether the engine already has the concept.

Examples:

```text
Target selection
Damage resolution
Status application
Element rates
Battler death checks
Battle popups
Database lookup
```

If two systems need almost the same behavior, consider whether the shared portion belongs in a reusable helper or lower-level system.

For player-facing transactions, keep presentation and mutation boundaries explicit. A window may report “buy this entry,” a scene may coordinate the request, and the party/inventory owner should perform the currency-plus-inventory transaction. Canonical prices should be read from canonical merchandise data rather than copied into event or UI definitions.

Do not force unrelated mechanics together solely to eliminate a few repeated lines. Reuse should reflect shared responsibility, not code golf.

---

# 🧯 Avoid Giant Managers

Managers coordinate systems. They should not become storage closets for every feature that lacks an obvious home.

Before adding a large block to `BattleManager`, `DatabaseManager`, or `Scene_Battle`, ask:

```text
Does this class truly own the rule?
Could the behavior be reusable elsewhere?
Is there already a narrower system for it?
Would a dedicated system make the dependency clearer?
```

A large file is not automatically bad. A file with too many unrelated reasons to change is.

---

# 🧪 Changes to Canonical Data

When editing Magick, Essences, Statuses, or another canonical database:

1. Preserve valid JSON.
2. Preserve established IDs unless the change explicitly requires migration.
3. Use canonical property and key names.
4. Check cross-file references.
5. Check runtime consumers of changed fields.
6. Update documentation if the rule changed.
7. Update `TODO.md` if implementation work was created or completed.

Data and documentation should evolve together.

---

# 🔍 Before Committing Code

Before a meaningful commit, check:

1. Does the code still parse and run?
2. Did an identifier change anywhere else in the repository?
3. Did the change accidentally mix gameplay logic with presentation?
4. Is new behavior data-driven where practical?
5. Are unfinished pieces clearly unfinished rather than pretending to work?
6. Does documentation need to change?
7. Does `TODO.md` need to change?

For database changes, also validate IDs, keys, references, and expected schema.

---

# 📝 Commit Style

Commit messages should be short, descriptive, and centered on the change.

The repository currently uses conventional prefixes such as:

```text
feat: complete status system v1
docs: reorganize development TODO
docs: update project README
docs: document engine architecture
docs: document battle system
```

Useful prefixes include:

```text
feat:     new gameplay or engine functionality
fix:      bug correction
docs:     documentation changes
refactor: structural code change without intended behavior change
chore:    maintenance work
```

A commit message should describe what changed, not celebrate that work happened.

---

# 📚 Documentation Responsibilities

Keep each document in its lane.

```text
README.md              Public project overview
TODO.md                Active unfinished work
docs/architecture.md   Engine structure and ownership
docs/battle_system.md  Canonical battle rules
docs/coding_style.md   Coding and data conventions
docs/design_bible.md   Game identity and design principles
docs/ideas.md          Experimental, non-canonical ideas
docs/roadmap.md        High-level development milestones
```

Do not duplicate a complete database into documentation merely to make the documentation look thorough.

Link concepts together and let each canonical source own its information.

---

# ❤️ The Sektor 1 Rule

When choosing between code that is impressive and code that Future Us can understand six months from now, choose the code Future Us can understand.

Sektor 1 is meant to grow.

Every system we add should leave the project easier to reason about, not harder.

If we can open a file months later, understand what owns what, change one mechanic without breaking three unrelated systems, and still recognize our own vocabulary, then the style is doing its job.

And if we ever forget how we're supposed to write this darn stuff, this file is now the answer. 😄

---

Built with ❤️ by **Sarah & Tyler**
