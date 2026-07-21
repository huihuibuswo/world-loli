import Phaser from 'phaser'

export type PlayerState = 'idle' | 'walk' | 'interact' | 'battle' | 'disabled'

export class Player extends Phaser.Physics.Arcade.Sprite {
  readonly speed = 220
  readonly interactionRange = 104
  state: PlayerState = 'idle'
  direction: 'up' | 'down' | 'left' | 'right' = 'down'
  private virtual = new Phaser.Math.Vector2(0, 0)

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player')
    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.setCollideWorldBounds(true)
    this.setDepth(20)
    this.setCircle(20, 8, 8)
  }

  setVirtualDirection(x: number, y: number): void {
    this.virtual.set(x, y)
  }

  move(cursors: Phaser.Types.Input.Keyboard.CursorKeys, wasd: Record<string, Phaser.Input.Keyboard.Key>): void {
    if (this.state === 'disabled' || this.state === 'battle') {
      this.setVelocity(0)
      return
    }
    const input = new Phaser.Math.Vector2(
      Number(cursors.right.isDown || wasd.D.isDown) - Number(cursors.left.isDown || wasd.A.isDown),
      Number(cursors.down.isDown || wasd.S.isDown) - Number(cursors.up.isDown || wasd.W.isDown),
    ).add(this.virtual)

    if (input.lengthSq() === 0) {
      this.setVelocity(0)
      this.state = 'idle'
      this.setScale(1, 1)
      return
    }
    input.normalize().scale(this.speed)
    this.setVelocity(input.x, input.y)
    this.state = 'walk'
    if (Math.abs(input.x) > Math.abs(input.y)) {
      this.direction = input.x > 0 ? 'right' : 'left'
    } else {
      this.direction = input.y > 0 ? 'down' : 'up'
    }
    this.setFlipX(this.direction === 'left')
  }
}
