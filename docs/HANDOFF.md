# 项目交接文档 - TaoyBeats AI Music Generation

**最后更新**: 2026-04-19
**当前状态**: 音乐生成功能存在已知问题，需要进一步修复

---

## 项目概述

**项目名称**: TaoyBeats (AI Music Generation)
**技术栈**: Next.js 16.2.4 + TypeScript + Prisma + PostgreSQL + MiniMax API
**代码仓库**: https://github.com/gg13433667537-ship-it/taoybeats

---

## 核心问题（未解决）

### 1. 歌曲生成失败 (Generation failed)

**现象**: 用户在网页点击生成歌曲后，显示 "Generation failed"

**已尝试的修复**:
- 回滚 `ai-providers.ts` 到之前工作的版本 (commit 3ba0bba)
- 修复 `download` 函数使用 `data.data?.audio` 而非 `data.data?.audio_url`
- 添加 API 级别错误码检查 `base_resp.status_code`
- 直接 curl 测试 MiniMax API 是成功的（返回音频 URL）

**可能原因**:
- MiniMax API 对请求参数有额外校验
- 前端传递的歌词为空时 API 返回 2013 错误
- 某些参数组合不被 API 接受

**建议下一步**:
1. 在 Vercel 部署日志中添加更详细的请求/响应日志
2. 对比直接 curl 成功的请求和代码发送的请求
3. 检查是否有参数名称不匹配的问题

---

## 已修复的问题

### 管理员权限
- 修复: `usage/route.ts` 检查 `usage.role === 'ADMIN'` 而非 `tier === 'ADMIN'`
- 管理员现在有无限额度

### 多段歌词支持
- 前端 AudioPlayer 支持 playlist 播放多段歌曲
- by-part-group API 端点支持查询多段歌曲

### 用户列表
- 修复管理员在第一页看不到自己的问题

---

## MiniMax API 关键信息

### 端点
- API URL: `https://api.minimaxi.com`
- 音乐生成: `POST /v1/music_generation`
- 查询状态: `GET /v1/music_generation_info?task_id=xxx`

### 响应格式
```json
{
  "data": {
    "audio": "https://...",  // 音频URL
    "status": 2,             // 1=处理中, 2=完成
    "task_id": "xxx"
  },
  "base_resp": {
    "status_code": 0,        // 0=成功, 其他=错误
    "status_msg": "success"
  }
}
```

### 错误码
- 1002: 请求频繁
- 1004: 鉴权失败
- 1008: 余额不足
- 1026: 敏感内容
- 2013: 参数错误（如歌词为空）
- 2049: 无效API Key

---

## 关键文件

### AI Provider
`src/lib/ai-providers.ts`
- `miniMaxProvider` / `musicProvider` - 核心API调用
- 当前使用 commit 3ba0bba 的原始实现

### 歌曲路由
`src/app/api/songs/route.ts`
- `generateMusic()` - 后台生成逻辑
- `updateSongStatus()` - 状态更新

### 流式端点
`src/app/api/songs/[id]/stream/route.ts`
- SSE 推送生成进度

---

## 环境变量

```
MINIMAX_API_KEY=sk-cp-IM9XKrS2pUcf2w_ybwstx2D3n4YcYGroc6DSF8UHQowdvqsiBRkdPDGQ-qAGvIAqwL0j-HVHhKzpcg5m5QG2oX-HrfVniF_xbKCTFsnBEusnFFD-69nrWEU
MINIMAX_API_URL=https://api.minimaxi.com
```

---

## 测试建议

1. **先用 curl 测试 MiniMax API**:
```bash
curl -s --max-time 120 -X POST "https://api.minimaxi.com/v1/music_generation" \
  -H "Authorization: Bearer $MINIMAX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"music-2.6","prompt":"Pop","lyrics":"test","output_format":"url","audio_setting":{"sample_rate":44100,"bitrate":256000,"format":"mp3"}}'
```

2. **对比 curl 请求和代码发送的请求**:
   - 在 `generate()` 函数中添加日志打印实际发送的 request body
   - 对比差异找出问题

3. **检查 Vercel 日志**:
```bash
vercel logs taoybeats-clone-6e1jgbjqj-gg13433667537-8214s-projects.vercel.app
```

---

## Git 历史关键节点

- `3ba0bba` - 最后工作的 miniMaxProvider 版本
- `b8df416` - 修复 download 函数 audio 字段
- `2c66c46` - 添加 API 错误码检查

---

## 部署

```bash
npm run lint && npm run build
git add -A && git commit -m "fix: 描述" && git push origin main
# Vercel 会自动部署
```

---

如果需要更多信息或有其他问题，请查看:
- MiniMax API 文档: https://platform.minimaxi.com/docs/api-reference/music-generation
- 项目 README: `/Users/taoyang/Desktop/my-projects/ai-music/README.md`
- CLAUDE.md: `/Users/taoyang/Desktop/my-projects/ai-music/CLAUDE.md`
