# Phaser Overlay Camera Layout

## Scope

Use this contract when a Phaser camera must align with a DOM HUD element while the game uses `Phaser.Scale.ENVELOP`.

## Required Pattern

Camera viewports are expressed in the game's internal coordinate space. DOM HUD dimensions are CSS pixels. Convert through the rendered Canvas rectangle before calling `camera.setViewport`:

```ts
const rect = game.canvas.getBoundingClientRect()
const scaleX = rect.width / GAME_WIDTH
const scaleY = rect.height / GAME_HEIGHT

const cameraX = (window.innerWidth - cssRight - cssSize - rect.left) / scaleX
const cameraY = (cssTop - rect.top) / scaleY
const cameraWidth = cssSize / scaleX
const cameraHeight = cssSize / scaleY
```

Do not show the overlay camera until the Canvas has a positive size and `scaleX` approximately equals `scaleY`. Initial scene creation can run before `ENVELOP` finishes applying its centered crop. Retry on a later animation frame and update again on `Phaser.Scale.Events.RESIZE`.

Always remove the resize listener and cancel pending animation frames on scene shutdown.

## Wrong vs Correct

```ts
// Wrong: internal right edge can be outside the visible mobile crop.
camera.setViewport(GAME_WIDTH - 162, 12, 150, 150)

// Correct: derive internal coordinates from the visible CSS target.
const layout = resolveMinimapLayout({ canvasLeft: rect.left, canvasWidth: rect.width, ... })
camera.setViewport(layout.cameraX, layout.cameraY, layout.cameraWidth, layout.cameraHeight)
```

## Tests Required

- Unit test the coordinate conversion for an uncropped desktop Canvas.
- Unit test an `ENVELOP` mobile case where the Canvas is wider than the viewport and has a negative `left` offset.
- Browser-check desktop and mobile cold refresh, not only a resize after the scene is already running.
- If the camera has its own background, verify an unstable initial viewport cannot cover the main camera.

## Common Failure Symptoms

- DOM frame is visible but the minimap is missing: the internal camera is outside the cropped Canvas area.
- A cold refresh is blank but resizing fixes it: the viewport was calculated before Canvas scale stabilization.
- Main-world objects appear behind a transparent minimap: the overlay camera needs an opaque background and an aligned DOM border.

