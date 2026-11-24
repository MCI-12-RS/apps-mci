# Migração g12app-net → mci-connect

Documento vivo do plano para sair do legado (`g12app-net`, .NET + MySQL) e ir para o novo sistema (`mci-connect`, React + Supabase).

> **Status:** ✅ feito · 🟡 parcial · ❌ falta · ❓ depende de decisão (seção 4)
> **Última revisão:** 2026-11-23

## Sumário

**Acompanhamento:** [Progresso](#progresso)

1. [Objetivo e fases](#1-objetivo-e-fases)
2. [Pré-requisitos no novo](#2-pré-requisitos-no-novo)
3. [Funcionalidades e regras a replicar](#3-funcionalidades-e-regras-a-replicar)
4. [Decisões pendentes](#4-decisões-pendentes)
5. [Migração dos dados](#5-migração-dos-dados)
6. [Usuários, perfis e senhas](#6-usuários-perfis-e-senhas)
7. [Cutover e desligamento do legado](#7-cutover-e-desligamento-do-legado)

## 1. Objetivo e fases

**Objetivo:** desligar o legado sem perda de funcionalidade nem de dados. Os usuários devem continuar entrando com o mesmo login e a mesma senha.

| Fase | O que é | Sai quando |
|---|---|---|
| 0. Decisões | Fechar as decisões da seção 4 | Todas as decisões tomadas |
| 1. Preparação | Pré-requisitos técnicos e de segurança no novo (seção 2) | Passos E1 concluídos |
| 2. Paridade | Implementar no novo as regras da seção 3 | Aceite geral do PO (E2.16) |
| 3. Contas e senhas | Login com a senha antiga, perfis e administradores (seção 6) | Passos E3 concluídos |
| 4. Ferramentas de migração | Scripts de cópia, saneamento, carga e validação (seção 5) | Passos E4 concluídos |
| 5. Ensaios | Migração completa em homologação (5.7) | Go/no-go aprovado |
| 6. Cutover | Congelar o legado, migrar a produção e liberar o novo (7.2) | Novo no ar |
| 7. Desligamento | Limpeza e desligamento do legado (7.4) | Legado desligado e backup arquivado |

- As fases 1 a 4 podem andar em paralelo, respeitando as dependências de cada passo.
- O andamento é marcado na seção [Progresso](#progresso).
- Consolidação e Escolas ficam fora deste documento. São features novas e só começam depois da fase 7. O spec de Escolas está em [`specs/escolas.md`](specs/escolas.md).

## Progresso

**Como marcar:**
- `[x]` = concluído; `[ ]` = não iniciado. Ao concluir, acrescente a data no fim da linha, ex.: `(2026-12-01)`.
- Em andamento: mantenha `[ ]` e comece o texto com 🔄. Bloqueado: comece com ⛔ e diga o motivo.
- Status das fases no resumo: ⬜ não iniciada · 🔄 em andamento · ✅ concluída.
- Atualize o resumo das fases sempre que marcar um passo.

**Quem marca:**
- **Fase 2 (paridade):** o `product-owner`, no aceite. O aceite exige testes passando, as regras da seção 3 atualizadas para ✅ e a matriz de paridade do `CLAUDE.md` atualizada.
- **Passos técnicos das fases 1, 3 e 4:** o `architect`, depois da revisão final.
- **Passos de liderança, operação e infraestrutura:** a pessoa responsável.

### Resumo das fases

| Fase | Status | Pode começar quando |
|---|---|---|
| 0. Decisões | ✅ | Já |
| 1. Preparação | 🔄 9 de 14 | Já |
| 2. Paridade | ⬜ | E1.01 concluído |
| 3. Contas e senhas | ⬜ | E1.04 concluído |
| 4. Ferramentas de migração | ⬜ | E1.01 e E1.10 concluídos |
| 5. Ensaios | ⬜ | Fases 2, 3 e 4 concluídas |
| 6. Cutover | ⬜ | E5.05 (go/no-go) |
| 7. Desligamento | ⬜ | Fim do plantão de suporte (E6.07) |

### Fase 0: Decisões (seção 4)

Responsável: liderança da igreja, com o `product-owner`.

- [x] **E0.01** D1: exclusão lógica. (2026-11-14)
- [x] **E0.02** D2: os totais contam inativos? **Não.** Libera o E2.06 (2026-11-23)
- [x] **E0.03** D3: quem pode lançar relatório: **líder, timóteo e anfitrião da célula, mais quem gerencia células no escopo.** Libera o E2.11 (2026-11-23)
- [x] **E0.04** D4: timóteo e anfitrião obrigatórios na célula: **sim, como no legado.** Libera o E2.08 (2026-11-23)
- [x] **E0.05** D5: identificadores de login aceitos: **e-mail real, celular ou CPF, cada um único.** Libera o E1.04 e o E2.04 (2026-11-23)
- [x] **E0.06** D6: prazo da migração de senhas: **sem prazo.** O E7.01 não será feito (2026-11-23)
- [x] **E0.07** D7: domínio dos e-mails fictícios: **um domínio controlado pela igreja.** Libera o E1.06 e o E4.08 (2026-11-23)
- [x] **E0.08** D8: retenção do banco legado: **backup criptografado por 12 meses, depois descartado** (2026-11-23)
- [x] **E0.09** D9: pastores: **Samuel Colares e Magda Colares** (casal). Libera o E4.06 (2026-11-23)
- [x] **E0.10** D10: exclusão de membro com discípulos ou células: **bloquear até reatribuir.** Libera o E2.01 (2026-11-23)

### Fase 1: Preparação (seção 2)

- [x] **E1.01** Preparar o banco novo (`gkhn…`). O banco foi zerado e recebeu as 34 migrations (2026-11-14, mci-connect#5). Passos:
  - aplicar o histórico **num banco zerado**, para provar que as migrations rodam do início ao fim;
  - resolver a definição dupla de `cell_reports`, a coluna `cells.name` (usada pela auditoria), os dois triggers de cônjuge e as políticas que se somam;
  - regenerar o `types.ts` a partir do banco.

  Escrever no banco exige autorização do usuário · _backend_
- [x] **E1.02** `create-user-admin`: exigir JWT e checar a permissão de quem chama · _backend_. Valida o perfil atribuído, grava o membro com a sessão de quem chama (o autor vai para a auditoria) e desfaz a conta se o cadastro falhar. Publicada em produção (2026-11-14, mci-connect#7)
- [x] **E1.03** Proteger as colunas restritas de `members` · AUT-05, AUT-07 · _backend_. Também fecha a escalada de privilégio via INSERT com o próprio `auth_user_id`, e agora as colunas calculadas são do servidor (2026-11-14, mci-connect#8)
- [ ] **E1.04** Função de login `sign-in` no lugar da `get-user-email`, com limite de tentativas. A parte da senha legada fica para o E3.02 · 6.3 · _backend + frontend_. Spec: [`specs/e1-04-sign-in.md`](specs/e1-04-sign-in.md) (desenho pronto; entra depois do PR 1 do E2.01)
- [x] **E1.05** ~~Remover a senha padrão `123456`~~ · **Não será feito.** Decisão D11: o `123456` fica como senha inicial padrão (2026-11-15)
- [ ] **E1.06** Configurar o domínio dos e-mails fictícios (D7) · _backend_
- [ ] **E1.07** Configurar SMTP próprio no Supabase Auth · _infra_
- [x] **E1.08** Paginação e contagem no servidor em Membros, Células, Relatórios, Ministérios e Dashboard · _frontend + backend_ (concluído em 2026-11-23)
  - Spec: `docs/specs/e1-08-paginacao-servidor.md` (decisões D-1 a D-5 respondidas em 2026-11-15). Cinco PRs.
  - PR 1 em produção (2026-11-15, mci-connect#12): `members_view` com o escopo do RLS, máscara de dados sensíveis (só para o próprio membro e quem tem `view_sensitive_data`), regra 6 do trigger (quem não vê não altera) e a tela de Membros paginada no servidor.
  - PRs 2 a 4 em produção (2026-11-23, promote do `14ee75f`):
    - PR 2 (mci-connect#14): Células e Relatórios paginados no servidor, pelas views `cells_view`, `cell_reports_view` e `cell_report_participants_view`;
    - PR 3 (mci-connect#15): Dashboard calculado no banco, em três RPCs. Corrige as células de segunda a sexta em "Células sem relatório";
    - PR 4 (mci-connect#16): árvore de Ministérios no banco (`ministry_tree_nodes`, uma chamada por expansão) e seletores com busca e paginação no servidor. Depois dele, o front não lê mais as tabelas `members` e `cells` diretamente.
  - PR 5 em produção (2026-11-23, mci-connect#17): SELECT por coluna em `members` para `authenticated`, sem as 8 colunas sensíveis; `anon` sem leitura; a `create-user-admin` devolve só o `id`.
  - Inclui: leituras de `members` por view ou RPC que mascara as colunas sensíveis (CPF, e-mail, telefones, endereço) para quem não tem `view_sensitive_data` (vindo do E1.13).
- [ ] **E1.09** Criar o projeto Supabase de homologação, com as mesmas migrations · _infra_
- [ ] **E1.10** Criar um usuário MySQL somente leitura em produção para a extração. Hoje o `local.config` usa o `doadmin` · _infra_
- [x] **E1.11** Remover as dependências do Lovable: `lovable-tagger` no `vite.config.ts`, a configuração do Playwright e o README do `mci-connect` · _frontend_. Também saíram os lockfiles do bun; o Playwright ganhou configuração própria e um teste de login (`npm run test:e2e`) (2026-11-15, mci-connect#11)
- [x] **E1.12** Definir e documentar o deploy: workflows manuais "Deploy: banco (Supabase)" e "Deploy: promote (Vercel)". O *auto-assign* de domínios foi desligado na Vercel, e o fluxo foi validado de ponta a ponta (2026-11-15, mci-connect#9). Ver "Deploy de produção" no `CLAUDE.md`
- [x] **E1.13** Auditoria e dados sensíveis: grants de `_log_event`, `log_auth_event` fechada para `anon`, autor nos cadastros via Edge Function, SELECT de `members` sem expor os líderes, e `view_sensitive_data` imposta no banco · _backend_
  - Concluído (2026-11-15, mci-connect#10; banco pelo workflow "Deploy: banco", front pelo "Deploy: promote"): auditoria só gravada pelos triggers, `log_auth_event` restrita, SELECT de `members` sem os dados dos líderes de fora (nomes via `member_names`), funções do RLS fechadas para `anon`. O autor nos cadastros já veio com o E1.02.
  - Movido para o E1.08: impor `view_sensitive_data` no banco. O legado não restringia dados de contato, e a mudança exige trocar todas as leituras de `members` por view/RPC.
- [x] **E1.14** Apontar o front para o projeto novo (2026-11-14, mci-connect#6):
  - `.env` e `supabase/config.toml` com o `gkhn…` e a chave pública dele;
  - variáveis de ambiente na Vercel;
  - Auth do projeto novo: Site URL, URLs de redirecionamento, **cadastro público desligado** e as Edge Functions publicadas.

  Resultado:
  - **Vercel:** as variáveis já apontavam para o `gkhn…` (integração Supabase ↔ Vercel), e a produção usa o banco novo.
  - **Repositório:** `.env` e `config.toml` atualizados (mci-connect#6).
  - **Auth**, configurado pela API de gestão:
    - Site URL `https://connect.mci12rs.com.br`;
    - redirects dos dois domínios, dos previews e do `localhost:8080`;
    - cadastro público desligado.
  - **Edge Functions:**
    - `create-user-admin` corrigida e publicada (E1.02);
    - `get-user-email` segue a versão antiga até o E1.04;
    - `change-member-password` não está publicada (E2.03).

  _frontend + usuário_

### Fase 2: Paridade (seção 3)

Cada passo vira um spec em `docs/specs/` e segue o fluxo do time de agentes: PO → architect → desenvolvedores → code-reviewer → QA → aceite do PO.

- [ ] **E2.01** Exclusão lógica · DEL-01 a DEL-09, MEM-11, CEL-08 · depende de D10 · é a base dos demais passos. Spec: [`specs/e2-01-exclusao-logica.md`](specs/e2-01-exclusao-logica.md) (desenho pronto; implementação depois do PR 4 do E1.08)
  - PR 1 em produção (2026-11-24, mci-connect#19): banco da exclusão lógica (colunas, FKs sem cascata, RPCs, views de excluídos, índice único da semana, suspensão da conta). Faltam os PRs 2 a 6.
- [ ] **E2.02** Perfis e escopo de visibilidade e escrita · AUT-02, AUT-03, AUT-04, 6.5. Spec: [`specs/e2-02-perfis-escopo.md`](specs/e2-02-perfis-escopo.md) (desenho pronto; entra depois do E2.01 em produção; inclui as raízes da árvore pelo escopo, DA-6)
- [ ] **E2.03** Redefinição de senha assistida e troca obrigatória de senha, incluindo o escopo e o perfil do alvo na `change-member-password` · AUT-06, 6.4. Spec: [`specs/e2-03-senha.md`](specs/e2-03-senha.md) (desenho pronto; entra depois do E1.04, do E2.01 e do E2.02 em produção)
- [ ] **E2.04** Validações de membro · MEM-01 a MEM-09 · depende de D5 (e HIE-01, antecipada do E2.06). Spec: [`specs/e2-04-validacoes-membro.md`](specs/e2-04-validacoes-membro.md) (desenho pronto; o PR 2 depende do E1.04 inteiro em produção)
- [ ] **E2.05** Auditoria (quem criou e quem alterou) · MEM-12. Spec: [`specs/e2-05-auditoria-autor.md`](specs/e2-05-auditoria-autor.md) (desenho pronto; entra depois do E2.01, E2.02, E1.04, E2.03 e E2.04 em produção)
- [ ] **E2.06** Hierarquia e totais · HIE-02 a HIE-04 (a HIE-01 foi para o E2.04) · depende de D2. Spec: [`specs/e2-06-hierarquia-totais.md`](specs/e2-06-hierarquia-totais.md) (desenho pronto; o PR 1 exige o PR 1 do E2.02)
- [ ] **E2.07** Listagem de membros com filtros e vínculo celular · MEM-13, MEM-14, MEM-15. Spec: [`specs/e2-07-filtros-membros.md`](specs/e2-07-filtros-membros.md) (desenho pronto; o PR 1 exige o banco do E2.05 e o PR 1 do E2.06 em produção)
- [ ] **E2.08** Cadastro de células · CEL-01 a CEL-04 · depende de D4. Spec: [`specs/e2-08-cadastro-celulas.md`](specs/e2-08-cadastro-celulas.md) (desenho pronto; o PR 1 espera o E2.01 inteiro e o PR 1 do E2.02 em produção)
- [ ] **E2.09** Situação do relatório por célula · CEL-05
- [ ] **E2.10** Listagem de células com filtros e detalhe com os últimos relatórios · CEL-06, CEL-07
- [ ] **E2.11** Lançamento de relatório numa RPC atômica · REL-01 a REL-12, REL-15 · depende de D3. Inclui: trocar o trigger de semana única por índice único, validar a semana atual só no lançamento e corrigir a data sugerida no formulário
- [ ] **E2.12** Listagem de relatórios com filtros e atalhos de semana · REL-13
- [ ] **E2.13** Exportação dos relatórios para Excel · REL-14
- [ ] **E2.14** Dashboard, incluindo a correção do mapa de dias da semana · DSH-01 a DSH-06. A dupla contagem no ranking G12 já foi corrigida (2026-11-22, mci-connect#13)
- [ ] **E2.15** Árvore de ministérios a partir do escopo do usuário · MIN-02
- [ ] **E2.16** Aceite geral da paridade: matriz do `CLAUDE.md` toda em ✅ · _product-owner_

### Fase 3: Contas e senhas (seção 6)

- [ ] **E3.01** Tabela `private.legacy_credentials` · 6.3 · _backend_
- [ ] **E3.02** Conferência do MD5 legado na função `sign-in`, com política de senha e `must_change_password` · 6.3 · depende de E1.04 e E3.01 · _backend_
- [ ] **E3.03** Testes do login legado com contas de teste: senha com acento, conta só com celular, senha fora da política · _qa_
- [ ] **E3.04** Lista de quem será Administrador e Líder revisada pela liderança, com pelo menos 2 administradores · 6.5, 6.6 · _liderança_
- [ ] **E3.05** Texto de comunicação aos usuários aprovado · 6.7 · _liderança + product-owner_

### Fase 4: Ferramentas de migração (seção 5)

- [ ] **E4.01** Estrutura de `data-migration/`: README, variáveis de ambiente e modo `--dry-run` · _backend_
- [ ] **E4.02** Migrations de preparação: `legacy_id` e colunas de snapshot · 5.3 · depende de E2.01 e E2.05 · _backend_
- [ ] **E4.03** Cópia bruta do MySQL para o schema `legacy` · 5.2 · depende de E1.10 · _backend_
- [ ] **E4.04** Relatório de saneamento · 5.4 · _backend_
- [ ] **E4.05** Correções feitas no legado pela liderança, a partir do relatório de saneamento · 5.4 · _liderança_
- [ ] **E4.06** SQL de transformação e carga · 5.5 · depende de D9 · _backend_
- [ ] **E4.07** Backfill de nível e totais, reaproveitando as funções dos triggers · 5.5 · _backend_
- [ ] **E4.08** Script de criação das contas no Auth e carga das credenciais legadas · 6.2, 6.3 · depende de E3.01 e D7 · _backend_
- [ ] **E4.09** Script de reconciliação · 5.6 · _backend + qa_

### Fase 5: Ensaios (5.7)

- [ ] **E5.01** Ensaio 1 em homologação, com dump recente. Registrar a duração e as divergências · _backend + qa_
- [ ] **E5.02** Corrigir scripts e dados a partir do ensaio 1 · _backend + liderança_
- [ ] **E5.03** Ensaio 2 com reconciliação sem divergências · _backend + qa_
- [ ] **E5.04** Homologação de uso pela liderança, incluindo login com a senha antiga · _liderança + product-owner_
- [ ] **E5.05** Go/no-go aprovado pelos critérios da 7.1 · _liderança + architect + product-owner_

### Fase 6: Cutover (7.2)

Data marcada: _a definir_

- [ ] **E6.01** D−7: comunicação enviada aos usuários; schema do novo congelado
- [ ] **E6.02** D−1: backups do MySQL e do Supabase de produção
- [ ] **E6.03** D0: legado fora do ar
- [ ] **E6.04** D0: dump final, carga e criação das contas
- [ ] **E6.05** D0: reconciliação sem divergências
- [ ] **E6.06** D0: novo liberado e endereço do legado redirecionado
- [ ] **E6.07** D+30: plantão de suporte encerrado. Senhas migradas: __%

### Fase 7: Desligamento (7.4)

- [x] **E7.01** ~~Credenciais legadas restantes apagadas, no fim do prazo D6~~ · **Não será feito.** Decisão D6: a migração de senhas não tem prazo (2026-11-23)
- [ ] **E7.02** Schema `legacy` apagado
- [ ] **E7.03** Infraestrutura do legado desligada
- [ ] **E7.04** Backup final criptografado guardado conforme a D8
- [ ] **E7.05** Repositório `g12app-net` arquivado e submódulo removido
- [ ] **E7.06** Projeto do Lovable e o banco dele (`clfgjnwtzasdsrgcxmmd`) desativados · _usuário_

## 2. Pré-requisitos no novo

Estes itens precisam estar prontos antes de o novo receber dados reais. O andamento é marcado nos passos E1 da seção [Progresso](#progresso).

- **Reconciliar o schema.**
  - Comparar as migrations com o banco remoto e resolver a definição dupla de `cell_reports` / `cell_report_participants`.
  - Regenerar o `types.ts`.
- **Corrigir a segurança.**
  - `create-user-admin`: exigir JWT e checar a permissão de quem chama. Hoje qualquer um cria contas com qualquer perfil.
  - `members`: impedir que `edit_own_data` altere `role_id`, `auth_user_id`, `leader_id` e as demais colunas restritas (regra AUT-05).
  - `get-user-email`: parar de devolver o e-mail de qualquer CPF ou celular. Ele será substituído pela função de login da seção 6.3.
  - `change-member-password`: checar o escopo e o perfil do alvo.
  - Política de SELECT de `members`: parar de expor a linha inteira dos líderes de membros visíveis. ✅ Feito no E1.13.
  - Auditoria: confirmar os grants de `_log_event`, restringir `log_auth_event` e registrar o autor dos cadastros feitos por Edge Function.
  - Impor no banco o que hoje só a UI respeita (`view_sensitive_data`, `assign_role`). ✅ Feito no E1.03 (`assign_role`) e no E1.08 (`view_sensitive_data`, com a trava por coluna).
  - Trocar o domínio dos e-mails fictícios (`mci12fakemail.com`) por um domínio controlado pela igreja (D7, E1.06). Quem controla esse domínio recebe os e-mails das contas fictícias, inclusive os de redefinição de senha.
  - Configurar SMTP próprio no Supabase Auth. O envio padrão tem limite baixo e não serve para produção.
- **Volume de dados.** Listagens, contagens e dashboard precisam paginar e contar no servidor. O PostgREST corta respostas em 1000 linhas, e com os dados reais as telas atuais vão truncar sem avisar. ✅ Feito no E1.08, exceto a Auditoria (`Events.tsx` carrega os 500 eventos mais recentes).
- **Perfis e escopo** configurados conforme a seção 6.5.
- **Exclusão lógica** (seção 3.8) implementada antes de existir histórico real. Hoje, excluir uma célula apaga todos os relatórios dela, e excluir um membro apaga as participações dele.

## 3. Funcionalidades e regras a replicar

Cada regra tem um ID para ser citada em specs (`docs/specs/`) e testes. Na coluna **Onde impor**, "banco" significa constraint, RLS, trigger ou RPC. Validação só na tela não conta, porque o front acessa o Supabase direto.

Os caminhos na coluna **Fonte** são relativos a `g12app-net/`:
- `Domain/` = `G12App.Domain/`
- `App/` = `G12App.Application/`
- `UI/` = `G12App.API/ClientApp/src/`

### 3.1 Acesso e permissões (AUT)

| ID | Regra | Fonte | Novo | Onde impor |
|---|---|---|---|---|
| AUT-01 | Login com e-mail ou celular e senha. | `App/Services/AuthService.cs` | ✅ (aceita também CPF) | Função de login (6.3) |
| AUT-02 | Três perfis: **básico** (vê o escopo, edita o próprio cadastro, lança relatórios), **administrador** (mais o CRUD de membros, células e relatórios no escopo) e **administrador geral** (tudo, sem escopo). | `Domain/Model/Constants.cs`, `[Authorize(Roles)]` nos controllers, `UI/components/NavMenu` | 🟡 os perfis equivalentes ainda não existem | `role_permissions` + RLS (6.5) |
| AUT-03 | **Escopo de visibilidade e escrita.** O usuário vê e altera as subárvores de si mesmo, do cônjuge, do seu G12 e do cônjuge do seu G12, além dessas próprias pessoas. Uma célula ou relatório está no escopo se o líder, o timóteo ou o anfitrião estiver. | `Domain/Extensions/QueryingExtensions.cs` (`ApplyMinistryFilter`) | 🟡 Já inclui o cônjuge do G12 e a subárvore dele. Ainda faltam: o cônjuge do próprio usuário; o anfitrião nos relatórios; escopo nas escritas (`edit_member`, `edit_cell_report`, `submit_any_visible_report` etc. valem para a igreja toda); e os pastores. Além disso, o SELECT expõe a linha inteira dos líderes de membros visíveis. | RLS (`is_in_same_ministry` e políticas de escrita) |
| AUT-04 | O administrador geral vê e altera tudo. | `UserExtensions.IsSuperAdmin` | ✅ `view_all_church` | RLS |
| AUT-05 | O perfil básico edita só o próprio cadastro e não altera líder, "não tem liderança", batismo, inativo nem perfil. | `UI/pages/Members/details.js` (`canEdit` e campos desabilitados) | 🟡 Só na UI: o bloco ministerial some sem `edit_member`. No banco, `edit_own_data` ainda libera todas as colunas. | Trigger em `members` |
| AUT-06 | A senha é trocada pelo próprio membro ou por um administrador, para membros do escopo dele. | `Domain/Mappings/DomainToDTOMappingProfile.cs` (`Password`) | 🟡 A função `change-member-password` existe, mas não checa o escopo nem o perfil do alvo. O próprio membro não troca a senha sem uma permissão especial. | Edge Function com a Admin API (6.4) |
| AUT-07 | Só o administrador geral altera o perfil de alguém, e ninguém altera o próprio perfil. | `DomainToDTOMappingProfile.cs` (`Role`), `UI/pages/Members/details.js` | 🟡 Só na UI (`assign_role`). Quem tem `assign_role` troca o próprio perfil, e `create-user-admin` aceita qualquer `role_id`. | Trigger em `members` |

### 3.2 Membros (MEM)

| ID | Regra | Fonte | Novo | Onde impor |
|---|---|---|---|---|
| MEM-01 | Nome com nome **e** sobrenome. | `UI/pages/Members/details.js`; `Domain/Validators/MemberDtoValidator.cs` | ❌ | Banco (CHECK) + zod |
| MEM-02 | Pelo menos um identificador de login real: e-mail, celular ou CPF (D5). | `UI/pages/Members/details.js` | ❌ (o novo gera e-mail fictício) | Banco (CHECK) |
| MEM-03 | E-mail único, sem diferenciar maiúsculas; celular único. | `MemberDtoValidator.cs` | ❌ | Índices únicos (`lower(email)`, `mobile_whatsapp`) |
| MEM-04 | CPF válido (dígitos verificadores) quando informado. | `UI/shared/utils.js` (`ValidateCPF`) | ❌ | Função SQL + CHECK; zod |
| MEM-05 | CPF único quando informado. Regra nova, necessária porque o novo aceita login por CPF. | — | ❌ | Índice único parcial |
| MEM-06 | E-mail em formato válido. | `MemberDtoValidator.cs` | ❌ | CHECK + zod |
| MEM-07 | Líder obrigatório, a menos que a pessoa esteja marcada como "sem liderança" ou seja pastor. O administrador geral pode salvar sem líder. | `UI/pages/Members/details.js` | ❌ | Trigger |
| MEM-08 | Data de nascimento entre hoje − 100 anos e hoje. | `MemberDtoValidator.cs` | ❌ | CHECK |
| MEM-09 | Data de batismo só existe para quem é batizado. | `UI/pages/Members/details.js` | 🟡 só na tela | CHECK |
| MEM-10 | O vínculo de cônjuge é simétrico. | `App/Services/MemberService.cs` (`UpdateSpouse`) | ✅ trigger | — |
| MEM-11 | Exclusão lógica de membros, conforme a seção 3.8. | Repositórios (`IsDeleted`) | ❌ exclusão física; `leader_id ON DELETE SET NULL` e participações `ON DELETE CASCADE` | Ver 3.8 |
| MEM-12 | Auditoria: quem criou, quem alterou e quando. | `App/Services/EntityChangeTrackingService.cs` | 🟡 Tabela `events`, alimentada por triggers. Cadastros feitos via `create-user-admin` ficam sem autor. | Colunas + trigger |
| MEM-13 | Filtros da listagem: nome, liderança (qualquer nível), bairro, cidade, ativo/inativo, possui liderança, batizado, nível ministerial, vínculo celular e período de cadastro. | `Domain/Querying/Filters/MemberFilter.cs`; `UI/pages/Members/index.js` | ❌ só busca por texto | RPC ou view + UI |
| MEM-14 | Vínculo celular: **líder**, **timóteo** ou **anfitrião** (tem célula nesse papel); **participante** (esteve em relatório nos últimos 30 dias); **sem vínculo** (nenhum dos anteriores). | `QueryingExtensions.cs` (`CellLink`) | 🟡 só no dashboard, com 28 dias | View ou RPC |
| MEM-15 | No cadastro de membro novo, o líder já vem preenchido com o usuário logado. | `UI/pages/Members/details.js` (`GetMemberPickerId`) | ❌ | UI |

### 3.3 Hierarquia (HIE)

| ID | Regra | Fonte | Novo | Onde impor |
|---|---|---|---|---|
| HIE-01 | Sem ciclos: ninguém pode ser discípulo de um discípulo seu, nem de si mesmo. | `MemberService.cs` (`UpdateComputedValues`) | ❌ | Trigger |
| HIE-02 | O nível ministerial vem da profundidade na árvore. Ao trocar o líder de alguém, a subárvore inteira é recalculada. | `MemberService.cs` + `App/EventHandlers/DomainEvents/MemberChangedHandler.cs` | 🟡 calcula o nível, mas não propaga para os descendentes | Trigger |
| HIE-03 | Líder direto, G12 e caminho da liderança ("Pastor / G12 / … / líder") disponíveis para exibir e filtrar. | `Member.LeadershipTree`, `ComputedG12Leader` | 🟡 o G12 é calculado no cliente, só na tela de Células | View ou colunas mantidas por trigger |
| HIE-04 | Totais por pessoa: discípulos em todos os níveis, e células lideradas na subárvore, incluindo as da própria pessoa. | `MemberChangedHandler.cs`, `CellChangedHandler.cs` | ✅ trigger (D2: não conta inativos, como o novo já faz; o legado contava) | Trigger |

### 3.4 Células (CEL)

| ID | Regra | Fonte | Novo | Onde impor |
|---|---|---|---|---|
| CEL-01 | Líder, timóteo e anfitrião obrigatórios. | `Domain/Validators/CellDtoValidator.cs` | ❌ só o líder (D4: os três obrigatórios) | NOT NULL |
| CEL-02 | Dia da semana e horário obrigatórios. | `CellDtoValidator.cs` | 🟡 têm valor padrão, mas aceitam nulo | NOT NULL + CHECK |
| CEL-03 | Tipos: Evangelística, Discipuladora (no novo, "Discipulado") e Macrocélula. | `Domain/Model/Enum/CellType.cs` | 🟡 texto livre | CHECK ou enum |
| CEL-04 | Criar, editar e excluir célula: administradores, dentro do escopo. | `API/Controllers/CellController.cs` | 🟡 Vale para a igreja toda. A UI exige `edit_cell`, mas o RLS ainda deixa líder e timóteo editarem a própria célula. | RLS |
| CEL-05 | **Situação do relatório** da semana atual (domingo a sábado, horário de Brasília). Ver a definição abaixo da tabela. | `QueryingExtensions.cs` (`ReportStatus`) | ❌ | Função SQL |
| CEL-06 | Filtros: líder, G12, logradouro, bairro, cidade, tipo, dia da semana, situação do relatório e período de cadastro. | `Domain/Querying/Filters/CellFilter.cs`; `UI/pages/Cells/index.js` | ❌ só busca por texto | RPC ou view + UI |
| CEL-07 | O detalhe da célula mostra os 3 últimos relatórios e dá acesso à lista completa. | `CellController.GetLastReportsByCellId`; `UI/pages/Cells/details.js` | ❌ | UI |
| CEL-08 | Exclusão lógica de células, preservando os relatórios (seção 3.8). | `IsDeleted` | ❌ `ON DELETE CASCADE` apaga os relatórios | Ver 3.8 |

Definição da situação do relatório (CEL-05):
- **Em dia**: já tem relatório nesta semana, ou a reunião ainda não aconteceu.
- **Ainda não ocorreu**: sem relatório, e a reunião ainda não aconteceu nesta semana.
- **Pendente nesta semana**: sem relatório, e já passou cerca de 1h do horário da célula.
- **Sem relatório há 1, 2, 3 ou 4+ semanas**: conforme a data do último relatório.

### 3.5 Relatórios de célula (REL)

| ID | Regra | Fonte | Novo | Onde impor |
|---|---|---|---|---|
| REL-01 | A data não pode ser futura. | `App/Services/ReportApp.cs` | 🟡 O trigger só barra semanas futuras: dentro da semana atual, aceita datas até o sábado. | RPC |
| REL-02 | Só é possível lançar relatório da **semana atual** (domingo 00:00 a sábado 23:59:59, horário de Brasília). | `ReportApp.cs` | 🟡 O trigger `enforce_cell_report_current_week` também dispara quando a data é editada, o que impede editar relatórios antigos. O legado só valida no lançamento. | RPC, ou trigger só no INSERT |
| REL-03 | **Um relatório por célula por semana.** Mensagem: "O relatório para esta semana já foi enviado (#id)". | `ReportApp.cs` | 🟡 Existe um trigger, mas ele consulta antes de inserir (race condition) e a mensagem não traz o `#id`. | Índice único `(cell_id, semana)` |
| REL-04 | O relatório não pode ser de antes do dia e do horário da célula naquela semana. | `ReportApp.cs` | ❌ | RPC |
| REL-05 | Quando a célula aconteceu: data, horário e tema obrigatórios. | `Domain/Validators/ReportDTOValidator.cs`; `UI/pages/Report/details.js` | 🟡 só data e horário | CHECK |
| REL-06 | "Não houve célula": a justificativa é obrigatória, e a data registrada é o dia e horário previstos da célula na semana. | `UI/pages/Report/details.js` | 🟡 | CHECK + RPC |
| REL-07 | Líder, timóteo e anfitrião entram automaticamente como participantes, sem duplicar. | `App/Services/ReportService.cs` (`Add`) | ❌ | RPC |
| REL-08 | Visitantes são nomes livres, e só os nomes preenchidos contam. | `ReportService.cs` | ✅ | RPC |
| REL-09 | O relatório guarda um snapshot de líder, anfitrião, timóteo e tipo da célula no momento do lançamento. | `Domain/Model/Report.cs` | ❌ | Colunas + RPC |
| REL-10 | Relatório e participantes são gravados juntos (tudo ou nada). | Transação do EF | ❌ chamadas separadas | RPC |
| REL-11 | Quem lança (D3): líder, timóteo e anfitrião da célula, mais quem gerencia células no escopo. No legado, qualquer usuário com a célula no escopo. Editar e excluir: administradores. | `API/Controllers/ReportController.cs`, `ReportApp.cs` | 🟡 Há permissões próprias (`submit_*`, `edit_cell_report`, `delete_cell_report`), mas sem escopo. `submit_any_visible_report` não confere se a célula está visível. | RLS / RPC |
| REL-12 | Oferta em reais, maior ou igual a zero. | `Report.Contribution` | 🟡 Só no zod; não há CHECK no banco. | CHECK |
| REL-13 | Listagem com filtros (líder, G12, período) e atalhos para esta semana, a passada e a retrasada. | `UI/pages/Report/index.js`, `UI/components/NavMenu` | ❌ | RPC + UI |
| REL-14 | **Exportação para Excel**, uma linha por célula no período, ordenada por G12. Colunas: Célula #, G12, Líder, Endereço, Bairro, Situação, Data/Hora, Oferta, Nº de participantes, Nº de visitantes e Observações. Situação: "Relatório não entregue.", "Não houve célula." ou "Célula realizada.". | `App/Services/ExportService.cs`, `ColumnFormatter.cs` | ❌ | Edge Function ou geração no cliente |
| REL-15 | No formulário, a célula é escolhida pelo nome do líder. Depois de escolhida, a tela mostra líder, timóteo, anfitrião, G12, tipo e endereço, só para leitura. | `UI/pages/Report/details.js` | 🟡 | UI |

### 3.6 Dashboard (DSH)

| ID | Regra | Fonte | Novo | Onde impor |
|---|---|---|---|---|
| DSH-01 | Todos os números respeitam o escopo do usuário. | `App/Services/DashboardService.cs` (repositórios com escopo) | 🟡 depende do RLS (AUT-03) | RLS / RPC |
| DSH-02 | **Esta semana**: relatórios enviados, células com relatório pendente (CEL-05), visitantes, novos membros e novas células. | `DashboardService.cs` | 🟡 faltam novos membros e novas células. O cálculo de pendentes, que ignorava células de segunda a sexta, foi corrigido no PR 3 do E1.08 (mci-connect#15, em produção) | RPC (`dashboard_summary`, E1.08) |
| DSH-03 | **Geral**: membros ativos, células evangelísticas, células discipuladoras, inativos, não batizados, sem liderança e sem vínculo celular. | `DashboardService.cs` | 🟡 | RPC |
| DSH-04 | Gráfico da semana: células realizadas × canceladas × sem relatório. | `UI/pages/Home` | 🟡 | UI |
| DSH-05 | Cada card abre a listagem correspondente já filtrada. | `UI/pages/Home` | ❌ depende de MEM-13, CEL-06 e REL-13 | UI |
| DSH-06 | Cards com valor zero são escondidos. O card de pendentes fica vermelho quando > 0 e verde quando = 0. | `UI/pages/Home` | — | UI (desejável) |

### 3.7 Ministérios (MIN)

| ID | Regra | Fonte | Novo | Onde impor |
|---|---|---|---|---|
| MIN-01 | Árvore de casais com o total de discípulos e de células, carregada sob demanda. | `App/Services/MinistryService.cs` | ✅ | `ministry_tree_nodes` (E1.08, PR 4) |
| MIN-02 | A raiz é o nível mais alto visível no escopo do usuário: quem tem escopo de ministério começa pelo próprio ministério. | `MemberRepository.GetChildrenWithSpouseAsync` | ❌ começa sempre nos pastores | RPC |
| MIN-03 | Só membros ativos aparecem na árvore. | `GetChildrenWithSpouseAsync` | ✅ | `ministry_tree_nodes` (E1.08, PR 4) |

### 3.8 Exclusão lógica (DEL)

Decidido em 2026-11-14 (D1). Vale para:
- **membros**, **células** e **relatórios de célula**;
- toda entidade de negócio nova (Consolidação, Escolas).

Continuam com exclusão física as tabelas de configuração (`roles`, `role_permissions`) e as tabelas de ligação (`cell_report_participants`).

| ID | Regra | Fonte | Novo | Onde impor |
|---|---|---|---|---|
| DEL-01 | Excluir marca o registro (`deleted_at`, `deleted_by`) em vez de apagá-lo. A API não permite exclusão física. | Repositórios (`IsDeleted`) | ❌ | RPC de exclusão; sem política de DELETE |
| DEL-02 | Registros excluídos não aparecem em listagens, buscas, seletores, contagens, dashboard, árvore de ministérios nem nos totais de discípulos e células. | Filtro global (`HasQueryFilter`) em `Infrastructure.Data/Context/AppDbContext.cs` | ❌ | RLS, e funções e triggers que ignoram excluídos |
| DEL-03 | Excluir um relatório libera a semana: a célula pode receber outro relatório (REL-03). | `ReportApp.cs` (só considera não excluídos) | ❌ | Índice único parcial (`WHERE deleted_at IS NULL`) |
| DEL-04 | A unicidade de e-mail, celular e CPF considera só membros não excluídos. | `MemberDtoValidator.cs` | ❌ | Índices únicos parciais |
| DEL-05 | Excluir um membro desfaz o vínculo de cônjuge. | `MemberService.Remove` (`UpdateSpouse`) | ❌ | RPC de exclusão |
| DEL-06 | Um membro excluído não consegue mais entrar no sistema. | O login só busca não excluídos | ❌ | Função de login + bloqueio da conta no Auth; helpers de permissão ignoram excluídos |
| DEL-07 | Excluir uma célula preserva os relatórios dela, que continuam no histórico e nas somas de períodos passados. | `IsDeleted` em `Cells` e `Reports` | ❌ hoje apaga em cascata | FKs sem cascata |
| DEL-08 | Um membro com discípulos ativos, ou que é líder, timóteo ou anfitrião de célula ativa, só pode ser excluído depois que essas ligações forem reatribuídas. | Nova (D10) | ❌ | RPC de exclusão |
| DEL-09 | Administradores podem reativar um registro excluído. Ao cadastrar alguém com o e-mail, o celular ou o CPF de um membro excluído, o sistema oferece reativar o cadastro existente em vez de criar outro. | Nova | ❌ | RPC + UI |

Pontos de atenção para o `architect`:
- **Histórico.** Participantes e snapshots de relatórios podem apontar para membros excluídos. É preciso definir como mostrar o nome dessas pessoas sem expor o cadastro (por exemplo, uma função que devolve só o nome).
- **Exclusão via RPC, não via `UPDATE`.** Com o RLS escondendo os excluídos, um `UPDATE ... RETURNING` feito pelo front deixa de funcionar. Por isso a exclusão (e a reativação) devem ser RPCs.
- **E-mail único no Auth.** O e-mail é único no Supabase Auth mesmo quando o membro foi excluído. Por isso a DEL-09 reativa o cadastro em vez de criar um novo.
- **LGPD.** Exclusão lógica não apaga dados. Pedidos de eliminação feitos pelo titular são atendidos por anonimização, num processo à parte.

### 3.9 O que não será replicado

- Página de changelog (`/last-changes`).
- O recálculo manual (`OperationController`) e a fila de eventos. Os triggers do banco fazem esse papel.
- `ReportMandatory` e as situações `Cancelled*`: existem no modelo do legado, mas não são usados.
- O superusuário definido em configuração (`AdminUser`). Ele é substituído por membros reais com o perfil Administrador (6.6).

## 4. Decisões pendentes

| # | Decisão | Opções | Recomendação |
|---|---|---|---|
| D1 | Exclusão no novo | Exclusão lógica (`deleted_at`) ou física | ✅ **Decidido em 2026-11-14:** exclusão lógica em membros, células e relatórios, e em toda entidade de negócio nova. Os excluídos do legado migram com `deleted_at`. Regras na seção 3.8. |
| D2 | Os totais de discípulos e células contam inativos? | O legado conta; o novo não | ✅ **Decidido em 2026-11-23:** não contar. Os totais consideram só membros e células ativos, como o novo já faz. |
| D3 | Quem pode lançar relatório | Legado: qualquer pessoa com a célula no escopo. Novo: líder ou timóteo, ou quem tem `edit_cell` | ✅ **Decidido em 2026-11-23:** líder, timóteo e anfitrião da célula, mais quem gerencia células no escopo. |
| D4 | Timóteo e anfitrião obrigatórios na célula | O legado obriga; o novo não | ✅ **Decidido em 2026-11-23:** seguir o legado. Os três são obrigatórios. |
| D5 | Identificadores de login aceitos | E-mail ou celular (legado); também CPF (novo) | ✅ **Decidido em 2026-11-23:** e-mail real, celular ou CPF, com unicidade dos três. |
| D6 | Prazo da migração transparente de senhas (6.3) | 60, 90 ou 180 dias | ✅ **Decidido em 2026-11-23:** **sem prazo.** A senha antiga vale até o primeiro login de cada usuário no novo, sem data para acabar. As credenciais legadas não são apagadas em lote (6.3, 7.4). |
| D7 | Domínio dos e-mails fictícios | Manter `mci12fakemail.com` ou usar um domínio da igreja | ✅ **Decidido em 2026-11-23:** um domínio controlado pela igreja (ex.: um subdomínio de `mci12rs.com.br`). O nome final é escolhido no E1.06. |
| D8 | Retenção do banco legado depois do desligamento | — | ✅ **Decidido em 2026-11-23:** backup criptografado guardado por 12 meses e depois descartado. |
| D9 | Quem é pastor | Lista dos membros sem líder e sem "não tem liderança" | ✅ **Decidido em 2026-11-23:** os pastores são **Samuel Colares e Magda Colares** (casal). Os demais membros sem líder e sem "não tem liderança" seguem o saneamento (5.4). |
| D10 | Excluir um membro que tem discípulos ou células ativas (DEL-08) | Bloquear até reatribuir; permitir e deixar os discípulos sem líder; ou passar os discípulos automaticamente para o líder de quem foi excluído | ✅ **Decidido em 2026-11-23:** bloquear até reatribuir, com uma mensagem que diga o que falta (DEL-08). |
| D11 | Senha inicial de quem é cadastrado pelo app | Manter `123456` como padrão, ou exigir uma senha no cadastro (como no legado) | ✅ **Decidido em 2026-11-15:** manter `123456` como senha inicial padrão. |

## 5. Migração dos dados

### 5.1 Princípios

- **O legado não é alterado.** A extração usa um usuário MySQL somente leitura.
- **Idempotência.** Os scripts podem rodar várias vezes com o mesmo resultado (upsert por `legacy_id`).
- **Reprodutibilidade.** Tudo fica versionado em `data-migration/`, na raiz deste repositório.
- **Ensaio antes da produção.** A migração completa roda em um projeto Supabase de homologação antes do cutover.
- **LGPD.** Os dados incluem convicção religiosa, que é dado pessoal sensível (Lei 13.709/2018, art. 5º, II). Por isso:
  - dumps sempre criptografados e com acesso restrito;
  - nenhuma cópia em máquina pessoal depois do uso;
  - o schema de staging é apagado no fim (7.4).

### 5.2 Fluxo (ELT)

```
MySQL de produção (somente leitura)
  └─ cópia bruta (pgloader, ou script Node com mysql2 + pg)
       └─ schema `legacy` no Postgres de destino (fora da API)
            ├─ verificações de saneamento (5.4)
            ├─ SQL de transformação: data-migration/sql/NN_*.sql → public.*
            ├─ script de contas: Admin API do Supabase → auth.users + members.auth_user_id (6.2)
            └─ SQL de validação: relatório de reconciliação (5.6)
```

- O schema `legacy` **não** pode estar entre os schemas expostos pela API (Settings → API → Exposed schemas).
- As verificações de saneamento rodam no Postgres, sobre a cópia, para não pesar no banco de produção do legado (MySQL 8.4).
- A service role só existe no ambiente de quem opera a migração, nunca no front.

### 5.3 Preparação do schema de destino

Estas migrations são feitas pelo `backend-developer` (passos E2.01, E2.05, E3.01 e E4.02):

- Coluna `legacy_id integer UNIQUE` em `members`, `cells` e `cell_reports`.
- Colunas de snapshot em `cell_reports`: `leader_id`, `host_id`, `timothy_id`, `cell_type` (REL-09).
- `deleted_at` e `deleted_by` em `members`, `cells` e `cell_reports`; FKs sem `ON DELETE CASCADE` ou `SET NULL`; índices únicos parciais (`WHERE deleted_at IS NULL`); helpers de RLS, triggers e funções de totais ignorando excluídos (seção 3.8).
- `created_by` / `updated_by` (MEM-12).
- Toda coluna nova em `members` (`legacy_id`, `deleted_at`, `deleted_by`, `created_by`, `updated_by`…) precisa de `GRANT SELECT (coluna) ON public.members TO authenticated` na própria migration, por causa da trava por coluna do E1.08 PR 5.
- Tabela `private.legacy_credentials` (6.3).
- CHECKs de domínio (`gender`, `meeting_day`, `type`) e os índices únicos (MEM-03, MEM-05, REL-03), criados **antes** da carga para barrar dados ruins.

Na carga vamos usar `session_replication_role = replica`. Isso desliga triggers e FKs, mas os CHECKs e os índices únicos continuam valendo.

### 5.4 Inventário e saneamento

Rode depois da cópia bruta para o schema `legacy`. O que precisar de decisão humana é corrigido **no próprio legado**, pela liderança e pela interface do legado, antes do cutover. O resto é tratado automaticamente na transformação.

| Verificação | Tratamento |
|---|---|
| Contagens por tabela (ativos e excluídos) | Base da reconciliação (5.6) |
| E-mails duplicados entre membros não excluídos (ignorando maiúsculas e espaços) | Corrigir no legado |
| Celulares duplicados entre membros não excluídos | Corrigir no legado |
| CPFs duplicados entre membros não excluídos | Corrigir no legado |
| CPFs inválidos | Importar como nulo e listar |
| E-mails inválidos | Importar como nulo; a conta usa e-mail fictício (6.2) |
| Membros sem e-mail e sem celular | Migram sem conta de acesso; listar |
| Membros sem senha | Migram com conta, sem credencial legada; precisam de redefinição (6.4) |
| Sem líder e sem "não tem liderança" | Só Samuel Colares e Magda Colares são pastores (D9). Os demais são listados para a liderança indicar o líder no legado (E4.05). Quem não for corrigido migra sem liderança |
| "Não tem liderança" marcado, mas com líder preenchido | O líder é descartado |
| Referência para registro excluído | Cônjuge excluído: o vínculo é desfeito (DEL-05). Membro ativo com líder excluído: listar para reatribuição (D10). Célula ou relatório excluído: migra com `deleted_at`, e a referência é mantida. |
| Cônjuge não recíproco | Corrigir no legado |
| Ciclo na hierarquia | Corrigir no legado |
| Horário de célula fora do formato `HH:mm` | Corrigir no legado |
| Mais de um relatório da mesma célula na mesma semana | Fica o mais recente; os outros migram como excluídos. Listar para a liderança. Sem isso, o índice único da REL-03 (`cell_reports_cell_week_key`, E2.01) barra a carga, porque ele vale mesmo com `session_replication_role = replica`. |

Exemplos em Postgres sobre o schema `legacy`. Eles assumem que a cópia preservou os nomes originais das tabelas e colunas (no pgloader, opção `quote identifiers`):

```sql
-- E-mails duplicados
SELECT lower(trim("Email")) AS email, count(*)
FROM legacy."Members"
WHERE NOT "IsDeleted" AND coalesce(trim("Email"), '') <> ''
GROUP BY 1 HAVING count(*) > 1;

-- Relatórios duplicados na mesma semana (domingo a sábado)
SELECT "CellId", date_trunc('week', "Date" + interval '1 day') - interval '1 day' AS semana, count(*)
FROM legacy."Reports"
WHERE NOT "IsDeleted"
GROUP BY 1, 2 HAVING count(*) > 1;

-- Ciclos na hierarquia
WITH RECURSIVE cadeia AS (
  SELECT "Id" AS origem, "LeadershipId" AS atual, ARRAY["Id"] AS caminho
  FROM legacy."Members" WHERE NOT "IsDeleted"
  UNION ALL
  SELECT c.origem, m."LeadershipId", c.caminho || m."Id"
  FROM cadeia c JOIN legacy."Members" m ON m."Id" = c.atual
  WHERE NOT m."Id" = ANY (c.caminho)
)
SELECT DISTINCT origem
FROM cadeia c JOIN legacy."Members" m ON m."Id" = c.atual
WHERE m."Id" = ANY (c.caminho);
```

### 5.5 Transformação e carga

Ordem de execução. Os passos 1 a 5 rodam com `SET session_replication_role = replica`:

1. `members`, ainda sem `leader_id` e `spouse_id`.
2. Segundo passe em `members`: `leader_id` e `spouse_id`, resolvidos via `legacy_id`.
3. `cells`.
4. `cell_reports`.
5. `cell_report_participants`.
6. **Backfill.**
   - `g12_level`, `is_pastor` e `has_leadership` (CTE recursiva a partir dos pastores).
   - Totais (`total_disciples`, `total_cells`, `male_cells`, `female_cells`), usando **a mesma função SQL** que os triggers usam, para não duplicar a fórmula.
   - `ANALYZE` nas tabelas carregadas. Com estatísticas desatualizadas, as views e RPCs do E1.08 podem escolher planos ruins (risco 17 do spec do E1.08).
7. **Validação das FKs.** Como o modo `replica` não checa FKs, toda referência precisa ser conferida explicitamente.
8. **Contas de acesso** (6.2).

#### Members → `members`

| Legado (`Members`) | Novo | Transformação |
|---|---|---|
| `Id` | `legacy_id` | — |
| `Name` | `name` | `trim`; espaços repetidos viram um só |
| `Email` | `email` | `lower(trim)`. Se for inválido ou vazio, recebe o e-mail fictício da conta (6.2) |
| `MobileNumber` / `PhoneNumber` | `mobile_whatsapp` / `phone` | Só dígitos |
| `CPF` | `cpf` | Só dígitos; inválido vira nulo |
| `Gender` | `gender` | `0` → `'M'`, `1` → `'F'` |
| `BirthDate` | `birth_date` | `::date` |
| `Baptized` / `BaptismDate` | `is_baptized` / `baptism_date` | A data fica nula se não for batizado |
| `Idle` | `is_active` | `NOT Idle` |
| `HasNoLeadership` + `LeadershipId` | `has_leadership`, `leader_id`, `is_pastor` | Ver as regras abaixo da tabela |
| `SpouseId` | `spouse_id` | Via `legacy_id` (2º passe) |
| `Notes` | `notes` | — |
| `HomeAddressId` → `Addresses` | `street`, `number`, `complement`, `neighborhood`, `city`, `state`, `zip_code` | `Addresses.Notes` → `complement`; `PostalCode` → só dígitos; `State` em maiúsculas |
| `Role` | `role_id` | Conforme 6.5 |
| `Password` | `private.legacy_credentials.md5_hash` | Conforme 6.3 |
| `IsDeleted` | `deleted_at` | Se o registro estiver excluído, usar `COALESCE(LastModifiedDate, CreationDate)` em horário de Brasília (o legado grava a exclusão como última alteração). `deleted_by` fica nulo. |
| `CreationDate` / `LastModifiedDate` | `created_at` / `updated_at` | Horário de Brasília → `timestamptz` (`AT TIME ZONE 'America/Sao_Paulo'`). Data nula vira a data da migração |
| `CreatedBy` / `LastModifiedBy` | `created_by` / `updated_by` | Texto, se MEM-12 for aprovada |
| `MinistryLevel`, `Computed*`, `LeadershipTree`, `LeadershipIdTree`, `TotalDisciples`, `TotalCells`, `ChildrenMembersComputed` | — | Não migram; os valores do novo são recalculados. Servem só para a validação (5.6) |

Regras para `has_leadership`, `leader_id` e `is_pastor`:
- `HasNoLeadership = 1` → `has_leadership = false`, `leader_id = NULL`, `is_pastor = false`.
- `HasNoLeadership = 0` e com líder → `has_leadership = true`, `is_pastor = false`.
- `HasNoLeadership = 0` e sem líder → `is_pastor = true` só para Samuel Colares e Magda Colares (D9), identificados na carga pelo `Id` do legado, e não pelo nome. Os demais seguem o saneamento (5.4) e, se não forem corrigidos, migram como `HasNoLeadership = 1`.

#### Cells → `cells`

| Legado (`Cells`) | Novo | Transformação |
|---|---|---|
| `Id` | `legacy_id` | — |
| `LeadId` / `HostId` / `TimothyId` | `leader_id` / `host_id` / `timothy_id` | Via `legacy_id` |
| `WeekDay` | `meeting_day` | `0` Domingo, `1` Segunda, `2` Terça, `3` Quarta, `4` Quinta, `5` Sexta, `6` Sábado |
| `Time` | `meeting_time` | `'HH:mm'::time` |
| `CellType` | `type` | `0` Evangelística, `1` Discipulado, `2` Macrocélula |
| `PlaceId` → `Addresses` | Endereço inline | Mesma regra do endereço dos membros |
| `IsDeleted` | `deleted_at` | Mesma regra dos membros |
| `CreationDate` / `LastModifiedDate` | `created_at` / `updated_at` | Mesma regra dos membros |
| `ReportMandatory` | — | Descartado |

#### Reports → `cell_reports`

| Legado (`Reports`) | Novo | Transformação |
|---|---|---|
| `Id` | `legacy_id` | — |
| `CellId` | `cell_id` | Via `legacy_id` |
| `Date` | `date` + `time` | `"Date"::date` e `"Date"::time`. Já está no horário de Brasília |
| `WeekCellSkipped` | `was_held` | `NOT WeekCellSkipped` |
| `Subject` | `theme` | Nulo quando a célula não aconteceu |
| `Notes` | `reason_not_held` ou `observations` | Vai para `reason_not_held` quando não houve célula; nos outros casos, para `observations` |
| `Visitors` | `visitors` | Separa pela barra vertical, faz `trim` e descarta os vazios |
| `Contribution` | `offering` | Arredondado para 2 casas decimais |
| `LeadershipId` / `HostId` / `TimothyId` / `CellType` | Colunas de snapshot | Via `legacy_id`; o tipo segue o mapeamento das células |
| `NumMembers` / `NumVisitors` | — | Não migram; servem para validar que `NumMembers` = participantes e `NumVisitors` = visitantes |
| `IsDeleted` | `deleted_at` | Se o registro estiver excluído, usar `COALESCE(LastModifiedDate, CreationDate)` em horário de Brasília (o legado grava a exclusão como última alteração). `deleted_by` fica nulo. |
| `CreationDate` / `LastModifiedDate` | `created_at` / `updated_at` | Mesma regra dos membros |

#### ReportMembers → `cell_report_participants`

- `ReportId` e `MemberId` são resolvidos via `legacy_id`.
- Uma linha cujo membro ou relatório não foi migrado é registrada no relatório de carga, não é descartada em silêncio.

### 5.6 Validação (reconciliação)

O relatório de reconciliação é gerado por script e anexado ao go/no-go.

- **Contagens** de membros, células, relatórios e participantes iguais às do legado, separadas em ativos, inativos e excluídos. Os relatórios duplicados da 5.4 aparecem como excluídos no novo.
- **Hierarquia.**
  - O líder de cada membro (via `legacy_id`) é o mesmo do legado.
  - Os cônjuges são recíprocos.
  - Não há ciclos.
  - `12 ^ g12_level = MinistryLevel` para todos os que têm liderança.
- **Totais.** `total_disciples` e `total_cells` batem com o legado. Como a D2 decidiu não contar inativos, a diferença esperada é só a de membros inativos; o script calcula essa diferença e confere.
  - `male_cells` e `female_cells` não podem estar todos zerados. Uma carga com os triggers desligados e sem o backfill deixa os totais zerados, e o ranking G12 mostra 0 células.
  - A soma de `total_cells` do ranking G12 (`dashboard_g12_ranking`) bate com as células ativas sob os G12.
- **Relatórios.**
  - Participantes por relatório = `NumMembers`.
  - Visitantes = `NumVisitors`.
  - Soma de ofertas por mês igual à do legado.
- **Dashboard** de uma semana de referência comparado lado a lado (legado × novo), com um usuário de cada perfil, o que testa o escopo também.
- **Login** com contas de teste de cada perfil, incluindo uma conta só com celular e uma com acento na senha.
- **Amostragem manual.** Alguém da liderança confere 20 membros, 10 células e 10 relatórios.

### 5.7 Ensaios

1. **Ensaio 1**, em homologação, com um dump recente: medir a duração, rodar as validações e corrigir os scripts.
2. **Ensaio 2**, depois do saneamento: validação pela liderança (homologação de uso), incluindo o login com a senha antiga.
3. **Go/no-go** (7.1).

## 6. Usuários, perfis e senhas

### 6.1 Situação atual

| | Legado | Novo |
|---|---|---|
| Identificador de login | E-mail ou celular | E-mail, celular ou CPF |
| Onde fica a senha | `Members.Password`: MD5 hexadecimal, sem salt, calculado no navegador | Supabase Auth (bcrypt) |
| Quem tem conta | Todo membro com senha | Todo membro criado pela tela (`auth_user_id`) |
| Membro sem e-mail | Entra pelo celular | Conta com e-mail fictício `@mci12fakemail.com` |
| Superusuário | `AdminUser`, definido em configuração | Membros com o perfil Administrador |

O Supabase Auth não aceita importar hashes MD5. As senhas atuais só podem ser aproveitadas **verificando o MD5 no primeiro login** (6.3).

### 6.2 Criação das contas

- **Quem recebe conta:** todo membro migrado **não excluído** que tenha e-mail ou celular.
  - O status ativo/inativo não importa, porque o legado também não bloqueia login de inativo.
  - Membros excluídos não recebem conta. Se um deles for reativado (DEL-09), a conta é criada nesse momento.
- **E-mail da conta:**
  - o e-mail real, normalizado, quando for válido e único;
  - senão, um e-mail fictício **determinístico** (para a carga poder ser refeita): `m<legacy_id>@<domínio da D7>`;
  - o mesmo valor vai para `members.email`, como o novo já faz.
- **Senha inicial:** aleatória e longa, que o usuário nunca vai saber. A senha real é gravada no primeiro login (6.3) ou por redefinição (6.4).
- **Metadados:**
  - `email_confirm: true`;
  - `app_metadata.legacy_member_id = <Id>`. O `app_metadata` só pode ser escrito pela service role.
- **Script:** usa a Admin API (`auth.admin.createUser`) em lotes. Se a conta já existir, só religa o `auth_user_id` ao membro, o que mantém a carga idempotente.

### 6.3 Senhas: migração transparente no primeiro login (recomendado)

O usuário entra com o mesmo login e a mesma senha de sempre. Na primeira vez, o sistema confere o MD5 antigo e grava a senha no Supabase Auth.

**Componentes:**

1. Tabela `private.legacy_credentials(member_id uuid PK → members, md5_hash text, created_at)`:
   - fica num schema fora da API, com RLS ligado e sem políticas;
   - só a Edge Function de login, com service role, tem acesso;
   - é preenchida na carga a partir de `Members.Password`, só para membros não excluídos.
2. Edge Function de login (`sign-in`), que **substitui** a `get-user-email`. Ela recebe o identificador e a senha:
   1. Encontra o membro pelo e-mail, celular ou CPF.
   2. Se existir uma credencial legada para ele, calcula o MD5 da senha recebida (UTF-8, hexadecimal minúsculo, igual ao pacote `md5` usado pelo legado) e compara em tempo constante.
   3. Se o MD5 conferir:
      - se a senha atende à política do Auth, grava essa senha (`auth.admin.updateUserById`);
      - se não atende (por exemplo, curta demais), grava uma senha aleatória e marca `app_metadata.must_change_password = true`.

      Em seguida, apaga a credencial legada.
   4. Faz o login no Auth e devolve a sessão. O front chama `supabase.auth.setSession`.
   5. Em qualquer falha, responde só "Usuário ou senha inválidos", sem revelar se o usuário existe.
3. **Front.**
   - O login passa a chamar a `sign-in`.
   - Com `must_change_password`, o usuário é levado para uma tela de troca obrigatória antes de qualquer outra.

**Controles:**
- Limite de tentativas por identificador e por IP, numa tabela de tentativas, com bloqueio temporário.
- Nada de senha, hash ou dado pessoal em log.
- Acompanhar a porcentagem de credenciais legadas que ainda restam.

**A validar pelo `architect`:** como todos os logins saem do IP da função, conferir os limites de taxa de login do Supabase Auth e ajustar se for preciso.

**Sem prazo (D6):** a conferência do MD5 fica disponível enquanto houver credencial legada. Cada credencial é apagada só no primeiro login bem-sucedido do usuário; não há apagamento em lote. A qualquer momento, o usuário também pode seguir o caminho da 6.4.

**A validar pelo `architect` no E3.01:** sem prazo, o hash de quem nunca entrar fica guardado por tempo indeterminado. Recomendação: guardar na `legacy_credentials` o MD5 embrulhado em bcrypt (`bcrypt(md5)`), e não o MD5 puro. A `sign-in` continua recebendo a senha, calcula o MD5 e confere o bcrypt. Diferente da alternativa descartada abaixo, nada muda no Supabase Auth nem no front, e um vazamento dessa tabela deixa de expor MD5 sem salt.

**Alternativas descartadas:**
- **Redefinição obrigatória para todos.** É simples, mas quem não tem e-mail real não recebe o link, o que gera suporte manual em massa.
- **Importar o hash embrulhado (bcrypt do MD5).** Obrigaria o front a enviar o MD5 em vez da senha para sempre, e faria com que qualquer MD5 vazado de backups do legado virasse credencial válida no novo.

### 6.4 Redefinição de senha

- **Quem tem e-mail real:** usa o "Esqueci minha senha" padrão do Supabase Auth (precisa do SMTP próprio, ver seção 2).
- **Redefinição assistida (AUT-06):** um administrador define uma senha temporária para um membro do seu escopo. É uma Edge Function que checa a permissão e o escopo de quem chama, grava a senha e marca `must_change_password`. É o caminho para quem só tem celular.
- A troca obrigatória no próximo login vale para os dois casos.

### 6.5 Perfis

| Legado | Novo (role) | Permissões |
|---|---|---|
| `AppSuperAdmin` | **Administrador** (`is_system`) | Todas, incluindo `view_all_church` |
| `AppAdmin` | **Líder** (ajustar a role semeada) | `view_dashboard`, `view_own_ministry`, `create_member`, `edit_member`, `delete_member`, `create_cell`, `edit_cell`, `delete_cell` e `edit_own_data`, além da redefinição assistida. Remover `view_members`, que hoje libera a igreja inteira. As escritas valem só dentro do escopo (AUT-03). |
| `AppUser` (e sem perfil) | **Membro** | `view_dashboard`, `view_own_ministry` e `edit_own_data`, além do lançamento de relatório conforme a D3 |

- **Pastores** precisam de `view_all_church`. A função de escopo do novo não atribui ministério a quem tem `g12_level = 0`.
- **Lista para revisão.** Antes do cutover, a liderança confere quem vai ter os perfis Administrador e Líder.

### 6.6 Superusuário do legado

O usuário `AdminUser` vem da configuração e não é membro, então **não migra**. Antes do go-live, designe membros reais com o perfil Administrador; recomenda-se ter pelo menos dois.

### 6.7 Comunicação aos usuários

A mensagem, enviada pela liderança antes do cutover, deve dizer:
- o novo endereço do sistema;
- que o login e a senha são os mesmos de antes, e que agora o CPF também funciona;
- que não há prazo para o primeiro acesso: a senha antiga vale até ser usada uma vez no novo (D6);
- que, em caso de problema, o caminho é falar com o próprio líder (redefinição assistida).

## 7. Cutover e desligamento do legado

### 7.1 Critérios de go/no-go

- Pré-requisitos da seção 2 concluídos.
- Todas as regras obrigatórias da seção 3 aceitas pelo PO, com testes passando.
- Decisões da seção 4 tomadas.
- Dois ensaios seguidos sem divergência na reconciliação (5.6).
- Administradores designados (6.6) e comunicação enviada (6.7).

### 7.2 Roteiro

| Quando | Ação |
|---|---|
| D−7 | Comunicar a data aos usuários. Congelar mudanças de schema no novo. |
| D−1 | Backup completo do MySQL e do Supabase de produção. |
| D0, início | Tirar o legado do ar (parar o serviço ou pôr página de manutenção) para impedir novas escritas. |
| D0 | Dump final do MySQL → cópia para `legacy` → transformação → contas → validação (5.6). |
| D0, antes do go/no-go | `ANALYZE` nas tabelas carregadas, antes de liberar o acesso (já faz parte do backfill da 5.5). |
| D0, go/no-go | Se a validação passar: liberar o novo e redirecionar o endereço do legado para ele. Se não passar: rollback (7.3). |
| D+1 a D+30 | Plantão de suporte de login. Acompanhar erros e a porcentagem de senhas migradas. |

### 7.3 Rollback

- **Antes de liberar o novo:** religar o legado. Nada foi alterado nele.
- **Depois de liberar:** não há volta para o legado, porque os dados novos ficariam para trás. Os problemas são corrigidos no próprio novo. Por isso o go/no-go é rigoroso.

### 7.4 Desligamento

Com o sistema estável, depois do plantão de suporte (E6.07):

- **Não** apagar as credenciais legadas (`private.legacy_credentials`). Pela D6, elas ficam até o primeiro login de cada usuário. Elas não dependem do legado nem do schema `legacy`.
- Apagar o schema `legacy` do Postgres de destino.
- Desligar a infraestrutura do legado.
- Gerar o backup final criptografado do MySQL e guardá-lo conforme a D8.
- Arquivar o repositório `g12app-net` no GitHub e removê-lo como submódulo deste repositório.
- Manter as colunas `legacy_id`, para rastreabilidade.
