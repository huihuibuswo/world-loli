import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ChevronDown, DoorOpen, Swords } from 'lucide-vue-next';
const props = defineProps();
const emit = defineEmits();
const lineIndex = ref(0);
const portraitSrc = ref('');
const dialogRoot = ref(null);
const lines = computed(() => props.npc.dialogue?.length
    ? props.npc.dialogue
    : [props.npc.story || '风掠过树梢，对方正静静等待你的回应。']);
const conversationComplete = computed(() => lineIndex.value >= lines.value.length);
const currentLine = computed(() => lines.value[Math.min(lineIndex.value, lines.value.length - 1)]);
const canBattle = computed(() => (props.npc.actions ?? []).includes('battle'));
const fallbackPortrait = computed(() => `/assets/generated/sprites/${props.npc.sprite || 'npc-trainer'}.png`);
const roleLabel = computed(() => ({
    shop: '晨曦杂货商',
    craft: '村庄锻造师',
    quest: '森林引路人',
    training: '实战教官',
    dialogue: '晨曦村村长',
}[props.npc.type] ?? '旅途相遇'));
function resetConversation() {
    lineIndex.value = 0;
    portraitSrc.value = props.npc.portrait || fallbackPortrait.value;
    void nextTick(() => dialogRoot.value?.focus());
}
function advance() {
    if (!conversationComplete.value) {
        lineIndex.value += 1;
        if (conversationComplete.value) {
            void nextTick(() => dialogRoot.value?.querySelector('button')?.focus());
        }
    }
}
function useFallbackPortrait() {
    if (portraitSrc.value !== fallbackPortrait.value)
        portraitSrc.value = fallbackPortrait.value;
}
function onKeydown(event) {
    if (event.key === 'Escape') {
        emit('close');
        return;
    }
    if (event.key !== 'Tab' || !dialogRoot.value)
        return;
    const controls = [...dialogRoot.value.querySelectorAll('button:not(:disabled)')];
    if (!controls.length) {
        event.preventDefault();
        return;
    }
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRoot.value)) {
        event.preventDefault();
        last.focus();
    }
    else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}
watch(() => props.npc.id, resetConversation);
onMounted(() => {
    resetConversation();
    window.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
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
    ...{ class: "gal-dialog-backdrop" },
});
/** @type {__VLS_StyleScopedClasses['gal-dialog-backdrop']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ref: "dialogRoot",
    ...{ class: "gal-dialog" },
    role: "dialog",
    'aria-modal': "true",
    'aria-labelledby': (`npc-${__VLS_ctx.npc.id}`),
    tabindex: "-1",
});
/** @type {__VLS_StyleScopedClasses['gal-dialog']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "gal-portrait-stage" },
});
/** @type {__VLS_StyleScopedClasses['gal-portrait-stage']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.img)({
    ...{ onError: (__VLS_ctx.useFallbackPortrait) },
    src: (__VLS_ctx.portraitSrc),
    alt: (`${__VLS_ctx.npc.name}的角色立绘`),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "gal-dialog-panel" },
});
/** @type {__VLS_StyleScopedClasses['gal-dialog-panel']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
    ...{ class: "gal-speaker" },
});
/** @type {__VLS_StyleScopedClasses['gal-speaker']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "eyebrow" },
});
/** @type {__VLS_StyleScopedClasses['eyebrow']} */ ;
(__VLS_ctx.roleLabel);
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    id: (`npc-${__VLS_ctx.npc.id}`),
});
(__VLS_ctx.npc.name);
if (!__VLS_ctx.conversationComplete) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        'aria-label': "对话进度",
    });
    (__VLS_ctx.lineIndex + 1);
    (__VLS_ctx.lines.length);
}
if (!__VLS_ctx.conversationComplete) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.advance) },
        ...{ class: "gal-advance" },
        type: "button",
    });
    /** @type {__VLS_StyleScopedClasses['gal-advance']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "gal-dialog-text" },
        'aria-live': "polite",
    });
    /** @type {__VLS_StyleScopedClasses['gal-dialog-text']} */ ;
    (__VLS_ctx.currentLine);
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({});
    let __VLS_0;
    /** @ts-ignore @type { | typeof __VLS_components.ChevronDown} */
    ChevronDown;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        size: (18),
        'aria-hidden': "true",
    }));
    const __VLS_2 = __VLS_1({
        size: (18),
        'aria-hidden': "true",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "gal-choice-stage" },
    });
    /** @type {__VLS_StyleScopedClasses['gal-choice-stage']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "gal-choices" },
    });
    /** @type {__VLS_StyleScopedClasses['gal-choices']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.conversationComplete))
                    throw 0;
                return (__VLS_ctx.$emit('close'));
                // @ts-ignore
                [npc, npc, npc, npc, useFallbackPortrait, portraitSrc, roleLabel, conversationComplete, conversationComplete, lineIndex, lines, advance, currentLine, $emit,];
            } },
        ...{ class: "button ghost" },
        type: "button",
    });
    /** @type {__VLS_StyleScopedClasses['button']} */ ;
    /** @type {__VLS_StyleScopedClasses['ghost']} */ ;
    let __VLS_5;
    /** @ts-ignore @type { | typeof __VLS_components.DoorOpen} */
    DoorOpen;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
        size: (19),
        'aria-hidden': "true",
    }));
    const __VLS_7 = __VLS_6({
        size: (19),
        'aria-hidden': "true",
    }, ...__VLS_functionalComponentArgsRest(__VLS_6));
    if (__VLS_ctx.canBattle) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.conversationComplete))
                        throw 0;
                    if (!(__VLS_ctx.canBattle))
                        throw 0;
                    return (__VLS_ctx.$emit('battle', __VLS_ctx.npc.id));
                    // @ts-ignore
                    [npc, $emit, canBattle,];
                } },
            ...{ class: "button primary" },
            type: "button",
            disabled: (__VLS_ctx.loading),
        });
        /** @type {__VLS_StyleScopedClasses['button']} */ ;
        /** @type {__VLS_StyleScopedClasses['primary']} */ ;
        let __VLS_10;
        /** @ts-ignore @type { | typeof __VLS_components.Swords} */
        Swords;
        // @ts-ignore
        const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
            size: (19),
            'aria-hidden': "true",
        }));
        const __VLS_12 = __VLS_11({
            size: (19),
            'aria-hidden': "true",
        }, ...__VLS_functionalComponentArgsRest(__VLS_11));
        (__VLS_ctx.loading ? '准备中…' : '对战');
    }
}
// @ts-ignore
[loading, loading,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
