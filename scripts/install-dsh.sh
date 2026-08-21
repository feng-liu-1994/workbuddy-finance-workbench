#!/usr/bin/env bash
set -euo pipefail

profile="web"
dry_run="false"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile) profile="${2:-}"; shift 2 ;;
    --dry-run) dry_run="true"; shift ;;
    *) echo "未知参数: $1" >&2; exit 2 ;;
  esac
done

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
dsh_base="${DSH_HOME:-$HOME/.dsh}"
profile_dir="$dsh_base/profiles/$profile"
profile_package="$profile_dir/package.json"

command -v node >/dev/null 2>&1 || { echo "需要 Node.js 20+" >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "需要 npm" >&2; exit 1; }
[[ -f "$profile_package" ]] || { echo "未找到 DeepSeek Harness profile: $profile_package" >&2; exit 1; }

node_major="$(node -p "process.versions.node.split('.')[0]")"
[[ "$node_major" -ge 20 ]] || { echo "Node.js 版本过低: $(node --version)" >&2; exit 1; }

echo "仓库: $repo_root"
echo "目标 profile: $profile_dir"
if [[ "$dry_run" == "true" ]]; then
  node -e "const p=require(process.argv[1]); if(!p.dsh?.profile?.bundles) process.exit(2)" "$profile_package"
  echo "预检通过；未修改任何配置。"
  exit 0
fi

cd "$repo_root"
npm install --ignore-scripts
npm run check

timestamp="$(date +%Y%m%d-%H%M%S)"
backup="$profile_package.finance-workbench-backup-$timestamp"
cp "$profile_package" "$backup"
echo "配置已备份: $backup"

node --input-type=module - "$profile_package" "$repo_root" <<'NODE'
import { readFile, writeFile } from 'node:fs/promises'
const packagePath = process.argv[2]
const repoRoot = process.argv[3]
const data = JSON.parse(await readFile(packagePath, 'utf8'))
data.dependencies ||= {}
data.dependencies['dsh-finance-workbench'] = `link:${repoRoot}`
data.dsh ||= {}
data.dsh.profile ||= {}
data.dsh.profile.bundles ||= []
if (!data.dsh.profile.bundles.includes('dsh-finance-workbench')) data.dsh.profile.bundles.push('dsh-finance-workbench')
await writeFile(packagePath, `${JSON.stringify(data, null, 2)}\n`)
NODE

if command -v pnpm >/dev/null 2>&1; then
  pnpm --dir "$profile_dir" install
elif command -v corepack >/dev/null 2>&1; then
  corepack pnpm --dir "$profile_dir" install
else
  echo "配置已写入，但未找到 pnpm。请安装 pnpm 后在 profile 目录执行 pnpm install。" >&2
  exit 1
fi

echo "财务工作台已安装。请先保存当前工作，再重启 DeepSeek Harness 使插件生效。"
