# AI 对战与对话接入实施计划

## Scope

按已确认设计完成 AI 对话、有限记忆、敌方战斗决策、前端交互、数据库迁移、
自动化测试和项目文档。所有 AI 功能默认关闭，禁止提交真实密钥。

## Phase 1: Backend Foundation

- [x] 加载 Trellis backend/frontend 规范和修改前检查。
- [x] 在 `Settings` 与 `.env.example` 增加 AI 功能开关、OpenAI-compatible 配置和容量上限。
- [x] 新增 `npc_ai_conversations` SQLAlchemy 模型、数据库迁移及 schema 验证。
- [x] 新增聊天请求/响应、会话响应及战斗 AI 输出的 Pydantic schema。
- [x] 实现 OpenAI-compatible JSON 客户端：总超时、错误归一化、严格内容提取、无密钥日志。
- [x] 实现进程内玩家/NPC 限流与基础内容安全校验。

## Phase 2: NPC Dialogue

- [x] 实现 NPC AI profile 读取、上下文构建、响应 decoder 和固定降级。
- [x] 实现有限近期轮次、摘要裁剪、request ID 近期去重和会话版本控制。
- [x] 新增鉴权 `GET /npc/{npc_id}/chat` 与 `POST /npc/{npc_id}/chat`。
- [x] 确保自由文本和快捷回复共用同一请求契约及服务端校验。
- [x] 增加成功、降级、重复请求、版本冲突、限长、限流和玩家隔离测试。

## Phase 3: Battle AI

- [x] 将敌方动作拆分为服务端候选动作与确定性执行器，保留默认普通攻击。
- [x] 支持至少普通攻击与防御动作；动作数值来自 NPC 配置，不来自模型。
- [x] 实现战斗快照、AI 动作选择与严格 `action_id` decoder。
- [x] 调整结束回合流程：AI 调用不持锁，写入前重新加锁并校验版本与候选动作。
- [x] 将归一化 `action_id`、伤害/护盾和可选战斗台词写入 `last_action`。
- [x] 增加合法选择、非法输出、超时、AI 关闭、并发冲突和奖励不受影响测试。

## Phase 4: Frontend

- [x] 扩展 API 类型与 Pinia 状态/动作，加载会话并发送自由文本或快捷回复。
- [x] 改造 `DialogModal.vue`：历史消息、500 字输入、发送、两条快捷回复、加载和降级状态。
- [x] 保留现有静态开场、离开和对战操作，AI 失败不能阻塞游戏。
- [x] 在 `BattlePanel.vue` 展示服务端归一化的敌方动作与可选战斗台词。
- [x] 增加响应式样式，检查桌面/移动端文本、焦点和按钮稳定尺寸。

## Phase 5: Documentation And Verification

- [x] 创建 `doc/AI对战与对话接入设计.md`，使接口、配置、数据表和回滚说明与代码一致。
- [x] 更新 README 的 AI 配置、默认关闭行为和本地验证方式。
- [x] 运行后端 AI 相关测试及现有 API 流程回归。
- [x] 运行客户端 `pnpm typecheck` 和 `pnpm build`。
- [x] 执行 Trellis check、`git diff --check` 和最终对抗式审查。
- [x] 确认没有真实 API 密钥、敏感对话日志或无关重构。

## Execution Results

- PostgreSQL `012_ai_npc_interactions.sql` applied successfully.
- Schema verification passed, including AI conversation uniqueness.
- Backend: `8 passed`; one existing Starlette/httpx deprecation warning remains.
- Frontend: no-emit Vue/TypeScript check passed.
- Frontend: Vite production build passed using a temporary output directory because tracked generated
  files and the existing `dist` directory are read-only in this workspace.
- Browser QA passed for desktop and 390x844 mobile layouts; no console warnings or errors.

## Validation Commands

```powershell
Set-Location server
pytest

Set-Location ..\game-client
pnpm typecheck
pnpm build

Set-Location ..
rg -n "TBD|TODO|尚未确认" doc\AI对战与对话接入设计.md
git diff --check
git status --short
```

若完整后端测试因 PostgreSQL/Docker 不可用而阻塞，至少运行不依赖数据库的 AI 单元测试，
并在交付中明确未验证的数据库/API 范围。

## Risk And Rollback Points

- 数据库迁移必须使用下一个连续编号，并同步 `verify_schema.sql`。
- 外部 HTTP 调用不得处于数据库行锁事务内。
- `active_battles.version` 冲突必须返回 `409`，不能静默应用旧 AI 决定。
- AI 输出必须经过 schema 与合法动作集合双重校验。
- 任一阶段可通过关闭 `AI_DIALOGUE_ENABLED` 或 `AI_BATTLE_ENABLED` 回退到旧行为。
- 不删除旧静态对白或固定攻击配置，确保代码级回滚和运行时回滚均可行。
