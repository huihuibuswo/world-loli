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

## Full-Map Composition Acceptance Contract

Asset validity does not imply scene validity. A transparent sprite can pass Alpha, manifest, preload, and contact-sheet checks while the assembled map still reads as unrelated stickers.

Before accepting a region layout, render one deterministic full-map composite at the authoritative world size and inspect it at both full-map scale and gameplay-scale crops. The composite must include the actual ground-layer Alpha, continuous paths and waterways, landmarks, repeated props, boundaries, and foreground/effect layers that materially affect composition.

The review must verify:

- Boundary assets form intentional masses or corridors instead of evenly spaced isolated objects.
- Repeated props form two or more recognizable ecology families with consistent scale, palette, and placement rules.
- Continuous terrain varies in width or contour where appropriate and does not read as a uniform translucent tube or a chain of rectangular stamps.
- Major landmarks have visual support from surrounding terrain and do not float in empty ground.
- Playable negative space is deliberate: routes, bridge heads, spawns, portals, and interaction zones remain readable without making the whole map look unfinished.
- Ground tiling and repeated silhouettes are not obvious at full-map scale.

Contact sheets remain required for per-asset defects, but they cannot replace the full-map composite. Runtime acceptance requires both checks.

Wrong:

```text
Alpha passes + assets load + unit tests pass -> approve region art
```

Correct:

```text
per-asset QA -> full-map composite -> gameplay crops -> collision/navigation checks -> approve region art
```

## Bridge-to-Terrain Contact Contract

A bridge crossing a masked waterway is not visually complete when the bridge sprite merely overlaps the water. Both bridge endpoints must be embedded into the shoreline so the bridge reads as part of the terrain rather than a detached transparent sticker.

Required layer order:

```text
waterway / riverbed
bridge body
soft bridge-head terrain blend
bridge-head bank cap
optional sparse shoreline foliage
```

- Keep the bridge body below the bridge-head blend and bank cap at both endpoints.
- Stop continuous road/path rendering before it enters the water mask. Preserve the logical route through the bridge for navigation, but declare a visual gap around the bridge center so translucent water cannot reveal a road band beneath the bridge.
- Use four explicit endpoint caps for two bridges; do not rely on a generic shoreline decal that happens to overlap one end.
- Bridge-head caps are visual-only and must not create colliders or change the authoritative water-gap coordinates.
- Tighten the adjacent water colliders toward the bridge sides while preserving one continuous walkable gap and all bridge-head safe zones. Do not add small colliders inside a bridge-head safe zone to hide visual defects.
- Hide bridge-head caps from the minimap while keeping the bridge body and waterway visible.
- Review each bridge in a gameplay-scale crop. A full-map preview alone can hide exposed log ends, dark Alpha seams, or a cap placed on the wrong side of the bank.

Regression tests must assert that every expected bridge-head cap exists, resolves to a depth above its bridge, remains close to the declared endpoint, and has no collider reference. They must also assert that bridge-centered path visual gaps exist, both bridge centerlines remain open, the stream has exactly two open runs, and adjacent water colliders stay within the approved bridge-side bounds.

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
