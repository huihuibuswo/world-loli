import Phaser from 'phaser';
export declare class WorldScene extends Phaser.Scene {
    private player;
    private npcs;
    private cursors;
    private wasd;
    private interactKey;
    private nearby;
    private lastPositionEmit;
    constructor();
    create(): void;
    update(time: number): void;
    private readonly onVirtualDirection;
    private readonly interact;
    private updateNearbyNpc;
    private drawWorld;
}
