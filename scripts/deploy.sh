#!/usr/bin/env bash
# deploy.sh — перевірка, commit (якщо є зміни), rsync на сервер, rebuild, health check
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER="root@mytracking.com.ua"
SERVER_PATH="/root/project/home-hub"
SSH_KEY="$HOME/.ssh/id_ed25519"
DOCKER_COMPOSE="/usr/local/bin/docker-compose-v2"

echo "━━━ 🔨 Перевірка білдів ━━━"
bash "$ROOT/scripts/check.sh"

echo ""
echo "━━━ 📦 Rsync на сервер ━━━"
rsync -avz --exclude 'node_modules' --exclude '.env' --exclude 'dist' \
  -e "ssh -i $SSH_KEY" \
  "$ROOT/cloud/" \
  "$SERVER:$SERVER_PATH/"
echo "✅ Файли синхронізовано"

echo ""
echo "━━━ 🐳 Rebuild + restart на сервері ━━━"
ssh -i "$SSH_KEY" "$SERVER" \
  "cd $SERVER_PATH && $DOCKER_COMPOSE up -d --build server web"
echo "✅ Контейнери перезапущено"

echo ""
echo "━━━ 🩺 Health check: production ━━━"
sleep 5
STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://mytracking.com.ua/api/health || echo "000")
if [ "$STATUS" = "200" ]; then
  echo "✅ Production health OK (HTTP $STATUS)"
else
  echo "❌ Production health FAIL (HTTP $STATUS)"
  exit 1
fi

echo ""
echo "━━━ ✅ Deploy завершено ━━━"
