#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
cd "$repo_root"

bash -n scripts/install-agent.sh
bash -n scripts/uninstall-agent.sh
bash -n scripts/install-dsh.sh
node --check scripts/generate-agent-catalog.mjs
node --check scripts/security-scan.mjs
npm run check
node -e "const c=require('./agents/finance-workbench/references/workflows.json'); if(c.workflows.length!==25) process.exit(1)"
test -f docs/images/dashboard-desktop.png
test -f docs/images/dashboard-mobile.png
npm pack --dry-run >/dev/null
echo "release verification passed"
