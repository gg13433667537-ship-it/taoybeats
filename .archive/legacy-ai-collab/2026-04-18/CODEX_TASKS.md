# CODEX_TASKS.md — Codex 执行任务队列

> Claude Code（总控）写入，Codex 执行并回报结果。
> 格式：任务 ID | 描述 | 验收标准 | 状态

---

## 待执行任务

### T-CODEX-001
**描述**：完善 v0.3 用户系统 — 实现游客 Session + 完整注册登录流程
**验收标准**：npm run build 通过，所有表单可提交
**涉及文件**：
- src/app/(auth)/login/page.tsx
- src/app/(auth)/register/page.tsx
- src/lib/auth.ts
- src/middleware.ts（需要创建）

**执行步骤**：
1. `cd /tmp && git clone https://github.com/gg13433667537-ship-it/taoybeats.git`（如果本地没有最新代码）
2. 或 `cd /Users/taoyang/Desktop/.../taoybeats` 如果已克隆
3. 实现游客 Session（Cookie-based anonymous session）
4. 实现完整的注册 API（邮箱 + 密码，存入 Prisma）
5. 实现完整的登录 API（验证密码，返回 JWT）
6. 创建 middleware.ts 实现路由保护（未登录重定向）
7. 更新 login/register 页面连接真实 API
8. `npm run build` 验证
9. `git add . && git commit && git push`

**优先级**：P0（阻塞后续）

---

### T-CODEX-002
**描述**：完善 v0.3 数据库 — 连接 Supabase PostgreSQL，生成真实 Prisma Client
**验收标准**：Prisma migrate 成功，数据库表创建
**涉及文件**：prisma/schema.prisma, .env.local

**执行步骤**：
1. 创建 Supabase 项目，获取 DATABASE_URL
2. 更新 prisma/schema.prisma（如需要）
3. 运行 `npx prisma migrate dev --name init`
4. 运行 `npx prisma generate`
5. 验证 build 通过

**优先级**：P0

---

### T-CODEX-003
**描述**：完善 v0.3 分享功能 — 歌曲公开页 + Fork 重新生成
**验收标准**：分享链接可访问，可基于参数重新生成
**涉及文件**：src/app/song/[id]/page.tsx, src/app/api/songs/[id]/route.ts

**优先级**：P1

---

## 已完成任务（DONE）

（Codex 执行完成后在此标注 DONE + 结果）

