import { ref, watch } from 'vue';
import AuthPanel from '@/components/AuthPanel.vue';
import GameShell from '@/components/GameShell.vue';
import { useSessionStore } from '@/stores/session';
import { useGameStore } from '@/stores/game';
const session = useSessionStore();
const game = useGameStore();
const initializing = ref(false);
async function enterWorld() {
    if (initializing.value)
        return;
    initializing.value = true;
    try {
        await game.bootstrap();
    }
    finally {
        initializing.value = false;
    }
}
function logout() {
    game.reset();
    session.logout();
}
watch(() => session.authenticated, (authenticated) => {
    if (authenticated && !game.player)
        void enterWorld();
}, { immediate: true });
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.main, __VLS_intrinsics.main)({
    id: "main-content",
    ...{ class: "app-root" },
});
/** @type {__VLS_StyleScopedClasses['app-root']} */ ;
if (!__VLS_ctx.session.authenticated) {
    const __VLS_0 = AuthPanel;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ 'onAuthenticated': {} },
    }));
    const __VLS_2 = __VLS_1({
        ...{ 'onAuthenticated': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    let __VLS_5;
    const __VLS_6 = {
        /** @type {typeof __VLS_5.authenticated} */
        onAuthenticated: (__VLS_ctx.enterWorld),
    };
    var __VLS_3;
    var __VLS_4;
}
else if (__VLS_ctx.game.loading || __VLS_ctx.initializing) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "loading-screen" },
        role: "status",
    });
    /** @type {__VLS_StyleScopedClasses['loading-screen']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
        ...{ class: "loader" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['loader']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
}
else if (__VLS_ctx.game.player && __VLS_ctx.game.map) {
    const __VLS_7 = GameShell;
    // @ts-ignore
    const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
        ...{ 'onLogout': {} },
    }));
    const __VLS_9 = __VLS_8({
        ...{ 'onLogout': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    let __VLS_12;
    const __VLS_13 = {
        /** @type {typeof __VLS_12.logout} */
        onLogout: (__VLS_ctx.logout),
    };
    var __VLS_10;
    var __VLS_11;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "fatal-card" },
        role: "alert",
    });
    /** @type {__VLS_StyleScopedClasses['fatal-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h1, __VLS_intrinsics.h1)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    (__VLS_ctx.game.error || '角色或地图数据不完整，请稍后重试。');
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.enterWorld) },
        ...{ class: "button primary" },
        type: "button",
    });
    /** @type {__VLS_StyleScopedClasses['button']} */ ;
    /** @type {__VLS_StyleScopedClasses['primary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.logout) },
        ...{ class: "button ghost" },
        type: "button",
    });
    /** @type {__VLS_StyleScopedClasses['button']} */ ;
    /** @type {__VLS_StyleScopedClasses['ghost']} */ ;
}
// @ts-ignore
[session, enterWorld, enterWorld, game, game, game, game, initializing, logout, logout,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
