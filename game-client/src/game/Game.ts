import Phaser from 'phaser'
import type { MapData, PlayerProfile } from '@/api/types'
import { createGameConfig } from '@/game/config/GameConfig'
import {
  ASSETS_READY_EVENT,
  BATTLE_SCENE_REQUEST_KEY,
  gameEvents,
  type GameEventMap,
} from '@/game/events'
import { BattleScene } from '@/game/scenes/BattleScene'
import { BootScene } from '@/game/scenes/BootScene'
import { PreloadScene } from '@/game/scenes/PreloadScene'
import { UIScene } from '@/game/scenes/UIScene'
import { WorldScene } from '@/game/scenes/WorldScene'

type BattleSceneRequest = GameEventMap['scene:battle']

export class WorldGame {
  readonly game: Phaser.Game
  private assetsReady = false

  constructor(
    parent: HTMLElement,
    map: MapData,
    player: PlayerProfile,
    initialBattle: BattleSceneRequest | null = null,
  ) {
    this.game = new Phaser.Game(createGameConfig(parent))
    this.game.registry.set('world-map', map)
    this.game.registry.set('world-player', player)
    if (initialBattle) this.game.registry.set(BATTLE_SCENE_REQUEST_KEY, initialBattle)
    this.game.scene.add('BootScene', BootScene)
    this.game.scene.add('PreloadScene', PreloadScene)
    this.game.scene.add('WorldScene', WorldScene)
    this.game.scene.add('BattleScene', BattleScene)
    this.game.scene.add('UIScene', UIScene)
    gameEvents.on('scene:battle', this.startBattle)
    gameEvents.on('scene:world', this.startWorld)
    this.game.events.once(ASSETS_READY_EVENT, this.onAssetsReady)
    this.game.scene.start('BootScene')
  }

  private readonly showBattle = ({ enemyName, enemySprite }: BattleSceneRequest): void => {
    this.game.registry.remove(BATTLE_SCENE_REQUEST_KEY)
    if (this.game.scene.isActive('BattleScene')) return
    if (this.game.scene.isActive('WorldScene')) this.game.scene.stop('WorldScene')
    this.game.scene.start('BattleScene', { enemyName, enemySprite })
  }

  private readonly onAssetsReady = (): void => {
    this.assetsReady = true
  }

  private readonly startBattle = (battle: BattleSceneRequest): void => {
    if (!this.assetsReady) {
      this.game.registry.set(BATTLE_SCENE_REQUEST_KEY, battle)
      return
    }
    this.showBattle(battle)
  }

  private readonly startWorld = (): void => {
    this.game.registry.remove(BATTLE_SCENE_REQUEST_KEY)
    if (!this.assetsReady) return
    if (this.game.scene.isActive('WorldScene')) return
    if (this.game.scene.isActive('BattleScene')) this.game.scene.stop('BattleScene')
    this.game.scene.start('WorldScene')
  }

  changeMap(map: MapData, player: PlayerProfile): void {
    this.game.registry.set('world-map', map)
    this.game.registry.set('world-player', player)
    this.game.scene.stop('WorldScene')
    this.game.scene.start('WorldScene')
  }

  destroy(): void {
    this.game.registry.remove(BATTLE_SCENE_REQUEST_KEY)
    this.game.events.off(ASSETS_READY_EVENT, this.onAssetsReady)
    gameEvents.off('scene:battle', this.startBattle)
    gameEvents.off('scene:world', this.startWorld)
    this.game.destroy(true)
  }
}
