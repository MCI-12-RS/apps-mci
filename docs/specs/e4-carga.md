# E4: Carga do legado (E4.02, E4.06 a E4.09)

> Status: em desenvolvimento (PR 1)
> Slug: `e4-carga` · Paridade com o legado: sim (migração dos dados)

<!-- Teto: 60 KB. Solução técnica + Tarefas até 20 KB. -->

## Negócio
_Escrito pelo `architect` a partir do `docs/migracao.md`: as regras já estão decididas lá e são só citadas aqui._

### Contexto e objetivo
Levar os dados do legado (cópia em `legacy.*`, E4.03) para o banco do novo, com as regras que o novo impõe, contas de acesso e credenciais legadas, e provar com a reconciliação que nada se perdeu. Ferramentas em `data-migration/` (E4.01). Os passos E4.03 (cópia) e E4.04 (saneamento) já estão prontos; E4.05 (correções no legado) é da liderança.

### Regras de negócio
Nenhuma regra nova. A carga segue:

| Assunto | Onde está |
|---|---|
| Princípios (legado só leitura, idempotência, ensaio no Supabase de produção, limpeza que preserva o que foi cadastrado no novo, LGPD) | 5.1 |
| Preparação do destino (`legacy_id`, retrato, autoria, `CHECK`s e índices antes da carga) | 5.3 |
| Tratamento de cada problema do saneamento (corrigir no legado × tratado na transformação) | 5.4 |
| Ordem da carga e mapeamento campo a campo (Members, Cells, Reports, ReportMembers) | 5.5 |
| Reconciliação | 5.6 |
| Ensaios (a senha trocada no ensaio se perde) | 5.7 |
| Contas (quem recebe, e-mail técnico, sem senha, `app_metadata.legacy_member_id`) | 6.2 |
| Credenciais legadas (`private.add_legacy_credential`) | 6.3; RN-01, RN-03, RN-09, RN-16, RN-17 do E3 |
| Funções na carga (Líder = G12, Administrador pela lista, Membro os demais) | 6.5; RN-18 do E3 |
| Decisões | D1 (excluídos migram com `deleted_at`), D2, D4, D5, D6, D7 (`mci12fakemail.com`), D9 (pastores), D10 |
| Autoria do legado | RN-10, RN-11 do E2.05 (`private.legacy_authorship`) |
| Retrato do relatório | REL-09; E2.11 (o trigger completa o tipo nulo em `replica`) |

### Perguntas em aberto
Nenhuma bloqueia o PR 1. As recomendações valem como padrão da implementação até a resposta.
- **Q-E4-1 (RN-16 b do E3). Quem já tem cadastro no novo e também está no legado.** A carga liga os dois pelo identificador (e-mail, celular ou CPF; DT-09). Os dados do cadastro (nome, contatos, endereço, liderança, cônjuge, batismo, situação, autoria) passam a ser os do legado, ou ficam os do novo? *Recomendação:* os do legado, porque ele é a fonte até o cutover; o novo mantém o id, a conta, a senha e a função.
- **Q-E4-2 (5.7). O que se perde na limpeza de um ensaio.** A 5.7 fala só da senha. Tudo o que for criado no novo durante o ensaio em cima da carga (cadastros, células, relatórios lançados, liderança apontando para alguém da carga) também é apagado? *Recomendação:* sim, tudo o que depende da carga; o que não depende fica.
- **Q-E4-3 (5.4, E2.11). Relatório realizado do legado sem tema.** Corrigir no legado, preencher na carga ou aceitar? (A oferta nunca vem nula: é obrigatória no legado.) *Recomendação:* aceitar como está; a edição pede o tema (RN-08 do E2.11).
- **Q-E4-4 (5.4). Relatórios duplicados na semana: qual fica.** "O mais recente" é o último registrado (maior `Id`) ou o de data mais tarde? *Recomendação:* o maior `Id`.
- **Q-E4-5 (5.7, RN-16 do E2.05). Auditoria do ensaio.** Os eventos gravados durante o ensaio (logins, edições) ficam depois da limpeza, porque a Auditoria é imutável? *Recomendação:* ficam; a retenção do E2.05 os apaga no prazo de cada categoria.
- Q-6 do E3 (os Administradores) continua com a liderança: a lista é entrada da carga (`LEGACY_ADMIN_IDS`) e não bloqueia os ensaios.

## Solução técnica

### Visão geral
| Passo | Onde | O quê |
|---|---|---|
| E4.02 + pré-requisito do E4.07 | `mci-connect`, migration `20261203100000_e4_01_load_support.sql` (PR 1) | `legacy_id`, guarda da coluna, `orphan_row` |
| E4.06 + E4.07 | `data-migration`: `npm run load` (PR 2) | transformação, backfill, funções (RN-18), validação, numa transação |
| limpeza dos ensaios | `data-migration`: `npm run unload` (PR 3) | apaga só o que é da carga e do ensaio (5.1) |
| E4.08 | `data-migration`: `npm run accounts` (PR 4) | contas no Auth e credenciais legadas |
| E4.09 | `data-migration`: `npm run reconcile` (PR 5) | relatório de reconciliação (5.6) |
| RN-09 do E3 | `mci-connect` (PR 6) | conta criada na restauração de quem veio excluído |

Todos os scripts seguem o E4.01: `local.config` sem exportar, travas de destino, `--dry-run`, sem dado pessoal no terminal, relatórios só com Ids do legado em `reports/`.

### Modelo de dados e migrations (PR 1)
- **DT-01. `legacy_id integer`** em `members`, `cells` e `cell_reports`, com `UNIQUE` (`<tabela>_legacy_id_key`, inclusive excluídos: os excluídos do legado também migram, D1) e `CHECK (legacy_id > 0)`. Participantes não têm (chave `report_id, member_id`). Em `members`, `GRANT SELECT (legacy_id) TO authenticated` (não é sensível; risco 4 do E1.08). Fora das views: o front não usa. Entra em `not_data` do `audit-fields.json` (E2.05).
- **DT-02. Só a carga grava `legacy_id`.** Trigger `zy_keep_legacy_id` (BEFORE INSERT/UPDATE nas três tabelas, função `public.keep_legacy_id()`, sem EXECUTE para a API): no INSERT a coluna vira nula, no UPDATE volta ao valor antigo, para todo papel, inclusive `postgres` e *service role*, sem erro (como a autoria, RN-03 do E2.05). A carga, a adoção e a limpeza rodam em `replica`, onde ele não dispara. Motivo: quem pudesse pôr o `legacy_id` de outra pessoa no próprio cadastro receberia na carga os dados e a função dela (RN-18: Administrador pela lista de Ids do legado).
- **DT-03. `orphan_row` (backlog do E2.06, risco da exclusão física em `replica`).** `private.member_hierarchy_drift()` e `private.cell_active_period_problems()` ganham o problema `orphan_row` (linha sem membro ou sem célula); `private.rebuild_member_hierarchy()` e `private.backfill_cell_active_periods()` apagam as órfãs antes do resto e as contam no retorno. Assinaturas iguais. A limpeza (PR 3) depende disso.

Nenhuma outra mudança de schema: autoria (`legacy_authorship`), retrato, credenciais (`add_legacy_credential`), recálculos e listas de problemas já existem. O controle da carga fica no schema `legacy` (DT-05), que não vai para produção como migration.

### Carga (`npm run load`, PR 2)
- **DT-04. Uma transação** como `postgres`: `SET LOCAL session_replication_role = replica`, `lock_timeout = '5s'`, `statement_timeout = '15min'`, e `LOCK TABLE members, cells, cell_reports, cell_report_participants IN EXCLUSIVE MODE` (leitura continua; gravação da tela espera ou recebe "tente de novo"). SQL em `data-migration/sql/load/NN_*.sql`, só conjuntos (`INSERT … SELECT FROM legacy.…`), sem parâmetro com dado pessoal (auto_explain, DT-19 do E1.04). `--dry-run` roda tudo e faz `ROLLBACK`, com as contagens e as listas. O primeiro comando confere que o `SET … replica` é aceito (ensaio 1 mede).
- **DT-05. Controle no `legacy`:** `legacy._load_runs` (início, fim, modo, commit da ferramenta, contagens, listas de Ids) e `legacy._load_adopted (member_id, legacy_id, before jsonb)`. O `npm run clean` (E4.03) passa a recusar enquanto houver carga no destino (`members.legacy_id` preenchido), salvo `--after-cutover`.
- **DT-06. Ordem** (5.5, sem o 2º passe): (1) pré-checagem; (2) mapa `pg_temp.member_map (legacy_id, id)` = `members.legacy_id` existente ∪ adotados (DT-09) ∪ `gen_random_uuid()`; (3) `members` com `leader_id`/`spouse_id` já pelo mapa, `INSERT … ON CONFLICT (legacy_id) DO UPDATE` (refazer dá o mesmo resultado); (4) `cells`; (5) `cell_reports`; (6) participantes (`ON CONFLICT DO NOTHING`); (7) `rebuild_member_hierarchy()`; (8) funções (DT-11); (9) `backfill_cell_active_periods()`; (10) validação (DT-10); fora da transação, `ANALYZE` das quatro tabelas.
- **DT-07. Transformação:** as tabelas da 5.5 e o "tratado na transformação" da 5.4, com as funções do próprio banco (`normalize_email`, `is_valid_email`, `is_placeholder_email`, `normalize_digits`, `is_valid_cpf`, `normalize_person_name`). Pastores pela D9 (`LEGACY_PASTOR_IDS`); quem não tem líder, não é pastor e não tem "não tem liderança" entra sem liderança. Cônjuge de si mesmo ou excluído vira nulo. Autoria das três tabelas por `private.legacy_authorship(…, now())`. Retrato: Ids do legado pelo mapa, tipo nulo completado pelo trigger. Visitantes: `string_to_array` por `|`, `btrim`, sem vazios. Oferta `round(…, 2)`. Relatório realizado sem tema migra como está (Q-E4-3).
- **DT-08. Duplicados na semana** (`cell_id`, `week_start(date)`, entre os não excluídos): fica o de maior `Id` (Q-E4-4); os outros migram excluídos com `deleted_at = now()` e `deleted_by_kind = 'system'` (aceito pelo `deleted_authorship_check`), listados.
- **DT-09. Adoção (RN-16 b do E3, Q-E4-1).** Membro do legado não excluído que coincide com um cadastro do novo (`legacy_id` nulo, não excluído) por `normalize_email`, `mobile_match_key` ou CPF: se a correspondência é 1 para 1, o cadastro do novo recebe o `legacy_id` (antes, a linha inteira vai para `legacy._load_adopted`) e os dados do legado; ficam o `id`, `auth_user_id`, `role_id` e a senha. Coincidência ambígua (um do novo com dois do legado, ou o contrário) para a carga, com os Ids.
- **DT-10. Validação no fim**, antes do *commit*: toda FK das quatro tabelas resolve (o `replica` não confere); `member_hierarchy_drift()`, `cell_active_period_problems()`, `member_rule_violations()` e `cell_rule_violations()` vazias; nenhum participante sem membro ou relatório. Qualquer item desfaz a carga e sai a lista.
- **DT-11. Funções (RN-18 do E3)**, só para quem não foi adotado: Administrador (`is_system`) para os Ids de `LEGACY_ADMIN_IDS`; Líder (por nome, a carga para se não achar) para `g12_level = 1` em `private.member_hierarchy`; a padrão para os demais, inclusive excluídos. No modo final, pelo menos 2 Administradores não excluídos com identificador (contando os adotados), senão para.
- **DT-12. Modos.** `--final` (cutover) para em qualquer pendência "corrigir no legado" do E4.04 (identificador repetido, ciclo, cônjuge não recíproco, horário, dia, tipo, oferta, célula com pessoa excluída). O padrão é ensaio: neutraliza e lista (identificador repetido fica só no menor `Id`; ciclo quebrado no menor `Id`, que fica sem liderança; célula com horário, dia ou tipo inválido e relatório com oferta fora da faixa ficam de fora, com seus relatórios e participantes).

### Limpeza do ensaio (`npm run unload`, PR 3)
**DT-13.** Uma transação, mesmas travas da carga, `--dry-run` com as contagens:
1. Conjuntos: **carga** = `legacy_id` preenchido e não adotado; **ensaio** = sem `legacy_id`, criado depois do início da primeira carga ativa (`legacy._load_runs`) e que aponta (direto ou por cadeia) para a carga (Q-E4-2). Cadastro anterior, não adotado, que passou a apontar para a carga: para a limpeza, com a lista.
2. Em `replica`: apaga participantes, relatórios, células e membros dos dois conjuntos e as linhas deles em `private.member_hierarchy`, `cell_active_periods`, `legacy_credentials`, `member_access_suspensions`; restaura os adotados a partir de `before` (com `legacy_id` nulo); autoria (`created_by`, `updated_by`, `deleted_by`) que aponte para quem saiu vira `*_by = NULL` com `*_kind = 'unknown'`.
3. De volta a `origin` (para as FKs em cascata do Auth): apaga de `auth.users` as contas com `raw_app_meta_data ? 'legacy_member_id'` que não são de adotados (o cofre cai em cascata).
4. `rebuild_member_hierarchy()` e `backfill_cell_active_periods()` (apagam órfãs, DT-03); `drift`, `problems` e as listas de regras vazias; `_load_runs` marcada como desfeita. `events` fica (Q-E4-5).

### Contas e credenciais (`npm run accounts`, PR 4)
**DT-14.**
- Elegíveis: da carga, não excluídos, `member_has_login_identifier`, `auth_user_id` nulo (adotados já têm conta, RN-16 a).
- Conta pela Admin API (`auth.admin.createUser`): `id` = id do membro, `email` = `member_account_email(id)`, `email_confirm: true`, `app_metadata.legacy_member_id`, sem senha (6.2, RN-08 do E2.03). Até 4 em paralelo. Já existe: confere o `legacy_member_id` e só religa; outro dono: para.
- Ligação: `UPDATE members SET auth_user_id = id` em `replica`, em lotes (sem Auditoria, RN-10 e do E2.05).
- Credenciais: `SELECT private.add_legacy_credential(m.id, lower(btrim(l."Password")))` direto do `legacy."Members"`, em lotes de 50 por comando (cerca de 3 s, longe dos 10 s do auto_explain e sem o hash em parâmetro), 4 conexões. Contagem por resultado; `unusable_md5` = a lista "sem senha" (5.4); quantos só passaram pelo `lower(btrim())` (sugestão do `code-reviewer` no mci-connect#60).
- Fim: `private.legacy_credential_problems()` vazia.

### Reconciliação (`npm run reconcile`, PR 5)
**DT-15.** Transação só leitura; cada item da 5.6 vira uma linha "ok/falha" com o número e os Ids do legado; código de saída diferente de zero se algo falhar. Inclui o E3 (`legacy_credential_problems()` vazia; `created` = membros com senha utilizável e conta; pelo menos 2 Administradores com conta), a autoria por tipo (RN-10 do E2.05), o retrato sem nulos e os totais recalculados a partir do legado (sem inativos, D2). O que exige pessoa (dashboard por perfil, login, amostragem) sai como lista de conferência manual para o E5.

### Conta na restauração (PR 6, RN-09 do E3)
**DT-16.** Edge Function `create-member-account` (JWT; `manage_roles`, o mesmo das listas de excluídos; membro não excluído, sem conta e com identificador), com a mesma etapa de conta da `create-user-admin` (id = id do membro, e-mail técnico, sem senha) e idempotente. A lista de excluídos a chama depois de restaurar quem não tem conta; o membro entra pela redefinição. Pode ir depois do cutover: até lá, é só quem foi excluído no legado e restaurado no novo.

### Onde cada regra é imposta
| Regra | Banco | Script |
|---|---|---|
| 5.3 `legacy_id` | DT-01, DT-02 | grava em `replica` |
| 5.4 tratamento | `CHECK`s e índices únicos (valem em `replica`) | DT-07, DT-08, DT-12 |
| 5.5 ordem e campos | `legacy_authorship`, trigger do retrato (`ENABLE ALWAYS`) | DT-06, DT-07 |
| E2.06 / E2.09 pós-carga | `rebuild_member_hierarchy`, `backfill_cell_active_periods`, `orphan_row` (DT-03) | DT-06 (7, 9) |
| 6.2, 6.3, RN-01/03 do E3 | `add_legacy_credential`, `legacy_credential_problems` | DT-14 |
| RN-18 do E3 | `exactly one default` (já existe) | DT-11 |
| 5.1 limpeza | `orphan_row` | DT-13 |
| 5.6 | listas de problemas do banco | DT-15 |

### Riscos
1. **`session_replication_role` no Supabase:** o `postgres` do pooler precisa poder fazer o `SET`; a primeira linha da carga confere, e o ensaio 1 mede. Plano B: desligar só os triggers de usuário das quatro tabelas na transação (`ALTER TABLE … DISABLE TRIGGER USER`), que trava as tabelas do mesmo jeito.
2. **Tempo:** recálculo de 20 mil membros cerca de 300 ms (E2.06); a carga deve ficar em segundos. Credenciais: cerca de 62 ms cada (E3), 4 conexões ≈ 3.800/min.
3. **Concorrência com a tela:** a trava `EXCLUSIVE` da carga e da limpeza segura as gravações por até o tempo da carga; rodar fora do horário de uso. O recálculo pega a trava da árvore como sempre.
4. **Limpeza no banco de produção:** apaga em `replica`, sem FK. Mitigação: `--dry-run` obrigatório antes (o script pede a contagem do *dry run* como confirmação), backup antes de cada ensaio (5.7), validações do passo 4 antes do *commit*.
5. **Adoção errada** (DT-09): um cadastro do novo ligado ao legado errado receberia os dados dele. Mitigação: 1 para 1 por identificador já único nos dois lados; a lista de adotados sai no relatório para conferência no ensaio 2.
6. **`legacy_id` e a tela:** coluna nova em `members` com SELECT por coluna; nada no front a lê.

## Tarefas
| # | Resp. | PR | Descrição | Arquivos | Regras | Pronto quando | Dep. |
|---|---|---|---|---|---|---|---|
| 1 | backend | 1 | Migration: DT-01 a DT-03, com guarda de pré-requisito e grants | `supabase/migrations/20261203100000_e4_01_load_support.sql` | 5.3; E2.06 backlog | migration aplica do zero e de novo | — |
| 2 | backend | 1 | `legacy_id` em `not_data` (três tabelas), SQL regenerado; `types.ts` regenerado | `supabase/tests/fixtures/audit-fields.json`, `supabase/tests/database/e205_02_audit_fields.test.sql`, `src/integrations/supabase/types.ts` | E2.05 DT-06 | sync do Vitest verde | 1 |
| 3 | backend/qa | 1 | pgTAP `e4_01_load_support`: estrutura e grants, guarda (INSERT e UPDATE por `authenticated`, *service role* e `postgres`; `replica` grava), `orphan_row` nas duas listas e apagada pelos dois recálculos | `supabase/tests/database/e4_01_load_support.test.sql` | DT-01 a DT-03 | pgTAP inteiro verde | 1 |
| 4 | backend | 2 | `npm run load` (DT-04 a DT-12) | `data-migration/src/load.mjs`, `sql/load/*.sql`, README | 5.4, 5.5, RN-18 | massa fictícia carrega; refazer não muda nada; `--final` para nos bloqueios | PR 1 na stack local |
| 5 | qa | 2 | `test:local` estendido: carga esperada da massa (`test/expected-load.json`), *dry run* sem escrita, adoção, ambiguidade, modo final | `data-migration/test/*` | idem | verde | 4 |
| 6 | backend | 3 | `npm run unload` (DT-13) e a recusa do `clean` (DT-05) | `src/unload.mjs`, `sql/unload/*.sql` | 5.1, 5.7 | carga → ensaio simulado → limpeza volta o destino ao estado anterior (cadastros do novo intactos, adotados restaurados) | 4 |
| 7 | backend | 4 | `npm run accounts` (DT-14), com o Auth da stack local no teste | `src/accounts.mjs`, `sql/accounts/*.sql` | 6.2, 6.3, RN-01/16 do E3 | refazer não cria nada; `legacy_credential_problems()` vazia | 4 |
| 8 | backend + qa | 5 | `npm run reconcile` (DT-15) | `src/reconcile.mjs`, `sql/reconcile.sql` | 5.6 | massa fictícia passa; cada item tem um caso que falha | 4, 7 |
| 9 | backend + front | 6 | `create-member-account` e a chamada na lista de excluídos (DT-16) | `supabase/functions/create-member-account/`, workflow, `src/pages/*Deleted*` | RN-09 do E3 | E2E da restauração com conta | — |

Ordem: PR 1 (merge e "Deploy: banco") → PR 2 → PRs 3 e 4 em paralelo → PR 5 → ensaio 1 (E5). PR 6 independente. PRs 2 a 5 são do `apps-mci` e não têm publicação.

### Divergências do PR 1
Implementação em `20261203100000_e4_01_load_support.sql`.
- **PR1-1. Nome do trigger:** `zy_keep_legacy_id`, o último BEFORE antes do carimbo `zz_stamp_authorship` nas três tabelas (a palavra final sobre a coluna). Com um nome `a0_`, ele passaria à frente do `a0_normalize_member`, que o E2.04 exige como primeiro BEFORE de `members` (pgTAP `e201_07` e `e204_02`).
- **PR1-2. Testes existentes ajustados:** a ordem dos BEFORE de `cells` (`e208_02`) e de `cell_reports` (`e211_01`, `e211_05`) ganha o `zy_keep_legacy_id`, e a lista dos três `CHECK`s de célula (`e208_02`) ignora o `cells_legacy_id_check`. `legacy_id` entrou em `not_data` das três tabelas (`audit-fields.json` e o SQL gerado).
- **PR1-3.** A migration termina com uma pós-condição: se houver linha órfã nas duas tabelas, roda os recálculos e falha se sobrar alguma.

## Testes
| Regra | Testes | Resultado |
|---|---|---|
| DT-01 a DT-03 | pgTAP `e4_01_load_support` (39): estrutura e privilégios; o `legacy_id` descartado pela API (Administrador), pela *service role* e pelo `postgres`, e aceito em `replica`, com o UNIQUE e o CHECK; `orphan_row` nas duas listas, apagada pelos dois recálculos, que depois não mudam nada. Conferido que 10 asserções falham com o trigger desligado | PR 1: pgTAP inteiro 68 arquivos, 5.741 asserções, verde; Vitest 172 arquivos, 2.533 testes; `tsc` e build verdes; lint com os 3 erros que já existem na `main` (`command.tsx`, `textarea.tsx`, `tailwind.config.ts`) |
