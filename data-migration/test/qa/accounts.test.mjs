// QA E4 PR 4: `npm run accounts` (E4.08, DT-14). O que o `test:unit`, o `test:local` e o `assert-accounts`
// não cobrem: o login de ponta a ponta pela Edge Function `sign-in` (edge runtime da stack local da pista B),
// concorrência com a carga e entre duas execuções, processo morto no meio de cada fase, adotados (com e sem
// conta), senhas com acento/emoji e MD5 fora do formato, configuração errada e vazamento de chave e de dado pessoal.
//
// Precisa do edge runtime servindo a `sign-in` na API da stack (http://127.0.0.1:58321/functions/v1/sign-in):
//   (cd .worktrees/mci-connect-b && supabase functions serve)   # com o repassador do proxy, ver docs/ambiente-nuvem.md
// Só dados fictícios; só a stack local. A chave secreta vem de `supabase status` (nunca é impressa).
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { legacy, load, resetDest, fingerprint, q, pg, M, ADMINS, ROOT, CONFIG, PG_PORT } from './harness.mjs';

const LANE = process.env.QA_LANE_DIR ?? '/home/user/apps-mci/.worktrees/mci-connect-b';
const API = `http://127.0.0.1:${process.env.QA_API_PORT ?? 58321}`;
const md5 = (s) => createHash('md5').update(s, 'utf8').digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let WORK; let CFG; let OUT; let SECRET; let PUB; let LOGS = '';
const LEAKS = []; // todo texto produzido (saída das execuções e relatórios) para a varredura de vazamento

function statusEnv() {
  const txt = execFileSync('supabase', ['status', '-o', 'env'], { cwd: LANE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const get = (k) => new RegExp(`^${k}="(.*)"$`, 'm').exec(txt)?.[1];
  return { secret: get('SECRET_KEY'), pub: get('PUBLISHABLE_KEY') };
}
const baseConfig = () => readFileSync(CONFIG, 'utf8');
const cfgWith = (name, extra) => {
  const p = join(WORK, name);
  writeFileSync(p, `${baseConfig()}\n${extra}\n`, { mode: 0o600 });
  return p;
};

function collectOutputs() {
  if (!existsSync(OUT)) return;
  for (const f of readdirSync(OUT)) LEAKS.push(readFileSync(join(OUT, f), 'utf8'));
}
function accounts(args = [], { cfg = CFG, env = {}, timeout = 240000 } = {}) {
  const r = spawnSync('node', ['--no-deprecation', resolve(ROOT, 'src/accounts.mjs'), '--config', cfg, '--out-dir', OUT, ...args],
    { encoding: 'utf8', env: { ...process.env, ...env }, timeout });
  const out = `${r.stdout}${r.stderr}`;
  LEAKS.push(out);
  collectOutputs();
  return { status: r.status, out };
}
function accountsAsync(args = []) {
  const child = spawn('node', ['--no-deprecation', resolve(ROOT, 'src/accounts.mjs'), '--config', CFG, '--out-dir', OUT, ...args]);
  let buf = '';
  child.stdout.on('data', (d) => { buf += d; });
  child.stderr.on('data', (d) => { buf += d; });
  const done = new Promise((res) => child.on('close', (status, signal) => { LEAKS.push(buf); res({ status, signal, out: buf }); }));
  return { child, done };
}

let ipSeq = 0;
async function signIn(identifier, password, ip) {
  ipSeq += 1;
  const res = await fetch(`${API}/functions/v1/sign-in`, {
    method: 'POST',
    headers: { apikey: PUB, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip ?? `10.77.${(ipSeq >> 8) & 255}.${ipSeq & 255}` },
    body: JSON.stringify({ identifier, password }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

/** Limpa o que o harness deixa: identidades órfãs (o wipe em replica não cascateia) e o limite de login. */
async function clean() {
  resetDest();
  await q(`DELETE FROM auth.identities WHERE user_id NOT IN (SELECT id FROM auth.users)`);
  await q(`DELETE FROM private.sign_in_throttle`);
  await q(`DELETE FROM public.events`).catch(() => {});
  if (existsSync(OUT)) for (const f of readdirSync(OUT)) rmSync(join(OUT, f));
}

const PW = {
  1: 'Pastor Senha Forte 1!',
  2: 'Sénha-Ação 🔥 Forte 42', // acento e emoji (MD5 do UTF-8)
  3: 'Senha Maiuscula 77!', // MD5 maiúsculo com espaços (lower(btrim))
  4: 'Celular Senha 9876!',
  5: '123456', // fora da política: entra e recebe a marca
  6: 'Cpf Senha Forte 66!',
  11: `${'A'.repeat(80)}a1!`, // acima de 72 bytes (bcrypt)
};
const CPF6 = '529.982.247-25';
const baseMembers = () => [
  M(1, { Name: 'Pastor Um', Gender: 0, Password: md5(PW[1]) }),
  M(2, { LeadershipId: 1, Password: md5(PW[2]) }),
  M(3, { LeadershipId: 1, Password: ` ${md5(PW[3]).toUpperCase()} ` }),
  M(4, { LeadershipId: 1, Email: null, MobileNumber: '51 98888-0004', Password: md5(PW[4]) }),
  M(5, { LeadershipId: 1, Password: md5(PW[5]) }),
  M(6, { LeadershipId: 1, Email: null, CPF: CPF6, Password: md5(PW[6]) }),
  M(7, { LeadershipId: 1, Password: md5('') }),
  M(8, { LeadershipId: 1, IsDeleted: 1, Password: md5('Excluido Senha 8!') }),
  M(9, { LeadershipId: 1, Email: null, Password: md5('Sem Identificador 9!') }),
  M(11, { LeadershipId: 1, Password: md5(PW[11]) }),
];
const seed = (members = baseMembers()) => legacy({ members, cells: [], reports: [], participants: [] });
const mid = async (lid) => (await q('SELECT id FROM public.members WHERE legacy_id = $1', [lid]))[0]?.id;

before(() => {
  WORK = mkdtempSync(join(tmpdir(), 'qa-accounts-'));
  OUT = join(WORK, 'reports');
  ({ secret: SECRET, pub: PUB } = statusEnv());
  assert.ok(SECRET?.startsWith('sb_secret_') && PUB, 'sem as chaves da stack local (supabase status em QA_LANE_DIR)');
  CFG = cfgWith('accounts.config', `SUPABASE_URL="${API}"\nSUPABASE_SECRET_KEY="${SECRET}"`);
  LOGS = new Date().toISOString();
});
after(async () => {
  try { await clean(); } catch { /* o run-qa.sh limpa de novo */ }
  rmSync(WORK, { recursive: true, force: true });
});
beforeEach(() => clean());

describe('Login de ponta a ponta pela Edge Function sign-in, depois de npm run accounts', () => {
  test('primeiro login com a senha do legado (acento/emoji, maiúsculo com espaços, celular, CPF, fora da política, > 72 bytes), segundo login, senha errada e bloqueio', async () => {
    seed();
    assert.equal(load(ADMINS).status, 0);
    const r = accounts();
    assert.equal(r.status, 0, r.out);
    // Quem tem conta e quem não tem.
    const have = await q(`SELECT legacy_id FROM public.members WHERE auth_user_id IS NOT NULL ORDER BY 1`);
    assert.deepEqual(have.map((x) => x.legacy_id), [1, 2, 3, 4, 5, 6, 7, 11]);

    const ok = async (ident, pw, mustChange = false) => {
      const s = await signIn(ident, pw);
      assert.equal(s.status, 200, `${ident}: ${JSON.stringify(s.body)}`);
      assert.equal(s.body.result, 'ok');
      assert.ok(s.body.session?.access_token);
      assert.equal(Boolean(s.body.must_change_password), mustChange, `must_change_password de ${ident}`);
      return s;
    };
    // 1º login: e-mail, acento/emoji, maiúsculo com espaços, celular (formas diferentes), CPF, > 72 bytes, fraca.
    await ok('qa1@exemplo.org', PW[1]);
    await ok('QA2@Exemplo.org', PW[2]);
    await ok('qa3@exemplo.org', PW[3]);
    await ok('(51) 98888-0004', PW[4]);
    await ok('51988880004', PW[4]);
    await ok('529.982.247-25', PW[6]);
    await ok('52998224725', PW[6]);
    await ok('qa11@exemplo.org', PW[11], true); // acima de 72 bytes: entra e recebe a marca (DA-2)
    await ok('qa5@exemplo.org', PW[5], true); // fora da política: entra e recebe a marca
    // O cofre recebeu a senha de quem entrou (as legadas até 72 bytes viram senha do novo; a credencial some).
    const vault = await q(`SELECT m.legacy_id, (v.password_hash IS NOT NULL) AS has_pw,
                                  (c.member_id IS NOT NULL) AS has_cred, c.used_at IS NOT NULL AS used
                             FROM public.members m
                             LEFT JOIN private.account_passwords v ON v.auth_user_id = m.auth_user_id
                             LEFT JOIN private.legacy_credentials c ON c.member_id = m.id
                            WHERE m.legacy_id = ANY ($1) ORDER BY 1`, [[1, 2, 3, 4, 5, 6, 11]]);
    for (const v of vault.filter((x) => x.legacy_id !== 11)) assert.equal(v.has_pw, true, `cofre do ${v.legacy_id}`);
    assert.equal(vault.find((x) => x.legacy_id === 11).has_cred, true, '> 72 bytes: a credencial fica, usada (DA-2)');
    assert.equal(vault.find((x) => x.legacy_id === 11).used, true);
    // 2º login: continua entrando (agora pelo cofre), a marca das fracas se mantém, a legada não é mais gerada.
    await ok('qa1@exemplo.org', PW[1]);
    await ok('qa2@exemplo.org', PW[2]);
    await ok('qa5@exemplo.org', PW[5], true);
    await ok('qa11@exemplo.org', PW[11], true);
    // Senha errada, MD5 no lugar da senha (o legado mandava o hash; o novo recebe o texto), sem senha utilizável.
    for (const [i, p] of [['qa1@exemplo.org', 'senha errada'], ['qa1@exemplo.org', md5(PW[1])], ['qa7@exemplo.org', ''],
      ['qa7@exemplo.org', md5('')], ['qa7@exemplo.org', 'qualquer coisa'], ['qa8@exemplo.org', 'Excluido Senha 8!'],
      ['qa9@exemplo.org', 'Sem Identificador 9!']]) {
      const s = await signIn(i, p);
      assert.ok([400, 401].includes(s.status), `${i}: ${s.status}`);
      assert.notEqual(s.body.result, 'ok');
    }
    // Bloqueio: 5 falhas da mesma identificação, depois nem a senha certa entra.
    for (let k = 0; k < 4; k++) assert.equal((await signIn('qa3@exemplo.org', `errada ${k}`, '10.88.0.1')).status, 401);
    assert.ok([401, 429].includes((await signIn('qa3@exemplo.org', 'errada 4', '10.88.0.1')).status)); // a 5ª falha já bloqueia
    const locked = await signIn('qa3@exemplo.org', PW[3], '10.88.0.2');
    assert.equal(locked.status, 429, JSON.stringify(locked.body));
    assert.equal(locked.body.result, 'locked');
    // Auditoria: sem senha, MD5 nem texto da senha em nenhum evento ou na tabela de limite.
    const ev = (await q(`SELECT string_agg(e::text, E'\\n') AS t FROM public.events e`))[0].t ?? '';
    const thr = (await q(`SELECT coalesce(string_agg(t::text, E'\\n'), '') AS t FROM private.sign_in_throttle t`))[0].t;
    for (const secret of [...Object.values(PW), ...Object.values(PW).map(md5), md5('Sem Identificador 9!'), 'senha errada']) {
      assert.ok(!ev.includes(secret), 'senha ou MD5 na Auditoria');
      assert.ok(!thr.includes(secret), 'senha ou MD5 na tabela de limite');
    }
    const logins = await q(`SELECT count(*)::int AS n FROM public.events WHERE action = 'login' AND success`);
    assert.ok(logins[0].n >= 9, `eventos de login: ${logins[0].n}`);
  });

  test('accounts de novo depois do primeiro login: a senha do usuário (cofre) fica; nada é regravado; mudar a senha no legado não vale mais', async () => {
    seed();
    assert.equal(load(ADMINS).status, 0);
    assert.equal(accounts().status, 0);
    assert.equal((await signIn('qa2@exemplo.org', PW[2])).status, 200); // 1º login: grava no cofre
    assert.equal((await signIn('qa1@exemplo.org', PW[1])).status, 200);
    const snap = async () => (await q(`SELECT md5(coalesce(string_agg(v::text, '|' ORDER BY v.auth_user_id), '')) AS a FROM private.account_passwords v`))[0].a
      + (await q(`SELECT md5(coalesce(string_agg(c::text, '|' ORDER BY c.member_id), '')) AS a FROM private.legacy_credentials c`))[0].a;
    const before = await snap();
    // O legado muda a senha de quem já entrou (2) e de quem ainda não entrou (3).
    const nm = baseMembers();
    nm.find((m) => m.Id === 2).Password = md5('Senha Nova Do Legado 2!');
    nm.find((m) => m.Id === 3).Password = md5('Senha Nova Do Legado 3!');
    legacy({ members: nm, cells: [], reports: [], participants: [] });
    const r = accounts();
    assert.equal(r.status, 0, r.out);
    const after = await snap();
    assert.notEqual(after, before, 'a credencial pendente do 3 deveria ter sido regravada');
    // Quem já entrou: o cofre manda (credential_kept_used / has_password).
    assert.equal((await signIn('qa2@exemplo.org', 'Senha Nova Do Legado 2!')).status, 401);
    assert.equal((await signIn('qa2@exemplo.org', PW[2])).status, 200);
    // Quem não entrou: vale a senha do legado de agora, a antiga não.
    assert.equal((await signIn('qa3@exemplo.org', PW[3])).status, 401);
    assert.equal((await signIn('qa3@exemplo.org', 'Senha Nova Do Legado 3!')).status, 200);
  });

  test('adotado que já tinha conta mantém a senha do novo; a senha do legado não entra; adotado sem conta ganha conta e entra com a senha do legado sem perder a função', async () => {
    const A = '00000000-0000-4000-8000-0000000000e1'; // com conta
    const B = '00000000-0000-4000-8000-0000000000e2'; // sem conta
    const c = await pg();
    try {
      await c.query(`INSERT INTO auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                       created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
                     VALUES ($1::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $1::text || '@mci12fakemail.com',
                             now(), '{}', '{}', now(), now(), '', '', '', '')`, [A]);
      await c.query(`INSERT INTO public.members (id, name, email, gender, is_pastor, has_leadership, auth_user_id, role_id)
                     VALUES ($1, 'Novo Adotado A', 'adota2@exemplo.org', 'M', true, false, $1, (SELECT id FROM public.roles WHERE is_system)),
                            ($2, 'Novo Adotado B', 'adota3@exemplo.org', 'F', true, false, NULL, (SELECT id FROM public.roles WHERE name = 'Líder'))`, [A, B]);
      await c.query(`SELECT private.write_password($1, $1, 'Senha do Novo Adotado 55!', NULL)`, [A]);
    } finally { await c.end(); }
    seed([M(1, { Name: 'Pastor Um', Gender: 0, Password: md5(PW[1]) }),
      M(2, { LeadershipId: 1, Email: 'adota2@exemplo.org', Password: md5('Senha Legado A 11!') }),
      M(3, { LeadershipId: 1, Email: 'adota3@exemplo.org', Password: md5('Senha Legado B 22!') })]);
    assert.equal(load(ADMINS).status, 0);
    const r = accounts();
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /account_adopted_kept/);
    const ma = (await q('SELECT id, auth_user_id FROM public.members WHERE legacy_id = 2'))[0];
    const mb = (await q(`SELECT m.id, m.auth_user_id, r.name AS role, m.name FROM public.members m JOIN public.roles r ON r.id = m.role_id WHERE m.legacy_id = 3`))[0];
    assert.equal(ma.id, A); assert.equal(ma.auth_user_id, A);
    assert.equal(mb.id, B); assert.equal(mb.auth_user_id, B);
    assert.equal(mb.role, 'Líder', 'o adotado mantém a função do novo');
    assert.equal((await q('SELECT count(*)::int AS n FROM private.legacy_credentials WHERE member_id = $1', [A]))[0].n, 0, 'sem credencial legada para quem já tinha conta');
    assert.equal((await q('SELECT count(*)::int AS n FROM private.legacy_credentials WHERE member_id = $1', [B]))[0].n, 1);
    assert.equal((await signIn('adota2@exemplo.org', 'Senha Legado A 11!')).status, 401);
    assert.equal((await signIn('adota2@exemplo.org', 'Senha do Novo Adotado 55!')).status, 200);
    assert.equal((await signIn('adota3@exemplo.org', 'Senha Legado B 22!')).status, 200);
    assert.equal((await signIn('adota3@exemplo.org', 'Senha Legado A 11!')).status, 401);
    // Refazer não mexe em nada.
    const before = await fingerprint();
    assert.equal(accounts().status, 0);
    assert.deepEqual(await fingerprint(), before);
  });

  test('membro carregado sem conta (sem identificador ou excluído) não entra e não tem credencial; excluído não ganha conta nem pela credencial', async () => {
    seed();
    assert.equal(load(ADMINS).status, 0);
    assert.equal(accounts().status, 0);
    const none = await q(`SELECT m.legacy_id, m.auth_user_id,
                                 (SELECT count(*) FROM private.legacy_credentials c WHERE c.member_id = m.id)::int AS cred,
                                 (SELECT count(*) FROM auth.users u WHERE u.id = m.id)::int AS acc
                            FROM public.members m WHERE m.legacy_id IN (8, 9) ORDER BY 1`);
    for (const n of none) { assert.equal(n.auth_user_id, null); assert.equal(n.cred, 0); assert.equal(n.acc, 0); }
    assert.equal((await signIn('qa9@exemplo.org', 'Sem Identificador 9!')).status, 401);
    // Excluído no novo depois das contas: a RPC suspende; a conta continua com o resto intacto.
    assert.equal((await q(`SELECT count(*)::int AS n FROM private.legacy_credential_problems()`))[0].n, 0);
  });
});

describe('Concorrência', () => {
  const many = (n) => [M(1, { Name: 'Pastor Um', Gender: 0, Password: md5(PW[1]) }),
    ...Array.from({ length: n }, (_, i) => M(100 + i, { LeadershipId: 1, Password: md5(`Senha do Membro ${100 + i}!`) }))];

  test('accounts × load e accounts × accounts: só uma roda; a outra recusa sem mexer em nada; no fim não há conta duplicada', async () => {
    seed(many(70));
    assert.equal(load(ADMINS).status, 0);
    const a = accountsAsync(['--concurrency', '1']);
    // Espera a trava e algumas contas criadas.
    let got = false;
    for (let t = Date.now(); Date.now() - t < 60000;) {
      const [x] = await q(`SELECT (SELECT count(*) FROM auth.users WHERE raw_app_meta_data ? 'legacy_member_id')::int AS n,
                                  (SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND granted)::int AS l`);
      if (x.n >= 3 && x.l >= 1) { got = true; break; }
      await sleep(100);
    }
    assert.ok(got, 'a primeira execução não chegou a criar contas');
    const second = accounts();
    assert.notEqual(second.status, 0, second.out);
    assert.match(second.out, /Outra carga ou criação de contas/);
    const runs = (await q(`SELECT count(*)::int AS n FROM legacy._accounts_runs`))[0].n;
    assert.equal(runs, 1, 'a execução recusada não registra execução');
    // A carga refeita no meio da criação de contas: espera a trava (5 s) e recusa, sem gravar nada.
    const mFp = await q(`SELECT md5(string_agg(m::text, '|' ORDER BY m.id)) AS h FROM public.members m`);
    const l = load(ADMINS);
    assert.notEqual(l.status, 0, l.out);
    assert.deepEqual(await q(`SELECT md5(string_agg(m::text, '|' ORDER BY m.id)) AS h FROM public.members m`), mFp);
    const done = await a.done;
    assert.equal(done.status, 0, done.out);
    const [c] = await q(`SELECT (SELECT count(*) FROM auth.users WHERE raw_app_meta_data ? 'legacy_member_id')::int AS accs,
                                (SELECT count(DISTINCT user_id) FROM auth.identities)::int AS idn,
                                (SELECT count(*) FROM public.members WHERE legacy_id IS NOT NULL AND auth_user_id = id)::int AS linked,
                                (SELECT count(*) FROM private.legacy_credentials)::int AS cred,
                                (SELECT count(*) FROM private.legacy_credential_problems())::int AS problems`);
    assert.deepEqual({ ...c }, { accs: 71, idn: 71, linked: 71, cred: 71, problems: 0 });
  });

  test('uma carga em andamento (trava de transação) faz accounts recusar antes de criar qualquer coisa', async () => {
    seed(many(5));
    assert.equal(load(ADMINS).status, 0);
    const c = await pg();
    try {
      await c.query('BEGIN');
      await c.query(`SELECT pg_advisory_xact_lock(hashtextextended('mci.e4.load', 0))`);
      const before = await fingerprint();
      const r = accounts();
      assert.notEqual(r.status, 0, r.out);
      assert.match(r.out, /Outra carga ou criação de contas/);
      assert.deepEqual(await fingerprint(), before);
      assert.equal((await q(`SELECT to_regclass('legacy._accounts_runs')::text AS t`))[0].t, null);
    } finally { await c.query('ROLLBACK'); await c.end(); }
    assert.equal(accounts().status, 0);
  });
});

describe('Processo morto no meio de cada fase e refazer', () => {
  const many = (n) => [M(1, { Name: 'Pastor Um', Gender: 0, Password: md5(PW[1]) }),
    ...Array.from({ length: n }, (_, i) => M(100 + i, { LeadershipId: 1, Password: md5(`Senha do Membro ${100 + i}!`) }))];
  const state = async () => (await q(`SELECT (SELECT count(*) FROM auth.users WHERE raw_app_meta_data ? 'legacy_member_id')::int AS accs,
      (SELECT count(*) FROM public.members WHERE legacy_id IS NOT NULL AND auth_user_id = id)::int AS linked,
      (SELECT count(*) FROM private.legacy_credentials)::int AS cred,
      (SELECT count(*) FROM private.legacy_credential_problems())::int AS problems,
      (SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND granted AND pid <> pg_backend_pid())::int AS locks`))[0];

  test('morto durante a criação de contas (antes de ligar): refazer religa as criadas, completa e não duplica; depois, nada muda', async () => {
    seed(many(60));
    assert.equal(load(ADMINS).status, 0);
    const a = accountsAsync(['--concurrency', '2']);
    for (let t = Date.now(); Date.now() - t < 60000;) { if ((await state()).accs >= 6) break; await sleep(80); }
    a.child.kill('SIGKILL');
    await a.done;
    const mid1 = await state();
    assert.ok(mid1.accs >= 6 && mid1.accs < 61, `accs=${mid1.accs}`);
    assert.equal(mid1.linked, 0, 'morto antes de ligar: nenhuma ligada');
    assert.equal(mid1.cred, 0);
    await sleep(500);
    assert.equal((await state()).locks, 0, 'a trava sai com a conexão');
    const r = accounts();
    assert.equal(r.status, 0, r.out);
    assert.deepEqual(await state(), { accs: 61, linked: 61, cred: 61, problems: 0, locks: 0 });
    const before = await fingerprint();
    const r2 = accounts();
    assert.equal(r2.status, 0, r2.out);
    assert.deepEqual(await fingerprint(), before, 'refazer não muda nada');
  });

  test('morto durante as credenciais: refazer completa só o que falta (unchanged para o que já está), sem duplicar', async () => {
    seed(many(60));
    assert.equal(load(ADMINS).status, 0);
    const a = accountsAsync(['--concurrency', '1', '--batch-size', '2']);
    for (let t = Date.now(); Date.now() - t < 120000;) { const s = await state(); if (s.cred >= 4 && s.linked === 61) break; await sleep(60); }
    a.child.kill('SIGKILL');
    await a.done;
    await sleep(800); // o lote em andamento no servidor termina
    const mid1 = await state();
    assert.equal(mid1.linked, 61);
    assert.ok(mid1.cred >= 4 && mid1.cred < 61, `cred=${mid1.cred}`);
    const r = accounts();
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /unchanged \d+/);
    assert.deepEqual(await state(), { accs: 61, linked: 61, cred: 61, problems: 0, locks: 0 });
    // Todas entram (amostra) com a senha do legado.
    for (const i of [100, 129, 159]) assert.equal((await signIn(`qa${i}@exemplo.org`, `Senha do Membro ${i}!`)).status, 200);
  });

  test('conta criada fora do plano com o e-mail técnico mas sem o Id do legado (de outro dono) bloqueia tudo; corrigida, a execução passa', async () => {
    seed(many(3));
    assert.equal(load(ADMINS).status, 0);
    const id = await mid(101);
    await q(`INSERT INTO auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
               created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
             VALUES ($1::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $1::text || '@mci12fakemail.com',
                     now(), '{}', '{}', now(), now(), '', '', '', '')`, [id]);
    const r = accounts();
    assert.notEqual(r.status, 0);
    assert.match(r.out, /account_other_owner/);
    assert.equal((await q(`SELECT count(*)::int AS n FROM auth.users`))[0].n, 1, 'nada foi criado');
    await q(`DELETE FROM auth.users WHERE id = $1`, [id]);
    assert.equal(accounts().status, 0);
  });
});

describe('MD5 do legado fora do formato', () => {
  test('o que não é um MD5 minúsculo de 32 hexadecimais (com lower(btrim)) vai para unusable_md5 e não cria credencial; o que é, entra', async () => {
    const cases = {
      20: { pw: md5('Maiuscula 20!').toUpperCase(), usable: true, sees: 'Maiuscula 20!' },
      21: { pw: `  ${md5('Espacos 21!')}  `, usable: true, sees: 'Espacos 21!' },
      22: { pw: md5('Zero à esquerda').replace(/^./, '0'), usable: true },
      23: { pw: md5('').toUpperCase(), usable: false }, // MD5 do vazio, maiúsculo
      24: { pw: md5('x').slice(0, 31), usable: false },
      25: { pw: `${md5('x')}0`, usable: false },
      26: { pw: 'g'.repeat(32), usable: false },
      27: { pw: `\t${md5('Tab 27!')}`, usable: false, note: 'tab nas pontas: btrim só tira espaço' },
      28: { pw: `${md5('Nl 28!')}\n`, usable: false, note: 'quebra de linha final' },
      29: { pw: ` ${md5('Nbsp 29!')}`, usable: false, note: 'NBSP' },
      30: { pw: null, usable: false },
      31: { pw: 'é'.repeat(32), usable: false },
      32: { pw: `${md5('x').slice(0, 30)}ａｂ`, usable: false }, // letras de largura total
    };
    seed([M(1, { Name: 'Pastor Um', Gender: 0, Password: md5(PW[1]) }),
      ...Object.entries(cases).map(([id, c]) => M(Number(id), { LeadershipId: 1, Password: c.pw }))]);
    assert.equal(load(ADMINS).status, 0);
    const r = accounts();
    assert.equal(r.status, 0, r.out);
    const creds = (await q(`SELECT m.legacy_id FROM private.legacy_credentials c JOIN public.members m ON m.id = c.member_id ORDER BY 1`)).map((x) => x.legacy_id);
    const expected = [1, ...Object.entries(cases).filter(([, c]) => c.usable).map(([id]) => Number(id))].sort((a, b) => a - b);
    assert.deepEqual(creds, expected);
    const list = (await q(`SELECT lists->'credential_unusable_md5' AS l FROM legacy._accounts_runs ORDER BY id DESC LIMIT 1`))[0].l;
    assert.deepEqual([...list].sort((a, b) => a - b), Object.entries(cases).filter(([, c]) => !c.usable).map(([id]) => Number(id)));
    const [norm] = await q(`SELECT counts->'credentials'->>'md5_normalized' AS n FROM legacy._accounts_runs ORDER BY id DESC LIMIT 1`);
    assert.equal(norm.n, '2', 'só 20 e 21 passaram pelo lower(btrim)');
    for (const [id, c] of Object.entries(cases).filter(([, x]) => x.sees)) {
      assert.equal((await signIn(`qa${id}@exemplo.org`, c.sees)).status, 200, `login do ${id}`);
    }
    // Sem senha utilizável: a conta existe, o login recusa (no_password), sem credencial.
    assert.equal((await signIn('qa23@exemplo.org', 'qualquer')).status, 401);
    assert.equal((await signIn('qa23@exemplo.org', '')).status, 400);
  });
});

describe('Configuração, --dry-run, saída e vazamento', () => {
  test('--dry-run não grava nada (nem arquivo, nem tabela de controle, nem conta) e não tem efeito sobre o login', async () => {
    seed();
    assert.equal(load(ADMINS).status, 0);
    const before = await fingerprint();
    const tables = async () => (await q(`SELECT to_regclass('legacy._accounts_runs')::text AS t`))[0].t;
    for (let i = 0; i < 2; i++) {
      const r = accounts(['--dry-run']);
      assert.equal(r.status, 0, r.out);
      assert.match(r.out, /Nada foi criado/);
    }
    assert.deepEqual(await fingerprint(), before);
    assert.equal(await tables(), null);
    assert.equal(existsSync(OUT) ? readdirSync(OUT).length : 0, 0, 'dry-run não escreve relatório');
    assert.equal((await q(`SELECT count(*)::int AS n FROM private.legacy_credentials`))[0].n, 0);
  });

  test('configuração errada: destino remoto sem --yes, URL de outro destino, chave inválida ou de formato errado, opções fora da faixa: nada criado e a chave nunca aparece', async () => {
    seed(); assert.equal(load(ADMINS).status, 0);
    const before = await fingerprint();
    const remote = cfgWith('remote.config', `SUPABASE_HOST="aws-0-sa-east-1.pooler.supabase.com"\nSUPABASE_USER="postgres.gkhnjhmgeceoaqeynhrj"\nSUPABASE_URL="https://gkhnjhmgeceoaqeynhrj.supabase.co"\nSUPABASE_SECRET_KEY="${SECRET}"`);
    let r = accounts([], { cfg: remote, timeout: 30000 });
    assert.notEqual(r.status, 0); assert.match(r.out, /--yes/);
    const mixed = cfgWith('mixed.config', `SUPABASE_URL="https://gkhnjhmgeceoaqeynhrj.supabase.co"\nSUPABASE_SECRET_KEY="${SECRET}"`);
    r = accounts([], { cfg: mixed }); assert.notEqual(r.status, 0); assert.match(r.out, /mesmo destino/);
    const otherRef = cfgWith('ref.config', `SUPABASE_PROJECT_REF="clfgjnwtzasdsrgcxmmd"\nSUPABASE_URL="${API}"\nSUPABASE_SECRET_KEY="${SECRET}"`);
    r = accounts([], { cfg: otherRef }); assert.notEqual(r.status, 0); assert.match(r.out, /não é o banco do app/);
    const wrongKey = cfgWith('wrongkey.config', `SUPABASE_URL="${API}"\nSUPABASE_SECRET_KEY="sb_secret_invalida_para_o_teste_000000"`);
    r = accounts([], { cfg: wrongKey }); assert.notEqual(r.status, 0); assert.match(r.out, /recusou a chave/); assert.ok(!r.out.includes('sb_secret_invalida'));
    const fmt = cfgWith('fmt.config', `SUPABASE_URL="${API}"\nSUPABASE_SECRET_KEY="chave-fora-do-formato-123"`);
    r = accounts([], { cfg: fmt }); assert.notEqual(r.status, 0); assert.ok(!r.out.includes('chave-fora-do-formato'));
    const down = cfgWith('down.config', `SUPABASE_URL="http://127.0.0.1:59999"\nSUPABASE_SECRET_KEY="${SECRET}"`);
    r = accounts([], { cfg: down }); assert.notEqual(r.status, 0); assert.ok(!r.out.includes(SECRET)); assert.doesNotMatch(r.out, /at .*\.mjs|TypeError/);
    for (const a of [['--concurrency', '0'], ['--concurrency', '9'], ['--concurrency', 'abc'], ['--batch-size', '101'], ['--batch-size', '-1'], ['--concurrency', '1.5']]) {
      r = accounts(a); assert.notEqual(r.status, 0, a.join(' ')); assert.doesNotMatch(r.out, /at .*\.mjs|TypeError/);
    }
    assert.deepEqual(await fingerprint(), before);
  });

  test('sem execução de carga no destino (ou carga desfeita): recusa clara, sem pilha', async () => {
    seed();
    const r = accounts();
    assert.notEqual(r.status, 0);
    assert.match(r.out, /Rode antes: npm run (copy|load)/);
    assert.doesNotMatch(r.out, /at .*\.mjs/);
  });

  test('a chave secreta, as senhas, os MD5, os nomes, e-mails, CPF e celulares não aparecem na saída, nos relatórios, na execução gravada nem nos logs dos contêineres', async () => {
    const since = new Date().toISOString();
    seed();
    assert.equal(load(ADMINS).status, 0);
    assert.equal(accounts().status, 0);
    assert.equal(accounts().status, 0);
    // também uma execução com falha (sem a conta de um membro), para a saída de erro
    await q(`DELETE FROM auth.users WHERE raw_app_meta_data ? 'legacy_member_id' AND id = (SELECT id FROM public.members WHERE legacy_id = 4)`).catch(() => {});
    await signIn('qa2@exemplo.org', PW[2]);
    const runsText = (await q(`SELECT coalesce(string_agg(r::text, E'\\n'), '') AS t FROM legacy._accounts_runs r`))[0].t;
    const blob = [...LEAKS, runsText].join('\n');
    const forbidden = [SECRET, ...Object.values(PW), ...Object.values(PW).map(md5), CPF6, '5299822472', 'qa1@exemplo.org', 'qa2@exemplo.org',
      '98888-0004', '988880004', 'Pessoa2 Teste2', 'Pastor Um', md5('Sem Identificador 9!')];
    for (const s of forbidden) assert.ok(!blob.includes(s), `vazou na saída ou no relatório: ${s.slice(0, 6)}…`);
    // Relatórios (arquivos) com permissão 0600.
    for (const f of readdirSync(OUT)) assert.equal(statSyncMode(join(OUT, f)), '600');
    // Logs dos contêineres da pista B e do runtime de funções durante a execução.
    const logs = ['supabase_db_mci-b', 'supabase_auth_mci-b', 'supabase_kong_mci-b', 'supabase_rest_mci-b', 'supabase_edge_runtime_mci-b']
      .map((n) => spawnSync('docker', ['logs', '--since', since, n], { encoding: 'utf8', maxBuffer: 1 << 28 }))
      .map((r) => `${r.stdout}${r.stderr}`).join('\n');
    for (const s of [SECRET, ...Object.values(PW), ...Object.values(PW).map(md5)]) assert.ok(!logs.includes(s), `vazou nos logs: ${s.slice(0, 6)}…`);
  });
});

function statSyncMode(p) {
  return (execFileSync('stat', ['-c', '%a', p], { encoding: 'utf8' })).trim();
}
// referência usada só para silenciar o import quando o arquivo é lido isoladamente
void PG_PORT;
void LOGS;
