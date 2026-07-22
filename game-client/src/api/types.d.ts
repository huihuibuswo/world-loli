export interface ApiEnvelope<T> {
    code: number;
    message: string;
    data: T;
}
export interface AuthResult {
    access_token: string;
    token_type: string;
    user?: {
        id: number;
        username: string;
        email: string | null;
    };
    player_id?: number;
}
export interface PlayerProfile {
    id: number;
    name: string;
    avatar_gender: 'female' | 'male';
    level: number;
    exp: number;
    hp: number;
    attack: number;
    defense: number;
    gold: number;
    current_map: number | null;
    position_x: number;
    position_y: number;
}
export interface MapObject {
    type: string;
    template_id?: number;
    template_name?: string;
    x: number;
    y: number;
}
export interface MapData {
    id: number;
    map_name: string;
    map_type: string;
    level_limit: number;
    resource: {
        spawn?: {
            x: number;
            y: number;
        };
        bounds?: {
            min_x: number;
            min_y: number;
            max_x: number;
            max_y: number;
        };
        objects?: MapObject[];
    };
}
export interface NpcData {
    id: number;
    name: string;
    type: string;
    story: string;
    battle_deck: Record<string, unknown>;
    reward: Record<string, unknown>;
    is_card_spirit: boolean;
}
export interface CardData {
    id: number;
    template_id: number;
    name: string;
    type: string;
    cost: number;
    rarity: string;
    source_spirit_id: number | null;
    effect: {
        damage?: number;
        [key: string]: unknown;
    };
    upgrade: Record<string, unknown>;
    level: number;
    count: number;
}
export interface SpiritData {
    id: number;
    template_id: number;
    name: string;
    race: string;
    rarity: string;
    type: string;
    story: string;
    avatar: string | null;
    level: number;
    exp: number;
    affection: number;
    awaken_level: number;
}
export interface DeckData {
    id: number;
    name: string;
    is_active: boolean;
    cards: Array<{
        card_id: number;
        name: string;
        cost: number;
        level: number;
        amount: number;
    }>;
}
export interface BattleData {
    battle_id: number;
    enemy_id: number;
    status: 'active' | 'victory' | 'defeat' | 'abandoned';
    version: number;
    current_turn: number;
    energy: number;
    player_state: {
        hp: number;
        max_hp: number;
    };
    enemy_state: {
        name: string;
        hp: number;
        max_hp: number;
    };
    hand_cards: number[];
    draw_pile: number[];
    discard_cards: number[];
    buffs: unknown[];
    debuffs: unknown[];
    last_action?: {
        type: string;
        damage?: number;
        card_id?: number;
    };
    result?: string;
    reward?: Record<string, unknown>;
}
