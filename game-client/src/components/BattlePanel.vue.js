import { computed, watch } from 'vue';
import { ArrowRight, Droplets, RotateCcw, Shield, Swords } from 'lucide-vue-next';
import { gameEvents } from '@/game/events';
import { useGameStore } from '@/stores/game';
const game = useGameStore();
const battle = computed(() => game.battle);
const hand = computed(() => battle.value.hand_cards.map((id) => game.cardById.get(id)).filter(Boolean));
watch(() => battle.value?.last_action, (next, previous) => {
    if (next && next !== previous && next.damage) {
        gameEvents.emit('battle:impact', { damage: next.damage, target: next.type === 'enemy_attack' ? 'player' : 'enemy' });
    }
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "battle-ui" },
    'aria-label': "战斗界面",
});
/** @type {__VLS_StyleScopedClasses['battle-ui']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "battle-topbar glass-panel" },
});
/** @type {__VLS_StyleScopedClasses['battle-topbar']} */ ;
/** @type {__VLS_StyleScopedClasses['glass-panel']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "combatant" },
});
/** @type {__VLS_StyleScopedClasses['combatant']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
(__VLS_ctx.game.player?.name);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.game.player?.level);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "hp-track" },
});
/** @type {__VLS_StyleScopedClasses['hp-track']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.i)({
    ...{ style: ({ width: `${Math.max(0, __VLS_ctx.battle.player_state.hp / __VLS_ctx.battle.player_state.max_hp * 100)}%` }) },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
(__VLS_ctx.battle.player_state.hp);
(__VLS_ctx.battle.player_state.max_hp);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "turn-badge" },
});
/** @type {__VLS_StyleScopedClasses['turn-badge']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.Swords} */
Swords;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    size: (18),
}));
const __VLS_2 = __VLS_1({
    size: (18),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.battle.current_turn);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "combatant enemy" },
});
/** @type {__VLS_StyleScopedClasses['combatant']} */ ;
/** @type {__VLS_StyleScopedClasses['enemy']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
(__VLS_ctx.battle.enemy_state.name);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "hp-track" },
});
/** @type {__VLS_StyleScopedClasses['hp-track']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.i)({
    ...{ style: ({ width: `${Math.max(0, __VLS_ctx.battle.enemy_state.hp / __VLS_ctx.battle.enemy_state.max_hp * 100)}%` }) },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
(__VLS_ctx.battle.enemy_state.hp);
(__VLS_ctx.battle.enemy_state.max_hp);
if (__VLS_ctx.battle.status !== 'active') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "battle-result glass-panel" },
        role: "status",
    });
    /** @type {__VLS_StyleScopedClasses['battle-result']} */ ;
    /** @type {__VLS_StyleScopedClasses['glass-panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "eyebrow" },
    });
    /** @type {__VLS_StyleScopedClasses['eyebrow']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    (__VLS_ctx.battle.status === 'victory' ? '胜利' : '战斗结束');
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    (__VLS_ctx.battle.status === 'victory' ? '林间的回响化作新的力量。' : '休整之后，再次启程。');
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.game.leaveBattle) },
        ...{ class: "button primary" },
        type: "button",
    });
    /** @type {__VLS_StyleScopedClasses['button']} */ ;
    /** @type {__VLS_StyleScopedClasses['primary']} */ ;
    let __VLS_5;
    /** @ts-ignore @type { | typeof __VLS_components.RotateCcw} */
    RotateCcw;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
        size: (18),
    }));
    const __VLS_7 = __VLS_6({
        size: (18),
    }, ...__VLS_functionalComponentArgsRest(__VLS_6));
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "battle-controls" },
    });
    /** @type {__VLS_StyleScopedClasses['battle-controls']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "energy-pill" },
        'aria-label': "当前能量",
    });
    /** @type {__VLS_StyleScopedClasses['energy-pill']} */ ;
    let __VLS_10;
    /** @ts-ignore @type { | typeof __VLS_components.Droplets} */
    Droplets;
    // @ts-ignore
    const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
        size: (19),
    }));
    const __VLS_12 = __VLS_11({
        size: (19),
    }, ...__VLS_functionalComponentArgsRest(__VLS_11));
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    (__VLS_ctx.battle.energy);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card-hand" },
        'aria-label': "手牌",
    });
    /** @type {__VLS_StyleScopedClasses['card-hand']} */ ;
    for (const [card, index] of __VLS_vFor((__VLS_ctx.hand))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.battle.status !== 'active'))
                        throw 0;
                    return (__VLS_ctx.game.playCard(card.id));
                    // @ts-ignore
                    [game, game, game, game, battle, battle, battle, battle, battle, battle, battle, battle, battle, battle, battle, battle, battle, battle, hand,];
                } },
            key: (`${card.id}-${index}`),
            ...{ class: "battle-card" },
            type: "button",
            disabled: (__VLS_ctx.game.actionLoading || card.cost > __VLS_ctx.battle.energy),
        });
        /** @type {__VLS_StyleScopedClasses['battle-card']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "card-cost" },
        });
        /** @type {__VLS_StyleScopedClasses['card-cost']} */ ;
        (card.cost);
        __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
            ...{ class: "card-art" },
            src: (card.source_spirit_id ? '/assets/generated/portraits/luna.webp' : '/assets/generated/cards/basic-attack.webp'),
            alt: "",
        });
        /** @type {__VLS_StyleScopedClasses['card-art']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "card-sigil" },
        });
        /** @type {__VLS_StyleScopedClasses['card-sigil']} */ ;
        if (card.type === 'defense') {
            let __VLS_15;
            /** @ts-ignore @type { | typeof __VLS_components.Shield} */
            Shield;
            // @ts-ignore
            const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
                size: (30),
            }));
            const __VLS_17 = __VLS_16({
                size: (30),
            }, ...__VLS_functionalComponentArgsRest(__VLS_16));
        }
        else {
            let __VLS_20;
            /** @ts-ignore @type { | typeof __VLS_components.Swords} */
            Swords;
            // @ts-ignore
            const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
                size: (30),
            }));
            const __VLS_22 = __VLS_21({
                size: (30),
            }, ...__VLS_functionalComponentArgsRest(__VLS_21));
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
        (card.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
        (card.effect.damage ? `造成 ${card.effect.damage} 点伤害` : '施放卡牌效果');
        // @ts-ignore
        [game, battle,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.game.endTurn) },
        ...{ class: "button end-turn" },
        type: "button",
        disabled: (__VLS_ctx.game.actionLoading),
    });
    /** @type {__VLS_StyleScopedClasses['button']} */ ;
    /** @type {__VLS_StyleScopedClasses['end-turn']} */ ;
    let __VLS_25;
    /** @ts-ignore @type { | typeof __VLS_components.ArrowRight} */
    ArrowRight;
    // @ts-ignore
    const __VLS_26 = __VLS_asFunctionalComponent1(__VLS_25, new __VLS_25({
        size: (18),
    }));
    const __VLS_27 = __VLS_26({
        size: (18),
    }, ...__VLS_functionalComponentArgsRest(__VLS_26));
}
// @ts-ignore
[game, game,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
