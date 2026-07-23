export type GameEventMap = {
    'world:ready': undefined;
    'player:moved': {
        x: number;
        y: number;
    };
    'npc:near': {
        id: number | null;
        name: string | null;
    };
    'npc:interact': {
        id: number;
    };
    'portal:near': {
        mapId: number | null;
        name: string | null;
        label: string | null;
    };
    'portal:interact': {
        mapId: number;
        name: string;
    };
    'input:direction': {
        x: number;
        y: number;
    };
    'input:interact': undefined;
    'world:input-lock': {
        locked: boolean;
    };
    'scene:world': undefined;
    'scene:battle': {
        enemyName: string;
        enemySprite: string;
    };
    'battle:action': {
        damage: number;
        target: 'enemy' | 'player';
        targetDefeated: boolean;
        result: 'active' | 'victory' | 'defeat' | 'abandoned';
    };
};
type Handler<T> = (payload: T) => void;
declare class TypedEventBus {
    private readonly target;
    private readonly wrapped;
    on<K extends keyof GameEventMap>(event: K, handler: Handler<GameEventMap[K]>): void;
    off<K extends keyof GameEventMap>(event: K, handler: Handler<GameEventMap[K]>): void;
    emit<K extends keyof GameEventMap>(event: K, payload: GameEventMap[K]): void;
}
export declare const gameEvents: TypedEventBus;
export {};
