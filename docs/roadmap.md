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
- Save / Load with version-aware multi-actor Save Runtime v6, persistent Gil / accessory equipment / slot-aware Essence state, and v1-v5 migration
- Equipment system with Weapon, Armor, and Accessory slots
- Inventory system
- Shops & Gil Spending v1 with canonical-price purchases for items and conventional equipment
- Battle Results Screen v1 for visible EXP, Gil, drop, level-up, and Essence progression feedback

Completed canonical battle-data foundations include:

- `Magick.json` v1
- 54 initial Magick abilities
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
- A reusable `limitGainMultiplier()` status contract for Fury / Sadness / Near-Death

The initial Status Runtime milestone is complete. The future Limit system will consume the already-exposed status multiplier contract when Limit-gauge mechanics are designed; that work belongs to the Limit feature rather than to Status Runtime.

Further status expansion should continue to use reusable metadata-driven processing rather than status-name-specific scripts.

## Milestone Exit Condition

Status Runtime is complete when the engine can load the canonical status database and correctly apply, process, display, interact with, expire, and remove the initial status set according to `docs/battle_system.md`.

---

# ✨ Milestone 2: Complete Magick Runtime

Magick v1 already defines the initial 54 abilities, but some mechanics still depend on systems that are unfinished.

**Terminology boundary:** Magick is the current Essence-linked supernatural ability system. **Skills** is reserved for future non-Magick techniques and does not yet have a canonical runtime or database.

The current `Magick.json` runtime vocabulary is now connected through reusable execution paths: power-based damage/healing, status application/removal, revival, Gravity current-HP damage, percentage healing, multi-hit/random-per-hit casting, Retreat escape, and Banish all execute without Magick-name patches. Ally-specific status chances, target resistance/immunity, per-target reflection, defeated-target selection, revival HP percentages, scope-dependent power, and one-cost multi-target / multi-hit casting all flow through shared rules.

Primary remaining work includes:

- Verify every initial Magick ability against its canonical data through broader playtest/content coverage
- Implement undead restorative-damage interaction once undead battler identity/data is established

## Milestone Exit Condition

The initial Magick System is runtime-complete when all 54 current Magick abilities can execute their intended mechanics without requiring name-specific patches for behavior that should be reusable.

Summon Magick remains later Magick design work and is not required to complete the initial 54-ability Magick runtime. The separate **Skills** namespace is reserved for future non-Magick techniques, including Limit Skills.

---

# 💎 Milestone 3: Essence Runtime

The Essence data model, database loading, validation, and progression rules are established, but the player-facing runtime system remains to be built.

Completed runtime foundation now includes:

- Data-driven Essence slot counts on actors
- Player-facing Essence Equipment & Menu v1 with party-member switching
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

Primary work includes:

- Implement Enemy AI
- Define enemy action-selection rules
- Add status resistance / immunity data
- Implement legal target selection for enemy actions
- Support conditional and weighted decisions
- Establish the boss scripting foundation
- Support boss-specific mechanics through reusable battle systems

Enemy AI should decide what an enemy attempts to do. Shared battle systems should remain responsible for legality and effect resolution.

## Milestone Exit Condition

This milestone is complete when ordinary enemies can make meaningful legal battle decisions and the engine has a reusable foundation for scripted or conditional boss behavior.

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
- Design and implementation planning for Limit Skills

Character expansion should create meaningful differences in party composition rather than merely increasing the number of available actors.

## Milestone Exit Condition

The milestone is complete when the intended core party can be represented by the engine and party composition has the runtime support required for later character-specific systems.

Exact character designs should only be added to canonical documentation when deliberately established.

---

# 🌎 Milestone 6: World and Event Runtime

A JRPG battle engine eventually needs a world capable of carrying the adventure around it.

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

Primary candidates include:

- Summon Magick
- Limit Skills
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
- Limit Skills design
- Dual Tech design

Those decisions should become canonical when they are actually made.

No Architecture Fanfiction™ has been promoted to Roadmap Fanfiction™. 😄

---

# ❤️ The Road Ahead

Sektor 1 no longer needs to grow by asking what system we could build next.

It can grow by asking what foundation the next meaningful system needs.

The immediate answer is clear:

> **Status Runtime.**

That turns the 25-status design from canonical data into living battle behavior. Completing it unlocks deeper Magick interactions, which strengthens the foundation for Essences, enemies, bosses, characters, and everything that follows.

The road will change as the game teaches us what it needs. That is expected.

The important part is that we now have a road.

---

Built with ❤️ by **Sarah & Tyler**
