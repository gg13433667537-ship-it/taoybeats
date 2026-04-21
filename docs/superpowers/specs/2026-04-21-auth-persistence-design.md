# P1 设计文档 — 用户认证与数据持久化修复

**日期**: 2026-04-21  
**范围**: 用户认证系统重构 + 数据持久化保证  
**依赖**: Prisma/PostgreSQL 连接已修复 (Sb,83033232)

---

## 1. 问题诊断

### 1.1 根因分析

| 症状 | 根因 | 位置 |
|------|------|------|
| 注册后数据丢失 | Prisma 连接失败 → 静默 fallback 到内存存储 | `register/route.ts:170-172` |
| 登录显示"邮箱未注册" | 内存重启后清空，Prisma fallback 失效 | `login/route.ts:148-159` |
| 验证码登录也丢失 | 验证码接口只写内存，不写数据库 | `verify/route.ts:109-136` |
| Session 状态错乱 | 服务端内存与客户端 cookie 不同步 | `profile/route.ts` |
| 密码正确但报错 | bcrypt 比较逻辑正确，但用户对象可能来自旧内存 | `login/route.ts:176` |

### 1.2 核心问题

**双存储系统混乱**：代码同时维护 `global.users` (内存 Map) 和 `prisma.user` (数据库)，且 Prisma 失败时静默 fallback 到内存。这导致：
- 写操作可能只写入内存
- 读操作优先查内存（可能查到旧数据或 null）
- 重启后内存清空，数据库可能有/无数据
- 用户 ID 在内存和数据库中可能不一致（内存用 `crypto.randomUUID()`，数据库也是，但重新创建时不同）

---

## 2. 设计目标

1. **单一数据源**: Prisma/PostgreSQL 是唯一数据源，彻底移除内存 fallback
2. **注册流程**: 必须邮箱验证码，防止垃圾注册
3. **登录双通道**: 支持密码登录 + 验证码快捷登录
4. **密码重置**: 忘记密码可通过验证码重置
5. **Session 稳定**: 7天有效期，跨页面保持一致
6. **错误明确**: 任何数据库失败都明确报错，不静默吞错

---

## 3. 架构设计

### 3.1 数据流图

```
用户操作 → API Route → Prisma Client → PostgreSQL
                ↓
         错误时返回明确错误信息
         绝不 fallback 到内存
```

### 3.2 认证流程

#### 注册流程 (Register)
```
1. 用户输入邮箱 → 点击"获取验证码"
   → POST /api/auth/send-code
   → 生成6位数字验证码
   → 存储到 VerificationToken 表（10分钟过期）
   → SMTP 发送邮件（开发模式输出到控制台）

2. 用户输入验证码 + 设置密码 → 点击"注册"
   → POST /api/auth/register
   → 验证验证码（查 VerificationToken 表）
   → 验证通过后删除验证码记录
   → bcrypt 加密密码
   → Prisma 创建 User 记录
   → 生成 session-token cookie
   → 返回用户信息
```

#### 密码登录 (Login with Password)
```
1. 用户输入邮箱 + 密码
   → POST /api/auth/login
   → Prisma 查询用户（email 小写匹配）
   → bcrypt 比较密码
   → 生成 session-token cookie
   → 返回用户信息
```

#### 验证码登录 (Login with Code)
```
1. 用户输入邮箱 → 点击"获取验证码"
   → 同注册流程发送验证码

2. 用户输入验证码 → 点击"登录"
   → POST /api/auth/verify（改进版）
   → 验证验证码
   → 如果用户不存在则自动创建（无密码用户）
   → 生成 session-token cookie
   → 返回用户信息
```

#### 忘记密码 (Reset Password)
```
1. 用户输入邮箱 → 点击"忘记密码"
   → POST /api/auth/send-code（标记为重置用途）
   → 发送验证码

2. 用户输入验证码 + 新密码
   → POST /api/auth/reset-password（新接口）
   → 验证验证码
   → bcrypt 加密新密码
   → Prisma 更新用户密码
   → 使所有现有 session 失效（sessionsRevokedAt）
   → 返回成功
```

### 3.3 Session 管理

**Token 格式**: `base64(payload).signature`
- payload: `{ id, email, role, iat, exp }`
- 签名: HMAC-SHA256

**验证流程**:
1. 从 cookie 读取 `session-token`
2. 验证签名
3. 检查是否过期
4. 检查 `sessionsRevokedAt`（用户修改密码后使所有 session 失效）
5. 查数据库确认用户仍然存在且 active

**Cookie 设置**:
- httpOnly: true
- secure: production
- sameSite: lax
- maxAge: 7天
- path: /

---

## 4. 数据库 Schema 变更

当前 Schema 已支持所需字段，无需变更：
- `User.password` — 已存在
- `User.sessionsRevokedAt` — 已存在
- `VerificationToken` — 已存在

---

## 5. API 接口变更

### 5.1 修改接口

| 接口 | 变更 |
|------|------|
| `POST /api/auth/register` | 增加验证码验证步骤；移除内存 fallback |
| `POST /api/auth/login` | 移除内存查询逻辑；直接查 Prisma |
| `POST /api/auth/verify` | 增加 Prisma 持久化；自动创建不存在用户 |
| `GET /api/auth/profile` | 移除内存 fallback；直接查 Prisma |
| `PUT /api/auth/profile` | 更新 Prisma 而非内存 |

### 5.2 新增接口

| 接口 | 功能 |
|------|------|
| `POST /api/auth/reset-password` | 验证码验证 + 密码重置 |

---

## 6. 错误处理策略

**数据库连接失败**: 返回 `503 Service Unavailable`，提示"服务器繁忙，请稍后重试"
**用户不存在**: 返回 `401`，明确提示"该邮箱尚未注册"
**密码错误**: 返回 `401`，明确提示"密码错误"
**验证码错误**: 返回 `400`，提示"验证码错误或已过期"
**账号禁用**: 返回 `403`，提示"账号已被禁用"

---

## 7. 安全考虑

1. **密码加密**: bcrypt with salt rounds 10
2. **验证码**: 6位数字，10分钟过期，单次使用
3. **Rate Limiting**: 每个 IP 每分钟最多5次认证请求
4. **CSRF 保护**: Double Submit Cookie 模式
5. **密码重置后**: 更新 `sessionsRevokedAt` 使所有现有 session 失效
6. **邮箱大小写**: 统一存储小写，查询时转小写

---

## 8. 测试策略

1. **单元测试**: bcrypt 比较、token 生成/验证、验证码生成
2. **集成测试**: 注册 → 登录 → 获取 Profile 完整流程
3. **E2E 测试**: Playwright 测试注册/登录/忘记密码 UI 流程

---

## 9. 回滚计划

如需回滚：
1. 恢复代码中的内存 fallback（不推荐）
2. 或：修复数据库连接后重新部署

当前数据库连接已验证可用，风险低。
