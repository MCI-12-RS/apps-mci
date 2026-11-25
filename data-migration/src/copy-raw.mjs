#!/usr/bin/env node
// E4.03: cópia bruta do MySQL do legado para o schema `legacy` do Supabase.
//
// - Legado: só leitura, numa transação READ ONLY com snapshot consistente.
// - Destino: uma transação só. As tabelas legacy.* são recriadas a cada
//   execução (idempotente); legacy._copy_runs guarda o histórico das cópias.
// - Tipos fiéis: DATETIME vira timestamp sem fuso (o legado grava horário de
//   Brasília), DECIMAL vira numeric, tinyint(1) vira boolean, texto vira text.
// - No fim, contagem e checksum de cada tabela são conferidos entre origem e
//   destino; se divergirem, nada é gravado.
// - Nenhum dado pessoal sai no terminal: só contagens e nomes de tabela.

import { loadConfig, mysqlOptions, postgresOptions } from './lib/config.mjs';
import { parseCli, log, warn, runMain, gitCommit, formatInt } from './lib/cli.mjs';
import {
  LEGACY_SCHEMA, RUNS_TABLE, qPg, qMy, convertValue, mysqlChecksumSql, pgChecksumSql, checksumExcluded,
} from './lib/legacy-schema.mjs';
import { LegacyReader } from './lib/mysql.mjs';
import { connectPostgres, describeLegacy, existingApiRoles, legacyPrivilegeProblems } from './lib/postgres.mjs';

const USAGE = `
Uso: node src/copy-raw.mjs [--config <arquivo>] [--dry-run] [--batch-size <n>]

  --config      arquivo de configuração (padrão: MCI_LOCAL_CONFIG ou <raiz>/local.config)
  --dry-run     lê o legado e o destino, mostra o plano e as contagens, não grava nada
  --batch-size  linhas por INSERT no destino (padrão 500, máximo 2000)
`;

const S = qPg(LEGACY_SCHEMA);

// Nenhum comando de gravação com parâmetros pode passar de 10 s: o
// auto_explain do Supabase registra o plano com os parâmetros (dados pessoais)
// de todo comando que leva 10 s ou mais (armadilha do E1.04 no CLAUDE.md).
const INSERT_STATEMENT_TIMEOUT = '9s';
const OTHER_STATEMENT_TIMEOUT = '5min';

function createTableSql(table) {
  const cols = table.columns.map((c) => `  ${qPg(c.name)} ${c.pgType}`).join(',\n');
  return `CREATE TABLE ${S}.${qPg(table.name)} (\n${cols}\n)`;
}

function indexName(table, i) {
  return qPg(`${table.name}_${i + 1}_idx`);
}

async function main() {
  const args = parseCli({ 'batch-size': { type: 'string', default: '500' } }, USAGE);
  const dryRun = args['dry-run'];
  const batchSize = Math.min(Math.max(Number.parseInt(args['batch-size'], 10) || 500, 1), 2000);

  const config = loadConfig(args.config);
  const my = mysqlOptions(config.values);
  const pgo = postgresOptions(config.values);

  log(`Cópia bruta do legado ${dryRun ? '(--dry-run: nada será gravado)' : ''}`.trim());
  log(`  Configuração: ${config.path}`);
  log(`  Origem:  MySQL ${my.describe.host}:${my.describe.port}/${my.describe.database} (SSL: ${my.describe.ssl ? (my.describe.sslVerified ? 'sim, certificado conferido' : 'sim, sem conferir o certificado') : 'não'})`);
  log(`  Destino: Postgres ${pgo.describe.host}:${pgo.describe.port}/${pgo.describe.database}${pgo.describe.local ? ' (stack local)' : ''} (SSL: ${pgo.describe.ssl ? (pgo.describe.sslVerified ? 'sim, certificado conferido' : 'sim, sem conferir o certificado') : 'não'})`);
  if (my.describe.ssl && !my.describe.sslVerified) {
    warn('o certificado do MySQL não é conferido. Para conferir, aponte LEGACY_PROD_SSL_CA para o certificado da CA (README).');
  }
  if (pgo.describe.ssl && !pgo.describe.sslVerified) {
    warn('o certificado do Supabase não é conferido. Para conferir, aponte SUPABASE_SSL_CA para o certificado da CA (README).');
  }

  const startedAt = new Date();
  const reader = new LegacyReader(my.options);
  let client;
  let failed = false;
  try {
    const info = await reader.begin({ requireSsl: Boolean(my.options.ssl) });
    const schemaVersion = await reader.schemaVersion();
    const { tables, warnings } = await reader.discover();
    warnings.forEach(warn);
    log(`  MySQL ${info.version}; última migration EF: ${schemaVersion ?? '(sem __EFMigrationsHistory)'}`);

    // Contagens da origem no mesmo snapshot.
    for (const t of tables) {
      const [row] = await reader.query(`SELECT COUNT(*) AS n FROM ${qMy(t.sourceName)}`);
      t.sourceRows = Number(row.n);
    }

    client = await connectPostgres(pgo.options);

    if (dryRun) {
      await client.query('BEGIN READ ONLY');
      const state = await describeLegacy(client);
      await client.query('ROLLBACK');
      log('');
      log(`Schema ${LEGACY_SCHEMA} no destino: ${state.exists ? 'existe' : 'não existe (seria criado, sem privilégios para anon, authenticated e service_role)'}`);
      if (state.lastRun) {
        log(`  Última cópia: #${state.lastRun.id} em ${state.lastRun.finished_at?.toISOString?.() ?? state.lastRun.finished_at}`);
      }
      log('');
      log('Plano (cada tabela é apagada e recriada, numa transação só):');
      for (const t of tables) {
        const current = state.tables.find((x) => x.name === t.name);
        log(`  ${LEGACY_SCHEMA}.${t.name}: ${formatInt(t.sourceRows)} linhas na origem; hoje no destino: ${current ? formatInt(current.rows) : '—'}`);
        for (const c of t.columns) log(`      ${c.name}: ${c.columnType} → ${c.pgType}`);
        const excluded = checksumExcluded(t);
        if (excluded.length) log(`      (fora do checksum: ${excluded.join(', ')})`);
      }
      log(`  ${LEGACY_SCHEMA}.${RUNS_TABLE}: +1 linha com horário, origem, contagens e checksums`);
      log('');
      log('Nada foi gravado.');
      return;
    }

    // Checksums da origem, ainda no mesmo snapshot.
    for (const t of tables) {
      const [row] = await reader.query(mysqlChecksumSql(t));
      t.sourceChecksum = `${row.n}:${row.s}`;
    }

    const roles = await existingApiRoles(client);
    const revokeFrom = ['PUBLIC', ...roles.map(qPg)].join(', ');

    await client.query('BEGIN');
    await client.query(`SET LOCAL lock_timeout = '10s'`);
    await client.query(`SET LOCAL statement_timeout = '${OTHER_STATEMENT_TIMEOUT}'`);
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${S}`);
    await client.query(`REVOKE ALL ON SCHEMA ${S} FROM ${revokeFrom}`);
    await client.query(`COMMENT ON SCHEMA ${S} IS 'Cópia bruta do legado (g12app-net) para a migração. Fora da API; apagar no fim (7.4 do plano).'`);
    await client.query(`CREATE TABLE IF NOT EXISTS ${S}.${qPg(RUNS_TABLE)} (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      started_at timestamptz NOT NULL,
      finished_at timestamptz NOT NULL,
      source_host text NOT NULL,
      source_port integer NOT NULL,
      source_database text NOT NULL,
      source_server_version text,
      source_schema_version text,
      tool text NOT NULL,
      tool_commit text,
      tables jsonb NOT NULL
    )`);
    await client.query(`ALTER TABLE ${S}.${qPg(RUNS_TABLE)} ENABLE ROW LEVEL SECURITY`);
    await client.query(`REVOKE ALL ON ${S}.${qPg(RUNS_TABLE)} FROM ${revokeFrom}`);
    await client.query(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA ${S} FROM ${revokeFrom}`);

    const summary = {};
    for (const t of tables) {
      const target = `${S}.${qPg(t.name)}`;
      await client.query(`DROP TABLE IF EXISTS ${target}`);
      await client.query(createTableSql(t));
      await client.query(`ALTER TABLE ${target} ENABLE ROW LEVEL SECURITY`);
      await client.query(`REVOKE ALL ON ${target} FROM ${revokeFrom}`);

      const stats = { zeroDates: 0, nulCharsRemoved: 0, nonBinaryBooleans: 0 };
      const insertSql = `INSERT INTO ${target} SELECT * FROM jsonb_populate_recordset(NULL::${target}, $1::jsonb)`;
      const order = t.primaryKeySource.map(qMy).join(', ');
      const select = `SELECT ${t.columns.map((c) => qMy(c.sourceName)).join(', ')} FROM ${qMy(t.sourceName)} ORDER BY ${order}`;
      let batch = [];
      let streamed = 0;
      await client.query(`SET LOCAL statement_timeout = '${INSERT_STATEMENT_TIMEOUT}'`);
      const flush = async () => {
        if (!batch.length) return;
        await client.query(insertSql, [JSON.stringify(batch)]);
        batch = [];
      };
      for await (const row of reader.stream(select)) {
        const out = {};
        for (const c of t.columns) out[c.name] = convertValue(c.kind, row[c.sourceName], stats);
        batch.push(out);
        streamed += 1;
        if (batch.length >= batchSize) await flush();
      }
      await flush();
      await client.query(`SET LOCAL statement_timeout = '${OTHER_STATEMENT_TIMEOUT}'`);

      await client.query(`ALTER TABLE ${target} ADD PRIMARY KEY (${t.primaryKey.map(qPg).join(', ')})`);
      for (const [i, cols] of t.indexes.entries()) {
        await client.query(`CREATE INDEX ${indexName(t, i)} ON ${target} (${cols.map(qPg).join(', ')})`);
      }
      await client.query(`ANALYZE ${target}`);

      const { rows: [dest] } = await client.query(pgChecksumSql(t));
      const destChecksum = `${dest.n}:${dest.s}`;
      const destRows = Number(dest.n);
      if (streamed !== t.sourceRows || destRows !== t.sourceRows) {
        throw new Error(`Contagem divergente em ${t.name}: origem ${t.sourceRows}, lidas ${streamed}, destino ${destRows}.`);
      }
      if (destChecksum !== t.sourceChecksum) {
        throw new Error(`Checksum divergente em ${t.name}: o conteúdo copiado não bate com a origem.`);
      }
      if (stats.nonBinaryBooleans) {
        warn(`${t.name}: ${stats.nonBinaryBooleans} valores tinyint(1) diferentes de 0 e 1 foram gravados como verdadeiro.`);
      }
      summary[t.name] = {
        source_table: t.sourceName,
        rows: destRows,
        checksum: destChecksum,
        checksum_excluded_columns: checksumExcluded(t),
        zero_dates_nulled: stats.zeroDates,
        nul_chars_removed: stats.nulCharsRemoved,
        non_binary_booleans: stats.nonBinaryBooleans,
        columns: t.columns.length,
      };
      log(`  ${LEGACY_SCHEMA}.${t.name}: ${formatInt(destRows)} linhas, checksum conferido`);
    }

    const problems = await legacyPrivilegeProblems(client, roles);
    if (problems.length) {
      throw new Error(`O schema ${LEGACY_SCHEMA} ficou acessível: ${problems.join('; ')}.`);
    }

    const finishedAt = new Date();
    const { rows: [run] } = await client.query(
      `INSERT INTO ${S}.${qPg(RUNS_TABLE)}
         (started_at, finished_at, source_host, source_port, source_database, source_server_version,
          source_schema_version, tool, tool_commit, tables)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [startedAt, finishedAt, my.describe.host, my.describe.port, my.describe.database, info.version,
        schemaVersion, 'data-migration/src/copy-raw.mjs', gitCommit(), JSON.stringify(summary)],
    );
    await client.query('COMMIT');
    log('');
    log(`Cópia #${run.id} gravada em ${LEGACY_SCHEMA} (${((finishedAt - startedAt) / 1000).toFixed(1)} s).`);
  } catch (err) {
    failed = true;
    if (client) await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await reader.end({ failed }).catch(() => {});
    if (client) await client.end().catch(() => {});
  }
}

runMain(main);
