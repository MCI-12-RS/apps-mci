#!/usr/bin/env node
// E4.09: reconciliação depois da carga e das contas (spec docs/specs/e4-carga.md, DT-15;
// 5.6 do docs/migracao.md). SÓ LÊ: uma transação REPEATABLE READ READ ONLY, como postgres,
// sem tabela temporária, sem registro no banco e sem chamar o Auth.
//
// Cada item da 5.6 vira uma verificação com a situação (ok, FALHA, atenção, info), os números
// e os Ids do legado; cada diferença é esperada (com o motivo do catálogo, e os motivos da carga
// só valem se a carga os listou) ou inesperada. Código de saída 2 se alguma verificação falhar
// (1 em erro). O que exige pessoa (painel por perfil, login, amostragem) sai como lista de
// conferência manual para o E5.
//
// Saída e relatório sem dado pessoal: só Ids do legado, ids do novo, códigos, nomes de campo e
// números. Fora do --dry-run grava reports/reconciliacao-<data>-<hora>.md e .json (evidência do
// ensaio e do cutover, com o código de evidência).

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, postgresOptions, MIGRATION_ROOT } from './lib/config.mjs';
import { parseCli, log, warn, runMain, formatInt, gitCommit } from './lib/cli.mjs';
import { connectPostgres, describeLegacy } from './lib/postgres.mjs';
import { LEGACY_TABLES, LEGACY_SCHEMA, qPg } from './lib/legacy-schema.mjs';
import { parseIdList } from './lib/load-codes.mjs';
import {
  RECONCILE_SECTIONS, CHECKS, STATUS_LABEL, checkInfo, expectedInfo, docSets, classify, summarize,
  evidenceCode, parseReferenceInstant,
} from './lib/reconcile-codes.mjs';

const USAGE = `
Uso: node src/reconcile.mjs [--config <arquivo>] [--dry-run] [--at <instante>] [--load-run <n>]
                            [--pastor-ids 1,2] [--admin-ids 3,4] [--seed <texto>] [--credential-sample <n>]
                            [--out-dir <pasta>]

Só lê o destino (não há --yes: nada é gravado no banco).
  --config             arquivo de configuração (padrão: MCI_LOCAL_CONFIG ou <raiz>/local.config)
  --dry-run            mostra o resultado no terminal e não grava os arquivos do relatório
  --at                 instante de referência da semana (situação do relatório e painel): AAAA-MM-DD
                       (23:59), "AAAA-MM-DD HH:MM" no horário de Brasília, ou ISO com fuso (padrão: agora)
  --load-run           a carga conferida (padrão: a última gravada e não desfeita em legacy._load_runs)
  --pastor-ids         Ids do legado dos pastores da D9 (padrão: LEGACY_PASTOR_IDS; os mesmos da carga)
  --admin-ids          Ids do legado dos Administradores (padrão: LEGACY_ADMIN_IDS; os mesmos da carga)
  --seed               semente da amostra para a conferência manual (padrão: a data de hoje)
  --credential-sample  quantas credenciais legadas conferir contra o MD5 do legado (padrão 20; ~60 ms cada)
  --out-dir            pasta do relatório (padrão: data-migration/reports)
`;

export const SQL_DIR = resolve(MIGRATION_ROOT, 'sql', 'reconcile');
export const BASE_FILE = '00_base.sql';
export const STEP_FILES = [
  '10_counts.sql', '20_members.sql', '30_cells.sql', '40_reports.sql', '45_offering.sql', '50_hierarchy.sql',
  '55_db_lists.sql', '60_situation.sql', '70_authorship.sql', '80_accounts.sql', '85_dashboard.sql', '90_samples.sql',
];
// A mesma trava consultiva da carga, das contas e da limpeza (compartilhada aqui: não espera e
// não deixa nenhuma delas começar enquanto a reconciliação lê).
export const LOAD_LOCK_KEY = 'mci.e4.load';
const RUNS = `${qPg(LEGACY_SCHEMA)}._load_runs`;
const TERMINAL_LIMIT = 20;
const OPEN_LIST_LIMIT = 30;

const readSql = (name) => readFileSync(resolve(SQL_DIR, name), 'utf8');

/** Monta o comando de um arquivo: os CTEs comuns no lugar de /*BASE*\/. */
export function buildSql(base, body) {
  const cte = base.replace(/^\s*--.*$/gm, '').trim().replace(/,\s*$/, '');
  if (!body.includes('/*BASE*/')) throw new Error('Arquivo da reconciliação sem /*BASE*/.');
  return body.replace('/*BASE*/', () => cte);
}

async function precheck(client, loadRunArg) {
  const state = await describeLegacy(client);
  const missing = LEGACY_TABLES.filter((t) => !state.tables.some((x) => x.name === t.name)).map((t) => t.name);
  if (!state.exists || missing.length) {
    throw new Error(`Cópia bruta ausente ou incompleta (faltam: ${missing.join(', ') || 'schema legacy'}). Nada a reconciliar.`);
  }
  const { rows: [s] } = await client.query(`
    SELECT to_regclass('legacy._load_runs') IS NOT NULL AS runs, to_regclass('legacy._load_adopted') IS NOT NULL AS adopted,
           to_regclass('legacy._accounts_runs') IS NOT NULL AS acc_runs,
           to_regclass('private.legacy_credentials') IS NOT NULL AS creds,
           to_regprocedure('private.member_hierarchy_drift()') IS NOT NULL AS drift,
           to_regprocedure('private.legacy_authorship(text,timestamp without time zone,text,timestamp without time zone,boolean,timestamp with time zone)') IS NOT NULL AS authorship,
           to_regprocedure('private.cell_report_situation(uuid,boolean,text,time without time zone,timestamp with time zone)') IS NOT NULL AS situation`);
  if (!s.runs || !s.adopted) throw new Error('Nenhuma carga neste destino (legacy._load_runs ausente). Rode antes: npm run load.');
  if (!s.creds) throw new Error('O destino não tem private.legacy_credentials (E3.01).');
  if (!s.drift || !s.authorship || !s.situation) throw new Error('O destino não tem as funções do E2.05, E2.06 e E2.09 que a reconciliação usa.');
  const { rows: runs } = await client.query(
    `SELECT id, started_at, finished_at, mode, tool_commit, undone_at, lists FROM ${RUNS}
      WHERE finished_at IS NOT NULL AND undone_at IS NULL ${loadRunArg ? 'AND id = $1' : ''}
      ORDER BY id DESC LIMIT 1`, loadRunArg ? [loadRunArg] : []);
  if (!runs.length) {
    throw new Error(loadRunArg
      ? `A carga #${loadRunArg} não existe, não terminou ou foi desfeita.`
      : 'Nenhuma carga gravada e não desfeita em legacy._load_runs. Rode antes: npm run load.');
  }
  const loadRun = runs[0];
  const { rows: [latest] } = await client.query(`SELECT max(id) AS id FROM ${RUNS} WHERE finished_at IS NOT NULL AND undone_at IS NULL`);
  let accountsRun = null;
  if (s.acc_runs) {
    ({ rows: [accountsRun = null] } = await client.query(
      `SELECT id, started_at, finished_at, status, to_jsonb(a)->>'undone_at' AS undone_at
         FROM legacy._accounts_runs a ORDER BY id DESC LIMIT 1`));
  }
  return { copyRun: state.lastRun, loadRun, latestLoadRunId: Number(latest.id), accountsRun };
}

/** Verificações das pré-condições, no formato das linhas do SQL. */
export function preconditionRows({ copyRun, loadRun, latestLoadRunId, accountsRun }) {
  const rows = [];
  const iso = (d) => (d ? new Date(d).toISOString() : null);
  rows.push({ kind: 'metric', code: 'load_run', data: {
    id: Number(loadRun.id), mode: loadRun.mode, finished_at: iso(loadRun.finished_at), tool_commit: loadRun.tool_commit,
    latest: latestLoadRunId,
    // Conferir uma carga que não é a última ativa não prova o destino de agora.
    ok: Number(loadRun.id) === latestLoadRunId,
  } });
  rows.push({ kind: 'metric', code: 'load_after_copy', data: {
    copy_run: copyRun ? Number(copyRun.id) : null, copy_finished_at: iso(copyRun?.finished_at),
    load_started_at: iso(loadRun.started_at),
    ok: Boolean(copyRun?.finished_at) && new Date(copyRun.finished_at) <= new Date(loadRun.started_at),
  } });
  rows.push({ kind: 'metric', code: 'accounts_run', data: accountsRun ? {
    id: Number(accountsRun.id), status: accountsRun.status, finished_at: iso(accountsRun.finished_at),
    undone: Boolean(accountsRun.undone_at),
    ok: accountsRun.status === 'ok' && !accountsRun.undone_at,
  } : { id: null, ok: false } });
  return rows;
}

const spFormat = (opts, d = new Date()) => new Intl.DateTimeFormat(opts.dateStyle ? 'pt-BR' : 'en-CA', {
  timeZone: 'America/Sao_Paulo', ...opts,
}).format(d);

const fmtNum = (v) => (v == null ? '—' : typeof v === 'number' || /^-?\d+(\.\d+)?$/.test(String(v))
  ? (String(v).includes('.') ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : formatInt(v))
  : String(v));

const idLabel = (i) => (i.lid != null ? String(i.lid) : (i.ref ?? '—'));

const plural = (n, one, many) => `${fmtNum(n)} ${Number(n) === 1 ? one : many}`;

function checkLine(c) {
  const parts = [];
  if (c.type === 'compare') {
    parts.push(`${plural(c.compared, 'comparado', 'comparados')}`);
    if (c.expected.length) parts.push(plural(c.expected.length, 'esperada', 'esperadas'));
    if (c.unexpected.length) parts.push(plural(c.unexpected.length, 'INESPERADA', 'INESPERADAS'));
  } else if (c.type === 'empty' || c.type === 'attention' || c.type === 'sample') {
    parts.push(plural(c.items.length, 'item', 'itens'));
  } else if (c.type === 'metric') {
    const bad = c.metrics.filter((m) => m.data?.ok === false).length;
    parts.push(`${plural(c.metrics.length, 'linha', 'linhas')}${bad ? `, ${plural(bad, 'com diferença', 'com diferença')}` : ''}`);
  }
  return parts.join(', ');
}

function printChecks(checks) {
  for (const [section, label] of RECONCILE_SECTIONS) {
    const rows = checks.filter((c) => c.section === section && c.type !== 'sample');
    if (!rows.length) continue;
    log(`${label}:`);
    for (const c of rows) {
      log(`  ${STATUS_LABEL[c.status].padEnd(7)} ${c.code}: ${checkLine(c)}`);
      const show = (list, prefix) => {
        if (!list.length) return;
        const ids = list.map(idLabel);
        log(`          ${prefix}: ${ids.slice(0, TERMINAL_LIMIT).join(', ')}${ids.length > TERMINAL_LIMIT ? `, … (+${ids.length - TERMINAL_LIMIT})` : ''}`);
      };
      show(c.unexpected, 'inesperadas');
      if (c.type === 'empty' || c.type === 'attention') show(c.items, 'itens');
      if (c.expected.length) {
        const by = new Map();
        for (const e of c.expected) { if (!by.has(e.reason)) by.set(e.reason, []); by.get(e.reason).push(e); }
        for (const [reason, list] of by) show(list, `esperadas (${reason})`);
      }
      if (c.type === 'metric') {
        // As métricas curtas saem sempre; as longas (meses, painel) só na diferença.
        const always = !['offering_month', 'dashboard', 'authorship_kinds'].includes(c.code);
        for (const m of c.metrics.filter((x) => always || x.data?.ok === false)) {
          log(`          ${m.data?.ok === false ? 'DIFERENÇA: ' : ''}${metricText(c.code, m)}`);
        }
      }
    }
  }
}

/** Uma linha de métrica em texto (terminal e relatório). */
export function metricText(code, m) {
  const d = m.data ?? {};
  switch (code) {
    case 'counts':
      return `${d.entity} ${d.situation}: legado ${fmtNum(d.legacy)}, fora da carga ${fmtNum(d.left_out)}, `
        + `duplicados ${fmtNum(d.duplicates)}, esperado ${fmtNum(d.expected)}, novo ${fmtNum(d.new)}`;
    case 'offering_month':
      return `${d.month}: legado ${fmtNum(d.legacy)}, fora ${fmtNum(d.left_out)}, duplicados ${fmtNum(d.duplicates)}, `
        + `esperado ${fmtNum(d.expected)}, novo ${fmtNum(d.new)}`;
    case 'load_run':
      return `#${d.id} (${d.mode === 'final' ? 'final' : 'ensaio'}), terminada em ${d.finished_at}${d.ok ? '' : `; a última ativa é a #${d.latest}`}`;
    case 'load_after_copy':
      return d.copy_run == null ? 'nenhuma cópia registrada' : `cópia #${d.copy_run} (${d.copy_finished_at}); carga iniciada em ${d.load_started_at}`;
    case 'accounts_run':
      return d.id == null ? 'nenhuma execução das contas' : `#${d.id}: ${d.status}${d.undone ? ', desfeita' : ''} (${d.finished_at ?? '—'})`;
    case 'ranking_g12':
      return `soma dos G12 ${fmtNum(d.g12_sum)}, células sob os G12 ${fmtNum(d.cells_under_g12)} `
        + `(do legado ${fmtNum(d.legacy_cells_under_g12)}, só do novo ${fmtNum(d.new_only_cells_under_g12)})`;
    case 'cells_by_gender':
      return `células ativas ${fmtNum(d.active_cells)}; maior total masculino ${fmtNum(d.male)}, feminino ${fmtNum(d.female)}`;
    case 'admins':
      return `${fmtNum(d.n)} Administradores com conta (${fmtNum(d.loaded)} da carga)`;
    case 'credentials':
      return `com conta ${fmtNum(d.with_account)}, senha do legado utilizável ${fmtNum(d.usable)}, credenciais ${fmtNum(d.credentials)} `
        + `(ativas ${fmtNum(d.active)}, usadas ou descartadas ${fmtNum(d.used_or_discarded)}), já com senha no novo ${fmtNum(d.with_password_in_new)}`;
    case 'report_situation_counts':
      return `${d.at} (semana de ${d.week_start}): pendentes no legado ${fmtNum(d.legacy_pending)}, no novo ${fmtNum(d.new_pending_loaded)} `
        + `carregadas (${fmtNum(d.new_pending_all)} com as do novo)`;
    case 'report_snapshot_type_from_cell':
      return `${fmtNum(d.n)} relatórios`;
    case 'dashboard':
      return `${d.label}: legado ${fmtNum(d.legacy)}, novo ${fmtNum(d.new)}`;
    case 'authorship_kinds':
      return `${d.entity}: cadastro ${JSON.stringify(d.created)}, alteração ${JSON.stringify(d.updated)}, exclusão ${JSON.stringify(d.deleted)}`;
    default:
      return JSON.stringify(d);
  }
}

const mdEscape = (s) => String(s ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');

function legacyLink(baseUrl, code, i) {
  if (!baseUrl || i.lid == null) return idLabel(i);
  const path = /^(member|sample_member|account|credential|role|authorship_member)/.test(code) ? 'members'
    : /^(cell|sample_cell|authorship_cell|report_situation)/.test(code) ? 'cells' : null;
  return path ? `[${i.lid}](${baseUrl.replace(/\/+$/, '')}/${path}/${i.lid})` : String(i.lid);
}

function listTable(rows, header, toRow) {
  const table = [header.join(' | ').replace(/^/, '| ').replace(/$/, ' |'), `|${header.map(() => '---').join('|')}|`, ...rows.map(toRow)];
  if (rows.length > OPEN_LIST_LIMIT) return [`<details><summary>Ver os ${formatInt(rows.length)} itens</summary>`, '', ...table, '', '</details>'];
  return table;
}

export function renderMarkdown(ctx) {
  const { header, checks, summary, evidence, legacyUrl } = ctx;
  const out = [];
  out.push(`# Relatório de reconciliação (${header.date})`, '');
  out.push('> **Dados pessoais (LGPD).** Só Ids do legado, ids do novo, códigos e números, mas sobre membros de uma igreja:');
  out.push('> fica em `data-migration/reports/` (ignorada pelo git); não envie por canais abertos e apague depois do uso.', '');
  out.push(`## Resultado: ${summary.approved ? '**APROVADA** (nenhuma diferença inesperada)' : `**REPROVADA** (${summary.failures} verificações com falha)`}`, '');
  out.push(`- Código de evidência: \`${evidence}\` (SHA-256 do resultado; cite no registro do ensaio e no go/no-go)`);
  out.push(`- Diferenças inesperadas: ${formatInt(summary.unexpected)} · esperadas (listadas): ${formatInt(summary.expected)} · itens de atenção para a liderança: ${formatInt(summary.attention)}`);
  out.push(`- Gerado em: ${header.generatedAt} (horário de Brasília) · ferramenta: \`${header.toolCommit ?? '—'}\``);
  out.push(`- Destino: ${header.destination}`);
  out.push(`- Cópia do legado: ${header.copy}`);
  out.push(`- Carga conferida: ${header.load}`);
  out.push(`- Contas: ${header.accounts}`);
  out.push(`- Instante de referência (semana do painel e da situação do relatório): ${header.at}`);
  out.push(`- Pastores da D9: ${header.pastorIds.join(', ') || '—'} · Administradores: ${header.adminIds.join(', ') || '—'}`);
  out.push(`- Tempo: ${header.timings}`, '');
  out.push('Critério (7.1): dois ensaios seguidos sem diferença inesperada. As diferenças esperadas são as que a carga');
  out.push('trata de propósito (e lista no relatório da carga) ou que o próprio legado já tem; ficam listadas abaixo.', '');

  out.push('## Resumo', '', '| Seção | Verificação | Situação | Comparados | Esperadas | Inesperadas |', '|---|---|---|---:|---:|---:|');
  for (const [section, label] of RECONCILE_SECTIONS) {
    for (const c of checks.filter((x) => x.section === section && x.type !== 'sample')) {
      const compared = c.type === 'compare' ? fmtNum(c.compared) : c.type === 'metric' ? plural(c.metrics.length, 'linha', 'linhas') : plural(c.items.length, 'item', 'itens');
      out.push(`| ${label} | [${mdEscape(c.title)}](#${c.code}) | ${c.status === 'falha' ? '**FALHA**' : STATUS_LABEL[c.status]} | ${compared} | `
        + `${c.type === 'compare' ? formatInt(c.expected.length) : '—'} | ${c.type === 'compare' ? formatInt(c.unexpected.length) : '—'} |`);
    }
  }
  out.push('');

  out.push('## Detalhes', '');
  for (const [section, label] of RECONCILE_SECTIONS) {
    const rows = checks.filter((x) => x.section === section);
    if (!rows.length) continue;
    out.push(`### ${label}`, '');
    for (const c of rows) {
      out.push(`<a id="${c.code}"></a>`, `#### ${mdEscape(c.title)}`, '');
      out.push(`- Código: \`${c.code}\` · situação: ${c.status === 'falha' ? '**FALHA**' : STATUS_LABEL[c.status]} · ${checkLine(c)}`, '');
      if (c.type === 'metric') {
        out.push(...c.metrics.map((m) => `- ${m.data?.ok === false ? '**diferença:** ' : ''}${mdEscape(metricText(c.code, m))}`), '');
      }
      if (c.unexpected.length) {
        out.push('Inesperadas:', '', ...listTable(c.unexpected, ['Id do legado', 'Outra chave', 'O que difere', 'Observação'],
          (i) => `| ${legacyLink(legacyUrl, c.code, i)} | ${mdEscape(i.ref ?? '')} | ${mdEscape(i.detail ?? '')} | ${mdEscape(i.note ?? '')} |`), '');
      }
      if (c.items.length) {
        out.push(...listTable(c.items, ['Id do legado', 'Outra chave', 'Observação'],
          (i) => `| ${legacyLink(legacyUrl, c.code, i)} | ${mdEscape(i.ref ?? '')} | ${mdEscape(i.detail ?? '')} |`), '');
      }
      if (c.expected.length) {
        const by = new Map();
        for (const e of c.expected) { if (!by.has(e.reason)) by.set(e.reason, []); by.get(e.reason).push(e); }
        out.push('Esperadas:', '');
        for (const [reason, list] of by) {
          out.push(`- \`${reason}\` (${formatInt(list.length)}): ${mdEscape(expectedInfo(reason)?.title ?? '')}`, '');
          out.push(...listTable(list, ['Id do legado', 'Outra chave', 'O que difere'],
            (i) => `| ${legacyLink(legacyUrl, c.code, i)} | ${mdEscape(i.ref ?? '')} | ${mdEscape(i.detail ?? '')} |`), '');
        }
      }
    }
  }

  out.push('## Conferência manual (E5.04 e E5.05)', '');
  out.push('O que exige pessoa não é automático. Marque cada item no registro do ensaio, com quem conferiu e a data.', '');
  out.push(`1. **Painel da semana de referência** (${header.at}), lado a lado (legado × novo), com um usuário de cada perfil`);
  out.push('   (Administrador, Líder e Membro): confere o escopo. Os números da igreja toda estão em "Painel da semana" acima.');
  out.push('2. **Login** com contas de teste de cada perfil, inclusive uma só com celular e uma com acento na senha, pela senha');
  out.push('   do legado (E3).');
  out.push('3. **Amostragem**: a liderança confere, no legado e no novo, os 20 membros, as 10 células e os 10 relatórios abaixo.');
  for (const code of ['sample_member', 'sample_cell', 'sample_report']) {
    const c = checks.find((x) => x.code === code);
    out.push(`   - ${checkInfo(code).title}: ${c.items.map((i) => legacyLink(legacyUrl, code, i)).join(', ') || '—'}`);
  }
  out.push('4. **Diferenças esperadas nas telas** (não são divergência; "Impactos em outros passos" do spec do E2.10):');
  out.push('   - o filtro G12 do novo inclui a célula do próprio G12, que o legado deixava de fora;');
  out.push('   - os filtros de texto do novo ignoram acentos;');
  out.push('   - a lista de Células do novo tem células inativas;');
  out.push('   - o detalhe da célula no novo mostra 3 relatórios, e o legado mostrava até 10;');
  out.push('   - a Situação do relatório não tem opções sobrepostas: o "Relatório em dia" do legado corresponde a Enviado, Ainda');
  out.push('     não ocorreu e Conta a partir da próxima semana; as semanas anteriores contam semanas sem relatório (e não a data do');
  out.push('     último relatório), com o prazo de 1 hora e as semanas que contam do E2.09;');
  out.push('   - totais de discípulos e de células: o novo conta só os ativos (D2), em qualquer profundidade; o legado guardava');
  out.push('     totais por evento e só até 5 ancestrais, então os números guardados no legado podem diferir (a reconciliação');
  out.push('     compara com o recalculado a partir do legado);');
  out.push('   - membros sem líder e sem "Não tem liderança", fora dos pastores da D9, aparecem como Pastores no legado e "Sem');
  out.push('     liderança" no novo, até a correção no E4.05.');
  out.push('5. **Go/no-go** (7.1): dois ensaios seguidos com esta reconciliação APROVADA (cite os códigos de evidência).', '');
  return `${out.join('\n')}\n`;
}

async function main() {
  const args = parseCli({
    at: { type: 'string' },
    'load-run': { type: 'string' },
    'pastor-ids': { type: 'string' },
    'admin-ids': { type: 'string' },
    seed: { type: 'string' },
    'credential-sample': { type: 'string' },
    'out-dir': { type: 'string' },
  }, USAGE);
  const dryRun = args['dry-run'];
  const config = loadConfig(args.config);
  const pgo = postgresOptions(config.values);
  const pastorIds = parseIdList(args['pastor-ids'] ?? config.values.get('LEGACY_PASTOR_IDS'), 'LEGACY_PASTOR_IDS / --pastor-ids');
  const adminIds = parseIdList(args['admin-ids'] ?? config.values.get('LEGACY_ADMIN_IDS'), 'LEGACY_ADMIN_IDS / --admin-ids');
  const atInput = parseReferenceInstant(args.at);
  const loadRunArg = args['load-run'] ? parseIdList(args['load-run'], '--load-run')[0] : null;
  const credSample = args['credential-sample'] == null ? 20 : Number(args['credential-sample']);
  if (!Number.isInteger(credSample) || credSample < 0 || credSample > 500) {
    throw new Error('--credential-sample precisa ser um número de 0 a 500.');
  }
  const seed = args.seed ?? spFormat({});
  if (!/^[\w.:-]{1,64}$/.test(seed)) throw new Error('--seed aceita só letras, números, ponto, dois-pontos e hífen (até 64).');
  const legacyUrl = config.values.get('LEGACY_APP_URL') || null;

  log(`Reconciliação (só leitura)${dryRun ? ' (--dry-run: nenhum arquivo será gravado)' : ''}`);
  log(`  Destino: Postgres ${pgo.describe.host}:${pgo.describe.port}/${pgo.describe.database}${pgo.describe.local ? ' (stack local)' : ''}`);
  if (!pastorIds.length) warn('LEGACY_PASTOR_IDS não configurado: use os mesmos Ids da carga, senão o campo "pastor" diverge.');
  if (!adminIds.length) warn('LEGACY_ADMIN_IDS não configurado: use os mesmos Ids da carga, senão as funções divergem.');

  const base = readSql(BASE_FILE);
  const client = await connectPostgres(pgo.options);
  const timings = [];
  const t0 = Date.now();
  let rows = [];
  let pre;
  let at;
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query(`SET LOCAL statement_timeout = '10min'`);
    const { rows: [lock] } = await client.query('SELECT pg_try_advisory_xact_lock_shared(hashtextextended($1, 0)) AS ok', [LOAD_LOCK_KEY]);
    if (!lock.ok) throw new Error('Carga, contas ou limpeza do ensaio em andamento neste destino. Espere terminar e rode de novo.');
    pre = await precheck(client, loadRunArg);
    ({ rows: [{ at }] } = await client.query(`SELECT coalesce($1::timestamptz, now()) AS at`, [atInput]));
    await client.query(`SELECT set_config('mci.rc_pastor_ids', $1, true), set_config('mci.rc_admin_ids', $2, true),
                               set_config('mci.rc_at', $3, true), set_config('mci.rc_load_run', $4, true),
                               set_config('mci.rc_seed', $5, true), set_config('mci.rc_cred_sample', $6, true)`,
    [`{${pastorIds.join(',')}}`, `{${adminIds.join(',')}}`, new Date(at).toISOString(), String(pre.loadRun.id), seed, String(credSample)]);
    rows.push(...preconditionRows(pre));
    for (const f of STEP_FILES) {
      const t = Date.now();
      const res = await client.query(buildSql(base, readSql(f)));
      rows.push(...res.rows);
      timings.push([f.replace(/^\d+_|\.sql$/g, ''), Date.now() - t]);
    }
    await client.query('ROLLBACK');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end().catch(() => {});
  }

  const checks = classify(rows, docSets(pre.loadRun.lists));
  const summary = summarize(checks);
  const total = ((Date.now() - t0) / 1000).toFixed(1);
  const timingText = `${timings.map(([k, ms]) => `${k} ${(ms / 1000).toFixed(1)} s`).join(' · ')} · total ${total} s`;
  const evidencePayload = {
    load_run: Number(pre.loadRun.id), copy_run: pre.copyRun ? Number(pre.copyRun.id) : null,
    accounts_run: pre.accountsRun ? Number(pre.accountsRun.id) : null, at: new Date(at).toISOString(),
    checks: checks.map((c) => ({
      code: c.code, status: c.status, compared: c.compared,
      unexpected: c.unexpected.map((i) => [i.lid, i.ref, i.detail, i.note]),
      expected: c.expected.map((i) => [i.lid, i.ref, i.reason]),
      items: c.items.map((i) => [i.lid, i.ref, i.detail]),
      metrics: c.metrics.map((m) => m.data),
    })),
  };
  const evidence = evidenceCode(evidencePayload);

  log('');
  printChecks(checks);
  log('');
  log(`Tempo: ${timingText}`);
  log(`Código de evidência: ${evidence}`);
  log(`Reconciliação: ${summary.approved ? 'APROVADA' : 'REPROVADA'} (${summary.failures} verificações com falha; `
    + `${formatInt(summary.unexpected)} diferenças inesperadas, ${formatInt(summary.expected)} esperadas, `
    + `${formatInt(summary.attention)} itens de atenção)`);

  if (!dryRun) {
    const date = spFormat({});
    const hhmmss = spFormat({ hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).replaceAll(':', '');
    const outDir = resolve(args['out-dir'] ?? resolve(MIGRATION_ROOT, 'reports'));
    mkdirSync(outDir, { recursive: true });
    const stem = resolve(outDir, `reconciliacao-${date}-${hhmmss}`);
    const iso = (d) => (d ? spFormat({ dateStyle: 'short', timeStyle: 'medium' }, new Date(d)) : '—');
    const header = {
      date, generatedAt: spFormat({ dateStyle: 'short', timeStyle: 'medium' }), toolCommit: gitCommit(),
      destination: `${pgo.describe.host}:${pgo.describe.port}/${pgo.describe.database}${pgo.describe.local ? ' (stack local)' : ''}`,
      copy: pre.copyRun ? `#${pre.copyRun.id}, terminada em ${iso(pre.copyRun.finished_at)}, de \`${pre.copyRun.source_database}\``
        + ` (última migration EF: ${pre.copyRun.source_schema_version ?? '—'})` : '—',
      load: `#${pre.loadRun.id} (${pre.loadRun.mode === 'final' ? '**final, cutover**' : 'ensaio'}), terminada em ${iso(pre.loadRun.finished_at)}, `
        + `ferramenta \`${pre.loadRun.tool_commit ?? '—'}\``,
      accounts: pre.accountsRun ? `#${pre.accountsRun.id}, ${pre.accountsRun.status}${pre.accountsRun.undone_at ? ', desfeita' : ''}, `
        + `terminada em ${iso(pre.accountsRun.finished_at)}` : 'nenhuma execução',
      at: spFormat({ dateStyle: 'short', timeStyle: 'short' }, new Date(at)), pastorIds, adminIds, timings: timingText,
    };
    writeFileSync(`${stem}.md`, renderMarkdown({ header, checks, summary, evidence, legacyUrl }), { mode: 0o600 });
    writeFileSync(`${stem}.json`, `${JSON.stringify({ evidence, summary, header, ...evidencePayload }, null, 2)}\n`, { mode: 0o600 });
    log(`Relatório em ${stem}.md (e .json)`);
  } else {
    log('Nenhum arquivo foi gravado (--dry-run).');
  }
  if (!summary.approved) process.exitCode = 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) runMain(main);

export { CHECKS };
