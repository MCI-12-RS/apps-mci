#!/usr/bin/env node
// Asserções e preparação do teste local da carga (test/run-local.sh). Só para a stack local.
//   node test/assert-load.mjs <config> reset            apaga a carga e os cadastros de teste (só teste)
//   node test/assert-load.mjs <config> seed-new         cadastros do novo para a adoção (antes da carga)
//   node test/assert-load.mjs <config> seed-ambiguous   cadastro do novo que coincide com dois do legado
//   node test/assert-load.mjs <config> unseed-ambiguous
//   node test/assert-load.mjs <config> fingerprint      retrato do destino (tabelas da carga, private.*, legacy._load_*)
//   node test/assert-load.mjs <config> expected         compara a última carga com test/expected-load.json
//   node test/assert-load.mjs <config> unchanged        a última carga não gravou nada
//   node test/assert-load.mjs <config> lists-empty      drift, períodos e regras vazios
//   node test/assert-load.mjs <config> legacy-change    muda o legado (participante, data, nome) como uma cópia nova faria
//   node test/assert-load.mjs <config> legacy-change-check
//   node test/assert-load.mjs <config> conflict-setup | conflict-teardown   identificador e semana em conflito com o novo
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { loadConfig, postgresOptions } from '../src/lib/config.mjs';
import { connectPostgres } from '../src/lib/postgres.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const [configPath, mode] = process.argv.slice(2);
const pgo = postgresOptions(loadConfig(configPath).values);
assert.ok(pgo.describe.local, 'assert-load só roda contra a stack local');
const client = await connectPostgres(pgo.options);
const q = async (sql, params) => (await client.query(sql, params)).rows;

// Cadastros do novo (Ids fixos, só teste). O a1 tem conta.
const N = {
  a1: '00000000-0000-4000-8000-0000000000a1', // e-mail e celular do legado 3; Administrador; com conta
  a2: '00000000-0000-4000-8000-0000000000a2', // celular do legado 13 (outra máscara); Líder
  a3: '00000000-0000-4000-8000-0000000000a3', // CPF do legado 9 (o 10 tem o mesmo CPF e perde no saneamento)
  a4: '00000000-0000-4000-8000-0000000000a4', // sem par; líder e cônjuge = a1
  a5: '00000000-0000-4000-8000-0000000000a5', // ambíguo: e-mail do 11 e celular do 7
  a6: '00000000-0000-4000-8000-0000000000a6', // excluído com o e-mail do 7: não é adotado nem conflita
  a7: '00000000-0000-4000-8000-0000000000a7', // conflito: e-mail que o legado 6 passa a ter depois da carga
};
const TEST_IDS = Object.values(N);

async function tx(fn) {
  await client.query('BEGIN');
  try { await fn(); await client.query('COMMIT'); } catch (e) { await client.query('ROLLBACK'); throw e; }
}

try {
  if (mode === 'reset') {
    // Só teste: tira a carga e os cadastros de teste (a limpeza de verdade é o PR 3, DT-13).
    await tx(async () => {
      await client.query('SET LOCAL session_replication_role = replica');
      await client.query(`DELETE FROM public.cell_report_participants p USING public.cell_reports r
                           WHERE p.report_id = r.id AND (r.legacy_id IS NOT NULL OR r.cell_id IN
                                 (SELECT id FROM public.cells WHERE legacy_id IS NOT NULL))`);
      await client.query(`DELETE FROM public.cell_reports WHERE legacy_id IS NOT NULL
                             OR cell_id IN (SELECT id FROM public.cells WHERE legacy_id IS NOT NULL)`);
      await client.query('DELETE FROM public.cells WHERE legacy_id IS NOT NULL');
      // Em replica as FKs não valem: sem a carga, nenhum cadastro de fora aponta para ela
      // (o a4, que aponta para o a1, também sai).
      await client.query('DELETE FROM public.members WHERE legacy_id IS NOT NULL OR id = ANY ($1::uuid[])', [TEST_IDS]);
      await client.query('DELETE FROM auth.users WHERE id = ANY ($1::uuid[])', [TEST_IDS]);
      await client.query('DROP TABLE IF EXISTS legacy._load_adopted, legacy._load_runs');
    });
    await tx(async () => {
      await client.query('SELECT private.rebuild_member_hierarchy(), private.backfill_cell_active_periods()');
    });
    const [r] = await q(`SELECT (SELECT count(*) FROM public.members WHERE legacy_id IS NOT NULL)::int
                              + (SELECT count(*) FROM public.cells WHERE legacy_id IS NOT NULL)::int
                              + (SELECT count(*) FROM public.cell_reports WHERE legacy_id IS NOT NULL)::int AS n`);
    assert.equal(r.n, 0);
    console.log('ok: destino sem carga');
  } else if (mode === 'seed-new') {
    await tx(async () => {
      await client.query(`INSERT INTO auth.users (id, instance_id, aud, role, email, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
                          VALUES ($1::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
                                  $1::text || '@mci12fakemail.com', now(), '{}', '{}', now(), now())`, [N.a1]);
      await client.query(`INSERT INTO public.members (id, name, email, mobile_whatsapp, gender, is_pastor, has_leadership,
                            auth_user_id, role_id, instagram)
                          VALUES ($1, 'Novo Adotado Um', ' M3@Exemplo.org ', '(51) 99999-0003', 'M', true, false, $1,
                                  (SELECT id FROM public.roles WHERE is_system), 'insta_do_novo')`, [N.a1]);
      await client.query(`INSERT INTO public.members (id, name, mobile_whatsapp, gender, is_pastor, has_leadership, role_id)
                          VALUES ($1, 'Novo Adotado Dois', '51 99999-0013', 'F', false, false,
                                  (SELECT id FROM public.roles WHERE name = 'Líder'))`, [N.a2]);
      await client.query(`INSERT INTO public.members (id, name, cpf, gender, is_pastor, has_leadership, role_id)
                          VALUES ($1, 'Novo Adotado Tres', '529.982.247-25', 'M', false, false,
                                  (SELECT id FROM public.roles WHERE is_default))`, [N.a3]);
      await client.query(`INSERT INTO public.members (id, name, email, gender, leader_id, spouse_id, role_id)
                          VALUES ($1, 'Novo Sem Par', 'novo4@exemplo.org', 'F', $2, $2,
                                  (SELECT id FROM public.roles WHERE is_default))`, [N.a4, N.a1]);
    });
    await tx(async () => {
      // Excluído do novo com o e-mail de um membro do legado: a unicidade é só entre não excluídos.
      await client.query('SET LOCAL session_replication_role = replica');
      await client.query(`INSERT INTO public.members (id, name, email, gender, is_pastor, has_leadership, role_id, deleted_at)
                          VALUES ($1, 'Novo Excluido Seis', 'm7@exemplo.org', 'M', false, false,
                                  (SELECT id FROM public.roles WHERE is_default), now())`, [N.a6]);
    });
    await tx(async () => { await client.query('SELECT private.rebuild_member_hierarchy()'); });
    const [s] = await q('SELECT spouse_id FROM public.members WHERE id = $1', [N.a1]);
    assert.equal(s.spouse_id, N.a4, 'cônjuge simétrico pelo trigger');
    console.log('ok: cadastros do novo para a adoção');
  } else if (mode === 'seed-ambiguous') {
    await client.query(`INSERT INTO public.members (id, name, email, mobile_whatsapp, gender, is_pastor, has_leadership, role_id)
                        VALUES ($1, 'Novo Ambiguo Cinco', 'm11@exemplo.org', '51999990002', 'F', false, false,
                                (SELECT id FROM public.roles WHERE is_default))`, [N.a5]);
    await client.query('SELECT private.rebuild_member_hierarchy()');
    console.log('ok: cadastro ambíguo');
  } else if (mode === 'unseed-ambiguous') {
    await tx(async () => {
      await client.query('SET LOCAL session_replication_role = replica');
      await client.query('DELETE FROM public.members WHERE id = $1', [N.a5]);
    });
    await client.query('SELECT private.rebuild_member_hierarchy()');
    console.log('ok: cadastro ambíguo removido');
  } else if (mode === 'fingerprint') {
    const out = {};
    const tables = ['public.members', 'public.cells', 'public.cell_reports', 'public.cell_report_participants',
      'private.member_hierarchy', 'private.cell_active_periods', 'public.events', 'auth.users'];
    for (const t of tables) {
      const [r] = await q(`SELECT count(*)::int AS n, md5(coalesce(string_agg(x::text, E'\\n' ORDER BY x::text), '')) AS h FROM ${t} x`);
      out[t] = `${r.n}:${r.h}`;
    }
    const [ad] = await q(`SELECT to_regclass('legacy._load_adopted') IS NOT NULL AS ok`);
    out['legacy._load_adopted'] = ad.ok
      ? (await q(`SELECT md5(coalesce(string_agg(x::text, E'\\n' ORDER BY x::text), '')) AS h FROM legacy._load_adopted x`))[0].h
      : 'ausente';
    console.log(JSON.stringify(out));
  } else if (mode === 'expected') {
    const expected = JSON.parse(readFileSync(resolve(here, 'expected-load.json'), 'utf8'));
    const [run] = await q('SELECT * FROM legacy._load_runs ORDER BY id DESC LIMIT 1');
    assert.ok(run.finished_at, 'carga terminada');
    const codes = Object.keys(expected.lists).sort();
    assert.deepEqual(Object.keys(run.lists).sort(), codes, 'lista de ocorrências');
    for (const c of codes) assert.deepEqual(run.lists[c], expected.lists[c], `ocorrência ${c}`);
    assert.deepEqual(run.counts.stage, expected.stage, 'contagens da transformação');
    assert.deepEqual(run.counts.write.roles, expected.roles, 'funções dos carregados');

    // Linhas, pelo Id do legado.
    const m = Object.fromEntries((await q(`
      SELECT m.legacy_id, m.id, m.name, m.email, m.mobile_whatsapp, m.cpf, m.is_pastor, m.has_leadership,
             m.is_active, m.deleted_at IS NOT NULL AS del, m.auth_user_id, m.instagram, r.name AS role,
             l.legacy_id AS leader, s.legacy_id AS spouse, h.g12_level, h.total_disciples, h.total_cells,
             m.street, m.complement, m.state, m.zip_code, m.notes, m.created_by_kind::text, m.deleted_by_kind::text
        FROM public.members m
        LEFT JOIN public.roles r ON r.id = m.role_id
        LEFT JOIN public.members l ON l.id = m.leader_id
        LEFT JOIN public.members s ON s.id = m.spouse_id
        LEFT JOIN private.member_hierarchy h ON h.member_id = m.id
       WHERE m.legacy_id IS NOT NULL`)).map((r) => [r.legacy_id, r]));
    // Adoção (Q-E4-1): fica id, conta, função e o que o legado não tem; o resto vem do legado.
    assert.equal(m[3].id, N.a1); assert.equal(m[3].auth_user_id, N.a1); assert.equal(m[3].role, 'Administrador');
    assert.equal(m[3].name, 'Diego Ficticio3'); assert.equal(m[3].instagram, 'insta_do_novo');
    assert.equal(m[3].is_pastor, false); assert.equal(m[3].leader, 1); assert.equal(m[3].spouse, 4);
    assert.equal(m[3].email, 'm3@exemplo.org'); assert.equal(m[3].mobile_whatsapp, '51999990003');
    assert.equal(m[13].id, N.a2); assert.equal(m[13].role, 'Líder'); assert.equal(m[13].leader, 4);
    assert.equal(m[9].id, N.a3); assert.equal(m[9].cpf, '52998224725'); assert.equal(m[9].role, 'Membro');
    assert.equal(m[10].cpf, null, 'CPF repetido fica só no menor Id');
    const [a4] = await q('SELECT leader_id, spouse_id, legacy_id FROM public.members WHERE id = $1', [N.a4]);
    assert.deepEqual(a4, { leader_id: N.a1, spouse_id: null, legacy_id: null }, 'cadastro do novo sem par');
    const [a6] = await q('SELECT legacy_id, deleted_at IS NOT NULL AS del FROM public.members WHERE id = $1', [N.a6]);
    assert.deepEqual(a6, { legacy_id: null, del: true });
    const adopted = await q('SELECT legacy_id, before->>\'name\' AS name FROM legacy._load_adopted ORDER BY legacy_id');
    assert.deepEqual(adopted, [{ legacy_id: 3, name: 'Novo Adotado Um' }, { legacy_id: 9, name: 'Novo Adotado Tres' },
      { legacy_id: 13, name: 'Novo Adotado Dois' }]);
    // Pastores (D9), sem liderança, ciclo, cônjuge, excluídos, endereço.
    assert.deepEqual([m[1].is_pastor, m[1].g12_level, m[1].role], [true, 0, 'Administrador']);
    assert.deepEqual([m[2].is_pastor, m[2].spouse, m[1].spouse], [true, 1, 2]);
    assert.deepEqual([m[22].is_pastor, m[22].has_leadership, m[22].g12_level, m[23].g12_level, m[23].role],
      [false, false, null, 1, 'Líder']);
    assert.deepEqual([m[26].leader, m[26].has_leadership], [null, false], '"não tem liderança" descarta o líder');
    assert.deepEqual([m[30].leader, m[31].leader, m[32].leader], [null, 32, 30], 'ciclo quebrado no menor Id');
    assert.equal(m[46].leader, null);
    assert.deepEqual([m[33].spouse, m[34].spouse, m[35].spouse, m[36].spouse, m[38].spouse], [null, null, null, null, null]);
    assert.deepEqual([m[28].del, m[28].deleted_by_kind, m[27].leader], [true, 'unknown', 28]);
    assert.deepEqual([m[42].is_active, m[42].del], [false, false]);
    assert.equal(m[18], undefined, 'nome vazio fica de fora'); assert.equal(m[19], undefined, 'sexo inválido fica de fora');
    assert.deepEqual([m[1].state, m[1].zip_code, m[1].notes], ['RS', '90000000', 'Observação com acentuação ✓ e emoji 🙂']);
    assert.equal(m[14].email, null, 'e-mail fictício vira nulo');
    assert.equal(m[6].email, null, 'e-mail repetido fica só no menor Id');
    assert.equal(m[8].mobile_whatsapp, null, 'celular repetido (9º dígito) fica só no menor Id');
    // Células.
    const c = Object.fromEntries((await q(`
      SELECT c.legacy_id, c.meeting_day, to_char(c.meeting_time, 'HH24:MI') AS t, c.type, c.is_active,
             c.deleted_at IS NOT NULL AS del, l.legacy_id AS leader, c.street, c.zip_code
        FROM public.cells c LEFT JOIN public.members l ON l.id = c.leader_id WHERE c.legacy_id IS NOT NULL`))
      .map((r) => [r.legacy_id, r]));
    assert.deepEqual(Object.keys(c).map(Number).sort((x, y) => x - y), [1, 8, 9, 10]);
    assert.deepEqual([c[1].meeting_day, c[1].t, c[1].type, c[1].leader], ['Quarta', '20:00', 'Evangelística', 3]);
    assert.deepEqual([c[10].meeting_day, c[10].t, c[10].type, c[10].street], ['Sábado', '09:30', 'Discipulado', null]);
    assert.deepEqual([c[8].is_active, c[9].street], [true, null]);
    // Relatórios.
    const r = Object.fromEntries((await q(`
      SELECT x.legacy_id, x.deleted_at IS NOT NULL AS del, x.deleted_by_kind::text AS dk, x.was_held, x.theme,
             x.visitors, x.offering::text, x.date::text, x.time::text, x.snapshot_cell_type,
             (SELECT count(*)::int FROM public.cell_report_participants p WHERE p.report_id = x.id) AS np,
             sl.legacy_id AS snap_leader
        FROM public.cell_reports x LEFT JOIN public.members sl ON sl.id = x.snapshot_leader_id
       WHERE x.legacy_id IS NOT NULL`)).map((row) => [row.legacy_id, row]));
    assert.deepEqual(Object.keys(r).map(Number).sort((x, y) => x - y), [1, 2, 3, 4, 9, 10, 11]);
    assert.deepEqual([r[1].del, r[1].dk, r[2].del], [true, 'system', false], 'duplicado: fica o maior Id (Q-E4-4)');
    assert.deepEqual([r[3].del, r[3].dk], [true, 'unknown']);
    assert.deepEqual(r[1].visitors, ['Visitante A', 'Visitante B']);
    assert.deepEqual(r[10].visitors, ['A']);
    assert.deepEqual([r[11].offering, r[1].offering], ['1.01', '10.50']);
    assert.deepEqual([r[1].date, r[1].time, r[1].snap_leader, r[1].np], ['2026-11-02', '20:00:00', 3, 3]);
    assert.deepEqual([r[4].np, r[10].np], [1, 1], 'participante inexistente não migra; o excluído, sim');
    console.log('ok: carga igual à esperada (ocorrências, contagens, adoção, liderança, células e relatórios)');
  } else if (mode === 'unchanged') {
    const [run] = await q('SELECT counts FROM legacy._load_runs ORDER BY id DESC LIMIT 1');
    const w = run.counts.write;
    for (const k of ['members', 'cells', 'reports']) {
      assert.deepEqual([w[k].inserted, w[k].updated], [0, 0], `nada regravado em ${k}`);
    }
    assert.deepEqual([w.participants.inserted, w.participants.removed, w.members.spouse_unlinked_new], [0, 0, 0]);
    assert.deepEqual([w.backfill.hierarchy_rebuilt, w.backfill.roles_assigned, w.backfill.cell_periods_backfilled],
      [0, 0, 0]);
    console.log('ok: a carga refeita não mudou nenhuma linha');
  } else if (mode === 'lists-empty') {
    const [r] = await q(`SELECT (SELECT count(*) FROM private.member_hierarchy_drift())::int AS drift,
                                (SELECT count(*) FROM private.cell_active_period_problems())::int AS periods,
                                (SELECT count(*) FROM private.member_rule_violations())::int AS member_rules,
                                (SELECT count(*) FROM private.cell_rule_violations())::int AS cell_rules,
                                (SELECT count(*) FROM public.roles WHERE is_default)::int AS defaults,
                                (SELECT count(*) FROM public.cell_reports WHERE legacy_id IS NOT NULL AND
                                  (snapshot_leader_id IS NULL OR snapshot_timothy_id IS NULL
                                   OR snapshot_host_id IS NULL OR snapshot_cell_type IS NULL))::int AS snapshot_nulls`);
    assert.deepEqual(r, { drift: 0, periods: 0, member_rules: 0, cell_rules: 0, defaults: 1, snapshot_nulls: 0 });
    console.log('ok: member_hierarchy_drift, cell_active_period_problems, member_rule_violations e cell_rule_violations vazias');
  } else if (mode === 'legacy-change') {
    // Como uma cópia nova do legado: nome mudou, relatório 4 mudou de semana, o 1 perdeu um participante,
    // entrou um relatório realizado sem tema (Q-E4-3) e os e-mails de 5 e 7 foram trocados (a troca
    // não pode esbarrar no índice único; o 7 passa a repetir o e-mail do 6, que fica com ele).
    await tx(async () => {
      await client.query(`UPDATE legacy."Members" SET "Name" = 'Fabio Renomeado5' WHERE "Id" = 5`);
      await client.query(`UPDATE legacy."Members" SET "Email" = CASE "Id" WHEN 5 THEN 'm7@exemplo.org' ELSE 'dup@exemplo.org' END
                           WHERE "Id" IN (5, 7)`);
      await client.query(`UPDATE legacy."Reports" SET "Date" = '2026-11-16 20:00:00' WHERE "Id" = 4`);
      await client.query(`DELETE FROM legacy."ReportMembers" WHERE "ReportId" = 1 AND "MemberId" = 6`);
      await client.query(`INSERT INTO legacy."Reports" ("Id", "CellId", "Date", "Subject", "NumMembers", "Contribution",
                            "WeekCellSkipped", "LeadershipId", "HostId", "TimothyId", "CellType", "IsDeleted")
                          VALUES (14, 10, '2026-10-03 09:30:00', '  ', 0, 0, false, 4, 10, 9, 1, false)`);
    });
    console.log('ok: legado alterado');
  } else if (mode === 'legacy-change-check') {
    const [run] = await q('SELECT counts, lists FROM legacy._load_runs ORDER BY id DESC LIMIT 1');
    const w = run.counts.write;
    assert.deepEqual([w.members.inserted, w.members.updated, w.reports.inserted, w.reports.updated,
      w.participants.removed], [0, 3, 1, 1, 1]);
    assert.deepEqual([run.lists.report_held_without_theme, run.lists.member_email_duplicate], [[14], [6, 7]]);
    const rows = await q(`SELECT legacy_id, name, email FROM public.members WHERE legacy_id IN (5, 6, 7) ORDER BY 1`);
    assert.deepEqual(rows, [{ legacy_id: 5, name: 'Fabio Renomeado5', email: 'm7@exemplo.org' },
      { legacy_id: 6, name: 'Gina Ficticio6', email: 'dup@exemplo.org' },
      { legacy_id: 7, name: 'Hugo Ficticio7', email: null }]);
    const reps = await q(`SELECT legacy_id, date::text, theme, was_held FROM public.cell_reports WHERE legacy_id IN (4, 14) ORDER BY 1`);
    assert.deepEqual(reps, [{ legacy_id: 4, date: '2026-11-16', theme: 'Tema 4', was_held: true },
      { legacy_id: 14, date: '2026-10-03', theme: null, was_held: true }]);
    console.log('ok: a carga refeita aplicou só as mudanças do legado');
  } else if (mode === 'conflict-setup') {
    await tx(async () => {
      await client.query(`UPDATE legacy."Members" SET "Email" = 'n7@exemplo.org' WHERE "Id" = 6`);
      await client.query(`INSERT INTO public.members (id, name, email, gender, is_pastor, has_leadership, role_id)
                          VALUES ($1, 'Novo Conflito Sete', 'n7@exemplo.org', 'M', false, false,
                                  (SELECT id FROM public.roles WHERE is_default))`, [N.a7]);
      // Relatório lançado no novo para a célula 1 do legado, na semana de 2026-11-22.
      await client.query(`SET LOCAL mci.cell_report_write = 'on'`);
      await client.query(`INSERT INTO public.cell_reports (cell_id, date, time, was_held, theme, offering)
                          SELECT id, '2026-11-24', '20:00', true, 'Lançado no novo', 0 FROM public.cells WHERE legacy_id = 1`);
      await client.query(`INSERT INTO legacy."Reports" ("Id", "CellId", "Date", "Subject", "NumMembers", "Contribution",
                            "WeekCellSkipped", "LeadershipId", "HostId", "TimothyId", "CellType", "IsDeleted")
                          VALUES (13, 1, '2026-11-25 20:00:00', 'Tema 13', 0, 0, false, 3, 6, 5, 0, false)`);
    });
    await client.query('SELECT private.rebuild_member_hierarchy()');
    console.log('ok: conflitos preparados');
  } else if (mode === 'conflict-teardown') {
    await tx(async () => {
      await client.query('SET LOCAL session_replication_role = replica');
      await client.query(`UPDATE legacy."Members" SET "Email" = ' DUP@Exemplo.org ' WHERE "Id" = 6`);
      await client.query('DELETE FROM legacy."Reports" WHERE "Id" = 13');
      await client.query('DELETE FROM public.members WHERE id = $1', [N.a7]);
      await client.query(`DELETE FROM public.cell_reports WHERE legacy_id IS NULL AND theme = 'Lançado no novo'`);
    });
    await client.query('SELECT private.rebuild_member_hierarchy()');
    console.log('ok: conflitos desfeitos');
  } else {
    throw new Error(`modo desconhecido: ${mode}`);
  }
} finally {
  await client.end();
}
