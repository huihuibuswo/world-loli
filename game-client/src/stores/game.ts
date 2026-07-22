import { computed, ref } from 'vue'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { api, errorMessage, requestData } from '@/api/client'
import type {
  BattleData,
  CardData,
  DeckData,
  MapData,
  NpcData,
  PlayerProfile,
  SpiritData,
} from '@/api/types'

export const useGameStore = defineStore('game', () => {
  const player = ref<PlayerProfile | null>(null)
  const map = ref<MapData | null>(null)
  const cards = ref<CardData[]>([])
  const decks = ref<DeckData[]>([])
  const spirits = ref<SpiritData[]>([])
  const battle = ref<BattleData | null>(null)
  const dialogNpc = ref<NpcData | null>(null)
  const loading = ref(false)
  const actionLoading = ref(false)
  const error = ref('')
  const notice = ref('')

  const cardById = computed(() => new Map(cards.value.map((card) => [card.id, card])))
  const activeDeck = computed(() => decks.value.find((deck) => deck.is_active) ?? null)
  let noticeTimer: number | null = null

  function showNotice(message: string): void {
    notice.value = message
    if (noticeTimer) window.clearTimeout(noticeTimer)
    noticeTimer = window.setTimeout(() => {
      notice.value = ''
      noticeTimer = null
    }, 3000)
  }

  function replaceSpirit(nextSpirit: SpiritData): void {
    const index = spirits.value.findIndex((spirit) => spirit.id === nextSpirit.id)
    if (index >= 0) spirits.value[index] = nextSpirit
  }

  function normalizePlayer(profile: PlayerProfile): PlayerProfile {
    return {
      ...profile,
      avatar_gender: profile.avatar_gender === 'male' ? 'male' : 'female',
    }
  }

  async function refreshCollections(): Promise<void> {
    const [nextCards, nextDecks, nextSpirits] = await Promise.all([
      requestData<CardData[]>(api.get('/cards')),
      requestData<DeckData[]>(api.get('/decks')),
      requestData<SpiritData[]>(api.get('/spirits')),
    ])
    cards.value = nextCards
    decks.value = nextDecks
    spirits.value = nextSpirits
  }

  async function bootstrap(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      player.value = normalizePlayer(await requestData<PlayerProfile>(api.get('/player/profile')))
      if (player.value.current_map) {
        map.value = await requestData<MapData>(api.get(`/map/${player.value.current_map}`))
      }
      await refreshCollections()
      const savedBattleId = sessionStorage.getItem('world_battle_id')
      if (savedBattleId) {
        try {
          const current = await requestData<BattleData>(api.get(`/battle/${savedBattleId}`))
          battle.value = current.status === 'active' ? current : null
          if (!battle.value) sessionStorage.removeItem('world_battle_id')
        } catch {
          sessionStorage.removeItem('world_battle_id')
        }
      }
    } catch (cause) {
      error.value = errorMessage(cause)
      throw cause
    } finally {
      loading.value = false
    }
  }

  async function openNpc(npcId: number): Promise<void> {
    actionLoading.value = true
    error.value = ''
    try {
      dialogNpc.value = await requestData<NpcData>(api.get(`/npc/${npcId}`))
    } catch (cause) {
      error.value = errorMessage(cause)
    } finally {
      actionLoading.value = false
    }
  }

  function closeDialog(): void {
    dialogNpc.value = null
  }

  async function startBattle(enemyId: number): Promise<void> {
    actionLoading.value = true
    error.value = ''
    try {
      battle.value = await requestData<BattleData>(api.post('/battle/create', { enemy_id: enemyId }))
      sessionStorage.setItem('world_battle_id', String(battle.value.battle_id))
      dialogNpc.value = null
    } catch (cause) {
      error.value = errorMessage(cause)
      throw cause
    } finally {
      actionLoading.value = false
    }
  }

  async function playCard(cardId: number): Promise<void> {
    if (!battle.value) return
    actionLoading.value = true
    error.value = ''
    try {
      battle.value = await requestData<BattleData>(
        api.post(`/battle/${battle.value.battle_id}/play-card`, {
          card_id: cardId,
          expected_version: battle.value.version,
        }),
      )
      if (battle.value.status !== 'active') await refreshCollections()
    } catch (cause) {
      error.value = errorMessage(cause)
      await refreshBattle()
    } finally {
      actionLoading.value = false
    }
  }

  async function endTurn(): Promise<void> {
    if (!battle.value) return
    actionLoading.value = true
    error.value = ''
    try {
      battle.value = await requestData<BattleData>(
        api.post(`/battle/${battle.value.battle_id}/end-turn`, {
          expected_version: battle.value.version,
        }),
      )
    } catch (cause) {
      error.value = errorMessage(cause)
      await refreshBattle()
    } finally {
      actionLoading.value = false
    }
  }

  async function refreshBattle(): Promise<void> {
    if (!battle.value) return
    try {
      battle.value = await requestData<BattleData>(api.get(`/battle/${battle.value.battle_id}`))
    } catch {
      battle.value = null
      sessionStorage.removeItem('world_battle_id')
    }
  }

  async function leaveBattle(): Promise<void> {
    battle.value = null
    sessionStorage.removeItem('world_battle_id')
    player.value = normalizePlayer(await requestData<PlayerProfile>(api.get('/player/profile')))
    await refreshCollections()
  }

  async function savePosition(x: number, y: number): Promise<void> {
    if (!player.value?.current_map) return
    try {
      await requestData(
        api.post('/player/location', {
          map_id: player.value.current_map,
          position_x: Math.round(x),
          position_y: Math.round(y),
        }),
      )
      player.value.position_x = x
      player.value.position_y = y
    } catch (cause) {
      error.value = errorMessage(cause)
    }
  }

  async function saveGame(): Promise<void> {
    actionLoading.value = true
    error.value = ''
    try {
      await requestData(api.post('/save'))
      showNotice('冒险进度已保存')
    } catch (cause) {
      error.value = errorMessage(cause)
    } finally {
      actionLoading.value = false
    }
  }

  async function interactWithSpirit(spiritId: number): Promise<void> {
    actionLoading.value = true
    error.value = ''
    try {
      const spirit = await requestData<SpiritData>(
        api.post(`/spirits/${spiritId}/affection`, { source: 'dialog' }),
      )
      replaceSpirit(spirit)
      showNotice(`与 ${spirit.name} 的羁绊加深了`)
    } catch (cause) {
      error.value = errorMessage(cause)
    } finally {
      actionLoading.value = false
    }
  }

  async function levelUpSpirit(spiritId: number): Promise<void> {
    actionLoading.value = true
    error.value = ''
    try {
      const spirit = await requestData<SpiritData>(
        api.post(`/spirits/${spiritId}/level`, { levels: 1 }),
      )
      replaceSpirit(spirit)
      showNotice(`${spirit.name} 提升至 Lv.${spirit.level}`)
    } catch (cause) {
      error.value = errorMessage(cause)
    } finally {
      actionLoading.value = false
    }
  }

  function reset(): void {
    player.value = null
    map.value = null
    cards.value = []
    decks.value = []
    spirits.value = []
    battle.value = null
    dialogNpc.value = null
    error.value = ''
  }

  return {
    player,
    map,
    cards,
    decks,
    spirits,
    battle,
    dialogNpc,
    loading,
    actionLoading,
    error,
    notice,
    cardById,
    activeDeck,
    bootstrap,
    openNpc,
    closeDialog,
    startBattle,
    playCard,
    endTurn,
    leaveBattle,
    savePosition,
    saveGame,
    interactWithSpirit,
    levelUpSpirit,
    reset,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useGameStore, import.meta.hot))
}
