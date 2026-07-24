<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { AlertTriangle, CircleAlert, Info, X } from 'lucide-vue-next'
import { dialogState, dismissDialog, resolveDialog } from '@/services/dialog'

const dialogRoot = ref<HTMLElement | null>(null)
const cancelButton = ref<HTMLButtonElement | null>(null)
const confirmButton = ref<HTMLButtonElement | null>(null)
let previousFocus: HTMLElement | null = null

const titleId = 'app-dialog-title'
const messageId = 'app-dialog-message'
const hasCancelAction = computed(() => Boolean(dialogState.cancelLabel))
const dialogRole = computed(() => dialogState.tone === 'info' ? 'dialog' : 'alertdialog')

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    dismissDialog()
    return
  }
  if (event.key !== 'Tab' || !dialogRoot.value) return

  const controls = [...dialogRoot.value.querySelectorAll<HTMLElement>('button:not(:disabled)')]
  if (!controls.length) return
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

watch(() => dialogState.open, async (open) => {
  if (open) {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    await nextTick()
    const initialFocus = hasCancelAction.value ? cancelButton.value : confirmButton.value
    initialFocus?.focus()
    return
  }

  previousFocus?.focus()
  previousFocus = null
})
</script>

<template>
  <Teleport to="body">
    <div v-if="dialogState.open" class="app-dialog-backdrop" @click.self="dismissDialog">
      <section
        ref="dialogRoot"
        class="app-dialog"
        :class="`app-dialog-${dialogState.tone}`"
        :role="dialogRole"
        aria-modal="true"
        :aria-labelledby="titleId"
        :aria-describedby="messageId"
        tabindex="-1"
        @keydown="handleKeydown"
      >
        <button
          v-if="dialogState.dismissible"
          class="icon-button app-dialog-close"
          type="button"
          aria-label="关闭弹窗"
          title="关闭"
          @click="dismissDialog"
        >
          <X :size="19" />
        </button>

        <div class="app-dialog-icon" aria-hidden="true">
          <CircleAlert v-if="dialogState.tone === 'danger'" :size="27" />
          <AlertTriangle v-else-if="dialogState.tone === 'warning'" :size="27" />
          <Info v-else :size="27" />
        </div>

        <div class="app-dialog-copy">
          <h2 :id="titleId">{{ dialogState.title }}</h2>
          <p :id="messageId">{{ dialogState.message }}</p>
        </div>

        <div class="app-dialog-actions">
          <button
            v-if="hasCancelAction"
            ref="cancelButton"
            class="button ghost"
            type="button"
            @click="resolveDialog(false)"
          >
            {{ dialogState.cancelLabel }}
          </button>
          <button
            ref="confirmButton"
            class="button"
            :class="dialogState.tone === 'danger' ? 'danger' : 'primary'"
            type="button"
            @click="resolveDialog(true)"
          >
            {{ dialogState.confirmLabel }}
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>
