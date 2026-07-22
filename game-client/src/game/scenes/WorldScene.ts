import Phaser from 'phaser'
import type { MapData, PlayerProfile } from '@/api/types'
import { gameEvents } from '@/game/events'
import { NPC } from '@/game/entities/NPC'
import { Player } from '@/game/entities/Player'

export class WorldScene extends Phaser.Scene {
  private player!: Player
  private npcs: NPC[] = []
  private playerMapMarker!: Phaser.GameObjects.Arc
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>
  private interactKey!: Phaser.Input.Keyboard.Key
  private nearby: NPC | null = null
  private lastPositionEmit = 0

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

    this.drawWorld(width, height)
    const obstacles = this.physics.add.staticGroup()
    const obstacleLayout: Array<{
      x: number
      y: number
      texture: string
      size: number
      body: { shape: 'circle'; radius: number; offsetX: number; offsetY: number } | { shape: 'rect'; width: number; height: number; offsetX: number; offsetY: number }
    }> = [
      { x: 1180, y: 620, texture: 'obstacle', size: 96, body: { shape: 'circle', radius: 28, offsetX: 20, offsetY: 27 } },
      { x: 1160, y: 300, texture: 'forest-stump', size: 96, body: { shape: 'circle', radius: 29, offsetX: 19, offsetY: 27 } },
      { x: 1050, y: 520, texture: 'obstacle', size: 96, body: { shape: 'circle', radius: 28, offsetX: 20, offsetY: 27 } },
      { x: 1030, y: 1140, texture: 'village-signpost', size: 110, body: { shape: 'rect', width: 44, height: 22, offsetX: 33, offsetY: 84 } },
      { x: 1270, y: 350, texture: 'forest-stump', size: 96, body: { shape: 'circle', radius: 29, offsetX: 19, offsetY: 27 } },
      // Each house has its own bottom footprint rectangle, measured from its facade,
      // porch and foundation. Roofs and upper transparent areas never collide.
      { x: 650, y: 430, texture: 'village-chief-house', size: 420, body: { shape: 'rect', width: 330, height: 110, offsetX: 45, offsetY: 314 } },
      { x: 920, y: 710, texture: 'village-general-store', size: 330, body: { shape: 'rect', width: 240, height: 92, offsetX: 45, offsetY: 243 } },
      { x: 300, y: 750, texture: 'village-smithy', size: 350, body: { shape: 'rect', width: 300, height: 110, offsetX: 26, offsetY: 250 } },
      { x: 760, y: 1040, texture: 'village-inn', size: 320, body: { shape: 'rect', width: 240, height: 96, offsetX: 40, offsetY: 230 } },
      { x: 270, y: 1080, texture: 'village-cottage-a', size: 280, body: { shape: 'rect', width: 220, height: 88, offsetX: 31, offsetY: 199 } },
      { x: 1080, y: 950, texture: 'village-cottage-b', size: 300, body: { shape: 'rect', width: 250, height: 90, offsetX: 26, offsetY: 214 } },
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
    obstacleLayout.forEach(({ x, y, texture, size, body: bodyConfig }) => {
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
    this.npcs.forEach((npc) => this.physics.add.collider(this.player, npc))

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1)
    this.cameras.main.setZoom(1.08)
    this.createMinimap(bounds.min_x, bounds.min_y, width, height)
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.wasd = this.input.keyboard!.addKeys('W,S,A,D') as Record<string, Phaser.Input.Keyboard.Key>
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E)
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)

    gameEvents.on('input:direction', this.onVirtualDirection)
    gameEvents.on('input:interact', this.interact)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      gameEvents.off('input:direction', this.onVirtualDirection)
      gameEvents.off('input:interact', this.interact)
    })
    gameEvents.emit('world:ready', undefined)
  }

  update(time: number): void {
    this.player.move(this.cursors, this.wasd)
    this.playerMapMarker.setPosition(this.player.x, this.player.y)
    this.updateNearbyNpc()
    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) this.interact()
    if (time - this.lastPositionEmit > 600 && this.player.body?.velocity.lengthSq()) {
      this.lastPositionEmit = time
      gameEvents.emit('player:moved', { x: this.player.x, y: this.player.y })
    }
  }

  private readonly onVirtualDirection = ({ x, y }: { x: number; y: number }): void => {
    this.player?.setVirtualDirection(x, y)
  }

  private readonly interact = (): void => {
    if (this.nearby) gameEvents.emit('npc:interact', { id: this.nearby.npcId })
  }

  private updateNearbyNpc(): void {
    let nearest: NPC | null = null
    let distance = this.player.interactionRange
    for (const npc of this.npcs) {
      const next = Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y)
      if (next < distance) {
        distance = next
        nearest = npc
      }
    }
    if (nearest !== this.nearby) {
      this.nearby = nearest
      gameEvents.emit('npc:near', { id: nearest?.npcId ?? null, name: nearest?.npcName ?? null })
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
    const npcMarkers = this.npcs.map((npc) =>
      this.add.circle(npc.x, npc.y, 30, 0xf59e0b).setDepth(99_999),
    )
    this.cameras.main.ignore([this.playerMapMarker, ...npcMarkers])
  }

  private drawWorld(width: number, height: number): void {
    this.add.tileSprite(0, 0, width, height, 'grass-ground').setOrigin(0).setDepth(-10)
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
  }
}
