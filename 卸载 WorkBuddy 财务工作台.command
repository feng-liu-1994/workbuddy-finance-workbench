#!/bin/bash
set -e
script_dir="$(cd "$(dirname "$0")" && pwd)"
clear
echo "WorkBuddy 财务工作台 · 安全卸载"
echo "================================"
bash "$script_dir/scripts/uninstall-workbuddy-app.sh"
echo
read -r -p "按回车键关闭窗口…" _
