#!/bin/bash
set -e
script_dir="$(cd "$(dirname "$0")" && pwd)"
clear
echo "WorkBuddy 财务工作台 · 一键安装"
echo "================================"
bash "$script_dir/scripts/install-workbuddy-app.sh"
echo
read -r -p "按回车键关闭窗口…" _
