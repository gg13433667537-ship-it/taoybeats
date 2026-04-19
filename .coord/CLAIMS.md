# .coord/CLAIMS.md — 文件认领记录

> 任何人写文件前必须先登记 Claim。同一文件同一时刻只能有一个活跃 Claim。

## 项目 Agent 注册表

| Agent ID | 类型 | 配置文件 | 职责 |
|----------|------|----------|------|
| claude-main | orchestration | — | 总控、任务分派、日常开发 |

## 活跃 Claims

| T-001 | claude-main | src/components/CloneVoiceModal.tsx | 2026-04-18 | 麦克风权限和上传功能修复完成 | released |
| T-002 | claude-main | src/components/UserDropdown.tsx | 2026-04-18 | 登录UI状态修复组件 | released |

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
