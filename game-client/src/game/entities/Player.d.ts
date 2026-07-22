import Phaser from 'phaser';
export type PlayerState = 'idle' | 'walk' | 'interact' | 'battle' | 'disabled';
export declare class Player extends Phaser.Physics.Arcade.Sprite {
    readonly speed = 220;
    readonly interactionRange = 104;
    state: PlayerState;
    direction: 'up' | 'down' | 'left' | 'right';
    private virtual;
    private readonly idleTexture;
    private readonly walkTexture;
    private readonly walkAnimationKey;
    private readonly walkDisplaySize;
    constructor(scene: Phaser.Scene, x: number, y: number, avatarGender?: 'female' | 'male');
    setVirtualDirection(x: number, y: number): void;
    move(cursors: Phaser.Types.Input.Keyboard.CursorKeys, wasd: Record<string, Phaser.Input.Keyboard.Key>): void;
    private startWalkAnimation;
    private stopWalkAnimation;
    private syncCollisionBody;
}
