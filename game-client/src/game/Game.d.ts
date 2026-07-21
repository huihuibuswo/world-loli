import Phaser from 'phaser';
import type { MapData, PlayerProfile } from '@/api/types';
export declare class WorldGame {
    readonly game: Phaser.Game;
    constructor(parent: HTMLElement, map: MapData, player: PlayerProfile);
    private readonly startBattle;
    private readonly startWorld;
    destroy(): void;
}
