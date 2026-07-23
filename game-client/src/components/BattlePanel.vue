<script setup lang="ts">
import { computed, watch } from 'vue'
import { ArrowRight, Droplets, RotateCcw, Shield, Swords } from 'lucide-vue-next'
import { gameEvents } from '@/game/events'
import { useGameStore } from '@/stores/game'

const game = useGameStore()
const battle = computed(() => game.battle!)
const hand = computed(() => battle.value.hand_cards.map((id) => game.cardById.get(id)).filter(Boolean))

watch(() => battle.value?.version, (nextVersion, previousVersion) => {
  const action = battle.value?.last_action
  if (action?.damage !== undefined && previousVersion !== undefined && nextVersion !== previousVersion) {
    const target = action.type === 'enemy_attack' ? 'player' : 'enemy'
    const targetState = target === 'enemy' ? battle.value.enemy_state : battle.value.player_state
    gameEvents.emit('battle:action', {
      damage: action.damage,
      target,
      targetDefeated: targetState.hp <= 0,
      result: battle.value.status,
    })
  }
})
</script>

<template>
  <section class="battle-ui" aria-label="战斗界面">
    <div class="battle-topbar glass-panel">
      <div class="combatant">
        <strong>{{ game.player?.name }}</strong><span>Lv.{{ game.player?.level }}</span>
        <div class="hp-track"><i :style="{ width: `${Math.max(0, battle.player_state.hp / battle.player_state.max_hp * 100)}%` }" /></div>
        <small>{{ battle.player_state.hp }} / {{ battle.player_state.max_hp }}</small>
      </div>
      <div class="turn-badge"><Swords :size="18" /><span>第 {{ battle.current_turn }} 回合</span></div>
      <div class="combatant enemy">
        <strong>{{ battle.enemy_state.name }}</strong><span>对手</span>
        <div class="hp-track"><i :style="{ width: `${Math.max(0, battle.enemy_state.hp / battle.enemy_state.max_hp * 100)}%` }" /></div>
        <small>{{ battle.enemy_state.hp }} / {{ battle.enemy_state.max_hp }}</small>
      </div>
    </div>

    <div v-if="battle.status !== 'active'" class="battle-result glass-panel" role="status">
      <p class="eyebrow">BATTLE COMPLETE</p>
      <h2>{{ battle.status === 'victory' ? '胜利' : '战斗结束' }}</h2>
      <p>{{ battle.status === 'victory' ? '林间的回响化作新的力量。' : '休整之后，再次启程。' }}</p>
      <div v-if="battle.status === 'victory'" class="battle-rewards" aria-label="战斗奖励">
        <span v-if="battle.reward?.card">首胜赠礼：{{ battle.reward.card.name }} ×{{ battle.reward.card.count }}</span>
        <span v-else>本次切磋没有额外奖励</span>
      </div>
      <button class="button primary" type="button" @click="game.leaveBattle"><RotateCcw :size="18" />返回世界</button>
    </div>

    <div v-else class="battle-controls">
      <div class="energy-pill" aria-label="当前能量"><Droplets :size="19" /><strong>{{ battle.energy }}</strong><span>能量</span></div>
      <div class="card-hand" aria-label="手牌">
        <button v-for="(card, index) in hand" :key="`${card!.id}-${index}`" class="battle-card" type="button"
          :disabled="game.actionLoading || card!.cost > battle.energy" @click="game.playCard(card!.id)">
          <span class="card-cost">{{ card!.cost }}</span>
          <img class="card-art" :src="card!.source_spirit_id ? '/assets/generated/portraits/luna.webp' : '/assets/generated/cards/basic-attack.webp'" alt="">
          <span class="card-sigil"><Shield v-if="card!.type === 'defense'" :size="30" /><Swords v-else :size="30" /></span>
          <strong>{{ card!.name }}</strong><small>{{ card!.effect.damage ? `造成 ${card!.effect.damage} 点伤害` : '施放卡牌效果' }}</small>
        </button>
      </div>
      <button class="button end-turn" type="button" :disabled="game.actionLoading" @click="game.endTurn">结束回合<ArrowRight :size="18" /></button>
    </div>
  </section>
</template>
