import { ref } from 'vue';
import { LogIn, Sparkles, UserPlus } from 'lucide-vue-next';
import { useSessionStore } from '@/stores/session';
const emit = defineEmits();
const session = useSessionStore();
const mode = ref('login');
const username = ref('');
const password = ref('');
const email = ref('');
const playerName = ref('');
async function submit() {
    try {
        if (mode.value === 'login')
            await session.login(username.value.trim(), password.value);
        else
            await session.register(username.value.trim(), password.value, email.value.trim(), playerName.value.trim());
        emit('authenticated');
    }
    catch { /* store exposes the user-facing error */ }
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
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "auth-page" },
});
/** @type {__VLS_StyleScopedClasses['auth-page']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "auth-hero" },
    'aria-labelledby': "game-title",
});
/** @type {__VLS_StyleScopedClasses['auth-hero']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "brand-mark" },
});
/** @type {__VLS_StyleScopedClasses['brand-mark']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.Sparkles} */
Sparkles;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    size: (28),
    'aria-hidden': "true",
}));
const __VLS_2 = __VLS_1({
    size: (28),
    'aria-hidden': "true",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "eyebrow" },
});
/** @type {__VLS_StyleScopedClasses['eyebrow']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h1, __VLS_intrinsics.h1)({
    id: "game-title",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.br)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "hero-copy" },
});
/** @type {__VLS_StyleScopedClasses['hero-copy']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "hero-orbit" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['hero-orbit']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.i)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.i)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.i)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "auth-card" },
});
/** @type {__VLS_StyleScopedClasses['auth-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "auth-tabs" },
    role: "tablist",
    'aria-label': "账户操作",
});
/** @type {__VLS_StyleScopedClasses['auth-tabs']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            return (__VLS_ctx.mode = 'login');
            // @ts-ignore
            [mode,];
        } },
    ...{ class: ({ active: __VLS_ctx.mode === 'login' }) },
    role: "tab",
    'aria-selected': (__VLS_ctx.mode === 'login'),
    type: "button",
});
/** @type {__VLS_StyleScopedClasses['active']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            return (__VLS_ctx.mode = 'register');
            // @ts-ignore
            [mode, mode, mode,];
        } },
    ...{ class: ({ active: __VLS_ctx.mode === 'register' }) },
    role: "tab",
    'aria-selected': (__VLS_ctx.mode === 'register'),
    type: "button",
});
/** @type {__VLS_StyleScopedClasses['active']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.form, __VLS_intrinsics.form)({
    ...{ onSubmit: (__VLS_ctx.submit) },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
(__VLS_ctx.mode === 'login' ? '欢迎回来，旅人' : '写下冒险的第一页');
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
(__VLS_ctx.mode === 'login' ? '登录后继续上次的旅途。' : '账户名至少 3 位，密码至少 6 位。');
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    name: "username",
    minlength: "3",
    maxlength: "32",
    autocomplete: "username",
    required: true,
    placeholder: "输入账户名",
});
(__VLS_ctx.username);
if (__VLS_ctx.mode === 'register') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        name: "nickname",
        maxlength: "32",
        autocomplete: "nickname",
        placeholder: "为空则使用账户名",
    });
    (__VLS_ctx.playerName);
}
if (__VLS_ctx.mode === 'register') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        name: "email",
        type: "email",
        autocomplete: "email",
        placeholder: "name@example.com",
    });
    (__VLS_ctx.email);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    name: "password",
    type: "password",
    minlength: "6",
    autocomplete: (__VLS_ctx.mode === 'login' ? 'current-password' : 'new-password'),
    required: true,
    placeholder: "输入密码",
});
(__VLS_ctx.password);
if (__VLS_ctx.session.error) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "form-error" },
        role: "alert",
    });
    /** @type {__VLS_StyleScopedClasses['form-error']} */ ;
    (__VLS_ctx.session.error);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ class: "button primary submit" },
    type: "submit",
    disabled: (__VLS_ctx.session.loading),
});
/** @type {__VLS_StyleScopedClasses['button']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
/** @type {__VLS_StyleScopedClasses['submit']} */ ;
const __VLS_5 = (__VLS_ctx.mode === 'login' ? __VLS_ctx.LogIn : __VLS_ctx.UserPlus);
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    size: (19),
    'aria-hidden': "true",
}));
const __VLS_7 = __VLS_6({
    size: (19),
    'aria-hidden': "true",
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
(__VLS_ctx.session.loading ? '请稍候…' : __VLS_ctx.mode === 'login' ? '进入世界' : '开始冒险');
// @ts-ignore
[mode, mode, mode, mode, mode, mode, mode, mode, mode, submit, username, playerName, email, password, session, session, session, session, LogIn, UserPlus,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
});
export default {};
