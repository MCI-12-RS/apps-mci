#!/usr/bin/env node
// Asserções e preparação do teste local das contas (npm run accounts, E4.08), em test/run-local.sh.
// Só para a stack local; depois da carga da massa fictícia (com os cadastros do novo de
// assert-load.mjs seed-new). Modos:
//   passwords          senhas do legado copiado: MD5 de senhas conhecidas, maiúsculo com espaços, vazio, ilegível
//   fingerprint        retrato do que as contas mexem (auth, cofre, credenciais, membros, Auditoria)
//   block-setup        conta de outro dono com o id do membro 5 e outra conta com o Id do legado 7
//   block-teardown
//   precreate          conta do membro 10 já criada (como numa execução que caiu antes de ligar)
//   unlinked-count     quantas contas da carga ainda não estão ligadas (imprime o número)
//   after-failure      a execução que falhou deixou as criadas ligadas e nenhuma credencial
//   expected           contas, ligações e credenciais esperadas da massa (e as listas da última execução)
//   logins             login pela sign_in_attempt com as senhas do legado (credencial legada)
//   unchanged          a última execução não criou, ligou nem regravou nada
//   change-passwords   duas senhas do legado mudaram (para a falha num lote de credenciais)
//   updated-check      as duas senhas mudadas foram regravadas, sem duplicar
//   problems-empty     private.legacy_credential_problems() vazia e todo elegível com conta
//   volume-check       volume: todo elegível com conta e credencial
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { loadConfig, postgresOptions, authAdminOptions } from '../src/lib/config.mjs';
import { connectPostgres } from '../src/lib/postgres.mjs';
import { createAuthAdmin } from '../src/lib/auth-admin.mjs';

const [configPath, mode, arg] = process.argv.slice(2);
const values = loadConfig(configPath).values;
const pgo = postgresOptions(values);
assert.ok(pgo.describe.local, 'assert-accounts só roda contra a stack local');
const admin = createAuthAdmin(authAdminOptions(values, pgo.describe));
const client = await connectPostgres(pgo.options);
const q = async (sql, params) => (await client.query(sql, params)).rows;
const md5 = (s) => createHash('md5').update(s, 'utf8').digest('hex');

// Senhas fictícias do teste (nunca reais). A carga lê o MD5 do legado copiado.
export const PASSWORDS = { 4: 'Senha Legado Quatro', 8: 'Outra Senha Oito', 21: 'Senha Vinte e Um' };
const UNUSABLE = [16, 17, 20, 39]; // MD5 do texto vazio, ilegível, texto vazio, nulo (fixture)
const NORMALIZED = [8, 21]; // maiúsculo com espaços; maiúsculo
const ADOPTED_WITH_ACCOUNT = 3; // a1 do seed-new
// Depois de "Carga 3: o legado mudou" (run-local.sh), o 6 fica com o e-mail repetido e passa a ter identificador.
const NO_ACCOUNT = [14, 15, 28, 43, 44, 45]; // sem identificador; excluídos
const ELIGIBLE = [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 16, 17, 20, 21, 22, 23, 24, 25, 26, 27, 29, 30, 31, 32, 33, 34,
  35, 36, 37, 38, 39, 40, 41, 42, 46];
const A2 = '00000000-0000-4000-8000-0000000000a2'; // adotado sem conta (legado 13)
const BLOCK_STATE = '/tmp/claude-0/mci-accounts-block.json';

const memberId = async (lid) => (await q('SELECT id FROM public.members WHERE legacy_id = $1', [lid]))[0].id;
const techEmail = async (id) => (await q('SELECT public.member_account_email($1) AS e', [id]))[0].e;
const lastRun = async () => (await q('SELECT * FROM legacy._accounts_runs ORDER BY id DESC LIMIT 1'))[0];

try {
  if (mode === 'passwords') {
    await q(`UPDATE legacy."Members" SET "Password" = CASE "Id"
               WHEN 4 THEN $1 WHEN 8 THEN ' ' || upper($2) || ' ' WHEN 21 THEN upper($3)
               WHEN 16 THEN 'd41d8cd98f00b204e9800998ecf8427e' WHEN 17 THEN 'nao-e-um-md5' WHEN 20 THEN '' END
             WHERE "Id" IN (4, 8, 21, 16, 17, 20)`, [md5(PASSWORDS[4]), md5(PASSWORDS[8]), md5(PASSWORDS[21])]);
    console.log('ok: senhas do legado preparadas');
  } else if (mode === 'fingerprint') {
    const out = {};
    for (const t of ['auth.users', 'auth.identities', 'public.members', 'private.legacy_credentials',
      'private.account_passwords', 'public.events']) {
      const [r] = await q(`SELECT count(*)::int AS n, md5(coalesce(string_agg(x::text, E'\\n' ORDER BY x::text), '')) AS h FROM ${t} x`);
      out[t] = `${r.n}:${r.h}`;
    }
    const [r] = await q(`SELECT to_regclass('legacy._accounts_runs') IS NOT NULL AS ok`);
    out.runs = r.ok ? (await q('SELECT count(*)::int AS n FROM legacy._accounts_runs'))[0].n : 'ausente';
    console.log(JSON.stringify(out));
  } else if (mode === 'block-setup') {
    const id5 = await memberId(5);
    const a = await admin.createAccount({ id: id5, email: await techEmail(id5), legacyId: null });
    assert.equal(a.id, id5);
    // Sem o Id do legado no app_metadata (outro dono): a conta do teste não leva legacy_member_id.
    await q(`UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data - 'legacy_member_id' WHERE id = $1`, [id5]);
    const other = randomUUID();
    await admin.createAccount({ id: other, email: `${other}@mci12fakemail.com`, legacyId: 7 });
    const { writeFileSync } = await import('node:fs');
    writeFileSync(BLOCK_STATE, JSON.stringify([id5, other]));
    console.log('ok: contas de outro dono criadas');
  } else if (mode === 'block-teardown') {
    const { readFileSync, rmSync } = await import('node:fs');
    for (const id of JSON.parse(readFileSync(BLOCK_STATE, 'utf8'))) await admin.deleteAccount(id);
    rmSync(BLOCK_STATE);
    console.log('ok: contas de outro dono apagadas');
  } else if (mode === 'precreate') {
    const id = await memberId(10);
    const a = await admin.createAccount({ id, email: await techEmail(id), legacyId: 10 });
    assert.equal(a.id, id);
    console.log('ok: conta do 10 criada sem ligação');
  } else if (mode === 'unlinked-count') {
    const [r] = await q(`SELECT count(*)::int AS n FROM auth.users u JOIN public.members m ON m.id = u.id
                          WHERE u.raw_app_meta_data ? 'legacy_member_id' AND m.auth_user_id IS NULL`);
    console.log(r.n);
  } else if (mode === 'after-failure') {
    const run = await lastRun();
    assert.equal(run.status, 'failed');
    assert.deepEqual(run.lists.account_create_failed, [11], 'a conta do 11 falhou');
    assert.ok(run.counts.accounts.relinked >= 2, `as contas criadas antes (precreate e a execução morta) foram religadas: ${run.counts.accounts.relinked}`);
    assert.equal(run.counts.accounts.created + run.counts.accounts.relinked, ELIGIBLE.length - 1);
    assert.equal(run.counts.credentials, undefined, 'sem credenciais nesta execução');
    const [c] = await q(`SELECT count(*)::int AS creds,
                                (SELECT count(*)::int FROM public.members WHERE legacy_id IS NOT NULL AND auth_user_id = id) AS linked,
                                (SELECT count(*)::int FROM auth.users u JOIN public.members m ON m.id = u.id
                                  WHERE u.raw_app_meta_data ? 'legacy_member_id' AND m.auth_user_id IS NULL) AS unlinked
                           FROM private.legacy_credentials`);
    // Ligados: os elegíveis menos o 11, mais o adotado com conta (3).
    assert.deepEqual(c, { creds: 0, linked: ELIGIBLE.length - 1 + 1, unlinked: 0 });
    console.log('ok: a falha deixou as contas criadas ligadas, sem credencial; o 11 ficou para a próxima');
  } else if (mode === 'expected') {
    const run = await lastRun();
    assert.equal(run.status, 'ok');
    const rows = await q(`
      SELECT m.legacy_id, m.id, m.auth_user_id, m.deleted_at IS NOT NULL AS del,
             u.id IS NOT NULL AS has_account, lower(u.email) = lower(public.member_account_email(m.id)) AS tech_email,
             u.raw_app_meta_data->>'legacy_member_id' AS marker, u.email_confirmed_at IS NOT NULL AS confirmed,
             coalesce(u.encrypted_password, '') = '' AS no_auth_password,
             v.password_hash IS NOT NULL AS vault_password, coalesce(v.must_change, false) AS must_change,
             c.legacy_hash IS NOT NULL AS credential
        FROM public.members m
        LEFT JOIN auth.users u ON u.id = m.auth_user_id
        LEFT JOIN private.account_passwords v ON v.auth_user_id = m.auth_user_id
        LEFT JOIN private.legacy_credentials c ON c.member_id = m.id
       WHERE m.legacy_id IS NOT NULL ORDER BY m.legacy_id`);
    const by = Object.fromEntries(rows.map((r) => [r.legacy_id, r]));
    for (const lid of ELIGIBLE) {
      const r = by[lid];
      assert.equal(r.auth_user_id, r.id, `${lid}: conta com o id do membro`);
      assert.deepEqual([r.has_account, r.tech_email, r.marker, r.confirmed, r.no_auth_password, r.vault_password, r.must_change],
        [true, true, String(lid), true, true, false, false], `${lid}: conta da carga (e-mail técnico, Id do legado, sem senha, sem marca)`);
      assert.equal(r.credential, !UNUSABLE.includes(lid), `${lid}: credencial só com senha utilizável`);
    }
    assert.equal(by[13].id, A2, 'o adotado sem conta ganhou a conta com o id do cadastro do novo');
    for (const lid of NO_ACCOUNT) {
      assert.equal(by[lid].auth_user_id, null, `${lid}: sem conta`);
      assert.equal(by[lid].credential, false, `${lid}: sem credencial`);
      const [u] = await q(`SELECT count(*)::int AS n FROM auth.users WHERE raw_app_meta_data->>'legacy_member_id' = $1`, [String(lid)]);
      assert.equal(u.n, 0, `${lid}: nenhuma conta com o Id do legado`);
    }
    const a1 = by[ADOPTED_WITH_ACCOUNT];
    assert.deepEqual([a1.id, a1.auth_user_id, a1.marker, a1.credential], ['00000000-0000-4000-8000-0000000000a1',
      '00000000-0000-4000-8000-0000000000a1', null, false], 'adotado com conta: fica com a dele, sem credencial (RN-16 a)');
    assert.deepEqual(run.lists.credential_unusable_md5, UNUSABLE);
    assert.deepEqual(run.lists.credential_md5_normalized, NORMALIZED);
    assert.deepEqual(run.lists.account_adopted_kept, [3]);
    assert.deepEqual(run.lists.member_without_identifier, [14, 15]);
    const [p] = await q('SELECT count(*)::int AS n FROM private.legacy_credential_problems()');
    assert.equal(p.n, 0, 'legacy_credential_problems vazia');
    console.log(`ok: ${ELIGIBLE.length} contas da carga (id do membro, e-mail técnico, Id do legado, sem senha), `
      + `${ELIGIBLE.length - UNUSABLE.length} credenciais; excluídos, sem identificador e adotado com conta sem conta nova`);
  } else if (mode === 'logins') {
    await client.query('BEGIN');
    try {
      await client.query('SET LOCAL ROLE service_role');
      const attempt = async (ident, pw, origin) => (await client.query('SELECT public.sign_in_attempt($1, $2, $3) AS r', [ident, pw, origin])).rows[0].r;
      const ok4 = await attempt('m4@exemplo.org', PASSWORDS[4], '10.77.0.1');
      assert.deepEqual([ok4.result, ok4.credential], ['ok', 'legacy'], 'senha do legado aceita (credencial legada)');
      assert.equal(ok4.auth_user_id, await memberId(4));
      const ok8 = await attempt('m8@exemplo.org', PASSWORDS[8], '10.77.0.2');
      assert.deepEqual([ok8.result, ok8.credential], ['ok', 'legacy'], 'MD5 maiúsculo com espaços: aceito depois do lower(btrim())');
      const bad = await attempt('m21@exemplo.org', PASSWORDS[21].toLowerCase(), '10.77.0.3');
      assert.equal(bad.result, 'invalid', 'senha com outra caixa não confere (RN-02 do E3)');
      const none = await attempt('m16@exemplo.org', '', '10.77.0.4');
      assert.ok(['invalid', 'empty_fields'].includes(none.result), 'sem senha utilizável não entra');
      const none2 = await attempt('m16@exemplo.org', 'qualquer', '10.77.0.5');
      assert.equal(none2.result, 'invalid', 'MD5 do texto vazio não é credencial (RN-08 do E3)');
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    }
    const creds = await q(`SELECT m.legacy_id, c.legacy_hash IS NULL AS discarded, v.password_hash IS NOT NULL AS vault
                             FROM private.legacy_credentials c JOIN public.members m ON m.id = c.member_id
                             JOIN private.account_passwords v ON v.auth_user_id = m.auth_user_id
                            WHERE m.legacy_id IN (4, 8) ORDER BY 1`);
    assert.deepEqual(creds, [{ legacy_id: 4, discarded: true, vault: true }, { legacy_id: 8, discarded: true, vault: true }],
      'a primeira entrada gravou a senha no cofre e descartou a credencial');
    console.log('ok: login pela sign_in_attempt com as senhas do legado (4 e 8); caixa diferente e sem senha recusados');
  } else if (mode === 'unchanged') {
    const run = await lastRun();
    assert.equal(run.status, 'ok');
    assert.deepEqual(run.counts.accounts, { created: 0, relinked: 0, failed: 0, linked: 0 });
    const c = run.counts.credentials;
    assert.deepEqual([c.created, c.updated, c.not_eligible], [0, 0, 0], 'nenhuma credencial criada nem regravada');
    if (arg === 'after-logins') {
      assert.equal(c.has_password, 2, 'os dois que entraram têm senha no novo: sem credencial nova (RN-03)');
      assert.deepEqual(run.lists.credential_has_password, [4, 8]);
    }
    console.log(`ok: refazer não criou nada (inalteradas ${c.unchanged}, com senha no novo ${c.has_password}, sem senha ${c.unusable_md5})`);
  } else if (mode === 'change-passwords') {
    await q(`UPDATE legacy."Members" SET "Password" = md5('Trocada ' || "Id") WHERE "Id" IN (22, 30)`);
    console.log('ok: senhas de 22 e 30 trocadas no legado');
  } else if (mode === 'updated-check') {
    const runs = await q(`SELECT status, counts FROM legacy._accounts_runs ORDER BY id DESC LIMIT 2`);
    assert.deepEqual(runs.map((r) => r.status), ['ok', 'failed']);
    const updated = runs.reduce((s, r) => s + (r.counts.credentials?.updated ?? 0), 0);
    assert.equal(updated, 2, 'as duas regravadas, somando a execução que falhou e a que completou');
    assert.equal(runs[0].counts.credentials.created, 0);
    for (const lid of [22, 30]) {
      const [r] = await q(`SELECT extensions.crypt(md5('Trocada ' || $1::int), c.legacy_hash) = c.legacy_hash AS ok,
                                  count(*) OVER ()::int AS n
                             FROM private.legacy_credentials c JOIN public.members m ON m.id = c.member_id WHERE m.legacy_id = $1::int`, [lid]);
      assert.deepEqual(r, { ok: true, n: 1 }, `${lid}: credencial nova e única`);
    }
    console.log('ok: a falha num lote não perdeu nem duplicou credenciais; refazer completou');
  } else if (mode === 'problems-empty') {
    const [r] = await q(`SELECT (SELECT count(*) FROM private.legacy_credential_problems())::int AS problems,
                                (SELECT count(*) FROM public.members m
                                  WHERE m.legacy_id IS NOT NULL AND m.deleted_at IS NULL
                                    AND public.member_has_login_identifier(m.email, m.mobile_whatsapp, m.cpf)
                                    AND m.auth_user_id IS NULL)::int AS without_account`);
    assert.deepEqual(r, { problems: 0, without_account: 0 });
    console.log('ok: legacy_credential_problems vazia; todo elegível com conta');
  } else if (mode === 'volume-check') {
    const [r] = await q(`SELECT count(*) FILTER (WHERE m.auth_user_id = m.id)::int AS accounts,
                                count(c.member_id)::int AS credentials,
                                count(*)::int AS eligible
                           FROM public.members m LEFT JOIN private.legacy_credentials c ON c.member_id = m.id
                          WHERE m.legacy_id IS NOT NULL AND m.deleted_at IS NULL
                            AND public.member_has_login_identifier(m.email, m.mobile_whatsapp, m.cpf)`);
    assert.equal(r.accounts, r.eligible);
    assert.equal(r.credentials, r.eligible);
    console.log(`ok: volume com ${r.accounts} contas e ${r.credentials} credenciais`);
  } else {
    throw new Error(`modo desconhecido: ${mode}`);
  }
} finally {
  await client.end();
}
