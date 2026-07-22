import Phaser from 'phaser';
export declare class NPC extends Phaser.Physics.Arcade.Sprite {
    readonly npcId: number;
    readonly npcName: string;
    constructor(scene: Phaser.Scene, x: number, y: number, npcId: number, npcName: string, textureKey?: string);
}
