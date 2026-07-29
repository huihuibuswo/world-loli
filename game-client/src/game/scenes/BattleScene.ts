import Phaser from 'phaser'
import type { MapData, PlayerProfile } from '@/api/types'
import { CardSpirit } from '@/game/entities/CardSpirit'
import { GAME_TIME_KEY, gameEvents, type BattleVisualSequence, type BattleVisualStep } from '@/game/events'
import { getTimePhase, type GameTimeState } from '@/game/time'

const DAWN_VILLAGE_NAME = '晨曦村'

export class BattleScene extends Phaser.Scene {
  private enemy!: CardSpirit
  private playerSpirit!: CardSpirit
  private visualGeneration = 0

  constructor() {
    super('BattleScene')
  }

  create(data: { enemyName?: string; enemySprite?: string }): void {
    const { width, height } = this.scale
    const profile = this.registry.get('world-player') as PlayerProfile
    const map = this.registry.get('world-map') as MapData | undefined
    const gameTime = this.registry.get(GAME_TIME_KEY) as GameTimeState | undefined
    const phase = getTimePhase(gameTime?.minuteOfDay ?? profile.minute_of_day)
    const isDawnVillage = map?.map_name === DAWN_VILLAGE_NAME
    const backgroundTexture = isDawnVillage
      ? phase === 'dawn' || phase === 'day'
        ? 'dawn-village-battle-day'
        : 'dawn-village-battle-night'
      : 'moon-arena'
    const avatarGender = profile.avatar_gender === 'male' ? 'male' : 'female'
    const background = this.add.image(width / 2, height / 2, backgroundTexture)
    background.setScale(Math.max(width / background.width, height / background.height))
    this.add
      .text(width / 2, 54, isDawnVillage ? '晨曦村演武场' : '月影竞技场', {
        fontFamily: 'ui-rounded, sans-serif',
        fontSize: '30px',
        color: '#fff1bd',
      })
      .setOrigin(0.5)
    const enemyTexture = data.enemySprite && this.textures.exists(data.enemySprite)
      ? data.enemySprite
      : 'npc-trainer'
    const enemyCombatTexture = `${enemyTexture}-combat`
    const enemyBattleTexture = this.textures.exists(enemyCombatTexture) ? enemyCombatTexture : enemyTexture
    const isMistShadow = data.enemyName === '雾痕兽影'
    this.enemy = new CardSpirit(
      this,
      width * 0.72,
      height * 0.42,
      data.enemyName ?? '对手',
      enemyBattleTexture,
      isMistShadow ? 0x7c3aed : 0xb45309,
      undefined,
      isMistShadow ? 0x6d28d9 : undefined,
    )
    this.playerSpirit = new CardSpirit(
      this,
      width * 0.28,
      height * 0.58,
      profile.name,
      `player-${avatarGender}-combat`,
      0x15803d,
      `player-${avatarGender}-defense`,
    )
    gameEvents.on('battle:action', this.onBattleAction)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.visualGeneration += 1
      gameEvents.off('battle:action', this.onBattleAction)
    })
  }

  private readonly onBattleAction = (sequence: BattleVisualSequence): void => {
    const generation = ++this.visualGeneration
    void this.playSequence(sequence, generation)
  }

  private async playSequence(sequence: BattleVisualSequence, generation: number): Promise<void> {
    for (const step of sequence.steps) {
      if (generation !== this.visualGeneration || !this.scene.isActive()) return
      await this.playStep(step)
      if (step.targetDefeated) break
    }
    if (generation !== this.visualGeneration || !this.scene.isActive()) return
    const defeated = sequence.steps.find((step) => step.targetDefeated)
    const endingAnimations: Array<Promise<void>> = []
    if (defeated) {
      const defender = defeated.actor === 'player' ? this.enemy : this.playerSpirit
      endingAnimations.push(new Promise((resolve) => defender.playDeath(resolve)))
    }
    const victor = sequence.result === 'victory'
      ? this.playerSpirit
      : sequence.result === 'defeat'
        ? this.enemy
        : null
    if (victor) {
      endingAnimations.push(new Promise((resolve) => {
        this.time.delayedCall(180, () => victor.playVictory(resolve))
      }))
    }
    await Promise.all(endingAnimations)
    if (generation !== this.visualGeneration || !this.scene.isActive()) return
    gameEvents.emit('battle:visual-complete', { version: sequence.version })
  }

  private playStep(step: BattleVisualStep): Promise<void> {
    const attacker = step.actor === 'player' ? this.playerSpirit : this.enemy
    const defender = step.actor === 'player' ? this.enemy : this.playerSpirit
    if (!attacker || !defender) return Promise.resolve()
    if (step.kind === 'defense') {
      return new Promise((resolve) => attacker.playDefense(resolve))
    }
    return new Promise((resolve) => {
      attacker.playAttack(step.actor === 'player' ? 1 : -1, () => {
        if (step.damage > 0) defender.playHit()
        else if (step.blocked > 0) defender.playDefense()
      }, resolve)
    })
  }
}
