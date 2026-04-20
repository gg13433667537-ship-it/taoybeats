# Pre-Set Plan — 项目维护与稳定性修复

> **触发指令**: "启动预设定计划"
> **创建时间**: 2026-04-19
> **状态**: 待执行

## 计划概述

本计划包含项目维护与稳定性修复的6个任务，按优先级排序。所有任务都经过全面审计确认有必要执行。

---

## P0 — 必须立即执行

### T-P0-001: 清理 T-040 过期的 Claims

**文件**: `.coord/CLAIMS.md`

**问题**: 19个文件标记为 `active` 但实际已完成并合并到 main

**操作**: 将所有 T-040 相关的 claim 状态从 `active` 改为 `released`

**验证**: `cat .coord/CLAIMS.md | grep "active" | grep T-040` 应返回空

---

### T-P0-002: 修复 usage API 空指针异常

**文件**: `src/app/api/usage/route.ts`

**问题**: `getUserUsageFromDB` 返回 null 时访问 `.monthlyResetAt` 导致 TypeError

**操作**: 在 `route.ts:62` 添加 null 检查

**验证**: `npm test -- --run tests/api/usage.test.ts` 应通过

---

## P1 — 高优先级

### T-P1-001: 修复 9 个 Lint 错误

**涉及文件**:
- `src/components/AudioPlayer.tsx` (setState in effect)
- `tests/app/generate-result-card.test.tsx` (React Hook 规则违规)
- `tests/lib/song-download.test.ts` (module 变量赋值)
- `tests/api/stripe-checkout-config.test.ts` (explicit any)

**操作**:
1. `generate-result-card.test.tsx:55` — 将 `React.useEffect` 移到合规的 React 组件内
2. `song-download.test.ts:8` — 将变量名 `module` 改为 `songModule`
3. `AudioPlayer.tsx:78` — 重构 setState 逻辑
4. `stripe-checkout-config.test.ts:70` — 使用正确类型替代 any

**验证**: `npm run lint` 应返回 0 errors

---

### T-P1-002: 清理并同步 TASKS.md 状态

**文件**: `.coord/TASKS.md`

**问题**: 多个任务已完成但标记为"待领取"

**操作**:
- T-016 (Apple OAuth) → 标记完成
- T-022 (分享链接) → 标记完成
- T-023 (Fork重新生成) → 标记完成
- T-026 (Stripe订阅页) → 标记完成
- T-032 (管理员入口) → 标记完成

**验证**: TASKS.md 完成度百分比应与 git log 一致

---

## P2 — 中优先级

### T-P2-001: 评估 nodemailer 替代方案（Resend）

**问题**: nodemailer <=8.0.4 有 SMTP 命令注入漏洞

**操作**:
1. 检查项目是否已集成 Resend（审计显示已集成 `resend@6.12.0`）
2. 确认邮件发送是否已迁移到 Resend
3. 如果未迁移，评估迁移方案

**验证**: 确认 nodemailer 漏洞已消除或已用 Resend 替代

---

## 执行顺序

```
T-P0-001 (清理Claims)
    ↓
T-P0-002 (修复usage API)
    ↓
T-P1-001 (修复Lint)
    ↓
T-P1-002 (同步TASKS)
    ↓
T-P2-001 (评估Resend)
```

---

## 验证命令汇总

执行完成后，运行以下命令确认：

```bash
# 1. Claims 清理验证
cat .coord/CLAIMS.md | grep "active" | grep T-040

# 2. usage API 测试
npm test -- --run tests/api/usage.test.ts

# 3. Lint 检查
npm run lint

# 4. TypeScript 检查
npm run type-check

# 5. Build 检查
npm run build

# 6. 全量测试
npm test -- --run
```

---

## 风险与依赖

- **无外部依赖**: 所有任务只涉及现有代码
- **无破坏性变更**: 只修复错误，不改变功能
- **测试覆盖**: 修复后需验证现有测试仍通过
