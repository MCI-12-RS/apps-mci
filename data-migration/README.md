# data-migration

Ferramentas da migração de dados do legado (`g12app-net`, MySQL) para o Supabase do `mci-connect`. O plano completo está em [`docs/migracao.md`](../docs/migracao.md), seção 5. Esta pasta cobre, por enquanto:

| Passo | Etapa | Comando | Escreve em |
|---|---|---|---|
| E4.01 | Estrutura, configuração e `--dry-run` | — | — |
| E4.03 | Cópia bruta do MySQL para o schema `legacy` | `npm run copy` | schema `legacy` do Supabase |
| E4.04 | Relatório de saneamento | `npm run report` | `data-migration/reports/saneamento-<data>.md` (local) |
| E4.06, E4.07 | Transformação e carga (com as funções da RN-18 do E3) | `npm run load` | `members`, `cells`, `cell_reports`, `cell_report_participants`, `private.member_hierarchy`, `private.cell_active_periods`, `legacy._load_*`; `data-migration/reports/carga-<data>-<n>.md` (local) |
| E4.08 | Contas de acesso e credenciais legadas | `npm run accounts` | contas no Auth (Admin API), `members.auth_user_id`, `private.legacy_credentials` (e a linha do cofre), `legacy._accounts_runs`; `data-migration/reports/contas-<data>-<n>.md` (local) |
| — | Limpeza do staging | `npm run clean` | apaga o schema `legacy` |

Os próximos passos (limpeza do ensaio e reconciliação: PRs 3 e 5 do spec [`e4-carga`](../docs/specs/e4-carga.md)) vão entrar aqui também.

## Pré-requisitos

- **Node 22** e npm. Instale as dependências uma vez, dentro desta pasta: `npm ci`.
- **Rede:** a máquina precisa alcançar o MySQL do legado (no DigitalOcean, o IP dela precisa estar em *Trusted sources* do banco) e o Supabase pelo **Session pooler** (`aws-…pooler.supabase.com`, porta 5432). A conexão direta `db.<ref>.supabase.co` só tem IPv6.
- O schema `legacy` **não** pode estar entre os schemas expostos pela API (Supabase → *Settings → API → Exposed schemas*; o padrão é só `public` e `graphql_public`). Mesmo exposto, ele não seria lido: a cópia tira todos os privilégios de `anon`, `authenticated` e `service_role` e confere isso (schema, tabelas, colunas e sequências) antes de gravar.
- `psql` só é necessário para o teste local.

## Configuração

Os scripts leem o `local.config` da raiz do repositório (ignorado pelo git). Para usar outro arquivo: `--config <arquivo>` ou a variável `MCI_LOCAL_CONFIG=<arquivo>`. O arquivo é lido como texto; nada é exportado para o ambiente (a Supabase CLI leria qualquer `SUPABASE_*`).

| Chave | Obrigatória | Uso |
|---|---|---|
| `LEGACY_PROD_CONNSTRING` | sim | Connection string ADO.NET do legado: `Server=…; Port=…; Uid=…; Password=…; Database=…; SslMode=Required;` |
| `LEGACY_PROD_SSL_CA` | não | Caminho do certificado da CA do MySQL (no DigitalOcean: *Download CA certificate*). Com ele, o certificado do servidor é conferido; sem ele, a conexão é cifrada mas não conferida (como o `SslMode=Required` do próprio legado), e o script avisa. |
| `SUPABASE_PROJECT_REF` | sim | Precisa ser `gkhnjhmgeceoaqeynhrj`; qualquer outro valor é recusado. |
| `SUPABASE_HOST`, `SUPABASE_PORT`, `SUPABASE_DB`, `SUPABASE_USER`, `SUPABASE_PASS` | sim | Session pooler (porta 5432; a 6543, o pooler em modo transação, é recusada: a trava por sessão e as tabelas temporárias se perderiam). No pooler, o usuário precisa ser `postgres.gkhnjhmgeceoaqeynhrj`. Fora do pooler, só a conexão direta do mesmo projeto ou a stack local (`127.0.0.1`) são aceitas. |
| `SUPABASE_SSL_CA` | não | Caminho do certificado da CA do Supabase (*Database settings → SSL configuration → Download certificate*). Com ele, o certificado é conferido; sem ele, a conexão é cifrada mas não conferida, e o script avisa. |
| `LEGACY_PASTOR_IDS` | não | Ids do legado dos pastores da D9 (Samuel Colares e Magda Colares), separados por vírgula. Sem eles, o relatório de saneamento lista os dois entre os "sem líder". Também aceita `--pastor-ids`. |
| `LEGACY_ADMIN_IDS` | não (sim no `--final`) | Ids do legado de quem recebe a função Administrador na carga (RN-18 c do E3; a lista é aprovada pelos pastores, Q-6). Também aceita `--admin-ids`. No `--final`, a carga para se ficarem menos de 2 Administradores não excluídos com identificador de login, contando os adotados. |
| `SUPABASE_SECRET_KEY` | só no `npm run accounts` | A chave secreta do projeto (`sb_secret_…`), para a Admin API do Auth. Na falta dela, `SUPABASE_SERVICE_ROLE_KEY` (a antiga). Nunca é impressa. |
| `SUPABASE_URL` | só no `npm run accounts` com a stack local | A API do Auth. Fora da stack local, o padrão e o único valor aceito é `https://gkhnjhmgeceoaqeynhrj.supabase.co`; com o banco da stack local, a API da mesma stack (ex.: `http://127.0.0.1:58321`). Banco e Auth de destinos diferentes são recusados. |
| `LEGACY_APP_URL` | não | Endereço do legado (ex.: `https://…`). Com ele, os Ids do relatório viram links para `/members/<Id>` e `/cells/<Id>`. |

Nenhum script imprime, grava ou devolve credenciais. Mensagens de erro de banco saem só com o código e o texto principal, sem o valor da coluna.

## Como rodar

Sempre de dentro desta pasta (`cd data-migration`). Toda etapa que escreve tem `--dry-run`, que mostra o plano e as contagens e não grava nada. Os argumentos vão depois de `--`.

```bash
npm ci

# E4.03: cópia bruta
npm run copy -- --dry-run      # lê o legado e o destino; mostra tabelas, tipos e contagens
npm run copy                   # recria legacy.* e registra a cópia em legacy._copy_runs

# E4.04: relatório de saneamento
npm run report -- --dry-run    # resumo no terminal, sem arquivo
npm run report                 # grava reports/saneamento-<data>.md

# E4.06/E4.07: carga
npm run load -- --dry-run      # roda tudo, mostra contagens e ocorrências e desfaz
npm run load                   # ensaio: neutraliza e lista as pendências "corrigir no legado"
npm run load -- --final        # cutover: para em qualquer pendência "corrigir no legado"
# Fora da stack local, gravar exige --yes (o --dry-run não). Depois de um --final, refazer
# exige --reload-after-final (ver "Refazer só antes do cutover", abaixo).

# E4.08: contas e credenciais legadas (depois da carga)
npm run accounts -- --dry-run  # plano: quem recebe conta, bloqueios e previsão das credenciais
npm run accounts               # cria as contas, liga e carrega as credenciais (refazer completa)
# Fora da stack local, criar exige --yes. --concurrency (padrão 4) e --batch-size (padrão 50 na
# stack local e 25 fora dela; lote acima de 6 s avisa e reduz os seguintes à metade).

# Limpeza do staging (recusa enquanto houver carga no destino; depois do cutover: --after-cutover)
npm run clean -- --dry-run     # mostra o que seria apagado
npm run clean -- --yes         # DROP SCHEMA legacy CASCADE
```

Ajuda de cada script: `node src/<script>.mjs --help`.

### Cópia bruta (`src/copy-raw.mjs`)

- **Legado só com leitura.** A conexão do `local.config` tem privilégio de escrita, então o script: só tem `SELECT`/`SHOW`; recusa qualquer outro comando antes de enviá-lo; e lê tudo numa transação `READ ONLY, WITH CONSISTENT SNAPSHOT`, em que o próprio MySQL recusa escrita e todas as tabelas são lidas no mesmo instante. Sem `mysqldump` e sem arquivo intermediário: as linhas vão do MySQL para o Postgres em lotes.
- **Destino numa transação só.** O schema `legacy` é criado se não existir, sem privilégios para `PUBLIC`, `anon`, `authenticated` e `service_role`. Cada tabela (`Addresses`, `Members`, `Cells`, `Reports`, `ReportMembers`, com os nomes e as maiúsculas do legado) é apagada e recriada, com RLS ligada e sem política, a chave primária e os índices do legado (não únicos). Se algo falhar, nada muda no destino.
- **Tipos fiéis.** `datetime(6)` → `timestamp(6) without time zone`, sem conversão de fuso (o legado grava horário de Brasília); `decimal(65,30)` → `numeric(65,30)`; `tinyint(1)` → `boolean`; `int` → `integer`; `longtext` → `text`. As colunas ficam todas aceitando nulo (é uma cópia, não o modelo).
- **Conferência.** No fim de cada tabela, a contagem (origem no mesmo snapshot × linhas lidas × destino) e um checksum calculado dos dois lados (md5 de cada linha em forma canônica, somado) precisam bater; se não baterem, a cópia inteira é desfeita.
- **Registro.** Cada cópia gravada acrescenta uma linha em `legacy._copy_runs`: início e fim, host, porta e banco de origem (sem usuário nem senha), versão do MySQL, última migration EF (`__EFMigrationsHistory`), commit desta ferramenta e, por tabela, linhas, checksum e ajustes.
- **Ajustes inevitáveis**, contados em `_copy_runs.tables`: data zero do MySQL (`0000-00-00`) vira nulo (`zero_dates_nulled`; o relatório de saneamento lista os relatórios sem data); o caractere nulo (`\0`), que o Postgres não aceita em texto, é removido (`nul_chars_removed`); um `tinyint(1)` diferente de 0 e 1 vira verdadeiro, com aviso (`non_binary_booleans`). O checksum já considera os três ajustes.
- **Coluna a mais no legado** é copiada também, com aviso. Coluna esperada que faltar (lista tirada do `AppDbContextModelSnapshot.cs`) para a cópia antes de gravar.
- **Idempotente:** rodar de novo recria as tabelas com o conteúdo atual do legado; `_copy_runs` guarda o histórico.
- Nenhum comando com parâmetros pode levar 10 s ou mais (`statement_timeout` de 9 s nos `INSERT`): o `auto_explain` do Supabase registra no log os parâmetros dos comandos lentos, e os parâmetros aqui são dados de membros. Com lotes de 500 linhas, cada `INSERT` leva milissegundos; se estourar, diminua `--batch-size`.

### Relatório de saneamento (`src/sanitation-report.mjs` e `sql/sanitation-report.sql`)

- Roda no próprio Supabase, numa transação somente leitura, sobre o `legacy.*`. As regras de e-mail, celular (com o 9º dígito), CPF, nome e nascimento são as **funções do banco do novo** (`normalize_email`, `mobile_match_key`, `is_valid_cpf`, `is_valid_email`, `is_placeholder_email`, `is_valid_person_name`, `member_has_login_identifier`, `birth_date_problem`, `week_start`…), então o relatório aponta exatamente o que os `CHECK`s e os índices únicos vão recusar na carga.
- Cobre a tabela da seção 5.4 do plano e as regras do E2.04, E2.06 e da D10: identificadores repetidos ou inválidos, nome, sexo, nascimento, liderança (sem líder, sem liderança com discípulos, líder inexistente ou excluído, ciclos), cônjuge, células (horário, dia, tipo, líder, timóteo e anfitrião), relatórios (duplicados na semana, célula ou data ausente, snapshot, contagens) e participantes.
- Cada verificação traz a categoria (corrigir no legado pela liderança, E4.05; tratado na transformação, E4.06; precisa de decisão; informativo), o tratamento, a contagem e a lista de **Ids do legado**, com observações sem dado pessoal (ex.: "grupo: 5, 6", "líder excluído: 28"). Nenhum nome, e-mail, CPF ou telefone sai no relatório nem no terminal.
- O arquivo vai para `data-migration/reports/` (ignorada pelo git), com permissão só para o dono. Rodar de novo no mesmo dia sobrescreve o arquivo do dia.

### Carga (`src/load.mjs` e `sql/load/*.sql`)

Desenho: DT-04 a DT-12 do spec [`e4-carga`](../docs/specs/e4-carga.md); mapeamento campo a campo na 5.5 do plano; tratamento de cada problema na 5.4.

- **Uma transação**, como `postgres`, em `session_replication_role = replica` (o primeiro comando confere que o destino aceita; se não, o plano B está no risco 1 do spec), `lock_timeout` de 5 s, `statement_timeout` de 15 min e as quatro tabelas travadas em `EXCLUSIVE` (a leitura continua; a gravação pela tela espera). SQL só por conjuntos (`INSERT … SELECT FROM legacy.…`); os únicos valores passados são Ids do legado e o número da execução (nada de dado pessoal em parâmetro, por causa do `auto_explain`).
- **Ordem:** membros (`10`) → mapa legado → novo e adoção (`20`) → células (`30`) → relatórios e participantes (`40`) → **para aqui** se houver bloqueio → gravação por `legacy_id` com `ON CONFLICT` (`60`) → `private.rebuild_member_hierarchy()`, funções e `private.backfill_cell_active_periods()` (`70`) → validação (`90` e as FKs, pelo catálogo) → *commit* → `ANALYZE`.
- **Modos.** O ensaio (padrão) neutraliza e lista as pendências "corrigir no legado" (identificador repetido fica no menor Id; ciclo quebrado no menor Id; cônjuge não recíproco desfeito; membro não excluído sem nome ou sexo, célula com horário, dia, tipo ou pessoa inválida e relatório com oferta fora da faixa ficam de fora, com o que depende deles). O `--final` para em qualquer uma delas, antes de gravar. Membro **excluído** sem nome ou com sexo inválido fica de fora e é listado nos dois modos, sem parar o `--final` (Q-E4-6: não dá para corrigir na tela do legado). Coincidência ambígua com cadastros do novo, identificador ou semana já usados por um cadastro fora da carga e menos de 2 Administradores no `--final` também param. O catálogo de ocorrências (código, categoria e o que acontece) está em `src/lib/load-codes.mjs`.
- **Adoção** (DT-09, Q-E4-1): membro do legado não excluído que coincide 1 para 1 com um cadastro do novo (sem `legacy_id`, não excluído) por e-mail, celular (9º dígito conta como igual) ou CPF. O cadastro do novo recebe o `legacy_id` e os dados do legado; ficam o `id`, a conta, a senha, a função e o que o legado não tem (Instagram, foto). A linha inteira de antes vai para `legacy._load_adopted`, para a limpeza do ensaio.
- **Funções** (DT-11): Administrador para `LEGACY_ADMIN_IDS` (não excluídos), Líder para quem fica com `g12_level = 1` (não excluído), Membro (a padrão) para os demais, inclusive excluídos; o adotado fica com a função que tinha.
- **Validação** antes do *commit*: toda FK das quatro tabelas resolve, e `private.member_hierarchy_drift()`, `private.cell_active_period_problems()`, `private.member_rule_violations()` e `private.cell_rule_violations()` voltam vazias; o que foi gravado com `legacy_id` (membros, células, relatórios e os participantes deles) é exatamente o planejado na transformação; e os Administradores válidos da lista ficaram com a função de sistema. Qualquer problema desfaz tudo.
- **Idempotente:** refazer com o mesmo legado não regrava nenhuma linha; com o legado mudado, regrava só o que mudou (os participantes de cada relatório carregado passam a ser os do legado). O que foi carregado antes e sumiu do legado (ou passou a ficar de fora) não é mexido: é listado, e a limpeza do ensaio (PR 3) cuida.
- **Refazer só antes do cutover.** Refazer regrava os carregados com o legado: desfaz o que foi editado no novo, reativa células, restaura excluídos, zera a autoria e reaplica as funções. Por isso, com uma carga `--final` gravada e não desfeita em `legacy._load_runs` (`mode = 'final'`, `undone_at` nulo), a carga recusa, salvo `--reload-after-final` (só com ordem expressa). O `--dry-run` segue, com um aviso.
- **Uma carga por vez:** uma trava consultiva (`pg_advisory_xact_lock`) vem antes de criar o controle e do `LOCK`; a segunda carga espera até 5 s e, se a primeira não terminar, recusa com "Outra carga está em andamento".
- **Controle** no schema `legacy`: `legacy._load_runs` (início, fim, modo, commit, contagens e listas de Ids de cada ocorrência) e `legacy._load_adopted`. O `npm run clean` recusa enquanto houver carga no destino.
- **Saída:** contagens e Ids do legado no terminal (até 20 por ocorrência) e, fora do `--dry-run`, o relatório completo em `reports/carga-<data>-<execução>.md`. Nenhum nome, e-mail, CPF ou telefone.
- **Tempo** (stack local, 3 mil membros, 300 células, 30 mil relatórios, 135 mil participantes): 13 s na primeira carga, 9 s ao refazer e 11 s no `--dry-run`, metade disso nas funções de regra do banco (chave do celular, índices e `CHECK`s de `members`, `member_rule_violations`).

### Contas e credenciais (`src/accounts.mjs` e `sql/accounts/*.sql`)

Desenho: DT-14 do spec [`e4-carga`](../docs/specs/e4-carga.md); 6.2 e 6.3 do plano; RN-01, RN-03, RN-09 e RN-16 do E3.

- **Plano** (`10`, sem gravar): elegível é o membro carregado, não excluído, com e-mail, celular ou CPF válido e sem conta. O adotado que já tinha conta fica com ela, sem credencial (RN-16 a); o adotado sem conta recebe a conta como os demais. **Param antes de criar qualquer conta:** uma conta no Auth com o id do membro (ou o e-mail técnico dele) que não é dele, outra conta com o mesmo Id do legado no `app_metadata` (sobra de uma carga anterior: rode a limpeza do ensaio) e um carregado ligado a uma conta que não é a dele.
- **Chave:** conferida antes do plano lendo uma conta que não existe; só o 404 com `user_not_found` vale (outro 404, um 200 ou 401/403 recusam).
- **Contas** pela Admin API do Auth (`POST /auth/v1/admin/users`), até `--concurrency` ao mesmo tempo: `id` = id do membro, e-mail técnico `member_account_email(id)`, `email_confirm`, `app_metadata.legacy_member_id`, **sem senha** (a senha mora só no cofre; o provedor de e-mail desligado não impede a Admin API). Falha passageira (rede, 5xx, 429) é repetida até 2 vezes, sempre conferindo antes se a conta já foi criada. O Auth que não aceita o id pedido tem a conta criada apagada (`id_not_accepted`); se a limpeza falhar, a falha diz `id_not_accepted_cleanup_failed`.
- **Ligação** (`20`): `auth_user_id = id` em `replica` (sem Auditoria), em lotes de 500, só para quem continua elegível e cuja conta é a dele.
- **Credenciais** (`30`): `private.add_legacy_credential(id, md5)` com o MD5 lido direto de `legacy."Members"`, em minúsculas e sem os espaços das pontas (o mesmo critério da carga, `pg_temp.trim_space`: `[[:space:]]` e o NBSP; o plano usa o mesmo), `--batch-size` membros por comando (padrão 50 na stack local, cerca de 3 s, e 25 fora dela), `--concurrency` conexões. O MD5 nunca é parâmetro, não é gravado nas tabelas temporárias do plano e não sai do banco.
- **Tempo de cada lote** (DT-19 do E1.04: o `auto_explain` de produção registra plano e parâmetros de todo comando de 10 s ou mais). Cada lote é medido: passou de 6 s, a execução avisa, lista em `credential_batch_slow` e os lotes seguintes ficam com a metade do tamanho. O teto do comando é 9 s: o que estoura é cancelado (o cancelado não chega ao `auto_explain` e não grava nada), dividido ao meio e refeito; só o lote de 1 que estoura é falha. **O ensaio 1 mede isso em produção:** confira no relatório `counts.credentials.batches` (`max_ms`, `timeouts`, `final_size`) e a lista `credential_batch_slow`; se aparecer, use um `--batch-size` menor nas execuções seguintes. Os limites só podem ser baixados na stack local, para o teste (`ACCOUNTS_TEST_SLOW_MS`, `ACCOUNTS_TEST_TIMEOUT_MS`). Credencial pendente que já confere com o legado não é regravada (`unchanged`); a usada, a descartada e a de quem já tem senha no novo nunca são recriadas (RN-03 do E3). Listas: `credential_unusable_md5` (a lista "sem senha" da 5.4: vazia, MD5 do texto vazio ou fora do formato) e `credential_md5_normalized` (só passou depois da normalização).
- **Excluído durante a execução:** o membro excluído entre a criação da conta e a ligação não é ligado nem recebe credencial; a conta dele fica e é listada (informativo `account_unlinked_deleted_member`, também no plano das execuções seguintes). Como o excluído com conta ligada (PR4-8), só listado: o login busca só cadastros não excluídos.
- **Validação** (`90`): `private.legacy_credential_problems()` vazia e todo elegível com a conta dele ligada.
- **Não é uma transação só** (a Admin API fica fora do banco). Cada passo é idempotente: refazer acha a conta pelo id e pelo Id do legado, religa a que ficou sem ligação e completa as credenciais, sem duplicar. Se uma conta falha, as criadas ficam ligadas e a execução termina com erro antes das credenciais; se um lote de credenciais falha, os outros lotes ficam. Uma trava consultiva por sessão (a mesma da carga) impede contas e carga ao mesmo tempo; antes de tudo, a execução confere que a conexão mantém a sessão (pega e solta uma trava de teste em dois comandos) e recusa um pooler em modo transação.
- **Controle:** `legacy._accounts_runs` (início, fim, situação, commit, contagens e listas de Ids). **Saída:** contagens e Ids do legado no terminal e, fora do `--dry-run`, `reports/contas-<data>-<execução>.md`.
- **Tempo** (stack local, 2.985 contas): contas 92 a 121 s (de 120 a 160 ms por chamada da Admin API, 4 ao mesmo tempo), ligação 3 s, credenciais 43 a 56 s (de 57 a 75 ms por bcrypt, 4 conexões); refazer, 46 s (só a conferência das credenciais). Em produção, some a latência até o Auth em cada chamada.

## Segurança e LGPD

- Os dados incluem convicção religiosa (dado sensível). O schema `legacy` e os relatórios existem só durante a migração: apague o schema com `npm run clean -- --yes` no fim (7.4 do plano) e os arquivos de `reports/` e `dumps/` depois do uso. As duas pastas são ignoradas pelo git.
- Nada desta pasta escreve no legado.
- O relatório é local. Para mandar à liderança, mande só a lista de Ids de cada item, por canal restrito.

## Testes

```bash
npm run test:unit     # sem banco: configuração, guarda de só leitura, tipos e mensagens de erro
npm run test:local    # ponta a ponta, com Docker e uma stack local do Supabase (banco e Auth)
```

O `test:local` (`test/run-local.sh`) sobe um MySQL 8.4 em Docker com o schema do legado (`test/mysql/01-schema.sql`, conforme o snapshot do EF) e uma massa **fictícia** com um caso para cada verificação (`test/mysql/02-fixture.sql`), copia para uma stack local do `mci-connect` (precisa das funções do banco do novo e do `legacy_id` do E4 PR 1) e confere: `--dry-run` sem escrita, cópia, privilégios, checksum, falha no meio e conexão com o legado perdida no meio desfazendo tudo (sem travar), idempotência, o resultado esperado do saneamento (`test/expected-sanitation.json`) e a limpeza.

Na carga (`test/assert-load.mjs`), com cadastros do novo para a adoção: `--dry-run` sem efeito; coincidência ambígua parando a carga; `--final` parando nas pendências e sem Administradores suficientes; a carga esperada (`test/expected-load.json`: ocorrências, contagens e funções, mais as linhas de adoção, liderança, cônjuges, células e relatórios); as quatro listas do banco vazias; refazer sem mudar nenhuma linha; o legado mudado (troca de e-mails, relatório em outra semana, participante a menos, relatório sem tema) aplicado sem esbarrar nos índices; conflito de identificador e de semana com cadastros do novo parando a carga; o `clean` recusando; e o volume (`test/volume/legacy-volume.sql`, com o tempo de cada execução). Nas contas (`test/assert-accounts.mjs`, com o Auth da stack local): `--dry-run` sem efeito e sem dado pessoal na saída; conta de outro dono e Id do legado em outra conta parando antes de criar; o processo morto no meio da criação e o Auth recusando uma conta (as criadas ficam ligadas, nenhuma credencial; refazer religa e completa); as contas esperadas (id do membro, e-mail técnico, Id do legado, sem senha, sem marca), excluídos, sem identificador e adotado com conta sem conta nova; as listas "sem senha" (vazia, MD5 do texto vazio, ilegível, nula) e "só depois da normalização"; o login pela `sign_in_attempt` com a senha cujo MD5 está no legado (inclusive o MD5 maiúsculo com espaços); refazer sem mudar nada (quem já entrou fica com a senha do novo); um lote de credenciais falhando no meio; `legacy_credential_problems()` vazia; a carga refeita sem mexer nas contas; o membro excluído entre a criação da conta e a ligação (listado, sem ligação nem credencial; sem a exclusão, religado); o lote lento (aviso e lotes seguintes menores) e o lote cancelado no teto (dividido até 1); e o volume (2.985 contas, com o tempo). A chave da stack vem de `supabase status` na pasta da pista B (`LANE_DIR`, ou `AUTH_SECRET_KEY`); a falha no Auth é injetada por um trigger em `auth.users`, criado como `supabase_admin` dentro do contêiner do banco (`PG_CONTAINER`). No fim tira a carga e as contas (só no teste), apaga o schema `legacy` e o contêiner. `LOAD_VOLUME=0` pula o volume e `ACCOUNTS=0` pula as contas. Variáveis: `PG_PORT` (padrão 58322, a pista B), `MYSQL_IMAGE` (padrão `mysql:8.4`; use `mirror.gcr.io/library/mysql:8.4` se o Docker Hub limitar) e `MYSQL_PORT` (padrão 53306). Nunca aponte o teste para o Supabase de produção: ele recusa host que não seja local.

## Estrutura

```
data-migration/
  src/copy-raw.mjs            E4.03
  src/sanitation-report.mjs   E4.04 (runner)
  src/clean-legacy.mjs        limpeza do schema legacy
  src/load.mjs                E4.06/E4.07 (runner)
  src/lib/load-codes.mjs      catálogo das ocorrências da carga
  src/accounts.mjs            E4.08 (runner)
  src/lib/account-codes.mjs   catálogo das ocorrências das contas
  src/lib/auth-admin.mjs      Admin API do Auth (criar e ler conta)
  sql/accounts/NN_*.sql       E4.08 (plano, ligação, credenciais e validação)
  sql/load/NN_*.sql           E4.06/E4.07 (transformação, gravação, recálculos e validação)
  src/lib/                    configuração, MySQL (só leitura), Postgres, tipos e checksum
  sql/sanitation-report.sql   E4.04 (verificações)
  test/                       testes unitários e de ponta a ponta (massa fictícia)
  dumps/, reports/            gerados localmente; ignorados pelo git
```
