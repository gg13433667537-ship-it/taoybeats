# PROJECT.md — TaoyBeats 项目概要

## 产品定位

> **TaoyBeats** — 一个 AI 音乐共创网页工具（SaaS），用户配置自己的 AI 音乐后端 API，填写歌词/风格/情绪/乐器等参数生成定制音乐作品，支持游客模式、歌曲链接分享下载、Freemium 付费模式。

## 产品名称

| 字段 | 内容 |
|------|------|
| 中文名 | 陶阳音乐 |
| 英文名 | **TaoyBeats** |
| 域名目标 | taoybeats.com |
| Slogan | Create music with AI, share your sound |

## 核心用户故事

1. **游客用户**：打开链接 → 体验基础生成 → 被引导注册解锁高级功能
2. **注册用户**：配置自己的 AI 后端 → 创建音乐作品 → 分享链接/下载
3. **付费用户**：解锁高级功能和更高额度

## MVP 范围

### ✅ MVP 包含
- 用户系统（游客模式 + 邮箱注册 + OAuth Google/Apple）
- AI 生成核心流程（配置 API Key/URL/Model ID + 填写参数）
- 歌曲生成（歌名 + 歌词 + 类型 + 情绪 + 乐器多选 + 备注）
- 实时进度条（生成中实时状态推送 SSE）
- 分享下载（生成链接 + MP3 下载）
- Freemium 分级（免费额度限制 + 高级功能付费）

### ❌ MVP 排除（延后池）
- 声纹录制与克隆（法律风险高，后端依赖强）
- 完整支付系统（合规复杂，先砍）
- 歌词结构编辑器（先做纯文本）
- 实时协作
- 移动端 App（先 Web）

## 技术架构

```
前端：Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
后端：Next.js API Routes + Prisma ORM
数据库：PostgreSQL (Supabase / Neon)
认证：NextAuth.js v5（邮箱 + Google + Apple）
AI 接口：可插拔 Provider 架构（MiniMax / Suno / Udio / 自定义）
实时进度：Server-Sent Events (SSE)
存储：S3 兼容对象存储（音频文件）+ CloudFront CDN
部署：Vercel（前端）+ Railway（AI 推理任务 / 可选）
```

## 设计方向

- **视觉风格**：暗色系（深色背景 + 霓虹/渐变强调色）— 音乐 App 常见风格
- **UI 设计**：高审美、现代化、注重波形/音频可视化
- **技术栈**：shadcn/ui（深色主题）+ Tailwind CSS
- **响应式**：桌面优先，移动端兼容

## 内容版权

- AI 生成音乐版权归平台方（运营者）所有
- 服务条款明确要求用户保证输入内容原创性
- 商业用途歌曲提供免责协议

## 竞品对标

- **Suno.com** — 最直接竞品，功能/交互对标
- **Udio.com** — 定价策略参考（Freemium）
- **Boomy.com** — 极简生成体验参考

## 关键风险

1. AI 音乐生成耗时 2-10 分钟 → SSE 进度推送 + 预估时间 + 后台生成
2. 内容版权尚无统一定论 → 平台方声明 + 服务条款约束
3. 游客 → 注册用户数据迁移 → 明确授权机制
4. 多 AI Provider 切换 → Provider 抽象层设计
5. MiniMax API 稳定性 → 需有兜底 Provider（Suno）
