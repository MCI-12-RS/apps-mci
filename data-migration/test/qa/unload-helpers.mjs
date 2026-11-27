// Apoio dos testes de QA da limpeza do ensaio (E4 PR 3, `npm run unload`): execução do unload e das
// contas, cadastros "do app" (com os triggers ligados), retrato normalizado do destino e varredura de vazamento.
// Só roda contra a stack local da pista B (a chave secreta vem de `supabase status`, nunca é impressa).
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { CONFIG, ROOT, q, pg, resetDest } from './harness.mjs';

export const LANE = process.env.QA_LANE_DIR ?? '/home/user/apps-mci/.worktrees/mci-connect-b';
export const API = `http://127.0.0.1:${process.env.QA_API_PORT ?? 58321}`;

export const ctx = { WORK: null, OUT: null, CFG: null, SECRET: null };
export const LEAKS = []; // todo texto produzido (saída das execuções e relatórios), para a varredura

export function statusEnv() {
  const txt = execFileSync('supabase', ['status', '-o', 'env'], { cwd: LANE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const get = (k) => new RegExp(`^${k}="(.*)"$`, 'm').exec(txt)?.[1];
  return { secret: get('SECRET_KEY'), pub: get('PUBLISHABLE_KEY') };
}
export const cfgWith = (name, extra) => {
  const p = join(ctx.WORK, name);
  writeFileSync(p, `${readFileSync(CONFIG, 'utf8')}\n${extra}\n`, { mode: 0o600 });
  return p;
};
export function setup() {
  ctx.WORK = mkdtempSync(join(tmpdir(), 'qa-unload-'));
  ctx.OUT = join(ctx.WORK, 'reports');
  ctx.SECRET = statusEnv().secret;
  if (!ctx.SECRET?.startsWith('sb_secret_')) throw new Error('sem a chave secreta da stack local');
  ctx.CFG = cfgWith('unload.config', `SUPABASE_URL="${API}"\nSUPABASE_SECRET_KEY="${ctx.SECRET}"`);
}
export function teardown() { rmSync(ctx.WORK, { recursive: true, force: true }); }

function collectOutputs() {
  if (!existsSync(ctx.OUT)) return;
  for (const f of readdirSync(ctx.OUT)) LEAKS.push(readFileSync(join(ctx.OUT, f), 'utf8'));
}
const run = (script, args, { cfg = ctx.CFG, env = {}, timeout = 240000 } = {}) => {
  const r = spawnSync('node', ['--no-deprecation', resolve(ROOT, script), '--config', cfg, '--out-dir', ctx.OUT, ...args],
    { encoding: 'utf8', env: { ...process.env, ...env }, timeout });
  const out = `${r.stdout}${r.stderr}`;
  LEAKS.push(out);
  collectOutputs();
  return { status: r.status, out };
};
export const unload = (args = [], o) => run('src/unload.mjs', args, o);
export const accountsAsync = (args = []) => unloadAsync(args, 'src/accounts.mjs');
export const accounts = (args = [], o) => run('src/accounts.mjs', args, o);
export const loadNode = (args = [], o) => run('src/load.mjs', args, o);
export function unloadAsync(args = [], script = 'src/unload.mjs') {
  const child = spawn('node', ['--no-deprecation', resolve(ROOT, script), '--config', ctx.CFG, '--out-dir', ctx.OUT, ...args]);
  let buf = '';
  child.stdout.on('data', (d) => { buf += d; });
  child.stderr.on('data', (d) => { buf += d; });
  const done = new Promise((res) => child.on('close', (status, signal) => { LEAKS.push(buf); res({ status, signal, out: buf }); }));
  return { child, done };
}

/** Limpa o destino e o que o harness e o unload deixam (execuções da limpeza, identidades órfãs, Auditoria). */
export async function clean() {
  resetDest();
  await q(`DELETE FROM auth.identities WHERE user_id NOT IN (SELECT id FROM auth.users)`);
  await q(`DROP TABLE IF EXISTS legacy._unload_runs`);
  await q(`DELETE FROM private.sign_in_throttle`).catch(() => {});
  await q(`DELETE FROM public.events`).catch(() => {});
  await q(`DELETE FROM private.member_access_suspensions`).catch(() => {});
  await q(`DELETE FROM private.account_passwords`).catch(() => {});
  if (existsSync(ctx.OUT)) for (const f of readdirSync(ctx.OUT)) rmSync(join(ctx.OUT, f));
}

// --- cadastros do app (triggers ligados, como a tela grava) -------------------------------------
export const U = (n) => `00000000-0000-4000-9000-${String(n).padStart(12, '0')}`;
const ROLE_DEF = '(SELECT id FROM public.roles WHERE is_default)';
const ROLE_SYS = '(SELECT id FROM public.roles WHERE is_system)';
let seq = 0;
export async function addMember(id, o = {}, c) {
  seq += 1;
  const own = !c;
  c ??= await pg();
  try {
    if (o.account) {
      await c.query(`INSERT INTO auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                       created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
        VALUES ($1::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $1::text || '@mci12fakemail.com', now(),
                '{}', '{}', now(), now(), '', '', '', '')`, [id]);
    }
    await c.query(`INSERT INTO public.members (id, name, email, mobile_whatsapp, cpf, gender, is_pastor, has_leadership, leader_id, spouse_id,
                     role_id, auth_user_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, ${o.admin ? ROLE_SYS : ROLE_DEF}, $11)`,
    [id, o.name ?? `Nova Pessoa${id.slice(-6)} Teste`, o.email ?? (o.mobile || o.cpf ? null : `nv${id.slice(-8)}@novo.test`), o.mobile ?? null, o.cpf ?? null,
      o.gender ?? 'M', !!o.pastor, !o.pastor && !!o.leader, o.leader ?? null, o.spouse ?? null, o.account ? id : null]);
    if (o.account && o.password !== false) await c.query(`SELECT private.write_password($1, $1, 'Senha Forte Do Teste 9!', $1)`, [id]);
    if (o.deleted) await c.query(`UPDATE public.members SET deleted_at = now(), deleted_by_kind = 'unknown' WHERE id = $1`, [id]);
  } finally { if (own) await c.end(); }
  return id;
}
export async function addCell(id, leader, timothy, host, day = 'Quinta', time = '19:30') {
  await q(`INSERT INTO public.cells (id, leader_id, timothy_id, host_id, meeting_day, meeting_time, type)
           VALUES ($1, $2, $3, $4, $5, $6, 'Evangelística')`, [id, leader, timothy, host, day, time]);
  return id;
}
export async function addReport(id, cellId, date, participants) {
  const c = await pg();
  try {
    await c.query('BEGIN');
    await c.query(`SET LOCAL mci.cell_report_write = 'on'`);
    await c.query(`INSERT INTO public.cell_reports (id, cell_id, date, time, was_held, theme, offering)
                   VALUES ($1, $2, $3, '19:30', true, 'Tema do teste', 5)`, [id, cellId, date]);
    for (const m of participants) {
      await c.query('INSERT INTO public.cell_report_participants (report_id, member_id) VALUES ($1, $2)', [id, m]);
    }
    await c.query('COMMIT');
  } finally { await c.end(); }
  return id;
}
export const mid = async (lid) => (await q('SELECT id FROM public.members WHERE legacy_id = $1', [lid]))[0]?.id;
export const cid = async (lid) => (await q('SELECT id FROM public.cells WHERE legacy_id = $1', [lid]))[0]?.id;
export { randomUUID };

// --- retrato normalizado do destino ---------------------------------------------------------------
// Cada linha vira JSON; colunas de data/hora (`*_at`), hash e senha viram "presente ou não"; a `id` dos
// participantes sai (é gerada). Permite comparar duas execuções feitas em momentos diferentes.
const NORM = (t, drop = []) => `SELECT coalesce(jsonb_agg(r ORDER BY r::text), '[]'::jsonb) AS rows FROM (
  SELECT (SELECT jsonb_object_agg(k, CASE WHEN k ~ '(_at$|hash|password|token|^updated_at$)' THEN to_jsonb(v IS NOT NULL AND v <> 'null'::jsonb) ELSE v END)
            FROM jsonb_each(to_jsonb(x) - $1::text[]) e(k, v)) AS r FROM ${t} x) y`;
export const SNAP_TABLES = {
  members: ['public.members', []], cells: ['public.cells', []], reports: ['public.cell_reports', []],
  participants: ['public.cell_report_participants', ['id']], hierarchy: ['private.member_hierarchy', []],
  users: ['auth.users', []], identities: ['auth.identities', []], sessions: ['auth.sessions', []],
  vault: ['private.account_passwords', []], suspensions: ['private.member_access_suspensions', []],
  credentials: ['private.legacy_credentials', []], roles: ['public.roles', []], role_permissions: ['public.role_permissions', []],
};
export async function normSnap() {
  const out = {};
  for (const [k, [t, drop]] of Object.entries(SNAP_TABLES)) {
    const [r] = await q(NORM(t), [drop]);
    out[k] = r.rows.map((x) => JSON.stringify(x));
  }
  const [p] = await q(`SELECT count(*)::int AS n FROM private.cell_active_periods`);
  out.cell_periods = p.n;
  return out;
}
/** Retrato bruto (com as datas): para o --dry-run, que não pode mudar nada. */
export async function rawSnap() {
  const out = {};
  for (const [k, [t]] of Object.entries(SNAP_TABLES)) {
    const [r] = await q(`SELECT count(*)::int AS n, md5(coalesce(string_agg(x::text, E'\\n' ORDER BY x::text), '')) AS h FROM ${t} x`);
    out[k] = `${r.n}:${r.h}`;
  }
  for (const t of ['legacy._load_runs', 'legacy._load_adopted', 'legacy._accounts_runs', 'legacy._unload_runs', 'public.events']) {
    const [r] = await q(`SELECT CASE WHEN to_regclass($1) IS NULL THEN 'n/a' ELSE (SELECT count(*)::text FROM ${t}) END AS n`, [t]).catch(() => [{ n: 'n/a' }]);
    out[t] = r.n;
  }
  const [p] = await q(`SELECT count(*)::int AS n, md5(coalesce(string_agg(x::text, E'\\n' ORDER BY x::text), '')) AS h FROM private.cell_active_periods x`);
  out.cell_periods = `${p.n}:${p.h}`;
  return out;
}
export function diffSnap(a, b) {
  const d = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (JSON.stringify(a[k]) === JSON.stringify(b[k])) continue;
    if (Array.isArray(a[k])) {
      d[k] = { only_before: a[k].filter((x) => !b[k].includes(x)).map((x) => x.slice(0, 1200)), only_after: b[k].filter((x) => !a[k].includes(x)).map((x) => x.slice(0, 1200)) };
    } else d[k] = { before: a[k], after: b[k] };
  }
  return d;
}

export async function problems() {
  const [r] = await q(`SELECT (SELECT count(*) FROM private.member_hierarchy_drift())::int AS drift,
      (SELECT count(*) FROM private.cell_active_period_problems())::int AS periods,
      (SELECT count(*) FROM private.member_rule_violations())::int AS member_rules,
      (SELECT count(*) FROM private.cell_rule_violations())::int AS cell_rules,
      (SELECT count(*) FROM private.legacy_credential_problems())::int AS credentials,
      (SELECT count(*) FROM public.roles WHERE is_default)::int AS defaults,
      (SELECT count(*) FROM public.members WHERE legacy_id IS NOT NULL)::int AS legacy_members,
      (SELECT count(*) FROM public.cells WHERE legacy_id IS NOT NULL)::int AS legacy_cells,
      (SELECT count(*) FROM public.cell_reports WHERE legacy_id IS NOT NULL)::int AS legacy_reports,
      (SELECT count(*) FROM auth.users WHERE raw_app_meta_data ? 'legacy_member_id')::int AS legacy_accounts`);
  return r;
}
export const CLEAN_STATE = { drift: 0, periods: 0, member_rules: 0, cell_rules: 0, credentials: 0, defaults: 1,
  legacy_members: 0, legacy_cells: 0, legacy_reports: 0, legacy_accounts: 0 };

export const PII = /@exemplo\.org|@novo\.test|mci12fakemail|Pessoa\d+ Teste|Nova Pessoa|Editado|sb_secret_|eyJ[A-Za-z0-9_-]{10,}|\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{11}\b|\b[0-9a-f]{32}\b|Senha Forte/;
export const hasPii = (txt) => PII.exec(txt)?.[0] ?? null;

// --- exclusão e restauração como a RPC faz (sem sessão de usuário) -------------------------------------
export async function delMember(id) {
  const c = await pg();
  try {
    await c.query('BEGIN');
    const [m] = (await c.query('SELECT auth_user_id FROM public.members WHERE id = $1', [id])).rows;
    await c.query(`UPDATE public.members SET deleted_at = now(), deleted_by_kind = 'unknown' WHERE id = $1`, [id]);
    if (m.auth_user_id) await c.query('SELECT public._del_suspend_access($1, $2)', [id, m.auth_user_id]);
    await c.query('COMMIT');
  } finally { await c.end(); }
}
export async function restoreMember(id) {
  const c = await pg();
  try {
    await c.query('BEGIN');
    await c.query('UPDATE public.members SET deleted_at = NULL, deleted_by_kind = NULL WHERE id = $1', [id]);
    await c.query('SELECT public._del_resume_access($1)', [id]);
    await c.query('COMMIT');
  } finally { await c.end(); }
}
/** Sessão de verdade (linha em auth.sessions) para um cadastro com conta: devolve um JWT local. */
export async function tokenFor(memberId, jwt) {
  const [s] = await q(`INSERT INTO auth.sessions (id, user_id, created_at, updated_at) VALUES (gen_random_uuid(), $1, now(), now()) RETURNING id`, [memberId]);
  return jwt({ role: 'authenticated', sub: memberId, aud: 'authenticated', session_id: s.id, email: `${memberId}@mci12fakemail.com` });
}
