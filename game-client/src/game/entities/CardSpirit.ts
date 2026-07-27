import Phaser from 'phaser'

const IDLE_KEYFRAMES: Array<Omit<Phaser.Types.Tweens.TweenBuilderConfig, 'targets'>> = [
  { y: -5, scaleX: 1.02, scaleY: 1.02, duration: 700, ease: 'Sine.easeInOut' },
  { y: 0, scaleX: 1, scaleY: 1, duration: 700, ease: 'Sine.easeInOut' },
]

export class CardSpirit extends Phaser.GameObjects.Container {
  private readonly aura: Phaser.GameObjects.Arc
  private readonly barrier: Phaser.GameObjects.Ellipse
  private readonly characterSprite: Phaser.GameObjects.Sprite
  private readonly homeX: number
  private readonly homeY: number
  private readonly animationPrefix: string | null
  private readonly defenseTexture: string | null
  private idleAnimation: Phaser.Tweens.TweenChain | null = null
  private actionAnimation: Phaser.Tweens.TweenChain | null = null
  private barrierAnimation: Phaser.Tweens.Tween | null = null
  private defeated = false

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    name: string,
    texture: string,
    color = 0xd97706,
    defenseTexture?: string,
    tint?: number,
  ) {
    super(scene, x, y)
    this.homeX = x
    this.homeY = y
    this.animationPrefix = texture.endsWith('-combat') ? texture : null
    this.defenseTexture = defenseTexture && scene.textures.exists(defenseTexture) ? defenseTexture : null
    this.aura = scene.add.circle(0, 0, 68, color, 0.16)
    this.barrier = scene.add.ellipse(0, -4, 116, 142, 0x5eead4, 0).setStrokeStyle(4, 0xccfbf1, 0).setVisible(false)
    this.characterSprite = scene.add.sprite(0, 0, texture).setDisplaySize(136, 136)
    if (tint !== undefined) this.characterSprite.setTint(tint)
    if (this.animationPrefix) this.characterSprite.setFrame(3)
    const label = scene.add
      .text(0, 78, name, { fontFamily: 'ui-rounded, sans-serif', fontSize: '18px', color: '#fff7dc' })
      .setOrigin(0.5)
    this.add([this.aura, this.barrier, this.characterSprite, label])
    scene.add.existing(this)
    this.playIdle()
  }

  playAttack(direction: -1 | 1, onImpact: () => void, onComplete?: () => void): void {
    if (this.defeated) {
      onComplete?.()
      return
    }
    this.stopAnimations()
    this.playFrameAnimation('attack')
    this.actionAnimation = this.scene.tweens.chain({
      targets: this,
      tweens: [
        { x: this.homeX - direction * 12, scaleX: 0.92, scaleY: 1.07, angle: -direction * 4, duration: 100, ease: 'Sine.easeIn' },
        {
          x: this.homeX + direction * 62,
          scaleX: 1.1,
          scaleY: 0.9,
          angle: direction * 6,
          duration: 120,
          ease: 'Cubic.easeOut',
          onComplete: onImpact,
        },
        { x: this.homeX, scaleX: 1, scaleY: 1, angle: 0, duration: 210, ease: 'Back.easeOut' },
      ],
      onComplete: () => {
        this.actionAnimation = null
        this.playIdle()
        onComplete?.()
      },
    })
  }

  playDefense(onComplete?: () => void): void {
    if (this.defeated) {
      onComplete?.()
      return
    }
    this.stopAnimations()
    this.playFrameAnimation('defense')
    this.barrier.setVisible(true).setAlpha(0).setScale(0.72)
    this.barrierAnimation = this.scene.tweens.add({
      targets: this.barrier,
      alpha: { from: 0, to: 0.82 },
      scale: { from: 0.72, to: 1.08 },
      yoyo: true,
      duration: 230,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.barrierAnimation = null
        this.barrier.setVisible(false)
      },
    })
    this.actionAnimation = this.scene.tweens.chain({
      targets: this,
      tweens: [
        { scaleX: 0.96, scaleY: 1.04, y: this.homeY + 4, duration: 150, ease: 'Sine.easeOut' },
        { scaleX: 1.03, scaleY: 0.98, y: this.homeY, duration: 350, ease: 'Back.easeOut' },
      ],
      onComplete: () => {
        this.actionAnimation = null
        this.playIdle()
        onComplete?.()
      },
    })
  }

  playHit(onComplete?: () => void): void {
    if (this.defeated) {
      onComplete?.()
      return
    }
    this.stopAnimations()
    this.playFrameAnimation('hit')
    const away = this.homeX < this.scene.scale.width / 2 ? -1 : 1
    this.actionAnimation = this.scene.tweens.chain({
      targets: this,
      tweens: [
        { x: this.homeX + away * 18, alpha: 0.35, angle: away * 7, duration: 110, ease: 'Cubic.easeOut' },
        { x: this.homeX - away * 7, alpha: 1, angle: -away * 3, duration: 110 },
        { x: this.homeX, angle: 0, duration: 140, ease: 'Sine.easeOut' },
      ],
      onComplete: () => {
        this.actionAnimation = null
        onComplete?.()
        if (!this.defeated) this.playIdle()
      },
    })
  }

  playDeath(onComplete?: () => void): void {
    if (this.defeated) {
      onComplete?.()
      return
    }
    this.defeated = true
    this.stopAnimations()
    this.playFrameAnimation('death')
    this.actionAnimation = this.scene.tweens.chain({
      targets: this,
      tweens: [
        { y: this.homeY - 8, duration: 100, ease: 'Sine.easeOut' },
        { y: this.homeY + 8, duration: 360, ease: 'Cubic.easeIn' },
        { alpha: 0.28, duration: 300, ease: 'Sine.easeIn' },
      ],
      onComplete: () => {
        this.actionAnimation = null
        onComplete?.()
      },
    })
    this.scene.tweens.add({ targets: this.aura, alpha: 0, scale: 0.55, duration: 480, ease: 'Cubic.easeIn' })
  }

  playVictory(onComplete?: () => void): void {
    if (this.defeated) {
      onComplete?.()
      return
    }
    this.stopAnimations()
    this.playFrameAnimation('victory')
    this.actionAnimation = this.scene.tweens.chain({
      targets: this,
      tweens: [
        { scaleX: 1.04, scaleY: 1.04, duration: 280, ease: 'Sine.easeOut' },
        { scaleX: 1, scaleY: 1, duration: 360, ease: 'Bounce.easeOut' },
      ],
      onComplete: () => {
        this.actionAnimation = null
        this.playIdle()
        onComplete?.()
      },
    })
    this.scene.tweens.add({ targets: this.aura, alpha: 0.42, scale: 1.24, yoyo: true, duration: 260 })
  }

  private playIdle(): void {
    if (this.defeated || this.idleAnimation?.isPlaying()) return
    this.characterSprite.stop()
    if (this.animationPrefix) this.characterSprite.setTexture(this.animationPrefix, 3)
    this.setPosition(this.homeX, this.homeY).setScale(1).setAngle(0).setAlpha(1)
    this.idleAnimation = this.scene.tweens.chain({
      targets: this,
      loop: -1,
      tweens: IDLE_KEYFRAMES.map((keyframe) => ({
        ...keyframe,
        y: this.homeY + Number(keyframe.y),
      })),
    })
  }

  private stopAnimations(): void {
    this.idleAnimation?.stop()
    this.actionAnimation?.stop()
    this.barrierAnimation?.stop()
    this.characterSprite.stop()
    this.idleAnimation = null
    this.actionAnimation = null
    this.barrierAnimation = null
    this.setPosition(this.homeX, this.homeY).setScale(1).setAngle(0).setAlpha(1)
    this.barrier.setVisible(false)
  }

  private playFrameAnimation(action: 'attack' | 'defense' | 'hit' | 'death' | 'victory'): void {
    if (!this.animationPrefix) return
    const key = `${this.animationPrefix}-${action}`
    if (!this.scene.anims.exists(key)) return
    if (action === 'defense' && this.defenseTexture) this.characterSprite.setTexture(this.defenseTexture)
    else this.characterSprite.setTexture(this.animationPrefix)
    this.characterSprite.play(key)
  }
}
