import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { api, errorMessage, requestData } from '@/api/client';
export const useGameStore = defineStore('game', () => {
    const player = ref(null);
    const map = ref(null);
    const cards = ref([]);
    const decks = ref([]);
    const spirits = ref([]);
    const battle = ref(null);
    const dialogNpc = ref(null);
    const loading = ref(false);
    const actionLoading = ref(false);
    const error = ref('');
    const notice = ref('');
    const cardById = computed(() => new Map(cards.value.map((card) => [card.id, card])));
    const activeDeck = computed(() => decks.value.find((deck) => deck.is_active) ?? null);
    async function refreshCollections() {
        const [nextCards, nextDecks, nextSpirits] = await Promise.all([
            requestData(api.get('/cards')),
            requestData(api.get('/decks')),
            requestData(api.get('/spirits')),
        ]);
        cards.value = nextCards;
        decks.value = nextDecks;
        spirits.value = nextSpirits;
    }
    async function bootstrap() {
        loading.value = true;
        error.value = '';
        try {
            player.value = await requestData(api.get('/player/profile'));
            if (player.value.current_map) {
                map.value = await requestData(api.get(`/map/${player.value.current_map}`));
            }
            await refreshCollections();
            const savedBattleId = sessionStorage.getItem('world_battle_id');
            if (savedBattleId) {
                try {
                    const current = await requestData(api.get(`/battle/${savedBattleId}`));
                    battle.value = current.status === 'active' ? current : null;
                    if (!battle.value)
                        sessionStorage.removeItem('world_battle_id');
                }
                catch {
                    sessionStorage.removeItem('world_battle_id');
                }
            }
        }
        catch (cause) {
            error.value = errorMessage(cause);
            throw cause;
        }
        finally {
            loading.value = false;
        }
    }
    async function openNpc(npcId) {
        actionLoading.value = true;
        error.value = '';
        try {
            dialogNpc.value = await requestData(api.get(`/npc/${npcId}`));
        }
        catch (cause) {
            error.value = errorMessage(cause);
        }
        finally {
            actionLoading.value = false;
        }
    }
    function closeDialog() {
        dialogNpc.value = null;
    }
    async function startBattle(enemyId) {
        actionLoading.value = true;
        error.value = '';
        try {
            battle.value = await requestData(api.post('/battle/create', { enemy_id: enemyId }));
            sessionStorage.setItem('world_battle_id', String(battle.value.battle_id));
            dialogNpc.value = null;
        }
        catch (cause) {
            error.value = errorMessage(cause);
            throw cause;
        }
        finally {
            actionLoading.value = false;
        }
    }
    async function playCard(cardId) {
        if (!battle.value)
            return;
        actionLoading.value = true;
        error.value = '';
        try {
            battle.value = await requestData(api.post(`/battle/${battle.value.battle_id}/play-card`, {
                card_id: cardId,
                expected_version: battle.value.version,
            }));
            if (battle.value.status !== 'active')
                await refreshCollections();
        }
        catch (cause) {
            error.value = errorMessage(cause);
            await refreshBattle();
        }
        finally {
            actionLoading.value = false;
        }
    }
    async function endTurn() {
        if (!battle.value)
            return;
        actionLoading.value = true;
        error.value = '';
        try {
            battle.value = await requestData(api.post(`/battle/${battle.value.battle_id}/end-turn`, {
                expected_version: battle.value.version,
            }));
        }
        catch (cause) {
            error.value = errorMessage(cause);
            await refreshBattle();
        }
        finally {
            actionLoading.value = false;
        }
    }
    async function refreshBattle() {
        if (!battle.value)
            return;
        try {
            battle.value = await requestData(api.get(`/battle/${battle.value.battle_id}`));
        }
        catch {
            battle.value = null;
            sessionStorage.removeItem('world_battle_id');
        }
    }
    async function leaveBattle() {
        battle.value = null;
        sessionStorage.removeItem('world_battle_id');
        player.value = await requestData(api.get('/player/profile'));
        await refreshCollections();
    }
    async function savePosition(x, y) {
        if (!player.value?.current_map)
            return;
        try {
            await requestData(api.post('/player/location', {
                map_id: player.value.current_map,
                position_x: Math.round(x),
                position_y: Math.round(y),
            }));
            player.value.position_x = x;
            player.value.position_y = y;
        }
        catch (cause) {
            error.value = errorMessage(cause);
        }
    }
    async function saveGame() {
        actionLoading.value = true;
        error.value = '';
        try {
            await requestData(api.post('/save'));
            notice.value = '冒险进度已保存';
            window.setTimeout(() => {
                notice.value = '';
            }, 3000);
        }
        catch (cause) {
            error.value = errorMessage(cause);
        }
        finally {
            actionLoading.value = false;
        }
    }
    function reset() {
        player.value = null;
        map.value = null;
        cards.value = [];
        decks.value = [];
        spirits.value = [];
        battle.value = null;
        dialogNpc.value = null;
        error.value = '';
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
        reset,
    };
});
