export type GameEventMap = {
  'world:ready': undefined
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
  'battle:action': {
    damage: number
    target: 'enemy' | 'player'
    targetDefeated: boolean
    result: 'active' | 'victory' | 'defeat' | 'abandoned'
  }
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
