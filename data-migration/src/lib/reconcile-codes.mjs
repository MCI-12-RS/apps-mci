// Catálogo da reconciliação (E4.09, DT-15 do spec e4-carga; 5.6 do docs/migracao.md).
//
// Cada verificação (CHECKS) sai de sql/reconcile/*.sql na coluna `code`; cada diferença
// esperada (EXPECTED) sai na coluna `expected`, como códigos candidatos separados por vírgula.
// O teste unitário confere que todo código usado no SQL está aqui (e vice-versa).
//
// Tipos de verificação:
//   compare   diferenças registro a registro: falha se houver alguma inesperada
//   metric    números: falha se algum vier com ok = false; ok nulo é só informativo
//   empty     lista do banco que precisa voltar vazia: falha se houver item
//   attention lista para a liderança: nunca falha (aparece como "atenção")
//   sample    amostra para a conferência manual
//
// Diferença esperada: o primeiro candidato que vale. Os de `doc: 'load'` são ocorrências da
// carga e só valem se o Id do legado estiver na lista daquele código na carga conferida
// (legacy._load_runs.lists): o motivo foi documentado no relatório da carga. Os demais são da
// própria reconciliação (a condição é conferida no SQL). Candidato que não vale vira diferença
// inesperada, com o motivo.

import { createHash } from 'node:crypto';

export const RECONCILE_SECTIONS = [
  ['preconditions', 'Pré-condições'],
  ['counts', 'Contagens'],
  ['members', 'Membros'],
  ['cells', 'Células'],
  ['reports', 'Relatórios e participantes'],
  ['hierarchy', 'Hierarquia e totais'],
  ['situation', 'Situação do relatório'],
  ['authorship', 'Autoria do legado'],
  ['accounts', 'Contas, credenciais e funções'],
  ['db', 'Listas de problemas do banco'],
  ['dashboard', 'Painel da semana (igreja toda)'],
  ['samples', 'Amostra para a conferência manual'],
];

/** code → [section, type, title] */
export const CHECKS = {
  // Pré-condições (calculadas no script)
  load_run: ['preconditions', 'metric', 'Carga conferida (legacy._load_runs)'],
  load_after_copy: ['preconditions', 'metric', 'A carga é posterior à última cópia do legado'],
  accounts_run: ['preconditions', 'metric', 'Última execução das contas (legacy._accounts_runs)'],

  counts: ['counts', 'metric', 'Contagens por entidade e situação: legado − fora da carga ∓ duplicados = novo'],
  new_only_counts: ['counts', 'metric', 'Registros sem Id do legado no novo (antes da carga e durante ou depois dela)'],
  new_only_after_load: ['counts', 'attention', 'Registros sem Id do legado criados durante ou depois da carga'],
  new_only_duplicate: ['counts', 'compare', 'Registro sem Id do legado igual a um carregado (identificador, célula ou semana)'],
  offering_month: ['reports', 'metric', 'Soma das ofertas por mês: legado − fora da carga − duplicados = novo'],

  member_missing: ['members', 'compare', 'Membro do legado sem cadastro no novo'],
  member_extra: ['members', 'compare', 'Cadastro do novo com Id do legado que o legado não tem'],
  member_status: ['members', 'compare', 'Excluído ou ativo diferente do legado'],
  member_field: ['members', 'compare', 'Campo diferente do legado (nome, sexo, identificadores, nascimento, batismo, pastor, observações, endereço)'],
  member_leader: ['members', 'compare', 'Líder diferente do legado'],
  member_spouse: ['members', 'compare', 'Cônjuge diferente do legado'],

  cell_missing: ['cells', 'compare', 'Célula do legado sem cadastro no novo'],
  cell_extra: ['cells', 'compare', 'Célula do novo com Id do legado que o legado não tem'],
  cell_status: ['cells', 'compare', 'Excluída diferente do legado, ou inativa no novo'],
  cell_field: ['cells', 'compare', 'Campo diferente do legado (pessoas, dia, horário, tipo, endereço)'],

  report_missing: ['reports', 'compare', 'Relatório do legado sem cadastro no novo'],
  report_extra: ['reports', 'compare', 'Relatório do novo com Id do legado que o legado não tem'],
  report_status: ['reports', 'compare', 'Excluído diferente do legado'],
  report_field: ['reports', 'compare', 'Campo diferente do legado (célula, data, horário, realizada, tema, observações, motivo, visitantes, oferta)'],
  report_snapshot: ['reports', 'compare', 'Retrato (líder, timóteo, anfitrião, tipo) diferente do legado'],
  report_snapshot_invalid: ['reports', 'compare', 'Retrato com pessoa inexistente ou tipo fora da lista'],
  report_snapshot_type_from_cell: ['reports', 'metric', 'Relatórios com o tipo do retrato vindo da célula'],
  participant_missing: ['reports', 'compare', 'Participante do legado que não está no novo'],
  participant_extra: ['reports', 'compare', 'Participante do novo que o legado não tem'],
  report_participants_count: ['reports', 'compare', 'Participantes por relatório = NumMembers'],
  report_visitors_count: ['reports', 'compare', 'Visitantes por relatório = NumVisitors'],

  leader_cycle: ['hierarchy', 'compare', 'Ciclo de liderança no novo'],
  spouse_reciprocal: ['hierarchy', 'compare', 'Cônjuge não recíproco no novo'],
  member_level: ['hierarchy', 'compare', 'Nível: 12 ^ nível (até 12^6) = MinistryLevel; sem liderança = 9999999'],
  member_totals: ['hierarchy', 'compare', 'Totais de discípulos e de células recalculados a partir do legado (sem inativos e excluídos)'],
  ranking_g12: ['hierarchy', 'metric', 'Ranking G12: soma das células dos G12 = células ativas sob os G12'],
  cells_by_gender: ['hierarchy', 'metric', 'Células masculinas e femininas não zeradas (recálculo feito)'],
  hierarchy_problems: ['hierarchy', 'attention', 'Para a liderança: sem topo, líder de célula excluído, sem liderança com discípulos'],

  report_situation: ['situation', 'compare', 'Pendente na semana de referência: legado × novo, célula a célula'],
  report_situation_counts: ['situation', 'metric', 'Card de células com relatório pendente'],

  authorship_member: ['authorship', 'compare', 'Autoria dos membros igual à do legado'],
  authorship_cell: ['authorship', 'compare', 'Autoria das células igual à do legado'],
  authorship_report: ['authorship', 'compare', 'Autoria dos relatórios igual à do legado'],
  authorship_kinds: ['authorship', 'metric', 'Autoria por tipo de autor'],

  account_missing: ['accounts', 'compare', 'Membro elegível sem a conta dele'],
  account_unexpected: ['accounts', 'compare', 'Conta de carregado excluído ou sem identificador'],
  account_orphan: ['accounts', 'compare', 'Conta com Id do legado sem o cadastro desse Id'],
  credential_missing: ['accounts', 'compare', 'Membro com conta sem credencial legada'],
  credential_unexpected: ['accounts', 'compare', 'Credencial legada de quem não deveria ter'],
  credential_hash_mismatch: ['accounts', 'compare', 'Amostra de credenciais: o bcrypt confere com o MD5 do legado (go/no-go: todas)'],
  role_mismatch: ['accounts', 'compare', 'Função da RN-18 do E3 (Administrador pela lista, Líder para o G12, a padrão para os demais)'],
  admins: ['accounts', 'metric', 'Pelo menos 2 Administradores não excluídos, com conta e identificador'],
  credentials: ['accounts', 'metric', 'Credenciais legadas: membros com conta e senha utilizável'],

  db_hierarchy_drift: ['db', 'empty', 'private.member_hierarchy_drift() vazia'],
  db_member_rules: ['db', 'empty', 'private.member_rule_violations() vazia'],
  db_cell_rules: ['db', 'empty', 'private.cell_rule_violations() vazia'],
  db_active_periods: ['db', 'empty', 'private.cell_active_period_problems() vazia'],
  db_credential_problems: ['db', 'empty', 'private.legacy_credential_problems() vazia'],

  dashboard: ['dashboard', 'metric', 'Painel da igreja toda na semana de referência (legado × novo)'],

  sample_member: ['samples', 'sample', '20 membros'],
  sample_cell: ['samples', 'sample', '10 células'],
  sample_report: ['samples', 'sample', '10 relatórios'],
};

/** expected code → [doc ('load' = listado na carga) | null, title] */
export const EXPECTED = {
  member_name_empty: ['load', 'Nome vazio: fica de fora (corrigir no legado)'],
  member_gender_invalid: ['load', 'Sexo inválido: fica de fora (corrigir no legado)'],
  member_deleted_name_empty: ['load', 'Excluído com nome vazio: fica de fora (Q-E4-6)'],
  member_deleted_gender_invalid: ['load', 'Excluído com sexo inválido: fica de fora (Q-E4-6)'],
  member_email_dropped: ['load', 'E-mail inválido ou fictício: nulo no novo'],
  member_email_duplicate: ['load', 'E-mail repetido: fica só no menor Id'],
  member_mobile_duplicate: ['load', 'Celular repetido: fica só no menor Id'],
  member_cpf_dropped: ['load', 'CPF inválido: nulo no novo'],
  member_cpf_duplicate: ['load', 'CPF repetido: fica só no menor Id'],
  member_baptism_date_dropped: ['load', 'Data de batismo sem "batizado": nula no novo'],
  member_no_leadership_with_leader: ['load', '"Não tem liderança" com líder: o líder é descartado'],
  member_leader_self: ['load', 'Líder = a própria pessoa: fica sem liderança'],
  member_leader_self_deleted: ['load', 'Excluído com líder = a própria pessoa: o líder é descartado'],
  member_leader_missing: ['load', 'Líder inexistente ou de fora: fica sem liderança'],
  member_leader_cycle: ['load', 'Ciclo quebrado no menor Id: fica sem liderança'],
  member_spouse_dropped: ['load', 'Cônjuge a própria pessoa, inexistente, de fora ou excluído: vínculo desfeito'],
  member_spouse_not_reciprocal: ['load', 'Cônjuge não recíproco: vínculo desfeito'],
  member_no_leader_not_marked: ['load', 'Sem líder e sem "não tem liderança", fora dos pastores da D9: no legado aparece como Pastor (RN-13 do E2.06)'],

  cell_time_invalid: ['load', 'Horário inválido: fica de fora'],
  cell_weekday_invalid: ['load', 'Dia inválido: fica de fora'],
  cell_type_invalid: ['load', 'Tipo inválido: fica de fora'],
  cell_person_missing: ['load', 'Pessoa inexistente ou de fora: fica de fora'],
  cell_person_deleted: ['load', 'Pessoa excluída: fica de fora'],
  cell_deleted_person_missing: ['load', 'Excluída sem uma das três pessoas: fica de fora (Q-E4-7)'],

  report_cell_missing: ['load', 'Célula inexistente no legado: fica de fora'],
  report_cell_left_out: ['load', 'Célula de fora: o relatório fica de fora'],
  report_date_missing: ['load', 'Sem data: fica de fora (Q-E4-7)'],
  report_offering_out_of_range: ['load', 'Oferta fora da faixa: fica de fora'],
  report_duplicate_week: ['load', 'Duplicado na semana: vai excluído pelo sistema (Q-E4-4)'],
  report_snapshot_from_cell: ['load', 'Retrato com pessoa inexistente, de fora ou tipo inválido: completado pela célula (Q-E4-8)'],
  participant_left_out: ['load', 'Membro ou relatório de fora: o participante fica de fora'],

  legacy_num_members_mismatch: [null, 'O próprio legado diverge: NumMembers diferente dos participantes que ele guarda'],
  legacy_num_visitors_mismatch: [null, 'O próprio legado diverge: NumVisitors diferente dos nomes que ele guarda'],
  legacy_level_missing: [null, 'O legado não calculou o MinistryLevel (atualização por evento)'],
  level_no_top: [null, 'Sem topo (líder excluído acima): sem nível no novo'],
  level_follows_leader_change: [null, 'O líder desfeito pela carga (no membro ou acima) muda o nível'],
  total_new_records: [null, 'A diferença é só o que vem de cadastros ou células do novo'],
  week_not_counted: [null, 'A semana não conta no novo (cadastrada ou ativada depois do prazo, RN-06 do E2.09)'],
  deadline_tolerance: [null, 'A menos de 1 hora do prazo (a tolerância do legado é aproximada)'],
  report_left_out_week: [null, 'O relatório da semana ficou de fora da carga'],
  report_new_only_week: [null, 'Relatório da semana lançado só no novo'],
  account_on_deleted_member: [null, 'Carregado excluído com conta: só listado (PR4-8; o login não acha cadastro excluído)'],
  account_without_identifier: [null, 'Carregado sem identificador com conta: só listado (PR4-8)'],
  credential_unusable_md5: [null, 'Senha do legado vazia ou ilegível: sem credencial (a lista "sem senha" da 5.4)'],
  credential_has_password: [null, 'Já tem senha no novo: a credencial legada não é criada (RN-03 do E3)'],
};

// Comparação que, com zero comparados, não prova nada: sai como atenção (e não como ok).
export const ZERO_IS_ATTENTION = new Set(['credential_hash_mismatch']);

// Lote da amostra de credenciais: bcrypts por comando (~60 ms cada), longe dos 10 s do
// auto_explain de produção (risco 11 do E1.04).
export const CREDENTIAL_BATCH = 40;
// Teto do sorteio (~30 s); acima disso, "all" (o go/no-go), também em lotes.
export const CREDENTIAL_SAMPLE_MAX = 500;

/** --credential-sample: inteiro de 1 a CREDENTIAL_SAMPLE_MAX (padrão 20) ou "all". */
export function parseCredentialSample(text) {
  if (text == null) return 20;
  const t = String(text).trim().toLowerCase();
  if (t === 'all') return 'all';
  const n = /^\d+$/.test(t) ? Number(t) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > CREDENTIAL_SAMPLE_MAX) {
    throw new Error(`--credential-sample precisa ser um número de 1 a ${CREDENTIAL_SAMPLE_MAX} ou "all" (0 não confere nada).`);
  }
  return n;
}

/** Ids em lotes de até CREDENTIAL_BATCH. */
export function credentialBatches(ids, size = CREDENTIAL_BATCH) {
  const out = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

export const STATUS_LABEL = { ok: 'ok', falha: 'FALHA', atencao: 'atenção', info: 'info' };

export const checkInfo = (code) => {
  const v = CHECKS[code];
  return v ? { section: v[0], type: v[1], title: v[2] } : null;
};

export const expectedInfo = (code) => {
  const v = EXPECTED[code];
  return v ? { doc: v[0], title: v[1] } : null;
};

/** lists de legacy._load_runs (código → Ids) como Map<código, Set<Id>>. */
export function docSets(lists) {
  const out = new Map();
  for (const [code, ids] of Object.entries(lists ?? {})) {
    if (!Array.isArray(ids)) continue;
    out.set(code, new Set(ids.filter((v) => v != null).map((v) => Number(v))));
  }
  return out;
}

/**
 * Resolve os candidatos de uma diferença: o primeiro que vale. Devolve { code } (esperada)
 * ou { code: null, note } (inesperada).
 */
export function resolveExpected(candidatesText, lid, docs) {
  const candidates = String(candidatesText ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!candidates.length) return { code: null, note: null };
  const refused = [];
  for (const c of candidates) {
    const info = expectedInfo(c);
    if (!info) { refused.push(`${c} (desconhecido)`); continue; }
    if (info.doc === 'load' && !(lid != null && docs.get(c)?.has(Number(lid)))) { refused.push(c); continue; }
    return { code: c, note: null };
  }
  return { code: null, note: `motivo não listado na carga: ${refused.join(', ')}` };
}

/**
 * Classifica as linhas do SQL por verificação. rows: [{ kind, code, lid, ref, detail, expected, data }].
 * Devolve [{ code, section, type, title, status, compared, unexpected[], expected[], items[], metrics[] }]
 * na ordem do catálogo. Código desconhecido é um erro (o SQL e o catálogo divergem).
 */
export function classify(rows, docs) {
  const by = new Map(Object.keys(CHECKS).map((code) => [code, {
    code, ...checkInfo(code), compared: null, unexpected: [], expected: [], items: [], metrics: [], seen: false,
  }]));
  for (const r of rows) {
    const c = by.get(r.code);
    if (!c) throw new Error(`Verificação desconhecida no SQL da reconciliação: ${r.code}`);
    c.seen = true;
    const lid = r.lid == null ? null : Number(r.lid);
    if (r.kind === 'compared') {
      c.compared = Number(r.data?.n ?? 0);
    } else if (r.kind === 'metric') {
      c.metrics.push({ ref: r.ref ?? null, data: r.data ?? {} });
    } else if (r.kind === 'item') {
      c.items.push({ lid, ref: r.ref ?? null, detail: r.detail ?? null });
    } else if (r.kind === 'diff') {
      const res = resolveExpected(r.expected, lid, docs);
      const item = { lid, ref: r.ref ?? null, detail: r.detail ?? null };
      if (res.code) c.expected.push({ ...item, reason: res.code });
      else c.unexpected.push({ ...item, note: res.note });
    } else {
      throw new Error(`Tipo de linha desconhecido no SQL da reconciliação: ${r.kind}`);
    }
  }
  for (const c of by.values()) c.status = checkStatus(c);
  return [...by.values()];
}

export function checkStatus(c) {
  switch (c.type) {
    case 'compare':
      if (c.unexpected.length) return 'falha';
      if (c.compared == null) return 'falha'; // o SQL não disse quantos comparou
      if (c.compared === 0 && ZERO_IS_ATTENTION.has(c.code)) return 'atencao';
      return 'ok';
    case 'metric': {
      if (!c.metrics.length) return 'falha';
      if (c.metrics.some((m) => m.data?.ok === false)) return 'falha';
      return c.metrics.every((m) => m.data?.ok == null) ? 'info' : 'ok';
    }
    case 'empty':
      return c.items.length ? 'falha' : 'ok';
    case 'attention':
      return c.items.length ? 'atencao' : 'ok';
    default:
      return 'info';
  }
}

/** Resumo: falhas, esperadas, atenção. */
export function summarize(checks) {
  const failures = checks.filter((c) => c.status === 'falha');
  return {
    approved: failures.length === 0,
    failures: failures.length,
    unexpected: checks.reduce((s, c) => s + c.unexpected.length, 0),
    expected: checks.reduce((s, c) => s + c.expected.length, 0),
    // Uma comparação em atenção (zero comparados) conta como um item.
    attention: checks.filter((c) => c.status === 'atencao').reduce((s, c) => s + (c.items.length || 1), 0),
  };
}

/**
 * Código de evidência: SHA-256 do resultado canônico (verificações, situações, números e
 * listas, sem tempos nem caminhos), em 4 grupos de 4. Cita o relatório no go/no-go.
 */
export function evidenceCode(payload) {
  const canonical = JSON.stringify(payload, (_k, v) => (v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
    : v));
  const hex = createHash('sha256').update(canonical).digest('hex').slice(0, 16).toUpperCase();
  return hex.match(/.{4}/g).join('-');
}

/** Instante de referência: ISO com fuso, ou "AAAA-MM-DD[ HH:MM]" no horário de Brasília. */
export function parseReferenceInstant(text) {
  if (!text) return null;
  const t = String(text).trim();
  const local = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2}))?$/.exec(t);
  if (local) return `${local[1]} ${local[2] ?? '23'}:${local[3] ?? '59'}:00 America/Sao_Paulo`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.test(t) && !Number.isNaN(Date.parse(t))) return t;
  throw new Error('--at precisa ser AAAA-MM-DD, "AAAA-MM-DD HH:MM" (horário de Brasília) ou um instante ISO com fuso.');
}
