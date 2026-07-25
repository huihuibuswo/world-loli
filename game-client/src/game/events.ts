export type BattleVisualStep = {
  actor: 'player' | 'enemy'
  kind: 'attack' | 'defense'
  damage: number
  blocked: number
  shield: number
  targetDefeated: boolean
}

export type BattleVisualSequence = {
  version: number
  steps: BattleVisualStep[]
  result: 'active' | 'victory' | 'defeat' | 'abandoned'
}

export const ASSETS_READY_EVENT = 'assets:ready'
export const BATTLE_SCENE_REQUEST_KEY = 'battle-scene-request'
export const WORLD_INPUT_LOCK_KEY = 'world-input-locked'

export type GameEventMap = {
  'player:moved': { x: number; y: number }
  'npc:near': { id: number | null; name: string | null }
  'npc:interact': { id: number }
  'portal:near': { mapId: number | null; name: string | null; label: string | null }
  'portal:interact': { mapId: number; name: string }
  'plant:near': { nodeId: string | null; name: string | null; rarity: string | null }
  'plant:interact': { nodeId: string; name: string }
  'plant:collected': { nodeId: string; availableAt: string }
  'input:direction': { x: number; y: number }
  'input:interact': undefined
  'world:input-lock': { locked: boolean }
  'scene:world': undefined
  'scene:battle': { enemyName: string; enemySprite: string }
  'battle:action': BattleVisualSequence
  'battle:visual-complete': { version: number }
}

type Handler<T> = (payload: T) => void

class TypedEventBus {
  private readonly target = new EventTarget()
  private readonly wrapped = new WeakMap<Function, EventListener>()

  on<K extends keyof GameEventMap>(event: K, handler: Handler<GameEventMap[K]>): void {
    const listener: EventListener = (item) => handler((item as CustomEvent<GameEventMap[K]>).detail)
    this.wrapped.set(handler, listener)
    this.target.addEventListener(event, listener)
  }

  off<K extends keyof GameEventMap>(event: K, handler: Handler<GameEventMap[K]>): void {
    const listener = this.wrapped.get(handler)
    if (listener) this.target.removeEventListener(event, listener)
  }

  emit<K extends keyof GameEventMap>(event: K, payload: GameEventMap[K]): void {
    this.target.dispatchEvent(new CustomEvent(event, { detail: payload }))
  }
}

export const gameEvents = new TypedEventBus()
