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
- `menuPanel` -> `panel_grey_dark.png`
  - Subdued framing for Options, Controls, the main menu, and Tactical Help.
- `accentPanel` -> `panel_grey_bolts_blue.png`
  - Reserved for small emphasized surfaces such as transient action/state banners and Escape/Defend side tabs.
- `selectionPanel` -> `button_grey.png`
  - Soft selected-row backing under the existing gold focus language.
- `gaugeFrame` -> `progress_transparent.png`
  - Neutral capsule border for HP/MP/Valor. Gauge fills remain vector-colored by Sektor 1 rather than inheriting fixed source colors.

The prototype intentionally does not declare these images final art. Their purpose is to validate a softer beveled JRPG direction in motion while proving that the semantic asset boundary makes later replacement cheap. Consumers must continue to ask for semantic roles, and all panels/gauges must remain usable when the corresponding image is unavailable.
