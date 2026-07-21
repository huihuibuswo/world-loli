import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { BookOpen, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Coins, Heart, LogOut, Save, Sparkles, Swords } from 'lucide-vue-next';
import BattlePanel from '@/components/BattlePanel.vue';
import CollectionDrawer from '@/components/CollectionDrawer.vue';
import DialogModal from '@/components/DialogModal.vue';
import { WorldGame } from '@/game/Game';
import { gameEvents } from '@/game/events';
import { useGameStore } from '@/stores/game';
const __VLS_emit = defineEmits();
const game = useGameStore();
const canvasHost = ref(null);
const nearNpc = ref(null);
const drawerOpen = ref(false);
let world = null;
let saveTimer = null;
const hpPercent = computed(() => game.player ? Math.max(0, game.player.hp / 100 * 100) : 0);
const isBattle = computed(() => Boolean(game.battle));
const onNear = (npc) => { nearNpc.value = npc.id && npc.name ? { id: npc.id, name: npc.name } : null; };
const onInteract = ({ id }) => { void game.openNpc(id); };
const onMoved = ({ x, y }) => {
    if (saveTimer)
        window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => { void game.savePosition(x, y); }, 800);
};
function direction(x, y) { gameEvents.emit('input:direction', { x, y }); }
function stopDirection() { direction(0, 0); }
function interact() { gameEvents.emit('input:interact', undefined); }
async function beginBattle(id) {
    try {
        await game.startBattle(id);
        if (game.battle)
            gameEvents.emit('scene:battle', { enemyName: game.battle.enemy_state.name });
    }
    catch { /* store presents the error */ }
}
onMounted(() => {
    if (canvasHost.value && game.map && game.player)
        world = new WorldGame(canvasHost.value, game.map, game.player);
    gameEvents.on('npc:near', onNear);
    gameEvents.on('npc:interact', onInteract);
    gameEvents.on('player:moved', onMoved);
    if (game.battle)
        gameEvents.emit('scene:battle', { enemyName: game.battle.enemy_state.name });
});
onBeforeUnmount(() => {
    if (saveTimer)
        window.clearTimeout(saveTimer);
    gameEvents.off('npc:near', onNear);
    gameEvents.off('npc:interact', onInteract);
    gameEvents.off('player:moved', onMoved);
    world?.destroy();
});
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "game-shell" },
});
/** @type {__VLS_StyleScopedClasses['game-shell']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    ref: "canvasHost",
    ...{ class: "game-canvas" },
    'aria-label': "游戏世界画面",
});
/** @type {__VLS_StyleScopedClasses['game-canvas']} */ ;
if (!__VLS_ctx.isBattle) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
        ...{ class: "world-hud" },
    });
    /** @type {__VLS_StyleScopedClasses['world-hud']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "player-chip glass-panel" },
    });
    /** @type {__VLS_StyleScopedClasses['player-chip']} */ ;
    /** @type {__VLS_StyleScopedClasses['glass-panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "avatar" },
    });
    /** @type {__VLS_StyleScopedClasses['avatar']} */ ;
    let __VLS_0;
    /** @ts-ignore @type { | typeof __VLS_components.Sparkles} */
    Sparkles;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        size: (21),
    }));
    const __VLS_2 = __VLS_1({
        size: (21),
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "player-info" },
    });
    /** @type {__VLS_StyleScopedClasses['player-info']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    (__VLS_ctx.game.player?.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.game.player?.level);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mini-hp" },
    });
    /** @type {__VLS_StyleScopedClasses['mini-hp']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.i)({
        ...{ style: ({ width: `${__VLS_ctx.hpPercent}%` }) },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "hud-actions glass-panel" },
    });
    /** @type {__VLS_StyleScopedClasses['hud-actions']} */ ;
    /** @type {__VLS_StyleScopedClasses['glass-panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "currency" },
    });
    /** @type {__VLS_StyleScopedClasses['currency']} */ ;
    let __VLS_5;
    /** @ts-ignore @type { | typeof __VLS_components.Coins} */
    Coins;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
        size: (18),
    }));
    const __VLS_7 = __VLS_6({
        size: (18),
    }, ...__VLS_functionalComponentArgsRest(__VLS_6));
    (__VLS_ctx.game.player?.gold);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.game.saveGame) },
        ...{ class: "icon-button" },
        type: "button",
        'aria-label': "保存进度",
        title: "保存进度",
        disabled: (__VLS_ctx.game.actionLoading),
    });
    /** @type {__VLS_StyleScopedClasses['icon-button']} */ ;
    let __VLS_10;
    /** @ts-ignore @type { | typeof __VLS_components.Save} */
    Save;
    // @ts-ignore
    const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
        size: (19),
    }));
    const __VLS_12 = __VLS_11({
        size: (19),
    }, ...__VLS_functionalComponentArgsRest(__VLS_11));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(!__VLS_ctx.isBattle))
                    throw 0;
                return (__VLS_ctx.drawerOpen = true);
                // @ts-ignore
                [isBattle, game, game, game, game, game, hpPercent, drawerOpen,];
            } },
        ...{ class: "icon-button" },
        type: "button",
        'aria-label': "打开冒险图鉴",
        title: "冒险图鉴",
    });
    /** @type {__VLS_StyleScopedClasses['icon-button']} */ ;
    let __VLS_15;
    /** @ts-ignore @type { | typeof __VLS_components.BookOpen} */
    BookOpen;
    // @ts-ignore
    const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
        size: (19),
    }));
    const __VLS_17 = __VLS_16({
        size: (19),
    }, ...__VLS_functionalComponentArgsRest(__VLS_16));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(!__VLS_ctx.isBattle))
                    throw 0;
                return (__VLS_ctx.$emit('logout'));
                // @ts-ignore
                [$emit,];
            } },
        ...{ class: "icon-button" },
        type: "button",
        'aria-label': "退出登录",
        title: "退出登录",
    });
    /** @type {__VLS_StyleScopedClasses['icon-button']} */ ;
    let __VLS_20;
    /** @ts-ignore @type { | typeof __VLS_components.LogOut} */
    LogOut;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
        size: (19),
    }));
    const __VLS_22 = __VLS_21({
        size: (19),
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
}
if (!__VLS_ctx.isBattle) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "quest-card glass-panel" },
    });
    /** @type {__VLS_StyleScopedClasses['quest-card']} */ ;
    /** @type {__VLS_StyleScopedClasses['glass-panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    let __VLS_25;
    /** @ts-ignore @type { | typeof __VLS_components.Heart} */
    Heart;
    // @ts-ignore
    const __VLS_26 = __VLS_asFunctionalComponent1(__VLS_25, new __VLS_25({
        size: (16),
    }));
    const __VLS_27 = __VLS_26({
        size: (16),
    }, ...__VLS_functionalComponentArgsRest(__VLS_26));
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
}
if (!__VLS_ctx.isBattle && __VLS_ctx.nearNpc) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "interaction-hint" },
        role: "status",
    });
    /** @type {__VLS_StyleScopedClasses['interaction-hint']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.interact) },
        type: "button",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.kbd, __VLS_intrinsics.kbd)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.nearNpc.name);
}
if (!__VLS_ctx.isBattle) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mobile-controls" },
        'aria-label': "移动控制",
    });
    /** @type {__VLS_StyleScopedClasses['mobile-controls']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onPointerdown: (...[$event]) => {
                if (!(!__VLS_ctx.isBattle))
                    throw 0;
                return (__VLS_ctx.direction(0, -1));
                // @ts-ignore
                [isBattle, isBattle, isBattle, nearNpc, nearNpc, interact, direction,];
            } },
        ...{ onPointerup: (__VLS_ctx.stopDirection) },
        ...{ onPointerleave: (__VLS_ctx.stopDirection) },
        ...{ class: "up" },
        type: "button",
        'aria-label': "向上移动",
    });
    /** @type {__VLS_StyleScopedClasses['up']} */ ;
    let __VLS_30;
    /** @ts-ignore @type { | typeof __VLS_components.ChevronUp} */
    ChevronUp;
    // @ts-ignore
    const __VLS_31 = __VLS_asFunctionalComponent1(__VLS_30, new __VLS_30({}));
    const __VLS_32 = __VLS_31({}, ...__VLS_functionalComponentArgsRest(__VLS_31));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onPointerdown: (...[$event]) => {
                if (!(!__VLS_ctx.isBattle))
                    throw 0;
                return (__VLS_ctx.direction(-1, 0));
                // @ts-ignore
                [direction, stopDirection, stopDirection,];
            } },
        ...{ onPointerup: (__VLS_ctx.stopDirection) },
        ...{ onPointerleave: (__VLS_ctx.stopDirection) },
        ...{ class: "left" },
        type: "button",
        'aria-label': "向左移动",
    });
    /** @type {__VLS_StyleScopedClasses['left']} */ ;
    let __VLS_35;
    /** @ts-ignore @type { | typeof __VLS_components.ChevronLeft} */
    ChevronLeft;
    // @ts-ignore
    const __VLS_36 = __VLS_asFunctionalComponent1(__VLS_35, new __VLS_35({}));
    const __VLS_37 = __VLS_36({}, ...__VLS_functionalComponentArgsRest(__VLS_36));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onPointerdown: (...[$event]) => {
                if (!(!__VLS_ctx.isBattle))
                    throw 0;
                return (__VLS_ctx.direction(0, 1));
                // @ts-ignore
                [direction, stopDirection, stopDirection,];
            } },
        ...{ onPointerup: (__VLS_ctx.stopDirection) },
        ...{ onPointerleave: (__VLS_ctx.stopDirection) },
        ...{ class: "down" },
        type: "button",
        'aria-label': "向下移动",
    });
    /** @type {__VLS_StyleScopedClasses['down']} */ ;
    let __VLS_40;
    /** @ts-ignore @type { | typeof __VLS_components.ChevronDown} */
    ChevronDown;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent1(__VLS_40, new __VLS_40({}));
    const __VLS_42 = __VLS_41({}, ...__VLS_functionalComponentArgsRest(__VLS_41));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onPointerdown: (...[$event]) => {
                if (!(!__VLS_ctx.isBattle))
                    throw 0;
                return (__VLS_ctx.direction(1, 0));
                // @ts-ignore
                [direction, stopDirection, stopDirection,];
            } },
        ...{ onPointerup: (__VLS_ctx.stopDirection) },
        ...{ onPointerleave: (__VLS_ctx.stopDirection) },
        ...{ class: "right" },
        type: "button",
        'aria-label': "向右移动",
    });
    /** @type {__VLS_StyleScopedClasses['right']} */ ;
    let __VLS_45;
    /** @ts-ignore @type { | typeof __VLS_components.ChevronRight} */
    ChevronRight;
    // @ts-ignore
    const __VLS_46 = __VLS_asFunctionalComponent1(__VLS_45, new __VLS_45({}));
    const __VLS_47 = __VLS_46({}, ...__VLS_functionalComponentArgsRest(__VLS_46));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.interact) },
        ...{ class: "mobile-interact" },
        type: "button",
        'aria-label': "互动",
    });
    /** @type {__VLS_StyleScopedClasses['mobile-interact']} */ ;
    let __VLS_50;
    /** @ts-ignore @type { | typeof __VLS_components.Swords} */
    Swords;
    // @ts-ignore
    const __VLS_51 = __VLS_asFunctionalComponent1(__VLS_50, new __VLS_50({}));
    const __VLS_52 = __VLS_51({}, ...__VLS_functionalComponentArgsRest(__VLS_51));
}
if (__VLS_ctx.game.battle) {
    const __VLS_55 = BattlePanel;
    // @ts-ignore
    const __VLS_56 = __VLS_asFunctionalComponent1(__VLS_55, new __VLS_55({}));
    const __VLS_57 = __VLS_56({}, ...__VLS_functionalComponentArgsRest(__VLS_56));
}
if (__VLS_ctx.game.dialogNpc) {
    const __VLS_60 = DialogModal;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent1(__VLS_60, new __VLS_60({
        ...{ 'onClose': {} },
        ...{ 'onBattle': {} },
        npc: (__VLS_ctx.game.dialogNpc),
        loading: (__VLS_ctx.game.actionLoading),
    }));
    const __VLS_62 = __VLS_61({
        ...{ 'onClose': {} },
        ...{ 'onBattle': {} },
        npc: (__VLS_ctx.game.dialogNpc),
        loading: (__VLS_ctx.game.actionLoading),
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    let __VLS_65;
    const __VLS_66 = {
        /** @type {typeof __VLS_65.close} */
        onClose: (__VLS_ctx.game.closeDialog),
    };
    const __VLS_67 = {
        /** @type {typeof __VLS_65.battle} */
        onBattle: (__VLS_ctx.beginBattle),
    };
    var __VLS_63;
    var __VLS_64;
}
if (__VLS_ctx.drawerOpen) {
    const __VLS_68 = CollectionDrawer;
    // @ts-ignore
    const __VLS_69 = __VLS_asFunctionalComponent1(__VLS_68, new __VLS_68({
        ...{ 'onClose': {} },
    }));
    const __VLS_70 = __VLS_69({
        ...{ 'onClose': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_69));
    let __VLS_73;
    const __VLS_74 = {
        /** @type {typeof __VLS_73.close} */
        onClose: (...[$event]) => {
            if (!(__VLS_ctx.drawerOpen))
                throw 0;
            return (__VLS_ctx.drawerOpen = false);
            // @ts-ignore
            [game, game, game, game, game, drawerOpen, drawerOpen, interact, stopDirection, stopDirection, beginBattle,];
        },
    };
    var __VLS_71;
    var __VLS_72;
}
if (__VLS_ctx.game.error) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "toast error" },
        role: "alert",
    });
    /** @type {__VLS_StyleScopedClasses['toast']} */ ;
    /** @type {__VLS_StyleScopedClasses['error']} */ ;
    (__VLS_ctx.game.error);
}
if (__VLS_ctx.game.notice) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "toast" },
        role: "status",
    });
    /** @type {__VLS_StyleScopedClasses['toast']} */ ;
    (__VLS_ctx.game.notice);
}
// @ts-ignore
[game, game, game, game,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
});
export default {};
