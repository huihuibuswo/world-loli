import Phaser from 'phaser'
import { CardSpirit } from '@/game/entities/CardSpirit'
import { gameEvents } from '@/game/events'

export class BattleScene extends Phaser.Scene {
  private enemy!: CardSpirit
  private playerSpirit!: CardSpirit

  constructor() {
    super('BattleScene')
  }

  create(data: { enemyName?: string }): void {
    const { width, height } = this.scale
    const background = this.add.graphics()
    background.fillGradientStyle(0x07140f, 0x07140f, 0x18213a, 0x10182c, 1)
    background.fillRect(0, 0, width, height)
    background.fillStyle(0x1f7a4c, 0.12).fillCircle(width * 0.18, height * 0.28, 250)
    background.fillStyle(0xd97706, 0.1).fillCircle(width * 0.8, height * 0.35, 300)
    this.add
      .text(width / 2, 54, '月影竞技场', {
        fontFamily: 'ui-rounded, sans-serif',
        fontSize: '30px',
        color: '#fff1bd',
      })
      .setOrigin(0.5)
    this.enemy = new CardSpirit(this, width * 0.72, height * 0.3, data.enemyName ?? '训练木偶', 0xb45309)
    this.playerSpirit = new CardSpirit(this, width * 0.28, height * 0.58, '冒险者', 0x15803d)
    gameEvents.on('battle:impact', this.onImpact)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      gameEvents.off('battle:impact', this.onImpact)
    })
  }

  private readonly onImpact = ({ target }: { damage: number; target: 'enemy' | 'player' }): void => {
    const spirit = target === 'enemy' ? this.enemy : this.playerSpirit
    if (!spirit) return
    this.tweens.add({
      targets: spirit,
      x: spirit.x + (target === 'enemy' ? 16 : -16),
      alpha: 0.55,
      yoyo: true,
      duration: 90,
      repeat: 1,
    })
  }
}
