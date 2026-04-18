# TaoyBeats

AI 音乐生成网页工具 - Create music with AI, share your sound.

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.local.example` 为 `.env.local` 并填写：

```bash
cp .env.local.example .env.local
```

编辑 `.env.local`:

```env
# NextAuth (生成一个随机密钥)
AUTH_SECRET=your-auth-secret-here

# MiniMax API (从 MiniMax 控制台获取)
MINIMAX_API_KEY=your-minimax-api-key
MINIMAX_API_URL=https://api.minimax.chat
MINIMAX_MODEL_ID=music-2.6
```

### 3. 运行开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)

## 功能

- **音乐生成** - 配置你的 AI 后端，一键生成原创音乐
- **实时进度** - SSE 流式推送，实时查看生成状态
- **分享下载** - 生成分享链接，下载 MP3
- **额度控制** - Free 用户每天 3 首，每月 10 首
- **暗色主题** - 现代美观的暗色 UI 设计

## 技术栈

- **前端**: Next.js 16 + TypeScript + Tailwind CSS
- **认证**: 邮箱验证码登录
- **AI**: MiniMax API (music-2.6)
- **部署**: Vercel

## 部署到 Vercel

1. Fork 此仓库到你的 GitHub
2. 访问 [vercel.com](https://vercel.com) 登录
3. 点击 "New Project" → Import "taoybeats"
4. 在 Vercel 项目设置中添加环境变量
5. Deploy!

## 许可证

MIT License
