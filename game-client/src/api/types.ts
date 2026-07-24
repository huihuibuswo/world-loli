export interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
}

export interface AuthResult {
  access_token: string
  token_type: string
  user?: { id: number; username: string; email: string | null }
  player_id?: number
}

export interface PlayerProfile {
  id: number
  name: string
  avatar_gender: 'female' | 'male'
  level: number
  exp: number
  hp: number
  attack: number
  defense: number
  gold: number
  current_map: number | null
  position_x: number
  position_y: number
}

export interface MapObject {
  type: string
  template_id?: number
  template_name?: string
  sprite?: string
  target_map_id?: number
  target_map_name?: string
  label?: string
  spawn_x?: number
  spawn_y?: number
  node_id?: string
  name?: string
  rarity?: PlantRarity
  available?: boolean
  available_at?: string | null
  icon?: string | null
  habitat?: string
  story_gate?: string
  story_stage?: string
  x: number
  y: number
}

export interface MapEnterResult {
  map: MapData
  position_x: number
  position_y: number
}

export interface MapData {
  id: number
  map_name: string
  map_type: string
  level_limit: number
  resource: {
    spawn?: { x: number; y: number }
    bounds?: { min_x: number; min_y: number; max_x: number; max_y: number }
    objects?: MapObject[]
  }
}

export interface NpcData {
  id: number
  name: string
  type: string
  story: string
  battle_deck: Record<string, unknown>
  reward: Record<string, unknown>
  is_card_spirit: boolean
  sprite: string
  portrait: string | null
  dialogue: string[]
  actions: string[]
  service_type: 'shop' | 'quest' | 'guide' | 'training' | null
  ai: {
    dialogue_enabled: boolean
    battle_enabled: boolean
    fallback_replies: [string, string]
  }
}

export interface NpcChatTurn {
  request_id: string
  player: string
  npc: string
  created_at: string
}

export interface NpcChatState {
  npc_id: number
  conversation_version: number
  turns: NpcChatTurn[]
  reply: string | null
  suggested_replies: [string, string]
  mode: 'ai' | 'fallback' | 'static'
  affection: NpcAffection
  affection_change: NpcAffectionChange | null
}

export interface NpcAffectionReward {
  milestone_level: number
  type: 'card' | 'card_spirit'
  template_id: number
  name: string
  count: number
}

export interface NpcAffection {
  npc_id: number
  points: number
  level: number
  max_points: number
  current_level_points: number
  next_level_points: number | null
  points_to_next: number
  level_progress: number
  conversation_count: number
  battle_count: number
  claimed_milestones: number[]
}

export interface NpcAffectionChange {
  points_before: number
  points_after: number
  points_gained: number
  old_level: number
  new_level: number
  leveled_up: boolean
  rewards: NpcAffectionReward[]
  affection: NpcAffection
}

export interface CardData {
  id: number
  template_id: number
  name: string
  type: string
  cost: number
  rarity: string
  source_spirit_id: number | null
  effect: { damage?: number; shield?: number; [key: string]: unknown }
  upgrade: Record<string, unknown>
  level: number
  count: number
}

export interface SpiritData {
  id: number
  template_id: number
  name: string
  race: string
  rarity: string
  type: string
  story: string
  avatar: string | null
  base_skill: { name?: string; [key: string]: unknown }
  awakening_skill: { name?: string; [key: string]: unknown }
  level: number
  exp: number
  affection: number
  awaken_level: number
  interaction_available_at: string | null
}

export interface SpiritFragmentData {
  template_id: number
  name: string
  race: string
  rarity: string
  type: string
  story: string
  avatar: string | null
  fragment_count: number
  fragment_target: number
  can_compose: boolean
  owned_spirit_id: number | null
}

export interface SpiritComposeResult {
  spirit_id: number
  template_id: number
  fragment_count: number
  fragment_target: number
  composed: boolean
}

export type PlantRarity = 'common' | 'uncommon' | 'rare'
export type GiftPreference = 'favorite' | 'liked' | 'neutral' | 'disliked'

export interface PlantData {
  id: number
  name: string
  rarity: PlantRarity
  base_affection: number
  tags: string[]
  description: string
  icon: string | null
  respawn_seconds: number
  amount: number
}

export interface PlantNode extends Omit<PlantData, 'amount'> {
  type: 'collectible_plant'
  template_id: number
  node_id: string
  habitat: string
  x: number
  y: number
  available: boolean
  available_at: string | null
}

export interface GiftOption extends PlantData {
  preference: GiftPreference
}

export interface GiftOptions {
  remaining_gifts: number
  plants: GiftOption[]
}

export interface ItemData {
  id: number
  name: string
  category: string
  rarity: string
  base_affection: number
  tags: string[]
  description: string
  icon: string | null
  amount: number
}

export interface NpcGiftItem extends ItemData {
  preference: GiftPreference
}

export interface NpcGiftOptions extends GiftOptions {
  items: NpcGiftItem[]
}

export interface PlantCollectResult {
  map_id: number
  node_id: string
  available: false
  available_at: string
  plant: PlantData
}

export interface GiftResult {
  spirit_id: number
  plant_template_id: number
  preference: GiftPreference
  affection_gained: number
  affection: number
  remaining_amount: number
  remaining_gifts: number
  dialogue: string
}

export interface NpcGiftResult {
  npc_id: number
  gift_type: 'plant' | 'item'
  plant_template_id: number | null
  item_template_id: number | null
  preference: GiftPreference
  remaining_amount: number
  remaining_gifts: number
  dialogue: string
  affection_change: NpcAffectionChange
  affection: NpcAffection
  rewards: NpcAffectionReward[]
}

export interface NpcShopItem extends ItemData {
  shop_item_id: number
  base_price: number
  price: number
  stock_limit: number
  remaining_stock: number
  unlock_level: number
  unlocked: boolean
}

export interface NpcShopService {
  kind: 'shop'
  title: string
  description: string
  gold: number
  affection_level: number
  discount_percent: number
  items: NpcShopItem[]
}

export interface NpcQuestData {
  id: number
  title: string
  description: string
  type: string
  reward: { gold?: number; [key: string]: unknown }
  status: 'not_started' | 'active' | 'completed'
  progress: {
    objective?: string
    current?: number
    target?: number
    ready?: boolean
    [key: string]: unknown
  }
}

export type OpeningStage = 'arrival' | 'prepare' | 'forest_signal' | 'return_village' | 'complete'

export interface OpeningTask {
  id: number
  title: string
  description: string
  status: 'not_started' | 'active' | 'completed'
  ready: boolean
  current: number
  target: number
}

export interface OpeningStory {
  story_key: string
  title: string
  stage: OpeningStage
  started: boolean
  completed: boolean
  completed_at: string | null
  objective: { title: string; description: string }
  tasks: OpeningTask[]
  luna_enemy_id: number | null
  can_battle_luna: boolean
  can_complete: boolean
  intro_lines: string[]
  completed_now?: boolean
  gold_reward?: number
  main_quest?: string
  contract_reward?: LunaContractReward
}

export interface StoryDialogueLine {
  speaker: string
  text: string
}

export interface LunaContractReward {
  spirit: {
    id: number
    template_id: number
    name: string
    created: boolean
  }
  card: {
    id: number
    template_id: number
    name: string
    count: number
    deck_amount: number
    added_to_active_deck: boolean
  }
}

export interface OpeningBattleReward {
  story_key: string
  stage: OpeningStage
  event?: 'luna_contract'
  message?: string
  dialogue?: StoryDialogueLine[]
  contract_reward?: LunaContractReward
}

export interface NpcQuestService {
  kind: 'quest'
  title: string
  description: string
  quests: NpcQuestData[]
}

export interface NpcGuidePlant {
  id: number
  name: string
  rarity: PlantRarity | 'unknown'
  tags: string[]
  description: string
  habitats: string[]
  respawn_seconds: number | null
  discovered: boolean
  known: boolean
}

export interface NpcGuideService {
  kind: 'guide'
  title: string
  description: string
  affection_level: number
  plants: NpcGuidePlant[]
}

export interface NpcTrainingCard extends CardData {
  upgrade_cost: number
  can_upgrade: boolean
  next_effect: { damage: number; shield: number }
}

export interface NpcTrainingService {
  kind: 'training'
  title: string
  description: string
  gold: number
  cards: NpcTrainingCard[]
}

export interface NpcNoService {
  kind: 'none'
  title: string
  description: string
}

export type NpcServiceData =
  | NpcShopService
  | NpcQuestService
  | NpcGuideService
  | NpcTrainingService
  | NpcNoService

export interface NpcShopPurchaseResult {
  npc_id: number
  shop_item_id: number
  item: ItemData
  quantity: number
  unit_price: number
  total_price: number
  gold: number
  remaining_stock: number
}

export interface NpcTrainingUpgradeResult {
  npc_id: number
  card: CardData
  levels: number
  total_cost: number
  gold: number
}

export interface DeckData {
  id: number
  name: string
  is_active: boolean
  cards: Array<{ card_id: number; name: string; cost: number; level: number; amount: number }>
}

export interface BattleData {
  battle_id: number
  enemy_id: number
  status: 'active' | 'victory' | 'defeat' | 'abandoned'
  version: number
  current_turn: number
  energy: number
  player_state: { hp: number; max_hp: number; shield?: number }
  enemy_state: { name: string; sprite: string; hp: number; max_hp: number; shield?: number }
  hand_cards: number[]
  draw_pile: number[]
  discard_cards: number[]
  buffs: unknown[]
  debuffs: unknown[]
  enemy_energy: number
  enemy_max_energy: number
  enemy_hand_count: number
  enemy_draw_count: number
  enemy_discard_count: number
  last_action?: {
    type: string
    damage?: number
    blocked?: number
    shield?: number
    card_id?: number
    card_template_id?: number
    card_name?: string
    battle_line?: string | null
    cards?: Array<{
      card_template_id: number
      name: string
      type: string
      cost: number
      damage: number
      blocked: number
      shield: number
    }>
  }
  result?: string
  defeat_reason?: 'knockout' | 'surrender' | null
  penalty?: {
    gold_lost: number
    gold_remaining: number
  } | null
  reward?: {
    first_battle?: boolean
    first_victory?: boolean
    card?: { template_id: number; name: string; count: number }
    fragment?: {
      template_id: number
      name: string
      fragment_delta: number
      fragment_count: number
      fragment_target: number
      can_compose: boolean
    }
    opening?: OpeningBattleReward
    [key: string]: unknown
  }
  affection_result?: NpcAffectionChange | null
}
