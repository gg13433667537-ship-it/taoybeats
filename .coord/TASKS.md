# TASKS.md — 任务登记

> 每个任务 ID 对应一个可领取的工作单元。Claim 规则见 AGENTS.md。

---

## 协作框架更新 (2026-04-17)

### 已集成的工具

| 工具 | 版本 | 用途 |
|------|------|------|
| Superpowers | 5.0.7 | 方法论：brainstorming/TDD/调试/验证 |
| Codex Plugin CC | 1.0.3 | 代码审查与任务委托 |

### Skill 调用流程

任何任务开始前：
1. `superpowers:brainstorming` — 理解需求、设计方案
2. `superpowers:test-driven-development` — 实现前写测试
3. `superpowers:verification-before-completion` — 完成后验证
4. `/codex:review` — 提交前 Codex 审查

### Codex 委托流程

```
/codex:rescue <任务描述>     # 委托 Codex 执行
/codex:status               # 检查进度
/codex:result               # 获取结果
```

---

## v0.1 — 奠基阶段 ✅ 完成

| Task ID | 任务 | 状态 |
|---------|------|------|
| T-001 | Next.js 14 初始化 + TypeScript 配置 | ✅ 完成 |
| T-002 | shadcn/ui + Tailwind CSS 安装配置（含暗色主题） | ✅ 完成 |
| T-003 | Prisma Schema 设计（User / Song / Session / ApiConfig） | ✅ 完成 |
| T-004 | NextAuth.js v5 配置（邮箱 + Google + Apple OAuth） | ✅ 完成 |
| T-005 | GitHub Actions → Vercel CI/CD 流水线 | ✅ 完成 |
| T-006 | 基础 UI 组件验证（暗色主题 Button/Input/Select/Card） | ✅ 完成 |

---

## v0.2 — AI 生成核心 ✅ 完成

| Task ID | 任务 | 状态 |
|---------|------|------|
| T-007 | AI Provider 接口抽象层 + MiniMax/Suno/Uidio | ✅ 完成 |
| T-008 | 歌曲生成表单 UI（暗色美观） | ✅ 完成 |
| T-009 | SSE 进度推送 API Route | ✅ 完成 |
| T-010 | 实时进度条 UI 组件（暗色主题） | ✅ 完成 |
| T-011 | 生成结果展示页 + 音频播放器 | ✅ 完成 |
| T-012 | MP3 下载功能 | ✅ 完成 |

---

## v0.3 — 用户系统完善 ✅ 完成

| Task ID | 任务 | 状态 |
|---------|------|------|
| T-013 | 邮箱验证流程 | ✅ 完成 |
| T-014 | 游客 → 注册用户数据迁移 | ✅ 完成 |
| T-015 | 个人中心页面（我的歌曲/API配置/账号设置） | ✅ 完成 |
| T-016 | Apple OAuth Provider 接入 | ⏳ 待接 |

---

## v0.3 — AI 生成后端 ✅ 完成

| Task ID | 任务 | 状态 |
|---------|------|------|
| T-017 | SSE 实时进度 API（/api/songs/[id]/stream） | ✅ 完成 |
| T-018 | 歌曲 CRUD API | ✅ 完成 |
| T-019 | MiniMax 真实 API 对接（music-2.6） | ✅ 完成 |
| T-020 | 路由保护 middleware.ts | ✅ 完成 |
| T-021 | 歌曲分享公开页 /song/[id] | ✅ 完成 |

---

## v0.4 — 分享与发现 🚧 进行中

| Task ID | 任务 | 状态 |
|---------|------|------|
| T-022 | 分享链接生成（带参数） | ⏳ 待接 |
| T-023 | Fork 重新生成功能 | ⏳ 待接 |

---

## v0.5 — Freemium 基础

| Task ID | 任务 | 状态 |
|---------|------|------|
| T-024 | 用户分级逻辑（Free/Pro） | ✅ 完成 |
| T-025 | 额度系统（每日限制） | ✅ 完成 |
| T-026 | Stripe 订阅页面 | ⏳ 待接 |

---

## v0.6 — 超级管理员系统 ✅ 完成

| Task ID | 任务 | 状态 | 负责人 |
|---------|------|------|--------|
| T-027 | 数据库 Schema 扩展（User.role, AdminLog） | ✅ 完成 | Claude |
| T-028 | 管理员 API Routes（用户管理、权限分配） | ✅ 完成 | Codex |
| T-029 | 管理员 Dashboard 页面 | ✅ 完成 | Codex |
| T-030 | 系统设置管理（每日限额、功能开关） | ✅ 完成 | Codex |
| T-031 | 管理员操作日志 | ✅ 完成 | Codex |
| T-032 | 管理员入口（/dashboard, /generate 页添加 Admin 链接） | 🔄 进行中 | Claude |

---

## v0.7 — i18n 全站国际化 ✅ 完成

| Task ID | 任务 | 状态 | 负责人 |
|---------|------|------|--------|
| T-033 | i18n 系统搭建（Context + translations） | ✅ 完成 | Claude |
| T-034 | 登录/注册页面 i18n | ✅ 完成 | Claude |
| T-035 | 首页 i18n | ✅ 完成 | Claude |
| T-036 | Dashboard/Settings/Generate 页面 i18n | ✅ 完成 | Claude/Agent |
| T-037 | Pricing/Song 页面 i18n | ✅ 完成 | Claude/Agent |
| T-038 | Admin 页面 i18n | 🔄 进行中 | Codex |
| T-039 | 路由跳转后语言保持 | ✅ 完成 | Claude |

---

## 延后池（v1.0+）

| Task ID | 任务 | 优先级 |
|---------|------|--------|
| T-101 | 声纹录制 UI + 后端接口 | P0 延后 |
| T-102 | 声纹克隆 AI 集成 | P0 延后 |
| T-103 | 歌词结构编辑器 | P1 |
| T-104 | 内容审核系统 | P1 |
| T-105 | 移动端适配优化 | P2 |
| T-106 | 完整支付系统 | P0 延后 |

---

## 任务统计

| 阶段 | 总任务数 | 完成 | 进行中 | 待领取 |
|------|---------|------|--------|--------|
| v0.1 | 6 | 6 | 0 | 0 |
| v0.2 | 6 | 6 | 0 | 0 |
| v0.3 | 7 | 5 | 0 | 2 |
| v0.4 | 2 | 0 | 0 | 2 |
| v0.5 | 3 | 2 | 0 | 1 |
| v0.6 | 6 | 5 | 1 | 0 |
| v0.7 | 7 | 6 | 1 | 0 |
| 延后池 | 6 | 0 | 0 | 6 |
| **总计** | **43** | **30** | **2** | **11** |

---

## GitHub 仓库

`https://github.com/gg13433667537-ship-it/taoybeats`

## 当前进度

```
v0.1 ████████████████████ 100%  奠基完成
v0.2 ████████████████████ 100%  AI 生成核心完成
v0.3 ████████░░░░░░░░░░░ 70%   用户系统完成，OAuth待接
v0.4 ░░░░░░░░░░░░░░░░░░░ 0%    分享功能待开发
v0.5 ████░░░░░░░░░░░░░░░ 66%   Freemium基础完成，订阅页面待开发
v0.6 ████████████████░░░░ 83%   超级管理员完成，入口待完善
v0.7 ████████████████░░░░ 85%   i18n基本完成，Admin页面待完善
v1.0 ░░░░░░░░░░░░░░░░░░░ 0%    MVP 发布
```

---

## 待完成任务清单

### 高优先级
1. **T-038**: Admin 页面 i18n（翻译所有文本）
2. **T-032**: 管理员入口完善（generate/settings 页添加 admin 链接）
3. **T-016**: Apple OAuth Provider 接入
4. **T-026**: Stripe 订阅页面

### 中优先级
5. **T-022**: 分享链接生成（带参数）
6. **T-023**: Fork 重新生成功能

### 低优先级（v1.0）
7. T-101 ~ T-106

---

## 技术注意事项

- 数据存储：当前使用内存存储（serverless 环境），重启后数据丢失
- 第一个注册用户（68605481@qq.com）自动成为 ADMIN
- 管理员中间件检查 session-token 中的 role 字段
