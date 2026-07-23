import Phaser from 'phaser';
export class NPC extends Phaser.Physics.Arcade.Sprite {
    npcId;
    npcName;
    constructor(scene, x, y, npcId, npcName, textureKey = 'npc-trainer') {
        const texture = scene.textures.exists(textureKey) ? textureKey : 'npc-trainer';
        super(scene, x, y, texture);
        this.npcId = npcId;
        this.npcName = npcName;
        scene.add.existing(this);
        scene.physics.add.existing(this, true);
        this.setDepth(y);
        const displaySize = 100;
        this.setDisplaySize(displaySize, displaySize);
        const body = this.body;
        body.updateFromGameObject();
        body.setSize(36, 22, true);
        body.reset(x, y + displaySize * 0.35);
        this.setPosition(x, y);
        scene.add
            .text(x, y - displaySize * 0.62, npcName, {
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
