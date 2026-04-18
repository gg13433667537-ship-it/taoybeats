#!/bin/bash
# TaoyBeats Start Script - 绕过代理连接 MiniMax API
# 问题原因：系统代理（Clash）会阻断 api.minimaxi.com 的连接
# 解决方式：启动时清除代理环境变量

# 清除所有代理设置
unset https_proxy http_proxy all_proxy ALL_PROXY HttpProxy HttpsProxy AllProxy

# 确保 MiniMax API 不走代理
export NO_PROXY="api.minimaxi.com,api.minimax.com,localhost,127.0.0.1"
export no_proxy="api.minimaxi.com,api.minimax.com,localhost,127.0.0.1"

# 启动服务器
cd "$(dirname "$0")"
npm run dev
