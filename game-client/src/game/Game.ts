import Phaser from 'phaser'
import type { MapData, PlayerProfile } from '@/api/types'
import { createGameConfig } from '@/game/config/GameConfig'
import { gameEvents, type GameEventMap } from '@/game/events'
import { BattleScene } from '@/game/scenes/BattleScene'
import { BootScene } from '@/game/scenes/BootScene'
import { PreloadScene } from '@/game/scenes/PreloadScene'
import { UIScene } from '@/game/scenes/UIScene'
import { WorldScene } from '@/game/scenes/WorldScene'

type BattleSceneRequest = GameEventMap['scene:battle']

export class WorldGame {
  readonly game: Phaser.Game
  private assetsReady = false
  private pendingBattle: BattleSceneRequest | null = null

  constructor(parent: HTMLElement, map: MapData, player: PlayerProfile) {
    this.game = new Phaser.Game(createGameConfig(parent))
    this.game.registry.set('world-map', map)
    this.game.registry.set('world-player', player)
    this.game.scene.add('BootScene', BootScene)
    this.game.scene.add('PreloadScene', PreloadScene)
    this.game.scene.add('WorldScene', WorldScene)
    this.game.scene.add('BattleScene', BattleScene)
    this.game.scene.add('UIScene', UIScene)
    gameEvents.on('world:ready', this.onWorldReady)
    gameEvents.on('scene:battle', this.startBattle)
    gameEvents.on('scene:world', this.startWorld)
    this.game.scene.start('BootScene')
  }

  private readonly showBattle = ({ enemyName, enemySprite }: BattleSceneRequest): void => {
    this.game.scene.stop('WorldScene')
    this.game.scene.start('BattleScene', { enemyName, enemySprite })
  }

  private readonly onWorldReady = (): void => {
    this.assetsReady = true
    if (!this.pendingBattle) return
    const battle = this.pendingBattle
    this.pendingBattle = null
    this.showBattle(battle)
  }

  private readonly startBattle = (battle: BattleSceneRequest): void => {
    if (!this.assetsReady) {
      this.pendingBattle = battle
      return
    }
    this.showBattle(battle)
  }

  private readonly startWorld = (): void => {
    this.pendingBattle = null
    if (!this.assetsReady) return
    this.game.scene.stop('BattleScene')
    this.game.scene.start('WorldScene')
  }

  changeMap(map: MapData, player: PlayerProfile): void {
    this.game.registry.set('world-map', map)
    this.game.registry.set('world-player', player)
    this.game.scene.stop('WorldScene')
    this.game.scene.start('WorldScene')
  }

  destroy(): void {
    this.pendingBattle = null
    gameEvents.off('world:ready', this.onWorldReady)
    gameEvents.off('scene:battle', this.startBattle)
    gameEvents.off('scene:world', this.startWorld)
    this.game.destroy(true)
  }
}
