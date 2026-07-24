<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ArrowUpCircle,
  BriefcaseBusiness,
  ChevronDown,
  Coins,
  DoorOpen,
  Gift,
  Heart,
  MapPinned,
  MessageCircle,
  PackageCheck,
  RotateCcw,
  ScrollText,
  Send,
  ShoppingBasket,
  Swords,
} from 'lucide-vue-next'
import type {
  NpcAffection,
  NpcChatState,
  NpcData,
  NpcGiftOptions,
  NpcGiftResult,
  NpcServiceData,
} from '@/api/types'

const props = defineProps<{
  npc: NpcData
  chat: NpcChatState | null
  loading: boolean
  chatLoading: boolean
  sendMessage: (message: string) => Promise<void>
  affection: NpcAffection | null
  giftOptions: NpcGiftOptions | null
  lastGift: NpcGiftResult | null
  service: NpcServiceData | null
  giveGift: (giftType: 'plant' | 'item', templateId: number) => Promise<void>
  purchaseItem: (shopItemId: number) => Promise<void>
  upgradeCard: (cardId: number) => Promise<void>
  acceptQuest: (questId: number) => Promise<void>
  completeQuest: (questId: number) => Promise<void>
}>()
const emit = defineEmits<{ close: []; battle: [id: number] }>()

const lineIndex = ref(0)
const portraitSrc = ref('')
const draft = ref('')
const failedMessage = ref('')
const sendFailed = ref(false)
const selectedGiftKey = ref('')
const panelMode = ref<'chat' | 'service'>('chat')
const dialogRoot = ref<HTMLElement | null>(null)
const lines = computed(() => props.npc.dialogue?.length
  ? props.npc.dialogue
  : [props.npc.story || '风掠过树梢，对方正静静等待你的回应。'])
const conversationComplete = computed(() => lineIndex.value >= lines.value.length)
const currentLine = computed(() => lines.value[Math.min(lineIndex.value, lines.value.length - 1)])
const latestTurn = computed(() => props.chat?.turns.at(-1))
const npcLine = computed(() => props.chat?.reply || latestTurn.value?.npc || currentLine.value)
const canBattle = computed(() => (props.npc.actions ?? []).includes('battle'))
const fallbackPortrait = computed(() => `/assets/generated/sprites/${props.npc.sprite || 'npc-trainer'}.png`)
const roleLabel = computed(() => ({
  shop: '晨曦杂货商',
  craft: '村庄锻造师',
  quest: '森林引路人',
  training: '实战教官',
  dialogue: '晨曦村村长',
}[props.npc.type] ?? '旅途相遇'))
const affectionPercent = computed(() => `${Math.round((props.affection?.level_progress ?? 0) * 100)}%`)
const latestRewards = computed(() => props.lastGift?.rewards ?? props.chat?.affection_change?.rewards ?? [])
const giftUnavailable = computed(() => (
  props.loading
  || (props.affection?.points ?? 0) >= (props.affection?.max_points ?? 100)
  || !props.giftOptions?.remaining_gifts
  || !(props.giftOptions.plants.length + props.giftOptions.items.length)
))
const serviceAvailable = computed(() => props.service && props.service.kind !== 'none')
const serviceLabel = computed(() => ({
  shop: props.npc.type === 'craft' ? '锻造用品' : '购买杂货',
  quest: '村务委托',
  guide: '探索情报',
  training: '卡牌训练',
  none: '职业服务',
}[props.service?.kind ?? 'none']))

function resetConversation(): void {
  lineIndex.value = props.chat?.turns.length ? lines.value.length : 0
  draft.value = ''
  failedMessage.value = ''
  sendFailed.value = false
  selectedGiftKey.value = ''
  panelMode.value = serviceAvailable.value ? 'service' : 'chat'
  portraitSrc.value = props.npc.portrait || fallbackPortrait.value
  void nextTick(() => dialogRoot.value?.focus())
}

async function submitGift(): Promise<void> {
  if (!selectedGiftKey.value || props.loading) return
  const [giftType, rawId] = selectedGiftKey.value.split(':')
  const templateId = Number(rawId)
  if ((giftType !== 'plant' && giftType !== 'item') || !Number.isInteger(templateId)) return
  await props.giveGift(giftType, templateId)
  selectedGiftKey.value = ''
}

function advance(): void {
  if (!conversationComplete.value) {
    lineIndex.value += 1
    if (conversationComplete.value) {
      void nextTick(() => dialogRoot.value?.querySelector<HTMLButtonElement>('button')?.focus())
    }
  }
}

function useFallbackPortrait(): void {
  if (portraitSrc.value !== fallbackPortrait.value) portraitSrc.value = fallbackPortrait.value
}

async function submit(message = draft.value): Promise<void> {
  const text = message.trim()
  if (!text || props.chatLoading) return
  sendFailed.value = false
  failedMessage.value = text
  try {
    await props.sendMessage(text)
    draft.value = ''
    failedMessage.value = ''
  } catch {
    sendFailed.value = true
  }
}

function onDraftKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void submit()
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    emit('close')
    return
  }
  if (event.key !== 'Tab' || !dialogRoot.value) return
  const controls = [...dialogRoot.value.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
  if (!controls.length) {
    event.preventDefault()
    return
  }
  const first = controls[0]
  const last = controls[controls.length - 1]
  if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRoot.value)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(() => props.npc.id, resetConversation)
onMounted(() => {
  resetConversation()
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="gal-dialog-backdrop">
    <section ref="dialogRoot" class="gal-dialog" role="dialog" aria-modal="true" :aria-labelledby="`npc-${npc.id}`" tabindex="-1">
      <aside v-if="conversationComplete" class="gal-response-panel" aria-label="玩家回应">
        <header>
          <div>
            <p class="eyebrow">与 {{ npc.name }} 互动</p>
            <strong>{{ panelMode === 'service' ? serviceLabel : '交流与赠礼' }}</strong>
          </div>
          <span v-if="panelMode === 'chat'">{{ draft.length }} / 500</span>
        </header>

        <nav class="npc-service-tabs" aria-label="NPC互动方式">
          <button type="button" :class="{ active: panelMode === 'chat' }" @click="panelMode = 'chat'">
            <MessageCircle :size="17" aria-hidden="true" />交流
          </button>
          <button v-if="serviceAvailable" type="button" :class="{ active: panelMode === 'service' }" @click="panelMode = 'service'">
            <BriefcaseBusiness :size="17" aria-hidden="true" />{{ serviceLabel }}
          </button>
        </nav>

        <div v-if="panelMode === 'chat'" class="npc-panel-scroll">
          <div v-if="affection" class="gal-affection" aria-label="NPC好感">
            <Heart :size="17" aria-hidden="true" />
            <strong>好感 Lv.{{ affection.level }}</strong>
            <span>{{ affection.points }} / {{ affection.max_points }}</span>
            <div><i :style="{ width: affectionPercent }" /></div>
            <small>{{ affection.next_level_points ? `距下一等级还差 ${affection.points_to_next} 点` : '好感已满' }}</small>
          </div>

          <form class="gal-gift-form" @submit.prevent="submitGift">
            <label :for="`npc-gift-${npc.id}`"><Gift :size="15" aria-hidden="true" />赠送礼物</label>
            <div>
              <select
                :id="`npc-gift-${npc.id}`"
                v-model="selectedGiftKey"
                :disabled="giftUnavailable"
              >
                <option value="">选择礼物</option>
                <optgroup v-if="giftOptions?.items.length" label="杂货">
                  <option v-for="item in giftOptions?.items ?? []" :key="`item-${item.id}`" :value="`item:${item.id}`">
                    {{ item.name }} ×{{ item.amount }}
                  </option>
                </optgroup>
                <optgroup v-if="giftOptions?.plants.length" label="植物">
                  <option v-for="plant in giftOptions?.plants ?? []" :key="`plant-${plant.id}`" :value="`plant:${plant.id}`">
                    {{ plant.name }} ×{{ plant.amount }}
                  </option>
                </optgroup>
              </select>
              <button class="icon-button" type="submit" title="赠送礼物" aria-label="赠送礼物" :disabled="giftUnavailable || !selectedGiftKey">
                <Gift :size="19" />
              </button>
            </div>
            <small>{{ affection?.points === affection?.max_points ? '好感已满' : `今日还可赠送 ${giftOptions?.remaining_gifts ?? 0} 次` }}</small>
          </form>

          <p v-if="lastGift" class="gal-gift-feedback">{{ lastGift.dialogue }}</p>
          <p v-if="latestRewards.length" class="gal-reward-feedback">
            获得：{{ latestRewards.map((reward) => reward.name).join('、') }}
          </p>

          <div class="gal-suggestions" aria-label="快捷回复">
            <button
              v-for="suggestion in chat?.suggested_replies ?? npc.ai.fallback_replies"
              :key="suggestion"
              type="button"
              :disabled="chatLoading"
              @click="submit(suggestion)"
            >{{ suggestion }}</button>
          </div>

          <form class="gal-chat-form" @submit.prevent="submit()">
            <label :for="`npc-reply-${npc.id}`">自由输入</label>
            <div>
              <textarea
                :id="`npc-reply-${npc.id}`"
                v-model="draft"
                maxlength="500"
                rows="2"
                :disabled="chatLoading"
                :placeholder="`对 ${npc.name} 说些什么`"
                @keydown="onDraftKeydown"
              />
              <button class="icon-button" type="submit" aria-label="发送" title="发送" :disabled="chatLoading || !draft.trim()">
                <Send :size="20" />
              </button>
            </div>
          </form>

          <div class="gal-response-status" aria-live="polite">
            <span v-if="chatLoading" class="gal-thinking">{{ npc.name }}正在思考…</span>
            <span v-else-if="sendFailed" class="gal-error-status">回应没有送达</span>
            <span v-else-if="chat?.mode === 'fallback'" class="gal-fallback-status">当前使用备用回应</span>
            <span v-else>选择一句，或写下自己的回答</span>
            <button v-if="sendFailed" type="button" :disabled="chatLoading" @click="submit(failedMessage)">
              <RotateCcw :size="16" aria-hidden="true" />重试
            </button>
          </div>
        </div>

        <div v-else class="npc-panel-scroll npc-service-content" aria-live="polite">
          <div v-if="service?.kind === 'shop'" class="npc-shop-list">
            <div class="npc-service-balance"><Coins :size="17" /><strong>{{ service.gold }}</strong><span>金币</span><small v-if="service.discount_percent">好感折扣 {{ service.discount_percent }}%</small></div>
            <article v-for="item in service.items" :key="item.shop_item_id" class="npc-service-item">
              <img v-if="item.icon" :src="item.icon" :alt="item.name">
              <div><strong>{{ item.name }}</strong><small>{{ item.description }}</small><span>库存 {{ item.remaining_stock }} / {{ item.stock_limit }} · 持有 {{ item.amount }}</span></div>
              <button class="icon-button" type="button" :title="`购买 ${item.name}`" :aria-label="`购买 ${item.name}`" :disabled="loading || !item.unlocked || item.remaining_stock < 1 || service.gold < item.price" @click="purchaseItem(item.shop_item_id)">
                <ShoppingBasket v-if="item.unlocked" :size="19" />
                <PackageCheck v-else :size="19" />
              </button>
              <b>{{ item.unlocked ? `${item.price} 金币` : `Lv.${item.unlock_level} 解锁` }}</b>
            </article>
          </div>

          <div v-else-if="service?.kind === 'training'" class="npc-training-list">
            <div class="npc-service-balance"><Coins :size="17" /><strong>{{ service.gold }}</strong><span>金币</span></div>
            <article v-for="card in service.cards" :key="card.id" class="npc-service-item compact">
              <div><strong>{{ card.name }} · Lv.{{ card.level }}</strong><small>伤害 {{ card.effect.damage ?? 0 }} → {{ card.next_effect.damage }} · 护盾 {{ card.effect.shield ?? 0 }} → {{ card.next_effect.shield }}</small><span>训练费用 {{ card.upgrade_cost }} 金币</span></div>
              <button class="icon-button" type="button" :title="`升级 ${card.name}`" :aria-label="`升级 ${card.name}`" :disabled="loading || !card.can_upgrade || service.gold < card.upgrade_cost" @click="upgradeCard(card.id)">
                <ArrowUpCircle :size="20" />
              </button>
            </article>
          </div>

          <div v-else-if="service?.kind === 'quest'" class="npc-quest-list">
            <article v-for="quest in service.quests" :key="quest.id" class="npc-service-item compact">
              <ScrollText :size="22" aria-hidden="true" />
              <div><strong>{{ quest.title }}</strong><small>{{ quest.description }}</small><span>报酬 {{ quest.reward.gold ?? 0 }} 金币 · {{ quest.status === 'completed' ? '已完成' : quest.status === 'active' ? '进行中' : '可领取' }}</span></div>
              <button v-if="quest.status === 'not_started'" class="button small" type="button" :disabled="loading" @click="acceptQuest(quest.id)">领取</button>
              <button v-else-if="quest.status === 'active' && quest.progress.ready" class="button small" type="button" :disabled="loading" @click="completeQuest(quest.id)">提交</button>
            </article>
            <p v-if="!service.quests.length" class="empty-state">目前没有新的村务委托。</p>
          </div>

          <div v-else-if="service?.kind === 'guide'" class="npc-guide-list">
            <article v-for="plant in service.plants" :key="plant.id" class="npc-service-item compact">
              <MapPinned :size="22" aria-hidden="true" />
              <div><strong>{{ plant.name }}</strong><small>{{ plant.description }}</small><span>{{ plant.habitats.length ? plant.habitats.join('；') : '具体位置尚未记录' }}<template v-if="plant.respawn_seconds"> · 约 {{ Math.ceil(plant.respawn_seconds / 60) }} 分钟刷新</template></span></div>
            </article>
          </div>

          <p v-else class="empty-state">{{ service?.description || '当前没有可用服务。' }}</p>
        </div>
      </aside>

      <div class="gal-dialog-frame">
        <div class="gal-portrait-stage">
          <img :src="portraitSrc" :alt="`${npc.name}的角色立绘`" @error="useFallbackPortrait">
        </div>

        <div class="gal-dialog-panel">
          <header class="gal-speaker">
            <div><p class="eyebrow">{{ roleLabel }}</p><h2 :id="`npc-${npc.id}`">{{ npc.name }}</h2></div>
            <span v-if="!conversationComplete" aria-label="对话进度">{{ lineIndex + 1 }} / {{ lines.length }}</span>
          </header>

          <button v-if="!conversationComplete" class="gal-advance" type="button" @click="advance">
            <span class="gal-dialog-text" aria-live="polite">{{ currentLine }}</span>
            <small>点击继续 <ChevronDown :size="18" aria-hidden="true" /></small>
          </button>

          <div v-else class="gal-live-dialogue">
            <p class="gal-dialog-text" aria-live="polite">{{ npcLine }}</p>
            <div class="gal-dialog-actions">
              <span v-if="chatLoading" aria-hidden="true">•••</span>
              <span v-else />
              <div class="gal-choices">
                <button class="button ghost" type="button" @click="$emit('close')"><DoorOpen :size="19" aria-hidden="true" />离开</button>
                <button v-if="canBattle" class="button primary" type="button" :disabled="loading" @click="$emit('battle', npc.id)">
                  <Swords :size="19" aria-hidden="true" />{{ loading ? '准备中…' : '对战' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
