<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowRight, Check, Circle, Compass, Footprints, MoonStar } from 'lucide-vue-next'
import type { OpeningStory } from '@/api/types'

const props = defineProps<{
  story: OpeningStory
  loading: boolean
}>()

const emit = defineEmits<{
  start: []
  complete: []
  dismissDialogue: []
}>()

const completionStep = ref(0)
const completionLine = computed(
  () => props.story.completion_dialogue?.[completionStep.value] ?? null,
)
const trackedObjective = computed(
  () => props.story.main_quest?.objective ?? props.story.objective,
)

watch(() => props.story.completion_dialogue, () => {
  completionStep.value = 0
})

function advanceCompletion(): void {
  const lines = props.story.completion_dialogue ?? []
  if (completionStep.value + 1 < lines.length) {
    completionStep.value += 1
  } else {
    emit('dismissDialogue')
  }
}
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

  <div v-else-if="completionLine" class="opening-backdrop">
    <section class="opening-prologue opening-completion" role="dialog" aria-modal="true" aria-label="露娜返村疗养">
      <div class="opening-sigil" aria-hidden="true"><MoonStar :size="34" /></div>
      <p class="eyebrow">MOON TRACE · {{ completionStep + 1 }}/{{ story.completion_dialogue?.length }}</p>
      <h1>{{ completionLine.speaker }}</h1>
      <div class="opening-lines"><p>{{ completionLine.text }}</p></div>
      <button class="button primary" type="button" :disabled="loading" @click="advanceCompletion">
        {{ completionStep + 1 === story.completion_dialogue?.length ? '开始月痕追迹' : '继续' }}
        <ArrowRight :size="18" />
      </button>
    </section>
  </div>

  <aside v-else class="opening-tracker glass-panel" :aria-label="story.completed ? '长期主线' : '序章任务'">
    <header>
      <span><MoonStar :size="16" />{{ story.completed ? `主线 · ${story.main_quest?.title ?? '月痕追迹'}` : `序章 · ${story.title}` }}</span>
      <strong>{{ trackedObjective.title }}</strong>
    </header>
    <p>{{ trackedObjective.description }}</p>
    <div v-if="story.stage === 'prepare'" class="opening-task-list">
      <div v-for="task in story.tasks" :key="task.id" :class="{ done: task.ready }">
        <Check v-if="task.ready" :size="14" aria-hidden="true" />
        <Circle v-else :size="14" aria-hidden="true" />
        <span>{{ task.title }}</span>
        <small>{{ task.ready ? '完成' : `${task.current}/${task.target}` }}</small>
      </div>
    </div>
    <div v-else-if="story.main_quest?.stage === 'moon_trace_evidence'" class="opening-task-list">
      <div v-for="evidence in story.main_quest.evidence" :key="evidence.id" :class="{ done: evidence.completed }">
        <Check v-if="evidence.completed" :size="14" aria-hidden="true" />
        <Circle v-else :size="14" aria-hidden="true" />
        <span>{{ evidence.name }}</span>
        <small>{{ evidence.completed ? '已记录' : '待调查' }}</small>
      </div>
    </div>
    <div v-else class="opening-direction">
      <Compass :size="16" aria-hidden="true" />
      <span>{{
        story.main_quest?.stage === 'moon_trace_battle'
          ? '雾痕兽影位于断月雾核处'
          : story.main_quest?.stage === 'moon_trace_return'
            ? '沿传送路标返回晨曦村疗养点'
            : story.stage === 'forest_signal'
              ? '月光空地位于森林西北侧'
              : story.stage === 'return_village'
                ? '护送露娜沿传送路标返回晨曦村'
                : story.main_quest?.stage === 'moon_trace_stage1_complete'
                  ? '长期主线保持追踪，后续阶段尚未开放'
                  : '前往任务角色所在位置'
      }}</span>
    </div>
    <button
      v-if="story.stage === 'return_village' && story.can_complete"
      class="button small"
      type="button"
      :disabled="loading"
      @click="$emit('complete')"
    >
      <MoonStar :size="17" />{{ loading ? '正在安置…' : '安置露娜并完成序章' }}
    </button>
  </aside>
</template>
