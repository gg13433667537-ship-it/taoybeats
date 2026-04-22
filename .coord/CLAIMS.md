# .coord/CLAIMS.md — 文件认领记录

> 任何人写文件前必须先登记 Claim。同一文件同一时刻只能有一个活跃 Claim。

## 项目 Agent 注册表

| Agent ID | 类型 | 配置文件 | 职责 |
|----------|------|----------|------|
| claude-main | orchestration | — | 总控、任务分派、日常开发 |

## 活跃 Claims

| T-001 | claude-main | src/components/CloneVoiceModal.tsx | 2026-04-18 | 麦克风权限和上传功能修复完成 | released |
| T-002 | claude-main | src/components/UserDropdown.tsx | 2026-04-18 | 登录UI状态修复组件 | released |
| T-040 | claude-main | .coord/CLAIMS.md | 2026-04-19 00:34 | 音乐生成链路修复所需认领登记完成 | active |
| T-040 | claude-main | docs/superpowers/plans/2026-04-19-music-generation-stabilization.md | 2026-04-19 00:34 | 生成链路修复计划已落盘 | active |
| T-040 | claude-main | src/lib/ai-providers.ts | 2026-04-19 00:34 | MiniMax provider 解析与请求格式修复并通过相关测试 | active |
| T-040 | claude-main | tests/lib/ai-providers.test.ts | 2026-04-19 00:34 | provider 回归测试覆盖已补齐并通过 | active |
| T-040 | claude-main | src/app/api/auth/register/route.ts | 2026-04-19 00:42 | 注册在 Prisma 不可用时仍可回退到内存存储 | released |
| T-041 | claude-main | src/app/api/auth/register/route.ts | 2026-04-21 00:00 | 注册需要验证码，移除内存回退 | released |
| T-040 | claude-main | src/app/api/auth/profile/route.ts | 2026-04-19 00:42 | 资料查询在 Prisma 不可用时仍可回退到内存存储 | active |
| T-040 | claude-main | src/app/api/songs/route.ts | 2026-04-19 00:42 | 歌曲创建在 Prisma 不可用时仍可继续生成 | active |
| T-040 | claude-main | src/app/api/songs/[id]/download/route.ts | 2026-04-19 00:42 | 下载接口在 Prisma 不可用时可从内存读取歌曲 | active |
| T-040 | claude-main | tests/api/auth-register.test.ts | 2026-04-19 00:42 | 注册 fallback 回归测试补齐并通过 | active |
| T-040 | claude-main | tests/api/songs.test.ts | 2026-04-19 00:42 | 歌曲创建 fallback 回归测试补齐并通过 | active |
| T-040 | claude-main | tests/e2e/songs.spec.ts | 2026-04-19 00:49 | 浏览器端生成/播放/下载链路验证用例补齐并通过 | active |
| T-040 | claude-main | playwright.config.ts | 2026-04-19 00:51 | 支持复用外部 dev server 的 Playwright 运行方式 | active |
| T-040 | claude-main | src/app/(main)/generate/page.tsx | 2026-04-19 00:56 | 生成页补充稳定测试选择器以支持真实前端验证 | active |
| T-040 | claude-main | src/components/SelectorDrawer.tsx | 2026-04-19 00:56 | 抽屉选项补充稳定测试选择器以支持真实前端验证 | active |
| T-040 | claude-main | src/app/api/songs/[id]/audio/route.ts | 2026-04-19 01:02 | 新增同源音频代理以修复浏览器播放 CORS | active |
| T-040 | claude-main | src/components/AudioPlayer.tsx | 2026-04-19 01:02 | 播放器改为优先使用同源音频代理和下载代理 | active |
| T-040 | claude-main | src/app/song/[id]/page.tsx | 2026-04-19 01:02 | 歌曲详情页改为使用同源音频代理播放和下载 | active |
| T-040 | claude-main | .gitignore | 2026-04-19 07:03 | 忽略根目录 Playwright 测试产物避免污染部署提交 | active |
| T-042 | claude-main | src/app/api/auth/verify/route.ts | 2026-04-21 00:00 | 验证码登录改为 Prisma 持久化，自动创建用户 | released |
| T-043 | claude-main | src/app/api/auth/reset-password/route.ts | 2026-04-21 00:00 | 忘记密码重置接口实现并通过 lint/type-check | released |
| T-044 | claude-main | src/lib/auth-utils.ts | 2026-04-21 00:00 | 添加 verifySessionTokenWithDB 支持 sessionsRevokedAt 校验 | released |
| T-044 | claude-main | src/app/api/auth/profile/route.ts | 2026-04-21 00:00 | profile API 使用 verifySessionTokenWithDB 校验 session | released |
| T-045 | claude-main | src/app/(auth)/login/page.tsx | 2026-04-21 00:00 | 登录页支持密码和验证码双模式 + 忘记密码链接 | released |
| T-046 | claude-main | src/app/(auth)/reset-password/page.tsx | 2026-04-21 00:00 | 创建忘记密码重置页面，3步流程 | released |
| T-047 | claude-main | src/lib/db.ts | 2026-04-21 21:00 | 添加 Prisma 查询重试机制，解决 503 错误 | released |
| T-047 | claude-main | src/app/api/auth/login/route.ts | 2026-04-21 21:00 | 登录查询使用带重试的 Prisma wrapper | released |
| T-047 | claude-main | tests/lib/db-retry.test.ts | 2026-04-21 21:00 | Prisma 重试逻辑单元测试 | released |
| T-048 | claude-main | workers/reverse-proxy.js | 2026-04-21 21:00 | Cloudflare Workers 反向代理脚本 | released |
| T-048 | claude-main | workers/wrangler.toml | 2026-04-21 21:00 | Cloudflare Workers 部署配置 | released |

---

## Claim 登记模板

```
| T-XXX | [Agent ID] | [文件路径] | [YYYY-MM-DD HH:MM] | [预计完成条件] | active |
```

## Claim 规则

1. **登记**：写文件前必须先在上述表格登记
2. **独占**：活跃 Claim 的文件禁止其他 Agent 写
3. **释放**：任务完成并写入 HANDOFF 后，状态改为 `released`
4. **超时**：超过 30 分钟无进展，需重新评估
5. **强制释放**：总控可强制释放过期 Claim

## 路径通配符规则

- `src/**` — 包含 src 下所有子目录和文件
- `src/` — 仅 src 目录本身，不含子文件

## 释放条件模板

- 任务完成且代码已验证
- HANDOFF 已写入
- 验证命令已通过
