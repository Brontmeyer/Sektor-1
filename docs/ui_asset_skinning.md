# UI Asset Skinning Foundation

Pass 54 establishes one presentation-asset boundary for Sektor 1 instead of letting renderers and windows hard-code image paths.

## Curated RPG Maker MZ system assets

The user-provided `rmmz` archive contains a mixture of engine code, plugins, system graphics, and effect resources. Pass 54 deliberately imports only four system images into `js/sprites/ui/rmmz/`:

- `Window.png` -> `windowSkin`
  - Useful as a reusable windowskin source: background, frame slices, cursor region, and palette.
  - Not treated as the final Sektor 1 look. The vector presentation remains the safe fallback while later skinning decides where an image-backed frame genuinely improves the game.
- `IconSet.png` -> `iconSet`
  - Strong candidate for future item, equipment, Magick, Skill, status, and elemental icon presentation.
  - `UIAssetManager.drawIcon()` exposes 32x32 indexed extraction without teaching consumers the sheet geometry.
- `ButtonSet.png` -> `buttonSet`
  - Reserved for future controller/touch/input presentation. Keyboard hints remain generated from Config Runtime v2 and are not replaced by static button art.
- `Shadow2.png` -> `battleShadow`
  - Selected immediately because it visually grounds side-view battlers without changing combat rules.
  - `BattleRenderer` uses it through `UIAssetManager`; if unavailable, battle rendering simply continues without the decorative shadow.

## Good later candidates from the supplied pack

Several effect textures are visually useful but belong in a dedicated battle-VFX pass rather than UI skinning: `Ring`, `HexCircle`, `LightRing`, `Shield`, `ParticleAlpha`, `ShockWave*`, `Slash*`, and selected elemental textures.

The supplied `States.png` and weapon sheets may also become useful later, but only after a real status/icon or weapon-animation contract needs them.

## Deliberately not imported

- RPG Maker runtime JavaScript
- SRPG plugin JavaScript
- plugin history/readme files
- `GameOver.png` as a final Sektor 1 screen
- unrelated balloon/character sheets
- the full effects archive

Sektor 1 remains its own engine. Third-party engine/plugin code does not become a dependency just because compatible art is available.

## Asset ownership boundary

`UIAssetManager` owns:

- the canonical UI-asset manifest
- asynchronous image loading
- load-failure reporting
- image availability checks
- windowskin nine-slice drawing
- icon-sheet extraction
- battle-shadow drawing

Consumers ask for named assets or drawing primitives. They do not know file paths or sprite-sheet math.

Every asset-backed presentation path must remain optional. Missing art must preserve the existing vector/fallback UI rather than affecting gameplay state or scene flow.

## Licensing note

The imported images came from the user-supplied RPG Maker MZ material archive. Project distribution must comply with the applicable RPG Maker material terms and any separate terms attached to material that was distributed separately from the base product. Do not assume plugin code or separately bundled materials share the same license as the base system graphics.
## Pass 55: Adventure UI style prototype

UI Style Integration Prototype v1 adds a second curated source family under `js/sprites/ui/adventure/`. The included `License.txt` identifies **UI Pack - Adventure 1.1** by Kenney as CC0. The repository keeps that license beside the imported subset.

Semantic mappings currently are:

- `battlePanel` -> `panel_grey_blue.png`
  - Primary battle HUD, battle command, and battle selector frame.
- `menuPanel` -> `panel_grey_blue.png`
  - Subdued framing for Options, Controls, the main menu, and Tactical Help.
- `accentPanel` -> `panel_grey_bolts_blue.png`
  - Reserved for small emphasized surfaces such as transient action/state banners and Escape/Defend side tabs.
- `selectionPanel` -> `button_grey.png`
  - Soft selected-row backing under the existing gold focus language.
- `gaugeFrame` -> `progress_transparent.png`
  - Neutral capsule border for HP/MP/Valor. Gauge fills remain vector-colored by Sektor 1 through `UIResourcePalette` rather than inheriting fixed source colors.

The prototype intentionally does not declare these images final art. Their purpose is to validate a softer beveled JRPG direction in motion while proving that the semantic asset boundary makes later replacement cheap. Consumers must continue to ask for semantic roles, and all panels/gauges must remain usable when the corresponding image is unavailable.
## Pass 56: Menu window softening and frame polish

Menu Window Softening & Frame Polish v1 does not replace the Pass 55 semantic mappings. Instead it upgrades the shared drawing contract in `UIAssetManager` so the same assets read more like finished JRPG windows and less like hard rectangles.

The shared treatment now provides:

- role-aware rounded panel radii (`menuPanel` 14px, `battlePanel` 12px, compact `accentPanel` up to 10px)
- rounded clipping around nine-slice panel art
- a restrained outer shadow for separation from the scene beneath
- a subtle inset highlight stroke for cushioned frame depth
- rounded clipping for selected-row art
- capsule clipping for vector HP/MP/Valor fills before the optional gauge frame is drawn

These details remain manager-owned. Battle/menu windows do not call `roundRect()` or reproduce shadow/inset math themselves. The current values are prototype presentation choices and may be tuned or replaced after hands-on review without changing semantic roles or gameplay behavior.

The richer portrait-and-party-information main-menu layout discussed for later work is deliberately deferred; Pass 56 changes frame language, not menu information architecture.

## Main Menu Layout Boundary (Pass 57)

The richer main menu remains a layout/data-presentation layer on top of the existing semantic skin. `MainMenuLayout` owns responsive regions, `Window_MainMenuParty` owns the active-four information cards, and `Window_MenuCommand` owns only command navigation. These consumers continue to request semantic panel/gauge presentation from `UIAssetManager`; portrait placeholders are intentionally not mapped to arbitrary source art yet.

The main-menu command list is intentionally singular and does not display an extra COMMANDS heading or the game title. Future portrait art, Order, multi-level Valor, and ROSTER implementations must extend their proper data/runtime owners rather than putting progression or party-mutation rules inside the menu renderer.
## Pass 58: menu palette refinement and future color ownership

The main/menu semantic role now uses the blue Adventure panel rather than the darker grey panel, paired with a deeper blue-violet fallback/background treatment. This is a default prototype, not a final locked palette. Party-card spacing is also rebalanced so larger portrait slots, identity text, and HP/MP/Valor gauges use the horizontal card area more evenly.

Future Window Color customization should not add per-window RGB constants. The intended direction is a four-corner configurable color model owned by Config Runtime and consumed through shared UI rendering. That later pass may tint/recolor semantic panel surfaces, but Pass 58 intentionally does not add an incomplete color editor.
## Pass 59: Party-card interaction and row presentation

The main-menu party panel is now both presentation and a shared selection surface. It intentionally has no PARTY INFORMATION label; the space belongs to the four actor cards. Selected cards use the existing semantic menu-panel focus treatment. Front/back row preference is communicated only through portrait horizontal offset (back left, front right), keeping row state legible without adding another text badge. The scene backdrop is neutral near-black so future four-corner Window Color customization can change the window palette without fighting a second saturated background.

The portrait offset is presentation of `Game_Party` row state, not ownership of it. `Window_MainMenuParty` may request row changes during Order mode, but persistent state and validation stay in `Game_Party`, and battle-row combat rules remain outside the UI layer.

## Pass 60: Visual formation ordering

Order confirmation now picks up the focused actor card; moving vertically chooses another formation slot and confirming again swaps the two visual positions. The picked source card uses a cool cyan focus outline while the live cursor remains the gold interaction marker. This ordering is presentation state only: battlefield actor drawing, spatial selection, and menu actor cycling consume it, while active-party composition, turn scheduling, stats, and damage do not.

## Pass 61: Resource color consistency

`UIResourcePalette` now owns the canonical player-resource color families used by the battle HUD, main-menu party cards, Status, and Item HP presentation. HP uses blue-cyan (`#66d7ff` label / `#4db8ff` fill), MP uses green (`#78ef91` / `#4fd46b`), and Valor uses magenta-purple (`#e3a0ff` / `#c06cff`). Dynamic current/max values use neutral white (`#ffffff`) instead of inheriting the resource hue. Valor Ready brightens the Valor label/fill to `#f0c4ff` / `#d98cff` while its READY value remains white. The neutral gauge frame and dark track remain separate from resource identity, so future skin/window-color work can change surrounding surfaces without silently swapping the meaning of HP, MP, or Valor.
