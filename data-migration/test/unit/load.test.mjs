// Testes unitários da carga (sem banco): catálogo de ocorrências, bloqueio por modo e arquivos SQL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { LOAD_CODES, LOAD_CATEGORIES, blockingIssues, parseIdList, loadCodeInfo } from '../../src/lib/load-codes.mjs';
import { SQL_DIR, STAGE_FILES, WRITE_FILES, VALIDATE_FILE } from '../../src/load.mjs';

const sqlFiles = readdirSync(SQL_DIR).filter((f) => f.endsWith('.sql')).sort();
const allSql = sqlFiles.map((f) => readFileSync(resolve(SQL_DIR, f), 'utf8')).join('\n');

test('todo arquivo de sql/load é rodado, na ordem do nome', () => {
  assert.deepEqual([...STAGE_FILES, ...WRITE_FILES, VALIDATE_FILE], sqlFiles);
});

test('catálogo: todo código usado no SQL existe, e todo código do catálogo é usado', () => {
  const used = new Set();
  // Códigos literais ('member_…', 'cell_…', …) e os montados ('member_' || field || '_duplicate').
  for (const m of allSql.matchAll(/'((?:member|cell|report|participant|admin|admins|adoption|identifier|pastor)_[a-z_]+)'/g)) {
    if (!['member_hierarchy_drift', 'member_rule_violations', 'cell_rule_violations', 'cell_active_period_problems',
      'cell_periods_reset', 'cell_periods_backfilled',
      // itens da validação (90_validate.sql), não ocorrências
      'admin_without_system_role', 'cell_reports', 'cell_report_participants']
      .includes(m[1])) used.add(m[1]);
  }
  if (/'member_' \|\| field \|\| '_duplicate'/.test(allSql)) {
    for (const f of ['email', 'mobile', 'cpf']) used.add(`member_${f}_duplicate`);
    used.delete('member_');
  }
  const catalog = new Set(Object.keys(LOAD_CODES));
  assert.deepEqual([...used].filter((c) => !catalog.has(c)).sort(), [], 'código no SQL sem catálogo');
  assert.deepEqual([...catalog].filter((c) => !used.has(c)).sort(), [], 'código no catálogo sem uso no SQL');
});

test('catálogo: categorias e entidades válidas', () => {
  const cats = new Set(LOAD_CATEGORIES.map(([c]) => c));
  for (const [code, [cat, entity, title]] of Object.entries(LOAD_CODES)) {
    assert.ok(cats.has(cat), `${code}: categoria ${cat}`);
    assert.ok(['Members', 'Cells', 'Reports', 'ReportMembers'].includes(entity), `${code}: entidade ${entity}`);
    assert.ok(title.length > 10, `${code}: título`);
  }
  assert.equal(loadCodeInfo('nao_existe'), null);
});

test('bloqueio: block sempre; legacy_fix só no --final; transform e info nunca', () => {
  const issues = [
    { code: 'adoption_ambiguous', n: 1 }, { code: 'member_leader_cycle', n: 3 },
    { code: 'report_duplicate_week', n: 2 }, { code: 'member_adopted', n: 1 },
  ];
  assert.deepEqual(blockingIssues(issues, { final: false }).map((i) => i.code), ['adoption_ambiguous']);
  assert.deepEqual(blockingIssues(issues, { final: true }).map((i) => i.code), ['adoption_ambiguous', 'member_leader_cycle']);
  assert.deepEqual(blockingIssues([{ code: 'codigo_novo', n: 1 }], { final: false }).map((i) => i.code), ['codigo_novo']);
  // As pendências "corrigir no legado" da DT-12 param o --final.
  for (const c of ['member_email_duplicate', 'member_mobile_duplicate', 'member_cpf_duplicate', 'member_leader_cycle',
    'member_spouse_not_reciprocal', 'cell_time_invalid', 'cell_weekday_invalid', 'cell_type_invalid',
    'report_offering_out_of_range', 'cell_person_deleted', 'admins_below_minimum']) {
    assert.equal(loadCodeInfo(c).category, 'legacy_fix', c);
  }
});

test('lista de Ids', () => {
  assert.deepEqual(parseIdList('3, 1;2 3', 'X'), [1, 2, 3]);
  assert.deepEqual(parseIdList('', 'X'), []);
  assert.deepEqual(parseIdList(undefined, 'X'), []);
  assert.throws(() => parseIdList('1,a', 'X'), /X precisa/);
  assert.throws(() => parseIdList('0', 'X'), /X precisa/);
  // QA-3: Id acima do integer do banco é recusado na leitura dos argumentos.
  assert.deepEqual(parseIdList('2147483647', 'X'), [2147483647]);
  assert.throws(() => parseIdList('1,2147483648', 'X'), /X: o Id 2147483648 passa do maior Id/);
  assert.throws(() => parseIdList('99999999999999999999', 'X'), /passa do maior Id/);
});

test('Q-E4-6: membro excluído sem nome ou com sexo inválido não para o --final; o não excluído para', () => {
  const issues = [{ code: 'member_deleted_name_empty', n: 1 }, { code: 'member_deleted_gender_invalid', n: 1 }];
  assert.deepEqual(blockingIssues(issues, { final: true }), []);
  assert.deepEqual(blockingIssues([{ code: 'member_name_empty', n: 1 }, { code: 'member_gender_invalid', n: 1 }], { final: true })
    .map((i) => i.code), ['member_name_empty', 'member_gender_invalid']);
  for (const c of ['member_birth_out_of_range', 'member_mobile_invalid_kept', 'report_held_without_offering',
    'report_skipped_without_reason', 'report_snapshot_not_participant']) {
    assert.equal(loadCodeInfo(c).category, 'info', c);
  }
});

test('SQL da carga: sem parâmetro posicional (nenhum dado pessoal vai como parâmetro)', () => {
  assert.doesNotMatch(allSql, /\$[0-9]/);
});
