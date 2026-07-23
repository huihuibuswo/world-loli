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
}

export interface CardData {
  id: number
  template_id: number
  name: string
  type: string
  cost: number
  rarity: string
  source_spirit_id: number | null
  effect: { damage?: number; [key: string]: unknown }
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
  player_state: { hp: number; max_hp: number }
  enemy_state: { name: string; sprite: string; hp: number; max_hp: number }
  hand_cards: number[]
  draw_pile: number[]
  discard_cards: number[]
  buffs: unknown[]
  debuffs: unknown[]
  last_action?: { type: string; damage?: number; card_id?: number }
  result?: string
  reward?: {
    first_victory?: boolean
    card?: { template_id: number; name: string; count: number }
    [key: string]: unknown
  }
}
