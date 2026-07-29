# 晨曦村布局与贴图优化设计

## Boundaries

- Frontend scene owner: `game-client/src/game/scenes/WorldScene.ts`.
- Asset preload owner: `game-client/src/game/scenes/PreloadScene.ts`.
- Runtime map object owner: a new append-only SQL migration under `server/database/`.
- Final assets: `game-client/public/assets/generated/sprites/`.
- User source images remain untouched outside the workspace.

## Asset Pipeline

1. Copy the three user images into `game-client/art-source/generated/dawn-village/` with descriptive source names.
2. Remove the flat magenta background with the installed imagegen chroma-key helper.
3. Validate PNG alpha, transparent corners, retained subject coverage, and edge fringe.
4. Save runtime assets as `village-well.png`, `village-cart-supplies.png`, and `village-fence-segment.png`.

## Scene Design

- Separate village-only obstacle data from forest-only obstacle data.
- Keep the existing footprint-center placement algorithm and reuse current building body offsets.
- Add a central well, a supply cart, and fence segments as static obstacles.
- Keep buildings clustered around a central plaza and retain the northwest-to-southeast route.
- Remove village forest stumps/rocks and reduce ancient trees to a perimeter belt.
- Draw a dedicated circular plaza mask around `(790,790)` in addition to road splines.

## Data Flow

```text
SQL migration positions -> map API resource.objects -> WorldScene NPC/portal/plant creation
WorldScene layout constants -> static sprites and Arcade bodies
PreloadScene asset keys -> WorldScene obstacle texture references
```

The migration and scene coordinates must be reviewed together so NPCs and collectibles remain outside static bodies.

## Compatibility

- Preserve map bounds and portal identity/target data.
- Preserve existing building texture keys and collision offsets.
- Do not edit generated `.js` siblings manually; TypeScript remains the source.
- Use a new migration rather than rewriting historical migrations.

## Rollback

- Scene rollback is limited to `WorldScene.ts` and `PreloadScene.ts`.
- Database rollback can restore the prior coordinates from migrations `008`, `010`, `011`, and `020` if required.
- New assets are additive and can be removed after references are reverted.
