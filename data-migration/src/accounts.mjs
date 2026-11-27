#!/usr/bin/env node
// E4.08: contas de acesso e credenciais legadas dos membros carregados
// (spec docs/specs/e4-carga.md, DT-14; plano 6.2 e 6.3 do docs/migracao.md; RN-01, RN-03,
// RN-09 e RN-16 do E3).
//
// Depois do `npm run load`:
//   1. plano (sql/accounts/10_plan.sql): quem é elegível (carregado, não excluído, com
//      identificador de login, sem conta), quem já tem conta, e os bloqueios (conta de
//      outro dono, Id do legado em outra conta). Bloqueio para antes de criar qualquer coisa;
//   2. contas pela Admin API do Auth: id = id do membro, e-mail técnico
//      member_account_email(id), email_confirm, app_metadata.legacy_member_id, SEM senha
//      (a senha mora só no cofre, E2.03). Até --concurrency ao mesmo tempo. Já existe e é do
//      membro: só religa; de outro dono: para;
//   3. ligação auth_user_id = id em replica (sem Auditoria), em lotes (20_link.sql);
//   4. credenciais: private.add_legacy_credential(id, MD5 em minúsculas e sem os espaços das
//      pontas) direto do legacy."Members", --batch-size membros por comando, --concurrency
//      conexões (30_credentials.sql). O MD5 nunca é parâmetro nem sai do banco. Cada lote é
//      medido: passou de 6 s, avisa e os seguintes ficam com a metade; estourou o teto de 9 s
//      (longe dos 10 s do auto_explain), o lote é dividido e refeito;
//   5. validação (90_validate.sql): private.legacy_credential_problems() vazia e todo
//      elegível com a conta dele ligada.
// Não é uma transação só (a Admin API fica fora do banco): cada passo é idempotente, e
// refazer completa o que faltou sem duplicar (a conta é achada pelo id e pelo Id do legado).
//
// --dry-run: só o plano e a previsão das credenciais; nada é criado nem gravado.
// Nada de nome, e-mail, CPF, telefone, senha ou MD5 no terminal ou no relatório: só Ids do
// legado, códigos e contagens.

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, postgresOptions, authAdminOptions, MIGRATION_ROOT } from './lib/config.mjs';
import { parseCli, log, warn, runMain, formatInt, gitCommit, safeErrorMessage } from './lib/cli.mjs';
import { connectPostgres, describeLegacy, existingApiRoles, legacyPrivilegeProblems } from './lib/postgres.mjs';
import { LEGACY_SCHEMA, qPg } from './lib/legacy-schema.mjs';
import { createAuthAdmin, ensureAccount, runPool, AuthAdminError } from './lib/auth-admin.mjs';
import {
  ACCOUNT_CATEGORIES, accountCodeInfo, blockingAccountIssues, CREDENTIAL_RESULTS, chunk, parseIntOption,
} from './lib/account-codes.mjs';

const USAGE = `
Uso: node src/accounts.mjs [--config <arquivo>] [--dry-run] [--yes] [--concurrency 4] [--batch-size 50] [--out-dir <pasta>]

  --config       arquivo de configuração (padrão: MCI_LOCAL_CONFIG ou <raiz>/local.config)
  --dry-run      só o plano e a previsão das credenciais (nada é criado; nenhum arquivo)
  --yes          confirma a gravação num destino que não é a stack local (sem --dry-run, é obrigatório)
  --concurrency  contas criadas e lotes de credenciais ao mesmo tempo (1 a 8; padrão 4)
  --batch-size   membros por comando de credenciais (1 a 100; padrão 50 na stack local e 25 fora dela).
                 Lote que passa de 6 s reduz os seguintes à metade; o teto do comando é 9 s.
  --out-dir      pasta do relatório (padrão: data-migration/reports)

Precisa, além do banco: SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY) e, na stack local,
SUPABASE_URL (a API da mesma stack). Fora dela, o endereço é https://<ref>.supabase.co.
`;

export const SQL_DIR = resolve(MIGRATION_ROOT, 'sql', 'accounts');
export const PLAN_FILE = '10_plan.sql';
export const LINK_FILE = '20_link.sql';
export const CREDENTIALS_FILE = '30_credentials.sql';
export const VALIDATE_FILE = '90_validate.sql';
const RUNS = `${qPg(LEGACY_SCHEMA)}._accounts_runs`;
const LOAD_RUNS = `${qPg(LEGACY_SCHEMA)}._load_runs`;
// A mesma trava consultiva da carga (src/load.mjs): contas e carga não rodam juntas, nem
// duas criações de contas no mesmo destino. Aqui por sessão (a execução tem vários passos).
export const LOAD_LOCK_KEY = 'mci.e4.load';
const LINK_BATCH = 500;
// Credenciais (DT-19 do E1.04): o auto_explain de produção registra plano e parâmetros de todo
// comando de 10 s ou mais. O comando de credenciais só leva ids, mas fica longe disso: lote
// acima de SLOW_BATCH_MS reduz os seguintes à metade, e o teto CREDENTIAL_TIMEOUT_MS cancela
// antes dos 10 s (o comando cancelado não chega ao auto_explain) e divide o lote.
export const SLOW_BATCH_MS = 6000;
export const CREDENTIAL_TIMEOUT_MS = 9000;
const DEFAULT_BATCH_LOCAL = 50;
const DEFAULT_BATCH_REMOTE = 25;
const OPEN_LIST_LIMIT = 30;
const AFTER_RUN_LISTS = new Set(['credential_unusable_md5', 'credential_md5_normalized', 'credential_has_password',
  'credential_kept_used', 'credential_batch_slow', 'account_unlinked_deleted_member']);

const readSql = (name) => readFileSync(resolve(SQL_DIR, name), 'utf8');

/** Pré-condições: carga feita e as funções do E2.04 e do E3. */
async function precheck(client) {
  const state = await describeLegacy(client);
  if (!state.exists || !state.tables.some((t) => t.name === 'Members')) {
    throw new Error('Cópia bruta ausente (legacy."Members"). Rode antes: npm run copy e npm run load.');
  }
  if (!state.tables.some((t) => t.name === '_load_runs')) throw new Error('Nenhuma carga no destino. Rode antes: npm run load.');
  const { rows: [s] } = await client.query(`
    SELECT EXISTS (SELECT 1 FROM ${LOAD_RUNS} WHERE finished_at IS NOT NULL AND undone_at IS NULL) AS loaded,
           to_regprocedure('private.add_legacy_credential(uuid,text)') IS NOT NULL AS add_fn,
           to_regprocedure('private.legacy_credential_problems()') IS NOT NULL AS problems_fn,
           to_regprocedure('public.member_account_email(uuid)') IS NOT NULL AS email_fn,
           to_regprocedure('public.member_has_login_identifier(text,text,text)') IS NOT NULL AS ident_fn,
           to_regclass('legacy._load_adopted') IS NOT NULL AS adopted_tbl`);
  if (!s.loaded || !s.adopted_tbl) throw new Error('Nenhuma carga gravada (e não desfeita) no destino. Rode antes: npm run load.');
  if (!s.add_fn || !s.problems_fn) throw new Error('O destino não tem as credenciais legadas do E3 (private.add_legacy_credential).');
  if (!s.email_fn || !s.ident_fn) throw new Error('O destino não tem as funções de conta do E2.04 (member_account_email).');
}

/**
 * A execução depende da sessão (trava consultiva por sessão, tabelas pg_temp.acc_*, SET): pega
 * e solta uma trava de teste em dois comandos. Num pooler em modo transação o segundo cai
 * noutra conexão, e o unlock volta falso (ou o pid muda).
 */
export async function assertSessionPinned(client) {
  const key = `mci.e4.session-probe:${process.pid}:${Date.now()}:${Math.random()}`;
  const { rows: [a] } = await client.query('SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS ok, pg_backend_pid() AS pid', [key]);
  const { rows: [b] } = await client.query('SELECT pg_advisory_unlock(hashtextextended($1, 0)) AS ok, pg_backend_pid() AS pid', [key]);
  if (!a.ok || !b.ok || a.pid !== b.pid) {
    throw new Error('A conexão não mantém a sessão entre comandos (pooler em modo transação?). Use o Session pooler (porta 5432).');
  }
}

async function takeLock(client) {
  const { rows: [r] } = await client.query('SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS ok', [LOAD_LOCK_KEY]);
  if (!r.ok) throw new Error('Outra carga ou criação de contas está em andamento neste destino. Espere ela terminar e rode de novo.');
}

async function ensureRunsTable(client) {
  const roles = await existingApiRoles(client);
  const revokeFrom = ['PUBLIC', ...roles.map(qPg)].join(', ');
  await client.query(`CREATE TABLE IF NOT EXISTS ${RUNS} (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    finished_at timestamptz,
    status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'ok', 'failed')),
    tool_commit text,
    counts jsonb NOT NULL DEFAULT '{}'::jsonb,
    lists jsonb NOT NULL DEFAULT '{}'::jsonb
  )`);
  await client.query(`ALTER TABLE ${RUNS} ENABLE ROW LEVEL SECURITY`);
  await client.query(`REVOKE ALL ON ${RUNS} FROM ${revokeFrom}`);
  await client.query(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA ${qPg(LEGACY_SCHEMA)} FROM ${revokeFrom}`);
}

const PLAN_COUNTS_SQL = `
  SELECT jsonb_build_object(
    'loaded', (SELECT count(*) FROM acc_plan),
    'actions', (SELECT coalesce(jsonb_object_agg(action, n), '{}'::jsonb)
                  FROM (SELECT action, count(*) AS n FROM acc_plan GROUP BY action) x),
    'forecast', (SELECT coalesce(jsonb_object_agg(f, n), '{}'::jsonb) FROM (
                   SELECT CASE WHEN NOT pw_usable THEN 'unusable_md5'
                               WHEN has_password THEN 'has_password'
                               WHEN has_credential AND NOT credential_pending THEN 'kept_used'
                               WHEN credential_pending THEN 'pending_recheck'
                               ELSE 'created' END AS f, count(*) AS n
                     FROM acc_plan WHERE action IN ('create', 'relink', 'linked') GROUP BY 1) y),
    'forecast_md5_normalized', (SELECT count(*) FROM acc_plan
                                 WHERE action IN ('create', 'relink', 'linked') AND pw_usable AND pw_normalized)
  ) AS counts`;

async function readIssues(client) {
  const { rows } = await client.query(`
    SELECT code, count(*)::int AS n,
           coalesce(jsonb_agg(jsonb_build_object('id', legacy_id, 'info', nullif(info, ''))
                              ORDER BY legacy_id NULLS FIRST, info), '[]'::jsonb) AS items
      FROM acc_issues GROUP BY code ORDER BY code`);
  return rows;
}

/** Junta as ocorrências da execução (plano + runner) no formato { code, n, items }. */
function mergeIssues(base, extra) {
  const map = new Map(base.map((i) => [i.code, { ...i, items: [...i.items] }]));
  for (const [code, items] of Object.entries(extra)) {
    if (!items.length) continue;
    const cur = map.get(code) ?? { code, n: 0, items: [] };
    cur.items.push(...items);
    cur.items.sort((a, b) => (a.id ?? -1) - (b.id ?? -1));
    cur.n = cur.items.length;
    map.set(code, cur);
  }
  return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
}

function printIssues(issues, limit = 20) {
  for (const [cat, label] of ACCOUNT_CATEGORIES) {
    const rows = issues.filter((i) => (accountCodeInfo(i.code)?.category ?? 'block') === cat);
    if (!rows.length) continue;
    log(`${label}:`);
    for (const r of rows) {
      const ids = r.items.map((i) => (i.id != null ? (i.info ? `${i.id} (${i.info})` : i.id) : i.info)).filter((v) => v != null);
      const shown = ids.slice(0, limit).join(', ') + (ids.length > limit ? `, … (+${ids.length - limit})` : '');
      log(`  ${String(formatInt(r.n)).padStart(6)}  ${r.code}${cat === 'block' ? '  [PARA]' : ''}: ${shown}`);
    }
  }
}

const mdEscape = (s) => String(s ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');

function renderMarkdown({ date, full, runId, counts, issues, timings, status }) {
  const out = [];
  out.push(`# Relatório de contas e credenciais (${date})`, '');
  out.push('> **Dados pessoais (LGPD).** Só Ids do legado e contagens, mas sobre membros de uma igreja:');
  out.push('> fica em `data-migration/reports/` (ignorada pelo git); não envie por canais abertos e apague depois do uso.', '');
  out.push(`- Gerado em: ${full} (horário de Brasília)`);
  out.push(`- Execução: #${runId} (\`legacy._accounts_runs\`), situação: ${status === 'ok' ? 'concluída' : '**falhou**'}`);
  out.push(`- Tempo: ${timings.map(([k, v]) => `${k} ${v}`).join(' · ')}`, '');
  out.push('## Contagens', '', '```json', JSON.stringify(counts, null, 2), '```', '');
  out.push('## Ocorrências', '');
  for (const [cat, label] of ACCOUNT_CATEGORIES) {
    const rows = issues.filter((i) => (accountCodeInfo(i.code)?.category ?? 'block') === cat);
    out.push(`### ${label}`, '');
    if (!rows.length) { out.push('Nenhuma.', ''); continue; }
    for (const r of rows) {
      out.push(`#### \`${r.code}\` (${formatInt(r.n)})`, '', mdEscape(accountCodeInfo(r.code)?.title ?? ''), '');
      const table = ['| Id do legado | Observação |', '|---:|---|',
        ...r.items.map((i) => `| ${i.id ?? '—'} | ${mdEscape(i.info ?? '')} |`)];
      if (r.items.length > OPEN_LIST_LIMIT) {
        out.push(`<details><summary>Ver os ${formatInt(r.items.length)} itens</summary>`, '', ...table, '', '</details>', '');
      } else {
        out.push(...table, '');
      }
    }
  }
  return `${out.join('\n')}\n`;
}

const spFormat = (opts) => new Intl.DateTimeFormat(opts.dateStyle ? 'pt-BR' : 'en-CA', { timeZone: 'America/Sao_Paulo', ...opts })
  .format(new Date());

/** Liga auth_user_id = id em lotes, cada lote numa transação em replica. Devolve os Ids do legado ligados. */
async function linkAccounts(client, memberIds) {
  const linked = [];
  for (const ids of chunk(memberIds, LINK_BATCH)) {
    await client.query('BEGIN');
    try {
      await client.query('SET LOCAL session_replication_role = replica');
      await client.query(`SET LOCAL lock_timeout = '5s'`);
      const { rows } = await client.query(readSql(LINK_FILE), [ids]);
      await client.query('COMMIT');
      linked.push(...rows.map((r) => r.legacy_id));
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    }
  }
  return linked;
}

/**
 * Credenciais em lotes, com `concurrency` conexões. Cada lote é medido: acima de `slowMs`, entra
 * em `slow` e os lotes seguintes ficam com a metade do tamanho; o comando que estoura
 * `timeoutMs` (57014) é dividido ao meio e refeito (a add_legacy_credential é idempotente e o
 * comando cancelado não gravou nada). Lote de 1 que estoura, ou qualquer outro erro, é falha.
 * Devolve { rows, failures, slow, stats }.
 */
export async function loadCredentials(pgOptions, memberIds, {
  concurrency, batchSize, slowMs = SLOW_BATCH_MS, timeoutMs = CREDENTIAL_TIMEOUT_MS,
  connect = connectPostgres, now = Date.now, onSlow = () => {},
}) {
  const rows = [];
  const failures = [];
  const slow = [];
  const stats = { batches: 0, max_ms: 0, timeouts: 0, initial_size: batchSize, final_size: batchSize };
  if (!memberIds.length) return { rows, failures, slow, stats };
  let size = batchSize;
  let pos = 0;
  const retry = [];
  const take = () => {
    if (retry.length) return retry.shift();
    if (pos >= memberIds.length) return null;
    const b = memberIds.slice(pos, pos + size);
    pos += b.length;
    return b;
  };
  const shrink = (from) => { size = Math.min(size, Math.max(1, Math.floor(from / 2))); stats.final_size = size; };
  const n = Math.min(concurrency, Math.ceil(memberIds.length / batchSize));
  const clients = [];
  try {
    for (let i = 0; i < n; i++) {
      const c = await connect(pgOptions);
      clients.push(c);
      await c.query(`SET statement_timeout = '${Math.trunc(timeoutMs)}ms'`);
      await c.query(`SET lock_timeout = '5s'`);
    }
    const sql = readSql(CREDENTIALS_FILE);
    await Promise.all(clients.map(async (c) => {
      while (!failures.length) {
        const batch = take();
        if (!batch) break;
        const t = now();
        try {
          const r = await c.query(sql, [batch]);
          const ms = now() - t;
          stats.batches += 1;
          stats.max_ms = Math.max(stats.max_ms, ms);
          rows.push(...r.rows);
          if (ms > slowMs) {
            slow.push({ id: null, info: `${ms} ms, lote de ${batch.length}` });
            shrink(batch.length);
            onSlow({ ms, size: batch.length, next: size, timedOut: false });
          }
        } catch (err) {
          if (err?.code === '57014' && batch.length > 1) {
            const ms = now() - t;
            stats.timeouts += 1;
            slow.push({ id: null, info: `${ms} ms, lote de ${batch.length} (cancelado e dividido)` });
            const half = Math.ceil(batch.length / 2);
            retry.unshift(batch.slice(0, half), batch.slice(half));
            shrink(batch.length);
            onSlow({ ms, size: batch.length, next: size, timedOut: true });
            continue;
          }
          failures.push({ id: null, info: `${err?.code ?? 'erro'} (lote de ${batch.length})` });
        }
      }
    }));
  } finally {
    await Promise.all(clients.map((c) => c.end().catch(() => {})));
  }
  return { rows, failures, slow, stats };
}

/** Limites das credenciais; na stack local, os testes podem baixá-los por variável de ambiente. */
function credentialLimits(local) {
  const fromEnv = (name, fallback) => {
    const v = process.env[name];
    if (!local || v === undefined) return fallback;
    if (!/^\d+$/.test(v) || Number(v) < 1) throw new Error(`${name} precisa ser um inteiro positivo.`);
    return Number(v);
  };
  return { slowMs: fromEnv('ACCOUNTS_TEST_SLOW_MS', SLOW_BATCH_MS), timeoutMs: fromEnv('ACCOUNTS_TEST_TIMEOUT_MS', CREDENTIAL_TIMEOUT_MS) };
}

async function main() {
  const args = parseCli({
    yes: { type: 'boolean', default: false },
    concurrency: { type: 'string' },
    'batch-size': { type: 'string' },
    'out-dir': { type: 'string' },
  }, USAGE);
  const dryRun = args['dry-run'];
  const concurrency = parseIntOption(args.concurrency, '--concurrency', { min: 1, max: 8, fallback: 4 });
  const config = loadConfig(args.config);
  const pgo = postgresOptions(config.values);
  const batchSize = parseIntOption(args['batch-size'], '--batch-size', {
    min: 1, max: 100, fallback: pgo.describe.local ? DEFAULT_BATCH_LOCAL : DEFAULT_BATCH_REMOTE });
  const auth = authAdminOptions(config.values, pgo.describe);

  log(`Contas e credenciais legadas${dryRun ? ' (--dry-run: nada é criado nem gravado)' : ''}`);
  log(`  Destino: Postgres ${pgo.describe.host}:${pgo.describe.port}/${pgo.describe.database}${pgo.describe.local ? ' (stack local)' : ''}`
    + ` · Auth ${auth.describe.host}`);
  if (!pgo.describe.local && !dryRun && !args.yes) {
    throw new Error('O destino não é a stack local: para criar as contas, rode com --yes (ou veja antes com --dry-run).');
  }

  const admin = createAuthAdmin(auth);
  const client = await connectPostgres(pgo.options);
  const timings = [];
  const t0 = Date.now();
  let tStep = t0;
  const lap = (label) => { const now = Date.now(); timings.push([label, `${((now - tStep) / 1000).toFixed(1)} s`]); tStep = now; };
  let runId = null;
  let counts = {};
  let issues = [];
  const extra = {};
  let status = 'failed';
  let failure = null;
  try {
    await assertSessionPinned(client);
    await client.query(`SET lock_timeout = '5s'`);
    await precheck(client);
    await takeLock(client);
    try {
      await admin.ping();
    } catch (err) {
      if (err instanceof AuthAdminError) {
        throw new Error(`A Admin API do Auth recusou a chave ou não respondeu (${err.message}). Confira SUPABASE_URL e a chave secreta.`);
      }
      throw err;
    }

    await client.query(readSql(PLAN_FILE));
    counts.plan = (await client.query(PLAN_COUNTS_SQL)).rows[0].counts;
    issues = await readIssues(client);
    lap('plano');

    const a = counts.plan.actions;
    log('');
    log(`Membros carregados: ${formatInt(counts.plan.loaded)} · criar conta: ${formatInt(a.create ?? 0)} · `
      + `religar: ${formatInt(a.relink ?? 0)} · já ligados: ${formatInt(a.linked ?? 0)} · adotados com conta: ${formatInt(a.adopted ?? 0)} · `
      + `excluídos: ${formatInt(a.deleted ?? 0)} · sem identificador: ${formatInt(a.no_identifier ?? 0)}`
      + `${a.blocked ? ` · bloqueados: ${formatInt(a.blocked)}` : ''}`);
    const f = counts.plan.forecast;
    log(`Credenciais (previsão): novas ${formatInt(f.created ?? 0)}, pendentes a conferir ${formatInt(f.pending_recheck ?? 0)}, `
      + `já usadas ${formatInt(f.kept_used ?? 0)}, com senha no novo ${formatInt(f.has_password ?? 0)}, `
      + `sem senha utilizável ${formatInt(f.unusable_md5 ?? 0)} (só depois de passar para minúsculas e tirar os espaços das pontas: ${formatInt(counts.plan.forecast_md5_normalized)})`);
    log('');
    printIssues(issues);

    const blocking = blockingAccountIssues(issues);
    if (blocking.length) {
      log('');
      throw new Error(`Interrompido antes de criar contas: ${blocking.map((b) => b.code).join(', ')}. Nada foi criado.`);
    }
    if (dryRun) {
      log('');
      log(`Tempo: ${timings.map(([k, v]) => `${k} ${v}`).join(' · ')}`);
      log('Plano ok. Nada foi criado (--dry-run).');
      status = 'ok';
      return;
    }

    await ensureRunsTable(client);
    ({ rows: [{ id: runId }] } = await client.query(`INSERT INTO ${RUNS} (tool_commit) VALUES ($1) RETURNING id`, [gitCommit()]));

    // 2. Contas.
    const { rows: toCreate } = await client.query(`SELECT id, legacy_id, tech_email FROM acc_plan WHERE action = 'create' ORDER BY legacy_id`);
    const { rows: toRelink } = await client.query(`SELECT id, legacy_id FROM acc_plan WHERE action = 'relink' ORDER BY legacy_id`);
    const created = [];
    const relinked = toRelink.map((r) => r.id);
    const createFailed = [];
    let doneCount = 0;
    await runPool(toCreate, concurrency, async (row) => {
      let r;
      try {
        r = await ensureAccount(admin, { id: row.id, email: row.tech_email, legacyId: row.legacy_id });
      } catch (err) {
        r = { outcome: 'failed', info: safeErrorMessage(err).slice(0, 60) };
      }
      if (r.outcome === 'created') created.push(row.id);
      else if (r.outcome === 'relinked') relinked.push(row.id);
      else createFailed.push({ id: row.legacy_id, info: r.info });
      doneCount += 1;
      if (doneCount % 500 === 0) log(`  … ${formatInt(doneCount)} de ${formatInt(toCreate.length)} contas`);
    });
    extra.account_create_failed = createFailed;
    lap('contas');

    // 3. Ligação (inclusive das criadas antes de uma falha: refazer acha as contas e só religa).
    const linked = await linkAccounts(client, [...created, ...relinked]);
    // Conta criada (ou achada) de quem foi excluído antes da ligação: a ligação o pula; fica
    // como está e é listada (PR4-8). Nas próximas execuções, o plano lista o mesmo caso.
    const { rows: unlinkedDeleted } = await client.query(`
      SELECT m.legacy_id FROM public.members m
       WHERE m.id = ANY ($1::uuid[]) AND m.deleted_at IS NOT NULL AND m.auth_user_id IS NULL
       ORDER BY 1`, [[...created, ...relinked]]);
    extra.account_unlinked_deleted_member = unlinkedDeleted.map((r) => ({ id: r.legacy_id, info: 'excluído durante a execução' }));
    lap('ligação');
    counts.accounts = {
      created: created.length, relinked: relinked.length, failed: createFailed.length, linked: linked.length,
    };
    log(`Contas: ${formatInt(created.length)} criadas, ${formatInt(relinked.length)} religadas, ${formatInt(linked.length)} ligadas`
      + `${createFailed.length ? `, ${formatInt(createFailed.length)} com falha` : ''}`);
    if (createFailed.length) {
      throw new Error(`${createFailed.length} conta(s) não foram criadas (account_create_failed). As criadas ficaram ligadas; `
        + 'rode de novo para completar (as credenciais ficam para a próxima execução).');
    }

    // 4. Credenciais: os elegíveis já ligados à conta criada pela carga.
    const { rows: targets } = await client.query(`
      SELECT p.id FROM acc_plan p JOIN public.members m ON m.id = p.id
       WHERE p.action IN ('create', 'relink', 'linked') AND m.auth_user_id = m.id AND m.deleted_at IS NULL
       ORDER BY p.legacy_id`);
    const { rows: credRows, failures, slow, stats: batchStats } = await loadCredentials(pgo.options, targets.map((t) => t.id), {
      concurrency, batchSize, ...credentialLimits(pgo.describe.local),
      onSlow: ({ ms, size, next, timedOut }) => warn(`lote de ${size} credenciais ${timedOut ? 'cancelado no teto' : 'lento'} `
        + `(${(ms / 1000).toFixed(1)} s); os próximos com ${next}. Use um --batch-size menor.`),
    });
    lap('credenciais');
    extra.credential_batch_slow = slow;
    const byResult = Object.fromEntries(CREDENTIAL_RESULTS.map((k) => [k, 0]));
    for (const k of CREDENTIAL_RESULTS) extra[`credential_${k}`] = [];
    extra.credential_md5_normalized = [];
    for (const r of credRows) {
      if (!(r.result in byResult)) throw new Error(`Resultado inesperado da add_legacy_credential: ${r.result}`);
      byResult[r.result] += 1;
      extra[`credential_${r.result}`].push({ id: r.legacy_id, info: null });
      if (r.normalized && ['created', 'updated', 'unchanged'].includes(r.result)) {
        extra.credential_md5_normalized.push({ id: r.legacy_id, info: null });
      }
    }
    extra.credential_batch_failed = failures;
    counts.credentials = { ...byResult, md5_normalized: extra.credential_md5_normalized.length,
      processed: credRows.length, targets: targets.length, batches: batchStats };
    log(`Credenciais: ${CREDENTIAL_RESULTS.map((k) => `${k} ${formatInt(byResult[k])}`).join(', ')}`
      + ` (só depois de passar para minúsculas e tirar os espaços das pontas: ${formatInt(counts.credentials.md5_normalized)})`);
    if (failures.length) {
      throw new Error(`Lote(s) de credenciais falharam (${failures.map((x) => x.info).join('; ')}). `
        + 'O que já foi feito ficou; rode de novo para completar.');
    }
    if (byResult.not_eligible) {
      throw new Error('A private.add_legacy_credential recusou membros ligados (credential_not_eligible). Confira e rode de novo.');
    }

    // 5. Validação.
    const { rows: problems } = await client.query(readSql(VALIDATE_FILE));
    const privilegeProblems = await legacyPrivilegeProblems(client, await existingApiRoles(client));
    lap('validação');
    for (const p of problems) {
      (extra[p.code] ??= []).push({ id: p.legacy_id, info: p.info });
    }
    if (problems.length || privilegeProblems.length) {
      for (const p of privilegeProblems) log(`  privilégio: ${p}`);
      throw new Error(`Validação falhou: ${[...new Set(problems.map((p) => p.code))].join(', ') || 'privilégios do schema legacy'}.`);
    }
    status = 'ok';
  } catch (err) {
    failure = err;
  } finally {
    issues = mergeIssues(issues, extra);
    try {
      if (runId != null) {
        const lists = Object.fromEntries(issues.map((i) => [i.code, i.items.map((x) => x.id).filter((v) => v != null)]));
        await client.query(`UPDATE ${RUNS} SET finished_at = clock_timestamp(), status = $2, counts = $3, lists = $4 WHERE id = $1`,
          [runId, status, JSON.stringify(counts), JSON.stringify(lists)]);
      }
    } catch (err) {
      warn(`não foi possível registrar a execução em legacy._accounts_runs (${safeErrorMessage(err)})`);
    }
    await client.end().catch(() => {});
  }

  if (runId != null) {
    // O plano já foi impresso; agora, as listas das credenciais e as falhas.
    log('');
    printIssues(issues.filter((i) => AFTER_RUN_LISTS.has(i.code) || accountCodeInfo(i.code)?.category === 'failure'));
    log(`Tempo: ${timings.map(([k, v]) => `${k} ${v}`).join(' · ')} · total ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    const date = spFormat({});
    const outDir = resolve(args['out-dir'] ?? resolve(MIGRATION_ROOT, 'reports'));
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, `contas-${date}-${runId}.md`);
    writeFileSync(outPath, renderMarkdown({
      date, full: spFormat({ dateStyle: 'short', timeStyle: 'medium' }), runId, counts, issues, timings, status,
    }), { mode: 0o600 });
    log(`Execução #${runId} ${status === 'ok' ? 'concluída' : 'com falha'}. Relatório em ${outPath}`);
  }
  if (failure) throw failure;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) runMain(main);
