import Phaser from 'phaser';
import { gameEvents } from '@/game/events';
import { NPC } from '@/game/entities/NPC';
import { Player } from '@/game/entities/Player';
export class WorldScene extends Phaser.Scene {
    player;
    npcs = [];
    portals = [];
    playerMapMarker;
    cursors;
    wasd;
    interactKey;
    nearby = null;
    nearbyPortal = null;
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
        this.drawWorld(width, height, map.map_type);
        const obstacles = this.physics.add.staticGroup();
        const obstacleLayout = [
            { x: 1180, y: 620, texture: 'obstacle', size: 96, body: { shape: 'circle', radius: 28, offsetX: 20, offsetY: 27 } },
            { x: 1160, y: 300, texture: 'forest-stump', size: 96, body: { shape: 'circle', radius: 29, offsetX: 19, offsetY: 27 } },
            { x: 1050, y: 520, texture: 'obstacle', size: 96, body: { shape: 'circle', radius: 28, offsetX: 20, offsetY: 27 } },
            { x: 1030, y: 1140, texture: 'village-signpost', size: 110, body: { shape: 'rect', width: 44, height: 22, offsetX: 33, offsetY: 84 } },
            { x: 1270, y: 350, texture: 'forest-stump', size: 96, body: { shape: 'circle', radius: 29, offsetX: 19, offsetY: 27 } },
            // House textures contain transparent padding below the visible pixels. These offsets
            // align each footprint with the actual alpha bounds instead of the 512px canvas edge.
            { x: 650, y: 430, texture: 'village-chief-house', size: 420, body: { shape: 'rect', width: 330, height: 110, offsetX: 45, offsetY: 246 } },
            { x: 920, y: 710, texture: 'village-general-store', size: 330, body: { shape: 'rect', width: 240, height: 92, offsetX: 45, offsetY: 181 } },
            { x: 300, y: 750, texture: 'village-smithy', size: 350, body: { shape: 'rect', width: 300, height: 110, offsetX: 26, offsetY: 198 } },
            { x: 760, y: 1040, texture: 'village-inn', size: 320, body: { shape: 'rect', width: 240, height: 96, offsetX: 40, offsetY: 190 } },
            { x: 270, y: 1080, texture: 'village-cottage-a', size: 280, body: { shape: 'rect', width: 220, height: 88, offsetX: 31, offsetY: 145 } },
            { x: 1080, y: 950, texture: 'village-cottage-b', size: 300, body: { shape: 'rect', width: 250, height: 90, offsetX: 26, offsetY: 148 } },
            { x: 1260, y: 820, texture: 'ancient-forest-tree', size: 320, body: { shape: 'rect', width: 100, height: 60, offsetX: 110, offsetY: 238 } },
            { x: 1400, y: 410, texture: 'ancient-forest-tree', size: 320, body: { shape: 'rect', width: 100, height: 60, offsetX: 110, offsetY: 238 } },
            { x: 1740, y: 680, texture: 'ancient-forest-tree', size: 320, body: { shape: 'rect', width: 100, height: 60, offsetX: 110, offsetY: 238 } },
            { x: 1530, y: 1060, texture: 'ancient-forest-tree', size: 320, body: { shape: 'rect', width: 100, height: 60, offsetX: 110, offsetY: 238 } },
            { x: 1050, y: 1450, texture: 'ancient-forest-tree', size: 320, body: { shape: 'rect', width: 100, height: 60, offsetX: 110, offsetY: 238 } },
            { x: 520, y: 1260, texture: 'ancient-forest-tree', size: 320, body: { shape: 'rect', width: 100, height: 60, offsetX: 110, offsetY: 238 } },
            { x: 1880, y: 1120, texture: 'ancient-forest-tree', size: 320, body: { shape: 'rect', width: 100, height: 60, offsetX: 110, offsetY: 238 } },
            { x: 1810, y: 1530, texture: 'ancient-forest-tree', size: 320, body: { shape: 'rect', width: 100, height: 60, offsetX: 110, offsetY: 238 } },
            { x: 1510, y: 1850, texture: 'ancient-forest-tree', size: 320, body: { shape: 'rect', width: 100, height: 60, offsetX: 110, offsetY: 238 } },
            { x: 1080, y: 1840, texture: 'ancient-forest-tree', size: 320, body: { shape: 'rect', width: 100, height: 60, offsetX: 110, offsetY: 238 } },
            { x: 650, y: 1750, texture: 'ancient-forest-tree', size: 320, body: { shape: 'rect', width: 100, height: 60, offsetX: 110, offsetY: 238 } },
            { x: 220, y: 1580, texture: 'ancient-forest-tree', size: 320, body: { shape: 'rect', width: 100, height: 60, offsetX: 110, offsetY: 238 } },
        ];
        // Body offsets describe the footprint inside the displayed texture; layout x/y is the footprint center.
        const activeObstacleLayout = map.map_type === 'forest'
            ? obstacleLayout.filter(({ texture }) => ['obstacle', 'forest-stump', 'ancient-forest-tree'].includes(texture))
            : obstacleLayout;
        activeObstacleLayout.forEach(({ x, y, texture, size, body: bodyConfig }) => {
            const bodyHalfWidth = bodyConfig.shape === 'circle' ? bodyConfig.radius : bodyConfig.width / 2;
            const bodyHalfHeight = bodyConfig.shape === 'circle' ? bodyConfig.radius : bodyConfig.height / 2;
            const bodyCenterOffsetX = -size / 2 + bodyConfig.offsetX + bodyHalfWidth;
            const bodyCenterOffsetY = -size / 2 + bodyConfig.offsetY + bodyHalfHeight;
            const visualX = x - bodyCenterOffsetX;
            const visualY = y - bodyCenterOffsetY;
            const obstacle = obstacles.create(visualX, visualY, texture);
            obstacle.setDisplaySize(size, size).setDepth(y).refreshBody();
            const body = obstacle.body;
            if (bodyConfig.shape === 'circle') {
                body.setCircle(bodyConfig.radius, size / 2 - bodyConfig.radius, size / 2 - bodyConfig.radius);
            }
            else {
                body.setSize(bodyConfig.width, bodyConfig.height, true);
            }
            // reset() safely reindexes the static body at the footprint center. Restoring the image
            // afterward is intentional: a StaticBody does not follow its Game Object automatically.
            body.reset(x, y);
            obstacle.setPosition(visualX, visualY);
        });
        const avatarGender = profile.avatar_gender === 'male' ? 'male' : 'female';
        this.player = new Player(this, profile.position_x, profile.position_y, avatarGender);
        this.physics.add.collider(this.player, obstacles);
        this.npcs = (map.resource.objects ?? [])
            .filter((item) => item.type === 'npc' && item.template_id)
            .map((item) => new NPC(this, item.x, item.y, item.template_id, item.template_name ?? '旅人', item.sprite));
        this.npcs.forEach((npc) => this.physics.add.collider(this.player, npc));
        this.portals = (map.resource.objects ?? []).flatMap((item) => {
            if (item.type !== 'map_portal' || !item.target_map_id || !item.target_map_name)
                return [];
            return [{
                    x: item.x,
                    y: item.y,
                    targetMapId: item.target_map_id,
                    targetMapName: item.target_map_name,
                    label: item.label || `前往${item.target_map_name}`,
                }];
        });
        this.portals.forEach((portal) => {
            this.add.circle(portal.x, portal.y, 54, 0x38bdf8, 0.16)
                .setStrokeStyle(3, 0x7dd3fc, 0.82)
                .setDepth(portal.y - 2);
            this.add.image(portal.x, portal.y - 18, 'village-signpost')
                .setDisplaySize(92, 92)
                .setDepth(portal.y);
            this.add.text(portal.x, portal.y + 46, portal.label, {
                fontFamily: 'ui-rounded, sans-serif',
                fontSize: '14px',
                color: '#e0f2fe',
                backgroundColor: 'rgba(3, 22, 32, 0.82)',
                padding: { x: 9, y: 5 },
            }).setOrigin(0.5).setDepth(portal.y + 1);
        });
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        this.cameras.main.setZoom(1.08);
        this.createMinimap(bounds.min_x, bounds.min_y, width, height);
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');
        this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        gameEvents.emit('npc:near', { id: null, name: null });
        gameEvents.emit('portal:near', { mapId: null, name: null, label: null });
        gameEvents.on('input:direction', this.onVirtualDirection);
        gameEvents.on('input:interact', this.interact);
        gameEvents.on('world:input-lock', this.onInputLock);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            gameEvents.off('input:direction', this.onVirtualDirection);
            gameEvents.off('input:interact', this.interact);
            gameEvents.off('world:input-lock', this.onInputLock);
        });
        gameEvents.emit('world:ready', undefined);
    }
    update(time) {
        this.player.move(this.cursors, this.wasd);
        this.playerMapMarker.setPosition(this.player.x, this.player.y);
        this.updateNearbyInteractable();
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
    onInputLock = ({ locked }) => {
        if (!this.player)
            return;
        this.player.state = locked ? 'disabled' : 'idle';
        this.player.setVelocity(0);
        this.player.setVirtualDirection(0, 0);
    };
    interact = () => {
        if (this.player.state === 'disabled')
            return;
        if (this.nearbyPortal) {
            gameEvents.emit('portal:interact', {
                mapId: this.nearbyPortal.targetMapId,
                name: this.nearbyPortal.targetMapName,
            });
        }
        else if (this.nearby) {
            gameEvents.emit('npc:interact', { id: this.nearby.npcId });
        }
    };
    updateNearbyInteractable() {
        let nearest = null;
        let nearestPortal = null;
        let distance = this.player.interactionRange;
        for (const npc of this.npcs) {
            const next = Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y);
            if (next < distance) {
                distance = next;
                nearest = npc;
            }
        }
        for (const portal of this.portals) {
            const next = Phaser.Math.Distance.Between(this.player.x, this.player.y, portal.x, portal.y);
            if (next < distance) {
                distance = next;
                nearest = null;
                nearestPortal = portal;
            }
        }
        if (nearest !== this.nearby) {
            this.nearby = nearest;
            gameEvents.emit('npc:near', { id: nearest?.npcId ?? null, name: nearest?.npcName ?? null });
        }
        if (nearestPortal !== this.nearbyPortal) {
            this.nearbyPortal = nearestPortal;
            gameEvents.emit('portal:near', {
                mapId: nearestPortal?.targetMapId ?? null,
                name: nearestPortal?.targetMapName ?? null,
                label: nearestPortal?.label ?? null,
            });
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
        const portalMarkers = this.portals.map((portal) => this.add.circle(portal.x, portal.y, 34, 0x38bdf8).setDepth(99_999));
        this.cameras.main.ignore([this.playerMapMarker, ...npcMarkers, ...portalMarkers]);
    }
    drawWorld(width, height, mapType) {
        const ground = this.add.tileSprite(0, 0, width, height, 'grass-ground').setOrigin(0).setDepth(-10);
        if (mapType === 'forest')
            ground.setTint(0x8bbf8b);
        const path = this.add.tileSprite(0, 0, width, height, 'dirt-path').setOrigin(0).setDepth(-9);
        const routes = [
            new Phaser.Curves.Spline([
                32, 150,
                128, 145,
                320, 195,
                455, 330,
                510, 520,
                515, 675,
                680, 790,
                875, 880,
                1040, 1010,
                1190, 1180,
                1370, 1320,
                1510, 1485,
                1690, 1630,
                1870, 1770,
                2048, 1840,
            ]),
            new Phaser.Curves.Spline([455, 330, 560, 440, 650, 520]),
            new Phaser.Curves.Spline([515, 675, 410, 755, 300, 840]),
            new Phaser.Curves.Spline([680, 790, 800, 800, 920, 800]),
            new Phaser.Curves.Spline([875, 880, 760, 960, 760, 1110]),
            new Phaser.Curves.Spline([1040, 1010, 1080, 1060, 1160, 1120]),
        ];
        const maskShape = this.make.graphics({ x: 0, y: 0 }, false);
        maskShape.fillStyle(0xffffff);
        routes.forEach((route) => route.getSpacedPoints(120).forEach((point) => maskShape.fillCircle(point.x, point.y, 58)));
        path.setMask(maskShape.createGeometryMask());
        if (mapType === 'forest') {
            this.add.rectangle(0, 0, width, height, 0x083d2b, 0.18).setOrigin(0).setDepth(-8);
        }
    }
}
