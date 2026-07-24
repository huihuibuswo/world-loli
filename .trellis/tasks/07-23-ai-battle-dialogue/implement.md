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

## Phase 6: Galgame Dialogue Presentation

- [x] 将 AI 对话改为 Galgame 式 NPC 当前台词展示，不再混排双方历史消息气泡。
- [x] 将自由文本输入和两条服务端下发的快捷回复放入独立玩家应答区。
- [x] 保留离开、对战、加载、失败及降级状态。
- [x] 完成桌面、375px 移动端和横屏布局验收，并重新运行 typecheck/build。

## Phase 7: AI Actor Decks And Multi-Card Enemy Turns

- [x] 新增下一号迁移（当前预计 `014`）：创建通用防御卡、配置现有战斗 NPC 独立卡组，
  并创建 `player_card_spirit_fragments` 及其唯一约束、外键和非负检查。
- [x] 增加敌方卡组配置解析与校验，拒绝空卡组、非法模板引用、非法数量和不支持的效果。
- [x] 在战斗状态中初始化敌方能量、手牌、抽牌堆和弃牌堆，并兼容补齐旧战斗状态。
- [x] 将 `battle_data()` 改为公开投影，隐藏敌方完整手牌和抽牌顺序，仅返回计数与已出卡牌。
- [x] 抽取双方可复用的伤害/护盾卡牌效果执行器，保持数值、护盾、胜负和奖励服务端权威。
- [x] 将 AI 输出改为有序 `card_template_ids`，校验副本、消耗、长度和最大可执行序列。
- [x] 实现确定性最大序列降级，AI 关闭、超时、非法或过期输出时仍连续合法出牌。
- [x] 重构敌方回合：重新加锁和版本校验后逐张结算，玩家死亡时立即停止剩余序列。
- [x] 扩展 API 类型和战斗 UI，展示敌方能量、卡组计数及本回合依次使用的卡牌。
- [x] 增加服务/API 测试，覆盖各 NPC 卡组、连续出牌、重复副本、无牌可出、旧状态兼容和并发冲突。
- [x] 更新 AI 接入设计文档、README 与数据库 schema 验证。
- [x] 运行数据库迁移、后端测试、前端 typecheck/build、浏览器桌面/移动验收和 `git diff --check`。

## Phase 8: NPC Affection And Milestone Rewards (Current Legacy Thresholds)

本阶段记录当前已完成实现；其旧等级门槛和 100 点卡灵奖励由 Phase 9 覆盖，不再作为最终契约。

- [x] 新增 `013` 迁移与 ORM：玩家/NPC 好感进度、里程碑奖励、NPC 植物赠礼记录。
- [x] 为晨曦村五名 NPC 创建对应卡灵模板，并配置专属卡牌、植物偏好与收礼对白。
- [x] 将旧版 NPC 首胜奖励记录迁移为 1 点 / 1 级已领取状态，避免重复发奖。
- [x] 实现统一 NPC 好感服务：等级计算、行锁更新、首次对战、后续对战、交谈、赠礼和幂等奖励。
- [x] 将成功保存的新 AI/静态聊天轮次接入交谈好感，重复 request ID 不重复增加。
- [x] 将战斗结算接入首次完成对战奖励和后续对战增量，胜负都只结算一次。
- [x] 新增 NPC 好感查询、植物赠礼选项与赠礼 API，保证背包扣除和好感更新原子提交。
- [x] 扩展前端类型、Pinia、NPC 对话界面和战斗结果，展示等级、进度、礼物与奖励。
- [x] 增加 API/服务测试：初始状态、首次对战、重复聊天、偏好赠礼、每日上限、跨里程碑、
  满好感卡灵、奖励幂等和玩家隔离。
- [x] 更新 schema 验证与设计文档，运行后端测试、前端 typecheck/build 和 `git diff --check`。

## Phase 9: Card Spirit Acquisition Convergence

- [x] 将 NPC 好感等级统一为 1～5 级区间：0～19、20～39、40～59、60～79、80～100；
  同步服务端等级函数、响应 schema、前端进度显示和测试。
- [x] 保留首次完成对战发放 1 级专属卡牌的幂等事件，不因初始显示 1 级而注册即发卡。
- [x] 将 NPC 卡灵奖励门槛从 100 调整为 80；在下一号迁移中为已经达到 80～99 点的玩家
  幂等回填奖励记录与卡灵，并验证 100 点不会重复发放。
- [x] 为未来怪物配置 `spirit_template_id` 与 `monster_rank`，严格映射普通/精英/Boss
  固定掉落 1/2/3 枚，不使用随机数或 AI 输出。
- [x] 在玩家首次胜利结算事务内原子累加对应碎片，并把增量、当前数量和目标 30 写入奖励；
  重复结算、版本冲突和失败战斗不得重复或错误掉落。
- [x] 新增碎片 ORM/schema 与原子合成服务/API：锁定碎片记录、校验不少于 30、扣除 30、
  创建唯一卡灵；已有卡灵或并发重复请求不得再次扣除。
- [x] 扩展卡灵图鉴和前端类型/UI，展示碎片数量、30 枚目标、可合成状态与合成结果。
- [x] 增加迁移/schema、服务和 API 测试，覆盖三种固定掉落、玩家/模板隔离、29/30 边界、
  重复战斗结算、重复合成、并发合成、已有卡灵和 80/99/100 好感边界。
- [x] 同步 `doc/AI对战与对话接入设计.md`、README 与运行说明；明确多余碎片用途延后。
- [x] 运行数据库迁移与 schema 验证、后端相关回归、前端 typecheck/build、浏览器图鉴验收和
  `git diff --check`，再执行 Trellis check 与对抗式审查。

## Execution Results

- PostgreSQL `012_ai_npc_interactions.sql` applied successfully.
- Schema verification passed, including AI conversation uniqueness.
- Backend: `8 passed`; one existing Starlette/httpx deprecation warning remains.
- Frontend: no-emit Vue/TypeScript check passed.
- Frontend: Vite production build passed using a temporary output directory because tracked generated
  files and the existing `dist` directory are read-only in this workspace.
- Browser QA passed for desktop and 390x844 mobile layouts; no console warnings or errors.
- NPC affection migration `013_npc_affection.sql` applied successfully.
- NPC affection/backend regression suite: `10 passed`; one existing Starlette/httpx deprecation warning remains.
- Schema verification passed with 25 public tables, 37 foreign keys, and duplicate milestone rejection.
- Frontend no-emit Vue/TypeScript check and Vite production build passed.
- Browser QA passed at 1440x900, 390x844, and 844x390; the short-landscape double-scroll issue found during review was fixed.
- Migration `014_ai_actor_decks_and_spirit_fragments.sql` applied successfully.
- Backend regression suite: `13 passed`; one existing Starlette/httpx deprecation warning remains, including
  a real two-transaction concurrent composition regression.
- Schema verification passed with 26 public tables, 39 foreign keys, fragment uniqueness/non-negative checks,
  NPC deck presence, and existing cross-player ownership constraints.
- Frontend no-emit Vue/TypeScript check and Vite production build passed; only the existing large-chunk warning remains.
- Browser QA passed for the Galgame dialogue, two suggested replies, new-player card-spirit state, hidden enemy hand,
  multi-card enemy turn, 375x812 mobile, and 844x390 landscape. The action-line/topbar overlap found in landscape was fixed.
- Galgame portraits are anchored to the dialogue panel frame instead of the viewport; forest-guide QA passed at
  1280x720, 375x812, and 844x390 without horizontal overflow.

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
- 好感门槛变更必须为 80～99 点存量玩家补发卡灵，不能要求玩家再增加一次好感才触发。
- 碎片发放只能挂在战斗首次胜利结算事务，合成必须先锁定碎片记录并依赖卡灵唯一约束兜底。
- 任一阶段可通过关闭 `AI_DIALOGUE_ENABLED` 或 `AI_BATTLE_ENABLED` 回退到旧行为。
- 不删除旧静态对白或固定攻击配置，确保代码级回滚和运行时回滚均可行。
