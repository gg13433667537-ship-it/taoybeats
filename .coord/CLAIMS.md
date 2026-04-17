# .coord/CLAIMS.md — 文件认领记录

> 任何人写文件前必须先登记 Claim。同一文件同一时刻只能有一个活跃 Claim。

## 项目 Agent 注册表

| Agent ID | 类型 | 配置文件 | 职责 |
|----------|------|----------|------|
| claude-main | orchestration | — | 总控、任务分派 |
| codex-main | implementation | — | 主实现者 |
| worker-frontend | implementation | .codex/agents/worker-frontend.md | 前端实现 |
| worker-backend | implementation | .codex/agents/worker-backend.md | 后端实现 |
| worker-tests | verification | .codex/agents/worker-tests.md | 测试与回归 |
| explorer-codebase | research | .codex/agents/explorer-codebase.md | 代码分析 |
| reviewer-quality | review | .codex/agents/reviewer-quality.md | 质量复核 |

## 活跃 Claims

| 任务号 | 负责人 | 路径 | 认领时间 | 预计释放条件 | 状态 |
|--------|--------|------|----------|--------------|------|
| T-029-fix | codex-main | src/app/admin/page.tsx | 2026-04-17 12:46 | Admin 编辑 modal 改为受控状态并完成验证/HANDOFF | released |
| T-029-fix | codex-main | src/app/admin/user-edit-modal-state.ts | 2026-04-17 12:46 | Admin 编辑 modal 改为受控状态并完成验证/HANDOFF | released |
| T-029-fix | codex-main | src/app/admin/user-edit-modal-state.test.mts | 2026-04-17 12:46 | Admin 编辑 modal 改为受控状态并完成验证/HANDOFF | released |
| T-029-fix | codex-main | .coord/HANDOFF.md | 2026-04-17 12:46 | 写入本次修复交接并释放 Claim | released |

---

## Claim 登记模板

```
| T-XXX | [Agent ID] | [文件路径] | [YYYY-MM-DD HH:MM] | [预计完成条件] | active |
```

## Claim 规则

1. **登记**：写文件前必须先在上述表格登记
2. **独占**：活跃 Claim 的文件禁止其他 Agent 写
3. **释放**：任务完成并写入 HANDOFF 后，状态改为 `released`
4. **超时**：超过 30 分钟无进展，需重新评估
5. **强制释放**：总控可强制释放过期 Claim

## 路径通配符规则

- `src/**` — 包含 src 下所有子目录和文件
- `src/` — 仅 src 目录本身，不含子文件

## 释放条件模板

- 任务完成且代码已验证
- HANDOFF 已写入
- 验证命令已通过
