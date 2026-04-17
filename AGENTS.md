# AGENTS.md — AI Music 项目协作协议

## 核心定位

| 角色 | 职责 | 工具 |
|------|------|------|
| **Claude Code (Cloud Code)** | 总控架构师 · 使用 Superpowers 方法论 | Superpowers Skills + Codex Plugin |
| **Codex** | 并行实现引擎 · 代码审查与任务执行 | `/codex:review` `/codex:rescue` |

---

## Superpowers 方法论（强制执行）

### 技能调用规则

**在任何任务开始前，必须检查并调用相关 Skill：**

| 场景 | 必须调用的 Skill |
|------|----------------|
| 开始新功能/组件/任何创造性工作 | `superpowers:brainstorming` |
| 遇到 bug/测试失败/异常行为 | `superpowers:systematic-debugging` |
| 实现任何功能或修复 | `superpowers:test-driven-development` |
| 任务完成/修复后/提交前 | `superpowers:verification-before-completion` |
| 实现计划执行（含多步骤任务） | `superpowers:subagent-driven-development` |
| 收到代码审查反馈 | `superpowers:receiving-code-review` |
| 需要代码审查 | `superpowers:requesting-code-review` |
| 任务完成，准备合并 | `superpowers:finishing-a-development-branch` |
| 需要并发执行独立任务 | `superpowers:dispatching-parallel-agents` |

### Superpowers 核心原则

1. **证据优先**：不运行验证命令就不声称通过
2. **根因分析**：不找到 bug 根因就不修复
3. **先设计后实现**：brainstorming 批准后才能写代码
4. **TDD 循环**：RED → GREEN → REFACTOR

---

## Codex Plugin CC 集成

### 命令速查

| 命令 | 用途 | 何时使用 |
|------|------|----------|
| `/codex:review` | 代码审查 | 任务完成、提交前、合并前 |
| `/codex:adversarial-review` | 对抗性审查 | 设计决策、风险区域、高优先级功能 |
| `/codex:rescue` | 委托任务 | 复杂 bug 调查、并行加速、长时间任务 |
| `/codex:status` | 查看状态 | 检查后台任务进度 |
| `/codex:result` | 获取结果 | 查看 Codex 任务输出 |

### 协作工作流

```
用户需求
    ↓
[Claude] brainstorming → 设计审批 → 任务拆解
    ↓
TASKS.md 登记任务
    ↓
[Claude] 领取任务 → CLAIMS.md 登记
    ↓
┌─────────────────────────────────────┐
│  并发执行区                           │
│  [Claude] 实现核心逻辑               │
│  [Codex] /codex:rescue 并行实现      │
│  [Codex] /codex:review 实时审查      │
└─────────────────────────────────────┘
    ↓
verification-before-completion
    ↓
/codex:review 最终审查
    ↓
finishing-a-development-branch
    ↓
git commit + PR
```

---

## 角色与职责

### Claude Code（总控）

- 架构设计与技术决策
- 任务拆解与优先级排序
- Superpowers Skills 调用与执行
- Codex 任务委托与结果审查
- 最终验收与质量把关
- `.coord/` 协作文档维护

### Codex（实现引擎）

- 接收 Claude 委托的任务
- 执行代码实现、bug 修复
- 提供代码审查意见
- 通过 `/codex:rescue` 工作流回报结果

### 项目级 Subagents

| Agent | 职责 |
|-------|------|
| `worker-frontend` | 前端 React/CSS 实现 |
| `worker-backend` | 后端 API/业务逻辑 |
| `worker-tests` | 测试编写与验证 |
| `explorer-codebase` | 代码分析、依赖梳理 |
| `reviewer-quality` | 静态检查、风险审查 |

---

## 文件认领规则

1. **Claim 先行**：任何人写文件前必须先在 `.coord/CLAIMS.md` 登记
2. **独占写权限**：同一文件同一时刻只能有一个活跃 Claim
3. **释放条件**：任务完成并写入 HANDOFF 后释放 Claim
4. **并发禁止**：严禁多个 agent 同时修改同一文件

---

## 验证规则（强制）

**提交前必须通过：**

```bash
npm run lint && npm test && npm run build
```

**未验证不提交**：未运行验证命令不得标记任务为完成。

---

## 并发原则

- **鼓励并发**：研究+实现、前端+后端、Claude+Codex
- **必须串行**：同文件修改、强耦合模块、架构性改动
- **禁止**：同一文件并发写

---

## 打断条件（不询问，直接停）

1. 修改项目目录之外的文件
2. 读取或暴露 secrets/.env/凭据
3. 执行不可逆破坏性操作
4. 需要外部账号登录、人工验证、付费授权
5. 任务存在关键歧义且不问清楚会高概率做错

---

## 协作流程

```
1. [Claude] brainstorming → 设计文档 → 审批
2. [Claude] 拆解任务 → 写入 TASKS.md
3. [Claude/Codex] 领取任务 → CLAIMS.md 登记
4. [执行] superpowers:brainstorming 指导实现
5. [验证] verification-before-completion 确保通过
6. [审查] /codex:review 最终检查
7. [完成] HANDOFF 记录 → 释放 Claim
```

---

## 自治目标

- 项目内常规操作（读写、测试、构建、lint）尽量不确认
- Sandbox 限制在项目目录内
- 联网主要用于依赖检查和研发

## 生效条件

本协议在项目根目录生效，每次进入项目目录自动加载。
