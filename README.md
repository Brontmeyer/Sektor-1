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
-   ✅ Battle EXP / Runes / item-drop rewards
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
-   ✅ Valor Menu Presentation & Progression Architecture v1
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
-   ✅ Game Options / Config Foundation v1
-   ✅ Field Choice Prompt Reveal hotfix
-   ✅ Custom Controls / Input Mapping v1
-   ✅ Config Submenu Presentation Consistency v1
-   ✅ Battle UI / Presentation Polish v1
-   ✅ Asset / UI Skinning Foundation v1
-   ✅ UI Style Integration Prototype v1
-   ✅ Menu Window Softening & Frame Polish v1
-   ✅ Main Menu Information & Command Layout v1
-   ✅ Main Menu Refinement & Command Availability Foundation v1
-   ✅ Main Menu Actor Selection & Order Foundation v1
-   ✅ Party Formation Ordering & Valor Visibility v1
-   ✅ Order Menu Presentation v1
-   ✅ Resource Color Consistency v1
-   ✅ Player Battle Row Geometry v1
-   ✅ Window Color Customization v1
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
-   ✅ Save / Load (version-aware Save Runtime v11)
-   ✅ Save-slot-independent Config Runtime v3
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
-   ✅ Runes, enemy item drops, and Essence Resonance rewards

Systems currently being expanded include:

-   ✅ Essence Equipment & Menu v1
-   ✅ Equip Menu Presentation & Stat Preview v1
-   ✅ Item Menu Presentation & Inventory Navigation v1
-   ✅ Order Menu Presentation v1
-   ✅ Character Menu Layout Consistency v1
-   ✅ Save / Load File Menu Presentation v1
-   ✅ Persistent Play Time v1
-   ✅ Config Menu Presentation v1
-   ✅ Status Menu Presentation v1
-   ✅ Essence Menu Presentation & List Navigation v1
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

Battle HUD & Message Layout v1 established reusable four-row geometry. Battle Presentation & Feedback v2 refines that experiment from hands-on playtesting: persistent top headers/messages are removed, action/state information uses compact transient banners, actor names stay in a fixed left roster, the main command window overlays a dedicated middle reserve, and HP/MP/Valor remain in stable right-side columns. Damage, Weak/Resist/Immune, and Critical feedback stay on the battlefield as popups; Critical also triggers a brief presentation-only flash. Battle Targeting & Scope Navigation v2 keeps targeting inside the same formation geometry: single-target selection now responds spatially in all four directions, optional All scope is hidden when the selected target bucket contains only one legal battler, and Pincer All targeting resolves against one selected enemy flank at a time rather than both flanks simultaneously. Enemy Formation Rows v1 expands encounter geometry to eight enemies through four front-row and four back-row positions. Rows auto-center when slots are omitted, or an encounter can explicitly choose `slot: 0..3`; pincer encounters apply the same row contract independently on each flank while retaining an eight-enemy total cap. Rows are positioning-only until weapon/ranged contracts intentionally give them combat meaning. Player Battle Row Geometry v1 closes the party-side presentation loop: saved front/back preference now changes actor battlefield X placement without changing combat authority. Normal and Back Attack keep front-row actors on the established party line and shift back-row actors farther from the enemy; Pincer uses stable mechanical-party parity so front actors step outward toward a consistent flank while back actors stay centered. A separate row-neutral target/combat position keeps row choice out of spatial target heuristics and rear-damage resolution, while sprites, cursors, effects, and popups still use the visible row position. Scan & Tactical Help v1 adds battle-local enemy analysis without duplicating combat data: Tactical Help is toggled through the configurable **Help** action, unscanned targets show `??`, and scanning a specific enemy instance reveals its live HP/MaxHP, MP/MaxMP, and elemental Weak/Resist/Immune categories derived directly from `elementRates`. Game Options / Config Foundation v1 gives player preferences their own versioned `ConfigManager`, separate from save slots. Custom Controls / Input Mapping v1 upgrades that owner to Config Runtime v2: gameplay code now asks `Input` for named actions rather than physical keys, the Options menu opens a dedicated Controls screen with two bindings per action, and runtime hints display the player’s current bindings instead of assuming the defaults. Battle UI / Presentation Polish v1 tightens the same presentation contracts without changing battle rules: the four-row HUD and command reserve consume less battlefield space, Tactical Help becomes a smaller translucent two-line panel, transient action/state banners fade at their edges, command focus uses restrained gold/blue-gray accents, contextual hints gain a soft backing, and target cursors use the same battle accent. All displayed controls continue to come from the player’s current input bindings. Asset / UI Skinning Foundation v1 adds a centralized named asset manifest with safe fallbacks, imports only a curated UI subset from the supplied RPG Maker MZ materials, and proves the path with optional side-view battler shadows. Renderers and windows no longer need to learn asset file paths or sprite-sheet geometry as future skinning expands. UI Style Integration Prototype v1 builds on that boundary with a softer framed JRPG presentation from the curated Adventure UI family: battle HUD/command/selectors use the blue-gray panel role, Options/Controls/main menu use the subdued menu panel role, selected rows use a reusable soft button treatment, and HP/MP/Valor use vector fills inside a neutral image-backed capsule frame. Resource Color Consistency v1 now gives those resources one shared identity everywhere: HP is blue-cyan, MP is green, and Valor is magenta-purple. The colored label and gauge carry that identity while current/max values remain neutral white for quick reading. Every image-backed surface still draws the established vector fallback first, so the visual skin can be swapped or removed without affecting behavior. Menu Window Softening & Frame Polish v1 refines that prototype centrally rather than hand-tuning consumers: semantic panels now use rounded clipping, a restrained outer shadow, and an inset highlight stroke; selection surfaces and gauge fills inherit the same softened silhouette. Individual scenes/windows still request semantic roles and remain unaware of source filenames or frame geometry.

------------------------------------------------------------------------

# ⚙️ Options / Config

Config Runtime v3 stores player preferences independently from Save Runtime v11, so loading a different game slot does not change pacing, presentation, ordering, keyboard bindings, or window colors. Current settings are **Battle Speed**, **Battle Message Speed**, **Field Message Speed**, **Battle Cursor** (Initial / Memory), and **Magick Order** (Default / Alphabetical / Element), plus dedicated **Window Color** and **Controls** screens. Window Color edits Top Left / Top Right / Bottom Left / Bottom Right RGB values with a live shared-window preview and a color-only reset; semantic panel rendering consumes those colors centrally while HP / MP / Valor colors remain owned by `UIResourcePalette`. Controls use named actions with two binding slots each; required navigation/confirm/back actions cannot be cleared completely, context-sensitive actions may intentionally share a key, and Reset Controls restores the canonical defaults. Existing Config Runtime v2/v1 preferences migrate automatically.

The main menu presents the active four party members through dedicated actor cards with Level, live HP/MP/Valor, current Status, and Next Level EXP, plus compact **RUNES**, TIME, and location panels. The redundant PARTY INFORMATION label is removed so the four cards use more of the vertical space, and the neutral near-black scene backdrop stays visually separate from the swappable window skin. The command stack follows the approved singular vocabulary: **Item / Magick / Skill / Essence / Equip / Status / Order / Valor / Config / ROSTER / Save / Load / Exit**. There is no redundant game-title or COMMANDS heading. Magick, Skill, Essence, Equip, Status, and Valor transfer focus into the active-party cards first; confirming an actor opens the existing character screen on that actor (including the dedicated Valor progression screen). **Order** reuses the same party focus: left/right edits persistent Back/Front presentation, while Confirm picks up a card and Confirm on another slot swaps the two actors' visual formation positions. The menu, battle HUD roster, and battlefield consume that visual order, but active-party membership, turn scheduling, stats, damage, targeting eligibility, and action priority remain independent of slot position. The saved row choice now also drives battlefield presentation: back-row actors stand farther from the enemy side in Normal/Back Attack, while Pincer front-row actors step outward toward their stable flank and back-row actors remain closer to party center. This row offset is deliberately excluded from target-selection heuristics and rear-damage calculations. `MenuAccessPolicy` owns command visibility/enabled state; **ROSTER (Remote Organization & Strategic Team Evaluation Registry)** is hidden by default until a future story system explicitly unlocks it, while maps may optionally restrict Save/Load and debug mode keeps development permissive. Persistent play time is now canonical on `Game_System`: the main menu presents live `HH:MM:SS`, and SAVE/LOAD persist the same elapsed-time value in optional v11 metadata so loading a file resumes its clock instead of restarting or deriving time from timestamps.

**Actor Naming + New Game Identity Foundation v1** makes character display names runtime-owned while actor IDs stay canonical. A new game opens a dedicated name-entry scene with **Tyler** already selected as the protagonist's default name; typing replaces it, Enter confirms, Backspace edits, and Escape restores the default. `Game_Actor` owns normalization/reset behavior, `Game_System` resolves actors by stable ID, and Save Runtime v11 already persists custom names without a version bump. Event dialogue can use `{actor:1}` (or another actor ID) in text, speaker names, prompts, and choice labels so renamed characters are reflected automatically. The validated `nameActor` event command reuses the same screen for future companion introductions; actual story recruitment remains the next party-foundation step.

------------------------------------------------------------------------

# 💎 Essence Menu

**Essence Menu Presentation & List Navigation v1** keeps the established actor-owned Essence equipment/runtime contract but gives it the same modern field-menu presentation language as MAGICK and SKILL. The selected actor uses the shared portrait/name/LV plus stacked HP/MP mini-gauge header. The selected Essence metadata panel shows Type / Element / Level / Resonance, followed by its canonical description. The lower-left surface preserves the real slot workflow: choose an equipped slot, then browse a two-column catalog with shared held-direction repeat, row scrolling, conditional `▲ / ▼` arrows, and duplicate-slot legality. The lower-right progression surface reads persistent `Game_Essence` state for current level, next Resonance milestone, Mastery Ready, and data-driven Magick Awakening entries. The pass does not invent Essence ownership filtering, passive execution, Mastery Trial completion, or Evolution behavior that the runtime does not yet own.

**Equip Menu Presentation & Stat Preview v1** replaces the old centered equipment box with the same full-screen character-menu language used by MAGICK / SKILL / ESSENCE. The actor summary uses `Window_ActorSummary`; the right header lists current Weapon / Armor / Accessory names in full; a description strip tracks the selected/current gear; and the lower surfaces separate slot/stat comparison from the equipment catalog. Browsing a candidate previews Attack, Attack %, Defense, Defense %, Magic Attack, Magic Defense, Magic Defense %, and Critical using the actor's real calculation APIs before Confirm commits through the existing equip/unequip methods. The list uses shared held-direction repeat plus `Window_ListViewport` scrolling. An **Essence Growth** presentation row currently defaults to `Normal`; it reserves a clean future gear-data contract but does not modify Resonance yet. MAIN MENU portrait placeholders are now square like the shared actor-summary portraits.

**Item Menu Presentation & Inventory Navigation v1** brings ITEM up to the same full-screen menu language while keeping it a direct MAIN MENU destination and explicitly treating inventory as party-owned rather than actor-owned. The top-left surface is a quiet **PARTY INVENTORY** identity panel instead of duplicating the currently highlighted target actor or dashboard-style counts; the active-party cards remain visible in the lower-left pane through Use, Arrange, and Key Items. The compact ITEM metadata panel shows only decision-useful state for the active page, while the wrapped description strip carries contextual instructions and selected-item descriptions. **Use / Arrange / Key Items** share one exact three-column tab grid so their spacing cannot drift between pages. Hands-on refinement keeps focus deliberately hierarchical: ITEM opens with the gold cursor on **Use** only; Confirm enters the inventory list; confirming a usable item locks it as the pending choice and moves to party-target selection; successful use keeps that same item armed so it can be applied repeatedly across valid actors until Cancel or depletion. Owned Weapons / Armor / Accessories also appear in the inventory and Arrange preview with muted unavailable styling for party-inventory context, but Confirm never routes them into item use and EQUIP remains the sole equipment authority. The pending usable item remains visibly marked and its name / quantity / target are repeated in the metadata and description surfaces, so quantity changes are never the only feedback. Q/Esc reverses one interaction level. **Arrange** offers only the implemented orders (`Default`, `Name`, `Most`, `Least`); entering Arrange opens a temporary sort-order popup over the preview, applying an order closes it, and focus returns directly to the Arrange heading without replacing the party pane. **Key Items** keeps its metadata panel quiet while focus is still on the heading and only reveals selected-item information after the player enters the list. Four active-party cards retain complete LV / status / HP / MP presentation throughout the three tabs. **Key Items** has a canonical data/runtime contract: `keyItem: true` records may be permanent or consumable, use `effect: null`, stay out of battle item selectors, and use the semantic soft-rose Key Item emphasis in the dedicated tab. Story events use the validated `ifKeyItem` command to branch on possession; `consume: true` requests one-copy consumption, but only a Key Item whose database record has `consumable: true` is removed. Permanent Key Items still satisfy the event and remain owned. Map001 includes a development-only Test Key chest so populated Key Items presentation can be verified directly.

**Order Menu Presentation v1** turns ORDER into its own full-screen party-formation destination instead of editing formation inside the main-menu card stack. The screen shows party-wide formation context, selected slot / row / pending-swap metadata, a vertically centered contextual description strip, and the familiar four actor cards below. It deliberately composes the existing `Window_MainMenuParty` order interaction rather than reimplementing formation mechanics: Left / Right still write `Game_Party` front/back row state, Confirm still picks up and swaps visual formation slots, and Cancel first drops a pending swap before closing the screen. Formation order remains presentation-only and does not rewrite active-party mechanical order, turn scheduling, stats, damage, or targeting rules.

**Character Menu Layout Consistency v1** centralizes the top-level geometry shared by MAGICK / SKILL / ESSENCE / EQUIP / STATUS / VALOR / ITEM. `CharacterMenuLayout` owns the common screen margin, actor-summary height, metadata-panel width, inter-panel gap, description strip, and reusable content split helper so those screens no longer drift by a handful of pixels as each receives future work. EQUIP and ESSENCE now intentionally use the same 50/50 lower-content split. Permanent bottom key legends have been removed from the mature menu destinations so focus, selection rectangles, arrows, page labels, and ordinary platform conventions carry routine navigation; specialized screens such as Controls / Window Color may still explain uncommon interactions.

**Save / Load File Menu Presentation v1** uses one shared reference-inspired file browser for both commands. A compact header reads **Select a file. / FILE 01 / SAVE** (or LOAD), while three large horizontal file cards dedicate separate space to larger saved-party portrait placeholders, leader / level / location, and saved date-time / persistent **TIME** / RUNES. The location box deliberately stops short of the right metadata divider so the center and metadata regions do not visually collide. Empty files read **EMPTY** plainly. `Window_SaveSlots` remains presentation/selection only: SAVE still calls `SaveManager.save()` and LOAD still calls `SaveManager.load()` through `Scene_Menu`. Save Runtime remains v11; play time is additive optional metadata, so older v11 files load with a zero clock rather than requiring a format migration.

**Config Menu Presentation v1** replaces the older gray standalone options sheet with Sektor 1's established framed menu language. A compact top split keeps the selected setting description on the left and **CONFIG** identity on the right; the lower panel gives each setting a spacious row with the project-standard dim focus rectangle and gold `▶` cursor. Existing `ConfigManager` values remain authoritative, while **Window Color** and **Controls** continue opening their dedicated editors instead of duplicating configuration state inside the presentation layer.

**Config Submenu Presentation Consistency v1** gives **CONTROLS** and **WINDOW COLOR** the same description/title header split and framed content geometry as CONFIG through shared `ConfigMenuLayout`. Specialized rebinding and RGB-edit instructions now live in the contextual header instead of footer legends, while `ConfigManager` remains the sole authority for bindings and window colors. Character-menu description strips now use shared vertically centered wrapped text so one- and two-line descriptions sit naturally in the middle without losing left alignment.

**Field Dialogue Window Presentation v1** brings `Window_Message` and `Window_Choice` onto the same semantic `menuPanel` / `accentPanel` rendering path used by the rest of the UI, so player-configured Window Color affects dialogue instead of leaving field conversations as separate black-and-white boxes. Choice focus uses the same dim selection surface and gold `▶` cursor language as menus. Dialogue text is constrained to four wrapped lines per page, including long unbroken tokens, and the mint-teal `▼` replaces the old persistent key legend: it blinks only when another dialogue page or later `text` command still follows in the current dialogue run, and disappears on the final text command or while choices own focus. Choice prompts do not open their choices until the full prompt is revealed, so Confirm used to finish typewriter text cannot accidentally choose the default response.

------------------------------------------------------------------------

# ✨ Magick

**Magick Menu Presentation & List Navigation v1** gives field Magick its own reference-inspired information hierarchy after the player chooses an active party member from MAIN MENU. The screen uses the shared actor-summary contract with a portrait placeholder, actor name and LV, then stacked HP/MP values with one mini gauge beneath each resource; the remaining header width stays intentionally quiet for future contextual mechanics. A selected-Magick panel presents Category / Element / Scope / MP Cost above a description strip and three-column learned-Magick grid. The grid keeps `ConfigManager.sortMagick()` as ordering authority and preserves current field-use rules by dimming Magick that cannot be executed from the field. Directional navigation owns all four directions inside this screen; the chosen actor stays fixed while browsing. Long learned lists scroll by grid row with arrows shown only when more rows exist above/below. Held directions use the shared `Input.isActionRepeated()` contract so an initial press moves once and a continued hold repeats after a short delay.


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

**Valor Arts Runtime v1** still specializes the same Skills namespace through `valorArt: true`. A Valor Art is usable only while its actor is Valor Ready and spends the existing full gauge exactly once when the action is committed against at least one legal target. The battle Skills selector still marks Valor Arts with `[VALOR]` because combat selection continues to reuse the proven Skill runtime. The field **SKILL** menu intentionally excludes Valor Arts so ordinary non-Magick techniques such as Scan have a clean player-facing home while the dedicated Valor destination owns their progression presentation without duplicating the action engine.

**Valor Menu Presentation & Progression Architecture v1** gives Valor its own Limit-inspired four-level character screen while retaining Sektor 1's established window language. `valorLevel` is optional validated Valor-Art metadata from 1-4; the four canonical starter Arts are Level 1. `Game_Actor` derives known Valor Arts, per-level groups, and the highest known Valor level from learned Skill IDs, so no duplicate ability inventory or new save field is introduced. The screen reuses `Window_ActorSummary`, shows the live Valor gauge/state, selected-Art description, and LEVEL 1-4 groups. Left/right switches active actors, up/down browses learned Arts, and missing future levels truthfully read **No Arts learned**. Long-term unlock conditions and additional Arts remain separate design work.

**Skill Menu Presentation & List Navigation v1** replaces the old compact field viewer with the same broad information grammar used by MAGICK: the same shared stacked-vitals actor summary, selected-Skill Category / Effect / Target / Scope metadata, bounded description strip, and a three-column learned-Skill grid. All four directions navigate the grid with shared held-repeat behavior, row scrolling and conditional arrows; the actor selected before entry stays fixed while browsing. The screen remains informational/read-only for now rather than inventing field-use semantics for battle-oriented techniques. Skills UI Integration Cleanup v1 continues to make the battle selector a first-class rendered battle window. Enemy Skills & AI Integration v1 still lets enemy action data reference the same canonical Skill records through `skillId`; enemy use follows the shared Skill legality, targeting, physical damage, healing, and status-effect contracts. Long-term Skill/Valor Art unlock progression, additional effect types, and additional resource models remain future design work.

Battle Command Navigation & Side Actions v1 keeps the visible command list to **Attack / Skills / Magick / Item**. Left input reveals a temporary Escape side panel and right input reveals a temporary Defend side panel; neither exists visually until requested. Valor & Escape Rules v1 moves normal Escape resolution into `BattleManager`: escapable encounters roll from party/enemy average Agility, failed legal attempts consume the active actor's turn and improve the next chance, while `canEscape: false` remains an absolute no-roll gate. Retreat Magick stays a guaranteed escape in escapable encounters but cannot bypass that encounter gate; blocked Retreat is rejected before MP or a turn is spent. Backing out of Skill or Magick target selection returns one navigation level to the originating selector with that selector's current cursor preserved. Pass 46 makes the Escape/Defend tabs flush with the command panel's top and side edges and moves the command panel into the HUD's reserved middle column, leaving the name roster visible while commands are open.

------------------------------------------------------------------------

# 🔥 Valor

**Valor** is Sektor 1's pressure-response battle resource. Actors build passive Valor from actual hostile opposing-side battle-action HP loss, with the base gain proportional to the percentage of Max HP lost. Fury, Sadness, and Near-Death modify that gain through the shared data-driven `valorGainMultiplier` status contract.

Current actors have a data-driven Max Valor of 100. Valor persists between battles and through Save Runtime v11, caps at the actor's configured maximum, and is shown in the battle HUD, Status menu, and main-menu actor cards. Fractional gain is displayed to one decimal when needed so small valid hits remain visible. A full gauge becomes **VALOR: READY**.

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

The current Save Runtime v11 persists both equipped accessory IDs and party accessory inventory. The existing test chest can award a Power Wrist through the validated accessory event-command path.

------------------------------------------------------------------------

# 💰 Shops & Economy

Shops & Runes Spending turns existing currency rewards and canonical merchandise price metadata into a playable Buy / Sell loop. Map events open a merchant with an explicit `shopType` (`general`, `item`, `weapon`, `armor`, or `accessory`) plus a validated list of merchandise. General stores may mix categories; specialized shops accept only their matching merchandise type for both Buy and Sell. Event data chooses **what is stocked**, while the merchandise database remains the sole purchase-price authority.

`Game_Party` owns both transaction boundaries. Purchases validate quantity and available Runes before inventory/currency mutation. Sales use a canonical 50% resale value, refuse records marked `sellable: false`, and reserve every currently equipped weapon / armor / accessory copy so presentation can never sell gear out from under an actor. The same party boundary now enforces physical equipment ownership: one owned copy may be assigned to one actor, surplus copies allow additional actors, and legacy over-equipped save states are reconciled after load. Failed transactions leave inventory and currency unchanged.

The current presentation opens on a merchant introduction rather than previewing stock. **Buy** uses a scrollable merchandise list, a clean details panel, quantity confirmation, and roster-wide stat previews for weapons / armor / accessories. **Sell** keeps a stable two-column inventory order and opens the same quantity-confirmation pattern with sell price, available count, selected quantity, and total Runes received. Save Runtime is unchanged because shops consume existing persistent currency, inventory, and equipment state. The underlying runtime API retains its historical `gil` naming for compatibility, while all player-facing UI says **Runes**.

### Creating a shopkeeper

A map shopkeeper is an ordinary event whose page contains one `shop` command. `name` is the **person shown to the player**, while `shopType` controls the store identity and category rules. For example:

```json
{
  "code": "shop",
  "name": "John Doe",
  "shopType": "weapon",
  "goods": [
    { "type": "weapon", "id": 1 },
    { "type": "weapon", "id": 2 }
  ]
}
```

Valid `shopType` values are `general`, `item`, `weapon`, `armor`, and `accessory`. General stores may stock any category; specialized stores must contain only their matching type. Merchandise IDs always reference the matching database file (`Items.json`, `Weapons.json`, `Armors.json`, or `Accessories.json`). Map001 contains one fixture for General Store, Weapon Store, Armor Store, and Accessory Store as copyable examples.

Key-item story gates use the same event-command DSL. `ifKeyItem` accepts an `itemId`, optional `consume` boolean, and `trueCommands` / `falseCommands`. Omitting `consume` performs a possession check only. Setting `consume: true` requests one-copy consumption: consumable Key Items lose one copy, while permanent Key Items still satisfy the event and remain owned. Map001 includes a Test Key chest plus a Test Key Lock as copyable authoring fixtures.

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


## Party Recruitment Foundation

New Game starts with the configured protagonist only. Additional actors live in the runtime actor registry and join the playable roster through event commands such as `recruitActor`, allowing story scenes to grow the party over time while save/load preserves recruited and met companions.
