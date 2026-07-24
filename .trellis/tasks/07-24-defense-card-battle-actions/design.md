# Technical Design

## Boundary

改动限制在 `game-client` 表现层与生成资源。服务端继续权威结算，客户端仅将 `BattleData.last_action` 投影为视觉步骤。

## Assets

- 卡面：`public/assets/generated/cards/basic-defense.webp`。
- 玩家：`adventurer-{female,male}-defense-sheet.png`，每张 4 帧横排。
- 敌人：`npc-*-combat-sheet.png`，单帧 256 × 256，4 列 × 5 行，行顺序为 attack、defense、hit、death、victory。
- 源图保存在 `art-source/generated/`，运行时资源保存在 `public/assets/generated/`。

## Visual Contract

```ts
type BattleVisualStep = {
  actor: 'player' | 'enemy'
  kind: 'attack' | 'defense'
  damage: number
  blocked: number
  shield: number
  targetDefeated: boolean
}

type BattleVisualSequence = {
  steps: BattleVisualStep[]
  result: BattleData['status']
}
```

`BattlePanel` 是 API 状态到视觉事件的唯一投影边界。`BattleScene` 串行消费 steps，`CardSpirit` 只负责具体角色动作。

## Playback

- attack：攻击者 attack，在命中节点触发目标 hit 或格挡反馈。
- defense：行动者 defense，并显示短暂护盾弧，不触发对方 hit。
- 敌方连续牌逐张播放，不合并、不重排。
- 视觉队列完成前保持现有 `actionLoading` 或独立 visual lock。
- Scene shutdown 清理队列、延迟回调与监听器。

## Fallback

预加载时始终保留静态敌人纹理。若对应 combat texture/animation 不存在，`CardSpirit` 使用当前通用 Tween。玩家 defense sheet 缺失时使用原地缩放和护盾特效。

## Compatibility

不增加 API 字段。现有玩家 `CardData.type/effect` 和敌方 `last_action.cards` 已满足动作投影。旧战斗数据缺少 cards 时保留当前单动作降级。
