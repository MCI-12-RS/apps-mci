#!/usr/bin/env node
// E4.04: relatório de saneamento sobre o schema legacy.
//
// Roda sql/sanitation-report.sql numa transação somente leitura no destino e
// grava data-migration/reports/saneamento-<data>.md (pasta ignorada pelo git).
// O relatório traz só contagens e Ids do legado: nenhum nome, e-mail, CPF ou
// telefone. Com --dry-run, mostra o resumo no terminal e não grava o arquivo.

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig, postgresOptions, MIGRATION_ROOT } from './lib/config.mjs';
import { parseCli, log, warn, runMain, formatInt } from './lib/cli.mjs';
import { connectPostgres, describeLegacy } from './lib/postgres.mjs';
import { LEGACY_TABLES } from './lib/legacy-schema.mjs';

const USAGE = `
Uso: node src/sanitation-report.mjs [--config <arquivo>] [--dry-run] [--pastor-ids 1,2] [--out-dir <pasta>]

  --config      arquivo de configuração (padrão: MCI_LOCAL_CONFIG ou <raiz>/local.config)
  --dry-run     mostra o resumo no terminal e não grava o arquivo
  --pastor-ids  Ids do legado dos pastores da D9 (padrão: LEGACY_PASTOR_IDS do arquivo de configuração)
  --out-dir     pasta do relatório (padrão: data-migration/reports)
`;

const SQL_PATH = resolve(MIGRATION_ROOT, 'sql', 'sanitation-report.sql');

const CATEGORIES = [
  ['legacy_fix', 'Corrigir no legado (E4.05)'],
  ['decide', 'Precisa de decisão antes do E4.06'],
  ['transform', 'Tratado na transformação (E4.06)'],
  ['info', 'Informativo'],
];
const categoryLabel = new Map(CATEGORIES);

// Até quantos itens a lista aparece aberta; acima disso, dentro de <details>.
const OPEN_LIST_LIMIT = 30;

function parsePastorIds(text) {
  if (!text) return [];
  const ids = text.split(/[\s,;]+/).filter(Boolean).map((v) => {
    if (!/^\d+$/.test(v)) throw new Error('LEGACY_PASTOR_IDS / --pastor-ids precisa ser uma lista de Ids numéricos.');
    return Number(v);
  });
  return [...new Set(ids)].sort((a, b) => a - b);
}

function spToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

function spNow() {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'medium',
  }).format(new Date());
}

const fmtDate = (d) => (d ? new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'medium',
}).format(new Date(d)) : '—');

const mdEscape = (s) => String(s ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');

function legacyLink(baseUrl, entity, item) {
  const { id, deleted, exists } = item;
  if (!baseUrl || id == null || !exists) return String(id ?? '—');
  const path = entity === 'Members' ? 'members' : entity === 'Cells' ? 'cells' : null;
  if (!path || deleted) return String(id);
  return `[${id}](${baseUrl.replace(/\/+$/, '')}/${path}/${id})`;
}

function renderMarkdown({ generatedAt, run, pastorIds, counts, checks, legacyUrl }) {
  const out = [];
  out.push(`# Relatório de saneamento (${generatedAt.date})`);
  out.push('');
  out.push('> **Dados pessoais (LGPD).** Este arquivo fica só na máquina de quem opera a migração, em');
  out.push('> `data-migration/reports/` (ignorada pelo git). Ele traz só Ids do legado e contagens, mas');
  out.push('> é sobre membros de uma igreja: não envie por canais abertos e apague depois do uso (5.1).');
  out.push('');
  out.push(`- Gerado em: ${generatedAt.full} (horário de Brasília)`);
  if (run) {
    out.push(`- Cópia usada: #${run.id}, terminada em ${fmtDate(run.finished_at)}, de \`${run.source_database}\` (última migration EF: ${run.source_schema_version ?? '—'})`);
  }
  out.push(`- Pastores da D9 (\`LEGACY_PASTOR_IDS\`): ${pastorIds.length ? pastorIds.join(', ') : '**não configurados**: eles aparecem em "Sem líder e sem não tem liderança"'}`);
  out.push('- Os Ids são os do legado. Na tela do legado: membro em `/members/<Id>`, célula em `/cells/<Id>`.');
  out.push('');
  out.push('## Contagens');
  out.push('');
  out.push('| Tabela | Total | Não excluídos | Excluídos | Ativos | Inativos |');
  out.push('|---|---:|---:|---:|---:|---:|');
  for (const c of counts) {
    const f = (v) => (v == null ? '—' : formatInt(v));
    out.push(`| ${c.entity} | ${f(c.total)} | ${f(c.not_deleted)} | ${f(c.deleted)} | ${f(c.active)} | ${f(c.inactive)} |`);
  }
  out.push('');
  out.push('Em `ReportMembers`, "não excluídos" e "excluídos" seguem o relatório do participante.');
  out.push('');
  out.push('## Resumo');
  out.push('');
  for (const [cat, label] of CATEGORIES) {
    const rows = checks.filter((c) => c.category === cat);
    const total = rows.reduce((s, r) => s + Number(r.n), 0);
    out.push(`### ${label}: ${formatInt(total)} ${total === 1 ? 'item' : 'itens'}`);
    out.push('');
    out.push('| Verificação | Tabela | Itens |');
    out.push('|---|---|---:|');
    for (const r of rows) out.push(`| [${mdEscape(r.title)}](#${r.code}) | ${r.entity} | ${formatInt(r.n)} |`);
    out.push('');
  }
  out.push('## Detalhes');
  out.push('');
  for (const r of checks) {
    out.push(`<a id="${r.code}"></a>`);
    out.push(`### ${mdEscape(r.title)}`);
    out.push('');
    out.push(`- Código: \`${r.code}\` · Tabela: ${r.entity} · ${categoryLabel.get(r.category) ?? r.category}`);
    out.push(`- Tratamento: ${r.treatment}`);
    out.push(`- Itens: ${formatInt(r.n)}`);
    out.push('');
    if (Number(r.n) === 0) continue;
    const items = r.items;
    const hasInfo = items.some((i) => i.info);
    const table = [];
    if (hasInfo) {
      table.push('| Id do legado | Observação |', '|---:|---|');
      for (const i of items) table.push(`| ${legacyLink(legacyUrl, r.entity, i)} | ${mdEscape(i.info ?? '')} |`);
    } else {
      table.push(`Ids do legado: ${items.map((i) => legacyLink(legacyUrl, r.entity, i)).join(', ')}`);
    }
    if (items.length > OPEN_LIST_LIMIT) {
      out.push(`<details><summary>Ver os ${formatInt(items.length)} itens</summary>`, '', ...table, '', '</details>');
    } else {
      out.push(...table);
    }
    out.push('');
  }
  return `${out.join('\n')}\n`;
}

async function main() {
  const args = parseCli({ 'pastor-ids': { type: 'string' }, 'out-dir': { type: 'string' } }, USAGE);
  const dryRun = args['dry-run'];
  const config = loadConfig(args.config);
  const pgo = postgresOptions(config.values);
  const pastorIds = parsePastorIds(args['pastor-ids'] ?? config.values.get('LEGACY_PASTOR_IDS'));
  const legacyUrl = config.values.get('LEGACY_APP_URL') || null;
  const sql = readFileSync(SQL_PATH, 'utf8');

  log(`Relatório de saneamento ${dryRun ? '(--dry-run: nenhum arquivo será gravado)' : ''}`.trim());
  log(`  Destino: Postgres ${pgo.describe.host}:${pgo.describe.port}/${pgo.describe.database}${pgo.describe.local ? ' (stack local)' : ''}`);
  if (!pastorIds.length) warn('LEGACY_PASTOR_IDS não configurado: os pastores da D9 vão aparecer como "sem líder".');

  const client = await connectPostgres(pgo.options);
  let counts;
  let checks;
  let run;
  try {
    await client.query('BEGIN READ ONLY');
    await client.query(`SET LOCAL statement_timeout = '10min'`);
    const state = await describeLegacy(client);
    const missing = LEGACY_TABLES.filter((t) => !state.tables.some((x) => x.name === t.name)).map((t) => t.name);
    if (!state.exists || missing.length) {
      throw new Error(`Cópia bruta ausente ou incompleta (faltam: ${missing.join(', ') || 'schema legacy'}). Rode antes: npm run copy.`);
    }
    run = state.lastRun;
    await client.query(`SELECT set_config('mci.pastor_ids', $1, true)`, [`{${pastorIds.join(',')}}`]);
    const results = await client.query(sql);
    if (!Array.isArray(results) || results.length !== 2) {
      throw new Error('sql/sanitation-report.sql precisa ter exatamente dois comandos (contagens e verificações).');
    }
    counts = results[0].rows;
    checks = results[1].rows;
    await client.query('ROLLBACK');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end().catch(() => {});
  }

  log('');
  for (const c of counts) {
    log(`  ${c.entity}: ${formatInt(c.total)} (não excluídos ${formatInt(c.not_deleted)}, excluídos ${formatInt(c.deleted)})`);
  }
  log('');
  for (const [cat, label] of CATEGORIES) {
    log(`${label}:`);
    for (const r of checks.filter((x) => x.category === cat)) {
      log(`  ${String(formatInt(r.n)).padStart(6)}  ${r.code}`);
    }
  }

  if (dryRun) {
    log('');
    log('Nenhum arquivo foi gravado.');
    return;
  }

  const date = spToday();
  const outDir = resolve(args['out-dir'] ?? resolve(MIGRATION_ROOT, 'reports'));
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `saneamento-${date}.md`);
  const markdown = renderMarkdown({
    generatedAt: { date, full: spNow() }, run, pastorIds, counts, checks, legacyUrl,
  });
  writeFileSync(outPath, markdown, { mode: 0o600 });
  log('');
  log(`Relatório gravado em ${outPath}`);
}

runMain(main);
