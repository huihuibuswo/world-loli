<script setup lang="ts">
import { Swords, X } from 'lucide-vue-next'
import type { NpcData } from '@/api/types'

defineProps<{ npc: NpcData; loading: boolean }>()
defineEmits<{ close: []; battle: [id: number] }>()
</script>

<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <section class="dialog-card" role="dialog" aria-modal="true" :aria-labelledby="`npc-${npc.id}`">
      <button class="icon-button close" type="button" aria-label="关闭对话" @click="$emit('close')"><X :size="20" /></button>
      <div class="npc-portrait" aria-hidden="true"><span>{{ npc.name.slice(0, 1) }}</span></div>
      <p class="eyebrow">{{ npc.type === 'enemy' ? '林间挑战者' : '旅途相遇' }}</p>
      <h2 :id="`npc-${npc.id}`">{{ npc.name }}</h2>
      <p class="dialog-story">{{ npc.story || '风掠过树梢，对方正静静等待你的回应。' }}</p>
      <div class="dialog-actions">
        <button class="button primary" type="button" :disabled="loading" @click="$emit('battle', npc.id)">
          <Swords :size="19" aria-hidden="true" />{{ loading ? '准备中…' : '接受挑战' }}
        </button>
        <button class="button ghost" type="button" @click="$emit('close')">暂时离开</button>
      </div>
    </section>
  </div>
</template>
