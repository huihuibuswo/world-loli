import Phaser from 'phaser';
export class PreloadScene extends Phaser.Scene {
    constructor() {
        super('PreloadScene');
    }
    preload() {
        const root = '/assets/generated';
        this.load.image('player-female', `${root}/sprites/adventurer-female.png`);
        this.load.image('player-male', `${root}/sprites/adventurer-male.png`);
        this.load.spritesheet('player-female-walk', `${root}/sprites/adventurer-female-walk-sheet.png`, {
            frameWidth: 627,
            frameHeight: 627,
        });
        this.load.spritesheet('player-male-walk', `${root}/sprites/adventurer-male-walk-sheet.png`, {
            frameWidth: 627,
            frameHeight: 627,
        });
        this.load.spritesheet('player-female-combat', `${root}/sprites/adventurer-female-combat-sheet.png`, {
            frameWidth: 313,
            frameHeight: 313,
            margin: 1,
        });
        this.load.spritesheet('player-male-combat', `${root}/sprites/adventurer-male-combat-sheet.png`, {
            frameWidth: 256,
            frameHeight: 256,
        });
        this.load.image('obstacle', `${root}/sprites/forest-obstacle.png`);
        this.load.image('forest-stump', `${root}/sprites/forest-stump.png`);
        this.load.image('ancient-forest-tree', `${root}/sprites/ancient-forest-tree.png`);
        this.load.image('village-signpost', `${root}/sprites/village-signpost.png`);
        this.load.image('village-chief-house', `${root}/sprites/village-chief-house.png`);
        this.load.image('village-general-store', `${root}/sprites/village-general-store.png`);
        this.load.image('village-smithy', `${root}/sprites/village-smithy.png`);
        this.load.image('village-inn', `${root}/sprites/village-inn.png`);
        this.load.image('village-cottage-a', `${root}/sprites/village-cottage-a.png`);
        this.load.image('village-cottage-b', `${root}/sprites/village-cottage-b.png`);
        this.load.image('npc-village-chief', `${root}/sprites/npc-village-chief.png`);
        this.load.image('npc-shopkeeper', `${root}/sprites/npc-shopkeeper.png`);
        this.load.image('npc-suna', `${root}/sprites/npc-suna.png`);
        this.load.image('npc-forest-guide', `${root}/sprites/npc-forest-guide.png`);
        this.load.image('npc-trainer', `${root}/sprites/npc-trainer.png`);
        this.load.image('grass-ground', `${root}/textures/grass-ground.webp`);
        this.load.image('dirt-path', `${root}/textures/dirt-path.webp`);
        this.load.image('moon-arena', `${root}/backgrounds/moon-arena.webp`);
    }
    create() {
        for (const gender of ['female', 'male']) {
            this.anims.create({
                key: `player-${gender}-walk-cycle`,
                frames: this.anims.generateFrameNumbers(`player-${gender}-walk`, { frames: [0, 1, 2, 3] }),
                frameRate: 9,
                repeat: -1,
            });
            const combatTexture = `player-${gender}-combat`;
            const actions = [
                { name: 'attack', frames: [0, 1, 2, 3], frameRate: 10 },
                { name: 'hit', frames: [4, 5, 6, 7], frameRate: 10 },
                { name: 'death', frames: [8, 9, 10, 11], frameRate: 8 },
                { name: 'victory', frames: [12, 13, 14, 15], frameRate: 7 },
            ];
            actions.forEach(({ name, frames, frameRate }) => {
                this.anims.create({
                    key: `${combatTexture}-${name}`,
                    frames: this.anims.generateFrameNumbers(combatTexture, { frames }),
                    frameRate,
                    repeat: 0,
                });
            });
        }
        this.scene.start('WorldScene');
    }
}
