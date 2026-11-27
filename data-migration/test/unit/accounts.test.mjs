// Testes unitários de `npm run accounts` (sem banco nem Auth): catálogo, configuração da Admin
// API, criação idempotente da conta (com um Auth falso) e os arquivos SQL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ACCOUNT_CODES, ACCOUNT_CATEGORIES, accountCodeInfo, blockingAccountIssues, CREDENTIAL_RESULTS, chunk, parseIntOption,
} from '../../src/lib/account-codes.mjs';
import { AuthAdminError, authErrorCode, createAuthAdmin, ensureAccount, runPool } from '../../src/lib/auth-admin.mjs';
import { authAdminOptions, ConfigError } from '../../src/lib/config.mjs';
import { SQL_DIR, PLAN_FILE, LINK_FILE, CREDENTIALS_FILE, VALIDATE_FILE } from '../../src/accounts.mjs';

const sqlFiles = readdirSync(SQL_DIR).filter((f) => f.endsWith('.sql')).sort();
const sql = Object.fromEntries(sqlFiles.map((f) => [f, readFileSync(resolve(SQL_DIR, f), 'utf8')]));
const noComments = (text) => text.replace(/--[^\n]*/g, '');
const runner = readFileSync(resolve(SQL_DIR, '..', '..', 'src', 'accounts.mjs'), 'utf8');

test('todo arquivo de sql/accounts é usado pelo runner', () => {
  assert.deepEqual([PLAN_FILE, LINK_FILE, CREDENTIALS_FILE, VALIDATE_FILE].sort(), sqlFiles);
});

test('catálogo: todo código usado no SQL e no runner existe, e todo código do catálogo é usado', () => {
  const used = new Set();
  const all = `${Object.values(sql).join('\n')}\n${runner}`;
  for (const m of all.matchAll(/'((?:account|member|legacy|credential|validate)_[a-z0-9_]+)'/g)) used.add(m[1]);
  // Os de credencial vêm do resultado da add_legacy_credential ('credential_' + resultado) no runner.
  for (const r of CREDENTIAL_RESULTS) used.add(`credential_${r}`);
  for (const m of runner.matchAll(/extra\.((?:account|credential)_[a-z0-9_]+)/g)) used.add(m[1]);
  // Nomes do banco que não são ocorrências.
  for (const notCode of ['legacy_credential_problems', 'legacy_member_id', 'member_account_email',
    'member_has_login_identifier', 'legacy_credentials', 'account_passwords']) used.delete(notCode);
  const catalog = new Set(Object.keys(ACCOUNT_CODES));
  assert.deepEqual([...used].filter((c) => !catalog.has(c)).sort(), [], 'código usado sem catálogo');
  assert.deepEqual([...catalog].filter((c) => !used.has(c)).sort(), [], 'código do catálogo sem uso');
});

test('catálogo: categorias válidas; bloqueio só para block e código desconhecido', () => {
  const cats = new Set(ACCOUNT_CATEGORIES.map(([c]) => c));
  for (const [code, [cat, title]] of Object.entries(ACCOUNT_CODES)) {
    assert.ok(cats.has(cat), `${code}: categoria ${cat}`);
    assert.ok(title.length > 10, `${code}: título`);
  }
  assert.equal(accountCodeInfo('nao_existe'), null);
  const issues = [{ code: 'account_other_owner' }, { code: 'member_without_identifier' }, { code: 'account_create_failed' },
    { code: 'codigo_novo' }];
  assert.deepEqual(blockingAccountIssues(issues).map((i) => i.code), ['account_other_owner', 'codigo_novo']);
  for (const c of ['account_other_owner', 'account_legacy_id_taken', 'account_link_unexpected']) {
    assert.equal(accountCodeInfo(c).category, 'block', c);
  }
});

test('lotes e opções inteiras', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 50), []);
  assert.throws(() => chunk([1], 0));
  assert.equal(parseIntOption(undefined, '--x', { min: 1, max: 8, fallback: 4 }), 4);
  assert.equal(parseIntOption('8', '--x', { min: 1, max: 8, fallback: 4 }), 8);
  for (const bad of ['0', '9', '-1', '2.5', 'a', '']) {
    assert.throws(() => parseIntOption(bad, '--x', { min: 1, max: 8, fallback: 4 }), /--x precisa ser um inteiro de 1 a 8/);
  }
});

const cfg = (o) => new Map(Object.entries({ SUPABASE_PROJECT_REF: 'gkhnjhmgeceoaqeynhrj', ...o }));
const LOCAL = { local: true };
const REMOTE = { local: false };

test('Admin API: destino coerente com o banco e a chave secreta', () => {
  const remote = authAdminOptions(cfg({ SUPABASE_SECRET_KEY: 'sb_secret_x' }), REMOTE);
  assert.deepEqual([remote.baseUrl, remote.describe.local], ['https://gkhnjhmgeceoaqeynhrj.supabase.co', false]);
  assert.equal(authAdminOptions(cfg({ SUPABASE_URL: 'http://127.0.0.1:58321', SUPABASE_SERVICE_ROLE_KEY: 'eyJabc' }), LOCAL).baseUrl,
    'http://127.0.0.1:58321');
  const err = (values, db, re) => assert.throws(() => authAdminOptions(cfg(values), db), (e) => e instanceof ConfigError && re.test(e.message));
  err({ SUPABASE_SECRET_KEY: 'sb_secret_x' }, LOCAL, /falta SUPABASE_URL/);
  err({ SUPABASE_URL: 'http://127.0.0.1:58321', SUPABASE_SECRET_KEY: 'sb_secret_x' }, REMOTE, /mesmo destino/);
  err({ SUPABASE_URL: 'https://gkhnjhmgeceoaqeynhrj.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_x' }, LOCAL, /mesmo destino/);
  err({ SUPABASE_URL: 'https://outro.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_x' }, REMOTE, /precisa ser https:\/\/gkhn/);
  err({}, REMOTE, /Falta a chave secreta/);
  err({ SUPABASE_SECRET_KEY: 'sb_publishable_x' }, REMOTE, /não parece ser a secreta/);
  err({ SUPABASE_PROJECT_REF: 'outro', SUPABASE_SECRET_KEY: 'sb_secret_x' }, REMOTE, /não é o banco do app/);
  err({ SUPABASE_URL: 'não é url', SUPABASE_SECRET_KEY: 'sb_secret_x' }, REMOTE, /não é um endereço válido/);
});

test('Admin API: o erro sai só com o status e o código, nunca com o corpo nem a chave', async () => {
  assert.equal(authErrorCode({ error_code: 'email_exists', msg: 'A user with x@y.z' }), 'email_exists');
  assert.equal(authErrorCode({ code: '23505', message: 'Key (id)=(…)' }), '23505');
  assert.equal(authErrorCode({ error_code: 'a b<c>@d.e' }), 'abcd.e');
  assert.equal(authErrorCode(null), null);
  const calls = [];
  const fake = async (url, init) => {
    calls.push({ url, init });
    return { ok: false, status: 422, json: async () => ({ error_code: 'email_exists', msg: 'A user with id@x has already' }) };
  };
  const admin = createAuthAdmin({ baseUrl: 'http://h', key: 'sb_secret_K' }, { fetchImpl: fake });
  await assert.rejects(admin.createAccount({ id: 'i', email: 'i@x', legacyId: 7 }), (e) => e instanceof AuthAdminError
    && e.message === 'Auth respondeu 422 (email_exists)' && !e.message.includes('sb_secret_K') && !e.message.includes('@'));
  assert.equal(calls[0].url, 'http://h/auth/v1/admin/users');
  assert.deepEqual(JSON.parse(calls[0].init.body), { id: 'i', email: 'i@x', email_confirm: true, app_metadata: { legacy_member_id: 7 } });
  assert.equal(calls[0].init.headers.apikey, 'sb_secret_K');
  assert.ok(!('password' in JSON.parse(calls[0].init.body)), 'sem senha (RN-08 do E2.03)');
  // ping: 404 numa conta inexistente = chave aceita; 401/403 = recusada.
  const ping = (status) => createAuthAdmin({ baseUrl: 'http://h', key: 'k' }, {
    fetchImpl: async () => ({ ok: false, status, json: async () => ({ error_code: 'x' }) }) }).ping();
  await ping(404);
  await assert.rejects(ping(403), /403/);
});

/** Auth falso em memória para a ensureAccount. */
function fakeAdmin({ createErrors = [], existing = new Map(), returnId } = {}) {
  const log = [];
  return {
    log,
    existing,
    async createAccount({ id, email, legacyId }) {
      log.push(['create', id]);
      const e = createErrors.shift();
      if (e === 'create-then-timeout') { existing.set(id, { id, email, legacyId }); throw new AuthAdminError(0, 'timeout'); }
      if (e) throw new AuthAdminError(e, null);
      if (existing.has(id)) throw new AuthAdminError(500, '23505');
      const acc = { id: returnId ?? id, email, legacyId };
      existing.set(acc.id, acc);
      return acc;
    },
    async getAccount(id) { log.push(['get', id]); return existing.get(id) ?? null; },
    async deleteAccount(id) { log.push(['delete', id]); existing.delete(id); },
  };
}
const ACC = { id: 'u-1', email: 'U-1@mci12fakemail.com', legacyId: 7 };
const noSleep = async () => {};

test('ensureAccount: cria; já existe e é do membro: religa; de outro dono: falha', async () => {
  assert.deepEqual(await ensureAccount(fakeAdmin(), ACC, { sleep: noSleep }), { outcome: 'created' });
  const mine = fakeAdmin({ existing: new Map([['u-1', { id: 'u-1', email: 'u-1@mci12fakemail.com', legacyId: 7 }]]) });
  assert.deepEqual(await ensureAccount(mine, ACC, { sleep: noSleep }), { outcome: 'relinked' }, 'e-mail sem diferenciar maiúsculas');
  const other = fakeAdmin({ existing: new Map([['u-1', { id: 'u-1', email: 'u-1@mci12fakemail.com', legacyId: null }]]) });
  assert.deepEqual(await ensureAccount(other, ACC, { sleep: noSleep }), { outcome: 'failed', info: 'other_owner' });
  const otherLegacy = fakeAdmin({ existing: new Map([['u-1', { id: 'u-1', email: 'u-1@mci12fakemail.com', legacyId: 8 }]]) });
  assert.equal((await ensureAccount(otherLegacy, ACC, { sleep: noSleep })).info, 'other_owner');
});

test('ensureAccount: falha passageira é repetida; a conta criada antes do tempo-limite é reconhecida', async () => {
  const flaky = fakeAdmin({ createErrors: [503, 429] });
  assert.deepEqual(await ensureAccount(flaky, ACC, { sleep: noSleep }), { outcome: 'created' });
  assert.equal(flaky.log.filter(([k]) => k === 'create').length, 3);
  const late = fakeAdmin({ createErrors: ['create-then-timeout'] });
  assert.deepEqual(await ensureAccount(late, ACC, { sleep: noSleep }), { outcome: 'relinked' });
  const down = fakeAdmin({ createErrors: [500, 500, 500] });
  assert.deepEqual(await ensureAccount(down, ACC, { sleep: noSleep }), { outcome: 'failed', info: 'http_500' });
  const rejected = fakeAdmin({ createErrors: [422] });
  assert.deepEqual(await ensureAccount(rejected, ACC, { sleep: noSleep }), { outcome: 'failed', info: 'http_422' },
    '4xx não é repetido');
  assert.equal(rejected.log.filter(([k]) => k === 'create').length, 1);
});

test('ensureAccount: o Auth não aceitou o id: a conta criada é apagada e a execução falha', async () => {
  const a = fakeAdmin({ returnId: 'outro-id' });
  assert.deepEqual(await ensureAccount(a, ACC, { sleep: noSleep }), { outcome: 'failed', info: 'id_not_accepted' });
  assert.deepEqual(a.log.at(-1), ['delete', 'outro-id']);
  assert.equal(a.existing.size, 0);
});

test('runPool: no máximo `limit` ao mesmo tempo, todos os itens', async () => {
  let running = 0; let peak = 0; const seen = [];
  await runPool([1, 2, 3, 4, 5, 6, 7], 3, async (x) => {
    running++; peak = Math.max(peak, running);
    await new Promise((r) => { setTimeout(r, 5); });
    seen.push(x); running--;
  });
  assert.equal(peak, 3);
  assert.deepEqual(seen.sort(), [1, 2, 3, 4, 5, 6, 7]);
});

test('SQL: o MD5 nunca é parâmetro; o lower(btrim()) vem antes da add_legacy_credential', () => {
  const cred = noComments(sql[CREDENTIALS_FILE]);
  assert.match(cred, /lower\(btrim\(l\."Password"\)\)/);
  assert.match(cred, /private\.add_legacy_credential\(m\.id, n\.md5\)/);
  assert.deepEqual([...cred.matchAll(/\$\d+(::[a-z\[\]]+)?/g)].map((m) => m[0]), ['$1::uuid[]'], 'só os ids como parâmetro');
  assert.deepEqual([...noComments(sql[LINK_FILE]).matchAll(/\$\d+(::[a-z\[\]]+)?/g)].map((m) => m[0]), ['$1::uuid[]']);
  assert.doesNotMatch(noComments(sql[PLAN_FILE]), /\$\d/, 'o plano não tem parâmetro');
  assert.match(sql[LINK_FILE], /SET\s+auth_user_id = m\.id/);
  assert.match(sql[VALIDATE_FILE], /private\.legacy_credential_problems\(\)/);
  // O resultado do lote não devolve o MD5 nem o hash.
  assert.doesNotMatch(cred.split(/\n\s*FROM public\.members/)[0], /AS md5\b|legacy_hash AS|"Password" AS/);
});
