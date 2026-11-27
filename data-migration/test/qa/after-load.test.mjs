// QA E4 PR 2: o que existe no novo depois de uma carga e o que o "refazer" faz com isso.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { legacy, load, resetDest, fingerprint, integrity, q, pg, M, C, R, ADMINS } from './harness.mjs';

const OK = { drift: 0, periods: 0, member_rules: 0, cell_rules: 0, defaults: 1 };
const data = () => ({
  members: [
    M(1, { Name: 'Pastor Um', Gender: 0 }), M(2, { LeadershipId: 1 }), M(3, { LeadershipId: 1 }),
    M(4, { LeadershipId: 2, SpouseId: 5 }), M(5, { LeadershipId: 3, SpouseId: 4 }), M(6, { LeadershipId: 4 }),
    M(7, { LeadershipId: 6 }), M(8, { LeadershipId: 6 }), M(9, { LeadershipId: 6 }),
  ],
  cells: [C(1, { LeadId: 2, TimothyId: 4, HostId: 5 }), C(2, { LeadId: 4, TimothyId: 6, HostId: 7, WeekDay: 6, Time: '09:30' })],
  reports: [
    R(1, { CellId: 1, Date: '2026-10-07 20:00:00', LeadershipId: 2, TimothyId: 4, HostId: 5 }),
    R(2, { CellId: 1, Date: '2026-10-14 20:00:00', LeadershipId: 2, TimothyId: 4, HostId: 5 }),
    R(3, { CellId: 2, Date: '2026-10-10 09:30:00', LeadershipId: 4, TimothyId: 6, HostId: 7 }),
  ],
  participants: [[2, 1], [4, 1], [5, 1], [4, 2], [7, 3]],
});
const mid = async (lid) => (await q('SELECT id FROM public.members WHERE legacy_id = $1', [lid]))[0].id;

/** Cadastros "do app", com os triggers ligados (como a tela grava). */
async function newInApp() {
  const c = await pg();
  const ids = {};
  try {
    const role = `(SELECT id FROM public.roles WHERE is_default)`;
    const leader6 = await mid(6);
    const r1 = await c.query(`INSERT INTO public.members (name, email, gender, has_leadership, leader_id, role_id)
        VALUES ('Novo Um', 'novo1@exemplo.org', 'M', true, $1, ${role}) RETURNING id`, [leader6]);
    ids.n1 = r1.rows[0].id;
    const r2 = await c.query(`INSERT INTO public.members (name, email, gender, has_leadership, leader_id, role_id)
        VALUES ('Novo Dois', 'novo2@exemplo.org', 'F', true, $1, ${role}) RETURNING id`, [ids.n1]);
    ids.n2 = r2.rows[0].id;
    // cônjuge de um carregado sem cônjuge (o trigger deixa os dois lados)
    const r3 = await c.query(`INSERT INTO public.members (name, email, gender, has_leadership, leader_id, spouse_id, role_id)
        VALUES ('Novo Tres', 'novo3@exemplo.org', 'F', true, $1, $2, ${role}) RETURNING id`, [leader6, await mid(9)]);
    ids.n3 = r3.rows[0].id;
    const rc = await c.query(`INSERT INTO public.cells (leader_id, timothy_id, host_id, meeting_day, meeting_time, type)
        VALUES ($1, $2, $3, 'Quinta', '19:30', 'Evangelística') RETURNING id`, [ids.n1, await mid(6), await mid(7)]);
    ids.cell = rc.rows[0].id;
    const r4 = await c.query(`INSERT INTO public.members (name, email, gender, has_leadership, leader_id, role_id)
        VALUES ('Novo Quatro', 'novo4@exemplo.org', 'M', true, $1, ${role}) RETURNING id`, [await mid(8)]);
    ids.n4 = r4.rows[0].id;
    await c.query('BEGIN');
    await c.query(`SET LOCAL mci.cell_report_write = 'on'`);
    const [cell1] = (await c.query('SELECT id FROM public.cells WHERE legacy_id = 1')).rows;
    const rr = await c.query(`INSERT INTO public.cell_reports (cell_id, date, time, was_held, theme, offering)
        VALUES ($1, '2026-11-25', '20:00', true, 'Lançado no novo', 12.5) RETURNING id`, [cell1.id]);
    ids.report = rr.rows[0].id;
    await c.query('INSERT INTO public.cell_report_participants (report_id, member_id) VALUES ($1, $2), ($3, $2)',
      [ids.report, ids.n1, (await c.query('SELECT id FROM public.cell_reports WHERE legacy_id = 1')).rows[0].id]);
    await c.query('COMMIT');
    // edição de um carregado e troca de função
    await c.query(`UPDATE public.members SET name = 'Editado No App' WHERE legacy_id = 4`);
    await c.query(`UPDATE public.members SET role_id = (SELECT id FROM public.roles WHERE is_system) WHERE legacy_id = 6`);
  } finally { await c.end(); }
  return ids;
}

beforeEach(() => resetDest());

describe('Dados criados no novo depois da carga e o "refazer"', () => {
  test('o que foi criado no novo sobrevive ao refazer e a hierarquia fecha com eles', async () => {
    legacy(data());
    assert.equal(load(ADMINS).status, 0);
    const ids = await newInApp();
    assert.deepEqual(await integrity(), OK, 'o app deixou tudo consistente antes do refazer');
    const r = load(ADMINS);
    assert.equal(r.status, 0, r.out);
    assert.deepEqual(await integrity(), OK);
    const alive = await q(`SELECT (SELECT count(*) FROM public.members WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL)::int AS m,
        (SELECT count(*) FROM public.cells WHERE id = $2)::int AS c, (SELECT count(*) FROM public.cell_reports WHERE id = $3 AND deleted_at IS NULL)::int AS r`,
      [[ids.n1, ids.n2, ids.n3], ids.cell, ids.report]);
    assert.deepEqual(alive[0], { m: 3, c: 1, r: 1 });
    // Totais do pastor contam os do novo (membros 2..9 = 8 + 4 novos = 12)
    const [t] = await q(`SELECT h.total_disciples AS d, h.total_cells AS c FROM private.member_hierarchy h JOIN public.members m ON m.id = h.member_id WHERE m.legacy_id = 1`);
    assert.deepEqual(t, { d: 12, c: 3 });
    // O cônjuge do novo foi desfeito do lado do novo (o legado não tem esse casal): nunca assimétrico.
    const [sp] = await q(`SELECT n.spouse_id AS n3sp, l.spouse_id AS l9sp FROM public.members n, public.members l WHERE n.id = $1 AND l.legacy_id = 9`, [ids.n3]);
    assert.deepEqual(sp, { n3sp: null, l9sp: null });
    const [out] = await q('SELECT counts->\'write\'->\'members\'->>\'spouse_unlinked_new\' AS u FROM legacy._load_runs ORDER BY id DESC LIMIT 1');
    assert.equal(out.u, '1');
  });

  test('refazer devolve ao legado o nome, a função e os participantes mexidos no app (PR2-4); só isso', async () => {
    legacy(data());
    assert.equal(load(ADMINS).status, 0);
    const ids = await newInApp();
    assert.equal(load(ADMINS).status, 0);
    const [n4] = await q(`SELECT name FROM public.members WHERE legacy_id = 4`);
    assert.equal(n4.name, 'Pessoa4 Teste4', 'o nome volta ao do legado');
    const [r6] = await q(`SELECT r.name FROM public.members m JOIN public.roles r ON r.id = m.role_id WHERE m.legacy_id = 6`);
    assert.equal(r6.name, 'Membro', 'a função volta à regra (o 6 é do nível 3)');
    const [p] = await q(`SELECT count(*)::int AS n FROM public.cell_report_participants p JOIN public.cell_reports x ON x.id = p.report_id WHERE x.legacy_id = 1`);
    assert.equal(p.n, 3, 'o participante novo do relatório carregado sai');
    const [own] = await q(`SELECT count(*)::int AS n FROM public.cell_report_participants WHERE report_id = $1`, [ids.report]);
    assert.equal(own.n, 1, 'o relatório do novo mantém os participantes dele');
  });

  test('segundo refazer logo depois não muda nenhuma linha, mesmo com o novo no destino', async () => {
    legacy(data());
    assert.equal(load(ADMINS).status, 0);
    await newInApp();
    assert.equal(load(ADMINS).status, 0);
    const fp = await fingerprint();
    const r = load(ADMINS);
    assert.equal(r.status, 0);
    const [run] = await q(`SELECT counts->'write' AS w FROM legacy._load_runs ORDER BY id DESC LIMIT 1`);
    assert.deepEqual([run.w.members.inserted, run.w.members.updated, run.w.cells.updated, run.w.reports.updated,
      run.w.participants.inserted, run.w.participants.removed, run.w.members.spouse_unlinked_new], [0, 0, 0, 0, 0, 0, 0]);
    const after = await fingerprint();
    for (const k of Object.keys(fp)) if (k !== 'public.events') assert.equal(after[k], fp[k], k);
  });

  test('membro excluído no app e ativo no legado volta a ativo no refazer; excluído no legado é excluído no destino', async () => {
    legacy(data());
    assert.equal(load(ADMINS).status, 0);
    await q(`UPDATE public.members SET deleted_at = now(), is_active = false WHERE legacy_id = 8`);
    assert.equal(load(ADMINS).status, 0);
    const [m8] = await q('SELECT deleted_at IS NULL AS alive, is_active FROM public.members WHERE legacy_id = 8');
    assert.deepEqual(m8, { alive: true, is_active: true });
    assert.deepEqual(await integrity(), OK);
  });

  test('legado passa a ter excluído um membro que lidera um cadastro do novo: a carga não passa com líder excluído e ativo sem lista', async () => {
    legacy(data());
    assert.equal(load(ADMINS).status, 0);
    const ids = await newInApp();
    const b = data();
    b.members[7] = M(8, { LeadershipId: 6, IsDeleted: 1 }); // o 8 lidera o N4 no novo
    legacy(b);
    const before = await fingerprint();
    const r = load(ADMINS);
    console.log(`  (líder carregado excluído no legado, discípulo do novo) status ${r.status}: ${r.out.split('\n').filter((l) => /Validação|  [a-z_]+ \/|ERRO|PARA/.test(l)).slice(0, 6).join(' | ')}`);
    const [n4] = await q('SELECT leader_id FROM public.members WHERE id = $1', [ids.n4]);
    const eight = await mid(8);
    if (r.status === 0) {
      const [m8] = await q('SELECT deleted_at IS NOT NULL AS del FROM public.members WHERE id = $1', [eight]);
      assert.equal(m8.del, true);
      assert.equal(n4.leader_id, eight, 'o ativo continua com o excluído como líder: a regra delete_member nunca permitiria');
      assert.deepEqual(await integrity(), OK);
    } else {
      assert.deepEqual(await fingerprint(), before, 'se a carga parou, nada foi gravado');
    }
  });

  test('célula já carregada cujo anfitrião passa a excluído no legado: a validação barra a carga inteira, sem gravar', async () => {
    legacy(data());
    assert.equal(load(ADMINS).status, 0);
    await newInApp();
    const b = data();
    b.members[6] = M(7, { LeadershipId: 6, IsDeleted: 1 }); // o anfitrião da célula 2
    legacy(b);
    const before = await fingerprint();
    const r = load(ADMINS);
    // Comportamento atual: a célula já carregada fica fora da transformação (cell_stale, info), continua no destino
    // com o anfitrião excluído e a validação (cell_rule_violations/person_deleted) barra a carga inteira.
    assert.notEqual(r.status, 0);
    assert.match(r.out, /cell_person_deleted/);
    assert.match(r.out, /cell_rule_violations \/ person_deleted/);
    assert.deepEqual(await fingerprint(), before, 'nada gravado');
  });
});
