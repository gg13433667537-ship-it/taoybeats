# SPEC.md — TaoyBeats 产品规格说明书

> 版本：v0.1（草案）| 状态：待用户确认品牌名 | 更新：2026-04-17

---

## 一、产品概述

| 字段 | 内容 |
|------|------|
| 产品名称 | **TaoyBeats**（中文名：陶阳音乐） |
| 域名 | `taoybeats.vercel.app`（Vercel 分配） |
| 产品类型 | AI 音乐生成网页工具（SaaS） |
| 核心价值 | 用户配置自己的 AI 音乐后端，一站式生成、分享、下载定制音乐 |
| 目标用户 | 通用大众（音乐爱好者、内容创作者、业余音乐人） |
| 版权归属 | 平台方（运营者）所有 |

---

## 二、用户角色与权限

### 2.1 角色定义

| 角色 | 权限范围 |
|------|----------|
| **游客（Guest）** | 体验基础生成（限额度），不可下载，不可分享 |
| **注册用户（User）** | 完整生成功能 + 下载 + 分享 + 个人中心 |
| **Pro 用户（Pro）** | User 权限 + 更高额度 + 优先队列 |

### 2.2 用户流程

```
游客流程：
  访问首页 → 体验生成（3首/日）→ 引导注册解锁更多

注册流程：
  邮箱/Google/Apple 注册 → 配置 AI API → 生成音乐 → 分享/下载

付费升级流程：
  额度用尽 → 查看 Pro 权益 → Stripe 订阅 → 解锁高额度
```

---

## 三、功能规格

### 3.1 AI 生成模块

#### 3.1.1 API 配置（用户自配置）

| 字段 | 类型 | 说明 |
|------|------|------|
| API Key | 密码输入 | 用户的 AI 服务密钥 |
| API URL | URL 输入 | AI 服务端点 |
| Model ID | 文本输入 | 具体模型标识符（如 suno-musicgen） |
| Provider 切换 | 下拉选择 | MiniMax / Suno / Udio / Custom |

#### 3.1.2 歌曲参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 歌曲名称 | 文本输入 | ✅ | 最多 100 字符 |
| 歌词 | 多行文本 | ✅ | 支持粘贴，最多 5000 字符 |
| 歌曲类型 | 下拉多选 | ✅ | Pop / Hip-Hop / Rock / Electronic / R&B / Jazz / Classical / Country / Reggae / Folk / Other |
| 情绪 | 下拉单选 | ✅ | Happy / Sad / Energetic / Calm / Romantic / Epic / Dark / Dreamy |
| 乐器 | 下拉多选 | ✅ | Guitar / Piano / Drum / Bass / Synth / Strings / Brass / Vocals |
| 参考歌手 | 文本输入 | ❌ | 风格参考（文字描述） |
| 参考歌曲 | 文本输入 | ❌ | 风格参考（歌曲名） |
| 用户备注 | 多行文本 | ❌ | 表达意向、创作背景（仅用户可见） |

#### 3.1.3 生成状态机

```
IDLE → GENERATING → COMPLETED / FAILED

GENERATING 子状态（通过 SSE 推送）：
  - initializing (0-5%)
  - generating_melody (5-30%)
  - generating_lyrics (30-50%)
  - rendering_audio (50-90%)
  - finalizing (90-100%)
```

### 3.2 用户系统模块

| 功能 | 描述 | 角色 |
|------|------|------|
| 邮箱注册 | 邮箱 + 密码注册 | 公开 |
| OAuth 登录 | Google / Apple 一键登录 | 公开 |
| 游客模式 | Cookie 匿名 Session，体验基础功能 | 公开 |
| 邮箱验证 | 注册后发送验证链接 | 注册用户 |
| 数据迁移 | 游客升级时合并/迁移数据 | 游客→注册 |
| 个人中心 | 账号设置 / API 配置 / 我的歌曲 | 注册用户 |

### 3.3 分享模块

| 功能 | 描述 |
|------|------|
| 歌曲分享链接 | 唯一公开 URL（如 /song/sha256hash） |
| 公开展示页 | 可听 + 可看参数 + 可下载（注册用户） |
| Fork 功能 | 基于已有歌曲参数快速创建新歌曲 |

### 3.4 Freemium 模块

| 套餐 | 额度 | 价格 |
|------|------|------|
| Free | 3 首/日，10 首/月 | 免费 |
| Pro | 50 首/日，无限月额度 | $9.99/月（待 Stripe 接入） |

---

## 四、UI/UX 规格

### 4.1 设计系统

#### 4.1.1 颜色系统（暗色主题）

| Token | 色值 | 用途 |
|-------|------|------|
| `background` | #09090b | 页面背景 |
| `surface` | #18181b | 卡片/面板背景 |
| `surface-elevated` | #27272a | 浮层/弹窗背景 |
| `border` | #3f3f46 | 边框/分割线 |
| `text-primary` | #fafafa | 主要文字 |
| `text-secondary` | #a1a1aa | 次要文字 |
| `accent` | #8b5cf6 | 强调色（紫色渐变） |
| `accent-glow` | #a78bfa | 发光/高亮效果 |
| `success` | #22c55e | 成功状态 |
| `error` | #ef4444 | 错误状态 |
| `warning` | #f59e0b | 警告状态 |

#### 4.1.2 字体系统

| 用途 | 字体 | 备选 |
|------|------|------|
| 标题 | Inter (700) | system-ui |
| 正文 | Inter (400/500) | system-ui |
| 中文 | Noto Sans SC | system-ui |
| 代码/参数 | JetBrains Mono | monospace |

#### 4.1.3 间距系统

- 基础单位：4px
- 组件内间距：8px / 12px / 16px
- 区块间距：24px / 32px / 48px
- 页面边距：24px（移动端）/ 48px（桌面端）

#### 4.1.4 动效规格

| 类型 | 时长 | 缓动 |
|------|------|------|
| 微交互 | 150ms | ease-out |
| 状态切换 | 250ms | ease-in-out |
| 页面过渡 | 300ms | ease-out |
| 进度条 | 持续 | linear |

### 4.2 页面结构

```
/                       首页（Hero + 立即体验 CTA）
/login                  登录页
/register               注册页
/dashboard              用户仪表盘（我的歌曲列表）
/generate               生成页（主工作区）
/song/[id]              歌曲详情/公开页
/settings               账号设置
/settings/api           API 配置
/pricing                定价页面
```

### 4.3 关键组件

| 组件 | 状态 | 备注 |
|------|------|------|
| SongCard | default / hover / loading | 歌曲卡片 |
| GenerationForm | idle / generating / completed / error | 生成表单 |
| ProgressBar | determinate / indeterminate | 进度条 |
| AudioPlayer | idle / playing / paused | 播放器 |
| ShareModal | open / closed | 分享弹窗 |
| UpgradePrompt | visible / hidden | 升级提示 |

---

## 五、技术规格

### 5.1 前端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 14+ | 框架 |
| TypeScript | 5+ | 类型系统 |
| Tailwind CSS | 3.4+ | 样式 |
| shadcn/ui | latest | 组件库 |
| Zustand | 4+ | 状态管理 |
| React Query | 5+ | 数据获取 |

### 5.2 后端技术栈

| 技术 | 用途 |
|------|------|
| Next.js API Routes | API 层 |
| Prisma | ORM |
| PostgreSQL | 数据库 |
| NextAuth.js v5 | 认证 |
| Redis (可选) | 限流/缓存 |

### 5.3 数据模型

```prisma
model User {
  id            String    @id @default(cuid())
  email         String?   @unique
  name          String?
  image         String?
  emailVerified DateTime?
  createdAt     DateTime  @default(now())
  songs         Song[]
  apiConfig     ApiConfig?
  subscription  Subscription?
}

model Song {
  id          String   @id @default(cuid())
  title       String
  lyrics      String?
  genre       String[]
  mood        String?
  instruments String[]
  referenceSinger String?
  referenceSong  String?
  userNotes   String?
  status      GenerationStatus @default(PENDING)
  audioUrl    String?
  coverUrl    String?
  shareToken  String?   @unique
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model ApiConfig {
  id        String @id @default(cuid())
  userId    String @unique
  user      User   @relation(fields: [userId], references: [id])
  provider  String // "minimax" / "suno" / "udio"
  apiKey    String
  apiUrl    String
  modelId   String?
}

enum GenerationStatus {
  PENDING
  GENERATING
  COMPLETED
  FAILED
}
```

### 5.4 API 设计

| Endpoint | Method | 说明 |
|----------|--------|------|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth 认证 |
| `/api/songs` | GET/POST | 列表/创建歌曲 |
| `/api/songs/[id]` | GET/PATCH/DELETE | 歌曲详情 |
| `/api/songs/[id]/generate` | POST | 触发生成 |
| `/api/songs/[id]/stream` | GET | SSE 进度流 |
| `/api/songs/[id]/download` | GET | 下载音频 |
| `/api/songs/[id]/share` | POST | 生成分享链接 |
| `/api/user/api-config` | GET/PUT | 用户 API 配置 |

---

## 六、验收标准

### 6.1 MVP 完成标准

- [ ] 端到端用户流程完整跑通（注册 → 配置 → 生成 → 下载）
- [ ] 游客模式可体验，但有限额提示
- [ ] 分享链接可访问（未登录可查看，已登录可下载）
- [ ] 暗色主题全站一致
- [ ] 移动端基本可用
- [ ] 错误处理完善（生成失败有明确提示和重试）

### 6.2 视觉验收

- [ ] 暗色主题无白屏/未适配区域
- [ ] 进度条动画流畅
- [ ] 音频播放器交互正常（播放/暂停/进度拖动）
- [ ] 表单验证错误提示清晰

---

## 七、竞品参考

| 竞品 | 核心优势 | TaoyBeats 对标 |
|------|----------|---------------|
| Suno.com | 生成质量高、品牌强 | 功能完整对标 |
| Udio.com | 社区氛围、定价清晰 | Freemium 模型参考 |
| Boomy.com | 极简生成 5 秒出歌 | 简化生成流程 |
| Stable Audio | 可控性强 | 参数控制精细化 |
