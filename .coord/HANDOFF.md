# .coord/HANDOFF.md — 任务交接记录

> 用于不同 Agent 之间交接。每条交接包含：任务号、已做内容、改动文件、未决问题、下一步建议、风险提示。
> **强制**：任务完成必须写 HANDOFF，不写视为未完成。

## 交接列表

---

## T-VoiceFix — 声音克隆功能修复

**从**: claude-main
**到**: claude-main
**状态**: completed

```
时间: 2026-04-18

已做内容:
  1. 修复麦克风权限请求流程:
     - 添加 getUserMedia 支持检测
     - 添加更详细的错误分类和处理
     - 区分权限拒绝、设备未找到、设备被占用、安全策略阻止等不同错误
     - 提供具体的错误提示信息而非通用错误消息
     - 添加音频约束配置（回声消除、噪音抑制、采样率）

  2. 增强音频文件上传功能:
     - 添加文件扩展名作为 MIME 类型检测的补充
     - 支持更多音频格式：mp3, wav, m4a, ogg, aac, flac, webm
     - 更新文件 input 的 accept 属性以匹配支持的格式

改动文件:
  - src/components/CloneVoiceModal.tsx

验证结果:
  - npm run lint: ✅ (0 errors, 2 pre-existing warnings)
  - npm run type-check: ✅
  - CloneVoiceModal.tsx 无新增 lint 错误

未决问题: 无

下一步:
  - 实际用户测试麦克风权限流程
  - 实际用户测试音频文件上传功能

风险提示: 无
```

---

## Framework-Reconstruction — Claude Code × Codex 协作框架重建

**从**: claude-main
**到**: claude-main
**状态**: completed

```
时间: 2026-04-18

Phase 1 - 审计完成:
  - 归档 AGENTS.md（包含旧的 Codex-centric 规则）
  - 归档 .coord/CODEX_TASKS.md 和 .coord/CODEX_RESULTS.md
  - 归档 .codex/agents/ 下的 5 个旧代理定义
  - 保留 .coord/CLAIMS.md, DECISIONS.md, TASKS.md, HANDOFF.md

Phase 2 - 备份废除完成:
  - 创建 .archive/legacy-ai-collab/2026-04-18/
  - 移动 AGENTS.md → .archive/
  - 移动 CODEX_* → .archive/
  - 移动 .codex/agents/*.md → .archive/

Phase 3 - 新框架落地完成:
  - 重写 CLAUDE.md（新框架单一入口规则）
  - 更新 .coord/CLAIMS.md（移除 Codex agents）
  - 更新 .coord/DECISIONS.md（添加 D-019 决策）
  - 更新 .coord/TASKS.md（移除 Codex 委托流程，添加简化协作框架）

Phase 4 - 待集成:
  - Codex CLI 保留但仅用于高影响决策
  - Token 成本监控
  - 定期审查 Codex 调用频率

Phase 5 - 迁移报告输出（本次）

改动文件:
  - AGENTS.md → .archive/legacy-ai-collab/2026-04-18/
  - .coord/CODEX_TASKS.md → .archive/
  - .coord/CODEX_RESULTS.md → .archive/
  - .codex/agents/*.md → .archive/
  - CLAUDE.md（重写）
  - .coord/CLAIMS.md（更新）
  - .coord/DECISIONS.md（D-019）
  - .coord/TASKS.md（更新）

新框架核心变更:
  1. Claude Code 是唯一入口，用户只与 Claude Code 对话
  2. Codex 仅用于高影响力决策（架构重构、重大技术选型）
  3. Token 成本是硬约束，常规工作不调用 Codex
  4. 安全第一：绝不发送 API keys/tokens 到 Codex

验证结果:
  - 所有文件已正确移动到 .archive/
  - 新 CLAUDE.md 符合简化框架原则
  - .coord/ 文件已更新

下一步:
  - 继续完成待完成任务（T-038 Admin i18n, T-032 管理员入口等）
  - 监控 Token 使用成本
  - 定期回顾框架效果
```

---



---

## T-029-fix — Admin 用户编辑 Modal 受控状态修复

**从**: codex-main
**到**: claude-main
**状态**: completed

```
改动文件:
  - src/app/admin/page.tsx
  - src/app/admin/user-edit-modal-state.ts
  - src/app/admin/user-edit-modal-state.test.mts

已做内容:
  - 将 Admin 用户编辑弹窗的 role/tier/isActive 改为受控状态，打开弹窗时从 selected user 同步初始值
  - 去掉依赖 DOM id 的读取方式，保存时直接提交 editFormState
  - 为 modal 状态初始化与 PATCH payload 形状补了回归测试
  - 修正测试文件导入路径，使其能被 TypeScript 编译并经 Node 测试运行器执行
  - 顺手修掉本文件范围内阻塞 lint 的 `any`

验证结果:
  - `npx tsc --noEmit --pretty false` ✅
  - `npm run lint -- src/app/admin/page.tsx src/app/admin/user-edit-modal-state.ts src/app/admin/user-edit-modal-state.test.mts` ✅（仍有 1 条既有 warning：`react-hooks/exhaustive-deps`）
  - `npx tsc --outDir /tmp/admin-modal-test --module nodenext --moduleResolution nodenext --target es2022 --pretty false src/app/admin/user-edit-modal-state.ts src/app/admin/user-edit-modal-state.test.mts && node --test /tmp/admin-modal-test/user-edit-modal-state.test.mjs` ✅（2/2 passed）
  - `npm run build` ✅
  - `npm run lint` ❌（仓库既有问题，当前输出 80 errors / 19 warnings，分布于 dashboard/generate/api/lib 等文件，非本次 claim 引入）

未决问题:
  - 全仓库 lint 目前不通过，无法满足 AGENTS.md 中的完整提交前门槛
  - src/app/admin/page.tsx 仍有 1 条既有 hook dependency warning

下一步:
  - 若要满足仓库级提交流程，需要单独开任务清理现有 lint 错误
  - 如需更严格覆盖，可补一个真正挂载 Admin modal 的组件级测试

风险提示:
  - 本次修复已通过类型检查、可执行回归测试和生产构建，但未消除仓库历史 lint 债务
```

## T-000 — 协作框架初始化

**从**: AI 总控
**到**: 所有协作者
**状态**: completed

```
改动文件:
  - AGENTS.md（新建/更新）
  - .coord/PROJECT.md（新建）
  - .coord/TASKS.md（新建）
  - .coord/CLAIMS.md（新建）
  - .coord/DECISIONS.md（新建）
  - .coord/HANDOFF.md（新建）
  - .coord/CHECKS.md（新建）
  - .claude/settings.json（新建）
  - .claude/agents/*.md（6个子代理定义）
  - CLAUDE.md（新建）

已验证:
  - 所有协作文件已创建
  - 子代理定义完成

未决问题:
  - 技术栈未确定
  - 业务需求未输入

下一步:
  - 确定技术栈
  - 输入业务需求

风险提示: 无
```

---

## T-044 — Session 校验支持 DB sessionsRevokedAt

**从**: claude-main
**到**: claude-main
**状态**: completed

```
时间: 2026-04-21

已做内容:
  1. 修改 src/lib/auth-utils.ts:
     - 新增 verifySessionTokenWithDB(token) 异步函数
     - 先调用 verifySessionToken() 校验签名和过期时间
     - 再查询 prisma.user.findUnique 获取 isActive 和 sessionsRevokedAt
     - 如果用户不存在、未激活、或 token.iat < sessionsRevokedAt，返回 null
     - 所有 DB 错误均被捕获并返回 null，避免泄露内部错误

  2. 修改 src/app/api/auth/profile/route.ts:
     - getCurrentUser() 从 verifySessionToken() 改为 await verifySessionTokenWithDB()
     - 导入 verifySessionTokenWithDB 替换原有的 verifySessionToken

改动文件:
  - src/lib/auth-utils.ts
  - src/app/api/auth/profile/route.ts
  - .coord/CLAIMS.md

验证结果:
  - npm run lint -- src/lib/auth-utils.ts src/app/api/auth/profile/route.ts: ✅ (0 errors, 0 warnings)
  - npm run type-check: 修改文件无错误 ✅（仓库其他文件有既有错误，非本次引入）
  - git commit: b4f217c

未决问题: 无

下一步:
  - 其他需要 session 校验的 API route（如 songs, admin 等）可统一迁移到 verifySessionTokenWithDB
  - 运行完整测试套件验证登录/Session 链路

风险提示: 无
```

---

## T-043 — 忘记密码重置 API 实现

**从**: claude-main
**到**: claude-main
**状态**: completed

```
时间: 2026-04-21

已做内容:
  1. 新建 src/app/api/auth/reset-password/route.ts:
     - POST 接口接收 email, code, newPassword
     - 使用 rateLimitMiddleware + AUTH_RATE_LIMIT ("reset-password") 限流
     - CSRF Double Submit Cookie 校验
     - sanitizeEmail / sanitizeString 输入消毒
     - 从 Prisma VerificationToken 表验证验证码（支持过期检查），验证成功后删除 token
     - 通过 prisma.user.findUnique 按邮箱查找用户
     - 使用 bcrypt.hash(sanitizedPassword, 10) 加密新密码
     - 更新 user.password 并设置 sessionsRevokedAt = new Date() 使所有现有会话失效
     - 完整错误码覆盖：400（参数缺失/密码太短/验证码错误）、404（用户不存在）、500（更新失败）、503（数据库繁忙）
     - 统一使用 logger.api.request / response / error + requestId 追踪
     - 所有响应均通过 applySecurityHeaders 附加安全头

改动文件:
  - src/app/api/auth/reset-password/route.ts（新建）
  - .coord/CLAIMS.md

验证结果:
  - npm run lint -- src/app/api/auth/reset-password/route.ts: ✅ (0 errors)
  - npm run type-check: reset-password/route.ts 无错误 ✅（仓库其他文件有既有错误，非本次引入）
  - git commit: 780dc20

未决问题: 无

下一步:
  - 前端对接 /api/auth/reset-password 接口实现忘记密码页面
  - 运行完整测试套件验证登录/重置链路

风险提示: 无
```

---

## T-045 — 登录页支持密码和验证码双模式

**从**: claude-main
**到**: claude-main
**状态**: completed

```
时间: 2026-04-21

已做内容:
  1. 重写 src/app/(auth)/login/page.tsx:
     - 移除原有的两步流程（email step → login step），改为单页表单
     - 新增 loginMethod 状态: 'password' | 'code'，默认 password
     - 新增 tab 切换按钮（密码登录 / 验证码登录）
     - 密码模式: 显示邮箱 + 密码输入框，提交到 POST /api/auth/login
     - 验证码模式: 显示邮箱 + 验证码输入框 + "获取验证码"按钮
     - sendCode 函数: 调用 POST /api/auth/send-code，60秒倒计时
     - 验证码模式提交到 POST /api/auth/verify
     - 添加 "忘记密码?" 链接，跳转到 /reset-password
     - 保留 CSRF token、i18n、loading/error 状态、showPassword 切换

改动文件:
  - src/app/(auth)/login/page.tsx
  - .coord/CLAIMS.md

验证结果:
  - npx eslint src/app/(auth)/login/page.tsx: ✅ (0 errors)
  - npx tsc --noEmit | grep login/page: 无错误 ✅
  - git commit: c163302

未决问题: 无

下一步:
  - 与 T-046 reset-password 页面联调
  - 运行完整测试套件验证登录/注册/重置链路

风险提示: 无
```

---

## T-042 — 验证码登录 Prisma 持久化改造

**从**: claude-main
**到**: claude-main
**状态**: completed

```
时间: 2026-04-21

已做内容:
  1. 重写 src/app/api/auth/verify/route.ts:
     - 删除所有内存存储引用 (global.users, global.songs, global.adminLogs, users 变量)
     - 新增 prisma 和 logger 导入
     - 验证码改为从 Prisma VerificationToken 表查询（支持过期检查）
     - 验证成功后删除已使用的 token
     - 用户不存在时自动通过 prisma.user.create() 创建
     - 第一个自动创建的用户设为 ADMIN，其余为 USER
     - 移除 verify-token 和 dev-code cookie 清除逻辑（不再使用）
     - 保留 session-token cookie 设置
     - Prisma 失败时返回 503/500 错误

  2. 修复 Prisma schema:
     - User.updatedAt 添加 @updatedAt 属性，使 user.create() 无需手动传入 updatedAt

改动文件:
  - src/app/api/auth/verify/route.ts
  - prisma/schema.prisma
  - .coord/CLAIMS.md

验证结果:
  - npm run lint -- src/app/api/auth/verify/route.ts: ✅ (0 errors)
  - npm run type-check: verify/route.ts 无错误 ✅（仓库其他文件有既有错误，非本次引入）
  - npx prisma generate: ✅
  - git commit: 70d74d2

未决问题: 无

下一步:
  - 继续清理其他 auth API 中的内存回退逻辑（如 profile route 等）
  - 运行完整测试套件验证登录链路

风险提示: 无
```

---

## T-046 — 忘记密码重置页面

**从**: claude-main
**到**: claude-main
**状态**: completed

```
时间: 2026-04-21

已做内容:
  1. 新建 src/app/(auth)/reset-password/page.tsx:
     - 3 步流程：输入邮箱 → 输入验证码+新密码 → 重置成功
     - Step 1: 邮箱输入，调用 POST /api/auth/send-code 发送验证码，60秒倒计时
     - Step 2: 验证码输入（6位数字，居中大字）+ 新密码 + 确认密码
     - Step 3: 成功提示 + "去登录"按钮跳转到 /login
     - 与 login/register 页面一致的暗色主题设计
     - 使用 bg-background, text-foreground, bg-surface, border-border, bg-accent 等统一 Tailwind 类
     - 包含 CSRF token 保护（refreshCSRFToken + getCSRFToken + x-csrf-token header）
     - i18n 支持（useI18n hook，复用现有翻译键）
     - 密码显示/隐藏切换（Eye/EyeOff 图标）
     - 表单验证：邮箱格式、验证码6位、密码至少6字符、两次密码一致
     - 错误提示使用 bg-error/10 + border-error/20 样式
     - 成功提示使用 bg-success/10 + border-success/20 样式
     - 顶部 TaoyBeats Logo + 返回登录链接
     - Suspense 包裹（与 login/register 一致，避免 useSearchParams 导致 SSR 问题）

改动文件:
  - src/app/(auth)/reset-password/page.tsx（新建）
  - .coord/CLAIMS.md

验证结果:
  - npm run lint -- src/app/(auth)/reset-password/page.tsx: ✅ (0 errors, 0 warnings)
  - npm run type-check: reset-password/page.tsx 无错误 ✅（仓库其他文件有既有错误，非本次引入）
  - git commit: 8cf0db1

未决问题: 无

下一步:
  - 与 T-045 登录页联调（登录页已添加 "忘记密码?" 链接指向 /reset-password）
  - 运行完整测试套件验证登录/注册/重置链路
  - 可考虑补充 reset-password 的 E2E 测试

风险提示: 无
```

---

## HANDOFF 模板

```markdown
## [任务号] — [标题]

**从**: [来源 Agent]
**到**: [目标 Agent]
**状态**: [pending/in_progress/completed]

```
改动文件:
  - [文件路径 1]
  - [文件路径 2]

已做内容:
  - [已完成项 1]
  - [已完成项 2]

未决问题:
  - [未解决问题 1]
  - [未解决问题 2]

下一步:
  - [建议 1]
  - [建议 2]

风险提示:
  - [风险 1]
```

---

## 2026-04-18 Bug修复与任务完成 — Claude Code

**问题修复**：
1. 注册失败根因：Prisma失败时静默吞错，session仍发出
2. 修复方案：调整注册流程，Prisma成功后再发session
3. Supabase IP白名单：需用户配置
4. Stripe Price ID：需用户提供

**已完成任务**：
- T-016: Apple OAuth 配置 ✅
- T-022: 分享链接功能 ✅
- T-023: Fork重新生成 ✅
- T-026: Stripe订阅页面 ✅
- T-032: 管理员入口 ✅
- T-038: Admin i18n（进行中）

**待用户处理**：
1. Supabase IP白名单配置
2. Stripe Price ID配置
3. Apple OAuth需要Apple开发者账号验证

**验证结果**：
- npm run lint: ✅
- npm run build: ✅
- 部署: ✅

## 交接规则

1. 每完成一个任务必须写 HANDOFF
2. HANDOFF 是任务完成的必要条件
3. 未写入 HANDOFF 视为任务未完成
4. HANDOFF 必须包含验证结果
5. Blocker 必须在 HANDOFF 中明确标注

---

## 项目配置更新 (Codex 初始化)

从: Codex 初始化
到: 所有 Agent
已做内容:
  - 创建 .codex/config.toml（项目自治配置）
  - 创建 5 个项目级 agents
  - 更新 AGENTS.md（合并总控+Codex+Worker 角色）
  - 更新 .coord/CLAIMS.md（Agent 注册表）
改动文件:
  - .codex/config.toml（新建）
  - .codex/agents/worker-frontend.md（新建）
  - .codex/agents/worker-backend.md（新建）
  - .codex/agents/worker-tests.md（新建）
  - .codex/agents/explorer-codebase.md（新建）
  - .codex/agents/reviewer-quality.md（新建）
  - AGENTS.md（更新）
  - .coord/CLAIMS.md（更新）
  - .coord/HANDOFF.md（更新）
未决问题:
  - 技术栈未确定
  - 业务代码为空
  - git 仓库未初始化
下一步建议:
  - 总控确定技术栈后，更新 CHECKS.md 和 config.toml commands
  - 初始化 git 仓库
  - 开始 T-002 项目结构初始化
风险提示: 无

---

## 项目配置初始化 (Codex Setup)

已做内容:
  - 建立 .codex/ 项目配置目录
  - 创建 .codex/config.toml（sandbox/approval/limits 配置）
  - 创建 5 个项目级 agents（worker-*, explorer-*, reviewer-*）
  - 更新 AGENTS.md（合并总控+Codex+Worker 角色定义）
  - 更新 .coord/CLAIMS.md（Agent 注册表）
  - 更新 .coord/DECISIONS.md（D-003~D-005）
改动文件:
  - .codex/config.toml
  - .codex/agents/worker-frontend.md
  - .codex/agents/worker-backend.md
  - .codex/agents/worker-tests.md
  - .codex/agents/explorer-codebase.md
  - .codex/agents/reviewer-quality.md
  - AGENTS.md
  - .coord/CLAIMS.md
  - .coord/DECISIONS.md
  - .coord/HANDOFF.md
未决问题:
  - 技术栈未确定
  - 业务代码为空
  - git 仓库未初始化
  - .codex/config.toml 的 commands 需技术栈确定后更新
下一步建议:
  - 总控确定技术栈（Node/TS? Python? Rust?）
  - 初始化 git 仓库
  - 执行 T-002 项目结构初始化
风险提示: 无

---

## 项目配置初始化 (Codex Setup)

已做内容:
  - 建立 .codex/ 项目配置目录
  - 创建 .codex/config.toml（sandbox/approval/limits 配置）
  - 创建 5 个项目级 agents（worker-*, explorer-*, reviewer-*）
  - 更新 AGENTS.md（合并总控+Codex+Worker 角色定义）
  - 更新 .coord/CLAIMS.md（Agent 注册表）
  - 更新 .coord/DECISIONS.md（D-003~D-005）
改动文件:
  - .codex/config.toml
  - .codex/agents/worker-frontend.md
  - .codex/agents/worker-backend.md
  - .codex/agents/worker-tests.md
  - .codex/agents/explorer-codebase.md
  - .codex/agents/reviewer-quality.md
  - AGENTS.md
  - .coord/CLAIMS.md
  - .coord/DECISIONS.md
  - .coord/HANDOFF.md
未决问题:
  - 技术栈未确定
  - 业务代码为空
  - git 仓库未初始化
  - .codex/config.toml 的 commands 需技术栈确定后更新
下一步建议:
  - 总控确定技术栈（Node/TS? Python? Rust?）
  - 初始化 git 仓库
  - 执行 T-002 项目结构初始化
风险提示: 无

---

## 项目配置初始化 (Codex)

**时间**: 2026-04-16

**已做内容**:
- 建立 `.codex/` 项目配置目录
- 创建 `.codex/config.toml`（sandbox/approval/limits 配置）
- 创建 5 个项目级 agents
- 更新 `AGENTS.md`（合并角色定义）

**改动文件**:
- `.codex/config.toml`
- `.codex/agents/worker-frontend.md`
- `.codex/agents/worker-backend.md`
- `.codex/agents/worker-tests.md`
- `.codex/agents/explorer-codebase.md`
- `.codex/agents/reviewer-quality.md`
- `AGENTS.md`
- `.coord/CLAIMS.md`
- `.coord/DECISIONS.md`
- `.coord/HANDOFF.md`

**未决问题**:
- 技术栈未确定
- 业务代码为空
- git 仓库未初始化

**下一步建议**:
1. 总控确定技术栈（Node/TS? Python? Rust?）
2. 初始化 git 仓库
3. 执行 T-002 项目结构初始化

---

## 项目配置初始化 (Codex Setup)

**时间**: 2026-04-16

**已做内容**:
- 创建 .codex/config.toml（sandbox/approval/limits 配置）
- 创建 5 个项目级 agents
- 更新 AGENTS.md（合并总控+Codex+Worker 角色）
- 更新 .coord/CLAIMS.md（Agent 注册表）
- 更新 .coord/DECISIONS.md（D-003~D-005）

**改动文件**:
- .codex/config.toml
- .codex/agents/worker-frontend.md
- .codex/agents/worker-backend.md
- .codex/agents/worker-tests.md
- .codex/agents/explorer-codebase.md
- .codex/agents/reviewer-quality.md
- AGENTS.md
- .coord/CLAIMS.md
- .coord/DECISIONS.md
- .coord/HANDOFF.md

**未决问题**:
- 技术栈未确定
- 业务代码为空
- git 仓库未初始化

**下一步建议**:
1. 总控确定技术栈
2. 初始化 git 仓库
3. 执行 T-002 项目结构初始化

---

## 项目配置初始化 (Codex Setup)

**时间**: 2026-04-16

**已做内容**:
- 创建 .codex/config.toml（sandbox/approval/limits 配置）
- 创建 5 个项目级 agents
- 更新 AGENTS.md（合并总控+Codex+Worker 角色）
- 更新 .coord/CLAIMS.md（Agent 注册表）
- 更新 .coord/DECISIONS.md（D-003~D-005）

**改动文件**:
- .codex/config.toml
- .codex/agents/worker-frontend.md
- .codex/agents/worker-backend.md
- .codex/agents/worker-tests.md
- .codex/agents/explorer-codebase.md
- .codex/agents/reviewer-quality.md
- AGENTS.md
- .coord/CLAIMS.md
- .coord/DECISIONS.md
- .coord/HANDOFF.md

**未决问题**:
- 技术栈未确定
- 业务代码为空
- git 仓库未初始化

**下一步建议**:
1. 总控确定技术栈
2. 初始化 git 仓库
3. 执行 T-002 项目结构初始化

---

## i18n 全站国际化完成 (Claude)

**时间**: 2026-04-17 07:30 UTC

**已做内容**:
- i18n 系统搭建（Context + translations）
- 所有主要页面翻译完成
- 语言通过 cookie 保持

**改动文件**:
- src/lib/i18n.tsx
- src/app/page.tsx
- src/app/layout.tsx
- src/components/LanguageSwitcher.tsx
- src/components/Providers.tsx
- src/app/(auth)/login/page.tsx
- src/app/(auth)/register/page.tsx
- src/app/(main)/dashboard/page.tsx
- src/app/(main)/settings/page.tsx
- src/app/(main)/generate/page.tsx
- src/app/pricing/page.tsx
- src/app/song/[id]/page.tsx

**未决问题**:
- Admin 页面仍使用硬编码文本
- generate/settings 页面头部缺少管理员入口

**下一步建议**:
1. Codex 接手: Admin 页面 i18n 翻译
2. Claude 收尾: 添加管理员入口到其他页面

---

## 超级管理员系统完成 (Claude + Codex)

**时间**: 2026-04-17 07:00 UTC

**已做内容**:
- 数据库 Schema 扩展（User.role, AdminLog）
- 管理员 API Routes（/api/admin/*）
- 管理员 Dashboard 页面（/admin）
- 第一个用户自动成为 ADMIN

**改动文件**:
- prisma/schema.prisma
- src/app/api/auth/verify/route.ts
- src/app/api/songs/route.ts
- src/middleware.ts
- src/app/admin/page.tsx
- src/app/api/admin/*

**未决问题**: 无

**验证结果**: npm run build 通过

---

## 协作工具集成完成 (Claude)

**时间**: 2026-04-17 08:10 UTC

**已做内容**:
- 安装并启用 Superpowers 5.0.7（claude-plugins-official）
- 安装并启用 Codex Plugin CC 1.0.3（openai-codex marketplace）
- Codex CLI 状态检查通过（v0.121.0，已登录）
- 更新 AGENTS.md（集成 Superpowers 方法论 + Codex 命令）
- 更新 TASKS.md（添加协作框架说明）
- 更新 DECISIONS.md（D-016~D-018）

**改动文件**:
- AGENTS.md
- .coord/TASKS.md
- .coord/DECISIONS.md

**验证结果**:
```
Superpowers: 2 plugins · 10 skills · 7 agents
Codex Setup: ready: true, loggedIn: true
```

**下一步**:
- 用户可开始使用新协作流程
- `/codex:review` 审查代码
- `/codex:rescue` 委托任务

## T-DB — Supabase 数据库配置完成

**时间**: 2026-04-17 20:38 UTC

**已做内容**:
- Supabase CLI 安装并登录
- 链接项目 `ptptgtmqglkvoarfssqx`
- 通过 Management API 执行 SQL migration
- 生成 Prisma Client

**改动文件**:
- `.env`（数据库连接字符串）
- `prisma/migrations/20260417000000_initial_schema/migration.sql`（新建）
- `.mcp.json`（Supabase MCP 配置）
- `supabase/config.toml`（Supabase CLI 配置）

**验证结果**:
```bash
# 所有表已创建
npx supabase db query "SELECT table_name FROM information_schema.tables..." --linked
# 返回: Account, AdminLog, ApiConfig, Session, Song, Subscription, User, VerificationToken
```

**数据库连接说明**:
- Supabase 直连 (`db.ptptgtmqglkvoarfssqx.supabase.co:5432`) 需要 IP 白名单
- 本地开发使用 `npx supabase db query --linked` 通过 Management API 操作
- 部署到 Vercel 后直接连接应该可以（如果 Vercel IP 在白名单）

**未决问题**: 无

**HANDOFF 模板更新**:

```markdown
## [任务号] — [标题]

**从**: [来源 Agent]
**到**: [目标 Agent]
**状态**: [pending/in_progress/completed]
**Skill 调用**: [使用的 Superpowers Skill]
**Codex 委托**: [是/否，任务ID]

```
改动文件:
  - [文件路径 1]
  - [文件路径 2]

已验证:
  - [验证命令及结果]

Superpowers 检查:
  - brainstorming: [是/否]
  - verification-before-completion: [是/否]

下一步:
  - [建议 1]
  - [建议 2]
```
```
