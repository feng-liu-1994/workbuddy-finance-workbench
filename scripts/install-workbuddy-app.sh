#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node_bin="$(command -v node || true)"
[[ -n "$node_bin" ]] || { echo "请先安装 Node.js 20+：https://nodejs.org/" >&2; exit 1; }
exec "$node_bin" "$script_dir/workbuddy-install.mjs" install "$@"
