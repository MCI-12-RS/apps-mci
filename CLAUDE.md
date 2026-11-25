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
  - **Vercel:** as variáveis `VITE_SUPABASE_*`, `SUPABASE_*`, `NEXT_PUBLIC_SUPABASE_*` e `POSTGRES_*` da Vercel são gerenciadas pela integração Supabase ↔ Vercel e apontam para o `gkhn…`. Não edite à mão. Elas valem só para produção; os previews usam o `.env`. As credenciais da API da Vercel estão no `local.config` (`VERCEL_PROJECT_ID`, `VERCEL_API_KEY`).
  - **Deploy de produção** (Actions do `mci-connect`; nada vai ao ar sozinho):
    1. **"Deploy: banco (Supabase)"** mostra o plano no resumo da execução e aplica as migrations (`supabase db push`). Depois publica as Edge Functions da lista `EDGE_FUNCTIONS` do workflow e apaga do projeto as da lista `EDGE_FUNCTIONS_REMOVED` (hoje a `get-user-email`; função já ausente não é erro). A opção "somente plano" só faz o *dry run*.
       - Antes de tudo, inclusive no "somente plano", ele confere pela Management API que o provedor de e-mail do Auth está desligado (`external_email_enabled = false`, RN-14 do E1.04) e **falha** se não estiver. Num rollback que religue o provedor, o deploy de banco fica barrado até ele ser desligado de novo.
       - A configuração do Auth de produção é feita só pela Management API (`PATCH /v1/projects/{ref}/config/auth`), nunca por `supabase config push`: o `config.toml` vale só para a stack local (DT-13 do E1.04).
    2. **"Deploy: promote (Vercel)"** recusa se o banco tiver migrations pendentes. Se estiver em dia, promove para `connect.mci12rs.com.br` o deploy de produção da Vercel do commit escolhido.
    - O *auto-assign* de domínios está **desligado** na Vercel: o merge na `main` gera o build, mas o domínio só muda pelo promote.
    - Uma Edge Function nova só vai para produção se for adicionada à lista do workflow. Tirar uma função da lista não a apaga: ela precisa ir para `EDGE_FUNCTIONS_REMOVED`. A `change-member-password` está de fora até o E2.03.
    - O plano gratuito do GitHub não permite aprovação manual (revisor obrigatório) nos environments; por isso são dois workflows.
    - O plano Hobby da Vercel não faz deploy de repositório privado de organização. Se o `mci-connect` virar privado, os deploys param.
  - **Visibilidade:** o `mci-connect` é **público**, e o `apps-mci` e o `g12app-net` são privados. Nos PRs e commits do `mci-connect`, descreva o que foi corrigido sem detalhar falhas ainda abertas; esses detalhes ficam aqui, no `apps-mci`.
- **Git:** nunca faça commit direto na `main` (raiz e `mci-connect`) nem na `master` (legado), e não reescreva o histórico delas. Cada passo vai numa branch própria, com PR. O merge é sempre do usuário.

## Comandos

### Novo (`mci-connect/`)
```bash
npm install
npm run dev        # Vite em http://localhost:8080
npm run build
npm run lint
npm test           # Vitest (src/**/*.test.ts)
npm run test:e2e   # Playwright (e2e/)
```
- **Acesso ao banco:** as credenciais ficam no `local.config` (`SUPABASE_PROJECT_REF`, `SUPABASE_HOST`, `SUPABASE_PORT`, `SUPABASE_DB`, `SUPABASE_USER`, `SUPABASE_PASS`). Use o **Session pooler** (`aws-…pooler.supabase.com`, usuário `postgres.<ref>`): a conexão direta `db.<ref>.supabase.co` só tem IPv6 e não funciona nesta máquina. Antes de qualquer comando, confira que o `SUPABASE_PROJECT_REF` é o `gkhnjhmgeceoaqeynhrj`.
- O project ref do Supabase fica em `supabase/config.toml`. O front lê do `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_PROJECT_ID`.
- Depois de mudar o schema, regenere os tipos com a CLI do Homebrew (2.84.2), não com `npx supabase` (3.3.0, outro formato): `supabase gen types typescript --project-id <ref> > src/integrations/supabase/types.ts`, ou `--db-url <banco local> --schema public` antes de a migration ir para produção. Mantenha o bloco `__InternalSupabase`.
- As Edge Functions ficam em `supabase/functions/*` (Deno).

#### Pistas locais (dois PRs em paralelo)
Duas pastas e duas stacks locais independentes, para que um passo de banco rode ao lado de um passo de front sem que um apague o banco do outro.

| Pista | Pasta | Stack (`project_id`) | API / DB | Vite | Ambiente do E2E |
|---|---|---|---|---|---|
| A | `mci-connect/` (o submódulo) | `mci-e104-be` | 57321 / 57322 | 8080 | `.worktrees/env/lane-a.env` |
| B | `.worktrees/mci-connect-b/` (worktree do submódulo) | `mci-b` | 58321 / 58322 | 8180 | `.worktrees/env/lane-b.env` |

- `.worktrees/` fica fora do git (`.git/info/exclude` da raiz). Os arquivos `.env` das pistas têm só chaves locais.
- Na pista B, o `supabase/config.toml` tem `project_id` e portas próprios e está marcado com `git update-index --skip-worktree`, para nunca ir para um commit. Se uma branch mudar esse arquivo, tire a marca, resolva e marque de novo.
- A stack da pista A roda a partir de uma cópia do `supabase/` com `project_id = "mci-e104-be"`. A da pista B roda dentro do próprio worktree: `supabase start -x realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,logflare,vector,supavisor`.
- Para rodar o E2E: `source .worktrees/env/lane-<a|b>.env` e depois `npx playwright test … --workers=1`. A `E2E_PORT` escolhe a porta do Vite (mci-connect#38). Depois de um `db reset`, recrie o administrador do E2E com `.worktrees/env/seed-admin.sh .worktrees/env/lane-<a|b>.env`.
- Na pista B, crie a branch a partir da `origin/main` (`git switch -c <branch> origin/main`). Não faça checkout da `main`, que pode estar em uso na pista A.
- **Conflitos entre pistas:** as duas só se encontram na `main`.
  - Migrations: a que for mergeada depois precisa ter o timestamp maior. Se não tiver, renomeie antes do merge; isso só vale para migration que ainda não foi aplicada em produção.
  - `types.ts`: rebase na `main` e regere os tipos antes do merge.
  - Nunca rode dois passos que mexem nas mesmas views, funções ou telas ao mesmo tempo. Por exemplo, os passos que recriam a `cells_view` não rodam em paralelo.

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
| `ux-designer` | Experiência mobile-first: fluxos, wireframes responsivos, estados, textos e acessibilidade (seção Experiência (UX) do spec, critérios `UX-`) e revisão da UI implementada |
| `architect` | Revisa as RNs, desenha a solução, quebra em tarefas e faz a revisão final (padrões, escala, segurança, race conditions) |
| `backend-developer` | Migrations, RLS, RPC, triggers, Edge Functions e scripts de migração de dados MySQL → Supabase |
| `frontend-developer` | Telas, formulários, listagens e integração do `mci-connect` com o Supabase |
| `code-reviewer` | Revisão rápida do diff, devolvendo os achados ao desenvolvedor responsável |
| `qa` | Testes unitários (Vitest), de banco (pgTAP) e de comportamento (Playwright) amarrados às RNs |

**Quem aciona quem.** Um subagente pode acionar outros, até 3 níveis abaixo da sessão principal. Esse é o padrão do Claude Code, controlado pela variável `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`. Não a defina como `1`, senão o fluxo abaixo para de funcionar.

| Agente | Pode acionar |
|---|---|
| Sessão principal | `product-owner`, `ux-designer` e `architect` (e qualquer agente, para tarefas avulsas) |
| `architect` | `backend-developer`, `frontend-developer`, `qa` e `ux-designer` (revisão da UI) |
| `backend-developer`, `frontend-developer` | só o `code-reviewer` |
| `product-owner`, `ux-designer`, `code-reviewer`, `qa` | ninguém; devolvem o resultado para quem chamou |

Para `product-owner`, `ux-designer`, `code-reviewer` e `qa`, a restrição está na configuração: eles não têm a ferramenta `Agent`. Para os desenvolvedores, ela está nas instruções.

**Fluxo de uma feature.**

1. Sessão principal → `product-owner`: cria ou atualiza `docs/specs/<slug>.md` (modelo em `docs/specs/_template.md`), seção Negócio. As perguntas em aberto vão para o usuário; RN "a confirmar" não segue adiante.
2. Sessão principal → `ux-designer`, quando a feature tem tela nova ou muda uma tela: escreve a seção Experiência (UX) do spec (fluxos, wireframes do celular ao desktop, estados, textos e critérios `UX-`). Dúvidas de negócio voltam para a sessão principal, que leva ao PO ou ao usuário.
3. Sessão principal → `architect`: revisa as RNs. Se houver dúvida de negócio, devolve para a sessão principal, que leva ao PO ou ao usuário. Se não houver, escreve "Solução técnica" e "Tarefas".
4. Sessão principal → `architect`, **uma execução por PR**: coordena a implementação daquele PR. O prompt diz em qual [pista local](#pistas-locais-dois-prs-em-paralelo) trabalhar.
   - **PRs de front seguidos do mesmo passo vão juntos num PR só.** Isso vale quando não há PR de banco entre eles e a Implantação não manda publicar um antes do outro. PRs de banco e PRs com momento próprio de publicação continuam separados.
   1. Aciona o `backend-developer` (primeiro, se houver schema ou RPC) e o `frontend-developer`. Tarefas independentes rodam em paralelo.
   2. Cada desenvolvedor, ao terminar, aciona o `code-reviewer`, corrige os próprios achados e repete até o veredito APROVADO (no máximo 3 rodadas). Da 2ª rodada em diante, o reviewer confere só as correções. Achados de outro papel voltam no relatório do desenvolvedor.
   3. Aciona o `qa`. **Quanto testar:**
      - **suíte inteira do Playwright, pgTAP inteiro, concorrência e volume:** só nos PRs com migration e no último PR do passo;
      - **nos outros PRs:** Vitest, tsc, build, lint e, do Playwright, só as specs afetadas pelo diff, mais o smoke de login (`e2e/login.spec.ts`).

      O `ux-designer` revisa a UI **uma vez por passo**, em paralelo com o QA, só no PR que traz tela nova ou padrão novo de UI. Não há revisão de UI nos outros PRs. Bugs e achados voltam ao desenvolvedor responsável, para uma nova rodada.
   4. Devolve um relatório consolidado. A revisão final completa é **uma por passo**, no último PR, sobre o diff acumulado. Num PR intermediário com migration, o `architect` confere só as migrations.
5. Sessão principal → `product-owner`: dá o aceite e atualiza três coisas:
   - a matriz de paridade deste arquivo;
   - o status das regras na seção 3 de `docs/migracao.md`;
   - o passo correspondente (`E2.xx`) na seção Progresso do mesmo documento.

Para uma mudança pequena (bug pontual, texto, estilo): sessão principal → desenvolvedor (que aciona o `code-reviewer`) → `qa`.

Cada agente começa sem o histórico da conversa e só sabe o que quem o chamou passou no prompt. Por isso:
- passe sempre o caminho do spec, os números das tarefas e **as seções e os IDs (RN, UX, DT) que o agente deve ler**;
- os specs em `docs/specs/` funcionam como a memória compartilhada entre os agentes;
- a sessão principal só vê o relatório final de cada agente que ela acionou, então esse relatório precisa trazer arquivos alterados, achados pendentes e resultados de testes.

**Economia de tokens** (medida em 2026-11-24: de 55% a 60% do que o `architect`, o `product-owner` e o `ux-designer` leem é spec).
- Este arquivo já vai no contexto de todo agente. Nenhum prompt ou instrução pede para relê-lo.
- **Specs são lidos por seção, nunca inteiros.** Cada um tem de 50 a 100 mil tokens: o agente lista os títulos (`grep -n '^#'`), lê só as seções da tarefa e acha regras e decisões pelo ID. As instruções de cada agente detalham isso.
- **Teto de 60 KB por spec novo**: Negócio até 20 KB, UX até 15 KB, Solução técnica e Tarefas até 20 KB, Testes até 5 KB (ver `docs/specs/_template.md`). Padrões e decisões de outros specs são citados pelo ID, não copiados. Os specs já escritos ficam como estão.
- Comandos de teste, lint e build rodam com a saída filtrada (`| tail`). O trecho do erro só é aberto se algo falhar.
- **Modelo e esforço por agente** (campos `model` e `effort` no frontmatter):

  | Agente | Modelo | Esforço |
  |---|---|---|
  | `architect`, `backend-developer`, `product-owner` | o da sessão (`inherit`) | `high` |
  | `frontend-developer` | o da sessão (`inherit`) | `medium` |
  | `qa`, `ux-designer` | `sonnet` (em teste desde 2026-11-24) | `medium` |
  | `code-reviewer` | `sonnet` | o da sessão |

  Se a qualidade do `qa` ou do `ux-designer` cair no Sonnet (testes que não pegam bug, revisão rasa), volte o `model` deles para `inherit`.

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
- **Escola**: um curso da Escada do Sucesso (ex.: Universidade da Vida, Capacitação Destino), com uma lista de aulas e, opcionalmente, outras escolas como pré-requisito. Feature futura, ver [`docs/specs/escolas.md`](docs/specs/escolas.md).
- **Turma**: uma edição de uma escola, com período, professores, material e alunos (membros matriculados). A situação de cada aluno é Em andamento, Aprovado ou Reprovado.
- **Aula**: cada encontro de uma turma. A turma copia a lista de aulas da escola quando é criada, e cada aula pode ter uma data.
- **Chamada**: a presença dos alunos numa aula: Presente, Ausente (com ou sem justificativa) ou Reposição, que conta como presença. É informativa, porque a aprovação é manual.
- **Certificação**: o registro de que o membro concluiu uma escola, exibido como "Escolas concluídas" no cadastro. Há no máximo uma por membro e escola. Ela nasce da aprovação numa turma ou é concedida manualmente (carga histórica).

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
  - Dados pessoais: `name`, `email`, `cpf`, `gender` ('M'/'F', `NOT NULL` desde o E2.04), `birth_date`, `mobile_whatsapp`, `phone`, `instagram`, `avatar_url`, `notes`.
  - Endereço inline: `street`, `number`, `complement`, `neighborhood`, `city`, `state`, `zip_code`.
  - Ministério: `is_pastor`, `has_leadership` (sem default desde o E2.04: omitida no cadastro, o banco resolve), `leader_id`, `spouse_id`, `is_baptized`, `baptism_date`, `is_active`, `g12_level`.
  - Acesso: `auth_user_id` (→ `auth.users`), `role_id`.
  - Estatísticas: `total_disciples`, `total_cells`, `male_cells`, `female_cells`.
  - **Regras do cadastro (E2.04):** `CHECK`s `members_email_check`, `members_email_not_placeholder_check`, `members_cpf_check`, `members_leadership_check` (as três situações: pastor sem líder, com líder, sem liderança), `members_leader_not_self_check`, `members_spouse_not_self_check`, `members_baptism_check`; índices únicos parciais entre os não excluídos `members_email_key` (`normalize_email`), `members_mobile_key` (`mobile_match_key`, o 9º dígito conta como igual) e `members_cpf_key` (`normalize_digits`). Os `CHECK`s e os índices valem também em `replica` e para os excluídos. `members.email` guarda só e-mail real (nunca o fictício); vazio ou só espaços vira nulo em todo texto opcional (DT-24).
- `cells`:
  - `leader_id`, `timothy_id`, `host_id`.
  - `type`, em texto pt-BR: 'Evangelística', 'Discipulado' ou 'Macrocélula'.
  - `meeting_day`, em texto pt-BR: 'Domingo', 'Segunda', …, 'Sábado'.
  - `meeting_time`, endereço inline e `is_active`.
- `cell_reports`: `cell_id`, `date`, `time`, `was_held`, `reason_not_held`, `theme`, `observations`, `visitors` (lista de nomes) e `offering`.
- `cell_report_participants`: `report_id`, `member_id`.
- `roles` (`is_system`, no máximo uma, por `roles_single_system_idx`; `is_default`, **exatamente uma** padrão, conferida no *commit* pelo constraint trigger `zz_roles_exactly_one_default`) e `role_permissions`, com permissões do enum `permission_action` (24 valores):
  - Originais: `view_dashboard`, `view_members`, `create_member`, `edit_member`, `delete_member`, `create_cell`, `edit_cell`, `delete_cell`, `manage_roles`, `view_roles`, `view_all_church`, `view_own_ministry`, `edit_own_data`.
  - Vindas do merge da `ai`: `view_own_reports`, `view_all_reports`, `submit_own_cell_report`, `submit_any_visible_report`, `assign_role`, `view_sensitive_data`, `change_member_password`, `view_own_ministry_dashboard`, `edit_cell_report`, `delete_cell_report`, `view_audit_log`.
  - **Aposentadas (E2.02, RN-22):** `view_members` e `view_own_ministry_dashboard` ficam no enum, mas não liberam nada, não aparecem na tela e são recusadas pela `save_role` (`permission_retired`). A lista das que valem é `active_permissions()`.
  - Funções semeadas (E2.02, RN-16): **Administrador** (`is_system`: todas as permissões ativas, inclusive as criadas depois, por `role_effective_permissions`; não pode ser editada, excluída nem ser a padrão), **Líder** (o ministério: `view_own_ministry`, criar, editar e excluir membros e células, editar e excluir relatórios; sem `view_roles`, `assign_role` e `view_sensitive_data`) e **Membro** (padrão: `view_own_ministry`, `edit_own_data`, `submit_own_cell_report`). A tabela completa está na RN-16 do spec E2.02.
- `events` (auditoria): `occurred_at`, `actor_user_id`, `actor_label`, `action`, `entity`, `entity_id`, `entity_label`, `description`, `changed_fields`, `metadata`, `success`, `error_reason`. Tem só política de SELECT (`view_audit_log`).
- Confirmar no banco real (E1.01): `male_cells` e `female_cells` existem? `cells.name` foi removida? Qual definição de `cell_reports` / `cell_report_participants` valeu?
- **Exclusão lógica (E2.01):**
  - `deleted_at` e `deleted_by` (→ `members`) em `members`, `cells` e `cell_reports`. As FKs entre essas tabelas e os participantes são `NO ACTION`: nada é apagado em cascata nem zerado. `role_id` e `auth_user_id` continuam `SET NULL`.
  - Índices parciais `WHERE deleted_at IS NULL` nas listas e o índice único `cell_reports_cell_week_key` (`cell_id`, `week_start(date)`) entre os não excluídos.
  - Views de excluídos (`members_deleted_view`, `cells_deleted_view`, `cell_reports_deleted_view`), só para `manage_roles`; `cell_reports_view.cell_deleted` e `cell_report_participants_view.member_deleted`.
  - Schema `private` (fora da API, sem privilégios) com `member_access_suspensions`: o hash da senha de quem foi excluído, para a restauração.
  - `normalize_email` e `normalize_digits`: a única normalização de e-mail, celular e CPF.
- **Login (E1.04):** `private.sign_in_throttle` (uma linha por chave HMAC de identificação ou de origem, sem valor em claro; chave no Vault; limpeza pelo job `e104-sign-in-purge` do `pg_cron`, a cada 10 min). Normalização do login: `normalize_mobile`, `mobile_match_key`, `is_valid_cpf`, `is_placeholder_email`, com os índices `members_login_{email,cpf,mobile}_idx`. `event_action` ganhou `login_blocked`.

### Lógica no banco
- `compute_g12_level` (BEFORE INSERT ou UPDATE de `leader_id` / `is_pastor`): pastor → 0; com líder → nível do líder + 1; sem líder → 0. **Não propaga** para os descendentes.
- Cônjuge: o `sync_spouse_relationship_trigger` mantém o vínculo simétrico e recusa casar consigo (`spouse_self`, E2.04). O antigo `sync_spouse_trigger` saiu no E1.01.
- **Validações de membro (E2.04)**, para todo papel (inclusive `postgres` e *service role*; só a carga em `replica` passa por fora, e ali valem os `CHECK`s e os índices):
  - `a0_normalize_member` (INVOKER, nunca recusa): normaliza nome, e-mail, celular (forma lida da RN-06) e CPF (dígitos); "mudou" é decidido pelo valor lido pela regra e o que não mudou volta ao gravado (RN-17, DT-05); vazio vira nulo; resolve `has_leadership` omitida; desligar o batismo apaga a data.
  - `ad_enforce_member_rules` (*definer*, depois de permissão, excluído e escopo): recusa na ordem da DA-11 com `app_error` e `field`/`fields`: `name_invalid`, `gender_required`, `birth_date_future`/`birth_date_too_old` (pelo `sp_today()`), `mobile_invalid`, `email_placeholder`, `email_invalid`, `cpf_invalid`, `identifier_required`, `spouse_self`, `pastor_with_leader`, `leader_required`, `leader_self`, `leader_cycle`, `baptism_date_without_baptism`, `value_in_use` (cita todos os campos, nada do outro cadastro) e, por último, `deleted_account_email`. Confere só o que mudou.
  - Ciclo de liderança: subida sem limite de profundidade sob a trava consultiva única `members:leader-tree` (toda troca de líder fica em fila); uma troca cruzada simultânea pode dar 40P01 (DT-25), que a tela trata como "tente de novo". Unicidade: `_member_values_in_use` (interna) sob trava consultiva por valor, com o índice como garantia.
  - Funções de regra (imutáveis, `authenticated` e `service_role`): `placeholder_email_domains()` (a lista única dos domínios fictícios), `placeholder_email_domain()`, `is_valid_email`, `normalize_person_name`, `is_valid_person_name` (`[[:alpha:]]`), `member_has_login_identifier`, `birth_date_problem`; `member_account_email(id)` só para `service_role`.
  - `member_descendants_among(_member_id, _candidate_ids)` (*definer*, `edit_member`, até 100 ids, só pessoas visíveis): os discípulos entre os candidatos, para o seletor de líder. `private.member_rule_violations()` lista quem viola as regras (a reconciliação exige zero).
  - `check_member_insert(jsonb)` recebe o `id` e não preenche `has_leadership` (o ensaio igual ao INSERT). O `aa_` recusa com 42501 o INSERT sem `create_member` antes de qualquer regra (DT-13).
- Relatórios:
  - Um relatório por célula por semana (domingo a sábado), entre os não excluídos: garantido pelo índice único `cell_reports_cell_week_key`. O trigger `enforce_unique_weekly_cell_report` só dá a mensagem amigável, com trava consultiva (célula, semana).
  - `enforce_cell_report_current_week` (BEFORE INSERT/UPDATE de `date`): só a semana atual, em `America/Sao_Paulo`. Também dispara na edição.
- Auditoria:
  - Triggers AFTER em `members`, `cells`, `cell_reports` e participantes chamam `_log_event` (`SECURITY DEFINER`). Os erros são engolidos com WARNING.
  - A exclusão, a restauração (ação `restore`) e o cônjuge desfeito são gravados sem engolir erro (E2.01).
  - `log_auth_event`: só `authenticated` executa (E1.13), **só `logout`** (E1.04 PR 3; `login` dá 22023), com o autor tirado da sessão; não grava para membro excluído (DA-9 do E2.01).
  - Login, falha e bloqueio são gravados só pelo servidor (E1.04): `login_failed` e `login_blocked` pela `sign_in_attempt`, `login` pela `sign_in_record_login`. O cadastro vai em `entity_id`/`entity_label`; `metadata` tem `identifier_type`, `identifier_masked` (sobre a forma normalizada; a identificação inválida vira só `***`), `reason`, `block_scope` e `block_minutes`. A senha, a identificação completa e a origem nunca vão para `events`.
- Login (E1.04), RPCs `SECURITY DEFINER` só para `service_role`, chamadas pela `sign-in`:
  - `sign_in_attempt(_identifier, _password, _origin)`: busca pelo **cadastro** (e-mail, CPF ou celular; nunca pelo e-mail da conta; excluídos só para o motivo), contagem e bloqueio, um bcrypt contra `auth.users` e Auditoria das falhas, numa transação. Devolve `empty_fields`, `invalid`, `locked` ou `ok` (com `password_action`, o ponto do E3.02 ao lado de `private.sign_in_check_legacy`).
  - Limites: 5 falhas da mesma identificação em 15 min bloqueiam ela por 15 min; 50 falhas da mesma origem (IPv4, ou IPv6 por `/64`) em 15 min bloqueiam a origem por 15 min. O sucesso zera só a identificação. Não há desbloqueio manual. `lock_timeout` de 3 s e teto de 5 s no comando (DT-19): passou disso, 500 sem contar.
  - `sign_in_record_login` e `sign_in_discard_link` (apaga o código de uso único se a emissão da sessão falhar).
- Exclusão e restauração (E2.01), só por RPC `SECURITY DEFINER`: `check_member_deletion`, `delete_member`, `restore_member`, `delete_cell`, `restore_cell`, `delete_cell_report`, `restore_cell_report`; `set_cell_report_participants` (INVOKER) grava os participantes pela diferença.
  - Membro com discípulos ou células (mesmo inativos) não é excluído até reatribuir (D10). A exclusão suspende a conta no Auth na mesma transação; a restauração devolve.
  - Triggers `BEFORE` (`ab_enforce_member_links`, `aa_enforce_cell_links`, `aa_enforce_cell_report_rules`, `aa_enforce_participant_rules`) impedem apontar para um excluído e alterar registro excluído, valendo também para a service role.
  - Os helpers de permissão e escopo ignoram quem consulta se o cadastro estiver excluído; `roles` e `role_permissions` exigem cadastro não excluído.
  - Erros de regra: 22023 com `HINT = 'app_error'` e `DETAIL` em JSON (`{ code, … }`); 42501 só para falta de permissão.
- `refresh_member_stats_v2` (triggers em `members` e `cells`): recalcula toda a cadeia de ancestrais, ignorando excluídos.
  - `total_disciples`: descendentes ativos.
  - `male_cells` / `female_cells`: células ativas lideradas na subárvore, separadas pelo gênero do líder.
  - `total_cells = male_cells + female_cells`.
- **Escopo (E2.02)**, pela árvore real de `leader_id`, nunca por `g12_level`. Detalhes em "Solução técnica" do spec `docs/specs/e2-02-perfis-escopo.md`.
  - Âncoras (`_viewer_scope_anchors`, interna): quem consulta, o cônjuge, o G12 (logo abaixo do topo da cadeia) e o cônjuge do G12. O escopo é as âncoras e toda a descendência delas; pastores e quem está sem liderança são o próprio topo (sem G12).
  - Duas formas, com teste de equivalência: a descida em conjunto `viewer_ministry_member_ids()` (views) e a subida por id `viewer_scope_contains_any(ids)` (políticas e triggers). Funções de linha: `viewer_sees_member`, `viewer_sees_cell`, `viewer_sees_cell_people`, `cell_in_viewer_ministry`, `viewer_is_cell_person`, `can_submit_report(cell_id)`. Todas respondem só sobre quem está logado e voltam vazias ou falsas sem permissão de escopo (DT-28).
  - Permissões: `viewer_has(perm)` e `viewer_permissions()` aplicam o atalho da Administrador (`is_system`) e ignoram cadastro excluído; `viewer_covers_role(role)` e `can_assign_role(role)` (RN-18: atribui funções e tem todas as permissões da função); `default_role_id()`.
  - `user_has_permission`, `is_admin`, `role_effective_permissions`, `viewer_permissions` e `_viewer_scope_anchors` não têm EXECUTE para `authenticated` (só `service_role`); com usuário logado, as duas primeiras respondem só sobre ele. `is_in_same_ministry`, `get_ministry_root`, `is_leader_of_visible_member` e `can_manage_own_cell` foram **removidas** (E2.02 PR 1).
- Escrita com escopo (E2.02): `enforce_member_write_rules` (função: RN-18, RN-19, RN-21 com `_assert_admin_remains`), `ac_enforce_member_scope` (pessoas escolhidas visíveis; pastor e sem liderança só para quem vê a igreja toda), `zz_enforce_member_visible_after` (AFTER: o cadastro continua visível; roda depois do `sync_spouse_relationship_trigger` pela ordem alfabética), e os triggers de escopo de célula, relatório e participantes. `check_member_insert(jsonb)` ensaia o cadastro sem gravar (usada pela `create-user-admin`). Funções só por `save_role` e `delete_role` (*definer*, `manage_roles`; a troca da padrão é atômica; só se acrescenta permissão que quem salva tem, DA-3), com os triggers `aa_protect_roles` e `aa_protect_role_permissions`.
- Leitura pelo front (E1.08), sempre por views ou RPCs:
  - Views *security definer* cujo `WHERE` espelha a política de SELECT da tabela: `members_view` (com a máscara de dados sensíveis), `cells_view`, `cell_reports_view` e `cell_report_participants_view`. Têm colunas calculadas (nomes, G12 da célula, último relatório, contagens) e `search_text` sem acento.
  - RPCs do dashboard (`dashboard_summary(_at)`, `dashboard_cells_by_type`, `dashboard_g12_ranking`): `SECURITY INVOKER`, leem só das views e herdam o escopo. `_dashboard_assert_access` devolve 42501 sem `view_dashboard`.
  - `ministry_tree_nodes(_parent_ids)`: `SECURITY INVOKER` sobre a `members_view`; devolve um nível da árvore de casais, com as contagens, numa chamada só. As raízes são os pastores para quem tem `view_all_church` e, para os demais, `viewer_tree_roots()`: o casal G12 de quem consulta ou, sem G12, o próprio casal (DA-6 do E2.02).
  - Acesso de quem está logado (E2.02): `my_access()` (uma linha: função, permissões efetivas, alcance, `can_create_member`, `can_assign_roles`, `can_submit_some_report`), `role_options(_member_id)` (as funções que quem chama pode atribuir e a atual, só para quem atribui; RN-23) e a `roles_view` (*security definer*, para a tela de Funções, com `members_count`).
  - Funções de escopo sobre a sessão atual: `viewer_member_id`, `viewer_has`, `viewer_ministry_member_ids`; utilitários `sp_today`, `week_start`, `weekday_index`, `search_normalize`; nomes de referência por `member_names`.
- O que cada permissão libera (E2.02):
  - `view_all_church`: a igreja inteira. `view_own_ministry`: o escopo do ministério. Sem as duas: só o próprio cadastro, as células em que a pessoa é líder, timóteo ou anfitrião e os relatórios delas.
  - `view_all_reports` / `view_own_reports`: só relatórios (da igreja ou do escopo); não liberam Membros nem Células.
  - `edit_own_data`: só os dados pessoais do próprio cadastro. Não dá mais direito de editar célula nem de lançar relatório.
  - Toda escrita exige ver o registro antes e depois e ver as pessoas escolhidas (RN-09); quem vê só o ministério não marca pastor nem sem liderança.
  - Relatórios: lançar com `can_submit_report` (`submit_own_cell_report` para líder, timóteo ou anfitrião da célula; `edit_cell` ou `submit_any_visible_report` nas células visíveis); editar com `edit_cell_report` e excluir com `delete_cell_report`, só nos visíveis.
  - Função de alguém: `assign_role` ou `manage_roles`, cobrindo a atual e a nova; ninguém muda a própria. Quem não atribui cadastra com a padrão, se a cobrir.
  - `view_sensitive_data`: imposta na `members_view` e travada na tabela. `authenticated` só tem SELECT por coluna nas colunas não sensíveis de `members`, e `anon` não lê a tabela (E1.08 PR 5).
  - `view_roles` ou `manage_roles`: leem `roles` e `role_permissions` (E2.02 PR 6, DA-9). A `role_id` de outra pessoa sai na `members_view` só para quem tem `assign_role` ou `manage_roles`; a própria, sempre.
- O atalho da Administrador está **no banco** (`is_system` recebe todas as permissões ativas). O front não tem mais `isSystem`: `hasPermission` lê as permissões efetivas que vêm da `my_access()`.

### Edge Functions
- `create-user-admin` (contrato do E2.04): corpo `{ attemptId, password, memberData, confirmDeletedMatches? }`, com o e-mail só em `memberData` (nulo para quem não tem). Ordem (DT-11): JWT e `create_member` → entrada → tentativa repetida → ensaio no banco com a sessão de quem chama (`check_member_insert`, as mesmas regras do INSERT, nada gravado) → aviso de excluído → conta no Auth com `id` = `attemptId` e o e-mail técnico `member_account_email(id)` (`<id>@mci12fakemail.com`) → INSERT do membro com a sessão de quem chama (`id` e `auth_user_id` = `attemptId`; o RLS e os triggers valem e a auditoria registra o autor) → desfazimento só da conta criada na chamada.
  - Idempotente pelo `attemptId` (gerado ao abrir o formulário): repetido, devolve o mesmo cadastro com `replayed: true`, ou 409 `attempt_already_used`. Recusas: 403 no 42501; 400 com `{ error, code, field, fields }` nas regras; 409 `deleted_account_email` (nunca cria) ou `deleted_matches` (cria só com `confirmDeletedMatches: true`), sempre depois da unicidade. Devolve só o `id`.
- `sign-in` (E1.04): o **único** caminho de login. `verify_jwt = false` (a tela chama só com a chave pública). Corpo `{ identifier, password }`; respostas 200 `{ result: 'ok', session }` (só os tokens), 400 `empty_fields`, 401 `invalid_credentials` (corpo único para toda falha, piso de 700 ms), 429 `locked` com `retry_after_minutes` e `Retry-After`, 500 `server_error`.
  - A origem vem só do `CF-Connecting-IP`; sem ele, fora da stack local, 500 (falha fechada).
  - Emite a sessão com `generateLink(magiclink)` + `POST /auth/v1/verify`, com a chave secreta nova (`SUPABASE_SECRET_KEYS`, obrigatória em produção) e `Sb-Forwarded-For` (o limite de `/verify` é por pessoa: `security_sb_forwarded_for_enabled = true`, `rate_limit_verify = 150`).
  - Logs só com o resultado, o tempo e um código interno.
- A `get-user-email` foi removida no E1.04 PR 3 e é apagada do projeto a cada "Deploy: banco" (`EDGE_FUNCTIONS_REMOVED`).
- `change-member-password`: valida o JWT e checa `change_member_password` ou `is_admin` antes de usar a Admin API, e registra em `events`. Não checa escopo nem o perfil do alvo. Chama `user_has_permission`/`is_admin` com a service role (que ainda tem EXECUTE) até o E2.03 reescrevê-la (risco 12 do E2.02).

### Front
- Rotas: `/login`, `/` (Dashboard), `/members`, `/cells`, `/cell-reports`, `/ministries`, `/roles`, `/events` (Auditoria, só com `view_audit_log`) e as listas de excluídos `/members/deleted`, `/cells/deleted` e `/cell-reports/deleted` (só com `manage_roles`). Cadastro e edição acontecem em diálogos (`MemberForm`, `CellForm`, `CellReportForm`).
- **Acesso (E2.02):** o `AuthContext` lê a `my_access()` (`use-access`) e a relê ao voltar para a aba, ao navegar e depois de um 42501, com o aviso "Seu acesso foi atualizado." uma vez. Regras puras em `src/lib/access/` (`permissions.ts` com o catálogo e os grupos, `access.ts` com menu, rotas e subtítulos, `codes.ts` com os códigos `app_error`, `member-form.ts`, `cell-form.ts`, `texts.ts`). O menu (`AppSidebar`) mostra a própria função embaixo do nome e "Editar meus dados" ou "Ver meus dados"; rota sem permissão mostra `NoAccess` sem pedir dados.
- Funções (`Roles.tsx`, `RoleForm`, `RoleDeleteFlow`, `use-roles`): lê a `roles_view` e grava só pela `save_role` e `delete_role`.
- `MemberForm` (a regra vale no banco; a tela replica). Desde o E2.04 PR 3: react-hook-form com *resolver* sobre `validateMemberForm`, seções em `src/components/members/` (`MemberFormDialog`, `MemberPersonalSection`, `MemberIdentificationFieldset`, `MemberMinistrySection`, `FieldMessages`, `FormErrorSummary`…) e a gravação no hook `use-member-save`:
  - campos sensíveis escondidos sem `view_sensitive_data`;
  - Função por `role_options` (nunca pela `role_id` da linha), editável só para quem atribui; "Novo membro" bloqueado se quem cadastra não cobre a padrão (RN-19); "Criar membro" mostra "Carregando…" enquanto as funções carregam;
  - bloco ministerial com `edit_member`/`create_member`; pastor e sem liderança só para quem vê a igreja toda; "Tem Liderança?" ligado no cadastro novo; os interruptores que apagam outro campo avisam antes (P20); o seletor de líder marca os discípulos como desabilitados, com o motivo (`member_descendants_among`);
  - erros todos de uma vez ao salvar, no campo, com resumo no rodapé e foco no primeiro (P22); formato conferido ao sair do campo, nunca a unicidade; dado antigo fora da regra vira aviso que não impede salvar (P24); máscaras de celular e CPF sem cortar dígitos (P23);
  - cadastro novo pela `create-user-admin` com o `attemptId` da abertura (tempo-limite de 20 s; a nova tentativa repete o mesmo); edição com PATCH só do que mudou (`changedMemberFields`), e sem mudança nada é enviado; recusas do servidor no campo, e só a sem campo no `Alert` do topo; 40P01 e queda de conexão como "tente de novo" no rodapé;
  - regra pura em `src/lib/members/` (`identifiers`, `name`, `birth-date`, `validation`, `changes`, `leadership`, `codes`, `texts`), `src/lib/dates/sao-paulo.ts` e `src/lib/masks.ts`; o `src/lib/auth/identifier.ts` importa de `identifiers.ts`;
  - botão "Alterar senha".
- Células e Relatórios: "Novo relatório" por `can_submit_report` (na célula) e `can_submit_some_report` (da `my_access`); "Editar" célula só com `edit_cell`. Os seletores mostram pelo nome salvo quem já está no registro e saiu do escopo (DT-23).
- `CellReportForm`: limita a data à semana atual pelo relógio do navegador e traduz os erros dos triggers. Os participantes são gravados pela `set_cell_report_participants` (pela diferença, numa chamada, preservando participante excluído); o relatório ainda vai numa chamada à parte (o E2.11 junta).
- Exclusão e restauração (E2.01): "Excluir" no menu da linha (`RowActionsMenu`) com `ConfirmDeleteDialog`, bloqueio da exclusão de membro com vínculos (`BlockedActionDialog`), selos (`StatusBadge`), listas de excluídos com restauração, `CellReportSheet` (`?report=<id>`) para relatório de célula excluída e `DeletedMatchesDialog` no cadastro com dados de excluído. Textos em `src/lib/deletion/texts.ts`, erros `app_error` por `parseAppError` (`src/lib/errors.ts`), regras puras em `src/lib/deletion/*`.
- **Fim forçado da sessão (E2.01 PR 6):** toda recusa 42501 (`QueryCache`/`MutationCache` em `App.tsx` e os hooks de escrita que devolvem o erro classificado) e todo "0 linhas" numa escrita pedem a releitura do próprio cadastro na `members_view` (`src/lib/auth/session-check.ts`, uma por vez); a volta do foco também, no máximo a cada 10 s. Sem linha e sem erro (`shouldEndSession`), o `AuthContext` sai só localmente e o `ProtectedRoute` leva a `/login` com `state: { reason: 'session_ended' }`. O `SIGNED_OUT` não pedido (renovação recusada, outra aba) mostra o mesmo aviso; rede, 5xx e 401 nunca encerram.
- Login por e-mail, CPF ou celular, só pela `sign-in` (`src/services/auth/sign-in.ts`, `fetch` com tempo-limite de 20 s). O `AuthContext.signIn` devolve um resultado tipado e passa a sessão ao cliente com `setSession`. A regra de identificação da tela fica em `src/lib/auth/identifier.ts` e os textos em `src/lib/auth/session.ts`; a tabela de casos `supabase/tests/fixtures/login-identifier-cases.json` é a mesma do pgTAP, e um teste quebra se as duas regras divergirem.
- Auditoria (`Events.tsx`): rótulos de falha e bloqueio, segunda linha e painel lidos do `metadata` por *type guard* (`src/lib/audit/auth-events.ts`).
- Toda conta nova usa o e-mail técnico `<id>@<domínio fictício>` (`member_account_email`), e o cadastro guarda só o e-mail real (E2.04, DA-1). As contas antigas ficam com o e-mail de criação; o login e a recuperação leem sempre o cadastro.
- Se a senha não for informada no cadastro, a inicial é `123456`. Isso é uma decisão (D11 em `docs/migracao.md`), não um problema.
- O CEP preenche o endereço via ViaCEP. A célula puxa o endereço do anfitrião.
- Dashboard: os números vêm das três RPCs `dashboard_*`, sem agregação no cliente.
  - Membros: total, ativos, batizados, inativos, não batizados e sem líder.
  - Células por tipo.
  - Ranking dos casais G12 por número de células (masculinas e femininas); cada célula conta uma vez.
  - Sem vínculo celular (janela de 30 dias).
  - Estatísticas da semana (domingo a sábado, horário de Brasília).
- Dashboard: o cabeçalho diz "Visão geral da igreja" ou "Meu Ministério" conforme o que a pessoa vê (`dashboardHeader`); os números já vêm no escopo.
- Ministérios: árvore de casais pela `ministry_tree_nodes`, com uma chamada por expansão, a partir dos pastores (igreja toda) ou do topo do escopo (DA-6). Quem não vê ninguém vê o estado vazio.
- Membros, Células e Relatórios são paginadas no servidor pelas views (busca sem acento, total exato, estado na URL, via `useListSearchParams`). Os seletores de membro e de célula usam o `PaginatedSelect`: 20 opções por vez, busca no servidor e "Carregar mais". Ver `docs/specs/e1-08-paginacao-servidor.md`.

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
- **As quatro views de leitura são *security definer* de propósito** (`members_view`, `cells_view`, `cell_reports_view`, `cell_report_participants_view`). O advisor do Supabase acusa `security_definer_view`; não troque para `security_invoker`, que desliga a máscara e o escopo. O `WHERE` de cada uma espelha a política de SELECT da tabela: mudou uma, mude a outra (os testes de paridade do E1.08 conferem). As colunas sensíveis estão listadas em quatro lugares: a `members_view`, a regra 6 de `enforce_member_write_rules`, `src/lib/members/fields.ts` e o GRANT por coluna (migration `e108_members_column_lock` e o pgTAP dela, que amarra as listas).
- **`members` tem SELECT só por coluna** (E1.08 PR 5):
  - no front, nada de `select('*')` em `members`, e nada de `.select()` sem colunas depois de insert, update ou delete: o RETURNING de coluna sensível dá 42501 e a escrita é desfeita. Escreva sem `.select()` ou com `.select('id')`, e leia pela `members_view`;
  - toda coluna nova em `members` precisa, na mesma migration, de `GRANT SELECT (coluna) ON public.members TO authenticated` se não for sensível. Uma coluna sensível nunca recebe o GRANT e entra na máscara. O pgTAP `e108_pr5_members_column_lock` falha se uma coluna ficar sem essa decisão;
  - não siga a dica "GRANT SELECT ON public.members TO authenticated" da mensagem de erro 42501: ela desfaz a trava.
- As funções chamadas por uma view rodam com os privilégios de quem consulta: as funções usadas pelas views precisam de `GRANT EXECUTE ... TO authenticated`.
- O PostgREST devolve no máximo 1000 linhas por padrão. Listagens e contagens feitas no cliente **cortam os dados sem avisar** acima disso. As listas, o dashboard, a árvore e os seletores já buscam no servidor (E1.08); em código novo, prefira `count`, paginação, views ou RPC.
- As políticas da `20260326193800` nunca foram removidas. Se essa migration rodou, elas se somam às novas, por exemplo `edit_cell` com `FOR ALL` em participantes. Confira em `pg_policies` (E1.01).
- O trigger de semana atual também barra a carga dos relatórios antigos do legado. Na migração, os triggers são desligados (`session_replication_role = replica`).
- O índice único da semana (`cell_reports_cell_week_key`) vale mesmo com `session_replication_role = replica`: relatórios do legado duplicados por célula e semana precisam ser tratados antes da carga.
- Excluir é só pelas RPCs. Um `DELETE` físico falha pelas FKs `NO ACTION`, e um `UPDATE deleted_at` direto (service role) não suspende a conta no Auth.
- **Exclusão lógica (E2.01):**
  - toda consulta, view, contagem, trigger de totais e helper novo filtra `deleted_at IS NULL`; as listas de excluídos usam o **mesmo predicado de escopo** da view principal (mudou uma, mude as três: view, view de excluídos e política);
  - escrita com `.update(…).eq('id', id).select('id')`: sem linha de volta, o registro não existe ou foi excluído ("0 linhas", DT-19); trate como `gone`, nunca como sucesso;
  - um hook de escrita que **devolve** o erro em vez de lançar não passa pelo `MutationCache`: chame `requestSessionCheck()` no 42501 e no "0 linhas", como `use-dialog-write.ts`, senão a sessão de um excluído não termina por ali;
  - a `_del_suspend_access`/`_del_resume_access` escrevem em `auth.users`, `auth.sessions` e `auth.refresh_tokens` (DT-13, risco 1 do spec). Se o Supabase mudar essas tabelas, a exclusão de membro com conta falha inteira; o plano B está no spec;
  - entidade nova com exclusão lógica segue o molde de "Pontos de extensão" do spec E2.01 (colunas e `CHECK`, índices parciais, `delete_*`/`restore_*` com `_del_raise`, view de excluídos só para `manage_roles`);
  - participantes de relatório **não** têm exclusão lógica: a `set_cell_report_participants` apaga e insere pela diferença (a política de DELETE de participantes fica de propósito).
- `gender` é 'M'/'F' e obrigatório no cadastro (E2.04). As funções de stats ainda aceitam 'Masculino'/'Feminino'; deixam de aceitar no E2.06.
- **Toda gravação em `members` passa pelas regras do E2.04**, inclusive a *service role*, os pgTAP, os seeds e o gerador de volume: as massas precisam de nome com sobrenome, sexo, um identificador (e-mail, celular ou CPF) válido e único entre os não excluídos e a situação de liderança coerente. Em `replica` os triggers não rodam, mas os `CHECK`s e os índices únicos valem.
- **Regras do cadastro em três lugares** (E2.04, DT-17/DT-18): o banco (funções de regra), `src/lib/members/*` (a mesma regra na tela) e a tabela de casos `supabase/tests/fixtures/member-validation-cases.json`, de onde sai o SQL do pgTAP; o `member-validation-cases-sync.test.ts` quebra se divergirem. Mudou uma regra ou a lista de domínios fictícios, mude os três e confira os dados antes com `private.member_rule_violations()` (um `CHECK` com função não revalida linhas antigas).
- `meeting_day` é salvo como 'Segunda', 'Terça'…. A lista de dias fica só em `src/lib/cells/weekdays.ts`, espelho de `public.weekday_index`; não crie outra.
- O `PaginatedSelect` tem contornos para funcionar dentro do Dialog do Radix (Esc, blur, toque, `onOptionHover`), cobertos por testes. Rode esses testes ao atualizar o react-select ou o Radix.
- Gere os tipos com a CLI do Homebrew (2.84.2). O `npx supabase` resolve para a 3.3.0, que muda o formato do `types.ts` inteiro.
- **Login (E1.04):**
  - **O provedor de e-mail do Auth está desligado em produção** (`external_email_enabled = false`). `signInWithPassword` e `resetPasswordForEmail` respondem `email_provider_disabled`; não os use. A renovação, a saída, o `generateLink` e o `admin.createUser` continuam funcionando. A recuperação de senha (E1.07) precisa de Edge Function própria. Na stack local, o equivalente é `[auth.email] enable_signup = false` no `config.toml`.
  - **Senha em parâmetro SQL** (risco 11 e DT-19 do E1.04): o `auto_explain` de produção registra o plano **com os parâmetros** de todo comando que termine em 10 s ou mais. Nunca suba o `statement_timeout` do `authenticator` ou do `service_role` para 10 s ou mais, nem baixe o `auto_explain.log_min_duration`, nem ligue `log_statement = all`, nem faça `RAISE`/log com a senha. O teto de 5 s dentro da `sign_in_attempt` não pode sair.
  - **Origem só pelo `CF-Connecting-IP`** (DT-06). `X-Forwarded-For`, `X-Real-IP` e afins são forjáveis ou são saltos internos; não os use em limite nenhum. Se o Supabase mudar o *gateway* ou a CDN, refaça a sonda da tarefa 1 do E1.04.
  - Na rede da igreja todos saem pelo mesmo IP: 50 senhas erradas de pessoas diferentes em 15 min bloqueiam todos os logins dali por 15 min (risco 16).
  - **Playwright com `--workers=1`** na stack local: em paralelo, as specs do E2.01 e do E1.04 dividem a massa e a `sign_in_throttle` (todas as chamadas locais vêm de `127.0.0.1`) e falham. A `sign-in` precisa estar servida (`supabase functions serve` ou o *edge runtime* do `supabase start`).
- `has_leadership` no novo quer dizer "tem líder", o inverso de `HasNoLeadership` no legado.
- Um membro sem líder que não é pastor fica com `g12_level = 0`, igual a pastor. O escopo não usa `g12_level` (segue a árvore real); não o use em regra de visibilidade.
- **Perfis e escopo (E2.02):**
  - **Três formas de cada escopo** (view, política e função de linha) mais as views de excluídos: mudou uma, mude todas. O cabeçalho da migration `e202_03_read` tem a tabela de predicados canônicos, e o pgTAP de paridade por persona (`e202_01_scope`) compara as três. A descida e a subida do escopo têm teste de equivalência.
  - `roles` e `role_permissions` não são lidas nem gravadas direto pelo front: a própria função vem de `my_access()`, as opções do cadastro de `role_options()`, a tela de Funções da `roles_view`, e a escrita é só por `save_role`/`delete_role`. A partir do E2.02 PR 6, `authenticated` só lê as duas tabelas com `view_roles` ou `manage_roles` e não tem nenhum privilégio de escrita nelas; e `members.role_id` **não tem SELECT por coluna** (o UPDATE e o INSERT continuam, sem RETURNING da coluna). Nunca leia `role_id` em `select` de `members`/`members_view` para outra pessoa.
  - Toda transação que mexe em `roles` precisa terminar com **exatamente uma** função padrão (constraint trigger adiado), inclusive a massa dos testes e a carga do E4.
  - Função nova `SECURITY INVOKER` chamada por trigger de `members` não pode ler `roles`, `role_permissions` nem `members.role_id` com o papel de quem grava: use os helpers *definer* (`default_role_id`, `can_assign_role`, `viewer_covers_role`). E `_del_raise` só tem EXECUTE para `postgres` e `service_role`: trigger INVOKER que recusa precisa levantar o erro direto ou ser *definer*.
  - A ordem dos triggers de `members` é alfabética e importa: o `zz_enforce_member_visible_after` precisa rodar depois do `sync_spouse_relationship_trigger` (caso André e Beatriz). Não renomeie esses triggers.
  - Permissão nova no enum: a Administrador a recebe sozinha; se for aposentar uma, tire-a de `active_permissions()` e do catálogo de `src/lib/access/permissions.ts`.

## Matriz de paridade

Legenda: ✅ feito · 🟡 parcial · ❌ falta

| Feature ou regra do legado | No novo | Status |
|---|---|---|
| Login por e-mail ou celular | e-mail, CPF ou celular, pela função `sign-in` (limite de tentativas e Auditoria no servidor, E1.04) | ✅ |
| Papéis e escopo por ministério | funções configuráveis e três semeadas (Administrador, Líder e Membro); escopo do legado (si, cônjuge, G12 e cônjuge do G12, com as descendências; pastores; célula e relatório pelo líder, timóteo ou anfitrião) na leitura e na escrita, no banco (E2.02, aceito em 2026-11-25) | ✅ (até o E2.11 gravar o snapshot, o relatório entra no escopo pelas pessoas atuais da célula; a troca de senha é a linha de baixo, E2.03) |
| CRUD de membros | sim; com as validações do legado no banco (E2.04) e o autor na Auditoria também nos cadastros pela `create-user-admin` (E1.02) | 🟡 falta quem criou e quem alterou no próprio cadastro (MEM-12, E2.05) |
| Troca de senha de outro membro | `change-member-password` | 🟡 não checa escopo nem o perfil do alvo |
| Exclusão lógica de membros, células e relatórios | banco e telas (E2.01, aceito em 2026-11-25): exclusão por RPC, listas de excluídos, restauração, consulta do relatório de célula excluída, aviso no cadastro com dados de excluído e encerramento da sessão do excluído; unicidade de e-mail, celular e CPF só entre não excluídos (DEL-04, índices do E2.04) | ✅ |
| Validações de membro: nome e sobrenome, e-mail ou celular obrigatório, e-mail e celular únicos, CPF válido, líder obrigatório, sem ciclos | no banco, para todo caminho de gravação (E2.04, aceito em 2026-11-25): nome e sobrenome, sexo, e-mail, celular ou CPF como identificador, unicidade dos três entre não excluídos, CPF e e-mail válidos, situação de liderança e líder obrigatório, sem ciclos em qualquer profundidade, nascimento e batismo; formulário com os erros no campo | ✅ |
| Cônjuge simétrico | trigger | ✅ |
| Campos computados: árvore de liderança, G12, líder direto | só `g12_level`; o G12 é calculado no cliente, na tela de Células | 🟡 |
| Recalcular o nível dos descendentes quando o líder muda | não propaga | ❌ |
| Totais de discípulos e de células | trigger | ✅ (conta só ativos) |
| Filtros de membros: liderança, bairro, cidade, situação, possui liderança, batizado, nível, vínculo celular, data de cadastro | só busca por texto | ❌ |
| CRUD de células | sim, com `is_active` a mais; só com as permissões de célula e no escopo (E2.02) | ✅ |
| Filtros de células: G12, endereço, tipo, dia, situação do relatório, data de cadastro | só busca por texto | ❌ |
| Situação do relatório por célula (em dia, pendente, atrasado de 1 a 4+ semanas) | não existe | ❌ |
| Lançamento de relatório | sim; quem lança, edita e exclui, com escopo, no banco (D3, E2.02) | 🟡 falta a RPC atômica (E2.11) |
| Regras do relatório: semana atual, sem data futura, um por semana, depois do horário da célula, justificativa quando não houve | triggers de semana atual e índice único da semana | 🟡 aceita data futura dentro da semana, ignora o horário da célula e bloqueia a edição de relatórios antigos |
| Líder, timóteo e anfitrião como participantes automáticos | não existe | ❌ |
| Snapshot de líder, anfitrião, timóteo e tipo no relatório | não existe | ❌ |
| Relatórios por período e atalhos para a semana atual, passada e retrasada | só busca por texto | ❌ |
| Exportação dos relatórios para Excel | não existe | ❌ |
| Dashboard semanal com cards clicáveis (novos membros e células da semana, visitantes, pendentes) | números calculados no banco (E1.08), no escopo de cada um (E2.02) | 🟡 faltam novos membros e novas células da semana e o drill-down (E2.14) |
| Árvore de ministérios (casais) | sim, calculada no banco (E1.08); começa no topo do escopo (MIN-02, E2.15 no E2.02) | ✅ |
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
Spec fechado em [`docs/specs/escolas.md`](docs/specs/escolas.md), com as regras `ESC-` e as decisões `D-ESC-`. A implementação só começa depois da fase 7 do `docs/migracao.md`. Em resumo:
- A escola tem uma lista de aulas e pode exigir outras escolas como pré-requisito. A turma copia as aulas da escola e tem período, professores (membros), material em texto e alunos, que são sempre membros.
- A chamada de cada aula é lançada pelo gestor ou pelo professor da turma e é só informativa. A aprovação é manual e gera **uma única certificação por membro e escola**, exibida em "Escolas concluídas" no cadastro, no mesmo escopo de Membros.
- Permissão nova `manage_schools` ("Gerenciar escolas"), que vale para a igreja toda. As escritas são só por RPC, e a exclusão é lógica.

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
- **Senhas:** o legado guarda MD5 sem salt, que o Supabase Auth não importa. O plano é a migração transparente no primeiro login: uma Edge Function confere o MD5 guardado em `private.legacy_credentials` e grava a senha no Auth. Não há prazo (D6): a senha antiga vale até o primeiro login de cada usuário.

## Problemas conhecidos

Problemas do `mci-connect`. Corrija quando estiver mexendo no código em volta.

- `change-member-password` não checa escopo nem o perfil do alvo: quem tem a permissão troca a senha de um Administrador.
- A data sugerida no `CellReportForm` (`calculateCellDate`) cai na semana passada quando a célula ainda não se reuniu, e o trigger rejeita essa data (E2.11).
- Operação que não é atômica: a gravação do relatório com os participantes (duas chamadas até o E2.11; a regravação dos participantes já é atômica).
- O formulário de relatório abre num `Dialog` comum, e não no `ResponsiveDialogContent` (tela cheia no celular, P1 do E2.02), em Células, Relatórios e Dashboard.
- O INSERT direto em `members` por quem tem "Criar Membro" aceita qualquer `auth_user_id` que não seja o próprio (backlog 8 do E2.02; o E2.04 não fechou). Só uma conta sem cadastro poderia ser vinculada. Correção proposta: no INSERT, `auth_user_id IS NULL OR auth_user_id = id` (a `create-user-admin` e a carga do E4.08 já usam o id do membro na conta).
- A troca de líder leva de 39 a 55 ms com 20 mil membros (meta de 20 ms), quase tudo no recálculo de totais (`trg_refresh_stats_members`), e segura a trava única `members:leader-tree` até o *commit* (E2.06).
- No seletor de UF do `CellForm`, o botão não tem nome acessível (axe `button-name`).
- A Auditoria lê só os 500 eventos mais recentes, sem paginação, e os eventos de falha e de bloqueio de login não têm retenção definida (risco 5 do E1.04, decisão do PO pendente).
- Contraste dos tokens globais de tema (`src/index.css`, axe no E1.04 e no E2.02): no escuro, o `--primary` com o texto do botão (2,97:1); no claro, o `--accent` em *hover* (2,97:1), o `--secondary` (2,97:1) e o `--muted-foreground` sobre `--muted` (4,34:1). A linha da Auditoria não abre o painel pelo teclado.
