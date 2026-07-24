<script setup lang="ts">
import { Check, Circle, Compass, Footprints, MoonStar } from 'lucide-vue-next'
import type { OpeningStory } from '@/api/types'

defineProps<{
  story: OpeningStory
  loading: boolean
}>()

defineEmits<{
  start: []
  complete: []
}>()
</script>

<template>
  <div v-if="story.stage === 'arrival'" class="opening-backdrop">
    <section class="opening-prologue" role="dialog" aria-modal="true" aria-labelledby="opening-title">
      <div class="opening-sigil" aria-hidden="true"><MoonStar :size="34" /></div>
      <p class="eyebrow">PROLOGUE</p>
      <h1 id="opening-title">{{ story.title }}</h1>
      <div class="opening-lines">
        <p v-for="line in story.intro_lines" :key="line">{{ line }}</p>
      </div>
      <button class="button primary" type="button" :disabled="loading" @click="$emit('start')">
        <Footprints :size="18" />{{ loading ? '正在记录旅程…' : '进入晨曦村' }}
      </button>
    </section>
  </div>

  <aside v-else-if="!story.completed" class="opening-tracker glass-panel" aria-label="序章任务">
    <header>
      <span><MoonStar :size="16" />序章 · {{ story.title }}</span>
      <strong>{{ story.objective.title }}</strong>
    </header>
    <p>{{ story.objective.description }}</p>
    <div v-if="story.stage === 'prepare'" class="opening-task-list">
      <div v-for="task in story.tasks" :key="task.id" :class="{ done: task.ready }">
        <Check v-if="task.ready" :size="14" aria-hidden="true" />
        <Circle v-else :size="14" aria-hidden="true" />
        <span>{{ task.title }}</span>
        <small>{{ task.ready ? '完成' : `${task.current}/${task.target}` }}</small>
      </div>
    </div>
    <div v-else class="opening-direction">
      <Compass :size="16" aria-hidden="true" />
      <span>{{ story.stage === 'forest_signal' ? '月光空地位于森林西北侧' : '沿传送路标返回晨曦村' }}</span>
    </div>
    <button
      v-if="story.stage === 'return_village' && story.can_complete"
      class="button small"
      type="button"
      :disabled="loading"
      @click="$emit('complete')"
    >
      <MoonStar :size="17" />{{ loading ? '正在汇报…' : '向村长汇报' }}
    </button>
  </aside>
</template>
