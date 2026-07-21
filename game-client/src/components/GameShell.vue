<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { BookOpen, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Coins, Heart, LogOut, Save, Sparkles, Swords } from 'lucide-vue-next'
import BattlePanel from '@/components/BattlePanel.vue'
import CollectionDrawer from '@/components/CollectionDrawer.vue'
import DialogModal from '@/components/DialogModal.vue'
import { WorldGame } from '@/game/Game'
import { gameEvents } from '@/game/events'
import { useGameStore } from '@/stores/game'

defineEmits<{ logout: [] }>()
const game = useGameStore()
const canvasHost = ref<HTMLElement | null>(null)
const nearNpc = ref<{ id: number; name: string } | null>(null)
const drawerOpen = ref(false)
let world: WorldGame | null = null
let saveTimer: number | null = null

const hpPercent = computed(() => game.player ? Math.max(0, game.player.hp / 100 * 100) : 0)
const isBattle = computed(() => Boolean(game.battle))

const onNear = (npc: { id: number | null; name: string | null }): void => { nearNpc.value = npc.id && npc.name ? { id: npc.id, name: npc.name } : null }
const onInteract = ({ id }: { id: number }): void => { void game.openNpc(id) }
const onMoved = ({ x, y }: { x: number; y: number }): void => {
  if (saveTimer) window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => { void game.savePosition(x, y) }, 800)
}

function direction(x: number, y: number): void { gameEvents.emit('input:direction', { x, y }) }
function stopDirection(): void { direction(0, 0) }
function interact(): void { gameEvents.emit('input:interact', undefined) }
async function beginBattle(id: number): Promise<void> {
  try {
    await game.startBattle(id)
    if (game.battle) gameEvents.emit('scene:battle', { enemyName: game.battle.enemy_state.name })
  } catch { /* store presents the error */ }
}

onMounted(() => {
  if (canvasHost.value && game.map && game.player) world = new WorldGame(canvasHost.value, game.map, game.player)
  gameEvents.on('npc:near', onNear)
  gameEvents.on('npc:interact', onInteract)
  gameEvents.on('player:moved', onMoved)
  if (game.battle) gameEvents.emit('scene:battle', { enemyName: game.battle.enemy_state.name })
})

onBeforeUnmount(() => {
  if (saveTimer) window.clearTimeout(saveTimer)
  gameEvents.off('npc:near', onNear)
  gameEvents.off('npc:interact', onInteract)
  gameEvents.off('player:moved', onMoved)
  world?.destroy()
})
</script>

<template>
  <section class="game-shell">
    <div ref="canvasHost" class="game-canvas" aria-label="游戏世界画面" />

    <header v-if="!isBattle" class="world-hud">
      <div class="player-chip glass-panel">
        <div class="avatar"><Sparkles :size="21" /></div>
        <div class="player-info"><div><strong>{{ game.player?.name }}</strong><span>Lv.{{ game.player?.level }}</span></div><div class="mini-hp"><i :style="{ width: `${hpPercent}%` }" /></div></div>
      </div>
      <div class="hud-actions glass-panel">
        <span class="currency"><Coins :size="18" />{{ game.player?.gold }}</span>
        <button class="icon-button" type="button" aria-label="保存进度" title="保存进度" :disabled="game.actionLoading" @click="game.saveGame"><Save :size="19" /></button>
        <button class="icon-button" type="button" aria-label="打开冒险图鉴" title="冒险图鉴" @click="drawerOpen = true"><BookOpen :size="19" /></button>
        <button class="icon-button" type="button" aria-label="退出登录" title="退出登录" @click="$emit('logout')"><LogOut :size="19" /></button>
      </div>
    </header>

    <div v-if="!isBattle" class="quest-card glass-panel">
      <span><Heart :size="16" />当前旅程</span><strong>探索晨雾森林</strong><small>靠近林中居民，按 E 与其交谈</small>
    </div>

    <div v-if="!isBattle && nearNpc" class="interaction-hint" role="status">
      <button type="button" @click="interact"><kbd>E</kbd><span>与 {{ nearNpc.name }} 交谈</span></button>
    </div>

    <div v-if="!isBattle" class="mobile-controls" aria-label="移动控制">
      <button class="up" type="button" aria-label="向上移动" @pointerdown="direction(0, -1)" @pointerup="stopDirection" @pointerleave="stopDirection"><ChevronUp /></button>
      <button class="left" type="button" aria-label="向左移动" @pointerdown="direction(-1, 0)" @pointerup="stopDirection" @pointerleave="stopDirection"><ChevronLeft /></button>
      <button class="down" type="button" aria-label="向下移动" @pointerdown="direction(0, 1)" @pointerup="stopDirection" @pointerleave="stopDirection"><ChevronDown /></button>
      <button class="right" type="button" aria-label="向右移动" @pointerdown="direction(1, 0)" @pointerup="stopDirection" @pointerleave="stopDirection"><ChevronRight /></button>
      <button class="mobile-interact" type="button" aria-label="互动" @click="interact"><Swords /></button>
    </div>

    <BattlePanel v-if="game.battle" />
    <DialogModal v-if="game.dialogNpc" :npc="game.dialogNpc" :loading="game.actionLoading" @close="game.closeDialog" @battle="beginBattle" />
    <CollectionDrawer v-if="drawerOpen" @close="drawerOpen = false" />
    <p v-if="game.error" class="toast error" role="alert">{{ game.error }}</p>
    <p v-if="game.notice" class="toast" role="status">{{ game.notice }}</p>
  </section>
</template>
