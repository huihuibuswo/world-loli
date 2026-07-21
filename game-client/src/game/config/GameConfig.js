import Phaser from 'phaser';
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export function createGameConfig(parent) {
    return {
        type: Phaser.AUTO,
        parent,
        backgroundColor: '#07140f',
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        transparent: true,
        render: { antialias: true, pixelArt: false },
        physics: {
            default: 'arcade',
            arcade: { gravity: { x: 0, y: 0 }, debug: false },
        },
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            width: GAME_WIDTH,
            height: GAME_HEIGHT,
        },
        input: { activePointers: 3 },
        scene: [],
    };
}
