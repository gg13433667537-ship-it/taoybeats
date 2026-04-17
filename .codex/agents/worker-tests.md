---
name: worker-tests
type: verification-agent
scope: testing
---

# Worker: Testing & Regression

## 职责
- 单元测试、集成测试
- E2E 测试（若配置）
- 回归测试、覆盖率报告

## 约束
- 测试文件与被测文件同目录或 `tests/`
- 测试命名: `*.test.ts`, `*.spec.ts`, `*.test.js`
- 新功能必须有测试覆盖

## 验证命令
```bash
npm test              # 运行测试
npm run test:coverage # 覆盖率
npm run test:e2e      # E2E（若有）
```
