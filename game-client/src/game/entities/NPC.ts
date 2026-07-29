import Phaser from 'phaser'

type NPCWanderState = 'idle' | 'moving' | 'returning' | 'paused'
type WalkDirection = 'up' | 'down' | 'left' | 'right'

export class NPC extends Phaser.Physics.Arcade.Sprite {
  readonly wanderRadius = 140
  readonly speed = 45
  private readonly spawn = new Phaser.Math.Vector2()
  private readonly idleTexture: string
  private readonly walkTexturePrefix: string
  private readonly nameLabel: Phaser.GameObjects.Text
  private wanderState: NPCWanderState = 'idle'
  private target: Phaser.Math.Vector2 | null = null
  private nextDecisionAt = 0
  private lastProgressAt = 0
  private readonly lastProgressPosition = new Phaser.Math.Vector2()
  private direction: WalkDirection = 'down'

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly npcId: number,
    readonly npcName: string,
    textureKey = 'npc-trainer',
    private readonly stationary = false,
    tint?: number,
  ) {
    const texture = scene.textures.exists(textureKey) ? textureKey : 'npc-trainer'
    super(scene, x, y, texture)
    this.spawn.set(x, y)
    this.idleTexture = texture
    this.walkTexturePrefix = `${texture}-walk`

    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.setCollideWorldBounds(true)
    this.setPushable(false)
    this.setDisplaySize(100, 100)
    if (tint !== undefined) this.setTint(tint)
    this.syncCollisionBody()
    this.nameLabel = scene.add.text(x, y - 62, npcName, {
      fontFamily: 'ui-rounded, sans-serif',
      fontSize: '17px',
      color: '#fff7dc',
      backgroundColor: '#10251dcc',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5)
    this.nextDecisionAt = scene.time.now + Phaser.Math.Between(1_200, 3_200)
    this.lastProgressPosition.set(x, y)
    this.syncPresentation()
  }

  updateWander(time: number, paused: boolean): void {
    this.enforceWanderRadius(time)
    if (paused || this.stationary) {
      this.enterPaused()
      this.syncPresentation()
      return
    }
    if (this.wanderState === 'paused') this.enterIdle(time, 450, 1_100)

    if (this.wanderState === 'idle') {
      if (time >= this.nextDecisionAt) this.chooseWanderTarget(time)
    } else {
      this.moveTowardTarget(time)
    }
    this.syncPresentation()
  }

  private chooseWanderTarget(time: number): void {
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
    const distance = Math.sqrt(Math.random()) * this.wanderRadius * 0.9
    this.target = new Phaser.Math.Vector2(
      this.spawn.x + Math.cos(angle) * distance,
      this.spawn.y + Math.sin(angle) * distance,
    )
    this.wanderState = 'moving'
    this.beginProgressTracking(time)
  }

  private moveTowardTarget(time: number): void {
    if (!this.target) {
      this.enterIdle(time)
      return
    }
    const direction = this.target.clone().subtract(new Phaser.Math.Vector2(this.x, this.y))
    if (direction.lengthSq() <= 64) {
      this.enterIdle(time)
      return
    }

    direction.normalize().scale(this.speed)
    this.setVelocity(direction.x, direction.y)
    if (Math.abs(direction.x) > Math.abs(direction.y)) {
      this.direction = direction.x > 0 ? 'right' : 'left'
    } else {
      this.direction = direction.y > 0 ? 'down' : 'up'
    }
    this.startWalkAnimation(this.direction)

    const progress = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      this.lastProgressPosition.x,
      this.lastProgressPosition.y,
    )
    if (progress >= 4) {
      this.beginProgressTracking(time)
    } else if (time - this.lastProgressAt >= 750) {
      this.enterIdle(time, 450, 1_100)
    }
  }

  private enforceWanderRadius(time: number): void {
    const offset = new Phaser.Math.Vector2(this.x - this.spawn.x, this.y - this.spawn.y)
    const distance = offset.length()
    if (distance <= this.wanderRadius) return

    offset.normalize().scale(this.wanderRadius - 1)
    this.setPosition(this.spawn.x + offset.x, this.spawn.y + offset.y)
    const body = this.body as Phaser.Physics.Arcade.Body
    body.updateFromGameObject()
    this.target = this.spawn.clone()
    this.wanderState = 'returning'
    this.beginProgressTracking(time)
  }

  private enterPaused(): void {
    if (this.wanderState !== 'paused') this.wanderState = 'paused'
    this.target = null
    this.setVelocity(0)
    this.stopWalkAnimation()
  }

  private enterIdle(time: number, minDelay = 1_200, maxDelay = 3_200): void {
    this.wanderState = 'idle'
    this.target = null
    this.setVelocity(0)
    this.stopWalkAnimation()
    this.nextDecisionAt = time + Phaser.Math.Between(minDelay, maxDelay)
  }

  private beginProgressTracking(time: number): void {
    this.lastProgressAt = time
    this.lastProgressPosition.set(this.x, this.y)
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
    this.setTexture(texture, 0).setDisplaySize(100, 100)
    this.syncCollisionBody()
    this.play(animation)
  }

  private stopWalkAnimation(useStaticFallback = false): void {
    this.stop()
    if (useStaticFallback && this.texture.key !== this.idleTexture) {
      this.setFlipX(false)
      this.setTexture(this.idleTexture).setDisplaySize(100, 100)
      this.syncCollisionBody()
    }
  }

  private syncCollisionBody(): void {
    const scale = Math.abs(this.scaleX)
    const radius = 18 / scale
    const offsetX = this.frame.realWidth / 2 - radius
    const offsetY = this.frame.realHeight / 2 + 34 / scale - radius
    this.setCircle(radius, offsetX, offsetY)
  }

  private syncPresentation(): void {
    this.setDepth(this.y)
    this.nameLabel.setPosition(this.x, this.y - 62).setDepth(this.y + 1)
  }
}
