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
const avatarGender = ref('female');
const usernameError = ref('');
const passwordError = ref('');
const emailError = ref('');
const usernameInput = ref(null);
const passwordInput = ref(null);
const emailInput = ref(null);
function clearFieldErrors() {
    usernameError.value = '';
    passwordError.value = '';
    emailError.value = '';
}
function changeMode(nextMode) {
    mode.value = nextMode;
    clearFieldErrors();
}
function validateUsername() {
    const value = username.value.trim();
    if (!value)
        usernameError.value = '请输入账户名';
    else if (mode.value === 'register' && value.length < 3)
        usernameError.value = '账户名至少需要 3 位';
    else if (mode.value === 'register' && !/^[A-Za-z0-9_]+$/.test(value))
        usernameError.value = '账户名只能包含英文、数字和下划线';
    else
        usernameError.value = '';
    return !usernameError.value;
}
function validatePassword() {
    if (!password.value)
        passwordError.value = '请输入密码';
    else if (mode.value === 'register' && password.value.length < 8)
        passwordError.value = '密码至少需要 8 位';
    else
        passwordError.value = '';
    return !passwordError.value;
}
function validateEmail() {
    if (mode.value !== 'register' || !email.value.trim() || emailInput.value?.validity.valid)
        emailError.value = '';
    else
        emailError.value = '请输入有效的邮箱地址';
    return !emailError.value;
}
async function submit() {
    const usernameValid = validateUsername();
    const passwordValid = validatePassword();
    const emailValid = validateEmail();
    if (!usernameValid || !passwordValid || !emailValid) {
        if (!usernameValid)
            usernameInput.value?.focus();
        else if (!passwordValid)
            passwordInput.value?.focus();
        else
            emailInput.value?.focus();
        return;
    }
    try {
        if (mode.value === 'login')
            await session.login(username.value.trim(), password.value);
        else
            await session.register(username.value.trim(), password.value, email.value.trim(), playerName.value.trim(), avatarGender.value);
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
            return (__VLS_ctx.changeMode('login'));
            // @ts-ignore
            [changeMode,];
        } },
    ...{ class: ({ active: __VLS_ctx.mode === 'login' }) },
    role: "tab",
    'aria-selected': (__VLS_ctx.mode === 'login'),
    type: "button",
});
/** @type {__VLS_StyleScopedClasses['active']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            return (__VLS_ctx.changeMode('register'));
            // @ts-ignore
            [changeMode, mode, mode,];
        } },
    ...{ class: ({ active: __VLS_ctx.mode === 'register' }) },
    role: "tab",
    'aria-selected': (__VLS_ctx.mode === 'register'),
    type: "button",
});
/** @type {__VLS_StyleScopedClasses['active']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.form, __VLS_intrinsics.form)({
    ...{ onSubmit: (__VLS_ctx.submit) },
    novalidate: true,
});
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
(__VLS_ctx.mode === 'login' ? '欢迎回来，旅人' : '写下冒险的第一页');
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
(__VLS_ctx.mode === 'login' ? '登录后继续上次的旅途。' : '创建账户，开启新的冒险。');
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input, __VLS_intrinsics.input)({
    ...{ onBlur: (__VLS_ctx.validateUsername) },
    ...{ onInput: (...[$event]) => {
            return (__VLS_ctx.usernameError && __VLS_ctx.validateUsername());
            // @ts-ignore
            [mode, mode, mode, mode, submit, validateUsername, validateUsername, usernameError,];
        } },
    ref: "usernameInput",
    name: "username",
    maxlength: "64",
    autocomplete: "username",
    required: true,
    placeholder: (__VLS_ctx.mode === 'register' ? '3-64 位，仅限英文、数字和下划线' : '输入账户名'),
    'aria-invalid': (Boolean(__VLS_ctx.usernameError)),
    'aria-describedby': "username-error",
});
(__VLS_ctx.username);
if (__VLS_ctx.usernameError) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({
        id: "username-error",
        ...{ class: "field-error" },
        role: "alert",
    });
    /** @type {__VLS_StyleScopedClasses['field-error']} */ ;
    (__VLS_ctx.usernameError);
}
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
    __VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({
        ...{ class: "avatar-picker" },
    });
    /** @type {__VLS_StyleScopedClasses['avatar-picker']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: ({ selected: __VLS_ctx.avatarGender === 'female' }) },
    });
    /** @type {__VLS_StyleScopedClasses['selected']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "radio",
        name: "avatar-gender",
        value: "female",
    });
    (__VLS_ctx.avatarGender);
    __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
        src: "/assets/generated/sprites/adventurer-female.png",
        alt: "女冒险者",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: ({ selected: __VLS_ctx.avatarGender === 'male' }) },
    });
    /** @type {__VLS_StyleScopedClasses['selected']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "radio",
        name: "avatar-gender",
        value: "male",
    });
    (__VLS_ctx.avatarGender);
    __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
        src: "/assets/generated/sprites/adventurer-male.png",
        alt: "男冒险者",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
}
if (__VLS_ctx.mode === 'register') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input, __VLS_intrinsics.input)({
        ...{ onBlur: (__VLS_ctx.validateEmail) },
        ...{ onInput: (...[$event]) => {
                if (!(__VLS_ctx.mode === 'register'))
                    throw 0;
                return (__VLS_ctx.emailError && __VLS_ctx.validateEmail());
                // @ts-ignore
                [mode, mode, mode, mode, usernameError, usernameError, usernameError, username, playerName, avatarGender, avatarGender, avatarGender, avatarGender, validateEmail, validateEmail, emailError,];
            } },
        ref: "emailInput",
        name: "email",
        type: "email",
        autocomplete: "email",
        placeholder: "name@example.com",
        'aria-invalid': (Boolean(__VLS_ctx.emailError)),
        'aria-describedby': "email-error",
    });
    (__VLS_ctx.email);
    if (__VLS_ctx.emailError) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({
            id: "email-error",
            ...{ class: "field-error" },
            role: "alert",
        });
        /** @type {__VLS_StyleScopedClasses['field-error']} */ ;
        (__VLS_ctx.emailError);
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input, __VLS_intrinsics.input)({
    ...{ onBlur: (__VLS_ctx.validatePassword) },
    ...{ onInput: (...[$event]) => {
            return (__VLS_ctx.passwordError && __VLS_ctx.validatePassword());
            // @ts-ignore
            [emailError, emailError, emailError, email, validatePassword, validatePassword, passwordError,];
        } },
    ref: "passwordInput",
    name: "password",
    type: "password",
    maxlength: "128",
    autocomplete: (__VLS_ctx.mode === 'login' ? 'current-password' : 'new-password'),
    required: true,
    placeholder: (__VLS_ctx.mode === 'register' ? '至少 8 位密码' : '输入密码'),
    'aria-invalid': (Boolean(__VLS_ctx.passwordError)),
    'aria-describedby': "password-error",
});
(__VLS_ctx.password);
if (__VLS_ctx.passwordError) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.small, __VLS_intrinsics.small)({
        id: "password-error",
        ...{ class: "field-error" },
        role: "alert",
    });
    /** @type {__VLS_StyleScopedClasses['field-error']} */ ;
    (__VLS_ctx.passwordError);
}
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
[mode, mode, mode, mode, passwordError, passwordError, passwordError, password, session, session, session, session, LogIn, UserPlus,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
});
export default {};
