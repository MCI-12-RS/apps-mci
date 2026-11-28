#!/usr/bin/env node
// Asserções e preparação do teste local da reconciliação (npm run reconcile, E4.09), em
// test/run-local.sh. Só para a stack local; depois da carga e das contas da massa fictícia.
//   legacy-levels           MinistryLevel no legado copiado, como o legado guardaria (a massa não tem)
//   inject                  divergências de propósito (registro faltando, total errado, participante a
//                           mais, conta sem credencial, credencial que não confere, motivo não listado na
//                           carga, nível, conta desligada, campo, oferta, cópia mais nova que a carga)
//   restore                 desfaz o inject
//   expect-clean <json>     a reconciliação passou, com as diferenças esperadas da massa
//   expect-injected <json>  cada divergência injetada apontada com o código certo, e só elas
//   expect-approved <json>  aprovada (volume)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadConfig, postgresOptions } from '../src/lib/config.mjs';
import { connectPostgres } from '../src/lib/postgres.mjs';

const [configPath, mode, arg] = process.argv.slice(2);
const pgo = postgresOptions(loadConfig(configPath).values);
assert.ok(pgo.describe.local, 'assert-reconcile só roda contra a stack local');
const client = await connectPostgres(pgo.options);
const q = async (sql, params) => (await client.query(sql, params)).rows;

async function tx(fn) {
  await client.query('BEGIN');
  try { await fn(); await client.query('COMMIT'); } catch (e) { await client.query('ROLLBACK'); throw e; }
}
const replica = () => client.query('SET LOCAL session_replication_role = replica');
const memberId = async (lid) => (await q('SELECT id FROM public.members WHERE legacy_id = $1', [lid]))[0].id;
const legacyMd5 = (lid) => q(`SELECT private.add_legacy_credential(m.id,
    lower(regexp_replace(l."Password", '^[[:space:]\\u00a0]+|[[:space:]\\u00a0]+$', '', 'g'))) AS r
    FROM public.members m JOIN legacy."Members" l ON l."Id" = m.legacy_id WHERE m.legacy_id = $1`, [lid]);
const RUN = `(SELECT max(id) FROM legacy._load_runs WHERE finished_at IS NOT NULL AND undone_at IS NULL)`;

function report(path) {
  const r = JSON.parse(readFileSync(path, 'utf8'));
  const by = Object.fromEntries(r.checks.map((c) => [c.code, c]));
  return { r, by };
}
const unexpectedIds = (c) => c.unexpected.map(([lid, ref]) => lid ?? ref);
const expectedPairs = (c) => c.expected.map(([lid, , reason]) => `${lid}:${reason}`);

try {
  if (mode === 'legacy-levels') {
    // Como o legado guarda: 12^profundidade (até 12^6), 9999999 sem liderança, 1 para quem não tem
    // líder nem "não tem liderança" (o legado os mostra como Pastores). Quem a carga mudou de líder
    // (ou ficou sem topo) tem outro valor no legado, de propósito: a reconciliação explica.
    await tx(async () => {
      await q(`WITH nulled AS (
                 SELECT m.id FROM public.members m JOIN legacy."Members" l ON l."Id" = m.legacy_id
                  WHERE m.leader_id IS NULL AND l."LeadershipId" IS NOT NULL),
               notop AS (SELECT member_id AS id FROM private.member_hierarchy_problems() WHERE problem = 'no_top'),
               marked AS (SELECT v::int AS lid FROM legacy._load_runs r, jsonb_array_elements_text(r.lists->'member_no_leader_not_marked') v
                           WHERE r.id = ${RUN}),
               lv AS (
                 SELECT m.legacy_id AS lid,
                        CASE WHEN EXISTS (SELECT 1 FROM marked k WHERE k.lid = m.legacy_id) THEN 1
                             WHEN h.g12_level IS NULL THEN 9999999 ELSE (12 ^ least(h.g12_level, 6))::int END AS v,
                        m.id IN (SELECT id FROM nulled) OR m.id IN (SELECT id FROM notop)
                          OR h.ancestor_ids && (SELECT coalesce(array_agg(id), '{}') FROM nulled) AS changed
                   FROM public.members m JOIN private.member_hierarchy h ON h.member_id = m.id
                  WHERE m.legacy_id IS NOT NULL AND m.deleted_at IS NULL)
               UPDATE legacy."Members" x
                  SET "MinistryLevel" = CASE WHEN lv.changed THEN CASE WHEN lv.v = 144 THEN 1728 ELSE 144 END ELSE lv.v END
                 FROM lv WHERE lv.lid = x."Id"`);
    });
    console.log('ok: MinistryLevel no legado');
  } else if (mode === 'inject') {
    await tx(async () => {
      // Registro faltando: membro novo no legado, que a carga ainda não trouxe.
      await q(`INSERT INTO legacy."Members" ("Id", "Name", "Gender", "Email", "LeadershipId", "HasNoLeadership", "Idle",
                 "Baptized", "ChildrenMembersComputed", "IsDeleted", "MinistryLevel")
               VALUES (900, 'Pessoa Faltante Novecentos', 0, 'falta900@exemplo.org', 3, false, false, false, false, false, 144)`);
      // Nível guardado no legado diferente.
      await q(`UPDATE legacy."Members" SET "MinistryLevel" = 1728 WHERE "Id" = 7`);
      // Motivo de uma diferença esperada fora da lista da carga.
      await q(`UPDATE legacy._load_runs SET lists = jsonb_set(lists, '{member_name_empty}',
                 (SELECT coalesce(jsonb_agg(v), '[]') FROM jsonb_array_elements(lists->'member_name_empty') v WHERE v <> '18'))
               WHERE id = ${RUN}`);
      // Cópia mais nova que a carga.
      await q(`UPDATE legacy._copy_runs SET finished_at = finished_at + interval '1000 days'
                WHERE id = (SELECT max(id) FROM legacy._copy_runs)`);
      await replica();
      // Total errado (e o drift do banco junto).
      await q(`UPDATE private.member_hierarchy SET total_disciples = total_disciples + 7 WHERE member_id = $1`, [await memberId(4)]);
      // Participante a mais num relatório carregado.
      await q(`INSERT INTO public.cell_report_participants (report_id, member_id)
               SELECT r.id, $1 FROM public.cell_reports r WHERE r.legacy_id = 2`, [await memberId(7)]);
      // Oferta diferente.
      await q(`UPDATE public.cell_reports SET offering = offering + 1 WHERE legacy_id = 2`);
      // Campo diferente.
      await q(`UPDATE public.members SET name = 'Nome Trocado Errado' WHERE legacy_id = 9`);
      // Conta desligada do cadastro.
      await q(`UPDATE public.members SET auth_user_id = NULL WHERE legacy_id = 5`);
      // Conta sem credencial e credencial que não confere com o MD5 do legado.
      await q(`DELETE FROM private.legacy_credentials WHERE member_id = $1`, [await memberId(12)]);
      await q(`UPDATE private.legacy_credentials SET legacy_hash = extensions.crypt(md5('outra senha'), extensions.gen_salt('bf', 10))
                WHERE member_id = $1`, [await memberId(11)]);
    });
    console.log('ok: divergências injetadas');
  } else if (mode === 'restore') {
    await tx(async () => {
      await q(`DELETE FROM legacy."Members" WHERE "Id" = 900`);
      await q(`UPDATE legacy."Members" x SET "MinistryLevel" = (12 ^ least(h.g12_level, 6))::int
                 FROM public.members m JOIN private.member_hierarchy h ON h.member_id = m.id
                WHERE m.legacy_id = x."Id" AND x."Id" = 7`);
      await q(`UPDATE legacy._load_runs SET lists = jsonb_set(lists, '{member_name_empty}', (lists->'member_name_empty') || '[18]')
                WHERE id = ${RUN} AND NOT (lists->'member_name_empty') @> '[18]'`);
      await q(`UPDATE legacy._copy_runs SET finished_at = finished_at - interval '1000 days'
                WHERE id = (SELECT max(id) FROM legacy._copy_runs) AND finished_at > now()`);
      await replica();
      await q(`DELETE FROM public.cell_report_participants p USING public.cell_reports r
                WHERE p.report_id = r.id AND r.legacy_id = 2 AND p.member_id = $1`, [await memberId(7)]);
      await q(`UPDATE public.cell_reports r SET offering = round(l."Contribution", 2)
                 FROM legacy."Reports" l WHERE l."Id" = r.legacy_id AND r.legacy_id = 2`);
      await q(`UPDATE public.members m SET name = public.normalize_person_name(l."Name")
                 FROM legacy."Members" l WHERE l."Id" = m.legacy_id AND m.legacy_id = 9`);
      await q(`UPDATE public.members SET auth_user_id = id WHERE legacy_id = 5`);
    });
    await tx(async () => { await q('SELECT private.rebuild_member_hierarchy()'); });
    for (const lid of [12, 11]) {
      const [r] = await legacyMd5(lid);
      assert.ok(['created', 'updated'].includes(r.r), `credencial do ${lid}: ${r.r}`);
    }
    console.log('ok: divergências desfeitas');
  } else if (mode === 'expect-clean') {
    const { r, by } = report(arg);
    assert.equal(r.summary.approved, true, 'aprovada');
    assert.equal(r.summary.unexpected, 0);
    assert.match(r.evidence, /^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/);
    // Diferenças esperadas da massa (cada uma com o motivo listado na carga ou da reconciliação).
    const exp = (code, pairs) => {
      for (const p of pairs) assert.ok(expectedPairs(by[code]).includes(p), `${code}: esperada ${p}`);
    };
    exp('member_missing', ['18:member_name_empty', '19:member_gender_invalid']);
    exp('member_leader', ['26:member_no_leadership_with_leader', '29:member_leader_missing', '45:member_leader_self_deleted',
      '46:member_leader_self']);
    exp('member_spouse', ['33:member_spouse_dropped', '35:member_spouse_not_reciprocal']);
    exp('member_field', ['13:member_email_dropped', '11:member_cpf_dropped', '40:member_baptism_date_dropped']);
    exp('cell_missing', ['2:cell_time_invalid', '3:cell_weekday_invalid', '4:cell_type_invalid', '5:cell_person_missing',
      '6:cell_person_deleted', '7:cell_deleted_person_missing']);
    exp('report_missing', ['5:report_cell_missing', '7:report_cell_left_out']);
    exp('report_status', ['1:report_duplicate_week']);
    exp('participant_missing', ['9996:participant_left_out']);
    exp('report_participants_count', ['10:legacy_num_members_mismatch']);
    exp('report_visitors_count', ['10:legacy_num_visitors_mismatch']);
    exp('member_level', ['22:member_no_leader_not_marked', '26:level_follows_leader_change', '27:level_no_top']);
    exp('member_totals', ['3:total_new_records']);
    exp('credential_missing', ['16:credential_unusable_md5', '39:credential_unusable_md5']);
    // O nível sem diferença para quem tem líder (o legado guardou o mesmo).
    assert.ok(!by.member_level.expected.some(([lid]) => lid === 5), 'nível do 5 igual');
    assert.ok(by.hierarchy_problems.items.length > 0, 'lista para a liderança');
    for (const c of ['counts', 'offering_month', 'ranking_g12', 'cells_by_gender', 'admins', 'load_run', 'load_after_copy']) {
      assert.equal(by[c].status, 'ok', c);
    }
    assert.equal(by.sample_member.items.length, 20);
    console.log(`ok: reconciliação limpa (${r.summary.expected} esperadas, ${r.summary.attention} de atenção)`);
  } else if (mode === 'expect-injected') {
    const { r, by } = report(arg);
    assert.equal(r.summary.approved, false);
    const want = {
      member_missing: [900, 18], member_level: [7], member_totals: [4], db_hierarchy_drift: [4],
      participant_extra: [2], report_participants_count: [2], report_field: [2], member_field: [9],
      account_missing: [5], db_credential_problems: [5], credential_missing: [12], credential_hash_mismatch: [11],
    };
    for (const [code, ids] of Object.entries(want)) {
      const got = code.startsWith('db_') ? by[code].items.map(([lid]) => lid) : unexpectedIds(by[code]);
      for (const id of ids) assert.ok(got.includes(id), `${code}: ${id} apontado (veio ${JSON.stringify(got)})`);
      assert.equal(by[code].status, 'falha', code);
    }
    // O motivo fora da lista da carga sai como inesperada, com a explicação.
    assert.match(by.member_missing.unexpected.find(([lid]) => lid === 18)[3], /não listado na carga: member_name_empty/);
    // O membro 19 continua esperado (a lista dele está na carga).
    assert.ok(expectedPairs(by.member_missing).includes('19:member_gender_invalid'));
    assert.equal(by.offering_month.status, 'falha');
    assert.equal(by.load_after_copy.status, 'falha');
    // Nada além do injetado (e do que decorre dele) falhou.
    const allowed = new Set([...Object.keys(want), 'offering_month', 'load_after_copy', 'counts']);
    const failed = r.checks.filter((c) => c.status === 'falha').map((c) => c.code);
    assert.deepEqual(failed.filter((c) => !allowed.has(c)), [], 'falhas além das injetadas');
    console.log(`ok: ${failed.length} verificações apontaram as divergências injetadas`);
  } else if (mode === 'expect-approved') {
    const { r, by } = report(arg);
    assert.equal(r.summary.approved, true, `aprovada (falhas: ${r.checks.filter((c) => c.status === 'falha').map((c) => c.code)})`);
    assert.equal(by.cells_by_gender.status, 'ok');
    console.log(`ok: reconciliação aprovada (${r.summary.expected} esperadas)`);
  } else {
    throw new Error(`modo desconhecido: ${mode}`);
  }
} finally {
  await client.end();
}
