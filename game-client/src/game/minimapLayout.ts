export type MinimapLayoutInput = {
  canvasLeft: number
  canvasTop: number
  canvasWidth: number
  canvasHeight: number
  viewportWidth: number
  gameWidth: number
  gameHeight: number
  compact: boolean
}

export type MinimapLayout = {
  frameSize: number
  frameTop: number
  frameRight: number
  cameraX: number
  cameraY: number
  cameraWidth: number
  cameraHeight: number
}

export function resolveMinimapLayout(input: MinimapLayoutInput): MinimapLayout {
  const frameSize = input.compact ? 112 : 150
  const frameTop = input.compact ? 64 : 20
  const frameRight = input.compact ? 10 : 20
  const scaleX = input.canvasWidth / input.gameWidth
  const scaleY = input.canvasHeight / input.gameHeight

  return {
    frameSize,
    frameTop,
    frameRight,
    cameraX: (input.viewportWidth - frameRight - frameSize - input.canvasLeft) / scaleX,
    cameraY: (frameTop - input.canvasTop) / scaleY,
    cameraWidth: frameSize / scaleX,
    cameraHeight: frameSize / scaleY,
  }
}
