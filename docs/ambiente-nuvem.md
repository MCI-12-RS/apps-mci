# Sessões na nuvem (claude.ai/code): como montar o ambiente

Notas da sessão de 2026-11-25/26, que rodou o plano numa sessão na nuvem e não na máquina do usuário. Nada aqui é segredo: as credenciais ficam só no `local.config` (fora do git).

## O que a sessão precisa
- **Ambiente "apps-mci"** (pessoal) com estes hosts liberados: `api.supabase.com`, `gkhnjhmgeceoaqeynhrj.supabase.co`, `api.vercel.com`, `deno.land`, `esm.sh` (e os registros de pacotes, ligados por padrão). O MySQL do legado e o Postgres do Supabase **não** são alcançáveis: o proxy só passa HTTPS (o túnel `CONNECT` abre, mas o protocolo do banco não passa).
- **Repositórios:** o `apps-mci` vem anexado; o `mci-connect` precisa de `add_repo` com acesso de push (o Claude GitHub App está instalado nele). O `g12app-net` é lido sem anexar.
- **`local.config`** na raiz do `apps-mci`, com as chaves descritas no `CLAUDE.md` (o usuário cola na conversa; nunca vai para o git).

## Produção sem acesso direto ao banco
- **Leitura (e escrita, quando autorizada) no Postgres de produção:** Management API, `POST https://api.supabase.com/v1/projects/<ref>/database/query` com `Authorization: Bearer $SUPABASE_ACCESS_TOKEN` e corpo `{"query": "...", "read_only": true}`. Algumas funções `private.*` dão "permission denied" por esse caminho (ex.: `member_hierarchy_drift()`): consulte as tabelas direto.
- **Deploy:** só pelos workflows do `mci-connect` ("Deploy: banco" e "Deploy: promote"), disparados com o SHA **completo** no `ref` (o checkout não aceita SHA abreviado). O promote exige o build de produção da Vercel do commit (`GET https://api.vercel.com/v6/deployments?projectId=…&target=production`).
- **Smoke com contas temporárias:** criar a conta pela Admin API do Auth (chave secreta), a senha pelo cofre (`private.write_password`), o cadastro por SQL; no fim, apagar as **contas antes dos cadastros** (o cofre guarda quem redefiniu em `password_set_by`, uma FK sem cascata).
- **Legado (MySQL):** os scripts de `data-migration/` rodam **na máquina do usuário**.

## Stacks locais (as duas pistas do `CLAUDE.md`)
1. Docker: `sudo update-ca-certificates`; subir o `dockerd` com o proxy da sessão (`/root/.ccr/README.md` diz a porta; ex.: `sudo env HTTPS_PROXY=http://127.0.0.1:<porta> HTTP_PROXY=… NO_PROXY=localhost,127.0.0.1 nohup dockerd &`).
2. Supabase CLI **2.84.2**: baixar `supabase_linux_amd64.tar.gz` da release `v2.84.2` no GitHub e pôr em `/usr/local/bin`.
3. As imagens vêm do Docker Hub: `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io` (o CloudFront do ECR é bloqueado).
   - Se o Docker Hub responder 429 (limite de *pulls* anônimos, visto em 2026-11-26), baixe pelo espelho do Google e marque com o nome que a CLI espera: `docker pull mirror.gcr.io/<imagem>:<tag> && docker tag mirror.gcr.io/<imagem>:<tag> <imagem>:<tag>`. Foi preciso para `library/kong:2.8.1` (marcar como `kong:2.8.1`), `postgrest/postgrest:v14.7`, `supabase/edge-runtime:v1.73.0` e `supabase/pg_prove:3.36`. A lista de imagens da versão da CLI sai de `strings $(which supabase) | grep -oE '^FROM [a-z/._-]+:[a-zA-Z0-9._-]+'`.
4. Sem IPv6: no `config.toml` da stack, `[realtime] enabled = false` e `[storage] enabled = false`, e `supabase start -x realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,logflare,vector,supavisor`.
5. Edge runtime: os contêineres não alcançam o proxy da sessão. Um repassador TCP em `172.17.0.1:3128` → proxy e, no `config.toml` da stack, `[edge_runtime.secrets]` com `HTTPS_PROXY`/`HTTP_PROXY = "http://172.17.0.1:3128"` e `NO_PROXY` com os nomes dos contêineres. Depois de recriar a pasta de funções, `docker restart supabase_edge_runtime_<projeto>`.
6. Pista A: cópia de `mci-connect/supabase` em `.worktrees/lane-a` (portas 57321/57322); pista B: worktree `.worktrees/mci-connect-b` (58321/58322, `config.toml` com `skip-worktree`). Administrador do E2E recriado depois de cada `db reset` por um script que cria a conta (id = id do membro), grava a senha no cofre e insere o cadastro com a função Administrador.
7. Vite: o `vite.config.ts` usa `host: "::"`, que falha sem IPv6. Subir antes do Playwright com `npx vite --host 127.0.0.1 --port <8080|8180> --strictPort` (o Playwright reaproveita o servidor).
8. Playwright: o projeto pede o `chromium_headless_shell-1208`; a máquina tem o `-1243`. Um link simbólico resolve (`/opt/pw-browsers/chromium_headless_shell-1208` → `-1243`).

## Lições da sessão
- Agentes acionados em segundo plano pela sessão principal **não** recebem a ferramenta `Agent`: o `architect` implementa e testa sozinho. A sessão principal aciona depois o `code-reviewer`, o `ux-designer` e o `qa` sobre o diff.
- Com duas pistas rodando, o pgTAP `e203_02_policy` pode estourar o teto de 5 s do login; rode-o sozinho antes de concluir que falhou.
- O teste de catálogo do portão (`e203_06_gate`) quebra quando um passo cria função com EXECUTE para `authenticated` que não passa pelo portão: funções puras (listas, relógio) entram na lista fechada, com a justificativa no spec do E2.03.
- PRs empilhados: depois do *squash* do PR de baixo, `git rebase --onto origin/main <head antigo do PR de baixo>` e repontar o PR de cima para a `main`.
- Sessão de 2026-11-26 (tarde): mesmo com `run_in_background: false`, os `architect` rodaram sem a ferramenta `Agent`. O fluxo que funcionou: `architect` implementa e testa sozinho → a sessão principal aciona o `code-reviewer` e, nos PRs de front, o `qa` sobre o diff (pelo `git diff origin/main...origin/<branch>`, sem checkout na pasta da pista).
- Com as duas pistas ao mesmo tempo, o repassador do edge runtime da pista B ficou em `172.17.0.1:3128` e o da pista A em `3129`. O repassador morre com a sessão que o abriu: numa sessão nova, suba de novo.
- Deploy pela sessão (quando o usuário pede): merge pelo MCP do GitHub (`merge_pull_request`, squash, `expectedHeadSha` com os 40 caracteres) e os workflows por `actions_run_trigger` com `ref: main` e o input `ref` com o SHA completo. "Deploy: banco" primeiro com `somente_plano: "true"` e conferir no log ("Would push these migrations"). O promote exige o build da Vercel em READY (uns 4 min depois do merge); se não estiver, ele falha sem mudar nada e é só rodar de novo.
- Teste conhecido que falha na `main`: `src/test/password-policy-cases-sync.test.ts` (o SQL do `e203_02_policy` foi editado à mão no #50, sem o gerador).

## Próxima sessão (handover de 2026-11-26)
- **Em produção hoje:** E2.05 PRs 1 e 2 (#50, #52) e E2.07 PR 1 (#51). Fase 2: 8 de 16 aceitos; E2.05 e E2.07 em andamento. O board "Migração MCI Connect" (artifact) está atualizado.
- **Na fila, nesta ordem:**
  1. E2.05 PRs 3 e 4 num PR só (autoria na tela e Auditoria nova; tarefas 11 a 17 do spec), pista A. Fecha o passo: suíte inteira, revisão de UI e revisão final; depois o aceite do `product-owner`.
  2. Em paralelo, na pista B: E2.07 PR 4 (Novo membro e cache, não toca a Auditoria) ou o banco do E2.11 (não mexe na `members_view`). O E2.07 PR 2 só depois do item 1 (move o `FilterChips` da Auditoria).
  3. Corrigir o `password-policy-cases-sync` (rodar o gerador e conferir o `e203_02_policy`).
- **Com o usuário:** `npm run copy`/`npm run report` em `data-migration/` (E4.03/E4.04) e os Ids dos pastores no legado; apagar a branch `base/e205` do `mci-connect`; avisar a liderança da mudança do card "Sem Vínculo Celular"; mergear o PR do `apps-mci` com estes docs; as perguntas Q-1 a Q-6 do E2.08/E2.09.
- **Ambiente desta sessão:** sem `local.config` (nada de acesso direto a produção). Docker e CLI 2.84.2 instalados à mão (ver acima); stacks `mci-e104-be` e `mci-b` de pé até o contêiner ser reciclado.
