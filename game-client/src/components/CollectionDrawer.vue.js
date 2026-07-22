import { ref } from 'vue';
import { BookOpen, Layers3, Sparkles, X } from 'lucide-vue-next';
import { useGameStore } from '@/stores/game';
const __VLS_emit = defineEmits();
const game = useGameStore();
const tab = ref('cards');
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
    [tab, tab, game,];
}
for (const [spirit] of __VLS_vFor((__VLS_ctx.tab === 'spirits' ? __VLS_ctx.game.spirits : []))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
        key: (spirit.id),
        ...{ class: "collection-item spirit" },
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
    // @ts-ignore
    [tab, game,];
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
// @ts-ignore
[tab, tab, tab, game, game, game,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
});
export default {};
