# Sektor 1 Icon Atlas

Pass 145 installs the user-supplied ArtIcons catalog as the active runtime icon source.

## Geometry

```text
source cell: 12 × 12 px
columns:     16
rows:        171
capacity:    2736 grid cells
runtime:     js/sprites/ui/icons/IconSet.png
```

The uploaded catalog measured 190×2048. Runtime packing adds transparent padding only, producing 192×2052 so every grid cell is addressable without modifying the supplied artwork.

`UIAssetManager.iconIndex(column, row)` converts grid coordinates to an index. `UIAssetManager.drawIcon()` draws a chosen index and disables image smoothing while scaling so the pixel-art source stays crisp.

## Important: catalog labels occupy cells

This is a catalog-style sheet, not a dense sheet where every grid cell is an icon. Category headings and blank cells are intentionally present. Current visible category families include:

- Default ArtIcons
- Skills & States
- Weapons
- Armors & Accessories
- Potions
- Consumables
- Orbs & Gems
- Crystals

Game data should therefore store explicit chosen icon indexes. Do not derive gameplay meaning from an icon's row or color. The atlas is presentation only.

## Integration policy

Pass 145 installs and validates the atlas but does not assign arbitrary icons to Items, Magick, Skills, equipment, or statuses. Those mappings should be authored deliberately so database identity stays stable and visual choices remain easy to revise.
