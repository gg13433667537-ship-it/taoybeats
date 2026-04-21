# P1: 用户认证与数据持久化修复 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 彻底移除内存存储 fallback，强制所有认证操作走 Prisma/PostgreSQL；注册必须验证码；登录支持密码和验证码双通道；添加忘记密码功能。

**Architecture:** 以 Prisma Client 为唯一数据源，API Routes 直接读写数据库，错误时明确返回而非静默 fallback。Session 使用 HMAC-SHA256 签名的 JWT-like token，7 天有效期。

**Tech Stack:** Next.js 16 App Router, Prisma 5, PostgreSQL (Supabase), bcryptjs, crypto

---

## 文件结构

| 文件 | 职责 | 操作 |
|------|------|------|
| `src/app/api/auth/send-code/route.ts` | 发送验证码，存储到 VerificationToken 表 | 修改 |
| `src/app/api/auth/register/route.ts` | 注册：验证码校验 + Prisma 创建用户 | 修改 |
| `src/app/api/auth/login/route.ts` | 密码登录：Prisma 查用户 + bcrypt 比较 | 修改 |
| `src/app/api/auth/verify/route.ts` | 验证码登录：Prisma 查/创用户 | 修改 |
| `src/app/api/auth/reset-password/route.ts` | 忘记密码：验证码 + 更新密码 | 新增 |
| `src/app/api/auth/profile/route.ts` | 获取/更新用户资料 | 修改 |
| `src/lib/auth-utils.ts` | Session token 生成/验证工具 | 修改（加 sessionsRevokedAt 检查） |
| `src/lib/db.ts` | Prisma Client 单例 | 不变 |
| `tests/api/auth.test.ts` | 认证 API 集成测试 | 新增 |

---

## Task 1: 修改 `send-code` — 验证码存储到数据库

**Files:**
- Modify: `src/app/api/auth/send-code/route.ts`

**目标:** 将生成的验证码存储到 `VerificationToken` 表，而非仅放在 cookie 中。

- [ ] **Step 1: 修改 `send-code` 在生成 token 后同时写入 Prisma**

在 `src/app/api/auth/send-code/route.ts` 的 `POST` 函数中，生成 `token` 后、返回响应前，插入以下代码：

```typescript
    // Store verification code in database
    try {
      await prisma.verificationToken.create({
        data: {
          identifier: sanitizedEmail,
          token: code, // Store the raw code for easy lookup
          expires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        },
      })
      logger.debug(`Verification code stored in DB for ${sanitizedEmail}`, { requestId })
    } catch (dbError) {
      logger.error(`Failed to store verification code in DB: ${dbError}`, { requestId })
      return applySecurityHeaders(
        NextResponse.json(
          { error: "服务器繁忙，请稍后重试" },
          { status: 503 }
        )
      )
    }
```

导入 `prisma`：确认文件顶部已有 `import { prisma } from "@/lib/db"`，如果没有则添加。

- [ ] **Step 2: 验证修改**

运行开发服务器测试：
```bash
npm run dev &
curl -X POST http://localhost:3000/api/auth/send-code \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

预期：返回 `{"success":true,"message":"验证码已生成（开发模式）"}`

检查数据库是否有记录：
```bash
npx prisma studio
# 或查询
DATABASE_URL="postgresql://postgres.ptptgtmqglkvoarfssqx:Sb,83033232@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres" npx tsx -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.verificationToken.findFirst({ where: { identifier: 'test@example.com' } }).then(r => console.log(r)).finally(() => prisma.\$disconnect());
"
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/send-code/route.ts
git commit -m "fix: store verification codes in PostgreSQL instead of cookie only"
```

---

## Task 2: 修改 `register` — 强制验证码 + 移除内存 fallback

**Files:**
- Modify: `src/app/api/auth/register/route.ts`

**目标:** 注册时必须提供验证码并验证；Prisma 失败时返回错误而非 fallback 到内存。

- [ ] **Step 1: 修改接口接收验证码参数**

将接口签名从接收 `{ email, password, name }` 改为接收 `{ email, password, name, code }`。

在输入验证部分（`const { email, password, name } = body`）后添加：

```typescript
    const { code } = body
    if (!code) {
      const duration = Date.now() - startTime
      logger.api.response("POST", endpoint, 400, duration, { requestId })
      return applySecurityHeaders(
        NextResponse.json(
          { error: "请提供验证码" },
          { status: 400 }
        )
      )
    }
```

- [ ] **Step 2: 验证验证码（查数据库）**

在检查邮箱是否已注册之前，插入验证码验证逻辑：

```typescript
    // Verify the code from database
    let codeValid = false
    try {
      const tokenRecord = await prisma.verificationToken.findFirst({
        where: {
          identifier: sanitizedEmail,
          token: String(code),
          expires: { gt: new Date() },
        },
      })
      if (tokenRecord) {
        codeValid = true
        // Delete used token
        await prisma.verificationToken.delete({
          where: { identifier_token: { identifier: sanitizedEmail, token: String(code) } },
        })
        logger.debug(`Verification code validated and deleted for ${sanitizedEmail}`, { requestId })
      }
    } catch (dbError) {
      logger.error(`Failed to verify code from DB: ${dbError}`, { requestId })
    }

    if (!codeValid) {
      const duration = Date.now() - startTime
      logger.api.response("POST", endpoint, 400, duration, { requestId })
      return applySecurityHeaders(
        NextResponse.json(
          { error: "验证码错误或已过期" },
          { status: 400 }
        )
      )
    }
```

- [ ] **Step 3: 移除内存 fallback，Prisma 失败返回错误**

找到以下代码块：
```typescript
    try {
      logger.debug(`Creating user in Prisma: ...`)
      const createdUser = await prisma.user.create({ ... })
      logger.info(`User created in Prisma successfully: ${createdUser.id}`, { requestId })
    } catch (prismaError) {
      logger.warn(`Prisma user.create failed, continuing with memory fallback: ${prismaError}`, { requestId })
    }
```

替换为：
```typescript
    try {
      logger.debug(`Creating user in Prisma: ${JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        tier: user.tier,
      })}`, { requestId })

      const createdUser = await prisma.user.create({
        data: {
          id: user.id,
          email: user.email,
          name: user.name || null,
          password: user.password,
          role: user.role as "USER" | "PRO" | "ADMIN",
          isActive: user.isActive,
          tier: user.tier,
          dailyUsage: user.dailyUsage,
          monthlyUsage: user.monthlyUsage,
          dailyResetAt: user.dailyResetAt,
          monthlyResetAt: user.monthlyResetAt,
        },
      })

      logger.info(`User created in Prisma successfully: ${createdUser.id}`, { requestId })
    } catch (prismaError) {
      logger.error(`Prisma user.create failed: ${prismaError}`, { requestId })
      const duration = Date.now() - startTime
      logger.api.response("POST", endpoint, 500, duration, { requestId })
      return applySecurityHeaders(
        NextResponse.json(
          { error: "注册失败，请稍后重试" },
          { status: 500 }
        )
      )
    }
```

- [ ] **Step 4: 移除内存用户存储**

删除以下代码：
```typescript
    users.set(sanitizedEmail, user)
    users.set(user.id, user)
```

- [ ] **Step 5: 修改已存在用户检查逻辑**

将现有的检查逻辑改为直接查 Prisma，失败时返回错误：

```typescript
    // Check if user already exists
    let existingUser = null
    try {
      existingUser = await prisma.user.findUnique({
        where: { email: sanitizedEmail },
      })
    } catch (prismaError) {
      logger.error(`Prisma user lookup failed during registration: ${prismaError}`, { requestId })
      const duration = Date.now() - startTime
      logger.api.response("POST", endpoint, 503, duration, { requestId })
      return applySecurityHeaders(
        NextResponse.json(
          { error: "服务器繁忙，请稍后重试" },
          { status: 503 }
        )
      )
    }

    if (existingUser) {
      const duration = Date.now() - startTime
      logger.api.response("POST", endpoint, 409, duration, { requestId, userId: existingUser.id })
      return applySecurityHeaders(
        NextResponse.json(
          { error: "该邮箱已被注册" },
          { status: 409 }
        )
      )
    }
```

同样修改 `isFirstUser` 检查：

```typescript
    let isFirstUser = false
    try {
      const userCount = await prisma.user.count()
      isFirstUser = userCount === 0
    } catch (prismaError) {
      logger.error(`Prisma user count failed during registration: ${prismaError}`, { requestId })
      const duration = Date.now() - startTime
      logger.api.response("POST", endpoint, 503, duration, { requestId })
      return applySecurityHeaders(
        NextResponse.json(
          { error: "服务器繁忙，请稍后重试" },
          { status: 503 }
        )
      )
    }
```

- [ ] **Step 6: 清理全局变量引用**

删除文件顶部的：
```typescript
if (!global.users) global.users = new Map()
if (!global.songs) global.songs = new Map()
if (!global.adminLogs) global.adminLogs = new Map()
const users = global.users!
```

- [ ] **Step 7: 运行 lint 和 type-check**

```bash
npm run lint -- src/app/api/auth/register/route.ts
npm run type-check
```

- [ ] **Step 8: Commit**

```bash
git add src/app/api/auth/register/route.ts
git commit -m "fix: register requires verification code, remove memory fallback

- Register now validates verification code from DB
- Prisma failures return 500/503 instead of memory fallback
- Remove all global.users references"
```

---

## Task 3: 修改 `login` — 移除内存 fallback

**Files:**
- Modify: `src/app/api/auth/login/route.ts`

**目标:** 登录只查 Prisma，移除内存查询逻辑。

- [ ] **Step 1: 移除全局变量和内存查询**

删除文件顶部的：
```typescript
if (!global.users) global.users = new Map()
if (!global.songs) global.songs = new Map()
if (!global.adminLogs) global.adminLogs = new Map()
const users = global.users!
```

- [ ] **Step 2: 将登录查询改为纯 Prisma**

替换用户查找逻辑。删除从 `users.get(sanitizedEmail)` 开始的内存查询块，替换为：

```typescript
    // Find user by email using Prisma only
    logger.debug(`Login attempt for email: ${sanitizedEmail}`, { requestId })

    let dbUser = null
    try {
      dbUser = await prisma.user.findFirst({
        where: {
          email: sanitizedEmail.toLowerCase(),
        },
      })

      // If not found, try case-insensitive match as fallback
      if (!dbUser) {
        dbUser = await prisma.user.findFirst({
          where: {
            email: {
              equals: sanitizedEmail,
              mode: 'insensitive',
            },
          },
        })
      }
    } catch (prismaError) {
      logger.error(`Prisma login lookup failed: ${prismaError}`, { requestId })
      const duration = Date.now() - startTime
      logger.api.response("POST", endpoint, 503, duration, { requestId })
      return applySecurityHeaders(
        NextResponse.json(
          { error: "服务器繁忙，请稍后重试" },
          { status: 503 }
        )
      )
    }

    logger.debug(`Prisma result: ${dbUser ? `found user ${dbUser.id}` : 'not found'}`, { requestId })

    if (!dbUser) {
      const duration = Date.now() - startTime
      logger.warn(`User not found for email: ${sanitizedEmail}`, { requestId })
      logger.api.response("POST", endpoint, 401, duration, { requestId })
      logger.auth.login(sanitizedEmail, false, { requestId })
      return applySecurityHeaders(
        NextResponse.json(
          { error: "该邮箱尚未注册，请先注册" },
          { status: 401 }
        )
      )
    }
```

- [ ] **Step 3: 将后续逻辑改为直接使用 dbUser**

将后续所有 `user.` 引用改为 `dbUser.`，例如：
- `user.password` → `dbUser.password`
- `user.id` → `dbUser.id`
- `user.email` → `dbUser.email`
- `user.role` → `dbUser.role`
- `user.isActive` → `dbUser.isActive`

注意：bcrypt 比较和 session 创建需要使用正确的类型。`dbUser` 是 Prisma 返回的类型，字段名相同。

- [ ] **Step 4: 清理辅助函数**

如果文件末尾的 `getDateKey()` 和 `getMonthKey()` 不再使用，删除它们。

- [ ] **Step 5: 运行 lint 和 type-check**

```bash
npm run lint -- src/app/api/auth/login/route.ts
npm run type-check
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/auth/login/route.ts
git commit -m "fix: login queries Prisma only, remove memory fallback

- Remove global.users memory map usage
- Direct Prisma query with explicit error handling
- Return 503 on database failure"
```

---

## Task 4: 修改 `verify` — 验证码登录持久化

**Files:**
- Modify: `src/app/api/auth/verify/route.ts`

**目标:** 验证码登录时，如果用户不存在则 Prisma 创建；如果存在则直接登录。

- [ ] **Step 1: 移除全局变量和内存逻辑**

删除文件顶部的：
```typescript
if (!global.users) global.users = new Map()
if (!global.songs) global.songs = new Map()
if (!global.adminLogs) global.adminLogs = new Map()
const users = global.users!
```

- [ ] **Step 2: 导入 Prisma**

在文件顶部添加：
```typescript
import { prisma } from "@/lib/db"
import { logger } from "@/lib/logger"
```

- [ ] **Step 3: 修改验证码验证逻辑，从数据库查询**

替换现有的 `verifyTokenSignature` 验证（基于 cookie token），改为从数据库查询验证码：

```typescript
    // Verify code from database
    let codeValid = false
    try {
      const tokenRecord = await prisma.verificationToken.findFirst({
        where: {
          identifier: email,
          token: String(code),
          expires: { gt: new Date() },
        },
      })
      if (tokenRecord) {
        codeValid = true
        // Delete used token
        await prisma.verificationToken.delete({
          where: { identifier_token: { identifier: email, token: String(code) } },
        })
      }
    } catch (dbError) {
      logger.error(`Failed to verify code from DB: ${dbError}`)
      return applySecurityHeaders(
        NextResponse.json(
          { error: "服务器繁忙，请稍后重试" },
          { status: 503 }
        )
      )
    }

    if (!codeValid) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "验证码错误或已过期" },
          { status: 400 }
        )
      )
    }
```

删除原有的 `token`、`devCode` cookie 读取和 `verifyTokenSignature` 验证逻辑。

- [ ] **Step 4: 修改用户获取/创建逻辑**

替换内存用户查找为 Prisma：

```typescript
    // Find or create user in database
    let user = null
    try {
      user = await prisma.user.findUnique({
        where: { email },
      })
    } catch (dbError) {
      logger.error(`Failed to find user: ${dbError}`)
      return applySecurityHeaders(
        NextResponse.json(
          { error: "服务器繁忙，请稍后重试" },
          { status: 503 }
        )
      )
    }

    if (!user) {
      // Auto-create user for code login
      try {
        const userCount = await prisma.user.count()
        const isFirstUser = userCount === 0

        user = await prisma.user.create({
          data: {
            id: crypto.randomUUID(),
            email,
            name: email.split('@')[0],
            role: isFirstUser ? 'ADMIN' : 'USER',
            isActive: true,
            tier: 'FREE',
            dailyUsage: 0,
            monthlyUsage: 0,
            dailyResetAt: getDateKey(),
            monthlyResetAt: getMonthKey(),
          },
        })
        logger.info(`Auto-created user via code login: ${user.id}`)
      } catch (createError) {
        logger.error(`Failed to create user: ${createError}`)
        return applySecurityHeaders(
          NextResponse.json(
            { error: "登录失败，请稍后重试" },
            { status: 500 }
          )
        )
      }
    }
```

- [ ] **Step 5: 构建 session token 并返回**

使用 `user`（Prisma 返回的对象）创建 session：

```typescript
    // Build user object for session token
    const sessionUser = {
      id: user.id,
      email: user.email || email,
      name: user.name || undefined,
      role: user.role as "USER" | "PRO" | "ADMIN",
      isActive: user.isActive,
      tier: user.tier as "FREE" | "PRO",
      dailyUsage: user.dailyUsage,
      monthlyUsage: user.monthlyUsage,
      dailyResetAt: user.dailyResetAt || getDateKey(),
      monthlyResetAt: user.monthlyResetAt || getMonthKey(),
      createdAt: user.createdAt.toISOString(),
    }

    const sessionToken = createSessionToken(sessionUser)

    console.log(`[Verify] User ${email} login - role: ${sessionUser.role}, userId: ${sessionUser.id}`)

    const response = NextResponse.json({
      success: true,
      message: "验证成功",
      user: {
        id: sessionUser.id,
        email: sessionUser.email,
        name: sessionUser.name,
        role: sessionUser.role,
      },
    })
```

- [ ] **Step 6: 清理旧的 cookie 清除代码**

删除清除 `verify-token` 和 `dev-code` cookie 的代码（因为我们不再依赖它们）。保留 `session-token` 的设置。

- [ ] **Step 7: 运行 lint 和 type-check**

```bash
npm run lint -- src/app/api/auth/verify/route.ts
npm run type-check
```

- [ ] **Step 8: Commit**

```bash
git add src/app/api/auth/verify/route.ts
git commit -m "fix: code login uses Prisma persistence, auto-creates users

- Verify codes from VerificationToken table
- Auto-create user if not exists during code login
- Remove memory-based user storage"
```

---

## Task 5: 新增 `reset-password` — 忘记密码

**Files:**
- Create: `src/app/api/auth/reset-password/route.ts`

**目标:** 通过验证码验证后重置密码，并使所有现有 session 失效。

- [ ] **Step 1: 创建新文件**

```typescript
/**
 * POST /api/auth/reset-password
 * @description 忘记密码：验证码验证 + 密码重置
 * @param {string} email - 用户邮箱
 * @param {string} code - 验证码
 * @param {string} newPassword - 新密码（最少6字符）
 * @returns {object} { success: true }
 * @errors 400 - 参数缺失/验证码错误 | 404 - 用户不存在 | 500 - 服务器错误
 */
import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { logger } from "@/lib/logger"
import {
  rateLimitMiddleware,
  sanitizeEmail,
  sanitizeString,
  applySecurityHeaders,
  AUTH_RATE_LIMIT,
} from "@/lib/security"

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  const endpoint = "/api/auth/reset-password"

  logger.api.request("POST", endpoint, { requestId })

  // Rate limiting
  const rateLimitResponse = rateLimitMiddleware(request, AUTH_RATE_LIMIT, "reset-password")
  if (rateLimitResponse) {
    const duration = Date.now() - startTime
    logger.api.response("POST", endpoint, 429, duration, { requestId })
    return applySecurityHeaders(rateLimitResponse)
  }

  try {
    const body = await request.json()
    const { email, code, newPassword } = body

    const sanitizedEmail = sanitizeEmail(email)
    const sanitizedPassword = sanitizeString(newPassword)

    if (!sanitizedEmail || !code || !sanitizedPassword) {
      const duration = Date.now() - startTime
      logger.api.response("POST", endpoint, 400, duration, { requestId })
      return applySecurityHeaders(
        NextResponse.json(
          { error: "请提供邮箱、验证码和新密码" },
          { status: 400 }
        )
      )
    }

    if (sanitizedPassword.length < 6) {
      const duration = Date.now() - startTime
      logger.api.response("POST", endpoint, 400, duration, { requestId })
      return applySecurityHeaders(
        NextResponse.json(
          { error: "密码长度至少为6个字符" },
          { status: 400 }
        )
      )
    }

    // Verify code from database
    let codeValid = false
    try {
      const tokenRecord = await prisma.verificationToken.findFirst({
        where: {
          identifier: sanitizedEmail,
          token: String(code),
          expires: { gt: new Date() },
        },
      })
      if (tokenRecord) {
        codeValid = true
        await prisma.verificationToken.delete({
          where: { identifier_token: { identifier: sanitizedEmail, token: String(code) } },
        })
      }
    } catch (dbError) {
      logger.error(`Failed to verify code: ${dbError}`, { requestId })
      const duration = Date.now() - startTime
      logger.api.response("POST", endpoint, 503, duration, { requestId })
      return applySecurityHeaders(
        NextResponse.json(
          { error: "服务器繁忙，请稍后重试" },
          { status: 503 }
        )
      )
    }

    if (!codeValid) {
      const duration = Date.now() - startTime
      logger.api.response("POST", endpoint, 400, duration, { requestId })
      return applySecurityHeaders(
        NextResponse.json(
          { error: "验证码错误或已过期" },
          { status: 400 }
        )
      )
    }

    // Find user
    let user = null
    try {
      user = await prisma.user.findUnique({
        where: { email: sanitizedEmail },
      })
    } catch (dbError) {
      logger.error(`Failed to find user: ${dbError}`, { requestId })
      const duration = Date.now() - startTime
      logger.api.response("POST", endpoint, 503, duration, { requestId })
      return applySecurityHeaders(
        NextResponse.json(
          { error: "服务器繁忙，请稍后重试" },
          { status: 503 }
        )
      )
    }

    if (!user) {
      const duration = Date.now() - startTime
      logger.api.response("POST", endpoint, 404, duration, { requestId })
      return applySecurityHeaders(
        NextResponse.json(
          { error: "该邮箱尚未注册" },
          { status: 404 }
        )
      )
    }

    // Hash new password and update user
    const hashedPassword = await bcrypt.hash(sanitizedPassword, 10)

    try {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          sessionsRevokedAt: new Date(), // Invalidate all existing sessions
        },
      })
      logger.info(`Password reset successful for user: ${user.id}`, { requestId })
    } catch (dbError) {
      logger.error(`Failed to update password: ${dbError}`, { requestId })
      const duration = Date.now() - startTime
      logger.api.response("POST", endpoint, 500, duration, { requestId })
      return applySecurityHeaders(
        NextResponse.json(
          { error: "密码重置失败，请稍后重试" },
          { status: 500 }
        )
      )
    }

    const duration = Date.now() - startTime
    logger.api.response("POST", endpoint, 200, duration, { requestId, userId: user.id })

    return applySecurityHeaders(
      NextResponse.json({
        success: true,
        message: "密码重置成功，请使用新密码登录",
      })
    )
  } catch (error) {
    logger.api.error("POST", endpoint, error, { requestId })
    return applySecurityHeaders(
      NextResponse.json(
        { error: "密码重置失败，请稍后重试" },
        { status: 500 }
      )
    )
  }
}
```

注意：需要在文件顶部添加 `import crypto from "crypto"`。

- [ ] **Step 2: 运行 lint 和 type-check**

```bash
npm run lint -- src/app/api/auth/reset-password/route.ts
npm run type-check
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/reset-password/route.ts
git commit -m "feat: add reset-password API endpoint

- Verify code from database
- Update password with bcrypt hash
- Invalidate all existing sessions via sessionsRevokedAt"
```

---

## Task 6: 修改 `profile` — 移除内存 fallback

**Files:**
- Modify: `src/app/api/auth/profile/route.ts`

**目标:** 获取/更新用户资料只走 Prisma。

- [ ] **Step 1: 移除全局变量引用**

删除：
```typescript
if (!global.users) global.users = new Map()
```

- [ ] **Step 2: 修改 GET 逻辑**

现有的 GET 逻辑已经尝试 Prisma 然后 fallback 到内存。改为纯 Prisma：

```typescript
    let existingUser = null
    try {
      existingUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, email: true, name: true, role: true, tier: true, dailyUsage: true, monthlyUsage: true, dailyResetAt: true, monthlyResetAt: true, createdAt: true }
      })
    } catch (dbError) {
      logger.error(`[Profile API] Prisma lookup failed: ${dbError}`)
      const duration = Date.now() - startTime
      logger.api.response("GET", endpoint, 503, duration, { requestId })
      return applySecurityHeaders(NextResponse.json({ error: "服务器繁忙，请稍后重试" }, { status: 503 }))
    }

    if (!existingUser) {
      const duration = Date.now() - startTime
      logger.api.response("GET", endpoint, 404, duration, { requestId })
      return applySecurityHeaders(NextResponse.json({ error: "用户不存在" }, { status: 404 }))
    }
```

- [ ] **Step 3: 修改 PUT 逻辑**

替换内存更新为 Prisma 更新：

```typescript
    try {
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { name: sanitizedName },
        select: { id: true, email: true, name: true, role: true, tier: true }
      })

      const duration = Date.now() - startTime
      logger.api.response("PUT", endpoint, 200, duration, { requestId, userId: user.id })

      return applySecurityHeaders(NextResponse.json({
        success: true,
        user: updatedUser,
      }))
    } catch (dbError) {
      logger.error(`[Profile API] Prisma update failed: ${dbError}`)
      const duration = Date.now() - startTime
      logger.api.response("PUT", endpoint, 500, duration, { requestId })
      return applySecurityHeaders(NextResponse.json({ error: "更新失败，请稍后重试" }, { status: 500 }))
    }
```

删除原有的内存 `usersMap` 更新逻辑。

- [ ] **Step 4: 运行 lint 和 type-check**

```bash
npm run lint -- src/app/api/auth/profile/route.ts
npm run type-check
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/profile/route.ts
git commit -m "fix: profile API uses Prisma only, remove memory fallback

- GET/PUT user profile directly from database
- Remove global.users references"
```

---

## Task 7: 修改 `auth-utils.ts` — 加 sessionsRevokedAt 检查

**Files:**
- Modify: `src/lib/auth-utils.ts`

**目标:** Session 验证时检查 `sessionsRevokedAt`，支持密码重置后使所有 session 失效。

- [ ] **Step 1: 修改 `verifySessionToken` 支持数据库查询**

当前 `verifySessionToken` 只检查 token 签名和过期时间。需要增加检查用户是否仍然存在于数据库且 active，以及 `sessionsRevokedAt`。

但由于 `verifySessionToken` 是纯函数（不依赖数据库），我们在 API routes 中调用它之后再查数据库。所以这里只需要确保 options.sessionsRevokedAt 的检查是正确的。

当前代码已有：
```typescript
    if (options?.sessionsRevokedAt && payload.iat * 1000 < options.sessionsRevokedAt) {
      console.error("Session token revoked by logout-all")
      return null
    }
```

这已经正确。无需修改。在 API routes 中需要查询数据库获取 `sessionsRevokedAt` 传入即可。

- [ ] **Step 2: 在 `profile/route.ts` 的 `getCurrentUser` 中添加 sessionsRevokedAt 检查**

修改 `getCurrentUser` 函数：

```typescript
async function getCurrentUser(request: NextRequest) {
  const sessionToken = request.cookies.get("session-token")?.value
  if (!sessionToken) return null

  try {
    const payload = verifySessionToken(sessionToken)
    if (!payload) return null

    // Check if user still exists and session not revoked
    const dbUser = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, role: true, isActive: true, sessionsRevokedAt: true }
    })

    if (!dbUser || !dbUser.isActive) return null

    if (dbUser.sessionsRevokedAt) {
      const payload = verifySessionToken(sessionToken, {
        sessionsRevokedAt: dbUser.sessionsRevokedAt.getTime()
      })
      if (!payload) return null
    }

    return payload
  } catch {
    return null
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth-utils.ts src/app/api/auth/profile/route.ts
git commit -m "feat: session validation checks sessionsRevokedAt from DB

- Verify user exists and is active on every profile request
- Check sessionsRevokedAt to invalidate sessions after password reset"
```

---

## Task 8: 前端注册页修改 — 增加验证码输入

**Files:**
- Modify: `src/app/(auth)/register/page.tsx`

**目标:** 注册表单增加验证码输入框和"获取验证码"按钮。

- [ ] **Step 1: 读取当前注册页代码**

```bash
cat src/app/(auth)/register/page.tsx
```

- [ ] **Step 2: 添加验证码相关 state 和 UI**

添加：
- `code` state
- `isSendingCode` state  
- `countdown` state（倒计时）
- 验证码输入框
- "获取验证码"按钮

- [ ] **Step 3: 添加发送验证码函数**

```typescript
  const sendCode = async () => {
    if (!email) {
      setError("请先输入邮箱")
      return
    }
    setIsSendingCode(true)
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (data.success) {
        setCountdown(60)
        const timer = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(timer)
              setIsSendingCode(false)
              return 0
            }
            return prev - 1
          })
        }, 1000)
      } else {
        setError(data.error || "发送验证码失败")
        setIsSendingCode(false)
      }
    } catch {
      setError("发送验证码失败")
      setIsSendingCode(false)
    }
  }
```

- [ ] **Step 4: 修改注册提交，增加 code 参数**

```typescript
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, code }),
      })
```

- [ ] **Step 5: 运行 lint 和 type-check**

```bash
npm run lint -- src/app/(auth)/register/page.tsx
npm run type-check
```

- [ ] **Step 6: Commit**

```bash
git add src/app/(auth)/register/page.tsx
git commit -m "feat: register page adds verification code input"
```

---

## Task 9: 前端登录页修改 — 支持密码/验证码双通道

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`

**目标:** 登录页支持密码登录和验证码登录两种方式切换。

- [ ] **Step 1: 读取当前登录页代码**

- [ ] **Step 2: 添加登录方式切换**

添加 `loginMethod` state（`'password' | 'code'`），UI 上显示切换按钮。

- [ ] **Step 3: 密码登录逻辑**

现有逻辑基本不变，调用 `/api/auth/login`。

- [ ] **Step 4: 验证码登录逻辑**

添加验证码登录路径：
- 发送验证码（同注册页）
- 提交时调用 `/api/auth/verify`

- [ ] **Step 5: 添加"忘记密码"链接**

添加跳转到忘记密码页面的链接。

- [ ] **Step 6: Commit**

```bash
git add src/app/(auth)/login/page.tsx
git commit -m "feat: login page supports password and code login modes"
```

---

## Task 10: 新增忘记密码页

**Files:**
- Create: `src/app/(auth)/reset-password/page.tsx`

**目标:** 忘记密码页面，三步流程：输入邮箱 → 输入验证码+新密码 → 成功提示。

- [ ] **Step 1: 创建页面文件**

参考 login/register 页面的样式和结构，创建忘记密码页面。

- [ ] **Step 2: 实现三步流程**

```typescript
// Step 1: Input email, send code
// Step 2: Input code + new password, submit
// Step 3: Success, redirect to login
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(auth)/reset-password/page.tsx
git commit -m "feat: add reset-password page"
```

---

## Task 11: 运行全量验证

**Files:**
- 全部修改的文件

- [ ] **Step 1: TypeScript 类型检查**

```bash
npm run type-check
```

- [ ] **Step 2: Lint**

```bash
npm run lint
```

- [ ] **Step 3: 构建**

```bash
npm run build
```

- [ ] **Step 4: Commit 如果 lint/build 通过**

```bash
git add -A
git commit -m "chore: auth system fully migrated to Prisma persistence

- All auth APIs use Prisma/PostgreSQL as single source of truth
- Register requires email verification code
- Login supports password and code modes
- Password reset with session invalidation
- Remove all memory storage fallbacks"
```

---

## 验证清单

| 验证项 | 命令 | 预期结果 |
|--------|------|----------|
| 类型检查 | `npm run type-check` | 0 errors |
| Lint | `npm run lint` | 0 errors (当前仓库有历史问题，只看修改的文件) |
| 构建 | `npm run build` | 成功 |
| 发送验证码 | `curl /api/auth/send-code` | 验证码存入 DB |
| 注册 | `curl /api/auth/register` 带 code | Prisma 创建用户 |
| 密码登录 | `curl /api/auth/login` | 返回 session |
| 验证码登录 | `curl /api/auth/verify` | 返回 session |
| 密码重置 | `curl /api/auth/reset-password` | 更新密码，旧 session 失效 |
| Profile | `curl /api/auth/profile` | 返回用户数据 |

---

## Spec Coverage 检查

| Spec 需求 | 对应 Task |
|-----------|-----------|
| 单一数据源（Prisma 唯一） | Task 2, 3, 4, 6 |
| 注册必须验证码 | Task 1, 2, 8 |
| 登录支持密码+验证码 | Task 3, 4, 9 |
| 忘记密码 | Task 5, 10 |
| Session 稳定 | Task 7 |
| 错误明确 | All tasks |
| 密码加密 | Task 2, 5 |
| Rate Limiting | 已有，不变 |
| CSRF 保护 | 已有，不变 |
| 密码重置使 session 失效 | Task 5, 7 |

无遗漏。
