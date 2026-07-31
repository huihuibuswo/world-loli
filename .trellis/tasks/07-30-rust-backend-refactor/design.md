# Rust 后台服务重构技术设计

## 1. Design Objective

将 `server/` 的 FastAPI 服务完整迁移为单体 Rust API 服务。迁移后的服务继续使用现有 PostgreSQL 数据库、顺序 SQL 迁移、Docker Compose 网络、`/api/v1` 路径和客户端契约。目标是语言与运行时替换，不是业务重写或微服务拆分。

## 2. First-Principles Constraints

必须成立的不变量：

1. 客户端在切换前后无需修改即可完成现有 Demo 全流程。
2. PostgreSQL 表、约束、已有数据和迁移顺序保持权威，Rust 不另建一套业务模型。
3. 同一个写请求的校验、锁、状态变化、奖励发放和提交必须处于等价事务边界。
4. 战斗与 AI 对话的版本冲突必须继续被拒绝，不能发生静默覆盖。
5. 外部 AI 失败、超时或非法输出时必须保持当前确定性降级行为。
6. Rust 全量契约验收通过前，FastAPI 保持可启动、可回滚。

## 3. Target Stack

| Concern | Choice | Reason |
| --- | --- | --- |
| Async runtime | Tokio | Rust 服务端生态基线，支持 HTTP、数据库和外部调用并发。 |
| HTTP | Axum + Tower | 路由、提取器、中间件和测试能力清晰，适合显式契约迁移。 |
| Serialization | Serde + serde_json | 保持现有 JSON 字段、可选值和 JSONB 结构。 |
| Database | SQLx + PostgreSQL | 显式 SQL、事务与 `FOR UPDATE` 可直接映射现有数据库不变量。 |
| Configuration | config + dotenvy | 映射当前环境变量并支持启动时强校验。 |
| Authentication | jsonwebtoken + argon2 | 保持 HS256 JWT 与 Argon2 密码兼容。迁移前用真实哈希样本验证。 |
| Outbound HTTP | Reqwest | 调用 OpenAI-compatible API，支持超时和结构化错误。 |
| Validation | validator + domain constructors | 在请求边界复现 Pydantic 校验，并在领域层保护不变量。 |
| Observability | tracing + tracing-subscriber | 结构化日志、请求 ID、延迟和错误上下文。 |
| OpenAPI | utoipa | 保留接口文档能力；生成结果不作为唯一契约来源。 |
| Testing | cargo test + testcontainers/Compose PostgreSQL | 单元、契约和真实数据库集成验证。 |

不采用 Diesel ORM、微服务、Redis、消息队列、事件溯源或数据库双写。当前需求没有证明这些复杂度必要。

## 4. Repository Shape

建议在 `server-rust/` 独立建设，完成切换后再决定是否改名为 `server/`：

```text
server-rust/
├─ Cargo.toml
├─ Dockerfile
├─ src/
│  ├─ main.rs
│  ├─ app.rs
│  ├─ config.rs
│  ├─ error.rs
│  ├─ response.rs
│  ├─ auth/
│  ├─ db/
│  ├─ api/
│  └─ domain/
│     ├─ battle/
│     ├─ opening/
│     ├─ npc/
│     ├─ catalog/
│     ├─ world/
│     └─ save/
└─ tests/
   ├─ contract/
   └─ integration/
```

`api/` 只负责 HTTP 边界；`domain/` 持有业务规则与事务用例；`db/` 提供查询和事务辅助。避免建立与每张表一一对应的仓储抽象，SQLx 查询可由所属用例直接拥有。

## 5. API Compatibility Contract

- 保留 `/health/live`、`/health/ready` 与全部 `/api/v1/**` 路径和方法。
- 保留成功响应包络 `{ "code": 0, "message": "ok", "data": ... }` 的实际语义。
- 保留错误状态码、`message`、`data` 形状以及认证失败的 `WWW-Authenticate` 行为。
- 字段名称、缺失字段与 `null` 的区别、数字类型、时间格式、数组顺序均需纳入契约快照。
- 保留 `204` 删除响应无响应体等例外，不能强行套统一包络。
- JWT 继续使用现有 `sub`、`iat`、`exp` 声明与配置算法；Rust 和 Python 互发令牌必须交叉可验。

## 6. Database and Transaction Design

- 继续挂载 `server/database/`，迁移服务仍按 `NNN_*.sql` 顺序执行，Rust 不接管历史迁移。
- SQLx 模型以数据库列为准，JSONB 使用显式 DTO，避免无类型 `Value` 在业务层扩散。
- 所有当前 `with_for_update()` 路径逐项映射为 `SELECT ... FOR UPDATE`，并保持锁顺序一致。
- `ActiveBattle.version`、`NpcAiConversation.version` 使用条件检查或锁内检查，冲突返回当前等价错误。
- 唯一约束、检查约束、外键与幂等记录仍由 PostgreSQL 作最终防线。
- 每个写用例只提交一次；外部 AI 调用不得长期占用数据库事务。采用“读取快照并记录版本 -> 调用外部服务 -> 重新加锁校验版本 -> 提交”的现有机制等价实现。

## 7. Module Migration Map

| Python owner | Rust target | Risk |
| --- | --- | --- |
| `core/config.py`, `main.py` | `config`, `app`, middleware | Medium |
| `core/security.py`, `api/auth.py` | `auth` | High: hash/JWT compatibility, registration transaction |
| `api/player.py`, `api/save.py` | `domain/player`, `domain/save` | Medium |
| `api/world.py`, `services/npc_service.py` | `domain/world`, `domain/npc` | High: portal auth, rewards, shops |
| `api/plants.py` | `domain/plants` | High: collection locks, daily limits |
| `api/catalog.py`, `api/decks.py` | `domain/catalog`, `domain/decks` | High: ownership and composition concurrency |
| `api/quests.py` | `domain/quests` | Medium: idempotent transitions |
| `api/opening.py`, `opening_story_service.py` | `domain/opening` | High: persisted state machine and rewards |
| `api/battle.py`, battle services | `domain/battle` | Critical: deterministic state, secrecy, versioning, penalties |
| AI services | `domain/ai` | High: timeouts, validation, deterministic fallback |

## 8. Migration and Cutover

实施阶段可以并行存在两个容器，但同一个端点在任一环境中只有一个写入者。建议使用反向代理按路径选择 Python 或 Rust，逐域完成内部验证；生产式统一切换前，将全部路径指向 Rust。

全量完成门槛：

1. 端点清单 100% 映射。
2. Python/Rust 契约差异为空，或差异已被明确批准。
3. 全部真实数据库集成测试通过。
4. 客户端完整 Demo 流程对 Rust 服务通过。
5. FastAPI 容器保留一个发布周期作为回滚镜像，数据库无 Rust 专属不可逆变更。

## 9. Failure and Rollback

- 启动配置无效或数据库不可达：就绪检查失败，服务不接流量。
- SQL/约束冲突：事务回滚，返回稳定业务错误，不泄露 SQL 和密钥。
- AI 超时或非法响应：记录去敏错误并执行现有静态/确定性回退。
- 契约或状态差异：停止对应域迁移，路由切回 FastAPI；由于共享原数据库且无双写，不需要数据合并。
- 全量切换失败：将 API 路由/Compose 服务切回已保留的 FastAPI 镜像；只允许向后兼容数据库迁移进入切换窗口。

## 10. Security and Operations Review

- 禁止记录 JWT、密码、AI API Key、完整玩家输入和敌方隐藏牌堆。
- 为请求设置 body 上限、外部调用超时、数据库池上限和优雅停机时间。
- 错误响应不暴露 SQL、Rust backtrace 或外部供应商原始响应。
- 健康检查区分进程存活与数据库就绪。
- 记录请求 ID、路由、状态码、延迟和业务错误码；高频位置同步日志需采样。

## 11. Deferred Items

- 性能压测与容量目标在获得真实并发目标后单独定义。
- 数据库结构清理、API v2、WebSocket、缓存和服务拆分延期。
- 完成迁移后是否删除 Python 代码，需在 Rust 稳定运行一个发布周期后决策。
