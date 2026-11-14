# CLAUDE.md — apps-mci

Repositório guarda-chuva com as duas versões do sistema de gestão da igreja MCI (visão G12): cadastro de membros, hierarquia de discipulado (ministérios), células (reuniões caseiras semanais), relatórios de célula (controle da expansão da igreja) e, no futuro, consolidação e escolas.

## Objetivo atual (em ordem)

1. **Paridade**: replicar no `mci-connect` todas as features e regras do legado `g12app-net` (ver [Matriz de paridade](#matriz-de-paridade)).
2. **Migração de dados** do banco do legado para o Supabase (ver [Migração de dados](#migração-de-dados-legado--supabase)).
3. **Descomissionar** o legado.
4. Depois disso: features novas (Consolidação, Escolas).

Regras de trabalho:
- O legado é a **referência de comportamento e é somente leitura**. Não evolua o legado; mexa nele só se for necessário para a migração ou para resolver um incidente.
- Ao portar uma regra, replique a **intenção** descrita aqui, não os detalhes de implementação do legado.
- No novo, o front acessa o Supabase direto. **Toda regra que o legado impunha na API precisa ser imposta no banco** (RLS, constraints, triggers ou funções RPC `SECURITY DEFINER`), porque validação só na UI pode ser contornada.
- Toda entidade de negócio usa **exclusão lógica** (`deleted_at`, `deleted_by`). A API não faz exclusão física, e registros excluídos não aparecem em nenhuma tela, contagem ou total. Ver as regras `DEL-` em `docs/migracao.md`.
- Textos de UI em pt-BR. Identificadores de código em inglês; colunas em `snake_case`.

## Estrutura

| Caminho | O quê | Branch |
|---|---|---|
| `mci-connect/` | **Novo** (submódulo), criado originalmente no Lovable. Vite + React 18 + TypeScript + shadcn/ui + Tailwind + TanStack Query + react-hook-form/zod. Backend: Supabase (Postgres, Auth, RLS, Edge Functions em Deno). Deploy na Vercel (rewrite de SPA). | `main` |
| `g12app-net/` | **Legado, em produção** (submódulo). .NET 8, ASP.NET Core API + EF Core. Em produção usa **MySQL 8.4**, num banco gerenciado (DigitalOcean); o provider do EF está configurado para a versão 5.7. Front em CRA (React 18 + react-bootstrap) em `G12App.API/ClientApp`, servido pela própria API via SpaProxy. | `master` |

- **Configs e segredos locais** ficam em `local.config`, na raiz, que é ignorado pelo git (ver `.gitignore`). Leia de lá quando precisar de credenciais (ex.: MySQL, chave secreta do Supabase), mas nunca copie esses valores para arquivos versionados, specs, logs ou respostas.
  - A única exceção é a chave pública (`SUPABASE_PUBLISHABLE_KEY`, `sb_publishable_…`): ela é pública por natureza e fica no `.env` do `mci-connect`.
  - Ao rodar a Supabase CLI, **não exporte** as variáveis do `local.config` para o ambiente. A CLI lê qualquer `SUPABASE_*` como configuração dela, e o `SUPABASE_DB`, por exemplo, quebra a seção `[db]`. Monte a URL do banco num subshell e passe por `--db-url`.
- Submódulos: faça o commit dentro do submódulo (no repositório dele) e depois atualize o ponteiro na raiz (`git add mci-connect && git commit`). Para clonar: `git clone --recurse-submodules`, ou `git submodule update --init` depois de um clone normal.
- **O Lovable foi abandonado em 2026-11-14.** O desenvolvimento do `mci-connect` segue com o Claude Code. A antiga branch `ai`, onde o Lovable trabalhava, foi incorporada à `main` (PR #4) e não é mais usada.
- **Banco do novo:** projeto Supabase **`gkhnjhmgeceoaqeynhrj`**, criado para receber o sistema e a migração. As credenciais estão no `local.config`.
  - O `clfgjnwtzasdsrgcxmmd` é o banco do Lovable, que está sendo abandonado. Não use, e não é preciso nada dele.
  - Ele ainda aparece no `.env` e no `supabase/config.toml` do `mci-connect` até o passo E1.14.
- **Git:** nunca faça commit direto na `main` (raiz e `mci-connect`) nem na `master` (legado), e não reescreva o histórico delas. Cada passo vai numa branch própria, com PR. O merge é sempre do usuário.

## Comandos

### Novo (`mci-connect/`)
```bash
npm install        # também há bun.lock(b); os scripts usam npm
npm run dev        # Vite em http://localhost:8080
npm run build
npm run lint
npm test           # Vitest; hoje só existe src/test/example.test.ts
```
- **Acesso ao banco:** as credenciais ficam no `local.config` (`SUPABASE_PROJECT_REF`, `SUPABASE_HOST`, `SUPABASE_PORT`, `SUPABASE_DB`, `SUPABASE_USER`, `SUPABASE_PASS`). Use o **Session pooler** (`aws-…pooler.supabase.com`, usuário `postgres.<ref>`): a conexão direta `db.<ref>.supabase.co` só tem IPv6 e não funciona nesta máquina. Antes de qualquer comando, confira que o `SUPABASE_PROJECT_REF` é o `gkhnjhmgeceoaqeynhrj`.
- O project ref do Supabase fica em `supabase/config.toml`. O front lê do `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_PROJECT_ID`.
- Depois de mudar o schema, regenere os tipos: `npx supabase gen types typescript --project-id <ref> > src/integrations/supabase/types.ts`.
- As Edge Functions ficam em `supabase/functions/*` (Deno).

### Legado (`g12app-net/`)
```bash
dotnet build G12App.sln
dotnet test                       # testes de Domain, Application, Infrastructure e API
dotnet run --project G12App.API   # API em https://localhost:7231 ou http://localhost:5208; sobe o CRA via SpaProxy em https://localhost:44436
docker compose up mysql           # MySQL 5.7 local (perfis opcionais: mssql, postgres)
```
O comando das migrations EF está em `migration-command.txt`. A configuração sensível fica em `appsettings*.json` (`ConnectionStrings:*`, `JWTSettings:SecretKey`, `AdminUser`). Não copie esses valores para lugar nenhum.

## Time de agentes (`.claude/agents/`)

O Claude Code encontra os agentes subindo a partir do diretório atual, então abrir dentro de um submódulo também funciona. Mesmo assim, prefira abrir na **raiz** (`apps-mci/`), porque os agentes trabalham nos dois projetos.

| Agente | Papel |
|---|---|
| `product-owner` | Negócio e Visão G12: requisitos, regras (RN) com critérios de aceite, paridade com o legado, terminologia |
| `architect` | Revisa as RNs, desenha a solução, quebra em tarefas e faz a revisão final (padrões, escala, segurança, race conditions) |
| `backend-developer` | Migrations, RLS, RPC, triggers, Edge Functions e scripts de migração de dados MySQL → Supabase |
| `frontend-developer` | Telas, formulários, listagens e integração do `mci-connect` com o Supabase |
| `code-reviewer` | Revisão rápida do diff, devolvendo os achados ao desenvolvedor responsável |
| `qa` | Testes unitários (Vitest), de banco (pgTAP) e de comportamento (Playwright) amarrados às RNs |

**Quem aciona quem.** Um subagente pode acionar outros, até 3 níveis abaixo da sessão principal. Esse é o padrão do Claude Code, controlado pela variável `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`. Não a defina como `1`, senão o fluxo abaixo para de funcionar.

| Agente | Pode acionar |
|---|---|
| Sessão principal | `product-owner` e `architect` (e qualquer agente, para tarefas avulsas) |
| `architect` | `backend-developer`, `frontend-developer` e `qa` |
| `backend-developer`, `frontend-developer` | só o `code-reviewer` |
| `product-owner`, `code-reviewer`, `qa` | ninguém; devolvem o resultado para quem chamou |

Para `product-owner`, `code-reviewer` e `qa`, a restrição está na configuração: eles não têm a ferramenta `Agent`. Para os desenvolvedores, ela está nas instruções.

**Fluxo de uma feature.**

1. Sessão principal → `product-owner`: cria ou atualiza `docs/specs/<slug>.md` (modelo em `docs/specs/_template.md`), seção Negócio. As perguntas em aberto vão para o usuário; RN "a confirmar" não segue adiante.
2. Sessão principal → `architect`: revisa as RNs. Se houver dúvida de negócio, devolve para a sessão principal, que leva ao PO ou ao usuário. Se não houver, escreve "Solução técnica" e "Tarefas" e coordena a implementação:
   1. Aciona o `backend-developer` (primeiro, se houver schema ou RPC) e o `frontend-developer`. Tarefas independentes rodam em paralelo.
   2. Cada desenvolvedor, ao terminar, aciona o `code-reviewer`, corrige os próprios achados e repete até o veredito APROVADO (no máximo 3 rodadas). Achados de outro papel voltam no relatório dele.
   3. Aciona o `qa`. Bugs encontrados voltam ao desenvolvedor responsável, para uma nova rodada.
   4. Faz a revisão final e devolve um relatório consolidado.
3. Sessão principal → `product-owner`: dá o aceite e atualiza três coisas:
   - a matriz de paridade deste arquivo;
   - o status das regras na seção 3 de `docs/migracao.md`;
   - o passo correspondente (`E2.xx`) na seção Progresso do mesmo documento.

Para uma mudança pequena (bug pontual, texto, estilo): sessão principal → desenvolvedor (que aciona o `code-reviewer`) → `qa`.

Cada agente começa sem o histórico da conversa e só sabe o que quem o chamou passou no prompt. Por isso:
- passe sempre o caminho do spec e os números das tarefas;
- os specs em `docs/specs/` funcionam como a memória compartilhada entre os agentes;
- a sessão principal só vê o relatório final de cada agente que ela acionou, então esse relatório precisa trazer arquivos alterados, achados pendentes e resultados de testes.

## Glossário do domínio

- **Membro / Pessoa**: qualquer pessoa cadastrada. Tem no máximo um **líder** (`LeadershipId` / `leader_id`) e um **cônjuge**.
- **Discípulo**: membro liderado por alguém. As relações líder → discípulo formam a **árvore G12**.
- **Pastores**: topo da árvore (sem líder). **G12**: os discípulos diretos dos pastores. O **ministério** de alguém é a subárvore do seu G12.
- **Nível ministerial**: profundidade na árvore.
  - Legado: `MinistryLevel = 12^profundidade` (1 = Pastores, 12 = G12, depois 144, 1728, 20736). `9999999` significa "sem liderança".
  - Novo: `g12_level = profundidade` (0 = pastor, 1 = G12, 2 = 144…).
  - Conversão: `MinistryLevel = 12^g12_level`.
- **Casal**: o sistema exibe casais como uma unidade (árvore de Ministérios, contagens do dashboard). Na prática o discipulado é por gênero, então marido e esposa costumam estar em subárvores diferentes. Por isso o legado inclui o cônjuge no escopo de visibilidade.
- **Célula**: reunião caseira semanal, com dia e horário fixos.
  - Papéis: **Líder**, **Timóteo** (auxiliar / líder em formação) e **Anfitrião** (dono da casa).
  - Tipos: **Evangelística**, **Discipuladora** (no novo, "Discipulado") e **Macrocélula**.
- **Relatório de célula**: registro semanal de cada célula, com tema, data e hora, participantes (membros), visitantes (nomes livres), oferta e observações, ou então "não houve célula" com justificativa. É a base do controle de expansão.
- **Vínculo celular**: se o membro é líder, timóteo ou anfitrião de alguma célula, ou se participou de um relatório recente.
- **Consolidação**: feature futura (ver [Features futuras](#features-futuras-não-existem-em-nenhum-dos-dois)). ⚠️ No código do legado, "consolidation" (`MemberDataConsolidationRequested`, `ChildrenMembersComputed`, `/api/operation/member-consolidation`) quer dizer **recalcular campos computados** e não tem relação com o ministério de consolidação.

## Legado (`g12app-net`): funcionalidades e regras

Camadas:
- `G12App.Domain`: modelos, DTOs, validadores FluentValidation, filtros e escopo em `Extensions/QueryingExtensions.cs`.
- `G12App.Application`: serviços e handlers de eventos.
- `G12App.Infrastructure.Data`: EF Core e repositórios.
- `G12App.Infrastructure.Events`: fila em memória (`Channel`) + `EventWorker`.
- `G12App.API`: controllers + `ClientApp`.

### Autenticação e papéis
- Login por **e-mail ou celular** e senha (`AuthService.cs`). A senha é **MD5 sem salt, calculado no browser**, e é comparada com `Member.Password`.
- O JWT é HS256, vale 1 dia e leva as claims `MemberId`, `LeadershipId`, `SpouseId`, `G12LeadershipId`, `G12LeadershipSpouseId`, `MinistryLevel` e `Role`.
- Existe um superusuário fixo, configurado em `AdminUser` (Id `-1`, papel `AppSuperAdmin`).
- Papéis (`Member.Role`):
  - `AppUser` (padrão): vê os dados do seu escopo, edita só o próprio cadastro (sem mexer em liderança, batismo ou "inativo") e registra relatórios. Menu: Pessoas, Células e Registrar relatório.
  - `AppAdmin`: tudo do `AppUser`, mais criar e excluir membros; criar, editar e excluir células; editar e excluir relatórios.
  - `AppSuperAdmin`: tudo, **sem filtro de escopo**. É o único que altera `Role` e o único que pode salvar um membro sem liderança definida.
  - A senha só pode ser trocada pelo próprio membro ou por Admin/SuperAdmin. A UI não deixa ninguém alterar o próprio papel.
- **Escopo de visibilidade** (o "ministry filter"): vale para toda consulta de membros, células e relatórios, exceto para o SuperAdmin.
  - Membros: o usuário vê as subárvores de **si mesmo, do cônjuge, do seu G12 e do cônjuge do seu G12**, além dessas próprias pessoas.
  - Células e relatórios: entram no escopo se o líder, o timóteo ou o anfitrião estiver no escopo.
  - A implementação usa `LeadershipIdTree LIKE '%|id|%'`.

### Membros
- Campos: nome, nascimento, celular/WhatsApp, telefone, e-mail, CPF, gênero (M/F), endereço (tabela `Address`), líder, cônjuge, observações, batizado + data do batismo, "não tem liderança" (`HasNoLeadership`), inativo (`Idle`), senha e papel.
- Validações (na API, em `MemberDtoValidator`, e na UI, em `pages/Members/details.js`):
  - Nome obrigatório. A UI exige nome **e** sobrenome; a API exige no mínimo 2 caracteres.
  - **E-mail ou celular é obrigatório**, porque é o login. Os dois são **únicos** entre os membros (e-mail sem diferenciar maiúsculas).
  - CPF é opcional, mas se for informado precisa ser válido (dígitos verificadores).
  - Senha obrigatória na criação, com confirmação.
  - Líder obrigatório, a não ser que "não tem liderança" esteja marcado. O SuperAdmin pode deixar os dois em branco.
  - Data de nascimento maior que hoje − 100 anos.
  - Ciclos são proibidos: "Membro não pode ser discípulo de um discípulo." A cadeia é verificada até cerca de 6 níveis.
- O vínculo de cônjuge é **simétrico**: ao definir, trocar ou remover, o outro lado é atualizado (`MemberService.UpdateSpouse`).
- A exclusão é **soft delete** (`IsDeleted`), e o mesmo vale para células e relatórios.
- Auditoria: `CreatedBy`, `CreationDate`, `LastModifiedBy` e `LastModifiedDate` (nome do usuário e horário de Brasília).
- Filtros da listagem: nome, liderança (busca na árvore de nomes), bairro, cidade, situação (ativo/inativo), possui liderança, batizado, nível ministerial, vínculo celular e data de cadastro (de/até).
- **Vínculo celular** (`CellLink`):
  - `Leader`, `Timothy`, `Host`: tem célula nesse papel.
  - `Attendee`: participou de algum relatório nos últimos 30 dias.
  - `None`: nenhum dos anteriores e `TotalCells` igual a 0.

### Campos computados da hierarquia (`MemberService.UpdateComputedValues`)
São recalculados quando o membro é salvo e propagados por eventos (`MemberChangedHandler`, `CellChangedHandler`), então a consistência é eventual.
- `LeadershipTree`: nomes da cadeia ("Pastor / G12 / … / líder direto").
- `LeadershipIdTree`: ids da cadeia (`|1|5|9|`).
- `ComputedLeadershipName`: o líder direto.
- `ComputedG12Leader`, `ComputedG12LeaderId`, `ComputedG12LeaderSpouseId`: o 2º nível da cadeia.
- `MinistryLevel`: 12^n.
- `TotalDisciples`: total de descendentes, em todos os níveis.
- `TotalCells`: células lideradas por qualquer pessoa da subárvore, incluindo a própria pessoa.
- Os totais são atualizados para até 5 ancestrais. Mudar o nome ou o líder de alguém recalcula a subárvore inteira.

### Células
- Campos: líder, timóteo e anfitrião (os três obrigatórios), dia da semana, horário (`HH:mm`), endereço (`Place`), tipo e `ReportMandatory` (existe no modelo, mas não é usado).
- O CRUD é só para Admin/SuperAdmin.
- Filtros: líder, G12, logradouro, bairro, cidade, tipo, dia da semana, situação do relatório e data de cadastro.
- **Situação do relatório** (`CellReportStatus`, em `QueryingExtensions.cs`). A semana vai de domingo a sábado, no horário de Brasília:
  - `Current`: já tem relatório nesta semana, ou a reunião ainda não aconteceu.
  - `NotDoneYet`: não tem relatório e a reunião desta semana ainda não aconteceu.
  - `OverDueThisWeek`: não tem relatório e o horário da reunião (mais ~1h de tolerância) já passou. É o card "Células com relatórios pendentes".
  - `OverDue1Week` a `OverDue4Week`: o último relatório é de 1, 2, 3 ou 4+ semanas atrás.
  - `Cancelled*` existe no enum, mas não foi implementado.

### Relatórios de célula (`ReportApp.LogReport`, `ReportService.Add`)
- Qualquer usuário autenticado registra relatório de uma célula **visível no seu escopo**. Editar e excluir é só para Admin/SuperAdmin.
- Regras de lançamento:
  1. A data **não pode ser futura**.
  2. A data precisa estar **na semana atual** (domingo 00:00 a sábado 23:59:59, horário de Brasília).
  3. **Um relatório por célula por semana**. Mensagem: "O relatório para esta semana já foi enviado (#id)".
  4. O dia da semana da data não pode ser anterior ao dia da célula. No mesmo dia, o horário não pode ser anterior ao horário da célula.
  5. Com "Não houve célula" (`WeekCellSkipped`): tema e data deixam de ser obrigatórios, a **justificativa (observações) passa a ser obrigatória** (na UI) e a data gravada é o dia e horário previstos da célula na semana.
  6. Sem "Não houve célula": data, horário e tema são obrigatórios.
- Participantes:
  - São os membros selecionados, **mais líder, timóteo e anfitrião, incluídos automaticamente**, sem duplicatas.
  - `NumMembers` é o total de participantes; `NumVisitors` é o número de visitantes com nome preenchido.
  - Os visitantes são gravados numa única string, separados por barra vertical.
- O relatório guarda um **snapshot** de `LeadershipId`, `HostId`, `TimothyId` e `CellType` no momento do lançamento. O histórico não muda quando a célula muda.
- A oferta é em BRL (`decimal`).
- Listagem: filtros por líder, G12 e período; atalhos no menu para a semana atual, a passada e a retrasada. A tela da célula mostra os 3 últimos relatórios.
- **Exportação para Excel** (`/api/export/cell-reports`, `ColumnFormatter.cs`): uma linha por célula no período, ordenada por G12.
  - Colunas: Célula #, G12, Líder, Endereço, Bairro, Situação, Data/Hora, Oferta, Nº de participantes, Nº de visitantes e Observações.
  - Valores de Situação: "Relatório não entregue.", "Não houve célula." ou "Célula realizada.".

### Dashboard (`DashboardService.cs`, `pages/Home`)
Todos os números respeitam o escopo do usuário, e cada card abre a listagem já filtrada.
- **Esta semana**: relatórios enviados, células com relatório pendente (`OverDueThisWeek`), visitantes (soma de `NumVisitors`), novos membros e novas células.
- **Geral**: membros ativos, células evangelísticas, células discipuladoras, inativos, não batizados, sem liderança e sem vínculo celular.
- Gráfico da semana: células realizadas × canceladas × sem relatório.

### Ministérios (`MinistryService`, `pages/Ministries`)
- Árvore de **casais** (marido e esposa ordenados por gênero), carregada sob demanda, com o total de discípulos e de células em cada nó.
- A raiz é o menor nível visível no escopo do usuário.
- A rota `/ministries` existe, mas o link está comentado no menu.

### Outros
- `/last-changes`: lista os commits do GitHub como um changelog público.
- Fuso fixo UTC−3 (`SystemConstants.BrazilTime`) e cultura pt-BR.
- `OperationController`: recalcula os campos computados de todos os membros e permite inspecionar a fila de eventos.

## Novo (`mci-connect`): estado atual

### Schema efetivo (Supabase, schema `public`)
- `members` (chave UUID):
  - Dados pessoais: `name`, `email`, `cpf`, `gender` ('M'/'F'), `birth_date`, `mobile_whatsapp`, `phone`, `instagram`, `avatar_url`, `notes`.
  - Endereço inline: `street`, `number`, `complement`, `neighborhood`, `city`, `state`, `zip_code`.
  - Ministério: `is_pastor`, `has_leadership`, `leader_id`, `spouse_id`, `is_baptized`, `baptism_date`, `is_active`, `g12_level`.
  - Acesso: `auth_user_id` (→ `auth.users`), `role_id`.
  - Estatísticas: `total_disciples`, `total_cells`, `male_cells`, `female_cells`.
- `cells`:
  - `leader_id`, `timothy_id`, `host_id`.
  - `type`, em texto pt-BR: 'Evangelística', 'Discipulado' ou 'Macrocélula'.
  - `meeting_day`, em texto pt-BR: 'Domingo', 'Segunda', …, 'Sábado'.
  - `meeting_time`, endereço inline e `is_active`.
- `cell_reports`: `cell_id`, `date`, `time`, `was_held`, `reason_not_held`, `theme`, `observations`, `visitors` (lista de nomes) e `offering`.
- `cell_report_participants`: `report_id`, `member_id`.
- `roles` (`is_system`; `is_default`, com no máximo uma role padrão) e `role_permissions`, com permissões do enum `permission_action` (24 valores):
  - Originais: `view_dashboard`, `view_members`, `create_member`, `edit_member`, `delete_member`, `create_cell`, `edit_cell`, `delete_cell`, `manage_roles`, `view_roles`, `view_all_church`, `view_own_ministry`, `edit_own_data`.
  - Vindas do merge da `ai`: `view_own_reports`, `view_all_reports`, `submit_own_cell_report`, `submit_any_visible_report`, `assign_role`, `view_sensitive_data`, `change_member_password`, `view_own_ministry_dashboard`, `edit_cell_report`, `delete_cell_report`, `view_audit_log`.
  - Roles semeadas: Administrador (`is_system`), Líder e Membro. Das permissões novas, as migrations só concedem `view_audit_log`, e só a quem tem `manage_roles`. As demais dependem de configuração na tela de Funções.
- `events` (auditoria): `occurred_at`, `actor_user_id`, `actor_label`, `action`, `entity`, `entity_id`, `entity_label`, `description`, `changed_fields`, `metadata`, `success`, `error_reason`. Tem só política de SELECT (`view_audit_log`).
- Confirmar no banco real (E1.01): `male_cells` e `female_cells` existem? `cells.name` foi removida? Qual definição de `cell_reports` / `cell_report_participants` valeu?

### Lógica no banco
- `compute_g12_level` (BEFORE INSERT ou UPDATE de `leader_id` / `is_pastor`): pastor → 0; com líder → nível do líder + 1; sem líder → 0. **Não propaga** para os descendentes.
- Cônjuge: **dois triggers** mantêm o vínculo simétrico, `sync_spouse_trigger` (antigo) e `sync_spouse_relationship` (novo, que também proíbe casar consigo). Eles usam proteções diferentes contra recursão e precisam ser consolidados.
- Relatórios:
  - `enforce_unique_weekly_cell_report` (BEFORE INSERT/UPDATE de `cell_id`, `date`): um relatório por célula por semana, de domingo a sábado. Consulta antes de gravar, então há risco de race condition.
  - `enforce_cell_report_current_week` (BEFORE INSERT/UPDATE de `date`): só a semana atual, em `America/Sao_Paulo`. Também dispara na edição.
- Auditoria:
  - Triggers AFTER em `members`, `cells`, `cell_reports` e participantes chamam `_log_event` (`SECURITY DEFINER`). Os erros são engolidos com WARNING.
  - `log_auth_event` pode ser chamada por `anon` e `authenticated`: o próprio front registra login, falha de login e logout.
- `refresh_member_stats_v2` (triggers em `members` e `cells`): recalcula toda a cadeia de ancestrais.
  - `total_disciples`: descendentes ativos.
  - `male_cells` / `female_cells`: células ativas lideradas na subárvore, separadas pelo gênero do líder.
  - `total_cells = male_cells + female_cells`.
- Funções usadas no RLS:
  - `user_has_permission(uid, perm)`.
  - `is_admin`: quem tem `manage_roles`.
  - `get_ministry_root`: o ancestral com `g12_level = 1`.
  - `is_in_same_ministry` (v2): o mesmo G12, incluindo o cônjuge do G12 e a subárvore dele.
  - `is_leader_of_visible_member`: a política de SELECT de `members` também mostra os líderes de membros visíveis, com a linha inteira.
  - `can_manage_own_cell`: é líder ou timóteo da célula.
- O que cada permissão libera:
  - `view_members` e `view_all_church`: veem a igreja inteira.
  - `view_own_ministry`: vê só o próprio ministério (mesmo G12).
  - `edit_own_data`: edita o próprio cadastro e as células/relatórios em que é líder ou timóteo.
  - Relatórios:
    - inserir: `edit_cell` ou `submit_any_visible_report` (em qualquer célula, sem checar visibilidade), ou `submit_own_cell_report` na própria célula;
    - editar: `edit_cell_report`; excluir: `delete_cell_report`. Ambos sem escopo.
  - `view_sensitive_data` e `view_own_ministry_dashboard`: só a UI respeita. A API devolve todas as colunas.
- No front, `hasPermission` retorna `true` para tudo quando a role é `is_system`. O RLS **não** tem esse atalho.

### Edge Functions
- `create-user-admin`: cria o usuário no Auth (com service role) e a linha em `members`. É usada no cadastro de membro.
- `get-user-email`: converte CPF ou celular no e-mail correspondente, para o login.
- `change-member-password`: valida o JWT e checa `change_member_password` ou `is_admin` antes de usar a Admin API, e registra em `events`. Não checa escopo nem o perfil do alvo.

### Front
- Rotas: `/login`, `/` (Dashboard), `/members`, `/cells`, `/cell-reports`, `/ministries`, `/roles` e `/events` (Auditoria, só com `view_audit_log`). O menu é filtrado por permissão (`AppSidebar.tsx`). Todo usuário logado tem "Editar meus dados". Cadastro e edição acontecem em diálogos (`MemberForm`, `CellForm`, `CellReportForm`).
- `MemberForm`, tudo só na UI:
  - campos sensíveis escondidos sem `view_sensitive_data`;
  - seletor de função só com `assign_role`, com a role padrão pré-selecionada;
  - bloco ministerial só com `edit_member`;
  - botão "Alterar senha".
- `CellReportForm`: limita a data à semana atual pelo relógio do navegador e traduz os erros dos triggers. Relatório e participantes ainda são gravados em chamadas separadas.
- Login por e-mail, CPF ou celular.
- Membro sem e-mail recebe um e-mail fictício `<nome>_<hash>@mci12fakemail.com`, porque o Auth exige e-mail. A UI esconde esses e-mails.
- Se a senha não for informada, a padrão é `123456`.
- O CEP preenche o endereço via ViaCEP. A célula puxa o endereço do anfitrião.
- Dashboard:
  - Membros: total, ativos, batizados, inativos, não batizados e sem líder.
  - Células por tipo.
  - Ranking dos casais G12 por número de células (masculinas e femininas).
  - Sem vínculo celular (janela de 4 semanas).
  - Estatísticas da semana.
- Ministérios: árvore de casais a partir dos pastores (`is_pastor`), expandindo sob demanda.
- As listagens carregam tudo no cliente e filtram por texto, sem paginação.

### Armadilhas do novo
- **As migrations e o `types.ts` divergem.**
  - `cell_reports` e `cell_report_participants` são criadas duas vezes, com definições diferentes:
    - `20260326193800`: `visitors jsonb` e PK composta.
    - `20260327024528`: `text[]` e coluna `id`.
  - O `types.ts` segue a segunda definição.
  - O `types.ts` ainda tem `cells.name`, que foi removida em `20260326040000`, e os triggers de auditoria também usam essa coluna. Se ela não existir no banco, a auditoria de células, relatórios e participantes falha sem avisar.
  - Faltam `male_cells` e `female_cells` no `types.ts`; o código contorna com `as any`.
  - A migration `20260426202511` repete a `20260326050000`, sinal de que o banco do Lovable não rodou as migrations manuais.
  - Antes de escrever uma migration, **confira o schema real no Supabase** e regenere os tipos.
- Algumas migrations têm nome em UUID (geradas pelo Lovable) e outras têm nome legível (manuais). Nunca edite uma migration já aplicada; crie uma nova.
- O PostgREST devolve no máximo 1000 linhas por padrão. Listagens e contagens feitas no cliente **cortam os dados sem avisar** acima disso. Isso acontece em Members, Cells, CellReports, no seletor de células do `CellReportForm` e no Dashboard (ranking G12 e "sem vínculo"). Prefira `count`, paginação, views ou RPC.
- As políticas da `20260326193800` nunca foram removidas. Se essa migration rodou, elas se somam às novas, por exemplo `edit_cell` com `FOR ALL` em participantes. Confira em `pg_policies` (E1.01).
- O trigger de semana atual também barra a carga dos relatórios antigos do legado. Na migração, os triggers são desligados (`session_replication_role = replica`).
- `gender` usa 'M'/'F', mas as funções de stats também aceitam 'Masculino'/'Feminino'. Padronize em 'M'/'F'. Células de líder sem gênero ficam fora de `total_cells`.
- `meeting_day` é salvo como 'Segunda', 'Terça'…, mas o `WEEK_DAYS_MAP` do `Dashboard.tsx` usa 'Segunda-feira'… Com isso, células de segunda a sexta nunca entram em "células sem relatório". É um bug.
- `has_leadership` no novo quer dizer "tem líder", o inverso de `HasNoLeadership` no legado.
- Um membro sem líder que não é pastor fica com `g12_level = 0`, igual a pastor.
- `get_ministry_root` devolve NULL para pastores, então `view_own_ministry` não funciona para eles. Pastores precisam de `view_all_church`.
- A role semeada "Líder" tem `view_members`, que libera a igreja inteira, e não o ministério.

## Matriz de paridade

Legenda: ✅ feito · 🟡 parcial · ❌ falta

| Feature ou regra do legado | No novo | Status |
|---|---|---|
| Login por e-mail ou celular | e-mail, CPF ou celular | ✅ |
| Papéis e escopo por ministério | roles/permissões configuráveis + `view_own_ministry` | 🟡 já inclui o cônjuge do G12. Faltam o cônjuge do próprio usuário, o anfitrião nos relatórios, o escopo nas escritas e os pastores; as roles semeadas não usam escopo |
| CRUD de membros | sim | 🟡 a auditoria (`events`) não registra o autor de cadastros feitos pela Edge Function |
| Troca de senha de outro membro | `change-member-password` | 🟡 não checa escopo nem o perfil do alvo |
| Exclusão lógica de membros, células e relatórios | exclusão física, apagando relatórios e participações em cascata | ❌ |
| Validações de membro: nome e sobrenome, e-mail ou celular obrigatório, e-mail e celular únicos, CPF válido, líder obrigatório, sem ciclos | nenhuma no banco | ❌ |
| Cônjuge simétrico | trigger | ✅ |
| Campos computados: árvore de liderança, G12, líder direto | só `g12_level`; o G12 é calculado no cliente, na tela de Células | 🟡 |
| Recalcular o nível dos descendentes quando o líder muda | não propaga | ❌ |
| Totais de discípulos e de células | trigger | ✅ (conta só ativos) |
| Filtros de membros: liderança, bairro, cidade, situação, possui liderança, batizado, nível, vínculo celular, data de cadastro | só busca por texto | ❌ |
| CRUD de células | sim, com `is_active` a mais | ✅ |
| Filtros de células: G12, endereço, tipo, dia, situação do relatório, data de cadastro | só busca por texto | ❌ |
| Situação do relatório por célula (em dia, pendente, atrasado de 1 a 4+ semanas) | não existe | ❌ |
| Lançamento de relatório | sim | 🟡 |
| Regras do relatório: semana atual, sem data futura, um por semana, depois do horário da célula, justificativa quando não houve | triggers de semana atual e de semana única | 🟡 aceita data futura dentro da semana, ignora o horário da célula, tem race condition e bloqueia a edição de relatórios antigos |
| Líder, timóteo e anfitrião como participantes automáticos | não existe | ❌ |
| Snapshot de líder, anfitrião, timóteo e tipo no relatório | não existe | ❌ |
| Relatórios por período e atalhos para a semana atual, passada e retrasada | só busca por texto | ❌ |
| Exportação dos relatórios para Excel | não existe | ❌ |
| Dashboard semanal com cards clicáveis (novos membros e células da semana, visitantes, pendentes) | parcial, sem drill-down | 🟡 |
| Árvore de ministérios (casais) | sim | ✅ |
| Changelog (`/last-changes`) | não existe | baixa prioridade |

Ao fechar um item, atualize esta tabela. As regras detalhadas de cada item estão na seção 3 de `docs/migracao.md`.

## Features futuras (não existem em nenhum dos dois)

### Consolidação
Quando alguém visita uma reunião **na igreja** (não numa célula), os dados da pessoa são cadastrados como **potencial membro**, e não como membro. A ideia é usar **a mesma tabela `members`**, com uma flag que identifica o consolidado. Ao implementar:
- A flag precisa entrar em **todas** as contagens, listagens, triggers de stats e políticas RLS que já existem (dashboard, ministérios, total de discípulos, sem vínculo celular etc.), senão os números de membros ficam inflados.
- Preveja a conversão de consolidado para membro: só a flag muda e o histórico é preservado.
- Hoje os visitantes de célula são só nomes livres em `cell_reports.visitors`. Avalie se eles devem virar registros consolidados.
- Quem consolida, quais são as etapas e como é o acompanhamento ainda não está definido. Pergunte antes de modelar.

### Escolas
Escolas com **turmas**, **material por turma** e a situação de cada aluno na turma: **aprovado, reprovado ou em progresso**. Os alunos são membros. O modelo ainda não está definido (pré-requisitos entre escolas, frequência, professores…). Pergunte antes de modelar.

## Migração de dados (legado → Supabase)

O plano completo está em **[`docs/migracao.md`](docs/migracao.md)**:
- pré-requisitos no novo;
- regras a replicar, com IDs (`AUT-`, `MEM-`, `HIE-`, `CEL-`, `REL-`, `DSH-`, `MIN-`, `DEL-`);
- decisões (`D1`…`D10`);
- mapeamento campo a campo;
- contas, perfis e senhas;
- roteiro de cutover.

Use esses IDs nos specs e nos testes. Em resumo:
- A origem é o **MySQL de produção** do legado (`Members`, `Addresses`, `Cells`, `Reports`, `ReportMembers`).
- Carga ELT: cópia bruta para o schema `legacy` (fora da API) → SQL de transformação idempotente com `legacy_id` → backfill → validação.
- **Senhas:** o legado guarda MD5 sem salt, que o Supabase Auth não importa. O plano é a migração transparente no primeiro login: uma Edge Function confere o MD5 guardado em `private.legacy_credentials` e grava a senha no Auth.

## Problemas conhecidos

Problemas do `mci-connect`. Corrija quando estiver mexendo no código em volta.

- `create-user-admin` roda com `verify_jwt = false` e service role, e **não verifica quem está chamando**. Qualquer pessoa com a URL consegue criar usuários com qualquer `role_id`, inclusive Administrador. Exija JWT e cheque `create_member` (e quem pode atribuir cada role).
- A policy de UPDATE em `members` para `edit_own_data` não restringe colunas: o usuário consegue alterar o próprio `role_id` ou `leader_id`, o que é escalada de privilégio. Restrinja via trigger ou RPC.
- `get-user-email` devolve o e-mail de qualquer CPF ou celular para quem chamar (enumeração de dados pessoais).
- Senha padrão `123456`.
- O bug do `WEEK_DAYS_MAP` no Dashboard (descrito acima).
- A busca de `Members` coloca o texto digitado direto no `.or(...)` do PostgREST, então vírgulas e parênteses quebram o filtro.
- `change-member-password` não checa escopo nem o perfil do alvo: quem tem a permissão troca a senha de um Administrador.
- A política de SELECT de `members` devolve a linha inteira (CPF, e-mail, telefone, endereço) de qualquer líder de um membro visível, inclusive pastores. Além disso, é cara: roda um laço por linha.
- `_log_event` só tem `REVOKE ... FROM PUBLIC`. Se `anon` ou `authenticated` tiverem grant direto, qualquer um consegue forjar eventos de auditoria; confira com `has_function_privilege`. `log_auth_event` é aberta a `anon`, sem limite de volume.
- `view_sensitive_data` e `view_own_ministry_dashboard` só existem na UI.
- O ranking G12 do Dashboard soma `total_cells` de todos os nós da subárvore, mas esse total já é acumulado. Resultado: dupla contagem.
- A data sugerida no `CellReportForm` (`calculateCellDate`) cai na semana passada quando a célula ainda não se reuniu, e o trigger rejeita essa data.
- Operações que não são atômicas: troca da role padrão (`Roles.tsx`) e regravação dos participantes do relatório.
