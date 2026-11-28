// QA E4 PR 5: `npm run reconcile` (E4.09, DT-15 do spec e4-carga). A reconciliação é a evidência do go/no-go,
// então o pior erro é o FALSO APROVADO. Aqui cada divergência real é injetada, uma por vez, num destino que a
// própria reconciliação aprova limpo (carga + contas da massa de reconcile-world.mjs, stack local da pista B),
// e o teste confere que ela vira diferença INESPERADA (falha, saída 2) com o código e o Id certos.
// Também confere: só leitura (destino idêntico antes e depois, inclusive Auditoria e pg_stat), recusa com
// trava ocupada / carga desfeita / contas ausentes, códigos de saída e ausência de dado pessoal, MD5 e chave
// em tudo o que ela escreve.
//
// Casos marcados `todo` documentam FALSO APROVADO (bug do runner, relatório do QA): o teste afirma o
// comportamento correto e falha hoje; o `todo` mantém a suíte verde até a correção.
//
// Rodar: bash test/qa/run-qa.sh test/qa/reconcile.test.mjs   (MySQL em Docker + stack local da pista B)
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Env, view, sql, q, pg, md5, world, M, ROOT, CONFIG, AT } from './reconcile-world.mjs';

let env;
before(() => { env = new Env(); });
after(async () => {
  try { await env.wipe(); } catch { /* o run-qa.sh limpa de novo */ }
  env.cleanup();
});

const mid = (lid) => `(SELECT id FROM public.members WHERE legacy_id = ${lid})`;
const cid = (lid) => `(SELECT id FROM public.cells WHERE legacy_id = ${lid})`;
const rid = (lid) => `(SELECT id FROM public.cell_reports WHERE legacy_id = ${lid})`;
const todo = (msg) => (process.env.QA_STRICT ? false : msg); // QA_STRICT=1: roda os casos de bug como falha de verdade
const ids = (list) => list.map((x) => x.lid).sort((a, b) => a - b);

/** Fresca: carga e contas limpas; injeta; roda; confere que reprovou e que `code` aponta os `lids`. */
async function inject(fn, { args = [], setup } = {}) {
  await env.setup(setup ?? world());
  const base = env.recon();
  assert.equal(base.status, 0, `a base não está limpa:\n${base.out}`);
  await fn();
  const r = env.recon(args);
  assert.equal(r.status, 2, `deveria reprovar (saída 2):\n${r.out}`);
  assert.equal(r.json.summary.approved, false);
  return { r, v: view(r.json) };
}
const flags = (v, code, lids) => {
  const got = code.startsWith('db_') ? v.by[code].items.map(([lid]) => lid) : ids(v.unexpected(code));
  for (const l of lids) assert.ok(got.includes(l), `${code}: Id ${l} deveria ser inesperada (veio ${JSON.stringify(got)}; falhas: ${v.failed})`);
  assert.equal(v.by[code].status, 'falha', code);
};

describe('Base: a reconciliação aprova a massa limpa e explica o que é esperado', () => {
  test('aprovada, saída 0, 2 esperadas da carga (CPF inválido e e-mail repetido), e a evidência é estável com o mesmo instante', async () => {
    await env.setup();
    const a = env.recon();
    assert.equal(a.status, 0, a.out);
    const v = view(a.json);
    assert.deepEqual(v.failed, []);
    assert.deepEqual(v.expected('member_field').sort(), ['14:member_cpf_dropped', '17:member_email_duplicate']);
    const b = env.recon();
    assert.equal(b.json.evidence, a.json.evidence, 'mesmo destino e mesmo --at: mesmo código de evidência');
    // Com a semana de referência fixa, o painel e a situação pegam relatórios e células pendentes de verdade.
    const sit = a.json.checks.find((c) => c.code === 'report_situation_counts').metrics[0];
    assert.ok(sit.legacy_pending > 0 && sit.legacy_pending === sit.new_pending_loaded, `pendentes ${JSON.stringify(sit)}`);
  });
});

describe('Relatórios: divergência real vira inesperada', () => {
  test('data deslocada uma semana (a oferta passa para o mês anterior)', async () => {
    const { v } = await inject(() => sql(`UPDATE public.cell_reports SET date = date - 7 WHERE legacy_id = 4`));
    flags(v, 'report_field', [4]);
    assert.equal(v.by.offering_month.status, 'falha');
  });
  test('data deslocada um dia (mesma semana) e horário trocado', async () => {
    const { v } = await inject(() => sql(`UPDATE public.cell_reports SET date = date + 1 WHERE legacy_id = 4;
      UPDATE public.cell_reports SET time = time + interval '30 minutes' WHERE legacy_id = 5`));
    flags(v, 'report_field', [4, 5]);
  });
  test('retrato com a pessoa errada (líder, timóteo, anfitrião, tipo), cada um sozinho', async () => {
    const { v } = await inject(() => sql(`
      UPDATE public.cell_reports SET snapshot_leader_id = ${mid(12)} WHERE legacy_id = 1;
      UPDATE public.cell_reports SET snapshot_timothy_id = ${mid(12)} WHERE legacy_id = 2;
      UPDATE public.cell_reports SET snapshot_host_id = ${mid(12)} WHERE legacy_id = 4;
      UPDATE public.cell_reports SET snapshot_cell_type = 'Macrocélula' WHERE legacy_id = 5`));
    flags(v, 'report_snapshot', [1, 2, 4, 5]);
  });
  test('retrato igual à célula ATUAL, quando o legado guardou outra pessoa que existe no novo (não é "completado pela célula")', async () => {
    // O relatório 1 diz no legado: líder 2. Muda a célula 1 para o líder 12 no novo e o retrato junto: a
    // reconciliação não pode aceitar "completado pela célula" porque o líder 2 do legado existe.
    const { v } = await inject(() => sql(`
      UPDATE public.cells SET leader_id = ${mid(12)} WHERE legacy_id = 1;
      UPDATE public.cell_reports SET snapshot_leader_id = ${mid(12)} WHERE legacy_id = 1`));
    flags(v, 'report_snapshot', [1]);
    flags(v, 'cell_field', [1]);
  });
  test('participante trocado por outro (a contagem fica igual)', async () => {
    const { v } = await inject(() => sql(`
      DELETE FROM public.cell_report_participants WHERE report_id = ${rid(1)} AND member_id = ${mid(4)};
      INSERT INTO public.cell_report_participants (report_id, member_id) VALUES (${rid(1)}, ${mid(5)})`));
    flags(v, 'participant_missing', [1]);
    flags(v, 'participant_extra', [1]);
    assert.equal(v.by.report_participants_count.status, 'ok', 'a contagem é a mesma: só a comparação par a par pega');
    assert.equal(v.by.counts.status, 'ok');
  });
  test('participante do legado removido e outro de fora acrescentado em relatório excluído', async () => {
    const { v } = await inject(() => sql(`
      DELETE FROM public.cell_report_participants WHERE report_id = ${rid(6)} AND member_id = ${mid(3)};
      INSERT INTO public.cell_report_participants (report_id, member_id) VALUES (${rid(6)}, ${mid(13)})`));
    flags(v, 'participant_missing', [6]);
    flags(v, 'participant_extra', [6]);
  });
  test('oferta com centavos trocados (123,45 → 123,54): a soma do mês muda e o relatório é apontado', async () => {
    const { v } = await inject(() => sql(`UPDATE public.cell_reports SET offering = 123.54 WHERE legacy_id = 1`));
    flags(v, 'report_field', [1]);
    assert.equal(v.by.offering_month.status, 'falha');
  });
  test('ofertas trocadas entre dois relatórios (a soma do mês NÃO muda): o um a um pega', async () => {
    const { v } = await inject(() => sql(`UPDATE public.cell_reports SET offering = CASE legacy_id WHEN 1 THEN 50.10 ELSE 123.45 END WHERE legacy_id IN (1, 2)`));
    flags(v, 'report_field', [1, 2]);
    assert.equal(v.by.offering_month.status, 'ok', 'a soma mensal sozinha deixaria passar');
  });
  test('relatório movido para outra célula, e relatório que deixou de ser realizado, e visitantes e tema trocados', async () => {
    const { v } = await inject(() => sql(`
      UPDATE public.cell_reports SET cell_id = ${cid(2)} WHERE legacy_id = 4;
      UPDATE public.cell_reports SET was_held = false, reason_not_held = 'x', theme = NULL WHERE legacy_id = 1;
      UPDATE public.cell_reports SET visitors = '{Caio,Dani}' WHERE legacy_id = 5;
      UPDATE public.cell_reports SET theme = 'Outro' WHERE legacy_id = 2`));
    flags(v, 'report_field', [1, 2, 4, 5]);
  });
  test('relatório vivo no legado excluído no novo "pelo sistema", sem duplicata na semana', async () => {
    const { v } = await inject(() => sql(`UPDATE public.cell_reports SET deleted_at = now(), deleted_by_kind = 'system' WHERE legacy_id = 5`));
    flags(v, 'report_status', [5]);
  });
  test('relatório excluído no legado que voltou vivo no novo', async () => {
    const { v } = await inject(() => sql(`UPDATE public.cell_reports SET deleted_at = NULL, deleted_by = NULL, deleted_by_kind = NULL, deleted_by_legacy = NULL WHERE legacy_id = 6`));
    flags(v, 'report_status', [6]);
  });
  test('relatório sumido da carga, sem motivo listado', async () => {
    const { v } = await inject(() => sql(`DELETE FROM public.cell_report_participants WHERE report_id = ${rid(5)};
      DELETE FROM public.cell_reports WHERE legacy_id = 5`));
    flags(v, 'report_missing', [5]);
  });
  test('relatório a mais no novo com Id do legado que não existe, e participante de cadastro só do novo', async () => {
    const { v } = await inject(() => sql(`INSERT INTO public.cell_reports (cell_id, date, time, was_held, theme, offering, legacy_id,
          snapshot_leader_id, snapshot_timothy_id, snapshot_host_id, snapshot_cell_type)
        SELECT cell_id, date - 90, time, true, 'fantasma', 1.00, 99999, snapshot_leader_id, snapshot_timothy_id, snapshot_host_id, snapshot_cell_type
          FROM public.cell_reports WHERE legacy_id = 1`));
    flags(v, 'report_extra', [99999]);
  });
});

describe('Membros: divergência real vira inesperada', () => {
  test('cônjuge assimétrico: o marido perde a esposa e a esposa continua apontando', async () => {
    const { v } = await inject(() => sql(`UPDATE public.members SET spouse_id = NULL WHERE legacy_id = 10`));
    flags(v, 'member_spouse', [10]);
    flags(v, 'spouse_reciprocal', [11]);
  });
  test('cônjuge trocado de forma simétrica (10 casa com 12; 11 fica sozinha)', async () => {
    const { v } = await inject(() => sql(`UPDATE public.members SET spouse_id = CASE legacy_id WHEN 10 THEN ${mid(12)} WHEN 12 THEN ${mid(10)} ELSE NULL END
        WHERE legacy_id IN (10, 11, 12)`));
    flags(v, 'member_spouse', [10, 11, 12]);
  });
  test('excluído que voltou ativo (membro, célula) e ativo que ficou inativo', async () => {
    const { v } = await inject(() => sql(`
      UPDATE public.members SET deleted_at = NULL, deleted_by = NULL, deleted_by_kind = NULL, deleted_by_legacy = NULL WHERE legacy_id = 8;
      UPDATE public.cells SET deleted_at = NULL, deleted_by = NULL, deleted_by_kind = NULL, deleted_by_legacy = NULL WHERE legacy_id = 5;
      UPDATE public.members SET is_active = false WHERE legacy_id = 4;
      UPDATE public.cells SET is_active = false WHERE legacy_id = 4`));
    flags(v, 'member_status', [4, 8]);
    flags(v, 'cell_status', [4, 5]);
    assert.equal(v.by.counts.status, 'falha');
  });
  test('ativo no legado excluído no novo (membro e célula)', async () => {
    const { v } = await inject(() => sql(`
      UPDATE public.members SET deleted_at = now(), deleted_by_kind = 'system' WHERE legacy_id = 7;
      UPDATE public.cells SET deleted_at = now(), deleted_by_kind = 'system' WHERE legacy_id = 3`));
    flags(v, 'member_status', [7]);
    flags(v, 'cell_status', [3]);
  });
  test('campos: sexo, nascimento, batismo, e-mail trocado entre dois membros, celular e endereço', async () => {
    const { v } = await inject(async () => {
      await sql(`UPDATE public.members SET gender = 'M' WHERE legacy_id = 3;
        UPDATE public.members SET birth_date = birth_date + 1 WHERE legacy_id = 4;
        UPDATE public.members SET is_baptized = false, baptism_date = NULL WHERE legacy_id = 10;
        UPDATE public.members SET city = 'Outra Cidade' WHERE legacy_id = 3;
        UPDATE public.members SET mobile_whatsapp = '5199998888' WHERE legacy_id = 5`);
      await sql(`UPDATE public.members SET email = 'tmp-troca@exemplo.org' WHERE legacy_id = 6;
        UPDATE public.members SET email = (SELECT email FROM public.members WHERE legacy_id = 7) WHERE legacy_id = 6 AND false;`);
      // troca de e-mails entre 12 e 13, passando por um valor livre (índice único)
      await sql(`UPDATE public.members SET email = 'tmp@exemplo.org' WHERE legacy_id = 12;
        UPDATE public.members a SET email = 'qa12@exemplo.org' FROM public.members b WHERE a.legacy_id = 13 AND false;
        UPDATE public.members SET email = 'qa12@exemplo.org' WHERE legacy_id = 13;
        UPDATE public.members SET email = 'qa13@exemplo.org' WHERE legacy_id = 12`);
    });
    flags(v, 'member_field', [3, 4, 5, 6, 10, 12, 13]);
  });
  test('líder trocado (6 passa de 4 para 3): líder, nível e totais', async () => {
    const { v } = await inject(async () => {
      await sql(`UPDATE public.members SET leader_id = ${mid(3)} WHERE legacy_id = 6`);
      await sql('SELECT private.rebuild_member_hierarchy()', { replica: false });
    });
    flags(v, 'member_leader', [6]);
    flags(v, 'member_totals', [3, 4]);
  });
  test('o sinal "pastor" removido do pastor da D9, e a configuração de pastores diferente da da carga', async () => {
    await env.setup();
    const a = env.recon(['--pastor-ids', '2']);
    assert.equal(a.status, 2, a.out);
    const v = view(a.json);
    flags(v, 'member_field', [1]);
  });
  test('Administradores da configuração diferentes dos da carga viram role_mismatch', async () => {
    await env.setup();
    const a = env.recon(['--admin-ids', '1,2,3']);
    assert.equal(a.status, 2, a.out);
    flags(view(a.json), 'role_mismatch', [3]);
  });
  test('dado do legado alterado depois da carga (sem nova cópia): nome, líder e Idle', async () => {
    const { v } = await inject(() => sql(`UPDATE legacy."Members" SET "Name" = 'Quatro Renomeado' WHERE "Id" = 4;
        UPDATE legacy."Members" SET "Idle" = true WHERE "Id" = 5;
        UPDATE legacy."Cells" SET "Time" = '21:00' WHERE "Id" = 2`, { replica: false }));
    flags(v, 'member_field', [4]);
    flags(v, 'member_status', [5]);
    flags(v, 'cell_field', [2]);
  });
});

describe('Motivo esperado: só vale se a carga o listou para aquele Id', () => {
  test('o motivo da carga listado para outro Id não explica a diferença do Id errado (CPF válido apagado no 15)', async () => {
    const { v } = await inject(() => sql(`UPDATE public.members SET cpf = NULL WHERE legacy_id = 15`));
    flags(v, 'member_field', [15]);
    assert.match(v.unexpected('member_field').find((x) => x.lid === 15).note, /não listado na carga/);
    assert.ok(v.expected('member_field').includes('14:member_cpf_dropped'), 'o do 14 continua esperado');
  });
  test('o motivo do 14 removido da lista da carga: a diferença dele passa a ser inesperada', async () => {
    const { v } = await inject(() => sql(`UPDATE legacy._load_runs SET lists = lists - 'member_cpf_dropped'
        WHERE id = (SELECT max(id) FROM legacy._load_runs)`, { replica: false }));
    flags(v, 'member_field', [14]);
  });
  test('a lista da carga com o Id trocado (14 → 15): o 14 volta a ser inesperado', async () => {
    const { v } = await inject(() => sql(`UPDATE legacy._load_runs SET lists = jsonb_set(lists, '{member_cpf_dropped}', '[15]')
        WHERE id = (SELECT max(id) FROM legacy._load_runs)`, { replica: false }));
    flags(v, 'member_field', [14]);
  });
  test('duplicata: o motivo é aceito por estar na lista, mesmo com a carga ficando com o MAIOR Id (o 17 mantém o e-mail, o 16 perde)', { todo: todo('BUG QA-RC-1: o motivo "repetido: fica só no menor Id" não é conferido contra o legado') }, async () => {
    // A carga deveria manter o e-mail no 16 (menor Id) e anular no 17. Aqui o destino faz o contrário e a
    // lista da carga acompanha (como um bug da própria carga faria). Um reconciliador independente reprova.
    await env.setup();
    await sql(`UPDATE public.members SET email = NULL WHERE legacy_id = 16;
      UPDATE public.members SET email = 'repetido@exemplo.org' WHERE legacy_id = 17;
      UPDATE legacy._load_runs SET lists = jsonb_set(lists, '{member_email_duplicate}', '[16]') WHERE id = (SELECT max(id) FROM legacy._load_runs)`);
    const r = env.recon();
    assert.equal(r.status, 2, `a reconciliação aprovou uma duplicata resolvida pelo Id errado:\n${r.out}`);
  });
  test('"Não houve líder/ciclo": líder apagado do 6 só é aceito se a carga listou o ciclo ou o líder inexistente', async () => {
    const { v } = await inject(async () => {
      await sql(`UPDATE public.members SET leader_id = NULL, has_leadership = false WHERE legacy_id = 6`);
      await sql('SELECT private.rebuild_member_hierarchy()', { replica: false });
    });
    flags(v, 'member_leader', [6]);
  });
});

describe('Células: divergência real vira inesperada', () => {
  test('tipo, dia e horário trocados entre duas células (as contagens ficam iguais)', async () => {
    const { v } = await inject(() => sql(`
      UPDATE public.cells a SET type = b.type, meeting_day = b.meeting_day, meeting_time = b.meeting_time
        FROM (SELECT * FROM public.cells WHERE legacy_id IN (1, 2)) b WHERE a.legacy_id IN (1, 2) AND b.legacy_id <> a.legacy_id`));
    flags(v, 'cell_field', [1, 2]);
  });
  test('pessoas trocadas (líder, timóteo, anfitrião) e endereço', async () => {
    const { v } = await inject(() => sql(`
      UPDATE public.cells SET leader_id = ${mid(5)} WHERE legacy_id = 2;
      UPDATE public.cells SET timothy_id = ${mid(12)} WHERE legacy_id = 3;
      UPDATE public.cells SET host_id = ${mid(2)} WHERE legacy_id = 4;
      UPDATE public.cells SET street = 'Rua Trocada' WHERE legacy_id = 1`));
    flags(v, 'cell_field', [1, 2, 3, 4]);
  });
  test('célula sumida do novo e célula fantasma com Id inexistente', async () => {
    const { v } = await inject(() => sql(`
      DELETE FROM public.cell_report_participants WHERE report_id IN (SELECT id FROM public.cell_reports WHERE cell_id = ${cid(3)});
      DELETE FROM public.cell_reports WHERE cell_id = ${cid(3)};
      DELETE FROM public.cells WHERE legacy_id = 3;
      INSERT INTO public.cells (leader_id, timothy_id, host_id, meeting_day, meeting_time, type, legacy_id)
        SELECT leader_id, timothy_id, host_id, meeting_day, meeting_time, type, 88888 FROM public.cells WHERE legacy_id = 1`));
    flags(v, 'cell_missing', [3]);
    flags(v, 'cell_extra', [88888]);
  });
});

describe('Hierarquia, totais e listas do banco', () => {
  test('total de discípulos errado e nível diferente do guardado no legado', async () => {
    const { v } = await inject(async () => {
      await sql(`UPDATE private.member_hierarchy SET total_disciples = total_disciples + 1 WHERE member_id = ${mid(4)}`);
      await sql(`UPDATE legacy."Members" SET "MinistryLevel" = 1728 WHERE "Id" = 3`, { replica: false });
    });
    flags(v, 'member_totals', [4]);
    flags(v, 'member_level', [3]);
    flags(v, 'db_hierarchy_drift', [4]);
  });
  test('total de células de masculinas e femininas trocado (soma igual)', async () => {
    const { v } = await inject(() => sql(`UPDATE private.member_hierarchy SET male_cells = female_cells, female_cells = male_cells
        WHERE member_id = ${mid(2)} AND male_cells <> female_cells`));
    flags(v, 'member_totals', [2]);
  });
  test('ciclo de liderança no novo', async () => {
    const { v } = await inject(() => sql(`UPDATE public.members SET leader_id = ${mid(7)} WHERE legacy_id = 4`));
    flags(v, 'leader_cycle', [4]);
  });
});

describe('Autoria do legado', () => {
  test('autor e data de criação trocados entre dois relatórios e autor do novo num membro', async () => {
    const { v } = await inject(() => sql(`
      UPDATE public.cell_reports SET created_at = created_at + interval '1 day' WHERE legacy_id = 1;
      UPDATE public.members SET created_at = created_at - interval '3 days' WHERE legacy_id = 3;
      UPDATE public.cells SET updated_at = now(), updated_by_kind = 'legacy', updated_by_legacy = 'Outro Autor' WHERE legacy_id = 1`));
    flags(v, 'authorship_report', [1]);
    flags(v, 'authorship_member', [3]);
    flags(v, 'authorship_cell', [1]);
  });
});

describe('Contas, credenciais e funções', () => {
  test('função de Administrador indevida e a do Líder retirada', async () => {
    const { v } = await inject(() => sql(`
      UPDATE public.members SET role_id = (SELECT id FROM public.roles WHERE is_system) WHERE legacy_id = 6;
      UPDATE public.members SET role_id = (SELECT id FROM public.roles WHERE is_default) WHERE legacy_id = 12`));
    flags(v, 'role_mismatch', [6, 12]);
  });
  test('Administrador da lista rebaixado: sobra 1 e a métrica admins falha', async () => {
    const { v } = await inject(() => sql(`UPDATE public.members SET role_id = (SELECT id FROM public.roles WHERE is_default) WHERE legacy_id = 2`));
    flags(v, 'role_mismatch', [2]);
    assert.equal(v.by.admins.status, 'falha');
  });
  test('conta ligada ao membro errado (as contas do 5 e do 6 trocadas)', async () => {
    const { v } = await inject(() => sql(`
      UPDATE public.members SET auth_user_id = NULL WHERE legacy_id IN (5, 6);
      UPDATE public.members SET auth_user_id = ${mid(6)} WHERE legacy_id = 5;
      UPDATE public.members SET auth_user_id = ${mid(5)} WHERE legacy_id = 6`));
    flags(v, 'account_missing', [5, 6]);
  });
  test('conta do Auth com o Id do legado de outro membro', async () => {
    const { v } = await inject(() => sql(`UPDATE auth.users SET raw_app_meta_data = jsonb_set(raw_app_meta_data, '{legacy_member_id}', '"6"')
        WHERE id = ${mid(5)}`, { replica: false }));
    flags(v, 'account_missing', [5]);
    flags(v, 'account_orphan', [6]);
  });
  test('conta órfã (Id do legado que não existe) e conta sumida', async () => {
    const { v } = await inject(() => sql(`UPDATE auth.users SET raw_app_meta_data = jsonb_set(raw_app_meta_data, '{legacy_member_id}', '"777"')
        WHERE id = ${mid(7)}`, { replica: false }));
    flags(v, 'account_orphan', [777]);
  });
  test('credencial legada de outro membro (os hashes do 5 e do 6 trocados): a amostra pega com a amostra cobrindo todos', async () => {
    const { v } = await inject(() => sql(`
      UPDATE private.legacy_credentials a SET legacy_hash = b.legacy_hash
        FROM private.legacy_credentials b
       WHERE a.member_id IN (${mid(5)}, ${mid(6)}) AND b.member_id IN (${mid(5)}, ${mid(6)}) AND a.member_id <> b.member_id`, { replica: false }));
    flags(v, 'credential_hash_mismatch', [5, 6]);
  });
  test('credencial trocada com a amostra padrão (20) num destino com mais de 20 credenciais: cobertura parcial é declarada', async () => {
    // 15 credenciais na massa: amostra de 20 cobre todas. Aqui só confere que o relatório diz quantas foram conferidas.
    await env.setup();
    const r = env.recon(['--credential-sample', '3']);
    const c = r.json.checks.find((x) => x.code === 'credential_hash_mismatch');
    assert.equal(c.compared, 3, 'o relatório diz quantas credenciais foram conferidas');
  });
  test('credencial de membro excluído e de cadastro só do novo', async () => {
    const { v } = await inject(async () => {
      await sql(`INSERT INTO private.legacy_credentials (member_id, legacy_hash)
        SELECT ${mid(8)}, legacy_hash FROM private.legacy_credentials WHERE member_id = ${mid(3)}`, { replica: false });
    });
    flags(v, 'credential_unexpected', [8]);
  });
  test('conta sem credencial e credencial apagada de quem tem senha utilizável', async () => {
    const { v } = await inject(() => sql(`DELETE FROM private.legacy_credentials WHERE member_id = ${mid(13)}`, { replica: false }));
    flags(v, 'credential_missing', [13]);
  });
  test('conta de membro excluído é só listada, sempre como esperada (decisão PR4-8)', async () => {
    // O membro 8 é excluído no legado: nenhuma conta deveria existir. Se a criação de contas errar e criar uma,
    // a reconciliação só lista. Documenta o comportamento atual (esperado "sempre").
    await env.setup();
    await sql(`INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at, raw_app_meta_data)
        SELECT ${mid(8)}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', id::text || '@mci12fakemail.com', now(), now(),
               '{"legacy_member_id": "8"}'::jsonb FROM public.members WHERE legacy_id = 8;
      UPDATE public.members SET auth_user_id = id WHERE legacy_id = 8`, { replica: false });
    const r = env.recon();
    assert.equal(r.status, 0, r.out);
    assert.ok(view(r.json).expected('account_unexpected').includes('8:account_on_deleted_member'));
  });
});

describe('Registros só do novo (sem Id do legado)', () => {
  test('célula e relatório fantasmas sem legacy_id (carga duplicada sem o Id) aparecem como atenção ou falha', { todo: todo('BUG QA-RC-2: registros sem legacy_id nunca são contados nem listados; um duplicado sem o Id passa') }, async () => {
    await env.setup();
    await sql(`INSERT INTO public.cells (leader_id, timothy_id, host_id, meeting_day, meeting_time, type)
        SELECT leader_id, timothy_id, host_id, meeting_day, meeting_time, type FROM public.cells WHERE legacy_id = 1;
      INSERT INTO public.members (name, gender, email, leader_id, has_leadership)
        SELECT 'Fantasma Duplicado', 'M', 'fantasma@exemplo.org', ${mid(2)}, true`);
    await sql('SELECT private.rebuild_member_hierarchy(); SELECT private.backfill_cell_active_periods()', { replica: false });
    const r = env.recon();
    const v = view(r.json);
    const surfaced = r.status !== 0 || r.json.summary.attention > 0
      || JSON.stringify(r.json.checks.find((c) => c.code === 'counts').metrics).includes('só do novo');
    assert.ok(surfaced, `registros só do novo ficaram invisíveis (aprovada, ${r.json.summary.expected} esperadas, falhas ${v.failed})`);
  });
});

describe('Só leitura', () => {
  const tables = async () => (await q(`SELECT c.oid::regclass::text AS t FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r', 'p') AND n.nspname IN ('public', 'private', 'legacy', 'auth', 'extensions', 'vault') ORDER BY 1`)).map((r) => r.t);
  async function snapshot() {
    const out = {};
    for (const t of await tables()) {
      const [r] = await q(`SELECT count(*)::int AS n, md5(coalesce(string_agg(x::text, E'\\n' ORDER BY x::text), '')) AS h FROM ${t} x`);
      out[t] = `${r.n}:${r.h}`;
    }
    const seqs = await q(`SELECT schemaname || '.' || sequencename AS s, last_value FROM pg_sequences WHERE schemaname IN ('public', 'private', 'legacy', 'auth') ORDER BY 1`);
    out.sequences = JSON.stringify(seqs);
    return out;
  }
  async function writeStats() {
    await new Promise((r) => setTimeout(r, 1800));
    const rows = await q(`SELECT relid::regclass::text AS t, n_tup_ins, n_tup_upd, n_tup_del, n_tup_hot_upd FROM pg_stat_user_tables
      WHERE schemaname IN ('public', 'private', 'legacy', 'auth') ORDER BY 1`);
    return JSON.stringify(rows);
  }
  test('o destino fica idêntico (linhas, sequências, Auditoria, contagem de escritas do pg_stat) depois de várias execuções, inclusive com divergências', async () => {
    await env.setup();
    await sql(`UPDATE public.cell_reports SET offering = 1 WHERE legacy_id = 1`); // reprovada: o caminho de falha também só lê
    const before = await snapshot();
    const stats = await writeStats();
    const ev = (await q('SELECT count(*)::int AS n FROM public.events'))[0].n;
    for (let i = 0; i < 3; i += 1) {
      assert.equal(env.recon([], { dry: i === 0 }).status, 2);
    }
    const r = env.recon(['--seed', 'outra', '--credential-sample', '2']);
    assert.equal(r.status, 2);
    const after = await snapshot();
    assert.deepEqual(after, before, 'conteúdo do destino mudou');
    assert.equal((await q('SELECT count(*)::int AS n FROM public.events'))[0].n, ev, 'a Auditoria recebeu eventos');
    assert.equal(await writeStats(), stats, 'o pg_stat registra escritas (n_tup_ins/upd/del)');
  });
  test('a sessão da reconciliação é READ ONLY: nada do que ela roda consegue gravar (nem função volátil, nem sequência)', async () => {
    // O runner abre BEGIN ... READ ONLY. Confere o contrato pelo próprio SQL: tenta gravar numa transação igual.
    const c = await pg();
    try {
      await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      await assert.rejects(c.query(`UPDATE public.roles SET name = name`), /read-only transaction/);
      await c.query('ROLLBACK');
      await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      await assert.rejects(c.query(`SELECT nextval('legacy._load_runs_id_seq')`).catch((e) => { throw e; }), /read-only transaction|does not exist/);
    } finally { await c.query('ROLLBACK').catch(() => {}); await c.end(); }
  });
  test('não usa o Auth: roda com uma configuração sem URL nem chave secreta', async () => {
    await env.setup();
    const r = spawnSync('node', ['--no-deprecation', resolve(ROOT, 'src/reconcile.mjs'), '--config', CONFIG, '--dry-run', '--at', AT], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(!/SUPABASE_SECRET|secret/i.test(r.stdout + r.stderr));
    const src = readFileSync(resolve(ROOT, 'src/reconcile.mjs'), 'utf8');
    assert.ok(!/auth-admin|createAuthAdmin|fetch\(/.test(src), 'o runner não deve chamar o Auth nem a rede');
  });
  test('--dry-run não grava arquivo e o relatório normal sai com permissão 600', async () => {
    await env.setup();
    const before = env.files().length;
    env.recon([], { dry: true });
    assert.equal(env.files().length, before, 'dry-run gravou arquivo');
    const r = env.recon();
    for (const f of env.files()) assert.equal((statSync(join(env.out, f)).mode & 0o777).toString(8), '600', f);
    assert.ok(r.md.includes('Código de evidência'));
  });
});

describe('Recusas e códigos de saída', () => {
  test('trava ocupada (carga, contas ou limpeza em andamento): erro, saída 1, nada gravado', async () => {
    await env.setup();
    const c = await pg();
    try {
      await c.query(`SELECT pg_advisory_lock(hashtextextended('mci.e4.load', 0))`);
      const files = env.files().length;
      const r = env.recon([], { dry: true });
      assert.equal(r.status, 1, r.out);
      assert.match(r.out, /em andamento/);
      const r2 = env.recon();
      assert.equal(r2.status, 1);
      assert.equal(env.files().length, files, 'a recusa não gera relatório');
    } finally { await c.query(`SELECT pg_advisory_unlock_all()`); await c.end(); }
  });
  test('enquanto a reconciliação lê, uma carga e a criação de contas não começam (trava compartilhada mantida durante a leitura)', async () => {
    await env.setup();
    const blocker = await pg();
    try {
      // A leitura trava numa tabela da carga: a reconciliação já pegou a trava e fica esperando.
      await blocker.query('BEGIN');
      await blocker.query('LOCK TABLE public.members IN ACCESS EXCLUSIVE MODE');
      const child = spawn('node', ['--no-deprecation', resolve(ROOT, 'src/reconcile.mjs'), '--config', env.cfg, '--dry-run', '--at', AT]);
      let buf = '';
      child.stdout.on('data', (d) => { buf += d; }); child.stderr.on('data', (d) => { buf += d; });
      const closed = new Promise((res) => child.on('close', res));
      for (let t = Date.now(); Date.now() - t < 15000;) {
        const [x] = await q(`SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND mode = 'ShareLock' AND granted`);
        const [w] = await q(`SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND application_name = 'mci-data-migration'`);
        if (x && w) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      const acc = spawnSync('node', ['--no-deprecation', resolve(ROOT, 'src/accounts.mjs'), '--config', env.cfg, '--dry-run', '--out-dir', join(env.work, 'acc2')], { encoding: 'utf8', timeout: 60000 });
      assert.notEqual(acc.status, 0, 'as contas começaram com a reconciliação lendo');
      assert.match(acc.stdout + acc.stderr, /em andamento/);
      const ul = spawnSync('node', ['--no-deprecation', resolve(ROOT, 'src/unload.mjs'), '--config', env.cfg, '--dry-run', '--out-dir', join(env.work, 'ul')], { encoding: 'utf8', timeout: 60000 });
      assert.notEqual(ul.status, 0, 'a limpeza começou com a reconciliação lendo');
      await blocker.query('ROLLBACK');
      await closed;
      assert.match(buf, /Reconcilia/);
    } finally { await blocker.query('ROLLBACK').catch(() => {}); await blocker.end(); }
  });
  test('sem carga, com carga desfeita ou --load-run inexistente: erro (saída 1)', async () => {
    await env.setup();
    const bad = env.recon(['--load-run', '999'], { dry: true });
    assert.equal(bad.status, 1, bad.out);
    await sql(`UPDATE legacy._load_runs SET undone_at = now()`, { replica: false });
    const undone = env.recon([], { dry: true });
    assert.equal(undone.status, 1, undone.out);
    assert.match(undone.out, /Nenhuma carga/);
  });
  test('execução das contas ausente, falha ou desfeita reprova (saída 2), mesmo que as contas existam', async () => {
    await env.setup();
    await sql(`UPDATE legacy._accounts_runs SET status = 'failed'`, { replica: false }).catch(() => {});
    let r = env.recon();
    assert.equal(r.status, 2, r.out);
    assert.equal(view(r.json).by.accounts_run.status, 'falha');
    await env.setup(world(), { accounts: false });
    r = env.recon();
    assert.equal(r.status, 2, 'sem a execução das contas não pode aprovar');
    assert.equal(view(r.json).by.accounts_run.status, 'falha');
  });
  test('carga anterior que não é a última ativa (--load-run) reprova', async () => {
    await env.setup();
    const { load } = await import('./harness.mjs');
    assert.equal(load(['--pastor-ids', '1', '--admin-ids', '1,2']).status, 0);
    const r = env.recon(['--load-run', '1']);
    assert.equal(r.status, 2, r.out);
    assert.equal(view(r.json).by.load_run.status, 'falha');
  });
  test('cópia do legado mais nova que a carga reprova', async () => {
    await env.setup();
    await sql(`UPDATE legacy._copy_runs SET finished_at = finished_at + interval '1 hour' WHERE id = (SELECT max(id) FROM legacy._copy_runs)`, { replica: false });
    const r = env.recon();
    assert.equal(r.status, 2);
    assert.equal(view(r.json).by.load_after_copy.status, 'falha');
  });
  test('argumentos inválidos: --at, --seed, --credential-sample, opção desconhecida, --yes e sem arquivo de configuração (saída 1)', async () => {
    await env.setup();
    for (const a of [['--at', 'ontem'], ['--at', '2026-13-45'], ['--seed', 'a b;drop'], ['--credential-sample', '501'], ['--credential-sample', '-1'],
      ['--credential-sample', 'x'], ['--yes'], ['--bogus'], ['--pastor-ids', 'abc'], ['--load-run', 'abc']]) {
      const r = env.recon(a, { dry: true });
      assert.equal(r.status, 1, `${a.join(' ')} → ${r.status}\n${r.out}`);
    }
    const none = spawnSync('node', ['--no-deprecation', resolve(ROOT, 'src/reconcile.mjs'), '--config', '/nao/existe', '--dry-run'], { encoding: 'utf8' });
    assert.equal(none.status, 1);
    const help = spawnSync('node', ['--no-deprecation', resolve(ROOT, 'src/reconcile.mjs'), '--help'], { encoding: 'utf8' });
    assert.equal(help.status, 0);
  });
  test('situação do painel: --at muda a semana de referência (célula pendente aparece e some)', async () => {
    await env.setup();
    const a = env.recon(['--at', '2026-11-10 12:00']).json.checks.find((c) => c.code === 'report_situation_counts').metrics[0];
    const b = env.recon(['--at', '2026-11-14 23:00']).json.checks.find((c) => c.code === 'report_situation_counts').metrics[0];
    assert.notEqual(a.week_start + a.legacy_pending, b.week_start + b.legacy_pending);
    assert.equal(a.legacy_pending, a.new_pending_loaded);
    assert.equal(b.legacy_pending, b.new_pending_loaded);
  });
  test('situação do relatório: relatório da semana excluído no novo reprova (e o motivo "ficou de fora" não o esconde)', async () => {
    const { v } = await inject(() => sql(`UPDATE public.cell_reports SET deleted_at = now(), deleted_by_kind = 'system' WHERE legacy_id = 2`));
    flags(v, 'report_status', [2]);
  });
});

describe('Dado pessoal, MD5 e chave nas saídas', () => {
  test('nenhuma saída (terminal, .md, .json) cita nome, e-mail, CPF, celular, endereço, texto livre, MD5, bcrypt ou a chave', async () => {
    await env.setup();
    // Uma execução aprovada, uma reprovada com várias divergências, uma recusada e uma com erro de argumento.
    env.recon();
    await sql(`UPDATE public.members SET name = 'Nome Trocado Secreto', email = 'vazou@exemplo.org' WHERE legacy_id = 4;
      UPDATE public.cell_reports SET theme = 'Tema Secreto', visitors = '{Fulana Secreta}' WHERE legacy_id = 1;
      UPDATE public.cells SET street = 'Rua Secreta' WHERE legacy_id = 1`);
    env.recon();
    env.recon(['--at', 'xyz'], { dry: true });
    const text = env.outputs.join('\n');
    const secrets = [
      ...world().members.map((m) => m.Name), 'Gedoze', 'Discipula', 'Discipulo', 'Excluido', 'Inativa', 'Marido', 'Esposa', 'Filha', 'Cpfruim', 'Cpfbom',
      'exemplo.org', '@', '52998224725', '529.982.247-25', '99999-0017', '999990017', 'Rua Fictícia', 'Rua Outra', 'Porto Alegre', 'Canoas', 'Centro',
      'Chuva', 'Graca', 'Antigo', 'Nome Trocado Secreto', 'vazou', 'Tema Secreto', 'Fulana', 'Rua Secreta', 'Caio',
      ...Array.from({ length: 17 }, (_, i) => md5(`s${i + 1}`)), '$2a$', '$2b$', 'sb_secret_', 'g12pw', 'rootpw',
    ];
    for (const s of secrets) assert.ok(!text.includes(s), `a saída contém "${s}"`);
    const secretKey = (await import('./reconcile-world.mjs')).statusEnv().secret;
    assert.ok(secretKey && !text.includes(secretKey), 'a chave secreta vazou');
    assert.ok(!/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/.test(text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, '')), 'algo com forma de CPF');
    assert.ok(!/[0-9a-f]{32}/.test(text.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '')), 'algo com forma de MD5');
  });
  test('um erro de banco com valor de coluna na mensagem não vaza o valor (safeErrorMessage)', async () => {
    await env.setup();
    // --pastor-ids chega ao banco como parâmetro; um valor ilegível vira erro de argumento (sem eco do valor)
    const r = env.recon(['--pastor-ids', 'NomeSecretoDaPessoa'], { dry: true });
    assert.equal(r.status, 1);
    assert.ok(!r.out.includes('NomeSecretoDaPessoa') || /Ids/.test(r.out), r.out);
  });
});
