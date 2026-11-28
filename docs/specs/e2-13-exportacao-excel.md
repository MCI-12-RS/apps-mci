# E2.13: Exportação dos relatórios para Excel

> Status: Negócio e Experiência (UX) prontos.
> - Negócio escrito em 2026-11-24 pelo `product-owner`, sem regras "a confirmar". Revisto no mesmo dia com as decisões do PO sobre as pendências da UX.
> - Experiência (UX) escrita em 2026-11-24 pelo `ux-designer`: telas T1 a T12, padrões P120 a P123 e critérios UX-01 a UX-20. As pendências PO-UX-1 a PO-UX-10 foram resolvidas pelo PO no mesmo dia e viraram os padrões P-EXP-23 a P-EXP-32. As perguntas AQ-1 a AQ-10 são do `architect`.
> - Ficam para o usuário revisar no PR os padrões P-EXP-01 a P-EXP-32 e as perguntas Q-1 a Q-8. Nenhuma bloqueia: cada uma já tem um padrão adotado.
> - Depende do E2.01, do E2.02, do E2.05, do E2.06, do E2.08, do E2.09, do E2.11 (retrato do relatório) e do E2.12 (filtros da lista de Relatórios). Entra depois do E2.12.
> - Faltam Solução técnica, Tarefas e Testes. Revisto em 2026-11-28 com o E2.12 entregue: Q-1, Q-2, Q-4 e Q-7 precisam de resposta do usuário antes da Solução técnica ([Revisão de 2026-11-28](#revisão-de-2026-11-28-e212-entregue)).
>
> Slug: `e2-13-exportacao-excel` · Paridade com o legado: sim (REL-14). Regras novas:
> - permissão própria para exportar;
> - período obrigatório, em semanas completas, até 13 semanas, com uma linha por célula em cada semana;
> - só entram as células sem relatório nas semanas que contam para elas (E2.09), e a semana atual tem "Ainda não ocorreu";
> - colunas "Semana" e "Célula excluída", e a aba "Informações";
> - número da célula para as células cadastradas no novo;
> - evento na Auditoria a cada planilha entregue.

## Negócio
_Seção do `product-owner`. Escrita em 2026-11-24 e atualizada no mesmo dia com as decisões do PO sobre as pendências PO-UX-1 a PO-UX-10 da seção Experiência (UX) (P-EXP-23 a P-EXP-32). Fontes:_
- _no [`docs/migracao.md`](../migracao.md): a linha do E2.13 na seção Progresso, as regras REL-09, REL-11 a REL-14 (3.5), DEL-02, DEL-03 e DEL-07 (3.8), e as seções 5.5, 5.6 e 6.5;_
- _no `CLAUDE.md` da raiz: a exportação do legado (`/api/export/cell-reports`, `ColumnFormatter.cs`), os papéis do legado e a matriz de paridade;_
- _no legado:_
  - _`API/Controllers/ExportController.cs`, `App/Services/ExportService.cs`, `App/Services/ColumnFormatter.cs`, `App/Services/ExcelService.cs` e `G12App.Application.Tests/ColumnFormatterTests.cs`;_
  - _`Infra/Repositories/CellRepository.cs` (`GetCellsReports`), `Infra/Repositories/ReportRepository.cs`, `Domain/Querying/Filters/ReportFilter.cs`, `Domain/Extensions/QueryingExtensions.cs` e `Domain/Extensions/StringExtensions.cs`;_
  - _`UI/pages/Report/index.js`, `UI/services/Report.service.js`, `UI/components/Grid/index.js`, `UI/components/NavMenu/index.js`, `UI/AppRoutes.js` e `UI/pages/Cells/index.js`;_
- _no novo (`mci-connect`, `origin/main`, `4595daa`): não há exportação nenhuma (nem código, nem dependência de planilha), e a lista de Relatórios tem só a busca;_
- _nos specs:_
  - _[E1.08](e1-08-paginacao-servidor.md): RN-06, RN-11 e o volume de referência;_
  - _[E2.01](e2-01-exclusao-logica.md): RN-08, RN-11, RN-13 e Impactos (E2.13);_
  - _[E2.02](e2-02-perfis-escopo.md): RN-02 a RN-04, RN-08, RN-22, RN-23, os rótulos da RN-22 e Impactos (E2.13);_
  - _[E2.05](e2-05-auditoria-autor.md): RN-02, RN-03, RN-14 e RN-16 a RN-20;_
  - _[E2.06](e2-06-hierarquia-totais.md): RN-11 e "Definições para os passos seguintes";_
  - _[E2.08](e2-08-cadastro-celulas.md): RN-09 e RN-11;_
  - _[E2.09](e2-09-situacao-relatorio.md): Termos, RN-02 a RN-08, P-SIT-12 e Fora de escopo (a situação da exportação é por período);_
  - _[E2.10](e2-10-listagem-celulas.md): Termos, RN-05, a massa de exemplo e Fora de escopo ("Célula #" fica para cá);_
  - _o Negócio do [E2.11](e2-11-lancamento-relatorio.md), ainda sem commit e só lido: RN-04, RN-09, RN-11, RN-13, RN-14, RN-21 e Impactos (E2.13);_
  - _o Negócio do [E2.12](e2-12-listagem-relatorios.md), ainda sem commit e só lido: Termos, RN-01 a RN-12, RN-15, RN-16, RN-18, P-LRE-04, P-LRE-21, P-LRE-34, a massa de exemplo e Impactos (E2.13)._

Os caminhos do legado são relativos a `g12app-net/`, com as abreviações do E2.01:
- `App/` = `G12App.Application/`;
- `Domain/` = `G12App.Domain/`;
- `Infra/` = `G12App.Infrastructure.Data/`;
- `API/` = `G12App.API/`;
- `UI/` = `G12App.API/ClientApp/src/`.

### Contexto e objetivo
No legado, a tela "Relatórios" tem, acima da lista, o link "Baixar relatórios", com o ícone do Excel (`UI/components/Grid/index.js:37-41`). Ele aparece quando a lista tem pelo menos um registro e baixa o arquivo `Relatorios.xlsx` (`UI/services/Report.service.js:61-91`), com os mesmos filtros da tela: "Desde", "Até" e a célula, quando a lista veio do "Ver relatórios" de uma célula (`UI/pages/Report/index.js:121-127` e `:142-144`).

A planilha (`App/Services/ExportService.cs`, `ColumnFormatter.cs` e `ExcelService.cs`):
- tem uma aba, "Relatórios", com a primeira linha em negrito e fundo cinza, e as colunas ajustadas ao conteúdo;
- tem **uma linha por célula** não excluída do escopo de quem exporta, inclusive as que não têm relatório no período (`Infra/Repositories/CellRepository.cs:128-147`);
- agrupa as linhas pelo G12 do líder atual da célula, ou pelo próprio líder quando ele não tem G12 calculado (`ExportService.cs:40`);
- tem as colunas Célula #, G12, Líder, Endereço, Bairro, Situação, "Data / Hora", Oferta, "Numero Participantes", "Numero Visitantes / Novos" e Observações. As colunas Timóteo e Anfitrião existem no código, comentadas (`ColumnFormatter.cs:17-18`).

Cada linha usa o último relatório da célula no período, entre os relatórios do escopo:
- **Situação:** "Relatório não entregue." sem relatório, "Não houve célula." ou "Célula realizada.";
- **Data / Hora:** texto `dd/MM/yyyy HH:mm`, só na célula realizada;
- **Oferta:** texto em reais ("R$ 123,45"), também em "Não houve célula";
- **números de participantes e de visitantes:** os gravados no relatório;
- **Observações:** as observações, ou a justificativa de "Não houve célula";
- **nomes:** só o primeiro e o último nome (`Domain/Extensions/StringExtensions.cs:7-14`);
- **G12:** o G12 do líder atual da célula. Quando ele não tem G12 calculado (é o G12, é pastor ou está sem liderança), aparece o nome do próprio líder (`ColumnFormatter.cs:15`).

Num período de mais de uma semana, a linha mostra um relatório só, o último da célula no período.

**Quem exporta:** a API aceita qualquer usuário autenticado, no escopo dele (`API/Controllers/ExportController.cs:14-27`). A tela de Relatórios e os atalhos de semana ficam no menu de quem era administrador (`UI/components/NavMenu/index.js:55-84`). O membro comum não tinha Relatórios no menu (`:86-93`) e só chegava à lista, e ao link, pelo "Ver relatórios" de uma célula. Não há registro de quem exportou.

Hoje o novo (conferido na `origin/main` do `mci-connect`, `4595daa`, em 2026-11-24) não tem exportação. A matriz de paridade marca a linha como ❌. O E2.12 (Negócio pronto) dá à lista de Relatórios os filtros Líder, G12, Período, Tipo, Reunião e Célula, os atalhos de semana e o retrato do relatório. Ele recomenda que a exportação use os mesmos filtros.

Objetivo do passo:
- dar à lista de Relatórios a exportação para Excel do legado, com uma linha por célula, inclusive as que não enviaram relatório, agrupada por G12;
- definir quem exporta, o período, as linhas, as colunas, a ordem e o arquivo, para uma semana e para várias;
- usar os filtros aplicados na lista, sem mostrar nada além do que a pessoa já vê;
- registrar na Auditoria cada planilha entregue, porque os dados saem do sistema.

### Termos
- **Exportar:** gerar e baixar a planilha. **Planilha:** o arquivo `.xlsx` gerado.
- **Semana:** de domingo, 00:00, a sábado, 23:59:59, no horário de Brasília (`America/Sao_Paulo`), como no E2.09. **Semana atual:** a do momento da exportação, segundo o servidor. O relógio e o fuso do aparelho não contam.
- **Semanas da exportação:** as semanas completas que a planilha cobre (RN-03).
- **Linha:** uma célula numa semana da exportação (RN-04).
- **Relatório visível** e **retrato do relatório:** como nos Termos do E2.12. O retrato são o líder, o timóteo, o anfitrião e o tipo registrados no envio (REL-09).
- **Célula visível:** a célula não excluída que a pessoa vê (RN-02 e RN-03 do E2.02), como nos Termos do E2.10.
- **G12:** o G12 atual de um líder, conforme a RN-11 do E2.06. Quando o líder é G12, é ele mesmo; quando é pastor, "Pastores"; quando está sem liderança, "—".
- **Prazo** e **semana que conta:** como no E2.09. O prazo é 1 hora depois do horário da reunião (RN-02 de lá). A semana conta para a célula quando, no prazo da reunião daquela semana, ela já estava cadastrada, ativa e não excluída (RN-06 de lá).
- **Número da célula:** o número que identifica a célula na planilha, na coluna "Célula #" (RN-14).
- **Filtros aplicados:** os filtros e a busca que valem na lista de Relatórios no momento da exportação (RN-02 do E2.12).

### Personas e permissões
Os nomes entre aspas são os rótulos da tela de Funções (RN-22 do E2.02). As pessoas são as da [massa de exemplo](#massa-de-exemplo).

| Persona | Quem é (na massa) | Permissões relevantes | O que exercita |
|---|---|---|---|
| IG Igreja toda | Rita, função Administrador | todas, inclusive "Exportar Relatórios de Células" e "Visualizar Auditoria" | a planilha da igreja toda; vê os eventos de exportação |
| PA Pastor | Samuel, função Líder | "Visualizar Seu Ministério" e "Exportar Relatórios de Células" | a árvore inteira, menos quem está sem liderança; célula de pastor |
| G12 | Pedro, função Líder | as mesmas de Samuel | a planilha do ministério, o casal, os filtros |
| OM Outro ministério | Diego, função Líder | as mesmas de Samuel | o que fica fora do escopo |
| PC Pessoa da célula | Caio, função Membro | "Visualizar Seu Ministério" e "Enviar Relatório das Próprias Células" | tem a lista de Relatórios, mas não exporta |
| SF Sem função | Hugo | nenhuma | não tem a lista nem exporta |
| SR Só relatórios | Lia, função Secretaria | "Visualizar Relatórios de Toda a Igreja"; nos critérios marcados, também "Exportar Relatórios de Células" | linhas só de relatórios, sem as células sem relatório |
| SI Sistema | o servidor | — | calcula as linhas, grava o evento e dá o número da célula |

### Histórias
- Como liderança, quero baixar a planilha da semana com todas as células do meu ministério, inclusive as que não enviaram relatório, para acompanhar os líderes na reunião de liderança.
- Como pastor, quero a planilha agrupada por G12, para entregar a cada G12 a parte do ministério dele.
- Como secretaria, quero a planilha de várias semanas, com uma linha por célula em cada semana, para somar ofertas, participantes e visitantes.
- Como G12, quero exportar com os mesmos filtros que apliquei na lista, para não refazer o filtro na planilha.
- Como igreja, quero saber quem exportou os relatórios e quando, porque os dados saem do sistema.

### Decisões

#### Decisões do usuário e de passos anteriores
| Decisão | O que vale aqui | Onde |
|---|---|---|
| D1 (2026-11-14), DEL-02, DEL-03 e DEL-07; RN-08, RN-11 e RN-13 do E2.01 | Excluídos não aparecem. Os relatórios de célula excluída continuam e entram nas somas. O participante excluído conta. O relatório excluído não conta e libera a semana. | RN-04, RN-06 |
| Impactos (E2.13) do E2.01 | Recomendação do PO: a célula excluída entra com a indicação "Célula excluída", só nos períodos em que tem relatório. | RN-04, RN-06 |
| RN-02 a RN-04, RN-08, RN-22 e RN-23 do E2.02; Impactos (E2.13) | Escopo de células e de relatórios, que vale na hora; quem tem a lista de Relatórios; rótulos da tela de Funções; ninguém descobre a cadeia de quem não vê; "a exportação respeita o escopo, como no legado". | RN-01, RN-10 |
| RN-02, RN-14 e RN-16 a RN-20 do E2.05 | Autor; tudo ou nada; Auditoria gravada só pelo servidor, com prazos de guarda e legível. | RN-11 |
| RN-11 e "Definições" do E2.06 | O G12 com "Pastores" e "—", um nome só, que acompanha a árvore na hora. | RN-06, RN-08 |
| RN-09 e RN-11 do E2.08 | O endereço da célula não é dado sensível. A célula inativa não recebe relatório novo, e os relatórios dela continuam. | RN-04, RN-10 |
| Termos, RN-02 a RN-07 e P-SIT-12 do E2.09 | Semana, prazo, relatório da semana, situação da semana, semanas que contam e célula sem dia da reunião. O "Enviado" aparece também para quem não vê o relatório. A situação da exportação é por período e não é a do E2.09. | RN-04, RN-05, RN-12 |
| RN-05 e Fora de escopo do E2.10 | O G12 da célula, pelos valores atuais. O "Célula #" do legado ficou para este passo. | RN-06, RN-14 |
| RN-04, RN-09, RN-11, RN-13, RN-14, RN-21 e Impactos (E2.13) do E2.11 | Sem relatório atrasado; o retrato; "Não houve célula" sem dados; participantes automáticos; a oferta é de quem vê o relatório. Recomendação do PO no E2.11: ordenar pelo líder atual, como o legado (não seguida; ver P-EXP-10). | RN-05, RN-06, RN-10 |
| RN-01 a RN-12, RN-15, RN-16, RN-18, P-LRE-04, P-LRE-21, P-LRE-34 e Impactos (E2.13) do E2.12 | Os filtros, os atalhos e quando um filtro vale; o retrato na lista; o que a linha mostra; o G12 por pessoa; "Não houve célula" do legado sem dados; os equivalentes do Dashboard; a recomendação de usar os mesmos filtros. | RN-02, RN-06, RN-07, RN-12 |
| RN-06 e RN-11 do E1.08; volume de referência | Nomes de referência; dados sensíveis; 20 mil membros, 1.500 células e 100 mil relatórios. | RN-10, RN-13 |
| 5.5, 5.6 e 6.5 do `docs/migracao.md` | O `Id` da célula do legado vai para `legacy_id`; a reconciliação; `AppAdmin` vira Líder e `AppUser` vira Membro. | RN-01, RN-14, RN-15 |

#### Padrões definidos por este spec (revisar no PR)
As fontes não respondem estes pontos, ou o legado não os define com precisão. O PO adotou a opção mais conservadora e coerente com o legado e com os specs anteriores. Nas regras, eles aparecem como "definida pelo spec", e o usuário pode mudar qualquer um na revisão do PR.

- **P-EXP-01, permissão própria** (RN-01).
  - Exporta quem tem a permissão nova "Exportar Relatórios de Células", além da lista de Relatórios. A função Administrador a tem, porque tem todas. A função Líder a recebe. A função Membro não a recebe.
  - Motivos:
    - os dados saem do sistema, e a planilha junta o ministério inteiro num arquivo só;
    - no legado, a tela de Relatórios e os atalhos de semana ficavam só no menu de quem era administrador. Na carga, `AppAdmin` vira Líder (6.5), então os administradores do legado continuam exportando.
  - A alternativa é seguir a API do legado: todos que têm a lista de Relatórios exportam (Q-1).
- **P-EXP-02, ação na lista de Relatórios, com os filtros aplicados** (RN-02).
  - A ação fica na lista de Relatórios, como no legado, e usa os filtros aplicados, como recomenda o E2.12.
  - Ela continua disponível com a lista vazia, porque a planilha traz as células sem relatório. No legado, o link só aparecia com registros na lista.
- **P-EXP-03, período obrigatório** (RN-03). No legado, dava para exportar sem período. No novo, com uma linha por semana, sem período a planilha teria todas as semanas desde sempre. Os atalhos de semana preenchem o período com um toque.
- **P-EXP-04, semanas completas** (RN-03).
  - A planilha cobre as semanas inteiras que o Período toca, de domingo a sábado.
  - Assim, "Relatório não enviado" nunca aparece para uma célula que enviou o relatório num dia da semana fora do Período.
  - A tela diz as semanas antes de gerar.
- **P-EXP-05, até a semana atual e no máximo 13 semanas** (RN-03).
  - Semanas futuras não têm o que mostrar.
  - 13 semanas são um trimestre: no volume de referência, até 19.500 linhas para quem vê a igreja toda.
  - Ver Q-3.
- **P-EXP-06, uma linha por célula em cada semana** (RN-04).
  - Com uma semana, a planilha tem uma linha por célula, como no legado.
  - Com várias, cada semana tem as linhas dela, e nenhum relatório fica de fora. No legado, a linha mostrava só o último relatório da célula no período.
  - A coluna "Semana" diz a semana de cada linha.
  - A alternativa é aceitar só uma semana por planilha (Q-2).
- **P-EXP-07, quais células sem relatório entram** (RN-04).
  - Na semana atual, as que estão "Ainda não ocorreu" ou "Pendente" na lista de Células (E2.09). Numa semana passada, as que tinham a semana contando (RN-06 do E2.09).
  - A célula cadastrada depois da semana, a inativa e a excluída não aparecem como "Relatório não enviado". No legado, a planilha listava as células atuais do escopo em qualquer período.
- **P-EXP-08, valores da Situação** (RN-05).
  - São "Célula realizada", "Não houve célula", "Relatório não enviado" e, só na semana atual, "Ainda não ocorreu". Não têm ponto final.
  - "Não enviado" no lugar de "não entregue", porque o vocabulário do novo é "Enviado" (Textos de tela do E2.09).
  - "Ainda não ocorreu" separa a célula que ainda vai se reunir da que já passou do prazo, como na lista de Células.
  - A alternativa é usar os três textos do legado, como estão (Q-4).
- **P-EXP-09, relatório que quem exporta não vê** (RN-04, RN-05, RN-10).
  - A célula visível com um relatório na semana que a pessoa não vê aparece com a Situação dele ("Célula realizada" ou "Não houve célula"), sem nenhum dado dele, como na lista de Células (P-SIT-12 do E2.09).
  - Assim, ela não aparece como "Relatório não enviado", o que seria falso.
- **P-EXP-10, Líder e G12 pelo retrato** (RN-06).
  - Na linha de um relatório visível, o Líder é o líder registrado, e o G12 é o G12 atual dele, como na lista de Relatórios (RN-15 do E2.12), de onde a exportação é pedida. Nas outras linhas, valem o líder e o G12 atuais da célula, como na lista de Células.
  - O E2.11 recomendou seguir o legado (o líder atual da célula) para a planilha bater na homologação. Este spec não segue, por dois motivos:
    - para quem só vê relatórios, ou para a célula que mudou de ministério, o líder atual e o G12 dele podem ser de alguém que a pessoa não vê (RN-23 do E2.02);
    - a diferença só aparece quando a célula trocou de líder depois do relatório, o que entra na lista de diferenças esperadas da homologação.
  - Ver Q-7.
- **P-EXP-11, nomes completos, "Pastores" e "—"** (RN-06).
  - Os nomes vêm completos, como nas telas do novo, e não só o primeiro e o último nome, como no legado.
  - O G12 segue a RN-11 do E2.06: "Pastores" e "—" no lugar do nome do próprio líder, como na lista de Relatórios.
- **P-EXP-12, colunas "Semana" e "Célula excluída"** (RN-06).
  - "Semana" é necessária com várias semanas (P-EXP-06) e fica também com uma, para a planilha guardada dizer de que semana é.
  - "Célula excluída" atende à recomendação do E2.01 sem misturar a indicação com o endereço ou com a Situação.
  - As outras 11 colunas são as do legado, na mesma ordem.
- **P-EXP-13, "Não houve célula" sem números** (RN-06).
  - Na linha de "Não houve célula", ficam vazios a Data/Hora (como no legado), a Oferta e os números de participantes e de visitantes, mesmo que o relatório tenha vindo do legado com esses dados. É o que a lista e a consulta do E2.12 fazem (P-LRE-34).
  - O motivo aparece em Observações, como a justificativa no legado.
- **P-EXP-14, valores de planilha** (RN-09).
  - A Data/Hora é uma data do Excel, e a Oferta é um número com formato de reais. O número da célula e os números de participantes e de visitantes também são números. No legado, a data e a oferta eram texto.
  - Assim, dá para somar, ordenar e filtrar na planilha. A aparência continua a do legado ("18/11/2026 20:00", "R$ 50,00").
- **P-EXP-15, ordem** (RN-08).
  - Pela semana, da mais antiga para a mais recente. Dentro da semana, pelo G12, com "Pastores" primeiro e "—" por último; depois pelo líder e pelo número da célula.
  - O legado agrupava pelo G12, sem ordem alfabética.
- **P-EXP-16, arquivo** (RN-09).
  - O arquivo é `.xlsx`, como no legado, e não há CSV: o CSV abre com acentos e números trocados no Excel em português.
  - O nome traz as semanas.
  - A aba "Informações" diz o período, os filtros, quem gerou e quando. Sem ela, uma planilha filtrada não se distingue de uma completa, e a Situação da semana atual depende do momento em que foi gerada.
- **P-EXP-17, evento na Auditoria** (RN-11).
  - Cada planilha entregue gera um evento, com as semanas, os filtros e o número de linhas, sem o conteúdo.
  - Tudo ou nada, como as alterações no E2.05 (RN-14): sem evento, não há planilha.
  - O evento é guardado por 2 anos, o prazo de "os demais" eventos (RN-17 do E2.05).
  - O legado não registrava.
- **P-EXP-18, tempo e planilha vazia** (RN-13).
  - Até 10 s para 13 semanas no volume de referência.
  - Sem nenhuma linha, não há arquivo nem evento.
- **P-EXP-19, número da célula** (RN-14).
  - A célula do legado mantém o número do legado. A célula cadastrada no novo recebe um número dado pelo servidor, maior que qualquer número do legado, que nunca muda e nunca é reaproveitado.
  - O número aparece só na planilha neste passo (Q-6).
- **P-EXP-20, filtros nas linhas sem relatório** (RN-07). Cada filtro vale para a linha pelos mesmos dados que a linha mostra: o retrato, nas linhas de relatório visível, e os dados atuais da célula, nas outras.
- **P-EXP-21, coerência com as listas** (RN-12). As linhas com dados de relatório são os relatórios da lista de Relatórios, e as linhas sem relatório da semana atual são as células "Pendente" e "Ainda não ocorreu" da lista de Células, como os equivalentes da RN-18 do E2.12.
- **P-EXP-22, homologação** (RN-15). A planilha de uma semana de referência, exportada no legado e no novo, é comparada célula a célula. As diferenças esperadas estão listadas, e qualquer outra é defeito.
- **Vindos do desenho de UX (2026-11-24, PO-UX-1 a PO-UX-10 em "Experiência (UX)"):**
  - **P-EXP-23, nome acessível da ação** (PO-UX-1, Textos de tela).
    - O nome acessível da ação é o texto visível, "Exportar para Excel". Pela WCAG 2.5.3 (rótulo no nome), o nome que o leitor de tela e o comando de voz usam precisa conter o texto que se vê, na mesma ordem.
    - O texto que o Negócio tinha para o leitor de tela ("Exportar os relatórios para Excel") sai. A explicação vai para a descrição: "Gera a planilha dos relatórios com os filtros aplicados.".
  - **P-EXP-24, a busca no aviso, na aba "Informações" e no evento** (PO-UX-2; RN-03, RN-09, RN-11).
    - A planilha segue a busca (RN-02), mas a busca não tem chip. Sem ela, uma planilha filtrada pela busca não se distinguiria de uma sem filtro.
    - Nos três lugares, a busca aparece como "Busca: “{texto}”", depois dos textos dos chips. Ela conta como filtro para "Nenhum" e "Sem filtros": com só a busca, aparece só ela.
  - **P-EXP-25, textos do aviso** (PO-UX-3, RN-03). Aceitos:
    - o título "Exportar a planilha?";
    - "Exportar planilha" no lugar de "Exportar" (verbo e objeto);
    - "Outros filtros" e "Nenhum";
    - as notas "As semanas entram inteiras, de domingo a sábado." e "As semanas que ainda não começaram não entram.". Elas explicam por que as datas da frase diferem do "De" e do "Até" aplicados.
  - **P-EXP-26, a geração não é cancelada** (PO-UX-4, RN-13).
    - Depois de "Exportar planilha", a pessoa espera a resposta, como no envio do relatório (E2.11).
    - Um "Cancelar" no meio deixaria um evento gravado sem planilha entregue (RN-11), e a pessoa acharia que nada saiu do sistema.
  - **P-EXP-27, o resultado na página, sem toast** (PO-UX-5, RN-13).
    - "Planilha exportada." fica embaixo da ação, com o nome do arquivo, o número de linhas e a dica "Se o arquivo não abriu, procure nos arquivos baixados pelo navegador.".
    - O número de linhas é o mesmo do evento.
    - O toast sumiria sozinho e, no celular, cobre o rodapé.
  - **P-EXP-28, "Baixar de novo"** (PO-UX-6; RN-11, RN-13).
    - Entrega o mesmo arquivo, guardado no aparelho, sem pedir nada ao servidor e sem gerar outro evento. Vale enquanto a pessoa fica na tela e não muda os filtros aplicados.
    - Os dados já saíram do sistema e já estão no evento. Guardar o mesmo arquivo de novo não é outra exportação.
    - Serve, por exemplo, a quem tocou em "Ver" no iPhone e depois quer guardar o arquivo.
  - **P-EXP-29, a exportação na Auditoria** (PO-UX-7, RN-11). Aceitos:
    - a entidade "Relatório", que é a que a pessoa procura. "Ação: Exportação" separa as exportações das alterações;
    - na lista, a segunda linha com os filtros: até 3, separados por "; ", e "e mais {N}", ou "Sem filtros";
    - "(1 linha)" no singular da descrição;
    - "Exportação" logo depois de "Restauração" no filtro "Ação".
  - **P-EXP-30, a permissão na tela de Funções** (PO-UX-8, RN-01).
    - Ela fica no grupo "Relatórios", logo depois das duas "Visualizar Relatórios…".
    - Quando a função não tem nenhuma permissão que dê a lista de Relatórios, a tela avisa "Para valer, a função também precisa de uma permissão que mostre Relatórios.". O aviso não impede salvar, porque a função é válida.
    - Sem o aviso, quem configura não teria como descobrir, pela tela, que a função não exporta nada.
  - **P-EXP-31, a planilha fácil de ler** (PO-UX-9, RN-09). Passam a ser regra:
    - a aba "Relatórios" ativa ao abrir;
    - a primeira linha congelada e com o filtro ligado;
    - sem células mescladas, sem linhas em branco e sem título acima dos nomes das colunas;
    - larguras com limite e quebra de linha nos textos longos;
    - a aba "Informações" em duas colunas, o rótulo e o valor.

    Não mudam o conteúdo, as colunas nem a ordem.
  - **P-EXP-32, textos da UX** (PO-UX-10). Aceitos todos os textos marcados com † em Experiência (UX) > Textos, sem ajuste. Entre eles:
    - "Ainda gerando a planilha. Isso pode levar alguns segundos.";
    - "Fechar", na recusa do servidor;
    - "Baixar de novo a planilha {arquivo}", para o leitor de tela;
    - "Baixar planilha", só se o navegador não baixar sozinho (AQ-4).

    Os que estão ligados a uma regra foram copiados para os Textos de tela. Os da T12 só valem se a pergunta correspondente for respondida com a alternativa.

### Regras de negócio
Nenhuma regra está "a confirmar".

Correspondência com o plano:
- REL-14 → RN-01 a RN-13 e RN-15;
- "Célula #" (deixado pelo E2.10) → RN-14.

| ID | Regra | Origem |
|---|---|---|
| RN-01 | **Quem exporta.**<br>- Exporta quem tem a permissão nova **"Exportar Relatórios de Células"** e a lista de Relatórios. A lista vem de uma destas permissões (RN-22 do E2.02): "Visualizar Toda a Igreja", "Visualizar Seu Ministério", "Visualizar Relatórios de Toda a Igreja", "Visualizar Relatórios do Seu Ministério" ou uma permissão de lançar.<br>- A função Administrador tem a permissão, porque tem todas. A função Líder passa a tê-la. A função Membro não a tem. As outras funções podem recebê-la na tela de Funções.<br>- A permissão não amplia o que a pessoa vê: a planilha tem só o que ela vê (RN-10).<br>- Sem a permissão ou sem a lista de Relatórios, a ação não aparece. Pela API, a exportação é recusada com "Você não tem permissão para esta ação.", sem planilha e sem evento.<br>- Tirar a permissão vale na hora (RN-08 do E2.02).<br>- O pastor e quem está sem liderança exportam como qualquer pessoa com a permissão.<br>- **Na tela de Funções,** a permissão fica no grupo "Relatórios", logo depois das duas "Visualizar Relatórios…". Quando ela está marcada e a função não tem nenhuma permissão que dê a lista de Relatórios, a tela avisa "Para valer, a função também precisa de uma permissão que mostre Relatórios.". O aviso não impede salvar e some quando uma dessas permissões é marcada. | REL-14; legado (`API/Controllers/ExportController.cs:14-27`: qualquer usuário autenticado, no escopo dele; `UI/components/NavMenu/index.js:55-84` e `:86-93`: a tela de Relatórios e os atalhos de semana só no menu de quem era administrador); RN-02, RN-08 e RN-22 do E2.02; 6.5 do `docs/migracao.md` (`AppAdmin` → Líder, `AppUser` → Membro); permissão própria: definida pelo spec (P-EXP-01); lugar e aviso na tela de Funções: definida pelo spec (P-EXP-30, PO-UX-8) |
| RN-02 | **Onde se pede e o que a exportação segue.**<br>- A lista de Relatórios ganha a ação **"Exportar para Excel"**, à vista, para quem pode exportar (RN-01). Ela fica disponível também com a lista vazia ou com a lista carregando, porque a planilha traz as células sem relatório.<br>- O nome da ação é o mesmo para quem vê e para o leitor de tela e o comando de voz: "Exportar para Excel". A descrição para o leitor de tela é "Gera a planilha dos relatórios com os filtros aplicados.".<br>- A planilha segue os **filtros aplicados** na lista (RN-01 e RN-02 do E2.12): o Período (preenchido à mão ou por um atalho de semana), o Líder, o G12, o Tipo, a Reunião, a Célula e a busca. Uma mudança no painel que ainda não foi aplicada não conta.<br>- O Período é obrigatório (RN-03). Os outros filtros são opcionais.<br>- A página, o tamanho da página e a ordem da lista não contam: a planilha tem todas as linhas (RN-04), na ordem da RN-08.<br>- Exportar não muda a lista, os filtros nem o endereço da página. | REL-14; legado (`UI/pages/Report/index.js:121-127` e `:142-144`: a exportação manda os filtros da tela, sem paginação; `UI/components/Grid/index.js:37-41`: o link na lista); recomendação do E2.12 (Impactos: "a exportação aceite os mesmos filtros e atalhos da lista"); RN-02 do E2.12 (filtro aplicado); com a lista vazia: definida pelo spec (P-EXP-02); nome acessível: WCAG 2.5.3, definida pelo spec (P-EXP-23, PO-UX-1) |
| RN-03 | **Período e semanas da exportação.**<br>- A planilha cobre **semanas completas**, de domingo a sábado, no horário de Brasília.<br>- As semanas da exportação são as que têm pelo menos um dia no Período aplicado, até a semana atual. Exemplo: com "De" na sexta, 20/11, e "Até" na terça, 24/11, a planilha cobre as semanas de 15/11 a 21/11 e de 22/11 a 28/11, inteiras.<br>- Os atalhos de semana (RN-10 do E2.12) já são uma semana completa.<br>- **Antes de gerar**, um aviso, "Exportar a planilha?", mostra:<br>  - as semanas: "A planilha terá {N} semanas, de {dd/mm/aaaa} a {dd/mm/aaaa}, com os filtros aplicados." (com uma semana: "1 semana");<br>  - quando o Período aplicado não começa num domingo ou não termina num sábado: "As semanas entram inteiras, de domingo a sábado.";<br>  - quando o Período aplicado passa da semana atual: "As semanas que ainda não começaram não entram.";<br>  - "Outros filtros": os textos dos chips aplicados (Textos de tela do E2.12), na ordem dos chips, sem "De" e "Até", e, por último, "Busca: “{texto}”", quando há busca. Sem nenhum: "Nenhum";<br>  - "Os dados vão sair do sistema. Guarde a planilha com cuidado.";<br>  - as ações "Exportar planilha" e "Cancelar".<br>- Abrir o aviso não exporta. "Cancelar" fecha sem exportar e sem evento.<br>- **Semanas futuras:** as semanas depois da atual não entram e não contam no limite. Com "De" em 22/11 e "Até" em 12/12, a planilha cobre só a semana de 22/11 a 28/11, e o aviso diz isso.<br>- **Recusas**, sem planilha e sem evento:<br>  - sem "De" ou sem "Até" aplicados, inclusive quando a data é inválida e a lista não a aplicou (RN-09 do E2.12): "Para exportar, informe o período (De e Até) ou use um atalho de semana.";<br>  - mais de 13 semanas: "A exportação aceita até 13 semanas. Diminua o período.";<br>  - nenhuma semana do período começou: "O período escolhido ainda não começou. Escolha um período até esta semana."<br>- "Hoje" e "agora" são os do servidor, em Brasília. O relógio e o fuso do aparelho não contam. | REL-14; legado (`Domain/Extensions/QueryingExtensions.cs:377-381`: o período pela data do relatório; `UI/components/NavMenu/index.js:30-41`: os atalhos são o domingo e o sábado de uma semana); Termos do E2.09; RN-09 e RN-10 do E2.12; período obrigatório: definida pelo spec (P-EXP-03); semanas completas e aviso: definida pelo spec (P-EXP-04); até a semana atual e 13 semanas: definida pelo spec (P-EXP-05); busca no aviso: definida pelo spec (P-EXP-24, PO-UX-2); título, notas, "Outros filtros" e "Exportar planilha": definida pelo spec (P-EXP-25, PO-UX-3) |
| RN-04 | **Linhas: uma por célula em cada semana.** Para cada semana da exportação:<br>(a) **Relatório visível.** Cada relatório não excluído e visível para quem exporta (RN-03 e RN-04 do E2.12), com data na semana, é uma linha. Entra qualquer que seja a célula hoje: ativa, inativa ou excluída (RN-11 do E2.01).<br>(b) **Célula visível sem relatório visível na semana.** Cada célula visível para quem exporta (RN-02 e RN-03 do E2.02), que nunca é uma célula excluída, entra uma vez:<br>  - quando tem na semana um relatório que quem exporta não vê: com a Situação dele (RN-05 a) e sem nenhum dado dele (RN-10);<br>  - na semana atual, sem relatório: quando a situação da semana dela (RN-04 do E2.09) é "Ainda não ocorreu" ou "Pendente";<br>  - numa semana passada, sem relatório: quando a semana conta para ela (RN-06 do E2.09).<br>(c) **Não entram:**<br>  - a célula excluída sem relatório visível na semana;<br>  - a semana que não conta para a célula: cadastrada depois do prazo, ou inativa ou excluída no prazo (RN-06 do E2.09). Na semana atual, isso inclui a célula "Conta a partir da próxima semana";<br>  - a célula sem dia da reunião (RN-07 do E2.09), quando não tem relatório na semana;<br>  - o relatório excluído, que não conta (DEL-03).<br><br>Detalhes:<br>- Cada célula tem no máximo uma linha por semana, porque tem no máximo um relatório por semana (REL-03).<br>- A visibilidade é a de agora, para todas as semanas (RN-08 do E2.02).<br>- A planilha mostra a situação do momento em que é gerada. | REL-14 ("uma linha por célula no período"); legado (`Infra/Repositories/CellRepository.cs:128-147`: as células não excluídas do escopo, cada uma com os relatórios do escopo no período; `App/Services/ColumnFormatter.cs:23-33`: a linha usa o último relatório do período); RN-02, RN-03 e RN-08 do E2.02; RN-03, RN-04, RN-06 e RN-07 do E2.09; RN-08 e RN-11 do E2.01; RN-03 e RN-04 do E2.12; célula excluída com relatório: recomendação do E2.01 (Impactos); uma linha por semana: definida pelo spec (P-EXP-06); células sem relatório e semanas que contam: definida pelo spec (P-EXP-07); relatório que quem exporta não vê: definida pelo spec (P-EXP-09) |
| RN-05 | **Situação.** Toda linha tem exatamente um destes valores:<br>(a) **Célula realizada** ou **Não houve célula:** a célula tem relatório na semana, conforme o que ele registra (RN-03 do E2.09). Vale também para o relatório que quem exporta não vê.<br>(b) **Ainda não ocorreu:** só na semana atual. A célula não tem relatório, e o prazo (1 hora depois do horário da reunião, RN-02 do E2.09) ainda não tinha chegado no momento da exportação.<br>(c) **Relatório não enviado:** a célula não tem relatório, a semana conta para ela, e o prazo já passou.<br>  - Na semana atual, é a célula "Pendente" do E2.09, que ainda pode receber o relatório até sábado (RN-04 do E2.11).<br>  - Numa semana passada, a semana não recebe mais relatório.<br><br>Os textos não têm ponto final. O valor "Relatório não entregue." do legado não aparece. | REL-14; legado (`ColumnFormatter.cs:23-27`: "Relatório não entregue.", "Não houve célula." e "Célula realizada."); RN-02 a RN-04 e P-SIT-12 do E2.09; RN-04 do E2.11; textos e "Ainda não ocorreu": definida pelo spec (P-EXP-08); relatório invisível: definida pelo spec (P-EXP-09) |
| RN-06 | **Colunas.** A aba "Relatórios" tem as 13 colunas da tabela [Colunas da planilha](#colunas-da-planilha), nesta ordem, com o conteúdo e o formato de cada uma. Regras gerais:<br>- **Líder e G12:** na linha de um relatório visível, vêm do retrato: o líder registrado e o G12 atual dele, como na lista de Relatórios (RN-04 e RN-15 do E2.12). Nas outras linhas, vêm da célula, pelos valores atuais, como na lista de Células (RN-05 do E2.10). O líder registrado excluído aparece pelo nome, com o G12 que tinha na exclusão (P-LRE-21 do E2.12).<br>- **Número, endereço e bairro:** sempre os atuais da célula, porque o retrato não guarda o endereço.<br>- **Dados do relatório** (Data/Hora, Oferta, números de participantes e de visitantes, Observações): só nas linhas de relatório visível. Nas outras, ficam vazios.<br>- **"Não houve célula":** ficam vazios a Data/Hora, a Oferta e os números, mesmo que o relatório tenha vindo do legado com esses dados (P-LRE-34 do E2.12). Eles continuam gravados.<br>- **Nomes:** completos, como no cadastro e nas telas.<br>- **Célula excluída:** "Sim" na linha de uma célula excluída, que só existe pela RN-04 (a). | REL-14; legado (`ColumnFormatter.cs:14-33`; `App/Services/ExcelService.cs:22`: a aba "Relatórios"; `G12App.Application.Tests/ColumnFormatterTests.cs:50-60` e `:84-91`: os valores de cada coluna); RN-04, RN-06, RN-15 e P-LRE-34 do E2.12; RN-05 do E2.10; RN-11 do E2.06; RN-09, RN-11 e RN-14 do E2.11; RN-11 e RN-13 do E2.01; líder e G12 pelo retrato: definida pelo spec (P-EXP-10); nomes e G12: definida pelo spec (P-EXP-11); "Semana" e "Célula excluída": definida pelo spec (P-EXP-12); "Não houve célula": definida pelo spec (P-EXP-13) |
| RN-07 | **Filtros nas linhas.** Cada filtro aplicado vale como na lista de Relatórios (RN-02 a RN-12 do E2.12) e restringe as linhas pelos mesmos dados que a linha mostra (RN-06):<br>- **Linhas de relatório visível:** exatamente como na lista. Líder, G12 e Tipo pelo retrato; Reunião pelo relatório; a busca no nome do líder registrado e no tema.<br>- **Outras linhas:**<br>  - Líder: o líder atual da célula;<br>  - G12: o G12 atual da célula, com as regras da RN-06 do E2.12 ("Pastores" e "—" nunca entram);<br>  - Tipo: o tipo atual da célula;<br>  - busca: só o nome do líder atual, porque não há tema;<br>  - Reunião: com "Célula realizada" ou "Não houve célula", entram só as linhas com essa Situação, inclusive a do relatório que quem exporta não vê. As linhas "Ainda não ocorreu" e "Relatório não enviado" saem. "Todas" não restringe.<br>- **Célula:** só as linhas daquela célula.<br>- **Pessoa indisponível** e **Célula indisponível** (RN-07 e RN-08 do E2.12): não trazem nenhuma linha, como na lista.<br>- Nenhum filtro mostra uma linha que a RN-04 não traria sem ele. | REL-14; RN-02 a RN-12 do E2.12; RN-05 do E2.10; legado (`UI/pages/Report/index.js:121-127`: os filtros da tela vão para a exportação); linhas sem relatório: definida pelo spec (P-EXP-20) |
| RN-08 | **Ordem.**<br>- Pela semana, da mais antiga para a mais recente.<br>- Dentro da semana, pelo G12: primeiro "Pastores", depois os nomes em ordem alfabética, sem diferenciar maiúsculas e acentos, e "—" por último.<br>- O G12 é por pessoa: as células de Pedro e as de Paula, casados, ficam em grupos separados (P-LRE-04 do E2.12).<br>- Dentro do G12, pelo Líder, em ordem alfabética, e depois pelo número da célula.<br>- Com os mesmos dados, a ordem é sempre a mesma. | REL-14 ("ordenada por G12"); legado (`App/Services/ExportService.cs:40`: agrupa pelo G12 do líder, ou pelo próprio líder quando ele não tem G12); P-LRE-04 do E2.12; semana, "Pastores", "—", líder e número: definida pelo spec (P-EXP-15) |
| RN-09 | **Arquivo.**<br>- Planilha do Excel (`.xlsx`). Ela abre no Excel, no Google Planilhas e no LibreOffice, também no celular. Não há CSV.<br>- **Nome:** `Relatorios_{aaaa-mm-dd}_a_{aaaa-mm-dd}.xlsx`, com o domingo da primeira semana e o sábado da última. Exemplo: `Relatorios_2026-11-15_a_2026-11-21.xlsx`.<br>- **Aba "Relatórios":** a primeira linha tem os nomes das colunas (RN-06), destacados, e cada linha seguinte é uma linha da RN-04.<br>  - É a aba ativa ao abrir o arquivo.<br>  - A primeira linha fica congelada, com o filtro ligado.<br>  - Não há células mescladas, linhas em branco nem título acima dos nomes das colunas: o agrupamento por G12 é só pela ordem (RN-08).<br>  - As larguras se ajustam ao conteúdo, com limite, e os textos longos (Endereço e Observações) quebram linha.<br>- **Aba "Informações":** em duas colunas, o rótulo e o valor, uma informação por linha:<br>  - o período: "15/11/2026 a 21/11/2026 (1 semana)";<br>  - os filtros aplicados, um por linha, com os textos dos chips da lista (Textos de tela do E2.12) e, por último, "Busca: “{texto}”", quando há busca; sem nenhum, "Nenhum";<br>  - "Gerada por {Nome}" e "Gerada em {dd/mm/aaaa} às {HH:mm} (horário de Brasília)";<br>  - o que quer dizer cada valor da Situação;<br>  - o aviso "A planilha tem só o que {Nome} vê no sistema."<br>- **Valores:** o número da célula, a Oferta, os números de participantes e de visitantes, e a Data/Hora são valores da planilha, e não texto. Dá para somar, ordenar e filtrar. A aparência é "18/11/2026 20:00" e "R$ 1.234,50".<br>- **Texto digitado:** nomes, endereço, motivo e observações aparecem exatamente como estão gravados, sempre como texto. Um texto que começa com "=", "+", "-" ou "@" nunca vira fórmula. | REL-14 ("Excel"); legado (`App/Services/ExcelService.cs:12` e `:22-46`: `.xlsx`, a aba "Relatórios" e a primeira linha com os nomes das colunas em destaque; `UI/services/Report.service.js:88`: "Relatorios.xlsx"); Textos de tela do E2.12; valores: definida pelo spec (P-EXP-14); nome e aba "Informações": definida pelo spec (P-EXP-16); busca: definida pelo spec (P-EXP-24, PO-UX-2); leitura da planilha: definida pelo spec (P-EXP-31, PO-UX-9) |
| RN-10 | **Só o que a pessoa vê.**<br>- A planilha nunca mostra nada que quem exporta não veja nas telas de Relatórios e de Células. As linhas vêm só de relatórios visíveis e de células visíveis (RN-04).<br>- O Líder e o G12 são nomes de referência (RN-06 do E1.08): só o nome.<br>- Nenhum dado sensível de membro (RN-11 do E1.08): nem CPF, nem e-mail, nem telefones, nem o endereço de membro. O endereço é o da célula, que não é sensível (RN-09 do E2.08). "Ver Dados Sensíveis" não muda nada na planilha.<br>- A oferta, os números e as observações são os que a lista e a consulta já mostram a quem vê o relatório (RN-13 do E2.11; RN-15 e RN-16 do E2.12).<br>- Do relatório que quem exporta não vê, aparece só a Situação ("Célula realizada" ou "Não houve célula"), como na lista de Células (P-SIT-12 do E2.09). Nenhum dado dele, nem o retrato.<br>- A célula que quem exporta só conhece por um relatório visível aparece só nas semanas desse relatório, com o número, o endereço atual e o retrato, como o chip da Célula (RN-08 do E2.12). É o caso de quem só vê relatórios e o da célula que mudou de ministério.<br>- Pela API, vale o mesmo. | AUT-03; RN-02 a RN-04 e RN-23 do E2.02; RN-06 e RN-11 do E1.08; RN-09 do E2.08; P-SIT-12 do E2.09; RN-13 do E2.11; RN-08, RN-15 e RN-16 do E2.12; legado (`Infra/Repositories/CellRepository.cs:32-39` e `ReportRepository.cs:68-75`: células e relatórios só do escopo) |
| RN-11 | **Auditoria.**<br>- **O evento.** Cada planilha entregue gera um evento na Auditoria, com a ação **"Exportação"** e a entidade "Relatório". Ele guarda:<br>  - quem exportou e quando;<br>  - as semanas;<br>  - os filtros aplicados, com os textos dos chips e, por último, "Busca: “{texto}”", quando há busca, como estavam no momento da exportação;<br>  - o número de linhas, o mesmo que a tela mostra no sucesso (RN-13).<br>- **Descrição:** "Exportou a planilha de relatórios de {dd/mm/aaaa} a {dd/mm/aaaa} ({N} linhas)", com "(1 linha)" no singular.<br>- **Na lista da Auditoria,** a segunda linha mostra os filtros, até 3, separados por "; ", e "e mais {N}", ou "Sem filtros". No detalhe, aparecem "Semanas", "Filtros" (um por linha, ou "Nenhum") e "Linhas", sem "Registro" e sem "Ver histórico". No filtro "Ação", "Exportação" vem logo depois de "Restauração".<br>- O evento não guarda o conteúdo da planilha.<br>- **Tudo ou nada.**<br>  - A planilha só é entregue depois que o evento é gravado. Se o evento não puder ser gravado, nada é entregue, e a tela mostra o erro de conexão (RN-13).<br>  - Se a entrega falhar depois do evento (queda de conexão no download, ou a pessoa sai da tela durante a geração), o evento fica, porque os dados saíram do servidor.<br>  - Tentar de novo gera outro evento.<br>  - "Baixar de novo" (RN-13) entrega o mesmo arquivo, já no aparelho, e não gera evento.<br>- As recusas (RN-01, RN-03), "Cancelar" no aviso e a planilha sem linhas (RN-13) não geram evento.<br>- **Como os outros eventos** (E2.05):<br>  - é gravado só pelo servidor, e ninguém o cria, altera ou apaga pela API (RN-16 de lá);<br>  - aparece para quem tem "Visualizar Auditoria", para a igreja toda;<br>  - é guardado por 2 anos (RN-17 de lá);<br>  - é legível (RN-20 de lá);<br>  - não aparece no "Ver histórico" de nenhum registro (RN-19 de lá), porque não altera nenhum. | o legado não registrava a exportação; E2.05 (RN-02, RN-14 e RN-16 a RN-20); evento, tudo ou nada e prazo: definida pelo spec (P-EXP-17); busca no evento: definida pelo spec (P-EXP-24, PO-UX-2); "Baixar de novo": definida pelo spec (P-EXP-28, PO-UX-6); entidade, segunda linha, singular e lugar no filtro: definida pelo spec (P-EXP-29, PO-UX-7) |
| RN-12 | **Coerência com as listas.** Para a mesma pessoa, no mesmo momento, com um Período de semanas completas:<br>- com os mesmos filtros, as linhas com dados de relatório são exatamente os relatórios da lista de Relatórios (RN-15 do E2.12). A soma da Oferta, dos participantes e dos visitantes dessas linhas é a soma desses relatórios;<br>- sem outros filtros, na semana atual, as linhas "Relatório não enviado" são as células "Pendente" da lista de Células e do card "Células com relatório pendente" (RN-08 do E2.09), e as linhas "Ainda não ocorreu" são as células "Ainda não ocorreu";<br>- se o E2.09 ou o E2.12 mudar uma dessas definições, esta regra acompanha. | RN-18 do E2.12; RN-04, RN-08 e RN-09 do E2.09; definida pelo spec (P-EXP-21) |
| RN-13 | **Tempo, andamento, resultado e planilha vazia.**<br>- No volume de referência (20 mil membros, 1.500 células e 100 mil relatórios), a planilha de até 13 semanas fica pronta em até 10 s para quem vê a igreja toda.<br>- **Andamento:** depois de "Exportar planilha", a tela mostra "Gerando a planilha…" e, sem resposta em 3 s, "Ainda gerando a planilha. Isso pode levar alguns segundos.". A geração não pode ser cancelada nem pedida de novo até a resposta.<br>- **Resultado:** aparece na própria página, embaixo da ação, e não num aviso que some sozinho. Ele sai quando os filtros aplicados ou a busca mudam, numa nova exportação e ao sair da tela. Trocar de página ou o tamanho da página não o tira.<br>- **Sucesso:** "Planilha exportada.", com o nome do arquivo e o número de linhas ("Relatorios_2026-11-15_a_2026-11-21.xlsx · 5 linhas"; com uma: "1 linha"), o mesmo do evento (RN-11), e a dica "Se o arquivo não abriu, procure nos arquivos baixados pelo navegador.".<br>- **"Baixar de novo":** enquanto o resultado está na tela, entrega o mesmo arquivo, já no aparelho, sem pedir nada ao servidor e sem gerar evento.<br>- **Sem nenhuma linha:** "Nenhuma célula para exportar com estes filtros.", sem arquivo e sem evento.<br>- **Falha ou queda de conexão:** "Não foi possível exportar a planilha. Verifique a conexão e tente de novo.", com "Tentar de novo". Nenhum texto técnico aparece. | volume de referência do E1.08; legado (`UI/components/Grid/index.js:32-41`: sem registros, a lista não oferece a exportação); definida pelo spec (P-EXP-18); sem cancelar: definida pelo spec (P-EXP-26, PO-UX-4); resultado na página: definida pelo spec (P-EXP-27, PO-UX-5); "Baixar de novo": definida pelo spec (P-EXP-28, PO-UX-6); "Ainda gerando…": definida pelo spec (P-EXP-32, PO-UX-10) |
| RN-14 | **Número da célula.**<br>- Toda célula tem um número, que aparece na coluna "Célula #".<br>- A célula do legado mantém o número que tinha no legado. Assim, a planilha do novo usa os mesmos números da planilha do legado.<br>- A célula cadastrada no novo recebe no cadastro um número que nenhuma outra célula tem, maior que qualquer número do legado, inclusive o das células cadastradas no legado até o cutover. As células que já existem no novo quando este passo for publicado recebem números da mesma forma, na ordem de cadastro.<br>- Quem dá o número é o servidor. O número enviado pelo app ou pela API, no cadastro ou na alteração, é ignorado, sem erro.<br>- O número nunca muda depois de dado: nem ao editar, inativar, reativar, excluir ou restaurar a célula. Ele nunca é reaproveitado, nem depois da exclusão.<br>- Neste passo, o número aparece só na planilha (ver Q-6). | REL-14 ("Célula #"); legado (`ColumnFormatter.cs:14`: o `Id` da célula; `UI/pages/Cells/index.js:42-46`: o mesmo número na lista de Células); E2.10 (Fora de escopo: "o número da célula ('Célula #') do legado: E2.13"); 5.5 do `docs/migracao.md` (`Id` → `legacy_id`); RN-03 do E2.05 (valor do servidor, enviado pelo app é ignorado); definida pelo spec (P-EXP-19) |
| RN-15 | **Dados do legado e homologação.**<br>- As células e os relatórios do legado entram na planilha pelas mesmas regras.<br>- A célula do legado sem data de cadastro conta em todas as semanas (RN-06 do E2.09). Numa semana sem relatório, ela aparece como "Relatório não enviado".<br>- O relatório de "Não houve célula" do legado com oferta, números ou tema aparece sem esses dados (RN-06).<br>- **Homologação (E5.04) e reconciliação (5.6):** a planilha de uma semana de referência é exportada no legado e no novo pela mesma pessoa. As células com relatório são as mesmas, pelo número, com a mesma Situação, a mesma oferta, os mesmos números e as mesmas observações. As diferenças esperadas estão em [Impactos](#impactos-em-outros-passos) (E5.04). Qualquer outra diferença é defeito. | 5.5 e 5.6 do `docs/migracao.md`; RN-06 e RN-10 do E2.09; RN-21 do E2.11; P-LRE-34 do E2.12; definida pelo spec (P-EXP-22) |

#### Colunas da planilha
A coluna "Legado" descreve o que a planilha do legado traz, para a homologação.

| # | Coluna | Conteúdo | Formato | Legado |
|---|---|---|---|---|
| 1 | Semana | A semana da linha: "15/11/2026 a 21/11/2026". | texto | não existia |
| 2 | Célula # | O número da célula (RN-14). | número inteiro | o `Id` da célula |
| 3 | G12 | O G12 do líder da linha (RN-06): o nome do G12; o próprio líder, quando ele é G12; "Pastores", quando é pastor; "—", quando está sem liderança. | texto | o G12 do líder atual da célula; sem G12 calculado, o nome do próprio líder |
| 4 | Líder | O nome completo do líder da linha (RN-06). | texto | o primeiro e o último nome do líder atual da célula |
| 5 | Endereço | A rua e o número atuais da célula: "Rua das Flores, 100". Sem número, só a rua. Sem rua, vazio. | texto | igual |
| 6 | Bairro | O bairro atual da célula. Sem bairro, vazio. | texto | igual |
| 7 | Situação | Um valor da RN-05: Célula realizada, Não houve célula, Relatório não enviado ou Ainda não ocorreu. | texto | "Relatório não entregue.", "Não houve célula." ou "Célula realizada." |
| 8 | Data/Hora | Só em "Célula realizada", com relatório visível: a data e o horário do relatório, em Brasília. Nas outras linhas, vazio. | data e hora, exibida como dd/mm/aaaa hh:mm | "Data / Hora", em texto, só na célula realizada |
| 9 | Oferta | Só em "Célula realizada", com relatório visível: a oferta registrada. Zero aparece como "R$ 0,00". Sem valor registrado (P-LCE-31 do E2.10), vazio. | número em reais, exibido como R$ 1.234,50 | texto em reais, também em "Não houve célula" |
| 10 | Nº de participantes | Só em "Célula realizada", com relatório visível: os membros do relatório, uma vez cada, inclusive os automáticos e os excluídos (RN-15 do E2.12). | número inteiro | "Numero Participantes", também em "Não houve célula" |
| 11 | Nº de visitantes | Só em "Célula realizada", com relatório visível: o número de nomes de visitantes gravados (REL-08). | número inteiro | "Numero Visitantes / Novos", também em "Não houve célula" |
| 12 | Observações | Com relatório visível: em "Célula realizada", as observações; em "Não houve célula", o motivo, seguido das observações, quando houver, separados por " · ". Nas outras linhas, vazio. | texto | as observações, ou a justificativa de "Não houve célula" |
| 13 | Célula excluída | "Sim" na linha de uma célula excluída. Nas outras, vazio. | texto | não existia |

#### Resumo das linhas de uma semana
| A célula na semana | Quem exporta vê | Situação | Dados do relatório | Líder e G12 |
|---|---|---|---|---|
| tem relatório | o relatório | Célula realizada ou Não houve célula | sim (sem números em "Não houve célula") | do retrato |
| tem relatório | a célula, mas não o relatório | Célula realizada ou Não houve célula | não | da célula, atuais |
| sem relatório, semana atual, antes do prazo, situação "Ainda não ocorreu" | a célula | Ainda não ocorreu | não | da célula, atuais |
| sem relatório, prazo passado, semana conta | a célula | Relatório não enviado | não | da célula, atuais |
| sem relatório, semana não conta, ou célula sem dia da reunião | — | não entra | — | — |
| célula excluída sem relatório visível | — | não entra | — | — |

### Critérios de aceite
Convenções:
- "Hoje" é terça-feira, 24/11/2026, às 21:00 de Brasília, salvo quando o critério diz outra data. A semana atual vai de domingo, 22/11, a sábado, 28/11. A semana passada vai de 15/11 a 21/11, e a retrasada, de 08/11 a 14/11.
- "Pela API" é qualquer pedido feito fora da tela, com a sessão da persona citada.
- "Exporta 'Semana passada'" quer dizer: aplica o atalho na lista de Relatórios, sem outro filtro, e toca em "Exportar para Excel".
- As linhas são escritas como "C1 · G12 · Líder · Situação". Nos critérios, os nomes aparecem só com o primeiro nome; na planilha, vem o nome completo do cadastro.
- Todo relatório tem o retrato (RN-21 do E2.11).
- **Consolidado:** ainda não existe; ver Impactos.
- Cada critério parte da massa original.

#### Massa de exemplo
A árvore, as funções, as células e os relatórios são os da [massa do E2.12](e2-12-listagem-relatorios.md#massa-de-exemplo), que parte da [massa do E2.10](e2-10-listagem-celulas.md#massa-de-exemplo), com o que está abaixo.

- **Árvore** (resumo): Samuel e Magda, pastores e casados. Pedro (casado com Paula) e Tiago (casado com Tânia) são G12. André é discípulo de Pedro; Caio e Fábio (**inativo**) são discípulos de André. Débora é discípula de Beatriz, que é discípula de Tânia. Diego e Hugo são discípulos de Tiago. Ester está sem liderança. Sara, participante de R1, foi **excluída** em 20/11/2026.
- **Funções:**
  - Administrador (todas as permissões): Rita. Só ela tem "Visualizar Auditoria".
  - Líder, que passa a ter "Exportar Relatórios de Células": Samuel, Magda, Pedro, Paula, André e Diego.
  - Membro, sem "Exportar Relatórios de Células": Caio, Carla, Fábio, Beatriz, Ester e Jonas.
  - Hugo: sem função.
  - Lia: Secretaria, só com "Visualizar Relatórios de Toda a Igreja". Nos critérios marcados com "Lia com exportação", a função Secretaria também tem "Exportar Relatórios de Células".
- **Células**, com o número e o que importa aqui:

| Célula | Líder / Timóteo / Anfitrião · tipo · reunião | G12 da célula | Endereço | Célula # | Observação |
|---|---|---|---|---|---|
| C1 | André / Caio / Carla · Evangelística · quarta, 20:00 | Pedro | Rua das Flores, 100 · Centro | 101 | do legado, cadastrada em 10/03/2025. Até 21/10/2026, liderada por Fábio e do tipo Discipulado |
| C2 | Diego / Hugo / Caio · Evangelística · quinta, 20:00 | Tiago | Av. São João, 45 · São João | 5003 | cadastrada no novo no domingo, 22/11/2026, às 00:10 |
| C3 | Débora / Rita / Beatriz · Discipulado · terça, 19:30 | Tânia | Rua Sao Joao, 12 · Niterói | 87 | do legado, sem data de cadastro |
| C4 | Gabriel / Jonas / Fábio · Evangelística · sábado, 10:00 | Pedro | Rua Brasil, 500 · Centro | 412 | do legado; **inativa** desde quinta, 01/10/2026, às 10:00 |
| C5 | Jonas / Gabriel / Fábio · Evangelística · sexta, 20:00 | Pedro | sem endereço | 5001 | cadastrada no novo em 01/09/2026; **excluída** no sábado, 21/11/2026, às 10:00 |
| C6 | Paula / Carla / Paula · Discipulado · segunda, 20:00 | Paula | sem endereço | 5002 | cadastrada no novo no sábado, 21/11/2026, às 23:30 |
| C7 | Samuel / Tiago / Magda · Macrocélula · domingo, 18:00 | Pastores | Rua da Igreja, 1 · Centro | 12 | do legado, cadastrada em 15/01/2024 |
| C8 | Ester / Lúcia / Ester · Evangelística · sábado, 16:00 | — | Rua das Flores, 7 · Rio Branco | 300 | do legado, cadastrada em 02/02/2026 |

Os números de 5001 em diante mostram um número do novo, maior que qualquer número do legado (RN-14). O valor exato é do `architect`.

- **Relatórios** (os do E2.12; nenhum outro, salvo o que cada critério disser):

| Relatório | Célula | Data e horário | Reunião | Retrato: líder · tipo | Tema ou motivo | Participantes · visitantes · oferta | Observações |
|---|---|---|---|---|---|---|---|
| R10 | C7 | domingo, 22/11/2026, 18:00 | Célula realizada | Samuel · Macrocélula | "Visão" | 40 · 5 · R$ 300,00 | — |
| R9 | C6 | segunda, 23/11/2026, 20:00 | Célula realizada | Paula · Discipulado | "Amizade" | 7 · 3 · R$ 40,00 | — |
| R6 | C5 | sexta, 20/11/2026, 20:00 | Célula realizada | Jonas · Evangelística | "Gratidão" | 6 · 1 · R$ 30,00 | — |
| R1 | C1 | quarta, 18/11/2026, 20:00 | Célula realizada | André · Evangelística | "A fé que vence" | 8 (inclui Sara, excluída) · 2 · R$ 50,00 | "Dois visitantes do trabalho do Caio" |
| R2 | C1 | quarta, 11/11/2026, 20:00 | Não houve célula | André · Evangelística | motivo "Chuva forte no bairro" | — | — |
| R8 | C3 | terça, 10/11/2026, 19:30 | Célula realizada | Débora · Discipulado | "Família" | 5 · 0 · R$ 25,00 | — |
| R4 | C1 | quarta, 28/10/2026, 20:00 | Célula realizada | André · Evangelística | "Perdão" | 6 · 0 · R$ 20,00 | — |
| R5 | C1 | quarta, 21/10/2026, 20:00 | Célula realizada | **Fábio** · **Discipulado** | "Oração" | 5 · 1 · R$ 15,00 | — |

  R3, de C1, de quarta, 04/11/2026, 20:15, está **excluído**.

- **O que cada um vê** (E2.10 e E2.12):

| Pessoa | Células visíveis | Relatórios visíveis |
|---|---|---|
| Rita | C1, C2, C3, C4, C6, C7, C8 | todos |
| Samuel e Magda | C1, C2, C3, C4, C6, C7 | todos |
| Pedro e Caio | C1, C2, C4, C6 | R9, R6, R1, R2, R4, R5 |
| André | C1, C2, C3, C4, C6 | R9, R6, R1, R2, R8, R4, R5 |
| Diego | C2, C3, C7 | R10, R8 |
| Ester | C8 | nenhum |
| Hugo | C2 | nenhum |
| Lia | nenhuma | todos |

- **Situação da semana hoje, às 21:00** (E2.09): C1, C2 e C8 "Ainda não ocorreu"; C3 "Pendente" (prazo às 20:30); C6 e C7 "Enviado"; C4 sem situação (inativa).

#### Critérios por regra
- **RN-01**
  - Dados Rita, Samuel, Pedro, André e Diego
  - Quando cada um abre Relatórios
  - Então vê "Exportar para Excel".
  - Dados Caio, da função Membro, e Lia, sem "Exportar Relatórios de Células"
  - Quando abrem Relatórios
  - Então veem a lista, mas não veem "Exportar para Excel".
  - Quando pedem a exportação pela API
  - Então recebem "Você não tem permissão para esta ação.", sem planilha e sem evento.
  - Dado Hugo, sem função, timóteo de C2
  - Então ele não tem Relatórios no menu, e a exportação pela API é recusada da mesma forma, mesmo pedindo só a célula C2.
  - Dada uma função "Exportação" que tem só "Exportar Relatórios de Células", sem nenhuma permissão que dê a lista de Relatórios
  - Então quem a tem não vê a ação, e a API recusa.
  - Quando Rita edita essa função na tela de Funções
  - Então "Exportar Relatórios de Células" aparece no grupo "Relatórios", logo depois de "Visualizar Relatórios do Seu Ministério", com o aviso "Para valer, a função também precisa de uma permissão que mostre Relatórios.". Rita consegue salvar a função assim.
  - Quando ela marca "Visualizar Seu Ministério"
  - Então o aviso some.
  - Dado que Rita tira "Exportar Relatórios de Células" da função Líder às 21:00
  - Quando Pedro pede a exportação às 21:01, com a lista já aberta
  - Então a exportação é recusada, e a ação some da tela na próxima consulta.
- **RN-02**
  - Dado Pedro, com "Semana passada" e Líder: André aplicados
  - Quando exporta
  - Então a planilha tem uma linha: C1 · Pedro · André · Célula realizada (R1). C5 (R6, líder registrado Jonas) não entra.
  - Dado Pedro no celular, com "Semana passada" aplicada
  - Quando escolhe G12: Paula no painel, fecha o painel sem tocar em "Aplicar filtros" e exporta
  - Então a planilha usa só "Semana passada", sem o G12: Paula.
  - Dado Pedro na página 2 da lista, com 10 relatórios por página
  - Quando exporta
  - Então a planilha traz todas as linhas da RN-04, e não só as da página.
  - Dado Pedro, com "Esta semana" e Líder: André aplicados, e a lista vazia (André não tem relatório nesta semana)
  - Então "Exportar para Excel" continua disponível.
  - Quando exporta
  - Então a planilha tem uma linha: C1 · Pedro · André · Ainda não ocorreu.
  - Depois de exportar, a lista, os filtros, a página e o endereço da página continuam como estavam.
  - O nome acessível da ação é "Exportar para Excel", o mesmo texto que se vê, e a descrição é "Gera a planilha dos relatórios com os filtros aplicados.". Quem usa comando de voz aciona a ação dizendo "Exportar para Excel".
- **RN-03**
  - Dado Pedro sem Período
  - Quando toca em "Exportar para Excel"
  - Então vê "Para exportar, informe o período (De e Até) ou use um atalho de semana.", sem planilha e sem evento. O mesmo acontece só com "De", só com "Até" e com "De" em "31/02/2026", que a lista não aplicou.
  - Dado Pedro com De 20/11/2026 e Até 24/11/2026
  - Quando toca em "Exportar para Excel"
  - Então o aviso "Exportar a planilha?" diz "A planilha terá 2 semanas, de 15/11/2026 a 28/11/2026, com os filtros aplicados." e "As semanas entram inteiras, de domingo a sábado.", e "Outros filtros" diz "Nenhum".
  - Quando toca em "Cancelar"
  - Então nada é exportado, e nenhum evento é gravado.
  - Quando abre o aviso de novo e toca em "Exportar planilha"
  - Então recebe `Relatorios_2026-11-15_a_2026-11-28.xlsx`, com 5 linhas:
    - semana de 15/11: C1 · Pedro · André · Célula realizada (R1); C5 · Pedro · Jonas · Célula realizada (R6);
    - semana de 22/11: C6 · Paula · Paula · Célula realizada (R9); C1 · Pedro · André · Ainda não ocorreu; C2 · Tiago · Diego · Ainda não ocorreu.
  - E R1, de 18/11, está na planilha, embora a lista com esse Período não o mostre.
  - Dado o Período de 30/08/2026 a 28/11/2026 (13 semanas)
  - Então a exportação é aceita.
  - Dado o Período de 29/08/2026 a 28/11/2026 (14 semanas, a partir de 23/08)
  - Então a tela mostra "A exportação aceita até 13 semanas. Diminua o período.", sem planilha e sem evento.
  - Dado o Período de 22/11/2026 a 12/12/2026
  - Então o aviso diz "A planilha terá 1 semana, de 22/11/2026 a 28/11/2026, com os filtros aplicados." e "As semanas que ainda não começaram não entram.", e a planilha tem só a semana atual.
  - Dado "Semana passada", sem outros filtros
  - Então o aviso diz "A planilha terá 1 semana, de 15/11/2026 a 21/11/2026, com os filtros aplicados.", sem nenhuma das duas notas.
  - Dado Pedro com "Semana passada", Líder: André e a busca "fé"
  - Então "Outros filtros" lista "Líder: André …" e "Busca: “fé”", nessa ordem.
  - Dado Pedro só com "Semana passada" e a busca "fé"
  - Então "Outros filtros" lista só "Busca: “fé”".
  - Dado o Período de 29/11/2026 a 05/12/2026
  - Então a tela mostra "O período escolhido ainda não começou. Escolha um período até esta semana.", sem planilha e sem evento.
  - Dado Pedro com o celular no horário de Lisboa, no sábado, 28/11, às 22:30 de Brasília (domingo, 29/11, 01:30 em Lisboa)
  - Quando usa "Esta semana" e exporta
  - Então a planilha é da semana de 22/11 a 28/11, e a Data/Hora de R9 é "23/11/2026 20:00".
- **RN-04**
  - Quando Pedro exporta "Semana passada"
  - Então a planilha tem 2 linhas:
    1. C1 · Pedro · André · Célula realizada (R1);
    2. C5 · Pedro · Jonas · Célula realizada (R6), com "Célula excluída: Sim".
  - E não entram:
    - C2, cadastrada em 22/11;
    - C4, inativa no prazo de sábado, 21/11;
    - C6, cadastrada no sábado, 21/11, às 23:30, depois do prazo de segunda, 16/11, às 21:00.
  - Quando Rita exporta "Semana passada"
  - Então a planilha tem 5 linhas:
    1. C7 · Pastores · Samuel · Relatório não enviado;
    2. C1 · Pedro · André · Célula realizada (R1);
    3. C5 · Pedro · Jonas · Célula realizada (R6), com "Célula excluída: Sim";
    4. C3 · Tânia · Débora · Relatório não enviado;
    5. C8 · — · Ester · Relatório não enviado.
  - Quando Rita exporta "Esta semana"
  - Então a planilha tem 6 linhas:
    1. C7 · Pastores · Samuel · Célula realizada (R10);
    2. C6 · Paula · Paula · Célula realizada (R9);
    3. C1 · Pedro · André · Ainda não ocorreu;
    4. C3 · Tânia · Débora · Relatório não enviado;
    5. C2 · Tiago · Diego · Ainda não ocorreu;
    6. C8 · — · Ester · Ainda não ocorreu.
  - E C4 (inativa) e C5 (excluída, sem relatório nesta semana) não entram.
  - Quando Samuel exporta "Semana passada"
  - Então a planilha tem 4 linhas: C7, C1, C5 e C3, como na de Rita, sem C8, porque Ester está fora da árvore dos pastores.
  - Quando Pedro exporta o Período de 08/11/2026 a 21/11/2026
  - Então a planilha tem 3 linhas:
    1. semana de 08/11: C1 · Pedro · André · Não houve célula (R2);
    2. semana de 15/11: C1 · Pedro · André · Célula realizada (R1);
    3. semana de 15/11: C5 · Pedro · Jonas · Célula realizada (R6).
  - E C1 aparece uma vez em cada semana. R8, de C3, que Pedro não vê, não entra.
  - Dado Pedro, que chega à lista com a Célula C1
  - Quando aplica o Período de 18/10/2026 a 21/11/2026 (5 semanas) e exporta
  - Então a planilha tem 5 linhas, todas de C1:
    - semana de 18/10: Célula realizada (R5);
    - semana de 25/10: Célula realizada (R4);
    - semana de 01/11: Relatório não enviado, porque R3 está excluído;
    - semana de 08/11: Não houve célula (R2);
    - semana de 15/11: Célula realizada (R1).
  - Quando Pedro exporta o Período de 20/09/2026 a 03/10/2026
  - Então a planilha tem 3 linhas:
    - semana de 20/09: C1 · Pedro · André · Relatório não enviado; C4 · Pedro · Gabriel · Relatório não enviado, porque C4 estava ativa no prazo de sábado, 26/09, às 11:00;
    - semana de 27/09: C1 · Pedro · André · Relatório não enviado.
  - E C4 não aparece na semana de 27/09, porque ficou inativa na quinta, 01/10, antes do prazo de sábado, 03/10. C5 não aparece em nenhuma das duas: está excluída e não tem relatório nelas.
  - Dado que Pedro reativa C4 na quarta, 25/11, às 10:00
  - Quando exporta "Esta semana" às 10:05
  - Então C4 aparece como C4 · Pedro · Gabriel · Ainda não ocorreu.
  - Dado que Pedro cadastra C10 (André; quarta, 20:00) na quinta, 26/11, às 10:00
  - Quando exporta "Esta semana" às 10:05
  - Então C10 não aparece: está "Conta a partir da próxima semana".
  - Quando exporta "Esta semana" na quinta, 03/12, às 10:00, sem relatório de C10
  - Então C10 aparece como Relatório não enviado.
  - Dado que Rita troca o timóteo de C3 por Caio na quinta, 26/11, às 10:00, e Pedro passa a ver C3, mas não R8 (o retrato continua Débora, Rita e Beatriz)
  - Quando Pedro exporta o Período de 08/11/2026 a 14/11/2026
  - Então a planilha tem 2 linhas: C1 · Pedro · André · Não houve célula (R2); C3 · Tânia · Débora · Célula realizada, com Data/Hora, Oferta, números e Observações vazios.
- **RN-05**
  - Quando Rita exporta "Esta semana" hoje, às 21:00
  - Então C3 está "Relatório não enviado" (prazo de terça às 20:30), e C1 está "Ainda não ocorreu".
  - Quando exporta na quarta, 25/11, às 20:59:59
  - Então C1 está "Ainda não ocorreu".
  - Quando exporta às 21:00:00
  - Então C1 está "Relatório não enviado".
  - Dado que ninguém envia relatório até o fim da semana
  - Quando Rita exporta "Esta semana" no sábado, 28/11, às 23:59:59
  - Então C1, C2, C3 e C8 estão "Relatório não enviado", e C6 e C7 estão "Célula realizada".
  - Quando exporta "Esta semana" no domingo, 29/11, às 00:00:00
  - Então a planilha é da semana de 29/11 a 05/12, com 6 linhas "Ainda não ocorreu": C7, C6, C1, C3, C2 e C8.
  - Quando exporta o Período de 22/11/2026 a 28/11/2026 nesse mesmo momento
  - Então as linhas são as mesmas da exportação de sábado às 23:59:59.
  - Em nenhuma planilha aparece "Relatório não entregue.", nem um valor com ponto final.
- **RN-06**
  - Quando Pedro exporta "Semana passada"
  - Então a linha de C1 é:
    - Semana "15/11/2026 a 21/11/2026"; Célula # 101; G12 "Pedro"; Líder "André";
    - Endereço "Rua das Flores, 100"; Bairro "Centro";
    - Situação "Célula realizada"; Data/Hora 18/11/2026 20:00; Oferta R$ 50,00;
    - Nº de participantes 8, contando Sara, excluída; Nº de visitantes 2;
    - Observações "Dois visitantes do trabalho do Caio"; Célula excluída vazia.
  - E a linha de C5 é:
    - Célula # 5001; G12 "Pedro"; Líder "Jonas"; Endereço e Bairro vazios;
    - Situação "Célula realizada"; Data/Hora 20/11/2026 20:00; Oferta R$ 30,00;
    - Nº de participantes 6; Nº de visitantes 1; Observações vazia;
    - Célula excluída "Sim".
  - Quando Pedro exporta o Período de 08/11/2026 a 14/11/2026
  - Então a linha de R2 tem Situação "Não houve célula", Data/Hora, Oferta e números vazios, e Observações "Chuva forte no bairro".
  - Quando Rita exporta o Período de 18/10/2026 a 31/10/2026
  - Então, na semana de 18/10, a linha de C1 tem Líder "Fábio" (inativo, líder registrado em R5) e G12 "Pedro", o G12 atual de Fábio. Na semana de 25/10, tem Líder "André" (R4). A Célula # é 101 nas duas.
  - Quando Rita exporta "Semana passada"
  - Então as linhas "Relatório não enviado" têm Data/Hora, Oferta, números e Observações vazios, e:
    - C7: G12 "Pastores", Líder "Samuel", Endereço "Rua da Igreja, 1", Bairro "Centro";
    - C3: G12 "Tânia", Líder "Débora", Endereço "Rua Sao Joao, 12", Bairro "Niterói";
    - C8: G12 "—", Líder "Ester", Endereço "Rua das Flores, 7", Bairro "Rio Branco".
  - Quando Rita exporta "Esta semana"
  - Então a linha de C6 (sem endereço) tem Endereço e Bairro vazios.
  - Dado um relatório de célula realizada sem observações, como R6
  - Então a coluna Observações fica vazia, sem "—" nem outro marcador.
  - Na planilha, os nomes do Líder e do G12 vêm completos, como no cadastro.
- **RN-07**
  - Dada Rita com "Esta semana" e G12: Pedro
  - Então a planilha tem uma linha: C1 · Pedro · André · Ainda não ocorreu.
  - Com G12: Pedro e Paula, tem C6 (R9) e C1.
  - Dada Rita com "Esta semana" e Tipo: Discipulado
  - Então a planilha tem C6 · Paula · Paula · Célula realizada (R9, Discipulado no retrato) e C3 · Tânia · Débora · Relatório não enviado (Discipulado hoje).
  - Dada Rita com "Esta semana" e Reunião: Célula realizada
  - Então a planilha tem só C7 (R10) e C6 (R9). As linhas "Ainda não ocorreu" e "Relatório não enviado" saem.
  - Dado Pedro com "Semana passada" e a busca "fé"
  - Então a planilha tem só C1 (R1), pelo tema.
  - Dado Pedro com "Esta semana" e a busca "André"
  - Então a planilha tem C1 · Pedro · André · Ainda não ocorreu, pelo nome do líder atual.
  - Dado Pedro com "Esta semana" e, vindo de um link, G12: Tânia ("Pessoa indisponível" para ele)
  - Então a tela mostra "Nenhuma célula para exportar com estes filtros.", sem planilha e sem evento.
  - Dado Pedro com a Célula C1, vinda de um link, e "Semana passada"
  - Então a planilha tem só a linha de C1.
- **RN-08**
  - Quando Rita exporta "Esta semana"
  - Então a ordem é C7 (Pastores), C6 (Paula), C1 (Pedro), C3 (Tânia), C2 (Tiago) e C8 (—). As células de Pedro e de Paula, casados, ficam em grupos separados.
  - Quando Pedro exporta "Semana passada"
  - Então, no G12 "Pedro", André (C1) vem antes de Jonas (C5).
  - Dado que André tem uma segunda célula, C11, de sexta, com relatório na semana passada
  - Então, no G12 "Pedro", C1 (nº 101) vem antes de C11 (número maior).
  - Dado um G12 chamado "Álvaro" com uma célula nesta semana
  - Então o grupo dele vem antes do grupo de Paula, e não depois do "—".
  - Quando Pedro exporta o Período de 08/11/2026 a 21/11/2026
  - Então as linhas da semana de 08/11 vêm antes das da semana de 15/11.
  - Quando Rita exporta "Esta semana" duas vezes, sem mudança nos dados
  - Então as duas planilhas têm as linhas na mesma ordem.
- **RN-09**
  - Quando Rita exporta "Semana passada"
  - Então recebe `Relatorios_2026-11-15_a_2026-11-21.xlsx`, com as abas "Relatórios" e "Informações".
  - E a primeira linha da aba "Relatórios" é, nesta ordem: Semana, Célula #, G12, Líder, Endereço, Bairro, Situação, Data/Hora, Oferta, Nº de participantes, Nº de visitantes, Observações e Célula excluída.
  - E a soma da coluna Oferta, feita na própria planilha, dá R$ 80,00.
  - E ordenar a planilha pela Data/Hora a ordena por data, e não como texto.
  - E, ao abrir o arquivo, a aba ativa é "Relatórios", com a primeira linha congelada e o filtro ligado nela. Não há células mescladas, linhas em branco nem título acima dos nomes das colunas.
  - E filtrar a coluna G12 por "Pedro", no filtro da própria planilha, deixa só as linhas de C1 e C5, sem mudar a ordem.
  - E a aba "Informações" tem duas colunas, o rótulo e o valor, e diz:
    - "15/11/2026 a 21/11/2026 (1 semana)";
    - Filtros: "Nenhum";
    - "Gerada por Rita …" e "Gerada em 24/11/2026 às 21:00 (horário de Brasília)";
    - o que quer dizer cada valor da Situação;
    - "A planilha tem só o que Rita … vê no sistema."
  - Dado Pedro com "Semana passada", Líder: André e a busca "fé"
  - Então a aba "Informações" lista os filtros, um por linha: "Líder: André …" e "Busca: “fé”".
  - Dado um relatório desta semana com as observações "=1+1" e "@lider"
  - Quando Rita exporta "Esta semana"
  - Então a coluna Observações mostra "=1+1" e "@lider" como texto, e nenhuma fórmula é calculada.
  - A planilha abre no Excel, no Google Planilhas e no LibreOffice, e no celular (Android e iPhone), com os acentos certos.
- **RN-10**
  - Quando Pedro, sem "Ver Dados Sensíveis", e Rita, com ela, exportam "Semana passada"
  - Então as duas planilhas têm as mesmas 13 colunas, sem CPF, e-mail, telefone nem endereço de membro.
  - Quando Diego exporta "Semana passada"
  - Então a planilha tem 2 linhas: C7 · Pastores · Samuel · Relatório não enviado e C3 · Tânia · Débora · Relatório não enviado. Não aparece nada de C1, C5 nem C6, do ministério de Pedro.
  - Dada Lia com exportação
  - Quando exporta "Semana passada"
  - Então a planilha tem 2 linhas, C1 (R1) e C5 (R6), e nenhuma linha "Relatório não enviado", porque Lia não vê células.
  - Quando exporta "Esta semana"
  - Então a planilha tem C7 (R10) e C6 (R9), e nenhuma linha "Ainda não ocorreu".
  - Dado Pedro, antes da troca do timóteo de C3, com a Célula C3 vinda de um link ("Célula indisponível")
  - Quando pede a exportação de "Semana retrasada", pela tela ou pela API
  - Então não recebe nenhuma linha de C3, nem a existência de R8.
- **RN-11**
  - Quando Rita exporta "Semana passada" às 21:00
  - Então a Auditoria tem um evento de Rita, em 24/11/2026 às 21:00, com a ação "Exportação", a entidade "Relatório" e a descrição "Exportou a planilha de relatórios de 15/11/2026 a 21/11/2026 (5 linhas)".
  - E, na lista da Auditoria, a segunda linha diz "Sem filtros". No detalhe, aparecem "Semanas" ("15/11/2026 a 21/11/2026 (1 semana)"), "Filtros" ("Nenhum") e "Linhas" ("5"), sem "Registro" e sem "Ver histórico".
  - E o evento não traz oferta, nomes de líderes das linhas, observações nem outro dado das linhas.
  - E o evento não aparece no "Ver histórico" de C1 nem no de R1.
  - E, no filtro "Ação" da Auditoria, "Exportação" vem logo depois de "Restauração"; escolhê-la deixa só as exportações.
  - Quando Pedro exporta "Semana passada" com Líder: André e a busca "fé"
  - Então Rita vê na Auditoria o evento de Pedro, com a descrição "… (1 linha)", no singular, e os filtros "Líder: André …" e "Busca: “fé”". Pedro não vê a Auditoria.
  - Dado um evento com 5 filtros
  - Então a segunda linha da lista mostra os 3 primeiros, separados por "; ", e "e mais 2". O detalhe mostra os 5.
  - Dado que Rita exportou "Semana passada" e o resultado está na tela
  - Quando ela toca em "Baixar de novo"
  - Então recebe o mesmo arquivo, sem novo pedido ao servidor, e a Auditoria continua com um evento só dessa exportação.
  - Quando ela toca em "Cancelar" no aviso, em vez de exportar
  - Então nenhum evento é gravado.
  - Dado que o evento não pode ser gravado (falha no servidor)
  - Quando Rita exporta
  - Então nenhuma planilha é entregue, e a tela mostra "Não foi possível exportar a planilha. Verifique a conexão e tente de novo.".
  - Dado que a conexão cai durante o download, depois de o evento ser gravado
  - Então o evento fica. Ao tentar de novo, Rita recebe a planilha, e a Auditoria passa a ter dois eventos.
  - Dados os casos de recusa (sem permissão, sem período, mais de 13 semanas, período que não começou) e a planilha sem linhas
  - Então nenhum evento é gravado.
  - Dado o evento da exportação de Rita
  - Quando alguém, inclusive Rita, tenta alterá-lo ou apagá-lo pela API
  - Então nada muda.
  - Dado que se passaram 2 anos desde a exportação
  - Então o evento sai da Auditoria em até 1 dia (RN-17 do E2.05).
- **RN-12**
  - Quando Rita exporta "Semana passada" e abre a lista de Relatórios com "Semana passada"
  - Então as linhas com dados de relatório (C1 e C5) são os 2 relatórios da lista (R1 e R6). A soma da Oferta é R$ 80,00, a de participantes é 14 e a de visitantes é 3, as mesmas dos dois relatórios.
  - Dada a quinta, 26/11, às 10:00, sem relatório novo
  - Quando Rita exporta "Esta semana" e abre a lista de Células e o Dashboard
  - Então as linhas "Relatório não enviado" são C1 e C3; a lista de Células mostra C1 e C3 como "Pendente"; e o card "Células com relatório pendente" mostra 2.
  - E as linhas "Ainda não ocorreu" são C2 e C8, as mesmas células "Ainda não ocorreu" da lista de Células.
- **RN-13**
  - Dado o volume de referência, com Rita
  - Quando ela exporta 13 semanas
  - Então a planilha fica pronta em até 10 s.
  - Dada Rita, que toca em "Exportar planilha"
  - Então a tela mostra "Gerando a planilha…". Um segundo toque, "Cancelar" e fechar o aviso não fazem nada até a resposta.
  - Dada a resposta atrasada em 4 s
  - Então, aos 3 s, aparece "Ainda gerando a planilha. Isso pode levar alguns segundos.".
  - Dada Rita com "Semana passada" e Reunião: Não houve célula
  - Quando exporta
  - Então a tela mostra, embaixo da ação, "Nenhuma célula para exportar com estes filtros.", sem arquivo e sem evento.
  - Quando Rita exporta "Semana passada"
  - Então a tela mostra, embaixo da ação, "Planilha exportada.", "Relatorios_2026-11-15_a_2026-11-21.xlsx · 5 linhas", a dica "Se o arquivo não abriu, procure nos arquivos baixados pelo navegador." e "Baixar de novo". Nenhum aviso que some sozinho aparece.
  - E o número de linhas é o mesmo do evento na Auditoria (5).
  - Quando ela troca de página na lista
  - Então o resultado continua.
  - Quando ela aplica "Esta semana", muda a busca ou sai da tela
  - Então o resultado e "Baixar de novo" somem.
  - Dado Pedro com Líder: André e "Semana passada" (1 linha)
  - Então o resultado diz "1 linha", no singular.
  - Dada a conexão caída
  - Quando Rita exporta
  - Então a tela mostra "Não foi possível exportar a planilha. Verifique a conexão e tente de novo.", com "Tentar de novo", e a lista e os filtros continuam como estavam.
- **RN-14**
  - Dada C1, que tinha o número 101 no legado
  - Então a Célula # de C1 é 101 nas planilhas do legado e do novo.
  - Quando Pedro cadastra C10 na quinta, 26/11
  - Então C10 recebe um número que nenhuma outra célula tem, maior que qualquer número do legado.
  - Quando alguém envia pela API o número 101 para C10, no cadastro ou numa alteração
  - Então o número é ignorado, sem erro, e C10 fica com o número que o servidor deu.
  - Dada C5, excluída, com o número 5001
  - Então o número continua 5001, nenhuma célula nova recebe 5001, e, se Rita restaurar C5, ela continua com 5001.
  - Quando Pedro edita, inativa e reativa C4
  - Então C4 continua com o número 412.
- **RN-15**
  - Dado um relatório do legado de "Não houve célula" com oferta de R$ 10,00, 3 participantes e a justificativa "Feriado"
  - Quando ele entra numa planilha
  - Então a linha tem Situação "Não houve célula", Oferta e números vazios, e Observações "Feriado".
  - Dada C3, do legado, sem data de cadastro
  - Então ela aparece como "Relatório não enviado" em toda semana passada sem relatório, como na "Semana passada" de Rita.
  - Dada a semana de referência da homologação
  - Quando a mesma pessoa a exporta no legado e no novo
  - Então as células com relatório são as mesmas, pelo número, com a mesma Situação, a mesma oferta, os mesmos números e as mesmas observações. As diferenças são só as listadas em Impactos (E5.04).

### Textos de tela
Vocabulário de referência. O `ux-designer` pode ajustar o tom, mas não o sentido nem os termos. Os textos vindos do desenho de UX e aprovados pelo PO em 2026-11-24 (PO-UX-1 a PO-UX-10) já estão na tabela. Os demais (estados de carregamento e as alternativas da T12) estão em Experiência (UX) > Textos.

- **Termos:** Exportar para Excel, Exportar planilha, planilha, semana, Semana, Célula #, G12, Líder, Endereço, Bairro, Situação, Célula realizada, Não houve célula, Relatório não enviado, Ainda não ocorreu, Data/Hora, Oferta, Nº de participantes, Nº de visitantes, Observações, Célula excluída, Informações, Outros filtros, Busca, Baixar de novo, Exportação.
- **Evitar:**
  - "Relatório não entregue" e "Entregue" (use "não enviado" e "Enviado", Textos de tela do E2.09);
  - "Baixar relatórios", do legado, no nome da ação, porque ela gera uma planilha, e não os relatórios;
  - "Exportar" sem objeto no botão do aviso (use "Exportar planilha");
  - "Download", "Downloads", "Export", "CSV" e outros anglicismos;
  - "Sucesso!", "Pronto!" e "OK" como resultado ou como botão;
  - "Status" no lugar de "Situação";
  - "Numero" sem acento e "Novos" junto de visitantes, do legado;
  - "doação" ou "dízimo" no lugar de "oferta";
  - "Encontro" para a reunião da célula;
  - "Pendente" na planilha: ali, a célula sem relatório depois do prazo é "Relatório não enviado", na semana atual e nas passadas;
  - qualquer texto técnico (código de erro, "timeout", identificador).

| Situação | Texto |
|---|---|
| ação na lista de Relatórios | Exportar para Excel · o nome acessível é o mesmo texto (P-EXP-23) · descrição para o leitor de tela: Gera a planilha dos relatórios com os filtros aplicados. |
| aviso antes de gerar: título | Exportar a planilha? |
| aviso: semanas | A planilha terá {N} semanas, de {dd/mm/aaaa} a {dd/mm/aaaa}, com os filtros aplicados. (com uma semana: "1 semana") |
| aviso: notas, só quando é o caso | As semanas entram inteiras, de domingo a sábado. · As semanas que ainda não começaram não entram. |
| aviso: filtros | Outros filtros · os textos dos chips aplicados, sem "De" e "Até" · Busca: “{texto}” (por último) · sem nenhum: Nenhum |
| aviso: dados | Os dados vão sair do sistema. Guarde a planilha com cuidado. |
| aviso: ações | Exportar planilha · Cancelar |
| sem período | Para exportar, informe o período (De e Até) ou use um atalho de semana. |
| mais de 13 semanas | A exportação aceita até 13 semanas. Diminua o período. |
| período que não começou | O período escolhido ainda não começou. Escolha um período até esta semana. |
| gerando | Gerando a planilha… · aos 3 s sem resposta: Ainda gerando a planilha. Isso pode levar alguns segundos. |
| sem linhas | Nenhuma célula para exportar com estes filtros. |
| sucesso | Planilha exportada. · {arquivo} · {N} linhas (com uma: 1 linha) · Se o arquivo não abriu, procure nos arquivos baixados pelo navegador. · Baixar de novo · leitor de tela: Baixar de novo a planilha {arquivo} · só se o navegador não baixar sozinho (AQ-4 da UX): Baixar planilha |
| falha | Não foi possível exportar a planilha. Verifique a conexão e tente de novo. · Tentar de novo |
| sem permissão (tela e API) | Você não tem permissão para esta ação. · na tela, com o botão Fechar |
| tela de Funções | Rótulo: Exportar Relatórios de Células · Dica: Baixa a planilha dos relatórios, com as células sem relatório, só do que a pessoa vê. · Aviso, quando falta a lista de Relatórios: Para valer, a função também precisa de uma permissão que mostre Relatórios. |
| nome do arquivo | Relatorios_{aaaa-mm-dd}_a_{aaaa-mm-dd}.xlsx |
| abas | Relatórios · Informações |
| colunas da aba "Relatórios" | Semana · Célula # · G12 · Líder · Endereço · Bairro · Situação · Data/Hora · Oferta · Nº de participantes · Nº de visitantes · Observações · Célula excluída |
| valores da Situação | Célula realizada · Não houve célula · Relatório não enviado · Ainda não ocorreu |
| valores especiais | Pastores · — · Sim (Célula excluída) |
| aba "Informações" | Período: {dd/mm/aaaa} a {dd/mm/aaaa} ({N} semanas, ou 1 semana) · Filtros: {textos dos chips}, um por linha, e Busca: “{texto}”, ou Nenhum · Gerada por {Nome} · Gerada em {dd/mm/aaaa} às {HH:mm} (horário de Brasília) · A planilha tem só o que {Nome} vê no sistema. |
| aba "Informações": Situação | Célula realizada: o relatório da semana foi enviado, e a célula se reuniu. · Não houve célula: o relatório da semana foi enviado com "Não houve célula". · Relatório não enviado: a reunião da semana já passou, e o relatório não foi enviado. · Ainda não ocorreu: só na semana atual; a reunião ainda não aconteceu. |
| Auditoria | Ação: Exportação · Entidade: Relatório · Descrição: Exportou a planilha de relatórios de {dd/mm/aaaa} a {dd/mm/aaaa} ({N} linhas, ou 1 linha) · segunda linha: os filtros, até 3, separados por "; ", e "e mais {N}", ou Sem filtros · detalhes: Semanas, Filtros (ou Nenhum) e Linhas |

### Telas que mudam
- **Lista de Relatórios:**
  - a ação "Exportar para Excel", na linha do total, para quem pode exportar (RN-01, RN-02);
  - o aviso "Exportar a planilha?" antes de gerar, com as semanas, as notas, os outros filtros (com a busca) e o aviso dos dados (RN-03);
  - o andamento, que não pode ser cancelado, e a falha com "Tentar de novo", no próprio aviso (RN-13);
  - embaixo da ação, o resultado: "Planilha exportada.", com o nome do arquivo, as linhas, a dica e "Baixar de novo"; a planilha sem linhas; e as recusas de período (RN-03, RN-13).
- **Funções:** a permissão nova "Exportar Relatórios de Células", no grupo "Relatórios", com a dica e o aviso quando falta a lista de Relatórios (RN-01).
- **Auditoria:** a ação nova "Exportação", da entidade "Relatório", com a segunda linha dos filtros e os detalhes do evento (RN-11).
- Nenhuma tela nova. Membros, Células, o detalhe da célula, o Dashboard, Ministérios, o menu e os formulários não mudam. O número da célula não aparece nas telas (Q-6).

### Fora de escopo
Cada item indica o passo que cuida dele, quando há um.
- **Filtros, atalhos de semana e a lista de Relatórios** (REL-13): E2.12. Este passo só usa os filtros aplicados.
- **Retrato, oferta e participantes automáticos** (REL-07, REL-09, REL-12): E2.11.
- **Situação do relatório por célula** (CEL-05): E2.09. A Situação da planilha usa as definições de lá, mas é por semana.
- **Escopo e funções:** E2.02. **G12:** E2.06. **Auditoria:** E2.05.
- **Mostrar o número da célula nas telas** (lista e detalhe de Células): sem passo; ver Q-6.
- **Colunas a mais** (tema, tipo, dia e horário, timóteo, anfitrião, cidade): fora, como no legado; ver Q-5.
- **Totais na planilha** (por G12 ou da planilha inteira): fora; a planilha permite somar. Ver Q-8.
- **Escolher as colunas, salvar modelos de planilha, agendar ou enviar a planilha por e-mail:** sem passo no plano.
- **CSV, PDF e impressão:** sem passo no plano.
- **Exportar Membros, Células ou a Auditoria:** sem passo no plano (E2.05 e E2.07 já deixam de fora).
- **Gráficos na planilha:** sem passo no plano.
- **Dashboard:** E2.14. A planilha não muda nenhum card.
- **Consolidação:** feature futura. Os visitantes continuam nomes livres e só aparecem como número.

### Impactos em outros passos
Pontos de negócio que outros passos precisam respeitar. O `architect` decide como.
- **E2.02:**
  - a tabela de rótulos (RN-22 de lá) ganha a linha "Exportar Relatórios de Células", com a dica dos Textos de tela. Na tela de Funções, ela fica no grupo "Relatórios", logo depois das duas "Visualizar Relatórios…", com o aviso quando falta a lista de Relatórios (P-EXP-30, que segue o P121 da UX);
  - a função Líder passa a ter a permissão, e a Membro não; a Administrador já tem todas;
  - a tabela "O que muda para quem usa o sistema" ganha: a Líder exporta, no escopo; quem vem do legado como `AppUser` (Membro) não exporta.
- **E2.05:**
  - a Auditoria ganha a ação "Exportação", da entidade "Relatório", logo depois de "Restauração" no filtro "Ação" (RN-20 de lá: legível, com as semanas, os filtros com a busca e o número de linhas; P-EXP-29). O filtro "Entidade: Relatório" passa a trazer também as exportações;
  - na RN-17 de lá, a exportação entra no prazo de 2 anos;
  - o "Ver histórico" (RN-19 de lá) não mostra exportações.
- **E2.08:** o cadastro de célula passa a dar o número da célula (RN-14), sem campo no formulário. Inativar, reativar e editar não mudam o número.
- **E2.09:** a Situação da semana atual e as semanas que contam (RN-04 e RN-06 de lá) são usadas para até 13 semanas seguidas, em qualquer ponto do histórico, e não só nas 5 semanas que o E2.09 olha.
- **E2.10:** se a resposta da Q-6 for mostrar o número, o detalhe e a lista de Células ganham o número da célula.
- **E2.12:**
  - a lista de Relatórios ganha a ação "Exportar para Excel" e o aviso das semanas. Os filtros, os chips e a URL não mudam;
  - os textos dos chips também vão para a aba "Informações" e para o evento.
- **E2.01:** a recomendação "Célula excluída" (Impactos de lá) fica atendida pela coluna "Célula excluída".
- **E2.11:** a recomendação de ordenar pelo líder atual da célula não foi seguida (P-EXP-10). A diferença entra na lista do E5.04.
- **E4.06:** o número da célula do legado é o `Id` dele (5.5, `Cells → cells`, que já leva o `Id` para `legacy_id`). As células do novo não podem ter números que colidam com os do legado (RN-14).
- **E4.09 e 5.6:** a reconciliação ganha a linha "planilha da semana de referência, legado × novo, pela mesma pessoa", com as diferenças esperadas do E5.04.
- **E5.04 (homologação):** a planilha do novo e a do legado não são iguais, e isto é esperado:
  - as colunas "Semana" e "Célula excluída" e a aba "Informações" são novas;
  - os valores da Situação não têm ponto final, "Relatório não entregue." passa a "Relatório não enviado", e a semana atual tem "Ainda não ocorreu";
  - os nomes vêm completos, e não só o primeiro e o último nome;
  - o G12 de pastor é "Pastores", e o de quem está sem liderança é "—";
  - a Data/Hora e a Oferta são valores de planilha, e "Não houve célula" não tem oferta nem números;
  - a ordem é alfabética pelo G12 e pelo líder;
  - com várias semanas, o novo tem uma linha por célula em cada semana, e o legado tem uma linha por célula;
  - só entram como "Relatório não enviado" as células que contavam na semana: a célula cadastrada depois, a inativa e a excluída não entram;
  - os relatórios de célula excluída entram, com "Célula excluída: Sim";
  - o Líder e o G12 das linhas de relatório vêm do retrato (diferente só quando a célula trocou de líder depois do relatório);
  - o Período do novo cobre semanas completas e compara só as datas de Brasília, e o legado comparava data e hora;
  - o escopo é o do E2.02, com as diferenças já listadas lá.
- **Consolidação:** quando existir, o spec dela diz se o consolidado entra no número de participantes. Os visitantes continuam nomes livres.
- **Aceite (PO):**
  - no `docs/migracao.md`: REL-14 em ✅; o E2.13 marcado na seção Progresso; a linha nova da 5.6;
  - no `CLAUDE.md`: a linha "Exportação dos relatórios para Excel" da matriz de paridade em ✅; em "Novo: estado atual", a exportação na lista de Relatórios, a permissão nova (a contagem do enum `permission_action` muda) e o número da célula.

### Pontos para o `architect`
Não são dúvidas de negócio. São pontos em que a regra depende de uma escolha técnica.
1. **Um caminho só no servidor** (RN-01, RN-10, RN-11).
   - A conferência da permissão, o escopo, o cálculo das linhas e a gravação do evento acontecem numa operação só.
   - A planilha pode ser montada no servidor (Edge Function) ou no aparelho, como a REL-14 deixa em aberto. Em qualquer caso, os dados só saem junto com o evento gravado.
   - Ler as views das listas pela API não é exportação e não gera evento.
2. **Linhas** (RN-04, RN-05).
   - São os relatórios visíveis (pelo retrato) mais as células visíveis, semana a semana.
   - O relatório que quem exporta não vê só entrega a Situação, como na situação do E2.09, sem vazar nada dele.
   - A Situação da semana atual precisa ser exatamente a do E2.09, com o mesmo cálculo (RN-12).
3. **Semanas que contam** (RN-04). O E2.09 guarda quando a célula foi cadastrada, inativada, reativada, excluída e restaurada, e olha 5 semanas. A exportação precisa disso para até 13 semanas seguidas, em qualquer ponto do histórico, inclusive antes da publicação do E2.09 (regra das células que já existiam, RN-06 de lá).
4. **Filtros** (RN-07). Os mesmos do E2.12, de preferência pelo mesmo código, com a regra das linhas sem relatório. A pessoa e a célula indisponíveis não podem trazer linhas nem revelar nada.
5. **G12 e ordem** (RN-06, RN-08). O G12 vem de `g12_id` (E2.06). A ordem alfabética é de pt-BR, sem diferenciar maiúsculas e acentos, e estável.
6. **Fuso** (RN-03, RN-05). As semanas, o prazo e a Data/Hora em `America/Sao_Paulo`, pelo `sp_now()`, nunca pelo relógio do aparelho.
7. **Volume** (RN-13). Até 1.500 células × 13 semanas, em até 10 s. Se a planilha for montada no aparelho, considerar o celular simples e o 3G.
8. **Planilha** (RN-09).
   - Datas e moeda como valores, com o formato de exibição.
   - Texto digitado sempre como texto, sem virar fórmula.
   - A aba "Relatórios" ativa ao abrir, a primeira linha congelada e com filtro, larguras com limite e quebra de linha nos textos longos (P-EXP-31; AQ-9 da UX).
   - A biblioteca escolhida precisa ter licença que permita o uso pela igreja.
9. **Número da célula** (RN-14).
   - Coluna nova, dada pelo servidor, protegida como a autoria (RN-03 do E2.05).
   - A sequência do novo precisa começar acima de qualquer número que o legado possa dar até o cutover, porque o legado continua cadastrando células até lá.
   - As células que já existem no novo recebem números na publicação.
10. **Permissão nova** (RN-01). Um valor novo em `permission_action`, no catálogo do E2.02 (rótulo, dica, grupo), concedido à Líder pela migration. A Administrador já recebe todas. Conferir o que a RN-22 do E2.02 diz das permissões ativas.
11. **Evento** (RN-11). Um tipo novo de evento (ação "Exportação", entidade "Relatório"), gravado pelo servidor, sem os dados da planilha, no prazo de 2 anos do E2.05. Ele guarda os textos dos filtros e da busca como estavam na exportação, e o número de linhas que a tela mostra no sucesso (AQ-8 da UX). "Baixar de novo" não chama o servidor (P-EXP-28).
12. **Ordem dos passos.** Este passo usa: o E2.01; o escopo e o catálogo de permissões do E2.02; a Auditoria do E2.05; o G12 do E2.06; a célula inativa do E2.08; a situação e as semanas que contam do E2.09; o retrato do E2.11; e os filtros do E2.12. Entra depois do E2.12.

### Perguntas em aberto

> **Decididas pelo usuário (2026-11-28):** **Q-1** permissão nova "Exportar Relatórios de Células" (Administrador e Líder têm, Membro não; a recomendação). **Q-2** uma linha por célula em cada semana do período (a recomendação). **Q-4** os **textos novos do sistema** (os rótulos das telas novas, como o padrão do spec: "Relatório não enviado"…), e não os do legado: a RN-05 fica como estava, e a homologação (E5.04) trata a Situação como diferença esperada de texto. **Q-7** líder e G12 registrados no relatório (o retrato, como a lista; a recomendação). Q-3, Q-5, Q-6 e Q-8 seguem as recomendações (não bloqueiam).

Cada pergunta já tem um padrão adotado. **Desde a revisão de 2026-11-28**, Q-1, Q-2, Q-4 e Q-7 (as que se afastam do legado) precisam de resposta do usuário antes da Solução técnica, e a recomendação da Q-4 mudou para os textos do legado (ver [Revisão de 2026-11-28](#revisão-de-2026-11-28-e212-entregue)); as outras valem se o usuário não decidir outra coisa no PR. Os padrões que mais mudam o resultado são:
- **P-EXP-01:** exportar exige a permissão nova, que a Líder tem e a Membro não.
- **P-EXP-06:** com várias semanas, a planilha tem uma linha por célula em cada semana.
- **P-EXP-07:** só entram como "Relatório não enviado" as células que contavam na semana.
- **P-EXP-10:** o Líder e o G12 das linhas de relatório vêm do retrato, e não do líder atual da célula.
- **P-EXP-17:** cada planilha entregue gera um evento na Auditoria.
- **P-EXP-19:** as células cadastradas no novo ganham um número.

- **Q-1. Quem exporta?**
  - **Padrão adotado:** quem tem "Exportar Relatórios de Células" e a lista de Relatórios. A Líder tem, a Membro não (P-EXP-01).
  - **Alternativa:** todos que têm a lista de Relatórios, sem permissão nova, como a API do legado.
- **Q-2. Período de mais de uma semana.**
  - **Padrão adotado:** uma linha por célula em cada semana, com a coluna "Semana" (P-EXP-06).
  - **Alternativa:** a planilha aceita só uma semana. Para um mês, exportam-se as semanas uma a uma.
- **Q-3. Limite de semanas.**
  - **Padrão adotado:** 13 semanas, um trimestre (P-EXP-05).
  - **Alternativa:** 53 semanas, um ano inteiro. A planilha da igreja toda chega a 80 mil linhas e demora mais para ser gerada.
- **Q-4. Textos da Situação.**
  - **Padrão adotado:** "Célula realizada", "Não houve célula", "Relatório não enviado" e "Ainda não ocorreu", sem ponto final (P-EXP-08).
  - **Alternativa:** os textos do legado, como estão: "Relatório não entregue.", "Não houve célula." e "Célula realizada.", sem "Ainda não ocorreu". Quem tem planilhas próprias que procuram esses textos não precisaria mudá-las.
- **Q-5. Colunas a mais.**
  - **Padrão adotado:** as colunas do legado, mais "Semana" e "Célula excluída".
  - **Alternativa:** acrescentar o tema, o tipo, o dia e o horário da reunião, o timóteo e o anfitrião (o legado chegou a prever os dois últimos) ou a cidade. Diga quais.
- **Q-6. Número da célula.**
  - **Padrão adotado:** toda célula tem um número, que aparece só na planilha (P-EXP-19).
  - **Alternativa A:** mostrar o número também na lista e no detalhe de Células, como a lista do legado ("#").
  - **Alternativa B:** sem número no novo. A coluna "Célula #" sai, e a célula é identificada pelo líder e pelo endereço.
- **Q-7. Líder e G12 das linhas de relatório.**
  - **Padrão adotado:** do retrato, como na lista de Relatórios (P-EXP-10).
  - **Alternativa:** do líder atual da célula, como no legado e como o E2.11 recomendou. Para quem só vê relatórios, o G12 atual de uma célula que ele não vê ficaria de fora ("—").
- **Q-8. Totais na planilha.**
  - **Padrão adotado:** sem totais, como no legado. A planilha permite somar (P-EXP-14).
  - **Alternativa:** uma linha de total por G12 e uma no fim (relatórios enviados, ofertas, participantes e visitantes).

### Revisão de 2026-11-28 (E2.12 entregue)
_Feita pelo `product-owner` depois do aceite provisório do E2.12. Não muda nenhuma RN; muda o peso de quatro perguntas._

**Conferência com o E2.12 em produção** (mci-connect#64 a #66; divergências nas seções de implementação daquele spec, nenhuma muda regra):
- os filtros da RN-02 e da RN-07 existem como o Negócio previa: busca (líder registrado e tema), Célula (só por link), Líder e G12 pelo retrato (até 10 cada), Período pelas datas de Brasília, Tipo registrado e Reunião, com o par `private.cell_report_filter_normalize`/`private.cell_report_filter_sql`, que o E2.12 deixou para reuso aqui;
- "hoje" e as semanas da RN-03 têm fonte no servidor (`server_weeks()`), e os textos dos chips do aviso, da aba "Informações" e do evento já existem no módulo de filtros de Relatórios;
- o E2.12 manteve o Período por datas (Q-3 de lá): a exportação continua lendo "De" e "Até" aplicados.

**Divergências do legado: precisam de resposta do usuário antes da Solução técnica.** As perguntas abaixo continuam com padrão adotado, mas Q-1, Q-2, Q-4 e Q-7 mudam o resultado em relação ao legado e não seguem para o `architect` sem uma resposta explícita (as demais continuam não bloqueantes):
- **Q-1 (quem exporta):** recomendação mantida (P-EXP-01). Na prática ela reproduz o legado: só o administrador do legado tinha Relatórios no menu, e ele vira a Líder (6.5 do `docs/migracao.md`).
- **Q-2 (várias semanas):** falta, entre as alternativas, o **comportamento do legado**: uma linha por célula no período inteiro, com o último relatório dela no período (`ColumnFormatter.cs:23-33`). Recomendação mantida: uma linha por célula em cada semana (P-EXP-06), porque no legado um período de quatro semanas esconde três relatórios de cada célula. Para uma semana só, as duas formas dão a mesma planilha.
- **Q-4 (textos da Situação):** **recomendação revista: os textos do legado**, "Célula realizada.", "Não houve célula." e "Relatório não entregue.", com o ponto final, no lugar de "Relatório não enviado" (P-EXP-08). Motivos: a homologação (RN-15) compara a Situação célula a célula, e quem tem planilhas próprias que procuram esses textos não precisa mudá-las. "Ainda não ocorreu." continua, só na semana atual, porque o legado chamava de "Relatório não entregue." a célula cuja reunião ainda não tinha acontecido. Se o usuário aceitar, mudam a RN-05, a coluna 7 de [Colunas da planilha](#colunas-da-planilha), o [Resumo das linhas](#resumo-das-linhas-de-uma-semana), a aba "Informações" e as diferenças esperadas do E5.04.
- **Q-7 (líder e G12 das linhas de relatório):** recomendação mantida, o retrato (P-EXP-10). Com o líder atual, o filtro Líder da planilha daria um resultado diferente do mesmo filtro na lista (RN-12), e o legado já usava o líder registrado na lista e nos filtros. Na homologação, a diferença aparece só nas células que trocaram de líder no período.

**Ponto novo para o `architect`** (complementa o ponto 9): a carga do E4 já criou `cells.legacy_id`, gravada só pela carga (DT-01 e DT-02 do spec E4). O "Célula #" da RN-14 é o `legacy_id` nas células do legado; as cadastradas no novo precisam de um número dado pelo servidor acima de qualquer `legacy_id` possível até o cutover. Como fazer (coluna própria ou a mesma) é decisão técnica.

## Experiência (UX)
_Seção do `ux-designer`. Escrita em 2026-11-24 a partir destas fontes:_
- _a seção Negócio (RN-01 a RN-15, P-EXP-01 a P-EXP-22, a massa de exemplo, os Textos de tela, as Telas que mudam, os Impactos, os Pontos para o `architect` e as perguntas Q-1 a Q-8);_
- _o código da `origin/main` do `mci-connect` (`4595daa`): `src/pages/CellReports.tsx` (a busca no `CardHeader`, com `p-6`), `ui/button.tsx` (`whitespace-nowrap`; o `default` tem 40 px e o `lg`, 44 px), `ui/alert.tsx` (o `Alert` já vem com `role="alert"`), `ui/alert-dialog.tsx`, `ui/card.tsx`, o `index.html` (sem manifesto de app instalável e sem `viewport-fit=cover`) e o `lucide-react` 0.462 (`FileSpreadsheet`, `Download`, `Loader2`, `CheckCircle2`, `Info`, `AlertCircle` e `TriangleAlert` existem);_
- _o que já foi desenhado para as mesmas telas: a lista de Relatórios do [E2.12](e2-12-listagem-relatorios.md) (T1 a T9 e P90; ainda sem commit, só lido), a tela de Funções do [E2.02](e2-02-perfis-escopo.md) (T2, T3, P13 e P14), a Auditoria do [E2.05](e2-05-auditoria-autor.md) (T7, T8, T10 e P32), as confirmações do [E2.01](e2-01-exclusao-logica.md) (P9), as mensagens do [E2.04](e2-04-validacoes-membro.md) (P21) e o envio do relatório do [E2.11](e2-11-lancamento-relatorio.md) (T7 e UX-29: o botão durante o envio e o "Ainda enviando…"; ainda sem commit, só lido);_
- _o legado, só para manter o que os usuários conhecem: o link "Baixar relatórios", com o ícone do Excel, logo acima da lista e com os filtros da tela (`UI/components/Grid/index.js:37-41` e `UI/pages/Report/index.js:121-127`)._

_Este passo entra depois do E2.12, então o desenho parte da lista de Relatórios de lá, e não do código de hoje. Usa os padrões dos specs anteriores, citados onde valem. Os padrões novos começam em P120, para não colidir com os specs desenhados em paralelo. Nenhuma regra de negócio foi criada aqui. Onde a tela precisou de algo que o spec não diz, a decisão é a mais conservadora, marcada como "definido pela UX" (ou com † nos Textos) e listada em [Pendências para o PO](#pendências-para-o-po-resolvidas-em-2026-11-24). Os nomes são os da [massa de exemplo](#massa-de-exemplo); os sobrenomes existem só nos wireframes, os mesmos do E2.12, e "…" marca o que a massa não define. "Hoje" é terça, 24/11/2026, às 21:00 de Brasília, pelo relógio do servidor._

### O que muda, tela a tela
Nenhuma rota nova e nenhum parâmetro novo na URL.

| Tela | O que muda | Para quem |
|---|---|---|
| Relatórios: linha do total (T1, T2) | Entram o botão "Exportar para Excel", logo depois do total e antes da lista, e a região onde aparece o resultado. Os filtros, os chips, os atalhos, o painel e a lista do E2.12 não mudam. | quem pode exportar (RN-01) |
| Aviso antes de gerar (T3, T4, T6), novo | Um `AlertDialog` com as semanas, os outros filtros e o aviso de que os dados vão sair do sistema. Ele também mostra o andamento e a falha. | idem |
| Resultado e recusas (T5), novo | Embaixo do botão: "Planilha exportada.", com o nome do arquivo, o número de linhas e "Baixar de novo"; "Nenhuma célula para exportar com estes filtros."; as recusas de período. | idem |
| A planilha (T8) | Recomendações para ler a planilha no celular e no computador. | idem |
| Funções (T9) | A permissão "Exportar Relatórios de Células", com a dica, no grupo "Relatórios"; um aviso quando ela não tem efeito; as contagens. | quem vê Funções |
| Auditoria (T10) | A ação "Exportação" na lista, no filtro "Ação" e no painel de detalhes. | quem tem "Visualizar Auditoria" |
| Membros, Células, detalhe da célula, Dashboard, Ministérios, menu e formulários (T11) | Sem mudança. | — |

#### O que cabe em cada largura
A linha do total fica dentro do `Card` da lista, no `CardHeader` (`p-6`). A área útil vem do `AppLayout` (`p-4` no celular e `p-6` a partir de 768 px) e do menu lateral fixo, de 256 px, a partir de 768 px.

| Largura | Área útil da linha | Total e botão | Resultado |
|---|---|---|---|
| 320 a 639 px (referência: 360) | 240 a 559 px (280 em 360) | o total numa linha; o botão na linha de baixo, alinhado à esquerda, com a largura do texto (cerca de 195 px) | caixa na largura toda, embaixo do botão |
| 640 a 1023 px | 560 px sem o menu; de 416 a 671 px com o menu fixo | na mesma linha: o total à esquerda e o botão à direita | caixa alinhada à direita, com até 28 rem (`sm:ml-auto sm:max-w-md`) |
| 1024 px ou mais | 672 px ou mais | igual. Com o painel do computador aberto (T5 do E2.12), a linha fica depois do painel | igual |

Abaixo de 640 px, o total e o botão não dividem a linha: "1.234 relatórios" e o botão pedem cerca de 326 px, e a área é de 280 px em 360. Quebrar só quando não coubesse faria o botão pular de linha a cada mudança do total.

### Coerência com os outros specs
- **E2.12:**
  - o botão entra na linha do total, que já existe ("{N} relatórios", `role="status"`), e não muda nada de lá: a busca, "Filtros", "Limpar filtros", os atalhos (P90), os chips, o painel (P50), a URL, a ordem e o cabeçalho com "Novo relatório" e "Excluídos";
  - a exportação lê os filtros aplicados, os textos dos chips e a data do servidor pelo mesmo módulo da lista (AQ-1 e AQ-2 de lá);
  - os atalhos continuam o caminho mais curto para o Período obrigatório (RN-03): eles ficam logo acima do botão, e a recusa "sem período" aponta para eles.
- **E2.11 (T7 e UX-29):** durante a geração, o botão do diálogo segue o "Enviando…" de lá: o texto de andamento, o `Loader2`, nenhum segundo pedido, o diálogo que não fecha e, aos 3 s, a linha "Ainda …". A falha fica no diálogo, com `role="alert"`, e a ação primária vira "Tentar de novo". A diferença é o `aria-disabled` no lugar do `disabled`, para o foco não se perder (P122).
- **E2.01 (P9):** o aviso antes de gerar é um `AlertDialog` de texto longo, como as confirmações de exclusão, e também não entra no histórico do navegador.
- **E2.02:**
  - Funções (T3, P14): a permissão nova é mais uma linha do grupo "Relatórios", com a dica;
  - acesso relido (P13): depois de uma recusa de permissão, a tela relê o acesso, e o botão some;
  - sem a lista de Relatórios, vale a tela sem acesso da T12 de lá.
- **E2.05 (T7, T8, T10, P32):** a Auditoria ganha a ação "Exportação" com os mesmos componentes: o cartão e a linha da tabela, a segunda linha da descrição, o filtro "Ação" e o painel com campos legíveis, sem JSON e sem identificador.
- **E2.04 (P21):** a recusa e a falha usam o estilo de erro de lá (o ícone `AlertCircle` e o texto em `text-foreground`, nunca em `text-destructive`); o aviso da tela de Funções usa o estilo de aviso (`TriangleAlert`).
- **E2.09 e E2.10:** os valores da Situação ("Ainda não ocorreu", "Relatório não enviado") e o número da célula só aparecem na planilha. Nenhuma tela os mostra neste passo (Q-6).
- **Legado:** a ação continua logo acima da lista e segue os filtros da tela, como o "Baixar relatórios". Mudam o nome (Textos de tela do Negócio), a confirmação antes de gerar e o resultado na tela.

### Decisões de experiência
| # | Decisão | Por quê |
|---|---|---|
| UXD-1 | **"Exportar para Excel" fica na linha do total, depois dos filtros e dos chips e antes da lista, e não no cabeçalho da página.** | A planilha segue os filtros aplicados (RN-02). Logo depois deles e do total, a ação se lê como "exportar isto". No cabeçalho, ela competiria com "Novo relatório", a ação mais frequente do líder, e com "Excluídos", e ficaria longe dos filtros que a definem. No legado, o link também ficava logo acima da lista. Quem não exporta não vê nada novo. |
| UXD-2 | **É um botão secundário (`outline`), com o ícone de planilha e a largura do texto, também no celular.** | A ação é semanal, para a liderança. Em largura toda, ela pesaria como a ação principal da tela. Com o ícone `FileSpreadsheet`, quem usava o link com o ícone do Excel no legado a reconhece. |
| UXD-3 | **As recusas que a tela já sabe (sem período, mais de 13 semanas, período que não começou) aparecem embaixo do botão, sem abrir o diálogo, e o foco continua no botão.** | O conserto está logo acima: os atalhos de semana. Um diálogo só para dizer "não" custaria um toque para fechar e esconderia os atalhos. A mensagem sai sozinha quando os filtros aplicados mudam. |
| UXD-4 | **Antes de gerar, um `AlertDialog` (P9) diz as semanas, os outros filtros (com os textos dos chips e a busca) e o aviso dos dados. O botão é "Exportar planilha".** | RN-03 manda dizer as semanas antes de gerar. No celular, os chips podem estar fora da tela, e o painel fica fechado: o aviso é o único lugar em que a pessoa confere o que vai sair. "Exportar" sozinho não diz o objeto (verbo e objeto, como "Enviar relatório"). |
| UXD-5 | **O andamento fica no próprio diálogo, que não fecha até a resposta, como o envio do relatório (E2.11).** Aos 3 s, aparece "Ainda gerando a planilha. Isso pode levar alguns segundos." | A atenção da pessoa está no diálogo. Ela vê o andamento onde tocou, e não precisa procurá-lo na página. Até 10 s é uma espera curta para ficar no mesmo lugar (RN-13). Cancelar no meio deixaria um evento sem planilha entregue, e o E2.11 já ensinou que "Enviando…" não se interrompe. |
| UXD-6 | **O resultado (sucesso, planilha sem linhas e recusas) fica na página, numa região `role="status"` embaixo do botão, e não num toast.** | O toast some sozinho e, no celular, cobre o rodapé. O resultado precisa ficar à vista ao lado da ação, com o nome do arquivo e "Baixar de novo". A região existe no DOM antes da mensagem, então o leitor de tela a anuncia uma vez, sem depender do toast. |
| UXD-7 | **A falha e as recusas do servidor ficam no diálogo: na falha, "Tentar de novo"; na recusa, só "Fechar".** | Na falha, a pessoa tenta de novo com um toque, sem perder as semanas e os filtros conferidos. A recusa do servidor depois de confirmar é rara (a permissão foi tirada naquele momento) e precisa de leitura antes de fechar. |
| UXD-8 | **Ao terminar, a tela entrega o arquivo ao navegador e oferece "Baixar de novo", com o mesmo arquivo, sem gerar outro.** A tela promete que a planilha foi gerada, com o nome e as linhas, e não promete onde o arquivo fica nem que ele abriu (T7). | No iPhone, o Safari pergunta se a pessoa quer ver ou baixar. Quem toca em "Ver" e depois quer guardar não deveria esperar outra geração nem gerar outro evento. Onde o arquivo fica depende do aparelho e do navegador, e a tela não tem como saber. |
| UXD-9 | **O resultado sai quando os filtros aplicados mudam, numa exportação nova e ao sair da tela.** | Um "Planilha exportada." ao lado de outra lista faria a pessoa achar que a planilha é da lista nova. |
| UXD-10 | **O nome acessível do botão é o texto visível, "Exportar para Excel", com a descrição "Gera a planilha dos relatórios com os filtros aplicados." O texto do Negócio para o leitor de tela ("Exportar os relatórios para Excel") vira a descrição.** | Pela WCAG 2.5.3, o nome acessível contém o texto visível, na mesma ordem. "Exportar os relatórios para Excel" separa "Exportar" de "para Excel", e quem usa comando de voz diz o que vê. Ver PO-UX-1. |
| UXD-11 | **Na tela de Funções, a permissão fica logo depois das duas "Visualizar Relatórios…", e, quando a função não tem nenhuma permissão que dê a lista de Relatórios, um aviso diz que ela não tem efeito (P121).** | Exportar é uma forma de ver os relatórios. Ao lado das permissões de ver, fica claro que ela depende delas. Pela RN-01, uma função só com a exportação não exporta nada, e quem configura não teria como descobrir isso pela tela. |
| UXD-12 | **Na Auditoria, a exportação é da entidade "Relatório", a segunda linha mostra os filtros, e o painel tem "Semanas", "Filtros" e "Linhas", sem "Registro" e sem "Ver histórico".** | É a entidade que a pessoa procura ("quem mexeu nos relatórios"). Sem registro alterado, o painel não tem o que pôr em "Registro", e a RN-11 tira a exportação do histórico de qualquer registro. |

### Navegação e rotas
- Nenhuma rota nova e nenhum parâmetro novo. Exportar não muda a URL, a página, os filtros nem o histórico do navegador (RN-02).
- O aviso não entra no histórico do navegador, como as confirmações do E2.01. O voltar do aparelho, com o aviso aberto, faz o que faz nas outras confirmações e sai da tela; durante a geração, isso cancela o pedido (AQ-5).
- O resultado não fica guardado: ele não volta ao recarregar a página nem ao voltar para a tela.

### Fluxos
Contagem no celular, a partir de qualquer tela com o menu fechado, incluindo o toque no ☰, salvo quando a linha diz outra coisa. "Toque" não conta a digitação nem a rolagem.

| # | História | Caminho | Toques e telas |
|---|---|---|---|
| F1 | A liderança baixa a planilha da semana passada (Pedro, celular) | ☰ → Relatórios → "Semana passada" → "Exportar para Excel" → "Exportar planilha" → "Planilha exportada." | 5 toques; 1 tela e 1 diálogo. No iPhone, +1 (o Safari pergunta se baixa ou mostra). No legado, só para administradores: ☰ → Células → "Relatórios da semana passada" → "Baixar relatórios", 4 toques, sem aviso. |
| F2 | O pastor entrega a cada G12 a parte dele (Samuel) | F1. A planilha já vem ordenada por G12 (RN-08), e cada G12 se separa pelo filtro da própria planilha (T8) | 5 toques |
| F3 | A secretaria baixa várias semanas (Rita, computador) | Relatórios → "Filtros" (se o painel estiver fechado) → De → Até → "Exportar para Excel" → "Exportar planilha" | 5 cliques e a digitação das datas |
| F4 | O G12 exporta com os filtros que já aplicou (Pedro) | lista filtrada → "Exportar para Excel" → confere os filtros no aviso → "Exportar planilha" | 2 toques |
| F5 | Esqueceu o período | "Exportar para Excel" → lê a recusa → "Semana passada", logo acima → "Exportar para Excel" → "Exportar planilha" | 4 toques |
| F6 | A planilha de uma célula, pelo detalhe dela (Pedro, C1) | detalhe de C1 → "Ver todos os relatórios" → "Semana passada" → "Exportar para Excel" → "Exportar planilha" | 4 toques |
| F7 | Guardar de novo (tocou em "Ver" no iPhone) | "Baixar de novo" | 1 toque, sem gerar outra planilha |
| F8 | A conexão caiu | "Tentar de novo", no próprio aviso | 1 toque |
| F9 | O administrador dá a exportação a outra função (Rita, Secretaria) | ☰ → Funções → "Editar" em Secretaria → "Exportar Relatórios de Células" → "Salvar função" | 4 toques e a rolagem até o grupo "Relatórios" |
| F10 | Quem exportou e quando (Rita, computador) | Auditoria → "Ação" (`Select`) → "Exportação" → o evento | 4 cliques |

### Telas
As convenções dos wireframes são as do E2.12 (360 px ≈ 38 colunas; `[Botão]`; `(… ✕)` é um chip; `⟦…⟧` é o atalho marcado; `⌕` é `Search` e `⚲` é `SlidersHorizontal`), com estas:
- `⊞` é o `FileSpreadsheet`, `⤓` é o `Download` e `◌` é o `Loader2`;
- `✓` é o `CheckCircle2`, `ⓘ` é o `Info`, `⚠` é o `AlertCircle` e `△` é o `TriangleAlert`;
- `░` é o fundo escurecido de um diálogo.

A margem lateral é a do `AppLayout` (`p-4` no celular).

#### T1. Relatórios no celular: a ação na linha do total
360 px, com Pedro, depois de "Semana passada" e de Líder: André Souza (critério da RN-02):
```
┌──────────────────────────────────────┐
│ ☰                                    │
│ Relatórios                           │  h1 (E2.12)
│ Relatórios das células do seu        │  subtítulo (P10)
│ ministério                           │
│ [+ Novo relatório                  ] │  E2.02 (T8)
│──────────────────────────────────────│
│ Buscar                               │
│ [⌕ Líder ou tema                   ] │
│ [⚲ Filtros (2)] [Limpar filtros]     │
│ [  Esta    ]⟦  Semana  ⟧[  Semana  ] │  atalhos (P90)
│ [  semana  ]⟦  passada ⟧[ retrasada] │
│ (Líder: André Souza ✕)               │  chips (E2.12)
│ (De: 15/11/2026 ✕)                   │
│ (Até: 21/11/2026 ✕)                  │
│ 1 relatório                          │  role="status" (E2.12)
│ [⊞ Exportar para Excel]              │  P120: outline, min-h-11, w-auto
│──────────────────────────────────────│  (a região do resultado, vazia,
│ André Souza                [✎]  [⋯]  │  não ocupa espaço)
│ G12: Pedro Alves                     │  R1 (T1 do E2.12)
│ Qua, 18/11/2026 · 20:00              │
│ …                                    │
└──────────────────────────────────────┘
```
- **Lugar (UXD-1, P120):** na linha do total, que vira um contêiner `flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between`. O total vem primeiro no DOM, e o botão depois. Abaixo de 640 px, o botão fica na linha de baixo, alinhado à esquerda; a partir daí, à direita do total.
- **Botão (UXD-2):** `Button variant="outline"`, com o ícone `FileSpreadsheet` (`aria-hidden`) e o texto "Exportar para Excel".
  - Altura: `min-h-11` no celular e `md:min-h-10`, com `h-auto whitespace-normal text-left`, para o texto quebrar dentro do botão com zoom ou com a fonte grande, sem corte (o `Button` tem `whitespace-nowrap`; a mudança vai pela `className`).
  - Nome acessível: o texto visível. Descrição (`aria-describedby`): "Gera a planilha dos relatórios com os filtros aplicados." †, num `span` `sr-only`. Com uma recusa na tela, o `aria-describedby` também aponta para ela (UXD-10).
- **Quem vê (RN-01):** quem tem "Exportar Relatórios de Células" e a lista de Relatórios. Para os outros, a linha do total fica como no E2.12, sem o botão e sem a região do resultado.
- **Sempre disponível (RN-02):** o botão aparece e responde na primeira carga, na troca de página, com a lista vazia e com a lista em erro, porque a planilha não depende da lista. Ele só não responde enquanto a própria exportação está em andamento, e aí o diálogo está por cima (T4).
- **Na primeira carga:** o lugar do total fica com um `Skeleton` da altura do texto (`h-5 w-28`), para o botão não descer quando o total chegar. Na lista em erro, a linha tem só o botão, e o `Alert` da lista vem depois.
- **Região do resultado:** um `div` com `role="status"`, sempre no DOM, logo depois da linha do total e antes da lista. Vazio, ele não tem margem nem altura. O conteúdo está na T5.
- **Ordem do Tab:** a busca, "Filtros", "Limpar filtros", os atalhos, os chips, "Exportar para Excel", "Baixar de novo" (quando aparece) e a lista.
- Componentes: `Button` e `Skeleton`, que já existem.

#### T2. Relatórios no computador
1280 px, com Rita, depois de "Semana passada", com o painel fechado:
```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Relatórios                                                                        [Excluídos] [+ Novo relatório] │
│ Relatórios das células de toda a igreja                                                                          │
│──────────────────────────────────────────────────────────────────────────────────────────────────────────────────│
│ Buscar                                                                                                           │
│ [⌕ Líder ou tema                      ]  [⚲ Filtros (1) ⌄]  [Limpar filtros]                                     │
│ [Esta semana] ⟦Semana passada⟧ [Semana retrasada]                                                                │
│ (De: 15/11/2026 ✕)  (Até: 21/11/2026 ✕)                                                                          │
│ 2 relatórios                                                                             [⊞ Exportar para Excel] │  mesma linha
│ Célula               │ Data e horário  │ Reunião              │ Participantes │ Visitantes │ Oferta    │ Ações   │
│ Jonas Prado          │ Sex, 20/11/2026 │ [✓ Célula realizada] │             6 │          1 │  R$ 30,00 │     [⌫] │
│ …                                                                                                                │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```
Com o painel aberto, em 1024 px (T5 do E2.12), a linha fica depois do painel:
```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ …                                                                                            │
│ Período                                        Tipo                   Reunião                │
│ De                      Até                    [Evangelística     ▾]  [Célula realizada  ▾]  │
│ [15/11/2026          ]  [21/11/2026        ]                                                 │
│ 1 relatório                                                          [⊞ Exportar para Excel] │
│ …                                                                                            │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```
- O mesmo botão da T1, na mesma linha do total, à direita. Nada muda entre os cartões (até 1279 px) e a tabela (a partir de 1280 px, P74), porque a linha fica fora da lista.
- O botão nunca entra no painel de filtros: o painel define o que é aplicado, e a ação usa o que já foi aplicado (RN-02).

#### T3. Aviso antes de gerar
Celular (360 px), com Pedro, De 20/11/2026 e Até 24/11/2026 e Líder: André Souza aplicados (critério da RN-03, com o Líder a mais):
```
┌──────────────────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░┌──────────────────────────────────┐░│
│░│ Exportar a planilha?             │░│  AlertDialogTitle (h2) †
│░│                                  │░│
│░│ A planilha terá 2 semanas, de    │░│  frase do Negócio (RN-03)
│░│ 15/11/2026 a 28/11/2026, com os  │░│
│░│ filtros aplicados.               │░│
│░│ As semanas entram inteiras, de   │░│  só quando o Período aplicado
│░│ domingo a sábado.                │░│  não é de semanas inteiras †
│░│                                  │░│
│░│ Outros filtros                   │░│  dt †
│░│ • Líder: André Souza             │░│  textos dos chips, sem De e Até
│░│                                  │░│
│░│ ┌──────────────────────────────┐ │░│
│░│ │ ⓘ Os dados vão sair do       │ │░│  aviso do Negócio
│░│ │ sistema. Guarde a planilha   │ │░│
│░│ │ com cuidado.                 │ │░│
│░│ └──────────────────────────────┘ │░│
│░│ [Exportar planilha             ] │░│  ação primária, min-h-11 †
│░│ [Cancelar                      ] │░│  recebe o foco ao abrir (Radix)
│░└──────────────────────────────────┘░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
└──────────────────────────────────────┘
```
Variações do corpo:
```
"Semana passada", sem outros filtros     De 22/11/2026 e Até 12/12/2026
┌──────────────────────────────────┐     ┌──────────────────────────────────┐
│ A planilha terá 1 semana, de     │     │ A planilha terá 1 semana, de     │
│ 15/11/2026 a 21/11/2026, com os  │     │ 22/11/2026 a 28/11/2026, com os  │
│ filtros aplicados.               │     │ filtros aplicados.               │
│                                  │     │ As semanas que ainda não         │  †
│ Outros filtros                   │     │ começaram não entram.            │
│ Nenhum                           │     │                                  │
└──────────────────────────────────┘     │ Outros filtros                   │
                                         │ Nenhum                           │
                                         └──────────────────────────────────┘
Com a busca e vários filtros (Rita)
┌──────────────────────────────────┐
│ Outros filtros                   │
│ • Célula de André Souza · Quarta │  na ordem dos chips (UXD-2 do E2.12)
│   · 20:00                        │
│ • Líder: André Souza             │
│ • G12: Pedro Alves               │
│ • Tipo: Evangelística            │
│ • Reunião: Célula realizada      │
│ • Busca: "fé"                    │  a busca por último (PO-UX-2) †
└──────────────────────────────────┘
```
Computador (a partir de 640 px): o mesmo conteúdo, num diálogo de até 32 rem (`sm:max-w-lg`), com "Cancelar" e "Exportar planilha" lado a lado, alinhados à direita.

- **Contêiner (P9):** `AlertDialogContent` com `w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto rounded-lg`, cabeçalho `text-left` e a descrição `asChild` com um `div`, porque o conteúdo tem lista. A descrição usa `text-foreground` pela `className`, no lugar do `text-muted-foreground` do componente, porque é o conteúdo que a pessoa confere. O leitor de tela ouve o título e toda a descrição ao abrir.
- **Semanas (RN-03):** a frase do Negócio, com "1 semana" ou "{N} semanas" e as datas do domingo da primeira e do sábado da última, calculadas pela data do servidor (AQ-1). Depois dela, só quando for o caso, as notas †:
  - "As semanas entram inteiras, de domingo a sábado.", quando "De" não é um domingo ou "Até" não é um sábado;
  - "As semanas que ainda não começaram não entram.", quando "Até" passa da semana atual;
  - as duas, quando as duas coisas acontecem.
- **Outros filtros †:** uma `dl`, com "Outros filtros" no `dt` e, no `dd`, uma `ul` com os textos dos chips aplicados (Textos de tela do E2.12), na ordem dos chips, sem "De" e "Até", que a frase já diz, e com "Busca: “{texto}”" por último, quando houver busca (PO-UX-2). Sem nenhum: "Nenhum". Os itens quebram linha, sem `truncate`.
- **Aviso dos dados (Negócio):** numa caixa `rounded-md bg-muted/50 p-3`, com o ícone `Info` (`aria-hidden`) e o texto em `text-sm text-foreground`.
- **Botões:** "Cancelar" (`AlertDialogCancel`, `outline`) e "Exportar planilha" † (a ação primária, `default`), com `min-h-11` no celular. Abaixo de 640 px, eles ficam um embaixo do outro, em largura toda, com "Exportar planilha" em cima (o `AlertDialogFooter` e o `mt-2` do `AlertDialogCancel` já fazem isso); a partir daí, lado a lado, à direita.
  - "Exportar planilha" é um `Button` comum, e não o `AlertDialogAction`, que fecha o diálogo ao clicar: o diálogo precisa ficar aberto durante a geração (T4).
- **Abrir não exporta:** abrir o aviso não pede a exportação. Quando a data de hoje ainda não chegou, a tela a lê antes de abrir o aviso (AQ-1). "Cancelar", `Esc` e o voltar do aparelho fecham sem exportar, e o foco volta a "Exportar para Excel".
- Componentes: `AlertDialog` e `Button`, que já existem.

#### T4. Gerando
Celular, logo depois de "Exportar planilha" e aos 3 s sem resposta:
```
Logo depois de tocar                     Aos 3 s sem resposta
┌──────────────────────────────────┐     ┌──────────────────────────────────┐
│ Exportar a planilha?             │     │ Exportar a planilha?             │
│ A planilha terá 1 semana, de …   │     │ A planilha terá 1 semana, de …   │
│ …                                │     │ …                                │
│ ┌──────────────────────────────┐ │     │ ┌──────────────────────────────┐ │
│ │ ⓘ Os dados vão sair …        │ │     │ │ ⓘ Os dados vão sair …        │ │
│ └──────────────────────────────┘ │     │ └──────────────────────────────┘ │
│                                  │     │ Ainda gerando a planilha. Isso   │  role="status" †
│                                  │     │ pode levar alguns segundos.      │
│ [◌ Gerando a planilha…         ] │     │ [◌ Gerando a planilha…         ] │  aria-disabled, com o foco
│ [Cancelar                      ] │     │ [Cancelar                      ] │  aria-disabled
└──────────────────────────────────┘     └──────────────────────────────────┘
```
- **Botão (P122, RN-13):** "Exportar planilha" passa a "Gerando a planilha…", com o `Loader2` (`aria-hidden`, `animate-spin motion-reduce:animate-none`). Ele e "Cancelar" recebem `aria-disabled="true"` e ignoram toques e teclas, em vez de `disabled`: o botão desabilitado perde o foco, e o leitor de tela perderia o lugar. Um segundo toque não faz outro pedido.
- **O diálogo não fecha (UXD-5):** `Esc`, "Cancelar" e o toque fora não fazem nada até a resposta, como no envio do relatório (E2.11): o `onOpenChange` ignora o fechamento e o `onEscapeKeyDown` chama `preventDefault()` enquanto a geração está em andamento. O voltar do aparelho sai da tela e cancela o pedido (AQ-5).
- **Anúncios:** uma região `role="status"` acima dos botões, já no DOM, recebe "Gerando a planilha…" em `sr-only` logo depois do toque e, aos 3 s sem resposta, o texto visível "Ainda gerando a planilha. Isso pode levar alguns segundos." †, em `text-sm text-muted-foreground`. O leitor ouve cada um uma vez.
- **Tempo-limite (AQ-2):** sem resposta no prazo, vale a falha (T6).
- **O que fica:** as semanas, os filtros e o aviso continuam à vista, porque a pessoa pode reler o que está saindo.

#### T5. Resultado na página
Embaixo do botão, na região `role="status"` da T1. Celular (360 px):
```
Sucesso (Rita, "Semana passada")         Sem linhas (Rita, "Semana passada" e
                                         Reunião: Não houve célula)
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ 2 relatórios                         │ │ 0 relatórios                         │
│ [⊞ Exportar para Excel]              │ │ [⊞ Exportar para Excel]              │  o foco volta aqui
│ ┌──────────────────────────────────┐ │ │ ┌──────────────────────────────────┐ │
│ │ ✓ Planilha exportada.            │ │ │ │ ⓘ Nenhuma célula para exportar   │ │
│ │   Relatorios_2026-11-15_a_2026-  │ │ │ │   com estes filtros.             │ │
│ │   11-21.xlsx · 5 linhas          │ │ │ └──────────────────────────────────┘ │
│ │   Se o arquivo não abriu, procure│ │ │──────────────────────────────────────│
│ │   nos arquivos baixados pelo     │ │ │ Nenhum relatório encontrado com      │  vazio da lista (E2.12)
│ │   navegador.                     │ │ │ estes filtros.                       │
│ │   [⤓ Baixar de novo]             │ │ │ [Limpar filtros                    ] │
│ └──────────────────────────────────┘ │ └──────────────────────────────────────┘
│──────────────────────────────────────│
│ Jonas Prado                     [⋯]  │
│ …                                    │
└──────────────────────────────────────┘

Recusa antes de gerar (Pedro, sem Período)
┌──────────────────────────────────────┐
│ 6 relatórios                         │
│ [⊞ Exportar para Excel]              │  o foco continua aqui
│ ┌──────────────────────────────────┐ │
│ │ ⚠ Para exportar, informe o       │ │  P21: font-medium, text-foreground
│ │   período (De e Até) ou use um   │ │
│ │   atalho de semana.              │ │
│ └──────────────────────────────────┘ │
│──────────────────────────────────────│
```
No computador, a caixa fica embaixo do botão, alinhada à direita, com até 28 rem (`sm:ml-auto sm:max-w-md`).

- **Caixa:** `rounded-md border p-3 text-sm text-foreground`, com o ícone de 16 px à esquerda (`aria-hidden`, `shrink-0 mt-0.5`) e o texto à direita, nos tons do P6. Não é o componente `Alert`, que já vem com `role="alert"`; a região `role="status"` é o contêiner.

  | Resultado | Ícone | Tom | Texto |
  |---|---|---|---|
  | sucesso (RN-13) | `CheckCircle2` | `border-success bg-success/15` | "Planilha exportada." (`font-medium`); "{arquivo} · {N} linhas" (ou "1 linha") †; "Se o arquivo não abriu, procure nos arquivos baixados pelo navegador." † (`text-muted-foreground`); "Baixar de novo" † |
  | sem linhas (RN-13) | `Info` | `border-border bg-muted/50` | "Nenhuma célula para exportar com estes filtros." |
  | recusa antes de gerar (RN-03) | `AlertCircle` | `border-destructive bg-destructive/10` | a mensagem do Negócio, em `font-medium` (P21) |
  | falha antes de abrir o aviso (a data do servidor não veio, AQ-1) | `AlertCircle` | `border-destructive bg-destructive/10` | "Não foi possível exportar a planilha. Verifique a conexão e tente de novo." |

- **Recusas antes de gerar (UXD-3, RN-03):** "Para exportar, informe o período (De e Até) ou use um atalho de semana.", "A exportação aceita até 13 semanas. Diminua o período." e "O período escolhido ainda não começou. Escolha um período até esta semana.". A tela confere pelo Período aplicado e pela data do servidor, sem abrir o aviso e sem pedir a exportação. O foco continua em "Exportar para Excel", e o `aria-describedby` dele passa a incluir a mensagem.
- **Sucesso (UXD-8, P123):** o diálogo fecha, a tela entrega o arquivo ao navegador, e o foco volta a "Exportar para Excel".
  - O nome do arquivo e o número de linhas vêm da resposta do servidor (AQ-2). O nome quebra em qualquer ponto (`[overflow-wrap:anywhere]`), para não sair da caixa em 320 px. O número usa o `formatCount` ("19.500 linhas").
  - "Baixar de novo" é um link (`a` com `href` do arquivo e `download` com o nome), com o ícone `Download`, no estilo `Button variant="link"`, `min-h-11 px-0` no celular e `md:min-h-9`, com o texto em `text-foreground` e sublinhado: o `text-primary` do `link` não tem contraste garantido sobre o fundo tingido. O nome acessível é "Baixar de novo a planilha {arquivo}" †. Ele entrega o mesmo arquivo, sem novo pedido ao servidor e sem novo evento (PO-UX-6).
  - Não há toast (UXD-6).
- **Sem linhas:** o diálogo fecha, nada é baixado, e o foco volta ao botão. Quando a lista também está vazia, o vazio da lista do E2.12 continua embaixo, com "Limpar filtros".
- **Quando sai (UXD-9):** a região esvazia quando um filtro aplicado ou a busca mudam (inclusive por um atalho, por um chip ou por "Limpar filtros"), numa nova exportação e ao sair da tela. A troca de página e a mudança do tamanho da página não a esvaziam, porque não mudam a planilha. O arquivo guardado para "Baixar de novo" é liberado junto.

#### T6. Falha e recusa do servidor, no aviso
```
Falha (sem conexão, erro do servidor,    Recusa do servidor (Pedro, com a
evento não gravado ou tempo-limite)      permissão tirada às 21:00)
┌──────────────────────────────────┐     ┌──────────────────────────────────┐
│ Exportar a planilha?             │     │ Exportar a planilha?             │
│ A planilha terá 1 semana, de …   │     │ A planilha terá 1 semana, de …   │
│ …                                │     │ …                                │
│ ⚠ Não foi possível exportar a    │     │ ⚠ Você não tem permissão para    │  role="alert", P21
│ planilha. Verifique a conexão e  │     │ esta ação.                       │
│ tente de novo.                   │     │                                  │
│ [Tentar de novo                ] │     │ [Fechar                        ] │  recebe o foco
│ [Cancelar                      ] │     └──────────────────────────────────┘
└──────────────────────────────────┘
```
- **Falha (RN-11, RN-13, UXD-7):** a mensagem do Negócio acima dos botões, com `role="alert"`, o ícone `AlertCircle` e o texto em `text-sm font-medium text-foreground` (P21). "Gerando a planilha…" vira "Tentar de novo", que recebe o foco; "Cancelar" volta a funcionar. "Tentar de novo" faz um pedido novo (e, com sucesso, um evento novo, RN-11) e segue a T4. A lista e os filtros não mudam. Nenhum texto técnico aparece, nem no tempo-limite.
- **Recusa do servidor depois de confirmar:** a permissão tirada naquele momento (RN-01) ou uma recusa de período que o servidor viu diferente da tela (a semana virou entre abrir e confirmar). A mensagem do Negócio fica no lugar da falha, e o único botão é "Fechar" †.
  - Na recusa de permissão, a tela relê o acesso (P13), e o botão "Exportar para Excel" some. Ao fechar, o foco vai para o `h1` "Relatórios" (`tabIndex={-1}`), porque o botão que abriu o aviso não existe mais.
  - Nas recusas de período, o foco volta a "Exportar para Excel".

#### T7. Download no celular: o que acontece e o que a tela promete
A tela entrega o arquivo ao navegador e não controla o que ele faz depois. Cada navegador mostra o arquivo de um jeito:

| Onde | O que acontece depois de "Exportar planilha" |
|---|---|
| Android, Chrome | O arquivo vai para a pasta de downloads, e o Chrome mostra um aviso com a opção de abrir. Abre no Planilhas Google, no Excel ou em outro app de planilha; sem nenhum instalado, o Android diz que não há app para abrir. |
| iPhone, Safari | O Safari pergunta se a pessoa quer ver ou baixar o arquivo. Baixado, ele vai para o app Arquivos, e o ícone de downloads aparece na barra de endereço. Visto, abre a pré-visualização só para leitura, com o compartilhar para abrir no Excel ou no Numbers, e nada fica guardado. |
| Computador | Vai para a pasta de downloads, com o aviso do navegador. |
| Navegador dentro de outro app (por exemplo, ao tocar num link no Instagram ou no Facebook) | Pode não baixar nada. A tela não tem como saber. |

- **A tela promete:** que a planilha foi gerada, com o nome do arquivo e o número de linhas, e entregue ao navegador; e que "Baixar de novo" entrega o mesmo arquivo, sem gerar outro.
- **A tela não promete:** que o arquivo abriu sozinho; em que pasta ele ficou; que há um app para abri-lo; que o navegador guardou o arquivo (no iPhone, "ver" não guarda); nem que a planilha continua atual (ela é o retrato do momento, e a aba "Informações" diz quando foi gerada, RN-09).
- **Por isso, o texto de sucesso** diz "Planilha exportada." e a dica "Se o arquivo não abriu, procure nos arquivos baixados pelo navegador." †, sem citar uma pasta ou um app.
- **Sem anglicismos:** a tela não usa "Download" nem "Downloads" (Textos de tela do Negócio). "Baixar" e "arquivos baixados" são os termos.
- **O app não é instalável** (não há manifesto no `index.html`), então não há o modo de app instalado do iPhone, em que o download costuma falhar. Se um passo futuro tornar o app instalável, esta tela precisa ser conferida de novo.

#### T8. A planilha: recomendações para ler no celular e no computador
O conteúdo, as colunas, a ordem e as abas são do Negócio (RN-06, RN-08 e RN-09). Estas recomendações tratam só da leitura † (PO-UX-9):
- **Ao abrir,** a aba ativa é "Relatórios", e "Informações" vem em segundo.
- **Na aba "Relatórios":**
  - a primeira linha fica **congelada**, para os nomes das colunas continuarem à vista ao rolar, também no Planilhas Google e no Excel do celular;
  - a primeira linha tem o **filtro** ligado, para cada G12 separar a parte dele (F2) sem mexer na ordem;
  - sem células mescladas, sem linhas em branco entre os grupos e sem linhas de título acima do cabeçalho, para o filtro, a ordenação e a soma funcionarem (o agrupamento é só pela ordem, RN-08);
  - larguras ajustadas ao conteúdo, com um limite (cerca de 40 caracteres) e quebra de linha em Endereço e Observações, para nenhuma coluna ocupar a tela inteira;
  - números à direita (Célula #, Oferta, Nº de participantes e Nº de visitantes), nos formatos da RN-09.
- **Na aba "Informações":** duas colunas, o rótulo e o valor, uma informação por linha; os filtros, um por linha; e a explicação de cada valor da Situação, um por linha.

#### T9. Funções: a permissão nova
Formulário da função (T3 do E2.02), no grupo "Relatórios", em 360 px:
```
┌──────────────────────────────────────┐
│ Relatórios                           │  legend do fieldset
│ [ ] Visualizar Relatórios de Toda a  │
│     Igreja                           │
│     Só os relatórios. Não abre       │
│     Membros nem Células.             │
│ [ ] Visualizar Relatórios do Seu     │
│     Ministério                       │
│     Só os relatórios. Não abre       │
│     Membros nem Células.             │
│ [x] Exportar Relatórios de Células   │  nova, logo depois das de ver
│     Baixa a planilha dos relatórios, │  dica do Negócio
│     com as células sem relatório, só │
│     do que a pessoa vê.              │
│ [x] Enviar Relatório das Próprias    │
│     Células                          │
│ …                                    │
└──────────────────────────────────────┘
```
Numa função que tem só a exportação, sem nenhuma permissão que dê a lista de Relatórios (critério da RN-01):
```
│ [x] Exportar Relatórios de Células   │
│     Baixa a planilha dos relatórios, │
│     com as células sem relatório, só │
│     do que a pessoa vê.              │
│     △ Para valer, a função também    │  aviso (P121, P21), role="status" †
│     precisa de uma permissão que     │
│     mostre Relatórios.               │
```
- **Lugar (UXD-11):** no grupo "Relatórios", logo depois de "Visualizar Relatórios do Seu Ministério" e antes de "Enviar Relatório das Próprias Células" †. A linha segue o P14: o `Checkbox` e o `Label` (`htmlFor`) na linha inteira, com `min-h-11`, e a dica num `p` ligado por `aria-describedby`.
- **Aviso (P121):** aparece embaixo da dica, enquanto a permissão está marcada e a função não tem nenhuma das que dão a lista de Relatórios (a regra do menu, RN-22 do E2.02). Ícone `TriangleAlert` (`aria-hidden`) e texto em `text-sm text-foreground` (P21, aviso). Não impede salvar, porque a função é válida; só não exporta. Some ao marcar uma permissão que dá a lista.
- **Contagens:** "{N} marcadas" conta a nova. Na lista de Funções (T2 do E2.02), "Ver permissões" mostra o badge "Exportar Relatórios de Células" no grupo "Relatórios", e a Líder passa a "13 permissões". A Administrador continua com "Todas as permissões, inclusive as novas.".
- Componentes: os da T3 do E2.02, sem novo.

#### T10. Auditoria: a ação "Exportação"
Celular (T7 do E2.05), com Rita, depois das exportações de Pedro ("Semana passada" e Líder: André) e dela ("Semana passada"):
```
┌──────────────────────────────────────┐
│ Exportou a planilha de relatórios de │  descrição (Negócio), font-medium
│ 15/11/2026 a 21/11/2026 (1 linha)    │  "(1 linha)" no singular †
│ Líder: André Souza                   │  segunda linha: os filtros †
│ Pedro Alves · 24/11/2026 às 21:05    │
│ [Exportação] Relatório               │  badge outline e a entidade †
│──────────────────────────────────────│
│ Exportou a planilha de relatórios de │
│ 15/11/2026 a 21/11/2026 (5 linhas)   │
│ Sem filtros                          │  †
│ Rita Moraes · 24/11/2026 às 21:00    │
│ [Exportação] Relatório               │
└──────────────────────────────────────┘
```
Painel de detalhes (T10 do E2.05):
```
┌──────────────────────────────────────┐
│ Detalhes do evento               [✕] │
│ 24/11/2026 às 21:05                  │
│ Autor                                │
│ Pedro Alves                          │
│ Ação               Entidade          │
│ Exportação         Relatório         │
│ Descrição                            │
│ Exportou a planilha de relatórios de │
│ 15/11/2026 a 21/11/2026 (1 linha)    │
│ Semanas                              │  Negócio (RN-11)
│ 15/11/2026 a 21/11/2026 (1 semana)   │
│ Filtros                              │
│ • Líder: André Souza                 │  ul; sem filtros: "Nenhum"
│ Linhas                               │
│ 1                                    │
└──────────────────────────────────────┘
```
- **Ação:** "Exportação" entra no `ACTION_LABELS`. No filtro "Ação", ela fica logo depois de "Restauração" e antes de "Login" †: Todas, Criação, Alteração, Exclusão, Restauração, Exportação e depois as de login e de senha (T8 do E2.03).
- **Entidade (UXD-12):** "Relatório" † (PO-UX-7). O filtro "Entidade: Relatório" passa a trazer também as exportações; "Ação: Exportação" as separa.
- **Segunda linha †:** os textos dos chips gravados no evento, separados por "; " (os textos dos chips já usam "·" e ":"), até 3, e "e mais {N}". Sem filtros: "Sem filtros". Em `text-sm text-muted-foreground`, como as outras segundas linhas.
- **Painel:** Autor, Ação, Entidade, Descrição, "Semanas", "Filtros" (uma `ul`, ou "Nenhum") e "Linhas" (`formatCount`). Sem "Registro", porque nenhum registro mudou, e sem "Ver histórico" (RN-11). Nenhum JSON e nenhum identificador (P32 e RN-20 do E2.05).
- **Tabela do computador:** as colunas da T7 do E2.05, sem mudança: Data/Hora, Autor, o badge "Exportação", "Relatório", a descrição com a segunda linha e o "OK" do Status.
- **Histórico de um registro (T9 do E2.05):** nunca mostra exportações.

#### T11. Telas sem mudança visual
- **Membros, Células, detalhe da célula, Ministérios e Dashboard:** nada muda. O número da célula não aparece nas telas (Q-6), e o Dashboard não ganha card (Fora de escopo).
- **Menu:** sem item novo. A exportação fica na lista de Relatórios.
- **Formulários de célula e de relatório:** nada muda. O número da célula é dado pelo servidor, sem campo (RN-14).
- **Lista "Excluídos" de relatórios (E2.01):** sem exportação.

#### T12. As perguntas Q-1 a Q-8 na tela
Com o padrão do Negócio, vale o que está nas T1 a T11. Se a resposta for a alternativa:
- **Q-1. Quem exporta.** *Todos que têm a lista de Relatórios:* o botão aparece também para Caio, Carla e Lia; a tela de Funções não ganha a permissão nem o aviso (T9 sai); nada mais muda.
- **Q-2. Uma semana por planilha.** Uma quarta recusa antes de gerar, embaixo do botão: "A exportação aceita uma semana por vez. Use um atalho de semana ou escolha De e Até na mesma semana." †. O aviso passa a dizer sempre "1 semana"; a nota "As semanas entram inteiras…" continua para um Período que não começa no domingo.
- **Q-3. 53 semanas.** A recusa passa a "A exportação aceita até 53 semanas. Diminua o período.". A geração e a transferência podem passar de 10 s, e o "Ainda gerando a planilha…" aparece mais vezes; o tempo-limite precisa crescer (AQ-2). Recomendação: aos 15 s, trocar a linha por "Planilhas com muitas semanas podem levar até um minuto." †.
- **Q-4. Textos do legado na Situação.** Nenhuma tela muda: os valores só aparecem na planilha e na aba "Informações".
- **Q-5. Colunas a mais.** Nenhuma tela muda. Na planilha, as colunas novas seguem a T8 (largura com limite e quebra de linha nos textos).
- **Q-6. Número da célula.**
  - *Alternativa A (nas telas):* "Nº {número}" † em `text-sm text-muted-foreground tabular-nums`: no cartão de Células, logo abaixo do nome do líder; na tabela de Células, embaixo do nome, dentro da coluna "Líder", porque a tabela não tem lugar para outra coluna em 1280 px (UXD-5 do E2.09); no detalhe da célula, embaixo do título. O leitor de tela ouve "número {número}". A busca pelo número depende do Negócio.
  - *Alternativa B (sem número):* nenhuma tela muda.
- **Q-7. Líder e G12 pelo líder atual.** Nenhuma tela muda.
- **Q-8. Totais na planilha.** Nenhuma tela muda. O "{N} linhas" do sucesso conta só as linhas de célula, sem as de total.

### Padrões novos (valem para as próximas telas)
A numeração começa em P120 (ver a nota do início da seção). Este passo também aplica o P6 (tons), o P9 (diálogo de texto longo), o P10 (subtítulo), o P13 (acesso relido), o P14 (lista de permissões), o P21 (mensagens), o P50 (painel de filtros), o P74 (cartões e tabela) e o P90 (atalhos), sem mudá-los.

- **P120. Exportação de uma lista filtrada.** Vale para as próximas exportações (Membros, Células, Auditoria, Escolas), se o Negócio as criar.
  - **Lugar:** na linha do total da lista, depois dos filtros e dos chips e antes da lista. Um `Button variant="outline"` com o ícone do arquivo e "Exportar para {formato}", com a largura do texto. Abaixo de 640 px, numa linha própria, alinhado à esquerda; a partir daí, à direita do total. Nunca no painel de filtros.
  - **O que segue:** os filtros aplicados, nunca o que está no painel sem aplicar. Exportar não muda a lista, os filtros nem a URL.
  - **Quando responde:** em todos os estados da lista (carregando, vazia e com erro), menos durante a própria exportação. Quem não pode exportar não vê o botão.
  - **Recusas que a tela já sabe:** embaixo do botão, na região do resultado, sem abrir diálogo, com o foco no botão.
  - **Antes de gerar:** um `AlertDialog` (P9) com o alcance (o período e os outros filtros, com os textos dos chips e a busca) e o aviso de que os dados vão sair do sistema. A ação primária tem verbo e objeto ("Exportar planilha").
  - **Gerando:** P122, no próprio diálogo. **Falha:** no diálogo, com "Tentar de novo".
  - **Resultado:** numa região `role="status"`, sempre no DOM, embaixo do botão; caixa no tom do P6, nunca o `Alert` nem o toast. Sai quando os filtros aplicados mudam, numa exportação nova e ao sair da tela.
  - **Arquivo:** P123.
- **P121. Permissão que depende de outra.** Na tela de Funções, quando uma permissão marcada só tem efeito junto com outra, um aviso (P21: `TriangleAlert` e `text-foreground`) aparece embaixo da dica, com `role="status"`, enquanto a outra faltar.
  - Não impede salvar, porque a função é válida.
  - A regra que decide é a mesma que libera a tela ou a ação (por exemplo, a do menu de Relatórios), numa função só.
  - O aviso fica no `aria-describedby` do checkbox, antes da dica (ordem do P21).
- **P122. Botão de uma ação demorada num diálogo.** Para ações que podem passar de 1 s (exportar, enviar, salvar).
  - O rótulo vira o andamento ("Gerando a planilha…"), com o `Loader2` em `motion-reduce:animate-none`.
  - Os botões do diálogo recebem `aria-disabled="true"` e ignoram toques e teclas, em vez de `disabled`, para o foco não se perder. Um segundo toque não faz outro pedido.
  - `Esc`, o toque fora e "Cancelar" não fecham o diálogo até a resposta.
  - Uma região `role="status"` anuncia o andamento uma vez e, aos 3 s sem resposta, mostra "Ainda {fazendo}. Isso pode levar alguns segundos.".
  - Sem resposta no tempo-limite, vale a falha, com "Tentar de novo" no lugar da ação primária e o foco nele.
  - Estende o envio do E2.11 (UX-29), que pode adotar o `aria-disabled`.
- **P123. Arquivo gerado e entregue ao navegador.**
  - O nome do arquivo traz as datas e não tem acento nem espaço.
  - A tela entrega o arquivo ao navegador sem abrir janela nem sair do app.
  - O resultado diz "{Coisa} exportada.", o nome do arquivo e o número de linhas, a dica "Se o arquivo não abriu, procure nos arquivos baixados pelo navegador." e "Baixar de novo", que entrega o mesmo arquivo, guardado na memória, sem novo pedido ao servidor e sem novo evento.
  - A tela não promete a pasta, o app que abre o arquivo nem que o navegador o guardou (T7).
  - Sem os termos "Download" e "Downloads".

Nenhum componente novo do shadcn é necessário: `alert-dialog`, `button`, `skeleton`, `checkbox`, `label`, `badge`, `sheet`, `select` e `table` já estão em `src/components/ui`. Os ícones `FileSpreadsheet`, `Download`, `Loader2`, `CheckCircle2`, `Info`, `AlertCircle` e `TriangleAlert` existem no `lucide-react` do projeto (0.462). Esta tela não tem rodapé fixo, então não depende do `viewport-fit=cover`.

### Estados
| Estado | Lista de Relatórios: botão e resultado (T1, T2, T5) | Aviso antes de gerar (T3, T4, T6) | Funções (T9) | Auditoria (T10) |
|---|---|---|---|---|
| Carregando | Primeira carga: o botão responde, e o total é um `Skeleton` do tamanho do texto. Troca de página e filtro aplicado: o botão não muda (a lista fica com `opacity-60`, E2.12). Sem a data do servidor: o toque espera a leitura dela antes de abrir o aviso, com o `Loader2` no botão (P122) | Gerando: o botão com "Gerando a planilha…", o diálogo sem fechar e, aos 3 s, "Ainda gerando a planilha…" | Como no E2.02 | Como no E2.05 |
| Vazio | Lista vazia: o botão continua (RN-02). Planilha sem linhas: "Nenhuma célula para exportar com estes filtros.", sem arquivo | "Outros filtros: Nenhum" | — | Sem filtros: "Sem filtros" na segunda linha e "Nenhum" no painel |
| Erro | Lista com erro: o botão continua, e o `Alert` da lista vem depois. Data do servidor que não chega: a falha da RN-13, na região do resultado | Falha, evento não gravado e tempo-limite: a mensagem do Negócio, com `role="alert"`, e "Tentar de novo" | Como no E2.02 | Como no E2.05 |
| Sem permissão | Sem a permissão ou sem a lista: sem o botão e sem a região. Sem a lista de Relatórios: a tela sem acesso do E2.02 | Permissão tirada naquele momento: "Você não tem permissão para esta ação.", só "Fechar"; o acesso é relido, o botão some, e o foco vai para o `h1` | Sem lista de Relatórios: o aviso do P121 | Sem "Visualizar Auditoria": como no E2.05 |
| Valor inválido e recusas | Sem período (inclusive data não aplicada), mais de 13 semanas e período que não começou: a mensagem do Negócio embaixo do botão, sem aviso e sem pedido | Recusa de período vista pelo servidor: a mensagem e "Fechar" | — | — |
| Sucesso | "Planilha exportada.", o nome, as linhas, a dica e "Baixar de novo". O foco volta ao botão. Sem toast. A lista, os filtros e a URL não mudam | Fecha | Ao salvar, como no E2.02 | O evento aparece na próxima leitura |
| Lista grande | Até 19.500 linhas (13 semanas × 1.500 células): o mesmo fluxo; "19.500 linhas" no sucesso | Até 10 s gerando (RN-13), mais a transferência no 3G; "Ainda gerando…" aos 3 s | — | "Linhas: 19.500" |
| Queda de conexão | Antes do aviso (data do servidor): a falha na região do resultado | Durante a geração ou a transferência: a falha, com "Tentar de novo". O evento pode já ter sido gravado (RN-11), e a nova tentativa grava outro | Como no E2.02 | — |

### Textos
Complementam os "Textos de tela" do Negócio, sem mudar os termos. Os marcados com † foram definidos pela UX, estão nas pendências (PO-UX-1 a PO-UX-10) e foram aprovados pelo PO em 2026-11-24 (P-EXP-32).

| Onde | Texto |
|---|---|
| Ação | Exportar para Excel · (leitor de tela, descrição) Gera a planilha dos relatórios com os filtros aplicados. † (no lugar de "Exportar os relatórios para Excel", PO-UX-1) |
| Recusas (Negócio) | Para exportar, informe o período (De e Até) ou use um atalho de semana. · A exportação aceita até 13 semanas. Diminua o período. · O período escolhido ainda não começou. Escolha um período até esta semana. |
| Aviso: título † | Exportar a planilha? |
| Aviso: semanas (Negócio) | A planilha terá {N} semanas, de {dd/mm/aaaa} a {dd/mm/aaaa}, com os filtros aplicados. · com uma: 1 semana |
| Aviso: notas † | As semanas entram inteiras, de domingo a sábado. · As semanas que ainda não começaram não entram. |
| Aviso: filtros † | Outros filtros · Nenhum · os textos dos chips do E2.12, sem "De" e "Até" · Busca: “{texto}” (PO-UX-2) |
| Aviso: dados (Negócio) | Os dados vão sair do sistema. Guarde a planilha com cuidado. |
| Aviso: botões | Cancelar (Negócio) · Exportar planilha † (no lugar de "Exportar", PO-UX-3) · Gerando a planilha… (Negócio) · Tentar de novo · Fechar † |
| Aviso: andamento † | (leitor de tela) Gerando a planilha… · aos 3 s: Ainda gerando a planilha. Isso pode levar alguns segundos. |
| Aviso: falha (Negócio) | Não foi possível exportar a planilha. Verifique a conexão e tente de novo. |
| Aviso: recusa do servidor (Negócio) | Você não tem permissão para esta ação. · as recusas de período |
| Resultado: sucesso | Planilha exportada. (Negócio) · {arquivo} · {N} linhas (com uma: 1 linha) † · Se o arquivo não abriu, procure nos arquivos baixados pelo navegador. † · Baixar de novo † · (leitor de tela) Baixar de novo a planilha {arquivo} † · só se o navegador não baixar sozinho (AQ-4): Baixar planilha † |
| Resultado: sem linhas (Negócio) | Nenhuma célula para exportar com estes filtros. |
| Funções | Exportar Relatórios de Células · dica (Negócio): Baixa a planilha dos relatórios, com as células sem relatório, só do que a pessoa vê. · aviso †: Para valer, a função também precisa de uma permissão que mostre Relatórios. |
| Auditoria | Exportação (Negócio) · entidade: Relatório † · descrição (Negócio), com "(1 linha)" no singular † · segunda linha †: os textos dos chips, separados por "; ", até 3, e "e mais {N}" · Sem filtros † · painel: Semanas · Filtros · Linhas (Negócio) · Nenhum · {dd/mm/aaaa} a {dd/mm/aaaa} (1 semana) ou ({N} semanas) |
| Q-1 a Q-8, se adotadas † | A exportação aceita uma semana por vez. Use um atalho de semana ou escolha De e Até na mesma semana. · A exportação aceita até 53 semanas. Diminua o período. · Planilhas com muitas semanas podem levar até um minuto. · Nº {número} · (leitor de tela) número {número} |

**Evitar nestas telas,** além do que o Negócio lista: "Download" e "Downloads", também na dica do sucesso; "Baixar planilha" como nome da ação da lista, no lugar de "Exportar para Excel" (o nome da ação é do Negócio); "Sucesso!", "Pronto!" e "OK" como resultado ou como botão; "Exportar" sem objeto no botão do aviso; e qualquer texto técnico (código de erro, "timeout", nome de arquivo temporário, id).

### Acessibilidade
- **Botão:** o nome acessível é o texto visível, "Exportar para Excel" (WCAG 2.5.3), com a descrição em `sr-only` no `aria-describedby`. Com uma recusa na tela, o `aria-describedby` aponta também para ela, e o leitor a ouve ao voltar ao botão. O ícone é `aria-hidden`.
- **Região do resultado:** `role="status"`, sempre no DOM, vazia até o primeiro resultado. A mensagem entra por inteiro, de uma vez, e o leitor a ouve uma vez. Não usa o `Alert` (`role="alert"`) nem toast. A caixa não recebe foco; "Baixar de novo" é o único elemento focável dela.
- **Aviso antes de gerar:** o `AlertDialog` do Radix (`role="alertdialog"`), com o título num `h2` e a descrição com todo o conteúdo (P9), lida ao abrir. O foco vai para "Cancelar" ao abrir, fica preso no diálogo e, ao fechar, volta a "Exportar para Excel", ou ao `h1` quando o botão sumiu (T6). "Outros filtros" é uma `dl`, com os filtros numa `ul`.
- **Andamento (P122):** `aria-disabled` em vez de `disabled`, para o foco ficar no botão; "Gerando a planilha…" e "Ainda gerando a planilha…" anunciados uma vez cada, pela região `role="status"` do diálogo.
- **Falha:** `role="alert"` no diálogo, porque a pessoa está esperando a resposta; o foco vai para "Tentar de novo".
- **Sem depender de cor:** cada resultado tem um ícone e um texto próprios (`CheckCircle2`, `Info`, `AlertCircle`); o aviso de Funções tem o `TriangleAlert` e o texto.
- **Contraste, nos temas claro e escuro:** 4,5:1 para o texto das caixas (`text-foreground` sobre os fundos tingidos do P6), do aviso dos dados (`text-foreground` sobre `bg-muted/50`), da dica do sucesso e da descrição (`text-muted-foreground`, 4,6:1 no claro e 5,6:1 no escuro, P21) e do aviso de Funções. Nenhum texto em `text-destructive` (P21). 3:1 para a borda do botão `outline` e para o anel de foco.
- **Toque:** "Exportar para Excel", "Baixar de novo" (no celular), "Exportar planilha", "Cancelar", "Tentar de novo", "Fechar" e a linha da permissão em Funções têm pelo menos 44 px no celular, com 8 px entre si.
- **Zoom de 200%, 320 px e fonte grande:** o texto do botão quebra dentro dele, e o botão cresce em altura; o nome do arquivo quebra em qualquer ponto; as mensagens e os filtros do aviso quebram linha, sem `truncate`; o diálogo rola por dentro (P9). Nem a página nem o diálogo rolam na horizontal.
- **Movimento:** o `Loader2` não gira com `prefers-reduced-motion`; as animações do `AlertDialog` respeitam `motion-reduce:`.
- **Funções e Auditoria:** tudo da Acessibilidade do E2.02 (P14) e do E2.05. O aviso do P121 fica no `aria-describedby` do checkbox, antes da dica.

### Critérios de UX
Numeração própria deste spec. "Hoje" é terça, 24/11/2026, às 21:00 de Brasília, pelo relógio do servidor, e os nomes são os da massa de exemplo.

| ID | Critério | Como verificar |
|---|---|---|
| UX-01 | Quem vê a ação (critérios da RN-01): em 360×800 e em 1280×800, Rita, Samuel, Pedro, André e Diego veem "Exportar para Excel" na lista de Relatórios. Caio, Lia (sem a exportação) e quem tem só "Exportar Relatórios de Células", sem a lista, não veem, e o DOM não tem o botão nem a região do resultado. Hugo vê a tela sem acesso do E2.02. Lia com exportação vê o botão. | teste E2E (massa) + teste de componente |
| UX-02 | Lugar (UXD-1, P120): em 360×800, o botão fica numa linha própria, logo depois de "{N} relatórios" e antes da lista, alinhado à esquerda, com pelo menos 44 px de altura e a largura do texto. Em 640×900, 1024×768 e 1280×800, fica na mesma linha do total, à direita. Com o painel do computador aberto, fica depois do painel. Na ordem do Tab, vem depois dos chips e antes da primeira linha da lista. O botão não aparece no cabeçalho, no menu nem no painel de filtros. | teste E2E (viewport e medida) |
| UX-03 | Sempre disponível (RN-02): o botão aparece e abre o aviso na primeira carga (com o `Skeleton`), na troca de página, com a lista vazia (Pedro, "Esta semana" e Líder: André) e com a lista em erro. Em 360×800, a posição dele não muda entre a primeira carga e a lista carregada. | teste de componente (mock) + teste E2E (medida) |
| UX-04 | Recusas antes de gerar (critérios da RN-03): Pedro sem Período, só com "De", só com "Até" e com "De" em 31/02/2026 (não aplicado) toca em "Exportar para Excel" e vê, embaixo do botão, "Para exportar, informe o período (De e Até) ou use um atalho de semana.", sem diálogo e sem nenhum pedido de exportação. Com 29/08/2026 a 28/11/2026, "A exportação aceita até 13 semanas. Diminua o período."; com 29/11/2026 a 05/12/2026, "O período escolhido ainda não começou. Escolha um período até esta semana."; com 30/08/2026 a 28/11/2026, o aviso abre. O foco continua no botão, a mensagem está na região `role="status"` e no `aria-describedby` dele, e tocar em "Semana passada" a tira. | teste de componente (rede simulada) + teste E2E |
| UX-05 | Conteúdo do aviso (critérios da RN-03): com De 20/11/2026 e Até 24/11/2026, o título é "Exportar a planilha?", a frase é "A planilha terá 2 semanas, de 15/11/2026 a 28/11/2026, com os filtros aplicados.", vem a nota "As semanas entram inteiras, de domingo a sábado.", "Outros filtros" diz "Nenhum", e aparecem o aviso dos dados e os botões "Cancelar" e "Exportar planilha". Com 22/11/2026 a 12/12/2026: "1 semana, de 22/11/2026 a 28/11/2026" e "As semanas que ainda não começaram não entram.". Com "Semana passada", sem nota. Pedro com "Semana passada", Líder: André e a busca "fé" vê "Líder: André Souza" e "Busca: “fé”", nessa ordem. Com os filtros do UX-08 do E2.12, os itens seguem a ordem dos chips, sem "De" e "Até". Abrir o aviso não faz pedido de exportação; "Cancelar" e `Esc` fecham sem pedido, e o foco volta ao botão. | teste de componente + teste E2E |
| UX-06 | Aviso no celular e com zoom: em 360×800, o diálogo tem 16 px de margem de cada lado, texto à esquerda e os dois botões em largura toda, com "Exportar planilha" em cima, cada um com pelo menos 44 px. A partir de 640 px, os botões ficam lado a lado, à direita. Em 320×640 com zoom de 200%, com 7 filtros, o corpo rola, os botões são alcançáveis, e nada rola na horizontal. Ao abrir, o foco está em "Cancelar", e o leitor de tela ouve o título e a descrição. | teste E2E (viewport) + inspeção (leitor de tela) |
| UX-07 | Gerando (RN-13, P122): "Exportar planilha" faz um pedido só. O botão passa a "Gerando a planilha…", com o `Loader2` e `aria-disabled="true"`, e o foco fica nele (`document.activeElement` não muda). Novos toques, `Enter`, `Esc`, o toque fora e "Cancelar" não fazem nada. A região `role="status"` do diálogo recebe "Gerando a planilha…" uma vez. Com a resposta atrasada 4 s, aparece "Ainda gerando a planilha. Isso pode levar alguns segundos.". Com `prefers-reduced-motion`, o indicador não gira. | teste de componente (relógio e rede simulados) + teste E2E |
| UX-08 | Sucesso (critérios da RN-09 e da RN-13): Rita exporta "Semana passada". O diálogo fecha, o navegador recebe `Relatorios_2026-11-15_a_2026-11-21.xlsx` (evento `download` do Playwright), e a região embaixo do botão mostra "Planilha exportada.", "Relatorios_2026-11-15_a_2026-11-21.xlsx · 5 linhas", a dica e "Baixar de novo". O foco volta a "Exportar para Excel". Nenhum toast aparece. A lista, os filtros, a página, a URL e o tamanho do histórico do navegador continuam como estavam. | teste E2E (massa) |
| UX-09 | "Baixar de novo" (P123): é um `a` com `download` e o mesmo nome de arquivo. Ativá-lo gera um segundo evento `download`, com o mesmo conteúdo, sem pedido novo ao servidor e sem evento novo na Auditoria. Trocar de página mantém o resultado; mudar um filtro aplicado, exportar de novo ou sair da tela tira o resultado e o link. | teste E2E (rede inspecionada) |
| UX-10 | Sem linhas (critérios da RN-07 e da RN-13): Rita com "Semana passada" e Reunião: Não houve célula, e Pedro com "Esta semana" e G12: Tânia (pessoa indisponível), exportam. O diálogo fecha, a região mostra "Nenhuma célula para exportar com estes filtros.", não há `download` nem evento na Auditoria, e o foco volta ao botão. | teste E2E (massa) |
| UX-11 | Falha (critérios da RN-11 e da RN-13): sem conexão (`context.setOffline`), com erro do servidor, com o evento que não pode ser gravado e com o tempo-limite, o diálogo continua aberto, com "Não foi possível exportar a planilha. Verifique a conexão e tente de novo." (`role="alert"`), "Tentar de novo" no lugar da ação primária e com o foco, e "Cancelar" funcionando. Nenhum texto técnico aparece. A lista e os filtros não mudam. "Tentar de novo" faz um pedido novo e, com sucesso, segue o UX-08. | teste de componente (mock) + teste E2E (offline) |
| UX-12 | Recusa do servidor (critério da RN-01): Rita tira a permissão da Líder às 21:00, e Pedro, com a lista aberta, confirma às 21:01. O diálogo mostra "Você não tem permissão para esta ação." e só "Fechar". Ao fechar, o botão "Exportar para Excel" sumiu, e o foco está no `h1` "Relatórios". Nenhum `download`. | teste E2E |
| UX-13 | Data do servidor (critérios da RN-03): com o navegador em `Europe/Lisbon` (Playwright `timezoneId`) e o servidor no sábado, 28/11, às 22:30 de Brasília, "Esta semana" e "Exportar para Excel" mostram "1 semana, de 22/11/2026 a 28/11/2026", e o arquivo é `Relatorios_2026-11-22_a_2026-11-28.xlsx`. Mudar o relógio do navegador (`Date` simulado) não muda o aviso. Com a leitura da data atrasada, o toque mostra o `Loader2` no botão e abre o aviso quando ela chega; com a leitura falhando, a região mostra a falha da RN-13, sem aviso. | teste E2E (fuso e relógio) + teste de componente |
| UX-14 | Download no celular (T7): no Playwright, com o Chromium em emulação de Android e o WebKit em emulação de iPhone, "Exportar planilha" gera o `download` com o nome certo e a extensão `.xlsx`. Em aparelhos reais (Android com Chrome; iPhone com Safari), a planilha é baixada e abre no Planilhas Google, no Excel ou na pré-visualização do iPhone, com os acentos certos; no iPhone, "Baixar de novo" funciona depois de "ver". O texto da tela não cita pasta nem app. | teste E2E (emulação) + inspeção (aparelhos) |
| UX-15 | Funções (T9): no formulário, o grupo "Relatórios" tem "Exportar Relatórios de Células" logo depois de "Visualizar Relatórios do Seu Ministério", com a dica do Negócio no `aria-describedby`, a linha inteira clicável e pelo menos 44 px. A Líder aparece com ela marcada, e a Membro sem. "{N} marcadas" a conta. Na lista de Funções, a Líder mostra "13 permissões" e o badge no grupo "Relatórios". Numa função só com ela, o aviso "Para valer, a função também precisa de uma permissão que mostre Relatórios." aparece embaixo da dica, com `role="status"`, e some ao marcar "Visualizar Seu Ministério". Salvar não é impedido. | teste de componente |
| UX-16 | Auditoria (T10, critérios da RN-11): Rita vê o evento de Pedro, no celular, com "Exportou a planilha de relatórios de 15/11/2026 a 21/11/2026 (1 linha)", "Líder: André Souza", "Pedro Alves · 24/11/2026 às …", o badge "Exportação" e "Relatório". No painel, aparecem Autor, Ação, Entidade, Descrição, "Semanas" ("15/11/2026 a 21/11/2026 (1 semana)"), "Filtros" ("Líder: André Souza") e "Linhas" ("1"), sem "Registro", sem "Ver histórico", sem JSON e sem identificador. O evento dela mostra "(5 linhas)", "Sem filtros" e "Filtros: Nenhum". No filtro "Ação", "Exportação" vem logo depois de "Restauração", e com ela a lista mostra só exportações. O "Ver histórico" de C1 e de R1 não tem exportações. | teste de componente + teste E2E |
| UX-17 | Textos: o DOM da lista de Relatórios, do aviso e da região do resultado não tem "Download", "Downloads", "CSV", "Baixar relatórios", "Relatório não entregue", "Entregue", "Close", "Sucesso!" nem "OK" como botão ou resultado, nem nome de parâmetro, código de erro ou "timeout". O nome acessível do botão é "Exportar para Excel", e a descrição é "Gera a planilha dos relatórios com os filtros aplicados.". | teste de componente |
| UX-18 | Acessibilidade: as regiões `role="status"` (da página e do diálogo) existem no DOM antes da primeira mensagem, e cada resultado é anunciado uma vez. Nenhum resultado depende só de cor (cada um tem ícone e texto próprios). O contraste é de 4,5:1 nos textos do aviso, da região do resultado e do aviso de Funções, e de 3:1 na borda do botão e no anel de foco, nos temas claro e escuro. | inspeção (axe nos dois temas e leitor de tela) |
| UX-19 | Em 320×640, com zoom de 200% e com a fonte grande, "Exportar para Excel" quebra dentro do botão sem corte, o nome do arquivo quebra sem sair da caixa, as mensagens e os filtros do aviso quebram linha, o aviso rola por dentro, e nem a página nem o diálogo rolam na horizontal. | teste E2E (viewport) + inspeção |
| UX-20 | Só se a alternativa for adotada (T12): com a da Q-1, Caio vê o botão, e a tela de Funções não tem a permissão nem o aviso; com a da Q-2, um Período de duas semanas mostra a recusa de uma semana por vez embaixo do botão; com a da Q-3, 14 semanas abrem o aviso, e 54 mostram a recusa com "53"; com a alternativa A da Q-6, o cartão, a tabela e o detalhe de C1 mostram "Nº 101", lido como "número 101". | teste de componente + teste E2E |

### Perguntas para o `architect` (dados e contrato)
Em cada uma, a tela tem um comportamento padrão (o mais conservador) se a resposta for "não", menos onde está dito que não há.

- **AQ-1. Semanas e recusas na tela, pela data do servidor** (RN-03, UXD-3, T3). A tela precisa, antes de pedir a exportação: os filtros aplicados e os textos dos chips (o módulo de filtros do E2.12, AQ-1 de lá), a data de hoje em Brasília segundo o servidor (AQ-2 do E2.12) e uma função que, com o Período aplicado e essa data, devolva as semanas (o domingo da primeira, o sábado da última, limitado à semana atual), o número delas, as notas da T3 e a recusa, quando houver. A mesma função, com teste unitário, serve à tela; o servidor confere de novo e é quem vale.
  - *Padrão sem isso:* uma leitura leve no servidor, sem evento, que devolve as semanas e as recusas antes de abrir o aviso. Enquanto ela não chega, o botão mostra o `Loader2` (P122).
- **AQ-2. Respostas da exportação, distintas** (RN-01, RN-03, RN-11, RN-13). A tela precisa distinguir:
  - sucesso: o arquivo, o nome, as semanas e o número de linhas;
  - planilha sem linhas, sem arquivo;
  - recusas, com um código cada: sem permissão, sem período, mais de 13 semanas e período que não começou;
  - falha, inclusive o evento que não pôde ser gravado.

  Cada uma vira um estado da tabela de Estados, sem texto técnico. Sugestão de tempo-limite no aparelho: 30 s, que cobrem os 10 s de geração e a transferência da planilha maior no 3G.
  - *Padrão sem isso:* toda resposta que não é sucesso nem "sem linhas" vira a falha.
- **AQ-3. Como o arquivo chega ao aparelho** (UXD-8, P123, T7). Recomendação: a resposta traz o arquivo, e a tela cria um `Blob` e um link `a` com `download`, que ela mesma aciona; o mesmo link serve ao "Baixar de novo", até a região esvaziar (`URL.revokeObjectURL`). Nunca `window.open` (bloqueado como janela) nem navegação da própria página (sai do app). Se o arquivo vier por uma URL assinada, "Baixar de novo" usa a mesma URL até ela vencer, sem novo evento. Confirmar o tamanho da planilha maior (19.500 linhas) e se ela cabe na memória de um celular de entrada.
- **AQ-4. Download depois de uma espera** (T7). Confirmar no Safari do iPhone (iOS 16 ou mais novo) e no Chrome do Android que acionar o link depois de até 10 s de espera baixa o arquivo, sem bloqueio.
  - *Padrão se não baixar:* o sucesso mostra "Baixar planilha" † como ação principal da caixa, e a pessoa toca para baixar (um toque a mais). "Baixar de novo" some, porque o próprio botão serve para baixar de novo.
- **AQ-5. Sair da tela durante a geração** (T4, Navegação). O voltar do aparelho e a troca de tela cancelam o pedido no aparelho (`AbortController`), e o arquivo é descartado. Se o servidor já gravou o evento, ele fica (RN-11). Confirmar.
- **AQ-6. Uma regra só para "tem a lista de Relatórios"** (RN-01, P121). A mesma função decide o item do menu (RN-22 do E2.02), o botão "Exportar para Excel" e o aviso da tela de Funções, junto com a permissão nova.
- **AQ-7. Acesso relido depois da recusa de permissão** (T6, P13). Depois de "Você não tem permissão para esta ação.", a tela relê o acesso, para o botão sumir antes de o diálogo fechar.
- **AQ-8. O evento legível** (T10, RN-11). Para a Auditoria mostrar sem reconstruir nada:
  - a ação "Exportação" no `ACTION_LABELS` e a entidade "Relatório" (PO-UX-7);
  - as semanas, os textos dos chips (e a busca, se o PO aceitar a PO-UX-2) como estavam na exportação, com os nomes daquele momento (RN-20 c do E2.05), e o número de linhas;
  - sem "Registro" e sem "Ver histórico" para essa ação;
  - o singular "(1 linha)" na descrição.
- **AQ-9. A planilha** (T8). Confirmar que a biblioteca escolhida congela a primeira linha, liga o filtro nela, ajusta as larguras com limite, quebra o texto em Endereço e Observações e deixa a aba "Relatórios" ativa ao abrir.
- **AQ-10. Nome do arquivo** (RN-09). Vindo do servidor (no cabeçalho da resposta) ou montado pela tela com as semanas da resposta; nunca com as semanas calculadas antes do pedido, porque a semana pode virar entre o aviso e a resposta.

### Pendências para o PO (resolvidas em 2026-11-24)
Nenhuma bloqueava o desenho. O PO resolveu todas em 2026-11-24, aceitando a opção adotada pela UX. Cada uma virou um padrão do Negócio (P-EXP-23 a P-EXP-32), e as regras, os critérios e os Textos de tela foram ajustados. Ficam para o usuário revisar no PR, com os outros padrões.

- **PO-UX-1. O nome do botão para o leitor de tela** (UXD-10). O Negócio diz "leitor de tela: Exportar os relatórios para Excel". Pela WCAG 2.5.3, o nome acessível precisa conter o texto visível ("Exportar para Excel") na mesma ordem.
  - *Adotado pela UX:* o nome acessível é "Exportar para Excel", e a descrição é "Gera a planilha dos relatórios com os filtros aplicados.".
  - *Alternativa:* o nome do Negócio. Falha na checagem do axe (`label-content-name-mismatch`), e quem usa comando de voz não acha o botão pelo que vê.
  - **Resolvida (P-EXP-23):** aceita a opção adotada. É requisito de acessibilidade (WCAG 2.5.3). O nome acessível é "Exportar para Excel", e "Gera a planilha dos relatórios com os filtros aplicados." é a descrição. O texto antigo saiu dos Textos de tela, e a RN-02 ganhou a regra e um critério.
- **PO-UX-2. A busca na planilha e no evento.** A RN-02 diz que a planilha segue a busca, mas a RN-09, a RN-11 e os Textos de tela citam só os textos dos chips, e a busca não tem chip. Sem ela, uma planilha filtrada pela busca não se distingue de uma sem filtro, nem na aba "Informações" nem na Auditoria.
  - *Adotado pela UX:* "Busca: “{texto}”" depois dos chips, no aviso (T3), na aba "Informações" e no evento.
  - *Alternativa:* a busca fica de fora dos três.
  - **Resolvida (P-EXP-24):** aceita. "Busca: “{texto}”" vem depois dos chips no aviso (RN-03), na aba "Informações" (RN-09) e no evento (RN-11). Com só a busca, ela aparece sozinha, e não "Nenhum" nem "Sem filtros".
- **PO-UX-3. Textos do aviso** (UXD-4, T3): o título "Exportar a planilha?"; "Exportar planilha" no lugar de "Exportar" (verbo e objeto); "Outros filtros" e "Nenhum"; e as notas "As semanas entram inteiras, de domingo a sábado." e "As semanas que ainda não começaram não entram.", que explicam por que as datas da frase diferem dos chips "De" e "Até".
  - *Adotado pela UX.*
  - **Resolvida (P-EXP-25):** aceita. Os textos entraram na RN-03, nos critérios dela e nos Textos de tela.
- **PO-UX-4. A geração não pode ser cancelada** (UXD-5, P122), como o envio do relatório no E2.11. A pessoa espera até 10 s, ou até o tempo-limite.
  - *Adotado pela UX.*
  - *Alternativa:* "Cancelar" interrompe o pedido; se o servidor já gravou o evento, ele fica sem planilha entregue (RN-11).
  - **Resolvida (P-EXP-26):** aceita a opção adotada. Um cancelamento no meio deixaria um evento sem planilha entregue. A RN-13 diz que a geração não é cancelada. Sair da tela durante a geração continua possível (AQ-5), e o evento, se já gravado, fica (RN-11).
- **PO-UX-5. O resultado na página, sem toast** (UXD-6, T5): "Planilha exportada." com o nome do arquivo, o número de linhas e a dica "Se o arquivo não abriu, procure nos arquivos baixados pelo navegador.".
  - *Adotado pela UX.* O número de linhas é o mesmo do evento.
  - **Resolvida (P-EXP-27):** aceita. A RN-13 passa a dizer onde fica o resultado, o que ele mostra e quando sai. O número de linhas é o mesmo do evento.
- **PO-UX-6. "Baixar de novo"** (UXD-8, P123). Entrega o mesmo arquivo, guardado no aparelho, sem pedir nada ao servidor e sem gerar outro evento, enquanto a pessoa fica na tela e não muda os filtros. Os dados já saíram do sistema e já estão no evento; guardar o arquivo de novo não é outra exportação.
  - *Adotado pela UX.*
  - *Alternativa:* sem o link. Para guardar de novo, a pessoa exporta de novo, espera a geração e gera outro evento.
  - **Resolvida (P-EXP-28):** aceita a opção adotada. "Baixar de novo" não gera evento (RN-11) e só existe enquanto o resultado está na tela (RN-13).
- **PO-UX-7. A exportação na Auditoria** (UXD-12, T10): a entidade "Relatório"; a segunda linha com os textos dos chips (até 3, separados por "; ", e "e mais {N}") ou "Sem filtros"; "(1 linha)" no singular da descrição; e "Exportação" logo depois de "Restauração" no filtro.
  - *Adotado pela UX.*
  - *Alternativa para a entidade:* uma entidade nova, "Planilha", que separa as exportações das alterações de relatório no filtro "Entidade".
  - **Resolvida (P-EXP-29):** aceita a entidade "Relatório", e não a alternativa "Planilha". "Ação: Exportação" já separa as exportações. A RN-11 ganhou a entidade, o singular, a segunda linha e o lugar no filtro.
- **PO-UX-8. A permissão na tela de Funções** (UXD-11, T9): logo depois das duas "Visualizar Relatórios…", e não no fim do grupo; e o aviso "Para valer, a função também precisa de uma permissão que mostre Relatórios.", que não impede salvar.
  - *Adotado pela UX.*
  - *Alternativa:* sem o aviso, e a dica do Negócio ganha "Só vale com uma permissão que mostre Relatórios.".
  - **Resolvida (P-EXP-30):** aceita a opção adotada, com o aviso. A RN-01 ganhou o lugar e o aviso, que não impede salvar, e um critério.
- **PO-UX-9. Recomendações para ler a planilha** (T8): a aba "Relatórios" ativa ao abrir; a primeira linha congelada e com filtro; sem células mescladas nem linhas em branco; larguras com limite e quebra de linha; e a aba "Informações" em duas colunas. Não mudam o conteúdo, as colunas nem a ordem da RN-06, da RN-08 e da RN-09.
  - *Adotado pela UX.*
  - **Resolvida (P-EXP-31):** aceita, e as recomendações viram regra na RN-09, porque cada uma pode ser conferida num teste.
- **PO-UX-10. Textos definidos pela UX** (marcados com † em Textos): os da PO-UX-1 a PO-UX-8, mais "Ainda gerando a planilha. Isso pode levar alguns segundos.", "Fechar" na recusa do servidor, "Baixar de novo a planilha {arquivo}" para o leitor de tela e os textos das alternativas da T12, que só valem se a pergunta for respondida com a alternativa.
  - *Adotados pela UX.*
  - **Resolvida (P-EXP-32):** aceitos todos, sem ajuste. Os ligados a uma regra foram copiados para os Textos de tela. Os da T12 só valem se a pergunta correspondente for respondida com a alternativa.

## Solução técnica
_Seção do `architect`._

### Modelo de dados e migrations

### Onde cada regra é imposta
| RN | Banco (constraint, RLS, trigger, RPC) | UI |
|---|---|---|

### Contratos (RPC, Edge Functions, colunas novas)

### Riscos (concorrência, escala, segurança)

## Tarefas
_Seção do `architect`._

| # | Responsável | Descrição | Arquivos | RNs | Depende de |
|---|---|---|---|---|---|

## Testes
_Seção do `qa`._

| RN | Testes | Resultado |
|---|---|---|
