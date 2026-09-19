# 🎮 Sektor 1 TODO

This file tracks unfinished development work only.

Canonical game data belongs in the appropriate database files:
- `data/Accessories.json`
- `data/Magick.json`
- `data/Essences.json`
- `data/Statuses.json`

Completed systems and design rules should be documented rather than duplicated here.

---

# ⚔️ Battle System

## Status System

- [x] Design Statuses.json v1
- [x] Define 25 initial status effects
- [x] Define status families
- [x] Define duration types
- [x] Define reusable status effect properties
- [x] Define countdown statuses
- [x] Define derived statuses
- [x] Load `Statuses.json` through the database system
- [x] Implement status application and removal
- [x] Implement status duration processing
- [x] Implement turn-based status countdowns
- [x] Implement derived status evaluation
- [x] Implement status immunity / resistance checks
- [x] Implement status stacking and interaction rules
- [x] Implement status UI indicators
- [x] Implement Fury / Sadness mutual exclusivity
- [x] Implement post-battle Death recovery behavior

## Status Effect Mechanics

- [x] Poison / Dual damage-over-time
- [x] Regen healing-over-time
- [x] Barrier / MBarrier damage reduction
- [x] Reflect Magick reflection
- [x] Haste / Slow turn-speed modifiers
- [x] Stop / Paralyze action prevention
- [x] Stop turn-progression halt semantics
- [x] Sleep / Confuse physical-damage removal
- [x] Confuse random targeting
- [x] Silence action-type restrictions
- [x] Petrify defeat-state handling
- [x] Death defeat / revival handling
- [x] Berserk forced physical attacks
- [x] Fury / Sadness / Near-Death Limit multiplier runtime contract
- [x] Darkness physical accuracy reduction
- [x] Frog restricted actions
- [x] Small physical damage modifiers
- [x] Death-Sentence countdown → Death
- [x] Slow-Numb countdown → Petrify
- [x] Near-Death derived HP state
- [x] Shield physical immunity
- [x] Shield elemental Magick absorption

---

## Battle Rewards

- [x] Implement battle currency rewards
- [x] Implement enemy item drop tables and award resolution
- [x] Implement battle Essence Resonance rewards

## Battle Presentation

- [x] Implement Battle Results Screen v1
- [x] Present EXP, Gil, item drops, level-ups, Essence Resonance, awakened Magick abilities, and Mastery Ready transitions

---

# 💰 Economy

- [x] Persistent Gil rewards
- [x] Price metadata for items, weapons, armor, and accessories
- [x] Shops / Gil Spending v1

---

# 💎 Essence System

- [x] Design Essences.json v1
- [x] Create 19 initial Essences
- [x] Assign all 54 current Magick abilities to Essences
- [x] Define Resonance progression
- [x] Define Mastery Ready at 1500 Resonance
- [x] Define Level 4 passive abilities
- [x] Define Mastery Trial concept
- [x] Define Essence Evolution eligibility
- [x] Implement Essence database loading
- [x] Implement player-facing Essence equipping UI / slot rules
- [x] Implement Resonance gain
- [x] Implement Essence leveling
- [x] Implement Mastery Ready state
- [ ] Define long-term Essence acquisition / ownership rules
- [ ] Implement Mastery Trial completion
- [ ] Implement Level 4 passive effects
- [ ] Design Mastery Trial quests
- [ ] Design Essence Evolution recipes
- [ ] Implement Essence Evolution

---

# ✨ Magick

- [x] Complete Magick.json v1
- [x] Define 54 initial Magick abilities
- [x] Define Restore Magick
- [x] Define Attack Magick
- [x] Define Indirect Magick
- [x] Define Advanced Magick
- [x] Implement remaining Magick mechanics required by Magick.json
- [x] Implement status interaction with Magick
- [ ] Implement undead restorative-damage interaction
- [ ] Design Summon Magick
- [ ] Implement Limit gauge/runtime and consume status Limit multipliers

---

# 🥋 Skills (Future Non-Magick Techniques)

- [ ] Define the canonical Skills data model for non-Magick techniques
- [ ] Define Skills costs/resources and battle execution rules
- [ ] Design Limit Skills within the future Skills namespace

---

# 👥 Characters

- [x] Character 2
- [x] Character 3
- [x] Character 4
- [ ] Character 5
- [ ] Character 6
- [ ] Character 7
- [ ] Character 8
- [ ] Party Switching
- [ ] Dual Techs
- [ ] Limit Skills

---

# 🤖 Enemies

- [x] Enemy Actions & AI v1
- [ ] Boss scripting system
- [ ] Status resistance / immunity data
- [x] Enemy action-selection rules
- [ ] Boss-specific mechanics

---

# 🌎 World

- [ ] World Map
- [ ] Towns
- [ ] Dungeons
- [ ] Side Quests
- [ ] Event scripting
- [ ] Cutscene system

---

# 🛠️ Engine

- [x] Modular engine architecture
- [x] Shared Game_Battler system
- [x] Party foundation
- [x] Turn queue
- [x] Multi-character turns
- [x] Save / Load
- [x] Save Runtime v6 with accessory inventory/equipment, slot-aware Essence progression persistence, and v1-v5 migration
- [x] Harden current core database runtime contracts
- [x] Validate loaded map/event contracts before runtime use
- [x] Centralize actor/party ownership and retire active `$gameActor` dependencies
- [x] Complete repository-audit closure (`docs/audit_closure.md`)
- [x] Equipment system
- [x] Accessories Equipment v1
- [x] Inventory system
- [x] Shops / Gil Spending v1
- [x] Standardize left/right party-member navigation in Magick, Status, Equipment, and Essence menus
- [x] Complete status runtime
- [ ] Complete Essence runtime
- [x] Enemy Actions & AI v1
- [ ] Boss scripting
- [ ] Event scripting
- [ ] Cutscene system

---

# 📚 Documentation

- [ ] Update README.md
- [ ] Write docs/architecture.md
- [ ] Write docs/battle_system.md
- [ ] Write docs/coding_style.md
- [ ] Write docs/design_bible.md
- [ ] Write docs/roadmap.md

`docs/ideas.md` remains a sandbox for unapproved concepts and does not represent canonical game design.
