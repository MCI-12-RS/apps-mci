#!/usr/bin/env node
// Limpeza do staging: apaga o schema `legacy` do destino (DROP SCHEMA … CASCADE).
// Exige --yes. Com --dry-run, só mostra o que seria apagado.

import { loadConfig, postgresOptions } from './lib/config.mjs';
import { parseCli, log, runMain, formatInt } from './lib/cli.mjs';
import { connectPostgres, describeLegacy } from './lib/postgres.mjs';
import { LEGACY_SCHEMA, qPg } from './lib/legacy-schema.mjs';

const USAGE = `
Uso: node src/clean-legacy.mjs [--config <arquivo>] (--dry-run | --yes)

  --dry-run  mostra o que seria apagado, sem apagar
  --yes      confirma a remoção do schema ${LEGACY_SCHEMA} (e de tudo dentro dele)
`;

async function main() {
  const args = parseCli({ yes: { type: 'boolean', default: false } }, USAGE);
  const dryRun = args['dry-run'];
  if (!dryRun && !args.yes) {
    throw new Error(`Para apagar o schema ${LEGACY_SCHEMA}, rode com --yes (ou veja antes com --dry-run).`);
  }
  const config = loadConfig(args.config);
  const pgo = postgresOptions(config.values);
  log(`Limpeza do schema ${LEGACY_SCHEMA} ${dryRun ? '(--dry-run: nada será apagado)' : ''}`.trim());
  log(`  Destino: Postgres ${pgo.describe.host}:${pgo.describe.port}/${pgo.describe.database}${pgo.describe.local ? ' (stack local)' : ''}`);

  const client = await connectPostgres(pgo.options);
  try {
    await client.query(dryRun ? 'BEGIN READ ONLY' : 'BEGIN');
    const state = await describeLegacy(client);
    if (!state.exists) {
      log(`  O schema ${LEGACY_SCHEMA} não existe. Nada a fazer.`);
      await client.query('ROLLBACK');
      return;
    }
    for (const t of state.tables) log(`  ${LEGACY_SCHEMA}.${t.name}: ${formatInt(t.rows)} linhas`);
    if (dryRun) {
      await client.query('ROLLBACK');
      log('Nada foi apagado.');
      return;
    }
    await client.query(`DROP SCHEMA ${qPg(LEGACY_SCHEMA)} CASCADE`);
    await client.query('COMMIT');
    log(`Schema ${LEGACY_SCHEMA} apagado.`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end().catch(() => {});
  }
}

runMain(main);
