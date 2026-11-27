#!/usr/bin/env node
// Limpeza do ensaio da carga (spec docs/specs/e4-carga.md, DT-13; plano 5.1 e 5.7 do
// docs/migracao.md; Q-E4-2: sai tudo o que é da carga e o que foi criado no ensaio em cima
// dela; Q-E4-5: a Auditoria fica).
//
//   1. banco, numa transação, como postgres, em session_replication_role = replica, com as
//      quatro tabelas travadas em EXCLUSIVE (como a carga):
//      plano (sql/unload/10_plan.sql): o que sai (a carga e o ensaio que depende dela), os
//      adotados que voltam à linha de antes, as contas a apagar e os bloqueios. Bloqueio
//      desfaz tudo antes de apagar;
//      gravação (50_write.sql): participantes, relatórios, células e membros que saem, com as
//      linhas deles em private.*; os adotados de volta (legacy_id nulo); cônjuge; autoria que
//      apontava para quem saiu vira "desconhecido"; o cofre das contas que saem;
//      legacy._load_runs marcadas como desfeitas e legacy._load_adopted vazia;
//      recálculos (70_backfill.sql) e validação (90_validate.sql + FKs pelo catálogo);
//      a execução vai para legacy._unload_runs com as contas pendentes, e só então o commit;
//   2. Auth, depois do commit, pela Admin API: apaga as contas pendentes (as sessões, as
//      identidades e o que sobrou do cofre caem em cascata). Idempotente: conta que já não
//      existe conta como apagada; falha deixa a execução com as pendentes, e rodar de novo
//      completa (inclusive sem carga no destino). Antes de apagar, confere que nenhum
//      cadastro aponta para a conta.
// A trava consultiva comum (mci.e4.load), por sessão, vale do começo ao fim: carga, contas e
// limpeza não rodam juntas.
//
// --dry-run: roda o banco inteiro e desfaz (ROLLBACK); nada é apagado no Auth e nenhum arquivo
// é gravado. Mostra o número de confirmação (registros que a limpeza mexe). Fora da stack local,
// gravar exige --yes e --confirm <esse número>.
// Nada de nome, e-mail, CPF ou telefone no terminal ou no relatório: só Ids do legado, ids de
// registros do novo, códigos e contagens.

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, postgresOptions, authAdminOptions, MIGRATION_ROOT } from './lib/config.mjs';
import { parseCli, log, warn, runMain, formatInt, gitCommit, safeErrorMessage } from './lib/cli.mjs';
import { connectPostgres, existingApiRoles, legacyPrivilegeProblems } from './lib/postgres.mjs';
import { LEGACY_SCHEMA, qPg } from './lib/legacy-schema.mjs';
import { createAuthAdmin, ensureAccountDeleted, runPool, AuthAdminError } from './lib/auth-admin.mjs';
import { parseIntOption } from './lib/account-codes.mjs';
import {
  UNLOAD_CATEGORIES, unloadCodeInfo, blockingUnloadIssues, confirmationCount, parseConfirm,
} from './lib/unload-codes.mjs';
import { assertSessionPinned } from './accounts.mjs';
import { LOAD_LOCK_KEY, LOAD_TABLES } from './load.mjs';

const USAGE = `
Uso: node src/unload.mjs [--config <arquivo>] [--dry-run] [--yes] [--confirm <n>] [--undo-final]
                          [--concurrency 4] [--out-dir <pasta>]

  --config       arquivo de configuração (padrão: MCI_LOCAL_CONFIG ou <raiz>/local.config)
  --dry-run      roda a limpeza no banco e desfaz no fim; nada é apagado (nem no Auth) e nenhum
                 arquivo é gravado. Mostra o número de confirmação
  --yes          confirma a gravação num destino que não é a stack local (sem --dry-run, é obrigatório)
  --confirm      o número de confirmação do --dry-run (obrigatório fora da stack local): se o plano
                 mudou desde o --dry-run, a limpeza para sem apagar nada
  --undo-final   desfaz mesmo depois de uma carga --final (cutover) não desfeita. Só com ordem
                 expressa: apaga dados que já são usados em produção
  --concurrency  contas apagadas no Auth ao mesmo tempo (1 a 8; padrão 4)
  --out-dir      pasta do relatório (padrão: data-migration/reports)

Precisa, além do banco: SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY) e, na stack local,
SUPABASE_URL (a API da mesma stack). Fora dela, o endereço é https://<ref>.supabase.co.
`;

export const SQL_DIR = resolve(MIGRATION_ROOT, 'sql', 'unload');
export const PLAN_FILE = '10_plan.sql';
export const WRITE_FILES = ['50_write.sql', '70_backfill.sql'];
export const VALIDATE_FILE = '90_validate.sql';
const L = qPg(LEGACY_SCHEMA);
const RUNS = `${L}._unload_runs`;
const LOAD_RUNS = `${L}._load_runs`;
const OPEN_LIST_LIMIT = 30;

const readSql = (name) => readFileSync(resolve(SQL_DIR, name), 'utf8');
const pgLiteral = (s) => `'${String(s).replaceAll("'", "''")}'`;

async function takeLock(client) {
  const { rows: [r] } = await client.query('SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS ok', [LOAD_LOCK_KEY]);
  if (!r.ok) {
    throw new Error('Outra carga, criação de contas ou limpeza está em andamento neste destino. Espere ela terminar e rode de novo.');
  }
}

/** O que existe no destino: o legacy_id do E4 PR 1, o controle da carga e o desta limpeza. */
async function destinationState(client) {
  const { rows: [s] } = await client.query(`
    SELECT (SELECT count(*) FROM information_schema.columns
             WHERE table_schema = 'public' AND column_name = 'legacy_id'
               AND table_name IN ('members', 'cells', 'cell_reports'))::int AS legacy_cols,
           to_regnamespace($1) IS NOT NULL AS legacy_schema,
           to_regclass($1 || '._load_runs') IS NOT NULL AS load_runs,
           to_regclass($1 || '._load_adopted') IS NOT NULL AS load_adopted,
           to_regclass($1 || '._unload_runs') IS NOT NULL AS unload_runs,
           to_regprocedure('public._del_resume_access(uuid)') IS NOT NULL AS resume_fn`, [LEGACY_SCHEMA]);
  if (s.legacy_cols !== 3) {
    throw new Error('O destino não tem o legacy_id do E4 PR 1 (migration 20261203100000_e4_01_load_support).');
  }
  if (!s.resume_fn) throw new Error('O destino não tem a public._del_resume_access (E2.01).');
  const { rows: [c] } = await client.query(`SELECT
      EXISTS (SELECT 1 FROM public.members WHERE legacy_id IS NOT NULL)
      OR EXISTS (SELECT 1 FROM public.cells WHERE legacy_id IS NOT NULL)
      OR EXISTS (SELECT 1 FROM public.cell_reports WHERE legacy_id IS NOT NULL) AS loaded`);
  return { ...s, loaded: c.loaded };
}

/** Carga --final gravada e não desfeita (cutover): desfazer apagaria dados já usados. */
async function finalLoadDone(client) {
  const { rows } = await client.query(`SELECT id FROM ${LOAD_RUNS}
     WHERE mode = 'final' AND undone_at IS NULL AND finished_at IS NOT NULL ORDER BY id DESC LIMIT 1`);
  return rows[0] ?? null;
}

async function ensureRunsTable(client) {
  const roles = await existingApiRoles(client);
  const revokeFrom = ['PUBLIC', ...roles.map(qPg)].join(', ');
  await client.query(`CREATE TABLE IF NOT EXISTS ${RUNS} (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    db_finished_at timestamptz,
    finished_at timestamptz,
    status text NOT NULL DEFAULT 'auth_pending' CHECK (status IN ('auth_pending', 'ok', 'failed', 'superseded')),
    tool_commit text,
    counts jsonb NOT NULL DEFAULT '{}'::jsonb,
    lists jsonb NOT NULL DEFAULT '{}'::jsonb,
    pending_accounts uuid[] NOT NULL DEFAULT '{}'
  )`);
  await client.query(`ALTER TABLE ${RUNS} ENABLE ROW LEVEL SECURITY`);
  await client.query(`REVOKE ALL ON ${RUNS} FROM ${revokeFrom}`);
  await client.query(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA ${L} FROM ${revokeFrom}`);
}

/**
 * Conferência das FKs depois da limpeza (o replica não confere): as das quatro tabelas e todas
 * as que apontam para members, cells, cell_reports e auth.users fora do schema auth, a partir do
 * catálogo. Uma linha (item, detalhe, quantidade) por FK com referência quebrada.
 */
export async function fkProblemsSql(client) {
  const { rows } = await client.query(`
    SELECT c.conname, c.conrelid::regclass::text AS tbl, a.attname AS col,
           c.confrelid::regclass::text AS ref_tbl, ra.attname AS ref_col
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      JOIN pg_attribute ra ON ra.attrelid = c.confrelid AND ra.attnum = c.confkey[1]
     WHERE c.contype = 'f' AND cardinality(c.conkey) = 1 AND n.nspname <> 'auth'
       AND (c.conrelid = ANY (ARRAY['public.members', 'public.cells', 'public.cell_reports',
                                    'public.cell_report_participants']::regclass[])
            OR c.confrelid = ANY (ARRAY['public.members', 'public.cells', 'public.cell_reports', 'auth.users']::regclass[]))
     ORDER BY 1`);
  if (!rows.length) throw new Error('Nenhuma FK encontrada nas tabelas da limpeza.');
  return rows.map((r) => `SELECT ${pgLiteral(`fk:${r.conname}`)} AS item, ${pgLiteral(r.tbl)} AS detail, count(*) AS n `
    + `FROM ${r.tbl} t WHERE t.${qPg(r.col)} IS NOT NULL `
    + `AND NOT EXISTS (SELECT 1 FROM ${r.ref_tbl} x WHERE x.${qPg(r.ref_col)} = t.${qPg(r.col)}) HAVING count(*) > 0`)
    .join('\nUNION ALL\n');
}

const PLAN_COUNTS_SQL = `
  SELECT jsonb_build_object(
    't0', (SELECT t0 FROM ul_cfg),
    'members', (SELECT count(*) FROM ul_members),
    'members_load', (SELECT count(*) FROM ul_members WHERE kind = 'load'),
    'members_rehearsal', (SELECT count(*) FROM ul_members WHERE kind = 'rehearsal'),
    'cells', (SELECT count(*) FROM ul_cells),
    'cells_rehearsal', (SELECT count(*) FROM ul_cells WHERE kind = 'rehearsal'),
    'reports', (SELECT count(*) FROM ul_reports),
    'reports_rehearsal', (SELECT count(*) FROM ul_reports WHERE kind = 'rehearsal'),
    'participants', (SELECT count(*) FROM public.cell_report_participants p
                      WHERE p.report_id IN (SELECT id FROM ul_reports) OR p.member_id IN (SELECT id FROM ul_members)),
    'adopted', (SELECT count(*) FROM ul_adopted WHERE exists_),
    'accounts', (SELECT count(*) FROM ul_accounts),
    'accounts_by_reason', (SELECT coalesce(jsonb_object_agg(why, n), '{}'::jsonb)
                             FROM (SELECT why, count(*) AS n FROM ul_accounts GROUP BY why) x)
  ) AS counts`;

async function readIssues(client) {
  const { rows } = await client.query(`
    SELECT code, count(*)::int AS n,
           coalesce(jsonb_agg(jsonb_build_object('id', legacy_id, 'ref', ref, 'info', nullif(info, ''))
                              ORDER BY legacy_id NULLS LAST, ref, info), '[]'::jsonb) AS items
      FROM ul_issues GROUP BY code ORDER BY code`);
  return rows;
}

const itemLabel = (i) => {
  const who = i.id != null ? `${i.id}` : (i.ref ?? '');
  return i.info ? `${who} (${i.info})` : who;
};

function printIssues(issues, limit = 20) {
  for (const [cat, label] of UNLOAD_CATEGORIES) {
    const rows = issues.filter((i) => (unloadCodeInfo(i.code)?.category ?? 'block') === cat);
    if (!rows.length) continue;
    log(`${label}:`);
    for (const r of rows) {
      const shownLimit = cat === 'block' ? limit : Math.min(limit, 10);
      const ids = r.items.map(itemLabel).filter(Boolean);
      const shown = ids.slice(0, shownLimit).join(', ') + (ids.length > shownLimit ? `, … (+${ids.length - shownLimit})` : '');
      log(`  ${String(formatInt(r.n)).padStart(6)}  ${r.code}${cat === 'block' ? '  [PARA]' : ''}: ${shown}`);
    }
  }
}

const mdEscape = (s) => String(s ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');

function renderMarkdown({ date, full, runId, counts, issues, timings, status }) {
  const out = [];
  out.push(`# Relatório da limpeza do ensaio (${date})`, '');
  out.push('> **Dados pessoais (LGPD).** Só Ids do legado, ids de registros do novo e contagens, mas sobre membros de uma');
  out.push('> igreja: fica em `data-migration/reports/` (ignorada pelo git); não envie por canais abertos e apague depois do uso.', '');
  out.push(`- Gerado em: ${full} (horário de Brasília)`);
  out.push(`- Execução: #${runId} (\`legacy._unload_runs\`), situação: ${status === 'ok' ? 'concluída' : '**contas pendentes no Auth**'}`);
  out.push(`- Tempo: ${timings.map(([k, v]) => `${k} ${v}`).join(' · ')}`, '');
  out.push('## Contagens', '', '```json', JSON.stringify(counts, null, 2), '```', '');
  out.push('## Ocorrências', '');
  for (const [cat, label] of UNLOAD_CATEGORIES) {
    const rows = issues.filter((i) => (unloadCodeInfo(i.code)?.category ?? 'block') === cat);
    out.push(`### ${label}`, '');
    if (!rows.length) { out.push('Nenhuma.', ''); continue; }
    for (const r of rows) {
      out.push(`#### \`${r.code}\` (${formatInt(r.n)})`, '', mdEscape(unloadCodeInfo(r.code)?.title ?? ''), '');
      const table = ['| Id do legado | Registro do novo | Observação |', '|---:|---|---|',
        ...r.items.map((i) => `| ${i.id ?? '—'} | ${i.ref ?? '—'} | ${mdEscape(i.info ?? '')} |`)];
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

/**
 * Contas a apagar no Auth: as desta execução, as pendentes de execuções anteriores que não
 * terminaram e as que levam o Id do legado no app_metadata. Só as que existem e que nenhum
 * cadastro aponta (members.auth_user_id). Devolve { ids, kept } (kept = pendentes que voltaram a
 * ter cadastro ligado).
 */
async function accountsToDelete(client, fromThisRun, unloadRunsExist) {
  const previous = unloadRunsExist
    ? (await client.query(`SELECT coalesce(array_agg(DISTINCT a), '{}') AS ids
                             FROM ${RUNS}, unnest(pending_accounts) a WHERE status IN ('auth_pending', 'failed')`)).rows[0].ids
    : [];
  const { rows } = await client.query(`
    WITH c AS (
      SELECT unnest($1::uuid[]) AS id
      UNION
      SELECT u.id FROM auth.users u WHERE u.raw_app_meta_data ? 'legacy_member_id'
    )
    SELECT c.id, EXISTS (SELECT 1 FROM public.members m WHERE m.auth_user_id = c.id) AS linked
      FROM c WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = c.id)
     ORDER BY c.id`, [[...new Set([...fromThisRun, ...previous])]]);
  return { ids: rows.filter((r) => !r.linked).map((r) => r.id), kept: rows.filter((r) => r.linked).map((r) => r.id) };
}

async function main() {
  const args = parseCli({
    yes: { type: 'boolean', default: false },
    confirm: { type: 'string' },
    'undo-final': { type: 'boolean', default: false },
    concurrency: { type: 'string' },
    'out-dir': { type: 'string' },
  }, USAGE);
  const dryRun = args['dry-run'];
  const confirm = parseConfirm(args.confirm);
  const concurrency = parseIntOption(args.concurrency, '--concurrency', { min: 1, max: 8, fallback: 4 });
  const config = loadConfig(args.config);
  const pgo = postgresOptions(config.values);
  const auth = authAdminOptions(config.values, pgo.describe);

  log(`Limpeza do ensaio da carga${dryRun ? ' (--dry-run: tudo é desfeito no fim; nada sai do Auth)' : ''}`);
  log(`  Destino: Postgres ${pgo.describe.host}:${pgo.describe.port}/${pgo.describe.database}${pgo.describe.local ? ' (stack local)' : ''}`
    + ` · Auth ${auth.describe.host}`);
  if (!pgo.describe.local && !dryRun) {
    if (!args.yes) throw new Error('O destino não é a stack local: para apagar, rode com --yes (veja antes com --dry-run).');
    if (confirm == null) {
      throw new Error('O destino não é a stack local: rode antes com --dry-run e passe o número de confirmação em --confirm.');
    }
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
  let pendingThisRun = [];
  let status = 'failed';
  let state;
  let toDelete = [];
  const done = new Set();
  const authIssues = { account_delete_failed: [], account_kept_linked: [] };
  try {
    await assertSessionPinned(client);
    await client.query(`SET lock_timeout = '5s'`);
    await takeLock(client);
    try {
      await admin.ping();
    } catch (err) {
      if (err instanceof AuthAdminError) {
        throw new Error(`A Admin API do Auth recusou a chave ou não respondeu (${err.message}). Confira SUPABASE_URL e a chave secreta.`);
      }
      throw err;
    }
    state = await destinationState(client);
    const control = state.load_runs && state.load_adopted;
    if (state.loaded && !control) {
      throw new Error('Há carga no destino, mas o controle dela (legacy._load_runs, legacy._load_adopted) não existe. Conferir antes.');
    }

    // 1. Banco.
    let dbDone = false;
    if (control) {
      await client.query('BEGIN');
      try {
        await client.query('SET LOCAL session_replication_role = replica');
        await client.query(`SET LOCAL lock_timeout = '5s'`);
        await client.query(`SET LOCAL statement_timeout = '15min'`);
        await client.query(`LOCK TABLE ${LOAD_TABLES.map((t) => `public.${t}`).join(', ')} IN EXCLUSIVE MODE`);
        const finalRun = await finalLoadDone(client);
        if (finalRun && !args['undo-final']) {
          if (!dryRun) {
            throw new Error(`A carga final (cutover, execução #${finalRun.id}) foi gravada neste destino e não foi desfeita. `
              + 'Desfazer agora apagaria dados que já são usados no novo. Só rode com ordem expressa, com --undo-final.');
          }
          warn(`A carga final (execução #${finalRun.id}) foi gravada neste destino; o --dry-run segue (nada é apagado), `
            + 'mas a limpeza de verdade exige --undo-final.');
        } else if (finalRun) {
          warn(`Desfazendo a carga final (execução #${finalRun.id}), por --undo-final.`);
        }

        await client.query(readSql(PLAN_FILE));
        counts.plan = (await client.query(PLAN_COUNTS_SQL)).rows[0].counts;
        issues = await readIssues(client);
        lap('plano');

        const p = counts.plan;
        log('');
        log(`Sai: ${formatInt(p.members)} membros (da carga ${formatInt(p.members_load)}, do ensaio ${formatInt(p.members_rehearsal)}), `
          + `${formatInt(p.cells)} células (do ensaio ${formatInt(p.cells_rehearsal)}), `
          + `${formatInt(p.reports)} relatórios (do ensaio ${formatInt(p.reports_rehearsal)}), `
          + `${formatInt(p.participants)} participantes`);
        log(`Volta à linha de antes: ${formatInt(p.adopted)} adotados · contas a apagar no Auth: ${formatInt(p.accounts)}`
          + `${p.accounts ? ` (${Object.entries(p.accounts_by_reason).map(([k, v]) => `${k} ${formatInt(v)}`).join(', ')})` : ''}`);
        log('');
        printIssues(issues);

        const blocking = blockingUnloadIssues(issues);
        if (blocking.length) {
          log('');
          throw new Error(`Limpeza interrompida antes de apagar: ${blocking.map((b) => b.code).join(', ')}. Nada foi apagado.`);
        }
        const number = confirmationCount(p);
        log('');
        log(`Número de confirmação: ${number}`);
        if (confirm != null && confirm !== number) {
          throw new Error(`O número de confirmação mudou (--confirm ${confirm}, agora ${number}): o destino mudou desde o --dry-run. `
            + 'Nada foi apagado; rode o --dry-run de novo.');
        }

        if (number > 0) {
          for (const f of WRITE_FILES) await client.query(readSql(f));
          lap('gravação e recálculos');
          const { rows: problems } = await client.query(`${readSql(VALIDATE_FILE).replace(/ORDER BY 1, 2;\s*$/, '')}
            UNION ALL ${await fkProblemsSql(client)} ORDER BY 1, 2`);
          const privilegeProblems = await legacyPrivilegeProblems(client, await existingApiRoles(client));
          lap('validação');
          if (problems.length || privilegeProblems.length) {
            log('');
            log('Validação falhou; nada foi apagado:');
            for (const r of problems) log(`  ${r.item} / ${r.detail}: ${r.n}`);
            for (const r of privilegeProblems) log(`  privilégio: ${r}`);
            throw new Error('Validação da limpeza falhou.');
          }
          counts.write = Object.fromEntries((await client.query('SELECT step, n FROM ul_counts ORDER BY step')).rows
            .map((r) => [r.step, Number(r.n)]));
          pendingThisRun = (await client.query('SELECT id FROM ul_accounts ORDER BY id')).rows.map((r) => r.id);
        }

        if (dryRun || number === 0) {
          await client.query('ROLLBACK');
        } else {
          await ensureRunsTable(client);
          state.unload_runs = true;
          const lists = Object.fromEntries(issues.map((i) => [i.code, i.items.map((x) => x.id ?? x.ref).filter((v) => v != null)]));
          ({ rows: [{ id: runId }] } = await client.query(
            `INSERT INTO ${RUNS} (db_finished_at, tool_commit, counts, lists, pending_accounts)
             VALUES (clock_timestamp(), $1, $2, $3, $4) RETURNING id`,
            [gitCommit(), JSON.stringify(counts), JSON.stringify(lists), pendingThisRun],
          ));
          await client.query('COMMIT');
          dbDone = true;
          toDelete = pendingThisRun; // se algo falhar antes das contas, ficam pendentes na execução
          for (const t of LOAD_TABLES) await client.query(`ANALYZE public.${t}`);
          lap('ANALYZE');
        }
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      }
    }

    // 2. Auth.
    if (dryRun) {
      // O --dry-run desfez o banco: os cadastros que saem ainda apontam para as contas deles. A
      // previsão = as do plano + as pendentes de limpezas anteriores e as com Id do legado sem cadastro.
      const other = await accountsToDelete(client, [], state.unload_runs);
      const forecast = new Set([...pendingThisRun, ...other.ids]).size;
      log(`Contas a apagar no Auth (com as pendentes de limpezas anteriores): ${formatInt(forecast)}`);
      log('');
      log(`Tempo: ${timings.map(([k, v]) => `${k} ${v}`).join(' · ')}`);
      log(`Nada foi apagado (--dry-run).${control ? '' : ' Não há carga no destino.'}`);
      status = 'ok';
      return;
    }
    const found = await accountsToDelete(client, pendingThisRun, state.unload_runs);
    toDelete = found.ids;
    authIssues.account_kept_linked = found.kept.map((id) => ({ id: null, ref: id, info: null }));
    if (!dbDone && !toDelete.length) {
      log('');
      log('Nada a desfazer: não há carga, ensaio nem contas da carga no destino.');
      status = 'ok';
      return;
    }
    if (!dbDone && state.legacy_schema) {
      await ensureRunsTable(client);
      state.unload_runs = true;
      ({ rows: [{ id: runId }] } = await client.query(
        `INSERT INTO ${RUNS} (tool_commit, pending_accounts) VALUES ($1, $2) RETURNING id`, [gitCommit(), toDelete],
      ));
    } else if (runId != null) {
      await client.query(`UPDATE ${RUNS} SET pending_accounts = $2 WHERE id = $1`, [runId, toDelete]);
    }
    const deleted = [];
    const gone = [];
    let doneCount = 0;
    await runPool(toDelete, concurrency, async (id) => {
      // Ninguém pode ter se ligado à conta desde o plano (a trava impede carga e contas).
      const { rows: [l] } = await client.query('SELECT EXISTS (SELECT 1 FROM public.members WHERE auth_user_id = $1) AS linked', [id]);
      if (l.linked) { authIssues.account_kept_linked.push({ id: null, ref: id, info: null }); done.add(id); return; }
      let r;
      try {
        r = await ensureAccountDeleted(admin, id);
      } catch (err) {
        r = { outcome: 'failed', info: safeErrorMessage(err).slice(0, 60) };
      }
      if (r.outcome === 'deleted') { deleted.push(id); done.add(id); } else if (r.outcome === 'gone') { gone.push(id); done.add(id); }
      else authIssues.account_delete_failed.push({ id: null, ref: id, info: r.info });
      doneCount += 1;
      if (doneCount % 500 === 0) log(`  … ${formatInt(doneCount)} de ${formatInt(toDelete.length)} contas`);
    });
    lap('contas no Auth');
    const failed = authIssues.account_delete_failed;
    counts.auth = { to_delete: toDelete.length, deleted: deleted.length, already_gone: gone.length, failed: failed.length,
      kept_linked: authIssues.account_kept_linked.length };
    log(`Contas no Auth: ${formatInt(deleted.length)} apagadas, ${formatInt(gone.length)} já não existiam`
      + `${failed.length ? `, ${formatInt(failed.length)} com falha` : ''}`);
    status = failed.length ? 'failed' : 'ok';
  } finally {
    for (const [code, items] of Object.entries(authIssues)) {
      if (items.length) issues.push({ code, n: items.length, items });
    }
    try {
      if (runId != null) {
        const lists = Object.fromEntries(issues.map((i) => [i.code, i.items.map((x) => x.id ?? x.ref).filter((v) => v != null)]));
        // Pendentes = o que não foi apagado (falhou, ou a execução parou antes de chegar nela).
        const remaining = toDelete.filter((id) => !done.has(id));
        await client.query(`UPDATE ${RUNS} SET finished_at = clock_timestamp(), status = $2, counts = $3, lists = $4,
                                   pending_accounts = $5 WHERE id = $1`,
        [runId, status === 'ok' ? 'ok' : 'failed', JSON.stringify(counts), JSON.stringify(lists), remaining]);
        if (status === 'ok') {
          // As pendentes das anteriores entraram nesta execução.
          await client.query(`UPDATE ${RUNS} SET status = 'superseded', finished_at = coalesce(finished_at, clock_timestamp())
                               WHERE id <> $1 AND status IN ('auth_pending', 'failed')`, [runId]);
        }
      }
    } catch (err) {
      warn(`não foi possível registrar a execução em legacy._unload_runs (${safeErrorMessage(err)})`);
    }
    await client.end().catch(() => {});
  }

  log(`Tempo: ${timings.map(([k, v]) => `${k} ${v}`).join(' · ')} · total ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (runId != null) {
    const failures = issues.filter((i) => unloadCodeInfo(i.code)?.category === 'failure');
    if (failures.length) { log(''); printIssues(failures); }
    const date = spFormat({});
    const outDir = resolve(args['out-dir'] ?? resolve(MIGRATION_ROOT, 'reports'));
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, `limpeza-${date}-${runId}.md`);
    writeFileSync(outPath, renderMarkdown({
      date, full: spFormat({ dateStyle: 'short', timeStyle: 'medium' }), runId, counts, issues, timings, status,
    }), { mode: 0o600 });
    log(`Limpeza #${runId} ${status === 'ok' ? 'concluída' : 'com contas pendentes no Auth'}. Relatório em ${outPath}`);
  }
  if (status !== 'ok') {
    throw new Error(`${authIssues.account_delete_failed.length} conta(s) não foram apagadas no Auth (account_delete_failed). `
      + 'O banco já está limpo; rode de novo para completar.');
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) runMain(main);
