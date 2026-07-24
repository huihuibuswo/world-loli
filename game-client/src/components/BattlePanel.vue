<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowRight, Droplets, LogOut, RotateCcw, Shield, Sparkles, Swords } from 'lucide-vue-next'
import { gameEvents, type BattleVisualStep } from '@/game/events'
import { useGameStore } from '@/stores/game'

const game = useGameStore()
const battle = computed(() => game.battle!)
const hand = computed(() => battle.value.hand_cards.map((id) => game.cardById.get(id)).filter(Boolean))
const enemyCards = computed(() => battle.value.last_action?.cards ?? [])
const lunaContract = computed(() => (
  battle.value.reward?.opening?.event === 'luna_contract'
    ? battle.value.reward.opening
    : null
))
const contractStep = ref(0)
const contractLine = computed(() => lunaContract.value?.dialogue?.[contractStep.value] ?? null)
const contractStoryActive = computed(() => contractLine.value !== null)
const visualBusy = ref(false)
let visualTimeout: number | null = null

const completeVisuals = ({ version }: { version: number }): void => {
  if (version !== battle.value?.version) return
  if (visualTimeout !== null) window.clearTimeout(visualTimeout)
  visualTimeout = null
  visualBusy.value = false
}

onMounted(() => gameEvents.on('battle:visual-complete', completeVisuals))
onBeforeUnmount(() => {
  if (visualTimeout !== null) window.clearTimeout(visualTimeout)
  gameEvents.off('battle:visual-complete', completeVisuals)
})

watch(() => battle.value?.battle_id, () => {
  contractStep.value = 0
})

watch(() => battle.value?.version, (nextVersion, previousVersion) => {
  const action = battle.value?.last_action
  if (!action || previousVersion === undefined || nextVersion === undefined || nextVersion === previousVersion) return

  let steps: BattleVisualStep[] = []
  if (action.type === 'enemy_cards' && action.cards?.length) {
    const lastIndex = action.cards.length - 1
    steps = action.cards.map((card, index) => ({
      actor: 'enemy',
      kind: card.type === 'defense' ? 'defense' : 'attack',
      damage: card.damage,
      blocked: card.blocked,
      shield: card.shield,
      targetDefeated: index === lastIndex && battle.value.player_state.hp <= 0,
    }))
  } else if (action.type === 'enemy_cards' && action.damage !== undefined) {
    steps = [{
      actor: 'enemy',
      kind: 'attack',
      damage: action.damage,
      blocked: action.blocked ?? 0,
      shield: action.shield ?? 0,
      targetDefeated: battle.value.player_state.hp <= 0,
    }]
  } else if (action.type === 'play_card' && action.card_id !== undefined) {
    const card = game.cardById.get(action.card_id)
    steps = [{
      actor: 'player',
      kind: card?.type === 'defense' ? 'defense' : 'attack',
      damage: action.damage ?? 0,
      blocked: action.blocked ?? 0,
      shield: action.shield ?? 0,
      targetDefeated: battle.value.enemy_state.hp <= 0,
    }]
  }
  if (!steps.length) return

  visualBusy.value = true
  if (visualTimeout !== null) window.clearTimeout(visualTimeout)
  visualTimeout = window.setTimeout(() => {
    visualBusy.value = false
    visualTimeout = null
  }, Math.max(2400, steps.length * 900))
  gameEvents.emit('battle:action', {
    version: nextVersion,
    steps,
    result: battle.value.status,
  })
})
</script>

<template>
  <section class="battle-ui" aria-label="战斗界面">
    <div class="battle-topbar glass-panel">
      <div class="combatant">
        <strong>{{ game.player?.name }}</strong><span>Lv.{{ game.player?.level }}</span>
        <div class="hp-track"><i :style="{ width: `${Math.max(0, battle.player_state.hp / battle.player_state.max_hp * 100)}%` }" /></div>
        <small>{{ battle.player_state.hp }} / {{ battle.player_state.max_hp }}<template v-if="battle.player_state.shield"> · 护盾 {{ battle.player_state.shield }}</template></small>
      </div>
      <div class="turn-badge"><Swords :size="18" /><span>第 {{ battle.current_turn }} 回合</span></div>
      <div class="combatant enemy">
        <strong>{{ battle.enemy_state.name }}</strong><span>对手</span>
        <div class="hp-track"><i :style="{ width: `${Math.max(0, battle.enemy_state.hp / battle.enemy_state.max_hp * 100)}%` }" /></div>
        <small>{{ battle.enemy_state.hp }} / {{ battle.enemy_state.max_hp }}<template v-if="battle.enemy_state.shield"> · 护盾 {{ battle.enemy_state.shield }}</template></small>
        <small class="enemy-deck-state">能量 {{ battle.enemy_energy ?? 0 }} · 手牌 {{ battle.enemy_hand_count ?? 0 }} · 牌堆 {{ battle.enemy_draw_count ?? 0 }} · 弃牌 {{ battle.enemy_discard_count ?? 0 }}</small>
      </div>
    </div>

    <div v-if="battle.last_action?.battle_line || enemyCards.length" class="battle-action-line glass-panel" role="status">
      <Shield v-if="enemyCards.length && enemyCards.every((card) => card.type === 'defense')" :size="17" />
      <Swords v-else :size="17" />
      <span>{{ battle.last_action?.battle_line || `${battle.enemy_state.name} 使用了 ${enemyCards.map((card) => card.name).join('、')}` }}</span>
    </div>

    <div v-if="battle.status !== 'active'" class="battle-result glass-panel" role="status">
      <template v-if="contractStoryActive && contractLine">
        <div class="luna-contract-portrait" aria-hidden="true">
          <img src="/assets/generated/portraits/luna.webp" alt="">
        </div>
        <div class="luna-contract-copy">
          <p class="eyebrow">MOON SCAR CONTRACT · {{ contractStep + 1 }}/{{ lunaContract?.dialogue?.length }}</p>
          <h2>{{ contractLine.speaker }}</h2>
          <p class="luna-contract-line">{{ contractLine.text }}</p>
          <button
            class="button primary"
            type="button"
            :disabled="game.actionLoading || visualBusy"
            @click="contractStep += 1"
          >
            {{ contractStep + 1 === lunaContract?.dialogue?.length ? '接受契约' : '继续' }}<ArrowRight :size="18" />
          </button>
        </div>
      </template>
      <template v-else>
        <p class="eyebrow">BATTLE COMPLETE</p>
        <h2>{{ battle.status === 'victory' ? '胜利' : '败北' }}</h2>
        <p>{{ lunaContract?.message ?? (battle.status === 'victory' ? '林间的回响化作新的力量。' : battle.defeat_reason === 'surrender' ? '你已中途退出，本场按失败结算。' : '战斗失利，休整之后再次启程。') }}</p>
        <div class="battle-rewards" aria-label="战斗结算">
          <span v-if="battle.penalty" class="battle-penalty">
            失败惩罚：金币 -{{ battle.penalty.gold_lost }} · 剩余 {{ battle.penalty.gold_remaining }}
          </span>
          <span v-if="battle.affection_result?.points_gained">
            好感 +{{ battle.affection_result.points_gained }} · Lv.{{ battle.affection_result.new_level }}
          </span>
          <span
            v-for="reward in battle.affection_result?.rewards ?? []"
            :key="`${reward.type}-${reward.milestone_level}`"
          >
            {{ reward.milestone_level === 1 ? '初次对战赠礼' : `好感 Lv.${reward.milestone_level} 奖励` }}：{{ reward.name }} ×{{ reward.count }}
          </span>
          <span v-if="!battle.affection_result?.points_gained && !battle.affection_result?.rewards.length && battle.reward?.card">
            初次对战赠礼：{{ battle.reward.card.name }} ×{{ battle.reward.card.count }}
          </span>
          <span v-if="battle.reward?.fragment">
            {{ battle.reward.fragment.name }}碎片 +{{ battle.reward.fragment.fragment_delta }} · {{ battle.reward.fragment.fragment_count }}/{{ battle.reward.fragment.fragment_target }}
          </span>
          <span v-if="lunaContract?.contract_reward"><Sparkles :size="15" />{{ lunaContract.contract_reward.spirit.name }}已成为卡灵</span>
          <span v-if="lunaContract?.contract_reward">{{ lunaContract.contract_reward.card.name }} ×{{ lunaContract.contract_reward.card.deck_amount }} · 已加入启用套牌</span>
          <span v-if="!battle.affection_result?.points_gained && !battle.affection_result?.rewards.length && !battle.reward?.card && !battle.reward?.fragment && !lunaContract">
            本次切磋没有额外奖励
          </span>
        </div>
        <button class="button primary" type="button" :disabled="game.actionLoading || visualBusy" @click="game.leaveBattle"><RotateCcw :size="18" />返回世界</button>
      </template>
    </div>

    <div v-else class="battle-controls">
      <div class="energy-pill" aria-label="当前能量"><Droplets :size="19" /><strong>{{ battle.energy }}</strong><span>能量</span></div>
      <div class="card-hand" aria-label="手牌">
        <button v-for="(card, index) in hand" :key="`${card!.id}-${index}`" class="battle-card" type="button"
          :disabled="game.actionLoading || visualBusy || card!.cost > battle.energy" :aria-label="`使用${card!.name}`" @click="game.playCard(card!.id)">
          <span class="card-cost">{{ card!.cost }}</span>
          <img class="card-art" :src="card!.source_spirit_id ? '/assets/generated/portraits/luna.webp' : card!.type === 'defense' ? '/assets/generated/cards/basic-defense.webp' : '/assets/generated/cards/basic-attack.webp'" alt="">
          <span class="card-sigil"><Shield v-if="card!.type === 'defense'" :size="30" /><Swords v-else :size="30" /></span>
          <strong>{{ card!.name }}</strong><small>{{ card!.effect.damage ? `造成 ${card!.effect.damage} 点伤害` : card!.effect.shield ? `获得 ${card!.effect.shield} 点护盾` : '施放卡牌效果' }}</small>
        </button>
      </div>
      <div class="battle-turn-actions">
        <button class="button surrender-button" type="button" :disabled="game.actionLoading || visualBusy" @click="game.surrenderBattle">
          <LogOut :size="17" />中途退出
        </button>
        <button class="button end-turn" type="button" :disabled="game.actionLoading || visualBusy" @click="game.endTurn">结束回合<ArrowRight :size="18" /></button>
      </div>
    </div>
  </section>
</template>
