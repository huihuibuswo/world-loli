# AI 对战与对话接入文档实施计划

## Scope

本任务只创建并验证 `doc/AI对战与对话接入设计.md`，不修改客户端、服务端、
数据库迁移、依赖或运行配置。

## Steps

- [ ] 根据已批准的 `prd.md` 和 `design.md` 创建目标设计文档。
- [ ] 在文档中引用当前 NPC 对话、战斗服务、前端组件和配置文件的真实路径。
- [ ] 写清对话请求/响应、有限记忆、动态快捷回复和静态降级。
- [ ] 写清战斗候选动作、两阶段版本校验、确定性结算和未来怪物扩展边界。
- [ ] 写清 OpenAI-compatible 配置、密钥边界、超时、限流、日志和内容安全。
- [ ] 写清 MVP 分阶段实施、功能开关、回滚和测试矩阵。
- [ ] 对照 PRD 验收项逐条检查，不遗漏异常、并发和兼容性。
- [ ] 运行 Markdown/文本检查并阅读全文，确认没有 TBD、未解决问题或与代码现状冲突的表述。
- [ ] 用 `git diff --check` 检查空白错误，并确认没有修改业务代码。

## Validation Commands

```powershell
rg -n "TBD|TODO|尚未确认" doc\AI对战与对话接入设计.md
rg -n "DialogModal|battle_service|expected_version|AI_BASE_URL|fallback|回滚" doc\AI对战与对话接入设计.md
git diff --check
git status --short
```

## Review Gates

- 规划摘要经用户明确批准后，才创建 `doc/AI对战与对话接入设计.md`。
- 文档若改变 AI 权限、对话记忆、输入方式或供应商协议，必须返回 PRD 重新确认。
- 最终交付前执行 Trellis quality check，并确认目标文档是唯一业务交付物。

## Rollback

文档任务没有运行时影响。若内容不符合确认范围，只回退本任务新增的目标文档和对应
Trellis 任务工件，不触碰已有业务代码或其他用户改动。
