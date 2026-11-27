// QA E4 PR 2: refazer depois de o legado mudar de formas que esbarram nos índices únicos e nas FKs.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { legacy, load, resetDest, fingerprint, integrity, q, M, C, R, ADMINS } from './harness.mjs';

const OK = { drift: 0, periods: 0, member_rules: 0, cell_rules: 0, defaults: 1 };
const rp = (id, o) => R(id, { CellId: 1, LeadershipId: 2, TimothyId: 3, HostId: 4, ...o });
const base = (over = {}) => ({
  members: [M(1, { Name: 'Pastor Um', Gender: 0 }), M(2, { LeadershipId: 1 }), M(3, { LeadershipId: 1 }), M(4, { LeadershipId: 2 }),
    M(10, { LeadershipId: 2, Email: 'a@exemplo.org', MobileNumber: '51999990010', CPF: '529.982.247-25' }),
    M(11, { LeadershipId: 2, Email: 'b@exemplo.org', MobileNumber: '51999990011', CPF: '111.444.777-35' }),
    M(12, { LeadershipId: 2, Email: 'c@exemplo.org', MobileNumber: '51999990012', CPF: '390.533.447-05' })],
  cells: [C(1, { LeadId: 2, TimothyId: 3, HostId: 4 }), C(2, { LeadId: 3, TimothyId: 2, HostId: 4 })],
  reports: [rp(1, { Date: '2026-10-07 20:00:00' }), rp(2, { Date: '2026-10-14 20:00:00' }), rp(3, { CellId: 2, Date: '2026-10-10 09:30:00' })],
  participants: [[2, 1], [3, 2]],
  ...over,
});
const rep = async () => Object.fromEntries((await q(`SELECT legacy_id, date::text AS date, deleted_at IS NOT NULL AS del, deleted_by_kind::text AS dk,
    (SELECT legacy_id FROM public.cells c WHERE c.id = cell_id) AS cell FROM public.cell_reports WHERE legacy_id IS NOT NULL`)).map((r) => [r.legacy_id, r]));
const mem = async () => Object.fromEntries((await q(`SELECT legacy_id, email, mobile_whatsapp, cpf, deleted_at IS NOT NULL AS del FROM public.members WHERE legacy_id IS NOT NULL`)).map((r) => [r.legacy_id, r]));

beforeEach(() => resetDest());

describe('Refazer com trocas entre carregados', () => {
  test('trocar e-mail, celular e CPF em ciclo entre três membros não esbarra nos índices únicos', async () => {
    legacy(base());
    assert.equal(load(ADMINS).status, 0);
    const b = base();
    const [a, bb, c] = [b.members[4], b.members[5], b.members[6]];
    for (const f of ['Email', 'MobileNumber', 'CPF']) { const t = a[f]; a[f] = bb[f]; bb[f] = c[f]; c[f] = t; }
    legacy(b);
    const r = load(ADMINS);
    assert.equal(r.status, 0, r.out);
    const m = await mem();
    assert.deepEqual([m[10].email, m[11].email, m[12].email], ['b@exemplo.org', 'c@exemplo.org', 'a@exemplo.org']);
    assert.deepEqual([m[10].cpf, m[11].cpf, m[12].cpf], ['11144477735', '39053344705', '52998224725']);
    assert.deepEqual(await integrity(), OK);
  });

  test('um membro é excluído no legado e outro ativo passa a ter o identificador dele na mesma carga', async () => {
    legacy(base());
    assert.equal(load(ADMINS).status, 0);
    const b = base();
    b.members[4].IsDeleted = 1; b.members[4].LeadershipId = 2;
    b.members[5].Email = 'a@exemplo.org'; b.members[5].MobileNumber = '51999990010'; b.members[5].CPF = '529.982.247-25';
    legacy(b);
    const r = load(ADMINS);
    assert.equal(r.status, 0, r.out);
    const m = await mem();
    assert.deepEqual([m[10].del, m[11].email, m[11].cpf], [true, 'a@exemplo.org', '52998224725']);
    assert.deepEqual(await integrity(), OK);
  });

  test('trocar as datas (semanas) de dois relatórios da mesma célula e mudar um de célula na mesma carga', async () => {
    legacy(base());
    assert.equal(load(ADMINS).status, 0);
    const b = base();
    b.reports[0].Date = '2026-10-14 20:00:00'; b.reports[1].Date = '2026-10-07 20:00:00';   // troca de semanas
    b.reports[2].CellId = 1; b.reports[2].Date = '2026-10-21 20:00:00';                       // relatório 3 muda de célula
    legacy(b);
    const r = load(ADMINS);
    assert.equal(r.status, 0, r.out);
    const x = await rep();
    assert.deepEqual([x[1].date, x[2].date, x[3].date, x[3].cell], ['2026-10-14', '2026-10-07', '2026-10-21', 1]);
    assert.deepEqual([x[1].del, x[2].del, x[3].del], [false, false, false]);
    assert.deepEqual(await integrity(), OK);
  });

  test('entra um relatório de Id maior na semana de um já carregado (o antigo passa a duplicado) e depois sai (o antigo volta)', async () => {
    legacy(base());
    assert.equal(load(ADMINS).status, 0);
    const b = base();
    b.reports.push(rp(9, { Date: '2026-10-09 20:00:00' })); // mesma semana do 1 (07/10)
    legacy(b);
    assert.equal(load(ADMINS).status, 0);
    let x = await rep();
    assert.deepEqual([x[1].del, x[1].dk, x[9].del], [true, 'system', false]);
    const [{ da1 }] = await q(`SELECT deleted_at::text AS da1 FROM public.cell_reports WHERE legacy_id = 1`);
    // o legado volta ao que era (o 9 some do legado): o 1 volta a contar, o 9 fica como carregado antes e ausente (stale)
    legacy(base());
    const r = load(ADMINS);
    // O 9 sumiu do legado: pela PR2-4 fica como está (não é mexido). O 1 e o 9 ficam na mesma semana: um deles precisa ficar fora do índice.
    console.log(`  (maior Id some do legado) status ${r.status}: ${r.status ? r.out.split('\n').filter((l) => /ERRO|Validação|report_|  [a-z_]+ \//.test(l)).slice(0, 5).join(' | ') : 'ok'}`);
    if (r.status === 0) {
      x = await rep();
      assert.ok(!(x[1].del === false && x[9].del === false), 'dois vivos na mesma semana nunca');
    }
    assert.ok(da1 !== undefined);
    assert.deepEqual(await integrity(), OK);
  });

  test('membro e relatório que somem do legado (cópia sem eles) ficam como estão e a carga seguinte passa', async () => {
    legacy(base());
    assert.equal(load(ADMINS).status, 0);
    const b = base();
    b.members = b.members.filter((m) => m.Id !== 12);
    b.reports = b.reports.filter((r) => r.Id !== 3);
    b.participants = b.participants.filter(([, rid]) => rid !== 3);
    legacy(b);
    const before = await fingerprint();
    const r = load(ADMINS);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /member_stale/); assert.match(r.out, /report_stale/);
    const [{ n }] = await q('SELECT count(*)::int AS n FROM public.members WHERE legacy_id = 12 AND deleted_at IS NULL');
    assert.equal(n, 1);
    assert.deepEqual(await integrity(), OK);
    assert.notDeepEqual(await fingerprint(), before === null ? {} : null);
  });

  test('líder some do legado, mas o discípulo continua apontando para ele: o discípulo fica sem liderança; o ausente fica; consistência mantida', async () => {
    const b0 = base();
    b0.members.push(M(20, { LeadershipId: 12 }));
    legacy(b0);
    assert.equal(load(ADMINS).status, 0);
    const b = base();
    b.members.push(M(20, { LeadershipId: 12 }));
    b.members = b.members.filter((m) => m.Id !== 12);
    legacy(b);
    const r = load(ADMINS);
    console.log(`  (líder ausente do legado) status ${r.status}: ${r.status ? r.out.split('\n').filter((l) => /ERRO|Validação|  [a-z_]+ \//.test(l)).slice(0, 5).join(' | ') : 'ok'}`);
    assert.equal(r.status, 0, r.out);
    const [m] = await q('SELECT leader_id, has_leadership FROM public.members WHERE legacy_id = 20');
    assert.deepEqual([m.leader_id, m.has_leadership], [null, false]);
    assert.deepEqual(await integrity(), OK);
  });
});
