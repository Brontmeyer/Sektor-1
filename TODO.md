# 🎮 Sektor 1 TODO

This file tracks unfinished development work only.

Canonical game data belongs in the appropriate database files:
- `data/Accessories.json`
- `data/Magick.json`
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
- [x] Fury / Sadness / Near-Death Valor multiplier runtime contract
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
- [x] Present EXP, Runes, item drops, level-ups, Essence Resonance, awakened Magick abilities, and Mastery Ready transitions
- [x] Implement Battle Presentation & Feedback v1
- [x] Present encounter name and active party battler during player-command flow
- [x] Replace permanent test-battle footer copy with context-sensitive command/selection/target/outcome hints
- [x] Bound recent battle messages and keep the command window suppressed during target selection
- [x] Implement Battle Command Navigation & Side Actions v1
- [x] Keep the visible command list to Attack / Skills / Magick / Item with temporary Escape-left and Defend-right panels
- [x] Make normal Escape a stat-driven roll; failed legal attempts consume a turn and improve retry chance
- [x] Keep non-escapable encounters as an absolute no-roll gate, including Retreat Magick
- [x] Return target-cancel input to the originating Skills/Magick selector with cursor position preserved
- [x] Implement Battle Formation & Party Layout v1 (normal / back attack / pincer)
- [x] Implement Battle HUD & Message Layout v1 with four stable actor rows and reusable HUD geometry
- [x] Implement Battle Presentation & Feedback v2 from hands-on playtest feedback
- [x] Replace persistent top header/message panels with compact transient action/state banners
- [x] Keep damage / Weak / Resist / Immune / Critical feedback on the battlefield; add brief Critical screen flash
- [x] Integrate actor names, command reserve, and HP/MP/Valor columns in one stable bottom HUD
- [x] Keep Back Attack party positions on the left and apply rear-exposure bonus only to physical damage
- [x] Implement Enemy Formation Rows v1 with an eight-enemy cap, four front/four back slots, auto-centering, explicit placement, and pincer-aware flank rows
- [x] Implement Battle Targeting & Scope Navigation v2
- [x] Collapse optional All scope when only one legal target exists in the current target bucket
- [x] Support four-direction spatial targeting across normal/back-attack/pincer layouts without wraparound
- [x] Limit Pincer All targeting to one selected enemy flank at a time and allow left/right flank switching
- [x] Implement Scan & Tactical Help v1 with battle-local per-enemy knowledge, H-toggle help, live HP/MP, and elemental Weak/Resist/Immune detail
- [x] Implement Game Options / Config Foundation v1 with save-slot-independent persistence
- [x] Add Battle Speed, Battle Message Speed, Field Message Speed, Battle Cursor Memory, and Magick Order runtime settings
- [x] Add fullscreen Options scene and main-menu entry
- [x] Implement Custom Controls / Input Mapping v1 with named actions, persistent two-slot bindings, dynamic hints, and rebinding UI
- [x] Implement Battle UI / Presentation Polish v1 with tighter HUD/command geometry, translucent Tactical Help, banner fades, contextual hint backing, and target/selection accents
- [x] Implement Asset / UI Skinning Foundation v1 with centralized asset loading, curated UI assets, fallbacks, windowskin/icon primitives, and optional battle shadows
- [x] Apply UI Style Integration Prototype v1 selectively to battle/menu windows with semantic asset roles and vector fallbacks
- [x] Apply Menu Window Softening & Frame Polish v1 through centralized rounded clipping, inset framing, shadows, and softened gauge/selection silhouettes
- [x] Apply Resource Color Consistency v1 through shared `UIResourcePalette` ownership: HP blue-cyan, MP green, Valor magenta-purple across primary party resource surfaces
- [ ] Continue final UI skin curation after hands-on visual review; keep all art swappable through `UIAssetManager`
- [x] Add Window Color Customization v1 under Config with four persistent corners, live preview, RGB editing/reset, and centralized shared-panel tinting through Config Runtime v3 / `UIAssetManager`
- [x] Add Config Menu Presentation v1 with unified framed layout, contextual description header, project-standard focus cues, and preserved Controls / Window Color routing
- [x] Add Config Submenu Presentation Consistency v1 with shared CONFIG / CONTROLS / WINDOW COLOR geometry, contextual editor guidance, and no duplicate config ownership
- [x] Vertically center shared character-menu description strips while preserving left alignment and consistent wrapped-text bounds
- [x] Unify field dialogue / choices with the shared tintable window-panel language and configured Window Color palette
- [x] Remove permanent key-legend footers from established menu destinations while preserving contextual instructions for specialized editors / interactions
- [x] Align EQUIP / ESSENCE lower panes to one shared center split and move ITEM tabs above the item-side pane so four actor cards retain full HP/MP presentation
- [x] Add Magick Menu Presentation & List Navigation v1 with actor summary, selected-Magick details, three-column scrolling grid, conditional arrows, shared held-direction repeat, Config naming, and white RUNES value presentation
- [x] Add Skill Menu Presentation & List Navigation v1 with ordinary-technique filtering, actor summary/detail hierarchy, three-column scrolling grid, conditional arrows, shared held-direction repeat, and MAGICK/main-menu identity-layout consistency
- [x] Add Equip Menu Presentation & Stat Preview v1 with shared actor summary, full Weapon/Armor/Accessories labels, description strip, held-repeat equipment browsing, live stat comparison, and square main-menu portrait consistency
- [x] Add Item Menu Presentation & Inventory Navigation v1 with shared actor summary, Use/Arrange/Key Items tabs, target-aware field item use, supported sort previews, and key-item empty-state handling
- [x] Refine ITEM focus/vitals/layout after hands-on review and standardize character-menu header geometry through shared `CharacterMenuLayout` ownership
- [x] Refine ITEM as party-owned inventory with a PARTY INVENTORY header, exact three-column tabs, and muted read-only equipment rows while preserving EQUIP ownership
- [x] Lock ITEM Use / Arrange / Key Items to one shared content rhythm and add target-card breathing room before the center divider
- [x] Add Save Menu Presentation & Slot Summary v1 with full-screen slot cards, existing-save summaries, empty-slot states, and preserved Save Runtime v11 authority
- [x] Refine SAVE/LOAD into reference-inspired file-card presentation and complete Load Menu Presentation v1 without changing Save Runtime v11
- [x] Refine ITEM interaction to Use → Item → Target focus, persistent pending-item identity, hierarchical cancel, and automatic Arrange-heading return after sort apply
- [x] Add Status Menu Presentation v1 with shared actor summary, Main / Element / Effect pages, actor-safe page switching, live elemental/status runtime presentation, and Equip footer-overlap cleanup
- [x] Add Essence Menu Presentation & List Navigation v1 with shared stacked-vitals actor summary, slot/catalog equipment flow, two-column held-repeat catalog navigation, progression/Mastery Ready preview, and Magick Awakening presentation
- [x] Implement Main Menu Information & Command Layout v1 with four active-party cards, live HP/MP/Valor/Level/Status/Next Level information, currency/location panels, and singular command labels
- [x] Implement Main Menu Refinement & Command Availability Foundation v1 with restored Load, RUNES labeling, tighter party-card spacing, richer default menu color, generic command visibility/enabled states, and future map-based Save/Load restrictions
- [ ] Select/integrate canonical character portrait art for the main-menu portrait slots
- [x] Add canonical persistent play-time tracking with main-menu HH:MM:SS and Save/Load persistence
- [x] Implement Main Menu Actor Selection & Order Foundation v1 with shared party-card focus, actor handoff, persistent front/back row state, portrait-position row language, and ROSTER hidden-by-default policy
- [x] Extend Order with persistent active-party visual formation swapping (positions 1-4) without changing mechanical party/turn order
- [x] Add Order Menu Presentation v1 as a dedicated full-screen formation editor while reusing the existing party-row and formation-slot runtime
- [x] Connect player front/back row state to battlefield geometry as presentation only; keep row/slot position free of damage, weapon, targeting, or stat advantages unless the design is explicitly revisited
- [x] Separate player-facing multi-level Valor progression from the ordinary Skill menu while reusing the shared Skill action runtime
- [ ] Implement ROSTER (Remote Organization & Strategic Team Evaluation Registry) for active/reserve party switching once reserve characters exist
- [x] Polish Tactical Help bar size/transparency during the battle UI presentation pass

---

# 💰 Economy

- [x] Persistent Runes rewards (legacy internal `gil` runtime naming retained)
- [x] Price metadata for items, weapons, armor, and accessories
- [x] Shops / Runes Spending v1
- [x] Shop Presentation v2 with merchant intro, quantity-aware Buy/Sell flow, roster equipment comparison, and equipped-copy sale protection
- [x] Enforce physical-copy equipment ownership across the roster so one owned Weapon / Armor / Accessory copy cannot be shared by multiple actors
- [x] Shop Type Metadata & Presentation v1 with general/item/weapon/armor/accessory identities and category-scoped Buy/Sell lists
- [x] Shopkeeper authoring fixtures v1 with General / Weapon / Armor / Accessory examples on Map001 and person-name/store-type separation
- [x] Dialogue pagination & choice-gating polish with four-line wrapping, long-token containment, and no reveal-to-choice Confirm leakage
- [x] Semantic UI Theme Palette v1 for focus / accent / comparison / text / backdrop roles
- [x] Dialogue continuation indicator with blinking same-speaker `▼`, solid end-pause state, and choice suppression

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
- [x] Present Essence equipment/progression through the full-screen shared actor-summary menu with scrolling catalog and live Resonance milestones
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
- [x] Implement Valor gauge/runtime and consume status Valor multipliers

---

# 🥋 Skills

- [x] Define the canonical Skills Runtime v1 data model for non-Magick physical techniques
- [x] Implement actor-owned Skill learning/forgetting and independent `skillIds` persistence
- [x] Implement battle Skill targeting/execution through shared action restrictions and the physical-damage pipeline
- [x] Add battle and field Skills windows with shared character-menu navigation
- [x] Integrate the battle Skills selector into rendering and bound long Skills/Magick field descriptions
- [x] Add the first Skill resource specialization through Valor Arts Runtime v1
- [ ] Define additional Skill costs/resources beyond Valor when approved designs require them
- [x] Expand Skills beyond physical-damage techniques with reusable percentage-heal and status-application effects required by Character Valor Arts v1
- [x] Add enemy Skill actions through the shared Skills runtime with the first canonical enemy technique
- [x] Define Valor Arts Runtime v1 within the Skills namespace (legacy/current runtime foundation)
- [x] Refactor player-facing Valor progression into its dedicated menu/system while reusing the established Skill action engine
- [x] Design the first canonical character-specific Valor Arts
- [ ] Design long-term Valor Art unlock/progression rules

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
- [x] Canonical character-specific Valor Arts v1
- [ ] Additional character Valor Arts and progression

---

# 🤖 Enemies

- [x] Enemy Actions & AI v1
- [x] Enemy Skills & AI Integration v1
- [x] Boss / Phase AI v1 with data-driven HP thresholds and phase action pools
- [ ] Advanced boss scripting effects and encounter-specific phase mechanics
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
- [x] Save Runtime v11 with persistent learned Skills/Valor/equipment/Essence/party-row/visual-formation state, v10 formation-order migration, v9 row-default migration, and preserved v1-v8 starter-Art migrations
- [x] Harden current core database runtime contracts
- [x] Validate loaded map/event contracts before runtime use
- [x] Centralize actor/party ownership and retire active `$gameActor` dependencies
- [x] Complete repository-audit closure (`docs/audit_closure.md`)
- [x] Equipment system
- [x] Accessories Equipment v1
- [x] Inventory system
- [x] Shops / Runes Spending v1
- [x] Standardize left/right party-member navigation in Skills, Magick, Status, Equipment, and Essence menus
- [x] Complete status runtime
- [ ] Complete Essence runtime
- [x] Enemy Actions & AI v1
- [x] Enemy Skills & AI Integration v1
- [x] Boss / Phase AI v1
- [ ] Advanced boss scripting and phase effects
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
