import Phaser from 'phaser'

export class NPC extends Phaser.Physics.Arcade.Sprite {
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly npcId: number,
    readonly npcName: string,
  ) {
    super(scene, x, y, 'npc')
    scene.add.existing(this)
    scene.physics.add.existing(this, true)
    this.setDepth(15)
    this.setCircle(22, 7, 7)
    scene.add
      .text(x, y - 46, npcName, {
        fontFamily: 'ui-rounded, sans-serif',
        fontSize: '17px',
        color: '#fff7dc',
        backgroundColor: '#10251dcc',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(16)
  }
}
