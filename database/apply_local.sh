#!/usr/bin/env sh
set -eu

DB_SERVICE="${AUDITMIND_DB_SERVICE:-db}"
DB_NAME="${AUDITMIND_DB_NAME:-auditmind}"
DB_USER="${AUDITMIND_DB_USER:-auditmind}"

until docker compose exec -T "$DB_SERVICE" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; do
  sleep 1
done

docker compose exec -T "$DB_SERVICE" \
  psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" \
  -f /workspace/database/migrations/001_document_type_master.sql

docker compose exec -T "$DB_SERVICE" \
  psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" \
  -f /workspace/database/migrations/002_request_template_master.sql

docker compose exec -T "$DB_SERVICE" \
  psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" \
  -f /workspace/database/migrations/003_customer_master.sql

docker compose exec -T "$DB_SERVICE" \
  psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" \
  -f /workspace/database/migrations/004_submission_review_notes.sql

docker compose exec -T "$DB_SERVICE" \
  psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" \
  -f /workspace/database/migrations/005_customer_portal_runtime.sql

docker compose exec -T "$DB_SERVICE" \
  psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" \
  -f /workspace/database/migrations/006_document_type_dedupe.sql

docker compose exec -T "$DB_SERVICE" \
  psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" \
  -f /workspace/database/migrations/007_app_runtime_state.sql

docker compose exec -T "$DB_SERVICE" \
  psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" \
  -f /workspace/database/migrations/008_submission_request_customer_link.sql

docker compose exec -T "$DB_SERVICE" \
  psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" \
  -f /workspace/database/seeds/001_document_type_seed.sql

docker compose exec -T "$DB_SERVICE" \
  psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" \
  -f /workspace/database/seeds/002_document_required_fields_seed.sql

docker compose exec -T "$DB_SERVICE" \
  psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" \
  -f /workspace/database/seeds/003_request_template_seed.sql

docker compose exec -T "$DB_SERVICE" \
  psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" \
  -f /workspace/database/seeds/004_request_template_document_seed.sql

docker compose exec -T "$DB_SERVICE" \
  psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" \
  -f /workspace/database/seeds/005_customer_seed.sql

docker compose exec -T "$DB_SERVICE" \
  psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" \
  -f /workspace/database/seeds/006_accountant_review_seed.sql

docker compose exec -T "$DB_SERVICE" \
  psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" \
  -f /workspace/database/seeds/007_customer_portal_demo_seed.sql

docker compose exec -T "$DB_SERVICE" \
  psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" \
  -f /workspace/database/seeds/008_app_runtime_seed.sql
