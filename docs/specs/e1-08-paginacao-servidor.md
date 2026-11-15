# E1.08: Paginação, contagem e máscara de dados sensíveis no servidor

> Status: aprovado em 2026-11-15 (decisões D-1 a D-5 respondidas pelo usuário). Implementação em 5 PRs, começando pelo PR 1.
> Slug: `e1-08-paginacao-servidor` · Paridade com o legado: parcial. É um passo técnico da fase 1 e antecipa a MEM-14 e parte da DSH.

## Negócio
_Seção do `product-owner`. Escrita em versão curta pelo `architect`, a pedido da sessão principal._

### Contexto e objetivo
O PostgREST devolve no máximo 1000 linhas por requisição, e hoje o front carrega tabelas inteiras para filtrar, contar e montar o dashboard. Com os dados reais do legado, listas, totais e cards vão sair errados sem nenhum aviso. Além disso, a regra `view_sensitive_data` só existe na tela: a API devolve CPF, e-mail, telefones e endereço de qualquer membro visível.

Objetivo do passo:
- paginação, busca e contagem no servidor em Membros, Células e Relatórios;
- dashboard e árvore de Ministérios calculados no banco;
- seletores com busca no servidor;
- máscara dos dados sensíveis imposta no banco.

O escopo de visibilidade não muda: cada pessoa continua vendo exatamente o que vê hoje.

### Personas e permissões
| Persona | Permissões relevantes |
|---|---|
| P1 Administrador | role `is_system` (hoje "Administrador"), com `view_members` |
| P2 Igreja toda | `view_all_church` ou `view_members`, sem `view_sensitive_data` |
| P3 Ministério | `view_own_ministry`, com ou sem `view_sensitive_data` |
| P4 Só relatórios | `view_all_reports` ou `view_own_reports`, sem permissão de ver membros |
| P5 Membro básico | nenhuma permissão de leitura: vê só o próprio cadastro |

### Histórias
- Como líder, quero ver e pesquisar todos os membros do meu escopo, com o total certo, mesmo que sejam milhares.
- Como administrador, quero que os números do dashboard batam com a realidade, sem cortes nem dupla contagem.
- Como membro, quero que meu CPF, meu telefone e meu endereço só fiquem visíveis para quem tem autorização.

### Regras de negócio
| ID | Regra | Origem |
|---|---|---|
| RN-01 | **Paginação no servidor** em Membros, Células e Relatórios.<br>- Página padrão de 25 itens; o usuário escolhe 10, 25, 50 ou 100.<br>- A tela mostra o total exato e a página atual.<br>- Mudar a busca ou o tamanho da página volta para a página 1.<br>- Página, tamanho e busca ficam na URL. | E1.08; legado com 10 ou 20 por página e total (`UI/components/Grid`) · D-5 |
| RN-02 | **Nada é cortado.** Listas, totais, cards do dashboard e a árvore consideram todos os registros visíveis, mesmo acima de 1000. | E1.08 |
| RN-03 | **Ordem estável**, com desempate por `id`:<br>- Membros: por nome.<br>- Células: da cadastrada mais recentemente para a mais antiga.<br>- Relatórios: da data mais recente para a mais antiga.<br>Sem mudança nos dados, navegar pelas páginas não repete nem pula registros. | ordem atual do novo |
| RN-04 | **Busca no servidor.**<br>- Ignora maiúsculas e acentos.<br>- Cada palavra digitada precisa aparecer, em qualquer campo pesquisável.<br>- Nenhum caractere quebra o filtro: vírgula, parênteses, `%`, `_` e aspas contam como texto. Só a pontuação nas pontas de cada palavra é ignorada ("(Silva)" busca "silva").<br>- Limite: 100 caracteres e 5 palavras.<br><br>Campos pesquisáveis:<br>- Membros: nome, e-mail e CPF (com ou sem pontuação).<br>- Células: nomes do líder, do timóteo, do anfitrião e dos líderes de cada um, além de rua e bairro.<br>- Relatórios: nome do líder da célula e tema. | busca atual do novo + correção de `Members.tsx` · D-5 |
| RN-05 | **Escopo inalterado.** Os membros, células, relatórios e participantes que cada usuário vê (em listas, totais, seletores, dashboard e árvore) são exatamente os que as políticas de RLS atuais liberam. | RLS atual (E1.13) |
| RN-06 | **Nomes de referência.** Numa linha visível aparecem, mesmo que a pessoa esteja fora do escopo de quem consulta, apenas os nomes de:<br>- o líder do membro;<br>- o líder, o timóteo, o anfitrião e o G12 da célula;<br>- o líder da célula do relatório;<br>- os participantes do relatório. | mesma regra da `member_names` (E1.13) · **D-4** |
| RN-07 | **Seletores com busca e paginação no servidor**, 20 opções por página:<br>- líder e cônjuge: membros visíveis, ativos ou não, exceto o próprio membro;<br>- participantes: membros visíveis e ativos;<br>- célula do relatório: células visíveis e ativas.<br><br>Abertos sem texto, mostram as 20 primeiras opções em ordem alfabética (para células, pelo nome do líder). Havendo mais, a lista carrega as 20 seguintes ao chegar ao fim (rolagem) ou pelo item "Carregar mais", até acabar. Mudar o texto da busca recomeça da primeira página. | seletores atuais; legado com 10 · D-5 |
| RN-08 | **Dashboard calculado no banco**, no escopo do usuário. A semana vai de domingo a sábado, e "hoje" e "agora" seguem o horário de Brasília (`America/Sao_Paulo`), independentemente do relógio do navegador. Os cards e as definições são os atuais, com quatro correções:<br>(a) células de segunda a sexta entram em "Células sem relatório";<br>(b) o ranking G12 conta as células da subárvore uma vez só;<br>(c) "Sem vínculo celular" segue a MEM-14: participação nos últimos **30** dias (hoje são 28), em qualquer célula ou relatório, não só nos visíveis;<br>(d) "Células sem relatório" considera qualquer relatório da célula na semana, visível ou não. | DSH-02, DSH-03, MEM-14, problemas conhecidos · **D-3** |
| RN-09 | **Acesso ao dashboard.** Só quem tem `view_dashboard` ou `view_own_ministry_dashboard` recebe os números. Os demais recebem um erro de permissão, e a tela mostra "Você não tem acesso ao dashboard.". | regra atual do menu (`AppSidebar.tsx`) |
| RN-10 | **Árvore de ministérios sem N+1.**<br>- Abrir um nó faz uma única consulta para todos os filhos, já com as contagens.<br>- Cada nó é um casal, com o homem primeiro.<br>- Só aparecem membros ativos, inclusive o cônjuge exibido.<br>- A contagem do nó é o número de discípulos diretos ativos e visíveis do casal.<br>- As raízes continuam sendo os pastores ativos visíveis. | MIN-01, MIN-03; MIN-02 fica para o E2.15 |
| RN-11 | **Máscara de dados sensíveis.** CPF, e-mail, celular, telefone, rua, número, complemento e CEP de um membro só saem do banco para:<br>(a) o próprio membro;<br>(b) quem tem `view_sensitive_data`, para os membros que já vê.<br><br>Para os demais, esses campos vêm nulos, inclusive em leitura direta da API, e a tela mostra "•••••" ou esconde o campo. Bairro, cidade e UF **não** são sensíveis: saem para todos que veem o membro. | pedido do E1.13 · **D-1, D-2** |
| RN-12 | **Quem não vê, não altera.**<br>- Ao salvar um membro cujos dados sensíveis o usuário não vê, esses campos ficam como estavam, mesmo que a requisição traga outros valores.<br>- No cadastro de um membro novo, quem tem `create_member` preenche todos os campos. | consequência da RN-11 (a tela já esconde esses campos) |
| RN-13 | **A busca não revela dado mascarado.** Quem não vê o CPF ou o e-mail de um membro não o encontra buscando por esses valores. | consequência da RN-11 |
| RN-14 | **O administrador mantém o acesso.** As roles `is_system` passam a ter `view_sensitive_data` no banco, como a tela já considera hoje. | `AuthContext.hasPermission` (atalho de `is_system`) |

### Critérios de aceite
- **RN-01**
  - Dado um usuário P1 e 1.530 membros cadastrados
  - Quando ele abre Membros
  - Então vê 25 linhas, o total "1530" e 62 páginas; na página 62 vê as 5 últimas; ao trocar para 100 por página, volta para a página 1 e vê 16 páginas; ao recarregar a URL, continua na mesma página e com a mesma busca.
- **RN-02**
  - Dado um usuário P1 e 1.200 células ativas
  - Quando ele abre o dashboard e a lista de Células
  - Então o total de células por tipo soma 1.200 e a lista mostra o total 1.200.
- **RN-03**
  - Dado um usuário P1 e 60 membros com o mesmo nome
  - Quando ele percorre as páginas de 25 em 25
  - Então cada membro aparece exatamente uma vez.
- **RN-04**
  - Dado o membro "João da Silva", visível para o usuário
  - Quando ele busca "joao silva", "SILVA joão" ou "João (Silva)"
  - Então "João da Silva" aparece nas três buscas. Uma busca por `a,b)` ou por `%` não gera erro e devolve só os registros que contêm `a,b` ou `%`.
- **RN-05**
  - Dados os usuários P1 a P5 na massa de teste
  - Quando cada um lê as listas, os seletores, o dashboard e a árvore
  - Então os ids devolvidos são exatamente os que a mesma pessoa obtém lendo as tabelas diretamente sob o RLS atual.
- **RN-06**
  - Dado um usuário P3 e uma célula visível cujo anfitrião é de outro ministério
  - Quando ele abre Células
  - Então a linha mostra o nome do anfitrião, mas o cadastro do anfitrião não aparece em Membros.
- **RN-07**
  - Dado um usuário com 300 membros ativos visíveis
  - Quando ele abre o seletor de participantes e digita "ma", e 45 deles combinam com a busca
  - Então vê as 20 primeiras opções; ao rolar até o fim, a lista ganha mais 20 e depois as 5 restantes, sem repetir nenhuma; ao trocar o texto, volta para as 20 primeiras do novo resultado.
- **RN-08**
  - Dada uma célula ativa de segunda-feira às 20:00, sem relatório na semana
  - Quando o dashboard é consultado na segunda às 19:59 e às 20:00 (horário de Brasília)
  - Então "Células sem relatório" não a conta às 19:59 e a conta às 20:00.
  - Dado um casal G12 com 3 células masculinas e 4 femininas na subárvore
  - Quando o ranking é consultado
  - Então mostra 3, 4 e total 7.
  - Dado um sábado às 23:59 e, em seguida, um domingo às 00:00 (horário de Brasília)
  - Quando o card semanal é consultado
  - Então muda de semana exatamente no domingo às 00:00.
- **RN-09**
  - Dado um usuário sem `view_dashboard` e sem `view_own_ministry_dashboard`
  - Quando ele chama `dashboard_summary` pela API
  - Então recebe o erro 42501.
- **RN-10**
  - Dado um casal com 12 discípulos diretos ativos, sendo 2 deles casados entre si
  - Quando o nó é expandido
  - Então o front faz uma única chamada e vê 11 nós, com o homem primeiro em cada casal; um cônjuge inativo não aparece.
- **RN-11**
  - Dado um usuário P2
  - Quando ele faz `GET /rest/v1/members_view?select=cpf,email` ou `GET /rest/v1/members?select=cpf`
  - Então a view devolve `null` nos campos de todos, exceto no próprio cadastro, e a tabela devolve erro de permissão (depois do PR 5).
  - Dado um usuário P3 com `view_sensitive_data`
  - Quando ele lê um membro do seu ministério
  - Então vê o CPF real.
- **RN-12**
  - Dado um usuário com `edit_member` e sem `view_sensitive_data`
  - Quando ele envia um `UPDATE` de um membro trocando nome e CPF
  - Então o nome muda e o CPF continua o mesmo.
  - Dado o próprio membro
  - Quando ele troca o próprio celular
  - Então o celular muda.
- **RN-13**
  - Dado um usuário P2
  - Quando ele busca pelo CPF completo de outro membro
  - Então não encontra ninguém. Buscando pelo próprio CPF, encontra o próprio cadastro.
- **RN-14**
  - Dada a role "Administrador" (`is_system`) sem a linha `view_sensitive_data`
  - Quando a migration do PR 1 roda
  - Então a role passa a ter `view_sensitive_data`, e um administrador vê o CPF de todos.

### Fora de escopo
- Filtros de paridade: MEM-13 (E2.07), CEL-06 (E2.10) e REL-13 (E2.12). O desenho já os acomoda (ver "Pontos de extensão").
- Situação do relatório por célula (CEL-05, E2.09). Este passo só expõe `last_report_date`.
- Cards novos e drill-down do dashboard (DSH-02 e DSH-05, E2.14). Também fica para o E2.14 decidir se células inativas entram nos cards por tipo; hoje entram.
- Raiz da árvore pelo escopo do usuário (MIN-02, E2.15).
- Exclusão lógica (E2.01). O desenho deixa um ponto único por entidade para isso.
- Reescrever as políticas de RLS. Elas continuam como estão; as views espelham o RLS, e os testes de paridade travam divergências.
- Paginação da Auditoria (`Events.tsx`, hoje com `limit(500)`).
- Para o E2.07, com o PO:
  - se célula inativa conta como vínculo celular;
  - a regra extra do legado para "sem vínculo" (`TotalCells = 0`).

### Decisões (respondidas pelo usuário em 2026-11-15)
| # | Pergunta | Decisão |
|---|---|---|
| D-1 | Quem vê os dados sensíveis? Hoje a lista de Membros mostra celular e e-mail também para quem tem `view_own_ministry` (`Members.tsx:39`), enquanto o formulário só os mostra com `view_sensitive_data` (`MemberForm.tsx:70`). | **(a) Só quem tem `view_sensitive_data`, mais o próprio cadastro.** A role que precisar recebe a permissão na tela de Funções. Os líderes de ministério deixam de ver o celular dos discípulos até a role deles ganhar a permissão. |
| D-2 | Bairro, cidade e UF também são sensíveis? | **Não.** A máscara cobre só rua, número, complemento e CEP (além de CPF, e-mail e telefones). Bairro, cidade e UF saem para quem vê o membro, então o filtro por bairro e cidade do E2.07 alcança todos os membros do escopo. |
| D-3 | Aceita as mudanças nos números do dashboard (RN-08, itens a a d)? | **Sim.** Os itens (a) e (b) são bugs conhecidos, e o (c) é a regra MEM-14. |
| D-4 | Mostrar o nome de pessoas fora do escopo nas linhas visíveis (RN-06)? | **Sim**, só o nome, com a mesma regra da `member_names`. |
| D-5 | Padrões de tela: 25 por página (opções 10/25/50/100), seletores com 20 opções e busca por todas as palavras, ignorando acentos. | **Sim, e com paginação também nos seletores**: em vez do limite fixo com o aviso "refine a busca", os seletores carregam 20 opções por vez, até o fim do resultado (RN-07). |

## Solução técnica
_Seção do `architect`._

### Visão geral
Três camadas no banco. O front lê **somente** delas.

1. **Escopo de quem consulta** (funções sem parâmetro de usuário, sempre `auth.uid()`):
   - `viewer_member_id()`;
   - `viewer_has(permission)`;
   - `viewer_ministry_member_ids()`: o equivalente, em conjunto, de `is_in_same_ministry(auth.uid(), x)`, calculado **uma vez por consulta**, sem loop por linha.
2. **Views de leitura**, uma por entidade: `members_view`, `cells_view`, `cell_reports_view` e `cell_report_participants_view`.
   - São *security definer* com `security_barrier`.
   - O `WHERE` de cada uma é o **espelho exato** da política de SELECT da tabela.
   - Fazem os *joins* de nomes, as colunas derivadas, a coluna de busca e a máscara.
   - Cada view é o **ponto único** da sua entidade para escopo, máscara, exclusão lógica (E2.01) e a futura flag de consolidado.
3. **RPCs de agregação e árvore**: `dashboard_summary`, `dashboard_cells_by_type`, `dashboard_g12_ranking` e `ministry_tree_nodes`.
   - São `SECURITY INVOKER` e leem **só das views**, então herdam o escopo e a máscara sem replicar nada.

As listas usam o PostgREST sobre as views, com `.range()`, `count: 'exact'` e filtros simples. A tabela `members` é travada por privilégio de coluna no último PR, para que a máscara não possa ser contornada.

### Escolha para impor `view_sensitive_data`
| Caminho | Impõe no banco? | Efeito em `select('*')` | Desempenho e paginação | Veredito |
|---|---|---|---|---|
| View `security_invoker` com CASE | Não sozinha: a tabela continua legível. Para fechar, é preciso revogar as colunas, e aí a view (que roda como quem chama) também não lê o CPF, nem para quem pode ver. | quebra se revogar | RLS por linha, lento | Descartada |
| **View definer com o predicado do RLS replicado** | Sim, junto com a trava de colunas na tabela | o front deixa de ler a tabela | escopo calculado uma vez por consulta; filtros, `range` e `count` do PostgREST | **Escolhida** |
| Privilégios de coluna | Sim, mas é tudo ou nada por papel: não libera "o próprio cadastro" nem quem tem `view_sensitive_data` | quebra `select=*` | — | Usada só como **trava**, complementando a view |
| RPCs | Sim | o front deixa de ler a tabela | paginação dentro da função ou materialização total; perde os filtros do PostgREST; tipos de retorno imprecisos | Usadas só para agregados e árvore |

Sobre `select('*')`: todas as leituras de `members` no front passam para `members_view` (PRs 1 a 4). Só depois disso o PR 5 revoga o SELECT das colunas sensíveis da tabela. A ordem de deploy está em "Implantação".

### Achados da revisão (regras e código atuais)
1. **Inconsistência na tela** sobre quem vê dados sensíveis (lista × formulário). Resolvida pela D-1 (a): as duas telas seguem `sensitive_visible`.
2. **A role Administrador semeada pelas migrations não tem `view_sensitive_data`** (nem `view_all_church`) em `role_permissions`. Quem esconde isso é o atalho `is_system` do `AuthContext`, que o banco não conhece. Num banco montado do zero, a máscara tiraria os dados do administrador; por isso há o backfill da RN-14.
   - *Conferido em produção (2026-11-15):* lá o Administrador já tem as 24 permissões, concedidas à mão ao criar a primeira conta. O backfill não muda nada em produção, mas garante o mesmo resultado num banco novo.
3. **`view_own_reports` não tem efeito além da própria célula.** A política de SELECT de `cell_reports` consulta `cells` dentro de um `EXISTS`, e essa subconsulta passa pelo RLS de `cells`. Quem tem só `view_own_reports` não enxerga as células do ministério, então o ramo nunca é verdadeiro.
   - A `cell_reports_view` espelha o comportamento **efetivo**, porque a RN-05 pede escopo inalterado.
   - A correção fica para o E2.02 (AUT-03).
4. **O `MemberForm` grava a linha inteira** (`setForm({ ...member })` seguido de `update(cleanData)`). Lendo de uma view mascarada, isso apagaria CPF, e-mail e endereço, e as colunas que só existem na view quebrariam o `update`. A correção tem duas partes:
   - payload com lista branca no front;
   - a regra 6 no trigger `aa_enforce_member_write_rules` (RN-12).
5. **Os embeds de `members` em Células e Relatórios** dependem do RLS de `members`. Por isso, o nome do anfitrião ou do timóteo de fora do escopo aparece em branco, e um usuário P4 vê "Célula sem líder". As views resolvem isso; ver a D-4.
6. **De passagem:** o `MemberForm` grava `''` em `cpf` e em `birth_date`, que é do tipo `date`. Limpar a data dá erro. O CPF não tem mais `UNIQUE` (a restrição caiu em `20260326022810`; conferido em produção), mas a MEM-05 vai torná-lo único, e aí `''` repetido passaria a falhar. O payload novo converte strings vazias em `null`.

### Modelo de dados e migrations
Este passo não cria tabelas nem colunas. Cria funções, views, índices e grants, faz um backfill de permissão e altera uma função de trigger. Os nomes de arquivo abaixo são sugestões; o timestamp é o do momento da criação, sempre depois de `20261115000000`. Depois de cada migration, regenere o `types.ts`.

#### PR 1: `<ts>_e108_read_foundation.sql`

**1. Extensão e utilitários de data.** Ficam num lugar só e serão reaproveitados por E2.09 e E2.11.
```sql
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

-- Horário de Brasília; semana de domingo a sábado.
CREATE OR REPLACE FUNCTION public.sp_now() RETURNS timestamp
LANGUAGE sql STABLE SET search_path = public
AS $$ SELECT now() AT TIME ZONE 'America/Sao_Paulo' $$;

CREATE OR REPLACE FUNCTION public.sp_today() RETURNS date
LANGUAGE sql STABLE SET search_path = public
AS $$ SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date $$;

CREATE OR REPLACE FUNCTION public.week_start(_day date) RETURNS date
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$ SELECT _day - extract(dow FROM _day)::int $$;

-- 'Domingo' = 0 … 'Sábado' = 6; valor desconhecido = NULL. Espelho de src/lib/cells/weekdays.ts.
CREATE OR REPLACE FUNCTION public.weekday_index(_meeting_day text) RETURNS integer
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$ SELECT array_position(
  ARRAY['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'], _meeting_day) - 1 $$;
```

**2. Escopo de quem consulta** (`SECURITY DEFINER`, para não recursar no RLS). Nenhuma função recebe `_user_id`.
```sql
CREATE OR REPLACE FUNCTION public.viewer_member_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id FROM public.members m
   WHERE m.auth_user_id = auth.uid()
  -- E2.01 (DEL-06): AND m.deleted_at IS NULL
$$;

CREATE OR REPLACE FUNCTION public.viewer_has(_permission public.permission_action) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND public.user_has_permission(auth.uid(), _permission)
$$;

-- Equivalente em conjunto de is_in_same_ministry(auth.uid(), x): devolve todos os x
-- para os quais a função devolveria true. Mesma semântica, inclusive com g12_level
-- desatualizado: a descida para em nível 0 ou 1 e em 20 saltos, como get_ministry_root.
-- E2.02 (AUT-03) muda o escopo AQUI.
CREATE OR REPLACE FUNCTION public.viewer_ministry_member_ids() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE
  me AS (SELECT public.viewer_member_id() AS id),
  root AS (
    SELECT r.id, r.spouse_id
      FROM me JOIN public.members r ON r.id = public.get_ministry_root(me.id)
  ),
  anchors AS (   -- quem pode ser devolvido por get_ministry_root para um alvo visível
    SELECT id FROM root
    UNION SELECT spouse_id FROM root WHERE spouse_id IS NOT NULL
    UNION SELECT x.id FROM root JOIN public.members x ON x.spouse_id = root.id
  ),
  tree AS (
    SELECT a.id, 0 AS depth
      FROM anchors a JOIN public.members m ON m.id = a.id AND m.g12_level = 1
    UNION ALL
    SELECT c.id, t.depth + 1
      FROM tree t JOIN public.members c ON c.leader_id = t.id
     WHERE c.g12_level NOT IN (0, 1) AND t.depth < 20
  )
  SELECT id FROM me WHERE id IS NOT NULL
  UNION SELECT id FROM root
  UNION SELECT spouse_id FROM root WHERE spouse_id IS NOT NULL
  UNION SELECT id FROM tree
$$;
```
Grants: `REVOKE EXECUTE … FROM PUBLIC, anon; GRANT EXECUTE … TO authenticated` nas seis funções acima (lição do E1.13).

**3. `members_view`.**
```sql
CREATE OR REPLACE VIEW public.members_view
WITH (security_barrier = true, security_invoker = false) AS
SELECT
  m.id, m.name, m.gender, m.birth_date, m.instagram, m.avatar_url, m.notes,
  m.neighborhood, m.city, m.state,   -- não sensíveis (D-2)
  m.is_pastor, m.has_leadership, m.leader_id, l.name AS leader_name, m.spouse_id,
  m.is_baptized, m.baptism_date, m.is_active, m.g12_level,
  m.total_disciples, m.total_cells, m.male_cells, m.female_cells,
  m.role_id, m.auth_user_id, m.created_at, m.updated_at,
  s.sensitive_visible,
  -- Dados sensíveis (RN-11). A lista é espelhada em src/lib/members/fields.ts,
  -- na regra 6 do trigger e no GRANT do PR 5.
  CASE WHEN s.sensitive_visible THEN m.email           END AS email,
  CASE WHEN s.sensitive_visible THEN m.cpf             END AS cpf,
  CASE WHEN s.sensitive_visible THEN m.mobile_whatsapp END AS mobile_whatsapp,
  CASE WHEN s.sensitive_visible THEN m.phone           END AS phone,
  CASE WHEN s.sensitive_visible THEN m.street          END AS street,
  CASE WHEN s.sensitive_visible THEN m.number          END AS number,
  CASE WHEN s.sensitive_visible THEN m.complement      END AS complement,
  CASE WHEN s.sensitive_visible THEN m.zip_code        END AS zip_code,
  -- Vínculo celular (MEM-14), calculado sobre todas as células e relatórios
  -- (E2.01: só os não excluídos)
  EXISTS (SELECT 1 FROM public.cells c WHERE c.leader_id  = m.id) AS is_cell_leader,
  EXISTS (SELECT 1 FROM public.cells c WHERE c.timothy_id = m.id) AS is_cell_timothy,
  EXISTS (SELECT 1 FROM public.cells c WHERE c.host_id    = m.id) AS is_cell_host,
  m.id IN (SELECT p.member_id
             FROM public.cell_report_participants p
             JOIN public.cell_reports r ON r.id = p.report_id
            WHERE r.date >= public.sp_today() - 30) AS attended_last_30_days,
  -- Busca (RN-04, RN-13): só valores já mascarados
  extensions.unaccent(concat_ws(' ', m.name,
    CASE WHEN s.sensitive_visible THEN m.email END,
    CASE WHEN s.sensitive_visible THEN m.cpf END)) AS search_text
FROM public.members m
LEFT JOIN public.members l ON l.id = m.leader_id
CROSS JOIN LATERAL (
  SELECT COALESCE(m.auth_user_id = (SELECT auth.uid()), false)
      OR (SELECT public.viewer_has('view_sensitive_data')) AS sensitive_visible
) s
WHERE (   -- espelho exato da política "Members view policy" (E1.13)
     (SELECT public.viewer_has('view_all_church'))
  OR (SELECT public.viewer_has('view_members'))
  OR ((SELECT public.viewer_has('view_own_ministry'))
      AND m.id IN (SELECT public.viewer_ministry_member_ids()))
  OR m.auth_user_id = (SELECT auth.uid())
);
-- E2.01: AND m.deleted_at IS NULL (fora dos parênteses)
-- Consolidação: o filtro ou a coluna do consolidado entra aqui
```
Por que esse formato:
- As subconsultas `(SELECT …)` sem correlação viram *InitPlan*: as permissões são avaliadas uma vez por consulta, não por linha.
- O `IN (SELECT viewer_ministry_member_ids())` vira um *hashed SubPlan*, montado uma vez e só se o `OR` chegar até ele.
- O `security_barrier` impede que filtros não *leakproof* enviados pelo cliente rodem antes do filtro de escopo.

**4. Grants das views** (vale para todas as views deste passo):
```sql
REVOKE ALL ON public.members_view FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.members_view TO authenticated;
```
- As views precisam continuar com o dono `postgres`, para ignorar o RLS das tabelas.
- O `REVOKE` de INSERT, UPDATE e DELETE é obrigatório. Uma view definer atualizável executaria a escrita como o dono, passando por cima do RLS.

**5. Regra 6 no trigger de escrita.** `CREATE OR REPLACE FUNCTION public.enforce_member_write_rules()` repete todo o corpo do E1.03 e acrescenta o bloco abaixo, depois da regra 5:
```sql
  -- 6. Dados sensíveis: quem não os vê não os altera (E1.08, RN-12).
  IF TG_OP = 'UPDATE'
     AND OLD.auth_user_id IS DISTINCT FROM _uid
     AND NOT public.viewer_has('view_sensitive_data'::permission_action) THEN
    NEW.email := OLD.email;               NEW.cpf := OLD.cpf;
    NEW.mobile_whatsapp := OLD.mobile_whatsapp; NEW.phone := OLD.phone;
    NEW.street := OLD.street;             NEW.number := OLD.number;
    NEW.complement := OLD.complement;     NEW.zip_code := OLD.zip_code;
  END IF;
```
O valor enviado é ignorado em silêncio, sem erro, como já acontece com as colunas calculadas (regra 3). Assim, um cliente que envia a linha inteira não apaga nada. O INSERT não é afetado.

**6. Backfill (RN-14):**
```sql
INSERT INTO public.role_permissions (role_id, permission)
SELECT r.id, 'view_sensitive_data'::public.permission_action
  FROM public.roles r WHERE r.is_system
ON CONFLICT (role_id, permission) DO NOTHING;
```

**7. Índices:**
```sql
CREATE INDEX IF NOT EXISTS members_leader_id_idx ON public.members (leader_id);
CREATE INDEX IF NOT EXISTS members_spouse_id_idx ON public.members (spouse_id);
CREATE INDEX IF NOT EXISTS members_name_id_idx   ON public.members (name, id);
-- Usados pelo vínculo celular da members_view (vieram do PR 2 para o PR 1):
CREATE INDEX IF NOT EXISTS cells_leader_id_idx  ON public.cells (leader_id);
CREATE INDEX IF NOT EXISTS cells_timothy_id_idx ON public.cells (timothy_id);
CREATE INDEX IF NOT EXISTS cells_host_id_idx    ON public.cells (host_id);
CREATE INDEX IF NOT EXISTS cell_reports_date_id_idx ON public.cell_reports (date DESC, id);
```
Hoje as tabelas são pequenas, então `CREATE INDEX` sem `CONCURRENTLY` não trava nada de forma perceptível.

#### PR 2: `<ts>_e108_cells_reports_views.sql`

**`cells_view`:**
- Colunas da tabela, mais:
  - `meeting_weekday` (`weekday_index`);
  - `leader_name`, `leader_gender`, `leader_g12_level`;
  - `timothy_name`, `host_name`;
  - `g12_leader_id` e `g12_leader_name` (`get_ministry_root(c.leader_id)`, avaliado por célula e só quando a coluna é usada);
  - `last_report_date` (`max(date)` dos relatórios da célula, sem passar pelo escopo; serve de base para o E2.09);
  - `search_text` (`unaccent` dos nomes do líder, do timóteo, do anfitrião, dos líderes de cada um, da rua e do bairro).
- Na tela, quando `g12_leader_name` é nulo, mostra "Pastores" se `leader_g12_level = 0` e "—" nos demais casos, como faz a `findG12` atual.
- `WHERE` (espelho de "Cells view policy"):
```sql
WHERE (
     (SELECT public.viewer_has('view_all_church'))
  OR (SELECT public.viewer_has('view_members'))
  OR ((SELECT public.viewer_has('view_own_ministry')) AND (
         c.leader_id  IN (SELECT public.viewer_ministry_member_ids())
      OR c.timothy_id IN (SELECT public.viewer_ministry_member_ids())
      OR c.host_id    IN (SELECT public.viewer_ministry_member_ids())))
  OR c.leader_id  = (SELECT public.viewer_member_id())
  OR c.timothy_id = (SELECT public.viewer_member_id())
);
-- E2.01: AND c.deleted_at IS NULL
```

**`cell_reports_view`:**
- Colunas da tabela, mais:
  - `week_start`;
  - `visitors_count` (`coalesce(cardinality(visitors), 0)`);
  - `participants_count` (subconsulta pela PK);
  - dados da célula: `cell_type`, `cell_is_active`, `cell_leader_id`, `cell_leader_name`, `cell_timothy_id`, `cell_host_id`, `cell_street`, `cell_number`, `cell_complement`, `cell_neighborhood`, `cell_meeting_day` e `cell_meeting_time`;
  - `search_text` (`unaccent` do nome do líder e do tema).
- O *join* é com `public.cells`, a tabela, e não com `cells_view`: o relatório de uma célula excluída continua no histórico (DEL-07).
- `WHERE`, espelho do comportamento **efetivo** de "Cell reports view policy" (achado 3):
```sql
WHERE (
     (SELECT public.viewer_has('view_all_reports'))
  OR (SELECT public.viewer_has('view_all_church'))
  OR (SELECT public.viewer_has('view_members'))
  OR c.leader_id  = (SELECT public.viewer_member_id())
  OR c.timothy_id = (SELECT public.viewer_member_id())
  OR ((SELECT public.viewer_has('view_own_ministry')) AND (
         c.leader_id  IN (SELECT public.viewer_ministry_member_ids())
      OR c.timothy_id IN (SELECT public.viewer_ministry_member_ids())))
);
-- E2.01: AND r.deleted_at IS NULL
-- E2.11/E4.02: exibir o snapshot do relatório (REL-09) em vez dos dados atuais da célula
```

**`cell_report_participants_view`:**
- Colunas: `report_id`, `member_id`, `member_name`.
- Vem de `cell_report_participants JOIN cell_reports_view JOIN members`, então herda o escopo do relatório.
- E2.01: membros excluídos **não** são filtrados aqui, porque é histórico (só o nome).

**Índices:**
```sql
-- cells(leader_id|timothy_id|host_id) e cell_reports(date DESC, id) já vêm do PR 1.
CREATE INDEX IF NOT EXISTS cell_reports_cell_id_date_idx ON public.cell_reports (cell_id, date DESC);
CREATE INDEX IF NOT EXISTS cell_report_participants_member_id_idx ON public.cell_report_participants (member_id);
-- (report_id, member_id) já é a PK. E2.01 troca por índices parciais WHERE deleted_at IS NULL onde couber.
```
Grants iguais aos da `members_view`.

#### PR 3: `<ts>_e108_dashboard_rpcs.sql`

As três funções são `STABLE SECURITY INVOKER SET search_path = public`, leem só das views e começam com a checagem da RN-09:
```sql
IF NOT (public.viewer_has('view_dashboard') OR public.viewer_has('view_own_ministry_dashboard')) THEN
  RAISE EXCEPTION 'Você não tem permissão para ver o dashboard.' USING ERRCODE = '42501';
END IF;
```

**`dashboard_summary(_at timestamptz DEFAULT now())`** devolve uma linha só. O `_at` existe para os testes e para uma futura navegação por semana; ele só muda a semana considerada.
```sql
RETURNS TABLE (
  week_start date, week_end date,
  reports_sent bigint, cells_pending bigint, visitors bigint, cells_not_held bigint,
  members_total bigint, members_active bigint, members_inactive bigint,
  members_baptized bigint, members_not_baptized bigint,
  members_without_leader bigint, members_without_cell_link bigint
)
```
Definições, com `_local = _at AT TIME ZONE 'America/Sao_Paulo'`, `_ws = week_start(_local::date)` e `_we = _ws + 6`:
- `reports_sent`, `visitors` e `cells_not_held`: sobre `cell_reports_view`, com `date BETWEEN _ws AND _we`. São, respectivamente, o total de relatórios, a soma de `visitors_count` e o total com `NOT was_held`.
- `cells_pending` (RN-08a, RN-08d): `cells_view` com `is_active`, `meeting_weekday IS NOT NULL`, `(_ws + meeting_weekday) + coalesce(meeting_time, '23:59:59') <= _local` e `coalesce(last_report_date, '-infinity') < _ws`. O E2.09 troca isso pela situação CEL-05.
- Membros, sobre `members_view`:
  - `members_total`, `members_active` e `members_inactive`;
  - `members_baptized` e `members_not_baptized`: contados entre todos, ativos e inativos, como hoje;
  - `members_without_leader`: `is_active AND NOT is_pastor AND leader_id IS NULL`;
  - `members_without_cell_link` (RN-08c): `is_active AND NOT is_pastor AND NOT (is_cell_leader OR is_cell_timothy OR is_cell_host OR attended_last_30_days)`.

**`dashboard_cells_by_type()`** devolve `TABLE (cell_type text, total bigint)` sobre `cells_view`, considerando todas as células visíveis, como hoje.

**`dashboard_g12_ranking()`** devolve `TABLE (couple_key text, name text, spouse_name text, male_cells bigint, female_cells bigint, total_cells bigint)` (RN-08b).
- Base: os membros de `members_view` com `g12_level = 1` e `is_active`.
- Casal: a chave é `least(id, spouse_id) || '|' || greatest(id, spouse_id)`, ou só o `id` quando não há cônjuge.
- Nome: o homem primeiro. O cônjuge só é nomeado se estiver visível e ativo.
- Células: a soma de `male_cells` e de `female_cells` dos integrantes de nível 1 do casal. Esses valores já acumulam a subárvore, então não há dupla contagem.
- Ordem: `total_cells DESC`, depois `name`.

#### PR 4: `<ts>_e108_ministry_tree.sql`

**`ministry_tree_nodes(_parent_ids uuid[] DEFAULT NULL)`**: `LANGUAGE sql STABLE SECURITY INVOKER`, lendo só de `members_view`.
```sql
RETURNS TABLE (
  member_id uuid, member_name text, member_gender text, g12_level integer, is_pastor boolean,
  spouse_id uuid, spouse_name text,
  direct_disciples bigint, total_disciples integer, total_cells integer
)
```
- Candidatos: membros ativos.
  - Com `_parent_ids` nulo: `is_pastor` (raízes). O E2.15 (MIN-02) troca só este ramo.
  - Senão: `leader_id = ANY(_parent_ids)`.
  - Com `cardinality(_parent_ids) > 100`, levanta o erro 22023.
- Pareamento: o cônjuge entra se estiver em `members_view` e ativo (MIN-03).
  - Um casal aparece uma vez só (`DISTINCT ON` pela chave do casal).
  - O integrante principal é o de `gender = 'M'`; sem homem no casal, é o próprio candidato.
- `direct_disciples`: uma única agregação `count(*) … GROUP BY leader_id` em `members_view` (ativos, `leader_id = ANY(ids dos nós)`), somando os dois cônjuges. Sem N+1.
- `total_disciples` e `total_cells`: a soma dos totais guardados dos dois cônjuges. Os nós da árvore são subárvores disjuntas.
- Ordem: pelo nome do integrante principal.

#### PR 5: `<ts>_e108_members_column_lock.sql` (só backend)
```sql
REVOKE SELECT ON TABLE public.members FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, name, gender, birth_date, instagram, avatar_url, notes,
              neighborhood, city, state, is_pastor, has_leadership, leader_id, spouse_id, is_baptized, baptism_date,
              is_active, g12_level, total_disciples, total_cells, male_cells, female_cells,
              role_id, auth_user_id, created_at, updated_at)
  ON public.members TO authenticated;
```
- INSERT, UPDATE e DELETE continuam no nível da tabela. O `UPDATE … WHERE id = …` e o `DELETE … WHERE id = …` só precisam de SELECT em `id`, que continua liberado.
- Funções e triggers `SECURITY DEFINER`, a service role e as views não são afetados.
- Na mesma PR, a `create-user-admin` passa a reler só o `id` do membro criado, em vez de `select('*')`, que devolvia a linha inteira a quem cadastrou.

### Pontos de extensão (para não refazer)
| Passo | O que muda e onde |
|---|---|
| E2.01 (exclusão lógica) | Um `AND <alias>.deleted_at IS NULL` no `WHERE` de cada view, fora dos parênteses do escopo. O vínculo celular e o `last_report_date` também ignoram excluídos. `viewer_member_id` ignora membros excluídos (DEL-06). Os participantes continuam mostrando o nome de membros excluídos. |
| E2.02 (escopo, AUT-03) | `viewer_ministry_member_ids()` e os `WHERE` das views, junto com as políticas de RLS. Os testes de paridade (RN-05) apontam qualquer divergência. Recomendação: no E2.02, fazer as políticas de SELECT delegarem às views (`id IN (SELECT id FROM <view>)`), para que o escopo fique num lugar só. |
| E2.06 (HIE-02/03) | Materializar o caminho da liderança (`ancestor_ids uuid[]` com GIN, ou o G12 em coluna). As views trocam o cálculo de `g12_leader_*` e ganham a coluna para o filtro "liderança em qualquer nível", sem mudar o contrato. |
| E2.07 (MEM-13/14) | Os filtros viram `.eq`, `.gte` e `.contains` sobre colunas que já existem: `neighborhood`, `city`, `is_active`, `has_leadership`, `is_baptized`, `g12_level`, os quatro flags de vínculo e `created_at`. "Liderança em qualquer nível" usa a coluna do E2.06. |
| E2.09 (CEL-05) | Nova coluna `report_status` em `cells_view`, calculada a partir de `last_report_date`, `meeting_weekday` e `meeting_time`, com `sp_now()`. O `dashboard_summary.cells_pending` passa a usar essa coluna. |
| E2.10 / E2.12 | Os filtros de célula e de relatório usam as colunas das views. O G12 nos relatórios depende do E2.06; calcular por linha em 100 mil relatórios é caro. Os atalhos de semana filtram por intervalo de `date`, que tem índice, e não por `week_start`. |
| E2.14 (DSH) | Cards novos entram em `dashboard_summary`, com colunas acrescentadas no fim. O drill-down abre as listas com os filtros na URL, que já está pronta para isso (RN-01). |
| E2.15 (MIN-02) | Só muda o ramo de raízes de `ministry_tree_nodes`. |
| Consolidação | A flag entra em `members_view`, que é o ponto único, e por consequência em todas as RPCs. |

### Onde cada regra é imposta
| RN | Banco (constraint, RLS, trigger, RPC) | UI |
|---|---|---|
| RN-01 | `range` + `count=exact` do PostgREST sobre as views. Com página de no máximo 100, o corte de 1000 nunca é atingido. | `ListPagination`; os hooks limitam o tamanho; estado na URL |
| RN-02 | Views e RPCs agregam no servidor | Nenhuma agregação no cliente |
| RN-03 | Índices `(name, id)` e `(date DESC, id)` | Os hooks ordenam sempre com o `id` como desempate |
| RN-04 | Coluna `search_text`, com `unaccent` e valores já mascarados | `src/lib/search.ts`: normaliza, escapa `\ % _`, remove `*`, divide em palavras e tira a pontuação de termos numéricos |
| RN-05 | O `WHERE` de cada view espelha a política de SELECT; as RPCs leem só das views | — |
| RN-06 | *Joins* de nome nas views (só o `name`) | Exibe |
| RN-07 | Views + `range` de 21 linhas por página (a 21ª só indica que há mais) | Hooks de opções com `useInfiniteQuery`; carregar mais ao rolar até o fim |
| RN-08 | `dashboard_*`, `sp_now`, `week_start`, `weekday_index`, `cells_view.last_report_date` e os flags de vínculo da `members_view` | Exibe; o rótulo da semana vem da RPC |
| RN-09 | Checagem em `dashboard_*` (42501) | Mensagem de acesso negado |
| RN-10 | `ministry_tree_nodes` | `Ministries.tsx`, uma chamada por expansão |
| RN-11 | CASE em `members_view` + GRANT por coluna em `members` (PR 5) | Usa `sensitive_visible`, e não `hasPermission` |
| RN-12 | Regra 6 em `enforce_member_write_rules` | Payload sem os campos que o usuário não vê |
| RN-13 | `search_text` montado só com valores mascarados | — |
| RN-14 | Backfill na migration do PR 1 | — |

### Contratos
**Views** (todas só com SELECT para `authenticated`; `anon` sem acesso):
| View | Colunas além das da tabela | Ordem padrão (no hook) |
|---|---|---|
| `members_view` | `leader_name`, `sensitive_visible`, `is_cell_leader`, `is_cell_timothy`, `is_cell_host`, `attended_last_30_days`, `search_text`. As 8 colunas sensíveis vêm mascaradas. | `name, id` |
| `cells_view` | `meeting_weekday`, `leader_name`, `leader_gender`, `leader_g12_level`, `timothy_name`, `host_name`, `g12_leader_id`, `g12_leader_name`, `last_report_date`, `search_text` | `created_at DESC, id` |
| `cell_reports_view` | `week_start`, `visitors_count`, `participants_count`, `cell_*` (tipo, ativa, líder e nome do líder, timóteo, anfitrião, endereço, dia e horário), `search_text` | `date DESC, time DESC, id` |
| `cell_report_participants_view` | `report_id`, `member_id`, `member_name` | `member_name` |

**RPCs:**
- `dashboard_summary(_at timestamptz DEFAULT now())`
- `dashboard_cells_by_type()`
- `dashboard_g12_ranking()`
- `ministry_tree_nodes(_parent_ids uuid[] DEFAULT NULL)`

Todas com EXECUTE só para `authenticated`. As assinaturas estão acima.

**Front** (`mci-connect/src`):
- Tipos: o front usa direto o `types.ts` gerado. O gerador declara toda coluna de view como anulável, mas o projeto compila com `strictNullChecks: false`, então isso não atrapalha. *Decidido na implementação do PR 1:* sem `type-fest` nem `database.ts`; se o modo estrito for ligado um dia, criar o `database.ts` com as colunas não nulas.
- `lib/pagination.ts`: `PAGE_SIZES = [10, 25, 50, 100]`, `DEFAULT_PAGE_SIZE = 25`, `toRange(page, size)` e `lastPage(total, size)`.
- `lib/search.ts`: `toSearchPatterns(input): string[]`, com os padrões `%termo%` já escapados, até 5 palavras.
- `lib/members/fields.ts`:
  - `SENSITIVE_MEMBER_FIELDS`, `PERSONAL_MEMBER_FIELDS` e `MINISTRY_MEMBER_FIELDS`;
  - `toMemberWritePayload(form, { sensitiveVisible, canEditMinistry })`: lista branca, com strings vazias convertidas em `null`.
- `lib/cells/weekdays.ts`: `WEEKDAYS`, de 'Domingo' a 'Sábado', com o índice. Substitui `DAYS_OF_WEEK`, `DAYS_MAP` e `WEEK_DAYS_MAP`.
- `lib/selectors.ts`: `OPTIONS_PAGE_SIZE = 20`. Cada página pede 21 linhas para saber se há mais; a 21ª não é exibida.
- Hooks:
  - listas: `use-members-list.ts`, `use-cells-list.ts` e `use-cell-reports-list.ts`, todos com `{ page, pageSize, search }` e retorno `{ rows, total }`, usando `placeholderData: keepPreviousData`;
  - seletores: `use-member-options.ts` e `use-cell-options.ts`;
  - `use-dashboard.ts`, `use-ministry-tree.ts` e `use-debounced-value.ts` (300 ms).
- Componente `components/ListPagination.tsx`, sobre o `ui/pagination.tsx`: total, página X de Y e tamanho da página.
- As chaves de query começam pela entidade (`["members", "list", params]`), para que o `invalidateQueries({ queryKey: ["members"] })` que já existe continue funcionando.

### Como cada tela passa a buscar dados
| Tela ou componente | Hoje | Depois |
|---|---|---|
| `Members.tsx` | `members.select('*')` inteiro, `.or()` com o texto interpolado, `member_names` para os líderes | `members_view` paginada, com contagem, um `.ilike('search_text', …)` por palavra e `leader_name` da própria view |
| `MemberForm.tsx` | Recebe a linha da tabela e grava a linha inteira | Recebe a linha da `members_view`. Grava `toMemberWritePayload`. Mostra ou esconde os campos sensíveis por `sensitive_visible`. |
| `AuthContext.tsx` | `members.select('*')` do próprio usuário | `members_view` com `.eq('auth_user_id', uid)`; o próprio cadastro vem sem máscara |
| `Cells.tsx` | Carrega todos os membros (para calcular o G12), todas as células com *embeds* e filtra no cliente | `cells_view` paginada; nomes e G12 vêm da view |
| `CellForm.tsx` | Lê o endereço do anfitrião em `members` | Lê o endereço em `members_view`. Se `sensitive_visible` for falso, preenche só bairro, cidade e UF e avisa "Rua, número e CEP do anfitrião indisponíveis". |
| `CellReports.tsx` | Todos os relatórios, com *embeds* e `count` | `cell_reports_view` paginada |
| `CellReportForm.tsx` | Todas as células ativas e todos os membros ativos; participantes lidos da tabela | Seletores com `cells_view` e `members_view`, com busca e paginação de 20 em 20. Ao editar, os participantes (com nome) vêm de `cell_report_participants_view`. A gravação continua igual (E2.11). |
| `AsyncMemberSelect.tsx` | `members` com `ilike` em `name`, limite de 20 | `members_view` com `search_text`, paginada de 20 em 20 ao rolar. Continua usando `member_names` para o valor selecionado. |
| `Dashboard.tsx` | Cerca de 12 consultas e cargas completas | `dashboard_summary`, `dashboard_cells_by_type` e `dashboard_g12_ranking` |
| `Ministries.tsx` | `select('*')` + uma contagem por nó (N+1) | `ministry_tree_nodes`, uma chamada por expansão |

### Implantação (ordem de deploy)
- Os PRs 1 a 4 só **acrescentam** objetos. O front antigo continua funcionando com o banco novo.
  - Ordem de cada um: merge → "Deploy: banco" → "Deploy: promote".
  - O promote já recusa rodar com migration pendente.
- O PR 5 é **só backend**: a migration e a `create-user-admin`, publicadas pelo "Deploy: banco". Ele só pode ir ao ar quando o front dos PRs 1 a 4 já estiver promovido em produção. Antes disso, o front antigo faria `select('*')` em `members` e quebraria o login.
  - Antes do merge, conferir que nenhum arquivo do front lê `members` diretamente.
  - Exceção permitida: `update`/`delete` com `.eq('id', …)`.
  - Exemplo de checagem: `grep -rnE -A3 'from\("members"\)' src`. Cada ocorrência precisa terminar em `.update(…)` ou `.delete()`, conferindo à mão as cadeias quebradas em várias linhas.
- Entre o "Deploy: banco" e o promote do PR 1, a regra 6 já está ativa. O front antigo envia a linha inteira, mas só mostra os campos sensíveis a quem pode vê-los; com o backfill da RN-14, nada é perdido.

### Riscos (concorrência, escala, segurança)
1. **Desvio entre as views e o RLS.** As views passam por cima do RLS e repetem o predicado.
   - Mitigação: testes de paridade por persona (RN-05), comparando os ids da view com os da tabela sob RLS.
   - Mitigação: o teste de equivalência de `viewer_ministry_member_ids` com `is_in_same_ministry`.
   - E2.01 e E2.02 precisam mexer nos dois lugares, ou fazer o RLS delegar às views.
2. **View definer atualizável.** Uma escrita pela view rodaria como `postgres`.
   - Mitigação: `REVOKE ALL` + `GRANT SELECT`, e um teste de que `authenticated` não tem INSERT, UPDATE nem DELETE em nenhuma view.
   - Mitigação: um teste de que o dono das views é `postgres`. Se o dono mudar, as views passam a respeitar o RLS e encolhem.
3. **Alerta do Supabase.** O *advisor* marca `security_definer_view` como erro. É uma escolha deliberada; documentar no `CLAUDE.md` e não "corrigir" com `security_invoker`, que desliga a máscara.
4. **A trava de colunas falha fechada.** Toda coluna nova de `members` (por exemplo `deleted_at`, `legacy_id`, `created_by`) precisa de um `GRANT SELECT (coluna)` na própria migration. Fica proibido `select('*')` em `members` no front. Registrar nas "Armadilhas do novo".
5. **Recriação de views.** O `CREATE OR REPLACE VIEW` só acrescenta colunas no fim. Mudar o tipo ou a ordem exige `DROP` e `CREATE`, e a `cell_report_participants_view` depende da `cell_reports_view`.
6. **Volume.**
   - Por consulta:
     - `viewer_ministry_member_ids` roda uma vez, como CTE recursiva sobre `members(leader_id)`;
     - o vínculo celular faz três buscas por índice por linha avaliada, mais um conjunto *hash* dos participantes dos últimos 30 dias;
     - a contagem de relatórios percorre o intervalo pelo índice de `date`.
   - Volume de referência para medir: 20 mil membros, 1.500 células, 100 mil relatórios e 800 mil participações.
   - Metas, no banco local, para as personas P1 e P3:
     - página de lista com contagem: < 300 ms;
     - `dashboard_summary`: < 800 ms;
     - `ministry_tree_nodes`: < 100 ms.
   - O G12 por relatório **não** entra neste passo (ver E2.12).
7. **Paginação por *offset*.** Se os dados mudarem entre uma página e outra, um item pode repetir ou sumir. É aceitável numa tela administrativa. Com o total reduzido, uma página além do fim retorna 416 (PGRST103), e o hook volta para a última página válida.
8. **Normalização da busca.** O `unaccent` do banco e a normalização NFD do front podem divergir em caracteres raros (ligaduras, por exemplo). O impacto é baixo.
9. **Tipos de views anuláveis.** Hoje sem efeito (`strictNullChecks: false`). Se o modo estrito for ligado, as colunas de view passam a exigir tratamento de `null` ou um `database.ts` com as colunas não nulas.
10. **Login depende da `members_view`.** Se a view quebrar, o `AuthContext` fica sem membro e sem permissões. Mitigação: um teste e2e de *smoke* de login a cada PR.
11. **Banco local para os testes de banco.** Já existe outra stack do Supabase rodando nesta máquina, nas portas padrão. Para rodar o pgTAP, o `mci-connect` precisa de portas próprias no `config.toml` local ou da outra stack parada.
12. **Máscara e funções.** Se alguém tirar `view_sensitive_data` da role Administrador na tela de Funções, o administrador deixa de ver os dados, porque a tela passa a seguir o banco via `sensitive_visible`. É o comportamento correto, mas vale avisar a liderança.

### Verificações obrigatórias (para o QA transformar em testes)
- **pgTAP, paridade (RN-05).** Para cada persona P1 a P5, com `request.jwt.claims` e `SET ROLE authenticated`:
  - os ids da `members_view` = os ids de `members` sob RLS;
  - o mesmo para `cells_view` × `cells`, `cell_reports_view` × `cell_reports` e `cell_report_participants_view` × `cell_report_participants`;
  - um caso de `view_own_reports` sem `view_own_ministry` (achado 3).
- **pgTAP, equivalência.** Para todo par (u, t) da massa, `t ∈ viewer_ministry_member_ids()` (logado como u) se e só se `is_in_same_ministry(u, t)`. A massa precisa ter:
  - `g12_level` desatualizado;
  - um nó de nível 1 abaixo de um G12;
  - cônjuge sem reciprocidade;
  - cônjuge da raiz com nível diferente de 1;
  - um usuário pastor;
  - um usuário sem cadastro de membro.
- **pgTAP, máscara (RN-11, RN-13, RN-14).**
  - Valores nulos ou reais e `sensitive_visible` por persona.
  - Busca por CPF.
  - O backfill da role `is_system`.
- **pgTAP, regra 6 (RN-12).** O `UPDATE` com CPF trocado mantém o CPF nestes casos e o troca nos demais:
  - `edit_member` sem a permissão: mantém;
  - próprio cadastro: troca;
  - com a permissão: troca;
  - service role: troca;
  - e as regras 1 a 5 do E1.03 continuam valendo.
- **pgTAP, grants.**
  - Views: só SELECT para `authenticated`; nada para `anon`; dono `postgres`.
  - Depois do PR 5, como `authenticated`:
    - `select cpf from members` → 42501;
    - `select * from members` → 42501;
    - `select id, name from members` → ok;
    - `update` e `delete` por `id` → ok;
    - a `create-user-admin` continua cadastrando.
- **pgTAP, dashboard (RN-08, RN-09)**, com `_at` fixo:
  - sábado 23:59 e domingo 00:00 (horário de Brasília);
  - célula de segunda antes e depois do horário;
  - `meeting_time` nulo;
  - `meeting_day` desconhecido;
  - ranking com casal e com cônjuge invisível;
  - 42501 sem permissão.
- **pgTAP, árvore (RN-10).** Casal com o homem primeiro; cônjuge inativo oculto; contagens; mais de 100 ids recusados.
- **Vitest.** `toSearchPatterns` (escapes, acentos, dígitos, limite de palavras), `toRange`, `lastPage` e `toMemberWritePayload` (lista branca, campos ocultos e vazio → `null`).
- **Playwright (*smoke*).**
  - Login.
  - Lista de membros com mais de 1000 registros na massa: total e última página.
  - Edição dos próprios dados.
  - Edição de outro membro sem `view_sensitive_data`, conferindo que o CPF não muda no banco.

## Tarefas
_Seção do `architect`._

Cada PR é independente e entra na ordem abaixo. Dentro de um PR, o backend vai primeiro e os tipos são regenerados antes do front.

| # | Responsável | Descrição | Arquivos | RNs | Depende de |
|---|---|---|---|---|---|
| **PR 1: fundação de leitura + Membros** | | | | | |
| 1 | backend-developer | Migration da fundação: utilitários de data, `unaccent`, funções `viewer_*`, `members_view`, grants, regra 6 do trigger, backfill da RN-14 e índices de `members`. Regenerar o `types.ts`. | `supabase/migrations/<ts>_e108_read_foundation.sql`, `src/integrations/supabase/types.ts` | 02, 03, 04, 05, 06, 11, 12, 13, 14 | — |
| 2 | frontend-developer | Infra do front: `lib/pagination.ts`, `lib/search.ts` e `lib/members/fields.ts`, com testes Vitest; `use-debounced-value.ts`; `ListPagination.tsx`. | `src/lib/**`, `src/hooks/use-debounced-value.ts`, `src/components/ListPagination.tsx` | 01, 03, 04, 12 | roda **em paralelo** com 1 |
| 3 | frontend-developer | Membros: `use-members-list.ts`; `Members.tsx` paginada, com URL, total, busca por `search_text` e sem `.or()`; `MemberForm` com `toMemberWritePayload` e `sensitive_visible`; `AuthContext` lendo a `members_view`. | `src/hooks/use-members-list.ts`, `src/pages/Members.tsx`, `src/components/MemberForm.tsx`, `src/contexts/AuthContext.tsx` | 01, 02, 03, 04, 06, 11, 12, 13 | 1, 2 |
| **PR 2: Células e Relatórios** | | | | | |
| 4 | backend-developer | Migration: `cells_view`, `cell_reports_view` e `cell_report_participants_view`, com grants e os índices de `cells`, `cell_reports` e participantes. Regenerar os tipos. | `supabase/migrations/<ts>_e108_cells_reports_views.sql`, `src/integrations/supabase/types.ts` | 02, 03, 04, 05, 06 | PR 1 |
| 5 | frontend-developer | `use-cells-list.ts` e `use-cell-reports-list.ts`. `Cells.tsx` paginada, sem a carga de todos os membros e sem a `findG12`. `CellReports.tsx` paginada. `CellForm` lendo o endereço do anfitrião na `members_view`. `CellReportForm` recebendo a linha da view e lendo os participantes na `cell_report_participants_view`. | `src/hooks/use-cells-list.ts`, `src/hooks/use-cell-reports-list.ts`, `src/pages/Cells.tsx`, `src/pages/CellReports.tsx`, `src/components/CellForm.tsx`, `src/components/CellReportForm.tsx` | 01 a 06, 11 | 4 |
| **PR 3: Dashboard** | | | | | |
| 6 | backend-developer | Migration: `dashboard_summary`, `dashboard_cells_by_type` e `dashboard_g12_ranking`, com a checagem da RN-09 e os grants. Regenerar os tipos. | `supabase/migrations/<ts>_e108_dashboard_rpcs.sql`, `types.ts` | 02, 05, 08, 09 | PR 2 |
| 7 | frontend-developer | `use-dashboard.ts`. O `Dashboard.tsx` usa as três RPCs, sem agregação no cliente e sem o `WEEK_DAYS_MAP`. O rótulo da semana vem de `week_start`/`week_end`. Estado de acesso negado (42501). | `src/hooks/use-dashboard.ts`, `src/pages/Dashboard.tsx` | 02, 08, 09 | 6 |
| **PR 4: Ministérios e seletores** (em paralelo com o PR 3) | | | | | |
| 8 | backend-developer | Migration: `ministry_tree_nodes`, com grants. Regenerar os tipos. | `supabase/migrations/<ts>_e108_ministry_tree.sql`, `types.ts` | 02, 05, 10 | PR 2 |
| 9 | frontend-developer | `use-ministry-tree.ts`; `Ministries.tsx` com uma chamada por expansão. `use-member-options.ts` e `use-cell-options.ts`. `AsyncMemberSelect` com busca no servidor e aviso. Seletores de célula e de participantes do `CellReportForm` assíncronos. `lib/cells/weekdays.ts` substituindo as listas de dias duplicadas no `CellForm` e no `CellReportForm`. | `src/hooks/use-ministry-tree.ts`, `src/hooks/use-member-options.ts`, `src/hooks/use-cell-options.ts`, `src/pages/Ministries.tsx`, `src/components/AsyncMemberSelect.tsx`, `src/components/CellReportForm.tsx`, `src/components/CellForm.tsx`, `src/lib/cells/weekdays.ts`, `src/lib/selectors.ts` | 07, 10 | 8 |
| **PR 5: trava da máscara** (só backend) | | | | | |
| 10 | backend-developer | Migration com o REVOKE e o GRANT por coluna em `members`. A `create-user-admin` passa a reler só o `id`. Checar com grep que o front não lê `members` diretamente. | `supabase/migrations/<ts>_e108_members_column_lock.sql`, `supabase/functions/create-user-admin/index.ts` | 11 | PRs 1 a 4 **promovidos em produção** |
| 11 | architect | Revisão final. Atualizar o `CLAUDE.md` (estado atual: views e RPCs; armadilhas: sem `select('*')` em `members`, GRANT de coluna nova, *advisor* de view definer) e marcar o E1.08 em `docs/migracao.md`. | `CLAUDE.md`, `docs/migracao.md` | — | 10 |

**Ordem de execução:** PR 1 (1 ∥ 2 → 3) → PR 2 (4 → 5) → { PR 3 (6 → 7) ∥ PR 4 (8 → 9) } → PR 5 (10) → 11.

**Critérios de pronto**
1. Para todas as tarefas: a migration roda num banco zerado depois das existentes e roda de novo sem erro (guardas `IF NOT EXISTS` e `CREATE OR REPLACE`). As funções e views novas não têm EXECUTE nem SELECT para `anon`. O `types.ts` está regenerado.
2. **Tarefa 1:**
   - Como P1 a P5, os ids da `members_view` são iguais aos de `members` sob RLS.
   - P2 recebe CPF nulo dos outros e o próprio CPF real.
   - Um `UPDATE` de CPF por quem tem `edit_member` sem `view_sensitive_data` não altera o valor.
   - As regras 1 a 5 do E1.03 continuam valendo.
3. **Tarefa 2:** `npm test` e `npm run lint` verdes. Sem `any` e sem asserção de tipo (`as Tipo`) nos arquivos novos; `as const` é permitido.
4. **Tarefa 3:**
   - Com mais de 1000 membros, o total e a última página estão corretos.
   - Buscar `a,b)` não gera erro.
   - Editar os próprios dados e os de outro membro funciona.
   - Nenhum `select('*')` em `members` nos três arquivos.
5. **Tarefa 4:** os ids das três views batem com o RLS por persona, incluindo o caso `view_own_reports`. Os índices aparecem no `EXPLAIN` das consultas padrão das listas.
6. **Tarefa 5:**
   - As listas paginam com total.
   - O G12 e os nomes vêm da view.
   - Nenhuma carga de todos os membros ou de todas as células.
   - Editar um relatório mostra os participantes com nome.
7. **Tarefa 6:** os casos de `_at` fixo da RN-08 passam. Sem permissão, as funções devolvem 42501. Com o volume de referência, `dashboard_summary` responde abaixo da meta.
8. **Tarefa 7:** o dashboard faz só as três chamadas (conferir na aba de rede). Os números batem com as RPCs.
9. **Tarefa 8:** os casos da RN-10 passam, e a função é uma só chamada por nível.
10. **Tarefa 9:**
    - Expandir um nó gera uma requisição.
    - Os seletores mostram 20 opções por vez e carregam as seguintes ao rolar, sem repetir.
    - Não resta nenhuma lista de dias da semana fora de `lib/cells/weekdays.ts`.
11. **Tarefa 10:**
    - Como `authenticated`, `select cpf` e `select *` em `members` dão 42501.
    - O *smoke* e2e (login, listas, edição, cadastro via `create-user-admin`) passa em produção depois do deploy.

## Testes
_Seção do `qa`._

| RN | Testes | Resultado |
|---|---|---|
