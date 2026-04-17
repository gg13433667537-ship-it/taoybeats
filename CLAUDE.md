# CLAUDE.md — 项目入口文档

## 项目概述

**项目**: AI Music  
**目录**: `/Users/taoyang/Desktop/my-projects/ai-music`  
**状态**: 初始化阶段，协作框架已建立，等待业务需求注入

## 技术栈

| 类别 | 状态 |
|------|------|
| 语言 | **TBD** |
| 框架 | **TBD** |
| 包管理器 | **TBD** |
| 测试框架 | **TBD** |

## 项目结构

```
ai-music/
├── .claude/           # Claude Code 项目配置
│   ├── settings.json  # 权限和运行设置
│   ├── agents/        # 项目级子代理定义
│   ├── hooks/         # 钩子脚本
│   └── rules/          # 本地规则
├── .coord/            # 多 Agent 协作协调
│   ├── PROJECT.md      # 项目概要
│   ├── TASKS.md        # 任务登记
│   ├── CLAIMS.md       # 文件认领
│   ├── DECISIONS.md    # 架构决策
│   ├── HANDOFF.md      # 任务交接
│   └── CHECKS.md       # 验证命令
├── AGENTS.md           # 全局协作协议（与 Codex 共享）
├── src/                # 源代码
├── tests/              # 测试代码
└── docs/               # 文档
```

## 协作协议

**核心规则**：
1. 写文件前必须先 Claim（`.coord/CLAIMS.md`）
2. 同一文件同一时刻只有一个写作者
3. 任务完成必须写 HANDOFF
4. 未验证的代码不得标记完成

**详细规则**: 见 `AGENTS.md`

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
# TBD — 项目初始化后填写
npm install
npm test
npm run build
npm run lint
```

## 入口行为

1. 用户自然语言提出想法
2. AI 总控整理结构化需求
3. 补出关键未考虑到的问题
4. 给出少量高价值选项
5. 形成可执行任务清单
6. 并发执行可并行任务
7. 串行执行强耦合任务
