#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
cd "$repo_root"

version="$(node -p "require('./package.json').version")"
timestamp="$(date +%Y%m%d-%H%M%S)"
if [[ -e release ]]; then mv release "release.backup-$timestamp"; fi
mkdir -p release
stage="$(mktemp -d "${TMPDIR:-/tmp}/finance-workbench-release.XXXXXX")"
trap 'find "$stage" -depth -delete 2>/dev/null || true' EXIT

npm run verify:release

mac="$stage/workbuddy-finance-workbench-macos"
mkdir -p "$mac/scripts"
cp -R workbuddy agents "$mac/"
cp -R docs "$mac/"
cp scripts/workbuddy-install.mjs scripts/install-workbuddy-app.sh scripts/uninstall-workbuddy-app.sh "$mac/scripts/"
cp "安装 WorkBuddy 财务工作台.command" "卸载 WorkBuddy 财务工作台.command" README.md LICENSE "$mac/"
chmod +x "$mac/scripts/"*.sh "$mac/"*.command
(cd "$stage" && zip -qry "$repo_root/release/workbuddy-finance-workbench-macos.zip" "$(basename "$mac")")

windows="$stage/workbuddy-finance-workbench-windows"
mkdir -p "$windows/scripts"
cp -R workbuddy agents "$windows/"
cp -R docs "$windows/"
cp scripts/workbuddy-install.mjs scripts/install-workbuddy-app.ps1 scripts/uninstall-workbuddy-app.ps1 "$windows/scripts/"
cp README.md LICENSE "$windows/"
(cd "$stage" && zip -qry "$repo_root/release/workbuddy-finance-workbench-windows.zip" "$(basename "$windows")")

agent="$stage/finance-workbench"
cp -R agents/finance-workbench "$agent"
(cd "$stage" && zip -qry "$repo_root/release/finance-workbench-agent-v${version}.zip" "$(basename "$agent")")

npm pack --ignore-scripts --pack-destination release >/dev/null
(
  cd release
  shasum -a 256 "workbuddy-finance-workbench-macos.zip" "workbuddy-finance-workbench-windows.zip" "finance-workbench-agent-v${version}.zip" "dsh-finance-workbench-${version}.tgz" > SHA256SUMS.txt
)

echo "发布包已生成：$repo_root/release"
ls -lh release
