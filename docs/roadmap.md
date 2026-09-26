# 🗺️ Sektor 1 Development Roadmap

This document describes the high-level development path for Sektor 1.

It exists to answer:

> **Where are we going next, and why are we going there in that order?**

The roadmap is not a second `TODO.md`.

`TODO.md` tracks individual unfinished tasks. This document groups those tasks into larger milestones so development can move from foundation to playable systems without losing sight of dependencies.

The roadmap should change when the project genuinely changes. It should not pretend that unfinished designs, dates, or release targets have already been decided.

---

# 🧭 Roadmap Principles

Sektor 1 development should generally follow five rules:

1. Finish foundations before building systems that depend on them.
2. Prefer a complete vertical slice of a system over many disconnected half-features.
3. Keep canonical data, runtime implementation, documentation, and testing aligned.
4. Build reusable engine vocabulary before multiplying content that requires it.
5. Treat milestone order as guidance when dependencies change, not as a prison.

The roadmap contains no artificial release dates. A milestone is complete when its required systems are actually complete and stable enough for the next layer to depend on them.

---

# 🏗️ Foundation Already Established

Sektor 1 already has a substantial engine and data foundation.

Completed engine foundations include:

- Modular engine architecture
- Shared `Game_Battler` system
- Party foundation
- Turn queue
- Multi-character turns
- Data-driven actor collection ownership with explicit party/leader context
- Save / Load with version-aware multi-actor Save Runtime v14, persistent area-location discovery plus learned Skills / Valor / Runes (legacy Gil field) / accessory equipment / slot-aware Essence / party-row state, v11 discovery migration, v9 row migration, and preserved v1-v8 starter-Valor-Art migration
- Equipment system with Weapon, Armor, and Accessory slots
- Inventory system
- Shops & Runes Spending v1 with canonical-price purchases for items and conventional equipment
- Character Menu Navigation Consistency v1 with shared party-member switching across Skills, Magick, Status, Equipment, and Essence
- Skills UI Integration Cleanup v1 with first-class battle Skills rendering and bounded shared ability-description layout
- Battle Presentation & Feedback v1 with encounter/active-turn context, state-sensitive controls, bounded recent battle messages, and target-selection command suppression
- Battle Formation & Party Layout v1 with four-actor vertical lanes, back-attack facing geometry, and left/right pincer flanks
- Battle Command Navigation & Side Actions with a four-command core list, hidden-on-demand Escape/Defend side panels, ready-only Surge chip, and one-level target-cancel restoration
- Battle Results Screen v2 for project-styled sequential EXP/Resonance and Runes/Item feedback, including level-up and Essence progression detail

Completed canonical battle-data foundations include:

- `Magick.json` v1
- 54 initial Magick abilities
- Skills Runtime v1 with separate `Skills.json`, actor ownership, battle execution, menu presentation, and v8 persistence
- Enemy Skills Data Separation v1 with dedicated `EnemySkill.json` / `enemySkillId` action references and shared Skill-effect resolution
- Valor Arts Runtime v2 with dedicated `Valor.json` / `valorArtIds`, actor-owned ready-state cost payment, one prepared level, preserved gauge on level changes, and ready-only Surge selection using shared battle effect dispatch
- Character Valor Arts v1 with one canonical starter Art per current actor plus reusable healing/status Skill effects
- Restore Magick
- Attack Magick
- Indirect Magick
- Advanced Magick
- `Essences.json` v1
- 19 initial Essences
- All 54 current Magick abilities assigned to Essences
- Resonance progression design
- Mastery Ready design
- Level 4 passive design
- Mastery Trial concept
- Essence Evolution eligibility
- `Statuses.json` v1
- 25 initial statuses
- Status families
- Duration models
- Countdown statuses
- Derived statuses
- Reusable status-effect properties

These foundations allow the next phase of development to focus primarily on turning established data into complete runtime behavior.

The repository-audit closure track is complete. `docs/repo_audit.md` remains the historical static review, while `docs/audit_closure.md` records how every actionable finding was reconciled against current code. Passes 20–27 closed the remaining save, validation, map/event, Magick, ownership, UI, runtime-cleanup, and battle-reward findings. New passes should still verify the current repository before implementing overlapping work, but audit closure is no longer the primary development backlog.

---

# ✅ Milestone 1: Status Runtime

**Runtime foundation complete**

The Status System is the current major runtime foundation.

The canonical status data is designed, and the runtime now handles shared status instances, application/removal, duration refresh, resistance/immunity rates, derived-state evaluation, battler-relative turn timing, Stop-specific turn-progression freezing, battle presentation, reusable status-driven combat modifiers, per-target Reflect redirection, data-driven action restrictions, forced action control, and shared defeat/revival semantics.

Status Runtime Core v1, Status Combat Modifiers v1, Reflect Runtime v1, Action Restrictions v1, Defeat & Revival Runtime v1, Forced Action Control v1, and Turn Speed Runtime v1 have established:

- `Statuses.json` database loading and keyed lookup
- Status application and removal APIs
- Turn and countdown duration processing
- Derived status evaluation
- Status immunity and resistance rates
- Non-stacking reapplication with duration refresh
- Fury / Sadness mutual exclusivity
- Battle status indicators
- Post-battle temporary-status cleanup and Death recovery
- Initial turn-start and action-prevention mechanics
- Shared physical and magical incoming-damage modifiers
- Shared outgoing physical-damage and physical-accuracy modifiers
- Sleep / Confuse removal after actual physical damage
- Barrier / MBarrier reduction and Shield physical immunity / elemental absorption
- Per-target Reflect routing with one-bounce protection and single-cost all-target casting
- Shared action/Magick restrictions for Silence and Frog, including command-window availability
- Data-driven forced action control for Confuse random targeting and Berserk auto-attacks
- Shared fractional turn progress for Haste / Slow scheduling on both party and enemy sides
- Interleaved bonus turn slots so Haste adds frequency without bypassing normal side ordering
- Shared `isDefeated()` semantics for HP-zero and status-defined defeat, including Petrify
- Data-driven Death/KO revival with defeated-target selection and cleansing-aware Petrify handling
- Stop-specific personal-clock freezing with side-round expiration
- A reusable `valorGainMultiplier()` status contract for Fury / Sadness / Near-Death

The initial Status Runtime milestone is complete. Valor Runtime now consumes the status multiplier contract while gauge ownership remains actor-specific rather than part of Status Runtime.

Further status expansion should continue to use reusable metadata-driven processing rather than status-name-specific scripts.

## Milestone Exit Condition

Status Runtime is complete when the engine can load the canonical status database and correctly apply, process, display, interact with, expire, and remove the initial status set according to `docs/battle_system.md`.

---

# ✨ Milestone 2: Complete Magick Runtime

Magick v1 already defines the initial 54 abilities, but some mechanics still depend on systems that are unfinished.

**Terminology boundary:** Magick is the Essence-linked supernatural ability system. **Skills** is now the separate canonical non-Magick technique namespace. Skills Runtime v1 provides its database, actor ownership, battle/menu entry points, physical-damage execution contract, targeting, and persistence without reusing Magick state or MP rules.

The current `Magick.json` runtime vocabulary is now connected through reusable execution paths: power-based damage/healing, status application/removal, revival, Gravity current-HP damage, percentage healing, multi-hit/random-per-hit casting, Retreat escape, and Banish all execute without Magick-name patches. Ally-specific status chances, target resistance/immunity, per-target reflection, defeated-target selection, revival HP percentages, scope-dependent power, and one-cost multi-target / multi-hit casting all flow through shared rules.

Primary remaining work includes:

- Verify every initial Magick ability against its canonical data through broader playtest/content coverage
- Implement undead restorative-damage interaction once undead battler identity/data is established

## Milestone Exit Condition

The initial Magick System is runtime-complete when all 54 current Magick abilities can execute their intended mechanics without requiring name-specific patches for behavior that should be reusable.

Summon Magick remains later Magick design work and is not required to complete the initial 54-ability Magick runtime. The **Skills** namespace is active for ordinary non-Magick techniques, while Valor Arts Runtime v2 owns a separate `Valor.json` database and actor ownership state. Canonical Skill content, broader effects/resources, and character-specific Valor Art designs remain later work.

---

# 💎 Milestone 3: Essence Runtime

The Essence data model, database loading, validation, and progression rules are established, but the player-facing runtime system remains to be built.

Completed runtime foundation now includes:

- Data-driven Essence slot counts on actors
- Player-facing Essence Equipment & Menu v1 plus full-screen Essence Menu Presentation & List Navigation v1 with shared actor summary, slot/catalog browsing, Resonance milestone preview, and Magick Awakening presentation
- Persistent actor-owned Essence progression that survives unequipping
- Battle Resonance gain for surviving active participants
- Resonance-capped Essence leveling and next-milestone reporting
- Mastery Ready transition at 1500 Resonance
- Save / Load persistence for Essence progression and slot assignments

Primary remaining work includes:

- Define long-term Essence acquisition / ownership rules for filtering the equip catalog
- Implement ability availability from equipped Essences
- Implement Level 4 passive effects
- Implement full Mastery state / Trial support

Equipped Essences should gain full battle Resonance regardless of whether one of their abilities was cast.

At 1500 Resonance an Essence becomes Mastery Ready and caps. It does not automatically become Level 5.

## Milestone Exit Condition

Essence Runtime is complete when Essences can be equipped, grant their intended abilities and passive behavior, gain Resonance, progress through their normal levels, reach Mastery Ready, and persist correctly through Save / Load.

Mastery Trial quest content and Essence Evolution can remain later systems while the runtime foundation becomes stable.

---

# 🤖 Milestone 4: Enemy Intelligence

Once the player's core battle vocabulary is reliable, enemies need systems capable of using and responding to that vocabulary.

Enemy Actions & AI v1, Enemy Skills & AI Integration v1, and Boss / Phase AI v1 now provide:

- Data-driven enemy action lists
- Weighted action selection
- HP / ally conditional decisions
- Legal target selection and reusable target strategies
- Physical Attack plus shared-runtime Magick and non-Magick Skill execution
- Basic Attack fallback when configured actions become unusable
- Optional validated boss phases with strictly descending HP thresholds
- Battle-local monotonic phase progression and phase-specific action pools
- One-time phase-entry feedback without boss-name branches in AI or combat execution

Remaining advanced work includes:

- Add status resistance / immunity data
- Expand condition/target vocabulary only as encounter design requires it
- Add scripted phase-transition effects only when approved encounters require them
- Support richer boss-specific mechanics through reusable battle systems

Enemy AI decides what an enemy attempts to do. Shared battle systems remain responsible for legality and effect resolution. Boss phase state changes which ordinary action pool is available; it does not replace the shared combat engine.

## Milestone Exit Condition

The core exit condition is met: ordinary enemies can make meaningful legal battle decisions and the engine now has a reusable data-driven phase foundation for scripted or conditional boss behavior. Advanced encounter mechanics can continue to extend this boundary without blocking later milestones.

---

# 👥 Milestone 5: Party and Character Expansion

The party foundation exists and Characters 2, 3, and 4 are currently established in project tracking.

The remaining character and party systems can expand after the core battle vocabulary is dependable.

Primary work includes:

- Character 5
- Character 6
- Character 7
- Character 8
- Party Switching
- Character-specific battle differentiation
- Design and implementation planning for Dual Techs
- Expand the first canonical Valor Arts into broader character differentiation and progression

Character expansion should create meaningful differences in party composition rather than merely increasing the number of available actors.

## Milestone Exit Condition

The milestone is complete when the intended core party can be represented by the engine and party composition has the runtime support required for later character-specific systems.

Exact character designs should only be added to canonical documentation when deliberately established.

---

# 🌎 Milestone 6: World and Event Runtime

A JRPG battle engine eventually needs a world capable of carrying the adventure around it.

Area Map Foundation v1 now establishes validated current-zone landmark/exit records, proximity discovery, persistent discovery state, and a reusable AREA MAP menu surface. Pass 111 adds a remappable field **Quick Map** action (default `M`) plus a small scope-aware route contract: current field maps resolve to the existing AREA MAP snapshot, while a later overworld scene can resolve that same player intent to the World Map. The later World Map should consume the shared discovery contract once multiple authored regions exist rather than replacing the Area Map.

Primary work includes:

- World Map
- Towns
- Dungeons
- Event scripting
- Cutscene system
- Side Quest support
- Map and event integration with Save / Load

The exact world, story, locations, and quest content are not defined by this roadmap.

This milestone establishes the runtime tools required to build them.

## Milestone Exit Condition

World Runtime is complete when the engine can reliably support exploration, scripted events, cutscenes, persistent world state, and the content structures needed for towns, dungeons, and quests.

---

# 👑 Milestone 7: Mastery Trials

Mastery Trials turn Essence Mastery from a numerical threshold into an accomplishment.

This milestone depends on both Essence Runtime and sufficient world/event systems to support actual trials.

Primary work includes:

- Design Mastery Trial quests
- Define how Mastery Ready reveals trial opportunities
- Implement trial completion state
- Promote completed Essences to Level 5 MASTERED
- Integrate Mastery state with Save / Load
- Ensure the cryptic Mastery Ready discovery philosophy is preserved

Quest IDs should remain `null` until real quest definitions exist.

## Milestone Exit Condition

Mastery Trials are complete when a Mastery Ready Essence can lead to its intended trial, completion can be recorded, and the Essence can correctly become Level 5 MASTERED.

---

# 🌠 Milestone 8: Essence Evolution

Essence Evolution comes after Mastery because mastered Essences are the foundation of the system.

Primary work includes:

- Design Evolution rules
- Design Evolution recipes
- Determine Evolution discovery and UI behavior
- Implement eligibility checks
- Implement Evolution creation / unlocking
- Preserve original mastered Essences
- Integrate evolved Essence state with Save / Load
- Balance evolved abilities and passives against the wider battle system

Evolution recipes are intentionally not canonical yet.

## Milestone Exit Condition

Essence Evolution is complete when established recipes and rules can be discovered or accessed through the intended gameplay, validated by the engine, and persisted without consuming the original mastered Essences.

---

# 🌟 Milestone 9: Advanced Character, Magick, and Skills Systems

Several major battle systems are deliberately being left until the core runtime is mature enough to support them cleanly.

The base Skills runtime and Valor Arts resource specialization now exist, so advanced work can build on them rather than creating another action engine. Primary candidates include:

- Additional canonical Skill content and progression rules
- Additional reusable Skill effects/resources
- Summon Magick
- Additional character-specific Valor Arts and long-term unlock/progression rules
- Dual Techs
- Expanded party switching behavior
- Additional advanced Magick interactions

These systems should be designed against the battle engine that actually exists at that stage rather than forcing premature assumptions into today's architecture.

## Milestone Exit Condition

This milestone will need more precise completion criteria after these systems receive canonical designs.

Until then, they remain planned rather than specified.

---

# 🐉 Milestone 10: Content Expansion

Once the major runtime systems are dependable, development can increasingly shift from creating engine vocabulary to using it.

Content expansion can include:

- Enemy rosters
- Boss encounters
- Equipment
- Items
- Towns
- Dungeons
- Side quests
- Mastery Trials
- Story events
- Character progression
- Encounter design
- World content

The exact quantity and sequence of content should follow the game's eventual story and pacing needs rather than arbitrary quotas.

The engine should support content creation without requiring a new subsystem for every ordinary enemy, spell, item, or event.

---

# 🧪 Milestone 11: Integration, Balance, and Polish

Integration and testing should happen throughout development, but a mature project also needs dedicated passes where the question changes from **Can this system work?** to **Does the whole game work together?**

Major areas include:

- Battle balance
- Progression pacing
- Essence progression
- Status usefulness
- Enemy difficulty
- Boss tuning
- Economy and item balance
- Equipment balance
- UI consistency, including one shared left/right party-member navigation pattern across character-facing menus
- Input consistency
- Save compatibility
- Performance
- Animation timing
- Visual feedback
- Contextual battle-state readability and control feedback
- Audio integration
- Bug fixing

This milestone should not become an excuse to postpone basic testing until the end. Each earlier milestone should be tested as it is built.

---

# 📚 Documentation Track

Documentation evolves alongside every milestone rather than waiting for the game to be finished.

The documentation foundation includes:

```text
README.md
docs/architecture.md
docs/battle_system.md
docs/coding_style.md
docs/design_bible.md
docs/roadmap.md
```

`docs/ideas.md` remains the experimental sandbox and is intentionally not canonical.

When a system changes deliberately:

```text
Update canonical data when content changes
Update battle_system.md when battle rules change
Update architecture.md when ownership changes
Update design_bible.md when durable design changes
Update coding_style.md when project conventions change
Update roadmap.md when development direction changes
Update TODO.md when unfinished work changes
```

Documentation is part of maintaining the engine, not paperwork performed after development.

---

# 🔀 Dependency Map

The roadmap can be summarized as:

```text
Engine + Data Foundations
          ↓
    Status Runtime
          ↓
    Magick Runtime
          ↓
    Essence Runtime
          ↓
    Enemy Intelligence
          ↓
 Party / Character Expansion
          ↓
 World + Event Runtime
          ↓
     Mastery Trials
          ↓
   Essence Evolution
          ↓
Advanced Battle Systems
          ↓
   Content Expansion
          ↓
Integration / Balance / Polish
```

Some work can happen in parallel when dependencies permit it. The arrows describe the safest major dependency path, not a prohibition against experimentation.

---

# 🧠 How to Use This Roadmap

When deciding what to work on next:

1. Check the current milestone.
2. Use `TODO.md` for its individual unfinished tasks.
3. Finish reusable foundations before adding content that depends on them.
4. Record experimental ideas in `docs/ideas.md` without treating them as commitments.
5. Update this roadmap when an intentional design or dependency change makes the old order inaccurate.

The roadmap should reduce the question **What should we work on next?** without preventing us from following a genuinely better idea when the project teaches us something new.

---

# 🚫 What This Roadmap Does Not Decide

This document does not currently define:

- A release date
- A final game length
- A final number of towns or dungeons
- A final enemy count
- A final boss count
- A final quest count
- A complete story structure
- Final character canon
- Essence Evolution recipes
- Mastery Trial quest details
- Summon Magick design
- Long-term Valor Art unlock/progression design and later Art sets
- Dual Tech design

Those decisions should become canonical when they are actually made.

No Architecture Fanfiction™ has been promoted to Roadmap Fanfiction™. 😄

---

# ❤️ The Road Ahead

Sektor 1 now has mature battle foundations for statuses, Magick, enemy decision-making across Attack/Magick/Skills, Skills, Valor, and the first character-specific Valor Arts. The next useful work should build on those foundations rather than recreating them.

The strongest open directions are character/party expansion, long-term Skill and Valor Art progression, richer enemy/boss behavior, and world/event systems that can support the content around those mechanics. The exact next pass should come from the current `TODO.md` plus the design priority we deliberately choose at that time.

The road will change as the game teaches us what it needs. That is expected. The important part is that new work now has dependable systems to stand on.

Battle-presentation directions and current status:

- ✅ Four-actor battlefield layout with reusable formation slots and safe sprite scaling
- ✅ Normal / back-attack / pincer encounter formation contracts
- ✅ Battle HUD & Message Layout v1 with reusable four-row HUD geometry
- ✅ Battle Presentation & Feedback v2 with transient action/state banners, integrated command/HUD columns, battlefield Critical/Weak/Resist/Immune feedback, fixed enemy-slot groundwork, and physical rear-exposure rules
- ✅ Battle Targeting & Scope Navigation v2 with four-direction spatial selection, one-target scope collapse, and pincer flank-limited All targeting
- ✅ Valor & Escape Rules v1 with hostile-source Valor gain, explicit Valor-support Skills, and Agility/retry-based Escape attempts
- ✅ Enemy Formation Rows v1 for up to eight centered/customizable front/back-row enemies with pincer-aware flank geometry
- ✅ Scan & Tactical Help v1 for battle-local per-enemy HP/MP and elemental weakness/resistance/immunity details while targeting
- ✅ Game Options / Config Foundation v1 with battle/message pacing, battle cursor memory, Magick ordering, and save-slot-independent persistence
- ✅ Custom Controls / Input Mapping v1 with named actions, persistent two-slot keyboard bindings, dynamic hints, and a dedicated Controls screen
- ✅ Battle UI / Presentation Polish v1 with tighter HUD/command proportions, compact translucent Tactical Help, banner fades, softer hints, and battle accent cursors
- ✅ Battle Context Panel v2 with automatic action descriptions, shared scanned-target readouts, wider translucent context geometry, heading-free normal selectors, and four visible selector rows
- ✅ Asset / UI Skinning Foundation v1 with centralized asset loading, curated UI art, safe fallbacks, windowskin/icon primitives, and optional battler shadows
- ✅ UI Style Integration Prototype v1 with soft-framed semantic battle/menu panels, selection surfaces, and gauge framing
- ✅ Menu Window Softening & Frame Polish v1 with centralized rounded clipping, depth/shadow, inset highlights, and softened gauges/selections
- ✅ Main Menu Information & Command Layout v1 with four active-party information cards, singular destination naming, live currency/location presentation, and reserved Order / Valor / ROSTER destinations
- ✅ Main Menu Refinement & Command Availability Foundation v1 with restored Load, RUNES labeling, tighter party-card proportions, generic command state policy, and validated future Save/Load area gates
- ✅ Main Menu Actor Selection & Order Foundation v1 with shared active-party focus, explicit actor handoff, persistent front/back row state, portrait-offset row language, story-aware ROSTER visibility, and Save Runtime v11
- ✅ Actor Naming + New Game Identity Foundation v1 with canonical default names, reusable runtime renaming, new-game protagonist name entry, Save Runtime v11 persistence, `{actor:<id>}` dialogue tokens, and a validated `nameActor` event hook for future recruit introductions
- ✅ Party Formation Ordering & Valor Visibility v1 with persistent visual formation order and fractional Valor presentation
- ✅ Direct Order control that reuses the MAIN MENU party cards for row changes and visual formation swaps without an intermediate screen
- ✅ Resource Color Consistency v1 with centralized HP blue-cyan / MP green / Valor magenta-purple presentation across primary party UI surfaces
- ✅ Player Battle Row Geometry v1 with presentation-only party front/back battlefield offsets and row-neutral targeting/combat geometry
- ✅ Window Color Customization v1 with Config Runtime v3 four-corner persistence, live RGB editing/preview, and centralized semantic-panel tint blending
- ✅ Magick Menu Presentation & List Navigation v1 with Config naming, white RUNES value, actor summary/detail hierarchy, three-column row scrolling, contextual arrows, and shared held-direction repeat
- ✅ Skill Menu Presentation & List Navigation v1 with ordinary-technique filtering, MAGICK-consistent actor/detail hierarchy, three-column row scrolling, contextual arrows, and shared held-direction repeat
- ✅ Equip Menu Presentation & Stat Preview v1 with shared actor summary, full gear labels, live derived-stat comparison, held-repeat equipment browsing, and square portrait consistency
- ✅ Item Menu Presentation & Inventory Navigation v1 with Use / Arrange / Key Items tabs, target-aware field use, HP/MP party cards, and project-standard focus cues
- ✅ ITEM Presentation Polish v2 with party-owned header, read-only equipment rows, shared content rhythm, and target-card divider breathing room
- ✅ ITEM Header Simplification + Key Item Contract Polish with quiet party-scoped identity, page-specific metadata only, and safe permanent-key consume requests
- ✅ Character Menu Layout Consistency v1 with centralized outer geometry across MAGICK / SKILL / ESSENCE / EQUIP / STATUS / VALOR / ITEM
- ✅ Save Menu Presentation & Slot Summary v1 with full-screen slot cards over unchanged Save Runtime v11 persistence
- ✅ Persistent Play Time v1 with Game_System HH:MM:SS tracking, MAIN MENU presentation, and additive Save Runtime v11 metadata persistence
- ✅ Config Menu Presentation v1 with unified framed layout and preserved Config Runtime / Controls / Window Color ownership
- ✅ Config Submenu Presentation Consistency v1 with shared Config-family geometry, redesigned Controls / Window Color surfaces, and vertically centered character description strips
- ✅ Field Dialogue Window Presentation v1 with shared tintable semantic panels, configured Window Color support, and project-standard choice focus
- ✅ Dialogue Continuation Indicator v1 with blinking same-speaker `▼`, solid end-pause state, and choice suppression
- ✅ Shop Type Metadata & Presentation v1 with general/item/weapon/armor/accessory store identities and category-scoped Buy/Sell behavior
- ✅ Menu Hint Cleanup v1 with permanent key legends removed from mature menu destinations while specialized/contextual prompts remain
- ✅ ITEM / EQUIP / ESSENCE Layout Refinement v1 with item-side tabs, full-height actor/item divider, complete four-member HP/MP cards, and shared EQUIP/ESSENCE center split
- ✅ Status Menu Presentation v1 with shared actor summary, Main / Element / Effect pages, data-driven affinity/resistance presentation, and Equip footer-overlap cleanup
- ✅ Essence Menu Presentation & List Navigation v1 with shared stacked-vitals actor summary, slot/catalog equipment flow, two-column held-repeat catalog navigation, Resonance/Mastery Ready progression, and Magick Awakening presentation

---

Built with ❤️ by **Sarah & Tyler**

## Presentation Status

Custom Controls / Input Mapping v1, Battle UI / Presentation Polish v1, Asset / UI Skinning Foundation v1, UI Style Integration Prototype v1, Menu Window Softening & Frame Polish v1, Resource Color Consistency v1, and Window Color Customization v1 are complete. Runtime input resolves named actions through Config Runtime v3, player-facing battle hints follow remapped bindings, and reusable presentation images resolve through one named asset boundary with safe fallbacks. The Adventure UI prototype now tests a softer framed JRPG direction across battle HUD/commands/selectors plus Options, Controls, and the main menu, while the centralized panel renderer supplies rounded silhouettes and restrained depth without hard-coding frame geometry into consumers. `UIResourcePalette` separately owns the stable player-resource identity so HP remains blue-cyan, MP green, and Valor magenta-purple regardless of which compatible window presents them. Save Runtime is now v13; Config Runtime advances independently from save-slot persistence because Pass 63 adds save-slot-independent four-corner window colors with v2/v1 migration.

Main Menu Information & Command Layout v1, Main Menu Refinement & Command Availability Foundation v1, Main Menu Actor Selection & Order Foundation v1, Party Formation Ordering & Valor Visibility v1, and Player Battle Row Geometry v1 now supply the richer four-member menu structure, Save plus a temporary development Load shortcut, RUNES presentation, generic availability policy, shared actor-selection handoff, persistent front/back row preference, visual-only formation slot swapping, and matching battlefield row placement. ROSTER now owns active/reserve party switching and appears after a supporting operative joins. Targeting and rear-damage calculations deliberately consume row-neutral geometry, so rows remain visual rather than tactical bonuses. MAGICK, SKILL, ESSENCE, EQUIP, STATUS, VALOR, and ITEM now share one actor-summary presenter and one outer `CharacterMenuLayout` geometry contract, while each screen keeps its own domain-specific metadata/list behavior. STATUS adds Main / Element / Effect pages using real actor/loadout, elemental-rate, and status-rate/runtime data; EQUIP and ESSENCE share the same centered lower-pane divider; ITEM keeps its navigation above the item pane so four target cards can contain complete HP/MP information. Mature menu destinations no longer spend space on permanent key legends, while specialized editors and contextual interactions keep instructions where they are actually needed. Field dialogue and choices now inherit the same configured tintable window family without changing their runtime input ownership. EQUIP still adds live current-to-preview derived-stat comparison without moving mutation out of `Game_Actor`, and MAIN MENU portrait placeholders use the same square silhouette. Future passes can replace portrait placeholders with canonical art and expand the now-active multi-level Valor/ROSTER foundations with additional content; compatible menu and dialogue screens inherit the player-selected window palette automatically. Battle backgrounds, icons, and battle VFX can continue independently without redesigning menu ownership first.
