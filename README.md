# MCI Apps

Sistema de gestão da igreja MCI (visão G12). Cuida do cadastro de membros, da hierarquia de discipulado, das células (reuniões caseiras semanais) e dos relatórios de célula, que são a base do controle de expansão da igreja.

Este repositório reúne, como submódulos Git, a versão que está em produção e a nova versão em desenvolvimento. A ideia é ter os dois lado a lado durante a migração.

## Repositórios

| Pasta | Papel | Stack | Branch |
|---|---|---|---|
| [`mci-connect/`](https://github.com/MCI-12-RS/mci-connect) | **Nova versão**, em desenvolvimento | React 18 + TypeScript + Vite + shadcn/ui + Tailwind, criada no Lovable · Supabase (Postgres, Auth, RLS, Edge Functions) · deploy na Vercel | `main` |
| [`g12app-net/`](https://github.com/MCI-12-RS/g12app-net) | **Legado**, em produção até ser descontinuado | .NET 8 (ASP.NET Core + EF Core) · MySQL · front em React (CRA + react-bootstrap) | `master` |

## Funcionalidades

- **Membros**: dados pessoais e de contato, endereço, líder, cônjuge, batismo e situação (ativo/inativo).
- **Ministérios**: a árvore G12 (pastores → G12 → 144 → …), exibida por casais, com o total de discípulos e de células de cada ramo.
- **Células**: líder, timóteo, anfitrião, dia e horário, tipo (evangelística, discipulado, macrocélula) e endereço.
- **Relatórios de célula**: lançamento semanal com tema, participantes, visitantes, oferta e observações, ou o registro de que a célula não aconteceu.
- **Dashboard**: números da semana (relatórios enviados, pendências, visitantes, novos membros e células) e números gerais da igreja ou do ministério.
- **Controle de acesso**: cada usuário vê só o próprio ministério, a menos que tenha permissão para ver a igreja inteira.

Em planejamento:
- **Consolidação**: cadastro de quem visita uma reunião na igreja como potencial membro.
- **Escolas**: turmas, material por turma e situação de cada aluno (aprovado, reprovado ou em progresso).

## Roadmap

1. **Paridade**: levar para o `mci-connect` todas as funcionalidades e regras do legado.
2. **Migração de dados**: do MySQL do legado para o Supabase.
3. **Descontinuar** o `g12app-net`.
4. **Novas funcionalidades**: Consolidação e Escolas.

O status de cada item de paridade está na matriz do [`CLAUDE.md`](CLAUDE.md#matriz-de-paridade).

## Primeiros passos

```bash
git clone --recurse-submodules https://github.com/MCI-12-RS/apps-mci.git
cd apps-mci

# se já clonou sem os submódulos:
git submodule update --init

# para trazer as últimas versões dos submódulos:
git submodule update --remote
```

As configurações e os segredos locais do projeto (credenciais de banco, chaves do Supabase etc.) ficam em `local.config`, na raiz. Esse arquivo é ignorado pelo git e nunca deve ser commitado.

Cada submódulo é um repositório independente. Para mudar o código de um deles:

1. Entre na pasta, crie a branch, faça o commit e o push lá dentro.
2. Volte para a raiz e registre a nova versão: `git add mci-connect && git commit`.

## Rodando localmente

### `mci-connect` (nova versão)

Requisitos: Node.js 18 ou mais recente.

```bash
cd mci-connect
npm install
npm run dev      # http://localhost:8080
```

O front lê a conexão com o Supabase do `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_PROJECT_ID`).

Outros scripts:

| Comando | O que faz |
|---|---|
| `npm run build` | build de produção |
| `npm run lint` | ESLint |
| `npm test` | testes com Vitest |

Banco de dados:
- As migrations ficam em `supabase/migrations/` e as Edge Functions em `supabase/functions/`.
- Depois de mudar o schema, regenere os tipos:
  ```bash
  npx supabase gen types typescript --project-id <ref> > src/integrations/supabase/types.ts
  ```

### `g12app-net` (legado)

Requisitos: .NET 8 SDK, Node.js e Docker (para o MySQL local).

```bash
cd g12app-net
docker compose up -d mysql                  # MySQL 5.7 local
(cd G12App.API/ClientApp && npm install)
dotnet run --project G12App.API             # API + front via SpaProxy
```

- A connection string (`ConnectionStrings:MySql_AppContext`), a chave do JWT (`JWTSettings:SecretKey`) e o usuário administrador (`AdminUser`) são lidos do `appsettings` do ambiente.
- Para rodar os testes: `dotnet test`.

## Documentação

O [`CLAUDE.md`](CLAUDE.md) é a referência técnica do projeto. Ele cobre:
- o glossário do domínio;
- as regras de negócio do legado, que servem de especificação para a paridade;
- o estado atual do `mci-connect`;
- a matriz de paridade;
- o mapeamento de dados para a migração.

Ele também é lido automaticamente pelo Claude Code.

Outros documentos e configurações:
- [`docs/migracao.md`](docs/migracao.md): o plano de migração, com as regras do legado a replicar, a migração dos dados, as contas e senhas, e o roteiro de cutover.
- `docs/specs/`: especificações das features (negócio, solução técnica, tarefas e testes), a partir do modelo `_template.md`.
- `.claude/agents/`: o time de agentes do Claude Code (Product Owner, Architect, Backend, Frontend, Code Reviewer e QA). O fluxo de trabalho deles está descrito no `CLAUDE.md`. O ideal é abrir o Claude Code na raiz do repositório, porque os agentes trabalham nos dois projetos.

## Contribuindo

- Funcionalidades novas e correções de produto vão para o `mci-connect`. O legado só recebe o mínimo necessário para a migração.
- No `mci-connect`, regras de negócio precisam ser aplicadas no banco (RLS, constraints, triggers ou RPC), não só na interface.
- Não edite migrations que já foram aplicadas; crie uma nova.
- O `mci-connect` é sincronizado com o Lovable. Evite reescrever o histórico da `main`.
