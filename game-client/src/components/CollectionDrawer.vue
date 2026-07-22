<script setup lang="ts">
import { ref } from 'vue'
import { BookOpen, Layers3, Sparkles, X } from 'lucide-vue-next'
import { useGameStore } from '@/stores/game'

defineEmits<{ close: [] }>()
const game = useGameStore()
const tab = ref<'cards' | 'spirits' | 'deck'>('cards')
</script>

<template>
  <div class="drawer-backdrop" @click.self="$emit('close')">
    <aside class="collection-drawer" aria-label="冒险图鉴">
      <header><div><p class="eyebrow">ARCHIVE</p><h2>冒险图鉴</h2></div><button class="icon-button" type="button" aria-label="关闭图鉴" @click="$emit('close')"><X :size="20" /></button></header>
      <nav class="drawer-tabs" aria-label="图鉴分类">
        <button :class="{ active: tab === 'cards' }" type="button" @click="tab = 'cards'"><Layers3 :size="17" />卡牌</button>
        <button :class="{ active: tab === 'spirits' }" type="button" @click="tab = 'spirits'"><Sparkles :size="17" />卡灵</button>
        <button :class="{ active: tab === 'deck' }" type="button" @click="tab = 'deck'"><BookOpen :size="17" />牌组</button>
      </nav>
      <div class="collection-grid" role="tabpanel">
        <article v-for="card in tab === 'cards' ? game.cards : []" :key="card.id" class="collection-item">
          <img class="collection-art" :src="card.source_spirit_id ? '/assets/generated/portraits/luna.webp' : '/assets/generated/cards/basic-attack.webp'" alt="">
          <span class="rarity">{{ card.rarity }}</span><strong>{{ card.name }}</strong><small>{{ card.type }} · 费用 {{ card.cost }}</small><p>持有 ×{{ card.count }}</p>
        </article>
        <article v-for="spirit in tab === 'spirits' ? game.spirits : []" :key="spirit.id" class="collection-item spirit">
          <img class="collection-art" :src="spirit.avatar || '/assets/generated/portraits/luna.webp'" alt="">
          <span class="rarity">{{ spirit.rarity }}</span><strong>{{ spirit.name }}</strong><small>{{ spirit.race }} · Lv.{{ spirit.level }}</small><p>羁绊 {{ spirit.affection }}</p>
        </article>
        <template v-if="tab === 'deck'">
          <article v-for="deck in game.decks" :key="deck.id" class="deck-item">
            <div><span class="rarity">{{ deck.is_active ? '使用中' : '备用' }}</span><h3>{{ deck.name }}</h3></div><strong>{{ deck.cards.reduce((sum, card) => sum + card.amount, 0) }} 张</strong>
            <ul><li v-for="card in deck.cards" :key="card.card_id">{{ card.name }} <span>×{{ card.amount }}</span></li></ul>
          </article>
        </template>
        <p v-if="(tab === 'cards' && !game.cards.length) || (tab === 'spirits' && !game.spirits.length) || (tab === 'deck' && !game.decks.length)" class="empty-state">这里还没有记录，继续冒险吧。</p>
      </div>
    </aside>
  </div>
</template>
