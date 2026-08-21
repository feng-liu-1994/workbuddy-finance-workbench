#!/usr/bin/env bash
set -euo pipefail

target="${1:-workbuddy}"
custom_root="${2:-}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
source_dir="$repo_root/agents/finance-workbench"

case "$target" in
  workbuddy) destination_root="${WORKBUDDY_HOME:-$HOME/.workbuddy}/skills" ;;
  codex) destination_root="${CODEX_HOME:-$HOME/.codex}/skills" ;;
  claude) destination_root="${CLAUDE_HOME:-$HOME/.claude}/skills" ;;
  custom)
    if [[ -z "$custom_root" ]]; then
      echo "用法: $0 custom /你的/Agent/skills目录" >&2
      exit 2
    fi
    destination_root="$custom_root"
    ;;
  *)
    echo "未知目标: $target（可选: workbuddy、codex、claude、custom）" >&2
    exit 2
    ;;
esac

if [[ ! -f "$source_dir/SKILL.md" ]]; then
  echo "未找到 Agent Skill: $source_dir" >&2
  exit 1
fi

mkdir -p "$destination_root"
destination="$destination_root/finance-workbench"
if [[ -e "$destination" ]]; then
  timestamp="$(date +%Y%m%d-%H%M%S)"
  backup="$destination_root/finance-workbench.backup-$timestamp"
  mv "$destination" "$backup"
  echo "旧版已备份到: $backup"
fi

cp -R "$source_dir" "$destination"
test -f "$destination/SKILL.md"
test -f "$destination/references/workflows.json"
echo "安装完成: $destination"
echo "请重新打开 ${target}，然后明确说：请使用 finance-workbench。"
