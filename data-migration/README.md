# data-migration

Ferramentas da migração de dados do legado (`g12app-net`, MySQL) para o Supabase do `mci-connect`. O plano completo está em [`docs/migracao.md`](../docs/migracao.md), seção 5. Esta pasta cobre, por enquanto:

| Passo | Etapa | Comando | Escreve em |
|---|---|---|---|
| E4.01 | Estrutura, configuração e `--dry-run` | — | — |
| E4.03 | Cópia bruta do MySQL para o schema `legacy` | `npm run copy` | schema `legacy` do Supabase |
| E4.04 | Relatório de saneamento | `npm run report` | `data-migration/reports/saneamento-<data>.md` (local) |
| — | Limpeza do staging | `npm run clean` | apaga o schema `legacy` |

Os próximos passos (E4.06 em diante: transformação e carga, contas, reconciliação) vão entrar aqui também, como `sql/NN_*.sql` e scripts em `src/`.

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

# Limpeza do staging
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

## Segurança e LGPD

- Os dados incluem convicção religiosa (dado sensível). O schema `legacy` e os relatórios existem só durante a migração: apague o schema com `npm run clean -- --yes` no fim (7.4 do plano) e os arquivos de `reports/` e `dumps/` depois do uso. As duas pastas são ignoradas pelo git.
- Nada desta pasta escreve no legado.
- O relatório é local. Para mandar à liderança, mande só a lista de Ids de cada item, por canal restrito.

## Testes

```bash
npm run test:unit     # sem banco: configuração, guarda de só leitura, tipos e mensagens de erro
npm run test:local    # ponta a ponta, com Docker e uma stack local do Supabase
```

O `test:local` (`test/run-local.sh`) sobe um MySQL 8.4 em Docker com o schema do legado (`test/mysql/01-schema.sql`, conforme o snapshot do EF) e uma massa **fictícia** com um caso para cada verificação (`test/mysql/02-fixture.sql`), copia para uma stack local do `mci-connect` (precisa das funções do banco do novo) e confere: `--dry-run` sem escrita, cópia, privilégios, checksum, falha no meio desfazendo tudo, idempotência, o resultado esperado do saneamento (`test/expected-sanitation.json`) e a limpeza. No fim apaga o schema `legacy` e o contêiner. Variáveis: `PG_PORT` (padrão 58322, a pista B), `MYSQL_IMAGE` (padrão `mysql:8.4`; use `mirror.gcr.io/library/mysql:8.4` se o Docker Hub limitar) e `MYSQL_PORT` (padrão 53306). Nunca aponte o teste para o Supabase de produção: ele recusa host que não seja local.

## Estrutura

```
data-migration/
  src/copy-raw.mjs            E4.03
  src/sanitation-report.mjs   E4.04 (runner)
  src/clean-legacy.mjs        limpeza do schema legacy
  src/lib/                    configuração, MySQL (só leitura), Postgres, tipos e checksum
  sql/sanitation-report.sql   E4.04 (verificações)
  test/                       testes unitários e de ponta a ponta (massa fictícia)
  dumps/, reports/            gerados localmente; ignorados pelo git
```
