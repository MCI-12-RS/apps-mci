#!/usr/bin/env bash
# QA da carga (E4 PR 2): MySQL 8.4 em Docker + stack local da pista B. Só teste, dados fictícios.
#   bash test/qa/run-qa.sh [arquivo.test.mjs …]
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PG_PORT="${PG_PORT:-58322}"
MYSQL_IMAGE="${MYSQL_IMAGE:-mysql:8.4}"
MYSQL_PORT="${QA_MYSQL_PORT:-53307}"
export QA_MYSQL_CONTAINER="mci-dm-qa-mysql"
WORK="$(mktemp -d)"
export QA_CONFIG="$WORK/qa.local.config"
cat >"$QA_CONFIG" <<CFG
LEGACY_PROD_CONNSTRING="Server=127.0.0.1; Port=${MYSQL_PORT}; Uid=g12; Password=g12pw; Database=g12app; SslMode=Required;"
SUPABASE_PROJECT_REF="gkhnjhmgeceoaqeynhrj"
SUPABASE_HOST="127.0.0.1"
SUPABASE_PORT="${PG_PORT}"
SUPABASE_DB="postgres"
SUPABASE_USER="postgres"
SUPABASE_PASS="postgres"
LEGACY_PASTOR_IDS="1"
LEGACY_ADMIN_IDS="1,2"
LEGACY_APP_URL="https://legado.invalid"
CFG
cleanup() {
  node --no-deprecation "$ROOT/test/assert-load.mjs" "$QA_CONFIG" reset >/dev/null 2>&1 || true
  node --no-deprecation "$ROOT/src/clean-legacy.mjs" --config "$QA_CONFIG" --yes >/dev/null 2>&1 || true
  docker rm -f "$QA_MYSQL_CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$WORK" /tmp/claude-0/qa-reports
}
trap cleanup EXIT
docker rm -f "$QA_MYSQL_CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$QA_MYSQL_CONTAINER" -e MYSQL_ROOT_PASSWORD=rootpw -e MYSQL_DATABASE=g12app \
  -e MYSQL_USER=g12 -e MYSQL_PASSWORD=g12pw -p "127.0.0.1:${MYSQL_PORT}:3306" "$MYSQL_IMAGE" >/dev/null
for _ in $(seq 1 90); do
  docker exec "$QA_MYSQL_CONTAINER" mysql -ug12 -pg12pw -h127.0.0.1 -e 'SELECT 1' g12app >/dev/null 2>&1 && break
  sleep 2
done
docker exec -i "$QA_MYSQL_CONTAINER" mysql --default-character-set=utf8mb4 -uroot -prootpw g12app <"$ROOT/test/mysql/01-schema.sql" 2>/dev/null
cd "$ROOT"
FILES=("$@"); [ ${#FILES[@]} -eq 0 ] && FILES=(test/qa/*.test.mjs)
node --no-deprecation --test --test-concurrency=1 --test-reporter=spec "${FILES[@]}"
