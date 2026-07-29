# 晨曦村布局与贴图优化实施计划

## Checklist

- [x] Import the three supplied source images non-destructively.
- [x] Remove magenta chroma key and validate alpha output.
- [x] Add runtime preload keys for well, cart, and fence.
- [x] Refactor `WorldScene.ts` into map-type-specific layouts.
- [x] Apply approved building, prop, tree, plaza, and road coordinates.
- [x] Add a new SQL migration for village NPC and collectible coordinates.
- [x] Verify portal data and story gates are unchanged.
- [x] Run frontend type-check and build; confirm the project has no lint script.
- [x] Run the targeted map/API flow tests in the local API container.
- [x] Start the app and inspect desktop/mobile screenshots for visual QA.
- [x] Update the optimization document with implementation calibration changes.

## Validation Commands

```powershell
Set-Location game-client
npm run typecheck
npm run build

Set-Location ..\server
docker compose exec -T api pytest tests/test_api_flow.py -q
```

## Risk Points

- Transparent padding requires collision bodies to be calibrated against visible pixels.
- Fence placement can create NPC navigation pockets if segments are too dense.
- SQL coordinates and scene obstacles can drift independently.
- The source images are large and must be resized by Phaser without introducing excessive runtime memory cost; downscaling may be needed after visual QA.
