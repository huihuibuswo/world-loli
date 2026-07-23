import Phaser from 'phaser';
export declare class WorldScene extends Phaser.Scene {
    private player;
    private npcs;
    private portals;
    private playerMapMarker;
    private cursors;
    private wasd;
    private interactKey;
    private nearby;
    private nearbyPortal;
    private lastPositionEmit;
    constructor();
    create(): void;
    update(time: number): void;
    private readonly onVirtualDirection;
    private readonly onInputLock;
    private readonly interact;
    private updateNearbyInteractable;
    private createMinimap;
    private drawWorld;
}
