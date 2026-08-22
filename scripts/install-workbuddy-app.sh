#!/usr/bin/env bash
set -euo pipefail

dry_run="false"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) dry_run="true"; shift ;;
    *) echo "未知参数: $1" >&2; exit 2 ;;
  esac
done

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
workbuddy_home="${WORKBUDDY_HOME:-$HOME/.workbuddy}"
app_root="$workbuddy_home/apps/finance-workbench"
skill_root="$workbuddy_home/skills/finance-workbench"
config_file="$workbuddy_home/.mcp.json"
node_bin="$(command -v node || true)"

[[ -n "$node_bin" ]] || { echo "请先安装 Node.js 20 或更高版本：https://nodejs.org/" >&2; exit 1; }
node_major="$($node_bin -p "process.versions.node.split('.')[0]")"
[[ "$node_major" -ge 20 ]] || { echo "Node.js 版本过低：$($node_bin --version)，需要 20+" >&2; exit 1; }
[[ -f "$repo_root/workbuddy/server.mjs" && -f "$repo_root/workbuddy/widget.html" ]] || { echo "安装包不完整：缺少 workbuddy/server.mjs 或 widget.html" >&2; exit 1; }
[[ -f "$repo_root/agents/finance-workbench/SKILL.md" ]] || { echo "安装包不完整：缺少 finance-workbench Skill" >&2; exit 1; }

echo "WorkBuddy 目录：$workbuddy_home"
echo "图形工作台：$app_root"
echo "财务 Skill：$skill_root"
if [[ "$dry_run" == "true" ]]; then
  echo "预检通过；未修改任何文件。"
  exit 0
fi

mkdir -p "$workbuddy_home/apps" "$workbuddy_home/skills"
timestamp="$(date +%Y%m%d-%H%M%S)"
if [[ -e "$app_root" ]]; then
  mv "$app_root" "$app_root.backup-$timestamp"
  echo "旧图形工作台已备份：$app_root.backup-$timestamp"
fi
if [[ -e "$skill_root" ]]; then
  mv "$skill_root" "$skill_root.backup-$timestamp"
  echo "旧 Skill 已备份：$skill_root.backup-$timestamp"
fi
mkdir -p "$app_root"
cp "$repo_root/workbuddy/server.mjs" "$repo_root/workbuddy/widget.html" "$app_root/"
cp -R "$repo_root/agents/finance-workbench" "$skill_root"

if [[ -f "$config_file" ]]; then
  cp "$config_file" "$config_file.finance-workbench-backup-$timestamp"
  echo "MCP 配置已备份：$config_file.finance-workbench-backup-$timestamp"
else
  printf '{\n  "mcpServers": {}\n}\n' > "$config_file"
fi

tmp_config="$config_file.finance-workbench-tmp-$timestamp"
"$node_bin" --input-type=module - "$config_file" "$tmp_config" "$node_bin" "$app_root/server.mjs" <<'NODE'
import { readFile, writeFile } from 'node:fs/promises'
const [source, target, nodeBin, server] = process.argv.slice(2)
const config = JSON.parse(await readFile(source, 'utf8'))
config.mcpServers ||= {}
config.mcpServers['finance-workbench'] = {
  command: nodeBin,
  args: [server],
  env: { WORKBUDDY_FINANCE_WORKBENCH: '1' },
}
await writeFile(target, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
NODE
mv "$tmp_config" "$config_file"
chmod 600 "$config_file" 2>/dev/null || true

"$node_bin" --check "$app_root/server.mjs"
echo
echo "安装完成。请先保存 WorkBuddy 中正在编辑的内容，然后完全退出并重新打开 WorkBuddy。"
echo "重新打开后输入：打开财务工作台"
echo "安装器没有读取或上传你的财务数据，也没有替你重启 WorkBuddy。"
