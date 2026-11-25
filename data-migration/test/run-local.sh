#!/usr/bin/env bash
# Teste local de ponta a ponta das ferramentas E4.01, E4.03 e E4.04.
#
# Sobe um MySQL 8.4 em Docker com o schema do legado e a massa FICTÍCIA de
# test/mysql/, copia para o schema legacy de um Postgres local com as funções
# do mci-connect (uma stack local do Supabase) e confere: --dry-run sem
# escrita, cópia, idempotência, checksum, privilégios, saneamento e limpeza.
# No fim, apaga o schema legacy e o contêiner.
#
# Variáveis:
#   PG_PORT      porta do Postgres da stack local (padrão 58322, pista B)
#   MYSQL_IMAGE  imagem do MySQL (padrão mysql:8.4; mirror.gcr.io/library/mysql:8.4 se o Docker Hub limitar)
#   MYSQL_PORT   porta local do MySQL de teste (padrão 53306)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
PG_PORT="${PG_PORT:-58322}"
MYSQL_IMAGE="${MYSQL_IMAGE:-mysql:8.4}"
MYSQL_PORT="${MYSQL_PORT:-53306}"
CONTAINER="mci-dm-test-mysql"
WORK="$(mktemp -d)"
CONFIG="$WORK/test.local.config"
PASTORS="1,2,99999"

cleanup() {
  node "$ROOT/src/clean-legacy.mjs" --config "$CONFIG" --yes >/dev/null 2>&1 || true
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

step() { printf '\n== %s\n' "$*"; }
# check "<descrição>" <comando…>: falha o teste se o comando falhar.
check() {
  local what="$1"; shift
  if "$@"; then echo "ok: $what"; else echo "FALHA: $what"; exit 1; fi
}

cat >"$CONFIG" <<CFG
# Configuração de TESTE: MySQL em Docker e Postgres local. Sem segredo real.
LEGACY_PROD_CONNSTRING="Server=127.0.0.1; Port=${MYSQL_PORT}; Uid=g12; Password=g12pw; Database=g12app; SslMode=Required;"
SUPABASE_PROJECT_REF="gkhnjhmgeceoaqeynhrj"
SUPABASE_HOST="127.0.0.1"
SUPABASE_PORT="${PG_PORT}"
SUPABASE_DB="postgres"
SUPABASE_USER="postgres"
SUPABASE_PASS="postgres"
LEGACY_PASTOR_IDS="${PASTORS}"
CFG

step "MySQL de teste (${MYSQL_IMAGE})"
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" -e MYSQL_ROOT_PASSWORD=rootpw -e MYSQL_DATABASE=g12app \
  -e MYSQL_USER=g12 -e MYSQL_PASSWORD=g12pw -p "127.0.0.1:${MYSQL_PORT}:3306" "$MYSQL_IMAGE" >/dev/null
for _ in $(seq 1 90); do
  if docker exec "$CONTAINER" mysql -ug12 -pg12pw -h127.0.0.1 -e 'SELECT 1' g12app >/dev/null 2>&1; then break; fi
  sleep 2
done
for f in 01-schema.sql 02-fixture.sql; do
  docker exec -i "$CONTAINER" mysql --default-character-set=utf8mb4 -uroot -prootpw g12app <"$HERE/mysql/$f" 2>/dev/null
done
echo "massa carregada"

N="node --no-deprecation"
A="$N $HERE/assert-local.mjs $CONFIG"

step "Unitários"
node --test "$HERE"/unit/*.test.mjs 2>&1 | grep -E '^# (pass|fail)'

step "Limpeza inicial e --dry-run sem schema"
$N "$ROOT/src/clean-legacy.mjs" --config "$CONFIG" --yes >/dev/null
$A no-legacy
$N "$ROOT/src/copy-raw.mjs" --config "$CONFIG" --dry-run >/dev/null
$N "$ROOT/src/clean-legacy.mjs" --config "$CONFIG" --dry-run >/dev/null
$A no-legacy

step "Cópia 1"
$N "$ROOT/src/copy-raw.mjs" --config "$CONFIG" | tail -n 7
FP1="$($A fingerprint)"
$A grants
$A checksum-detects-change

step "--dry-run depois da cópia não muda nada"
$N "$ROOT/src/copy-raw.mjs" --config "$CONFIG" --dry-run >/dev/null
$N "$ROOT/src/sanitation-report.mjs" --config "$CONFIG" --dry-run --out-dir "$WORK/reports" >/dev/null
$N "$ROOT/src/clean-legacy.mjs" --config "$CONFIG" --dry-run >/dev/null
check "nada mudou no banco" test "$($A fingerprint)" = "$FP1"
check "nenhum relatório gravado" test ! -e "$WORK/reports"

step "Cópia 2 (idempotência)"
$N "$ROOT/src/copy-raw.mjs" --config "$CONFIG" >/dev/null
FP2="$($A fingerprint)"
strip_runs() { sed -E 's/,"_copy_runs":[0-9]+//'; }
check "mesmas linhas nas duas cópias" test "$(echo "$FP1" | strip_runs)" = "$(echo "$FP2" | strip_runs)"
RUNS="$(psql "postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/postgres" -Atc \
  "SELECT count(DISTINCT tables::text) = 1 AND count(*) = 2 FROM legacy._copy_runs")"
check "duas execuções registradas, com contagens e checksums iguais" test "$RUNS" = t

step "Falha no meio da cópia desfaz tudo"
my() { docker exec -i "$CONTAINER" mysql -uroot -prootpw g12app -e "$1" 2>/dev/null; }
my "ALTER TABLE Reports ADD COLUMN ExtraTime time NULL; UPDATE Reports SET ExtraTime = '30:00:00' WHERE Id = 1;"
if $N "$ROOT/src/copy-raw.mjs" --config "$CONFIG" >"$WORK/fail.log" 2>&1; then
  echo "FALHA: a cópia deveria ter falhado"; exit 1
fi
grep -E '^(AVISO: Coluna|ERRO)' "$WORK/fail.log"
check "o destino ficou como estava" test "$($A fingerprint)" = "$FP2"
my "ALTER TABLE Reports DROP COLUMN ExtraTime;"

step "Saneamento"
$A sanitation "$PASTORS"
$N "$ROOT/src/sanitation-report.mjs" --config "$CONFIG" --out-dir "$WORK/reports" | tail -n 1
REPORT="$(ls "$WORK"/reports/saneamento-*.md)"
for pii in Ficticio exemplo.org 52998224725 99999-0002; do
  if grep -q "$pii" "$REPORT"; then echo "FALHA: relatório contém dado pessoal ($pii)"; exit 1; fi
done
echo "ok: relatório sem dados pessoais da massa"

step "Limpeza final"
$N "$ROOT/src/clean-legacy.mjs" --config "$CONFIG" --yes | tail -n 1
$A no-legacy

printf '\nTudo certo.\n'
