#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "未检测到 Node.js，请先安装 Node.js 20+"
  exit 1
fi

if [ ! -d node_modules ]; then
  npm install
fi

npm run dist:mac:sender

echo "mac sender 打包完成，请查看 release_sender 目录"
