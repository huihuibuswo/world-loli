import Phaser from 'phaser'
import {
  ASSETS_READY_EVENT,
  BATTLE_SCENE_REQUEST_KEY,
  type GameEventMap,
} from '@/game/events'

type BattleSceneRequest = GameEventMap['scene:battle']

const NPC_TEXTURE_KEYS = [
  'npc-village-chief',
  'npc-shopkeeper',
  'npc-suna',
  'npc-forest-guide',
  'npc-trainer',
  'npc-luna',
] as const

const DIRECTIONAL_WALK_DIRECTIONS = ['up', 'left', 'right'] as const

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene')
  }

  preload(): void {
    const root = '/assets/generated'
    this.load.image('player-female', `${root}/sprites/adventurer-female.png`)
    this.load.image('player-male', `${root}/sprites/adventurer-male.png`)
    this.load.spritesheet('player-female-walk', `${root}/sprites/adventurer-female-walk-sheet.png`, {
      frameWidth: 627,
      frameHeight: 627,
    })
    this.load.spritesheet('player-male-walk', `${root}/sprites/adventurer-male-walk-sheet.png`, {
      frameWidth: 627,
      frameHeight: 627,
    })
    for (const gender of ['female', 'male'] as const) {
      DIRECTIONAL_WALK_DIRECTIONS.forEach((direction) => {
        this.load.spritesheet(
          `player-${gender}-walk-${direction}`,
          `${root}/sprites/adventurer-${gender}-walk-${direction}-sheet.png`,
          { frameWidth: 256, frameHeight: 256 },
        )
      })
    }
    this.load.spritesheet('player-female-combat', `${root}/sprites/adventurer-female-combat-sheet.png`, {
      frameWidth: 313,
      frameHeight: 313,
      margin: 1,
    })
    this.load.spritesheet('player-male-combat', `${root}/sprites/adventurer-male-combat-sheet.png`, {
      frameWidth: 256,
      frameHeight: 256,
    })
    this.load.spritesheet('player-female-defense', `${root}/sprites/adventurer-female-defense-sheet.png`, {
      frameWidth: 313,
      frameHeight: 313,
    })
    this.load.spritesheet('player-male-defense', `${root}/sprites/adventurer-male-defense-sheet.png`, {
      frameWidth: 256,
      frameHeight: 256,
    })
    this.load.image('obstacle', `${root}/sprites/forest-obstacle.png`)
    this.load.image('forest-stump', `${root}/sprites/forest-stump.png`)
    this.load.image('ancient-forest-tree', `${root}/sprites/ancient-forest-tree.png`)
    this.load.image('forest-ground-cold-wet', `${root}/textures/forest/forest-ground-cold-wet.webp`)
    this.load.image('forest-path-wet-soil-overlay', `${root}/textures/forest/forest-path-wet-soil-overlay.png`)
    this.load.image('forest-moon-clearing-overlay', `${root}/textures/forest/forest-moon-clearing-overlay.png`)
    this.load.image('forest-reverse-mist-back', `${root}/textures/forest/effects/forest-reverse-mist-back.png`)
    this.load.image('forest-reverse-mist-mid', `${root}/textures/forest/effects/forest-reverse-mist-mid.png`)
    this.load.image('forest-ancient-moon-tree', `${root}/sprites/forest/forest-ancient-moon-tree.png`)
    this.load.image('forest-rock-cluster', `${root}/sprites/forest/forest-rock-cluster.png`)
    this.load.image('forest-hollow-stump', `${root}/sprites/forest/forest-hollow-stump.png`)
    this.load.image('forest-stump-cold', `${root}/sprites/forest/forest-stump-cold.png`)
    this.load.image('forest-fallen-log', `${root}/sprites/forest/forest-fallen-log.png`)
    this.load.image('forest-entry-marker-left', `${root}/sprites/forest/forest-entry-marker-left.png`)
    this.load.image('forest-broken-moon-mist-core', `${root}/sprites/forest/effects/forest-broken-moon-mist-core-idle.png`)
    this.load.image('forest-broken-moon-mark', `${root}/sprites/forest/effects/forest-broken-moon-mark-idle.png`)
    this.load.image('forest-wolf-tracks-broken', `${root}/textures/forest/forest-wolf-tracks-broken.png`)
    ;['a', 'b', 'c', 'd', 'e'].forEach((variant) => {
      this.load.image(`forest-tree-common-${variant}`, `${root}/sprites/forest/forest-tree-common-${variant}.png`)
    })
    ;['a', 'b', 'c', 'd'].forEach((variant) => {
      this.load.image(`forest-root-obstacle-${variant}`, `${root}/sprites/forest/forest-root-obstacle-${variant}.png`)
    })
    this.load.image('village-signpost', `${root}/sprites/village-signpost.png`)
    this.load.image('village-chief-house', `${root}/sprites/village-chief-house.png`)
    this.load.image('village-general-store', `${root}/sprites/village-general-store.png`)
    this.load.image('village-smithy', `${root}/sprites/village-smithy.png`)
    this.load.image('village-inn', `${root}/sprites/village-inn.png`)
    this.load.image('village-cottage-a', `${root}/sprites/village-cottage-a.png`)
    this.load.image('village-cottage-b', `${root}/sprites/village-cottage-b.png`)
    this.load.image('village-well', `${root}/sprites/village-well.png`)
    this.load.image('village-cart-supplies', `${root}/sprites/village-cart-supplies.png`)
    this.load.image('village-fence-segment', `${root}/sprites/village-fence-segment.png`)
    NPC_TEXTURE_KEYS.forEach((key) => {
      this.load.image(key, `${root}/sprites/${key}.png`)
      this.load.spritesheet(`${key}-walk`, `${root}/sprites/${key}-walk-sheet.png`, {
        frameWidth: 256,
        frameHeight: 256,
      })
      DIRECTIONAL_WALK_DIRECTIONS.forEach((direction) => {
        this.load.spritesheet(`${key}-walk-${direction}`, `${root}/sprites/${key}-walk-${direction}-sheet.png`, {
          frameWidth: 256,
          frameHeight: 256,
        })
      })
      this.load.spritesheet(`${key}-combat`, `${root}/sprites/${key}-combat-sheet.png`, {
        frameWidth: 256,
        frameHeight: 256,
      })
    })
    const plantRoot = `${root}/sprites/plants`
    const plantTextures = [
      'plant-morning-dew-grass',
      'plant-honey-berry',
      'plant-sunbell-flower',
      'plant-firefleece-flower',
      'plant-windbell-vine',
      'plant-silverleaf-grass',
      'plant-star-mint',
      'plant-moonlight-lily',
      'plant-mistfern',
      'plant-dreamdew-flower',
    ] as const
    plantTextures.forEach((key) => {
      this.load.image(key, `${plantRoot}/${key}-cutout.png`)
    })
    this.load.image('grass-ground', `${root}/textures/grass-ground.webp`)
    this.load.image('dirt-path', `${root}/textures/dirt-path.webp`)
    this.load.image('moon-arena', `${root}/backgrounds/moon-arena.webp`)
    this.load.image('dawn-village-battle-day', `${root}/backgrounds/dawn-village-battle-day.png`)
    this.load.image('dawn-village-battle-night', `${root}/backgrounds/dawn-village-battle-night.png`)
  }

  create(): void {
    for (const gender of ['female', 'male'] as const) {
      this.anims.create({
        key: `player-${gender}-walk-cycle`,
        frames: this.anims.generateFrameNumbers(`player-${gender}-walk`, { frames: [0, 1, 2, 3] }),
        frameRate: 9,
        repeat: -1,
      })
      DIRECTIONAL_WALK_DIRECTIONS.forEach((direction) => {
        const texture = `player-${gender}-walk-${direction}`
        if (!this.textures.exists(texture)) return
        this.anims.create({
          key: `${texture}-cycle`,
          frames: this.anims.generateFrameNumbers(texture, { frames: [0, 1, 2, 3] }),
          frameRate: 9,
          repeat: -1,
        })
      })
      const combatTexture = `player-${gender}-combat`
      const actions = [
        { name: 'attack', frames: [0, 1, 2, 3], frameRate: 10 },
        { name: 'hit', frames: [4, 5, 6, 7], frameRate: 10 },
        { name: 'death', frames: [8, 9, 10, 11], frameRate: 8 },
        { name: 'victory', frames: [12, 13, 14, 15], frameRate: 7 },
      ]
      actions.forEach(({ name, frames, frameRate }) => {
        this.anims.create({
          key: `${combatTexture}-${name}`,
          frames: this.anims.generateFrameNumbers(combatTexture, { frames }),
          frameRate,
          repeat: 0,
        })
      })
      const defenseTexture = `player-${gender}-defense`
      if (this.textures.exists(defenseTexture)) {
        this.anims.create({
          key: `${combatTexture}-defense`,
          frames: this.anims.generateFrameNumbers(defenseTexture, { frames: [0, 1, 2, 3] }),
          frameRate: 8,
          repeat: 0,
        })
      }
    }
    NPC_TEXTURE_KEYS.forEach((textureKey) => {
      const walkTexture = `${textureKey}-walk`
      if (this.textures.exists(walkTexture)) {
        this.anims.create({
          key: `${textureKey}-walk-cycle`,
          frames: this.anims.generateFrameNumbers(walkTexture, { frames: [0, 1, 2, 3] }),
          frameRate: 8,
          repeat: -1,
        })
      }
      DIRECTIONAL_WALK_DIRECTIONS.forEach((direction) => {
        const directionalTexture = `${textureKey}-walk-${direction}`
        if (!this.textures.exists(directionalTexture)) return
        this.anims.create({
          key: `${directionalTexture}-cycle`,
          frames: this.anims.generateFrameNumbers(directionalTexture, { frames: [0, 1, 2, 3] }),
          frameRate: 8,
          repeat: -1,
        })
      })

      const texture = `${textureKey}-combat`
      if (!this.textures.exists(texture)) return
      const actions = [
        { name: 'attack', start: 0, frameRate: 10 },
        { name: 'defense', start: 4, frameRate: 8 },
        { name: 'hit', start: 8, frameRate: 10 },
        { name: 'death', start: 12, frameRate: 8 },
        { name: 'victory', start: 16, frameRate: 7 },
      ]
      actions.forEach(({ name, start, frameRate }) => {
        this.anims.create({
          key: `${texture}-${name}`,
          frames: this.anims.generateFrameNumbers(texture, { start, end: start + 3 }),
          frameRate,
          repeat: 0,
        })
      })
    })
    const initialBattle = this.registry.get(BATTLE_SCENE_REQUEST_KEY) as
      | BattleSceneRequest
      | undefined
    this.registry.remove(BATTLE_SCENE_REQUEST_KEY)
    this.game.events.emit(ASSETS_READY_EVENT)
    if (initialBattle) {
      this.scene.start('BattleScene', initialBattle)
      return
    }
    this.scene.start('WorldScene')
  }
}
