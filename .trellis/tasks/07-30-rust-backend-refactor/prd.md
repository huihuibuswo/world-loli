# Rust 后台服务重构方案

## Goal

在不破坏现有游戏客户端、PostgreSQL 数据和核心游戏状态一致性的前提下，完成 `server/` 中 FastAPI 后台到 Rust 服务的全量 API 等价迁移，并在 `doc/` 下维护可执行的 Markdown 方案文档，作为实现、验收和回滚依据。

## Background

- 当前服务使用 Python 3.13、FastAPI、SQLAlchemy、Pydantic、PostgreSQL 17、JWT 和 Argon2。
- HTTP API 统一挂载在 `/api/v1`，客户端依赖 `{ code, message, data }` 响应包络和现有中文错误消息。
- 当前包含 10 个 API 路由模块、62 个路由端点、30 个 ORM 模型、24 个顺序 SQL 迁移。
- 核心业务覆盖认证、玩家与地图、NPC、AI 对话、植物、卡灵、卡组、战斗、任务、序章和存档。
- 战斗、卡灵合成、NPC 好感、商店、剧情等流程使用行锁、事务、版本号或唯一约束保证并发一致性。
- 现有 7 个 Pytest 文件覆盖完整 Demo 流程、战斗平衡、并发合成、NPC 好感、AI 降级和序章幂等性，可作为行为基线。
- Docker Compose 当前由 `postgres`、顺序 SQL `migrate` 和 FastAPI `api` 三个服务组成。

## Requirements

- R1：方案必须基于现有代码和数据库契约，不把重构等同于重新设计产品规则。
- R1.1：最终交付必须覆盖当前 FastAPI 服务的全部 API，不以长期混合栈或部分端点迁移作为完成状态。
- R2：Rust 服务必须保持现有 `/api/v1` 路径、HTTP 状态码、响应包络、JWT 语义和前端已使用的数据字段兼容。
- R3：迁移期间 PostgreSQL 是唯一业务数据源，保留现有表、约束和顺序 SQL 迁移，避免双写数据库。
- R4：方案必须明确 Rust 技术栈、模块边界、配置、认证、错误处理、数据库访问、事务、并发控制、外部 AI 调用、日志和健康检查。
- R5：方案必须给出分阶段迁移顺序、每阶段验收标准、流量切换方式和可操作回滚点。
- R6：战斗状态版本校验、`SELECT ... FOR UPDATE` 行锁、奖励幂等、每日限制、剧情状态机和地图入口授权等不变量必须被显式保留。
- R7：验证应以契约测试和真实 PostgreSQL 集成测试为主；现有 Python 测试用于提取行为基线，Rust 测试覆盖等价行为。
- R8：Rust 实现在独立的 `server-rust/` 中完成；FastAPI 在 Rust 稳定运行一个发布周期前保留为固定版本回滚镜像，不立即删除源码。

## Acceptance Criteria

- [x] `doc/` 下新增一份中文 Rust 后台重构方案 Markdown 文档。
- [x] 文档列出现状清单、目标架构、API/数据库兼容策略、模块映射和依赖选择依据。
- [x] 文档包含可独立验收的迁移阶段，而不是一次性“大爆炸”替换步骤。
- [x] 全部现有 API 均被纳入端点映射、等价实现和契约验收清单。
- [x] 文档明确高风险不变量、失败场景、回滚条件和验证命令。
- [x] 文档明确本次范围与延期项，避免借重构扩大产品功能。
- [x] Trellis 的 `prd.md`、`design.md`、`implement.md` 在进入代码实现前完成并经用户批准。
- [x] `server-rust/` 覆盖现有 62 个业务 API，并通过分阶段 Rust 测试、真实 PostgreSQL 验证和 Python/Rust 契约对比。
- [x] Compose 默认 `api` 已切换到 Rust，固定 FastAPI 镜像保留在 `python-fallback` profile，并完成原端口回滚演练。

## Out of Scope

- 不删除或改写 FastAPI 业务源码；Python 服务退役需等待 Rust 稳定运行一个发布周期后另行审批。
- 不改变前端产品行为、战斗数值、剧情规则、数据库业务结构或 AI 产品策略。
- 不引入微服务拆分、消息队列、缓存层、事件溯源或多数据库双写，除非后续有可验证需求。
- 不在本次切换中引入性能平台、长期监控系统或新的部署基础设施；发布周期内的 P95 与错误率观察作为后续运行验收。

## Key Decision

- 最终范围采用全量 API 等价迁移。
- 实施按基础设施、只读域、普通写入域、高并发状态域、外部 AI 域分阶段完成；只有全部契约通过后，Rust 才替换 FastAPI 成为唯一 API 服务。
