// Catálogo das ocorrências da carga (E4.06/E4.07, DT-07 a DT-12 do spec e4-carga).
//
// Cada código aparece em sql/load/*.sql como `code` em pg_temp.load_issues, com o
// Id do legado do registro e uma observação sem dado pessoal. O teste unitário
// confere que todo código usado no SQL está aqui (e vice-versa).
//
// Categorias:
//   block      para a carga nos dois modos (ensaio e --final)
//   legacy_fix pendência "corrigir no legado" (5.4): --final para; o ensaio neutraliza e lista (DT-12)
//   transform  tratado na transformação (5.4), nos dois modos; só listado
//   info       só informativo

export const LOAD_CATEGORIES = [
  ['block', 'Para a carga (nos dois modos)'],
  ['legacy_fix', 'Corrigir no legado (E4.05): --final para; o ensaio neutraliza'],
  ['transform', 'Tratado na transformação'],
  ['info', 'Informativo'],
];

/** code → { category, entity, title } */
export const LOAD_CODES = {
  // Pré-condições
  pastor_config_invalid: ['legacy_fix', 'Members', 'Pastor da D9 (LEGACY_PASTOR_IDS) que não existe, está excluído, tem líder ou está marcado "não tem liderança"; não vira pastor'],
  admin_config_invalid: ['legacy_fix', 'Members', 'Administrador (LEGACY_ADMIN_IDS) que não existe, ficou de fora, está excluído ou não tem identificador de login; não vira Administrador'],
  admin_adopted_keeps_role: ['info', 'Members', 'Administrador da lista que foi adotado: fica com a função do cadastro do novo (DT-11)'],
  admins_below_minimum: ['legacy_fix', 'Members', 'Menos de 2 Administradores não excluídos com identificador, contando os adotados (RN-18 c do E3); Id = quantidade'],

  // Membros que não podem ser gravados (nome e sexo são obrigatórios, também nos excluídos)
  member_name_empty: ['legacy_fix', 'Members', 'Não excluído com nome vazio: o membro fica de fora (e quem aponta para ele, como se ele não existisse)'],
  member_gender_invalid: ['legacy_fix', 'Members', 'Não excluído com sexo fora de 0 e 1: o membro fica de fora (e quem aponta para ele, como se ele não existisse)'],
  // Q-E4-6: o excluído não pode ser corrigido na tela do legado; fica de fora sem parar o --final.
  member_deleted_name_empty: ['transform', 'Members', 'Excluído com nome vazio: fica de fora (e quem aponta para ele, como se ele não existisse); não para o --final (Q-E4-6)'],
  member_deleted_gender_invalid: ['transform', 'Members', 'Excluído com sexo fora de 0 e 1: fica de fora (e quem aponta para ele, como se ele não existisse); não para o --final (Q-E4-6)'],
  member_birth_out_of_range: ['info', 'Members', 'Nascimento no futuro ou há 100 anos ou mais: migra como está (a tela avisa na edição)'],
  member_mobile_invalid_kept: ['info', 'Members', 'Celular que não é um número válido (10 ou 11 dígitos com DDD): migra só com os dígitos e não serve para o login'],

  // Identificadores (E2.04)
  member_email_dropped: ['transform', 'Members', 'E-mail inválido ou fictício: importado como nulo'],
  member_cpf_dropped: ['transform', 'Members', 'CPF inválido: importado como nulo'],
  member_email_duplicate: ['legacy_fix', 'Members', 'E-mail repetido entre não excluídos: fica só no menor Id (os outros, sem e-mail)'],
  member_mobile_duplicate: ['legacy_fix', 'Members', 'Celular repetido entre não excluídos (9º dígito conta como igual): fica só no menor Id'],
  member_cpf_duplicate: ['legacy_fix', 'Members', 'CPF repetido entre não excluídos: fica só no menor Id'],
  member_without_identifier: ['info', 'Members', 'Não excluído sem identificador de login depois da transformação: migra sem conta'],

  // Liderança (D9, D10, E2.06)
  member_leader_cycle: ['legacy_fix', 'Members', 'Ciclo na hierarquia: quebrado no menor Id do ciclo, que fica sem liderança'],
  member_leader_self: ['legacy_fix', 'Members', 'Membro não excluído com líder = a própria pessoa: fica sem liderança'],
  member_leader_self_deleted: ['transform', 'Members', 'Membro excluído com líder = a própria pessoa: o líder é descartado'],
  member_leader_missing: ['info', 'Members', 'Líder que não existe ou ficou de fora: migra sem liderança'],
  member_no_leader_not_marked: ['info', 'Members', 'Sem líder e sem "não tem liderança", fora os pastores da D9: migra sem liderança'],
  member_no_leadership_with_leader: ['transform', 'Members', '"Não tem liderança" marcado com líder preenchido: o líder é descartado'],
  member_leader_deleted: ['info', 'Members', 'Membro não excluído com líder excluído: migra assim (D10; reatribuir)'],

  // Cônjuge (DEL-05)
  member_spouse_dropped: ['transform', 'Members', 'Cônjuge = a própria pessoa, inexistente, de fora ou excluído (de qualquer lado): o vínculo é desfeito'],
  member_spouse_not_reciprocal: ['legacy_fix', 'Members', 'Cônjuge não recíproco entre não excluídos: o vínculo é desfeito'],
  member_baptism_date_dropped: ['transform', 'Members', 'Data de batismo sem "batizado": fica nula'],

  // Adoção (DT-09, Q-E4-1)
  member_adopted: ['info', 'Members', 'Adotado: cadastro do novo ligado a este membro do legado (fica o id, a conta, a senha e a função do novo; os dados vêm do legado)'],
  adoption_ambiguous: ['block', 'Members', 'Coincidência ambígua com cadastros do novo (um do novo com dois do legado, ou o contrário): resolver antes'],
  identifier_conflict_new: ['block', 'Members', 'Identificador igual ao de um cadastro do novo que não pode ser adotado (já ligado a outro Id ou de fora da carga)'],
  member_stale: ['info', 'Members', 'Carregado antes e ausente agora (ficou de fora ou sumiu do legado): não é mexido; rode a limpeza'],

  // Células (E2.08)
  cell_time_invalid: ['legacy_fix', 'Cells', 'Horário fora de HH:mm: a célula fica de fora, com os relatórios'],
  cell_weekday_invalid: ['legacy_fix', 'Cells', 'Dia fora de 0 a 6: a célula fica de fora, com os relatórios'],
  cell_type_invalid: ['legacy_fix', 'Cells', 'Tipo fora de 0 a 2: a célula fica de fora, com os relatórios'],
  cell_person_missing: ['legacy_fix', 'Cells', 'Célula não excluída com líder, timóteo ou anfitrião inexistente ou de fora: a célula fica de fora'],
  cell_person_deleted: ['legacy_fix', 'Cells', 'Célula não excluída com líder, timóteo ou anfitrião excluído (RN-13 do E2.08): a célula fica de fora'],
  cell_deleted_person_missing: ['transform', 'Cells', 'Célula excluída com líder, timóteo ou anfitrião inexistente ou de fora: fica de fora (as três pessoas são obrigatórias)'],
  cell_stale: ['info', 'Cells', 'Carregada antes e ausente agora: não é mexida; rode a limpeza'],

  // Relatórios (E2.11)
  report_cell_missing: ['transform', 'Reports', 'Relatório de célula que não existe no legado: fica de fora'],
  report_cell_left_out: ['transform', 'Reports', 'Relatório de célula que ficou de fora: fica de fora'],
  report_date_missing: ['transform', 'Reports', 'Relatório sem data: fica de fora'],
  report_offering_out_of_range: ['legacy_fix', 'Reports', 'Oferta negativa ou acima de R$ 999.999,99: o relatório fica de fora'],
  report_duplicate_week: ['transform', 'Reports', 'Mais de um na mesma célula e semana: fica o de maior Id; os outros migram excluídos pelo sistema (Q-E4-4)'],
  report_snapshot_from_cell: ['info', 'Reports', 'Retrato com pessoa inexistente, de fora ou tipo vazio ou inválido: completado pela célula'],
  report_held_without_theme: ['info', 'Reports', 'Célula realizada sem tema: migra como está (Q-E4-3)'],
  report_held_without_offering: ['info', 'Reports', 'Célula realizada sem oferta: migra como está (a edição pede a oferta)'],
  report_skipped_without_reason: ['info', 'Reports', '"Não houve célula" sem motivo: migra como está (a edição pede o motivo)'],
  report_snapshot_not_participant: ['info', 'Reports', 'Célula realizada em que líder, timóteo ou anfitrião do retrato não está entre os participantes: migra como está, sem inventar presença (PR2-9)'],
  report_week_conflict_new: ['block', 'Reports', 'A célula já tem, no novo, outro relatório não excluído na mesma semana: resolver ou rodar a limpeza antes'],
  report_stale: ['info', 'Reports', 'Carregado antes e ausente agora: não é mexido; rode a limpeza'],

  // Participantes (5.5)
  participant_left_out: ['transform', 'ReportMembers', 'Participante cujo membro ou relatório não existe ou ficou de fora (Id = relatório; info = membro)'],
};

export const loadCodeInfo = (code) => {
  const v = LOAD_CODES[code];
  if (!v) return null;
  return { category: v[0], entity: v[1], title: v[2] };
};

/**
 * Ocorrências que impedem a gravação: `block` sempre; `legacy_fix` só no --final.
 * issues: [{ code, n }]
 */
export function blockingIssues(issues, { final }) {
  return issues.filter((i) => {
    const info = loadCodeInfo(i.code);
    if (!info) return true; // código desconhecido: para (o teste unitário evita isso)
    return info.category === 'block' || (final && info.category === 'legacy_fix');
  });
}

/** Maior Id do legado (int do MySQL e integer do Postgres). */
export const PG_INT_MAX = 2147483647;

/** Lista de Ids do legado (texto de configuração ou argumento): "1, 2;3". */
export function parseIdList(text, label) {
  if (!text) return [];
  const ids = String(text).split(/[\s,;]+/).filter(Boolean).map((v) => {
    if (!/^\d+$/.test(v) || Number(v) <= 0) throw new Error(`${label} precisa ser uma lista de Ids numéricos.`);
    if (Number(v) > PG_INT_MAX) throw new Error(`${label}: o Id ${v} passa do maior Id possível (${PG_INT_MAX}).`);
    return Number(v);
  });
  return [...new Set(ids)].sort((a, b) => a - b);
}
