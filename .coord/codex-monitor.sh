#!/bin/bash
# Codex 任务监控脚本
# 用法：在 Codex 终端运行: bash .coord/codex-monitor.sh

cd "$(dirname "$0")/.." || exit 1

echo "=== Codex 任务监控已启动 ==="
echo "监控文件: .coord/CODEX_TASKS.md"
echo "结果文件: .coord/CODEX_RESULTS.md"
echo ""

while true; do
  # 检查是否有未完成的任务
  if [ -f ".coord/CODEX_TASKS.md" ]; then
    # 获取第一行未完成的任务（跳过 DONE 部分）
    task=$(grep -A 20 "### T-" .coord/CODEX_TASKS.md | grep -v "DONE" | grep "### T-" | head -1)

    if [ -n "$task" ]; then
      taskId=$(echo "$task" | sed 's/### \(T-CODEX-[0-9]*\).*/\1/')
      echo "[$(date)] 检测到新任务: $taskId"

      # 读取任务描述和涉及文件
      echo "开始执行任务..."

      # 这里 Codex 应该读取任务详情并执行
      # 临时方案：打印任务信息，让 Codex 手动处理
      echo "请 Codex 读取以下任务并执行："
      echo "---"
      grep -A 30 "$taskId" .coord/CODEX_TASKS.md | head -25
      echo "---"
      echo ""

      # 实际执行应该在这里
      # Codex 需要实现实际的任务执行逻辑
    fi
  fi

  sleep 10  # 每 10 秒检查一次
done
