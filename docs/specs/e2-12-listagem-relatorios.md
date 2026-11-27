# E2.12: Listagem de relatórios com filtros e atalhos de semana

> Status: Negócio, Experiência (UX), Solução técnica e Tarefas prontos.
> - Negócio escrito em 2026-11-24 pelo `product-owner`, sem regras "a confirmar". Revisto no mesmo dia com o Negócio do E2.11 (todo relatório tem o retrato; fim da transição da RN-04) e com as decisões do PO sobre as pendências da UX.
> - Experiência (UX) escrita em 2026-11-24 pelo `ux-designer`: telas T1 a T16, padrões P90 a P94 e critérios UX-01 a UX-32. As pendências PO-UX-1 a PO-UX-12 foram resolvidas pelo PO no mesmo dia e viraram os padrões P-LRE-23 a P-LRE-34. As perguntas AQ-1 a AQ-13 são do `architect`; a AQ-7 caiu com o E2.11.
> - Ficam para o usuário revisar no PR os padrões P-LRE-01 a P-LRE-34 e as perguntas Q-1 a Q-7. Nenhuma bloqueia: cada uma já tem um padrão adotado.
> - Depende do E2.01, do E2.02, do E2.05, do E2.06, do E2.10 e do E2.11 (retrato do relatório, REL-09). Entra depois do E2.11.
> - Solução técnica e Tarefas escritas em 2026-11-24 pelo `architect`, só como desenho: quatro PRs (banco; lista com filtros e atalhos; consulta; consulta no detalhe da célula, opcional). Ficam para o usuário revisar no PR as definições DA-1 a DA-14. Faltam os Testes (QA).
> - **Andamento (2026-11-27):** PR 1 (banco, tarefas 1 a 4) implementado e testado na pista A, sem merge nem deploy; divergências em [Implementação do PR 1](#implementação-do-pr-1-2026-11-27). Faltam a conferência em produção, os PRs 2 a 4 e a revisão final.
>
> Slug: `e2-12-listagem-relatorios` · Paridade com o legado: sim (REL-13). Regras novas:
> - filtros de múltipla escolha, pessoa indisponível e G12 que inclui os relatórios do próprio G12;
> - filtros de tipo e de reunião (realizada ou não) na tela;
> - atalhos de semana na própria tela, e não no menu;
> - consulta "Ver relatório" em toda linha, com os participantes pelo nome, para todos que veem o relatório;
> - na lista, o equivalente de cada número de relatórios do Dashboard.

## Negócio
_Seção do `product-owner`. Escrita em 2026-11-24. Fontes:_
- _no [`docs/migracao.md`](../migracao.md): a linha do E2.12 na seção Progresso, as regras REL-07, REL-09, REL-11 e REL-13 (3.5), DSH-02, DSH-04 e DSH-05 (3.6), e o mapeamento dos relatórios na 5.5;_
- _no `CLAUDE.md` da raiz: a listagem de relatórios do legado e a matriz de paridade;_
- _no legado:_
  - _`Domain/Querying/Filters/ReportFilter.cs`, `Domain/Extensions/QueryingExtensions.cs` (filtros de relatórios) e `Domain/Model/Report.cs`;_
  - _`Infra/Repositories/ReportRepository.cs` e `App/Services/DashboardService.cs`;_
  - _`UI/pages/Report/index.js`, `UI/components/NavMenu/index.js`, `UI/AppRoutes.js` e `UI/pages/Home/index.js`;_
- _no novo (`mci-connect`, `origin/main`, `4595daa`): `src/pages/CellReports.tsx`, `src/hooks/use-cell-reports-list.ts`, `src/lib/cell-reports/fields.ts` e `src/components/AppSidebar.tsx`;_
- _nos specs:_
  - _[E1.08](e1-08-paginacao-servidor.md): RN-01, RN-03, RN-04, RN-06, RN-07, RN-08 e D-4;_
  - _[E2.01](e2-01-exclusao-logica.md): RN-08, RN-09, RN-11, RN-12, RN-13, P-DEL-19, UXD-7, PO-UX-3 e Impactos;_
  - _[E2.02](e2-02-perfis-escopo.md): RN-02, RN-04, RN-09, RN-13, RN-14, RN-22 e RN-23;_
  - _[E2.05](e2-05-auditoria-autor.md): RN-07, P-AUD-18, P30, P33 e P34;_
  - _[E2.06](e2-06-hierarquia-totais.md): RN-02, RN-08, RN-11, P-HIE-13 e "Definições para os passos seguintes";_
  - _[E2.07](e2-07-filtros-membros.md): RN-02 a RN-06, RN-12, RN-14, RN-17, P-FIL-01 a P-FIL-25, Impactos e os padrões P50 a P55 da UX;_
  - _[E2.08](e2-08-cadastro-celulas.md): RN-07 e RN-09;_
  - _[E2.09](e2-09-situacao-relatorio.md): Termos e Q-2;_
  - _o [E2.10](e2-10-listagem-celulas.md), com desenho pronto (mesclado na raiz no `58d05f1`): RN-08, RN-14, RN-17, RN-18, RN-19, RN-21, P-LCE-03, P-LCE-16, P-LCE-17, P-LCE-26, P-LCE-31, P-LCE-32, Impactos (E2.12), Navegação e rotas, os padrões P84 e P85 da UX e a nota da T11 que deixa para cá os selos de Relatórios._
  - _o Negócio do [E2.11](e2-11-lancamento-relatorio.md), ainda sem commit e só lido: Termos, RN-09, RN-11, RN-13, RN-14, RN-21, P-REL-06, P-REL-18, P-REL-19, P-REL-20, a tabela "Dados do legado" e os Impactos (E2.12 e E4.04)._

Os caminhos do legado são relativos a `g12app-net/`, com as abreviações do E2.01:
- `App/` = `G12App.Application/`;
- `Domain/` = `G12App.Domain/`;
- `Infra/` = `G12App.Infrastructure.Data/`;
- `API/` = `G12App.API/`;
- `UI/` = `G12App.API/ClientApp/src/`.

### Contexto e objetivo
No legado, a tela "Relatórios" (`UI/pages/Report/index.js`) tem um painel "Filtros" com:
- "Líder de Célula" e "G12", em texto;
- "Desde" e "Até", em datas;
- o link "Limpar filtros".

Cada linha mostra:
- o líder registrado no relatório e o G12 dele;
- o endereço da célula;
- o dia, a data e o horário;
- o tema, ou "Não houve célula.", e as observações;
- a oferta, o número de participantes e o de visitantes;
- os atalhos "Dados do líder" e "Dados da célula".

A lista vem da data mais recente para a mais antiga, com 20 relatórios por página. Nenhuma tela do legado mostra os nomes dos participantes de um relatório já enviado.

O menu "Células" de quem é administrador tem três atalhos: "Relatórios desta semana", "Relatórios de semana passada" e "Relatórios de semana retrasada" (`UI/components/NavMenu/index.js:79-81`). Cada um abre a lista com "Desde" e "Até" preenchidos com o domingo e o sábado da semana. O legado também abre a lista:
- pelo card "Relatórios Enviados" do Dashboard, com a semana atual;
- pelo card "Visitantes em Células";
- pelo "Ver relatórios" de uma célula (`/cells/:cellId/reports`), só com os relatórios dela, sem período e com o título "Relatórios da célula".

A consulta do servidor (`ReportFilter`) aceita, além do período e da célula:
- o tema;
- o tipo da célula, o líder, o timóteo e o anfitrião, todos como **registrados no relatório** (`Domain/Model/Report.cs:22-34`);
- "não houve célula", que o Dashboard usa no gráfico da semana.

Hoje o novo (conferido na `origin/main` do `mci-connect`, `4595daa`, em 2026-11-24):
- A lista de Relatórios tem só a busca, paginada no servidor e com o estado na URL (E1.08). A busca procura no nome do líder atual da célula e no tema. A ordem vai da data e do horário mais recentes para os mais antigos.
- Cada linha mostra o líder atual da célula, a rua e o bairro, a data e o horário, o selo "Realizada" ou "Não Realizada", as "presenças" (participantes e visitantes somados) e o tema. O relatório de célula excluída tem o selo "Célula excluída" (E2.01).
- As ações são "Editar", com "Editar Relatórios de Células", e "Excluir", com "Excluir Relatórios de Células". A oferta não aparece. Os nomes dos participantes só aparecem no formulário de edição.
- Não há filtros nem atalhos de semana. O menu tem só "Relatórios".
- O E2.01 desenhou a consulta "Ver relatório" só para o relatório de célula excluída e deixou para este passo levá-la a todas as linhas. O E2.10 desenhou o filtro Célula pela URL e deixou para este passo levá-lo ao painel e decidir sobre os nomes dos participantes. Nenhum dos dois está implementado.

Objetivo do passo:
- dar à lista de Relatórios os filtros do legado (líder, G12 e período), mais a célula, o tipo e a reunião, no escopo de cada pessoa;
- trazer os atalhos para a semana atual, a passada e a retrasada;
- dar a toda linha uma consulta do relatório, com os participantes pelo nome;
- deixar cada número de relatórios do Dashboard com um equivalente exato na lista, para que o E2.14 só precise ligar o clique.

### Termos
- **Filtro:** uma condição da lista de Relatórios, além da busca. **Filtro vazio:** sem nenhuma opção escolhida e sem data. Não restringe nada.
- **Filtro de múltipla escolha:** aceita uma ou mais opções. Basta valer uma delas (RN-02).
- **Relatório visível:** o relatório não excluído que a pessoa vê, conforme a RN-04 do E2.02, pelas pessoas registradas nele. Toda pessoa vê também os relatórios em que está registrada como líder, timóteo ou anfitrião (RN-14 b do E2.11). Registros excluídos não são visíveis (E2.01).
- **Retrato do relatório** (REL-09): o líder, o timóteo, o anfitrião e o tipo da célula **registrados no relatório**, no momento do envio. Mudanças posteriores na célula não mudam o retrato. Todo relatório tem o retrato (RN-14 e RN-21 do E2.11):
  - o relatório novo grava o retrato no envio, a partir da célula;
  - o relatório do legado traz o retrato do legado. Quando o legado não tem o tipo, a carga usa o tipo da célula (P-REL-18 do E2.11);
  - o relatório que já existia no novo recebe, na publicação do E2.11, as pessoas e o tipo que a célula tinha naquele momento (P-REL-19 do E2.11).
- **Líder registrado:** o líder do retrato.
- **G12 do relatório:** o G12 **atual** do líder registrado, calculado como o G12 da célula (RN-11 do E2.06):
  - quando o líder registrado é G12, é ele mesmo;
  - quando é pastor, aparece "Pastores";
  - quando está sem liderança, aparece "—".

  O relatório não guarda o G12. Um relatório antigo mostra o G12 de hoje do líder daquela data ("Definições" do E2.06).
- **Data do relatório:** a data da reunião registrada no relatório. No relatório de "Não houve célula", é o dia previsto da célula naquela semana (REL-06).
- **Semana:** de domingo, 00:00, a sábado, 23:59:59, no horário de Brasília (`America/Sao_Paulo`), como no E2.09.
- **Esta semana, semana passada e semana retrasada:** a semana de hoje, a anterior e a anterior a ela. "Hoje" é a data de Brasília segundo o servidor; o fuso e o relógio do aparelho não contam.
- **Reunião:** a reunião semanal da célula que o relatório registra. O filtro Reunião separa o relatório de célula realizada do de "Não houve célula", e a seção "Reunião" da consulta traz a data, o horário e o conteúdo do relatório. Em "Não houve célula", a data é a "Reunião prevista". Nunca se usa "Encontro", que é o retiro da Consolidação (P-REL-20 do E2.11).
- **Nome de referência:** o nome de uma pessoa que aparece numa linha visível mesmo quando ela está fora do escopo de quem consulta. Aparece só o nome, sem acesso ao cadastro (RN-06 do E1.08).
- **Consulta:** o painel "Ver relatório", só de leitura, com tudo o que o relatório registra.

### Personas e permissões
Este passo não cria permissão. Os filtros e a consulta aparecem para quem tem a lista de Relatórios (RN-22 do E2.02): "Visualizar Toda a Igreja", "Visualizar Seu Ministério", "Visualizar Relatórios de Toda a Igreja", "Visualizar Relatórios do Seu Ministério" ou uma permissão de lançar. As pessoas são as da [massa de exemplo](#massa-de-exemplo).

| Persona | Quem é (na massa) | Permissões relevantes | O que exercita |
|---|---|---|---|
| IG Igreja toda | Rita, função Administrador | todas | todos os filtros, a consulta e as ações sobre a igreja toda |
| PA Pastor | Samuel, função Líder | "Visualizar Seu Ministério" | relatório de pastor ("Pastores") e opções do G12 |
| G12 | Pedro, função Líder | "Visualizar Seu Ministério", "Editar Relatórios de Células", "Excluir Relatórios de Células" e "Enviar Relatório das Próprias Células" | filtros no escopo, pessoa indisponível, consulta com ações |
| LE Líder casado | André, função Líder | as mesmas de Pedro | relatório visto pelo ministério da cônjuge |
| OM Outro ministério | Diego, função Líder | as mesmas de Pedro | o que fica fora do escopo |
| PC Pessoa da célula | Caio, função Membro | "Visualizar Seu Ministério" e "Enviar Relatório das Próprias Células" | consulta sem editar, com os participantes pelo nome |
| SL Sem liderança | Ester, função Membro | "Visualizar Seu Ministério" | relatório de quem está sem liderança ("—") |
| SF Sem função | Hugo | nenhuma | sem Relatórios no menu; pela API, só os relatórios em que está registrado (RN-14 b do E2.11) |
| SR Só relatórios | Lia, função Secretaria | só "Visualizar Relatórios de Toda a Igreja" | filtros e consulta sem ver membros nem células |

### Histórias
- Como liderança, quero abrir os relatórios desta semana, da passada e da retrasada com um toque, para acompanhar as células na reunião de liderança.
- Como G12, quero filtrar os relatórios do meu ministério por período, para ver como as células estão indo.
- Como líder, quero filtrar os relatórios pelos líderes das células, para acompanhar cada discípulo.
- Como liderança, quero ver só os relatórios de "Não houve célula", para entender por que as células não se reuniram.
- Como líder, quero abrir um relatório e ver quem participou e quem visitou, para cuidar dos visitantes e de quem faltou.
- Como liderança, quero abrir pelo Dashboard a lista exata dos relatórios por trás de cada número.

### Decisões

#### Decisões do usuário e de passos anteriores
| Decisão | O que vale aqui | Onde |
|---|---|---|
| RN-01, RN-03, RN-04 e RN-06 do E1.08; D-4 do E1.08 (2026-11-15) | Paginação e total no servidor, estado na URL, ordem, busca e nomes de referência, inclusive os participantes do relatório. | RN-02, RN-12, RN-13, RN-14, RN-17 |
| RN-08, RN-09, RN-11, RN-12 e RN-13 do E2.01 | Excluídos não aparecem nem contam. O relatório de célula excluída continua na lista, só para consulta. O participante excluído aparece pelo nome. O nome de um líder excluído continua como nome de referência. | RN-03, RN-05, RN-15, RN-16, RN-17 |
| P-DEL-19, UXD-7 e Impactos do E2.01 | A consulta em todas as linhas ficou para este passo avaliar. | RN-16 |
| RN-02, RN-04, RN-09 (a), RN-14, RN-22 e RN-23 do E2.02 | Relatórios no escopo pelo retrato; quem edita e exclui; quem tem a lista; o que não é visível é inexistente; ninguém descobre a cadeia de quem não vê. | RN-01, RN-03, RN-07, RN-16 |
| RN-07, P-AUD-18 e P33 do E2.05 | A autoria ("Enviado por") aparece na consulta. O filtro de período usa "Período", "De" e "Até". | RN-09, RN-16 |
| RN-02, RN-08, RN-11, P-HIE-13 e "Definições" do E2.06 | O G12 do relatório é o G12 atual do líder registrado, com "Pastores" e "—". Acompanha a árvore na hora. | RN-06, RN-15 |
| RN-02 a RN-06, RN-12, RN-14, RN-17 e Impactos ("E2.10 e E2.12") do E2.07 | Os mesmos padrões de filtro de Membros: combinação, escopo, pessoa por seletor, pessoa indisponível, datas de Brasília, URL e equivalentes dos cards. | RN-02 a RN-07, RN-09, RN-12, RN-18 |
| RN-07 e RN-09 do E2.08 | Os tipos de célula e o endereço da célula, que não é dado sensível. | RN-11, RN-15 |
| Termos do E2.09 | Semana de domingo a sábado e "agora" segundo o servidor, em Brasília. | RN-09, RN-10 |
| RN-17 a RN-19, P-LCE-03, P-LCE-16, P-LCE-17, P-LCE-26, P-LCE-31, P-LCE-32 e Impactos (E2.12) do E2.10 | O filtro Célula e o chip; a decisão sobre os nomes dos participantes ficou para cá; G12 por pessoa; nível nas opções do Líder; "Não informada" para oferta sem valor; o título de Relatórios não muda com a Célula. | RN-06, RN-08, RN-15, RN-16, RN-17 |
| REL-09 e 5.5 do `docs/migracao.md` | O relatório guarda o retrato, e a carga traz o do legado. | Termos, RN-04, RN-05, RN-11 |
| RN-09, RN-11, RN-13, RN-14, RN-21, P-REL-06, P-REL-18, P-REL-19 e P-REL-20 do E2.11 | Todo relatório tem o retrato, e não há transição. A lista mostra e busca o líder registrado, com o G12 atual dele. A pessoa vê os relatórios em que está registrada. Os relatórios novos de "Não houve célula" não têm participantes, tema, visitantes nem oferta, e os do legado ficam como vieram. Os relatórios novos de célula realizada sempre têm oferta. "Reunião" no lugar de "Encontro". | Termos, RN-03, RN-04, RN-14, RN-15, RN-16, RN-17, Textos de tela |

#### Padrões definidos por este spec (revisar no PR)
As fontes não respondem estes pontos. O PO adotou a opção mais conservadora e coerente com o legado e com os specs anteriores. Nas regras, eles aparecem como "definida pelo spec", e o usuário pode mudar qualquer um na revisão do PR.

- **P-LRE-01, quais filtros** (RN-01).
  - Líder, G12 e Período vêm da tela do legado. A Célula vem do E2.10.
  - Tipo e Reunião vêm da consulta do servidor do legado, que a tela não mostrava. Entram porque o retrato guarda o tipo e porque a Reunião é o equivalente do gráfico da semana do Dashboard (RN-18).
  - Timóteo, anfitrião, tema e data exata não viram filtro. A busca já encontra pelo tema, e a data exata é o Período com o mesmo dia nos dois campos.
- **P-LRE-02, múltipla escolha** (RN-02). Líder, G12 e Tipo aceitam várias opções. A Reunião é de escolha única, com "Todas" como padrão. A Célula é uma só. No legado, todos eram de escolha única.
- **P-LRE-03, Líder e G12 por seletor** (RN-05, RN-06).
  - A pessoa é escolhida num seletor, e não digitada, como no E2.07 e no E2.10.
  - As opções vêm dos relatórios visíveis, como no E2.10 (P-LCE-02), com até 10 pessoas.
  - O Líder mostra o nível ("André (144)"), como no E2.10 (P-LCE-26). O G12 mostra só o nome.
- **P-LRE-04, G12 por pessoa** (RN-06). Segue o E2.10 (P-LCE-03): um nome só, nunca o casal. Os relatórios do próprio G12 entram, e os de pastor e de quem está sem liderança nunca entram.
- **P-LRE-05, pessoa indisponível** (RN-07). Segue o E2.10 (RN-06 de lá). Aparece pelo nome quem quem consulta vê, ou quem já é nome de referência num relatório visível.
- **P-LRE-06, Célula só por link** (RN-08). A Célula não tem seletor no painel. Chega pelo "Ver todos os relatórios" do detalhe da célula (E2.10) ou pela consulta (RN-16), e fica no painel e nos chips como os outros filtros (ver Q-5).
- **P-LRE-07, período pela data da reunião** (RN-09). Os dois dias entram, em datas de Brasília. Datas futuras são aceitas, porque "Esta semana" vai até o sábado. Os rótulos e as mensagens são os do P33 do E2.05 ("Período", "De" e "Até"), porque os rótulos são os mesmos da Auditoria.
- **P-LRE-08, atalhos na própria tela** (RN-10).
  - Os atalhos ficam na tela de Relatórios, à vista, fora do painel de filtros, e não no menu.
  - Motivos:
    - o menu do novo não tem subitens;
    - na tela, os atalhos servem a todos que têm a lista, e não só a quem era administrador no legado;
    - o caminho tem o mesmo número de toques do legado: abrir o menu, tocar em Relatórios e tocar no atalho.
  - Ver Q-2.
- **P-LRE-09, atalho é um período** (RN-10).
  - O atalho preenche o Período com o domingo e o sábado da semana, como o legado fazia, e mantém os outros filtros.
  - Na URL, ficam as duas datas, sem parâmetro próprio. Um link mostra sempre a mesma semana (ver Q-3).
  - O atalho aparece marcado quando o Período é exatamente aquela semana.
- **P-LRE-10, sem período ao abrir** (RN-01). A lista abre sem filtro, como hoje (ver Q-4).
- **P-LRE-11, Tipo pelo retrato** (RN-11). Vale o tipo registrado no relatório, como a consulta do legado (`CellType` do relatório).
- **P-LRE-12, URL, contagem e chips** (RN-12). As mesmas regras de Membros e de Células (P-FIL-12, P-FIL-18 a P-FIL-20 do E2.07; P-LCE-09 do E2.10), com até 6 filtros.
- **P-LRE-13, ordem** (RN-13). Continua a do E1.08, que é a do legado: da data mais recente para a mais antiga.
- **P-LRE-14, busca pelo líder mostrado** (RN-14). A busca passa a procurar no nome do líder registrado, que é o nome que a linha mostra, e no tema.
- **P-LRE-15, o que a linha mostra** (RN-15).
  - O líder registrado e o G12, como no legado.
  - "Célula realizada" ou "Não houve célula", os mesmos termos do E2.09 e do E2.10.
  - Participantes e visitantes separados, e a oferta, como no legado. "Presenças" sai.
  - As observações ficam na consulta, que agora existe em toda linha.
- **P-LRE-16, consulta em toda linha** (RN-16). É a alternativa maior da PO-UX-3 do E2.01: o painel "Ver relatório" para todo relatório visível e para todos que o veem, com a autoria (RN-07 do E2.05).
- **P-LRE-17, participantes pelo nome para todos** (RN-17). Os nomes já são nomes de referência liberados a quem vê o relatório (RN-06 e D-4 do E1.08). A consulta não expõe nenhum dado novo (ver Q-1).
- **P-LRE-18, relatório não encontrado** (RN-16). O link da consulta para um relatório invisível, excluído ou inexistente mostra "Relatório não encontrado.", como o detalhe da célula do E2.10. No E2.01, esse link era ignorado em silêncio.
- **P-LRE-19, equivalentes do Dashboard** (RN-18). Cada número de relatórios do Dashboard tem um equivalente na lista, como na RN-17 do E2.07 e na RN-21 do E2.10.
- **P-LRE-20, tempo e momento de aplicar** (RN-02). Até 2 s para a primeira página e o total. O filtro vale no mesmo momento que em Membros (P-FIL-21 do E2.07). O atalho e o chip valem na hora.
- **P-LRE-21, líder registrado excluído** (RN-05, RN-06).
  - Os relatórios dele continuam na lista, com o nome dele.
  - Ele não é opção no seletor (RN-08 do E2.01) e, vindo de um link, é "Pessoa indisponível".
  - O G12 desses relatórios é o que ele tinha na exclusão, porque, como o nível (P-HIE-13 do E2.06), não acompanha a árvore enquanto ele está excluído.
- **P-LRE-22, as pessoas registradas na consulta** (RN-16). A consulta mostra o líder, o timóteo e o anfitrião do retrato, e não os atuais. A célula é identificada pelos dados atuais, como no chip do E2.10.
- **Vindos do desenho de UX (2026-11-24, PO-UX-1 a PO-UX-12 em "Experiência (UX)"):**
  - **P-LRE-23, a reunião primeiro na consulta** (PO-UX-1, RN-16). A consulta mostra primeiro a reunião (data e horário, tema ou motivo, participantes, visitantes, oferta e observações), depois as pessoas da célula com o tipo e, por último, o endereço com os links. A história da consulta é ver quem participou e quem visitou.
  - **P-LRE-24, a dica das pessoas da célula** (PO-UX-2, RN-16). "Líder, timóteo, anfitrião e tipo como estavam no envio. O G12 é o de hoje.", porque o G12 não é do retrato (RN-06). Ela aparece sempre, porque todo relatório tem o retrato (RN-21 do E2.11). Vale o mesmo para a dica do Tipo no filtro. Nos relatórios do legado sem tipo, o tipo é o da célula na carga (P-REL-18 do E2.11), e o relatório de carga diz quantos foram tratados assim.
  - **P-LRE-25, comportamento dos atalhos** (PO-UX-3, RN-10).
    - Os atalhos ficam numa linha própria, logo depois de "Filtros", em todas as larguras.
    - Tocar de novo no atalho marcado não o desmarca. O Período sai pelo chip ou por "Limpar filtros". No 3G, quem toca de novo porque a lista demorou não perde o filtro sem perceber.
    - Sem a data de hoje do servidor, os atalhos ficam desabilitados. O relógio do aparelho nunca serve de reserva.
  - **P-LRE-26, Reunião uma opção por linha** (PO-UX-4). No painel do celular, as três opções ficam uma por linha, porque não cabem lado a lado em 360 px. Só a apresentação muda.
  - **P-LRE-27, a Célula em primeiro** (PO-UX-5, RN-08, RN-12).
    - A Célula é o primeiro filtro do painel e o primeiro chip: ela diz de onde a lista veio.
    - No painel do celular, tirá-la vale em "Aplicar filtros", como as outras mudanças do painel, e fechar sem aplicar a mantém.
    - Depois de tirada, ela só volta por um link, porque o painel não tem seletor de célula (P-LRE-06).
  - **P-LRE-28, onde ficam as ações da consulta** (PO-UX-6, RN-16). "Ver célula" e "Ver todos os relatórios desta célula" ficam junto do endereço da célula. "Editar relatório" e "Excluir relatório" ficam no rodapé. Quem não edita nem exclui não tem rodapé.
  - **P-LRE-29, editar por cima da consulta** (PO-UX-7, RN-16 e). "Editar relatório" abre o formulário por cima da consulta. Salvar volta para a consulta com os valores novos, e cancelar volta para a consulta como estava. Se o `architect` não puder empilhar os dois (AQ-9), vale a alternativa da UX: fechar a consulta, abrir o formulário e reabrir a consulta depois de salvar. O resultado para a pessoa é o mesmo.
  - **P-LRE-30, tema e motivo com até 3 linhas na lista** (PO-UX-8, RN-15). O texto inteiro fica na consulta, a um toque.
  - **P-LRE-31, título "Relatórios" e "Novo relatório"** (PO-UX-9). O título é o nome do menu, como em Membros e em Células, e não muda com os filtros (P-LCE-32 do E2.10). O botão segue o E2.02 e o E2.11.
  - **P-LRE-32, o dia abreviado na lista** (PO-UX-10, RN-15). A lista mostra "Qua, 18/11/2026 · 20:00", e o leitor de tela ouve o dia inteiro. A consulta mostra "Quarta, 18/11/2026 às 20:00". A sugestão de usar "Quarta" também na lista não foi adotada: na lista, a data funciona como um carimbo, e a forma curta economiza espaço na coluna da tabela.
  - **P-LRE-33, textos da UX** (PO-UX-11). Todos foram aceitos, sem ajuste. Os que estão ligados a uma regra foram copiados para os "Textos de tela". Os da T16 só valem se a pergunta correspondente for respondida com a alternativa.
  - **P-LRE-34, "Não houve célula" do legado com dados** (PO-UX-12, RN-15, RN-16).
    - A linha e a consulta de um relatório de "Não houve célula" mostram só o motivo e as observações, mesmo quando ele veio do legado com tema, oferta, visitantes ou participantes (RN-21 do E2.11).
    - Esses dados continuam gravados e não somem. Eles não aparecem em nenhuma tela de Relatórios, como no detalhe da célula (RN-17 do E2.10) e no vínculo celular (P-FIL-08 do E2.07).
    - O saneamento (E4.04) lista esses relatórios, para a liderança corrigir no legado antes da carga, se quiser (E4.05).

### Regras de negócio
Nenhuma regra está "a confirmar".

Correspondência com o plano:
- REL-13 → RN-01 a RN-15;
- consulta deixada pelo E2.01 (P-DEL-19) e pelo E2.10 (RN-18) → RN-16 e RN-17;
- preparação da DSH-05 → RN-18.

| ID | Regra | Origem |
|---|---|---|
| RN-01 | **Filtros da lista de Relatórios.** Além da busca (RN-14), a lista tem:<br>- os atalhos **Esta semana**, **Semana passada** e **Semana retrasada** (RN-10);<br>- os filtros Líder (RN-05), G12 (RN-06), Período (RN-09), Tipo e Reunião (RN-11);<br>- o filtro Célula, quando vem de um link (RN-08).<br><br>Os filtros e os atalhos estão disponíveis para quem tem a lista de Relatórios (RN-22 do E2.02), sem permissão nova. A lista abre sem nenhum filtro. Com todos os filtros vazios, ela mostra os mesmos relatórios e o mesmo total de hoje. | REL-13; legado (`UI/pages/Report/index.js:191-217`: Líder de Célula, G12, Desde e Até; `UI/components/NavMenu/index.js:79-81`: atalhos; `Domain/Querying/Filters/ReportFilter.cs:8-18`: tipo, célula e "não houve célula" na consulta do servidor); RN-19 do E2.10 (Célula); RN-22 do E2.02; escolha dos filtros: definida pelo spec (P-LRE-01); sem período ao abrir: definida pelo spec (P-LRE-10) |
| RN-02 | **Combinação.**<br>- Entre filtros diferentes, e com a busca, **todos** precisam valer (E).<br>- Num filtro de múltipla escolha (Líder, G12 e Tipo), basta valer **uma** das opções escolhidas (OU).<br>- A Reunião é de escolha única: Todas (padrão), Célula realizada ou Não houve célula. A Célula é uma só.<br>- O total, a paginação e a ordem valem para o resultado filtrado, como no E1.08: total exato, nada cortado e nenhum relatório repetido ou pulado entre as páginas.<br>- **Quando o filtro vale:** no celular e no tablet, as mudanças feitas no painel valem ao tocar em "Aplicar filtros", e fechar o painel sem aplicar não muda a lista. No computador, cada mudança vale na hora (as datas, depois de conferidas). Os atalhos e o "✕" de um chip valem na hora, em qualquer tamanho de tela. Toda mudança aplicada volta a lista para a página 1.<br>- No volume de referência (20 mil membros, 1.500 células e 100 mil relatórios), qualquer combinação mostra a primeira página e o total em até 2 s depois de aplicada. | legado (`Domain/Extensions/QueryingExtensions.cs:366-402`: cada filtro preenchido restringe a consulta); RN-01 a RN-03 do E1.08; RN-02 do E2.07; RN-02 do E2.10; múltipla escolha: definida pelo spec (P-LRE-02); momento e tempo: definida pelo spec (P-LRE-20) |
| RN-03 | **Filtro só restringe.**<br>- O resultado é sempre a interseção entre os relatórios visíveis para quem consulta (RN-04 do E2.02, com a RN-14 b do E2.11) e os filtros.<br>- Nenhum filtro, nenhuma combinação e nenhum valor vindo da URL ou da API mostra um relatório que a pessoa não vê, nem um relatório excluído (RN-08 do E2.01). Vale igual pela tela e pela API.<br>- Os relatórios de uma célula excluída continuam na lista e nos filtros, com o selo "Célula excluída" (RN-11 do E2.01).<br>- Nenhum filtro usa dado sensível de membro (RN-11 do E1.08). O endereço da célula não é sensível (RN-09 do E2.08). | AUT-03; RN-02 e RN-04 do E2.02; RN-08 e RN-11 do E2.01; legado (`Infra/Repositories/ReportRepository.cs:68-75`: só relatórios não excluídos, filtro de ministério e depois os filtros da tela) |
| RN-04 | **O retrato vale para os filtros e para a linha.**<br>- O Líder (RN-05), o G12 (RN-06), o Tipo (RN-11), a busca (RN-14), a linha (RN-15) e a consulta (RN-16) usam o retrato do relatório: o líder, o timóteo, o anfitrião e o tipo registrados no envio (REL-09).<br>- Trocar as pessoas ou o tipo de uma célula não muda os relatórios já enviados: eles continuam com o retrato e passam a ser encontrados pelos valores novos só nos relatórios seguintes.<br>- O endereço da célula na linha e a identificação da célula na Célula (RN-08) são os atuais, porque o retrato não guarda o endereço.<br>- **Todo relatório tem o retrato** (RN-14 e RN-21 do E2.11). Nenhuma regra deste passo usa os dados atuais da célula no lugar do retrato:<br>  - o relatório novo grava o retrato no envio;<br>  - o do legado traz o retrato do legado, com o tipo da célula na carga quando o legado não tem o tipo;<br>  - o que já existia no novo recebe as pessoas e o tipo da célula na publicação do E2.11. | REL-09; RN-04 do E2.02; RN-14, RN-21, P-REL-18 e P-REL-19 do E2.11; "Definições" do E2.06; legado (`Domain/Model/Report.cs:22-34`: `LeadershipId`, `HostId`, `TimothyId` e `CellType` gravados no relatório; `QueryingExtensions.cs:383-393`: os filtros usam esses valores; `UI/pages/Report/index.js:49`: a linha mostra o líder registrado); 5.5 do `docs/migracao.md` |
| RN-05 | **Líder.**<br>- Quem consulta escolhe de 1 a 10 pessoas num seletor com busca.<br>- As opções são as pessoas que são o líder registrado de pelo menos um relatório visível para quem consulta, ativas ou inativas, inclusive as que ela não vê como membro (nomes de referência). Pessoas excluídas não são opção (RN-08 do E2.01).<br>- Cada opção mostra o nome com o nível de hoje ("André (144)", "Samuel (Pastor)", "Ester (Sem liderança)"). A busca sem resultado diz "Nenhum líder encontrado.".<br>- O resultado são os relatórios cujo líder registrado é uma das pessoas escolhidas.<br>- Ser timóteo ou anfitrião no relatório não conta.<br>- O filtro não é "em qualquer nível": os relatórios das células dos discípulos da pessoa não entram (ver Q-6).<br>- Uma 11ª pessoa não é aceita: "Escolha até 10 pessoas.". Quando um link ou a API traz mais de 10, valem as 10 primeiras, na ordem em que vieram. As outras saem, também da URL, e a tela mostra "Escolha até 10 pessoas.".<br>- **Líder registrado excluído:** os relatórios dele continuam na lista, com o nome dele, e são encontrados pela busca, pela Célula e pelo G12. Ele não é opção, e um link com o id dele segue a RN-07. | REL-13 ("líder"); legado (`UI/pages/Report/index.js:192-195`; `QueryingExtensions.cs:386-387`: o líder registrado no relatório); RN-04 do E2.10; seletor, opções e limite: definida pelo spec (P-LRE-03), como no E2.07 (P-FIL-02, P-FIL-17) e no E2.10 (P-LCE-02, P-LCE-26); excluído: RN-08 e RN-09 (c) do E2.01, definida pelo spec (P-LRE-21) |
| RN-06 | **G12.**<br>- O G12 de um relatório é o G12 atual do líder registrado (Termos). Quando o líder registrado é G12, é ele mesmo. O relatório de pastor ("Pastores") e o de quem está sem liderança ("—") não têm G12.<br>- Quem consulta escolhe de 1 a 10 pessoas num seletor com busca.<br>- As opções são as pessoas que são o G12 de pelo menos um relatório visível para quem consulta, inclusive as que ela não vê como membro. Cada opção mostra só o nome. Pessoas excluídas não são opção. A busca sem resultado diz "Nenhum G12 encontrado.".<br>- O resultado são os relatórios cujo G12 é uma das pessoas escolhidas, inclusive aqueles em que ela própria é a líder registrada.<br>- O G12 é por pessoa, nunca o casal: escolher Pedro não traz os relatórios cujo G12 é Paula. Para o ministério do casal, escolhem-se os dois.<br>- Os relatórios de pastor e de quem está sem liderança nunca entram neste filtro. Para encontrá-los, usa-se o Líder.<br>- O G12 acompanha a árvore na hora (RN-08 do E2.06): quando o líder registrado muda de ramo, todos os relatórios dele, inclusive os antigos, passam para o G12 novo.<br>- Quando o líder registrado foi excluído, vale o G12 que ele tinha na exclusão.<br>- O limite é de 10 pessoas, como na RN-05, com as mesmas mensagens.<br>- O G12 do relatório é nome de referência, como o G12 da célula (RN-11 do E2.06). | REL-13 ("G12"); legado (`UI/pages/Report/index.js:50` e `:197-200`: o G12 do líder registrado); "Definições" do E2.06 ("o G12 atual do líder registrado no relatório"); RN-08, RN-11 e P-HIE-13 do E2.06; RN-05 do E2.10; por pessoa e relatórios do próprio G12: definida pelo spec (P-LRE-04), como no E2.10 (P-LCE-03); excluído: definida pelo spec (P-LRE-21) |
| RN-07 | **Pessoa indisponível (Líder e G12).** Vale quando a URL ou a API traz, no Líder ou no G12, um id com formato válido.<br>- **Com nome:** quando quem consulta vê essa pessoa como membro, ou quando ela é o líder registrado (no Líder) ou o G12 (no G12) de algum relatório visível, o filtro mostra o nome dela. O resultado pode ser vazio, por exemplo para quem nunca foi líder registrado.<br>- **Sem nome:** nos outros casos (a pessoa não é visível e não aparece em nenhum relatório visível, foi excluída ou não existe), a escolha aparece como "Pessoa indisponível", sem o nome e sem o id, com a dica "Esta pessoa não está disponível para você.". Ela não traz nenhum relatório. Se houver outras pessoas escolhidas, valem só as outras. As três situações têm a mesma resposta, e a resposta do servidor também não traz o nome.<br>- Nos dois casos, a escolha fica na URL, conta como filtro ativo e pode ser tirada pelo chip.<br><br>Um id que nem tem o formato de id é valor inválido (RN-12).<br><br>Os filtros não revelam o G12, o líder nem a cadeia de liderança de quem quem consulta não vê, além dos nomes de referência que a lista já mostra. | RN-09 (a) e RN-23 do E2.02; RN-06 do E1.08; como no E2.07 (RN-05, P-FIL-03, P-FIL-18) e no E2.10 (RN-06); nome pelo relatório visível: definida pelo spec (P-LRE-05) |
| RN-08 | **Célula.** O filtro criado pelo E2.10 (RN-19 de lá) passa a ser um filtro da lista como os outros:<br>- É uma célula só. Ela chega por link: o "Ver todos os relatórios" do detalhe da célula (E2.10) ou o "Ver todos os relatórios desta célula" da consulta (RN-16). Os dois abrem a lista só com a Célula, sem outro filtro, sem período e sem busca, na página 1. O painel não tem seletor de célula (ver Q-5).<br>- O resultado são os relatórios não excluídos e visíveis da célula, qualquer que seja o retrato deles.<br>- Combina com os outros filtros e com os atalhos (E): por exemplo, Célula e "Semana passada".<br>- Aparece no painel e acima da lista como o chip "Célula de {Líder} · {Dia} · {horário}", com os dados atuais da célula. É o primeiro filtro do painel e o primeiro chip. Conta como filtro ativo e sai pelo chip ou por "Limpar filtros". O título da tela não muda (P-LCE-32 do E2.10).<br>- No painel do celular e do tablet, tirá-la vale em "Aplicar filtros", como as outras mudanças do painel, e fechar o painel sem aplicar a mantém. O chip acima da lista vale na hora (RN-02).<br>- Depois de tirada, a Célula só volta por um link.<br>- O chip identifica a célula quando quem consulta vê a célula ou pelo menos um relatório não excluído dela, inclusive a célula excluída. Nos outros casos (a pessoa não vê a célula nem nenhum relatório dela, ou a célula não existe), o chip mostra "Célula indisponível", sem identificação e com a dica "Esta célula não está disponível para você.", e a lista fica vazia.<br>- Um id sem formato de id é valor inválido (RN-12). | CEL-07; legado (`UI/AppRoutes.js:43-44`: `/cells/:cellId/reports`; `UI/pages/Report/index.js:164-168`: só a célula, sem período; `QueryingExtensions.cs:395-396`); RN-19, P-LCE-16, P-LCE-17 e P-LCE-32 do E2.10; integração ao painel: Impactos do E2.10 (E2.12); só por link: definida pelo spec (P-LRE-06); primeiro lugar e o "✕" no painel: definida pelo spec (P-LRE-27, PO-UX-5) |
| RN-09 | **Período.** "De" e "Até", com as datas exibidas como dd/mm/aaaa, pela data do relatório (Termos):<br>- as datas são de Brasília, e os dois dias informados entram no resultado: "Até" 21/11 traz também o relatório de 21/11 às 23:30;<br>- cada campo pode ser usado sozinho: só "De" traz desse dia em diante; só "Até" traz até esse dia;<br>- datas futuras são aceitas: "Até" o sábado da semana atual vale em qualquer dia da semana;<br>- o relatório de "Não houve célula" entra pela data prevista da reunião naquela semana (REL-06);<br>- com uma data inválida, ou com "Até" antes de "De", o Período não é aplicado, e a tela mostra a mensagem embaixo do campo: "Data inválida. Use o formato dd/mm/aaaa." ou "O fim do período precisa ser igual ou posterior ao início.". A conferência é feita ao sair do campo e ao aplicar, nunca durante a digitação;<br>- as duas datas contam como um filtro. | REL-13 ("período"); legado (`UI/pages/Report/index.js:204-216`: Desde e Até; `QueryingExtensions.cs:377-381`: pela data do relatório); P33 do E2.05 (rótulos e mensagem); RN-12 do E2.07 (dias inclusive, conferência); datas futuras e dias inclusive: definida pelo spec (P-LRE-07) |
| RN-10 | **Atalhos de semana.** A tela de Relatórios tem três atalhos, à vista, fora do painel de filtros: **Esta semana**, **Semana passada** e **Semana retrasada**.<br>- Cada atalho preenche o Período com o domingo ("De") e o sábado ("Até") da semana correspondente, conforme a data de hoje em Brasília segundo o servidor. O fuso e o relógio do aparelho não contam.<br>- O atalho substitui o Período que estava aplicado e mantém os outros filtros e a busca. Vale na hora e volta a lista para a página 1.<br>- Tocar de novo no atalho marcado não muda nada: ele continua marcado, e o Período continua aplicado. O Período sai pelo chip ou por "Limpar filtros".<br>- Enquanto a data de hoje do servidor não chega, ou se a leitura dela falha, os atalhos ficam visíveis e desabilitados, sem nenhum marcado. A lista funciona normalmente. O relógio do aparelho nunca serve de reserva.<br>- O atalho não tem parâmetro próprio na URL: o endereço guarda as duas datas, como qualquer Período. Recarregar ou abrir o link mostra sempre aquela semana, mesmo depois que ela passou.<br>- O atalho aparece marcado quando o Período aplicado é exatamente o domingo e o sábado daquela semana, venha ele do atalho, das datas digitadas ou de um link. Com qualquer outro Período, ou sem Período, nenhum atalho fica marcado. A marcação segue a data de hoje: um link com as datas da semana anterior aparece com "Semana passada" marcada.<br>- **Virada da semana:** no domingo, às 00:00 de Brasília, "Esta semana" passa a ser a semana que começa nesse domingo, e as outras andam junto.<br>- Os atalhos não ficam no menu. O item Relatórios do menu continua abrindo a lista sem filtros (ver Q-2). | REL-13 ("atalhos para esta semana, a passada e a retrasada"); legado (`UI/components/NavMenu/index.js:30-41` e `:79-81`: o domingo e o sábado de cada semana preenchem "Desde" e "Até"); Termos do E2.09 (semana e "agora" do servidor); na tela: definida pelo spec (P-LRE-08); datas na URL, outros filtros mantidos e marcação: definida pelo spec (P-LRE-09); toque repetido e sem a data do servidor: definida pelo spec (P-LRE-25, PO-UX-3) |
| RN-11 | **Tipo e Reunião.**<br>- **Tipo:** Evangelística, Discipulado e Macrocélula (RN-07 do E2.08), com múltipla escolha, pelo tipo registrado no relatório (RN-04). Mudar o tipo da célula não muda os relatórios já enviados.<br>- **Reunião:** Todas (padrão), Célula realizada ou Não houve célula, pelo que o relatório registra. "Todas" não conta como filtro e não vira chip. | legado (`ReportFilter.cs:12` e `:18`; `QueryingExtensions.cs:383-384` e `:398-399`: tipo registrado e "não houve célula"; `App/Services/DashboardService.cs:132-152`: o gráfico da semana usa "não houve célula"); RN-07 do E2.08; filtros na tela: definida pelo spec (P-LRE-01); tipo pelo retrato: definida pelo spec (P-LRE-11) |
| RN-12 | **Filtros no endereço da página.** As mesmas regras da RN-14 do E2.07 e da RN-12 do E2.10:<br>- os filtros ficam na URL, junto com a busca, a página e o tamanho da página. Recarregar, voltar no navegador ou abrir o link restaura a lista filtrada;<br>- outra pessoa que abre o mesmo link vê os mesmos filtros aplicados ao que **ela** vê (RN-03). Uma pessoa ou uma célula que ela não pode ver aparece como indisponível (RN-07, RN-08);<br>- um valor desconhecido ou inválido na URL (opção que não existe, data que não existe, id sem formato de id) é ignorado: sai da URL, aquele filtro não é aplicado e não aparece como ativo;<br>- "Limpar filtros" esvazia todos os filtros, inclusive a Célula, e a busca, volta para a página 1 e mantém o tamanho da página. O link aparece sempre que há pelo menos um filtro ativo ou texto na busca;<br>- **filtros ativos:** a tela mostra quantos filtros estão em uso, de 1 a 6. O Líder e o G12 contam 1 cada, com qualquer número de pessoas, inclusive a "Pessoa indisponível". O Período conta 1, com uma ou com as duas datas. "Reunião: Todas", a busca e os valores inválidos não contam. Cada valor escolhido aparece como um chip, que tira só aquele valor. O painel e os chips seguem esta ordem: Célula, Líder, G12, Período, Tipo e Reunião. | RN-01 do E1.08 (estado na URL) e Pontos de extensão do E1.08 (o clique do Dashboard abre a lista pela URL); legado ("Limpar filtros": `UI/pages/Report/index.js:187-189`); definida pelo spec (P-LRE-12), como no E2.07 (P-FIL-12, P-FIL-18 a P-FIL-20) e no E2.10 (P-LCE-09); ordem do painel e dos chips: definida pelo spec (P-LRE-27, PO-UX-5) |
| RN-13 | **Ordem.** Continua a da RN-03 do E1.08: da data do relatório mais recente para a mais antiga e, na mesma data, do horário mais tarde para o mais cedo, com desempate estável, para que a paginação não repita nem pule nenhum relatório. Os filtros e os atalhos não mudam a ordem. | RN-03 do E1.08; legado (`UI/pages/Report/index.js:31`: por data, da mais recente; `Domain/Extensions/QueryingExtensions.cs:32-49`); definida pelo spec (P-LRE-13) |
| RN-14 | **Busca.** Continua a da RN-04 do E1.08 (sem acento, cada palavra em qualquer campo, até 100 caracteres e 5 palavras), nos campos:<br>- o nome do **líder registrado**, que é o nome que a linha mostra (RN-15);<br>- o tema.<br><br>Nos relatórios que já existiam no novo, o líder registrado é o líder da célula na publicação do E2.11 (RN-04), e a busca encontra o mesmo que antes. | RN-04 do E1.08; RN-14 d do E2.11 ("a busca por nome usa o líder registrado"); líder registrado: definida pelo spec (P-LRE-14) |
| RN-15 | **O que cada linha mostra.**<br>- O líder registrado e, embaixo, o G12 do relatório ("G12: Pedro", "G12: Pastores" ou "G12: —"). São nomes de referência: aparecem mesmo para quem não vê essas pessoas, só o nome, sem acesso ao cadastro. O nome de um líder registrado excluído continua aparecendo (RN-09 c do E2.01).<br>- O endereço atual da célula (rua, número e bairro), ou "Sem endereço". O relatório de célula excluída tem o selo "Célula excluída" (RN-11 do E2.01).<br>- A data do relatório, com o dia da semana abreviado ("Qua, 18/11/2026"), e o horário. O leitor de tela ouve o dia inteiro.<br>- "Célula realizada", com o tema, ou "Não houve célula", com o motivo. O tema e o motivo mostram até 3 linhas; o texto inteiro fica na consulta.<br>- Na célula realizada: o número de participantes, o número de visitantes e a oferta em reais. A oferta de zero registrada aparece como "R$ 0,00". Sem valor de oferta registrado, aparece "Não informada" (P-LCE-31 do E2.10). Os relatórios de célula realizada enviados a partir do E2.11 sempre têm oferta (RN-13 de lá).<br><br>Detalhes:<br>- O número de participantes conta os membros do relatório, uma vez cada, inclusive os excluídos (RN-13 do E2.01) e os automáticos: o líder, o timóteo e o anfitrião incluídos no envio (RN-11 do E2.11). O de visitantes conta os nomes gravados (REL-08).<br>- Na linha de "Não houve célula" não aparecem números, oferta nem tema, mesmo que o relatório tenha vindo do legado com esses dados (RN-21 do E2.11). Eles continuam gravados.<br>- A soma "presenças" e os selos "Realizada" e "Não Realizada" deixam de aparecer.<br>- As observações, os nomes e a autoria ficam na consulta (RN-16).<br>- Cada linha dá acesso à consulta. As ações "Editar" e "Excluir" continuam na linha, com as regras de hoje (RN-14 do E2.02; RN-11 do E2.01). | legado (`UI/pages/Report/index.js:39-105`: líder registrado e G12, endereço, data e horário, tema ou "Não houve célula.", oferta, participantes e visitantes); RN-06 do E1.08; RN-09, RN-11 e RN-13 do E2.01; RN-11 do E2.06; REL-07; REL-08; RN-11, RN-13 e RN-21 do E2.11; P-LCE-31 do E2.10; termos, números separados e observações na consulta: definida pelo spec (P-LRE-15); até 3 linhas: definida pelo spec (P-LRE-30, PO-UX-8); dia abreviado: definida pelo spec (P-LRE-32, PO-UX-10); "Não houve célula" do legado: definida pelo spec (P-LRE-34, PO-UX-12) |
| RN-16 | **Consulta "Ver relatório".**<br>(a) **Acesso.** Toda linha da lista abre a consulta, para todos que veem o relatório (RN-04 do E2.02), com qualquer permissão. Ela substitui a consulta que o E2.01 limitou ao relatório de célula excluída e a quem edita relatórios (P-DEL-19).<br>(b) **O que mostra**, nesta ordem:<br>1. **No topo:** a célula, com os dados atuais ("Célula de {Líder} · {Dia} · {horário}", como o chip da RN-08); "Célula realizada" ou "Não houve célula"; e a autoria: "Enviado por {Nome} em {data} às {hora}" e, quando houve alteração, "Alterado por …" (RN-07 do E2.05).<br>2. **Reunião:**<br>  - a data e o horário do relatório, com o dia da semana por extenso. Em "Não houve célula", com o rótulo "Reunião prevista";<br>  - na célula realizada: o tema, os participantes pelo nome e o número deles, os visitantes pelos nomes e o número deles, e a oferta (como na RN-15);<br>  - em "Não houve célula": só o motivo. O tema, os participantes, os visitantes e a oferta não aparecem, mesmo que o relatório tenha vindo do legado com esses dados (RN-21 do E2.11). Eles continuam gravados;<br>  - as observações, quando houver.<br>3. **Pessoas da célula,** como registradas no relatório (RN-04): o líder, o timóteo, o anfitrião e o tipo registrados, e o G12 do relatório (RN-06). São nomes de referência. A dica diz o que é do envio e o que é de hoje: "Líder, timóteo, anfitrião e tipo como estavam no envio. O G12 é o de hoje.".<br>4. **Endereço da célula:** o endereço atual, com os links "Ver célula" e "Ver todos os relatórios desta célula" (item c).<br><br>(c) **Ações**, cada uma com as regras de hoje:<br>- "Editar relatório", com "Editar Relatórios de Células", só com a célula não excluída (RN-14 do E2.02; RN-11 do E2.01). Abre o mesmo formulário da linha;<br>- "Excluir relatório", com "Excluir Relatórios de Células" (E2.01);<br>- "Ver célula", que abre o detalhe da célula (E2.10), só quando quem consulta vê a célula (RN-14 do E2.10). Não aparece para a célula excluída;<br>- "Ver todos os relatórios desta célula", que abre a lista só com a Célula (RN-08), para todos que veem o relatório.<br><br>O relatório de célula excluída continua como no E2.01: selo, aviso e "Ver células excluídas" para administradores, sem "Editar relatório".<br><br>(d) **Link.** A consulta aberta fica no endereço da página. Recarregar ou abrir o link reabre a consulta, sobre a lista com os filtros que o link traz. O relatório que quem abre não vê, o excluído e o que não existe têm a mesma resposta: "Relatório não encontrado.", sem nenhum dado do relatório. Um id sem formato de id sai da URL e é ignorado.<br>(e) **Depois de gravar.** "Editar relatório" abre o formulário por cima da consulta. Depois de salvar, a lista e a consulta mostram os valores novos assim que a gravação é confirmada, e a pessoa volta para a consulta. Cancelar a edição devolve a consulta como estava. Depois da exclusão pela consulta, a consulta fecha. Se a pessoa deixa de ver o relatório com a consulta aberta, a consulta seguinte mostra "Relatório não encontrado." (RN-08 do E2.02).<br>(f) A consulta só lê. Abri-la não altera o relatório nem gera evento na Auditoria. | P-DEL-19, UXD-7 e PO-UX-3 do E2.01 (alternativa maior deixada para cá); RN-11 do E2.01; RN-04, RN-08 e RN-14 do E2.02; RN-07 e P-AUD-18 do E2.05; RN-14 e RN-19 do E2.10, e o Impactos de lá ("cada relatório da lista leva ao detalhe da célula", como o "Dados da célula" do legado, `UI/pages/Report/index.js:102`); REL-09; RN-09, RN-14 c e RN-21 do E2.11; "Reunião" e "Reunião prevista": P-REL-20 e Textos de tela do E2.11; consulta em toda linha: definida pelo spec (P-LRE-16); "Relatório não encontrado.": definida pelo spec (P-LRE-18); pessoas registradas: definida pelo spec (P-LRE-22); ordem, dica e lugar das ações: definida pelo spec (P-LRE-23, P-LRE-24 e P-LRE-28; PO-UX-1, PO-UX-2 e PO-UX-6); edição por cima: definida pelo spec (P-LRE-29, PO-UX-7); "Não houve célula" do legado: definida pelo spec (P-LRE-34, PO-UX-12) |
| RN-17 | **Participantes e visitantes pelo nome.**<br>- A consulta mostra todos os participantes pelo nome, em ordem alfabética, sem corte, e os visitantes pelos nomes registrados, para todos que veem o relatório. Vale também para quem não tem "Editar Relatórios de Células" e para quem não vê esses membros.<br>- Os participantes são nomes de referência (RN-06 e D-4 do E1.08): só o nome, sem acesso ao cadastro e sem nenhum outro dado. O participante excluído aparece pelo nome e conta no número (RN-13 do E2.01).<br>- Pela API, quem vê o relatório lê o nome de cada participante e nada mais do cadastro dele, como já acontece desde o E1.08. Quem não vê o relatório não lê os participantes.<br>- No relatório de "Não houve célula", a consulta não mostra participantes nem visitantes, nem os que vieram do legado (RN-16 b).<br>- O formulário de edição é o do E2.11. | RN-06 e D-4 do E1.08 ("os participantes do relatório" são nomes de referência); RN-13 do E2.01; RN-18 do E2.10 (decisão deixada para este passo); legado (nenhuma tela mostrava os nomes depois do envio: `UI/pages/Report/index.js:84-95`); definida pelo spec (P-LRE-17), ver Q-1 |
| RN-18 | **Cada número de relatórios do Dashboard tem um equivalente na lista.** Para cada número abaixo, a lista de Relatórios com os filtros indicados mostra o mesmo conjunto de relatórios que o Dashboard conta, para qualquer pessoa, no mesmo momento. Este passo garante os filtros e a igualdade; o clique é do E2.14 (DSH-05).<br><br>Equivalentes:<br>- **Relatórios enviados na semana:** "Esta semana". O total da lista é igual ao número do card;<br>- **Visitantes na semana:** "Esta semana". A soma dos visitantes dos relatórios da lista é igual ao número do card;<br>- **Gráfico da semana** (DSH-04): "Esta semana" com Reunião: Célula realizada, e "Esta semana" com Reunião: Não houve célula. O total de cada lista é igual à fatia correspondente. A fatia "sem relatório" é de células e fica com a lista de Células (RN-21 do E2.10).<br><br>Os relatórios de célula excluída entram nos dois lados (RN-11 do E2.01). Se o E2.14 mudar a definição de algum desses números, a linha correspondente muda junto, e a igualdade continua valendo. | DSH-02, DSH-04 e DSH-05; legado (`UI/pages/Home/index.js:30-32`: "Relatórios Enviados" abre a lista com a semana atual; `:118`: "Visitantes em Células" abre a lista; `App/Services/DashboardService.cs:39-49` e `:89-93`: o card usa o mesmo filtro da lista); definições atuais (`dashboard_summary`, PR 3 do E1.08); RN-11 do E2.01; definida pelo spec (P-LRE-19), como no E2.07 (RN-17) e no E2.10 (RN-21) |

### Critérios de aceite
Convenções:
- "Pela API" é qualquer leitura feita fora da tela, com a sessão da persona citada.
- "Hoje" é terça-feira, 24/11/2026, às 21:00 de Brasília, salvo quando o critério diz outra data. A semana atual vai de domingo, 22/11, a sábado, 28/11. A semana passada vai de 15/11 a 21/11, e a retrasada, de 08/11 a 14/11.
- Cada critério parte da massa original.
- Todo relatório tem o retrato (RN-04; RN-21 do E2.11).
- **Consolidado:** ainda não existe; ver Impactos.

#### Massa de exemplo
A árvore, as funções, as células e os relatórios são os da [massa do E2.10](e2-10-listagem-celulas.md#massa-de-exemplo), com o que está abaixo.

- **Árvore** (líder → discípulos):
  - Samuel e Magda, casados, pastores (D9).
  - Pedro, discípulo de Samuel, e Paula, discípula de Magda, casados (G12).
  - Tiago, discípulo de Samuel, e Tânia, discípula de Magda, casados (G12).
  - André, discípulo de Pedro, casado com Beatriz, discípula de Tânia.
  - Caio e Fábio (**inativo** desde 01/11/2026), discípulos de André. Gabriel, discípulo de Fábio. Jonas, discípulo de Gabriel.
  - Carla, discípula de Paula. Débora, discípula de Beatriz. Rita, discípula de Tânia.
  - Diego e Hugo, discípulos de Tiago.
  - Ester, sem liderança. Lúcia e Lia, discípulas de Ester.
  - Sara, discípula de Carla, **excluída** em 20/11/2026.
- **Funções:**
  - Rita: Administrador.
  - Samuel, Magda, Pedro, Paula, André e Diego: Líder.
  - Caio, Carla, Fábio, Beatriz, Ester e Jonas: Membro.
  - Hugo: sem função.
  - Lia: Secretaria, só com "Visualizar Relatórios de Toda a Igreja".
- **Células** (pessoas atuais; ver o E2.10):
  - C1: André / Caio / Carla, Evangelística, quarta, 20:00, Rua das Flores, 100, Centro. **Até 21/10/2026, C1 era liderada por Fábio e era do tipo Discipulado.** Desde 22/10, André lidera, e o tipo é Evangelística.
  - C3: Débora / Rita / Beatriz, Discipulado, terça, 19:30.
  - C5: Jonas / Gabriel / Fábio, Evangelística, sexta, 20:00, **excluída**.
  - C6: Paula / Carla / Paula, Discipulado, segunda, 20:00.
  - C7: Samuel / Tiago / Magda, Macrocélula, domingo, 18:00.
  - C8: Ester / Lúcia / Ester, Evangelística, sábado, 16:00.
  - C2 e C4 não têm relatórios.
- **Relatórios**, na ordem da lista (RN-13). Nenhum outro, salvo o que cada critério disser.

| Relatório | Célula | Data e horário | Reunião | Retrato: líder / timóteo / anfitrião · tipo | G12 hoje | Tema ou motivo | Participantes · visitantes · oferta |
|---|---|---|---|---|---|---|---|
| R9 | C6 | segunda, 23/11/2026, 20:00 | Célula realizada | Paula / Carla / Paula · Discipulado | Paula | "Amizade" | 7 · 3 · R$ 40,00 |
| R10 | C7 | domingo, 22/11/2026, 18:00 | Célula realizada | Samuel / Tiago / Magda · Macrocélula | Pastores | "Visão" | 40 · 5 · R$ 300,00 |
| R6 | C5 (excluída) | sexta, 20/11/2026, 20:00 | Célula realizada | Jonas / Gabriel / Fábio · Evangelística | Pedro | "Gratidão" | 6 · 1 · R$ 30,00 |
| R1 | C1 | quarta, 18/11/2026, 20:00 | Célula realizada | André / Caio / Carla · Evangelística | Pedro | "A fé que vence" | 8 · 2 · R$ 50,00 |
| R2 | C1 | quarta, 11/11/2026, 20:00 | Não houve célula | André / Caio / Carla · Evangelística | Pedro | motivo "Chuva forte no bairro" | — |
| R8 | C3 | terça, 10/11/2026, 19:30 | Célula realizada | Débora / Rita / Beatriz · Discipulado | Tânia | "Família" | 5 · 0 · R$ 25,00 |
| R4 | C1 | quarta, 28/10/2026, 20:00 | Célula realizada | André / Caio / Carla · Evangelística | Pedro | "Perdão" | 6 · 0 · R$ 20,00 |
| R5 | C1 | quarta, 21/10/2026, 20:00 | Célula realizada | **Fábio** / Caio / Carla · **Discipulado** | Pedro | "Oração" | 5 · 1 · R$ 15,00 |

- **R3**, de C1, de quarta, 04/11/2026, 20:15, está **excluído** e não aparece para ninguém.
- **R1** em detalhe:
  - participantes: André, Beatriz, Caio, Carla, Débora, Gabriel, Jonas e Sara (excluída depois do envio);
  - visitantes: "João Pereira" e "Maria Lima";
  - observações: "Dois visitantes do trabalho do Caio";
  - enviado por Caio em 18/11/2026 às 21:40, sem alteração depois.
- **Relatórios visíveis** (RN-04 do E2.02; com o retrato da massa, o resultado é o mesmo das pessoas atuais da célula):

| Pessoa | Relatórios visíveis | Total |
|---|---|---|
| Rita, Samuel, Magda e Lia | R9, R10, R6, R1, R2, R8, R4, R5 | 8 |
| André | R9, R6, R1, R2, R8, R4, R5 | 7 |
| Pedro e Caio | R9, R6, R1, R2, R4, R5 | 6 |
| Diego | R10, R8 | 2 |
| Ester e Hugo | nenhum | 0 |

- **Por semana:** esta semana, R9 e R10; semana passada, R6 e R1; semana retrasada, R2 e R8.

#### Critérios por regra
- **RN-01**
  - Dados Rita, Samuel, Pedro, André, Diego, Caio, Ester e Lia
  - Quando cada um abre Relatórios
  - Então vê o título "Relatórios", a busca, os atalhos "Esta semana", "Semana passada" e "Semana retrasada", nenhum marcado, e os filtros Líder, G12, Período, Tipo e Reunião, sem a Célula.
  - Então, com todos os filtros vazios, vê a mesma lista e o mesmo total de antes deste passo: Rita, Samuel e Lia 8, André 7, Pedro e Caio 6, Diego 2 e Ester 0.
  - Dado Hugo, sem função
  - Então ele não tem Relatórios no menu (RN-22 do E2.02); pela API, vale a RN-03.
- **RN-02**
  - Dada Rita
  - Quando ela escolhe Tipo: Evangelística e Reunião: Célula realizada
  - Então vê R6, R1 e R4 (3): R2 sai porque não houve célula, e R5 sai porque foi registrado como Discipulado.
  - Quando ela escolhe Líder: André e Débora
  - Então vê R1, R2, R8 e R4 (4).
  - Quando ela busca "fe" e usa "Semana passada"
  - Então vê só R1.
  - Quando ela busca "perdao" e usa "Esta semana"
  - Então a lista fica vazia, com "Nenhum relatório encontrado com estes filtros." e "Limpar filtros".
  - Dada Rita no computador, na página 3 de uma lista
  - Quando ela muda qualquer filtro
  - Então a lista muda na hora e volta para a página 1.
  - Dada Rita no celular, na página 3 de uma lista
  - Quando ela marca Tipo: Discipulado no painel e fecha o painel sem tocar em "Aplicar filtros"
  - Então a lista e a página não mudam.
  - Quando ela toca em "Semana passada", fora do painel
  - Então o Período vale na hora, e a lista volta para a página 1.
  - Dados 20 mil membros, 1.500 células e 100 mil relatórios
  - Quando Rita aplica Líder (2 pessoas), G12 (1 pessoa), Período, Tipo (2 opções) e Reunião
  - Então a primeira página e o total aparecem em até 2 s.
- **RN-03**
  - Dado Diego
  - Quando ele escolhe Tipo: Discipulado
  - Então vê só R8, e não R9 nem R5, que não vê.
  - Dado Hugo, sem função
  - Quando ele lê a lista de Relatórios pela API com qualquer filtro
  - Então recebe só os relatórios em que está registrado como líder, timóteo ou anfitrião (RN-14 b do E2.11). Na massa, não há nenhum, e a lista vem vazia.
  - Dada Rita
  - Quando ela filtra o Período de 01/11/2026 a 07/11/2026
  - Então a lista fica vazia: R3, de 04/11, está excluído e não conta no total.
  - Quando ela filtra G12: Pedro
  - Então R6 aparece, com o selo "Célula excluída".
- **RN-04**
  - Dada Rita
  - Quando ela troca, hoje, o líder de C1 para Caio e o tipo para Macrocélula
  - Então R1, R2 e R4 continuam em Líder: André e em Tipo: Evangelística, e Líder: Caio continua sem nenhum relatório até o próximo relatório de C1.
  - Então a linha de R1 mostra "André" e o mesmo endereço de C1.
  - Dado um relatório de C3 vindo do legado sem tipo, carregado quando C3 era do tipo Discipulado (P-REL-18 do E2.11)
  - Quando Rita muda, depois da carga, o tipo de C3 para Evangelística
  - Então o relatório continua em Tipo: Discipulado.
- **RN-05**
  - Dada Rita
  - Quando ela escolhe Líder: André
  - Então vê R1, R2 e R4 (3), sem R5, cujo líder registrado é Fábio, e sem R3, que está excluído.
  - Quando ela escolhe Líder: Fábio
  - Então vê R5, mesmo com Fábio inativo e sem liderar célula hoje.
  - Quando ela abre o seletor do Líder
  - Então as opções são André (144), Débora (1.728), Fábio (1.728), Jonas (Nível 5), Paula (G12) e Samuel (Pastor).
  - Quando ela abre um link com Líder: Caio, timóteo de C1
  - Então o filtro mostra "Caio", que ela vê, e a lista fica vazia: ser timóteo não conta.
  - Quando ela tenta escolher uma 11ª pessoa
  - Então vê "Escolha até 10 pessoas.", e a 11ª não entra.
  - Dado Pedro
  - Quando ele abre o seletor do Líder
  - Então as opções são só André, Fábio, Jonas e Paula, sem Samuel nem Débora.
  - Dado Diego
  - Quando ele abre o seletor do Líder
  - Então as opções são Débora e Samuel. Samuel aparece porque é o líder registrado de R10, que Diego vê, mesmo sem ver Samuel como membro.
  - Dado que Fábio, depois de ter os discípulos reatribuídos (E2.01), é excluído
  - Então R5 continua na lista de Rita, com "Fábio" na linha, e a busca "fabio" encontra R5.
  - Então Fábio sai das opções do Líder, e um link com Líder: Fábio mostra "Pessoa indisponível".
- **RN-06**
  - Dada Rita
  - Quando ela escolhe G12: Pedro
  - Então vê R6, R1, R2, R4 e R5 (5): R5 entra porque o G12 de Fábio é Pedro, e R6 entra mesmo com C5 excluída.
  - Quando ela escolhe G12: Paula
  - Então vê R9, que Paula lidera.
  - Quando ela escolhe G12: Pedro e Paula
  - Então vê R9, R6, R1, R2, R4 e R5 (6).
  - Quando ela abre o seletor do G12
  - Então as opções são Paula, Pedro e Tânia. Não há "Pastores" nem "—", e R10 não aparece em nenhuma opção.
  - Quando ela escolhe Líder: Samuel
  - Então vê R10.
  - Dado um relatório de C8, de sábado, 21/11/2026, às 16:00, célula realizada
  - Então a linha dele mostra "G12: —", ele não entra em nenhuma opção do G12, e Líder: Ester o traz.
  - Dado que Rita troca, hoje, o líder de André para Tiago
  - Quando ela filtra G12: Tiago, na primeira consulta depois de salvar
  - Então vê R6, R1, R2, R4 e R5, porque André, Fábio e Jonas passaram para o ramo de Tiago; G12: Pedro fica vazio.
  - Dado que Fábio, depois de ter os discípulos reatribuídos, é excluído e, depois, André passa para o ramo de Tiago
  - Então R5 continua em G12: Pedro, o G12 que Fábio tinha na exclusão.
- **RN-07**
  - Dado Pedro
  - Quando ele abre um link com Líder: Débora
  - Então o filtro aparece como "Pessoa indisponível", com "Esta pessoa não está disponível para você.", sem o nome nem o id de Débora (nem na tela, nem na resposta do servidor), o botão mostra "Filtros (1)", e a lista fica vazia, com total 0.
  - Quando o link traz Líder: Débora e André
  - Então Pedro vê R1, R2 e R4, e Débora aparece como "Pessoa indisponível".
  - Quando Pedro tira o chip "Líder: Pessoa indisponível"
  - Então o id de Débora sai da URL, e a lista fica só com Líder: André.
  - Quando ele abre um link com G12: Tânia
  - Então o G12 aparece como "Pessoa indisponível", e a lista fica vazia.
  - Dado Diego
  - Quando ele abre um link com G12: Tânia
  - Então o filtro mostra "Tânia", que ele vê, e a lista traz R8.
  - Dada Lia, que não vê nenhum membro
  - Quando ela abre um link com Líder: André
  - Então o filtro mostra "André (144)", porque André é o líder registrado de relatórios que ela vê, e a lista traz R1, R2 e R4.
  - Quando ela abre um link com Líder: Caio
  - Então o filtro mostra "Pessoa indisponível": Lia não vê Caio, e ele não é o líder registrado de nenhum relatório.
  - Dado o mesmo link com o id de um membro excluído, ou com um id com formato válido que não existe
  - Então a resposta é a mesma do caso de Débora.
  - Dado um link com Líder: "xyz"
  - Então "xyz" sai da URL, não aparece "Pessoa indisponível", e o filtro não conta.
- **RN-08**
  - Dado Pedro, no detalhe de C1 (E2.10)
  - Quando ele usa "Ver todos os relatórios"
  - Então a lista mostra R1, R2, R4 e R5 (4), com o chip "Célula de André · Quarta · 20:00", "Filtros (1)" e nenhum atalho marcado. R5 entra, embora o líder registrado seja Fábio.
  - Quando ele usa "Semana passada"
  - Então vê só R1, e o botão mostra "Filtros (2)".
  - Quando ele usa "Limpar filtros"
  - Então a Célula e o Período saem, e ele volta a ver os 6 relatórios.
  - Dado Pedro no celular, com Célula: C1 e Líder: André
  - Quando ele abre o painel
  - Então a Célula é o primeiro filtro do painel, e o chip dela é o primeiro acima da lista.
  - Quando ele tira a Célula dentro do painel e fecha o painel sem tocar em "Aplicar filtros"
  - Então a Célula continua aplicada, e a lista não muda.
  - Quando ele tira a Célula dentro do painel e toca em "Aplicar filtros"
  - Então a Célula sai, e o painel não oferece como escolhê-la de novo. Ela só volta por um link.
  - Dada Lia
  - Quando ela abre o mesmo link
  - Então vê o chip "Célula de André · Quarta · 20:00" e os 4 relatórios, mesmo sem ver C1.
  - Dado Diego
  - Quando ele abre o mesmo link
  - Então vê o chip "Célula indisponível", com "Esta célula não está disponível para você.", e a lista vazia.
  - Dada Rita, na consulta de R6
  - Quando ela usa "Ver todos os relatórios desta célula"
  - Então a lista mostra só R6, com o chip "Célula de Jonas · Sexta · 20:00" e o selo "Célula excluída".
  - Dado um link com Célula: "xyz"
  - Então "xyz" sai da URL, e a lista vem sem o filtro Célula.
- **RN-09**
  - Dada Rita
  - Quando ela filtra De 15/11/2026 até 21/11/2026
  - Então vê R6 e R1.
  - Quando ela filtra só De 22/11/2026
  - Então vê R9 e R10.
  - Quando ela filtra só Até 10/11/2026
  - Então vê R8, R4 e R5.
  - Quando ela filtra De 11/11/2026 até 11/11/2026
  - Então vê só R2, de "Não houve célula", pela data prevista da reunião.
  - Dado um relatório de C8, de sábado, 21/11/2026, às 23:30
  - Quando Rita filtra Até 21/11/2026
  - Então ele aparece.
  - Quando Rita informa De 21/11/2026 e Até 15/11/2026
  - Então vê "O fim do período precisa ser igual ou posterior ao início." embaixo de "Até", e a lista continua sem o Período.
  - Quando ela informa 31/02/2026 e sai do campo
  - Então vê "Data inválida. Use o formato dd/mm/aaaa.", e o Período não é aplicado. Enquanto ela digita, nenhuma mensagem aparece.
  - Quando, hoje, ela informa Até 28/11/2026
  - Então a data é aceita, sem mensagem.
- **RN-10**
  - Dada Rita
  - Quando ela toca em "Esta semana"
  - Então o Período fica de 22/11/2026 a 28/11/2026, "Esta semana" aparece marcado, e ela vê R9 e R10.
  - Quando ela toca em "Semana passada"
  - Então o Período fica de 15/11/2026 a 21/11/2026, e ela vê R6 e R1.
  - Quando ela toca em "Semana retrasada"
  - Então o Período fica de 08/11/2026 a 14/11/2026, e ela vê R2 e R8.
  - Quando ela recarrega a página
  - Então o Período e o atalho marcado continuam, e a URL tem as duas datas.
  - Quando ela toca de novo em "Semana retrasada", já marcado
  - Então nada muda: o atalho continua marcado, e o Período continua aplicado.
  - Quando ela tira o chip "De: 08/11/2026"
  - Então nenhum atalho fica marcado, e vale só o "Até: 14/11/2026".
  - Dada Rita abrindo Relatórios enquanto a data de hoje do servidor não chegou, ou com a leitura dela falhando
  - Então os três atalhos aparecem desabilitados, sem nenhum marcado, e a lista carrega normalmente. Nenhum atalho usa o relógio do aparelho.
  - Dado Pedro com Líder: André
  - Quando ele toca em "Semana retrasada"
  - Então vê só R2. O Líder continua aplicado.
  - Quando ele toca em "Semana passada"
  - Então o Período é trocado, e ele vê só R1.
  - Dado Pedro, sem atalho
  - Quando ele digita De 15/11/2026 e Até 21/11/2026
  - Então "Semana passada" aparece marcado.
  - Quando ele troca o Até para 20/11/2026
  - Então nenhum atalho fica marcado.
  - Dado um link com o Período de 22/11/2026 a 28/11/2026
  - Quando Rita o abre na terça-feira, 01/12/2026
  - Então vê R9 e R10, e o atalho marcado é "Semana passada".
  - Dado um relatório de C8, de sábado, 28/11/2026, às 16:00
  - Quando Rita toca em "Esta semana" no sábado, 28/11, às 23:59 de Brasília
  - Então o Período fica de 22/11 a 28/11, e ela vê R9, R10 e esse relatório.
  - Quando ela toca em "Esta semana" no domingo, 29/11, às 00:00 de Brasília
  - Então o Período fica de 29/11 a 05/12, e a lista fica vazia. "Semana passada" passa a trazer os três.
  - Dado o celular de Rita no fuso de Lisboa, no sábado, 28/11, às 23:30 de Brasília (já domingo, 02:30, em Lisboa)
  - Quando ela toca em "Esta semana"
  - Então o Período fica de 22/11 a 28/11.
  - Dado qualquer pessoa com Relatórios
  - Quando ela abre o menu
  - Então vê só o item "Relatórios", sem atalhos de semana, e ele abre a lista sem filtros.
- **RN-11**
  - Dada Rita
  - Quando ela escolhe Tipo: Discipulado
  - Então vê R9, R8 e R5 (3): R5 entra pelo tipo registrado, embora C1 seja Evangelística hoje.
  - Quando ela escolhe Tipo: Evangelística
  - Então vê R6, R1, R2 e R4.
  - Quando ela escolhe Tipo: Macrocélula
  - Então vê R10.
  - Quando ela escolhe Reunião: Não houve célula
  - Então vê só R2. Com Reunião: Célula realizada, vê os outros 7.
  - Dado que Rita muda, hoje, o tipo de C3 para Evangelística
  - Então R8 continua em Tipo: Discipulado.
- **RN-12**
  - Dada Rita com Tipo: Discipulado, "Semana retrasada" e 50 por página
  - Quando ela recarrega a página ou volta a ela pelo navegador
  - Então os filtros, a página e o tamanho continuam aplicados.
  - Quando ela envia o link a Pedro
  - Então Pedro vê a lista vazia, porque não vê R8.
  - Dado um link com o tipo "abc" e Reunião: Não houve célula
  - Então a lista aplica só a Reunião, "abc" sai da URL, e o botão mostra "Filtros (1)".
  - Dada Rita com Célula: C1, Líder: André e Débora, G12: Pedro, "Semana passada", Tipo: Evangelística e Discipulado e Reunião: Célula realizada
  - Então o botão mostra "Filtros (6)", aparecem 9 chips (1 de Célula, 2 de Líder, 1 de G12, 2 de Período, 2 de Tipo e 1 de Reunião), e a lista traz só R1.
  - Quando ela tira o chip "Tipo: Discipulado"
  - Então só ele sai, e o botão continua com "Filtros (6)".
  - Dada Rita, numa lista maior que a da massa, com esses filtros, a busca "fe", na página 2 e com 50 por página
  - Quando ela usa "Limpar filtros"
  - Então os filtros, a Célula e a busca ficam vazios, a lista volta para a página 1 e continua com 50 por página.
  - Dada Rita só com a busca "fe"
  - Então o botão mostra "Filtros", sem número, e "Limpar filtros" aparece.
- **RN-13**
  - Dada Rita, sem filtros
  - Então a lista vem nesta ordem: R9, R10, R6, R1, R2, R8, R4 e R5.
  - Dados 60 relatórios na mesma data e no mesmo horário
  - Quando Rita percorre as páginas de 25 em 25
  - Então cada um aparece exatamente uma vez.
  - Quando Rita escolhe G12: Pedro
  - Então a ordem dos que ficam é a mesma: R6, R1, R2, R4 e R5.
- **RN-14**
  - Dada Rita
  - Quando ela busca "fabio"
  - Então vê só R5.
  - Quando ela busca "andre"
  - Então vê R1, R2 e R4, e não R5.
  - Quando ela busca "oracao"
  - Então vê R5.
- **RN-15**
  - Dada Rita
  - Então a linha de R1 mostra "André", "G12: Pedro", "Rua das Flores, 100 · Centro", "Qua, 18/11/2026 · 20:00", "Célula realizada", "Tema: A fé que vence", "Participantes: 8", "Visitantes: 2" e "Oferta: R$ 50,00", sem "presenças" e sem as observações.
  - Então a linha de R2 mostra "Não houve célula" e "Motivo: Chuva forte no bairro", sem números nem oferta.
  - Então a linha de R10 mostra "Samuel" e "G12: Pastores"; a de R5 mostra "Fábio" e "G12: Pedro"; e a de R6 mostra o selo "Célula excluída".
  - Dadas Lia e Diego
  - Então as linhas que eles veem mostram os mesmos nomes de líder e de G12, mesmo para pessoas que eles não veem como membro.
  - Dado um relatório de célula realizada sem valor de oferta registrado, de antes do E2.11
  - Então a linha mostra "Oferta: Não informada".
  - Dado um relatório com um tema de 6 linhas
  - Então a linha mostra as 3 primeiras, e a consulta mostra o tema inteiro.
  - Dado um relatório de C3, de terça, 03/11/2026, de "Não houve célula", vindo do legado com o motivo "Viagem do líder", o tema "Fé", 2 visitantes, a oferta de R$ 10,00 e os participantes Débora, Rita e Beatriz
  - Então a linha mostra "Não houve célula" e "Motivo: Viagem do líder", sem tema, números nem oferta.
- **RN-16**
  - Dado Caio, sem "Editar Relatórios de Células"
  - Quando ele abre a consulta de R1
  - Então vê, nesta ordem:
    - no topo: "Célula de André · Quarta · 20:00", "Célula realizada" e "Enviado por Caio em 18/11/2026 às 21:40";
    - em Reunião: "Quarta, 18/11/2026 às 20:00", o tema, os 8 participantes pelo nome, os visitantes "João Pereira" e "Maria Lima", a oferta de R$ 50,00 e as observações;
    - em Pessoas da célula: a dica "Líder, timóteo, anfitrião e tipo como estavam no envio. O G12 é o de hoje.", Líder André, Timóteo Caio, Anfitrião Carla, G12 Pedro e Tipo Evangelística;
    - em Endereço da célula: o endereço de C1, "Ver célula" e "Ver todos os relatórios desta célula".
  - Então não vê "Editar relatório" nem "Excluir relatório", e a consulta não tem rodapé de ações.
  - Dado Pedro, com "Editar Relatórios de Células" e "Excluir Relatórios de Células"
  - Quando ele abre a mesma consulta
  - Então vê também "Editar relatório" e "Excluir relatório" no rodapé. "Editar relatório" abre o mesmo formulário da linha, por cima da consulta.
  - Quando ele muda o tema para "A fé que vence o mundo" e salva
  - Então volta para a consulta, que mostra o tema novo e "Alterado por Pedro em …", e a linha de R1 na lista também mostra o tema novo.
  - Quando ele abre "Editar relatório" e cancela
  - Então volta para a consulta como estava.
  - Dada Rita
  - Quando ela abre a consulta de R5
  - Então vê "Célula de André · Quarta · 20:00", mas as pessoas registradas: Líder Fábio, Timóteo Caio e Anfitrião Carla, e o Tipo Discipulado.
  - Quando ela abre a consulta de R2
  - Então vê "Não houve célula", "Reunião prevista: Quarta, 11/11/2026 às 20:00" e o motivo, sem tema, participantes, visitantes e oferta.
  - Quando ela abre a consulta do relatório de C3 de 03/11/2026 vindo do legado (critério da RN-15)
  - Então vê só "Não houve célula", a reunião prevista e o motivo "Viagem do líder", sem o tema, os visitantes, a oferta e os participantes que ele tem gravados.
  - Quando ela abre a consulta de R6
  - Então vê o selo "Célula excluída" e o aviso do E2.01, sem "Editar relatório" e sem "Ver célula". "Excluir relatório" e "Ver todos os relatórios desta célula" continuam.
  - Dada Lia
  - Quando ela abre a consulta de R1
  - Então vê o mesmo que Caio, sem "Ver célula", porque não vê C1.
  - Dado Pedro com a consulta de R1 aberta
  - Quando ele recarrega a página
  - Então a consulta reabre sobre a mesma lista.
  - Quando ele abre um link para a consulta de R8, que não vê
  - Então vê "Relatório não encontrado.", sem nenhum dado de R8. A resposta é a mesma para R3, que está excluído, e para um id com formato válido que não existe.
  - Dado um link com a consulta "xyz"
  - Então "xyz" sai da URL, e a lista abre sem consulta.
  - Dado Pedro, que exclui R4 pela consulta
  - Então a consulta fecha, e R4 sai da lista e do total.
  - Dado Hugo, pela API
  - Quando ele tenta ler R1 ou os participantes de R1
  - Então não recebe nada.
- **RN-17**
  - Dados Caio, Pedro e Lia
  - Quando cada um abre a consulta de R1
  - Então vê os participantes, em ordem alfabética: André, Beatriz, Caio, Carla, Débora, Gabriel, Jonas e Sara. Beatriz e Débora, que Pedro e Caio não veem como membros, e Sara, que foi excluída, aparecem só pelo nome, sem acesso ao cadastro.
  - Dado Pedro, pela API
  - Quando ele lê os participantes de R1
  - Então recebe só os nomes, sem nenhum outro dado de Beatriz, Débora ou Sara.
  - Dado Pedro, com "Editar Relatórios de Células"
  - Quando ele usa "Editar relatório" em R1
  - Então o formulário de edição é o do E2.11.
- **RN-18**
  - Dada Rita
  - Então o card "Relatórios enviados" da semana mostra 2, o mesmo total da lista com "Esta semana".
  - Então o card de visitantes da semana mostra 8, a soma dos visitantes de R9 (3) e R10 (5) na lista com "Esta semana".
  - Então o gráfico da semana mostra 2 células realizadas e 0 com "Não houve célula", os mesmos totais da lista com "Esta semana" e Reunião: Célula realizada ou Não houve célula.
  - Dado Pedro
  - Então o card "Relatórios enviados" mostra 1 (R9) e o de visitantes, 3, iguais à lista com "Esta semana".
  - Dado Diego
  - Então o card "Relatórios enviados" mostra 1 (R10) e o de visitantes, 5.

### Textos de tela
Vocabulário de referência. O `ux-designer` pode ajustar o tom, mas não o sentido nem os termos.

- **Termos:** Relatórios, Novo relatório, Filtros, Limpar filtros, Líder, G12, Célula, Período, De, Até, Esta semana, Semana passada, Semana retrasada, Atalhos de semana, Tipo, Reunião, Reunião prevista, Célula realizada, Não houve célula, Tema, Motivo, Participantes, Visitantes, Oferta, Observações, Pessoa indisponível, Célula indisponível, Ver relatório, Pessoas da célula, Timóteo, Anfitrião, Editar relatório, Excluir relatório, Ver célula, Ver todos os relatórios desta célula, Relatório não encontrado, Enviado por, Alterado por.
- **Evitar:**
  - "Encontro" e "Detalhes do Encontro" para a reunião da célula, porque Encontro é o retiro da Consolidação (P-REL-20 do E2.11);
  - "Relatórios de Células" como título e "Novo Relatório" com maiúsculas (P-LRE-31);
  - "Presenças" (a soma de participantes e visitantes);
  - "Realizada", "Não Realizada", "Não realizada" e "Cancelada" sozinhos (use "Célula realizada" e "Não houve célula");
  - "Status" no lugar de "Situação" ou "Reunião";
  - "Desde" e "Líder de Célula", do legado (use "De" e "Líder");
  - "Relatórios da célula" como título (P-LCE-32 do E2.10);
  - "Indiferente" no lugar de "Todas";
  - "Modalidade" no lugar de "Tipo" e "Discipuladora" no lugar de "Discipulado";
  - "doação" ou "dízimo" no lugar de "oferta";
  - "Formato: dd/mm/aaaa" ao lado do campo de data (P-FIL-23 do E2.07);
  - anglicismos.

| Situação | Texto |
|---|---|
| cabeçalho | Título: Relatórios · botão: Novo relatório (P-LRE-31) |
| botão do painel | Filtros · com filtros ativos: Filtros (<N>), com N de 1 a 6 (RN-12) · leitor de tela: Filtros (<N> ativos) |
| limpar | Limpar filtros · dentro do painel do celular: Limpar · Aplicar filtros · o "✕" dos painéis: Fechar |
| busca | Rótulo: Buscar · Placeholder: Líder ou tema |
| atalhos | Esta semana · Semana passada · Semana retrasada · leitor de tela: o grupo se chama Atalhos de semana; cada atalho tem o nome com as datas ("Esta semana, de 22/11/2026 a 28/11/2026") e diz se está marcado |
| Líder | Rótulo: Líder · Sem escolha: Escolha uma ou mais pessoas · Opção: <Nome> (<nível>) · Busca sem resultado: Nenhum líder encontrado. · Dica: Mostra os relatórios em que a pessoa escolhida era a líder da célula. |
| G12 | Rótulo: G12 · Sem escolha: Escolha uma ou mais pessoas · Opção: <Nome> · Busca sem resultado: Nenhum G12 encontrado. · Dica: Mostra os relatórios das células do ministério de cada pessoa escolhida, inclusive os da célula dela. Para o ministério de um casal, escolha os dois. |
| limite do Líder e do G12 | Escolha até 10 pessoas. |
| pessoa indisponível | Pessoa indisponível · Dica: Esta pessoa não está disponível para você. · com mais de uma: Estas pessoas não estão disponíveis para você. |
| Período | Legenda: Período · De · Até |
| data inválida | Data inválida. Use o formato dd/mm/aaaa. |
| intervalo invertido | O fim do período precisa ser igual ou posterior ao início. |
| Tipo | Evangelística · Discipulado · Macrocélula · Dica: Pelo tipo que a célula tinha quando o relatório foi enviado. |
| Reunião | Todas · Célula realizada · Não houve célula |
| múltipla escolha sem nada escolhido | Todos (Tipo) |
| Célula | Célula de <Líder> · <Dia> · <hh:mm> · indisponível: Célula indisponível · Dica: Esta célula não está disponível para você. |
| chips | Líder: <Nome> · Líder: Pessoa indisponível · G12: <Nome> · G12: Pessoa indisponível · De: <dd/mm/aaaa> · Até: <dd/mm/aaaa> · Tipo: <opção> · Reunião: <opção> · Célula de <Líder> · <Dia> · <hh:mm> · Célula indisponível · leitor de tela: Remover filtro <texto do chip> |
| lista vazia com filtros ou com a busca | Nenhum relatório encontrado com estes filtros. · Limpar filtros |
| lista vazia sem filtros nem busca | Nenhum relatório encontrado. |
| erro ao carregar a lista | Não foi possível carregar os relatórios. Verifique a conexão e tente de novo. · Tentar de novo |
| total | <N> relatórios (ou 1 relatório), já com os filtros |
| linha | <Líder> · G12: <Nome> · G12: Pastores · G12: — · <rua>, <número> · <bairro> · Sem endereço · <Dia abreviado>, <dd/mm/aaaa> · <hh:mm> ("Qua, 18/11/2026 · 20:00"; leitor de tela: o dia inteiro) · Célula realizada · Não houve célula · Tema: <tema> · Motivo: <motivo> (até 3 linhas) · Participantes: <N> · Visitantes: <N> · Oferta: R$ <valor> · Oferta: Não informada · Célula excluída |
| tabela | colunas: Célula · Data e horário · Reunião · Participantes · Visitantes · Oferta · Ações |
| abrir a consulta | Ver relatório · leitor de tela: Ver o relatório de <dd/mm/aaaa>, <Líder> |
| consulta: cabeçalho | Relatório de <dd/mm/aaaa> · enquanto carrega por link e no erro: Relatório · Célula de <Líder> · <Dia> · <hh:mm> · Célula realizada · Não houve célula |
| consulta: seções, nesta ordem | **Reunião:** Data e horário · <Dia>, <dd/mm/aaaa> às <hh:mm> · em "Não houve célula": Reunião prevista · Tema · Motivo · Participantes (<N>) · Nenhum membro. · Visitantes (<N>) · Nenhum visitante. · Oferta · Observações · **Pessoas da célula** (dica: Líder, timóteo, anfitrião e tipo como estavam no envio. O G12 é o de hoje.) · Líder · Timóteo · Anfitrião · G12 · Tipo · **Endereço da célula** · Sem endereço |
| consulta: autoria | Enviado por <Nome> em <dd/mm/aaaa> às <hh:mm> · Alterado por <Nome> em <dd/mm/aaaa> às <hh:mm> (os demais textos são os do E2.05) |
| consulta: ações | Editar relatório · Excluir relatório · Ver célula · Ver todos os relatórios desta célula · leitor de tela: Ver a célula de <Líder> · Ver todos os relatórios da célula de <Líder> |
| consulta: não encontrado | Relatório não encontrado. · Ele não existe, foi excluído ou não está disponível para você. · Fechar |
| consulta: célula excluída | os textos do E2.01 (selo "Célula excluída", aviso e "Ver células excluídas") |
| erro ao carregar a consulta | Não foi possível carregar o relatório. Verifique a conexão e tente de novo. · Tentar de novo · só os participantes: Não foi possível carregar os participantes. Verifique a conexão e tente de novo. |

Os demais textos da UX (descrições para o leitor de tela, estados de carregamento e as alternativas da T16) estão em Experiência (UX) > Textos e foram aceitos sem ajuste (P-LRE-33).

### Telas que mudam
- **Lista de Relatórios:**
  - o título passa a "Relatórios", e o botão, a "Novo relatório" (P-LRE-31);
  - os atalhos "Esta semana", "Semana passada" e "Semana retrasada", à vista, numa linha própria logo depois de "Filtros", fora do painel (RN-10);
  - o botão "Filtros" com o painel do P50 do E2.07, nesta ordem: a Célula, quando vem de link, Líder, G12, Período, Tipo e Reunião (RN-01 a RN-12);
  - os chips, a contagem, "Limpar filtros", o total filtrado e o vazio com filtros;
  - a linha: líder registrado e G12, endereço, data com o dia abreviado e horário, "Célula realizada" ou "Não houve célula", tema ou motivo em até 3 linhas, participantes, visitantes e oferta. Saem as "presenças" e os selos "Realizada" e "Não Realizada" (RN-15);
  - toda linha abre a consulta (RN-16);
  - a busca passa a procurar no líder registrado (RN-14). A ordem não muda (RN-13).
- **Consulta "Ver relatório"** (o painel desenhado no E2.01): passa a valer para todo relatório visível e para todos que o veem. Mostra, nesta ordem, a reunião (com os participantes e os visitantes pelo nome), as pessoas registradas com o tipo e o endereço, além da autoria no topo. As ações "Editar relatório" e "Excluir relatório" ficam no rodapé, e "Ver célula" e "Ver todos os relatórios desta célula", junto do endereço. "Editar relatório" abre o formulário por cima da consulta. O link mostra "Relatório não encontrado." quando não há o que mostrar (RN-16, RN-17).
- **Filtro Célula** (desenhado no E2.10): passa do chip avulso para o painel e para a contagem (RN-08).
- **Detalhe da célula** (E2.10): não muda. O "Ver todos os relatórios" abre a lista nova.
- **Formulário de relatório:** o do E2.11, sem mudança. Abre também a partir da consulta, por cima dela.
- **Menu:** não muda (P-LRE-08).
- **Dashboard:** não muda. O clique nos números é do E2.14 (RN-18).
- **Lista "Excluídos" de relatórios** (E2.01): não muda e continua sem filtros.
- Membros, Células, Ministérios, Funções, Auditoria e login não mudam.

### Fora de escopo
Cada item indica o passo que cuida dele, quando há um.
- **Lançamento de relatório** (REL-01 a REL-12 e REL-15), **retrato** (REL-09), participantes automáticos (REL-07) e a data sugerida do formulário: E2.11. Este passo só usa o retrato.
- **Exportação para Excel** (REL-14), com uma linha por célula, inclusive as sem relatório, e o "Célula #": E2.13.
- **Do Dashboard:** E2.14 (DSH-02 a DSH-05). Este passo só garante os equivalentes (RN-18). Ficam com o E2.14:
  - o clique nos cards e no gráfico;
  - os nomes dos cards e das fatias.
- **Situação do relatório por célula** (CEL-05) e as células sem relatório: E2.09 e E2.10. A lista de Relatórios mostra só relatórios enviados.
- **Detalhe da célula e o filtro Célula na origem:** E2.10.
- **Exclusão e restauração de relatórios, e a lista "Excluídos":** E2.01.
- **Escopo e permissões:** E2.02. **G12 e nível:** E2.06. **Autoria:** E2.05.
- **Filtros por timóteo, anfitrião, tema e data exata:** sem passo. A consulta do servidor do legado tinha os quatro, mas a tela não. A busca encontra pelo tema, e a data exata é o Período com o mesmo dia nos dois campos.
- **Atalhos de semana no menu:** fora (P-LRE-08; ver Q-2).
- **Seletor de célula no painel:** fora (P-LRE-06; ver Q-5).
- **Filtro de rede** (relatórios das células lideradas por alguém ou por quem está abaixo dele): fora; ver Q-6.
- **Somas na lista** (total de ofertas, de participantes ou de visitantes do resultado): sem passo no plano. O legado não tinha.
- **Atalho para o cadastro do líder** ("Dados do líder" do legado): fora. O novo não tem tela de detalhe de membro.
- **Escolher a ordem da lista e salvar filtros:** sem passo no plano. O legado não tinha.
- **Visitantes de célula como consolidados:** feature futura (Consolidação). Aqui, os visitantes continuam sendo nomes livres.

### Impactos em outros passos
Pontos de negócio que outros passos precisam respeitar. O `architect` decide como.
- **E2.11:**
  - todo relatório tem o retrato (RN-21 de lá), então não há transição: os filtros Líder, G12 e Tipo, a busca, a linha e a consulta usam o retrato desde o primeiro dia (RN-04). O líder e o G12 da lista já vêm da RN-14 d de lá;
  - o número de participantes da linha e da consulta inclui os automáticos (RN-11 de lá);
  - os relatórios novos de "Não houve célula" não têm participantes, tema, visitantes nem oferta (RN-09 de lá); a linha e a consulta tratam os antigos do mesmo jeito (P-LRE-34);
  - "Editar relatório" da consulta abre o formulário do E2.11, por cima da consulta (P-LRE-29);
  - o "Novo relatório" da lista não muda, a não ser pelo texto em caixa de frase (P-LRE-31).
- **E2.10:**
  - o filtro Célula (RN-19 de lá) entra no painel de Relatórios, conta como filtro ativo e sai com "Limpar filtros" (RN-08). A regra da "Célula indisponível" continua;
  - recomenda-se que cada relatório dos "Últimos relatórios" do detalhe da célula abra a mesma consulta (RN-16). Os nomes continuam fora do detalhe, como a RN-18 de lá decidiu; eles ficam na consulta;
  - a recomendação de levar cada relatório ao detalhe da célula fica atendida pelo "Ver célula" da consulta;
  - a nota da T11 de lá fica respondida: a lista de Relatórios passa a usar "Célula realizada" e "Não houve célula", os termos do detalhe (RN-15).
- **E2.01:**
  - a consulta da P-DEL-19 e da UXD-7 passa a valer para todo relatório visível e para todos que o veem (RN-16, P-LRE-16). O "Editar relatório" do rodapé, que o E2.01 deixou para cá, entra;
  - o link da consulta deixa de ser ignorado: para um relatório invisível, excluído ou inexistente, mostra "Relatório não encontrado." (P-LRE-18). Ajustar a Navegação ("Consulta do relatório") e o UX-27 de lá no aceite.
- **E2.05:** a autoria aparece na consulta de toda linha, como a RN-07 de lá já previa (P30).
- **E1.08:**
  - a busca de Relatórios da RN-04 de lá passa a procurar no líder registrado, e não no líder atual da célula (RN-14);
  - o texto do E1.08 fica como histórico.
- **E2.13:** recomenda-se que a exportação aceite os mesmos filtros e atalhos da lista, como o legado fazia (`UI/pages/Report/index.js:142-144`: a exportação usa os filtros da tela). A exportação tem uma linha por célula, inclusive as sem relatório, então o conjunto é outro. O G12 segue as "Definições" do E2.06.
- **E2.14:**
  - liga o clique de "Relatórios enviados", do card de visitantes e das fatias do gráfico da semana à lista com os equivalentes da RN-18, pela URL (RN-12);
  - se mudar a definição de algum desses números, atualiza a linha da RN-18 no mesmo passo.
- **E2.09:** a Q-2 de lá ("Não houve célula" em várias semanas seguidas) ganha uma forma de consulta: a lista de Relatórios com Reunião: Não houve célula e o Período.
- **E4.04 (saneamento):** a lista do E2.11 (Impactos e "Dados do legado" de lá) dos relatórios de "Não houve célula" com tema, oferta maior que zero ou visitantes ganha mais um motivo: depois da migração, esses dados não aparecem em nenhuma tela de Relatórios (P-LRE-34). A linha do saneamento:

  | Situação no legado | Tratamento | Regra |
  |---|---|---|
  | "Não houve célula" com tema, oferta maior que zero ou visitantes | Migra como está (RN-21 do E2.11). Listar para a liderança, com a célula, a data e os dados que não vão aparecer. A liderança decide, no E4.05, se corrige no legado antes da carga (por exemplo, desmarcando "Não houve célula" quando a célula se reuniu). | P-LRE-34; RN-09 e RN-21 do E2.11 |

  Os participantes desses relatórios (os automáticos do legado) só ficam registrados, como no E2.11, sem pedir correção.
- **E5.04 (homologação):** os números das listas filtradas no novo e no legado não batem, e isso é esperado:
  - o G12 do novo inclui os relatórios do próprio G12, que o legado mostrava sem G12;
  - o Período do novo compara só as datas de Brasília, e o legado comparava data e hora;
  - a lista do novo tem os relatórios de célula excluída;
  - a busca do novo ignora acentos.
- **Consolidação:** quando existir, o consolidado só aparece como participante de relatório se o spec da Consolidação permitir. Os visitantes continuam nomes livres até lá.
- **Aceite (PO):**
  - no `docs/migracao.md`: REL-13 em ✅, e o E2.12 marcado na seção Progresso;
  - no `CLAUDE.md`: a linha "Relatórios por período e atalhos para a semana atual, passada e retrasada" da matriz de paridade em ✅.

### Perguntas em aberto
Nenhuma pergunta bloqueia a implementação. Cada uma já tem um padrão adotado, que vale se o usuário não decidir outra coisa no PR.

- **Q-1. Quem vê os participantes pelo nome?**
  - **Padrão adotado:** todos que veem o relatório, na consulta (RN-17). Os nomes já são liberados pela D-4 do E1.08, e a consulta não expõe nenhum dado novo.
  - **Alternativa:** só quem tem "Editar Relatórios de Células", como hoje. Os demais veem só os números, como no legado.
- **Q-2. Onde ficam os atalhos de semana?**
  - **Padrão adotado:** só na tela de Relatórios, à vista (RN-10).
  - **Alternativa:** também no menu, como no legado, em três itens embaixo de Relatórios.
- **Q-3. O que o link de um atalho guarda?**
  - **Padrão adotado:** as datas da semana. O link mostra sempre a mesma semana, como no legado, que preenchia as datas.
  - **Alternativa:** a semana relativa ("esta semana"). Um favorito no celular mostraria sempre a semana atual, mas um link enviado mudaria de semana com o tempo.
- **Q-4. A lista abre com algum período?**
  - **Padrão adotado:** não, como hoje (P-LRE-10).
  - **Alternativa:** abrir com "Esta semana", que é o uso mais comum. Ver todos os relatórios passaria a exigir "Limpar filtros".
- **Q-5. A Célula pode ser escolhida no painel?**
  - **Padrão adotado:** não. Ela chega só por link, do detalhe da célula ou da consulta (P-LRE-06). O Líder e a busca cobrem o uso do dia a dia.
  - **Alternativa:** um seletor de célula no painel, com as células visíveis e as de relatórios visíveis.
- **Q-6. Filtro de rede.**
  - **Padrão adotado:** não existe, como no legado e no E2.10 (Q-2 de lá).
  - **Alternativa:** um filtro "Liderança", com os relatórios cujo líder registrado é a pessoa escolhida ou alguém abaixo dela, como a Liderança do E2.07.
- **Q-7. G12 por casal.**
  - **Padrão adotado:** por pessoa (RN-06), como no E2.10.
  - **Alternativa:** a mesma da Q-5 do E2.10. A resposta de lá vale aqui também.

### Pontos para o `architect`
Não são dúvidas de negócio. São pontos em que a regra depende de uma escolha técnica.
1. **Retrato** (RN-04).
   - O Líder, o Tipo, a busca, a linha e a consulta usam o retrato do E2.11, e o G12 sai do líder registrado.
   - Todo relatório tem o retrato (RN-21 do E2.11), então não há transição nem dado da célula atual no lugar dele. A visibilidade usa as mesmas pessoas registradas (RN-14 a e b do E2.11), e filtro e escopo nunca usam pessoas diferentes.
   - Este passo entra depois do E2.11. A dica das pessoas da célula e a do Tipo aparecem sempre (AQ-7 da UX, que cai).
2. **G12 do relatório** (RN-06).
   - É o G12 atual do líder registrado (`g12_id` do E2.06), com "Pastores" e "—", e acompanha a árvore na hora.
   - O líder registrado excluído mantém o G12 da exclusão (P-LRE-21).
3. **Seletores de Líder e G12** (RN-05 a RN-07).
   - As opções vêm dos relatórios visíveis, em 100 mil relatórios, com a busca e as páginas de 20 da RN-07 do E1.08.
   - A pessoa vinda da URL é resolvida como nome ou como "Pessoa indisponível", sem revelar a cadeia de liderança (RN-23 do E2.02) nem o G12 de relatórios invisíveis.
4. **Célula** (RN-08). A identificação só sai do servidor quando quem consulta vê a célula ou um relatório dela, como no ponto 5 do E2.10.
5. **Semana de Brasília** (RN-09, RN-10).
   - Os atalhos usam a data de hoje em Brasília segundo o servidor, como o rótulo da semana do Dashboard (E1.08). O relógio e o fuso do aparelho não podem mudar a semana.
   - Hoje, o formulário de relatório usa o relógio do navegador (Problemas conhecidos do `CLAUDE.md`).
6. **Consulta** (RN-16, RN-17).
   - Os nomes dos participantes já saem pela `cell_report_participants_view` para quem vê o relatório.
   - O link para um relatório invisível, excluído ou inexistente tem uma resposta só, sem nenhum dado.
   - A consulta só lê e não gera evento.
7. **Desempenho** (RN-02). A meta é de 2 s com 100 mil relatórios e qualquer combinação. O que mais pesa:
   - o G12 do líder registrado;
   - as opções dos seletores;
   - a busca no líder registrado.
8. **Equivalência com o Dashboard** (RN-18). A lista e a `dashboard_summary` precisam usar a mesma semana, o mesmo escopo e os mesmos relatórios, inclusive os de célula excluída.
9. **Oferta sem valor** (RN-15). Depende de a oferta poder ficar vazia no banco, como no ponto 11 do E2.10. Pela RN-13 do E2.11, os relatórios novos de célula realizada sempre têm oferta, então "Não informada" só aparece em relatórios antigos, se houver. A regra continua valendo.
10. **Ordem dos passos.**
    - Este passo usa: o E2.01 e o E2.02; a autoria do E2.05; o G12 e o nível do E2.06; o filtro Célula e o detalhe do E2.10; e o retrato do E2.11. Entra depois do E2.11.
    - Se o E2.10 atrasar, a Célula e o "Ver célula" podem ir num PR separado, sem mudar as outras regras.
11. **"Não houve célula" com dados** (RN-15, RN-16, P-LRE-34). A linha e a consulta decidem o que mostrar pela reunião, e não pelo que está gravado: em "Não houve célula", tema, participantes, visitantes e oferta não saem para a tela, mesmo que existam.
12. **Editar por cima da consulta** (RN-16 e, P-LRE-29). É a AQ-9 da UX. Se os dois painéis não puderem ficar empilhados, vale a alternativa: fechar a consulta, abrir o formulário e reabrir a consulta depois de salvar.

## Experiência (UX)
_Seção do `ux-designer`. Escrita em 2026-11-24 a partir destas fontes:_
- _a seção Negócio (RN-01 a RN-18, P-LRE-01 a P-LRE-22, a massa de exemplo, os Textos de tela, as Telas que mudam, os Impactos, os Pontos para o `architect` e as perguntas Q-1 a Q-7);_
- _o código da `origin/main` do `mci-connect` (`4595daa`): `src/pages/CellReports.tsx`, `use-cell-reports-list.ts`, `src/lib/cell-reports/fields.ts` e `labels.ts`, `StatusBadge.tsx`, `ListPagination.tsx`, `AppSidebar.tsx`, `App.tsx`, `ui/sheet.tsx` (o "✕" embutido tem 16 px e o texto "Close"), `ui/toggle-group.tsx` (o Radix 1.1.10 marca cada item do grupo de escolha única com `role="radio"` e `aria-checked`) e o `index.html` (`lang="pt-BR"`, sem `viewport-fit=cover`);_
- _o que já foi desenhado para as mesmas telas: os filtros de Membros do [E2.07](e2-07-filtros-membros.md) (T1 a T6, P50 a P55), a lista, o detalhe e o filtro Célula do [E2.10](e2-10-listagem-celulas.md) (T1 a T7, T11, T15, P80 a P85), a situação do relatório do [E2.09](e2-09-situacao-relatorio.md) (P70 a P74), a autoria, o histórico e o período do [E2.05](e2-05-auditoria-autor.md) (T1, T4, T7, T8, P30 a P34), a consulta, as ações e as confirmações do [E2.01](e2-01-exclusao-logica.md) (T1, T2, T7, P6 a P9), o subtítulo, o "Novo relatório" e a tela sem acesso do [E2.02](e2-02-perfis-escopo.md) (T8, T12, P10) e o nível do [E2.06](e2-06-hierarquia-totais.md) (P40, P44, P45);_
- _o legado, só para manter o que os usuários conhecem: a linha com o líder, o G12 e o endereço; a data com o dia da semana; o tema ou "Não houve célula."; a oferta, os participantes e os visitantes em colunas; e os três atalhos de semana do menu (`UI/pages/Report/index.js` e `UI/components/NavMenu/index.js`)._

_Este passo só é implementado depois do E2.01, do E2.02, do E2.05, do E2.06, do E2.10 e do E2.11, então o desenho parte das telas deles, e não do código de hoje. Usa os padrões P1 a P85. Os padrões novos começam em P90, para não colidir com os outros specs. Nenhuma regra de negócio foi criada aqui. Onde a tela precisou de algo que o spec não diz, a decisão é a mais conservadora, marcada como "definido pela UX" e listada em "Pendências para o PO". Os nomes são os da [massa de exemplo](#massa-de-exemplo); os sobrenomes existem só nos wireframes, os mesmos do E2.06 ao E2.10 (Sara Campos e Lia Moura são novos), e "…" marca o que a massa não define._

### O que muda, tela a tela
Nenhuma rota nova. A `/cell-reports` ganha parâmetros na URL ([Navegação e rotas](#navegação-e-rotas)).

| Tela | O que muda | Para quem |
|---|---|---|
| Relatórios: lista (T1, T2, T9) | O título passa a "Relatórios". A busca ganha o rótulo "Buscar". Entram "Filtros ({N})", "Limpar filtros", os atalhos de semana (P90), os chips e o total em texto. A linha passa a mostrar o líder registrado e o G12, a data com o dia, o endereço, "Célula realizada" ou "Não houve célula", o tema ou o motivo, e os participantes, os visitantes e a oferta separados. Saem as "presenças" e os selos "Realizada" e "Não Realizada". Cartões até 1279 px e tabela a partir de 1280 px (P74). Toda linha abre a consulta (P91). `Skeleton`, vazio com filtros e erro com "Tentar de novo". | quem tem a lista de Relatórios |
| Atalhos de semana (T3), novo | "Esta semana", "Semana passada" e "Semana retrasada", à vista, fora do painel, em todas as larguras. Marcados quando o Período é aquela semana. | idem |
| Painel de filtros (T4 a T8) | Célula (só vinda de link), Líder, G12, Período, Tipo e Reunião: no `Sheet` abaixo de 1024 px e no painel recolhível a partir daí (P50). "Pessoa indisponível" no Líder e no G12; "Célula indisponível" na Célula. | idem |
| Consulta "Ver relatório" (T10 a T13) | O painel do E2.01 passa a abrir em toda linha, para todos que veem o relatório, com: a autoria; os participantes e os visitantes pelo nome; as pessoas registradas e o tipo; o endereço atual; "Ver célula" e "Ver todos os relatórios desta célula"; e, no rodapé, "Editar relatório" e "Excluir relatório". O link de um relatório que não abre mostra "Relatório não encontrado". | quem vê o relatório |
| Filtro Célula (T8) | O chip avulso do E2.10 (T15) passa para o painel e para a contagem. | idem |
| Detalhe da célula (T14) | Sem mudança obrigatória. Recomendação: o cabeçalho de cada um dos "Últimos relatórios" abre a mesma consulta. | quem vê a célula |
| Menu, Dashboard, formulário de relatório, lista "Excluídos" (T15) | Sem mudança visual. | — |

### Coerência com os outros specs
- **E1.08:** continuam o `useListSearchParams` (`q`, `page`, `size`), o `ListPagination`, o `useClampPage` e o `placeholderData`. Os filtros entram na mesma URL, com as regras de lá: os valores padrão ficam fora, a troca é com `replace` e mudar um filtro volta para a página 1. A ordem não muda (RN-13).
- **E2.07 e E2.10:** o painel segue o P50 a P54 e o P84, sem variação: o `Sheet` abaixo de 1024 px com "Aplicar filtros", o painel recolhível a partir daí, os chips, a contagem, "Limpar filtros" ao lado de "Filtros", o foco inicial no título do `Sheet` e o seletor de pessoas com limite e com "Pessoa indisponível". O painel lembra se ficou aberto numa chave própria de Relatórios. Mudam cinco coisas:
  - os atalhos de semana ficam fora do painel e valem na hora (P90);
  - a Célula, que não tem seletor, entra no painel como um valor removível, em primeiro lugar (P93);
  - a Reunião tem opções longas e fica uma por linha no `Sheet`, e não lado a lado como no P52 (UXD-2);
  - o Período usa os rótulos do P33 ("Período", "De" e "Até"), sem data máxima, como no P54;
  - as opções do Líder e do G12 vêm dos relatórios visíveis, com os textos de busca sem resultado do Negócio ("Nenhum líder encontrado." e "Nenhum G12 encontrado.").
- **E2.09 (P74):** a lista de Relatórios também não cabe em 720 px. Ela segue a quebra de Células: cartões até 1279 px, com duas colunas de 1024 a 1279 px, e tabela a partir de 1280 px (UXD-5). O painel continua trocando em 1024 px, como em Células.
- **E2.10 (T11):** o badge da reunião é o mesmo do detalhe da célula: "Célula realizada" (`success`, `CheckCircle2`) e "Não houve célula" (`muted`, `CalendarX`), no `StatusBadge` do P6. A oferta usa a mesma função ("R$ 50,00", "R$ 0,00" ou "Não informada"). A nota da T11 de lá fica respondida: Relatórios passa aos termos do detalhe.
- **E2.10 (P80, P81, T14):** "Ver célula" leva ao detalhe; o "Ver todos os relatórios" do detalhe abre esta lista só com a Célula. O cartão de relatório abre a consulta como o cartão de célula abre o detalhe, mas com um botão, porque a consulta é um painel, e não uma página (P91).
- **E2.05:**
  - a autoria (P30) e o "Ver histórico" (P31) ficam no topo da consulta, como a T4 de lá previa;
  - o filtro de período usa os rótulos e a mensagem do P33, mas sem o `max` (P-LRE-07). Datas futuras são aceitas.
- **E2.01:**
  - a consulta da T7 de lá (`Sheet` à direita, "Relatório de {data}", "Célula de {Líder}", o badge e o aviso da célula excluída, os participantes em ordem alfabética) vira o P92 e vale para todas as linhas. O "Editar relatório" do rodapé, que ficou para cá, entra (T13);
  - o ícone "Ver relatório" (`Eye`) na coluna Ações da tabela sai: a linha inteira abre a consulta (P91);
  - o "⋯" com "Excluir relatório" no cartão, a confirmação da T2 e a lista "Excluídos" não mudam;
  - o link `?report=` deixa de ser ignorado: um relatório que não abre mostra "Relatório não encontrado" (T12).
- **E2.02:** o subtítulo com o alcance (P10) e a regra do "Novo relatório" (T8) não mudam. Sem a lista de Relatórios, vale a tela sem acesso da T12 de lá, inclusive com o `?report=`.
- **E2.06 (P40):** as opções do Líder trazem o nível entre parênteses. A linha mostra só o nome do líder registrado, sem o nível, como o legado (RN-15).
- **E2.11:** o formulário aberto por "Editar relatório" é o mesmo da linha (P1). A consulta abre por cima dele só a partir dela (T13).
- **E2.13 e E2.14:** a exportação pode reaproveitar o módulo dos filtros. O clique dos cards e do gráfico usa os links prontos da [Navegação e rotas](#navegação-e-rotas).

### Decisões de experiência
| # | Decisão | Por quê |
|---|---|---|
| UXD-1 | **Os filtros seguem o P50, embora sejam cinco no painel, e seis com a Célula.** | O P50 vale a partir de 6 filtros, e a Célula faz o sexto. O Líder e o G12 são seletores de pessoas com dicas de duas a cinco linhas: no celular, à vista, eles empurrariam a lista para a terceira tela. Com o mesmo painel em Membros, Células e Relatórios, quem aprende um usa os outros. |
| UXD-2 | **Ordem do painel e dos chips: Célula (quando há), Líder, G12, Período, Tipo e Reunião. No `Sheet`, a Reunião fica com uma opção por linha.** *Definido pela UX (PO-UX-4 e PO-UX-5).* | Líder, G12 e Período vêm na ordem do legado. A Célula é a mais estreita e chega de outra tela: em primeiro lugar, ela diz logo de onde a lista veio, como fazia o título "Relatórios da célula" do legado. "Célula realizada" e "Não houve célula" não cabem lado a lado em 360 px: cada opção pede uns 140 px. |
| UXD-3 | **Os atalhos de semana ficam numa linha própria, logo depois de "Filtros" e "Limpar filtros" e antes dos chips, em todas as larguras. São um grupo de escolha única (`ToggleGroup`), e o atalho marcado fica preenchido. Tocar de novo no atalho marcado não o desmarca.** *Definido pela UX (PO-UX-3).* | É o uso mais frequente da liderança: um toque, sem abrir o painel (RN-10). Logo antes dos chips, o atalho fica junto dos chips "De" e "Até", que mostram as datas que ele aplicou. No 3G, quem toca de novo porque a lista demorou não pode perder o filtro sem perceber. Tirar o Período é um toque no chip ou em "Limpar filtros". |
| UXD-4 | **Os atalhos só funcionam com a data de hoje vinda do servidor. Até ela chegar, eles aparecem desabilitados, no mesmo lugar e com o mesmo tamanho.** | RN-10: o relógio e o fuso do aparelho não contam. Sem a data, a tela não sabe qual é a semana nem qual atalho marcar. Com o lugar reservado, a lista não pula quando a data chega. |
| UXD-5 | **A lista mostra cartões até 1279 px e a tabela a partir de 1280 px (P74). De 1024 a 1279 px, o cartão tem duas colunas.** | A tabela tem 7 colunas (Célula, Data e horário, Reunião, Participantes, Visitantes, Oferta e Ações). Com o espaçamento das células, ela pede cerca de 800 px. A área útil é de 720 px em 1024 px e de 976 px em 1280 px. Abaixo disso, a tabela rolaria na horizontal ou partiria os nomes letra a letra. É a mesma quebra de Células, então as duas listas mudam juntas. |
| UXD-6 | **No cartão: o líder registrado e as ações; o G12; a data com o dia e o horário; o endereço; os badges; o tema ou o motivo; e os números em linha ("Participantes: 8 · Visitantes: 2 · Oferta: R$ 50,00"). Tema e motivo mostram até 3 linhas na lista e aparecem inteiros na consulta.** *Definido pela UX (PO-UX-8).* | O líder identifica a célula, e a data identifica o relatório: com o filtro Célula, todas as linhas têm o mesmo líder e o mesmo endereço, e só a data muda. Os números em linha, com os rótulos do Negócio, cabem em duas linhas em 360 px. Um motivo longo de "Não houve célula" ocuparia meia tela; as 3 linhas bastam para reconhecer o relatório, e a consulta, a um toque, mostra o resto. |
| UXD-7 | **A linha inteira abre a consulta: no cartão, um botão esticado sobre o cartão, com o `ChevronRight`; na tabela, o nome do líder é o botão, e o clique na linha é um atalho do mouse (P91). O ícone `Eye` do E2.01 sai.** | É o gesto do cartão de Células (P81), que as pessoas já aprendem lá. Um botão "Ver relatório" a mais em cada cartão custaria 44 px por relatório. Na tabela, um quarto ícone na coluna Ações não caberia em 1280 px, e o nome é o que a pessoa procura com os olhos. |
| UXD-8 | **A consulta é um `Sheet` à direita: tela cheia no celular e 512 px a partir de 640 px. O cabeçalho (título e "✕") e o rodapé (ações do relatório) ficam fixos, e o corpo rola. No corpo, o conteúdo do relatório vem primeiro (data, tema, participantes, visitantes, oferta, motivo e observações), e as pessoas da célula e o endereço vêm depois.** *Definido pela UX (PO-UX-1).* | A história da consulta é "ver quem participou e quem visitou". No celular, com as pessoas da célula e o endereço antes, os participantes começariam na segunda tela. A data, a célula e a reunião já estão no topo, em uma linha cada. O painel à direita é o do E2.01 e o da Auditoria. |
| UXD-9 | **Na consulta, "Ver célula" e "Ver todos os relatórios desta célula" são links no corpo, na seção "Endereço da célula". "Editar relatório" fica no rodapé fixo. "Excluir relatório" fica no "⋯" do rodapé abaixo de 768 px e vira um botão com texto a partir daí. Quando "Excluir relatório" é a única ação, ele aparece como botão com texto também no celular.** *Definido pela UX (PO-UX-6).* | Os links levam a outras telas e são sobre a célula; as ações mudam o relatório. Separados, um toque errado não exclui nada (P8). Quem não edita nem exclui (Caio, Lia) não tem rodapé e ganha espaço para ler. Um "⋯" sozinho no rodapé esconderia a única ação sem motivo, e a confirmação do E2.01 continua protegendo. |
| UXD-10 | **"Editar relatório" abre o formulário por cima da consulta. Ao salvar, o formulário fecha e a consulta mostra os valores novos, com o foco em "Editar relatório". Ao cancelar, a consulta volta igual.** *Definido pela UX (PO-UX-7).* | RN-16 (e): depois de editar, a consulta mostra os valores novos. Fechar a consulta e reabri-la depois do formulário faria a pessoa perder o ponto de leitura. No celular, o formulário é de tela cheia (P1) e cobre a consulta; fechá-lo devolve a pessoa ao que ela estava lendo. |
| UXD-11 | **A consulta aberta fica no endereço (`?report=`) e cria uma entrada no histórico. O voltar do aparelho ou do navegador fecha a consulta e devolve a lista como estava.** | No celular, a consulta em tela cheia parece uma página. No Android, o voltar é o gesto natural para sair dela; sem a entrada no histórico, ele tiraria a pessoa de Relatórios. |
| UXD-12 | **A dica de "Pessoas da célula" diz exatamente o que é do dia do envio: "Líder, timóteo, anfitrião e tipo como estavam no envio. O G12 é o de hoje." Ela aparece sempre, como a dica do Tipo no filtro.** *Definido pela UX (PO-UX-2); "sempre" pelo PO, porque todo relatório tem o retrato (RN-21 do E2.11).* | O G12 não é do retrato: é o G12 atual do líder registrado (RN-06). A dica do Negócio ("Como estavam quando o relatório foi enviado.") seria falsa para o G12 de um líder que mudou de ramo. |
| UXD-13 | **Os participantes e os visitantes aparecem todos, em colunas que se ajustam à largura (P94).** | RN-17: sem corte. R10 tem 40 participantes. Uma coluna só ocuparia quase 1.000 px no celular; duas colunas, em ordem alfabética de cima para baixo, cortam isso pela metade e continuam fáceis de ler. Com zoom ou fonte grande, as colunas viram uma só. |
| UXD-14 | **O título passa a "Relatórios", o nome do menu, e o botão a "Novo relatório".** *Definido pela UX (PO-UX-9).* | "Relatórios de Células" não bate com o menu, e as outras listas usam o nome do menu ("Membros", "Células"). O título não muda com o filtro (P-LCE-32). "Novo relatório" já é o texto do E2.02 (T8) e segue a caixa de frase de "Nova célula" (E2.08). |
| UXD-15 | **Na lista, a data usa o dia abreviado do Negócio ("Qua, 18/11/2026 · 20:00"), e o leitor de tela ouve o dia inteiro ("Quarta"). Na consulta, o dia vem por extenso ("Quarta, 18/11/2026 às 20:00").** | É o texto do critério da RN-15. Na tabela, a forma curta economiza uns 25 px na coluna da data. O leitor de tela leria "Qua" como uma sílaba. Ver a PO-UX-10. |

### Navegação e rotas
- **Nenhuma rota nova.** A `/cell-reports` guarda os filtros na URL, junto com `q`, `page`, `size` e o `report` da consulta. Os nomes são sugestões (AQ-1):

  | Filtro | Parâmetro | Valores |
  |---|---|---|
  | Célula | `cell` | um id (E2.10) |
  | Líder | `leaders` | até 10 ids, separados por vírgula, na ordem da escolha |
  | G12 | `g12` | até 10 ids, separados por vírgula, na ordem da escolha |
  | Período | `from` / `to` | `aaaa-mm-dd`, datas de Brasília |
  | Tipo | `type` | `evangelistic`, `discipleship` e `macrocell`, separados por vírgula (os mesmos de Células) |
  | Reunião | `held` | `yes` (Célula realizada) ou `no` (Não houve célula) |
  | Consulta | `report` | um id (E2.01) |

- **Valores padrão, repetidos e inválidos:** como na Navegação e rotas do E2.07 e do E2.10.
  - "Todas", "Todos" e vazio não aparecem.
  - Nos filtros de múltipla escolha, a ordem é a das opções, menos em `leaders` e `g12`, que guardam a ordem da escolha.
  - Um valor inválido (opção desconhecida, data que não existe, id sem formato de id) sai da URL na primeira leitura e não conta.
  - Um id com formato válido de uma pessoa ou de uma célula que não abre fica na URL e aparece como "Pessoa indisponível" ou "Célula indisponível".
  - Acima de 10 ids, valem os 10 primeiros, os outros saem, e aparece "Escolha até 10 pessoas.".
  - Datas válidas, mas invertidas, vindas de um link: ficam na URL, não são aplicadas e não contam, como a DA-7 do E2.10. Ao abrir o painel, a mensagem aparece embaixo de "Até".
- **Atalhos (P90):** não têm parâmetro. O toque grava `from` e `to` com o domingo e o sábado da semana, tira `page` e mantém o resto, com `replace`, como qualquer filtro.
- **"Limpar filtros":** tira `cell`, `leaders`, `g12`, `from`, `to`, `type`, `held`, `q` e `page`. Mantém `size`.
- **Consulta (UXD-11):**
  - abrir pela linha acrescenta `report=<id>` **com uma entrada nova no histórico** (`push`);
  - o voltar do aparelho ou do navegador fecha a consulta;
  - o "✕", o `Esc` e o toque fora fecham a consulta e tiram o `report`. Quando a consulta foi aberta pela linha, isso volta uma entrada no histórico; quando veio por link, tira o parâmetro com `replace`;
  - recarregar a página reabre a consulta sobre a lista com os filtros do endereço;
  - um `report` sem formato de id sai da URL, e a lista abre sem consulta.
- **Saídas da consulta,** todas com uma entrada nova no histórico. O voltar devolve a lista com a consulta aberta:
  - "Ver todos os relatórios desta célula": `/cell-reports?cell=<id>`, sem outro filtro, sem busca e na página 1 (RN-08). Mantém o `size`;
  - "Ver célula": `/cells/<id>` (E2.10);
  - "Ver histórico": `/events?record_type=cell_report&record_id=<id>` (P31).
- **Painel aberto ou fechado (computador):** no `localStorage`, numa chave de Relatórios, separada das de Membros e de Células.
- **Menu:** o item "Relatórios" continua abrindo `/cell-reports`, sem parâmetros (RN-10).
- **Links prontos (RN-18, para o E2.14),** com as datas do domingo e do sábado da semana atual:
  - Relatórios enviados e visitantes da semana: `/cell-reports?from=2026-11-22&to=2026-11-28`;
  - gráfico da semana: o mesmo, mais `&held=yes` (células realizadas) ou `&held=no` (não houve célula).

### Fluxos
Contagem no celular, a partir de qualquer tela com o menu fechado, incluindo o toque no ☰, salvo quando a linha diz outra coisa. "Toque" não conta a digitação nem a rolagem. Num seletor, abrir e escolher são 2 toques.

| # | História | Caminho | Toques e telas |
|---|---|---|---|
| F1 | A liderança abre os relatórios desta semana (Pedro) | ☰ → Relatórios → "Esta semana" → R9 | 3 toques; 1 tela. No legado, também 3 (☰ → Células → "Relatórios desta semana"), mas só para administradores. |
| F2 | A semana passada ou a retrasada | F1 → "Semana passada" | +1 toque |
| F3 | O G12 filtra um período qualquer (Pedro) | ☰ → Relatórios → "Filtros" → De (seletor nativo) → Até (seletor nativo) → "Aplicar filtros" | cerca de 8 toques, contando a confirmação dos seletores de data; 1 tela e 1 painel |
| F4 | O líder acompanha dois discípulos (Pedro, com André e Paula) | ☰ → Relatórios → "Filtros" → Líder → André Souza → Paula Alves → "Aplicar filtros" | 7 toques. O menu do seletor fica aberto entre as escolhas. |
| F5 | A liderança vê por que as células não se reuniram (Rita) | ☰ → Relatórios → "Semana retrasada" → "Filtros" → "Não houve célula" → "Aplicar filtros" → R2 | 6 toques |
| F6 | Quem é da célula vê quem participou e quem visitou (Caio) | ☰ → Relatórios → toque no cartão de R1 → consulta | 3 toques. Hoje Caio não tem como ver os nomes. |
| F7 | Da consulta para os relatórios da mesma célula | consulta → "Ver todos os relatórios desta célula" | 1 toque e a rolagem até a seção "Endereço da célula" |
| F8 | Da consulta para o detalhe da célula | consulta → "Ver célula" | 1 toque e a rolagem |
| F9 | Corrigir um relatório pela consulta (Pedro) | consulta → "Editar relatório" → altera → "Salvar" → a consulta com os valores novos | 2 toques e a alteração |
| F10 | Excluir um relatório pela consulta (Pedro, R4) | consulta → "⋯" → "Excluir relatório" → "Excluir relatório" → a lista sem R4 | 3 toques |
| F11 | Fechar a consulta | voltar do aparelho, ou "✕" | 1 toque; a lista volta como estava, com o foco no cartão aberto |
| F12 | Abrir o link de um relatório que não vê (Pedro, R8) | link → "Relatório não encontrado" → "Fechar" | 1 toque |
| F13 | Tirar o Período, um filtro ou todos | "✕" no chip "De" e no chip "Até", ou "Limpar filtros" | 2 toques, ou 1 |
| F14 | Do detalhe da célula para a semana passada dela (Pedro, C1) | detalhe → "Ver todos os relatórios" → "Semana passada" → R1 | 2 toques |
| F15 | A secretaria confere os relatórios de Discipulado da semana passada (Rita, computador) | Relatórios → "Semana passada" → "Filtros" (se o painel estiver fechado) → Tipo → "Discipulado"; a lista muda a cada clique | 5 cliques |
| F16 | Abrir a lista por um link (compartilhado, ou o card do Dashboard no E2.14) | toque no link → a lista com o atalho marcado, os chips e o total | 1 toque |
| F17 | Link com uma pessoa que quem abre não vê (Pedro, Líder: Débora) | link → "Líder: Pessoa indisponível", a dica e a lista vazia → "✕" ou "Limpar filtros" | 2 toques |

### Telas
As convenções dos wireframes são as do E2.07 e do E2.10:
- 360 px ≈ 38 colunas;
- `[Botão]` é botão, e `[▾]` é seleção;
- `( )` e `(•)` são as opções de escolha única, e `[ ]` e `[x]` são caixas de seleção;
- `(… ✕)` é um chip removível ou uma pessoa escolhida;
- `(i)` é informação, e `⚠` é erro;
- `⌕` é o ícone `Search`, `⚲` é o `SlidersHorizontal`, e `⌄` e `⌃` são o painel fechado e aberto;
- `[✎]` é "Editar", `[⋯]` é o menu de ações, `[⌫]` é "Excluir" na tabela, e `›` é o `ChevronRight`;
- nos badges: `✓` é o `CheckCircle2` ("Célula realizada"), `⊘` é o `CalendarX` ("Não houve célula", como no E2.10) e `⦸` é o `Ban` ("Célula excluída", E2.01); `⟲` é o `History`, e `→` é o `ArrowRight`;
- `═` é a borda de um rodapé fixo, e `▒` é um `Skeleton`.

Novo: `⟦…⟧` é o atalho de semana marcado (preenchido, P90).

A margem lateral é a do `AppLayout` (`p-4` no celular). "Hoje" é terça, 24/11/2026, às 21:00 de Brasília, como no Negócio.

#### T1. Relatórios: lista no celular (cartões)
360 px, com Rita, depois de tocar em "Semana passada" (critério da RN-10). A busca, os atalhos, os filtros e a lista ficam dentro do `Card` da lista, como hoje.
```
┌──────────────────────────────────────┐
│ ☰                                    │
│ Relatórios                           │  h1 (UXD-14)
│ Relatórios das células de toda a     │  subtítulo (P10)
│ igreja                               │
│ [+ Novo relatório                  ] │  E2.02 (T8)
│──────────────────────────────────────│
│ Buscar                               │
│ [⌕ Líder ou tema                   ] │  h-11
│ [⚲ Filtros (1)] [Limpar filtros]     │  outline e ghost, h-11
│ [  Esta    ]⟦  Semana  ⟧[  Semana  ] │  atalhos (P90, T3): "Semana
│ [  semana  ]⟦  passada ⟧[ retrasada] │  passada" marcada
│ (De: 15/11/2026 ✕)                   │  chips, h-9
│ (Até: 21/11/2026 ✕)                  │
│ 2 relatórios                         │  role="status"
│──────────────────────────────────────│
│ Jonas Prado                     [⋯]  │  R6: sem "Editar" (célula
│ G12: Pedro Alves                     │  excluída); o "⋯" fica no
│ Sex, 20/11/2026 · 20:00              │  mesmo lugar (P65)
│ …                                    │  endereço atual de C5
│ [⦸ Célula excluída]                  │
│ [✓ Célula realizada]                 │
│ Tema: Gratidão                       │
│ Participantes: 6 · Visitantes: 1 ·   │  quebra no "·"
│ Oferta: R$ 30,00                   › │
├──────────────────────────────────────┤
│ André Souza                [✎]  [⋯]  │  R1. O cartão inteiro abre a
│ G12: Pedro Alves                     │  consulta (P91); as ações
│ Qua, 18/11/2026 · 20:00              │  ficam por cima
│ Rua das Flores, 100 · Centro         │
│ [✓ Célula realizada]                 │
│ Tema: A fé que vence                 │
│ Participantes: 8 · Visitantes: 2 ·   │
│ Oferta: R$ 50,00                   › │  ChevronRight, aria-hidden
│──────────────────────────────────────│
│ 2 relatórios                         │  ListPagination (E1.08)
│ [25▾] por página                     │
│ [«][‹] Página 1 de 1 [›][»]          │
└──────────────────────────────────────┘
```
Relatório de "Não houve célula" (R2) e relatório de pastor (R10), em cartões:
```
┌──────────────────────────────────────┐
│ André Souza                [✎]  [⋯]  │
│ G12: Pedro Alves                     │
│ Qua, 11/11/2026 · 20:00              │  data prevista da reunião
│ Rua das Flores, 100 · Centro         │
│ [⊘ Não houve célula]                 │
│ Motivo: Chuva forte no bairro      › │  sem números nem oferta
├──────────────────────────────────────┤
│ Samuel Colares             [✎]  [⋯]  │
│ G12: Pastores                        │
│ Dom, 22/11/2026 · 18:00              │
│ …                                    │
│ [✓ Célula realizada]                 │
│ Tema: Visão                          │
│ Participantes: 40 · Visitantes: 5 ·  │
│ Oferta: R$ 300,00                  › │
└──────────────────────────────────────┘
```
- **Cabeçalho:** o `h1` "Relatórios" (UXD-14), o subtítulo do E2.02 (P10), "Excluídos" (E2.01, só para quem restaura) e "Novo relatório" (E2.02, T8). No celular, "Novo relatório" tem a largura toda e `h-11`, como hoje.
- **Busca:** como a T1 do E2.07, com o rótulo "Buscar" visível e o placeholder do Negócio ("Líder ou tema"), `type="search"`, `enterKeyHint="search"`, `maxLength={100}` e `h-11` no celular. O `aria-label="Buscar relatórios"` de hoje sai, porque o rótulo visível já dá o nome.
- **"Filtros ({N})" e "Limpar filtros":** como a T1 do E2.07, com N de 1 a 6 (RN-12).
- **Atalhos:** a T3, numa linha própria logo depois de "Filtros" (UXD-3).
- **Chips:** um por valor, na ordem da UXD-2, sempre que os campos não estão à vista: sempre abaixo de 1024 px; a partir daí, só com o painel fechado. O atalho não vira chip: o Período que ele aplicou vira os chips "De" e "Até", como qualquer Período (RN-12).
- **Total:** "{N} relatórios" ou "1 relatório" (`formatCount`), acima da lista, com `role="status"`, e também no `ListPagination`. Enquanto a nova consulta carrega, o total anterior continua.
- **Cartão (UXD-6):** um `li` com `relative rounded-none px-4 py-4`, separado por `divide-y`, nesta ordem:
  1. o nome do líder registrado, em `font-semibold`, e as ações à direita (`[✎]` e `[⋯]`, 44×44 px, 8 px entre si, alinhadas pelo fim, P65). O nome quebra linha, sem `truncate`;
  2. "G12: {Nome}", "G12: Pastores" ou "G12: —", em `text-sm text-muted-foreground`. O "—" é lido como "nenhum" (`sr-only`);
  3. "{Dia abreviado}, {dd/mm/aaaa} · {HH:mm}", em `text-sm text-foreground`. O dia abreviado fica `aria-hidden`, com o dia inteiro em `sr-only` (UXD-15), e o "·" também fica `aria-hidden`;
  4. o endereço atual da célula ("{Rua}, {Número} · {Bairro}", com "s/n" sem número), ou "Sem endereço", em `text-sm text-muted-foreground`;
  5. os badges, num `flex flex-wrap gap-2`: "Célula excluída" (E2.01), quando for o caso, e o badge da reunião (T11 do E2.10);
  6. "Tema: {tema}" ou "Motivo: {motivo}", em `text-sm`, com o rótulo em `text-muted-foreground`, até 3 linhas (`line-clamp-3`). O texto inteiro fica no DOM, e o leitor de tela lê tudo;
  7. só na célula realizada: "Participantes: {N}", "Visitantes: {N}" e "Oferta: {valor}", cada um uma unidade com `whitespace-nowrap`, separados por "·" (`aria-hidden`), num `flex flex-wrap gap-x-2`. O rótulo fica em `text-muted-foreground`, e o valor em `font-medium tabular-nums`. A oferta segue o E2.10: "R$ 50,00", "R$ 0,00" ou "Não informada";
  8. o `ChevronRight` (`aria-hidden`) no fim da última linha, alinhado à direita.
- **O que sai:** a soma "presenças", o selo "Realizada", o selo "Não Realizada" (com o vermelho de hoje) e o "Célula sem líder".
- **Abrir a consulta (P91, UXD-7):** a T10 e a T13.
- Componentes: `Card`, `Input`, `Button`, `ToggleGroup`, `StatusBadge`, `Skeleton`, `Alert`, `DropdownMenu` (o `RowActionsMenu` de hoje) e `ListPagination`.

#### T2. Relatórios: tabela (a partir de 1280 px) e cartões em duas colunas (de 1024 a 1279 px)
Em 1280 px, com Rita, sem filtros e com o painel fechado. A ordem é a da RN-13:
```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Relatórios                                                                        [Excluídos] [+ Novo relatório] │
│ Relatórios das células de toda a igreja                                                                          │
│──────────────────────────────────────────────────────────────────────────────────────────────────────────────────│
│ Buscar                                                                                                           │
│ [⌕ Líder ou tema                      ]  [⚲ Filtros ⌄]                                                           │
│ [Esta semana] [Semana passada] [Semana retrasada]                                                                │  nenhum marcado
│ 8 relatórios                                                                                                     │  role="status"
│ Célula               │ Data e horário  │ Reunião              │ Participantes │ Visitantes │ Oferta    │ Ações   │
│ Paula Alves          │ Seg, 23/11/2026 │ [✓ Célula realizada] │             7 │          3 │  R$ 40,00 │ [✎] [⌫] │
│ G12: Paula Alves     │ 20:00           │ Tema: Amizade        │               │            │           │         │
│ Sem endereço         │                 │                      │               │            │           │         │
│ Samuel Colares       │ Dom, 22/11/2026 │ [✓ Célula realizada] │            40 │          5 │ R$ 300,00 │ [✎] [⌫] │
│ G12: Pastores        │ 18:00           │ Tema: Visão          │               │            │           │         │
│ …                    │                 │                      │               │            │           │         │
│ Jonas Prado          │ Sex, 20/11/2026 │ [✓ Célula realizada] │             6 │          1 │  R$ 30,00 │     [⌫] │  sem "Editar"
│ G12: Pedro Alves     │ 20:00           │ Tema: Gratidão       │               │            │           │         │
│ [⦸ Célula excluída]  │                 │                      │               │            │           │         │
│ …                    │                 │                      │               │            │           │         │
│ André Souza          │ Qua, 11/11/2026 │ [⊘ Não houve célula] │             — │          — │         — │ [✎] [⌫] │  R2
│ G12: Pedro Alves     │ 20:00           │ Motivo: Chuva forte  │               │            │           │         │
│ Rua das Flores, 100  │                 │ no bairro            │               │            │           │         │
│ · Centro             │                 │                      │               │            │           │         │
│──────────────────────────────────────────────────────────────────────────────────────────────────────────────────│
│ 8 relatórios                                                       [25▾] por página  [«][‹] Página 1 de 1 [›][»] │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```
De 1024 a 1279 px (P74), o mesmo cartão do celular, com o corpo em duas colunas e o mesmo DOM:
```
┌──────────────────────────────────────────────────────────────────────────┐
│ André Souza                                                  [✎]  [⋯]    │
│ G12: Pedro Alves                     [✓ Célula realizada]                │
│ Qua, 18/11/2026 · 20:00              Tema: A fé que vence                │
│ Rua das Flores, 100 · Centro         Participantes: 8 · Visitantes: 2 ·  │
│                                      Oferta: R$ 50,00                  › │
└──────────────────────────────────────────────────────────────────────────┘
```
- **Troca (UXD-5, P74):** cartões até 1279 px e tabela a partir de 1280 px (`xl`), com o layout certo já no primeiro render (`matchMedia` no valor inicial do `useState`, ou só CSS com `xl:hidden` e `hidden xl:block`). O `useIsMobile` de hoje, que troca em 768 px, sai desta tela.
- **Duas colunas (1024 a 1279 px):** o nome e as ações ocupam a primeira linha inteira. Embaixo, `lg:grid lg:grid-cols-2 lg:gap-x-8`: à esquerda, o G12, a data e o endereço; à direita, os badges, o tema ou o motivo e os números. A ordem do DOM é a do celular. Nas ações, o "⋯" continua com "Excluir relatório" até 1279 px (P74).
- **Colunas da tabela:**
  - **Célula:** o nome do líder registrado, que é o botão da consulta (P91), em `font-medium hover:underline`; embaixo, o G12, o badge "Célula excluída", quando for o caso, e o endereço, em `text-sm text-muted-foreground`;
  - **Data e horário:** "{Dia abreviado}, {dd/mm/aaaa}" e, embaixo, "{HH:mm}" (UXD-15);
  - **Reunião:** o badge e, embaixo, "Tema: …" ou "Motivo: …", até 3 linhas;
  - **Participantes, Visitantes e Oferta:** à direita, com `tabular-nums`. Em "Não houve célula", "—" (`aria-hidden`), com "não se aplica" em `sr-only`, como na T11 do E2.10;
  - **Ações:** "Editar" (`[✎]`) e "Excluir" (`[⌫]`), com os rótulos e as regras de hoje (E2.01). "Editar" some na célula excluída sem deslocar "Excluir" (P65). Sem as duas permissões, a coluna some.
- **Largura:** as células usam `px-3`, e não o `p-4` do componente, pela `className`. Em 1280 px, com nomes de 40 caracteres e endereço de 50, a tabela cabe sem rolar na horizontal: os nomes, o endereço, o tema e o motivo quebram linha.
- **Legenda:** "Relatórios, do mais recente para o mais antigo." †, em `caption` com `sr-only`. Nenhuma coluna tem `aria-sort`, porque a ordem é a da data e não muda.
- **Clique na linha (P91):** abre a consulta, menos nos botões de ação (`cursor-pointer`). Pelo teclado, só o nome recebe o foco.
- Componentes: `Table`, `Button`, `StatusBadge` e `ListPagination`.

#### T3. Atalhos de semana (P90)
360 px. Os três atalhos numa grade que se ajusta à largura:
```
Sem Período, ou com um Período que não   "Esta semana" marcada
é uma das três semanas
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ [  Esta    ][  Semana  ][  Semana  ] │ │ ⟦  Esta    ⟧[  Semana  ][  Semana  ] │
│ [  semana  ][  passada ][ retrasada] │ │ ⟦  semana  ⟧[  passada ][ retrasada] │
└──────────────────────────────────────┘ └──────────────────────────────────────┘

Esperando a data do servidor             Em 320 px com zoom de 200% (ou fonte grande)
┌──────────────────────────────────────┐ ┌──────────────────────┐
│ [  Esta    ][  Semana  ][  Semana  ] │ │ [Esta semana       ] │  uma por linha
│ [  semana  ][  passada ][ retrasada] │ │ [Semana passada    ] │
└──────────────────────────────────────┘ │ [Semana retrasada  ] │
  desabilitados, opacity-50, sem marca   └──────────────────────┘
```
- **Estrutura:** `ToggleGroup type="single"` (Radix: cada item é `role="radio"` com `aria-checked`, e o grupo tem uma parada só de Tab, com as setas entre os itens), com `aria-label="Atalhos de semana"` †. O `onValueChange` ignora o valor vazio: tocar no atalho marcado não o desmarca (UXD-3).
- **Grade:** `grid grid-cols-[repeat(auto-fit,minmax(5.5rem,1fr))] gap-2` até 639 px. Em 360 px, são três colunas de cerca de 104 px, e "Semana passada" e "Semana retrasada" quebram em duas linhas dentro do botão. Quando 5,5 rem não cabem três vezes (320 px com zoom, fonte grande), a grade passa a duas ou a uma coluna sozinha, sem rolar na horizontal. A partir de 640 px, `sm:flex sm:flex-wrap`, com a largura do texto.
- **Botão:** `variant="outline"`, `h-auto min-h-11 whitespace-normal px-2 py-1 text-sm leading-tight`.
  - **Marcado:** `bg-primary text-primary-foreground border-primary font-semibold`. A diferença entre o marcado e o não marcado é de preenchimento e de peso, e não só de cor: funciona em escala de cinza. O estado também está no `aria-checked`.
  - **Nome acessível:** o texto do atalho com as datas: "Esta semana, de 22/11/2026 a 28/11/2026" (com `aria-label` que começa pelo texto visível, WCAG 2.5.3).
- **O toque (RN-10):** grava o domingo e o sábado da semana em "De" e "Até", mantém os outros filtros e a busca, volta para a página 1 e vale na hora, também no celular, sem "Aplicar filtros". O foco fica no atalho. O leitor de tela ouve o total novo (`role="status"`).
- **Marcado ou não:** o atalho aparece marcado quando o Período aplicado é exatamente o domingo e o sábado daquela semana, venha ele do atalho, das datas digitadas ou de um link.
  - **Quando não coincide** (só "De", só "Até", um intervalo que não é uma semana inteira, outra semana, ou datas invertidas que não foram aplicadas), nenhum atalho fica marcado. O Período continua valendo e aparece nos chips "De" e "Até" e no painel. O primeiro toque num atalho troca esse Período pela semana.
  - **Link de uma semana que já passou:** a marcação segue a data de hoje. As datas de 22/11 a 28/11, abertas em 01/12, marcam "Semana passada"; abertas em 15/12, não marcam nenhum.
  - **Virada da semana com a tela aberta:** a marcação muda na leitura seguinte da data do servidor (ao voltar para a aba, por exemplo). O Período aplicado não muda sozinho.
  - **Desmarcar:** o "✕" no chip "De" ou "Até", "Limpar filtros", ou uma data diferente no painel.
- **Data do servidor (UXD-4, AQ-2):** enquanto ela não chega, os três atalhos aparecem desabilitados (`disabled`, `opacity-50`), no mesmo lugar e com a mesma altura, sem marca, e o grupo tem `aria-busy="true"`. Se a leitura falhar, eles continuam desabilitados, e a lista funciona normalmente. A próxima leitura (ao voltar para a aba, ou ao recarregar) os habilita. O relógio do aparelho nunca é usado, nem como reserva.
- Componentes: `ToggleGroup` e `ToggleGroupItem` (já em `src/components/ui`).

#### T4. Painel de filtros no celular e no tablet (`Sheet`)
360 px, com Pedro, depois de "Ver todos os relatórios" no detalhe de C1 e de "Semana passada", com Tipo: Evangelística marcado e ainda não aplicado:
```
┌──────────────────────────────────────┐
│ Filtros                          [✕] │  SheetTitle, recebe o foco
│──────────────────────────────────────│
│ Célula                               │  só com o filtro vindo de link
│ (Célula de André Souza · Quarta ·    │  (P93); o ✕ tira ao aplicar
│  20:00 ✕)                            │
│ Líder                                │
│ [Escolha uma ou mais pessoas      ▾] │  PaginatedSelect múltiplo (T6)
│ Mostra os relatórios em que a pessoa │  dica do Negócio
│ escolhida era a líder da célula.     │
│ G12                                  │
│ [Escolha uma ou mais pessoas      ▾] │
│ Mostra os relatórios das células do  │
│ ministério de cada pessoa escolhida, │
│ inclusive os da célula dela. Para o  │
│ ministério de um casal, escolha os   │
│ dois.                                │
│ Período                              │  legend
│ De                                   │
│ [15/11/2026                        ] │  type="date", h-11 (T7)
│ Até                                  │
│ [21/11/2026                        ] │
│ Tipo                                 │  legend
│ Pelo tipo que a célula tinha quando  │  dica do Negócio, sempre
│ o relatório foi enviado.             │  (UXD-12, PO-UX-2)
│ [x] Evangelística  [ ] Discipulado   │  Checkbox, min-h-11 (P51)
│ [ ] Macrocélula                      │
│ Reunião                              │  legend
│ (•) Todas                            │  RadioGroup, uma por linha,
│ ( ) Célula realizada                 │  min-h-11 (UXD-2)
│ ( ) Não houve célula                 │
│──────────────────────────────────────│
│ [Limpar         ] [Aplicar filtros ] │  rodapé fixo, h-11
└──────────────────────────────────────┘
```
- **Contêiner, rodapé, aplicação, fechar, "Limpar" e foco inicial:** como a T2 do E2.07, sem mudança. "Aplicar filtros" confere as datas (T7), aplica tudo de uma vez, fecha o painel, volta para a página 1 e devolve o foco a "Filtros". "✕", `Esc`, o toque fora e o gesto de voltar fecham sem aplicar. "Limpar" esvazia todos os campos, inclusive a Célula, sem aplicar e sem mexer na busca.
- **O "✕" do `Sheet`:** 44×44 px, com o nome "Fechar". O botão embutido do `sheet.tsx` (16 px, com o texto "Close") fica escondido pela `className` do `SheetContent`, sem editar o arquivo de `ui/` (AQ-13).
- **Célula (P93, T8):** só aparece quando o filtro está aplicado. O chip tem o "✕" ("Remover filtro Célula de …"). No `Sheet`, o "✕" tira a Célula do que vai ser aplicado: o bloco some, e o foco vai para o campo do Líder. Ela só sai da lista em "Aplicar filtros". Fechar sem aplicar a mantém.
- **Líder e G12:** o `PaginatedSelect` múltiplo da T6, cada um com a dica do Negócio embaixo.
- **Período:** a T7, com a legenda "Período" visível.
- **Tipo (P51):** caixas de seleção num `fieldset` com `legend`, em linha, com quebra (`flex flex-wrap gap-x-4 gap-y-2`). A dica fica logo abaixo da `legend`, ligada ao grupo por `aria-describedby`.
- **Reunião (P52, UXD-2):** `RadioGroup` num `fieldset` com `legend`, com "Todas", "Célula realizada" e "Não houve célula", uma por linha. Cada opção é um `Label` com o rádio, de pelo menos 44 px de altura, que responde ao toque na linha inteira. "Todas" vem marcada.
- **Altura:** em 360×800, o corpo rola cerca de uma tela e meia com a Célula, e o rodapé fica sempre à vista. Os campos não se agrupam em seções que abrem e fecham, como em Membros e em Células.
- Componentes: `Sheet`, `PaginatedSelect`, `Input`, `Checkbox`, `RadioGroup`, `Label`, `Button` e o `RecordFilterChip` do E2.10.

#### T5. Painel de filtros no computador (a partir de 1024 px)
Painel aberto, com Rita, depois de escolher Líder: André Souza e Débora Lins, "Semana passada", Tipo: Evangelística e Reunião: Célula realizada:
```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Buscar                                                                                       │
│ [⌕ Líder ou tema                      ]  [⚲ Filtros (4) ⌃]  [Limpar filtros]                 │  sem chips
│ [Esta semana] ⟦Semana passada⟧ [Semana retrasada]                                            │
│ Líder                                          G12                                           │  lg:grid-cols-4
│ [(André Souza ✕) (Débora Lins ✕)           ▾]  [Escolha uma ou mais pessoas              ▾]  │
│ Mostra os relatórios em que a pessoa           Mostra os relatórios das células do           │
│ escolhida era a líder da célula.               ministério de cada pessoa escolhida,          │
│                                                inclusive os da célula dela. Para o           │
│                                                ministério de um casal, escolha os dois.      │
│ Período                                        Tipo                   Reunião                │
│ De                      Até                    [Evangelística     ▾]  [Célula realizada  ▾]  │
│ [15/11/2026          ]  [21/11/2026        ]   Popover (P51)          Select (P52)           │
│ 1 relatório                                                                                  │  role="status": R1
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```
- **Painel, aplicação e chips:** como a T3 do E2.07 (P50). O painel começa fechado e lembra, neste navegador, o último estado, numa chave de Relatórios. Cada mudança vale na hora; as datas, depois de conferidas (T7). Com o painel aberto, os chips não aparecem.
- **Atalhos:** ficam entre a linha de "Filtros" e o painel, fora dele, também com o painel aberto. Tocar num atalho atualiza "De" e "Até" no painel.
- **Grade (`lg:grid-cols-4 gap-4`), na ordem da UXD-2:**
  - Célula, quando há: o rótulo e o chip, em 2 colunas, numa linha só para ela;
  - Líder (2 colunas) e G12 (2 colunas), cada um com a dica embaixo;
  - Período (2 colunas, "De" e "Até" lado a lado), Tipo e Reunião.

  Em 1024 px, cada coluna tem cerca de 156 px, e nada rola na horizontal.
- **Célula no painel:** o "✕" tira a Célula na hora. O bloco some, e o foco vai para o campo do Líder.
- **Tipo (P51):** o botão com a aparência do `SelectTrigger` mostra "Todos" sem escolha, ou as opções escolhidas separadas por vírgula, com quebra de linha. O `Popover` tem a dica do Tipo no topo (UXD-12) e as caixas, uma por linha.
- **Reunião (P52):** `Select`, com "Todas" no início.
- Componentes: `Collapsible`, `Select`, `Popover`, `Checkbox`, `Label`, `Input`, `PaginatedSelect` e `RecordFilterChip`.

#### T6. Líder e G12: seletor, limite e pessoa indisponível
Rita abre o Líder e depois o G12, sem digitar (critérios da RN-05 e da RN-06):
```
Líder, menu aberto                       G12, menu aberto
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Líder                                │ │ G12                                  │
│ [Escolha uma ou mais pessoas      ▴] │ │ [Escolha uma ou mais pessoas      ▴] │
│ ┌──────────────────────────────────┐ │ │ ┌──────────────────────────────────┐ │
│ │ André Souza (144)                │ │ │ │ Paula Alves                      │ │
│ │ Débora Lins (1.728)              │ │ │ │ Pedro Alves                      │ │
│ │ Fábio Lima (1.728)               │ │ │ │ Tânia Rocha                      │ │
│ │ Jonas Prado (Nível 5)            │ │ │ └──────────────────────────────────┘ │
│ │ Paula Alves (G12)                │ │ │ Mostra os relatórios das células do  │
│ │ Samuel Colares (Pastor)          │ │ │ ministério de cada pessoa escolhida, │
│ └──────────────────────────────────┘ │ │ inclusive os da célula dela. …       │
│ Mostra os relatórios em que a pessoa │ └──────────────────────────────────────┘
│ escolhida era a líder da célula.     │
└──────────────────────────────────────┘
```
Na lista, com Pedro, depois de abrir um link com Líder: Débora e André (critério da RN-07):
```
┌──────────────────────────────────────┐
│ Buscar                               │
│ [⌕ Líder ou tema                   ] │
│ [⚲ Filtros (1)] [Limpar filtros]     │
│ [  Esta    ][  Semana  ][  Semana  ] │
│ [  semana  ][  passada ][ retrasada] │
│ (Líder: Pessoa indisponível ✕)       │  sem nome e sem id
│ (Líder: André Souza ✕)               │
│ (i) Esta pessoa não está disponível  │  text-sm, text-muted-foreground
│ para você.                           │
│ 3 relatórios                         │  R1, R2 e R4
│──────────────────────────────────────│
│ André Souza                [✎]  [⋯]  │
│ …                                    │
└──────────────────────────────────────┘
```
- **Seletor (P53):** o `PaginatedSelect` com `isMulti`, 20 opções por página, com "Carregar mais", e o placeholder "Escolha uma ou mais pessoas". As pessoas escolhidas aparecem dentro do campo, na ordem da escolha, cada uma com o "✕" ("Remover {Nome}"). O menu fica aberto depois de cada escolha.
- **Opções (RN-05, RN-06):** só quem é o líder registrado (no Líder) ou o G12 (no G12) de pelo menos um relatório visível, inclusive os nomes de referência, em ordem alfabética (AQ-4).
  - No Líder, cada opção traz o nível do P40 entre parênteses: "André Souza (144)", "Samuel Colares (Pastor)", "Ester Ramos (Sem liderança)", "Jonas Prado (Nível 5)". Os parênteses ficam `aria-hidden`, e o leitor ouve "André Souza, nível 144".
  - No G12, só o nome. "Pastores" e "—" nunca são opções.
- **Busca sem resultado:** "Nenhum líder encontrado." e "Nenhum G12 encontrado." (Negócio).
- **Dica, limite e pessoa indisponível:** como a T4 do E2.07 e do E2.10:
  - a dica do Negócio fica embaixo do campo, em `text-sm text-muted-foreground`, ligada por `aria-describedby`;
  - com 10 pessoas, as outras opções ficam desabilitadas, e "Escolha até 10 pessoas." aparece no lugar da dica, com `role="status"`;
  - a pessoa que a leitura não resolve aparece como "Pessoa indisponível", sem nome e sem id, no campo e no chip. Embaixo da dica do campo e, fora do painel, embaixo dos chips, aparece "Esta pessoa não está disponível para você." (com mais de uma: "Estas pessoas não estão disponíveis para você."), com o ícone `Info` (`aria-hidden`);
  - os nomes das pessoas escolhidas vêm só da mesma leitura das opções, nunca da `member_names` nem do `useMemberName` (AQ-4).
- **Pessoas vindas da URL:** "Carregando…" no campo e no chip, até a leitura por id chegar.

#### T7. Período
Como a T5 do E2.07 (P54), com estas diferenças:
- os rótulos são "De" e "Até", num `fieldset` com a legenda **visível** "Período" (P33);
- sem `min` e sem `max`: datas futuras são aceitas, porque "Esta semana" vai até o sábado (P-LRE-07);
- sem dica;
- as mensagens são as do Negócio: "Data inválida. Use o formato dd/mm/aaaa." embaixo do campo com a data impossível, e "O fim do período precisa ser igual ou posterior ao início." embaixo de "Até". Os dois campos recebem `aria-invalid`, e a mensagem fica no `aria-describedby`;
- a conferência é ao sair do campo e, no celular, também em "Aplicar filtros", que não fecha o painel e põe o foco no campo com erro. Nunca durante a digitação. No computador, a lista fica sem o Período até as datas ficarem certas;
- os chips são "De: 22/11/2026" e "Até: 28/11/2026", um por data. As duas contam como um filtro;
- um campo só vale sozinho: só "De" traz desse dia em diante (RN-09), e nenhum atalho fica marcado (T3).

#### T8. Célula: chip, painel e indisponível (P93)
Celular, com Pedro, logo depois de "Ver todos os relatórios" no detalhe de C1 (critério da RN-08), e Diego com o mesmo link:
```
Pedro                                    Diego (célula indisponível)
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Buscar                               │ │ Buscar                               │
│ [⌕ Líder ou tema                   ] │ │ [⌕ Líder ou tema                   ] │
│ [⚲ Filtros (1)] [Limpar filtros]     │ │ [⚲ Filtros (1)] [Limpar filtros]     │
│ [  Esta    ][  Semana  ][  Semana  ] │ │ [  Esta    ][  Semana  ][  Semana  ] │
│ [  semana  ][  passada ][ retrasada] │ │ [  semana  ][  passada ][ retrasada] │
│ (Célula de André Souza · Quarta ·    │ │ (Célula indisponível ✕)              │
│  20:00 ✕)                            │ │ (i) Esta célula não está disponível  │
│ 4 relatórios                         │ │ para você.                           │
│──────────────────────────────────────│ │ 0 relatórios                         │
│ André Souza                [✎]  [⋯]  │ │──────────────────────────────────────│
│ … (R1, R2, R4 e R5)                  │ │ Nenhum relatório encontrado com      │
└──────────────────────────────────────┘ │ estes filtros.                       │
                                         │ [Limpar filtros                    ] │
                                         └──────────────────────────────────────┘
```
- **Chip (P84):** o `RecordFilterChip` do E2.10, sem mudança: "Célula de {Líder} · {Dia} · {HH:mm}", com o dia na forma curta e os dados atuais da célula, `min-h-9`, quebra de linha, `aria-label="Remover filtro Célula de …"`. "Célula: carregando…" e "Célula: não carregada", como lá. Agora ele é o primeiro chip (UXD-2), conta como filtro ("Filtros (1)") e sai com "Limpar filtros".
- **No painel (P93):** o mesmo chip, com o rótulo "Célula", no topo do `Sheet` (T4) e na primeira linha do painel do computador (T5). Sem seletor (P-LRE-06). Sem o filtro, o bloco não aparece.
- **Célula indisponível:** o chip "Célula indisponível", sem nome e sem id, e embaixo "Esta célula não está disponível para você.", com o ícone `Info`. A lista fica vazia, com o vazio com filtros. É a mesma tela para a célula que não existe.
- **Célula excluída (Rita, pela consulta de R6):** o chip normal ("Célula de Jonas Prado · Sexta · 20:00"), e a linha de R6 com o badge "Célula excluída".
- **Combinação:** a Célula vale junto com os atalhos e com os outros filtros (RN-08). Com "Semana passada", Pedro vê só R1, e o botão mostra "Filtros (2)".
- **Título:** continua "Relatórios" (P-LCE-32).

#### T9. Estados da lista
Como a T6 do E2.07 e a T7 do E2.10, com os textos de Relatórios:
- **Vazio com filtros ou com a busca:** "Nenhum relatório encontrado com estes filtros." e "Limpar filtros" (`Button variant="outline"`, `h-11`). O "0 relatórios" continua acima, e os atalhos continuam à vista.
- **Vazio sem filtros nem busca:** "Nenhum relatório encontrado." (Ester).
- **Carregando:** na primeira carga, 5 `Skeleton` no formato dos cartões (até 1279 px) ou das linhas (a partir de 1280 px), no lugar do "Carregando..." de hoje. Ao aplicar um filtro, tocar num atalho ou trocar de página, a lista anterior fica com `opacity-60` e `aria-busy="true"`, e o total anterior continua (E1.08).
- **Erro ao carregar:** um `Alert` com "Não foi possível carregar os relatórios. Verifique a conexão e tente de novo." e "Tentar de novo", no lugar da lista (hoje, um texto vermelho solto). A busca, os atalhos, "Filtros" e os chips continuam e funcionam. Nunca uma mensagem técnica, nem no tempo-limite.
- **De volta da consulta:** a lista continua como estava, na mesma rolagem, e o foco volta ao botão do relatório aberto. Se ele saiu da lista (foi excluído), o foco vai para o `h1` "Relatórios" (`tabIndex={-1}`).
- **Sem a lista de Relatórios (Hugo):** a tela sem acesso da T12 do E2.02, também com `?report=` na URL.

#### T10. Consulta "Ver relatório": celular
360 px, com Caio, que não edita nem exclui relatórios, na consulta de R1 (critério da RN-16). O `Sheet` ocupa a tela inteira:
```
┌──────────────────────────────────────┐
│ Relatório de 18/11/2026         [✕]  │  cabeçalho fixo: SheetTitle (h2),
│──────────────────────────────────────│  foco ao abrir; ✕ de 44×44
│ Célula de André Souza · Quarta ·     │  SheetDescription, dados atuais
│ 20:00                                │
│ [✓ Célula realizada]                 │
│ Enviado por Caio Lima em 18/11/2026  │  autoria (P30); sem "Ver
│ às 21:40                             │  histórico" para Caio (P31)
│──────────────────────────────────────│  Separator
│ Reunião                              │  h3 (PO, E2.11: no lugar de
│                                      │  "Detalhes do Encontro")
│ Data e horário                       │  dl
│ Quarta, 18/11/2026 às 20:00          │
│ Tema                                 │
│ A fé que vence                       │
│ Participantes (8)                    │  h3; ul em colunas (P94)
│ André Souza       Débora Lins        │
│ Beatriz Souza     Gabriel Costa      │
│ Caio Lima         Jonas Prado        │
│ Carla Dias        Sara Campos        │  excluída: só o nome (RN-13)
│ Visitantes (2)                       │  h3
│ João Pereira      Maria Lima         │
│ Oferta                               │
│ R$ 50,00                             │
│ Observações                          │
│ Dois visitantes do trabalho do Caio  │
│──────────────────────────────────────│
│ Pessoas da célula                    │  h3
│ Líder, timóteo, anfitrião e tipo     │  dica † (UXD-12), sempre
│ como estavam no envio. O G12 é o de  │  (PO-UX-2)
│ hoje.                                │
│ Líder      André Souza               │  dl em duas colunas
│ Timóteo    Caio Lima                 │
│ Anfitrião  Carla Dias                │
│ G12        Pedro Alves               │
│ Tipo       Evangelística             │
│──────────────────────────────────────│
│ Endereço da célula                   │  h3; endereço atual
│ Rua das Flores, 100                  │
│ Centro · Porto Alegre, RS            │
│ CEP 90010-000                        │
│ [Ver célula                      → ] │  Link outline, h-11
│ [Ver todos os relatórios desta   → ] │  quebra a linha
│ [célula                            ] │
└──────────────────────────────────────┘
```
Pedro, com "Editar Relatórios de Células" e "Excluir Relatórios de Células", na mesma consulta: o corpo é o mesmo, e o rodapé fixo aparece.
```
┌──────────────────────────────────────┐
│ …                                    │
│ [Ver todos os relatórios desta   → ] │
│ [célula                            ] │
│══════════════════════════════════════│
│ [✎ Editar relatório           ] [⋯]  │  rodapé fixo, h-11
└──────────────────────────────────────┘    ⋯: Excluir relatório
```
- **Contêiner (P92):** `SheetContent side="right"` com `w-full sm:max-w-lg p-0 flex flex-col` (tela cheia abaixo de 640 px). O cabeçalho (`border-b px-4 py-3`, com o título e o "✕") e o rodapé ficam fixos, e o corpo (`flex-1 overflow-y-auto px-4 py-4 sm:px-6`) rola.
- **Cabeçalho fixo:** "Relatório de {dd/mm/aaaa}" no `SheetTitle` (um `h2`), que recebe o foco ao abrir (`tabIndex={-1}`, pelo `onOpenAutoFocus`). O "✕" tem 44×44 px e o nome "Fechar" (AQ-13).
- **Topo do corpo, nesta ordem:**
  1. "Célula de {Líder} · {Dia} · {HH:mm}" (`SheetDescription`), com os dados **atuais** da célula, como o chip da Célula (P-LRE-22). O dia na forma curta ("Quarta"). Os "·" ficam `aria-hidden`;
  2. os badges, num `flex flex-wrap gap-2`: o da reunião e, quando for o caso, "Célula excluída";
  3. o aviso da célula excluída (T11);
  4. a autoria (P30, "Enviado por…" e, quando houver, "Alterado por…") e "Ver histórico" (P31), só para quem tem "Visualizar Auditoria", com `aria-label="Ver histórico do relatório de {dd/mm/aaaa}"`;
  5. o `Separator`.
- **Conteúdo do relatório (UXD-8):** a seção "Reunião" (`h3`, o nome do E2.11 no lugar de "Detalhes do Encontro"; acrescentado pelo PO), com uma `dl` com `dt` em `text-sm text-muted-foreground` e `dd` em `text-foreground`, que quebra linha, sem `truncate`:
  - "Data e horário": "{Dia}, {dd/mm/aaaa} às {HH:mm}", com o dia por extenso (UXD-15). No relatório de "Não houve célula", o `dt` é "Reunião prevista", como no formulário do E2.11, com a data prevista;
  - célula realizada: "Tema", "Participantes ({N})", "Visitantes ({N})" e "Oferta" ("R$ 50,00", "R$ 0,00" ou "Não informada");
  - não houve célula: "Motivo", e nada de Tema, Participantes, Visitantes ou Oferta;
  - "Observações", só quando houver.
- **Participantes e visitantes (P94, RN-17):** cada lista tem um `h3` com o número ("Participantes (8)") e uma `ul` com `aria-labelledby` nele.
  - Todos aparecem, sem corte e sem "mostrar mais". Participantes em ordem alfabética, sem diferenciar acentos (AQ-6); visitantes na ordem registrada.
  - As colunas se ajustam à largura (`columns-[9rem] gap-x-6`): duas em 360 px, três em 512 px e uma só em 320 px com zoom ou com a fonte grande. A leitura é de cima para baixo, primeiro a coluna da esquerda, na mesma ordem do DOM.
  - Os nomes são só texto, sem link e sem nenhum outro dado. O participante excluído aparece igual aos outros (RN-13 do E2.01).
  - Sem participantes: "Nenhum membro." (E2.01). Sem visitantes: "Nenhum visitante." (Negócio).
- **Pessoas da célula:** `h3`, a dica † (UXD-12) e uma `dl` em duas colunas (`grid grid-cols-[auto_1fr] gap-x-3 gap-y-1`), como a T8 do E2.10:
  - Líder, Timóteo e Anfitrião do retrato, e o G12 do relatório ("Pedro Alves", "Pastores" ou "—", com "nenhum" em `sr-only`), todos como nomes de referência, sem link e sem nível;
  - Tipo, o registrado no relatório (RN-04);
  - a dica aparece sempre: todo relatório tem o retrato (RN-21 do E2.11; PO-UX-2, AQ-7).
- **Endereço da célula:** `h3` e o endereço atual em até quatro linhas, como a T8 do E2.10 ("s/n", o complemento, "{Bairro} · {Cidade}, {UF}", "CEP {00000-000}"), ou "Sem endereço". Embaixo, os links (UXD-9):
  - "Ver célula": `Link` com o visual do `Button variant="outline"`, `h-auto min-h-11 w-full whitespace-normal` no celular e `sm:w-auto`, com o ícone `ArrowRight` (`aria-hidden`) e o nome "Ver a célula de {Líder}". Só quando quem consulta vê a célula e ela não foi excluída (RN-16 c);
  - "Ver todos os relatórios desta célula": o mesmo visual, para todos que veem o relatório, com o nome "Ver todos os relatórios da célula de {Líder}". Quebra a linha no celular, sem corte.
- **Rodapé fixo (UXD-9):** `border-t bg-background px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]`, com `viewport-fit=cover` (P1). Abaixo de 768 px:
  - com "Editar relatório": o botão `default` (`h-11`, `flex-1`, ícone `Pencil`) e, à direita, o "⋯" (`h-11 w-11`, `aria-label="Ações do relatório de {dd/mm/aaaa}"`) com "Excluir relatório", só com "Excluir Relatórios de Células";
  - só com "Excluir relatório" (célula excluída): o botão "Excluir relatório" (`outline`, `h-11`, largura toda, ícone `Trash2` em `text-muted-foreground`), sem "⋯";
  - sem nenhuma das duas: o rodapé não existe, e o corpo vai até o fim da tela.
- **A partir de 768 px:** no rodapé, "Excluir relatório" (`outline`, ícone `Trash2` em `text-muted-foreground`) à esquerda e "Editar relatório" (`default`) à direita (`flex justify-between`). Os dois elementos de cada tamanho ficam com `display: none` no outro tamanho, como no P80, para o leitor de tela não encontrar a mesma ação duas vezes.
- Componentes: `Sheet`, `StatusBadge`, `Alert`, `Separator`, `Button`, `DropdownMenu`, `Skeleton`, `RecordAuthorship` (E2.05) e `Link`.

#### T11. Consulta: computador e variações
Em 1280 px, com Pedro, na consulta de R1. O `Sheet` tem 512 px, à direita, sobre a lista:
```
                              ┌──────────────────────────────────────────────────────┐
                              │ Relatório de 18/11/2026                         [✕]  │
                              │──────────────────────────────────────────────────────│
                              │ Célula de André Souza · Quarta · 20:00               │
                              │ [✓ Célula realizada]                                 │
                              │ Enviado por Caio Lima em 18/11/2026 às 21:40         │
                              │──────────────────────────────────────────────────────│
                              │ Data e horário                                       │
                              │ Quarta, 18/11/2026 às 20:00                          │
                              │ Tema                                                 │
                              │ A fé que vence                                       │
                              │ Participantes (8)                                    │
                              │ André Souza      Carla Dias       Jonas Prado        │  três colunas
                              │ Beatriz Souza    Débora Lins      Sara Campos        │
                              │ Caio Lima        Gabriel Costa                       │
                              │ …                                                    │
                              │══════════════════════════════════════════════════════│
                              │ [⌫ Excluir relatório]           [✎ Editar relatório] │
                              └──────────────────────────────────────────────────────┘
```
Variações (as outras seções são as da T10):
```
R2, "Não houve célula" (Rita)            R6, célula excluída (Rita)
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Relatório de 11/11/2026         [✕]  │ │ Relatório de 20/11/2026         [✕]  │
│──────────────────────────────────────│ │──────────────────────────────────────│
│ Célula de André Souza · Quarta ·     │ │ Célula de Jonas Prado · Sexta ·      │
│ 20:00                                │ │ 20:00                                │
│ [⊘ Não houve célula]                 │ │ [✓ Célula realizada]                 │
│ Enviado por … em 11/11/2026 às …     │ │ [⦸ Célula excluída]                  │
│──────────────────────────────────────│ │ ┌──────────────────────────────────┐ │
│ Reunião prevista                     │ │ │(i) A célula deste relatório foi  │ │  Alert do E2.01
│ Quarta, 11/11/2026 às 20:00          │ │ │excluída. Restaure a célula para  │ │
│ Motivo                               │ │ │editar o relatório.               │ │
│ Chuva forte no bairro                │ │ │[Ver células excluídas]           │ │  só administrador
│──────────────────────────────────────│ │ └──────────────────────────────────┘ │
│ Pessoas da célula                    │ │ …                                    │
│ …                                    │ │ Endereço da célula                   │
│══════════════════════════════════════│ │ …                                    │
│ [✎ Editar relatório           ] [⋯]  │ │ [Ver todos os relatórios desta   → ] │  sem "Ver célula"
└──────────────────────────────────────┘ │ [célula                            ] │
                                         │══════════════════════════════════════│
                                         │ [⌫ Excluir relatório               ] │  só Excluir, com texto
                                         └──────────────────────────────────────┘
```
- **Lia** (só "Visualizar Relatórios de Toda a Igreja"), na consulta de R1: o mesmo de Caio, sem "Ver célula", porque ela não vê C1. "Ver todos os relatórios desta célula" continua.
- **R5, com o retrato (Rita):** "Célula de André Souza · Quarta · 20:00" no topo, e em Pessoas da célula: Líder Fábio Lima, Timóteo Caio Lima, Anfitrião Carla Dias, G12 Pedro Alves e Tipo Discipulado. A dica explica a diferença entre o topo e as pessoas.
- **Célula excluída:** o badge e o `Alert` do E2.01 (T7), com "Ver células excluídas" só para quem restaura. Sem "Editar relatório" e sem "Ver célula". "Excluir relatório" e "Ver todos os relatórios desta célula" continuam (RN-16 c).
- **"Não houve célula" vindo do legado:** ele pode trazer tema, oferta, visitantes e participantes (RN-21 do E2.11). A linha e a consulta seguem a RN-15 e a RN-16: mostram só o motivo e as observações, sem esses dados (PO-UX-12).
- **Largura:** a partir de 640 px, o `Sheet` tem 512 px (`sm:max-w-lg`), e a lista continua atrás, com o overlay. As seções e os textos são os mesmos do celular; mudam só as colunas dos nomes (três) e o rodapé (T10).

#### T12. Consulta: carregando, não encontrado e erro
```
Carregando, aberta pela linha            Relatório não encontrado (Pedro abre R8)
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Relatório de 18/11/2026         [✕]  │ │ Relatório não encontrado        [✕]  │  SheetTitle, foco
│──────────────────────────────────────│ │──────────────────────────────────────│
│ Célula de André Souza · Quarta ·     │ │ Ele não existe, foi excluído ou não  │
│ 20:00                                │ │ está disponível para você.           │
│ [✓ Célula realizada]                 │ │ [Fechar                            ] │  default, h-11
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒          │ └──────────────────────────────────────┘
│──────────────────────────────────────│
│ Data e horário                       │ Erro ao carregar
│ Quarta, 18/11/2026 às 20:00          │ ┌──────────────────────────────────────┐
│ Tema                                 │ │ Relatório                       [✕]  │
│ A fé que vence                       │ │──────────────────────────────────────│
│ Participantes (8)                    │ │ ┌──────────────────────────────────┐ │
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒     ▒▒▒▒▒▒▒▒▒▒▒▒       │ │ │⚠ Não foi possível carregar o     │ │  Alert
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒     ▒▒▒▒▒▒▒▒▒▒▒▒       │ │ │relatório. Verifique a conexão e  │ │
│ Visitantes (2)                       │ │ │tente de novo.                    │ │
│ João Pereira      Maria Lima         │ │ │[Tentar de novo]                  │ │
│ …                                    │ │ └──────────────────────────────────┘ │
└──────────────────────────────────────┘ └──────────────────────────────────────┘
```
- **Aberta pela linha:** o que a linha já tem aparece na hora (o título, a célula, o badge, a data, o tema ou o motivo, os números, os visitantes, a oferta, as observações e o endereço da linha). A autoria, os nomes dos participantes, as pessoas da célula e o endereço completo mostram `Skeleton` no formato de cada um, com a altura reservada pelo número que a linha já tem (AQ-6). O rodapé só aparece quando a leitura chega, para não oferecer uma ação que a pessoa talvez não tenha.
- **Aberta por link:** o título é "Relatório", e todo o corpo é `Skeleton` até a leitura chegar.
- **Relatório não encontrado (P-LRE-18):** o título "Relatório não encontrado", a frase do Negócio e o botão "Fechar" (`default`, `h-11`, largura toda no celular), que fecha a consulta e tira o `report`. Sem rodapé e sem nenhum dado do relatório, nem os que vieram da linha. É o mesmo DOM para o relatório invisível, o excluído e o inexistente. O foco vai para o título.
- **Erro ao carregar:** o `Alert` do Negócio, com "Tentar de novo", no lugar do corpo. O título é o da linha, quando há, ou "Relatório". Nunca uma mensagem técnica.
- **Falha só nos participantes:** a seção mostra "Não foi possível carregar os participantes. Verifique a conexão e tente de novo." † e "Tentar de novo" (`variant="link"`). O resto da consulta funciona.
- **O relatório some com a consulta aberta** (foi excluído por outra pessoa, ou deixou de ser visível, RN-16 e): a leitura seguinte (ao voltar para a aba, em "Tentar de novo" ou depois de uma gravação) mostra "Relatório não encontrado".

#### T13. Ações a partir da consulta e depois de gravar
- **"Editar relatório" (UXD-10):** abre o formulário de relatório (E2.11, P1), o mesmo da linha, **por cima** da consulta. A consulta continua aberta atrás. "Cancelar", "✕" e `Esc` fecham só o formulário, com o "Descartar as alterações?" quando houver mudança, e o foco volta a "Editar relatório".
- **"Excluir relatório":** abre a confirmação da T2 do E2.01, por cima da consulta.
- **"Ver célula", "Ver todos os relatórios desta célula" e "Ver histórico":** fecham a consulta e navegam, com uma entrada nova no histórico ([Navegação e rotas](#navegação-e-rotas)).
- **Ações da linha:** "Editar" e "Excluir" continuam na linha, com as regras e os nomes de hoje (E2.01). Elas não abrem a consulta.
- **Depois de gravar (P44, RN-16 e):**

  | Ação | A consulta | A lista | O foco |
  |---|---|---|---|
  | Editar pela consulta | Mostra os valores novos assim que a gravação é confirmada. Até a resposta, o corpo fica com `opacity-60` e `aria-busy`. O toast é o do formulário. | Recarrega atrás, com a linha atualizada, na posição que a data der | "Editar relatório" |
  | Excluir pela consulta | Fecha, e o `report` sai da URL. O toast é o do E2.01 ("Relatório excluído."). | Recarrega sem o relatório, na mesma página ou na anterior, se esta esvaziou | o `h1` "Relatórios" |
  | Editar ou excluir pela linha | — | Como hoje (E2.01) | Como hoje |

- **Falhas:** as do formulário e da confirmação, sem mudança (E2.01, E2.11). A consulta não muda até a gravação ser confirmada. A edição recusada porque a célula foi excluída no meio tempo mostra o `Alert` da T7 do E2.01 no formulário, e a consulta, ao voltar, mostra o badge e o aviso.

#### T14. Detalhe da célula: a mesma consulta (recomendação)
O Negócio recomenda (Impactos, E2.10) que cada um dos "Últimos relatórios" do detalhe da célula abra a mesma consulta. Se o `architect` incluir isso:
- no cartão e na tabela da T11 do E2.10, o cabeçalho de cada relatório ("Quarta, 18/11/2026 às 20:00") passa a ser o botão da consulta (P91), com o nome "Ver o relatório de 18/11/2026";
- a consulta abre sobre o detalhe, com `?report=<id>` no endereço do detalhe (`/cells/<id>?report=<id>`), e é a mesma da T10, sem "Ver célula", porque a pessoa já está nela;
- os nomes continuam fora do próprio detalhe (RN-18 do E2.10): eles ficam na consulta.

Sem isso, o detalhe fica como o E2.10 desenhou, e a consulta continua a um toque, pela lista que "Ver todos os relatórios" abre.

#### T15. Telas sem mudança visual
- **Menu:** só "Relatórios", sem atalhos (P-LRE-08). O item fica ativo também com a consulta aberta.
- **Dashboard:** nenhum card novo. O clique é do E2.14, com os links prontos.
- **Formulário de relatório:** o do E2.11. Abre também pela consulta (T13).
- **Lista "Excluídos" de relatórios (E2.01):** sem filtros e sem a consulta.

#### T16. As perguntas Q-1 a Q-7 na tela
Com o padrão do Negócio, vale o que está nas T1 a T15. Se a resposta for a alternativa:
- **Q-1. Quem vê os participantes pelo nome.**
  - *Com o padrão (todos que veem o relatório):* a T10.
  - *Com a alternativa (só quem edita relatórios):* para os demais, a consulta mostra "Participantes" e "Visitantes" na `dl`, só com o número ("8", "2"), sem as listas e sem explicação. As colunas do P94 não aparecem. Para quem edita, a T10.
- **Q-2. Onde ficam os atalhos.**
  - *Com o padrão (só na tela):* a T3.
  - *Com a alternativa (também no menu):* três subitens embaixo de "Relatórios" no menu lateral (`SidebarMenuSub`), "Esta semana", "Semana passada" e "Semana retrasada", cada um com 44 px de altura no celular, que abrem `/cell-reports` com as datas da semana. O subitem da semana aplicada ganha `aria-current="page"`. No celular, o menu cresce cerca de 140 px. Os atalhos da tela continuam.
- **Q-3. O que o link de um atalho guarda.**
  - *Com o padrão (as datas):* a T3 e a Navegação e rotas.
  - *Com a alternativa (a semana relativa):* o atalho grava `week=current`, `last` ou `before_last` †, e não as datas. O atalho fica marcado pelo parâmetro. O Período vira um chip só, "Período: Esta semana (22/11 a 28/11)" †, e o painel mostra "De" e "Até" preenchidos; mudar uma das datas troca o parâmetro pelas datas e desmarca o atalho.
- **Q-4. A lista abre com algum período.**
  - *Com o padrão (sem período):* a T1.
  - *Com a alternativa ("Esta semana"):* ao entrar pelo menu, "Esta semana" já vem marcada, com os chips "De" e "Até", "Filtros (1)" e "Limpar filtros". Para ver todos, a pessoa usa "Limpar filtros", e a tela guarda essa escolha no endereço (`period=all` †), para recarregar sem voltar à semana. A UX sugere, nesse caso, um quarto atalho, "Todas as semanas" †, que faz o mesmo em um toque.
- **Q-5. A Célula no painel.**
  - *Com o padrão (só por link):* a T8.
  - *Com a alternativa (seletor):* o bloco Célula vira um `PaginatedSelect` de escolha única, sempre à vista no topo do painel, com o placeholder "Escolha uma célula" †, as opções "Célula de {Líder} · {Dia} · {HH:mm}" e a busca sem resultado "Nenhuma célula encontrada." †. O chip não muda.
- **Q-6. Filtro de rede.**
  - *Com o padrão:* os seis filtros.
  - *Com a alternativa:* um sétimo, "Liderança", logo depois do Líder, com o seletor do P53 e a dica "Mostra os relatórios das células lideradas pelas pessoas escolhidas ou por qualquer pessoa abaixo delas." †. A contagem vai até 7, e o filtro ganha chip e parâmetro (`network`). No computador, o G12 desce para a linha do Período.
- **Q-7. G12 por casal.**
  - *Com o padrão:* a dica do G12 termina em "Para o ministério de um casal, escolha os dois.".
  - *Com a alternativa:* a dica passa a "Mostra os relatórios das células do ministério de cada pessoa escolhida e do cônjuge dela, inclusive os das células deles." †. O chip continua com o nome escolhido.

### Padrões novos (valem para as próximas telas)
A numeração começa em P90 (ver a nota do início da seção). Este passo também aplica o P1 (o formulário e os rodapés fixos), o P6 (badges), o P8 ("Excluir" no "⋯"), o P10 (subtítulo), o P30 e o P31 (autoria e histórico), o P33 (rótulos do período), o P40 (nível nas opções), o P44 (depois de gravar), o P50 a P54 (filtros), o P65 (ações no mesmo lugar), o P74 (cartões até 1279 px, agora também em Relatórios), o P80 (um elemento por tamanho) e o P84 (registro vindo de outra tela), sem mudá-los.

- **P90. Atalhos de período fora do painel.** Vale quando um período é o filtro mais usado de uma lista.
  - Um `ToggleGroup type="single"` com `aria-label`, à vista em todas as larguras, fora do painel de filtros, logo antes dos chips. Cada atalho vale na hora, sem "Aplicar filtros", e volta para a página 1.
  - O atalho só grava as datas do Período. Ele não tem parâmetro, chip nem contagem próprios.
  - O atalho fica marcado quando o Período aplicado é exatamente o dele, venha de onde vier. Tocar de novo não desmarca. O marcado é preenchido (`bg-primary text-primary-foreground font-semibold`).
  - O nome acessível traz as datas.
  - As datas vêm do servidor. Sem elas, os atalhos ficam desabilitados, com o lugar reservado. O relógio do aparelho nunca é usado.
  - A grade se ajusta à largura (`repeat(auto-fit, minmax(5.5rem, 1fr))`), com o texto quebrando dentro do botão de pelo menos 44 px.
  - Vale para a Auditoria, Escolas (aulas) e o Dashboard, se eles ganharem atalhos de período.
- **P91. Item de lista que abre um painel de consulta.** A variação do P81 para quando o item abre um painel, e não uma página. Junta o P34 e o P81.
  - **Cartão:** um `button` esticado sobre o cartão (`after:absolute after:inset-0`), com `aria-haspopup="dialog"`, cujo texto visível é o identificador (o nome do líder) e cujo nome acessível começa pela ação e contém esse texto ("Ver o relatório de 18/11/2026, André Souza"). As ações ficam por cima (`relative z-10`), como irmãs. Um `ChevronRight` decorativo no fim da última linha. O foco desenha o anel no cartão inteiro.
  - **Tabela:** o identificador da primeira coluna é o `button`. O clique na linha é um atalho do mouse e ignora os botões.
  - Ao fechar o painel, o foco volta ao botão que o abriu.
- **P92. Painel de consulta de um registro.** Generaliza o `Sheet` da T7 do E2.01.
  - `Sheet` à direita, em tela cheia no celular e com 512 px a partir de 640 px. O cabeçalho (título e "✕" de 44 px, "Fechar") e o rodapé ficam fixos, e o corpo rola.
  - No corpo: a identificação e os badges; os avisos; a autoria (P30); o conteúdo do registro, numa `dl`, com o que a pessoa veio ver em primeiro lugar; e, por último, o contexto, com os links para outras telas.
  - No rodapé, só as ações que mudam o registro: a principal com texto e, abaixo de 768 px, a destrutiva no "⋯" (P8), ou com texto quando for a única. Sem ações, sem rodapé.
  - O painel aberto fica no endereço (`?<registro>=<id>`), com uma entrada no histórico: o voltar fecha o painel.
  - Aberto pela lista, o que ela já tem aparece na hora, e o resto em `Skeleton`. Um estado só de "{Registro} não encontrado" para o invisível, o excluído e o inexistente, com "Fechar".
  - O formulário de edição abre por cima do painel e, ao salvar, devolve o painel com os valores novos.
  - Vale para as próximas consultas (Turmas, Consolidação).
- **P93. Registro vindo de outra tela, dentro do painel de filtros.** É o P84 quando a lista já tem um painel.
  - O chip do P84, com o rótulo do filtro, no topo do painel e no início dos chips. Sem seletor.
  - Só aparece com o filtro aplicado. No `Sheet`, o "✕" tira o registro do que vai ser aplicado; no painel do computador, tira na hora.
  - Conta como um filtro e sai com "Limpar" e "Limpar filtros".
- **P94. Lista de nomes sem corte.** Para listas de pessoas ou de nomes livres que precisam aparecer todas (participantes, alunos de uma turma).
  - Um `h3` com o número ("Participantes (8)") e uma `ul` com `aria-labelledby` nele.
  - Colunas que se ajustam à largura (`columns-[9rem] gap-x-6`), lidas de cima para baixo, na ordem do DOM. Com zoom ou fonte grande, uma coluna só.
  - Os nomes quebram linha, sem `truncate`, e são só texto. Sem "mostrar mais".
  - A lista vazia tem uma frase própria ("Nenhum visitante.").

Nenhum componente novo do shadcn é necessário: `toggle-group`, `sheet`, `collapsible`, `popover`, `checkbox`, `radio-group`, `select`, `dropdown-menu`, `alert`, `alert-dialog`, `badge`, `button`, `card`, `separator`, `skeleton` e `table` já estão em `src/components/ui`. Os ícones `CheckCircle2`, `CalendarX`, `Ban`, `ChevronRight`, `ArrowRight`, `Pencil`, `Trash2`, `MoreHorizontal`, `History`, `Info`, `X`, `Search` e `SlidersHorizontal` existem no `lucide-react` do projeto. O rodapé fixo da consulta e o P1 continuam pedindo `viewport-fit=cover` na meta viewport do `index.html`, que ainda não tem.

### Estados
| Estado | Lista, atalhos e filtros (T1 a T9) | Consulta (T10 a T13) |
|---|---|---|
| Carregando | Primeira carga: 5 `Skeleton` no formato dos cartões ou das linhas. Ao aplicar um filtro, tocar num atalho ou trocar de página, a lista anterior fica com `opacity-60` e `aria-busy`, e o total anterior continua. Atalhos sem a data do servidor: desabilitados, no mesmo lugar. Pessoas e célula vindas da URL: "Carregando…" no campo e no chip | Pela linha: o que a linha tem aparece na hora; a autoria, os nomes, as pessoas e o endereço em `Skeleton`, sem rodapé até a leitura chegar. Por link: "Relatório" e o corpo em `Skeleton` |
| Vazio | Com filtros ou busca: "Nenhum relatório encontrado com estes filtros." e "Limpar filtros". Sem nada: "Nenhum relatório encontrado.". Seletores sem resultado: "Nenhum líder encontrado." e "Nenhum G12 encontrado." | "Nenhum membro." e "Nenhum visitante.". Sem observações, a linha não aparece. Sem endereço: "Sem endereço" |
| Erro ao carregar | `Alert` com o texto do Negócio e "Tentar de novo". A busca, os atalhos, os filtros e os chips continuam. Opções dos seletores: "Não foi possível carregar as opções. Tentar novamente" (E1.08). Data do servidor: os atalhos ficam desabilitados, e a lista funciona | `Alert` com o texto do Negócio e "Tentar de novo". Só os participantes: a mensagem da seção, e o resto funciona |
| Não encontrado ou sem permissão | Sem a lista de Relatórios: a tela sem acesso da T12 do E2.02 | "Relatório não encontrado", igual para o invisível, o excluído e o inexistente. Sem as permissões, as ações e o rodapé não aparecem. "Ver célula" só para quem vê a célula |
| Valor inválido | Da URL: sai, não é aplicado e não conta. Datas: as mensagens da T7, e o Período não é aplicado. Pessoa ou célula indisponível: a T6 e a T8. Datas invertidas vindas de link: ficam, não valem, e a mensagem aparece ao abrir o painel | `report` sem formato de id: sai da URL, sem consulta |
| Limite | Com 10 pessoas no Líder ou no G12: opções desabilitadas e "Escolha até 10 pessoas." | — |
| Sucesso | A lista e o total mudam, e o leitor de tela ouve o total. No celular, o painel fecha. O atalho fica marcado | Editar: a consulta com os valores novos e o toast do formulário. Excluir: a consulta fecha, com o toast do E2.01 |
| Lista grande | Paginação do E1.08, com o total com separador de milhar. Com muitos chips, a lista desce, mas "Filtros", "Limpar filtros" e os atalhos não saem do lugar. Seletores com 20 por página e "Carregar mais" | Todos os participantes e visitantes, em colunas (P94); o corpo rola, e o cabeçalho e o rodapé ficam fixos |
| Queda de conexão | Só leitura: o erro ao carregar, com os filtros mantidos na URL e na tela. No celular, "Aplicar filtros" fecha o painel, e a falha aparece na lista | Leitura: o erro ao carregar. Gravações: as mensagens do formulário e da confirmação (E2.01, E2.11), com os dados mantidos e a consulta sem mudar |

### Textos
Complementam os "Textos de tela" do Negócio, sem mudar os termos. Os marcados com † foram definidos pela UX e estão nas pendências (PO-UX-11).

| Onde | Texto |
|---|---|
| Cabeçalho | Relatórios † (`h1`, no lugar de "Relatórios de Células") · os subtítulos do E2.02 (P10) · Novo relatório (E2.02) · Excluídos (E2.01) |
| Busca | Buscar (rótulo) · Líder ou tema (placeholder, do Negócio) |
| Atalhos | Esta semana · Semana passada · Semana retrasada · (leitor de tela) Atalhos de semana † (nome do grupo) · Esta semana, de 22/11/2026 a 28/11/2026 (nome de cada atalho, com as datas, do Negócio) |
| Botão e painel | Filtros · Filtros ({N}) · (leitor de tela) Filtros ({N} ativos) · Limpar filtros · no `Sheet`: Filtros (título), Limpar, Aplicar filtros, Fechar † (o "✕") · (leitor de tela) As mudanças valem quando você toca em Aplicar filtros. (E2.07) |
| Célula | Célula (rótulo no painel) · Célula de {Líder} · {Dia} · {HH:mm} · Célula indisponível · Esta célula não está disponível para você. · Célula: carregando… · Célula: não carregada (E2.10) |
| Líder | Líder · Escolha uma ou mais pessoas · a dica do Negócio · Nenhum líder encontrado. · opção: {Nome} ({nível}) |
| G12 | G12 · Escolha uma ou mais pessoas · a dica do Negócio · Nenhum G12 encontrado. |
| Líder e G12 | Escolha até 10 pessoas. · Pessoa indisponível · Esta pessoa não está disponível para você. · Estas pessoas não estão disponíveis para você. · Carregando… · Remover {Nome} (leitor de tela) |
| Período | Período (legenda visível) · De · Até · Data inválida. Use o formato dd/mm/aaaa. · O fim do período precisa ser igual ou posterior ao início. |
| Tipo | Tipo · Evangelística · Discipulado · Macrocélula · a dica do Negócio, sempre (PO-UX-2) · no computador, sem escolha: Todos |
| Reunião | Reunião · Todas · Célula realizada · Não houve célula |
| Chips | os do Negócio, na ordem Célula, Líder, G12, De, Até, Tipo e Reunião · Líder: Carregando… · G12: Carregando… · (leitor de tela) Remover filtro {texto do chip} |
| Lista | {N} relatórios · 1 relatório · Nenhum relatório encontrado com estes filtros. · Nenhum relatório encontrado. · Não foi possível carregar os relatórios. Verifique a conexão e tente de novo. · Tentar de novo |
| Linha | os do Negócio · (leitor de tela) o dia por extenso no lugar do abreviado ("Quarta") † · nenhum † (no "G12: —") · não se aplica (nos "—" da tabela, E2.10) |
| Tabela | colunas: Célula † · Data e horário † · Reunião · Participantes · Visitantes · Oferta · Ações · (legenda, leitor de tela) Relatórios, do mais recente para o mais antigo. † |
| Abrir a consulta | (leitor de tela) Ver o relatório de {dd/mm/aaaa}, {Líder} (Negócio) |
| Consulta: cabeçalho | Relatório de {dd/mm/aaaa} · Relatório † (enquanto carrega por link e no erro) · Célula de {Líder} · {Dia} · {HH:mm} · Célula realizada · Não houve célula · Célula excluída · Fechar † |
| Consulta: seções | Reunião (`h3`, PO) · Data e horário · Reunião prevista (em "Não houve célula", PO) · {Dia}, {dd/mm/aaaa} às {HH:mm} · Tema · Motivo · Participantes ({N}) · Visitantes ({N}) · Nenhum membro. (E2.01) · Nenhum visitante. · Oferta · R$ {valor} · Não informada · Observações · Pessoas da célula · Líder · Timóteo · Anfitrião · G12 · Tipo · Endereço da célula · Sem endereço · CEP {00000-000} · s/n |
| Consulta: dica das pessoas † | Líder, timóteo, anfitrião e tipo como estavam no envio. O G12 é o de hoje. (no lugar de "Como estavam quando o relatório foi enviado.", UXD-12) |
| Consulta: autoria | as do E2.05 (P30) · Ver histórico · Ver histórico do relatório de {dd/mm/aaaa} (leitor de tela) |
| Consulta: ações | Editar relatório · Excluir relatório · Ações do relatório de {dd/mm/aaaa} (leitor de tela, E2.01) · Ver célula · Ver a célula de {Líder} † (leitor de tela) · Ver todos os relatórios desta célula · Ver todos os relatórios da célula de {Líder} † (leitor de tela) |
| Consulta: estados | Relatório não encontrado · Ele não existe, foi excluído ou não está disponível para você. · Fechar · Não foi possível carregar o relatório. Verifique a conexão e tente de novo. · Não foi possível carregar os participantes. Verifique a conexão e tente de novo. † · Tentar de novo |
| Consulta: célula excluída | os textos do E2.01 (o badge, o aviso e "Ver células excluídas") |
| Q-1 a Q-7, se adotadas † | os textos da T16 |

**Evitar nestas telas**, além do que o Negócio lista: "Encontro" e "Detalhes do Encontro" (E2.11); "Close" (o texto embutido do `sheet.tsx`); "Célula sem líder"; "Editar" e "Excluir" sem objeto na consulta; "Ver relatórios" e "Dados do líder" (do legado); o nome ou o id de uma pessoa ou de uma célula indisponível; e qualquer texto técnico (id, código, nome de parâmetro da URL).

### Acessibilidade
- **Atalhos (P90):** o `ToggleGroup` é uma parada só de Tab, com as setas entre os itens. Cada item é `role="radio"` com `aria-checked` (Radix), com o nome que traz as datas. O grupo tem `aria-label`. Desabilitados, eles têm `disabled`, e o grupo tem `aria-busy="true"`. Depois do toque, o foco fica no atalho, e o total é anunciado (`role="status"`).
- **Painel de filtros:** tudo da Acessibilidade do E2.07 e do E2.10 (o botão "Filtros", o `Sheet`, os grupos, as dicas, o `Popover`, os chips e os anúncios). A mais:
  - a Reunião é um `fieldset` com `legend` e o `RadioGroup` com `aria-labelledby`;
  - a dica do Tipo fica no `aria-describedby` do `fieldset`;
  - o chip da Célula no painel tem o rótulo "Célula" ligado por `aria-labelledby`, e o "✕" leva o foco ao Líder.
- **Lista:**
  - o botão de cada linha (P91) tem `aria-haspopup="dialog"` e o nome "Ver o relatório de {dd/mm/aaaa}, {Líder}", que contém o nome visível. As ações ficam fora do botão, com os nomes do E2.01;
  - o anel de foco do botão cobre o cartão inteiro (`focus-visible:after:ring-2 after:rounded-md`);
  - a ordem de leitura do cartão é a visual: o líder, o G12, a data, o endereço, os badges, o tema ou o motivo e os números. O dia abreviado e os "·" ficam `aria-hidden`, com o dia inteiro em `sr-only`;
  - a tabela tem `caption` em `sr-only` e `th` com `scope="col"`. Pelo teclado, só o nome do líder e as ações recebem o foco.
- **Consulta (P92):**
  - o `Sheet` do Radix prende e devolve o foco. Ao abrir, o foco vai para o título; ao fechar, volta ao botão da linha; aberta por link, vai para o `h1` "Relatórios";
  - títulos em ordem: o `h1` da página, o `h2` do `SheetTitle` e os `h3` das seções (Participantes, Visitantes, Pessoas da célula e Endereço da célula). Os campos ficam em `dl`, `dt` e `dd`;
  - as listas de nomes são `ul` com `aria-labelledby` no `h3`. A leitura segue o DOM, também em colunas;
  - o `SheetDescription` ("Célula de …") é lido junto com o título;
  - o rodapé fica no fim do DOM. Os elementos de cada tamanho ficam com `display: none` no outro (P80);
  - com o formulário por cima, o foco fica preso nele; ao fechar, volta a "Editar relatório". Depois de excluir, vai para o `h1` "Relatórios".
- **Anúncios:** o total da lista com `role="status"`, uma vez a cada aplicação ou atalho. O toast de cada ação. "Escolha até 10 pessoas." com `role="status"`. Os erros de carregamento em `Alert` (`role="alert"`) só depois de uma ação da pessoa ("Tentar de novo"); na primeira carga, sem `role="alert"`.
- **Sem depender de cor:** o atalho marcado é preenchido e tem `aria-checked`; "Célula realizada", "Não houve célula" e "Célula excluída" têm texto e ícone; "Pessoa indisponível" e "Célula indisponível" são texto; o "—" tem texto para o leitor de tela.
- **Contraste, nos dois temas:** 4,5:1 para o texto (o atalho marcado em `primary-foreground` sobre `primary`, os rótulos, as dicas, os chips, os badges e os rótulos dos números em `muted-foreground`); 3:1 para as bordas dos atalhos não marcados, dos campos, dos chips e do botão do `Popover`, e para o anel de foco.
- **Zoom de 200%, 320 px e fonte grande:** os atalhos passam a duas ou a uma coluna; os nomes, o endereço, o tema, o motivo, os chips e os badges quebram linha, sem `truncate` (o tema e o motivo, com `line-clamp-3` só na lista); os números quebram no "·"; as listas de nomes viram uma coluna. Nem a página, nem o `Sheet`, nem a consulta rolam na horizontal. A tabela só aparece a partir de 1280 px.
- **Toque:** os atalhos, "Filtros", "Limpar filtros", "Aplicar filtros", "Limpar", cada opção dos filtros (a linha inteira), as ações de cada cartão (44×44 px, 8 px entre si), o "✕" da consulta, os links da consulta, os botões do rodapé e o "⋯" têm pelo menos 44 px no celular. Os chips têm 36 px, com 8 px entre si.
- **Movimento:** as animações do `Sheet`, do `Collapsible`, do `Popover`, do `Skeleton` e do `ToggleGroup` respeitam `prefers-reduced-motion` (`motion-reduce:`).

### Critérios de UX
Numeração própria deste spec. "Hoje" é terça, 24/11/2026, às 21:00 de Brasília, pelo relógio do servidor.

| ID | Critério | Como verificar |
|---|---|---|
| UX-01 | Em 360×800 e em 768×1024, Relatórios mostra "Buscar", "Filtros" (44 px de altura) e os três atalhos, e nenhum campo de filtro na página. "Filtros" abre o `Sheet`, de baixo em 360 e da direita em 768, com Líder, G12, Período, Tipo e Reunião, nessa ordem, e a Célula antes deles só quando ela veio de um link. Em 1024×768 e em 1280×800, "Filtros" abre e fecha o painel acima da lista, com `aria-expanded`, não há `Sheet`, e os atalhos ficam fora do painel, entre "Filtros" e ele. | teste E2E (viewport) |
| UX-02 | Nenhum destes textos aparece no DOM de Relatórios, do painel ou da consulta: "presenças", "Presenças", "Realizada" ou "Não Realizada" sozinhos, "Não realizada", "Cancelada", "Status", "Desde", "Líder de Célula", "Relatórios da célula", "Relatórios de Células", "Célula sem líder", "Indiferente", "Modalidade", "Discipuladora", "doação", "dízimo", "Formato: dd/mm/aaaa" e "Close". A Reunião começa em "Todas"; no computador, o Tipo mostra "Todos" sem escolha. | teste de componente |
| UX-03 | Atalho (critérios da RN-10): em 360×800, Rita toca em "Esta semana" sem abrir o painel. A URL passa a ter `from=2026-11-22&to=2026-11-28`, sem `page`, com os outros parâmetros mantidos, e uma só requisição da lista é feita. A lista mostra R9 e R10, o atalho fica com `aria-checked="true"` e os outros com `"false"`, e aparecem os chips "De: 22/11/2026" e "Até: 28/11/2026" e "Filtros (1)". O foco continua no atalho. Tocar de novo em "Esta semana" não faz requisição e não o desmarca. "Semana passada" troca o Período e mostra R6 e R1; "Semana retrasada", R2 e R8. Com Líder: André aplicado, "Semana retrasada" mantém o Líder e mostra só R2. | teste E2E (massa) + teste de componente (rede simulada) |
| UX-04 | Marcação: Pedro digita De 15/11/2026 e Até 21/11/2026, e "Semana passada" fica marcada; com Até 20/11/2026, nenhum fica marcado, e os chips mostram as duas datas. Só "De" não marca nenhum. Um link com 22/11 a 28/11 aberto na terça, 01/12 (servidor), marca "Semana passada". Com o navegador em `Europe/Lisbon` (Playwright `timezoneId`) e o servidor no sábado, 28/11, às 23:30 de Brasília, "Esta semana" grava 22/11 a 28/11. No domingo, 29/11, às 00:00 de Brasília, grava 29/11 a 05/12. Mudar o relógio do navegador (`Date` simulado) não muda nada. | teste E2E (relógio e fuso) + teste unitário |
| UX-05 | Em 360×800, os três atalhos ficam numa linha, cada um com pelo menos 44 px de altura e o texto inteiro (em até duas linhas dentro do botão). Em 320×640 com zoom de 200%, ficam um por linha, sem rolagem horizontal. A partir de 640 px, ficam na largura do texto. Enquanto a data do servidor não chega (resposta atrasada), aparecem desabilitados, no mesmo lugar e com a mesma altura, e a lista não pula quando eles se habilitam; com a leitura da data falhando, continuam desabilitados, e a lista funciona. O nome acessível de cada um traz as datas ("Esta semana, de 22/11/2026 a 28/11/2026"). O grupo tem uma parada só de Tab, e as setas passam de um atalho para o outro. | teste E2E (viewport e medida) + teste de componente |
| UX-06 | No `Sheet`, marcar opções não faz nenhuma requisição da lista. "Aplicar filtros" faz uma só, fecha o painel, volta para a página 1 e devolve o foco a "Filtros". "✕" (44×44 px, com o nome "Fechar"), `Esc`, o toque fora e o voltar do navegador fecham sem mudar a lista nem a URL. "Limpar" esvazia os campos, inclusive a Célula, sem aplicar e sem apagar a busca. Ao abrir, o foco está no título "Filtros", e nenhum campo de texto está em foco. A Reunião tem uma opção por linha, cada uma com pelo menos 44 px de altura. | teste de componente (rede simulada) + teste E2E (360×800) |
| UX-07 | No painel do computador, cada mudança vale sem botão: as seleções na hora e as datas depois de conferidas. A lista volta para a página 1 e fica com `opacity-60` e `aria-busy="true"` até a resposta. O painel de Relatórios lembra se ficou aberto depois de recarregar, sem mudar o de Membros nem o de Células. Em 1024×768, o painel tem as linhas da T5, sem rolagem horizontal, com nomes de 40 caracteres no Líder e no G12. Tocar num atalho com o painel aberto atualiza "De" e "Até" nele. | teste de componente (relógio simulado) + teste E2E |
| UX-08 | No critério da RN-12 (Célula C1, Líder André e Débora, G12 Pedro, "Semana passada", Tipo Evangelística e Discipulado, Reunião Célula realizada), o botão mostra "Filtros (6)", com o nome acessível "Filtros (6 ativos)", e aparecem 9 chips, nesta ordem: Célula, Líder André Souza, Líder Débora Lins, G12 Pedro Alves, De, Até, Tipo Evangelística, Tipo Discipulado e Reunião: Célula realizada. A lista traz só R1. Tirar "Tipo: Discipulado" mantém "Filtros (6)". "Reunião: Todas" não vira chip. Só com a busca, o botão mostra "Filtros", sem número, e "Limpar filtros" aparece. Cada chip é um `button` de 36 px, com 8 px entre eles e `aria-label="Remover filtro …"`; o toque tira só aquele valor, sem "Aplicar filtros", e leva o foco ao próximo chip ou a "Filtros". | teste unitário (contagem e chips) + teste de componente + teste E2E (medida) |
| UX-09 | "Limpar filtros" fica logo depois de "Filtros", só aparece com filtro ativo ou busca e tem 44 px de altura. No critério da RN-12 (os filtros da UX-08, a busca "fe", a página 2 e 50 por página), ele deixa na URL só `size=50`, os campos e a busca vazios, nenhum atalho marcado e o foco em "Filtros". | teste E2E |
| UX-10 | Seletores (critérios da RN-05 e da RN-06): para Rita, o Líder oferece exatamente "André Souza (144)", "Débora Lins (1.728)", "Fábio Lima (1.728)", "Jonas Prado (Nível 5)", "Paula Alves (G12)" e "Samuel Colares (Pastor)", e o G12 oferece "Paula Alves", "Pedro Alves" e "Tânia Rocha". Para Pedro, o Líder oferece só André, Fábio, Jonas e Paula. Para Diego, Débora e Samuel. A busca sem resultado diz "Nenhum líder encontrado." ou "Nenhum G12 encontrado.". O menu fica aberto depois de cada escolha. Com 10 pessoas, as outras opções ficam desabilitadas, e "Escolha até 10 pessoas." aparece com `role="status"`. A dica do Negócio está no `aria-describedby` de cada seletor. | teste de componente + teste E2E (massa) |
| UX-11 | Pessoa indisponível (critérios da RN-07): Pedro abre um link com Líder: Débora. O campo e o chip mostram "Pessoa indisponível", com "Esta pessoa não está disponível para você.", o total é "0 relatórios", e aparece o vazio com filtros. "Débora" e o id dela não estão no DOM nem nas respostas, e a tela não chama a `member_names`. Com Débora e André, a lista mostra R1, R2 e R4; tirar o chip indisponível tira o id da URL. Lia, com Líder: André, vê "André Souza (144)" e R1, R2 e R4; com Líder: Caio, vê "Pessoa indisponível". Um id excluído e um que não existe dão a mesma tela. "xyz" sai da URL e não conta. | teste E2E (rede inspecionada) + teste de componente |
| UX-12 | Período (critérios da RN-09): os campos são dois `input type="date"`, "De" e "Até", num `fieldset` com a legenda visível "Período", sem `min` nem `max`. Até 28/11/2026 é aceito hoje, sem mensagem. De 21/11 e Até 15/11 mostram "O fim do período precisa ser igual ou posterior ao início." embaixo de "Até", com `aria-invalid`; no computador, a lista fica sem o Período; no celular, "Aplicar filtros" não fecha o painel, põe o foco no campo e não faz requisição. 31/02/2026, ao sair do campo, mostra "Data inválida. Use o formato dd/mm/aaaa.", e nunca durante a digitação. De 11/11 até 11/11 mostra só R2. | teste de componente + teste E2E (massa) |
| UX-13 | Tipo e Reunião (critérios da RN-11): Tipo: Discipulado traz R9, R8 e R5; Reunião: Não houve célula traz só R2, e Célula realizada traz os outros 7. No `Sheet`, o Tipo tem caixas de seleção com a dica embaixo da legenda, e a Reunião tem o `RadioGroup` com "Todas" marcada. No computador, o Tipo é o botão do P51 com `Popover`, e a Reunião é um `Select`. Os chips são "Tipo: Discipulado" e "Reunião: Não houve célula". A dica do Tipo aparece sempre (PO-UX-2). | teste de componente + teste E2E (massa) |
| UX-14 | Célula (critérios da RN-08): Pedro, por "Ver todos os relatórios" do detalhe de C1, vê o chip "Célula de André Souza · Quarta · 20:00" como o primeiro chip, "Filtros (1)", nenhum atalho marcado, "4 relatórios" e R1, R2, R4 e R5; com "Semana passada", só R1 e "Filtros (2)"; "Limpar filtros" tira os dois e mostra os 6. No `Sheet`, a Célula é o primeiro bloco; o "✕" dela some com o bloco e põe o foco no Líder, e a lista só muda em "Aplicar filtros"; fechar com "✕" mantém a Célula. No computador, o "✕" da Célula no painel vale na hora. Diego vê "Célula indisponível", a dica e a lista vazia. Rita, pela consulta de R6, vê "Célula de Jonas Prado · Sexta · 20:00" e R6 com "Célula excluída". O título continua "Relatórios". | teste E2E (massa) + teste de componente |
| UX-15 | A URL segue a tabela de Navegação e rotas, com os nomes que o `architect` confirmar e sem os valores padrão. Recarregar, voltar no navegador e abrir o link mostram os mesmos filtros, o mesmo atalho marcado, os mesmos chips e o mesmo total. Mudar um filtro ou tocar num atalho não cria entrada no histórico. Com `type=abc&held=no`, `type` sai da URL, o botão mostra "Filtros (1)", e Rita vê só R2 (critério da RN-12). | teste E2E |
| UX-16 | Links prontos (RN-18), com Rita: `/cell-reports?from=2026-11-22&to=2026-11-28` mostra "Esta semana" marcada e "2 relatórios" (R9 e R10), e a soma dos visitantes das linhas é 8; com `&held=yes`, 2; com `&held=no`, 0, com o vazio com filtros. Pedro, com o primeiro link, vê "1 relatório" (R9). | teste E2E (massa) |
| UX-17 | Linha (critérios da RN-15), em 360×800 e em 1280×800: R1 mostra "André Souza", "G12: Pedro Alves", "Qua, 18/11/2026 · 20:00" (lido como "Quarta"), "Rua das Flores, 100 · Centro", "Célula realizada", "Tema: A fé que vence", "Participantes: 8", "Visitantes: 2" e "Oferta: R$ 50,00", sem as observações; R2 mostra "Não houve célula" e "Motivo: Chuva forte no bairro", sem números nem oferta (na tabela, "—", lido como "não se aplica"); R10 mostra "Samuel Colares" e "G12: Pastores"; R5, "Fábio Lima" e "G12: Pedro Alves"; R6, "Célula excluída" e nenhum "Editar". Um relatório de C8 mostra "G12: —", lido como "nenhum". Um relatório sem oferta registrada mostra "Oferta: Não informada". Lia e Diego veem os mesmos nomes de líder e de G12. Um tema de 300 caracteres ocupa no máximo 3 linhas na lista e aparece inteiro na consulta. | teste E2E (massa) + teste de componente |
| UX-18 | Relatórios mostra cartões numa coluna em 360×800 e em 768×1024, cartões com duas colunas em 1024×768 (o G12, a data e o endereço à esquerda; os badges, o tema e os números à direita, com a mesma ordem do DOM do celular) e a tabela em 1280×800 e em 1440×900, com as colunas Célula, Data e horário, Reunião, Participantes, Visitantes, Oferta e Ações, nessa ordem. No primeiro render, 360 px já mostra cartões e 1280 px já mostra a tabela. Em 1280×800, com nomes de 40 caracteres e endereço de 50, a tabela não rola na horizontal. | teste E2E (viewport) + teste de componente (`matchMedia` simulado) |
| UX-19 | Abrir a consulta (P91): em 360×800, tocar em qualquer ponto do cartão de R1 fora das ações abre a consulta de R1; tocar em "Editar" ou no "⋯" abre a ação, e não a consulta. O botão tem o nome "Ver o relatório de 18/11/2026, André Souza" e `aria-haspopup="dialog"`, e o anel de foco envolve o cartão. Em 1280×800, o nome do líder é o botão, e o clique na linha também abre a consulta, menos nos ícones. Ao fechar, o foco volta ao botão que abriu. Não há ícone `Eye` na coluna Ações. Isso vale para todas as linhas e para Caio, Lia e Diego, sem "Editar Relatórios de Células". | teste E2E (viewport) + teste de componente |
| UX-20 | Conteúdo da consulta (critérios da RN-16 e da RN-17), Caio em R1: o título "Relatório de 18/11/2026"; "Célula de André Souza · Quarta · 20:00"; o badge "Célula realizada"; "Enviado por Caio Lima em 18/11/2026 às 21:40"; a seção "Reunião" com "Quarta, 18/11/2026 às 20:00"; o tema; "Participantes (8)" com André, Beatriz, Caio, Carla, Débora, Gabriel, Jonas e Sara, nessa ordem no DOM e sem link; "Visitantes (2)" com João Pereira e Maria Lima; "R$ 50,00"; as observações; Líder André, Timóteo Caio, Anfitrião Carla, G12 Pedro e Tipo Evangelística; e o endereço de C1. Os participantes vêm antes de "Pessoas da célula" no DOM. Em 360 px, os nomes ficam em duas colunas; em 320 px com zoom de 200%, em uma. Rita em R5 vê Líder Fábio e Tipo Discipulado, com "Célula de André Souza" no topo e a dica das pessoas. Rita em R2 vê "Não houve célula", "Reunião prevista" e o Motivo, sem Tema, Participantes, Visitantes e Oferta. A dica das pessoas aparece sempre (PO-UX-2). | teste E2E (massa) + teste de componente |
| UX-21 | Ações da consulta (critério da RN-16): Caio vê "Ver célula" e "Ver todos os relatórios desta célula", sem rodapé. Pedro vê os dois links e, em 360×800, o rodapé fixo com "Editar relatório" (44 px) e o "⋯" com "Excluir relatório"; em 1280×800, "Excluir relatório" e "Editar relatório" com texto, no rodapé. Rita em R6 vê o badge e o aviso do E2.01 com "Ver células excluídas", "Ver todos os relatórios desta célula" e, no rodapé, só "Excluir relatório" com texto, mesmo em 360 px, sem "Editar relatório" e sem "Ver célula". Lia em R1 não vê "Ver célula". O leitor de tela nunca encontra a mesma ação duas vezes. O rodapé fica acima da área segura e não cobre o fim do conteúdo. | teste E2E (viewport e medida) + teste de componente |
| UX-22 | Endereço e histórico da consulta: abrir pela linha acrescenta `report=<id>` e cria uma entrada no histórico; o voltar do navegador fecha a consulta e mantém os filtros, a página e a rolagem da lista; recarregar com a consulta aberta a reabre sobre a mesma lista. "Ver todos os relatórios desta célula" leva a `/cell-reports?cell=<id>` (com o `size` mantido), e o voltar devolve a lista anterior com a consulta aberta. "Ver célula" leva a `/cells/<id>`. Com `report=xyz`, o parâmetro sai, e a lista abre sem consulta. | teste E2E |
| UX-23 | Pedro abre o link da consulta de R8, de R3 (excluído) e de um id com formato válido que não existe, e recebe o mesmo DOM: o título "Relatório não encontrado", a frase do Negócio e "Fechar", com o foco no título, sem nenhum dado do relatório no DOM nem nas respostas. "Fechar" tira o `report` da URL. Hugo, com o mesmo link, vê a tela sem acesso do E2.02, sem consulta. | teste E2E (rede inspecionada) |
| UX-24 | Depois de gravar (T13): Pedro usa "Editar relatório" em R1, o formulário abre por cima da consulta, ele muda o tema e salva; o formulário fecha, a consulta mostra o tema novo sem recarregar, a linha também, e o foco volta a "Editar relatório". "Cancelar" no formulário devolve a consulta igual. Pedro exclui R4 pela consulta: a confirmação do E2.01 abre por cima, e, ao confirmar, a consulta fecha, o `report` sai da URL, R4 sai da lista e do total, o toast "Relatório excluído." aparece, e o foco vai para o `h1` "Relatórios". | teste E2E (massa) |
| UX-25 | Carregando e erro da consulta: aberta pela linha, com a leitura atrasada, o título, a célula, o badge, a data, o tema e os números aparecem antes da resposta, e o resto mostra `Skeleton`, sem rodapé. Aberta por link, o título é "Relatório", e o corpo é `Skeleton`. Na falha da leitura, aparecem o `Alert` do Negócio e "Tentar de novo". Na falha só dos participantes, a mensagem da seção, e o resto funciona. | teste de componente (mock) |
| UX-26 | Estados da lista: o total aparece como "{N} relatórios" ("1 relatório", "1.234 relatórios") acima da lista, com `role="status"`, e no rodapé. Com filtros ou busca e nenhum resultado, aparecem "Nenhum relatório encontrado com estes filtros." e "Limpar filtros" (`outline`, 44 px), e os atalhos continuam. Na primeira carga, 5 `Skeleton` no formato dos cartões ou das linhas, sem o "Carregando..." solto. Na falha, o `Alert` do Negócio com "Tentar de novo", e a busca, os atalhos, "Filtros" e os chips continuam funcionando. | teste de componente (mock) |
| UX-27 | Toque, em 360×800: os atalhos, "Filtros", "Limpar filtros", "Aplicar filtros", "Limpar", cada opção dos filtros (a linha inteira), as ações de cada cartão (44×44, com 8 px entre si), o "✕" da consulta, "Ver célula", "Ver todos os relatórios desta célula", "Editar relatório" e o "⋯" do rodapé têm pelo menos 44 px. Os chips têm 36 px, com 8 px entre si. | teste E2E (medida) |
| UX-28 | Em 320×640, com zoom de 200% e com a fonte grande, a lista, os atalhos, o `Sheet` e a consulta não rolam na horizontal. Nomes, endereço, tema, motivo, chips, badges e os textos dos links quebram linha sem corte; os números quebram no "·"; o rodapé fixo da consulta não cobre o fim do conteúdo. | teste E2E (viewport) + inspeção |
| UX-29 | Semântica: na consulta, os títulos seguem `h1` (a página) → `h2` (o `SheetTitle`) → `h3` (as seções), os campos estão em `dl`, e as listas de nomes são `ul` com `aria-labelledby`. Na lista, a tabela tem `caption` em `sr-only`, e os `th` têm `scope="col"`. O leitor de tela ouve o dia inteiro no lugar do abreviado e não ouve os "·". No painel, Período, Tipo e Reunião são `fieldset` com `legend`, e as dicas estão no `aria-describedby` certo. | teste de componente + inspeção (axe e leitor de tela) |
| UX-30 | O contraste é de 4,5:1 para o texto (o atalho marcado, os rótulos, as dicas, os chips, os badges e os rótulos dos números) e de 3:1 para as bordas dos atalhos, dos campos e dos chips e para o anel de foco, nos temas claro e escuro. O atalho marcado se distingue dos outros em escala de cinza. Nenhum estado depende só de cor. | inspeção (axe, nos dois temas) |
| UX-31 | Nenhum texto técnico aparece na lista, no painel nem na consulta: nada de id, código de erro, "statement timeout", nome de parâmetro da URL nem o "Close" do `sheet.tsx`. Uma falha de leitura vira o `Alert` do Negócio. | teste de componente (mock) |
| UX-32 | Só se a alternativa for adotada (T16): com a da Q-1, Caio vê só os números de participantes e de visitantes na consulta, e Pedro vê os nomes; com a da Q-2, o menu tem os três subitens, com 44 px; com a da Q-4, a lista abre com "Esta semana" marcada e "Filtros (1)", e "Limpar filtros" mostra todos, também depois de recarregar. | teste de componente + teste E2E |

### Perguntas para o `architect` (dados e contrato)
Em cada uma, a tela tem um comportamento padrão (o mais conservador) se a resposta for "não", menos onde está dito que não há.

- **AQ-1. Parâmetros da URL** (RN-12, Navegação e rotas). Confirmar os nomes e os valores, ou trocá-los.
  - Sugestão: um módulo só (por exemplo, `src/lib/cell-reports/filters.ts`), como o de Membros e o de Células. Ele lê e valida a URL, monta a consulta, conta os filtros ativos (1 a 6), monta os chips na ordem da UXD-2, calcula o atalho marcado a partir da data do servidor e gera os links prontos da RN-18 para o E2.14. A exportação do E2.13 pode usar o mesmo.
  - O `cell-filter.ts` do E2.10 passa para dentro dele.
  - *Padrão sem isso:* os nomes da tabela.
- **AQ-2. A data de hoje, em Brasília, segundo o servidor** (RN-10, P90, UXD-4). Os atalhos precisam dela antes do primeiro toque, sem depender da lista (por exemplo, junto com o `my_access` do E2.02, ou numa leitura leve, guardada na sessão e lida de novo ao voltar para a aba). A mesma data marca o atalho, e a virada de domingo aparece na leitura seguinte.
  - *Padrão sem isso:* não há. O relógio do aparelho não pode ser usado (RN-10). Sem a data, os atalhos ficam desabilitados.
- **AQ-3. A linha da lista** (RN-13 a RN-15). Por linha: o líder registrado (nome), o G12 do relatório com a marca de pastor e de "sem liderança" (para "Pastores" e "—"), o endereço atual da célula, a data, o horário, a reunião, o tema, o motivo, os números de participantes e de visitantes, a oferta (nula ou não), `cell_deleted`, `cell_id` e o que decide "Editar" (célula não excluída). A ordem e o total exato, em até 2 s. Um tempo-limite volta como erro de leitura, sem texto técnico (UX-31).
  - As observações e a lista de visitantes saem da linha se a consulta as ler à parte (AQ-6). O tema e o motivo vêm inteiros: o corte de 3 linhas é só visual.
- **AQ-4. Opções e nomes do Líder e do G12** (RN-05 a RN-07). As opções saem dos relatórios visíveis: id, nome e, no Líder, o nível com a marca de pastor e o sexo (P40). Busca sem acento e 20 por página, para o `PaginatedSelect`. Os ids da URL são resolvidos pela mesma fonte, com o nome só nos casos da RN-07, e a mesma resposta vazia nos outros. Nunca pela `member_names`.
  - *Padrão sem isso:* não há. Sem essa leitura, o seletor mostraria nomes fora do escopo ou perderia os nomes de referência.
- **AQ-5. Célula** (RN-08, P93). A `cell_identity` e o `RecordFilterChip` do E2.10, sem mudança. A lista filtrada usa o mesmo filtro, com o total exato.
- **AQ-6. A leitura da consulta** (RN-16, RN-17, P92). Uma leitura por id com tudo da T10:
  - a data, o horário, a reunião, o tema, o motivo, as observações, a oferta e os visitantes;
  - a célula com os dados atuais (o líder, o dia, o horário e o endereço completo) e `cell_deleted`;
  - o líder, o timóteo e o anfitrião do retrato, o G12 do relatório e o tipo registrado;
  - a autoria (E2.05);
  - o que decide cada ação: "Editar relatório" (permissão e célula não excluída), "Excluir relatório" e "Ver célula" (se quem consulta vê a célula, como a `cells_view`);
  - os participantes, pelo nome, em ordem alfabética sem diferenciar acentos (collation pt-BR), sem corte, numa leitura que pode falhar à parte (T12).

  A mesma resposta, sem nenhum dado, para o relatório invisível, o excluído e o inexistente. Aberta pela linha, a linha já carregada serve de `placeholderData`; se a leitura disser "não encontrado", o que veio da linha é descartado.
  - *Padrão sem isso:* a consulta abre com `Skeleton` até a leitura chegar, como por link.
- **AQ-7. Retrato gravado ou não** (RN-04, UXD-12). A tela precisa saber, por relatório, se as pessoas e o tipo são do retrato (depois do E2.11 ou da carga do legado) ou da célula atual (transição), para mostrar ou esconder a dica das pessoas e a do Tipo. Se o E2.12 só entrar depois do E2.11 e da carga, e nenhum relatório ficar sem retrato, a dica aparece sempre, e a pergunta cai.
  - ***Respondida pelo PO (PO-UX-2):** a pergunta cai. Todo relatório tem o retrato (RN-21 do E2.11), e este passo entra depois do E2.11. As duas dicas aparecem sempre.*
- **AQ-8. Histórico do navegador e a consulta** (UXD-11). Abrir pela linha com `push`; o voltar fecha. O "✕", o `Esc` e o toque fora voltam uma entrada quando a consulta foi aberta pela linha, e tiram o parâmetro com `replace` quando ela veio por link (para não sair de Relatórios). "Ver célula", "Ver todos os relatórios desta célula" e "Ver histórico" com `push`. Hoje o `useListSearchParams` usa `replace` para tudo.
  - *Padrão sem isso:* abrir e fechar com `replace`, e o voltar do aparelho sai de Relatórios. É o comportamento de hoje do E2.01, pior no Android.
- **AQ-9. Formulário de edição por cima da consulta** (UXD-10, T13). Dois diálogos do Radix empilhados (o `Sheet` e o do P1): o foco fica preso no de cima, e o `Esc` fecha só ele. O voltar do aparelho com o formulário aberto segue a regra do formulário (o "Descartar as alterações?" do E2.04 e do E2.11), e não fecha a consulta por baixo. Depois de salvar, a consulta e a lista recarregam (chave da consulta sob `["cell_reports"]`), além do que o E2.09 e o E2.10 já desatualizam (`refreshAfterReportWrite`).
  - *Padrão sem isso:* "Editar relatório" fecha a consulta e abre o formulário; ao salvar, a consulta reabre com os valores novos.
- **AQ-10. Depois de excluir pela consulta** (T13). A ordem: fechar a consulta (tirar o `report`), recarregar a lista e pôr o foco no `h1`. A lista nunca deve mostrar o relatório excluído vindo do cache.
- **AQ-11. Troca em 1280 px** (UXD-5, P74). Relatórios deixa de usar o `useIsMobile` (768 px) e passa ao hook com `matchMedia` do E2.06 e do E2.09 (`use-min-width`), com 1280 px e o valor certo no primeiro render. O painel continua em 1024 px.
- **AQ-12. Valores fora da regra pela API** (11 ids, datas invertidas ou impossíveis, tipo desconhecido, `held` fora de `yes`/`no`, `cell` ou `report` sem formato). A tela valida antes e nunca os envia. Definir o que o servidor faz se receber, como a DA-1 do E2.10.
  - *Padrão sem isso:* toda recusa da leitura vira o `Alert` de erro ao carregar.
- **AQ-13. O "✕" dos `Sheet`** (consulta e filtros). O botão embutido do `sheet.tsx` tem 16 px e o texto "Close". Sem editar o arquivo de `ui/`, o `SheetContent` esconde o embutido pela `className` (por exemplo, `[&>button:last-child]:hidden`) e a tela põe o seu, com 44×44 px e "Fechar". Vale também para os `Sheet` de filtros de Membros, Células e Auditoria, se eles ainda usarem o embutido.

### Pendências para o PO (resolvidas em 2026-11-24)
Nenhuma bloqueia o desenho. Em todas, a UX adotou a opção marcada como "*Adotado*".

O PO resolveu as doze em 2026-11-24, sem perguntas ao usuário, todas com o padrão da UX. Na PO-UX-2, o PO acrescentou que a dica aparece sempre, por causa do E2.11. Na PO-UX-10, a sugestão da UX não foi adotada. Elas viraram os padrões P-LRE-23 a P-LRE-34 do Negócio. **Revisar no PR.**

No Negócio, junto com a revisão pelo E2.11 (todo relatório tem o retrato, RN-21 de lá), mudaram:
- os Termos (retrato e relatório visível), as Decisões e a persona SF;
- as RN-03, RN-04, RN-08, RN-10, RN-12, RN-14, RN-15, RN-16 e RN-17, com os critérios delas e o da RN-01;
- os Textos de tela, as Telas que mudam, os Impactos (E2.11 e E4.04) e os Pontos para o `architect` (1, 9, 10, 11 e 12).

Nesta seção, o PO só ajustou o que a decisão muda:
- tirou a condição "só com o retrato gravado" da UXD-12, da T4, da T10, dos Textos, do UX-13 e do UX-20, e marcou a AQ-7 como respondida;
- acrescentou na T10 o título "Reunião" da seção do conteúdo e, em "Não houve célula", o rótulo "Reunião prevista", com os nomes do E2.11 (no lugar do antigo "Detalhes do Encontro"). Fez o mesmo na variação de R2 da T11, nos Textos e no UX-20.

- **PO-UX-1. A ordem da consulta** (UXD-8, T10). O conteúdo do relatório (data, tema, participantes, visitantes, oferta, motivo e observações) vem antes das pessoas da célula, do tipo e do endereço. Os Textos de tela listam as seções em outra ordem (Data e horário, Pessoas da célula, Tipo, Endereço, Tema…).
  - *Adotado:* o conteúdo primeiro, porque a história é "ver quem participou e quem visitou", e no celular os participantes ficariam na segunda tela.
  - *Alternativa:* a ordem dos Textos de tela.
  - **Resolvida: aceito o padrão da UX (P-LRE-23; RN-16 b).** A RN-16 passou a listar a consulta em ordem: o topo (célula, reunião e autoria), a seção "Reunião", as pessoas da célula e o endereço com os links. Os Textos de tela seguem a mesma ordem. A seção do conteúdo ganhou o título "Reunião", o nome do E2.11.
- **PO-UX-2. A dica de "Pessoas da célula"** (UXD-12). O texto do Negócio ("Como estavam quando o relatório foi enviado.") vale para o líder, o timóteo, o anfitrião e o tipo, mas não para o G12, que é o atual (RN-06).
  - *Adotado:* "Líder, timóteo, anfitrião e tipo como estavam no envio. O G12 é o de hoje." †, e as duas dicas (esta e a do Tipo no filtro) só aparecem com o retrato gravado (AQ-7).
  - *Alternativa:* a dica do Negócio, e o G12 fora da seção "Pessoas da célula".
  - **Resolvida: aceito o texto da UX, e as duas dicas aparecem sempre (P-LRE-24; RN-04, RN-16 b).** Pela RN-21 do E2.11, todo relatório tem o retrato, e este passo entra depois dele: a condição "só com o retrato gravado" e a AQ-7 caem. Nos relatórios do legado sem tipo, o tipo é o da célula na carga (P-REL-18 do E2.11), e o relatório de carga conta quantos.
- **PO-UX-3. Os atalhos de semana** (UXD-3, P90).
  - *Adotado:* numa linha própria, depois de "Filtros" e antes dos chips, em todas as larguras; o atalho marcado fica preenchido; tocar de novo nele não o desmarca (tira-se o Período pelo chip ou por "Limpar filtros"); sem a data do servidor, ficam desabilitados.
  - *Alternativa:* tocar de novo no atalho marcado tira o Período. É mais rápido, mas, no 3G, quem toca de novo porque a lista demorou perde o filtro sem perceber.
  - **Resolvida: aceito o padrão da UX (P-LRE-25; RN-10).** A RN-10 ganhou o toque repetido, que não muda nada, e os atalhos desabilitados sem a data do servidor, sem usar o relógio do aparelho. Ganhou também três critérios: o toque repetido, o chip "De" que desmarca o atalho e o atalho sem a data do servidor.
- **PO-UX-4. A Reunião uma por linha no `Sheet`** (UXD-2). O P52 põe as opções de escolha única lado a lado, mas "Célula realizada" e "Não houve célula" não cabem em 360 px.
  - *Adotado:* uma por linha, com 44 px cada.
  - **Resolvida: aceito (P-LRE-26).** Só a apresentação muda; nenhuma RN muda.
- **PO-UX-5. A Célula no painel** (UXD-2, P93).
  - *Adotado:* o primeiro bloco do painel e o primeiro chip. No `Sheet`, o "✕" dela só vale em "Aplicar filtros", e, depois de tirada, ela não volta pelo painel (não há seletor, P-LRE-06); fechar sem aplicar a mantém.
  - *Alternativa:* a Célula por último, na ordem da RN-01.
  - **Resolvida: aceito o padrão da UX (P-LRE-27; RN-08, RN-12).** A RN-08 diz que a Célula vem em primeiro, que tirá-la no painel do celular vale em "Aplicar filtros" e que ela só volta por um link. A RN-12 traz a ordem do painel e dos chips: Célula, Líder, G12, Período, Tipo e Reunião. A RN-08 ganhou critérios para os dois casos.
- **PO-UX-6. Onde ficam as ações da consulta** (UXD-9). "Ver célula" e "Ver todos os relatórios desta célula" no corpo, na seção "Endereço da célula"; "Editar relatório" no rodapé fixo; "Excluir relatório" no "⋯" do rodapé no celular, ou com texto quando for a única ação (célula excluída) e a partir de 768 px. Quem não edita nem exclui não tem rodapé.
  - *Adotado.*
  - *Alternativa:* as quatro no rodapé. No celular, isso pede um "⋯" com três itens ou um rodapé de três linhas.
  - **Resolvida: aceito (P-LRE-28; RN-16 b).** As regras das ações não mudam. Só o lugar delas entrou na RN-16 e no critério de Caio, que agora diz que a consulta não tem rodapé de ações.
- **PO-UX-7. "Editar relatório" pela consulta** (UXD-10). O formulário abre por cima da consulta e, ao salvar, a consulta mostra os valores novos (RN-16 e). O E2.01 (T7) tinha previsto fechar a consulta antes de abrir o formulário.
  - *Adotado:* por cima.
  - *Alternativa:* fechar a consulta, abrir o formulário e reabrir a consulta depois de salvar (é também o padrão técnico se a AQ-9 não for possível).
  - **Resolvida: aceito o padrão da UX, com a alternativa como saída técnica (P-LRE-29; RN-16 e).** A RN-16 (e) diz que salvar volta para a consulta com os valores novos e que cancelar a devolve como estava. Se a AQ-9 não for possível, vale a alternativa (ponto 12 para o `architect`), com o mesmo resultado. A RN-16 ganhou critérios para salvar e para cancelar.
- **PO-UX-8. Tema e motivo com até 3 linhas na lista** (UXD-6). O texto inteiro fica na consulta, a um toque.
  - *Adotado.*
  - *Alternativa:* o texto inteiro também na lista.
  - **Resolvida: aceito (P-LRE-30; RN-15).** A RN-15 e os Textos de tela dizem "até 3 linhas", e a RN-15 ganhou um critério com um tema de 6 linhas.
- **PO-UX-9. O título "Relatórios" e o botão "Novo relatório"** (UXD-14), no lugar de "Relatórios de Células" e "Novo Relatório". O título é o do menu e não muda com os filtros (P-LCE-32).
  - *Adotado.*
  - **Resolvida: aceito (P-LRE-31).** O título e o botão entraram nos Textos de tela, nas Telas que mudam e no critério da RN-01. "Relatórios de Células" e "Novo Relatório" foram para o "Evitar".
- **PO-UX-10. O dia da semana na lista** (UXD-15). O critério da RN-15 usa o dia abreviado ("Qua, 18/11/2026 · 20:00"), e a lista e o detalhe de Células usam "Quarta".
  - *Adotado:* o do Negócio ("Qua"), com o dia inteiro para o leitor de tela. Na consulta, "Quarta, 18/11/2026 às 20:00".
  - *Sugestão:* "Quarta, 18/11/2026 · 20:00" também na lista, como em Células. Custa uns 25 px na coluna da data da tabela, que cabe em 1280 px. O critério da RN-15 mudaria junto.
  - **Resolvida: aceito o padrão da UX, sem a sugestão (P-LRE-32; RN-15).** Na lista, a data funciona como um carimbo, e a forma curta é comum em datas. Em Células, o dia é a reunião da célula, sem data, e a forma longa ali não pede a mesma forma aqui. A forma curta também poupa a coluna da tabela. A RN-15 e os Textos de tela dizem "dia abreviado", com o dia inteiro para o leitor de tela.
- **PO-UX-11. Textos definidos pela UX** (marcados com † em Textos):
  - "Relatórios" como título;
  - "Atalhos de semana", o nome do grupo para o leitor de tela;
  - "Fechar" no "✕" dos `Sheet`;
  - as colunas "Célula" e "Data e horário" e a legenda da tabela;
  - "Relatório" como título da consulta enquanto carrega por link e no erro;
  - a dica das pessoas da célula (PO-UX-2);
  - o erro só dos participantes;
  - os textos para o leitor de tela (o dia inteiro, "nenhum", "Ver a célula de {Líder}" e "Ver todos os relatórios da célula de {Líder}");
  - os textos das alternativas da T16, que só valem se a pergunta for respondida com a alternativa.
  - *Adotados.*
  - **Resolvida: todos aceitos, sem ajuste (P-LRE-33).** Os que estão ligados a uma regra foram copiados para os Textos de tela do Negócio: o título, o grupo dos atalhos, o "Fechar", as colunas da tabela, o título "Relatório", a dica das pessoas, o erro dos participantes e os nomes "Ver a célula de {Líder}" e "Ver todos os relatórios da célula de {Líder}". O PO acrescentou "Reunião" e "Reunião prevista", do E2.11.
- **PO-UX-12. "Não houve célula" do legado com dados** (T11). Pela RN-21 do E2.11, esses relatórios chegam com o tema, a oferta, os visitantes e os participantes que tiverem. A RN-15 e a RN-16 escondem esses dados na linha e na consulta, então eles ficam gravados, mas não aparecem em nenhuma tela de Relatórios.
  - *Adotado:* seguir a RN-15 e a RN-16, sem mudança.
  - *Alternativa:* mostrar na consulta o que o relatório tiver, também em "Não houve célula". O E4.04 já lista esses relatórios para o saneamento.
  - **Resolvida: aceito o padrão da UX, com uma linha de saneamento (P-LRE-34; RN-15, RN-16 b, RN-17).**
    - Em "Não houve célula", a linha e a consulta mostram só o motivo e as observações. É o que o E2.11 grava nos relatórios novos (RN-09 de lá), o que o detalhe da célula mostra (RN-17 do E2.10) e o que o vínculo celular considera (P-FIL-08 do E2.07). Mostrar participantes numa reunião que não aconteceu confundiria.
    - Os dados continuam gravados. A RN-15, a RN-16 e a RN-17 dizem isso, e há critérios com um relatório de C3 vindo do legado.
    - Os Impactos ganharam a linha de saneamento do E4.04: listar esses relatórios para a liderança, que decide no E4.05 se corrige no legado antes da carga. A linha completa a lista que o E2.11 já pede (Impactos e "Dados do legado" de lá).

## Solução técnica
_Seção do `architect`. Escrita em 2026-11-24, só como desenho: nada foi implementado. **O PR 1 começa depois do E2.01 inteiro, do PR 1 do E2.02, do banco do E2.05, do PR 1 do E2.06, do PR 2 do E2.08, do banco do E2.09, do PR 1 do E2.10 e do E2.11 inteiro (os dois PRs de banco em produção e o PR 4 de front promovido)** (ver [Ordem com os outros passos](#ordem-com-os-outros-passos)). O desenho parte do estado final desses passos, com os nomes que eles definem. Se um nome ou uma assinatura mudar lá, a tarefa 1 volta ao `architect`._

_Conferido em 2026-11-24, só com leitura:_
- _na stack local `supabase_db_mci-e108-pr2` (E1.08 e PRs 1 e 2 do E2.01):_
  - _a definição da `cell_reports_view` e da `cell_report_participants_view` (`security_barrier`, *definer*; a de participantes junta a de relatórios) e os índices de `cell_reports` (`cell_reports_date_id_idx (date DESC, id)`, `cell_reports_cell_id_date_idx`, `cell_reports_cell_week_key`) e de participantes (PK `(report_id, member_id)` e `member_id`);_
  - _`cell_reports.date`, `time` e `was_held` são `NOT NULL`; `offering` é anulável. A ordem `date DESC, time DESC, id` é total;_
  - _o corpo da `dashboard_summary`: `reports_sent`, `visitors` e `cells_not_held` contam a `cell_reports_view` com `date BETWEEN week_start AND week_end`, e `visitors` soma o `visitors_count` de todos os relatórios da semana, inclusive os de "Não houve célula";_
  - _`sp_today()`, `week_start(date)` e `search_normalize(text)` com EXECUTE para `authenticated`; `authenticated` sem USAGE em `private`;_
  - _o *leakproof* dos operadores: `uuid_eq`, `texteq`, `booleq`, `date_ge`, `date_le` e `date_eq` são *leakproof* e entram na view *security barrier*; `texticlike` (o `ILIKE`) não é e roda acima dela;_
  - _a virada da semana: 02:59:59 UTC de domingo, 29/11/2026, é sábado, 28/11, em Brasília (semana de 22/11); 03:00:00 UTC já é domingo, 29/11 (semana de 29/11);_
  - _os dados locais: nenhum visitante com nome vazio, nenhum "Não houve célula" com tema, oferta ou visitantes, uma oferta nula;_
- _no `mci-connect` (`origin/main`, `4595daa`): `CellReports.tsx`, `use-cell-reports-list.ts` (página com `count=exact` e uma segunda consulta para o número de participantes), `src/lib/cell-reports/fields.ts`, `use-list-search-params.ts` (tudo com `replace`) e `ui/sheet.tsx` (o "✕" embutido é o último filho do `SheetContent`); na branch `feat/E2.01-pr4-ver-relatorio`, o `CellReportSheet` (que já esconde o "✕" embutido com `[&>button:last-child]:hidden` e põe um de 44 px), o `use-cell-report`, o `use-cell-report-participants` e o `report-sheet.ts` (a consulta só abre para relatório de célula excluída e para quem edita);_
- _nos specs: E2.02 (funções de linha, `viewer_sees_cell_people`, `my_access`), E2.05 (colunas de autoria das views, `RecordAuthorship`), E2.06 (`private.member_hierarchy`, `g12_id` gerado e indexado, GIN em `ancestor_ids`, `refreshAfterMemberWrite` e `refreshAfterCellWrite` com `["cell_reports"]`, `src/lib/hierarchy/level.ts`), E2.07 (componentes P50 a P54, `src/lib/filters/*`), E2.09 (`sp_local`, `refreshAfterReportWrite`, `useMinWidth(1280)`), a Solução técnica do E2.10 inteira (o molde deste desenho) e a do E2.11 (retrato, colunas da view, `viewer_sees_report_people`, `save_cell_report`, DA-12), e o Negócio do E2.13 e do E2.14 (sem commit, só lidos)._

_O SQL de referência não foi executado num banco com os passos anteriores, porque eles ainda não existem. A tarefa 2 roda as migrations num banco zerado depois das dos passos anteriores, com as pós-condições._

### Revisão das regras
Nenhuma RN voltou ao PO. As lacunas técnicas foram resolvidas pela leitura mais conservadora e estão em [Definidas pelo architect](#definidas-pelo-architect-revisar-no-pr). As perguntas Q-1 a Q-7 ficam com o usuário: o desenho segue os padrões adotados, e o custo de cada alternativa está em [Perguntas Q-1 a Q-7](#perguntas-q-1-a-q-7-padrão-e-custo-das-alternativas).

Casos de borda conferidos:
- **Fuso e virada da semana:** a data do relatório (`date`) já é a data de Brasília, então o Período compara datas, sem fuso. Os atalhos vêm de `server_weeks()`, com `sp_local(now())` e `week_start`, as mesmas funções da `dashboard_summary`. Nenhuma conta usa o relógio do aparelho. O link guarda as datas, então a virada não muda o Período aplicado, só o atalho marcado.
- **Casal:** o G12 é por pessoa (Q-7). A visibilidade é a do retrato (E2.11), que já inclui o cônjuge pelo escopo do E2.02.
- **Inativo:** o líder registrado inativo continua opção do Líder (Fábio) e do G12, porque as opções vêm dos relatórios, e não dos membros ativos.
- **Sem liderança e pastor:** `snapshot_g12_leader_id` nulo (E2.06), então nunca entram no G12 nem são opção dele. No Líder, entram com o rótulo do P40 ("Sem liderança", "Pastor", "Pastora").
- **Excluído:**
  - o relatório excluído não está na `cell_reports_view` e fica fora de tudo;
  - o relatório de célula excluída está na view, com `cell_deleted`;
  - o líder registrado excluído continua na linha pelo nome, com o G12 congelado (P-HIE-13 do E2.06), mas não é opção, e o id dele no filtro não traz nada (DA-2);
  - o participante excluído aparece pelo nome e conta no número.
- **Sem cadastro e sem função:** a `cell_reports_view` devolve nada ou só os relatórios em que a pessoa está registrada (RN-14 b do E2.11), e todas as funções novas herdam isso.
- **Consolidado:** ponto de extensão. Nada aqui lê `members` sem que o id tenha saído antes de uma view.
- **Concorrência:** este passo só lê, menos a retirada do lançamento de transição da `save_cell_report` (DT-10). Não há trava, trigger nem política nova. Ver os riscos 5, 6 e 9.
- **Volume:** ver [Metas de tempo e índices](#metas-de-tempo-e-índices).

Leituras técnicas. Nenhuma muda regra, mas o PO e o QA precisam saber delas:
1. **Valor que não tem o tipo do parâmetro, pela API** (id que não é uuid, data impossível, `held` que não é booleano): o PostgREST recusa com 400 antes de a função rodar. A tela nunca manda esses valores, porque limpa a URL antes (RN-12). Os valores com o tipo certo, mas fora da regra, são normalizados como a tela faz (DA-1).
2. **As linhas e o total vêm de duas chamadas**, cada uma com a sua foto do banco. Uma gravação entre as duas pode deixar o total diferente das linhas por um instante. A leitura seguinte corrige.
3. **O G12 acompanha a árvore na hora da consulta** (RN-06). Se um líder muda de ramo entre a página 1 e a 2 com o filtro G12 aplicado, os relatórios dele saem da página seguinte. É a regra.
4. **A ordem dos participantes é feita no navegador**, com `Intl.Collator('pt-BR')` e o `member_id` como desempate (DA-8). A leitura continua paginada no servidor por `member_name` e `member_id`, só para a paginação ser estável.
5. **"Ver célula" depende de uma coluna nova da view** (`cell_visible`), que repete o critério da `cells_view` (DA-9). O teste de paridade confere as duas.
6. **"Visitantes" conta o que está gravado** (`visitors_count`, o tamanho da lista). Um nome vazio gravado contaria. A tela de lançamento do E2.11 já não grava vazios, a conferência (d) conta os que existirem, e a carga do legado (E4.06) não deve trazer nomes vazios.

#### Respostas aos pontos do PO (Pontos para o `architect`)
| Ponto | Resposta |
|---|---|
| 1. Retrato | Os filtros Líder, G12 e Tipo e a busca usam as colunas `snapshot_*` da `cell_reports_view` (E2.11). A visibilidade é a mesma view, também pelo retrato. O endereço e a identificação da célula usam as colunas `cell_*` (atuais). |
| 2. G12 do relatório | `cell_reports_view.snapshot_g12_leader_id`, que o E2.11 tira de `private.member_hierarchy.g12_id` do líder registrado (o próprio G12 no nível 1; nulo para pastor e para quem está sem liderança). A linha do membro excluído fica congelada (P-HIE-13 do E2.06), então o G12 é o da exclusão. O índice `member_hierarchy_g12_id_idx` já existe. |
| 3. Seletores de Líder e G12 | Duas funções novas, `cell_report_filter_options` (as opções) e `cell_report_filter_names` (os ids da URL). Os ids saem só da `cell_reports_view` de quem consulta (e da `members_view`, nos nomes). O nome, o nível, a marca de pastor e o sexo (só do pastor) são lidos da tabela só para esses ids. Nenhuma lê a cadeia nem chama a `member_names` (DT-07). |
| 4. Célula | O parâmetro `_cell_id` das RPCs da lista e a `cell_identity` do E2.10, sem mudança: ela só identifica a célula quando quem consulta vê a célula ou um relatório dela. |
| 5. Semana de Brasília | `server_weeks()`: a data de hoje e as três semanas, calculadas no servidor com `sp_local(now())` e `week_start`, como a `dashboard_summary`. A tela relê ao voltar para a aba e não usa o relógio do aparelho (DT-08). |
| 6. Consulta | A `cell_reports_view` por id, com quatro colunas novas (`cell_city`, `cell_state`, `cell_zip_code` e `cell_visible`), e a `cell_report_participants_view` por `report_id`, em paralelo. O relatório invisível, o excluído e o inexistente dão a mesma resposta (nenhuma linha nas duas). É só leitura: nenhum evento (DT-09). |
| 7. Desempenho | Ver [Metas de tempo e índices](#metas-de-tempo-e-índices). O G12, o Líder, o Período, o Tipo, a Reunião e a Célula entram na view (*leakproof*) e usam índices; a busca roda acima da view e calcula o `search_text` dos relatórios visíveis (risco 3). As opções percorrem os relatórios visíveis só com o id da pessoa. |
| 8. Equivalência com o Dashboard | A lista e a `dashboard_summary` leem a mesma `cell_reports_view` (mesmo escopo, mesmos excluídos, inclusive os de célula excluída), com o mesmo filtro de data, e a semana vem das mesmas funções (`sp_local` e `week_start`). O pgTAP confere a igualdade por persona (DA-7). |
| 9. Oferta sem valor | `offering` é anulável. A linha e a consulta mostram "Não informada" para nulo e "R$ 0,00" para zero (`formatOffering` do E2.10). |
| 10. Ordem dos passos | Ver [Ordem com os outros passos](#ordem-com-os-outros-passos). Se o E2.10 atrasar, o plano B está no risco 16. |
| 11. "Não houve célula" com dados | Regra de tela, num lugar só (`src/lib/cell-reports/report-row.ts` e `report-sheet.ts`): em "Não houve célula", a linha e a consulta mostram só o motivo e as observações, mesmo que a resposta traga tema, oferta, visitantes ou participantes. O banco não apaga nada (P-LRE-34). |
| 12. Editar por cima da consulta | Dá para empilhar: o `CellReportDialog` (E2.11) é irmão do `Sheet` da consulta, e a camada de cima prende o foco e recebe o `Esc` e o toque fora. O voltar do aparelho com o formulário aberto fecha só o formulário, por uma entrada própria no histórico (DA-11). A alternativa do P-LRE-29 fica como plano B. O que cada gravação desatualiza está em [Depois de gravar](#depois-de-gravar). |

#### Definidas pelo architect (revisar no PR)
Pontos que as RNs não respondem por inteiro. O `architect` adotou a leitura mais conservadora e coerente com elas. O usuário pode mudar qualquer um no PR.

| # | Ponto | Padrão adotado | Por quê |
|---|---|---|---|
| DA-1 | O que o servidor faz com valores fora da regra (AQ-12) | Valor que não tem o tipo do parâmetro: recusa do PostgREST (400). Valor com o tipo certo: normalizado como a tela, sem erro:<br>- Líder e G12: os 10 primeiros ids distintos, sem os nulos (DA-3), e depois sem os excluídos e os inexistentes (DA-2);<br>- tipo fora de `cell_types()` ignorado; sem nenhum válido, sem filtro de tipo;<br>- `_held` nulo é "Todas";<br>- datas invertidas desligam o Período inteiro (DA-6);<br>- `_cell_id` de célula que não existe ou que a pessoa não alcança: lista vazia;<br>- a busca usa os 5 primeiros padrões;<br>- `_limit` fica entre 1 e 100, e `_offset` negativo vira 0;<br>- `cell_report_filter_names` resolve no máximo 10 ids. | É a DA-1 do E2.10. A RN-05 pede os 10 primeiros pela API, e a RN-12 pede que o inválido seja ignorado. A tela nunca chega a esses casos. |
| DA-2 | Pessoa excluída ou inexistente no Líder ou no G12 | O servidor tira esses ids do filtro, que continua valendo: sem outra pessoa escolhida, a lista vem vazia. | RN-05, RN-07 e o critério de Fábio: o id do líder registrado excluído "não traz nenhum relatório", embora existam relatórios visíveis dele. É diferente do E2.10 (DA-3 de lá), em que o id de quem não lidera célula visível já não trazia nada. |
| DA-3 | Ids repetidos ou nulos no Líder e no G12 | Contam uma vez, na posição da primeira aparição; os nulos são ignorados; as 10 pessoas são contadas depois disso (`first_distinct_ids`). | DA-2 do E2.10. |
| DA-4 | Ordem das opções do Líder e do G12 | Nome sem acento e em minúsculas, comparado byte a byte (`COLLATE "C"`), e o `id`. | DA-8 do E2.10. |
| DA-5 | Sexo nas opções e nos nomes | Só do pastor (para "Pastor" ou "Pastora", P40); nulo para os demais e no G12. | O P40 só usa o sexo no rótulo de pastor. Os outros rótulos não precisam dele, e o nome de referência não deve levar mais dado que o necessário. |
| DA-6 | Datas invertidas vindas de um link | Ficam na URL, não são aplicadas, não contam como filtro nem viram chip. O painel mostra a mensagem da RN-09 quando é aberto. Pela API, o Período inteiro é ignorado. | Navegação e rotas da UX; DA-7 do E2.10. |
| DA-7 | "Visitantes" na RN-18 | A igualdade é a soma do `visitors_count` dos relatórios da lista com "Esta semana", que é o que a `dashboard_summary` soma hoje. A linha de "Não houve célula" não mostra o número (P-LRE-34), mas ele entra na soma dos dois lados. Este passo não muda o Dashboard. O E2.14 (RN-05 e P-DSH-02 de lá) passa o card a somar só a célula realizada e, aí, a igualdade vira "a soma dos visitantes mostrados nas linhas", como os Impactos do E2.14 já dizem. | O Negócio diz "Dashboard: não muda". A diferença só aparece com "Não houve célula" com visitantes, que o E2.11 não deixa nascer (DA-6 de lá) e que só existe no legado, carregado depois do E2.14. Se o usuário recusar a P-DSH-02 do E2.14, esta regra e a P-LRE-34 entram em conflito, e o ponto volta ao PO. |
| DA-8 | Participantes na consulta | Ordem: `Intl.Collator('pt-BR', { sensitivity: 'base' })` e o `member_id`. Pela API, a `cell_report_participants_view` continua com as colunas de hoje para todos que veem o relatório: o `member_id`, o nome, `member_deleted` (E2.01) e `is_snapshot_person` (E2.11); `member_is_active` e `member_gender` continuam nulos para quem não é visível (E2.11). | AQ-6 pede a ordem sem diferenciar acentos. A RN-17 fala de "nenhum outro dado do cadastro" (contato, endereço, documentos); o id, a marca de excluído e a de pessoa registrada são do relatório e já servem ao formulário de edição. Mascarar `member_deleted` para quem não edita custaria pouco (meio dia), se o usuário preferir. |
| DA-9 | "Ver célula" (RN-16 c) | Coluna nova `cell_visible` na `cell_reports_view`: `c.deleted_at IS NULL AND viewer_sees_cell_people(c.leader_id, c.timothy_id, c.host_id)`, o mesmo critério da `cells_view` (E2.02). | Uma leitura só por id (AQ-6). Sem a coluna, a consulta aberta por link precisaria de uma terceira leitura, que só pode sair depois da primeira (o id da célula). |
| DA-10 | Data do servidor para os atalhos | `server_weeks()`, lida ao abrir a tela, relida ao voltar para a aba (`refetchOnWindowFocus: "always"`) e guardada por 60 s. Sem ela, os atalhos ficam desabilitados. | RN-10 e UXD-4. A chamada não lê tabela, então relê-la é barato. |
| DA-11 | Voltar do aparelho com o formulário aberto por cima da consulta | Abrir "Editar relatório" pela consulta cria uma entrada no histórico, no mesmo endereço. O voltar tira só essa entrada: o formulário fecha pelo caminho dele (com o "Descartar as alterações?" quando houver mudança; "Continuar editando" recria a entrada), e a consulta continua. Salvar e cancelar também tiram a entrada. Recarregar com o formulário aberto reabre só a consulta. | AQ-9 e UXD-10. Sem a entrada, o voltar fecharia a consulta por baixo do formulário. Se a casca do formulário do E2.11 não aceitar o pedido de fechar de fora, vale o plano B do P-LRE-29 (fechar a consulta, abrir o formulário e reabrir a consulta depois de salvar). |
| DA-12 | A lista depois de excluir pela consulta | Antes de recarregar, o relatório sai de todas as páginas da lista que estão no cache, e o total delas diminui 1. Depois, o `refreshAfterReportWrite`. | AQ-10: com o `placeholderData`, a página antiga, com o relatório excluído, ficaria na tela até a resposta. |
| DA-13 | "Limpar filtros" e o `report` | Mantém `size` e `report` (que só existe com a consulta aberta, quando "Limpar filtros" não está ao alcance). | Navegação e rotas da UX; o `cell-filter.ts` do E2.10 já fazia assim. |
| DA-14 | T14: os "Últimos relatórios" do detalhe da célula abrem a mesma consulta | Entra, num PR separado (PR 4), depois dos outros. Se o usuário preferir, sai do escopo sem mudar o resto. | É recomendação do Negócio (Impactos, E2.10). O componente e o hook da consulta já servem a qualquer tela; o custo é de cerca de meio dia. |

### Visão geral
Cinco partes:
1. **A lista por RPC** (migration 1): `cell_reports_list` (a página) e `cell_reports_list_count` (o total), *definer*, com a busca e os 7 filtros como parâmetros tipados. As duas leem só a `cell_reports_view` e montam o `WHERE` só com os filtros ativos, como o E2.07 e o E2.10.
2. **Os seletores** (migration 1): `cell_report_filter_options` e `cell_report_filter_names`, *definer*, com os ids vindos só das views.
3. **A semana do servidor e a consulta** (migration 1): `server_weeks()`; quatro colunas no fim da `cell_reports_view` (o endereço completo da célula e `cell_visible`).
4. **Fim do lançamento de transição** (migration 2): a `save_cell_report` deixa de aceitar `_report_id` nulo (DA-12 do E2.11).
5. **Front:** a lista com os filtros, os atalhos e a linha nova (PR 2); a consulta em toda linha, com o histórico do navegador e a edição por cima (PR 3); a mesma consulta no detalhe da célula (PR 4, opcional).

Nenhuma tabela, coluna de tabela, trigger, trava ou política de RLS muda.

### Modelo de dados e migrations

#### Ordem das migrations
Os nomes são sugestões; o timestamp é o do momento da criação.
- Cada arquivo é idempotente (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DO` com guarda de `duplicate_object`) e roda num banco zerado depois das migrations dos passos anteriores.
- **Cada arquivo deixa o banco coerente sozinho.**
- As mensagens das guardas trazem só nomes de objetos, nunca dado pessoal (os logs do GitHub Actions de um repositório público são públicos).
- Depois do PR 1, regenere o `types.ts`.

| # | PR | Arquivo | Conteúdo | Estado depois dele |
|---|---|---|---|---|
| 1 | 1 | `<ts>_e212_01_report_list.sql` | Guarda; `cell_reports_view` com quatro colunas no fim; `server_weeks`; tipo `private.cell_report_filter`, `private.cell_report_filter_people`, `private.cell_report_filter_normalize` e `private.cell_report_filter_sql`; `cell_reports_list` e `cell_reports_list_count`; `cell_report_filter_options` e `cell_report_filter_names`; privilégios; pós-condições. | As funções existem, sem leitor até o PR 2. A lista em produção continua lendo a `cell_reports_view` direto. |
| 2 | 1 | `<ts>_e212_02_save_report_edit_only.sql` | Guarda; `save_cell_report` sem o ramo `_report_id IS NULL`; pós-condições. | O lançamento só pela `submit_cell_report`. O front do E2.11 (PR 4) já não usa o ramo. |

#### A lista (migration 1)

##### Filtros, parâmetros e condições
| Filtro (na URL) | Parâmetro | Normalização (`private.cell_report_filter_normalize`) | Condição sobre `cell_reports_view v` (`private.cell_report_filter_sql`) |
|---|---|---|---|
| busca (`q`) | `_search text[]`: os padrões do `toSearchPatterns` (E1.08) | até 5, sem os vazios | `v.search_text ILIKE ALL (…)` (líder registrado e tema, E2.11) |
| Célula (`cell`) | `_cell_id uuid` | — | `v.cell_id = …` |
| Líder (`leaders`) | `_leader_ids uuid[]` | `first_distinct_ids(…, 10)`, depois sem excluídos e inexistentes (DA-2, DA-3); vazio na chamada = sem filtro; sem ninguém disponível = `'{}'` (filtro ativo, nada volta) | `v.snapshot_leader_id = ANY (…)` |
| G12 (`g12`) | `_g12_ids uuid[]` | idem | `v.snapshot_g12_leader_id = ANY (…)` |
| Período (`from`, `to`) | `_date_from date`, `_date_to date` (Brasília) | invertidas: sem Período (DA-6) | `v.date >= …` e `v.date <= …` |
| Tipo (`type`) | `_types text[]`, com os valores de `cell_types()` ('Evangelística'…) | sem repetidos; fora de `cell_types()` ignorado | `v.snapshot_cell_type = ANY (…)` |
| Reunião (`held`) | `_held boolean` | nulo = Todas | `v.was_held = …` |

- **Combinação (RN-02):** os fragmentos são ligados por `AND`. Dentro de um filtro de múltipla escolha, `= ANY` dá o "basta valer uma".
- **Pastor e sem liderança nunca entram no G12:** `snapshot_g12_leader_id` é nulo, e nulo não satisfaz `= ANY`.
- **Os dois dias entram (RN-09):** `date` é a data de Brasília da reunião, sem hora, então `<=` inclui o relatório de 23:30 do último dia.
- Todas as condições, menos a busca, usam operadores *leakproof* (`uuid_eq`, `date_ge`, `date_le`, `texteq`, `booleq`) e entram na view, junto das junções e dos índices.

##### Código de referência (migration 1)
```sql
-- 0. Pré-requisitos. Falha cedo, sem mudar nada.
DO $$ BEGIN
  IF to_regprocedure('public.first_distinct_ids(uuid[], integer)') IS NULL              -- E2.10 PR 1
     OR to_regtype('public.cell_filter_person') IS NULL
     OR to_regprocedure('public.cell_identity(uuid)') IS NULL
     OR to_regprocedure('public.viewer_sees_report_people(uuid,uuid,uuid)') IS NULL     -- E2.11 PR 1
     OR to_regprocedure('public.submit_cell_report(uuid,jsonb,uuid[])') IS NULL         -- E2.11 PR 2
     OR to_regprocedure('public.viewer_sees_cell_people(uuid,uuid,uuid)') IS NULL       -- E2.02 PR 1
     OR to_regprocedure('public.cell_types()') IS NULL                                  -- E2.08 PR 2
     OR to_regprocedure('public.sp_local(timestamp with time zone)') IS NULL            -- E2.09
     OR to_regclass('private.member_hierarchy') IS NULL                                 -- E2.06 PR 1
     OR EXISTS (SELECT 1
                  FROM unnest(ARRAY['snapshot_leader_id', 'snapshot_leader_name', 'snapshot_timothy_name',
                                    'snapshot_host_name', 'snapshot_cell_type', 'snapshot_leader_g12_level',
                                    'snapshot_leader_is_pastor', 'snapshot_g12_leader_id', 'snapshot_g12_leader_name',
                                    'created_by_name', 'updated_by_name', 'cell_deleted', 'cell_meeting_day',
                                    'cell_meeting_time', 'participants_count', 'visitors_count', 'search_text']) c(col)
                 WHERE NOT EXISTS (SELECT 1 FROM pg_attribute
                                    WHERE attrelid = 'public.cell_reports_view'::regclass
                                      AND attname = c.col AND NOT attisdropped)) THEN
    RAISE EXCEPTION 'E2.12 depende do E2.02, E2.05, E2.06, E2.08, E2.09, E2.10 (PR 1) e E2.11 (PRs 1 e 2) em produção.';
  END IF;
END $$;

-- 1. A view, com quatro colunas no fim (RN-16 b e c; DA-9). Recriada a partir da definição
--    vigente (pg_get_viewdef no momento da implementação): nenhuma outra coluna, junção ou
--    condição muda. Repete WITH (security_barrier = true, security_invoker = false).
--    A cell_report_participants_view, que junta esta, continua valendo (colunas só no fim).
CREATE OR REPLACE VIEW public.cell_reports_view
WITH (security_barrier = true, security_invoker = false) AS
SELECT
  -- … todas as colunas vigentes, na mesma ordem …
  c.city     AS cell_city,
  c.state    AS cell_state,
  c.zip_code AS cell_zip_code,
  -- Quem consulta vê a célula: o mesmo critério da cells_view (E2.02). Só "Ver célula" usa.
  (c.deleted_at IS NULL
   AND public.viewer_sees_cell_people(c.leader_id, c.timothy_id, c.host_id)) AS cell_visible
FROM … ;  -- as junções e o WHERE vigentes, sem mudança

-- 2. A data de hoje e as três semanas, em Brasília, segundo o servidor (RN-10, AQ-2).
--    Não lê tabela e não diz nada de ninguém. _at existe só para os testes; a tela não o manda.
CREATE OR REPLACE FUNCTION public.server_weeks(_at timestamptz DEFAULT now())
RETURNS TABLE (today date,
               this_week_start date, this_week_end date,
               last_week_start date, last_week_end date,
               week_before_last_start date, week_before_last_end date)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT t.today, w.ws, w.ws + 6, w.ws - 7, w.ws - 1, w.ws - 14, w.ws - 8
    FROM (SELECT public.sp_local(coalesce(_at, now()))::date AS today) t
   CROSS JOIN LATERAL (SELECT public.week_start(t.today) AS ws) w
$$;

-- 3. O filtro normalizado.
DO $$ BEGIN
  CREATE TYPE private.cell_report_filter AS (
    search     text[],     -- padrões ILIKE (E1.08), até 5
    cell_id    uuid,       -- RN-08
    leader_ids uuid[],     -- RN-05: nulo = sem filtro; '{}' = ninguém disponível (nada volta)
    g12_ids    uuid[],     -- RN-06: idem
    date_from  date,       -- RN-09: datas de Brasília, inclusive
    date_to    date,
    types      text[],     -- RN-11: valores de cell_types()
    held       boolean);   -- RN-11: nulo = Todas
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- As pessoas escolhidas no Líder ou no G12 (RN-05 a RN-07; DA-2, DA-3): os 10 primeiros ids
-- distintos e, deles, só os de membros não excluídos. Nulo quando a chamada não traz nenhum id.
CREATE OR REPLACE FUNCTION private.cell_report_filter_people(_ids uuid[])
RETURNS uuid[] LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE WHEN cardinality(f.ids) > 0 THEN
           ARRAY(SELECT m.id FROM public.members m WHERE m.id = ANY (f.ids) AND m.deleted_at IS NULL)
         END
    FROM (SELECT public.first_distinct_ids(_ids, 10) AS ids) f
$$;

-- Os valores como a tela os aplica (DA-1, DA-6). Só é chamada pelas duas RPCs da lista.
CREATE OR REPLACE FUNCTION private.cell_report_filter_normalize(
  _search text[], _cell_id uuid, _leader_ids uuid[], _g12_ids uuid[],
  _date_from date, _date_to date, _types text[], _held boolean)
RETURNS private.cell_report_filter LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  _f private.cell_report_filter;
BEGIN
  _f.search := (SELECT array_agg(s.p ORDER BY s.i)
                  FROM (SELECT t.p, t.i FROM unnest(_search) WITH ORDINALITY t(p, i)
                         WHERE coalesce(t.p, '') <> '' ORDER BY t.i LIMIT 5) s);
  _f.cell_id    := _cell_id;
  _f.leader_ids := private.cell_report_filter_people(_leader_ids);
  _f.g12_ids    := private.cell_report_filter_people(_g12_ids);
  _f.types      := nullif(ARRAY(SELECT DISTINCT x FROM unnest(_types) x
                                 WHERE x = ANY (public.cell_types())), '{}');
  _f.held       := _held;
  IF _date_from IS NULL OR _date_to IS NULL OR _date_from <= _date_to THEN     -- DA-6
    _f.date_from := _date_from;
    _f.date_to   := _date_to;
  END IF;
  RETURN _f;
END $$;

-- O WHERE, num lugar só. Só fragmentos fixos, escolhidos pela nulidade de cada campo; os valores
-- vêm de $1 (o filtro) por USING. Nunca concatene um valor aqui. O alias é sempre "v".
CREATE OR REPLACE FUNCTION private.cell_report_filter_sql(_f private.cell_report_filter)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT concat_ws(' AND ', 'true',
    CASE WHEN _f.search     IS NOT NULL THEN 'v.search_text ILIKE ALL (($1).search)' END,
    CASE WHEN _f.cell_id    IS NOT NULL THEN 'v.cell_id = ($1).cell_id' END,
    CASE WHEN _f.leader_ids IS NOT NULL THEN 'v.snapshot_leader_id = ANY (($1).leader_ids)' END,
    CASE WHEN _f.g12_ids    IS NOT NULL THEN 'v.snapshot_g12_leader_id = ANY (($1).g12_ids)' END,
    CASE WHEN _f.date_from  IS NOT NULL THEN 'v.date >= ($1).date_from' END,
    CASE WHEN _f.date_to    IS NOT NULL THEN 'v.date <= ($1).date_to' END,
    CASE WHEN _f.types      IS NOT NULL THEN 'v.snapshot_cell_type = ANY (($1).types)' END,
    CASE WHEN _f.held       IS NOT NULL THEN 'v.was_held = ($1).held' END)
$$;

-- A página, na ordem da RN-13. Quem aparece é decidido só pela cell_reports_view (escopo pelo
-- retrato e excluídos), que filtra por auth.uid() também aqui dentro. É definer só para chamar os
-- auxiliares de private sem dar USAGE no schema aos papéis da API.
CREATE OR REPLACE FUNCTION public.cell_reports_list(
  _search text[] DEFAULT NULL, _cell_id uuid DEFAULT NULL,
  _leader_ids uuid[] DEFAULT NULL, _g12_ids uuid[] DEFAULT NULL,
  _date_from date DEFAULT NULL, _date_to date DEFAULT NULL,
  _types text[] DEFAULT NULL, _held boolean DEFAULT NULL,
  _limit integer DEFAULT 25, _offset integer DEFAULT 0)
RETURNS SETOF public.cell_reports_view
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _f   private.cell_report_filter := private.cell_report_filter_normalize(
         _search, _cell_id, _leader_ids, _g12_ids, _date_from, _date_to, _types, _held);
  _ids uuid[];
BEGIN
  -- 1. Os ids da página, calculando só as chaves da ordem e as colunas dos filtros ativos.
  EXECUTE format(
    'SELECT array_agg(p.id ORDER BY p.date DESC, p."time" DESC, p.id)
       FROM (SELECT v.id, v.date, v."time"
               FROM public.cell_reports_view v
              WHERE %s
              ORDER BY v.date DESC, v."time" DESC, v.id
              LIMIT $2 OFFSET $3) p',
    private.cell_report_filter_sql(_f))
    INTO _ids
    USING _f, least(greatest(coalesce(_limit, 25), 1), 100), greatest(coalesce(_offset, 0), 0);
  -- 2. As linhas da página, com todas as colunas. "id = ANY" é leakproof: entra na view e usa a PK.
  RETURN QUERY
    SELECT v.* FROM public.cell_reports_view v
     WHERE v.id = ANY (_ids)
     ORDER BY array_position(_ids, v.id);
END $$;

-- O total, com a mesma normalização e o mesmo WHERE.
CREATE OR REPLACE FUNCTION public.cell_reports_list_count(
  _search text[] DEFAULT NULL, _cell_id uuid DEFAULT NULL,
  _leader_ids uuid[] DEFAULT NULL, _g12_ids uuid[] DEFAULT NULL,
  _date_from date DEFAULT NULL, _date_to date DEFAULT NULL,
  _types text[] DEFAULT NULL, _held boolean DEFAULT NULL)
RETURNS bigint
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _f private.cell_report_filter := private.cell_report_filter_normalize(
       _search, _cell_id, _leader_ids, _g12_ids, _date_from, _date_to, _types, _held);
  _n bigint;
BEGIN
  EXECUTE 'SELECT count(*) FROM public.cell_reports_view v WHERE ' || private.cell_report_filter_sql(_f)
     INTO _n USING _f;
  RETURN _n;
END $$;
```
- **Por que SQL dinâmico e a página em duas etapas:** os mesmos motivos do E2.10 (DT-01 e DT-03 de lá). Com o texto montado só com os filtros ativos, a busca só calcula o `search_text` quando é usada. A etapa 1 calcula só as chaves da ordem; a etapa 2 calcula todas as colunas da view (nomes, G12, autoria, número de participantes, `cell_visible`) só para as linhas da página. Por isso o número de participantes passa a vir na mesma chamada, e a segunda consulta do E1.08 sai.
- **Por que a ordem vem pronta:** sem `order` na chamada, o PostgREST lê a função na ordem em que ela devolve (conferido no E2.07). O front não chama `.order()`.
- **`STABLE`:** as duas consultas de dentro usam a mesma foto do banco.

##### Os seletores (migration 1)
```sql
-- Opções do Líder e do G12 (RN-05, RN-06; DA-4, DA-5): quem é o líder registrado (ou o G12) de pelo
-- menos um relatório da cell_reports_view de quem consulta, ativo ou inativo, nunca excluído.
-- Definer: os ids saem só da view (que filtra por auth.uid()); o nome, o nível, a marca de pastor
-- e o sexo do pastor são lidos da tabela só para esses ids. Paginada aqui dentro (21 linhas).
CREATE OR REPLACE FUNCTION public.cell_report_filter_options(
  _person public.cell_filter_person, _search text[] DEFAULT NULL,
  _limit integer DEFAULT 21, _offset integer DEFAULT 0)
RETURNS TABLE (id uuid, name text, g12_level integer, is_pastor boolean, gender text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH people AS (
    SELECT DISTINCT v.snapshot_leader_id AS id
      FROM public.cell_reports_view v
     WHERE _person = 'leader'
    UNION
    SELECT DISTINCT v.snapshot_g12_leader_id
      FROM public.cell_reports_view v
     WHERE _person = 'g12' AND v.snapshot_g12_leader_id IS NOT NULL)    -- pastor e sem liderança: nunca
  SELECT m.id, m.name,
         CASE WHEN _person = 'leader' THEN h.g12_level END,
         CASE WHEN _person = 'leader' THEN m.is_pastor END,
         CASE WHEN _person = 'leader' AND m.is_pastor THEN m.gender END
    FROM people p
    JOIN public.members m ON m.id = p.id AND m.deleted_at IS NULL       -- excluído: nunca (RN-08 do E2.01)
    LEFT JOIN private.member_hierarchy h ON h.member_id = m.id
   WHERE _search IS NULL OR public.search_normalize(m.name) ILIKE ALL (_search[1:5])
   ORDER BY public.search_normalize(m.name) COLLATE "C", m.id
   LIMIT least(greatest(coalesce(_limit, 21), 1), 100) OFFSET greatest(coalesce(_offset, 0), 0)
$$;

-- Os ids vindos da URL (RN-07): nome para quem quem consulta vê como membro, ou para quem é o líder
-- registrado (no Líder) ou o G12 (no G12) de um relatório visível, desde que não excluído. Nenhuma
-- linha para o resto (invisível, excluído, inexistente), com a mesma resposta nos três casos.
CREATE OR REPLACE FUNCTION public.cell_report_filter_names(_person public.cell_filter_person, _ids uuid[])
RETURNS TABLE (id uuid, name text, g12_level integer, is_pastor boolean, gender text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.name,
         CASE WHEN _person = 'leader' THEN h.g12_level END,
         CASE WHEN _person = 'leader' THEN m.is_pastor END,
         CASE WHEN _person = 'leader' AND m.is_pastor THEN m.gender END
    FROM unnest(public.first_distinct_ids(_ids, 10)) AS w(id)
    JOIN public.members m ON m.id = w.id AND m.deleted_at IS NULL
    LEFT JOIN private.member_hierarchy h ON h.member_id = m.id
   WHERE EXISTS (SELECT 1 FROM public.members_view mv WHERE mv.id = w.id)
      OR (_person = 'leader' AND EXISTS (SELECT 1 FROM public.cell_reports_view v
                                          WHERE v.snapshot_leader_id = w.id))
      OR (_person = 'g12'    AND EXISTS (SELECT 1 FROM public.cell_reports_view v
                                          WHERE v.snapshot_g12_leader_id = w.id))
$$;
```
- **Por que *definer*, ao contrário do E2.10:** a regra de "excluído nunca é opção" precisa de `members.deleted_at`, e o rótulo do P40 precisa do sexo do pastor. Nenhum dos dois está na `cell_reports_view`. Pôr na view três colunas a mais (sexo, excluído do líder e excluído do G12) também resolveria, mas cada leitura das opções calcularia os nomes de todos os relatórios visíveis. Aqui, o `DISTINCT` percorre só o id da pessoa, e as junções rodam só para as pessoas distintas (centenas, e não 100 mil).
- **O que não sai:** nenhum id que não tenha vindo de uma linha visível (da `cell_reports_view` ou da `members_view` de quem consulta); nenhuma coluna além do que a linha da lista já mostra (nome, nível e pastor do líder registrado, nome do G12) e do sexo do pastor (DA-5). Nada da cadeia.
- **O nível só no Líder:** o G12 devolve o nível, a marca de pastor e o sexo nulos, porque a opção mostra só o nome (P-LRE-03).

##### Privilégios e pós-condições (migration 1)
```sql
-- Os privilégios padrão do Supabase dão EXECUTE a anon, authenticated e service_role em função
-- nova de public: revogar e conceder de novo, como o E2.07 e o E2.10.
REVOKE ALL ON FUNCTION public.cell_reports_list(text[], uuid, uuid[], uuid[], date, date, text[], boolean,
  integer, integer) FROM PUBLIC, anon, service_role;
-- … o mesmo para cell_reports_list_count, cell_report_filter_options, cell_report_filter_names e
--     server_weeks; GRANT EXECUTE das cinco só para authenticated.
REVOKE ALL ON FUNCTION private.cell_report_filter_people(uuid[]),
  private.cell_report_filter_normalize(text[], uuid, uuid[], uuid[], date, date, text[], boolean),
  private.cell_report_filter_sql(private.cell_report_filter)
  FROM PUBLIC, anon, authenticated, service_role;

-- Pós-condições:
-- - cell_reports_list, cell_reports_list_count, cell_report_filter_options e cell_report_filter_names
--   definer; server_weeks invoker; todas com search_path fixo e EXECUTE só para authenticated
--   (além do dono); as três internas sem EXECUTE para os papéis da API; anon e authenticated sem
--   USAGE em private;
-- - authenticated com EXECUTE em viewer_sees_cell_people (a view chama a função com os privilégios
--   de quem consulta);
-- - cell_reports_view com reloptions {security_barrier=true,security_invoker=false}, as colunas de
--   antes na mesma posição e as quatro novas no fim;
-- - RAISE EXCEPTION 'E2.12: modo de segurança ou privilégios das funções diferentes do desenho.'
--   em qualquer desvio (o bloco segue o do E2.10).
```

#### Fim do lançamento pela `save_cell_report` (migration 2)
```sql
-- 0. Pré-requisitos: a migration 1 deste passo e a save_cell_report definer do E2.11.
DO $$ BEGIN
  IF to_regprocedure('public.cell_reports_list(text[],uuid,uuid[],uuid[],date,date,text[],boolean,integer,integer)') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_proc
                     WHERE oid = to_regprocedure('public.save_cell_report(uuid,jsonb,uuid[])') AND prosecdef) THEN
    RAISE EXCEPTION 'E2.12: falta a migration 1 deste passo ou a save_cell_report do E2.11.';
  END IF;
END $$;

-- 1. A save_cell_report sem o lançamento de transição (DA-12 do E2.11). Recriada a partir da
--    definição vigente (pg_get_functiondef), mudando só o passo 0:
--      antes:  _report_id nulo → submit_cell_report(gen_random_uuid(), …) e changed = true;
--      depois: _report_id nulo → private.report_raise('report_id_required')   -- técnica
--    Mesmo nome, assinatura, retorno, modo (definer), search_path e privilégios.

-- 2. Pós-condições: a função continua definer, com search_path fixo, sem EXECUTE para anon, e o
--    corpo não chama mais a submit_cell_report.
```
- **Por que separada:** é a única mudança de escrita do passo, e só pode ir ao ar depois do promote do PR 4 do E2.11 (o formulário que lança pela `submit_cell_report`). A tarefa 1 confere isso no código da `main`.

#### Integridade garantida pelo banco
| Garantia | Como |
|---|---|
| Só aparece o relatório que a pessoa vê, nunca o excluído (RN-03) | Toda linha devolvida vem da `cell_reports_view`, que filtra por `auth.uid()` também dentro de uma função *definer*. Teste de paridade por persona. |
| Filtro e escopo usam as mesmas pessoas (RN-04) | Os filtros Líder, G12 e Tipo e a visibilidade leem as colunas `snapshot_*` da mesma view. |
| Os seletores não revelam nada novo (RN-07, RN-23 do E2.02) | As funções só devolvem pessoas cujos ids saíram de uma linha visível; o excluído nunca volta; a resposta para o invisível, o excluído e o inexistente é a mesma (nenhuma linha). |
| O excluído no Líder e no G12 não traz nada (RN-05, RN-07) | `private.cell_report_filter_people` tira o id antes de montar o filtro (DA-2). |
| Lista igual ao Dashboard (RN-18) | A mesma view e a mesma condição de data nos dois lados; a semana pelas mesmas funções. Teste por persona. |
| Consulta sem dado para quem não vê (RN-16 d, RN-17) | A `cell_reports_view` e a `cell_report_participants_view` não devolvem a linha. |
| Consulta só lê (RN-16 f) | Leituras por view; nenhum trigger em `SELECT`. |
| Valores só por parâmetro | `private.cell_report_filter_sql` devolve só fragmentos fixos. Os valores entram por `USING`. |
| Ninguém chama as funções internas | Ficam em `private`, sem EXECUTE para os papéis da API, que continuam sem USAGE no schema. |
| Ordem total (RN-13) | `date DESC, time DESC, id`, com `date` e `time` `NOT NULL` e `id` único. |

### Metas de tempo e índices
Volume de referência: 20 mil membros, 1.500 células, 100 mil relatórios com cerca de 10 participantes cada, uma célula com 400 relatórios e um relatório com 1.000 participantes. As metas são no banco, medidas pelo QA com `EXPLAIN (ANALYZE, BUFFERS)`, mediana de 5 execuções.

| Consulta | Meta |
|---|---|
| `cell_reports_list` (25 linhas) e `cell_reports_list_count`, sem filtros, Rita | até 150 ms cada |
| as mesmas, Pedro (ministério) | até 250 ms cada |
| só a busca ("fe"), Rita | até 400 ms cada |
| só G12 (1 pessoa), Rita | até 150 ms cada |
| só "Esta semana", Rita | até 100 ms cada |
| só a Célula, na célula com 400 relatórios | até 100 ms cada |
| a combinação do critério da RN-02 (Líder com 2, G12 com 1, Período, Tipo com 2 e Reunião) | até 1 s cada. As duas correm em paralelo, então a página e o total ficam em até 2 s com a rede. |
| `cell_report_filter_options` (Líder e G12, com e sem busca), Rita | até 200 ms |
| a mesma, Pedro | até 300 ms |
| `cell_report_filter_names` com 10 ids | até 50 ms |
| `cell_reports_view` por id com as colunas da consulta | até 50 ms |
| `cell_report_participants_view` do relatório com 1.000 participantes | até 150 ms |
| `server_weeks()` | até 5 ms |

| Índice | Para quê | Situação |
|---|---|---|
| `cell_reports_date_id_idx (date DESC, id)` | Ordem da página (com *incremental sort* no `time`) e Período | Existente (E1.08) |
| `cell_reports_cell_id_date_idx` | Célula | Existente (E1.08) |
| `cell_reports_snapshot_leader_idx` | Líder, nomes e o caminho do G12 | Existente (E2.11) |
| `member_hierarchy_g12_id_idx` e `members_pkey` | G12 (pessoas do ramo → relatórios delas) | Existentes (E2.06) |
| nenhum para tipo, reunião e busca | Poucos valores; toda consulta já percorre o conjunto visível | Planos B nos riscos 3 e 10 |

### Contratos (RPC, Edge Functions, colunas novas)
**Colunas novas no fim da `cell_reports_view`:** `cell_city text`, `cell_state text`, `cell_zip_code text` (o endereço atual da célula, que não é sensível, RN-09 do E2.08) e `cell_visible boolean` (quem consulta vê a célula, DA-9). Nenhuma outra view muda.

**Tipos:** nenhum enum novo. As funções de seletor usam o `cell_filter_person` do E2.10.

**RPCs (EXECUTE só para `authenticated`):**
| Função | Modo | Retorno | Observações |
|---|---|---|---|
| `cell_reports_list(_search text[], _cell_id uuid, _leader_ids uuid[], _g12_ids uuid[], _date_from date, _date_to date, _types text[], _held boolean, _limit integer = 25, _offset integer = 0)` | *definer* | `SETOF cell_reports_view`, já na ordem da RN-13 | Todos os filtros com padrão nulo. Página além do fim: vazia, sem 416. |
| `cell_reports_list_count(` os mesmos 8 filtros `)` | *definer* | `bigint` | O total exato, com a mesma normalização. |
| `cell_report_filter_options(_person cell_filter_person, _search text[] = null, _limit integer = 21, _offset integer = 0)` | *definer* | `TABLE (id, name, g12_level, is_pastor, gender)` | Em ordem alfabética (DA-4). No G12, as três últimas nulas; no Líder, `gender` só do pastor (DA-5). |
| `cell_report_filter_names(_person cell_filter_person, _ids uuid[])` | *definer* | idem | Só os ids resolvidos (RN-07); os outros não voltam. |
| `server_weeks(_at timestamptz = now())` | *invoker* | `TABLE (today, this_week_start, this_week_end, last_week_start, last_week_end, week_before_last_start, week_before_last_end)` | Uma linha. A tela chama sem argumento. |

**Muda:** `save_cell_report(_report_id uuid, _report jsonb, _participant_ids uuid[])` recusa `_report_id` nulo com `report_id_required` (técnica). O resto do contrato do E2.11 não muda.

**Internas (`private`, sem EXECUTE para os papéis da API):** tipo `cell_report_filter`, `cell_report_filter_people`, `cell_report_filter_normalize` e `cell_report_filter_sql`.

**Edge Functions:** nenhuma muda.

**Mapa da URL para os parâmetros (AQ-1):**
| URL | Parâmetro |
|---|---|
| `q` | `_search`, pelos padrões do `toSearchPatterns` (E1.08) |
| `cell=<id>` | `_cell_id` e `cell_identity(_cell_id)` (E2.10) |
| `leaders=<id>,<id>` | `_leader_ids`, na ordem da escolha |
| `g12=<id>,<id>` | `_g12_ids`, na ordem da escolha |
| `from`, `to` (`aaaa-mm-dd`) | `_date_from`, `_date_to` |
| `type=evangelistic,discipleship,macrocell` | `_types`: 'Evangelística', 'Discipulado', 'Macrocélula' (o mesmo mapa de Células) |
| `held=yes` / `no` | `_held`: `true` / `false` |
| `report=<id>` | `cell_reports_view?id=eq.<id>` e `cell_report_participants_view?report_id=eq.<id>` |
| `page`, `size` | `_offset` e `_limit` (E1.08) |

Uso no front (esboço):
```ts
// src/hooks/use-cell-reports-list.ts
queryFn: async (): Promise<ListResult<CellReportListRow>> => {
  const args = toCellReportsListArgs(filters, search);              // src/lib/cell-reports/filters.ts
  const [rowsRes, countRes] = await Promise.all([
    supabase
      .rpc("cell_reports_list", { ...args, _limit: pageSize, _offset: (page - 1) * pageSize })
      .select(CELL_REPORT_LIST_SELECT),                               // sem .order(): a ordem é a da RPC
    supabase.rpc("cell_reports_list_count", args),
  ]);
  if (rowsRes.error) throw rowsRes.error;
  if (countRes.error) throw countRes.error;
  return { rows: rowsRes.data ?? [], total: countRes.data ?? 0 };
},

// src/hooks/use-cell-report.ts (consulta, em paralelo com o use-cell-report-participants)
const { data, error } = await supabase
  .from("cell_reports_view").select(CELL_REPORT_DETAIL_SELECT).eq("id", reportId).maybeSingle();
if (error) throw error;
return data;                                                          // null: "Relatório não encontrado"
```
- `CELL_REPORT_LIST_SELECT`: o `CELL_REPORT_ROW_SELECT` do E2.11 (o que a linha e o formulário de edição usam), mais `participants_count`, `observations`, `visitors`, `cell_meeting_day` e `cell_meeting_time` (o topo da consulta aparece na hora, T12). Nunca `*`, `search_text` nem `cell_visible`.
- `CELL_REPORT_DETAIL_SELECT`: o da lista, mais `snapshot_timothy_name`, `snapshot_host_name`, `cell_complement`, `cell_city`, `cell_state`, `cell_zip_code`, `cell_visible`, `created_at` e as colunas de autoria do E2.05.

### Front
Segue o padrão dos passos anteriores: os componentes cuidam da tela, o acesso a dados fica nos hooks e a regra pura fica em `src/lib/`. Nenhuma data é calculada pelo relógio do aparelho.

- **Domínio puro, com Vitest, sem React nem Supabase:**
  - `src/lib/cell-reports/filters.ts` (AQ-1), o módulo único do filtro de Relatórios. Absorve o `cell-filter.ts` do E2.10, que sai com os testes migrados:
    - tipo `CellReportFilters` (`cellId`, `leaderIds`, `g12Ids`, `from`, `to`, `types`, `held`) e `EMPTY_CELL_REPORT_FILTERS`;
    - os mapas da URL: `type` pelo mesmo mapa de Células (importado do módulo do E2.10, sem cópia; se ele não for exportado, vai para um módulo comum de `src/lib/cells/` no mesmo PR) e `held` (`yes`/`no`), com `satisfies`, para a compilação falhar quando surgir um valor sem mapa;
    - `parseCellReportFilters(params)`: os filtros, a URL limpa (ou nulo, se nada mudou), `leadersTruncated`, `g12Truncated` e `dateRangeInverted` (DA-6), com `isUuid`, `isIsoDate` e as listas de `src/lib/filters/{url,dates}.ts` (E2.07);
    - `writeCellReportFilters(params, filters)`: sem os padrões, na ordem das opções, `leaders` e `g12` na ordem da escolha, e tira `page`;
    - `clearCellReportFilters(params)`: mantém `size` e `report` (DA-13);
    - `countActiveCellReportFilters(filters)` (0 a 6: o Período conta 1, e as datas invertidas não contam);
    - `cellReportFilterChips(filters, labels)`, na ordem Célula, Líder, G12, De, Até, Tipo e Reunião (UXD-2);
    - `applyWeek(filters, week)`: troca o Período pelas datas da semana e mantém o resto;
    - `toCellReportsListArgs(filters, search)`, tipado pelos `Args` do `types.ts`; o Período invertido não vai;
    - `cellReportListHref({ cellId, from, to, held, size })`: o "Ver todos os relatórios desta célula", o "Ver todos os relatórios" do detalhe da célula (E2.10) e os links da RN-18 para o E2.14;
    - o texto do chip da Célula a partir da `cell_identity` (o que era do `cell-filter.ts`).
  - `src/lib/cell-reports/weeks.ts`: `toWeekShortcuts(row)` (as três semanas da `server_weeks`, com o rótulo e o nome acessível com as datas) e `activeWeekShortcut(filters, shortcuts)` (o Período aplicado igual às duas datas de uma delas). Nenhuma conta de data.
  - `src/lib/cell-reports/report-row.ts`: `toReportRowView(row)` (RN-15):
    - o líder registrado e o rótulo do G12 pela regra do E2.06 e do E2.10, aplicada às colunas `snapshot_*` ("G12: {nome}", "G12: Pastores", "G12: —" com "nenhum" para o leitor de tela);
    - o endereço ("{Rua}, {Número} · {Bairro}", "s/n", "Sem endereço");
    - a data com o dia abreviado e o dia inteiro para o leitor de tela, pelo dia da semana da própria data (`date` já é a data de Brasília; nada é convertido);
    - o badge, o tema ou o motivo e, só na célula realizada, os números e a oferta (`formatOffering` do E2.10);
    - "Editar" com `edit_cell_report` e a célula não excluída.
  - `src/lib/cell-reports/report-sheet.ts` (do E2.01, reescrito):
    - `REPORT_PARAM` e `readReportParam(params)` (`isUuid`; o inválido sai da URL);
    - `closeMode(state)`: `back` quando a consulta foi aberta pela linha, `replace` quando veio por link (AQ-8);
    - `toReportSheetView(detail, preview)`: as seções da T10, com o que a linha já tem quando a leitura ainda não chegou (T12); em "Não houve célula", só o motivo e as observações (P-LRE-34); os participantes ordenados pela DA-8; os visitantes na ordem gravada;
    - `reportSheetActions(access, detail)`: "Editar relatório" (`edit_cell_report` e a célula não excluída), "Excluir relatório" (`delete_cell_report`), "Ver célula" (`cell_visible`), "Ver todos os relatórios desta célula" (sempre) e "Ver histórico" (`view_audit_log`).
    - Sai o `reportSheetState` do E2.01, que limitava a consulta à célula excluída e a quem edita.
  - `src/lib/cell-reports/filter-texts.ts` e `src/lib/cell-reports/texts.ts` (E2.11): **todos** os textos deste spec. Os textos da consulta que estão em `src/lib/deletion/texts.ts` (E2.01) passam para cá; os da exclusão ficam lá.
- **Hooks:**
  - `use-cell-report-filters.ts`: lê a URL, grava a URL limpa na primeira leitura (`replace`), aplica, aplica um atalho, tira um chip e limpa tudo, sempre voltando para a página 1. Convive com o `useListSearchParams` (`q`, `page`, `size`) e com o `report` por atualizações funcionais do `setSearchParams`, como o `use-cell-filters` do E2.10.
  - `use-cell-reports-list.ts`: as duas RPCs em paralelo, num `queryFn` só, com a chave `["cell_reports", "list", { page, pageSize, search, filters }]`. Saem a segunda consulta do número de participantes (`PARTICIPANT_COUNT_SELECT`, `withParticipantCounts`), o `.eq("cell_id")` do E2.10 e o `fetchListPage` (que sai do projeto com os testes, se ficar sem uso). Continuam o `placeholderData` e o `useClampPage`.
  - `use-cell-report-filter-options.ts`: `useCellReportFilterOptions(person, search)` (infinito, 21 linhas por página, chave `["cell_reports", "filter-options", person, search]`) e `useCellReportFilterNames(person, ids)` (chave `["cell_reports", "filter-names", person, ids]`), passados ao `PersonMultiFilter` por props (E2.10).
  - `use-server-weeks.ts`: `rpc("server_weeks")` sem argumento, chave `["server", "weeks"]`, `staleTime: 60_000`, `refetchOnWindowFocus: "always"`, `retry: 1` (DA-10).
  - `use-cell-identity.ts` (E2.10), sem mudança.
  - `use-cell-report.ts` (E2.01 e E2.05): passa a ler só a linha da view por id (`CELL_REPORT_DETAIL_SELECT`, chave `["cell_reports", "detail", id]`), com `null` para "não encontrado". Os participantes ficam no `use-cell-report-participants` (chave `["cell_reports", "participants", id]`, `fetchAllRows`), que pode falhar à parte (T12). Os dois correm em paralelo, também em "Não houve célula" (a tela ignora os participantes).
  - `use-cell-report-list-preview.ts`: a linha no cache das listas (`getQueriesData(["cell_reports", "list"])`), sem leitura, para o topo da consulta aparecer na hora (T12). É descartada se a leitura disser "não encontrado".
  - `use-cell-report-sheet.ts` (AQ-8, AQ-9): abrir, fechar, a entrada da edição e o foco de volta, descritos abaixo.
- **Componentes reaproveitáveis:**
  - `src/components/filters/WeekShortcuts.tsx` (P90): `ToggleGroup type="single"` com os atalhos recebidos por props (rótulo, nome acessível, desabilitado, marcado). O valor vazio do `onValueChange` é ignorado (UXD-3).
  - `SingleChoiceFilter` (E2.07) ganha `layout="stacked"` (uma opção por linha, UXD-2), sem mudar Membros nem Células.
  - `src/components/SheetCloseButton.tsx`: o "✕" de 44×44 px com "Fechar", tirado do `CellReportSheet` do E2.01. O `SheetContent` esconde o embutido com `[&>button:last-child]:hidden`, sem editar `ui/` (AQ-13). O `FiltersSheet` do E2.07 passa a usá-lo, se ainda usar o embutido.
  - `src/components/RecordSheet.tsx` (P92): a casca do painel de consulta (cabeçalho fixo com o título e o "✕", corpo que rola, rodapé opcional com a área segura), para as próximas consultas.
  - `src/components/NameList.tsx` (P94): o `h3` com o número e a `ul` em colunas (`columns-[9rem]`), com a frase do vazio.
- **Telas e componentes de Relatórios (`src/components/cell-reports/`):**
  - `CellReportFilters.tsx`: os 6 filtros na ordem da UXD-2, com o `RecordFilterChip` da Célula no topo (P93), o `PersonMultiFilter` do Líder e do G12 com as fontes daqui, o `DateRangeFilter` com "Período", "De" e "Até" e sem `max`, o `MultiChoiceFilter` do Tipo e o `SingleChoiceFilter` da Reunião.
  - `ReportCard.tsx` e `ReportsTable.tsx` (T1, T2, UXD-5 a UXD-7): no PR 2, sem o botão do P91, com o acesso de hoje à consulta (E2.01); no PR 3, com o botão.
  - `CellReportSheet.tsx`, movido de `src/components/` e reescrito (T10 a T13), com `ReportMeetingSection`, `ReportCellPeopleSection`, `ReportCellAddressSection` e `ReportSheetFooter`. A consulta não usa o `CellSnapshotBlock` do E2.11: o topo é a célula atual (P-LRE-22), e as pessoas registradas ficam em "Pessoas da célula".
  - `src/pages/CellReports.tsx`: T1 a T9 (PR 2) e T10 a T13 (PR 3), com `useMinWidth(1280)` (cartões ou tabela, AQ-11) e `useMinWidth(1024)` (painel ou `Sheet`). O `useIsMobile` sai desta tela. O `CellReportDialog` (E2.11) fica ao lado do `Sheet` da consulta, e não dentro dele.

#### URL e histórico da consulta (AQ-8)
| Ação | O que acontece |
|---|---|
| Tocar na linha | `setSearchParams(com report, { state: { reportFromList: true } })`, **sem** `replace`: uma entrada nova. O foco de volta fica guardado no botão da linha (`use-return-focus`). |
| Voltar do aparelho ou do navegador | A URL perde o `report`, e a consulta fecha (o estado da consulta sai da URL). |
| "✕", `Esc`, toque fora, "Fechar" do "não encontrado" | `closeMode`: com `state.reportFromList`, `navigate(-1)`; sem, tira o `report` com `replace`. O `history.state` sobrevive ao recarregar, então a consulta reaberta por recarregar também volta uma entrada. |
| Abrir por link ou recarregar | Lê o `report`; inválido, sai com `replace` junto com a limpeza dos filtros. O foco vai para o título da consulta e, ao fechar, para o `h1`. |
| "Ver célula", "Ver todos os relatórios desta célula", "Ver histórico" | `navigate(caminho)`, com uma entrada nova. O voltar devolve a lista com a consulta aberta. |
| Sem a lista de Relatórios (Hugo) | A tela sem acesso do E2.02, sem ler o relatório. |

#### Edição por cima da consulta (AQ-9)
- "Editar relatório" abre o `CellReportDialog` (E2.11) em modo de edição, com a linha da consulta, e cria uma entrada no mesmo endereço (`state: { …, reportEdit: true }`, DA-11).
- O formulário abre quando há o pedido de edição na tela **e** a entrada no histórico. O voltar tira a entrada: o formulário pede para fechar pelo caminho dele ("Descartar as alterações?" quando houver mudança). "Continuar editando" recria a entrada; "Descartar" fecha.
- Salvar e cancelar fecham o formulário e tiram a entrada (`navigate(-1)`). O foco volta a "Editar relatório".
- Os dois diálogos são do Radix: a camada de cima prende o foco e recebe o `Esc` e o toque fora; o `Sheet` de baixo não fecha.
- Recarregar com o formulário aberto reabre só a consulta: o pedido de edição não sobrevive, e a entrada fica como uma entrada da consulta.
- **Plano B (P-LRE-29):** se a casca do formulário do E2.11 não aceitar o pedido de fechar vindo de fora, "Editar relatório" fecha a consulta (sem tirar o `report` da URL), abre o formulário e reabre a consulta ao salvar ou cancelar. O resultado para a pessoa é o mesmo, sem o voltar do aparelho fechando só o formulário.

#### Depois de gravar
| Gravação | O que desatualiza | A consulta | A lista |
|---|---|---|---|
| Editar pela consulta, com mudança (`changed`) | `refreshAfterReportWrite` (E2.09): `["cell_reports"]` (lista, consulta, participantes, opções e nomes dos filtros, identidade da célula, conferência do lançamento, contexto da edição), `["cells"]`, `["dashboard"]` e `["members"]` | Recarrega (está ativa) e mostra os valores novos; até a resposta, o corpo fica com `opacity-60` e `aria-busy` | Recarrega atrás |
| Editar sem mudança (`changed = false`) | Nada | Igual | Igual |
| Editar recusado (`not_found_or_deleted`, `report_cell_deleted`) | `refreshAfterReportWrite` (E2.11) | Recarrega: "Relatório não encontrado" ou o badge e o aviso da célula excluída | Recarrega |
| Excluir pela consulta | Nesta ordem: fecha a consulta (`closeMode`); tira o relatório de todas as páginas de `["cell_reports", "list"]` no cache e diminui o total delas (DA-12); `removeQueries` da consulta e dos participantes desse id; `refreshAfterReportWrite`; foco no `h1` | Fecha | Sem o relatório, nem por um instante |
| Editar ou excluir pela linha; novo relatório; restaurar | Como no E2.01 e no E2.11 (`refreshAfterReportWrite`) | — | Recarrega |
| Gravar membro ou célula | `refreshAfterMemberWrite` e `refreshAfterCellWrite` (E2.06), que já incluem `["cell_reports"]` | Recarrega, se aberta (nomes e célula atuais) | Recarrega |

A chave `["server", "weeks"]` fica fora dessas funções: nenhuma gravação muda a data de hoje.

### Onde cada regra é imposta
| RN | Banco (constraint, RLS, trigger, RPC) | UI |
|---|---|---|
| RN-01 | `cell_reports_list` e `cell_reports_list_count` com a busca e os 7 filtros. Sem permissão nova: o acesso é o da `cell_reports_view`. | Painel com Célula (por link), Líder, G12, Período, Tipo e Reunião; os atalhos; só para quem tem a lista (`canSeeRoute`, E2.02) |
| RN-02 | `private.cell_report_filter_sql`: `AND` entre filtros, `= ANY` dentro deles; total exato pela `cell_reports_list_count`; página por `LIMIT`/`OFFSET` sobre uma ordem total | "Aplicar filtros" no celular e na hora no computador; atalhos e chips na hora; página 1 a cada mudança aplicada |
| RN-03 | Toda linha vem da `cell_reports_view` (visibilidade pelo retrato, excluídos de fora, relatórios de célula excluída dentro); o retorno é o tipo da view | — |
| RN-04 | Filtros pelas colunas `snapshot_*`; `search_text` pelo líder registrado (E2.11); as colunas `cell_*` são as atuais | A linha e a consulta pelo retrato; as dicas sempre |
| RN-05 | `v.snapshot_leader_id = ANY`, 10 primeiros distintos, sem excluídos (DA-2); `cell_report_filter_options('leader')` só dos relatórios visíveis, sem excluídos, com o nível | Seletor com limite de 10, "Escolha até 10 pessoas.", nível do P40, "Nenhum líder encontrado." |
| RN-06 | `v.snapshot_g12_leader_id = ANY` (`g12_id` do E2.06: o próprio G12 entra; pastor e sem liderança nunca; congelado para o excluído); `cell_report_filter_options('g12')` | Seletor só com o nome; a dica do casal |
| RN-07 | `cell_report_filter_names`: nome só para quem é visível como membro, ou líder registrado ou G12 de relatório visível, e não excluído; nenhuma linha para os outros casos; o filtro com o id do excluído não traz nada | "Pessoa indisponível" e a dica; nunca a `member_names` |
| RN-08 | `_cell_id` (`v.cell_id =`); `cell_identity` (E2.10) | O chip primeiro, no painel e acima da lista (P93); "Célula indisponível"; só por link |
| RN-09 | `v.date >=` e `v.date <=` (data de Brasília, os dois dias inclusive); datas invertidas ignoradas (DA-6) | Conferência ao sair do campo e ao aplicar; mensagens; sem `max` |
| RN-10 | `server_weeks()` (`sp_local` e `week_start`) | `WeekShortcuts` (P90): desabilitados sem a data do servidor; marcado por igualdade; as datas na URL |
| RN-11 | `v.snapshot_cell_type = ANY` (valores de `cell_types()`) e `v.was_held =` | Tipo em caixas ou no `Popover`; Reunião em rádio (uma por linha) ou `Select` |
| RN-12 | Normalização dos valores fora da regra (DA-1) | `src/lib/cell-reports/filters.ts`: URL, inválidos fora, contagem, chips e "Limpar filtros" |
| RN-13 | A ordem dentro da `cell_reports_list` (`date DESC, time DESC, id`) | Sem reordenar; a legenda da tabela |
| RN-14 | `v.search_text ILIKE ALL`, 5 padrões (E1.08, E2.11) | `toSearchPatterns`, `maxLength={100}` |
| RN-15 | Colunas da view: nomes do retrato, G12, endereço atual, `participants_count` (com os excluídos e os automáticos), `visitors_count`, `offering` anulável | `report-row.ts`: em "Não houve célula", só o motivo; "Não informada"; até 3 linhas; dia abreviado |
| RN-16 | `cell_reports_view` por id (nenhuma linha nos três casos); `cell_visible`; autoria (E2.05); as ações impostas pela `save_cell_report` (E2.11) e pela `delete_cell_report` (E2.01); nenhum evento em leitura | `CellReportSheet` (P92): ações por `my_access`, `cell_deleted` e `cell_visible`; "Ver histórico"; "Relatório não encontrado"; `report` na URL |
| RN-17 | `cell_report_participants_view`: nomes para quem vê o relatório (D-4 do E1.08), sem dado do cadastro, com as marcas mascaradas (E2.11) | `NameList` (P94), ordem da DA-8; nada em "Não houve célula" |
| RN-18 | A lista e a `dashboard_summary` leem a mesma view com a mesma condição de data; a semana pelas mesmas funções (DA-7) | `cellReportListHref` (para o E2.14) |

### Respostas às perguntas da UX (AQ-1 a AQ-13)
| # | Resposta |
|---|---|
| AQ-1 | **Confirmados** os nomes e os valores da tabela de Navegação e rotas. Um módulo só, `src/lib/cell-reports/filters.ts`, que absorve o `cell-filter.ts` do E2.10 e gera os links da RN-18 para o E2.14. O E2.13 usa o mesmo módulo (chips e argumentos). O servidor normaliza os mesmos valores (DA-1). |
| AQ-2 | **Sim.** `server_weeks()`: hoje e as três semanas, em Brasília, segundo o servidor. Leitura própria, sem depender da lista nem do `my_access`, relida ao voltar para a aba (DA-10). Sem ela, os atalhos ficam desabilitados. |
| AQ-3 | **Sim.** `cell_reports_list` devolve as linhas da view com as colunas que a tela pedir (`CELL_REPORT_LIST_SELECT`), na ordem da RN-13, e `cell_reports_list_count` dá o total exato. O número de participantes vem na mesma chamada. Observações e visitantes também vêm, porque só 25 linhas são calculadas e o topo da consulta aparece na hora. O tempo-limite (57014) ou qualquer recusa vira o `Alert`, sem texto técnico (UX-31). |
| AQ-4 | **Sim.** `cell_report_filter_options(person, search)` devolve id, nome e, no Líder, `g12_level`, `is_pastor` e o sexo do pastor (P40), 21 linhas por página, com a busca sem acento. `cell_report_filter_names(person, ids)` resolve os ids da URL pela mesma fonte, mais a `members_view`, e não devolve nada nos outros casos. Nunca pela `member_names`. |
| AQ-5 | **Sim, sem mudança.** A `cell_identity` e o `RecordFilterChip` do E2.10. A lista filtrada usa `_cell_id` nas duas RPCs, com o total exato. |
| AQ-6 | **Sim, sem RPC nova.** A `cell_reports_view` por id tem tudo da T10, com as quatro colunas novas (o endereço completo e `cell_visible`). Os participantes vêm à parte, em paralelo, e podem falhar sozinhos. A ordem sem diferenciar acentos é feita na tela (DA-8). A linha da lista, lida do cache, serve de prévia e é descartada se a leitura disser "não encontrado". |
| AQ-7 | Caiu (PO-UX-2). |
| AQ-8 | **Sim.** Ver [URL e histórico da consulta](#url-e-histórico-da-consulta-aq-8). |
| AQ-9 | **Sim.** Ver [Edição por cima da consulta](#edição-por-cima-da-consulta-aq-9) e [Depois de gravar](#depois-de-gravar). Plano B: o do P-LRE-29. |
| AQ-10 | **Sim.** Fecha a consulta, tira o relatório das páginas no cache (DA-12), recarrega e põe o foco no `h1`. |
| AQ-11 | **Sim.** `useMinWidth(1280)` para cartões ou tabela e `useMinWidth(1024)` para o painel, com o valor certo no primeiro render. |
| AQ-12 | **DA-1.** Fora do tipo: recusa (400), que a tela nunca provoca e que vira o `Alert`. Com o tipo certo e fora da regra: normalizado como a tela, sem erro. `report` sem formato de id nunca chega ao servidor. |
| AQ-13 | **Sim.** `SheetCloseButton` (44×44 px, "Fechar") e `[&>button:last-child]:hidden` no `SheetContent`, como o E2.01 já faz, sem editar `ui/`. Vale para a consulta e para o `FiltersSheet`. Risco 12. |

### Perguntas Q-1 a Q-7: padrão e custo das alternativas
O desenho segue os padrões adotados. Nenhuma alternativa muda a estrutura: as RPCs e os componentes ficam.

| Pergunta | Padrão desenhado | Custo da alternativa |
|---|---|---|
| Q-1. Quem vê os participantes pelo nome | Todos que veem o relatório | **Cerca de 1 dia.** A `cell_report_participants_view` passa a devolver as linhas só para quem tem "Editar Relatórios de Células" (o formulário de edição continua com os nomes); a consulta mostra só os números (T16); a D-4 do E1.08 é revista; pgTAP e Playwright. |
| Q-2. Atalhos também no menu | Só na tela | **Cerca de 0,5 a 1 dia, só no front.** Três subitens no `AppSidebar`, com os links de `cellReportListHref` e as datas da `server_weeks` (desabilitados sem ela), `aria-current` e testes. |
| Q-3. O link guarda a semana relativa | As datas | **Cerca de 1,5 dia.** Parâmetro `_week_offset smallint` (0 a 2) nas duas RPCs, convertido no servidor pela mesma regra da `server_weeks`, sem esperar a data na tela; `week=` na URL; o chip único; os links do E2.14 e a leitura do E2.13 acompanham. |
| Q-4. A lista abre com "Esta semana" | Sem período | **Cerca de 0,5 a 1 dia.** Sem `from`, `to` e `period=all`, a lista usa a semana atual: com a Q-3, por `_week_offset = 0`, sem esperar nada; sem ela, a primeira leitura espera a `server_weeks` (uma chamada a mais). "Todas as semanas" e testes. |
| Q-5. Célula no painel | Só por link | **Cerca de 1,5 dia.** `cell_report_filter_cell_options(_search, _limit, _offset)`, *definer*: as células da `cells_view` e as de relatórios visíveis, com a identificação atual (a regra da `cell_identity`); `PaginatedSelect` de escolha única; testes de vazamento. |
| Q-6. Filtro de rede | Não existe | **Cerca de 2 dias.** `_network_ids uuid[]` normalizado para os ids que a `members_view` de quem consulta devolve (para não revelar a cadeia de quem não se vê, como a Liderança do E2.07) e o fragmento `v.snapshot_leader_id = ANY (…) OR v.snapshot_leader_id IN (SELECT h.member_id FROM private.member_hierarchy h WHERE h.ancestor_ids && …)`, com o GIN do E2.06; o 7º filtro, `network` na URL e a contagem até 7. |
| Q-7. G12 por casal | Por pessoa | **Cerca de 1 dia.** O normalizador acrescenta o cônjuge de cada G12 escolhido quando ele também é o G12 de algum relatório visível (para não revelar o casal de quem não se vê; o PO confirma); a dica e os testes mudam. A mesma resposta da Q-5 do E2.10 vale para os dois. |

### Decisões técnicas
| # | Decisão | Motivo |
|---|---|---|
| DT-01 | A lista vem de duas RPCs, `cell_reports_list` e `cell_reports_list_count`, *definer*, sobre a `cell_reports_view`, com SQL dinâmico só com os filtros ativos. | O molde do E2.07 e do E2.10. O PostgREST aplicaria os filtros de uma RPC depois de materializar o resultado, então eles são parâmetros. *Definer* só para chamar os auxiliares de `private` sem dar USAGE no schema. O filtro do excluído (DA-2) e a normalização (DA-1) ficam no banco, num lugar só. |
| DT-02 | Quem aparece é decidido só pela `cell_reports_view`. As RPCs devolvem o tipo da view. | O escopo pelo retrato continua num lugar só (E2.11), e a paridade do E2.02 vale para a lista. |
| DT-03 | A página em duas etapas: os ids com as chaves de ordem, depois as linhas por `id = ANY`. | Os nomes, o G12, a autoria, o número de participantes e `cell_visible` são calculados só para as 25 linhas. |
| DT-04 | O total vem de uma segunda RPC, em paralelo. Sem 416. | DT-04 do E2.07 e do E2.10. |
| DT-05 | A ordem é feita dentro da RPC (`date DESC, time DESC, id`). O front não reordena. | RN-13; a mesma ordem do E1.08. |
| DT-06 | Líder, G12 e Tipo pelas colunas do retrato; o id do excluído sai no normalizador, e o filtro continua valendo. | RN-04, RN-05, RN-07; DA-2. |
| DT-07 | Os seletores por duas funções *definer*: os ids saem só da `cell_reports_view` (e da `members_view`, nos nomes); o nome, o nível, a marca de pastor e o sexo do pastor são lidos da tabela só para esses ids. Reusa o `cell_filter_person` e o `first_distinct_ids` do E2.10. | RN-05 a RN-07: as opções são os relatórios visíveis, sem os excluídos, e nada da cadeia é lido. Mais barato que calcular os nomes de todos os relatórios visíveis. |
| DT-08 | `server_weeks()` para a data de hoje e as três semanas, *invoker*, sem ler tabela. | RN-10 e AQ-2. As mesmas funções da `dashboard_summary` (RN-18). O E2.13 usa a mesma leitura. |
| DT-09 | A consulta é a `cell_reports_view` por id, com quatro colunas novas no fim, e a `cell_report_participants_view` por relatório, em paralelo. Sem RPC da consulta. | A linha da lista e a da consulta têm a mesma forma (a prévia da T12); a view já tem o retrato, a autoria e o escopo. Uma RPC repetiria tudo isso. |
| DT-10 | A `save_cell_report` deixa de lançar, numa migration separada. | DA-12 do E2.11. É a única escrita do passo e depende do promote do formulário do E2.11. |
| DT-11 | No front, `src/lib/cell-reports/filters.ts` é o módulo único do filtro (URL, contagem, chips, argumentos e links). Os componentes do E2.07 e do E2.10 são reusados; entram `WeekShortcuts` (P90), `RecordSheet` (P92), `NameList` (P94) e `SheetCloseButton`. | AQ-1, RN-18 e P90 a P94: Membros, Células e Relatórios com o mesmo painel; o E2.13 e o E2.14 usam o mesmo módulo. |
| DT-12 | A consulta fica na URL com uma entrada no histórico; fechar volta uma entrada ou tira o parâmetro, conforme a origem; a edição por cima tem a entrada dela. | AQ-8, AQ-9, UXD-10 e UXD-11. |
| DT-13 | As chaves ficam sob `["cell_reports"]` (mais `["server", "weeks"]`). Excluir pela consulta tira o relatório do cache antes de recarregar. | AQ-10; as funções de atualização do E2.06 e do E2.09 já cobrem o resto. |
| DT-14 | Quatro PRs: banco; lista com filtros e atalhos; consulta; consulta no detalhe da célula (opcional). | O banco vai ao ar sozinho. A lista e a consulta mexem na mesma tela, em sequência, e a consulta pode ser escrita em paralelo. O detalhe é a parte opcional (DA-14). |

### Riscos (concorrência, escala, segurança)
1. **SQL dinâmico numa função *definer* (injeção).**
   - Mitigações: só fragmentos fixos, escolhidos pela nulidade de cada campo; os valores por `USING`; o `code-reviewer` confere que nenhuma entrada passa pelo `format`; pgTAP com textos maliciosos (`'); DROP …; --`, `%`, `_`, `\`, aspas) na busca.
2. **Funções *definer* lendo as views.** A visibilidade depende de o `WHERE` da `cell_reports_view` e da `members_view` usar `auth.uid()`. Se alguém trocar uma delas para *invoker* ou passar a usar `current_user`, as RPCs mudariam de comportamento.
   - Mitigações: o teste de paridade por persona (ids de todas as páginas e o total sem filtros iguais aos da view); a nota nas Armadilhas do `CLAUDE.md`.
3. **Custo da busca.** O `ILIKE` não é *leakproof*, então a busca calcula o `search_text` (nome do líder registrado e tema) de todos os relatórios visíveis, nas duas chamadas. A meta é 400 ms com 100 mil relatórios.
   - Plano B: o tema normalizado numa coluna gerada de `cell_reports` e o nome normalizado numa coluna gerada de `members`, com `pg_trgm` (não instalada hoje). Volta ao `architect` antes.
4. **O tipo de retorno amarrado à view.** A partir daqui, `DROP VIEW cell_reports_view` exige derrubar e recriar as duas RPCs (um `CASCADE` apagaria as funções). `CREATE OR REPLACE VIEW` com colunas novas no fim continua funcionando. **Nenhum PR que recrie a `cell_reports_view` pode andar junto com o PR 1 daqui.**
5. **Duas chamadas (linhas e total) em fotos diferentes.** O total pode ficar diferente das linhas por um instante. A leitura seguinte corrige, e o `useClampPage` trata a página além do fim.
6. **O G12 muda entre as páginas** (leitura técnica 3). Esperado (RN-06).
7. **Vazamento pelos seletores e pelos nomes.** Uma opção ou um nome fora do que a lista mostra violaria a RN-07 e a RN-23 do E2.02.
   - Mitigações: os ids saem só das views; pgTAP com Pedro (Débora, Tânia e Magda nunca voltam em nenhuma resposta; Samuel não volta para Pedro), Diego (Samuel volta, pelo R10) e Lia (André volta pelo relatório; Caio não volta); a API inspecionada no Playwright (UX-11).
8. **Colunas caras lidas sem filtro.** `cell_visible`, `participants_count` e `search_text` são calculadas para todas as linhas visíveis se uma leitura direta da view as pedir sem filtrar por id. O front só as lê pela RPC da lista (25 linhas) ou por id.
   - Mitigação: critério de pronto (nenhum `select("*")` e nenhuma dessas colunas numa leitura da view sem `id`); comentário no `fields.ts`.
9. **Retirada do lançamento de transição.** Uma aba aberta desde antes do promote do E2.11 (PR 4) que ainda lance pela `save_cell_report(NULL, …)` recebe `report_id_required`, que a tela antiga mostra como erro. Mitigação: o PR 1 só vai ao ar depois desse promote (tarefa 1); recarregar resolve.
10. **Diálogos empilhados e o histórico** (AQ-9). A entrada da edição e o pedido de fechar de fora dependem da casca do formulário do E2.11. Plano B: o do P-LRE-29. O QA testa o voltar com e sem mudança no formulário.
11. **`server_weeks` lenta ou fora.** Os atalhos ficam desabilitados, e a lista funciona (RN-10). Sem relógio do aparelho como reserva.
12. **O "✕" escondido por um seletor de CSS.** Se o `ui/sheet.tsx` mudar a ordem dos filhos, o embutido volta a aparecer. Mitigação: o teste do UX-02 ("Close" não aparece no DOM) e um teste do `SheetCloseButton`.
13. **Tempo-limite de 8 s de `authenticated`.** Muito acima das metas. O 57014 vira o `Alert` (UX-31).
14. **Repositório público:** as mensagens das guardas trazem só nomes de objetos.
15. **Advisor do Supabase:** quatro funções *definer* expostas a mais (`cell_reports_list`, `cell_reports_list_count`, `cell_report_filter_options` e `cell_report_filter_names`), no padrão da `members_list` e da `cells_list`.
16. **E2.10 atrasado.** A guarda falha sem o `first_distinct_ids`, o `cell_filter_person` e a `cell_identity`.
    - Plano B, se o usuário quiser o E2.12 antes: o PR 1 cria os dois auxiliares (com os mesmos nomes e corpos do E2.10, por `CREATE OR REPLACE` e `duplicate_object`), e o filtro Célula e o "Ver todos os relatórios desta célula" saem do PR 2 e do PR 3 para um PR depois do E2.10. Cerca de meio dia a mais.

### Ordem com os outros passos
**Pré-requisitos do PR 1 (guarda na migration 1 e tarefa 1), em produção:**
- E2.01 inteiro;
- PR 1 do E2.02 (`viewer_sees_cell_people`, `members_view` com o `WHERE` canônico);
- banco do E2.05 (autoria na `cell_reports_view`);
- PR 1 do E2.06 (`private.member_hierarchy`);
- PR 2 do E2.08 (`cell_types()`);
- banco do E2.09 (`sp_local`);
- PR 1 do E2.10 (`first_distinct_ids`, `cell_filter_person`, `cell_identity`);
- E2.11 inteiro: os PRs 1 e 2 no banco (retrato, `submit_cell_report`) e o PR 4 promovido (o formulário que lança pela `submit_cell_report`).

**PR 2 (lista, filtros e atalhos):** depois do PR 1 (tipos; em produção antes do promote) e do front que mexe nas mesmas telas na `main`: E2.07 (PR 2, componentes P50 a P54), E2.10 (PR 2, `PersonMultiFilter` com fontes por props e `RecordFilterChip`; PR 3, filtro Célula), E2.11 (PRs 3 e 4: a linha pelo retrato e o `CellReportDialog`), E2.09 (`refreshAfterReportWrite`, `useMinWidth`), E2.06 (`src/lib/hierarchy/level.ts`), E2.02 (`my_access`, `canSeeRoute`) e E2.01 (PR 4, a consulta de hoje).

**PR 3 (consulta):** depois do PR 2 na `main` (mesma tela) e do front do E2.05 (`RecordAuthorship`, "Ver histórico"). Os arquivos novos (`report-sheet.ts`, os hooks, o `CellReportSheet`, `RecordSheet`, `NameList`) podem ser escritos em paralelo com o PR 2.

**PR 4 (detalhe da célula, opcional):** depois do PR 3 e do PR 5 do E2.10 (o detalhe).

**Ordem ideal do bloco:** … E2.10 → E2.11 → **E2.12** (PR 1; depois PR 2, com a consulta escrita em paralelo; depois PR 3; por último o PR 4) → E2.13 e E2.14.

### Dependências e impactos em outros passos
| Passo | Relação |
|---|---|
| E1.08 | A busca de Relatórios passa ao líder registrado (já no E2.11). A segunda consulta do número de participantes e o `fetchListPage` saem de Relatórios. O texto de lá fica como histórico. |
| E2.01 | A consulta deixa de ser só da célula excluída: o `reportSheetState` sai, e o `?report=` passa a mostrar "Relatório não encontrado" em vez de ser ignorado (ajustar a Navegação e o UX-27 de lá no aceite). O ícone `Eye` da tabela sai (PR 3). O fluxo de exclusão e a lista "Excluídos" não mudam. |
| E2.02 | `viewer_sees_cell_people` na view (`cell_visible`). O teste de paridade da `cell_reports_view` vale para a `cell_reports_list` sem filtros. |
| E2.05 | `RecordAuthorship` e "Ver histórico" na consulta, com as colunas de autoria da view. |
| E2.06 | `g12_id` e `g12_level` do líder registrado, pela view e pelas funções de seletor; o P40 nas opções do Líder. |
| E2.07 | Os componentes P50 a P54. `SingleChoiceFilter` ganha `layout="stacked"`; o `FiltersSheet` passa a usar o `SheetCloseButton`, se ainda usar o "✕" embutido. |
| E2.09 | `refreshAfterReportWrite` e `useMinWidth`. Nada muda na situação do relatório. |
| E2.10 | `cell-filter.ts` absorvido pelo `filters.ts` daqui; o `.eq("cell_id")` do `use-cell-reports-list` dá lugar ao `_cell_id`; `cell_identity`, `RecordFilterChip`, `first_distinct_ids`, `cell_filter_person` e `formatOffering` reusados; o "Ver todos os relatórios" do detalhe passa a gerar o link pelo `cellReportListHref`. Com o PR 4, os "Últimos relatórios" abrem a consulta. |
| E2.11 | Sai o ramo `_report_id IS NULL` da `save_cell_report` (DA-12 de lá). A consulta deixa o topo "Célula de {líder registrado}" do PR 3 de lá e passa ao da RN-16 daqui (célula atual no topo, pessoas registradas em "Pessoas da célula"); o `CellSnapshotBlock` continua no formulário. O `CELL_REPORT_ROW_SELECT` ganha as colunas da lista. |
| E2.13 | Usa `server_weeks()` (hoje e a semana atual), o `filters.ts` (chips e argumentos) e, para as linhas de relatório da planilha, `private.cell_report_filter_normalize` e `private.cell_report_filter_sql` sobre a `cell_reports_view` com o alias `v`. As linhas sem relatório precisam de fragmentos próprios (dados atuais da célula, RN-07 de lá). |
| E2.14 | Os links de "Relatórios enviados", visitantes, "Células não realizadas" e das partes do gráfico pelo `cellReportListHref`, com as datas da semana da `dashboard_summary`. A RN-05 de lá muda o card de visitantes para só célula realizada, e o teste de igualdade passa a somar só as linhas de célula realizada (DA-7). |
| E4.04, E4.06 | A linha de saneamento do Negócio (P-LRE-34). Na carga, os nomes vazios de visitantes não entram (leitura técnica 6). |
| E5.04 | As diferenças esperadas das listas filtradas (Impactos do Negócio). |
| Consolidação | A flag entra no `WHERE` das views e no `members` lido pelas funções de seletor, se o consolidado puder ser registrado num relatório. |

**Mudanças nos documentos, no aceite** (o `product-owner` atualiza a matriz, a seção 3 e o Progresso; o `architect` atualiza o resto do `CLAUDE.md` na revisão final):
- **`CLAUDE.md`:**
  - **Schema efetivo:** a `cell_reports_view` com `cell_city`, `cell_state`, `cell_zip_code` e `cell_visible`.
  - **Lógica no banco:** `cell_reports_list` e `cell_reports_list_count` (*definer*, SQL dinâmico com os filtros ativos, só a `cell_reports_view`); `cell_report_filter_options` e `cell_report_filter_names` (*definer*, ids só das views, excluído nunca); `server_weeks()`; a `save_cell_report` só edita.
  - **Front:** `/cell-reports` paginada pela `cell_reports_list`, com os filtros na URL (`src/lib/cell-reports/filters.ts`), os atalhos pela `server_weeks` e a consulta `?report=` em toda linha, com uma entrada no histórico. Sai o que restar de "Relatórios … carregam tudo no cliente".
  - **Armadilhas**, entram:
    - "filtro novo de Relatórios entra em `private.cell_report_filter_normalize` e `private.cell_report_filter_sql`, e só como fragmento fixo; valor nunca é concatenado";
    - "a `cell_reports_view` é o tipo de retorno da `cell_reports_list`: `DROP VIEW` exige recriar as duas RPCs, e todo `CREATE` ou `CREATE OR REPLACE` da view repete `WITH (security_barrier = true, security_invoker = false)` e põe colunas novas só no fim";
    - "a `cell_reports_list` devolve as linhas já na ordem da RN-13 do E2.12; o front não usa `.order()` nela";
    - "`cell_visible`, `participants_count` e `search_text` da `cell_reports_view` só por id ou pela `cell_reports_list`: numa leitura sem filtro, são calculadas para todos os relatórios visíveis";
    - "'hoje' e as semanas na tela vêm da `server_weeks()`; nunca do relógio do aparelho".
  - **Matriz** (PO): "Relatórios por período e atalhos para a semana atual, passada e retrasada" em ✅.
- **`docs/migracao.md`** (PO):
  - **3.5:** REL-13 em ✅. "Onde impor": "RPC `cell_reports_list` e `cell_reports_list_count`, `cell_report_filter_options` e `cell_report_filter_names`, `server_weeks` + UI".
  - **3.6:** DSH-05 com Relatórios pronta (`cellReportListHref`).
  - **5.5 (E4.06):** nomes vazios de visitantes não entram.
  - **Progresso:** o E2.12 com o link do spec e "(desenho pronto; entra depois do E2.11 em produção)".
  - **E5.04:** as diferenças esperadas da lista filtrada (Impactos do Negócio).

### Pontos de extensão
| Futuro | Onde muda |
|---|---|
| Q-1 a Q-7 | Ver [Perguntas Q-1 a Q-7](#perguntas-q-1-a-q-7-padrão-e-custo-das-alternativas). |
| Exportação (E2.13) | O par normalizador e `WHERE` daqui para as linhas de relatório; `server_weeks()`; o `filters.ts`. |
| Cards do Dashboard (E2.14) | `cellReportListHref` e as mesmas funções de semana. |
| Outras consultas (Turmas, Consolidação) | `RecordSheet` (P92), `NameList` (P94), `SheetCloseButton` e o molde do `use-cell-report-sheet` (URL, histórico e edição por cima). |
| Outros atalhos de período (Auditoria, Escolas) | `WeekShortcuts` (P90) e a `server_weeks()`. |
| Consolidação | O `WHERE` das views e o `members` lido pelos seletores. |
| Desempenho | Risco 3. |

### Implantação
| PR | Ordem | Efeito no front em produção |
|---|---|---|
| 1 (banco) | Pré-requisitos em produção; [conferência](#conferência-em-produção-tarefa-1); nunca junto de outro PR que recrie a `cell_reports_view`; merge → "Deploy: banco" (migrations 1 e 2) | Nenhum. As funções novas ficam sem leitor; a view ganha colunas no fim; a `save_cell_report` já não é chamada sem id. |
| 2 (lista, filtros e atalhos) | merge → promote (recusado se o PR 1 não estiver no banco) | T1 a T9: filtros, chips, atalhos, a linha nova e os estados. A consulta continua a do E2.01 e do E2.11. |
| 3 (consulta) | merge → promote | T10 a T13: a consulta em toda linha, a edição por cima e o `?report=` com "Relatório não encontrado". |
| 4 (detalhe da célula, opcional) | merge → promote | T14. |

- Antes do "Deploy: banco" do PR 1, o usuário roda a [conferência](#conferência-em-produção-tarefa-1). Uma guarda que falha não muda nada, e a publicação pode ser repetida.
- **Rollback:**
  - o front volta pelo promote do commit anterior;
  - o banco volta com uma migration nova: derruba as funções e o tipo novos; a migration 2 volta com o ramo do E2.11 restaurado; as quatro colunas da view só saem com `DROP VIEW` e a recriação da view, da `cell_report_participants_view` e das RPCs que dependem dela, então ficam (sem leitor, não fazem mal). Nada é gravado, então não há dado a desfazer.

### Conferência em produção (tarefa 1)
SQL **só de leitura**, para o usuário rodar no SQL Editor do projeto `gkhnjhmgeceoaqeynhrj` antes do "Deploy: banco" do PR 1. Nenhuma consulta devolve dado pessoal: só nomes de objetos, definições e contagens.

```sql
-- a. Pré-requisitos. Esperado: todos verdadeiros.
SELECT to_regprocedure('public.first_distinct_ids(uuid[], integer)') IS NOT NULL             AS e210_first_distinct_ids,
       to_regtype('public.cell_filter_person') IS NOT NULL                                   AS e210_enum,
       to_regprocedure('public.cell_identity(uuid)') IS NOT NULL                             AS e210_cell_identity,
       to_regprocedure('public.viewer_sees_report_people(uuid,uuid,uuid)') IS NOT NULL       AS e211_visibilidade,
       to_regprocedure('public.submit_cell_report(uuid,jsonb,uuid[])') IS NOT NULL           AS e211_submit,
       coalesce((SELECT prosecdef FROM pg_proc
                  WHERE oid = to_regprocedure('public.save_cell_report(uuid,jsonb,uuid[])')), false)
                                                                                              AS e211_save_definer,
       to_regprocedure('public.viewer_sees_cell_people(uuid,uuid,uuid)') IS NOT NULL         AS e202_cell_people,
       has_function_privilege('authenticated', 'public.viewer_sees_cell_people(uuid,uuid,uuid)', 'EXECUTE')
                                                                                              AS e202_cell_people_exec,
       to_regprocedure('public.sp_local(timestamp with time zone)') IS NOT NULL              AS e209_sp_local,
       to_regprocedure('public.cell_types()') IS NOT NULL                                    AS e208_cell_types,
       to_regclass('private.member_hierarchy') IS NOT NULL                                   AS e206_hierarchy,
       (SELECT count(*) = 17 FROM pg_attribute
         WHERE attrelid = 'public.cell_reports_view'::regclass AND NOT attisdropped
           AND attname IN ('snapshot_leader_id', 'snapshot_leader_name', 'snapshot_timothy_name',
                           'snapshot_host_name', 'snapshot_cell_type', 'snapshot_leader_g12_level',
                           'snapshot_leader_is_pastor', 'snapshot_g12_leader_id', 'snapshot_g12_leader_name',
                           'created_by_name', 'updated_by_name', 'cell_deleted', 'cell_meeting_day',
                           'cell_meeting_time', 'participants_count', 'visitors_count', 'search_text'))
                                                                                              AS cell_reports_view_colunas,
       NOT has_schema_privilege('authenticated', 'private', 'USAGE')
         AND NOT has_schema_privilege('anon', 'private', 'USAGE')                            AS private_fechado;

-- b. Nomes livres. Esperado: 0 linhas.
SELECT 'coluna' AS objeto, attname::text AS nome
  FROM pg_attribute
 WHERE attrelid = 'public.cell_reports_view'::regclass AND NOT attisdropped
   AND attname IN ('cell_city', 'cell_state', 'cell_zip_code', 'cell_visible')
UNION ALL
SELECT 'tipo', n.nspname || '.' || t.typname
  FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
 WHERE (n.nspname, t.typname) IN (('private', 'cell_report_filter'))
UNION ALL
SELECT 'função', p.oid::regprocedure::text
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE (n.nspname, p.proname) IN (('public', 'cell_reports_list'), ('public', 'cell_reports_list_count'),
                                  ('public', 'cell_report_filter_options'), ('public', 'cell_report_filter_names'),
                                  ('public', 'server_weeks'), ('private', 'cell_report_filter_people'),
                                  ('private', 'cell_report_filter_normalize'), ('private', 'cell_report_filter_sql'));

-- c. Índices usados pelas metas (informa). Esperado: cell_reports_date_id_idx,
--    cell_reports_cell_id_date_idx, cell_reports_snapshot_leader_idx e member_hierarchy_g12_id_idx.
SELECT schemaname, indexname, indexdef FROM pg_indexes
 WHERE (schemaname, tablename) IN (('public', 'cell_reports'), ('private', 'member_hierarchy'));

-- d. Dados que mudam o que a tela mostra (informa; só contagens).
SELECT (SELECT count(*) FROM public.cell_reports WHERE deleted_at IS NULL)                    AS relatorios,
       (SELECT count(*) FROM public.cell_reports r WHERE r.deleted_at IS NULL
           AND EXISTS (SELECT 1 FROM unnest(r.visitors) v WHERE coalesce(btrim(v), '') = ''))  AS visitante_sem_nome,
       (SELECT count(*) FROM public.cell_reports r WHERE r.deleted_at IS NULL AND NOT r.was_held
           AND (cardinality(r.visitors) > 0 OR r.theme IS NOT NULL OR coalesce(r.offering, 0) > 0
                OR EXISTS (SELECT 1 FROM public.cell_report_participants p WHERE p.report_id = r.id)))
                                                                                               AS nao_houve_com_dados,
       (SELECT count(*) FROM public.cell_reports WHERE deleted_at IS NULL AND was_held AND offering IS NULL)
                                                                                               AS realizada_sem_oferta,
       (SELECT count(DISTINCT snapshot_leader_id) FROM public.cell_reports WHERE deleted_at IS NULL)
                                                                                               AS lideres_registrados,
       (SELECT count(*) FROM public.cell_reports r JOIN public.members m ON m.id = r.snapshot_leader_id
         WHERE r.deleted_at IS NULL AND m.deleted_at IS NOT NULL)                              AS relatorios_de_lider_excluido,
       (SELECT max(n) FROM (SELECT count(*) AS n FROM public.cell_report_participants
                             GROUP BY report_id) x)                                            AS max_participantes,
       (SELECT max(n) FROM (SELECT count(*) AS n FROM public.cell_reports
                             WHERE deleted_at IS NULL GROUP BY cell_id) x)                     AS max_relatorios_por_celula;

-- e. Definições atuais (base para as migrations; sem dado pessoal).
SELECT pg_get_viewdef('public.cell_reports_view'::regclass, true);
SELECT pg_get_viewdef('public.cell_report_participants_view'::regclass, true);
SELECT pg_get_functiondef('public.save_cell_report(uuid,jsonb,uuid[])'::regprocedure);
SELECT relname, relacl, reloptions FROM pg_class
 WHERE oid IN ('public.cell_reports_view'::regclass, 'public.cell_report_participants_view'::regclass);

-- f. Volume e configuração.
SELECT (SELECT count(*) FROM public.members WHERE deleted_at IS NULL)      AS membros,
       (SELECT count(*) FROM public.cell_reports WHERE deleted_at IS NULL) AS relatorios,
       current_setting('work_mem')                                         AS work_mem;
SELECT rolname, rolconfig FROM pg_roles WHERE rolname IN ('authenticated', 'authenticator');
```
**Parar e voltar ao `architect`:** (a) com algum falso; (b) com linhas; (c) sem algum dos quatro índices. Em (d), os números não param a publicação: `visitante_sem_nome` e `nao_houve_com_dados` maiores que zero vão como achado (leitura técnica 6 e P-LRE-34), e `relatorios_de_lider_excluido` diz quantos relatórios ficam sem a opção do líder no seletor.

**No código (tarefa 1):** na `origin/main` do `mci-connect`, nenhuma chamada à `save_cell_report` sem `_report_id` (o lançamento é pela `submit_cell_report` desde o PR 4 do E2.11), e esse PR já promovido.

### Verificações obrigatórias (para o QA)
**pgTAP** (`supabase/tests/database/e212_*.test.sql`, autocontido, com `ROLLBACK`). A massa é a do Negócio, com o retrato da massa (R5 com Fábio e Discipulado), os dados que as regras do E2.04 e do E2.08 exigem e os relatórios montados com a marca de manutenção do E2.11 (`SET LOCAL mci.cell_report_write = 'on'`, DA-11 de lá). As consultas "pela API" rodam como `authenticated`, com `request.jwt.claims` de cada persona.

- **Estrutura e privilégios:** `cell_reports_list`, `cell_reports_list_count`, `cell_report_filter_options` e `cell_report_filter_names` *definer*; `server_weeks` *invoker*; todas com `search_path` fixo e EXECUTE só para `authenticated`; as internas sem EXECUTE para `anon`, `authenticated` e `service_role`; os papéis da API sem USAGE em `private`; a `cell_reports_view` com as colunas de antes na mesma posição, as quatro novas no fim e as `reloptions` de antes.
- **Paridade (RN-01, RN-03):** para cada persona (Rita, Samuel, Pedro, André, Diego, Caio, Ester, Hugo e Lia), os ids de todas as páginas da `cell_reports_list` sem filtros são os da `cell_reports_view`, na ordem da RN-13, e a `cell_reports_list_count()` é igual à contagem dela. Hugo: só os relatórios em que está registrado.
- **RN-02 a RN-11, RN-13 e RN-14:** os critérios pela `cell_reports_list` e pela `cell_reports_list_count`, com a sessão de cada persona.
- **RN-05 a RN-07:**
  - as opções de Líder e de G12 de Rita, Pedro e Diego exatamente como nos critérios, em ordem alfabética, com e sem busca, com o nível e a marca de pastor; o sexo só no pastor;
  - `cell_report_filter_names`: Débora e Tânia para Pedro (nenhuma linha), Tânia para Diego (o nome), André para Lia (o nome, pelo relatório), Caio para Lia (nenhuma), Caio para Rita (o nome); excluído e inexistente (nenhuma);
  - Fábio excluído (com os discípulos reatribuídos): fora das opções, nenhuma linha nos nomes, `_leader_ids => {Fábio}` dá zero, e R5 continua na lista sem filtro, com "Fábio" e o G12 Pedro, também depois de André passar ao ramo de Tiago;
  - 12 ids valem os 10 primeiros; repetidos e nulos (DA-3);
  - nenhuma resposta de Pedro traz o id ou o nome de Débora, de Tânia, de Samuel ou de Magda.
- **RN-09:** os dois dias inclusive (o relatório de 23:30 do último dia), só "De", só "Até", datas invertidas (DA-6) e datas futuras, nas sessões em UTC e em Asia/Tokyo.
- **RN-10:** `server_weeks(_at)` no sábado, 28/11/2026, às 23:59:59 de Brasília (02:59:59 UTC de domingo) dá a semana de 22/11; às 03:00:00 UTC de domingo, a de 29/11; na terça, 24/11, às 21:00, as três semanas dos critérios. Nas sessões em UTC e em Asia/Tokyo. Igual à `dashboard_summary(_at).week_start` no mesmo instante.
- **RN-13:** 60 relatórios na mesma data e no mesmo horário, percorridos de 25 em 25, aparecem uma vez cada; com filtro, a mesma ordem relativa.
- **RN-16:** a `cell_reports_view` por id para Pedro em R8, em R3 (excluído) e num id inexistente: nenhuma linha nas três; `cell_visible` igual a "a célula está na `cells_view`" para cada persona e cada relatório (Lia em R1: falso; Rita em R6: falso); as colunas novas de R1.
- **RN-17:** os participantes de R1 para Pedro: os 8 nomes, com `member_is_active` e `member_gender` nulos para Beatriz, Débora e Sara; nenhuma coluna além das da view; Hugo não lê nenhum.
- **RN-18:** para Rita, Pedro e Diego, no mesmo teste, `dashboard_summary()` comparada com a lista filtrada pela semana de `server_weeks()`: `reports_sent` = `cell_reports_list_count(_date_from, _date_to)`; `visitors` = a soma do `visitors_count` das linhas (DA-7); `cells_not_held` = a contagem com `_held => false`; `reports_sent − cells_not_held` = a contagem com `_held => true`; com um relatório de célula excluída na semana.
- **Injeção (risco 1):** textos maliciosos na busca são tratados como texto, sem erro e sem efeito.
- **DA-1:** os valores fora da regra normalizados; um uuid malformado e uma data impossível recusados (22P02, 22007 ou 22008).
- **Migration 2:** `save_cell_report(NULL, …)` recusa com `report_id_required`, sem gravar; com id, os testes do E2.05 e do E2.11 continuam passando (os que lançavam pela `save_cell_report(NULL, …)` passam a lançar pela `submit_cell_report`).

**Concorrência:** nenhum cenário novo de banco. Pela tela: editar e excluir com a consulta aberta, e a consulta de um relatório excluído por outra pessoa (UX-24, T12).

**Volume:** as metas de [Metas de tempo e índices](#metas-de-tempo-e-índices), com o `EXPLAIN (ANALYZE, BUFFERS)` anexado ao PR, no gerador de volume do E1.08 e do E2.06 (com o retrato do E2.11), uma célula com 400 relatórios e um relatório com 1.000 participantes. Conferir no plano:
- a etapa 2 da `cell_reports_list` usa `cell_reports_pkey`;
- sem filtros, a etapa 1 usa `cell_reports_date_id_idx` (com *incremental sort*), sem ordenar os 100 mil;
- o Líder, o G12, o Período, a Célula, o Tipo e a Reunião entram na view (*leakproof*);
- sem a busca, o plano não calcula `search_normalize` para todos os relatórios;
- as opções agrupam só o id da pessoa antes das junções.

**Vitest:** `src/lib/cell-reports/{filters,weeks,report-row,report-sheet,filter-texts}.ts` (leitura e limpeza da URL, 10 primeiros, datas invertidas, contagem de 1 a 6, chips na ordem, argumentos da RPC, `cellReportListHref`, atalho marcado, rótulo do G12, "Não houve célula" sem dados, ordem dos participantes com acentos, ações por permissão, `closeMode`).

**Playwright:** os critérios `UX-` de cada PR com a massa, mais o *smoke* de login. O relógio do servidor não é controlável: os critérios de atalho que dependem da hora (UX-04) interceptam a resposta da `server_weeks` (`page.route`) e mudam o fuso e o relógio do navegador (`timezoneId`, `Date` simulado), para provar que a tela segue o servidor.

### Implementação do PR 1 (2026-11-27)
Migrations `20261204100000_e212_01_report_list.sql` e `20261204100100_e212_02_save_report_edit_only.sql`, na `mci-connect` (branch `claude/e212-pr1`). Tarefa 1: os nomes do desenho batem com o que o E2.10 (PR 1) e o E2.11 entregaram (as 17 colunas da `cell_reports_view`, `viewer_sees_cell_people` com EXECUTE para `authenticated`, `sp_local`, `first_distinct_ids`, `cell_filter_person`, `cell_identity`, `private.report_raise` e `report_id_required`); a `cell_reports_view` vigente é a do E2.11 (`20261129100000`), igual ao `pg_get_viewdef`; a última definição da `save_cell_report` é a do `20261130100100`; no front da `main`, a única chamada (`use-cell-report-save`) manda sempre o id. Nenhuma pergunta de negócio. A [conferência em produção](#conferência-em-produção-tarefa-1) não foi rodada (a sessão não alcança o banco de produção): fica com o usuário, antes do "Deploy: banco".

Divergências do código de referência, todas sem mudar regra:
1. **Portão do E2.03.** As quatro RPCs chamam `PERFORM public.viewer_member_id()` antes de tudo (como as do E2.10), para responder com o código do portão mesmo sem linha a ler. Por isso as duas de seletor são `plpgsql` (`RETURN QUERY`, `#variable_conflict use_column`). `server_weeks` (só relógio) entrou na lista fechada do `e203_06_gate`, com a justificativa no spec do E2.03.
2. **Seletores:** `_person` nulo devolve vazio nas duas; a `cell_report_filter_options` aplica à `_search` a normalização da lista (os 5 primeiros padrões não vazios, como no E2.10); a `cell_report_filter_names` devolve na ordem dos ids recebidos.
3. **Página vazia:** a `cell_reports_list` devolve vazio cedo quando a etapa 1 não acha ids.
4. **Migration 2:** a recusa `report_id_required` vem depois de quem chama e do portão, na mesma ordem da `submit_cell_report`, e não como o primeiro passo.
5. **Pós-condições** conferem também a ordem das quatro colunas novas e as `reloptions` da view, e, na migration 2, que o corpo cita `report_id_required` e não cita a `submit_cell_report`. A guarda da migration 1 confere também `viewer_member_id()`; a da 2, `private.report_raise`.
6. **Plano sem filtros:** com o `JOIN` da célula na view, o planejador lê os relatórios com *hash join* e *top-N heapsort*, e não pelo `cell_reports_date_id_idx` (que entra com o Período). A meta é atendida com folga (39 ms com 81 mil relatórios); o volume registra o plano.
7. **Testes antigos ajustados:** as posições de coluna da `cell_reports_view` (`e108_pr2`, `e201_01`, `e205_01`, `e211_01`); `e206_01` (as duas funções de seletor leem `private.member_hierarchy.g12_level`); `e203_06_gate` (lista fechada); `e205_03`, `e205_04`, `e211_03`, `e205_concurrency.sh` e o E2E `autoria-tela` (UX-04) lançam pela `submit_cell_report`, e o `e211_03` passa a esperar `report_id_required` da `save_cell_report(NULL, …)`.

Testes novos: pgTAP `e212_01_list` (110 asserções, a massa do Negócio: estrutura, paridade das 9 personas, filtros, DA-1 a DA-3, injeção, seletores, `server_weeks` em UTC e Asia/Tokyo, RN-18 por persona e semana, consulta e participantes, 60 relatórios na mesma hora, migration 2 e o líder registrado excluído); `supabase/tests/concurrency/e212_migrations.sh` (idempotência com as duas views iguais, guardas e pós-condições); `supabase/tests/volume/e212_volume.psql` (metas e planos).

Volume (20 mil membros, 1.501 células, 81 mil relatórios, 650 mil participações, célula com 400 relatórios, relatório com 1.008 participantes; mediana de 5): Administrador sem filtros 39 / 25 ms (página / total), busca "fe" 321 / 301 ms, G12 24 / 18 ms, Esta semana 6 / 2 ms, Célula 9 / 2 ms, combinação da RN-02 10 / 2 ms, opções 35 a 48 ms, nomes 4 ms, consulta por id 3 ms, participantes do relatório grande 6 ms, `server_weeks` 0,1 ms; G12 (37 mil relatórios visíveis) 202 / 52 ms e opções 78 a 93 ms. Todas dentro das metas. A etapa 2 usa `cell_reports_pkey`; Líder, G12, Período, Célula, Tipo e Reunião entram na view; sem a busca, nem `search_normalize` nem `viewer_sees_cell_people` são calculados.

Resultados (stack local `mci-e104-be`, depois de `db reset` com todas as migrations, mci-connect `c00cf47`): pgTAP 70 arquivos / 5.904 asserções, todos passando; `e212_migrations.sh` 5/5; `e205_concurrency.sh` e `e211_concurrency.sh` passando; Vitest 182 arquivos / 2.638 testes; `tsc` sem erro; build ok; lint com os 11 problemas antigos da `main` (3 erros, 8 avisos), nenhum novo. Playwright inteiro (`--workers=1`): 515 passaram, 8 pulados e 4 falharam: duas falhas conhecidas (UX-19 de `excluidos-membros` e o axe da `sign-in`) e duas intermitentes (UX-24 de `celulas-relatorios-escopo`, já conhecida, e UX-14 de `membro-validacoes-cadastro`), que passaram na nova rodada das duas specs (61/61). Concorrência: nenhum cenário novo (o passo só lê, menos a migration 2).

### Implementação dos PRs 2 e 3 (2026-11-27)
Juntos num PR só (branch `claude/e212-pr2`, mci-connect `61d26b9`): os dois são de front, sem banco entre eles, e a [Implantação](#implantação) não manda publicar um antes do outro. Tarefas 5 e 8; o PR 4 (T14, DA-14) fica separado. Publicação: merge → promote (o PR 1 já está no banco).

Divergências do desenho, todas sem mudar regra:
1. **Edição por cima da consulta sem entrada própria no histórico** (variante do plano B do P-LRE-29): a casca do formulário do E2.11 não aceita o pedido de fechar vindo de fora. "Editar relatório" abre o `CellReportDialog` por cima da consulta, que continua aberta atrás (UXD-10); salvar mostra os valores novos e devolve o foco a "Editar relatório". O voltar do aparelho com o formulário aberto fecha a consulta por baixo (a DA-11 fica para quando a casca aceitar o pedido de fora).
2. **O chip da Célula** é o `RecordFilterChip` do E2.10, desenhado antes dos outros chips (P93); a `cellReportFilterChips` monta só os demais (Líder, G12, De, Até, Tipo e Reunião). Tirá-lo leva o foco a "Filtros".
3. **`report` sem formato** sai na mesma limpeza dos filtros (`parseCellReportFilters`), numa atualização só da URL.
4. **Participantes**: a consulta usa o mesmo `use-cell-report-participants` do formulário de edição (mesma chave), agora com `fetchAllRows`; "Tentar de novo" da consulta relê também os participantes que falharam junto.
5. **Exclusão pela consulta** (DA-12): `useDeleteCellReport({ onDeleted })` fecha a consulta, tira o relatório das páginas no cache e as leituras dele antes do `refreshAfterReportWrite`.
6. **Esc com aviso na tela**: o toast do Radix é a camada de cima; o primeiro `Esc` depois de salvar fecha o aviso, e o segundo, a consulta (comportamento do Radix, igual em todo o sistema).
7. **Cabeçalho da lista** com `px-4` abaixo de 640 px, para os três atalhos caberem numa linha em 360 px (UX-05).
8. `ReportMeetingBadge` (`StatusBadges`) é o badge da reunião; o detalhe da célula ainda usa o dele (unificar no PR 4). Saíram `cell-filter.ts`, `use-cell-report-filter.ts`, o `CellReportSheet` antigo, `CELL_REPORT_ROW_SELECT`, `withParticipantCounts`, `cellOfReport` e os textos da consulta em `deletion/texts.ts`. O `fetchListPage` continua (Auditoria e listas de excluídos).
9. A busca continua com a espera de 300 ms do `useListSearchParams`, e a barra invertida já vai escapada pelo `toSearchPatterns` (teste novo em `filters.test.ts`).

Testes: Vitest 180 arquivos / 2.601 testes (novos: `filters`, `weeks`, `report-row`, `report-sheet`, hooks e a tela); `tsc` sem erro; build ok; lint com os 11 problemas antigos. Playwright (`--workers=1`): `relatorios-filtros` (8) e `relatorios-consulta` (6) novos, e `login`, `relatorios-filtro-celula`, `relatorio-lancamento`, `relatorios-retrato`, `relatorios-retrato-escopo`, `relatorio-celula-excluida` (reescrita para a consulta nova), `exclusao-celulas-relatorios`, `excluidos-celulas-relatorios`, `autoria-tela`, `autoria-gravacao`, `celulas-relatorios-escopo` e `celula-detalhe` passando. Revisão de código, revisão de UI (tarefas 6 e 9) e QA (tarefas 7 e 10) ficam com a sessão principal.

## Tarefas
_Seção do `architect`._

Quatro PRs no `mci-connect`. **O PR 1 começa depois dos pré-requisitos de [Ordem com os outros passos](#ordem-com-os-outros-passos) em produção, com o E2.11 inteiro.**
- Dentro do PR 1, o banco vai primeiro, e os tipos são regenerados antes do front.
- Cada desenvolvedor aciona o `code-reviewer` ao terminar a sua tarefa; esse passo não aparece na tabela.
- Na coluna RNs, os números são das regras deste spec. Na coluna UX, os dos critérios `UX-`.

| # | Responsável | Descrição | Arquivos | RNs | UX | Depende de |
|---|---|---|---|---|---|---|
| **PR 1: banco** | | | | | | |
| 1 | backend-developer | Reler as migrations finais do E2.01, do E2.02, do E2.05, do E2.06, do E2.08, do E2.09, do E2.10 e do E2.11 e confirmar os nomes usados aqui: as colunas da `cell_reports_view` da [conferência](#conferência-em-produção-tarefa-1) (a), `viewer_sees_cell_people` com EXECUTE para `authenticated`, `sp_local`, `first_distinct_ids`, `cell_filter_person`, `cell_identity`, `private.report_raise` e o código `report_id_required`. Conferir na `origin/main` que nenhuma chamada à `save_cell_report` vai sem `_report_id` e que o PR 4 do E2.11 foi promovido. Entregar o SQL da conferência para o usuário rodar e usar a saída (e) como base. Parar e voltar ao `architect` nos casos listados ali. | — | 03, 04, 06, 16 | — | os pré-requisitos do PR 1 em produção |
| 2 | backend-developer | Migration 1: guarda; `cell_reports_view` recriada da definição vigente com `cell_city`, `cell_state`, `cell_zip_code` e `cell_visible` no fim; `server_weeks`; tipo `private.cell_report_filter`, `private.cell_report_filter_people`, `private.cell_report_filter_normalize` e `private.cell_report_filter_sql`; `cell_reports_list` e `cell_reports_list_count` (*definer*); `cell_report_filter_options` e `cell_report_filter_names` (*definer*); privilégios; pós-condições. Regenerar o `types.ts`, sem mudar comportamento no front (só os tipos que o `tsc` apontar). | `supabase/migrations/<ts>_e212_01_report_list.sql`, `src/integrations/supabase/types.ts` | 01 a 14, 16, 18 | dados de 03, 04, 10, 11, 16, 20, 22, 23 | 1 |
| 3 | backend-developer | Migration 2: guarda; `save_cell_report` sem o ramo `_report_id IS NULL`, a partir da definição vigente; pós-condições. Adaptar os pgTAP do E2.05 e do E2.11 que lançam pela `save_cell_report(NULL, …)`. | `supabase/migrations/<ts>_e212_02_save_report_edit_only.sql`, `supabase/tests/database/*` (só os que lançam por ela) | — | — | 2 |
| 4 | qa | pgTAP de [Verificações](#verificações-obrigatórias-para-o-qa) e volume com `EXPLAIN` (célula com 400 relatórios, relatório com 1.000 participantes). | `supabase/tests/database/e212_*.test.sql` | 01 a 18 | — | 3 (escreve em paralelo com a 2 e a 3, a partir dos contratos) |
| **PR 2: lista, filtros e atalhos** | | | | | | |
| 5 | frontend-developer | `src/lib/cell-reports/{filters,filter-texts,weeks,report-row}.ts` com Vitest (absorve o `cell-filter.ts` do E2.10, com os testes); `use-cell-report-filters`, `use-cell-reports-list` pelas duas RPCs (sai a segunda consulta de participantes e, se ficar sem uso, o `fetchListPage`), `use-cell-report-filter-options` (opções e nomes) e `use-server-weeks`; `WeekShortcuts` (P90); `SingleChoiceFilter` com `layout="stacked"`; `SheetCloseButton` (do `CellReportSheet` do E2.01) no `FiltersSheet`, se ele usar o embutido; `CellReportFilters`, `ReportCard` e `ReportsTable` (sem o botão do P91); `CellReports.tsx` com T1 a T9 (título "Relatórios", "Buscar", "Filtros (N)", "Limpar filtros", atalhos, chips, total com `role="status"`, `Skeleton`, `Alert` com "Tentar de novo", vazios, cartões até 1279 px e tabela a partir de 1280 px, painel a partir de 1024 px). O acesso à consulta fica o de hoje (E2.01 e E2.11). | `src/lib/cell-reports/*`, `src/hooks/{use-cell-report-filters,use-cell-reports-list,use-cell-report-filter-options,use-server-weeks}.ts`, `src/components/filters/{WeekShortcuts,SingleChoiceFilter}.tsx`, `src/components/SheetCloseButton.tsx`, `src/components/cell-reports/{CellReportFilters,ReportCard,ReportsTable}.tsx`, `src/pages/CellReports.tsx`, `src/lib/list-query.ts` | 01 a 15, 18 | 01 a 18, 26 a 31 | 2 (tipos); o front listado em [Ordem com os outros passos](#ordem-com-os-outros-passos) na `main` |
| 6 | ux-designer | Revisão da UI do PR 2 (T1 a T9, P90, P93, UXD-2 a UXD-7, UXD-14, UXD-15) em 320, 360, 768, 1024, 1280 e 1440 px, nos temas claro e escuro, com zoom de 200% e fonte grande. | — | — | 01 a 18, 26 a 30 | 5 |
| 7 | qa | Vitest (`filters`, `weeks`, `report-row`, `filter-texts`); testes de componente (UX-02, 03, 04, 05, 06, 07, 08, 10, 11, 13, 17, 18, 26, 31 com rede, relógio e `matchMedia` simulados); Playwright com a massa (UX-01, 03, 04 com a `server_weeks` interceptada, 05, 08, 09, 11 com a rede inspecionada, 12, 13, 14, 15, 16, 17, 18, 27, 28 e os critérios da RN-01 à RN-15 e da RN-18 pela tela); axe nos dois temas (UX-29, 30). | `src/**/*.test.ts(x)`, `e2e/relatorios-filtros.spec.ts` | 01 a 15, 18 | 01 a 18, 26 a 31 | 5 |
| **PR 3: consulta "Ver relatório"** | | | | | | |
| 8 | frontend-developer | `src/lib/cell-reports/report-sheet.ts` reescrito (`readReportParam`, `closeMode`, `toReportSheetView` com prévia, `reportSheetActions`) com Vitest; `use-cell-report` só com a linha por id (`CELL_REPORT_DETAIL_SELECT`), `use-cell-report-participants` em paralelo, `use-cell-report-list-preview` e `use-cell-report-sheet` (URL, histórico, entrada da edição, foco); `RecordSheet` (P92) e `NameList` (P94); `CellReportSheet` movido para `src/components/cell-reports/` e reescrito (T10 a T13, com `RecordAuthorship` e "Ver histórico"); o botão do P91 em `ReportCard` e `ReportsTable` (sai o ícone `Eye`); "Editar relatório" com o `CellReportDialog` por cima (AQ-9, ou o plano B do P-LRE-29, registrado no PR); exclusão pela consulta com a ordem de [Depois de gravar](#depois-de-gravar); textos da consulta para `src/lib/cell-reports/texts.ts`. | `src/lib/cell-reports/{report-sheet,texts,fields}.ts`, `src/lib/deletion/texts.ts`, `src/hooks/{use-cell-report,use-cell-report-participants,use-cell-report-list-preview,use-cell-report-sheet}.ts`, `src/components/{RecordSheet,NameList}.tsx`, `src/components/cell-reports/{CellReportSheet,ReportCard,ReportsTable}.tsx` e as seções da consulta, `src/pages/CellReports.tsx` | 15, 16, 17 | 19 a 25, 27 a 31 | 5 (mesmos arquivos); os arquivos novos podem começar junto com a 5; front do E2.05 (`RecordAuthorship`) na `main` |
| 9 | ux-designer | Revisão da UI do PR 3 (T10 a T13, P91, P92, P94, UXD-7 a UXD-13) em 320, 360, 768, 1024, 1280 e 1440 px, nos temas claro e escuro, com zoom de 200% e fonte grande. | — | — | 19 a 25, 27 a 30 | 8 |
| 10 | qa | Vitest (`report-sheet`); testes de componente (UX-19, 20, 21, 25, 31 com respostas simuladas, inclusive a falha só dos participantes); Playwright com a massa (UX-19, 20, 21, 22, 23 com a rede inspecionada para Pedro e Hugo, 24, 27, 28; o voltar do aparelho com o formulário aberto, com e sem mudança; editar e excluir com a consulta aberta; e os critérios da RN-16 e da RN-17 pela tela); axe nos dois temas (UX-29, 30). | `src/**/*.test.ts(x)`, `e2e/relatorios-consulta.spec.ts` | 15, 16, 17 | 19 a 25, 27 a 31 | 8 |
| **PR 4: consulta no detalhe da célula (opcional, DA-14)** | | | | | | |
| 11 | frontend-developer | T14: no detalhe da célula (E2.10), o cabeçalho de cada um dos "Últimos relatórios" vira o botão do P91 e abre o `CellReportSheet` com `?report=` em `/cells/:id`, sem "Ver célula"; o `use-cell-report-sheet` funciona nessa rota; o "Ver todos os relatórios" passa a usar o `cellReportListHref`. | `src/pages/CellDetail.tsx`, `src/components/cells/detail/CellRecentReports.tsx`, `src/components/cell-reports/CellReportSheet.tsx`, `src/hooks/use-cell-report-sheet.ts` | 16 | 19, 21, 22 (no detalhe) | 8; PR 5 do E2.10 na `main` |
| 12 | ux-designer | Revisão da UI do PR 4 (T14) em 360, 768 e 1280 px. | — | — | 19, 21, 22 | 11 |
| 13 | qa | Testes de componente e Playwright da T14 (abrir, fechar com o voltar, Lia sem o detalhe). | `src/**/*.test.tsx`, `e2e/celula-detalhe-consulta.spec.ts` | 16 | 19, 21, 22 | 11 |
| **Fechamento** | | | | | | |
| 14 | architect | Revisão final dos PRs. Atualizar o `CLAUDE.md` ([Mudanças nos documentos](#dependências-e-impactos-em-outros-passos)). O aceite, a matriz e o `docs/migracao.md` são do `product-owner`. | `CLAUDE.md` | — | — | 4, 7, 10 (e 13, se o PR 4 entrar) |

**Ordem de execução:**
- PR 1: 1 → 2 → 3. A 4 é escrita em paralelo com a 2 e a 3 e roda depois da 3. O PR 1 só vai para o "Deploy: banco" com a 4 aprovada (metas e paridade).
- PR 2: 5 → (6 ∥ 7), depois do PR 1 mergeado (tipos). O promote exige o PR 1 no banco.
- PR 3: os arquivos novos da 8 podem começar junto com a 5; a ligação na tela espera o PR 2 mergeado. Depois, (9 ∥ 10).
- PR 4 (opcional): 11 → (12 ∥ 13), depois do PR 3 mergeado e do PR 5 do E2.10.
- 14 no fim.

**Critérios de pronto**
1. **Tarefas de banco (2 e 3):**
   - as migrations rodam num banco zerado depois das existentes e rodam de novo sem erro;
   - a `cell_reports_view` muda só pelas quatro colunas no fim; a `cell_report_participants_view` fica igual;
   - nenhuma função nova com EXECUTE para `anon`; as internas sem EXECUTE para os papéis da API; os papéis da API sem USAGE em `private`;
   - o `types.ts` está regenerado;
   - os testes do E1.08 e do E2.01 ao E2.11 continuam passando.
2. **Tarefa 2:** a guarda falha num banco sem o E2.11; nenhuma entrada passa pelo `format` (só `private.cell_report_filter_sql`, com fragmentos fixos); a paridade por persona passa.
3. **Tarefa 3:** a `save_cell_report(NULL, …)` recusa com `report_id_required`; com id, o comportamento do E2.11 não muda.
4. **Tarefa 4:** todos os critérios das RNs que dependem do banco passam, e as metas estão atendidas, com o `EXPLAIN` no PR.
5. **Tarefas 5, 8 e 11:**
   - `npm run lint`, `npm test` e `npm run build` verdes;
   - sem `any` e sem asserção de tipo (`as Tipo`) nos arquivos novos (`as const` é permitido);
   - nenhuma regra de domínio dentro de componente (fica em `src/lib/`);
   - nenhum texto do spec fora dos módulos de texto;
   - nenhuma data calculada pelo relógio do aparelho (`new Date()`, `Date.now()`) nos módulos e hooks deste passo; "hoje" e as semanas só da `server_weeks`;
   - nenhuma leitura de `cell_reports`, `members` ou `cells` direto da tabela; nenhuma chamada à `member_names` no Líder e no G12;
   - nenhum `select("*")` na `cell_reports_view` e nenhuma leitura dela com `cell_visible`, `participants_count` ou `search_text` sem filtrar por id (risco 8).
6. **Tarefa 5:**
   - a URL é limpa na primeira leitura, com `replace`; mudar filtro ou tocar num atalho não cria entrada no histórico;
   - com o link do critério da RN-07 (Pedro, Líder: Débora), nem o nome nem o id de Débora aparecem no DOM ou nas respostas;
   - o hook da lista não chama `.order()`;
   - Membros e Células ficam iguais (os testes de lá passam sem mudança).
7. **Tarefa 8:**
   - abrir pela linha cria uma entrada no histórico, e o voltar fecha a consulta;
   - `report=xyz` não faz nenhuma requisição; R8, R3 e um id inexistente dão o mesmo DOM, sem nenhum dado do relatório no DOM ou nas respostas;
   - excluir pela consulta nunca mostra o relatório excluído na lista, nem por um instante;
   - o texto "Close" não aparece no DOM da consulta nem do painel de filtros.
8. **Tarefas 6, 9 e 12:** o `ux-designer` dá o veredito e lista os ajustes, que voltam ao `frontend-developer` antes de o QA fechar o PR. Na 9, ele confirma o comportamento do voltar com o formulário aberto (DA-11) ou aceita o plano B.

## Testes
_Seção do `qa`._

| RN | Testes | Resultado |
|---|---|---|
| 01 a 14, 16, 18, DA-1 a DA-10 | `supabase/tests/database/e212_01_list.test.sql` (desenvolvedor, 110) | passa |
| 01, 02, 05 a 11, 13, 16 (paridade com filtros, 9 personas, WHERE a mão sobre a `cell_reports_view`; `cell_visible` = `cells_view`; opções = nomes da view) | `e212_02_qa.test.sql` seções 1 e 6 | passa |
| 03, 04, 05, 08, 16 (relatório excluído, célula inativa, célula excluída, retrato x célula atual) | `e212_02_qa.test.sql` seções 4 a 6 | passa |
| 13, DA-1 (130 empates, filtros, teto de 100, opções de Hugo e Ester) | `e212_02_qa.test.sql` seção 2 | passa |
| 10, 18 (`server_weeks` x `dashboard_summary(_at)`, virada de semana e de ano, bissexto, fusos de sessão) | `e212_02_qa.test.sql` seção 3 | passa |
| DA-1 a DA-3, risco 1 (nulos, vazios, extremos, 20 mil curingas) | `e212_02_qa.test.sql` seção 7 | passa |
| DT-10 (`save_cell_report` sem id e com id sem mudança), portão do E2.03, anon e `service_role` | `e212_02_qa.test.sql` seções 8 e 9 | passa |
| Entradas pela API (PostgREST + JWT local), 35 casos | `supabase/tests/concurrency/e212_api_inputs.sh` | 35/35 |
| Migrations (idempotência, guardas, pós-condições) | `supabase/tests/concurrency/e212_migrations.sh` | 5/5 |

PR 1 (QA, `claude/e212-pr1`): pgTAP inteiro por `psql` na pista A, 71 arquivos, 5.989 asserções, 0 falhas (`e212_02_qa` 95). Sem bug aberto.
