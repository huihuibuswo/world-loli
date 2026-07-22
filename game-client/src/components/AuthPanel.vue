<script setup lang="ts">
import { ref } from 'vue'
import { LogIn, Sparkles, UserPlus } from 'lucide-vue-next'
import { useSessionStore } from '@/stores/session'

const emit = defineEmits<{ authenticated: [] }>()
const session = useSessionStore()
const mode = ref<'login' | 'register'>('login')
const username = ref('')
const password = ref('')
const email = ref('')
const playerName = ref('')
const avatarGender = ref<'female' | 'male'>('female')
const usernameError = ref('')
const passwordError = ref('')
const emailError = ref('')
const usernameInput = ref<HTMLInputElement | null>(null)
const passwordInput = ref<HTMLInputElement | null>(null)
const emailInput = ref<HTMLInputElement | null>(null)

function clearFieldErrors(): void {
  usernameError.value = ''
  passwordError.value = ''
  emailError.value = ''
}

function changeMode(nextMode: 'login' | 'register'): void {
  mode.value = nextMode
  clearFieldErrors()
}

function validateUsername(): boolean {
  const value = username.value.trim()
  if (!value) usernameError.value = '请输入账户名'
  else if (mode.value === 'register' && value.length < 3) usernameError.value = '账户名至少需要 3 位'
  else if (mode.value === 'register' && !/^[A-Za-z0-9_]+$/.test(value)) usernameError.value = '账户名只能包含英文、数字和下划线'
  else usernameError.value = ''
  return !usernameError.value
}

function validatePassword(): boolean {
  if (!password.value) passwordError.value = '请输入密码'
  else if (mode.value === 'register' && password.value.length < 8) passwordError.value = '密码至少需要 8 位'
  else passwordError.value = ''
  return !passwordError.value
}

function validateEmail(): boolean {
  if (mode.value !== 'register' || !email.value.trim() || emailInput.value?.validity.valid) emailError.value = ''
  else emailError.value = '请输入有效的邮箱地址'
  return !emailError.value
}

async function submit(): Promise<void> {
  const usernameValid = validateUsername()
  const passwordValid = validatePassword()
  const emailValid = validateEmail()
  if (!usernameValid || !passwordValid || !emailValid) {
    if (!usernameValid) usernameInput.value?.focus()
    else if (!passwordValid) passwordInput.value?.focus()
    else emailInput.value?.focus()
    return
  }

  try {
    if (mode.value === 'login') await session.login(username.value.trim(), password.value)
    else await session.register(username.value.trim(), password.value, email.value.trim(), playerName.value.trim(), avatarGender.value)
    emit('authenticated')
  } catch { /* store exposes the user-facing error */ }
}
</script>

<template>
  <section class="auth-page">
    <div class="auth-hero" aria-labelledby="game-title">
      <div class="brand-mark"><Sparkles :size="28" aria-hidden="true" /></div>
      <p class="eyebrow">WORLD · CARD SPIRIT</p>
      <h1 id="game-title">世界树下的<br><span>卡灵物语</span></h1>
      <p class="hero-copy">穿过雾林，结识卡灵，用手中的故事回应每一次挑战。</p>
      <div class="hero-orbit" aria-hidden="true"><i /><i /><i /></div>
    </div>

    <div class="auth-card">
      <div class="auth-tabs" role="tablist" aria-label="账户操作">
        <button :class="{ active: mode === 'login' }" role="tab" :aria-selected="mode === 'login'" type="button" @click="changeMode('login')">登录</button>
        <button :class="{ active: mode === 'register' }" role="tab" :aria-selected="mode === 'register'" type="button" @click="changeMode('register')">创建角色</button>
      </div>
      <form novalidate @submit.prevent="submit">
        <header>
          <h2>{{ mode === 'login' ? '欢迎回来，旅人' : '写下冒险的第一页' }}</h2>
          <p>{{ mode === 'login' ? '登录后继续上次的旅途。' : '创建账户，开启新的冒险。' }}</p>
        </header>
        <label>
          账户名
          <input ref="usernameInput" v-model="username" name="username" maxlength="64" autocomplete="username" required :placeholder="mode === 'register' ? '3-64 位，仅限英文、数字和下划线' : '输入账户名'" :aria-invalid="Boolean(usernameError)" aria-describedby="username-error" @blur="validateUsername" @input="usernameError && validateUsername()">
          <small v-if="usernameError" id="username-error" class="field-error" role="alert">{{ usernameError }}</small>
        </label>
        <label v-if="mode === 'register'">角色名<input v-model="playerName" name="nickname" maxlength="32" autocomplete="nickname" placeholder="为空则使用账户名"></label>
        <fieldset v-if="mode === 'register'" class="avatar-picker">
          <legend>选择冒险者</legend>
          <label :class="{ selected: avatarGender === 'female' }">
            <input v-model="avatarGender" type="radio" name="avatar-gender" value="female">
            <img src="/assets/generated/sprites/adventurer-female.png" alt="女冒险者">
            <span>女冒险者</span>
          </label>
          <label :class="{ selected: avatarGender === 'male' }">
            <input v-model="avatarGender" type="radio" name="avatar-gender" value="male">
            <img src="/assets/generated/sprites/adventurer-male.png" alt="男冒险者">
            <span>男冒险者</span>
          </label>
        </fieldset>
        <label v-if="mode === 'register'">
          邮箱（选填）
          <input ref="emailInput" v-model="email" name="email" type="email" autocomplete="email" placeholder="name@example.com" :aria-invalid="Boolean(emailError)" aria-describedby="email-error" @blur="validateEmail" @input="emailError && validateEmail()">
          <small v-if="emailError" id="email-error" class="field-error" role="alert">{{ emailError }}</small>
        </label>
        <label>
          密码
          <input ref="passwordInput" v-model="password" name="password" type="password" maxlength="128" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" required :placeholder="mode === 'register' ? '至少 8 位密码' : '输入密码'" :aria-invalid="Boolean(passwordError)" aria-describedby="password-error" @blur="validatePassword" @input="passwordError && validatePassword()">
          <small v-if="passwordError" id="password-error" class="field-error" role="alert">{{ passwordError }}</small>
        </label>
        <p v-if="session.error" class="form-error" role="alert">{{ session.error }}</p>
        <button class="button primary submit" type="submit" :disabled="session.loading">
          <component :is="mode === 'login' ? LogIn : UserPlus" :size="19" aria-hidden="true" />
          {{ session.loading ? '请稍候…' : mode === 'login' ? '进入世界' : '开始冒险' }}
        </button>
      </form>
    </div>
  </section>
</template>
