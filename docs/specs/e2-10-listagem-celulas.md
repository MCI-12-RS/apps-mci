# E2.10: Listagem de células com filtros e detalhe com os últimos relatórios

> Status: Negócio, Experiência (UX), Solução técnica e Tarefas prontos.
> - Negócio escrito em 2026-11-24 pelo `product-owner`, sem regras "a confirmar".
> - Experiência (UX) escrita no mesmo dia pelo `ux-designer`. As pendências PO-UX-1 a PO-UX-12 foram resolvidas pelo PO no mesmo dia e viraram os padrões P-LCE-22 a P-LCE-33.
> - A situação do relatório segue os valores e os rótulos do E2.09 (`docs/specs/e2-09-situacao-relatorio.md`, com Negócio e UX prontos, ainda sem commit).
> - Ficam para o usuário revisar no PR os padrões P-LCE-01 a P-LCE-33 e as perguntas Q-1 a Q-7. Nenhuma bloqueia: cada uma já tem um padrão adotado, e a T17 da UX mostra a tela em cada resposta. A Q-3 foi respondida pelo E2.09.
> - As perguntas AQ-1 a AQ-12 do `architect` estão respondidas na Solução técnica.
> - Depende do E2.01, do E2.02, do E2.05, do E2.06, do E2.07 (PRs 1 e 2), do E2.08 e do E2.09.
> - Solução técnica e Tarefas escritas em 2026-11-24 pelo `architect`, só como desenho. Ficam para o usuário revisar no PR também as definições DA-1 a DA-12. Falta Testes.
> Slug: `e2-10-listagem-celulas` · Paridade com o legado: sim (CEL-06 e CEL-07). Regras novas:
> - filtro de situação (ativa ou inativa);
> - filtros de múltipla escolha e pessoa indisponível;
> - G12 da célula pela regra do E2.06, que inclui a célula do próprio G12;
> - textos sem acento;
> - detalhe em tela própria, com a situação do relatório;
> - na lista, o equivalente de cada card de células do Dashboard.

## Negócio
_Seção do `product-owner`. Escrita em 2026-11-24 e atualizada no mesmo dia com as decisões do PO sobre as pendências PO-UX-1 a PO-UX-12 da seção Experiência (UX) (P-LCE-22 a P-LCE-33) e com os valores do E2.09. Fontes:_
- _no [`docs/migracao.md`](../migracao.md): a linha do E2.10 na seção Progresso, as regras CEL-05 a CEL-08 (3.4), DSH-02, DSH-03 e DSH-05 (3.6) e a decisão D2;_
- _no `CLAUDE.md` da raiz: os filtros e a tela de células do legado, a matriz de paridade e as Armadilhas;_
- _no legado:_
  - _`Domain/Querying/Filters/CellFilter.cs`, `Domain/Extensions/QueryingExtensions.cs` (filtros de células) e `Infra/Repositories/CellRepository.cs`;_
  - _`API/Controllers/CellController.cs` e `App/Services/DashboardService.cs`;_
  - _`UI/AppRoutes.js`, `UI/pages/Cells/index.js`, `UI/pages/Cells/details.js`, `UI/pages/Report/index.js` e `UI/pages/Home/index.js`;_
- _no novo (`mci-connect`, `origin/main`, `4595daa`):_
  - _`src/pages/Cells.tsx`, `src/pages/CellReports.tsx`, `src/hooks/use-cells-list.ts`, `src/lib/cells/fields.ts` e `src/lib/cells/labels.ts`;_
  - _a `cells_view` (`supabase/migrations/20261123233300_e201_03_read.sql`);_
  - _as RPCs do Dashboard (`20261123120000_e108_dashboard_rpcs.sql`);_
- _nos specs:_
  - _[E1.08](e1-08-paginacao-servidor.md): RN-01, RN-03, RN-04, RN-06, RN-07, RN-08 e Pontos de extensão;_
  - _[E2.01](e2-01-exclusao-logica.md): RN-04, RN-08, RN-09, RN-11, RN-12, RN-13 e UXD-1;_
  - _[E2.02](e2-02-perfis-escopo.md): RN-02, RN-03, RN-04, RN-08, RN-09, RN-13, RN-14, RN-22 e RN-23;_
  - _[E2.05](e2-05-auditoria-autor.md): RN-07, RN-10 (d) e DT-03;_
  - _[E2.06](e2-06-hierarquia-totais.md): RN-01, RN-02, RN-04, RN-06, RN-08, RN-11, P-HIE-23 e "Definições para os passos seguintes";_
  - _[E2.08](e2-08-cadastro-celulas.md): RN-04, RN-05, RN-07, RN-08, RN-09, RN-11, RN-12, P-CEL-14, P-CEL-18, P-CEL-22 e Impactos;_
  - _o rascunho do [E2.07](e2-07-filtros-membros.md): RN-02 a RN-06, RN-12, RN-14, RN-17 e Impactos. Ainda não tem commit e foi só lido;_
  - _o [E2.09](e2-09-situacao-relatorio.md): Termos, RN-01 a RN-09, P-SIT-02, P-SIT-06, P-SIT-12, P-SIT-13, Fora de escopo, Impactos e os padrões P70 a P73 da UX. Ainda não tem commit e foi só lido._

Os caminhos do legado são relativos a `g12app-net/`, com as abreviações do E2.01:
- `App/` = `G12App.Application/`;
- `Domain/` = `G12App.Domain/`;
- `Infra/` = `G12App.Infrastructure.Data/`;
- `API/` = `G12App.API/`;
- `UI/` = `G12App.API/ClientApp/src/`.

### Contexto e objetivo
No legado, a lista de Células tem um painel "Filtros" com:
- Líder e G12 (parte do nome);
- Logradouro, Bairro e Cidade (parte do texto);
- Modalidade (Todas, Evangelística, Discipuladora e Macrocélula);
- Dia da semana (um dia);
- Situação de Relatório: Indiferente, Relatório em dia, Ainda não ocorreu esta semana, Pendente/Atrasado esta semana, e Sem relatório há 1, 2, 3 ou 4 semanas ou mais;
- "Cadastrada a partir de" e "Cadastrada até";
- o link "Limpar filtros".

Os filtros se somam. A lista mostra o líder com o nível, o G12, o endereço, a modalidade, o dia e o horário. Cada linha tem dois atalhos: "Dados da célula" e "Ver relatórios". Quatro cards do Dashboard abrem essa lista já filtrada: "Células com relatórios pendentes", "Novas células cadastradas", "Células evangelísticas" e "Células discipuladoras".

O detalhe da célula (`/cells/<id>`) é uma tela própria, que também serve de formulário de edição. Abaixo do formulário ficam:
- **"Últimos relatórios enviados":** até 10 relatórios, do mais recente para o mais antigo. Cada um mostra a data e a hora, o tema ou "Não houve célula.", as observações, a oferta e os números de participantes e de visitantes. Ao lado de cada número, uma seta o compara com o do relatório anterior. O administrador pode excluir o relatório ali mesmo.
- **"Linha de evolução":** um gráfico de participantes e visitantes desses relatórios.

"Ver relatórios" abre a lista de Relatórios só com os relatórios da célula, sem período. A API também tem uma consulta dos 3 últimos relatórios por data de cadastro (`CellController.GetLastReportsByCellId`), que a tela não usa. É dela que vem o número 3 da CEL-07.

Hoje o novo (conferido na `origin/main` do `mci-connect`, `4595daa`, em 2026-11-24):
- A lista de Células tem só a busca, paginada no servidor e com o estado na URL (E1.08). A busca procura nos nomes do líder, do timóteo, do anfitrião e dos líderes deles, na rua e no bairro. A ordem vai da célula cadastrada mais recentemente para a mais antiga.
- Cada linha mostra o líder, o timóteo, o anfitrião, o G12, o endereço, o tipo, o dia e o horário e a situação (Ativa ou Inativa). As ações são "Novo relatório", "Editar" e "Excluir".
- Não existe detalhe da célula. A edição acontece num diálogo, e não há como ver os relatórios de uma célula, a não ser buscando o nome do líder em Relatórios.
- A `cells_view` já tem a data do último relatório (`last_report_date`), que ficou para o E2.09.
- Os cards de células do Dashboard não abrem a lista.

Objetivo do passo:
- dar à lista de Células os filtros do legado e a situação (ativa ou inativa), no escopo de cada pessoa;
- criar o detalhe da célula: dados, pessoas, situação do relatório, últimos relatórios, evolução e o caminho para a lista completa;
- deixar cada card de células do Dashboard com um equivalente exato na lista, para que o E2.14 só precise ligar o clique.

### Termos
- **Filtro:** uma condição da lista de Células, além da busca.
- **Filtro vazio:** sem nenhuma opção escolhida e sem texto. Não restringe nada.
- **Filtro de múltipla escolha:** aceita uma ou mais opções. Basta valer uma delas (RN-02).
- **Célula visível:** a célula não excluída que a pessoa vê, conforme o E2.02 (RN-02 e RN-03 de lá). A célula está no escopo pelo líder, pelo timóteo ou pelo anfitrião. Toda pessoa vê também as células em que é uma dessas três pessoas.
- **Relatório visível:** o relatório não excluído que a pessoa vê (RN-04 do E2.02). Até o E2.11, a visibilidade segue as pessoas atuais da célula. Depois dele, segue o líder, o timóteo e o anfitrião registrados no lançamento (REL-09).
- **Pessoas da célula:** o líder, o timóteo e o anfitrião.
- **G12 da célula:** o G12 do líder, conforme a RN-11 do E2.06:
  - quando o líder é G12, é ele mesmo;
  - na célula de pastor, aparece "Pastores";
  - na célula de quem está sem liderança, aparece "—".
- **Nome de referência:** o nome de uma pessoa que aparece numa linha visível mesmo quando ela está fora do escopo de quem consulta. Aparece só o nome, sem acesso ao cadastro (RN-06 do E1.08).
- **Situação:** se a célula está ativa ou inativa (RN-11 do E2.08). A célula excluída não é inativa.
- **Situação do relatório:** a situação da CEL-05, calculada pelo E2.09 (Termos e RN-04 e RN-05 de lá). São duas informações sobre cada célula ativa:
  - a **situação da semana:** Enviado (com o detalhe "Célula realizada" ou "Não houve célula"), Ainda não ocorreu, Pendente ou Conta a partir da próxima semana;
  - as **semanas anteriores sem relatório:** 1, 2, 3 ou 4 ou mais. O zero não aparece.

  A célula inativa e a célula sem dia da reunião ("Sem dia da reunião", RN-07 do E2.09) não têm situação do relatório.
- **Data de cadastro:** a data em que a célula foi cadastrada, definida pelo servidor (RN-03 do E2.05). As células antigas do legado sem essa informação aparecem com "data não registrada" (RN-10 d do E2.05).
- **Detalhe da célula:** a tela de uma célula, com os dados, as pessoas, as situações e os relatórios dela.
- **Hoje, datas e horas:** sempre no horário de Brasília (`America/Sao_Paulo`). A semana vai de domingo a sábado.

### Personas e permissões
Este passo não cria permissão. Os filtros aparecem para quem tem a lista de Células, ou seja, "Visualizar Toda a Igreja" ou "Visualizar Seu Ministério" (RN-22 do E2.02). O detalhe abre para quem vê a célula (RN-14). As pessoas são as da [massa de exemplo](#massa-de-exemplo).

| Persona | Quem é (na massa) | Permissões relevantes | O que exercita |
|---|---|---|---|
| IG Igreja toda | Rita, função Administrador | "Visualizar Toda a Igreja", "Ver Dados Sensíveis", "Editar Célula", "Excluir Célula", "Editar Relatórios de Células" e "Excluir Relatórios de Células" | todos os filtros sobre a igreja toda e o detalhe de qualquer célula |
| PA Pastor | Samuel, função Líder | "Visualizar Seu Ministério" | a árvore inteira, menos a célula de quem está sem liderança; célula de pastor |
| G12 | Pedro, função Líder | "Visualizar Seu Ministério", "Criar Célula", "Editar Célula", "Excluir Célula", "Enviar Relatório das Próprias Células", "Editar Relatórios de Células" e "Excluir Relatórios de Células", sem "Ver Dados Sensíveis" | filtros no escopo, pessoa indisponível e ações no detalhe |
| LE Líder casado | André, função Líder | as mesmas de Pedro | célula vista pelo ministério da cônjuge |
| OM Outro ministério | Diego, função Líder | as mesmas de Pedro | o que fica fora do escopo; célula de pastor vista por meio do timóteo |
| PC Pessoa da célula | Caio, função Membro | "Visualizar Seu Ministério" e "Enviar Relatório das Próprias Células" | detalhe sem editar; lançamento a partir do detalhe |
| SL Sem liderança | Ester, função Membro | "Visualizar Seu Ministério" | célula de quem está sem liderança |
| SF Sem função | Hugo | nenhuma | só a própria célula, pelo link ou pela API |
| SR Só relatórios | Lia, função Secretaria | só "Visualizar Relatórios de Toda a Igreja" | sem Células; "Ver todos os relatórios" pelo link |

### Histórias
- Como líder, quero filtrar as células do meu ministério por G12, líder, tipo, dia e situação do relatório, para saber quais estão em dia.
- Como liderança, quero encontrar as células com relatório pendente, para cobrar os líderes ainda nesta semana.
- Como secretaria, quero filtrar as células por rua, bairro e cidade, para indicar uma célula perto de quem chegou à igreja.
- Como líder, quero abrir uma célula e ver os dados, as pessoas, a situação e os últimos relatórios dela, para acompanhar como ela está crescendo.
- Como líder, quero ir dos últimos relatórios para a lista completa da célula.
- Como liderança, quero abrir pelo Dashboard a lista exata das células por trás de cada número, para agir sobre elas.

### Decisões

#### Decisões do usuário e de passos anteriores
| Decisão | O que vale aqui | Onde |
|---|---|---|
| RN-01, RN-03, RN-04 e RN-06 do E1.08 | Paginação e total no servidor, estado na URL, ordem das células, busca e nomes de referência. | RN-02, RN-12, RN-13, RN-15 |
| RN-08 (d) do E1.08 (D-3) | As pendências consideram qualquer relatório da célula na semana, visível ou não. | RN-10 |
| RN-08, RN-11, RN-12 e RN-13 do E2.01 | Excluídos não aparecem nem contam, e o link direto mostra "não encontrado". Os relatórios de uma célula excluída continuam na lista de Relatórios. Excluir um relatório devolve a pendência. O participante excluído conta no número. | RN-03, RN-10, RN-14, RN-17, RN-18, RN-19 |
| RN-02, RN-03, RN-04, RN-09 (a) e RN-23 do E2.02 | Escopo de células e de relatórios. O que não é visível é tratado como inexistente. Ninguém descobre a cadeia de liderança de quem não vê. | RN-03, RN-06, RN-14, RN-17 |
| RN-13, RN-14 e RN-22 do E2.02 | Quem lança, edita e exclui relatórios; o menu de Células. | RN-01, RN-16, RN-17 |
| RN-07, RN-10 (d) e DT-03 do E2.05 | A autoria aparece no detalhe da célula. A "data não registrada" fica fora dos filtros por período e vai por último na ordem por cadastro. | RN-11, RN-13, RN-15 |
| RN-02, RN-04 e RN-11 do E2.06 | Rótulos do nível. O G12 da célula é um nome só, "Pastores" ou "—". As "Definições" deixaram o filtro de células para este passo. | RN-05, RN-15 |
| RN-09, RN-11, P-CEL-14, P-CEL-18, P-CEL-22 e Impactos do E2.08 | O endereço da célula não é sensível. A célula inativa não tem situação do relatório e não recebe relatório novo. Dias na ordem do legado, "(inativo)" só para quem se vê e ícone de pausa. O E2.08 recomendou o filtro "Situação". | RN-07, RN-08, RN-09, RN-10, RN-15, RN-16 |
| RN-02 a RN-06, RN-12 e RN-14 do E2.07, e o item "E2.10 e E2.12" dos Impactos de lá | Os mesmos padrões de filtro da lista de Membros. | RN-02 a RN-07, RN-11, RN-12 |
| CEL-05 (3.4 do `docs/migracao.md`), RN-01 a RN-09, P-SIT-02, P-SIT-06 e P-SIT-12 do E2.09, e P70 a P73 da UX de lá | Os valores e os rótulos da situação do relatório: a situação da semana, com um valor só, e as semanas anteriores sem relatório, à parte. A situação já aparece em cada célula da lista de Células, com legenda, pelo E2.09. O detalhe usa os mesmos componentes da lista. | RN-10, RN-15, RN-21 |

#### Padrões definidos por este spec (revisar no PR)
As fontes não respondem estes pontos. O PO adotou a opção mais conservadora e coerente com o legado e com os specs anteriores. Nas regras, eles aparecem como "definida pelo spec", e o usuário pode mudar qualquer um na revisão do PR.

- **P-LCE-01, múltipla escolha** (RN-02, RN-04, RN-05, RN-08, RN-10).
  - Líder, G12, Tipo, Dia da semana e Situação do relatório aceitam várias opções, e basta valer uma.
  - Situação é de escolha única: Todas, Ativa ou Inativa.
  - No legado, todos os filtros eram de escolha única. Escolher uma opção só dá o mesmo resultado de antes.
- **P-LCE-02, Líder e G12 por seletor** (RN-04, RN-05).
  - A pessoa é escolhida num seletor, e não digitada, para não trazer homônimos, como na Liderança do E2.07 (P-FIL-02).
  - As opções vêm das células visíveis: quem lidera ou quem é o G12 de pelo menos uma delas. Assim, entram também os nomes de referência que a lista já mostra. É o que o filtro por nome do legado alcançava.
  - Aceita até 10 pessoas. De um link ou da API, valem as 10 primeiras (P-FIL-17 do E2.07).
- **P-LCE-03, G12 por pessoa** (RN-05).
  - O G12 é sempre um nome só, como na coluna (P-HIE-23 do E2.06). Para o ministério do casal, escolhem-se os dois, como na Q-4 do E2.07.
  - A célula liderada pelo próprio G12 entra, pela RN-11 do E2.06. No legado, ela ficava de fora, porque o G12 calculado de um G12 é vazio.
  - Não há opção "Pastores" nem "—". As células de pastor e de quem está sem liderança são encontradas pelo Líder.
- **P-LCE-04, pessoa indisponível** (RN-06). Segue a P-FIL-03 e a P-FIL-18 do E2.07. A pessoa vinda da URL aparece pelo nome quando quem consulta a vê ou quando ela já é nome de referência numa célula visível.
- **P-LCE-05, "Rua" e texto sem acento** (RN-07).
  - O filtro se chama "Rua", como o campo do formulário de célula (E2.08), e não "Logradouro".
  - "Contém o texto", sem diferenciar maiúsculas e acentos, como no E2.07 (P-FIL-04).
- **P-LCE-06, filtro "Situação" com "Todas" como padrão** (RN-09).
  - O filtro segue a recomendação do E2.08. O legado não tinha célula inativa.
  - O padrão "Todas" mantém a lista de hoje (ver Q-4).
- **P-LCE-07, situação do relatório** (RN-10, RN-15).
  - As opções e os rótulos são os do E2.09, com múltipla escolha (detalhado na P-LCE-22).
  - A situação aparece também no detalhe, igual à da lista de Células do E2.09. O legado só a usava no filtro e no Dashboard.
- **P-LCE-08, datas de cadastro** (RN-11). As mesmas regras da lista de Membros (P-FIL-11 e P-FIL-23 do E2.07), com o rótulo no feminino: "Cadastrada".
- **P-LCE-09, URL, contagem e chips** (RN-12). As mesmas regras da lista de Membros (P-FIL-12 e P-FIL-18 a P-FIL-20 do E2.07), com até 10 filtros.
- **P-LCE-10, ordem** (RN-13).
  - Continua a do E1.08: a célula cadastrada mais recentemente primeiro, e as com "data não registrada" por último. O legado não definia ordem.
  - A lista não é ordenada pela situação do relatório, decisão que o E2.09 deixou para este passo (ver Q-6).
- **P-LCE-11, detalhe em tela própria** (RN-14).
  - O detalhe é uma tela com endereço próprio, como no legado, e não um diálogo. Assim ele pode ser aberto por link, recarregado e compartilhado.
  - A edição continua no diálogo de hoje, aberto a partir do detalhe.
- **P-LCE-12, três relatórios** (RN-17).
  - O detalhe mostra 3 relatórios, como o plano (CEL-07) e a consulta da API do legado, com "Ver todos os relatórios".
  - A tela do legado mostrava até 10 (ver Q-1).
- **P-LCE-13, só os números** (RN-18).
  - O detalhe mostra os números de participantes e de visitantes, e não os nomes, como no legado.
  - Os nomes continuam onde estão hoje.
- **P-LCE-14, comparação com o relatório anterior** (RN-17).
  - A seta do legado volta.
  - A comparação é feita com o relatório visível de célula realizada imediatamente anterior, e não com o relatório anterior da lista. Assim, um "Não houve célula" no meio não vira uma queda para zero.
- **P-LCE-15, evolução** (RN-20).
  - A "Linha de evolução" do legado volta, com até 10 relatórios.
  - No relatório de "Não houve célula", o ponto fica sem valor. Ele não conta como zero, coerente com a P-FIL-08 do E2.07.
- **P-LCE-16, "Ver todos os relatórios"** (RN-19).
  - O link abre a lista de Relatórios com o filtro "Célula", criado neste passo pela URL, como a rota `/cells/:cellId/reports` do legado.
  - O E2.12 integra esse filtro ao painel dele.
- **P-LCE-17, célula indisponível** (RN-19).
  - O chip identifica a célula quando quem consulta vê a célula ou algum relatório dela. Assim, quem só vê relatórios e os relatórios de uma célula excluída também funcionam.
  - Nos outros casos, o chip mostra "Célula indisponível".
- **P-LCE-18, ações no detalhe** (RN-16, RN-17).
  - O detalhe tem as mesmas ações da linha da lista de Células e da lista de Relatórios, com as mesmas regras.
  - O legado permitia excluir o relatório e salvar a célula na própria tela.
- **P-LCE-19, "(inativo)" no detalhe** (RN-15). A marca só aparece para quem vê a pessoa, como no formulário de célula (P-CEL-18 do E2.08).
- **P-LCE-20, tempo e momento de aplicar** (RN-02, RN-14).
  - No volume de referência, a primeira página e o total aparecem em até 2 s, e o detalhe também.
  - O momento em que o filtro passa a valer é o mesmo da lista de Membros (P-FIL-21 do E2.07).
- **P-LCE-21, equivalentes dos cards** (RN-21).
  - Cada card de células do Dashboard tem um equivalente na lista, como na RN-17 do E2.07.
  - O ranking "Células por G12" também tem equivalente, para o caso de o E2.14 ligar o clique nele.
- **Vindos do desenho de UX (2026-11-24, PO-UX-1 a PO-UX-12 em "Experiência (UX)"):**
  - **P-LCE-22, opções da Situação do relatório** (PO-UX-1, RN-10, RN-21).
    - As opções são os valores do E2.09, com os mesmos nomes que a lista e o detalhe mostram, em dois subgrupos:
      - "Nesta semana": Enviado, Ainda não ocorreu, Pendente e Conta a partir da próxima semana;
      - "Sem relatório nas semanas anteriores": na semana passada, nas 2, nas 3 e nas 4 ou mais semanas anteriores.
    - **"Enviado" é uma opção só**, que traz as células com "Célula realizada" e as com "Não houve célula". Três motivos:
      - nas duas, o relatório da semana chegou, e a célula não está pendente;
      - o E2.09 dá a elas a mesma aparência (P-SIT-13);
      - ver quem deixou de se reunir é a Q-2 do E2.09, e os relatórios de "Não houve célula" já aparecem na lista de Relatórios (E2.12).
    - As opções do legado, que se sobrepõem ("Relatório em dia" e "Pendente/Atrasado esta semana"), não voltam, porque o líder não as encontraria na tela. O "Relatório em dia" do legado equivale a escolher Enviado, Ainda não ocorreu e Conta a partir da próxima semana.
    - Dentro do filtro, basta valer uma opção, também entre os subgrupos, como em todo filtro de múltipla escolha (RN-02). Cada célula mostra as duas informações, e isso basta para ver quem está pendente há mais de uma semana.
    - "Sem dia da reunião" não é opção: a célula sem dia não tem situação.
  - **P-LCE-23, arrumação do detalhe** (PO-UX-2, RN-15).
    - A reunião (dia, horário e tipo) vira o complemento do título, e a situação da célula fica ao lado dele.
    - O G12 vira a última linha de "Pessoas da célula".
    - Nada deixa de aparecer: muda só o agrupamento.
  - **P-LCE-24, "Ir para o início" para quem não tem a lista de Células** (PO-UX-3, RN-14). Hugo e Lia abrem o detalhe, ou a "Célula não encontrada", por link. "Voltar para Células" os levaria a uma tela sem acesso.
  - **P-LCE-25, "Nenhum relatório para mostrar."** (PO-UX-4, RN-17).
    - O detalhe sem relatório visível usa a sugestão da UX, e não "Nenhum relatório enviado.".
    - O motivo: depois do E2.11, a situação pode dizer "Enviado" por um relatório que quem abre não vê, e o texto antigo contradiria a situação. O texto novo não afirma nada sobre o que foi enviado e é o mesmo em todos os casos, então também não revela que existe um relatório invisível.
  - **P-LCE-26, nível nas opções do Líder** (PO-UX-5, RN-04).
    - As opções do Líder mostram o nome com o nível, como a linha da célula ("André (144)"). No G12, só o nome, porque todos são G12.
    - A busca sem resultado diz "Nenhum líder de célula encontrado." ou "Nenhum G12 encontrado.".
    - O nível não revela nada além do que a lista já mostra.
  - **P-LCE-27, como a lista leva ao detalhe** (PO-UX-6, RN-14).
    - Até 1023 px, o cartão inteiro abre o detalhe. Na tabela, abre o nome do líder.
    - Os atalhos "Dados da célula" e "Ver relatórios" do legado não voltam em cada linha. "Ver todos os relatórios" fica no detalhe.
  - **P-LCE-28, ações da célula no detalhe** (PO-UX-7, RN-16).
    - As ações se chamam "Editar célula" e "Excluir célula", porque a mesma tela tem o "Editar" e o "Excluir" de cada relatório.
    - No celular, "Novo relatório" fica num rodapé fixo, sempre à mão.
  - **P-LCE-29, comparação neutra** (PO-UX-8, RN-17).
    - As setas não têm o verde e o vermelho do legado, e "igual" é o sinal "=".
    - O sentido nunca depende da cor.
    - Uma frase explica: "As setas comparam com o relatório anterior de célula realizada.".
  - **P-LCE-30, evolução em linhas, com tabela** (PO-UX-9, RN-20).
    - É um gráfico de linhas, como no legado, com as abas "Gráfico" (padrão) e "Tabela", na mesma ordem cronológica.
    - "Não houve célula" é um intervalo nas linhas, marcado com "×" e explicado na legenda.
  - **P-LCE-31, oferta sem valor** (PO-UX-10, RN-17).
    - O relatório sem valor de oferta registrado mostra "Oferta: Não informada", e não "R$ 0,00", que afirmaria uma oferta de zero.
    - A oferta de zero registrada aparece como "R$ 0,00". Os relatórios do legado têm sempre um valor.
  - **P-LCE-32, título de Relatórios com o filtro Célula** (PO-UX-11, RN-19). O título da tela não muda: o chip diz de qual célula são os relatórios. O legado trocava o título para "Relatórios da célula".
  - **P-LCE-33, textos da UX** (PO-UX-12).
    - Todos foram aceitos, sem ajuste.
    - Os que estão ligados a uma regra foram copiados para os "Textos de tela" deste Negócio.
    - Os da T17 só valem se a pergunta correspondente for respondida com a alternativa.

### Regras de negócio
Nenhuma regra está "a confirmar".

Correspondência com o plano:
- CEL-06 → RN-01 a RN-13;
- CEL-07 → RN-14 a RN-20;
- preparação da DSH-05 → RN-21.

| ID | Regra | Origem |
|---|---|---|
| RN-01 | **Filtros da lista de Células.** Além da busca (RN-04 do E1.08), a lista tem estes filtros:<br>- Líder (RN-04) e G12 (RN-05);<br>- Rua, Bairro e Cidade (RN-07);<br>- Tipo e Dia da semana (RN-08);<br>- Situação (RN-09);<br>- Situação do relatório (RN-10);<br>- "Cadastrada a partir de" e "Cadastrada até" (RN-11).<br><br>Os filtros estão disponíveis para quem tem a lista de Células, sem permissão nova. Com todos os filtros vazios, a lista é a de hoje: as mesmas células e o mesmo total. | CEL-06; legado (`Domain/Querying/Filters/CellFilter.cs:8-24`; `UI/pages/Cells/index.js:138-229`); RN-22 do E2.02 (quem tem a lista); filtro Situação: recomendação do E2.08 (Impactos), definida pelo spec (P-LCE-06) |
| RN-02 | **Combinação.**<br>- Entre filtros diferentes, e com a busca, **todos** precisam valer (E).<br>- Num filtro de múltipla escolha (Líder, G12, Tipo, Dia da semana e Situação do relatório), basta valer **uma** das opções escolhidas (OU).<br>- Situação é de escolha única, com "Todas" como padrão.<br>- O total, a paginação e a ordem valem para o resultado filtrado, como no E1.08: total exato, nada cortado e nenhuma célula repetida ou pulada entre as páginas.<br>- **Quando o filtro vale:** como na lista de Membros (RN-02 do E2.07). No celular e no tablet, a mudança vale ao tocar em "Aplicar filtros", e tirar um chip vale na hora. No computador, cada mudança vale na hora. Toda mudança aplicada volta a lista para a página 1.<br>- No volume de referência (20 mil membros, 1.500 células e 100 mil relatórios), qualquer combinação mostra a primeira página e o total em até 2 s depois de aplicada. | legado (`Domain/Extensions/QueryingExtensions.cs:185-307`: cada filtro preenchido restringe a consulta); RN-01 a RN-03 do E1.08; múltipla escolha: definida pelo spec (P-LCE-01); momento de aplicar e tempo: definida pelo spec (P-LCE-20), como no E2.07 (P-FIL-15, P-FIL-21) |
| RN-03 | **Filtro só restringe.** O resultado é sempre a interseção entre as células visíveis para quem consulta (E2.02) e os filtros. Nenhum filtro, nenhuma combinação e nenhum valor vindo da URL ou da API mostra uma célula que a pessoa não vê, nem uma célula excluída (RN-08 do E2.01). Vale igual pela tela e pela API. | AUT-03; RN-02 e RN-03 do E2.02; RN-08 do E2.01; legado (`Infra/Repositories/CellRepository.cs:32-39`: só células não excluídas, filtro de ministério e depois os filtros da tela) |
| RN-04 | **Líder.**<br>- Quem consulta escolhe de 1 a 10 pessoas num seletor com busca.<br>- As opções são as pessoas que lideram pelo menos uma célula visível para quem consulta, ativa ou inativa. Entram também as pessoas que ela não vê como membro, porque o nome delas já aparece nas linhas da lista (RN-06 do E1.08).<br>- Cada opção mostra o nome com o nível, como a linha da célula ("André (144)"). A busca sem resultado diz "Nenhum líder de célula encontrado.".<br>- O resultado são as células lideradas por uma das pessoas escolhidas.<br>- Ser timóteo ou anfitrião não conta. Para esses papéis, a busca encontra pelo nome.<br>- O filtro não é "em qualquer nível": as células dos discípulos da pessoa escolhida não entram (ver Q-2).<br>- Uma 11ª pessoa não é aceita: "Escolha até 10 pessoas.".<br>- Quando um link ou a API traz mais de 10 pessoas, valem as 10 primeiras, na ordem em que vieram. As outras são descartadas, também da URL, e a tela mostra "Escolha até 10 pessoas.". | CEL-06 ("líder"); legado (`UI/pages/Cells/index.js:143-146`; `Domain/Extensions/QueryingExtensions.cs:193-194`: parte do nome do líder da célula); seletor, várias pessoas, opções e limite: definida pelo spec (P-LCE-02), como no E2.07 (P-FIL-02, P-FIL-17); nível nas opções e busca sem resultado: definida pelo spec (P-LCE-26, PO-UX-5) |
| RN-05 | **G12.**<br>- O G12 de uma célula é o da RN-11 do E2.06, pelo valor atual: o G12 do líder. Quando o líder é G12, é ele mesmo. A célula de pastor ("Pastores") e a de quem está sem liderança ("—") não têm G12.<br>- Quem consulta escolhe de 1 a 10 pessoas num seletor com busca.<br>- As opções são as pessoas que são o G12 de pelo menos uma célula visível para quem consulta, inclusive as que ela não vê como membro. Esses nomes já aparecem na lista como nomes de referência (RN-11 do E2.06). Cada opção mostra só o nome. A busca sem resultado diz "Nenhum G12 encontrado.".<br>- O resultado são as células cujo G12 é uma das pessoas escolhidas, inclusive as que a própria pessoa lidera.<br>- O G12 é por pessoa, nunca o casal: escolher Pedro não traz as células cujo G12 é Paula. Para o ministério do casal, escolhem-se os dois.<br>- As células de pastor e de quem está sem liderança nunca entram neste filtro. Para encontrá-las, usa-se o Líder.<br>- O limite é de 10 pessoas, como na RN-04, com as mesmas mensagens. | CEL-06 ("G12"); legado (`UI/pages/Cells/index.js:148-151`; `QueryingExtensions.cs:196-197`: parte do nome do G12 do líder, `ComputedG12Leader`); RN-04, RN-11 e P-HIE-23 do E2.06; célula do próprio G12: RN-11 do E2.06 (no legado, ela ficava de fora, porque o `ComputedG12Leader` de um G12 é vazio: `App/Services/MemberService.cs:224`); por pessoa e seletor: definida pelo spec (P-LCE-02, P-LCE-03); opção só com o nome e busca sem resultado: definida pelo spec (P-LCE-26, PO-UX-5) |
| RN-06 | **Pessoa indisponível (Líder e G12).** Vale quando a URL ou a API traz, no Líder ou no G12, um id com formato válido.<br>- **Com nome:** quando quem consulta vê essa pessoa, ou quando ela lidera alguma célula visível (no Líder) ou é o G12 de alguma célula visível (no G12), o filtro mostra o nome dela. O resultado pode ser vazio, por exemplo para quem não lidera nenhuma célula.<br>- **Sem nome:** nos outros casos (a pessoa não é visível e não aparece em nenhuma célula visível, foi excluída ou não existe), a escolha aparece como "Pessoa indisponível", sem o nome e sem o id, com a dica "Esta pessoa não está disponível para você.". Ela não traz nenhuma célula. Se houver outras pessoas escolhidas, valem só as outras. As três situações têm a mesma resposta, e a resposta do servidor também não traz o nome.<br>- Nos dois casos, a escolha fica na URL, conta como filtro ativo e pode ser tirada pelo chip.<br><br>Um id que nem tem o formato de id é valor inválido (RN-12).<br><br>Os filtros não revelam o G12, o líder nem a cadeia de liderança de quem quem consulta não vê, além dos nomes de referência que a lista já mostra. | RN-09 (a) e RN-23 do E2.02; RN-06 do E1.08; RN-11 do E2.06; como no E2.07 (RN-05, P-FIL-03, P-FIL-18); nome pela célula visível: definida pelo spec (P-LCE-04) |
| RN-07 | **Rua, bairro e cidade.**<br>- A célula entra quando a rua (ou o bairro, ou a cidade) do endereço da célula **contém** o texto digitado.<br>- Não diferencia maiúsculas nem acentos. Os espaços nas pontas são ignorados, e espaços seguidos contam como um só.<br>- Todo caractere conta como texto, inclusive `%`, `_`, vírgula e aspas.<br>- O limite é de 100 caracteres. Texto vazio não filtra.<br>- A célula sem rua (ou sem bairro, ou sem cidade) nunca entra quando o filtro correspondente está preenchido.<br>- O filtro olha o endereço da célula, e não o do anfitrião (RN-09 e RN-10 do E2.08).<br>- O endereço da célula não é dado sensível (RN-09 do E2.08). Por isso, o filtro alcança todas as células visíveis, para qualquer pessoa. | CEL-06 ("logradouro, bairro, cidade"); legado (`UI/pages/Cells/index.js:154-169`; `QueryingExtensions.cs:208-218`: contém, sem diferenciar maiúsculas); RN-09 e RN-10 do E2.08 (P-CEL-06); sem acento e caracteres como texto: definida pelo spec (P-LCE-05), como no E2.07 (RN-06) e na busca do E1.08 (RN-04); "Rua" no lugar de "Logradouro": definida pelo spec (P-LCE-05) |
| RN-08 | **Tipo e dia da semana.**<br>- **Tipo:** Evangelística, Discipulado e Macrocélula (RN-07 do E2.08), com múltipla escolha.<br>- **Dia da semana:** o dia da reunião, pelo valor atual da célula (RN-08 do E2.08), com múltipla escolha. As opções aparecem como no formulário de célula, nesta ordem: Segunda-feira, Terça-feira, Quarta-feira, Quinta-feira, Sexta-feira, Sábado e Domingo (P-CEL-14 do E2.08).<br>- O horário não é filtro, como no legado. | CEL-06 ("tipo, dia da semana"); legado (`UI/pages/Cells/index.js:171-194`; `QueryingExtensions.cs:205-206` e `:220-221`); RN-05, RN-07, RN-08 e P-CEL-14 do E2.08; múltipla escolha: definida pelo spec (P-LCE-01) |
| RN-09 | **Situação.** As opções são Todas (padrão), Ativa e Inativa, pela situação da célula (RN-11 do E2.08). Excluída não é inativa: a célula excluída não entra em nenhuma opção. | recomendação do E2.08 (Impactos: "incluir o filtro Situação"); RN-08 do E2.01; o legado não tem célula inativa (`Domain/Model/Cell.cs:8-23`); padrão "Todas": definida pelo spec (P-LCE-06), ver Q-4 |
| RN-10 | **Situação do relatório.** As opções são os valores do E2.09, com os mesmos nomes que a lista e o detalhe mostram, em dois subgrupos:<br>- **Nesta semana** (a situação da semana, RN-04 do E2.09):<br>  - **Enviado:** a célula tem relatório da semana, com "Célula realizada" ou com "Não houve célula". É uma opção só;<br>  - **Ainda não ocorreu;**<br>  - **Pendente;**<br>  - **Conta a partir da próxima semana.**<br>- **Sem relatório nas semanas anteriores** (a contagem da RN-05 do E2.09). Cada opção é o valor exato da contagem:<br>  - **Na semana passada** (1);<br>  - **Nas 2 semanas anteriores;**<br>  - **Nas 3 semanas anteriores;**<br>  - **Nas 4 ou mais semanas anteriores.**<br><br>Regras:<br>- A célula entra quando a situação da semana dela, ou a contagem de semanas anteriores, calculadas como no E2.09 no momento da consulta, corresponde a pelo menos uma das opções escolhidas. Vale também entre os subgrupos (RN-02). Por exemplo, "Pendente" e "Na semana passada" trazem as células de uma e as da outra.<br>- É a mesma situação que aparece em cada célula da lista (RN-09 do E2.09), no detalhe (RN-15 f) e no card "Células com relatório pendente" do Dashboard (RN-21).<br>- A célula sem situação do relatório nunca entra neste filtro: a inativa (RN-11 b do E2.08), a excluída e a sem dia da reunião (RN-07 do E2.09). "Sem dia da reunião" não é opção.<br>- A situação considera todos os relatórios não excluídos da célula, visíveis ou não para quem consulta (RN-03 do E2.09; RN-08 d do E1.08). O filtro revela só a situação, nunca qual é o relatório nem a data dele.<br>- A situação muda com o tempo (por exemplo, no prazo de 1 hora depois da reunião ou à meia-noite de domingo) e com os relatórios lançados, excluídos ou restaurados. A lista mostra o resultado do momento em que é carregada (P-SIT-08 do E2.09).<br>- O chip leva o texto inteiro: "Situação do relatório: Pendente", "Situação do relatório: Sem relatório na semana passada".<br><br>**Fronteira com o E2.09.**<br>- O E2.09 define os valores, os rótulos, o cálculo (semana, prazo de 1 hora, semanas que contam, célula sem relatório), a exibição na lista de Células com a legenda, e o card de pendentes.<br>- Este passo define o filtro e a exibição no detalhe, com os mesmos componentes da lista. Se o E2.09 mudar um valor ou um rótulo, o filtro e o detalhe acompanham, sem regra nova aqui. | CEL-06 ("situação do relatório"); CEL-05; legado (`UI/pages/Cells/index.js:196-212`; `QueryingExtensions.cs:233-304`); RN-03 a RN-07 e RN-09 do E2.09; RN-08 (d) do E1.08; RN-11 (b) do E2.08; RN-08 e RN-12 do E2.01 (os excluídos não contam, e excluir o relatório devolve a pendência); opções, subgrupos e "Enviado" numa opção só: definida pelo spec (P-LCE-07, P-LCE-22, PO-UX-1) |
| RN-11 | **Data de cadastro.** "Cadastrada a partir de" e "Cadastrada até", com as datas exibidas como dd/mm/aaaa e as mesmas regras da RN-12 do E2.07:<br>- a data de cadastro da célula é a data de Brasília do momento do cadastro: uma célula cadastrada às 23:30 de 21/11 é de 21/11, mesmo que já seja 22/11 em UTC;<br>- os dois dias informados entram no resultado;<br>- cada campo pode ser usado sozinho;<br>- datas futuras são aceitas;<br>- com qualquer um dos dois campos preenchido, as células com "data não registrada" (RN-10 d do E2.05) ficam de fora. Sem filtro de data, elas aparecem normalmente;<br>- com uma data inválida, ou com a data inicial depois da final, o filtro de data não é aplicado, e a tela mostra a mensagem embaixo do campo. A conferência é feita ao sair do campo e ao aplicar, nunca durante a digitação. | CEL-06 ("período de cadastro"); legado (`UI/pages/Cells/index.js:215-229`; `QueryingExtensions.cs:227-231`); RN-01, RN-03 e RN-10 (d) do E2.05; definida pelo spec (P-LCE-08), como no E2.07 (P-FIL-11, P-FIL-23) |
| RN-12 | **Filtros no endereço da página.** As mesmas regras da RN-14 do E2.07:<br>- os filtros ficam na URL, junto com a busca, a página e o tamanho da página. Recarregar, voltar no navegador ou abrir o link restaura a lista filtrada;<br>- outra pessoa que abre o mesmo link vê os mesmos filtros aplicados ao que **ela** vê (RN-03). Uma pessoa que ela não pode ver aparece como indisponível (RN-06);<br>- um valor desconhecido ou inválido na URL (opção que não existe, data que não existe, id sem formato de id) é ignorado: sai da URL, aquele filtro não é aplicado e não aparece como ativo;<br>- "Limpar filtros" esvazia todos os filtros e a busca, volta para a página 1 e mantém o tamanho da página. O link aparece sempre que há pelo menos um filtro ativo ou texto na busca;<br>- **Filtros ativos.** A tela mostra quantos filtros estão em uso, de 1 a 10. O Líder e o G12 contam 1 cada, com qualquer número de pessoas, inclusive a "Pessoa indisponível". As duas datas contam 1. "Situação: Todas", a busca e os valores inválidos não contam. Cada valor escolhido aparece como um chip, que tira só aquele valor. | RN-01 do E1.08 (estado na URL) e Pontos de extensão do E1.08 (o clique do Dashboard abre a lista pela URL); legado ("Limpar filtros": `UI/pages/Cells/index.js:138-140`; os cards abrem a lista filtrada: `UI/pages/Home/index.js:18-24` e `:54-60`); definida pelo spec (P-LCE-09), como no E2.07 (P-FIL-12, P-FIL-18 a P-FIL-20) |
| RN-13 | **Ordem.** Continua a da RN-03 do E1.08: da célula cadastrada mais recentemente para a mais antiga, com desempate estável, para que a paginação não repita nem pule nenhuma célula. As células com "data não registrada" vêm por último. Os filtros não mudam a ordem, e a lista não é ordenada pela situação do relatório. | RN-03 do E1.08; DT-03 do E2.05 (ordem por cadastro com as sem data por último); o legado não definia ordem (`Infra/Repositories/CellRepository.cs:65-76`: sem `ApplySort`); definida pelo spec (P-LCE-10), ver Q-6; sem ordem pela situação: decisão deixada para este passo pelo E2.09 (Fora de escopo de lá), definida pelo spec (P-LCE-10) |
| RN-14 | **Detalhe da célula: acesso.**<br>- O detalhe é uma tela própria, com endereço próprio. Pode ser aberto por link, recarregado e compartilhado, como no legado.<br>- Cada célula da lista dá acesso ao detalhe dela: até 1023 px, o cartão inteiro; na tabela, o nome do líder. Os atalhos "Dados da célula" e "Ver relatórios" do legado não voltam em cada linha.<br>- Abre o detalhe quem vê a célula (RN-02 e RN-03 do E2.02), inclusive quem só a vê por ser o líder, o timóteo ou o anfitrião dela (RN-02 d de lá).<br>- As permissões que mostram só relatórios ("Visualizar Relatórios de Toda a Igreja" e "Visualizar Relatórios do Seu Ministério") não abrem o detalhe (RN-04 do E2.02).<br>- A célula que a pessoa não vê, a célula excluída, a célula que não existe e o endereço com um id sem formato de id têm a mesma resposta: "Célula não encontrada.". Nenhum dado da célula sai do servidor.<br>- **Caminho de volta:** "Voltar para Células" e o voltar do navegador levam à lista com os filtros, a busca e a página que estavam aplicados. Quem não tem a lista de Células (RN-22 do E2.02), como Hugo e Lia, vê "Ir para o início" no lugar de "Voltar para Células", no detalhe e em "Célula não encontrada.".<br>- Se a pessoa deixa de ver a célula com o detalhe aberto (por exemplo, porque mudaram as pessoas da célula), a consulta seguinte mostra "Célula não encontrada." (RN-08 do E2.02).<br>- No volume de referência, o detalhe aparece em até 2 s. | CEL-07; legado (`UI/AppRoutes.js:47-48`: `/cells/:id`; `UI/pages/Cells/details.js:196-208`: a célula fora do escopo ou excluída volta para a lista; `Infra/Repositories/CellRepository.cs:48-56`); RN-08 do E2.01 ("link direto: o cadastro aparece como não encontrado"); RN-02, RN-04, RN-08, RN-09 (a) e RN-22 do E2.02; tela própria: definida pelo spec (P-LCE-11); tempo: definida pelo spec (P-LCE-20); como a lista leva ao detalhe: definida pelo spec (P-LCE-27, PO-UX-6); "Ir para o início": definida pelo spec (P-LCE-24, PO-UX-3) |
| RN-15 | **Detalhe da célula: o que mostra.**<br>(a) **Pessoas da célula:** o líder, com o nível entre parênteses (RN-02 e RN-11 do E2.06: "André (144)", "Samuel (Pastor)", "Ester (Sem liderança)"), o timóteo e o anfitrião. São nomes de referência (RN-06 do E1.08): aparecem mesmo para quem está fora do escopo de quem consulta, só o nome e sem acesso ao cadastro. A pessoa inativa aparece com "(inativo)" ou "(inativa)", conforme o sexo, só para quem a vê, como no formulário de célula (RN-04 e P-CEL-18 do E2.08).<br>(b) **G12 da célula:** um nome só, "Pastores" ou "—" (RN-11 do E2.06). Aparece como a última linha de "Pessoas da célula".<br>(c) **Reunião:** o dia da semana, o horário e o tipo, como complemento do título "Célula de {Líder}" ("Quarta · 20:00 · Evangelística").<br>(d) **Endereço da célula:** CEP, rua, número, complemento, bairro, cidade e estado, para todos que veem a célula (RN-09 do E2.08). A célula sem endereço mostra "Sem endereço".<br>(e) **Situação:** Ativa ou Inativa, ao lado do título. A inativa tem o ícone de pausa (P-CEL-22 do E2.08).<br>(f) **Situação do relatório:** a mesma da lista de Células (RN-09 do E2.09) e do filtro (RN-10), com os mesmos textos e a mesma aparência, sem componente próprio (P70 a P72 da UX do E2.09):<br>- a situação da semana, com o detalhe do "Enviado" ("Enviado · Célula realizada" ou "Enviado · Não houve célula");<br>- embaixo, a explicação do valor, com os textos da legenda do E2.09 (para "Ainda não ocorreu", "Pendente" e "Conta a partir da próxima semana");<br>- as semanas anteriores sem relatório, quando houver 1 ou mais ("Sem relatório na semana passada", "… nas 2, nas 3, nas 4 ou mais semanas anteriores").<br><br>A célula inativa não tem situação do relatório, e o detalhe mostra "Célula inativa: sem situação do relatório.". A célula sem dia da reunião mostra "Sem dia da reunião", como na lista. O detalhe nunca mostra a data do último relatório nem indica um relatório que quem abre não vê.<br>(g) **Autoria:** "Cadastrada por … em …" e "Alterada por … em …", como na RN-07 do E2.05.<br>(h) Os últimos relatórios (RN-17), o caminho para todos os relatórios (RN-19) e a evolução (RN-20).<br><br>Tudo aparece pelo valor atual. Depois de uma gravação feita a partir do detalhe (editar a célula, ou lançar, editar ou excluir um relatório), o detalhe mostra os valores novos assim que a gravação é confirmada (RN-08 do E2.06). | CEL-07; legado (`UI/pages/Cells/details.js:358-446`: pessoas, definições e endereço; `UI/pages/Cells/index.js:49-54`: líder com o nível e G12 com um nome); RN-06 do E1.08; RN-07 do E2.05; RN-02, RN-08 e RN-11 do E2.06; RN-04, RN-09, RN-11, P-CEL-18 e P-CEL-22 do E2.08; RN-04, RN-05, RN-07 e RN-09 do E2.09, com os padrões P70 a P72 da UX de lá; situação do relatório no detalhe: definida pelo spec (P-LCE-07, P-LCE-22); "(inativo)": definida pelo spec (P-LCE-19); arrumação: definida pelo spec (P-LCE-23, PO-UX-2) |
| RN-16 | **Detalhe da célula: ações.** O detalhe tem as mesmas ações da linha da lista, com as mesmas regras:<br>- **"Novo relatório":** para quem pode lançar o relatório da célula (RN-13 do E2.02), só com a célula ativa (RN-11 c do E2.08). O formulário abre com a célula já escolhida. No celular, a ação fica num rodapé fixo, à vista em qualquer ponto da rolagem. A situação "Enviado" não tira a ação (P-SIT-17 do E2.09).<br>- **"Editar célula":** com "Editar Célula" (RN-12 do E2.08). Abre o mesmo formulário da lista, que também inativa e reativa a célula.<br>- **"Excluir célula":** com "Excluir Célula", com as regras do E2.01. Depois da exclusão, a pessoa volta para a lista de Células.<br><br>As ações da célula levam o objeto no nome, porque a mesma tela tem o "Editar" e o "Excluir" de cada relatório (RN-17). Quem não tem nenhuma dessas permissões vê o detalhe sem ações. | CEL-04; CEL-07; legado (`UI/pages/Cells/details.js:452` e `:462-464`: excluir e salvar na própria tela); RN-02 e RN-07 do E2.01; RN-12 e RN-13 do E2.02; RN-11 e RN-12 do E2.08; P-SIT-17 do E2.09; definida pelo spec (P-LCE-18); nomes e rodapé fixo: definida pelo spec (P-LCE-28, PO-UX-7) |
| RN-17 | **Últimos relatórios.**<br>- O detalhe mostra os **3** relatórios mais recentes da célula, pela data e pelo horário da reunião, do mais recente para o mais antigo. Entram só os relatórios não excluídos e visíveis para quem abre o detalhe (RN-04 do E2.02), tanto os de célula realizada quanto os de "Não houve célula". O desempate é estável.<br>- Cada relatório mostra:<br>  - a data e o horário da reunião;<br>  - na célula realizada: o tema, o número de participantes, o número de visitantes, a oferta em reais e as observações, quando houver. A oferta de zero registrada aparece como "R$ 0,00". Sem valor de oferta registrado, aparece "Oferta: Não informada", nunca "R$ 0,00";<br>  - em "Não houve célula": o motivo e as observações, quando houver;<br>  - ao lado do número de participantes e do de visitantes, a comparação com o relatório visível de célula realizada imediatamente anterior: maior, menor ou igual. Sem um relatório anterior de célula realizada, não há comparação. O relatório de "Não houve célula" não tem comparação.<br>- A comparação usa setas neutras e o sinal "=" para igual, sem depender de cor, e uma frase acima dos relatórios explica: "As setas comparam com o relatório anterior de célula realizada.".<br>- As ações de cada relatório são as da lista de Relatórios, com as mesmas regras: "Editar", com "Editar Relatórios de Células", e "Excluir", com "Excluir Relatórios de Células" (RN-14 do E2.02).<br>- Sem nenhum relatório visível, o detalhe mostra "Nenhum relatório para mostrar.". É o mesmo texto em todos os casos: quando a célula não tem relatório e quando ela tem relatórios que quem abre não vê. Assim, ele não contradiz a situação "Enviado" e não revela relatórios invisíveis.<br>- A célula inativa mostra os relatórios dela da mesma forma (RN-11 d do E2.08).<br>- Os relatórios que quem abre não vê não aparecem e não são indicados de nenhuma forma. Por isso, o detalhe pode mostrar menos de 3 relatórios, mesmo quando a célula tem mais. | CEL-07 ("os 3 últimos"); legado (`API/Controllers/CellController.cs:34-47`: os 3 últimos; `UI/pages/Cells/details.js:61` e `:200`: a tela mostra até 10, por data, do mais recente; `:120-175`: data e hora, tema ou "Não houve célula.", observações, oferta, participantes e visitantes; `:68-82`: a seta de comparação; `:168-174`: excluir o relatório na tela); RN-04 e RN-14 do E2.02; RN-08 e RN-12 do E2.01; 3 relatórios: plano (CEL-07), definida pelo spec (P-LCE-12), ver Q-1; comparação: definida pelo spec (P-LCE-14); setas neutras e a frase: definida pelo spec (P-LCE-29, PO-UX-8); "Nenhum relatório para mostrar.": definida pelo spec (P-LCE-25, PO-UX-4); oferta sem valor: definida pelo spec (P-LCE-31, PO-UX-10) |
| RN-18 | **Participantes e visitantes no detalhe.**<br>- O detalhe mostra só os números de participantes e de visitantes de cada relatório, para todos que veem o relatório, como no legado. Os nomes não aparecem no detalhe, para ninguém.<br>- Os nomes continuam onde estão hoje: no formulário de edição do relatório e na consulta do relatório de célula excluída, para quem tem "Editar Relatórios de Células" (RN-11 do E2.01). O E2.12 decide se a lista de Relatórios ganha, para todos, uma consulta com os nomes.<br>- O número de participantes conta os membros do relatório, inclusive os excluídos (RN-13 do E2.01). Depois do E2.11, conta também o líder, o timóteo e o anfitrião incluídos automaticamente (REL-07).<br>- O número de visitantes conta os nomes preenchidos (REL-08). | CEL-07; legado (`UI/pages/Cells/details.js:156-167` e `UI/pages/Report/index.js:84-95`: só os números; nenhuma tela do legado mostra os nomes dos participantes de um relatório já enviado); RN-11 e RN-13 do E2.01; REL-07; REL-08; definida pelo spec (P-LCE-13) |
| RN-19 | **Todos os relatórios da célula.**<br>- O detalhe tem "Ver todos os relatórios" sempre que a célula tem pelo menos um relatório visível.<br>- O link abre a lista de Relatórios com o filtro **Célula**, sem nenhum outro filtro e sem período, na página 1.<br>- A lista mostra todos os relatórios não excluídos e visíveis da célula (RN-04 do E2.02), na ordem da lista de Relatórios (RN-03 do E1.08), com o total, a paginação, a busca e as ações de hoje.<br>- O filtro Célula fica na URL e aparece como um chip removível acima da lista, com "Limpar filtros" ao lado: "Célula de {Líder} · {Dia} · {horário}" (RN-04 do E2.01). O título da tela de Relatórios não muda. Tirar o chip ou usar "Limpar filtros" volta à lista de todos os relatórios.<br>- O chip identifica a célula quando quem consulta vê a célula ou pelo menos um relatório não excluído dela. Assim, quem só vê relatórios ("Visualizar Relatórios de Toda a Igreja") pode usar o mesmo link. Os relatórios de uma célula excluída também continuam acessíveis por ele, com a indicação "Célula excluída" (RN-11 do E2.01).<br>- Nos outros casos (a pessoa não vê a célula nem nenhum relatório dela, ou a célula não existe), o chip mostra "Célula indisponível", sem identificação e com a dica "Esta célula não está disponível para você.". A lista fica vazia.<br>- Um id sem formato de id é valor inválido: sai da URL e não é aplicado. | CEL-07 ("dá acesso à lista completa"); legado (`UI/pages/Cells/index.js:75`: "Ver relatórios"; `UI/AppRoutes.js:43-44`: `/cells/:cellId/reports`; `UI/pages/Report/index.js:33-36` e `:164-168`: a lista de Relatórios só da célula, sem período); RN-01 e RN-03 do E1.08; RN-04 e RN-11 do E2.01; RN-04 do E2.02; filtro na lista de Relatórios: definida pelo spec (P-LCE-16); identificação e célula indisponível: definida pelo spec (P-LCE-17); título sem mudança: definida pelo spec (P-LCE-32, PO-UX-11) |
| RN-20 | **Evolução.**<br>- O detalhe mostra um gráfico de linhas, como o do legado, com o número de participantes e o de visitantes dos até **10** relatórios mais recentes da célula, não excluídos e visíveis, em ordem cronológica. Cada relatório é um ponto, na data da reunião.<br>- No relatório de "Não houve célula", o ponto fica sem valor: um intervalo nas linhas, marcado com "×" e explicado na legenda como "Não houve célula". Ele não conta como zero.<br>- Os mesmos números ficam também numa tabela, na mesma ordem, em abas: "Gráfico" (padrão) e "Tabela".<br>- O gráfico aparece a partir de 1 relatório visível. Sem relatório, ele não aparece.<br>- Os números são os mesmos da RN-17. | legado (`UI/pages/Cells/details.js:491-517`: "Linha de evolução", com participantes e visitantes dos até 10 relatórios carregados); Fora de escopo do E2.08 (o gráfico de evolução fica para o E2.10); "Não houve célula" sem valor: definida pelo spec (P-LCE-15), coerente com o E2.07 (P-FIL-08: "Não houve célula" não é participação); linhas, intervalo e abas: definida pelo spec (P-LCE-30, PO-UX-9) |
| RN-21 | **Cada card de células do Dashboard tem um equivalente na lista.** Para cada card de células, a lista de Células com os filtros abaixo mostra um total igual ao número do card, para qualquer pessoa, no mesmo momento. Este passo garante os filtros e a igualdade; o clique que abre a lista é do E2.14 (DSH-05).<br><br>Equivalentes:<br>- **Células com relatório pendente:** Situação do relatório: Pendente. O card e a lista usam a mesma situação da semana (RN-08 do E2.09);<br>- **Células por tipo** (Evangelística, Discipulado, Macrocélula): Tipo: {tipo}. Hoje o card conta as células ativas e as inativas. Se o E2.14 passar a contar só as ativas, como recomenda o E2.08, a linha ganha "Situação: Ativa";<br>- **Novas células da semana** (card do E2.14, DSH-02): "Cadastrada a partir de" o domingo e "Cadastrada até" o sábado da semana atual;<br>- **Células por G12** (cada casal do ranking): G12 com os integrantes do casal que contam no ranking, mais Situação: Ativa.<br><br>Se o E2.14 mudar a definição de algum card, a linha correspondente muda junto, e a igualdade continua valendo. | DSH-02; DSH-03; DSH-05; legado (`UI/pages/Home/index.js:18-24` e `:54-60`: cada card abre a lista com os filtros dele; `App/Services/DashboardService.cs:62-87` e `:105-113`: os cards usam os mesmos filtros da lista); definições atuais dos cards (`dashboard_summary`, `dashboard_cells_by_type` e `dashboard_g12_ranking`, PR 3 do E1.08); RN-08 do E2.09 e Impactos de lá ("o clique no card abre a lista com o filtro 'Pendente' do E2.10"); recomendação do E2.08 (Impactos, E2.14); ranking: definida pelo spec (P-LCE-21) |

### Critérios de aceite
Convenções:
- "Pela API" é qualquer leitura feita fora da tela, com a sessão da persona citada.
- "Hoje" é terça-feira, 24/11/2026, às 21:00 de Brasília, salvo quando o critério diz outra data. A semana atual vai de domingo, 22/11, a sábado, 28/11.
- Cada critério parte da massa original.
- As situações do relatório citadas são as do E2.09, com o prazo de 1 hora depois do horário da reunião (RN-02 de lá).
- **Consolidado:** ainda não existe; ver Impactos.

#### Massa de exemplo
A árvore e as funções são as da [massa do E2.07](e2-07-filtros-membros.md#massa-de-exemplo), com uma pessoa a mais: **Lia**, discípula de Ester, com a função "Secretaria", que só tem "Visualizar Relatórios de Toda a Igreja".

- **Árvore** (líder → discípulos):
  - Samuel e Magda, casados, pastores (D9).
  - Pedro, discípulo de Samuel, e Paula, discípula de Magda, casados (G12).
  - Tiago, discípulo de Samuel, e Tânia, discípula de Magda, casados (G12).
  - André, discípulo de Pedro, casado com Beatriz, discípula de Tânia.
  - Caio e Fábio (**inativo**), discípulos de André. Gabriel, discípulo de Fábio. Jonas, discípulo de Gabriel.
  - Carla, discípula de Paula. Débora, discípula de Beatriz. Rita, discípula de Tânia.
  - Diego e Hugo, discípulos de Tiago.
  - Ester, sem liderança. Lúcia e Lia, discípulas de Ester.
- **Funções:**
  - Rita: Administrador. Só ela tem "Ver Dados Sensíveis".
  - Samuel, Magda, Pedro, Paula, André e Diego: Líder.
  - Caio, Carla, Fábio, Beatriz, Ester e Jonas: Membro.
  - Hugo: sem função.
  - Lia: Secretaria.
- **Células:**

| Célula | Líder (nível) / Timóteo / Anfitrião | G12 da célula | Tipo | Dia e horário | Endereço | Situação | Cadastrada em |
|---|---|---|---|---|---|---|---|
| C1 | André (144) / Caio / Carla | Pedro | Evangelística | Quarta, 20:00 | CEP 90010-000, Rua das Flores, 100, Centro, Porto Alegre, RS | Ativa | 10/03/2025 |
| C2 | Diego (144) / Hugo / Caio | Tiago | Evangelística | Quinta, 20:00 | Av. São João, 45, São João, Porto Alegre, RS | Ativa | domingo, 22/11/2026, 00:10 |
| C3 | Débora (1.728) / Rita / Beatriz | Tânia | Discipulado | Terça, 19:30 | Rua Sao Joao, 12, Niterói, Canoas, RS | Ativa | data não registrada (legado) |
| C4 | Gabriel (20.736) / Jonas / Fábio | Pedro | Evangelística | Sábado, 10:00 | Rua Brasil, 500, Centro, Alegrete, RS | **Inativa** | 05/06/2026 |
| C5 | Jonas (Nível 5) / Gabriel / Fábio | Pedro | Evangelística | Sexta, 20:00 | — | **excluída** | 01/09/2026 |
| C6 | Paula (G12) / Carla / Paula | Paula | Discipulado | Segunda, 20:00 | sem endereço | Ativa | sábado, 21/11/2026, 23:30 |
| C7 | Samuel (Pastor) / Tiago / Magda | Pastores | Macrocélula | Domingo, 18:00 | Rua da Igreja, 1, Centro, Porto Alegre, RS | Ativa | 15/01/2024 |
| C8 | Ester (Sem liderança) / Lúcia / Ester | — | Evangelística | Sábado, 16:00 | Rua das Flores, 7, Rio Branco, Canoas, RS | Ativa | 02/02/2026 |

- **Relatórios** (nenhum outro, salvo o que cada critério disser):
  - C1:
    - **R1:** quarta, 18/11/2026, 20:00, célula realizada. Tema "A fé que vence", 8 participantes, 2 visitantes, oferta de R$ 50,00 e observações "Dois visitantes do trabalho do Caio".
    - **R2:** quarta, 11/11/2026, 20:00, "Não houve célula", com o motivo "Chuva forte no bairro".
    - **R3:** quarta, 04/11/2026, 20:15, célula realizada, **excluído**. Tema "Esperança", 7 participantes, 1 visitante, oferta de R$ 30,00.
    - **R4:** quarta, 28/10/2026, 20:00, célula realizada. Tema "Perdão", 6 participantes, 0 visitantes, oferta de R$ 20,00.
    - **R5:** quarta, 21/10/2026, 20:00, célula realizada. Tema "Oração", 5 participantes, 1 visitante, oferta de R$ 15,00.
  - C3: **R8**, terça, 10/11/2026, 19:30, célula realizada. Nenhum relatório depois dele.
  - C5: **R6**, sexta, 20/11/2026, 20:00, célula realizada, lançado antes da exclusão da célula.
  - C6: **R9**, segunda, 23/11/2026, 20:00, célula realizada.
  - C7: **R10**, domingo, 22/11/2026, 18:00, célula realizada.
  - C2, C4 e C8: nenhum relatório. C2 foi cadastrada nesta semana, e C8 nunca enviou relatório.
- **Situação do relatório hoje, às 21:00** (E2.09):

| Célula | Situação da semana (RN-04 do E2.09) | Semanas anteriores sem relatório (RN-05 do E2.09) |
|---|---|---|
| C1 | Ainda não ocorreu (quarta; prazo às 21:00 de amanhã) | nenhuma: R1 é da semana passada |
| C2 | Ainda não ocorreu (quinta) | nenhuma: foi cadastrada nesta semana |
| C3 | Pendente (prazo às 20:30 de hoje) | Sem relatório na semana passada: R8 é de duas semanas atrás |
| C4 | sem situação (inativa) | — |
| C6 | Enviado · Célula realizada (R9) | — |
| C7 | Enviado · Célula realizada (R10) | — |
| C8 | Ainda não ocorreu (sábado) | Sem relatório nas 4 ou mais semanas anteriores: nunca enviou, cadastrada em 02/02/2026 |
- **O que cada um vê.** Os membros são os da tabela do E2.07, com Lia visível para Rita e Ester. As células (C5, excluída, não aparece para ninguém):

| Pessoa | Células visíveis | Por quê |
|---|---|---|
| Rita | C1, C2, C3, C4, C6, C7, C8 | vê a igreja toda |
| Samuel e Magda | C1, C2, C3, C4, C6, C7 | a árvore inteira, menos Ester, Lúcia e Lia |
| Pedro, Caio, Carla e Fábio | C1, C2, C4, C6 | C2 pelo anfitrião, Caio; C3 e C7 não têm ninguém do escopo deles |
| André | C1, C2, C3, C4, C6 | C3 por Débora e Beatriz, do ministério da cônjuge |
| Diego | C2, C3, C7 | C7 pelo timóteo, Tiago |
| Ester | C8 | — |
| Hugo | C2 | só por ser o timóteo (RN-02 d do E2.02); não tem Células no menu |
| Lia | nenhuma | vê todos os relatórios, mas nenhuma célula |

Os relatórios visíveis seguem as células, conforme a RN-04 do E2.02. Até o E2.11, valem as pessoas atuais da célula. Os relatórios de C5 são visíveis para quem vê Jonas, Gabriel ou Fábio. Lia vê todos.

#### Critérios por regra
- **RN-01**
  - Dados Rita, Samuel, Pedro, André, Diego, Caio e Ester
  - Quando cada um abre Células
  - Então vê a busca e os filtros Líder, G12, Rua, Bairro, Cidade, Tipo, Dia da semana, Situação, Situação do relatório, "Cadastrada a partir de" e "Cadastrada até". Com todos os filtros vazios, vê a mesma lista e o mesmo total de antes deste passo.
  - Dados Hugo, sem função, e Lia, que só vê relatórios
  - Então nenhum dos dois tem Células no menu (RN-22 do E2.02). Pela API, vale a RN-03.
- **RN-02**
  - Dada Rita
  - Quando ela escolhe Tipo: Evangelística e Situação: Ativa
  - Então vê C1, C2 e C8, com o total 3.
  - Quando ela escolhe Tipo: Evangelística e Macrocélula
  - Então vê C1, C2, C4, C7 e C8 (5).
  - Quando ela busca "débora" e escolhe Tipo: Evangelística
  - Então a lista fica vazia, com "Nenhuma célula encontrada com estes filtros.", porque C3 é de Discipulado.
  - Dada Rita no computador, na página 3 de uma lista
  - Quando ela muda qualquer filtro
  - Então a lista muda na hora e volta para a página 1.
  - Dada Rita no celular, na página 3 de uma lista
  - Quando ela marca Tipo: Macrocélula no painel de filtros e fecha o painel sem tocar em "Aplicar filtros"
  - Então a lista e a página não mudam.
  - Quando ela marca de novo e toca em "Aplicar filtros"
  - Então a lista muda e volta para a página 1.
  - Quando ela toca no "✕" do chip "Tipo: Macrocélula"
  - Então o filtro sai na hora, sem "Aplicar filtros", e a lista volta para a página 1.
  - Dados 20 mil membros, 1.500 células e 100 mil relatórios
  - Quando Rita aplica, ao mesmo tempo, Líder (1 pessoa), G12 (2 pessoas), Bairro, Tipo (2 opções), Dia da semana (2 opções), Situação, Situação do relatório (2 opções) e as duas datas
  - Então a primeira página e o total aparecem em até 2 s.
- **RN-03**
  - Dado Pedro
  - Quando ele escolhe Tipo: Discipulado
  - Então vê só C6, e não C3, que ele não vê.
  - Dado Diego
  - Quando ele escolhe Tipo: Evangelística
  - Então vê só C2, e não C1, C4 nem C8.
  - Dado Samuel, pastor
  - Quando ele filtra Cidade: "canoas"
  - Então vê só C3. C8 não aparece, porque é de Ester, que está fora do escopo dele.
  - Dado Fábio, inativo
  - Quando ele abre Células
  - Então vê C1, C2, C4 e C6, como Caio (RN-07 do E2.02).
  - Dados Hugo e Lia
  - Quando eles leem a lista de Células pela API com qualquer filtro, por exemplo Tipo: Evangelística
  - Então Hugo recebe no máximo C2, e Lia não recebe nenhuma célula.
  - Dada C5, excluída, que é a única célula de sexta-feira
  - Quando Rita escolhe Dia da semana: Sexta-feira
  - Então a lista fica vazia.
  - Quando Rita escolhe G12: Pedro
  - Então C5 não aparece (RN-05).
- **RN-04**
  - Dada Rita
  - Quando ela escolhe Líder: André
  - Então vê só C1.
  - Quando ela escolhe Líder: André e Paula
  - Então vê C1 e C6.
  - Quando ela escolhe Líder: Samuel
  - Então vê C7, a célula do pastor.
  - Quando ela escolhe Líder: Ester
  - Então vê C8, a célula de quem está sem liderança.
  - Quando ela escolhe Líder: Gabriel
  - Então vê C4, que está inativa.
  - Quando ela escolhe Líder: Caio
  - Então não vê C1 nem C2: Caio é timóteo de C1 e anfitrião de C2, mas não lidera nenhuma das duas.
  - Dado Pedro
  - Quando ele abre o seletor de Líder
  - Então as opções são "André (144)", "Diego (144)", "Gabriel (20.736)" e "Paula (G12)", sem Débora, Samuel nem Ester. Diego aparece, mesmo sem ser visível para Pedro como membro, porque lidera C2.
  - Quando ele busca "débora" no seletor
  - Então vê "Nenhum líder de célula encontrado.".
  - Dada Rita com 10 pessoas escolhidas no Líder
  - Quando ela tenta escolher a 11ª
  - Então vê "Escolha até 10 pessoas.", e a 11ª não entra.
  - Dado um link com 12 pessoas no Líder
  - Quando Rita o abre
  - Então valem as 10 primeiras, na ordem do link, as outras 2 saem da URL, e aparece "Escolha até 10 pessoas.".
- **RN-05**
  - Dada Rita
  - Quando ela escolhe G12: Pedro
  - Então vê C1 e C4. C5 não aparece, porque foi excluída.
  - Quando ela acrescenta Situação: Ativa
  - Então vê só C1.
  - Quando ela escolhe G12: Paula
  - Então vê C6, que é liderada pela própria Paula.
  - Quando ela escolhe G12: Pedro e Paula
  - Então vê C1, C4 e C6.
  - Quando ela escolhe G12: Tânia
  - Então vê C3.
  - Quando ela escolhe todas as opções do G12 (Pedro, Paula, Tiago e Tânia)
  - Então vê C1, C2, C3, C4 e C6, sem C7 (célula de pastor) e sem C8 (célula de quem está sem liderança).
  - Dado Pedro
  - Quando ele abre o seletor de G12
  - Então as opções são Pedro, Paula e Tiago, só com o nome. Tiago aparece porque é o G12 de C2. Tânia não aparece: buscando "tânia", Pedro vê "Nenhum G12 encontrado.".
  - Quando ele escolhe G12: Tiago
  - Então vê C2.
  - Dado André
  - Quando ele abre o seletor de G12
  - Então as opções são Pedro, Paula, Tiago e Tânia. Tânia aparece porque é o G12 de C3, que André vê.
- **RN-06**
  - Dado Pedro
  - Quando ele abre um link com G12: Tânia
  - Então o filtro aparece como "Pessoa indisponível", com "Esta pessoa não está disponível para você.", sem o nome nem o id de Tânia, nem na tela nem na resposta do servidor. O botão mostra "Filtros (1)", e a lista fica vazia, com o total 0.
  - Quando o link traz G12: Tânia e Pedro
  - Então Pedro vê C1 e C4, e Tânia aparece como "Pessoa indisponível".
  - Quando Pedro tira o chip "G12: Pessoa indisponível"
  - Então o id de Tânia sai da URL, e a lista fica só com G12: Pedro.
  - Dado André
  - Quando ele abre o mesmo link com G12: Tânia
  - Então vê o chip "G12: Tânia" e C3.
  - Dado Pedro
  - Quando ele abre um link com Líder: Débora
  - Então vê "Pessoa indisponível", e a lista fica vazia.
  - Dada Rita
  - Quando ela abre um link com Líder: Caio
  - Então vê o chip "Líder: Caio" e a lista vazia, com "Nenhuma célula encontrada com estes filtros.". Caio é visível para Rita, mas não lidera nenhuma célula.
  - Dado um link com o id de um membro excluído, ou com um id de formato válido que não existe, no G12 ou no Líder
  - Quando Pedro o abre
  - Então a resposta é a mesma do caso de Tânia.
  - Dado um link com G12: "xyz", que não tem formato de id
  - Então "xyz" sai da URL, "Pessoa indisponível" não aparece, o filtro não conta, e a lista vem sem o filtro de G12.
  - Dado Pedro, que não vê C3
  - Quando ele usa o Líder e o G12 pela API, com qualquer id
  - Então nenhuma resposta revela o líder ou o G12 de C3, nem os ids ou os nomes dos líderes acima de quem ele não vê.
- **RN-07**
  - Dada Rita
  - Quando ela filtra Rua: "  sao   JOÃO "
  - Então vê C2 (Av. São João) e C3 (Rua Sao Joao).
  - Quando ela filtra Bairro: "centro"
  - Então vê C1, C4 e C7.
  - Quando ela filtra Cidade: "alegre"
  - Então vê C1, C2 e C7 (Porto Alegre) e C4 (Alegrete).
  - Quando ela filtra Rua: "%"
  - Então vê só as células cuja rua contém o caractere "%", e nenhum erro aparece.
  - Quando ela preenche Rua, Bairro ou Cidade com qualquer texto
  - Então C6, que não tem endereço, não aparece.
  - Dado Pedro, sem "Ver Dados Sensíveis"
  - Quando ele filtra Rua: "flores"
  - Então vê C1, porque o endereço da célula não é dado sensível. C8, que ele não vê, não aparece.
  - Dado que Carla, anfitriã de C1, muda o endereço dela para a Rua Brasil
  - Quando Rita filtra Rua: "brasil"
  - Então vê C4, e não C1: o endereço de C1 continua o da célula.
- **RN-08**
  - Dada Rita
  - Quando ela escolhe Tipo: Discipulado
  - Então vê C3 e C6. Com Tipo: Macrocélula, vê só C7.
  - Quando ela abre o filtro Dia da semana
  - Então as opções aparecem nesta ordem: Segunda-feira, Terça-feira, Quarta-feira, Quinta-feira, Sexta-feira, Sábado e Domingo.
  - Quando ela escolhe Dia da semana: Sábado
  - Então vê C4 e C8.
  - Quando ela escolhe Quarta-feira e Quinta-feira
  - Então vê C1 e C2.
  - Dado que Rita muda o dia de C1 para Quinta
  - Quando ela filtra Dia da semana: Quarta-feira, logo depois de salvar
  - Então a lista fica vazia. Com Quinta-feira, ela vê C1 e C2.
- **RN-09**
  - Dada Rita
  - Quando ela escolhe Situação: Ativa
  - Então vê C1, C2, C3, C6, C7 e C8 (6).
  - Quando ela escolhe Inativa
  - Então vê só C4. Com "Todas", vê as 7 células.
  - Quando Rita reativa C4 e filtra Situação: Ativa, logo depois de salvar
  - Então vê as 7 células.
  - Então, em nenhuma opção, C5 aparece.
- **RN-10**
  - Dada Rita, hoje às 21:00
  - Quando ela abre o filtro Situação do relatório
  - Então vê o subgrupo "Nesta semana", com Enviado, Ainda não ocorreu, Pendente e Conta a partir da próxima semana, e o subgrupo "Sem relatório nas semanas anteriores", com Na semana passada, Nas 2, Nas 3 e Nas 4 ou mais semanas anteriores. Não há opção "Em dia", "Relatório em dia" nem "Sem dia da reunião".
  - Quando ela escolhe cada opção
  - Então vê:
    - Enviado: C6 e C7;
    - Ainda não ocorreu: C1, C2 e C8;
    - Pendente: só C3. A reunião foi às 19:30, e o prazo de 1 hora passou às 20:30;
    - Conta a partir da próxima semana: nenhuma;
    - Na semana passada: C3;
    - Nas 2 semanas anteriores e Nas 3 semanas anteriores: nenhuma;
    - Nas 4 ou mais semanas anteriores: C8, que nunca enviou relatório.
  - Então C4, inativa, não aparece em nenhuma opção.
  - Quando ela escolhe Pendente e Nas 4 ou mais semanas anteriores
  - Então vê C3 e C8: basta valer uma das opções, também entre os subgrupos.
  - Então o botão mostra "Filtros (1)", e aparecem os chips "Situação do relatório: Pendente" e "Situação do relatório: Sem relatório nas 4 ou mais semanas anteriores".
  - Quando ela escolhe Situação: Inativa e qualquer opção de Situação do relatório
  - Então a lista fica vazia.
  - Dado que R9, de C6, é editado para "Não houve célula"
  - Quando Rita escolhe Enviado
  - Então C6 continua na lista, agora com "Enviado · Não houve célula".
  - Dado Pedro
  - Quando ele escolhe Pendente
  - Então a lista fica vazia, porque ele não vê C3. Para André, a lista mostra C3.
  - Dado que o relatório de C3 de hoje, 19:30, é lançado às 21:05
  - Quando Rita refaz a consulta
  - Então C3 sai de "Pendente" e de "Na semana passada" e passa para "Enviado": com relatório nesta semana, a contagem de semanas anteriores é zero (RN-05 do E2.09).
  - Quando esse relatório é excluído
  - Então C3 volta para "Pendente" e para "Na semana passada" (RN-12 do E2.01).
  - Dado que nenhum relatório de C3 é lançado na semana
  - Quando a consulta é feita no sábado, 28/11, às 23:59, e de novo no domingo, 29/11, às 00:00
  - Então, às 23:59 de sábado, C3 está em "Pendente" e em "Na semana passada". Às 00:00 de domingo, ela está em "Ainda não ocorreu" e em "Nas 2 semanas anteriores": a reunião de terça, 01/12, ainda não aconteceu, e as semanas de 15/11 e de 22/11 ficaram sem relatório.
  - Dado que Rita cadastra hoje, às 21:00, uma célula nova, C9, de terça às 19:00
  - Quando ela escolhe Conta a partir da próxima semana
  - Então vê C9: o prazo da reunião desta semana (20:00) passou antes do cadastro (RN-06 do E2.09).
  - Dada uma célula de teste sem dia da reunião (antes das regras do E2.08)
  - Quando Rita escolhe todas as opções
  - Então essa célula não aparece.
  - Dada uma célula visível para Pedro cujo único relatório desta semana ele não vê (depois do E2.11, lançado com pessoas fora do escopo dele)
  - Quando ele escolhe Pendente
  - Então essa célula não aparece, porque a situação considera também os relatórios que ele não vê. Com Enviado, ela aparece.
  - Dada qualquer opção de Situação do relatório
  - Então o total da lista é igual ao número de células visíveis e ativas que o cálculo do E2.09 coloca nessa opção, no mesmo momento.
- **RN-11**
  - Dada Rita
  - Quando ela filtra "Cadastrada a partir de" 22/11/2026
  - Então vê C2, cadastrada no domingo às 00:10, e não C6, cadastrada no sábado às 23:30.
  - Quando ela filtra "Cadastrada até" 21/11/2026
  - Então vê C1, C4, C6, C7 e C8, sem C2 e sem C3.
  - Quando ela filtra de 21/11/2026 até 21/11/2026
  - Então vê só C6.
  - Dada C3, com "data não registrada"
  - Quando Rita usa qualquer um dos dois campos, com qualquer data
  - Então C3 não aparece. Sem filtro de data, C3 aparece.
  - Quando Rita informa "a partir de" 25/11/2026 e "até" 20/11/2026
  - Então vê "A data inicial precisa ser igual ou anterior à data final.", e a lista continua sem o filtro de data.
  - Quando ela informa 31/02/2026 e sai do campo
  - Então vê "Data inválida. Use o formato dd/mm/aaaa.", e o filtro de data não é aplicado. Enquanto ela digita, nenhuma mensagem aparece.
  - Quando ela informa "Cadastrada até" 28/11/2026
  - Então a data é aceita, sem mensagem.
- **RN-12**
  - Dada Rita com Tipo: Evangelística, Situação: Ativa e 50 por página
  - Quando ela recarrega a página ou volta a ela pelo navegador
  - Então os filtros, a página e o tamanho continuam aplicados.
  - Quando ela envia o link a Pedro
  - Então Pedro vê C1 e C2, porque C8 está fora do escopo dele.
  - Dado um link com o tipo "abc" e Dia da semana: Sábado
  - Então a lista aplica só o Dia da semana, "abc" sai da URL, o botão mostra "Filtros (1)", e Rita vê C4 e C8.
  - Dada Rita com três filtros e a busca "flores", na página 2, com 50 por página
  - Quando ela usa "Limpar filtros"
  - Então os filtros e a busca ficam vazios, a lista volta para a página 1 e continua com 50 por página.
  - Dada Rita com Líder: André e Paula, G12: Pedro, Tipo: Evangelística e Discipulado, Situação: Ativa e as duas datas de cadastro
  - Então o botão mostra "Filtros (5)", e aparecem 8 chips: 2 de Líder, 1 de G12, 2 de Tipo, 1 de Situação e 2 de data.
  - Quando ela tira o chip "Tipo: Discipulado"
  - Então só esse valor sai. Tipo: Evangelística continua, e o botão continua com "Filtros (5)".
  - Dada Rita com Situação: Todas e nenhum outro filtro
  - Então o botão mostra "Filtros", sem número, e nenhum chip aparece.
  - Dada Rita só com a busca "flores", sem nenhum filtro
  - Então o botão mostra "Filtros", sem número, e "Limpar filtros" aparece.
- **RN-13**
  - Dada Rita, sem filtros
  - Então a lista vem nesta ordem: C2, C6, C4, C8, C1, C7 e C3. C3, com "data não registrada", vem por último.
  - Quando Rita escolhe Situação: Ativa
  - Então a ordem das que ficam é a mesma: C2, C6, C8, C1, C7 e C3.
  - Dadas 60 células cadastradas no mesmo instante
  - Quando Rita percorre as páginas de 25 em 25
  - Então cada célula aparece exatamente uma vez.
- **RN-14**
  - Dado Pedro, na lista de Células com Tipo: Evangelística, na página 2
  - Quando ele toca no cartão de C1, no celular, ou no nome do líder, na tabela do computador
  - Então vê o detalhe de C1, numa tela com endereço próprio. Ao recarregar, continua no detalhe de C1.
  - Então a linha de C1 na lista não tem os atalhos "Dados da célula" nem "Ver relatórios".
  - Quando ele usa "Voltar para Células"
  - Então volta para a lista com Tipo: Evangelística, na página 2.
  - Quando ele envia o link do detalhe de C1 a Caio
  - Então Caio vê o mesmo detalhe, porque também vê C1.
  - Dado Diego
  - Quando ele abre o link do detalhe de C1
  - Então vê "Célula não encontrada.", com "Voltar para Células", e nenhum dado de C1 sai do servidor.
  - Quando ele abre o link do detalhe de C5 (excluída), o de um id que não existe ou um endereço com "xyz" no lugar do id
  - Então a resposta é a mesma.
  - Dado Hugo, sem função
  - Quando ele abre o link do detalhe de C2
  - Então vê o detalhe, porque é o timóteo de C2. Ele continua sem Células no menu, e o detalhe mostra "Ir para o início" no lugar de "Voltar para Células".
  - Dada Lia
  - Quando ela abre o link do detalhe de C1
  - Então vê "Célula não encontrada.", com "Ir para o início": ela vê os relatórios de C1, mas não a célula, e não tem a lista de Células.
  - Dado Pedro, com o detalhe de C2 aberto
  - Quando Rita troca o anfitrião de C2 de Caio para Rita, e Pedro recarrega o detalhe
  - Então Pedro vê "Célula não encontrada.", porque deixou de ver C2.
  - Dados 20 mil membros, 1.500 células e 100 mil relatórios
  - Quando Rita abre o detalhe de uma célula com 400 relatórios
  - Então o detalhe aparece completo em até 2 s.
- **RN-15**
  - Dada Rita
  - Quando ela abre o detalhe de C1
  - Então vê:
    - o título "Célula de André", com o complemento "Quarta · 20:00 · Evangelística" e a situação "Ativa" ao lado;
    - nas pessoas da célula: "André (144)", Caio e Carla, e, na última linha, o G12: Pedro;
    - no endereço: CEP 90010-000, Rua das Flores, 100, Centro, Porto Alegre, RS;
    - na situação do relatório: "Ainda não ocorreu", com a explicação "A reunião desta semana ainda não aconteceu. O relatório fica pendente 1 hora depois do horário da célula.", sem a linha de semanas anteriores;
    - a autoria da célula (RN-07 do E2.05).
  - Quando ela abre o detalhe de C6
  - Então a situação do relatório é "Enviado · Célula realizada", sem explicação e sem a linha de semanas anteriores.
  - Então, em C1 e em C6, a situação do relatório tem o mesmo texto, o mesmo tom e o mesmo ícone da linha da célula na lista de Células (P70 a P72 do E2.09).
  - Dado André
  - Quando ele abre o detalhe de C3
  - Então a situação do relatório é "Pendente", com a explicação "A reunião desta semana já passou e o relatório não foi enviado.", e embaixo "Sem relatório na semana passada".
  - Dada Ester
  - Quando ela abre o detalhe de C8
  - Então a situação do relatório é "Ainda não ocorreu", com a explicação, e embaixo "Sem relatório nas 4 ou mais semanas anteriores".
  - Dada uma célula de teste sem dia da reunião (antes das regras do E2.08)
  - Quando Rita abre o detalhe dela
  - Então a situação do relatório mostra "Sem dia da reunião", como na lista.
  - Dado Pedro, sem "Ver Dados Sensíveis"
  - Quando ele abre o detalhe de C1
  - Então vê a rua, o número e o CEP de C1.
  - Quando ele abre o detalhe de C4
  - Então vê "Gabriel (20.736)", Jonas e "Fábio (inativo)", a situação "Inativa" com o ícone de pausa e "Célula inativa: sem situação do relatório.".
  - Dado Caio
  - Quando ele abre o detalhe de C2
  - Então vê "Diego (144)", Hugo e Caio, e o G12 Tiago. Diego, Hugo e Tiago aparecem só pelo nome, sem acesso ao cadastro.
  - Dado Diego
  - Quando ele abre o detalhe de C7
  - Então vê "Samuel (Pastor)", Tiago e Magda, e o G12 "Pastores".
  - Dada Ester
  - Quando ela abre o detalhe de C8
  - Então vê "Ester (Sem liderança)", Lúcia e Ester, e o G12 "—".
  - Dado que Hugo fica inativo
  - Quando Caio, que não vê Hugo, abre o detalhe de C2
  - Então vê "Hugo", sem a marca.
  - Quando Diego, que vê Hugo, abre o detalhe de C2
  - Então vê "Hugo (inativo)".
  - Dada Rita
  - Quando ela abre o detalhe de C6
  - Então vê "Sem endereço".
  - Dado Pedro, no detalhe de C1
  - Quando ele edita C1 por "Editar célula" e muda o horário para 20:30
  - Então, assim que a gravação é confirmada, o complemento do título mostra "Quarta · 20:30 · Evangelística".
- **RN-16**
  - Dado Pedro
  - Quando ele abre o detalhe de C1
  - Então vê "Novo relatório", "Editar célula" e "Excluir célula".
  - Então, no celular, "Novo relatório" fica num rodapé fixo, à vista em qualquer ponto da rolagem.
  - Quando ele abre o detalhe de C4, que está inativa
  - Então vê "Editar célula" e "Excluir célula", sem "Novo relatório".
  - Quando ele abre o detalhe de C6, que está "Enviado"
  - Então "Novo relatório" continua (P-SIT-17 do E2.09).
  - Quando ele usa "Novo relatório" no detalhe de C1
  - Então o formulário de relatório abre com C1 já escolhida.
  - Dado Caio
  - Quando ele abre o detalhe de C1 e o de C2
  - Então vê só "Novo relatório" nos dois: ele é o timóteo de C1 e o anfitrião de C2.
  - Quando ele abre o detalhe de C6
  - Então não vê nenhuma ação.
  - Dado Hugo, sem função
  - Quando ele abre o detalhe de C2
  - Então não vê nenhuma ação.
  - Dado Pedro, no detalhe de C6
  - Quando ele exclui C6
  - Então volta para a lista de Células, sem C6. Depois disso, o link do detalhe de C6 mostra "Célula não encontrada.".
- **RN-17**
  - Dado Pedro
  - Quando ele abre o detalhe de C1
  - Então os últimos relatórios são, nesta ordem:
    - R1: quarta, 18/11/2026, às 20:00, célula realizada, tema "A fé que vence", 8 participantes, 2 visitantes, oferta de R$ 50,00 e as observações;
    - R2: quarta, 11/11/2026, às 20:00, "Não houve célula", com o motivo "Chuva forte no bairro";
    - R4: quarta, 28/10/2026, às 20:00, célula realizada, tema "Perdão", 6 participantes, 0 visitantes, oferta de R$ 20,00.
  - Então R3, que foi excluído, não aparece.
  - Então, acima dos relatórios, aparece "As setas comparam com o relatório anterior de célula realizada.". As setas são neutras, e o sentido não depende da cor.
  - Então a comparação mostra:
    - em R1, "maior" nos participantes (8 contra 6, de R4) e nos visitantes (2 contra 0);
    - em R2, nenhuma comparação;
    - em R4, "maior" nos participantes (6 contra 5, de R5) e "menor" nos visitantes (0 contra 1).
  - Então Pedro vê "Editar" e "Excluir" em cada relatório. Caio, no mesmo detalhe, não vê nenhuma das duas.
  - Quando Pedro exclui R1 pelo detalhe
  - Então os últimos relatórios passam a ser R2, R4 e R5.
  - Dado que Rita restaura R3
  - Quando Pedro abre o detalhe de C1
  - Então os últimos relatórios são R1, R2 e R3, e R1 passa a ser comparado com R3: "maior" nos participantes (8 contra 7) e nos visitantes (2 contra 1).
  - Dados C4 e C8, sem nenhum relatório
  - Quando Rita abre o detalhe de cada uma
  - Então vê "Nenhum relatório para mostrar.", sem "Ver todos os relatórios" e sem o gráfico de evolução.
  - Dada uma célula cuja situação é "Enviado · Célula realizada" por um relatório desta semana que quem abre não vê, e que não tem nenhum outro relatório visível (depois do E2.11)
  - Quando essa pessoa abre o detalhe
  - Então vê "Nenhum relatório para mostrar.", o mesmo texto de C4 e de C8, e nada indica o relatório invisível.
  - Dado um relatório de célula realizada sem valor de oferta registrado
  - Então o detalhe mostra "Oferta: Não informada", e não "R$ 0,00".
  - Dado R4 com a oferta alterada para R$ 0,00
  - Então o detalhe mostra "Oferta: R$ 0,00".
  - Dada quarta-feira, 25/11/2026, às 21:30
  - Quando Caio envia, pelo detalhe de C1, o relatório de 25/11 às 20:00
  - Então, assim que o envio é confirmado, o detalhe mostra esse relatório em primeiro lugar, seguido de R1 e R2.
  - Dado um relatório de C2 lançado depois do E2.11 enquanto as pessoas de C2 eram Diego, Hugo e Rita, antes de Caio voltar a ser o anfitrião
  - Quando Pedro abre o detalhe de C2
  - Então esse relatório não aparece nos últimos relatórios nem em "Ver todos os relatórios".
  - Quando Diego abre o detalhe de C2
  - Então o relatório aparece.
- **RN-18**
  - Dados Caio, Pedro e Rita
  - Quando cada um abre o detalhe de C1
  - Então R1 mostra "8" participantes e "2" visitantes, sem nenhum nome, para os três.
  - Dado Pedro, com "Editar Relatórios de Células"
  - Quando ele usa "Editar" em R1
  - Então vê os nomes dos participantes e dos visitantes no formulário do relatório, como hoje.
- **RN-19**
  - Dado Pedro, no detalhe de C1
  - Quando ele usa "Ver todos os relatórios"
  - Então abre a lista de Relatórios com o chip "Célula de André · Quarta · 20:00" acima da lista e "Limpar filtros" ao lado, sem outro filtro, na página 1, com R1, R2, R4 e R5, do mais recente para o mais antigo, e o total 4. O título da tela continua o de Relatórios.
  - Quando ele tira o chip
  - Então vê a lista de todos os relatórios que ele vê.
  - Dada Lia
  - Quando ela abre o mesmo link
  - Então vê o chip "Célula de André · Quarta · 20:00" e os 4 relatórios, mesmo sem ver C1.
  - Dado Diego
  - Quando ele abre o mesmo link
  - Então vê o chip "Célula indisponível", com "Esta célula não está disponível para você.", e a lista vazia.
  - Dada Rita
  - Quando ela abre o link de relatórios da célula C5, que foi excluída
  - Então vê o chip "Célula de Jonas · Sexta · 20:00" e R6, com a indicação "Célula excluída".
  - Dado um link com o id de uma célula que não existe
  - Então a resposta é a mesma do caso de Diego.
  - Dado um link com Célula: "xyz"
  - Então "xyz" sai da URL, e a lista vem sem o filtro Célula.
  - Dada Ester
  - Quando ela abre o detalhe de C8, que não tem relatórios
  - Então não vê "Ver todos os relatórios".
  - Quando ela abre um link de relatórios de C8
  - Então vê o chip "Célula de Ester · Sábado · 16:00" e a lista vazia, com "Nenhum relatório encontrado com estes filtros.".
- **RN-20**
  - Dado Pedro
  - Quando ele abre o detalhe de C1
  - Então o gráfico de evolução tem 4 pontos, em ordem cronológica:
    - 21/10, com 5 participantes e 1 visitante;
    - 28/10, com 6 participantes e 0 visitantes;
    - 11/11, sem valor: as linhas são interrompidas, com o "×" e o item "Não houve célula" na legenda;
    - 18/11, com 8 participantes e 2 visitantes.
  - Então R3, que foi excluído, não aparece no gráfico.
  - Quando ele escolhe a aba "Tabela"
  - Então vê os mesmos 4 relatórios, na mesma ordem, com "Não houve célula" em 11/11.
  - Dado Pedro, no detalhe de C6
  - Então o gráfico tem 1 ponto, o de R9.
  - Dada uma célula com 12 relatórios visíveis
  - Quando Rita abre o detalhe dela
  - Então o gráfico mostra os 10 mais recentes.
- **RN-21**
  - Dada Rita, hoje às 21:00
  - Então o card "Células com relatório pendente" mostra 1, e a lista com Situação do relatório: Pendente mostra C3, com o total 1.
  - Dado Pedro, no mesmo momento
  - Então o card mostra 0, e a lista com o mesmo filtro fica vazia.
  - Dado André, no mesmo momento
  - Então o card e a lista mostram 1 (C3).
  - Dada Rita
  - Então os cards de células por tipo mostram hoje Evangelística 4, Discipulado 2 e Macrocélula 1. A lista com Tipo: Evangelística mostra C1, C2, C4 e C8 (4); com Tipo: Discipulado, C3 e C6 (2); e com Tipo: Macrocélula, C7 (1).
  - Dada Rita, hoje
  - Quando ela aplica o equivalente de "Novas células da semana" (de 22/11/2026 até 28/11/2026)
  - Então vê só C2. C6, cadastrada no sábado anterior, às 23:30, não entra.
  - Dada Rita
  - Então o ranking "Células por G12" mostra o casal Pedro e Paula com 2 células (C1 e C6) e o casal Tiago e Tânia com 2 (C2 e C3). A lista com G12: Pedro e Paula e Situação: Ativa mostra C1 e C6. Com G12: Tiago e Tânia e Situação: Ativa, mostra C2 e C3.

### Textos de tela
Vocabulário de referência. O `ux-designer` pode ajustar o tom, mas não o sentido nem os termos.

- **Termos:** Filtros, Limpar filtros, Líder, G12, Rua, Bairro, Cidade, Tipo, Dia da semana, Situação, Situação do relatório, Nesta semana, Enviado, Ainda não ocorreu, Pendente, Conta a partir da próxima semana, Sem relatório nas semanas anteriores, Cadastrada a partir de, Cadastrada até, Pessoa indisponível, Célula indisponível, Pessoas da célula, Timóteo, Anfitrião, Reunião, Endereço da célula, Últimos relatórios, Ver todos os relatórios, Evolução, Gráfico, Tabela, Célula realizada, Não houve célula, Tema, Motivo, Participantes, Visitantes, Oferta, Observações, Editar célula, Excluir célula, Voltar para Células, Ir para o início.
- **Evitar:**
  - os rótulos provisórios da CEL-05 e os do legado para a situação do relatório: "Em dia", "Relatório em dia", "Pendente nesta semana", "Pendente/Atrasado", "Atrasado", "Sem relatório há N semanas" e "Sem relatório a N semanas" (os termos são os do E2.09);
  - "Nenhum relatório enviado." no detalhe, que pode contradizer o "Enviado" (P-LCE-25);
  - "Editar" e "Excluir" sem objeto nas ações da célula (P-LCE-28);
  - "Status" no lugar de "Situação" (P-HIE-20 do E2.06);
  - "Modalidade" no lugar de "Tipo";
  - "Logradouro" no lugar de "Rua";
  - "Indiferente" no lugar de "Todas";
  - "Discipuladora" no lugar de "Discipulado";
  - "Dados da célula" e "Linha de evolução", do legado;
  - "Cadastrado" para a célula (use "Cadastrada");
  - "Formato: dd/mm/aaaa" ao lado do campo de data (P-FIL-23 do E2.07);
  - "doação" ou "dízimo" no lugar de "oferta";
  - anglicismos.

| Situação | Texto |
|---|---|
| botão do painel | Filtros · com filtros ativos: Filtros (<N>), com N de 1 a 10 (RN-12) · leitor de tela: Filtros (<N> ativos) |
| limpar | Limpar filtros · dentro do painel do celular: Limpar · Aplicar filtros |
| busca | Rótulo: Buscar · Placeholder: Líder, timóteo, anfitrião, rua ou bairro |
| Líder | Rótulo: Líder · Sem escolha: Escolha uma ou mais pessoas · Opção: <Nome> (<nível>) · Busca sem resultado: Nenhum líder de célula encontrado. · Dica: Mostra as células lideradas pelas pessoas escolhidas. |
| G12 | Rótulo: G12 · Sem escolha: Escolha uma ou mais pessoas · Opção: <Nome> · Busca sem resultado: Nenhum G12 encontrado. · Dica: Mostra as células do ministério de cada pessoa escolhida, inclusive as que ela lidera. Para o ministério de um casal, escolha os dois. |
| limite do Líder e do G12 | Escolha até 10 pessoas. |
| pessoa indisponível | Pessoa indisponível · Dica: Esta pessoa não está disponível para você. · com mais de uma: Estas pessoas não estão disponíveis para você. |
| Rua, Bairro e Cidade | Rua · Bairro · Cidade |
| Tipo | Evangelística · Discipulado · Macrocélula |
| Dia da semana | Segunda-feira · Terça-feira · Quarta-feira · Quinta-feira · Sexta-feira · Sábado · Domingo |
| Situação | Todas · Ativa · Inativa |
| Situação do relatório | Rótulo: Situação do relatório · Dica: Células inativas não têm situação do relatório. · subgrupo: Nesta semana · Enviado · Ainda não ocorreu · Pendente · Conta a partir da próxima semana · subgrupo: Sem relatório nas semanas anteriores · Na semana passada · Nas 2 semanas anteriores · Nas 3 semanas anteriores · Nas 4 ou mais semanas anteriores |
| chips da Situação do relatório (texto inteiro) | Situação do relatório: Enviado · … Ainda não ocorreu · … Pendente · … Conta a partir da próxima semana · … Sem relatório na semana passada · … Sem relatório nas 2 semanas anteriores · … Sem relatório nas 3 semanas anteriores · … Sem relatório nas 4 ou mais semanas anteriores |
| múltipla escolha sem nada escolhido | Todos (Tipo, Dia da semana) · Todas (Situação do relatório) |
| datas | Cadastrada a partir de · Cadastrada até · legenda (leitor de tela): Data de cadastro · Dica: Células antigas sem data de cadastro não aparecem quando há filtro de data. |
| data inválida | Data inválida. Use o formato dd/mm/aaaa. |
| intervalo invertido | A data inicial precisa ser igual ou anterior à data final. |
| chips | Líder: <Nome> · Líder: Pessoa indisponível · G12: <Nome> · G12: Pessoa indisponível · Rua: <texto> · Bairro: <texto> · Cidade: <texto> · Tipo: <opção> · Dia: <opção> · Situação: <opção> · Situação do relatório: <opção> · Cadastrada a partir de <dd/mm/aaaa> · Cadastrada até <dd/mm/aaaa> · leitor de tela: Remover filtro <texto do chip> |
| lista vazia com filtros ou com a busca | Nenhuma célula encontrada com estes filtros. · Limpar filtros |
| lista vazia sem filtros nem busca | Nenhuma célula encontrada. |
| erro ao carregar a lista | Não foi possível carregar as células. Verifique a conexão e tente de novo. · Tentar de novo |
| total | <N> células (ou 1 célula), já com os filtros |
| detalhe: título | Célula de <Líder> · complemento (a reunião): <Dia> · <horário> · <Tipo> · ao lado: a situação (Ativa · Inativa, com o ícone de pausa) |
| detalhe: seções | Situação do relatório · Pessoas da célula · Endereço da célula · Últimos relatórios · Evolução |
| detalhe: pessoas | Líder: <Nome> (<nível>) · Timóteo: <Nome> · Anfitrião: <Nome> · G12: <Nome> · Pastores · — (última linha) · pessoa inativa, só para quem a vê: (inativo) · (inativa) |
| detalhe: sem endereço | Sem endereço |
| detalhe: situação do relatório | os textos, os tons e os ícones da lista de Células (E2.09): Enviado · Célula realizada · Enviado · Não houve célula · Ainda não ocorreu · Pendente · Conta a partir da próxima semana · Sem relatório na semana passada · Sem relatório nas {N} semanas anteriores · Sem relatório nas 4 ou mais semanas anteriores · Sem dia da reunião · explicações: as da legenda do E2.09 ("A reunião desta semana ainda não aconteceu. O relatório fica pendente 1 hora depois do horário da célula.", "A reunião desta semana já passou e o relatório não foi enviado.", "A célula foi cadastrada ou reativada depois da reunião desta semana. O relatório só fica pendente a partir da próxima semana.") |
| detalhe: célula inativa | Célula inativa: sem situação do relatório. |
| detalhe: últimos relatórios | Últimos relatórios · As setas comparam com o relatório anterior de célula realizada. · Ver todos os relatórios · sem relatório visível: Nenhum relatório para mostrar. |
| detalhe: cada relatório | <Dia>, <dd/mm/aaaa> às <hh:mm> · Célula realizada · Não houve célula · Tema: <tema> · Motivo: <motivo> · Participantes: <N> · Visitantes: <N> · Oferta: R$ <valor> · sem valor registrado: Oferta: Não informada · Observações: <texto> |
| detalhe: comparação | setas neutras e "=" · leitor de tela: mais que no relatório anterior · menos que no relatório anterior · igual ao relatório anterior |
| detalhe: evolução | Evolução · abas: Gráfico · Tabela · séries: Participantes · Visitantes · ponto sem valor ("×" na legenda): Não houve célula |
| detalhe: célula não encontrada | Célula não encontrada. · Ela não existe, foi excluída ou não está disponível para você. · Voltar para Células · sem a lista de Células: Ir para o início |
| detalhe: voltar | Voltar para Células · sem a lista de Células: Ir para o início |
| detalhe: ações | Novo relatório · Editar célula · Excluir célula (os demais textos são os do E2.01 e do E2.08) |
| erro ao carregar o detalhe | Não foi possível carregar a célula. Verifique a conexão e tente de novo. · Tentar de novo |
| Relatórios: chip da célula | Célula de <Líder> · <Dia> · <hh:mm> · indisponível: Célula indisponível · Dica: Esta célula não está disponível para você. · o título da tela não muda |

Os demais textos da UX (descrições para o leitor de tela, estados de carregamento e as alternativas da T17) estão em Experiência (UX) > Textos e foram aceitos sem ajuste (P-LCE-33).

### Telas afetadas
- **Lista de Células:**
  - o botão "Filtros" com o painel dos 10 filtros, os chips, a contagem, "Limpar filtros", o total filtrado e o vazio com filtros (RN-01 a RN-12). A Situação do relatório tem os dois subgrupos do E2.09 (RN-10);
  - cada célula dá acesso ao detalhe dela: o cartão inteiro até 1023 px e o nome do líder na tabela (RN-14);
  - a ordem não muda, a não ser pelas células com "data não registrada", que vão para o fim (RN-13);
  - a situação do relatório em cada célula e a legenda já vêm do E2.09 e não mudam aqui.
- **Detalhe da célula (tela nova):** RN-14 a RN-20. A situação do relatório usa os mesmos componentes da lista (P70 a P72 do E2.09).
- **Lista de Relatórios:**
  - aceita o filtro Célula pela URL, com o chip acima da lista, "Limpar filtros" e a "Célula indisponível" (RN-19);
  - o título e o resto da tela não mudam.
- **Formulários de célula e de relatório:** passam a abrir também a partir do detalhe (RN-16), sem nenhuma outra mudança.
- **Dashboard:** sem mudança visual. O clique nos cards é do E2.14 (RN-21).
- Membros, Ministérios, Funções, Auditoria e login não mudam.

### Fora de escopo
Cada item indica o passo que cuida dele, quando há um.
- **Situação do relatório (CEL-05):** E2.09. Este passo só a usa no filtro e no detalhe. Fica com o E2.09:
  - o cálculo, os valores e os rótulos;
  - a célula inativa e a célula sem dia, ambas sem situação;
  - o alinhamento do card de pendentes.
- **Situação do relatório em cada célula da lista de Células, com a legenda "Entenda a situação do relatório":** E2.09 (RN-09 e P-SIT-06 de lá). Este passo não muda a lista nesse ponto; só acrescenta o filtro (RN-10).
- **Ordenar a lista pela situação do relatório:** fora. O E2.09 deixou a decisão para este passo. O legado não tinha, e o filtro "Pendente" já reúne as células que precisam de atenção (RN-13; ver Q-6).
- **"Enviado · Célula realizada" e "Enviado · Não houve célula" como opções separadas do filtro:** fora (P-LCE-22). Mostrar as células que deixaram de se reunir é a Q-2 do E2.09.
- **Filtros de Relatórios** (líder, G12, período e atalhos de semana; REL-13): E2.12. Este passo só cria o filtro Célula, aberto pelo detalhe (RN-19). Também é do E2.12 uma consulta do relatório com os nomes dos participantes para todos.
- **Lançamento de relatório** (REL-01 a REL-12 e REL-15), retrato da célula no relatório (REL-09) e participantes automáticos (REL-07): E2.11.
- **Exportação para Excel** (REL-14) e o número da célula ("Célula #") do legado: E2.13.
- **Do Dashboard:** E2.14 (DSH-02 a DSH-05). Este passo só garante os equivalentes (RN-21). Ficam com o E2.14:
  - o clique nos cards;
  - o card "Novas células da semana";
  - a decisão de contar só as células ativas em "células por tipo";
  - o gráfico da semana.
- **Cadastro, edição, situação ativa ou inativa e endereço da célula** (CEL-01 a CEL-04): E2.08.
- **Exclusão, restauração e a lista "Excluídos" de células,** que continua sem filtros: E2.01.
- **Escopo e permissões:** E2.02. **G12 e nível:** E2.06. **Autoria:** E2.05.
- **Filtros por timóteo, anfitrião e estado (UF):** sem passo. O modelo do legado tinha esses campos, mas a tela não. A busca já encontra pelo nome do timóteo e do anfitrião.
- **Filtro de rede** (células lideradas por alguém ou por quem está abaixo dele): fora; ver Q-2.
- **Escolher a ordem da lista, salvar filtros, exportar a lista de Células e mapa das células:** sem passo no plano. O legado não tinha.
- **Nomes dos participantes e dos visitantes no detalhe:** fora (RN-18). O legado não mostrava.
- **Consolidação:** feature futura, com spec próprio.

### Impactos em outros passos
Pontos de negócio que outros passos precisam respeitar. O `architect` decide como.
- **E2.09:**
  - define, num lugar só, os valores, os rótulos e o cálculo da situação do relatório. Esse cálculo é usado pela lista de Células e pelo card (E2.09), e pelo filtro (RN-10) e pelo detalhe (RN-15 f) daqui;
  - o filtro usa as opções do E2.09, e não as do legado que se sobrepõem, que o Impactos de lá deixava como possibilidade ("Relatório em dia"). "Enviado" é uma opção só (P-LCE-22);
  - o detalhe usa os mesmos componentes da lista (P70 a P72 da UX de lá), sem aparência própria;
  - a célula inativa e a sem dia não têm situação, e o filtro nunca as traz;
  - a Q-3 daqui ficou respondida pelo E2.09: a situação aparece em cada célula da lista (P-SIT-06);
  - a ordenação pela situação, que o E2.09 deixou para cá, não entra (Fora de escopo, Q-6).
- **E2.12:**
  - integra o filtro Célula (RN-19) ao painel de filtros de Relatórios: ele conta como filtro ativo, vira chip e sai com "Limpar filtros", e a regra da "Célula indisponível" continua valendo;
  - recomenda-se que cada relatório da lista leve ao detalhe da célula quando quem consulta vê a célula, como o atalho "Dados da célula" do legado (`UI/pages/Report/index.js:102`);
  - decide se haverá uma consulta do relatório com os nomes dos participantes e dos visitantes para todos que veem o relatório (RN-18);
  - recomenda-se usar os mesmos padrões deste spec e do E2.07: Líder e G12 por seletor, pessoa indisponível e G12 por pessoa (RN-04 a RN-06).
- **E2.11:**
  - o "Novo relatório" do detalhe usa o mesmo lançamento da lista (RN-16);
  - o número de participantes passa a incluir o líder, o timóteo e o anfitrião (REL-07);
  - a visibilidade dos relatórios no detalhe passa a seguir o retrato da célula (REL-09, RN-04 do E2.02).
- **E2.14:**
  - liga o clique dos cards de células à lista com os equivalentes da RN-21, pela URL (RN-12). O card de pendentes abre a lista com Situação do relatório: Pendente, como o E2.09 já previa;
  - se mudar a definição de algum card (por exemplo, "células por tipo" só com as ativas), atualiza a linha da RN-21 no mesmo passo;
  - decide se o ranking "Células por G12" abre a lista.
- **E2.01:**
  - o detalhe de uma célula excluída não abre (RN-14);
  - a lista "Excluídos" de células continua sem filtros;
  - o endereço do detalhe não pode colidir com o da lista de excluídos (`/cells/deleted`, UXD-1 de lá).
- **E2.05:** a autoria da célula passa a aparecer também no detalhe, como a RN-07 de lá já previa.
- **E2.06:** as "Definições" deixadas para o E2.10 ficam respondidas. O G12 da célula segue a RN-11 de lá, é por pessoa e inclui a célula do próprio G12 (RN-05).
- **E2.08:** o "Novo relatório" também some no detalhe da célula inativa (RN-16), e o formulário de célula também abre a partir do detalhe.
- **E1.08:** a ordem das células da RN-03 de lá passa a deixar a "data não registrada" por último (RN-13), como na DT-03 do E2.05. O texto do E1.08 fica como histórico.
- **E5.04 (homologação):** os números das listas filtradas no novo e no legado não batem, e isso é esperado:
  - o filtro G12 do novo inclui a célula do próprio G12, que o legado deixava de fora;
  - os filtros de texto do novo ignoram acentos;
  - a lista do novo tem células inativas;
  - o detalhe do novo mostra 3 relatórios, e o legado mostrava até 10;
  - as opções da Situação do relatório não se sobrepõem como as do legado. O "Relatório em dia" do legado corresponde a Enviado, Ainda não ocorreu e Conta a partir da próxima semana. As semanas anteriores contam semanas sem relatório, e não a data do último relatório, e seguem o prazo e as semanas que contam do E2.09.
- **Consolidação:** quando existir, o consolidado só aparece nas pessoas da célula se o spec da Consolidação permitir (Q-6 do E2.08).
- **Aceite (PO):**
  - no `docs/migracao.md`: CEL-06 e CEL-07 em ✅, e o E2.10 marcado na seção Progresso;
  - no `CLAUDE.md`: a linha "Filtros de células" da matriz de paridade em ✅. A linha "Situação do relatório por célula" é do E2.09.

### Pontos para o `architect`
Não são dúvidas de negócio. São pontos em que a regra depende de uma escolha técnica.
1. **Seletores de Líder e G12** (RN-04 a RN-06).
   - As opções vêm das células visíveis, como nomes de referência.
   - O G12 das células que a pessoa não vê e a cadeia de liderança não podem sair do servidor (RN-23 do E2.02).
   - A pessoa que vem da URL é resolvida como nome ou como "Pessoa indisponível", sem revelar nada além do que a lista já mostra.
2. **G12 da célula** (RN-05). Vem do E2.06 (`g12_id`, já indexado). A célula do próprio G12 entra, e as células de pastor e de quem está sem liderança não têm G12.
3. **Situação do relatório** (RN-10, RN-15 f, RN-21).
   - É um cálculo só, do E2.09, usado pela lista, pelo detalhe e pelo card, com o "agora" no horário de Brasília.
   - O filtro combina, com OU, a situação da semana ("Enviado" cobre os dois detalhes) e o valor exato da contagem de semanas anteriores (1, 2, 3 ou 4 ou mais). Os dois precisam ser filtráveis e paginados no servidor (ponto 5 do E2.09).
   - A situação muda com o tempo, então a paginação precisa aceitar que uma célula mude de opção entre duas páginas.
4. **Relatórios visíveis no detalhe** (RN-17, RN-19, RN-20).
   - Seguem a RN-04 do E2.02 (o retrato do E2.11, depois dele), e não a visibilidade da célula.
   - A situação do relatório usa todos os relatórios da célula, visíveis ou não.
5. **Filtro Célula em Relatórios** (RN-19).
   - A identificação da célula só sai do servidor quando quem consulta vê a célula ou um relatório dela.
   - A célula excluída que tem relatórios visíveis é identificada.
6. **Comparação e evolução** (RN-17, RN-20). Precisam dos números de até 10 relatórios e do relatório de célula realizada anterior ao mais antigo exibido, sem os nomes.
7. **Desempenho** (RN-02, RN-14). A meta é de 2 s com 1.500 células e 100 mil relatórios, com qualquer combinação de filtros. O que mais pesa:
   - texto sem acento em rua, bairro e cidade;
   - o G12;
   - a data de cadastro em Brasília;
   - a situação do relatório.
8. **Ordem** (RN-13). Cadastro mais recente primeiro, "data não registrada" por último e desempate estável.
9. **Endereço do detalhe** (RN-14).
   - Precisa ser próprio, sem colidir com `/cells/deleted` (UXD-1 do E2.01).
   - A célula invisível, a excluída e a inexistente têm a mesma resposta.
10. **Ordem dos passos.**
    - Este passo usa: E2.01 e E2.02; a data de cadastro e a autoria do E2.05; o G12 e o nível do E2.06; a situação ativa ou inativa do E2.08; e a situação do relatório do E2.09.
    - Se o E2.09 atrasar, o filtro "Situação do relatório" e a situação no detalhe podem ir num PR separado, depois dele, sem mudar as outras regras.
11. **Oferta sem valor** (RN-17, P-LCE-31). Depende de a oferta poder ficar vazia no banco (AQ-6 da UX). Se não puder, "Não informada" nunca aparece, e a regra continua valendo.

### Perguntas em aberto
Nenhuma pergunta bloqueia a implementação. Cada uma já tem um padrão adotado, que vale se o usuário não decidir outra coisa no PR. A Q-3 foi respondida pelo E2.09.

As pendências da UX (PO-UX-1 a PO-UX-12) foram resolvidas em 2026-11-24 e viraram os padrões P-LCE-22 a P-LCE-33. Os que mais mudam o resultado são:
- **P-LCE-22:** as opções da Situação do relatório são as do E2.09, e "Enviado" é uma opção só;
- **P-LCE-25:** "Nenhum relatório para mostrar." no lugar de "Nenhum relatório enviado.";
- **P-LCE-27:** os atalhos "Dados da célula" e "Ver relatórios" do legado não voltam em cada linha.

- **Q-1. Quantos relatórios o detalhe mostra?**
  - **Padrão adotado:** 3, como o plano (CEL-07), com "Ver todos os relatórios" (RN-17, P-LCE-12).
  - **Alternativa:** até 10, como a tela do legado (`UI/pages/Cells/details.js:61`). A evolução usa 10 nos dois casos.
- **Q-2. Filtro de rede.**
  - **Padrão adotado:** não existe. É a paridade: o legado filtrava só pelo líder da célula e pelo G12 (RN-04).
  - **Alternativa:** um filtro "Liderança", com as células lideradas por uma pessoa ou por qualquer um abaixo dela. É a mesma conta do total de células do E2.06 (RN-06 de lá). Esse filtro permitiria abrir a lista de Células a partir do total de células em Membros e em Ministérios.
- **Q-3. Situação do relatório na lista.** **Respondida pelo E2.09:** a situação aparece em cada célula da lista, com a legenda (RN-09 e P-SIT-06 de lá). A revisão dessa decisão fica no PR do E2.09. Aqui, a mesma situação aparece também no filtro (RN-10) e no detalhe (RN-15 f).
- **Q-4. Situação padrão do filtro.**
  - **Padrão adotado:** "Todas", que mantém a lista de hoje (RN-09).
  - **Alternativa:** "Ativa". Assim, as células que pararam de se reunir só apareceriam quando pedidas.
- **Q-5. G12 por casal.**
  - **Padrão adotado:** por pessoa, como na Liderança do E2.07 (Q-4 de lá). Para o ministério do casal, escolhem-se os dois (RN-05).
  - **Alternativa:** escolher um G12 traz também as células do ministério do cônjuge.
- **Q-6. Ordem padrão da lista.**
  - **Padrão adotado:** da célula cadastrada mais recentemente para a mais antiga, como no E1.08 (RN-13).
  - **Alternativa:** pelo G12 e depois pelo líder, como a exportação do legado. Ajuda a ver as células de cada ministério juntas.
  - **Outra alternativa:** pela situação do relatório, com as pendentes primeiro. O E2.09 deixou essa decisão para cá; o padrão é não ordenar pela situação, porque o filtro "Pendente" já reúne essas células.
- **Q-7. Evolução e comparação.**
  - **Padrão adotado:** as duas voltam, como no legado (RN-17, RN-20).
  - **Alternativa:** deixar as duas de fora e mostrar só os números de cada relatório.

## Experiência (UX)
_Seção do `ux-designer`. Escrita em 2026-11-24 a partir destas fontes:_
- _a seção Negócio (RN-01 a RN-21, P-LCE-01 a P-LCE-21, a massa de exemplo, os Textos de tela, os Impactos, os Pontos para o `architect` e as perguntas Q-1 a Q-7);_
- _o código da `origin/main` do `mci-connect` (`4595daa`): `src/App.tsx`, `src/pages/Cells.tsx`, `src/pages/CellReports.tsx`, `src/lib/cells/labels.ts`, `src/lib/cells/weekdays.ts`, `src/lib/format.ts`, `src/index.css` e `src/components/ui/chart.tsx` (o Recharts já está instalado);_
- _o que já foi desenhado para as mesmas telas: os filtros de Membros do [E2.07](e2-07-filtros-membros.md) (T1 a T6 e P50 a P54), a lista de Células do [E2.08](e2-08-cadastro-celulas.md) (T7, P63 e P65) e do [E2.06](e2-06-hierarquia-totais.md) (T2, P40, P44 e P45), a autoria e o histórico do [E2.05](e2-05-auditoria-autor.md) (T1, T9, P30 e P31), as ações, as confirmações e os excluídos do [E2.01](e2-01-exclusao-logica.md) (T1, T2, T7, P7 e P8) e o alcance e a tela sem acesso do [E2.02](e2-02-perfis-escopo.md) (P10 e T12);_
- _o Negócio do [E2.09](e2-09-situacao-relatorio.md), ainda em escrita e sem a seção de UX, só lido: os valores da situação do relatório, as explicações de cada um e a decisão de mostrá-la na lista (P-SIT-06);_
- _o legado, só para manter o que os usuários conhecem: a ordem dos filtros, o detalhe com os últimos relatórios (data e hora, tema ou "Não houve célula.", observações, oferta, participantes e visitantes com a seta de comparação) e a "Linha de evolução" em linhas (`UI/pages/Cells/index.js` e `UI/pages/Cells/details.js`)._

_Este passo só é implementado depois do E2.01, do E2.02, do E2.05, do E2.06, do E2.08 e do E2.09, então o desenho parte das telas deles, e não do código de hoje. Usa os padrões P1 a P65. Os padrões novos começam em P80, para não colidir com os outros specs. Nenhuma regra de negócio foi criada aqui. Onde a tela precisou de algo que o spec não diz, a decisão é a mais conservadora, marcada como "definido pela UX" e listada em "Pendências para o PO". Os nomes são os da [massa de exemplo](#massa-de-exemplo); os sobrenomes existem só nos wireframes, como no E2.06 e no E2.07._

### O que muda, tela a tela
Uma tela nova, o detalhe da célula, numa rota nova (`/cells/:id`).

| Tela | O que muda | Para quem |
|---|---|---|
| Células: lista (T1, T7) | A busca ganha o rótulo "Buscar". Entram "Filtros ({N})", os chips, "Limpar filtros" e o total em texto ("3 células"). Cada célula abre o detalhe: o cartão inteiro até 1023 px; o nome do líder na tabela. As células com "data não registrada" vão para o fim. Carregando com `Skeleton`, vazio com filtros e erro com "Tentar de novo". | quem tem a lista de Células |
| Painel de filtros (T2 a T6) | Os 10 filtros, no `Sheet` abaixo de 1024 px e no painel recolhível a partir daí, como em Membros (P50). "Pessoa indisponível" no Líder e no G12. A Situação do relatório com os valores do E2.09, em dois subgrupos (P85). | idem |
| Detalhe da célula (T8 a T14), novo | Tela própria, com: a identificação e a situação; a autoria; a situação do relatório; as pessoas e o G12; o endereço; os 3 últimos relatórios com a comparação; "Ver todos os relatórios"; e a evolução, em gráfico e em tabela. Tem as ações da lista, com "Novo relatório" num rodapé fixo no celular. Tudo que não abre mostra "Célula não encontrada.". | quem vê a célula, mesmo sem a lista de Células |
| Formulários de célula e de relatório, confirmações de exclusão (T14) | Abrem também a partir do detalhe, sem mudar. | quem tem as permissões |
| Relatórios: lista (T15) | O filtro Célula, vindo da URL: o chip, "Limpar filtros", a "Célula indisponível" e o vazio com filtros. O resto não muda até o E2.12. | quem vê relatórios |
| Dashboard (T16) | Sem mudança visual. | — |

### Coerência com os outros specs
- **E1.08:** `useListSearchParams`, `ListPagination`, `useClampPage` e `placeholderData` continuam. Os filtros entram na mesma URL, com as regras de lá: os valores padrão ficam fora da URL, a troca é com `replace` e mudar um filtro volta para a página 1.
- **E2.07:** a lista segue o P50 a P54 sem variação. Isso inclui o `Sheet` abaixo de 1024 px com "Aplicar filtros", o painel recolhível a partir daí, os chips, a contagem, "Limpar filtros" ao lado de "Filtros", o foco inicial no título do `Sheet` (UXD-15 de lá), o seletor de pessoas com limite e a "Pessoa indisponível". O painel lembra se ficou aberto numa chave própria de Células. Mudam três coisas:
  - as opções do Líder e do G12 vêm das células visíveis, e não da `members_view`. Por isso, a busca sem resultado tem textos próprios (UXD-2);
  - as datas usam o feminino ("Cadastrada"), como pede o Negócio;
  - a Situação do relatório tem subgrupos (P85).
- **E2.08 (T7):** os cartões e a tabela continuam com os badges do P6, com "Novo relatório" só na célula ativa e com as ações no mesmo lugar (P65).
  - O dia aparece na forma curta ("Quarta") na lista e no detalhe, e por extenso ("Quarta-feira") nas opções do filtro, como no seletor do formulário (UXD-4 de lá).
  - "(inativo)" e "(inativa)" seguem o P63: só para quem vê a pessoa.
- **E2.06:** valem o líder com o nível entre parênteses (P40), o G12 com um nome só, "Pastores" ou "—", e os cartões até 1023 px (P45). Depois de uma gravação feita no detalhe, vale o P44.
- **E2.05:** a autoria fica no topo do detalhe, com "Ver histórico" (P30 e P31), como o P30 já previa para esta tela.
- **E2.01:**
  - a lista "Excluídas" (`/cells/deleted`, P7) não muda e não colide com o detalhe ([Navegação e rotas](#navegação-e-rotas));
  - no celular, "Excluir célula" fica no "⋯" (P8), com a confirmação da T2 de lá, inclusive "Marcar como inativa";
  - em Relatórios, as linhas de célula excluída continuam com o badge "Célula excluída" e o "Ver relatório" (T7 de lá).
- **E2.02:**
  - o subtítulo com o alcance (P10) não muda;
  - `/cells` continua com a tela sem acesso da T12 de lá para quem não tem a lista. Já o detalhe (`/cells/:id`) abre para quem vê a célula, mesmo sem a lista, como Hugo;
  - "Novo relatório" segue no detalhe a mesma regra da lista (`can_submit_report`).
- **E2.09:**
  - a situação do relatório tem uma aparência só, no cartão, na tabela, no detalhe e nos chips;
  - o E2.09 ainda não tem a seção de UX. Por isso, este spec descreve uma aparência provisória (T10) e pede um componente comum (AQ-4). Se o E2.09 definir outra, vale a dele, sem mudar o resto.
- **E2.11:** o formulário de relatório aberto pelo detalhe é o mesmo da lista, com a célula já escolhida e travada.
- **E2.12:** integra o filtro Célula ao painel de Relatórios (P84) e pode reaproveitar o cartão de relatório do detalhe (T11).
- **E2.14:** o clique de cada card de células abre `/cells` com os links prontos da [Navegação e rotas](#navegação-e-rotas).

### Decisões de experiência
| # | Decisão | Por quê |
|---|---|---|
| UXD-1 | **Os filtros seguem o P50 a P54, na ordem da RN-01:** Líder, G12, Rua, Bairro, Cidade, Tipo, Dia da semana, Situação, Situação do relatório e as datas de cadastro. A ordem é a mesma no `Sheet`, no painel e no DOM. | É a ordem do legado. A Situação vem antes da Situação do relatório, porque a célula inativa não tem situação do relatório. Com o mesmo painel em Membros e em Células, quem aprende um usa o outro. |
| UXD-2 | **Líder e G12 só oferecem quem lidera ou é o G12 de uma célula visível. No Líder, a opção traz o nível ("André Souza (144)"). A busca sem resultado diz "Nenhum líder de célula encontrado." ou "Nenhum G12 encontrado.".** *Definido pela UX (PO-UX-5).* | As opções incluem nomes de referência que a pessoa não vê como membro (Diego, para Pedro), e o texto do P11 ("Nenhum membro do seu ministério encontrado.") seria falso. O nível é o mesmo que a linha da célula já mostra e ajuda a separar homônimos. No G12, todos têm o mesmo nível. |
| UXD-3 | **A Situação do relatório oferece os mesmos valores que a tela mostra (E2.09), em dois subgrupos: "Nesta semana" e "Sem relatório nas semanas anteriores" (P85).** *Definido pela UX (PO-UX-1).* | O líder vê "Pendente" no cartão e procura "Pendente" no filtro. Uma opção que não aparece em lugar nenhum, como o "Relatório em dia" do legado, obriga a decorar o que ela junta. Os subgrupos separam as duas informações do E2.09 e encurtam as opções ("Na semana passada"), sem mudar o chip, que leva o texto inteiro. |
| UXD-4 | **Até 1023 px, o cartão inteiro abre o detalhe. Na tabela, o nome do líder é o link, e o clique na linha é um atalho do mouse (P81). Os ícones "Dados da célula" e "Ver relatórios" do legado não voltam.** *Definido pela UX (PO-UX-6).* | No celular, o cabeçalho do cartão já tem até três botões de 44 px, e um quarto apertaria o nome do líder. Tocar no cartão é o gesto que as pessoas já fazem nas listas do celular. "Ver todos os relatórios" fica a um toque, no detalhe. |
| UXD-5 | **O detalhe é uma página (P80): "Voltar para Células", o título "Célula de {Líder}" com a reunião como complemento e a situação ao lado, a autoria (P30) e as seções, cada uma com `h2`.** O grupo "Reunião" do Negócio é o complemento do título, e o G12 é a última linha de "Pessoas da célula". *Definido pela UX (PO-UX-2).* | Repetir dia, horário e tipo num grupo logo abaixo do título custaria quatro linhas no celular, sem informação nova. O G12 fica junto do líder, como no cartão da lista. |
| UXD-6 | **No celular (abaixo de 768 px), "Novo relatório" fica num rodapé fixo, "Editar célula" fica visível no cabeçalho, e "Excluir célula" vai para o "⋯". A partir de 768 px, as três ficam no cabeçalho, com texto.** As ações da célula levam o objeto: "Editar célula" e "Excluir célula". *Definido pela UX (PO-UX-7).* | O detalhe é longo, com relatórios e gráfico. O líder que vê "Pendente" precisa da ação à mão, na zona do polegar, em qualquer ponto da rolagem. A mesma tela tem o "Editar" e o "Excluir" de cada relatório: sem o objeto, "Editar" seria ambíguo. |
| UXD-7 | **A situação do relatório vem logo depois da autoria, com a explicação do E2.09 embaixo do valor.** | É o que o líder e o G12 abrem a célula para saber. A explicação diz o que "Ainda não ocorreu" e "Conta a partir da próxima semana" querem dizer, sem depender de tooltip. |
| UXD-8 | **Os últimos relatórios aparecem em cartões até 1023 px e numa tabela a partir de 1024 px, com as colunas do legado. A comparação é uma seta neutra depois do número, com o sentido em texto para o leitor de tela, e uma frase explica as setas (P82).** *Definido pela UX (PO-UX-8).* | A tabela alinha os números e facilita comparar as semanas, como no legado. No celular, ela rolaria na horizontal. As setas verde e vermelha do legado ficariam abaixo de 3:1 com o token `success` e com o `destructive` do tema escuro, e o sentido não pode depender da cor. A frase explica por que R4 é comparado com um relatório que não aparece (R5). |
| UXD-9 | **A evolução é um gráfico de linhas, como a "Linha de evolução" do legado, com as abas "Gráfico" e "Tabela" (P83).** As séries se distinguem pela cor do token, pelo traço (contínuo e tracejado) e pelo marcador (círculo e quadrado). "Não houve célula" é um intervalo nas linhas, com o marcador "×" numa linha vertical, explicado na legenda. *Definido pela UX (PO-UX-9).* | Os líderes conhecem o gráfico de linhas. Linhas mostram a tendência melhor que barras agrupadas, que teriam 11 px de largura em 360 px. A tabela dá os mesmos números a quem usa leitor de tela, a quem não enxerga bem o gráfico e a quem prefere ler. O intervalo deixa claro que o ponto não é zero (RN-20). |
| UXD-10 | **"Voltar para Células" leva à lista com os filtros, a busca e a página de antes, e a lista volta à célula aberta, com o foco nela. Para quem não tem a lista de Células (Hugo, Lia), o link é "Ir para o início".** *Definido pela UX (PO-UX-3).* | RN-14. Numa lista longa no celular, voltar ao topo obrigaria a rolar de novo até onde a pessoa estava. Para Hugo e Lia, "Voltar para Células" levaria à tela sem acesso (T12 do E2.02). |
| UXD-11 | **"Célula não encontrada" é uma tela só, com esse `h1`, para a célula invisível, a excluída, a inexistente e o id sem formato.** O id sem formato nem chega ao servidor. | RN-14: as quatro respostas são iguais, e nada da célula pode aparecer. O `h1` diz onde a pessoa está, como na tela sem acesso. |
| UXD-12 | **Aberto pela lista, o detalhe aparece na hora com os dados que a lista já tem. O resto carrega com `Skeleton` no formato de cada seção.** | Num 3G fraco, a pessoa vê o título e a situação enquanto os relatórios chegam, em vez de uma tela vazia. |
| UXD-13 | **Em Relatórios, o filtro Célula é um chip acima da lista, com "Limpar filtros" ao lado, até o E2.12 trazer o painel (P84). O título da tela não muda.** *Definido pela UX (PO-UX-11).* | RN-19. A lista de Relatórios ainda não tem painel. O chip diz de qual célula são os relatórios, como o título "Relatórios da célula" do legado, e sai com um toque. Um título que muda com o filtro deixaria de bater com o menu quando o E2.12 trouxer outros filtros. |

### Navegação e rotas
- **Rota nova:** `/cells/:id`, o detalhe, com login. O `:id` é o UUID da célula.
  - `/cells/deleted` (E2.01) continua sendo a lista de excluídas. No React Router 6, o segmento fixo ganha do dinâmico, e um UUID nunca é "deleted" (AQ-7).
  - Um `:id` sem o formato de UUID mostra "Célula não encontrada." sem consultar o servidor (UXD-11).
  - No detalhe, o item "Células" do menu fica ativo, pela regra `pathname.startsWith(path + "/")` do E2.01.
  - A tela sem acesso da T12 do E2.02 vale para `/cells`, e não para `/cells/:id`. Quem abre o detalhe é decidido pela visibilidade da célula (RN-14).
- **Entrada no detalhe:** o cartão ou o nome do líder na lista (P81). Também por link: compartilhado, da Auditoria ou, no E2.12, da lista de Relatórios.
- **Saída:**
  - "Voltar para Células" leva à URL da lista guardada no estado da navegação, com os filtros, a busca, a página e o tamanho. Aberto por link, leva a `/cells`;
  - o voltar do navegador e o do aparelho fazem o mesmo, pelo histórico;
  - nos dois casos, a lista rola até a célula aberta e põe o foco no link dela, quando ela está na página (AQ-8);
  - para quem não tem a lista: "Ir para o início" (`/`).
- **Relatórios da célula:** `/cell-reports?cell=<id>` (RN-19).
  - O parâmetro convive com o `?report=` do E2.01.
  - Um valor sem formato de UUID sai da URL.
  - "Limpar filtros" tira `cell`, `q` e `page` e mantém `size`.
- **Filtros de Células na URL.** Os nomes são sugestões (AQ-1):

  | Filtro | Parâmetro | Valores |
  |---|---|---|
  | Líder | `leaders` | até 10 ids, separados por vírgula, na ordem da escolha |
  | G12 | `g12` | até 10 ids, separados por vírgula, na ordem da escolha |
  | Rua | `street` | texto, até 100 caracteres |
  | Bairro | `neighborhood` | texto, até 100 caracteres |
  | Cidade | `city` | texto, até 100 caracteres |
  | Tipo | `type` | `evangelistic`, `discipleship` e `macrocell`, separados por vírgula |
  | Dia da semana | `day` | `mon` a `sun`, separados por vírgula |
  | Situação | `status` | `active` ou `inactive` |
  | Situação do relatório | `report_status` | `sent`, `not_yet`, `pending`, `next_week`, `missed_1`, `missed_2`, `missed_3` e `missed_4plus`, separados por vírgula (PO-UX-1) |
  | Cadastrada a partir de / até | `from` / `to` | `aaaa-mm-dd`, datas de Brasília |

  - Os valores padrão, repetidos e inválidos seguem a Navegação e rotas do E2.07:
    - "Todas", "Todos" e vazio não aparecem;
    - nos filtros de múltipla escolha, a ordem é a das opções, menos em `leaders` e `g12`, que guardam a ordem da escolha;
    - um valor inválido sai na primeira leitura e não conta como filtro ativo;
    - um id com formato válido de uma pessoa que não se vê fica na URL e aparece como "Pessoa indisponível";
    - acima de 10 ids, valem os 10 primeiros.
  - O painel aberto ou fechado (computador) fica no `localStorage`, numa chave de Células, separada da de Membros.
- **Links prontos (RN-21, para o E2.14):**
  - Células com relatório pendente: `/cells?report_status=pending`;
  - Células por tipo: `/cells?type=evangelistic` (e `discipleship` e `macrocell`). Se o E2.14 contar só as ativas, mais `&status=active`;
  - Novas células da semana: `/cells?from=2026-11-22&to=2026-11-28`, do domingo ao sábado da semana atual;
  - Células por G12 (um casal do ranking): `/cells?g12=<id>,<id>&status=active`.

### Fluxos
Contagem no celular, a partir de qualquer tela com o menu fechado, incluindo o toque no ☰, salvo quando a linha diz outra coisa. "Toque" não conta a digitação. Num seletor, abrir e escolher são 2 toques.

| # | História | Caminho | Toques e telas |
|---|---|---|---|
| F1 | A liderança encontra as células com relatório pendente (André) | ☰ → Células → "Filtros" → Situação do relatório "Pendente" → "Aplicar filtros" → C3 | 5 toques; 1 tela e 1 painel. Hoje não existe. |
| F2 | O G12 vê as células do casal (Pedro) | ☰ → Células → "Filtros" → G12 → Pedro Alves → Paula Alves → "Aplicar filtros" | 7 toques. O menu do seletor fica aberto entre as escolhas. |
| F3 | A secretaria procura uma célula perto de quem chegou (Rita, computador) | Células → "Filtros" (se o painel estiver fechado) → Bairro (digita) → Cidade (digita), com a lista mudando a cada campo → clique na célula → endereço completo no detalhe | 3 cliques e a digitação |
| F4 | O líder abre a célula e confere a situação e os relatórios (Pedro) | ☰ → Células → toque no cartão de C1 → detalhe | 3 toques. Hoje não existe: os relatórios só aparecem buscando o líder em Relatórios. |
| F5 | O líder lança o relatório pelo detalhe (Caio) | F4 → "Novo relatório" (rodapé fixo) → preenche → "Salvar relatório" (E2.11) → o detalhe mostra o relatório em primeiro e a situação "Enviado" | F4, mais 2 toques e o preenchimento. Pela lista, continuam 3 toques até o formulário. |
| F6 | Ver todos os relatórios da célula | detalhe → "Ver todos os relatórios" → Relatórios, com o chip da célula | 1 toque. Hoje: ☰ → Relatórios → busca pelo líder, com as células dele misturadas. |
| F7 | Voltar à lista filtrada | "Voltar para Células", ou o voltar do aparelho → a lista com os filtros e a página de antes, na célula aberta | 1 toque |
| F8 | Tirar um filtro, ou todos | "✕" no chip, ou "Limpar filtros" | 1 toque |
| F9 | Abrir uma lista filtrada por um link (compartilhado, ou o card do Dashboard no E2.14) | toque no link → a lista com os chips e o total | 1 toque |
| F10 | Link com uma pessoa que quem abre não vê (Pedro, com G12: Tânia) | link → "G12: Pessoa indisponível", a dica e a lista vazia → "✕" ou "Limpar filtros" | 2 toques |
| F11 | Editar a célula pelo detalhe (Pedro) | "Editar célula" → altera → "Salvar alterações" → o detalhe mostra o valor novo | 2 toques e a alteração |
| F12 | Excluir a célula pelo detalhe (Pedro, C6) | "⋯" → "Excluir célula" → "Excluir célula" → a lista, sem C6 | 3 toques |
| F13 | Excluir um relatório pelo detalhe (Pedro, R1) | "⋯" do relatório → "Excluir relatório" → "Excluir relatório" → o detalhe, sem R1 | 3 toques |
| F14 | Abrir o link de uma célula que não vê (Diego, C1) | link → "Célula não encontrada" → "Voltar para Células" | 1 toque |
| F15 | Quem só vê relatórios usa o link dos relatórios da célula (Lia) | link → Relatórios, com o chip "Célula de André Souza · Quarta · 20:00" | 1 toque |

### Telas
As convenções dos wireframes são as do E2.04 ao E2.08:
- 360 px ≈ 38 colunas;
- `[Botão]` é botão, e `[▾]` é seleção;
- `( )` e `(•)` são as opções de escolha única, e `[ ]` e `[x]` são caixas de seleção;
- `(… ✕)` é um chip removível ou uma pessoa escolhida;
- `(i)` é informação, e `⚠` é erro;
- `⌕` é o ícone `Search`, `⚲` é o `SlidersHorizontal`, e `⌄` e `⌃` são o painel fechado e aberto;
- `[▤+]` é "Novo relatório", `[✎]` é "Editar", `[⋯]` é o menu de ações, `[⌫]` é "Excluir" na tabela, e `⏸` é o ícone `PauseCircle`.

Novos:
- `›` é o ícone `ChevronRight`, e `←` é o `ArrowLeft`;
- `↑`, `↓` e `=` são os ícones `ArrowUp`, `ArrowDown` e `Equal`;
- `●` e `■` são os marcadores das séries do gráfico, e `×` é o marcador de "Não houve célula";
- nos badges: `✓` é o ícone `CheckCircle2`, `⊘` é o `CalendarX`, `◷` é o `Clock` (ou o `CalendarClock`) e `△` é o `AlertTriangle`; `⟲` é o `History`, de "Ver histórico";
- `═` é a borda do rodapé fixo, e `▒` é um `Skeleton`.

A margem lateral é a do `AppLayout` (`p-4`). "Hoje" é terça, 24/11/2026, às 21:00, como no Negócio.

#### T1. Células: lista com filtros aplicados
Cartões (até 1023 px, P45), com Pedro, depois de escolher Tipo: Evangelística (critério da RN-03). A busca, os filtros e a lista ficam dentro do `Card` da lista, como hoje. A ordem é a da RN-13: C2, C4 e C1.
```
┌──────────────────────────────────────┐
│ ☰                                    │
│ Células                              │  h1
│ Células do seu ministério            │  subtítulo (P10)
│ [+ Nova célula                     ] │  E2.08
│──────────────────────────────────────│
│ Buscar                               │
│ [⌕ Líder, timóteo, anfitrião, rua o] │  h-11; o placeholder é cortado,
│ [⚲ Filtros (1)] [Limpar filtros]     │  o rótulo não
│ (Tipo: Evangelística ✕)              │  chip, h-9
│ 3 células                            │  role="status"
│──────────────────────────────────────│
│ Diego Reis (144)     [▤+] [✎]  [⋯]   │  C2. O cartão inteiro abre o
│ G12: Tiago Rocha                     │  detalhe (P81); as ações ficam
│ Timóteo: Hugo Melo                   │  por cima do link
│ Anfitrião: Caio Lima                 │
│ [Evangelística] [Ativa]              │
│ Quinta · 20:00                       │
│ Relatório: Ainda não ocorreu         │  linha do E2.09
│ Av. São João, 45 — São João        › │  ChevronRight, aria-hidden
├──────────────────────────────────────┤
│ Gabriel Costa             [✎]  [⋯]   │  C4, inativa: sem "Novo
│ (20.736)                             │  relatório" (P65)
│ G12: Pedro Alves                     │
│ Timóteo: Jonas Prado                 │
│ Anfitrião: Fábio Lima                │
│ [Evangelística] [⏸ Inativa]          │  sem a linha "Relatório"
│ Sábado · 10:00                       │
│ Rua Brasil, 500 — Centro           › │
├──────────────────────────────────────┤
│ André Souza (144)    [▤+] [✎]  [⋯]   │  C1
│ G12: Pedro Alves                     │
│ …                                  › │
│──────────────────────────────────────│
│ 3 células                            │  ListPagination (E1.08)
│ [25▾] por página                     │
│ [«][‹] Página 1 de 1 [›][»]          │
└──────────────────────────────────────┘
```
Computador (a partir de 1024 px), com Rita, sem filtros e com o painel fechado. As colunas são as do E2.08 (T7), com a "Relatório" do E2.09; Tipo e Dia / Hora, entre Endereço e Situação, foram omitidas no desenho:
```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Células                                                          [Excluídas] [+ Nova célula] │
│ Células de toda a igreja                                                                     │
│──────────────────────────────────────────────────────────────────────────────────────────────│
│ Buscar                                                                                       │
│ [⌕ Líder, timóteo, anfitrião, rua ou bairro]  [⚲ Filtros ⌄]                                  │
│ 7 células                                                                                    │  role="status"
│ Líder                 │ G12         │ Endereço         │ Situação │ Relatório │ Ações        │
│ Diego Reis (144)      │ Tiago Rocha │ Av. São João, 45 │ Ativa    │ (E2.09)   │ [▤+] [✎] [⌫] │
│ Timóteo: Hugo Melo    │             │ São João         │          │           │              │
│ Anfitrião: Caio Lima  │             │                  │          │           │              │
│ Paula Alves (G12)     │ Paula Alves │ —                │ Ativa    │ (E2.09)   │ [▤+] [✎] [⌫] │
│ …                     │             │                  │          │           │              │
│ Débora Lins (1.728)   │ Tânia Rocha │ Rua Sao Joao, 12 │ Ativa    │ (E2.09)   │ [▤+] [✎] [⌫] │  C3, "data não registrada",
│ …                     │             │                  │          │           │              │  por último
│──────────────────────────────────────────────────────────────────────────────────────────────│
│ 7 células                                      [25▾] por página  [«][‹] Página 1 de 1 [›][»] │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```
- **Cabeçalho:** o `h1`, o subtítulo (P10), "Excluídas" (E2.01) e "Nova célula" (E2.08), sem mudança.
- **Busca:** como a T1 do E2.07, com o rótulo "Buscar" visível e o placeholder do Negócio ("Líder, timóteo, anfitrião, rua ou bairro"), `type="search"`, `enterKeyHint="search"`, `maxLength={100}` e `h-11` no celular. No celular, o placeholder não cabe e é cortado; o rótulo continua inteiro.
- **"Filtros ({N})", "Limpar filtros", chips e total:** como a T1 do E2.07, com N de 1 a 10 (RN-12) e os textos de Células da tabela de Textos. O total fica acima da lista ("3 células", "1 célula"), com `role="status"`, e também no `ListPagination`.
- **Abrir o detalhe (P81, UXD-4):**
  - **Cartão:** o nome do líder é um `Link` para `/cells/{id}`, esticado sobre o cartão inteiro (`after:absolute after:inset-0`). As ações (`[▤+]`, `[✎]` e `[⋯]`) ficam por cima (`relative z-10`) e nunca dentro do link. O toque em qualquer outro ponto do cartão abre o detalhe.
  - O nome acessível do link é "Célula de {Líder}, {nível}" (o prefixo "Célula de " em `sr-only` e o nível como no P40: "Célula de André Souza, nível 144"). Ele contém o nome visível (WCAG 2.5.3).
  - O `ChevronRight` (`aria-hidden`) fica no fim da última linha, alinhado à direita, para mostrar que o cartão abre.
  - O foco do teclado desenha o anel em volta do cartão inteiro (`focus-visible:after:ring-2 after:rounded-md`).
  - **Tabela:** o nome do líder, na coluna "Líder", é o `Link`, com o mesmo nome acessível e `hover:underline`. O clique em qualquer ponto da linha também abre o detalhe (`cursor-pointer`), menos nos botões de ação. Pelo teclado, só o link recebe o foco.
- **Relatório (E2.09):** a linha do cartão e a coluna da tabela são do E2.09, com a aparência que ele definir. Este passo não muda nada nelas.
- **Ordem (RN-13):** a de hoje, com as células de "data não registrada" no fim. Nenhuma coluna mostra a data de cadastro, então nenhuma tem `aria-sort`. A tabela tem a legenda "Células, da cadastrada mais recentemente para a mais antiga." † só para o leitor de tela (`caption` com `sr-only`).
- **Cartões até 1023 px (P45):** a troca não pode mostrar a tabela no primeiro render do celular, como já diz o P45.
- Componentes: `Card`, `Input`, `Button`, `Badge`, `Table`, `Skeleton`, `Alert`, `ListPagination` e `Link` (React Router), mais os da T2 e da T3.

#### T2. Painel de filtros no celular e no tablet (`Sheet`)
Celular (360 px), com Rita, depois de escolher G12: Pedro Alves e Paula Alves, Tipo: Discipulado e Situação do relatório: Pendente:
```
┌──────────────────────────────────────┐
│ Filtros                          [✕] │  SheetTitle, recebe o foco
│──────────────────────────────────────│
│ Líder                                │
│ [Escolha uma ou mais pessoas      ▾] │  PaginatedSelect múltiplo (T4)
│ Mostra as células lideradas pelas    │  dica do Negócio
│ pessoas escolhidas.                  │
│ G12                                  │
│ [(Pedro Alves ✕) (Paula Alves ✕)  ▾] │
│ Mostra as células do ministério de   │
│ cada pessoa escolhida, inclusive as  │
│ que ela lidera. Para o ministério de │
│ um casal, escolha os dois.           │
│ Rua                                  │
│ [                                  ] │  h-11
│ Bairro                               │
│ [                                  ] │
│ Cidade                               │
│ [                                  ] │
│ Tipo                                 │  legend
│ [ ] Evangelística  [x] Discipulado   │  Checkbox, min-h-11 (P51)
│ [ ] Macrocélula                      │
│ Dia da semana                        │  legend
│ [ ] Segunda-feira  [ ] Terça-feira   │  grid-cols-2, na ordem
│ [ ] Quarta-feira   [ ] Quinta-feira  │  das linhas
│ [ ] Sexta-feira    [ ] Sábado        │
│ [ ] Domingo                          │
│ Situação                             │  legend
│ [(•) Todas][( ) Ativa ][( ) Inativa] │  RadioGroup, min-h-11 (P52)
│ Situação do relatório                │  legend (T5)
│ Células inativas não têm situação do │  dica do Negócio
│ relatório.                           │
│ Nesta semana                         │  legend do subgrupo (P85)
│ [ ] Enviado   [ ] Ainda não ocorreu  │
│ [x] Pendente                         │
│ [ ] Conta a partir da próxima semana │
│ Sem relatório nas semanas anteriores │  legend do subgrupo
│ [ ] Na semana passada                │
│ [ ] Nas 2 semanas anteriores         │
│ [ ] Nas 3 semanas anteriores         │
│ [ ] Nas 4 ou mais semanas anteriores │
│ Cadastrada a partir de               │
│ [dd/mm/aaaa                        ] │  type="date", h-11 (T6)
│ Cadastrada até                       │
│ [dd/mm/aaaa                        ] │
│ Células antigas sem data de cadastro │  dica do Negócio
│ não aparecem quando há filtro de     │
│ data.                                │
│──────────────────────────────────────│
│ [Limpar         ] [Aplicar filtros ] │  rodapé fixo, h-11
└──────────────────────────────────────┘
```
- **Contêiner, rodapé, aplicação, fechar, "Limpar" e foco inicial:** como a T2 do E2.07, sem mudança. "Aplicar filtros" confere as datas (T6), aplica tudo de uma vez, fecha o painel, volta para a página 1 e devolve o foco a "Filtros". "✕", `Esc`, o toque fora e o gesto de voltar fecham sem aplicar.
- **Líder e G12:** o `PaginatedSelect` múltiplo da T4, cada um com a dica do Negócio embaixo.
- **Rua, Bairro e Cidade:** `Input` com `maxLength={100}`, `autoComplete="off"`, `enterKeyHint="search"` e `h-11`. Enter num desses campos vale como "Aplicar filtros" (o corpo é um `form`).
- **Tipo e Dia da semana (P51):** caixas de seleção num `fieldset` com `legend`. O Tipo fica em linha, com quebra (`flex flex-wrap gap-x-4 gap-y-2`). Os dias ficam em duas colunas (`grid grid-cols-2 gap-x-4`), lidos linha a linha na ordem da RN-08: de Segunda-feira a Domingo. Cada opção é um `Label` com a caixa, de pelo menos 44 px de altura, que responde ao toque na linha inteira.
- **Situação (P52):** `RadioGroup` com Todas, Ativa e Inativa lado a lado, cada uma com um terço da largura. "Todas" vem marcada.
- **Situação do relatório (P85):** a T5.
- **Datas (P54):** a T6.
- **Altura:** com os 10 filtros, o corpo rola cerca de quatro telas em 360×800. O rodapé fica sempre à vista. A ordem é a da UXD-1. Como em Membros, os campos não se agrupam em seções que abrem e fecham.
- Componentes: `Sheet`, `PaginatedSelect`, `Input`, `Checkbox`, `RadioGroup`, `Label` e `Button`.

#### T3. Painel de filtros no computador (a partir de 1024 px)
Painel aberto, com Rita, depois de escolher G12: Pedro Alves e Paula Alves e Situação: Ativa (o equivalente do ranking "Células por G12", RN-21):
```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Buscar                                                                                       │
│ [⌕ Líder, timóteo, anfitrião, rua ou bairro]  [⚲ Filtros (2) ⌃]  [Limpar filtros]            │  sem chips
│ Líder                                          G12                                           │
│ [Escolha uma ou mais pessoas               ▾]  [(Pedro Alves ✕) (Paula Alves ✕)          ▾]  │  lg:grid-cols-4
│ Mostra as células lideradas pelas pessoas      Mostra as células do ministério de cada       │
│ escolhidas.                                    pessoa escolhida, inclusive as que ela        │
│                                                lidera. Para o ministério de um casal,        │
│                                                escolha os dois.                              │
│ Rua                    Bairro                  Cidade                 Tipo                   │
│ [                   ]  [                   ]   [                   ]  [Todos             ▾]  │  Popover (P51)
│ Dia da semana          Situação                Situação do relatório                         │
│ [Todos             ▾]  [Ativa             ▾]   [Todas                                    ▾]  │  Popover · Select · Popover
│                                                Células inativas não têm situação do          │
│                                                relatório.                                    │
│ Cadastrada a partir de  Cadastrada até                                                       │
│ [dd/mm/aaaa          ]  [dd/mm/aaaa        ]                                                 │
│ Células antigas sem data de cadastro não                                                     │
│ aparecem quando há filtro de data.                                                           │
│ 2 células                                                                                    │  role="status"
│ Líder                     │ G12         │ …                                                  │
│ Paula Alves (G12)         │ Paula Alves │ …                                                  │  C6
│ André Souza (144)         │ Pedro Alves │ …                                                  │  C1
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```
- **Painel, aplicação e chips:** como a T3 do E2.07 (P50). O painel começa fechado e lembra, neste navegador, o último estado, numa chave de Células. Cada mudança vale na hora; Rua, Bairro e Cidade, 300 ms depois da última tecla. Com o painel aberto, os chips não aparecem.
- **Grade (`lg:grid-cols-4 gap-4`), na ordem da UXD-1:**
  - Líder (2 colunas) e G12 (2 colunas), cada um com a dica embaixo;
  - Rua, Bairro, Cidade e Tipo;
  - Dia da semana, Situação e Situação do relatório (2 colunas, com a dica embaixo);
  - as duas datas (2 colunas, com a dica embaixo).

  Em 1024 px, cada coluna tem cerca de 156 px, e nada rola na horizontal.
- **Tipo e Dia da semana (P51):** o botão com a aparência do `SelectTrigger` mostra "Todos" sem escolha, ou as opções escolhidas, separadas por vírgula ("Quarta-feira, Quinta-feira"), com quebra de linha. Ele abre um `Popover` com as mesmas caixas do `Sheet`, uma por linha.
- **Situação (P52):** `Select`, com "Todas" no início.
- **Situação do relatório:** o botão do P51 com "Todas" sem escolha. O `Popover` tem os subgrupos da T5.
- Componentes: `Collapsible`, `Select`, `Popover`, `Checkbox`, `Label`, `Input` e `PaginatedSelect`.

#### T4. Líder e G12: seletor, limite e pessoa indisponível
Pedro abre o Líder e depois o G12, sem digitar (critérios da RN-04 e da RN-05):
```
Líder, menu aberto                       G12, menu aberto
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Líder                                │ │ G12                                  │
│ [Escolha uma ou mais pessoas      ▴] │ │ [Escolha uma ou mais pessoas      ▴] │
│ ┌──────────────────────────────────┐ │ │ ┌──────────────────────────────────┐ │
│ │ André Souza (144)                │ │ │ │ Paula Alves                      │ │
│ │ Diego Reis (144)                 │ │ │ │ Pedro Alves                      │ │
│ │ Gabriel Costa (20.736)           │ │ │ │ Tiago Rocha                      │ │
│ │ Paula Alves (G12)                │ │ │ └──────────────────────────────────┘ │
│ └──────────────────────────────────┘ │ │ Mostra as células do ministério de   │
│ Mostra as células lideradas pelas    │ │ cada pessoa escolhida, inclusive as  │
│ pessoas escolhidas.                  │ │ que ela lidera. Para o ministério de │
└──────────────────────────────────────┘ │ um casal, escolha os dois.           │
                                         └──────────────────────────────────────┘
```
Na lista, com Pedro, depois de abrir um link com G12: Tânia e Pedro (critério da RN-06):
```
┌──────────────────────────────────────┐
│ Buscar                               │
│ [⌕ Líder, timóteo, anfitrião, rua o] │
│ [⚲ Filtros (1)] [Limpar filtros]     │
│ (G12: Pessoa indisponível ✕)         │  sem nome e sem id
│ (G12: Pedro Alves ✕)                 │
│ (i) Esta pessoa não está disponível  │  text-sm, text-muted-foreground
│ para você.                           │
│ 2 células                            │  C4 e C1
│──────────────────────────────────────│
│ Gabriel Costa             [✎]  [⋯]   │
│ …                                    │
└──────────────────────────────────────┘
```
- **Seletor (P53):** o `PaginatedSelect` com `isMulti`, 20 opções por página, com "Carregar mais", e o placeholder "Escolha uma ou mais pessoas". As pessoas escolhidas aparecem dentro do campo, na ordem da escolha, cada uma com o "✕" ("Remover {Nome}"). O menu fica aberto depois de cada escolha.
- **Opções (UXD-2):** só quem lidera (no Líder) ou é o G12 (no G12) de pelo menos uma célula visível, ativa ou inativa, inclusive os nomes de referência, em ordem alfabética (AQ-2).
  - No Líder, cada opção traz o nível do P40 entre parênteses, como na linha da célula: "André Souza (144)", "Samuel Colares (Pastor)", "Ester Ramos (Sem liderança)". Os parênteses ficam `aria-hidden`, e o leitor ouve "André Souza, nível 144".
  - No G12, só o nome.
  - Quem está logado aparece se liderar uma célula visível (no Líder) ou se for o G12 dela (no G12), como Pedro no G12.
- **Busca sem resultado:** "Nenhum líder de célula encontrado." no Líder e "Nenhum G12 encontrado." no G12 †.
- **Dica, limite e pessoa indisponível:** como a T4 do E2.07.
  - A dica do Negócio fica embaixo do campo, em `text-sm text-muted-foreground`, ligada por `aria-describedby`.
  - Com 10 pessoas, as outras opções ficam desabilitadas, e "Escolha até 10 pessoas." aparece no lugar da dica, com `role="status"`.
  - A pessoa que a leitura não resolve aparece como "Pessoa indisponível", sem nome e sem id, no campo e no chip ("Líder: Pessoa indisponível", "G12: Pessoa indisponível"). Embaixo da dica do campo e, fora do painel, embaixo dos chips, aparece "Esta pessoa não está disponível para você." (com mais de uma: "Estas pessoas não estão disponíveis para você."), com o ícone `Info` (`aria-hidden`).
  - Os nomes das pessoas escolhidas vêm só da mesma leitura das opções, nunca da `member_names` nem do `useMemberName` (AQ-2).
- **Pessoas vindas da URL:** "Carregando…" no campo e no chip, até a leitura por id chegar.

#### T5. Situação do relatório no filtro (P85, PO-UX-1)
No painel do computador, com Pendente e Na semana passada escolhidas (no `Sheet`, as mesmas caixas ficam à vista, na T2):
```
┌──────────────────────────────────────┐
│ Situação do relatório                │
│ [Pendente, Sem relatório na semana   │  botão com a aparência do
│  passada                          ⌃] │  SelectTrigger; quebra a linha
│ ┌──────────────────────────────────┐ │  Popover
│ │ Células inativas não têm         │ │  dica do Negócio
│ │ situação do relatório.           │ │
│ │ Nesta semana                     │ │  legend do subgrupo
│ │ [ ] Enviado                      │ │  uma por linha, min-h-11
│ │ [ ] Ainda não ocorreu            │ │
│ │ [x] Pendente                     │ │
│ │ [ ] Conta a partir da próxima    │ │
│ │     semana                       │ │
│ │ Sem relatório nas semanas        │ │  legend do subgrupo
│ │ anteriores                       │ │
│ │ [x] Na semana passada            │ │
│ │ [ ] Nas 2 semanas anteriores     │ │
│ │ [ ] Nas 3 semanas anteriores     │ │
│ │ [ ] Nas 4 ou mais semanas        │ │
│ │     anteriores                   │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```
- **Opções (UXD-3):** os valores do E2.09, na ordem dele.
  - Nesta semana: Enviado, Ainda não ocorreu, Pendente e Conta a partir da próxima semana. "Enviado" junta "Célula realizada" e "Não houve célula" (PO-UX-1).
  - Sem relatório nas semanas anteriores: Na semana passada, Nas 2, Nas 3 e Nas 4 ou mais semanas anteriores. Cada uma é o valor exato da contagem do E2.09 (RN-05 de lá).
  - Basta valer uma das opções escolhidas (RN-02). Escolher "Pendente" e "Na semana passada" traz as duas, e não só as células com as duas.
- **Estrutura:** um `fieldset` com a `legend` "Situação do relatório" e a dica logo abaixo dela, e um `fieldset` com `legend` para cada subgrupo. O leitor de tela ouve "Sem relatório nas semanas anteriores, grupo; Na semana passada, caixa de seleção".
- **Chips e botão:** levam o texto inteiro, sem depender do subgrupo: "Situação do relatório: Pendente" e "Situação do relatório: Sem relatório na semana passada". O botão do `Popover` mostra "Todas" sem escolha, ou os textos inteiros separados por vírgula, com quebra de linha.
- **Com Situação: Inativa:** nenhuma opção é desabilitada. A lista fica vazia, com o vazio com filtros da T7, e a dica já explica o motivo (RN-10).
- **Se o PO adotar as opções do legado (PO-UX-1):** a mesma estrutura, sem os subgrupos, com as opções que o PO fechar. O resto da T5 não muda.

#### T6. Datas de cadastro (P54)
Como a T5 do E2.07, com estas diferenças:
- os rótulos são "Cadastrada a partir de" e "Cadastrada até", e a legenda "Data de cadastro" fica só para o leitor de tela;
- a dica é "Células antigas sem data de cadastro não aparecem quando há filtro de data.";
- as mensagens são as do Negócio ("Data inválida. Use o formato dd/mm/aaaa." e "A data inicial precisa ser igual ou anterior à data final."), conferidas ao sair do campo e, no celular, também em "Aplicar filtros";
- os chips são "Cadastrada a partir de 22/11/2026" e "Cadastrada até 28/11/2026". As duas datas contam como um filtro;
- sem `max`. O equivalente de "Novas células da semana" vai até o sábado, uma data futura em quase toda a semana (RN-21).

#### T7. Estados da lista
Como a T6 do E2.07, com os textos de Células:
- **Vazio com filtros ou com a busca:** "Nenhuma célula encontrada com estes filtros." e "Limpar filtros" (`Button variant="outline"`, `h-11`). O "0 células" continua acima.
- **Vazio sem filtros nem busca:** "Nenhuma célula encontrada.".
- **Carregando:** na primeira carga, 5 `Skeleton` no formato dos cartões (até 1023 px) ou das linhas (a partir de 1024 px), no lugar do "Carregando..." de hoje. Ao aplicar um filtro ou trocar de página, a lista anterior fica com `opacity-60` e `aria-busy="true"`, e o total anterior continua (E1.08).
- **Erro ao carregar:** um `Alert` com "Não foi possível carregar as células. Verifique a conexão e tente de novo." e "Tentar de novo", no lugar da lista. A busca, "Filtros" e os chips continuam e funcionam. Nunca uma mensagem técnica, nem no tempo-limite.
- **De volta do detalhe:** a lista aparece com os dados guardados (E1.08), rola até a célula aberta e põe o foco no link dela (UXD-10). Se a célula saiu da página (foi excluída pelo detalhe), o foco vai para o `h1` "Células".

#### T8. Detalhe da célula: celular
360 px, com Pedro no detalhe de C1, hoje às 21:00. Pedro não tem "Visualizar Auditoria", então "Ver histórico" não aparece:
```
┌──────────────────────────────────────┐
│ ☰                                    │
│ [← Voltar para Células]              │  link, h-11 (P80)
│ Célula de André Souza                │  h1, recebe o foco ao abrir
│ Quarta · 20:00 · Evangelística       │  reunião, como complemento
│ [Ativa]                              │  situação, badge do P6
│ [✎ Editar célula] [⋯]                │  outline, h-11 · ⋯: Excluir célula
│ Cadastrada por Rita Gomes em         │  autoria (P30), text-sm
│ 10/03/2025 às 19:40                  │
│ Alterada por Pedro Alves em          │
│ 20/11/2026 às 10:15                  │
│──────────────────────────────────────│  Separator
│ Situação do relatório                │  h2
│ [◷ Ainda não ocorreu]                │  aparência do E2.09 (T10)
│ A reunião desta semana ainda não     │  explicação do E2.09
│ aconteceu. O relatório fica pendente │
│ 1 hora depois do horário da célula.  │
│──────────────────────────────────────│
│ Pessoas da célula                    │  h2
│ Líder      André Souza (144)         │  dl em duas colunas
│ Timóteo    Caio Lima                 │
│ Anfitrião  Carla Dias                │
│ G12        Pedro Alves               │
│──────────────────────────────────────│
│ Endereço da célula                   │  h2
│ Rua das Flores, 100                  │
│ Centro · Porto Alegre, RS            │
│ CEP 90010-000                        │
│──────────────────────────────────────│
│ Últimos relatórios                   │  h2 (T11)
│ As setas comparam com o relatório    │  P82
│ anterior de célula realizada.        │
│ ┌──────────────────────────────────┐ │
│ │ Quarta, 18/11/2026    [✎]  [⋯]   │ │  h3; ações do relatório
│ │ às 20:00                         │ │
│ │ [✓ Célula realizada]             │ │
│ │ …                                │ │
│ └──────────────────────────────────┘ │
│ … (R2 e R4)                          │
│ [Ver todos os relatórios          →] │  outline, h-11
│──────────────────────────────────────│
│ Evolução                             │  h2 (T12)
│ [     Gráfico     ][     Tabela     ]│  Tabs
│ …                                    │
│                                      │  pb-24: o fim não fica sob
│══════════════════════════════════════│  o rodapé
│ [▤+ Novo relatório                 ] │  rodapé fixo, h-11, md:hidden
└──────────────────────────────────────┘
```
- **Topo (P80):**
  - "Voltar para Células" é um `Link` com o ícone `ArrowLeft` (`aria-hidden`), `h-11` e `-ml-2`, que volta à lista como na [Navegação e rotas](#navegação-e-rotas). Para quem não tem a lista: "Ir para o início" (UXD-10).
  - O `h1` é "Célula de {Líder}", sem o nível, em `text-2xl md:text-3xl`, como os títulos das listas. Ao abrir a tela, o foco vai para ele (`tabIndex={-1}`), para o leitor de tela anunciar a troca de página.
  - O complemento é "{Dia} · {HH:mm} · {Tipo}", em `text-muted-foreground`, com o dia na forma curta. Ele começa com "Reunião: " em `sr-only`, e os "·" ficam `aria-hidden`.
  - A situação usa o badge do P6: "Ativa", ou "Inativa" com o ícone `PauseCircle` (E2.08, T7).
- **Ações no celular (UXD-6):**
  - "Editar célula" (`outline`, `h-11`, ícone `Pencil`), só com "Editar Célula";
  - "⋯" (`DropdownMenu`, `h-11 w-11`, `aria-label="Ações da célula de {Líder}"`), com "Excluir célula", só com "Excluir Célula" (P8);
  - sem nenhuma das duas, a linha some;
  - "Novo relatório" fica no rodapé fixo: `fixed inset-x-0 bottom-0 z-40 border-t bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:hidden`, com um `Button` (`default`) de largura toda, `h-11` e o ícone `FilePlus`. Aparece só quando a célula está ativa e quem vê pode lançar o relatório dela (RN-16, `can_submit_report`). Com o rodapé, a página ganha `pb-24`, para o fim do conteúdo não ficar embaixo dele. Ele pede `viewport-fit=cover` (P1).
- **Autoria (P30):** logo depois das ações, antes das seções, com o `Separator` embaixo. "Ver histórico" (P31) só para quem tem "Visualizar Auditoria", com `aria-label="Ver histórico da célula de {Líder}"`.
- **Seções:** cada uma é uma `section` com `aria-labelledby` no seu `h2`, separadas por `Separator` no celular. Na ordem do DOM: Situação do relatório (T10), Pessoas da célula, Endereço da célula, Últimos relatórios (T11) e Evolução (T12).
- **Pessoas da célula:** uma `dl` em duas colunas (`grid grid-cols-[auto_1fr] gap-x-3 gap-y-1`), com os rótulos em `text-muted-foreground` e os nomes em `text-foreground`, que quebram linha (`min-w-0 break-words`).
  - O líder vem com o nível entre parênteses (P40).
  - "(inativo)" ou "(inativa)" depois do nome, só para quem vê a pessoa (P63, RN-15 a).
  - O G12 é um nome só, "Pastores" ou "—". O "—" é lido como "nenhum" (`sr-only`), como na T2 do E2.06.
  - Os nomes são só texto, sem link: são nomes de referência (RN-06 do E1.08).
- **Endereço da célula:** em até quatro linhas, sem as partes vazias:
  - "{Rua}, {Número}" (sem número, "s/n", como na lista);
  - o complemento;
  - "{Bairro} · {Cidade}, {UF}";
  - "CEP {00000-000}".

  Sem nenhuma parte, "Sem endereço", em `text-muted-foreground`.
- **Últimos relatórios e Evolução:** a T11 e a T12.
- Componentes: `Button`, `Badge` (o `span` do P6), `DropdownMenu`, `Separator`, `Card`, `Tabs`, `Skeleton`, `Alert` e `Link`.

#### T9. Detalhe da célula: tablet e computador
Em 1280 px, com Rita no detalhe de C1, hoje às 21:00. Em 1024 px, muda só a grade das três primeiras seções, que fica em duas colunas:
```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ [← Voltar para Células]                                                                      │
│ Célula de André Souza               [▤+ Novo relatório] [✎ Editar célula] [⌫ Excluir célula] │
│ Quarta · 20:00 · Evangelística  [Ativa]                                                      │
│ Cadastrada por Rita Gomes em 10/03/2025 às 19:40                           [⟲ Ver histórico] │
│ Alterada por Pedro Alves em 20/11/2026 às 10:15                                              │
│──────────────────────────────────────────────────────────────────────────────────────────────│
│ ┌ Situação do relatório ──────┐ ┌ Pessoas da célula ──────────┐ ┌ Endereço da célula ──────┐ │
│ │ [◷ Ainda não ocorreu]       │ │ Líder      André Souza (144)│ │ Rua das Flores, 100      │ │
│ │ A reunião desta semana ainda│ │ Timóteo    Caio Lima        │ │ Centro · Porto Alegre,   │ │
│ │ não aconteceu. O relatório  │ │ Anfitrião  Carla Dias       │ │ RS                       │ │
│ │ fica pendente 1 hora depois │ │ G12        Pedro Alves      │ │ CEP 90010-000            │ │
│ │ do horário da célula.       │ │                             │ │                          │ │
│ └─────────────────────────────┘ └─────────────────────────────┘ └──────────────────────────┘ │
│ ┌ Últimos relatórios ──────────────────────────────────────────────────────────────────────┐ │
│ │ As setas comparam com o relatório anterior de célula realizada.                          │ │
│ │ Data e hora │ Relatório                 │ Participantes │ Visitantes │ Oferta   │ Ações  │ │
│ │ Quarta,     │ [✓ Célula realizada]      │           8 ↑ │        2 ↑ │ R$ 50,00 │ [✎] [⌫]│ │
│ │ 18/11/2026  │ Tema: A fé que vence      │               │            │          │        │ │
│ │ às 20:00    │ Observações: Dois         │               │            │          │        │ │
│ │             │ visitantes do trabalho do │               │            │          │        │ │
│ │             │ Caio                      │               │            │          │        │ │
│ │ Quarta,     │ [⊘ Não houve célula]      │             — │          — │        — │ [✎] [⌫]│ │
│ │ 11/11/2026  │ Motivo: Chuva forte no    │               │            │          │        │ │
│ │ às 20:00    │ bairro                    │               │            │          │        │ │
│ │ Quarta,     │ [✓ Célula realizada]      │           6 ↑ │        0 ↓ │ R$ 20,00 │ [✎] [⌫]│ │
│ │ 28/10/2026  │ Tema: Perdão              │               │            │          │        │ │
│ │ às 20:00    │                           │               │            │          │        │ │
│ │ [Ver todos os relatórios →]                                                              │ │
│ └──────────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌ Evolução ────────────────────────────────────────────────────────────────────────────────┐ │
│ │ [Gráfico][Tabela]                                                                        │ │
│ │ …                                                                                        │ │
│ └──────────────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```
- **A partir de 768 px (`md`):**
  - as ações vão para o cabeçalho, à direita do título, com texto e nesta ordem: "Novo relatório" (`default`, ícone `FilePlus`), "Editar célula" (`outline`, ícone `Pencil`) e "Excluir célula" (`outline`, ícone `Trash2` em `text-muted-foreground`, E2.01). Cada uma aparece pela mesma regra do celular. O rodapé fixo some (`md:hidden`), e o "⋯" do cabeçalho também;
  - o cabeçalho é `flex flex-wrap items-start justify-between gap-4`: quando o título é longo, as ações descem para a linha de baixo;
  - as seções viram caixas (`md:rounded-lg md:border md:bg-card md:p-6`). Situação do relatório, Pessoas da célula e Endereço da célula ficam em duas colunas (`md:grid-cols-2`) e, a partir de 1280 px, em três (`xl:grid-cols-3`). Os nomes e o endereço quebram linha, sem `truncate`.
- **De 768 a 1023 px:** os últimos relatórios continuam em cartões, um embaixo do outro (P45), e o gráfico ocupa a largura toda.
- **A partir de 1024 px:** os últimos relatórios viram a tabela da T11. "Ver todos os relatórios" fica depois dela, alinhado à esquerda, com a largura do texto.
- **Autoria:** como no P30, com "Ver histórico" à direita da primeira linha.
- Os badges, os textos e a ordem das seções são os mesmos do celular. Só as ações mudam de lugar. O "Novo relatório" do cabeçalho e o do rodapé são elementos diferentes, e cada um fica com `display: none` (`hidden md:inline-flex` e `md:hidden`) no tamanho em que não vale. O mesmo vale para "Excluir célula" com texto e o "⋯". Assim, o leitor de tela nunca encontra a mesma ação duas vezes, e a ordem do foco segue a posição na tela: no celular, o rodapé fica no fim do DOM.

#### T10. Situação do relatório no detalhe
Os valores e as explicações são os do E2.09, com o rótulo do Negócio daqui ("Situação do relatório"). A aparência abaixo é provisória: vale a que o E2.09 definir para a lista, porque é o mesmo componente (AQ-4).

> **Nota do PO (PO-UX-1, resolvida em 2026-11-24):**
> - O E2.09 já definiu a aparência, e o detalhe usa os componentes da lista, sem variação: o P70 (texto, tom e ícone), o P71 (a informação "Relatório") e o P72 (semanas anteriores, em texto, e não em badge).
> - Onde o wireframe abaixo difere do E2.09, vale o E2.09. Por exemplo: o ícone `TriangleAlert`, a forma `rounded-md` que quebra linha e a linha das semanas em `text-xs font-medium` com o ícone `CalendarX2`.
> - Ficam próprias do detalhe só a explicação embaixo do valor, com os textos da legenda do E2.09, e a frase da célula inativa (RN-15 f).
```
Enviado (C6, Rita)                       Pendente, com semanas anteriores (C3, André)
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Situação do relatório                │ │ Situação do relatório                │
│ [✓ Enviado · Célula realizada]       │ │ [△ Pendente]                         │
│                                      │ │ A reunião desta semana já passou e o │
│                                      │ │ relatório não foi enviado.           │
│                                      │ │ Sem relatório na semana passada      │
└──────────────────────────────────────┘ └──────────────────────────────────────┘
Ainda não ocorreu, sem relatório há tempo (C8, Ester)
┌──────────────────────────────────────┐
│ Situação do relatório                │
│ [◷ Ainda não ocorreu]                │
│ A reunião desta semana ainda não     │
│ aconteceu. O relatório fica pendente │
│ 1 hora depois do horário da célula.  │
│ Sem relatório nas 4 ou mais semanas  │
│ anteriores                           │
└──────────────────────────────────────┘
Conta a partir da próxima semana         Célula inativa (C4, Pedro)
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Situação do relatório                │ │ Situação do relatório                │
│ [◷ Conta a partir da próxima semana] │ │ Célula inativa: sem situação do      │
│ A célula foi cadastrada ou reativada │ │ relatório.                           │
│ depois da reunião desta semana. O    │ └──────────────────────────────────────┘
│ relatório só fica pendente a partir  │
│ da próxima semana.                   │
└──────────────────────────────────────┘
```
- **Valor da semana:** o badge do P6, com ícone e texto (provisório, até o E2.09):
  - "Enviado · Célula realizada" e "Enviado · Não houve célula": `bg-success/15`, `border-success` e o ícone `CheckCircle2`;
  - "Pendente": `bg-warning/15`, `border-warning` e o ícone `AlertTriangle`;
  - "Ainda não ocorreu" e "Conta a partir da próxima semana": `bg-muted`, `border-border` e os ícones `Clock` e `CalendarClock`.

  O texto é sempre `text-foreground`, e o ícone, `aria-hidden`. O badge quebra linha (sem `whitespace-nowrap`), porque "Conta a partir da próxima semana" passa de 30 caracteres.
- **Explicação:** embaixo do badge, em `text-sm text-muted-foreground`, com os textos do E2.09 para "Ainda não ocorreu", "Pendente" e "Conta a partir da próxima semana". "Enviado" não tem explicação.
- **Semanas anteriores sem relatório:** numa linha própria, em `text-sm text-foreground`, com os textos do E2.09 ("Sem relatório na semana passada", "… nas 2 … nas 3 … nas 4 ou mais semanas anteriores"). Só aparece com 1 ou mais.
- **Célula inativa:** só a frase do Negócio, em `text-sm text-muted-foreground`, sem badge (RN-15 f).
- **Célula sem dia válido (RN-07 do E2.09):** só "Sem dia da reunião", como na lista. Depois das regras do E2.08, não acontece.
- **Atualização:** a situação é a da última leitura. Depois de lançar, editar ou excluir um relatório, ou de editar a célula, pelo detalhe, ela muda sem recarregar a página (P44). A passagem do tempo com a tela aberta aparece na leitura seguinte, por exemplo quando a pessoa volta para a aba (RN-10).
- **O que nunca aparece:** a data do último relatório ou qualquer indicação de um relatório que quem vê não enxerga. A situação pode dizer "Enviado" enquanto os últimos relatórios mostram outros relatórios, ou nenhum (RN-17; ver PO-UX-4).
- Componentes: o componente comum do E2.09 (AQ-4), sobre `badgeVariants`.

#### T11. Últimos relatórios e comparação (P82)
Cartões (até 1023 px), com Pedro no detalhe de C1 (critério da RN-17):
```
┌──────────────────────────────────────┐
│ Últimos relatórios                   │  h2
│ As setas comparam com o relatório    │  text-sm, text-muted-foreground
│ anterior de célula realizada.        │
│ ┌──────────────────────────────────┐ │  li > article, rounded-lg border p-4
│ │ Quarta, 18/11/2026    [✎]  [⋯]   │ │  h3; ações do relatório (E2.01)
│ │ às 20:00                         │ │
│ │ [✓ Célula realizada]             │ │  P6
│ │ Tema: A fé que vence             │ │
│ │ Participantes  Visitantes        │ │  rótulos text-xs, muted
│ │ 8 ↑            2 ↑               │ │  números text-base font-semibold
│ │ Oferta                           │ │  quebra quando não cabe
│ │ R$ 50,00                         │ │
│ │ Observações: Dois visitantes do  │ │
│ │ trabalho do Caio                 │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ Quarta, 11/11/2026    [✎]  [⋯]   │ │
│ │ às 20:00                         │ │
│ │ [⊘ Não houve célula]             │ │  P6, sem números
│ │ Motivo: Chuva forte no bairro    │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ Quarta, 28/10/2026    [✎]  [⋯]   │ │  comparado com R5, que não
│ │ às 20:00                         │ │  aparece (P-LCE-14)
│ │ [✓ Célula realizada]             │ │
│ │ Tema: Perdão                     │ │
│ │ Participantes  Visitantes        │ │
│ │ 6 ↑            0 ↓               │ │
│ │ Oferta                           │ │
│ │ R$ 20,00                         │ │
│ └──────────────────────────────────┘ │
│ [Ver todos os relatórios          →] │  outline, h-11, largura toda
└──────────────────────────────────────┘
```
Sem relatório visível (C4 ou C8, com Rita):
```
┌──────────────────────────────────────┐
│ Últimos relatórios                   │
│ Nenhum relatório para mostrar.       │  text-muted-foreground
└──────────────────────────────────────┘
```
- **Ordem e quantidade (RN-17):** até 3, do mais recente para o mais antigo, como lista (`ul` com `li`). Com menos relatórios visíveis, aparecem só os que existem, sem nenhuma indicação dos outros.
- **Cabeçalho de cada relatório:** "{Dia}, {dd/mm/aaaa} às {HH:mm}" ("Quarta, 18/11/2026 às 20:00"), num `h3` em `font-body text-sm font-semibold`. O dia da semana vem da data, em Brasília. No celular, quebra antes de "às" quando não cabe ao lado das ações.
- **Ações de cada relatório (RN-17):** as da lista de Relatórios, com as mesmas regras e os mesmos nomes acessíveis (E2.01, T1): "Editar" (`[✎]`, só com "Editar Relatórios de Células") e, no celular, o "⋯" com "Excluir relatório" (só com "Excluir Relatórios de Células"). No celular, os dois têm 44×44 px, com 8 px entre si. Na tabela, ficam os dois ícones, como em Relatórios. Sem nenhuma das duas permissões, a coluna e os botões não aparecem.
- **Badge (P6):** "Célula realizada" (`bg-success/15`, `border-success`, ícone `CheckCircle2`) ou "Não houve célula" (`bg-muted`, `border-border`, ícone `CalendarX`), com texto em `text-foreground`. São os termos do Negócio. A lista de Relatórios ainda mostra "Realizada" e "Não Realizada"; o E2.12 decide se segue estes.
- **Célula realizada:** "Tema: {tema}"; os blocos Participantes, Visitantes e Oferta; e "Observações: {texto}", só quando há.
  - Cada bloco tem o rótulo em `text-xs text-muted-foreground` e o valor em `text-base font-semibold tabular-nums`. Os blocos ficam em linha, com quebra (`flex flex-wrap gap-x-6 gap-y-2`).
  - A oferta é em reais, no padrão pt-BR ("R$ 50,00", "R$ 0,00"). Sem valor registrado: "Não informada" † (PO-UX-10).
- **Não houve célula:** "Motivo: {motivo}" e "Observações: {texto}", só quando há. Sem números e sem comparação.
- **Comparação (P82, RN-17):** depois do número de participantes e do de visitantes, um ícone, comparado com o relatório visível de célula realizada imediatamente anterior:
  - `ArrowUp` quando é maior, `ArrowDown` quando é menor e `Equal` quando é igual;
  - `h-4 w-4 text-muted-foreground`, `aria-hidden`, sem verde nem vermelho (UXD-8);
  - para o leitor de tela, um `sr-only` com o texto do Negócio: "8, mais que no relatório anterior"; "0, menos que no relatório anterior"; "3, igual ao relatório anterior";
  - sem relatório anterior de célula realizada, só o número.
- **Frase das setas:** "As setas comparam com o relatório anterior de célula realizada." †, embaixo do `h2`, só quando pelo menos um relatório mostra uma seta.
- **Tabela (a partir de 1024 px):** as colunas Data e hora, Relatório, Participantes, Visitantes, Oferta e Ações, como no legado. Ela tem a legenda "Últimos relatórios" em `sr-only`.
  - Os números e a oferta ficam alinhados à direita (`text-right tabular-nums`).
  - A coluna Relatório leva o badge, o tema ou o motivo e as observações, que quebram linha, sem `truncate`.
  - No relatório de "Não houve célula", Participantes, Visitantes e Oferta mostram "—" (`aria-hidden`), com "não se aplica" em `sr-only`.
- **Nomes de participantes e visitantes:** não aparecem no detalhe, para ninguém (RN-18). Eles continuam no formulário de edição.
- **Sem relatório visível:** "Nenhum relatório para mostrar.", sem "Ver todos os relatórios" e sem a seção Evolução (RN-17, RN-20; PO-UX-4 resolvida: P-LCE-25).
- **"Ver todos os relatórios" (RN-19):** um `Link` com o visual do `Button variant="outline"`, o ícone `ArrowRight` (`aria-hidden`), `h-11 w-full` no celular e `md:w-auto`. Aparece sempre que há pelo menos um relatório visível. Abre `/cell-reports?cell={id}`. O nome acessível é "Ver todos os relatórios da célula de {Líder}", com o fim em `sr-only`.
- Componentes: `Badge` (o `span` do P6), `Button`, `DropdownMenu` e `Table`.

#### T12. Evolução: gráfico e tabela (P83)
Celular, com Pedro no detalhe de C1 (critério da RN-20). Aba "Gráfico", em esboço fora de escala:
```
┌──────────────────────────────────────┐
│ Evolução                             │  h2
│ [     Gráfico     ][     Tabela     ]│  Tabs, metade da largura cada
│ ─●─ Participantes  ╌■╌ Visitantes    │  legenda em HTML
│  ×  Não houve célula                 │  só quando há
│  8 ┤               ×           ●     │
│  6 ┤       ●       ┊                 │  linha vertical tracejada e "×"
│  4 ┤  ●            ┊                 │  no alto, em 11/11
│  2 ┤               ┊           ■     │
│  0 ┤  ■╌╌╌╌╌■      ┊                 │  visitantes: 1 e 0
│    └──┬─────┬──────┬───────────┬──   │  (o 1 cai entre o 0 e o 2)
│     21/10 28/10  11/11       18/11   │
└──────────────────────────────────────┘
```
Aba "Tabela":
```
┌──────────────────────────────────────┐
│ Evolução                             │
│ [     Gráfico     ][     Tabela     ]│
│ Data        Participantes Visitantes │  caption sr-only
│ 21/10/2026              5          1 │
│ 28/10/2026              6          0 │
│ 11/11/2026  Não houve célula         │  colSpan 2
│ 18/11/2026              8          2 │
└──────────────────────────────────────┘
```
- **Quando aparece (RN-20):** com pelo menos 1 relatório visível. São os até 10 mais recentes, em ordem cronológica: o mais antigo à esquerda, no gráfico, e em cima, na tabela.
- **Abas:** `Tabs` com "Gráfico" (padrão) e "Tabela". A `TabsList` tem a largura toda no celular (`grid w-full grid-cols-2`) e a do texto a partir de `md`, com `h-11` e os gatilhos com pelo menos 36 px. A escolha não vai para a URL e não é lembrada.
- **Gráfico:** o `ChartContainer` do `chart.tsx` (Recharts, já instalado), com um `LineChart`. Ele fica dentro de uma `figure` com `role="img"` e um `aria-label` com o resumo: "Gráfico de linhas com participantes e visitantes de {N} relatórios, de {dd/mm/aaaa} a {dd/mm/aaaa}. Os números estão na aba Tabela." †. O SVG não recebe foco.
  - **Eixo X:** um ponto por relatório, com espaço igual entre eles (como no legado), e o rótulo "dd/mm". Em 360 px, os rótulos que não cabem são omitidos (`interval="preserveStartEnd"`, `minTickGap`). A tabela tem todas as datas.
  - **Eixo Y:** começa em 0, só números inteiros (`allowDecimals={false}`), sem título.
  - **Participantes:** linha contínua com marcadores em círculo cheio, na cor `hsl(var(--primary))`.
  - **Visitantes:** linha tracejada (`strokeDasharray="6 4"`) com marcadores em quadrado vazado, na cor `hsl(var(--muted-foreground))`.
  - **Contraste das séries:** as duas cores passam de 3:1 sobre o `card` nos dois temas: `primary` com cerca de 16:1 no claro e 6:1 no escuro; `muted-foreground` com cerca de 5:1 nos dois. Mesmo sem cor, o traço e o marcador distinguem as séries.
  - **"Não houve célula" (RN-20):** o ponto fica sem valor nas duas séries (`null`, com `connectNulls={false}`). As linhas são interrompidas ali e não caem a zero. Na data, uma linha vertical tracejada em `muted-foreground` e o marcador "×" no alto da área do gráfico.
  - **Legenda:** em HTML, acima do gráfico, com uma amostra do traço e do marcador (`aria-hidden`) e o texto de cada série: "Participantes" e "Visitantes". "Não houve célula", com o "×", só quando há esse relatório. Os itens quebram linha.
  - **Tooltip:** pode existir (o `ChartTooltip`, ao tocar ou passar o mouse), com a data e os dois números, mas nunca é o único lugar de uma informação.
  - **Altura:** reservada desde o primeiro render, sem salto: `h-56` no celular, `md:h-64` e `lg:h-72`. A largura acompanha o contêiner, sem rolagem horizontal.
  - **Movimento:** sem animação de entrada com `prefers-reduced-motion` (`isAnimationActive={false}`).
  - **Carga:** o gráfico é carregado sob demanda (AQ-11). Até chegar, um `Skeleton` com a mesma altura.
- **Tabela:** uma `table` com a legenda "Participantes e visitantes por relatório, do mais antigo para o mais recente." † em `sr-only`.
  - As colunas são Data ("dd/mm/aaaa"), Participantes e Visitantes. Os números ficam à direita, com `tabular-nums`.
  - No relatório de "Não houve célula", uma célula com `colSpan={2}` e "Não houve célula".
  - Mesma ordem e mesmos números do gráfico (RN-20), sem as setas.
- **Um relatório só (C2):** o gráfico mostra um ponto de cada série, sem linha, e a tabela tem uma linha.
- Componentes: `Tabs`, `ChartContainer`, `ChartTooltip`, `Table` e `Skeleton`. Nenhum componente novo.

#### T13. Detalhe: carregando, não encontrada e erro
```
Carregando, aberto por link              Célula não encontrada (Diego abre C1)
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ ☰                                    │ │ ☰                                    │
│ [← Voltar para Células]              │ │ Célula não encontrada                │  h1
│ Célula ▒▒▒▒▒▒▒▒▒▒▒▒▒                 │ │ Ela não existe, foi excluída ou não  │
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒                 │ │ está disponível para você.           │
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒          │ │ [Voltar para Células               ] │  default, h-11
│──────────────────────────────────────│ └──────────────────────────────────────┘
│ Situação do relatório                │
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒                       │ Erro ao carregar
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒       │ ┌──────────────────────────────────────┐
│ Pessoas da célula                    │ │ ☰                                    │
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒                 │ │ [← Voltar para Células]              │
│ …                                    │ │ Célula                               │  h1
└──────────────────────────────────────┘ │ ┌──────────────────────────────────┐ │
                                         │ │ ⚠ Não foi possível carregar a    │ │  Alert
                                         │ │ célula. Verifique a conexão e    │ │
                                         │ │ tente de novo.                   │ │
                                         │ │ [Tentar de novo]                 │ │
                                         │ └──────────────────────────────────┘ │
                                         └──────────────────────────────────────┘
```
- **Carregando, vindo da lista (UXD-12):** o título, o complemento, a situação, as ações e a situação do relatório aparecem na hora, com os dados da linha da lista (AQ-5). A autoria, o endereço completo, os relatórios e o gráfico mostram `Skeleton` no formato de cada um, com a altura reservada: 2 linhas na autoria, 3 cartões (ou 3 linhas da tabela) e a área do gráfico.
- **Carregando, aberto por link:** "Voltar para Células" já aparece. O `h1` mostra "Célula" e um `Skeleton` no lugar do resto, e cada seção mostra o seu. As ações e o rodapé só aparecem quando a leitura chega, para não oferecer uma ação que a pessoa talvez não tenha.
- **Célula não encontrada (RN-14, UXD-11):** o `h1` "Célula não encontrada", a frase do Negócio e o botão "Voltar para Células" (`default`, `h-11`, largura toda no celular). O link do topo não aparece nesse estado, para não repetir a ação.
  - É o mesmo DOM para a célula invisível, a excluída, a inexistente e o endereço com um id sem formato. O id sem formato não faz nenhuma consulta.
  - Nenhum dado da célula aparece, nem mesmo os que vieram da lista: se a leitura do detalhe diz "não encontrada", o que veio da lista é descartado.
  - Para quem não tem a lista de Células (Lia, Hugo), o botão é "Ir para o início" (UXD-10).
  - O foco vai para o `h1`.
- **Erro ao carregar:** o `Alert` com o texto do Negócio e "Tentar de novo", no lugar das seções. O topo continua. Se o nome veio da lista, o `h1` é "Célula de {Líder}"; senão, "Célula". Nunca uma mensagem técnica, nem no tempo-limite.
- **Falha só nos relatórios:** a seção Últimos relatórios mostra um `Alert` com "Não foi possível carregar os relatórios desta célula. Verifique a conexão e tente de novo." † e "Tentar de novo". A seção Evolução fica escondida até a leitura funcionar. O resto do detalhe e as ações continuam.
- **A célula deixa de ser visível com o detalhe aberto (RN-14):** a leitura seguinte (ao voltar para a aba, depois de uma gravação ou em "Tentar de novo") mostra "Célula não encontrada".

#### T14. Ações a partir do detalhe e depois de gravar
- **"Novo relatório" (RN-16):** abre o formulário de relatório do E2.11 (diálogo responsivo, P1), com a célula já escolhida e travada, como pela lista. Se a célula ficou inativa no meio tempo, vale a T8 do E2.08 ("Fechar" atualiza o detalhe).
- **"Editar célula":** abre o formulário de célula do E2.08 (P1), o mesmo da lista, que também inativa e reativa.
- **"Excluir célula":** abre a confirmação da T2 do E2.01, com "Marcar como inativa".
- **Ações de cada relatório:** "Editar" abre o formulário de relatório (E2.11); "Excluir relatório", a confirmação da T2 do E2.01.
- **Depois de gravar (P44):**

  | Ação | O detalhe | O foco |
  |---|---|---|
  | Editar a célula | Mostra os valores novos assim que a gravação é confirmada (RN-15). Até a resposta, as seções ficam com `opacity-60` e `aria-busy`. O toast é o do E2.08. | "Editar célula" |
  | Inativar ou reativar (pelo formulário ou por "Marcar como inativa") | Fica no detalhe, com o badge novo. Na inativação, "Novo relatório" e o rodapé somem, e a situação do relatório vira a frase da célula inativa (T10). | "Editar célula", ou o "⋯" quando a inativação veio dele |
  | Excluir a célula | Vai para a lista de Células, com os filtros de antes, sem a célula (RN-16). O toast é o do E2.01. | o `h1` "Células" |
  | Lançar um relatório | Mostra o relatório novo em primeiro, a situação do relatório nova e o gráfico atualizado. O toast é o do E2.11. | "Novo relatório" |
  | Editar um relatório | Mostra o relatório com os valores novos, na posição que a data der. | o "Editar" daquele relatório ou, se ele saiu dos 3, o `h2` "Últimos relatórios" |
  | Excluir um relatório | O relatório sai, e entra o seguinte (RN-17). A situação do relatório pode voltar a "Pendente" (RN-12 do E2.01). | o `h2` "Últimos relatórios" (`tabIndex={-1}`) |

- **Falhas:** as de cada formulário e de cada confirmação, sem mudança (E2.01, E2.08 e E2.11). O detalhe não muda até a gravação ser confirmada.

#### T15. Relatórios: filtro Célula (P84)
Celular, com Pedro, depois de "Ver todos os relatórios" no detalhe de C1 (critério da RN-19). O topo e os cartões são os de hoje (E2.01 e E2.02); só entra a linha do chip:
```
┌──────────────────────────────────────┐
│ ☰                                    │
│ Relatórios de Células                │  h1 de hoje (o E2.12 revê)
│ Relatórios das células do seu        │  subtítulo (P10)
│ ministério                           │
│ [+ Novo Relatório                  ] │
│──────────────────────────────────────│
│ [⌕ Buscar por líder ou tema…       ] │  busca de hoje
│ (Célula de André Souza · Quarta ·    │  chip, min-h-9, quebra a linha
│  20:00 ✕) [Limpar filtros]           │  ghost, h-11
│──────────────────────────────────────│
│ André Souza                 [✎] [⋯]  │  os cartões de hoje: R1, R2,
│ Rua das Flores 100                   │  R4 e R5
│ Centro                               │
│ 18/11/2026 · 20:00                   │
│ …                                    │
│──────────────────────────────────────│
│ 4 relatórios                         │  ListPagination
└──────────────────────────────────────┘
```
Diego, com o mesmo link (célula indisponível):
```
┌──────────────────────────────────────┐
│ [⌕ Buscar por líder ou tema…       ] │
│ (Célula indisponível ✕)              │  sem nome e sem id
│ [Limpar filtros]                     │
│ (i) Esta célula não está disponível  │  text-sm, text-muted-foreground
│ para você.                           │
│──────────────────────────────────────│
│ Nenhum relatório encontrado com      │
│ estes filtros.                       │
│ [Limpar filtros                    ] │  outline, h-11
└──────────────────────────────────────┘
```
- **Chip (RN-19):** "Célula de {Líder} · {Dia} · {HH:mm}", com o dia na forma curta. É um `button` com o ícone `X` (`aria-hidden`), `min-h-9`, quebra de linha (sem `truncate`) e `aria-label="Remover filtro Célula de {Líder} · {Dia} · {HH:mm}"`.
  - O toque tira o filtro na hora, volta para a página 1 e leva o foco à busca.
  - Enquanto a identificação carrega: "Célula: carregando…" †. Se ela falhar: "Célula: não carregada" †. Nos dois casos, a lista já vem filtrada.
- **"Limpar filtros":** `Button variant="ghost"`, `h-11`, ao lado do chip (quebra a linha em 360 px). Aparece com o filtro Célula ou com texto na busca. Tira `cell`, a busca e a página e mantém o tamanho. O foco vai para a busca.
- **Célula indisponível:** o chip "Célula indisponível", sem nome e sem id, e embaixo "Esta célula não está disponível para você.", com o ícone `Info`. A lista fica vazia, com o vazio com filtros. É a mesma tela para a célula que não existe.
- **Célula excluída (Rita, C5):** o chip normal ("Célula de Jonas Prado · Sexta · 20:00"), e cada linha com o badge "Célula excluída" e o "Ver relatório" do E2.01 (T7).
- **Vazio com filtros (Ester, C8):** "Nenhum relatório encontrado com estes filtros." e "Limpar filtros" (`outline`, `h-11`). Sem filtro nem busca, o vazio de hoje.
- **Id sem formato:** sai da URL, e a lista vem sem o filtro, como hoje.
- **O resto não muda:** título, busca, ações, cartões, tabela e paginação são os de hoje até o E2.12, que leva o filtro para o painel (Impactos do Negócio).
- Componentes: `Button` e o chip do P50, como `button`.

#### T16. Dashboard: sem mudança visual
Nenhum card novo e nenhum texto novo. O clique nos cards é do E2.14, que usa os links prontos da [Navegação e rotas](#navegação-e-rotas). O nome do card de pendentes muda no E2.09.

#### T17. As perguntas Q-1 a Q-7 na tela
Com o padrão do Negócio, vale o que está nas T1 a T16. Se a resposta for a alternativa:
- **Q-1. Quantos relatórios o detalhe mostra.**
  - *Com o padrão (3):* a T11.
  - *Com a alternativa (até 10):* no celular, 10 cartões dobram a altura da tela (cerca de 2.000 px até o gráfico). A UX sugere mostrar os 3 primeiros e o botão "Mostrar mais relatórios" † (`outline`, `h-11`), que mostra os outros (até 10) sem nova leitura, porque o gráfico já os carrega. O foco vai para o 4º relatório. Na tabela do computador, as 10 linhas aparecem direto. "Ver todos os relatórios" continua.
- **Q-2. Filtro de rede.**
  - *Com o padrão:* os 10 filtros.
  - *Com a alternativa:* um 11º filtro, "Liderança", logo depois do Líder, com o seletor do P53 e a dica "Mostra as células lideradas pelas pessoas escolhidas ou por qualquer pessoa abaixo delas." †. A contagem vai até 11, e o filtro ganha chip e parâmetro (`network`). No computador, a primeira linha do painel passa a ter Líder e Liderança, e o G12 desce. O total de células em Membros e em Ministérios poderia virar um link para essa lista (fora deste passo).
- **Q-3. Situação do relatório na lista.** O E2.09 já decidiu mostrá-la (P-SIT-06), e a T1 a inclui. Se o E2.09 voltar atrás, o cartão perde a linha "Relatório" e a tabela perde a coluna. O filtro e o detalhe não mudam.
- **Q-4. Situação padrão do filtro.**
  - *Com o padrão ("Todas"):* a T2 e a T3.
  - *Com a alternativa ("Ativa"):*
    - "Ativa" vem marcada, não conta como filtro e não vira chip;
    - "Todas" e "Inativa" contam e viram chip ("Situação: Todas"), e "Todas" vai para a URL (`status=all`);
    - os links dos cards por tipo, se contarem também as inativas, levam `status=all`;
    - para a busca não esconder uma célula inativa sem aviso, o vazio ganha a frase "As células inativas não aparecem." † e o botão "Mostrar também as inativas" †, que aplica "Todas".
- **Q-5. G12 por casal.**
  - *Com o padrão:* a dica do G12 diz "Para o ministério de um casal, escolha os dois.".
  - *Com a alternativa:* a dica passa a "Mostra as células do ministério de cada pessoa escolhida e do cônjuge dela, inclusive as que eles lideram." †. O chip continua com o nome escolhido, porque o cônjuge pode não ser visível. O link do ranking leva um id só.
- **Q-6. Ordem padrão.**
  - *Com o padrão:* a T1.
  - *Com a alternativa (G12 e líder):* só a ordem muda. Na tabela, o título "G12" ganha `aria-sort="ascending"`, e a legenda em `sr-only` passa a "Células, por G12 e por líder." †. Sem cabeçalhos de grupo, como no E2.07 (UXD-12 de lá).
- **Q-7. Evolução e comparação.**
  - *Com o padrão:* a T11 e a T12.
  - *Com a alternativa:* a seção Evolução, as setas e a frase das setas somem. Os números continuam em cada relatório, e o resto não muda.

### Padrões novos (valem para as próximas telas)
A numeração começa em P80 (ver a nota do início da seção). Este passo também aplica o P1 (formulários abertos pelo detalhe), o P6 (badges), o P8 ("Excluir" no "⋯"), o P10 (subtítulo), o P30 e o P31 (autoria e histórico), o P40 (nível), o P44 (gravação que muda outras telas), o P45 (cartões até 1023 px), o P50 a P54 (filtros), o P63 ("(inativo)") e o P65 (ações no mesmo lugar), sem mudá-los.

- **P80. Tela de detalhe de um registro.**
  - Rota própria (`/<entidade>/:id`), aberta pela lista (P81) e por link. A rota fixa de excluídos (P7) ganha da dinâmica.
  - No topo, "Voltar para {Lista}" (`Link`, ícone `ArrowLeft`, `h-11`). Ele volta à URL da lista guardada no estado da navegação, e a lista devolve o foco ao item aberto. Aberto por link, vai para a lista sem parâmetros. Sem acesso à lista, "Ir para o início".
  - O `h1` tem o nome do registro e recebe o foco ao abrir. Embaixo, um complemento curto e a situação em badge (P6).
  - **Ações:**
    - a partir de 768 px, no cabeçalho, com texto e objeto ("Editar célula");
    - abaixo de 768 px, a ação mais frequente num rodapé fixo (`h-11`, com a área segura), a secundária visível no cabeçalho e a destrutiva no "⋯" (P8);
    - um elemento por tamanho, escondido por CSS no outro, para o leitor de tela nunca ouvir a mesma ação duas vezes.
  - Depois do cabeçalho, a autoria (P30) e as seções, cada uma `section` com `h2`, com os dados em `dl`.
  - **Carregando:** o que a lista já tem aparece na hora; o resto, em `Skeleton` no formato de cada seção.
  - **Não encontrado:** um estado só, com o `h1` "{Registro} não encontrado(a)", igual para o invisível, o excluído, o inexistente e o id sem formato, sem nenhum dado do registro.
  - Vale para as próximas telas de detalhe (Escolas, Turmas e Consolidação).
- **P81. Item de lista que abre o detalhe.**
  - **Cartão:** o identificador é um `Link` esticado (`after:absolute after:inset-0`) que cobre o cartão. As ações ficam por cima (`relative z-10`), como irmãs, nunca dentro do link. Um `ChevronRight` decorativo fica no canto de baixo, e o foco desenha o anel no cartão inteiro.
  - **Tabela:** o identificador da primeira coluna é o `Link`. O clique na linha é um atalho do mouse e ignora os botões.
  - O nome acessível começa pelo tipo do registro ("Célula de …") e contém o texto visível.
- **P82. Comparação com o anterior.**
  - Um ícone depois do número (`ArrowUp`, `ArrowDown` ou `Equal`), `h-4 w-4 text-muted-foreground`, `aria-hidden`, com o sentido em `sr-only`.
  - Sem cor de sucesso ou de erro: o sentido nunca depende da cor.
  - Uma frase acima da lista diz com o que se compara. Sem anterior, só o número.
- **P83. Gráfico com tabela.**
  - `Tabs` "Gráfico" e "Tabela". O gráfico é uma `figure` com `role="img"` e um resumo no `aria-label`, e o SVG não recebe foco.
  - As séries se distinguem pela cor do token, pelo traço e pelo marcador. A legenda é em HTML.
  - O valor ausente é um intervalo, com um marcador próprio explicado na legenda, nunca zero.
  - A tabela tem os mesmos dados, na mesma ordem. O tooltip é só um extra.
  - Sem animação com `prefers-reduced-motion`. A altura é reservada desde o primeiro render, e o gráfico é carregado sob demanda.
  - Vale para o gráfico da semana do Dashboard (E2.14) e para os próximos gráficos.
- **P84. Filtro por um registro vindo de outra tela.**
  - Um chip removível acima da lista, com o registro identificado e "Limpar filtros" ao lado.
  - "Carregando…" até a identificação chegar.
  - "{Registro} indisponível", com uma dica, sem nome e sem id, quando quem consulta não o vê ou ele não existe.
  - Um id sem formato sai da URL.
  - Quando a lista ganha um painel, o filtro passa para ele (E2.12).
- **P85. Múltipla escolha em subgrupos.** Vale quando as opções de um filtro respondem a duas perguntas diferentes.
  - Um `fieldset` com a `legend` do filtro e um `fieldset` com `legend` para cada subgrupo.
  - Dentro do subgrupo, as opções podem ser curtas. O chip e o botão do `Popover` levam o texto inteiro.

Nenhum componente novo do shadcn é necessário: `tabs`, `chart`, `sheet`, `collapsible`, `popover`, `checkbox`, `radio-group`, `select`, `dropdown-menu`, `alert`, `alert-dialog`, `badge`, `button`, `card`, `separator`, `skeleton` e `table` já estão em `src/components/ui`, e o Recharts já é dependência. Os ícones `ChevronRight`, `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`, `Equal`, `CheckCircle2`, `CalendarX`, `CalendarClock`, `Clock`, `AlertTriangle`, `FilePlus` e `History` existem no `lucide-react` do projeto. O P1 e o rodapé fixo do P80 continuam pedindo `viewport-fit=cover` na meta viewport do `index.html`, que ainda não tem.

### Estados
| Estado | Lista e filtros (T1 a T7) | Detalhe (T8 a T14) | Relatórios com o filtro Célula (T15) |
|---|---|---|---|
| Carregando | Primeira carga: 5 `Skeleton` no formato dos cartões ou das linhas. Ao aplicar um filtro ou trocar de página, a lista anterior fica com `opacity-60` e `aria-busy`, e o total anterior continua. Pessoas vindas da URL: "Carregando…" no campo e no chip | Vindo da lista, o topo e a situação do relatório na hora; o resto em `Skeleton`, com a altura reservada. Por link, "Célula" e `Skeleton` no `h1`, sem ações até a leitura chegar | O chip com "Célula: carregando…", e a lista com o carregando de hoje |
| Vazio | Com filtros ou busca: "Nenhuma célula encontrada com estes filtros." e "Limpar filtros". Sem nada: "Nenhuma célula encontrada.". Seletores sem resultado: "Nenhum líder de célula encontrado." e "Nenhum G12 encontrado." | Sem relatório visível: "Nenhum relatório para mostrar.", sem "Ver todos os relatórios" e sem a Evolução. Sem endereço: "Sem endereço" | "Nenhum relatório encontrado com estes filtros." e "Limpar filtros" |
| Erro ao carregar | `Alert` com o texto do Negócio e "Tentar de novo". A busca, os filtros e os chips continuam. Opções dos seletores: "Não foi possível carregar as opções. Tentar novamente" (E1.08) | Célula: `Alert` com o texto do Negócio e "Tentar de novo". Só os relatórios: o `Alert` da seção, e a Evolução escondida | O chip com "Célula: não carregada"; a lista, com o erro de hoje |
| Não encontrado ou sem permissão | Sem a lista de Células: a tela sem acesso da T12 do E2.02 | "Célula não encontrada", igual para os quatro casos da RN-14 e para quem só vê relatórios, com "Voltar para Células" ou "Ir para o início" | "Célula indisponível", com a dica e a lista vazia |
| Valor inválido | Da URL: sai, não é aplicado e não conta. Datas: as mensagens da T6, e o filtro de data não é aplicado. Pessoa indisponível: a T4 | Id sem formato: "Célula não encontrada", sem consulta | Id sem formato: sai da URL |
| Limite | Com 10 pessoas no Líder ou no G12: opções desabilitadas e "Escolha até 10 pessoas." | — | — |
| Sucesso | A lista e o total mudam, e o leitor de tela ouve o total. No celular, o painel fecha | O detalhe mostra os valores novos (P44), com o toast de cada ação e o foco da T14. Excluir a célula volta para a lista | — |
| Lista grande | Paginação do E1.08, com o total com separador de milhar. Com muitos chips, a lista desce, mas "Filtros" e "Limpar filtros" não saem do lugar. Seletores com 20 por página e "Carregar mais" | Só 3 relatórios e até 10 no gráfico. Uma célula com 400 relatórios abre igual (RN-14) | Paginação de hoje |
| Queda de conexão | Só leitura: o erro ao carregar, com os filtros mantidos na URL e na tela. No celular, "Aplicar filtros" fecha o painel, e a falha aparece na lista | Leitura: o erro ao carregar. Gravações: as mensagens de cada formulário e de cada confirmação (E2.01, E2.08 e E2.11), com os dados mantidos | Só leitura: o erro de hoje |

### Textos
Complementam os "Textos de tela" do Negócio, sem mudar os termos. Os marcados com † foram definidos pela UX e estão nas pendências (PO-UX-12).

| Onde | Texto |
|---|---|
| Busca | Buscar (rótulo) · Líder, timóteo, anfitrião, rua ou bairro (placeholder, do Negócio) |
| Botão e painel | Filtros · Filtros ({N}) · (leitor de tela) Filtros ({N} ativos) · Limpar filtros · no `Sheet`: Filtros (título), Limpar, Aplicar filtros · (leitor de tela) As mudanças valem quando você toca em Aplicar filtros. (E2.07) |
| Líder | Líder · Escolha uma ou mais pessoas · Mostra as células lideradas pelas pessoas escolhidas. · Nenhum líder de célula encontrado. † · opção: {Nome} ({nível}) † |
| G12 | G12 · Escolha uma ou mais pessoas · a dica do Negócio · Nenhum G12 encontrado. † |
| Líder e G12 | Escolha até 10 pessoas. · Pessoa indisponível · Esta pessoa não está disponível para você. · Estas pessoas não estão disponíveis para você. · Carregando… · Remover {Nome} (leitor de tela) |
| Rua, Bairro e Cidade | Rua · Bairro · Cidade |
| Tipo | Tipo · Evangelística · Discipulado · Macrocélula · no computador, sem escolha: Todos |
| Dia da semana | Dia da semana · Segunda-feira · Terça-feira · Quarta-feira · Quinta-feira · Sexta-feira · Sábado · Domingo · no computador, sem escolha: Todos |
| Situação | Situação · Todas · Ativa · Inativa |
| Situação do relatório (PO-UX-1) | Situação do relatório · Células inativas não têm situação do relatório. · Nesta semana † · Enviado · Ainda não ocorreu · Pendente · Conta a partir da próxima semana · Sem relatório nas semanas anteriores † · Na semana passada † · Nas 2 semanas anteriores † · Nas 3 semanas anteriores † · Nas 4 ou mais semanas anteriores † · no computador, sem escolha: Todas |
| Datas | Cadastrada a partir de · Cadastrada até · Data de cadastro (legenda, só para o leitor de tela) · Células antigas sem data de cadastro não aparecem quando há filtro de data. · Data inválida. Use o formato dd/mm/aaaa. · A data inicial precisa ser igual ou anterior à data final. |
| Chips | os do Negócio · Situação do relatório: {texto inteiro do E2.09} (por exemplo, "Situação do relatório: Sem relatório na semana passada") · Líder: Carregando… · G12: Carregando… · (leitor de tela) Remover filtro {texto do chip} |
| Lista | {N} células · 1 célula · Nenhuma célula encontrada com estes filtros. · Nenhuma célula encontrada. · Não foi possível carregar as células. Verifique a conexão e tente de novo. · Tentar de novo · (leitor de tela) Célula de {Líder}, {nível} (nome do link) † · Células, da cadastrada mais recentemente para a mais antiga. (legenda da tabela) † |
| Detalhe: topo | Voltar para Células · Ir para o início † (sem a lista de Células) · Célula de {Líder} · {Dia} · {HH:mm} · {Tipo} · (leitor de tela) Reunião: † · Ativa · Inativa |
| Detalhe: ações | Novo relatório · Editar célula † · Excluir célula · Ações da célula de {Líder} (leitor de tela, E2.01) |
| Detalhe: autoria | as do E2.05 (P30) · Ver histórico · Ver histórico da célula de {Líder} (leitor de tela) |
| Detalhe: seções | Situação do relatório · Pessoas da célula · Líder · Timóteo · Anfitrião · G12 · (leitor de tela, no "—") nenhum † · Endereço da célula · Sem endereço · CEP {00000-000} · s/n · Últimos relatórios · Evolução |
| Detalhe: situação do relatório | os valores, as explicações e as semanas anteriores do E2.09 · Célula inativa: sem situação do relatório. · Sem dia da reunião (E2.09) |
| Detalhe: cada relatório | {Dia}, {dd/mm/aaaa} às {HH:mm} · Célula realizada · Não houve célula · Tema: {tema} · Motivo: {motivo} · Participantes · Visitantes · Oferta · R$ {valor} · Não informada † · Observações: {texto} · (leitor de tela) mais que no relatório anterior · menos que no relatório anterior · igual ao relatório anterior · não se aplica † |
| Detalhe: setas | As setas comparam com o relatório anterior de célula realizada. † |
| Detalhe: todos os relatórios | Ver todos os relatórios · Ver todos os relatórios da célula de {Líder} (leitor de tela) † · Nenhum relatório para mostrar. |
| Detalhe: evolução | Evolução · Gráfico † · Tabela † · Participantes · Visitantes · Não houve célula · Data · (leitor de tela) Gráfico de linhas com participantes e visitantes de {N} relatórios, de {dd/mm/aaaa} a {dd/mm/aaaa}. Os números estão na aba Tabela. † · Participantes e visitantes por relatório, do mais antigo para o mais recente. (legenda da tabela) † |
| Detalhe: estados | Célula não encontrada · Ela não existe, foi excluída ou não está disponível para você. · Voltar para Células · Célula (h1 enquanto carrega ou na falha) † · Não foi possível carregar a célula. Verifique a conexão e tente de novo. · Não foi possível carregar os relatórios desta célula. Verifique a conexão e tente de novo. † · Tentar de novo |
| Relatórios: filtro Célula | Célula de {Líder} · {Dia} · {HH:mm} · Célula indisponível · Esta célula não está disponível para você. · Célula: carregando… † · Célula: não carregada † · Limpar filtros · Nenhum relatório encontrado com estes filtros. · (leitor de tela) Remover filtro {texto do chip} |
| Q-1 a Q-7, se adotadas † | os textos da T17 |

**Evitar nestas telas**, além do que o Negócio lista: "Status" como título de coluna; "Realizada" e "Não Realizada" no detalhe; "Editar" e "Excluir" sem objeto nas ações da célula; "Atrasado" e, com a PO-UX-1 aceita, "Em dia" (as palavras da situação são as do E2.09); o nome ou o id de uma pessoa ou de uma célula indisponível; e qualquer texto técnico (id, código, nome de parâmetro da URL).

### Acessibilidade
- **Lista:**
  - o link de cada célula (P81) tem o nome "Célula de {Líder}, {nível}", que contém o nome visível. As ações ficam fora do link, com os nomes do E2.01 e do E2.08;
  - o anel de foco do link cobre o cartão inteiro e não depende só de cor (`ring-2 ring-ring` com `ring-offset`);
  - a tabela tem `caption` em `sr-only`. Pelo teclado, só o link de cada linha recebe o foco; o clique na linha é só do mouse.
- **Painel de filtros:** tudo da Acessibilidade do E2.07 (o botão "Filtros", o `Sheet`, os grupos, as dicas, o `Popover`, os chips e os anúncios). A mais:
  - a Situação do relatório tem `fieldset` dentro de `fieldset` (P85), e a dica dela fica no `aria-describedby` do grupo de fora;
  - as opções do Líder têm o nível com os parênteses em `aria-hidden` e o prefixo "nível" em `sr-only` (P40).
- **Detalhe:**
  - títulos em ordem: `h1` (a célula), `h2` (Situação do relatório, Pessoas da célula, Endereço da célula, Últimos relatórios e Evolução) e `h3` (cada relatório, nos cartões);
  - cada seção é uma `section` com `aria-labelledby`. Pessoas da célula usa `dl`, `dt` e `dd`;
  - ao abrir a tela, o foco vai para o `h1` (`tabIndex={-1}`, sem anel visível quando não vem do teclado). Na volta para a lista, para o link da célula aberta;
  - os "·" do complemento e do chip ficam `aria-hidden`, e o leitor ouve "Reunião: Quarta, 20:00, Evangelística";
  - as setas são `aria-hidden`, com o sentido em `sr-only` logo depois do número. O "—" da tabela tem "não se aplica" em `sr-only`;
  - o rodapé fixo fica no fim do DOM, depois da Evolução, que é onde ele aparece. O botão do cabeçalho (a partir de 768 px) e o do rodapé são elementos diferentes, e o que não vale fica com `display: none`;
  - as ações de cada relatório têm os nomes do E2.01, com a data e o líder.
- **Gráfico (P83):** `figure` com `role="img"` e o resumo no `aria-label`. O SVG fica fora do foco, e a aba "Tabela" tem os mesmos dados. As abas seguem o `Tabs` do Radix (setas do teclado, `aria-selected`). O tooltip não é o único lugar de nenhuma informação.
- **Anúncios:** o total da lista com `role="status"`, uma vez a cada aplicação. O toast de cada ação depois de gravar. "Escolha até 10 pessoas." com `role="status"`. Os erros de carregamento em `Alert` (`role="alert"`) só depois de uma ação da pessoa ("Tentar de novo"); na primeira carga, sem `role="alert"`, para não interromper a leitura.
- **Sem depender de cor:** a situação da célula e a situação do relatório têm texto e ícone; o "Não houve célula" tem texto e ícone; as séries do gráfico têm traço e marcador; as setas são formas; "Pessoa indisponível" e "Célula indisponível" são texto.
- **Contraste, nos dois temas:** 4,5:1 para o texto (rótulos, dicas, explicações, valores, chips e eixos do gráfico em `muted-foreground`); 3:1 para as bordas dos controles e dos chips, para as setas e para as linhas e os marcadores do gráfico (T12).
- **Zoom de 200%, 320 px e fonte grande:** os nomes, o endereço, as observações, os chips, os badges ("Conta a partir da próxima semana") e a legenda do gráfico quebram linha, sem `truncate` e sem altura fixa. O gráfico encolhe na largura e mantém a altura. Nem a página, nem o `Sheet`, nem os cartões de relatório rolam na horizontal. A tabela de relatórios só aparece a partir de 1024 px.
- **Toque:** "Filtros", "Limpar filtros", "Aplicar filtros", "Limpar", cada opção dos filtros, "Voltar para Células", "Editar célula", o "⋯", o botão do rodapé, as ações de cada relatório, "Ver todos os relatórios" e "Ver histórico" têm pelo menos 44 px no celular. Os chips têm 36 px, e as abas, pelo menos 36 px, com 8 px entre os chips (acima dos 24 px da WCAG 2.5.8).
- **Movimento:** as animações do `Sheet`, do `Collapsible`, do `Popover`, do `Skeleton`, das `Tabs` e do gráfico respeitam `prefers-reduced-motion`. A rolagem até a célula aberta, na volta para a lista, é instantânea com `prefers-reduced-motion`.

### Critérios de UX
Numeração própria deste spec.

| ID | Critério | Como verificar |
|---|---|---|
| UX-01 | Em 360×800 e em 768×1024, Células mostra "Buscar" e "Filtros" (44 px de altura) e nenhum campo de filtro na página. "Filtros" abre o `Sheet`, de baixo em 360 e da direita em 768, com os 10 filtros na ordem da UXD-1 e os rótulos e as opções do Negócio. Em 1024×768 e em 1280×800, "Filtros" abre e fecha o painel acima da lista, com `aria-expanded`, e não há `Sheet`. | teste E2E (viewport) |
| UX-02 | Nenhum destes textos aparece no DOM de Células, do painel ou do detalhe: "Modalidade", "Logradouro", "Indiferente", "Discipuladora", "Status", "Dados da célula", "Linha de evolução", "Cadastrado a partir de", "Cadastrado até", "Formato: dd/mm/aaaa" e "Atrasado" (e "Em dia", com a PO-UX-1 aceita). A Situação começa em "Todas". As opções de dia aparecem de "Segunda-feira" a "Domingo", nessa ordem. | teste de componente |
| UX-03 | No `Sheet`, marcar opções não faz nenhuma requisição da lista. "Aplicar filtros" faz uma só, fecha o painel, volta para a página 1 e devolve o foco a "Filtros". "✕", `Esc` e o toque fora fecham sem mudar a lista nem a URL. "Limpar" esvazia os campos sem aplicar e sem apagar a busca. Ao abrir, o foco está no título "Filtros", e nenhum campo de texto está em foco. | teste de componente (rede simulada) + teste E2E (360×800) |
| UX-04 | No painel do computador, cada mudança vale sem botão: as seleções e as datas na hora, e Rua, Bairro e Cidade 300 ms depois da última tecla. A lista volta para a página 1 e fica com `opacity-60` e `aria-busy="true"` até a resposta. O painel de Células lembra se ficou aberto depois de recarregar, sem mudar o de Membros. | teste de componente (relógio simulado) + teste E2E |
| UX-05 | No critério da RN-12 (Líder André e Paula, G12 Pedro, Tipo Evangelística e Discipulado, Situação Ativa e as duas datas), o botão mostra "Filtros (5)", com o nome acessível "Filtros (5 ativos)", e aparecem 8 chips. Tirar "Tipo: Discipulado" mantém "Filtros (5)". Só com "Situação: Todas", o botão mostra "Filtros", sem número. Só com a busca, mostra "Filtros", e "Limpar filtros" aparece. Um valor inválido da URL não conta. | teste unitário (contagem) + teste de componente |
| UX-06 | Abaixo de 1024 px, e a partir daí com o painel fechado, cada valor ativo vira um chip, na ordem dos campos, com os textos da tabela de Textos. Cada chip é um `button` de 36 px, com 8 px de distância e `aria-label="Remover filtro …"`. O toque tira só aquele valor, sem "Aplicar filtros", volta para a página 1 e leva o foco ao próximo chip ou a "Filtros". Com o painel aberto, não há chips. | teste de componente + teste E2E (medida) |
| UX-07 | "Limpar filtros" fica logo depois de "Filtros", só aparece com filtro ativo ou busca e tem 44 px de altura. No critério da RN-12 (três filtros, busca "flores", página 2, 50 por página), ele deixa na URL só `size=50`, os campos e a busca vazios, e o foco em "Filtros". | teste E2E |
| UX-08 | Seletores (critérios da RN-04 e da RN-05): para Pedro, o Líder oferece exatamente "André Souza (144)", "Diego Reis (144)", "Gabriel Costa (20.736)" e "Paula Alves (G12)", e o G12 oferece "Paula Alves", "Pedro Alves" e "Tiago Rocha". Para André, o G12 oferece também "Tânia Rocha". A busca sem resultado diz "Nenhum líder de célula encontrado." ou "Nenhum G12 encontrado.". O menu fica aberto depois de cada escolha. Com 10 pessoas, as outras opções ficam desabilitadas, e "Escolha até 10 pessoas." aparece com `role="status"`. A dica do Negócio está no `aria-describedby` de cada seletor. | teste de componente + teste E2E (massa) |
| UX-09 | Pedro abre um link com G12: Tânia. O campo e o chip mostram "Pessoa indisponível", com "Esta pessoa não está disponível para você.", o total é "0 células", e aparece o vazio com filtros. "Tânia" e o id dela não estão no DOM nem nas respostas, e a tela não chama a `member_names`. Com Tânia e Pedro, a lista mostra C4 e C1. Tirar o chip tira o id da URL. Um id excluído e um id que não existe dão a mesma tela. "xyz" sai da URL e não conta. | teste E2E (rede inspecionada) + teste de componente |
| UX-10 | A Situação do relatório tem dois `fieldset` internos, com as legendas "Nesta semana" e "Sem relatório nas semanas anteriores", as opções da T5 e a dica do Negócio ligada ao grupo. Os chips levam o texto inteiro ("Situação do relatório: Sem relatório na semana passada"). No computador, o botão mostra "Todas" sem escolha, ou os textos inteiros. Com Situação: Inativa e Pendente, a lista fica vazia, com o vazio com filtros. | teste de componente |
| UX-11 | As datas usam os rótulos "Cadastrada a partir de" e "Cadastrada até", sem `max`, com a dica ligada aos dois campos. Os critérios da RN-11 mostram as mensagens do Negócio ao sair do campo e ao aplicar, nunca durante a digitação. Os chips são "Cadastrada a partir de 22/11/2026" e "Cadastrada até 28/11/2026", e as duas datas contam como um filtro. | teste de componente + teste E2E |
| UX-12 | A URL segue a tabela de Navegação e rotas, com os nomes que o `architect` confirmar e sem os valores padrão. Recarregar, voltar no navegador e abrir o link mostram os mesmos filtros, chips e total. Mudar um filtro não cria entrada no histórico. Com `type=abc&day=sat`, `type` sai da URL, o botão mostra "Filtros (1)", e Rita vê C4 e C8 (critério da RN-12). | teste E2E |
| UX-13 | Links prontos (RN-21), com Rita hoje às 21:00: `/cells?report_status=pending` mostra "Filtros (1)", o chip "Situação do relatório: Pendente", "1 célula" e C3; `/cells?type=evangelistic` mostra 4 células; `/cells?from=2026-11-22&to=2026-11-28` mostra só C2; `/cells?g12=<Pedro>,<Paula>&status=active` mostra C6 e C1. | teste E2E (massa) |
| UX-14 | O total aparece como "{N} células" ("1 célula", "1.234 células") acima da lista, com `role="status"`, e no rodapé. Com filtros ou busca e nenhum resultado, aparecem "Nenhuma célula encontrada com estes filtros." e "Limpar filtros" (`outline`, 44 px). Na primeira carga, 5 `Skeleton` no formato dos cartões ou das linhas, sem o "Carregando..." solto. Na falha, o `Alert` do Negócio com "Tentar de novo", e a busca, "Filtros" e os chips continuam funcionando. | teste de componente (mock) |
| UX-15 | Em 360×800, tocar em qualquer ponto do cartão de C1 fora das ações abre `/cells/<id de C1>`. Tocar em "Novo relatório", "Editar" ou "⋯" abre a ação e não navega. O link tem o nome acessível "Célula de André Souza, nível 144", e o anel de foco envolve o cartão inteiro. Em 1280×800, o nome do líder é o link, e o clique na linha também abre o detalhe, menos nos ícones de ação. No primeiro render em 360 px, a tabela não aparece. | teste E2E (viewport) + teste de componente |
| UX-16 | Recarregar `/cells/<id de C1>` mantém o detalhe. `/cells/deleted` continua abrindo a lista de excluídas para Rita. `/cells/xyz` mostra "Célula não encontrada" sem nenhuma requisição. No detalhe, o item "Células" do menu tem `aria-current="page"`. Hugo abre `/cells/<id de C2>` e vê o detalhe, sem a tela sem acesso. | teste E2E |
| UX-17 | Pedro, na lista com Tipo: Evangelística, na página 2, abre C1 e usa "Voltar para Células": a URL volta a ser a de antes, e a lista mostra C1 à vista, com o foco no link dela. O voltar do navegador dá o mesmo resultado. Aberto por link, "Voltar para Células" leva a `/cells`. Para Hugo e Lia, o link é "Ir para o início" e leva a `/`. | teste E2E |
| UX-18 | Conteúdo do detalhe (critérios da RN-15): para Rita, C1 mostra o `h1` "Célula de André Souza", o complemento "Quarta · 20:00 · Evangelística", o badge "Ativa", "André Souza (144)", "Caio Lima", "Carla Dias", o G12 "Pedro Alves", o endereço com "CEP 90010-000", a autoria e a situação do relatório. Para Pedro, C4 mostra "Gabriel Costa (20.736)", "Jonas Prado", "Fábio Lima (inativo)", o badge "Inativa" com o ícone e "Célula inativa: sem situação do relatório.". Para Diego, C7 mostra "Samuel Colares (Pastor)" e o G12 "Pastores". Para Ester, C8 mostra "Ester Ramos (Sem liderança)" e o G12 "—", lido como "nenhum". Para Rita, C6 mostra "Sem endereço". Os nomes não são links. | teste E2E (massa) + teste de componente |
| UX-19 | Ações (critérios da RN-16): em 360×800, Pedro vê em C1 "Novo relatório" no rodapé fixo (44 px, à vista em qualquer ponto da rolagem, acima da área segura e sem cobrir o fim do conteúdo), "Editar célula" e o "⋯" com "Excluir célula". Em 1280×800, vê "Novo relatório", "Editar célula" e "Excluir célula" no cabeçalho, nessa ordem, e nenhum rodapé. Em C4, não há "Novo relatório" nem rodapé. Caio vê só "Novo relatório" em C1 e em C2. Caio em C6 e Hugo em C2 não veem nenhuma ação, nem o rodapé, nem o "⋯". O leitor de tela nunca encontra a mesma ação duas vezes. | teste E2E (viewport e medida) + teste de componente |
| UX-20 | Depois de gravar (T14): Pedro muda o horário de C1 para 20:30, e o complemento mostra "Quarta · 20:30 · Evangelística" sem recarregar, com o foco de volta em "Editar célula". Pedro exclui C6 e volta à lista, sem C6, com o toast e o foco no `h1` "Células". Caio envia o relatório de 25/11, e ele aparece em primeiro, com a situação "Enviado · Célula realizada". Pedro exclui R1, e os últimos relatórios passam a R2, R4 e R5, com o foco no `h2` "Últimos relatórios". | teste E2E (massa) |
| UX-21 | Últimos relatórios (critérios da RN-17): para Pedro, C1 mostra R1, R2 e R4, nessa ordem, com "Quarta, 18/11/2026 às 20:00", "Tema: A fé que vence", 8 e 2, "R$ 50,00" e as observações em R1; "Motivo: Chuva forte no bairro", sem números, em R2; e "Tema: Perdão", 6 e 0 e "R$ 20,00" em R4. R3 não aparece. As setas são: R1 ↑ e ↑, R2 nenhuma, R4 ↑ e ↓, cada uma com o texto do Negócio em `sr-only`, e a frase das setas aparece. Em 360 e em 768 são cartões; em 1024 e em 1280, a tabela, com os números à direita. Nenhum nome de participante ou visitante aparece. Caio não vê "Editar" nem "Excluir" nos relatórios. | teste E2E (massa e viewport) + teste de componente |
| UX-22 | "Ver todos os relatórios" aparece em C1, com 44 px no celular e o nome acessível "Ver todos os relatórios da célula de André Souza", e abre `/cell-reports?cell=<id de C1>` na página 1, sem outro filtro. Em C4 e em C8, aparece "Nenhum relatório para mostrar.", sem "Ver todos os relatórios" e sem a seção Evolução. | teste E2E (massa) |
| UX-23 | Evolução (critérios da RN-20): para Pedro, C1 mostra, na aba "Gráfico", quatro posições em ordem cronológica (21/10, 28/10, 11/11 e 18/11), com participantes 5, 6, sem valor e 8, e visitantes 1, 0, sem valor e 2. Em 11/11, as linhas são interrompidas, e aparecem o "×", a linha vertical e o item "Não houve célula" na legenda. As séries se distinguem em escala de cinza. A aba "Tabela" mostra as mesmas quatro linhas, com "Não houve célula" em 11/11. A `figure` tem `role="img"` e o resumo. C6 mostra um ponto (R9). Com 12 relatórios, aparecem os 10 mais recentes. Com `prefers-reduced-motion`, não há animação. A área do gráfico tem a altura reservada desde o primeiro render. | teste de componente + teste E2E (massa) + inspeção |
| UX-24 | Diego abrindo C1, C5, um id que não existe e "xyz", e Lia abrindo C1, recebem o mesmo DOM: o `h1` "Célula não encontrada", a frase do Negócio e o botão ("Voltar para Células" para Diego, "Ir para o início" para Lia), sem nenhum dado da célula no DOM nem nas respostas. Vindo da lista, o topo aparece antes da leitura do detalhe, e as seções mostram `Skeleton`. Na falha da leitura, aparecem o `Alert` do Negócio e "Tentar de novo". Na falha só dos relatórios, o `Alert` da seção, e o resto funciona. | teste E2E (rede inspecionada) + teste de componente (mock) |
| UX-25 | Relatórios com o filtro Célula (critérios da RN-19): Pedro vê o chip "Célula de André Souza · Quarta · 20:00", com R1, R2, R4 e R5 e "4 relatórios"; tirar o chip mostra todos. Lia vê o mesmo chip e os 4. Diego vê "Célula indisponível", a dica e a lista vazia, e uma célula que não existe dá a mesma tela. Rita, com C5, vê "Célula de Jonas Prado · Sexta · 20:00" e R6 com "Célula excluída". Ester, com C8, vê "Nenhum relatório encontrado com estes filtros.". "xyz" sai da URL. O resto da tela não muda. | teste E2E (massa) |
| UX-26 | Toque, em 360×800: "Filtros", "Limpar filtros", "Aplicar filtros", "Limpar", cada opção dos filtros (a linha inteira), "Voltar para Células", "Editar célula", o "⋯", o botão do rodapé, as ações de cada relatório (44×44, com 8 px entre si), "Ver todos os relatórios" e "Ver histórico" têm pelo menos 44 px. Os chips têm 36 px, com 8 px entre si, e as abas, pelo menos 36 px. | teste E2E (medida) |
| UX-27 | Em 320×640 e com zoom de 200%, os cartões da lista, o `Sheet`, o detalhe, os cartões de relatório, o gráfico, a legenda e o chip de Relatórios não rolam na horizontal. Nomes, endereço, observações, badges e chips quebram linha sem corte, e o rodapé fixo não cobre o fim do conteúdo. | teste E2E (viewport) + inspeção |
| UX-28 | No detalhe, os títulos seguem `h1` → `h2` → `h3`. Pessoas da célula é uma `dl`. Cada seção tem `aria-labelledby`. Ao abrir, o foco está no `h1`. As abas da Evolução são navegáveis pelas setas do teclado. No painel, a Situação do relatório e os subgrupos são `fieldset` com `legend`, e as dicas estão no `aria-describedby` certo. | teste de componente + inspeção (axe e leitor de tela) |
| UX-29 | O contraste é de 4,5:1 para os textos (rótulos, dicas, explicações da situação, eixos do gráfico, chips e "Pessoa indisponível") e de 3:1 para as bordas dos controles, os chips, as setas e as linhas e os marcadores do gráfico, nos temas claro e escuro. Nenhum estado depende só de cor. | inspeção (axe, nos dois temas) |
| UX-30 | Nenhum texto técnico aparece na lista, no painel, no detalhe nem no chip de Relatórios: nada de id, código de erro, "statement timeout" nem nome de parâmetro da URL. Uma falha de leitura vira o `Alert` do Negócio. | teste de componente (mock) |
| UX-31 | Só se a alternativa for adotada: com a da Q-1, o detalhe de uma célula com 10 relatórios mostra 3 cartões e "Mostrar mais relatórios", que mostra os outros 7 sem requisição, com o foco no 4º; a tabela mostra os 10. Com a da Q-4, a lista abre só com as ativas, sem chip e sem número no botão, e o vazio de uma busca sem resultado oferece "Mostrar também as inativas". | teste de componente |

### Perguntas para o `architect` (dados e contrato)
Em cada uma, a tela tem um comportamento padrão (o mais conservador) se a resposta for "não", menos onde está dito que não há.

- **AQ-1. Parâmetros da URL** (RN-12, Navegação e rotas). Confirmar os nomes e os valores, ou trocá-los.
  - Sugestão: um módulo só (por exemplo, `src/lib/cells/filters.ts`), como o de Membros. Ele lê e valida a URL, monta a consulta, conta os filtros ativos, monta os chips e gera os links prontos. O E2.14 usa o mesmo módulo nos cards, para que card e lista nunca divirjam (RN-21).
  - O servidor valida os mesmos valores, porque a RN-03 vale também pela API.
  - *Padrão sem isso:* os nomes da tabela.
- **AQ-2. Opções e nomes do Líder e do G12** (RN-04 a RN-06, UXD-2).
  - As opções saem das células visíveis: id, nome e, no Líder, o nível (com a marca de pastor e o sexo, para o P40). Com busca sem acento e paginação no servidor (20 por página), para o `PaginatedSelect`.
  - Os ids da URL são resolvidos pela mesma fonte: o nome, quando a pessoa é visível ou é nome de referência numa célula visível; nada, nos outros casos, com a mesma resposta para a pessoa invisível, a excluída e a inexistente. Nunca pela `member_names`.
  - Nenhuma resposta traz o G12 ou a cadeia de quem não está numa célula visível (RN-06).
  - *Padrão sem isso:* não há. Sem essa leitura, o seletor mostraria nomes fora do escopo ou deixaria de mostrar os de referência.
- **AQ-3. A lista filtrada** (RN-02, RN-13): as linhas e o total exato, na ordem da RN-13 com o desempate estável, com as colunas dos cartões e da tabela (E2.06, E2.08 e E2.09), em até 2 s. Um tempo-limite volta como erro de leitura, sem texto técnico (UX-30).
- **AQ-4. Situação do relatório num componente só** (RN-10, RN-15 f; E2.09).
  - A mesma informação (a situação da semana, com o detalhe do "Enviado", e as semanas anteriores) na `cells_view` e na leitura do detalhe, para um componente comum, como um `ReportStatus`, usado no cartão, na tabela e no detalhe. A aparência é a que o E2.09 definir.
  - Os valores de `report_status` da URL correspondem um a um aos valores do E2.09 (PO-UX-1), e o servidor filtra por eles.
- **AQ-5. A leitura do detalhe** (RN-14, RN-15, UXD-12).
  - Uma leitura por id com tudo da T8: as pessoas com o nível e com a situação só das pessoas visíveis (P63), o G12, o endereço completo, a situação, a situação do relatório, a autoria (E2.05), `can_submit_report` e o que decide "Editar célula" e "Excluir célula".
  - A mesma resposta para a célula invisível, a excluída e a inexistente, sem nenhum dado.
  - Aberto pela lista, a linha já carregada serve de `placeholderData`, para o topo aparecer na hora. Se a leitura disser "não encontrada", o que veio da lista é descartado.
  - *Padrão sem isso:* o detalhe abre com `Skeleton` até a leitura chegar, como por link.
- **AQ-6. Os relatórios do detalhe** (RN-17, RN-18, RN-20, P-LCE-14).
  - Uma leitura com até 10 relatórios visíveis, do mais recente para o mais antigo: data, hora, realizada ou não, tema, motivo, observações, oferta e os números de participantes e de visitantes, sem os nomes.
  - Para cada um dos 3 primeiros, a comparação de cada número (maior, menor, igual ou nenhuma), calculada com o relatório visível de célula realizada anterior, mesmo que ele fique fora dos 10. Melhor vir pronta do servidor que calculada na tela.
  - A mesma leitura serve aos cartões e ao gráfico.
  - Dizer se a oferta pode ser vazia (PO-UX-10).
- **AQ-7. Rotas** (RN-14, Navegação e rotas).
  - `/cells/deleted` antes de `/cells/:id`, ou a confiança na regra do React Router 6.
  - O `canSeeRoute` (T12 do E2.02) não bloqueia `/cells/:id` por causa do prefixo `/cells`: quem não tem a lista (Hugo) abre o detalhe da própria célula.
  - O id é validado como UUID antes de qualquer consulta.
- **AQ-8. Volta à lista** (UXD-10). A URL da lista no estado da navegação, para "Voltar para Células", e o id da célula aberta (por exemplo, em `sessionStorage`), para a lista rolar até ela e pôr o foco no link, também pelo voltar do navegador.
  - *Padrão sem isso:* a lista volta com os filtros e a página, mas no topo, com o foco no `h1`.
- **AQ-9. Filtro Célula em Relatórios** (RN-19, P84).
  - A identificação (o nome do líder, o dia, o horário e se a célula foi excluída) só sai do servidor quando quem consulta vê a célula ou pelo menos um relatório não excluído dela. Nos outros casos, a mesma resposta para a célula invisível e a inexistente.
  - A lista filtrada usa o mesmo filtro, com o total exato.
- **AQ-10. O que gravar no detalhe desatualiza** (P44, T14). Além do que a AQ-8 do E2.08 já lista: a leitura do detalhe e a dos relatórios do detalhe, a cada gravação de célula ou de relatório, e a lista de Relatórios filtrada pela célula. Excluir a célula pelo detalhe atualiza a lista de Células antes da navegação, para ela não aparecer de volta.
- **AQ-11. Gráfico** (P83). O `chart.tsx` com o Recharts, que já estão no projeto, sem dependência nova.
  - As cores vêm dos tokens `--primary` e `--muted-foreground`, nada de hex.
  - O componente do gráfico é carregado sob demanda (`React.lazy`), para o detalhe não esperar o Recharts num celular de entrada.
  - Sem animação com `prefers-reduced-motion`.
- **AQ-12. Valores fora da regra pela API** (11 ids, data invertida ou inválida, opção desconhecida, `cell` inválido). A tela valida antes e nunca os envia. Definir o que o servidor faz, se receber (ignora ou recusa com um código), como na AQ-4 do E2.07.
  - *Padrão sem isso:* toda recusa da leitura vira o `Alert` de erro ao carregar.

### Pendências para o PO (resolvidas em 2026-11-24)
Nenhuma bloqueia o desenho. Em todas, a UX adotou a opção marcada como "*Adotado*".

O PO resolveu as doze em 2026-11-24, sem perguntas ao usuário:
- onze com o padrão da UX;
- a PO-UX-4 com a sugestão da UX.

Elas viraram os padrões P-LCE-22 a P-LCE-33 do Negócio. **Revisar no PR.** No Negócio, mudaram:
- as RN-04, RN-05, RN-10, RN-13, RN-14, RN-15, RN-16, RN-17, RN-19, RN-20 e RN-21, com os critérios delas;
- a massa de exemplo;
- os Textos de tela, as Telas afetadas, o Fora de escopo e os Impactos;
- a Q-3 e a Q-6.

Nesta seção, o PO só acrescentou a nota da T10 e trocou "Nenhum relatório enviado." por "Nenhum relatório para mostrar." na T11, em Estados, em Textos e no UX-22. No UX-23, "C2 mostra um ponto" passou a ser "C6 mostra um ponto (R9)", porque a massa perdeu o relatório de C2: ele era anterior ao cadastro da célula.

- **PO-UX-1. Alinhar a RN-10 com os valores do E2.09** (UXD-3, P85, T5). A RN-10, os critérios da RN-10 e da RN-21 e os Textos de tela usam os rótulos provisórios da CEL-05 ("Em dia", "Pendente nesta semana", "Sem relatório há N semanas"). O E2.09 fechou outros valores: a situação da semana (Enviado, Ainda não ocorreu, Pendente e Conta a partir da próxima semana) e as semanas anteriores sem relatório (1, 2, 3 e 4 ou mais).
  - *Adotado:* as opções do filtro são os valores do E2.09, em dois subgrupos, com as opções curtas no segundo ("Na semana passada"…) e os chips com o texto inteiro. "Enviado" é uma opção só, que junta "Célula realizada" e "Não houve célula". O equivalente do card de pendentes passa a "Situação do relatório: Pendente".
  - *Alternativa:* as opções do legado, que se sobrepõem, como sugere o Impactos do E2.09: "Relatório em dia" (Enviado, Ainda não ocorreu ou Conta a partir da próxima semana), "Ainda não ocorreu esta semana", "Pendente esta semana" e as quatro de semanas anteriores. Nesse caso, a T5 perde os subgrupos.
  - *Também para decidir:* "Enviado" com duas opções ("Enviado · Célula realizada" e "Enviado · Não houve célula").
  - *Também para alinhar:* o padrão da Q-3 daqui ("aparece só no filtro e no detalhe") e o Fora de escopo ("Situação do relatório como coluna ou selo na lista de Células: fora") contradizem o P-SIT-06 e a RN-09 do E2.09, que mostram a situação em cada célula da lista. O desenho (T1, T17) segue o E2.09; a Q-3 fica respondida por ele.
  - **Resolvida: aceito o padrão da UX (P-LCE-22; RN-10, RN-15 f e RN-21).**
    - **Opções:** as do E2.09, nos subgrupos "Nesta semana" e "Sem relatório nas semanas anteriores", com os chips em texto inteiro. As opções do legado, que se sobrepõem, não voltam: o líder procura no filtro o que vê na célula. O "Relatório em dia" do legado equivale a Enviado, Ainda não ocorreu e Conta a partir da próxima semana, e isso entrou no Impactos do E5.04.
    - **"Enviado" é uma opção só.** Nas duas, o relatório da semana chegou e a célula não está pendente. O E2.09 dá às duas a mesma aparência (P-SIT-13). Ver quem deixou de se reunir é a Q-2 do E2.09, e os relatórios de "Não houve célula" ficam na lista de Relatórios (E2.12).
    - **Combinação:** dentro do filtro, basta valer uma opção, também entre os subgrupos (RN-02).
    - **"Sem dia da reunião":** não é opção; a célula sem dia nunca entra no filtro.
    - **Card de pendentes:** o equivalente passou a "Situação do relatório: Pendente".
    - **Detalhe:** usa os componentes P70 a P72 do E2.09, sem aparência própria (RN-15 f, nota na T10).
    - **Alinhamento com o E2.09:** a Q-3 foi marcada como respondida pelo E2.09. O Fora de escopo passou a dizer que a situação na lista é do E2.09. A ordenação pela situação, que o E2.09 deixou para cá, ficou de fora (RN-13, Q-6).
    - **Massa e critérios:** a massa ganhou a tabela da situação do relatório às 21:00. Os critérios da RN-10 cobrem cada opção, a combinação entre os subgrupos, o "Enviado · Não houve célula", a virada de domingo (C3 vai para "Nas 2 semanas anteriores"), a célula cadastrada depois do prazo ("Conta a partir da próxima semana") e a célula sem dia.
- **PO-UX-2. A arrumação do detalhe** (UXD-5). O grupo "Reunião" vira o complemento do título ("Quarta · 20:00 · Evangelística"), a situação vira um badge ao lado dele, e o G12 vira a última linha de "Pessoas da célula". Os nomes dos outros grupos são os do Negócio.
  - *Adotado.*
  - *Alternativa:* os seis grupos do Negócio separados. No celular, isso custa cerca de 6 linhas a mais, repetindo o complemento do título.
  - **Resolvida: aceito o padrão da UX (P-LCE-23; RN-15).** Nada deixa de aparecer, muda só o agrupamento. A RN-15 (b), (c) e (e) passou a dizer onde ficam o G12, a reunião e a situação. Os Textos de tela trocaram "grupos" por "seções", e o critério da RN-15 confere o título com o complemento.
- **PO-UX-3. O caminho de volta para quem não tem a lista de Células** (UXD-10). Hugo (sem função, timóteo de C2) e Lia (só relatórios) abrem o detalhe ou a "Célula não encontrada" por link. "Voltar para Células" os levaria à tela sem acesso.
  - *Adotado:* para eles, o link e o botão são "Ir para o início" (o texto da T12 do E2.02).
  - *Alternativa:* "Voltar para Células" para todos.
  - **Resolvida: aceito o padrão da UX (P-LCE-24; RN-14).** A RN-14 passou a ter o "caminho de volta" para quem não tem a lista de Células (RN-22 do E2.02). Os critérios de Hugo e de Lia conferem o "Ir para o início".
- **PO-UX-4. "Nenhum relatório enviado." ao lado de "Enviado"** (T10, T11). Depois do E2.11, a visibilidade dos relatórios segue o retrato. Uma célula pode ter um relatório da semana que quem abre não vê. A situação diz "Enviado · Célula realizada" (RN-10 conta todos os relatórios), e os últimos relatórios dizem "Nenhum relatório enviado.".
  - *Adotado:* o texto do Negócio, sem mudança.
  - *Sugestão:* "Nenhum relatório para mostrar." †, que não afirma que nada foi enviado e não revela os relatórios que a pessoa não vê, porque é o mesmo texto em todos os casos. O critério da RN-17 (C4 e C8) mudaria junto.
  - **Resolvida: aceita a sugestão da UX, e não o padrão (P-LCE-25; RN-17).**
    - O texto antigo contradiria o "Enviado" exatamente no caso em que a pessoa não vê o relatório.
    - O texto novo é o mesmo em todos os casos, então também não revela o relatório invisível.
    - A RN-17 e os critérios mudaram: C4, C8 e um caso novo de "Enviado" com o relatório invisível.
    - "Nenhum relatório enviado." entrou na lista do que evitar.
    - O PO trocou o texto também na T11, em Estados, em Textos e no UX-22 desta seção.
- **PO-UX-5. O nível nas opções do Líder e os textos da busca sem resultado** (UXD-2). "André Souza (144)" no Líder, e só o nome no G12. Não revela nada além do que a linha da célula já mostra. Na busca sem resultado: "Nenhum líder de célula encontrado." e "Nenhum G12 encontrado.".
  - *Adotado.*
  - *Alternativa:* só o nome, como no filtro de Liderança de Membros.
  - **Resolvida: aceito o padrão da UX (P-LCE-26; RN-04 e RN-05).** O nível é o que a linha da célula já mostra (RN-11 do E2.06) e separa homônimos. A RN-04 e a RN-05 ganharam o formato da opção e a busca sem resultado, com critérios. Como o nível aparece também para os nomes de referência ("Diego (144)" para Pedro), a regra não revela nada novo: Pedro já lê "Diego (144)" na linha de C2.
- **PO-UX-6. Como a lista leva ao detalhe** (UXD-4, P81). O cartão inteiro, no celular, e o nome do líder, na tabela. Os atalhos "Dados da célula" e "Ver relatórios" do legado, em cada linha, não voltam. "Ver todos os relatórios" fica no detalhe, a um toque a mais que no legado.
  - *Adotado.*
  - *Alternativa:* "Ver relatórios" também no "⋯" de cada cartão e como ícone na tabela.
  - **Resolvida: aceito o padrão da UX (P-LCE-27; RN-14).** O detalhe concentra o que os dois atalhos do legado ofereciam, e a lista de Relatórios da célula fica a um toque dele. A RN-14 diz como a lista leva ao detalhe e que os atalhos não voltam, com critério.
- **PO-UX-7. "Novo relatório" no rodapé fixo e os nomes das ações da célula** (UXD-6). No celular, "Novo relatório" fica num rodapé fixo. As ações da célula no detalhe se chamam "Editar célula" e "Excluir célula" (o Negócio diz "Editar" e "Excluir"), porque a mesma tela tem o "Editar" e o "Excluir" de cada relatório.
  - *Adotado.*
  - **Resolvida: aceito o padrão da UX (P-LCE-28; RN-16).** A RN-16 passou a usar "Editar célula" e "Excluir célula" e a dizer que, no celular, "Novo relatório" fica no rodapé fixo. Ela também diz que a situação "Enviado" não tira a ação (P-SIT-17 do E2.09). Os critérios e os Textos de tela acompanham.
- **PO-UX-8. A comparação** (UXD-8, P82). As setas são neutras, sem o verde e o vermelho do legado, e "igual" é o sinal "=", e não o círculo do legado. Uma frase explica: "As setas comparam com o relatório anterior de célula realizada.".
  - *Adotado.*
  - *Alternativa:* setas coloridas. Para isso, a cor de sucesso precisaria de um token com 3:1 de contraste, que hoje não existe, e o sentido continuaria na forma da seta.
  - **Resolvida: aceito o padrão da UX (P-LCE-29; RN-17).** O sentido não pode depender da cor. A frase explica por que um relatório é comparado com outro que não aparece. Ela entrou na RN-17, no critério de C1 e nos Textos de tela.
- **PO-UX-9. O gráfico de evolução** (UXD-9, P83). Um gráfico de linhas, como no legado, com as abas "Gráfico" (padrão) e "Tabela". A tabela fica em ordem cronológica, como o gráfico. "Não houve célula" é um intervalo com o "×".
  - *Adotado.*
  - *Alternativa:* barras agrupadas, ou só a tabela no celular.
  - **Resolvida: aceito o padrão da UX (P-LCE-30; RN-20).** Mantém a "Linha de evolução" que os líderes conhecem, e a tabela dá os mesmos números a quem não lê o gráfico. A RN-20 passou a dizer "gráfico de linhas", o intervalo com o "×" e as abas. O critério de C1 confere a aba "Tabela". O critério de C2 passou para C6 (R9), porque o relatório de C2 era anterior ao cadastro da célula e saiu da massa.
- **PO-UX-10. Oferta sem valor** (T11). Se a oferta puder ficar vazia (AQ-6), o relatório mostra "Oferta: Não informada" †, e não "R$ 0,00", que afirmaria uma oferta zero.
  - *Adotado.*
  - **Resolvida: aceito o padrão da UX (P-LCE-31; RN-17).** Oferta é contribuição voluntária: zero e "não informado" são coisas diferentes. A RN-17 diz que a oferta de zero registrada aparece como "R$ 0,00" e que a oferta sem valor aparece como "Não informada", com critérios. Se o banco não permitir oferta vazia (AQ-6), "Não informada" nunca aparece. Os relatórios do legado sempre têm valor (ponto 11 dos Pontos para o `architect`).
- **PO-UX-11. Relatórios com o filtro Célula** (UXD-13, P84). O título da tela não muda; o chip diz de qual célula são os relatórios. O legado trocava o título para "Relatórios da célula".
  - *Adotado.*
  - *Alternativa:* o `h1` "Relatórios da célula de {Líder}" enquanto o filtro estiver ativo.
  - **Resolvida: aceito o padrão da UX (P-LCE-32; RN-19).** O chip já diz de qual célula são os relatórios, e um título que muda com o filtro deixaria de bater com o menu quando o E2.12 trouxer os outros filtros. A RN-19 e o critério de Pedro passaram a dizer que o chip fica acima da lista, com "Limpar filtros" ao lado, e que o título não muda.
- **PO-UX-12. Textos definidos pela UX** (marcados com † em Textos):
  - "Ir para o início" no detalhe;
  - "Nenhum líder de célula encontrado." e "Nenhum G12 encontrado.";
  - as legendas dos subgrupos e as opções curtas da Situação do relatório;
  - "Editar célula";
  - a frase das setas;
  - "Gráfico", "Tabela", o resumo do gráfico e as legendas das tabelas;
  - "Célula" como `h1` enquanto carrega e na falha;
  - o erro dos relatórios do detalhe;
  - "Célula: carregando…" e "Célula: não carregada";
  - "Não informada";
  - os textos para o leitor de tela ("Reunião:", "nenhum", "não se aplica" e os nomes dos links);
  - os textos das alternativas da T17, que só valem se a pergunta for respondida com a alternativa.
  - *Adotados.*
  - **Resolvida: todos aceitos, sem ajuste (P-LCE-33).** Os ligados a uma regra foram copiados para os Textos de tela do Negócio:
    - "Ir para o início";
    - as duas buscas sem resultado;
    - os subgrupos e as opções da Situação do relatório;
    - "Editar célula" e "Excluir célula";
    - a frase das setas;
    - "Gráfico" e "Tabela";
    - "Não informada";
    - "Nenhum relatório para mostrar.", vindo da PO-UX-4.

    Os textos da T17 só valem se o usuário adotar a alternativa da pergunta correspondente. A T17 da Q-3 já seguia o E2.09, como a Q-3 agora diz.

## Solução técnica
_Seção do `architect`. Escrita em 2026-11-24, só como desenho: nada foi implementado. **O PR 1 começa depois do banco do E2.02, do E2.05, do E2.06, do E2.07 (PR 1), do E2.08 (PR 2) e do E2.09 (PR 1) em produção** (ver [Ordem com os outros passos](#ordem-com-os-outros-passos)). O desenho parte do estado final desses passos, com os nomes que eles definem. Se um nome ou uma assinatura mudar lá, a tarefa 1 volta ao `architect`._

_Conferido em 2026-11-24, só com leitura:_
- _na stack local `supabase_db_mci-e108-pr2` (E1.08 e PRs 1 e 2 do E2.01):_
  - _as definições da `cells_view` e da `cell_reports_view`. A `cell_reports_view` já tem `participants_count` (conta todos os participantes, inclusive membros excluídos), `visitors_count`, `cell_leader_name`, `cell_meeting_day`, `cell_meeting_time` e `cell_deleted`;_
  - _`cell_reports.offering` é `numeric(10,2)`, **anulável**, com padrão 0. O formulário de hoje sempre manda um valor (0 quando vazio ou em "Não houve célula");_
  - _os índices de `cells` (nenhum em `created_at`), de `cell_reports` (`(cell_id, date DESC)` e o único por semana) e de `cell_report_participants` (PK `(report_id, member_id)`);_
  - _o *leakproof* dos operadores: `uuid_eq`, `texteq`, `int4eq`, `int2eq`, `booleq` e as comparações de `date` e `timestamptz` são *leakproof* e entram na view *security barrier*; `strpos` e `enum_eq` não são e rodam acima dela;_
  - _`authenticated` não tem USAGE em `private`;_
- _num Postgres 17.12 descartável (imagem `supabase/postgres` local, fora da stack e do projeto, apagado depois), com as views e as funções dos passos anteriores simuladas: o SQL de referência das duas migrations roda, as pós-condições passam, e os critérios das RN-02 a RN-07, RN-10, RN-11, RN-13, RN-14, RN-17 e RN-19 com parte da massa dão o resultado esperado;_
- _no `mci-connect` (`origin/main`, `4595daa`): `App.tsx` (sem rota de detalhe e sem `React.lazy`), `use-cells-list.ts`, `use-cell-reports-list.ts`, `use-cell.ts` (chave `["cells", "detail", id]`), `use-cell-options.ts`, `use-member-options.ts`, `use-paginated-select.ts`, `list-query.ts`, `search.ts`, `selectors.ts`, `src/lib/cells/*`, `CellReportForm.tsx` (oferta), `chart.tsx` (importa o Recharts inteiro, e nada usa o `chart.tsx` hoje) e o `index.html` (sem `viewport-fit=cover`);_
- _nos specs: E1.08 (Pontos de extensão), E2.01 (rotas de excluídos, `use-restore`), E2.02 (predicados canônicos, `can_submit_report`, `my_access`, `canSeeRoute`, `NoAccess`), E2.05 (DT-03, `RecordAuthorship`, `use-cell-report`), E2.06 (`private.member_hierarchy.g12_id`, `cells_view.g12_leader_id`, `use-min-width`, `refreshAfterCellWrite`), E2.07 (Solução técnica inteira: `members_list`, `private.text_key`, `sp_day_start`, componentes P50 a P54), E2.08 (`cell_types()`, `cell_weekdays()`, `use-member-statuses`, `CellFormDialog`) e a Solução técnica do E2.09, escrita em paralelo a esta (`cell_report_status`, `report_status`, `report_missing_weeks`, `ReportStatus`, `CellCard`, `CellsTable`, `CELL_LIST_SELECT`, `refreshAfterReportWrite`, P74)._

### Revisão das regras
Nenhuma RN voltou ao PO. As lacunas técnicas foram resolvidas pela leitura mais conservadora e estão em [Definidas pelo architect](#definidas-pelo-architect-revisar-no-pr). As perguntas Q-1, Q-2 e Q-4 a Q-7 ficam com o usuário: o desenho segue os padrões adotados, e o custo de cada alternativa está em [Perguntas Q-1 a Q-7](#perguntas-q-1-a-q-7-padrão-e-custo-das-alternativas).

Casos de borda conferidos:
- **Fuso e virada da semana:** a situação do relatório é a do E2.09, com `now()` da transação de cada chamada. A data de cadastro é comparada por intervalo de instantes, do início do dia "a partir de" ao início do dia seguinte ao "até", em Brasília (`sp_day_start`, E2.07). Nenhuma conta usa o relógio do aparelho.
- **Casal:** o G12 é por pessoa (Q-5). O ranking "Células por G12" é a soma das duas pessoas, e o equivalente da RN-21 manda as duas.
- **Inativo:** a pessoa inativa continua nas opções de Líder e G12 (as opções vêm das células, não dos membros) e recebe "(inativo)" no detalhe só para quem a vê (`members_view`).
- **Sem líder:** não existe depois do E2.08 (`leader_id NOT NULL`).
- **Pastor e sem liderança:** `g12_leader_id` nulo (E2.06), então nunca entram no filtro G12. Entram no Líder com o rótulo do P40.
- **Excluído:** a célula excluída não está na `cells_view`, então fica fora da lista, do total, das opções e do detalhe. Os relatórios dela continuam alcançáveis pelo filtro Célula de Relatórios (RN-19).
- **Sem cadastro e sem função:** a `cells_view` devolve nada ou só as células da própria pessoa (RN-02 d do E2.02), e todas as funções novas herdam isso.
- **Consolidado:** ponto de extensão. Nada aqui lê `members` direto.
- **Concorrência:** este passo só lê. Não há escrita nova, trava, trigger nem política de RLS nova. Ver os riscos 5 e 6 (duas chamadas e situação que muda com o tempo).
- **Volume:** ver [Metas de tempo e índices](#metas-de-tempo-e-índices).

Leituras técnicas. Nenhuma muda regra, mas o PO e o QA precisam saber delas:
1. **Valor que não tem o tipo do parâmetro, pela API** (id que não é uuid, código de situação que não existe, data impossível): o PostgREST recusa com 400 antes de a função rodar. A tela nunca manda esses valores, porque limpa a URL antes (RN-12). Os valores com o tipo certo, mas fora da regra, são normalizados como a tela faz (DA-1).
2. **As linhas e o total vêm de duas chamadas**, cada uma com a sua foto do banco e o seu "agora". Uma gravação, ou um prazo do E2.09 que passa entre as duas, pode deixar o total diferente das linhas por um instante. A leitura seguinte corrige (risco 5).
3. **Com o filtro "Situação do relatório", a situação de todas as células visíveis é calculada duas vezes** (página e total), como o E2.09 já previa (risco 1 de lá). Sem esse filtro, só as linhas da página a calculam.
4. **"Oferta: Não informada" quase não vai aparecer.** A coluna aceita nulo, mas o formulário de hoje grava 0 quando a oferta fica vazia. Só um relatório gravado com oferta nula pela API, ou o formulário do E2.11, se ele passar a aceitar vazio, mostram "Não informada" (Impactos: E2.11).
5. **A célula muda de opção com o tempo.** Entre a página 1 e a 2, um prazo pode passar, e uma célula filtrada por "Ainda não ocorreu" pode sumir da página seguinte ou aparecer duas vezes. É o comportamento esperado da P-SIT-08 do E2.09 ("a situação do momento da consulta"). Sem o filtro de situação, a ordem é por cadastro e nenhuma célula muda de página.

#### Respostas aos pontos do PO (Pontos para o `architect`)
| Ponto | Resposta |
|---|---|
| 1. Seletores de Líder e G12 | Duas funções *invoker* novas: `cell_filter_options` (as opções, só das linhas da `cells_view` de quem consulta) e `cell_filter_names` (os ids da URL: nome só para quem lidera ou é o G12 de uma célula visível, ou é visível como membro; nenhuma linha nos outros casos). Nenhuma lê a cadeia nem a `member_names`. O filtro compara `leader_id` e `g12_leader_id` das linhas visíveis, que já saem na lista (DA-3, DT-07). |
| 2. G12 da célula | `cells_view.g12_leader_id`, que o E2.06 tira de `private.member_hierarchy.g12_id` (o próprio G12 no nível 1; nulo para pastor e para quem está sem liderança). O índice `member_hierarchy_g12_id_idx` já existe. |
| 3. Situação do relatório | As colunas do E2.09, `cells_view.report_status` (enum `cell_report_status`) e `report_missing_weeks`, num cálculo só. O filtro é `report_status = ANY (…) OR report_missing_weeks = ANY (…)` dentro da RPC. "Enviado" vira `sent_held` e `sent_not_held` no front (DT-06). A paginação aceita a mudança com o tempo (leitura técnica 5). |
| 4. Relatórios visíveis no detalhe | `cell_recent_reports` lê a `cell_reports_view`, que tem o predicado canônico de relatório do E2.02 (e terá o retrato do E2.11). A situação continua vindo da `cells_view`, que conta todos os relatórios (E2.09). A porta da função é a célula visível (DA-4). |
| 5. Filtro Célula em Relatórios | A lista é a `cell_reports_view` com `cell_id=eq.` (índice `(cell_id, date DESC)`). A identificação é a `cell_identity`, que só responde se a célula está na `cells_view` de quem consulta ou se há um relatório dela na `cell_reports_view` dele. A célula excluída é identificada pelo relatório (DA-10). |
| 6. Comparação e evolução | Os até 10 relatórios vêm numa leitura só, com o sinal da comparação de participantes e de visitantes já calculado no servidor contra o relatório visível de célula realizada anterior, mesmo fora dos 10 (janela sobre todos os relatórios visíveis da célula). Sem nomes. |
| 7. Desempenho | Ver [Metas de tempo e índices](#metas-de-tempo-e-índices). Texto sem acento por `strpos` sobre `private.text_key`; G12 por `uuid_eq` (*leakproof*, entra na view); data por intervalo de `timestamptz` (*leakproof*, com índice novo); situação pelas colunas do E2.09, calculadas só com o filtro ativo. |
| 8. Ordem | Dentro da RPC: `created_at DESC NULLS LAST, id`, a mesma de hoje com a DT-03 do E2.05. A página é escolhida só com essas chaves. |
| 9. Endereço do detalhe | `/cells/:id`, declarada depois de `/cells/deleted` (o React Router 6 também dá preferência ao segmento fixo). O id é conferido como UUID no front antes de qualquer leitura. A célula invisível, a excluída e a inexistente não voltam da `cells_view`, e o detalhe mostra o mesmo estado. |
| 10. Ordem dos passos | Ver [Ordem com os outros passos](#ordem-com-os-outros-passos). Se o E2.09 atrasar, o plano B está no risco 12. |
| 11. Oferta sem valor | A coluna já aceita nulo. O detalhe mostra "Não informada" para nulo e "R$ 0,00" para zero. Ver a leitura técnica 4. |

#### Definidas pelo architect (revisar no PR)
Pontos que as RNs não respondem por inteiro. O `architect` adotou a leitura mais conservadora e coerente com elas. O usuário pode mudar qualquer um no PR.

| # | Ponto | Padrão adotado | Por quê |
|---|---|---|---|
| DA-1 | O que o servidor faz com valores fora da regra (AQ-12) | Valor que não tem o tipo do parâmetro: recusa do PostgREST (400). Valor com o tipo certo: normalizado como a tela, sem erro:<br>- Líder e G12: os 10 primeiros ids distintos;<br>- tipo fora de `cell_types()`, dia fora de 0 a 6, `no_meeting_day` e semanas fora de 1 a 4 são ignorados;<br>- rua, bairro e cidade usam os 100 primeiros caracteres; a busca, os 5 primeiros padrões;<br>- datas invertidas desligam o filtro de data inteiro;<br>- `_limit` fica entre 1 e 100, e `_offset` negativo vira 0;<br>- `cell_recent_reports` devolve no máximo 10. | É a DA-1 do E2.07. A RN-04 pede os 10 primeiros pela API, e a RN-12 pede que o inválido seja ignorado. A tela nunca chega a esses casos. |
| DA-2 | Ids repetidos ou nulos no Líder e no G12 | Contam uma vez, na posição da primeira aparição; os nulos são ignorados; as 10 pessoas são contadas depois disso. | DA-2 do E2.07: "as 10 primeiras" fala de pessoas, e não de posições. |
| DA-3 | O servidor não confere a visibilidade das pessoas escolhidas no Líder e no G12 | O filtro compara `leader_id` e `g12_leader_id` das linhas da `cells_view`. Um id de quem não lidera (ou não é o G12 de) nenhuma célula visível não traz nada, e é isso que a tela mostra como "Pessoa indisponível" (RN-06). | O resultado é sempre um subconjunto da `cells_view`, e as duas colunas já saem nas linhas que a pessoa vê. Ao contrário da Liderança do E2.07, aqui nenhum dado privado (a cadeia) é lido. |
| DA-4 | Relatórios do detalhe para quem não vê a célula | `cell_recent_reports` devolve vazio quando a célula não está na `cells_view` de quem consulta, mesmo que ele veja os relatórios. | RN-14 e UX-24: no detalhe que não abre (Lia), nenhum dado da célula sai do servidor. Assim, o front pode pedir a célula e os relatórios em paralelo. Quem só vê relatórios continua com eles em Relatórios (RN-19). |
| DA-5 | Largura em que a lista troca o cartão pela tabela | A do E2.09 para Células (P74): cartões até 1279 px, tabela a partir de 1280 px. Vale o sentido da RN-14: no cartão, o cartão inteiro abre o detalhe; na tabela, o nome do líder. O painel de filtros continua trocando em 1024 px (P50), e a tabela dos últimos relatórios do detalhe também (UXD-8). | A RN-14, a T1 e a UXD-4 dizem "até 1023 px" porque partiram do P45. O E2.09 vem antes e mudou a quebra de Células. Duas quebras na mesma lista seriam um erro. O `ux-designer` confirma na revisão do PR 5. |
| DA-6 | "Situação do relatório" com todas as opções marcadas | Vale como filtro: traz todas as células com situação (ativas e com dia válido). Conta como filtro ativo. | RN-02 (basta valer uma); a DA-8 do E2.07. |
| DA-7 | Datas invertidas vindas de um link | Ficam na URL, não são aplicadas, não contam como filtro nem viram chip. O painel mostra a mensagem da RN-11 quando é aberto. Pela API, o filtro de data inteiro é ignorado. | DA-4 do E2.07: as duas datas são válidas, só a combinação não é. |
| DA-8 | Ordem das opções de Líder e G12 | Nome sem acento e em minúsculas, comparado byte a byte (`COLLATE "C"`), e o `id`. | "Ordem alfabética" (AQ-2), com desempate estável, como a DT-05 do E2.07. |
| DA-9 | O relatório "anterior" da comparação | O relatório visível de célula realizada imediatamente anterior pela data, pelo horário e pelo `id`. Os números comparados são os da `cell_reports_view`: participantes com os membros excluídos (RN-13 do E2.01) e visitantes pelo tamanho da lista. | RN-17 e RN-18. Com um relatório por célula por semana, a data já decide; o horário e o `id` só garantem uma ordem total. |
| DA-10 | Identificação da célula no chip de Relatórios | Os valores **atuais** da célula: da `cells_view`, quando quem consulta a vê; senão, das colunas da célula num relatório visível dela (`cell_reports_view`). | A RN-19 fala da célula, e não do retrato do relatório (E2.11). A célula excluída só é alcançável pelo relatório. |
| DA-11 | Nome de quem a pessoa vê como membro, mas que não lidera nem é o G12 de nenhuma célula visível (Rita com Líder: Caio, ou com G12: Caio) | Aparece pelo nome, nos dois seletores, com a lista vazia. | Leitura literal da RN-06 ("quando quem consulta vê essa pessoa"). |
| DA-12 | `sent_held` ou `sent_not_held` sozinhos, pela API | Aceitos: filtram só um dos dois "Enviado". A tela sempre manda os dois juntos (P-LCE-22). | São valores do tipo certo e só restringem (RN-03). Recusar exigiria uma regra a mais no servidor, sem ganho de segurança. |

### Visão geral
Cinco partes:
1. **A lista por RPC** (migration 1): `cells_list` (a página) e `cells_list_count` (o total), *definer*, com os 10 filtros e a busca como parâmetros tipados. As duas leem só a `cells_view` e montam o `WHERE` só com os filtros ativos, como no E2.07.
2. **Os seletores** (migration 1): `cell_filter_options` e `cell_filter_names`, *invoker*, sobre as células visíveis.
3. **O detalhe e o filtro Célula** (migration 2): `cell_recent_reports` (até 10 relatórios visíveis, com a comparação) e `cell_identity` (o chip de Relatórios), *invoker*. A célula do detalhe é a própria `cells_view` por id.
4. **Front:** Células com os filtros na URL; a tela nova do detalhe em `/cells/:id`; o filtro Célula em Relatórios; dois componentes de filtro novos (P84 e P85).
5. **Nada de escrita nova:** nenhuma tabela, coluna, trigger, trava ou política de RLS muda.

### Modelo de dados e migrations

#### Ordem das migrations
Os nomes são sugestões; o timestamp é o do momento da criação.
- Cada arquivo é idempotente (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DO` com guarda de `duplicate_object`) e roda num banco zerado depois das migrations existentes e das do E2.01, do E2.02, do E2.04, do E2.05, do E2.06, do E2.07, do E2.08 e do E2.09.
- **Cada arquivo deixa o banco coerente sozinho**, e nenhum muda a `cells_view` nem a `cell_reports_view`.
- As mensagens das guardas trazem só nomes de objetos, nunca dado pessoal (os logs do GitHub Actions de um repositório público são públicos).
- Depois do PR 1, regenere o `types.ts`.

| # | PR | Arquivo | Conteúdo | Estado depois dele |
|---|---|---|---|---|
| 1 | 1 | `<ts>_e210_01_cell_list.sql` | Guarda de pré-requisitos; enum `cell_filter_person`; `first_distinct_ids`; índice `cells_created_at_idx`; tipo `private.cell_filter`, `private.cell_filter_normalize` e `private.cell_filter_sql`; `cells_list` e `cells_list_count`; `cell_filter_options` e `cell_filter_names`; privilégios; pós-condições. | As funções existem, sem leitor até os PRs 4 e 5. A lista em produção continua lendo a `cells_view` direto. |
| 2 | 1 | `<ts>_e210_02_cell_detail.sql` | Guarda; `cell_recent_reports` e `cell_identity`; privilégios; pós-condições. | Idem, sem leitor até os PRs 3 e 5. |

#### A lista (migration 1)

##### Filtros, parâmetros e condições
| Filtro (na URL) | Parâmetro | Normalização (`private.cell_filter_normalize`) | Condição sobre `cells_view v` (`private.cell_filter_sql`) |
|---|---|---|---|
| busca (`q`) | `_search text[]`: os padrões do `toSearchPatterns` (E1.08) | até 5, sem os vazios | `v.search_text ILIKE ALL (…)` |
| Líder (`leaders`) | `_leader_ids uuid[]` | `first_distinct_ids(…, 10)`; vazio = sem filtro (DA-2, DA-3) | `v.leader_id = ANY (…)` |
| G12 (`g12`) | `_g12_ids uuid[]` | idem | `v.g12_leader_id = ANY (…)` |
| Rua, Bairro, Cidade (`street`, `neighborhood`, `city`) | `_street text`, `_neighborhood text`, `_city text` | `private.text_key(left(x, 100))`; vazio = sem filtro | `strpos(private.text_key(v.street), …) > 0` (e o mesmo para bairro e cidade) |
| Tipo (`type`) | `_types text[]`, com os valores de `cell_types()` ('Evangelística'…) | sem repetidos; fora de `cell_types()` ignorado | `v.type = ANY (…)` |
| Dia da semana (`day`) | `_weekdays integer[]`, 0 = domingo … 6 = sábado (`weekday_index`) | 0 a 6, sem repetidos | `v.meeting_weekday = ANY (…)` |
| Situação (`status`) | `_is_active boolean` | — | `v.is_active = …` |
| Situação do relatório (`report_status`) | `_report_statuses cell_report_status[]` e `_missing_weeks integer[]` (1 a 4; 4 = "4 ou mais") | sem repetidos; `no_meeting_day` e semanas fora de 1 a 4 ignorados | `(v.report_status = ANY (…) OR v.report_missing_weeks = ANY (…))` |
| Datas de cadastro (`from`, `to`) | `_created_from date`, `_created_to date` (Brasília) | invertidas: sem filtro de data (DA-7) | `v.created_at >= sp_day_start(from)` e `v.created_at < sp_day_start(to + 1)` |

- **Combinação (RN-02):** os fragmentos são ligados por `AND`. Dentro de um filtro de múltipla escolha, `= ANY` dá o "basta valer uma"; na Situação do relatório, o `OR` junta os dois subgrupos (RN-10).
- **A célula sem situação nunca entra no filtro de situação:** a inativa tem as duas colunas nulas, e a sem dia tem `no_meeting_day` (ignorado na normalização) e a contagem nula (DA-6 do E2.09). Nulo não satisfaz `= ANY`.
- **"Enviado" é feito no front:** a opção `sent` da URL vira `{sent_held, sent_not_held}` em `_report_statuses` (DA-12).
- **Sem rua (ou bairro, ou cidade):** `private.text_key(null)` é nulo, e `strpos` também; a célula fica de fora (RN-07).
- **"Data não registrada":** `created_at` nulo não satisfaz nenhuma comparação e fica fora com qualquer data (RN-11).

##### Código de referência (migration 1)
```sql
-- 0. Pré-requisitos. Falha cedo, sem mudar nada.
DO $$ BEGIN
  IF to_regprocedure('private.text_key(text)') IS NULL                 -- E2.07, PR 1
     OR to_regprocedure('public.sp_day_start(date)') IS NULL           -- E2.07, PR 1
     OR to_regprocedure('public.cell_types()') IS NULL                 -- E2.08, PR 2
     OR to_regtype('public.cell_report_status') IS NULL                -- E2.09, PR 1
     OR EXISTS (SELECT 1
                  FROM unnest(ARRAY['g12_leader_id', 'leader_g12_level', 'leader_is_pastor',
                                    'leader_gender', 'meeting_weekday', 'can_submit_report',
                                    'created_by_name', 'report_status', 'report_missing_weeks']) c(col)
                 WHERE NOT EXISTS (SELECT 1 FROM pg_attribute
                                    WHERE attrelid = 'public.cells_view'::regclass
                                      AND attname = c.col AND NOT attisdropped)) THEN
    RAISE EXCEPTION 'E2.10 depende do PR 1 do E2.07, do PR 2 do E2.08, do PR 1 do E2.09 e das colunas do E2.02, do E2.05 e do E2.06 na cells_view.';
  END IF;
END $$;

-- 1. Qual pessoa da célula o seletor oferece (RN-04, RN-05).
DO $$ BEGIN
  CREATE TYPE public.cell_filter_person AS ENUM ('leader', 'g12');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. "Os 10 primeiros" (RN-04, DA-2), num lugar só. Pura; as funções invoker a chamam,
--    então fica em public com EXECUTE para authenticated, como search_normalize.
CREATE OR REPLACE FUNCTION public.first_distinct_ids(_ids uuid[], _max integer)
RETURNS uuid[] LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
  SELECT ARRAY(SELECT t.x FROM unnest(_ids) WITH ORDINALITY AS t(x, i)
                WHERE t.x IS NOT NULL
                GROUP BY t.x ORDER BY min(t.i) LIMIT greatest(_max, 0))
$$;

-- 3. Datas de cadastro e ordem (RN-11, RN-13). As comparações de timestamptz são leakproof:
--    o filtro entra na view. A tarefa 1 confere se o E2.05 já criou um índice equivalente.
CREATE INDEX IF NOT EXISTS cells_created_at_idx
  ON public.cells (created_at DESC NULLS LAST, id) WHERE deleted_at IS NULL;

-- 4. O filtro normalizado.
DO $$ BEGIN
  CREATE TYPE private.cell_filter AS (
    search          text[],                            -- padrões ILIKE (E1.08)
    leader_ids      uuid[],                            -- até 10, na ordem da escolha
    g12_ids         uuid[],
    street          text,                              -- private.text_key; nulo = sem filtro
    neighborhood    text,
    city            text,
    types           text[],                            -- valores de cell_types()
    weekdays        integer[],                         -- 0 = domingo … 6 = sábado
    is_active       boolean,
    report_statuses public.cell_report_status[],       -- sem no_meeting_day
    missing_weeks   integer[],                         -- 1 a 4 (4 = "4 ou mais")
    created_from    timestamptz,                       -- início do dia "a partir de" (Brasília)
    created_until   timestamptz);                      -- início do dia seguinte ao "até" (exclusivo)
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Os valores como a tela os aplica (DA-1, DA-2, DA-7). Só é chamada pelas duas RPCs.
CREATE OR REPLACE FUNCTION private.cell_filter_normalize(
  _search text[], _leader_ids uuid[], _g12_ids uuid[],
  _street text, _neighborhood text, _city text,
  _types text[], _weekdays integer[], _is_active boolean,
  _report_statuses public.cell_report_status[], _missing_weeks integer[],
  _created_from date, _created_to date)
RETURNS private.cell_filter LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  _f private.cell_filter;
BEGIN
  _f.search := (SELECT array_agg(s.p ORDER BY s.i)
                  FROM (SELECT t.p, t.i FROM unnest(_search) WITH ORDINALITY t(p, i)
                         WHERE coalesce(t.p, '') <> '' ORDER BY t.i LIMIT 5) s);
  _f.leader_ids   := nullif(public.first_distinct_ids(_leader_ids, 10), '{}');
  _f.g12_ids      := nullif(public.first_distinct_ids(_g12_ids, 10), '{}');
  _f.street       := nullif(private.text_key(left(_street, 100)), '');
  _f.neighborhood := nullif(private.text_key(left(_neighborhood, 100)), '');
  _f.city         := nullif(private.text_key(left(_city, 100)), '');
  _f.types        := nullif(ARRAY(SELECT DISTINCT x FROM unnest(_types) x
                                   WHERE x = ANY (public.cell_types())), '{}');
  _f.weekdays     := nullif(ARRAY(SELECT DISTINCT x FROM unnest(_weekdays) x
                                   WHERE x BETWEEN 0 AND 6), '{}');
  _f.is_active    := _is_active;
  _f.report_statuses := nullif(ARRAY(SELECT DISTINCT x FROM unnest(_report_statuses) x
                                      WHERE x IS NOT NULL AND x <> 'no_meeting_day'), '{}');
  _f.missing_weeks   := nullif(ARRAY(SELECT DISTINCT x FROM unnest(_missing_weeks) x
                                      WHERE x BETWEEN 1 AND 4), '{}');
  IF _created_from IS NULL OR _created_to IS NULL OR _created_from <= _created_to THEN   -- RN-11
    _f.created_from  := public.sp_day_start(_created_from);
    _f.created_until := public.sp_day_start(_created_to + 1);
  END IF;
  RETURN _f;
END $$;

-- O WHERE, num lugar só. Só fragmentos fixos; os valores vêm de $1 (o filtro) por USING.
-- Nunca concatene um valor aqui.
CREATE OR REPLACE FUNCTION private.cell_filter_sql(_f private.cell_filter)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT concat_ws(' AND ', 'true',
    CASE WHEN _f.search IS NOT NULL THEN 'v.search_text ILIKE ALL (($1).search)' END,
    CASE WHEN _f.leader_ids IS NOT NULL THEN 'v.leader_id = ANY (($1).leader_ids)' END,
    CASE WHEN _f.g12_ids IS NOT NULL THEN 'v.g12_leader_id = ANY (($1).g12_ids)' END,
    CASE WHEN _f.street IS NOT NULL THEN 'strpos(private.text_key(v.street), ($1).street) > 0' END,
    CASE WHEN _f.neighborhood IS NOT NULL
         THEN 'strpos(private.text_key(v.neighborhood), ($1).neighborhood) > 0' END,
    CASE WHEN _f.city IS NOT NULL THEN 'strpos(private.text_key(v.city), ($1).city) > 0' END,
    CASE WHEN _f.types IS NOT NULL THEN 'v.type = ANY (($1).types)' END,
    CASE WHEN _f.weekdays IS NOT NULL THEN 'v.meeting_weekday = ANY (($1).weekdays)' END,
    CASE WHEN _f.is_active IS NOT NULL THEN 'v.is_active = ($1).is_active' END,
    CASE WHEN _f.report_statuses IS NOT NULL OR _f.missing_weeks IS NOT NULL THEN
      '(v.report_status = ANY (coalesce(($1).report_statuses, ''{}''))'
      || ' OR v.report_missing_weeks = ANY (coalesce(($1).missing_weeks, ''{}'')))' END,
    CASE WHEN _f.created_from IS NOT NULL THEN 'v.created_at >= ($1).created_from' END,
    CASE WHEN _f.created_until IS NOT NULL THEN 'v.created_at < ($1).created_until' END)
$$;

-- A página, na ordem da RN-13. Quem aparece é decidido só pela cells_view (escopo e excluídas),
-- que filtra por auth.uid() também aqui dentro. É definer só para chamar os auxiliares de
-- private sem dar USAGE no schema aos papéis da API (risco 7 do E2.09).
CREATE OR REPLACE FUNCTION public.cells_list(
  _search text[] DEFAULT NULL, _leader_ids uuid[] DEFAULT NULL, _g12_ids uuid[] DEFAULT NULL,
  _street text DEFAULT NULL, _neighborhood text DEFAULT NULL, _city text DEFAULT NULL,
  _types text[] DEFAULT NULL, _weekdays integer[] DEFAULT NULL, _is_active boolean DEFAULT NULL,
  _report_statuses public.cell_report_status[] DEFAULT NULL, _missing_weeks integer[] DEFAULT NULL,
  _created_from date DEFAULT NULL, _created_to date DEFAULT NULL,
  _limit integer DEFAULT 25, _offset integer DEFAULT 0)
RETURNS SETOF public.cells_view
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _f   private.cell_filter := private.cell_filter_normalize(
         _search, _leader_ids, _g12_ids, _street, _neighborhood, _city, _types, _weekdays,
         _is_active, _report_statuses, _missing_weeks, _created_from, _created_to);
  _ids uuid[];
BEGIN
  -- 1. Os ids da página, calculando só as chaves da ordem e as colunas dos filtros ativos.
  EXECUTE format(
    'SELECT array_agg(p.id ORDER BY p.created_at DESC NULLS LAST, p.id)
       FROM (SELECT v.id, v.created_at
               FROM public.cells_view v
              WHERE %s
              ORDER BY v.created_at DESC NULLS LAST, v.id
              LIMIT $2 OFFSET $3) p',
    private.cell_filter_sql(_f))
    INTO _ids
    USING _f, least(greatest(coalesce(_limit, 25), 1), 100), greatest(coalesce(_offset, 0), 0);
  -- 2. As linhas da página. "id = ANY" é leakproof: entra na view e usa cells_pkey.
  RETURN QUERY
    SELECT v.* FROM public.cells_view v
     WHERE v.id = ANY (_ids)
     ORDER BY array_position(_ids, v.id);
END $$;

-- O total, com a mesma normalização e o mesmo WHERE.
CREATE OR REPLACE FUNCTION public.cells_list_count(
  _search text[] DEFAULT NULL, _leader_ids uuid[] DEFAULT NULL, _g12_ids uuid[] DEFAULT NULL,
  _street text DEFAULT NULL, _neighborhood text DEFAULT NULL, _city text DEFAULT NULL,
  _types text[] DEFAULT NULL, _weekdays integer[] DEFAULT NULL, _is_active boolean DEFAULT NULL,
  _report_statuses public.cell_report_status[] DEFAULT NULL, _missing_weeks integer[] DEFAULT NULL,
  _created_from date DEFAULT NULL, _created_to date DEFAULT NULL)
RETURNS bigint
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _f private.cell_filter := private.cell_filter_normalize(
       _search, _leader_ids, _g12_ids, _street, _neighborhood, _city, _types, _weekdays,
       _is_active, _report_statuses, _missing_weeks, _created_from, _created_to);
  _n bigint;
BEGIN
  EXECUTE 'SELECT count(*) FROM public.cells_view v WHERE ' || private.cell_filter_sql(_f)
     INTO _n USING _f;
  RETURN _n;
END $$;
```
- **Por que SQL dinâmico:** com um `WHERE` fixo do tipo `(_x IS NULL OR …)`, toda coluna citada seria calculada para cada célula visível, mesmo com o filtro desligado, porque a view não é achatada. Com o texto montado só com os filtros ativos, a situação do relatório (uma chamada por célula, E2.09) e a busca só custam quando são usadas.
- **Por que a página em duas etapas:** a etapa 1 percorre o conjunto filtrado calculando só as chaves da ordem e as colunas dos filtros ativos. A etapa 2 calcula todas as colunas da view para as linhas da página. Um `JOIN` entre as duas faria a view inteira ser calculada, porque um *join* não entra numa view *security barrier*; o `id = ANY (…)` entra.
- **Por que a ordem vem pronta:** sem `order` na chamada, o PostgREST lê a função na ordem em que ela devolve (conferido no E2.07). O front não chama `.order()`.
- **`STABLE`:** as duas consultas de dentro usam a mesma foto do banco e o mesmo `now()`.

##### Os seletores (migration 1)
```sql
-- Opções do Líder e do G12 (RN-04, RN-05, DA-8): só quem aparece numa linha da cells_view de quem
-- consulta, ativa ou inativa. Invoker: a view decide o escopo. Paginada aqui dentro, para a ordem
-- não depender do PostgREST (o seletor pede 21 linhas, como os outros).
CREATE OR REPLACE FUNCTION public.cell_filter_options(
  _person public.cell_filter_person, _search text[] DEFAULT NULL,
  _limit integer DEFAULT 21, _offset integer DEFAULT 0)
RETURNS TABLE (id uuid, name text, g12_level integer, is_pastor boolean, gender text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH people AS (
    SELECT DISTINCT c.leader_id AS id, c.leader_name AS name, c.leader_g12_level AS g12_level,
           c.leader_is_pastor AS is_pastor, c.leader_gender AS gender
      FROM public.cells_view c
     WHERE _person = 'leader'
    UNION
    SELECT DISTINCT c.g12_leader_id, c.g12_leader_name, NULL::integer, NULL::boolean, NULL::text
      FROM public.cells_view c
     WHERE _person = 'g12' AND c.g12_leader_id IS NOT NULL)        -- pastor e sem liderança: nunca
  SELECT p.id, p.name, p.g12_level, p.is_pastor, p.gender
    FROM people p
   WHERE _search IS NULL OR public.search_normalize(p.name) ILIKE ALL (_search)
   ORDER BY public.search_normalize(p.name) COLLATE "C", p.id
   LIMIT least(greatest(coalesce(_limit, 21), 1), 100) OFFSET greatest(coalesce(_offset, 0), 0)
$$;

-- Os ids vindos da URL (RN-06, DA-11): nome para quem lidera (ou é o G12 de) uma célula visível,
-- ou é visível como membro. Nenhuma linha para o resto (invisível, excluído, inexistente), com a
-- mesma resposta nos três casos.
CREATE OR REPLACE FUNCTION public.cell_filter_names(_person public.cell_filter_person, _ids uuid[])
RETURNS TABLE (id uuid, name text, g12_level integer, is_pastor boolean, gender text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH wanted AS (SELECT unnest(public.first_distinct_ids(_ids, 10)) AS id),
  found AS (
    SELECT c.leader_id AS id, c.leader_name AS name, c.leader_g12_level AS g12_level,
           c.leader_is_pastor AS is_pastor, c.leader_gender AS gender, 1 AS source
      FROM public.cells_view c
     WHERE _person = 'leader' AND c.leader_id IN (SELECT w.id FROM wanted w)
    UNION ALL
    SELECT c.g12_leader_id, c.g12_leader_name, NULL, NULL, NULL, 1
      FROM public.cells_view c
     WHERE _person = 'g12' AND c.g12_leader_id IN (SELECT w.id FROM wanted w)
    UNION ALL
    SELECT m.id, m.name, m.g12_level, m.is_pastor, m.gender, 2
      FROM public.members_view m
     WHERE m.id IN (SELECT w.id FROM wanted w))
  SELECT DISTINCT ON (f.id) f.id, f.name, f.g12_level, f.is_pastor, f.gender
    FROM found f
   ORDER BY f.id, f.source
$$;
```
- **Por que *invoker*:** as duas só leem as views, que decidem o escopo pelo `auth.uid()`. Nenhuma precisa de dado privado, e um erro nelas roda com os privilégios de `authenticated`.
- **O nível só no Líder:** o G12 devolve o nível nulo, porque a opção mostra só o nome (P-LCE-26). Para o membro visível resolvido por id, o nível vem da `members_view`, que ele já vê.
- **Nada da cadeia:** as colunas devolvidas são as que já saem numa linha da lista (`leader_*`, `g12_leader_*`) ou da `members_view` de quem consulta.

##### Privilégios e pós-condições (migration 1)
```sql
-- Os privilégios padrão do Supabase dão EXECUTE a anon, authenticated e service_role em função
-- nova de public: revogar e conceder de novo, como o E2.07.
REVOKE ALL ON FUNCTION public.cells_list(text[], uuid[], uuid[], text, text, text, text[], integer[],
  boolean, public.cell_report_status[], integer[], date, date, integer, integer)
  FROM PUBLIC, anon, service_role;
-- … o mesmo para cells_list_count, cell_filter_options e cell_filter_names;
--     GRANT EXECUTE das quatro só para authenticated.
REVOKE ALL ON FUNCTION public.first_distinct_ids(uuid[], integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.first_distinct_ids(uuid[], integer) TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.cell_filter_normalize(text[], uuid[], uuid[], text, text, text,
  text[], integer[], boolean, public.cell_report_status[], integer[], date, date),
  private.cell_filter_sql(private.cell_filter)
  FROM PUBLIC, anon, authenticated, service_role;

-- Pós-condições: cells_list e cells_list_count definer; os seletores invoker; todas com
-- search_path fixo e EXECUTE só para authenticated (além do dono); as internas sem EXECUTE
-- para os papéis da API; anon e authenticated sem USAGE em private.
DO $$ BEGIN
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname IN ('cells_list', 'cells_list_count')
         AND p.prosecdef AND p.proconfig IS NOT NULL) <> 2
     OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'public' AND p.proname IN ('cell_filter_options', 'cell_filter_names')
                   AND (p.prosecdef OR p.proconfig IS NULL))
     OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'public'
                   AND p.proname IN ('cells_list', 'cells_list_count', 'cell_filter_options', 'cell_filter_names')
                   AND (has_function_privilege('anon', p.oid, 'EXECUTE')
                        OR has_function_privilege('service_role', p.oid, 'EXECUTE')
                        OR NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')))
     OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'private' AND p.proname IN ('cell_filter_normalize', 'cell_filter_sql')
                   AND (has_function_privilege('authenticated', p.oid, 'EXECUTE')
                        OR has_function_privilege('anon', p.oid, 'EXECUTE')
                        OR has_function_privilege('service_role', p.oid, 'EXECUTE')))
     OR has_schema_privilege('authenticated', 'private', 'USAGE')
     OR has_schema_privilege('anon', 'private', 'USAGE') THEN
    RAISE EXCEPTION 'E2.10: modo de segurança ou privilégios das funções diferentes do desenho.';
  END IF;
END $$;
```

#### O detalhe e o filtro Célula (migration 2)
```sql
-- 0. Pré-requisito: a migration 1 deste passo (que já conferiu os passos anteriores).
DO $$ BEGIN
  IF to_regtype('public.cell_filter_person') IS NULL
     OR to_regprocedure('public.first_distinct_ids(uuid[], integer)') IS NULL THEN
    RAISE EXCEPTION 'E2.10: falta a migration 1 deste passo.';
  END IF;
END $$;

-- Os últimos relatórios do detalhe (RN-17, RN-18, RN-20; DA-4, DA-9). Invoker:
-- - a porta é a célula visível (cells_view), como o próprio detalhe (RN-14);
-- - o conteúdo é o relatório visível (cell_reports_view: RN-04 do E2.02 e, depois, o retrato
--   do E2.11), não excluído;
-- - a comparação usa o relatório visível de célula realizada anterior, mesmo fora dos 10;
-- - só números: nenhum nome de participante ou de visitante.
CREATE OR REPLACE FUNCTION public.cell_recent_reports(_cell_id uuid, _limit integer DEFAULT 10)
RETURNS TABLE (id uuid, date date, "time" time, was_held boolean, theme text, reason_not_held text,
               observations text, offering numeric, participants_count bigint, visitors_count integer,
               participants_trend smallint,    -- 1 maior, 0 igual, -1 menor, nulo sem comparação
               visitors_trend smallint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH visible AS (
    SELECT r.id, r.date, r."time", r.was_held, r.theme, r.reason_not_held, r.observations,
           r.offering, r.participants_count, r.visitors_count
      FROM public.cell_reports_view r
     WHERE r.cell_id = _cell_id                                       -- leakproof: índice (cell_id, date DESC)
       AND EXISTS (SELECT 1 FROM public.cells_view c WHERE c.id = _cell_id)),
  compared AS (
    SELECT v.id,
           sign(v.participants_count - lag(v.participants_count) OVER w)::smallint AS participants_trend,
           sign(v.visitors_count     - lag(v.visitors_count)     OVER w)::smallint AS visitors_trend
      FROM visible v
     WHERE v.was_held                                                 -- P-LCE-14
    WINDOW w AS (ORDER BY v.date, v."time", v.id))
  SELECT v.id, v.date, v."time", v.was_held, v.theme, v.reason_not_held, v.observations, v.offering,
         v.participants_count, v.visitors_count, c.participants_trend, c.visitors_trend
    FROM visible v
    LEFT JOIN compared c ON c.id = v.id                               -- "Não houve célula": sem comparação
   ORDER BY v.date DESC, v."time" DESC, v.id DESC
   LIMIT least(greatest(coalesce(_limit, 10), 1), 10)
$$;

-- A identificação da célula no chip de Relatórios (RN-19, DA-10): só quando quem consulta vê a
-- célula ou algum relatório não excluído dela. Os valores atuais da célula.
CREATE OR REPLACE FUNCTION public.cell_identity(_cell_id uuid)
RETURNS TABLE (cell_id uuid, leader_name text, meeting_day text, meeting_time time, cell_deleted boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT x.cell_id, x.leader_name, x.meeting_day, x.meeting_time, x.cell_deleted
    FROM (SELECT c.id AS cell_id, c.leader_name, c.meeting_day, c.meeting_time,
                 false AS cell_deleted, 1 AS source
            FROM public.cells_view c
           WHERE c.id = _cell_id
          UNION ALL
          (SELECT r.cell_id, r.cell_leader_name, r.cell_meeting_day, r.cell_meeting_time,
                  r.cell_deleted, 2
             FROM public.cell_reports_view r
            WHERE r.cell_id = _cell_id
            LIMIT 1)) x
   ORDER BY x.source
   LIMIT 1
$$;
-- Privilégios: REVOKE ALL … FROM PUBLIC, anon, service_role; GRANT EXECUTE … TO authenticated.
-- Pós-condição: as duas invoker, com search_path fixo e EXECUTE só para authenticated.
```
- **Custo da janela:** a comparação percorre todos os relatórios visíveis da célula, com o número de participantes de cada um (uma leitura pela PK de participantes). Numa célula com 400 relatórios, cerca de 400 leituras por índice (meta abaixo). Não usa a situação do relatório.
- **Por que não uma RPC do detalhe inteiro:** a célula já está na `cells_view`, com a mesma forma da linha da lista (o topo aparece na hora, UXD-12) e as colunas do E2.02, do E2.05, do E2.06 e do E2.09. Uma RPC repetiria essas colunas e o escopo. Só os relatórios, que precisam da janela e da porta, ganham função.

#### Integridade garantida pelo banco
| Garantia | Como |
|---|---|
| Só aparece a célula que a pessoa vê (RN-03, RN-14) | Toda linha devolvida vem da `cells_view`, que filtra por `auth.uid()` também dentro de uma função *definer*. Teste de paridade por persona. |
| Os seletores não revelam nada novo (RN-06) | `cell_filter_options` só devolve `leader_*` e `g12_leader_*` de linhas da `cells_view`; `cell_filter_names` acrescenta só a `members_view` de quem consulta. |
| Nenhum dado da célula no detalhe que não abre (RN-14) | A `cells_view` não devolve a linha; `cell_recent_reports` tem a porta da célula visível (DA-4). |
| Relatório invisível não aparece nem é indicado (RN-17) | `cell_recent_reports` lê só a `cell_reports_view`. A situação "Enviado" vem da `cells_view` (E2.09), sem dizer qual relatório. |
| Card igual à lista (RN-21) | As mesmas colunas e funções nos dois: `report_status` (E2.09), `type`, `created_at` com `sp_day_start`, `g12_leader_id` com `is_active`. Teste por persona. |
| Valores só por parâmetro | `private.cell_filter_sql` devolve só fragmentos fixos, escolhidos pela nulidade de cada campo. Os valores entram por `USING`. |
| Ninguém chama as funções internas | Ficam em `private`, sem EXECUTE para `PUBLIC`, `anon`, `authenticated` e `service_role`, e os papéis da API continuam sem USAGE no schema. |
| Ordem total | `created_at DESC NULLS LAST` e `id`, que é único. |

### Metas de tempo e índices
Volume de referência: 20 mil membros, 1.500 células, 100 mil relatórios com cerca de 10 participantes cada, e uma célula com 400 relatórios. As metas são no banco, medidas pelo QA com `EXPLAIN (ANALYZE, BUFFERS)`, mediana de 5 execuções.

| Consulta | Meta |
|---|---|
| `cells_list` (25 linhas) e `cells_list_count`, sem filtros, Rita | até 150 ms cada |
| as mesmas, Pedro | até 100 ms cada |
| só "Situação do relatório: Pendente", Rita | até 300 ms cada (a meta do E2.09) |
| a combinação do critério da RN-02 | até 1 s cada. As duas correm em paralelo, então a página e o total ficam em até 2 s com a rede. |
| `cell_filter_options` (Líder e G12, com e sem busca), Rita | até 100 ms |
| `cell_filter_names` com 10 ids | até 50 ms |
| `cells_view` por id com as colunas do detalhe | até 100 ms |
| `cell_recent_reports` na célula com 400 relatórios | até 150 ms |
| `cell_identity` | até 50 ms |
| `cell_reports_view` com `cell_id=eq.` (página e total) | até 150 ms |

| Índice | Para quê | Situação |
|---|---|---|
| `cells_created_at_idx` em `cells (created_at DESC NULLS LAST, id) WHERE deleted_at IS NULL` | Datas de cadastro (RN-11) e "Novas células da semana" (E2.14). As comparações de `timestamptz` são *leakproof* e entram na view. | Novo. A tarefa 1 confere se o E2.05 já criou um. |
| `cells_leader_id_idx`, `member_hierarchy_g12_id_idx` | Líder e G12 | Existentes (E1.08, E2.06) |
| `cell_reports_cell_id_date_idx`, `cell_reports_cell_week_key` | Relatórios do detalhe, filtro Célula de Relatórios e a situação (E2.09) | Existentes |
| `cell_report_participants_pkey (report_id, member_id)` | Número de participantes por relatório | Existente |
| nenhum para tipo, dia, situação, rua, bairro e cidade | 1.500 linhas no máximo; toda consulta já percorre o conjunto visível | Plano B no risco 3 |

### Contratos (RPC, Edge Functions, colunas novas)
**Tipo novo:** `public.cell_filter_person` (`leader`, `g12`). No `types.ts`, aparece em `Enums` e em `Constants.public.Enums`.

**Views:** nenhuma muda. O front passa a ler, da `cells_view`, as colunas do E2.09 no detalhe também (além da lista).

**RPCs (EXECUTE só para `authenticated`):**
| Função | Modo | Retorno | Observações |
|---|---|---|---|
| `cells_list(_search text[], _leader_ids uuid[], _g12_ids uuid[], _street text, _neighborhood text, _city text, _types text[], _weekdays integer[], _is_active boolean, _report_statuses cell_report_status[], _missing_weeks integer[], _created_from date, _created_to date, _limit integer = 25, _offset integer = 0)` | *definer* | `SETOF cells_view`, já na ordem da RN-13 | Todos os filtros com padrão nulo. Página além do fim: vazia, sem 416. |
| `cells_list_count(` os mesmos 13 filtros `)` | *definer* | `bigint` | O total exato, com a mesma normalização. |
| `cell_filter_options(_person cell_filter_person, _search text[] = null, _limit integer = 21, _offset integer = 0)` | *invoker* | `TABLE (id, name, g12_level, is_pastor, gender)` | Em ordem alfabética (DA-8). No G12, `g12_level`, `is_pastor` e `gender` nulos. |
| `cell_filter_names(_person cell_filter_person, _ids uuid[])` | *invoker* | idem | Só os ids resolvidos (RN-06); os outros não voltam. |
| `cell_recent_reports(_cell_id uuid, _limit integer = 10)` | *invoker* | `TABLE (id, date, time, was_held, theme, reason_not_held, observations, offering, participants_count, visitors_count, participants_trend, visitors_trend)` | Até 10, do mais recente. Vazio se a célula não é visível (DA-4). `offering` pode ser nulo. |
| `cell_identity(_cell_id uuid)` | *invoker* | `TABLE (cell_id, leader_name, meeting_day, meeting_time, cell_deleted)` | Uma linha ou nenhuma (DA-10). |
| `first_distinct_ids(_ids uuid[], _max integer)` | — | `uuid[]` | Pura. Usada pelas funções acima. |

**Internas (`private`, sem EXECUTE para os papéis da API):** tipo `cell_filter`, `cell_filter_normalize` e `cell_filter_sql`.

**Edge Functions:** nenhuma muda.

**Mapa da URL para os parâmetros (AQ-1):**
| URL | Parâmetro |
|---|---|
| `leaders=<id>,<id>` | `_leader_ids`, na ordem da escolha |
| `g12=<id>,<id>` | `_g12_ids`, na ordem da escolha |
| `street`, `neighborhood`, `city` | `_street`, `_neighborhood`, `_city` |
| `type=evangelistic,discipleship,macrocell` | `_types`: 'Evangelística', 'Discipulado', 'Macrocélula' |
| `day=mon,tue,wed,thu,fri,sat,sun` | `_weekdays`: 1, 2, 3, 4, 5, 6, 0 |
| `status=active` / `inactive` | `_is_active`: `true` / `false` |
| `report_status=sent` | `_report_statuses`: `sent_held` e `sent_not_held` |
| `report_status=not_yet`, `pending`, `next_week` | `_report_statuses`: o mesmo código |
| `report_status=missed_1`, `missed_2`, `missed_3`, `missed_4plus` | `_missing_weeks`: 1, 2, 3, 4 |
| `from`, `to` (`aaaa-mm-dd`) | `_created_from`, `_created_to` |
| `cell=<id>` (Relatórios) | `cell_reports_view.cell_id=eq.<id>` e `cell_identity(_cell_id)` |

Uso no front (esboço):
```ts
// src/hooks/use-cells-list.ts
queryFn: async (): Promise<ListResult<CellListRow>> => {
  const args = toCellsListArgs(filters, search);                  // src/lib/cells/filters.ts
  const [rowsRes, countRes] = await Promise.all([
    supabase
      .rpc("cells_list", { ...args, _limit: pageSize, _offset: (page - 1) * pageSize })
      .select(CELL_LIST_SELECT),                                    // sem .order(): a ordem é a da RPC
    supabase.rpc("cells_list_count", args),
  ]);
  if (rowsRes.error) throw rowsRes.error;
  if (countRes.error) throw countRes.error;
  return { rows: rowsRes.data ?? [], total: countRes.data ?? 0 };
},

// src/pages/CellDetail.tsx (resumo)
const { id = "" } = useParams();
const valid = isUuid(id);                                           // src/lib/filters/url.ts (E2.07)
const cell = useCell(id, { enabled: valid });                       // cells_view por id
const reports = useCellRecentReports(id, { enabled: valid });       // em paralelo
const preview = useCellListPreview(id);                             // a linha da lista no cache, só para o topo
if (!valid || cell.data === null) return <CellNotFound />;          // o preview é descartado
```

### Front
Segue o padrão do E1.08 ao E2.09: os componentes cuidam da tela, o acesso a dados fica nos hooks e a regra pura fica em `src/lib/`.

- **Domínio puro, com Vitest, sem React nem Supabase:**
  - `src/lib/cells/filters.ts` (AQ-1), o módulo único do filtro de Células:
    - tipo `CellFilters` e `EMPTY_CELL_FILTERS`;
    - os mapas da URL para os valores do banco (tabela acima), com `satisfies Record<…>` sobre `Constants.public.Enums.cell_report_status` e a lista de tipos e de dias do E2.08 (`src/lib/cells/`), para a compilação falhar quando surgir um valor sem mapa;
    - `parseCellFilters(params)`: os filtros, a URL limpa (ou nulo, se nada mudou), `leadersTruncated`, `g12Truncated` e `dateRangeInverted` (DA-7);
    - `writeCellFilters(params, filters)`: sem os padrões, na ordem das opções, `leaders` e `g12` na ordem da escolha, e tira `page`;
    - `clearCellFilters(params)`: mantém só `size`;
    - `countActiveCellFilters(filters)` (0 a 10; DA-6);
    - `cellFilterChips(filters, personLabel)`, na ordem da UXD-1, com o texto inteiro da Situação do relatório;
    - `toCellsListArgs(filters, search)`, tipado pelos `Args` do `types.ts`;
    - `cellListHref(card, opts)`: os links da RN-21 para o E2.14 (`pending`, `type`, `new_this_week` com o domingo e o sábado recebidos, `g12_couple` com os ids).
  - `src/lib/cells/filter-texts.ts` e `src/lib/cells/detail-texts.ts`: todos os textos deste spec, fora os da situação do relatório, que ficam em `src/lib/cells/report-status.ts` (E2.09). Os subgrupos e as opções curtas da Situação do relatório também vão para `report-status.ts`, junto dos textos de lá.
  - `src/lib/cells/detail.ts`: `meetingLine(cell)` ("Quarta · 20:00 · Evangelística", com o dia na forma curta), `addressLines(cell)` (até quatro linhas, sem as vazias, "s/n" e o CEP formatado), `backLink(access, cameFromList)` ("Voltar para Células" ou "Ir para o início", pelo `canSeeRoute(access, "/cells")`).
  - `src/lib/cells/report-comparison.ts`: `trendOf(sign)` (`"up" | "down" | "same" | null`) e os textos do leitor de tela.
  - `src/lib/cells/evolution.ts`: `toEvolutionPoints(reports)` (ordem cronológica; nulo nas duas séries em "Não houve célula") e o resumo do `aria-label`.
  - `src/lib/cell-reports/labels.ts`: `formatOffering(value)` ("R$ 50,00", "R$ 0,00" ou "Não informada" para nulo).
  - `src/lib/cell-reports/cell-filter.ts`: lê e limpa `cell` (`isUuid`), o texto do chip a partir da `cell_identity` e o "Limpar filtros" (tira `cell`, `q` e `page`; mantém `size` e o `report` do E2.01).
  - `src/lib/access/access.ts` (E2.02): `canSeeRoute(access, path)` deixa passar `/cells/<qualquer coisa>` que não seja `/cells/deleted` para quem está logado. Quem abre o detalhe é decidido pela `cells_view` (AQ-7).
- **Hooks:**
  - `use-cell-filters.ts`: lê a URL, grava a URL limpa na primeira leitura (`replace`), aplica, tira um chip e limpa tudo, sempre voltando para a página 1. Convive com o `useListSearchParams` (`q`, `page`, `size`) por atualizações funcionais do `setSearchParams`, como o `use-member-filters` do E2.07.
  - `use-cells-list.ts`: as duas RPCs em paralelo, num `queryFn` só, com a chave `["cells", "list", { page, pageSize, search, filters }]` e `CELL_LIST_SELECT` (E2.09). Continua com `placeholderData` e `useClampPage`.
  - `use-cell-filter-options.ts`: `useCellFilterOptions(person, search)` (infinito, 21 linhas por página, chave `["cells", "filter-options", person, search]`) e `useCellFilterNames(person, ids)` (chave `["cells", "filter-names", person, ids]`).
  - `use-cell.ts`: passa a ler `CELL_DETAIL_SELECT` (o `CELL_ROW_SELECT` mais as colunas do detalhe: situação do relatório, autoria, `can_submit_report`, `leader_is_pastor`, `leader_gender`, `created_at`), com a mesma chave `["cells", "detail", id]` e `enabled`. O tipo `CellDetailRow` estende o `CellRow`, então o bloqueio do E2.01 e o formulário continuam funcionando. Um hook só para "a célula por id".
  - `use-cell-list-preview.ts`: procura a linha no cache das listas (`getQueriesData(["cells", "list"])`), sem leitura, só para o topo aparecer na hora (UXD-12).
  - `use-cell-recent-reports.ts`: chave `["cells", "detail", id, "reports"]`.
  - `use-cell-identity.ts`: chave `["cells", "identity", id]`.
  - `use-cell-reports-list.ts`: ganha `cellId`, com `.eq("cell_id", cellId)` na página e no total, e a chave passa a ter o `cellId`.
  - `use-list-return-focus.ts` (AQ-8): grava o id da célula aberta em `sessionStorage` ao abrir o detalhe; a lista, quando os dados chegam, rola até o link dela (instantâneo com `prefers-reduced-motion`), põe o foco e apaga a chave. Se a célula não está na página, o foco vai para o `h1`.
  - `use-prefers-reduced-motion.ts`: `matchMedia("(prefers-reduced-motion: reduce)")`, com o valor certo no primeiro render.
  - Reaproveitados: `use-member-statuses` (E2.08) para o "(inativo)" das pessoas da célula; `use-cell-report` (E2.05) para abrir "Editar" de um relatório com os nomes, que o detalhe não tem; `use-record-authorship` e `RecordAuthorship` (E2.05) para a autoria e o "Ver histórico".
- **Componentes reaproveitáveis (`src/components/filters/`):**
  - `PersonMultiFilter` (E2.07) passa a receber a fonte das opções e dos nomes por props (os hooks de Membros ou os de Células), o texto da busca sem resultado e o formato da opção. Membros continua igual.
  - `GroupedMultiChoiceFilter` (P85, novo): um `fieldset` com `legend` e dica, e um `fieldset` com `legend` por subgrupo; o mesmo conteúdo no `Sheet` e no `Popover` do computador.
  - `RecordFilterChip` (P84, novo): o chip de um registro vindo de outra tela, com "carregando", "não carregado" e "indisponível" com a dica.
- **Telas:**
  - `src/components/cells/CellFilters.tsx`: os 10 filtros na ordem da UXD-1, com os componentes do E2.07 e os novos.
  - `src/pages/Cells.tsx`: "Buscar", "Filtros (N)", "Limpar filtros", chips, o total em texto com `role="status"`, `Skeleton`, o `Alert` com "Tentar de novo" e os vazios (T1 a T7). A legenda do E2.09 fica depois dos filtros.
  - `CellCard` e `CellsTable` (E2.09): o `Link` do P81 para `/cells/{id}`, com `state={{ fromList: true }}`, o nome acessível "Célula de {Líder}, {nível}" e o `ChevronRight`. As ações ficam fora do link.
  - `src/pages/CellDetail.tsx` e `src/components/cells/detail/*`: `CellDetailHeader` (voltar, `h1` com o foco, complemento, badge, ações a partir de 768 px), `CellDetailFooter` (rodapé fixo abaixo de 768 px), `CellReportStatusSection` (o `ReportStatus` do E2.09 com a variante nova `detail`: badge, explicação do `REPORT_STATUS_LEGEND` e a linha das semanas; a frase da célula inativa), `CellPeopleSection`, `CellAddressSection`, `CellRecentReports` (cartões até 1023 px e tabela a partir de 1024 px, com `CellReportTrend`), `CellEvolution` (abas, tabela e o gráfico carregado por `React.lazy`), `CellEvolutionChart` (o único arquivo que importa `@/components/ui/chart`) e `CellNotFound`.
  - `src/pages/CellReports.tsx`: o filtro Célula (T15) com o `RecordFilterChip`, "Limpar filtros", a dica e o vazio com filtros.
  - `src/App.tsx`: `/cells/deleted` antes de `/cells/:id`.
  - `index.html`: `viewport-fit=cover`, se o E2.08 ainda não tiver posto.
- **Ações do detalhe (RN-16, T14):**
  - "Novo relatório" com `cells_view.can_submit_report` (E2.02 e E2.08), abrindo o formulário de relatório com a célula escolhida e travada;
  - "Editar célula" com `hasPermission(access, "edit_cell")`, abrindo o formulário do E2.08 com a linha do detalhe;
  - "Excluir célula" com `hasPermission(access, "delete_cell")`, pelo fluxo do E2.01. No sucesso, a ordem é: `removeQueries(["cells", "list"])`, voltar para a lista e então `refreshAfterCellWrite`. Assim a lista nunca mostra a célula excluída vinda do cache (AQ-10);
  - "Editar" e "Excluir" de cada relatório com `edit_cell_report` e `delete_cell_report`, pelos fluxos de hoje.
- **"Voltar para Células" (AQ-8):** com `location.state.fromList`, `navigate(-1)` (o histórico devolve a URL da lista com os filtros, a busca e a página); sem, `navigate("/cells")`. Para quem não tem a lista, "Ir para o início" (`/`).
- **Cache (AQ-10):** todas as chaves novas ficam sob `["cells"]` ou `["cell_reports"]`, então `refreshAfterCellWrite` (E2.06, E2.08), `refreshAfterMemberWrite` (E2.06) e a função de depois de gravar relatório (E2.07 e E2.09; risco 13) já as cobrem: a tela aberta recarrega, e as fechadas carregam do zero.
- **Gráfico (AQ-11):** `React.lazy` no `CellEvolutionChart`, com `Suspense` e um `Skeleton` da mesma altura. As cores vêm do `ChartConfig` com `hsl(var(--primary))` e `hsl(var(--muted-foreground))`. `isAnimationActive={!prefersReducedMotion}`. O `npm run build` deixa o Recharts fora do pacote principal.

### Onde cada regra é imposta
| RN | Banco (constraint, RLS, trigger, RPC) | UI |
|---|---|---|
| RN-01 | `cells_list` e `cells_list_count` com os 10 filtros. Sem permissão nova: o acesso é o da `cells_view`. | Painel com os 10 filtros (T2, T3), só para quem tem a lista (E2.02) |
| RN-02 | `private.cell_filter_sql`: `AND` entre filtros, `= ANY` dentro deles; total exato pela `cells_list_count`; página por `LIMIT`/`OFFSET` sobre uma ordem total | "Aplicar filtros" no celular e na hora no computador; página 1 a cada mudança aplicada |
| RN-03 | Toda linha vem da `cells_view` (escopo e excluídas); o retorno é o tipo da view | — |
| RN-04 | `v.leader_id = ANY`, 10 primeiros distintos; `cell_filter_options('leader')` só das células visíveis | Seletor com limite de 10, "Escolha até 10 pessoas.", nível na opção |
| RN-05 | `v.g12_leader_id = ANY` (`g12_id` do E2.06: o próprio G12 entra, pastor e sem liderança nunca); `cell_filter_options('g12')` | Seletor só com o nome, dica do casal |
| RN-06 | `cell_filter_names`: nome só para quem é líder ou G12 de célula visível, ou é visível; nenhuma linha para invisível, excluído e inexistente; o filtro com esse id não traz nada (DA-3) | "Pessoa indisponível" e a dica; nunca `member_names` |
| RN-07 | `private.text_key` e `strpos` (literal, sem acento, espaços), 100 caracteres, sem endereço fica de fora; colunas da célula | `maxLength={100}` |
| RN-08 | `v.type = ANY` (valores de `cell_types()`), `v.meeting_weekday = ANY` (0 a 6) | Caixas na ordem do P-CEL-14 |
| RN-09 | `v.is_active`; a excluída não está na view | `RadioGroup` ou `Select`, "Todas" sem parâmetro |
| RN-10 | Colunas do E2.09 (`report_status`, `report_missing_weeks`), com `OR` entre os subgrupos; `no_meeting_day` e nulo nunca entram; todos os relatórios, visíveis ou não | `GroupedMultiChoiceFilter` (P85), chips com o texto inteiro, `sent` vira os dois "Enviado" |
| RN-11 | `sp_day_start`, intervalo semiaberto, nulo de fora, datas invertidas ignoradas | Conferência ao sair do campo e ao aplicar; mensagens |
| RN-12 | Normaliza os valores fora da regra (DA-1) | `src/lib/cells/filters.ts`: URL, inválidos fora, contagem, chips e "Limpar filtros" |
| RN-13 | A ordem na `cells_list` (`created_at DESC NULLS LAST`, `id`) | Sem reordenar; legenda da tabela |
| RN-14 | `cells_view` por id (escopo e excluída; nenhuma linha para os quatro casos); `cell_recent_reports` com a porta (DA-4); o id tipado `uuid` | Rota `/cells/:id`, `isUuid` antes de ler, "Célula não encontrada.", `canSeeRoute`, voltar e foco |
| RN-15 | Colunas da `cells_view` (nível, G12, endereço, situação, situação do relatório, autoria); `members_view` para a situação das pessoas | Seções, `ReportStatus` (variante `detail`), "(inativo)" pelo `use-member-statuses` |
| RN-16 | `can_submit_report` na view, na política e no trigger (E2.02, E2.08); políticas de UPDATE e RPCs de exclusão (E2.01) | Ações por permissão; rodapé fixo |
| RN-17 | `cell_recent_reports`: só visíveis e não excluídos, ordem, comparação no servidor (DA-9) | Cartões e tabela, setas neutras, "Não informada", ações por permissão |
| RN-18 | Só os números na resposta | Nenhum nome no detalhe; os nomes no formulário (`use-cell-report`) |
| RN-19 | `cell_reports_view` com `cell_id`; `cell_identity` (célula ou relatório visível) | Chip, "Célula indisponível", "Limpar filtros", vazio com filtros |
| RN-20 | Os mesmos até 10 da `cell_recent_reports` | Gráfico com o intervalo e o "×", e a tabela |
| RN-21 | As mesmas colunas e funções no card e no filtro (E2.09, `dashboard_cells_by_type`, `sp_day_start`, `g12_leader_id`) | `cellListHref` (usado pelo E2.14) |

### Respostas às perguntas do UX (AQ-1 a AQ-12)
| # | Resposta |
|---|---|
| AQ-1 | **Confirmados** os nomes e os valores da tabela de Navegação e rotas. Um módulo só, `src/lib/cells/filters.ts`, como a UX sugeriu, inclusive os links dos cards para o E2.14. O servidor normaliza os mesmos valores (DA-1). |
| AQ-2 | **Sim.** `cell_filter_options(person, search)` devolve id, nome e, no Líder, `g12_level`, `is_pastor` e `gender` (para o P40), 21 linhas por página, com a busca sem acento. `cell_filter_names(person, ids)` resolve os ids da URL pela mesma fonte, mais a `members_view` (DA-11). Nunca pela `member_names`. Nenhuma resposta traz a cadeia. |
| AQ-3 | **Sim.** `cells_list` devolve as linhas da `cells_view` com as colunas que a tela pedir (`CELL_LIST_SELECT`), na ordem da RN-13, e `cells_list_count` dá o total exato. Metas em [Metas de tempo e índices](#metas-de-tempo-e-índices). O tempo-limite (57014) ou qualquer recusa vira o `Alert`, sem texto técnico (UX-30). |
| AQ-4 | **Sim.** As colunas `report_status` e `report_missing_weeks` do E2.09, na lista e no detalhe, e o `ReportStatus` do E2.09 com a variante `detail`. Os valores de `report_status` da URL correspondem um a um às opções e viram os códigos do E2.09 pelo mapa de [Contratos](#contratos-rpc-edge-functions-colunas-novas). |
| AQ-5 | **Sim, sem RPC nova.** A `cells_view` por id tem tudo da T8, menos a situação das pessoas, que vem da `members_view` (`use-member-statuses`, P63). A mesma resposta (nenhuma linha) para os quatro casos. A linha da lista, lida do cache, serve só ao topo e é descartada se a leitura disser "não encontrada". |
| AQ-6 | **Sim.** `cell_recent_reports`: até 10, do mais recente, com os números e o sinal da comparação calculados no servidor (DA-9), sem nomes. A mesma leitura serve aos cartões (os 3 primeiros) e ao gráfico. **A oferta pode ser nula** (`numeric(10,2)` sem `NOT NULL`), mas o formulário de hoje grava 0 (leitura técnica 4). |
| AQ-7 | `/cells/deleted` declarada antes de `/cells/:id` (o React Router 6 também prefere o segmento fixo). `canSeeRoute` deixa passar `/cells/:id`. O id é conferido com `isUuid` antes de qualquer leitura. |
| AQ-8 | **Sim.** `state.fromList` no link e `navigate(-1)` no "Voltar"; o id em `sessionStorage` e `use-list-return-focus` na lista. |
| AQ-9 | **Sim.** `cell_identity`, com a mesma resposta (nenhuma linha) para a célula invisível e a inexistente. A lista filtrada usa `cell_reports_view` com `cell_id=eq.`, com o total exato. |
| AQ-10 | Todas as chaves novas ficam sob `["cells"]` e `["cell_reports"]`, cobertas pelas funções de atualização do E2.06 e do E2.09. Excluir a célula pelo detalhe tira a lista do cache antes de navegar. |
| AQ-11 | **Sim.** `React.lazy` no componente do gráfico, cores dos tokens pelo `ChartConfig`, sem animação com `prefers-reduced-motion`, sem dependência nova. |
| AQ-12 | **DA-1.** Fora do tipo: recusa (400), que a tela nunca provoca e que vira o `Alert`. Com o tipo certo e fora da regra: normalizado como a tela, sem erro. |

### Perguntas Q-1 a Q-7: padrão e custo das alternativas
O desenho segue os padrões adotados. Nenhuma alternativa muda a estrutura: as RPCs e os componentes ficam. A Q-3 foi respondida pelo E2.09.

| Pergunta | Padrão desenhado | Custo da alternativa |
|---|---|---|
| Q-1. Quantos relatórios o detalhe mostra | 3 | **Baixo, cerca de 0,5 dia, só no front.** A RPC já devolve 10. "Mostrar mais relatórios" mostra os outros sem nova leitura, com o foco no 4º; a tabela mostra os 10; textos e testes (UX-31). |
| Q-2. Filtro de rede | Não existe | **Médio, cerca de 1,5 dia.** Parâmetro `_network_ids uuid[]` nas duas RPCs, normalizado para os ids que a `members_view` de quem consulta devolve (como a Liderança do E2.07, para não revelar a cadeia de quem não se vê), e o fragmento `v.leader_id = ANY (…) OR v.leader_id IN (SELECT h.member_id FROM private.member_hierarchy h WHERE h.ancestor_ids && …)`; o seletor do E2.07 (`members_view`); `network` na URL; contagem até 11; textos e testes. |
| Q-4. Situação padrão | "Todas" | **Baixo, cerca de 0,5 dia, só no front.** "Ativa" como padrão em `parseCellFilters`, `status=all` na URL, os links dos cards por tipo e o vazio com "Mostrar também as inativas" (UX-31). O banco não muda. |
| Q-5. G12 por casal | Cada pessoa | **Médio, cerca de 1 dia.** O normalizador acrescenta o cônjuge de cada G12 escolhido, só quando ele também é o G12 de alguma célula visível (para não revelar o casal de quem não se vê; o PO confirma). A dica e os testes mudam; o link do ranking passa a levar um id só. |
| Q-6. Ordem padrão: G12 e líder | Cadastro | **Baixo, cerca de 0,5 dia.** A etapa 1 da `cells_list` passa a ordenar por `search_normalize(g12_leader_name)` com os nulos por último, `search_normalize(leader_name)` e `id`; `aria-sort` e a legenda; testes da RN-13. Se as duas ordens forem desejadas, um parâmetro `_order` com valores fixos. |
| Q-6. Ordem padrão: situação do relatório | Cadastro | **Médio, cerca de 1 dia.** Ordenar pela situação calcula a situação de todas as células visíveis em toda página, mesmo sem filtro (o custo do filtro, sempre). `CASE` com a ordem do enum; metas de volume refeitas. |
| Q-7. Evolução e comparação | As duas voltam | **Baixo, cerca de 0,5 dia, a menos.** Saem a seção Evolução, as setas e a frase; `cell_recent_reports` fica com as duas colunas de comparação sem leitor, ou as perde numa migration nova. |

### Decisões técnicas
| # | Decisão | Motivo |
|---|---|---|
| DT-01 | A lista vem de duas RPCs, `cells_list` e `cells_list_count`, *definer*, sobre a `cells_view`, com SQL dinâmico só com os filtros ativos. | O "contém" sem acento e com curingas literais (RN-07), a data de Brasília (RN-11) e a normalização dos valores da API (RN-12, DA-1) ficam no banco, num lugar só, e não no `ilike` montado pelo front. O PostgREST aplicaria os filtros de uma RPC depois de materializar o resultado (E2.07), então eles são parâmetros. *Definer* só para chamar os auxiliares de `private` sem dar USAGE no schema. É o molde do E2.07. |
| DT-02 | Quem aparece é decidido só pela `cells_view`. As RPCs devolvem o tipo da view. | O escopo continua num lugar só (paridade do E2.02). |
| DT-03 | A página em duas etapas: os ids com as chaves de ordem, depois as linhas por `id = ANY`. | A situação do relatório, a autoria e os nomes são calculados só para as linhas da página. |
| DT-04 | O total vem de uma segunda RPC, em paralelo. Sem 416. | O `count=exact` numa RPC contaria só a página. Uma resposta com as linhas e o total juntos perderia os tipos gerados (DT-04 do E2.07). |
| DT-05 | A ordem é feita dentro da RPC (`created_at DESC NULLS LAST`, `id`). O front não reordena. | RN-13 e DT-03 do E2.05. |
| DT-06 | A Situação do relatório pelas colunas do E2.09, com `OR` entre os subgrupos; "Enviado" vira os dois códigos no front. | Um cálculo só (ponto 3). As colunas só são calculadas para o conjunto quando o filtro está ativo. |
| DT-07 | Os seletores por duas funções *invoker* sobre a `cells_view` (e a `members_view`, para os nomes), com o enum `cell_filter_person`, paginadas por parâmetro. | RN-04 a RN-06: as opções são as células visíveis, e nada da cadeia é lido. *Invoker* porque não precisam de dado privado. A ordem não depende do PostgREST. |
| DT-08 | O detalhe lê a célula pela `cells_view` por id (`useCell`, um hook só) e os relatórios pela `cell_recent_reports`, em paralelo. Sem RPC do detalhe. | A linha da lista e a do detalhe têm a mesma forma (UXD-12), e a view já tem as colunas dos passos anteriores. |
| DT-09 | `cell_recent_reports` *invoker*: porta pela `cells_view`, conteúdo pela `cell_reports_view`, comparação por janela sobre todos os relatórios visíveis realizados, até 10, sem nomes. | RN-14, RN-17, RN-18, DA-4, DA-9. O E2.11 muda a visibilidade na `cell_reports_view`, e a função acompanha sem mudar. |
| DT-10 | Filtro Célula de Relatórios pela `cell_reports_view` (`cell_id=eq.`) e identificação pela `cell_identity` (*invoker*). | RN-19: a regra "vê a célula ou um relatório dela" fica no banco, numa chamada. A lista já tem o índice. |
| DT-11 | `first_distinct_ids` em `public`, pura, usada pelo normalizador e pelos nomes. | "Os 10 primeiros" escrito uma vez só (DA-2). |
| DT-12 | Datas por intervalo semiaberto com `sp_day_start` (E2.07) e índice parcial em `cells.created_at`. | RN-11 e RN-21: o nulo fica de fora sozinho, e o E2.14 usa a mesma função. |
| DT-13 | No front, `src/lib/cells/filters.ts` é o módulo único do filtro (URL, contagem, chips, argumentos e links dos cards). Os componentes P50 a P54 do E2.07, mais o P84 e o P85, ficam em `src/components/filters/`. | AQ-1 e RN-21: card e lista nunca divergem; Membros, Células e, no E2.12, Relatórios usam os mesmos componentes. |
| DT-14 | O gráfico só por `React.lazy`, num componente que é o único a importar o `chart.tsx`. | O `chart.tsx` importa o Recharts inteiro. Sem isso, o Recharts entraria no pacote principal de todas as telas. |
| DT-15 | As chaves novas ficam sob `["cells"]` e `["cell_reports"]`. Excluir a célula pelo detalhe tira a lista do cache antes de navegar. | AQ-10, P44, sem função de atualização nova. |
| DT-16 | Cinco PRs: banco; componentes; Relatórios; Células com filtros; detalhe. | O banco vai ao ar sozinho. Os componentes compartilhados ficam separados das telas. Relatórios e Células andam em paralelo, e o detalhe vem por último, porque muda os cartões e usa o filtro Célula. |

### Riscos (concorrência, escala, segurança)
1. **SQL dinâmico numa função *definer* (injeção).**
   - Mitigações: só fragmentos fixos, escolhidos pela nulidade de cada campo; os valores por `USING`; o `code-reviewer` confere que nenhuma entrada passa pelo `format`; pgTAP com textos maliciosos (`'); DROP …; --`, `%`, `_`, `\`, aspas) em rua, bairro, cidade e busca.
2. **Função *definer* lendo a view.** A visibilidade depende de o `WHERE` da `cells_view` usar `auth.uid()`. Se alguém trocar a view para *invoker* ou passar a usar `current_user`, as RPCs mudariam de comportamento.
   - Mitigações: o teste de paridade por persona (ids de todas as páginas e o total sem filtros iguais aos da view); a nota nas Armadilhas do `CLAUDE.md`.
3. **Custo do filtro de situação.** Ele calcula a situação de todas as células visíveis na página e de novo no total. A meta é a do E2.09 (300 ms com 1.500 células).
   - Plano B: o do E2.09 (`private.cell_report_situation` em `sql`, ou uma variante em conjunto só para o filtro). Para rua, bairro e cidade, uma coluna gerada com `private.text_key` e `pg_trgm`, que não está instalada hoje. Os dois voltam ao `architect` antes.
4. **A ordem vem da saída da função.** O PostgREST não reordena: sem `order`, a consulta gerada lê a função na ordem.
   - Mitigações: o teste de API paginando 60 células cadastradas no mesmo instante; nenhum `.order()` no hook. As opções dos seletores paginam dentro da função e não dependem disso.
5. **Duas chamadas (linhas e total) em fotos e instantes diferentes.** O total pode ficar diferente das linhas por um instante depois de uma gravação ou de um prazo do E2.09. A leitura seguinte corrige, e o `useClampPage` trata a página além do fim.
6. **A situação muda entre as páginas** (leitura técnica 5). Esperado (P-SIT-08 do E2.09). Um cursor no servidor para "congelar" a lista custaria uma tabela temporária por sessão, sem ganho para quem usa.
7. **O tipo de retorno amarrado à view.** A partir daqui, `DROP VIEW cells_view` exige derrubar e recriar as duas RPCs (um `CASCADE` apagaria as funções). `CREATE OR REPLACE VIEW` com colunas novas no fim continua funcionando. **Nenhum PR que recrie a `cells_view` pode andar junto com o PR 1 daqui** (risco 2 do E2.09).
8. **Vazamento pelos seletores.** Uma opção ou um nome fora do que a lista mostra violaria a RN-06 e a RN-23 do E2.02.
   - Mitigações: as funções só leem as views; pgTAP com Pedro (Tânia e Débora nunca voltam; Diego volta pelo C2) e com a API inspecionada (UX-09).
9. **Detalhe pedido em paralelo com os relatórios.** Sem a porta (DA-4), os relatórios de C1 sairiam para Lia na tela "Célula não encontrada".
   - Mitigação: a porta na `cell_recent_reports` e o teste de rede do UX-24.
10. **`canSeeRoute` bloqueando o detalhe.** Se a regra de prefixo `/cells` do E2.02 valer para `/cells/:id`, Hugo perde o detalhe da própria célula.
    - Mitigação: o teste unitário do `canSeeRoute` e o UX-16.
11. **Recharts no pacote principal.** Um `import` direto do `chart.tsx` fora do componente preguiçoso traria cerca de 100 kB (gzip) a todas as telas.
    - Mitigação: critério de pronto conferido no `npm run build` (DT-14).
12. **E2.09 atrasado.** A guarda do PR 1 falha sem as colunas dele.
    - Plano B, se o usuário quiser o E2.10 antes: o PR 1 sai sem `_report_statuses` e `_missing_weeks` (e sem o fragmento), e um PR 1b os acrescenta depois do E2.09, com `DROP FUNCTION` e `CREATE` das duas RPCs. O filtro e a seção do detalhe só aparecem no front com o PR 1b. Cerca de 1 dia a mais.
13. **Duas funções para a mesma atualização.** O E2.07 (DT-14) chama de `refreshAfterCellReportWrite` e o E2.09 (DT-12) de `refreshAfterReportWrite` a mesma função de `src/lib/query-refresh.ts`, com as mesmas chaves. O passo implementado primeiro cria; o outro usa a que existe, sem criar a segunda. Este spec usa a que estiver na `main`.
14. **Tempo-limite de 8 s de `authenticated`.** Muito acima das metas. O 57014 vira o `Alert` (UX-30).
15. **Valores fora do tipo pela API.** Recusa técnica (400), só pela API (DA-1).
16. **Advisor do Supabase:** nada novo além de duas funções *definer* expostas (`cells_list` e `cells_list_count`), no mesmo padrão da `members_list`.

### Ordem com os outros passos
**Pré-requisitos do PR 1 (guarda na migration 1), em produção:**
- PR 1 do E2.02 (`cells_view` com o `WHERE` canônico, `can_submit_report`, `leader_is_pastor`);
- banco do E2.05 (`created_at` anulável, autoria na `cells_view`);
- PR 1 do E2.06 (`g12_leader_id` pela `private.member_hierarchy`);
- PR 1 do E2.07 (`private.text_key`, `sp_day_start`);
- PR 2 do E2.08 (`cell_types()`, dia e horário obrigatórios);
- PR 1 do E2.09 (`cell_report_status`, `report_status`, `report_missing_weeks`).

**PR 2 (componentes):** depois do PR 2 do E2.07 (componentes P50 a P54) na `main`. Não depende do banco.

**PR 3 (Relatórios: filtro Célula):** depois do PR 1 (tipos; em produção antes do promote) e do PR 2, e do front de Relatórios do E2.01 (PR 3) e do E2.02.

**PR 4 (Células com filtros):** depois do PR 1 e do PR 2, e do front de Células do E2.02, do E2.06, do E2.08 (PRs 4 e 5) e do E2.09 (PR 3: `CellCard`, `CellsTable`, `CELL_LIST_SELECT`, `useMinWidth(1280)`).

**PR 5 (detalhe):** depois do PR 4 (mesmos `CellCard` e `CellsTable`), do PR 3 em produção (o "Ver todos os relatórios" leva ao filtro Célula), e do front do E2.05 (`RecordAuthorship`, `use-cell-report`) e do E2.08 (`CellFormDialog`, `use-member-statuses`).

**Ordem ideal do bloco:** … E2.07 → E2.08 → E2.09 → **E2.10** (PR 1 e PR 2 em paralelo; depois PR 3 e PR 4 em paralelo; por último o PR 5) → E2.11 → E2.12.

### Dependências e impactos em outros passos
| Passo | Relação |
|---|---|
| E1.08 | A ordem de Células (RN-03 de lá) passa à RN-13 daqui. O `fetchListPage` sai de Células e continua em Relatórios. |
| E2.01 | As rotas de excluídas ficam antes do detalhe. Os fluxos de exclusão de célula e de relatório abrem também pelo detalhe. |
| E2.02 | `canSeeRoute` deixa passar `/cells/:id`. O teste de paridade da `cells_view` vale para a `cells_list` sem filtros. |
| E2.05 | `RecordAuthorship` no detalhe; `use-cell-report` para editar um relatório pelo detalhe. |
| E2.06 | `g12_leader_id` e o nível do líder; o P40 nas opções do Líder. |
| E2.07 | `private.text_key`, `sp_day_start` e os componentes P50 a P54. `PersonMultiFilter` passa a receber a fonte das opções por props. Recomendação, sem urgência: o normalizador de lá passar a usar `first_distinct_ids`. |
| E2.08 | `cell_types()`, os dias, `can_submit_report` com a célula ativa, `CellFormDialog` e `use-member-statuses`. |
| E2.09 | As duas colunas e o `ReportStatus`, que ganha a variante `detail`. O critério de pronto de lá ("nenhuma leitura da `cells_view` fora da lista pedindo `report_status`") passa a "fora da lista e do detalhe". O mapa do filtro que o E2.09 deixou para cá (PostgREST com `or=`) dá lugar aos parâmetros da `cells_list`, com o mesmo resultado. Recomendação para o E2.09 (DT-08 de lá): `sp_day_start` passar a usar `sp_instant`, com o mesmo resultado. |
| E2.11 | O "Novo relatório" do detalhe usa o mesmo lançamento. A visibilidade dos relatórios pelo retrato (REL-09) precisa ir para a `cell_reports_view`, e não só para a política: `cell_recent_reports`, o filtro Célula e a `cell_identity` acompanham sem mudar. Se o formulário passar a aceitar oferta vazia, gravar nulo (e não 0), para "Não informada" aparecer. |
| E2.12 | Integra o filtro Célula ao painel de Relatórios, com o `RecordFilterChip` e a `cell_identity`. Pode reaproveitar o cartão de relatório do detalhe e o par normalizador e `WHERE` deste spec, se precisar de RPC. |
| E2.14 | Os cards de células usam `cellListHref`. "Novas células da semana" conta `created_at` entre `sp_day_start(week_start)` e `sp_day_start(week_start + 7)`, a mesma regra do filtro. |
| E4.09, E5.04 | Nada a carregar. Os números das listas filtradas não batem com o legado (Impactos do Negócio). |
| Consolidação | A flag entra no `WHERE` das views, e as funções herdam. |

**Mudanças nos documentos, no aceite** (o `product-owner` atualiza a matriz, a seção 3 e o Progresso; o `architect` atualiza o resto do `CLAUDE.md` na revisão final):
- **`CLAUDE.md`:**
  - **Schema efetivo:** o enum `cell_filter_person`.
  - **Lógica no banco:** `cells_list` e `cells_list_count` (*definer*, SQL dinâmico com os filtros ativos, só a `cells_view`); `cell_filter_options` e `cell_filter_names` (*invoker*, opções das células visíveis); `cell_recent_reports` (*invoker*, porta pela célula visível, relatórios visíveis, comparação no servidor); `cell_identity` (*invoker*, célula ou relatório visível); `first_distinct_ids`.
  - **Front:** rotas `/cells/:id` (detalhe) e `/cell-reports?cell=<id>`; Células paginada pela `cells_list`, com os 10 filtros na URL (`src/lib/cells/filters.ts`); o gráfico do detalhe carregado sob demanda. Sai "Células … ainda carregam tudo no cliente" (o que restar dessa frase depois do E1.08).
  - **Armadilhas**, entram:
    - "filtro novo de Células entra em `private.cell_filter_normalize` e `private.cell_filter_sql`, e só como fragmento fixo; valor nunca é concatenado";
    - "a `cells_view` é o tipo de retorno da `cells_list`: `DROP VIEW` exige recriar as duas RPCs, e todo `CREATE` ou `CREATE OR REPLACE` da view repete `WITH (security_barrier = true, security_invoker = false)`";
    - "a `cells_list` devolve as linhas já na ordem da RN-13 do E2.10; o front não usa `.order()` nela";
    - "os relatórios do detalhe da célula vêm só da `cell_recent_reports`; a visibilidade de relatório muda na `cell_reports_view`, e não só na política";
    - "o `chart.tsx` importa o Recharts inteiro: só por `React.lazy`";
    - "`/cells/deleted` antes de `/cells/:id`, e o `canSeeRoute` deixa passar o detalhe".
  - **Matriz** (PO): "Filtros de células" em ✅.
- **`docs/migracao.md`** (PO):
  - **3.4:** CEL-06 e CEL-07 em ✅. "Onde impor": CEL-06, "RPC `cells_list` e `cells_list_count` + UI"; CEL-07, "`cells_view` por id, `cell_recent_reports` e `cell_identity` + UI".
  - **3.6:** DSH-05 com Células pronta (`cellListHref`).
  - **Progresso:** o E2.10 com o link do spec e "(desenho pronto; entra depois do banco do E2.07 ao E2.09 em produção)".
  - **E5.04:** as diferenças esperadas da lista filtrada (os itens do Impactos do Negócio).

### Pontos de extensão
| Futuro | Onde muda |
|---|---|
| Q-1, Q-2 e Q-4 a Q-7 | Ver [Perguntas Q-1 a Q-7](#perguntas-q-1-a-q-7-padrão-e-custo-das-alternativas). |
| Filtros de Relatórios (E2.12) | O mesmo par normalizador e `WHERE`, com `first_distinct_ids`, `private.text_key` e `sp_day_start`; o `RecordFilterChip` e a `cell_identity` para o filtro Célula. |
| Cards do Dashboard (E2.14) | `cellListHref`, `sp_day_start` e as colunas do E2.09. |
| Outras telas de detalhe (Escolas, Turmas, Consolidação) | O P80 e o molde do detalhe: a view por id, o cache da lista para o topo e o estado "não encontrado" único. |
| Consolidação | O `WHERE` das views. |
| Desempenho | Riscos 3 e 12. |

### Implantação
| PR | Ordem | Efeito no front em produção |
|---|---|---|
| 1 (banco) | Pré-requisitos em produção; [conferência](#conferência-em-produção-tarefa-1); nunca junto de outro PR que recrie a `cells_view`; merge → "Deploy: banco" (migrations 1 e 2) | Nenhum. As funções novas ficam sem leitor. |
| 2 (componentes) | merge → promote | Nenhum. Membros e Auditoria ficam iguais. |
| 3 (Relatórios: filtro Célula) | merge → promote (recusado se o PR 1 não estiver no banco) | `/cell-reports?cell=<id>` passa a filtrar, com o chip. Ninguém ainda leva a esse link. |
| 4 (Células com filtros) | merge → promote | Os filtros, os chips, o total em texto e a ordem com a "data não registrada" no fim. |
| 5 (detalhe) | depois do promote do PR 3; merge → promote | O detalhe da célula e o link de cada célula da lista. |

- Antes do "Deploy: banco" do PR 1, o usuário roda a [conferência](#conferência-em-produção-tarefa-1). Uma guarda que falha não muda nada, e a publicação pode ser repetida.
- **Rollback:**
  - o front volta pelo promote do commit anterior;
  - o banco volta com uma migration nova que derruba as funções, o enum e os tipos novos, se for preciso. Nada é gravado, então não há dado a desfazer.

### Conferência em produção (tarefa 1)
SQL **só de leitura**, para o usuário rodar no SQL Editor do projeto `gkhnjhmgeceoaqeynhrj` antes do "Deploy: banco" do PR 1. Nenhuma consulta devolve dado pessoal: só nomes de objetos, definições e contagens.

```sql
-- a. Pré-requisitos. Esperado: todos verdadeiros.
SELECT to_regprocedure('private.text_key(text)') IS NOT NULL                       AS e207_text_key,
       to_regprocedure('public.sp_day_start(date)') IS NOT NULL                    AS e207_sp_day_start,
       to_regprocedure('public.cell_types()') IS NOT NULL                          AS e208_cell_types,
       to_regtype('public.cell_report_status') IS NOT NULL                         AS e209_enum,
       (SELECT count(*) = 9 FROM pg_attribute
         WHERE attrelid = 'public.cells_view'::regclass AND NOT attisdropped
           AND attname IN ('g12_leader_id', 'leader_g12_level', 'leader_is_pastor', 'leader_gender',
                           'meeting_weekday', 'can_submit_report', 'created_by_name',
                           'report_status', 'report_missing_weeks'))              AS cells_view_colunas,
       (SELECT count(*) = 6 FROM pg_attribute
         WHERE attrelid = 'public.cell_reports_view'::regclass AND NOT attisdropped
           AND attname IN ('participants_count', 'visitors_count', 'cell_leader_name',
                           'cell_meeting_day', 'cell_meeting_time', 'cell_deleted'))
                                                                                     AS cell_reports_view_colunas,
       NOT (SELECT attnotnull FROM pg_attribute
             WHERE attrelid = 'public.cells'::regclass AND attname = 'created_at') AS e205_created_at_anulavel,
       NOT has_schema_privilege('authenticated', 'private', 'USAGE')
         AND NOT has_schema_privilege('anon', 'private', 'USAGE')                  AS private_fechado;

-- b. Nomes livres. Esperado: 0 linhas.
SELECT 'tipo' AS objeto, n.nspname || '.' || t.typname AS nome
  FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
 WHERE (n.nspname, t.typname) IN (('public', 'cell_filter_person'), ('private', 'cell_filter'))
UNION ALL
SELECT 'função', p.oid::regprocedure::text
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE (n.nspname, p.proname) IN (('public', 'cells_list'), ('public', 'cells_list_count'),
                                  ('public', 'cell_filter_options'), ('public', 'cell_filter_names'),
                                  ('public', 'cell_recent_reports'), ('public', 'cell_identity'),
                                  ('public', 'first_distinct_ids'),
                                  ('private', 'cell_filter_normalize'), ('private', 'cell_filter_sql'));

-- c. Índices em cells.created_at (informa: se o E2.05 já criou um, a migration não cria outro).
SELECT indexname, indexdef FROM pg_indexes
 WHERE schemaname = 'public' AND tablename = 'cells' AND indexdef ILIKE '%(created_at%';

-- d. Dados que mudam o que a tela mostra (informa; só contagens).
SELECT (SELECT count(*) FROM public.cells WHERE deleted_at IS NULL)                         AS celulas,
       (SELECT count(*) FROM public.cells WHERE deleted_at IS NULL AND NOT is_active)       AS inativas,
       (SELECT count(*) FROM public.cells WHERE deleted_at IS NULL AND created_at IS NULL)  AS sem_data_de_cadastro,
       (SELECT count(*) FROM public.cells WHERE deleted_at IS NULL
           AND coalesce(btrim(street), '') = '')                                            AS sem_rua,
       (SELECT count(*) FROM public.cell_reports WHERE deleted_at IS NULL AND offering IS NULL)
                                                                                             AS oferta_nula,
       (SELECT count(*) FROM public.cell_reports r WHERE r.deleted_at IS NULL
           AND EXISTS (SELECT 1 FROM unnest(r.visitors) v WHERE coalesce(btrim(v), '') = ''))
                                                                                             AS visitante_sem_nome,
       (SELECT max(n) FROM (SELECT count(*) AS n FROM public.cell_reports
                             WHERE deleted_at IS NULL GROUP BY cell_id) x)                 AS max_relatorios_por_celula,
       (SELECT count(DISTINCT leader_id) FROM public.cells WHERE deleted_at IS NULL)        AS lideres_distintos;

-- e. Definições atuais (base para conferir os nomes; sem dado pessoal).
SELECT pg_get_viewdef('public.cells_view'::regclass, true);
SELECT pg_get_viewdef('public.cell_reports_view'::regclass, true);
SELECT relacl, reloptions FROM pg_class WHERE oid IN ('public.cells_view'::regclass,
                                                       'public.cell_reports_view'::regclass);

-- f. Volume e configuração.
SELECT (SELECT count(*) FROM public.members WHERE deleted_at IS NULL)      AS membros,
       (SELECT count(*) FROM public.cell_reports WHERE deleted_at IS NULL) AS relatorios,
       current_setting('work_mem')                                         AS work_mem;
SELECT rolname, rolconfig FROM pg_roles WHERE rolname IN ('authenticated', 'authenticator');
```
**Parar e voltar ao `architect`:** (a) com algum falso; (b) com linhas. Em (d), `visitante_sem_nome` maior que zero não para a publicação, mas o número de visitantes do detalhe contaria esses nomes vazios: vai como achado para o E2.11 (REL-08).

### Verificações obrigatórias (para o QA)
**pgTAP** (`supabase/tests/database/e210_*.test.sql`, autocontido, com `ROLLBACK`). A massa é a do Negócio, com os dados que as regras do E2.04 e do E2.08 exigem e o histórico do E2.09 ajustado para as células com datas passadas (risco 4 de lá), montada com os triggers ligados. As consultas "pela API" rodam como `authenticated`, com `request.jwt.claims` de cada persona.

- **Estrutura e privilégios:** o enum; `cells_list` e `cells_list_count` *definer*; as quatro de leitura *invoker*; todas com `search_path` fixo e EXECUTE só para `authenticated`; `first_distinct_ids` com EXECUTE para `authenticated`; as internas sem EXECUTE para `anon`, `authenticated` e `service_role`; os papéis da API sem USAGE em `private`.
- **Paridade (RN-01, RN-03):** para cada persona (Rita, Samuel, Pedro, André, Diego, Caio, Fábio, Ester, Hugo e Lia), os ids de todas as páginas da `cells_list` sem filtros são os da `cells_view`, na ordem da RN-13, e a `cells_list_count()` é igual à contagem dela.
- **RN-02 a RN-09, RN-11 e RN-13:** os critérios pela `cells_list` e pela `cells_list_count`, com a sessão de cada persona.
- **RN-04 a RN-06:**
  - as opções de Líder e de G12 de Pedro e de André, exatamente como nos critérios, em ordem alfabética, com e sem busca;
  - `cell_filter_names`: Tânia para Pedro (nenhuma linha), para André (o nome); Débora para Pedro (nenhuma); Caio para Rita (o nome); excluído e inexistente (nenhuma);
  - 12 ids valem os 10 primeiros; repetidos e nulos (DA-2);
  - nenhuma resposta de Pedro traz o id ou o nome de Tânia, de Débora, de Samuel ou de Magda.
- **RN-07:** acentos, maiúsculas, espaços nas pontas e seguidos, tabulação, `%`, `_`, `\`, aspas, texto com mais de 100 caracteres e célula sem endereço.
- **RN-10:** para cada opção, a `cells_list_count` igual ao número de linhas da `cells_view` com o valor correspondente nas duas colunas do E2.09, no mesmo teste (a propriedade não depende da hora em que o teste roda); a massa montada relativa a `now()` para que cada opção tenha pelo menos uma célula; a combinação entre os subgrupos; a inativa e a sem dia nunca entram; `no_meeting_day` e semanas fora de 1 a 4 ignorados. Os critérios de momento fixo (21:00, sábado 23:59 e domingo 00:00) ficam com o pgTAP do E2.09, que controla o momento.
- **RN-11:** o limite do dia de Brasília (23:30 de Brasília = 02:30 UTC do dia seguinte), `created_at` nulo, só "a partir de", só "até", datas invertidas (DA-7) e datas futuras, nas sessões em UTC e em Asia/Tokyo.
- **RN-13:** a ordem da massa; 60 células com o mesmo `created_at`, percorridas de 25 em 25, aparecem uma vez cada; com filtro, a mesma ordem relativa.
- **RN-14:** a `cells_view` por id para Diego (C1, C5, inexistente: nenhuma linha), Hugo (C2: a linha) e Lia (C1: nenhuma); `cell_recent_reports` vazio para Diego e Lia em C1 (DA-4).
- **RN-17, RN-18 e RN-20:** a ordem de C1, R3 de fora, os sinais (R1 +1 e +1 contra R4; R2 sem; R4 +1 e −1 contra R5); R1 excluído; R3 restaurado (R1 contra R3); oferta nula e zero; 12 relatórios dão 10; o participante excluído conta; nenhuma coluna com nomes.
- **RN-19:** `cell_identity` para Pedro e Lia (C1), Diego (nenhuma), Rita (C5 excluída, pelo relatório), Ester (C8, sem relatório) e um id inexistente; a `cell_reports_view` com `cell_id` dá os totais dos critérios.
- **RN-21:** para Rita, Pedro e André, `dashboard_summary().cells_pending` igual à `cells_list_count(_report_statuses => '{pending}')`; cada linha da `dashboard_cells_by_type()` igual à `cells_list_count(_types => …)`; cada casal da `dashboard_g12_ranking()` igual à `cells_list_count(_g12_ids => <os dois>, _is_active => true)`.
- **Injeção (risco 1):** textos maliciosos em rua, bairro, cidade e busca são tratados como texto, sem erro e sem efeito.
- **DA-1:** os valores fora da regra normalizados; um valor fora do enum e um uuid malformado recusados (22P02).

**Concorrência:** nenhum cenário novo. O passo só lê.

**Volume:** as metas de [Metas de tempo e índices](#metas-de-tempo-e-índices), com o `EXPLAIN (ANALYZE, BUFFERS)` anexado ao PR, no gerador de volume do E1.08 e do E2.06 (com o histórico do E2.09) e uma célula com 400 relatórios. Conferir no plano:
- a etapa 2 da `cells_list` usa `cells_pkey`;
- sem o filtro de situação, o plano da `cells_list_count` não chama `private.cell_report_situation`;
- o G12 e a data entram na view (*leakproof*);
- `cell_recent_reports` usa `cell_reports_cell_id_date_idx` e a PK de participantes.

**Vitest:** `src/lib/cells/{filters,filter-texts,detail,report-comparison,evolution}.ts`, `src/lib/cell-reports/{labels,cell-filter}.ts` e `canSeeRoute` (leitura e limpeza da URL, 10 primeiros, datas invertidas, contagem de 1 a 10 com a DA-6, chips na ordem e com o texto inteiro, argumentos da RPC, os links da RN-21, `meetingLine`, `addressLines`, `formatOffering`, `trendOf`, pontos da evolução).

**Playwright:** os critérios `UX-` de cada PR com a massa, mais o *smoke* de login. O relógio do servidor não é controlável: os critérios que dependem da hora comparam a tela com a resposta do servidor, como a DT-10 do E2.09.

## Tarefas
_Seção do `architect`._

Cinco PRs no `mci-connect`. **O PR 1 começa depois do banco do E2.02, do E2.05, do E2.06, do E2.07 (PR 1), do E2.08 (PR 2) e do E2.09 (PR 1) em produção.**
- Dentro do PR 1, o banco vai primeiro, e os tipos são regenerados antes do front.
- Cada desenvolvedor aciona o `code-reviewer` ao terminar a sua tarefa; esse passo não aparece na tabela.
- Na coluna RNs, os números são das regras deste spec. Na coluna UX, os dos critérios `UX-`.

| # | Responsável | Descrição | Arquivos | RNs | UX | Depende de |
|---|---|---|---|---|---|---|
| **PR 1: banco** | | | | | | |
| 1 | backend-developer | Reler as migrations finais do E2.02, do E2.05, do E2.06, do E2.07, do E2.08 e do E2.09 e confirmar os nomes usados aqui: as colunas da `cells_view` e da `cell_reports_view` da [conferência](#conferência-em-produção-tarefa-1) (a), `private.text_key`, `sp_day_start`, `cell_types()`, o enum `cell_report_status` e os valores dele, e um índice em `cells.created_at` do E2.05. Entregar o SQL da conferência para o usuário rodar e usar a saída (e) como base. Parar e voltar ao `architect` nos casos listados ali. | — | 03, 05, 10, 11 | — | os pré-requisitos do PR 1 em produção |
| 2 | backend-developer | Migration 1: guarda; enum `cell_filter_person`; `first_distinct_ids`; `cells_created_at_idx`; tipo `private.cell_filter`, `private.cell_filter_normalize` e `private.cell_filter_sql`; `cells_list` e `cells_list_count` (*definer*); `cell_filter_options` e `cell_filter_names` (*invoker*); privilégios; pós-condições. | `supabase/migrations/<ts>_e210_01_cell_list.sql` | 01 a 13, 21 | dados de 08, 09, 12, 13 | 1 |
| 3 | backend-developer | Migration 2: guarda; `cell_recent_reports` e `cell_identity` (*invoker*); privilégios; pós-condições. Regenerar o `types.ts`, sem mudar comportamento no front (só os tipos que o `tsc` apontar). | `supabase/migrations/<ts>_e210_02_cell_detail.sql`, `src/integrations/supabase/types.ts` | 14, 17 a 20 | dados de 21 a 25 | 2 |
| 4 | qa | pgTAP de [Verificações](#verificações-obrigatórias-para-o-qa) e volume com `EXPLAIN` (inclusive a célula com 400 relatórios). | `supabase/tests/database/e210_*.test.sql` | 01 a 21 | — | 3 (escreve em paralelo com a 2 e a 3, a partir dos contratos) |
| **PR 2: componentes de filtro, sem mudança de tela** | | | | | | |
| 5 | frontend-developer | `PersonMultiFilter` com a fonte das opções e dos nomes, o texto da busca sem resultado e o formato da opção por props (Membros continua igual); `GroupedMultiChoiceFilter` (P85), no `Sheet` e no `Popover`; `RecordFilterChip` (P84), com carregando, não carregado e indisponível; `use-prefers-reduced-motion`. | `src/components/filters/{PersonMultiFilter,GroupedMultiChoiceFilter,RecordFilterChip}.tsx`, `src/hooks/use-prefers-reduced-motion.ts`, o uso em `src/components/members/MemberFilters.tsx` | 02, 06, 10, 19 | 06, 08, 09, 10, 25, 28 | PR 2 do E2.07 na `main` |
| 6 | qa | Testes de componente do P84 e do P85 e do `PersonMultiFilter` com uma fonte simulada (rede simulada, `fieldset` dentro de `fieldset`, limite de 10, "Pessoa indisponível"); axe; Membros sem regressão (os testes de lá passam sem mudança). | `src/components/filters/*.test.tsx` | — | 06, 08, 09, 10, 28 | 5 |
| **PR 3: Relatórios com o filtro Célula** | | | | | | |
| 7 | frontend-developer | `src/lib/cell-reports/cell-filter.ts` com Vitest (ler e limpar `cell`, texto do chip, "Limpar filtros" que mantém `size` e `report`); `use-cell-identity`; `use-cell-reports-list` com `cellId` (`.eq("cell_id", …)` na página e no total, e na chave); `CellReports.tsx` (T15: `RecordFilterChip`, "Limpar filtros", a dica e o vazio com filtros; o título não muda). | `src/lib/cell-reports/cell-filter.ts`, `src/hooks/{use-cell-identity,use-cell-reports-list}.ts`, `src/pages/CellReports.tsx` | 19 | 25, 26, 27, 30 | 3 (tipos) e 5; front de Relatórios do E2.01 (PR 3) e do E2.02 na `main` |
| 8 | ux-designer | Revisão da UI do PR 3 (T15, P84) em 320, 360, 768 e 1280 px, nos temas claro e escuro, com zoom de 200%. | — | — | 25, 26, 27 | 7 |
| 9 | qa | Vitest (`cell-filter`); testes de componente (chip carregando, não carregado e indisponível; UX-30); Playwright com a massa (UX-25 e os critérios da RN-19 por Pedro, Lia, Diego, Rita e Ester, com a rede inspecionada para Diego). | `src/**/*.test.ts(x)`, `e2e/relatorios-filtro-celula.spec.ts` | 19 | 25, 26, 27, 30 | 7 |
| **PR 4: Células com filtros** | | | | | | |
| 10 | frontend-developer | `src/lib/cells/{filters,filter-texts}.ts` com Vitest (URL, mapas, contagem, chips, argumentos, `cellListHref`); os subgrupos e as opções curtas da Situação do relatório em `src/lib/cells/report-status.ts`; `use-cell-filters`; `use-cells-list` pelas duas RPCs; `use-cell-filter-options` (opções e nomes); `src/components/cells/CellFilters.tsx` (os 10 filtros na ordem da UXD-1); `Cells.tsx` (T1 a T7, menos o link do detalhe: "Buscar", "Filtros (N)", "Limpar filtros", chips, total em texto com `role="status"`, `Skeleton`, `Alert` com "Tentar de novo", vazios, legenda do E2.09 depois dos filtros). | `src/lib/cells/{filters,filter-texts,report-status}.ts`, `src/hooks/{use-cell-filters,use-cells-list,use-cell-filter-options}.ts`, `src/components/cells/CellFilters.tsx`, `src/pages/Cells.tsx` | 01 a 13, 21 | 01 a 14, 26 a 30 | 3 (tipos) e 5; front de Células do E2.02, do E2.06, do E2.08 (PRs 4 e 5) e do E2.09 (PR 3) na `main` |
| 11 | ux-designer | Revisão da UI do PR 4 (T1 a T7, P50 a P54, P85) em 320, 360, 768, 1024, 1280 e 1440 px, nos temas claro e escuro, com zoom de 200%. | — | — | 01 a 14, 26 a 29 | 10 |
| 12 | qa | Vitest (`filters`, `filter-texts`); testes de componente (UX-02, 03, 04, 05, 06, 10, 11, 14, 30); Playwright com a massa (UX-01, 07, 08, 09 com a rede inspecionada, 12, 13 e os critérios da RN-01 à RN-13 e da RN-21 pela tela); axe (UX-28, 29). | `src/**/*.test.ts(x)`, `e2e/celulas-filtros.spec.ts` | 01 a 13, 21 | 01 a 14, 26 a 30 | 10 |
| **PR 5: detalhe da célula** | | | | | | |
| 13 | frontend-developer | Rota `/cells/:id` depois de `/cells/deleted`; `canSeeRoute` deixando passar o detalhe; `src/lib/cells/{detail,detail-texts,report-comparison,evolution}.ts` e `formatOffering` com Vitest; `useCell` com `CELL_DETAIL_SELECT`; `use-cell-list-preview`, `use-cell-recent-reports`, `use-list-return-focus`; `CellDetail.tsx` e `src/components/cells/detail/*` (T8 a T14: topo com o foco no `h1`, ações no cabeçalho a partir de 768 px e rodapé fixo abaixo disso, autoria com `RecordAuthorship`, `ReportStatus` com a variante `detail`, pessoas com "(inativo)" pelo `use-member-statuses`, endereço, últimos relatórios em cartões e tabela com as setas, "Ver todos os relatórios", Evolução com abas, tabela e o gráfico por `React.lazy`, "Célula não encontrada", erro geral e erro só dos relatórios); "Editar" de relatório pelo `use-cell-report`; exclusão da célula com a ordem de [Front](#front); o link do P81 em `CellCard` e `CellsTable`, com `state.fromList` e a volta com o foco; `viewport-fit=cover`, se faltar. | `src/App.tsx`, `src/lib/access/access.ts`, `src/lib/cells/*`, `src/lib/cell-reports/labels.ts`, `src/hooks/{use-cell,use-cell-list-preview,use-cell-recent-reports,use-list-return-focus}.ts`, `src/pages/{CellDetail,Cells}.tsx`, `src/components/cells/{CellCard,CellsTable,ReportStatus}.tsx`, `src/components/cells/detail/*`, `index.html` | 14 a 20 | 15 a 24, 26 a 30 | 10 (mesmos arquivos); PR 3 em produção; front do E2.05 (`RecordAuthorship`, `use-cell-report`) e do E2.08 (`CellFormDialog`, `use-member-statuses`) na `main` |
| 14 | ux-designer | Revisão da UI do PR 5 (T8 a T14, P80 a P83, a DA-5) em 320, 360, 768, 1024, 1280 e 1440 px, nos temas claro e escuro, com zoom de 200% e fonte grande. | — | — | 15 a 24, 26 a 29 | 13 |
| 15 | qa | Vitest (`detail`, `report-comparison`, `evolution`, `formatOffering`, `canSeeRoute`); testes de componente (UX-18, 19, 21, 23, 24, 28, 30 com respostas simuladas); Playwright com a massa (UX-15, 16, 17, 20, 22, 24 com a rede inspecionada para Diego e Lia, e os critérios da RN-14 à RN-20 pela tela); axe nos dois temas (UX-29); o `npm run build` sem `recharts` no pacote principal. | `src/**/*.test.ts(x)`, `e2e/celula-detalhe.spec.ts` | 14 a 20 | 15 a 24, 26 a 30 | 13 |
| **Fechamento** | | | | | | |
| 16 | architect | Revisão final dos 5 PRs. Atualizar o `CLAUDE.md` ([Mudanças nos documentos](#dependências-e-impactos-em-outros-passos)). O aceite, a matriz e o `docs/migracao.md` são do `product-owner`. | `CLAUDE.md` | — | — | 4, 6, 9, 12, 15 |

**Ordem de execução:**
- PR 1: 1 → 2 → 3. A 4 é escrita em paralelo com a 2 e a 3 e roda depois da 3. O PR 1 só vai para o "Deploy: banco" com a 4 aprovada (metas e paridade).
- PR 2 (5 → 6) em paralelo com o PR 1: não depende do banco.
- PR 3 (7 → (8 ∥ 9)) e PR 4 (10 → (11 ∥ 12)) em paralelo entre si, depois do PR 1 mergeado (tipos) e do PR 2. O promote dos dois exige o PR 1 no banco.
- PR 5: 13 → (14 ∥ 15), depois do PR 4 mergeado. O promote do PR 5 vem depois do promote do PR 3.
- 16 no fim.

**Critérios de pronto**
1. **Tarefas de banco (2 e 3):**
   - as migrations rodam num banco zerado depois das existentes e rodam de novo sem erro;
   - a `cells_view` e a `cell_reports_view` ficam iguais (nenhuma das duas é recriada);
   - nenhuma função nova com EXECUTE para `anon`; as internas sem EXECUTE para os papéis da API; os papéis da API sem USAGE em `private`;
   - o `types.ts` está regenerado;
   - os testes do E1.08 e do E2.01 ao E2.09 continuam passando.
2. **Tarefa 2:** a guarda falha num banco sem o E2.09; nenhuma entrada passa pelo `format` (só `private.cell_filter_sql`, com fragmentos fixos); a paridade por persona passa.
3. **Tarefa 3:** `cell_recent_reports` volta vazio para quem não vê a célula; nenhuma coluna de nome de participante ou de visitante na resposta.
4. **Tarefa 4:** todos os critérios das RNs que dependem do banco passam, e as metas estão atendidas, com o `EXPLAIN` no PR.
5. **Tarefas 5, 7, 10 e 13:**
   - `npm run lint`, `npm test` e `npm run build` verdes;
   - sem `any` e sem asserção de tipo (`as Tipo`) nos arquivos novos (`as const` é permitido);
   - nenhuma regra de domínio dentro de componente (fica em `src/lib/`);
   - nenhum texto do spec fora dos módulos de texto;
   - nenhuma leitura de `members` ou de `cells` direto da tabela; nenhuma chamada à `member_names` no Líder e no G12;
   - nenhum cálculo de situação do relatório no front (E2.09).
6. **Tarefa 5:** Membros e Auditoria ficam iguais (os testes de lá passam sem mudança).
7. **Tarefa 7:** com o link de Diego, nem o nome nem o id do líder de C1 aparecem no DOM ou nas respostas; um `cell` sem formato de UUID sai da URL com `replace`.
8. **Tarefa 10:**
   - a URL é limpa na primeira leitura, com `replace`;
   - com o link do critério da RN-06 (Pedro, G12: Tânia), nem o nome nem o id de Tânia aparecem no DOM ou nas respostas, e a tela não chama a `member_names`;
   - o hook da lista não chama `.order()`.
9. **Tarefa 13:**
   - `/cells/xyz` não faz nenhuma requisição; Diego e Lia em C1 não recebem nenhum dado de C1 (rede inspecionada);
   - só `CellEvolutionChart` importa `@/components/ui/chart`, por `React.lazy`, e o `npm run build` deixa o Recharts fora do pacote principal;
   - excluir a célula pelo detalhe nunca mostra a célula excluída na lista, nem por um instante.
10. **Tarefas 8, 11 e 14:** o `ux-designer` dá o veredito e lista os ajustes, que voltam ao `frontend-developer` antes de o QA fechar o PR. Na 14, ele confirma a DA-5 (a quebra da lista em 1280 px).

## Testes
_Seção do `qa`._

| RN | Testes | Resultado |
|---|---|---|
