# .coord/CHECKS.md — 验证命令汇总

> 汇总 lint/test/build/checklist。**技术栈确定后必须更新**。

## 通用验证命令

```bash
# TBD — 项目初始化后填写

# 安装依赖
npm install

# 代码检查
npm run lint

# 测试
npm test

# 构建
npm run build

# 类型检查
npm run typecheck

# 全部检查
npm run check
```

---

## 项目初始化检查清单

- [x] 协作框架目录 `.coord` 已创建
- [x] AGENTS.md 已建立
- [ ] 技术栈已确定
- [ ] 基础项目结构已创建
- [ ] 初始任务已拆分并登记到 TASKS.md
- [ ] 验证命令已配置

## 提交前检查清单

- [ ] lint 通过
- [ ] test 通过
- [ ] build 通过
- [ ] 无新增警告
- [ ] HANDOFF 已写入
- [ ] CLAIM 已释放

## 分语言验证模板

### Node.js / TypeScript

```bash
npm install
npm run lint
npm test
npm run build
```

### Python

```bash
pip install -r requirements.txt
flake8 .
pytest
python -m mypy .
```

### Rust

```bash
cargo build
cargo test
cargo clippy
cargo fmt --check
```

---

## CHECKS.md 更新规则

1. 技术栈确定后立即更新
2. 添加新依赖后更新检查命令
3. CI/CD 变更后同步更新
4. 每次更新记录到 DECISIONS.md
