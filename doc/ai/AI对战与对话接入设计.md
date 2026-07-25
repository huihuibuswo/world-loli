# AI 对战与对话接入设计

## 1. 目标

本实现为《斗萝大陆》增加服务端驱动的 AI NPC 能力：

- 玩家可以输入自由文本，也可以选择两条快捷回复。
- NPC 回复和两条快捷回复可由 OpenAI-compatible 模型动态生成。
- NPC 能跨登录、跨设备保留有限对话记忆。
- 每个可战斗 NPC 和未来怪物拥有自己的服务端卡组，AI 只选择合法的连续出牌序列。
- 未来怪物复用同一套“角色资料 + 独立卡组 + 战斗状态”契约。

AI 只负责内容生成和候选动作选择。生命、伤害、卡牌、奖励、玩家资产与数据库状态始终由
FastAPI 服务端校验和结算。

## 2. 非目标

- AI 不代替玩家移动、出牌或选择。
- AI 不能创建技能、伤害数值、奖励或数据库写入。
- 不实现 PvP、语音、图片、流式输出、向量数据库或无限长期记忆。
- 不引入独立 AI 微服务、消息队列、缓存集群或模型路由平台。

## 3. 实现位置

后端：

- `server/app/services/ai_client.py`：OpenAI-compatible `/chat/completions` 客户端。
- `server/app/services/ai_profile.py`：NPC AI 人设与固定降级选项。
- `server/app/services/npc_ai_service.py`：输入安全、限流、记忆、提示词、回复校验与降级。
- `server/app/services/battle_ai_service.py`：战斗动作选择和非法输出降级。
- `server/app/services/battle_service.py`：合法动作、护盾、伤害和权威状态结算。
- `server/app/services/card_spirit_service.py`：怪物卡灵碎片累计与原子合成。
- `server/app/api/world.py`：NPC 会话读取和发送接口。
- `server/app/api/battle.py`：敌方回合的 AI 决策入口。
- `server/database/012_ai_npc_interactions.sql`：会话表、索引和现有 NPC AI profile。
- `server/database/013_npc_affection.sql`：NPC 好感和里程碑奖励。
- `server/database/014_ai_actor_decks_and_spirit_fragments.sql`：敌方卡组与卡灵碎片。

前端：

- `game-client/src/api/types.ts`：NPC 会话和战斗动作类型。
- `game-client/src/stores/game.ts`：会话加载、发送、冲突刷新和状态管理。
- `game-client/src/components/DialogModal.vue`：自由输入、两条快捷回复和历史消息。
- `game-client/src/components/BattlePanel.vue`：敌方卡组状态、连续出牌与角色化战斗台词。
- `game-client/src/components/CollectionDrawer.vue`：卡灵碎片进度和合成入口。

## 4. 配置

AI 默认关闭。服务端 `.env` 可配置：

```dotenv
AI_ENABLED=false
AI_DIALOGUE_ENABLED=false
AI_BATTLE_ENABLED=false
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=
AI_MODEL=
AI_DIALOGUE_TIMEOUT_SECONDS=8
AI_BATTLE_TIMEOUT_SECONDS=2
AI_MAX_INPUT_CHARS=500
AI_MAX_REPLY_CHARS=400
AI_MEMORY_RECENT_TURNS=8
AI_MEMORY_SUMMARY_CHARS=1200
AI_MEMORY_RETENTION_DAYS=90
AI_DIALOGUE_MIN_INTERVAL_SECONDS=1.5
AI_BLOCKED_TERMS=
```

启用对话需要同时设置 `AI_ENABLED=true`、`AI_DIALOGUE_ENABLED=true` 和完整模型配置。
战斗同理使用 `AI_BATTLE_ENABLED=true`。密钥只存在服务端，不进入客户端、数据库或日志。

兼容服务必须支持：

- `POST {AI_BASE_URL}/chat/completions`
- Bearer API Key
- `response_format: {"type": "json_object"}`
- `choices[0].message.content` 返回 JSON 字符串

不满足此契约的供应商会被视为失败并走确定性降级。

## 5. NPC AI Profile

NPC 配置继续存放于 `npc_templates.reward.ai_profile`：

```json
{
  "dialogue_enabled": true,
  "battle_enabled": true,
  "persona": "训练教官。直接、克制，不透露系统规则。",
  "fallback_replies": ["继续聊聊", "换个话题"],
  "battle_style": "根据当前生命与玩家状态选择稳妥行动"
}
```

`012` 迁移会为现有 NPC 写入默认 profile，并为可战斗 NPC 增加服务端 `guard` 数值。
新增 NPC 若没有 profile，仍使用原静态对白和固定攻击。

## 6. 对话接口

### 6.1 读取会话

```http
GET /api/v1/npc/{npc_id}/chat
Authorization: Bearer <token>
```

响应：

```json
{
  "npc_id": 5,
  "conversation_version": 2,
  "turns": [
    {
      "request_id": "uuid",
      "player": "今天适合训练吗？",
      "npc": "先从稳定节奏开始。",
      "created_at": "2026-07-23T10:00:00+00:00"
    }
  ],
  "reply": null,
  "suggested_replies": ["继续聊聊", "换个话题"],
  "mode": "static"
}
```

### 6.2 发送消息

```http
POST /api/v1/npc/{npc_id}/chat
Authorization: Bearer <token>
Content-Type: application/json
```

请求：

```json
{
  "request_id": "0ebed73d-5fc7-4d47-bd4c-f285514d703c",
  "message": "今天适合进行什么训练？",
  "conversation_version": 2
}
```

成功响应会返回更新后的 `turns`、版本、一条 `reply` 和恰好两条
`suggested_replies`。自由文本与快捷回复都使用此接口和同一套校验。

## 7. 对话安全和一致性

- `message` 经 Unicode NFKC 规范化、去除首尾空白、长度检查和控制字符检查。
- `AI_BLOCKED_TERMS` 支持服务端配置禁用词，逗号分隔。
- 进程内限流按“玩家 + NPC”执行，默认最短间隔 1.5 秒。
- 玩家文本作为独立 user message，不能进入 system instruction。
- 模型没有工具、数据库或游戏状态写权限。
- 模型输出用 Pydantic 严格解析，拒绝额外字段、空文本、重复建议和超长内容。
- `request_id` 在近期记忆窗口内提供幂等去重。
- `conversation_version` 不一致返回 `409`，前端刷新后再提交。

当前限流只适合单实例 Demo。部署多个 API 实例前，需要换成共享限流存储。

## 8. 有限记忆

`npc_ai_conversations` 以 `(player_id, npc_id)` 唯一约束隔离玩家和 NPC：

| 字段 | 用途 |
| --- | --- |
| `summary` | 截断后的旧对话摘要 |
| `recent_turns` | JSONB，保存有限近期轮次 |
| `version` | 跨设备并发版本 |
| `last_interacted_at` | 保留期和清理依据 |

近期轮次超过 `AI_MEMORY_RECENT_TURNS` 后，最旧内容会被压缩成简短文本并追加到摘要，
摘要截断为 `AI_MEMORY_SUMMARY_CHARS`。此过程不调用第二次模型，避免增加延迟和费用。

超过 `AI_MEMORY_RETENTION_DAYS` 的会话在再次访问时清除；服务层也提供
`cleanup_expired_conversations(db)` 供后续定时任务批量清理。

MVP 不跨 NPC 共享记忆，也不保存无限原始对话。

## 9. 对话降级

以下情况不会阻断游戏：

- AI 总开关或对话开关关闭。
- NPC 未启用 AI。
- API Key、模型或 Base URL 未配置。
- 网络错误、超时、429、5xx。
- 非 JSON、缺字段、额外字段或内容长度不合法。

服务端会返回数据库中的静态对白和 profile 中两条固定回复，`mode` 为 `fallback`。
客户端显示“当前使用备用回应”，仍可离开或进入战斗。

## 10. 战斗 AI

### 10.1 独立卡组与 AI 输出

每个可战斗 NPC 通过 `battle_deck.cards` 配置自己的卡牌模板和数量。迁移 `014` 为现有
战斗 NPC 配置了包含签名卡、通用防御卡和基础攻击的独立卡组。创建战斗时，服务端严格
校验卡组非空、模板存在、数量合法、包含签名卡，且卡牌效果只使用当前已支持的
`damage` 或 `shield`。

敌方与玩家一样维护能量、手牌、抽牌堆和弃牌堆。发送给模型的候选项来自服务端当前
手牌，只包含卡牌模板 ID、费用和描述。模型返回有序序列：

```json
{
  "card_template_ids": [9, 8],
  "battle_line": "先稳住阵脚。"
}
```

模型不能提供伤害、护盾、费用或奖励数值。服务端校验卡牌副本、顺序、总费用及序列是否
已经出到能量耗尽或没有可支付卡牌。AI 关闭、超时、输出非法、不完整或已经过期时，使用
确定性最大序列降级：按费用降序、卡牌模板 ID 升序连续选择，直到没有可支付卡牌。

### 10.2 并发流程

1. 按玩家归属读取战斗，校验 `expected_version`。
2. 复制战斗快照、敌方公开状态和当前可出牌集合。
3. 在不持有数据库行锁的情况下调用模型。
4. 重新以 `FOR UPDATE` 锁定 `active_battles`。
5. 再次校验归属、状态和 `expected_version`。
6. 基于最新手牌和能量重新校验 AI 序列。
7. 序列仍合法则按顺序逐张结算；否则执行确定性最大序列，玩家死亡时立即停止。
8. 服务端计算护盾、伤害、胜负和奖励，更新 `version` 后提交。

旧快照发生并发冲突时返回 `409`，不会静默应用过期 AI 决定。

### 10.3 公开战斗状态

API 只公开敌方能量、手牌数量、抽牌堆数量、弃牌堆数量，以及本回合已经实际使用的卡牌。
敌方完整手牌和抽牌顺序不会返回客户端。伤害卡先消耗护盾，`last_action.cards` 逐张记录
服务端结算后的伤害、抵消和护盾值，模型不参与数值计算。

## 11. 卡灵获取

- NPC 好感保持 `0-100` 数值并映射为 1-5 级：`0-19`、`20-39`、`40-59`、
  `60-79`、`80-100`。首次完成对战幂等发放 1 级专属卡牌，达到 80 点进入 5 级时
  幂等发放对应 NPC 卡灵；新注册玩家不会直接获得完整狼娘卡灵。
- 怪物胜利不走 NPC 好感。普通、精英、Boss 首次胜利结算分别固定掉落对应卡灵碎片
  1、2、3 枚，掉落不由 AI 或随机数决定。
- `GET /api/v1/spirit-fragments` 返回玩家的碎片进度。
- `POST /api/v1/spirit-fragments/{spirit_template_id}/compose` 在单个事务中锁定碎片记录，
  集齐 30 枚后扣除 30 并创建完整卡灵。重复或并发请求依赖行锁和唯一约束保证不重复扣除。
- 已拥有完整卡灵时不再重复合成；多余碎片的兑换、升星或返还用途延后。

## 12. 前端交互

- 首次交互仍播放原有三段静态开场。
- 有历史会话时直接进入聊天区域。
- 输入框最多 500 字，Enter 发送，Shift+Enter 换行。
- 两条快捷回复与自由文本调用同一 Pinia action。
- 发送期间禁用重复操作并显示 NPC 正在思考。
- 失败后保留最后可用会话并重新读取服务端版本。
- 桌面端为立绘让出内容空间；700px 以下重置面板内边距，避免横向溢出。
- 战斗界面显示敌方护盾、能量、卡组计数、连续出牌和可选的 `battle_line`。
- 卡灵图鉴显示每种怪物卡灵的碎片数量与 `30` 枚目标，达到目标后可直接合成。

## 13. 日志与隐私

当前记录模型成功/降级、玩家 ID、NPC/敌人 ID、所选卡牌模板、token 用量和错误类别。

不记录 API Key、完整 system prompt、玩家原文或模型完整回复。供应商错误不会直接返回客户端。

## 14. 测试

后端测试不访问真实模型：

- MockTransport 验证 OpenAI-compatible JSON 与代码块解析。
- 非对象 JSON、非法卡牌序列和未耗尽能量的序列必须降级。
- 输入禁用词、长度和摘要边界。
- 对话静态降级、两条回复、近期去重和玩家隔离。
- 验证敌方连续出牌、护盾、隐藏手牌、旧战斗状态兼容和确定性降级。
- 验证普通/精英/Boss 固定碎片掉落、29/30 边界、重复合成和已有卡灵幂等。
- 原注册、地图、NPC、战斗、奖励、采集和赠礼流程回归。

验证命令：

```powershell
Set-Location server
docker compose run --rm migrate
docker compose exec api pytest -q

Set-Location ..\game-client
pnpm typecheck
pnpm build
```

若工作区内旧生成文件为只读，可使用无输出类型检查，并把 Vite 产物写到临时目录；
正式仓库应修复这些文件权限后恢复标准命令。

## 15. 上线与回滚

1. 保持三个 AI 开关关闭，上线迁移和兼容代码。
2. 先只开启一个 NPC 的 AI 对话。
3. 观察超时、降级和内容质量后，再开启一个训练型 NPC 的战斗 AI。
4. 稳定后逐 NPC 扩大。

运行时回滚只需关闭 `AI_DIALOGUE_ENABLED` 和 `AI_BATTLE_ENABLED`。静态对白、
固定回复和普通攻击没有删除，数据库会话表可以保留，不影响旧流程。

## 16. 未来怪物接入

未来怪物无需复用 `NpcTemplate` 表，只需向战斗 AI 服务投影统一数据：

```text
actor_id + display_name + ai_profile + battle_deck + battle_state + playable_cards
```

怪物技能、数值与数据库模型仍由怪物领域实现。AI 服务只消费当前可出卡牌投影并返回有序
卡牌模板 ID；服务端重新校验并逐张结算，因此无需提前引入多态数据库或平台化抽象。

## 17. 战斗参数平衡基线

迁移 `017_battle_balance.sql` 将战斗从“新角色稳定两回合内获胜”调整为存在真实失败窗口：

- 新角色基础生命从 100 调整为 75；每回合 3 能量、初始手牌 5 保持不变。
- 起始套牌改为显式 12 张：基础攻击 6、防御姿态 4、月牙撕裂 2。注册流程不得再依赖
  `card_templates.id` 排序，否则新增模板会静默改变新玩家套牌。
- 基础攻击调整为 1 费 6 伤害，防御姿态调整为 1 费 8 护盾，月牙撕裂与破绽识破
  调整为 2 费 13 伤害；敌方新增独立的 1 费 8 伤害“战术打击”，解除敌我基础攻击的调参耦合。
- 晨曦村战斗角色与序章露娜统一使用 10 张牌组，并通过 `battle_deck.action_weights`
  配置伤害/护盾倾向。确定性降级继续输出最大可执行序列，但不再按模板 ID 决定同费牌。
- 新战斗生成内部 `battle_seed`，初始牌堆和弃牌回收都使用按阵营与洗牌次数派生的确定性随机种子。
  公开战斗投影移除 seed 与洗牌计数，避免泄露隐藏抽牌顺序。
- 迁移发布时将仍在进行的战斗标记为 `abandoned`，避免全局卡牌模板更新造成战斗中途数值跳变。

真实服务端固定种子校准后，铁匠少女苏娜使用 60 HP。80 HP 候选值会导致只攻击的起始套牌
在测试种子中全部失败；60 HP 能同时产生胜利与败北，保留高压定位但不形成隐性必败局。
