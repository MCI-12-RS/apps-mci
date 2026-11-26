# E2.07: Listagem de membros com filtros e vínculo celular

> Status: Negócio, Experiência (UX), Solução técnica e Tarefas prontos; desenho pronto, sem implementação. Negócio escrito em 2026-11-24 pelo `product-owner`, sem regras "a confirmar". Experiência (UX) escrita no mesmo dia pelo `ux-designer`; as pendências PO-UX-1 a PO-UX-10 foram resolvidas pelo PO no mesmo dia (P-FIL-16 a P-FIL-25). Solução técnica e Tarefas escritas no mesmo dia pelo `architect`, que respondeu às AQ-1 a AQ-7 e não devolveu nenhuma RN ao PO. Ficam para revisão do usuário no PR os padrões P-FIL-01 a P-FIL-25, as decisões DA-1 a DA-8 do `architect` e as perguntas Q-1 a Q-4, que não bloqueiam (cada uma já tem um padrão adotado; a T9 da UX mostra a tela de cada resposta, e a Solução técnica dá o custo de cada alternativa). O PR 1 (banco) entra depois do banco do E2.05 e do PR 1 do E2.06 em produção. Faltam os Testes.
> Slug: `e2-07-filtros-membros` · Paridade com o legado: sim (MEM-13, MEM-14 e MEM-15), com regras novas: célula inativa não dá vínculo, "Não houve célula" não conta como participação, filtros de múltipla escolha, pessoa indisponível no filtro de liderança e o equivalente de cada card do Dashboard na lista.
> **Coordenação (2026-11-24, E2.10):** a função de cache que o DT-14 chama de `refreshAfterCellReportWrite` é a mesma `refreshAfterReportWrite` do E2.09 (DT-12). Vale o nome do E2.09: o passo implementado primeiro cria, o outro reaproveita.

## Negócio
_Seção do `product-owner`. Escrita em 2026-11-24 a partir destas fontes:_
- _linha do E2.07 na seção Progresso, regras MEM-13 a MEM-15 (3.2), DSH-02, DSH-03 e DSH-05 (3.6) e decisão D2 do [`docs/migracao.md`](../migracao.md);_
- _legado: `Domain/Querying/Filters/MemberFilter.cs`, `Domain/Model/Enum/CellLink.cs`, `Domain/Extensions/QueryingExtensions.cs` (filtros de membros), `App/Services/DashboardService.cs`, `UI/pages/Members/index.js`, `UI/pages/Members/details.js` e `UI/pages/Home/index.js`;_
- _novo (`mci-connect`, `origin/main`, `fdcbe50`): `src/pages/Members.tsx`, `src/hooks/use-members-list.ts`, `src/pages/Dashboard.tsx`, a `members_view` (`supabase/migrations/20261123233300_e201_03_read.sql`) e a `dashboard_summary` (`20261123120000_e108_dashboard_rpcs.sql`);_
- _specs: [E1.08](e1-08-paginacao-servidor.md) (RN-01, RN-03, RN-04, RN-08, RN-11, RN-13, D-2, D-3, Pontos de extensão), [E2.01](e2-01-exclusao-logica.md) (RN-08, RN-12, DA-1), [E2.02](e2-02-perfis-escopo.md) (RN-01, RN-02, RN-06, RN-09, RN-10, RN-22, RN-23, P-PER-22, PO-UX-6), [E2.04](e2-04-validacoes-membro.md) (RN-11, RN-12), [E2.05](e2-05-auditoria-autor.md) (RN-01, RN-03, RN-10) e [E2.06](e2-06-hierarquia-totais.md) (RN-01, RN-02, RN-04, RN-06, P-HIE-02 e "Definições para os passos seguintes"; ainda sem commit, lido só como referência)._

Os caminhos do legado são relativos a `g12app-net/`, com as abreviações do E2.01: `App/` = `G12App.Application/`, `Domain/` = `G12App.Domain/`, `UI/` = `G12App.API/ClientApp/src/` e `Infra/` = `G12App.Infrastructure.Data/`.

### Contexto e objetivo
No legado, a lista de Pessoas tem um painel "Filtros" com:
- Nome e Liderança (parte do nome de qualquer líder da cadeia);
- Bairro e Cidade;
- Situação (Ativo, Inativo), Possui Liderança (Sim, Não) e Batizado (Sim, Não), cada um com "Indiferente";
- Nível Ministerial (Pastores, G12, 144, 1728 e 20736);
- Vínculo Celular (Líder, Timóteo, Anfitrião, Participante e Sem vínculo);
- "Cadastrado a partir de" e "Cadastrado até";
- o link "Limpar filtros".

Os filtros se somam (todos precisam valer ao mesmo tempo), e a lista vem ordenada pelo nível. Os cards do Dashboard abrem essa lista já filtrada: membros ativos, inativos, não batizados, sem liderança, sem vínculo celular e novos membros da semana. No cadastro de uma pessoa nova, o líder já vem preenchido com quem está logado.

O vínculo celular do legado (`CellLink`):
- **Líder, Timóteo, Anfitrião:** tem célula nesse papel.
- **Participante:** esteve em algum relatório nos últimos 30 dias.
- **Sem vínculo:** nenhum dos anteriores e, além disso, nenhuma célula liderada por ele ou por alguém abaixo dele (`TotalCells` igual a 0).

Hoje o novo (conferido na `origin/main` do `mci-connect`, `fdcbe50`, em 2026-11-24):
- a lista de Membros tem só a busca por nome, e-mail ou CPF, paginada no servidor e com o estado na URL (E1.08). A ordem é por nome;
- a `members_view` já calcula o vínculo celular (líder, timóteo, anfitrião e participação nos últimos 30 dias), mas:
  - conta também as células inativas;
  - conta como participação o relatório de "Não houve célula";
  - não tem a regra do total de células para "Sem vínculo";
- o card "Sem Vínculo Celular" do Dashboard usa esses quatro sinais, só para ativos e sem pastores, e não abre a lista;
- o líder já preenchido no cadastro foi desenhado no E2.02 só para quem vê o ministério (P-PER-22), ainda sem implementação.

Objetivo do passo:
- dar à lista de Membros os filtros do legado, no escopo de cada pessoa e sem revelar dados mascarados;
- fechar uma definição única de vínculo celular, usada pelo filtro e pelo card do Dashboard;
- deixar cada card de membros do Dashboard com um equivalente exato na lista, para o E2.14 só ligar o clique;
- preencher o líder com quem cadastra, para todos.

### Termos
- **Filtro:** uma condição da lista de Membros, além da busca. **Filtro vazio:** sem nenhuma opção escolhida e sem texto; não restringe nada.
- **Filtro de múltipla escolha:** aceita uma ou mais opções. Basta valer uma delas (RN-02).
- **Visível:** o que a pessoa vê, conforme o E2.02 (RN-01 e RN-02 de lá). Registros excluídos não são visíveis (E2.01).
- **Abaixo de alguém:** na descendência dessa pessoa, em qualquer nível, pela árvore atual (RN-04 do E2.06). A própria pessoa não está abaixo de si.
- **Nível, rótulo do nível, situação de liderança, total de células:** como no E2.06 (RN-01, RN-02 e RN-06) e no E2.04 (RN-11).
- **Célula ativa:** célula não excluída com "Situação: Ativa".
- **Relatório de célula realizada:** relatório não excluído em que "Não houve célula" está desmarcado.
- **Data de cadastro:** a data em que o registro foi cadastrado, definida pelo servidor (RN-01 e RN-03 do E2.05). Os cadastros antigos do legado sem essa informação aparecem como "data não registrada" (RN-10 d do E2.05).
- **Hoje, datas e horas:** sempre no horário de Brasília (`America/Sao_Paulo`). A semana vai de domingo a sábado.

### Personas e permissões
Este passo não cria permissão. Os filtros aparecem para quem tem a lista de Membros ("Visualizar Toda a Igreja" ou "Visualizar Seu Ministério", RN-22 do E2.02). As pessoas são as da [massa de exemplo](#massa-de-exemplo).

| Persona | Quem é (na massa) | Permissões relevantes | O que exercita |
|---|---|---|---|
| IG Igreja toda | Rita, função Administrador | "Visualizar Toda a Igreja", "Ver Dados Sensíveis", "Criar Membro" | todos os filtros sobre a igreja toda; dados sensíveis |
| PA Pastor | Samuel, função Líder | "Visualizar Seu Ministério", "Criar Membro" | árvore inteira, sem quem está sem liderança; cadastro com o pastor como líder |
| G12 | Pedro, função Líder | "Visualizar Seu Ministério", "Criar Membro", sem "Ver Dados Sensíveis" | filtros no escopo; máscara; pessoa indisponível |
| LE Líder casado | André, função Líder | as mesmas de Pedro | escopo com o ministério da cônjuge |
| OM Outro ministério | Diego, função Líder | as mesmas de Pedro | o que fica fora do escopo |
| SL Sem liderança | Ester, função Membro | "Visualizar Seu Ministério" | situação "Sem liderança" e descendência dela |
| SF Sem função | Hugo | nenhuma | sem lista; pela API, só o próprio cadastro |

### Histórias
- Como líder, quero filtrar os membros do meu ministério por situação, batismo, nível, liderança e vínculo celular, para saber quem precisa de cuidado.
- Como líder, quero ver todos que estão abaixo de um discípulo meu, em qualquer nível, para acompanhar a rede dele.
- Como liderança, quero encontrar quem está sem vínculo celular, para levar essas pessoas a uma célula.
- Como secretaria, quero filtrar por bairro, cidade e data de cadastro, para organizar visitas e acompanhar quem chegou.
- Como líder, quero abrir pelo Dashboard a lista exata das pessoas de cada número, para agir sobre elas.
- Como líder, quero que o cadastro de uma pessoa nova já venha com o meu nome como líder, porque quase sempre cadastro o meu próprio discípulo.

### Decisões

#### Decisões do usuário e de passos anteriores
| Decisão | O que vale aqui | Onde |
|---|---|---|
| D-2 do E1.08 (2026-11-15) | Bairro, cidade e UF não são sensíveis: o filtro por bairro e cidade alcança todos os membros visíveis. | RN-06, RN-13 |
| D-3 do E1.08 (2026-11-15) | "Sem vínculo celular" usa 30 dias e considera todas as células e relatórios, e não só os visíveis. | RN-10 |
| D1 e RN-08 do E2.01; DA-1 do E2.01 | Excluídos não aparecem nem contam. A participação num relatório não excluído conta, mesmo que a célula tenha sido excluída. | RN-03, RN-10 |
| RN-01, RN-02, RN-06, RN-09 (a), RN-22 e RN-23 do E2.02 | Escopo; o que não é visível é tratado como inexistente; ninguém descobre a cadeia de liderança de quem não vê. | RN-03, RN-05 |
| RN-10 e P-PER-22 do E2.02 | Líder já preenchido com quem cadastra, antecipado para quem vê só o ministério; o E2.07 estende a todos. | RN-16 |
| RN-11 e RN-12 do E2.04 | As três situações de liderança; líder obrigatório no cadastro novo, salvo pastor ou sem liderança marcados de propósito. | RN-08, RN-16 |
| RN-03 e RN-10 (d) do E2.05 | A data de cadastro é do servidor; "data não registrada" não entra em filtro por período. | RN-12 |
| RN-01, RN-02, RN-04, RN-06 e "Definições" do E2.06 | Nível (sem liderança não tem nível), rótulos, cadeia e total de células. O filtro de liderança e a ordem foram deixados para este passo. | RN-04, RN-09, RN-10, RN-15 |

#### Padrões definidos por este spec (revisar no PR)
Pontos que as fontes não respondem. O PO adotou a opção mais conservadora e coerente com o legado e com os specs anteriores. Nas regras, aparecem como "definida pelo spec". O usuário pode mudar qualquer um na revisão do PR.

- **P-FIL-01, múltipla escolha** (RN-02). Liderança, Situação de liderança, Nível e Vínculo celular aceitam várias opções, e basta valer uma. Situação e Batizado têm escolha única ("Todos", "Ativo"/"Sim", "Inativo"/"Não"). No legado, todos eram de escolha única; escolher uma opção só continua dando o mesmo resultado.
- **P-FIL-02, liderança por seletor** (RN-04). A pessoa é escolhida num seletor, entre as visíveis, e não digitada, para não trazer homônimos (recomendação das "Definições" do E2.06). Aceita até 10 pessoas. Escolher uma pessoa casada não traz a descendência do cônjuge: para ver o casal, escolhem-se os dois (Q-4).
- **P-FIL-03, pessoa indisponível** (RN-05). Uma pessoa que quem consulta não vê, vinda de um link ou da API, não traz ninguém e não tem o nome mostrado.
- **P-FIL-04, bairro e cidade** (RN-06). "Contém o texto", sem diferenciar maiúsculas e acentos, como a busca do E1.08.
- **P-FIL-05, "Situação de liderança"** (RN-08). O "Possui Liderança" do legado (Sim, Não) vira "Situação de liderança", com as três situações do E2.04: Com líder, Sem liderança e Pastor(a).
- **P-FIL-06, "Nível 5 ou mais"** (RN-09). Uma opção só para os níveis a partir do 5, que o legado não tinha porque guardava no máximo 6 líderes na cadeia.
- **P-FIL-07, célula inativa não dá vínculo** (RN-10). Ser líder, timóteo ou anfitrião só conta em célula ativa, como o total de células (D2, RN-06 do E2.06). O legado não tinha células inativas.
- **P-FIL-08, "Não houve célula" não é participação** (RN-10). Só conta o relatório de célula realizada. No legado, a tela desabilita os participantes quando não houve célula (`UI/pages/Report/details.js:378`).
- **P-FIL-09, janela em datas** (RN-10). "Nos últimos 30 dias" é o relatório com data a partir de hoje − 30 dias, contando o dia inteiro. O legado comparava data e hora.
- **P-FIL-10, pastor nunca está "Sem vínculo"** (RN-10). Como o card atual do novo. Com a regra do total de células, isso só muda algo quando não há nenhuma célula ativa abaixo do pastor.
- **P-FIL-11, datas de cadastro** (RN-12). Os dois dias entram, em datas de Brasília. Data inicial depois da final não é aplicada, com aviso.
- **P-FIL-12, URL** (RN-14). Valores inválidos na URL são ignorados. "Limpar filtros" limpa também a busca e mantém o tamanho da página.
- **P-FIL-13, ordem** (RN-15). Por nível, como no legado, e dentro do nível por nome; quem está sem liderança vem por último (Q-2).
- **P-FIL-14, card alinhado neste passo** (RN-11). O card "Sem Vínculo Celular" passa a usar a definição da RN-10 já neste passo, porque a MEM-14 inclui o número do Dashboard. O clique no card fica com o E2.14.
- **P-FIL-15, tempo de resposta** (RN-02). Até 2 s para a primeira página e o total, com qualquer combinação de filtros, no volume de referência.
- **Vindos do desenho de UX (2026-11-24, PO-UX-1 a PO-UX-10 em "Experiência (UX)"):**
  - **P-FIL-16, aviso do líder preenchido** (PO-UX-1, RN-16). Para quem vê a igreja toda, o "Novo membro" avisa no topo que o líder já vem preenchido com a própria pessoa, com um atalho até o campo. No cadastro novo, o líder preenchido não dispara o aviso "Ao salvar, … deixa de ser o líder." do E2.04, porque ainda não há nada gravado.
  - **P-FIL-17, mais de 10 pessoas vindas de fora** (PO-UX-2, RN-04). De um link ou da API, valem as 10 primeiras, na ordem em que vieram. As outras são descartadas, e a tela mostra "Escolha até 10 pessoas.".
  - **P-FIL-18, id malformado × pessoa indisponível** (PO-UX-3, RN-05, RN-14). Um id que nem tem o formato de id é valor inválido: sai da URL e não conta. Um id com formato válido de quem a pessoa não vê, de um excluído ou de ninguém é "Pessoa indisponível".
  - **P-FIL-19, contagem dos filtros ativos** (PO-UX-4, RN-14). O botão conta filtros, e não valores: de 1 a 9. A Liderança conta 1 com qualquer número de pessoas, as duas datas contam 1, e a busca e os valores inválidos não contam. Cada valor escolhido vira um chip removível.
  - **P-FIL-20, só a busca** (PO-UX-5, RN-14). "Limpar filtros" aparece também quando só a busca está preenchida, porque limpa a busca. O vazio com só a busca usa o mesmo texto do vazio com filtros, como na Auditoria (E2.05).
  - **P-FIL-21, quando o filtro vale** (PO-UX-6, RN-02). No celular e no tablet, as mudanças do painel valem em "Aplicar filtros"; tirar um chip vale na hora. No computador, cada mudança vale na hora. A volta para a página 1 acontece quando a mudança é aplicada.
  - **P-FIL-22, duas dicas a mais** (PO-UX-7, RN-09, RN-10). Em Nível, que quem está sem liderança não tem nível; em Vínculo celular, que líder, timóteo e anfitrião contam só em células ativas.
  - **P-FIL-23, datas** (PO-UX-8, RN-12). O campo de data do aparelho já mostra o formato, então o "Formato: dd/mm/aaaa" sai. Datas futuras são aceitas. As mensagens continuam as deste spec, sem unificar com a da Auditoria, porque os rótulos são outros.
  - **P-FIL-24, G12 nas opções do seletor de Liderança** (PO-UX-9, RN-04). Segue a Q-3 do E2.06: se o G12 entrar nos seletores de membro, entra aqui também, sem regra nova. Não entra isolado neste passo.
  - **P-FIL-25, textos da UX** (PO-UX-10). Todos aceitos, sem ajuste. Os que estão ligados a uma regra foram copiados para os "Textos de tela" deste Negócio.

### Regras de negócio
Nenhuma regra está "a confirmar".

Correspondência com o plano: MEM-13 → RN-01 a RN-09 e RN-12 a RN-15 · MEM-14 → RN-10 e RN-11 · MEM-15 → RN-16 · preparação da DSH-05 → RN-17.

| ID | Regra | Origem |
|---|---|---|
| RN-01 | **Filtros da lista de Membros.** Além da busca por nome, e-mail ou CPF (RN-04 do E1.08), a lista tem estes filtros:<br>- Liderança (RN-04 e RN-05);<br>- Bairro e Cidade (RN-06);<br>- Situação e Batizado (RN-07);<br>- Situação de liderança (RN-08);<br>- Nível (RN-09);<br>- Vínculo celular (RN-10);<br>- "Cadastrado a partir de" e "Cadastrado até" (RN-12).<br><br>Os filtros estão disponíveis para quem tem a lista de Membros, sem permissão nova. Com todos os filtros vazios, a lista é a de hoje. | MEM-13; legado (`Domain/Querying/Filters/MemberFilter.cs:8-44`; `UI/pages/Members/index.js:151-246`); RN-22 do E2.02 (quem tem a lista) |
| RN-02 | **Combinação.**<br>- Entre filtros diferentes, e com a busca: **todos** precisam valer (E).<br>- Dentro de um filtro de múltipla escolha (Liderança, Situação de liderança, Nível e Vínculo celular): basta valer **uma** das opções escolhidas (OU).<br>- Situação e Batizado são de escolha única, com "Todos" como padrão.<br>- O total, a paginação e a ordem valem para o resultado filtrado, como no E1.08: total exato, nada cortado, sem repetir nem pular registros entre páginas.<br>- **Quando o filtro vale:** no celular e no tablet, as mudanças feitas no painel de filtros só valem ao tocar em "Aplicar filtros"; fechar o painel sem aplicar não muda a lista. Tirar um filtro pelo chip vale na hora. No computador, cada mudança vale na hora (os campos de texto, logo depois que a pessoa para de digitar). Toda mudança aplicada volta a lista para a página 1.<br>- No volume de referência (20 mil membros, 1.500 células e 100 mil relatórios), qualquer combinação mostra a primeira página e o total em até 2 s depois de aplicada. | legado (`Domain/Extensions/QueryingExtensions.cs:53-147`: cada filtro preenchido restringe a consulta; `MemberFilter.cs:24` e `QueryingExtensions.cs:82-83`: lista de níveis); RN-01 a RN-03 do E1.08; múltipla escolha: definida pelo spec (P-FIL-01); tempo: definida pelo spec (P-FIL-15); quando vale: definida pelo spec (P-FIL-21), como na Auditoria do E2.05 |
| RN-03 | **Filtro só restringe.** O resultado é sempre a interseção entre os membros visíveis para quem consulta (E2.02) e os filtros. Nenhum filtro, nenhuma combinação e nenhum valor vindo da URL ou da API mostra um membro que a pessoa não vê, nem um membro excluído (E2.01). Vale igual pela tela e pela API. | AUT-03, DSH-01; RN-02 do E2.02; RN-08 do E2.01; legado (filtro de ministério em toda consulta: `Infra/Repositories/MemberRepository.cs:44-51`) |
| RN-04 | **Liderança, em qualquer nível.**<br>- Quem consulta escolhe de 1 a 10 pessoas num seletor com busca, entre os membros visíveis, ativos ou inativos.<br>- O resultado são os membros que estão abaixo de pelo menos uma das pessoas escolhidas, em qualquer nível, pela árvore atual.<br>- A pessoa escolhida não entra no resultado, a não ser que esteja abaixo de outra pessoa escolhida.<br>- A contagem passa pelos inativos: quem está abaixo de um inativo continua abaixo de quem está acima dele.<br>- O cônjuge da pessoa escolhida e a descendência dele não entram, a não ser que estejam abaixo dela. Para ver o ministério do casal, escolhem-se os dois.<br>- Uma 11ª pessoa não é aceita: "Escolha até 10 pessoas.".<br>- Quando um link ou a API traz mais de 10 pessoas, valem as 10 primeiras, na ordem em que vieram, e as outras são descartadas (também da URL). A tela mostra "Escolha até 10 pessoas.". A lista nunca usa mais de 10 pessoas. | MEM-13 ("liderança, qualquer nível"); legado (`QueryingExtensions.cs:64-65`: parte do nome de qualquer líder da cadeia; `:94-95`: por id, em todos os níveis); RN-04 e "Definições" do E2.06 (sem a própria pessoa); seletor, várias pessoas e limite: definida pelo spec (P-FIL-02); mais de 10 vindas de fora: definida pelo spec (P-FIL-17) |
| RN-05 | **Pessoa indisponível na Liderança.** Quando a URL ou a API traz, no filtro de Liderança, um id com formato válido de uma pessoa que quem consulta não vê, que foi excluída ou que não existe:<br>- ela é tratada como inexistente: não traz ninguém. Se houver outras pessoas escolhidas, valem só as outras;<br>- a tela mostra essa escolha como "Pessoa indisponível", sem o nome e sem o id, com a dica "Esta pessoa não está disponível para você.". A resposta do servidor também não traz o nome;<br>- ela fica na URL, conta como filtro ativo e pode ser tirada pelo chip;<br>- as três situações (não visível, excluída e inexistente) têm a mesma resposta.<br><br>Um id que nem tem o formato de id é valor inválido (RN-14): sai da URL, não conta e não aparece como "Pessoa indisponível".<br><br>O filtro responde só "quem está abaixo de uma pessoa visível". A cadeia de liderança de um membro (os ids ou os nomes dos líderes acima dele) não sai do servidor por causa deste filtro. Os nomes de referência continuam os do E1.08 (RN-06) e do E2.06 (RN-10). | RN-09 (a) e RN-23 do E2.02 ("o que não está visível é tratado como inexistente"; ninguém descobre a cadeia de liderança de quem não vê); definida pelo spec (P-FIL-03); fronteira com o id malformado: definida pelo spec (P-FIL-18) |
| RN-06 | **Bairro e cidade.**<br>- O membro entra quando o bairro (ou a cidade) do cadastro **contém** o texto digitado.<br>- Não diferencia maiúsculas nem acentos. Espaços nas pontas são ignorados, e espaços seguidos contam como um.<br>- Todo caractere conta como texto, inclusive `%`, `_`, vírgula e aspas.<br>- Até 100 caracteres. Texto vazio não filtra.<br>- Um cadastro sem bairro (ou sem cidade) nunca entra quando o filtro está preenchido.<br>- Bairro e cidade não são sensíveis (D-2 do E1.08): o filtro alcança todos os membros visíveis, mesmo aqueles cuja rua e CEP quem consulta não vê. | MEM-13; legado (`QueryingExtensions.cs:70-74`: contém, sem diferenciar maiúsculas); D-2 do E1.08; sem acentos e caracteres como texto: definida pelo spec (P-FIL-04), como a busca do E1.08 (RN-04) |
| RN-07 | **Situação e batizado.**<br>- Situação: Todos, Ativo ou Inativo, pela situação do próprio membro.<br>- Batizado: Todos, Sim ou Não, pela marca "Batizado" do cadastro, para ativos e inativos. | MEM-13; legado (`UI/pages/Members/index.js:179-205`; `QueryingExtensions.cs:103-107`); "Todos" no lugar de "Indiferente": Textos de tela |
| RN-08 | **Situação de liderança.** Opções: **Com líder**, **Sem liderança** e **Pastor(a)**, as três situações da RN-11 do E2.04. Todo membro está em exatamente uma.<br>- Correspondência com o legado: "Possui Liderança: Sim" = Com líder + Pastor(a); "Não" = Sem liderança.<br>- Quem está abaixo de alguém sem liderança está em "Com líder". | MEM-13; legado (`UI/pages/Members/index.js:189-196`; `QueryingExtensions.cs:109-110`); RN-11 do E2.04; "Definições" do E2.06; nome e opções: definida pelo spec (P-FIL-05) |
| RN-09 | **Nível.** Opções, com os rótulos da RN-02 do E2.06: **Pastores** (nível 0), **G12** (1), **144** (2), **1.728** (3), **20.736** (4) e **Nível 5 ou mais** (5 em diante).<br>- O nível é o da RN-01 do E2.06, atualizado na mesma operação que muda a árvore.<br>- Quem está sem liderança não tem nível e não entra em nenhuma opção. Para encontrá-lo, usa-se a Situação de liderança.<br>- Quem está abaixo de alguém sem liderança tem o nível contado a partir dessa pessoa (P-HIE-02 do E2.06): o discípulo direto dela entra em "G12".<br>- A situação (ativo ou inativo) não muda o nível. | MEM-13; legado (`UI/pages/Members/index.js:207-216`; `QueryingExtensions.cs:79-83`); RN-01, RN-02 e "Definições" do E2.06; "Nível 5 ou mais": definida pelo spec (P-FIL-06) |
| RN-10 | **Vínculo celular.** Cada membro é classificado assim:<br>(a) **Líder:** é líder de pelo menos uma célula ativa;<br>(b) **Timóteo:** é timóteo de pelo menos uma célula ativa;<br>(c) **Anfitrião:** é anfitrião de pelo menos uma célula ativa;<br>(d) **Participante:** é participante de pelo menos um relatório de célula realizada com data a partir de hoje − 30 dias (hoje 24/11: de 25/10 em diante). Vale o relatório de célula inativa ou excluída, porque a reunião aconteceu;<br>(e) **Sem vínculo:** não está em (a) a (d), o total de células dele (RN-06 do E2.06) é zero e não é pastor(a).<br><br>Detalhes:<br>- As categorias de (a) a (d) se somam: quem é líder e esteve num relatório está em Líder e em Participante.<br>- Quem não está em (a) a (d), mas tem célula ativa abaixo dele, não está em nenhuma categoria, como no legado. É o caso de quem só acompanha a própria rede.<br>- O vínculo é de cada pessoa. O do cônjuge não passa para ela.<br>- A situação do membro não muda o vínculo: um inativo pode ser líder ou participante.<br>- Célula inativa, célula excluída, relatório excluído e relatório de "Não houve célula" não dão vínculo.<br>- O cálculo considera todas as células e relatórios da igreja, e não só os visíveis para quem consulta. O filtro revela só a categoria, nunca qual célula ou relatório.<br>- A janela anda um dia a cada meia-noite de Brasília. A virada da semana não tem efeito próprio.<br>- No filtro, Vínculo celular é de múltipla escolha (RN-02). | MEM-14; legado (`Domain/Model/Enum/CellLink.cs:3-10`; `QueryingExtensions.cs:112-144`: 30 dias e "Sem vínculo" com total de células zero; participação = relatórios em que a pessoa está, `Infra/EntitiesConfiguration/ReportConfiguration.cs:13`); RN-08 (c) e D-3 do E1.08 (30 dias, todas as células e relatórios); RN-08, RN-12 e DA-1 do E2.01; RN-06 do E2.06; célula ativa: definida pelo spec (P-FIL-07); "Não houve célula": definida pelo spec (P-FIL-08); janela em datas: definida pelo spec (P-FIL-09); pastor: definida pelo spec (P-FIL-10), como o card atual do novo |
| RN-11 | **Uma definição só.** O card "Sem Vínculo Celular" do Dashboard conta exatamente os membros visíveis e ativos que estão em "Sem vínculo" (RN-10 e). O número é igual ao total da lista de Membros com Situação: Ativo e Vínculo celular: Sem vínculo. Vale a partir deste passo. Em relação ao card de hoje:<br>- célula inativa deixa de dar vínculo;<br>- "Não houve célula" deixa de contar como participação;<br>- quem tem célula ativa abaixo dele deixa de contar como sem vínculo.<br><br>O clique no card é do E2.14 (RN-17). | MEM-14 ("só no dashboard"); RN-08 (c) e Fora de escopo do E1.08 (célula inativa e total de células deixados para o E2.07); DSH-03; legado (`App/Services/DashboardService.cs:164-171`: o card usa o mesmo filtro da lista); neste passo: definida pelo spec (P-FIL-14) |
| RN-12 | **Data de cadastro.** "Cadastrado a partir de" e "Cadastrado até", com as datas exibidas como dd/mm/aaaa.<br>- A data de cadastro de cada membro é a data de Brasília do momento do cadastro: um cadastro feito às 23:30 de 21/11 é de 21/11, mesmo que já seja 22/11 em UTC.<br>- Os dois dias informados entram no resultado.<br>- Cada campo pode ser usado sozinho: só "a partir de" traz desse dia em diante; só "até" traz até esse dia.<br>- Datas futuras são aceitas: "Cadastrado até" o sábado da semana atual vale em qualquer dia da semana (RN-17).<br>- Com qualquer um dos dois preenchido, os cadastros com "data não registrada" ficam de fora. Sem filtro de data, eles aparecem normalmente.<br>- Data inválida ou data inicial depois da final: o filtro de data não é aplicado, e a tela mostra a mensagem embaixo do campo. A conferência é feita ao sair do campo e ao aplicar, nunca durante a digitação. | MEM-13; legado (`UI/pages/Members/index.js:232-245`; `QueryingExtensions.cs:97-101`); RN-01, RN-03 e RN-10 (d) do E2.05; dias inclusive e mensagens: definida pelo spec (P-FIL-11); datas futuras e momento da conferência: definida pelo spec (P-FIL-23) |
| RN-13 | **Máscara.**<br>- Nenhum filtro deste passo usa campo sensível: CPF, e-mail, celular, telefone, rua, número, complemento e CEP.<br>- A busca continua com a RN-13 do E1.08: encontra pelo e-mail ou pelo CPF só os cadastros cujos dados quem consulta vê.<br>- Pela API, filtrar a lista por um campo sensível nunca encontra um cadastro cujos dados estão mascarados para quem consulta.<br>- Bairro, cidade e UF não são sensíveis (D-2 do E1.08). | RN-11 e RN-13 do E1.08; D-1 e D-2 do E1.08 |
| RN-14 | **Filtros no endereço da página.**<br>- Os filtros ficam na URL, junto com a busca, a página e o tamanho da página. Recarregar, voltar no navegador ou abrir o link restaura a lista filtrada.<br>- Outra pessoa que abre o mesmo link vê os mesmos filtros aplicados ao que **ela** vê (RN-03). Uma pessoa da Liderança que ela não vê fica indisponível (RN-05).<br>- Um valor desconhecido ou inválido na URL (opção que não existe, data que não existe, id sem formato de id) é ignorado: sai da URL, aquele filtro não é aplicado e não aparece como ativo.<br>- "Limpar filtros" esvazia todos os filtros e a busca, volta para a página 1 e mantém o tamanho da página. Aparece sempre que há pelo menos um filtro ativo ou texto na busca.<br>- **Filtros ativos.** A tela mostra quantos filtros estão em uso, de 1 a 9: a Liderança conta 1 com qualquer número de pessoas (inclusive a "Pessoa indisponível"), as duas datas contam 1, e a busca e os valores inválidos não contam. Cada valor escolhido aparece como um chip, que tira só aquele valor. | RN-01 do E1.08 (estado na URL) e Pontos de extensão do E1.08 (o clique do Dashboard abre a lista pela URL); legado ("Limpar filtros", `UI/pages/Members/index.js:151-153`; os cards abrem a lista filtrada, `UI/pages/Home/index.js:26-52`); valores inválidos e o que "Limpar filtros" limpa: definida pelo spec (P-FIL-12, P-FIL-18); contagem e chips: definida pelo spec (P-FIL-19); "Limpar filtros" com só a busca: definida pelo spec (P-FIL-20) |
| RN-15 | **Ordem.** A lista vem ordenada por nível: Pastores, G12, 144, 1.728, 20.736, Nível 5, Nível 6 e assim por diante, e quem está sem liderança por último. Dentro do mesmo nível, a ordem é alfabética pelo nome, sem diferenciar maiúsculas nem acentos. O desempate final é estável, para que a paginação não repita nem pule ninguém (RN-03 do E1.08). Os filtros não mudam a ordem. | legado (`UI/pages/Members/index.js:39`: ordem pelo nível; sem liderança = 9999999, o maior valor); "Definições" do E2.06 ("o E2.07 decide"); desempate: RN-03 do E1.08; nome dentro do nível: definida pelo spec (P-FIL-13) |
| RN-16 | **Líder já preenchido (MEM-15).** No cadastro de um membro novo, o campo Líder já vem preenchido com quem está cadastrando, para qualquer pessoa com "Criar Membro" e cadastro de membro, inclusive quem vê a igreja toda, pastor, inativo ou sem liderança.<br>- Quem cadastra pode trocar o líder por outra pessoa visível, ou tirá-lo, dentro das regras do E2.02 (RN-10) e do E2.04 (RN-11 e RN-12). Ligar "É Pastor(a)?" tira o líder, como no E2.04.<br>- **Aviso para quem vê a igreja toda.** Como a secretaria cadastra pessoas de qualquer ministério, o formulário dessa pessoa mostra no topo "O líder já vem preenchido com você.", com "Ir para o líder", que leva ao campo. O aviso some quando o líder deixa de ser quem cadastra e volta se ele voltar. Quem vê só o ministério não recebe o aviso: o líder fica à vista e é obrigatório para ele (E2.02).<br>- **No cadastro novo, o líder preenchido não conta como "havia líder"** para o aviso "Ao salvar, {Nome} deixa de ser o líder." do E2.04 (RN-11 e RN-12): ligar "É Pastor(a)?" ou desligar "Tem Liderança?" mostra só os textos de situação ("Pastor(a) não tem líder.", "A pessoa fica sem liderança."). Desfazer devolve o líder que estava no campo.<br>- Vale só no cadastro novo. Na edição, o líder gravado continua o mesmo, sem aviso.<br>- É só um valor inicial na tela. Pela API, nenhum líder é preenchido automaticamente: um cadastro sem líder segue a RN-12 do E2.04. | MEM-15; legado (`UI/pages/Members/details.js:88-93` e `:199-205`: para todo usuário com cadastro de membro); RN-10 e P-PER-22 do E2.02 (antecipação para quem vê só o ministério); extensão a todos: plano (linha do E2.07 no `docs/migracao.md`), ver Q-1; aviso e "havia líder": definida pelo spec (P-FIL-16), mitigação do risco da PO-UX-6 do E2.02 |
| RN-17 | **Cada card de membros tem um equivalente na lista.** Para cada card de membros do Dashboard, a lista de Membros com os filtros da tabela abaixo mostra um total igual ao número do card, para qualquer pessoa. Este passo garante os filtros e a igualdade; o clique que abre a lista é do E2.14 (DSH-05).<br><br>Equivalentes:<br>- Total de Membros: nenhum filtro;<br>- Membros Ativos: Situação: Ativo;<br>- Membros Inativos: Situação: Inativo;<br>- Batizados: Batizado: Sim;<br>- Não Batizados: Batizado: Não;<br>- Sem Liderança: Situação: Ativo + Situação de liderança: Sem liderança;<br>- Sem Vínculo Celular: Situação: Ativo + Vínculo celular: Sem vínculo (RN-11);<br>- Novos membros da semana (card do E2.14, DSH-02): "Cadastrado a partir de" o domingo e "Cadastrado até" o sábado da semana atual.<br><br>Se o E2.14 mudar a definição de algum card, a linha correspondente muda junto, e a igualdade continua valendo. | DSH-03, DSH-05; legado (`UI/pages/Home/index.js:26-52`: cada card abre a lista com os filtros dele); definições atuais dos cards (`dashboard_summary`, PR 3 do E1.08); "Novos membros": RN-10 (d) do E2.05 e DSH-02 |

### Critérios de aceite
Convenções:
- "Pela API" é qualquer leitura feita fora da tela, com a sessão da persona citada.
- "Hoje" é terça-feira, 24/11/2026, horário de Brasília, salvo quando o critério diz outra data. A semana atual vai de domingo, 22/11, a sábado, 28/11.
- Cada critério parte da massa original.
- **Consolidado:** ainda não existe; ver Impactos.

#### Massa de exemplo
A árvore e as funções são as da [massa do E2.02](e2-02-perfis-escopo.md#massa-de-exemplo), com um membro a mais (Jonas) e as células abaixo.

- **Árvore** (líder → discípulos):
  - Samuel e Magda, casados, pastores (D9).
  - Pedro, discípulo de Samuel, e Paula, discípula de Magda, casados.
  - Tiago, discípulo de Samuel, e Tânia, discípula de Magda, casados.
  - André, discípulo de Pedro, casado com Beatriz, discípula de Tânia.
  - Caio e Fábio (**inativo**), discípulos de André. Gabriel, discípulo de Fábio. **Jonas**, discípulo de Gabriel.
  - Carla, discípula de Paula. Débora, discípula de Beatriz. Rita, discípula de Tânia.
  - Diego e Hugo, discípulos de Tiago.
  - Ester, sem liderança. Lúcia, discípula de Ester.
- **Níveis** (RN-01 do E2.06):
  - Pastores: Samuel e Magda;
  - G12: Pedro, Paula, Tiago, Tânia e Lúcia (abaixo de Ester, P-HIE-02);
  - 144: André, Beatriz, Carla, Diego, Hugo e Rita;
  - 1.728: Caio, Débora e Fábio;
  - 20.736: Gabriel;
  - Nível 5: Jonas;
  - sem nível: Ester (sem liderança).
- **Células** (líder / timóteo / anfitrião):
  - C1, de André (quarta, 20:00): André / Caio / Carla, ativa;
  - C2, de Diego (quinta, 20:00): Diego / Hugo / Caio, ativa;
  - C3, de Débora (terça, 19:30): Débora / Rita / Beatriz, ativa;
  - C4, de Gabriel (sábado, 10:00): Gabriel / Jonas / Fábio, **inativa**;
  - C5, de Jonas (sexta, 20:00): Jonas / Gabriel / Fábio, **excluída**.
- **Totais de células** (RN-06 do E2.06): Samuel 2; Magda, Pedro, Tiago, Tânia, André, Beatriz, Débora e Diego 1; os demais 0.
- **Relatórios:** nenhum nos últimos 30 dias, exceto os citados em cada critério.
- **Funções:** Rita, Administrador. Samuel, Magda, Pedro, Paula, André e Diego, Líder. Caio, Carla, Fábio, Beatriz, Ester e Jonas, Membro. Hugo, sem função. Ninguém, exceto Rita, tem "Ver Dados Sensíveis".
- **O que cada um vê** (tabela do E2.02, com Jonas):
  - Rita: os 19 membros;
  - Samuel e Magda: todos, exceto Ester e Lúcia;
  - Pedro: Pedro, Paula, André, Caio, Fábio, Gabriel, Jonas e Carla;
  - André: os de Pedro, mais Beatriz e Débora;
  - Diego: Diego, Tiago, Tânia, Hugo, Beatriz, Débora e Rita;
  - Ester: Ester e Lúcia;
  - Hugo: só ele.

**Vínculo celular da massa** (RN-10), sem participação em relatórios:

| Categoria | Membros |
|---|---|
| Líder | André, Diego, Débora |
| Timóteo | Caio, Hugo, Rita |
| Anfitrião | Carla, Caio, Beatriz |
| Sem vínculo | Paula, Fábio (inativo), Gabriel, Jonas, Ester, Lúcia |
| Nenhuma | Samuel e Magda (pastores); Pedro, Tiago e Tânia (sem papel, mas com célula ativa abaixo) |

#### Critérios por regra
- **RN-01**
  - Dados Rita, Samuel, Pedro, André, Diego e Ester
  - Quando cada um abre Membros
  - Então vê a busca e os filtros Liderança, Bairro, Cidade, Situação, Situação de liderança, Batizado, Nível, Vínculo celular, "Cadastrado a partir de" e "Cadastrado até", e, com todos vazios, a mesma lista e o mesmo total de antes deste passo.
  - Dado Hugo, sem função
  - Então ele não tem Membros no menu (RN-22 do E2.02); pela API, vale a RN-03.
- **RN-02**
  - Dada Rita
  - Quando ela escolhe Nível: 144 e Vínculo celular: Líder
  - Então vê André e Diego, e o total 2.
  - Quando ela escolhe Nível: 144 e 1.728, e Situação: Ativo
  - Então vê André, Beatriz, Carla, Diego, Hugo, Rita, Caio e Débora (8), sem Fábio, que está inativo.
  - Quando ela busca "Carla" e escolhe Nível: 1.728
  - Então a lista fica vazia, com "Nenhum membro encontrado com estes filtros.", porque Carla é 144.
  - Dada Rita no computador, na página 3 de uma lista
  - Quando ela muda qualquer filtro
  - Então a lista muda na hora e volta para a página 1.
  - Dada Rita no celular, na página 3 de uma lista
  - Quando ela marca Nível: 144 no painel de filtros e fecha o painel sem tocar em "Aplicar filtros"
  - Então a lista e a página não mudam.
  - Quando ela marca de novo e toca em "Aplicar filtros"
  - Então a lista muda e volta para a página 1.
  - Quando ela toca no "✕" do chip "Nível: 144"
  - Então o filtro sai na hora, sem "Aplicar filtros", e a lista volta para a página 1.
  - Dados 20 mil membros, 1.500 células e 100 mil relatórios
  - Quando Rita aplica Liderança (1 pessoa), Bairro, Situação, Nível (2 opções), Vínculo celular (2 opções) e as duas datas
  - Então a primeira página e o total aparecem em até 2 s.
- **RN-03**
  - Dado Diego
  - Quando ele escolhe Nível: 144
  - Então vê Diego, Hugo, Beatriz e Rita (4), e não André nem Carla, que não vê.
  - Dado Samuel, pastor
  - Quando ele escolhe Nível: G12
  - Então vê Pedro, Paula, Tiago e Tânia, e não Lúcia, que está abaixo de Ester e fora do escopo dele (RN-06 do E2.02).
  - Dado Hugo, sem função
  - Quando ele lê a lista de Membros pela API com qualquer filtro, por exemplo o nível 144
  - Então recebe no máximo o próprio cadastro.
  - Dada Sara, do bairro Centro, excluída
  - Quando Rita filtra Bairro: Centro
  - Então Sara não aparece e não conta no total.
- **RN-04**
  - Dada Rita
  - Quando ela escolhe Liderança: André
  - Então vê Caio, Fábio, Gabriel e Jonas (4), sem André.
  - Quando ela acrescenta Situação: Ativo
  - Então vê Caio, Gabriel e Jonas: Fábio sai porque está inativo, e Gabriel e Jonas continuam abaixo de André por meio dele.
  - Quando ela escolhe Liderança: Pedro
  - Então vê André, Caio, Fábio, Gabriel e Jonas (5), sem Carla, que é discípula de Paula, e sem Beatriz, que está abaixo de Tânia.
  - Quando ela escolhe Liderança: Pedro e Paula
  - Então vê André, Caio, Fábio, Gabriel, Jonas e Carla (6).
  - Quando ela escolhe Liderança: Pedro e André
  - Então vê André, Caio, Fábio, Gabriel e Jonas: André aparece porque está abaixo de Pedro.
  - Quando ela escolhe Liderança: Ester
  - Então vê Lúcia.
  - Quando ela escolhe Liderança: Caio, que não tem discípulos
  - Então a lista fica vazia, com "Nenhum membro encontrado com estes filtros.".
  - Quando ela tenta escolher uma 11ª pessoa
  - Então vê "Escolha até 10 pessoas.", e a 11ª não entra.
  - Dado um link com 12 pessoas visíveis para Rita na Liderança
  - Quando Rita o abre
  - Então valem as 10 primeiras, na ordem do link, as outras 2 saem da URL, e aparece "Escolha até 10 pessoas.".
  - Dado Pedro
  - Quando ele abre o seletor de Liderança
  - Então as opções são só Pedro, Paula, André, Caio, Fábio, Gabriel, Jonas e Carla, sem Samuel nem Tiago.
- **RN-05**
  - Dado Pedro
  - Quando ele abre um link com Liderança: Tiago, que ele não vê
  - Então o filtro aparece como "Pessoa indisponível", com "Esta pessoa não está disponível para você.", sem o nome nem o id de Tiago (nem na tela, nem na resposta do servidor), o botão mostra "Filtros (1)", e a lista fica vazia, com total 0.
  - Quando o link traz Liderança: Tiago e André
  - Então Pedro vê Caio, Fábio, Gabriel e Jonas, e Tiago aparece como "Pessoa indisponível".
  - Quando Pedro tira o chip "Liderança: Pessoa indisponível"
  - Então o id de Tiago sai da URL, e a lista fica só com a Liderança: André.
  - Dado o mesmo link com o id de um membro excluído, ou com um id com formato válido que não existe
  - Então a resposta é a mesma do caso de Tiago.
  - Dado um link com Liderança: "xyz", que não tem formato de id
  - Então "xyz" sai da URL, não aparece "Pessoa indisponível", o filtro não conta, e a lista vem sem o filtro de Liderança.
  - Dado Pedro, que não vê os pastores
  - Quando ele usa a Liderança pela API
  - Então nenhuma resposta traz os ids nem os nomes dos líderes acima de Pedro, além dos nomes de referência que a lista já mostra (RN-06 do E1.08 e RN-10 do E2.06).
- **RN-06**
  - Dados Ana (bairro "São João"), Bruno ("Sao Joao"), Davi ("Jardim São João do Sul") e Elisa (sem bairro), visíveis para Rita
  - Quando Rita filtra Bairro: "  sao   JOÃO "
  - Então vê Ana, Bruno e Davi, e não Elisa.
  - Quando ela filtra Bairro: "%"
  - Então vê só os cadastros cujo bairro contém o caractere "%", e nenhum erro aparece.
  - Dado Caio, do bairro Centro, cuja rua e CEP Pedro não vê
  - Quando Pedro filtra Bairro: Centro
  - Então Caio aparece.
  - Dados Gil, da cidade "Porto Alegre", e Íris, de "Alegrete"
  - Quando Rita filtra Cidade: "alegre"
  - Então vê Gil e Íris, porque as duas cidades contêm o texto.
- **RN-07**
  - Dada Rita
  - Quando ela escolhe Situação: Ativo
  - Então vê os 19 membros menos Fábio (18). Com Situação: Inativo, vê só Fábio.
  - Dado Fábio, inativo e batizado, e Caio, ativo e não batizado
  - Quando Rita escolhe Batizado: Sim
  - Então Fábio aparece e Caio não. Com Batizado: Não, Caio aparece e Fábio não.
- **RN-08**
  - Dada Rita
  - Quando ela escolhe Situação de liderança: Pastor(a)
  - Então vê Samuel e Magda.
  - Quando escolhe Sem liderança
  - Então vê só Ester.
  - Quando escolhe Com líder
  - Então vê os outros 16, inclusive Lúcia, que está abaixo de Ester.
  - Quando escolhe Com líder e Pastor(a)
  - Então vê 18, o mesmo resultado de "Possui Liderança: Sim" no legado.
  - Dada Ester
  - Quando ela escolhe Sem liderança
  - Então vê só a si mesma.
- **RN-09**
  - Dada Rita
  - Quando ela escolhe cada opção de Nível
  - Então vê: Pastores, Samuel e Magda; G12, Pedro, Paula, Tiago, Tânia e Lúcia; 1.728, Caio, Débora e Fábio; 20.736, Gabriel; Nível 5 ou mais, Jonas.
  - Então Ester não aparece em nenhuma opção de Nível.
  - Quando ela escolhe G12 e 144
  - Então vê os 11 membros dos dois níveis.
  - Dado que Rita troca o líder de Jonas para Pedro
  - Quando ela filtra Nível: 144, na primeira consulta depois de salvar
  - Então Jonas aparece em 144 (RN-08 do E2.06).
- **RN-10**
  - Dada Rita
  - Quando ela escolhe cada opção de Vínculo celular
  - Então vê exatamente a tabela "Vínculo celular da massa": Gabriel não aparece em Líder (C4 está inativa), e Jonas não aparece em Líder (C5 está excluída).
  - Então Pedro, Tiago e Tânia não aparecem em nenhuma opção, porque têm célula ativa abaixo; Samuel e Magda também não, porque são pastores.
  - Quando ela escolhe Líder e Timóteo
  - Então vê André, Diego, Débora, Caio, Hugo e Rita.
  - Dado o relatório de C1 de 25/10/2026 (hoje − 30 dias), célula realizada, com a participante Paula
  - Então hoje Paula está em Participante e não está em Sem vínculo.
  - Quando chega quarta-feira, 25/11, às 00:00 de Brasília
  - Então Paula sai de Participante e volta para Sem vínculo.
  - Dado o mesmo relatório com data de 24/10/2026 (hoje − 31 dias)
  - Então hoje Paula não está em Participante.
  - Dado o relatório de C2 de quinta-feira, 29/10/2026, célula realizada, com o participante Jonas
  - Quando o Vínculo celular é consultado no sábado, 28/11, às 23:59 e no domingo, 29/11, às 00:00 de Brasília
  - Então Jonas está em Participante às 23:59 de sábado e volta para Sem vínculo às 00:00 de domingo, como em qualquer outra meia-noite.
  - Dado o relatório de C3 de 17/11/2026, de "Não houve célula", em que Ester aparece como participante (dado vindo do legado)
  - Então Ester não está em Participante e continua em Sem vínculo.
  - Dado o relatório de C2 de 19/11/2026, célula realizada, com a participante Paula, excluído depois
  - Então Paula não está em Participante (RN-12 do E2.01).
  - Dado o relatório de C5 de 20/11/2026, célula realizada, lançado antes da exclusão da célula, com a participante Lúcia
  - Então Lúcia está em Participante (DA-1 do E2.01).
  - Dado Fábio, inativo, participante do relatório de C1 de 18/11/2026, célula realizada
  - Então Fábio está em Participante.
  - Dado Gabriel, participante do relatório de C3 de 10/11/2026, célula realizada
  - Quando Pedro, que não vê C3, filtra Participante
  - Então Gabriel aparece, e Pedro continua sem ver C3 e o relatório.
  - Dada a reativação de C4
  - Quando Rita consulta logo depois
  - Então Gabriel passa para Líder, Jonas para Timóteo e Fábio para Anfitrião, e os três saem de Sem vínculo.
  - Dada a massa, em que Magda só tem C3 abaixo
  - Quando C3 é marcada como inativa
  - Então Magda continua fora de Sem vínculo, porque é pastora.
  - Dados Pedro e Paula, casados
  - Então Paula está em Sem vínculo e Pedro não, porque só Pedro tem célula ativa abaixo dele: o vínculo é de cada pessoa.
- **RN-11**
  - Dada Rita
  - Então hoje (antes deste passo) o card "Sem Vínculo Celular" mostra 6 (Pedro, Paula, Tiago, Tânia, Ester e Lúcia).
  - Depois deste passo, ele mostra 5 (Paula, Gabriel, Jonas, Ester e Lúcia), o mesmo total da lista com Situação: Ativo e Vínculo celular: Sem vínculo.
  - Dado Pedro
  - Então o card mostra 3 (Paula, Gabriel e Jonas), o mesmo total da lista com os mesmos filtros.
  - Dado Diego
  - Então o card mostra 0, e a lista com os mesmos filtros fica vazia.
- **RN-12**
  - Dados Ana, cadastrada em 21/11/2026 às 23:30 de Brasília (02:30 de 22/11 em UTC), e Bruno, cadastrado em 22/11/2026 às 00:10 de Brasília
  - Quando Rita filtra "Cadastrado até" 21/11/2026
  - Então Ana aparece e Bruno não.
  - Quando filtra "Cadastrado a partir de" 22/11/2026
  - Então Bruno aparece e Ana não.
  - Quando filtra de 21/11/2026 até 21/11/2026
  - Então só Ana aparece.
  - Dada Célia, migrada do legado com "data não registrada"
  - Quando Rita usa qualquer um dos dois campos, com qualquer data
  - Então Célia não aparece. Sem filtro de data, ela aparece.
  - Quando Rita informa "a partir de" 25/11/2026 e "até" 20/11/2026
  - Então vê "A data inicial precisa ser igual ou anterior à data final.", e a lista continua sem o filtro de data.
  - Quando informa 31/02/2026 e sai do campo
  - Então vê "Data inválida. Use o formato dd/mm/aaaa.", e o filtro de data não é aplicado. Enquanto ela digita, nenhuma mensagem aparece.
  - Quando, numa terça-feira, 24/11/2026, informa "Cadastrado até" 28/11/2026
  - Então a data é aceita, sem mensagem.
- **RN-13**
  - Dado Pedro, sem "Ver Dados Sensíveis"
  - Quando ele busca o CPF completo de Caio, ou lê a lista pela API filtrando pelo CPF, pelo e-mail, pelo celular, pela rua ou pelo CEP de Caio
  - Então não encontra ninguém.
  - Quando faz o mesmo com o próprio CPF
  - Então encontra o próprio cadastro.
  - Dada Rita, com "Ver Dados Sensíveis"
  - Quando busca o CPF de Caio
  - Então encontra Caio.
- **RN-14**
  - Dada Rita com Nível: 144, Vínculo celular: Líder e 50 por página
  - Quando ela recarrega a página ou volta a ela pelo navegador
  - Então os filtros, a página e o tamanho continuam aplicados.
  - Quando ela envia o link a Pedro
  - Então Pedro vê só André, porque não vê Diego.
  - Dado um link com o nível "abc" e Batizado: Sim
  - Então a lista aplica só Batizado: Sim, "abc" sai da URL, e o botão mostra "Filtros (1)".
  - Dada Rita com três filtros e a busca "ana", na página 2, com 50 por página
  - Quando ela usa "Limpar filtros"
  - Então os filtros e a busca ficam vazios, a lista volta para a página 1 e continua com 50 por página.
  - Dada Rita com Liderança: Pedro, Paula e André, Nível: 144 e 1.728, e as duas datas de cadastro
  - Então o botão mostra "Filtros (3)", e aparecem 7 chips: 3 de Liderança, 2 de Nível e 2 de data.
  - Quando ela tira o chip "Nível: 144"
  - Então só o 144 sai; Nível: 1.728 continua, e o botão continua com "Filtros (3)".
  - Dada Rita só com a busca "ana", sem nenhum filtro
  - Então o botão mostra "Filtros", sem número, e "Limpar filtros" aparece.
  - Quando a busca não encontra ninguém
  - Então a lista mostra "Nenhum membro encontrado com estes filtros." e "Limpar filtros".
- **RN-15**
  - Dada Rita, sem filtros
  - Então a lista vem nesta ordem: Magda, Samuel; Lúcia, Paula, Pedro, Tânia, Tiago; André, Beatriz, Carla, Diego, Hugo, Rita; Caio, Débora, Fábio; Gabriel; Jonas; Ester.
  - Dados 60 membros do nível 144 com o mesmo nome
  - Quando Rita percorre as páginas de 25 em 25
  - Então cada um aparece exatamente uma vez.
  - Quando Rita escolhe Situação: Ativo
  - Então a ordem dos que ficam é a mesma.
- **RN-16**
  - Dada Rita, que vê a igreja toda
  - Quando ela abre "Novo membro"
  - Então o campo Líder já vem com "Rita". Ela pode trocar para outra pessoa visível, tirar o líder e deixar a pessoa sem liderança (RN-10 do E2.02), ou ligar "É Pastor(a)?", que tira o líder (RN-11 do E2.04).
  - Então, no topo do formulário, antes dos dados pessoais, aparece "O líder já vem preenchido com você.", com "Ir para o líder", que leva ao campo Líder.
  - Quando ela troca o líder para André
  - Então o aviso some. Quando ela volta o líder para si mesma, o aviso volta.
  - Quando ela liga "É Pastor(a)?"
  - Então o líder sai, aparece "Pastor(a) não tem líder.", o aviso do topo some, e não aparece "Ao salvar, Rita deixa de ser o líder.". Ao desligar, o líder volta a ser Rita.
  - Dado Pedro
  - Quando ele abre "Novo membro"
  - Então o Líder já vem com "Pedro", como no E2.02, sem o aviso do topo.
  - Dado Samuel, pastor
  - Quando ele abre "Novo membro", preenche os dados e salva sem mexer no Líder
  - Então o membro novo fica com Samuel como líder, no nível G12.
  - Dado um membro inativo cuja função tem "Criar Membro"
  - Quando ele abre "Novo membro"
  - Então o Líder já vem com o nome dele, e o cadastro é aceito com esse líder (o E2.04 aceita líder inativo).
  - Dados Pedro editando Caio, cujo líder é André, e Rita editando Caio
  - Então o Líder continua "André", sem o aviso do topo.
  - Dado um cadastro novo enviado pela API sem líder, sem "É Pastor(a)?" e sem dizer nada sobre "Tem Liderança?"
  - Então ele é recusado com "Escolha o líder." (RN-12 do E2.04), e nenhum líder é preenchido.
- **RN-17**
  - Dados Rita, Pedro e Ester
  - Quando cada um compara cada card de membros do Dashboard com a lista de Membros filtrada pelo equivalente da RN-17
  - Então os números são iguais. Para Rita: Total de Membros 19, Ativos 18, Inativos 1, Sem Liderança 1 (Ester) e Sem Vínculo Celular 5.
  - Dados Ana, cadastrada no sábado, 21/11/2026, às 23:30, e Bruno, no domingo, 22/11/2026, às 00:10 (Brasília)
  - Quando Rita aplica o equivalente de "Novos membros da semana" (de 22/11/2026 até 28/11/2026)
  - Então Bruno aparece e Ana não.

### Textos de tela
Vocabulário de referência. O `ux-designer` pode ajustar o tom, mas não o sentido nem os termos.

- **Termos:** Filtros, Limpar filtros, Liderança, Bairro, Cidade, Situação, Situação de liderança, Batizado, Nível, Vínculo celular, Cadastrado a partir de, Cadastrado até, Pessoa indisponível.
- **Evitar:** "Status", "Indiferente", "Possui Liderança", "Nível Ministerial", "Data de criação", "Formato: dd/mm/aaaa" ao lado do campo de data (P-FIL-23) e anglicismos.

| Situação | Texto |
|---|---|
| botão do painel | Filtros · com filtros ativos: Filtros (<N>), com N de 1 a 9 (RN-14) · leitor de tela: Filtros (<N> ativos) |
| limpar | Limpar filtros · dentro do painel do celular: Limpar · Aplicar filtros |
| busca | Rótulo: Buscar · Placeholder: Nome, e-mail ou CPF |
| Liderança | Rótulo: Liderança · Sem escolha: Escolha uma ou mais pessoas · Dica: Mostra quem está abaixo das pessoas escolhidas, em todos os níveis. Para ver o ministério de um casal, escolha os dois. |
| limite da Liderança | Escolha até 10 pessoas. |
| pessoa indisponível | Pessoa indisponível · Dica: Esta pessoa não está disponível para você. · com mais de uma: Estas pessoas não estão disponíveis para você. |
| Bairro e Cidade | Bairro · Cidade |
| Situação | Todos · Ativo · Inativo |
| Situação de liderança | Com líder · Sem liderança · Pastor(a) |
| Batizado | Todos · Sim · Não |
| Nível | Pastores · G12 · 144 · 1.728 · 20.736 · Nível 5 ou mais · Dica: Quem está sem liderança não tem nível. Use a Situação de liderança. |
| Vínculo celular | Líder · Timóteo · Anfitrião · Participante · Sem vínculo · Dica do grupo: Líder, timóteo e anfitrião contam só em células ativas. |
| dica de Participante | Esteve em pelo menos uma célula realizada nos últimos 30 dias. |
| dica de Sem vínculo | Não é líder, timóteo nem anfitrião de célula ativa, não esteve em célula nos últimos 30 dias e não tem célula ativa abaixo dele. |
| múltipla escolha sem nada escolhido | Todos |
| datas | Cadastrado a partir de · Cadastrado até · legenda (leitor de tela): Data de cadastro · Dica: Cadastros antigos sem data de cadastro não aparecem quando há filtro de data. |
| data inválida | Data inválida. Use o formato dd/mm/aaaa. |
| intervalo invertido | A data inicial precisa ser igual ou anterior à data final. |
| chips | Liderança: <Nome> · Liderança: Pessoa indisponível · Bairro: <texto> · Cidade: <texto> · Situação: <opção> · Situação de liderança: <opção> · Batizado: <opção> · Nível: <opção> · Vínculo celular: <opção> · Cadastrado a partir de <dd/mm/aaaa> · Cadastrado até <dd/mm/aaaa> · leitor de tela: Remover filtro <texto do chip> |
| lista vazia com filtros ou com a busca | Nenhum membro encontrado com estes filtros. · Limpar filtros |
| lista vazia sem filtros nem busca | Nenhum membro encontrado. |
| erro ao carregar | Não foi possível carregar os membros. Verifique a conexão e tente de novo. · Tentar de novo |
| total | <N> membros (ou 1 membro), já com os filtros |
| Novo membro, para quem vê a igreja toda (RN-16) | O líder já vem preenchido com você. · Ir para o líder |

Os demais textos da tela (descrição do painel, "Carregando…", "nome não carregado") estão em Experiência (UX) > Textos e foram aceitos sem ajuste (P-FIL-25).

### Fora de escopo
Cada item indica o passo que cuida dele, quando há um.
- **Colunas Nível, Liderança e totais** na lista de Membros: E2.06 (RN-10 de lá).
- **Situação do relatório por célula** (CEL-05): E2.09.
- **Filtros de Células** (CEL-06) e detalhe da célula: E2.10. **Filtros de Relatórios** (REL-13): E2.12.
- **Clique nos cards do Dashboard** (DSH-05) e **card "Novos membros"** (DSH-02): E2.14. Este passo só garante o equivalente na lista (RN-17) e alinha a definição do card "Sem Vínculo Celular" (RN-11).
- **Raiz da árvore de Ministérios pelo escopo** (MIN-02): E2.15.
- **Coluna ou selo de vínculo celular** na lista: fora. O legado não mostrava; fica como sugestão.
- **Filtros que a tela do legado não tinha** (UF, e-mail, sexo, idade, aniversário, data do batismo): sem passo no plano.
- **Escolher a ordem da lista**, salvar filtros e exportar a lista de Membros: sem passo no plano. O legado não tinha.
- **Filtros na lista "Excluídos"** (E2.01) e nos seletores de líder, cônjuge, timóteo, anfitrião e participantes: fora. Continuam só com a busca.
- **Categoria para quem só tem células abaixo** (Q-3) e **vínculo do casal** (Q-4): fora, até a decisão.
- **Consolidação:** feature futura, com spec próprio.

### Impactos em outros passos
Pontos de negócio que outros passos precisam respeitar. O `architect` decide como.
- **E2.14:**
  - liga o clique de cada card de membros à lista com os filtros da RN-17, pela URL (RN-14);
  - o card "Novos membros da semana" usa a data de cadastro (RN-12), de domingo a sábado da semana atual;
  - se mudar a definição de algum card de membros, atualiza a linha da RN-17 no mesmo passo.
- **E1.08:** a ordem de Membros da RN-03 de lá passa a ser a da RN-15 daqui. A definição de "sem vínculo" da RN-08 (c) de lá passa a ser a da RN-10 daqui. O texto do E1.08 fica como histórico.
- **E2.06:**
  - a RN-02 e as "Definições" citam o filtro "Possui liderança". Ele passa a se chamar "Situação de liderança" (RN-08). Ajustar o texto no aceite;
  - as "Definições" deixadas para o E2.07 ficam respondidas: liderança por seletor (RN-04), "Sem vínculo" com total de células zero (RN-10) e ordem por nível (RN-15).
- **E2.02:** o líder já preenchido (P-PER-22, UXD-3) vale para todos (RN-16). O formulário de quem vê a igreja toda passa a vir com o líder preenchido, ao contrário da justificativa da PO-UX-6 de lá, e com o aviso do topo como mitigação (P-FIL-16; ver Q-1). Para quem vê só o ministério, nada muda.
- **E2.04:** no cadastro novo, o líder já preenchido não conta como "havia líder" para o aviso "Ao salvar, {Nome} deixa de ser o líder." da RN-11 e da RN-12 de lá (RN-16 daqui, P-FIL-16). O aviso continua valendo na edição. Ajustar o texto do E2.04 no aceite.
- **E2.10 e E2.12:** recomenda-se usar os mesmos padrões: combinação (RN-02), escopo (RN-03), pessoa por seletor e pessoa indisponível (RN-04, RN-05), texto sem acento (RN-06), datas de Brasília com os dois dias incluídos e "data não registrada" fora (RN-12), e filtros na URL (RN-14).
- **E2.11:** se a RPC de relatório incluir automaticamente o líder, o timóteo e o anfitrião num relatório de "Não houve célula" (REL-07), isso não dá a eles vínculo de Participante (RN-10 d).
- **E5.04 (homologação):** os números de "Sem vínculo celular" do novo e do legado não batem, e isso é esperado. O card do legado contava também inativos e pastores, não tinha células inativas e contava relatórios de "Não houve célula". O mesmo vale para o filtro de nível acima do 6º nível, que o legado não guardava.
- **Consolidação:** quando existir, o consolidado não aparece na lista de Membros nem nos filtros, cards e totais daqui, a não ser que o spec da Consolidação diga outra coisa.
- **Aceite (PO):**
  - no `docs/migracao.md`: MEM-13, MEM-14 e MEM-15 em ✅;
  - no `CLAUDE.md`: a linha "Filtros de membros" da matriz de paridade em ✅.

### Perguntas em aberto
Nenhuma bloqueia a implementação: cada uma já tem um padrão adotado, que vale se o usuário não decidir outra coisa no PR. A T9 da Experiência (UX) mostra como a tela fica com cada resposta; nenhuma muda a estrutura das telas.

- **Q-1. Líder preenchido para quem vê a igreja toda.** A MEM-15 do legado preenchia para todos, e o plano pede o mesmo. No E2.02, a UX preferiu não preencher para quem vê a igreja toda, porque a secretaria cadastra pessoas de qualquer ministério e poderia salvar com ela mesma como líder sem perceber (PO-UX-6). **Padrão adotado:** preencher para todos (RN-16), com o aviso no topo do formulário e o atalho "Ir para o líder" para quem vê a igreja toda (P-FIL-16). Alternativa: só para quem vê o ministério; aí o formulário de quem vê a igreja toda abre com o Líder vazio e sem aviso (UX-24).
- **Q-2. Ordem padrão da lista.** **Padrão adotado:** por nível, como no legado (RN-15). Alternativa: por nome, como o novo faz hoje (RN-03 do E1.08), que ajuda a achar uma pessoa sem usar a busca.
- **Q-3. Quem só acompanha a rede.** Um G12 que não é líder, timóteo nem anfitrião e não esteve em célula, mas tem células ativas abaixo, não aparece em nenhuma opção de Vínculo celular (no exemplo, Pedro). **Padrão adotado:** como no legado, sem opção própria. Alternativa: uma opção a mais, por exemplo "Só pelos discípulos".
- **Q-4. Vínculo e liderança por casal.** O vínculo é de cada pessoa: a esposa de um G12 com células abaixo dele aparece em "Sem vínculo" se não tiver célula abaixo dela (no exemplo, Paula). E escolher uma pessoa casada na Liderança não traz a descendência do cônjuge. **Padrão adotado:** cada pessoa, como no legado; para o casal, escolhem-se os dois. Alternativa: tratar o casal como unidade nos dois casos.

### Pontos para o `architect`
Não são dúvidas de negócio. São pontos em que a regra depende de uma escolha técnica.
- **Cadeia de liderança** (RN-05). O E2.06 propõe a cadeia materializada (`ancestor_ids`). Expor essa coluna na `members_view` revelaria os ids dos líderes acima de cada membro visível, inclusive os de quem a pessoa não vê, o que fere a RN-23 do E2.02. O filtro "abaixo de X" precisa responder sem expor a cadeia, e X precisa ser visível.
- **Uma definição de vínculo** (RN-10, RN-11). Os sinais da `members_view` e o card da `dashboard_summary` precisam usar a mesma definição, num lugar só. Hoje os sinais contam células inativas e relatórios de "Não houve célula", e "Sem vínculo" não confere o total de células.
- **Ordem** (RN-15). Nível com "sem liderança" por último, nome sem diferenciar acentos e desempate estável, em 20 mil membros e com filtros.
- **Bairro e cidade** (RN-06). "Contém", sem acento, dentro da meta de 2 s da RN-02.
- **Data de cadastro** (RN-12). A data de Brasília do momento do cadastro, com a "data não registrada" do E2.05 sempre fora dos filtros de período.
- **URL** (RN-14). Validação dos valores, com os inválidos ignorados, e ids de pessoas na Liderança sem resolver nomes de quem não é visível (RN-05).
- **Ordem dos passos.** Este passo usa o nível de quem está sem liderança e a cadeia do E2.06, e a data de cadastro do E2.05. Pela ordem do E2.05, o E2.07 entra depois do E2.05 e do E2.06.

## Experiência (UX)
_Seção do `ux-designer`. Escrita em 2026-11-24 a partir destas fontes:_
- _a seção Negócio (RN-01 a RN-17, P-FIL-01 a P-FIL-15, a massa de exemplo, os Textos de tela, os Pontos para o `architect` e as perguntas Q-1 a Q-4);_
- _o código da `origin/main` do `mci-connect` (`fdcbe50`): `src/pages/Members.tsx`, `use-list-search-params.ts`, `use-members-list.ts`, `use-member-options.ts`, `AsyncMemberSelect.tsx`, `select/PaginatedSelect.tsx`, `ListPagination.tsx`, `MemberForm.tsx` e `Dashboard.tsx`;_
- _o que já foi desenhado para as mesmas telas: o cabeçalho de Membros e o líder já preenchido do [E2.02](e2-02-perfis-escopo.md) (T5, T6, P10 e P11), o formulário de membro do [E2.04](e2-04-validacoes-membro.md) (T1, T4 e P20), os filtros da Auditoria do [E2.05](e2-05-auditoria-autor.md) (T7, T8 e P33) e a lista de Membros do [E2.06](e2-06-hierarquia-totais.md) (T1, P40 a P42, P44 e P45);_
- _o legado, só para manter o que os usuários conhecem: o painel "Filtros" com "Limpar filtros", a ordem dos campos e a lista por nível (`UI/pages/Members/index.js`)._

_Este passo só é implementado depois do E2.05 e do E2.06, então o desenho parte das telas deles, e não do código de hoje. Usa os padrões P1 a P45. Os padrões novos começam em P50, para não colidir com os outros specs. Nenhuma regra de negócio foi criada aqui. Onde a tela precisou de algo que o spec não diz, a decisão é a mais conservadora, marcada como "definido pela UX" e listada em "Pendências para o PO". Os nomes são os da [massa de exemplo](#massa-de-exemplo); os sobrenomes existem só nos wireframes, como no E2.06 (Gabriel Costa e Jonas Prado são novos)._

### O que muda, tela a tela
Nenhuma tela nova e nenhuma rota nova.

| Tela | O que muda | Para quem |
|---|---|---|
| Membros: lista (T1, T6) | A busca ganha rótulo. Entram o botão "Filtros ({N})", os chips dos filtros ativos e "Limpar filtros". O total vira texto ("4 membros"), no lugar do badge com o número. A lista passa a vir por nível e nome. Carregando com `Skeleton`, vazio com filtros e erro com "Tentar de novo". | quem tem a lista de Membros |
| Painel de filtros (T2 a T5) | Os 9 filtros: num `Sheet` abaixo de 1024 px, aplicados em "Aplicar filtros"; num painel recolhível acima da lista a partir de 1024 px, aplicados na hora. "Pessoa indisponível" na Liderança. | idem |
| Novo membro (T7) | O Líder já vem preenchido com quem cadastra, para todos. Para quem vê a igreja toda, um aviso no topo do formulário, com "Ir para o líder". | quem tem "Criar Membro" |
| Dashboard (T8) | Sem mudança visual. O número de "Sem Vínculo Celular" passa a seguir a RN-10 (RN-11). | — |

### Coerência com os outros specs
- **E1.08:** a lista continua no `useListSearchParams` (`q`, `page` e `size`), no `ListPagination`, no `useClampPage` e no `placeholderData`. Os filtros entram na mesma URL, com as mesmas regras: os valores padrão não aparecem, a troca é com `replace` (sem uma entrada no histórico a cada mudança) e mudar um filtro volta para a página 1. Muda a ordem (RN-15).
- **E2.02:**
  - o subtítulo com o alcance (P10) continua, e é ele que explica o alcance do filtro de Liderança (UXD-8);
  - o seletor de Liderança só oferece quem a pessoa vê, como o P11, com "Nenhum membro do seu ministério encontrado.";
  - o líder já preenchido de quem vê só o ministério (T6, UX-17 de lá) não muda;
  - sem a lista de Membros, vale o estado sem acesso da T12.
- **E2.04 (T1 e T4):** o formulário não muda de estrutura. No cadastro novo, com o Líder já preenchido, "É Pastor(a)?" e "Tem Liderança?" escondem e devolvem o líder como a T4 de lá descreve, mas sem o aviso do P20 ("Ao salvar, … deixa de ser o líder."), que fala de um dado já gravado (UXD-11).
- **E2.05 (T7, T8 e P33):** seguem a Auditoria o botão "Filtros ({N})", o `Sheet` com "Limpar" e "Aplicar filtros", os chips removíveis, o vazio com "Limpar filtros", o `Skeleton` e o erro com "Tentar de novo". Mudam, porque aqui são 9 filtros, e não 5:
  - o painel acima da lista começa em 1024 px, e não em 768 px, e é recolhível (P50);
  - "Limpar filtros" fica ao lado do botão "Filtros", e não depois dos chips, que podem passar de 20 (UXD-6);
  - as datas seguem o P33 com os rótulos e as mensagens do Negócio e sem data máxima (P54).
- **E2.06:**
  - os cartões e a tabela (T1, P40 a P42, P45) não mudam. O painel acompanha o P45: `Sheet` enquanto a lista é de cartões (até 1023 px) e painel acima da lista quando ela é tabela;
  - as opções de Nível usam os rótulos do P40, com "Pastores" e a opção de filtro "Nível 5 ou mais";
  - a lista filtrada que recarrega depois de uma gravação segue o P44.
- **E2.14:** o clique de cada card de membros abre `/members` com os parâmetros da tabela de [Navegação e rotas](#navegação-e-rotas), que este spec propõe (AQ-1).
- **E2.10 e E2.12:** os filtros de Células e de Relatórios podem seguir os padrões P50 a P54.

### Decisões de experiência
| # | Decisão | Por quê |
|---|---|---|
| UXD-1 | **O painel muda com a largura (P50).** Abaixo de 1024 px, os filtros ficam num `Sheet` (de baixo no celular; da direita entre 768 e 1023 px), aberto por "Filtros ({N})". A partir de 1024 px, ficam num painel acima da lista, aberto e fechado pelo mesmo botão. Os filtros ativos aparecem como chips sempre que os campos não estão à vista. | São 9 filtros. No celular, eles empurrariam a lista para a terceira tela. Até 1023 px a lista é de cartões (P45), com 464 a 720 px de largura, e os campos não cabem em colunas. A partir de 1024 px eles cabem em 4 colunas, mas ocupam cerca de 300 px de altura: recolhível, o painel não esconde a lista de quem só procura um nome. |
| UXD-2 | **No celular e no tablet, os filtros valem em "Aplicar filtros". No computador, valem na hora** (os de texto, 300 ms depois da última tecla). | Como na Auditoria (E2.05). Numa conexão fraca, uma consulta a cada toque seria lenta e gastaria dados. No computador, o efeito imediato é o que a secretaria espera, e o legado já era assim. |
| UXD-3 | **A ordem dos campos é a do legado:** Liderança, Bairro, Cidade, Situação, Situação de liderança, Batizado, Nível, Vínculo celular e as datas de cadastro. É a mesma no `Sheet`, no painel e no DOM. | Reaprender custa caro na migração. A mesma ordem nos dois tamanhos faz o leitor de tela ler igual. |
| UXD-4 | **Cada tipo de filtro tem um controle (P51 a P54).** Escolha única (Situação, Batizado): `RadioGroup` no `Sheet` e `Select` no painel. Múltipla escolha (Situação de liderança, Nível, Vínculo celular): caixas de seleção no `Sheet` e, no painel, um botão com o que foi escolhido, que abre as mesmas caixas num `Popover`. Liderança: o `PaginatedSelect` múltiplo nos dois. Datas: o campo de data nativo. | No celular, as opções à vista custam 1 toque, e o `Select` custa 2. No painel, as caixas de Nível e de Vínculo celular, com as dicas, ocupariam mais de 250 px de altura numa coluna de 156 px. O `Popover` reaproveita a mesma lista. |
| UXD-5 | **Um chip por valor escolhido, e o número do botão conta filtros, e não valores.** "Liderança: Pedro Alves" e "Liderança: Paula Alves" são dois chips e um filtro. As duas datas são um filtro. O número vai de 1 a 9. *Definido pela UX (PO-UX-4).* | O "✕" do chip tira um valor só, como a pessoa espera. O número diz quantos dos 9 filtros estão em uso, como pede a RN-14, e não cresce com as 10 pessoas da Liderança. |
| UXD-6 | **"Limpar filtros" fica ao lado do botão "Filtros"**, e não depois dos chips. | Com 10 pessoas na Liderança e mais filtros, os chips passam de 20 e ocupam várias linhas. Depois deles, "Limpar filtros" mudaria de lugar a cada filtro e sairia da tela. |
| UXD-7 | **A pessoa indisponível aparece como "Pessoa indisponível", sem nome, com a dica do Negócio embaixo do campo e dos chips (P53).** Os nomes das pessoas escolhidas vêm só da leitura das pessoas visíveis. | RN-05. A dica evita que a pessoa ache que o filtro quebrou quando a lista fica vazia. A `member_names`, que os seletores usam hoje para o valor escolhido, resolve também o líder de quem a pessoa vê: para Pedro, ela devolveria "Samuel" (AQ-2). |
| UXD-8 | **O filtro de Liderança não tem a dica de alcance do P11.** O alcance já está no subtítulo da página ("Membros do seu ministério"), e a busca sem resultado usa o texto do P11. | A dica do Negócio já tem duas frases. Uma terceira empurraria os outros filtros no celular, sem dizer nada que o subtítulo não diga. |
| UXD-9 | **Duas dicas a mais:** em Nível, "Quem está sem liderança não tem nível. Use a Situação de liderança."; em Vínculo celular, "Líder, timóteo e anfitrião contam só em células ativas.". *Definido pela UX (PO-UX-7).* | São os dois resultados que mais surpreendem: Ester não aparece em nenhum nível (RN-09), e Gabriel, líder de C4 (inativa), não aparece em "Líder" (RN-10). |
| UXD-10 | **As datas seguem o P33, com os rótulos e as mensagens do Negócio e sem data máxima (P54).** O "Formato: dd/mm/aaaa" não aparece, porque o campo nativo já mostra o formato. *Definido pela UX (PO-UX-8).* | O equivalente do card "Novos membros da semana" vai até o sábado (RN-17), uma data futura em quase toda a semana. Com o `max` do P33, o link do E2.14 abriria com o campo fora do limite. |
| UXD-11 | **O Líder já vem preenchido para todos (RN-16). Para quem vê a igreja toda, um aviso no topo do formulário diz isso, com "Ir para o líder" (P55).** O aviso some quando o líder deixa de ser quem cadastra. No cadastro novo, "É Pastor(a)?" e "Tem Liderança?" não mostram o aviso do P20. *Definido pela UX (PO-UX-1).* | É o risco da PO-UX-6 do E2.02: a secretaria cadastra gente de qualquer ministério, e o Líder fica em "Dados ministeriais", depois de uns 12 campos. Com o rodapé fixo, ela salva sem rolar até ele. O aviso é lido ao abrir, custa duas linhas e não acrescenta passo a quem cadastra em volume, ao contrário de uma confirmação ao salvar. O P20 diria "Rita Gomes deixa de ser o líder" de um cadastro que ainda não existe. |
| UXD-12 | **A ordem por nível não ganha cabeçalhos de grupo nem indicador visual.** Na tabela, a coluna Nível leva `aria-sort="ascending"`. | O badge do nível (P40), no começo de cada cartão e de cada linha, já mostra a ordem. Cabeçalhos por nível partiriam a página de 25 em grupos e pesariam no celular. |
| UXD-13 | **A busca ganha o rótulo "Buscar" e o placeholder "Nome, e-mail ou CPF". O total vira "{N} membros", com `role="status"`, no lugar do badge com o número.** | Como na Auditoria (E2.05). O placeholder some ao digitar e não serve de rótulo. O número solto no badge não diz o que conta, e o leitor de tela não o anuncia quando um filtro muda o resultado. |
| UXD-14 | **O painel do computador começa fechado e lembra, neste navegador, se ficou aberto.** | Quem filtra muito (a secretaria) abre uma vez, e o painel fica aberto nas próximas visitas. Quem só procura um nome (pastores, líderes) não perde 300 px da tela. |
| UXD-15 | **Ao abrir o `Sheet`, o foco vai para o título "Filtros", e não para o primeiro campo.** | O primeiro campo é a busca da Liderança. O foco nele abriria o teclado do celular, que cobriria metade do painel antes de a pessoa escolher o que quer filtrar. |

### Navegação e rotas
**Nenhuma rota nova.** A `/members` passa a guardar os filtros na URL, junto com `q`, `page` e `size`. Os nomes são sugestões (AQ-1):

| Filtro | Parâmetro | Valores |
|---|---|---|
| Liderança | `leaders` | até 10 ids, separados por vírgula, na ordem da escolha |
| Bairro | `neighborhood` | texto, até 100 caracteres |
| Cidade | `city` | texto, até 100 caracteres |
| Situação | `status` | `active` ou `inactive` |
| Situação de liderança | `leadership` | `with_leader`, `no_leadership` e `pastor`, separados por vírgula |
| Batizado | `baptized` | `yes` ou `no` |
| Nível | `level` | `0` a `4` e `5plus`, separados por vírgula |
| Vínculo celular | `cell_link` | `leader`, `timothy`, `host`, `attendee` e `none`, separados por vírgula |
| Cadastrado a partir de / até | `from` / `to` | `aaaa-mm-dd`, datas de Brasília |

- **Valores padrão** ("Todos", vazio) não aparecem. Nos filtros de múltipla escolha, os valores repetidos saem, e a ordem é a das opções, menos em `leaders`, que guarda a ordem da escolha.
- **Valor inválido** (formato errado, opção desconhecida, data que não existe, como `2026-02-31`): sai da URL na primeira leitura, como o `?report=` do E2.01 e os filtros da Auditoria, e não conta como filtro ativo (RN-14).
- **Liderança:**
  - um id com formato válido de uma pessoa que quem consulta não vê, que foi excluída ou que não existe **fica** na URL e aparece como "Pessoa indisponível" (RN-05);
  - um id com formato inválido sai, como qualquer valor inválido (PO-UX-3);
  - com mais de 10 ids, valem os 10 primeiros, os outros saem, e aparece "Escolha até 10 pessoas." (PO-UX-2).
- **"Limpar filtros"** tira da URL os filtros, `q` e `page`, e mantém `size` (RN-14).
- **Mudar qualquer filtro** tira `page` (página 1). No celular, isso acontece em "Aplicar filtros" e no "✕" de um chip.
- **Painel aberto ou fechado (computador)** não vai para a URL: fica guardado no navegador (`localStorage`), porque é preferência de quem usa, e não estado da lista.
- **Links prontos (E2.14):** os equivalentes da RN-17, por exemplo `/members?status=active&cell_link=none` (Sem Vínculo Celular) e `/members?status=active&leadership=no_leadership` (Sem Liderança).

### Fluxos
Contagem no celular, a partir de qualquer tela com o menu fechado, incluindo o toque no ☰. "Toque" não conta a digitação.

| # | História | Caminho | Toques e telas |
|---|---|---|---|
| F1 | O líder encontra quem está sem vínculo no ministério (Pedro) | ☰ → Membros → "Filtros" → Situação "Ativo" → Vínculo celular "Sem vínculo" → "Aplicar filtros" → Paula, Gabriel e Jonas | 6 toques; 1 tela e 1 painel |
| F2 | O líder vê a rede de um discípulo (Pedro) | ☰ → Membros → "Filtros" → Liderança → digita "and" → André Souza → "Aplicar filtros" → Caio, Fábio, Gabriel e Jonas | 6 toques e a digitação |
| F3 | A liderança vê o ministério de um casal (Rita) | F2, escolhendo Pedro Alves e Paula Alves | +1 toque e a digitação |
| F4 | Tirar um filtro | "✕" no chip | 1 toque |
| F5 | Tirar todos os filtros e a busca | "Limpar filtros" | 1 toque |
| F6 | A secretaria procura os cadastros de um bairro num período (Rita, computador) | Membros → "Filtros" (se o painel estiver fechado) → Bairro (digita) → Cadastrado a partir de → Cadastrado até; a lista atualiza a cada campo | 2 cliques, a digitação e as 2 datas |
| F7 | Abrir uma lista filtrada por um link (compartilhado, ou o card do Dashboard no E2.14) | toque no link → lista filtrada, com os chips e o total | 1 toque |
| F8 | Link com uma pessoa que quem abre não vê (Pedro, com Tiago) | link → "Liderança: Pessoa indisponível", a dica e a lista vazia → "✕" no chip ou "Limpar filtros" | 2 toques |
| F9 | O líder cadastra um discípulo (Pedro) | ☰ → Membros → "Novo membro" → Líder já com Pedro → dados → "Criar membro" | igual ao F2 do E2.04: 5 toques e a digitação |
| F10 | A secretaria cadastra alguém de outro ministério (Rita, computador) | Membros → "Novo membro" → lê o aviso → "Ir para o líder" (opcional) → troca o líder → dados → "Criar membro" | igual ao F1 do E2.04 (5 cliques e a digitação); +1 com "Ir para o líder" |
| F11 | A secretaria cadastra um discípulo dela (Rita) | Membros → "Novo membro" → dados → "Criar membro", sem tocar no Líder | 2 cliques a menos que o F10 |

No F2, o primeiro toque fora do menu do seletor já vale em "Aplicar filtros": o menu fecha e o painel aplica no mesmo toque.

### Telas
Convenções do E2.04, do E2.05 e do E2.06: 360 px ≈ 38 colunas; `[Botão]` é botão; `[▾]` é seleção; `( )` e `(•)` são as opções de escolha única; `[ ]` e `[x]` são caixas de seleção; `[○  ]` e `[  ●]` são o interruptor desligado e ligado; `(… ✕)` é um chip removível ou uma pessoa escolhida; `(i)` é informação; `⚠` é erro. Novos: `⌕` é o ícone `Search`; `⚲` é o ícone `SlidersHorizontal`; `⌄` e `⌃` são o painel fechado e aberto (`ChevronDown`). A margem lateral é a do `AppLayout` (`p-4`).

#### T1. Membros: lista com filtros aplicados
Celular e tablet (até 1023 px), com Rita, depois de escolher Liderança: Pedro Alves e Situação: Ativo (critério da RN-04). A busca, os filtros e a lista ficam dentro do `Card` da lista, como hoje.
```
┌──────────────────────────────────────┐
│ ☰                                    │
│ Membros                              │  h1
│ Membros de toda a igreja             │  subtítulo (P10)
│ [+ Novo membro                     ] │  E2.02 (T5)
│──────────────────────────────────────│
│ Buscar                               │
│ [⌕ Nome, e-mail ou CPF             ] │  h-11 (UXD-13)
│ [⚲ Filtros (2)] [Limpar filtros]     │  outline e ghost, h-11 (UXD-6)
│ (Liderança: Pedro Alves ✕)           │  chips, h-9 (P50)
│ (Situação: Ativo ✕)                  │
│ 4 membros                            │  role="status"
│──────────────────────────────────────│
│ (foto) André Souza         [✎]  [⋯]  │  cartão do E2.06 (T1)
│        andre@exemplo.com             │
│ [144] [Ativo]                        │
│ Liderança: Pedro Alves               │
│ 3 discípulos · 1 célula              │
├──────────────────────────────────────┤
│ (foto) Caio Lima           [✎]  [⋯]  │
│ [1.728] [Ativo]                      │
│ Liderança: Pedro Alves / André Souza │
├──────────────────────────────────────┤
│ (foto) Gabriel Costa       [✎]  [⋯]  │
│ [20.736] [Ativo]                     │
│ Liderança: Pedro Alves / Fábio Lima  │
├──────────────────────────────────────┤
│ (foto) Jonas Prado         [✎]  [⋯]  │  ordem por nível e nome (RN-15)
│ [Nível 5] [Ativo]                    │
│ Liderança: Pedro Alves / Gabriel     │
│ Costa                                │
│──────────────────────────────────────│
│ 4 membros                            │  ListPagination (E1.08)
│ [25▾] por página                     │
│ [«][‹] Página 1 de 1 [›][»]          │
└──────────────────────────────────────┘
```
Computador (a partir de 1024 px), com o painel fechado:
```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Membros                                                                      [+ Novo membro] │
│ Membros de toda a igreja                                                                     │
│──────────────────────────────────────────────────────────────────────────────────────────────│
│ Buscar                                                                                       │
│ [⌕ Nome, e-mail ou CPF                 ]  [⚲ Filtros (2) ⌄]  [Limpar filtros]                │  painel fechado
│ (Liderança: Pedro Alves ✕)  (Situação: Ativo ✕)                                              │  chips só com o painel fechado
│ 4 membros                                                                                    │  role="status"
│ Nome           │ Nível     │ Liderança                 │ Ministério    │ Situação │ Ações    │  aria-sort="ascending" no Nível
│ André Souza    │ [144]     │ Pedro Alves               │ 3 discípulos  │ [Ativo]  │ [✎] [⌫]  │
│                │           │                           │ 1 célula      │          │          │
│ Caio Lima      │ [1.728]   │ Pedro Alves / André Souza │ 0 discípulos  │ [Ativo]  │ [✎] [⌫]  │
│                │           │                           │ 0 células     │          │          │
│ Gabriel Costa  │ [20.736]  │ Pedro Alves / Fábio Lima  │ 1 discípulo   │ [Ativo]  │ [✎] [⌫]  │
│                │           │                           │ 0 células     │          │          │
│ Jonas Prado    │ [Nível 5] │ Pedro Alves /             │ 0 discípulos  │ [Ativo]  │ [✎] [⌫]  │
│                │           │ Gabriel Costa             │ 0 células     │          │          │
│──────────────────────────────────────────────────────────────────────────────────────────────│
│ 4 membros                                      [25▾] por página  [«][‹] Página 1 de 1 [›][»] │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```
- **Cabeçalho:** o `h1`, o subtítulo (P10) e "Novo membro" (T5 do E2.02), sem mudança.
- **Busca (UXD-13):** `Input` com o rótulo "Buscar" visível, o ícone `Search` (`aria-hidden`), o placeholder "Nome, e-mail ou CPF" †, `type="search"`, `enterKeyHint="search"`, `maxLength={100}` e `h-11` no celular. O resto como no E1.08 (300 ms, sem diferenciar acentos).
- **Botão "Filtros" (P50):** `Button variant="outline"`, com o ícone `SlidersHorizontal` e `h-11`. Mostra "Filtros" sem filtro ativo e "Filtros ({N})" com N de 1 a 9 (UXD-5).
  - Abaixo de 1024 px, abre o `Sheet` (T2).
  - A partir de 1024 px, abre e fecha o painel (T3), com o ícone `ChevronDown`, que gira quando o painel está aberto.
- **"Limpar filtros" (UXD-6):** `Button variant="ghost"`, com `h-11`, logo depois de "Filtros", só quando há pelo menos um filtro ativo ou texto na busca. Limpa os filtros e a busca, volta para a página 1 e mantém o tamanho da página (RN-14). O foco vai para "Filtros". Em 320 px, ele desce para a linha de baixo (`flex-wrap`).
- **Chips (P50):** um por valor (UXD-5), na ordem dos campos (UXD-3) e, na Liderança, na ordem da escolha. Aparecem quando os campos não estão à vista: sempre abaixo de 1024 px; a partir daí, só com o painel fechado.
  - Cada chip é um `button` com `h-9`, o ícone `X` (`aria-hidden`) e `aria-label="Remover filtro {texto do chip}"`, com 8 px entre eles e quebra de linha. Os textos estão na tabela de Textos.
  - O toque tira o valor na hora, também no celular (sem "Aplicar filtros"), e volta para a página 1. O foco vai para o próximo chip ou, se não houver, para "Filtros".
- **Pessoa indisponível:** ver T4.
- **Total (UXD-13):** "{N} membros" ou "1 membro" (`formatCount`), acima da lista, com `role="status"`, e também no `ListPagination`. Enquanto a nova consulta carrega, o total anterior continua, e a lista fica com `opacity-60` e `aria-busy="true"` (E1.08).
- **Ordem (RN-15, UXD-12):** nível e nome, sem cabeçalhos de grupo. Na tabela, `aria-sort="ascending"` no título "Nível". Os cartões e a tabela são os do E2.06 (T1).
- Componentes: `Card`, `Input`, `Button`, `Badge`, `Table`, `Skeleton`, `Alert` e `ListPagination`, mais os da T2 e da T3.

#### T2. Painel de filtros no celular e no tablet (`Sheet`)
Celular (360 px), com os filtros em vigor da T1:
```
┌──────────────────────────────────────┐
│ Filtros                          [✕] │  SheetTitle, recebe o foco ao abrir
│──────────────────────────────────────│
│ Liderança                            │
│ [(Pedro Alves ✕)                  ▾] │  PaginatedSelect múltiplo (T4)
│ Mostra quem está abaixo das pessoas  │  dica do Negócio, aria-describedby
│ escolhidas, em todos os níveis. Para │
│ ver o ministério de um casal,        │
│ escolha os dois.                     │
│ Bairro                               │
│ [                                  ] │  h-11
│ Cidade                               │
│ [                                  ] │
│ Situação                             │  legend
│ [( ) Todos][(•) Ativo][( ) Inativo]  │  RadioGroup, min-h-11 (P52)
│ Situação de liderança                │  legend
│ [ ] Com líder    [ ] Sem liderança   │  Checkbox, min-h-11 (P51)
│ [ ] Pastor(a)                        │
│ Batizado                             │
│ [(•) Todos ][( ) Sim   ][( ) Não   ] │
│ Nível                                │
│ [ ] Pastores   [ ] G12   [ ] 144     │
│ [ ] 1.728   [ ] 20.736               │
│ [ ] Nível 5 ou mais                  │
│ Quem está sem liderança não tem      │  dica † (UXD-9)
│ nível. Use a Situação de liderança.  │
│ Vínculo celular                      │
│ Líder, timóteo e anfitrião contam só │  dica † (UXD-9)
│ em células ativas.                   │
│ [ ] Líder [ ] Timóteo [ ] Anfitrião  │
│ [ ] Participante                     │  com dica: linha inteira
│     Esteve em pelo menos uma célula  │  dica do Negócio
│     realizada nos últimos 30 dias.   │
│ [ ] Sem vínculo                      │
│     Não é líder, timóteo nem         │  dica do Negócio
│     anfitrião de célula ativa, não   │
│     esteve em célula nos últimos 30  │
│     dias e não tem célula ativa      │
│     abaixo dele.                     │
│ Cadastrado a partir de               │
│ [dd/mm/aaaa                        ] │  type="date", h-11 (P54)
│ Cadastrado até                       │
│ [dd/mm/aaaa                        ] │
│ Cadastros antigos sem data de        │  dica do Negócio
│ cadastro não aparecem quando há      │
│ filtro de data.                      │
│──────────────────────────────────────│
│ [Limpar         ] [Aplicar filtros ] │  rodapé fixo, h-11
└──────────────────────────────────────┘
```
- **Contêiner:** `Sheet` com `side="bottom"` e `max-h-[90dvh]` abaixo de 768 px; com `side="right"`, `w-full sm:max-w-md` e a altura toda de 768 a 1023 px. O lado é escolhido ao abrir (o `useIsMobile` serve aqui, porque o painel só existe depois de um toque).
  - O corpo rola. O rodapé fixo tem "Limpar" (`outline`) e "Aplicar filtros" (`default`), cada um com metade da largura e `h-11`, e `pb-[calc(1rem+env(safe-area-inset-bottom))]` (P1, com `viewport-fit=cover`).
  - O corpo é um `form`: Enter num campo de texto vale como "Aplicar filtros".
- **Ao abrir (UXD-15):** os campos mostram os filtros em vigor, e o foco vai para o título "Filtros" (`tabIndex={-1}`, pelo `onOpenAutoFocus`). Nenhum campo de texto recebe o foco, e o teclado não abre.
- **"Aplicar filtros":** confere as datas (T5). Sem erro, fecha o painel, aplica tudo de uma vez, volta para a página 1 e devolve o foco a "Filtros". Com erro, o painel fica aberto, o foco vai para o campo com erro, e nada vai ao servidor.
- **"✕", `Esc`, o toque fora e o gesto de voltar** fecham sem aplicar, como no E2.05.
- **"Limpar"** volta os campos do painel para vazio e "Todos", sem aplicar e sem mexer na busca (E2.05). "Limpar filtros", fora do painel, é que limpa a busca também.
- **Liderança:** `PaginatedSelect` múltiplo (T4), com a dica do Negócio embaixo.
- **Bairro e Cidade:** `Input` com `maxLength={100}`, `autoComplete="off"`, `enterKeyHint="search"` e `h-11`.
- **Situação e Batizado (P52):** `RadioGroup` num `fieldset` com `legend`, com as três opções lado a lado, cada uma com um terço da largura e `min-h-11`. "Todos" vem marcado.
- **Situação de liderança, Nível e Vínculo celular (P51):** caixas de seleção num `fieldset` com `legend`.
  - As opções sem dica ficam lado a lado e quebram linha (`flex flex-wrap gap-x-4 gap-y-2`).
  - As que têm dica (Participante e Sem vínculo) ocupam a linha inteira, com a dica embaixo, alinhada ao texto da opção.
  - Cada opção é um `Label` com a caixa, de pelo menos 44 px de altura, que responde ao toque na linha inteira.
  - A dica do grupo (UXD-9) fica depois das opções, no Nível, e logo abaixo da `legend`, no Vínculo celular, antes das opções que ela explica.
- **Datas (P54):** T5.
- Componentes: `Sheet`, `PaginatedSelect`, `Input`, `RadioGroup`, `Checkbox`, `Label` e `Button`.

#### T3. Painel de filtros no computador (a partir de 1024 px)
Painel aberto, com Rita, os mesmos filtros da T1:
```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Buscar                                                                                       │
│ [⌕ Nome, e-mail ou CPF                 ]  [⚲ Filtros (2) ⌃]  [Limpar filtros]                │  painel aberto, sem chips
│ Liderança                                     Bairro                 Cidade                  │
│ [(Pedro Alves ✕)                          ▾]  [                   ]  [                   ]   │  lg:grid-cols-4
│ Mostra quem está abaixo das pessoas                                                          │
│ escolhidas, em todos os níveis. Para ver o                                                   │
│ ministério de um casal, escolha os dois.                                                     │
│ Situação               Situação de liderança  Batizado               Nível                   │
│ [Ativo             ▾]  [Todos             ▾]  [Todos             ▾]  [Todos             ▾]   │  Select · Popover · Select · Popover
│ Vínculo celular        Cadastrado a partir de  Cadastrado até                                │
│ [Todos             ▾]  [dd/mm/aaaa          ]  [dd/mm/aaaa        ]                          │  Popover · datas nativas
│                        Cadastros antigos sem data de cadastro não                            │
│                        aparecem quando há filtro de data.                                    │
│ 4 membros                                                                                    │  role="status"
│ Nome           │ Nível     │ Liderança                 │ …                                   │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```
Múltipla escolha aberta (Vínculo celular, com Líder e Sem vínculo):
```
┌──────────────────────────────────────┐
│ Vínculo celular                      │
│ [Líder, Sem vínculo               ⌃] │  botão com a aparência do SelectTrigger
│ ┌──────────────────────────────────┐ │  Popover
│ │ Líder, timóteo e anfitrião       │ │  dica do grupo †
│ │ contam só em células ativas.     │ │
│ │ [x] Líder                        │ │  uma por linha, min-h-11
│ │ [ ] Timóteo                      │ │
│ │ [ ] Anfitrião                    │ │
│ │ [ ] Participante                 │ │
│ │     Esteve em pelo menos uma     │ │  dica do Negócio, aria-describedby
│ │     célula realizada nos últimos │ │
│ │     30 dias.                     │ │
│ │ [x] Sem vínculo                  │ │
│ │     Não é líder, timóteo nem     │ │
│ │     anfitrião de célula ativa,   │ │
│ │     não esteve em célula nos     │ │
│ │     últimos 30 dias e não tem    │ │
│ │     célula ativa abaixo dele.    │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```
- **Painel (UXD-1, UXD-14):** dentro do `CardHeader`, abaixo da busca, num `Collapsible` aberto e fechado pelo botão "Filtros" (`aria-expanded` e `aria-controls`). Começa fechado e lembra o último estado neste navegador.
- **Aplicação (UXD-2):** cada campo vale na hora. As seleções e as datas, ao mudar; Bairro e Cidade, 300 ms depois da última tecla, como a busca. Cada mudança volta para a página 1.
- **Grade:** 4 colunas (`lg:grid-cols-4 gap-4`), na ordem da UXD-3:
  - Liderança (2 colunas, com a dica embaixo), Bairro e Cidade;
  - Situação, Situação de liderança, Batizado e Nível;
  - Vínculo celular e as duas datas (2 colunas, com a dica embaixo).

  Em 1024 px, cada coluna tem cerca de 156 px, e nada rola na horizontal.
- **Situação e Batizado (P52):** `Select`, com "Todos" no início.
- **Múltipla escolha (P51):**
  - um botão com a aparência do `SelectTrigger` (`variant="outline"`, `justify-between`, `ChevronDown`), que mostra "Todos" sem escolha, ou as opções escolhidas separadas por vírgula ("144, 1.728"). O texto quebra linha, sem `truncate`;
  - o botão abre um `Popover` com a mesma lista de caixas do `Sheet`, uma por linha, com as dicas. Cada marcação vale na hora;
  - `Esc` e o clique fora fecham o `Popover` e devolvem o foco ao botão. O conteúdo rola por dentro quando não cabe na tela (`max-h` pela altura disponível do Radix).
- **Liderança:** o `PaginatedSelect` múltiplo, com as pessoas escolhidas dentro do campo (T4).
- **Chips:** com o painel aberto, não aparecem, porque os campos já mostram os valores. Ao fechar o painel, voltam.
- Componentes: `Collapsible`, `Select`, `Popover`, `Checkbox`, `Label`, `Input` e `PaginatedSelect`.

#### T4. Liderança: seletor, limite e pessoa indisponível
No campo (celular; no computador, igual, em duas colunas):
```
Limite: 10 pessoas                       Pessoa indisponível, no campo
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Liderança                            │ │ Liderança                            │
│ [(Pedro Alves ✕) (Paula Alves ✕)     │ │ [(Pessoa indisponível ✕)             │
│  (André Souza ✕) (Caio Lima ✕)       │ │  (André Souza ✕)                  ▾] │
│  … mais 6 pessoas, todas visíveis    │ │ Mostra quem está abaixo das pessoas  │
│  (Carla Dias ✕)                   ▾] │ │ escolhidas, em todos os níveis. Para │
│ Escolha até 10 pessoas.              │ │ ver o ministério de um casal,        │
└──────────────────────────────────────┘ │ escolha os dois.                     │
                                         │ (i) Esta pessoa não está disponível  │
                                         │ para você.                           │
                                         └──────────────────────────────────────┘
```
Na lista, com Pedro, depois de abrir um link com Liderança: Tiago e André (critério da RN-05):
```
┌──────────────────────────────────────┐
│ Buscar                               │
│ [⌕ Nome, e-mail ou CPF             ] │
│ [⚲ Filtros (1)] [Limpar filtros]     │
│ (Liderança: Pessoa indisponível ✕)   │  sem nome e sem id
│ (Liderança: André Souza ✕)           │
│ (i) Esta pessoa não está disponível  │  text-sm, cor muted
│ para você.                           │
│ 4 membros                            │
│──────────────────────────────────────│
│ (foto) Caio Lima …                   │
└──────────────────────────────────────┘
```
- **Seletor (P53):** `PaginatedSelect` com `isMulti`, com as opções da `members_view` (ativos e inativos, 20 por página, com "Carregar mais") e o placeholder "Escolha uma ou mais pessoas".
  - Quem está logado também é opção, para ver todos abaixo de si.
  - As pessoas escolhidas aparecem dentro do campo, na ordem da escolha, cada uma com o "✕" ("Remover {Nome}", como hoje). O menu fica aberto depois de cada escolha, como já faz o múltiplo.
- **Busca sem resultado:** "Nenhum membro do seu ministério encontrado." para quem vê só o ministério (P11), e "Nenhum membro encontrado" para quem vê a igreja toda.
- **Dica (Negócio):** embaixo do campo, em `text-sm text-muted-foreground`, ligada por `aria-describedby`.
- **Limite (RN-04):** com 10 pessoas, as outras opções ficam desabilitadas, e "Escolha até 10 pessoas." aparece embaixo do campo, no lugar da dica, com `role="status"`. Tirar uma pessoa reabilita as opções e devolve a dica.
- **Pessoa indisponível (RN-05, UXD-7):**
  - no campo e no chip, "Pessoa indisponível", sem nome, com o "✕" para tirar;
  - embaixo da dica do campo e, fora do painel, embaixo dos chips: "Esta pessoa não está disponível para você." (com mais de uma: "Estas pessoas não estão disponíveis para você." †), com o ícone `Info` (`aria-hidden`), em `text-sm text-muted-foreground`;
  - nem o nome nem o id aparecem em lugar nenhum da tela. O nome das pessoas escolhidas nunca vem da `member_names` nem do `useMemberName` (AQ-2);
  - a pessoa indisponível conta como filtro ativo e, sozinha, deixa a lista vazia (RN-05), com o estado da T6.
- **Pessoas vindas da URL:** "Carregando…" no campo e no chip até a leitura por id chegar.
- **Componente:** o `PaginatedSelect` precisa aceitar `aria-describedby` (já pedido pelo E2.02), um limite de escolhas (as opções desabilitadas e a mensagem) e um rótulo para o valor sem nome. Tarefa do frontend.

#### T5. Datas de cadastro (P54)
```
Intervalo invertido                      Data inválida (computador, ao sair do campo)
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Cadastrado a partir de               │ │ Cadastrado a partir de               │
│ [25/11/2026                        ] │ │ [31/02/2026                        ] │
│ Cadastrado até                       │ │ ⚠ Data inválida. Use o formato       │
│ [20/11/2026                        ] │ │ dd/mm/aaaa.                          │
│ ⚠ A data inicial precisa ser igual   │ │ Cadastrado até                       │
│ ou anterior à data final.            │ │ [dd/mm/aaaa                        ] │
│ Cadastros antigos sem data de        │ │ Cadastros antigos sem data de        │
│ cadastro não aparecem quando há      │ │ cadastro não aparecem quando há      │
│ filtro de data.                      │ │ filtro de data.                      │
└──────────────────────────────────────┘ └──────────────────────────────────────┘
```
- **Campos:** dois `Input type="date"`, "Cadastrado a partir de" e "Cadastrado até", num `fieldset` com a legenda "Data de cadastro" só para o leitor de tela (`sr-only`), e a dica do Negócio embaixo dos dois, ligada por `aria-describedby`. Sem `min` e sem `max` (UXD-10). `h-11` no celular. No celular, um campo por linha; no painel do computador, os dois lado a lado.
- **Conferência:** ao sair do campo e, no celular, também em "Aplicar filtros". Nunca durante a digitação.
  - Data que não existe ou incompleta (no computador, o campo nativo deixa digitar 31/02/2026): "Data inválida. Use o formato dd/mm/aaaa." embaixo do campo, com `aria-invalid`.
  - "Cadastrado até" antes de "Cadastrado a partir de": "A data inicial precisa ser igual ou anterior à data final." embaixo de "Cadastrado até", com `aria-invalid` nele.
  - Nos dois casos, o filtro de data não é aplicado (RN-12). No computador, a lista fica só com os outros filtros. No celular, "Aplicar filtros" não fecha o painel e põe o foco no campo com erro.
  - O erro some quando a data fica certa ou é apagada.
- **Chips:** "Cadastrado a partir de 22/11/2026" e "Cadastrado até 28/11/2026", um por campo. As duas datas contam como um filtro (UXD-5).
- **Data de hoje e depois:** aceitas. "Cadastrado até 28/11/2026" num dia 24/11 é o equivalente de "Novos membros da semana" (RN-17).

#### T6. Estados da lista
```
Vazio com filtros (critério da RN-02)    Erro ao carregar
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Buscar                               │ │ Buscar                               │
│ [⌕ Carla                           ] │ │ [⌕ Carla                           ] │
│ [⚲ Filtros (1)] [Limpar filtros]     │ │ [⚲ Filtros (1)] [Limpar filtros]     │
│ (Nível: 1.728 ✕)                     │ │ (Nível: 1.728 ✕)                     │
│ 0 membros                            │ │──────────────────────────────────────│
│──────────────────────────────────────│ │ ⚠ Não foi possível carregar os       │
│ Nenhum membro encontrado com estes   │ │ membros. Verifique a conexão e       │
│ filtros.                             │ │ tente de novo.                       │
│ [Limpar filtros                    ] │ │ [Tentar de novo]                     │
└──────────────────────────────────────┘ └──────────────────────────────────────┘
```
- **Vazio com filtros ou busca:** "Nenhum membro encontrado com estes filtros." e "Limpar filtros" (`Button variant="outline"`, `h-11`), que faz o mesmo que o "Limpar filtros" de cima. O "0 membros" continua acima.
- **Vazio sem filtros nem busca:** "Nenhum membro encontrado.", como hoje. Na prática, não acontece: quem tem a lista vê pelo menos a si mesmo.
- **Carregando:** na primeira carga, 5 `Skeleton` no formato dos cartões (até 1023 px) ou das linhas da tabela (a partir de 1024 px), no lugar do "Carregando..." de hoje. Ao aplicar um filtro ou trocar de página, a lista anterior fica com `opacity-60` e `aria-busy`, e o total anterior continua (E1.08).
- **Erro ao carregar:** um `Alert` com "Não foi possível carregar os membros. Verifique a conexão e tente de novo." † e "Tentar de novo", no lugar da lista (hoje, um texto vermelho solto). A busca, o botão "Filtros" e os chips continuam e funcionam. Nunca uma mensagem técnica, inclusive no tempo-limite.
- Componentes: `Skeleton`, `Alert` e `Button`.

#### T7. Formulário "Novo membro": líder já preenchido (RN-16)
Celular, com Rita (vê a igreja toda), no padrão da Q-1:
```
┌──────────────────────────────────────┐
│ ✕  Novo membro                       │  cabeçalho fixo
│──────────────────────────────────────│
│ Campos com * são obrigatórios.       │  text-sm, cor muted
│ (i) O líder já vem preenchido com    │  só para quem vê a igreja toda (P55)
│     você.                            │  border, bg-muted/50, p-3; sem role
│     [Ir para o líder]                │  variant="link", h-11
│                                      │
│ Dados pessoais                       │
│ Nome *                               │
│ [                                  ] │
│ …                                    │
│ Dados ministeriais                   │
│ É Pastor(a)?                   [○  ] │
│ Tem Liderança?                 [  ●] │
│ Líder *                              │
│ [Rita Gomes                     ✕ ▾] │  já preenchido (RN-16)
│ Ativo                          [  ●] │
│ Batizado(a)?                   [○  ] │
│ …                                    │
│──────────────────────────────────────│
│ [Cancelar        ] [Criar membro   ] │  rodapé fixo, h-11
└──────────────────────────────────────┘
```
Depois de "Ir para o líder":
```
┌──────────────────────────────────────┐
│ ✕  Novo membro                       │
│──────────────────────────────────────│
│ Dados ministeriais                   │
│ É Pastor(a)?                   [○  ] │
│ Tem Liderança?                 [  ●] │
│ Líder *                              │
│ [Rita Gomes                     ✕ ▾] │  foco no campo; ring-2 por 2 s
│ Ativo                          [  ●] │
│──────────────────────────────────────│
│ [Cancelar        ] [Criar membro   ] │
└──────────────────────────────────────┘
```
- **Para todos:** no cadastro novo, o Líder já vem com quem cadastra, desde o primeiro render, sem passar por vazio (AQ-5). Quem não tem cadastro de membro (a conta X do E2.02) abre com o Líder vazio. Na edição, o Líder é o gravado.
- **Quem vê só o ministério (Pedro):** como a T6 do E2.02, sem o aviso.
- **Quem vê a igreja toda (Rita), P55:**
  - "Tem Liderança?" vem ligado, e o Líder vem com o nome dela;
  - no topo do corpo, depois de "Campos com * são obrigatórios." e antes de "Dados pessoais", o aviso "O líder já vem preenchido com você." †, com o ícone `Info` (`aria-hidden`), num quadro com `rounded-md border bg-muted/50 p-3 text-sm`. É um texto comum, sem `role="alert"`, porque não muda sozinho;
  - "Ir para o líder" † (`Button variant="link"`, `h-11` no celular e `md:h-9`) rola até o Líder (`block: "center"`, sem animação com `prefers-reduced-motion`), põe o foco no campo de busca do seletor e o destaca por 2 s com `ring-2 ring-ring`. O corpo já tem `scroll-pt` e `scroll-pb` (T1 do E2.04), então o campo não fica atrás do cabeçalho nem do rodapé;
  - o aviso some quando o Líder passa a ser outra pessoa ou fica vazio, quando "Tem Liderança?" é desligado e quando "É Pastor(a)?" é ligado. Volta se o Líder voltar a ser ela.
- **Interruptores no cadastro novo (UXD-11):** "É Pastor(a)?" ligado tira o Líder e mostra "Pastor(a) não tem líder.", e "Tem Liderança?" desligado tira o Líder e mostra "A pessoa fica sem liderança.", como na T4 do E2.04, mas sem o aviso do P20. Desfazer devolve o líder que estava no campo.
- **Erros e envio:** os do E2.04 (T4, T5 e T7). Pela API, nenhum líder é preenchido (RN-16).
- Componentes: os do E2.04, mais o quadro do aviso (`div` com ícone) e um `Button variant="link"`.

#### T8. Dashboard: sem mudança visual
- Nenhum card novo, nenhum texto novo. O número de "Sem Vínculo Celular" passa a seguir a RN-10 e a ser igual ao total da lista com Situação: Ativo e Vínculo celular: Sem vínculo (RN-11).
- O clique nos cards é do E2.14, que usa os links prontos da [Navegação e rotas](#navegação-e-rotas).

#### T9. As perguntas Q-1 a Q-4 na tela
Nenhuma resposta muda a estrutura das telas.
- **Q-1. Líder preenchido para quem vê a igreja toda.**
  - *Com o padrão (RN-16):* a T7, com o aviso e "Ir para o líder" para quem vê a igreja toda.
  - *Com a alternativa (só para quem vê o ministério):* o "Novo membro" de Rita abre como a T4 do E2.04 ("Tem Liderança?" ligado e "Líder *" vazio), sem o aviso. O P55 fica sem uso neste passo. O de Pedro não muda.
- **Q-2. Ordem padrão.**
  - *Com o padrão (RN-15):* nível e nome, com `aria-sort` em "Nível".
  - *Com a alternativa (nome):* só muda a ordem, e o `aria-sort` passa para "Nome". Nada mais na tela.
- **Q-3. Quem só acompanha a rede.**
  - *Com o padrão:* as 5 opções de Vínculo celular.
  - *Com a alternativa:* uma 6ª opção, entre Participante e Sem vínculo, na linha inteira, com uma dica, por exemplo "Só pelos discípulos" e "Não é líder, timóteo nem anfitrião e não esteve em célula nos últimos 30 dias, mas tem célula ativa abaixo dele." (nome e dica a definir pelo PO). Ganha um chip ("Vínculo celular: Só pelos discípulos") e um valor na URL. O painel do celular cresce cerca de 70 px.
- **Q-4. Vínculo e liderança por casal.**
  - *Com o padrão:* a dica da Liderança diz "Para ver o ministério de um casal, escolha os dois.".
  - *Com a alternativa (casal como unidade):*
    - a dica da Liderança passa a "Mostra quem está abaixo das pessoas escolhidas e dos cônjuges delas, em todos os níveis." †, sem a segunda frase. O chip continua com o nome da pessoa escolhida, porque o cônjuge pode não ser visível para quem consulta;
    - a dica de "Sem vínculo" passa a falar do casal, com o texto que o PO definir.

### Padrões novos (valem para as próximas telas)
A numeração começa em P50 (ver a nota do início da seção). Este passo também aplica o P1 (o rodapé do `Sheet`), o P10 (o subtítulo), o P11 (o seletor de Liderança), o P33 (as datas, com a variação do P54), o P40 (os rótulos do nível), o P44 (a lista que recarrega) e o P45 (cartões até 1023 px), sem mudá-los.

- **P50. Filtros de uma lista com muitos campos.** Vale para listas com mais de 5 filtros. Com até 5, continua o desenho da Auditoria (E2.05).
  - **Até 1023 px:** o botão "Filtros ({N})" abre um `Sheet` (de baixo no celular, da direita no tablet). Ele aplica tudo em "Aplicar filtros", descarta com "✕", `Esc` ou toque fora, e "Limpar" esvazia os campos do painel sem aplicar. O foco inicial vai para o título.
  - **A partir de 1024 px:** o mesmo botão abre e fecha um painel acima da lista, em 4 colunas, que aplica na hora e lembra, no navegador, se ficou aberto.
  - **Chips:** um por valor, sempre que os campos não estão à vista. O "✕" tira o valor na hora.
  - **"Limpar filtros":** logo depois do botão "Filtros", quando há filtro ativo ou busca. Limpa os dois e mantém o tamanho da página.
  - **Contagem:** o número do botão conta filtros, e não valores. Um valor inválido não conta.
  - **URL:** todo o estado fica nela, e os valores inválidos saem. Mudar um filtro volta para a página 1.
  - **Total e vazio:** o total em texto, com `role="status"`; o vazio com filtros, com "Limpar filtros".
  - Vale para Células (E2.10) e Relatórios (E2.12).
- **P51. Filtro de múltipla escolha.**
  - Um `fieldset` com `legend` e uma caixa de seleção por opção, com 44 px de altura e a linha inteira clicável. A dica de uma opção fica embaixo dela, ligada por `aria-describedby`.
  - No painel do computador, a mesma lista num `Popover`, aberto por um botão com a aparência do `SelectTrigger`, que mostra "Todos" ou as opções escolhidas, com quebra de linha.
  - Um chip por opção escolhida ("{Filtro}: {opção}").
- **P52. Filtro de escolha única com até 3 opções.** `RadioGroup` com as opções lado a lado no `Sheet` (1 toque) e `Select` no painel do computador. "Todos" é o padrão, não conta como filtro e não vira chip.
- **P53. Pessoa como filtro.**
  - `PaginatedSelect` múltiplo, com as pessoas visíveis (P11) e um limite, que desabilita as opções e mostra a mensagem com `role="status"`.
  - Os nomes das pessoas escolhidas vêm só da leitura das pessoas visíveis, nunca da `member_names`.
  - A pessoa que essa leitura não devolve aparece como "Pessoa indisponível", sem nome e sem id, com uma dica que explica. Ela conta como filtro ativo.
- **P54. Filtro por data de cadastro** (variação do P33, para Membros e, no E2.10, Células).
  - Os rótulos "Cadastrado a partir de" e "Cadastrado até", a legenda "Data de cadastro" só para o leitor de tela e a dica sobre os cadastros antigos sem data.
  - Sem `max`: datas futuras são aceitas.
  - As mensagens "Data inválida. Use o formato dd/mm/aaaa." e "A data inicial precisa ser igual ou anterior à data final.", conferidas ao sair do campo e ao aplicar.
  - Na URL, `from` e `to` em `aaaa-mm-dd`. Um chip por data; as duas contam como um filtro.
- **P55. Campo já preenchido com a própria pessoa, longe da ação principal.**
  - Vale para um formulário com rodapé fixo, quando um campo fora da primeira tela vem preenchido com quem usa e esse valor pode estar errado para parte do público.
  - Um aviso no topo do corpo diz isso, com "Ir para {campo}", que rola até o campo, põe o foco nele e o destaca por 2 s (`ring-2 ring-ring`, sem animação com `prefers-reduced-motion`).
  - O aviso é texto com ícone, sem `role="alert"`, e some quando o valor muda.

Nenhum componente novo do shadcn é necessário: `sheet`, `collapsible`, `popover`, `checkbox`, `radio-group`, `select`, `label`, `input`, `button`, `badge`, `table`, `skeleton` e `alert` já estão em `src/components/ui`. O P1 continua pedindo `viewport-fit=cover` na meta viewport do `index.html`, que ainda não tem, como já previsto nos specs anteriores.

### Estados
| Estado | Lista (T1, T6) | Painel e Liderança (T2 a T5) | Novo membro (T7) |
|---|---|---|---|
| Carregando | Primeira carga: 5 `Skeleton` no formato dos cartões ou das linhas, com a altura reservada. Ao aplicar um filtro ou trocar de página, a lista anterior fica com `opacity-60` e `aria-busy`, e o total anterior continua | As pessoas vindas da URL mostram "Carregando…" até o nome chegar. As opções do seletor, o "Carregando…" do E1.08 | O Líder abre já preenchido (AQ-5). Sem o dado, o campo fica vazio, e o aviso só aparece quando o nome chega |
| Vazio | Com filtros ou busca: "Nenhum membro encontrado com estes filtros." e "Limpar filtros". Sem nada: "Nenhum membro encontrado." | Seletor sem resultado: o texto do P11, ou "Nenhum membro encontrado" para quem vê a igreja toda | — |
| Erro ao carregar | `Alert` "Não foi possível carregar os membros. Verifique a conexão e tente de novo." †, com "Tentar de novo". A busca, os filtros e os chips continuam | Opções: "Não foi possível carregar as opções. Tentar novamente" (E1.08). Nomes da URL: "Liderança: nome não carregado" † no chip, até a próxima tentativa | Como no E2.04 |
| Sem permissão | Sem a lista de Membros, o estado sem acesso da T12 do E2.02 | — | O bloqueio da função padrão (T5 do E2.02) |
| Valor inválido | Da URL: sai, não é aplicado e não conta (RN-14) | Datas: as mensagens da T5, e o filtro de data não é aplicado. Pessoa indisponível: o rótulo e a dica da T4 | — |
| Limite | — | Com 10 pessoas: opções desabilitadas e "Escolha até 10 pessoas." | — |
| Sucesso | A lista e o total mudam, e o leitor de tela ouve o total | No celular, o painel fecha | O toast do E2.04 |
| Lista grande | Paginação do E1.08, com o total com separador de milhar. Com muitos chips, a lista desce, mas "Filtros" e "Limpar filtros" não saem do lugar | Liderança: 20 opções por página, com "Carregar mais" | — |
| Queda de conexão | Só leitura: o erro ao carregar, com os filtros mantidos na URL e na tela | "Aplicar filtros" fecha o painel, e a falha aparece na lista | O texto do E2.04 (T7), com os dados mantidos |

### Textos
Complementam os "Textos de tela" do Negócio, sem mudar termos. Os marcados com † foram definidos pela UX e estão nas pendências (PO-UX-10).

| Onde | Texto |
|---|---|
| Busca † | Buscar (rótulo) · Nome, e-mail ou CPF (placeholder, no lugar de "Buscar por nome, e-mail ou CPF...") |
| Botão | Filtros · Filtros ({N}) · (leitor de tela) Filtros ({N} ativos) † |
| Limpar | Limpar filtros · no `Sheet`: Limpar (E2.05) |
| `Sheet` | Filtros (título) · Aplicar filtros (E2.05) · (leitor de tela) As mudanças valem quando você toca em Aplicar filtros. † |
| Liderança | Liderança · Escolha uma ou mais pessoas · a dica do Negócio · Escolha até 10 pessoas. · Pessoa indisponível · Esta pessoa não está disponível para você. · Estas pessoas não estão disponíveis para você. † · Nenhum membro do seu ministério encontrado. (P11) · Nenhum membro encontrado · Carregando… · Remover {Nome} (leitor de tela, como hoje) |
| Bairro e Cidade | Bairro · Cidade |
| Situação | Situação · Todos · Ativo · Inativo |
| Situação de liderança | Situação de liderança · Com líder · Sem liderança · Pastor(a) |
| Batizado | Batizado · Todos · Sim · Não |
| Nível | Nível · Pastores · G12 · 144 · 1.728 · 20.736 · Nível 5 ou mais · Quem está sem liderança não tem nível. Use a Situação de liderança. † |
| Vínculo celular | Vínculo celular · Líder · Timóteo · Anfitrião · Participante · Sem vínculo · as dicas do Negócio · Líder, timóteo e anfitrião contam só em células ativas. † |
| Múltipla escolha no computador † | Todos (nada escolhido) · {opção}, {opção} |
| Datas | Cadastrado a partir de · Cadastrado até · Data de cadastro † (legenda, só para o leitor de tela) · a dica do Negócio · Data inválida. Use o formato dd/mm/aaaa. · A data inicial precisa ser igual ou anterior à data final. |
| Chips † | Liderança: {Nome} · Liderança: Pessoa indisponível · Liderança: Carregando… · Liderança: nome não carregado · Bairro: {texto} · Cidade: {texto} · Situação: {Ativo ou Inativo} · Situação de liderança: {opção} · Batizado: {Sim ou Não} · Nível: {opção} · Vínculo celular: {opção} · Cadastrado a partir de {dd/mm/aaaa} · Cadastrado até {dd/mm/aaaa} · (leitor de tela) Remover filtro {texto do chip} |
| Total | {N} membros · 1 membro |
| Vazio | Nenhum membro encontrado com estes filtros. · Limpar filtros · sem filtros: Nenhum membro encontrado. |
| Erro † | Não foi possível carregar os membros. Verifique a conexão e tente de novo. · Tentar de novo |
| Novo membro † | O líder já vem preenchido com você. · Ir para o líder |
| Q-3 e Q-4, se adotadas † | os textos da T9 |

**Evitar nestas telas**, além do que o Negócio lista: "Buscar por…" como único rótulo da busca, o badge com o número sem palavra, "Formato: dd/mm/aaaa" ao lado de um campo nativo, e o nome ou o id de uma pessoa indisponível.

### Acessibilidade
- **Botão "Filtros":** no celular, `aria-haspopup="dialog"` e `aria-expanded`; no computador, `aria-expanded` e `aria-controls` (o painel). O nome é "Filtros ({N} ativos)", com " ativos" em `sr-only`, e contém o texto visível.
- **`Sheet`:** o Radix prende e devolve o foco. O foco inicial vai para o título (UXD-15). A `SheetDescription` em `sr-only` diz que as mudanças valem em "Aplicar filtros". Com erro de data, o foco vai para o campo com erro.
- **Grupos:** cada filtro de opções é um `fieldset` com `legend`; o `RadioGroup` usa `aria-labelledby` com a legenda; cada caixa e cada opção tem `Label` com `htmlFor`. As datas ficam num `fieldset` com a legenda em `sr-only`.
- **Dicas:** ligadas por `aria-describedby`: a da Liderança ao campo de busca do seletor; as de Participante e Sem vínculo à própria caixa; as de Nível e de Vínculo celular ao `fieldset`; a das datas aos dois campos. "Escolha até 10 pessoas." e "Esta pessoa não está disponível para você." entram no `aria-describedby` do seletor, e a do limite tem `role="status"`.
- **`Popover` (computador):** o botão tem `aria-haspopup="dialog"`, `aria-expanded` e o nome do rótulo mais o valor (`aria-labelledby` com o id do rótulo e o do próprio botão: "Nível, 144, 1.728"). Ao abrir, o foco vai para a primeira caixa; `Esc` fecha e devolve o foco.
- **Chips:** `button` com `aria-label="Remover filtro {texto do chip}"`. Depois de tirar, o foco vai para o próximo chip ou para "Filtros". Depois de "Limpar filtros", para "Filtros".
- **Anúncios:** o total usa `role="status"` e é anunciado uma vez a cada aplicação (a busca e os campos de texto esperam 300 ms). A lista que carrega fica com `aria-busy="true"`.
- **Tabela:** `aria-sort="ascending"` no título "Nível" (UXD-12).
- **"Ir para o líder":** `button`, porque não navega. Leva o foco ao campo, com um destaque que não depende de `:focus-visible` (o navegador não mostra o anel quando o foco vem de um toque). O aviso não usa `role="alert"`.
- **Sem depender de cor:** "Pessoa indisponível" é texto; os erros têm ícone e texto; o número de filtros ativos é texto; os badges seguem o P6 e o P40.
- **Contraste, nos dois temas:** 4,5:1 para texto (rótulos, dicas, chips e o aviso sobre `bg-muted/50`) e 3:1 para as bordas das caixas, dos campos, dos chips e do botão do `Popover`. As dicas usam `text-muted-foreground` (4,6:1 no tema claro e 5,6:1 no escuro, P21).
- **Zoom de 200%, 320 px e fonte grande:** os chips, os rótulos, as dicas e o texto dos botões de múltipla escolha quebram linha, sem `truncate` e sem altura fixa. O `Popover` rola por dentro. A página e o `Sheet` não rolam na horizontal.
- **Toque:** "Filtros", "Limpar filtros", "Aplicar filtros", "Limpar", cada opção e "Ir para o líder" têm pelo menos 44 px no celular. Os chips têm 36 px, com 8 px entre si, acima do mínimo de 24 px da WCAG 2.5.8, como no E2.05.
- **Movimento:** as animações do `Sheet`, do `Collapsible`, do `Popover`, do `Skeleton`, o giro do ícone e a rolagem de "Ir para o líder" respeitam `motion-reduce:`.

### Critérios de UX
Numeração própria deste spec.

| ID | Critério | Como verificar |
|---|---|---|
| UX-01 | Em 360×800 e em 768×1024, Membros mostra "Buscar" e "Filtros" (44 px de altura) e nenhum campo de filtro na página. "Filtros" abre o `Sheet` de baixo em 360 e da direita em 768, com os 9 filtros na ordem da UXD-3 e os rótulos e opções do Negócio. Em 1024×768 e em 1280×800, "Filtros" abre e fecha o painel acima da lista, com `aria-expanded`, e não há `Sheet`. | teste E2E (viewport) |
| UX-02 | Nenhum destes textos aparece no DOM de Membros: "Indiferente", "Possui Liderança", "Nível Ministerial", "Status", "Data de criação" e "Formato: dd/mm/aaaa". Situação e Batizado começam em "Todos". "Pastores" e "Nível 5 ou mais" são opções de Nível, e "12" sozinho não aparece. | teste de componente |
| UX-03 | No `Sheet`, marcar opções não faz nenhuma requisição da lista. "Aplicar filtros" faz uma só, fecha o painel, volta para a página 1 e devolve o foco a "Filtros". "✕", `Esc` e o toque fora fecham sem mudar a lista nem a URL. "Limpar" esvazia os campos sem aplicar e sem apagar a busca. Ao abrir, o foco está no título "Filtros", e nenhum campo de texto está em foco. | teste de componente (rede simulada) + teste E2E (360×800) |
| UX-04 | No painel do computador, cada mudança vale sem botão: as seleções e as datas na hora, e Bairro e Cidade 300 ms depois da última tecla. A lista volta para a página 1 e fica com `opacity-60` e `aria-busy="true"` até a resposta, com o total anterior até lá. Depois de recarregar a página, o painel continua aberto ou fechado como estava. | teste de componente (relógio simulado) + teste E2E |
| UX-05 | O botão mostra "Filtros" sem filtro e "Filtros ({N})" com N de 1 a 9: Liderança com 3 pessoas conta 1, as duas datas contam 1 e a busca não conta. Com o equivalente de "Sem Liderança" (RN-17), mostra "Filtros (2)". Um valor inválido da URL não conta. O nome acessível é "Filtros (2 ativos)". | teste unitário (contagem) + teste de componente |
| UX-06 | Abaixo de 1024 px, e a partir daí com o painel fechado, cada valor ativo vira um chip, na ordem dos campos, com os textos da tabela de Textos: com Liderança Pedro e Paula, Situação Ativo e Nível 144 e 1.728, são 5 chips. Cada chip é um `button` de 36 px, com 8 px de distância e `aria-label="Remover filtro …"`. O toque tira só aquele valor, sem "Aplicar filtros", volta para a página 1 e leva o foco ao próximo chip ou a "Filtros". Com o painel aberto, não há chips. | teste de componente + teste E2E (medida) |
| UX-07 | "Limpar filtros" fica logo depois de "Filtros", só aparece com filtro ativo ou busca, e tem 44 px de altura. No critério da RN-14 (três filtros, busca "ana", página 2, 50 por página), ele deixa na URL só `size=50`, os campos e a busca vazios, e o foco em "Filtros". | teste E2E |
| UX-08 | No seletor de Liderança, Pedro só encontra Pedro, Paula, André, Caio, Fábio, Gabriel, Jonas e Carla, e a busca sem resultado diz "Nenhum membro do seu ministério encontrado.". O menu fica aberto depois de cada escolha. Com 10 pessoas, as outras opções ficam desabilitadas, "Escolha até 10 pessoas." aparece com `role="status"`, e a 11ª não entra. A dica do Negócio é lida com o campo (`aria-describedby`). | teste de componente + teste E2E (massa) |
| UX-09 | Pedro abre um link com Liderança: Tiago. O campo e o chip mostram "Pessoa indisponível", com "Esta pessoa não está disponível para você.", o total é "0 membros", e aparece o vazio com filtros. "Tiago" e o id dele não estão no DOM, e a tela não chama a `member_names` para esse id. Com Tiago e André, a lista mostra Caio, Fábio, Gabriel e Jonas. Um id excluído e um id que não existe dão a mesma tela. Um id com formato inválido sai da URL e não conta. | teste E2E (rede inspecionada) + teste de componente |
| UX-10 | Os campos de data são dois `input type="date"` com os rótulos do Negócio, sem `max`, e a dica ligada aos dois. "Cadastrado até" 28/11/2026 é aceito em 24/11/2026 (RN-17). De 25/11/2026 até 20/11/2026: a mensagem do Negócio embaixo de "Cadastrado até", com `aria-invalid`; no computador, a lista fica sem o filtro de data; no celular, "Aplicar filtros" não fecha o painel, põe o foco no campo e não faz requisição. 31/02/2026 digitado no computador mostra "Data inválida. Use o formato dd/mm/aaaa." ao sair do campo, e nunca durante a digitação. Os chips são "Cadastrado a partir de 22/11/2026" e "Cadastrado até 28/11/2026". | teste de componente + teste E2E |
| UX-11 | A URL segue a tabela de Navegação e rotas, com os nomes que o `architect` confirmar, sem os valores padrão. Recarregar, voltar no navegador e abrir o link mostram os mesmos filtros, chips e total. Mudar um filtro não cria entrada no histórico. Com `level=abc&baptized=yes`, `level` sai da URL e só Batizado: Sim fica aplicado (critério da RN-14). | teste E2E |
| UX-12 | Com `?status=active&cell_link=none` (equivalente de "Sem Vínculo Celular", RN-17), Rita vê "Filtros (2)", os chips "Situação: Ativo" e "Vínculo celular: Sem vínculo", "5 membros" e a ordem Lúcia, Paula, Gabriel, Jonas e Ester. | teste E2E (massa) |
| UX-13 | Sem filtros, a lista de Rita vem na ordem da RN-15, nos cartões (360×800) e na tabela (1280×800). Na tabela, só o título "Nível" tem `aria-sort`, com `"ascending"`. Não há cabeçalhos de grupo por nível. | teste E2E + teste de componente |
| UX-14 | O total aparece como "{N} membros" ("1 membro", "1.234 membros") acima da lista, com `role="status"`, e no rodapé. O badge com o número sai. O leitor de tela anuncia o total uma vez a cada filtro aplicado. | teste de componente + inspeção (leitor de tela) |
| UX-15 | Com filtros ou busca e nenhum resultado, aparecem "Nenhum membro encontrado com estes filtros." e "Limpar filtros" (`outline`, 44 px), que faz o mesmo da UX-07 (critério da RN-02: busca "Carla" e Nível 1.728). Sem filtros e sem busca, "Nenhum membro encontrado.". | teste de componente |
| UX-16 | Na primeira carga, aparecem 5 `Skeleton` no formato dos cartões (até 1023 px) ou das linhas (a partir de 1024 px), sem o "Carregando..." solto. Na falha, aparece o `Alert` com "Não foi possível carregar os membros. Verifique a conexão e tente de novo." e "Tentar de novo"; a busca, "Filtros" e os chips continuam funcionando. | teste de componente (mock) |
| UX-17 | Em 360×800, o `Sheet` ocupa no máximo 90% da altura, o corpo rola, e "Limpar" e "Aplicar filtros" ficam à vista sem rolar, com 44 px de altura e acima da área segura. Cada opção de `RadioGroup` e de caixa de seleção tem pelo menos 44 px de altura e responde ao toque na linha inteira. | teste E2E (viewport e medida) |
| UX-18 | Em 1024×768, o painel tem 4 colunas, sem rolagem horizontal, com nomes de 40 caracteres na Liderança. O botão de Nível mostra "Todos" sem escolha e "144, 1.728" com as duas; com as 6 opções, o texto quebra linha, sem corte. O `Popover` mostra as caixas e as dicas, e `Esc` fecha e devolve o foco ao botão. | teste E2E (viewport) + teste de componente |
| UX-19 | Em 320×640 e com zoom de 200%, os chips, os rótulos, as dicas e os botões do painel quebram linha sem corte, nenhum botão estoura a largura, e nem a página nem o `Sheet` rolam na horizontal. | teste E2E (viewport) + inspeção |
| UX-20 | Situação, Situação de liderança, Batizado, Nível, Vínculo celular e as datas são `fieldset` com `legend` (a das datas em `sr-only`). Toda caixa, opção e campo tem `Label`. As dicas de Liderança, Nível, Vínculo celular, Participante, Sem vínculo e das datas estão no `aria-describedby` do controle certo. | teste de componente + inspeção (axe) |
| UX-21 | O contraste é de 4,5:1 para texto (rótulos, dicas, chips, "Pessoa indisponível" e o aviso do formulário) e de 3:1 para as bordas das caixas, dos campos, dos chips e do botão do `Popover`, nos temas claro e escuro. Nenhum estado depende só de cor. | inspeção (axe, nos dois temas) |
| UX-22 | No "Novo membro" de Rita (padrão da Q-1), o Líder vem com "Rita Gomes" e "Tem Liderança?" ligado. O aviso "O líder já vem preenchido com você." aparece no topo do corpo, antes de "Dados pessoais", com "Ir para o líder" (44 px no celular). "Ir para o líder" traz o Líder à vista, fora do cabeçalho e do rodapé fixos, põe o foco nele e o destaca por 2 s. O aviso some quando Rita escolhe André, tira o líder, desliga "Tem Liderança?" ou liga "É Pastor(a)?", e volta quando o líder volta a ser ela. Nenhum aviso "… deixa de ser o líder." aparece no cadastro novo. | teste de componente + teste E2E (360×800) |
| UX-23 | No "Novo membro" de Pedro, o Líder vem com "Pedro Alves", como na UX-17 do E2.02, sem o aviso do topo. Na edição de Caio, o Líder continua "André Souza", sem aviso. Uma conta sem cadastro de membro abre o Líder vazio, sem aviso. O Líder já aparece preenchido no primeiro render, sem passar por vazio. | teste de componente |
| UX-24 | Com a alternativa da Q-1 adotada, o "Novo membro" de Rita abre como a T4 do E2.04 (Líder vazio e "Tem Liderança?" ligado), sem o aviso. O de Pedro não muda. | teste de componente (só se a alternativa for adotada) |
| UX-25 | Nenhum texto técnico aparece na lista nem no painel: nada de id, "ancestor_ids", "statement timeout", "57014" nem nome de parâmetro da URL. Uma falha de leitura vira o `Alert` da UX-16. | teste de componente (mock) |

### Perguntas para o `architect` (dados e contrato)
Em cada uma, a tela tem um comportamento padrão (o mais conservador) se a resposta for "não", menos onde está dito que não há.

- **AQ-1. Parâmetros da URL** (RN-14, Navegação e rotas). Confirmar os nomes e os valores, ou trocá-los.
  - Sugestão: um módulo só (por exemplo, `src/lib/members/filters.ts`) que lê e valida a URL, monta a consulta, conta os filtros ativos, monta os chips e gera os links. O E2.14 usa o mesmo para os cards do Dashboard, para que card e lista nunca divirjam (RN-17).
  - O servidor valida os mesmos valores, porque a RN-03 vale também pela API.
  - *Padrão sem isso:* os nomes da tabela.
- **AQ-2. Nomes das pessoas escolhidas na Liderança** (RN-05, P53).
  - A tela lê os nomes por id na `members_view` (até 10 ids), que só devolve quem a pessoa vê. Nunca pela `member_names` nem pelo `useMemberName` do `AsyncMemberSelect`, que resolvem também nomes de referência fora do escopo: para Pedro, o id de Samuel devolveria "Samuel".
  - Confirmar que a consulta da lista com ids não visíveis, excluídos ou inexistentes responde sem erro e do mesmo jeito nos três casos, e que nenhuma coluna nova da `members_view` expõe a cadeia (ponto "Cadeia de liderança" do Negócio).
  - *Padrão sem isso:* não há. Sem essa leitura, a tela revelaria o nome de quem a pessoa não vê, o que fere a RN-05.
- **AQ-3. A lista filtrada** (RN-02, RN-15). As linhas e o total exato, na ordem da RN-15 com o desempate estável, com as colunas que os cartões e a tabela do E2.06 usam, em até 2 s. Um tempo-limite volta como erro de leitura, sem texto técnico na tela (UX-25).
- **AQ-4. Valores fora da regra pela API** (11 ids, data invertida ou inválida, opção desconhecida). A tela valida antes e nunca os envia. Definir o que o servidor faz, se receber (ignora ou recusa com um código), para a tela nunca mostrar a recusa técnica.
  - *Padrão sem isso:* toda recusa da leitura vira o `Alert` de erro ao carregar.
- **AQ-5. Quem cadastra, ao abrir "Novo membro"** (RN-16, P55). O id e o nome do membro logado e se ele vê a igreja toda, já disponíveis ao abrir, sem uma nova espera (por exemplo, o `my_access` do E2.02 com o nome), para o Líder abrir preenchido e o aviso decidir sem piscar.
  - Confirmar que o `has_leadership` enviado junto com o líder segue a AQ-9 do E2.02.
  - *Padrão sem isso:* o Líder abre vazio e se preenche quando o dado chega, com o aviso aparecendo junto. Se a pessoa salvar antes, vale a conferência do líder do E2.04 (T4).
- **AQ-6. Datas de cadastro** (RN-12, P54). A tela envia `from` e `to` como datas de Brasília (`aaaa-mm-dd`), sem converter para UTC e sem limite no futuro. O servidor monta o intervalo, com os dois dias incluídos, e deixa de fora a "data não registrada" quando há qualquer um dos dois.
- **AQ-7. O que desatualiza a lista filtrada** (P44 do E2.06 e a AQ-6 de lá). Além das gravações de membro e de célula, a gravação, a exclusão e a restauração de relatório mudam Participante e Sem vínculo. A chave `members` precisa entrar no que o relatório desatualiza (E2.11 e E2.01), para a lista filtrada por Vínculo celular não mostrar o resultado de antes.

### Pendências para o PO (resolvidas em 2026-11-24)
Nenhuma bloqueava o desenho. O PO resolveu todas no mesmo dia; as decisões viraram os padrões P-FIL-16 a P-FIL-25 do Negócio, que ficam para revisão do usuário no PR.

- **PO-UX-1. Aviso do líder já preenchido para quem vê a igreja toda** (UXD-11, P55, T7). É a mitigação do risco da PO-UX-6 do E2.02, agora que a RN-16 preenche o líder para todos: o aviso no topo do formulário, com "Ir para o líder", que some quando o líder muda. No cadastro novo, os interruptores não mostram o aviso do P20 ("Ao salvar, … deixa de ser o líder.").
  - *Adotado.*
  - *Alternativas:* nenhum aviso; ou uma confirmação ao salvar quando o líder é quem cadastra (descartada: acrescenta um passo a cada cadastro da secretaria).
  - ***Resolvida (PO):** aceito como adotado (P-FIL-16). A RN-16 passou a dizer que quem vê a igreja toda recebe o aviso e que, no cadastro novo, o líder preenchido não conta como "havia líder" para o aviso do E2.04; ganhou critérios. Impacto no E2.04 registrado. Se a Q-1 for respondida com a alternativa, o aviso deixa de existir.*
- **PO-UX-2. Mais de 10 pessoas na Liderança vindas da URL.** Valem as 10 primeiras, as outras saem, e aparece "Escolha até 10 pessoas.". A RN-04 diz que "a 11ª não entra"; a RN-14 diz que um valor inválido é ignorado.
  - *Adotado:* as 10 primeiras.
  - *Alternativa:* ignorar o filtro de Liderança inteiro.
  - ***Resolvida (PO):** aceito: valem as 10 primeiras, na ordem em que vieram, e as outras saem da URL (P-FIL-17). A RN-04 passou a dizer isso, inclusive que a lista nunca usa mais de 10 pessoas, e ganhou um critério. O que o servidor faz com o excesso pela API continua com o `architect` (AQ-4).*
- **PO-UX-3. Id malformado × id inexistente.** Um id com formato inválido é ignorado e sai da URL (RN-14). Um id com formato válido que não existe, não é visível ou foi excluído aparece como "Pessoa indisponível" (RN-05). Confirmar a fronteira.
  - ***Resolvida (PO):** fronteira confirmada (P-FIL-18). O formato do id não revela nada sobre o cadastro, e as três situações de um id válido continuam com a mesma resposta. A RN-05 e a RN-14 passaram a dizer isso, com critérios.*
- **PO-UX-4. Contagem dos filtros ativos** (UXD-5, RN-14). No máximo 9: a Liderança conta 1 com qualquer número de pessoas, as duas datas contam 1, um valor inválido não conta e a busca não conta. Os chips são um por valor.
  - *Alternativa:* contar valores ("Filtros (5)" com 3 pessoas e 2 níveis).
  - ***Resolvida (PO):** aceito como adotado (P-FIL-19): conta filtros, de 1 a 9, e os chips são um por valor. A "Pessoa indisponível" conta como Liderança. A RN-14 passou a dizer isso e ganhou critérios.*
- **PO-UX-5. "Limpar filtros" e o vazio com só a busca.** "Limpar filtros" aparece também quando só a busca está preenchida, porque limpa a busca (RN-14). O vazio com só a busca mostra "Nenhum membro encontrado com estes filtros.", como a Auditoria faz.
  - *Alternativa:* com só a busca, "Nenhum membro encontrado." e nenhum "Limpar filtros".
  - ***Resolvida (PO):** aceito como adotado (P-FIL-20), por coerência com a RN-14 ("Limpar filtros" limpa a busca) e com a Auditoria. A RN-14 e os Textos de tela passaram a dizer isso, com critérios.*
- **PO-UX-6. Ciência: no celular, os filtros só valem em "Aplicar filtros"; no computador, valem na hora** (UXD-2). A "volta para a página 1" da RN-02 acontece quando o filtro é aplicado.
  - ***Resolvida (PO):** ciente e aceito (P-FIL-21). A RN-02 passou a dizer quando o filtro vale em cada tamanho de tela, que o chip vale na hora e que a volta para a página 1 e a meta de 2 s contam a partir da aplicação; ganhou critérios.*
- **PO-UX-7. Duas dicas a mais** (UXD-9): em Nível, "Quem está sem liderança não tem nível. Use a Situação de liderança."; em Vínculo celular, "Líder, timóteo e anfitrião contam só em células ativas.".
  - *Alternativa:* só as dicas do Negócio.
  - ***Resolvida (PO):** aceitas as duas dicas (P-FIL-22). Elas explicam os dois resultados que mais surpreendem (Ester fora de todos os níveis; Gabriel fora de "Líder"). Foram copiadas para os Textos de tela; as RNs não mudam.*
- **PO-UX-8. Datas** (UXD-10, P54).
  - O "Formato: dd/mm/aaaa" do Negócio não aparece, porque o campo nativo já mostra o formato no aparelho em português.
  - Datas futuras são aceitas, porque o equivalente de "Novos membros da semana" vai até o sábado (RN-17).
  - A mensagem do intervalo invertido é a do Negócio ("A data inicial precisa…"), diferente da do P33 na Auditoria ("O fim do período precisa…"). As duas dizem o mesmo com os rótulos de cada tela; unificar é decisão do PO.
  - ***Resolvida (PO):** aceito (P-FIL-23). Sai o "Formato: dd/mm/aaaa" dos Textos de tela, e ele entra na lista do que evitar. Datas futuras são aceitas, como a RN-12 passou a dizer. As mensagens **não** são unificadas: cada uma usa os rótulos da própria tela ("Cadastrado a partir de" e "Cadastrado até" aqui; "De" e "Até" na Auditoria). A RN-12 também passou a dizer que a conferência é ao sair do campo e ao aplicar.*
- **PO-UX-9. Sugestão: o G12 na segunda linha das opções do seletor de Liderança.** O seletor evita homônimos no resultado, mas não na escolha: duas "Ana Souza" aparecem iguais no menu. É a Q-3 do E2.06 (G12 nos seletores de membro); se ela for adotada, vale também aqui.
  - ***Resolvida (PO):** segue a Q-3 do E2.06 (P-FIL-24). Se o G12 entrar nos seletores de membro, entra também aqui, sem regra nova; não entra isolado neste passo, para os seletores não ficarem diferentes entre si. Nenhuma RN muda.*
- **PO-UX-10. Textos definidos pela UX** (marcados com † em Textos): o rótulo e o placeholder da busca; "Filtros ({N} ativos)" para o leitor de tela; a descrição do `Sheet`; "Estas pessoas não estão disponíveis para você."; as dicas da PO-UX-7; "Todos" nos botões de múltipla escolha; a legenda "Data de cadastro"; os textos dos chips, inclusive "nome não carregado"; o erro ao carregar; o aviso "O líder já vem preenchido com você." e "Ir para o líder"; e os textos das alternativas da Q-3 e da Q-4.
  - ***Resolvida (PO):** todos aceitos, sem ajuste (P-FIL-25). Os ligados a uma regra foram copiados para os Textos de tela do Negócio. Os textos das alternativas da Q-3 e da Q-4 só valem se o usuário adotar essas alternativas; nesse caso, o PO revisa o nome e a dica da opção nova.*

## Solução técnica
_Seção do `architect`. Escrita em 2026-11-24, só como desenho: nada foi implementado. **O PR 1 começa depois do banco do E2.05 e do PR 1 do E2.06 em produção** (ver [Ordem com os outros passos](#ordem-com-os-outros-passos)). O desenho parte do estado final do E2.01, do E2.02, do E2.04, do E2.05 e do E2.06, com os nomes que eles definem. Se um nome ou uma assinatura mudar lá, a tarefa 1 volta ao `architect`._

_Conferido em 2026-11-24, só com leitura:_
- _na stack local `supabase_db_mci-e108-pr2` (E1.08 completo e o PR 1 do E2.01):_
  - _a definição da `members_view` (vínculo celular, `search_text`, máscara, `security_barrier`, privilégios) e o corpo da `dashboard_summary`, de `sp_today`, `week_start`, `search_normalize`, `viewer_ministry_member_ids` e `member_names`;_
  - _os índices de `members`, `cells`, `cell_reports` e `cell_report_participants`;_
  - _a volatilidade e o *leakproof* dos operadores usados nos filtros: `uuid_eq`, `booleq` e as comparações de `timestamptz` são *leakproof* e entram na view *security barrier*; `strpos`, `enum_eq` e `&&` não são, e rodam acima dela;_
  - _`work_mem` (4 MB), o `statement_timeout` de `authenticated` (8 s) e que nenhum objeto depende da `members_view` no catálogo;_
- _no PostgREST local, pelo `pg_stat_statements`, o SQL que ele gera:_
  - _numa view com `count=exact`, a página e a contagem são duas consultas, cada uma com os filtros dentro;_
  - _numa RPC que devolve um conjunto, o resultado inteiro da função vai para uma CTE materializada (`pgrst_source`), e os filtros, a ordem, o `range` e a contagem são aplicados depois, sobre ela;_
- _no `mci-connect` (`origin/main`, `fdcbe50`): `use-members-list.ts`, `use-list-search-params.ts`, `list-query.ts`, `search.ts`, `pagination.ts`, `src/lib/members/fields.ts`, `use-member-options.ts`, `PaginatedSelect.tsx`, `Members.tsx`, `MemberForm.tsx`, `AuthContext.tsx` e os testes que usam as colunas de vínculo (`e108_pr3_dashboard_rpcs`, `e201_04_cells_reports`, `Dashboard.test.tsx`, `use-dashboard.test.tsx`, `e2e/dashboard.spec.ts`);_
- _nos specs: E1.08 (Pontos de extensão, risco 14), E2.01 (DA-1, ganchos de exclusão e restauração), E2.02 (predicados canônicos, `my_access`, `member-form.ts`, DT-23, DA-11), E2.04 (RN-11, RN-12, `a0_normalize_member`, `CHECK` de liderança, `MemberFormDialog`, P20), E2.05 (`created_at` anulável, DT-03, `FilterChips` e `PeriodFieldset` da Auditoria) e E2.06 (`private.member_hierarchy`, `members_view.g12_id` e `g12_name`, `ministry_tree_nodes` *definer*, `query-refresh.ts`, `use-min-width`)._

### Revisão das regras
Nenhuma RN voltou ao PO. As lacunas técnicas foram resolvidas pela leitura mais conservadora e estão em [Definidas pelo architect](#definidas-pelo-architect-revisar-no-pr). As perguntas Q-1 a Q-4 ficam com o usuário: o desenho segue os padrões adotados, e o custo de cada alternativa está em [Perguntas Q-1 a Q-4](#perguntas-q-1-a-q-4-padrão-e-custo-das-alternativas).

Casos de borda conferidos:
- **Fuso e virada do dia:**
  - a janela de 30 dias usa `sp_today()` e anda à meia-noite de Brasília, sem efeito próprio na virada da semana (RN-10);
  - a data de cadastro é comparada por um intervalo de instantes, do início do dia "a partir de" ao início do dia seguinte ao "até", em Brasília. Um cadastro às 23:30 de 21/11 (02:30 UTC de 22/11) é de 21/11 (RN-12).
- **Casal:** o vínculo e a liderança são de cada pessoa. O cônjuge não entra no "abaixo de" nem passa o vínculo (RN-04, RN-10).
- **Inativo:** continua visível, com nível, vínculo e cadeia. O "abaixo de" passa por ele, porque a cadeia do E2.06 inclui inativos (RN-04).
- **Sem líder:** `g12_level` nulo, situação `no_leadership`, último na ordem. Os discípulos dele têm o nível contado a partir dele (P-HIE-02 do E2.06).
- **Pastor:** nível 0 e nunca "Sem vínculo".
- **Excluído:** fica fora da `members_view`, então fora da lista, do total e da Liderança, onde aparece como indisponível. A participação de um membro vivo num relatório de célula excluída conta (DA-1 do E2.01).
- **Sem cadastro e sem função:** a `members_view` devolve nada ou só o próprio cadastro (RN-07 do E2.02), e as RPCs herdam isso.
- **Consolidado:** ponto de extensão. O filtro da `members_view` vale para a lista, o total e os cards.
- **Concorrência:** este passo só lê. Não há escrita nova, trava, trigger nem política de RLS nova. Ver o risco 6 (duas chamadas).
- **Volume:** ver [Metas de tempo e índices](#metas-de-tempo-e-índices).

Leituras técnicas. Nenhuma muda regra, mas o PO e o QA precisam saber delas:
1. **Valor que não tem o tipo do parâmetro, pela API** (id que não é uuid, opção que não existe, data impossível): o PostgREST recusa com 400 antes de a função rodar. A tela nunca manda esses valores, porque limpa a URL antes (RN-14). Os valores com o tipo certo, mas fora da regra, são normalizados como a tela faz (DA-1).
2. **As quatro colunas de vínculo da `members_view` do E1.08** (`is_cell_leader`, `is_cell_timothy`, `is_cell_host` e `attended_last_30_days`) saem, e `cell_links` fica no lugar (DA-7). O texto da RN-08 (c) do E1.08 fica como histórico.
3. **O card "Sem Vínculo Celular" muda no deploy do banco (PR 1)**, antes da tela nova de Membros. É a RN-11, com os números do critério dela.
4. **As linhas e o total vêm de duas chamadas**, cada uma com a sua foto do banco. Uma gravação feita entre as duas pode deixar o total diferente das linhas por um instante, e a leitura seguinte corrige (risco 6).
5. **O líder já preenchido é só da tela.** O banco não preenche nada (RN-16), e o E2.04 continua recusando o cadastro sem líder com "Escolha o líder.".

#### Respostas aos pontos do PO (Pontos para o `architect`)
| Ponto | Resposta |
|---|---|
| Cadeia de liderança (RN-05) | A lista passa a vir de uma RPC (`members_list`), que lê `ancestor_ids` em `private.member_hierarchy` só para as pessoas escolhidas que a `members_view` de quem consulta devolve, e só dentro do `WHERE`. Não há coluna nova com a cadeia na view, nem função exposta que receba ids de líder além das duas RPCs da lista. A resposta só tem linhas da `members_view`. É o arranjo da `ministry_tree_nodes` do E2.06 (DT-13 de lá). |
| Uma definição de vínculo (RN-10, RN-11) | Uma coluna, `members_view.cell_links` (`member_cell_link[]`), calculada num lugar só. O filtro e o card leem essa coluna, e as quatro colunas antigas saem (DA-7). |
| Ordem (RN-15) | Dentro da RPC: `g12_level` com os nulos por último, o nome sem acento e em minúsculas comparado byte a byte (`COLLATE "C"`) e o `id`. A página é escolhida só com essas chaves, e as colunas da linha são calculadas só para as linhas da página (DT-03). |
| Bairro e cidade (RN-06) | "Contém" com `strpos` sobre o texto normalizado dos dois lados. Sem curinga, então `%`, `_`, vírgula e aspas são texto. Sem índice: cerca de 100 ms no volume de referência (plano B no risco 5). |
| Data de cadastro (RN-12) | `public.sp_day_start(date)` dá o início do dia de Brasília. O filtro é `created_at >= sp_day_start(a partir de)` e `created_at < sp_day_start(até + 1)`. O nulo do legado (E2.05) fica de fora sozinho. Índice parcial em `created_at`. |
| URL (RN-14) | Um módulo só no front, `src/lib/members/filters.ts`, lê, limpa e grava a URL, conta os filtros, monta os chips, os argumentos da RPC e os links dos cards (E2.14). O servidor normaliza os mesmos casos (DA-1). Os nomes da Liderança vêm só da `members_view`. |
| Ordem dos passos | O PR 1 tem guarda: exige o PR 1 do E2.06 (`private.member_hierarchy` e `members_view.g12_id`) e o banco do E2.05 (`created_by_kind`). |

#### Definidas pelo architect (revisar no PR)
Pontos que as RNs não respondem por inteiro. O `architect` adotou a leitura mais conservadora e coerente com elas. O usuário pode mudar qualquer um no PR.

| # | Ponto | Padrão adotado | Por quê |
|---|---|---|---|
| DA-1 | O que o servidor faz com valores fora da regra (AQ-4) | Valor que não tem o tipo do parâmetro: recusa do PostgREST (400). Valor com o tipo certo: normalizado como a tela, sem erro:<br>- valem os 10 primeiros ids distintos da Liderança;<br>- nível fora de 0 a 5 é ignorado;<br>- datas invertidas desligam o filtro de data inteiro;<br>- bairro e cidade usam os 100 primeiros caracteres;<br>- a busca usa os 5 primeiros padrões;<br>- `_limit` fica entre 1 e 100, e `_offset` negativo vira 0. | A RN-04 já pede os 10 primeiros pela API, e a RN-12 e a RN-14 pedem que o inválido seja ignorado. Recusar pelo tipo evita aceitar texto livre onde a regra espera um id ou uma opção, e a tela nunca chega a isso. |
| DA-2 | Ids repetidos ou nulos na Liderança | Contam uma vez, na posição da primeira aparição, e os nulos são ignorados. As 10 pessoas são contadas depois disso. | "As 10 primeiras" (RN-04) fala de pessoas, e não de posições. |
| DA-3 | Situação de liderança de um cadastro "sem topo" (DA-2 do E2.06, só possível por carga) | Segue `leader_id` e `is_pastor` (RN-11 do E2.04): fica em "Com líder" e em nenhum nível. | É a definição do E2.04, a mesma do card "Sem Liderança". O caso só existe com dado de carga, e o E4.04 e o E4.09 o listam. |
| DA-4 | Datas invertidas vindas de um link | Ficam na URL, não são aplicadas, não contam como filtro nem viram chip. O painel mostra a mensagem da RN-12 embaixo de "Cadastrado até" quando é aberto. Pela API, o filtro de data inteiro é ignorado. | A RN-14 manda tirar da URL o valor inválido, mas as duas datas são válidas: só a combinação não é. A RN-12 diz o que fazer com a combinação. |
| DA-5 | Desempate de nomes iguais sem acento e sem maiúsculas ("Ana" e "Aná") | Pelo `id`. | A RN-15 manda não diferenciar acentos e maiúsculas, e o desempate final é estável. |
| DA-6 | Espaços em bairro e cidade | Qualquer espaço (inclusive tabulação e quebra de linha) conta como espaço, e o texto do cadastro também é comparado com os espaços seguidos como um. Os 100 caracteres contam antes da normalização, como na busca do E1.08. | A RN-06 fala do texto digitado. Aplicar o mesmo ao cadastro evita que "São  João", com dois espaços, fique de fora. |
| DA-7 | As quatro colunas de vínculo da `members_view` | Saem, e `cell_links` fica no lugar. A view é recriada (`DROP` e `CREATE`) com o mesmo `WHERE`, as mesmas opções e os mesmos privilégios, conferidos pela migration. | Uma definição só (RN-11). Manter as quatro exigiria repetir a regra no texto da view ou calculá-la duas vezes por linha. Nenhuma tela as lê; só a `dashboard_summary`, que muda junto. |
| DA-8 | Filtro de múltipla escolha com todas as opções marcadas | Vale como filtro, e não como "Todos": Situação de liderança com as três dá o mesmo que sem filtro; Nível com as seis deixa de fora quem está sem liderança; Vínculo celular com as cinco deixa de fora quem não está em nenhuma categoria (Q-3). Conta como filtro ativo. | É o que a RN-02 diz (basta valer uma). Trocar por "Todos" mudaria o resultado de Nível e de Vínculo celular. |

### Visão geral
Quatro partes:
1. **O vínculo celular numa coluna só** (migration 1):
   - `members_view.cell_links`, com as categorias da RN-10, e `members_view.leadership_status`, com as três situações do E2.04;
   - a `dashboard_summary` passa a contar "Sem Liderança" e "Sem Vínculo Celular" por essas colunas, então o card e a lista nunca divergem (RN-11, RN-17).
2. **A lista por RPC** (migration 2):
   - `members_list` (a página) e `members_list_count` (o total), com os 9 filtros e a busca como parâmetros tipados;
   - as duas leem só a `members_view`, e são *definer* só para ler a cadeia em `private.member_hierarchy` no filtro de Liderança;
   - o `WHERE` é montado com os filtros ativos, num lugar só, e os valores entram por parâmetro.
3. **Front:** os componentes de filtro reaproveitáveis (P50 a P54); a tela de Membros com o estado na URL; o líder já preenchido para todos (P55); o cache de Membros desatualizado também pelas gravações de relatório (AQ-7).
4. **Nada de escrita nova:** nenhum trigger, trava ou política de RLS muda.

### Modelo de dados e migrations

#### Ordem das migrations
Os nomes são sugestões; o timestamp é o do momento da criação.
- Cada arquivo é idempotente onde dá (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DO` com guarda de `duplicate_object`) e roda num banco zerado depois das migrations existentes e das do E2.01, do E2.02, do E2.04, do E2.05 e do E2.06.
- **Cada arquivo deixa o banco coerente sozinho.**
- As mensagens das guardas trazem só nomes de objetos, nunca dado pessoal (os logs do GitHub Actions de um repositório público são públicos).
- O corpo da `members_view` e o da `dashboard_summary` partem do que estiver em produção (tarefa 1). O texto deste spec mostra só o que muda.
- Depois do PR 1, regenere o `types.ts`.

| # | PR | Arquivo | Conteúdo | Estado depois dele |
|---|---|---|---|---|
| 1 | 1 | `<ts>_e207_01_cell_link.sql` | Guarda de pré-requisitos; enums `member_cell_link` e `member_leadership_status`; `cell_links_or_none` e `sp_day_start`; `members_view` recriada sem as quatro colunas antigas e com `leadership_status` e `cell_links` no fim; `dashboard_summary` com os dois `FILTER`s novos; índice `members_created_at_idx`; pós-condições. | O card segue a RN-10. A lista em produção continua lendo a `members_view` direto, sem mudança. |
| 2 | 1 | `<ts>_e207_02_member_list.sql` | Tipo `private.member_filter`; `private.text_key`, `private.member_filter_normalize` e `private.member_filter_sql`; `members_list` e `members_list_count`; privilégios; pós-condições. | As RPCs existem, ainda sem leitor até o PR 3. |

#### DDL de referência (migration 1)
```sql
-- 0. Pré-requisitos: PR 1 do E2.06 (private.member_hierarchy, members_view.g12_id), banco do
--    E2.05 (members.created_by_kind, created_at anulável) e PR 1 do E2.02. Falha cedo, sem mudar nada.
DO $$ BEGIN
  IF to_regclass('private.member_hierarchy') IS NULL
     OR to_regprocedure('public.viewer_scope_contains_any(uuid[])') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.members'::regclass
                     AND attname = 'created_by_kind' AND NOT attisdropped)
     OR NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.members_view'::regclass
                     AND attname = 'g12_id' AND NOT attisdropped) THEN
    RAISE EXCEPTION 'E2.07 depende do PR 1 do E2.06, do banco do E2.05 e do PR 1 do E2.02.';
  END IF;
END $$;

-- 1. Tipos. Os rótulos são os valores da URL (AQ-1); o front lê a lista de Constants.
DO $$ BEGIN
  CREATE TYPE public.member_cell_link AS ENUM ('leader', 'timothy', 'host', 'attendee', 'none');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.member_leadership_status AS ENUM ('with_leader', 'no_leadership', 'pastor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. RN-10 (e): completa as categorias com "Sem vínculo". Com SET, não é inlinável: o argumento
--    (os EXISTS da view) é calculado uma vez por linha. Pura; a view a chama com o papel de
--    quem consulta, então precisa de EXECUTE para authenticated.
CREATE OR REPLACE FUNCTION public.cell_links_or_none(
  _links public.member_cell_link[], _total_cells integer, _is_pastor boolean)
RETURNS public.member_cell_link[] LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public AS $$
  SELECT CASE WHEN cardinality(_links) = 0 AND coalesce(_total_cells, 0) = 0
                   AND NOT coalesce(_is_pastor, false)
              THEN ARRAY['none']::public.member_cell_link[]
              ELSE _links END
$$;

-- 3. Início do dia de Brasília (RN-12). O E2.14 usa a mesma para "Novos membros da semana".
CREATE OR REPLACE FUNCTION public.sp_day_start(_day date)
RETURNS timestamptz LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public AS $$
  SELECT _day::timestamp AT TIME ZONE 'America/Sao_Paulo'
$$;

-- 4. members_view recriada (DA-7).
DROP VIEW public.members_view;   -- sem CASCADE: com algum dependente, falha e nada muda
CREATE VIEW public.members_view
WITH (security_barrier = true, security_invoker = false) AS   -- repetir sempre: o CREATE apaga as opções
SELECT
  -- … as colunas de produção, na mesma ordem, MENOS is_cell_leader, is_cell_timothy,
  --   is_cell_host e attended_last_30_days …
  -- E2.07, no fim:
  CASE WHEN m.is_pastor          THEN 'pastor'
       WHEN m.leader_id IS NULL  THEN 'no_leadership'
       ELSE                           'with_leader'
  END::public.member_leadership_status                                  AS leadership_status,  -- RN-08
  public.cell_links_or_none(
    array_remove(ARRAY[
      CASE WHEN EXISTS (SELECT 1 FROM public.cells c
                         WHERE c.leader_id = m.id AND c.is_active AND c.deleted_at IS NULL)
           THEN 'leader'::public.member_cell_link END,
      CASE WHEN EXISTS (SELECT 1 FROM public.cells c
                         WHERE c.timothy_id = m.id AND c.is_active AND c.deleted_at IS NULL)
           THEN 'timothy'::public.member_cell_link END,
      CASE WHEN EXISTS (SELECT 1 FROM public.cells c
                         WHERE c.host_id = m.id AND c.is_active AND c.deleted_at IS NULL)
           THEN 'host'::public.member_cell_link END,
      CASE WHEN EXISTS (SELECT 1 FROM public.cell_report_participants p
                          JOIN public.cell_reports r ON r.id = p.report_id
                         WHERE p.member_id = m.id
                           AND r.deleted_at IS NULL AND r.was_held           -- P-FIL-08
                           AND r.date >= public.sp_today() - 30)            -- P-FIL-09
           THEN 'attendee'::public.member_cell_link END
    ], NULL),
    h.total_cells, m.is_pastor)                                         AS cell_links          -- RN-10
FROM public.members m
  -- … os mesmos JOINs de produção (inclusive "h", de private.member_hierarchy, do E2.06) …
WHERE /* … o mesmo WHERE de produção (predicado canônico do E2.02 e deleted_at IS NULL) … */;

ALTER VIEW public.members_view OWNER TO postgres;
-- Os privilégios padrão do Supabase dão tudo a anon e authenticated em objeto novo de public.
REVOKE ALL ON public.members_view FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.members_view TO authenticated;     -- service_role fica com o padrão, como antes

-- 5. Dashboard (RN-11, RN-17): o corpo de produção, com só estes dois FILTERs trocados.
--      count(*) FILTER (WHERE mv.is_active AND mv.leadership_status = 'no_leadership')
--        AS members_without_leader,
--      count(*) FILTER (WHERE mv.is_active AND 'none'::public.member_cell_link = ANY (mv.cell_links))
--        AS members_without_cell_link

-- 6. Datas de cadastro (RN-12) e "Novos membros" (E2.14). As comparações de timestamptz são
--    leakproof, então o filtro entra na view e usa o índice. A tarefa 1 confere se o E2.05 já criou um.
CREATE INDEX IF NOT EXISTS members_created_at_idx
  ON public.members (created_at) WHERE deleted_at IS NULL;

-- 7. Privilégios das funções novas. São puras e a view as chama com o papel de quem consulta:
--    ficam authenticated e service_role (scripts que leem a view).
REVOKE ALL ON FUNCTION public.cell_links_or_none(public.member_cell_link[], integer, boolean),
                       public.sp_day_start(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cell_links_or_none(public.member_cell_link[], integer, boolean),
                          public.sp_day_start(date) TO authenticated, service_role;

-- 8. Pós-condições: dono, opções e privilégios da view como antes; nenhuma função citando as
--    colunas que saíram.
DO $$ BEGIN
  IF (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = 'public.members_view'::regclass) <> 'postgres'
     OR (SELECT reloptions FROM pg_class WHERE oid = 'public.members_view'::regclass)
        IS DISTINCT FROM ARRAY['security_barrier=true', 'security_invoker=false']
     OR NOT has_table_privilege('authenticated', 'public.members_view', 'SELECT')
     OR has_table_privilege('authenticated', 'public.members_view', 'INSERT, UPDATE, DELETE, TRUNCATE')
     OR has_table_privilege('anon', 'public.members_view', 'SELECT') THEN
    RAISE EXCEPTION 'E2.07: members_view com dono, opções ou privilégios diferentes de antes.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname IN ('public', 'private')
                AND p.prosrc ~ '\m(is_cell_leader|is_cell_timothy|is_cell_host|attended_last_30_days)\M') THEN
    RAISE EXCEPTION 'E2.07: ainda há função citando as colunas de vínculo removidas.';
  END IF;
END $$;
```
- **Por que a nova `cell_links` e não as quatro colunas corrigidas:** a regra do "Sem vínculo" precisa das quatro categorias. Com as quatro colunas e a lista juntas, cada `EXISTS` apareceria duas vezes no plano, porque o Postgres não reaproveita subconsultas repetidas. Com uma coluna, a regra está escrita uma vez e é calculada uma vez por linha.
- **Por que `EXISTS` com igualdade simples (`… = m.id`) no nível de cima da view:** o planejador gera as duas formas de cada um (busca por índice a cada linha, ou uma tabela *hash* montada uma vez) e escolhe pelo número de linhas. Na página (25 linhas), faz 25 buscas por índice; no Dashboard e no filtro (o conjunto visível inteiro), monta a tabela *hash*. Dentro de uma subconsulta aninhada, a escolha seria feita sem saber quantas linhas vêm, por isso a regra não fica num `LATERAL` nem numa subconsulta.
- **Custo zero quando a coluna não é pedida:** a view não é achatada (`security_barrier`), e o planejador troca por nulo a coluna que ninguém pede. O formulário, a autoria por id, os seletores e a contagem sem filtro de vínculo não pagam nada.
- **`h.total_cells`** é o total do E2.06, que já conta as células ativas do próprio membro. Quem tem total zero não é líder de célula ativa, então "Sem vínculo" fica coerente com "Líder".

#### Integridade garantida pelo banco
| Garantia | Como |
|---|---|
| Só aparece quem a pessoa vê (RN-03) | As duas RPCs só devolvem e contam linhas da `members_view`, que filtra por `auth.uid()` também dentro de uma função *definer*. Teste de paridade por persona. |
| A cadeia não sai (RN-05) | `ancestor_ids` só no `WHERE`, para ids que vieram da `members_view`. O retorno é o tipo da view. |
| Card igual à lista (RN-11, RN-17) | As mesmas colunas da view nos dois (`is_active`, `is_baptized`, `leadership_status`, `cell_links`, `created_at`). Teste por persona. |
| Valores só por parâmetro | `private.member_filter_sql` devolve só fragmentos fixos, escolhidos pela nulidade de cada campo. Os valores entram por `USING`. |
| Ninguém chama as funções internas | Ficam em `private`, sem EXECUTE para `PUBLIC`, `anon`, `authenticated` e `service_role`. |
| Ordem total | `g12_level`, nome normalizado e `id`, que é único. |

### A lista (migration 2)

#### Filtros, parâmetros e condições
| Filtro (na URL) | Parâmetro | Normalização (`private.member_filter_normalize`) | Condição sobre `members_view v` (`private.member_filter_sql`) |
|---|---|---|---|
| busca (`q`) | `_search text[]`: os padrões do `toSearchPatterns` (E1.08) | até 5, sem os vazios | `v.search_text ILIKE ALL (…)` |
| Liderança (`leaders`) | `_leader_ids uuid[]` | os 10 primeiros distintos, na ordem; ficam só os que a `members_view` devolve; nenhum visível = lista vazia | `v.id IN (SELECT h.member_id FROM private.member_hierarchy h WHERE h.ancestor_ids && …)` |
| Bairro, Cidade (`neighborhood`, `city`) | `_neighborhood text`, `_city text` | `private.text_key(left(x, 100))`; vazio = sem filtro | `strpos(private.text_key(v.neighborhood), …) > 0` |
| Situação (`status`) | `_is_active boolean` | — | `v.is_active = …` |
| Situação de liderança (`leadership`) | `_leadership member_leadership_status[]` | sem repetidos; vazio = sem filtro | `v.leadership_status = ANY (…)` |
| Batizado (`baptized`) | `_is_baptized boolean` | — | `v.is_baptized = …` |
| Nível (`level`) | `_levels integer[]`, com 5 = "5 ou mais" | 0 a 4 exatos; 5 liga "5 ou mais"; o resto é ignorado | `v.g12_level = ANY (…) OR (… AND v.g12_level >= 5)` |
| Vínculo celular (`cell_link`) | `_cell_links member_cell_link[]` | sem repetidos; vazio = sem filtro | `v.cell_links && …` |
| Datas de cadastro (`from`, `to`) | `_created_from date`, `_created_to date` (Brasília) | invertidas: sem filtro de data | `v.created_at >= sp_day_start(from)` e `v.created_at < sp_day_start(to + 1)` |

- **Combinação (RN-02):** os fragmentos são ligados por `AND`. Dentro de um filtro de múltipla escolha, `= ANY` e `&&` dão o "basta valer uma".
- **Quem está sem liderança no Nível:** `g12_level` nulo não satisfaz nenhuma das duas condições (RN-09).
- **Cuidado ao reescrever:** `least(g12_level, 5)` devolve 5 quando o nível é nulo (`LEAST` ignora nulos). Use a condição da tabela.

#### Código de referência (migration 2)
```sql
DO $$ BEGIN
  CREATE TYPE private.member_filter AS (
    search        text[],                              -- padrões ILIKE (E1.08)
    leader_ids    uuid[],                              -- visíveis; '{}' = só pessoas indisponíveis
    neighborhood  text,                                -- private.text_key; nulo = sem filtro
    city          text,
    is_active     boolean,
    leadership    public.member_leadership_status[],
    is_baptized   boolean,
    levels        integer[],                           -- 0 a 4
    level_5_plus  boolean,
    cell_links    public.member_cell_link[],
    created_from  timestamptz,                         -- início do dia "a partir de" (Brasília)
    created_until timestamptz);                        -- início do dia seguinte ao "até" (exclusivo)
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RN-06, DA-6: sem acento, minúsculas, qualquer espaço como um, sem os das pontas.
CREATE OR REPLACE FUNCTION private.text_key(_value text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT btrim(regexp_replace(public.search_normalize(_value), '\s+', ' ', 'g'))
$$;

-- Os valores como a tela os aplica (DA-1, DA-2). INVOKER: só é chamada pelas RPCs.
CREATE OR REPLACE FUNCTION private.member_filter_normalize(
  _search text[], _leader_ids uuid[], _neighborhood text, _city text, _is_active boolean,
  _leadership public.member_leadership_status[], _is_baptized boolean, _levels integer[],
  _cell_links public.member_cell_link[], _created_from date, _created_to date)
RETURNS private.member_filter LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  _f   private.member_filter;
  _ten uuid[];
BEGIN
  _f.search := (SELECT array_agg(s.p ORDER BY s.i)
                  FROM (SELECT t.p, t.i FROM unnest(_search) WITH ORDINALITY t(p, i)
                         WHERE coalesce(t.p, '') <> '' ORDER BY t.i LIMIT 5) s);
  -- RN-04, RN-05: os 10 primeiros distintos; valem só os que a members_view devolve.
  _ten := ARRAY(SELECT t.x FROM unnest(_leader_ids) WITH ORDINALITY t(x, i)
                 WHERE t.x IS NOT NULL GROUP BY t.x ORDER BY min(t.i) LIMIT 10);
  IF cardinality(_ten) > 0 THEN
    _f.leader_ids := ARRAY(SELECT v.id FROM public.members_view v WHERE v.id = ANY (_ten));
  END IF;
  _f.neighborhood := nullif(private.text_key(left(_neighborhood, 100)), '');
  _f.city         := nullif(private.text_key(left(_city, 100)), '');
  _f.is_active    := _is_active;
  _f.is_baptized  := _is_baptized;
  _f.leadership   := nullif(ARRAY(SELECT DISTINCT x FROM unnest(_leadership) x WHERE x IS NOT NULL), '{}');
  _f.cell_links   := nullif(ARRAY(SELECT DISTINCT x FROM unnest(_cell_links) x WHERE x IS NOT NULL), '{}');
  _f.levels       := nullif(ARRAY(SELECT DISTINCT x FROM unnest(_levels) x WHERE x BETWEEN 0 AND 4), '{}');
  _f.level_5_plus := coalesce(5 = ANY (_levels), false);
  IF _created_from IS NULL OR _created_to IS NULL OR _created_from <= _created_to THEN   -- RN-12
    _f.created_from  := public.sp_day_start(_created_from);
    _f.created_until := public.sp_day_start(_created_to + 1);
  END IF;
  RETURN _f;
END $$;

-- O WHERE, num lugar só. Só fragmentos fixos; os valores vêm de $1 (o filtro) por USING.
-- Nunca concatene um valor aqui.
CREATE OR REPLACE FUNCTION private.member_filter_sql(_f private.member_filter)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT concat_ws(' AND ', 'true',
    CASE WHEN _f.search IS NOT NULL THEN 'v.search_text ILIKE ALL (($1).search)' END,
    CASE WHEN _f.leader_ids IS NOT NULL THEN
      'v.id IN (SELECT h.member_id FROM private.member_hierarchy h WHERE h.ancestor_ids && ($1).leader_ids)' END,
    CASE WHEN _f.neighborhood IS NOT NULL THEN 'strpos(private.text_key(v.neighborhood), ($1).neighborhood) > 0' END,
    CASE WHEN _f.city IS NOT NULL THEN 'strpos(private.text_key(v.city), ($1).city) > 0' END,
    CASE WHEN _f.is_active IS NOT NULL THEN 'v.is_active = ($1).is_active' END,
    CASE WHEN _f.leadership IS NOT NULL THEN 'v.leadership_status = ANY (($1).leadership)' END,
    CASE WHEN _f.is_baptized IS NOT NULL THEN 'v.is_baptized = ($1).is_baptized' END,
    CASE WHEN _f.levels IS NOT NULL OR _f.level_5_plus THEN
      '(v.g12_level = ANY (coalesce(($1).levels, ''{}'')) OR (($1).level_5_plus AND v.g12_level >= 5))' END,
    CASE WHEN _f.cell_links IS NOT NULL THEN 'v.cell_links && ($1).cell_links' END,
    CASE WHEN _f.created_from IS NOT NULL THEN 'v.created_at >= ($1).created_from' END,
    CASE WHEN _f.created_until IS NOT NULL THEN 'v.created_at < ($1).created_until' END)
$$;

-- A página, na ordem da RN-15. Quem aparece é decidido só pela members_view (escopo e excluídos),
-- que filtra por auth.uid() também aqui dentro. É definer só para ler a cadeia em
-- private.member_hierarchy, e só para ids que vieram da view. A cadeia nunca sai.
CREATE OR REPLACE FUNCTION public.members_list(
  _search text[] DEFAULT NULL, _leader_ids uuid[] DEFAULT NULL,
  _neighborhood text DEFAULT NULL, _city text DEFAULT NULL, _is_active boolean DEFAULT NULL,
  _leadership public.member_leadership_status[] DEFAULT NULL, _is_baptized boolean DEFAULT NULL,
  _levels integer[] DEFAULT NULL, _cell_links public.member_cell_link[] DEFAULT NULL,
  _created_from date DEFAULT NULL, _created_to date DEFAULT NULL,
  _limit integer DEFAULT 25, _offset integer DEFAULT 0)
RETURNS SETOF public.members_view
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _f   private.member_filter := private.member_filter_normalize(
         _search, _leader_ids, _neighborhood, _city, _is_active, _leadership,
         _is_baptized, _levels, _cell_links, _created_from, _created_to);
  _ids uuid[];
BEGIN
  IF _f.leader_ids = '{}' THEN RETURN; END IF;           -- RN-05: só pessoas indisponíveis
  -- 1. Os ids da página, calculando só as chaves da ordem e as colunas dos filtros ativos.
  EXECUTE format(
    'SELECT array_agg(p.id ORDER BY p.lvl NULLS LAST, p.name_key, p.id)
       FROM (SELECT v.id, v.g12_level AS lvl,
                    public.search_normalize(v.name) COLLATE "C" AS name_key
               FROM public.members_view v
              WHERE %s
              ORDER BY v.g12_level NULLS LAST, name_key, v.id
              LIMIT $2 OFFSET $3) p',
    private.member_filter_sql(_f))
    INTO _ids
    USING _f, least(greatest(coalesce(_limit, 25), 1), 100), greatest(coalesce(_offset, 0), 0);
  -- 2. As linhas da página. "id = ANY" é leakproof: entra na view e usa members_pkey.
  RETURN QUERY
    SELECT v.* FROM public.members_view v
     WHERE v.id = ANY (_ids)
     ORDER BY array_position(_ids, v.id);
END $$;

-- O total, com a mesma normalização e o mesmo WHERE.
CREATE OR REPLACE FUNCTION public.members_list_count(
  _search text[] DEFAULT NULL, _leader_ids uuid[] DEFAULT NULL,
  _neighborhood text DEFAULT NULL, _city text DEFAULT NULL, _is_active boolean DEFAULT NULL,
  _leadership public.member_leadership_status[] DEFAULT NULL, _is_baptized boolean DEFAULT NULL,
  _levels integer[] DEFAULT NULL, _cell_links public.member_cell_link[] DEFAULT NULL,
  _created_from date DEFAULT NULL, _created_to date DEFAULT NULL)
RETURNS bigint
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _f private.member_filter := private.member_filter_normalize(
       _search, _leader_ids, _neighborhood, _city, _is_active, _leadership,
       _is_baptized, _levels, _cell_links, _created_from, _created_to);
  _n bigint;
BEGIN
  IF _f.leader_ids = '{}' THEN RETURN 0; END IF;
  EXECUTE 'SELECT count(*) FROM public.members_view v WHERE ' || private.member_filter_sql(_f)
     INTO _n USING _f;
  RETURN _n;
END $$;

-- Os privilégios padrão do Supabase dão EXECUTE a anon, authenticated e service_role em função
-- nova de public: revogar e conceder de novo, como o E2.06 faz com a ministry_tree_nodes.
REVOKE ALL ON FUNCTION public.members_list(text[], uuid[], text, text, boolean,
  public.member_leadership_status[], boolean, integer[], public.member_cell_link[], date, date,
  integer, integer) FROM PUBLIC, anon, service_role;
-- … o mesmo para members_list_count; GRANT EXECUTE das duas só para authenticated.
-- private.text_key, private.member_filter_normalize e private.member_filter_sql:
--   REVOKE ALL … FROM PUBLIC, anon, authenticated, service_role.
-- Pós-condição: as duas RPCs com prosecdef, search_path fixo e EXECUTE só para authenticated
--   (além do dono); as três internas sem EXECUTE para esses papéis.
```
- **Por que SQL dinâmico:** com um `WHERE` fixo do tipo `(_x IS NULL OR …)`, toda coluna citada seria calculada para cada linha visível, mesmo com o filtro desligado, porque a view não é achatada. Com o texto montado só com os filtros ativos, a busca (`search_text`) e o vínculo (`cell_links`) só custam quando são usados.
- **Por que a página em duas etapas:** a etapa 1 percorre o conjunto filtrado calculando só as chaves de ordem. A etapa 2 calcula todas as colunas da view para as 25 linhas. Juntar a etapa 2 à 1 por `JOIN` faria a view inteira ser calculada, porque um *join* não entra numa view *security barrier*; o `id = ANY (…)` entra.
- **Por que a ordem vem pronta:** sem `order` na chamada, o PostgREST lê a função na ordem em que ela devolve (conferido no SQL gerado). O front não chama `.order()`, que reordenaria pela colação padrão e não pelo nome normalizado.
- **`STABLE`:** as consultas de dentro usam a mesma foto do banco, e o PostgREST roda a chamada só para leitura.

### Filtro de liderança sem expor a cadeia (RN-04, RN-05)
- **Quem vale:** dos 10 primeiros ids distintos, só os que a `members_view` de quem consulta devolve. Um id de quem a pessoa não vê, de um excluído ou de ninguém sai da lista do mesmo jeito. Se nenhum fica, a página volta vazia e o total é 0, sem erro.
- **"Abaixo de":** `ancestor_ids && (ids válidos)`, pela cadeia do E2.06, que inclui os inativos e não inclui a própria pessoa (`CHECK` de lá). A pessoa escolhida só aparece se estiver abaixo de outra escolhida. O cônjuge não entra.
- **O que sai do servidor:** só linhas da `members_view` e um número. Nenhuma resposta tem `ancestor_ids`, nem diz se um id é visível, além do que a própria `members_view` já responde a quem a lê por id.
- **Por que o "abaixo de" não vaza:** para quem vê o ministério, o conjunto visível é fechado para baixo (a descendência das âncoras do E2.02). Quem está abaixo de uma pessoa visível é visível. A exceção é quem vê só o próprio cadastro: o resultado é cruzado com a `members_view`, então ele recebe no máximo o próprio cadastro (RN-03).
- **Nomes na tela (AQ-2):** a tela lê `members_view` por `id=in.(…)` (até 10). O id que não volta é "Pessoa indisponível". Nunca pela `member_names` nem pelo `useMemberName`.

### Metas de tempo e índices
Volume de referência: 20 mil membros (profundidade até 10), 1.500 células, 100 mil relatórios com cerca de 10 participantes cada. As metas são no banco, medidas pelo QA com `EXPLAIN (ANALYZE, BUFFERS)`.

| Consulta | Meta |
|---|---|
| `members_list` (25 linhas) e `members_list_count`, sem filtros, Rita | até 300 ms cada |
| as mesmas, Pedro (escopo de cerca de 2 mil) | até 150 ms cada |
| a combinação do critério da RN-02 | até 1 s cada. As duas correm em paralelo, então a página e o total ficam em até 2 s com a rede. |
| só "Vínculo celular", Rita | até 500 ms cada |
| Liderança com um pastor (a igreja toda abaixo) e com um G12 de 2 mil abaixo | até 500 ms cada |
| `dashboard_summary` | o tempo de hoje mais 50 ms, no máximo (medir antes e depois) |
| `members_view` por id (formulário, autoria) | sem diferença: o plano não tem os `EXISTS` do vínculo quando `cell_links` não é pedida |

| Índice | Para quê | Situação |
|---|---|---|
| `members_created_at_idx` em `members (created_at) WHERE deleted_at IS NULL` | Datas de cadastro (RN-12) e "Novos membros" (E2.14). As comparações de `timestamptz` são *leakproof*, então entram na view. | Novo. A tarefa 1 confere se o E2.05 já criou um. |
| `member_hierarchy_ancestor_ids_idx` (GIN) e `member_hierarchy_g12_level_idx` | Liderança e nível | Do E2.06 |
| `cells_leader_id_idx`, `cells_timothy_id_idx`, `cells_host_id_idx`, `cell_report_participants_member_id_idx`, `cell_reports_date_id_idx` | Vínculo por linha (página) e por tabela *hash* (conjunto) | Existentes |
| `members_pkey` | As linhas da página por `id = ANY` | Existente |
| nenhum para `is_active`, `is_baptized`, bairro e cidade | Booleanos com pouca seletividade e "contém" sem acento. Toda consulta já percorre o conjunto visível. | Plano B no risco 5 |

### Contratos (RPC, Edge Functions, colunas novas)
**Tipos novos:** `public.member_cell_link` (`leader`, `timothy`, `host`, `attendee`, `none`) e `public.member_leadership_status` (`with_leader`, `no_leadership`, `pastor`). No `types.ts`, aparecem em `Enums` e em `Constants.public.Enums`.

**`members_view`:**
- saem `is_cell_leader`, `is_cell_timothy`, `is_cell_host` e `attended_last_30_days`;
- no fim: `leadership_status member_leadership_status` (RN-08) e `cell_links member_cell_link[]` (RN-10: as categorias da pessoa, ou `{none}`, ou `{}`);
- o `WHERE`, as outras colunas e os privilégios não mudam.

**RPCs (EXECUTE só para `authenticated`):**
| Função | Retorno | Observações |
|---|---|---|
| `members_list(_search text[], _leader_ids uuid[], _neighborhood text, _city text, _is_active boolean, _leadership member_leadership_status[], _is_baptized boolean, _levels integer[], _cell_links member_cell_link[], _created_from date, _created_to date, _limit integer = 25, _offset integer = 0)` | `SETOF members_view`, já na ordem da RN-15 | Todos os parâmetros com valor padrão nulo. Página além do fim: vazia, sem 416. `_levels`: 0 a 4 e 5 = "5 ou mais". |
| `members_list_count(` os mesmos 11 filtros `)` | `bigint` | O total exato, com a mesma normalização. |
| `cell_links_or_none(_links, _total_cells, _is_pastor)` | `member_cell_link[]` | Usada pela view. Pura. |
| `sp_day_start(_day date)` | `timestamptz` | Início do dia de Brasília. |

**`dashboard_summary`:** mesma assinatura e mesmas colunas. `members_without_leader` e `members_without_cell_link` passam a vir de `leadership_status` e `cell_links`.

**Internas (`private`, sem EXECUTE para os papéis da API):** tipo `member_filter`, `text_key`, `member_filter_normalize` e `member_filter_sql`.

**Edge Functions:** nenhuma muda.

Uso no front (esboço):
```ts
// src/hooks/use-members-list.ts
queryFn: async (): Promise<ListResult<MemberRow>> => {
  const args = toMembersListArgs(filters, search);               // src/lib/members/filters.ts
  const [rowsRes, countRes] = await Promise.all([
    supabase
      .rpc("members_list", { ...args, _limit: pageSize, _offset: (page - 1) * pageSize })
      .select(MEMBER_ROW_SELECT),                                  // sem .order(): a ordem é a da RPC
    supabase.rpc("members_list_count", args),
  ]);
  if (rowsRes.error) throw rowsRes.error;
  if (countRes.error) throw countRes.error;
  return { rows: rowsRes.data ?? [], total: countRes.data ?? 0 };
},
```

### Front
Segue o padrão do E1.08 ao E2.06: os componentes cuidam da tela, o acesso a dados fica nos hooks e a regra pura fica em `src/lib/`.

- **Domínio puro, com Vitest, sem React nem Supabase:**
  - `src/lib/filters/url.ts`: ler e gravar listas separadas por vírgula, sem repetidos e só com valores conhecidos; `isUuid`.
  - `src/lib/filters/dates.ts`: `isIsoDate` (data de calendário real: `2026-02-31` é falsa), comparação e o formato dd/mm/aaaa dos chips, a partir de `src/lib/dates/sao-paulo.ts` (E2.04 e E2.05).
  - `src/lib/members/filters.ts` (AQ-1), o módulo único do filtro de Membros:
    - tipo `MemberFilters` e `EMPTY_MEMBER_FILTERS`;
    - `parseMemberFilters(params)`, que devolve os filtros, a URL limpa (ou nulo, se nada mudou), `leadersTruncated` e `dateRangeInverted` (DA-4);
    - `writeMemberFilters(params, filters)`: sem os padrões, na ordem das opções, `leaders` na ordem da escolha, e tira `page`;
    - `clearMemberFilters(params)`: mantém só `size`;
    - `countActiveFilters(filters)` (0 a 9; DA-8);
    - `memberFilterChips(filters, leaderLabel)`, na ordem da UXD-3;
    - `toMembersListArgs(filters, search)`, tipado pelos `Args` do `types.ts`;
    - `memberListHref(card, week?)`: os links dos cards da RN-17, para o E2.14;
    - as opções vêm de `Constants.public.Enums.member_cell_link` e `member_leadership_status`, na ordem do enum. Os níveis são `0` a `4` e `5plus`, que vira 5 na RPC.
  - `src/lib/members/filter-texts.ts`: todos os textos deste spec, com `satisfies Record<…>` para cada enum (a compilação falha se surgir opção sem rótulo). Os rótulos de nível vêm do P40 (`src/lib/hierarchy/level.ts`).
  - `src/lib/access/member-form.ts` (E2.02): `initialLeader(access, me)` para todos com cadastro e "Criar Membro", e `showPrefilledLeaderNotice(access, form, me)` (P55).
  - O módulo do P20 do E2.04 (`src/lib/members/leadership.ts`): "havia líder" passa a ser o líder gravado; no cadastro novo, nunca há.
  - `src/lib/query-refresh.ts` (E2.06): `refreshAfterCellReportWrite(queryClient)` (AQ-7).
- **Hooks:**
  - `use-member-filters.ts`: lê a URL, grava a URL limpa na primeira leitura (`replace`), aplica, tira um chip e limpa tudo, sempre voltando para a página 1. Convive com o `useListSearchParams` (`q`, `page` e `size`) por atualizações funcionais do `setSearchParams`.
  - `use-members-list.ts`: as duas RPCs, em paralelo, num `queryFn` só, com a chave `["members", "list", { page, pageSize, search, filters }]`. Continua com `placeholderData` e `useClampPage`; o `fetchListPage` sai de Membros e continua em Células e Relatórios.
  - `use-visible-member-names.ts`: `members_view` por `id=in.(…)`, chave `["members", "visible-names", ids]`.
  - `use-panel-open.ts`: se o painel do computador ficou aberto, guardado no `localStorage` (UXD-14).
- **Componentes reaproveitáveis (`src/components/filters/`, P50 a P54):**
  - `FiltersButton`;
  - `FiltersSheet` (abaixo de 1024 px, com "Limpar" e "Aplicar filtros") e `FiltersPanel` (a partir de 1024 px, `Collapsible`), escolhidos pelo `useMinWidth(1024)` do E2.06;
  - `SingleChoiceFilter` (P52), `MultiChoiceFilter` (P51) e `PersonMultiFilter` (P53);
  - `DateRangeFilter` (P54, generaliza o `PeriodFieldset` do E2.05, com rótulos, mensagens e `max` opcional por props);
  - `FilterChips`, movido de `src/components/audit/`. A Auditoria passa a importar os movidos, sem mudança visível.
  - `PaginatedSelect` ganha `maxSelected` (opções desabilitadas e a mensagem com `role="status"`) e o rótulo de um valor sem nome.
- **Liderança (`PersonMultiFilter`):**
  - opções de `useMemberOptions({ search })`, sem `activeOnly`: inativos e quem consulta entram (RN-04);
  - os nomes dos valores vêm de `use-visible-member-names`;
  - sem a prop `name` no react-select, que criaria um `input` escondido com os ids no DOM (UX-09).
- **Telas:**
  - `Members.tsx` e `src/components/members/MemberFilters.tsx` (os 9 filtros na ordem da UXD-3): T1 a T6, com "Buscar", "Filtros (N)", "Limpar filtros", chips, o total em texto com `role="status"`, `Skeleton`, o `Alert` com "Tentar de novo", os vazios e o `aria-sort` em "Nível";
  - `MemberFormDialog` (E2.04): T7, com `PrefilledLeaderNotice` (P55) e "Ir para o líder".
- **Gravações de relatório:** a gravação (`use-cell-report-save` do E2.05, depois a RPC do E2.11), a exclusão (`use-cell-report-deletion`) e a restauração (`use-restore`) chamam `refreshAfterCellReportWrite`.

### Onde cada regra é imposta
| RN | Banco (constraint, RLS, trigger, RPC) | UI |
|---|---|---|
| RN-01 | `members_list` e `members_list_count` com os 9 filtros. Sem permissão nova: o acesso é o da `members_view`. | Painel com os 9 filtros (T2, T3), só para quem tem a lista (E2.02) |
| RN-02 | `private.member_filter_sql`: `AND` entre filtros, `= ANY` e `&&` dentro deles; total exato pela `members_list_count`; página por `LIMIT`/`OFFSET` sobre uma ordem total | "Aplicar filtros" no celular e na hora no computador; página 1 a cada mudança aplicada |
| RN-03 | Toda linha vem da `members_view` (escopo e excluídos); a cadeia só para ids que vieram dela | — |
| RN-04 | Normalizador: 10 primeiros distintos, só os visíveis; `ancestor_ids &&` (qualquer nível, passa por inativos, sem a própria pessoa, sem o cônjuge) | Seletor com limite de 10 (P53) e "Escolha até 10 pessoas." |
| RN-05 | Não visível, excluído e inexistente saem da lista de líderes; só eles: página vazia e total 0; nada da cadeia na resposta | "Pessoa indisponível" pela `members_view` por id, nunca pela `member_names` |
| RN-06 | `private.text_key` e `strpos` (texto literal, sem acento, espaços), 100 caracteres | Campo com `maxLength={100}` |
| RN-07 | `is_active` e `is_baptized` | `RadioGroup` ou `Select` |
| RN-08 | `members_view.leadership_status` | Caixas de seleção |
| RN-09 | `g12_level` do E2.06; 5 = "5 ou mais"; nulo fica fora | Opções com os rótulos do P40 |
| RN-10 | `members_view.cell_links` e `cell_links_or_none` | Caixas e dicas |
| RN-11 | `dashboard_summary` lê `cell_links` | — |
| RN-12 | `sp_day_start`, intervalo semiaberto, datas invertidas ignoradas, nulo fora | Conferência ao sair do campo e ao aplicar; mensagens |
| RN-13 | Nenhum parâmetro sensível; `search_text` e a saída mascarados (E1.08) | — |
| RN-14 | Normaliza os valores fora da regra (DA-1) | `src/lib/members/filters.ts`: URL, inválidos fora, contagem, chips e "Limpar filtros" |
| RN-15 | A ordem na `members_list` | Sem reordenar; `aria-sort` |
| RN-16 | O banco não preenche nada; o E2.04 recusa o cadastro sem líder (`leader_required`); o `a0_` deriva `has_leadership` | Líder inicial, aviso do P55 e sem o aviso do P20 no cadastro novo |
| RN-17 | As mesmas colunas da view no card e no filtro; `sp_day_start` para a semana | `memberListHref` (usado pelo E2.14) |

### Respostas às perguntas do UX (AQ-1 a AQ-7)
| # | Resposta |
|---|---|
| AQ-1 | **Confirmados** os nomes e os valores da tabela de Navegação e rotas: `leaders`; `neighborhood`; `city`; `status` (`active`, `inactive`); `leadership` (`with_leader`, `no_leadership`, `pastor`, os rótulos do enum); `baptized` (`yes`, `no`); `level` (`0` a `4` e `5plus`); `cell_link` (`leader`, `timothy`, `host`, `attendee`, `none`, os rótulos do enum); `from` e `to` (`aaaa-mm-dd`). Um módulo só, `src/lib/members/filters.ts`, como a UX sugeriu, inclusive os links dos cards para o E2.14. O servidor normaliza os mesmos valores (DA-1). |
| AQ-2 | **Confirmado.** A tela lê os nomes por `members_view` com `id=in.(…)` (até 10). A RPC trata do mesmo jeito o não visível, o excluído e o inexistente: os três ficam fora da lista de líderes válidos, e, se só houver eles, a lista vem vazia e o total é 0, sem erro. Nenhuma coluna nova expõe a cadeia. |
| AQ-3 | **Sim.** A `members_list` devolve as linhas da `members_view`, com as colunas que a tela pedir no `select` (as do E2.06 inclusive), já na ordem da RN-15, e a `members_list_count` dá o total exato. Metas em [Metas de tempo e índices](#metas-de-tempo-e-índices). Tempo-limite (57014) ou qualquer recusa vira o `Alert` (UX-16, UX-25). |
| AQ-4 | **DA-1.** Fora do tipo: recusa (400), que a tela nunca provoca. Com o tipo certo e fora da regra: normalizado como a tela, sem erro. |
| AQ-5 | **Sim, sem espera nova.** O `AuthContext` já carrega o próprio cadastro pela `members_view` no login (`member.id` e `member.name`), e `my_access()` (E2.02) traz `sees_whole_church`. O formulário abre com o líder no primeiro render. Sem cadastro (a conta X do E2.02), abre vazio. **`has_leadership`:** confirmado. A tela manda `true` junto com o líder, porque o interruptor está ligado, e o banco deriva e confere a coerência de qualquer forma (`a0_normalize_member` e o `CHECK` do E2.04; DA-11 do E2.02). |
| AQ-6 | **Confirmado.** `_created_from` e `_created_to` são `date` de Brasília, sem conversão no front e sem limite no futuro. O servidor monta o intervalo com os dois dias incluídos e deixa de fora o `created_at` nulo. |
| AQ-7 | **Sim.** `refreshAfterCellReportWrite(queryClient)` em `src/lib/query-refresh.ts` (E2.06), para `["cell_reports"]`, `["members"]`, `["cells"]` e `["dashboard"]`, com o mesmo `removeQueries` das inativas e `invalidateQueries` da ativa. É chamada pela gravação, pela exclusão e pela restauração de relatório. A gravação de célula já desatualiza `["members"]` (DA-6 do E2.06), o que cobre a célula ativada ou inativada. |

### Perguntas Q-1 a Q-4: padrão e custo das alternativas
O desenho segue os padrões adotados. Nenhuma alternativa muda a estrutura: as RPCs, a coluna `cell_links` e os componentes ficam.

| Pergunta | Padrão desenhado | Custo da alternativa |
|---|---|---|
| Q-1. Líder preenchido para quem vê a igreja toda | Para todos, com o aviso do P55 para quem vê a igreja toda | **Baixo, cerca de 0,5 dia, só no front.** `initialLeader` volta a exigir "vê só o ministério", o aviso sai, e a UX-24 entra nos testes. O banco não muda. |
| Q-2. Ordem padrão | Por nível e nome | **Baixo, cerca de 0,5 dia.** A etapa 1 da `members_list` passa a ordenar por nome normalizado e `id`; o `aria-sort` vai para "Nome"; os testes da RN-15 mudam. Se as duas ordens forem desejadas, um parâmetro `_order` com valores fixos. |
| Q-3. Quem só acompanha a rede | Sem opção própria | **Médio, cerca de 1 dia.** Valor novo no enum, numa migration própria (um valor novo de enum não pode ser usado na mesma transação que o cria); a regra em `cell_links_or_none` (sem categoria e com total de células maior que zero; o PO decide se pastor entra); opção, dica, chip, textos e testes. |
| Q-4. Vínculo e liderança por casal | Cada pessoa | **Médio, cerca de 2 dias.** (a) Liderança: o normalizador acrescenta o cônjuge de cada pessoa escolhida, só se ele também for visível, para não revelar a rede de quem a pessoa não vê (o PO confirma). (b) Vínculo: a view calcula também as categorias e o total de células do cônjuge (mais quatro `EXISTS` por linha, por `spouse_id`), e `cell_links_or_none` recebe os dois; o custo do card e do filtro de vínculo dobra. Textos e testes. |

### Decisões técnicas
| # | Decisão | Motivo |
|---|---|---|
| DT-01 | A lista vem de duas RPCs, `members_list` e `members_list_count`, *definer*, sobre a `members_view`, com SQL dinâmico só com os filtros ativos. | O filtro de Liderança precisa da cadeia, que está em `private` e não pode sair (RN-05, RN-23 do E2.02). O PostgREST aplica os filtros de uma RPC depois de materializar o resultado inteiro (conferido), então os filtros precisam ser parâmetros. Com o texto montado só com os ativos, as colunas caras só custam quando usadas. |
| DT-02 | Quem aparece é decidido só pela `members_view`. As RPCs leem a cadeia só no `WHERE`, para ids que vieram da view, e devolvem o tipo da view. | O escopo continua num lugar só (paridade do E2.02). É o arranjo da `ministry_tree_nodes` do E2.06. |
| DT-03 | A página em duas etapas: os ids com as chaves de ordem, depois as linhas por `id = ANY`. | As colunas da view (máscara, nomes de referência, autoria, vínculo) são calculadas para 25 linhas, e não para o conjunto. Um `JOIN` não entraria na view *security barrier*. |
| DT-04 | O total vem de uma segunda RPC, chamada em paralelo com a primeira. Sem 416. | O `count=exact` do PostgREST numa RPC contaria só a página. Uma resposta com as linhas e o total juntos perderia os tipos gerados das linhas. |
| DT-05 | A ordem é feita dentro da RPC: `g12_level NULLS LAST`, `search_normalize(name) COLLATE "C"` e `id`. O front não reordena. | RN-15 e DA-5. A chave já está sem acento e em minúsculas, então a comparação byte a byte é alfabética, rápida e igual em qualquer banco. |
| DT-06 | `members_view.cell_links`: os quatro `EXISTS` com igualdade simples, no nível de cima da view, e `cell_links_or_none` (não inlinável) para o "Sem vínculo". As quatro colunas antigas saem. | Uma definição só (RN-11). O planejador escolhe entre a busca por índice e a tabela *hash* pelo número de linhas. Custo zero quando a coluna não é pedida. |
| DT-07 | `members_view.leadership_status`, também no card "Sem Liderança". | RN-08 e RN-17 garantidas por construção. |
| DT-08 | Enums como tipo das colunas e dos parâmetros. O front lê os valores de `Constants`, e a URL usa os rótulos. | Sem strings de domínio repetidas. A compilação aponta opção sem texto. |
| DT-09 | A normalização (`member_filter_normalize`) e o `WHERE` (`member_filter_sql`) ficam num lugar só, usados pelas duas RPCs. | A página e o total nunca divergem. Filtro novo entra em dois pontos fixos, e os testes cobrem os dois. |
| DT-10 | Datas por intervalo semiaberto com `sp_day_start`, e índice parcial em `created_at`. | RN-12 e AQ-6: o nulo fica fora sozinho, o filtro entra na view (*leakproof*) e o E2.14 usa a mesma função. |
| DT-11 | Bairro e cidade por `strpos` sobre `private.text_key`, sem índice. | RN-06: sem curingas para escapar. Cerca de 100 ms no volume de referência. |
| DT-12 | Nomes da Liderança pela `members_view` por id (até 10). | AQ-2 e RN-05: a `member_names` resolve nomes de referência fora do escopo. |
| DT-13 | O líder já preenchido fica só na tela, a partir do `member` do `AuthContext` e de `my_access.sees_whole_church`. | RN-16: pela API nada é preenchido, e o E2.04 já recusa o cadastro sem líder. |
| DT-14 | `refreshAfterCellReportWrite` em toda gravação de relatório. | AQ-7: Participante e Sem vínculo mudam com os relatórios. |
| DT-15 | A `members_view` é recriada (`DROP` e `CREATE`), com guarda de dependentes e pós-condição de privilégios e opções. | DA-7. O `CREATE OR REPLACE VIEW` não tira colunas. |
| DT-16 | Quatro PRs: banco; componentes de filtro sem mudança de tela; Membros; Novo membro e cache. | O banco vai ao ar sozinho. Os componentes reaproveitáveis ficam separados da tela, e o PR 4 não depende dos outros. |

### Riscos (concorrência, escala, segurança)
1. **SQL dinâmico numa função *definer* (injeção).**
   - Mitigações: só fragmentos fixos, escolhidos pela nulidade de cada campo; os valores por `USING`; o `code-reviewer` confere que nenhuma entrada passa pelo `format`; pgTAP com textos maliciosos (`'); DROP …; --`, `%`, `_`, `\`, aspas).
2. **Função *definer* lendo a view.** A visibilidade depende de o `WHERE` da `members_view` usar `auth.uid()` e as funções `viewer_*`. Se alguém trocar a view para *invoker* ou passar a usar `current_user`, as RPCs mudariam de comportamento.
   - Mitigações: o teste de paridade por persona (ids e total da lista sem filtros iguais aos da view); a nota nas Armadilhas do `CLAUDE.md`.
3. **A ordem vem da saída da função.** O PostgREST não reordena: sem `order`, a consulta gerada não tem `ORDER BY` e lê a função na ordem.
   - Mitigações: o teste de API paginando 60 homônimos; nenhum `.order()` no hook. Se o PostgREST mudar isso, a saída é devolver uma coluna de posição (função nova, sem mudar a view).
4. **Custo do vínculo no conjunto inteiro** (card e filtro). Fica perto do de hoje, mas depende de o planejador escolher a tabela *hash*. Com estatísticas ruins, a meta pode estourar.
   - Mitigação: `EXPLAIN` no volume, com `ANALYZE` das tabelas antes.
   - Plano B: uma tabela `private.member_last_attendance` (última participação em célula realizada de cada membro), mantida por trigger, e o `attendee` vira `last_attended_on >= sp_today() - 30`. Volta ao `architect` antes.
5. **Bairro e cidade sem índice.** Cerca de 100 ms em 20 mil.
   - Plano B: coluna gerada com `private.text_key` e índice `pg_trgm`. A extensão não está instalada hoje.
6. **Duas chamadas (linhas e total) em fotos diferentes.** O total pode ficar diferente das linhas por um instante depois de uma gravação concorrente. A leitura seguinte corrige, e o `useClampPage` trata a página além do fim.
7. **`DROP VIEW` na migration 1.** Um dependente faz a migration falhar sem mudar nada (conferência b). Privilégios ou opções diferentes de antes também (pós-condição). Repetir `WITH (security_barrier = true, security_invoker = false)`.
8. **O número do Dashboard muda no deploy do PR 1** (RN-11), antes da tela nova. É esperado; vale avisar a liderança. O E5.04 sabe que os números não batem com o legado.
9. **O tipo de retorno amarrado à view.** A partir daqui, `DROP VIEW members_view` exige derrubar e recriar as duas RPCs. Um `CASCADE` apagaria as funções. `CREATE OR REPLACE VIEW` com colunas novas no fim continua funcionando: a função passa a devolver a coluna nova.
10. **Tempo-limite de 8 s de `authenticated`.** Muito acima das metas. O 57014 vira o `Alert` (UX-25).
11. **Valores fora do tipo pela API.** Recusa técnica (400) só pela API (DA-1).
12. **Cadastros "sem topo"** (DA-2 do E2.06, só por carga). Aparecem em "Com líder", em nenhum nível e com o rótulo "Sem liderança". O E4.04 e o E4.09 os listam (DA-3).
13. **Advisor do Supabase:** nada novo além de duas funções *definer* expostas, no mesmo padrão de `my_access` e `delete_member`. A `members_view` continua *security definer* (não trocar para *invoker*).

### Ordem com os outros passos
**Pré-requisitos do PR 1 (guarda na migration 1):**
- PR 1 do E2.06 (`private.member_hierarchy`, `members_view.g12_id`), que já exige o PR 1 do E2.02;
- banco do E2.05 (`created_by_kind` e `created_at` anulável).

**PR 2 (componentes):** depois do front da Auditoria do E2.05 (move `FilterChips` e `PeriodFieldset`), do PR 2 do E2.06 (`use-min-width`) e do `PaginatedSelect` do E2.02 (PR 2). Não depende do banco.

**PR 3 (Membros):** depois do PR 1 (os tipos; em produção antes do promote) e do PR 2, e dos PRs de front que mexem em `Members.tsx`: E2.01 (PR 2), E2.02 (PR 4) e E2.06 (PRs 2 e 4).

**PR 4 (Novo membro e cache):** depois do E2.02 (PR 4, `member-form.ts`), do E2.04 (PR 3, `MemberFormDialog`), do front de relatório do E2.05 (`use-cell-report-save`) e do E2.06 (PR 4, `query-refresh.ts`). Não depende dos PRs 1 a 3.

**Ordem ideal do bloco:** … E2.06 → E2.05 → **E2.07** (PR 1, PR 2 e PR 4 em paralelo; depois o PR 3). Os passos E2.08 a E2.14 vêm depois e podem usar os componentes do PR 2.

### Dependências e impactos em outros passos
| Passo | Relação |
|---|---|
| E1.08 | A ordem de Membros (RN-03 de lá) passa à RN-15 daqui, e "sem vínculo" (RN-08 c de lá) passa à RN-10 daqui. As quatro colunas de vínculo saem, e os testes do PR 3 de lá são adaptados. O `fetchListPage` continua em Células e Relatórios. |
| E2.01 | A lista herda `deleted_at` pela view. Os ganchos de exclusão e restauração de relatório passam a chamar `refreshAfterCellReportWrite`. |
| E2.02 | O mesmo `WHERE` na `members_view` (paridade). `member-form.ts` estende a P-PER-22 a todos. O `PaginatedSelect` ganha `maxSelected`. |
| E2.04 | O `a0_normalize_member` e o `CHECK` garantem `has_leadership`, e a recusa `leader_required` cobre a RN-16 pela API. O aviso do P20 passa a olhar o líder gravado. |
| E2.05 | O `created_at` nulo fica fora dos filtros de data. `FilterChips` e `PeriodFieldset` vão de `src/components/audit/` para `src/components/filters/`. |
| E2.06 | `private.member_hierarchy` (cadeia, nível e total de células) é lida pelas RPCs e pela view. `query-refresh.ts` ganha a função de relatório. |
| E2.10, E2.12 | Os componentes P50 a P54. Se um filtro precisar de dado fora da view, o mesmo par normalizador e `WHERE`. `sp_day_start` para as datas. |
| E2.11 | A RPC de relatório chama `refreshAfterCellReportWrite`. Participante de "Não houve célula" não dá vínculo (`was_held`). |
| E2.14 | Os cards de membros usam `memberListHref`. "Novos membros da semana" conta `created_at` entre `sp_day_start(week_start)` e `sp_day_start(week_end + 1)`, a mesma regra do filtro. |
| E4.04, E4.09 | Sem trigger novo: a carga não muda nada aqui. Os cadastros "sem topo" (DA-3). |
| E5.04 | Os números de "Sem vínculo" e os níveis acima do 6º não batem com o legado (esperado). |
| Consolidação | A flag entra no `WHERE` da `members_view`, e a lista, o total e os cards herdam. |

**Mudanças nos documentos, no aceite** (o `product-owner` atualiza a matriz, a seção 3 e o Progresso; o `architect` atualiza o resto do `CLAUDE.md` na revisão final):
- **`CLAUDE.md`:**
  - **Schema efetivo:** os enums `member_cell_link` e `member_leadership_status`; na `members_view`, `leadership_status` e `cell_links` no lugar das quatro colunas de vínculo.
  - **Lógica no banco:** o vínculo celular numa definição só (`members_view.cell_links`: célula ativa, relatório de célula realizada nos últimos 30 dias, total de células zero e não pastor para "Sem vínculo"), lida pela lista e pelo card; `members_list` e `members_list_count` (*definer*, SQL dinâmico com os filtros ativos, a cadeia só no `WHERE`); `sp_day_start`.
  - **Front:** Membros paginada pela `members_list`, com os 9 filtros na URL (`src/lib/members/filters.ts`) e a ordem por nível; o líder já preenchido para todos; os componentes de filtro em `src/components/filters/`. Sai "Membros é paginada no servidor pela `members_view`".
  - **Armadilhas**, entram:
    - "filtros do PostgREST no resultado de uma RPC rodam depois de o resultado inteiro ser materializado: filtro de lista que precisa de desempenho vai como parâmetro da RPC";
    - "a `members_list` devolve as linhas já na ordem da RN-15 do E2.07; o front não usa `.order()` nela";
    - "filtro novo de Membros entra em `private.member_filter_normalize` e `private.member_filter_sql`, e só como fragmento fixo; valor nunca é concatenado";
    - "a `members_view` é o tipo de retorno da `members_list`: `DROP VIEW` exige recriar as duas RPCs, e todo `CREATE` ou `CREATE OR REPLACE` da view repete `WITH (security_barrier = true, security_invoker = false)`";
    - "o vínculo celular é só a coluna `cell_links`".
  - **Matriz** (PO): "Filtros de membros" em ✅.
- **`docs/migracao.md`** (PO):
  - **3.2:** MEM-13, MEM-14 e MEM-15 em ✅. "Onde impor": MEM-13, "RPC `members_list` e `members_list_count` + UI"; MEM-14, "`members_view.cell_links`"; MEM-15, "UI".
  - **3.6:** DSH-03 com "Sem vínculo celular" pela RN-10 do E2.07; DSH-05 com Membros pronto (`memberListHref`).
  - **Progresso:** o E2.07 com o link do spec e "(desenho pronto; entra depois do banco do E2.05 e do PR 1 do E2.06 em produção)".
  - **E5.04:** a diferença esperada de "Sem vínculo celular" e dos níveis acima do 6º.

### Pontos de extensão
| Futuro | Onde muda |
|---|---|
| Q-1 a Q-4 | Ver [Perguntas Q-1 a Q-4](#perguntas-q-1-a-q-4-padrão-e-custo-das-alternativas). |
| Filtros de Células e Relatórios (E2.10, E2.12) | Os componentes P50 a P54. Pelo PostgREST sobre a view, quando todo dado do filtro está nela (o G12 da célula já está na `cells_view`); pelo par normalizador e `WHERE`, quando não. |
| Cards do Dashboard (E2.14) | `memberListHref` e `sp_day_start`. |
| Consolidação | O `WHERE` da `members_view`. |
| Desempenho do vínculo | Plano B do risco 4 (`private.member_last_attendance`). |
| Bairro e cidade | Plano B do risco 5 (`pg_trgm`). |

### Implantação
| PR | Ordem | Efeito no front em produção |
|---|---|---|
| 1 (banco) | merge → "Deploy: banco" (migrations 1 e 2) | O card "Sem Vínculo Celular" passa à RN-10 (RN-11). A lista de hoje continua igual: lê a `members_view` direto e não pede as colunas que saíram. |
| 2 (componentes) | merge → promote | Nenhum. A Auditoria fica igual. |
| 3 (Membros) | merge → promote (recusado se o PR 1 não estiver no banco) | Os filtros e a ordem por nível. |
| 4 (Novo membro e cache) | merge → promote | O líder já preenchido para todos e o aviso para quem vê a igreja toda. |

- Antes do "Deploy: banco" do PR 1, o usuário roda a [conferência](#conferência-em-produção-tarefa-1). Uma guarda que falha não muda nada, e a publicação pode ser repetida.
- **Rollback:**
  - o front volta pelo promote do commit anterior;
  - o banco volta com uma migration nova, que recria as quatro colunas e o corpo antigo da `dashboard_summary`, se for preciso. As RPCs novas podem ficar, sem leitor. Em produção, hoje, só há dados de teste.

### Conferência em produção (tarefa 1)
SQL **só de leitura**, para o usuário rodar no SQL Editor do projeto `gkhnjhmgeceoaqeynhrj` antes do "Deploy: banco" do PR 1. Nenhuma consulta devolve dado pessoal: só nomes de objetos, definições e contagens.

```sql
-- a. Pré-requisitos. Esperado: todos verdadeiros.
SELECT to_regclass('private.member_hierarchy') IS NOT NULL                        AS e206_pr1,
       EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.members_view'::regclass
                AND attname = 'g12_id' AND NOT attisdropped)                       AS e206_view,
       EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.members'::regclass
                AND attname = 'created_by_kind' AND NOT attisdropped)              AS e205_banco,
       to_regprocedure('public.viewer_scope_contains_any(uuid[])') IS NOT NULL    AS e202_pr1;

-- b. Quem depende da members_view (o DROP VIEW da migration 1 falharia). Esperado: 0 linhas.
SELECT d.classid::regclass AS catalogo, d.objid,
       CASE WHEN d.classid = 'pg_rewrite'::regclass
            THEN (SELECT ev_class::regclass::text FROM pg_rewrite WHERE oid = d.objid)
            WHEN d.classid = 'pg_proc'::regclass THEN d.objid::regprocedure::text END AS objeto
  FROM pg_depend d
 WHERE d.refobjid IN ('public.members_view'::regclass,
                      (SELECT reltype FROM pg_class WHERE oid = 'public.members_view'::regclass))
   AND d.deptype = 'n'
   AND NOT (d.classid = 'pg_rewrite'::regclass
            AND d.objid IN (SELECT oid FROM pg_rewrite WHERE ev_class = 'public.members_view'::regclass));

-- c. Nomes livres. Esperado: 0 linhas.
SELECT 'tipo' AS objeto, n.nspname || '.' || t.typname AS nome
  FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
 WHERE (n.nspname, t.typname) IN (('public', 'member_cell_link'), ('public', 'member_leadership_status'),
                                  ('private', 'member_filter'))
UNION ALL
SELECT 'função', p.oid::regprocedure::text
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE (n.nspname, p.proname) IN (('public', 'members_list'), ('public', 'members_list_count'),
                                  ('public', 'cell_links_or_none'), ('public', 'sp_day_start'),
                                  ('private', 'text_key'), ('private', 'member_filter_normalize'),
                                  ('private', 'member_filter_sql'));

-- d. Índices em members.created_at (informa: se o E2.05 já criou um, a migration não cria outro).
SELECT indexname, indexdef FROM pg_indexes
 WHERE schemaname = 'public' AND tablename = 'members' AND indexdef ILIKE '%(created_at%';

-- e. Quem cita as colunas de vínculo que saem. Esperado: só dashboard_summary.
SELECT n.nspname, p.proname
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname IN ('public', 'private')
   AND p.prosrc ~ '\m(is_cell_leader|is_cell_timothy|is_cell_host|attended_last_30_days)\M';

-- f. Corpos atuais (base das migrations; sem dado pessoal).
SELECT pg_get_viewdef('public.members_view'::regclass, true);
SELECT pg_get_functiondef('public.dashboard_summary(timestamptz)'::regprocedure);
SELECT relacl, reloptions FROM pg_class WHERE oid = 'public.members_view'::regclass;

-- g. Prévia da RN-11 na igreja toda (só contagens, entre os ativos): "sem vínculo" de hoje × o novo.
WITH m AS (
  SELECT m.id, m.is_pastor, coalesce(h.total_cells, 0) AS total_cells
    FROM public.members m LEFT JOIN private.member_hierarchy h ON h.member_id = m.id
   WHERE m.deleted_at IS NULL AND m.is_active),
f AS (
  SELECT m.*,
    EXISTS (SELECT 1 FROM public.cells c WHERE c.deleted_at IS NULL
             AND m.id IN (c.leader_id, c.timothy_id, c.host_id))                AS papel_hoje,
    EXISTS (SELECT 1 FROM public.cells c WHERE c.deleted_at IS NULL AND c.is_active
             AND m.id IN (c.leader_id, c.timothy_id, c.host_id))                AS papel_novo,
    EXISTS (SELECT 1 FROM public.cell_report_participants p
              JOIN public.cell_reports r ON r.id = p.report_id
             WHERE p.member_id = m.id AND r.deleted_at IS NULL
               AND r.date >= public.sp_today() - 30)                             AS part_hoje,
    EXISTS (SELECT 1 FROM public.cell_report_participants p
              JOIN public.cell_reports r ON r.id = p.report_id
             WHERE p.member_id = m.id AND r.deleted_at IS NULL AND r.was_held
               AND r.date >= public.sp_today() - 30)                             AS part_novo
    FROM m)
SELECT count(*) FILTER (WHERE NOT is_pastor AND NOT (papel_hoje OR part_hoje))                    AS sem_vinculo_hoje,
       count(*) FILTER (WHERE NOT is_pastor AND NOT (papel_novo OR part_novo) AND total_cells = 0) AS sem_vinculo_novo
  FROM f;

-- h. Dados que mudam de categoria e cadastros sem data (informa).
SELECT (SELECT count(*) FROM public.cells WHERE deleted_at IS NULL AND NOT is_active) AS celulas_inativas,
       (SELECT count(*) FROM public.cell_reports r
         WHERE r.deleted_at IS NULL AND NOT r.was_held
           AND EXISTS (SELECT 1 FROM public.cell_report_participants p WHERE p.report_id = r.id))
                                                                                    AS nao_houve_com_participantes,
       (SELECT count(*) FROM public.members WHERE deleted_at IS NULL AND created_at IS NULL)
                                                                                    AS sem_data_de_cadastro;

-- i. Volume e configuração.
SELECT (SELECT count(*) FROM public.members WHERE deleted_at IS NULL)             AS membros,
       (SELECT count(*) FROM public.cells WHERE deleted_at IS NULL)               AS celulas,
       (SELECT count(*) FROM public.cell_reports
         WHERE deleted_at IS NULL AND date >= public.sp_today() - 30)             AS relatorios_30_dias,
       current_setting('work_mem')                                                AS work_mem;
SELECT rolname, rolconfig FROM pg_roles WHERE rolname IN ('authenticated', 'authenticator');
```
**Parar e voltar ao `architect`:** (a) com algum falso; (b) ou (c) com linhas; (e) com alguma função além da `dashboard_summary`.

### Verificações obrigatórias (para o QA)
**pgTAP** (`supabase/tests/database/e207_*.test.sql`, autocontido, com `ROLLBACK`). A massa é a do Negócio, com os dados que as regras do E2.04 exigem, montada com os triggers ligados. As consultas "pela API" rodam como `authenticated`, com `request.jwt.claims` de cada persona.

- **Estrutura e privilégios:**
  - os dois enums;
  - a `members_view` sem as quatro colunas antigas, com `leadership_status` e `cell_links` no fim, com `security_barrier`, sem `security_invoker` e com os privilégios de antes;
  - `members_list` e `members_list_count` *definer*, com `search_path` fixo e EXECUTE só para `authenticated`;
  - `cell_links_or_none` e `sp_day_start` com EXECUTE para `authenticated`; as três internas sem EXECUTE para `anon`, `authenticated` e `service_role`;
  - nenhum corpo de função cita as colunas que saíram.
- **RN-10:** a tabela "Vínculo celular da massa", com Rita, e todos os critérios da regra. As datas são relativas a `sp_today()` (hoje − 30 entra, hoje − 31 não), sem depender do relógio.
- **RN-11 e RN-17:** para Rita, Pedro, Diego, Ester e Hugo, cada card de membros da `dashboard_summary` igual à `members_list_count` com o equivalente da RN-17, e os números do critério (5, 3 e 0).
- **RN-02 a RN-09, RN-12, RN-13 e RN-15:** os critérios pela `members_list` e pela `members_list_count`, com a sessão de cada persona.
- **RN-04 e RN-05:**
  - não visível, excluído e inexistente dão a mesma resposta, sem erro, sozinhos e junto com uma pessoa visível;
  - 12 ids valem os 10 primeiros; repetidos e nulos (DA-2);
  - a pessoa escolhida só aparece abaixo de outra escolhida;
  - nenhuma coluna da resposta tem a cadeia; o resultado de quem vê só o próprio cadastro é no máximo ele (RN-03).
- **RN-06:** acentos, maiúsculas, espaços nas pontas e seguidos, tabulação, `%`, `_`, `\`, aspas, texto com mais de 100 caracteres e cadastro sem bairro.
- **RN-12:** o limite do dia de Brasília (23:30 de Brasília = 02:30 UTC do dia seguinte), `created_at` nulo, só "a partir de", só "até", datas invertidas (DA-4) e datas futuras.
- **RN-15:** a ordem da massa; 60 membros do nível 144 com o mesmo nome, percorridos de 25 em 25 pela `members_list`, aparecem uma vez cada; com filtro, a mesma ordem relativa.
- **Injeção (risco 1):** textos maliciosos em bairro, cidade e busca são tratados como texto, sem erro e sem efeito.
- **DA-1:** os valores fora da regra normalizados; um valor fora do enum e um uuid malformado recusados (22P02).
- **Paridade (E2.02):** para cada persona, os ids de todas as páginas da `members_list` sem filtros são os da `members_view`, e a `members_list_count()` é igual à contagem dela.
- **Testes existentes adaptados:** `e108_pr3_dashboard_rpcs` e `e201_04_cells_reports` (e qualquer outro que use as quatro colunas), `src/pages/Dashboard.test.tsx`, `src/hooks/use-dashboard.test.tsx` e `e2e/dashboard.spec.ts`, se o número da massa mudar.

**Concorrência:** nenhum cenário novo. O passo só lê.

**Volume:** as metas de [Metas de tempo e índices](#metas-de-tempo-e-índices), com o `EXPLAIN (ANALYZE, BUFFERS)` anexado ao PR, no gerador de volume do E1.08 e do E2.06, com relatórios de célula realizada e de "Não houve célula" e com participantes. Conferir no plano:
- a etapa 2 da `members_list` usa `members_pkey`;
- sem filtro de vínculo, o plano não tem os `EXISTS` de `cell_links`;
- com filtro de vínculo e no Dashboard, os `EXISTS` viram tabelas *hash*;
- a Liderança usa o semi-join com `private.member_hierarchy`.

**Vitest:** `src/lib/filters/{url,dates}.ts`; `src/lib/members/filters.ts` (leitura e limpeza da URL, 10 primeiros, datas invertidas, contagem de 1 a 9 com a DA-8, chips na ordem, argumentos da RPC e os links da RN-17); `member-form.ts` (líder inicial e aviso); o P20 sem aviso no cadastro novo; `query-refresh.ts` com um `QueryClient` de verdade.

**Playwright:** os critérios `UX-` de cada PR com a massa, mais o *smoke* de login.

## Tarefas
_Seção do `architect`._

Quatro PRs no `mci-connect`. **O PR 1 começa depois do banco do E2.05 e do PR 1 do E2.06 em produção.**
- Dentro de cada PR, o banco vai primeiro, e os tipos são regenerados antes do front.
- Cada desenvolvedor aciona o `code-reviewer` ao terminar a sua tarefa; esse passo não aparece na tabela.
- Na coluna RNs, os números são das regras deste spec. Na coluna UX, os dos critérios `UX-`.

| # | Responsável | Descrição | Arquivos | RNs | UX | Depende de |
|---|---|---|---|---|---|---|
| **PR 1: banco** | | | | | | |
| 1 | backend-developer | Reler as migrations finais do E2.02, do E2.04, do E2.05 e do E2.06 em produção e confirmar os nomes usados aqui: `private.member_hierarchy`, o alias `h` e as colunas finais da `members_view`, `created_by_kind`, `viewer_scope_contains_any`, um índice de `created_at` do E2.05 e um ajudante de data que já exista. Entregar o SQL de [Conferência em produção](#conferência-em-produção-tarefa-1) para o usuário rodar e usar a saída (f) como base das migrations. Parar e voltar ao `architect` nos casos listados ali. | — | 03, 10, 11, 12 | — | banco do E2.05 e PR 1 do E2.06 em produção |
| 2 | backend-developer | Migration 1: guarda; enums; `cell_links_or_none`; `sp_day_start`; `members_view` recriada (sem as quatro colunas, com `leadership_status` e `cell_links` no fim, o mesmo `WHERE`, as mesmas opções e os mesmos privilégios); `dashboard_summary` com os dois `FILTER`s; `members_created_at_idx`; pós-condições. | `supabase/migrations/<ts>_e207_01_cell_link.sql` | 08, 10, 11, 17 | — | 1 |
| 3 | backend-developer | Migration 2: tipo `private.member_filter`; `private.text_key`, `private.member_filter_normalize` e `private.member_filter_sql`; `members_list` e `members_list_count`; privilégios; pós-condições. Regenerar o `types.ts` e ajustar o `Omit` de `src/lib/members/fields.ts`, sem mudar comportamento. | `supabase/migrations/<ts>_e207_02_member_list.sql`, `src/integrations/supabase/types.ts`, `src/lib/members/fields.ts` | 01 a 09, 12 a 15, 17 | dados de 11, 12, 13 | 2 |
| 4 | qa | pgTAP de [Verificações](#verificações-obrigatórias-para-o-qa), adaptação dos testes que usam as quatro colunas e volume com `EXPLAIN`. | `supabase/tests/database/e207_*.test.sql`, testes existentes afetados | 01 a 15, 17 | — | 3 (escreve em paralelo com a 2 e a 3, a partir dos contratos) |
| **PR 2: componentes de filtro (P50 a P54), sem mudança de tela** | | | | | | |
| 5 | frontend-developer | `src/lib/filters/{url,dates}.ts` com Vitest; em `src/components/filters/`: `FiltersButton`, `FiltersSheet`, `FiltersPanel` (com `use-panel-open`), `SingleChoiceFilter`, `MultiChoiceFilter`, `PersonMultiFilter`, `DateRangeFilter` (generaliza o `PeriodFieldset`) e `FilterChips` (movido da Auditoria); `PaginatedSelect` com `maxSelected` e o rótulo do valor sem nome. A Auditoria passa a importar os movidos, sem mudança visível. | `src/lib/filters/*`, `src/components/filters/*`, `src/hooks/use-panel-open.ts`, `src/components/select/PaginatedSelect.tsx`, `src/components/audit/*`, `src/pages/Events.tsx` | 02, 04, 05, 12, 14 | 03, 04, 06, 08, 10, 17 a 21 | front da Auditoria do E2.05, PR 2 do E2.06 e PR 2 do E2.02 na `main` |
| 6 | qa | Testes de componente dos P50 a P54 (rede, relógio e `matchMedia` simulados) e axe; a Auditoria sem regressão (os testes dela passam sem mudança). | `src/components/filters/*.test.tsx` | — | 03, 04, 06, 08, 10, 17 a 21 | 5 |
| **PR 3: Membros com filtros** | | | | | | |
| 7 | frontend-developer | `src/lib/members/{filters,filter-texts}.ts` com Vitest; `use-member-filters`; `use-members-list` pelas duas RPCs; `use-visible-member-names`; `src/components/members/MemberFilters.tsx`; `Members.tsx` (T1 a T6: "Buscar", "Filtros (N)", "Limpar filtros", chips, total em texto com `role="status"`, `Skeleton`, `Alert` com "Tentar de novo", vazios e `aria-sort`). | `src/lib/members/*`, `src/hooks/{use-member-filters,use-members-list,use-visible-member-names}.ts`, `src/components/members/MemberFilters.tsx`, `src/pages/Members.tsx` | 01 a 07, 09, 10, 12, 14, 15, 17 | 01 a 21, 25 | 3 (tipos) e 5; PRs de Membros do E2.01, do E2.02 e do E2.06 na `main` |
| 8 | ux-designer | Revisão de UI do PR 3 (T1 a T6, P50 a P54) em 320, 360, 768, 1024 e 1280 px, nos temas claro e escuro, com zoom de 200%. | — | — | 01 a 21, 25 | 7 |
| 9 | qa | Vitest (`filters`, `filter-texts`); testes de componente (UX-02, 05, 14, 15, 16, 25); Playwright com a massa (UX-01, 07, 09, 11, 12, 13, 17, 18, 19 e os critérios da RN-01 à RN-15 e da RN-17 pela tela); axe (UX-20, 21). | `src/**/*.test.ts(x)`, `e2e/membros-filtros.spec.ts` | 01 a 15, 17 | 01 a 21, 25 | 7 |
| **PR 4: Novo membro e cache dos relatórios** | | | | | | |
| 10 | frontend-developer | `src/lib/access/member-form.ts`: líder inicial para todos com cadastro e o aviso para quem vê a igreja toda; o P20 só com o líder gravado; `PrefilledLeaderNotice` (P55, com "Ir para o líder": rola, põe o foco e destaca por 2 s, sem animação com `prefers-reduced-motion`); `MemberFormDialog`; `refreshAfterCellReportWrite` e as chamadas nos ganchos de relatório. | `src/lib/access/member-form.ts`, `src/lib/members/leadership.ts`, `src/components/members/{MemberFormDialog,PrefilledLeaderNotice}.tsx`, `src/lib/query-refresh.ts`, `src/hooks/{use-cell-report-save,use-cell-report-deletion,use-restore}.ts` | 16 | 22, 23 | PR 4 do E2.02, PR 3 do E2.04, front de relatório do E2.05 e PR 4 do E2.06 na `main` |
| 11 | ux-designer | Revisão de UI do PR 4 (T7, P55). | — | — | 22, 23 | 10 |
| 12 | qa | Vitest (`member-form`, P20, `query-refresh`); testes de componente (UX-22, 23; a UX-24 só se a alternativa da Q-1 for adotada); Playwright (critérios da RN-16 e, depois do PR 3, o da AQ-7: excluir um relatório e ver Participante mudar na lista filtrada sem recarregar). | `src/**/*.test.ts(x)`, `e2e/membros-novo.spec.ts` | 10, 16 | 22, 23 | 10 |
| **Fechamento** | | | | | | |
| 13 | architect | Revisão final dos 4 PRs. Atualizar o `CLAUDE.md` ([Mudanças nos documentos](#dependências-e-impactos-em-outros-passos)). O aceite, a matriz e o `docs/migracao.md` são do `product-owner`. | `CLAUDE.md` | — | — | 4, 6, 9, 12 |

**Ordem de execução:**
- PR 1: 1 → 2 → 3. A 4 é escrita em paralelo com a 2 e a 3 e roda depois da 3. O PR 1 só vai para o "Deploy: banco" com a 4 aprovada (metas e paridade).
- PR 2 (5 → 6) e PR 4 (10 → (11 ∥ 12)) em paralelo com o PR 1: não dependem do banco.
- PR 3: 7 → (8 ∥ 9), depois do PR 1 mergeado (tipos) e do PR 2. O promote do PR 3 exige o PR 1 no banco.
- 13 no fim.

**Critérios de pronto**
1. **Tarefas de banco (2 e 3):**
   - as migrations rodam num banco zerado depois das existentes e rodam de novo sem erro;
   - depois da 1, a lista de hoje (pela `members_view`) continua certa, e o Dashboard mostra o número novo;
   - nenhuma função nova com EXECUTE para `anon`; as internas sem EXECUTE para os papéis da API;
   - o `types.ts` está regenerado;
   - os testes do E1.03, do E1.08, do E2.01, do E2.02, do E2.04, do E2.05 e do E2.06, adaptados, continuam passando.
2. **Tarefa 2:** a guarda falha num banco sem o E2.06; o `DROP` falha sem mudar nada num banco com uma view de teste sobre a `members_view`; a pós-condição falha se um privilégio da view mudar.
3. **Tarefa 3:** nenhuma entrada passa pelo `format` (só `private.member_filter_sql`, com fragmentos fixos); a paridade por persona passa.
4. **Tarefa 4:** todos os critérios das RNs que dependem do banco passam, e as metas estão atendidas, com o `EXPLAIN` no PR.
5. **Tarefas 5, 7 e 10:**
   - `npm run lint`, `npm test` e `npm run build` verdes;
   - sem `any` e sem asserção de tipo (`as Tipo`) nos arquivos novos (`as const` é permitido);
   - nenhuma regra de domínio dentro de componente (fica em `src/lib/`);
   - nenhum texto do spec fora dos módulos de texto;
   - nenhuma leitura de `members` direto da tabela, e nenhuma chamada à `member_names` na Liderança.
6. **Tarefa 5:** a Auditoria fica igual (os testes dela passam sem mudança).
7. **Tarefa 7:**
   - a URL é limpa na primeira leitura, com `replace`;
   - com o link do critério da RN-05, nem o nome nem o id de Tiago aparecem no DOM;
   - o hook da lista não chama `.order()`.
8. **Tarefa 10:** no cadastro novo, o líder aparece no primeiro render, sem passar por vazio; na edição, nada muda.
9. **Tarefas 8 e 11:** o `ux-designer` dá o veredito e lista os ajustes, que voltam ao `frontend-developer` antes de o QA fechar o PR.

> **Em produção (2026-11-26):** PR 1 mergeado (squash `deff10d`) e aplicado pelo "Deploy: banco" (plano antes: só as duas migrations), sem promote. `code-reviewer` independente aprovou, com três sugestões (registrar o desvio do `search_path` da `cell_links_or_none` no spec; a exceção por nome no `e206_01`; o `ILIKE ALL` com muitos `%`, sem ação). **A conferência da tarefa 1 não foi rodada em produção** (sessão sem acesso ao banco); as guardas e as pós-condições das migrations passaram. A lista fechada do portão (`cell_links_or_none`, `sp_day_start`) ainda precisa entrar na seção "Fora do portão" do spec do E2.03 (tarefa 13). Próximos: PR 2 (componentes de filtro, move o `FilterChips` da Auditoria: fazer **depois** do PR 3/4 do E2.05, que reescreve a `Events.tsx`), PR 3 (Membros com filtros) e PR 4 (Novo membro e cache, independente).

> **Andamento (2026-11-26):** PR 1 (tarefas 2 a 4) na branch `feat/E2.07-pr1-banco`, migrations `20261128100000_e207_01_cell_link` e `20261128100100_e207_02_member_list`. Feito pelo `architect` sozinho (sessão sem a ferramenta `Agent`): sem `code-reviewer` nem QA independentes. A tarefa 1 (conferência em produção) fica com o usuário, antes do "Deploy: banco": o SQL está no relatório do PR; os nomes foram confirmados nas migrations do repositório (alias `hr`, e não `h`; nenhum índice de `created_at` antes; `sp_instant` como ajudante de data).
> Diferenças do desenho, revisar no PR:
> - `cell_links_or_none` é `plpgsql` e sem `SET search_path` (corpo só com `pg_catalog` e o tipo qualificado, como a DT-14 do E2.09): em `sql`, não inlinável, custava cerca de 2,5 µs por linha e deixava o Dashboard +55 ms acima de antes; assim fica +18 ms (Administrador, volume de referência).
> - `sp_day_start` usa `sp_instant` (o fuso num lugar só, E2.09).
> - As duas RPCs começam com `PERFORM viewer_member_id()`: o portão do E2.03 vale mesmo quando nenhuma linha seria lida (o `e203_06_gate` exige recusa, nunca vazio).
> - O normalizador prende as datas entre os anos 1 e 9999 (fora disso o `timestamp` estoura), sem mudar o resultado.
> - A pós-condição da migration 1 compara dono, opções e privilégios com os capturados antes do `DROP`; a segunda execução não faz `DROP` (a `members_list` depende do tipo da view).
> - `cell_links_or_none` e `sp_day_start` entraram na lista fechada do `e203_06_gate` (funções puras: o próprio argumento e o relógio). Falta registrar isso no spec do E2.03 ("Fora do portão"), na tarefa 13.
> - O `e206_01_structure_grants` passou a aceitar `members_list` e `member_filter_sql` na lista das funções que citam `g12_level` (leem a `members_view`).

## Testes
_Seção do `qa`._ PR 1 (banco), escrito e rodado pelo `architect` (sem QA independente). Arquivos em `mci-connect/supabase/tests/`: `database/e207_01_structure_grants` (EG, 47), `database/e207_02_list` (LI, 117), `volume/e207_volume.psql` (VOL) e `concurrency/e207_migrations.sh` (MIG). LI usa a massa do Negócio (19 pessoas, 5 células), isola a base dentro da transação e roda os cenários que gravam num bloco desfeito (`pg_temp.scn`); as datas são relativas a `sp_today()`.

| RN | Testes | Resultado |
|---|---|---|
| RN-01, RN-03 | LI: total sem filtros; Diego e Samuel (nível); Hugo (no máximo ele); Sara excluída fora da lista e do total; paridade com a `members_view` (páginas de 4 em 4 e total) para Rita, Samuel, Pedro, André, Diego, Ester e Hugo | ✅ |
| RN-02 | LI: os três critérios de combinação; VOL: a combinação em 10 ms (página) e 6 ms (total) | ✅ (banco) |
| RN-04, RN-05, DA-2 | LI: os seis critérios de Rita; 12 ids com repetido e nulo valem os 10 primeiros; Pedro com Tiago (não visível), Sara (excluída) e um id inexistente, sozinhos e com André; Liderança vazia ou só nulos = sem filtro; EG/LI: a resposta é o tipo da view, sem coluna de cadeia | ✅ |
| RN-06 | LI: acentos, maiúsculas e espaços; `%`, `_`, `\`, aspas simples e duplas; sem bairro; Pedro acha Caio pelo bairro; cidade; EG: 100 caracteres, só espaços, tabulação | ✅ |
| RN-07, RN-08, RN-09 | LI: todos os critérios; DA-8 (as três situações, os seis níveis); Jonas em 144 logo depois da troca de líder | ✅ |
| RN-10 | LI: a tabela da massa (C4 inativa, C5 excluída); as cinco opções (DA-8); casal Pedro e Paula; hoje − 30 entra e hoje − 31 não; "Não houve célula", relatório excluído, célula excluída, inativo, relatório que Pedro não vê; reativar C4; C3 inativa e Magda; EG: `cell_links_or_none`. A virada da meia-noite é coberta pelo limite relativo a `sp_today()` | ✅ |
| RN-11, RN-17 | LI: cada card = o total da lista com o equivalente, para Rita, Pedro, Diego, Ester e Samuel; os números do critério (19, 18, 1, 1 e 5; Pedro 3; Diego 0); com relatórios, igual; "Novos membros" de 22/11 a 28/11 | ✅ |
| RN-12, DA-4 | LI: 23:30 de Brasília em 21/11, 00:10 de 22/11, sem data, só "a partir de", só "até", os dois dias, invertidas, futura; EG: `sp_day_start` | ✅ |
| RN-13 | LI: Pedro não acha Caio por CPF nem e-mail, nem filtrando a resposta por CPF, e-mail, celular, rua ou CEP; acha o próprio CPF; Rita acha | ✅ |
| RN-15, DA-5 | LI: a ordem da massa; com Situação: Ativo, a mesma ordem; 60 homônimos de 25 em 25 (79 linhas, cada um uma vez, desempate pelo id, mesma ordem relativa com filtro) | ✅ |
| DA-1, risco 1 | EG: busca (5 padrões), bairro (100), níveis, `_limit`, `_offset`; 22P02 para enum e uuid inválidos; texto malicioso não entra no WHERE; LI: textos maliciosos sem erro e sem efeito | ✅ |
| Estrutura | EG: enums; `members_view` (colunas no fim, sem as quatro, opções, dono, privilégios, mesmo WHERE); RPCs *definer* com `search_path` e EXECUTE só para `authenticated`; internas sem EXECUTE; nenhuma função cita as colunas que saíram; índice parcial | ✅ |
| Migrations | MIG: reexecução sem mudar nada; a partir da `members_view` do E2.05; a guarda sem o E2.06; o `DROP` com dependente; o privilégio diferente. `supabase db reset` limpo | ✅ |
| Volume | VOL (20 mil membros, 1.500 células, 100 mil relatórios, 1 milhão de participantes), Administrador: sem filtros 57/5 ms (página/total); só "Sem vínculo" 129/97; só "Participante" 114/98; Liderança com o pastor 61/9 e com um G12 de 2 mil 21/8; combinação 10/6. G12 (2 mil): sem filtros 26/10. `dashboard_summary`: 182 → 201 ms (Administrador), 102 → 107 ms (G12). Planos: etapa 2 por `members_pkey`; sem filtro de vínculo, sem os `EXISTS`; com ele, tabelas *hash*; Liderança por semi-join com `member_hierarchy` | ✅ |
| Testes adaptados | `e108_pr3_dashboard_rpcs` (André e Ana saem de "sem vínculo": célula ativa abaixo; 4 → 2), `e201_04_cells_reports`, `e203_01`, `e203_03`, `e205_01` (as duas colunas novas no fim), `e203_06_gate` (lista fechada), `e206_01` (lista das funções que citam `g12_level`) | ✅ |
| Regressão | pgTAP inteiro: 56 arquivos, 4.883 testes, verde (136 s). Vitest 2.187 de 2.188 (a falha, `password-policy-cases-sync`, já está na `main`: o SQL do `e203_02_policy` foi editado à mão no PR #50 sem o gerador). tsc e build ok; lint sem erro nos arquivos do PR. Playwright inteiro (`--workers=1`, pista B): 390 passaram, 8 pulados, 3 falharam sem relação com o PR (que não muda tela): `celulas-relatorios-escopo` UX-24 instável (passa sozinho); `excluidos-membros` UX-19 depende de mais de 10 registros com "a" na base (falha com a base zerada); axe do login no tema claro (contraste dos tokens, Problemas conhecidos). Concorrência: nenhum cenário novo (só leitura) | ✅ |
