import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ArrowLeft, BookOpen, Heart, Layers3, Sparkles, TrendingUp, X } from 'lucide-vue-next';
import { useGameStore } from '@/stores/game';
const __VLS_emit = defineEmits();
const game = useGameStore();
const tab = ref('cards');
const selectedSpiritId = ref(null);
const selectedSpirit = computed(() => game.spirits.find((spirit) => spirit.id === selectedSpiritId.value) ?? null);
const clock = ref(Date.now());
let clockTimer = null;
const interactionCooldownSeconds = computed(() => {
    const availableAt = selectedSpirit.value?.interaction_available_at;
    if (!availableAt)
        return 0;
    const remaining = Math.ceil((Date.parse(availableAt) - clock.value) / 1000);
    return Number.isFinite(remaining) ? Math.max(0, remaining) : 0;
});
const interactionLabel = computed(() => {
    if (game.actionLoading)
        return '互动中…';
    if (selectedSpirit.value?.affection === 100)
        return '羁绊已满';
    if (interactionCooldownSeconds.value > 0)
        return `${interactionCooldownSeconds.value} 秒后可交谈`;
    return '陪伴交谈';
});
watch(tab, () => { selectedSpiritId.value = null; });
onMounted(() => {
    clockTimer = window.setInterval(() => { clock.value = Date.now(); }, 1000);
});
onBeforeUnmount(() => {
    if (clockTimer)
        window.clearInterval(clockTimer);
});
function affectionStage(affection) {
    if (affection <= 20)
        return '初识';
    if (affection <= 50)
        return '熟悉';
    if (affection <= 80)
        return '信赖';
    return '羁绊';
}
function skillName(skill) {
    return typeof skill.name === 'string' ? skill.name : '尚未记录';
}
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
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onClick: (...[$event]) => {
            return (__VLS_ctx.$emit('close'));
            // @ts-ignore
            [$emit,];
        } },
    ...{ class: "drawer-backdrop" },
});
/** @type {__VLS_StyleScopedClasses['drawer-backdrop']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
    ...{ class: "collection-drawer" },
    'aria-label': "冒险图鉴",
});
/** @type {__VLS_StyleScopedClasses['collection-drawer']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "eyebrow" },
});
/** @type {__VLS_StyleScopedClasses['eyebrow']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            return (__VLS_ctx.$emit('close'));
            // @ts-ignore
            [$emit,];
        } },
    ...{ class: "icon-button" },
    type: "button",
    'aria-label': "关闭图鉴",
});
/** @type {__VLS_StyleScopedClasses['icon-button']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.X} */
X;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    size: (20),
}));
const __VLS_2 = __VLS_1({
    size: (20),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.nav, __VLS_intrinsics.nav)({
    ...{ class: "drawer-tabs" },
    'aria-label': "图鉴分类",
});
/** @type {__VLS_StyleScopedClasses['drawer-tabs']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            return (__VLS_ctx.tab = 'cards');
            // @ts-ignore
            [tab,];
        } },
    ...{ class: ({ active: __VLS_ctx.tab === 'cards' }) },
    type: "button",
});
/** @type {__VLS_StyleScopedClasses['active']} */ ;
let __VLS_5;
/** @ts-ignore @type { | typeof __VLS_components.Layers3} */
Layers3;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    size: (17),
}));
const __VLS_7 = __VLS_6({
    size: (17),
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            return (__VLS_ctx.tab = 'spirits');
            // @ts-ignore
            [tab, tab,];
        } },
    ...{ class: ({ active: __VLS_ctx.tab === 'spirits' }) },
    type: "button",
});
/** @type {__VLS_StyleScopedClasses['active']} */ ;
let __VLS_10;
/** @ts-ignore @type { | typeof __VLS_components.Sparkles} */
Sparkles;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    size: (17),
}));
const __VLS_12 = __VLS_11({
    size: (17),
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            return (__VLS_ctx.tab = 'deck');
            // @ts-ignore
            [tab, tab,];
        } },
    ...{ class: ({ active: __VLS_ctx.tab === 'deck' }) },
    type: "button",
});
/** @type {__VLS_StyleScopedClasses['active']} */ ;
let __VLS_15;
/** @ts-ignore @type { | typeof __VLS_components.BookOpen} */
BookOpen;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
    size: (17),
}));
const __VLS_17 = __VLS_16({
    size: (17),
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
if (__VLS_ctx.tab === 'spirits' && __VLS_ctx.selectedSpirit) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "spirit-growth" },
        role: "tabpanel",
        'aria-label': "卡灵养成",
    });
    /** @type {__VLS_StyleScopedClasses['spirit-growth']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.tab === 'spirits' && __VLS_ctx.selectedSpirit))
                    throw 0;
                return (__VLS_ctx.selectedSpiritId = null);
                // @ts-ignore
                [tab, tab, selectedSpirit, selectedSpiritId,];
            } },
        ...{ class: "growth-back" },
        type: "button",
    });
    /** @type {__VLS_StyleScopedClasses['growth-back']} */ ;
    let __VLS_20;
    /** @ts-ignore @type { | typeof __VLS_components.ArrowLeft} */
    ArrowLeft;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
        size: (17),
    }));
    const __VLS_22 = __VLS_21({
        size: (17),
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "growth-hero" },
    });
    /** @type {__VLS_StyleScopedClasses['growth-hero']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
        src: (__VLS_ctx.selectedSpirit.avatar || '/assets/generated/portraits/luna.webp'),
        alt: "",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "rarity" },
    });
    /** @type {__VLS_StyleScopedClasses['rarity']} */ ;
    (__VLS_ctx.selectedSpirit.rarity);
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    (__VLS_ctx.selectedSpirit.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    (__VLS_ctx.selectedSpirit.race);
    (__VLS_ctx.selectedSpirit.type);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "growth-stats" },
    });
    /** @type {__VLS_StyleScopedClasses['growth-stats']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    (__VLS_ctx.selectedSpirit.level);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    (__VLS_ctx.affectionStage(__VLS_ctx.selectedSpirit.affection));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    (__VLS_ctx.selectedSpirit.awaken_level);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "growth-block" },
    });
    /** @type {__VLS_StyleScopedClasses['growth-block']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "growth-label" },
    });
    /** @type {__VLS_StyleScopedClasses['growth-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    (__VLS_ctx.selectedSpirit.exp);
    (__VLS_ctx.selectedSpirit.level * 100);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "growth-track" },
        role: "progressbar",
        'aria-label': "卡灵经验",
        'aria-valuemin': "0",
        'aria-valuemax': (__VLS_ctx.selectedSpirit.level * 100),
        'aria-valuenow': (__VLS_ctx.selectedSpirit.exp),
    });
    /** @type {__VLS_StyleScopedClasses['growth-track']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.i)({
        ...{ style: ({ width: `${Math.min(100, __VLS_ctx.selectedSpirit.exp / (__VLS_ctx.selectedSpirit.level * 100) * 100)}%` }) },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.tab === 'spirits' && __VLS_ctx.selectedSpirit))
                    throw 0;
                return (__VLS_ctx.game.levelUpSpirit(__VLS_ctx.selectedSpirit.id));
                // @ts-ignore
                [selectedSpirit, selectedSpirit, selectedSpirit, selectedSpirit, selectedSpirit, selectedSpirit, selectedSpirit, selectedSpirit, selectedSpirit, selectedSpirit, selectedSpirit, selectedSpirit, selectedSpirit, selectedSpirit, selectedSpirit, affectionStage, game,];
            } },
        ...{ class: "button primary" },
        type: "button",
        disabled: (__VLS_ctx.game.actionLoading || __VLS_ctx.selectedSpirit.exp < __VLS_ctx.selectedSpirit.level * 100),
    });
    /** @type {__VLS_StyleScopedClasses['button']} */ ;
    /** @type {__VLS_StyleScopedClasses['primary']} */ ;
    let __VLS_25;
    /** @ts-ignore @type { | typeof __VLS_components.TrendingUp} */
    TrendingUp;
    // @ts-ignore
    const __VLS_26 = __VLS_asFunctionalComponent1(__VLS_25, new __VLS_25({
        size: (17),
    }));
    const __VLS_27 = __VLS_26({
        size: (17),
    }, ...__VLS_functionalComponentArgsRest(__VLS_26));
    (__VLS_ctx.game.actionLoading ? '处理中…' : '提升等级');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "growth-block" },
    });
    /** @type {__VLS_StyleScopedClasses['growth-block']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "growth-label" },
    });
    /** @type {__VLS_StyleScopedClasses['growth-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    (__VLS_ctx.selectedSpirit.affection);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "growth-track affection" },
        role: "progressbar",
        'aria-label': "卡灵羁绊",
        'aria-valuemin': "0",
        'aria-valuemax': "100",
        'aria-valuenow': (__VLS_ctx.selectedSpirit.affection),
    });
    /** @type {__VLS_StyleScopedClasses['growth-track']} */ ;
    /** @type {__VLS_StyleScopedClasses['affection']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.i)({
        ...{ style: ({ width: `${__VLS_ctx.selectedSpirit.affection}%` }) },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.tab === 'spirits' && __VLS_ctx.selectedSpirit))
                    throw 0;
                return (__VLS_ctx.game.interactWithSpirit(__VLS_ctx.selectedSpirit.id));
                // @ts-ignore
                [selectedSpirit, selectedSpirit, selectedSpirit, selectedSpirit, selectedSpirit, selectedSpirit, game, game, game,];
            } },
        ...{ class: "button ghost" },
        type: "button",
        disabled: (__VLS_ctx.game.actionLoading || __VLS_ctx.selectedSpirit.affection >= 100 || __VLS_ctx.interactionCooldownSeconds > 0),
    });
    /** @type {__VLS_StyleScopedClasses['button']} */ ;
    /** @type {__VLS_StyleScopedClasses['ghost']} */ ;
    let __VLS_30;
    /** @ts-ignore @type { | typeof __VLS_components.Heart} */
    Heart;
    // @ts-ignore
    const __VLS_31 = __VLS_asFunctionalComponent1(__VLS_30, new __VLS_30({
        size: (17),
    }));
    const __VLS_32 = __VLS_31({
        size: (17),
    }, ...__VLS_functionalComponentArgsRest(__VLS_31));
    (__VLS_ctx.interactionLabel);
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({
        'aria-live': "polite",
    });
    (__VLS_ctx.interactionCooldownSeconds > 0 ? '交谈后需要稍作休息，倒计时结束即可再次互动。' : '每次交谈增加 1 点羁绊。');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "growth-story" },
    });
    /** @type {__VLS_StyleScopedClasses['growth-story']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "eyebrow" },
    });
    /** @type {__VLS_StyleScopedClasses['eyebrow']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    (__VLS_ctx.selectedSpirit.story);
    __VLS_asFunctionalElement1(__VLS_intrinsics.dl, __VLS_intrinsics.dl)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({});
    (__VLS_ctx.skillName(__VLS_ctx.selectedSpirit.base_skill));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({});
    (__VLS_ctx.skillName(__VLS_ctx.selectedSpirit.awakening_skill));
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "collection-grid" },
        role: "tabpanel",
    });
    /** @type {__VLS_StyleScopedClasses['collection-grid']} */ ;
    for (const [card] of __VLS_vFor((__VLS_ctx.tab === 'cards' ? __VLS_ctx.game.cards : []))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
            key: (card.id),
            ...{ class: "collection-item" },
        });
        /** @type {__VLS_StyleScopedClasses['collection-item']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
            ...{ class: "collection-art" },
            src: (card.source_spirit_id ? '/assets/generated/portraits/luna.webp' : '/assets/generated/cards/basic-attack.webp'),
            alt: "",
        });
        /** @type {__VLS_StyleScopedClasses['collection-art']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "rarity" },
        });
        /** @type {__VLS_StyleScopedClasses['rarity']} */ ;
        (card.rarity);
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
        (card.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
        (card.type);
        (card.cost);
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        (card.count);
        // @ts-ignore
        [tab, selectedSpirit, selectedSpirit, selectedSpirit, selectedSpirit, game, game, interactionCooldownSeconds, interactionCooldownSeconds, interactionLabel, skillName, skillName,];
    }
    for (const [spirit] of __VLS_vFor((__VLS_ctx.tab === 'spirits' ? __VLS_ctx.game.spirits : []))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.tab === 'spirits' && __VLS_ctx.selectedSpirit))
                        throw 0;
                    return (__VLS_ctx.selectedSpiritId = spirit.id);
                    // @ts-ignore
                    [tab, selectedSpiritId, game,];
                } },
            key: (spirit.id),
            ...{ class: "collection-item spirit" },
            type: "button",
        });
        /** @type {__VLS_StyleScopedClasses['collection-item']} */ ;
        /** @type {__VLS_StyleScopedClasses['spirit']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
            ...{ class: "collection-art" },
            src: (spirit.avatar || '/assets/generated/portraits/luna.webp'),
            alt: "",
        });
        /** @type {__VLS_StyleScopedClasses['collection-art']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "rarity" },
        });
        /** @type {__VLS_StyleScopedClasses['rarity']} */ ;
        (spirit.rarity);
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
        (spirit.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
        (spirit.race);
        (spirit.level);
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        (spirit.affection);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "spirit-open" },
        });
        /** @type {__VLS_StyleScopedClasses['spirit-open']} */ ;
        // @ts-ignore
        [];
    }
    if (__VLS_ctx.tab === 'deck') {
        for (const [deck] of __VLS_vFor((__VLS_ctx.game.decks))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
                key: (deck.id),
                ...{ class: "deck-item" },
            });
            /** @type {__VLS_StyleScopedClasses['deck-item']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "rarity" },
            });
            /** @type {__VLS_StyleScopedClasses['rarity']} */ ;
            (deck.is_active ? '使用中' : '备用');
            __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
            (deck.name);
            __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
            (deck.cards.reduce((sum, card) => sum + card.amount, 0));
            __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({});
            for (const [card] of __VLS_vFor((deck.cards))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                    key: (card.card_id),
                });
                (card.name);
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                (card.amount);
                // @ts-ignore
                [tab, game,];
            }
            // @ts-ignore
            [];
        }
    }
    if ((__VLS_ctx.tab === 'cards' && !__VLS_ctx.game.cards.length) || (__VLS_ctx.tab === 'spirits' && !__VLS_ctx.game.spirits.length) || (__VLS_ctx.tab === 'deck' && !__VLS_ctx.game.decks.length)) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "empty-state" },
        });
        /** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
    }
}
// @ts-ignore
[tab, tab, tab, game, game, game,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
});
export default {};
