#!/usr/bin/env node
// E4.06 + E4.07: carga do legado (schema legacy) para o public do novo
// (spec docs/specs/e4-carga.md, DT-04 a DT-12; plano 5.4 e 5.5 do docs/migracao.md).
//
// Uma transação só, como postgres, em session_replication_role = replica, com as
// quatro tabelas travadas em EXCLUSIVE (a leitura continua). SQL em sql/load/*.sql,
// só por conjuntos (INSERT … SELECT FROM legacy.…), sem parâmetro com dado pessoal:
// os únicos valores passados são Ids do legado (pastores e Administradores) e o
// número da execução. Ordem: membros → mapa e adoção → células → relatórios e
// participantes → (para aqui se houver bloqueio) → gravação → recálculo da
// hierarquia → funções → períodos ativos → validação → commit → ANALYZE.
//
// --dry-run roda tudo e desfaz (ROLLBACK), com as contagens e as listas.
// --final (cutover) para em qualquer pendência "corrigir no legado" (DT-12); o
// padrão é o ensaio, que neutraliza e lista.
// Nada de nome, e-mail, CPF ou telefone no terminal ou no relatório: só Ids do
// legado, códigos e contagens.

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, postgresOptions, MIGRATION_ROOT } from './lib/config.mjs';
import { parseCli, log, warn, runMain, formatInt, gitCommit } from './lib/cli.mjs';
import { connectPostgres, describeLegacy, existingApiRoles, legacyPrivilegeProblems } from './lib/postgres.mjs';
import { LEGACY_TABLES, LEGACY_SCHEMA, qPg } from './lib/legacy-schema.mjs';
import { LOAD_CATEGORIES, blockingIssues, loadCodeInfo, parseIdList } from './lib/load-codes.mjs';

const USAGE = `
Uso: node src/load.mjs [--config <arquivo>] [--dry-run] [--final] [--pastor-ids 1,2] [--admin-ids 3,4] [--out-dir <pasta>]

  --config      arquivo de configuração (padrão: MCI_LOCAL_CONFIG ou <raiz>/local.config)
  --dry-run     roda a carga inteira e desfaz no fim (nada fica gravado; nenhum arquivo)
  --final       carga do cutover: para em qualquer pendência "corrigir no legado"
  --pastor-ids  Ids do legado dos pastores da D9 (padrão: LEGACY_PASTOR_IDS)
  --admin-ids   Ids do legado dos Administradores (padrão: LEGACY_ADMIN_IDS; RN-18 do E3)
  --out-dir     pasta do relatório de carga (padrão: data-migration/reports)
`;

export const SQL_DIR = resolve(MIGRATION_ROOT, 'sql', 'load');
export const STAGE_FILES = ['10_members.sql', '20_map.sql', '30_cells.sql', '40_reports.sql'];
export const WRITE_FILES = ['60_write.sql', '70_backfill.sql'];
export const VALIDATE_FILE = '90_validate.sql';
export const LOAD_TABLES = ['members', 'cells', 'cell_reports', 'cell_report_participants'];

const RUNS = `${qPg(LEGACY_SCHEMA)}._load_runs`;
const ADOPTED = `${qPg(LEGACY_SCHEMA)}._load_adopted`;
const OPEN_LIST_LIMIT = 30;

const readSql = (name) => readFileSync(resolve(SQL_DIR, name), 'utf8');

/** Controle da carga no schema legacy (DT-05), fora da API como o resto do schema. */
async function ensureControlTables(client) {
  const roles = await existingApiRoles(client);
  const revokeFrom = ['PUBLIC', ...roles.map(qPg)].join(', ');
  await client.query(`CREATE TABLE IF NOT EXISTS ${RUNS} (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    finished_at timestamptz,
    mode text NOT NULL CHECK (mode IN ('rehearsal', 'final')),
    tool_commit text,
    counts jsonb NOT NULL DEFAULT '{}'::jsonb,
    lists jsonb NOT NULL DEFAULT '{}'::jsonb,
    undone_at timestamptz
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS ${ADOPTED} (
    member_id uuid PRIMARY KEY,
    legacy_id integer NOT NULL UNIQUE,
    before jsonb NOT NULL,
    run_id bigint NOT NULL REFERENCES ${RUNS} (id),
    adopted_at timestamptz NOT NULL DEFAULT now()
  )`);
  for (const t of [RUNS, ADOPTED]) {
    await client.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
    await client.query(`REVOKE ALL ON ${t} FROM ${revokeFrom}`);
  }
  await client.query(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA ${qPg(LEGACY_SCHEMA)} FROM ${revokeFrom}`);
}

/** Pré-condições no destino: cópia, schema do PR 1 e funções semeadas. */
async function precheck(client) {
  const state = await describeLegacy(client);
  const missing = LEGACY_TABLES.filter((t) => !state.tables.some((x) => x.name === t.name)).map((t) => t.name);
  if (!state.exists || missing.length) {
    throw new Error(`Cópia bruta ausente ou incompleta (faltam: ${missing.join(', ') || 'schema legacy'}). Rode antes: npm run copy.`);
  }
  const { rows: [s] } = await client.query(`
    SELECT (SELECT count(*) FROM information_schema.columns
             WHERE table_schema = 'public' AND column_name = 'legacy_id'
               AND table_name IN ('members', 'cells', 'cell_reports'))::int AS legacy_cols,
           to_regprocedure('public.keep_legacy_id()') IS NOT NULL AS keep_fn,
           to_regprocedure('private.legacy_authorship(text,timestamp without time zone,text,timestamp without time zone,boolean,timestamp with time zone)') IS NOT NULL AS authorship_fn,
           (SELECT count(*) FROM public.roles WHERE is_system)::int AS sys_roles,
           (SELECT count(*) FROM public.roles WHERE is_default)::int AS default_roles,
           (SELECT count(*) FROM public.roles WHERE name = 'Líder' AND NOT is_system)::int AS lider_roles`);
  if (s.legacy_cols !== 3 || !s.keep_fn) {
    throw new Error('O destino não tem o legacy_id do E4 PR 1 (migration 20261203100000_e4_01_load_support). Publique antes.');
  }
  if (!s.authorship_fn) throw new Error('O destino não tem private.legacy_authorship (E2.05).');
  if (s.sys_roles !== 1 || s.default_roles !== 1) {
    throw new Error('O destino precisa de exatamente uma função de sistema (Administrador) e uma padrão.');
  }
  if (s.lider_roles !== 1) throw new Error('A função "Líder" não foi encontrada (ou há mais de uma) no destino (DT-11).');
  return state;
}

/** Consultas que conferem as FKs das quatro tabelas, a partir do catálogo (o replica não confere). */
export async function fkCheckSql(client) {
  const { rows } = await client.query(`
    SELECT c.conname, c.conrelid::regclass::text AS tbl, a.attname AS col,
           c.confrelid::regclass::text AS ref_tbl, ra.attname AS ref_col,
           EXISTS (SELECT 1 FROM pg_attribute x WHERE x.attrelid = c.conrelid AND x.attname = 'legacy_id'
                    AND NOT x.attisdropped) AS has_legacy_id
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      JOIN pg_attribute ra ON ra.attrelid = c.confrelid AND ra.attnum = c.confkey[1]
     WHERE c.contype = 'f' AND cardinality(c.conkey) = 1
       AND c.conrelid = ANY (ARRAY['public.members', 'public.cells', 'public.cell_reports',
                                   'public.cell_report_participants']::regclass[])
     ORDER BY 1`);
  if (!rows.length) throw new Error('Nenhuma FK encontrada nas tabelas da carga.');
  return rows.map((r) => `SELECT ${pgLiteral(`fk:${r.conname}`)} AS item, 'unresolved' AS detail, `
    + `${r.has_legacy_id ? 't.legacy_id' : 'NULL::integer'} AS legacy_id `
    + `FROM ${r.tbl} t WHERE t.${qPg(r.col)} IS NOT NULL `
    + `AND NOT EXISTS (SELECT 1 FROM ${r.ref_tbl} x WHERE x.${qPg(r.ref_col)} = t.${qPg(r.col)})`).join('\nUNION ALL\n');
}

const pgLiteral = (s) => `'${String(s).replaceAll("'", "''")}'`;

async function readIssues(client) {
  const { rows } = await client.query(`
    SELECT code, count(*)::int AS n,
           coalesce(jsonb_agg(jsonb_build_object('id', legacy_id, 'info', nullif(info, ''))
                              ORDER BY legacy_id NULLS FIRST, info), '[]'::jsonb) AS items
      FROM load_issues GROUP BY code ORDER BY code`);
  return rows;
}

const STAGE_COUNTS_SQL = `
  SELECT jsonb_build_object(
    'members', jsonb_build_object(
      'legacy', (SELECT count(*) FROM lm),
      'left_out', (SELECT count(*) FROM lm WHERE NOT included),
      'to_load', (SELECT count(*) FROM member_map),
      'deleted', (SELECT count(*) FROM lm WHERE included AND del),
      'adopted_now', (SELECT count(*) FROM member_map WHERE how = 'adopted'),
      'existing', (SELECT count(*) FROM member_map WHERE how = 'existing'),
      'new', (SELECT count(*) FROM member_map WHERE how = 'new')),
    'cells', jsonb_build_object(
      'legacy', (SELECT count(*) FROM lc),
      'left_out', (SELECT count(*) FROM lc WHERE lid NOT IN (SELECT lid FROM cell_map)),
      'to_load', (SELECT count(*) FROM cell_map),
      'deleted', (SELECT count(*) FROM lc WHERE del AND lid IN (SELECT lid FROM cell_map))),
    'reports', jsonb_build_object(
      'legacy', (SELECT count(*) FROM lr),
      'left_out', (SELECT count(*) FROM lr WHERE NOT included),
      'to_load', (SELECT count(*) FROM report_map),
      'deleted', (SELECT count(*) FROM lr WHERE included AND del),
      'duplicates_deleted', (SELECT count(*) FROM lr WHERE dup_of IS NOT NULL)),
    'participants', jsonb_build_object(
      'legacy', (SELECT count(*) FROM lp),
      'left_out', (SELECT count(*) FROM lp WHERE report_id IS NULL OR member_id IS NULL),
      'to_load', (SELECT count(*) FROM (SELECT DISTINCT report_id, member_id FROM lp
                                         WHERE report_id IS NOT NULL AND member_id IS NOT NULL) x))
  ) AS counts`;

const WRITE_COUNTS_SQL = `
  SELECT jsonb_build_object(
    'members', jsonb_build_object(
      'inserted', (SELECT count(*) FROM load_written WHERE entity = 'members' AND inserted),
      'updated', (SELECT count(*) FROM load_written WHERE entity = 'members' AND NOT inserted),
      'spouse_unlinked_new', (SELECT count(*) FROM spouse_unlinked)),
    'cells', jsonb_build_object(
      'inserted', (SELECT count(*) FROM load_written WHERE entity = 'cells' AND inserted),
      'updated', (SELECT count(*) FROM load_written WHERE entity = 'cells' AND NOT inserted)),
    'reports', jsonb_build_object(
      'inserted', (SELECT count(*) FROM load_written WHERE entity = 'reports' AND inserted),
      'updated', (SELECT count(*) FROM load_written WHERE entity = 'reports' AND NOT inserted)),
    'participants', jsonb_build_object(
      'inserted', (SELECT count(*) FROM load_written WHERE entity = 'participants'),
      'removed', (SELECT count(*) FROM participants_removed)),
    'backfill', (SELECT jsonb_object_agg(step, n) FROM load_backfill),
    'roles', (SELECT jsonb_object_agg(name, n) FROM (
                SELECT r.name, count(*) AS n FROM public.members m JOIN public.roles r ON r.id = m.role_id
                 WHERE m.legacy_id IS NOT NULL GROUP BY r.name) x),
    'loaded_total', jsonb_build_object(
      'members', (SELECT count(*) FROM public.members WHERE legacy_id IS NOT NULL),
      'cells', (SELECT count(*) FROM public.cells WHERE legacy_id IS NOT NULL),
      'cell_reports', (SELECT count(*) FROM public.cell_reports WHERE legacy_id IS NOT NULL))
  ) AS counts`;

function printIssues(issues, { final, limit = 20 }) {
  const blocking = new Set(blockingIssues(issues, { final }).map((i) => i.code));
  for (const [cat, label] of LOAD_CATEGORIES) {
    const rows = issues.filter((i) => (loadCodeInfo(i.code)?.category ?? 'block') === cat);
    if (!rows.length) continue;
    log(`${label}:`);
    for (const r of rows) {
      const ids = r.items.map((i) => i.id ?? i.info).filter((v) => v != null);
      const shown = ids.slice(0, limit).join(', ') + (ids.length > limit ? `, … (+${ids.length - limit})` : '');
      log(`  ${String(formatInt(r.n)).padStart(6)}  ${r.code}${blocking.has(r.code) ? '  [PARA A CARGA]' : ''}: ${shown}`);
    }
  }
}

const mdEscape = (s) => String(s ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');

function renderMarkdown({ date, full, runId, mode, pastorIds, adminIds, counts, issues, timings }) {
  const out = [];
  out.push(`# Relatório de carga (${date})`, '');
  out.push('> **Dados pessoais (LGPD).** Só Ids do legado e contagens, mas sobre membros de uma igreja:');
  out.push('> fica em `data-migration/reports/` (ignorada pelo git); não envie por canais abertos e apague depois do uso.', '');
  out.push(`- Gerado em: ${full} (horário de Brasília)`);
  out.push(`- Execução: #${runId} (\`legacy._load_runs\`), modo: ${mode === 'final' ? '**final (cutover)**' : 'ensaio'}`);
  out.push(`- Pastores da D9: ${pastorIds.join(', ') || '—'} · Administradores: ${adminIds.join(', ') || '—'}`);
  out.push(`- Tempo: ${timings.map(([k, v]) => `${k} ${v}`).join(' · ')}`, '');
  out.push('## Contagens', '', '```json', JSON.stringify(counts, null, 2), '```', '');
  out.push('## Ocorrências', '');
  for (const [cat, label] of LOAD_CATEGORIES) {
    const rows = issues.filter((i) => (loadCodeInfo(i.code)?.category ?? 'block') === cat);
    out.push(`### ${label}`, '');
    if (!rows.length) { out.push('Nenhuma.', ''); continue; }
    for (const r of rows) {
      const info = loadCodeInfo(r.code);
      out.push(`#### \`${r.code}\` (${formatInt(r.n)})`, '', mdEscape(info?.title ?? ''), '');
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

async function main() {
  const args = parseCli({
    final: { type: 'boolean', default: false },
    'pastor-ids': { type: 'string' },
    'admin-ids': { type: 'string' },
    'out-dir': { type: 'string' },
  }, USAGE);
  const dryRun = args['dry-run'];
  const final = args.final;
  const mode = final ? 'final' : 'rehearsal';
  const config = loadConfig(args.config);
  const pgo = postgresOptions(config.values);
  const pastorIds = parseIdList(args['pastor-ids'] ?? config.values.get('LEGACY_PASTOR_IDS'), 'LEGACY_PASTOR_IDS / --pastor-ids');
  const adminIds = parseIdList(args['admin-ids'] ?? config.values.get('LEGACY_ADMIN_IDS'), 'LEGACY_ADMIN_IDS / --admin-ids');

  log(`Carga do legado (${final ? 'FINAL, cutover' : 'ensaio'})${dryRun ? ' (--dry-run: tudo é desfeito no fim)' : ''}`);
  log(`  Destino: Postgres ${pgo.describe.host}:${pgo.describe.port}/${pgo.describe.database}${pgo.describe.local ? ' (stack local)' : ''}`);
  if (!pastorIds.length) warn('LEGACY_PASTOR_IDS não configurado: ninguém entra como pastor (D9).');
  if (!adminIds.length) warn('LEGACY_ADMIN_IDS não configurado: ninguém da carga recebe a função Administrador (RN-18 c do E3).');

  const client = await connectPostgres(pgo.options);
  const timings = [];
  const t0 = Date.now();
  let tStep = t0;
  const lap = (label) => { const now = Date.now(); timings.push([label, `${((now - tStep) / 1000).toFixed(1)} s`]); tStep = now; };
  let runId;
  let issues;
  let counts;
  let committed = false;
  try {
    await client.query('BEGIN');
    // DT-04 e risco 1: o primeiro comando confere que o replica é aceito.
    try {
      await client.query(`SET LOCAL session_replication_role = replica`);
    } catch (err) {
      throw new Error(`O destino recusou SET session_replication_role = replica (${err.code ?? 'erro'}). Plano B no risco 1 do spec e4-carga (DISABLE TRIGGER USER).`);
    }
    await client.query(`SET LOCAL lock_timeout = '5s'`);
    await client.query(`SET LOCAL statement_timeout = '15min'`);
    await precheck(client);
    await ensureControlTables(client);
    await client.query(`LOCK TABLE ${LOAD_TABLES.map((t) => `public.${t}`).join(', ')} IN EXCLUSIVE MODE`);
    ({ rows: [{ id: runId }] } = await client.query(
      `INSERT INTO ${RUNS} (mode, tool_commit) VALUES ($1, $2) RETURNING id`, [mode, gitCommit()],
    ));
    await client.query(`SELECT set_config('mci.pastor_ids', $1, true), set_config('mci.admin_ids', $2, true),
                               set_config('mci.load_run_id', $3, true)`,
    [`{${pastorIds.join(',')}}`, `{${adminIds.join(',')}}`, String(runId)]);
    lap('preparação');

    for (const f of STAGE_FILES) await client.query(readSql(f));
    issues = await readIssues(client);
    counts = { stage: (await client.query(STAGE_COUNTS_SQL)).rows[0].counts };
    lap('transformação');

    log('');
    log(`Legado: ${formatInt(counts.stage.members.legacy)} membros, ${formatInt(counts.stage.cells.legacy)} células, `
      + `${formatInt(counts.stage.reports.legacy)} relatórios, ${formatInt(counts.stage.participants.legacy)} participantes`);
    log(`A carregar: ${formatInt(counts.stage.members.to_load)} membros (adotados agora: ${formatInt(counts.stage.members.adopted_now)}), `
      + `${formatInt(counts.stage.cells.to_load)} células, ${formatInt(counts.stage.reports.to_load)} relatórios `
      + `(duplicados que vão excluídos: ${formatInt(counts.stage.reports.duplicates_deleted)}), `
      + `${formatInt(counts.stage.participants.to_load)} participantes`);
    log('');
    printIssues(issues, { final });

    const blocking = blockingIssues(issues, { final });
    if (blocking.length) {
      await client.query('ROLLBACK');
      log('');
      throw new Error(`Carga interrompida antes de gravar: ${blocking.map((b) => b.code).join(', ')}. Nada foi gravado.`);
    }

    for (const f of WRITE_FILES) await client.query(readSql(f));
    lap('gravação e recálculos');

    const fkSql = await fkCheckSql(client);
    const { rows: problems } = await client.query(`${readSql(VALIDATE_FILE).replace(/ORDER BY 1, 2, 3;\s*$/, '')}
      UNION ALL ${fkSql} ORDER BY 1, 2, 3`);
    const privilegeProblems = await legacyPrivilegeProblems(client, await existingApiRoles(client));
    lap('validação');
    if (problems.length || privilegeProblems.length) {
      await client.query('ROLLBACK');
      log('');
      log('Validação (DT-10) falhou; nada foi gravado:');
      const grouped = new Map();
      for (const p of problems) {
        const k = `${p.item} / ${p.detail}`;
        if (!grouped.has(k)) grouped.set(k, []);
        grouped.get(k).push(p.legacy_id ?? 'novo');
      }
      for (const [k, ids] of grouped) log(`  ${k}: ${ids.length} (${ids.slice(0, 20).join(', ')}${ids.length > 20 ? ', …' : ''})`);
      for (const p of privilegeProblems) log(`  privilégio: ${p}`);
      throw new Error('Validação da carga falhou.');
    }

    counts.write = (await client.query(WRITE_COUNTS_SQL)).rows[0].counts;
    const lists = Object.fromEntries(issues.map((i) => [i.code, i.items.map((x) => x.id).filter((v) => v != null)]));
    await client.query(`UPDATE ${RUNS} SET finished_at = clock_timestamp(), counts = $2, lists = $3 WHERE id = $1`,
      [runId, JSON.stringify(counts), JSON.stringify(lists)]);

    if (dryRun) {
      await client.query('ROLLBACK');
    } else {
      await client.query('COMMIT');
      committed = true;
      for (const t of LOAD_TABLES) await client.query(`ANALYZE public.${t}`);
      lap('ANALYZE');
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end().catch(() => {});
  }

  const w = counts.write;
  log('');
  for (const [k, label] of [['members', 'Membros'], ['cells', 'Células'], ['reports', 'Relatórios']]) {
    log(`${label}: ${formatInt(w[k].inserted)} novos, ${formatInt(w[k].updated)} atualizados`);
  }
  log(`Participantes: ${formatInt(w.participants.inserted)} novos, ${formatInt(w.participants.removed)} removidos`);
  log(`Funções (carregados): ${Object.entries(w.roles ?? {}).map(([k, v]) => `${k} ${formatInt(v)}`).join(', ') || '—'}`);
  log(`Recálculos: ${Object.entries(w.backfill ?? {}).map(([k, v]) => `${k} ${formatInt(v)}`).join(', ')}`);
  log(`Tempo: ${timings.map(([k, v]) => `${k} ${v}`).join(' · ')} · total ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  log('');
  if (!committed) {
    log(`Validação ok. Nada foi gravado (--dry-run).`);
    return;
  }
  const date = spFormat({});
  const outDir = resolve(args['out-dir'] ?? resolve(MIGRATION_ROOT, 'reports'));
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `carga-${date}-${runId}.md`);
  writeFileSync(outPath, renderMarkdown({
    date, full: spFormat({ dateStyle: 'short', timeStyle: 'medium' }), runId, mode, pastorIds, adminIds, counts, issues, timings,
  }), { mode: 0o600 });
  log(`Carga #${runId} gravada. Relatório em ${outPath}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) runMain(main);
