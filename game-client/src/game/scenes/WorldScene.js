import Phaser from 'phaser';
import { gameEvents } from '@/game/events';
import { NPC } from '@/game/entities/NPC';
import { Player } from '@/game/entities/Player';
export class WorldScene extends Phaser.Scene {
    player;
    npcs = [];
    cursors;
    wasd;
    interactKey;
    nearby = null;
    lastPositionEmit = 0;
    constructor() {
        super('WorldScene');
    }
    create() {
        const map = this.registry.get('world-map');
        const profile = this.registry.get('world-player');
        const bounds = map.resource.bounds ?? { min_x: 0, min_y: 0, max_x: 2048, max_y: 2048 };
        const width = bounds.max_x - bounds.min_x;
        const height = bounds.max_y - bounds.min_y;
        this.physics.world.setBounds(bounds.min_x, bounds.min_y, width, height);
        this.cameras.main.setBounds(bounds.min_x, bounds.min_y, width, height);
        this.drawWorld(width, height);
        const obstacles = this.physics.add.staticGroup();
        [
            [640, 420],
            [830, 260],
            [1050, 520],
            [430, 690],
            [1270, 350],
        ].forEach(([x, y]) => obstacles.create(x, y, 'obstacle'));
        this.player = new Player(this, profile.position_x, profile.position_y);
        this.physics.add.collider(this.player, obstacles);
        this.npcs = (map.resource.objects ?? [])
            .filter((item) => item.type === 'npc' && item.template_id)
            .map((item) => new NPC(this, item.x, item.y, item.template_id, item.template_name ?? '旅人'));
        this.npcs.forEach((npc) => this.physics.add.collider(this.player, npc));
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        this.cameras.main.setZoom(1.08);
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');
        this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        gameEvents.on('input:direction', this.onVirtualDirection);
        gameEvents.on('input:interact', this.interact);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            gameEvents.off('input:direction', this.onVirtualDirection);
            gameEvents.off('input:interact', this.interact);
        });
        gameEvents.emit('world:ready', undefined);
    }
    update(time) {
        this.player.move(this.cursors, this.wasd);
        this.updateNearbyNpc();
        if (Phaser.Input.Keyboard.JustDown(this.interactKey))
            this.interact();
        if (time - this.lastPositionEmit > 600 && this.player.body?.velocity.lengthSq()) {
            this.lastPositionEmit = time;
            gameEvents.emit('player:moved', { x: this.player.x, y: this.player.y });
        }
    }
    onVirtualDirection = ({ x, y }) => {
        this.player?.setVirtualDirection(x, y);
    };
    interact = () => {
        if (this.nearby)
            gameEvents.emit('npc:interact', { id: this.nearby.npcId });
    };
    updateNearbyNpc() {
        let nearest = null;
        let distance = this.player.interactionRange;
        for (const npc of this.npcs) {
            const next = Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y);
            if (next < distance) {
                distance = next;
                nearest = npc;
            }
        }
        if (nearest !== this.nearby) {
            this.nearby = nearest;
            gameEvents.emit('npc:near', { id: nearest?.npcId ?? null, name: nearest?.npcName ?? null });
        }
    }
    drawWorld(width, height) {
        const graphics = this.add.graphics().setDepth(-10);
        graphics.fillStyle(0x0b2118).fillRect(0, 0, width, height);
        const tile = 96;
        for (let y = 0; y < height; y += tile) {
            for (let x = 0; x < width; x += tile) {
                const even = (x / tile + y / tile) % 2 === 0;
                graphics.fillStyle(even ? 0x123424 : 0x153a28, 0.95).fillRoundedRect(x + 3, y + 3, 90, 90, 14);
                if ((x * 3 + y * 7) % 480 === 0) {
                    graphics.fillStyle(0x286444, 0.7).fillCircle(x + 30, y + 28, 8);
                }
            }
        }
        graphics.fillStyle(0x9b722d, 0.45).fillRoundedRect(70, 90, 1050, 116, 48);
        graphics.fillStyle(0xc49744, 0.25).fillRoundedRect(115, 124, 970, 46, 22);
    }
}
