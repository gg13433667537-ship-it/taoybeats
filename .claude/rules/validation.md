# 代码验证规则

## 提交前必须验证

所有代码变更在 commit 前必须通过：

```bash
# Node.js
npm run lint && npm test && npm run build

# Python
flake8 . && pytest && python -m mypy .

# Rust
cargo clippy && cargo test && cargo build
```

## 验证失败处理

- **lint 失败** → 修复 lint 错误后再提交
- **test 失败** → 修复测试后再提交
- **build 失败** → 修复编译错误后再提交

## 未验证不提交

硬规则：未运行验证命令不得标记任务为完成。

## 验证结果记录

每次验证结果记录到 HANDOFF 中。
