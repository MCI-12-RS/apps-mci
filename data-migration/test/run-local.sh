#!/usr/bin/env bash
# Teste local de ponta a ponta das ferramentas E4.01, E4.03, E4.04 e da carga (E4.06/E4.07).
#
# Sobe um MySQL 8.4 em Docker com o schema do legado e a massa FICTÍCIA de
# test/mysql/, copia para o schema legacy de um Postgres local com as funções
# do mci-connect (uma stack local do Supabase) e confere: --dry-run sem
# escrita, cópia, idempotência, checksum, privilégios, saneamento, carga
# (adoção, ambiguidade, --final, --dry-run, idempotência, mudança no legado,
# conflitos com o novo, volume), contas e credenciais legadas (npm run accounts, E4.08:
# Auth da stack local), reconciliação (npm run reconcile, E4.09: limpa, com divergências injetadas e
# no volume), limpeza do ensaio (npm run unload: o destino volta ao retrato de antes
# da carga) e limpeza do staging.
# No fim, tira a carga (só teste), apaga o schema legacy e o contêiner.
#
# Variáveis:
#   PG_PORT      porta do Postgres da stack local (padrão 58322, pista B)
#   MYSQL_IMAGE  imagem do MySQL (padrão mysql:8.4; mirror.gcr.io/library/mysql:8.4 se o Docker Hub limitar)
#   MYSQL_PORT   porta local do MySQL de teste (padrão 53306)
#   LOAD_VOLUME  0 pula a medição de volume da carga (padrão 1)
#   ACCOUNTS     0 pula as contas (padrão 1)
#   AUTH_URL     API da stack local (padrão http://127.0.0.1:58321, pista B)
#   AUTH_SECRET_KEY  chave secreta da stack local (padrão: supabase status em LANE_DIR)
#   LANE_DIR     pasta da stack local (padrão <raiz>/.worktrees/mci-connect-b)
#   PG_CONTAINER contêiner do Postgres da stack (padrão supabase_db_mci-b), para as falhas injetadas no Auth
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
ACCOUNTS="${ACCOUNTS:-1}"
LANE_DIR="${LANE_DIR:-$ROOT/../.worktrees/mci-connect-b}"
AUTH_URL="${AUTH_URL:-http://127.0.0.1:58321}"
PG_CONTAINER="${PG_CONTAINER:-supabase_db_mci-b}"
if [ "$ACCOUNTS" != 0 ] && [ -z "${AUTH_SECRET_KEY:-}" ]; then
  AUTH_SECRET_KEY="$(cd "$LANE_DIR" && supabase status -o env 2>/dev/null | sed -n 's/^SECRET_KEY="\(.*\)"$/\1/p')"
  [ -n "$AUTH_SECRET_KEY" ] || { echo "Sem a chave secreta da stack local (AUTH_SECRET_KEY ou supabase status em $LANE_DIR). ACCOUNTS=0 pula as contas."; exit 1; }
fi

cleanup() {
  # A limpeza do ensaio tira também o que o ensaio criou em cima da carga (o reset só tira a carga).
  if [ "$ACCOUNTS" != 0 ]; then
    node "$ROOT/src/unload.mjs" --config "$CONFIG" --undo-final --out-dir "$WORK/unload-reports" >/dev/null 2>&1 || true
    node "$HERE/assert-unload.mjs" "$CONFIG" unseed-pre >/dev/null 2>&1 || true
  fi
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
SUPABASE_URL="${AUTH_URL}"
SUPABASE_SECRET_KEY="${AUTH_SECRET_KEY:-}"
CFG
chmod 600 "$CONFIG"

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
# Rodar o teste de novo em menos de 15 min não pode esbarrar no limite de tentativas de login (E1.04).
psql "postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/postgres" -X -q -c 'DELETE FROM private.sign_in_throttle'
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

if [ "$ACCOUNTS" != 0 ]; then
  step "Contas: preparação (senhas do legado e uma conta que ficou sem ligação)"
  ACC="$N $HERE/assert-accounts.mjs $CONFIG"
  ACCOUNTS_RUN="$N $ROOT/src/accounts.mjs --config $CONFIG --out-dir $WORK/acc-reports"
  PSQL="psql postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/postgres -X -q -v ON_ERROR_STOP=1"
  # Falha injetada no Auth: trigger em auth.users, criado como supabase_admin dentro do contêiner (só teste).
  auth_trap() { docker exec -i "$PG_CONTAINER" psql -h 127.0.0.1 -U supabase_admin -d postgres -X -q -v ON_ERROR_STOP=1 -c "$1" >/dev/null; }
  auth_trap_drop() { auth_trap "DROP TRIGGER IF EXISTS qa_auth_trap ON auth.users; DROP FUNCTION IF EXISTS public.qa_auth_trap();"; }
  auth_trap_drop
  $ACC passwords

  step "Contas: --dry-run não cria nada"
  FPA0="$($ACC fingerprint)"
  $ACCOUNTS_RUN --dry-run >"$WORK/acc-dry.log" 2>&1 || { cat "$WORK/acc-dry.log"; echo "FALHA: contas --dry-run"; exit 1; }
  grep -E '^(Membros|Credenciais)' "$WORK/acc-dry.log"
  check "nada mudou (contas, cofre, credenciais, membros)" test "$($ACC fingerprint)" = "$FPA0"
  check "nenhum relatório de contas gravado" test ! -e "$WORK/acc-reports"
  check "previsão: 4 sem senha utilizável e 2 só depois da normalização" grep -q 'sem senha utilizável 4 (só depois de passar para minúsculas e tirar os espaços das pontas: 2)' "$WORK/acc-dry.log"
  for pii in Ficticio exemplo.org 52998224725 99999-0002 mci12fakemail '@'; do
    if grep -q -- "$pii" "$WORK/acc-dry.log"; then echo "FALHA: saída das contas contém dado pessoal ($pii)"; exit 1; fi
  done
  echo "ok: saída das contas sem dados pessoais"

  step "Contas: conta de outro dono e Id do legado em outra conta param antes de criar"
  $ACC block-setup
  FPB="$($ACC fingerprint)"
  expect_fail "conta de outro dono" "account_other_owner" $ACCOUNTS_RUN
  check "Id do legado em outra conta também citado" grep -q 'account_legacy_id_taken.*: 7' "$WORK/fail-cmd.log"
  check "nada mudou" test "$($ACC fingerprint)" = "$FPB"
  $ACC block-teardown

  step "Contas: o processo cai no meio da criação"
  $ACC precreate
  auth_trap "CREATE FUNCTION public.qa_auth_trap() RETURNS trigger LANGUAGE plpgsql AS \$f\$ BEGIN PERFORM pg_sleep(0.3); RETURN NEW; END \$f\$;
             CREATE TRIGGER qa_auth_trap BEFORE INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.qa_auth_trap();"
  $ACCOUNTS_RUN --concurrency 1 >"$WORK/acc-kill.log" 2>&1 &
  ACC_PID=$!
  for _ in $(seq 1 200); do
    [ "$($ACC unlinked-count)" -ge 5 ] && break
    sleep 0.1
  done
  kill -9 "$ACC_PID" 2>/dev/null || true
  wait "$ACC_PID" 2>/dev/null || true
  auth_trap_drop
  UNLINKED="$($ACC unlinked-count)"
  check "contas criadas e não ligadas ficaram ($UNLINKED)" test "$UNLINKED" -ge 5
  check "nenhuma credencial ainda" test "$($PSQL -Atc 'SELECT count(*) FROM private.legacy_credentials')" = 0

  step "Contas: o Auth recusa uma conta (falha no meio)"
  EMAIL11="$($PSQL -Atc "SELECT public.member_account_email(id) FROM public.members WHERE legacy_id = 11")"
  auth_trap "CREATE FUNCTION public.qa_auth_trap() RETURNS trigger LANGUAGE plpgsql AS \$f\$ BEGIN
               IF NEW.email = '${EMAIL11}' THEN RAISE EXCEPTION 'qa: conta recusada'; END IF; RETURN NEW; END \$f\$;
             CREATE TRIGGER qa_auth_trap BEFORE INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.qa_auth_trap();"
  expect_fail "a execução termina com erro" "account_create_failed" $ACCOUNTS_RUN
  auth_trap_drop
  grep -E '^Contas:' "$WORK/fail-cmd.log"
  $ACC after-failure

  step "Contas 1"
  $ACCOUNTS_RUN >"$WORK/acc1.log" 2>&1 || { cat "$WORK/acc1.log"; echo "FALHA: contas 1"; exit 1; }
  grep -E '^(Contas|Credenciais|Tempo):' "$WORK/acc1.log"
  $ACC expected
  REPORT="$(ls -t "$WORK"/acc-reports/contas-*.md | head -n 1)"
  for pii in Ficticio exemplo.org 52998224725 99999-0002 mci12fakemail '@'; do
    if grep -q -- "$pii" "$REPORT" "$WORK/acc1.log"; then echo "FALHA: relatório ou saída das contas contém dado pessoal ($pii)"; exit 1; fi
  done
  echo "ok: relatório de contas sem dados pessoais"
  $A grants

  step "Contas: login com a senha do legado"
  $ACC logins

  step "Contas 2 (idempotência)"
  FPA1="$($ACC fingerprint | sed -E 's/,"runs":[0-9]+//')"
  $ACCOUNTS_RUN >"$WORK/acc2.log" 2>&1 || { cat "$WORK/acc2.log"; echo "FALHA: contas 2"; exit 1; }
  $ACC unchanged after-logins
  check "nada mudou (contas, cofre, credenciais, membros)" test "$($ACC fingerprint | sed -E 's/,"runs":[0-9]+//')" = "$FPA1"

  step "Contas 3: um lote de credenciais falha no meio"
  $ACC change-passwords
  M30="$($PSQL -Atc "SELECT id FROM public.members WHERE legacy_id = 30")"
  $PSQL -c "CREATE FUNCTION public.qa_cred_trap() RETURNS trigger LANGUAGE plpgsql AS \$f\$ BEGIN
              IF NEW.member_id = '${M30}' THEN RAISE EXCEPTION 'qa: lote recusado'; END IF; RETURN NEW; END \$f\$;
            CREATE TRIGGER qa_cred_trap BEFORE UPDATE ON private.legacy_credentials FOR EACH ROW EXECUTE FUNCTION public.qa_cred_trap();"
  expect_fail "a execução termina com erro" "credential_batch_failed" $ACCOUNTS_RUN --batch-size 5 --concurrency 2
  $PSQL -c "DROP TRIGGER qa_cred_trap ON private.legacy_credentials; DROP FUNCTION public.qa_cred_trap();"
  $ACCOUNTS_RUN --batch-size 5 >"$WORK/acc3.log" 2>&1 || { cat "$WORK/acc3.log"; echo "FALHA: contas 3"; exit 1; }
  grep -E '^Credenciais:' "$WORK/acc3.log"
  $ACC updated-check
  $ACC problems-empty
  $L lists-empty

  step "Contas: a carga refeita não mexe nas contas"
  $LOAD >/dev/null 2>&1 || { echo "FALHA: carga depois das contas"; exit 1; }
  $L unchanged
  $ACC problems-empty

  step "Contas: membro excluído entre a criação da conta e a ligação"
  $ACC unlink 22
  M22="$($PSQL -Atc "SELECT id FROM public.members WHERE legacy_id = 22")"
  # Assim que o Auth grava a conta do 22, o cadastro é excluído (em replica, como supabase_admin; só teste).
  auth_trap "CREATE FUNCTION public.qa_auth_trap() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS \$f\$ BEGIN
               IF NEW.id = '${M22}' THEN
                 PERFORM set_config('session_replication_role', 'replica', true);
                 UPDATE public.members SET deleted_at = now() WHERE id = NEW.id;
                 PERFORM set_config('session_replication_role', 'origin', true);
               END IF; RETURN NEW; END \$f\$;
             CREATE TRIGGER qa_auth_trap AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.qa_auth_trap();"
  $ACCOUNTS_RUN >"$WORK/acc4.log" 2>&1 || { auth_trap_drop; cat "$WORK/acc4.log"; echo "FALHA: contas 4"; exit 1; }
  auth_trap_drop
  check "listado na saída" grep -q 'account_unlinked_deleted_member: 22' "$WORK/acc4.log"
  $ACC unlinked-deleted 22
  $ACCOUNTS_RUN >"$WORK/acc5.log" 2>&1 || { cat "$WORK/acc5.log"; echo "FALHA: contas 5"; exit 1; }
  check "o plano da execução seguinte lista o mesmo caso" grep -q 'account_unlinked_deleted_member: 22' "$WORK/acc5.log"
  $ACC unlinked-deleted 22
  $ACC undelete 22
  $ACCOUNTS_RUN >"$WORK/acc6.log" 2>&1 || { cat "$WORK/acc6.log"; echo "FALHA: contas 6"; exit 1; }
  check "sem a exclusão, a conta é religada" grep -qE '^Contas: 0 criadas, 1 religadas, 1 ligadas' "$WORK/acc6.log"
  $ACC problems-empty

  step "Contas: lote lento avisa e reduz os seguintes; lote no teto é dividido"
  M30="$($PSQL -Atc "SELECT id FROM public.members WHERE legacy_id = 30")"
  $PSQL -c "CREATE FUNCTION public.qa_cred_trap() RETURNS trigger LANGUAGE plpgsql AS \$f\$ BEGIN
              IF NEW.member_id = '${M30}' THEN PERFORM pg_sleep(1.5); END IF; RETURN NEW; END \$f\$;
            CREATE TRIGGER qa_cred_trap BEFORE UPDATE ON private.legacy_credentials FOR EACH ROW EXECUTE FUNCTION public.qa_cred_trap();"
  $PSQL -c "UPDATE legacy.\"Members\" SET \"Password\" = md5('Lenta ' || \"Id\") WHERE \"Id\" = 30"
  ACCOUNTS_TEST_SLOW_MS=1000 ACCOUNTS_TEST_TIMEOUT_MS=60000 $ACCOUNTS_RUN --batch-size 8 --concurrency 1 >"$WORK/acc7.log" 2>&1 \
    || { cat "$WORK/acc7.log"; echo "FALHA: contas 7"; exit 1; }
  check "aviso do lote lento, os próximos com 4" grep -q 'lote de 8 credenciais lento (.*); os próximos com 4' "$WORK/acc7.log"
  check "listado em credential_batch_slow" grep -q 'credential_batch_slow' "$WORK/acc7.log"
  $PSQL -c "UPDATE legacy.\"Members\" SET \"Password\" = md5('No teto ' || \"Id\") WHERE \"Id\" = 30"
  ACCOUNTS_TEST_SLOW_MS=60000 ACCOUNTS_TEST_TIMEOUT_MS=1000 $ACCOUNTS_RUN --batch-size 8 --concurrency 1 >"$WORK/acc8.log" 2>&1 \
    && { cat "$WORK/acc8.log"; echo "FALHA: contas 8 deveria falhar no lote de 1"; exit 1; }
  check "o lote no teto foi dividido até 1 e só então falhou" grep -q 'credential_batch_failed.*57014 (lote de 1)' "$WORK/acc8.log"
  check "cada divisão avisada" grep -q 'cancelado no teto' "$WORK/acc8.log"
  $PSQL -c "DROP TRIGGER qa_cred_trap ON private.legacy_credentials; DROP FUNCTION public.qa_cred_trap();"
  $ACCOUNTS_RUN >"$WORK/acc9.log" 2>&1 || { cat "$WORK/acc9.log"; echo "FALHA: contas 9"; exit 1; }
  $ACC problems-empty

  step "Reconciliação: carga e contas conferidas (só leitura; tudo bate)"
  R="$N $HERE/assert-reconcile.mjs $CONFIG"
  RECONCILE="$N $ROOT/src/reconcile.mjs --config $CONFIG --out-dir $WORK/rc-reports --credential-sample 500"
  $R legacy-levels
  FPRC="$($L fingerprint)|$($ACC fingerprint)"
  $RECONCILE --dry-run >"$WORK/rc-dry.log" 2>&1 || { cat "$WORK/rc-dry.log"; echo "FALHA: reconciliação --dry-run"; exit 1; }
  check "nenhum relatório de reconciliação gravado" test ! -e "$WORK/rc-reports"
  $RECONCILE >"$WORK/rc1.log" 2>&1 || { cat "$WORK/rc1.log"; echo "FALHA: reconciliação 1"; exit 1; }
  grep -E '^(Tempo|Código de evidência|Reconciliação):' "$WORK/rc1.log"
  check "nada mudou no destino (carga, private.*, contas, cofre, credenciais, Auditoria)" test "$($L fingerprint)|$($ACC fingerprint)" = "$FPRC"
  $R expect-clean "$(ls -t "$WORK"/rc-reports/*.json | head -n 1)"
  check "relatório em Markdown com o mesmo código de evidência" grep -q "$(sed -n 's/^Código de evidência: //p' "$WORK/rc1.log")" "$(ls -t "$WORK"/rc-reports/*.md | head -n 1)"
  check "relatório só para o dono" test "$(stat -c %a "$(ls -t "$WORK"/rc-reports/*.md | head -n 1)")" = 600
  expect_fail "--yes não se aplica (só leitura)" "--yes" $RECONCILE --yes

  step "Reconciliação: divergências injetadas são apontadas com o código certo"
  $R inject
  set +e; $RECONCILE >"$WORK/rc2.log" 2>&1; RC=$?; set -e
  check "código de saída 2 com divergência ($RC)" test "$RC" = 2
  grep -E '^ *FALHA' "$WORK/rc2.log"
  $R expect-injected "$(ls -t "$WORK"/rc-reports/*.json | head -n 1)"
  $R restore
  $RECONCILE >"$WORK/rc3.log" 2>&1 || { cat "$WORK/rc3.log"; echo "FALHA: reconciliação depois de desfazer"; exit 1; }
  $R expect-clean "$(ls -t "$WORK"/rc-reports/*.json | head -n 1)"
  for pii in Ficticio exemplo.org 52998224725 99999-0002 Faltante Trocado Adotado mci12fakemail '@'; do
    if grep -q -- "$pii" "$WORK"/rc-reports/* "$WORK"/rc-dry.log "$WORK"/rc1.log "$WORK"/rc2.log "$WORK"/rc3.log; then
      echo "FALHA: saída ou relatório da reconciliação contém dado pessoal ($pii)"; exit 1; fi
  done
  echo "ok: saída e relatórios da reconciliação sem dados pessoais"

  step "Reconciliação: trava comum com a carga, as contas e a limpeza"
  psql "postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/postgres" -X -q -c "SELECT pg_advisory_lock(hashtextextended('mci.e4.load', 0)), pg_sleep(6)" >/dev/null &
  LOCK_PID=$!
  sleep 1
  expect_fail "a reconciliação recusa com a trava ocupada" "em andamento" $RECONCILE --dry-run
  wait "$LOCK_PID"
fi

step "Limpeza do staging recusa com carga no destino"
expect_fail "clean --yes recusa" "carga no destino" $N "$ROOT/src/clean-legacy.mjs" --config "$CONFIG" --yes
$A grants

if [ "$ACCOUNTS" != 0 ]; then
  U="$N $HERE/assert-unload.mjs $CONFIG"
  UNLOAD="$N $ROOT/src/unload.mjs --config $CONFIG --out-dir $WORK/unload-reports"
  PSQL="psql postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/postgres -X -q -v ON_ERROR_STOP=1"
  step "Limpeza do ensaio: destino com cadastros do novo, antes da carga"
  $L reset
  $L seed-new
  $U seed-pre
  FP0="$($U fingerprint)"
  $UNLOAD >"$WORK/unload0.log" 2>&1 || { cat "$WORK/unload0.log"; echo "FALHA: limpeza sem carga"; exit 1; }
  check "sem carga: nada a desfazer" grep -q 'Nada a desfazer' "$WORK/unload0.log"
  check "o destino ficou igual" test "$($U fingerprint)" = "$FP0"

  step "Limpeza do ensaio: carga, contas e ensaio (login, sessões, cadastros, célula, relatórios, função)"
  $LOAD >/dev/null 2>&1 || { echo "FALHA: carga antes do ensaio"; exit 1; }
  $ACCOUNTS_RUN >/dev/null 2>&1 || { echo "FALHA: contas antes do ensaio"; exit 1; }
  $U rehearsal
  EVR="$($U events-count)"
  FPR="$($U fingerprint)"

  step "Limpeza do ensaio: --dry-run não apaga nada"
  $UNLOAD --dry-run >"$WORK/unload-dry.log" 2>&1 || { cat "$WORK/unload-dry.log"; echo "FALHA: limpeza --dry-run"; exit 1; }
  grep -E '^(Sai|Volta|Código|Contas)' "$WORK/unload-dry.log"
  check "nada mudou no destino" test "$($U fingerprint)" = "$FPR"
  check "nenhum relatório de limpeza gravado" test ! -e "$WORK/unload-reports"
  for pii in Ficticio exemplo.org 52998224725 99999-0002 mci12fakemail Ensaio Novo '@'; do
    if grep -q -- "$pii" "$WORK/unload-dry.log"; then echo "FALHA: saída da limpeza contém dado pessoal ($pii)"; exit 1; fi
  done
  echo "ok: saída da limpeza sem dados pessoais"
  PLANNED="$(sed -n 's/^Volta à linha de antes: .* contas a apagar no Auth: \([0-9.]*\).*/\1/p' "$WORK/unload-dry.log")"
  check "previsão das contas igual à do plano ($PLANNED)" grep -q "^Contas a apagar no Auth (com as pendentes de limpezas anteriores): $PLANNED\$" "$WORK/unload-dry.log"
  check "previsão com contas" test "$PLANNED" != 0
  CONFIRM="$(sed -n 's/^Código de confirmação: //p' "$WORK/unload-dry.log")"
  check "código de confirmação mostrado ($CONFIRM)" test -n "$CONFIRM"
  WRONG="0000-0000"; [ "$CONFIRM" = "$WRONG" ] && WRONG="0000-0001"
  expect_fail "--confirm diferente do --dry-run para sem apagar" "código de confirmação mudou" $UNLOAD --confirm "$WRONG"
  check "nada mudou no destino" test "$($U fingerprint)" = "$FPR"

  step "Limpeza do ensaio: cadastro e célula anteriores à carga que apontam para ela param a limpeza"
  $U block-setup
  FPB="$($U fingerprint)"
  expect_fail "cadastro que fica com líder da carga" "member_points_to_removed" $UNLOAD
  check "a célula também é citada" grep -q 'cell_points_to_removed.*anfitrião: Id do legado 5' "$WORK/fail-cmd.log"
  check "o cônjuge de antes do adotado, casado no ensaio, também é citado" grep -q 'spouse_conflict.*: 3 ' "$WORK/fail-cmd.log"
  check "nada mudou no destino" test "$($U fingerprint)" = "$FPB"
  $U block-teardown
  check "de volta ao ensaio" test "$($U fingerprint)" = "$FPR"

  step "Limpeza do ensaio: falha no fim da transação do banco desfaz tudo"
  $PSQL -c "CREATE FUNCTION public.qa_unload_trap() RETURNS trigger LANGUAGE plpgsql AS \$f\$ BEGIN RAISE EXCEPTION 'qa: falha no fim'; END \$f\$;
            CREATE TRIGGER qa_unload_trap BEFORE UPDATE ON legacy._load_runs FOR EACH ROW EXECUTE FUNCTION public.qa_unload_trap();
            ALTER TABLE legacy._load_runs ENABLE ALWAYS TRIGGER qa_unload_trap;"
  expect_fail "a limpeza falha" "qa: falha no fim" $UNLOAD
  check "nada mudou no destino" test "$($U fingerprint)" = "$FPR"

  step "Limpeza do ensaio: o processo cai no meio da transação do banco"
  $PSQL -c "CREATE OR REPLACE FUNCTION public.qa_unload_trap() RETURNS trigger LANGUAGE plpgsql AS \$f\$ BEGIN PERFORM pg_sleep(60); RETURN NEW; END \$f\$;"
  $UNLOAD >"$WORK/unload-kill.log" 2>&1 &
  UL_PID=$!
  SLEEPING=""
  for _ in $(seq 1 300); do
    SLEEPING="$($PSQL -Atc "SELECT pid FROM pg_stat_activity WHERE wait_event = 'PgSleep' AND application_name = 'mci-data-migration' LIMIT 1")"
    [ -n "$SLEEPING" ] && break
    sleep 0.1
  done
  check "a limpeza chegou ao fim da gravação" test -n "$SLEEPING"
  kill -9 "$UL_PID" 2>/dev/null || true
  wait "$UL_PID" 2>/dev/null || true
  # O servidor só percebe a conexão caída quando volta a falar com ela: encerra o comando, como faria o tempo-limite.
  $PSQL -Atc "SELECT pg_terminate_backend($SLEEPING)" >/dev/null
  $PSQL -c "DROP TRIGGER qa_unload_trap ON legacy._load_runs; DROP FUNCTION public.qa_unload_trap();"
  for _ in $(seq 1 50); do
    [ -z "$($PSQL -Atc "SELECT 1 FROM pg_stat_activity WHERE pid = $SLEEPING")" ] && break
    sleep 0.1
  done
  check "nada mudou no destino" test "$($U fingerprint)" = "$FPR"

  step "Limpeza do ensaio: o Auth recusa uma conta (depois do commit do banco)"
  M4="$($PSQL -Atc "SELECT id FROM public.members WHERE legacy_id = 4")"
  auth_trap "CREATE FUNCTION public.qa_auth_trap() RETURNS trigger LANGUAGE plpgsql AS \$f\$ BEGIN
               IF OLD.id = '${M4}' THEN RAISE EXCEPTION 'qa: conta não apagada'; END IF; RETURN OLD; END \$f\$;
             CREATE TRIGGER qa_auth_trap BEFORE DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.qa_auth_trap();"
  expect_fail "a limpeza termina com erro" "account_delete_failed" $UNLOAD --confirm "$CONFIRM"
  auth_trap_drop
  grep -E '^(Sai|Contas no Auth|Limpeza)' "$WORK/fail-cmd.log"
  $U auth-pending 1
  expect_fail "o clean recusa com contas pendentes no Auth" "pendentes de uma limpeza do ensaio" $N "$ROOT/src/clean-legacy.mjs" --config "$CONFIG" --yes

  step "Limpeza do ensaio: rodar de novo completa; o destino volta ao retrato de antes da carga"
  $UNLOAD >"$WORK/unload1.log" 2>&1 || { cat "$WORK/unload1.log"; echo "FALHA: limpeza 1"; exit 1; }
  check "a conta pendente foi apagada" grep -qE '^Contas no Auth: 1 apagadas' "$WORK/unload1.log"
  check "o destino voltou ao retrato de antes da carga" test "$($U fingerprint)" = "$FP0"
  $U events-kept "$EVR"
  $L lists-empty
  REPORT="$(ls -t "$WORK"/unload-reports/limpeza-*.md | head -n 1)"
  for pii in Ficticio exemplo.org 52998224725 99999-0002 mci12fakemail Ensaio Novo '@'; do
    if grep -q -- "$pii" "$REPORT" "$WORK/unload1.log"; then echo "FALHA: relatório ou saída da limpeza contém dado pessoal ($pii)"; exit 1; fi
  done
  echo "ok: relatório da limpeza sem dados pessoais"
  $A grants

  step "Limpeza do ensaio: repetir não muda nada"
  $UNLOAD >"$WORK/unload2.log" 2>&1 || { cat "$WORK/unload2.log"; echo "FALHA: limpeza 2"; exit 1; }
  check "nada a desfazer" grep -q 'Nada a desfazer' "$WORK/unload2.log"
  check "o destino ficou igual" test "$($U fingerprint)" = "$FP0"

  step "Limpeza do ensaio: o processo cai no meio da exclusão das contas"
  $LOAD >/dev/null 2>&1 || { echo "FALHA: carga 2 antes da limpeza"; exit 1; }
  $ACCOUNTS_RUN >/dev/null 2>&1 || { echo "FALHA: contas 2 antes da limpeza"; exit 1; }
  auth_trap "CREATE FUNCTION public.qa_auth_trap() RETURNS trigger LANGUAGE plpgsql AS \$f\$ BEGIN PERFORM pg_sleep(0.3); RETURN OLD; END \$f\$;
             CREATE TRIGGER qa_auth_trap BEFORE DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.qa_auth_trap();"
  $UNLOAD --concurrency 1 >"$WORK/unload-kill2.log" 2>&1 &
  UL_PID=$!
  for _ in $(seq 1 300); do
    LEFT="$($PSQL -Atc "SELECT count(*) FROM auth.users WHERE raw_app_meta_data ? 'legacy_member_id'")"
    DBDONE="$($PSQL -Atc "SELECT count(*) FROM legacy._unload_runs WHERE status = 'auth_pending'" 2>/dev/null || echo 0)"
    [ "$DBDONE" -ge 1 ] && [ "$LEFT" -le 30 ] && break
    sleep 0.1
  done
  kill -9 "$UL_PID" 2>/dev/null || true
  wait "$UL_PID" 2>/dev/null || true
  auth_trap_drop
  LEFT="$($PSQL -Atc "SELECT count(*) FROM auth.users WHERE raw_app_meta_data ? 'legacy_member_id'")"
  check "o banco foi limpo e sobraram contas no Auth ($LEFT)" test "$LEFT" -ge 1
  $UNLOAD >"$WORK/unload3.log" 2>&1 || { cat "$WORK/unload3.log"; echo "FALHA: limpeza 3"; exit 1; }
  grep -E '^Contas no Auth' "$WORK/unload3.log"
  check "o destino voltou ao retrato de antes da carga" test "$($U fingerprint)" = "$FP0"
  check "a execução que caiu foi completada" test "$($PSQL -Atc "SELECT count(*) FROM legacy._unload_runs WHERE status = 'auth_pending'")" = 0

  step "Limpeza do ensaio: recusa depois de uma carga --final"
  $LOAD >/dev/null 2>&1 || { echo "FALHA: carga 3 antes da limpeza"; exit 1; }
  $U mark-final
  expect_fail "recusa sem --undo-final" "carga final" $UNLOAD
  $UNLOAD --dry-run >"$WORK/unload-final-dry.log" 2>&1 || { cat "$WORK/unload-final-dry.log"; echo "FALHA: --dry-run depois da final"; exit 1; }
  check "o --dry-run segue, com aviso" grep -q 'exige --undo-final' "$WORK/unload-final-dry.log"
  $UNLOAD --undo-final >/dev/null 2>&1 || { echo "FALHA: --undo-final"; exit 1; }
  check "o destino voltou ao retrato de antes da carga" test "$($U fingerprint)" = "$FP0"

  step "Limpeza do ensaio: trava comum com a carga e as contas"
  $PSQL -c "SELECT pg_advisory_lock(hashtextextended('mci.e4.load', 0)), pg_sleep(8)" >/dev/null &
  LOCK_PID=$!
  sleep 1
  expect_fail "a limpeza recusa com a trava ocupada" "em andamento" $UNLOAD --dry-run
  wait "$LOCK_PID"

  step "Limpeza do ensaio: cônjuge, participante e autoria em cadastros que ficam"
  $LOAD >/dev/null 2>&1 || { echo "FALHA: carga 4 antes da limpeza"; exit 1; }
  $U side-effects-setup
  $UNLOAD >"$WORK/unload4.log" 2>&1 || { cat "$WORK/unload4.log"; echo "FALHA: limpeza 4"; exit 1; }
  $U side-effects-check
  $L lists-empty

  step "Limpeza do staging depois da limpeza do ensaio"
  $N "$ROOT/src/clean-legacy.mjs" --config "$CONFIG" --dry-run >"$WORK/clean-after.log" 2>&1
  check "o clean não acusa carga no destino" test -z "$(grep 'carga no destino' "$WORK/clean-after.log")"
  $U unseed-pre
fi

if [ "${LOAD_VOLUME:-1}" != 0 ]; then
  step "Carga: volume (3 mil membros, 300 células, 30 mil relatórios)"
  $L reset
  [ "$ACCOUNTS" != 0 ] && FPV0="$($U fingerprint)"
  psql "postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/postgres" -X -q -v ON_ERROR_STOP=1 -f "$HERE/volume/legacy-volume.sql"
  for run in dry-run 1 2; do
    ARGS=""; [ "$run" = dry-run ] && ARGS="--dry-run"
    $LOAD $ARGS --pastor-ids 1,2 --admin-ids 1,2 >"$WORK/vol.log" 2>&1 || { cat "$WORK/vol.log"; echo "FALHA: volume ($run)"; exit 1; }
    echo "volume ($run): $(grep -E '^Tempo:' "$WORK/vol.log")"
  done
  grep -E '^(Membros|Células|Relatórios|Participantes|Funções):' "$WORK/vol.log"
  $L unchanged
  $L lists-empty
  if [ "$ACCOUNTS" != 0 ]; then
    for run in dry-run 1 2; do
      ARGS=""; [ "$run" = dry-run ] && ARGS="--dry-run"
      VLOG="$WORK/vol-acc-$run.log"
      $ACCOUNTS_RUN $ARGS >"$VLOG" 2>&1 || { cat "$VLOG"; echo "FALHA: contas no volume ($run)"; exit 1; }
      echo "contas no volume ($run):"
      grep -E '^(Membros carregados|Contas|Credenciais|Tempo):' "$VLOG" | sed 's/^/  /' || true
    done
    $ACC unchanged
    $ACC volume-check
    $ACC problems-empty
    step "Reconciliação: volume"
    $R legacy-levels
    FPRV="$($L fingerprint)|$($ACC fingerprint)"
    $N "$ROOT/src/reconcile.mjs" --config "$CONFIG" --out-dir "$WORK/rc-vol" --pastor-ids 1,2 --admin-ids 1,2 >"$WORK/vol-rc.log" 2>&1 \
      || { cat "$WORK/vol-rc.log"; echo "FALHA: reconciliação no volume"; exit 1; }
    echo "reconciliação no volume: $(grep -E '^Tempo:' "$WORK/vol-rc.log")"
    grep -E '^Reconciliação:' "$WORK/vol-rc.log"
    $R expect-approved "$(ls -t "$WORK"/rc-vol/*.json | head -n 1)"
    check "nada mudou no destino" test "$($L fingerprint)|$($ACC fingerprint)" = "$FPRV"
    step "Limpeza do ensaio: volume"
    for run in dry-run 1 2; do
      ARGS=""; [ "$run" = dry-run ] && ARGS="--dry-run"
      VLOG="$WORK/vol-unload-$run.log"
      $UNLOAD $ARGS >"$VLOG" 2>&1 || { cat "$VLOG"; echo "FALHA: limpeza no volume ($run)"; exit 1; }
      echo "limpeza no volume ($run):"
      grep -E '^(Sai|Volta|Contas no Auth|Tempo|Nada)' "$VLOG" | sed 's/^/  /' || true
    done
    check "o destino voltou ao retrato de antes da carga" test "$($U fingerprint)" = "$FPV0"
    $L lists-empty
  fi
fi

step "Limpeza final"
$L reset
$N "$ROOT/src/clean-legacy.mjs" --config "$CONFIG" --yes | tail -n 1
$A no-legacy

printf '\nTudo certo.\n'
