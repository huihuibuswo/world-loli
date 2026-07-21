import { Swords, X } from 'lucide-vue-next';
const __VLS_props = defineProps();
const __VLS_emit = defineEmits();
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
    ...{ class: "modal-backdrop" },
});
/** @type {__VLS_StyleScopedClasses['modal-backdrop']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "dialog-card" },
    role: "dialog",
    'aria-modal': "true",
    'aria-labelledby': (`npc-${__VLS_ctx.npc.id}`),
});
/** @type {__VLS_StyleScopedClasses['dialog-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            return (__VLS_ctx.$emit('close'));
            // @ts-ignore
            [$emit, npc,];
        } },
    ...{ class: "icon-button close" },
    type: "button",
    'aria-label': "关闭对话",
});
/** @type {__VLS_StyleScopedClasses['icon-button']} */ ;
/** @type {__VLS_StyleScopedClasses['close']} */ ;
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
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "npc-portrait" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['npc-portrait']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.npc.name.slice(0, 1));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "eyebrow" },
});
/** @type {__VLS_StyleScopedClasses['eyebrow']} */ ;
(__VLS_ctx.npc.type === 'enemy' ? '林间挑战者' : '旅途相遇');
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    id: (`npc-${__VLS_ctx.npc.id}`),
});
(__VLS_ctx.npc.name);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "dialog-story" },
});
/** @type {__VLS_StyleScopedClasses['dialog-story']} */ ;
(__VLS_ctx.npc.story || '风掠过树梢，对方正静静等待你的回应。');
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "dialog-actions" },
});
/** @type {__VLS_StyleScopedClasses['dialog-actions']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            return (__VLS_ctx.$emit('battle', __VLS_ctx.npc.id));
            // @ts-ignore
            [$emit, npc, npc, npc, npc, npc, npc,];
        } },
    ...{ class: "button primary" },
    type: "button",
    disabled: (__VLS_ctx.loading),
});
/** @type {__VLS_StyleScopedClasses['button']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
let __VLS_5;
/** @ts-ignore @type { | typeof __VLS_components.Swords} */
Swords;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    size: (19),
    'aria-hidden': "true",
}));
const __VLS_7 = __VLS_6({
    size: (19),
    'aria-hidden': "true",
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
(__VLS_ctx.loading ? '准备中…' : '接受挑战');
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            return (__VLS_ctx.$emit('close'));
            // @ts-ignore
            [$emit, loading, loading,];
        } },
    ...{ class: "button ghost" },
    type: "button",
});
/** @type {__VLS_StyleScopedClasses['button']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost']} */ ;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
