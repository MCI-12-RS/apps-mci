// Apoio dos testes de QA da carga (E4 PR 2): MySQL de teste em Docker (porta própria), cópia,
// carga, reset e consultas na stack local. Só roda contra a stack local (pista B, 58322).
// Variáveis: PG_PORT (58322), QA_MYSQL_PORT (53307), QA_MYSQL_CONTAINER (mci-dm-qa-mysql),
// QA_CONFIG (arquivo de configuração de teste; criado pelo run-qa.sh).
import { spawnSync, spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac } from 'node:crypto';
import { loadConfig, postgresOptions } from '../../src/lib/config.mjs';
import { connectPostgres } from '../../src/lib/postgres.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(here, '../..');
export const CONFIG = process.env.QA_CONFIG;
export const CONTAINER = process.env.QA_MYSQL_CONTAINER ?? 'mci-dm-qa-mysql';
if (!CONFIG) throw new Error('QA_CONFIG não definido (use test/qa/run-qa.sh)');
const pgo = postgresOptions(loadConfig(CONFIG).values);
if (!pgo.describe.local) throw new Error('QA só roda contra a stack local');
export const PG_PORT = pgo.describe.port;

export async function pg() { return connectPostgres(pgo.options); }
export async function q(sql, params) {
  const c = await pg();
  try { return (await c.query(sql, params)).rows; } finally { await c.end(); }
}

// --- MySQL ---------------------------------------------------------------------------------
export function mysql(sql) {
  const r = spawnSync('docker', ['exec', '-i', CONTAINER, 'mysql', '--default-character-set=utf8mb4', '-uroot', '-prootpw', 'g12app'],
    { input: sql, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`mysql falhou: ${r.stderr.replace(/mysql: \[Warning\][^\n]*\n/g, '')}`);
  return r.stdout;
}
export const esc = (v) => (v == null ? 'NULL' : typeof v === 'number' || typeof v === 'bigint' ? String(v)
  : typeof v === 'boolean' ? (v ? '1' : '0') : `'${String(v).replaceAll('\\', '\\\\').replaceAll("'", "''")}'`);
const insert = (table, rows) => {
  if (!rows.length) return '';
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const row = (o) => `(${cols.map((c) => esc(o[c] ?? null)).join(',')})`;
  return `INSERT INTO \`${table}\` (${cols.map((c) => `\`${c}\``).join(',')}) VALUES\n${rows.map((r) => row(r)).join(',\n')};\n`;
};

let seq = 0;
export const M = (id, o = {}) => ({
  Id: id, Name: `Pessoa${id} Teste${id}`, Gender: id % 2, Email: `qa${id}@exemplo.org`, MobileNumber: null, CPF: null,
  BirthDate: '1990-01-01 00:00:00', LeadershipId: null, SpouseId: null, HasNoLeadership: 0, Idle: 0, Baptized: 0,
  BaptismDate: null, HomeAddressId: null, Notes: null, ChildrenMembersComputed: 0,
  CreationDate: '2024-05-01 10:11:12', IsDeleted: 0, ...o,
});
export const C = (id, o = {}) => ({
  Id: id, LeadId: 1, TimothyId: 2, HostId: 3, WeekDay: 3, Time: '20:00', PlaceId: null, CellType: 0, ReportMandatory: 0,
  CreationDate: '2024-05-01 10:11:12', IsDeleted: 0, ...o,
});
export const R = (id, o = {}) => ({
  Id: id, CellId: 1, Date: '2026-11-04 20:00:00', Subject: `Tema ${id}`, Notes: null, Visitors: null, NumMembers: 0,
  NumVisitors: 0, Contribution: 0, WeekCellSkipped: 0, LeadershipId: 1, HostId: 3, TimothyId: 2, CellType: 0,
  CreationDate: '2026-11-05 10:00:00', IsDeleted: 0, ...o,
});

/** Troca toda a massa do MySQL e copia para o schema legacy do Postgres. */
export function legacy({ addresses = [], members = [], cells = [], reports = [], participants = [] }, env = {}) {
  seq += 1;
  mysql(`SET FOREIGN_KEY_CHECKS = 0; SET SESSION sql_mode = '';
    DELETE FROM ReportMembers; DELETE FROM Reports; DELETE FROM Cells; DELETE FROM Members; DELETE FROM Addresses;
    ${insert('Addresses', addresses.map((a) => ({ IsDeleted: 0, ...a })))}
    ${insert('Members', members)}${insert('Cells', cells)}${insert('Reports', reports)}
    ${insert('ReportMembers', participants.map(([MemberId, ReportId]) => ({ MemberId, ReportId })))}`);
  const r = spawnSync('node', ['--no-deprecation', resolve(ROOT, 'src/copy-raw.mjs'), '--config', CONFIG],
    { encoding: 'utf8', env: { ...process.env, ...env } });
  if (r.status !== 0) throw new Error(`copy-raw falhou:\n${r.stdout}\n${r.stderr}`);
}

export function load(args = [], { env = {}, timeout = 120000 } = {}) {
  const out = resolve('/tmp/claude-0/qa-reports');
  const r = spawnSync('node', ['--no-deprecation', resolve(ROOT, 'src/load.mjs'), '--config', CONFIG, '--out-dir', out, ...args],
    { encoding: 'utf8', env: { ...process.env, ...env }, timeout });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}
export function loadAsync(args = []) {
  const out = resolve('/tmp/claude-0/qa-reports');
  const child = spawn('node', ['--no-deprecation', resolve(ROOT, 'src/load.mjs'), '--config', CONFIG, '--out-dir', out, ...args]);
  let buf = '';
  child.stdout.on('data', (d) => { buf += d; });
  child.stderr.on('data', (d) => { buf += d; });
  const done = new Promise((res) => child.on('close', (status) => res({ status, out: buf })));
  return { child, done };
}

export const ADMINS = ['--pastor-ids', '1', '--admin-ids', '1,2'];

export function resetDest() {
  const r = spawnSync('node', ['--no-deprecation', resolve(ROOT, 'test/assert-load.mjs'), CONFIG, 'reset'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`reset falhou:\n${r.stdout}${r.stderr}`);
  // O destino de teste começa vazio: tira também o que os testes criaram "no novo".
  const w = spawnSync('psql', [`postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/postgres`, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-c',
    `BEGIN; SET LOCAL session_replication_role = replica;
     DELETE FROM public.cell_report_participants; DELETE FROM public.cell_reports; DELETE FROM public.cells; DELETE FROM public.members;
     DELETE FROM auth.sessions; DELETE FROM auth.users; COMMIT;
     SELECT private.rebuild_member_hierarchy(); SELECT private.backfill_cell_active_periods();`], { encoding: 'utf8' });
  if (w.status !== 0) throw new Error(`wipe falhou: ${w.stderr}`);
}
/** Espera o servidor estar dormindo no pg_sleep do trap (a carga chegou à gravação). */
export async function waitSleeping(ms = 20000) {
  for (let t = Date.now(); Date.now() - t < ms;) {
    const [x] = await q(`SELECT pid FROM pg_stat_activity WHERE wait_event = 'PgSleep' AND pid <> pg_backend_pid()`);
    if (x) return x.pid;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

/** Retrato do destino (as tabelas da carga e o que ela mexe). */
export async function fingerprint() {
  const out = {};
  for (const t of ['public.members', 'public.cells', 'public.cell_reports', 'public.cell_report_participants',
    'private.member_hierarchy', 'private.cell_active_periods', 'public.events', 'auth.users']) {
    const [r] = await q(`SELECT count(*)::int AS n, md5(coalesce(string_agg(x::text, E'\\n' ORDER BY x::text), '')) AS h FROM ${t} x`);
    out[t] = `${r.n}:${r.h}`;
  }
  const [c] = await q(`SELECT to_regclass('legacy._load_runs') IS NOT NULL AS runs, to_regclass('legacy._load_adopted') IS NOT NULL AS ad`);
  out.control = `${c.runs}/${c.ad}`;
  return out;
}

export async function integrity() {
  const [r] = await q(`SELECT (SELECT count(*) FROM private.member_hierarchy_drift())::int AS drift,
      (SELECT count(*) FROM private.cell_active_period_problems())::int AS periods,
      (SELECT count(*) FROM private.member_rule_violations())::int AS member_rules,
      (SELECT count(*) FROM private.cell_rule_violations())::int AS cell_rules,
      (SELECT count(*) FROM public.roles WHERE is_default)::int AS defaults`);
  return r;
}

// --- JWT local (stack da pista B) --------------------------------------------------------------
import { execFileSync } from 'node:child_process';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
let secret;
export function jwt(claims) {
  secret ??= execFileSync('docker', ['exec', 'supabase_auth_mci-b', 'printenv', 'GOTRUE_JWT_SECRET'], { encoding: 'utf8' }).trim();
  const h = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: 'supabase-demo', exp: 4102444800, ...claims })}`;
  return `${h}.${createHmac('sha256', secret).update(h).digest('base64url')}`;
}
export const API = `http://127.0.0.1:${process.env.QA_API_PORT ?? 58321}`;
export async function rest(path, { token, method = 'GET', body, headers = {} } = {}) {
  const t = token ?? jwt({ role: 'service_role' });
  const res = await fetch(`${API}${path}`, {
    method, body: body ? JSON.stringify(body) : undefined,
    headers: { apikey: t, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', Prefer: 'count=exact', ...headers },
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json, count: res.headers.get('content-range') };
}
/** Cria conta + sessão para um membro carregado (o que o E4.08 fará) e devolve um token de usuário. */
export async function userToken(memberLid) {
  const c = await pg();
  try {
    const [m] = (await c.query('SELECT id FROM public.members WHERE legacy_id = $1', [memberLid])).rows;
    await c.query(`INSERT INTO auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
                   VALUES ($1::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $1::text || '@mci12fakemail.com', now(), '{}', '{}', now(), now())
                   ON CONFLICT DO NOTHING`, [m.id]);
    await c.query('UPDATE public.members SET auth_user_id = id WHERE id = $1 AND auth_user_id IS NULL', [m.id]);
    const sid = (await c.query(`INSERT INTO auth.sessions (id, user_id, created_at, updated_at) VALUES (gen_random_uuid(), $1, now(), now()) RETURNING id`, [m.id])).rows[0].id;
    return jwt({ role: 'authenticated', sub: m.id, aud: 'authenticated', session_id: sid, email: `${m.id}@mci12fakemail.com` });
  } finally { await c.end(); }
}
