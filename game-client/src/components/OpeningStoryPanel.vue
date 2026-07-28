<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  ArrowRight,
  Check,
  ChevronDown,
  Circle,
  Compass,
  Footprints,
  MoonStar,
  Play,
  SkipForward,
} from 'lucide-vue-next'
import type { OpeningStory } from '@/api/types'

const OPENING_VIDEO_SRC = '/assets/generated/videos/opening/s0-moon-trace.mp4'
const SKIP_DELAY_SECONDS = 3

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
const selectedTaskKey = ref<string | null>(null)
const openingVideo = ref<HTMLVideoElement | null>(null)
const videoStarted = ref(false)
const videoNeedsGesture = ref(false)
const videoFailed = ref(false)
const skipAvailable = ref(false)
const leavingOpening = ref(false)
const completionLine = computed(
  () => props.story.completion_dialogue?.[completionStep.value] ?? null,
)
const trackedObjective = computed(
  () => props.story.main_quest?.objective ?? props.story.objective,
)
const selectedTask = computed(() => {
  if (!selectedTaskKey.value) return null

  if (selectedTaskKey.value.startsWith('task:')) {
    const id = Number(selectedTaskKey.value.slice(5))
    const task = props.story.tasks.find((item) => item.id === id)
    if (!task) return null

    return {
      title: task.title,
      description: task.description,
      status: task.ready ? '已完成' : `进行中 · ${task.current}/${task.target}`,
    }
  }

  const id = selectedTaskKey.value.slice(9)
  const evidence = props.story.main_quest?.evidence.find((item) => item.id === id)
  if (!evidence) return null

  return {
    title: evidence.name,
    description: evidence.description,
    status: evidence.completed ? '已记录' : '待调查',
  }
})

watch(() => props.story.completion_dialogue, () => {
  completionStep.value = 0
})

watch(() => props.story.main_quest?.stage ?? props.story.stage, () => {
  selectedTaskKey.value = null

  if (props.story.stage === 'arrival') {
    videoStarted.value = false
    videoNeedsGesture.value = false
    videoFailed.value = false
    skipAvailable.value = false
    leavingOpening.value = false
  }
})

watch(() => props.loading, (loading, wasLoading) => {
  if (!loading && wasLoading && props.story.stage === 'arrival') leavingOpening.value = false
})

async function playOpeningVideo(): Promise<void> {
  const video = openingVideo.value
  if (!video || videoFailed.value) return

  try {
    await video.play()
    videoNeedsGesture.value = false
  } catch {
    videoNeedsGesture.value = true
  }
}

function handleVideoPlay(): void {
  videoStarted.value = true
  videoNeedsGesture.value = false
}

function handleVideoTimeUpdate(): void {
  const video = openingVideo.value
  if (video && video.currentTime >= SKIP_DELAY_SECONDS) skipAvailable.value = true
}

function handleVideoError(): void {
  videoFailed.value = true
  videoNeedsGesture.value = false
}

function finishOpeningVideo(): void {
  if (leavingOpening.value || props.loading) return

  leavingOpening.value = true
  openingVideo.value?.pause()
  emit('start')
}

function toggleTask(key: string): void {
  selectedTaskKey.value = selectedTaskKey.value === key ? null : key
}

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
  <div v-if="story.stage === 'arrival'" class="opening-backdrop opening-cinematic-backdrop">
    <section
      v-if="!videoFailed"
      class="opening-cinematic"
      role="dialog"
      aria-modal="true"
      aria-label="冷开场：月痕"
    >
      <video
        ref="openingVideo"
        class="opening-cinematic-video"
        :src="OPENING_VIDEO_SRC"
        autoplay
        playsinline
        preload="auto"
        @canplay="playOpeningVideo"
        @play="handleVideoPlay"
        @timeupdate="handleVideoTimeUpdate"
        @ended="finishOpeningVideo"
        @error="handleVideoError"
      />
      <div class="opening-cinematic-vignette" aria-hidden="true" />
      <p v-if="!videoStarted && !videoNeedsGesture" class="opening-video-status">正在载入冷开场…</p>
      <button
        v-if="videoNeedsGesture"
        class="button primary opening-video-play"
        type="button"
        :disabled="loading || leavingOpening"
        @click="playOpeningVideo"
      >
        <Play :size="19" fill="currentColor" />播放冷开场
      </button>
      <button
        v-if="skipAvailable"
        class="opening-video-skip"
        type="button"
        :disabled="loading || leavingOpening"
        aria-label="跳过冷开场"
        @click="finishOpeningVideo"
      >
        <SkipForward :size="18" />跳过
      </button>
    </section>

    <section v-else class="opening-prologue" role="dialog" aria-modal="true" aria-labelledby="opening-title">
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

  <aside v-else-if="story.stage !== 'meet_chief'" class="opening-tracker glass-panel" :aria-label="story.completed ? '长期主线' : '序章任务'">
    <header>
      <span><MoonStar :size="16" />{{ story.completed ? `主线 · ${story.main_quest?.title ?? '月痕追迹'}` : `序章 · ${story.title}` }}</span>
      <strong>{{ trackedObjective.title }}</strong>
    </header>
    <p>{{ trackedObjective.description }}</p>
    <div v-if="story.stage === 'prepare'" class="opening-task-list">
      <button
        v-for="task in story.tasks"
        :key="task.id"
        type="button"
        :class="{ done: task.ready, selected: selectedTaskKey === `task:${task.id}` }"
        :aria-expanded="selectedTaskKey === `task:${task.id}`"
        aria-controls="opening-task-detail"
        @click="toggleTask(`task:${task.id}`)"
      >
        <Check v-if="task.ready" :size="14" aria-hidden="true" />
        <Circle v-else :size="14" aria-hidden="true" />
        <span>{{ task.title }}</span>
        <small>{{ task.ready ? '完成' : `${task.current}/${task.target}` }}</small>
        <ChevronDown :size="14" aria-hidden="true" />
      </button>
    </div>
    <div v-else-if="story.main_quest?.stage === 'moon_trace_evidence'" class="opening-task-list">
      <button
        v-for="evidence in story.main_quest.evidence"
        :key="evidence.id"
        type="button"
        :class="{ done: evidence.completed, selected: selectedTaskKey === `evidence:${evidence.id}` }"
        :aria-expanded="selectedTaskKey === `evidence:${evidence.id}`"
        aria-controls="opening-task-detail"
        @click="toggleTask(`evidence:${evidence.id}`)"
      >
        <Check v-if="evidence.completed" :size="14" aria-hidden="true" />
        <Circle v-else :size="14" aria-hidden="true" />
        <span>{{ evidence.name }}</span>
        <small>{{ evidence.completed ? '已记录' : '待调查' }}</small>
        <ChevronDown :size="14" aria-hidden="true" />
      </button>
    </div>
    <section v-if="selectedTask" id="opening-task-detail" class="opening-task-detail" aria-live="polite">
      <div><strong>{{ selectedTask.title }}</strong><small>{{ selectedTask.status }}</small></div>
      <p>{{ selectedTask.description }}</p>
    </section>
    <div
      v-if="story.stage !== 'prepare' && story.main_quest?.stage !== 'moon_trace_evidence'"
      class="opening-direction"
    >
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
