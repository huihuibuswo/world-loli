<script setup lang="ts">
import { defineAsyncComponent, ref, watch } from 'vue'
import AuthPanel from '@/components/AuthPanel.vue'
import { useSessionStore } from '@/stores/session'
import { useGameStore } from '@/stores/game'

const GameShell = defineAsyncComponent(() => import('@/components/GameShell.vue'))

const session = useSessionStore()
const game = useGameStore()
const initializing = ref(false)

async function enterWorld(): Promise<void> {
  if (initializing.value) return
  initializing.value = true
  try { await game.bootstrap() } finally { initializing.value = false }
}

function logout(): void {
  game.reset()
  session.logout()
}

watch(() => session.authenticated, (authenticated) => {
  if (authenticated && !game.player) void enterWorld()
}, { immediate: true })
</script>

<template>
  <main id="main-content" class="app-root">
    <AuthPanel v-if="!session.authenticated" @authenticated="enterWorld" />
    <div v-else-if="game.loading || initializing" class="loading-screen" role="status">
      <span class="loader" aria-hidden="true" />
      <p>正在唤醒世界树……</p>
    </div>
    <Suspense v-else-if="game.player && game.map">
      <GameShell @logout="logout" />
      <template #fallback>
        <div class="loading-screen" role="status">
          <span class="loader" aria-hidden="true" />
          <p>正在载入冒险世界……</p>
        </div>
      </template>
    </Suspense>
    <section v-else class="fatal-card" role="alert">
      <h1>暂时无法进入世界</h1>
      <p>{{ game.error || '角色或地图数据不完整，请稍后重试。' }}</p>
      <button class="button primary" type="button" @click="enterWorld">重新连接</button>
      <button class="button ghost" type="button" @click="logout">返回登录</button>
    </section>
  </main>
</template>
