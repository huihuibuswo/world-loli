import Phaser from 'phaser'
import { resolveActorFootDepth } from '@/game/depthSorting'

export type PlayerState = 'idle' | 'walk' | 'interact' | 'battle' | 'disabled'
type WalkDirection = 'up' | 'down' | 'left' | 'right'

const PLAYER_COLLISION_RADIUS = 20
const PLAYER_COLLISION_CENTER_Y_OFFSET = 17

export class Player extends Phaser.Physics.Arcade.Sprite {
  readonly speed = 220
  readonly interactionRange = 104
  state: PlayerState = 'idle'
  direction: WalkDirection = 'down'
  private virtual = new Phaser.Math.Vector2(0, 0)
  private readonly idleTexture: string
  private readonly walkTexturePrefix: string
  private readonly walkDisplaySize: number

  constructor(scene: Phaser.Scene, x: number, y: number, avatarGender?: 'female' | 'male') {
    const requestedTexture = avatarGender === 'male' ? 'player-male' : 'player-female'
    const texture = scene.textures.exists(requestedTexture) ? requestedTexture : 'player-female'
    super(scene, x, y, texture)
    const gender = texture === 'player-male' ? 'male' : 'female'
    this.idleTexture = texture
    this.walkTexturePrefix = `player-${gender}-walk`
    this.walkDisplaySize = gender === 'female' ? 91.5 : 86.5
    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.setCollideWorldBounds(true)
    this.setDisplaySize(84, 84)
    this.syncCollisionBody()
    this.syncDepth()
  }

  setVirtualDirection(x: number, y: number): void {
    this.virtual.set(x, y)
  }

  move(cursors: Phaser.Types.Input.Keyboard.CursorKeys, wasd: Record<string, Phaser.Input.Keyboard.Key>): void {
    if (this.state === 'disabled' || this.state === 'battle') {
      this.setVelocity(0)
      this.stopWalkAnimation()
      return
    }
    const input = new Phaser.Math.Vector2(
      Number(cursors.right.isDown || wasd.D.isDown) - Number(cursors.left.isDown || wasd.A.isDown),
      Number(cursors.down.isDown || wasd.S.isDown) - Number(cursors.up.isDown || wasd.W.isDown),
    ).add(this.virtual)

    if (input.lengthSq() === 0) {
      this.setVelocity(0)
      this.state = 'idle'
      this.stopWalkAnimation()
      this.syncDepth()
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
    this.startWalkAnimation(this.direction)
    this.syncDepth()
  }

  private startWalkAnimation(direction: WalkDirection): void {
    const directionalTexture = direction === 'down'
      ? this.walkTexturePrefix
      : `${this.walkTexturePrefix}-${direction}`
    const directionalAnimation = `${directionalTexture}-cycle`
    const fallbackAnimation = `${this.walkTexturePrefix}-cycle`
    const texture = this.scene.textures.exists(directionalTexture)
      && this.scene.anims.exists(directionalAnimation)
      ? directionalTexture
      : this.walkTexturePrefix
    const animation = texture === directionalTexture ? directionalAnimation : fallbackAnimation
    if (!this.scene.textures.exists(texture) || !this.scene.anims.exists(animation)) {
      this.stopWalkAnimation(true)
      return
    }
    if (this.anims.currentAnim?.key === animation && this.anims.isPlaying) return
    this.setFlipX(false)
    this.setTexture(texture, 0).setDisplaySize(this.walkDisplaySize, this.walkDisplaySize)
    this.syncCollisionBody()
    this.play(animation)
  }

  private stopWalkAnimation(useStaticFallback = false): void {
    this.stop()
    if (useStaticFallback && this.texture.key !== this.idleTexture) {
      this.setFlipX(false)
      this.setTexture(this.idleTexture).setDisplaySize(84, 84)
      this.syncCollisionBody()
    }
  }

  private syncCollisionBody(): void {
    const frameWidth = this.frame.realWidth
    const frameHeight = this.frame.realHeight
    const scale = Math.abs(this.scaleX)
    const radius = PLAYER_COLLISION_RADIUS / scale
    const offsetX = frameWidth / 2 - radius
    const offsetY = frameHeight / 2 + PLAYER_COLLISION_CENTER_Y_OFFSET / scale - radius
    this.setCircle(radius, offsetX, offsetY)
  }

  private syncDepth(): void {
    this.setDepth(resolveActorFootDepth(
      this.y,
      PLAYER_COLLISION_CENTER_Y_OFFSET,
      PLAYER_COLLISION_RADIUS,
    ))
  }
}
