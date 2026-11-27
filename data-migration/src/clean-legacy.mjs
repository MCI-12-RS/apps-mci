#!/usr/bin/env node
// Limpeza do staging: apaga o schema `legacy` do destino (DROP SCHEMA … CASCADE).
// Exige --yes. Com --dry-run, só mostra o que seria apagado.
// Recusa enquanto houver carga no destino (members.legacy_id preenchido, DT-05 do
// spec e4-carga): o controle da carga (legacy._load_runs, legacy._load_adopted) fica
// no schema e a limpeza do ensaio (npm run unload) precisa dele. Depois do cutover,
// --after-cutover libera.

import { loadConfig, postgresOptions } from './lib/config.mjs';
import { parseCli, log, runMain, formatInt } from './lib/cli.mjs';
import { connectPostgres, describeLegacy } from './lib/postgres.mjs';
import { LEGACY_SCHEMA, qPg } from './lib/legacy-schema.mjs';

const USAGE = `
Uso: node src/clean-legacy.mjs [--config <arquivo>] (--dry-run | --yes) [--after-cutover]

  --dry-run        mostra o que seria apagado, sem apagar
  --yes            confirma a remoção do schema ${LEGACY_SCHEMA} (e de tudo dentro dele)
  --after-cutover  apaga mesmo com a carga no destino (só depois da carga final, 7.4 do plano)
`;

async function main() {
  const args = parseCli({
    yes: { type: 'boolean', default: false },
    'after-cutover': { type: 'boolean', default: false },
  }, USAGE);
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
    const loaded = await loadedMembers(client);
    if (loaded > 0) {
      const msg = `Há carga no destino (${formatInt(loaded)} membros com legacy_id). `
        + 'Rode a limpeza do ensaio antes, ou use --after-cutover depois da carga final.';
      if (!args['after-cutover']) {
        if (!dryRun) throw new Error(msg);
        log(`  AVISO: ${msg}`);
      } else {
        log(`  Carga no destino (${formatInt(loaded)} membros com legacy_id): --after-cutover.`);
      }
    }
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

/** Membros carregados no destino (0 se a coluna do E4 PR 1 não existir). */
async function loadedMembers(client) {
  const { rows: [c] } = await client.query(`SELECT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'legacy_id') AS has_col`);
  if (!c.has_col) return 0;
  const { rows: [r] } = await client.query('SELECT count(*)::int AS n FROM public.members WHERE legacy_id IS NOT NULL');
  return r.n;
}

runMain(main);
