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
ssh "$SERVER" "for i in 1 2 3 4 5 6 7 8 9 10; do curl -fsS http://127.0.0.1:4174/health >/dev/null && break; sleep 1; done"
ssh "$SERVER" "curl -fsS http://127.0.0.1:4174/health >/dev/null && curl -fsS -I http://127.0.0.1:4173/ >/dev/null"
