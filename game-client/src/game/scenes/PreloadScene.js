import Phaser from 'phaser';
export class PreloadScene extends Phaser.Scene {
    constructor() {
        super('PreloadScene');
    }
    create() {
        const graphics = this.make.graphics({ x: 0, y: 0 });
        graphics.fillStyle(0x31a66a).fillCircle(28, 28, 27);
        graphics.lineStyle(3, 0xd9ffe8).strokeCircle(28, 28, 24);
        graphics.fillStyle(0xf6d07c).fillTriangle(28, 5, 17, 22, 39, 22);
        graphics.generateTexture('player', 56, 56);
        graphics.clear();
        graphics.fillStyle(0xd97706).fillCircle(29, 29, 28);
        graphics.lineStyle(3, 0xffedbd).strokeCircle(29, 29, 24);
        graphics.fillStyle(0x0f172a).fillCircle(21, 27, 3).fillCircle(37, 27, 3);
        graphics.generateTexture('npc', 58, 58);
        graphics.clear();
        graphics.fillStyle(0x17382a).fillRoundedRect(0, 0, 96, 96, 18);
        graphics.lineStyle(2, 0x295d45).strokeRoundedRect(1, 1, 94, 94, 18);
        graphics.generateTexture('obstacle', 96, 96);
        graphics.destroy();
        this.scene.start('WorldScene');
    }
}
