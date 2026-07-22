<script setup lang="ts">
import { computed } from 'vue'
import { Swords, X } from 'lucide-vue-next'
import type { NpcData } from '@/api/types'

const props = defineProps<{ npc: NpcData; loading: boolean }>()
defineEmits<{ close: []; battle: [id: number] }>()

const portrait = computed(() => `/assets/generated/sprites/${props.npc.sprite || 'training-dummy'}.png`)
const canBattle = computed(() => (props.npc.actions ?? []).includes('battle'))
const roleLabel = computed(() => ({
  shop: '晨曦杂货商',
  craft: '村庄锻造师',
  quest: '森林引路人',
  training: '新手训练',
  dialogue: '晨曦村居民',
}[props.npc.type] ?? '旅途相遇'))
</script>

<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <section class="dialog-card" role="dialog" aria-modal="true" :aria-labelledby="`npc-${npc.id}`">
      <button class="icon-button close" type="button" aria-label="关闭对话" @click="$emit('close')"><X :size="20" /></button>
      <div class="npc-portrait" aria-hidden="true"><img :src="portrait" alt=""></div>
      <p class="eyebrow">{{ roleLabel }}</p>
      <h2 :id="`npc-${npc.id}`">{{ npc.name }}</h2>
      <p class="dialog-story">{{ npc.story || '风掠过树梢，对方正静静等待你的回应。' }}</p>
      <div class="dialog-actions">
        <button v-if="canBattle" class="button primary" type="button" :disabled="loading" @click="$emit('battle', npc.id)">
          <Swords :size="19" aria-hidden="true" />{{ loading ? '准备中…' : '接受挑战' }}
        </button>
        <button class="button ghost" type="button" @click="$emit('close')">暂时离开</button>
      </div>
    </section>
  </div>
</template>
