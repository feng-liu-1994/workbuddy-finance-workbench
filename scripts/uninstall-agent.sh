#!/usr/bin/env bash
set -euo pipefail

target="${1:-workbuddy}"
custom_root="${2:-}"
case "$target" in
  workbuddy) destination_root="${WORKBUDDY_HOME:-$HOME/.workbuddy}/skills" ;;
  codex) destination_root="${CODEX_HOME:-$HOME/.codex}/skills" ;;
  claude) destination_root="${CLAUDE_HOME:-$HOME/.claude}/skills" ;;
  custom) destination_root="$custom_root" ;;
  *) echo "未知目标: $target" >&2; exit 2 ;;
esac

if [[ -z "$destination_root" ]]; then
  echo "自定义目录不能为空" >&2
  exit 2
fi

destination="$destination_root/finance-workbench"
if [[ ! -e "$destination" ]]; then
  echo "未发现已安装技能: $destination"
  exit 0
fi

timestamp="$(date +%Y%m%d-%H%M%S)"
backup="$destination_root/finance-workbench.uninstalled-$timestamp"
mv "$destination" "$backup"
echo "已从技能目录移出，保留在: $backup"
