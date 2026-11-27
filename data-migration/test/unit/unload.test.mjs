// Testes unitários da limpeza do ensaio (npm run unload, DT-13; sem banco): catálogo, arquivos
// SQL, número de confirmação e a exclusão idempotente de contas no Auth.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { SQL_DIR, PLAN_FILE, WRITE_FILES, VALIDATE_FILE } from '../../src/unload.mjs';
import {
  UNLOAD_CODES, UNLOAD_CATEGORIES, blockingUnloadIssues, plannedTotal, confirmationCode, idsDigest, parseConfirm, unloadCodeInfo,
} from '../../src/lib/unload-codes.mjs';
import { AuthAdminError, ensureAccountDeleted } from '../../src/lib/auth-admin.mjs';

const sqlFiles = readdirSync(SQL_DIR).filter((f) => f.endsWith('.sql')).sort();
const noComments = (text) => text.replace(/--[^\n]*/g, '');
const planSql = noComments(readFileSync(resolve(SQL_DIR, PLAN_FILE), 'utf8'));
const runnerSrc = readFileSync(resolve(SQL_DIR, '..', '..', 'src', 'unload.mjs'), 'utf8');

test('todo arquivo de sql/unload é rodado, na ordem do nome', () => {
  assert.deepEqual([PLAN_FILE, ...WRITE_FILES, VALIDATE_FILE], sqlFiles);
});

test('catálogo: todo código do plano e do runner existe, e todo código do catálogo é usado', () => {
  const used = new Set();
  for (const m of planSql.matchAll(/INSERT INTO ul_issues[\s\S]*?(?=;)/g)) {
    for (const c of m[0].matchAll(/SELECT (?:DISTINCT )?'([a-z_]+)'/g)) used.add(c[1]);
  }
  for (const c of runnerSrc.matchAll(/\b(account_[a-z_]+): \[\]/g)) used.add(c[1]);
  const catalog = new Set(Object.keys(UNLOAD_CODES));
  assert.deepEqual([...used].filter((c) => !catalog.has(c)).sort(), [], 'código usado sem catálogo');
  assert.deepEqual([...catalog].filter((c) => !used.has(c)).sort(), [], 'código do catálogo sem uso');
});

test('catálogo: categorias válidas; bloqueio só para block e código desconhecido', () => {
  const cats = new Set(UNLOAD_CATEGORIES.map(([c]) => c));
  for (const [code, [cat, title]] of Object.entries(UNLOAD_CODES)) {
    assert.ok(cats.has(cat), `${code}: categoria ${cat}`);
    assert.ok(title.length > 10, `${code}: título`);
  }
  assert.equal(unloadCodeInfo('nao_existe'), null);
  const issues = [{ code: 'member_points_to_removed' }, { code: 'spouse_unlinked' }, { code: 'account_delete_failed' },
    { code: 'codigo_novo' }];
  assert.deepEqual(blockingUnloadIssues(issues).map((i) => i.code), ['member_points_to_removed', 'codigo_novo']);
});

test('o plano só escreve em pg_temp; a gravação não usa DELETE sem a lista do plano', () => {
  for (const m of planSql.matchAll(/\b(INSERT INTO|UPDATE|DELETE FROM)\s+([a-z_.]+)/gi)) {
    assert.match(m[2], /^ul_/, `o plano grava só nas tabelas temporárias (achou ${m[1]} ${m[2]})`);
  }
  const write = noComments(readFileSync(resolve(SQL_DIR, WRITE_FILES[0]), 'utf8'));
  for (const m of write.matchAll(/DELETE FROM ([a-z_.]+)[^;]*/gi)) {
    if (m[1] === 'legacy._load_adopted') continue; // os adotados já voltaram: a tabela fica vazia
    assert.match(m[0], /ul_(members|cells|reports|accounts|adopted)/, `DELETE em ${m[1]} limitado ao plano`);
  }
});

test('nada de dado pessoal nas ocorrências do plano: só legacy_id, id do registro e textos fixos', () => {
  assert.doesNotMatch(planSql, /INSERT INTO ul_issues[^;]*\b(name|email|cpf|mobile_whatsapp|phone)\b/);
});

test('código de confirmação e --confirm', () => {
  assert.equal(plannedTotal({ members: 3, cells: 1, reports: 2, participants: 5, adopted: 1, accounts: 2, t0: 'x' }), 14);
  assert.equal(plannedTotal({}), 0);
  const u = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  // o mesmo md5 que o SQL do plano calcula: ids em ordem crescente, separados por vírgula
  assert.equal(idsDigest([]), 'd41d8cd98f00b204e9800998ecf8427e');
  assert.equal(idsDigest([u(2), u(1)]), idsDigest([u(1), u(2)]));
  const base = { members: idsDigest([u(1), u(2)]), accounts: idsDigest([u(1)]) };
  const code = confirmationCode(base);
  assert.match(code, /^[0-9A-F]{4}-[0-9A-F]{4}$/);
  assert.equal(confirmationCode({ ...base }), code, 'estável');
  assert.notEqual(confirmationCode({ ...base, members: idsDigest([u(1), u(3)]) }), code, 'mesma quantidade, outro cadastro');
  assert.notEqual(confirmationCode({ ...base, accounts: idsDigest([u(1), u(9)]) }), code, 'uma conta pendente a mais');
  assert.notEqual(confirmationCode({ cells: base.members, accounts: base.accounts }), code, 'a parte conta');
  assert.equal(confirmationCode({}), confirmationCode({ members: idsDigest([]) }), 'parte vazia = lista vazia');
  assert.equal(parseConfirm(undefined), null);
  assert.equal(parseConfirm(code), code);
  assert.equal(parseConfirm(code.toLowerCase().replace('-', '')), code);
  for (const bad of ['', '1', '-1', '123', 'ABCD-EFGH', 'ABCD-1234-5', 'ABC-1234']) assert.throws(() => parseConfirm(bad));
});

const fakeAdmin = (script) => {
  const calls = [];
  return {
    calls,
    async deleteAccount(id) { calls.push(['delete', id]); const r = script.delete.shift(); if (r) throw r; },
    async getAccount(id) { calls.push(['get', id]); const r = script.get.shift(); if (r instanceof Error) throw r; return r; },
  };
};
const noSleep = async () => {};

test('exclusão de conta: apagada, já não existia, falha passageira repetida, falha definitiva', async () => {
  let a = fakeAdmin({ delete: [null], get: [] });
  assert.deepEqual(await ensureAccountDeleted(a, 'u1', { sleep: noSleep }), { outcome: 'deleted' });

  a = fakeAdmin({ delete: [new AuthAdminError(404, 'user_not_found')], get: [] });
  assert.deepEqual(await ensureAccountDeleted(a, 'u1', { sleep: noSleep }), { outcome: 'gone' });

  // 502 e a conferência diz que ainda existe: tenta de novo e apaga.
  a = fakeAdmin({ delete: [new AuthAdminError(502), null], get: [{ id: 'u1' }] });
  assert.deepEqual(await ensureAccountDeleted(a, 'u1', { sleep: noSleep }), { outcome: 'deleted' });
  assert.equal(a.calls.filter((c) => c[0] === 'delete').length, 2);

  // Rede caiu depois de apagar: a conferência não acha a conta; vale como apagada, sem repetir.
  a = fakeAdmin({ delete: [new AuthAdminError(0, 'network')], get: [null] });
  assert.equal((await ensureAccountDeleted(a, 'u1', { sleep: noSleep })).outcome, 'gone');
  assert.equal(a.calls.filter((c) => c[0] === 'delete').length, 1);

  // 500 sempre: desiste depois das repetições, com o status.
  a = fakeAdmin({ delete: [new AuthAdminError(500), new AuthAdminError(500), new AuthAdminError(500)],
    get: [{ id: 'u1' }, { id: 'u1' }, { id: 'u1' }] });
  assert.deepEqual(await ensureAccountDeleted(a, 'u1', { sleep: noSleep }), { outcome: 'failed', info: 'http_500' });

  // 403 (chave sem permissão): não repete.
  a = fakeAdmin({ delete: [new AuthAdminError(403, 'not_admin')], get: [{ id: 'u1' }] });
  assert.deepEqual(await ensureAccountDeleted(a, 'u1', { sleep: noSleep }), { outcome: 'failed', info: 'http_403_not_admin' });
  assert.equal(a.calls.filter((c) => c[0] === 'delete').length, 1);

  // Erro que não é do Auth sobe.
  a = fakeAdmin({ delete: [new TypeError('x')], get: [] });
  await assert.rejects(() => ensureAccountDeleted(a, 'u1', { sleep: noSleep }), TypeError);
});
