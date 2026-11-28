// Testes unitários da reconciliação (sem banco): catálogo, SQL só de leitura, classificação,
// código de evidência e argumentos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  CHECKS, EXPECTED, RECONCILE_SECTIONS, checkInfo, expectedInfo, docSets, resolveExpected, classify, summarize,
  evidenceCode, parseReferenceInstant, parseCredentialSample, credentialBatches, CREDENTIAL_BATCH,
} from '../../src/lib/reconcile-codes.mjs';
import { LOAD_CODES } from '../../src/lib/load-codes.mjs';
import { SQL_DIR, BASE_FILE, STEP_FILES, CREDENTIAL_FILE, buildSql, preconditionRows, renderMarkdown } from '../../src/reconcile.mjs';
import { MIGRATION_ROOT } from '../../src/lib/config.mjs';

const sqlFiles = readdirSync(SQL_DIR).filter((f) => f.endsWith('.sql')).sort();
const read = (f) => readFileSync(resolve(SQL_DIR, f), 'utf8');
const stripComments = (s) => s.replace(/--.*$/gm, '');
const allSql = stripComments(sqlFiles.map(read).join('\n'));

test('todo arquivo de sql/reconcile é usado, na ordem do nome', () => {
  assert.deepEqual([BASE_FILE, ...STEP_FILES, CREDENTIAL_FILE].sort(), sqlFiles);
  assert.deepEqual([...STEP_FILES].sort(), STEP_FILES, 'STEP_FILES na ordem do nome');
});

test('cada arquivo recebe os CTEs comuns uma vez', () => {
  const base = read(BASE_FILE);
  for (const f of [...STEP_FILES, CREDENTIAL_FILE]) {
    const body = read(f);
    assert.equal(body.split('/*BASE*/').length, 2, `${f}: um /*BASE*/`);
    const sql = buildSql(base, body);
    assert.ok(!sql.includes('/*BASE*/'), f);
    assert.ok(sql.includes("current_setting('mci.rc_load_run')"), `${f}: o texto da base entra inteiro (com os $ dos padrões)`);
    assert.ok(sql.includes("'^[0-9]{1,10}$'"), `${f}: o padrão com $ não é mexido pelo replace`);
  }
  assert.throws(() => buildSql(base, 'SELECT 1'), /sem \/\*BASE\*\//);
});

test('SQL só de leitura: nenhum comando que grava, nenhum parâmetro posicional', () => {
  assert.doesNotMatch(allSql, /\b(INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|TRUNCATE|COPY|GRANT|REVOKE|LOCK|VACUUM|ANALYZE)\b/i);
  assert.doesNotMatch(allSql, /\b(rebuild_member_hierarchy|backfill_cell_active_periods|add_legacy_credential|write_password|set_config)\b/);
  assert.doesNotMatch(allSql, /\$[0-9]/);
});

test('catálogo: todo código do SQL existe, e todo código do catálogo é usado', () => {
  const NOT_CODES = new Set(['left_out', 'no_top', 'cells_under_g12', 'legacy_cells_under_g12', 'new_only_cells_under_g12',
    'active_cells', 'next_week', 'week_start', 'legacy_pending', 'new_pending_loaded', 'new_pending_all', 'created_at',
    'created_by_kind', 'created_by_legacy', 'updated_at', 'updated_by_kind', 'updated_by_legacy', 'deleted_by_kind',
    'deleted_by_legacy', 'deleted_at', 'auth_user_id', 'legacy_member_id', 'with_account', 'used_or_discarded',
    'with_password_in_new', 'g12_sum', 'duplicates', 'expected', 'entity', 'situation', 'legacy', 'new', 'month', 'label',
    'ok', 'n', 'loaded', 'usable', 'active', 'male', 'female', 'created', 'updated', 'deleted', 'other', 'unknown', 'none',
    'system', 'at', 'pending', 'metric', 'diff', 'compared', 'item', 'counts', 'admins', 'credentials', 'dashboard',
    'before_load', 'after_load', 'dup_real', 'dup_listed',
    'sim', 'excluídos', 'ativos', 'inativos', 'ativas', 'inativas', 'excluídas', 'todos', 'x', 'array', 'mci', 'm', 'f']);
  const used = new Set();
  for (const m of allSql.matchAll(/'([a-z_,0-9]+)'/g)) {
    for (const c of m[1].split(',')) if (/^[a-z]+(_[a-z0-9]+)+$/.test(c) && !NOT_CODES.has(c)) used.add(c);
  }
  // Os códigos sem "_" das métricas.
  for (const c of ['counts', 'admins', 'credentials', 'dashboard']) assert.match(allSql, new RegExp(`'metric'[^\\n]*'${c}'|'${c}'`), c);
  const precond = new Set(['load_run', 'load_after_copy', 'accounts_run']);
  const known = new Set([...Object.keys(CHECKS), ...Object.keys(EXPECTED)]);
  assert.deepEqual([...used].filter((c) => !known.has(c)).sort(), [], 'código no SQL sem catálogo');
  const missing = [...known].filter((c) => !used.has(c) && !precond.has(c) && !['counts', 'admins', 'credentials', 'dashboard'].includes(c));
  assert.deepEqual(missing.sort(), [], 'código no catálogo sem uso no SQL');
});

test('catálogo: seções, tipos e motivos', () => {
  const sections = new Set(RECONCILE_SECTIONS.map(([s]) => s));
  for (const [code, [section, type, title]] of Object.entries(CHECKS)) {
    assert.ok(sections.has(section), `${code}: seção`);
    assert.ok(['compare', 'metric', 'empty', 'attention', 'sample'].includes(type), `${code}: tipo`);
    assert.ok(title.length > 3, `${code}: título`);
  }
  for (const [code, [doc, title]] of Object.entries(EXPECTED)) {
    assert.ok(doc === null || doc === 'load', code);
    assert.ok(title.length > 10, `${code}: título`);
    // O motivo "listado na carga" é sempre um código do catálogo da carga.
    if (doc === 'load') assert.ok(LOAD_CODES[code], `${code}: não é ocorrência da carga`);
    else assert.ok(!LOAD_CODES[code], `${code}: é ocorrência da carga e não confere a lista`);
  }
  assert.equal(checkInfo('x'), null);
  assert.equal(expectedInfo('x'), null);
});

test('diferença esperada: motivo da carga só vale se a carga listou o Id', () => {
  const docs = docSets({ member_name_empty: [18], member_leader_cycle: [30, 31, 32], other: 'x' });
  assert.deepEqual(resolveExpected('member_name_empty', 18, docs), { code: 'member_name_empty', note: null });
  assert.deepEqual(resolveExpected('member_name_empty', 19, docs).code, null);
  assert.match(resolveExpected('member_name_empty', 19, docs).note, /não listado na carga: member_name_empty/);
  // O primeiro candidato que vale.
  assert.equal(resolveExpected('member_leader_missing,member_leader_cycle', 30, docs).code, 'member_leader_cycle');
  // Motivo da própria reconciliação não depende da carga.
  assert.equal(resolveExpected('legacy_level_missing,member_no_leader_not_marked', 7, docs).code, 'legacy_level_missing');
  assert.match(resolveExpected('codigo_inventado', 1, docs).note, /codigo_inventado \(desconhecido\)/);
  assert.deepEqual(resolveExpected(null, 1, docs), { code: null, note: null });
  assert.equal(resolveExpected('member_name_empty', null, docs).code, null);
});

test('classificação e situação de cada tipo', () => {
  const docs = docSets({ member_name_empty: [18] });
  const rows = [
    { kind: 'compared', code: 'member_missing', data: { n: 46 } },
    { kind: 'diff', code: 'member_missing', lid: 18, expected: 'member_name_empty' },
    { kind: 'compared', code: 'member_extra', data: { n: 44 } },
    { kind: 'diff', code: 'member_extra', lid: 500, ref: 'x' },
    { kind: 'metric', code: 'counts', ref: 'a', data: { ok: true } },
    { kind: 'metric', code: 'counts', ref: 'b', data: { ok: false } },
    { kind: 'metric', code: 'dashboard', ref: '01', data: { ok: null } },
    { kind: 'item', code: 'db_member_rules', lid: 3, detail: 'name_invalid' },
    { kind: 'item', code: 'hierarchy_problems', lid: 22, detail: 'no_top' },
  ];
  const checks = classify(rows, docs);
  const by = Object.fromEntries(checks.map((c) => [c.code, c]));
  assert.equal(by.member_missing.status, 'ok');
  assert.equal(by.member_missing.expected[0].reason, 'member_name_empty');
  assert.equal(by.member_extra.status, 'falha');
  assert.equal(by.counts.status, 'falha');
  assert.equal(by.dashboard.status, 'info');
  assert.equal(by.db_member_rules.status, 'falha');
  assert.equal(by.db_cell_rules.status, 'ok');
  assert.equal(by.hierarchy_problems.status, 'atencao');
  // Comparação sem a contagem do que foi comparado: falha (o SQL não rodou a verificação).
  assert.equal(by.member_status.status, 'falha');
  // Métrica sem linha: falha.
  assert.equal(by.admins.status, 'falha');
  const s = summarize(checks);
  assert.equal(s.approved, false);
  assert.equal(s.unexpected, 1);
  assert.equal(s.expected, 1);
  assert.equal(s.attention, 1);
  assert.throws(() => classify([{ kind: 'diff', code: 'nao_existe' }], docs), /desconhecida/);
  assert.throws(() => classify([{ kind: 'outro', code: 'member_extra' }], docs), /Tipo de linha/);
});

test('pré-condições: carga mais nova que a cópia, a última carga ativa e as contas concluídas', () => {
  const base = {
    copyRun: { id: 2, finished_at: '2026-11-20T10:00:00Z' },
    loadRun: { id: 5, mode: 'rehearsal', started_at: '2026-11-21T10:00:00Z', finished_at: '2026-11-21T10:01:00Z' },
    latestLoadRunId: 5,
    accountsRun: { id: 3, status: 'ok', finished_at: '2026-11-21T11:00:00Z', undone_at: null },
  };
  const ok = (p) => Object.fromEntries(preconditionRows(p).map((r) => [r.code, r.data.ok]));
  assert.deepEqual(ok(base), { load_run: true, load_after_copy: true, accounts_run: true });
  assert.equal(ok({ ...base, copyRun: { id: 3, finished_at: '2026-11-22T10:00:00Z' } }).load_after_copy, false);
  assert.equal(ok({ ...base, copyRun: null }).load_after_copy, false);
  assert.equal(ok({ ...base, latestLoadRunId: 6 }).load_run, false);
  assert.equal(ok({ ...base, accountsRun: null }).accounts_run, false);
  assert.equal(ok({ ...base, accountsRun: { ...base.accountsRun, status: 'failed' } }).accounts_run, false);
  // Contas terminadas antes do fim da carga não cobrem o que ela trouxe.
  assert.equal(ok({ ...base, accountsRun: { ...base.accountsRun, finished_at: '2026-11-21T10:00:30Z' } }).accounts_run, false);
  assert.equal(ok({ ...base, accountsRun: { ...base.accountsRun, finished_at: null } }).accounts_run, false);
});

test('código de evidência: estável, independe da ordem das chaves e muda com o conteúdo', () => {
  const a = evidenceCode({ x: 1, y: [1, { b: 2, a: 1 }] });
  assert.match(a, /^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/);
  assert.equal(evidenceCode({ y: [1, { a: 1, b: 2 }], x: 1 }), a);
  assert.notEqual(evidenceCode({ x: 1, y: [1, { a: 1, b: 3 }] }), a);
});

test('instante de referência', () => {
  assert.equal(parseReferenceInstant(undefined), null);
  assert.equal(parseReferenceInstant('2026-11-25'), '2026-11-25 23:59:00 America/Sao_Paulo');
  assert.equal(parseReferenceInstant('2026-11-25 20:30'), '2026-11-25 20:30:00 America/Sao_Paulo');
  assert.equal(parseReferenceInstant('2026-11-25T23:00:00Z'), '2026-11-25T23:00:00Z');
  assert.equal(parseReferenceInstant('2026-11-25T23:00:00-03:00'), '2026-11-25T23:00:00-03:00');
  assert.throws(() => parseReferenceInstant('ontem'), /--at precisa/);
  assert.throws(() => parseReferenceInstant('2026-11-25T23:00:00'), /--at precisa/);
  assert.throws(() => parseReferenceInstant("2026-11-25'; DROP"), /--at precisa/);
});

test('relatório: resultado, evidência, conferência manual e diferenças esperadas do E2.10', () => {
  const checks = classify([
    { kind: 'compared', code: 'member_missing', data: { n: 2 } },
    { kind: 'diff', code: 'member_missing', lid: 7, detail: null, expected: null },
    { kind: 'item', code: 'sample_member', lid: 3, ref: 'u' },
  ], docSets({}));
  const md = renderMarkdown({
    header: { date: '2026-11-27', generatedAt: 'x', toolCommit: 'abc', destination: 'local', copy: '#1', load: '#1',
      accounts: '#1', at: '27/11/2026 21:00', pastorIds: [1], adminIds: [2], timings: '1 s' },
    checks, summary: summarize(checks), evidence: 'AAAA-BBBB-CCCC-DDDD', legacyUrl: 'https://legado.invalid',
  });
  assert.match(md, /REPROVADA/);
  assert.match(md, /AAAA-BBBB-CCCC-DDDD/);
  assert.match(md, /\[7\]\(https:\/\/legado\.invalid\/members\/7\)/);
  assert.match(md, /Conferência manual \(E5\.04 e E5\.05\)/);
  assert.match(md, /filtro G12 do novo inclui a célula do próprio G12/);
  assert.match(md, /mostra 3 relatórios, e o legado mostrava até 10/);
  assert.match(md, /\[3\]\(https:\/\/legado\.invalid\/members\/3\)/);
});

test('linha de comando: só leitura (sem --yes) e argumentos validados antes de conectar', () => {
  const run = (...a) => spawnSync(process.execPath, ['src/reconcile.mjs', ...a], { cwd: MIGRATION_ROOT, encoding: 'utf8' });
  const yes = run('--yes');
  assert.equal(yes.status, 1);
  assert.match(yes.stderr, /--yes/);
  const bad = run('--config', '/nao/existe');
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /não encontrado/);
});

test('amostra de credenciais: 1 a 100000 ou "all", nunca 0; lotes de até CREDENTIAL_BATCH', () => {
  assert.equal(parseCredentialSample(undefined), 20);
  assert.equal(parseCredentialSample('500'), 500);
  assert.equal(parseCredentialSample('ALL'), 'all');
  for (const bad of ['0', '-1', '1.5', 'x', '100001', '']) assert.throws(() => parseCredentialSample(bad), /--credential-sample/);
  assert.ok(CREDENTIAL_BATCH <= 50);
  const ids = Array.from({ length: 101 }, (_, i) => i + 1);
  const b = credentialBatches(ids);
  assert.equal(b.length, Math.ceil(101 / CREDENTIAL_BATCH));
  assert.ok(b.every((x) => x.length <= CREDENTIAL_BATCH));
  assert.deepEqual(b.flat(), ids);
  assert.deepEqual(credentialBatches([]), []);
});

test('amostra de credenciais com zero comparados: atenção, não ok', () => {
  const checks = classify([{ kind: 'compared', code: 'credential_hash_mismatch', data: { n: 0 } }], docSets({}));
  const c = checks.find((x) => x.code === 'credential_hash_mismatch');
  assert.equal(c.status, 'atencao');
  assert.ok(summarize(checks).attention >= 1);
  const one = classify([{ kind: 'compared', code: 'credential_hash_mismatch', data: { n: 3 } }], docSets({}));
  assert.equal(one.find((x) => x.code === 'credential_hash_mismatch').status, 'ok');
});
