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

## Validation

Before accepting a generated asset batch:

- Manifest dimensions match decoded image dimensions.
- Art-source and public mirrors are byte-identical.
- Transparent PNG corner Alpha values are zero unless the asset explicitly fills the canvas.
- Contact-sheet and ground-composite previews show no checkerboard, black rectangle, chroma fringe, or hard pale rim.
- The client type-check, production build, and relevant runtime tests pass after preload keys are added.

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
