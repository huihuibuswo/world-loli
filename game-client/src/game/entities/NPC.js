import Phaser from 'phaser';
export class NPC extends Phaser.Physics.Arcade.Sprite {
    npcId;
    npcName;
    constructor(scene, x, y, npcId, npcName) {
        super(scene, x, y, 'npc');
        this.npcId = npcId;
        this.npcName = npcName;
        scene.add.existing(this);
        scene.physics.add.existing(this, true);
        this.setDepth(y);
        this.setDisplaySize(92, 92);
        const body = this.body;
        body.updateFromGameObject();
        body.setSize(32, 26, false);
        body.setOffset(30, 62);
        scene.add
            .text(x, y - 58, npcName, {
            fontFamily: 'ui-rounded, sans-serif',
            fontSize: '17px',
            color: '#fff7dc',
            backgroundColor: '#10251dcc',
            padding: { x: 8, y: 4 },
        })
            .setOrigin(0.5)
            .setDepth(y + 1);
    }
}
