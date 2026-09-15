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
- [ ] Load `Statuses.json` through the database system
- [ ] Implement status application and removal
- [ ] Implement status duration processing
- [ ] Implement turn-based status countdowns
- [ ] Implement derived status evaluation
- [ ] Implement status immunity / resistance checks
- [ ] Implement status stacking and interaction rules
- [ ] Implement status UI indicators
- [ ] Implement Fury / Sadness mutual exclusivity
- [ ] Implement post-battle Death recovery behavior

## Status Effect Mechanics

- [ ] Poison / Dual damage-over-time
- [ ] Regen healing-over-time
- [ ] Barrier / MBarrier damage reduction
- [ ] Reflect spell reflection
- [ ] Haste / Slow turn-speed modifiers
- [ ] Stop / Paralyze action prevention
- [ ] Sleep / Confuse physical-damage removal
- [ ] Confuse random targeting
- [ ] Silence skill-type restrictions
- [ ] Petrify defeat-state handling
- [ ] Death defeat / revival handling
- [ ] Berserk forced physical attacks
- [ ] Fury / Sadness Limit modifiers
- [ ] Darkness physical accuracy reduction
- [ ] Frog restricted actions
- [ ] Small physical damage modifiers
- [ ] Death-Sentence countdown → Death
- [ ] Slow-Numb countdown → Petrify
- [ ] Near-Death derived HP state
- [ ] Shield physical immunity
- [ ] Shield elemental magic absorption

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
- [ ] Implement status interaction with skills
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
