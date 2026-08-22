#!/usr/bin/env bash
set -euo pipefail

workbuddy_home="${WORKBUDDY_HOME:-$HOME/.workbuddy}"
app_root="$workbuddy_home/apps/finance-workbench"
skill_root="$workbuddy_home/skills/finance-workbench"
config_file="$workbuddy_home/.mcp.json"
node_bin="$(command -v node || true)"
timestamp="$(date +%Y%m%d-%H%M%S)"

[[ -n "$node_bin" ]] || { echo "需要 Node.js 20+ 才能安全更新配置" >&2; exit 1; }
if [[ -f "$config_file" ]]; then
  cp "$config_file" "$config_file.finance-workbench-uninstall-backup-$timestamp"
  tmp_config="$config_file.finance-workbench-tmp-$timestamp"
  "$node_bin" --input-type=module - "$config_file" "$tmp_config" <<'NODE'
import { readFile, writeFile } from 'node:fs/promises'
const [source, target] = process.argv.slice(2)
const config = JSON.parse(await readFile(source, 'utf8'))
if (config.mcpServers) delete config.mcpServers['finance-workbench']
await writeFile(target, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
NODE
  mv "$tmp_config" "$config_file"
  chmod 600 "$config_file" 2>/dev/null || true
fi

for target in "$app_root" "$skill_root"; do
  if [[ -e "$target" ]]; then
    mv "$target" "$target.uninstalled-$timestamp"
    echo "已移出并保留可恢复副本：$target.uninstalled-$timestamp"
  fi
done
echo "卸载完成。保存当前工作后重启 WorkBuddy 即可生效。"
