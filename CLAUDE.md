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
- Textos de UI em pt-BR. Identificadores de código em inglês; colunas em `snake_case`.

## Estrutura

| Caminho | O quê | Branch |
|---|---|---|
| `mci-connect/` | **Novo** (submódulo), criado no Lovable. Vite + React 18 + TypeScript + shadcn/ui + Tailwind + TanStack Query + react-hook-form/zod. Backend: Supabase (Postgres, Auth, RLS, Edge Functions em Deno). Deploy na Vercel (rewrite de SPA). | `main` |
| `g12app-net/` | **Legado, em produção** (submódulo). .NET 8, ASP.NET Core API + EF Core com **MySQL** em produção (provider configurado para a versão 5.7). Front em CRA (React 18 + react-bootstrap) em `G12App.API/ClientApp`, servido pela própria API via SpaProxy. | `master` |

- Submódulos: faça o commit dentro do submódulo (no repositório dele) e depois atualize o ponteiro na raiz (`git add mci-connect && git commit`). Para clonar: `git clone --recurse-submodules`, ou `git submodule update --init` depois de um clone normal.
- O `mci-connect` é sincronizado com o Lovable, e os commits feitos lá chegam na `main` (ex.: "Preceding changes"). Não reescreva o histórico da `main`.

## Comandos

### Novo (`mci-connect/`)
```bash
npm install        # também há bun.lock(b); os scripts usam npm
npm run dev        # Vite em http://localhost:8080
npm run build
npm run lint
npm test           # Vitest; hoje só existe src/test/example.test.ts
```
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
- `roles` e `role_permissions`, com permissões do enum `permission_action`:
  - Permissões: `view_dashboard`, `view_members`, `create_member`, `edit_member`, `delete_member`, `create_cell`, `edit_cell`, `delete_cell`, `manage_roles`, `view_roles`, `view_all_church`, `view_own_ministry`, `edit_own_data`.
  - Roles semeadas: Administrador (`is_system`), Líder e Membro.

### Lógica no banco
- `compute_g12_level` (BEFORE INSERT ou UPDATE de `leader_id` / `is_pastor`): pastor → 0; com líder → nível do líder + 1; sem líder → 0. **Não propaga** para os descendentes.
- `sync_spouse_trigger`: mantém o vínculo de cônjuge simétrico.
- `refresh_member_stats_v2` (triggers em `members` e `cells`): recalcula toda a cadeia de ancestrais.
  - `total_disciples`: descendentes ativos.
  - `male_cells` / `female_cells`: células ativas lideradas na subárvore, separadas pelo gênero do líder.
  - `total_cells = male_cells + female_cells`.
- Funções usadas no RLS:
  - `user_has_permission(uid, perm)`.
  - `is_admin`: quem tem `manage_roles`.
  - `get_ministry_root`: o ancestral com `g12_level = 1`.
  - `is_in_same_ministry`.
  - `can_manage_own_cell`: é líder ou timóteo da célula.
- O que cada permissão libera:
  - `view_members` e `view_all_church`: veem a igreja inteira.
  - `view_own_ministry`: vê só o próprio ministério (mesmo G12).
  - `edit_own_data`: edita o próprio cadastro e as células/relatórios em que é líder ou timóteo.
- No front, `hasPermission` retorna `true` para tudo quando a role é `is_system`. O RLS **não** tem esse atalho.

### Edge Functions
- `create-user-admin`: cria o usuário no Auth (com service role) e a linha em `members`. É usada no cadastro de membro.
- `get-user-email`: converte CPF ou celular no e-mail correspondente, para o login.

### Front
- Rotas: `/login`, `/` (Dashboard), `/members`, `/cells`, `/cell-reports`, `/ministries` e `/roles`. O menu é filtrado por permissão (`AppSidebar.tsx`). Cadastro e edição acontecem em diálogos (`MemberForm`, `CellForm`, `CellReportForm`).
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
  - O `types.ts` ainda tem `cells.name`, que foi removida em `20260326040000`.
  - Faltam `instagram`, `avatar_url`, `male_cells` e `female_cells` no `types.ts`; o código contorna com `as any` ou tipos estendidos.
  - Antes de escrever uma migration, **confira o schema real no Supabase** e regenere os tipos.
- Algumas migrations têm nome em UUID (geradas pelo Lovable) e outras têm nome legível (manuais). Nunca edite uma migration já aplicada; crie uma nova.
- O PostgREST devolve no máximo 1000 linhas por padrão. Listagens e contagens feitas no cliente (Members, Cells, "sem vínculo" do dashboard) **cortam os dados sem avisar** acima disso. Prefira `count`, paginação, views ou RPC.
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
| Papéis e escopo por ministério | roles/permissões configuráveis + `view_own_ministry` | 🟡 o escopo não inclui o cônjuge nem o cônjuge do G12; as roles semeadas não usam escopo |
| CRUD de membros | sim | 🟡 sem soft delete e sem auditoria (`created_by`) |
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
| Regras do relatório: semana atual, sem data futura, um por semana, depois do horário da célula, justificativa quando não houve | nenhuma | ❌ |
| Líder, timóteo e anfitrião como participantes automáticos | não existe | ❌ |
| Snapshot de líder, anfitrião, timóteo e tipo no relatório | não existe | ❌ |
| Relatórios por período e atalhos para a semana atual, passada e retrasada | só busca por texto | ❌ |
| Exportação dos relatórios para Excel | não existe | ❌ |
| Dashboard semanal com cards clicáveis (novos membros e células da semana, visitantes, pendentes) | parcial, sem drill-down | 🟡 |
| Árvore de ministérios (casais) | sim | ✅ |
| Changelog (`/last-changes`) | não existe | baixa prioridade |

Ao fechar um item, atualize esta tabela.

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

A origem é o **MySQL de produção** do legado, com as tabelas `Members`, `Addresses`, `Cells`, `Reports` e `ReportMembers`. Pontos de atenção:
- **IDs**: o legado usa `int` e o novo usa `uuid`. Guarde o id antigo (ex.: coluna `legacy_id`) para remontar as FKs e conferir a carga.
- **Soft delete**: registros com `IsDeleted = 1` não podem entrar como ativos. Decida se serão descartados ou importados como inativos.
- **Ordem de carga**:
  1. Membros, ainda sem `leader_id` e `spouse_id`.
  2. Um segundo passe preenchendo `leader_id` e `spouse_id`.
  3. Células.
  4. Relatórios.
  5. Participantes.
- **Triggers**: os de stats, cônjuge e `g12_level` disparam a cada linha. Desligue-os durante a carga (`session_replication_role = replica`) e rode um backfill no final.
- **Senhas**: o legado guarda MD5 sem salt, que não dá para importar direto no Supabase Auth. Planeje um reset de senha ou um fluxo de primeiro acesso. Todo membro precisa de e-mail no Auth; para quem não tem, use o padrão `@mci12fakemail.com`.

| Legado | Novo |
|---|---|
| `Member.Name`, `BirthDate`, `Email`, `CPF`, `Notes` | `name`, `birth_date`, `email`, `cpf`, `notes` |
| `MobileNumber` / `PhoneNumber` | `mobile_whatsapp` / `phone` (só dígitos) |
| `Gender` (0 = Male, 1 = Female) | `gender` 'M'/'F' |
| `HomeAddress` (tabela `Addresses`) | colunas inline; `Address.Notes` → `complement`; `PostalCode` → `zip_code` (só dígitos) |
| `LeadershipId` / `SpouseId` | `leader_id` / `spouse_id` |
| `HasNoLeadership` | `has_leadership = NOT HasNoLeadership` (conferir junto com `leader_id`) |
| Pastores (`MinistryLevel = 1`: sem líder e sem `HasNoLeadership`) | `is_pastor = true` |
| `Baptized` / `BaptismDate` | `is_baptized` / `baptism_date` |
| `Idle` | `is_active = NOT Idle` |
| `Role` (AppUser / AppAdmin / AppSuperAdmin) | `role_id`; definir roles equivalentes (sugestão: Membro / Líder com escopo de ministério / Administrador) |
| `Password` (MD5) | ver "Senhas" acima |
| `Computed*`, `LeadershipTree`, `Total*` | recalculados pelos triggers ou pelo backfill |
| `Cell.LeadId`, `HostId`, `TimothyId` | `leader_id`, `host_id`, `timothy_id` |
| `Cell.WeekDay` (0 = domingo … 6 = sábado) | `meeting_day`: 'Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado' |
| `Cell.Time` ('HH:mm') | `meeting_time` |
| `Cell.CellType` (Evangelistic / Discipleship / Macrocell) | `type`: 'Evangelística' / 'Discipulado' / 'Macrocélula' |
| `Cell.Place` | endereço inline |
| `Report.Date` (datetime) | `date` + `time` |
| `Report.Subject` | `theme` |
| `Report.WeekCellSkipped` | `was_held = NOT WeekCellSkipped`; `Notes` vai para `reason_not_held` quando não houve célula e para `observations` nos outros casos |
| `Report.Visitors` (nomes separados por barra vertical) | `visitors` (lista) |
| `Report.Contribution` | `offering` |
| `ReportMembers` | `cell_report_participants` |
| `Report.LeadershipId`, `HostId`, `TimothyId`, `CellType`, `NumMembers`, `NumVisitors` | não têm coluna equivalente; crie antes de migrar se o histórico importar |

Perguntas em aberto:
- Os registros com soft delete serão migrados?
- Como os papéis antigos viram roles no novo?
- Qual vai ser a estratégia de senha?

## Problemas conhecidos

Problemas do `mci-connect`. Corrija quando estiver mexendo no código em volta.

- `create-user-admin` roda com `verify_jwt = false` e service role, e **não verifica quem está chamando**. Qualquer pessoa com a URL consegue criar usuários com qualquer `role_id`, inclusive Administrador. Exija JWT e cheque `create_member` (e quem pode atribuir cada role).
- A policy de UPDATE em `members` para `edit_own_data` não restringe colunas: o usuário consegue alterar o próprio `role_id` ou `leader_id`, o que é escalada de privilégio. Restrinja via trigger ou RPC.
- `get-user-email` devolve o e-mail de qualquer CPF ou celular para quem chamar (enumeração de dados pessoais).
- Senha padrão `123456`.
- O bug do `WEEK_DAYS_MAP` no Dashboard (descrito acima).
- A busca de `Members` coloca o texto digitado direto no `.or(...)` do PostgREST, então vírgulas e parênteses quebram o filtro.
