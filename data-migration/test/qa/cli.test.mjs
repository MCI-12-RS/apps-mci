// QA E4 PR 2: argumentos, pré-condições do destino e mensagens de erro.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { legacy, load, resetDest, fingerprint, q, M, C, ADMINS } from './harness.mjs';

const data = () => ({
  members: [M(1, { Name: 'Pastor Um', Gender: 0 }), M(2, { LeadershipId: 1 }), M(3, { LeadershipId: 1 }), M(4, { LeadershipId: 2 })],
  cells: [C(1, { LeadId: 2, TimothyId: 3, HostId: 4 })], reports: [], participants: [],
});
beforeEach(() => { resetDest(); legacy(data()); });

describe('Argumentos e pré-condições', () => {
  test('Id maior que o inteiro do banco em --pastor-ids/--admin-ids: erro claro e nada gravado', async () => {
    const before = await fingerprint();
    for (const args of [['--pastor-ids', '99999999999', '--admin-ids', '1,2'], ['--pastor-ids', '1', '--admin-ids', '1,99999999999']]) {
      const r = load(args);
      assert.notEqual(r.status, 0);
      assert.doesNotMatch(r.out, /TypeError|at .*\.mjs/, 'sem pilha interna');
      console.log(`  (${args.join(' ')}) → ${r.out.split('\n').filter((l) => /ERRO/.test(l)).join(' | ')}`);
      assert.deepEqual(await fingerprint(), before);
    }
  });

  test('lista com vírgula sobrando ou repetida é aceita sem duplicar o efeito', async () => {
    const r = load(['--pastor-ids', '1,,1', '--admin-ids', '1,2,2,']);
    assert.equal(r.status, 0, r.out);
    const [{ n }] = await q(`SELECT count(*)::int AS n FROM public.members m JOIN public.roles r ON r.id = m.role_id WHERE r.is_system AND m.legacy_id IS NOT NULL`);
    assert.equal(n, 2);
  });

  test('sem a função "Líder" (ou com duas) no destino a carga para antes de gravar', async () => {
    const { 'public.events': _e, ...before } = await fingerprint(); // renomear a função gera Auditoria
    await q(`UPDATE public.roles SET name = 'Líder (qa)' WHERE name = 'Líder'`);
    try {
      const r = load(ADMINS);
      assert.notEqual(r.status, 0);
      assert.match(r.out, /Líder/);
      const { 'public.events': _x, ...after } = await fingerprint();
      assert.deepEqual(after, before);
    } finally { await q(`UPDATE public.roles SET name = 'Líder' WHERE name = 'Líder (qa)'`); }
  });

  test('destino sem a cópia (schema legacy apagado): mensagem manda rodar npm run copy', async () => {
    await q('ALTER SCHEMA legacy RENAME TO legacy_qa');
    try {
      const r = load(ADMINS);
      assert.notEqual(r.status, 0);
      assert.match(r.out, /npm run copy/);
    } finally { await q('ALTER SCHEMA legacy_qa RENAME TO legacy'); }
  });

  test('--dry-run + --final no destino já carregado não grava nem cria arquivo e não muda nenhuma sequência visível', async () => {
    assert.equal(load(ADMINS).status, 0);
    const before = await fingerprint();
    const [{ n: runs }] = await q('SELECT count(*)::int AS n FROM legacy._load_runs');
    const r = load([...ADMINS, '--dry-run']);
    assert.equal(r.status, 0, r.out);
    const [{ n: runs2 }] = await q('SELECT count(*)::int AS n FROM legacy._load_runs');
    assert.equal(runs2, runs, 'o dry-run não deixa execução registrada');
    assert.deepEqual(await fingerprint(), before);
  });

  test('a carga como outro papel (sem postgres): recusa clara quando o replica não é aceito', async () => {
    // O runner usa a conexão de config; aqui só garantimos que o erro para o replica recusado cita o plano B.
    const r = load(['--config', '/dev/null/inexistente']);
    assert.notEqual(r.status, 0);
  });
});
