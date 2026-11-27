// QA E4 PR 2: depois da carga, o que as telas leem (views e RPCs pelo PostgREST da stack, com JWT de um
// usuário carregado) e o login de um carregado sem conta (E4.08 ainda não existe).
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { legacy, load, resetDest, q, rest, userToken, M, C, R, ADMINS } from './harness.mjs';

const ymd = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(`${s}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
let today; let sunday;
const names = (rows) => rows.map((r) => r.name).sort();
const nm = (id) => `Pessoa${id} Teste${id}`;
let tokens;

describe('Leituras depois da carga (stack local, PostgREST)', () => {
  before(async () => {
    resetDest();
    [{ t: today }] = await q(`SELECT public.sp_today()::text AS t`);
    [{ s: sunday }] = await q(`SELECT public.week_start(public.sp_today())::text AS s`);
    const wed = (k) => `${addDays(sunday, 3 - 7 * k)} 20:00:00`; // quarta da semana atual (k=0), passada (1)...
    const dow = Math.round((new Date(`${today}T12:00:00Z`) - new Date(`${sunday}T12:00:00Z`)) / 86400000);
    const d = {
      members: [
        M(1, { Name: 'Pastor Um', Gender: 0 }),
        M(2, { LeadershipId: 1 }), M(3, { LeadershipId: 1 }), M(4, { LeadershipId: 2 }), M(5, { LeadershipId: 2 }),
        M(6, { LeadershipId: 3, SpouseId: 12 }), M(7, { LeadershipId: 6 }), M(8, { LeadershipId: 2, IsDeleted: 1 }),
        M(9, { LeadershipId: 4, Idle: 1 }), M(10, { HasNoLeadership: 1 }), M(11, { LeadershipId: 10 }),
        M(12, { LeadershipId: 2, SpouseId: 6, Gender: 1 }),
      ],
      cells: [
        C(1, { LeadId: 4, TimothyId: 5, HostId: 5 }),
        C(2, { LeadId: 6, TimothyId: 7, HostId: 7, WeekDay: 6, Time: '09:30' }),
        C(3, { LeadId: 11, TimothyId: 11, HostId: 11, WeekDay: 0, Time: '08:00', CreationDate: null }),
        C(4, { LeadId: 7, TimothyId: 7, HostId: 7, WeekDay: 1, Time: '19:00', CreationDate: `${today} 08:00:00` }),
        C(5, { LeadId: 4, TimothyId: 5, HostId: 5, IsDeleted: 1 }),
      ],
      reports: [
        ...(dow >= 3 ? [R(1, { CellId: 1, Date: wed(0), LeadershipId: 4, TimothyId: 5, HostId: 5 })] : []),
        R(2, { CellId: 1, Date: wed(1), LeadershipId: 4, TimothyId: 5, HostId: 5, WeekCellSkipped: 1, Notes: 'Chuva' }),
        R(3, { CellId: 1, Date: wed(2), LeadershipId: 4, TimothyId: 5, HostId: 5 }),
        // duplicado na semana de 3 semanas atrás: o de maior Id fica, o outro vai excluído pelo sistema
        R(4, { CellId: 1, Date: wed(3), LeadershipId: 4, TimothyId: 5, HostId: 5 }),
        R(5, { CellId: 1, Date: `${addDays(sunday, 4 - 21)} 20:00:00`, LeadershipId: 4, TimothyId: 5, HostId: 5 }),
      ],
      participants: [[4, 2], [5, 2], [4, 3]],
    };
    legacy(d);
    const [{ n: ev0 }] = await q('SELECT count(*)::int AS n FROM public.events');
    const r = load(ADMINS);
    assert.equal(r.status, 0, r.out);
    const [{ n: ev1 }] = await q('SELECT count(*)::int AS n FROM public.events');
    console.log(`  (Auditoria) eventos antes ${ev0}, depois da carga ${ev1}`);
    tokens = { admin: await userToken(1), g12: await userToken(2), m6: await userToken(6), m10: await userToken(10), m9: await userToken(9) };
  });

  test('administrador: lista de membros = todos os não excluídos, com nível, status de liderança e vínculo celular corretos', async () => {
    const mv = await rest('/rest/v1/members_view?select=name,g12_level,leadership_status,cell_links,is_active&limit=1000&order=name', { token: tokens.admin });
    assert.equal(mv.status, 200, JSON.stringify(mv.json));
    const live = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12].map((i) => (i === 1 ? 'Pastor Um' : nm(i))).sort();
    assert.deepEqual(names(mv.json), live, 'excluídos não aparecem');
    const by = Object.fromEntries(mv.json.map((r) => [r.name, r]));
    assert.deepEqual([by['Pastor Um'].g12_level, by['Pastor Um'].leadership_status], [0, 'pastor']);
    assert.deepEqual([by[nm(2)].g12_level, by[nm(4)].g12_level, by[nm(9)].g12_level], [1, 2, 3]);
    assert.deepEqual([by[nm(10)].g12_level, by[nm(10)].leadership_status, by[nm(11)].g12_level], [null, 'no_leadership', 1]);
    assert.ok(by[nm(4)].cell_links.includes('leader') && by[nm(5)].cell_links.includes('host'));
    assert.equal(by[nm(9)].is_active, false);
  });

  test('administrador: células e a situação do relatório calculadas pelo banco para células carregadas', async () => {
    const cv = await rest('/rest/v1/cells_view?select=legacy:id,meeting_day,meeting_time,report_status,report_missing_weeks,last_report_date,can_submit_report,leader_name,leader_g12_level&limit=100', { token: tokens.admin });
    assert.equal(cv.status, 200, JSON.stringify(cv.json));
    assert.equal(cv.json.length, 4, 'a célula excluída não aparece');
    const cells = Object.fromEntries((await q('SELECT id, legacy_id FROM public.cells')).map((c) => [c.id, c.legacy_id]));
    const by = Object.fromEntries(cv.json.map((c) => [cells[c.legacy], c]));
    console.log(`  (situação) c1=${by[1].report_status}/${by[1].report_missing_weeks} c2=${by[2].report_status}/${by[2].report_missing_weeks} c3=${by[3].report_status}/${by[3].report_missing_weeks} c4=${by[4].report_status}/${by[4].report_missing_weeks}`);
    for (const c of cv.json) assert.ok(['sent_held', 'sent_not_held', 'not_yet', 'pending', 'next_week', 'no_meeting_day', null].includes(c.report_status));
    assert.equal(by[1].last_report_date, (await q(`SELECT max(date)::text AS d FROM public.cell_reports WHERE cell_id = (SELECT id FROM public.cells WHERE legacy_id = 1) AND deleted_at IS NULL`))[0].d);
    assert.equal(by[2].report_missing_weeks, 4, 'célula carregada antiga sem relatório: 4 ou mais semanas');
    assert.equal(by[3].report_missing_weeks, 4, 'célula sem data de criação no legado conta desde sempre');
    assert.equal(by[4].report_missing_weeks, 0, 'célula criada hoje não acumula semanas');
    assert.deepEqual([by[1].meeting_day, by[1].meeting_time, by[2].meeting_day], ['Quarta', '20:00:00', 'Sábado']);
    assert.equal(by[2].leader_g12_level, 2);
    assert.equal(by[3].leader_g12_level, 1, 'líder logo abaixo de quem não tem liderança é G12');
  });

  test('relatórios: o excluído pelo sistema (duplicado na semana) só aparece na lista de excluídos, e os totais batem com o banco', async () => {
    const rv = await rest('/rest/v1/cell_reports_view?select=id,date,was_held&limit=100', { token: tokens.admin });
    assert.equal(rv.status, 200);
    const [{ n }] = await q(`SELECT count(*)::int AS n FROM public.cell_reports WHERE deleted_at IS NULL`);
    assert.equal(rv.json.length, n);
    const del = await rest('/rest/v1/cell_reports_deleted_view?select=id,date&limit=100', { token: tokens.admin });
    assert.equal(del.status, 200, JSON.stringify(del.json));
    assert.equal(del.json.length, 1);
    const md = await rest('/rest/v1/members_deleted_view?select=name&limit=100', { token: tokens.admin });
    assert.deepEqual(names(md.json), [nm(8)]);
    const cd = await rest('/rest/v1/cells_deleted_view?select=id&limit=100', { token: tokens.admin });
    assert.equal(cd.json.length, 1);
    const parts = await rest('/rest/v1/cell_report_participants_view?select=report_id,member_id&limit=100', { token: tokens.admin });
    assert.equal(parts.status, 200);
    const [{ p }] = await q(`SELECT count(*)::int AS p FROM public.cell_report_participants x JOIN public.cell_reports r ON r.id = x.report_id WHERE r.deleted_at IS NULL`);
    assert.equal(parts.json.length, p);
  });

  test('escopo: o carregado de nível 3 vê o ministério do G12 dele; o sem liderança vê só a própria subárvore; pastor vê tudo', async () => {
    const six = await rest('/rest/v1/members_view?select=name&limit=100', { token: tokens.m6 });
    assert.equal(six.status, 200, JSON.stringify(six.json));
    // o 6 (sob o G12 3) e o cônjuge dele, o 12 (sob o G12 2): âncoras 6, 12, G12 3 e G12 2 com as descendências
    console.log(`  (escopo do 6) ${names(six.json).join(', ')}`);
    for (const must of [6, 7, 3, 12]) assert.ok(names(six.json).includes(nm(must)), `vê o ${must}`);
    assert.ok(!names(six.json).includes('Pastor Um') && !names(six.json).includes(nm(10)), 'não vê o pastor nem outra árvore');
    const ten = await rest('/rest/v1/members_view?select=name&limit=100', { token: tokens.m10 });
    assert.deepEqual(names(ten.json), [nm(10), nm(11)]);
    const cells10 = await rest('/rest/v1/cells_view?select=id', { token: tokens.m10 });
    assert.equal(cells10.json.length, 1, 'só a célula 3');
    const nine = await rest('/rest/v1/members_view?select=name&limit=100', { token: tokens.m9 });
    assert.equal(nine.status, 200);
  });

  test('árvore de ministérios, painel e acesso: sem erro, números iguais aos do banco', async () => {
    const tree = await rest('/rest/v1/rpc/ministry_tree_nodes', { token: tokens.admin, method: 'POST', body: { _parent_ids: null } });
    assert.equal(tree.status, 200, JSON.stringify(tree.json));
    const root = tree.json.find((n) => n.member_name === 'Pastor Um');
    const [h] = await q(`SELECT total_disciples AS d, total_cells AS c FROM private.member_hierarchy h JOIN public.members m ON m.id = h.member_id WHERE m.legacy_id = 1`);
    assert.deepEqual([root.total_disciples, root.total_cells], [h.d, h.c]);
    const kids = await rest('/rest/v1/rpc/ministry_tree_nodes', { token: tokens.admin, method: 'POST', body: { _parent_ids: [root.member_id] } });
    assert.equal(kids.status, 200, JSON.stringify(kids.json));
    assert.ok(kids.json.length >= 2);
    for (const tok of Object.values(tokens)) {
      const t = await rest('/rest/v1/rpc/ministry_tree_nodes', { token: tok, method: 'POST', body: { _parent_ids: null } });
      assert.equal(t.status, 200, JSON.stringify(t.json));
    }
    const dash = await rest('/rest/v1/rpc/dashboard_summary', { token: tokens.admin, method: 'POST', body: {} });
    assert.equal(dash.status, 200, JSON.stringify(dash.json));
    const [live] = await q(`SELECT count(*)::int AS n FROM public.members WHERE deleted_at IS NULL`);
    assert.equal(dash.json[0].members_total, live.n);
    const acc = await rest('/rest/v1/rpc/my_access', { token: tokens.m6, method: 'POST', body: {} });
    assert.equal(acc.status, 200);
    assert.equal(acc.json[0].role_name, 'Membro');
    const g12 = await rest('/rest/v1/rpc/my_access', { token: tokens.g12, method: 'POST', body: {} });
    assert.equal(g12.json[0].role_name, 'Administrador');
  });

  test('a carga não cria Auditoria nem conta; sem E4.08, o login do carregado é recusado como qualquer identificação inválida, sem erro estranho', async () => {
    const [{ n: accounts }] = await q(`SELECT count(*)::int AS n FROM auth.users WHERE id NOT IN (SELECT id FROM public.members WHERE legacy_id IN (1, 2, 6, 9, 10))`);
    assert.equal(accounts, 0, 'a carga não cria contas (as 5 existentes foram criadas pelo teste para emitir tokens)');
    // Um carregado sem conta: o 3 (e-mail qa3@exemplo.org)
    const known = await rest('/rest/v1/rpc/sign_in_attempt', { method: 'POST', body: { _identifier: 'qa3@exemplo.org', _password: 'Senha#1234', _origin: '203.0.113.9' } });
    const unknown = await rest('/rest/v1/rpc/sign_in_attempt', { method: 'POST', body: { _identifier: 'naoexiste@exemplo.org', _password: 'Senha#1234', _origin: '203.0.113.9' } });
    const deleted = await rest('/rest/v1/rpc/sign_in_attempt', { method: 'POST', body: { _identifier: 'qa8@exemplo.org', _password: 'Senha#1234', _origin: '203.0.113.9' } });
    console.log(`  (login carregado sem conta) ${known.status} ${JSON.stringify(known.json)} | inexistente ${JSON.stringify(unknown.json)} | excluído ${JSON.stringify(deleted.json)}`);
    assert.equal(known.status, 200);
    assert.deepEqual(known.json, unknown.json, 'não revela que o cadastro existe');
    assert.deepEqual(deleted.json, unknown.json);
    const ev = await q(`SELECT action::text AS a, metadata FROM public.events WHERE action::text = 'login_failed' ORDER BY occurred_at DESC LIMIT 3`);
    for (const e of ev) assert.doesNotMatch(JSON.stringify(e.metadata), /Senha#1234|qa3@exemplo|203\.0\.113/, 'sem senha, e-mail completo ou origem na Auditoria');
    // por telefone e CPF (identificação de outro tipo) também
    const bad = await rest('/rest/v1/rpc/sign_in_attempt', { method: 'POST', body: { _identifier: '%%%', _password: 'x', _origin: '203.0.113.9' } });
    assert.equal(bad.status, 200, JSON.stringify(bad.json));
  });

  test('PR2-9: relatório realizado com timóteo/anfitrião do retrato fora dos participantes é listado e salva no formulário (save_cell_report)', async () => {
    // Relatório 3: retrato líder 4, timóteo e anfitrião 5; no legado só o 4 participou.
    const [run] = await q(`SELECT lists FROM legacy._load_runs ORDER BY id DESC LIMIT 1`);
    assert.ok((run.lists.report_snapshot_not_participant ?? []).includes(3), JSON.stringify(run.lists.report_snapshot_not_participant));
    const [rep] = await q(`SELECT r.id, (SELECT id FROM public.members WHERE legacy_id = 4) AS m4,
                                  (SELECT id FROM public.members WHERE legacy_id = 2) AS m2
                             FROM public.cell_reports r WHERE r.legacy_id = 3`);
    // Só o tema (participantes intocados, como o formulário manda quando não mudam).
    const a = await rest('/rest/v1/rpc/save_cell_report', { token: tokens.admin, method: 'POST',
      body: { _report_id: rep.id, _report: { theme: 'Tema corrigido' }, _participant_ids: null } });
    assert.equal(a.status, 200, JSON.stringify(a.json));
    // Com o conjunto final de participantes (o 4 e mais o 2): o 5, do retrato, não precisa entrar.
    const b = await rest('/rest/v1/rpc/save_cell_report', { token: tokens.admin, method: 'POST',
      body: { _report_id: rep.id, _report: {}, _participant_ids: [rep.m4, rep.m2] } });
    assert.equal(b.status, 200, JSON.stringify(b.json));
    const ps = await q(`SELECT m.legacy_id FROM public.cell_report_participants p JOIN public.members m ON m.id = p.member_id
                         WHERE p.report_id = $1 ORDER BY 1`, [rep.id]);
    assert.deepEqual(ps.map((x) => x.legacy_id), [2, 4]);
    const [t] = await q('SELECT theme FROM public.cell_reports WHERE id = $1', [rep.id]);
    assert.equal(t.theme, 'Tema corrigido');
  });
});
