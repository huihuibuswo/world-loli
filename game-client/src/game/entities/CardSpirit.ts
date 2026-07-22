import Phaser from 'phaser'

export class CardSpirit extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number, name: string, texture: string, color = 0xd97706) {
    super(scene, x, y)
    const aura = scene.add.circle(0, 0, 68, color, 0.16)
    const body = scene.add.image(0, 0, texture).setDisplaySize(136, 136)
    const label = scene.add
      .text(0, 78, name, { fontFamily: 'ui-rounded, sans-serif', fontSize: '18px', color: '#fff7dc' })
      .setOrigin(0.5)
    this.add([aura, body, label])
    scene.add.existing(this)
  }
}
