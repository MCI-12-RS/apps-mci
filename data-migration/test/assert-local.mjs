#!/usr/bin/env node
// Asserções do teste local (test/run-local.sh). Só para a stack local.
//   node test/assert-local.mjs <config> no-legacy
//   node test/assert-local.mjs <config> fingerprint            (imprime o retrato do schema legacy)
//   node test/assert-local.mjs <config> sanitation <pastor-ids>
//   node test/assert-local.mjs <config> checksum-detects-change
//   node test/assert-local.mjs <config> grants
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { loadConfig, postgresOptions } from '../src/lib/config.mjs';
import { connectPostgres, existingApiRoles, legacyPrivilegeProblems } from '../src/lib/postgres.mjs';
import { LEGACY_TABLES, pgChecksumSql } from '../src/lib/legacy-schema.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const [configPath, mode, arg] = process.argv.slice(2);
const pgo = postgresOptions(loadConfig(configPath).values);
assert.ok(pgo.describe.local, 'assert-local só roda contra a stack local');
const client = await connectPostgres(pgo.options);

try {
  if (mode === 'no-legacy') {
    const { rows } = await client.query("SELECT count(*)::int AS n FROM pg_namespace WHERE nspname = 'legacy'");
    assert.equal(rows[0].n, 0, 'o schema legacy não deveria existir');
    console.log('ok: schema legacy ausente');
  } else if (mode === 'fingerprint') {
    // Retrato independente do checksum da ferramenta: md5 do texto de cada linha.
    const out = {};
    for (const t of LEGACY_TABLES) {
      const { rows } = await client.query(
        `SELECT count(*)::int AS n, md5(coalesce(string_agg(x::text, E'\\n' ORDER BY x::text), '')) AS h FROM legacy."${t.name}" x`,
      );
      out[t.name] = `${rows[0].n}:${rows[0].h}`;
    }
    const { rows: runs } = await client.query('SELECT count(*)::int AS n FROM legacy._copy_runs');
    out._copy_runs = runs[0].n;
    console.log(JSON.stringify(out));
  } else if (mode === 'sanitation') {
    const expected = JSON.parse(readFileSync(resolve(here, 'expected-sanitation.json'), 'utf8'));
    await client.query('BEGIN READ ONLY');
    await client.query(`SELECT set_config('mci.pastor_ids', $1, true)`, [`{${arg}}`]);
    const [counts, checks] = await client.query(readFileSync(resolve(here, '..', 'sql', 'sanitation-report.sql'), 'utf8'));
    await client.query('ROLLBACK');
    for (const c of counts.rows) {
      assert.deepEqual([c.total, c.not_deleted, c.deleted].map(Number), expected._counts[c.entity], `contagem ${c.entity}`);
    }
    const codes = Object.keys(expected).filter((k) => !k.startsWith('_'));
    assert.deepEqual(checks.rows.map((r) => r.code).sort(), [...codes].sort(), 'lista de verificações');
    for (const r of checks.rows) {
      assert.deepEqual(r.items.map((i) => i.id), expected[r.code], `itens de ${r.code}`);
    }
    // Nenhuma saída com dado pessoal da massa (nomes, e-mails, CPF, celular).
    const text = JSON.stringify(checks.rows);
    for (const pii of ['Ficticio', 'exemplo.org', 'mci12fakemail', '52998224725', '999990002']) {
      assert.ok(!text.includes(pii), `saída do saneamento contém dado pessoal (${pii})`);
    }
    console.log(`ok: ${checks.rows.length} verificações e as contagens batem com o esperado`);
  } else if (mode === 'checksum-detects-change') {
    // O checksum precisa mudar quando uma linha muda (prova de que a conferência pega divergência).
    const cols = (await client.query(
      `SELECT a.attname AS name, format_type(a.atttypid, a.atttypmod) AS t FROM pg_attribute a
        WHERE a.attrelid = 'legacy."Members"'::regclass AND a.attnum > 0 AND NOT a.attisdropped ORDER BY a.attnum`,
    )).rows;
    const kindOf = (t) => (t === 'boolean' ? 'bool' : t === 'integer' ? 'int' : t.startsWith('timestamp') ? 'timestamp' : 'text');
    const table = { name: 'Members', columns: cols.map((c) => ({ name: c.name, kind: kindOf(c.t) })) };
    await client.query('BEGIN');
    const before = (await client.query(pgChecksumSql(table))).rows[0];
    await client.query(`UPDATE legacy."Members" SET "Notes" = coalesce("Notes", '') || '.' WHERE "Id" = 2`);
    const after = (await client.query(pgChecksumSql(table))).rows[0];
    await client.query('ROLLBACK');
    assert.notEqual(`${before.n}:${before.s}`, `${after.n}:${after.s}`);
    console.log('ok: checksum muda quando uma linha muda');
  } else if (mode === 'grants') {
    const roles = await existingApiRoles(client);
    assert.deepEqual(roles.sort(), ['anon', 'authenticated', 'service_role']);
    const problems = await legacyPrivilegeProblems(client, roles);
    assert.deepEqual(problems, []);
    for (const role of roles) {
      await client.query('BEGIN');
      await client.query(`SET LOCAL ROLE ${role}`);
      await assert.rejects(client.query('SELECT 1 FROM legacy."Members" LIMIT 1'), /permission denied/);
      await client.query('ROLLBACK');
    }
    // A conferência acusa privilégio em coluna e em sequência.
    await client.query('BEGIN');
    await client.query('GRANT SELECT ("Id") ON legacy."Members" TO anon');
    await client.query('GRANT USAGE ON SEQUENCE legacy._copy_runs_id_seq TO authenticated');
    const found = await legacyPrivilegeProblems(client, roles);
    await client.query('ROLLBACK');
    assert.ok(found.some((p) => /^anon tem SELECT em alguma coluna de legacy\.Members$/.test(p)), found.join('; '));
    assert.ok(found.some((p) => /^authenticated tem USAGE na sequência legacy\._copy_runs_id_seq$/.test(p)), found.join('; '));
    console.log('ok: anon, authenticated e service_role não alcançam o schema legacy (e a conferência acusa coluna e sequência)');
  } else {
    throw new Error(`modo desconhecido: ${mode}`);
  }
} finally {
  await client.end();
}
