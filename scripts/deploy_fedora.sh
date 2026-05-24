#!/usr/bin/env sh
set -eu

SERVER="${AUDITMIND_DEPLOY_SERVER:-popul@fedora}"
REMOTE_DIR="${AUDITMIND_DEPLOY_DIR:-/home/popul/services/auditmind}"

npm run build

rsync -az --delete \
  --exclude .git/ \
  --exclude .env \
  --exclude node_modules/ \
  --exclude dist/ \
  --exclude site/ \
  --exclude test-results/ \
  --exclude playwright-report/ \
  --exclude .npm-cache/ \
  --exclude .pycache/ \
  --exclude .venv_fileproc/ \
  --exclude .venv-paddleocr/ \
  --exclude .paddlex-cache/ \
  --exclude tmp/ \
  --exclude public/uploads/ \
  ./ "$SERVER:$REMOTE_DIR/"

rsync -az --delete \
  --exclude uploads/ \
  dist/ "$SERVER:$REMOTE_DIR/site/"

ssh "$SERVER" "cd '$REMOTE_DIR' && docker compose up -d --build"
ssh "$SERVER" "cd '$REMOTE_DIR' && sh database/apply_local.sh"
ssh "$SERVER" "cd '$REMOTE_DIR' && docker compose restart api web"
ssh "$SERVER" "sleep 3; for i in \$(seq 1 45); do curl -fsS http://127.0.0.1:4174/health >/dev/null && curl -fsS -I http://127.0.0.1:4173/ >/dev/null && exit 0; sleep 1; done; exit 1"
