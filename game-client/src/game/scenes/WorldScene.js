import Phaser from 'phaser';
import { gameEvents } from '@/game/events';
import { NPC } from '@/game/entities/NPC';
import { Player } from '@/game/entities/Player';
export class WorldScene extends Phaser.Scene {
    player;
    npcs = [];
    playerMapMarker;
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
        const obstacleLayout = [
            { x: 640, y: 420, texture: 'obstacle', size: 96, body: { shape: 'circle', radius: 34, offsetX: 14, offsetY: 27 } },
            { x: 830, y: 260, texture: 'forest-stump', size: 96, body: { shape: 'circle', radius: 32, offsetX: 16, offsetY: 40 } },
            { x: 1050, y: 520, texture: 'obstacle', size: 96, body: { shape: 'circle', radius: 34, offsetX: 14, offsetY: 27 } },
            { x: 430, y: 690, texture: 'village-signpost', size: 110, body: { shape: 'rect', width: 66, height: 28, offsetX: 22, offsetY: 75 } },
            { x: 1270, y: 350, texture: 'forest-stump', size: 96, body: { shape: 'circle', radius: 32, offsetX: 16, offsetY: 40 } },
            { x: 360, y: 520, texture: 'ancient-forest-tree', size: 320, body: { shape: 'rect', width: 88, height: 44, offsetX: 116, offsetY: 250 } },
            { x: 900, y: 590, texture: 'ancient-forest-tree', size: 320, body: { shape: 'rect', width: 88, height: 44, offsetX: 116, offsetY: 250 } },
            { x: 1400, y: 410, texture: 'ancient-forest-tree', size: 320, body: { shape: 'rect', width: 88, height: 44, offsetX: 116, offsetY: 250 } },
            { x: 1740, y: 680, texture: 'ancient-forest-tree', size: 320, body: { shape: 'rect', width: 88, height: 44, offsetX: 116, offsetY: 250 } },
            { x: 1530, y: 1060, texture: 'ancient-forest-tree', size: 320, body: { shape: 'rect', width: 88, height: 44, offsetX: 116, offsetY: 250 } },
            { x: 1050, y: 1450, texture: 'ancient-forest-tree', size: 320, body: { shape: 'rect', width: 88, height: 44, offsetX: 116, offsetY: 250 } },
            { x: 520, y: 1260, texture: 'ancient-forest-tree', size: 320, body: { shape: 'rect', width: 88, height: 44, offsetX: 116, offsetY: 250 } },
            { x: 280, y: 820, texture: 'ancient-forest-tree', size: 320, body: { shape: 'rect', width: 88, height: 44, offsetX: 116, offsetY: 250 } },
            { x: 1880, y: 1120, texture: 'ancient-forest-tree', size: 320, body: { shape: 'rect', width: 88, height: 44, offsetX: 116, offsetY: 250 } },
            { x: 1810, y: 1530, texture: 'ancient-forest-tree', size: 320, body: { shape: 'rect', width: 88, height: 44, offsetX: 116, offsetY: 250 } },
            { x: 1510, y: 1850, texture: 'ancient-forest-tree', size: 320, body: { shape: 'rect', width: 88, height: 44, offsetX: 116, offsetY: 250 } },
            { x: 1080, y: 1840, texture: 'ancient-forest-tree', size: 320, body: { shape: 'rect', width: 88, height: 44, offsetX: 116, offsetY: 250 } },
            { x: 650, y: 1750, texture: 'ancient-forest-tree', size: 320, body: { shape: 'rect', width: 88, height: 44, offsetX: 116, offsetY: 250 } },
            { x: 220, y: 1580, texture: 'ancient-forest-tree', size: 320, body: { shape: 'rect', width: 88, height: 44, offsetX: 116, offsetY: 250 } },
        ];
        obstacleLayout.forEach(({ x, y, texture, size, body: bodyConfig }) => {
            const bodyHalfHeight = bodyConfig.shape === 'circle' ? bodyConfig.radius : bodyConfig.height / 2;
            const bodyCenterOffsetY = -size / 2 + bodyConfig.offsetY + bodyHalfHeight;
            const obstacle = obstacles.create(x, y - bodyCenterOffsetY, texture);
            obstacle.setDisplaySize(size, size).setDepth(y).refreshBody();
            const body = obstacle.body;
            if (bodyConfig.shape === 'circle') {
                body.setCircle(bodyConfig.radius, 0, 0);
                body.setOffset(bodyConfig.offsetX, bodyConfig.offsetY);
            }
            else {
                body.setSize(bodyConfig.width, bodyConfig.height, false);
                body.setOffset(bodyConfig.offsetX, bodyConfig.offsetY);
            }
        });
        const avatarGender = profile.avatar_gender === 'male' ? 'male' : 'female';
        this.player = new Player(this, profile.position_x, profile.position_y, avatarGender);
        this.physics.add.collider(this.player, obstacles);
        this.npcs = (map.resource.objects ?? [])
            .filter((item) => item.type === 'npc' && item.template_id)
            .map((item) => new NPC(this, item.x, item.y, item.template_id, item.template_name ?? '旅人'));
        this.npcs.forEach((npc) => this.physics.add.collider(this.player, npc));
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        this.cameras.main.setZoom(1.08);
        this.createMinimap(bounds.min_x, bounds.min_y, width, height);
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
        this.playerMapMarker.setPosition(this.player.x, this.player.y);
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
    createMinimap(minX, minY, width, height) {
        const viewport = { x: 1110, y: 82, width: 150, height: 150 };
        const minimap = this.cameras
            .add(viewport.x, viewport.y, viewport.width, viewport.height)
            .setName('world-minimap')
            .setBounds(minX, minY, width, height)
            .setBackgroundColor('rgba(0, 0, 0, 0)')
            .setRoundPixels(true);
        minimap.setZoom(Math.min(viewport.width / width, viewport.height / height) * 0.94);
        minimap.centerOn(minX + width / 2, minY + height / 2);
        this.playerMapMarker = this.add
            .circle(this.player.x, this.player.y, 38, 0xfef3c7)
            .setStrokeStyle(9, 0x15803d)
            .setDepth(100_000);
        const npcMarkers = this.npcs.map((npc) => this.add.circle(npc.x, npc.y, 30, 0xf59e0b).setDepth(99_999));
        this.cameras.main.ignore([this.playerMapMarker, ...npcMarkers]);
    }
    drawWorld(width, height) {
        this.add.tileSprite(0, 0, width, height, 'grass-ground').setOrigin(0).setDepth(-10);
        const path = this.add.tileSprite(70, 90, 1050, 116, 'dirt-path').setOrigin(0).setDepth(-9);
        const maskShape = this.make.graphics({ x: 0, y: 0 }, false);
        maskShape.fillStyle(0xffffff).fillRoundedRect(70, 90, 1050, 116, 48);
        path.setMask(maskShape.createGeometryMask());
    }
}
