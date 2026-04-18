# CLAUDE.md — 项目入口文档

## 项目概述

**项目**: AI Music (TaoyBeats)
**目录**: `/Users/taoyang/Desktop/my-projects/ai-music`
**状态**: 活跃开发中

## 技术栈

| 类别 | 技术 |
|------|------|
| 语言 | TypeScript |
| 框架 | Next.js 16.2.4 |
| 包管理器 | npm |
| 数据库 | PostgreSQL + Prisma |
| 测试框架 | Vitest + Playwright |
| UI | Tailwind CSS 4 |

## 项目结构

```
ai-music/
├── .claude/           # Claude Code 项目配置
│   ├── settings.json  # 权限和运行设置
│   ├── agents/        # 项目级子代理定义
│   ├── hooks/         # 钩子脚本
│   └── rules/         # 本地规则
├── .coord/            # 协作协调
│   ├── TASKS.md       # 任务登记
│   ├── CLAIMS.md      # 文件认领
│   ├── DECISIONS.md   # 架构决策
│   └── HANDOFF.md     # 任务交接
├── src/               # 源代码
│   ├── app/           # Next.js App Router 页面
│   ├── components/     # React 组件
│   ├── hooks/         # 自定义 Hooks
│   └── lib/           # 工具函数和库
├── tests/             # 测试代码 (Vitest + Playwright)
├── docs/              # 文档
├── prisma/            # Prisma Schema
├── scripts/           # 构建和部署脚本
├── public/            # 静态资源
└── supabase/          # Supabase 配置
```

## 协作协议

**核心规则**：

1. **Claude Code 是唯一入口** — 用户只与 Claude Code 对话，不直接与 Codex 交互
2. **Claude Code 主导日常开发** — 所有任务由 Claude Code 接收、分解、执行
3. **Codex 仅用于高影响力决策** — 仅在架构变更、重大技术选型等高影响场景才调用 Codex
4. **Token 成本是硬约束** — 常规工作不调用 Codex，避免不必要的成本
5. **安全第一** — 绝不将 API keys/tokens 发送给 Codex
6. **写文件前必须 Claim** — 通过 `.coord/CLAIMS.md` 声明文件所有权
7. **同一文件同一时刻只有一个写作者**
8. **任务完成必须写 HANDOFF**
9. **未验证的代码不得标记完成**

## Codex 使用策略

| 场景 | 是否调用 Codex |
|------|---------------|
| 常规 bug 修复 | 否 |
| 常规功能开发 | 否 |
| UI/组件开发 | 否 |
| 测试编写 | 否 |
| 代码审查（常规）| 否 |
| 架构重构方案 | 是 |
| 重大技术选型 | 是 |
| 跨模块复杂问题 | 是 |
| 安全/性能关键决策 | 是 |

## 默认行为

- 项目内常规操作（读写、测试、lint、构建）**不需确认**
- 仅在以下情况确认：
  1. 修改项目外文件
  2. 访问 secrets / .env / 凭据
  3. 不可逆破坏性操作
  4. 产品方向关键取舍
  5. 需登录/付费/外部授权

## 运行命令

```bash
npm install          # 安装依赖
npm run dev          # 开发服务器
npm run build        # 生产构建
npm run lint         # 代码检查
npm run lint:fix     # 自动修复 lint 问题
npm run type-check   # TypeScript 类型检查
npm test             # 运行 Vitest 单元测试
npm run e2e          # 运行 Playwright E2E 测试
npm run db:push      # 推送 Prisma schema 到数据库
npm run db:studio    # 打开 Prisma Studio
```

## 入口行为

1. 用户自然语言提出想法
2. Claude Code 整理结构化需求
3. 补出关键未考虑到的问题
4. 给出少量高价值选项
5. 形成可执行任务清单
6. 并发执行可并行任务
7. 串行执行强耦合任务
8. 完成后验证并更新 HANDOFF
