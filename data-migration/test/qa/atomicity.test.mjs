// QA E4 PR 2: a carga é tudo ou nada, e convive com gravações pela API (trava EXCLUSIVE).
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { legacy, load, loadAsync, resetDest, waitSleeping, fingerprint, integrity, q, pg, M, C, R, ADMINS } from './harness.mjs';

const base = () => ({
  members: [M(1, { Name: 'Pastor Um', Gender: 0 }), M(2, { LeadershipId: 1 }), M(3, { LeadershipId: 1 }), M(4, { LeadershipId: 2 })],
  cells: [C(1, { LeadId: 2, TimothyId: 3, HostId: 4 })],
  reports: [R(1, { LeadershipId: 2, TimothyId: 3, HostId: 4 })],
  participants: [[2, 1], [3, 1], [4, 1]],
});

const dropTrap = () => q(`DROP TRIGGER IF EXISTS qa_trap ON public.cell_report_participants; DROP FUNCTION IF EXISTS public.qa_trap()`);
async function setTrap(body) {
  await q(`CREATE FUNCTION public.qa_trap() RETURNS trigger LANGUAGE plpgsql AS $f$ BEGIN ${body} RETURN NEW; END $f$`);
  await q(`CREATE TRIGGER qa_trap BEFORE INSERT ON public.cell_report_participants FOR EACH ROW EXECUTE FUNCTION public.qa_trap()`);
  await q(`ALTER TABLE public.cell_report_participants ENABLE ALWAYS TRIGGER qa_trap`);
}

beforeEach(async () => { await dropTrap(); resetDest(); });
afterEach(async () => { await dropTrap(); });

describe('Atomicidade: falha depois da gravação não deixa nada', () => {
  test('erro levantado na gravação dos participantes (já gravou membros, células e relatórios) desfaz tudo, de um destino vazio', async () => {
    legacy(base());
    const before = await fingerprint();
    await setTrap(`RAISE EXCEPTION 'qa: falha injetada';`);
    const r = load(ADMINS);
    assert.notEqual(r.status, 0);
    assert.match(r.out, /qa: falha injetada/);
    assert.deepEqual(await fingerprint(), before);
    assert.equal(before.control, 'false/false', 'as tabelas de controle também não ficam');
    await dropTrap();
    assert.equal(load(ADMINS).status, 0, 'a carga seguinte funciona');
    assert.deepEqual(await integrity(), { drift: 0, periods: 0, member_rules: 0, cell_rules: 0, defaults: 1 });
  });

  test('erro na gravação de uma segunda carga (com carga anterior) deixa o destino da primeira, byte a byte', async () => {
    legacy(base());
    assert.equal(load(ADMINS).status, 0);
    const before = await fingerprint();
    const b = base();
    b.members[3] = M(4, { LeadershipId: 2, Name: 'Renomeado Quatro' });
    b.participants.push([1, 1]);
    legacy(b);
    await setTrap(`RAISE EXCEPTION 'qa: falha injetada 2';`);
    const r = load(ADMINS);
    assert.notEqual(r.status, 0);
    assert.match(r.out, /falha injetada 2/);
    assert.deepEqual(await fingerprint(), before, 'nada mudou (nem o nome regravado)');
    const [n] = await q(`SELECT name FROM public.members WHERE legacy_id = 4`);
    assert.notEqual(n.name, 'Renomeado Quatro');
  });

  test('conexão do servidor derrubada (pg_terminate_backend) no meio da gravação não deixa nada', async () => {
    legacy(base());
    const before = await fingerprint();
    await setTrap(`PERFORM pg_sleep(30);`);
    const { done } = loadAsync(ADMINS);
    const pid = await waitSleeping();
    assert.ok(pid, 'a carga chegou à gravação dos participantes');
    // Neste ponto membros, células e relatórios já foram gravados dentro da transação.
    await q('SELECT pg_terminate_backend($1)', [pid]);
    const r = await done;
    assert.notEqual(r.status, 0);
    assert.doesNotMatch(r.out, /TypeError|Cannot read|undefined/, 'erro legível, não pilha interna');
    assert.deepEqual(await fingerprint(), before);
    await dropTrap();
    assert.equal(load(ADMINS).status, 0);
  });

  test('processo da carga morto (SIGKILL) no meio da gravação: o servidor desfaz', async () => {
    legacy(base());
    const before = await fingerprint();
    await setTrap(`PERFORM pg_sleep(5);`);
    const { child, done } = loadAsync(ADMINS);
    assert.ok(await waitSleeping());
    child.kill('SIGKILL');
    await done;
    // o servidor percebe a queda quando o pg_sleep volta
    for (let i = 0; i < 100; i += 1) {
      const [x] = await q(`SELECT count(*)::int AS n FROM pg_stat_activity WHERE wait_event = 'PgSleep'`);
      if (!x.n) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    assert.deepEqual(await fingerprint(), before);
    await dropTrap();
    assert.equal(load(ADMINS).status, 0);
  });

  test('validação que falha (DT-10: regra do cadastro violada depois da gravação) desfaz tudo', async () => {
    legacy(base());
    const before = await fingerprint();
    // Depois da gravação dos participantes, o anfitrião da célula passa a excluído (replica não confere): cell_rule_violations.
    await setTrap(`UPDATE public.members SET deleted_at = now(), deleted_by_kind = 'unknown' WHERE legacy_id = 4;`);
    const r = load(ADMINS);
    assert.notEqual(r.status, 0, r.out);
    assert.match(r.out, /Validação \(DT-10\) falhou; nada foi gravado/);
    assert.match(r.out, /cell_rule_violations|member_hierarchy_drift/);
    assert.deepEqual(await fingerprint(), before);
  });
});

describe('Concorrência com gravações pela API', () => {
  test('gravação aberta pela API (transação não confirmada em members) faz a carga esperar 5 s e falhar sem deixar nada', async () => {
    legacy(base());
    const api = await pg();
    try {
      await api.query('BEGIN');
      await api.query(`INSERT INTO public.members (id, name, email, gender, is_pastor, has_leadership, role_id)
        VALUES (gen_random_uuid(), 'Novo Pela Api', 'api@exemplo.org', 'M', false, false, (SELECT id FROM public.roles WHERE is_default))`);
      const before = await fingerprint();
      const t0 = Date.now();
      const r = load(ADMINS);
      const dt = Date.now() - t0;
      assert.notEqual(r.status, 0);
      assert.match(r.out, /lock|bloque|travad|timeout/i, r.out);
      assert.ok(dt >= 4500 && dt < 20000, `esperou o lock_timeout (${dt} ms)`);
      assert.doesNotMatch(r.out, /api@exemplo|Novo Pela Api/, 'sem dado pessoal na saída');
      assert.deepEqual(await fingerprint(), before);
      await api.query('COMMIT');
    } finally { await api.end(); }
    assert.equal(load(ADMINS).status, 0, 'depois do commit da API a carga roda');
    assert.deepEqual(await integrity(), { drift: 0, periods: 0, member_rules: 0, cell_rules: 0, defaults: 1 });
  });

  test('durante a carga (trava EXCLUSIVE) a leitura continua e a gravação da API espera o commit, sem perder nem duplicar', async () => {
    legacy(base());
    await setTrap(`PERFORM pg_sleep(4);`);
    const { done } = loadAsync(ADMINS);
    assert.ok(await waitSleeping());
    const t0 = Date.now();
    const [rd] = await q('SELECT count(*)::int AS n FROM public.members');
    assert.ok(Date.now() - t0 < 1500, 'a leitura não espera a carga');
    assert.equal(rd.n, 0, 'a leitura vê o estado de antes da carga (nada parcial)');
    const api = await pg();
    let apiMs;
    try {
      const t1 = Date.now();
      await api.query(`INSERT INTO public.members (id, name, email, gender, is_pastor, has_leadership, role_id)
        VALUES (gen_random_uuid(), 'Novo Durante Carga', 'durante@exemplo.org', 'F', false, false, (SELECT id FROM public.roles WHERE is_default))`);
      apiMs = Date.now() - t1;
    } finally { await api.end(); }
    const r = await done;
    assert.equal(r.status, 0, r.out);
    assert.ok(apiMs >= 1500, `a gravação esperou a carga (${apiMs} ms)`);
    const [n] = await q(`SELECT count(*)::int AS n FROM public.members WHERE legacy_id IS NULL`);
    assert.equal(n.n, 1);
    assert.deepEqual(await integrity(), { drift: 0, periods: 0, member_rules: 0, cell_rules: 0, defaults: 1 });
  });

  test('duas cargas ao mesmo tempo: uma termina e a outra falha com mensagem do banco (sem estado parcial)', async () => {
    legacy(base());
    for (let round = 0; round < 3; round += 1) {
      resetDest();
      const a = loadAsync(ADMINS); const b = loadAsync(ADMINS);
      const [ra, rb] = await Promise.all([a.done, b.done]);
      const ok = [ra, rb].filter((x) => x.status === 0).length;
      assert.ok(ok >= 1, `ao menos uma carga termina (rodada ${round}): ${ra.out}\n---\n${rb.out}`);
      for (const x of [ra, rb].filter((y) => y.status !== 0)) {
        assert.doesNotMatch(x.out, /TypeError|Cannot read/, 'erro legível');
        console.log(`  (rodada ${round}) a outra carga falhou com: ${x.out.split('\n').filter((l) => /ERRO|Erro|erro/.test(l)).slice(0, 2).join(' | ')}`);
      }
      assert.deepEqual(await integrity(), { drift: 0, periods: 0, member_rules: 0, cell_rules: 0, defaults: 1 });
      const [n] = await q('SELECT count(*)::int AS n FROM public.members WHERE legacy_id IS NOT NULL');
      assert.equal(n.n, 4);
    }
  });
});
