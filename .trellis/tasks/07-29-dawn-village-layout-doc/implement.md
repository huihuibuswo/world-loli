# 晨曦村布局与贴图优化实施计划

## Checklist

- [ ] Import the three supplied source images non-destructively.
- [ ] Remove magenta chroma key and validate alpha output.
- [ ] Add runtime preload keys for well, cart, and fence.
- [ ] Refactor `WorldScene.ts` into map-type-specific layouts.
- [ ] Apply approved building, prop, tree, plaza, and road coordinates.
- [ ] Add a new SQL migration for village NPC and collectible coordinates.
- [ ] Verify portal data and story gates are unchanged.
- [ ] Run frontend type-check, lint, and build.
- [ ] Run targeted backend/database tests.
- [ ] Start the app and capture desktop/mobile screenshots for visual QA.
- [ ] Update the optimization document if implementation calibration changes coordinates.

## Validation Commands

```powershell
Set-Location game-client
npm run type-check
npm run lint
npm run build

Set-Location ..\server
python -m pytest tests/test_api_flow.py tests/test_opening_story.py
```

## Risk Points

- Transparent padding requires collision bodies to be calibrated against visible pixels.
- Fence placement can create NPC navigation pockets if segments are too dense.
- SQL coordinates and scene obstacles can drift independently.
- The source images are large and must be resized by Phaser without introducing excessive runtime memory cost; downscaling may be needed after visual QA.
