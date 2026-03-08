#!/usr/bin/env bash
# deploy-local.sh — оновлення локального домашнього сервера
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOME_SERVER="alex@192.168.1.34"
SERVER_PATH="~/home-hub"

echo "━━━ 🔨 Перевірка білду ━━━"
bash "$ROOT/scripts/check.sh"

echo ""
echo "━━━ 📦 Git pull на домашньому сервері ━━━"
ssh "$HOME_SERVER" "cd $SERVER_PATH && git pull"
echo "✅ Код оновлено"

echo ""
echo "━━━ 🐳 Rebuild + restart ━━━"
ssh "$HOME_SERVER" "cd $SERVER_PATH/local && docker compose up -d --build server"
echo "✅ Контейнер перезапущено"

echo ""
echo "━━━ 🩺 Health check: local server ━━━"
sleep 4
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://192.168.1.34:3002/api/status || echo "000")
if [ "$STATUS" = "200" ]; then
  echo "✅ Local health OK (HTTP $STATUS)"
  curl -s http://192.168.1.34:3002/api/status | python3 -m json.tool 2>/dev/null || true
else
  echo "❌ Local health FAIL (HTTP $STATUS)"
  ssh "$HOME_SERVER" "cd $SERVER_PATH/local && docker compose logs server --tail=20"
  exit 1
fi

echo ""
echo "━━━ ✅ Deploy local завершено ━━━"
