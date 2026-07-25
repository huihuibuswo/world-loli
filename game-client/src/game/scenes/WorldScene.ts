import Phaser from 'phaser'
import type { MapData, PlayerProfile } from '@/api/types'
import { gameEvents, WORLD_INPUT_LOCK_KEY } from '@/game/events'
import { NPC } from '@/game/entities/NPC'
import { Player } from '@/game/entities/Player'

type MapPortal = {
  x: number
  y: number
  targetMapId: number
  targetMapName: string
  label: string
}

type MapPlant = {
  nodeId: string
  name: string
  rarity: 'common' | 'uncommon' | 'rare'
  x: number
  y: number
  display: Phaser.GameObjects.Container
  minimapMarker?: Phaser.GameObjects.Arc
}

type WorldBounds = { min_x: number; min_y: number; max_x: number; max_y: number }

type ObstacleLayoutItem = {
  x: number
  y: number
  texture: string
  size: number
  body:
    | { shape: 'circle'; radius: number; offsetX: number; offsetY: number }
    | { shape: 'rect'; width: number; height: number; offsetX: number; offsetY: number }
}

type ReservedPlantArea = { x: number; y: number; radius: number }

const PLANT_SPARKLE_COLORS: Record<MapPlant['rarity'], readonly [number, number]> = {
  common: [0xbae6fd, 0xe0f2fe],
  uncommon: [0x93c5fd, 0xa78bfa],
  rare: [0xfde68a, 0xf59e0b],
}

export class WorldScene extends Phaser.Scene {
  private player!: Player
  private npcs: NPC[] = []
  private portals: MapPortal[] = []
  private plants: MapPlant[] = []
  private playerMapMarker!: Phaser.GameObjects.Arc
  private readonly npcMapMarkers = new Map<NPC, Phaser.GameObjects.Arc>()
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>
  private interactKey!: Phaser.Input.Keyboard.Key
  private nearby: NPC | null = null
  private nearbyPortal: MapPortal | null = null
  private nearbyPlant: MapPlant | null = null
  private lastPositionEmit = 0
  private worldInputLocked = false

  constructor() {
    super('WorldScene')
  }

  create(): void {
    const map = this.registry.get('world-map') as MapData
    const profile = this.registry.get('world-player') as PlayerProfile
    const bounds = map.resource.bounds ?? { min_x: 0, min_y: 0, max_x: 2048, max_y: 2048 }
    const width = bounds.max_x - bounds.min_x
    const height = bounds.max_y - bounds.min_y
    this.physics.world.setBounds(bounds.min_x, bounds.min_y, width, height)
    this.cameras.main.setBounds(bounds.min_x, bounds.min_y, width, height)

    this.drawWorld(width, height, map.map_type)
    const obstacles = this.physics.add.staticGroup()
    const obstacleLayout: ObstacleLayoutItem[] = [
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
    ]
    // Body offsets describe the footprint inside the displayed texture; layout x/y is the footprint center.
    const activeObstacleLayout = map.map_type === 'forest'
      ? obstacleLayout.filter(({ texture }) => ['obstacle', 'forest-stump', 'ancient-forest-tree'].includes(texture))
      : obstacleLayout
    activeObstacleLayout.forEach(({ x, y, texture, size, body: bodyConfig }) => {
      const bodyHalfWidth = bodyConfig.shape === 'circle' ? bodyConfig.radius : bodyConfig.width / 2
      const bodyHalfHeight = bodyConfig.shape === 'circle' ? bodyConfig.radius : bodyConfig.height / 2
      const bodyCenterOffsetX = -size / 2 + bodyConfig.offsetX + bodyHalfWidth
      const bodyCenterOffsetY = -size / 2 + bodyConfig.offsetY + bodyHalfHeight
      const visualX = x - bodyCenterOffsetX
      const visualY = y - bodyCenterOffsetY
      const obstacle = obstacles.create(visualX, visualY, texture) as Phaser.Physics.Arcade.Image
      obstacle.setDisplaySize(size, size).setDepth(y).refreshBody()
      const body = obstacle.body as Phaser.Physics.Arcade.StaticBody
      if (bodyConfig.shape === 'circle') {
        body.setCircle(bodyConfig.radius, size / 2 - bodyConfig.radius, size / 2 - bodyConfig.radius)
      } else {
        body.setSize(bodyConfig.width, bodyConfig.height, true)
      }
      // reset() safely reindexes the static body at the footprint center. Restoring the image
      // afterward is intentional: a StaticBody does not follow its Game Object automatically.
      body.reset(x, y)
      obstacle.setPosition(visualX, visualY)
    })

    const avatarGender = profile.avatar_gender === 'male' ? 'male' : 'female'
    this.player = new Player(this, profile.position_x, profile.position_y, avatarGender)
    this.physics.add.collider(this.player, obstacles)
    this.npcs = (map.resource.objects ?? [])
      .filter((item) => item.type === 'npc' && item.template_id)
      .map((item) => new NPC(this, item.x, item.y, item.template_id!, item.template_name ?? '旅人', item.sprite))
    this.npcs.forEach((npc, index) => {
      this.physics.add.collider(this.player, npc)
      this.physics.add.collider(npc, obstacles)
      for (let otherIndex = index + 1; otherIndex < this.npcs.length; otherIndex += 1) {
        this.physics.add.collider(npc, this.npcs[otherIndex])
      }
    })
    this.portals = (map.resource.objects ?? []).flatMap((item) => {
      if (item.type !== 'map_portal' || !item.target_map_id || !item.target_map_name) return []
      return [{
        x: item.x,
        y: item.y,
        targetMapId: item.target_map_id,
        targetMapName: item.target_map_name,
        label: item.label || `前往${item.target_map_name}`,
      }]
    })
    this.portals.forEach((portal) => {
      this.add.circle(portal.x, portal.y, 54, 0x38bdf8, 0.16)
        .setStrokeStyle(3, 0x7dd3fc, 0.82)
        .setDepth(portal.y - 2)
      this.add.image(portal.x, portal.y - 18, 'village-signpost')
        .setDisplaySize(92, 92)
        .setDepth(portal.y)
      this.add.text(portal.x, portal.y + 46, portal.label, {
        fontFamily: 'ui-rounded, sans-serif',
        fontSize: '14px',
        color: '#e0f2fe',
        backgroundColor: 'rgba(3, 22, 32, 0.82)',
        padding: { x: 9, y: 5 },
      }).setOrigin(0.5).setDepth(portal.y + 1)
    })
    const reservedPlantAreas: ReservedPlantArea[] = [
      ...this.npcs.map((npc) => ({ x: npc.x, y: npc.y, radius: 86 })),
      ...this.portals.map((portal) => ({ x: portal.x, y: portal.y, radius: 112 })),
    ]
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    this.plants = (map.resource.objects ?? []).flatMap((item) => {
      if (
        item.type !== 'collectible_plant'
        || !item.node_id
        || !item.name
      ) return []
      const rarity: MapPlant['rarity'] = item.rarity === 'rare' || item.rarity === 'uncommon'
        ? item.rarity
        : 'common'
      const spriteSize = { common: 88, uncommon: 98, rare: 110 }[rarity]
      const position = this.resolveVisiblePlantPosition(
        item.x,
        item.y,
        spriteSize,
        bounds,
        activeObstacleLayout,
        reservedPlantAreas,
      )
      reservedPlantAreas.push({ x: position.x, y: position.y, radius: spriteSize / 2 + 24 })
      const display = this.add.container(position.x, position.y).setDepth(position.y)
      const textureKey = item.icon
        ?.split('/')
        .pop()
        ?.replace(/-cutout\.png$/, '')
      const sprite = this.add.image(
        0,
        0,
        textureKey && this.textures.exists(textureKey) ? textureKey : 'plant-morning-dew-grass',
      ).setDisplaySize(spriteSize, spriteSize).setOrigin(0.5, 0.86)
      const sparkleSpecs = [
        { x: -29, y: -57, inner: 1.8, outer: 5.8, alpha: 0.92, duration: 760, delay: 0 },
        { x: 24, y: -49, inner: 1.5, outer: 4.7, alpha: 0.78, duration: 980, delay: 170 },
        { x: -9, y: -31, inner: 1.2, outer: 3.8, alpha: 0.72, duration: 830, delay: 390 },
        { x: 33, y: -19, inner: 1.6, outer: 5.1, alpha: 0.86, duration: 1_070, delay: 90 },
        { x: -35, y: -13, inner: 1.1, outer: 3.4, alpha: 0.68, duration: 910, delay: 510 },
        { x: 8, y: -70, inner: 1.3, outer: 4.1, alpha: 0.82, duration: 690, delay: 280 },
      ]
      const sparkleColors = PLANT_SPARKLE_COLORS[rarity]
      const sparkles = sparkleSpecs.map((spec, index) => {
        const sparkle = this.add.star(
          spec.x,
          spec.y,
          4,
          spec.inner,
          spec.outer,
          sparkleColors[index % sparkleColors.length],
          spec.alpha,
        ).setAngle(45)

        if (!prefersReducedMotion) {
          this.tweens.add({
            targets: sparkle,
            alpha: { from: 0.18, to: spec.alpha },
            scale: { from: 0.58, to: 1.16 },
            duration: spec.duration,
            delay: spec.delay,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1,
          })
        }

        return sparkle
      })
      display.add([sprite, ...sparkles])
      const plant: MapPlant = {
        nodeId: item.node_id,
        name: item.name,
        rarity,
        x: position.x,
        y: position.y,
        display,
      }
      if (item.available === false) {
        display.setVisible(false).setActive(false)
        const delay = item.available_at ? Math.max(0, Date.parse(item.available_at) - Date.now()) : 0
        this.time.delayedCall(delay, () => {
          display.setVisible(true).setActive(true)
          if (plant.minimapMarker && rarity === 'rare') plant.minimapMarker.setVisible(true)
        })
      }
      return [plant]
    })

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1)
    this.cameras.main.setZoom(1.08)
    this.createMinimap(bounds.min_x, bounds.min_y, width, height)
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.wasd = this.input.keyboard!.addKeys('W,S,A,D') as Record<string, Phaser.Input.Keyboard.Key>
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E)
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    gameEvents.emit('npc:near', { id: null, name: null })
    gameEvents.emit('portal:near', { mapId: null, name: null, label: null })
    gameEvents.emit('plant:near', { nodeId: null, name: null, rarity: null })

    gameEvents.on('input:direction', this.onVirtualDirection)
    gameEvents.on('input:interact', this.interact)
    gameEvents.on('world:input-lock', this.onInputLock)
    gameEvents.on('plant:collected', this.onPlantCollected)
    this.onInputLock({ locked: this.registry.get(WORLD_INPUT_LOCK_KEY) === true })
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      gameEvents.off('input:direction', this.onVirtualDirection)
      gameEvents.off('input:interact', this.interact)
      gameEvents.off('world:input-lock', this.onInputLock)
      gameEvents.off('plant:collected', this.onPlantCollected)
      this.npcMapMarkers.clear()
    })
  }

  update(time: number): void {
    this.player.move(this.cursors, this.wasd)
    this.playerMapMarker.setPosition(this.player.x, this.player.y)
    this.npcs.forEach((npc) => {
      const playerIsNear = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        npc.x,
        npc.y,
      ) <= this.player.interactionRange
      npc.updateWander(time, this.worldInputLocked || playerIsNear)
      this.npcMapMarkers.get(npc)?.setPosition(npc.x, npc.y)
    })
    this.plants.forEach((plant) => {
      if (plant.rarity === 'uncommon' && plant.minimapMarker) {
        plant.minimapMarker.setVisible(
          Phaser.Math.Distance.Between(this.player.x, this.player.y, plant.x, plant.y) < 420,
        )
      }
    })
    this.updateNearbyInteractable()
    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) this.interact()
    if (time - this.lastPositionEmit > 600 && this.player.body?.velocity.lengthSq()) {
      this.lastPositionEmit = time
      gameEvents.emit('player:moved', { x: this.player.x, y: this.player.y })
    }
  }

  private readonly onVirtualDirection = ({ x, y }: { x: number; y: number }): void => {
    this.player?.setVirtualDirection(x, y)
  }

  private readonly onInputLock = ({ locked }: { locked: boolean }): void => {
    this.worldInputLocked = locked
    if (!this.player) return
    this.player.state = locked ? 'disabled' : 'idle'
    this.player.setVelocity(0)
    this.player.setVirtualDirection(0, 0)
  }

  private readonly interact = (): void => {
    if (this.player.state === 'disabled') return
    if (this.nearbyPlant) {
      gameEvents.emit('plant:interact', {
        nodeId: this.nearbyPlant.nodeId,
        name: this.nearbyPlant.name,
      })
    } else if (this.nearbyPortal) {
      gameEvents.emit('portal:interact', {
        mapId: this.nearbyPortal.targetMapId,
        name: this.nearbyPortal.targetMapName,
      })
    } else if (this.nearby) {
      gameEvents.emit('npc:interact', { id: this.nearby.npcId })
    }
  }

  private readonly onPlantCollected = ({ nodeId, availableAt }: { nodeId: string; availableAt: string }): void => {
    const plant = this.plants.find((item) => item.nodeId === nodeId)
    if (!plant) return
    plant.display.setVisible(false).setActive(false)
    plant.minimapMarker?.setVisible(false).setActive(false)
    if (this.nearbyPlant === plant) {
      this.nearbyPlant = null
      gameEvents.emit('plant:near', { nodeId: null, name: null, rarity: null })
    }
    this.time.delayedCall(Math.max(0, Date.parse(availableAt) - Date.now()), () => {
      plant.display.setVisible(true).setActive(true)
      if (plant.minimapMarker && plant.rarity === 'rare') plant.minimapMarker.setVisible(true)
    })
  }

  private updateNearbyInteractable(): void {
    let nearest: NPC | null = null
    let nearestPortal: MapPortal | null = null
    let nearestPlant: MapPlant | null = null
    let distance = this.player.interactionRange
    for (const npc of this.npcs) {
      const next = Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y)
      if (next < distance) {
        distance = next
        nearest = npc
      }
    }
    for (const portal of this.portals) {
      const next = Phaser.Math.Distance.Between(this.player.x, this.player.y, portal.x, portal.y)
      if (next < distance) {
        distance = next
        nearest = null
        nearestPortal = portal
      }
    }
    for (const plant of this.plants) {
      if (!plant.display.active) continue
      const next = Phaser.Math.Distance.Between(this.player.x, this.player.y, plant.x, plant.y)
      if (next < distance) {
        distance = next
        nearest = null
        nearestPortal = null
        nearestPlant = plant
      }
    }
    if (nearest !== this.nearby) {
      this.nearby = nearest
      gameEvents.emit('npc:near', { id: nearest?.npcId ?? null, name: nearest?.npcName ?? null })
    }
    if (nearestPortal !== this.nearbyPortal) {
      this.nearbyPortal = nearestPortal
      gameEvents.emit('portal:near', {
        mapId: nearestPortal?.targetMapId ?? null,
        name: nearestPortal?.targetMapName ?? null,
        label: nearestPortal?.label ?? null,
      })
    }
    if (nearestPlant !== this.nearbyPlant) {
      this.nearbyPlant = nearestPlant
      gameEvents.emit('plant:near', {
        nodeId: nearestPlant?.nodeId ?? null,
        name: nearestPlant?.name ?? null,
        rarity: nearestPlant?.rarity ?? null,
      })
    }
  }

  private createMinimap(minX: number, minY: number, width: number, height: number): void {
    const viewport = { x: 1110, y: 82, width: 150, height: 150 }
    const minimap = this.cameras
      .add(viewport.x, viewport.y, viewport.width, viewport.height)
      .setName('world-minimap')
      .setBounds(minX, minY, width, height)
      .setBackgroundColor('rgba(0, 0, 0, 0)')
      .setRoundPixels(true)
    minimap.setZoom(Math.min(viewport.width / width, viewport.height / height) * 0.94)
    minimap.centerOn(minX + width / 2, minY + height / 2)

    this.playerMapMarker = this.add
      .circle(this.player.x, this.player.y, 38, 0xfef3c7)
      .setStrokeStyle(9, 0x15803d)
      .setDepth(100_000)
    const npcMarkers = this.npcs.map((npc) => {
      const marker = this.add.circle(npc.x, npc.y, 30, 0xf59e0b).setDepth(99_999)
      this.npcMapMarkers.set(npc, marker)
      return marker
    })
    const portalMarkers = this.portals.map((portal) =>
      this.add.circle(portal.x, portal.y, 34, 0x38bdf8).setDepth(99_999),
    )
    const plantMarkers = this.plants.flatMap((plant) => {
      if (plant.rarity === 'common') return []
      const color = plant.rarity === 'rare' ? 0xfbbf24 : 0x60a5fa
      const marker = this.add.circle(plant.x, plant.y, 24, color).setDepth(99_999)
      marker.setVisible(plant.rarity === 'rare')
      plant.minimapMarker = marker
      return [marker]
    })
    this.cameras.main.ignore([this.playerMapMarker, ...npcMarkers, ...portalMarkers, ...plantMarkers])
  }

  private resolveVisiblePlantPosition(
    requestedX: number,
    requestedY: number,
    spriteSize: number,
    bounds: WorldBounds,
    obstacles: ObstacleLayoutItem[],
    reservedAreas: ReservedPlantArea[],
  ): { x: number; y: number } {
    const candidates = [{ x: requestedX, y: requestedY }]
    for (let radius = 56; radius <= 448; radius += 56) {
      for (let index = 0; index < 16; index += 1) {
        const angle = index * Math.PI / 8
        candidates.push({
          x: Math.round(requestedX + Math.cos(angle) * radius),
          y: Math.round(requestedY + Math.sin(angle) * radius),
        })
      }
    }
    const resolved = candidates.find((candidate) => this.isPlantPositionVisible(
      candidate.x,
      candidate.y,
      spriteSize,
      bounds,
      obstacles,
      reservedAreas,
    ))
    if (resolved && (resolved.x !== requestedX || resolved.y !== requestedY)) {
      console.warn(
        `[WorldScene] Plant node at (${requestedX}, ${requestedY}) was moved to (${resolved.x}, ${resolved.y}) to avoid occlusion.`,
      )
    }
    return resolved ?? { x: requestedX, y: requestedY }
  }

  private isPlantPositionVisible(
    x: number,
    y: number,
    spriteSize: number,
    bounds: WorldBounds,
    obstacles: ObstacleLayoutItem[],
    reservedAreas: ReservedPlantArea[],
  ): boolean {
    const horizontalRadius = spriteSize * 0.42
    const plantBounds = {
      left: x - horizontalRadius,
      right: x + horizontalRadius,
      top: y - spriteSize * 0.86,
      bottom: y + spriteSize * 0.14,
    }
    const edgeMargin = 20
    if (
      plantBounds.left < bounds.min_x + edgeMargin
      || plantBounds.right > bounds.max_x - edgeMargin
      || plantBounds.top < bounds.min_y + edgeMargin
      || plantBounds.bottom > bounds.max_y - edgeMargin
    ) return false
    if (reservedAreas.some((area) =>
      Phaser.Math.Distance.Between(x, y, area.x, area.y) < area.radius + horizontalRadius,
    )) return false

    return !obstacles.some((obstacle) => {
      if (y > obstacle.y) return false
      const bodyHalfWidth = obstacle.body.shape === 'circle'
        ? obstacle.body.radius
        : obstacle.body.width / 2
      const bodyHalfHeight = obstacle.body.shape === 'circle'
        ? obstacle.body.radius
        : obstacle.body.height / 2
      const visualX = obstacle.x - (-obstacle.size / 2 + obstacle.body.offsetX + bodyHalfWidth)
      const visualY = obstacle.y - (-obstacle.size / 2 + obstacle.body.offsetY + bodyHalfHeight)
      const halfSize = obstacle.size / 2
      return (
        plantBounds.left < visualX + halfSize
        && plantBounds.right > visualX - halfSize
        && plantBounds.top < visualY + halfSize
        && plantBounds.bottom > visualY - halfSize
      )
    })
  }

  private drawWorld(width: number, height: number, mapType: string): void {
    const ground = this.add.tileSprite(0, 0, width, height, 'grass-ground').setOrigin(0).setDepth(-10)
    if (mapType === 'forest') ground.setTint(0x8bbf8b)
    const path = this.add.tileSprite(0, 0, width, height, 'dirt-path').setOrigin(0).setDepth(-9)
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
    ]
    const maskShape = this.make.graphics({ x: 0, y: 0 }, false)
    maskShape.fillStyle(0xffffff)
    routes.forEach((route) =>
      route.getSpacedPoints(120).forEach((point) => maskShape.fillCircle(point.x, point.y, 58)),
    )
    path.setMask(maskShape.createGeometryMask())
    if (mapType === 'forest') {
      this.add.rectangle(0, 0, width, height, 0x083d2b, 0.18).setOrigin(0).setDepth(-8)
    }
  }
}
