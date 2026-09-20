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
-   ✅ Accessories Equipment v1
-   ✅ Character Menu Navigation Consistency v1
-   ✅ Enemy Actions & AI v1
-   ✅ Valor Runtime v1
-   ✅ Skills Runtime v1
-   ✅ Character Valor Arts v1
-   ✅ Valor Arts Runtime v1
-   ✅ Skills UI Integration Cleanup v1
-   ✅ Battle Presentation & Feedback v1
-   ✅ Battle Command Navigation & Side Actions v1
-   ✅ Battle Formation & Party Layout v1
-   ✅ Battle HUD & Message Layout v1
-   ✅ Battle Presentation & Feedback v2
-   ✅ Battle Targeting & Scope Navigation v2
-   ✅ Valor & Escape Rules v1
-   ✅ Enemy Formation Rows v1
-   ✅ Scan & Tactical Help v1
-   ✅ Enemy Skills & AI Integration v1
-   ✅ Boss / Phase AI v1

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
-   ✅ Save / Load (version-aware Save Runtime v9)
-   ✅ Equipment system (Weapon / Armor / Accessory)
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
-   ✅ Four-direction spatial target navigation and pincer flank-aware All targeting
-   ✅ Four-actor vertical battlefield layout with safe sprite scaling
-   ✅ Normal / Back Attack / Pincer encounter formations
-   ✅ Up to eight enemies with centered/custom front/back rows and pincer-aware flank rows
-   ✅ Battle effects
-   ✅ Animation controller
-   ✅ Magick foundation
-   ✅ Skills Runtime v1 foundation
-   ✅ Contextual controls, transient action/state banners, floating combat feedback, four-actor HUD geometry, and optional tactical enemy help
-   ✅ Idempotent battle resolution and structured rewards
-   ✅ Gil, enemy item drops, and Essence Resonance rewards

Systems currently being expanded include:

-   ✅ Essence Equipment & Menu v1
-   🚧 Essence ability grants and passive runtime
-   ✅ Enemy Actions & AI v1
-   ✅ Enemy Skills & AI Integration v1
-   ✅ Boss / Phase AI v1
-   🚧 Advanced boss mechanics and scripted phase effects
-   ✅ Valor Runtime v1
-   ✅ Valor Arts Runtime v1
-   ✅ Character-specific Valor Art content v1
-   ✅ Skills UI Integration Cleanup v1
-   ✅ Battle Presentation & Feedback v1
-   ✅ Battle Command Navigation & Side Actions v1
-   ✅ Battle Formation & Party Layout v1
-   ✅ Battle HUD & Message Layout v1

Battle HUD & Message Layout v1 established reusable four-row geometry. Battle Presentation & Feedback v2 refines that experiment from hands-on playtesting: persistent top headers/messages are removed, action/state information uses compact transient banners, actor names stay in a fixed left roster, the main command window overlays a dedicated middle reserve, and HP/MP/Valor remain in stable right-side columns. Damage, Weak/Resist/Immune, and Critical feedback stay on the battlefield as popups; Critical also triggers a brief presentation-only flash. Battle Targeting & Scope Navigation v2 keeps targeting inside the same formation geometry: single-target selection now responds spatially in all four directions, optional All scope is hidden when the selected target bucket contains only one legal battler, and Pincer All targeting resolves against one selected enemy flank at a time rather than both flanks simultaneously. Enemy Formation Rows v1 expands encounter geometry to eight enemies through four front-row and four back-row positions. Rows auto-center when slots are omitted, or an encounter can explicitly choose `slot: 0..3`; pincer encounters apply the same row contract independently on each flank while retaining an eight-enemy total cap. Rows are positioning-only until weapon/ranged contracts intentionally give them combat meaning. Scan & Tactical Help v1 adds battle-local enemy analysis without duplicating combat data: pressing **H** toggles a compact lower-battlefield help bar, unscanned targets show `??`, and scanning a specific enemy instance reveals its live HP/MaxHP, MP/MaxMP, and elemental Weak/Resist/Immune categories derived directly from `elementRates`.

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

Summon Magick is a future Magick category. The separate **Skills** namespace now provides the runtime foundation for non-Magick techniques, including **Valor Arts**, without reusing Magick ownership, MP costs, or spell terminology.

Combat-stat terminology remains **Magic**, **Magic Attack**, and **Magic Defense**. Those names describe character statistics rather than the Magick ability namespace.

------------------------------------------------------------------------

# 🥋 Skills

**Skills Runtime v1** establishes Sektor 1's separate non-Magick technique system. Canonical definitions live in `data/Skills.json`, actors own learned Skill IDs independently from `magickIds`, and battle Skills use the same shared action-restriction and target-selection infrastructure without becoming Magick casts.

Skills now support the reusable effect vocabulary required by the first canonical Valor Arts and later combat rules: physical damage through `powerMultiplier`, percentage healing through `healPercent`, status application through validated `status` chance maps, deliberate Valor gain through positive `valorGain`, and enemy analysis through the battle-local `scan` effect. Damage continues to reuse the established physical hit, Defense, defending, incoming-damage, defeat, and hostile-source Valor pathways; healing, status application, and explicit Valor gain reuse battler APIs rather than creating character-specific branches. Legal `target` groups remain `self`, `ally`, and `enemy`, with `scope` values `single` and `all`.

**Character Valor Arts v1** establishes one starter Art for each current actor through ordinary `initialSkillIds`. Tyler also begins with the non-Valor **Scan** support Skill for current battle testing. Tyler's **Unbroken** is a high-power single-target physical strike; Sarah's **Rallyheart** restores 35% Max HP to all injured allies; Aboo's **Wild Arc** damages all enemies and carries a 60% base Darkness chance; G Prime's **Zero Lock** attempts to Slow all enemies. These are data records, not actor-name checks in battle code.

**Valor Arts Runtime v1** still specializes the same Skills namespace through `valorArt: true`. A Valor Art is usable only while its actor is Valor Ready and spends the existing full gauge exactly once when the action is committed against at least one legal target. Battle and field Skills windows mark Valor Arts with `[VALOR]`; no separate Valor-only command or combat engine exists.

The field Skills window remains a read-only learned-Skill viewer with the same shared actor navigation used by other character menus. Skills UI Integration Cleanup v1 makes the battle selector a first-class rendered battle window, suppresses the command window while that selector is open, and uses shared bounded text layout for long Skills/Magick descriptions in field menus. Enemy Skills & AI Integration v1 now lets enemy action data reference the same canonical Skill records through `skillId`; enemy use still follows the shared Skill legality, targeting, physical damage, healing, and status-effect contracts. Long-term Skill/Valor Art unlock progression, additional effect types, and additional resource models remain future design work.

Battle Command Navigation & Side Actions v1 keeps the visible command list to **Attack / Skills / Magick / Item**. Left input reveals a temporary Escape side panel and right input reveals a temporary Defend side panel; neither exists visually until requested. Valor & Escape Rules v1 moves normal Escape resolution into `BattleManager`: escapable encounters roll from party/enemy average Agility, failed legal attempts consume the active actor's turn and improve the next chance, while `canEscape: false` remains an absolute no-roll gate. Retreat Magick stays a guaranteed escape in escapable encounters but cannot bypass that encounter gate; blocked Retreat is rejected before MP or a turn is spent. Backing out of Skill or Magick target selection returns one navigation level to the originating selector with that selector's current cursor preserved. Pass 46 makes the Escape/Defend tabs flush with the command panel's top and side edges and moves the command panel into the HUD's reserved middle column, leaving the name roster visible while commands are open.

------------------------------------------------------------------------

# 🔥 Valor

**Valor** is Sektor 1's pressure-response battle resource. Actors build passive Valor from actual hostile opposing-side battle-action HP loss, with the base gain proportional to the percentage of Max HP lost. Fury, Sadness, and Near-Death modify that gain through the shared data-driven `valorGainMultiplier` status contract.

Current actors have a data-driven Max Valor of 100. Valor persists between battles and through Save Runtime v9, caps at the actor's configured maximum, and is shown in both the battle HUD and Status menu. A full gauge becomes **VALOR: READY**.

Valor Runtime v1 establishes the gauge, gain rules, persistence, ready state, and consumption API. Valor Arts Runtime v1 consumes that API through the Skills cost hook without moving gauge ownership out of `Game_Actor`, and Character Valor Arts v1 now supplies the first four canonical Arts. Their future unlock/progression rules and later Art sets remain separate design work.

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

# 💍 Equipment Accessories

Accessories Equipment v1 adds a third conventional equipment slot beside Weapon and Armor. Accessory definitions live in `data/Accessories.json`, owned copies live in `Game_Party`, and each actor owns one `accessoryId` through explicit equip / unequip APIs.

The initial accessory contract supports additive Attack, Defense, Magic Attack, Magic Defense, and Critical bonuses. This keeps the first runtime small while leaving status, elemental, and more specialized accessory effects for later data/runtime extensions.

The current Save Runtime v9 persists both equipped accessory IDs and party accessory inventory. The existing test chest can award a Power Wrist through the validated accessory event-command path.

------------------------------------------------------------------------

# 💰 Shops & Economy

Shops & Gil Spending v1 turns existing Gil rewards and merchandise price metadata into a playable purchase loop. Map events can open a merchant with a validated list of Items, Weapons, Armor, and Accessories. The merchant list identifies only merchandise type and ID; purchase prices always come from the canonical database record so map content cannot drift away from item/equipment pricing.

`Game_Party` owns the purchase transaction. A successful purchase spends the exact canonical Gil price and adds the merchandise through the same inventory APIs used by rewards and equipment. Failed purchases, including insufficient funds, leave both Gil and inventory unchanged.

The first shop version buys one unit at a time and intentionally does not define selling or resale values yet. Those rules remain a separate economy-design decision. Map001 includes a test merchant with all current merchandise categories. Save Runtime remains v6 because Shops consume already-persistent Gil and inventory state rather than introducing new save data.

------------------------------------------------------------------------

# 🤖 Enemy Actions & AI

Enemy Actions & AI v1 gives enemy definitions validated action lists in `data/Enemies.json`. Enemy Skills & AI Integration v1 extends those lists with canonical non-Magick Skill actions, so current action types are Attack, Magick, and Skill. Actions can be weighted, gated by HP/ally conditions, choose legal targets through reusable strategies, and fall back to a normal Attack when every configured choice is unusable.

`BattleEnemyAI` decides **what** an enemy attempts and **who** it targets. `BattleManager` and shared `Game_Battler` runtimes still own mechanical legality and effect resolution. Enemy Magick therefore keeps using MP, Reflect, elemental, healing, and status rules from the Magick runtime, while enemy Skills use the same physical-damage, healing, status, targeting, and action-restriction contracts as actor Skills. Valor Arts remain actor-owned and are rejected as enemy actions.

The current Test Slime demonstrates the combined contract with weighted Attack, **Goo Rush**, and Ember choices plus a conditional Mend option below half HP. Goo Rush is defined in `Skills.json`, deals physical Skill damage, and carries a Slow status rider without any Test-Slime-specific execution branch. Boss / Phase AI v1 extends that same foundation with validated HP-threshold phase records. `Game_Enemy` owns battle-local monotonic phase state, `BattleEnemyAI` sees only the current phase action pool, and `BattleManager` announces one-time phase entry at enemy-turn start. **Test Slime Alpha** is the first canonical phase boss and is available through the Map001 Boss Battle Tester. Advanced scripted phase effects and richer boss mechanics remain future work.

------------------------------------------------------------------------

# 👥 Character Menu Navigation

Skills, Magick, Status, Equipment, and Essence now share the same party-member navigation contract. Each window receives `Game_Party` context, displays a shared `◀ Actor ▶` header, and uses A/D or left/right to move through the party roster.

`Window_ActorNavigator` owns the common actor index, wraparound behavior, input interpretation, and header presentation. Individual windows only reset their own local selection state when the active actor changes.

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
data/Skills.json
data/Essences.json
data/Statuses.json
```

This separation allows gameplay content to expand while keeping the
underlying engine maintainable.

------------------------------------------------------------------------

# 🌎 Future Development

Major systems still planned include:

-   Advanced enemy / boss scripting
-   Boss scripting
-   Party switching
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
-   ✅ Skills Runtime v1
-   ✅ Character Valor Arts v1
-   ✅ Essence System v1
-   ✅ Status System v1

### Current Focus

> 🚧 **Post-audit feature development**

See [`TODO.md`](TODO.md) for the current development checklist.

------------------------------------------------------------------------

Built with ❤️ by **Sarah & Tyler**
