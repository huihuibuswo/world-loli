<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowLeft, BookOpen, Gift, Heart, Layers3, Leaf, Sparkles, TrendingUp, X } from 'lucide-vue-next'
import CardDetailModal from '@/components/CardDetailModal.vue'
import { useGameStore } from '@/stores/game'
import type { CardData, SpiritData } from '@/api/types'

defineEmits<{ close: [] }>()
const game = useGameStore()
const tab = ref<'cards' | 'spirits' | 'plants' | 'deck'>('cards')
const selectedSpiritId = ref<number | null>(null)
const selectedCard = ref<CardData | null>(null)
const selectedSpirit = computed(() => game.spirits.find((spirit) => spirit.id === selectedSpiritId.value) ?? null)
const unownedFragments = computed(() => game.spiritFragments.filter((fragment) => fragment.owned_spirit_id === null))
const clock = ref(Date.now())
let clockTimer: number | null = null

const interactionCooldownSeconds = computed(() => {
  const availableAt = selectedSpirit.value?.interaction_available_at
  if (!availableAt) return 0
  const remaining = Math.ceil((Date.parse(availableAt) - clock.value) / 1000)
  return Number.isFinite(remaining) ? Math.max(0, remaining) : 0
})

const interactionLabel = computed(() => {
  if (game.actionLoading) return '互动中…'
  if (selectedSpirit.value?.affection === 100) return '羁绊已满'
  if (interactionCooldownSeconds.value > 0) return `${interactionCooldownSeconds.value} 秒后可交谈`
  return '陪伴交谈'
})

watch(tab, () => {
  selectedSpiritId.value = null
  selectedCard.value = null
})

onMounted(() => {
  clockTimer = window.setInterval(() => { clock.value = Date.now() }, 1000)
})

onBeforeUnmount(() => {
  if (clockTimer) window.clearInterval(clockTimer)
})

function affectionStage(affection: number): string {
  if (affection <= 20) return '初识'
  if (affection <= 50) return '熟悉'
  if (affection <= 80) return '信赖'
  return '羁绊'
}

function skillName(skill: SpiritData['base_skill']): string {
  return typeof skill.name === 'string' ? skill.name : '尚未记录'
}

function rarityLabel(rarity: string): string {
  return { common: '普通', uncommon: '少见', rare: '稀有' }[rarity] ?? rarity
}

function preferenceLabel(preference: string): string {
  return { favorite: '最喜欢', liked: '喜欢', neutral: '普通', disliked: '不喜欢' }[preference] ?? preference
}

function openSpirit(spiritId: number): void {
  selectedSpiritId.value = spiritId
  void game.loadGiftOptions(spiritId)
}
</script>

<template>
  <div class="drawer-backdrop" @click.self="$emit('close')">
    <aside class="collection-drawer" aria-label="冒险图鉴">
      <header><div><p class="eyebrow">ARCHIVE</p><h2>冒险图鉴</h2></div><button class="icon-button" type="button" aria-label="关闭图鉴" @click="$emit('close')"><X :size="20" /></button></header>
      <nav class="drawer-tabs" aria-label="图鉴分类">
        <button :class="{ active: tab === 'cards' }" type="button" @click="tab = 'cards'"><Layers3 :size="17" />卡牌</button>
        <button :class="{ active: tab === 'spirits' }" type="button" @click="tab = 'spirits'"><Sparkles :size="17" />卡灵</button>
        <button :class="{ active: tab === 'plants' }" type="button" @click="tab = 'plants'"><Leaf :size="17" />植物</button>
        <button :class="{ active: tab === 'deck' }" type="button" @click="tab = 'deck'"><BookOpen :size="17" />牌组</button>
      </nav>
      <section v-if="tab === 'spirits' && selectedSpirit" class="spirit-growth" role="tabpanel" aria-label="卡灵养成">
        <button class="growth-back" type="button" @click="selectedSpiritId = null"><ArrowLeft :size="17" />返回卡灵列表</button>
        <div class="growth-hero">
          <img :src="selectedSpirit.avatar || '/assets/generated/portraits/luna.webp'" alt="">
          <div><span class="rarity">{{ selectedSpirit.rarity }}</span><h3>{{ selectedSpirit.name }}</h3><p>{{ selectedSpirit.race }} · {{ selectedSpirit.type }}</p></div>
        </div>
        <div class="growth-stats">
          <div><span>等级</span><strong>Lv.{{ selectedSpirit.level }}</strong></div>
          <div><span>羁绊阶段</span><strong>{{ affectionStage(selectedSpirit.affection) }}</strong></div>
          <div><span>觉醒</span><strong>{{ selectedSpirit.awaken_level }}</strong></div>
        </div>
        <div class="growth-block">
          <div class="growth-label"><span>卡灵经验</span><strong>{{ selectedSpirit.exp }} / {{ selectedSpirit.level * 100 }}</strong></div>
          <div class="growth-track" role="progressbar" aria-label="卡灵经验" aria-valuemin="0" :aria-valuemax="selectedSpirit.level * 100" :aria-valuenow="selectedSpirit.exp"><i :style="{ width: `${Math.min(100, selectedSpirit.exp / (selectedSpirit.level * 100) * 100)}%` }" /></div>
          <button class="button primary" type="button" :disabled="game.actionLoading || selectedSpirit.exp < selectedSpirit.level * 100" @click="game.levelUpSpirit(selectedSpirit.id)"><TrendingUp :size="17" />{{ game.actionLoading ? '处理中…' : '提升等级' }}</button>
        </div>
        <div class="growth-block">
          <div class="growth-label"><span>羁绊</span><strong>{{ selectedSpirit.affection }} / 100</strong></div>
          <div class="growth-track affection" role="progressbar" aria-label="卡灵羁绊" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="selectedSpirit.affection"><i :style="{ width: `${selectedSpirit.affection}%` }" /></div>
          <button class="button ghost" type="button" :disabled="game.actionLoading || selectedSpirit.affection >= 100 || interactionCooldownSeconds > 0" @click="game.interactWithSpirit(selectedSpirit.id)"><Heart :size="17" />{{ interactionLabel }}</button>
          <small aria-live="polite">{{ interactionCooldownSeconds > 0 ? '交谈后需要稍作休息，倒计时结束即可再次互动。' : '每次交谈增加 1 点羁绊。' }}</small>
        </div>
        <div class="growth-block gift-block">
          <div class="growth-label"><span>赠送植物</span><strong>今日剩余 {{ game.giftOptions?.remaining_gifts ?? '—' }} 次</strong></div>
          <p v-if="game.lastGift" class="gift-dialogue"><Gift :size="16" />{{ game.lastGift.dialogue }} <b>羁绊 +{{ game.lastGift.affection_gained }}</b></p>
          <div v-if="game.giftOptions?.plants.length" class="gift-options">
            <button v-for="plant in game.giftOptions.plants" :key="plant.id" type="button" :disabled="game.actionLoading || selectedSpirit.affection >= 100 || !game.giftOptions.remaining_gifts" @click="game.givePlantGift(selectedSpirit.id, plant.id)">
              <span class="plant-symbol" :data-rarity="plant.rarity"><img v-if="plant.icon" :src="plant.icon" alt="" loading="lazy"><template v-else>{{ plant.name.slice(0, 1) }}</template></span>
              <span><strong>{{ plant.name }} ×{{ plant.amount }}</strong><small>{{ preferenceLabel(plant.preference) }} · 基础 +{{ plant.base_affection }}</small></span>
              <Gift :size="16" />
            </button>
          </div>
          <small v-else-if="game.actionLoading">正在查看背包…</small>
          <small v-else>背包里还没有植物，先去地图上采集吧。</small>
        </div>
        <div class="growth-story"><p class="eyebrow">SPIRIT STORY</p><p>{{ selectedSpirit.story }}</p><dl><div><dt>基础技能</dt><dd>{{ skillName(selectedSpirit.base_skill) }}</dd></div><div><dt>觉醒技能</dt><dd>{{ skillName(selectedSpirit.awakening_skill) }}</dd></div></dl></div>
      </section>
      <div v-else class="collection-grid" role="tabpanel">
        <button v-for="card in tab === 'cards' ? game.cards : []" :key="card.id" class="collection-item card" type="button" @click="selectedCard = card">
          <img class="collection-art" :src="card.source_spirit_id ? '/assets/generated/portraits/luna.webp' : '/assets/generated/cards/basic-attack.webp'" alt="">
          <span class="rarity">{{ card.rarity }}</span><strong>{{ card.name }}</strong><small>{{ card.type }} · 费用 {{ card.cost }}</small><p>持有 ×{{ card.count }}</p>
          <span class="spirit-open">查看详情</span>
        </button>
        <button v-for="spirit in tab === 'spirits' ? game.spirits : []" :key="spirit.id" class="collection-item spirit" type="button" @click="openSpirit(spirit.id)">
          <img class="collection-art" :src="spirit.avatar || '/assets/generated/portraits/luna.webp'" alt="">
          <span class="rarity">{{ spirit.rarity }}</span><strong>{{ spirit.name }}</strong><small>{{ spirit.race }} · Lv.{{ spirit.level }}</small><p>羁绊 {{ spirit.affection }}</p>
          <span class="spirit-open">查看养成</span>
        </button>
        <article v-for="fragment in tab === 'spirits' ? unownedFragments : []" :key="`fragment-${fragment.template_id}`" class="collection-item spirit-fragment">
          <img class="collection-art" :src="fragment.avatar || '/assets/generated/portraits/luna.webp'" alt="">
          <span class="rarity">{{ rarityLabel(fragment.rarity) }}</span><strong>{{ fragment.name }}</strong><small>{{ fragment.race }} · 尚未获得</small>
          <div class="fragment-progress">
            <div><span>卡灵碎片</span><strong>{{ fragment.fragment_count }} / {{ fragment.fragment_target }}</strong></div>
            <div class="fragment-track" role="progressbar" aria-label="卡灵碎片进度" aria-valuemin="0" :aria-valuemax="fragment.fragment_target" :aria-valuenow="fragment.fragment_count"><i :style="{ width: `${Math.min(100, fragment.fragment_count / fragment.fragment_target * 100)}%` }" /></div>
          </div>
          <button class="button primary fragment-compose" type="button" :disabled="game.actionLoading || !fragment.can_compose" @click="game.composeSpirit(fragment.template_id)">
            <Sparkles :size="16" />{{ fragment.can_compose ? '合成卡灵' : `还需 ${fragment.fragment_target - fragment.fragment_count} 枚` }}
          </button>
        </article>
        <article v-for="plant in tab === 'plants' ? game.plants : []" :key="plant.id" class="collection-item plant-item">
          <div class="plant-art" :data-rarity="plant.rarity"><img v-if="plant.icon" :src="plant.icon" alt="" loading="lazy"><template v-else><Leaf :size="34" /><span>{{ plant.name.slice(0, 1) }}</span></template></div>
          <span class="rarity">{{ rarityLabel(plant.rarity) }}</span><strong>{{ plant.name }}</strong>
          <small>{{ plant.tags.join(' · ') }} · 基础羁绊 +{{ plant.base_affection }}</small>
          <p>持有 ×{{ plant.amount }}</p><small>{{ plant.description }}</small>
        </article>
        <template v-if="tab === 'deck'">
          <article v-for="deck in game.decks" :key="deck.id" class="deck-item">
            <div><span class="rarity">{{ deck.is_active ? '使用中' : '备用' }}</span><h3>{{ deck.name }}</h3></div><strong>{{ deck.cards.reduce((sum, card) => sum + card.amount, 0) }} 张</strong>
            <ul><li v-for="card in deck.cards" :key="card.card_id">{{ card.name }} <span>×{{ card.amount }}</span></li></ul>
          </article>
        </template>
        <p v-if="(tab === 'cards' && !game.cards.length) || (tab === 'spirits' && !game.spirits.length && !unownedFragments.length) || (tab === 'plants' && !game.plants.length) || (tab === 'deck' && !game.decks.length)" class="empty-state">这里还没有记录，继续冒险吧。</p>
      </div>
    </aside>
    <CardDetailModal v-if="selectedCard" :card="selectedCard" @close="selectedCard = null" />
  </div>
</template>
