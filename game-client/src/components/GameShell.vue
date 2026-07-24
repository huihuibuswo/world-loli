<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { BookOpen, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Coins, Heart, LogOut, Save, Swords } from 'lucide-vue-next'
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
const nearPortal = ref<{ mapId: number; name: string; label: string } | null>(null)
const nearPlant = ref<{ nodeId: string; name: string; rarity: string } | null>(null)
const collectingPlant = ref<string | null>(null)
const transitionTarget = ref('')
const drawerOpen = ref(false)
let world: WorldGame | null = null
let saveTimer: number | null = null

const hpPercent = computed(() => game.player ? Math.max(0, game.player.hp / 100 * 100) : 0)
const isBattle = computed(() => Boolean(game.battle))
const currentMapName = computed(() => game.map?.map_name || '晨曦村')
const rarityLabel = (rarity: string): string => ({
  common: '普通',
  uncommon: '少见',
  rare: '稀有',
})[rarity] ?? '普通'

watch(isBattle, (next) => {
  if (next && game.battle) {
    gameEvents.emit('scene:battle', {
      enemyName: game.battle.enemy_state.name,
      enemySprite: game.battle.enemy_state.sprite,
    })
  } else {
    gameEvents.emit('scene:world', undefined)
  }
})

watch([() => Boolean(game.dialogNpc), drawerOpen], ([dialogOpen, collectionOpen]) => {
  gameEvents.emit('world:input-lock', { locked: dialogOpen || collectionOpen })
})

const onNear = (npc: { id: number | null; name: string | null }): void => { nearNpc.value = npc.id && npc.name ? { id: npc.id, name: npc.name } : null }
const onPortalNear = (portal: { mapId: number | null; name: string | null; label: string | null }): void => {
  nearPortal.value = portal.mapId && portal.name
    ? { mapId: portal.mapId, name: portal.name, label: portal.label || `前往${portal.name}` }
    : null
}
const onInteract = ({ id }: { id: number }): void => { void game.openNpc(id) }
const onPlantNear = (plant: { nodeId: string | null; name: string | null; rarity: string | null }): void => {
  nearPlant.value = plant.nodeId && plant.name && plant.rarity
    ? { nodeId: plant.nodeId, name: plant.name, rarity: plant.rarity }
    : null
}
const onPlantInteract = async ({ nodeId }: { nodeId: string; name: string }): Promise<void> => {
  if (game.actionLoading || collectingPlant.value) return
  collectingPlant.value = nodeId
  gameEvents.emit('world:input-lock', { locked: true })
  try {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 600))
    const result = await game.collectPlant(nodeId)
    if (result) gameEvents.emit('plant:collected', { nodeId, availableAt: result.available_at })
  } finally {
    collectingPlant.value = null
    gameEvents.emit('world:input-lock', { locked: Boolean(game.dialogNpc) || drawerOpen.value })
  }
}
const onPortalInteract = async ({ mapId, name }: { mapId: number; name: string }): Promise<void> => {
  if (game.mapLoading) return
  if (saveTimer) {
    window.clearTimeout(saveTimer)
    saveTimer = null
  }
  transitionTarget.value = name
  gameEvents.emit('world:input-lock', { locked: true })
  try {
    await game.enterMap(mapId)
    if (game.map && game.player) world?.changeMap(game.map, game.player)
  } catch { /* store presents the error */ }
  finally {
    gameEvents.emit('world:input-lock', { locked: false })
  }
}
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
  } catch { /* store presents the error */ }
}

onMounted(() => {
  if (canvasHost.value && game.map && game.player) world = new WorldGame(canvasHost.value, game.map, game.player)
  gameEvents.emit('world:input-lock', { locked: Boolean(game.dialogNpc) })
  gameEvents.on('npc:near', onNear)
  gameEvents.on('npc:interact', onInteract)
  gameEvents.on('plant:near', onPlantNear)
  gameEvents.on('plant:interact', onPlantInteract)
  gameEvents.on('portal:near', onPortalNear)
  gameEvents.on('portal:interact', onPortalInteract)
  gameEvents.on('player:moved', onMoved)
  if (game.battle) {
    gameEvents.emit('scene:battle', {
      enemyName: game.battle.enemy_state.name,
      enemySprite: game.battle.enemy_state.sprite,
    })
  }
})

onBeforeUnmount(() => {
  if (saveTimer) window.clearTimeout(saveTimer)
  gameEvents.off('npc:near', onNear)
  gameEvents.off('npc:interact', onInteract)
  gameEvents.off('plant:near', onPlantNear)
  gameEvents.off('plant:interact', onPlantInteract)
  gameEvents.off('portal:near', onPortalNear)
  gameEvents.off('portal:interact', onPortalInteract)
  gameEvents.off('player:moved', onMoved)
  world?.destroy()
})
</script>

<template>
  <section class="game-shell">
    <div ref="canvasHost" class="game-canvas" aria-label="游戏世界画面" />

    <header v-if="!isBattle" class="world-hud">
      <div class="player-chip glass-panel">
        <div class="avatar"><img :src="`/assets/generated/sprites/adventurer-${game.player?.avatar_gender ?? 'female'}.png`" alt=""></div>
        <div class="player-info"><div><strong>{{ game.player?.name }}</strong><span>Lv.{{ game.player?.level }}</span></div><div class="mini-hp"><i :style="{ width: `${hpPercent}%` }" /></div></div>
      </div>
      <div class="hud-actions glass-panel">
        <span class="currency"><Coins :size="18" />{{ game.player?.gold }}</span>
        <button class="icon-button" type="button" aria-label="保存进度" title="保存进度" :disabled="game.actionLoading" @click="game.saveGame"><Save :size="19" /></button>
        <button class="icon-button" type="button" aria-label="打开冒险图鉴" title="冒险图鉴" @click="drawerOpen = true"><BookOpen :size="19" /></button>
        <button class="icon-button" type="button" aria-label="退出登录" title="退出登录" @click="$emit('logout')"><LogOut :size="19" /></button>
      </div>
    </header>

    <aside v-if="!isBattle" class="minimap-frame" role="img" :aria-label="`${currentMapName}小地图`" />

    <div v-if="!isBattle" class="quest-card glass-panel">
      <span><Heart :size="16" />当前地图</span><strong>{{ currentMapName }}</strong><small>探索植物、居民与地图出口，按 E 互动</small>
    </div>

    <div v-if="!isBattle && !game.dialogNpc && !drawerOpen && (nearPlant || nearPortal || nearNpc)" class="interaction-hint" role="status">
      <button type="button" :disabled="game.mapLoading || game.actionLoading || Boolean(collectingPlant)" @click="interact">
        <kbd>E</kbd><span>{{ collectingPlant && nearPlant ? '采集中…' : nearPlant ? `采集「${nearPlant.name}」· ${rarityLabel(nearPlant.rarity)}` : nearPortal ? nearPortal.label : `与 ${nearNpc?.name} 交谈` }}</span>
      </button>
    </div>

    <div v-if="!isBattle" class="mobile-controls" aria-label="移动控制">
      <button class="up" type="button" aria-label="向上移动" @pointerdown="direction(0, -1)" @pointerup="stopDirection" @pointerleave="stopDirection"><ChevronUp /></button>
      <button class="left" type="button" aria-label="向左移动" @pointerdown="direction(-1, 0)" @pointerup="stopDirection" @pointerleave="stopDirection"><ChevronLeft /></button>
      <button class="down" type="button" aria-label="向下移动" @pointerdown="direction(0, 1)" @pointerup="stopDirection" @pointerleave="stopDirection"><ChevronDown /></button>
      <button class="right" type="button" aria-label="向右移动" @pointerdown="direction(1, 0)" @pointerup="stopDirection" @pointerleave="stopDirection"><ChevronRight /></button>
      <button class="mobile-interact" type="button" aria-label="互动" :disabled="game.mapLoading || game.actionLoading || Boolean(collectingPlant)" @click="interact"><Swords /></button>
    </div>

    <BattlePanel v-if="game.battle" />
    <DialogModal
      v-if="game.dialogNpc"
      :npc="game.dialogNpc"
      :chat="game.npcChat"
      :loading="game.actionLoading"
      :chat-loading="game.chatLoading"
      :send-message="game.sendNpcChat"
      :affection="game.npcAffection"
      :gift-options="game.npcGiftOptions"
      :last-gift="game.npcLastGift"
      :service="game.npcService"
      :give-gift="game.giveNpcGift"
      :purchase-item="game.purchaseNpcItem"
      :upgrade-card="game.upgradeNpcCard"
      :accept-quest="game.acceptNpcQuest"
      @close="game.closeDialog"
      @battle="beginBattle"
    />
    <CollectionDrawer v-if="drawerOpen" @close="drawerOpen = false" />
    <div v-if="game.mapLoading" class="map-transition" role="status" aria-live="polite">
      <div class="loader" />
      <strong>正在前往{{ transitionTarget }}</strong>
    </div>
    <p v-if="game.error" class="toast error" role="alert">{{ game.error }}</p>
    <p v-if="game.notice" class="toast" role="status">{{ game.notice }}</p>
  </section>
</template>
