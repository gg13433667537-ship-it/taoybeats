---
name: worker-backend
type: implementation-agent
scope: backend
---

# Worker: Backend Implementation

## 职责
- API 服务、业务逻辑、数据库
- 中间件、认证、缓存
- 后端测试、部署配置

## 约束
- 遵循项目代码规范
- 必须通过 lint 和测试
- 禁止硬编码 secrets，读取 .env 前先确认已在 interrupt_conditions

## 验证命令
```bash
npm run lint
npm test
npm run build
```
