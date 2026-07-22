import Phaser from 'phaser';
export class PreloadScene extends Phaser.Scene {
    constructor() {
        super('PreloadScene');
    }
    preload() {
        const root = '/assets/generated';
        this.load.image('player-female', `${root}/sprites/adventurer-female.png`);
        this.load.image('player-male', `${root}/sprites/adventurer-male.png`);
        this.load.image('npc', `${root}/sprites/training-dummy.png`);
        this.load.image('obstacle', `${root}/sprites/forest-obstacle.png`);
        this.load.image('forest-stump', `${root}/sprites/forest-stump.png`);
        this.load.image('ancient-forest-tree', `${root}/sprites/ancient-forest-tree.png`);
        this.load.image('village-signpost', `${root}/sprites/village-signpost.png`);
        this.load.image('grass-ground', `${root}/textures/grass-ground.webp`);
        this.load.image('dirt-path', `${root}/textures/dirt-path.webp`);
        this.load.image('moon-arena', `${root}/backgrounds/moon-arena.webp`);
    }
    create() {
        this.scene.start('WorldScene');
    }
}
