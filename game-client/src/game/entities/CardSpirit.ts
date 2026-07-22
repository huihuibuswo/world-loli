import Phaser from 'phaser'

const IDLE_KEYFRAMES: Array<Omit<Phaser.Types.Tweens.TweenBuilderConfig, 'targets'>> = [
  { y: -5, scaleX: 1.02, scaleY: 1.02, duration: 700, ease: 'Sine.easeInOut' },
  { y: 0, scaleX: 1, scaleY: 1, duration: 700, ease: 'Sine.easeInOut' },
]

export class CardSpirit extends Phaser.GameObjects.Container {
  private readonly aura: Phaser.GameObjects.Arc
  private readonly characterSprite: Phaser.GameObjects.Sprite
  private readonly homeX: number
  private readonly homeY: number
  private readonly animationPrefix: string | null
  private idleAnimation: Phaser.Tweens.TweenChain | null = null
  private actionAnimation: Phaser.Tweens.TweenChain | null = null
  private defeated = false

  constructor(scene: Phaser.Scene, x: number, y: number, name: string, texture: string, color = 0xd97706) {
    super(scene, x, y)
    this.homeX = x
    this.homeY = y
    this.animationPrefix = texture.endsWith('-combat') ? texture : null
    this.aura = scene.add.circle(0, 0, 68, color, 0.16)
    this.characterSprite = scene.add.sprite(0, 0, texture).setDisplaySize(136, 136)
    if (this.animationPrefix) this.characterSprite.setFrame(3)
    const label = scene.add
      .text(0, 78, name, { fontFamily: 'ui-rounded, sans-serif', fontSize: '18px', color: '#fff7dc' })
      .setOrigin(0.5)
    this.add([this.aura, this.characterSprite, label])
    scene.add.existing(this)
    this.playIdle()
  }

  playAttack(direction: -1 | 1, onImpact: () => void): void {
    if (this.defeated) return
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
      },
    })
  }

  playHit(onComplete?: () => void): void {
    if (this.defeated) return
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

  playDeath(): void {
    if (this.defeated) return
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
    })
    this.scene.tweens.add({ targets: this.aura, alpha: 0, scale: 0.55, duration: 480, ease: 'Cubic.easeIn' })
  }

  playVictory(): void {
    if (this.defeated) return
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
      },
    })
    this.scene.tweens.add({ targets: this.aura, alpha: 0.42, scale: 1.24, yoyo: true, repeat: 1, duration: 260 })
  }

  private playIdle(): void {
    if (this.defeated || this.idleAnimation?.isPlaying()) return
    if (this.animationPrefix) this.characterSprite.setFrame(3)
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
    this.idleAnimation = null
    this.actionAnimation = null
    this.setPosition(this.homeX, this.homeY).setScale(1).setAngle(0).setAlpha(1)
  }

  private playFrameAnimation(action: 'attack' | 'hit' | 'death' | 'victory'): void {
    if (!this.animationPrefix) return
    const key = `${this.animationPrefix}-${action}`
    if (this.scene.anims.exists(key)) this.characterSprite.play(key)
  }
}
