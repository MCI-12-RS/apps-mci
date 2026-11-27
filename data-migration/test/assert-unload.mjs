#!/usr/bin/env node
// Asserções e preparação do teste local da limpeza do ensaio (npm run unload, DT-13), em
// test/run-local.sh. Só para a stack local; depois de assert-load.mjs seed-new. Modos:
//   seed-pre           cadastros do novo anteriores à carga, além do seed-new: um cadastro (P5),
//                      uma célula com relatório e participantes, e a senha no cofre do a1
//   fingerprint        retrato do destino sem a Auditoria: tabelas da carga, private.*, auth.*,
//                      funções e o controle da carga (legacy._load_adopted)
//   events-count       quantos eventos há na Auditoria (imprime o número)
//   events-kept <n>    a Auditoria tem pelo menos <n> eventos e os do ensaio continuam lá
//   rehearsal          o "ensaio" em cima da carga e das contas: login com a senha do legado,
//                      sessões, cadastros, célula, relatórios e participantes lançados por um
//                      Administrador da carga, função trocada, adotado editado e excluído
//   block-setup | block-teardown   cadastro e célula anteriores à carga passam a apontar para a carga, e o
//                      cônjuge de antes de um adotado casa com outra pessoa
//   auth-pending <n>   o banco já está limpo e a última limpeza ficou com <n> contas pendentes no Auth
//   side-effects-setup | side-effects-check   cônjuge, participante e autoria em cadastros que ficam
//   mark-final         marca a última carga como --final (só teste)
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadConfig, postgresOptions, authAdminOptions } from '../src/lib/config.mjs';
import { connectPostgres } from '../src/lib/postgres.mjs';

const [configPath, mode, arg] = process.argv.slice(2);
const values = loadConfig(configPath).values;
const pgo = postgresOptions(values);
assert.ok(pgo.describe.local, 'assert-unload só roda contra a stack local');
const auth = authAdminOptions(values, pgo.describe);
const client = await connectPostgres(pgo.options);
const q = async (sql, params) => (await client.query(sql, params)).rows;

const N = {
  a1: '00000000-0000-4000-8000-0000000000a1', a2: '00000000-0000-4000-8000-0000000000a2',
  a3: '00000000-0000-4000-8000-0000000000a3', a4: '00000000-0000-4000-8000-0000000000a4',
  p5: '00000000-0000-4000-8000-0000000000b5', c0: '00000000-0000-4000-8000-0000000000c0',
  r0: '00000000-0000-4000-8000-0000000000d0',
};
const STATE = '/tmp/claude-0/mci-unload-state.json';
const memberId = async (lid) => (await q('SELECT id FROM public.members WHERE legacy_id = $1', [lid]))[0]?.id;

async function tx(fn) {
  await client.query('BEGIN');
  try { const r = await fn(); await client.query('COMMIT'); return r; } catch (e) { await client.query('ROLLBACK'); throw e; }
}

/** Sessão de verdade no Auth (como a sign-in: generate_link + verify), pelo e-mail técnico da conta. */
async function session(memberUuid) {
  const [{ email }] = await q('SELECT u.email FROM auth.users u JOIN public.members m ON m.auth_user_id = u.id WHERE m.id = $1', [memberUuid]);
  const h = { apikey: auth.key, Authorization: `Bearer ${auth.key}`, 'Content-Type': 'application/json' };
  const g = await fetch(`${auth.baseUrl}/auth/v1/admin/generate_link`, { method: 'POST', headers: h, body: JSON.stringify({ type: 'magiclink', email }) });
  const gj = await g.json();
  assert.equal(g.status, 200, `generate_link: ${g.status}`);
  const tokenHash = gj.hashed_token ?? gj.properties?.hashed_token;
  const v = await fetch(`${auth.baseUrl}/auth/v1/verify`, { method: 'POST', headers: h, body: JSON.stringify({ type: 'magiclink', token_hash: tokenHash }) });
  const vj = await v.json();
  assert.equal(v.status, 200, `verify: ${v.status}`);
  const payload = JSON.parse(Buffer.from(vj.access_token.split('.')[1], 'base64url').toString('utf8'));
  return { sub: payload.sub, session_id: payload.session_id };
}

/** Roda fn com o papel authenticated e as claims da sessão (como o PostgREST). */
async function asUser(s, fn) {
  return tx(async () => {
    await client.query('SET LOCAL ROLE authenticated');
    await client.query(`SELECT set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: s.sub, role: 'authenticated', aud: 'authenticated', session_id: s.session_id })]);
    return fn();
  });
}

try {
  if (mode === 'seed-pre') {
    await tx(async () => {
      await client.query(`INSERT INTO public.members (id, name, email, gender, leader_id, role_id)
                          VALUES ($1, 'Novo Pre Cinco', 'pre5@exemplo.org', 'M', $2, (SELECT id FROM public.roles WHERE is_default))`,
      [N.p5, N.a1]);
      await client.query(`INSERT INTO public.cells (id, leader_id, timothy_id, host_id, meeting_day, meeting_time, type)
                          VALUES ($1, $2, $3, $4, 'Quinta', '19:30', 'Evangelística')`, [N.c0, N.a4, N.a3, N.a1]);
      await client.query(`SET LOCAL mci.cell_report_write = 'on'`);
      await client.query(`INSERT INTO public.cell_reports (id, cell_id, date, time, was_held, theme, offering)
                          VALUES ($1, $2, '2026-11-19', '19:30', true, 'Lançado antes da carga', 5)`, [N.r0, N.c0]);
      await client.query(`INSERT INTO public.cell_report_participants (report_id, member_id) VALUES ($1, $2), ($1, $3), ($1, $4)`,
        [N.r0, N.a4, N.a3, N.a1]);
      await client.query(`SELECT private.write_password($1, $1, 'Senha Do Novo Um 2026', NULL)`, [N.a1]);
    });
    console.log('ok: cadastros do novo anteriores à carga (P5, célula, relatório, senha do a1)');
  } else if (mode === 'unseed-pre') {
    // Só teste: tira o que o seed-pre criou (antes do reset do assert-load, que tira o seed-new).
    await tx(async () => {
      await client.query('SET LOCAL session_replication_role = replica');
      await client.query('DELETE FROM public.cell_report_participants WHERE report_id = $1', [N.r0]);
      await client.query('DELETE FROM public.cell_reports WHERE id = $1 OR cell_id = $2', [N.r0, N.c0]);
      await client.query('DELETE FROM private.cell_active_periods WHERE cell_id = $1', [N.c0]);
      await client.query('DELETE FROM public.cells WHERE id = $1', [N.c0]);
      await client.query('UPDATE public.members SET spouse_id = NULL WHERE spouse_id = $1', [N.p5]);
      await client.query('DELETE FROM private.member_hierarchy WHERE member_id = $1', [N.p5]);
      await client.query('DELETE FROM public.members WHERE id = $1', [N.p5]);
      await client.query('DELETE FROM private.account_passwords WHERE auth_user_id = $1', [N.a1]);
    });
    console.log('ok: seed-pre removido');
  } else if (mode === 'fingerprint') {
    const out = {};
    for (const t of ['public.members', 'public.cells', 'public.cell_reports', 'public.cell_report_participants',
      'private.member_hierarchy', 'private.cell_active_periods', 'private.legacy_credentials', 'private.account_passwords',
      'private.member_access_suspensions', 'public.roles', 'public.role_permissions', 'auth.users', 'auth.identities']) {
      const [r] = await q(`SELECT count(*)::int AS n, md5(coalesce(string_agg(x::text, E'\\n' ORDER BY x::text), '')) AS h FROM ${t} x`);
      out[t] = `${r.n}:${r.h}`;
    }
    const [s] = await q('SELECT count(*)::int AS n, count(DISTINCT user_id)::int AS u FROM auth.sessions');
    out['auth.sessions'] = `${s.n}/${s.u}`;
    const [ad] = await q(`SELECT to_regclass('legacy._load_adopted') IS NOT NULL AS ok`);
    out['legacy._load_adopted'] = ad.ok ? (await q('SELECT count(*)::int AS n FROM legacy._load_adopted'))[0].n : 0;
    console.log(JSON.stringify(out));
  } else if (mode === 'events-count') {
    console.log((await q('SELECT count(*)::int AS n FROM public.events'))[0].n);
  } else if (mode === 'events-kept') {
    const [r] = await q('SELECT count(*)::int AS n FROM public.events');
    assert.ok(r.n >= Number(arg), `Auditoria mantida (${r.n} >= ${arg})`);
    const st = JSON.parse((await import('node:fs')).readFileSync(STATE, 'utf8'));
    const [e] = await q('SELECT count(*)::int AS n FROM public.events WHERE entity_id = ANY ($1::uuid[])', [st.rehearsal]);
    assert.ok(e.n >= st.rehearsal.length, `eventos do ensaio continuam (${e.n})`);
    console.log(`ok: Auditoria mantida (${r.n} eventos; ${e.n} dos cadastros do ensaio)`);
  } else if (mode === 'rehearsal') {
    // Login com a senha do legado (a primeira entrada grava a senha no cofre).
    await tx(async () => {
      await client.query('SET LOCAL ROLE service_role');
      const [{ r }] = (await client.query('SELECT public.sign_in_attempt($1, $2, $3) AS r', ['m4@exemplo.org', 'Senha Legado Quatro', '10.88.0.1'])).rows;
      assert.equal(r.result, 'ok', 'login com a senha do legado');
    });
    const m1 = await memberId(1);
    const s1 = await session(m1); // Administrador da carga (D9, LEGACY_ADMIN_IDS)
    await session(await memberId(4));
    await session(N.a2); // adotado que não tinha conta: a conta veio do npm run accounts
    const [l4, l5, l6] = [await memberId(4), await memberId(5), await memberId(6)];
    const x1 = randomUUID(); const x2 = randomUUID(); const x3 = randomUUID(); const cx = randomUUID();
    await asUser(s1, async () => {
      await client.query(`INSERT INTO public.members (id, name, email, gender, leader_id) VALUES ($1, 'Ensaio Um Teste', 'ensaio1@exemplo.org', 'M', $2)`, [x1, l4]);
      await client.query(`INSERT INTO public.members (id, name, email, gender, leader_id) VALUES ($1, 'Ensaio Dois Teste', 'ensaio2@exemplo.org', 'F', $2)`, [x2, x1]);
      await client.query(`INSERT INTO public.cells (id, leader_id, timothy_id, host_id, meeting_day, meeting_time, type)
                          VALUES ($1, $2, $3, $4, 'Terça', '20:00', 'Evangelística')`, [cx, x1, l5, l6]);
      await client.query(`UPDATE public.members SET role_id = (SELECT id FROM public.roles WHERE is_system) WHERE id IN ($1, $2)`, [l6, N.a2]);
      await client.query(`UPDATE public.members SET name = 'Editado No Ensaio' WHERE id = $1`, [N.a1]);
    });
    // Cadastro com conta (como a create-user-admin: conta com o id do membro, sem Id do legado).
    await tx(async () => {
      await client.query(`INSERT INTO auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data,
                            raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
                          VALUES ($1::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
                                  $1::text || '@mci12fakemail.com', now(), '{}', '{}', now(), now(), '', '', '', '')`, [x3]);
      await client.query(`INSERT INTO public.members (id, name, email, gender, leader_id, auth_user_id, role_id)
                          VALUES ($1, 'Ensaio Tres Teste', 'ensaio3@exemplo.org', 'M', $2, $1, (SELECT id FROM public.roles WHERE is_default))`, [x3, x1]);
      await client.query(`SELECT private.write_password($1, $1, 'Senha Do Ensaio Tres', $2)`, [x3, m1]);
    });
    // Relatórios do ensaio: na célula nova e numa célula da carga (com um participante do ensaio).
    const reps = await tx(async () => {
      await client.query(`SET LOCAL mci.cell_report_write = 'on'`);
      const [c1] = (await client.query('SELECT id FROM public.cells WHERE legacy_id = 1')).rows;
      const ra = randomUUID(); const rb = randomUUID();
      await client.query(`INSERT INTO public.cell_reports (id, cell_id, date, time, was_held, theme, offering)
                          VALUES ($1, $2, public.sp_today() - extract(dow FROM public.sp_today())::int + 2, '20:00', true, 'Ensaio', 1),
                                 ($3, $4, public.sp_today() - extract(dow FROM public.sp_today())::int + 3, '20:00', true, 'Ensaio carga', 2)`,
      [ra, cx, rb, c1.id]);
      await client.query(`INSERT INTO public.cell_report_participants (report_id, member_id) VALUES ($1, $2), ($3, $2), ($3, $4)`, [ra, x2, rb, l4]);
      return [ra, rb];
    });
    // Senha redefinida por um Administrador da carga num cadastro que fica (o cofre do a1 aponta para ele).
    await q('UPDATE private.account_passwords SET password_set_by = $2 WHERE auth_user_id = $1', [N.a1, m1]);
    // Adotado excluído no ensaio (a exclusão suspende a conta dele).
    await asUser(s1, async () => { await client.query('SELECT public.delete_member($1)', [N.a2]); });
    const [chk] = await q(`SELECT (SELECT count(*) FROM private.member_access_suspensions WHERE member_id = $1)::int AS susp,
                                  (SELECT count(*) FROM private.account_passwords v JOIN public.members m ON m.auth_user_id = v.auth_user_id
                                    WHERE m.legacy_id = 4 AND v.password_hash IS NOT NULL)::int AS vault4,
                                  (SELECT count(*) FROM auth.sessions)::int AS sessions`, [N.a2]);
    assert.equal(chk.susp, 1, 'exclusão do adotado suspendeu a conta');
    assert.equal(chk.vault4, 1, 'a senha do legado foi para o cofre no login');
    assert.ok(chk.sessions >= 2, 'sessões criadas');
    (await import('node:fs')).writeFileSync(STATE, JSON.stringify({ rehearsal: [x1, x2, x3, cx, ...reps] }));
    console.log('ok: ensaio em cima da carga (login, sessões, 3 cadastros, célula, 2 relatórios, função, adotado editado e excluído)');
  } else if (mode === 'block-setup') {
    await tx(async () => {
      await client.query('SET LOCAL session_replication_role = replica');
      await client.query('UPDATE public.members SET leader_id = $2 WHERE id = $1', [N.p5, await memberId(4)]);
      await client.query('UPDATE public.cells SET host_id = $2 WHERE id = $1', [N.c0, await memberId(5)]);
      // O a4 (cônjuge de antes do adotado a1; a carga desfez o vínculo) casa no ensaio com o P5.
      await client.query('UPDATE public.members SET spouse_id = CASE id WHEN $1::uuid THEN $2::uuid ELSE $1::uuid END WHERE id IN ($1, $2)', [N.a4, N.p5]);
    });
    console.log('ok: P5 e a célula anterior à carga apontam para a carga; a4 casado com P5');
  } else if (mode === 'block-teardown') {
    await tx(async () => {
      await client.query('SET LOCAL session_replication_role = replica');
      await client.query('UPDATE public.members SET leader_id = $2 WHERE id = $1', [N.p5, N.a1]);
      await client.query('UPDATE public.cells SET host_id = $2 WHERE id = $1', [N.c0, N.a1]);
      await client.query('UPDATE public.members SET spouse_id = NULL WHERE id IN ($1, $2)', [N.a4, N.p5]);
    });
    console.log('ok: bloqueio desfeito');
  } else if (mode === 'auth-pending') {
    const [r] = await q(`SELECT (SELECT count(*) FROM public.members WHERE legacy_id IS NOT NULL)::int AS loaded,
                                (SELECT count(*) FROM legacy._load_adopted)::int AS adopted,
                                (SELECT count(*) FROM legacy._load_runs WHERE undone_at IS NULL)::int AS active,
                                (SELECT status FROM legacy._unload_runs ORDER BY id DESC LIMIT 1) AS status,
                                (SELECT cardinality(pending_accounts) FROM legacy._unload_runs ORDER BY id DESC LIMIT 1) AS pending,
                                (SELECT count(*) FROM auth.users u WHERE u.raw_app_meta_data ? 'legacy_member_id')::int AS marker`);
    assert.deepEqual([r.loaded, r.adopted, r.active], [0, 0, 0], 'o banco já está limpo');
    assert.equal(r.status, 'failed');
    assert.equal(r.pending, Number(arg), 'contas pendentes registradas');
    console.log(`ok: banco limpo; ${r.pending} conta(s) pendente(s) no Auth (${r.marker} com Id do legado)`);
  } else if (mode === 'side-effects-setup') {
    const m1 = await memberId(1);
    const l7 = await memberId(7);
    await tx(async () => {
      // A conta e a sessão do Administrador 1 direto no Auth (sem o npm run accounts), como o harness do QA.
      await client.query(`INSERT INTO auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data,
                            raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
                          VALUES ($1::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
                                  $1::text || '@mci12fakemail.com', now(), '{}', '{}', now(), now(), '', '', '', '')`, [m1]);
      await client.query('SET LOCAL session_replication_role = replica');
      await client.query('UPDATE public.members SET auth_user_id = id WHERE id = $1', [m1]);
    });
    await tx(async () => {
      await client.query('UPDATE public.members SET spouse_id = $2 WHERE id = $1', [N.p5, l7]);
      await client.query(`SET LOCAL mci.cell_report_write = 'on'`);
      await client.query('INSERT INTO public.cell_report_participants (report_id, member_id) VALUES ($1, $2)', [N.r0, l7]);
    });
    // Por último, a edição do Administrador da carga (o carimbo fica com ele).
    const s1 = await session(m1);
    await asUser(s1, async () => {
      await client.query(`UPDATE public.members SET notes = 'Editado por um Administrador da carga' WHERE id = $1`, [N.p5]);
    });
    const [c] = await q(`SELECT p.updated_by = $2 AS by_admin, p.spouse_id = $3 AS married,
                                (SELECT spouse_id FROM public.members WHERE id = $3) = p.id AS reciprocal
                           FROM public.members p WHERE p.id = $1`, [N.p5, m1, l7]);
    assert.deepEqual(c, { by_admin: true, married: true, reciprocal: true });
    console.log('ok: P5 editado pelo Administrador da carga, casado com o 7; o 7 entrou no relatório anterior à carga');
  } else if (mode === 'side-effects-check') {
    const [p] = await q(`SELECT spouse_id, updated_by, updated_by_kind::text AS kind, notes FROM public.members WHERE id = $1`, [N.p5]);
    assert.deepEqual(p, { spouse_id: null, updated_by: null, kind: 'unknown', notes: 'Editado por um Administrador da carga' },
      'cônjuge desfeito; autoria sem autor ("desconhecido"); a edição fica');
    const parts = await q('SELECT member_id FROM public.cell_report_participants WHERE report_id = $1 ORDER BY 1', [N.r0]);
    assert.deepEqual(parts.map((x) => x.member_id), [N.a1, N.a3, N.a4].sort(), 'participante da carga saiu do relatório que fica');
    const [run] = await q('SELECT lists, counts FROM legacy._unload_runs ORDER BY id DESC LIMIT 1');
    assert.deepEqual(run.lists.spouse_unlinked, [N.p5]);
    assert.deepEqual(run.lists.participant_removed_from_kept_report, [N.r0]);
    assert.ok(run.counts.write.authorship_cleared >= 1);
    console.log('ok: cônjuge desfeito, participante removido do relatório que fica, autoria "desconhecido", listados');
  } else if (mode === 'mark-final') {
    await q(`UPDATE legacy._load_runs SET mode = 'final' WHERE id = (SELECT max(id) FROM legacy._load_runs)`);
    console.log('ok: última carga marcada como --final (só teste)');
  } else {
    throw new Error(`modo desconhecido: ${mode}`);
  }
} finally {
  await client.end();
}
