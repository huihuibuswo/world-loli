# 《斗萝大陆》Rust 后台服务全量等价重构方案 V1.0

> 文档状态：实施基线  
> 适用范围：`server/` FastAPI 后台到 Rust 单体 API 服务的全量迁移  
> 核心原则：客户端无感、数据库单源、行为等价、分阶段实现、统一切换、可快速回滚

## 1. 目标

将当前 Python、FastAPI、SQLAlchemy 后台完整迁移为 Rust 服务，最终由 Rust 独立承载现有全部 API。重构只替换服务端语言、运行时和内部组织，不改变游戏玩法、客户端接口、PostgreSQL 数据结构和已经上线的业务规则。

完成后的可观察结果：

1. 游戏客户端不修改 API 调用即可完成注册、登录、序章、探索、NPC 互动、卡牌战斗、采集、赠礼、合成和存档恢复。
2. 当前 62 个 `/api/v1` 路由端点和 2 个健康检查端点全部由 Rust 提供。
3. 现有 PostgreSQL 数据、24 个顺序 SQL 迁移、约束和 JSONB 内容可被 Rust 直接读取和更新。
4. 并发、幂等、版本冲突、每日限制、剧情状态机和 AI 降级行为与 FastAPI 版本等价。
5. Rust 全量验收通过前，FastAPI 始终保留为可用回滚版本。

## 2. 已确认现状

| 项目 | 当前实现 |
| --- | --- |
| Web 框架 | FastAPI |
| 语言与运行时 | Python 3.13、Uvicorn |
| 数据访问 | SQLAlchemy 2、psycopg 3 |
| 数据库 | PostgreSQL 17 |
| 配置 | Pydantic Settings、`.env` |
| 身份认证 | Bearer JWT，默认 HS256 |
| 密码哈希 | pwdlib 推荐的 Argon2 配置 |
| 外部 AI | OpenAI-compatible HTTP API，httpx2 |
| 部署 | Docker Compose：`postgres`、`migrate`、`api` |
| 数据库变更 | `server/database/NNN_*.sql`，当前 24 个迁移 |
| 自动化测试 | 7 个 Pytest 文件，连接真实 PostgreSQL |
| API 规模 | 10 个路由模块、62 个业务端点、2 个健康端点 |
| 数据模型 | 30 个 SQLAlchemy ORM 模型 |

当前成功响应通过 `ok()` 返回：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

HTTP 业务异常返回：

```json
{
  "code": 403,
  "message": "具体业务错误",
  "data": null
}
```

请求校验失败固定返回 HTTP 422、`code: 422`、`message: "请求参数无效"`，`data` 为错误数组。Rust 实现必须复现这些契约，不能使用 Axum 默认拒绝响应直接暴露内部错误。

## 3. 范围

### 3.1 Must

- 全量迁移 62 个业务端点和 2 个健康端点。
- 保持路径、HTTP 方法、状态码、响应包络、字段名、可空语义和时间格式兼容。
- 保持 JWT 声明、签名算法、有效期和 Argon2 已有密码哈希兼容。
- 继续使用当前 PostgreSQL 表、外键、唯一约束、检查约束和 JSONB 数据。
- 等价实现行锁、事务、版本校验、幂等记录、每日限制和奖励结算。
- 等价实现 AI 调用超时、输出验证、静态对白和确定性战斗回退。
- 建立 Python/Rust 契约对比、Rust 集成测试和完整客户端验收。
- 提供统一切换、观测和回滚步骤。

### 3.2 Should

- 保留 OpenAPI 文档能力。
- 使用结构化日志、请求 ID、延迟指标和去敏错误上下文。
- 为数据库池、请求体、外部调用和优雅停机设置明确上限。
- 将 JSONB 在业务边界转换为显式 Rust 类型，减少无约束 `serde_json::Value`。

### 3.3 Defer

- 微服务拆分、Redis、消息队列、事件溯源和多数据库。
- API v2、WebSocket、缓存、玩法调整和数据库结构清理。
- 在缺少真实并发目标时做大规模容量平台化。
- Rust 切换后立即删除 Python；FastAPI 至少保留一个稳定发布周期。

## 4. 必须保持的不变量

### 4.1 API 与认证

- `/api/v1` 前缀不变。
- 成功响应默认 `code = 0`、`message = "ok"`。
- 错误状态码、中文错误消息和 `data` 形状保持等价。
- 删除卡组的 HTTP 204 响应不能附加 JSON 包络。
- JWT 保留 `sub`、`iat`、`exp`，Rust 与 Python 必须能交叉签发和验证令牌。
- 未知用户、过期令牌和非法令牌继续返回 401，不泄露解析细节。

### 4.2 数据一致性

- PostgreSQL 是唯一业务数据源，不引入双写。
- 当前 `with_for_update()` 路径必须映射为 `SELECT ... FOR UPDATE`，锁顺序保持一致。
- 同一业务写请求的校验、扣除、奖励、状态变化和提交必须处于同一事务。
- 数据库约束继续作为最终防线，Rust 领域校验不能代替外键、唯一约束和 `CHECK` 约束。
- 扩展持久化状态机时，必须同步新增顺序 SQL 迁移并更新数据库验证。

### 4.3 战斗与 AI

- `active_battles.version` 的旧版本写入继续被拒绝，不能覆盖新状态。
- 战斗 seed、洗牌次数、敌方手牌和抽牌顺序不能返回客户端或写入普通日志。
- 胜利、失败和投降的奖励或惩罚只能结算一次。
- AI 调用不能在数据库事务持锁期间等待网络。
- AI 超时、供应商错误和非法 JSON 必须回退到当前确定性逻辑。
- AI 对话采用“读取快照与版本 -> 外部调用 -> 重新加锁校验版本 -> 提交”的等价流程。

### 4.4 时间与每日限制

- 每日赠礼等规则继续使用 `Asia/Shanghai`，不能误用 UTC 或服务器本地时区。
- 时间字段、时间戳和 `null` 必须保持客户端当前可解析格式。
- 旧存档和已有 JSONB 数据必须能够无损往返。

## 5. Rust 技术栈

| 能力 | 选型 | 选择依据 |
| --- | --- | --- |
| 异步运行时 | Tokio | HTTP、PostgreSQL、外部 AI 调用的生态基线。 |
| HTTP | Axum、Tower | 提取器、中间件、测试和显式错误映射清晰。 |
| JSON | Serde、serde_json | 精确控制字段、可选值、枚举与 JSONB。 |
| PostgreSQL | SQLx | 可直接表达 SQL、事务、行锁和约束错误映射。 |
| 配置 | config、dotenvy | 映射当前环境变量并在启动时校验。 |
| JWT | jsonwebtoken | 支持现有 HS256 令牌格式。 |
| 密码 | argon2、password-hash | 验证并生成兼容 PHC 格式哈希。 |
| 外部 HTTP | Reqwest | 支持连接/请求超时和结构化错误。 |
| 输入校验 | validator、领域构造函数 | 复现 Pydantic 边界校验并保护领域不变量。 |
| 日志 | tracing、tracing-subscriber | 结构化日志、请求 span 和去敏上下文。 |
| OpenAPI | utoipa | 保留 `/docs` 所需的接口描述能力。 |
| 测试 | cargo test、Tower ServiceExt、真实 PostgreSQL | 覆盖纯逻辑、HTTP 契约和事务行为。 |

不选 Diesel ORM。当前服务依赖大量显式锁、JSONB、约束和事务细节，SQLx 更容易逐条对照现有 SQLAlchemy 行为，避免在迁移期增加 ORM 语义差异。

## 6. 目标架构

先在独立目录建设，避免半成品破坏现有服务：

```text
server-rust/
├─ Cargo.toml
├─ Dockerfile
├─ src/
│  ├─ main.rs              # 进程启动、信号和优雅停机
│  ├─ app.rs               # Router、中间件与应用状态
│  ├─ config.rs            # 环境变量解析和启动校验
│  ├─ error.rs             # 业务错误、数据库错误和 HTTP 映射
│  ├─ response.rs          # { code, message, data }
│  ├─ auth/                # JWT、Argon2、当前用户/玩家提取器
│  ├─ db/                  # 连接池、事务辅助和数据库类型
│  ├─ api/                 # HTTP 请求/响应 DTO 与路由
│  └─ domain/              # 业务用例和领域规则
│     ├─ player/
│     ├─ world/
│     ├─ npc/
│     ├─ plants/
│     ├─ catalog/
│     ├─ decks/
│     ├─ quests/
│     ├─ opening/
│     ├─ battle/
│     ├─ ai/
│     └─ save/
└─ tests/
   ├─ contract/            # Python/Rust HTTP 契约样本
   └─ integration/         # 真实 PostgreSQL 流程
```

层级职责：

- `api/`：解析请求、调用用例、返回稳定响应，不包含游戏规则。
- `domain/`：拥有事务用例、状态迁移、奖励、战斗和 AI 降级规则。
- `db/`：提供连接池和共享数据库类型，不建立空洞的通用仓储层。
- SQL 查询由所属业务用例拥有；只有三处以上重复且语义一致时才提取共享查询。

## 7. 完整端点矩阵

以下路径均以当前源码为准。除健康检查外，统一挂载于 `/api/v1`。

### 7.1 健康检查（2）

| Method | Path | Rust owner | 关键契约 |
| --- | --- | --- | --- |
| GET | `/health/live` | `app` | 只检查进程存活。 |
| GET | `/health/ready` | `db` | 执行 `SELECT 1`，数据库不可用时不就绪。 |

### 7.2 认证（3）

| Method | Path | Rust owner | 风险 |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/register` | `auth::register` | 201；用户、角色、初始卡灵、卡牌和卡组同事务。 |
| POST | `/api/v1/auth/login` | `auth::login` | Argon2 与 JWT 兼容，避免用户枚举。 |
| GET | `/api/v1/auth/profile` | `auth::profile` | 当前用户数据与认证错误等价。 |

### 7.3 玩家与存档（6）

| Method | Path | Rust owner | 风险 |
| --- | --- | --- | --- |
| GET | `/api/v1/player/profile` | `player::get_profile` | 字段与可空值兼容。 |
| PUT | `/api/v1/player/profile` | `player::update_profile` | 名称唯一约束错误映射。 |
| GET | `/api/v1/player/location` | `player::get_location` | 地图与坐标一致性。 |
| POST | `/api/v1/player/location` | `player::save_location` | 时间范围与位置持久化。 |
| GET | `/api/v1/save` | `save::load` | 快照字段和数组顺序稳定。 |
| POST | `/api/v1/save` | `save::store` | 玩家、坐标和游戏时间同事务。 |

### 7.4 地图与 NPC（15）

| Method | Path | Rust owner | 风险 |
| --- | --- | --- | --- |
| GET | `/api/v1/map/{map_id}` | `world::get_map` | JSONB 资源无损返回。 |
| GET | `/api/v1/map/{map_id}/objects` | `world::get_objects` | 对象 ID 与顺序兼容。 |
| POST | `/api/v1/map/enter` | `world::enter_map` | 入口授权、出生点和位置提交。 |
| GET | `/api/v1/npc/{npc_id}` | `npc::get` | 对白、动作、服务与 AI 标志。 |
| GET | `/api/v1/npc/{npc_id}/chat` | `npc::get_chat` | 对话版本与建议回复。 |
| POST | `/api/v1/npc/{npc_id}/chat` | `npc::chat` | 外部调用后版本复检。 |
| GET | `/api/v1/npc/{npc_id}/affection` | `npc::get_affection` | 玩家隔离和里程碑状态。 |
| GET | `/api/v1/npc/{npc_id}/gifts` | `npc::gift_options` | 每日剩余次数与背包数量。 |
| GET | `/api/v1/npc/{npc_id}/service` | `npc::get_service` | 商店、任务、训练配置。 |
| POST | `/api/v1/npc/{npc_id}/shop/purchase` | `npc::purchase` | 锁顺序、库存、金币、购买记录。 |
| POST | `/api/v1/npc/{npc_id}/training/upgrade` | `npc::training_upgrade` | 扣款与属性升级原子性。 |
| POST | `/api/v1/npc/{npc_id}/gifts` | `npc::gift` | 每日限制失败不能消耗物品。 |
| POST | `/api/v1/npc/dialog` | `npc::static_dialog` | 兼容现有静态交互入口。 |
| POST | `/api/v1/npc/action` | `npc::action` | 任务/剧情动作授权。 |
| POST | `/api/v1/npc/battle` | `battle::create_from_npc` | 201；敌人卡组与奖励规则。 |

### 7.5 植物与赠礼（5）

| Method | Path | Rust owner | 风险 |
| --- | --- | --- | --- |
| GET | `/api/v1/map/{map_id}/plants` | `plants::map_nodes` | 刷新时间、节点 ID、可采集状态。 |
| GET | `/api/v1/plants/inventory` | `plants::inventory` | 数量和模板信息。 |
| POST | `/api/v1/plants/collect` | `plants::collect` | 玩家、节点和背包行锁；堆叠上限 99。 |
| GET | `/api/v1/spirits/{spirit_id}/gifts` | `plants::spirit_gift_options` | 玩家所有权和偏好排序。 |
| POST | `/api/v1/spirits/{spirit_id}/gifts` | `plants::gift_spirit` | 上海时区每日上限 5，失败不扣物品。 |

### 7.6 卡灵与卡牌图鉴（11）

| Method | Path | Rust owner | 风险 |
| --- | --- | --- | --- |
| GET | `/api/v1/spirits` | `catalog::spirits` | 排序与模板字段。 |
| GET | `/api/v1/spirit-fragments` | `catalog::fragments` | 合成门槛和拥有状态。 |
| POST | `/api/v1/spirit-fragments/{spirit_template_id}/compose` | `catalog::compose` | 并发只能成功一次。 |
| GET | `/api/v1/spirits/{spirit_id}` | `catalog::spirit` | 玩家所有权。 |
| POST | `/api/v1/spirits/{spirit_id}/affection` | `catalog::add_affection` | 冷却和奖励。 |
| POST | `/api/v1/spirits/{spirit_id}/level` | `catalog::level_spirit` | 成本与等级限制。 |
| GET | `/api/v1/spirits/{spirit_id}/growth` | `catalog::growth` | 派生字段兼容。 |
| GET | `/api/v1/cards` | `catalog::cards` | 数量、等级、效果 JSON。 |
| GET | `/api/v1/cards/{card_id}` | `catalog::card` | 玩家所有权。 |
| POST | `/api/v1/cards/{card_id}/upgrade` | `catalog::upgrade_card` | 扣款与升级原子性。 |
| GET | `/api/v1/cards/{card_id}/effects` | `catalog::card_effects` | 效果和升级数据。 |

### 7.7 卡组（6）

| Method | Path | Rust owner | 风险 |
| --- | --- | --- | --- |
| GET | `/api/v1/decks` | `decks::list` | 卡组与卡牌顺序。 |
| POST | `/api/v1/decks` | `decks::create` | 201；名称唯一约束。 |
| PUT | `/api/v1/decks/{deck_id}` | `decks::update` | 所有权和启用状态。 |
| DELETE | `/api/v1/decks/{deck_id}` | `decks::delete` | 204 无响应体。 |
| POST | `/api/v1/decks/{deck_id}/cards` | `decks::add_card` | 卡牌所有权和数量。 |
| DELETE | `/api/v1/decks/{deck_id}/cards` | `decks::remove_card` | 卡牌数量和启用卡组约束。 |

### 7.8 任务（4）

| Method | Path | Rust owner | 风险 |
| --- | --- | --- | --- |
| GET | `/api/v1/quests` | `quests::list` | 任务与玩家进度合并。 |
| POST | `/api/v1/quests/{quest_id}/accept` | `quests::accept` | 重复接受幂等。 |
| POST | `/api/v1/quests/{quest_id}/complete` | `quests::complete` | 完成条件和奖励单次发放。 |
| GET | `/api/v1/quests/{quest_id}/progress` | `quests::progress` | 未开始状态兼容。 |

### 7.9 序章（5）

| Method | Path | Rust owner | 风险 |
| --- | --- | --- | --- |
| GET | `/api/v1/opening` | `opening::get` | 旧存档默认状态。 |
| POST | `/api/v1/opening/start` | `opening::start` | 幂等创建进度。 |
| POST | `/api/v1/opening/complete` | `opening::complete` | 阶段门禁和奖励。 |
| POST | `/api/v1/opening/action` | `opening::action` | 状态机迁移与 NPC 条件。 |
| POST | `/api/v1/opening/moon-trace/action` | `opening::moon_trace_action` | 月痕阶段、首战和露娜契约。 |

### 7.10 战斗（7）

| Method | Path | Rust owner | 风险 |
| --- | --- | --- | --- |
| POST | `/api/v1/battle/create` | `battle::create` | 201；牌堆 seed、初始状态和并发活动战斗。 |
| GET | `/api/v1/battle/current` | `battle::current` | 恢复进行中状态。 |
| GET | `/api/v1/battle/{battle_id}` | `battle::get` | 玩家所有权和隐藏信息。 |
| POST | `/api/v1/battle/{battle_id}/play-card` | `battle::play_card` | `expected_version`、费用、伤害和护盾。 |
| POST | `/api/v1/battle/{battle_id}/end-turn` | `battle::end_turn` | AI 决策、版本复检和连续出牌。 |
| POST | `/api/v1/battle/{battle_id}/surrender` | `battle::surrender` | 惩罚只结算一次。 |
| GET | `/api/v1/battle/{battle_id}/result` | `battle::result` | 奖励和结果字段兼容。 |

端点计数校验：认证 3 + 战斗 7 + 图鉴 11 + 卡组 6 + 序章 5 + 植物 5 + 玩家 4 + 任务 4 + 存档 2 + 地图/NPC 15 = 62；健康检查另计 2。

## 8. 数据库与事务设计

### 8.1 迁移所有权

- 历史迁移继续由 `server/database/` 所有。
- Compose 的 `migrate` 服务继续按 `001` 到 `024` 顺序执行 SQL。
- Rust 不重新生成历史 schema，不用 SQLx migration 替换现有迁移链。
- 后续新增迁移继续使用下一个三位编号，并保持可重复执行或显式处理已存在对象。
- 涉及约束时同步更新 `server/database/tests/verify_schema.sql`。

### 8.2 SQLx 使用规则

- 读取和写入字段必须显式列出，禁止依赖 `SELECT *` 作为稳定契约。
- 金币、数量、等级和版本使用与 PostgreSQL 列兼容的整数类型，并处理越界转换。
- `TIMESTAMPTZ` 统一转换为 UTC 时间对象；每日规则显式转换为 `Asia/Shanghai`。
- JSONB 在数据库边界反序列化；字段不稳定的资源 JSON 可使用受控 `Value`，核心战斗与剧情状态使用显式结构。
- 将 PostgreSQL SQLSTATE 映射为稳定业务错误，不能把原始 SQL 错误返回客户端。

### 8.3 事务与锁清单

优先审查以下现有锁路径：

- 活动战斗读取、出牌、回合、投降和结算。
- 卡灵碎片合成与玩家卡灵创建。
- 玩家卡牌升级、训练升级和金币扣除。
- NPC 好感、里程碑奖励、赠礼和商店购买。
- 植物节点刷新、采集记录与背包堆叠。
- 序章进度、任务进度、首次胜利和剧情奖励。
- AI 对话版本写入。

每条路径在实现前记录：锁表、锁条件、锁顺序、校验时机、外部调用、提交点、唯一约束和失败状态码。Rust 测试必须覆盖至少两个并发请求竞争同一资源的场景。

## 9. 实施阶段

### Phase 0：行为基线

- 导出现有 OpenAPI 和路由端点清单。
- 固化代表性成功、校验失败、未认证、越权、冲突和不存在响应。
- 建立 Python 签发/Rust 验证与 Rust 签发/Python 验证的 JWT 样本。
- 使用数据库中真实格式的 Argon2 哈希做交叉验证。
- 将 7 个 Pytest 文件映射到 Rust 验收场景。

验收：端点矩阵无遗漏，契约样本可重复生成，所有锁与版本路径有记录。

### Phase A：基础设施、认证、玩家与存档

- 建立 Axum、配置、连接池、响应包络、错误映射、CORS、日志和健康检查。
- 迁移注册、登录、当前用户/玩家提取器、玩家资料、位置和存档。

验收：JWT/Argon2 交叉兼容；注册事务完整；玩家和存档契约无差异。

### Phase B：只读世界与图鉴

- 迁移地图、地图对象、NPC 信息、图鉴、卡牌、卡灵、卡组和任务读取。
- 为 JSONB 建立显式 DTO 和兼容回退。

验收：对现有 Demo 数据逐端点比较 JSON；未知/旧 JSON 字段不导致加载失败。

### Phase C：普通写入域

- 迁移地图进入、卡组写入、任务、商店、训练、植物采集、赠礼、好感与卡灵合成。

验收：所有权校验、行锁、每日限制、唯一约束和奖励幂等测试通过。

### Phase D：序章状态机

- 迁移序章、月痕阶段、NPC 动作、首次战斗和露娜入队契约。

验收：完整序章测试通过；重复动作不重复奖励；非法状态由应用和数据库共同拒绝。

### Phase E：战斗

- 迁移战斗创建、恢复、洗牌、出牌、护盾、AI 回合、失败、投降、结算与奖励。

验收：相同 seed 的可观察结果等价；隐藏状态不泄露；旧版本请求被拒绝；奖励/惩罚只结算一次。

### Phase F：外部 AI

- 迁移 OpenAI-compatible 客户端、提示构建、输出解析、内容边界、对话记忆和战斗决策。

验收：合法响应、非法 JSON、超时、HTTP 错误、版本冲突和关闭开关场景全部通过；回退结果确定且可玩。

### Phase G：全量切换

- 所有路径统一指向 Rust。
- 执行客户端完整 Demo 流程、数据库 schema 验证和异常演练。
- 观察错误率、P95 延迟、数据库池、事务冲突和 AI 回退率。

验收：62 个业务端点全部由 Rust 提供，FastAPI 仅作为未接流量的回滚镜像。

## 10. 测试与验证

### 10.1 Rust 静态与单元验证

```powershell
Set-Location server-rust
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-targets --all-features
```

纯逻辑重点：战斗洗牌、伤害/护盾、AI 回退、好感等级、每日边界、序章状态迁移、奖励计算和请求校验。

### 10.2 现有服务基线

```powershell
Set-Location server
docker compose run --rm migrate
docker compose --profile python-fallback run --rm api-python pytest
```

Rust 集成测试必须连接真实 PostgreSQL，禁止仅用内存 mock 声称数据库行为等价。

### 10.3 数据库验证

- 在空数据库重放全部 24 个迁移。
- 在已有开发数据库重复执行迁移服务。
- 执行 `server/database/tests/verify_schema.sql`。
- 验证状态机 `CHECK`、外键、唯一约束和删除级联。
- 验证 JSONB、时区、BigInt、可空列和默认值往返。

### 10.4 契约对比

对 Python 和 Rust 使用相同数据库夹具、请求和身份执行：

- HTTP 状态码。
- `Content-Type` 与关键认证头。
- `code`、`message`、`data` 结构。
- 字段缺失与 `null`。
- 数组排序、数字类型和时间格式。
- 失败后数据库是否发生变化。

动态 ID、令牌和时间戳通过显式规范化比较，不能简单忽略整个字段。

### 10.5 客户端验收

```powershell
Set-Location game-client
pnpm typecheck
pnpm build
```

然后只连接 Rust 后台完成：注册 -> 登录 -> 角色创建 -> 序章 -> 地图传送 -> NPC 对话/服务 -> 战斗 -> 采集 -> 赠礼 -> 卡灵合成 -> 存档 -> 重新登录恢复。

## 11. 对抗式审查

### Launch Blocker（P0/P1）

| 风险 | 用户影响 | 上线门槛 |
| --- | --- | --- |
| JWT 或 Argon2 不兼容 | 已有用户无法登录 | 跨语言样本和已有哈希验证通过 |
| 所有权过滤遗漏 | 跨玩家读取或修改数据 | 每个资源端点有越权测试 |
| 锁顺序变化 | 死锁、重复扣款或奖励 | 锁清单与并发测试通过 |
| 版本检查缺失 | 战斗或对话状态被旧请求覆盖 | 冲突测试稳定返回等价错误 |
| 每日时区错误 | 赠礼次数提前或延后刷新 | 上海时区跨日边界测试通过 |
| JSONB 类型收窄 | 地图、战斗或剧情旧数据无法加载 | 旧数据库快照往返通过 |
| AI 调用持锁 | 外部超时拖垮连接池 | 网络调用期间无数据库事务 |
| AI 失败无回退 | 对话或战斗不可继续 | 超时、非法输出、断网测试通过 |
| 错误映射泄密 | SQL、密钥或隐藏牌堆暴露 | 日志与响应去敏审查通过 |
| 切换含不可逆迁移 | 无法快速恢复 FastAPI | 切换窗口只允许向后兼容变更 |

### Follow-up（P2）

- 根据真实流量定义连接池和容量目标。
- 补充更细的业务指标和仪表盘。
- Rust 稳定后评估是否合并 `server-rust/` 与 `server/` 目录。
- 稳定运行一个发布周期后再删除 Python 依赖和镜像。

## 12. 切换与回滚

### 12.1 切换前

1. 冻结破坏性数据库变更。
2. 构建并记录 FastAPI、Rust 和数据库迁移版本。
3. 确认契约差异清单为空或已明确批准。
4. 备份数据库并验证恢复步骤。
5. 确认 FastAPI 镜像仍能连接当前数据库并通过就绪检查。

### 12.2 切换

1. 将全部 API 路由指向 Rust，不长期保留按用户随机分流的双写模式。
2. 执行健康检查、认证、读取和关键写入冒烟测试。
3. 执行完整 Demo 流程。
4. 观察错误率、P95、数据库连接、冲突率和 AI 回退率。

### 12.3 回滚条件

出现任一情况立即回滚：

- 越权、安全或密钥泄露。
- 数据丢失、重复奖励、重复扣款或状态覆盖。
- 已有用户无法登录或旧存档无法加载。
- 完整游戏主流程被阻断。
- 数据库错误或延迟持续超过预设阈值。

回滚动作：将路由或 Compose API 服务恢复到已记录的 FastAPI 镜像。由于两个服务共享原 PostgreSQL 且不双写，无需合并两套数据；若切换窗口执行了不兼容迁移，则不得仅回滚应用，必须按预演的数据库恢复方案处理。

## 13. 完成定义

Rust 重构完成必须同时满足：

- [ ] 62 个 `/api/v1` 业务端点和 2 个健康端点全部实现。
- [ ] Python/Rust 契约对比无未批准差异。
- [ ] Rust `fmt`、`clippy`、单元测试和真实数据库集成测试通过。
- [ ] 24 个历史迁移可在空库和已有库执行，schema 验证通过。
- [ ] 客户端无需 API 适配即可完成完整 Demo 流程。
- [ ] P0/P1 对抗审查项全部关闭。
- [ ] 切换、观测和回滚演练通过。
- [ ] Rust 稳定运行一个发布周期后，另行批准 FastAPI 退役。

完成标准不是“Rust 服务能启动”，而是客户端、数据库和核心玩法在切换前后保持可验证的行为等价，并且发生线上问题时可以恢复到已知可用的 FastAPI 版本。
