#!/usr/bin/env bash
# Teste local de ponta a ponta das ferramentas E4.01, E4.03, E4.04 e da carga (E4.06/E4.07).
#
# Sobe um MySQL 8.4 em Docker com o schema do legado e a massa FICTÍCIA de
# test/mysql/, copia para o schema legacy de um Postgres local com as funções
# do mci-connect (uma stack local do Supabase) e confere: --dry-run sem
# escrita, cópia, idempotência, checksum, privilégios, saneamento, carga
# (adoção, ambiguidade, --final, --dry-run, idempotência, mudança no legado,
# conflitos com o novo, volume) e limpeza.
# No fim, tira a carga (só teste), apaga o schema legacy e o contêiner.
#
# Variáveis:
#   PG_PORT      porta do Postgres da stack local (padrão 58322, pista B)
#   MYSQL_IMAGE  imagem do MySQL (padrão mysql:8.4; mirror.gcr.io/library/mysql:8.4 se o Docker Hub limitar)
#   MYSQL_PORT   porta local do MySQL de teste (padrão 53306)
#   LOAD_VOLUME  0 pula a medição de volume da carga (padrão 1)
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
  node "$HERE/assert-load.mjs" "$CONFIG" reset >/dev/null 2>&1 || true
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
LEGACY_ADMIN_IDS="1,2,3"
LEGACY_APP_URL="https://legado.invalid"
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
L="$N $HERE/assert-load.mjs $CONFIG"
LOAD="$N $ROOT/src/load.mjs --config $CONFIG --out-dir $WORK/load-reports"
# expect_fail "<descrição>" "<texto esperado na saída>" <comando…>: o comando precisa falhar e citar o texto.
expect_fail() {
  local what="$1" text="$2"; shift 2
  set +e; "$@" >"$WORK/fail-cmd.log" 2>&1; local st=$?; set -e
  if [ "$st" -ne 0 ] && grep -q -- "$text" "$WORK/fail-cmd.log"; then echo "ok: $what"; else
    cat "$WORK/fail-cmd.log"; echo "FALHA: $what (status $st)"; exit 1; fi
}

step "Unitários"
node --test "$HERE"/unit/*.test.mjs 2>&1 | grep -E '^# (pass|fail)'

step "Limpeza inicial e --dry-run sem schema"
$L reset >/dev/null
$N "$ROOT/src/clean-legacy.mjs" --config "$CONFIG" --yes >/dev/null
$A no-legacy
$N "$ROOT/src/copy-raw.mjs" --config "$CONFIG" --dry-run >/dev/null
$N "$ROOT/src/clean-legacy.mjs" --config "$CONFIG" --dry-run >/dev/null
$A no-legacy

step "Cópia 1"
if ! $N "$ROOT/src/copy-raw.mjs" --config "$CONFIG" >"$WORK/copy1.log" 2>&1; then
  cat "$WORK/copy1.log"; echo "FALHA: cópia 1"; exit 1
fi
grep -vE '^AVISO: o certificado' "$WORK/copy1.log" | tail -n 8
check "tinyint(1) fora de 0 e 1 avisado e contado" grep -q 'Members: 1 valores tinyint(1)' "$WORK/copy1.log"
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
# 5 mil relatórios fictícios a mais (com 4 KB de texto cada, cerca de 20 MB),
# para o stream ficar pausado no meio quando a falha acontece.
my "SET SESSION cte_max_recursion_depth = 10000;
    INSERT INTO Reports (Id, CellId, Date, Notes, NumMembers, Contribution, WeekCellSkipped, LeadershipId, HostId, TimothyId, IsDeleted)
    WITH RECURSIVE s (n) AS (SELECT 1000 UNION ALL SELECT n + 1 FROM s WHERE n < 5999)
    SELECT n, 1, '2020-01-01 20:00:00', REPEAT('x', 4000), 0, 0, 0, 3, 6, 5, 1 FROM s;"
# --batch-size 1: a falha acontece com o stream do MySQL ainda pela metade
# (o script não pode ficar parado esperando o legado).
TIMEOUT=""
if command -v timeout >/dev/null; then TIMEOUT="timeout 60"; elif command -v gtimeout >/dev/null; then TIMEOUT="gtimeout 60"; fi
set +e
$TIMEOUT $N "$ROOT/src/copy-raw.mjs" --config "$CONFIG" --batch-size 1 >"$WORK/fail.log" 2>&1
STATUS=$?
set -e
check "a cópia falhou sem travar (status $STATUS)" test "$STATUS" -ne 0 -a "$STATUS" -ne 124
grep -E '^(AVISO: Coluna|ERRO)' "$WORK/fail.log" || true
check "o erro foi impresso" grep -q '^ERRO: \[22008\]' "$WORK/fail.log"
check "o destino ficou como estava" test "$($A fingerprint)" = "$FP2"
my "ALTER TABLE Reports DROP COLUMN ExtraTime;"

step "Conexão com o legado perdida no meio do stream"
# Com --batch-size 1, a leitura dos 5 mil relatórios leva alguns segundos;
# a conexão da cópia é derrubada no meio dela.
set +e
$TIMEOUT $N "$ROOT/src/copy-raw.mjs" --config "$CONFIG" --batch-size 1 >"$WORK/kill.log" 2>&1 &
COPY_PID=$!
KILLED=""
for _ in $(seq 1 300); do
  # Cells já conferida: a cópia está lendo Reports (a última tabela grande).
  if grep -q 'legacy.Cells:' "$WORK/kill.log" 2>/dev/null; then
    for CONN in $(docker exec "$CONTAINER" mysql -N -uroot -prootpw -e \
        "SELECT id FROM information_schema.PROCESSLIST WHERE USER = 'g12'" 2>/dev/null); do
      my "KILL $CONN"; KILLED=1
    done
    break
  fi
  sleep 0.1
done
wait "$COPY_PID"
STATUS=$?
set -e
check "a conexão da cópia foi derrubada" test -n "$KILLED"
check "a cópia falhou sem travar (status $STATUS)" test "$STATUS" -ne 0 -a "$STATUS" -ne 124
grep -E '^ERRO' "$WORK/kill.log" || true
check "o destino ficou como estava" test "$($A fingerprint)" = "$FP2"
my "DELETE FROM Reports WHERE Id >= 1000;"

step "Saneamento"
$A sanitation "$PASTORS"
$N "$ROOT/src/sanitation-report.mjs" --config "$CONFIG" --out-dir "$WORK/reports" | tail -n 1
REPORT="$(ls "$WORK"/reports/saneamento-*.md)"
for pii in Ficticio exemplo.org 52998224725 99999-0002; do
  if grep -q "$pii" "$REPORT"; then echo "FALHA: relatório contém dado pessoal ($pii)"; exit 1; fi
done
echo "ok: relatório sem dados pessoais da massa"
check "link para o membro ativo com líder excluído" grep -q '\[27\](https://legado.invalid/members/27) | líder excluído: 28' "$REPORT"
check "sem link para o membro excluído (lista com observação)" grep -q '^| 43 | excluído |' "$REPORT"
check "sem link para o membro excluído (lista simples)" grep -q '^Ids do legado: 45$' "$REPORT"
check "nenhum link para excluído" test -z "$(grep -E '\[(43|44|45)\]\(' "$REPORT")"
check "sem link para Id que não existe" grep -q '^| 99999 | não existe |' "$REPORT"

step "Carga: destino com cadastros do novo (adoção)"
$L reset
$L seed-new
FPN="$($L fingerprint)"

step "Carga: --dry-run não grava nada"
$LOAD --dry-run >"$WORK/load-dry.log" 2>&1 || { cat "$WORK/load-dry.log"; echo "FALHA: --dry-run"; exit 1; }
tail -n 3 "$WORK/load-dry.log"
check "nada mudou no destino" test "$($L fingerprint)" = "$FPN"
check "nenhum relatório de carga gravado" test ! -e "$WORK/load-reports"
for pii in Ficticio exemplo.org 52998224725 99999-0002 Novo; do
  if grep -q "$pii" "$WORK/load-dry.log"; then echo "FALHA: saída da carga contém dado pessoal ($pii)"; exit 1; fi
done
echo "ok: saída da carga sem dados pessoais da massa"

step "Carga: coincidência ambígua para a carga"
$L seed-ambiguous
FPA="$($L fingerprint)"
expect_fail "ambiguidade para nos dois modos" "adoption_ambiguous" $LOAD
check "nada mudou no destino" test "$($L fingerprint)" = "$FPA"
grep -E 'adoption_ambiguous' "$WORK/fail-cmd.log"
$L unseed-ambiguous
FPN="$($L fingerprint)"   # a Auditoria registrou o cadastro e a saída do ambíguo

step "Carga: --final para nas pendências \"corrigir no legado\""
expect_fail "--final --dry-run para" "Carga interrompida antes de gravar" $LOAD --final --dry-run
for code in member_email_duplicate member_leader_cycle member_spouse_not_reciprocal cell_time_invalid cell_person_deleted pastor_config_invalid; do
  check "--final cita $code" grep -q "$code.*PARA A CARGA" "$WORK/fail-cmd.log"
done
expect_fail "--final para sem Administradores suficientes" "admins_below_minimum" $LOAD --final --admin-ids 99998
check "nada mudou no destino" test "$($L fingerprint)" = "$FPN"

step "Carga 1 (ensaio)"
$LOAD >"$WORK/load1.log" 2>&1 || { cat "$WORK/load1.log"; echo "FALHA: carga 1"; exit 1; }
tail -n 8 "$WORK/load1.log"
$L expected
$L lists-empty
REPORT="$(ls "$WORK"/load-reports/carga-*.md)"
for pii in Ficticio exemplo.org 52998224725 99999-0002 Novo; do
  if grep -q "$pii" "$REPORT"; then echo "FALHA: relatório de carga contém dado pessoal ($pii)"; exit 1; fi
done
echo "ok: relatório de carga sem dados pessoais da massa"
$A grants
FPL="$($L fingerprint)"

step "Carga 2 (idempotência)"
$LOAD >"$WORK/load2.log" 2>&1 || { cat "$WORK/load2.log"; echo "FALHA: carga 2"; exit 1; }
$L unchanged
check "o destino ficou igual" test "$($L fingerprint)" = "$FPL"

step "Carga 3: o legado mudou"
$L legacy-change
$LOAD >"$WORK/load3.log" 2>&1 || { cat "$WORK/load3.log"; echo "FALHA: carga 3"; exit 1; }
$L legacy-change-check
$L lists-empty

step "Carga: conflitos com cadastros do novo param a carga"
$L conflict-setup
FPC="$($L fingerprint)"
expect_fail "identificador de um cadastro do novo" "identifier_conflict_new" $LOAD
check "a semana com relatório lançado no novo também é citada" grep -q "report_week_conflict_new" "$WORK/fail-cmd.log"
check "nada mudou no destino" test "$($L fingerprint)" = "$FPC"
$L conflict-teardown
$LOAD >/dev/null 2>&1 || { echo "FALHA: carga depois dos conflitos"; exit 1; }
$L lists-empty

step "Limpeza do staging recusa com carga no destino"
expect_fail "clean --yes recusa" "carga no destino" $N "$ROOT/src/clean-legacy.mjs" --config "$CONFIG" --yes
$A grants

if [ "${LOAD_VOLUME:-1}" != 0 ]; then
  step "Carga: volume (3 mil membros, 300 células, 30 mil relatórios)"
  $L reset
  psql "postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/postgres" -X -q -v ON_ERROR_STOP=1 -f "$HERE/volume/legacy-volume.sql"
  for run in dry-run 1 2; do
    ARGS=""; [ "$run" = dry-run ] && ARGS="--dry-run"
    $LOAD $ARGS --pastor-ids 1,2 --admin-ids 1,2 >"$WORK/vol.log" 2>&1 || { cat "$WORK/vol.log"; echo "FALHA: volume ($run)"; exit 1; }
    echo "volume ($run): $(grep -E '^Tempo:' "$WORK/vol.log")"
  done
  grep -E '^(Membros|Células|Relatórios|Participantes|Funções):' "$WORK/vol.log"
  $L unchanged
  $L lists-empty
fi

step "Limpeza final"
$L reset
$N "$ROOT/src/clean-legacy.mjs" --config "$CONFIG" --yes | tail -n 1
$A no-legacy

printf '\nTudo certo.\n'
