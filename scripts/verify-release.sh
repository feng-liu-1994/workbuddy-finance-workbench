#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
cd "$repo_root"

bash -n scripts/install-agent.sh
bash -n scripts/uninstall-agent.sh
bash -n scripts/install-dsh.sh
bash -n scripts/install-workbuddy-app.sh
bash -n scripts/uninstall-workbuddy-app.sh
bash -n "安装 WorkBuddy 财务工作台.command"
bash -n "卸载 WorkBuddy 财务工作台.command"
node --check scripts/generate-agent-catalog.mjs
node --check scripts/security-scan.mjs
npm run check
node -e "const c=require('./agents/finance-workbench/references/workflows.json'); if(c.workflows.length!==25) process.exit(1)"
test -f workbuddy/server.mjs
test -f workbuddy/widget.html
test -f .codebuddy-plugin/plugin.json
test -f docs/INSTALL_WORKBUDDY.md
test -f docs/images/readme-hero.png
test -f docs/images/dashboard-desktop.png
test -f docs/images/dashboard-mobile.png
test -f docs/images/exception-control.png

fixture_home="$(mktemp -d "${TMPDIR:-/tmp}/finance-workbench-install.XXXXXX")"
trap 'find "$fixture_home" -depth -delete 2>/dev/null || true' EXIT
mkdir -p "$fixture_home"
printf '{"mcpServers":{"keep-existing":{"command":"fixture"}}}\n' > "$fixture_home/.mcp.json"
WORKBUDDY_HOME="$fixture_home" bash scripts/install-workbuddy-app.sh
node -e "const c=require(process.argv[1]); if(!c.mcpServers['keep-existing']||!c.mcpServers['finance-workbench']) process.exit(1)" "$fixture_home/.mcp.json"
test -f "$fixture_home/apps/finance-workbench/server.mjs"
test -f "$fixture_home/skills/finance-workbench/SKILL.md"
WORKBUDDY_HOME="$fixture_home" bash scripts/uninstall-workbuddy-app.sh
node -e "const c=require(process.argv[1]); if(!c.mcpServers['keep-existing']||c.mcpServers['finance-workbench']) process.exit(1)" "$fixture_home/.mcp.json"

npm pack --ignore-scripts --dry-run >/dev/null
echo "release verification passed"
