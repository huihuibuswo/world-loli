<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ChevronDown, DoorOpen, Swords } from 'lucide-vue-next'
import type { NpcData } from '@/api/types'

const props = defineProps<{ npc: NpcData; loading: boolean }>()
const emit = defineEmits<{ close: []; battle: [id: number] }>()

const lineIndex = ref(0)
const portraitSrc = ref('')
const dialogRoot = ref<HTMLElement | null>(null)
const lines = computed(() => props.npc.dialogue?.length
  ? props.npc.dialogue
  : [props.npc.story || '风掠过树梢，对方正静静等待你的回应。'])
const conversationComplete = computed(() => lineIndex.value >= lines.value.length)
const currentLine = computed(() => lines.value[Math.min(lineIndex.value, lines.value.length - 1)])
const canBattle = computed(() => (props.npc.actions ?? []).includes('battle'))
const fallbackPortrait = computed(() => `/assets/generated/sprites/${props.npc.sprite || 'npc-trainer'}.png`)
const roleLabel = computed(() => ({
  shop: '晨曦杂货商',
  craft: '村庄锻造师',
  quest: '森林引路人',
  training: '实战教官',
  dialogue: '晨曦村村长',
}[props.npc.type] ?? '旅途相遇'))

function resetConversation(): void {
  lineIndex.value = 0
  portraitSrc.value = props.npc.portrait || fallbackPortrait.value
  void nextTick(() => dialogRoot.value?.focus())
}

function advance(): void {
  if (!conversationComplete.value) {
    lineIndex.value += 1
    if (conversationComplete.value) {
      void nextTick(() => dialogRoot.value?.querySelector<HTMLButtonElement>('button')?.focus())
    }
  }
}

function useFallbackPortrait(): void {
  if (portraitSrc.value !== fallbackPortrait.value) portraitSrc.value = fallbackPortrait.value
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    emit('close')
    return
  }
  if (event.key !== 'Tab' || !dialogRoot.value) return
  const controls = [...dialogRoot.value.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
  if (!controls.length) {
    event.preventDefault()
    return
  }
  const first = controls[0]
  const last = controls[controls.length - 1]
  if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRoot.value)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(() => props.npc.id, resetConversation)
onMounted(() => {
  resetConversation()
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="gal-dialog-backdrop">
    <section ref="dialogRoot" class="gal-dialog" role="dialog" aria-modal="true" :aria-labelledby="`npc-${npc.id}`" tabindex="-1">
      <div class="gal-portrait-stage">
        <img :src="portraitSrc" :alt="`${npc.name}的角色立绘`" @error="useFallbackPortrait">
      </div>

      <div class="gal-dialog-panel">
        <header class="gal-speaker">
          <div><p class="eyebrow">{{ roleLabel }}</p><h2 :id="`npc-${npc.id}`">{{ npc.name }}</h2></div>
          <span v-if="!conversationComplete" aria-label="对话进度">{{ lineIndex + 1 }} / {{ lines.length }}</span>
        </header>

        <button v-if="!conversationComplete" class="gal-advance" type="button" @click="advance">
          <span class="gal-dialog-text" aria-live="polite">{{ currentLine }}</span>
          <small>点击继续 <ChevronDown :size="18" aria-hidden="true" /></small>
        </button>

        <div v-else class="gal-choice-stage">
          <p>交谈告一段落。你准备如何回应？</p>
          <div class="gal-choices">
            <button class="button ghost" type="button" @click="$emit('close')"><DoorOpen :size="19" aria-hidden="true" />离开</button>
            <button v-if="canBattle" class="button primary" type="button" :disabled="loading" @click="$emit('battle', npc.id)">
              <Swords :size="19" aria-hidden="true" />{{ loading ? '准备中…' : '对战' }}
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
