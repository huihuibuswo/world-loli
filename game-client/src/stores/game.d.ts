import type { BattleData, CardData, DeckData, MapData, NpcData, PlayerProfile, SpiritData } from '@/api/types';
export declare const useGameStore: import("pinia").StoreDefinition<"game", Pick<{
    player: import("vue").Ref<{
        id: number;
        name: string;
        level: number;
        exp: number;
        hp: number;
        attack: number;
        defense: number;
        gold: number;
        current_map: number | null;
        position_x: number;
        position_y: number;
    } | null, PlayerProfile | {
        id: number;
        name: string;
        level: number;
        exp: number;
        hp: number;
        attack: number;
        defense: number;
        gold: number;
        current_map: number | null;
        position_x: number;
        position_y: number;
    } | null>;
    map: import("vue").Ref<{
        id: number;
        map_name: string;
        map_type: string;
        level_limit: number;
        resource: {
            spawn?: {
                x: number;
                y: number;
            } | undefined;
            bounds?: {
                min_x: number;
                min_y: number;
                max_x: number;
                max_y: number;
            } | undefined;
            objects?: {
                type: string;
                template_id?: number | undefined;
                template_name?: string | undefined;
                x: number;
                y: number;
            }[] | undefined;
        };
    } | null, MapData | {
        id: number;
        map_name: string;
        map_type: string;
        level_limit: number;
        resource: {
            spawn?: {
                x: number;
                y: number;
            } | undefined;
            bounds?: {
                min_x: number;
                min_y: number;
                max_x: number;
                max_y: number;
            } | undefined;
            objects?: {
                type: string;
                template_id?: number | undefined;
                template_name?: string | undefined;
                x: number;
                y: number;
            }[] | undefined;
        };
    } | null>;
    cards: import("vue").Ref<{
        id: number;
        template_id: number;
        name: string;
        type: string;
        cost: number;
        rarity: string;
        source_spirit_id: number | null;
        effect: {
            [x: string]: unknown;
            damage?: number | undefined;
        };
        upgrade: Record<string, unknown>;
        level: number;
        count: number;
    }[], CardData[] | {
        id: number;
        template_id: number;
        name: string;
        type: string;
        cost: number;
        rarity: string;
        source_spirit_id: number | null;
        effect: {
            [x: string]: unknown;
            damage?: number | undefined;
        };
        upgrade: Record<string, unknown>;
        level: number;
        count: number;
    }[]>;
    decks: import("vue").Ref<{
        id: number;
        name: string;
        is_active: boolean;
        cards: {
            card_id: number;
            name: string;
            cost: number;
            level: number;
            amount: number;
        }[];
    }[], DeckData[] | {
        id: number;
        name: string;
        is_active: boolean;
        cards: {
            card_id: number;
            name: string;
            cost: number;
            level: number;
            amount: number;
        }[];
    }[]>;
    spirits: import("vue").Ref<{
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
    }[], SpiritData[] | {
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
    }[]>;
    battle: import("vue").Ref<{
        battle_id: number;
        enemy_id: number;
        status: "active" | "victory" | "defeat" | "abandoned";
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
            damage?: number | undefined;
            card_id?: number | undefined;
        } | undefined;
        result?: string | undefined;
        reward?: Record<string, unknown> | undefined;
    } | null, BattleData | {
        battle_id: number;
        enemy_id: number;
        status: "active" | "victory" | "defeat" | "abandoned";
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
            damage?: number | undefined;
            card_id?: number | undefined;
        } | undefined;
        result?: string | undefined;
        reward?: Record<string, unknown> | undefined;
    } | null>;
    dialogNpc: import("vue").Ref<{
        id: number;
        name: string;
        type: string;
        story: string;
        battle_deck: Record<string, unknown>;
        reward: Record<string, unknown>;
        is_card_spirit: boolean;
    } | null, NpcData | {
        id: number;
        name: string;
        type: string;
        story: string;
        battle_deck: Record<string, unknown>;
        reward: Record<string, unknown>;
        is_card_spirit: boolean;
    } | null>;
    loading: import("vue").Ref<boolean, boolean>;
    actionLoading: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<string, string>;
    notice: import("vue").Ref<string, string>;
    cardById: import("vue").ComputedRef<Map<number, {
        id: number;
        template_id: number;
        name: string;
        type: string;
        cost: number;
        rarity: string;
        source_spirit_id: number | null;
        effect: {
            [x: string]: unknown;
            damage?: number | undefined;
        };
        upgrade: Record<string, unknown>;
        level: number;
        count: number;
    }>>;
    activeDeck: import("vue").ComputedRef<{
        id: number;
        name: string;
        is_active: boolean;
        cards: {
            card_id: number;
            name: string;
            cost: number;
            level: number;
            amount: number;
        }[];
    } | null>;
    bootstrap: () => Promise<void>;
    openNpc: (npcId: number) => Promise<void>;
    closeDialog: () => void;
    startBattle: (enemyId: number) => Promise<void>;
    playCard: (cardId: number) => Promise<void>;
    endTurn: () => Promise<void>;
    leaveBattle: () => Promise<void>;
    savePosition: (x: number, y: number) => Promise<void>;
    saveGame: () => Promise<void>;
    reset: () => void;
}, "loading" | "error" | "map" | "player" | "cards" | "decks" | "spirits" | "battle" | "dialogNpc" | "actionLoading" | "notice">, Pick<{
    player: import("vue").Ref<{
        id: number;
        name: string;
        level: number;
        exp: number;
        hp: number;
        attack: number;
        defense: number;
        gold: number;
        current_map: number | null;
        position_x: number;
        position_y: number;
    } | null, PlayerProfile | {
        id: number;
        name: string;
        level: number;
        exp: number;
        hp: number;
        attack: number;
        defense: number;
        gold: number;
        current_map: number | null;
        position_x: number;
        position_y: number;
    } | null>;
    map: import("vue").Ref<{
        id: number;
        map_name: string;
        map_type: string;
        level_limit: number;
        resource: {
            spawn?: {
                x: number;
                y: number;
            } | undefined;
            bounds?: {
                min_x: number;
                min_y: number;
                max_x: number;
                max_y: number;
            } | undefined;
            objects?: {
                type: string;
                template_id?: number | undefined;
                template_name?: string | undefined;
                x: number;
                y: number;
            }[] | undefined;
        };
    } | null, MapData | {
        id: number;
        map_name: string;
        map_type: string;
        level_limit: number;
        resource: {
            spawn?: {
                x: number;
                y: number;
            } | undefined;
            bounds?: {
                min_x: number;
                min_y: number;
                max_x: number;
                max_y: number;
            } | undefined;
            objects?: {
                type: string;
                template_id?: number | undefined;
                template_name?: string | undefined;
                x: number;
                y: number;
            }[] | undefined;
        };
    } | null>;
    cards: import("vue").Ref<{
        id: number;
        template_id: number;
        name: string;
        type: string;
        cost: number;
        rarity: string;
        source_spirit_id: number | null;
        effect: {
            [x: string]: unknown;
            damage?: number | undefined;
        };
        upgrade: Record<string, unknown>;
        level: number;
        count: number;
    }[], CardData[] | {
        id: number;
        template_id: number;
        name: string;
        type: string;
        cost: number;
        rarity: string;
        source_spirit_id: number | null;
        effect: {
            [x: string]: unknown;
            damage?: number | undefined;
        };
        upgrade: Record<string, unknown>;
        level: number;
        count: number;
    }[]>;
    decks: import("vue").Ref<{
        id: number;
        name: string;
        is_active: boolean;
        cards: {
            card_id: number;
            name: string;
            cost: number;
            level: number;
            amount: number;
        }[];
    }[], DeckData[] | {
        id: number;
        name: string;
        is_active: boolean;
        cards: {
            card_id: number;
            name: string;
            cost: number;
            level: number;
            amount: number;
        }[];
    }[]>;
    spirits: import("vue").Ref<{
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
    }[], SpiritData[] | {
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
    }[]>;
    battle: import("vue").Ref<{
        battle_id: number;
        enemy_id: number;
        status: "active" | "victory" | "defeat" | "abandoned";
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
            damage?: number | undefined;
            card_id?: number | undefined;
        } | undefined;
        result?: string | undefined;
        reward?: Record<string, unknown> | undefined;
    } | null, BattleData | {
        battle_id: number;
        enemy_id: number;
        status: "active" | "victory" | "defeat" | "abandoned";
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
            damage?: number | undefined;
            card_id?: number | undefined;
        } | undefined;
        result?: string | undefined;
        reward?: Record<string, unknown> | undefined;
    } | null>;
    dialogNpc: import("vue").Ref<{
        id: number;
        name: string;
        type: string;
        story: string;
        battle_deck: Record<string, unknown>;
        reward: Record<string, unknown>;
        is_card_spirit: boolean;
    } | null, NpcData | {
        id: number;
        name: string;
        type: string;
        story: string;
        battle_deck: Record<string, unknown>;
        reward: Record<string, unknown>;
        is_card_spirit: boolean;
    } | null>;
    loading: import("vue").Ref<boolean, boolean>;
    actionLoading: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<string, string>;
    notice: import("vue").Ref<string, string>;
    cardById: import("vue").ComputedRef<Map<number, {
        id: number;
        template_id: number;
        name: string;
        type: string;
        cost: number;
        rarity: string;
        source_spirit_id: number | null;
        effect: {
            [x: string]: unknown;
            damage?: number | undefined;
        };
        upgrade: Record<string, unknown>;
        level: number;
        count: number;
    }>>;
    activeDeck: import("vue").ComputedRef<{
        id: number;
        name: string;
        is_active: boolean;
        cards: {
            card_id: number;
            name: string;
            cost: number;
            level: number;
            amount: number;
        }[];
    } | null>;
    bootstrap: () => Promise<void>;
    openNpc: (npcId: number) => Promise<void>;
    closeDialog: () => void;
    startBattle: (enemyId: number) => Promise<void>;
    playCard: (cardId: number) => Promise<void>;
    endTurn: () => Promise<void>;
    leaveBattle: () => Promise<void>;
    savePosition: (x: number, y: number) => Promise<void>;
    saveGame: () => Promise<void>;
    reset: () => void;
}, "cardById" | "activeDeck">, Pick<{
    player: import("vue").Ref<{
        id: number;
        name: string;
        level: number;
        exp: number;
        hp: number;
        attack: number;
        defense: number;
        gold: number;
        current_map: number | null;
        position_x: number;
        position_y: number;
    } | null, PlayerProfile | {
        id: number;
        name: string;
        level: number;
        exp: number;
        hp: number;
        attack: number;
        defense: number;
        gold: number;
        current_map: number | null;
        position_x: number;
        position_y: number;
    } | null>;
    map: import("vue").Ref<{
        id: number;
        map_name: string;
        map_type: string;
        level_limit: number;
        resource: {
            spawn?: {
                x: number;
                y: number;
            } | undefined;
            bounds?: {
                min_x: number;
                min_y: number;
                max_x: number;
                max_y: number;
            } | undefined;
            objects?: {
                type: string;
                template_id?: number | undefined;
                template_name?: string | undefined;
                x: number;
                y: number;
            }[] | undefined;
        };
    } | null, MapData | {
        id: number;
        map_name: string;
        map_type: string;
        level_limit: number;
        resource: {
            spawn?: {
                x: number;
                y: number;
            } | undefined;
            bounds?: {
                min_x: number;
                min_y: number;
                max_x: number;
                max_y: number;
            } | undefined;
            objects?: {
                type: string;
                template_id?: number | undefined;
                template_name?: string | undefined;
                x: number;
                y: number;
            }[] | undefined;
        };
    } | null>;
    cards: import("vue").Ref<{
        id: number;
        template_id: number;
        name: string;
        type: string;
        cost: number;
        rarity: string;
        source_spirit_id: number | null;
        effect: {
            [x: string]: unknown;
            damage?: number | undefined;
        };
        upgrade: Record<string, unknown>;
        level: number;
        count: number;
    }[], CardData[] | {
        id: number;
        template_id: number;
        name: string;
        type: string;
        cost: number;
        rarity: string;
        source_spirit_id: number | null;
        effect: {
            [x: string]: unknown;
            damage?: number | undefined;
        };
        upgrade: Record<string, unknown>;
        level: number;
        count: number;
    }[]>;
    decks: import("vue").Ref<{
        id: number;
        name: string;
        is_active: boolean;
        cards: {
            card_id: number;
            name: string;
            cost: number;
            level: number;
            amount: number;
        }[];
    }[], DeckData[] | {
        id: number;
        name: string;
        is_active: boolean;
        cards: {
            card_id: number;
            name: string;
            cost: number;
            level: number;
            amount: number;
        }[];
    }[]>;
    spirits: import("vue").Ref<{
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
    }[], SpiritData[] | {
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
    }[]>;
    battle: import("vue").Ref<{
        battle_id: number;
        enemy_id: number;
        status: "active" | "victory" | "defeat" | "abandoned";
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
            damage?: number | undefined;
            card_id?: number | undefined;
        } | undefined;
        result?: string | undefined;
        reward?: Record<string, unknown> | undefined;
    } | null, BattleData | {
        battle_id: number;
        enemy_id: number;
        status: "active" | "victory" | "defeat" | "abandoned";
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
            damage?: number | undefined;
            card_id?: number | undefined;
        } | undefined;
        result?: string | undefined;
        reward?: Record<string, unknown> | undefined;
    } | null>;
    dialogNpc: import("vue").Ref<{
        id: number;
        name: string;
        type: string;
        story: string;
        battle_deck: Record<string, unknown>;
        reward: Record<string, unknown>;
        is_card_spirit: boolean;
    } | null, NpcData | {
        id: number;
        name: string;
        type: string;
        story: string;
        battle_deck: Record<string, unknown>;
        reward: Record<string, unknown>;
        is_card_spirit: boolean;
    } | null>;
    loading: import("vue").Ref<boolean, boolean>;
    actionLoading: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<string, string>;
    notice: import("vue").Ref<string, string>;
    cardById: import("vue").ComputedRef<Map<number, {
        id: number;
        template_id: number;
        name: string;
        type: string;
        cost: number;
        rarity: string;
        source_spirit_id: number | null;
        effect: {
            [x: string]: unknown;
            damage?: number | undefined;
        };
        upgrade: Record<string, unknown>;
        level: number;
        count: number;
    }>>;
    activeDeck: import("vue").ComputedRef<{
        id: number;
        name: string;
        is_active: boolean;
        cards: {
            card_id: number;
            name: string;
            cost: number;
            level: number;
            amount: number;
        }[];
    } | null>;
    bootstrap: () => Promise<void>;
    openNpc: (npcId: number) => Promise<void>;
    closeDialog: () => void;
    startBattle: (enemyId: number) => Promise<void>;
    playCard: (cardId: number) => Promise<void>;
    endTurn: () => Promise<void>;
    leaveBattle: () => Promise<void>;
    savePosition: (x: number, y: number) => Promise<void>;
    saveGame: () => Promise<void>;
    reset: () => void;
}, "reset" | "bootstrap" | "openNpc" | "closeDialog" | "startBattle" | "playCard" | "endTurn" | "leaveBattle" | "savePosition" | "saveGame">>;
