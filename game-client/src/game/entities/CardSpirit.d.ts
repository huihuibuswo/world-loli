import Phaser from 'phaser';
export declare class CardSpirit extends Phaser.GameObjects.Container {
    private readonly aura;
    private readonly characterSprite;
    private readonly homeX;
    private readonly homeY;
    private readonly animationPrefix;
    private idleAnimation;
    private actionAnimation;
    private defeated;
    constructor(scene: Phaser.Scene, x: number, y: number, name: string, texture: string, color?: number);
    playAttack(direction: -1 | 1, onImpact: () => void): void;
    playHit(onComplete?: () => void): void;
    playDeath(): void;
    playVictory(): void;
    private playIdle;
    private stopAnimations;
    private playFrameAnimation;
}
