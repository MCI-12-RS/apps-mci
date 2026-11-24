# E2.09: Situação do relatório por célula

> Status: desenho pronto. Negócio escrito em 2026-11-24 pelo `product-owner`, sem regras "a confirmar". Experiência (UX) escrita no mesmo dia pelo `ux-designer`; as pendências PO-UX-1 a PO-UX-7 foram resolvidas pelo PO no mesmo dia (P-SIT-12 a P-SIT-18). Solução técnica e Tarefas escritas no mesmo dia pelo `architect`, só como desenho, sem nada implementado. Ficam para o usuário revisar no PR os padrões P-SIT-01 a P-SIT-18, as decisões DA-1 a DA-8 do `architect` e as perguntas Q-1 a Q-6, que não bloqueiam (a T6 da UX mostra a tela em cada resposta, e a Solução técnica dá o custo de cada uma). O PR de banco precisa só do PR 1 do E2.01 em produção. Falta a seção Testes.
> Slug: `e2-09-situacao-relatorio` · Paridade com o legado: sim (CEL-05 e o card de pendentes da DSH-02). Tem regras novas: o prazo exato de 1 hora, as semanas que contam (célula nova, reativada ou restaurada), a célula sem nenhum relatório, a situação na lista de Células e o detalhe de "Não houve célula".

## Negócio
_Seção do `product-owner`. Escrita em 2026-11-24 e atualizada no mesmo dia com as decisões do PO sobre as pendências PO-UX-1 a PO-UX-7 da seção Experiência (UX) (P-SIT-12 a P-SIT-18). Fontes:_
- _o passo E2.09 em Progresso e as seções 3.4 (CEL-05), 3.5 (REL-01 a REL-04), 3.6 (DSH-02), 3.9, 5.4 a 5.6 do [`docs/migracao.md`](../migracao.md);_
- _o `CLAUDE.md` da raiz: "Situação do relatório" do legado, dashboard do legado e do novo, e a matriz de paridade;_
- _o legado: `Domain/Extensions/QueryingExtensions.cs` (filtro `ReportStatus`), `Domain/Model/Enum/CellReportStatus.cs`, `Domain/Extensions/DateTimeExtensions.cs`, `Domain/Model/Constants.cs`, `App/Services/DashboardService.cs`, `App/Services/ReportApp.cs`, as telas `pages/Cells/index.js`, `pages/Cells/details.js` e `pages/Home/index.js`;_
- _o `mci-connect` na `origin/main` (`4595daa`): as migrations `20261115120000_e108_read_foundation.sql` (`sp_now`, `week_start`, `weekday_index`), `20261123120000_e108_dashboard_rpcs.sql` (`cells_pending`) e `20261123233300_e201_03_read.sql` (`cells_view.last_report_date` sem os excluídos), `src/pages/Dashboard.tsx` e `src/pages/Cells.tsx`;_
- _os specs [E1.08](e1-08-paginacao-servidor.md) (RN-08, RN-09, Pontos de extensão, risco 13), [E2.01](e2-01-exclusao-logica.md) (RN-08, RN-11, RN-12, RN-17), [E2.02](e2-02-perfis-escopo.md) (RN-03, RN-04, RN-08), [E2.05](e2-05-auditoria-autor.md) (RN-10 d) e [E2.08](e2-08-cadastro-celulas.md) (RN-05, RN-06, RN-08, RN-11 e Impactos)._

Os caminhos do legado são relativos a `g12app-net/`, com as abreviações do E2.01: `App/` = `G12App.Application/`, `Domain/` = `G12App.Domain/` e `UI/` = `G12App.API/ClientApp/src/`.

### Contexto e objetivo
No legado, a situação do relatório existe em dois lugares:
- **Filtro "Situação de Relatório"** da lista de Células, com sete opções: "Relatório em dia", "Ainda não ocorreu esta semana", "Pendente/Atrasado esta semana" e "Sem relatório a 1 semana", "a 2 semanas", "a 3 semanas" e "a 4 semanas ou mais". A lista não mostra a situação de cada célula: só filtra.
- **Card "Células com Relatórios Pendentes"** do Dashboard, que conta as células da opção "Pendente/Atrasado esta semana". Ele fica vermelho quando é maior que zero, e o clique abre a lista de Células com esse filtro.

O cálculo do legado:
- A semana vai de domingo a sábado, no horário de Brasília.
- "Pendente" é a célula sem relatório na semana cujo horário de reunião, mais cerca de 1 hora, já passou. "Ainda não ocorreu" é o contrário. "Em dia" é a célula com relatório na semana ou que ainda não se reuniu.
- "Sem relatório a N semanas" conta as semanas desde o último relatório, sem contar a semana atual.
- As opções se sobrepõem: uma célula pode estar "Pendente" e "Sem relatório a 2 semanas" ao mesmo tempo.
- Qualquer relatório não excluído conta, inclusive "Não houve célula".
- As situações `Cancelled*` existem no modelo, mas não foram implementadas.
- O legado não tem célula inativa, e a célula nova fica pendente na hora, se a reunião da semana já passou (Impactos do E2.08).

Hoje o novo (conferido na `origin/main`, `4595daa`, em 2026-11-24):
- **Não há situação por célula.** A `cells_view` só expõe `last_report_date`, a data do último relatório não excluído (E1.08, PR 2; E2.01, PR 1).
- **O card do Dashboard se chama "Células sem Relatório"** e conta, pelo `dashboard_summary.cells_pending`, as células ativas e visíveis sem relatório na semana cujo horário de reunião já chegou, **sem tolerância**: uma célula de quarta às 20:00 entra às 20:00. Sem horário, entra às 23:59:59 do dia; com dia desconhecido, nunca entra.
- **O cálculo usa `last_report_date`.** Para a semana atual, o número é exato. Para uma semana passada (o parâmetro `_at`, usado nos testes), uma célula com relatório numa semana posterior não conta (risco 13 do E1.08).
- **A célula cadastrada ou reativada depois da reunião da semana conta como pendente na hora**, como no legado.
- **A célula inativa já fica fora do card** (E2.08, RN-11 b).

Objetivo do passo:
- definir a situação do relatório de cada célula, com a regra exata de cada valor, o prazo depois do horário da reunião, a virada de semana e o fuso;
- definir o que acontece com a célula nova, reativada ou restaurada no meio da semana, e com a célula sem nenhum relatório;
- mostrar a situação na lista de Células;
- fazer o card de pendentes do Dashboard usar a mesma definição, num cálculo só;
- deixar a definição pronta para o filtro e o detalhe da célula (E2.10) e para o clique, a cor e o gráfico do Dashboard (E2.14).

### Termos
- **Semana:** de domingo, 00:00, a sábado, 23:59:59, no horário de Brasília (`America/Sao_Paulo`).
- **Agora:** o momento da consulta, no horário de Brasília, segundo o servidor. O relógio do aparelho de quem consulta não conta.
- **Reunião da semana:** o dia e o horário atuais da célula, naquela semana (RN-08 do E2.08).
- **Prazo:** 1 hora depois do horário da reunião da semana (RN-02). Antes do prazo, o relatório que falta não é pendência.
- **Relatório da semana:** um relatório não excluído da célula com data dentro da semana (RN-03). "Não houve célula" também é relatório da semana.
- **Semana que conta:** a semana em que, no prazo da reunião, a célula já estava cadastrada, ativa e não excluída (RN-06). Só ela pode ficar pendente.
- **Situação do relatório** (CEL-05): duas informações sobre cada célula:
  - a **situação da semana** (RN-04): Enviado, Ainda não ocorreu, Pendente ou Conta a partir da próxima semana;
  - as **semanas anteriores sem relatório** (RN-05): 1, 2, 3 ou 4 ou mais.
- **Situação da célula:** ativa ou inativa (E2.08). É outra coisa. Na tela, a situação do relatório aparece como "Relatório", para não confundir com a coluna "Situação".
- **Card de pendentes:** o card "Células com relatório pendente" do Dashboard (RN-08).

### Personas e permissões
Os nomes entre aspas são os rótulos da tela de Funções (RN-22 do E2.02). Nenhuma permissão nova.

| Persona | Quem é | Permissões | O que faz neste spec |
|---|---|---|---|
| IG Quem vê a igreja toda | Rita, função Administrador | "Visualizar Toda a Igreja" e "Visualizar Dashboard" | vê a situação de todas as células e o card da igreja |
| MI Quem vê só o ministério | Pedro, função Líder | "Visualizar Seu Ministério" e "Visualizar Dashboard" | vê a situação das células do escopo (E2.02) e o card do ministério |
| PC Pessoa da célula | Caio (timóteo de C1), função Membro | as da função Membro | vê a situação das células que vê; lança o relatório pelas regras do E2.11 |
| SD Sem acesso ao Dashboard | sem "Visualizar Dashboard" | — | não vê o card (RN-09 do E1.08); vê a situação na lista, se vê as células |
| SI Sistema | o servidor | — | calcula a situação e registra quando a célula foi cadastrada, inativada, reativada, excluída e restaurada |
| CG Carga do legado | scripts E4.06 a E4.09 | — | traz as células e os relatórios; a situação é calculada depois (RN-10) |

### Histórias
- Como liderança (pastores e G12), quero ver quais células do meu ministério estão com o relatório pendente nesta semana, para acompanhar os líderes a tempo.
- Como líder, quero ver na lista de Células se o relatório da minha célula desta semana já foi enviado.
- Como liderança, quero saber há quantas semanas uma célula não envia relatório, para encontrar as células que pararam.
- Como quem cadastra ou reativa uma célula, quero que ela não fique pendente por uma reunião que passou antes de ela estar em uso no sistema.
- Como pastor, quero que o card do Dashboard e a lista de Células deem o mesmo número, para confiar nele.

### Decisões

#### Decisões do usuário e de passos anteriores
| Decisão | O que vale aqui | Onde |
|---|---|---|
| D1 (2026-11-14) e DEL-03 | A célula excluída não tem situação; o relatório excluído não conta e libera a semana. | RN-01, RN-03 |
| RN-08 (a, d) e RN-09 do E1.08; D-3 (2026-11-15) | Semana de domingo a sábado em Brasília, calculada no banco; qualquer relatório da semana conta, visível ou não; acesso ao Dashboard. | RN-02, RN-03, RN-08 |
| Pontos de extensão e risco 13 do E1.08 | A situação do relatório substitui o cálculo atual do `cells_pending`, sem o limite da semana passada. | RN-02, RN-08 |
| RN-08 e RN-11 (b) do E2.08 | Dia e horário atuais valem na hora; a célula inativa não tem situação e não conta como pendente. | RN-01, RN-02 |
| RN-05 e RN-06 do E2.08 | Dia e horário obrigatórios, do tipo (a), para toda célula. | RN-07 |
| RN-08, RN-11, RN-12 e RN-17 do E2.01 | Os excluídos somem das contagens; o relatório excluído libera a semana; a célula e o relatório podem ser restaurados. | RN-01, RN-03, RN-06 |
| RN-03, RN-04 e RN-08 do E2.02 | A célula entra no escopo por qualquer uma das três pessoas; o escopo vale na hora. | RN-09 |
| RN-10 (d) do E2.05 | Célula do legado sem data de cadastro: "data não registrada". | RN-06, RN-10 |
| 3.9 do plano | As situações `Cancelled*` não serão replicadas. | Fora de escopo |

#### Padrões definidos por este spec (revisar no PR)
Estes pontos não estão nas fontes, ou o legado não os define com precisão. O PO adotou a opção mais conservadora e coerente com o legado e com os specs anteriores. Nas regras, eles aparecem como "definida pelo spec", e o usuário pode mudar qualquer um na revisão do PR.

- **P-SIT-01, prazo exato de 1 hora** (RN-02).
  - O legado pretende "horário da reunião mais 1 hora". O spec fixa: o prazo é exatamente 60 minutos depois do horário, e no prazo em ponto a célula já fica pendente. Uma célula de quarta às 20:00 fica pendente às 21:00:00.
  - Hoje o novo conta a célula às 20:00, sem tolerância. A tolerância de 1 hora volta, como no legado: durante a reunião, a célula não é pendência.
  - Reunião a partir das 23:00: o prazo cai no dia seguinte. Se o dia seguinte já é da outra semana (sábado a partir das 23:00), a célula não fica pendente na semana dela, e a semana entra nas semanas anteriores sem relatório a partir do domingo. É o efeito que o legado já tinha para essas células.
- **P-SIT-02, duas informações, cada uma com um valor só** (RN-04, RN-05).
  - No legado, as opções do filtro se sobrepõem, e "Relatório em dia" inclui a célula que ainda não se reuniu, mesmo que ela esteja sem relatório há semanas. Mostrar uma etiqueta só na lista esconderia uma das informações.
  - O spec separa: a situação da semana tem exatamente um valor por célula, e as semanas anteriores sem relatório vêm à parte, só quando são 1 ou mais.
  - O filtro do E2.10 pode continuar oferecendo as opções do legado, que se sobrepõem, a partir dessas duas informações (ver Impactos).
- **P-SIT-03, semanas que contam** (RN-06). É o padrão que mais muda o resultado.
  - No legado, a célula cadastrada depois da reunião da semana fica pendente na hora. Para tirar a pendência, o líder precisaria lançar "Não houve célula", com justificativa, para uma reunião que não estava marcada. Isso suja o histórico e o gráfico de células não realizadas (DSH-04).
  - O spec: só fica pendente a semana em que, no prazo da reunião, a célula já estava cadastrada, ativa e não excluída. A célula cadastrada, reativada ou restaurada depois do prazo aparece como "Conta a partir da próxima semana". Se ela se reuniu e o relatório for enviado, fica "Enviado".
  - Inativar e reativar sem passar nenhum prazo inativa não muda nada. Assim, inativar e reativar não serve para tirar uma pendência.
  - A alternativa é seguir o legado: a célula fica pendente na hora, mesmo cadastrada depois da reunião.
- **P-SIT-04, célula sem relatório e recomeço da contagem** (RN-05).
  - No legado, a contagem parte da data do último relatório, e a célula sem nenhum relatório não tem essa data.
  - O spec: a célula sem nenhum relatório conta desde a primeira semana que conta. Assim, uma célula cadastrada há 3 semanas que nunca enviou relatório aparece com "Sem relatório nas 3 semanas anteriores".
  - Uma semana que não conta (a célula estava inativa ou excluída no prazo) interrompe a contagem. Reativar recomeça do zero, em vez de mostrar "4 ou mais" no dia seguinte.
- **P-SIT-05, dia ou horário ausentes** (RN-07). Depois do E2.08, não existem. Se existirem, segue-se o E1.08: sem dia válido, a célula não tem situação; sem horário, a reunião vale como no fim do dia, e o prazo é 00:00 do dia seguinte.
- **P-SIT-06, situação na lista de Células** (RN-09). O legado só filtra. O spec mostra a situação em cada célula da lista, porque é o que o líder e o G12 procuram, e porque o filtro só chega no E2.10.
- **P-SIT-07, nome do card** (RN-08). Volta o nome do legado, "Células com relatório pendente", no lugar de "Células sem Relatório". O nome atual se confunde com "Sem relatório nas N semanas anteriores".
- **P-SIT-08, atualização da lista** (RN-09). A situação é a da última consulta. Depois de uma ação no app que muda relatórios ou a célula, a lista já mostra a situação nova. A passagem do tempo com a lista aberta só aparece na consulta seguinte.
- **P-SIT-09, reconciliação** (RN-10). Na comparação do Dashboard com o legado (5.6), o card de pendentes só pode diferir pelas regras deste spec, e o script lista cada célula que difere, com o motivo.
- **P-SIT-10, detalhe do "Enviado"** (RN-04 a). O legado conta "Não houve célula" como relatório em dia, sem distinguir. O spec mostra "Enviado · Célula realizada" ou "Enviado · Não houve célula", com os termos da exportação (REL-14).
- **P-SIT-11, textos** (Textos de tela). "Enviado", como no card "Relatórios enviados"; "Ainda não ocorreu" e "Pendente", como no legado; "Sem relatório na semana passada" e "nas N semanas anteriores" no lugar de "Sem relatório a N semanas", que deixa em dúvida se a semana atual entra.
- **Vindos do desenho de UX (2026-11-24, PO-UX-1 a PO-UX-7 em "Experiência (UX)"):**
  - **P-SIT-12, detalhe do "Enviado" para todos** (PO-UX-1, RN-03, RN-04 a).
    - O "Enviado" vem sempre com "Célula realizada" ou "Não houve célula", também para quem vê a célula, mas não vê o relatório.
    - O detalhe não mostra nada do conteúdo do relatório (tema, motivo, participantes, visitantes, oferta). Escondê-lo exigiria saber, linha a linha, se o relatório é visível.
    - Consequência aceita: no caso raro do relatório invisível de uma célula visível, a célula aparece "Enviado · Não houve célula", mas esse relatório não entra no card "Células Não Realizadas", que conta só os relatórios visíveis (E1.08).
  - **P-SIT-13, os dois "Enviado" com o mesmo tom e ícone** (PO-UX-2). O relatório foi enviado e a célula não fica pendente, como no legado ("Relatório em dia"). Destacar as células que deixaram de se reunir é a Q-2.
  - **P-SIT-14, "Pendente" em amarelo na lista** (PO-UX-3). É um aviso, e não um erro: o líder ainda pode enviar o relatório. A cor do card do Dashboard continua com o E2.14 (DSH-06: vermelho com pendentes e verde sem). O card resume a quantidade, e o badge marca a célula; as duas cores podem conviver, e o E2.14 decide se alinha.
  - **P-SIT-15, legenda "Entenda a situação do relatório"** (PO-UX-4, RN-09). Na lista de Células, fechada por padrão, explica cada valor. Os textos novos (os dois "Enviado", as semanas anteriores e o rodapé) foram aceitos e estão em Textos de tela. O rodapé diz na própria tela que a situação é a do momento em que a lista foi carregada (P-SIT-08).
  - **P-SIT-16, card do Dashboard** (PO-UX-5, RN-08).
    - O título novo tem só a primeira letra maiúscula, como o E2.08 fez com "Nova célula".
    - O ícone passa do relógio para o triângulo do "Pendente", porque na lista o relógio quer dizer "Ainda não ocorreu".
    - Os títulos dos cards quebram linha sem cortar.
    - Passar os outros três títulos da seção para o mesmo padrão ("Relatórios enviados", "Visitantes em células" e "Células não realizadas") fica para o E2.14.
  - **P-SIT-17, "Novo relatório" continua na célula "Enviado"** (PO-UX-6). A situação não libera nem bloqueia o lançamento (RN-01) e pode estar desatualizada (P-SIT-08). Evitar que a pessoa preencha tudo para só então receber a recusa de um por semana é decisão do E2.11 (ver Impactos).
  - **P-SIT-18, textos da UX** (PO-UX-7). Aceitos:
    - "Reunião", o título da coluna da tabela que junta tipo, dia e horário. É o nome do grupo desses campos no formulário de célula (E2.08);
    - o botão e os textos novos da legenda;
    - "Não se aplica, célula inativa" e "Situação indisponível", para o leitor de tela;
    - os textos da T6, que só valem se a pergunta correspondente (Q-1 a Q-6) virar regra.

### Regras de negócio
Nenhuma regra está "a confirmar".

Correspondência com o plano: CEL-05 → RN-01 a RN-07 e RN-09 · DSH-02 (células com relatório pendente) → RN-08.

| ID | Regra | Origem |
|---|---|---|
| RN-01 | **Alcance.**<br>- Toda célula ativa e não excluída tem situação do relatório, de qualquer tipo (Evangelística, Discipulado e Macrocélula), com as mesmas regras.<br>- A célula inativa (RN-11 b do E2.08) e a excluída (RN-08 e RN-11 do E2.01) não têm situação e nunca contam como pendentes. Inativar ou excluir uma célula pendente a tira do card na consulta seguinte.<br>- A situação é calculada pelo servidor a cada consulta. Ninguém a informa nem a altera.<br>- É só informativa: não libera nem bloqueia o lançamento, a edição ou a exclusão de relatórios. Essas regras são do E2.11 e do E2.01.<br>- As pessoas da célula não mudam a situação: o líder pode ser pastor, sem liderança ou inativo. Cada célula tem a sua situação; as células de um casal continuam separadas. | CEL-05; legado (`Domain/Extensions/QueryingExtensions.cs:233-304`: o filtro vale para toda célula não excluída, sem distinção de tipo nem de pessoa); E2.08 (RN-11 b); E2.01 (RN-08, RN-11) |
| RN-02 | **Semana, reunião e prazo.**<br>- A semana vai de domingo, 00:00, a sábado, 23:59:59, no horário de Brasília (`America/Sao_Paulo`). O relógio do aparelho de quem consulta não conta.<br>- A reunião da semana é o dia e o horário atuais da célula, naquela semana. Mudar o dia ou o horário vale na consulta seguinte (RN-08 do E2.08).<br>- O **prazo** é exatamente 1 hora depois do horário da reunião. No prazo em ponto, a célula já pode ficar pendente: a célula de quarta às 20:00 fica pendente às 21:00:00, e não às 20:59:59.<br>- Reunião a partir das 23:00: o prazo cai no dia seguinte (sexta às 23:30 → sábado às 00:30). Se o dia seguinte já é da outra semana (sábado a partir das 23:00), a célula não fica pendente nessa semana, e a semana entra nas semanas anteriores sem relatório (RN-05) a partir do domingo.<br>- Na tela, a situação é sempre a de agora. Para outro momento de referência (testes e uma eventual navegação por semana do E2.14), valem as mesmas regras, na semana desse momento, e os relatórios de semanas posteriores não contam. | CEL-05; legado (`Domain/Extensions/DateTimeExtensions.cs:8-13`: semana a partir do domingo, cultura pt-BR; `Domain/Model/Constants.cs:8-12`: horário de Brasília; `QueryingExtensions.cs:251-277`: horário da célula mais 1 hora); E1.08 (RN-08; risco 13); E2.08 (RN-08); prazo exato e viradas de dia e de semana: definida pelo spec (P-SIT-01) |
| RN-03 | **Relatório da semana.**<br>- É qualquer relatório não excluído da célula com data dentro da semana. Vale a data do relatório, e não o momento do lançamento.<br>- Conta mesmo que quem consulta não veja o relatório (RN-08 d do E1.08). Nesse caso, a célula também mostra o detalhe do "Enviado" (RN-04 a).<br>- "Não houve célula" conta: a célula não fica pendente.<br>- O relatório excluído não conta. Excluir o relatório da semana libera a semana (DEL-03), e a célula volta a ficar pendente se o prazo já passou (RN-12 do E2.01). Restaurar o relatório volta a contar. | legado (`QueryingExtensions.cs:248`, `:260` e `:271`: relatórios não excluídos com data a partir do domingo da semana, sem olhar `WeekCellSkipped`); E1.08 (RN-08 d); E2.01 (RN-08, RN-12, RN-17); DEL-03; detalhe para quem não vê o relatório: definida pelo spec (P-SIT-12, PO-UX-1) |
| RN-04 | **Situação da semana.** Toda célula com situação (RN-01) tem exatamente um destes valores, conferidos nesta ordem:<br>(a) **Enviado:** tem relatório da semana (RN-03). Vem com o detalhe "Célula realizada" ou "Não houve célula", conforme o relatório, para todos que veem a célula, também para quem não vê o relatório: o detalhe não mostra nada do conteúdo. Os dois "Enviado" têm a mesma aparência na tela. Vale até o fim da semana.<br>(b) **Ainda não ocorreu:** não tem relatório da semana, e o prazo ainda não chegou.<br>(c) **Pendente:** não tem relatório da semana, o prazo já chegou, e a semana conta para a célula (RN-06).<br>(d) **Conta a partir da próxima semana:** não tem relatório da semana, o prazo já chegou, mas a semana não conta para a célula (RN-06).<br><br>No domingo, às 00:00, a situação da semana recomeça. | CEL-05; legado (`QueryingExtensions.cs:247-278`: `Current`, `NotDoneYet` e `OverDueThisWeek`; `UI/pages/Cells/index.js:198-206`: "Ainda não ocorreu esta semana" e "Pendente/Atrasado esta semana"); valores exclusivos: definida pelo spec (P-SIT-02); (d): definida pelo spec (P-SIT-03); detalhe do (a): definida pelo spec (P-SIT-10, P-SIT-12 e P-SIT-13; PO-UX-1 e PO-UX-2) |
| RN-05 | **Semanas anteriores sem relatório.**<br>- É o número de semanas completas antes da semana atual sem relatório da semana (RN-03), contadas de trás para frente a partir da semana passada. A contagem para na primeira semana com relatório ou na primeira semana que não conta (RN-06).<br>- Com relatório nesta semana, a contagem é zero: a célula voltou a enviar.<br>- Não inclui a semana atual, que aparece na situação da semana (RN-04). Uma célula "Pendente" com "Sem relatório na semana passada" está há duas reuniões sem relatório.<br>- Valores: 1, 2, 3 e "4 ou mais". O zero não aparece.<br>- A célula sem nenhum relatório conta desde a primeira semana que conta para ela.<br>- A contagem não muda durante a semana por causa do relógio. Ela muda no domingo, às 00:00, e quando muda um relatório da célula (enviado, com a data alterada, excluído ou restaurado) ou a própria célula (dia, horário, inativação, reativação, exclusão ou restauração). | CEL-05; legado (`QueryingExtensions.cs:238-241` e `:280-301`: semanas de domingo a sábado desde o último relatório não excluído, até "4 ou mais"; `UI/pages/Cells/index.js:203-206`); célula sem relatório e semanas que não contam: definida pelo spec (P-SIT-04) |
| RN-06 | **Semanas que contam: célula nova, inativa, reativada, excluída ou restaurada.**<br>- Uma semana conta para a célula quando, no prazo da reunião daquela semana (RN-02), a célula já estava cadastrada, ativa e não excluída. O prazo de cada semana usa o dia e o horário atuais da célula.<br>- Só a semana que conta fica "Pendente" (RN-04 c) e entra nas semanas anteriores sem relatório (RN-05).<br>- **Célula cadastrada:** antes do prazo da semana, inclusive entre o horário da reunião e o prazo, ou no prazo em ponto, a semana conta. Depois do prazo, a semana não conta: "Conta a partir da próxima semana".<br>- **Célula reativada ou restaurada** depois de passar o prazo da semana inativa ou excluída: a semana não conta. As semanas em que ela estava inativa ou excluída no prazo também não contam e interrompem a contagem da RN-05: reativar recomeça do zero.<br>- **Inativar e reativar** (ou excluir e restaurar) sem passar nenhum prazo nesse estado não muda nada. Não serve para tirar uma pendência.<br>- **Data de cadastro:** a da célula (E2.05). Na célula do legado sem data de cadastro ("data não registrada", RN-10 d do E2.05), todas as semanas contam.<br>- **Células que já existem no novo na publicação deste passo:** a ativa conta como ativa desde o cadastro; a inativa conta como inativa em todas as semanas anteriores à publicação.<br>- Quando a célula foi cadastrada, inativada, reativada, excluída e restaurada é registrado pelo sistema. Ninguém informa nem altera esses momentos, nem pela API. | legado (sem célula inativa; a célula nova fica pendente na hora: Impactos do E2.08); E2.08 (RN-08; RN-11: reativar devolve às pendências; Impactos: o E2.09 decide a célula cadastrada ou reativada depois da reunião); E2.01 (RN-17); E2.05 (RN-03, RN-10 d); definida pelo spec (P-SIT-03, P-SIT-04) |
| RN-07 | **Dia ou horário ausentes ou inválidos.** Depois das regras do E2.08 (RN-05 e RN-06 de lá, do tipo a), toda célula tem dia e horário válidos, e esta regra não se aplica. Ela vale se este passo for publicado antes, ou para dados de teste:<br>- **Sem dia, ou com um dia fora dos sete valores:** a célula não tem situação, como a inativa, e nunca conta como pendente. A lista mostra "Sem dia da reunião".<br>- **Com dia e sem horário:** a reunião vale como no fim do dia, e o prazo é 00:00 do dia seguinte. No sábado sem horário, a célula não fica pendente na semana. | E1.08 (dia desconhecido nunca conta; sem horário, conta a partir do fim do dia: `20261123120000_e108_dashboard_rpcs.sql:57-61`); E2.08 (RN-05, RN-06); adaptação ao prazo: definida pelo spec (P-SIT-05) |
| RN-08 | **Card de pendentes: uma definição só.**<br>- O card do Dashboard passa a se chamar **"Células com relatório pendente"**, com o mesmo ícone do "Pendente" da lista, e conta as células visíveis com a situação da semana "Pendente" (RN-04 c), no momento da consulta.<br>- Para a mesma pessoa e o mesmo momento, o card mostra o mesmo número de células que a lista de Células mostra como "Pendente".<br>- Muda em relação a hoje: o prazo de 1 hora (RN-02) e as semanas que não contam (RN-06).<br>- Continua como hoje: o escopo (DSH-01), o acesso ao Dashboard (RN-09 do E1.08), só as células ativas e não excluídas, e qualquer relatório da semana, visível ou não. | DSH-02; legado (`App/Services/DashboardService.cs:80-87`: o card usa `OverDueThisWeek`; `UI/pages/Home/index.js:112-116`: "Células com Relatórios Pendentes"); E1.08 (RN-08 a e d; Pontos de extensão: o `cells_pending` passa a usar a situação do E2.09); nome e ícone: definida pelo spec (P-SIT-07, P-SIT-16; PO-UX-5) |
| RN-09 | **Onde a situação aparece neste passo.**<br>- **Lista de Células,** nos cartões e na tabela: cada célula com situação mostra a situação da semana (RN-04) e, quando houver, as semanas anteriores sem relatório (RN-05). A célula inativa continua só com "Inativa" (E2.08).<br>- **Legenda da lista:** "Entenda a situação do relatório", fechada por padrão, explica cada valor e as semanas anteriores, com os textos de Textos de tela. A explicação não depende de passar o mouse sobre a célula.<br>- **Dashboard:** o card da RN-08.<br>- **Quem vê:** quem vê a célula (RN-03 do E2.02), sem permissão nova. O card segue o acesso ao Dashboard (RN-09 do E1.08).<br>- **Atualização:** a situação mostrada é a da última consulta. Depois de lançar, editar, excluir ou restaurar um relatório, ou de editar, inativar, reativar ou restaurar uma célula pelo app, a lista já mostra a situação nova, sem recarregar a página. A passagem do tempo com a lista aberta (por exemplo, o prazo chegar) aparece na consulta seguinte.<br>- **Fronteiras:** o filtro por situação (CEL-06) e a situação no detalhe da célula (CEL-07) são do E2.10; o clique no card, a cor do card e o gráfico da semana (DSH-04 a DSH-06) são do E2.14. Todos usam as definições deste spec. | legado (`UI/pages/Cells/index.js:41-79`: a lista não mostra a situação; `:196-212`: só o filtro; `UI/pages/Home/index.js:18-20`: o clique no card abre o filtro); E2.02 (RN-03, RN-08); E1.08 (RN-09); na lista: definida pelo spec (P-SIT-06); atualização: E2.08 (RN-08) e definida pelo spec (P-SIT-08); legenda: definida pelo spec (P-SIT-15, PO-UX-4) |
| RN-10 | **Carga do legado.**<br>- A situação não é migrada: ela é calculada a partir das células e dos relatórios carregados.<br>- A data de cadastro do legado vale para a RN-06. Sem data, todas as semanas contam.<br>- Todas as células migram ativas (E2.08), então todas as semanas desde o cadastro contam.<br>- Os relatórios excluídos no legado, inclusive os duplicados da mesma semana (5.4), não contam.<br>- Na reconciliação (5.6), o card de pendentes da semana de referência pode diferir do legado só pelas regras definidas por este spec (o prazo exato da RN-02 e as semanas que não contam da RN-06). O script lista cada célula que difere, com o motivo. | 5.4, 5.5 e 5.6 do `docs/migracao.md`; E2.05 (RN-10 d); E2.08 (RN-13 e Dados do legado: todas migram ativas); reconciliação: definida pelo spec (P-SIT-09) |

#### Resumo do cálculo
Para uma célula ativa, não excluída e com dia válido (RN-01, RN-07):

| Relatório da semana (RN-03) | Prazo chegou (RN-02) | A semana conta (RN-06) | Situação da semana (RN-04) | No card (RN-08) |
|---|---|---|---|---|
| sim | — | — | Enviado · Célula realizada, ou Enviado · Não houve célula | não |
| não | não | — | Ainda não ocorreu | não |
| não | sim | sim | Pendente | sim |
| não | sim | não | Conta a partir da próxima semana | não |

As semanas anteriores sem relatório (RN-05) aparecem ao lado, em qualquer linha exceto "Enviado", quando são 1 ou mais. Célula inativa, excluída ou sem dia válido: sem situação e fora do card.

### Critérios de aceite
Convenções:
- "Hoje" é terça, 24/11/2026. A semana atual vai de domingo, 22/11, a sábado, 28/11/2026. A semana passada vai de 15/11 a 21/11.
- Os horários são de Brasília (UTC−3). Quando importa, o horário em UTC vem entre parênteses.
- "Na lista" é a lista de Células de quem consulta. "No card" é o card "Células com relatório pendente" do Dashboard.
- As células da massa estão ativas e foram cadastradas antes de 01/10/2026, salvo indicação.
- Cada critério parte da massa original.

Massa de exemplo, coerente com a do E2.08:

| Pessoa ou célula | Situação |
|---|---|
| Samuel e Magda | pastores (casal) |
| Pedro | G12, discípulo de Samuel, casado com Paula. Função Líder: vê só o ministério; tem "Visualizar Dashboard" e "Editar Célula". |
| Paula | esposa de Pedro, G12 |
| André | discípulo de Pedro |
| Caio | discípulo de André; função Membro; timóteo de C1 |
| Carla | discípula de Paula; função Membro; anfitriã de C1 |
| Fábio | discípulo de André, inativo |
| Ester | sem liderança |
| Diego | líder de outro ministério, que Pedro não vê |
| Rita | função Administrador: vê a igreja toda e tem "Visualizar Dashboard" |
| C1 | de André (timóteo Caio, anfitriã Carla); quarta, 20:00; Evangelística; relatório na quarta 18/11 e em todas as semanas anteriores; nenhum nesta semana |
| C2 | de Diego; quarta, 20:00; relatório na semana passada; nenhum nesta semana |
| C3 | de Fábio; sexta, 23:30; relatório na semana passada |
| C4 | de Ester; sábado, 23:30; relatório na semana passada |
| C5 | de Samuel; segunda, 19:30; Discipulado; relatório "Não houve célula" desta semana, com a data prevista (segunda, 23/11, 19:30) |
| C6 | de Paula; quinta, 20:00; Discipulado; cadastrada no domingo, 01/11/2026, às 10:00; nenhum relatório |
| C7 | de André; terça, 20:00; inativa desde 01/09/2026; último relatório em 25/08/2026 |
| C8 | de André; quarta, 19:00; excluída na terça, 10/11/2026, quando estava ativa; último relatório na quarta, 04/11 |
| C9 | de Pedro; quarta, 19:30; Macrocélula; último relatório na quarta, 04/11 (semana de 01/11 a 07/11) |

- **RN-01**
  - Dada C7, inativa
  - Quando Rita abre a lista na quinta, 26/11, às 22:00
  - Então C7 aparece com "Inativa" e sem situação do relatório, e não conta no card.
  - Dado que, na quinta, 26/11, às 10:00, o card de Rita mostra 3
  - Quando Pedro inativa C1
  - Então, na consulta seguinte, C1 fica sem situação, e o card de Rita mostra 2.
  - Dada C8, excluída
  - Então ela não aparece na lista de ninguém e não conta no card de ninguém.
  - Dada C9, Macrocélula
  - Quando é quarta, 25/11, às 20:30
  - Então C9 está "Pendente", pela mesma regra das outras células.
  - Dadas C3 (líder inativo), C4 (líder sem liderança) e C5 (líder pastor)
  - Quando Rita abre a lista no sábado, 28/11, às 00:30
  - Então C3 está "Pendente", C4 está "Ainda não ocorreu" e C5 está "Enviado · Não houve célula", pelas regras gerais.
  - Dadas C6, de Paula, e C9, de Pedro, que são casados
  - Quando Pedro abre a lista
  - Então cada uma aparece com a sua situação, em linhas separadas, e cada uma conta no card como uma célula.
  - Dada C1 "Pendente"
  - Quando Carla abre "Novo relatório" de C1
  - Então nada no formulário depende da situação. As regras de lançamento são as do E2.11.
- **RN-02**
  - Dada C1, sem relatório nesta semana
  - Quando é quarta, 25/11, às 20:59:59 (23:59:59 UTC)
  - Então C1 está "Ainda não ocorreu" e não conta no card.
  - Quando são 21:00:00 (00:00:00 UTC de quinta, 26/11)
  - Então C1 está "Pendente" e conta no card.
  - Dada C9 (quarta, 19:30)
  - Quando é quarta, 25/11, às 20:29 e às 20:30
  - Então C9 está "Ainda não ocorreu" às 20:29 e "Pendente" às 20:30.
  - Dada C3 (sexta, 23:30), sem relatório nesta semana
  - Quando é sexta, 27/11, às 23:59, e sábado, 28/11, às 00:29
  - Então C3 está "Ainda não ocorreu".
  - Quando é sábado, 28/11, às 00:30
  - Então C3 está "Pendente".
  - Dada C4 (sábado, 23:30), sem relatório nesta semana
  - Quando é sábado, 28/11, às 23:59:59
  - Então C4 está "Ainda não ocorreu" e não conta no card: o prazo cai no domingo.
  - Quando é domingo, 29/11, às 00:00
  - Então C4 está "Ainda não ocorreu", com "Sem relatório na semana passada".
  - Dada C1 sem relatório nesta semana
  - Quando é sábado, 28/11, às 23:59:59 (02:59:59 UTC de domingo)
  - Então C1 está "Pendente".
  - Quando é domingo, 29/11, às 00:00:00 (03:00:00 UTC)
  - Então C1 está "Ainda não ocorreu", com "Sem relatório na semana passada", e o card de Pedro mostra 0.
  - Dado Pedro com o celular no horário de Lisboa (UTC+0)
  - Quando são 23:30 de quarta, 25/11, em Lisboa (20:30 em Brasília)
  - Então ele vê C1 como "Ainda não ocorreu". Com o servidor numa sessão em UTC, o resultado é o mesmo.
  - Dado que é quinta, 26/11, às 10:00
  - Quando Rita muda o dia de C6 de quinta para terça
  - Então, na consulta seguinte, C6 está "Pendente" (o prazo de terça, 21:00, já passou) e conta no card.
  - Quando Rita muda C1 para sábado, às 19:00
  - Então, na consulta seguinte, C1 está "Ainda não ocorreu" e sai do card (RN-08 do E2.08).
  - Dada uma célula de quarta, 20:00, sem relatório na semana passada e com relatório nesta semana
  - Quando a situação é calculada para sexta, 20/11, às 10:00 (teste com outro momento de referência)
  - Então ela está "Pendente" naquela semana: o relatório desta semana não conta (risco 13 do E1.08).
- **RN-03**
  - Quando Carla envia, na quinta, 26/11, às 10:30, o relatório de C1 com a data de quarta, 25/11, 20:00
  - Então C1 passa a "Enviado · Célula realizada" e sai do card. O card de Rita vai de 3 para 2.
  - Dada C5, com "Não houve célula" nesta semana
  - Quando é segunda, 23/11, às 20:30, ou qualquer momento depois, até sábado
  - Então C5 está "Enviado · Não houve célula" e não conta no card.
  - Dado o relatório desta semana de C1, enviado na quinta
  - Quando quem tem "Excluir Relatórios de Células" o exclui no sábado, 28/11, às 10:00
  - Então C1 volta a "Pendente" e ao card.
  - Quando o relatório é restaurado
  - Então C1 volta a "Enviado · Célula realizada" e sai do card.
  - Dado um relatório desta semana de C1, com a célula realizada, que Pedro não vê (RN-04 do E2.02)
  - Quando Pedro abre a lista e o Dashboard
  - Então C1 aparece como "Enviado · Célula realizada" e não conta no card dele, e o relatório continua fora da lista de Relatórios dele.
  - Dado que esse relatório é de "Não houve célula"
  - Então C1 aparece como "Enviado · Não houve célula", e o card "Células Não Realizadas" de Pedro não conta esse relatório, porque ele não o vê (P-SIT-12).
- **RN-04**
  - Dada a massa
  - Quando Rita abre a lista na quinta, 26/11, às 10:00
  - Então vê exatamente uma situação da semana em cada célula ativa:
    - C1: "Pendente";
    - C2: "Pendente";
    - C3: "Ainda não ocorreu";
    - C4: "Ainda não ocorreu";
    - C5: "Enviado · Não houve célula";
    - C6: "Ainda não ocorreu", com "Sem relatório nas 3 semanas anteriores";
    - C9: "Pendente", com "Sem relatório nas 2 semanas anteriores";
    - C7: só "Inativa", sem situação do relatório.
- **RN-05**
  - Dada C1, com relatório na semana passada
  - Quando Pedro abre a lista na terça, 24/11
  - Então C1 não mostra semanas anteriores sem relatório.
  - Dada C9, com o último relatório em 04/11
  - Quando Pedro abre a lista na terça, 24/11
  - Então C9 mostra "Sem relatório nas 2 semanas anteriores" (08/11 a 14/11 e 15/11 a 21/11).
  - Quando é quarta, 25/11, às 20:30, sem relatório
  - Então C9 está "Pendente", e a contagem continua 2.
  - Quando é domingo, 29/11, sem relatório
  - Então C9 mostra "Sem relatório nas 3 semanas anteriores". No domingo, 06/12, sem relatório, mostra "Sem relatório nas 4 ou mais semanas anteriores".
  - Quando o relatório de C9 desta semana é enviado
  - Então C9 está "Enviado · Célula realizada", sem a contagem.
  - Dada uma célula com o último relatório em 28/10 (semana de 25/10 a 31/10)
  - Então, na terça, 24/11, ela mostra "Sem relatório nas 3 semanas anteriores". Com o último relatório em 21/10 (semana de 18/10 a 24/10), mostra "Sem relatório nas 4 ou mais semanas anteriores".
  - Dada C6, cadastrada no domingo, 01/11, às 10:00, sem nenhum relatório
  - Então, na terça, 24/11, ela mostra "Sem relatório nas 3 semanas anteriores": as semanas de 01/11, 08/11 e 15/11 contam.
  - Dada C6 cadastrada na sexta, 06/11, depois do prazo de quinta, 05/11, às 21:00
  - Então, na terça, 24/11, ela mostra "Sem relatório nas 2 semanas anteriores".
  - Quando o relatório de 18/11 de C1 é excluído
  - Então C1 passa a mostrar "Sem relatório na semana passada".
- **RN-06**
  - Quando Pedro cadastra, na quinta, 26/11, às 10:00, a célula C10, de André, de quarta, às 20:00
  - Então C10 está "Conta a partir da próxima semana", sem semanas anteriores, e não conta no card.
  - Quando é domingo, 29/11
  - Então C10 está "Ainda não ocorreu", sem semanas anteriores sem relatório.
  - Quando é quinta, 03/12, às 10:00, sem relatório
  - Então C10 está "Pendente".
  - Quando o relatório de C10 da reunião de quarta, 25/11, é aceito pelas regras do E2.11
  - Então C10 está "Enviado · Célula realizada".
  - Dada uma célula de quarta, 20:00, cadastrada na segunda, 23/11
  - Então ela fica "Pendente" na quarta, 25/11, às 21:00.
  - Dada uma célula de quarta, 20:00, cadastrada na quarta, 25/11, às 20:30, ou às 21:00 em ponto
  - Então ela fica "Pendente" às 21:00. Cadastrada às 21:01, ela fica "Conta a partir da próxima semana".
  - Quando Pedro reativa C7 (terça, 20:00) na terça, 24/11, às 10:00
  - Então, às 21:00, C7 está "Pendente", sem semanas anteriores sem relatório: as semanas em que ela estava inativa não contam.
  - Quando Pedro reativa C7 na quarta, 25/11, às 10:00
  - Então C7 está "Conta a partir da próxima semana". No domingo, 29/11, está "Ainda não ocorreu", sem semanas anteriores. Na terça, 01/12, às 21:00, sem relatório, está "Pendente".
  - Dada C1 "Pendente" na quinta, 26/11, às 10:00
  - Quando Pedro inativa C1 às 10:05 e a reativa às 10:10
  - Então C1 continua "Pendente" e no card: ela estava ativa no prazo de quarta, às 21:00.
  - Dado que Pedro inativou C1 na quarta, 25/11, às 19:00, e a reativou na quinta, às 10:00
  - Então C1 está "Conta a partir da próxima semana" e não conta no card.
  - Quando Rita restaura C8 (quarta, 19:00) na quinta, 26/11, às 10:00
  - Então C8 está "Conta a partir da próxima semana", sem semanas anteriores sem relatório.
  - Quando Rita restaura C8 na terça, 24/11
  - Então C8 fica "Pendente" na quarta, 25/11, às 20:00, sem semanas anteriores sem relatório: as semanas em que ela estava excluída não contam.
  - Quando Rita muda o horário de C6 para 19:00
  - Então C6 continua com "Sem relatório nas 3 semanas anteriores".
  - Quando alguém tenta, pela API, informar para C10 uma data de cadastro ou de reativação anterior a 25/11
  - Então C10 continua "Conta a partir da próxima semana".
- **RN-07**
  - Dada uma célula de teste ativa sem dia da semana, antes das regras do E2.08
  - Então a lista mostra "Sem dia da reunião", e ela não conta no card.
  - Dada uma célula de teste de quarta sem horário, sem relatório nesta semana
  - Quando é quarta, 25/11, às 23:59:59
  - Então ela está "Ainda não ocorreu". Na quinta, 26/11, às 00:00, está "Pendente".
  - Dada uma célula de teste de sábado sem horário
  - Então ela não fica "Pendente" na semana. No domingo, mostra "Sem relatório na semana passada".
  - Dada a publicação das regras do E2.08
  - Então nenhuma célula cai nesta regra.
- **RN-08**
  - Quando Rita abre o Dashboard e a lista na quinta, 26/11, às 10:00
  - Então o card "Células com relatório pendente", com o ícone do "Pendente", mostra 3, e a lista dela tem exatamente 3 células "Pendente": C1, C2 e C9. O Dashboard não tem mais "Células sem Relatório".
  - Quando Pedro faz o mesmo
  - Então o card mostra 2 (C1 e C9), e a lista dele tem as mesmas 2. C2 não aparece para ele.
  - Quando são 21:00 de quinta
  - Então o card de Rita mostra 4 e o de Pedro mostra 3 (entra C6).
  - Quando é sábado, 28/11, às 00:30, e ninguém enviou relatório
  - Então o card de Rita mostra 5 e o de Pedro mostra 4 (entra C3). C4 não entra.
  - Dada uma célula ativa de segunda, às 20:00, sem relatório na semana
  - Quando o card é consultado na segunda, às 20:59 e às 21:00
  - Então ela não conta às 20:59 e conta às 21:00. Este critério substitui o do E1.08 (que contava às 20:00).
  - Dada C10, "Conta a partir da próxima semana"
  - Então ela não conta no card.
  - Dada uma pessoa sem "Visualizar Dashboard"
  - Quando ela abre o Dashboard
  - Então vê "Você não tem acesso ao dashboard.", como hoje (RN-09 do E1.08).
- **RN-09**
  - Quando Pedro abre a lista na terça, 24/11, às 10:00
  - Então vê:
    - C1: "Ainda não ocorreu";
    - C3: "Ainda não ocorreu";
    - C6: "Ainda não ocorreu", com "Sem relatório nas 3 semanas anteriores";
    - C9: "Ainda não ocorreu", com "Sem relatório nas 2 semanas anteriores";
    - C7: só "Inativa".
  - E não vê C2, C4, C5 nem C8.
  - Dado Caio, timóteo de C1, com acesso à lista de Células
  - Quando ele abre a lista
  - Então vê a situação de C1 igual à que Pedro vê, sem nenhuma permissão nova.
  - Quando Pedro abre a lista no celular
  - Então a legenda "Entenda a situação do relatório" está fechada.
  - Quando ele a abre
  - Então ela explica os dois "Enviado", "Ainda não ocorreu", "Pendente", "Conta a partir da próxima semana" e as semanas anteriores sem relatório, com os textos de Textos de tela, sem depender de passar o mouse.
  - Quando Pedro abre a lista com C1 "Enviado · Célula realizada"
  - Então a ação "Novo relatório" continua em C1, para quem pode lançar (E2.02). O que acontece ao usá-la é do E2.11 (P-SIT-17).
  - Quando Carla envia o relatório de C1 pela ação "Novo relatório" da lista
  - Então a linha de C1 mostra "Enviado · Célula realizada" sem recarregar a página.
  - Dada a lista aberta por Pedro na quarta, 25/11, às 20:50
  - Quando são 21:05 e ele não consultou de novo
  - Então C1 continua "Ainda não ocorreu". Ao consultar de novo, C1 está "Pendente".
- **RN-10**
  - Dada uma célula do legado cadastrada em 10/03/2023, com o último relatório em 21/10/2026
  - Quando a carga roda e Rita abre a lista na terça, 24/11
  - Então a célula mostra "Sem relatório nas 4 ou mais semanas anteriores".
  - Dada uma célula do legado sem data de cadastro e sem nenhum relatório
  - Então ela mostra "Sem relatório nas 4 ou mais semanas anteriores".
  - Dada uma célula do legado com dois relatórios na mesma semana, um deles migrado como excluído (5.4)
  - Então a semana tem relatório, e o excluído não conta em nada.
  - Dada a reconciliação de uma semana de referência
  - Então o script lista cada célula em que o card de pendentes do novo difere do legado, com o motivo (prazo exato ou semana que não conta). Nenhuma diferença fica sem motivo.

### Textos de tela
Vocabulário de referência. O `ux-designer` pode ajustar o tom, mas não o sentido nem os termos. Os textos vindos do desenho de UX e aprovados pelo PO em 2026-11-24 (PO-UX-4 e PO-UX-7) já estão na tabela. Os demais (títulos de coluna, leitor de tela e as respostas possíveis da T6) estão em "Textos", na seção Experiência (UX).
- **Termos:** Relatório, Enviado, Célula realizada, Não houve célula, Ainda não ocorreu, Pendente, semana passada, semanas anteriores, prazo, reunião.
- **Evitar:**
  - "Status" (P-HIE-20 do E2.06);
  - "Atrasado" e "Atraso", que o legado juntava com "Pendente";
  - "Cancelada" no lugar de "Não houve célula";
  - "Entregue" no lugar de "Enviado";
  - "Células sem relatório" como nome do card, que se confunde com as semanas anteriores;
  - "cobrar" e "cobrança".

| Situação | Texto |
|---|---|
| nome da informação na lista (cartão e coluna da tabela) | Relatório |
| situação da semana (o "·" faz parte do texto do Enviado) | "Enviado · Célula realizada"; "Enviado · Não houve célula"; "Ainda não ocorreu"; "Pendente"; "Conta a partir da próxima semana" |
| semanas anteriores sem relatório | Sem relatório na semana passada · Sem relatório nas 2 semanas anteriores · Sem relatório nas 3 semanas anteriores · Sem relatório nas 4 ou mais semanas anteriores |
| botão da legenda (P-SIT-15) | Entenda a situação do relatório |
| legenda: "Enviado · Célula realizada" | O relatório desta semana foi enviado, e a célula se reuniu. |
| legenda: "Enviado · Não houve célula" | O relatório desta semana foi enviado com "Não houve célula". |
| legenda: "Ainda não ocorreu" | A reunião desta semana ainda não aconteceu. O relatório fica pendente 1 hora depois do horário da célula. |
| legenda: "Pendente" | A reunião desta semana já passou e o relatório não foi enviado. |
| legenda: "Conta a partir da próxima semana" | A célula foi cadastrada ou reativada depois da reunião desta semana. O relatório só fica pendente a partir da próxima semana. |
| legenda: semanas anteriores | Sem relatório nas semanas anteriores · Quantas semanas seguidas, antes desta, ficaram sem relatório. Vai até "4 ou mais". |
| legenda: rodapé | A semana vai de domingo a sábado. A situação é a do momento em que a lista foi carregada. |
| célula sem dia válido (RN-07) | Sem dia da reunião |
| card do Dashboard | Células com relatório pendente |

### Telas afetadas
- **Lista de Células** (cartões até 1279 px e tabela a partir de 1280 px, pelo P74 da UX):
  - cada célula ativa ganha a informação "Relatório", com a situação da semana e, quando houver, as semanas anteriores sem relatório (RN-09). "Pendente" em amarelo de aviso, e os dois "Enviado" com a mesma aparência (P-SIT-13, P-SIT-14);
  - a legenda "Entenda a situação do relatório", fechada por padrão (P-SIT-15);
  - na tabela, "Tipo" e "Dia / Hora" viram a coluna "Reunião" (P-SIT-18);
  - a célula inativa não muda (E2.08);
  - depois de uma ação no app que muda relatórios ou a célula, a linha mostra a situação nova sem recarregar.
- **Dashboard:** o card "Células sem Relatório" passa a "Células com relatório pendente", com o ícone do "Pendente" e a definição da RN-08. Os títulos dos cards quebram linha sem cortar (P-SIT-16). Os outros cards não mudam de nome nem de número.
- Nenhuma tela nova. Os formulários de célula e de relatório, a lista de Relatórios e Ministérios não mudam.

### Fora de escopo
Cada item indica o passo que cuida dele, quando há um.
- **Filtro por situação do relatório na lista de Células** (CEL-06): E2.10, com as definições deste spec (ver Impactos).
- **Detalhe da célula com os 3 últimos relatórios** (CEL-07), inclusive a situação mostrada ali: E2.10.
- **Clique no card abrindo a lista filtrada** (DSH-05), **cor do card** (DSH-06), **gráfico realizadas × não realizadas × pendentes** (DSH-04) e **novas células e novos membros da semana** (DSH-02): E2.14.
- **Navegação por semana no Dashboard:** E2.14, se for feita. A RN-02 já define o cálculo para outro momento de referência.
- **Regras de lançamento** (semana atual, sem data futura, depois do horário da célula, um por semana, quem lança): E2.11. A situação não muda nenhuma delas (RN-01).
- **Lista de relatórios e atalhos de semana** (REL-13): E2.12.
- **Exportação** (REL-14): E2.13. A situação da exportação ("Relatório não entregue.", "Não houve célula." e "Célula realizada.") é por período e não é a situação deste spec.
- **Situações `Cancelled*`** (sequência de "Não houve célula"): não serão replicadas (3.9). Ver Q-2.
- **Recesso** (semana sem reunião para todas as células): sem passo no plano. Ver Q-1.
- **Lembretes e notificações de pendência:** sem passo no plano. Ver Q-6.
- **Ordenar a lista pela situação:** o legado não tem. O E2.10 decide se entra.
- **Atualização automática da lista com a passagem do tempo:** sem passo no plano (RN-09).
- **Indicadores por ministério** (por exemplo, percentual de relatórios enviados por G12): sem passo no plano.
- **Consolidação:** o consolidado não é membro e não muda células nem relatórios. Nada muda aqui.

### Impactos em outros passos
Pontos de negócio que outros passos precisam respeitar. O `architect` decide como.
- **E1.08:**
  - o critério da RN-08 "não a conta às 19:59 e a conta às 20:00" passa a "não a conta às 20:59 e a conta às 21:00" (RN-08 deste spec);
  - os testes do PR 3 (RN-08, RN-08a e "`meeting_time` nulo entra às 23:59:59") mudam para o prazo de 1 hora e para a RN-07;
  - o limite do risco 13 deixa de existir (RN-02);
  - o comentário do `cells_pending` na migration fica desatualizado e é substituído.
- **E2.01:** nada muda. A RN-12 de lá ("a célula volta a contar como pendente") vale quando o prazo já passou e a semana conta. A restauração de uma célula segue a RN-06 deste spec: as semanas em que ela estava excluída não contam.
- **E2.08:**
  - a RN-11 de lá diz que reativar devolve a célula às pendências "a partir da semana em que é reativada". Este spec detalha: se a reativação é antes do prazo da reunião daquela semana; depois do prazo, a partir da semana seguinte (RN-06);
  - o aviso "Ao salvar, a célula volta aos totais e a receber relatórios a partir desta semana." continua certo: receber relatório não é ficar pendente;
  - os critérios da RN-08 de lá continuam valendo (quinta às 10:00, sábado às 23:59 e domingo às 00:00);
  - com as RN-05 e RN-06 de lá em produção, a RN-07 deste spec não se aplica mais.
- **E2.10:**
  - o filtro "Situação do relatório" usa as definições deste spec. Pode oferecer as opções do legado, que se sobrepõem:
    - "Relatório em dia": Enviado, Ainda não ocorreu ou Conta a partir da próxima semana;
    - "Ainda não ocorreu esta semana": Ainda não ocorreu;
    - "Pendente esta semana": Pendente;
    - "Sem relatório na semana passada" e "nas 2", "nas 3" e "nas 4 ou mais semanas anteriores": a contagem da RN-05;
  - o detalhe da célula mostra a mesma situação da lista;
  - o filtro "Situação" (Ativa, Inativa), recomendado no E2.08, continua separado.
- **E2.11:**
  - a situação não é regra de lançamento (RN-01);
  - o relatório pode ser lançado a partir do horário da célula (REL-04), antes do prazo; nesse intervalo, a célula passa de "Ainda não ocorreu" para "Enviado";
  - o E2.11 decide se a célula cadastrada depois da reunião (C10) pode receber o relatório dessa reunião. No legado, pode;
  - o retrato do relatório (REL-09) não muda a situação, que usa os dados atuais da célula;
  - **"Novo relatório" na célula "Enviado"** (P-SIT-17, PO-UX-6). A ação continua na lista, porque a situação pode estar desatualizada e o relatório pode ter sido excluído (DEL-03). Hoje a pessoa pode abrir o formulário, preencher tudo e só então receber a recusa de um por semana (REL-03). O E2.11 decide como evitar isso. Recomendação do PO: ao abrir o formulário de uma célula que já tem o relatório da semana, avisar no topo, antes de preencher, que o relatório desta semana já foi enviado, com a mensagem da REL-03, e oferecer abrir o relatório enviado a quem pode vê-lo.
- **E2.14:**
  - o clique no card abre a lista com o filtro "Pendente" do E2.10;
  - a cor do card (DSH-06) e a parte "sem relatório" do gráfico (DSH-04) usam o mesmo número da RN-08;
  - a cor do card: o badge "Pendente" da lista é amarelo de aviso (P-SIT-14), e a DSH-06 pinta o card de vermelho quando há pendentes. O E2.14 decide se mantém a DSH-06 ou se alinha com o badge. O gráfico usa os tons da lista (P70 da UX);
  - os outros títulos da seção "Esta semana" passam a ter só a primeira letra maiúscula, como o do card de pendentes: "Relatórios enviados", "Visitantes em células" e "Células não realizadas" (P-SIT-16);
  - uma navegação por semana segue a RN-02.
- **E4.06, E4.07 e E4.09:**
  - a carga traz a data de cadastro do legado, que a RN-06 usa (E2.05 já mapeia);
  - a reconciliação (5.6) compara o card de pendentes e lista as diferenças com o motivo (RN-10). A 5.6 ganha essa linha.
- **Aceite (PO):**
  - no `docs/migracao.md`: CEL-05 em ✅; na DSH-02, o cálculo de pendentes pela CEL-05; a linha nova da 5.6; o E2.09 na seção Progresso;
  - no `CLAUDE.md`: na matriz, a linha "Situação do relatório por célula" em ✅; em "Novo: estado atual", a situação na lista de Células e o card "Células com relatório pendente".

### Pontos para o `architect`
Não são dúvidas de negócio. São pontos em que a regra depende de uma escolha técnica.
1. **Um cálculo só.** A situação da semana e a contagem das semanas anteriores saem de um lugar só no banco, usado pela lista de Células, pelo card (`dashboard_summary.cells_pending`) e, depois, pelo filtro e pelo detalhe do E2.10 e pelo gráfico do E2.14. O front não calcula nada nem usa o relógio do aparelho. É o ponto de extensão previsto no E1.08 (`report_status` na `cells_view`).
2. **Por semana, e não pelo último relatório.** Com outro momento de referência (o `_at`), a situação usa só os relatórios com data dentro da semana desse momento, e a contagem só as semanas anteriores a ela. Isso resolve o risco 13 do E1.08.
3. **Semanas que contam** (RN-06). É preciso saber se a célula estava cadastrada, ativa e não excluída no prazo de cada semana, até cinco semanas para trás (a atual e as quatro anteriores, porque a contagem para em "4 ou mais").
   - O critério de inativar e reativar em 5 minutos precisa continuar "Pendente": guardar só "ativa desde" não basta.
   - Esses momentos são do servidor: a API não os informa nem os altera, como a data de cadastro no E2.05.
   - Não podem gerar alterações novas na Auditoria além das que já existem (inativar, reativar, excluir e restaurar; RN-04 do E2.05).
   - Ponto de partida: as células do legado ativas desde a data de cadastro (sem data, desde sempre); as células do novo ativas na publicação, desde o cadastro; as inativas na publicação, inativas em todas as semanas anteriores.
4. **Prazo.** O horário é `time` sem fuso. O prazo é o horário mais 1 hora, com a virada de dia e de semana da RN-02. Sem horário, 00:00 do dia seguinte; dia fora dos sete valores, sem situação (RN-07).
5. **Filtrar e contar no servidor.** O E2.10 vai filtrar e paginar pela situação e pela contagem. O cálculo precisa permitir isso sem carregar todas as células, no volume de referência do E1.08 (1.500 células e 100 mil relatórios), com o índice parcial `(cell_id, date DESC)` que já existe.
6. **Atualização.** A situação é calculada a cada consulta. A tela invalida a lista depois das ações da RN-09.
7. **Fuso.** Use o `sp_now()` (`America/Sao_Paulo`). Os testes repetem os do E1.08: sessão em UTC e em Asia/Tokyo, virada às 03:00 UTC de domingo.
8. **Ordem.** Este passo pressupõe o E2.01 em produção (excluídos e restauração). O ideal é entrar depois do PR do E2.08 com as regras de dia e horário (tipo a); se entrar antes, a RN-07 vale. O E2.02 muda o `WHERE` da `cells_view`, mas não o cálculo.

### Perguntas em aberto
Nenhuma bloqueante. Os pontos que as fontes não respondiam viraram padrões, listados em [Padrões definidos por este spec](#padrões-definidos-por-este-spec-revisar-no-pr), para o usuário revisar no PR. Os que mais mudam o resultado são:
- **P-SIT-03:** a célula cadastrada, reativada ou restaurada depois da reunião da semana não fica pendente naquela semana. No legado e no novo de hoje, fica pendente na hora.
- **P-SIT-01:** a célula só fica pendente 1 hora depois do horário da reunião, como no legado. Hoje o novo conta no horário da reunião.
- **P-SIT-04:** a célula que nunca enviou relatório aparece com as semanas sem relatório desde o cadastro, e a reativação recomeça a contagem.
- **P-SIT-06:** a situação aparece em cada célula da lista. O legado só tinha o filtro.
- **P-SIT-07:** o card volta a se chamar "Células com relatório pendente".
- **P-SIT-12:** o detalhe "Célula realizada" ou "Não houve célula" aparece também para quem não vê o relatório.

As pendências da UX (PO-UX-1 a PO-UX-7) foram resolvidas em 2026-11-24 e viraram os padrões P-SIT-12 a P-SIT-18.

Sugestões que não entram, porque o legado não tem a regra. O usuário decide se viram regra nova:
- **Q-1.** A igreja tem recesso (por exemplo, no fim do ano, ou na semana de um Encontro ou de uma conferência) em que nenhuma célula se reúne? Hoje, cada célula precisa enviar "Não houve célula" em cada semana para não ficar pendente.
- **Q-2.** Vale mostrar quando uma célula está há várias semanas seguidas com "Não houve célula"? O legado previu isso (`Cancelled*`), mas não fez, e o plano não replica (3.9).
- **Q-3.** A tolerância de 1 hora depois do horário da reunião atende? Uma célula que termina tarde pode preferir, por exemplo, que a pendência só comece no dia seguinte.
- **Q-4.** O Dashboard deve ter um card para as células "Sem relatório nas 2 ou mais semanas anteriores"? O legado só tem o card da semana.
- **Q-5.** A Macrocélula tem relatório semanal como as outras células? Hoje ela segue as mesmas regras (ver Q-5 do E2.08).
- **Q-6.** A igreja quer lembrar o líder quando o relatório fica pendente (por exemplo, por WhatsApp)? Não há passo para isso no plano.

## Experiência (UX)
_Seção do `ux-designer`. Escrita em 2026-11-24 a partir destas fontes:_
- _a seção Negócio (RN-01 a RN-10, P-SIT-01 a P-SIT-11, a massa de exemplo, os Textos de tela, os Pontos para o `architect` e as perguntas Q-1 a Q-6);_
- _as telas da `origin/main` do `mci-connect` (`4595daa`): `Cells.tsx`, `Dashboard.tsx`, `AppLayout.tsx`, `StatusBadge.tsx`, `ui/badge.tsx`, `ui/card.tsx`, `ui/table.tsx`, `ui/collapsible.tsx`, `lib/cells/labels.ts`, `lib/cells/fields.ts`, `use-cells-list.ts`, `use-dashboard.ts`, `use-save-cell-report.ts`, `use-cell-report-deletion.ts` e o `QueryClient` do `App.tsx`;_
- _o que já foi desenhado para as mesmas telas: a lista de Células do [E2.06](e2-06-hierarquia-totais.md) (T2, P40, P44 e P45) e do [E2.08](e2-08-cadastro-celulas.md) (T7, P65), as ações do [E2.01](e2-01-exclusao-logica.md) (T1, P8), o subtítulo e o "Novo relatório" do [E2.02](e2-02-perfis-escopo.md) (T7, T9, P10), o cabeçalho de lista com filtros do [E2.07](e2-07-filtros-membros.md) (T1) e a legenda "Como marcar" de [Escolas](escolas.md);_
- _o legado, só para manter o que os usuários conhecem: o filtro "Situação de Relatório" e as colunas da lista (`UI/pages/Cells/index.js:41-79` e `:196-212`), com o dia e o horário na mesma coluna._

_Usa os padrões de Escolas (P1 a P6), do E2.01 (P7 a P9), do E2.02 (P10 a P14), do E2.04 (P20 a P24), do E2.06 (P40, P44 e P45) e do E2.08 (P65). Os padrões novos começam em P70, para não colidir com os specs desenhados em paralelo. Nenhuma regra de negócio foi criada aqui. Onde a tela precisou de algo que o spec não diz, a decisão é a mais conservadora, marcada como "definido pela UX" e listada em "Pendências para o PO". Os nomes são os da massa de exemplo dos [Critérios de aceite](#critérios-de-aceite); os sobrenomes existem só nos wireframes, e "…" marca o que a massa não define._

### O que muda, tela a tela
Nenhuma tela nova e nenhuma rota nova.

| Tela | O que muda | Para quem |
|---|---|---|
| Lista de Células: cartões (T1) | Cada célula ativa ganha a linha "Relatório:", com o badge da situação da semana (P70) e, quando houver, a linha das semanas anteriores sem relatório (P72). A célula inativa não ganha nada. Os cartões passam a valer até 1279 px e, de 1024 a 1279 px, têm duas colunas (P74). O endereço sobe para junto das pessoas. | quem vê células |
| Lista de Células: tabela (T2) | Passa a valer a partir de 1280 px (P74). "Tipo" e "Dia / Hora" viram a coluna "Reunião", e a coluna "Relatório" entra entre "Reunião" e "Situação". | idem |
| Lista de Células: legenda (T3) | Um botão "Entenda a situação do relatório", fechado por padrão, abre a explicação de cada valor (P73). | idem |
| Dashboard (T4) | O card "Células sem Relatório" passa a "Células com relatório pendente", com o ícone do "Pendente" da lista. O título quebra linha sem cortar. O número segue a RN-08. | quem tem acesso ao Dashboard |
| Formulários de célula e de relatório, Relatórios, Ministérios, Membros (T5) | Sem mudança visual. Depois de enviar, editar, excluir ou restaurar um relatório, a lista de Células e o Dashboard mostram a situação nova (P44). | — |

#### O que cabe em cada largura
A área útil vem do `AppLayout` (`p-4` no celular e `p-6` a partir de 768 px) e do menu lateral fixo, de 256 px, a partir de 768 px. Em nenhuma largura uma informação sai de vista: muda só o arranjo.

| Largura | Área útil | Forma | Onde fica "Relatório" | O que muda de lugar |
|---|---|---|---|---|
| 320 a 767 px (referência: 360) | 254 a cerca de 700 px dentro do cartão (294 em 360) | cartão, uma coluna | linha "Relatório:" depois do dia e horário; a linha das semanas logo abaixo | nada sai. "Excluir" fica no "⋯" (P8). Em 320 px, o badge passa para a linha de baixo |
| 768 a 1023 px | 430 a 685 px | cartão, uma coluna | igual. A linha das semanas fica ao lado do badge quando cabe | nada sai |
| 1024 a 1279 px | 686 a 941 px | cartão com duas colunas (P74) | coluna da direita, com a reunião | pessoas e endereço à esquerda; tipo, situação, reunião e relatório à direita |
| 1280 px ou mais | 974 px ou mais | tabela | coluna "Relatório", entre "Reunião" e "Situação" | "Tipo" vai para dentro da coluna "Reunião", embaixo do dia e horário |

A conta que levou à tabela só a partir de 1280 px está na UXD-5.

### Coerência com os outros specs
- **E2.06 (T2, P40, P45):** continuam o líder com o nível entre parênteses, o G12 com um nome só e a coluna "Situação".
  - O P45 continua valendo para Membros. Para Células, o P74 sobe a troca de cartão para tabela de 1024 para 1280 px, porque a tabela com a coluna Relatório não cabe em 720 px (UXD-5).
  - As ações do cartão (44×44 px, "Excluir" no "⋯") acompanham o cartão até 1279 px, como o P45 manda.
- **E2.08 (T7, P65):**
  - continuam "Novo relatório" fora da célula inativa, as ações alinhadas pelo fim, os badges "Ativa" e "Inativa" do P6 e "Nova célula";
  - mudam a ordem do cartão (o endereço sobe para junto das pessoas, UXD-4) e as colunas "Tipo" e "Dia / Hora" da tabela, que viram "Reunião" (UXD-6). É o nome do grupo que reúne esses campos no formulário (T1 de lá).
- **E2.02 (T7, T9, P10):** a regra do "Novo relatório", o subtítulo de alcance e o atalho do Dashboard não mudam. A situação aparece para quem vê a célula, inclusive para quem não tem nenhuma ação nela.
- **E2.01 (T1):** "Excluir célula" no "⋯" do cartão e os ícones da tabela não mudam.
- **E1.08:** paginação, total e `opacity-60` na troca de página, como hoje. A situação chega na mesma linha da página (AQ-2).
- **E2.07 (T1):** quando o E2.10 trouxer os filtros para Células, o cabeçalho da lista segue o de Membros. A legenda (T3) fica depois da linha dos filtros e dos chips e antes do total. O painel de filtros troca em 1024 px; a tabela, em 1280 px. São trocas independentes.
- **Escolas:** a legenda "Como marcar" (`Collapsible` fechado) é o modelo do P73.
- **E2.10, E2.11 e E2.14:** usam o P70 e o P72 (ver "Pontos de extensão" em [Perguntas para o `architect`](#perguntas-para-o-architect-dados-e-contrato)).

### Decisões de experiência
| # | Decisão | Por quê |
|---|---|---|
| UXD-1 | **As duas informações ficam num lugar só, com o rótulo "Relatório": o badge da situação da semana e, embaixo, a linha das semanas anteriores sem relatório (P71).** | "Pendente" ou "Ainda não ocorreu" sozinhos não dizem do que se trata. O rótulo é o nome que o Negócio deu à informação. As duas partes juntas contam a história da célula: "Pendente" com "Sem relatório nas 2 semanas anteriores" são três reuniões sem relatório. |
| UXD-2 | **Cada valor da semana tem texto, ícone e tom próprios (P70): "Enviado" em verde de sucesso com ✓, "Pendente" em amarelo de aviso com triângulo, e "Ainda não ocorreu" e "Conta a partir da próxima semana" neutros, com relógio e calendário.** | Quem acompanha 20 células procura o triângulo amarelo. O vermelho fica para erro e exclusão, e "Pendente" ainda tem conserto: o líder pode enviar. O ícone diferencia os valores sem depender da cor. |
| UXD-3 | **As semanas anteriores aparecem como uma linha de texto com ícone, e não como um segundo badge (P72).** | Dois badges coloridos lado a lado disputam a atenção, e o segundo, com até 46 caracteres, quebraria em duas linhas dentro da pílula. O texto em `font-medium text-foreground`, com o ícone de calendário riscado, chama a atenção sem gritar. |
| UXD-4 | **No cartão, o endereço sobe para junto das pessoas, e a reunião e o relatório fecham o cartão: G12, Timóteo, Anfitrião e Endereço; depois Tipo e Situação, dia e horário, e Relatório.** A célula inativa não tem a linha "Relatório". | O dia e o horário explicam o "Ainda não ocorreu" e o "Pendente". Com o relatório sempre no fim, o olho o encontra no mesmo lugar em todos os cartões. O mesmo arranjo vira as duas colunas do P74 sem reordenar o DOM: "quem e onde" à esquerda, "quando e relatório" à direita. |
| UXD-5 | **Células mostra cartões até 1279 px e a tabela a partir de 1280 px (P74). De 1024 a 1279 px, o cartão tem duas colunas.** | Com o `p-4` das células da tabela, cada coluna gasta 32 px só de espaçamento. Com o texto quebrando, as colunas de hoje mais "Relatório" pedem cerca de 1.017 px, e com "Tipo" dentro de "Reunião", cerca de 920 px. Em 1024, a área útil é de 720 px; em 1280, de 974 px. Abaixo disso, a tabela rolaria na horizontal ou partiria os nomes letra a letra. O conteúdo define o breakpoint. |
| UXD-6 | **Na tabela, "Tipo" e "Dia / Hora" viram a coluna "Reunião" ("Quarta · 20:00" e o badge do tipo embaixo), e "Relatório" fica entre "Reunião" e "Situação".** | Uma coluna a menos é o que faz a tabela caber em 1280 px. "Reunião" é o grupo desses campos no formulário (E2.08), e o legado já juntava dia e horário numa coluna. O relatório ao lado da reunião se lê na ordem certa: "quarta, 20:00, pendente". |
| UXD-7 | **As explicações dos valores ficam numa legenda recolhível, "Entenda a situação do relatório", acima da lista (P73), e não em dicas que aparecem ao passar o mouse.** | No celular não há mouse. Uma dica por badge daria 20 paradas de Tab por página, e o leitor de tela repetiria a explicação em toda linha. A legenda é uma parada só, fica a um toque e serve também para o filtro do E2.10. É o modelo de "Como marcar", de Escolas. |
| UXD-8 | **O badge do relatório pode quebrar linha por dentro e tem cantos arredondados (`rounded-md`), e não a pílula (P70).** | "Conta a partir da próxima semana" tem cerca de 245 px. Em 320 px, ou com a fonte grande do sistema, não cabe numa linha. A pílula com duas linhas vira uma cápsula que corta o texto nas pontas. Com os cantos menores, o formato é o mesmo com uma ou duas linhas. |
| UXD-9 | **No Dashboard, muda o título do card, e o ícone passa do relógio para o triângulo do "Pendente".** O título quebra linha, com espaçamento legível. | Na lista, o relógio quer dizer "Ainda não ocorreu". O mesmo ícone no card de pendentes ensinaria o contrário. O título novo tem 30 caracteres e, em 1024 px, ocupa três linhas num card de 168 px. Hoje o título usa `leading-none`, que encosta uma linha na outra. |
| UXD-10 | **A lista não se atualiza sozinha com o relógio.** Ela mostra a situação nova depois das ações do app (P44) e numa consulta nova: ao abrir a tela de novo ou ao voltar para a aba ou para o app. Não há "atualizado às". | É a RN-09 (P-SIT-08). Consultar de minuto em minuto gastaria dados no 3G sem ganho real. Voltar para a aba já é uma consulta nova no TanStack Query (AQ-4), e a legenda diz que a situação é a do momento em que a lista foi carregada. |

### Navegação e rotas
- Nenhuma rota nova.
- A legenda abre e fecha na própria lista. Ela não muda a URL e não guarda o estado: começa fechada em cada visita.
- O clique no card do Dashboard continua sem destino até o E2.14.

### Fluxos
Contagem no celular, a partir de qualquer tela com o menu fechado, incluindo o toque no ☰, salvo quando a linha diz outra coisa. "Toque" não conta a digitação nem a rolagem.

| # | História | Caminho | Toques e telas |
|---|---|---|---|
| F1 | O G12 confere as células pendentes do ministério (Pedro, celular, quinta às 10:00) | ☰ → Células → rola os cartões e lê "Relatório: Pendente" em C1 e C9 | 2 toques, 1 tela. Com o filtro do E2.10, sem rolar |
| F2 | O mesmo, pelo Dashboard | entra no app (o Dashboard é a tela inicial) → lê "Células com relatório pendente: 2" | 0 toques. O clique no card é do E2.14 |
| F3 | O líder confere se o relatório da semana foi enviado (André) | ☰ → Células → lê "Relatório: Enviado · Célula realizada" no cartão de C1 | 2 toques |
| F4 | A pessoa da célula envia o relatório pela lista (Carla) | ☰ → Células → "Novo relatório" em C1 → formulário (E2.11) → "Salvar" → o cartão de C1 passa a "Enviado · Célula realizada" | 3 toques mais o formulário, sem recarregar a página |
| F5 | Entender um valor (qualquer pessoa) | ☰ → Células → "Entenda a situação do relatório" → lê | 3 toques |
| F6 | A liderança encontra as células que pararam (Rita, computador) | Células → percorre a coluna "Relatório" e lê "Sem relatório nas 4 ou mais semanas anteriores" | 1 clique e a rolagem por página. O filtro é do E2.10 |
| F7 | Cadastrar uma célula depois da reunião da semana (Pedro) | "Nova célula" → … → "Criar célula" (F2 do E2.08) → o cartão novo mostra "Conta a partir da próxima semana" | os mesmos toques do E2.08, nenhum a mais |
| F8 | Inativar uma célula pendente (Pedro) | F4 do E2.08 → o cartão mostra "Inativa", sem a linha "Relatório" → no Dashboard, o card mostra 1 a menos | os mesmos toques do E2.08 |

### Telas
As convenções dos wireframes são as do E2.08, com estas:
- 360 px ≈ 38 colunas;
- `[▤+]` é "Novo relatório", `[✎]` é "Editar", `[⋯]` é o menu de ações e `[✗]` é "Excluir" na tabela;
- `⏸` é o ícone `PauseCircle`; `ⓘ` é `Info`; `⌄` é `ChevronDown`;
- ícones da situação do relatório: `✓` é `CheckCircle2`, `◷` é `Clock`, `△` é `TriangleAlert`, `▦` é `CalendarClock` e `▧` é `CalendarX2`;
- no Dashboard, `▤`, `⊕` e `⊗` são os ícones de hoje dos outros cards (`FileText`, `UserPlus` e `XCircle`).

A margem lateral é a do `AppLayout` (`p-4` no celular).

#### T1. Lista de Células: cartões (até 1279 px)
Celular (360 px), com Rita, na quinta, 26/11, às 10:00 (critério da RN-04). C10 vem do critério da RN-06:
```
┌──────────────────────────────────────┐
│ André Souza (144)     [▤+] [✎] [⋯]   │  C1
│ G12: Pedro Alves                     │
│ Timóteo: Caio Lima                   │
│ Anfitrião: Carla Dias                │
│ Rua das Flores, 100 — Centro         │  o endereço sobe (UXD-4)
│ [Evangelística] [Ativa]              │
│ Quarta · 20:00                       │
│ Relatório: [△ Pendente]              │  P71; badge do P70
├──────────────────────────────────────┤
│ Pedro Alves (G12)     [▤+] [✎] [⋯]   │  C9
│ G12: Pedro Alves                     │
│ …                                    │
│ [Macrocélula] [Ativa]                │
│ Quarta · 19:30                       │
│ Relatório: [△ Pendente]              │
│ ▧ Sem relatório nas 2 semanas        │  P72: texto, não badge
│ anteriores                           │
├──────────────────────────────────────┤
│ Samuel Colares        [▤+] [✎] [⋯]   │  C5
│ (Pastor)                             │
│ G12: Pastores                        │
│ …                                    │
│ [Discipulado] [Ativa]                │
│ Segunda · 19:30                      │
│ Relatório:                           │  o badge desce quando não cabe
│ [✓ Enviado · Não houve célula]       │  ao lado do rótulo
├──────────────────────────────────────┤
│ Paula Alves (G12)     [▤+] [✎] [⋯]   │  C6
│ …                                    │
│ [Discipulado] [Ativa]                │
│ Quinta · 20:00                       │
│ Relatório: [◷ Ainda não ocorreu]     │
│ ▧ Sem relatório nas 3 semanas        │
│ anteriores                           │
├──────────────────────────────────────┤
│ André Souza (144)     [▤+] [✎] [⋯]   │  C10
│ …                                    │
│ Quarta · 20:00                       │
│ Relatório:                           │
│ [▦ Conta a partir da próxima         │  o badge quebra por dentro em
│ semana]                              │  320 px ou com fonte grande (UXD-8)
├──────────────────────────────────────┤
│ André Souza (144)          [✎] [⋯]   │  C7, inativa: sem "Novo relatório"
│ …                                    │  (E2.08) e sem a linha "Relatório"
│ [Evangelística] [⏸ Inativa]          │
│ Terça · 20:00                        │
└──────────────────────────────────────┘
```
De 1024 a 1279 px, o corpo do cartão tem duas colunas (P74). Rita, mesma hora:
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ André Souza (144)                                          [▤+]  [✎]  [⋯]    │
│ G12: Pedro Alves                     [Evangelística] [Ativa]                 │
│ Timóteo: Caio Lima                   Quarta · 20:00                          │
│ Anfitrião: Carla Dias                Relatório: [△ Pendente]                 │
│ Rua das Flores, 100 — Centro                                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│ Paula Alves (G12)                                          [▤+]  [✎]  [⋯]    │
│ G12: Paula Alves                     [Discipulado] [Ativa]                   │
│ …                                    Quinta · 20:00                          │
│                                      Relatório: [◷ Ainda não ocorreu]        │
│                                      ▧ Sem relatório nas 3 semanas           │
│                                      anteriores                              │
└──────────────────────────────────────────────────────────────────────────────┘
```
- **Linha "Relatório" (P71, UXD-1):** o rótulo "Relatório:" no estilo dos outros rótulos do cartão (`text-xs text-muted-foreground`), o badge do P70 e a linha das semanas do P72, num mesmo `flex flex-wrap items-center gap-x-2 gap-y-1`. O badge passa para a linha de baixo quando não cabe ao lado do rótulo, e a linha das semanas fica ao lado do badge quando cabe (768 px ou mais).
- **Valores:** os da tabela do P70. A linha das semanas só aparece com 1 ou mais (RN-05); com "Enviado", nunca aparece.
- **Célula inativa (RN-01, RN-09):** sem a linha "Relatório". O badge "Inativa" do E2.08 basta.
- **Sem dia da reunião (RN-07):** "Relatório: Sem dia da reunião", em texto (`text-xs text-foreground`), sem badge e sem a linha das semanas. A linha da reunião mostra "—" no lugar do dia. Depois das regras do E2.08, não acontece.
- **Ordem do cartão (UXD-4):** cabeçalho (líder com o nível e as ações); G12, Timóteo, Anfitrião e endereço; Tipo e Situação, dia e horário; Relatório. Até 1023 px, numa coluna, nessa ordem. De 1024 a 1279 px, o corpo vira `lg:grid lg:grid-cols-2 lg:gap-x-8`: o primeiro bloco à esquerda e o segundo à direita, sem reordenar o DOM.
- **Dia e horário:** "Quarta · 20:00", como hoje, com o "·" para o leitor de tela como na Acessibilidade.
- **Ações:** as do E2.08 (T7), com 44×44 px e "Excluir" no "⋯", até 1279 px (P74).
- **Nada é clicável na linha "Relatório":** o badge é um `span`, sem `tabindex`, sem `title` e sem dica. A explicação está na legenda (T3).
- Componentes: os de hoje (`Card`, `Button`, `DropdownMenu`, `StatusBadge`, o `span` com `badgeVariants`).

#### T2. Lista de Células: tabela (a partir de 1280 px)
Rita, na quinta, 26/11, às 10:00:
```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Líder                 │ G12         │ Endereço            │ Reunião         │ Relatório               │ Situação    │        Ações │
│────────────────────────────────────────────────────────────────────────────────────────────────────────────────────│
│ André Souza (144)     │ Pedro Alves │ Rua das Flores, 100 │ Quarta · 20:00  │ [△ Pendente]            │ [Ativa]     │ [▤+] [✎] [✗] │
│ Timóteo: Caio Lima    │             │ Centro              │ [Evangelística] │                         │             │              │
│ Anfitrião: Carla Dias │             │                     │                 │                         │             │              │
│ Pedro Alves (G12)     │ Pedro Alves │ …                   │ Quarta · 19:30  │ [△ Pendente]            │ [Ativa]     │ [▤+] [✎] [✗] │
│                       │             │                     │ [Macrocélula]   │ ▧ Sem relatório nas 2   │             │              │
│                       │             │                     │                 │ semanas anteriores      │             │              │
│ Samuel Colares        │ Pastores    │ …                   │ Segunda · 19:30 │ [✓ Enviado · Não houve  │ [Ativa]     │ [▤+] [✎] [✗] │
│ (Pastor)              │             │                     │ [Discipulado]   │ célula]                 │             │              │
│ Paula Alves (G12)     │ Paula Alves │ …                   │ Quinta · 20:00  │ [◷ Ainda não ocorreu]   │ [Ativa]     │ [▤+] [✎] [✗] │
│                       │             │                     │ [Discipulado]   │ ▧ Sem relatório nas 3   │             │              │
│                       │             │                     │                 │ semanas anteriores      │             │              │
│ André Souza (144)     │ Pedro Alves │ …                   │ Terça · 20:00   │ —                       │ [⏸ Inativa] │      [✎] [✗] │
│                       │             │                     │ […]             │                         │             │              │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```
- **Colunas (UXD-6), nesta ordem:** Líder, G12, Endereço, Reunião, Relatório, Situação e Ações. Saem "Tipo" e "Dia / Hora". O cabeçalho não tem "Status" (E2.06).
- **Reunião:** "{Dia} · {HH:mm}" em `text-sm` e, embaixo, o badge do tipo (`outline`), como hoje. Hoje a tabela mostra "Quarta às 20:00"; passa ao formato do cartão.
- **Relatório (P71):** o badge do P70 e, embaixo, a linha do P72 (`flex flex-col items-start gap-1`), sem o rótulo, que é o título da coluna. O título tem `min-w-40`, para o badge não quebrar a cada palavra.
  - Célula inativa: "—", com "Não se aplica, célula inativa" † para o leitor de tela.
  - Sem dia da reunião: "Sem dia da reunião", em texto.
- **Largura:** em 1280×800, sem rolagem horizontal, com nomes de 40 caracteres, endereço de 50 caracteres, "Conta a partir da próxima semana" e "Sem relatório nas 4 ou mais semanas anteriores". Os nomes, o endereço e o relatório quebram linha; os badges de tipo e de situação, não.
- **Ações:** as do E2.08 (P65, `justify-end`), com os botões de 32 px da tabela.
- Componentes: os de hoje (`Table`, `Badge`, `StatusBadge`, `Button`).

#### T3. Legenda: "Entenda a situação do relatório"
Celular, fechada e aberta. Fica dentro do `Card` da lista, depois da busca (e, no E2.10, depois dos filtros e dos chips):
```
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Células                              │ │ [ⓘ Entenda a situação do relatório ⌄]│
│ Células de toda a igreja             │ │ ┌──────────────────────────────────┐ │
│ [+ Nova célula                     ] │ │ │ [✓ Enviado · Célula realizada]   │ │  dl: o badge no dt
│──────────────────────────────────────│ │ │ O relatório desta semana foi     │ │  a explicação no dd
│ [⌕ Líder, timóteo, anfitrião, rua…  ]│ │ │ enviado, e a célula se reuniu.   │ │
│ [ⓘ Entenda a situação do relatório ⌄]│ │ │ [✓ Enviado · Não houve célula]   │ │
│──────────────────────────────────────│ │ │ O relatório desta semana foi     │ │
│ André Souza (144)     [▤+] [✎] [⋯]   │ │ │ enviado com "Não houve célula".  │ │
│ …                                    │ │ │ [◷ Ainda não ocorreu]            │ │
└──────────────────────────────────────┘ │ │ A reunião desta semana ainda não │ │
                                         │ │ aconteceu. O relatório fica      │ │
                                         │ │ pendente 1 hora depois do        │ │
                                         │ │ horário da célula.               │ │
                                         │ │ [△ Pendente]                     │ │
                                         │ │ A reunião desta semana já passou │ │
                                         │ │ e o relatório não foi enviado.   │ │
                                         │ │ [▦ Conta a partir da próxima     │ │
                                         │ │ semana]                          │ │
                                         │ │ A célula foi cadastrada ou       │ │
                                         │ │ reativada depois da reunião      │ │
                                         │ │ desta semana. O relatório só     │ │
                                         │ │ fica pendente a partir da        │ │
                                         │ │ próxima semana.                  │ │
                                         │ │ ▧ Sem relatório nas semanas      │ │
                                         │ │ anteriores                       │ │
                                         │ │ Quantas semanas seguidas, antes  │ │
                                         │ │ desta, ficaram sem relatório.    │ │
                                         │ │ Vai até "4 ou mais".             │ │
                                         │ │ A semana vai de domingo a        │ │  rodapé da legenda
                                         │ │ sábado. A situação é a do        │ │
                                         │ │ momento em que a lista foi       │ │
                                         │ │ carregada.                       │ │
                                         │ └──────────────────────────────────┘ │
                                         └──────────────────────────────────────┘
```
Computador (a partir de 768 px, aberta): a mesma lista em duas colunas, o badge à esquerda e a explicação à direita (`md:grid md:grid-cols-[auto_1fr] md:gap-x-4 md:gap-y-2`), com `max-w-3xl`.
- **Botão (P73):** `CollapsibleTrigger` com `Button variant="ghost"`, o ícone `Info` e o `ChevronDown` (`aria-hidden`), `h-11` no celular e `md:h-9`, alinhado à esquerda. O `ChevronDown` gira quando a legenda está aberta, com `motion-reduce:transition-none`.
- **Conteúdo:** `CollapsibleContent` com `rounded-md bg-muted/50 p-3`, texto em `text-sm text-foreground`. É uma `dl`: em cada `dt`, o mesmo badge do P70 (ou, na última, a linha do P72), e em cada `dd`, a explicação.
- **Textos:** as três explicações do Negócio ("Ainda não ocorreu", "Pendente" e "Conta a partir da próxima semana") e as que a UX propõe para os dois "Enviado", para as semanas e para o rodapé (†, PO-UX-4).
- **Quando aparece:** sempre, também enquanto a lista carrega, sem resultado na busca e no estado vazio, para a tela não pular. Some só no erro ao carregar.
- **Fechada por padrão,** em toda visita. Não muda a URL.
- Componentes: `Collapsible` e `Button`, que já existem.

#### T4. Dashboard: o card de pendentes
```
Celular (360 px)                         Computador (1024 px, 4 cards por linha)
┌──────────────────────────────────────┐ ┌──────────────────────────────────────────────────────────────────────────┐
│ Esta Semana (22/11 - 28/11)          │ │ Esta Semana (22/11 - 28/11)                                              │
│ ┌──────────────────────────────────┐ │ │ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐  │
│ │ Relatórios Enviados           ▤  │ │ │ │ Relatórios  ▤ │ │ Células com △ │ │ Visitantes  ⊕ │ │ Células Não ⊗ │  │
│ │ 12                               │ │ │ │ Enviados      │ │ relatório     │ │ em Células    │ │ Realizadas    │  │
│ └──────────────────────────────────┘ │ │ │               │ │ pendente      │ │               │ │               │  │
│ ┌──────────────────────────────────┐ │ │ │ 12            │ │ 3             │ │ 8             │ │ 1             │  │
│ │ Células com relatório         △  │ │ │ └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘  │
│ │ pendente                         │ │ └──────────────────────────────────────────────────────────────────────────┘
│ │ 3                                │ │
│ └──────────────────────────────────┘ │
│ …                                    │
└──────────────────────────────────────┘
```
- **Título (RN-08, P-SIT-07):** "Células com relatório pendente". Some "Células sem Relatório". Os outros cards não mudam (PO-UX-5).
- **Ícone (UXD-9):** `TriangleAlert`, o mesmo do "Pendente" da lista, no lugar do `Clock`, com a cor de hoje (`text-warning`) e `aria-hidden`. A cor e o clique são do E2.14.
- **Título que quebra:** sem `truncate`. O título dos cards passa de `leading-none` (o padrão do `CardTitle`) para `leading-snug`, e o ícone fica no alto (`items-start`), e não no meio de um título de três linhas. Vale para todos os cards do `StatCard`, que hoje já quebram em 1024 px ("Visitantes em Células").
- **Número:** `dashboard_summary.cells_pending`, pela RN-08, com o `formatCount` de hoje. "0" quando não há pendente.
- **Sem acesso, carregando e erro:** como hoje (E1.08 e E2.02, T9).
- Componentes: os de hoje (`Card`, `Skeleton`).

#### T5. Telas sem mudança visual
- **Formulário de célula (E2.08):** nada muda. Depois de salvar, a lista mostra a situação nova (P44).
- **Formulário de relatório (E2.08, T8; E2.11):** nada depende da situação (RN-01). Depois de enviar, a lista de Células e o Dashboard mostram a situação nova.
- **Relatórios, excluídos (E2.01), Ministérios, Membros, Funções e Auditoria:** sem mudança. Excluir ou restaurar um relatório também atualiza a lista de Células e o Dashboard (AQ-3).

#### T6. As perguntas Q-1 a Q-6 na tela
Com o padrão do Negócio (nenhuma regra nova), vale o que está nas T1 a T5. Se a resposta for sim:

- **Q-1. Recesso.**
  - Um valor novo na situação da semana: "Recesso" †, neutro (`muted`), com o ícone `CalendarOff`, para todas as células daquela semana. Não conta no card nem na linha das semanas (o Negócio decide se interrompe a contagem).
  - A legenda ganha "A igreja não terá células nesta semana. Nenhum relatório fica pendente." †.
  - No Dashboard, o título da seção ganha "· Recesso" †: "Esta Semana (22/11 - 28/11) · Recesso".
  - Precisa de uma tela nova para marcar as semanas de recesso, fora deste passo.
- **Q-2. "Não houve célula" em várias semanas seguidas.**
  - Uma segunda linha no lugar da linha das semanas (P72), com o ícone `CircleSlash2`: "Não houve célula nas {N} últimas semanas" †, a partir de 2, contando a atual. Aparece junto do "Enviado · Não houve célula".
  - A legenda ganha uma linha, e o filtro do E2.10, uma opção.
- **Q-3. Outro prazo.**
  - *Um prazo para todas as células:* mudam só os textos, na explicação de "Ainda não ocorreu" ("O relatório fica pendente {prazo} depois do horário da célula.").
  - *Um prazo por célula:* o grupo "Reunião" do formulário de célula (E2.08) ganha o campo "Prazo do relatório" † (`Select`), e a legenda passa a dizer "depois do prazo da célula". A lista não muda.
- **Q-4. Card das semanas anteriores.**
  - Um card a mais em "Esta Semana", logo depois do de pendentes: "Células sem relatório nas 2 ou mais semanas anteriores" †, com o ícone `CalendarX2` do P72.
  - A seção passa a 5 cards (4 e 1 em 1024 px). O clique é do E2.14.
- **Q-5. Macrocélula com outra regra.**
  - *Sem relatório semanal:* a macrocélula mostra "Relatório: Sem relatório semanal" †, em texto, como "Sem dia da reunião" (P71), e não conta no card. Na tabela, o mesmo texto. A legenda ganha uma linha.
  - *Com outra periodicidade (por exemplo, mensal):* os textos "desta semana" deixam de servir para ela. É um desenho à parte.
- **Q-6. Lembrete do líder.**
  - *Automático, pelo servidor:* nada muda nestas telas. Uma eventual preferência fica em "Meus dados".
  - *Manual:* nas células "Pendente", o "⋯" do cartão e da tabela ganha "Lembrar o líder pelo WhatsApp" †, que abre o WhatsApp com "Olá, {Nome}! O relatório da célula de {dia} ainda não foi enviado." †. Só para quem vê o celular do líder ("Visualizar Dados Sensíveis"). Nunca "cobrar".

### Padrões novos (valem para as próximas telas)
A numeração começa em P70 (ver a nota do início da seção). Este passo também aplica o P6 (badges com contraste), o P8 ("Excluir" no "⋯" do cartão), o P10 (subtítulo com o alcance), o P40 (nível entre parênteses), o P44 (o que salvar desatualiza), o P45 (que o P74 estende para Células) e o P65 (ações no mesmo lugar), sem mudá-los.

- **P70. Situação do relatório: texto, tom e ícone.** Uma função só, para todas as telas (lista, legenda, filtro e detalhe do E2.10, gráfico do E2.14). Recebe o código do servidor (AQ-1) e devolve o texto, o tom do `StatusBadge` e o ícone.

  | Valor (RN-04) | Texto | Tom | Ícone |
  |---|---|---|---|
  | Enviado, célula realizada | Enviado · Célula realizada | `success` | `CheckCircle2` |
  | Enviado, não houve célula | Enviado · Não houve célula | `success` | `CheckCircle2` |
  | Ainda não ocorreu | Ainda não ocorreu | `muted` | `Clock` |
  | Pendente | Pendente | `warning` | `TriangleAlert` |
  | Conta a partir da próxima semana | Conta a partir da próxima semana | `muted` | `CalendarClock` |
  | sem situação: célula inativa | nada no cartão; "—" na tabela | — | — |
  | sem situação: sem dia da reunião (RN-07) | Sem dia da reunião, em texto, sem badge | — | — |
  | código ausente ou desconhecido numa célula ativa | "—", com "Situação indisponível" † para o leitor de tela | — | — |

  - **Forma:** o `StatusBadge` do P6, com `rounded-md`, `whitespace-normal`, `text-left` e `items-start` (o ícone na altura da primeira linha) (UXD-8). O texto quebra por dentro quando não cabe.
  - **O "·" do "Enviado":** `aria-hidden`, com ", " em `sr-only`. O leitor ouve "Enviado, Célula realizada".
  - **Nunca:** "Status", "Atrasado", "Entregue", "Cancelada" ou "Sem relatório a {N} semanas" (Textos de tela do Negócio). "Relatório em dia" pode voltar só como opção do filtro do E2.10 (Impactos do Negócio).
- **P71. A informação "Relatório" de uma célula.** Vale na lista e no detalhe da célula (E2.10).
  - No cartão: o rótulo "Relatório:", o badge do P70 e a linha do P72, num `flex flex-wrap`. Na tabela: a coluna "Relatório", com o badge e a linha um embaixo do outro.
  - Célula inativa: no cartão, sem a linha; na tabela, "—". Sem dia da reunião: o texto no lugar do badge.
  - Nada é clicável: a explicação fica na legenda (P73).
- **P72. Semanas anteriores sem relatório.** Uma linha de texto com o ícone `CalendarX2` (`aria-hidden`), em `text-xs font-medium text-foreground`, e não um badge.

  | Contagem (RN-05) | Texto |
  |---|---|
  | 0, ou situação "Enviado" | nada |
  | 1 | Sem relatório na semana passada |
  | 2 ou 3 | Sem relatório nas {N} semanas anteriores |
  | 4 ou mais | Sem relatório nas 4 ou mais semanas anteriores |

  - O texto quebra linha, sem `truncate`.
- **P73. Legenda recolhível de uma informação calculada.** Quando uma lista mostra uma informação calculada que precisa de explicação, a explicação fica numa legenda acima da lista, e não em dicas por item.
  - Um `Collapsible` fechado por padrão, com um botão `ghost` com o ícone `Info`, o texto e o `ChevronDown`, `h-11` no celular.
  - Dentro, uma `dl` com o mesmo badge da lista no `dt` e a explicação no `dd`.
  - Fica à vista em todos os estados da lista, menos no erro ao carregar, e não guarda o estado.
  - Generaliza o "Como marcar" de Escolas.
- **P74. Lista que não cabe em 720 px: cartões até 1279 px.** Estende o P45.
  - Vale quando a tabela, com o texto quebrando, precisa de mais de 720 px, a área útil em 1024 px com o menu fixo. A conta é a da UXD-5.
  - Os cartões vão até 1279 px, e a tabela entra em 1280 px (`xl`). De 1024 a 1279 px, o corpo do cartão tem duas colunas (`lg:grid lg:grid-cols-2 lg:gap-x-8`), sem reordenar o DOM.
  - As ações do cartão (44×44 px, "Excluir" no "⋯", P8) valem até 1279 px.
  - A troca não pode mostrar o layout errado no primeiro render (P45): um hook que lê `window.matchMedia("(min-width: 1280px)")` já no valor inicial do `useState`, ou a troca só por CSS (`xl:hidden` e `hidden xl:block`).
  - Vale para Células neste passo. Membros continua no P45.

Nenhum componente novo do shadcn é necessário: `collapsible`, `badge`, `button`, `card`, `table`, `skeleton` e `dropdown-menu` já estão em `src/components/ui`. Os ícones `CheckCircle2`, `Clock`, `TriangleAlert`, `CalendarClock`, `CalendarX2`, `Info` e `ChevronDown` existem no `lucide-react` do projeto (0.462).

### Estados
| Estado | Lista de Células (T1, T2) | Legenda (T3) | Dashboard (T4) |
|---|---|---|---|
| Carregando | Como hoje (E1.08). Com o P74, o primeiro render já mostra cartão ou tabela certos. A situação chega na mesma linha (AQ-2), sem carregamento à parte. | À vista e fechada. | Como hoje: o `Skeleton` no lugar do número. |
| Troca de página | Os dados anteriores ficam, com `opacity-60` (E1.08). | Sem mudança. | — |
| Depois de uma ação do app (RN-09) | Enviar, editar, excluir ou restaurar um relatório; editar, inativar, reativar ou restaurar uma célula: a lista na tela recarrega com as linhas em `opacity-60` e `aria-busy="true"` (P44) e mostra a situação nova, sem recarregar a página. Numa visita seguinte, carrega do zero, sem a situação antiga do cache (AQ-3). | Sem mudança. | Carrega do zero na visita seguinte (AQ-3). |
| Passagem do tempo com a tela aberta | Nada muda até uma consulta nova: abrir a tela de novo ou voltar para a aba ou para o app (UXD-10, AQ-4). | O rodapé diz que a situação é a do carregamento. | Idem. |
| Vazio | Como hoje. | À vista. | O número "0". |
| Erro ao carregar | Como hoje ("Erro ao carregar as células"). | Some, com a lista. | Como hoje. |
| Sem permissão | Como no E2.02: quem vê a célula vê a situação, sem permissão nova. | Para quem vê a lista. | "Você não tem acesso ao dashboard." (E1.08, E2.02). |
| Dado ausente | Célula inativa: sem a linha (cartão) ou "—" (tabela). Sem dia válido: "Sem dia da reunião". Código desconhecido: "—" (P70). | — | — |
| Lista grande | Paginação do E1.08. A situação é calculada pelo servidor, por página (AQ-2). | — | — |
| Queda de conexão no envio | Não há envio nesta tela. Se o relatório não foi gravado, a situação não muda, e a falha aparece no formulário (E2.08, T8; E2.11). | — | — |

### Textos
Complementam os "Textos de tela" do Negócio, sem mudar os termos. Os marcados com † foram definidos pela UX e estão nas pendências (PO-UX-7).

| Onde | Texto |
|---|---|
| Cartão: rótulo | Relatório: |
| Tabela: colunas | Líder · G12 · Endereço · Reunião † · Relatório · Situação · Ações |
| Reunião | {Dia} · {HH:mm} · (leitor de tela) {Dia}, {HH:mm} |
| Situação da semana (Negócio) | Enviado · Célula realizada · Enviado · Não houve célula · Ainda não ocorreu · Pendente · Conta a partir da próxima semana · (leitor de tela) Enviado, Célula realizada · Enviado, Não houve célula |
| Semanas anteriores (Negócio) | Sem relatório na semana passada · Sem relatório nas 2 semanas anteriores · Sem relatório nas 3 semanas anteriores · Sem relatório nas 4 ou mais semanas anteriores |
| Sem situação | Sem dia da reunião (Negócio) · — · (leitor de tela, tabela) Não se aplica, célula inativa † · (leitor de tela) Situação indisponível † |
| Legenda: botão † | Entenda a situação do relatório |
| Legenda: Enviado · Célula realizada † | O relatório desta semana foi enviado, e a célula se reuniu. |
| Legenda: Enviado · Não houve célula † | O relatório desta semana foi enviado com "Não houve célula". |
| Legenda: Ainda não ocorreu (Negócio) | A reunião desta semana ainda não aconteceu. O relatório fica pendente 1 hora depois do horário da célula. |
| Legenda: Pendente (Negócio) | A reunião desta semana já passou e o relatório não foi enviado. |
| Legenda: Conta a partir da próxima semana (Negócio) | A célula foi cadastrada ou reativada depois da reunião desta semana. O relatório só fica pendente a partir da próxima semana. |
| Legenda: semanas † | Sem relatório nas semanas anteriores · Quantas semanas seguidas, antes desta, ficaram sem relatório. Vai até "4 ou mais". |
| Legenda: rodapé † | A semana vai de domingo a sábado. A situação é a do momento em que a lista foi carregada. |
| Dashboard (Negócio) | Células com relatório pendente |
| Q-1 a Q-6, se adotadas † | Recesso · A igreja não terá células nesta semana. Nenhum relatório fica pendente. · "· Recesso" (no título da seção do Dashboard) · Não houve célula nas {N} últimas semanas · Prazo do relatório · Células sem relatório nas 2 ou mais semanas anteriores · Sem relatório semanal · Lembrar o líder pelo WhatsApp · Olá, {Nome}! O relatório da célula de {dia} ainda não foi enviado. |

### Acessibilidade
- **Leitura do cartão:** o texto é o nome, sem `aria-label` por cima. A ordem do DOM é a visual: "Relatório: Pendente, Sem relatório nas 2 semanas anteriores". Os ícones são `aria-hidden`. O "·" do "Enviado" e o da reunião são `aria-hidden`, com ", " em `sr-only`.
- **Tabela:** os títulos são `th` com `scope="col"`. Na célula inativa, o "—" é `aria-hidden`, e o leitor ouve "Não se aplica, célula inativa".
- **Nada a mais no Tab:** os badges não são focáveis, não têm `title` e não abrem nada. A única parada nova na lista é o botão da legenda.
- **Legenda (P73):** o `CollapsibleTrigger` do Radix já é um `button` com `aria-expanded` e `aria-controls`. O conteúdo vem logo depois do botão no DOM. A `dl` dá ao leitor o par "termo e explicação".
- **Atualização:** enquanto recarrega, a lista fica com `aria-busy="true"` (P44). A mudança da situação não é anunciada; o toast do formulário de relatório já anuncia o envio.
- **Sem depender de cor:** cada valor tem texto e um ícone diferente; a linha das semanas é texto; "Sem dia da reunião" é texto.
- **Contraste, nos temas claro e escuro:** 4,5:1 para o texto dos badges (P6: `text-foreground` sobre o fundo tingido), da linha das semanas (`text-foreground`), do rótulo "Relatório:" (`text-muted-foreground`, 4,6:1 no claro e 5,6:1 no escuro, P21) e da legenda (`text-foreground` sobre `bg-muted/50`). Os ícones acompanham texto e são decorativos.
- **Zoom de 200%, 320 px e fonte grande:** os badges do relatório quebram por dentro (P70); a linha das semanas, os nomes e o título do card do Dashboard quebram linha. Nada tem altura fixa nem `truncate`. Os cartões e a tabela em 1280 px não rolam na horizontal.
- **Toque:** o botão da legenda tem 44 px de altura no celular. As ações dos cartões seguem o E2.08 (44×44 px, 8 px entre si) até 1279 px.
- **Movimento:** o giro do `ChevronDown` respeita `motion-reduce:`.

### Critérios de UX
| ID | Critério | Como verificar |
|---|---|---|
| UX-01 | Na lista de Rita, na quinta, 26/11, às 10:00 (relógio do servidor), em 360×800 (cartões): C1 e C2 "Relatório: Pendente"; C3 e C4 "Ainda não ocorreu"; C5 "Enviado · Não houve célula"; C6 "Ainda não ocorreu" com "Sem relatório nas 3 semanas anteriores"; C9 "Pendente" com "Sem relatório nas 2 semanas anteriores". O cartão de C7 tem "Inativa" e não tem o texto "Relatório". Depois do critério da RN-06, C10 mostra "Conta a partir da próxima semana", sem a linha das semanas. | teste E2E (massa) |
| UX-02 | Em 1280×800, a tabela de Rita tem as colunas Líder, G12, Endereço, Reunião, Relatório, Situação e Ações, nessa ordem, sem "Tipo", "Dia / Hora" nem "Status". A coluna Relatório mostra os mesmos valores da UX-01, e a linha de C7 mostra "—", lido como "Não se aplica, célula inativa". A coluna Reunião mostra "Quarta · 20:00" e o badge do tipo. | teste de componente + teste E2E (viewport) |
| UX-03 | Na lista de Pedro, na terça, 24/11, às 10:00: C1 e C3 "Ainda não ocorreu"; C6 "Ainda não ocorreu" com "Sem relatório nas 3 semanas anteriores"; C9 "Ainda não ocorreu" com "Sem relatório nas 2 semanas anteriores"; C7 só com "Inativa". C2, C4, C5 e C8 não aparecem. Caio vê C1 igual a Pedro. | teste E2E (massa) |
| UX-04 | Para cada código do servidor, a função do P70 devolve o texto, o tom e o ícone da tabela do P70, e a do P72 devolve os textos para 0, 1, 2, 3, 4 e 7 semanas ("4 ou mais" a partir de 4). O DOM de Células e do Dashboard não tem "Status", "Atrasado", "Entregue", "Cancelada", "Células sem Relatório", "Sem relatório a " nem "cobr". | teste unitário + teste de componente |
| UX-05 | Os badges do relatório usam o `StatusBadge` com os tons do P70, `rounded-md` e quebra de linha por dentro. Nenhum usa texto branco sobre `bg-success` ou `bg-warning`. A linha das semanas tem o ícone `CalendarX2` e o texto em `text-foreground`. | teste de componente + inspeção |
| UX-06 | Células mostra cartões numa coluna em 360×800 e em 768×1024, cartões com duas colunas em 1024×768 (pessoas e endereço à esquerda, reunião e relatório à direita, com a mesma ordem do DOM do celular) e a tabela em 1280×800 e em 1440×900. Em 1280×800, o primeiro render já é a tabela; em 1024×768, já são os cartões. | teste E2E (viewport) + teste de componente (`matchMedia` simulado) |
| UX-07 | Em 320×640, com zoom de 200% e com a fonte grande, "Conta a partir da próxima semana" e "Enviado · Não houve célula" quebram por dentro do badge, sem corte, e a linha "Sem relatório nas 4 ou mais semanas anteriores" quebra linha. Em 1280×800, com nomes de 40 caracteres, endereço de 50 caracteres e esses textos, a tabela não rola na horizontal. | teste E2E (viewport) + inspeção |
| UX-08 | Uma célula de teste sem dia válido mostra "Relatório: Sem dia da reunião" no cartão e "Sem dia da reunião" na tabela, sem badge e sem a linha das semanas. Um código desconhecido mostra "—", lido como "Situação indisponível", sem quebrar a tela. | teste de componente |
| UX-09 | A legenda começa fechada, com o botão "Entenda a situação do relatório" de pelo menos 44 px de altura em 360×800 e `aria-expanded="false"`. Aberta, mostra os cinco badges do P70, a linha do P72 e o rodapé, com os textos da tabela de Textos, numa `dl`. Fica à vista enquanto a lista carrega e sem resultado na busca, e some no erro. Nenhuma explicação depende de passar o mouse. | teste de componente + teste E2E (medida) |
| UX-10 | Carla envia o relatório de C1 pelo "Novo relatório" da lista. Sem recarregar a página, o cartão (360×800) e a linha (1280×800) de C1 passam a "Enviado · Célula realizada"; enquanto a lista recarrega, as linhas ficam em `opacity-60` e com `aria-busy`; o foco volta ao botão que abriu o formulário. Pedro inativa C1, e o cartão perde a linha "Relatório" sem recarregar. | teste E2E (massa) |
| UX-11 | Na quinta, 26/11, Carla envia o relatório desta semana de C1, e Rita o exclui em Relatórios e abre Células: a primeira lista exibida já mostra C1 "Pendente", sem nunca mostrar "Enviado" vindo do cache. O mesmo para o card do Dashboard (de 2 para 3) e para a restauração do relatório (de volta a "Enviado"). | teste E2E |
| UX-12 | Com o navegador em `Europe/Lisbon` (Playwright `timezoneId`) e o servidor na quarta, 25/11, às 20:30 de Brasília, C1 aparece "Ainda não ocorreu". O front não calcula a situação: a função do P70 só traduz o código, sem ler a data do aparelho. | teste E2E (fuso) + teste unitário |
| UX-13 | O card do Dashboard se chama "Células com relatório pendente", tem o ícone `TriangleAlert` (`aria-hidden`) e não tem "Células sem Relatório". Em 360×800, 1024×768 e 1280×800, o título quebra linha sem corte e sem linhas encostadas (`leading-snug`). Na quinta, 26/11, às 10:00, o card de Rita mostra 3 e o de Pedro, 2: o mesmo número de "Pendente" na lista de cada um. | teste de componente + teste E2E (massa) |
| UX-14 | O leitor de tela lê, no cartão de C9, "Relatório: Pendente, Sem relatório nas 2 semanas anteriores"; no de C5, "Enviado, Não houve célula"; na reunião, "Quarta, 20:00". Os ícones não são lidos. Os badges não recebem foco. | teste de componente + inspeção (leitor de tela) |
| UX-15 | O contraste é de 4,5:1 para o texto dos badges do relatório, da linha das semanas, do rótulo "Relatório:" e da legenda, nos temas claro e escuro. Nenhum valor depende só de cor. | inspeção (axe, nos dois temas) |
| UX-16 | Com a lista aberta das 20:50 às 21:05 da quarta, sem trocar de aba, C1 continua "Ainda não ocorreu". Ao voltar à aba ou abrir a tela de novo, C1 aparece "Pendente". | teste E2E (relógio do servidor) |

### Perguntas para o `architect` (dados e contrato)
Em cada uma, a tela tem um comportamento padrão, o mais conservador, se a resposta for "não", menos onde está dito que não há.

- **AQ-1. A situação na linha da célula, em códigos** (RN-04, RN-05, RN-07, P70, P72). A `cells_view` (o `report_status` previsto nos Pontos de extensão do E1.08) devolve, por célula:
  - o valor da semana, num código estável: enviado, ainda não ocorreu, pendente, conta a partir da próxima semana, sem dia da reunião; nulo para a célula inativa;
  - no "Enviado", se a célula se reuniu ou não (o `was_held` do relatório da semana), para o detalhe;
  - a contagem das semanas anteriores, de 0 a 4, em que 4 quer dizer "4 ou mais".

  A tela só traduz os códigos e não deduz nada de `meeting_day`, `is_active`, `last_report_date` nem do relógio do aparelho.
  - *Padrão sem isso:* não há. A tela não pode calcular a situação (Pontos para o `architect`, 1).
- **AQ-2. Uma consulta só.** A situação chega na mesma linha da página da lista, calculada com um "agora" só para a página inteira. Assim, não há estado de carregando nem de erro só da coluna.
  - *Padrão se vier à parte:* a coluna mostra um `Skeleton` do tamanho do badge até chegar e, na falha, "—" com "Situação indisponível".
- **AQ-3. O que cada gravação desatualiza** (P44, RN-09). Enviar, editar, excluir e restaurar um relatório, inclusive pela lista de excluídos do E2.01, desatualizam a lista de Células e o Dashboard. Hoje, `use-save-cell-report` e `use-cell-report-deletion` invalidam `cells` e `dashboard`, mas uma consulta invalidada que não está na tela mostra o valor antigo até a resposta nova chegar. A tela que não está à vista deve carregar do zero (`resetQueries` ou `removeQueries`), como a AQ-6 do E2.06 e a AQ-8 do E2.08 já pedem para as gravações de membro e de célula.
- **AQ-4. Consulta nova ao voltar para a tela** (UXD-10, RN-09). O `QueryClient` de hoje usa os padrões do TanStack Query: `refetchOnWindowFocus` e `refetchOnReconnect` ligados e `staleTime` zero. Voltar para a aba ou para o app consulta de novo e traz a situação do momento. Confirmar que isso fica, e que o teste da RN-09 ("não consultou de novo") não troca o foco da janela.
- **AQ-5. Um lugar só no front para os textos.** A função do P70 e a do P72 (por exemplo, em `src/lib/cells/report-status.ts`) servem à lista, à legenda e, depois, ao filtro e ao detalhe do E2.10 e ao gráfico do E2.14, com teste unitário para cada código.
- **AQ-6. Troca em 1280 px** (P74). Células deixa de usar o `useIsMobile` (768 px) e passa a trocar em 1280 px, com o valor certo no primeiro render. O E2.06 já previa um hook com `matchMedia` para os 1024 px do P45; o mesmo hook, com a largura como parâmetro, serve aos dois.
- **AQ-7. Ordem com os outros passos.** Este desenho parte da lista de Células com o front do E2.06 (T2, P45) e do E2.08 (T7, P65), que mexem no mesmo `Cells.tsx`. Se o E2.09 chegar antes, a tarefa de front inclui o P45 e o P65 para Células.
- **Pontos de extensão (para não refazer):**
  - E2.10: o filtro usa os textos do P70 e do P72 e pode usar as explicações da legenda como dica de cada opção; o detalhe da célula usa o P71;
  - E2.11: o "Novo relatório" na célula "Enviado" (PO-UX-6);
  - E2.14: o gráfico da semana usa os tons do P70 (realizadas em `success`, sem relatório em `warning`); a cor do card de pendentes e a do badge "Pendente" devem conversar (PO-UX-3).

### Pendências para o PO (resolvidas em 2026-11-24)
Nenhuma bloqueia o desenho. Em todas, a UX adotou a opção marcada como "*Adotado*". O PO resolveu as sete em 2026-11-24, sem perguntas ao usuário, todas com o padrão da UX. Elas viraram os padrões P-SIT-12 a P-SIT-18 do Negócio, que ajustou as RN-03, RN-04, RN-08 e RN-09, os critérios dessas regras, os Textos de tela, as Telas afetadas e os Impactos no E2.11 e no E2.14. **Revisar no PR.**

- **PO-UX-1. O detalhe do "Enviado" aparece sempre, também quando quem consulta não vê o relatório.** A RN-04 (a) diz que o "Enviado" vem com o detalhe, e o critério da RN-03 (o relatório de C1 que Pedro não vê) diz só "Enviado".
  - *Adotado:* sempre com o detalhe, como na RN-04 (a). "Célula realizada" ou "Não houve célula" não revela nada do conteúdo do relatório.
  - *Alternativa:* só "Enviado" para quem não vê o relatório. A tela precisaria saber, por linha, se o relatório é visível (AQ-1).
  - Se o padrão ficar, o critério da RN-03 passa a dizer "Enviado · Célula realizada".
  - **Resolvida: aceito o padrão da UX (P-SIT-12; RN-03 e RN-04 a).** O detalhe não revela o conteúdo do relatório, e a alternativa exigiria a visibilidade linha a linha. O critério da RN-03 passou a dizer "Enviado · Célula realizada" e ganhou o caso "Não houve célula", com a consequência aceita: esse relatório invisível não entra no card "Células Não Realizadas" de quem não o vê.
- **PO-UX-2. "Enviado · Não houve célula" com o mesmo tom e ícone do "Enviado · Célula realizada"** (verde de sucesso, ✓) (UXD-2, P70).
  - *Adotado:* o mesmo, porque o relatório foi enviado e a célula não fica pendente, como no legado ("Relatório em dia").
  - *Alternativa:* tom neutro para "Não houve célula", para destacar as células que não se reuniram.
  - **Resolvida: aceito o padrão da UX (P-SIT-13; RN-04 a).** O relatório foi enviado, e a célula não está pendente, como no legado. Destacar as células que deixaram de se reunir depende da Q-2, que continua com o usuário.
- **PO-UX-3. "Pendente" em amarelo de aviso, e não em vermelho** (UXD-2). O legado pinta o card de vermelho quando há pendentes (DSH-06), e a cor do card é do E2.14.
  - *Adotado:* amarelo na lista, porque o "Pendente" ainda tem conserto, e o vermelho fica para erro e exclusão.
  - *Ciência:* se o E2.14 fizer o card vermelho, o card avisa a quantidade e o badge avisa a célula. As duas cores convivem, mas o E2.14 pode preferir alinhar.
  - **Resolvida: aceito o padrão da UX (P-SIT-14).** "Pendente" ainda tem conserto: é aviso, e não erro. A cor do card continua com o E2.14, que decide entre a DSH-06 e o alinhamento com o badge (Impactos do Negócio).
- **PO-UX-4. A legenda "Entenda a situação do relatório"** (UXD-7, P73, T3): fechada por padrão, com as três explicações do Negócio e quatro textos novos: os dois "Enviado", as semanas anteriores e o rodapé ("A semana vai de domingo a sábado. A situação é a do momento em que a lista foi carregada.").
  - *Adotado.* O rodapé responde à P-SIT-08 na própria tela.
  - **Resolvida: aceito o padrão da UX (P-SIT-15; RN-09).** A legenda entrou na RN-09, e os quatro textos novos foram copiados para os Textos de tela do Negócio, sem mudança. O critério da RN-09 ganhou a legenda.
- **PO-UX-5. O card do Dashboard** (UXD-9, T4):
  - o título novo tem só a primeira letra maiúscula, ao lado de "Relatórios Enviados", "Visitantes em Células" e "Células Não Realizadas", que o Negócio manteve. *Sugestão:* o E2.14 passa os quatro para o mesmo padrão ("Relatórios enviados", "Visitantes em células", "Células não realizadas"), como o E2.08 fez com "Nova célula";
  - o ícone passa do relógio para o triângulo do "Pendente", porque na lista o relógio quer dizer "Ainda não ocorreu";
  - o título de todos os cards passa a quebrar linha com espaçamento legível.
  - *Adotado.*
  - **Resolvida: aceito o padrão da UX e a sugestão (P-SIT-16; RN-08).** O ícone entrou na RN-08 e no critério dela. A padronização dos outros três títulos ficou como impacto no E2.14, que cuida desses cards.
- **PO-UX-6. "Novo relatório" continua na célula "Enviado"** (RN-01: a situação não libera nem bloqueia o lançamento). Carla pode abrir o formulário de C1 já enviado, preencher tudo e só então receber a recusa de um por semana.
  - *Adotado:* como está, porque é regra do E2.11.
  - *Sugestão para o E2.11:* na célula "Enviado", o formulário avisa no topo, antes de preencher, que o relatório desta semana já foi enviado, ou a ação leva ao relatório enviado.
  - **Resolvida: aceito o padrão da UX (P-SIT-17).** A ação continua, porque a situação pode estar desatualizada e o relatório pode ter sido excluído. A decisão de avisar antes de preencher ficou como impacto no E2.11, com a recomendação do PO: avisar no topo, com a mensagem da REL-03, e oferecer o relatório enviado a quem pode vê-lo. O critério da RN-09 confirma que a ação continua.
- **PO-UX-7. Textos definidos pela UX** (marcados com † em Textos): "Reunião" no título da coluna; "Entenda a situação do relatório" e os quatro textos novos da legenda; "Não se aplica, célula inativa" e "Situação indisponível", para o leitor de tela; e os textos das respostas possíveis da T6 (Q-1 a Q-6), que só valem se a pergunta virar regra.
  - *Adotados.*
  - **Resolvida: aceito o padrão da UX (P-SIT-18).** "Reunião" é o nome do grupo desses campos no formulário de célula (E2.08). Os textos da legenda estão nos Textos de tela do Negócio; os do leitor de tela e da T6 ficam em "Textos" desta seção. As perguntas Q-1 a Q-6 continuam com o usuário.

## Solução técnica
_Seção do `architect`. Escrita em 2026-11-24, só como desenho: nada foi implementado. **O PR de banco precisa só do PR 1 do E2.01 em produção (já está) e entra, de preferência, depois do PR 2 do E2.08 (dia e horário obrigatórios).** Os PRs de front esperam também o front dos passos que mexem nas mesmas telas ([Implantação](#implantação)). O desenho parte do estado final do E2.01, do E2.02, do E2.05, do E2.06 e do E2.08, com os nomes que eles definem, mas nenhum deles é pré-requisito do cálculo. Se um nome ou uma assinatura mudar lá, as tarefas 3 e 9 voltam ao `architect`._

_Conferido em 2026-11-24:_
- _na stack local `supabase_db_mci-e108-pr2` (E1.08 e PRs 1 e 2 do E2.01), só com leitura:_
  - _PostgreSQL 17.12 (o tipo multirange existe desde o 14);_
  - _a `cells_view` vigente (com o comentário "E2.09: report_status entra no fim da lista"), `cells` (`is_active NOT NULL`, `created_at NOT NULL` até o E2.05, `deleted_at`), `cell_reports` (`was_held NOT NULL`) e o índice único `cell_reports_cell_week_key (cell_id, week_start(date)) WHERE deleted_at IS NULL`;_
  - _o `dashboard_summary` e os pgTAP do E1.08 (PRs 2 e 3) e do E2.01 que dependem de `cells_pending` e da lista de colunas da `cells_view`;_
  - _o schema `private`: só `postgres` tem USAGE; `anon` e `authenticated` não têm;_
  - _com `EXPLAIN`, sem criar nada: (1) as colunas não pedidas de uma view `security_barrier` não são calculadas; (2) o planejador remove um `LEFT JOIN LATERAL` a um agregado sem `GROUP BY` (uma linha só) quando nenhuma coluna dele é pedida, inclusive sobre uma função `SECURITY DEFINER` (testado com `member_names`), e o executa uma vez por linha quando alguma é pedida;_
  - _`timezone(text, timestamp)` e `timezone(text, timestamptz)` são `IMMUTABLE`; `enum_eq` não é *leakproof*, então um filtro na coluna nova é aplicado depois do escopo, o que só custa tempo;_
  - _as operações com multirange: subtrair `[agora, ∞)` fecha o período aberto, somar reabre, e períodos encostados se juntam;_
  - _a [conferência](#conferência-em-produção-tarefa-1), que rodou sem erro;_
- _no `mci-connect` (`origin/main`, `4595daa`): `Cells.tsx`, `Dashboard.tsx`, `StatusBadge.tsx`, `App.tsx` (`QueryClient` com os padrões), `use-cells-list.ts`, `use-dashboard.ts`, `use-save-cell-report.ts`, `use-cell-report-deletion.ts`, `src/lib/cells/fields.ts`, `e2e/dashboard.spec.ts` e `playwright.config.ts`;_
- _nos specs: E1.08 (risco 13, Pontos de extensão, volume de referência), E2.01 (`delete_cell`, `restore_cell`, `restore_cell_report`, `use-restore`), E2.05 (`created_at` nulo no legado), E2.06 (`private.member_hierarchy`, `use-min-width`, `refreshAfterCellWrite`), E2.08 (DT-02, `can_submit_report`) e E2.10 (o parâmetro `report_status` da URL)._

### Revisão das regras
Nenhuma RN voltou ao PO. As lacunas técnicas foram resolvidas pela leitura mais conservadora e estão em [Definidas pelo architect](#definidas-pelo-architect-revisar-no-pr).

Casos de borda conferidos:
- **Fuso:** "agora" é o `now()` do servidor, convertido para `America/Sao_Paulo` num lugar só (`sp_local`). O prazo é calculado em hora local e convertido de volta (`sp_instant`) para comparar com os momentos do histórico. Nenhuma conta usa o fuso da sessão nem o relógio do aparelho. Os testes rodam com a sessão em UTC, em Brasília e em Asia/Tokyo.
- **Virada de dia e de semana:** o prazo é `data + horário + 1 hora` como `timestamp`, então 23:30 vira 00:30 do dia seguinte, e sábado às 23:30 vira domingo às 00:30, fora da semana. Nesse caso a célula nunca fica "Pendente", e a semana entra nas anteriores no domingo (RN-02). A semana que conta é conferida no fim da semana (DA-1).
- **Casal, pastor, sem líder, inativo:** nenhuma regra olha as pessoas (RN-01). Cada célula tem a sua linha.
- **Excluído:** a célula excluída não está na `cells_view` (E2.01), e o relatório excluído não entra na leitura. O histórico fecha o período na exclusão e reabre na restauração.
- **Consolidado (futuro):** não muda células nem relatórios.
- **Concorrência:** a situação é só leitura. O histórico é gravado dentro do `UPDATE` que muda a célula, depois da trava da linha. Ver [Bloqueios e concorrência](#bloqueios-e-concorrência).
- **Volume:** uma chamada por célula pedida, com duas leituras por índice. Ver [Desempenho](#desempenho).

Leituras técnicas. Nenhuma muda regra, mas o PO e o QA precisam saber delas:
1. **"Agora" é o início da transação da consulta.** A página da lista e o total dela saem do mesmo instante (AQ-2). A lista e o Dashboard são consultas separadas: se um prazo passar entre as duas, os números podem diferir em uma célula. A RN-08 compara "o mesmo momento".
2. **O momento de cada mudança da célula é o início da transação que a gravou** (DA-2), o mesmo de `created_at`, `deleted_at` e da Auditoria.
3. **Relatório com data futura dentro da semana** (aceito até o E2.11, REL-01) já deixa a célula "Enviado", porque vale a data do relatório (RN-03).
4. **Mudar o dia ou o horário recalcula as semanas anteriores** com os valores novos (RN-06). Na primeira semana de uma célula, mover a reunião para antes do cadastro tira essa semana da contagem.
5. **A célula inserida agora só conta a partir de agora.** As massas de teste com datas passadas ajustam o histórico (tarefa 3, risco 4).
6. **Filtrar pela situação calcula todas as células visíveis.** Listar sem esse filtro calcula só as linhas da página, e contar sem ele não calcula nada (DT-06).

#### Respostas aos pontos do PO e da UX
| Ponto | Resposta |
|---|---|
| 1. Um cálculo só, no banco | `private.cell_report_situation(célula, …, momento)` junta os dados e aplica a regra pura `private.report_situation_rule`. A `cells_view` usa a função com `now()`. `public.cells_report_situation(_at)` usa a mesma função em qualquer momento, e o `dashboard_summary.cells_pending` conta os "Pendente" dela. O E2.10 filtra pelas colunas da view, e o E2.14 usa a função com `_at`. O front só traduz os códigos (DT-01). |
| 2. Por semana, e não pelo `last_report_date` | A leitura pega os relatórios não excluídos das 5 semanas até a de referência, pelo índice único `(cell_id, week_start(date))`: no máximo 5 linhas. Semanas posteriores ao momento nunca entram, e o risco 13 do E1.08 deixa de existir (DT-02). |
| 3. Semanas que contam (RN-06) | `private.cell_active_periods` tem uma linha por célula, com um `tstzmultirange` dos períodos em que ela estava ativa e não excluída. Um trigger `AFTER` em `cells` abre o período no cadastro, na reativação e na restauração, e o fecha na inativação e na exclusão, com o relógio do servidor. A tabela fica fora da API e da Auditoria. A semana conta quando o prazo dela cai dentro de um período, então inativar e reativar sem passar um prazo deixa o prazo dentro. Ponto de partida e carga em [Histórico](#histórico-dos-períodos-ativos-migration-1) (DT-03, DT-04). |
| 4. Prazo | `private.report_deadline`: horário mais 1 hora, em `timestamp` local, que vira o dia e a semana sozinho; sem horário, 00:00 do dia seguinte; dia fora dos sete valores, `no_meeting_day` (RN-07). |
| 5. Filtrar e contar no servidor | Colunas calculadas só quando pedidas (DT-06), uma chamada por linha e duas leituras por índice. O E2.10 filtra e pagina pelo PostgREST sobre a view. Metas e plano B em [Desempenho](#desempenho). |
| 6. Atualização | Calculada a cada consulta, sem nada gravado. `refreshAfterReportWrite` em toda gravação de relatório (AQ-3, DT-12); a consulta nova ao voltar para a aba fica (AQ-4). A troca em 1280 px usa `useMinWidth(1280)` (AQ-6). |
| 7. Fuso | `sp_local` e `sp_instant` concentram o `America/Sao_Paulo`; `sp_now`, `sp_today` e o `dashboard_summary` passam a usá-las (DT-08). O pgTAP repete o do E1.08: sessão em UTC e em Asia/Tokyo, virada às 03:00 UTC de domingo. |
| 8. Ordem | O banco só precisa do PR 1 do E2.01, que está em produção. Com o PR 2 do E2.08 antes, a RN-07 nunca acontece; sem ele, a regra já a trata. O E2.02 muda o `WHERE` da `cells_view`, e as colunas novas herdam o escopo. |
| Testes do E1.08 | Mudam no PR 1 (tarefa 3): a linha do tempo do PR 3 avança uma hora (19:59 e 20:00 viram 20:59 e 21:00), o horário nulo entra às 00:00 do dia seguinte, a massa ganha o histórico "desde sempre", a conta paralela do teste dá lugar à função, e entra o caso do risco 13. A lista completa está em [Ajustes nos passos anteriores](#ajustes-nos-passos-anteriores). |

#### Definidas pelo architect (revisar no PR)
Pontos que as RNs não respondem por inteiro. O `architect` adotou a leitura mais conservadora e coerente com elas. O usuário pode mudar qualquer um no PR.

| # | Ponto | Padrão adotado | Por quê |
|---|---|---|---|
| DA-1 | Semana cujo prazo cai na semana seguinte (sábado a partir das 23:00, ou sábado sem horário): em que momento conferir se ela conta (RN-06) | No fim da semana (domingo, 00:00), e não no prazo | A RN-06 confere "no prazo", e aqui o prazo cai depois da semana. Conferido no prazo, a célula de sábado às 23:30 cadastrada ou reativada no domingo às 00:05 apareceria com "Sem relatório na semana passada" por uma semana em que não existia. Os critérios da C4 não mudam: ela já estava ativa no sábado. |
| DA-2 | Momento de cada mudança (cadastro, inativação, reativação, exclusão, restauração) | O início da transação no servidor (`now()`) | É o momento que `created_at`, `deleted_at` e a Auditoria já registram. Uma gravação que começa às 20:59:59 e termina às 21:00:01 vale como 20:59:59. |
| DA-3 | Mudança exatamente no prazo | Vale a situação de depois da mudança: cadastrada ou reativada às 21:00:00 conta para o prazo das 21:00 (critério da RN-06); inativada ou excluída às 21:00:00, não | Períodos fechados no início e abertos no fim. A mesma regra vale para as cinco mudanças. |
| DA-4 | Células já excluídas na publicação | A que estava ativa quando foi excluída conta do cadastro até a exclusão; a inativa, nunca. Restaurar abre um período novo | A RN-06 trata as ativas e as inativas na publicação, mas não fala das excluídas. A célula excluída não pode ser editada (E2.01), então `is_active` é a situação dela no momento da exclusão. Assim, excluir e restaurar sem passar um prazo também não muda nada para elas. |
| DA-5 | Célula sem linha no histórico (só por carga ou script com os triggers desligados e sem o *backfill*) | Nenhuma semana conta: "Ainda não ocorreu" ou "Conta a partir da próxima semana", sem semanas anteriores | Nunca inventa uma pendência. `private.cell_active_period_problems()` aponta a falha, a migration não termina com ela, e a reconciliação (E4.09) exige zero. |
| DA-6 | Semanas anteriores nas células sem contagem | Nulo na célula inativa e em "Sem dia da reunião"; zero no "Enviado" | A RN-05 zera a contagem no "Enviado". A célula sem situação não tem contagem, e a tela não mostra a linha (P71, P72). |
| DA-7 | Momento de referência no passado (`_at`) e relatório da mesma semana com data posterior a ele | Conta | A RN-03 vale pela data do relatório, e a RN-02 exclui só as semanas posteriores. Só importa nos testes e numa navegação por semana (E2.14). |
| DA-8 | Quem pode pedir a situação de outro momento (`cells_report_situation(_at)`) | Todo usuário logado, só para as células que vê | É a mesma informação da lista, calculada dos mesmos dados. Sem permissão nova (RN-09). |

### Visão geral
Quatro partes:
1. **Histórico dos períodos ativos** (`private.cell_active_periods`), gravado só pelo servidor, com ponto de partida para as células que já existem e para a carga.
2. **A regra num lugar só:** funções puras para o prazo, a semana que conta e a situação, e uma função por célula que junta os relatórios e o histórico e aplica a regra.
3. **Leitura:** duas colunas no fim da `cells_view`, calculadas só quando pedidas; `cells_report_situation(_at)` para qualquer momento; o card de pendentes do `dashboard_summary` pela mesma função.
4. **Front:** a tradução dos códigos num módulo só, a linha "Relatório", a legenda, a tabela a partir de 1280 px, o card do Dashboard e a atualização depois das gravações de relatório.

### Modelo de dados e migrations

#### Ordem das migrations
Os nomes são sugestões; o timestamp é o do momento da criação.
- Cada arquivo é idempotente (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP … IF EXISTS` antes de `CREATE TRIGGER`, `DO` com guarda de `duplicate_object`) e roda num banco zerado depois das migrations dos passos anteriores.
- **As mensagens das guardas trazem só ids.** Os logs do GitHub Actions de um repositório público são públicos.
- Depois do PR, regenere o `types.ts`.

| # | Arquivo | Conteúdo | Por que separado |
|---|---|---|---|
| 1 | `<ts>_e209_01_active_periods.sql` | Guarda; `private.cell_active_periods`; trigger `trg_cell_active_period`; `private.backfill_cell_active_periods()` e `private.cell_active_period_problems()`; *backfill* e guarda do invariante; grants | Grava dados e trava `cells` por um instante. Não muda nenhuma leitura. |
| 2 | `<ts>_e209_02_report_situation.sql` | Guarda; `sp_local` e `sp_instant` (e `sp_now` e `sp_today` sobre elas); enum `cell_report_status`; `private.report_deadline`, `private.report_week_counts`, `private.report_situation_rule` e `private.cell_report_situation`; `cells_view` com as duas colunas; `public.cells_report_situation(_at)`; `dashboard_summary` com o card novo; grants | Só leitura: funções, view e RPC. |

Os dois arquivos vão no mesmo PR e na mesma publicação, porque o ponto de partida da RN-06 é "a publicação deste passo".

#### Histórico dos períodos ativos (migration 1)
```sql
-- 0. Pré-requisitos: E2.01 PR 1 (deleted_at) e PostgreSQL 14+ (multirange).
DO $$ BEGIN
  IF current_setting('server_version_num')::int < 140000
     OR NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.cells'::regclass
                     AND attname = 'deleted_at' AND NOT attisdropped) THEN
    RAISE EXCEPTION 'E2.09 depende do PR 1 do E2.01 e do PostgreSQL 14 ou mais novo.';
  END IF;
END $$;

-- 1. Os períodos em que a célula "contava": ativa e não excluída (RN-06, DT-03).
--    Uma linha por célula, inclusive as inativas e as excluídas. Fora da API e da Auditoria.
CREATE TABLE IF NOT EXISTS private.cell_active_periods (
  cell_id uuid PRIMARY KEY REFERENCES public.cells (id) ON DELETE CASCADE,
  periods tstzmultirange NOT NULL DEFAULT '{}'
);
ALTER TABLE private.cell_active_periods ENABLE ROW LEVEL SECURITY;          -- sem políticas
REVOKE ALL ON TABLE private.cell_active_periods FROM PUBLIC, anon, authenticated, service_role;

-- 2. O servidor registra cada mudança, com o relógio dele (DA-2). Ninguém informa o momento.
CREATE OR REPLACE FUNCTION public.track_cell_active_period()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  _was boolean := TG_OP = 'UPDATE' AND OLD.is_active AND OLD.deleted_at IS NULL;
  _is  boolean := NEW.is_active AND NEW.deleted_at IS NULL;
  _from_now tstzmultirange := tstzmultirange(tstzrange(now(), NULL));    -- [agora, ∞)
BEGIN
  IF TG_OP = 'UPDATE' AND _is = _was THEN
    RETURN NULL;                                     -- a célula continua contando, ou não
  END IF;
  INSERT INTO private.cell_active_periods AS p (cell_id, periods)
  VALUES (NEW.id, CASE WHEN _is THEN _from_now ELSE '{}' END)
  ON CONFLICT (cell_id) DO UPDATE
     SET periods = CASE WHEN _is THEN p.periods + _from_now   -- abre: cadastro, reativação, restauração
                        ELSE p.periods - _from_now END;        -- fecha: inativação, exclusão
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.track_cell_active_period() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_cell_active_period ON public.cells;
CREATE TRIGGER trg_cell_active_period
  AFTER INSERT OR UPDATE OF is_active, deleted_at ON public.cells
  FOR EACH ROW EXECUTE FUNCTION public.track_cell_active_period();
```
- **Por que multirange:** a pergunta da RN-06 é "a célula contava neste instante?", e `periods @> instante` responde numa operação. Somar e subtrair juntam os períodos encostados sozinhos: inativar e reativar na mesma transação não deixa buraco, e a tabela tem uma linha por célula, lida pela chave.
- **Por que *definer*:** a tabela fica em `private`, sem privilégio para os papéis da API. O trigger dispara para qualquer papel, inclusive `authenticated`, sem EXECUTE (como os do E2.01).
- **O que nunca entra:** `created_at` ou qualquer valor da linha. Uma célula cadastrada pela API com `created_at` no passado começa a contar no momento do cadastro (critério da RN-06). Não existe coluna de "reativada em".
- **Auditoria (RN-04 do E2.05):** o trigger não altera `cells`, então não gera evento, não muda `updated_at` e não dispara outros triggers. A tabela não tem trigger de Auditoria.
- **Ordem:** é `AFTER`, independente dos outros triggers `AFTER` de `cells` (Auditoria e totais). Não lê nem escreve o que eles leem.
- **Na carga (`replica`):** o trigger não dispara. O *backfill* abaixo cria as linhas depois.

```sql
-- 3. Ponto de partida (RN-06, RN-10; DT-04, DA-4). Só cria as linhas que faltam: roda de novo sem mudar nada.
CREATE OR REPLACE FUNCTION private.backfill_cell_active_periods()
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  WITH ins AS (
    INSERT INTO private.cell_active_periods (cell_id, periods)
    SELECT c.id,
           CASE
             WHEN NOT c.is_active THEN '{}'::tstzmultirange                    -- inativa: nenhuma semana anterior conta
             WHEN c.deleted_at IS NULL
               THEN tstzmultirange(tstzrange(c.created_at, NULL))              -- ativa: desde o cadastro; sem data, desde sempre
             ELSE tstzmultirange(tstzrange(c.created_at,                       -- excluída quando ativa: até a exclusão (DA-4)
                                           greatest(c.created_at, c.deleted_at)))
           END
      FROM public.cells c
     WHERE NOT EXISTS (SELECT 1 FROM private.cell_active_periods p WHERE p.cell_id = c.id)
    ON CONFLICT (cell_id) DO NOTHING
    RETURNING 1)
  SELECT count(*)::integer FROM ins
$$;

-- 4. Invariante (DA-5): toda célula tem linha, e só a que conta agora tem o período aberto.
CREATE OR REPLACE FUNCTION private.cell_active_period_problems()
RETURNS TABLE (problem text, cell_id uuid) LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT CASE WHEN p.cell_id IS NULL THEN 'missing_row'
              WHEN c.is_active AND c.deleted_at IS NULL THEN 'not_open'
              ELSE 'open_but_not_counting' END,
         c.id
    FROM public.cells c
    LEFT JOIN private.cell_active_periods p ON p.cell_id = c.id
   WHERE p.cell_id IS NULL
      OR (c.is_active AND c.deleted_at IS NULL) IS DISTINCT FROM upper_inf(p.periods)
$$;
REVOKE ALL ON FUNCTION private.backfill_cell_active_periods() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.cell_active_period_problems() FROM PUBLIC;

-- 5. Depois do trigger: o CREATE TRIGGER trava as gravações em cells até o fim da migration,
--    então nenhuma célula gravada durante a publicação fica sem linha.
DO $$
DECLARE _ids uuid[];
BEGIN
  PERFORM private.backfill_cell_active_periods();
  SELECT array_agg(x.cell_id ORDER BY x.cell_id) INTO _ids FROM private.cell_active_period_problems() x;
  IF _ids IS NOT NULL THEN
    RAISE EXCEPTION 'E2.09: histórico de períodos ativos inconsistente nas células %', _ids;
  END IF;
END $$;
```
- **`created_at` nulo** (célula do legado com "data não registrada", RN-10 d do E2.05): o período começa "desde sempre", e todas as semanas contam (RN-06, RN-10).
- **Excluída antes do cadastro** (dado estranho): `greatest` deixa o período vazio, e nenhuma semana conta. A conferência lista esses casos.
- **Na carga do legado (E4.06):** os passos 1 a 5 da 5.5 rodam em `replica`; o passo 6 (*backfill*) chama `private.backfill_cell_active_periods()` depois de carregar `cells`, e a 5.6 exige `private.cell_active_period_problems()` vazia. As células do legado migram ativas (E2.08), então contam desde o `created_at` do legado; as excluídas no legado contam até o `deleted_at`.

#### A regra (migration 2)
```sql
-- 0. Pré-requisitos: migration 1; E2.01 PR 1 (índice da semana); E1.08 (week_start, weekday_index).
DO $$ BEGIN
  IF to_regclass('private.cell_active_periods') IS NULL
     OR to_regclass('public.cell_reports_cell_week_key') IS NULL
     OR to_regprocedure('public.weekday_index(text)') IS NULL THEN
    RAISE EXCEPTION 'E2.09: falta a migration 1 deste passo ou o PR 1 do E2.01.';
  END IF;
END $$;

-- 1. O horário de Brasília num lugar só (DT-08). sp_now() e sp_today() passam a chamar
--    sp_local(now()), com o mesmo resultado; o dashboard_summary também.
CREATE OR REPLACE FUNCTION public.sp_local(_at timestamptz) RETURNS timestamp
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS
$$ SELECT _at AT TIME ZONE 'America/Sao_Paulo' $$;
CREATE OR REPLACE FUNCTION public.sp_instant(_local timestamp) RETURNS timestamptz
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS
$$ SELECT _local AT TIME ZONE 'America/Sao_Paulo' $$;

-- 2. Os códigos da situação da semana (RN-04, RN-07; DT-05), na ordem da RN-04.
DO $$ BEGIN
  CREATE TYPE public.cell_report_status AS ENUM
    ('sent_held', 'sent_not_held', 'not_yet', 'pending', 'next_week', 'no_meeting_day');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Prazo (RN-02, RN-07), em hora de Brasília: horário + 1 hora; sem horário, 00:00 do dia
--    seguinte. Em timestamp, 23:30 vira 00:30 do dia seguinte, e sábado vira domingo.
CREATE OR REPLACE FUNCTION private.report_deadline(_week_start date, _weekday integer, _meeting_time time)
RETURNS timestamp LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
  SELECT CASE WHEN _meeting_time IS NULL
              THEN (_week_start + _weekday + 1)::timestamp
              ELSE (_week_start + _weekday) + _meeting_time + interval '1 hour' END
$$;

-- 4. A semana conta (RN-06; DA-1, DA-3): a célula contava no prazo, ou no fim da semana
--    quando o prazo cai na semana seguinte. Sem linha no histórico, nunca (DA-5).
CREATE OR REPLACE FUNCTION private.report_week_counts(
  _week_start date, _weekday integer, _meeting_time time, _periods tstzmultirange)
RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
  SELECT coalesce(_periods, '{}'::tstzmultirange)
         @> public.sp_instant(least(private.report_deadline(_week_start, _weekday, _meeting_time),
                                    (_week_start + 7)::timestamp))
$$;

-- 5. A regra (RN-01, RN-04, RN-05, RN-07). Pura: só recebe valores, para os testes por tabela.
CREATE OR REPLACE FUNCTION private.report_situation_rule(
  _local_at       timestamp,          -- o momento de referência, em Brasília
  _is_active      boolean,
  _weekday        integer,            -- weekday_index(meeting_day); nulo = dia inválido
  _meeting_time   time,
  _report_weeks   date[],             -- domingos das semanas com relatório não excluído (a de referência e as 4 anteriores)
  _held_this_week boolean,            -- was_held do relatório da semana de referência
  _periods        tstzmultirange,     -- private.cell_active_periods; nulo = nunca contou (DA-5)
  OUT report_status public.cell_report_status,
  OUT report_missing_weeks smallint)
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
DECLARE
  _ws date := public.week_start(_local_at::date);
  _k  integer;
BEGIN
  IF NOT coalesce(_is_active, false) THEN RETURN; END IF;                          -- RN-01: sem situação
  IF _weekday IS NULL THEN                                                         -- RN-07
    report_status := 'no_meeting_day'::public.cell_report_status;
    RETURN;
  END IF;
  report_missing_weeks := 0;
  IF _ws = ANY (_report_weeks) THEN                                                -- RN-04 (a); RN-05: zero
    report_status := CASE WHEN _held_this_week THEN 'sent_held' ELSE 'sent_not_held' END::public.cell_report_status;
    RETURN;
  END IF;
  report_status := CASE
    WHEN _local_at < private.report_deadline(_ws, _weekday, _meeting_time) THEN 'not_yet'     -- (b)
    WHEN private.report_week_counts(_ws, _weekday, _meeting_time, _periods) THEN 'pending'   -- (c)
    ELSE 'next_week' END::public.cell_report_status;                                          -- (d)
  FOR _k IN 1..4 LOOP                                                              -- RN-05: até "4 ou mais"
    EXIT WHEN (_ws - 7 * _k) = ANY (_report_weeks)
           OR NOT private.report_week_counts(_ws - 7 * _k, _weekday, _meeting_time, _periods);
    report_missing_weeks := _k;
  END LOOP;
END $$;

-- 6. Uma célula num momento (RN-02, RN-03, RN-06): junta os dados e aplica a regra.
--    Definer: conta todos os relatórios não excluídos, visíveis ou não (RN-03), e lê o histórico.
--    Só é alcançada pela cells_view e por cells_report_situation (DT-07).
CREATE OR REPLACE FUNCTION private.cell_report_situation(
  _cell_id uuid, _is_active boolean, _meeting_day text, _meeting_time time, _at timestamptz)
RETURNS TABLE (report_status public.cell_report_status, report_missing_weeks smallint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  _local   timestamp := public.sp_local(coalesce(_at, now()));
  _ws      date := public.week_start(_local::date);
  _weeks   date[] := '{}';
  _held    boolean;
  _periods tstzmultirange;
BEGIN
  IF coalesce(_is_active, false) THEN                       -- a inativa não tem situação: nada a ler
    -- No máximo um relatório por semana (cell_reports_cell_week_key): até 5 entradas do índice.
    SELECT coalesce(array_agg(public.week_start(r.date)), '{}'),
           bool_or(r.was_held) FILTER (WHERE public.week_start(r.date) = _ws)
      INTO _weeks, _held
      FROM public.cell_reports r
     WHERE r.cell_id = _cell_id
       AND r.deleted_at IS NULL
       AND public.week_start(r.date) BETWEEN _ws - 28 AND _ws;   -- semanas posteriores não contam (RN-02)
    SELECT p.periods INTO _periods FROM private.cell_active_periods p WHERE p.cell_id = _cell_id;
  END IF;
  RETURN QUERY
    SELECT s.report_status, s.report_missing_weeks
      FROM private.report_situation_rule(_local, _is_active, public.weekday_index(_meeting_day),
                                         _meeting_time, _weeks, _held, _periods) s;
END $$;
```
- **A expressão `public.week_start(r.date)`** é a mesma do índice único da semana, então a leitura é uma varredura de até 5 entradas. Não troque por um intervalo de `date` sem conferir o plano.
- **A regra pura** não lê tabela nenhuma. É ela que o pgTAP testa por tabela, com momentos fixos e as três sessões de fuso (tarefa 4).
- **Os nomes das colunas de `RETURNS TABLE`** viram variáveis em plpgsql; toda coluna é qualificada (a mesma armadilha do `dashboard_summary`).

#### A leitura (migration 2)
**`cells_view`:** recriada a partir da definição vigente no momento da implementação (E1.08, E2.01 e, se já publicados, E2.02, E2.05, E2.06 e E2.08), com as mesmas colunas na mesma ordem, mais duas no fim e uma junção:
```sql
CREATE OR REPLACE VIEW public.cells_view
WITH (security_barrier = true, security_invoker = false) AS
SELECT
  -- … todas as colunas vigentes, na mesma ordem …
  rs.report_status,                         -- RN-04, RN-07; nulo na célula inativa
  rs.report_missing_weeks                   -- RN-05: 0 a 4 ("4 ou mais"); nulo sem contagem (DA-6)
FROM public.cells c
-- … as junções vigentes …
LEFT JOIN LATERAL (
  -- Um agregado sem GROUP BY devolve sempre uma linha: é o que deixa o planejador remover
  -- esta junção quando nenhuma das duas colunas é pedida (DT-06). "Agora" = now(), o início
  -- da transação: o mesmo instante para a página e para o total (AQ-2).
  SELECT max(s.report_status)        AS report_status,
         max(s.report_missing_weeks) AS report_missing_weeks
    FROM private.cell_report_situation(c.id, c.is_active, c.meeting_day, c.meeting_time, now()) s
) rs ON true
WHERE …;   -- o WHERE vigente, sem mudança
```
- Continua *security definer*, com `security_barrier`, dona `postgres` e só SELECT para `authenticated`.
- Sai o comentário "E2.09: report_status entra no fim da lista". `last_report_date` fica, porque é contrato do E1.08, mas não entra no cálculo.
- Quem vê a célula vê a situação (RN-09): as colunas herdam o `WHERE` da view.

**`cells_report_situation(_at)`:** a situação de todas as células visíveis num momento qualquer.
```sql
CREATE OR REPLACE FUNCTION public.cells_report_situation(_at timestamptz DEFAULT now())
RETURNS TABLE (cell_id uuid, report_status public.cell_report_status, report_missing_weeks smallint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  -- Definer só para alcançar a função de private. O escopo é o da cells_view, pelo auth.uid()
  -- de quem chama. Sem as colunas novas da view, a junção dela não roda: uma chamada por célula.
  SELECT cv.id, s.report_status, s.report_missing_weeks
    FROM public.cells_view cv
    CROSS JOIN LATERAL private.cell_report_situation(cv.id, cv.is_active, cv.meeting_day,
                                                     cv.meeting_time, coalesce(_at, now())) s
$$;
```

**`dashboard_summary`:** mesma assinatura, mesmas colunas. Mudam o subquery `pend` e o "agora":
```sql
-- _local := public.sp_local(coalesce(_at, now()));   -- antes: … AT TIME ZONE 'America/Sao_Paulo'
-- cells_pending (RN-08): as células visíveis com a situação da semana "Pendente" no momento _at.
CROSS JOIN (
  SELECT count(*) AS cells_pending
    FROM public.cells_report_situation(_at) s
   WHERE s.report_status = 'pending'
) pend
```
O comentário da função troca o "Limite conhecido" (risco 13) pela regra da RN-08: prazo de 1 hora, semanas que não contam e qualquer relatório da semana, visível ou não.

#### Privilégios
| Objeto | `anon` | `authenticated` | `service_role` | Por quê |
|---|---|---|---|---|
| `private.cell_active_periods` | — | — | — | RLS sem políticas; só as funções *definer* leem e gravam |
| `public.track_cell_active_period()` | — | — | como as funções de trigger do E2.01 | função de trigger: dispara para qualquer papel sem EXECUTE |
| `private.backfill_cell_active_periods()`, `private.cell_active_period_problems()` | — | — | — | migration, carga e reconciliação, como `postgres` |
| `private.report_deadline`, `private.report_week_counts`, `private.report_situation_rule` | — | — | — | chamadas por dentro da função *definer* |
| `private.cell_report_situation(…)` | — | EXECUTE | EXECUTE | a `cells_view` a chama com o papel de quem consulta (armadilha do `CLAUDE.md`). Não precisa de USAGE no schema |
| `public.cells_report_situation(timestamptz)` | — | EXECUTE | EXECUTE | RPC e `dashboard_summary` (*invoker*) |
| `public.sp_local`, `public.sp_instant` | — | EXECUTE | EXECUTE | como `sp_now` |
| `public.cell_report_status` (tipo) | padrão | padrão | padrão | tipos não são segredo |

Todas com `REVOKE ALL … FROM PUBLIC` antes dos `GRANT`. **Os papéis da API continuam sem USAGE em `private`**: com USAGE, o `pg_graphql` passaria a refletir o schema, e a função por célula responderia por qualquer id (risco 7).

#### Ajustes nos passos anteriores
| Objeto | Passo | Mudança | Motivo |
|---|---|---|---|
| `cells_view` | E1.08, E2.01 e os seguintes | Duas colunas no fim e a junção `LATERAL` | AQ-1 |
| `dashboard_summary` | E1.08 | `cells_pending` pela situação; o "agora" por `sp_local`; comentário novo | RN-08, risco 13 do E1.08 |
| `sp_now`, `sp_today` | E1.08 | Chamam `sp_local(now())`, com o mesmo resultado | DT-08 |
| `last_report_date` | E1.08, E2.01 | Fica, sem uso no cálculo | Contrato do E1.08 |
| pgTAP `e108_pr2_cells_reports_views` | E1.08 | A lista de colunas da `cells_view` ganha as duas | Colunas novas |
| pgTAP `e108_pr3_dashboard_rpcs` | E1.08 | (a) as células ativas da massa ganham o histórico "desde sempre" (`'{(,)}'`) logo depois do `INSERT`; (b) a linha do tempo de W avança uma hora: cada "não conta às HH:59 / conta às HH+1:00" (19:59/20:00 vira 20:59/21:00, também em UTC: 23:59/00:00); (c) "`meeting_time` nulo entra às 23:59:59" vira "não conta na quinta às 23:59:59 e conta na sexta às 00:00"; (d) a conta paralela de `pg_temp` (a fórmula antiga de `cells_pending`) vira `count(*)` de "Pendente" em `cells_report_situation(_at)`; (e) caso novo do risco 13: célula com relatório numa semana posterior conta como pendente na semana consultada | RN-02, RN-07, RN-08; ponto 7 |
| pgTAP `e201_04_cells_reports` | E2.01 | Histórico da massa e o card no sábado às 23:50 com o prazo novo | RN-08 |
| pgTAP do E2.02 ao E2.08 que listam as colunas da `cells_view` ou leem `cells_pending` | — | O mesmo ajuste, se já existirem quando este PR for feito | — |
| `e2e/dashboard.spec.ts`, `src/pages/Dashboard.test.tsx` | E1.08 | O título do card (PR 2) | RN-08 |
| `CellReportDeletionFlow.test.tsx` | E2.01 | As chaves desatualizadas passam a ser as de `refreshAfterReportWrite` (PR 2) | AQ-3 |

Nenhuma política de RLS muda.

### Desempenho
Por linha pedida, uma chamada de `private.cell_report_situation` (plpgsql *definer*, com os planos em cache na sessão): uma varredura de até 5 entradas do índice da semana e uma leitura pela chave do histórico. A célula inativa não lê nada.

| Consulta | Chamadas |
|---|---|
| Página da lista com as colunas | as linhas da página |
| Total da lista sem filtro de situação | nenhuma (a junção é removida) |
| `EXISTS` ou leitura por id sem as colunas (RPCs do E2.01, `can_submit_report`, `my_access`, seletores, `dashboard_cells_by_type`) | nenhuma |
| Filtro do E2.10 pela situação, com total | todas as células visíveis, na página e no total |
| `dashboard_summary` | todas as células visíveis, uma vez |

Metas no volume de referência do E1.08 (20 mil membros, 1.500 células, 100 mil relatórios), mediana de 5 execuções, com o `EXPLAIN ANALYZE` anexado ao PR:
- página com total, sem filtro: abaixo de 300 ms (E1.08);
- página com `report_status=eq.pending` e total: abaixo de 300 ms (o teto do E2.10 é 2 s);
- `dashboard_summary`: abaixo de 800 ms (E1.08) e no máximo 150 ms a mais que antes;
- `SELECT 1 FROM cells_view WHERE id = …` e `count(*)` sem filtro: o plano não chama `cell_report_situation`;
- gravação que muda a situação da célula: no máximo 1 ms a mais.

**Plano B**, se o filtro passar de 300 ms: (a) reescrever `private.cell_report_situation` em `LANGUAGE sql`; (b) uma variante em conjunto (uma varredura dos relatórios das 5 semanas e uma do histórico para todas as células, com junção por hash), usada só pelo filtro do E2.10, com a mesma regra pura. Os dois voltam ao `architect` antes.

### Bloqueios e concorrência
- **Leitura:** nenhuma trava. A situação é a do *snapshot* da consulta.
- **Histórico:** o trigger roda depois do `UPDATE` que já travou a linha da célula (`FOR NO KEY UPDATE`). Duas mudanças da mesma célula se enfileiram nessa trava, e a segunda vê o `OLD` gravado pela primeira. A linha do histórico é travada sempre depois da célula: não há ciclo de espera. `delete_cell` e `restore_cell` (E2.01) travam a célula com `FOR UPDATE` antes de gravar, na mesma ordem.
- **`now()` fora de ordem:** se a transação que esperou começou antes da outra, o período fica alguns milissegundos mais longo ou mais curto. O invariante (período aberto só na célula que conta agora) vale sempre, porque a última gravação decide o fim do multirange.
- **Publicação:** o `CREATE TRIGGER` pega `SHARE ROW EXCLUSIVE` em `cells` até o fim da migration 1, e o *backfill* roda depois dele. Nenhuma célula gravada durante a publicação fica sem linha.
- **Relatório × leitura:** nada a travar. O relatório confirmado aparece na consulta seguinte.
- Nenhuma trava consultiva nova. A ordem global do E2.01 não muda.

Os casos:
- **Duas edições da mesma célula ao mesmo tempo, uma inativando e outra deixando ativa** (por exemplo, Pedro e Rita com o formulário aberto): uma espera a outra, e vale a última. O histórico termina aberto se a última deixou a célula ativa, e fechado se a inativou.
- **`delete_cell` enquanto Pedro inativa a mesma célula:** a exclusão espera a inativação (ou o contrário); o período fecha na primeira, e a segunda não muda nada.
- **`restore_cell` de uma célula excluída quando inativa:** o período não abre (ela continua inativa).
- **Inativar e reativar na mesma transação:** o período não tem buraco.

### Contratos (RPC, Edge Functions, colunas novas)
**Tipo novo:** `public.cell_report_status`, com os valores na ordem da RN-04:

| Código | RN | Tela (P70) |
|---|---|---|
| `sent_held` | RN-04 (a), relatório com a célula realizada | Enviado · Célula realizada |
| `sent_not_held` | RN-04 (a), relatório "Não houve célula" | Enviado · Não houve célula |
| `not_yet` | RN-04 (b) | Ainda não ocorreu |
| `pending` | RN-04 (c) | Pendente |
| `next_week` | RN-04 (d) | Conta a partir da próxima semana |
| `no_meeting_day` | RN-07 | Sem dia da reunião (texto) |
| nulo | RN-01: célula inativa | nada no cartão; "—" na tabela |

**Colunas novas na `cells_view`,** no fim:
- `report_status public.cell_report_status`: nulo só na célula inativa.
- `report_missing_weeks smallint`: de 0 a 4, em que 4 é "4 ou mais" (RN-05); 0 no "Enviado"; nulo na célula inativa e em `no_meeting_day` (DA-6).

No `types.ts`, `report_status` vira a união `Database["public"]["Enums"]["cell_report_status"] | null`, e `report_missing_weeks`, `number | null`.

**RPC nova:** `cells_report_situation(_at timestamptz DEFAULT now()) RETURNS TABLE (cell_id uuid, report_status cell_report_status, report_missing_weeks smallint)`. Uma linha por célula visível (as inativas com nulo), no momento `_at` (RN-02). Usada pelo `dashboard_summary`, pelos testes e pelo E2.14.

**RPC alterada:** `dashboard_summary(_at)`, com a mesma assinatura; `cells_pending` segue a RN-08.

**Funções públicas novas:** `sp_local(timestamptz) RETURNS timestamp` e `sp_instant(timestamp) RETURNS timestamptz`, `IMMUTABLE`.

**Internas novas:** `private.cell_active_periods` (tabela), `public.track_cell_active_period()` (trigger `trg_cell_active_period`), `private.backfill_cell_active_periods()`, `private.cell_active_period_problems()`, `private.report_deadline`, `private.report_week_counts`, `private.report_situation_rule` e `private.cell_report_situation`.

**Edge Functions:** nenhuma.

**Leitura no front:**
- Lista: `cells_view.select(CELL_LIST_SELECT)`, que acrescenta `report_status, report_missing_weeks` às colunas de hoje. As outras leituras da view (formulário de célula, seletor do relatório) não pedem as duas colunas e não pagam o cálculo.
- Filtro do E2.10 (para lá): `sent` → `report_status=in.(sent_held,sent_not_held)`; `not_yet`, `pending` e `next_week` → o código; `missed_1` a `missed_4plus` → `report_missing_weeks=eq.1` a `eq.4`. Opções de colunas diferentes se juntam com `or=(…)`. A célula inativa nunca entra, porque a coluna é nula.

### Front
Segue o padrão dos passos anteriores: os componentes cuidam da tela, o acesso a dados fica nos hooks, e a regra de tela pura fica em `src/lib/`. O front não calcula nada: só traduz os códigos, sem `Date` e sem ler `meeting_day`, `is_active` ou `last_report_date` para decidir a situação (AQ-1, UX-12).

**PR 2, Dashboard e atualização:**
- `src/pages/Dashboard.tsx` (T4): o card de `cells_pending` passa a "Células com relatório pendente", com `TriangleAlert`. No `StatCard`, o cabeçalho com `items-start`, o título com `leading-snug` e sem `truncate`, para todos os cards.
- `src/lib/query-refresh.ts` (do E2.06; se ainda não existir, nasce aqui no mesmo formato): `refreshAfterReportWrite(queryClient)` faz, para `["cell_reports"]`, `["cells"]`, `["dashboard"]` e `["members"]`, `removeQueries({ queryKey, type: "inactive" })` e `invalidateQueries({ queryKey, refetchType: "active" })`. `["members"]` entra porque o relatório muda o vínculo celular (E2.07).
- Chamam `refreshAfterReportWrite`: `use-save-cell-report` (lançar e editar, também quando só os participantes falham), `use-cell-report-deletion` (excluir) e a restauração de relatório no `use-restore` (E2.01, PR 3). Se o PR 3 do E2.01 ainda não estiver na `main`, ele passa a chamar a função quando entrar.
- As gravações de célula já usam `refreshAfterCellWrite` (E2.06, E2.08), e a exclusão e a restauração de célula, os hooks do E2.01, que desatualizam `["cells"]` e `["dashboard"]`. Nada a mudar nelas.
- `QueryClient` (AQ-4): continua com os padrões (`refetchOnWindowFocus` e `refetchOnReconnect` ligados, `staleTime` 0) e sem `refetchInterval`.

**PR 3, lista de Células:**
- **Domínio puro, com Vitest e sem React nem Supabase:** `src/lib/cells/report-status.ts` (AQ-5):
  - `type CellReportStatus = Database["public"]["Enums"]["cell_report_status"]`;
  - `isCellReportStatus(value)`, para um código que o front ainda não conhece (UX-08);
  - `reportStatusDisplay(status, isActive)`: `{ kind: "badge", label, srLabel, tone, icon }` (P70), `{ kind: "text", label }` (sem dia da reunião), `{ kind: "inactive" }` ou `{ kind: "unknown" }`. O `icon` é uma chave (`"check"`, `"clock"`, `"alert"`, `"calendar-clock"`), e o componente escolhe o ícone do `lucide-react`;
  - `missingWeeksText(n)` (P72): nada para 0 ou nulo; "na semana passada"; "nas {N} semanas anteriores"; "nas 4 ou mais semanas anteriores" a partir de 4;
  - `REPORT_STATUS_LEGEND` (P73): os pares da legenda e o rodapé;
  - **todos** os textos da situação ficam aqui, menos o título do card, que fica com os outros títulos do Dashboard.
- `src/lib/cells/fields.ts`: `CELL_LIST_SELECT` (uma string literal só, para o supabase-js derivar o tipo) e `CellListRow`. O teste de `fields.ts` confere que `CELL_ROW_SELECT` e `CELL_SUMMARY_SELECT` não pedem as duas colunas.
- `src/hooks/use-cells-list.ts`: lê `CELL_LIST_SELECT`. O total continua com `select("id", { head: true })`.
- `src/hooks/use-min-width.ts` (E2.06): passa a receber a largura, `useMinWidth(px)`, com o valor certo já no `useState` inicial. Células usa `useMinWidth(1280)`; Membros continua com 1024 (P45). Se o E2.06 ainda não tiver criado o hook, ele nasce aqui com o parâmetro.
- **Componentes** em `src/components/cells/`:
  - `ReportStatus` (P71): o badge do P70 sobre o `StatusBadge` (com `rounded-md whitespace-normal text-left items-start`, UXD-8) e a linha do P72 com `CalendarX2`. Variante `card` (com o rótulo "Relatório:" e `flex flex-wrap`) e `table` (sem o rótulo, `flex flex-col`). O "·" com `aria-hidden` e ", " em `sr-only`. O E2.10 reaproveita no detalhe (AQ-4 de lá).
  - `ReportStatusLegend` (P73): `Collapsible` fechado, botão `ghost` com `Info` e `ChevronDown` (`h-11 md:h-9`, giro com `motion-reduce:transition-none`), `dl` com `md:grid md:grid-cols-[auto_1fr]`.
  - `CellCard` e `CellsTable`: o cartão (T1, UXD-4, `lg:grid lg:grid-cols-2 lg:gap-x-8`, sem reordenar o DOM) e a tabela (T2: Líder, G12, Endereço, Reunião, Relatório, Situação e Ações; "Reunião" com "{Dia} · {HH:mm}" e o badge do tipo). Se `Cells.tsx` já tiver sido dividido pelo E2.06 ou pelo E2.08, a mudança vai nos componentes deles; senão, a extração vem num commit próprio, sem mudar a tela, antes da mudança.
- `src/pages/Cells.tsx`: a troca em 1280 px, a legenda depois da busca (e, no E2.10, dos filtros), à vista em todos os estados menos no erro.

### Onde cada regra é imposta
| RN | Banco (constraint, RLS, trigger, RPC) | UI |
|---|---|---|
| RN-01 | A regra devolve nulo para a inativa; a `cells_view` não tem as excluídas (E2.01); calculada a cada consulta, sem coluna gravada nem caminho de escrita; nenhuma regra de lançamento lê a situação | A inativa fica sem a linha "Relatório"; nenhuma ação depende da situação (P-SIT-17) |
| RN-02 | `private.report_deadline` (+1 hora, virada de dia e de semana); `sp_local` e `sp_instant` (`America/Sao_Paulo`); "agora" = `now()` por consulta; `cells_report_situation(_at)` para outro momento, sem semanas posteriores | Nada lê o relógio do aparelho (UX-12) |
| RN-03 | A leitura conta todos os relatórios não excluídos pela semana da data, visíveis ou não (*definer*); `was_held` dá `sent_held` ou `sent_not_held` | Os dois "Enviado" com o mesmo tom (P70) |
| RN-04 | `private.report_situation_rule`, na ordem (a) a (d); enum `cell_report_status` | `reportStatusDisplay` (P70) |
| RN-05 | A regra conta de 1 a 4, para no primeiro relatório ou na primeira semana que não conta, e zera no "Enviado" | `missingWeeksText` (P72) |
| RN-06 | `private.cell_active_periods` + `trg_cell_active_period` (relógio do servidor, sem coluna na API, sem Auditoria); ponto de partida no *backfill*; `private.report_week_counts` (DA-1, DA-3) | A explicação da legenda |
| RN-07 | Dia inválido → `no_meeting_day`; sem horário, prazo às 00:00 do dia seguinte. Com o E2.08, os `CHECK`s impedem os dois | "Sem dia da reunião" em texto |
| RN-08 | `dashboard_summary.cells_pending` = "Pendente" de `cells_report_situation(_at)`, sobre a `cells_view` (escopo); paridade por construção | Título e ícone do card (T4) |
| RN-09 | As colunas herdam o escopo da `cells_view`; nenhuma permissão nova | `ReportStatus`, `ReportStatusLegend`, `refreshAfterReportWrite`, consulta nova ao voltar para a aba |
| RN-10 | *Backfill* com o `created_at` do legado (nulo = desde sempre) no passo 6 da 5.5; `private.cell_active_period_problems()` na 5.6; a reconciliação compara o card com `private.cell_report_situation` | — |

### Respostas às perguntas do UX (AQ-1 a AQ-7)
| # | Resposta |
|---|---|
| AQ-1 | **Sim.** `cells_view.report_status` (enum, com `sent_held` e `sent_not_held` para o detalhe do "Enviado", e `no_meeting_day`; nulo na inativa) e `report_missing_weeks` (0 a 4). A tela só traduz. |
| AQ-2 | **Sim.** Na mesma linha, com `now()`, que é o mesmo instante para a página e para o total. Sem carregamento à parte. |
| AQ-3 | **Sim.** `refreshAfterReportWrite` em lançar, editar, excluir e restaurar relatório (também pela lista de excluídos do E2.01): a tela aberta recarrega, e as fechadas carregam do zero. As gravações de célula já usam `refreshAfterCellWrite` e os hooks do E2.01. |
| AQ-4 | **Confirmado.** O `QueryClient` fica com os padrões e sem `refetchInterval`. O teste da RN-09 e o UX-16 não trocam o foco da janela. |
| AQ-5 | **Sim.** `src/lib/cells/report-status.ts`, com Vitest para cada código e para 0, 1, 2, 3, 4 e 7 semanas. |
| AQ-6 | **Sim.** `useMinWidth(px)` (o `use-min-width` do E2.06, com a largura como parâmetro), com o valor certo no primeiro render. Células deixa o `useIsMobile`. |
| AQ-7 | O PR 3 entra depois do front de Células do E2.02, do E2.06 (P45) e do PR 4 do E2.08 (T7, P65). Se o usuário quiser o E2.09 antes, a tarefa 9 inclui o P45 e o P65 para Células, e os PRs de lá se ajustam a este. |

### Perguntas Q-1 a Q-6
O desenho segue o padrão do Negócio: nenhuma regra nova. O custo de cada alternativa, se a resposta for "sim":

| # | Alternativa | O que muda | Custo |
|---|---|---|---|
| Q-1 | Semanas de recesso | Tabela de semanas de recesso, com RLS, permissão e uma tela de cadastro; a regra recebe essas semanas, e o enum ganha `recess` (migration própria, `ALTER TYPE … ADD VALUE`); a semana de recesso não fica pendente, e o Negócio decide se ela interrompe ou pula a contagem da RN-05; "· Recesso" no Dashboard | Médio: 3 a 4 dias, com a tela |
| Q-2 | "Não houve célula" em várias semanas seguidas | A leitura já traz o relatório de cada semana; `was_held` por semana entra na regra, e a view ganha `report_not_held_streak`; texto e opção de filtro no front | Pequeno: cerca de 1 dia |
| Q-3 | Outro prazo, igual para todas | Só `private.report_deadline`, os textos e os testes por tabela | Pequeno: meio dia |
| Q-3 | Prazo por célula | Coluna `cells.report_grace_minutes` com `CHECK`, campo no formulário (E2.08) e entrada na regra | Médio: cerca de 2 dias |
| Q-4 | Card das semanas anteriores | `dashboard_summary` ganha a contagem de `report_missing_weeks >= 2` pela mesma função; card novo e link do E2.10 | Pequeno: cerca de 1 dia |
| Q-5 | Macrocélula sem relatório semanal | A regra recebe o tipo, e o enum ganha `no_weekly_report`; fora do card | Pequeno: cerca de 1 dia. Outra periodicidade (mensal) é um desenho à parte, médio a grande |
| Q-6 | Lembrete manual pelo WhatsApp | Só front: a ação no "⋯" das células "Pendente", com o celular do líder da `members_view`, só para quem tem "Visualizar Dados Sensíveis" | Pequeno: cerca de 1 dia |
| Q-6 | Lembrete automático | Edge Function agendada, provedor de WhatsApp, registro dos envios e preferências | Grande: fora deste passo |

### Decisões técnicas
| # | Decisão | Motivo |
|---|---|---|
| DT-01 | Um cálculo só: `private.cell_report_situation` junta os dados, e `private.report_situation_rule` (pura) decide. A `cells_view` usa com `now()`; `cells_report_situation(_at)` usa em qualquer momento; o `dashboard_summary` conta os "Pendente" dela. Nada é gravado. | Pontos 1 e 6 do PO; RN-01 e RN-08 |
| DT-02 | Por semana, pelo índice único `(cell_id, week_start(date))`: no máximo 5 relatórios por célula, só até a semana de referência. | Ponto 2; risco 13 do E1.08 |
| DT-03 | Histórico em `private.cell_active_periods`, uma linha por célula com um `tstzmultirange`, mantido por um trigger `AFTER` *definer* com `now()`. Fora da API e da Auditoria. | Ponto 3; RN-06 (5 minutos inativa não mudam nada; ninguém informa o momento) |
| DT-04 | Ponto de partida idempotente (`private.backfill_cell_active_periods()`), usado pela migration e pela carga, e o invariante (`private.cell_active_period_problems()`) na migration, nos testes e na reconciliação. | RN-06, RN-10; DA-4, DA-5 |
| DT-05 | Enum `public.cell_report_status` e `report_missing_weeks smallint`. O `types.ts` dá a união ao front, e um código esquecido no mapa não compila. | AQ-1, AQ-5; sem strings mágicas |
| DT-06 | Colunas calculadas só quando pedidas: a junção `LATERAL` a um agregado de uma linha é removida pelo planejador quando nenhuma das duas é pedida (conferido no PG 17). | Ponto 5; as leituras internas da `cells_view` não pagam o cálculo |
| DT-07 | A função por célula fica em `private`, *definer*, com EXECUTE para `authenticated`: a view a chama com o papel de quem consulta, sem USAGE no schema. Quem a chama pelo nome é *definer* (só `cells_report_situation`). | A view precisa contar relatórios invisíveis (RN-03) sem expor uma função por id |
| DT-08 | O fuso de Brasília só em `sp_local` e `sp_instant` (`IMMUTABLE`); o prazo e a conferência em hora local. `sp_now`, `sp_today` e o `dashboard_summary` passam a usá-las. | Ponto 4; um lugar só para `America/Sao_Paulo` |
| DT-09 | `dashboard_summary.cells_pending` = "Pendente" de `cells_report_situation(_at)`, com a mesma assinatura. | RN-08; o card e a lista nunca divergem |
| DT-10 | Testes: a regra por tabela, com `_at` fixo e as sessões em UTC, Brasília e Asia/Tokyo; a view comparada com `cells_report_situation(now())`, que não depende da hora em que o teste roda; o card comparado com a função; o E2E compara a tela com a resposta do servidor, porque o relógio do servidor não é controlável. | Ponto 7; UX-01, UX-03, UX-12, UX-16 |
| DT-11 | Front: `src/lib/cells/report-status.ts` só traduz; `ReportStatus` e `ReportStatusLegend` em `src/components/cells/`; `useMinWidth(1280)`; `CELL_LIST_SELECT` só na lista. | AQ-5, AQ-6; SRP |
| DT-12 | `refreshAfterReportWrite`: `removeQueries` das inativas e `invalidateQueries` das ativas, para `cells`, `dashboard`, `cell_reports` e `members`, em toda gravação de relatório. | AQ-3; mesmo mecanismo do E2.06 |
| DT-13 | Três PRs: banco (compatível com o front em produção), Dashboard e atualização, e lista. | Cada PR vai ao ar sozinho ([Implantação](#implantação)) |

### Riscos (concorrência, escala, segurança)
1. **Volume.** O filtro do E2.10 calcula todas as células visíveis duas vezes (página e total). Metas e plano B em [Desempenho](#desempenho).
2. **A `cells_view` é recriada por vários passos** (E2.02, E2.05, E2.06, E2.08, E2.10 e este). Cada um parte da definição vigente e muda só o que é dele; o pgTAP confere a lista de colunas. Dois PRs que recriam a view não andam ao mesmo tempo.
3. **Carga ou script com os triggers desligados sem o *backfill*** (DA-5): a célula nunca fica pendente. O passo 6 da 5.5 roda o *backfill*, e a 5.6 exige o invariante.
4. **Massas de teste com datas passadas** precisam ajustar o histórico (leitura técnica 5), inclusive o gerador de volume do E1.08 (rodar o *backfill* com o `created_at` antigo).
5. **Janela entre o PR 1 e o PR 2.** O card antigo, "Células sem Relatório", já conta pela RN-08: cai em relação a hoje entre o horário da reunião e o prazo, e não conta as células que não contam na semana. O PR 2 é promovido logo em seguida.
6. **Mudança em relação a hoje e ao legado** (P-SIT-01, P-SIT-03). A reconciliação (5.6) lista cada diferença com o motivo (RN-10).
7. **Função *definer* com EXECUTE para `authenticated` em `private`.** Só é alcançável pela `cells_view` e por `cells_report_situation`. Se `private` entrar nos *Exposed schemas* do PostgREST, ou se um papel da API ganhar USAGE em `private` (o `pg_graphql` reflete os schemas com USAGE), ela responderia a situação de qualquer célula pelo id. O pgTAP e a conferência em produção conferem que `anon` e `authenticated` não têm USAGE em `private`, e isso vai para as armadilhas do `CLAUDE.md`. A view chamar a função sem USAGE no schema é o comportamento documentado do Postgres (USAGE só vale para achar o objeto pelo nome), mas ainda não há outra função de `private` chamada por view no projeto: o pgTAP prova isso, e, se falhar, a tarefa volta ao `architect` antes de qualquer GRANT de USAGE.
8. **`now()` fora de ordem** em mudanças simultâneas da mesma célula: erro de milissegundos no período, sem quebrar o invariante.
9. **`created_at` informado pela API antes do E2.05.** O histórico usa o relógio do servidor (critério da RN-06), mas a data de cadastro mostrada (E2.05) seria a informada, até o E2.05 protegê-la. Na publicação, o ponto de partida das células ativas usa o `created_at` gravado.
10. **Valor novo no enum** (Q-1, Q-5): uma migration própria, porque `ALTER TYPE … ADD VALUE` não pode ser usado na mesma transação, e uma mudança no front. Com o banco publicado antes, o front antigo mostra "—" (UX-08) até o promote.
11. **Advisor do Supabase:** `cells_report_situation` é *definer* com EXECUTE para `authenticated`, como as RPCs do E2.01. Esperado.
12. **Horário de verão:** o Brasil não tem desde 2019. Se voltar, a conversão segue a base de fusos do Postgres, e só o prazo da noite da troca fica deslocado.
13. **E2E sem controle do relógio do servidor:** os critérios de momento fixo são provados no pgTAP; o E2E prova que a tela mostra o que o servidor devolveu, no momento real (DT-10).

### Dependências e impactos em outros passos
| Passo | Relação |
|---|---|
| E1.08 | Os pgTAP dos PRs 2 e 3 mudam ([Ajustes](#ajustes-nos-passos-anteriores)). `cells_pending` segue a RN-08. `sp_now` e `sp_today` passam por `sp_local`. `last_report_date` fica. |
| E2.01 | **Pré-requisito: o PR 1** (em produção). `delete_cell` e `restore_cell` disparam o trigger do histórico. A exclusão e a restauração de relatório já aparecem na situação. A restauração de relatório pelo `use-restore` (PR 3) chama `refreshAfterReportWrite`. |
| E2.02 | O `WHERE` da `cells_view` é o escopo das colunas novas. Nada a fazer. O front de Células dele vem antes do PR 3. |
| E2.05 | `created_at` nulo no legado vale como "desde sempre". O histórico não gera evento nem muda a autoria. |
| E2.06 | `refreshAfterCellWrite` já cobre as gravações de célula. `use-min-width` passa a receber a largura. O front de Células dele vem antes do PR 3. |
| E2.07 | `refreshAfterReportWrite` também desatualiza `["members"]` (vínculo celular). |
| E2.08 | Com o PR 2 dele, a RN-07 não acontece. O PR 4 dele (T7, P65) vem antes do PR 3 daqui. |
| E2.10 | Filtra e lê o detalhe pelas colunas da `cells_view` (mapa da URL em [Contratos](#contratos-rpc-edge-functions-colunas-novas)); reaproveita `ReportStatus` e `report-status.ts`. |
| E2.11 | A situação não é regra de lançamento. A RPC de lançamento não muda nada aqui. |
| E2.14 | `cells_report_situation(_at)` para a navegação por semana e o gráfico; a parte "sem relatório" do gráfico é o `cells_pending`. |
| E4.06, E4.07 | `private.backfill_cell_active_periods()` depois de carregar `cells` (passo 6 da 5.5). |
| E4.09 | `private.cell_active_period_problems()` vazia; o card de pendentes de uma semana de referência comparado com o legado, célula a célula, com `private.cell_report_situation` (como `postgres`, sem escopo), e cada diferença com o motivo: prazo exato ou semana que não conta. |

**Mudanças nos documentos, no aceite** (o `product-owner` atualiza a matriz, a seção 3 e o Progresso; o `architect` atualiza o resto do `CLAUDE.md` na revisão final):
- **`CLAUDE.md`:**
  - **Matriz de paridade:** "Situação do relatório por célula" em ✅.
  - **Schema efetivo:** `cells_view.report_status` (enum `cell_report_status`) e `report_missing_weeks`; `private.cell_active_periods`.
  - **Lógica no banco:** `trg_cell_active_period`; `private.cell_report_situation` e a regra pura; `cells_report_situation(_at)`; `dashboard_summary.cells_pending` pela situação (prazo de 1 hora, semanas que contam); `sp_local` e `sp_instant`.
  - **Front:** Células mostra a situação do relatório, com a legenda, em cartões até 1279 px e tabela a partir de 1280 px; o card "Células com relatório pendente"; `refreshAfterReportWrite`.
  - **Armadilhas, novas:**
    - "Toda célula tem uma linha em `private.cell_active_periods`. Inserir células com os triggers desligados (carga, `replica`) exige `private.backfill_cell_active_periods()` depois, e `private.cell_active_period_problems()` precisa voltar vazia.";
    - "A célula inserida agora só conta para a situação do relatório a partir de agora: massas de teste com datas passadas ajustam `private.cell_active_periods` (`'{(,)}'` = desde sempre).";
    - "`cells_view.report_status` e `report_missing_weeks` custam uma chamada por linha: peça só onde a tela precisa.";
    - "Uma função de `private` chamada por uma view precisa de EXECUTE para `authenticated`, mas não de USAGE no schema. Uma função *invoker* que chama `private.*` pelo nome falha para `authenticated`: use um *wrapper definer* em `public`. Nunca dê USAGE em `private` aos papéis da API.";
    - o item do risco 13 e de `last_report_date` sai.
- **`docs/migracao.md`:**
  - **3.4:** CEL-05 em ✅, "Onde impor": `cells_view.report_status` e `report_missing_weeks` (`private.cell_report_situation`); a definição abaixo da tabela passa a ser a do E2.09 (Enviado, Ainda não ocorreu, Pendente, Conta a partir da próxima semana e as semanas anteriores).
  - **3.6:** DSH-02 com os pendentes pela CEL-05 (E2.09).
  - **5.5:** no passo 6, `private.backfill_cell_active_periods()` depois de carregar `cells`; o `CreationDate` do legado (nulo = desde sempre) é o ponto de partida.
  - **5.6:** `private.cell_active_period_problems()` vazia; a linha nova do card de pendentes, com cada diferença e o motivo (RN-10).
  - **Progresso:** a linha do E2.09 ganha o link do spec e o estado.

### Pontos de extensão
| Futuro | Onde muda |
|---|---|
| Filtro do E2.10 | `report_status=in.(…)` e `report_missing_weeks=eq.N`, com `or=(…)` entre os dois; ordenar pela situação segue a ordem do enum, ou um `CASE` no E2.10 |
| Detalhe do E2.10 | As mesmas colunas, lidas por id; `ReportStatus` e a explicação da legenda |
| Navegação por semana e gráfico (E2.14) | `cells_report_situation(_at)` com o momento da semana escolhida |
| Q-1, Q-2, Q-5 | Um valor novo no enum e uma entrada nova na regra pura |
| Q-3 | `private.report_deadline` |
| Q-4 | Uma coluna nova no `dashboard_summary`, pela mesma função |

### Implantação
| PR | Ordem | Efeito no front em produção |
|---|---|---|
| 1 (banco) | E2.01 PR 1 em produção (já está); [conferência](#conferência-em-produção-tarefa-1) sem linha `a` nem `infra`; de preferência depois do PR 2 do E2.08; nunca junto de outro PR que recrie a `cells_view`; merge → "Deploy: banco" | O card antigo passa a contar pela RN-08. A lista não muda (as colunas novas não são lidas). |
| 2 (front: Dashboard e atualização) | PR 1 em produção; merge → promote | O card com o nome e o ícone novos; as telas fechadas recarregam do zero depois das gravações de relatório. |
| 3 (front: lista de Células) | PR 1 em produção; front de Células do E2.02 e do E2.06 e PR 4 do E2.08 na `main` (AQ-7); merge → promote | A situação na lista, a legenda e a tabela a partir de 1280 px. |

- O promote já recusa rodar com migration pendente.
- **Rollback:**
  - o front volta pelo promote do commit anterior;
  - o banco volta com uma migration nova que devolve o `cells_pending` do E1.08 ao `dashboard_summary` e recria a `cells_view` sem as duas colunas (`DROP VIEW` e `CREATE`, porque `CREATE OR REPLACE` não tira colunas, com os grants). O trigger e o histórico podem ficar: não mudam nada visível e evitam perder o histórico até a nova tentativa.

### Conferência em produção (tarefa 1)

> **Resultado em 2026-11-24 (sessão principal, só leitura, com o E2.01 PR 2 em produção):** só `info` (2 células ativas, contando desde o cadastro). Nenhuma linha `a`, `auto` ou `infra`. O `private` não está nos *Exposed schemas* (conferido em 2026-11-23: `public,graphql_public`).
Só leitura. O usuário roda no SQL Editor de produção (papel `postgres`), antes do "Deploy: banco".
- A saída traz o tipo, o problema, o tratamento e a contagem de células. Só os tipos `a` e `auto` trazem os ids. Não traz nome de pessoa nem endereço.
- Lê `deleted_at` por `to_jsonb`, então funciona com ou sem as colunas do E2.01.
- Tipos:
  - `a`: para a publicação até ser corrigido (decisão do usuário);
  - `auto`: tratado pela migration, sem perda;
  - `info`: só informação. As quatro primeiras linhas mostram como cada célula entra no histórico (RN-06, DA-4);
  - `infra`: se aparecer, parar. "Pré-requisito ausente" quer dizer que o passo citado ainda não está em produção; "já existe" quer dizer publicação repetida; USAGE em `private` volta ao `architect`.

```sql
-- E2.09 · Conferência em produção, só leitura (um SELECT). Não grava nada.
WITH
base AS (
  SELECT c.id, c.is_active, c.created_at, c.meeting_day, c.meeting_time,
         (to_jsonb(c) ->> 'deleted_at')::timestamptz AS deleted_at
    FROM public.cells c
),
dias AS (
  SELECT ARRAY['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] AS lista
),
problems (tipo, problema, tratamento, id) AS (
  -- Ponto de partida do histórico (RN-06; DA-4). Só contagens.
  SELECT 'info', '1 ativa: conta desde o cadastro', 'nenhum', id
    FROM base WHERE deleted_at IS NULL AND is_active
  UNION ALL
  SELECT 'info', '2 inativa: nenhuma semana anterior conta', 'nenhum', id
    FROM base WHERE deleted_at IS NULL AND NOT is_active
  UNION ALL
  SELECT 'info', '3 excluída quando ativa: conta do cadastro até a exclusão', 'nenhum', id
    FROM base WHERE deleted_at IS NOT NULL AND is_active
  UNION ALL
  SELECT 'info', '4 excluída quando inativa: nenhuma semana conta', 'nenhum', id
    FROM base WHERE deleted_at IS NOT NULL AND NOT is_active
  -- Datas que o ponto de partida não resolve sozinho
  UNION ALL
  SELECT 'a', 'cadastro depois de agora', 'corrigir created_at antes do "Deploy: banco"', id
    FROM base WHERE created_at > now()
  UNION ALL
  SELECT 'auto', 'excluída antes do cadastro', 'fica sem período (nenhuma semana conta)', id
    FROM base WHERE deleted_at < created_at
  -- RN-07: só até o PR 2 do E2.08
  UNION ALL
  SELECT 'info', 'RN-07 ativa sem dia válido', 'fica "Sem dia da reunião" até o E2.08', b.id
    FROM base b, dias d
   WHERE b.deleted_at IS NULL AND b.is_active
     AND (b.meeting_day IS NULL OR NOT (b.meeting_day = ANY (d.lista)))
  UNION ALL
  SELECT 'info', 'RN-07 ativa sem horário', 'prazo às 00:00 do dia seguinte', id
    FROM base WHERE deleted_at IS NULL AND is_active AND meeting_time IS NULL
  UNION ALL
  SELECT 'info', 'reunião a partir das 23:00', 'prazo no dia seguinte (RN-02)', id
    FROM base WHERE deleted_at IS NULL AND is_active AND meeting_time >= time '23:00'
  -- Infraestrutura: se aparecer, parar
  UNION ALL
  SELECT 'infra', 'PostgreSQL abaixo do 14 (sem multirange)', 'parar e voltar ao architect', NULL::uuid
   WHERE current_setting('server_version_num')::int < 140000
  UNION ALL
  SELECT 'infra', 'Pré-requisito ausente: ' || p.nome, 'publicar o passo antes', NULL::uuid
    FROM (VALUES
      ('E2.01 PR 1 (cells.deleted_at)',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'cells' AND column_name = 'deleted_at')),
      ('E2.01 PR 1 (índice cell_reports_cell_week_key)',
       to_regclass('public.cell_reports_cell_week_key') IS NOT NULL),
      ('E1.08 (week_start e weekday_index)',
       to_regprocedure('public.week_start(date)') IS NOT NULL
       AND to_regprocedure('public.weekday_index(text)') IS NOT NULL),
      ('schema private', to_regnamespace('private') IS NOT NULL)) p(nome, ok)
   WHERE NOT p.ok
  UNION ALL
  SELECT 'infra', 'Objeto do E2.09 já existe: ' || o.nome, 'conferir se é uma publicação repetida', NULL::uuid
    FROM (VALUES
      ('private.cell_active_periods', to_regclass('private.cell_active_periods') IS NOT NULL),
      ('public.cell_report_status', to_regtype('public.cell_report_status') IS NOT NULL)) o(nome, existe)
   WHERE o.existe
  UNION ALL
  SELECT 'infra', 'Papel da API com USAGE no schema private: ' || r.rolname, 'parar e voltar ao architect', NULL::uuid
    FROM pg_roles r
   WHERE r.rolname IN ('anon', 'authenticated')
     AND to_regnamespace('private') IS NOT NULL
     AND has_schema_privilege(r.rolname, 'private', 'USAGE')
)
SELECT tipo, problema, tratamento, count(id) AS celulas,
       CASE WHEN tipo IN ('a', 'auto') THEN array_agg(id ORDER BY id) FILTER (WHERE id IS NOT NULL) END AS ids
  FROM problems
 GROUP BY tipo, problema, tratamento
 ORDER BY tipo, problema;
```
- Nenhuma linha `a` e nenhuma `infra`: o deploy pode seguir.
- Na stack local, a consulta rodou sem erro e mostrou só "1 ativa: conta desde o cadastro" (1.036 células). Em produção, o esperado são as células de teste, sem `a` nem `infra`.
- Além do SQL, o usuário confere no painel do Supabase (API → *Exposed schemas*) que `private` não está na lista (a mesma conferência da tarefa 1 do E2.01).

### Verificações obrigatórias (para o QA)
**pgTAP** (`supabase/tests/database/e209_*.test.sql`, autocontidos, com `ROLLBACK`). A massa é a dos critérios: Samuel, Magda, Pedro, Paula, André, Caio, Carla, Fábio (inativo), Ester, Diego e Rita, com as funções e as permissões dos critérios, e as células C1 a C10. As células cumprem as regras do E2.08 (três pessoas, dia e horário) se ele já estiver aplicado. O cadastro, a inativação e a exclusão anteriores a "agora" são montados direto no histórico (`UPDATE private.cell_active_periods`), e o momento vem de `_at`.

- **`e209_01_active_periods.test.sql`:**
  - estrutura: a tabela em `private`, com PK, FK `ON DELETE CASCADE`, RLS ligado e sem políticas, sem privilégio para `anon`, `authenticated` e `service_role`; o trigger `AFTER INSERT OR UPDATE OF is_active, deleted_at`; a função de trigger *definer*, com `search_path` fixo e sem EXECUTE para `authenticated`; `anon` e `authenticated` sem USAGE em `private`;
  - o trigger: cadastro ativo abre `[agora, ∞)`; cadastro inativo grava `'{}'`; inativar fecha em agora; reativar abre um novo; inativar e reativar na mesma transação não deixam buraco; `delete_cell` fecha; `restore_cell` reabre a ativa e não reabre a inativa; mudar outra coluna, ou gravar `is_active` com o mesmo valor, não muda nada;
  - RN-06 pela API: `authenticated` não lê nem grava `private.cell_active_periods`; uma célula cadastrada com `created_at` no passado começa a contar no momento do cadastro;
  - Auditoria: inativar gera os mesmos eventos de antes deste passo, e nenhum da tabela nova; `updated_at` da célula não muda por causa do trigger;
  - *backfill*: os quatro estados da conferência mais `created_at` nulo (montado em `replica`) e excluída antes do cadastro dão os multiranges esperados; uma segunda chamada cria 0 linhas e não muda as existentes;
  - `replica`: a célula inserida com os triggers desligados não tem linha, aparece em `cell_active_period_problems()` como `missing_row` e é corrigida pelo *backfill*; um período aberto numa célula inativa aparece como `open_but_not_counting`;
  - a migration roda de novo sem erro e sem mudar nada;
  - invariante: `cell_active_period_problems()` vazia no fim do arquivo.
- **`e209_02_rule.test.sql`** (a regra pura, por tabela, sem dados): cada linha traz o momento em Brasília, o dia, o horário, as semanas com relatório, o `was_held`, o histórico e o resultado esperado. A tabela roda três vezes: com a sessão em UTC, em `America/Sao_Paulo` e em `Asia/Tokyo`. Pelo menos:
  - RN-02: C1 na quarta às 20:59:59 e às 21:00:00 (também como 23:59:59 e 00:00:00 UTC); C9 às 20:29 e 20:30; C3 na sexta às 23:59, no sábado às 00:29 e às 00:30; C4 no sábado às 23:59:59 e no domingo às 00:00 (com 1 semana); C1 no sábado às 23:59:59 ("Pendente") e no domingo às 00:00 ("Ainda não ocorreu" com 1); C6 mudada para terça; C1 mudada para sábado às 19:00; o caso do risco 13;
  - RN-04 e RN-05: os valores da massa na quinta às 10:00 e na terça às 10:00; contagens 1, 2, 3 e "4 ou mais" (com 7 semanas sem relatório); zero com relatório nesta semana; C6 com 3 e com 2 (cadastrada na sexta); o relatório de 18/11 excluído dá 1;
  - RN-06: C10 cadastrada na quinta ("Conta a partir da próxima semana"; no domingo, "Ainda não ocorreu" com 0; na quinta seguinte, "Pendente"); cadastrada na segunda; cadastrada às 20:30, às 21:00 em ponto e às 21:01 (DA-3); C7 reativada na terça e na quarta; C1 inativada às 10:05 e reativada às 10:10; C1 inativada na quarta às 19:00 e reativada na quinta; C8 restaurada na quinta e na terça; C6 com o horário mudado; a célula de sábado às 23:30 cadastrada no domingo às 00:05 (DA-1);
  - RN-07: sem dia (`no_meeting_day`, semanas nulas); quarta sem horário às 23:59:59 e na quinta às 00:00; sábado sem horário nunca "Pendente" e, no domingo, 1 semana;
  - RN-01: inativa dá nulo nas duas; histórico nulo (DA-5) nunca dá "Pendente";
  - RN-10: histórico "desde sempre" sem relatório dá "4 ou mais"; cadastrada em 10/03/2023 com o último relatório em 21/10 dá "4 ou mais".
- **`e209_03_situation.test.sql`** (com a massa e as tabelas):
  - `cells_report_situation(_at)` para Rita na quinta, 26/11, às 10:00 (critério da RN-04) e para Pedro na terça, 24/11, às 10:00 (RN-09): os valores, e Pedro não recebe C2, C4, C5 nem C8; Caio vê C1 igual a Pedro;
  - RN-03: o relatório excluído não conta e o restaurado volta a contar; o relatório de C1 que Pedro não vê dá "Enviado · Célula realizada" e "Não houve célula", e o `cells_not_held` de Pedro não o conta;
  - RN-08: o card de Rita e de Pedro na quinta às 10:00 (3 e 2), às 21:00 (4 e 3), no sábado às 00:30 (5 e 4); a célula de segunda às 20:00 não conta às 20:59 e conta às 21:00; C10 não conta; quem não tem "Visualizar Dashboard" recebe 42501;
  - paridade: para cada persona, `SELECT id, report_status, report_missing_weeks FROM cells_view` é igual a `cells_report_situation(now())`, e `dashboard_summary(_at).cells_pending` é igual aos "Pendente" de `cells_report_situation(_at)` em vários momentos;
  - fuso: os mesmos resultados com a sessão em UTC e em Asia/Tokyo, e às 02:59:59 e 03:00 UTC de domingo;
  - DT-06: o `EXPLAIN` de `SELECT 1 FROM cells_view WHERE id = …` e de `SELECT count(*) FROM cells_view` não tem `cell_report_situation`; o de `SELECT report_status FROM cells_view` tem;
  - privilégios: `private.cell_report_situation` com EXECUTE para `authenticated` e `service_role` e sem `anon`; `cells_report_situation` e `sp_local`/`sp_instant` iguais; as funções puras e as de *backfill* sem EXECUTE para os papéis da API; o enum com os seis valores, nesta ordem; `authenticated`, sem USAGE em `private`, lê `cells_view.report_status`;
  - a `cells_view`: as colunas de antes, na mesma ordem, e as duas novas no fim;
  - `sp_now()` e `sp_today()` com o mesmo resultado de antes.

**Concorrência** (`supabase/tests/concurrency/e209_concurrency.sh`, duas conexões e `pg_sleep`, como no E2.01): inativar × reativar a mesma célula; `delete_cell` × inativar; `restore_cell` × reativar. No fim de cada cenário, `cell_active_period_problems()` vazia e período aberto só na célula ativa e não excluída.

**Volume:** as metas de [Desempenho](#desempenho), com o `EXPLAIN ANALYZE` anexado ao PR. O gerador da massa de volume roda o *backfill* com o `created_at` antigo.

**Vitest e testes de componente:**
- `report-status.ts`: cada código, nulo, inativa e desconhecido (UX-04, UX-08); 0, 1, 2, 3, 4 e 7 semanas; nenhum texto proibido; o módulo não usa `Date` (UX-12);
- `query-refresh.ts`, com um `QueryClient` de verdade: a consulta inativa some e a ativa recarrega (AQ-3);
- `ReportStatus`, `ReportStatusLegend`, `CellCard`, `CellsTable` e o `StatCard` (UX-02, UX-05, UX-06 com `matchMedia` simulado, UX-08, UX-09, UX-13, UX-14);
- UX-16: com o relógio simulado e sem foco na janela, a lista não consulta de novo; o evento de foco consulta.

**Playwright:** a tela mostra o que a resposta da `cells_view` trouxe, em 360×800 e em 1280×800 (UX-01, UX-02, UX-03 com as contas de teste); o card é igual ao número de linhas "Pendente" da mesma pessoa no mesmo momento (UX-13); UX-06, UX-07, UX-10, UX-11, UX-12 (`timezoneId: "Europe/Lisbon"`); axe nos dois temas (UX-15); *smoke* de login.

## Tarefas
_Seção do `architect`._

Três PRs no `mci-connect`. **O de banco precisa só do PR 1 do E2.01 em produção.** Os de front seguem a [Implantação](#implantação).
- Dentro do PR 1, a migration 1 vem antes da 2, e os tipos são regenerados antes do front.
- Cada desenvolvedor aciona o `code-reviewer` ao terminar a sua tarefa; esse passo não aparece na tabela.
- Na coluna RNs, os números são das regras deste spec. Na coluna UX, os dos critérios `UX-`.

| # | Responsável | Descrição | Arquivos | RNs | UX | Depende de |
|---|---|---|---|---|---|---|
| **PR 1: banco, histórico e situação** | | | | | | |
| 1 | usuário | Rodar a [conferência](#conferência-em-produção-tarefa-1) em produção (só leitura) e conferir os *Exposed schemas*. Uma linha `a` ou `infra` para a publicação. | — | 06, 10 | — | — |
| 2 | backend-developer | Migration 1: guarda; `private.cell_active_periods` (RLS sem políticas, sem privilégios); `track_cell_active_period()` e `trg_cell_active_period`; `private.backfill_cell_active_periods()` e `private.cell_active_period_problems()`; *backfill* depois do trigger e guarda do invariante (só ids); grants. | `supabase/migrations/<ts>_e209_01_active_periods.sql` | 06, 10 | — | 1 (sem `a` nem `infra`) |
| 3 | backend-developer | Migration 2: guarda; `sp_local` e `sp_instant` (e `sp_now`, `sp_today` sobre elas); enum `cell_report_status`; `private.report_deadline`, `private.report_week_counts`, `private.report_situation_rule` e `private.cell_report_situation`; `cells_view` recriada da definição vigente, com a junção e as duas colunas no fim; `public.cells_report_situation(_at)`; `dashboard_summary` com o `cells_pending` novo e o comentário; grants. Regenerar o `types.ts`. Ajustar os pgTAP existentes ([Ajustes](#ajustes-nos-passos-anteriores)): `e108_pr2`, `e108_pr3` (histórico da massa, uma hora a mais, horário nulo, a conta paralela, o caso do risco 13) e `e201_04`, e os dos passos seguintes que já existirem. Medir o volume e anexar os `EXPLAIN ANALYZE` ao PR. | `supabase/migrations/<ts>_e209_02_report_situation.sql`, `src/integrations/supabase/types.ts`, `supabase/tests/database/{e108_pr2_cells_reports_views,e108_pr3_dashboard_rpcs,e201_04_cells_reports}.test.sql` | 01 a 08 (banco) | dados de 01, 03, 12, 13 | 2 |
| 4 | qa | pgTAP novos (`e209_01`, `e209_02` por tabela, `e209_03`), script de concorrência e conferência das metas de volume ([Verificações](#verificações-obrigatórias-para-o-qa)). | `supabase/tests/database/e209_*.test.sql`, `supabase/tests/concurrency/e209_concurrency.sh` | 01 a 10 | dados de 01, 03, 13 | 2, 3 |
| **PR 2: front, Dashboard e atualização** | | | | | | |
| 5 | frontend-developer | `Dashboard.tsx` (T4): "Células com relatório pendente", `TriangleAlert`, `StatCard` com `items-start` e `leading-snug`, sem `truncate`. `src/lib/query-refresh.ts`: `refreshAfterReportWrite` (cria o arquivo se o E2.06 ainda não o criou). Chamá-la em `use-save-cell-report`, `use-cell-report-deletion` e na restauração de relatório do `use-restore` (se já estiver na `main`). Atualizar `Dashboard.test.tsx`, `CellReportDeletionFlow.test.tsx` e o título em `e2e/dashboard.spec.ts`. | `src/pages/Dashboard.tsx`, `src/lib/query-refresh.ts`, `src/hooks/{use-save-cell-report,use-cell-report-deletion,use-restore}.ts`, os testes citados | 08, 09 | 11, 13 | — (desenvolvida em paralelo com o PR 1; o merge espera o PR 1 em produção) |
| 6 | ux-designer | Revisão da UI do PR 2 (T4) em 360, 1024 e 1280 px, nos temas claro e escuro. | — | — | 13 | 5 |
| 7 | qa | Vitest do `query-refresh` com um `QueryClient` de verdade; teste de componente do card (UX-13); Playwright: o card igual ao número de células "Pendente" da `cells_view` da mesma pessoa, e a exclusão e a restauração de um relatório sem valor antigo no Dashboard (parte do UX-11). | `src/**/*.test.ts(x)`, `e2e/dashboard.spec.ts` | 08, 09 | 11, 13 | 5 |
| **PR 3: front, lista de Células** | | | | | | |
| 8 | frontend-developer | Domínio puro, com Vitest: `src/lib/cells/report-status.ts` (tipo do enum, `isCellReportStatus`, `reportStatusDisplay`, `missingWeeksText`, `REPORT_STATUS_LEGEND`, todos os textos da situação, sem `Date`); `CELL_LIST_SELECT` e `CellListRow` em `src/lib/cells/fields.ts`. | `src/lib/cells/{report-status,fields}.ts` e os `*.test.ts` deles | 01, 04, 05, 07, 09 | 04, 08, 12 | 3 (tipos) |
| 9 | frontend-developer | `use-cells-list` com `CELL_LIST_SELECT`; `useMinWidth(px)`; `ReportStatus` (P71), `ReportStatusLegend` (P73), `CellCard` e `CellsTable` (T1, T2, UXD-4 a UXD-8; extração num commit próprio, se ainda não houver); `Cells.tsx` com a troca em 1280 px e a legenda (T3). Atualizar `Cells.test.tsx`. | `src/hooks/{use-cells-list,use-min-width}.ts`, `src/components/cells/{ReportStatus,ReportStatusLegend,CellCard,CellsTable}.tsx`, `src/pages/Cells.tsx`, os testes citados | 01, 09 | 01 a 10, 12, 14 a 16 | 8; PR 1 em produção; front de Células do E2.02 e do E2.06 e PR 4 do E2.08 na `main` (AQ-7) |
| 10 | ux-designer | Revisão da UI do PR 3 (T1 a T3, P70 a P74) em 320, 360, 768, 1024, 1280 e 1440 px, nos temas claro e escuro, com zoom de 200% e fonte grande. | — | — | 01 a 09, 14, 15 | 9 |
| 11 | qa | Testes de componente (UX-02, 05, 06 com `matchMedia` simulado, 08, 09, 14, 16); Playwright (UX-01, 02, 03, 06, 07, 10, 11, 12 com `timezoneId`, 13; *smoke* de login); axe nos dois temas (UX-15). | `src/**/*.test.tsx`, `e2e/celulas-situacao-relatorio.spec.ts` | 01, 03, 04, 05, 08, 09 | 01 a 16 | 9 |
| **Fechamento** | | | | | | |
| 12 | architect | Revisão final dos três PRs; atualizar o `CLAUDE.md` (estado atual e armadilhas, ver [Dependências](#dependências-e-impactos-em-outros-passos)). O aceite, a matriz e o `docs/migracao.md` são do `product-owner`. | `CLAUDE.md` | — | — | 4, 6, 7, 10, 11 |

**Ordem de execução:**
- Tarefa 1 primeiro.
- PR 1: 2 → 3 → 4.
- PR 2: a 5 pode começar a qualquer momento (não depende de tipo novo); o merge espera o PR 1 em produção. 5 → (6 ∥ 7).
- PR 3: a 8 começa depois da regeneração dos tipos da tarefa 3; a 9, depois da 8 e dos pré-requisitos da AQ-7. 9 → (10 ∥ 11).
- 12 no fim.

**Critérios de pronto**
1. **Tarefas 2 e 3:**
   - as migrations rodam num banco zerado depois das existentes e rodam de novo sem erro;
   - nenhuma função nova tem EXECUTE para `anon`; os papéis da API continuam sem USAGE em `private`;
   - o `types.ts` está regenerado;
   - a suíte inteira de pgTAP (a dos passos anteriores, ajustada, e a deste) passa;
   - `private.cell_active_period_problems()` volta vazia;
   - a `cells_view` tem as colunas de antes, na mesma ordem, mais as duas no fim;
   - as metas de [Desempenho](#desempenho) são cumpridas, com os `EXPLAIN ANALYZE` no PR.
2. **Tarefa 4:** todos os critérios das RN-01 a RN-08 e da RN-10 provados com `_at` fixo, nas três sessões de fuso; a paridade da view e do card para cada persona; os três cenários de concorrência terminam com o invariante.
3. **Tarefas 5, 8 e 9:**
   - `npm run lint`, `npm test` e `npm run build` verdes;
   - sem `any` e sem asserção de tipo (`as Tipo`) nos arquivos novos (`as const` é permitido);
   - nenhuma regra de domínio dentro de componente, e nenhum cálculo de situação no front (nada de `Date`, `meeting_day`, `is_active` ou `last_report_date` para decidir a situação);
   - nenhum texto da situação fora de `src/lib/cells/report-status.ts`;
   - nenhuma leitura da `cells_view` fora da lista pedindo `report_status` ou `report_missing_weeks`.
4. **Tarefas 6 e 10:** o `ux-designer` dá o veredito e lista os ajustes, que voltam ao `frontend-developer` antes de o QA fechar o PR.

## Testes
_Seção do `qa`._

| RN | Testes | Resultado |
|---|---|---|
