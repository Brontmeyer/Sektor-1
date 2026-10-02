# 🎨 Character Asset Standard v2

This document defines the shared production standard for playable-character artwork in Sektor 1.

The master character sheet is a design/reference board. Runtime assets are exported from that approved design into separate files with predictable dimensions and metadata. The engine must not depend on presentation-board labels, frames, or spacing.

---

# Canonical Character Package

Every playable character should eventually provide the same categories of assets.

```text
js/sprites/actors/<Character>/
├── portrait.png
├── expressions.png
├── field.png
├── battle.png
├── damaged.png
└── extras.png
```

The exact file split may evolve, but every character follows the same content standard below.

## Portrait / Story UI

- One primary menu portrait.
- Six expression portraits:
  - Default (Smile)
  - Happy (Eyes Closed)
  - Wink
  - Surprised
  - Serious
  - Determined
- The approved master sheet's large top-left portrait is the canonical menu-portrait reference.
- Portraits do not need to display the character's weapon unless the composition benefits from it.

## Field Locomotion

Sektor 1 field movement is continuous rather than tile-step movement. Actors accelerate, decelerate, and can move diagonally, so production field art uses eight directions rather than the four-direction RPG Maker minimum.

Required directions and canonical row order:

```text
0  Down
1  Down-Left
2  Left
3  Up-Left
4  Up
5  Up-Right
6  Right
7  Down-Right
```

Production standard:

- Four walk frames per direction.
- One stable idle/rest frame per direction. The default contract uses frame 0 as idle.
- Matching frame dimensions across all eight rows.
- Transparent background.
- Feet/ground contact positioned consistently from frame to frame.
- No separate acceleration or deceleration artwork is required.

`Game_Player` derives facing from actual post-collision velocity. Animation cadence scales with speed: acceleration naturally quickens the walk cycle, deceleration naturally slows it, and the actor settles into the last meaningful facing direction when stopped.

The field sprite is anchored to the bottom-center of the existing player collision box. Artwork size therefore does not silently change map collision behavior.

## Battle Motions

Each playable character uses the same conceptual motion set:

- Idle
- Ready
- Attack
- Magick Cast / Chant
- Skill
- Item Use
- Defend
- Damage / Hurt
- Victory
- Collapse / KO

Battle artwork may use more frames where a character needs them. `battleVisual` metadata owns frame counts, timing, fallback states, scale, grounding, shadow footprint, and local animation offsets.

Attack movement and animation are separate concerns. The engine may move a character for an Attack lunge while Magick, Skill, and Item actions remain planted unless that specific action intentionally requests movement.

## Extra Character Sprites

Every playable character should have the following extra poses when practical:

- Sit / Rest
- Sleep
- Hurt / Kneel
- Downed / Face Down

These are story/presentation assets and do not need to share the battle-sheet grid.

---

# Effect Color Language

Physical Attack effects use a neutral warm gold/yellow presentation so weapon impact does not imply a character-specific element.

Magick may use a character-specific signature color. Current approved references:

- Tyler: blue Magick
- Sarah: crimson/red Magick

Skill / Item feedback should remain mostly neutral gold unless a specific authored ability requires its own effect language.

Effect color is presentation metadata, not elemental combat identity. A blue casting aura does not by itself make a spell Ice/Water, and a red casting aura does not by itself make a spell Fire.

---


# Runtime Character Presentation

Playable actors may also define a `characterVisual` object in `Actors.json`. This is the shared presentation contract for menu/story portraits and signature effect colors.

```json
{
  "characterVisual": {
    "portrait": "portraits/Tyler.png",
    "portraitScale": 1,
    "expressions": {},
    "effects": {
      "attack": "#e7b84d",
      "magick": "#4aa3ff",
      "skill": "#e7b84d",
      "item": "#e7b84d"
    }
  }
}
```

Character assets resolve beneath `js/sprites/actors/`. Portraits therefore currently live in:

```text
js/sprites/actors/portraits/
```

`CharacterAssetManager` owns lazy portrait loading and drawing. UI consumers request the actor portrait through that manager and retain the existing initial-letter card as a non-fatal fallback when an asset is absent or still loading.

`characterVisual.portraitScale` is an optional normalized presentation scale from `0.5` to `1`. Values below `1` intentionally inset art inside the square card without changing per-window geometry. Tyler and Sarah use the full `1.0` frame so their portrait canvases meet the card edges; transparent areas read against the shared slate-blue portrait backdrop instead of creating dark gutters.

The approved Tyler and Sarah presentation boards live under `docs/character_refs/`. They are canonical visual references, not runtime-packed sprite sheets. The current 512×512 portraits were exported from those approved boards.

## Living Battle Idle Standard

Playable battlers should look alive while waiting for commands. The canonical Idle motion must therefore be a looping multi-frame motion (at least two frames) with subtle movement such as breathing, cloth/hair settling, stance shift, or equivalent character-appropriate life.

Idle breathing is presentation only. It must not move the formation anchor, collision footprint, battle row, target position, or shadow contact point. Character-specific intensity/timing can be tuned through the battler animation metadata when production sheets replace the placeholder battlers.

# `fieldVisual` Data Contract

Actors may define an optional `fieldVisual` object in `Actors.json`.

Example:

```json
{
  "fieldVisual": {
    "sprite": "Tyler_Field.png",
    "frameWidth": 64,
    "frameHeight": 64,
    "scale": 1,
    "anchor": { "x": 0.5, "y": 1 },
    "offset": { "x": 0, "y": 0 },
    "sheet": {
      "columns": 4,
      "rows": 8,
      "directions": {
        "down": 0,
        "downLeft": 1,
        "left": 2,
        "upLeft": 3,
        "up": 4,
        "upRight": 5,
        "right": 6,
        "downRight": 7
      }
    },
    "animation": {
      "idleFrame": 0,
      "walkFrames": [0, 1, 2, 3],
      "fastFrameDuration": 0.1,
      "slowFrameDuration": 0.22,
      "minimumSpeed": 1
    }
  }
}
```

Field sprite files resolve under:

```text
js/sprites/actors/field/
```

Until a valid `fieldVisual.sprite` is assigned and loaded, `Game_Player` deliberately retains the existing white-square fallback. This lets field rendering architecture ship before final production character art.

---

# Master Sheet vs Runtime Asset

The approved Tyler/Sarah character sheets are canonical visual references, not direct runtime sprite sheets.

A master sheet may contain:

- portrait art
- labeled battle sequences
- walking references
- expression portraits
- extra poses
- decorative plaques

Production integration crops/rebuilds those references into clean runtime files with consistent frame dimensions and transparent backgrounds. The master sheet should stay readable and attractive rather than being forced into the engine's exact packing format.
