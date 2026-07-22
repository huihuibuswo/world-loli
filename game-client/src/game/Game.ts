import Phaser from 'phaser'
import type { MapData, PlayerProfile } from '@/api/types'
import { createGameConfig } from '@/game/config/GameConfig'
import { gameEvents } from '@/game/events'
import { BattleScene } from '@/game/scenes/BattleScene'
import { BootScene } from '@/game/scenes/BootScene'
import { PreloadScene } from '@/game/scenes/PreloadScene'
import { UIScene } from '@/game/scenes/UIScene'
import { WorldScene } from '@/game/scenes/WorldScene'

export class WorldGame {
  readonly game: Phaser.Game

  constructor(parent: HTMLElement, map: MapData, player: PlayerProfile) {
    this.game = new Phaser.Game(createGameConfig(parent))
    this.game.registry.set('world-map', map)
    this.game.registry.set('world-player', player)
    this.game.scene.add('BootScene', BootScene)
    this.game.scene.add('PreloadScene', PreloadScene)
    this.game.scene.add('WorldScene', WorldScene)
    this.game.scene.add('BattleScene', BattleScene)
    this.game.scene.add('UIScene', UIScene)
    this.game.scene.start('BootScene')
    gameEvents.on('scene:battle', this.startBattle)
    gameEvents.on('scene:world', this.startWorld)
  }

  private readonly startBattle = ({ enemyName }: { enemyName: string }): void => {
    this.game.scene.stop('WorldScene')
    this.game.scene.start('BattleScene', { enemyName })
  }

  private readonly startWorld = (): void => {
    this.game.scene.stop('BattleScene')
    this.game.scene.start('WorldScene')
  }

  destroy(): void {
    gameEvents.off('scene:battle', this.startBattle)
    gameEvents.off('scene:world', this.startWorld)
    this.game.destroy(true)
  }
}
