# AI 对战与对话接入设计

## 1. 目标

本实现为《斗萝大陆》增加服务端驱动的 AI NPC 能力：

- 玩家可以输入自由文本，也可以选择两条快捷回复。
- NPC 回复和两条快捷回复可由 OpenAI-compatible 模型动态生成。
- NPC 能跨登录、跨设备保留有限对话记忆。
- NPC 在战斗中可由 AI 从服务端提供的合法动作中选择策略。
- 未来怪物可以复用同一套“角色资料 + 战斗状态 + 合法动作”契约。

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
- `server/app/api/world.py`：NPC 会话读取和发送接口。
- `server/app/api/battle.py`：敌方回合的 AI 决策入口。
- `server/database/012_ai_npc_interactions.sql`：会话表、索引和现有 NPC AI profile。

前端：

- `game-client/src/api/types.ts`：NPC 会话和战斗动作类型。
- `game-client/src/stores/game.ts`：会话加载、发送、冲突刷新和状态管理。
- `game-client/src/components/DialogModal.vue`：自由输入、两条快捷回复和历史消息。
- `game-client/src/components/BattlePanel.vue`：护盾与角色化战斗台词。

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

### 10.1 合法候选动作

服务端从 NPC 配置和最新战斗状态生成候选动作。当前实现支持：

- `basic_attack`：使用 `battle_deck.attack` 进行普通攻击。
- `guard`：使用 `battle_deck.guard` 获得护盾；已有护盾时不再提供此动作。

发送给模型的候选项只包含动作 ID、说明和标签。模型返回：

```json
{
  "action_id": "guard",
  "battle_line": "先稳住阵脚。"
}
```

模型提供的其他数值和字段会被拒绝。`action_id` 不在当前候选集合时回退
`basic_attack`。

### 10.2 并发流程

1. 按玩家归属读取战斗，校验 `expected_version`。
2. 复制战斗快照并生成候选动作。
3. 在不持有数据库行锁的情况下调用模型。
4. 重新以 `FOR UPDATE` 锁定 `active_battles`。
5. 再次校验归属、状态和 `expected_version`。
6. 基于最新状态重新生成候选动作。
7. 执行仍合法的 AI 动作，否则执行普通攻击。
8. 服务端计算护盾、伤害、胜负和奖励，更新 `version` 后提交。

旧快照发生并发冲突时返回 `409`，不会静默应用过期 AI 决定。

### 10.3 护盾结算

`guard` 把配置值写入 `enemy_state.shield`。玩家下一张伤害卡先消耗护盾，
`last_action.blocked` 记录抵消值，模型不参与计算。

## 11. 前端交互

- 首次交互仍播放原有三段静态开场。
- 有历史会话时直接进入聊天区域。
- 输入框最多 500 字，Enter 发送，Shift+Enter 换行。
- 两条快捷回复与自由文本调用同一 Pinia action。
- 发送期间禁用重复操作并显示 NPC 正在思考。
- 失败后保留最后可用会话并重新读取服务端版本。
- 桌面端为立绘让出内容空间；700px 以下重置面板内边距，避免横向溢出。
- 战斗界面显示敌方护盾和可选的 `battle_line`。

## 12. 日志与隐私

当前记录模型成功/降级、玩家 ID、NPC/敌人 ID、动作 ID、token 用量和错误类别。

不记录 API Key、完整 system prompt、玩家原文或模型完整回复。供应商错误不会直接返回客户端。

## 13. 测试

后端测试不访问真实模型：

- MockTransport 验证 OpenAI-compatible JSON 与代码块解析。
- 非对象 JSON 和非法动作必须降级。
- 输入禁用词、长度和摘要边界。
- 对话静态降级、两条回复、近期去重和玩家隔离。
- 强制 AI 选择 `guard`，验证服务端护盾及下一次出牌消耗。
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

## 14. 上线与回滚

1. 保持三个 AI 开关关闭，上线迁移和兼容代码。
2. 先只开启一个 NPC 的 AI 对话。
3. 观察超时、降级和内容质量后，再开启一个训练型 NPC 的战斗 AI。
4. 稳定后逐 NPC 扩大。

运行时回滚只需关闭 `AI_DIALOGUE_ENABLED` 和 `AI_BATTLE_ENABLED`。静态对白、
固定回复和普通攻击没有删除，数据库会话表可以保留，不影响旧流程。

## 15. 未来怪物接入

未来怪物无需复用 `NpcTemplate` 表，只需向战斗 AI 服务投影统一数据：

```text
actor_id + display_name + ai_profile + battle_state + legal_actions
```

怪物技能、数值与数据库模型仍由怪物领域实现。AI 服务只消费投影并返回候选动作 ID，
因此不会提前引入多态数据库或平台化抽象。
