# Generated Game Assets

## Scope

Use this contract when externally generated images need to become Phaser runtime assets. Source images supplied outside the repository are reference inputs and must remain unchanged.

## Directory Contract

```text
external source images (read-only)
  -> game-client/art-source/generated/<asset-set-version>/
  -> game-client/public/assets/generated/<runtime-category>/
```

- Keep each production batch under a versioned `art-source/generated/<asset-set-version>` directory.
- Mirror runtime-ready files under `public/assets/generated` with stable semantic names.
- Do not overwrite unrelated legacy assets to introduce a new visual set.
- Keep a manifest in the versioned art-source directory with source provenance, runtime paths, dimensions, and a review note.

## Processing Command

Each non-trivial asset set must have a deterministic preparation script under `game-client/scripts/`.

Example:

```powershell
cd game-client
python scripts\prepare_glimmer_forest_assets.py
```

The script owns background removal, atlas slicing, Alpha restoration, sizing, naming, public mirroring, manifest generation, and contact-sheet previews. Manual fixes must be encoded back into the script so a later run does not regress them.

## Runtime Contract

- `PreloadScene` loads only runtime assets from `/assets/generated/...`.
- Scene code uses area-specific texture keys such as `forest-ground-cold-wet`; avoid ambiguous keys such as `ground` for new assets.
- Narrative landmarks and repeatable environment props use separate texture keys and layout roles.
- Animated transparent layers must retain a static readable state when `prefers-reduced-motion: reduce` is active.

## Collider Footpoint Contract

Environment props rendered with `origin: { x: 0.5, y: 1 }` use the texture canvas bottom as their Phaser anchor. That anchor is not the visible footpoint when the PNG contains transparent padding below its Alpha bounds.

Store the decoded source height and Alpha bounding-box bottom for collision-bearing assets, then convert the visible footpoint into world coordinates:

```ts
const visibleFootY = prop.y - prop.height * (1 - alphaBottom / sourceHeight)
const colliderCenterY = visibleFootY - colliderHeight / 2
```

For circular bodies, subtract the radius instead of half the height. The collider bottom may end above the visible footpoint to keep decorative root tips walkable, but it must not extend below the visible Alpha footpoint.

Y-sort depth for `world` and `canopy` props must use this same visible Alpha footpoint. Comparing the player foot position against the transparent canvas bottom causes the prop to cover the player after the player has already walked below its visible base. Props without Alpha footpoint metadata may fall back to their layout `y`; fixed `ground-decal`, `underlay`, `effect`, and `foreground` layers keep their explicit depth bands.

Player and NPC Y-sort depth must use the bottom of their movement collision body, not the sprite center. The ordering comparison is therefore foot-to-foot: actor collision foot against prop visible Alpha footpoint. Using `actor.y` makes a character remain behind a prop for roughly half the character height after visually walking below it.

Wrong:

```ts
// prop.y is the transparent canvas bottom, not the visible root base.
rect('root-body', 'root', prop.x, prop.y, 132, 46, 'boundary', prop.id)
```

Correct:

```ts
rect('root-body', 'root', prop.x, visibleFootY - 23, 132, 46, 'boundary', prop.id)
```

Regression tests must resolve every collision `visualRef` across all map regions and assert that the collider bottom is at or above the referenced prop's visible Alpha footpoint. Browser QA must also inspect `?debug-colliders=1` because a numerically valid body can still cover the wrong semantic part of the artwork. Wide solid bases such as rock clusters should use a rectangle sized to the physical base instead of a small center circle.

## Validation

Before accepting a generated asset batch:

- Manifest dimensions match decoded image dimensions.
- Art-source and public mirrors are byte-identical.
- Transparent PNG corner Alpha values are zero unless the asset explicitly fills the canvas.
- Contact-sheet and ground-composite previews show no checkerboard, black rectangle, chroma fringe, or hard pale rim.
- The client type-check, production build, and relevant runtime tests pass after preload keys are added.

## Continuous Terrain Texture Contract

Before laying out a river, road, shoreline, cliff, or other continuous terrain feature, classify the source image by its actual Alpha and composition:

- A full-canvas opaque texture is a **material**, not a placeable segment. Render it once through a spline/polygon mask or derive a deterministic masked overlay.
- A self-contained pond, bend, island, or bank composition is a **local decal**, not a repeatable shoreline tile. Use it only at a matching local landmark or leave it unloaded.
- Only assets whose opposite edges and subject direction were explicitly authored for tiling may be repeated as segments.

For Phaser spline-masked waterways, the layout contract must contain the centerline points, visible width, texture, Alpha, edge padding/color, depth, and minimap visibility. The runtime must keep the material below bridges and actors, above crossing path decals, and explicitly destroy GeometryMask/Graphics resources on scene shutdown.

Required regression checks:

- The continuous feature is represented by one authoritative masked layout, not rotated full-canvas image segments.
- Old segment IDs and unsuitable local decals are absent from runtime layout and preload sets.
- The texture is visible on the minimap when it carries navigation meaning.
- Repeated map changes release masks and hidden Graphics objects.

Wrong:

```ts
// Opaque water texture rotated into visible rectangular pieces.
waterSegments.map((segment) => add.image(segment.x, segment.y, 'water').setAngle(segment.angle))
```

Correct:

```ts
// One material, one spline mask, one continuous navigation feature.
const water = add.tileSprite(worldWidth / 2, worldHeight / 2, worldWidth, worldHeight, 'water')
water.setMask(createSplineGeometryMask(centerline, width))
```

## Wrong vs Correct

Wrong:

```text
external PNG -> manually copy over public/assets/generated/sprites/forest-obstacle.png
```

Correct:

```text
external PNG (unchanged)
  -> prepare_<asset-set>_assets.py
  -> art-source/generated/<version>/...
  -> public/assets/generated/<category>/...
  -> manifest + preview + runtime preload
```

The correct flow preserves provenance, makes Alpha cleanup reproducible, and allows one visual set to be rolled back without affecting other maps.
