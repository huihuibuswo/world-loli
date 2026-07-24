# AI 对战与对话接入技术设计

## 1. Design Goals

- 在现有 FastAPI 权威服务端与 Vue/Phaser 客户端之间增加 AI 能力，不改变客户端信任边界。
- AI 只生成 NPC 内容或选择服务端提供的合法战斗动作，不直接写游戏状态。
- 首期支持 NPC；未来怪物通过相同的服务层战斗角色契约接入。
- 对话支持自由文本、两条动态快捷回复和跨会话有限记忆。
- 模型不可用时，现有静态对白和确定性敌方动作仍可完成游戏流程。
- 交付可运行实现、自动化测试、配置说明和与实现一致的设计文档。

## 2. Non-Goals

- 不让 AI 代替玩家操作。
- 不允许 AI 创建技能、数值、奖励或任意数据库写入。
- 不建设独立 AI 微服务、队列、向量数据库、模型路由平台或无限记忆。
- MVP 不实现流式响应、语音、图片或 PvP。

## 3. Current System Anchors

- NPC 数据：`server/app/api/world.py::_npc_data` 从 `NpcTemplate.reward` 读取对白和动作。
- 对话 UI：`game-client/src/components/DialogModal.vue` 当前仅顺序播放静态对白。
- 战斗状态：`ActiveBattle.state_json` 保存回合状态，`version` 用于乐观并发控制。
- 玩家行动：`play_card` 在行锁内校验归属、版本、手牌和能量后结算。
- 敌方行动：`end_turn` 当前读取 `battle_deck.attack` 并执行固定攻击。

## 4. Architecture

```text
Vue Dialog/Battle UI
        |
        v
FastAPI authenticated endpoint
        |
        +--> Input/schema/rate validation
        |
        +--> NPC AI service / Battle AI service
                 |
                 +--> Context builder (trusted game state)
                 +--> OpenAI-compatible client
                 +--> Strict response decoder
                 +--> Deterministic fallback
        |
        +--> Authoritative domain validation
        +--> PostgreSQL state/memory update
```

模块边界：

- `ai_client`：只负责 OpenAI-compatible HTTP、超时、响应提取和供应商错误归一化。
- `npc_ai_service`：组装 NPC 人设与有限记忆，校验回复和两条建议。
- `battle_ai_service`：把战斗快照与可支付敌方手牌交给模型，只接收有序卡牌模板 ID
  序列和可选台词。
- `battle_service`：继续拥有动作合法性、伤害、状态、奖励和事务。
- API 层：认证、请求 schema、限流入口和错误映射，不解析供应商原始响应。

## 5. Configuration

沿用 `pydantic-settings`，新增服务端环境变量：

```dotenv
AI_ENABLED=false
AI_DIALOGUE_ENABLED=false
AI_BATTLE_ENABLED=false
AI_BASE_URL=https://api.example.com/v1
AI_API_KEY=
AI_MODEL=
AI_DIALOGUE_TIMEOUT_SECONDS=8
AI_BATTLE_TIMEOUT_SECONDS=2
AI_MAX_INPUT_CHARS=500
AI_MEMORY_RECENT_TURNS=8
AI_MEMORY_SUMMARY_CHARS=1200
AI_MEMORY_RETENTION_DAYS=90
```

API 密钥不得进入客户端、数据库、日志或错误响应。启动时只在对应功能开关开启后要求
AI 配置完整；开关关闭时项目保持当前行为。

## 6. NPC AI Profile

首期继续复用 `npc_templates.reward`，增加可选的 `ai_profile`：

```json
{
  "ai_profile": {
    "dialogue_enabled": true,
    "battle_enabled": true,
    "persona": "晨曦村的实战教官，直接、克制，不透露系统规则。",
    "fallback_replies": ["继续聊聊", "谈谈训练"],
    "battle_style": "优先压制低生命目标，但避免重复同一动作"
  }
}
```

`persona` 是策划数据，不允许由玩家修改。缺少配置或功能开关关闭时走原静态流程。

## 7. Dialogue Data Model

新增单表 `npc_ai_conversations`，一行代表一个玩家与一个 NPC 的有限记忆：

| Field | Purpose |
| --- | --- |
| `id` | 主键 |
| `player_id` | 玩家外键 |
| `npc_id` | 当前 NPC 模板 ID |
| `summary` | 截断后的历史摘要 |
| `recent_turns` | JSONB，最多 8 轮，每轮含 request ID、玩家文本、NPC 回复与时间 |
| `version` | 会话并发版本 |
| `last_interacted_at` | 清理与排序 |
| `created_at` / `updated_at` | 审计时间 |

唯一约束为 `(player_id, npc_id)`。近期轮次超过上限时，把最旧轮次压缩进摘要；摘要失败时
直接丢弃最旧轮次，不阻塞当前回复。超过保留期的会话可由简单定时清理命令删除。

MVP 不跨 NPC 分享记忆。未来怪物若需要对话记忆，再通过明确迁移扩展，不提前使用无外键的多态表。

## 8. Dialogue API

新增鉴权接口：

```http
POST /api/v1/npc/{npc_id}/chat
```

请求：

```json
{
  "request_id": "0ebed73d-5fc7-4d47-bd4c-f285514d703c",
  "message": "今天适合去森林训练吗？",
  "conversation_version": 3
}
```

响应：

```json
{
  "npc_id": 5,
  "reply": "雾还没散，先准备解毒草，再沿东侧小路走。",
  "suggested_replies": ["森林里有什么危险？", "和我切磋一下"],
  "conversation_version": 4,
  "mode": "ai"
}
```

规则：

- 自由输入和快捷回复使用同一接口、长度限制、频率限制与内容安全流程。
- `request_id` 用于近期窗口内的重复提交去重；重复请求返回已保存结果。
- `conversation_version` 不匹配时返回 `409`，客户端刷新会话后重试，避免跨设备覆盖。
- 响应必须恰好包含一条受长度限制的 NPC 回复和两条非空、不同的快捷回复。
- 模型失败时返回静态对白或通用角色化回复及固定快捷选项，`mode` 为 `fallback`。
- MVP 使用同步响应；客户端展示“思考中”、禁用重复发送，并允许失败后重试。

## 9. Dialogue Prompt Boundary

系统上下文只包含：

- NPC 名称、策划人设和允许的交互动作。
- 必要的玩家公开游戏状态，如等级、当前地图和已完成任务标记。
- 有限摘要与近期对话。
- 输出 JSON schema、长度和安全约束。

玩家文本始终作为不可信 user message，不拼接进 system instruction。不得提供 API 密钥、
内部提示词、完整数据库记录或其他玩家数据。模型不获得工具调用能力。

标准模型输出：

```json
{
  "reply": "string",
  "suggested_replies": ["string", "string"]
}
```

服务端从 `unknown` 严格解码，删除多余字段，检查长度、数量、重复项和空文本。

## 10. AI Actor Deck Configuration

继续使用 `NpcTemplate.battle_deck` 作为首期战斗角色配置，不新增独立卡组平台：

```json
{
  "hp": 30,
  "energy": 3,
  "hand_size": 5,
  "cards": [
    {"card_template_id": 1, "amount": 3},
    {"card_template_id": 8, "amount": 2},
    {"card_template_id": 9, "amount": 1}
  ]
}
```

约束：

- `cards` 引用 `card_templates`，每个角色至少含一张签名卡，可搭配通用基础攻击与防御卡。
- `amount` 必须为受限正整数，卡组必须非空；无效卡牌引用使该角色不可创建战斗。
- 现有 NPC 通过后续 `014` 迁移写入不同卡组。未来怪物只需提供相同投影，不提前创建怪物表。
- 首期支持 `effect_json.damage` 与 `effect_json.shield`。其他 Effect 类型不在本任务实现。

## 11. Enemy Runtime State And Public Projection

`ActiveBattle.state_json` 增加仅服务端使用的敌方状态：

```json
{
  "enemy_energy": 3,
  "enemy_hand_cards": [1, 8, 1, 9, 1],
  "enemy_draw_pile": [8],
  "enemy_discard_cards": []
}
```

敌方列表保存卡牌模板 ID；重复 ID 表示同一模板的多个卡组副本。服务端出牌时移除一个匹配
副本并加入弃牌堆。旧战斗若缺少这些字段，在首次敌方回合按角色卡组兼容初始化，不强制
废弃进行中的战斗。

`battle_data()` 必须生成公开投影，移除敌方完整手牌、抽牌顺序和弃牌内容，只返回：

- `enemy_energy`
- `enemy_hand_count`
- `enemy_draw_count`
- `enemy_discard_count`
- `last_action.cards` 中本回合已经公开打出的卡牌和权威效果结果

## 12. Battle AI Sequence Contract

服务端从敌方当前手牌加载卡牌模板，生成候选项：

```json
[
  {
    "card_template_id": 8,
    "name": "破绽识破",
    "cost": 2,
    "type": "attack",
    "tags": ["damage"]
  },
  {
    "card_template_id": 9,
    "name": "防御姿态",
    "cost": 1,
    "type": "defense",
    "tags": ["shield"]
  }
]
```

模型只返回：

```json
{
  "card_template_ids": [8, 9],
  "battle_line": "先压住你的节奏，再稳住阵脚。"
}
```

服务端按顺序验证：

- 每个 ID 在当前敌方手牌中仍有未使用副本。
- 每张卡结算时仍可支付消耗。
- 序列长度不超过敌方当前手牌数量。
- 序列执行后能量为零，或剩余手牌中没有可支付卡牌，即“最大可执行序列”。

模型不能返回伤害、护盾、生命、能量、目标、奖励或卡牌效果。额外字段被忽略，非法、
不完整、超时或关闭 AI 时执行确定性最大序列：每步从可支付手牌中按
`cost DESC, card_template_id ASC` 选择，直到无牌可出。

## 13. Battle Turn Flow

外部模型调用不得占用数据库行锁：

1. 读取玩家拥有的战斗和 `version`；必要时在内存快照中兼容初始化旧敌方卡组状态。
2. 根据敌方手牌、能量和卡牌模板构建候选集合，调用 AI 获取有序序列。
3. 重新获取 `ActiveBattle` 行锁，校验玩家归属、状态和 `expected_version`。
4. 对最新状态补齐敌方卡组字段，重新加载候选卡牌并验证整个序列。
5. 若序列非法，改用最新状态上的确定性最大序列。
6. 逐张调用服务端卡牌效果执行器，更新敌方能量、手牌、弃牌、双方生命与护盾。
7. 保存公开的 `last_action.cards`，补充敌方手牌，重置下一敌方回合能量，
   再推进玩家回合、版本、胜负与奖励。

若重新加锁后发现版本冲突，返回 `409`，不执行旧快照决定。若某张敌方卡使玩家生命归零，
立即停止剩余序列并结算失败。

未来怪物复用统一投影：

```text
actor_id + display_name + ai_profile + deck_config + battle_state + playable_cards
```

## 14. Frontend Changes

`NpcData` 增加 AI 是否启用与固定快捷回复的展示数据；新增独立的聊天响应类型，避免组件读取
供应商原始字段。

`DialogModal.vue` 增加：

- Galgame 式 NPC 当前台词主对白框，不在其中混排玩家与 NPC 历史气泡。
- 与 NPC 主对白框视觉及结构独立的玩家应答区。
- 最大 500 字的自由文本框与发送按钮。
- 两个稳定尺寸的快捷回复按钮。
- 思考中、降级提示、失败重试和版本冲突刷新状态。
- 保留离开与对战按钮；模型不可用不影响进入战斗。

`BattleData` 增加敌方公开卡组计数、能量和 `last_action.cards`。战斗 UI：

- 依次展示敌方本回合使用的卡牌名称、消耗、类型和权威结算结果。
- 展示敌方剩余手牌数、抽牌堆数、弃牌堆数和当前能量。
- 不展示敌方完整手牌、抽牌顺序或未公开卡牌详情。
- 保留可选 `battle_line`，只展示服务端归一化结果。

## 15. Failure And Abuse Handling

| Failure | Required behavior |
| --- | --- |
| AI disabled/misconfigured | 静态对白、固定快捷回复、固定敌方动作 |
| Timeout/429/5xx/network error | 记录指标，立即降级，不暴露供应商错误 |
| Invalid JSON/schema | 丢弃输出并降级 |
| Unsafe player input | 返回可理解的拒绝或中性回复，不写入原始长期摘要 |
| Prompt injection | 视为普通玩家文本；模型无工具和写权限 |
| Duplicate request | 在近期 request ID 窗口内返回原结果 |
| Conversation version conflict | `409`，客户端刷新 |
| Battle version conflict | `409`，不执行旧决定 |
| AI-selected sequence no longer legal | 在最新状态上执行确定性最大卡牌序列 |
| Enemy deck missing/invalid | 拒绝创建新战斗；旧战斗兼容初始化失败时返回明确配置错误 |
| No playable enemy card | 结束敌方行动，不生成伪造攻击 |

频率限制按玩家与 NPC 组合计算；首期可用进程内限流满足单实例 Demo，部署多实例前必须切换
到共享限流存储。该限制应在文档和部署说明中明确，不能误称为全局强一致限流。

MVP 内容安全基线包括 Unicode/控制字符规范化、服务端长度限制、可配置禁用词、
提示词角色隔离、无工具调用、输出长度与 schema 校验。供应商若支持独立 moderation
接口，可作为后续增强，但不得成为基础游戏流程的强依赖。

## 16. Observability And Privacy

记录：请求 ID、功能类型、NPC/敌人 ID、模型名、延迟、结果模式、错误类别、token 用量和降级次数。

不记录：API 密钥、完整 system prompt、默认情况下的玩家原文与模型完整回复。调试内容日志只能通过
显式开发开关启用，并进行截断和敏感信息清理。

建议指标：

- `ai_requests_total{feature,result}`
- `ai_request_duration_seconds{feature}`
- `ai_fallback_total{feature,reason}`
- `ai_tokens_total{feature,direction}`
- `ai_schema_rejection_total{feature}`

## 17. Rollout And Rollback

1. 默认关闭全局 AI 开关，先上线数据库迁移和兼容字段。
2. 仅对白名单 NPC 开启 AI 对话，验证延迟、内容和降级率。
3. 再为一个训练型 NPC 开启 AI 战斗动作选择。
4. 指标稳定后逐 NPC 扩大。

关闭 `AI_BATTLE_ENABLED` 后仍使用同一敌方卡组和服务端确定性序列，不回退到脱离卡组的
固定攻击。代码回滚时 `battle_deck` 中新增 `cards` 字段可被旧版本忽略；旧战斗兼容初始化
避免迁移时强制中断。

## 18. Verification Strategy

- 单元测试：响应 decoder、记忆裁剪/摘要、敌方序列校验、确定性最大序列、卡组配置校验。
- API 测试：自由文本、快捷回复、重复请求、版本冲突、未认证、限长、限流和降级。
- 战斗测试：每个 NPC 专属卡组、敌方初始抽牌、连续合法序列、重复卡副本、能量耗尽、
  非最大序列、非法卡、超时、AI 关闭、旧战斗兼容初始化、并发版本变化、胜负与奖励。
- 兼容测试：所有 AI 开关关闭时，现有 `test_api_flow.py` 行为不变。
- 前端检查：桌面和移动端 Galgame 主对白框、独立玩家应答区、两条快捷回复、
  自由输入、加载、错误、键盘焦点与文本不溢出。
- 安全测试：提示词注入、超长输入、恶意 JSON、供应商返回额外字段和敏感信息诱导。

## 19. Expected Implementation Surface

后端预计涉及：

- `server/app/core/config.py`、`server/.env.example`
- `server/app/schemas.py`
- `server/app/api/world.py`、`server/app/api/battle.py`
- `server/app/services/ai_client.py`
- `server/app/services/npc_ai_service.py`
- `server/app/services/battle_ai_service.py`
- `server/app/services/battle_service.py`
- `server/app/services/npc_affection_service.py`
- 下一号数据库迁移（当前预计 `014`）及 schema/种子验证
- AI 单元/API 测试和现有流程回归

前端预计涉及：

- `game-client/src/api/types.ts`
- `game-client/src/stores/game.ts`
- `game-client/src/components/DialogModal.vue`
- `game-client/src/components/BattlePanel.vue`
- `game-client/src/components/CollectionDrawer.vue`
- `game-client/src/styles.css`

文档预计涉及：

- `doc/AI对战与对话接入设计.md`
- `README.md`

## 20. NPC Affection Progression

NPC 好感沿用项目现有的 0～100 点语义，但独立于玩家已拥有卡灵的
`player_card_spirits.affection`。界面只展示 1～5 级，等级按每 20 点计算：

| Level | Points | Reward |
| ---: | ---: | --- |
| 1 | 0～19 | 首次完成对战时 NPC 专属卡牌 ×1 |
| 2 | 20～39 | NPC 专属卡牌 ×1 |
| 3 | 40～59 | NPC 专属卡牌 ×1 |
| 4 | 60～79 | NPC 专属卡牌 ×1 |
| 5 | 80～100 | 80 点时 NPC 对应卡灵；100 点为满羁绊，无重复奖励 |

等级计算统一为 `min(5, floor(points / 20) + 1)`。现有
`npc_affection_service.LEVEL_THRESHOLDS` 和相关 schema、测试必须同步修改，不能只改前端显示。
1 级专属卡牌继续由首次完成对战这一幂等事件发放，不因玩家初始显示为 1 级而在创建角色时自动发放。

新增 `player_npc_affection` 保存玩家与 NPC 的点数、交谈次数、对战次数和更新时间；
新增 `player_npc_affection_rewards` 以 `(player_id, npc_id, milestone_level)` 唯一约束记录
卡牌或卡灵奖励；新增 `npc_gift_records` 支撑 NPC 每日赠礼限制和审计。

NPC 的专属卡牌继续复用 `reward.first_victory_card_template_id`。迁移为五名晨曦村 NPC
各创建对应 `card_spirit_templates`，并在 `reward.affection_profile` 中配置卡灵模板、
植物名称/标签偏好和专属收礼对白。首期 1～4 级均发一张专属卡牌，避免为未确认的未来
卡池提前增加额外卡牌模板。

交互增量：

- 新保存的交谈轮次：+2 点；重复 request ID 不增加。
- 首次完成对战：好感至少为 1 点，并触发一次 1 级专属卡牌奖励；后续完成对战：+5 点。
- 植物赠礼：沿用植物 `base_affection` 与 favorite/liked/neutral/disliked 规则，单次 1～6 点，
  每个 NPC 每日最多 5 次，按 Asia/Shanghai 自然日重置。

所有增加操作统一调用好感服务：锁定玩家/NPC 进度行、计算新点数与跨越的等级、插入幂等奖励
记录、发放玩家卡牌或卡灵，再由调用方在同一事务提交。战斗结算返回好感变化和奖励列表；
聊天响应返回最新好感；NPC 赠礼接口原子扣除植物并返回人设化反馈。

旧 `npc_first_victory_rewards` 数据继续迁移为 1 点并写入 1 级奖励记录，保留旧表以兼容
现有代码与回滚，但新逻辑不依赖它发奖。下一号迁移必须对已经达到 80～99 点的玩家回填
5 级奖励记录与对应 NPC 卡灵；已有奖励或卡灵通过唯一约束跳过，不能依赖玩家再次互动才补发。

客户端打开 NPC 时加载好感与赠礼选项，在 Galgame 对话界面显示等级、进度和礼物选择。
战斗结束界面同时展示好感增量、升级、卡牌和卡灵奖励。

## 21. Monster Spirit Fragments And Composition

新增 `player_card_spirit_fragments`，只保存尚未合成为完整卡灵的怪物碎片：

| Field | Purpose |
| --- | --- |
| `id` | 主键 |
| `player_id` | 玩家外键，删除玩家时级联删除 |
| `spirit_template_id` | 怪物卡灵模板外键，删除模板时限制删除 |
| `amount` | 当前碎片数，非负整数 |
| `created_at` / `updated_at` | 审计与图鉴排序 |

唯一约束为 `(player_id, spirit_template_id)`。完整卡灵继续由
`player_card_spirits(player_id, spirit_template_id)` 的现有唯一约束保证每种只能拥有一只。

未来怪物战斗角色配置增加：

```json
{
  "spirit_template_id": 1,
  "monster_rank": "normal"
}
```

`monster_rank` 只允许 `normal`、`elite`、`boss`，服务端固定映射为 1、2、3 枚碎片。
掉落数不由 AI、客户端或随机数决定。当前 NPC 不配置 `monster_rank`，因此不会掉落怪物碎片。
怪物的 `spirit_template_id` 同时作为其可收集卡灵身份、签名卡来源和专属卡组归属，避免重复建模。

战斗从未结算状态首次转为玩家胜利时，在同一数据库事务内：

1. 根据服务端怪物配置解析卡灵模板和固定掉落数。
2. 锁定或创建玩家与该模板的碎片记录，并原子累加 1、2 或 3 枚。
3. 把 `fragment_reward` 写入战斗奖励与公开响应，包含本次增量、当前数量和目标 30。
4. 依赖既有战斗状态与版本保护，重复结算同一场战斗直接返回原奖励，不再次累加。

MVP 不自动合成。新增鉴权接口：

```http
POST /api/v1/spirit-fragments/{spirit_template_id}/compose
```

接口在单个事务中锁定碎片记录，先检查玩家是否已经拥有该卡灵：若已拥有则返回现有卡灵和
未变化的碎片数；否则要求 `amount >= 30`，扣除 30 后创建 `PlayerCardSpirit`。并发请求依靠
两张表的行锁与唯一约束只能成功一次；唯一约束竞争按“已合成”读取返回，不得再次扣除。

卡灵图鉴公开每个怪物卡灵的 `owned`、`fragment_count`、`fragment_target=30` 和
`can_compose`，战斗奖励公开 `fragment_delta`。客户端不得根据本地显示自行授予卡灵。
已有完整卡灵时禁止重复合成；多余碎片的兑换、升星或返还用途延后。

迁移回滚只移除碎片表和新增配置，不删除已合成的 `player_card_spirits`。功能关闭或代码回滚时，
未知的怪物奖励配置可被旧代码忽略，已有碎片数据保留到数据库迁移明确回滚为止。
