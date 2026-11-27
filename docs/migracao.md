# Migração g12app-net → mci-connect

Documento vivo do plano para sair do legado (`g12app-net`, .NET + MySQL) e ir para o novo sistema (`mci-connect`, React + Supabase).

> **Status:** ✅ feito · 🟡 parcial · ❌ falta · ❓ depende de decisão (seção 4)
> **Última revisão:** 2026-11-24

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
| 5. Ensaios | Migração completa no Supabase de produção, antes do cutover (5.7) | Go/no-go aprovado |
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
| 1. Preparação | ✅ 14 de 14 | Já |
| 2. Paridade | 🔄 11 de 16 | E1.01 concluído |
| 3. Contas e senhas | ⬜ | E1.04 concluído |
| 4. Ferramentas de migração | 🔄 1 de 9 | Já (E1.01 concluído; o E1.10 não será feito) |
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
- [x] **E0.07** D7: domínio dos e-mails fictícios: ~~um domínio controlado pela igreja~~ **revista em 2026-11-25: continua o `mci12fakemail.com`** (o E1.06 não será feito). Libera o E4.08 (2026-11-23; revista em 2026-11-25)
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
- [x] **E1.04** Função de login `sign-in` no lugar da `get-user-email`, com limite de tentativas. A parte da senha legada fica para o E3.02 · 6.3 · _backend + frontend_. Spec: [`specs/e1-04-sign-in.md`](specs/e1-04-sign-in.md)
  - Conferências em produção (tarefa 1, 2026-11-24): a origem vem só do `CF-Connecting-IP` (o último valor do `X-Forwarded-For` é um salto da AWS); bcrypt de custo 10; teto de 5 s na função por causa do `auto_explain` (DT-19).
  - PR 1 em produção (2026-11-24, mci-connect#24): banco e função `sign-in`, neutros para o usuário (a tela ainda usa a `get-user-email`). `pg_cron` instalado, com a limpeza a cada 10 minutos.
  - PR 1b em produção (2026-11-24, mci-connect#25): decisões do usuário nos riscos 16 e 17. O limite por origem passou de 20 para 50 falhas em 15 minutos, e a identificação inválida aparece na Auditoria só como `***`.
  - Passo A (2026-11-25): `Sb-Forwarded-For` ligado e `rate_limit_verify = 150`. *Smoke* da emissão da sessão (chave secreta nova, `generate_link` + `/verify`, renovação) com uma conta temporária só no Auth, apagada em seguida.
  - PR 2 em produção (2026-11-25, mci-connect#26, promote do `216663f`): a tela entra só pela `sign-in`, e a Auditoria tem os rótulos de login.
  - Passo B (2026-11-25): `external_email_enabled = false`. O login direto no Auth responde `email_provider_disabled`; a renovação da sessão aberta, a emissão pela `sign-in` e a criação de conta pelo admin continuam funcionando.
  - PR 3 em produção (2026-11-25, mci-connect#27, "Deploy: banco" do `447a504`): `get-user-email` apagada do projeto (responde 404) por `EDGE_FUNCTIONS_REMOVED`; `log_auth_event` só com `logout`; o "Deploy: banco" passa a conferir o provedor de e-mail desligado.
  - *Smoke* de falha em produção ok (401 e Auditoria com as máscaras). O login com sucesso **com cadastro de membro** não foi testado em produção, por falta de conta de teste; foi coberto na stack local e, em produção, pela emissão com a conta temporária.
  - Revisão final do `architect`: APROVADO (2026-11-25). Backlog fora do E1.04: contraste do `--primary` no tema escuro, foco do bloqueio e teclado na Auditoria, paginação e retenção da Auditoria (risco 5), id fixo de role no e2e. (2026-11-25)
- [x] **E1.05** ~~Remover a senha padrão `123456`~~ · **Não será feito.** Decisão D11: o `123456` fica como senha inicial padrão (2026-11-15)
- [x] **E1.06** ~~Configurar o domínio dos e-mails fictícios (D7)~~ · **Não será feito** (decisão do usuário, 2026-11-25). Os e-mails fictícios continuam em `mci12fakemail.com`. Como o provedor de e-mail do Auth está desligado e não há SMTP próprio, nada é enviado para eles.
- [x] **E1.07** ~~Configurar SMTP próprio no Supabase Auth~~ · **Não será feito** (decisão do usuário, 2026-11-25). Não há recuperação de senha por e-mail: a redefinição é sempre assistida, pelo líder ou administrador (E2.03, 6.4).
- [x] **E1.08** Paginação e contagem no servidor em Membros, Células, Relatórios, Ministérios e Dashboard · _frontend + backend_ (concluído em 2026-11-23)
  - Spec: `docs/specs/e1-08-paginacao-servidor.md` (decisões D-1 a D-5 respondidas em 2026-11-15). Cinco PRs.
  - PR 1 em produção (2026-11-15, mci-connect#12): `members_view` com o escopo do RLS, máscara de dados sensíveis (só para o próprio membro e quem tem `view_sensitive_data`), regra 6 do trigger (quem não vê não altera) e a tela de Membros paginada no servidor.
  - PRs 2 a 4 em produção (2026-11-23, promote do `14ee75f`):
    - PR 2 (mci-connect#14): Células e Relatórios paginados no servidor, pelas views `cells_view`, `cell_reports_view` e `cell_report_participants_view`;
    - PR 3 (mci-connect#15): Dashboard calculado no banco, em três RPCs. Corrige as células de segunda a sexta em "Células sem relatório";
    - PR 4 (mci-connect#16): árvore de Ministérios no banco (`ministry_tree_nodes`, uma chamada por expansão) e seletores com busca e paginação no servidor. Depois dele, o front não lê mais as tabelas `members` e `cells` diretamente.
  - PR 5 em produção (2026-11-23, mci-connect#17): SELECT por coluna em `members` para `authenticated`, sem as 8 colunas sensíveis; `anon` sem leitura; a `create-user-admin` devolve só o `id`.
  - Inclui: leituras de `members` por view ou RPC que mascara as colunas sensíveis (CPF, e-mail, telefones, endereço) para quem não tem `view_sensitive_data` (vindo do E1.13).
- [x] **E1.09** ~~Criar o projeto Supabase de homologação~~ · **Não será feito** (decisão do usuário, 2026-11-25). Os ensaios e a homologação de uso rodam no próprio Supabase de produção, antes do cutover, e a carga de ensaio é limpa antes da carga final (5.7).
- [x] **E1.10** ~~Criar um usuário MySQL somente leitura~~ · **Não será feito** (decisão do usuário, 2026-11-25). A extração usa a conexão que já está no `local.config`, só com comandos de leitura (5.1).
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

- [x] **E2.01** Exclusão lógica · DEL-01 a DEL-09, MEM-11, CEL-08 · depende de D10 · é a base dos demais passos. Spec: [`specs/e2-01-exclusao-logica.md`](specs/e2-01-exclusao-logica.md). A DEL-04 fechou com os índices únicos do E2.04 (2026-11-25). Aceite do PO (2026-11-25)
  - PR 1 em produção (2026-11-24, mci-connect#19): banco da exclusão lógica (colunas, FKs sem cascata, RPCs, views de excluídos, índice único da semana, suspensão da conta).
  - PRs 2 a 4 em produção (2026-11-24):
    - PR 2 (mci-connect#20): exclusão nas telas de Membros, Células e Relatórios, sem exclusão física no banco;
    - PR 3 (mci-connect#21): listas de excluídos e restauração;
    - PR 4 (mci-connect#22): consulta do relatório de célula excluída.
  - PR 5 em produção (2026-11-24, mci-connect#23): aviso no cadastro de membro novo com o e-mail, o celular ou o CPF de um excluído (RN-18), com "Restaurar" para o administrador e "Cadastrar mesmo assim"; o e-mail de login de um excluído nunca entra. Sem migration; `create-user-admin` republicada.
  - PR 6 em produção (2026-11-25, mci-connect#28, merge `c6b9d5e`): encerramento da sessão de quem foi excluído (RN-14). Revisão final dos 6 PRs (tarefa 24): APROVADO, com o backlog atribuído ao E2.03, E2.04, E2.06 e E2.11.
- [x] **E2.02** Perfis e escopo de visibilidade e escrita · AUT-02 a AUT-05, AUT-07, CEL-04, DSH-01, MIN-02 e "quem lança" da REL-11, 6.5. Spec: [`specs/e2-02-perfis-escopo.md`](specs/e2-02-perfis-escopo.md). A REL-11 fica 🟡 até a RPC do E2.11, e a AUT-06 é do E2.03. Aceite do PO (2026-11-25)
  - PRs em produção (2026-11-25): mci-connect#29 (banco: escopo, leitura, escrita e funções semeadas; conferência sem parada), #30 (acesso, menu e rotas), #31 (tela de Funções), #32 (Membros), #33 (Células, Relatórios, Dashboard e Ministérios) e #34 (fecha a leitura e a escrita diretas de `roles` e `role_permissions` e mascara a `role_id`; squash `b50308d`), com smoke de produção só leitura.
  - Revisão final dos 6 PRs (tarefa 20): APROVADO, com o backlog técnico no spec. Testes do último PR: pgTAP 23 arquivos e 2.688 testes, Vitest 1.259, Playwright sem regressão (só as falhas de ambiente conhecidas).
- [x] **E2.03** Redefinição de senha assistida e troca obrigatória de senha, incluindo o escopo e o perfil do alvo na `change-member-password` · AUT-06, 6.4. Spec: [`specs/e2-03-senha.md`](specs/e2-03-senha.md). Aceite do PO (2026-11-26)
  - PR 1 em produção (2026-11-25, mci-connect#41 e #42, "Deploy: banco" do `6c4f67b`): cofre de senhas, política, redefinição assistida e trocas no banco e nas funções; `change-own-password` publicada e `change-member-password` apagada. Conferências 1 a 8 sem parada (as 5 contas tinham a senha `123456`). Passo A com contas e cadastros temporários, todos os itens ok, dados apagados no fim. Decisão do usuário: o registro de "Sem permissão" da `reset_member_password` fica sem limite, em "Problemas conhecidos".
  - PRs 2 e 3 em produção (2026-11-26, mci-connect#44, promote do `b35c5ed`, junto com o front do E2.08): as telas de senha, num PR só.
  - PR 4 em produção (2026-11-26, mci-connect#46, "Deploy: banco" do `74b4ee8`, fora das noites de célula): o portão nas funções de identidade (quem tem a marca não lê nem grava nada pela API até trocar a senha), a Líder com "Redefinir Senha de Membros", a marca nas contas com a senha inicial `123456` (as 5 de produção) e a `is_admin` removida. *Smoke* da tarefa 13 em produção com uma Líder e um membro temporários, apagados no fim: redefinição pela Líder, login com a temporária levando à troca, 403 `password_change_required` na `members_view` com a marca, troca obrigatória e login com a senha nova; todos ok.
  - Revisão final do passo (tarefa 14): APROVADA, com as revisões independentes de código e de UI e o SQL de rollback conferido. Testes: pgTAP inteiro de 4.373 a 4.505 asserções conforme a base, concorrência e volume dentro das metas (a página de Membros com o portão em 108 ms para o pastor), Vitest 2.124 e os E2E do portão e das telas de senha verdes, só com as falhas de massa local conhecidas.
  - Fica para a sessão principal a parte técnica do `CLAUDE.md` da tarefa 14 (cofre, portão, Edge Functions sem a `change-member-password`, armadilhas e deploy).
- [x] **E2.04** Validações de membro · MEM-01 a MEM-09, complemento da MEM-10, HIE-01 (antecipada do E2.06) e fechamento da DEL-04 · depende de D5. Spec: [`specs/e2-04-validacoes-membro.md`](specs/e2-04-validacoes-membro.md). Aceite do PO (2026-11-25)
  - PRs em produção (2026-11-25): mci-connect#35 (funções de regra e índices únicos de e-mail, celular e CPF entre não excluídos; squash `2f6eebf`), #36 (regras no banco, `create-user-admin` com conta de e-mail técnico, vazio vira nulo; conferência pós-deploy com os 9 itens ok; squash `83e5d49`) e #37 (formulário de membro da UX; squash `d680904`).
  - Revisão final dos 3 PRs (tarefa 12): APROVADO, com o backlog técnico no spec. Testes: pgTAP 33 arquivos e 3.388 asserções e concorrência (PRs 1 e 2); Vitest 1.699 e Playwright 296 ok no PR 3, só com as falhas de ambiente conhecidas.
  - Ressalva: o Auth de produção aceitar o `id` próprio da conta (risco 4 do spec) só se confirma no primeiro cadastro pela tela. Se não aceitar, o cadastro novo responde erro sem deixar conta nem cadastro, e a edição continua.
- [x] **E2.05** Auditoria (quem criou e quem alterou) · MEM-12. Spec: [`specs/e2-05-auditoria-autor.md`](specs/e2-05-auditoria-autor.md). Aceite do PO (2026-11-27)
  - PR 1 em produção (2026-11-26, mci-connect#50, "Deploy: banco" e promote do `2dd4fba`): autoria em membros, células e relatórios, Auditoria com um evento por gravação, `save_cell_report`, `events_view` paginável com busca, guarda diária pelo `pg_cron`, eventos antigos convertidos e autoria dos registros existentes preenchida. Conferência em produção sem pendências; pgTAP 4.719; revisão de código aprovada (inclui a DT-25). Próximos: PRs 2 (gravação nos formulários, com o `save_cell_report`), 3 (autoria na tela) e 4 (Auditoria).
  - PR 2 em produção (2026-11-26, mci-connect#52, squash `80c518d`, promote): o relatório numa chamada só (`save_cell_report`) e "Nenhuma alteração para salvar." nos três formulários. Revisão de código e QA independentes aprovados. Próximos: PRs 3 e 4 (autoria na tela e Auditoria).
  - PRs 3 e 4 em produção (2026-11-27, mci-connect#55, squash `9123944`, promote): autoria no registro aberto com "Ver histórico"; Auditoria nova paginada no servidor (`events_view`), com filtros e período na URL, cartões no celular e tabela a partir de 1024 px, painel do evento legível, histórico de um registro e abertura pelo teclado. Revisão de código aprovada (2 rodadas), achados da revisão de UI corrigidos e QA sem bugs: Vitest 2.361 de 2.362 (a falha era a `password-policy-cases-sync`, corrigida no mci-connect#53, squash `21a814f`) e Playwright 411 ok, só com 2 falhas conhecidas sem relação.
- [x] **E2.06** Hierarquia e totais · HIE-02 a HIE-04 e os totais do casal da MIN-01 (a HIE-01 foi feita no E2.04, 2026-11-25) · depende de D2. Spec: [`specs/e2-06-hierarquia-totais.md`](specs/e2-06-hierarquia-totais.md). Aceite do PO (2026-11-25)
  - PRs em produção (2026-11-25): mci-connect#39 (banco: `private.member_hierarchy`, nível, cadeia, G12 e totais por triggers na mesma transação, colunas calculadas fora de `members`; conferências de antes e de depois sem parada, drift 0; squash `af327ef`) e #40 (PRs 2 a 4 do spec num só: Membros e Células com nível e totais, Ministérios com os totais do casal e a referência do cônjuge, gravação que recalcula; squash `1553f09`, promote).
  - Revisão final (T15): APROVADO, com o backlog técnico no spec (linha órfã para o E4.07, contraste do `LevelBadge` no passo dos tokens de tema, 40P01/57014 na `create-user-admin`). Testes: pgTAP 3.709 asserções, concorrência 288 PASS, volume dentro das metas (troca de líder de um G12 com 2 mil abaixo em 24,5 ms), Vitest 1.828 e Playwright 333 ok, só com as falhas de ambiente conhecidas.
- [x] **E2.07** Listagem de membros com filtros e vínculo celular · MEM-13, MEM-14, MEM-15. Spec: [`specs/e2-07-filtros-membros.md`](specs/e2-07-filtros-membros.md). Aceite do PO (2026-11-27)
  - PR 1 em produção (2026-11-26, mci-connect#51, squash `deff10d`, "Deploy: banco" sem promote): vínculo celular e situação de liderança na `members_view`, `members_list`/`members_list_count` com os nove filtros, card "Sem Vínculo Celular" pela RN-10. Revisão de código independente aprovada. A conferência da tarefa 1 não foi rodada em produção antes do deploy (sessão sem acesso ao banco); as guardas e pós-condições das migrations passaram.
  - PRs 2 a 4 em produção (2026-11-27, mci-connect#56, squash `8272e29`, promote): componentes de filtro reutilizáveis (`src/components/filters/`, que a Auditoria passou a usar), os nove filtros de Membros pela `members_list`/`members_list_count` com o estado na URL e a ordem por nível e nome, e o Líder já preenchido no "Novo membro", com aviso para quem vê a igreja toda. Revisão de código aprovada (2 rodadas), achados da revisão de UI corrigidos (alvos de 44 px até 1024 px, entre outros) e QA sem bugs: os nove filtros conferidos contra o servidor, o escopo de um Líder de G12, a corrida entre buscas e a ida e volta pela URL.
- [x] **E2.08** Cadastro de células · CEL-01 a CEL-04 · depende de D4. Spec: [`specs/e2-08-cadastro-celulas.md`](specs/e2-08-cadastro-celulas.md). A CEL-04 já vinha pronta do E2.02. Aceite do PO (2026-11-26)
  - PRs em produção (2026-11-26): mci-connect#43 (banco: a célula inativa não recebe relatório novo, nem pela API; "Deploy: banco" do `0126c28`), #45 (banco: as três pessoas, dia, horário e tipo obrigatórios e dentro das listas, a célula nova sempre ativa, com o ajuste mínimo do front; conferência em produção sem nenhuma linha fora das regras; "Deploy: banco" e promote do `30bd8f0`) e #47 (PRs 3 a 5 do spec num só: CEP comum aos formulários de membro e de célula, lista de Células com a situação e o "Novo relatório" só na ativa, formulário de célula da UX; promote do `b35c5ed`).
  - Revisão final do passo (tarefa 17): APROVADA, com as revisões independentes de código e de UI; a nova tentativa do cadastro compara a célula achada e grava só a diferença (complemento da DT-09). Testes: pgTAP 4.320 asserções no PR 2 e 4.373 com o PR 4 do E2.03 rebaseado, concorrência e volume dentro das metas, Vitest 1.940 e Playwright inteiro sem regressão, só com a falha de massa local conhecida (`excluidos-membros.spec.ts:612`).
  - Ficam para o usuário as perguntas Q-1 a Q-6 do spec, que não bloqueiam.
- [x] **E2.09** Situação do relatório por célula · CEL-05 e o card de pendentes da DSH-02. Spec: [`specs/e2-09-situacao-relatorio.md`](specs/e2-09-situacao-relatorio.md). Aceite do PO (2026-11-26)
  - PRs em produção (2026-11-26): mci-connect#48 (banco: histórico dos períodos ativos das células, a situação calculada na `cells_view` e o `cells_pending` do Dashboard pela situação; "Deploy: banco" do `d74f9c8`; conferência em produção só com `info`, histórico criado para as 2 células) e #49 (PRs 2 e 3 do spec num só: o card "Células com relatório pendente" e a lista de Células com a situação, a legenda, os cartões e a tabela a partir de 1280 px; promote do merge `93d037f`).
  - Revisão final do passo (tarefa 12): APROVADA, com as revisões independentes de código (duas rodadas no PR 1) e de UI. Testes: pgTAP 4.452 a 4.505 asserções conforme a base, concorrência sem regressão, Vitest 2.186 e Playwright inteiro com 382 ok, só com 3 falhas sem relação com o passo.
  - Ressalva de volume: o filtro `pending` para o Administrador ficou entre 244 e 383 ms numa máquina compartilhada (meta 300 ms). Medir de novo antes da carga do legado (E4). As sugestões da revisão de UI (coluna G12 estreita, selos `muted` no escuro) estão no spec do E2.10.
  - Ficam para o usuário as perguntas Q-1 a Q-6 do spec, que não bloqueiam.
- [ ] **E2.10** Listagem de células com filtros e detalhe com os últimos relatórios · CEL-06, CEL-07. Spec: [`specs/e2-10-listagem-celulas.md`](specs/e2-10-listagem-celulas.md) (desenho pronto; depende também do E2.07)
- [x] **E2.11** Lançamento de relatório numa RPC atômica · REL-01 a REL-12, REL-15 · depende de D3. Spec: [`specs/e2-11-lancamento-relatorio.md`](specs/e2-11-lancamento-relatorio.md). Aceite do PO (2026-11-27)
  - PR 1 em produção (2026-11-27, mci-connect#54, squash `3506a5d`, "Deploy: banco" da migration `20261129100000`): retrato `snapshot_*` em `cell_reports` (os 5 relatórios de produção preenchidos), visibilidade do relatório pelo retrato (views, view de excluídos e políticas), troca de célula do relatório recusada e `cell_in_viewer_ministry` removida. Revisão de código aprovada; pgTAP 4.951. As divergências do desenho estão na Solução técnica do spec.
  - PR 2 e PRs 3 e 4 em produção (2026-11-27, mci-connect#57, squash `cb29883`, e #58, squash `423ca91`; "Deploy: banco" run 45997835737, migrations até `20261130100100`, e promote run 45998090478): lançamento (`submit_cell_report`, repetível pelo id do formulário) e edição (`save_cell_report`) numa transação, com as regras de data, semana, reunião, campos, oferta e participantes automáticos no banco; conferência antes de preencher (`cell_report_launch_check`) e contexto da edição (`cell_report_edit_context`); escrita direta fechada e saída dos triggers de semana e da `set_cell_report_participants`. Front: um formulário só (`CellReportDialog`) em Relatórios, Células e Dashboard, em tela cheia no celular, com as datas do servidor, os automáticos mostrados e contados e "Não houve célula" com o aviso do que sai; a lista e o "Ver relatório" mostram as pessoas registradas. Conferido em produção depois do deploy (RPCs novas presentes, a `set_cell_report_participants` e os triggers de semana fora, `authenticated` sem INSERT em `cell_reports`). Testes: pgTAP 5.313, Vitest 2.521 na combinação final, Playwright inteiro só com as falhas conhecidas (UX-19 de `excluidos-membros`, axe de `sign-in`, UX-24 intermitente de `celulas-relatorios-escopo`).
  - Fica para outros passos: a `save_cell_report(NULL, …)` (DA-12) sai no E2.12; tema ou oferta nulos do legado na edição de relatório realizado, no E4.06; o pgTAP `e211_03_submit` falha no primeiro minuto da semana (Problemas conhecidos do `CLAUDE.md`).
- [ ] **E2.12** Listagem de relatórios com filtros e atalhos de semana · REL-13. Spec: [`specs/e2-12-listagem-relatorios.md`](specs/e2-12-listagem-relatorios.md) (desenho pronto; entra depois do E2.10 e do E2.11)
- [ ] **E2.13** Exportação dos relatórios para Excel · REL-14
- [ ] **E2.14** Dashboard, incluindo a correção do mapa de dias da semana · DSH-01 a DSH-06. A dupla contagem no ranking G12 já foi corrigida (2026-11-22, mci-connect#13). Spec: [`specs/e2-14-dashboard.md`](specs/e2-14-dashboard.md) (desenho pronto; os links de cada grupo entram quando a lista correspondente estiver em produção)
- [x] **E2.15** Árvore de ministérios a partir do escopo do usuário · MIN-02. Feito no PR 1 do E2.02 (mci-connect#29): a `ministry_tree_nodes` começa no topo do escopo (DA-6 e DT-24 de [`specs/e2-02-perfis-escopo.md`](specs/e2-02-perfis-escopo.md)), e o estado vazio fica só para quem não vê ninguém. Aceite do PO junto com o E2.02 (2026-11-25)
- [ ] **E2.16** Aceite geral da paridade: matriz do `CLAUDE.md` toda em ✅ · _product-owner_

### Fase 3: Contas e senhas (seção 6)

- [ ] **E3.01** Tabela `private.legacy_credentials` · 6.3 · _backend_
- [ ] **E3.02** Conferência do MD5 legado na função `sign-in`, com política de senha e `must_change_password` · 6.3 · depende de E1.04 e E3.01 · _backend_
- [ ] **E3.03** Testes do login legado com contas de teste: senha com acento, conta só com celular, senha fora da política · _qa_
- [ ] **E3.04** Lista de quem será Administrador e Líder revisada pela liderança, com pelo menos 2 administradores · 6.5, 6.6 · _liderança_
- [ ] **E3.05** Texto de comunicação aos usuários aprovado · 6.7 · _liderança + product-owner_

### Fase 4: Ferramentas de migração (seção 5)

- [x] **E4.01** Estrutura de `data-migration/`: README, variáveis de ambiente e modo `--dry-run` · _backend_. Node 22 (`mysql2`, `pg`), configuração lida do `local.config` sem exportar, travas de destino, testes unitários e de ponta a ponta com MySQL 8.4 em Docker e a stack local (2026-11-25)
- [ ] **E4.02** Migrations de preparação: `legacy_id` e colunas de snapshot · 5.3 · depende de E2.01 e E2.05 · _backend_
- [ ] 🔄 **E4.03** Cópia bruta do MySQL para o schema `legacy` · 5.2 · usa a conexão do `local.config`, só leitura (5.1) · _backend_. Ferramenta pronta (`npm run copy`, 2026-11-25): leitura em transação `READ ONLY` com snapshot consistente, stream direto para o `legacy` numa transação, contagem e checksum dos dois lados, schema sem privilégio para a API. **Roda na máquina do usuário** (a sessão na nuvem não alcança o MySQL); antes, o IP precisa estar em *Trusted sources* do MySQL na DigitalOcean
- [ ] 🔄 **E4.04** Relatório de saneamento · 5.4 · _backend_. Ferramenta pronta (`npm run report`, 2026-11-25): 51 verificações em quatro categorias, com as funções de regra do próprio banco novo, só contagens e Ids do legado em `data-migration/reports/` (ignorado). Falta rodar depois do E4.03 e responder as decisões que o relatório marcar como "Precisa de decisão"
- [ ] **E4.05** Correções feitas no legado pela liderança, a partir do relatório de saneamento · 5.4 · _liderança_
- [ ] **E4.06** SQL de transformação e carga · 5.5 · depende de D9 · _backend_
- [ ] **E4.07** Backfill de nível e totais, reaproveitando as funções dos triggers · 5.5 · _backend_ · antes, uma migration põe o problema `orphan_row` na `member_hierarchy_drift()` e o `DELETE` da linha órfã no `rebuild` (backlog da revisão final do E2.06)
- [ ] **E4.08** Script de criação das contas no Auth e carga das credenciais legadas · 6.2, 6.3 · depende de E3.01 e D7 · _backend_
- [ ] **E4.09** Script de reconciliação · 5.6 · _backend + qa_

### Fase 5: Ensaios (5.7)

- [ ] **E5.01** Ensaio 1 no Supabase de produção (antes do cutover), com dump recente. Registrar a duração e as divergências · _backend + qa_
- [ ] **E5.02** Corrigir scripts e dados a partir do ensaio 1 · _backend + liderança_
- [ ] **E5.03** Ensaio 2 com reconciliação sem divergências · _backend + qa_
- [ ] **E5.04** Homologação de uso pela liderança no Supabase de produção (carga de ensaio), incluindo login com a senha antiga · _liderança + product-owner_
- [ ] **E5.05** Go/no-go aprovado pelos critérios da 7.1 · _liderança + architect + product-owner_

### Fase 6: Cutover (7.2)

Data marcada: _a definir_

- [ ] **E6.01** D−7: comunicação enviada aos usuários; schema do novo congelado
- [ ] **E6.02** D−1: backups do MySQL e do Supabase de produção
- [ ] **E6.03** D0: legado fora do ar
- [ ] **E6.04** D0: limpeza da carga de ensaio, dump final, carga e criação das contas
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
  - `change-member-password`: checar o escopo e o perfil do alvo. ✅ Feito no E2.03: a função saiu, e a redefinição assistida confere o escopo e a função do alvo no banco.
  - Política de SELECT de `members`: parar de expor a linha inteira dos líderes de membros visíveis. ✅ Feito no E1.13.
  - Auditoria: confirmar os grants de `_log_event`, restringir `log_auth_event` e registrar o autor dos cadastros feitos por Edge Function.
  - Impor no banco o que hoje só a UI respeita (`view_sensitive_data`, `assign_role`). ✅ Feito no E1.03 (`assign_role`) e no E1.08 (`view_sensitive_data`, com a trava por coluna).
  - ~~Trocar o domínio dos e-mails fictícios e configurar SMTP próprio no Auth~~: não será feito (E1.06 e E1.07, 2026-11-25). O provedor de e-mail do Auth está desligado (E1.04), e nenhum e-mail é enviado.
- **Volume de dados.** Listagens, contagens e dashboard precisam paginar e contar no servidor. O PostgREST corta respostas em 1000 linhas, e com os dados reais as telas atuais vão truncar sem avisar. ✅ Feito no E1.08, exceto a Auditoria (`Events.tsx` carrega os 500 eventos mais recentes).
- **Perfis e escopo** configurados conforme a seção 6.5. ✅ Feito no E2.02.
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
| AUT-02 | Três perfis: **básico** (vê o escopo, edita o próprio cadastro, lança relatórios), **administrador** (mais o CRUD de membros, células e relatórios no escopo) e **administrador geral** (tudo, sem escopo). | `Domain/Model/Constants.cs`, `[Authorize(Roles)]` nos controllers, `UI/components/NavMenu` | ✅ E2.02 (2026-11-25): funções semeadas Administrador, Líder e Membro (RN-16 do E2.02), com as escritas no escopo | `role_permissions` + RLS (6.5) |
| AUT-03 | **Escopo de visibilidade e escrita.** O usuário vê e altera as subárvores de si mesmo, do cônjuge, do seu G12 e do cônjuge do seu G12, além dessas próprias pessoas. Uma célula ou relatório está no escopo se o líder, o timóteo ou o anfitrião estiver. | `Domain/Extensions/QueryingExtensions.cs` (`ApplyMinistryFilter`) | ✅ E2.02 (2026-11-25): o escopo do legado na leitura e na escrita, no banco, inclusive o próprio cônjuge, o anfitrião e os pastores (RN-01 a RN-09 do E2.02). Desde o E2.11 PR 1 (2026-11-27), o relatório entra no escopo pelo líder, timóteo e anfitrião registrados nele (o retrato da REL-09), e não pelos atuais da célula. | RLS (`is_in_same_ministry` e políticas de escrita) |
| AUT-04 | O administrador geral vê e altera tudo. | `UserExtensions.IsSuperAdmin` | ✅ `view_all_church`; a função Administrador tem sempre todas as permissões (RN-17 do E2.02, 2026-11-25) | RLS |
| AUT-05 | O perfil básico edita só o próprio cadastro e não altera líder, "não tem liderança", batismo, inativo nem perfil. | `UI/pages/Members/details.js` (`canEdit` e campos desabilitados) | ✅ no banco desde o E1.03 (regra 5); conferido pela RN-11 do E2.02 (2026-11-25) | Trigger em `members` |
| AUT-06 | A senha é trocada pelo próprio membro ou por um administrador, para membros do escopo dele. | `Domain/Mappings/DomainToDTOMappingProfile.cs` (`Password`) | ✅ E2.03 (2026-11-26): redefinição assistida por quem tem "Redefinir Senha de Membros" (Administrador e Líder), só de membro visível, não excluído, com conta e de função coberta, nunca a própria, com senha temporária de 7 dias e troca obrigatória no login seguinte (RN-01 a RN-10 do E2.03); todo membro troca a própria senha com a senha atual, sem permissão (RN-11); política, limites e Auditoria no servidor (RN-12, RN-13, RN-17). A `change-member-password` saiu. | RPCs no banco, cofre `private.account_passwords`, guarda em `auth.users` e portão nas views e RPCs (E2.03) |
| AUT-07 | Só o administrador geral altera o perfil de alguém, e ninguém altera o próprio perfil. | `DomainToDTOMappingProfile.cs` (`Role`), `UI/pages/Members/details.js` | ✅ E2.02 (2026-11-25): no banco, inclusive na `create-user-admin`. Atribui quem tem "Atribuir Função aos Membros" ou "Gerenciar Funções" e cobre a função atual e a nova; nas funções semeadas, só a Administrador; ninguém altera a própria (RN-18 do E2.02). | Trigger em `members` |

### 3.2 Membros (MEM)

| ID | Regra | Fonte | Novo | Onde impor |
|---|---|---|---|---|
| MEM-01 | Nome com nome **e** sobrenome. | `UI/pages/Members/details.js`; `Domain/Validators/MemberDtoValidator.cs` | ✅ E2.04 (2026-11-25): no banco, com os espaços ajustados; vale no cadastro novo e quando o nome muda (RN-02 e RN-17 do E2.04) | Banco (CHECK) + zod |
| MEM-02 | Pelo menos um identificador de login real: e-mail, celular ou CPF (D5). | `UI/pages/Members/details.js` | ✅ E2.04 (2026-11-25): no banco; o e-mail fictício fica só na conta de acesso, não conta como identificador e é recusado no cadastro (RN-05 e RN-08 do E2.04) | Banco (CHECK) |
| MEM-03 | E-mail único, sem diferenciar maiúsculas; celular único. | `MemberDtoValidator.cs` | ✅ E2.04 (2026-11-25): índices únicos entre não excluídos, com a normalização do login e a equivalência do 9º dígito no celular (RN-09 e RN-10 do E2.04) | Índices únicos (`lower(email)`, `mobile_whatsapp`) |
| MEM-04 | CPF válido (dígitos verificadores) quando informado. | `UI/shared/utils.js` (`ValidateCPF`) | ✅ E2.04 (2026-11-25): CHECK com `is_valid_cpf`, que recusa também os dígitos iguais (RN-07 do E2.04) | Função SQL + CHECK; zod |
| MEM-05 | CPF único quando informado. Regra nova, necessária porque o novo aceita login por CPF. | — | ✅ E2.04 (2026-11-25): índice único entre não excluídos (RN-09 do E2.04) | Índice único parcial |
| MEM-06 | E-mail em formato válido. | `MemberDtoValidator.cs` | ✅ E2.04 (2026-11-25): CHECK, gravado em minúsculas (RN-04 do E2.04) | CHECK + zod |
| MEM-07 | Líder obrigatório, a menos que a pessoa esteja marcada como "sem liderança" ou seja pastor. O administrador geral pode salvar sem líder. | `UI/pages/Members/details.js` | ✅ E2.04 (2026-11-25): no banco, com as três situações de liderança (pastor, com líder, sem liderança) para todos; sem líder só com a decisão de quem vê a igreja toda (RN-11 e RN-12 do E2.04, RN-10 do E2.02) | Trigger |
| MEM-08 | Data de nascimento entre hoje − 100 anos e hoje. | `MemberDtoValidator.cs` | ✅ E2.04 (2026-11-25): no banco, pelo "hoje" de Brasília, no cadastro novo e quando a data muda (RN-15 do E2.04) | CHECK |
| MEM-09 | Data de batismo só existe para quem é batizado. | `UI/pages/Members/details.js` | ✅ E2.04 (2026-11-25): CHECK; desligar "Batizado(a)?" apaga a data (RN-16 do E2.04) | CHECK |
| MEM-10 | O vínculo de cônjuge é simétrico. | `App/Services/MemberService.cs` (`UpdateSpouse`) | ✅ trigger; o E2.04 acrescentou a recusa de cônjuge de si mesmo, com mensagem em pt-BR (RN-14) | — |
| MEM-11 | Exclusão lógica de membros, conforme a seção 3.8. | Repositórios (`IsDeleted`) | ✅ E2.01 (2026-11-25): exclusão e restauração por RPC; FKs `NO ACTION` | Ver 3.8 |
| MEM-12 | Auditoria: quem criou, quem alterou e quando. | `App/Services/EntityChangeTrackingService.cs` | ✅ E2.05 (2026-11-27): quem cadastrou e quem fez a última alteração, com o momento, gravados pelo banco no próprio registro de membros, células e relatórios (inclusive pela `create-user-admin` e a autoria do legado na carga) e mostrados no registro aberto, com "Ver histórico"; Auditoria com um evento por gravação, imutável, com prazo de guarda e paginada no servidor (RN-01 a RN-20 do E2.05) | Colunas + trigger |
| MEM-13 | Filtros da listagem: nome, liderança (qualquer nível), bairro, cidade, ativo/inativo, possui liderança, batizado, nível ministerial, vínculo celular e período de cadastro. | `Domain/Querying/Filters/MemberFilter.cs`; `UI/pages/Members/index.js` | ✅ E2.07 (2026-11-27, RN-01 a RN-09 e RN-12 a RN-15): os nove filtros na lista de Membros pela `members_list`/`members_list_count`, no banco e dentro do escopo de quem consulta (filtro só restringe; Liderança em qualquer nível, de 1 a 10 pessoas, com "Pessoa indisponível"), múltipla escolha em Liderança, Situação de liderança, Nível e Vínculo celular, estado na URL e ordem por nível e nome | RPC ou view + UI |
| MEM-14 | Vínculo celular: **líder**, **timóteo** ou **anfitrião** (tem célula nesse papel); **participante** (esteve em relatório nos últimos 30 dias); **sem vínculo** (nenhum dos anteriores). | `QueryingExtensions.cs` (`CellLink`) | ✅ E2.07 (2026-11-26, RN-10 e RN-11): `members_view.cell_links` com líder, timóteo e anfitrião de célula **ativa**, participante de relatório **realizado** nos últimos 30 dias e "sem vínculo" (fora pastor e quem tem célula ativa na subárvore); o card "Sem Vínculo Celular" do Dashboard conta pela mesma regra do filtro | View ou RPC |
| MEM-15 | No cadastro de membro novo, o líder já vem preenchido com o usuário logado. | `UI/pages/Members/details.js` (`GetMemberPickerId`) | ✅ E2.07 (2026-11-27, RN-16): o Líder já vem com quem cadastra, para qualquer pessoa com "Criar Membro"; para quem vê a igreja toda, com um aviso e "Ir para o líder" | UI |

### 3.3 Hierarquia (HIE)

| ID | Regra | Fonte | Novo | Onde impor |
|---|---|---|---|---|
| HIE-01 | Sem ciclos: ninguém pode ser discípulo de um discípulo seu, nem de si mesmo. | `MemberService.cs` (`UpdateComputedValues`) | ✅ E2.04 (2026-11-25), antecipada do E2.06: em qualquer profundidade, inclusive com discípulos inativos e com trocas simultâneas (RN-13 do E2.04) | Trigger |
| HIE-02 | O nível ministerial vem da profundidade na árvore. Ao trocar o líder de alguém, a subárvore inteira é recalculada. | `MemberService.cs` + `App/EventHandlers/DomainEvents/MemberChangedHandler.cs` | ✅ E2.06 (2026-11-25, RN-01 a RN-03): a troca de líder, da marca de pastor ou de "sem liderança" recalcula o nível da descendência inteira (ativos e inativos) na mesma operação, sem limite de profundidade. Quem está sem liderança não tem nível (P-HIE-01) | Trigger |
| HIE-03 | Líder direto, G12 e caminho da liderança ("Pastor / G12 / … / líder") disponíveis para exibir e filtrar. | `Member.LeadershipTree`, `ComputedG12Leader` | ✅ E2.06 (2026-11-25, RN-04, RN-10 e RN-11): cadeia e G12 no banco, na mesma operação; Membros mostra o nível e "G12 / líder", e Células o líder com o nível e o G12. O caminho em texto não aparece em tela, como no legado. O filtro é da MEM-13 (E2.07) | View ou colunas mantidas por trigger |
| HIE-04 | Totais por pessoa: discípulos em todos os níveis, e células lideradas na subárvore, incluindo as da própria pessoa. | `MemberChangedHandler.cs`, `CellChangedHandler.cs` | ✅ E2.06 (2026-11-25, RN-05 a RN-08): na mesma operação, para todos os de cima em qualquer profundidade; células divididas pelo sexo do líder. D2: não conta inativos (o legado contava), mas a contagem passa por eles (P-HIE-06) | Trigger |

### 3.4 Células (CEL)

| ID | Regra | Fonte | Novo | Onde impor |
|---|---|---|---|---|
| CEL-01 | Líder, timóteo e anfitrião obrigatórios. | `Domain/Validators/CellDtoValidator.cs` | ✅ E2.08 (2026-11-26): os três obrigatórios em toda gravação, inclusive na Macrocélula e pela *service role*; a mesma pessoa pode ocupar mais de um papel; pessoa excluída recusada (RN-02 a RN-04 do E2.08) | `NOT NULL` + trigger com código e campo |
| CEL-02 | Dia da semana e horário obrigatórios. | `CellDtoValidator.cs` | ✅ E2.08 (2026-11-26): sem padrão; dia só de Domingo a Sábado, horário de 00:00 a 23:59 sem segundos (RN-05 e RN-06 do E2.08) | `NOT NULL` + `CHECK` sobre `cell_weekdays()` e o horário + trigger com código e campo |
| CEL-03 | Tipos: Evangelística, Discipuladora (no novo, "Discipulado") e Macrocélula. | `Domain/Model/Enum/CellType.cs` | ✅ E2.08 (2026-11-26): só os três valores; sem tipo, a célula nova fica Evangelística (RN-07 do E2.08) | `CHECK` sobre `cell_types()` + trigger com código e campo |
| CEL-04 | Criar, editar e excluir célula: administradores, dentro do escopo. | `API/Controllers/CellController.cs` | ✅ E2.02 (2026-11-25): só com as permissões de célula e no escopo; ser líder ou timóteo não dá direito de editar (RN-12 do E2.02). Conferida no E2.08 (RN-12), sem mudança | RLS |
| CEL-05 | **Situação do relatório** da semana atual (domingo a sábado, horário de Brasília). Ver a definição abaixo da tabela. | `QueryingExtensions.cs` (`ReportStatus`) | ✅ E2.09 (2026-11-26): calculada a cada consulta, na lista de Células, com a legenda (RN-01 a RN-07 e RN-09 do E2.09). O filtro e o detalhe da célula são da CEL-06 e da CEL-07 (E2.10) | `cells_view.report_status` e `report_missing_weeks` (`private.cell_report_situation`), com o histórico `private.cell_active_periods` |
| CEL-06 | Filtros: líder, G12, logradouro, bairro, cidade, tipo, dia da semana, situação do relatório e período de cadastro. | `Domain/Querying/Filters/CellFilter.cs`; `UI/pages/Cells/index.js` | ❌ só busca por texto | RPC ou view + UI |
| CEL-07 | O detalhe da célula mostra os 3 últimos relatórios e dá acesso à lista completa. | `CellController.GetLastReportsByCellId`; `UI/pages/Cells/details.js` | ❌ | UI |
| CEL-08 | Exclusão lógica de células, preservando os relatórios (seção 3.8). | `IsDeleted` | ✅ E2.01 (2026-11-25): os relatórios ficam, com "Célula excluída" | Ver 3.8 |

Definição da situação do relatório (CEL-05), como ficou no E2.09 (RN-02 a RN-06 de lá). Só a célula ativa e não excluída tem situação:
- **Enviado** (Célula realizada ou Não houve célula): tem relatório não excluído nesta semana.
- **Ainda não ocorreu**: sem relatório, e o prazo da reunião desta semana ainda não chegou. O prazo é exatamente 1 hora depois do dia e do horário da célula.
- **Pendente**: sem relatório, o prazo chegou, e a semana conta para a célula.
- **Conta a partir da próxima semana**: sem relatório, o prazo chegou, mas a célula não estava cadastrada, ativa e não excluída no prazo.
- **Semanas anteriores sem relatório** (1, 2, 3 ou 4 ou mais), ao lado da situação, exceto no Enviado: contadas a partir da semana passada, até a primeira semana com relatório ou que não conta.

### 3.5 Relatórios de célula (REL)

| ID | Regra | Fonte | Novo | Onde impor |
|---|---|---|---|---|
| REL-01 | A data não pode ser futura. | `App/Services/ReportApp.cs` | ✅ E2.11 (2026-11-27, RN-05): data e horário, juntos, não passam de agora (Brasília), no lançamento e na edição que muda a data ou o horário | RPC |
| REL-02 | Só é possível lançar relatório da **semana atual** (domingo 00:00 a sábado 23:59:59, horário de Brasília). | `ReportApp.cs` | ✅ E2.11 (2026-11-27, RN-04): só no lançamento, na `submit_cell_report`; na edição, a data só muda dentro da semana do próprio relatório (RN-16). O trigger `enforce_cell_report_current_week` saiu | RPC, ou trigger só no INSERT |
| REL-03 | **Um relatório por célula por semana.** Mensagem: "O relatório para esta semana já foi enviado (#id)". | `ReportApp.cs` | ✅ E2.11 (2026-11-27, RN-07): índice único `cell_reports_cell_week_key` entre os não excluídos (E2.01); para quem vê o relatório da semana, a mensagem o identifica pela reunião e pela situação (no lugar do `#id`) e oferece "Editar relatório" a quem pode. O trigger `enforce_unique_weekly_cell_report` saiu | Índice único `(cell_id, semana)` |
| REL-04 | O relatório não pode ser de antes do dia e do horário da célula naquela semana. | `ReportApp.cs` | ✅ E2.11 (2026-11-27, RN-06): no lançamento, não antes do dia e do horário da reunião da semana; antes da reunião, o formulário avisa e não deixa preencher (RN-19) | RPC |
| REL-05 | Quando a célula aconteceu: data, horário e tema obrigatórios. | `Domain/Validators/ReportDTOValidator.cs`; `UI/pages/Report/details.js` | ✅ E2.11 (2026-11-27, RN-08): data, horário, tema e oferta obrigatórios, no banco | CHECK |
| REL-06 | "Não houve célula": a justificativa é obrigatória, e a data registrada é o dia e horário previstos da célula na semana. | `UI/pages/Report/details.js` | ✅ E2.11 (2026-11-27, RN-09): motivo obrigatório; a data e o horário gravados são os da reunião da semana (os enviados são ignorados); sem participantes, visitantes, tema e oferta, com aviso do que sai | CHECK + RPC |
| REL-07 | Líder, timóteo e anfitrião entram automaticamente como participantes, sem duplicar. | `App/Services/ReportService.cs` (`Add`) | ✅ E2.11 (2026-11-27, RN-11): no lançamento de célula realizada, líder, timóteo e anfitrião da célula naquele momento entram sozinhos, sem duplicar, mostrados e contados no formulário antes do envio | RPC |
| REL-08 | Visitantes são nomes livres, e só os nomes preenchidos contam. | `ReportService.cs` | ✅ E2.11 (2026-11-27, RN-12): nomes livres, vazios descartados, no máximo 1000 | RPC |
| REL-09 | O relatório guarda um snapshot de líder, anfitrião, timóteo e tipo da célula no momento do lançamento. | `Domain/Model/Report.cs` | ✅ E2.11 (2026-11-27, RN-14): retrato `snapshot_*` gravado pelo banco em todo lançamento, preenchido nos relatórios existentes, imutável (a célula do relatório não pode ser trocada) e usado no escopo (AUT-03); a lista de Relatórios e o "Ver relatório" mostram as pessoas registradas, com o G12 atual do líder registrado | Colunas + RPC |
| REL-10 | Relatório e participantes são gravados juntos (tudo ou nada). | Transação do EF | ✅ E2.11 (2026-11-27, RN-15): relatório, retrato, participantes, autoria e Auditoria numa transação só (`submit_cell_report` e `save_cell_report`), com envio repetível sem gravar outro relatório | RPC |
| REL-11 | Quem lança (D3): líder, timóteo e anfitrião da célula, mais quem gerencia células no escopo. No legado, qualquer usuário com a célula no escopo. Editar e excluir: administradores. | `API/Controllers/ReportController.cs`, `ReportApp.cs` | ✅ E2.02 e E2.11 (2026-11-27, RN-02 e RN-03): quem lança (D3), edita e exclui, com o escopo, imposto nas RPCs; a escrita direta nas tabelas de relatório e participantes foi fechada | RLS / RPC |
| REL-12 | Oferta em reais, maior ou igual a zero. | `Report.Contribution` | ✅ E2.11 (2026-11-27, RN-13): obrigatória na célula realizada, sem valor sugerido, de R$ 0,00 a R$ 999.999,99 com 2 casas, com `CHECK` no banco | CHECK |
| REL-13 | Listagem com filtros (líder, G12, período) e atalhos para esta semana, a passada e a retrasada. | `UI/pages/Report/index.js`, `UI/components/NavMenu` | ❌ | RPC + UI |
| REL-14 | **Exportação para Excel**, uma linha por célula no período, ordenada por G12. Colunas: Célula #, G12, Líder, Endereço, Bairro, Situação, Data/Hora, Oferta, Nº de participantes, Nº de visitantes e Observações. Situação: "Relatório não entregue.", "Não houve célula." ou "Célula realizada.". | `App/Services/ExportService.cs`, `ColumnFormatter.cs` | ❌ | Edge Function ou geração no cliente |
| REL-15 | No formulário, a célula é escolhida pelo nome do líder. Depois de escolhida, a tela mostra líder, timóteo, anfitrião, G12, tipo e endereço, só para leitura. | `UI/pages/Report/details.js` | ✅ E2.11 (2026-11-27, RN-17): o seletor oferece só as células em que a pessoa pode lançar, com busca pelo líder, pela rua e pelo bairro; escolhida a célula, líder, timóteo, anfitrião, G12, tipo e endereço aparecem só para leitura | UI |

### 3.6 Dashboard (DSH)

| ID | Regra | Fonte | Novo | Onde impor |
|---|---|---|---|---|
| DSH-01 | Todos os números respeitam o escopo do usuário. | `App/Services/DashboardService.cs` (repositórios com escopo) | ✅ E2.02 (2026-11-25): as RPCs do dashboard leem das views com o escopo novo | RLS / RPC |
| DSH-02 | **Esta semana**: relatórios enviados, células com relatório pendente (CEL-05), visitantes, novos membros e novas células. | `DashboardService.cs` | 🟡 faltam novos membros e novas células (E2.14). Os pendentes já seguem a CEL-05 (E2.09, 2026-11-26): o card "Células com relatório pendente" conta as células "Pendente", o mesmo número da lista de Células (RN-08 do E2.09) | RPC (`dashboard_summary`, E1.08; `cells_pending` pela situação, E2.09) |
| DSH-03 | **Geral**: membros ativos, células evangelísticas, células discipuladoras, inativos, não batizados, sem liderança e sem vínculo celular. | `DashboardService.cs` | 🟡 | RPC |
| DSH-04 | Gráfico da semana: células realizadas × canceladas × sem relatório. | `UI/pages/Home` | 🟡 | UI |
| DSH-05 | Cada card abre a listagem correspondente já filtrada. | `UI/pages/Home` | ❌ depende de CEL-06 e REL-13 (a lista de Membros já tem o equivalente de cada card de membros, RN-17 do E2.07; o clique é do E2.14) | UI |
| DSH-06 | Cards com valor zero são escondidos. O card de pendentes fica vermelho quando > 0 e verde quando = 0. | `UI/pages/Home` | — | UI (desejável) |

### 3.7 Ministérios (MIN)

| ID | Regra | Fonte | Novo | Onde impor |
|---|---|---|---|---|
| MIN-01 | Árvore de casais com o total de discípulos e de células, carregada sob demanda. | `App/Services/MinistryService.cs` | ✅ E1.08 PR 4; totais do casal pela RN-09 do E2.06 (2026-11-25): sem dupla contagem quando um cônjuge está abaixo do outro, nível da posição e o cônjuge de baixo como referência | `ministry_tree_nodes` (E1.08, PR 4; E2.06) |
| MIN-02 | A raiz é o nível mais alto visível no escopo do usuário: quem tem escopo de ministério começa pelo próprio ministério. | `MemberRepository.GetChildrenWithSpouseAsync` | ✅ E2.02 PR 1 (2026-11-25, DA-6): com "Visualizar Toda a Igreja", começa nos pastores; sem ela, no casal G12 de quem consulta ou, sem G12, no próprio casal | RPC (`ministry_tree_nodes`) |
| MIN-03 | Só membros ativos aparecem na árvore. | `GetChildrenWithSpouseAsync` | ✅ | `ministry_tree_nodes` (E1.08, PR 4) |

### 3.8 Exclusão lógica (DEL)

Decidido em 2026-11-14 (D1). Vale para:
- **membros**, **células** e **relatórios de célula**;
- toda entidade de negócio nova (Consolidação, Escolas).

Continuam com exclusão física as tabelas de configuração (`roles`, `role_permissions`) e as tabelas de ligação (`cell_report_participants`).

| ID | Regra | Fonte | Novo | Onde impor |
|---|---|---|---|---|
| DEL-01 | Excluir marca o registro (`deleted_at`, `deleted_by`) em vez de apagá-lo. A API não permite exclusão física. | Repositórios (`IsDeleted`) | ✅ E2.01: RPCs `delete_*`; sem política nem privilégio de DELETE | RPC de exclusão; sem política de DELETE |
| DEL-02 | Registros excluídos não aparecem em listagens, buscas, seletores, contagens, dashboard, árvore de ministérios nem nos totais de discípulos e células. | Filtro global (`HasQueryFilter`) em `Infrastructure.Data/Context/AppDbContext.cs` | ✅ E2.01: RLS, views, RPCs do dashboard, árvore e totais sem excluídos. CEL-05 sem excluídos (E2.09, 2026-11-26); novos cards (DSH) e exportação nascem já sem excluídos (E2.13, E2.14) | RLS, e funções e triggers que ignoram excluídos |
| DEL-03 | Excluir um relatório libera a semana: a célula pode receber outro relatório (REL-03). | `ReportApp.cs` (só considera não excluídos) | ✅ E2.01: índice `cell_reports_cell_week_key` só entre não excluídos | Índice único parcial (`WHERE deleted_at IS NULL`) |
| DEL-04 | A unicidade de e-mail, celular e CPF considera só membros não excluídos. | `MemberDtoValidator.cs` | ✅ E2.01 e E2.04 (2026-11-25): a restauração, o aviso no cadastro e os índices únicos (MEM-03, MEM-05) consideram só não excluídos, com a mesma normalização (RN-18 do E2.01, RN-09 do E2.04) | Índices únicos parciais |
| DEL-05 | Excluir um membro desfaz o vínculo de cônjuge. | `MemberService.Remove` (`UpdateSpouse`) | ✅ E2.01: `delete_member` desfaz o vínculo nos dois lados; a restauração não refaz | RPC de exclusão |
| DEL-06 | Um membro excluído não consegue mais entrar no sistema. | O login só busca não excluídos | ✅ O login recusa o excluído (`sign-in`, motivo "Cadastro excluído"), a conta fica suspensa no Auth (E2.01 PR 1, E1.04) e a sessão aberta é encerrada na próxima leitura ou gravação (E2.01 PR 6, 2026-11-25) | Função de login + bloqueio da conta no Auth; helpers de permissão ignoram excluídos |
| DEL-07 | Excluir uma célula preserva os relatórios dela, que continuam no histórico e nas somas de períodos passados. | `IsDeleted` em `Cells` e `Reports` | ✅ E2.01: FKs `NO ACTION`; os relatórios ficam no histórico e nas somas | FKs sem cascata |
| DEL-08 | Um membro com discípulos não excluídos, ou que é líder, timóteo ou anfitrião de célula não excluída, só pode ser excluído depois que essas ligações forem reatribuídas. Inativos também bloqueiam (P-DEL-01 do E2.01). | Nova (D10) | ✅ E2.01: `delete_member` recusa e diz o que falta | RPC de exclusão |
| DEL-09 | Administradores podem restaurar um registro excluído. Ao cadastrar alguém com o e-mail, o celular ou o CPF de um membro excluído, o sistema oferece restaurar o cadastro existente em vez de criar outro. | Nova | ✅ E2.01: listas de excluídos, `restore_*` e aviso no cadastro (RN-15 a RN-18) | RPC + UI |

Pontos de atenção para o `architect`:
- **Histórico.** Participantes e snapshots de relatórios podem apontar para membros excluídos. É preciso definir como mostrar o nome dessas pessoas sem expor o cadastro (por exemplo, uma função que devolve só o nome).
- **Exclusão via RPC, não via `UPDATE`.** Com o RLS escondendo os excluídos, um `UPDATE ... RETURNING` feito pelo front deixa de funcionar. Por isso a exclusão (e a restauração) devem ser RPCs.
- **E-mail único no Auth.** O e-mail é único no Supabase Auth mesmo quando o membro foi excluído. Por isso a DEL-09 restaura o cadastro em vez de criar um novo.
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
| D7 | Domínio dos e-mails fictícios | Manter `mci12fakemail.com` ou usar um domínio da igreja | ✅ **Revista em 2026-11-25:** continua o `mci12fakemail.com` (o E1.06 saiu do plano). A decisão de 2026-11-23 era um domínio da igreja. |
| D8 | Retenção do banco legado depois do desligamento | — | ✅ **Decidido em 2026-11-23:** backup criptografado guardado por 12 meses e depois descartado. |
| D9 | Quem é pastor | Lista dos membros sem líder e sem "não tem liderança" | ✅ **Decidido em 2026-11-23:** os pastores são **Samuel Colares e Magda Colares** (casal). Os demais membros sem líder e sem "não tem liderança" seguem o saneamento (5.4). |
| D10 | Excluir um membro que tem discípulos ou células ativas (DEL-08) | Bloquear até reatribuir; permitir e deixar os discípulos sem líder; ou passar os discípulos automaticamente para o líder de quem foi excluído | ✅ **Decidido em 2026-11-23:** bloquear até reatribuir, com uma mensagem que diga o que falta (DEL-08). |
| D11 | Senha inicial de quem é cadastrado pelo app | Manter `123456` como padrão, ou exigir uma senha no cadastro (como no legado) | ✅ **Decidido em 2026-11-15:** manter `123456` como senha inicial padrão. |

## 5. Migração dos dados

### 5.1 Princípios

- **O legado não é alterado.** A extração usa a conexão que já está no `local.config` (decisão do usuário, 2026-11-25; o E1.10 não será feito). Essa conexão tem privilégio de escrita, então os scripts só podem usar `SELECT` e `mysqldump --single-transaction`, sem nenhum comando que escreva no legado.
- **Idempotência.** Os scripts podem rodar várias vezes com o mesmo resultado (upsert por `legacy_id`).
- **Reprodutibilidade.** Tudo fica versionado em `data-migration/`, na raiz deste repositório.
- **Ensaio antes do cutover, no próprio Supabase de produção** (decisão do usuário, 2026-11-25; sem projeto de homologação). A carga de ensaio é identificada por `legacy_id` e pelas contas que a carga cria no Auth, e a limpeza apaga só isso, preservando o que foi cadastrado direto no novo. A limpeza roda antes de cada novo ensaio e antes da carga final.
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
- Colunas de snapshot em `cell_reports` (REL-09): `snapshot_leader_id`, `snapshot_host_id`, `snapshot_timothy_id`, `snapshot_cell_type`, `NOT NULL`, em produção desde o E2.11 PR 1 (2026-11-27). O trigger do retrato roda também em `replica`: o retrato do legado fica, e só as colunas que vierem nulas são completadas pela célula.
- `deleted_at` e `deleted_by` em `members`, `cells` e `cell_reports`; FKs sem `ON DELETE CASCADE` ou `SET NULL`; índices únicos parciais (`WHERE deleted_at IS NULL`); helpers de RLS, triggers e funções de totais ignorando excluídos (seção 3.8).
- `created_by` / `updated_by` (MEM-12): em produção desde o E2.05 PR 1 (2026-11-26), com a autoria do legado (RN-10 e RN-11 do E2.05).
- Toda coluna nova em `members` (`legacy_id`, `deleted_at`, `deleted_by`, `created_by`, `updated_by`…) precisa de `GRANT SELECT (coluna) ON public.members TO authenticated` na própria migration, por causa da trava por coluna do E1.08 PR 5.
- Tabela `private.legacy_credentials` (6.3).
- CHECKs de domínio (`gender`, `meeting_day`, `type`) e os índices únicos (MEM-03, MEM-05, REL-03), criados **antes** da carga para barrar dados ruins.
- Células (E2.08, já em produção): `NOT NULL` em `leader_id`, `timothy_id`, `host_id`, `meeting_day` e `meeting_time`, e os `CHECK`s `cells_meeting_day_check`, `cells_type_check` e `cells_meeting_time_check`. Valem também para as células excluídas. A pessoa excluída num papel não é barrada em `replica`: é conferida na reconciliação (5.6).
- Relatórios (E2.11, em produção desde 2026-11-27): `offering` sem padrão e com `CHECK` (de 0 a 999.999,99, 2 casas); escrita só pelas RPCs, com o trigger de guarda `a0_guard_cell_report_write`, que não dispara em `replica`. A carga não usa a marca de manutenção `mci.cell_report_write`.

Na carga vamos usar `session_replication_role = replica`. Isso desliga triggers e FKs, mas os CHECKs e os índices únicos continuam valendo.

### 5.4 Inventário e saneamento

Rode depois da cópia bruta para o schema `legacy`. O que precisar de decisão humana é corrigido **no próprio legado**, pela liderança e pela interface do legado, antes do cutover. O resto é tratado automaticamente na transformação.

| Verificação | Tratamento |
|---|---|
| Contagens por tabela (ativos e excluídos) | Base da reconciliação (5.6) |
| E-mails duplicados entre membros não excluídos (ignorando maiúsculas e espaços) | Corrigir no legado |
| Celulares duplicados entre membros não excluídos, com a leitura e a equivalência do 9º dígito do E2.04 (RN-06 e RN-09) | Corrigir no legado |
| CPFs duplicados entre membros não excluídos | Corrigir no legado |
| CPFs inválidos: fora dos 11 dígitos, com os dígitos verificadores errados ou com todos os dígitos iguais (RN-07 do E2.04) | Importar como nulo e listar |
| E-mails fora do formato da RN-04 do E2.04, ou num domínio fictício (RN-05) | Importar como nulo e listar; a conta usa o e-mail técnico (6.2) |
| Celular fora do formato da RN-06 do E2.04 | Migra como está, só com dígitos, e é listado, com destaque quando é o único identificador |
| Nome com uma palavra só | Migra como está, com os espaços ajustados; listado só para informação |
| Nascimento futuro, ou de 100 anos atrás ou mais | Migra como está e é listado |
| Cônjuge apontando para a própria pessoa | O vínculo é desfeito e listado |
| Membros sem identificador real (e-mail válido, celular no formato da RN-06 ou CPF válido, RN-08 do E2.04) | Migram sem conta de acesso; listar |
| Membros sem senha | Migram com conta, sem credencial legada; precisam de redefinição (6.4) |
| Sem líder e sem "não tem liderança" | Só Samuel Colares e Magda Colares são pastores (D9). Os demais são listados para a liderança indicar o líder no legado (E4.05). Quem não for corrigido migra sem liderança |
| Membros sem liderança que têm discípulos (P-HIE-02 do E2.06; `private.member_hierarchy_problems()`, `no_leadership_with_disciples`) | Listar para a liderança indicar o líder no legado (E4.05). Quem não for corrigido migra sem liderança, e a descendência conta o nível a partir dele |
| "Não tem liderança" marcado, mas com líder preenchido | O líder é descartado |
| Referência para registro excluído | Cônjuge excluído: o vínculo é desfeito (DEL-05). Membro ativo com líder excluído: listar para reatribuição (D10). Célula ou relatório excluído: migra com `deleted_at`, e a referência é mantida. |
| Cônjuge não recíproco | Corrigir no legado |
| Ciclo na hierarquia | Corrigir no legado |
| Horário de célula fora do formato `HH:mm`, inclusive em célula excluída | Corrigir no legado |
| Célula não excluída com líder, timóteo ou anfitrião excluído (RN-13 do E2.08) | Listar (E4.04) e corrigir no legado (E4.05), escolhendo outra pessoa. A carga não termina enquanto houver |
| Dia da célula fora de `0` a `6` ou tipo fora de `0` a `2` | Corrigir no legado (não deve existir: os dois são enumerações) |
| Pessoa inativa num papel de célula, ou a mesma pessoa em mais de um papel | Migra como está (RN-03 e RN-04 do E2.08) |
| Mais de um relatório da mesma célula na mesma semana | Fica o mais recente; os outros migram como excluídos. Listar para a liderança. Sem isso, o índice único da REL-03 (`cell_reports_cell_week_key`, E2.01) barra a carga, porque ele vale mesmo com `session_replication_role = replica`. |
| Relatório com `CellType` vazio | O trigger do retrato completa o tipo pela célula (E2.11); o relatório de carga diz quantos |
| "Não houve célula" com tema, oferta maior que zero ou visitantes; célula realizada sem tema ou sem oferta | Migram como estão; listar (E4.04). A edição de um relatório realizado sem tema ou oferta pede o campo (RN-08 do E2.11): decidir com o PO no E4.06 se corrige no legado, preenche na carga ou aceita |
| Oferta negativa ou acima de R$ 999.999,99 | Corrigir no legado (o `CHECK` da oferta barra a carga) |

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
   - `is_pastor` e `has_leadership` (D9).
   - Nível, cadeia, G12 e totais: `SELECT private.rebuild_member_hierarchy();`, com as mesmas regras das gravações (RN-13 do E2.06). Antes da carga, a linha órfã que uma exclusão física em `replica` deixa em `private.member_hierarchy` precisa ser tratada (E4.07). Depois, `private.member_hierarchy_drift()` volta vazia.
   - Histórico dos períodos ativos das células (E2.09): `SELECT private.backfill_cell_active_periods();` depois de carregar `cells`, com o `created_at` vindo do `CreationDate` do legado como ponto de partida (nulo = desde sempre, RN-10 do E2.09). Sem isso, a célula carregada não tem situação do relatório.
   - `ANALYZE` nas tabelas carregadas. Com estatísticas desatualizadas, as views e RPCs do E1.08 podem escolher planos ruins (risco 17 do spec do E1.08).
7. **Validação das FKs.** Como o modo `replica` não checa FKs, toda referência precisa ser conferida explicitamente.
8. **Contas de acesso** (6.2).

#### Members → `members`

| Legado (`Members`) | Novo | Transformação |
|---|---|---|
| `Id` | `legacy_id` | — |
| `Name` | `name` | `trim`; espaços repetidos viram um só |
| `Email` | `email` | `lower(trim)`. Se for inválido, fictício ou vazio, fica nulo: o e-mail técnico fica só na conta (6.2; o `CHECK` do E2.04 recusa e-mail fictício no cadastro mesmo em `replica`) |
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
- `has_leadership` fica ligado só para quem tem líder, e desligado para pastores e para quem está sem liderança (RN-11 do E2.04; o `CHECK` vale também na carga).
- `HasNoLeadership = 0` e sem líder → `is_pastor = true` só para Samuel Colares e Magda Colares (D9), identificados na carga pelo `Id` do legado, e não pelo nome. Os demais seguem o saneamento (5.4) e, se não forem corrigidos, migram como `HasNoLeadership = 1`.

#### Cells → `cells`

| Legado (`Cells`) | Novo | Transformação |
|---|---|---|
| `Id` | `legacy_id` | — |
| `LeadId` / `HostId` / `TimothyId` | `leader_id` / `host_id` / `timothy_id` | Via `legacy_id` |
| `WeekDay` | `meeting_day` | `0` Domingo, `1` Segunda, `2` Terça, `3` Quarta, `4` Quinta, `5` Sexta, `6` Sábado |
| `Time` | `meeting_time` | `'HH:mm'::time`, sem segundos |
| — | `is_active` | Sempre `true`, inclusive nas excluídas: o legado não tem célula inativa (RN-11 do E2.08) |
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
  - Nível (RN-13 do E2.06): `12 ^ g12_level = MinistryLevel` para quem tem líder no novo; "sem liderança" no novo = 9999999 no legado; quem está a mais de 6 níveis do topo é comparado com 12^6. A diferença esperada, listada, são os membros sem líder e sem "não tem liderança" que não são os pastores da D9 e não foram corrigidos no E4.05.
  - `private.member_hierarchy_problems()` lista o que sobrou para a liderança (`no_top`, `cell_leader_deleted`, `no_leadership_with_disciples`).
- **Regras de membro.** `private.member_rule_violations()` (E2.04) não devolve nenhuma linha: nenhum cadastro viola as regras do tipo (a) da RN-01 do E2.04 (RN-18).
- **Regras de célula.** `private.cell_rule_violations()` (E2.08) não devolve nenhuma linha: nenhuma célula não excluída fica sem uma das três pessoas, com pessoa excluída, ou com dia, horário ou tipo fora das listas (RN-13 do E2.08).
- **Situação do relatório** (E2.09). `private.cell_active_period_problems()` não devolve nenhuma linha (toda célula tem o histórico). O card de pendentes de uma semana de referência é comparado com o legado célula a célula (`private.cell_report_situation`, como `postgres`); cada diferença é listada com o motivo, que só pode ser o prazo exato de 1 hora ou a semana que não conta (RN-10 do E2.09).
- **Totais** (RN-13 do E2.06). Os totais de discípulos e de células batem com os recalculados a partir do líder de cada membro no legado, sem inativos (D2) e sem excluídos. Os totais guardados no legado não servem de base, porque ele os atualiza por evento e só até 5 ancestrais.
  - `male_cells` e `female_cells` não podem estar todos zerados. Uma carga com os triggers desligados e sem o recálculo deixa os carregados sem linha em `private.member_hierarchy` ("Sem liderança" e totais zero), e o ranking G12 mostra 0 células.
  - A soma de `total_cells` do ranking G12 (`dashboard_g12_ranking`) bate com as células ativas sob os G12.
- **Relatórios.**
  - Participantes por relatório = `NumMembers`.
  - Visitantes = `NumVisitors`.
  - Soma de ofertas por mês igual à do legado.
  - Retrato (`snapshot_*`) sem nulos e com as referências válidas; a contagem dos relatórios cujo tipo veio da célula (E2.11).
- **Dashboard** de uma semana de referência comparado lado a lado (legado × novo), com um usuário de cada perfil, o que testa o escopo também.
- **Login** com contas de teste de cada perfil, incluindo uma conta só com celular e uma com acento na senha.
- **Amostragem manual.** Alguém da liderança confere 20 membros, 10 células e 10 relatórios.

### 5.7 Ensaios

Os ensaios rodam no Supabase de produção, antes do cutover (5.1). Antes de cada ensaio, faça backup do banco e limpe a carga anterior.

1. **Ensaio 1**, com um dump recente: medir a duração, rodar as validações e corrigir os scripts.
2. **Ensaio 2**, depois do saneamento: validação pela liderança (homologação de uso), incluindo o login com a senha antiga.
   - A senha que alguém trocar durante o ensaio se perde na limpeza. Na carga final, vale de novo a senha do legado.
   - Durante os ensaios, os dados reais do legado ficam visíveis no novo para quem já tem conta lá, conforme o perfil de cada um.
3. **Go/no-go** (7.1).

## 6. Usuários, perfis e senhas

### 6.1 Situação atual

| | Legado | Novo |
|---|---|---|
| Identificador de login | E-mail ou celular | E-mail, celular ou CPF |
| Onde fica a senha | `Members.Password`: MD5 hexadecimal, sem salt, calculado no navegador | Cofre `private.account_passwords` (bcrypt), fora do Auth desde o E2.03; só o banco grava (`private.write_password`) |
| Quem tem conta | Todo membro com senha | Todo membro criado pela tela (`auth_user_id`) |
| Membro sem e-mail | Entra pelo celular | Conta com e-mail fictício `@mci12fakemail.com` |
| Superusuário | `AdminUser`, definido em configuração | Membros com o perfil Administrador |

O Supabase Auth não aceita importar hashes MD5. As senhas atuais só podem ser aproveitadas **verificando o MD5 no primeiro login** (6.3).

### 6.2 Criação das contas

- **Quem recebe conta:** todo membro migrado **não excluído** que tenha um identificador real: e-mail, celular ou CPF (D5; impacto do E1.04 e do E2.04 no E4.08).
  - O status ativo/inativo não importa, porque o legado também não bloqueia login de inativo.
  - Membros excluídos não recebem conta. Se um deles for restaurado (DEL-09), a conta é criada nesse momento (E4.08).
- **E-mail da conta:**
  - para todos, o e-mail técnico `member_account_email(id)` (`<id do membro>@<domínio fictício>`), e o id da conta é o id do membro (DA-1 e DT-01 do E2.04). É determinístico: refeita, a carga acha a conta pelo e-mail e só religa;
  - `members.email` recebe só o e-mail real válido, ou fica nulo (RN-05 do E2.04).
- **Sem senha** (E2.03): a conta da carga nasce sem senha, nem no Auth nem no cofre, e por isso sem a marca de troca obrigatória (RN-08 do E2.03). A senha real é gravada no primeiro login (6.3) ou por redefinição (6.4); os membros sem senha no legado (5.4) entram pela redefinição.
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
   3. Se o MD5 conferir, grava a senha **como foi digitada** no cofre (`private.write_password`, E2.03; o `updateUserById` não serve mais, por causa da guarda em `auth.users`). Se ela não atende à política (RN-13 do E2.03), põe a marca de troca obrigatória `legacy_weak` na mesma transação, e a Auditoria registra "Troca de senha exigida", motivo "Senha fora das regras". Quem não concluir a troca volta a ela na próxima entrada com a mesma senha.

      Em seguida, apaga a credencial legada.
   4. Faz o login no Auth e devolve a sessão. O front chama `supabase.auth.setSession`.
   5. Em qualquer falha, responde só "Usuário ou senha inválidos", sem revelar se o usuário existe.
3. **Front.**
   - O login passa a chamar a `sign-in`.
   - Com a marca, o usuário é levado para a tela de troca obrigatória antes de qualquer outra, e a API recusa tudo até a troca (feito no E2.03).

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

- **Sem recuperação por e-mail** (E1.07 fora do plano, 2026-11-25; o provedor de e-mail do Auth está desligado desde o E1.04). Quem esquece a senha fala com o líder ou com um administrador e recebe uma senha temporária (redefinição assistida).
- **Redefinição assistida (AUT-06), feita no E2.03:** quem tem "Redefinir Senha de Membros" (Administrador e Líder) gera, para um membro visível com função coberta, uma senha temporária de 8 caracteres, válida por 7 dias, mostrada uma vez só e passada ao membro por quem redefiniu. A redefinição encerra as sessões do membro e põe a marca de troca obrigatória. É o caminho para quem só tem celular.
- A troca obrigatória vale no próximo login depois da redefinição e segue a política de senha (RN-13 do E2.03: pelo menos 8 caracteres, sem senhas comuns, sequências ou os dados do próprio membro).
- A senha inicial do cadastro (`123456`, D11, ou a digitada) também nasce com a marca. Na publicação do E2.03, as contas com `123456` foram marcadas.

### 6.5 Perfis

| Legado | Novo (role) | Permissões |
|---|---|---|
| `AppSuperAdmin` | **Administrador** (`is_system`) | Todas, incluindo `view_all_church` |
| `AppAdmin` | **Líder** | `view_dashboard`, `view_own_ministry`, `create_member`, `edit_member`, `delete_member`, `create_cell`, `edit_cell`, `delete_cell`, `edit_own_data`, `submit_own_cell_report`, `edit_cell_report` e `delete_cell_report`, sem `view_members` nem `view_roles` (E2.02), e `change_member_password` ("Redefinir Senha de Membros", E2.03). As escritas valem só dentro do escopo (AUT-03). |
| `AppUser` (e sem perfil) | **Membro** (padrão) | `view_dashboard`, `view_own_ministry`, `edit_own_data` e `submit_own_cell_report` (D3) |

- **Pastores** (RN-05 do E2.02): com `view_own_ministry`, o pastor vê a árvore inteira (ele, o cônjuge e a descendência dos dois); `view_all_church` só acrescenta quem está sem liderança. Ser pastor não dá permissão: ela vem da função.
- **Lista para revisão.** Antes do cutover, a liderança confere quem vai ter os perfis Administrador e Líder.

### 6.6 Superusuário do legado

O usuário `AdminUser` vem da configuração e não é membro, então **não migra**. Antes do go-live, designe membros reais com o perfil Administrador; recomenda-se ter pelo menos dois.

### 6.7 Comunicação aos usuários

A mensagem, enviada pela liderança antes do cutover, deve dizer:
- o novo endereço do sistema;
- que o login e a senha são os mesmos de antes, e que agora o CPF também funciona;
- que não há prazo para o primeiro acesso: a senha antiga vale até ser usada uma vez no novo (D6);
- que, em caso de problema, o caminho é falar com o próprio líder (redefinição assistida), que gera uma senha temporária válida por 7 dias;
- que, se a senha antiga for curta ou simples demais, o sistema pede uma nova no primeiro acesso, com as regras da política de senha em linguagem simples (RN-13 do E2.03).

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
