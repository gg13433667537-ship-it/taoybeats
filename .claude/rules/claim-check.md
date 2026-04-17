# CLAIMS 自动检查规则

## 触发条件

在执行 Write/Edit 操作前自动检查。

## 检查流程

1. 读取 `.coord/CLAIMS.md`
2. 检查目标文件是否在活跃 Claim 中
3. 如果有活跃 Claim 且不属于当前 Agent → **BLOCK**
4. 如果文件不在 CLAIMS 中 → **WARN**（提醒先登记 Claim）
5. 如果无 Claim 但文件存在 → **BLOCK**

## Block 处理

如果文件有活跃 Claim：
```
❌ BLOCKED: [文件路径] 已被 [负责人] 在 [时间] Claim
   任务: [任务号]
   建议: 等待 Claim 释放，或在 HANDOFF 中请求转交
```

如果文件未被 Claim 但已存在：
```
❌ BLOCKED: [文件路径] 存在但未被 Claim
   建议: 先在 .coord/CLAIMS.md 登记 Claim
```

## 例外情况

- `.coord/CLAIMS.md` 本身 — 可在验证时更新
- `.coord/HANDOFF.md` — 任务完成交接时更新
- `AGENTS.md` — AI 总控可更新
