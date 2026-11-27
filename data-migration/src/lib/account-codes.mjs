// Catálogo das ocorrências de `npm run accounts` (E4.08, DT-14 do spec e4-carga).
//
// Cada código aparece em sql/accounts/*.sql (pg_temp.acc_issues) ou no runner, com o Id do
// legado e uma observação sem dado pessoal. O teste unitário confere que todo código usado
// está aqui (e vice-versa).
//
// Categorias:
//   block    para antes de criar qualquer conta
//   failure  a execução termina com erro (o que já foi feito fica; refazer completa)
//   info     só informativo (as listas da 5.4 e da reconciliação)

export const ACCOUNT_CATEGORIES = [
  ['block', 'Para antes de criar contas'],
  ['failure', 'Falhou (rode de novo depois de resolver)'],
  ['info', 'Informativo'],
];

/** code → [categoria, título] */
export const ACCOUNT_CODES = {
  // Plano (sql/accounts/10_plan.sql)
  account_other_owner: ['block', 'Já existe no Auth uma conta com o id deste membro ou com o e-mail técnico dele, de outro dono (sem o Id do legado dele): conferir antes'],
  account_legacy_id_taken: ['block', 'Outra conta (de outro id) já leva este Id do legado no app_metadata: sobra de uma carga anterior; rode a limpeza do ensaio'],
  account_link_unexpected: ['block', 'Membro carregado (não adotado) ligado a uma conta que não é a dele (id diferente, sem a conta ou sem o Id do legado): conferir antes'],
  member_without_identifier: ['info', 'Não excluído sem e-mail, celular ou CPF válido: fica sem conta (6.2)'],
  member_deleted_with_account: ['info', 'Excluído (no legado ou no novo) com conta ligada: a conta fica como está (a exclusão do novo a suspende)'],
  member_without_identifier_with_account: ['info', 'Sem identificador de login, mas com conta ligada (de uma execução anterior): a conta fica'],
  account_adopted_kept: ['info', 'Adotado que já tinha conta no novo: fica com ela e com a senha do novo, sem credencial legada (RN-16 a do E3)'],
  account_adopted_without_password: ['info', 'Adotado que já tinha conta no novo, mas sem senha no cofre: entra pela redefinição (6.4)'],
  account_orphan: ['info', 'Conta com Id do legado no app_metadata sem membro carregado com esse Id (Id = o do app_metadata): rode a limpeza do ensaio'],
  legacy_row_missing: ['info', 'Membro carregado sem a linha no legado copiado (sumiu do legado): a conta é criada, sem senha legada'],

  // Criação (runner)
  account_create_failed: ['failure', 'A conta não foi criada (info = status e código do Auth); rode de novo'],

  // Credenciais (sql/accounts/30_credentials.sql; o resultado da private.add_legacy_credential)
  credential_created: ['info', 'Credencial legada criada'],
  credential_updated: ['info', 'Credencial pendente regravada (a senha do legado mudou desde a execução anterior)'],
  credential_unchanged: ['info', 'Credencial pendente já igual à do legado: nada regravado'],
  credential_kept_used: ['info', 'Credencial já usada ou descartada (primeiro acesso ou redefinição): nunca é recriada (RN-03 do E3)'],
  credential_has_password: ['info', 'A conta já tem senha no novo: sem credencial legada (RN-03, RN-16 a do E3)'],
  credential_unusable_md5: ['info', 'Sem senha utilizável no legado (vazia, MD5 do texto vazio ou fora do formato): a lista "sem senha" da 5.4; entra pela redefinição (RN-08 do E3)'],
  credential_md5_normalized: ['info', 'MD5 do legado com maiúsculas ou espaços nas pontas: só passou depois do lower(btrim()) (já contado no resultado acima)'],
  credential_not_eligible: ['failure', 'A private.add_legacy_credential recusou o membro (excluído ou sem conta) depois da ligação: conferir'],
  credential_batch_failed: ['failure', 'Um lote de credenciais falhou (info = código do erro): refazer completa sem duplicar'],

  // Validação (sql/accounts/90_validate.sql)
  validate_legacy_credential_problem: ['failure', 'private.legacy_credential_problems() não está vazia (info = o problema)'],
  validate_account_missing: ['failure', 'Membro elegível sem a conta ligada (id = id do membro, e-mail técnico, Id do legado)'],
};

export const accountCodeInfo = (code) => {
  const v = ACCOUNT_CODES[code];
  return v ? { category: v[0], title: v[1] } : null;
};

/** Ocorrências que impedem a criação (código desconhecido também para). */
export const blockingAccountIssues = (issues) => issues.filter((i) => (accountCodeInfo(i.code)?.category ?? 'block') === 'block');

/** Resultados possíveis da private.add_legacy_credential, mais o atalho "unchanged" do lote. */
export const CREDENTIAL_RESULTS = ['created', 'updated', 'unchanged', 'kept_used', 'has_password', 'unusable_md5', 'not_eligible'];

/** Divide uma lista em lotes de `size`. */
export function chunk(list, size) {
  if (!Number.isInteger(size) || size < 1) throw new Error('tamanho de lote inválido');
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Inteiro de opção da linha de comando dentro de [min, max]. */
export function parseIntOption(value, label, { min, max, fallback }) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(String(value)) || Number(value) < min || Number(value) > max) {
    throw new Error(`${label} precisa ser um inteiro de ${min} a ${max}.`);
  }
  return Number(value);
}
