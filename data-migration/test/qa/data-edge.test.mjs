// QA E4 PR 2: bordas dos dados (texto, datas na virada da semana, oferta, visitantes, cônjuge, ciclos, endereço).
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { legacy, load, resetDest, integrity, q, M, C, R, ADMINS } from './harness.mjs';

const OK = { drift: 0, periods: 0, member_rules: 0, cell_rules: 0, defaults: 1 };
const core = (extraMembers = [], cells = [C(1, { LeadId: 2, TimothyId: 3, HostId: 4 })], reports = [], participants = []) => ({
  members: [M(1, { Name: 'Pastor Um', Gender: 0 }), M(2, { LeadershipId: 1 }), M(3, { LeadershipId: 1 }), M(4, { LeadershipId: 2 }),
    ...extraMembers],
  cells, reports, participants,
});
const rep = (id, o) => R(id, { CellId: 1, LeadershipId: 2, TimothyId: 3, HostId: 4, ...o });
const run = (d, args = ADMINS, env) => { legacy(d, env?.copy); const r = load(args, { env: env?.load }); return r; };
const reports = () => q(`SELECT legacy_id, date::text AS date, time::text AS time, public.week_start(date)::text AS week,
    deleted_at IS NOT NULL AS del, deleted_by_kind::text AS dk, offering::text AS offering, visitors, theme, was_held, reason_not_held, observations
  FROM public.cell_reports WHERE legacy_id IS NOT NULL ORDER BY legacy_id`);
const by = (rows, key = 'legacy_id') => Object.fromEntries(rows.map((r) => [r[key], r]));

beforeEach(() => resetDest());

describe('Texto: acento, emoji, espaços e caracteres hostis', () => {
  test('nome, observação, endereço e visitantes chegam como no legado (acento e emoji), com espaços do nome ajustados', async () => {
    const d = core([
      M(10, { LeadershipId: 2, Name: 'José   da\tSilva  Júnior ', Notes: '  Observação com acentuação ✓, emoji 🙂 e 日本語\ne "aspas" \'simples\' \\ barra; DROP TABLE x;--  ', HomeAddressId: 1 }),
      M(11, { LeadershipId: 2, Name: 'Ana 😀 Souza', Notes: '   \t  ' }),
      M(12, { LeadershipId: 2, Name: 'Çağlar Ömer Åström', Notes: '' }),
      M(13, { LeadershipId: 2, Name: "Maria D'Ávila-Souza (Mãe)", Notes: 'x'.repeat(300000) }),
      M(14, { LeadershipId: 2, Name: 'Maria Nbsp Souza' }),
    ]);
    d.addresses = [{ Id: 1, Street: 'Rua São João 🏠', Number: ' 12-B ', Neighborhood: 'Vila Mãe', City: 'São Leopoldo', State: ' rs ', PostalCode: '93.010-000', Notes: 'apto 3 ✓' }];
    d.reports = [rep(1, { Subject: 'Tema ✝ à fé', Notes: 'Obs  com  espaços 🙌', Visitors: 'João|😀 Zé|Márcia  Lima| ' })];
    const r = run(d);
    assert.equal(r.status, 0, r.out);
    const m = by(await q(`SELECT legacy_id, name, notes, street, number, complement, neighborhood, city, state, zip_code FROM public.members WHERE legacy_id IS NOT NULL`));
    assert.equal(m[10].name, 'José da Silva Júnior');
    assert.equal(m[10].notes, '  Observação com acentuação ✓, emoji 🙂 e 日本語\ne "aspas" \'simples\' \\ barra; DROP TABLE x;--  ', 'o conteúdo da observação não muda');
    assert.deepEqual([m[10].street, m[10].number, m[10].complement, m[10].neighborhood, m[10].city, m[10].state, m[10].zip_code],
      ['Rua São João 🏠', ' 12-B ', 'apto 3 ✓', 'Vila Mãe', 'São Leopoldo', 'RS', '93010000']);
    assert.equal(m[11].name, 'Ana 😀 Souza'); assert.equal(m[11].notes, null, 'só espaços vira nulo');
    assert.equal(m[12].name, 'Çağlar Ömer Åström'); assert.equal(m[12].notes, null);
    assert.equal(m[13].name, "Maria D'Ávila-Souza (Mãe)"); assert.equal(m[13].notes.length, 300000);
    console.log(`  (NBSP no nome) pontos de código do espaço gravado: ${[...m[14].name].filter((ch) => /\s/.test(ch)).map((ch) => ch.codePointAt(0).toString(16))}`);
    const rp = by(await reports());
    assert.deepEqual(rp[1].visitors, ['João', '😀 Zé', 'Márcia  Lima']);
    assert.equal(rp[1].theme, 'Tema ✝ à fé'); assert.equal(rp[1].observations, 'Obs  com  espaços 🙌');
    assert.deepEqual(await integrity(), OK);
    for (const pii of ['José', 'Júnior', '😀', 'Ávila', 'Rua São', 'Márcia']) assert.ok(!r.out.includes(pii), `a saída da carga não cita dado pessoal (${pii})`);
  });

  test('visitantes: barras vazias, espaços, nulo e texto que parece literal de array não quebram nem se perdem', async () => {
    const cases = { 1: 'A||B', 2: '|A|', 3: ' | ', 4: 'A | B ', 5: null, 6: '|', 7: '{x},"y"\\z', 8: 'Só Um', 10: 'a,b|c{d}' };
    const d = core([], undefined, Object.entries(cases).map(([id, v]) => rep(Number(id), { Date: `2026-0${(Number(id) % 9) + 1}-04 20:00:00`, CellId: 1, Visitors: v })));
    // um relatório por semana: datas em meses diferentes (os Ids 1 a 8 em meses distintos; o 10 em outro ano)
    d.reports[d.reports.length - 1] = rep(10, { Date: '2025-03-05 20:00:00', Visitors: cases[10] });
    const r = run(d);
    assert.equal(r.status, 0, r.out);
    const rp = by(await reports());
    const want = { 1: ['A', 'B'], 2: ['A'], 3: [], 4: ['A', 'B'], 5: [], 6: [], 7: ['{x},"y"\\z'], 8: ['Só Um'], 10: ['a,b', 'c{d}'] };
    // ids 1..9 caem em meses ((id % 9) + 1): o 9 cai no mês 1 e o 1 no mês 2, sem choque de semana
    for (const [id, v] of Object.entries(want)) assert.deepEqual(rp[id]?.visitors, v, `relatório ${id}`);
  });
});

describe('Texto: espaços que não são o espaço comum nos visitantes', () => {
  // QA-1 (corrigido): os visitantes perdem nas pontas todo [[:space:]] e o NBSP (pg_temp.trim_space), como os
  // outros textos; um visitante só com tab, quebra de linha ou espaço sem quebra não vira visitante "vazio".
  test('visitante só com tab, NBSP ou quebra de linha não vira visitante', async () => {
    const d = core([], undefined, [rep(1, { Date: '2026-10-07 20:00:00', Visitors: ' \t |Ana|\t|\u00A0|\n|Bia\u00A0' })]);
    const r = run(d);
    assert.equal(r.status, 0, r.out);
    const rp = by(await reports());
    assert.deepEqual(rp[1].visitors, ['Ana', 'Bia']);
  });
});

describe('Datas: virada da semana (domingo 00:00, UTC−3) para o índice único e o week_start', () => {
  const dates = {
    1: '2026-11-21 23:59:59.999999', // sábado, fim da semana de 15/11
    2: '2026-11-22 00:00:00',        // domingo 00:00, começo da semana de 22/11
    3: '2026-11-28 23:59:59',        // sábado, mesma semana do domingo 22/11 (duplicado do 2, mas o 3 tem Id maior)
    4: '2026-11-29 00:00:00',        // domingo seguinte
    5: '2026-11-21 21:00:00',        // sábado 21h BRT = domingo 00:00 UTC: continua sábado
    6: '2026-11-15 02:59:59',        // domingo 02:59 BRT = 05:59 UTC
    7: '2024-02-29 20:00:00',        // bissexto, quinta
  };
  const mk = () => core([], undefined, Object.entries(dates).map(([id, Date]) => rep(Number(id), { Date })));

  for (const tz of ['UTC', 'America/Sao_Paulo', 'Asia/Tokyo', 'Pacific/Kiritimati']) {
    test(`semana e duplicado no fuso do processo ${tz}: datas gravadas como no legado (sem conversão de fuso)`, async () => {
      const r = run(mk(), ADMINS, { copy: { TZ: tz }, load: { TZ: tz } });
      assert.equal(r.status, 0, r.out);
      const rp = by(await reports());
      assert.deepEqual([rp[1].date, rp[1].time, rp[1].week], ['2026-11-21', '23:59:59', '2026-11-15']);
      assert.deepEqual([rp[2].date, rp[2].time, rp[2].week], ['2026-11-22', '00:00:00', '2026-11-22']);
      assert.deepEqual([rp[5].date, rp[5].time, rp[5].week], ['2026-11-21', '21:00:00', '2026-11-15']);
      assert.deepEqual([rp[6].date, rp[6].time, rp[6].week], ['2026-11-15', '02:59:59', '2026-11-15']);
      assert.deepEqual([rp[3].date, rp[3].week], ['2026-11-28', '2026-11-22']);
      assert.deepEqual([rp[4].date, rp[4].week], ['2026-11-29', '2026-11-29']);
      // duplicado: a 22/11 00:00 (Id 2) e a 28/11 23:59 (Id 3) caem na mesma semana; fica o de maior Id
      assert.deepEqual([rp[2].del, rp[2].dk, rp[3].del], [true, 'system', false]);
      // 1 (sáb 21/11 23:59:59), 5 (sáb 21/11 21:00) e 6 (dom 15/11 02:59) são a mesma semana: fica o 6 (maior Id)
      assert.deepEqual([rp[1].del, rp[5].del, rp[6].del], [true, true, false]);
      assert.equal(rp[7].week, '2024-02-25');
    });
  }
});

describe('Oferta (decimal, centavos e limites do CHECK)', () => {
  test('arredonda a 2 casas sem erro de ponto flutuante e deixa de fora só o que sai da faixa', async () => {
    const vals = { 1: '0.005', 2: '0.004', 3: '1234.5', 4: '10.999', 5: '999999.99', 6: '999999.994', 7: '999999.995', 8: '-0.01', 9: '0.300000000000000000000000000000',
      10: '0.000000000000000000000000000001', 11: '-0.004', 12: '1000000' };
    const d = core([], undefined, Object.entries(vals).map(([id, Contribution]) => rep(Number(id), { Date: `2026-0${(Number(id) % 9) + 1}-0${1 + (Number(id) > 9 ? 1 : 0)} 20:00:00`, Contribution })));
    // semanas diferentes: um mês por Id (ids 10..12 caem nos meses 2..4, em dias que mudam a semana)
    d.reports.forEach((x, i) => { x.Date = `${2020 + i}-06-03 20:00:00`; });
    const r = run(d);
    assert.equal(r.status, 0, r.out);
    const rp = by(await reports());
    const want = { 1: '0.01', 2: '0.00', 3: '1234.50', 4: '11.00', 5: '999999.99', 6: '999999.99', 9: '0.30', 10: '0.00', 11: '0.00' };
    for (const [id, v] of Object.entries(want)) assert.equal(rp[id]?.offering, v, `oferta do relatório ${id}`);
    for (const id of [7, 8, 12]) assert.equal(rp[id], undefined, `relatório ${id} fica de fora (oferta fora da faixa)`);
    assert.match(r.out, /report_offering_out_of_range/);
    assert.deepEqual(await integrity(), OK);
  });
});

describe('Relatórios: realizado sem tema, não houve célula, excluído e retrato', () => {
  test('realizado sem tema entra (Q-E4-3); "não houve célula" guarda a justificativa; excluído entra excluído; tipo e pessoas do retrato', async () => {
    const d = core([], undefined, [
      rep(1, { Date: '2026-10-07 20:00:00', Subject: '   ', Notes: 'obs' }),
      rep(2, { Date: '2026-10-14 20:00:00', WeekCellSkipped: 1, Subject: 'ignorado', Notes: 'Chuva forte ☔' }),
      rep(3, { Date: '2026-10-21 20:00:00', IsDeleted: 1 }),
      rep(4, { Date: '2026-10-28 20:00:00', CellType: null, LeadershipId: 999, TimothyId: 998, HostId: 997 }),
      rep(5, { Date: '2026-11-04 20:00:00', CellType: 7 }),
    ]);
    const r = run(d);
    assert.equal(r.status, 0, r.out);
    const rp = by(await reports());
    assert.deepEqual([rp[1].was_held, rp[1].theme, rp[1].observations], [true, null, 'obs']);
    assert.deepEqual([rp[2].was_held, rp[2].theme, rp[2].reason_not_held, rp[2].observations], [false, null, 'Chuva forte ☔', null]);
    assert.deepEqual([rp[3].del, rp[3].dk], [true, 'unknown']);
    const [s4] = await q(`SELECT snapshot_cell_type, (SELECT legacy_id FROM public.members WHERE id = snapshot_leader_id) AS l,
        (SELECT legacy_id FROM public.members WHERE id = snapshot_timothy_id) AS t, (SELECT legacy_id FROM public.members WHERE id = snapshot_host_id) AS h
        FROM public.cell_reports WHERE legacy_id = 4`);
    assert.deepEqual(s4, { snapshot_cell_type: 'Evangelística', l: 2, t: 3, h: 4 }, 'o retrato é completado pela célula');
    const [s5] = await q(`SELECT snapshot_cell_type FROM public.cell_reports WHERE legacy_id = 5`);
    assert.equal(s5.snapshot_cell_type, 'Evangelística');
    assert.deepEqual(await integrity(), OK);
  });
});

describe('Cônjuge em cadeia, mesmo sexo e excluídos', () => {
  test('cadeia A→B→C→A, par com excluído, par do mesmo sexo e auto-referência: nunca fica vínculo assimétrico', async () => {
    const L = { LeadershipId: 2 };
    const d = core([
      M(20, { ...L, SpouseId: 21, Gender: 0 }), M(21, { ...L, SpouseId: 22, Gender: 1 }), M(22, { ...L, SpouseId: 20, Gender: 0 }), // cadeia sem reciprocidade
      M(23, { ...L, SpouseId: 24, Gender: 0 }), M(24, { ...L, SpouseId: 23, Gender: 1, IsDeleted: 1 }),                                 // par com excluído
      M(25, { ...L, SpouseId: 26, Gender: 0 }), M(26, { ...L, SpouseId: 25, Gender: 0 }),                                               // par do mesmo sexo
      M(27, { ...L, SpouseId: 27 }), M(28, { ...L, SpouseId: 9999 }),
      M(29, { ...L, SpouseId: 30, Gender: 0 }), M(30, { ...L, SpouseId: 29, Gender: 1, Name: ' ' }),                                    // par com membro que fica de fora
      M(31, { ...L, SpouseId: 32, Gender: 0 }), M(32, { ...L, SpouseId: 31, Gender: 1 }),                                               // par bom
    ]);
    const r = run(d);
    assert.equal(r.status, 0, r.out);
    const sp = by(await q(`SELECT m.legacy_id, s.legacy_id AS spouse FROM public.members m LEFT JOIN public.members s ON s.id = m.spouse_id WHERE m.legacy_id >= 20`));
    for (const id of [20, 21, 22, 23, 24, 27, 28, 29]) assert.equal(sp[id].spouse, null, `membro ${id} sem cônjuge`);
    console.log(`  (par do mesmo sexo) 25↔26 ficou: ${sp[25].spouse}/${sp[26].spouse}`);
    assert.equal(sp[31].spouse, 32); assert.equal(sp[32].spouse, 31);
    const [asym] = await q(`SELECT count(*)::int AS n FROM public.members a LEFT JOIN public.members b ON b.id = a.spouse_id WHERE a.spouse_id IS NOT NULL AND b.spouse_id IS DISTINCT FROM a.id`);
    assert.equal(asym.n, 0);
    assert.deepEqual(await integrity(), OK);
    assert.match(r.out, /member_spouse_not_reciprocal/);
  });
});

describe('Liderança: ciclos longos e cadeias fundas', () => {
  test('ciclo de 150 pessoas com cauda e uma cadeia funda de 300: quebra no menor Id, tudo consistente', async () => {
    const members = [];
    const N = 150; // ids 100..249 em ciclo
    for (let i = 0; i < N; i += 1) members.push(M(100 + i, { LeadershipId: 100 + ((i + 1) % N), Idle: i % 7 === 0 ? 1 : 0 }));
    for (let i = 0; i < 10; i += 1) members.push(M(300 + i, { LeadershipId: i === 0 ? 177 : 299 + i })); // cauda pendurada no ciclo
    for (let i = 0; i < 300; i += 1) members.push(M(1000 + i, { LeadershipId: i === 0 ? 2 : 999 + i })); // cadeia funda sob o membro 2
    const d = core(members);
    const t0 = Date.now();
    const r = run(d);
    const dt = Date.now() - t0;
    assert.equal(r.status, 0, r.out);
    console.log(`  (ciclo 150 + cadeia 300) cópia+carga em ${dt} ms; ${r.out.split('\n').find((l) => /^Tempo/.test(l))}`);
    const [c] = await q(`SELECT count(*)::int AS n FROM public.members WHERE legacy_id BETWEEN 100 AND 249 AND leader_id IS NULL`);
    assert.equal(c.n, 1, 'um só quebrado');
    const [b] = await q(`SELECT legacy_id FROM public.members WHERE legacy_id BETWEEN 100 AND 249 AND leader_id IS NULL`);
    assert.equal(b.legacy_id, 100, 'no menor Id');
    const [deep] = await q(`SELECT h.g12_level AS lvl FROM public.members m JOIN private.member_hierarchy h ON h.member_id = m.id WHERE m.legacy_id = 1299`);
    assert.equal(deep.lvl, 301, 'nível do mais fundo: o membro 2 é o nível 1, o 1000 o 2 e o 1299 o 301');
    assert.deepEqual(await integrity(), OK);
    assert.match(r.out, /member_leader_cycle/);
  });
});

describe('Endereço, nascimento e identificadores estranhos', () => {
  test('estado longo, CEP inválido, endereço apontando para o nada e datas de nascimento/batismo extremas não derrubam a carga', async () => {
    const d = core([
      M(10, { LeadershipId: 2, HomeAddressId: 1 }), M(11, { LeadershipId: 2, HomeAddressId: 2 }), M(12, { LeadershipId: 2, HomeAddressId: 777 }),
      M(13, { LeadershipId: 2, BirthDate: '1000-01-01 00:00:00' }), M(14, { LeadershipId: 2, BirthDate: '2099-12-31 00:00:00' }),
      M(15, { LeadershipId: 2, Baptized: 1, BaptismDate: '1900-01-01 00:00:00' }), M(16, { LeadershipId: 2, Baptized: 0, BaptismDate: '2020-01-01 00:00:00' }),
      M(17, { LeadershipId: 2, BirthDate: '1990-06-15 23:59:59.999999' }),
    ]);
    d.addresses = [
      { Id: 1, Street: 'x'.repeat(5000), Number: '', Neighborhood: '   ', City: 'Rio Grande do Sul City', State: 'Rio Grande do Sul', PostalCode: 'abc' },
      { Id: 2, Street: null, Number: null, State: ' ', PostalCode: '12345', IsDeleted: 1 },
    ];
    const r = run(d);
    console.log(`  (endereço/nascimento extremos) status ${r.status}: ${r.status ? r.out.split('\n').filter((l) => /ERRO|Validação|  [a-z_]+ \//.test(l)).slice(0, 5).join(' | ') : 'ok'}`);
    assert.equal(r.status, 0, r.out);
    const m = by(await q(`SELECT legacy_id, state, zip_code, city, number, neighborhood, length(street) AS ls, birth_date::text, baptism_date::text FROM public.members WHERE legacy_id >= 10`));
    console.log(`  (estado longo) state=${JSON.stringify(m[10].state)} zip=${JSON.stringify(m[10].zip_code)} zip2=${JSON.stringify(m[11].zip_code)}`);
    assert.equal(m[12].state, null);
    assert.equal(m[16].baptism_date, null);
    assert.equal(m[17].birth_date, '1990-06-15');
    assert.deepEqual(await integrity(), OK);
  });

  test('e-mails, celulares e CPFs de formatos estranhos: carga passa, regras do cadastro ficam em dia', async () => {
    const d = core([
      M(10, { LeadershipId: 2, Email: '  QA.Maiuscula@Exemplo.ORG ', MobileNumber: '+55 (51) 99999-1010' }),
      M(11, { LeadershipId: 2, Email: 'a@b', MobileNumber: 'abc', CPF: '000.000.000-00' }),
      M(12, { LeadershipId: 2, Email: 'joão@exemplo.org', MobileNumber: '51 9999-1212', CPF: '529.982.247-25 ' }),
      M(13, { LeadershipId: 2, Email: null, MobileNumber: '   ', CPF: '', Idle: 1 }),
      M(14, { LeadershipId: 2, Email: 'dup-i@exemplo.org', IsDeleted: 1 }),
      M(15, { LeadershipId: 2, Email: 'dup-i@exemplo.org' }),     // ativo com o e-mail de um excluído: ok
      M(16, { LeadershipId: 2, Email: 'dup-d@exemplo.org', IsDeleted: 1 }),
      M(17, { LeadershipId: 2, Email: 'dup-d@exemplo.org', IsDeleted: 1 }), // dois excluídos iguais: ok
      M(18, { LeadershipId: 2, MobileNumber: 'abc', Email: 'q18@exemplo.org' }), M(19, { LeadershipId: 2, MobileNumber: 'abc', Email: 'q19@exemplo.org' }),
      M(20, { LeadershipId: 2, Email: 'q20@exemplo.org', PhoneNumber: '++//--', MobileNumber: '(51) 9 9999-2020' }),
      M(21, { LeadershipId: 2, Email: 'q21@exemplo.org', MobileNumber: '51 99999-2020' }),  // mesmo celular do 20 (máscara diferente)
    ]);
    const r = run(d);
    assert.equal(r.status, 0, r.out);
    const m = by(await q(`SELECT legacy_id, email, mobile_whatsapp, cpf, deleted_at IS NOT NULL AS del FROM public.members WHERE legacy_id >= 10`));
    assert.equal(m[10].email, 'qa.maiuscula@exemplo.org');
    console.log(`  (celular +55) ${JSON.stringify(m[10].mobile_whatsapp)}; 'abc' → ${JSON.stringify(m[18].mobile_whatsapp)}/${JSON.stringify(m[19].mobile_whatsapp)}; 11.cpf=${m[11].cpf} 12.cpf=${m[12].cpf}`);
    assert.equal(m[11].cpf, null); assert.equal(m[12].cpf, '52998224725');
    assert.equal(m[15].email, 'dup-i@exemplo.org'); assert.equal(m[14].email, 'dup-i@exemplo.org');
    assert.equal(m[16].email, m[17].email);
    assert.equal(m[21].mobile_whatsapp, null, 'celular repetido com outra máscara fica só no menor Id');
    assert.deepEqual(await integrity(), OK);
  });
});

describe('Células: horário, dia, tipo e célula excluída com pessoa excluída', () => {
  test('quais formatos de horário entram', async () => {
    const times = ['20:00', '8:00', '08:00', ' 20:00 ', '20:00:00', '24:00', '25:00', '19:60', '', null, '20h30', '7:5', '20.00'];
    const d = core(undefined, times.map((Time, i) => C(10 + i, { LeadId: 2, TimothyId: 3, HostId: 4, Time })));
    const r = run(d);
    assert.equal(r.status, 0, r.out);
    const got = by(await q(`SELECT legacy_id, to_char(meeting_time, 'HH24:MI:SS') AS t FROM public.cells WHERE legacy_id >= 10`));
    const res = times.map((t, i) => `${JSON.stringify(t)}=>${got[10 + i]?.t ?? 'fora'}`).join(' ');
    console.log(`  (horários) ${res}`);
    for (const ok of [0, 1, 2, 3]) assert.ok(got[10 + ok], `horário ${JSON.stringify(times[ok])} entra`);
    for (const bad of [5, 6, 7, 8, 9]) assert.equal(got[10 + bad], undefined, `horário ${JSON.stringify(times[bad])} fica de fora`);
    assert.deepEqual(await integrity(), OK);
  });

  test('célula excluída com anfitrião excluído entra excluída; dias 0 a 6 e tipos 0 a 2 entram; 7, -1 e 3 não', async () => {
    const cells = [
      C(10, { LeadId: 2, TimothyId: 3, HostId: 30, IsDeleted: 1 }),
      ...[0, 1, 2, 3, 4, 5, 6, 7, -1].map((w, i) => C(20 + i, { LeadId: 2, TimothyId: 3, HostId: 4, WeekDay: w })),
      ...[0, 1, 2, 3, -1].map((t, i) => C(40 + i, { LeadId: 2, TimothyId: 3, HostId: 4, CellType: t })),
    ];
    const d = core([M(30, { LeadershipId: 2, IsDeleted: 1 })], cells);
    const r = run(d);
    assert.equal(r.status, 0, r.out);
    const got = by(await q(`SELECT legacy_id, meeting_day, type, deleted_at IS NOT NULL AS del FROM public.cells WHERE legacy_id >= 10`));
    assert.equal(got[10].del, true);
    for (let w = 0; w <= 6; w += 1) assert.ok(got[20 + w], `dia ${w}`);
    assert.equal(got[27], undefined); assert.equal(got[28], undefined);
    for (let t = 0; t <= 2; t += 1) assert.ok(got[40 + t]);
    assert.equal(got[43], undefined); assert.equal(got[44], undefined);
    assert.deepEqual(await integrity(), OK);
  });
});
