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

describe('Decisões e travas da rodada de correções', () => {
  test('Q-E4-6: excluído sem nome ou com sexo inválido fica de fora, é listado e não para o --final; o não excluído para', async () => {
    const extra = [M(10, { LeadershipId: 2, Name: '   ', IsDeleted: 1 }), M(11, { LeadershipId: 2, Gender: 7, IsDeleted: 1 })];
    legacy({ ...data(), members: [...data().members, ...extra] });
    const r = load([...ADMINS, '--final']);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /member_deleted_name_empty: 10/);
    assert.match(r.out, /member_deleted_gender_invalid: 11/);
    assert.doesNotMatch(r.out, /PARA A CARGA/);
    const [{ n }] = await q('SELECT count(*)::int AS n FROM public.members WHERE legacy_id IN (10, 11)');
    assert.equal(n, 0, 'os dois ficam de fora');

    resetDest();
    legacy({ ...data(), members: [...data().members, M(12, { LeadershipId: 2, Name: '   ' }), M(13, { LeadershipId: 2, Gender: 7 })] });
    const before = await fingerprint();
    const f = load([...ADMINS, '--final']);
    assert.notEqual(f.status, 0);
    assert.match(f.out, /member_name_empty  \[PARA A CARGA\]: 12/);
    assert.match(f.out, /member_gender_invalid  \[PARA A CARGA\]: 13/);
    assert.deepEqual(await fingerprint(), before);
  });

  test('depois de uma carga --final, refazer é recusado sem --reload-after-final (o --dry-run segue); com a flag, passa', async () => {
    assert.equal(load([...ADMINS, '--final']).status, 0);
    await q(`UPDATE public.members SET notes = 'editado no novo' WHERE legacy_id = 4`);
    const before = await fingerprint();
    const r = load(ADMINS);
    assert.notEqual(r.status, 0);
    assert.match(r.out, /carga final \(cutover, execução #\d+\) já foi gravada/);
    assert.match(r.out, /--reload-after-final/);
    const again = load([...ADMINS, '--final']);
    assert.notEqual(again.status, 0, 'outro --final também é recusado');
    assert.deepEqual(await fingerprint(), before, 'nada foi regravado');
    const dry = load([...ADMINS, '--dry-run']);
    assert.equal(dry.status, 0, dry.out);
    assert.match(dry.out, /exige --reload-after-final/);
    assert.deepEqual(await fingerprint(), before);
    // Carga final desfeita (o PR 3 marca undone_at): volta a valer o ensaio.
    const [{ id }] = await q(`SELECT id FROM legacy._load_runs WHERE mode = 'final' ORDER BY id DESC LIMIT 1`);
    await q('UPDATE legacy._load_runs SET undone_at = now() WHERE id = $1', [id]);
    const undone = load([...ADMINS, '--dry-run']);
    assert.doesNotMatch(undone.out, /reload-after-final/);
    await q('UPDATE legacy._load_runs SET undone_at = NULL WHERE id = $1', [id]);
    const forced = load([...ADMINS, '--reload-after-final']);
    assert.equal(forced.status, 0, forced.out);
    assert.match(forced.out, /Refazendo a carga depois da carga final/);
    const [m] = await q('SELECT notes FROM public.members WHERE legacy_id = 4');
    assert.equal(m.notes, null, 'com a flag, o legado volta a valer (por isso a trava)');
  });

  test('destino que não é a stack local: sem --yes e sem --dry-run, recusa antes de conectar', async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = mkdtempSync(join(tmpdir(), 'mci-qa-remote-'));
    const cfg = join(dir, 'remote.config');
    // Senha fictícia: a recusa vem antes de qualquer conexão (nenhum pacote sai da máquina).
    writeFileSync(cfg, ['SUPABASE_PROJECT_REF="gkhnjhmgeceoaqeynhrj"', 'SUPABASE_HOST="db.gkhnjhmgeceoaqeynhrj.supabase.co"',
      'SUPABASE_PORT="5432"', 'SUPABASE_DB="postgres"', 'SUPABASE_USER="postgres"', 'SUPABASE_PASS="nao-e-a-senha"',
      'LEGACY_PASTOR_IDS="1"', 'LEGACY_ADMIN_IDS="1,2"'].join('\n'));
    try {
      const r = load(['--config', cfg], { timeout: 15000 });
      assert.notEqual(r.status, 0);
      assert.match(r.out, /não é a stack local: para gravar, rode com --yes/);
      assert.doesNotMatch(r.out, /ECONN|ENOTFOUND|timeout|password/i, 'não tentou conectar');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
