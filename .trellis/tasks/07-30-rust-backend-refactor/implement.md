# Rust 后台服务重构执行计划

## 1. Documentation Deliverable

- [x] 在 `doc/docs/` 新建《Rust后台服务全量等价重构方案.md》。
- [x] 将 PRD 与技术设计整理为面向实施者的单一方案文档。
- [x] 附上完整端点矩阵、Python 到 Rust 模块映射、风险和验收清单。
- [x] 检查文档内路径、端点数量和技术栈与仓库一致。

## 2. Baseline Extraction

- [x] 从 FastAPI 路由源码和客户端调用生成 62 个端点清单。
- [x] 固化 Phase A 代表性成功/失败响应、状态码、头部和 JSON 字段基线。
- [x] 建立 JWT 跨语言样本与 Argon2 哈希兼容样本，并完成 Python/Rust 双向验证。
- [x] 在设计和方案文档中标记事务、行锁、版本字段、唯一约束和幂等记录。
- [x] 将现有 Pytest 场景映射到分阶段 Rust 验收范围。

## 3. Rust Foundation

- [x] 创建 `server-rust` Cargo 项目、配置加载、Axum 应用和优雅停机。
- [x] 实现响应包络、统一错误、请求 ID、CORS、日志和健康检查。
- [x] 建立 SQLx PostgreSQL 连接池，并使用 Compose PostgreSQL 完成真实数据库验证。
- [x] Phase A 更新 Compose 以允许 Python/Rust 并行验证；Phase G 完成后默认服务已切换为 Rust。

## 4. Full API Migration Order

- [x] Phase A：认证、玩家资料、位置、存档。
- [x] Phase B：地图、NPC 只读信息、卡牌/卡灵/卡组查询。
- [x] Phase C：卡组写入、任务、商店、训练、植物采集、赠礼和合成。
- [x] Phase D：序章状态机与全部剧情奖励。
- [x] Phase E：战斗创建、恢复、出牌、回合、投降、结算与平衡逻辑。
- [x] Phase F：AI 对话与战斗决策、输出验证、超时和确定性降级。
- [x] 每个阶段完成单元测试、真实数据库集成测试和 Python/Rust 契约对比后再进入下一阶段。

Phase D 验证记录：

- [x] Rust 26 项测试、`cargo fmt --check`、Clippy `-D warnings` 和 Docker release 构建通过。
- [x] 真实 PostgreSQL 完成序章/月痕流程；4 个并发 `complete` 仅发放一次 480 金币和一份露娜契约奖励。
- [x] Python/Rust 成对执行 11 个 opening 步骤，归一化动态 ID/时间后状态码与完整业务 JSON 零差异。

Phase E 验证记录：

- [x] Rust 35 项测试在审查修复前全量通过；修复后 battle 8 项、Phase E 契约 1 项、Clippy 和 Docker release 构建通过。
- [x] 真实 PostgreSQL 并发创建返回 `201 + 409`，同版本并发回合返回 `200 + 409`；敌方隐藏状态、所有权和单次失败扣金验证通过。
- [x] 露娜剧情战斗真实胜利后仅生成 1 条战斗记录和 1 份固定契约奖励，序章推进到 `return_village`。
- [x] Python/Rust 成对执行详情、旧版本、出牌、投降、结果和当前战斗 6 步，归一化动态 ID 后状态码与业务 JSON 零差异。

Phase F 验证记录：

- [x] Linux Docker 最终执行 41 项 Rust 测试、Clippy `-D warnings` 和 release `--locked` 构建，全部通过。
- [x] OpenAI-compatible mock 覆盖成功、500、非法 JSON、超时、重定向拒绝和 64 KiB 流式上限；日志不包含 key、Authorization、prompt 或用户输入。
- [x] Python/Rust AI 关闭场景成对执行 chat 7 步，版本、request_id 幂等、好感单次提交和 fallback JSON 零差异。
- [x] Python/Rust 将 battle 状态归一到相同 seed/牌序后执行 end-turn，确定性 AI fallback 响应零差异。

## 5. Validation Commands

计划中的验证命令，具体脚本名在实现时落地：

```powershell
Set-Location server-rust
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-targets --all-features
```

```powershell
Set-Location server
docker compose run --rm migrate
docker compose exec api pytest
```

```powershell
Set-Location game-client
pnpm typecheck
pnpm build
```

还必须执行：

- [x] 对 Python 与 Rust 分别运行契约测试并比较结果。
- [x] 使用 Rust 后台完成注册到序章、探索、NPC、战斗、采集、赠礼、合成、存档恢复的完整流程。
- [ ] 执行并发合成、重复奖励、战斗旧版本写入、AI 超时和数据库中断测试。
- [x] 重放全部 SQL 迁移并执行 `database/tests/verify_schema.sql`。

## 6. Adversarial Review Gates

- [x] P0：无越权读取/写入、JWT 绕过、密码哈希不兼容、密钥日志泄露。
- [x] P0：无重复奖励、重复扣款、重复合成、丢失存档或战斗状态覆盖。
- [x] P1：时区与每日限制等价，JSONB 和可空字段往返不丢失。
- [x] P1：外部 AI 失败不会阻塞事务或破坏确定性回退。
- [ ] P1：连接池耗尽、请求取消和优雅停机不会留下部分提交。
- [x] P1：所有客户端使用中的端点均在端点矩阵中有契约测试。

## 7. Cutover and Rollback

- [x] 更新 Compose 定义：默认 `api` 构建 Rust 服务，并通过 `python-fallback` profile 保留固定版本的 FastAPI 回滚镜像。
- [x] 冻结切换窗口内的破坏性数据库变更。
- [x] 构建并记录 FastAPI 与 Rust 镜像版本。
- [x] 全部路径切换到 Rust，执行冒烟测试和完整 Demo 流程。
- [ ] 观察错误率、P95 延迟、数据库连接和业务冲突指标。
- [ ] 任一 P0/P1 验收失败立即路由回 FastAPI 镜像。
- [x] 使用 `python-fallback` profile 完成 FastAPI 回滚演练。
- [ ] Rust 稳定运行一个发布周期后，再单独审批 Python 服务退役。

Phase G 切换记录：

- [x] FastAPI 回滚镜像固定为 `world-loli-api-python:pre-rust-cutover-20260730`，镜像 ID `sha256:41f3d657669b7025f7d6735f5c3b4daae721afac79e25a2cfe4d6b16b0abbaae`。
- [x] Rust 主服务镜像 ID `sha256:26a53d8e3837fe492e9ec8890ddadb7799440e04dc992b7cc9be2599bb93ec3a`，容器启动命令为 `world-loli-server`。
- [x] `8000` 上 `/health/live` 与 `/health/ready` 通过；注册、登录、认证资料、玩家资料、存档写入与读回冒烟全部返回 `code=0`，一次性账号已清理。
- [x] 依据 FastAPI OpenAPI 清单逐项探测 62 个业务端点，Python/Rust 状态码差异为 0；Rust 分布为 2 个 `200`、56 个 `401`、4 个 `422`。
- [x] 回滚演练将 Rust 停止，并以 `PYTHON_FALLBACK_PORT=8000` 启动固定 FastAPI 镜像；存活与就绪通过后恢复 Rust，Python 回滚容器保持停止。

## 8. Risky Areas and Rollback Points

| Area | Main risk | Rollback point |
| --- | --- | --- |
| Auth | JWT/Argon2 不兼容 | 认证路由切回 Python |
| Write domains | 事务边界差异 | 对应路径切回 Python，复核数据约束 |
| Opening | 状态机或奖励重复 | 停止迁移该域，保持旧服务 |
| Battle | 随机性、版本、隐藏信息差异 | 整个战斗域切回 Python |
| AI | 超时、非法输出、锁持有 | AI 域切回 Python 或关闭 AI 开关 |
| Full cutover | 未发现的跨域差异 | Compose/代理恢复 FastAPI 镜像 |
