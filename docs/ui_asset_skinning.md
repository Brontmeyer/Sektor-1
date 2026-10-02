# UI Asset Skinning Foundation

Pass 54 establishes one presentation-asset boundary for Sektor 1 instead of letting renderers and windows hard-code image paths.

## Curated runtime UI assets

Pass 145 trims the presentation library to assets that have a current runtime role, installs the user-supplied ArtIcons catalog as the active icon atlas, and organizes runtime art by purpose rather than by its source pack.

Current semantic folders under `js/sprites/ui/`:

- `icons/IconSet.png` -> `iconSet`
  - User-supplied ArtIcons catalog.
  - Normalized to a transparent 192×2052 atlas: 16 columns × 171 rows of 12×12 cells.
  - The original catalog artwork is preserved at the top-left; only transparent padding was added to complete the final column/row.
  - Some cells contain category labels or blanks. Gameplay/database records therefore choose explicit icon indexes instead of assuming every atlas cell is a usable icon.
  - `UIAssetManager.drawIcon()` scales these pixel icons with image smoothing disabled so 12×12 source art stays crisp at menu sizes.
- `battle/Shadow2.png` -> `battleShadow`
  - Used by the battle renderer to ground side-view battlers without changing combat rules.
  - If unavailable, battle rendering continues without the decorative shadow.
- `panels/panel_grey_blue.png` -> `battlePanel` / `menuPanel`
- `panels/panel_grey_bolts_blue.png` -> `accentPanel`
- `buttons/button_grey.png` -> `selectionPanel`
- `gauges/progress_transparent.png` -> `gaugeFrame`
- `licenses/Kenney_UI_Pack_Adventure_LICENSE.txt`
  - Preserves the Kenney CC0 notice without keeping a vendor-named runtime folder.

The old `adventure/` and `rmmz/` directories are intentionally gone. Runtime code consumes semantic roles through `UIAssetManager`; folder names now describe what the asset does in Sektor 1 rather than where it originally came from.

Removed as dead runtime assets in Pass 145:

- `Window.png`
- `ButtonSet.png`
- `panel_grey_dark.png`

Those files had no production consumer. Their unused manager/test hooks were removed at the same time rather than leaving decorative files that looked authoritative but were not used by the game.

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
- icon-sheet extraction
- battle-shadow drawing

Consumers ask for named assets or drawing primitives. They do not know file paths or sprite-sheet math.

Every asset-backed presentation path must remain optional. Missing art must preserve the existing vector/fallback UI rather than affecting gameplay state or scene flow.

## Licensing note

The active UI library has more than one source family:

- `Shadow2.png` came from the user-supplied RPG Maker MZ material archive and remains subject to the applicable RPG Maker material terms.
- Kenney Adventure UI assets retain their CC0 notice at `ui/licenses/Kenney_UI_Pack_Adventure_LICENSE.txt`.
- The ArtIcons catalog was supplied separately by the user. No separate ArtIcons license file was provided in this pass, so distribution rights for that atlas should be confirmed before shipping a public build.

Do not assume unrelated source families share licensing terms.
## Pass 55: Adventure UI style prototype

UI Style Integration Prototype v1 introduced the Kenney **UI Pack - Adventure 1.1** artwork as a CC0 source family. Pass 145 later reorganizes the actively used subset into semantic `ui/panels`, `ui/buttons`, and `ui/gauges` folders while preserving the Kenney notice in `ui/licenses/`.

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

Pass 58 deliberately deferred Window Color rather than adding per-window RGB constants. Window Color Customization v1 now completes that direction: Config Runtime v3 owns the four validated corner colors, `Window_WindowColor` edits them through RGB channels with a live preview, and `UIAssetManager.drawPanel()` centrally blends them over semantic battle/menu/accent surfaces. Consumers still request semantic roles and do not know color values or interpolation math.
## Pass 59: Party-card interaction and row presentation

The main-menu party panel is now both presentation and a shared selection surface. It intentionally has no PARTY INFORMATION label; the space belongs to the four actor cards. Selected cards use the existing semantic menu-panel focus treatment. Front/back row preference is communicated only through portrait horizontal offset (back left, front right), keeping row state legible without adding another text badge. The scene backdrop is neutral near-black so the player-selected four-corner Window Color palette can change window identity without fighting a second saturated background.

The portrait offset is presentation of `Game_Party` row state, not ownership of it. `Window_MainMenuParty` may request row changes during Order mode, but persistent state and validation stay in `Game_Party`, and battle-row combat rules remain outside the UI layer.

## Pass 60: Visual formation ordering

Order confirmation now picks up the focused actor card; moving vertically chooses another formation slot and confirming again swaps the two visual positions. The picked source card uses a cool cyan focus outline while the live cursor remains the gold interaction marker. This ordering is presentation state only: battlefield actor drawing, spatial selection, and menu actor cycling consume it, while active-party composition, turn scheduling, stats, and damage do not.

## Pass 61: Resource color consistency

`UIResourcePalette` now owns the canonical player-resource color families used by the battle HUD, main-menu party cards, Status, and Item HP presentation. HP uses blue-cyan (`#66d7ff` label / `#4db8ff` fill), MP uses green (`#78ef91` / `#4fd46b`), and Valor uses magenta-purple (`#e3a0ff` / `#c06cff`). Dynamic current/max values use neutral white (`#ffffff`) instead of inheriting the resource hue. Valor Ready brightens the Valor label/fill to `#f0c4ff` / `#d98cff` while its READY value remains white. The neutral gauge frame and dark track remain separate from resource identity, so future skin/window-color work can change surrounding surfaces without silently swapping the meaning of HP, MP, or Valor.
## Pass 63: Window Color customization

Window Color Customization v1 adds a dedicated `WINDOW COLOR` editor under Config. The editor exposes Top Left, Top Right, Bottom Left, and Bottom Right colors as RGB channels, previews changes immediately through the same semantic `menuPanel` renderer used by the game, and provides a color-only reset. Changes persist through Config Runtime v3 rather than Save Runtime.

`UIAssetManager.drawPanel()` owns the actual four-corner blend. It interpolates the configured top and bottom edge colors across narrow vertical strips, then applies that blend inside the existing rounded clip after fallback/image panel drawing. Battle/menu/accent consumers inherit the result automatically and may opt out only through the shared draw contract. Selection surfaces and `UIResourcePalette` gauges are not recolored by this system; HP blue-cyan, MP green, and Valor magenta-purple remain stable readability anchors.


## Pass 64: Magick menu composition

The field Magick screen now composes four semantic `menuPanel` surfaces through `UIAssetManager`: actor summary, selected-Magick information, description strip, and learned-Magick grid. It inherits the configured four-corner window palette automatically and keeps HP / MP label identity in `UIResourcePalette`. No Magick window owns copies of the player's RGB configuration.
