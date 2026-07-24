import { nextTick, reactive, readonly } from 'vue'

export type DialogTone = 'info' | 'warning' | 'danger'

export interface DialogOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: DialogTone
  dismissible?: boolean
}

interface PendingDialog {
  options: DialogOptions
  resolve: (confirmed: boolean) => void
}

const state = reactive({
  open: false,
  title: '',
  message: '',
  confirmLabel: '确定',
  cancelLabel: '',
  tone: 'info' as DialogTone,
  dismissible: true,
})

const queue: PendingDialog[] = []
let activeDialog: PendingDialog | null = null
let closing = false

function presentNext(): void {
  if (activeDialog || closing || !queue.length) return
  activeDialog = queue.shift() ?? null
  if (!activeDialog) return

  const { options } = activeDialog
  state.title = options.title
  state.message = options.message
  state.confirmLabel = options.confirmLabel ?? '确定'
  state.cancelLabel = options.cancelLabel ?? ''
  state.tone = options.tone ?? 'info'
  state.dismissible = options.dismissible ?? true
  state.open = true
}

export const dialogState = readonly(state)

export function showDialog(options: DialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    queue.push({ options, resolve })
    presentNext()
  })
}

export function confirmDialog(options: DialogOptions): Promise<boolean> {
  return showDialog({
    confirmLabel: '确认',
    cancelLabel: '取消',
    tone: 'warning',
    ...options,
  })
}

export function resolveDialog(confirmed: boolean): void {
  if (!activeDialog) return

  const completedDialog = activeDialog
  activeDialog = null
  closing = true
  state.open = false
  completedDialog.resolve(confirmed)
  void nextTick(() => {
    closing = false
    presentNext()
  })
}

export function dismissDialog(): void {
  if (!state.dismissible) return
  resolveDialog(state.cancelLabel ? false : true)
}
