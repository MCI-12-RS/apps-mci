// QA E4 PR 3: `npm run unload` (limpeza do ensaio da carga, DT-13). Foco: nunca apagar o que não devia e
// sempre voltar ao estado de antes. O teste principal é um oráculo: o mesmo mundo é montado duas vezes, uma
// sem carga e outra com carga + contas + ensaio + limpeza, e os dois retratos (normalizados) têm de ser iguais.
// Só dados fictícios e só a stack local da pista B.
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { legacy, load, M, C, R, ADMINS, q, pg, rest, jwt, waitSleeping, userToken } from './harness.mjs';
import {
  ctx, setup, teardown, clean, unload, accounts, U, addMember, addCell, addReport, mid, cid,
  normSnap, rawSnap, diffSnap, problems, CLEAN_STATE, LEAKS, hasPii, delMember, restoreMember, tokenFor,
  unloadAsync, loadNode, accountsAsync,
} from './unload-helpers.mjs';

before(() => setup());
after(async () => { try { await clean(); } catch { /* o run-qa.sh limpa de novo */ } teardown(); });
beforeEach(() => clean());

const legacyData = () => ({
  members: [
    M(1, { Name: 'Pastor Um', Gender: 0 }), M(2, { LeadershipId: 1 }), M(3, { LeadershipId: 1 }),
    M(4, { LeadershipId: 2, SpouseId: 5 }), M(5, { LeadershipId: 3, SpouseId: 4 }), M(6, { LeadershipId: 4 }),
    M(7, { LeadershipId: 6 }), M(8, { LeadershipId: 6, IsDeleted: 1 }),
  ],
  cells: [C(1, { LeadId: 2, TimothyId: 4, HostId: 5 }), C(2, { LeadId: 4, TimothyId: 6, HostId: 7, WeekDay: 6, Time: '09:30' })],
  reports: [
    R(1, { CellId: 1, Date: '2026-10-07 20:00:00', LeadershipId: 2, TimothyId: 4, HostId: 5 }),
    R(2, { CellId: 2, Date: '2026-10-10 09:30:00', LeadershipId: 4, TimothyId: 6, HostId: 7 }),
  ],
  participants: [[2, 1], [4, 1], [5, 1], [4, 2], [6, 2], [7, 2]],
});
const ID = {
  P0: U(1), G1: U(2), G2: U(3), S1: U(4), S2: U(5), X: U(6), CP: U(100), RP: U(200),
  I1: U(10), I2: U(11), I3: U(12), I4: U(13), CI: U(101), RI: U(201), RI2: U(202),
};

/** Cadastros do novo anteriores a qualquer carga. */
async function seedPre() {
  await addMember(ID.P0, { name: 'Pastor Zero Novo', pastor: true, account: true, admin: true });
  await addMember(ID.G1, { leader: ID.P0, account: true });
  await addMember(ID.G2, { leader: ID.G1 });
  await addMember(ID.S1, { leader: ID.P0, gender: 'M' });
  await addMember(ID.S2, { leader: ID.P0, gender: 'F', spouse: ID.S1 });
  await addMember(ID.X, { leader: ID.G2, deleted: true });
  await addCell(ID.CP, ID.G1, ID.G2, ID.S1);
  await addReport(ID.RP, ID.CP, '2026-10-07', [ID.G1, ID.G2, ID.S1, ID.S2]);
}
/** O que o app cria DEPOIS de começar a carga e que não depende dela (fica). */
async function seedIndependents() {
  await addMember(ID.I1, { leader: ID.G2, account: true });
  await addMember(ID.I2, { leader: ID.I1, gender: 'F' });
  await addMember(ID.I3, { pastor: true });
  await addCell(ID.CI, ID.I1, ID.I2, ID.G2, 'Terça', '20:00');
  await addReport(ID.RI, ID.CP, '2026-10-14', [ID.G1, ID.G2, ID.S1, ID.I1]);
  await addReport(ID.RI2, ID.CI, '2026-10-14', [ID.I1, ID.I2, ID.G2]);
  await q(`UPDATE public.members SET name = 'Editado Ensaio Teste' WHERE id = $1`, [ID.G2]);
}
/** O que o ensaio cria em cima da carga (sai com ela): cadeia de 30, célula, relatórios, participante em relatório que fica, cônjuge cruzado. */
async function seedDependents() {
  const l6 = await mid(6); const l7 = await mid(7);
  let prev = l6; let first;
  for (let i = 0; i < 30; i += 1) {
    const id = U(1000 + i);
    await addMember(id, { leader: prev, account: i === 0 });
    prev = id; first ??= id;
  }
  await addCell(U(1100), first, l7, ID.G2, 'Quarta', '21:00');
  await addCell(U(1101), prev, first, l7, 'Sexta', '21:00'); // líder no fim da cadeia longa
  await addReport(U(1200), U(1100), '2026-10-21', [first, l7, ID.G2]);
  await addReport(U(1201), await cid(1), '2026-10-21', [await mid(2), await mid(4), await mid(5), first]);
  // relatório que fica (independente) com um participante da carga e outro do ensaio
  await q('INSERT INTO public.cell_report_participants (report_id, member_id) VALUES ($1, $2), ($1, $3)', [ID.RI, l7, first]).catch(async () => {
    const c = await pg();
    try { await c.query('BEGIN'); await c.query(`SET LOCAL mci.cell_report_write = 'on'`);
      await c.query('INSERT INTO public.cell_report_participants (report_id, member_id) VALUES ($1, $2), ($1, $3)', [ID.RI, l7, first]);
      await c.query('COMMIT'); } finally { await c.end(); }
  });
  // cônjuge cruzado: o independente I2 (F) casa com um carregado (M)
  await q('UPDATE public.members SET spouse_id = $2 WHERE id = $1', [ID.I2, await mid(7)]);
}

async function worldWithoutLoad() {
  await clean();
  await seedPre();
  await seedIndependents();
  await addMember(ID.I4, { leader: ID.P0 });
  // o ensaio tocou o I2 (cônjuge cruzado que a limpeza desfaz): o carimbo de alteração fica, como deve
  await q(`UPDATE public.members SET is_baptized = true WHERE id = $1`, [ID.I2]);
  await q(`UPDATE public.members SET is_baptized = false WHERE id = $1`, [ID.I2]);
  return normSnap();
}

describe('Oráculo: carga, contas, ensaio e limpeza = o mesmo mundo sem carga', () => {
  test('o destino volta ao estado de antes, com o que o app criou de independente intacto, por três ciclos', async () => {
    const expected = await worldWithoutLoad();
    await clean();
    await seedPre();
    for (let cycle = 1; cycle <= 3; cycle += 1) {
      legacy(legacyData());
      assert.equal(load(ADMINS).status, 0);
      const a = accounts();
      assert.equal(a.status, 0, a.out);
      if (cycle === 1) { await seedIndependents(); } else { await q('SELECT 1'); }
      await seedDependents().catch((e) => { throw new Error(`ensaio (ciclo ${cycle}): ${e.message}`); });
      const before = await rawSnap();
      const dry = unload(['--dry-run']);
      assert.equal(dry.status, 0, dry.out);
      assert.deepEqual(diffSnap(before, await rawSnap()), {}, '--dry-run não pode mudar nada');
      const real = unload();
      assert.equal(real.status, 0, real.out);
      const sai = (t) => /^Sai: .*$/m.exec(t)?.[0];
      assert.equal(sai(real.out), sai(dry.out), 'o dry-run mostra o que a execução real faz');
      assert.match(real.out, /participant_removed_from_kept_report/);
      assert.match(real.out, /spouse_unlinked/);
      assert.deepEqual(await problems(), CLEAN_STATE, `ciclo ${cycle}`);
      if (cycle === 1) {
        // do segundo ciclo em diante o mundo já tem os independentes: compara com o oráculo depois do último
      }
      if (cycle < 3) {
        if (cycle === 1) await q('SELECT 1');
      }
      if (cycle === 3) {
        await addMember(ID.I4, { leader: ID.P0 });
        assert.deepEqual(diffSnap(expected, await normSnap()), {}, 'o destino não é o mesmo mundo sem a carga');
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------------------
// Adotados (cadastros do novo que a carga adotou) e o que o ensaio fez com eles.
const AD = { A1: U(50), S3: U(51), A2: U(52), A3: U(53), C1: U(60), N1: U(61) };
const adoptData = (extra = []) => {
  const d = legacyData();
  d.members.push(
    M(20, { LeadershipId: 2, Email: 'adota20@exemplo.org' }), M(21, { LeadershipId: 2, Email: 'adota21@exemplo.org' }),
    M(22, { LeadershipId: 3, Email: 'adota22@exemplo.org' }), ...extra);
  return d;
};
async function seedAdoptable() {
  await seedPre();
  await addMember(AD.A1, { name: 'Adotado Vinte Novo', email: 'adota20@exemplo.org', leader: ID.P0, account: true, spouse: undefined });
  await addMember(AD.S3, { leader: ID.P0, gender: 'F' });
  await q('UPDATE public.members SET spouse_id = $2 WHERE id = $1', [AD.A1, AD.S3]);
  await addMember(AD.A2, { name: 'Adotado Vinte Um Novo', email: 'adota21@exemplo.org', leader: ID.G1 });
  await addMember(AD.A3, { name: 'Adotado Vinte Dois Novo', email: 'adota22@exemplo.org', leader: ID.G2, account: true });
}

describe('Adotados voltam à linha de antes', () => {
  test('adotado com conta, sem conta, excluído e excluído-e-restaurado no ensaio; filho do adotado criado no ensaio fica; igual ao mundo sem carga', async () => {
    // Oráculo: o mesmo mundo, sem carga (o filho do A1 existe nele; o A3 não é excluído; o A2 foi excluído e restaurado)
    await seedAdoptable();
    await addMember(AD.C1, { leader: AD.A1 });
    const expected = await normSnap();

    await clean();
    await seedAdoptable();
    legacy(adoptData());
    assert.equal(load(ADMINS).status, 0);
    const [adopted] = await q('SELECT count(*)::int AS n FROM legacy._load_adopted');
    assert.equal(adopted.n, 3, 'os três foram adotados');
    assert.equal(accounts().status, 0);
    const [acc] = await q(`SELECT count(*)::int AS n FROM public.members m JOIN auth.users u ON u.id = m.auth_user_id
                            WHERE m.id = $1 AND u.raw_app_meta_data ? 'legacy_member_id'`, [AD.A2]);
    assert.equal(acc.n, 1, 'o adotado sem conta ganhou conta da carga (PR4-3)');
    // ensaio
    await q(`UPDATE public.members SET name = 'Editado Adotado Teste' WHERE id = $1`, [AD.A1]);
    await addMember(AD.C1, { leader: AD.A1 });
    await delMember(AD.A3);
    await delMember(AD.A2); await restoreMember(AD.A2);
    const dry = unload(['--dry-run']);
    assert.equal(dry.status, 0, dry.out);
    assert.match(dry.out, /adopted_restored/);
    const real = unload();
    assert.equal(real.status, 0, real.out);
    assert.deepEqual(await problems(), CLEAN_STATE);
    const diff = diffSnap(expected, await normSnap());
    // O A3 foi excluído no ensaio e NÃO restaurado: a limpeza o devolve como era antes (não excluído, conta ativa).
    assert.deepEqual(diff, {});
    const [r] = await q(`SELECT (SELECT count(*) FROM private.member_access_suspensions)::int AS susp,
        (SELECT count(*) FROM auth.users WHERE banned_until IS NOT NULL)::int AS banned,
        (SELECT count(*) FROM legacy._load_adopted)::int AS ad`);
    assert.deepEqual(r, { susp: 0, banned: 0, ad: 0 });
    // Idempotente: repetir não muda nada
    const snap = await rawSnap();
    const again = unload();
    assert.equal(again.status, 0, again.out);
    assert.match(again.out, /Nada a desfazer/);
    assert.deepEqual(diffSnap(snap, await rawSnap()), {});
  });

  test('adotado criado no ensaio debaixo da carga e adotado numa carga posterior (PR3-3) sai com o ensaio', async () => {
    await seedPre();
    legacy(adoptData());
    assert.equal(load(ADMINS).status, 0);
    // ensaio: cadastro do novo debaixo de um carregado
    await addMember(AD.N1, { name: 'Criado No Ensaio Novo', email: 'tarde23@exemplo.org', leader: await mid(6) });
    // o legado ganha o mesmo e-mail: a próxima carga o adota
    legacy(adoptData([M(23, { LeadershipId: 6, Email: 'tarde23@exemplo.org' })]));
    assert.equal(load(ADMINS).status, 0);
    const [a] = await q('SELECT legacy_id FROM public.members WHERE id = $1', [AD.N1]);
    assert.equal(a.legacy_id, 23, 'foi adotado pela segunda carga');
    const real = unload();
    assert.equal(real.status, 0, real.out);
    const [gone] = await q('SELECT count(*)::int AS n FROM public.members WHERE id = $1', [AD.N1]);
    assert.equal(gone.n, 0, 'o adotado que o ensaio criou debaixo da carga sai com o ensaio');
    assert.deepEqual(await problems(), CLEAN_STATE);
  });
});

describe('Bloqueios: nada é apagado e, resolvido o bloqueio, a limpeza completa', () => {
  test('adopted_identifier_taken: o e-mail de antes do adotado foi usado por outro cadastro no ensaio', async () => {
    await seedPre();
    await addMember(AD.A1, { name: 'Adotado Cpf Novo', email: 'antigo20@novo.test', cpf: '52998224725', leader: ID.P0 });
    legacy(adoptData([M(24, { LeadershipId: 2, Email: 'novo24@exemplo.org', CPF: '529.982.247-25' })]));
    assert.equal(load(ADMINS).status, 0);
    const [m] = await q('SELECT email, legacy_id FROM public.members WHERE id = $1', [AD.A1]);
    assert.equal(m.legacy_id, 24);
    assert.notEqual(m.email, 'antigo20@novo.test', 'a carga trocou o e-mail do adotado');
    await addMember(AD.N1, { email: 'antigo20@novo.test', leader: ID.G1 }); // o ensaio ocupou o e-mail de antes
    const before = await rawSnap();
    const r = unload();
    assert.notEqual(r.status, 0, r.out);
    assert.match(r.out, /adopted_identifier_taken/);
    assert.deepEqual(diffSnap(before, await rawSnap()), {}, 'bloqueio não pode apagar nada');
    // o --dry-run também mostra o bloqueio e não muda nada
    const d = unload(['--dry-run']);
    assert.notEqual(d.status, 0);
    assert.deepEqual(diffSnap(before, await rawSnap()), {});
    // resolvido (o cadastro do ensaio troca de e-mail), a limpeza passa
    await q(`UPDATE public.members SET email = 'outro24@novo.test' WHERE id = $1`, [AD.N1]);
    const ok = unload();
    assert.equal(ok.status, 0, ok.out);
    const [back] = await q('SELECT email, legacy_id FROM public.members WHERE id = $1', [AD.A1]);
    assert.deepEqual(back, { email: 'antigo20@novo.test', legacy_id: null });
  });

  test('adopted_member_missing: o cadastro adotado foi apagado fisicamente', async () => {
    await seedPre();
    await addMember(AD.A1, { name: 'Adotado Sumido Novo', email: 'adota20@exemplo.org', leader: ID.P0 });
    legacy(adoptData());
    assert.equal(load(ADMINS).status, 0);
    const c = await pg();
    try {
      await c.query('BEGIN'); await c.query('SET LOCAL session_replication_role = replica');
      await c.query('DELETE FROM public.members WHERE id = $1', [AD.A1]); await c.query('COMMIT');
    } finally { await c.end(); }
    const before = await rawSnap();
    const r = unload();
    assert.notEqual(r.status, 0, r.out);
    assert.match(r.out, /adopted_member_missing/);
    assert.deepEqual(diffSnap(before, await rawSnap()), {}, 'nada apagado');
  });

  test('spouse_conflict: o cônjuge de antes do adotado casou no ensaio com outra pessoa', async () => {
    await seedPre();
    await addMember(AD.A1, { name: 'Adotado Casado Novo', email: 'adota20@exemplo.org', leader: ID.P0 });
    await addMember(AD.S3, { leader: ID.P0, gender: 'F' });
    await q('UPDATE public.members SET spouse_id = $2 WHERE id = $1', [AD.A1, AD.S3]);
    legacy(adoptData());
    assert.equal(load(ADMINS).status, 0);
    const [s] = await q('SELECT spouse_id FROM public.members WHERE id = $1', [AD.S3]);
    assert.equal(s.spouse_id, null, 'a carga desfez o vínculo do outro lado');
    await addMember(AD.N1, { leader: ID.P0, gender: 'M' });
    await q('UPDATE public.members SET spouse_id = $2 WHERE id = $1', [AD.S3, AD.N1]);
    const before = await rawSnap();
    const r = unload();
    assert.notEqual(r.status, 0, r.out);
    assert.match(r.out, /spouse_conflict/);
    assert.deepEqual(diffSnap(before, await rawSnap()), {});
    await q('UPDATE public.members SET spouse_id = NULL WHERE id IN ($1, $2)', [AD.S3, AD.N1]);
    const ok = unload();
    assert.equal(ok.status, 0, ok.out);
    const [a] = await q('SELECT spouse_id FROM public.members WHERE id = $1', [AD.A1]);
    assert.equal(a.spouse_id, AD.S3);
    const [b] = await q('SELECT spouse_id FROM public.members WHERE id = $1', [AD.S3]);
    assert.equal(b.spouse_id, AD.A1, 'o vínculo simétrico de antes foi refeito');
  });

  test('cadastro anterior à carga que passou a apontar para ela para a limpeza; criado depois é do ensaio e sai; movido para fora fica', async () => {
    await seedPre();
    legacy(legacyData());
    assert.equal(load(ADMINS).status, 0);
    const l6 = await mid(6);
    await addMember(AD.N1, { leader: l6 });          // criado no ensaio debaixo da carga: sai
    await addMember(AD.C1, { leader: l6 });          // criado no ensaio e depois movido para um líder de fora: fica
    await q('UPDATE public.members SET leader_id = $2 WHERE id = $1', [AD.C1, ID.G1]);
    await q('UPDATE public.members SET leader_id = $2 WHERE id = $1', [ID.S1, l6]); // anterior à carga e agora debaixo dela: bloqueia
    const before = await rawSnap();
    const r = unload();
    assert.notEqual(r.status, 0, r.out);
    assert.match(r.out, /member_points_to_removed/);
    assert.deepEqual(diffSnap(before, await rawSnap()), {});
    await q('UPDATE public.members SET leader_id = $2 WHERE id = $1', [ID.S1, ID.P0]);
    const ok = unload();
    assert.equal(ok.status, 0, ok.out);
    const rows = await q('SELECT id FROM public.members WHERE id = ANY($1::uuid[])', [[AD.N1, AD.C1]]);
    assert.deepEqual(rows.map((x) => x.id), [AD.C1]);
    assert.deepEqual(await problems(), CLEAN_STATE);
  });
});

// ---------------------------------------------------------------------------------------------------------
describe('Trava: limpeza, carga e contas não rodam juntas', () => {
  test('com uma limpeza dentro da transação, outra limpeza, a carga e as contas recusam sem mudar nada; depois a primeira termina', async () => {
    await seedPre();
    legacy(legacyData());
    assert.equal(load(ADMINS).status, 0);
    assert.equal(accounts().status, 0);
    await q(`CREATE OR REPLACE FUNCTION public.qa_unload_trap() RETURNS trigger LANGUAGE plpgsql AS $f$ BEGIN PERFORM pg_sleep(30); RETURN NEW; END $f$;
             CREATE TRIGGER qa_unload_trap BEFORE UPDATE ON legacy._load_runs FOR EACH ROW EXECUTE FUNCTION public.qa_unload_trap();
             ALTER TABLE legacy._load_runs ENABLE ALWAYS TRIGGER qa_unload_trap`);
    let first;
    try {
      first = unloadAsync();
      const pid = await waitSleeping(30000);
      assert.ok(pid, 'a primeira limpeza chegou ao meio da transação');
      const before = await rawSnap();
      const second = unload();
      assert.notEqual(second.status, 0, second.out);
      assert.match(second.out, /Outra carga, criação de contas ou limpeza está em andamento/);
      const dry = unload(['--dry-run']);
      assert.notEqual(dry.status, 0, 'nem o --dry-run entra');
      const ld = load(ADMINS);
      assert.notEqual(ld.status, 0, ld.out);
      const ac = accounts();
      assert.notEqual(ac.status, 0, ac.out);
      assert.match(ac.out, /andamento|Outra/i);
      assert.deepEqual(diffSnap(before, await rawSnap()), {}, 'as recusas não mudam nada');
      await q('SELECT pg_cancel_backend($1)', [pid]); // a primeira falha: tudo é desfeito
      const r1 = await first.done;
      assert.notEqual(r1.status, 0, r1.out);
      assert.deepEqual(diffSnap(before, await rawSnap()), {}, 'a transação cancelada desfaz tudo');
    } finally {
      first?.child.kill();
      await q(`DROP TRIGGER IF EXISTS qa_unload_trap ON legacy._load_runs; DROP FUNCTION IF EXISTS public.qa_unload_trap()`);
    }
    const ok = unload();
    assert.equal(ok.status, 0, ok.out);
    assert.deepEqual(await problems(), CLEAN_STATE);
  });
});

describe('Gravação do app em andamento', () => {
  test('uma gravação aberta na tabela de membros faz a limpeza desistir em 5 s sem apagar nada, e depois ela passa', async () => {
    await seedPre();
    legacy(legacyData());
    assert.equal(load(ADMINS).status, 0);
    assert.equal(accounts().status, 0);
    const before = await rawSnap();
    const app = await pg();
    try {
      await app.query('BEGIN');
      await app.query(`UPDATE public.members SET notes = 'em andamento' WHERE id = $1`, [ID.G2]);
      const t = Date.now();
      const r = unload();
      assert.notEqual(r.status, 0, r.out);
      assert.ok(Date.now() - t < 20000, 'desistiu pelo lock_timeout, sem ficar pendurada');
      assert.match(r.out, /lock timeout|travar|canceling statement/i);
    } finally { await app.query('ROLLBACK'); await app.end(); }
    assert.deepEqual(diffSnap(before, await rawSnap()), {});
    const ok = unload();
    assert.equal(ok.status, 0, ok.out);
    assert.deepEqual(await problems(), CLEAN_STATE);
  });
});

describe('Auth recusa uma conta no meio e a repetição completa', () => {
  test('o banco fica limpo, as contas de quem fica não são tocadas, as pendentes saem na repetição', async () => {
    await seedPre();
    legacy(legacyData());
    assert.equal(load(ADMINS).status, 0);
    assert.equal(accounts().status, 0);
    const kept = (await q(`SELECT id FROM auth.users WHERE NOT (raw_app_meta_data ? 'legacy_member_id') ORDER BY id`)).map((x) => x.id);
    assert.equal(kept.length, 2, 'as duas contas de antes da carga');
    const m5 = await mid(5);
    await q(`CREATE OR REPLACE FUNCTION public.qa_auth_trap() RETURNS trigger LANGUAGE plpgsql AS $f$ BEGIN
               IF OLD.id = '${m5}' THEN RAISE EXCEPTION 'qa: conta não apagada'; END IF; RETURN OLD; END $f$;
             CREATE TRIGGER qa_auth_trap BEFORE DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.qa_auth_trap()`);
    try {
      const r = unload(['--concurrency', '1']);
      assert.notEqual(r.status, 0, r.out);
      assert.match(r.out, /account_delete_failed/);
      const p = await problems();
      assert.deepEqual({ ...p, legacy_accounts: 0 }, CLEAN_STATE, 'o banco já está limpo');
      assert.equal(p.legacy_accounts, 1, 'só a conta recusada sobrou');
      const [u] = await q(`SELECT pending_accounts, status FROM legacy._unload_runs ORDER BY id DESC LIMIT 1`);
      assert.deepEqual(u.pending_accounts, [m5]);
      // uma nova carga + contas enquanto a conta antiga está pendente: o legacy_id da conta antiga bloqueia (não duplica)
      // (a limpeza completa antes de qualquer nova carga: aqui só conferimos a repetição)
    } finally {
      await q(`DROP TRIGGER IF EXISTS qa_auth_trap ON auth.users; DROP FUNCTION IF EXISTS public.qa_auth_trap()`);
    }
    const again = unload();
    assert.equal(again.status, 0, again.out);
    assert.match(again.out, /Contas no Auth: 1 apagadas/);
    assert.deepEqual(await problems(), CLEAN_STATE);
    assert.deepEqual((await q(`SELECT id FROM auth.users ORDER BY id`)).map((x) => x.id), kept, 'só as de antes da carga');
    const [st] = await q(`SELECT count(*)::int AS n FROM legacy._unload_runs WHERE status IN ('auth_pending', 'failed')`);
    assert.equal(st.n, 0);
  });

  // QA-U1 (corrigido): a repetição que acha as contas pendentes já apagadas (à mão no painel do Auth) ou religadas a um
  // cadastro fecha a execução anterior (antes, saía com "Nada a desfazer" e a `legacy._unload_runs` ficava 'failed' com
  // `pending_accounts`: o `npm run clean` recusava para sempre).
  const pendingThenResolve = async (resolveFn) => {
    await seedPre();
    legacy(legacyData());
    assert.equal(load(ADMINS).status, 0);
    assert.equal(accounts().status, 0);
    const m5 = await mid(5);
    await q(`CREATE OR REPLACE FUNCTION public.qa_auth_trap() RETURNS trigger LANGUAGE plpgsql AS $f$ BEGIN
               IF OLD.id = '${m5}' THEN RAISE EXCEPTION 'qa: conta não apagada'; END IF; RETURN OLD; END $f$;
             CREATE TRIGGER qa_auth_trap BEFORE DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.qa_auth_trap()`);
    try { assert.notEqual(unload().status, 0); } finally {
      await q(`DROP TRIGGER IF EXISTS qa_auth_trap ON auth.users; DROP FUNCTION IF EXISTS public.qa_auth_trap()`);
    }
    await resolveFn(m5);
    const r = unload();
    assert.equal(r.status, 0, r.out);
    const [st] = await q(`SELECT coalesce(sum(cardinality(pending_accounts)), 0)::int AS n FROM legacy._unload_runs WHERE status IN ('auth_pending', 'failed')`);
    return { n: st.n, out: r.out };
  };
  test('QA-U1a: conta pendente apagada à mão no Auth: a repetição fecha a execução anterior', async () => {
    const { n, out } = await pendingThenResolve(async (id) => { await q('DELETE FROM auth.users WHERE id = $1', [id]); });
    assert.equal(n, 0, 'a execução anterior continua com contas pendentes');
    assert.match(out, /Execução #\d+ fechada/);
  });
  test('QA-U1b: conta pendente religada a um cadastro que fica: a repetição a poupa e fecha a execução anterior (account_kept_linked)', async () => {
    const { n, out } = await pendingThenResolve(async (id) => {
      await addMember(U(900), { leader: ID.G1 });
      await q('UPDATE public.members SET auth_user_id = $2 WHERE id = $1', [U(900), id]);
    });
    const [u] = await q('SELECT count(*)::int AS n FROM auth.users WHERE id = $1', [(await q('SELECT auth_user_id AS id FROM public.members WHERE id = $1', [U(900)]))[0].id]);
    assert.equal(u.n, 1, 'a conta religada não pode ser apagada');
    assert.equal(n, 0, 'a execução anterior continua com contas pendentes');
    assert.match(out, /account_kept_linked/, 'a conta poupada aparece na saída');
  });
});

describe('Confirmação e --dry-run', () => {
  test('o código do --dry-run é o da execução real; trocar um cadastro do ensaio por outro (mesmas quantidades) muda o código e para sem apagar', async () => {
    await seedPre();
    legacy(legacyData());
    assert.equal(load(ADMINS).status, 0);
    assert.equal(accounts().status, 0);
    await addMember(AD.N1, { leader: await mid(6) });
    const codeOf = (r) => { assert.equal(r.status, 0, r.out); return /^Código de confirmação: ([0-9A-F]{4}-[0-9A-F]{4})$/m.exec(r.out)[1]; };
    const leaving = (r) => /^Sai: .*$/m.exec(r.out)[0];
    const d1 = unload(['--dry-run']);
    const c1 = codeOf(d1);
    assert.equal(codeOf(unload(['--dry-run'])), c1, 'estável');
    // o destino muda depois do dry-run sem mudar as quantidades: N1 sai de baixo da carga (fica) e C1 entra (sai)
    await q('UPDATE public.members SET leader_id = $2 WHERE id = $1', [AD.N1, ID.G1]);
    await addMember(AD.C1, { leader: await mid(6) });
    const d2 = unload(['--dry-run']);
    const c2 = codeOf(d2);
    assert.equal(leaving(d2), leaving(d1), 'as mesmas quantidades');
    assert.notEqual(c2, c1, 'o código muda com o conjunto, não só com a soma');
    const before = await rawSnap();
    const r = unload(['--confirm', c1]);
    assert.notEqual(r.status, 0, r.out);
    assert.match(r.out, /código de confirmação mudou/);
    assert.deepEqual(diffSnap(before, await rawSnap()), {}, 'nada apagado');
    const bad = unload(['--confirm', '12']);
    assert.notEqual(bad.status, 0, bad.out);
    assert.match(bad.out, /código de confirmação que o --dry-run mostrou/);
    const ok = unload(['--confirm', c2.toLowerCase()]);
    assert.equal(ok.status, 0, ok.out);
    const [run] = await q(`SELECT counts FROM legacy._unload_runs ORDER BY id DESC LIMIT 1`);
    const { plan, write } = run.counts;
    assert.equal(plan.members, write.members_deleted);
    assert.equal(plan.cells, write.cells_deleted);
    assert.equal(plan.reports, write.reports_deleted);
    assert.equal(plan.participants, write.participants_deleted);
    assert.deepEqual((await q('SELECT id FROM public.members WHERE id = ANY($1::uuid[])', [[AD.N1, AD.C1]])).map((x) => x.id), [AD.N1], 'N1 fica, C1 sai');
  });

});

describe('Leitura como usuário do novo depois da limpeza', () => {
  test('nada da carga aparece em members_view, cells_view, ministry_tree_nodes e dashboard_summary; o token de quem saiu não lê', async () => {
    await seedPre();
    await seedIndependents();
    legacy(legacyData());
    assert.equal(load(ADMINS).status, 0);
    assert.equal(accounts().status, 0);
    const gone = await userToken(7); // conta e sessão de um carregado (o E4.08 faz isso)
    const loadedBefore = await rest('/rest/v1/members_view?select=id&legacy_id=not.is.null', { token: await tokenFor(ID.P0, jwt) }).catch(() => null);
    void loadedBefore;
    await seedDependents();
    const r = unload();
    assert.equal(r.status, 0, r.out);
    const admin = await tokenFor(ID.P0, jwt);
    const [db] = await q(`SELECT (SELECT count(*) FROM public.members WHERE deleted_at IS NULL)::int AS m,
        (SELECT count(*) FROM public.members WHERE deleted_at IS NULL AND is_active)::int AS ma,
        (SELECT count(*) FROM public.cells WHERE deleted_at IS NULL)::int AS c`);
    const mv = await rest('/rest/v1/members_view?select=id,name', { token: admin });
    assert.equal(mv.status, 200);
    assert.equal(mv.json.length, db.m);
    assert.equal(JSON.stringify(mv.json).match(/Pessoa\d+ Teste\d+|Pastor Um/), null, 'nenhum nome da carga');
    const cv = await rest('/rest/v1/cells_view?select=id', { token: admin });
    assert.equal(cv.json.length, db.c);
    const tree = await rest('/rest/v1/rpc/ministry_tree_nodes', { token: admin, method: 'POST', body: { _parent_ids: null } });
    assert.equal(tree.status, 200, JSON.stringify(tree.json).slice(0, 200));
    assert.equal(JSON.stringify(tree.json).match(/Pessoa\d+ Teste\d+|Pastor Um/), null);
    const dash = await rest('/rest/v1/rpc/dashboard_summary', { token: admin, method: 'POST', body: {} });
    assert.equal(dash.status, 200);
    const d = Array.isArray(dash.json) ? dash.json[0] : dash.json;
    assert.equal(d.members_total ?? d.members_active + (d.members_inactive ?? 0), db.m);
    // o token do carregado que saiu não lê nada (sessão e conta apagadas)
    const old = await rest('/rest/v1/members_view?select=id', { token: gone });
    assert.ok(old.status !== 200 || old.json.length === 0, `token antigo leu ${old.status} ${JSON.stringify(old.json).slice(0, 80)}`);
    // a árvore dos independentes continua certa (hierarquia sem deriva) e o pastor da carga não existe mais
    assert.deepEqual(await problems(), CLEAN_STATE);
  });
});

// ---------------------------------------------------------------------------------------------------------
describe('Saída sem dado pessoal e sem a chave', () => {
  test('nenhuma saída nem relatório da limpeza (nem das contas e da carga feitas aqui) tem nome, e-mail, CPF, MD5, token ou a chave', () => {
    assert.ok(LEAKS.length > 5, 'houve saídas para varrer');
    const bad = LEAKS.map((t) => hasPii(t)).filter(Boolean);
    assert.deepEqual(bad, []);
    assert.ok(!LEAKS.some((t) => t.includes(ctx.SECRET)), 'a chave secreta não aparece');
  });
});
