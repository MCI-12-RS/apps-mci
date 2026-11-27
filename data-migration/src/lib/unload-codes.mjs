// Catálogo das ocorrências de `npm run unload` (limpeza do ensaio, DT-13 do spec e4-carga).
//
// Cada código aparece em sql/unload/10_plan.sql (pg_temp.ul_issues) ou no runner, com o Id do
// legado ou o id do registro do novo (nunca nome, e-mail, CPF ou telefone). O teste unitário
// confere que todo código usado está aqui (e vice-versa).
//
// Categorias:
//   block    para a limpeza antes de apagar qualquer coisa (nada é gravado)
//   failure  a parte do Auth falhou depois do commit (o banco já está limpo; rodar de novo completa)
//   info     só informativo

import { createHash } from 'node:crypto';

export const UNLOAD_CATEGORIES = [
  ['block', 'Para a limpeza (nada foi apagado)'],
  ['failure', 'Falhou (rode de novo para completar)'],
  ['info', 'Informativo'],
];

/** code → [categoria, título] */
export const UNLOAD_CODES = {
  // Plano (sql/unload/10_plan.sql)
  adopted_member_missing: ['block', 'Adotado (legacy._load_adopted) cujo cadastro não existe mais: não há como devolver a linha de antes; conferir'],
  member_points_to_removed: ['block', 'Cadastro que fica (anterior à carga, ou criado no ensaio sem depender dela) tem como líder alguém que sai: troque o líder (ref = id do cadastro) e rode de novo'],
  cell_points_to_removed: ['block', 'Célula que fica tem líder, timóteo ou anfitrião que sai: troque a pessoa (ref = id da célula) e rode de novo'],
  report_points_to_removed: ['block', 'Relatório que fica é de uma célula que sai ou tem no retrato uma pessoa que sai (ref = id do relatório): conferir'],
  adopted_identifier_taken: ['block', 'O e-mail, celular ou CPF de antes do adotado está agora em outro cadastro que fica: o índice único barraria a volta; conferir'],
  spouse_conflict: ['block', 'Cônjuge que não fecha nos dois lados depois da volta do adotado (o outro casou no ensaio com outra pessoa): desfaça o vínculo e rode de novo'],
  spouse_unlinked: ['info', 'Cadastro que fica perdeu o cônjuge (o cônjuge sai, ou casou no ensaio com um adotado que volta com outro)'],
  spouse_restored: ['info', 'Cadastro que fica recuperou o cônjuge de antes (um adotado que volta; a carga tinha desfeito o vínculo)'],
  participant_removed_from_kept_report: ['info', 'Relatório que fica perdeu participantes que saem (ref = id do relatório; info = quantos)'],
  adopted_restored: ['info', 'Adotado: volta à linha de antes da carga (dados, função, conta e senha do novo); legacy_id nulo'],
  rehearsal_member_removed: ['info', 'Cadastro criado no ensaio que depende da carga (pela liderança): sai (Q-E4-2)'],
  rehearsal_cell_removed: ['info', 'Célula criada no ensaio com líder, timóteo ou anfitrião que sai: sai (Q-E4-2)'],
  rehearsal_report_removed: ['info', 'Relatório lançado no ensaio numa célula que sai, ou com pessoa do retrato que sai: sai (Q-E4-2)'],

  // Auth (runner, depois do commit)
  account_delete_failed: ['failure', 'A conta não foi apagada no Auth (info = status e código do Auth): rode de novo'],
  account_kept_linked: ['info', 'Conta pendente de uma limpeza anterior que voltou a ter cadastro ligado: fica'],
};

export const unloadCodeInfo = (code) => {
  const v = UNLOAD_CODES[code];
  return v ? { category: v[0], title: v[1] } : null;
};

/** Ocorrências que impedem a limpeza (código desconhecido também para). */
export const blockingUnloadIssues = (issues) => issues.filter((i) => (unloadCodeInfo(i.code)?.category ?? 'block') === 'block');

/** Quantidade de registros que a limpeza mexe (só decide se há o que gravar no banco). */
export function plannedTotal(plan) {
  const k = ['members', 'cells', 'reports', 'participants', 'adopted', 'accounts'];
  return k.reduce((s, key) => s + Number(plan[key] ?? 0), 0);
}

/**
 * Partes do conjunto planejado que entram no código de confirmação, em ordem fixa: os ids que
 * saem (membros, células, relatórios e os pares relatório:membro dos participantes), os adotados
 * que voltam e as contas que serão apagadas (as do plano, as pendentes de limpezas anteriores e
 * as com o Id do legado sem cadastro).
 */
export const CONFIRMATION_PARTS = ['members', 'cells', 'reports', 'participants', 'adopted', 'accounts'];

/** md5 dos ids em ordem crescente, separados por vírgula (o mesmo que o SQL do plano calcula). */
export function idsDigest(ids) {
  return createHash('md5').update([...ids].map((x) => String(x).toLowerCase()).sort().join(',')).digest('hex');
}

/**
 * Código de confirmação (--confirm): os 8 primeiros dígitos do SHA-256 das partes (cada uma um md5
 * da lista ordenada), no formato XXXX-XXXX. Muda quando muda o que sai, o que volta ou as contas,
 * mesmo com as mesmas quantidades.
 */
export function confirmationCode(digests) {
  const h = createHash('sha256');
  for (const k of CONFIRMATION_PARTS) h.update(`${k}:${digests[k] ?? idsDigest([])}\n`);
  const hex = h.digest('hex').slice(0, 8).toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4)}`;
}

/** --confirm: o código do --dry-run (maiúsculas ou minúsculas, com ou sem o hífen). */
export function parseConfirm(value) {
  if (value === undefined) return null;
  const v = String(value).trim().toUpperCase().replace(/-/g, '');
  if (!/^[0-9A-F]{8}$/.test(v)) throw new Error('--confirm precisa ser o código de confirmação que o --dry-run mostrou (XXXX-XXXX).');
  return `${v.slice(0, 4)}-${v.slice(4)}`;
}
