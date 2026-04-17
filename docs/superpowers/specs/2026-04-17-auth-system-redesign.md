# 认证系统重构设计

**日期**: 2026-04-17
**状态**: 已批准
**版本**: 1.0

---

## 1. 概述

重构登录/注册系统，解决以下问题：
- 用户数据存储在内存，页面刷新/重启后丢失
- 只有验证码登录，缺少密码登录选项
- 登录后无退出入口

### 目标

- 用户数据持久化到 Supabase PostgreSQL
- 支持验证码登录和密码登录（用户可选）
- 实现完整的退出登录功能
- UI/UX 对标 GitHub 等成熟项目

---

## 2. 技术决策

| 项目 | 选择 | 理由 |
|------|------|------|
| 数据库 | Supabase PostgreSQL | 成熟、免费额度够用、配套 Auth |
| 密码哈希 | bcrypt (10 rounds) | 标准安全，性能适中 |
| ORM | Prisma | 类型安全，迁移方便 |

---

## 3. 数据模型

### User 表扩展

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified DateTime?
  name          String?
  password      String?   // bcrypt 哈希后的密码
  role          Role      @default(USER)
  isActive      Boolean   @default(true)
  tier          String    @default("FREE")
  dailyUsage    Int       @default(0)
  monthlyUsage  Int       @default(0)
  dailyResetAt  String?
  monthlyResetAt String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  songs        Song[]
  apiConfig    ApiConfig?
  subscription Subscription?
}
```

---

## 4. 登录流程

### 4.1 邮箱检测逻辑

```
用户输入邮箱 → API 检测该邮箱是否存在
    ↓
├── 存在 + 有密码 → 显示密码输入框，可切换验证码
├── 存在 + 无密码 → 显示验证码输入框
└── 不存在 → 提示"邮箱未注册，请先注册\"
```

### 4.2 密码登录

```
邮箱 + 密码 → POST /api/auth/login
    ↓
验证密码（bcrypt）
    ↓
├── 成功 → 创建 session，返回 session-token cookie
└── 失败 → 返回错误\"密码错误\"
```

### 4.3 验证码登录（保留）

```
邮箱 → POST /api/auth/send-code
    ↓
发送验证码到邮箱（或开发模式显示在页面）
    ↓
邮箱 + 验证码 → POST /api/auth/verify
    ↓
验证成功 → 可选设置密码 → 创建 session
```

---

## 5. 注册流程

```
邮箱 → POST /api/auth/send-code（发送验证码）
    ↓
邮箱 + 验证码 → POST /api/auth/verify
    ↓
验证成功 → 跳转设置密码页面
    ↓
设置密码（必填） + 昵称（可选） → POST /api/auth/register
    ↓
创建用户（含密码哈希）→ 创建 session → 跳转 dashboard
```

---

## 6. 退出登录

```
点击头像 → 下拉菜单 → \"退出登录\"
    ↓
POST /api/auth/logout
    ↓
清除 session-token cookie
    ↓
跳转首页或登录页
```

### 6.1 Header 布局

```
┌─────────────────────────────────────────────────────┐
│ Logo          [首页] [价格]           [头像] [下拉菜单] │
└─────────────────────────────────────────────────────┘
```

下拉菜单内容：
- 用户邮箱/昵称
- 我的歌曲
- 账号设置
- ─────────
- 退出登录（红色）

---

## 7. API 设计

### 7.1 POST /api/auth/login

**请求体**:
```json
{
  "email": "user@example.com",
  "password": "userPassword123"
}
```

**响应（成功）**:
```json
{
  "success": true,
  "user": { "id": "...", "email": "...", "role": "USER" }
}
```
Set-Cookie: session-token=...

**响应（失败）**:
```json
{
  "error": "密码错误"
}
```

### 7.2 POST /api/auth/register

**请求体**:
```json
{
  "email": "user@example.com",
  "password": "userPassword123",
  "name": "用户名"
}
```

**响应**: 同 login

### 7.3 POST /api/auth/logout

**响应**:
```json
{
  "success": true
}
```
Set-Cookie: session-token=; Max-Age=0

### 7.4 POST /api/auth/send-code

不变，保留验证码发送功能

### 7.5 POST /api/auth/verify

不变，验证码验证成功后可选设置密码

---

## 8. UI 设计

### 8.1 登录页布局

```
┌──────────────────────────────────────┐
│           TaoyBeats                   │
│                                      │
│     欢迎回来                         │
│     输入邮箱登录你的账号               │
│                                      │
│     [邮箱输入框          ]            │
│     [密码输入框          ]  ← 动态   │
│     [验证码输入框        ]  ← 动态   │
│                                      │
│     [────── 登录 ──────]            │
│                                      │
│     使用验证码登录 | 忘记密码？         │
│                                      │
│     没有账号？注册                     │
└──────────────────────────────────────┘
```

### 8.2 登录页状态

| 状态 | 显示 |
|------|------|
| 默认 | 邮箱输入框 + [发送验证码/继续] 按钮 |
| 邮箱已注册有密码 | 密码输入框 + [密码登录] + [使用验证码] 切换 |
| 邮箱已注册无密码 | 验证码输入框 + [验证] 按钮 |
| 邮箱未注册 | 提示去注册页面 |

### 8.3 登录后 Header

```
┌────────────────────────────────────────────────────────┐
│ Logo   [首页] [价格]                    [头像 ▾]        │
│                                            ┌────────┐ │
│                                            │ 用户名  │ │
│                                            │ ────── │ │
│                                            │ 我的歌曲│ │
│                                            │ 账号设置│ │
│                                            │ ────── │ │
│                                            │ 退出登录│ │
│                                            └────────┘ │
└────────────────────────────────────────────────────────┘
```

---

## 9. 实现步骤

1. 创建 Supabase 项目（手动，需用户授权）
2. 配置 DATABASE_URL
3. Prisma migrate 创建表
4. 实现 /api/auth/login
5. 实现 /api/auth/register（含密码哈希）
6. 实现 /api/auth/logout
7. 重构登录页 UI
8. 添加 Header 退出菜单
9. 给 68605481@qq.com 设置 ADMIN 角色
10. 验证 build + test

---

## 10. 安全考虑

- 密码使用 bcrypt (10 rounds) 哈希存储
- Session token 存储在 HTTP-only cookie
- 密码最小长度：6 字符
- 验证码 5 分钟有效期

---

## 11. 待用户操作

1. 在 Supabase 创建项目并提供 DATABASE_URL（或我通过 API 创建）
2. 确认 SMTP 配置（用于发送真实邮件）
