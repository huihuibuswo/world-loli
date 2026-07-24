import { computed, ref } from 'vue'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { api, errorMessage, requestData } from '@/api/client'
import type {
  BattleData,
  CardData,
  DeckData,
  GiftOptions,
  GiftResult,
  MapData,
  MapEnterResult,
  NpcAffection,
  NpcChatState,
  NpcData,
  NpcGiftOptions,
  NpcGiftResult,
  NpcServiceData,
  NpcShopPurchaseResult,
  NpcTrainingUpgradeResult,
  PlantCollectResult,
  PlantData,
  PlantNode,
  PlayerProfile,
  SpiritData,
  SpiritFragmentData,
  SpiritComposeResult,
} from '@/api/types'

export const useGameStore = defineStore('game', () => {
  const player = ref<PlayerProfile | null>(null)
  const map = ref<MapData | null>(null)
  const cards = ref<CardData[]>([])
  const decks = ref<DeckData[]>([])
  const spirits = ref<SpiritData[]>([])
  const spiritFragments = ref<SpiritFragmentData[]>([])
  const plants = ref<PlantData[]>([])
  const giftOptions = ref<GiftOptions | null>(null)
  const lastGift = ref<GiftResult | null>(null)
  const battle = ref<BattleData | null>(null)
  const dialogNpc = ref<NpcData | null>(null)
  const npcChat = ref<NpcChatState | null>(null)
  const npcAffection = ref<NpcAffection | null>(null)
  const npcGiftOptions = ref<NpcGiftOptions | null>(null)
  const npcLastGift = ref<NpcGiftResult | null>(null)
  const npcService = ref<NpcServiceData | null>(null)
  const loading = ref(false)
  const actionLoading = ref(false)
  const chatLoading = ref(false)
  const mapLoading = ref(false)
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

  function emptyNpcAffection(npcId: number): NpcAffection {
    return {
      npc_id: npcId,
      points: 0,
      level: 1,
      max_points: 100,
      current_level_points: 0,
      next_level_points: 20,
      points_to_next: 20,
      level_progress: 0,
      conversation_count: 0,
      battle_count: 0,
      claimed_milestones: [],
    }
  }

  async function refreshCollections(): Promise<void> {
    const [nextCards, nextDecks, nextSpirits, nextFragments, nextPlants] = await Promise.all([
      requestData<CardData[]>(api.get('/cards')),
      requestData<DeckData[]>(api.get('/decks')),
      requestData<SpiritData[]>(api.get('/spirits')),
      requestData<SpiritFragmentData[]>(api.get('/spirit-fragments')),
      requestData<PlantData[]>(api.get('/plants/inventory')),
    ])
    cards.value = nextCards
    decks.value = nextDecks
    spirits.value = nextSpirits
    spiritFragments.value = nextFragments
    plants.value = nextPlants
  }

  async function refreshMapPlants(): Promise<void> {
    if (!map.value) return
    const mapId = map.value.id
    const nodes = await requestData<PlantNode[]>(api.get(`/map/${mapId}/plants`))
    if (map.value?.id !== mapId) return
    map.value = {
      ...map.value,
      resource: {
        ...map.value.resource,
        objects: [
          ...(map.value.resource.objects ?? []).filter((item) => item.type !== 'collectible_plant'),
          ...nodes,
        ],
      },
    }
  }

  async function bootstrap(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      player.value = normalizePlayer(await requestData<PlayerProfile>(api.get('/player/profile')))
      if (player.value.current_map) {
        map.value = await requestData<MapData>(api.get(`/map/${player.value.current_map}`))
        await refreshMapPlants()
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
      const npc = await requestData<NpcData>(api.get(`/npc/${npcId}`))
      try {
        npcAffection.value = await requestData<NpcAffection>(api.get(`/npc/${npcId}/affection`))
      } catch {
        npcAffection.value = emptyNpcAffection(npc.id)
      }
      try {
        npcChat.value = await requestData<NpcChatState>(api.get(`/npc/${npcId}/chat`))
        npcAffection.value = npcChat.value.affection
      } catch {
        npcChat.value = {
          npc_id: npc.id,
          conversation_version: 0,
          turns: [],
          reply: null,
          suggested_replies: npc.ai?.fallback_replies ?? ['继续聊聊', '换个话题'],
          mode: 'static',
          affection: npcAffection.value ?? emptyNpcAffection(npc.id),
          affection_change: null,
        }
      }
      try {
        npcGiftOptions.value = await requestData<NpcGiftOptions>(api.get(`/npc/${npcId}/gifts`))
      } catch {
        npcGiftOptions.value = { remaining_gifts: 0, plants: [], items: [] }
      }
      try {
        npcService.value = await requestData<NpcServiceData>(api.get(`/npc/${npcId}/service`))
      } catch {
        npcService.value = { kind: 'none', title: '暂无职业服务', description: '' }
      }
      npcLastGift.value = null
      dialogNpc.value = npc
    } catch (cause) {
      error.value = errorMessage(cause)
    } finally {
      actionLoading.value = false
    }
  }

  function closeDialog(): void {
    dialogNpc.value = null
    npcChat.value = null
    npcAffection.value = null
    npcGiftOptions.value = null
    npcLastGift.value = null
    npcService.value = null
  }

  async function refreshNpcChat(): Promise<void> {
    if (!dialogNpc.value) return
    npcChat.value = await requestData<NpcChatState>(api.get(`/npc/${dialogNpc.value.id}/chat`))
    npcAffection.value = npcChat.value.affection
  }

  async function refreshNpcService(): Promise<void> {
    if (!dialogNpc.value) return
    npcService.value = await requestData<NpcServiceData>(
      api.get(`/npc/${dialogNpc.value.id}/service`),
    )
  }

  async function purchaseNpcItem(shopItemId: number): Promise<void> {
    if (!dialogNpc.value || actionLoading.value) return
    actionLoading.value = true
    error.value = ''
    try {
      const result = await requestData<NpcShopPurchaseResult>(
        api.post(`/npc/${dialogNpc.value.id}/shop/purchase`, {
          shop_item_id: shopItemId,
          quantity: 1,
        }),
      )
      if (player.value) player.value.gold = result.gold
      await Promise.all([
        refreshNpcService(),
        requestData<NpcGiftOptions>(api.get(`/npc/${dialogNpc.value.id}/gifts`)).then((value) => {
          npcGiftOptions.value = value
        }),
      ])
      showNotice(`购得 ${result.item.name} ×${result.quantity}`)
    } catch (cause) {
      error.value = errorMessage(cause)
      throw cause
    } finally {
      actionLoading.value = false
    }
  }

  async function upgradeNpcCard(cardId: number): Promise<void> {
    if (!dialogNpc.value || actionLoading.value) return
    actionLoading.value = true
    error.value = ''
    try {
      const result = await requestData<NpcTrainingUpgradeResult>(
        api.post(`/npc/${dialogNpc.value.id}/training/upgrade`, {
          card_id: cardId,
          levels: 1,
        }),
      )
      const index = cards.value.findIndex((card) => card.id === result.card.id)
      if (index >= 0) cards.value[index] = result.card
      if (player.value) player.value.gold = result.gold
      await refreshNpcService()
      showNotice(`${result.card.name} 提升至 Lv.${result.card.level}`)
    } catch (cause) {
      error.value = errorMessage(cause)
      throw cause
    } finally {
      actionLoading.value = false
    }
  }

  async function acceptNpcQuest(questId: number): Promise<void> {
    if (!dialogNpc.value || actionLoading.value) return
    actionLoading.value = true
    error.value = ''
    try {
      await requestData(api.post(`/quests/${questId}/accept`))
      await refreshNpcService()
      showNotice('任务已领取')
    } catch (cause) {
      error.value = errorMessage(cause)
      throw cause
    } finally {
      actionLoading.value = false
    }
  }

  async function sendNpcChat(message: string): Promise<void> {
    if (!dialogNpc.value || !npcChat.value || chatLoading.value) return
    chatLoading.value = true
    error.value = ''
    try {
      const nextChat = await requestData<NpcChatState>(
        api.post(`/npc/${dialogNpc.value.id}/chat`, {
          request_id: crypto.randomUUID(),
          message,
          conversation_version: npcChat.value.conversation_version,
        }),
      )
      npcChat.value = nextChat
      npcAffection.value = nextChat.affection
      npcLastGift.value = null
      if (nextChat.affection_change?.points_gained) {
        showNotice(`与 ${dialogNpc.value.name} 的好感 +${nextChat.affection_change.points_gained}`)
      }
    } catch (cause) {
      error.value = errorMessage(cause)
      try {
        await refreshNpcChat()
      } catch { /* retain the last usable conversation state */ }
      throw cause
    } finally {
      chatLoading.value = false
    }
  }

  async function startBattle(enemyId: number): Promise<void> {
    actionLoading.value = true
    error.value = ''
    try {
      battle.value = await requestData<BattleData>(api.post('/battle/create', { enemy_id: enemyId }))
      sessionStorage.setItem('world_battle_id', String(battle.value.battle_id))
      dialogNpc.value = null
      npcChat.value = null
      npcAffection.value = null
      npcGiftOptions.value = null
      npcLastGift.value = null
      npcService.value = null
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
      if (battle.value.status !== 'active') await refreshCollections()
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
    const mapId = player.value.current_map
    try {
      await requestData(
        api.post('/player/location', {
          map_id: mapId,
          position_x: Math.round(x),
          position_y: Math.round(y),
        }),
      )
      if (player.value?.current_map !== mapId) return
      player.value.position_x = x
      player.value.position_y = y
    } catch (cause) {
      if (player.value?.current_map !== mapId) return
      error.value = errorMessage(cause)
    }
  }

  async function enterMap(mapId: number): Promise<void> {
    if (!player.value || mapLoading.value || battle.value || dialogNpc.value) return
    mapLoading.value = true
    error.value = ''
    try {
      const entered = await requestData<MapEnterResult>(api.post('/map/enter', { map_id: mapId }))
      map.value = entered.map
      player.value = {
        ...player.value,
        current_map: entered.map.id,
        position_x: entered.position_x,
        position_y: entered.position_y,
      }
      await refreshMapPlants()
      showNotice(`已进入${entered.map.map_name}`)
    } catch (cause) {
      error.value = errorMessage(cause)
      throw cause
    } finally {
      mapLoading.value = false
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

  async function composeSpirit(spiritTemplateId: number): Promise<void> {
    actionLoading.value = true
    error.value = ''
    try {
      const result = await requestData<SpiritComposeResult>(
        api.post(`/spirit-fragments/${spiritTemplateId}/compose`),
      )
      await refreshCollections()
      showNotice(result.composed ? '卡灵合成成功' : '已经拥有该卡灵')
    } catch (cause) {
      error.value = errorMessage(cause)
    } finally {
      actionLoading.value = false
    }
  }

  async function collectPlant(nodeId: string): Promise<PlantCollectResult | null> {
    if (!map.value || actionLoading.value) return null
    actionLoading.value = true
    error.value = ''
    try {
      const result = await requestData<PlantCollectResult>(
        api.post('/plants/collect', { map_id: map.value.id, node_id: nodeId }),
      )
      const object = map.value.resource.objects?.find(
        (item) => item.type === 'collectible_plant' && item.node_id === nodeId,
      )
      if (object) {
        object.available = false
        object.available_at = result.available_at
      }
      const index = plants.value.findIndex((item) => item.id === result.plant.id)
      if (index >= 0) plants.value[index] = result.plant
      else plants.value.push(result.plant)
      showNotice(`获得 ${result.plant.name} ×1`)
      return result
    } catch (cause) {
      error.value = errorMessage(cause)
      return null
    } finally {
      actionLoading.value = false
    }
  }

  async function loadGiftOptions(spiritId: number): Promise<void> {
    actionLoading.value = true
    error.value = ''
    lastGift.value = null
    try {
      giftOptions.value = await requestData<GiftOptions>(api.get(`/spirits/${spiritId}/gifts`))
    } catch (cause) {
      giftOptions.value = null
      error.value = errorMessage(cause)
    } finally {
      actionLoading.value = false
    }
  }

  async function givePlantGift(spiritId: number, plantTemplateId: number): Promise<void> {
    if (actionLoading.value) return
    actionLoading.value = true
    error.value = ''
    try {
      const result = await requestData<GiftResult>(
        api.post(`/spirits/${spiritId}/gifts`, { plant_template_id: plantTemplateId }),
      )
      lastGift.value = result
      const spirit = spirits.value.find((item) => item.id === spiritId)
      if (spirit) spirit.affection = result.affection
      const inventory = plants.value.find((item) => item.id === plantTemplateId)
      if (inventory) inventory.amount = result.remaining_amount
      plants.value = plants.value.filter((item) => item.amount > 0)
      if (giftOptions.value) {
        giftOptions.value.remaining_gifts = result.remaining_gifts
        const option = giftOptions.value.plants.find((item) => item.id === plantTemplateId)
        if (option) option.amount = result.remaining_amount
        giftOptions.value.plants = giftOptions.value.plants.filter((item) => item.amount > 0)
      }
      showNotice(`羁绊 +${result.affection_gained}`)
    } catch (cause) {
      error.value = errorMessage(cause)
    } finally {
      actionLoading.value = false
    }
  }

  async function giveNpcGift(giftType: 'plant' | 'item', templateId: number): Promise<void> {
    if (!dialogNpc.value || actionLoading.value) return
    actionLoading.value = true
    error.value = ''
    try {
      const result = await requestData<NpcGiftResult>(
        api.post(`/npc/${dialogNpc.value.id}/gifts`, giftType === 'plant'
          ? { plant_template_id: templateId }
          : { item_template_id: templateId }),
      )
      npcLastGift.value = result
      npcAffection.value = result.affection
      if (npcChat.value) npcChat.value.affection = result.affection
      if (giftType === 'plant') {
        const inventory = plants.value.find((item) => item.id === templateId)
        if (inventory) inventory.amount = result.remaining_amount
        plants.value = plants.value.filter((item) => item.amount > 0)
      }
      if (npcGiftOptions.value) {
        npcGiftOptions.value.remaining_gifts = result.remaining_gifts
        const options = giftType === 'plant'
          ? npcGiftOptions.value.plants
          : npcGiftOptions.value.items
        const option = options.find((item) => item.id === templateId)
        if (option) option.amount = result.remaining_amount
        if (giftType === 'plant') {
          npcGiftOptions.value.plants = npcGiftOptions.value.plants.filter((item) => item.amount > 0)
        } else {
          npcGiftOptions.value.items = npcGiftOptions.value.items.filter((item) => item.amount > 0)
        }
      }
      await refreshNpcService()
      showNotice(`与 ${dialogNpc.value.name} 的好感 +${result.affection_change.points_gained}`)
    } catch (cause) {
      error.value = errorMessage(cause)
      throw cause
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
    spiritFragments.value = []
    plants.value = []
    giftOptions.value = null
    lastGift.value = null
    battle.value = null
    dialogNpc.value = null
    npcChat.value = null
    npcAffection.value = null
    npcGiftOptions.value = null
    npcLastGift.value = null
    npcService.value = null
    chatLoading.value = false
    mapLoading.value = false
    error.value = ''
  }

  return {
    player,
    map,
    cards,
    decks,
    spirits,
    spiritFragments,
    plants,
    giftOptions,
    lastGift,
    battle,
    dialogNpc,
    npcChat,
    npcAffection,
    npcGiftOptions,
    npcLastGift,
    npcService,
    loading,
    actionLoading,
    chatLoading,
    mapLoading,
    error,
    notice,
    cardById,
    activeDeck,
    bootstrap,
    openNpc,
    closeDialog,
    sendNpcChat,
    refreshNpcService,
    purchaseNpcItem,
    upgradeNpcCard,
    acceptNpcQuest,
    startBattle,
    playCard,
    endTurn,
    leaveBattle,
    savePosition,
    enterMap,
    saveGame,
    interactWithSpirit,
    levelUpSpirit,
    composeSpirit,
    collectPlant,
    loadGiftOptions,
    givePlantGift,
    giveNpcGift,
    reset,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useGameStore, import.meta.hot))
}
