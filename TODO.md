# 🎮 Sektor 1 TODO

This file tracks unfinished development work only.

Canonical game data belongs in the appropriate database files:
- `data/Skills.json`
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
- [x] Reflect spell reflection
- [x] Haste / Slow turn-speed modifiers
- [x] Stop / Paralyze action prevention
- [ ] Stop turn-progression halt semantics
- [x] Sleep / Confuse physical-damage removal
- [x] Confuse random targeting
- [x] Silence skill-type restrictions
- [x] Petrify defeat-state handling
- [x] Death defeat / revival handling
- [x] Berserk forced physical attacks
- [ ] Fury / Sadness Limit modifiers
- [x] Darkness physical accuracy reduction
- [x] Frog restricted actions
- [x] Small physical damage modifiers
- [x] Death-Sentence countdown → Death
- [x] Slow-Numb countdown → Petrify
- [x] Near-Death derived HP state
- [x] Shield physical immunity
- [x] Shield elemental magic absorption

---

## Battle Rewards

- [ ] Implement battle currency rewards
- [ ] Implement enemy item drop tables and award resolution
- [ ] Implement battle Essence Resonance rewards

---

# 💎 Essence System

- [x] Design Essences.json v1
- [x] Create 19 initial Essences
- [x] Assign all 54 current skills to Essences
- [x] Define Resonance progression
- [x] Define Mastery Ready at 1500 Resonance
- [x] Define Level 4 passive abilities
- [x] Define Mastery Trial concept
- [x] Define Essence Evolution eligibility
- [ ] Implement Essence database loading
- [ ] Implement Essence equipping
- [ ] Implement Resonance gain
- [ ] Implement Essence leveling
- [ ] Implement Mastery Ready state
- [ ] Implement Mastery Trial completion
- [ ] Implement Level 4 passive effects
- [ ] Design Mastery Trial quests
- [ ] Design Essence Evolution recipes
- [ ] Implement Essence Evolution

---

# ✨ Skills

- [x] Complete Skills.json v1
- [x] Define 54 initial skills
- [x] Define Restore Magic
- [x] Define Attack Magic
- [x] Define Indirect Magic
- [x] Define Advanced Magic
- [ ] Implement remaining skill mechanics required by Skills.json
- [x] Implement status interaction with skills
- [ ] Implement undead restorative-damage interaction
- [ ] Design Summon Magic
- [ ] Design Limit Skills

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

- [ ] Enemy AI
- [ ] Boss scripting system
- [ ] Status resistance / immunity data
- [ ] Enemy skill selection rules
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
- [x] Equipment system
- [x] Inventory system
- [ ] Complete status runtime
- [ ] Complete Essence runtime
- [ ] Enemy AI
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
