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

async function submit(): Promise<void> {
  try {
    if (mode.value === 'login') await session.login(username.value.trim(), password.value)
    else await session.register(username.value.trim(), password.value, email.value.trim(), playerName.value.trim())
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
        <button :class="{ active: mode === 'login' }" role="tab" :aria-selected="mode === 'login'" type="button" @click="mode = 'login'">登录</button>
        <button :class="{ active: mode === 'register' }" role="tab" :aria-selected="mode === 'register'" type="button" @click="mode = 'register'">创建角色</button>
      </div>
      <form @submit.prevent="submit">
        <header>
          <h2>{{ mode === 'login' ? '欢迎回来，旅人' : '写下冒险的第一页' }}</h2>
          <p>{{ mode === 'login' ? '登录后继续上次的旅途。' : '账户名至少 3 位，密码至少 6 位。' }}</p>
        </header>
        <label>账户名<input v-model="username" name="username" minlength="3" maxlength="32" autocomplete="username" required placeholder="输入账户名"></label>
        <label v-if="mode === 'register'">角色名<input v-model="playerName" name="nickname" maxlength="32" autocomplete="nickname" placeholder="为空则使用账户名"></label>
        <label v-if="mode === 'register'">邮箱（选填）<input v-model="email" name="email" type="email" autocomplete="email" placeholder="name@example.com"></label>
        <label>密码<input v-model="password" name="password" type="password" minlength="6" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" required placeholder="输入密码"></label>
        <p v-if="session.error" class="form-error" role="alert">{{ session.error }}</p>
        <button class="button primary submit" type="submit" :disabled="session.loading">
          <component :is="mode === 'login' ? LogIn : UserPlus" :size="19" aria-hidden="true" />
          {{ session.loading ? '请稍候…' : mode === 'login' ? '进入世界' : '开始冒险' }}
        </button>
      </form>
    </div>
  </section>
</template>
