import Phaser from 'phaser'
import type { MapData, PlayerProfile } from '@/api/types'
import { GAME_HEIGHT, GAME_WIDTH } from '@/game/config/GameConfig'
import { GAME_TIME_KEY, gameEvents, WORLD_INPUT_LOCK_KEY } from '@/game/events'
import { NPC } from '@/game/entities/NPC'
import { Player } from '@/game/entities/Player'
import { resolveMinimapLayout } from '@/game/minimapLayout'
import {
  getForestRegionConfig,
  isForestVisualVisibleOnMinimap,
  resolveForestVisualDepth,
  validateForestRegionConfig,
  type ForestCollider,
  type ForestEffect,
  type ForestForeground,
  type ForestObstacleLayoutItem,
  type ForestProp,
  type ForestRegionConfig,
  type ForestWaterway,
} from '@/game/forestRegions'
import {
  getEnvironmentStyle,
  isMinuteInRange,
  normalizeGameTime,
  type GameTimeState,
} from '@/game/time'

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

type MapEvidence = {
  evidenceId: string
  name: string
  x: number
  y: number
  display: Phaser.GameObjects.Container
  minimapMarker?: Phaser.GameObjects.Arc
}

type WorldBounds = { min_x: number; min_y: number; max_x: number; max_y: number }

type ObstacleLayoutItem = ForestObstacleLayoutItem

type ReservedPlantArea = { x: number; y: number; radius: number }
type NpcSchedule = { availableFrom?: number; availableUntil?: number; critical: boolean }
type ForestForegroundRuntime = {
  object: Phaser.GameObjects.Image
  baseAlpha: number
  fadeRadius: number
  fadedAlpha: number
}

const PLANT_SPARKLE_COLORS: Record<MapPlant['rarity'], readonly [number, number]> = {
  common: [0xbae6fd, 0xe0f2fe],
  uncommon: [0x93c5fd, 0xa78bfa],
  rare: [0xfde68a, 0xf59e0b],
}

const VILLAGE_OBSTACLE_LAYOUT: ObstacleLayoutItem[] = [
  // House textures contain transparent padding below the visible pixels. These offsets
  // align each footprint with the actual alpha bounds instead of the 512px canvas edge.
  { x: 690, y: 430, texture: 'village-chief-house', size: 420, body: { shape: 'rect', width: 330, height: 110, offsetX: 45, offsetY: 246 } },
  { x: 1110, y: 720, texture: 'village-general-store', size: 330, body: { shape: 'rect', width: 240, height: 92, offsetX: 45, offsetY: 181 } },
  { x: 390, y: 760, texture: 'village-smithy', size: 350, body: { shape: 'rect', width: 300, height: 110, offsetX: 26, offsetY: 198 } },
  { x: 820, y: 1110, texture: 'village-inn', size: 320, body: { shape: 'rect', width: 240, height: 96, offsetX: 40, offsetY: 190 } },
  { x: 430, y: 1160, texture: 'village-cottage-a', size: 280, body: { shape: 'rect', width: 220, height: 88, offsetX: 31, offsetY: 145 } },
  { x: 1210, y: 1030, texture: 'village-cottage-b', size: 300, body: { shape: 'rect', width: 250, height: 90, offsetX: 26, offsetY: 148 } },
  { x: 790, y: 790, texture: 'village-well', size: 150, body: { shape: 'circle', radius: 42, offsetX: 33, offsetY: 80 } },
  { x: 1220, y: 815, texture: 'village-cart-supplies', size: 150, body: { shape: 'rect', width: 100, height: 42, offsetX: 25, offsetY: 99 } },
  { x: 1410, y: 970, texture: 'village-fence-segment', size: 120, displayHeight: 60, body: { shape: 'rect', width: 104, height: 18, offsetX: 8, offsetY: 35 } },
  { x: 1410, y: 1140, texture: 'village-fence-segment', size: 120, displayHeight: 60, body: { shape: 'rect', width: 104, height: 18, offsetX: 8, offsetY: 35 } },
  { x: 1400, y: 330, texture: 'ancient-forest-tree', size: 320, body: { shape: 'rect', width: 100, height: 60, offsetX: 110, offsetY: 238 } },
  { x: 1760, y: 620, texture: 'ancient-forest-tree', size: 320, body: { shape: 'rect', width: 100, height: 60, offsetX: 110, offsetY: 238 } },
  { x: 1900, y: 1030, texture: 'ancient-forest-tree', size: 320, body: { shape: 'rect', width: 100, height: 60, offsetX: 110, offsetY: 238 } },
  { x: 1840, y: 1510, texture: 'ancient-forest-tree', size: 320, body: { shape: 'rect', width: 100, height: 60, offsetX: 110, offsetY: 238 } },
  { x: 1500, y: 1870, texture: 'ancient-forest-tree', size: 320, body: { shape: 'rect', width: 100, height: 60, offsetX: 110, offsetY: 238 } },
  { x: 950, y: 1880, texture: 'ancient-forest-tree', size: 320, body: { shape: 'rect', width: 100, height: 60, offsetX: 110, offsetY: 238 } },
  { x: 240, y: 1580, texture: 'ancient-forest-tree', size: 320, body: { shape: 'rect', width: 100, height: 60, offsetX: 110, offsetY: 238 } },
]

export class WorldScene extends Phaser.Scene {
  private player!: Player
  private npcs: NPC[] = []
  private portals: MapPortal[] = []
  private plants: MapPlant[] = []
  private evidenceNodes: MapEvidence[] = []
  private playerMapMarker!: Phaser.GameObjects.Arc
  private readonly npcMapMarkers = new Map<NPC, Phaser.GameObjects.Arc>()
  private readonly npcSchedules = new Map<NPC, NpcSchedule>()
  private environmentOverlay!: Phaser.GameObjects.Rectangle
  private environmentLights: Phaser.GameObjects.Arc[] = []
  private environmentObjects: Phaser.GameObjects.GameObject[] = []
  private minimapHiddenObjects: Phaser.GameObjects.GameObject[] = []
  private forestWaterwayMasks: Array<{
    mask: Phaser.Display.Masks.GeometryMask
    shape: Phaser.GameObjects.Graphics
    texture: Phaser.GameObjects.TileSprite
  }> = []
  private forestForegroundObjects: ForestForegroundRuntime[] = []
  private mapType = 'village'
  private forestRegion: ForestRegionConfig | null = null
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>
  private interactKey!: Phaser.Input.Keyboard.Key
  private nearby: NPC | null = null
  private nearbyPortal: MapPortal | null = null
  private nearbyPlant: MapPlant | null = null
  private nearbyEvidence: MapEvidence | null = null
  private lastPositionEmit = 0
  private worldInputLocked = false
  private discardNextDelta = true

  constructor() {
    super('WorldScene')
  }

  create(): void {
    this.nearby = null
    this.nearbyPortal = null
    this.nearbyPlant = null
    this.nearbyEvidence = null
    this.lastPositionEmit = 0
    this.npcMapMarkers.clear()
    this.npcSchedules.clear()
    this.environmentLights = []
    this.environmentObjects = []
    this.minimapHiddenObjects = []
    this.forestWaterwayMasks = []
    this.forestForegroundObjects = []
    this.discardNextDelta = true
    const map = this.registry.get('world-map') as MapData
    const profile = this.registry.get('world-player') as PlayerProfile
    this.mapType = map.map_type
    this.forestRegion = map.map_type === 'forest'
      ? getForestRegionConfig(map.resource.region_key)
      : null
    if (import.meta.env.DEV && this.forestRegion) {
      const problems = validateForestRegionConfig(this.forestRegion)
      if (problems.length > 0) throw new Error(`Invalid forest region layout:\n${problems.join('\n')}`)
    }
    const bounds = map.resource.bounds ?? { min_x: 0, min_y: 0, max_x: 2048, max_y: 2048 }
    const width = bounds.max_x - bounds.min_x
    const height = bounds.max_y - bounds.min_y
    this.physics.world.setBounds(bounds.min_x, bounds.min_y, width, height)
    this.cameras.main.setBounds(bounds.min_x, bounds.min_y, width, height)

    this.drawWorld(width, height, map.map_type, this.forestRegion)
    this.createEnvironmentEffects(map.map_type)
    const obstacles = this.physics.add.staticGroup()
    const activeObstacleLayout = map.map_type === 'forest' && this.forestRegion
      ? this.forestRegion.obstacles
      : VILLAGE_OBSTACLE_LAYOUT
    if (this.forestRegion) this.createForestColliders(obstacles, this.forestRegion.colliders)
    else this.createLegacyObstacles(obstacles, activeObstacleLayout)
    const avatarGender = profile.avatar_gender === 'male' ? 'male' : 'female'
    this.player = new Player(this, profile.position_x, profile.position_y, avatarGender)
    this.physics.add.collider(this.player, obstacles)
    this.npcs = (map.resource.objects ?? [])
      .filter((item) => item.type === 'npc' && item.template_id)
      .map((item) => {
        const npc = new NPC(
          this,
          item.x,
          item.y,
          item.template_id!,
          item.template_name ?? '旅人',
          item.sprite,
          item.stationary === true,
          item.tint,
        )
        this.npcSchedules.set(npc, {
          availableFrom: item.available_from,
          availableUntil: item.available_until,
          critical: item.schedule_critical === true || Boolean(item.story_gate),
        })
        return npc
      })
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
      const markerTexture = map.map_type === 'forest'
        ? this.forestPortalTexture(portal, width)
        : 'village-signpost'
      const markerSize = map.map_type === 'forest' ? 132 : 92
      this.add.circle(portal.x, portal.y, 54, 0x38bdf8, 0.16)
        .setStrokeStyle(3, 0x7dd3fc, 0.82)
        .setDepth(portal.y - 2)
      this.add.image(portal.x, portal.y - (map.map_type === 'forest' ? 38 : 18), markerTexture)
        .setDisplaySize(markerSize, markerSize)
        .setDepth(portal.y)
      this.add.text(portal.x, portal.y + 46, portal.label, {
        fontFamily: 'ui-rounded, sans-serif',
        fontSize: '14px',
        color: '#e0f2fe',
        backgroundColor: 'rgba(3, 22, 32, 0.82)',
        padding: { x: 9, y: 5 },
      }).setOrigin(0.5).setDepth(90_002)
    })
    this.evidenceNodes = (map.resource.objects ?? []).flatMap((item) => {
      if (item.type !== 'story_evidence' || !item.evidence_id || !item.name) return []
      const display = this.add.container(item.x, item.y).setDepth(item.y)
      const glow = this.add.circle(0, 0, 36, 0x93c5fd, 0.2)
        .setStrokeStyle(2, 0xc4b5fd, 0.8)
      const evidenceTexture = {
        moonlight_flora: 'plant-moonlight-lily',
        broken_wolf_tracks: 'forest-wolf-tracks-broken',
        broken_moon_mist_core: 'forest-broken-moon-mist-core',
      }[item.evidence_id]
      const sigil = evidenceTexture
        ? this.add.image(0, -8, evidenceTexture).setDisplaySize(
            item.evidence_id === 'broken_wolf_tracks' ? 112 : 82,
            item.evidence_id === 'broken_wolf_tracks' ? 78 : 82,
          )
        : this.add.star(0, -5, 6, 9, 22, 0xe0e7ff, 0.92).setAngle(30)
      const label = this.add.text(0, 42, item.name, {
        fontFamily: 'ui-rounded, sans-serif',
        fontSize: '14px',
        color: '#eef2ff',
        backgroundColor: 'rgba(20, 18, 48, 0.88)',
        padding: { x: 8, y: 5 },
      }).setOrigin(0.5)
      display.add([glow, sigil, label])
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.tweens.add({
          targets: [glow, sigil],
          alpha: { from: 0.45, to: 1 },
          scale: { from: 0.92, to: 1.08 },
          duration: 1_200,
          ease: 'Sine.easeInOut',
          yoyo: true,
          repeat: -1,
        })
      }
      return [{
        evidenceId: item.evidence_id,
        name: item.name,
        x: item.x,
        y: item.y,
        display,
      }]
    })
    const reservedPlantAreas: ReservedPlantArea[] = [
      ...this.npcs.map((npc) => ({ x: npc.x, y: npc.y, radius: 86 })),
      ...this.portals.map((portal) => ({ x: portal.x, y: portal.y, radius: 112 })),
      ...this.evidenceNodes.map((evidence) => ({ x: evidence.x, y: evidence.y, radius: 72 })),
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
    gameEvents.emit('evidence:near', { evidenceId: null, name: null })

    gameEvents.on('input:direction', this.onVirtualDirection)
    gameEvents.on('input:interact', this.interact)
    gameEvents.on('world:input-lock', this.onInputLock)
    gameEvents.on('time:changed', this.onTimeChanged)
    gameEvents.on('plant:collected', this.onPlantCollected)
    this.onInputLock({ locked: this.registry.get(WORLD_INPUT_LOCK_KEY) === true })
    this.applyGameTime(this.registry.get(GAME_TIME_KEY) as GameTimeState | undefined)
    const cleanupEvents = (): void => {
      gameEvents.off('input:direction', this.onVirtualDirection)
      gameEvents.off('input:interact', this.interact)
      gameEvents.off('world:input-lock', this.onInputLock)
      gameEvents.off('time:changed', this.onTimeChanged)
      gameEvents.off('plant:collected', this.onPlantCollected)
      this.forestWaterwayMasks.forEach(({ mask, shape, texture }) => {
        if (texture.mask === mask) texture.clearMask()
        mask.destroy()
        shape.destroy()
      })
      this.forestWaterwayMasks = []
      this.npcMapMarkers.clear()
      this.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanupEvents)
      this.events.off(Phaser.Scenes.Events.DESTROY, cleanupEvents)
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanupEvents)
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanupEvents)
  }

  update(time: number, delta: number): void {
    if (this.discardNextDelta) {
      this.discardNextDelta = false
    } else if (!this.worldInputLocked) {
      gameEvents.emit('time:advance', { elapsedMs: delta })
    }
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
      this.npcMapMarkers.get(npc)?.setPosition(npc.x, npc.y).setVisible(npc.active)
    })
    this.plants.forEach((plant) => {
      if (plant.rarity === 'uncommon' && plant.minimapMarker) {
        plant.minimapMarker.setVisible(
          Phaser.Math.Distance.Between(this.player.x, this.player.y, plant.x, plant.y) < 420,
        )
      }
    })
    this.updateForestForegrounds()
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
    if (this.worldInputLocked && !locked) this.discardNextDelta = true
    this.worldInputLocked = locked
    if (locked) {
      this.npcs.forEach((npc) => {
        if (npc.active && npc.body) npc.updateWander(this.time.now, true)
      })
    }
    if (!this.player?.body) return
    this.player.state = locked ? 'disabled' : 'idle'
    this.player.setVelocity(0)
    this.player.setVirtualDirection(0, 0)
  }

  private readonly onTimeChanged = (gameTime: GameTimeState): void => {
    this.applyGameTime(gameTime)
  }

  private applyGameTime(gameTime?: GameTimeState): void {
    const normalized = normalizeGameTime(gameTime?.dayIndex, gameTime?.minuteOfDay)
    const style = getEnvironmentStyle(this.mapType, normalized.minuteOfDay)
    this.environmentOverlay.setFillStyle(style.color, 1).setAlpha(style.alpha)
    this.environmentLights.forEach((light) => {
      light.setAlpha(style.lightAlpha).setVisible(style.lightAlpha > 0.01)
    })
    this.npcs.forEach((npc) => {
      const schedule = this.npcSchedules.get(npc)
      const scheduled = schedule?.availableFrom !== undefined && schedule.availableUntil !== undefined
      const available = !scheduled
        || schedule.critical
        || isMinuteInRange(normalized.minuteOfDay, schedule.availableFrom!, schedule.availableUntil!)
      npc.setScheduleAvailable(available)
      this.npcMapMarkers.get(npc)?.setVisible(available)
      if (!available && this.nearby === npc) {
        this.nearby = null
        gameEvents.emit('npc:near', { id: null, name: null })
      }
    })
  }

  private readonly interact = (): void => {
    if (this.player.state === 'disabled') return
    if (this.nearbyPlant) {
      gameEvents.emit('plant:interact', {
        nodeId: this.nearbyPlant.nodeId,
        name: this.nearbyPlant.name,
      })
    } else if (this.nearbyEvidence) {
      gameEvents.emit('evidence:interact', {
        evidenceId: this.nearbyEvidence.evidenceId,
        name: this.nearbyEvidence.name,
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
    let nearestEvidence: MapEvidence | null = null
    let distance = this.player.interactionRange
    for (const npc of this.npcs) {
      if (!npc.active) continue
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
    for (const evidence of this.evidenceNodes) {
      const next = Phaser.Math.Distance.Between(this.player.x, this.player.y, evidence.x, evidence.y)
      if (next < distance) {
        distance = next
        nearest = null
        nearestPortal = null
        nearestPlant = null
        nearestEvidence = evidence
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
    if (nearestEvidence !== this.nearbyEvidence) {
      this.nearbyEvidence = nearestEvidence
      gameEvents.emit('evidence:near', {
        evidenceId: nearestEvidence?.evidenceId ?? null,
        name: nearestEvidence?.name ?? null,
      })
    }
  }

  private createMinimap(minX: number, minY: number, width: number, height: number): void {
    const minimap = this.cameras
      .add(0, 0, 150, 150)
      .setName('world-minimap')
      .setBounds(minX, minY, width, height)
      .setBackgroundColor('rgba(3, 14, 11, 0.96)')
      .setRoundPixels(true)
      .setVisible(false)

    const layoutMinimap = (): boolean => {
      const canvasRect = this.game.canvas.getBoundingClientRect()
      const scaleX = canvasRect.width / GAME_WIDTH
      const scaleY = canvasRect.height / GAME_HEIGHT
      if (canvasRect.width <= 0 || canvasRect.height <= 0 || Math.abs(scaleX - scaleY) > 0.01) return false
      const layout = resolveMinimapLayout({
        canvasLeft: canvasRect.left,
        canvasTop: canvasRect.top,
        canvasWidth: canvasRect.width,
        canvasHeight: canvasRect.height,
        viewportWidth: window.innerWidth,
        gameWidth: GAME_WIDTH,
        gameHeight: GAME_HEIGHT,
        compact: window.innerWidth <= 640,
      })
      minimap.setViewport(layout.cameraX, layout.cameraY, layout.cameraWidth, layout.cameraHeight)
      minimap.setZoom(Math.min(layout.cameraWidth / width, layout.cameraHeight / height))
      minimap.setVisible(true)
      return true
    }
    let layoutFrame: number | null = null
    let stopped = false
    const scheduleMinimapLayout = () => {
      if (layoutFrame !== null) window.cancelAnimationFrame(layoutFrame)
      layoutFrame = window.requestAnimationFrame(() => {
        layoutFrame = window.requestAnimationFrame(() => {
          layoutFrame = null
          if (!stopped && !layoutMinimap()) scheduleMinimapLayout()
        })
      })
    }
    scheduleMinimapLayout()
    this.scale.on(Phaser.Scale.Events.RESIZE, scheduleMinimapLayout)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      stopped = true
      if (layoutFrame !== null) window.cancelAnimationFrame(layoutFrame)
      this.scale.off(Phaser.Scale.Events.RESIZE, scheduleMinimapLayout)
    })
    minimap.centerOn(minX + width / 2, minY + height / 2)
    minimap.ignore(this.minimapHiddenObjects)

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
    const evidenceMarkers = this.evidenceNodes.map((evidence) => {
      const marker = this.add.circle(evidence.x, evidence.y, 26, 0xa78bfa).setDepth(99_999)
      evidence.minimapMarker = marker
      return marker
    })
    this.cameras.main.ignore([
      this.playerMapMarker,
      ...npcMarkers,
      ...portalMarkers,
      ...plantMarkers,
      ...evidenceMarkers,
    ])
  }

  private createEnvironmentEffects(mapType: string): void {
    this.environmentOverlay = this.add
      .rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0xffffff)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(90_000)
      .setInteractive({ useHandCursor: false })
      .disableInteractive()
    this.environmentObjects.push(this.environmentOverlay)
    this.minimapHiddenObjects.push(this.environmentOverlay)
    if (mapType !== 'village') return
    const lightAnchors = [
      { x: 790, y: 790, radius: 105 },
      { x: 1110, y: 760, radius: 92 },
      { x: 820, y: 1080, radius: 86 },
      { x: 390, y: 820, radius: 76 },
    ]
    this.environmentLights = lightAnchors.map(({ x, y, radius }) => this.add
      .circle(x, y, radius, 0xfbbf24, 0.18)
      .setDepth(90_001)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false))
    this.environmentObjects.push(...this.environmentLights)
    this.minimapHiddenObjects.push(...this.environmentLights)
  }

  private createLegacyObstacles(
    group: Phaser.Physics.Arcade.StaticGroup,
    layouts: ObstacleLayoutItem[],
  ): void {
    // Body offsets describe the footprint inside the displayed texture; layout x/y is the footprint center.
    layouts.forEach(({ x, y, texture, size, displayHeight = size, angle = 0, body: bodyConfig }) => {
      const bodyHalfWidth = bodyConfig.shape === 'circle' ? bodyConfig.radius : bodyConfig.width / 2
      const bodyHalfHeight = bodyConfig.shape === 'circle' ? bodyConfig.radius : bodyConfig.height / 2
      const bodyCenterOffsetX = -size / 2 + bodyConfig.offsetX + bodyHalfWidth
      const bodyCenterOffsetY = -displayHeight / 2 + bodyConfig.offsetY + bodyHalfHeight
      const angleRadians = Phaser.Math.DegToRad(angle)
      const rotatedBodyCenterOffsetX = bodyCenterOffsetX * Math.cos(angleRadians) - bodyCenterOffsetY * Math.sin(angleRadians)
      const rotatedBodyCenterOffsetY = bodyCenterOffsetX * Math.sin(angleRadians) + bodyCenterOffsetY * Math.cos(angleRadians)
      const visualX = x - rotatedBodyCenterOffsetX
      const visualY = y - rotatedBodyCenterOffsetY
      const obstacle = group.create(visualX, visualY, texture) as Phaser.Physics.Arcade.Image
      obstacle.setDisplaySize(size, displayHeight).setAngle(angle).setDepth(y).refreshBody()
      const body = obstacle.body as Phaser.Physics.Arcade.StaticBody
      if (bodyConfig.shape === 'circle') {
        body.setCircle(bodyConfig.radius, size / 2 - bodyConfig.radius, displayHeight / 2 - bodyConfig.radius)
      } else {
        const swapsAxes = Math.abs(Math.round(angle / 90)) % 2 === 1
        body.setSize(
          swapsAxes ? bodyConfig.height : bodyConfig.width,
          swapsAxes ? bodyConfig.width : bodyConfig.height,
          true,
        )
      }
      body.reset(x, y)
      obstacle.setPosition(visualX, visualY)
    })
  }

  private createForestColliders(
    group: Phaser.Physics.Arcade.StaticGroup,
    colliders: readonly ForestCollider[],
  ): void {
    const debug = import.meta.env.DEV
      && new URLSearchParams(window.location.search).get('debug-colliders') === '1'
    const colors: Record<ForestCollider['role'], number> = {
      boundary: 0xf97316,
      trunk: 0x22c55e,
      ruin: 0xa78bfa,
      water: 0x38bdf8,
      landmark: 0xfacc15,
    }

    colliders.forEach((collider) => {
      const width = collider.shape === 'circle' ? (collider.radius ?? 1) * 2 : collider.width ?? 1
      const height = collider.shape === 'circle' ? (collider.radius ?? 1) * 2 : collider.height ?? 1
      const zone = this.add.zone(collider.x, collider.y, width, height).setOrigin(0.5)
      this.physics.add.existing(zone, true)
      const body = zone.body as Phaser.Physics.Arcade.StaticBody
      if (collider.shape === 'circle') body.setCircle(collider.radius ?? 1)
      else body.setSize(width, height, true)
      body.reset(collider.x, collider.y)
      group.add(zone)

      if (!debug) return
      const color = colors[collider.role]
      const outline = collider.shape === 'circle'
        ? this.add.circle(collider.x, collider.y, collider.radius ?? 1, color, 0.14).setStrokeStyle(2, color, 0.95)
        : this.add.rectangle(collider.x, collider.y, width, height, color, 0.14).setStrokeStyle(2, color, 0.95)
      const label = this.add.text(collider.x, collider.y - height / 2 - 5, collider.debugLabel, {
        fontFamily: 'ui-monospace, monospace',
        fontSize: '10px',
        color: '#ffffff',
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        padding: { x: 4, y: 2 },
      }).setOrigin(0.5, 1)
      outline.setDepth(99_990)
      label.setDepth(99_991)
      this.environmentObjects.push(outline, label)
      this.minimapHiddenObjects.push(outline, label)
    })
  }

  private updateForestForegrounds(): void {
    this.forestForegroundObjects.forEach(({ object, baseAlpha, fadeRadius, fadedAlpha }) => {
      const halfWidth = object.displayWidth / 2
      const halfHeight = object.displayHeight / 2
      const dx = Math.max(Math.abs(this.player.x - object.x) - halfWidth, 0)
      const dy = Math.max(Math.abs(this.player.y - object.y) - halfHeight, 0)
      const distance = Math.hypot(dx, dy)
      const targetAlpha = distance < fadeRadius ? fadedAlpha : baseAlpha
      object.setAlpha(Phaser.Math.Linear(object.alpha, targetAlpha, 0.12))
    })
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
      const displayHeight = obstacle.displayHeight ?? obstacle.size
      const visualX = obstacle.x - (-obstacle.size / 2 + obstacle.body.offsetX + bodyHalfWidth)
      const visualY = obstacle.y - (-displayHeight / 2 + obstacle.body.offsetY + bodyHalfHeight)
      const halfWidth = obstacle.size / 2
      const halfHeight = displayHeight / 2
      return (
        plantBounds.left < visualX + halfWidth
        && plantBounds.right > visualX - halfWidth
        && plantBounds.top < visualY + halfHeight
        && plantBounds.bottom > visualY - halfHeight
      )
    })
  }

  private forestPortalTexture(portal: MapPortal, worldWidth: number): string {
    if (portal.targetMapName === '晨曦村') return 'forest-entry-marker-left'
    return portal.x < worldWidth / 2
      ? 'forest-region-exit-left'
      : 'forest-region-exit-right'
  }

  private forestDepth(layout: ForestProp): number {
    return resolveForestVisualDepth(layout)
  }

  private createForestVisual(
    layout: ForestProp | ForestEffect | ForestForeground,
    hideFromMinimap = false,
  ): Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite {
    const tile = 'motion' in layout && layout.motion?.type === 'tile'
    const object = tile
      ? this.add.tileSprite(layout.x, layout.y, layout.width, layout.height, layout.texture)
      : this.add.image(layout.x, layout.y, layout.texture).setDisplaySize(layout.width, layout.height)
    const centeredByDefault = layout.depthRole === 'ground-decal'
      || layout.depthRole === 'underlay'
      || layout.depthRole === 'effect'
      || layout.depthRole === 'foreground'
    const origin = layout.origin ?? { x: 0.5, y: centeredByDefault ? 0.5 : 1 }
    object
      .setOrigin(origin.x, origin.y)
      .setAlpha(layout.alpha ?? 1)
      .setAngle(layout.angle ?? 0)
      .setDepth(this.forestDepth(layout))
    if (layout.additive) object.setBlendMode(Phaser.BlendModes.ADD)
    this.environmentObjects.push(object)
    if (hideFromMinimap) this.minimapHiddenObjects.push(object)
    return object
  }

  private applyForestMotion(
    object: Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite,
    layout: ForestEffect,
    prefersReducedMotion: boolean,
  ): void {
    if (prefersReducedMotion || !layout.motion) return
    if (layout.motion.type === 'tile' && object instanceof Phaser.GameObjects.TileSprite) {
      this.tweens.add({
        targets: object,
        tilePositionX: layout.motion.x,
        tilePositionY: layout.motion.y,
        duration: layout.motion.duration,
        repeat: -1,
      })
      return
    }
    if (layout.motion.type === 'pulse') {
      this.tweens.add({
        targets: object,
        alpha: { from: layout.motion.from, to: layout.motion.to },
        duration: layout.motion.duration,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      })
    }
  }

  private createForestWaterway(
    layout: ForestWaterway,
    width: number,
    height: number,
  ): void {
    const route = new Phaser.Curves.Spline(layout.points.map(({ x, y }) => new Phaser.Math.Vector2(x, y)))
    const samples = route.getSpacedPoints(Math.max(2, Math.ceil(route.getLength() / 24)))
    const shape = this.make.graphics({ x: 0, y: 0 }, false)
    shape.fillStyle(0xffffff)
    samples.forEach((sample) => shape.fillCircle(sample.x, sample.y, layout.width / 2))

    const base = this.make.graphics({ x: 0, y: 0 }, true)
    base.fillStyle(layout.edgeColor, layout.edgeAlpha)
    samples.forEach((sample) => base.fillCircle(sample.x, sample.y, layout.width / 2 + layout.edgePadding))
    base.setDepth(layout.depth - 0.05)

    const texture = this.add.tileSprite(width / 2, height / 2, width, height, layout.texture)
      .setAlpha(layout.alpha)
      .setDepth(layout.depth)
    if (layout.tilePosition) texture.setTilePosition(layout.tilePosition.x, layout.tilePosition.y)
    const mask = shape.createGeometryMask()
    texture.setMask(mask)

    this.forestWaterwayMasks.push({ mask, shape, texture })
    this.environmentObjects.push(base, texture)
    if (layout.minimapVisible === false) this.minimapHiddenObjects.push(base, texture)
  }

  private drawWorld(
    width: number,
    height: number,
    mapType: string,
    forestRegion: ForestRegionConfig | null,
  ): void {
    if (mapType === 'village') {
      this.add.tileSprite(0, 0, width, height, 'grass-ground').setOrigin(0).setDepth(-10)
      const routes = [
        new Phaser.Curves.Spline([
          32, 150,
          320, 210,
          520, 430,
          690, 620,
          790, 790,
          980, 920,
          1220, 1120,
          1510, 1450,
          1740, 1660,
          1900, 1840,
          2048, 1840,
        ]),
        new Phaser.Curves.Spline([790, 790, 740, 680, 690, 575]),
        new Phaser.Curves.Spline([790, 790, 590, 825, 390, 875]),
        new Phaser.Curves.Spline([790, 790, 950, 800, 1110, 825]),
        new Phaser.Curves.Spline([790, 790, 805, 990, 820, 1210]),
        new Phaser.Curves.Spline([820, 1210, 625, 1235, 430, 1260]),
        new Phaser.Curves.Spline([980, 920, 1110, 1025, 1240, 1130]),
      ]
      const path = this.add.tileSprite(0, 0, width, height, 'dirt-path').setOrigin(0).setDepth(-9)
      const maskShape = this.make.graphics({ x: 0, y: 0 }, false)
      maskShape.fillStyle(0xffffff)
      routes.forEach((route) =>
        route.getSpacedPoints(120).forEach((point) => maskShape.fillCircle(point.x, point.y, 58)),
      )
      maskShape.fillCircle(790, 790, 165)
      path.setMask(maskShape.createGeometryMask())
      return
    }

    if (!forestRegion) return
    forestRegion.groundLayers.forEach((layout, index) => {
      const positioned = layout as typeof layout & { x?: number; y?: number; angle?: number }
      const layerWidth = layout.width ?? width
      const layerHeight = layout.height ?? height
      const x = positioned.x ?? width / 2
      const y = positioned.y ?? height / 2
      const ground = layout.tile
        ? this.add.tileSprite(x, y, layerWidth, layerHeight, layout.texture)
        : this.add.image(x, y, layout.texture).setDisplaySize(layerWidth, layerHeight)
      ground
        .setOrigin(0.5)
        .setAlpha(layout.alpha ?? 1)
        .setAngle(positioned.angle ?? 0)
        .setDepth(-10 + index * 0.35)
      if (ground instanceof Phaser.GameObjects.TileSprite && layout.tilePosition) {
        ground.setTilePosition(layout.tilePosition.x, layout.tilePosition.y)
      }
      this.environmentObjects.push(ground)
    })

    forestRegion.paths.forEach((layout) => {
      const route = new Phaser.Curves.Spline(layout.points.map(({ x, y }) => new Phaser.Math.Vector2(x, y)))
      const divisions = Math.max(2, Math.ceil(route.getLength() / 145))
      const points = route.getSpacedPoints(divisions)
      points.forEach((point, index) => {
        const previous = points[Math.max(0, index - 1)]
        const next = points[Math.min(points.length - 1, index + 1)]
        const angle = Phaser.Math.RadToDeg(Phaser.Math.Angle.Between(previous.x, previous.y, next.x, next.y))
        const pathSegment = this.add.image(point.x, point.y, layout.texture)
          .setDisplaySize(layout.width, Math.max(64, Math.round(layout.width * 0.36)))
          .setAngle(angle)
          .setAlpha(layout.alpha)
          .setDepth(-7)
        this.environmentObjects.push(pathSegment)
      })
    })

    forestRegion.waterways.forEach((layout) => this.createForestWaterway(layout, width, height))

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ;[...forestRegion.props, ...forestRegion.landmarks].forEach((layout) => {
      this.createForestVisual(layout, !isForestVisualVisibleOnMinimap(layout))
    })
    forestRegion.effects.forEach((layout) => {
      const object = this.createForestVisual(layout, true)
      this.applyForestMotion(object, layout, prefersReducedMotion)
    })
    forestRegion.foreground.forEach((layout) => {
      const object = this.createForestVisual(layout, true)
      if (!(object instanceof Phaser.GameObjects.Image)) return
      this.forestForegroundObjects.push({
        object,
        baseAlpha: layout.alpha ?? 1,
        fadeRadius: layout.fadeRadius,
        fadedAlpha: layout.fadedAlpha,
      })
    })
  }
}
