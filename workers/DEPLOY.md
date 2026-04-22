# Cloudflare Workers 反向代理部署指南

## 目标

将 `xxx.workers.dev` 的请求反向代理到 Vercel (`taoybeats-clone.vercel.app`)，
让中国用户无需翻墙即可访问网站。

## 前提

1. 一个 Cloudflare 账号（免费注册）
2. 本目录下的两个文件：
   - `reverse-proxy.js` — Worker 脚本
   - `wrangler.toml` — 部署配置

## 方案 A：Dashboard 界面部署（最简单，推荐）

1. 登录 https://dash.cloudflare.com
2. 左侧菜单 → **Workers & Pages** → **Create**
3. 选择 **Create Worker**
4. 给 Worker 起个名字，比如 `taoybeats-proxy`
5. 点击 **Deploy**（先部署默认代码）
6. 部署完成后，点击 **Edit Code**
7. 把 `reverse-proxy.js` 的内容全部复制进去，替换原有代码
8. 点击 **Save and Deploy**
9. 你的代理地址就是：
   ```
   https://taoybeats-proxy.xxx.workers.dev
   ```
   （`xxx` 是你账号的子域）

## 方案 B：Wrangler CLI 部署

```bash
# 1. 安装 wrangler
npm install -g wrangler

# 2. 登录 Cloudflare
wrangler login

# 3. 进入 workers 目录
cd workers

# 4. 部署
wrangler deploy
```

## 验证

部署完成后，在浏览器访问：

```
https://taoybeats-proxy.xxx.workers.dev
```

应该能看到和访问 `https://taoybeats-clone.vercel.app` 一样的页面。

## 注意事项

1. **免费额度**：Cloudflare Workers 免费版每天 100,000 次请求，对大多数个人项目够用
2. **自定义域名**：如果你有域名，可以在 Cloudflare Dashboard 中给 Worker 绑定自定义域名（不需要备案，因为服务器在海外）
3. **Cookie/Session**：反向代理会透传 Cookie，登录态可以正常工作
4. **WebSocket**：如果需要实时功能，Workers 也支持 WebSocket 代理（当前项目未使用）
5. **中国大陆可用性**：`workers.dev` 目前在中国大陆大多数情况下可以访问，但不保证 100% 稳定。如果某天也被干扰，需要换其他方案

## 备选方案

如果 `workers.dev` 未来不可用：
- **Cloudflare Pages**：将项目同时部署到 `xxx.pages.dev`
- **Vercel 自定义域名**：买一个便宜域名绑定到 Vercel，部分未备案域名也可能被墙
- **Railway / Render**：其他海外平台，域名可能不同
