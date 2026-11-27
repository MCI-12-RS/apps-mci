# data-migration

Ferramentas da migração de dados do legado (`g12app-net`, MySQL) para o Supabase do `mci-connect`. O plano completo está em [`docs/migracao.md`](../docs/migracao.md), seção 5. Esta pasta cobre, por enquanto:

| Passo | Etapa | Comando | Escreve em |
|---|---|---|---|
| E4.01 | Estrutura, configuração e `--dry-run` | — | — |
| E4.03 | Cópia bruta do MySQL para o schema `legacy` | `npm run copy` | schema `legacy` do Supabase |
| E4.04 | Relatório de saneamento | `npm run report` | `data-migration/reports/saneamento-<data>.md` (local) |
| E4.06, E4.07 | Transformação e carga (com as funções da RN-18 do E3) | `npm run load` | `members`, `cells`, `cell_reports`, `cell_report_participants`, `private.member_hierarchy`, `private.cell_active_periods`, `legacy._load_*`; `data-migration/reports/carga-<data>-<n>.md` (local) |
| — | Limpeza do staging | `npm run clean` | apaga o schema `legacy` |

Os próximos passos (limpeza do ensaio, contas, reconciliação: PRs 3 a 5 do spec [`e4-carga`](../docs/specs/e4-carga.md)) vão entrar aqui também.

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
| `SUPABASE_HOST`, `SUPABASE_PORT`, `SUPABASE_DB`, `SUPABASE_USER`, `SUPABASE_PASS` | sim | Session pooler. No pooler, o usuário precisa ser `postgres.gkhnjhmgeceoaqeynhrj`. Fora do pooler, só a conexão direta do mesmo projeto ou a stack local (`127.0.0.1`) são aceitas. |
| `SUPABASE_SSL_CA` | não | Caminho do certificado da CA do Supabase (*Database settings → SSL configuration → Download certificate*). Com ele, o certificado é conferido; sem ele, a conexão é cifrada mas não conferida, e o script avisa. |
| `LEGACY_PASTOR_IDS` | não | Ids do legado dos pastores da D9 (Samuel Colares e Magda Colares), separados por vírgula. Sem eles, o relatório de saneamento lista os dois entre os "sem líder". Também aceita `--pastor-ids`. |
| `LEGACY_ADMIN_IDS` | não (sim no `--final`) | Ids do legado de quem recebe a função Administrador na carga (RN-18 c do E3; a lista é aprovada pelos pastores, Q-6). Também aceita `--admin-ids`. No `--final`, a carga para se ficarem menos de 2 Administradores não excluídos com identificador de login, contando os adotados. |
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

## Segurança e LGPD

- Os dados incluem convicção religiosa (dado sensível). O schema `legacy` e os relatórios existem só durante a migração: apague o schema com `npm run clean -- --yes` no fim (7.4 do plano) e os arquivos de `reports/` e `dumps/` depois do uso. As duas pastas são ignoradas pelo git.
- Nada desta pasta escreve no legado.
- O relatório é local. Para mandar à liderança, mande só a lista de Ids de cada item, por canal restrito.

## Testes

```bash
npm run test:unit     # sem banco: configuração, guarda de só leitura, tipos e mensagens de erro
npm run test:local    # ponta a ponta, com Docker e uma stack local do Supabase
```

O `test:local` (`test/run-local.sh`) sobe um MySQL 8.4 em Docker com o schema do legado (`test/mysql/01-schema.sql`, conforme o snapshot do EF) e uma massa **fictícia** com um caso para cada verificação (`test/mysql/02-fixture.sql`), copia para uma stack local do `mci-connect` (precisa das funções do banco do novo e do `legacy_id` do E4 PR 1) e confere: `--dry-run` sem escrita, cópia, privilégios, checksum, falha no meio e conexão com o legado perdida no meio desfazendo tudo (sem travar), idempotência, o resultado esperado do saneamento (`test/expected-sanitation.json`) e a limpeza.

Na carga (`test/assert-load.mjs`), com cadastros do novo para a adoção: `--dry-run` sem efeito; coincidência ambígua parando a carga; `--final` parando nas pendências e sem Administradores suficientes; a carga esperada (`test/expected-load.json`: ocorrências, contagens e funções, mais as linhas de adoção, liderança, cônjuges, células e relatórios); as quatro listas do banco vazias; refazer sem mudar nenhuma linha; o legado mudado (troca de e-mails, relatório em outra semana, participante a menos, relatório sem tema) aplicado sem esbarrar nos índices; conflito de identificador e de semana com cadastros do novo parando a carga; o `clean` recusando; e o volume (`test/volume/legacy-volume.sql`, com o tempo de cada execução). No fim tira a carga (só no teste), apaga o schema `legacy` e o contêiner. `LOAD_VOLUME=0` pula o volume. Variáveis: `PG_PORT` (padrão 58322, a pista B), `MYSQL_IMAGE` (padrão `mysql:8.4`; use `mirror.gcr.io/library/mysql:8.4` se o Docker Hub limitar) e `MYSQL_PORT` (padrão 53306). Nunca aponte o teste para o Supabase de produção: ele recusa host que não seja local.

## Estrutura

```
data-migration/
  src/copy-raw.mjs            E4.03
  src/sanitation-report.mjs   E4.04 (runner)
  src/clean-legacy.mjs        limpeza do schema legacy
  src/load.mjs                E4.06/E4.07 (runner)
  src/lib/load-codes.mjs      catálogo das ocorrências da carga
  sql/load/NN_*.sql           E4.06/E4.07 (transformação, gravação, recálculos e validação)
  src/lib/                    configuração, MySQL (só leitura), Postgres, tipos e checksum
  sql/sanitation-report.sql   E4.04 (verificações)
  test/                       testes unitários e de ponta a ponta (massa fictícia)
  dumps/, reports/            gerados localmente; ignorados pelo git
```
