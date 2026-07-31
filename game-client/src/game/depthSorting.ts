export function resolveActorFootDepth(
  y: number,
  collisionCenterYOffset: number,
  collisionRadius: number,
): number {
  return y + collisionCenterYOffset + collisionRadius
}
