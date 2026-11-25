// Acesso ao Postgres do Supabase (destino da cópia e base do saneamento).

import pg from 'pg';
import { LEGACY_SCHEMA, RUNS_TABLE, qPg } from './legacy-schema.mjs';

// Papéis da API do Supabase: nenhum deles pode alcançar o schema legacy.
export const API_ROLES = ['anon', 'authenticated', 'service_role'];

export async function connectPostgres(options) {
  const client = new pg.Client(options);
  await client.connect();
  return client;
}

/** Papéis da API que existem neste banco (na stack local e no Supabase, os três). */
export async function existingApiRoles(client) {
  const { rows } = await client.query('SELECT rolname FROM pg_roles WHERE rolname = ANY($1::text[])', [API_ROLES]);
  return rows.map((r) => r.rolname);
}

/** Estado atual do schema legacy: tabelas, contagens e a última cópia. */
export async function describeLegacy(client) {
  const { rows: schema } = await client.query('SELECT 1 FROM pg_namespace WHERE nspname = $1', [LEGACY_SCHEMA]);
  if (!schema.length) return { exists: false, tables: [], lastRun: null };
  const { rows: tables } = await client.query(
    `SELECT c.relname AS name, c.relkind AS kind FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relkind IN ('r', 'v', 'm', 'p') ORDER BY 1`,
    [LEGACY_SCHEMA],
  );
  const out = [];
  for (const t of tables) {
    const { rows } = await client.query(`SELECT count(*)::bigint AS n FROM ${qPg(LEGACY_SCHEMA)}.${qPg(t.name)}`);
    out.push({ name: t.name, kind: t.kind, rows: Number(rows[0].n) });
  }
  let lastRun = null;
  if (tables.some((t) => t.name === RUNS_TABLE)) {
    const { rows } = await client.query(
      `SELECT id, started_at, finished_at, source_host, source_database, source_schema_version, tables
         FROM ${qPg(LEGACY_SCHEMA)}.${qPg(RUNS_TABLE)} ORDER BY id DESC LIMIT 1`,
    );
    lastRun = rows[0] ?? null;
  }
  return { exists: true, tables: out, lastRun };
}

/**
 * Confere que nenhum papel da API (nem PUBLIC) tem privilégio no schema
 * legacy, nas tabelas, nas colunas ou nas sequências dele. Devolve a lista de problemas (vazia = ok).
 */
export async function legacyPrivilegeProblems(client, roles) {
  const { rows } = await client.query(
    `WITH r AS (SELECT unnest($2::text[]) AS rolname)
     SELECT format('%s tem %s no schema %s', r.rolname, p.priv, $1::text) AS problem
       FROM r CROSS JOIN (VALUES ('USAGE'), ('CREATE')) p(priv)
      WHERE has_schema_privilege(r.rolname, $1::text, p.priv)
     UNION ALL
     SELECT format('%s tem %s em %s.%s', r.rolname, p.priv, $1::text, c.relname)
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       CROSS JOIN r
       CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p(priv)
      WHERE n.nspname = $1::text AND c.relkind IN ('r', 'p', 'v', 'm')
        AND has_table_privilege(r.rolname, c.oid, p.priv)
     UNION ALL
     SELECT format('%s tem %s em alguma coluna de %s.%s', r.rolname, p.priv, $1::text, c.relname)
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       CROSS JOIN r
       CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('REFERENCES')) p(priv)
      WHERE n.nspname = $1::text AND c.relkind IN ('r', 'p', 'v', 'm')
        AND has_any_column_privilege(r.rolname, c.oid, p.priv)
        AND NOT has_table_privilege(r.rolname, c.oid, p.priv)
     UNION ALL
     SELECT format('%s tem %s na sequência %s.%s', r.rolname, p.priv, $1::text, c.relname)
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       CROSS JOIN r
       CROSS JOIN (VALUES ('USAGE'), ('SELECT'), ('UPDATE')) p(priv)
      WHERE n.nspname = $1::text AND c.relkind = 'S'
        AND has_sequence_privilege(r.rolname, c.oid, p.priv)
     UNION ALL
     SELECT format('PUBLIC tem privilégio em %s.%s', $1::text, c.relname)
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace,
            aclexplode(coalesce(c.relacl, acldefault(CASE WHEN c.relkind = 'S' THEN 's' ELSE 'r' END::"char", c.relowner))) a
      WHERE n.nspname = $1::text AND c.relkind IN ('r', 'p', 'v', 'm', 'S') AND a.grantee = 0
     UNION ALL
     SELECT format('PUBLIC tem privilégio em coluna de %s.%s', $1::text, c.relname)
       FROM pg_attribute at JOIN pg_class c ON c.oid = at.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace,
            aclexplode(at.attacl) a
      WHERE n.nspname = $1::text AND at.attacl IS NOT NULL AND a.grantee = 0
     UNION ALL
     SELECT format('PUBLIC tem privilégio no schema %s', $1::text)
       FROM pg_namespace n, aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) a
      WHERE n.nspname = $1::text AND a.grantee = 0
     UNION ALL
     SELECT format('RLS desligada em %s.%s', $1::text, c.relname)
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1::text AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
     UNION ALL
     SELECT format('Política de RLS em %s.%s', $1::text, pol.tablename)
       FROM pg_policies pol WHERE pol.schemaname = $1::text`,
    [LEGACY_SCHEMA, roles],
  );
  return rows.map((r) => r.problem);
}
