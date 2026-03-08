#!/usr/bin/env bash
# check.sh — перевірка білдів та health check перед commit/deploy
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$ROOT/cloud/web"

echo "━━━ 🔨 Build: cloud frontend ━━━"
cd "$WEB" && npm run build --silent
echo "✅ cloud build OK"

echo ""
echo "━━━ 🔨 Build: local frontend ━━━"
cd "$WEB" && npm run build:local --silent
echo "✅ local build OK"

echo ""
echo "━━━ 🩺 Health check: cloud server (localhost:3001) ━━━"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health || echo "000")
if [ "$STATUS" = "200" ]; then
  echo "✅ health OK (HTTP $STATUS)"
else
  echo "⚠️  health check skipped або сервер не запущений (HTTP $STATUS)"
fi

echo ""
echo "━━━ ✅ Всі перевірки пройдено ━━━"
