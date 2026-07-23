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
- `battle_ai_service`：把战斗快照与合法候选动作交给模型，只接收动作 ID 和可选台词。
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

## 10. Battle AI Contract

服务端先从当前权威战斗状态生成候选动作：

```json
[
  {"id": "basic_attack", "description": "稳定的普通攻击", "tags": ["damage"]},
  {"id": "guard", "description": "本回合防御并减少所受伤害", "tags": ["defense"]},
  {"id": "heavy_attack", "description": "高伤害但有冷却", "tags": ["damage", "cooldown"]}
]
```

模型只返回：

```json
{
  "action_id": "guard",
  "battle_line": "先看清你的节奏。"
}
```

禁止接受模型返回的伤害、生命、能量、目标、冷却或奖励。服务端重新确认 `action_id`
仍在当前候选集合，再调用该动作的确定性执行器。

## 11. Battle Turn Flow

外部模型调用不得占用数据库行锁：

1. 读取玩家拥有的战斗和当前 `version`，构建不可变快照及候选动作。
2. 调用 AI；超时、非法输出或禁用时选定默认动作。
3. 重新获取 `ActiveBattle` 行锁并校验玩家归属、状态和 `expected_version`。
4. 基于最新状态重新计算候选集合。
5. 若 AI 动作仍合法则执行，否则执行默认动作。
6. 服务端计算全部效果，更新 `state_json`、`last_action` 和 `version`，再提交事务。

若第 3 步发现版本冲突，返回 `409`，不应用旧快照上的决定。默认动作首期为现有固定攻击，
保证关闭 AI 或供应商故障时行为兼容。

未来怪物只需实现统一的战斗角色投影：

```text
actor_id + display_name + ai_profile + battle_state + legal_actions
```

其数据库模型与技能系统在怪物功能任务中定义，本任务不提前创建。

## 12. Frontend Changes

`NpcData` 增加 AI 是否启用与固定快捷回复的展示数据；新增独立的聊天响应类型，避免组件读取
供应商原始字段。

`DialogModal.vue` 增加：

- 消息历史区域。
- 最大 500 字的自由文本框与发送按钮。
- 两个稳定尺寸的快捷回复按钮。
- 思考中、降级提示、失败重试和版本冲突刷新状态。
- 保留离开与对战按钮；模型不可用不影响进入战斗。

`BattleData.last_action` 可增加 `action_id` 和可选 `battle_line`。战斗 UI 只展示服务端归一化结果。

## 13. Failure And Abuse Handling

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
| AI-selected action no longer legal | 执行服务端默认动作 |

频率限制按玩家与 NPC 组合计算；首期可用进程内限流满足单实例 Demo，部署多实例前必须切换
到共享限流存储。该限制应在文档和部署说明中明确，不能误称为全局强一致限流。

MVP 内容安全基线包括 Unicode/控制字符规范化、服务端长度限制、可配置禁用词、
提示词角色隔离、无工具调用、输出长度与 schema 校验。供应商若支持独立 moderation
接口，可作为后续增强，但不得成为基础游戏流程的强依赖。

## 14. Observability And Privacy

记录：请求 ID、功能类型、NPC/敌人 ID、模型名、延迟、结果模式、错误类别、token 用量和降级次数。

不记录：API 密钥、完整 system prompt、默认情况下的玩家原文与模型完整回复。调试内容日志只能通过
显式开发开关启用，并进行截断和敏感信息清理。

建议指标：

- `ai_requests_total{feature,result}`
- `ai_request_duration_seconds{feature}`
- `ai_fallback_total{feature,reason}`
- `ai_tokens_total{feature,direction}`
- `ai_schema_rejection_total{feature}`

## 15. Rollout And Rollback

1. 默认关闭全局 AI 开关，先上线数据库迁移和兼容字段。
2. 仅对白名单 NPC 开启 AI 对话，验证延迟、内容和降级率。
3. 再为一个训练型 NPC 开启 AI 战斗动作选择。
4. 指标稳定后逐 NPC 扩大。

回滚只需关闭 `AI_DIALOGUE_ENABLED` / `AI_BATTLE_ENABLED`；静态对白和固定攻击始终保留。
数据库新增字段与会话表可保留，不影响旧客户端和旧战斗状态。

## 16. Verification Strategy

- 单元测试：响应 decoder、记忆裁剪/摘要、候选动作校验、默认动作、配置校验。
- API 测试：自由文本、快捷回复、重复请求、版本冲突、未认证、限长、限流和降级。
- 战斗测试：AI 合法选择、非法动作、超时、并发版本变化、胜负与奖励不被模型影响。
- 兼容测试：所有 AI 开关关闭时，现有 `test_api_flow.py` 行为不变。
- 前端检查：桌面和移动端输入、两条快捷回复、加载、错误、键盘焦点与文本不溢出。
- 安全测试：提示词注入、超长输入、恶意 JSON、供应商返回额外字段和敏感信息诱导。

## 17. Expected Implementation Surface

后端预计涉及：

- `server/app/core/config.py`、`server/.env.example`
- `server/app/schemas.py`、`server/app/models.py`
- `server/app/api/world.py`、`server/app/api/battle.py`
- `server/app/services/ai_client.py`
- `server/app/services/npc_ai_service.py`
- `server/app/services/battle_ai_service.py`
- `server/app/services/battle_service.py`
- 新数据库迁移及 schema 验证
- AI 单元/API 测试和现有流程回归

前端预计涉及：

- `game-client/src/api/types.ts`
- `game-client/src/stores/game.ts`
- `game-client/src/components/DialogModal.vue`
- `game-client/src/components/BattlePanel.vue`
- `game-client/src/styles.css`

文档预计涉及：

- `doc/AI对战与对话接入设计.md`
- `README.md`
