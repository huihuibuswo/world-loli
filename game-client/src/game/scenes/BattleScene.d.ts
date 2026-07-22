import Phaser from 'phaser';
export declare class BattleScene extends Phaser.Scene {
    private enemy;
    private playerSpirit;
    constructor();
    create(data: {
        enemyName?: string;
    }): void;
    private readonly onBattleAction;
}
