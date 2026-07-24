<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Droplets, Shield, Swords, X } from 'lucide-vue-next'
import type { CardData } from '@/api/types'

const props = withDefaults(defineProps<{
  card: CardData
  canUse?: boolean
  actionDisabled?: boolean
}>(), {
  canUse: false,
  actionDisabled: false,
})

const emit = defineEmits<{ close: []; use: [] }>()
const dialog = ref<HTMLElement | null>(null)
let previousFocus: HTMLElement | null = null

const typeLabel = computed(() => ({
  attack: '攻击',
  defense: '防御',
  skill: '技能',
}[props.card.type] ?? props.card.type))

const rarityLabel = computed(() => ({
  common: '普通',
  uncommon: '少见',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
}[props.card.rarity] ?? props.card.rarity))

const damage = computed(() => {
  const base = Number(props.card.effect.damage ?? 0)
  const perLevel = Number(props.card.upgrade.damage_per_level ?? 0)
  return Math.max(0, base + Math.max(0, props.card.level - 1) * perLevel)
})

const effectLines = computed(() => {
  const lines: string[] = []
  if (damage.value > 0) lines.push(`造成 ${damage.value} 点伤害`)

  const shield = Number(props.card.effect.shield ?? 0)
  if (shield > 0) lines.push(`获得 ${shield} 点护盾`)

  const healing = Number(props.card.effect.heal ?? 0)
  if (healing > 0) lines.push(`恢复 ${healing} 点生命`)

  const draw = Number(props.card.effect.draw ?? 0)
  if (draw > 0) lines.push(`抽取 ${draw} 张卡牌`)

  return lines.length ? lines : ['施放卡牌效果']
})

const upgradeLine = computed(() => {
  const perLevel = Number(props.card.upgrade.damage_per_level ?? 0)
  return perLevel > 0 ? `每提升 1 级，伤害增加 ${perLevel} 点` : '当前没有额外升级效果'
})

function close(): void {
  emit('close')
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key !== 'Tab' || !dialog.value) return

  const controls = [...dialog.value.querySelectorAll<HTMLElement>('button:not(:disabled)')]
  if (!controls.length) return
  const first = controls[0]
  const last = controls[controls.length - 1]

  if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.value)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

onMounted(() => {
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  void nextTick(() => dialog.value?.focus())
})

onBeforeUnmount(() => {
  previousFocus?.focus()
})
</script>

<template>
  <Teleport to="body">
    <div class="card-detail-backdrop" @click.self="close">
      <section
        ref="dialog"
        class="card-detail-modal"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="`card-detail-${card.id}`"
        tabindex="-1"
        @keydown="handleKeydown"
      >
        <button class="icon-button card-detail-close" type="button" aria-label="关闭卡牌详情" @click="close">
          <X :size="20" />
        </button>

        <div class="card-detail-art">
          <img :src="card.source_spirit_id ? '/assets/generated/portraits/luna.webp' : '/assets/generated/cards/basic-attack.webp'" alt="">
          <span class="card-detail-cost" aria-label="费用">
            <Droplets :size="16" />{{ card.cost }}
          </span>
          <span class="card-detail-sigil">
            <Shield v-if="card.type === 'defense'" :size="44" />
            <Swords v-else :size="44" />
          </span>
        </div>

        <div class="card-detail-content">
          <p class="eyebrow">CARD DETAIL</p>
          <div class="card-detail-title">
            <div>
              <h2 :id="`card-detail-${card.id}`">{{ card.name }}</h2>
              <p>{{ rarityLabel }} · {{ typeLabel }}</p>
            </div>
            <span>Lv.{{ card.level }}</span>
          </div>

          <div class="card-detail-stats" aria-label="卡牌属性">
            <div><span>费用</span><strong>{{ card.cost }}</strong></div>
            <div><span>等级</span><strong>{{ card.level }}</strong></div>
            <div><span>持有</span><strong>×{{ card.count }}</strong></div>
          </div>

          <div class="card-effect-block">
            <span>具体效果</span>
            <strong v-for="line in effectLines" :key="line">{{ line }}</strong>
            <small>{{ upgradeLine }}</small>
          </div>

          <div class="card-detail-actions">
            <button class="button ghost" type="button" @click="close">关闭</button>
            <button v-if="canUse" class="button primary" type="button" :disabled="actionDisabled" @click="emit('use')">
              <Swords :size="18" />{{ actionDisabled ? '当前无法使用' : '使用卡牌' }}
            </button>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>
