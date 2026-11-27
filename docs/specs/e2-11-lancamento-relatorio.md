# E2.11: Lançamento de relatório numa RPC atômica

> Status: Negócio, Experiência (UX), Solução técnica e Tarefas prontos. **PR 1 (banco: retrato e visibilidade) em produção em 2026-11-27**; **PR 2 (banco: lançamento e edição numa chamada) implementado em 2026-11-27, em revisão (mci-connect#57)**; **PRs 3 e 4 (front) implementados num PR só em 2026-11-27, em revisão (mci-connect#58, base na branch do #57)**. Vão ao ar juntos: merge do #57 e do #58 → "Deploy: banco" → promote do #58 ([Implantação](#implantação)). Falta a revisão de UI (tarefa 13) e o QA independente (tarefas 10 e 14), pela sessão principal.
> **PRs 3 e 4 (2026-11-27, mci-connect#58, branch `feat/E2.11-pr3-4-front`):** tarefas 8, 11 e 12 (o QA das 10 e 14 feito pelo `architect`, sem a ferramenta `Agent`). `CellReportDialog` (lançamento com célula fixa ou livre e edição) em Relatórios, Células e Dashboard; lista e "Ver relatório" pelo retrato; regras puras em `src/lib/cell-reports/`. Divergências em [Divergências dos PRs 3 e 4](#divergências-dos-prs-3-e-4-implementado).
> **Ajustes no PR 2 (2026-11-27, commit `7707a7c` na branch do #57):** data e horário só na forma ISO em `private.report_input`; `TRUNCATE` revogado nas duas tabelas ([Divergências do PR 2](#divergências-do-pr-2-implementado), itens 11 e 12).
> **PR 2 (2026-11-27, mci-connect#57, branch `feat/E2.11-pr2-lancamento`):** tarefas 4 a 7. `submit_cell_report`, `save_cell_report` (definer), `cell_report_launch_check`, `cell_report_edit_context`, regras puras e mensagens em `private.report_*`, escrita direta fechada (privilégios, políticas, guarda `a0_guard_cell_report_write` e marca `mci.cell_report_write`), `ac_keep_snapshot_participants`, oferta sem padrão e com `CHECK`; saíram os triggers de semana, os de escrita direta e a `set_cell_report_participants`. Conferência de produção sem linha `a` do PR 2. Divergências em [Divergências do PR 2](#divergências-do-pr-2-implementado).
> **PR 1 em produção (2026-11-27):** mci-connect#54, squash `3506a5d`, "Deploy: banco" run 45917973610 (migration `20261129100000`). Retrato `snapshot_*` gravado em `cell_reports` (os 5 relatórios de produção preenchidos), visibilidade pelo retrato (views, view de excluídos, políticas e `viewer_sees_report_people`), troca de célula recusada (`report_cell_immutable`) e `cell_in_viewer_ministry` removida. `code-reviewer` APROVADO; pgTAP 4.951 testes. Divergências do desenho em [Divergências do PR 1](#divergências-do-pr-1-implementado).
> - Negócio escrito em 2026-11-24 pelo `product-owner`, sem regras "a confirmar".
> - Experiência (UX) escrita no mesmo dia pelo `ux-designer`. As pendências PO-UX-1 a PO-UX-11 foram resolvidas pelo PO no mesmo dia e viraram os padrões P-REL-21 a P-REL-31.
> - Solução técnica e Tarefas escritas no mesmo dia pelo `architect`, com as respostas às AQ-1 a AQ-11. Nenhuma RN voltou ao PO.
> - Ficam para o usuário revisar no PR os padrões P-REL-01 a P-REL-31, as perguntas Q-1 a Q-8 e os pontos "definidos pelo architect" (DA-1 a DA-12). Nenhum bloqueia: cada um já tem um padrão adotado.
> - A implementação começa depois do E2.01 inteiro, do PR 1 do E2.02, do banco do E2.05, do PR 1 do E2.06, dos PRs 1 e 2 do E2.08 e do banco do E2.09 em produção ([Implantação](#implantação)). Falta só Testes.
> Slug: `e2-11-lancamento-relatorio` · Paridade com o legado: sim (REL-01 a REL-12 e REL-15, com a D3). Regras novas:
> - o que pode mudar na edição (célula fixa, data só dentro da semana do relatório);
> - "Não houve célula" sem participantes;
> - oferta obrigatória sem valor sugerido;
> - aviso antes de preencher;
> - envio que pode ser repetido sem gravar outro relatório;
> - o retrato também na visibilidade de quem está registrado nele.

## Negócio
_Seção do `product-owner`. Escrita em 2026-11-24 e atualizada no mesmo dia com as decisões do PO sobre as pendências PO-UX-1 a PO-UX-11 da seção Experiência (UX) (P-REL-21 a P-REL-31). Fontes:_
- _no [`docs/migracao.md`](../migracao.md): o passo E2.11 em Progresso, a seção 3.5 (REL), as decisões D1 e D3, a DEL-03 (3.8) e as seções 5.3 a 5.6;_
- _no `CLAUDE.md` da raiz: as regras de lançamento do legado, os triggers de relatório do novo, as Armadilhas, os Problemas conhecidos (`calculateCellDate` e a gravação que não é atômica) e a matriz de paridade;_
- _no legado: `App/Services/ReportApp.cs`, `App/Services/ReportService.cs`, `Domain/Validators/ReportDTOValidator.cs`, `Domain/Model/Report.cs`, `Domain/Mappings/DomainToDTOMappingProfile.cs`, `Domain/Extensions/DateTimeExtensions.cs`, o filtro de relatórios de `Domain/Extensions/QueryingExtensions.cs`, `API/Controllers/ReportController.cs`, `App/Services/ExportService.cs`, `Infra/Repositories/MemberRepository.cs` e as telas `UI/pages/Report/details.js`, `UI/pages/Report/index.js`, `UI/components/CellPicker` e `UI/components/MemberPicker`;_
- _no `mci-connect` (`origin/main`, `4595daa`): `src/components/CellReportForm.tsx`, `src/lib/cell-reports/report-form.ts`, `src/hooks/use-save-cell-report.ts`, a `cell_reports_view` (`20261123233300_e201_03_read.sql`) e os triggers de relatório (`20260426195721_…sql`, `20260426200142_…sql` e `20261123233400_e201_04_write.sql`);_
- _nos specs:_
  - _[E2.01](e2-01-exclusao-logica.md): RN-06, RN-07, RN-09, RN-11 a RN-13, RN-17, RN-20, DT-15 e Textos de tela;_
  - _[E2.02](e2-02-perfis-escopo.md): RN-02, RN-04, RN-09, RN-13, RN-14, P-PER-03, DA-5, DA-12 e Impactos;_
  - _[E2.05](e2-05-auditoria-autor.md): RN-04, RN-07, RN-13, RN-14, P-AUD-18 e DT-09;_
  - _[E2.06](e2-06-hierarquia-totais.md): RN-11 (G12);_
  - _[E2.07](e2-07-filtros-membros.md): RN-10 e P-FIL-08;_
  - _[E2.08](e2-08-cadastro-celulas.md): RN-06, RN-08, RN-11, P-CEL-10, P-CEL-17, P-CEL-18, P62 da UX e Impactos;_
  - _[E2.09](e2-09-situacao-relatorio.md): RN-01 a RN-03, P-SIT-17 e Impactos;_
  - _o rascunho do [E2.10](e2-10-listagem-celulas.md): Termos, RN-17, RN-18, P-LCE-31 e Impactos. Ainda não tem commit e foi só lido._

Os caminhos do legado são relativos a `g12app-net/`, com as abreviações do E2.01:
- `App/` = `G12App.Application/`;
- `Domain/` = `G12App.Domain/`;
- `Infra/` = `G12App.Infrastructure.Data/`;
- `API/` = `G12App.API/`;
- `UI/` = `G12App.API/ClientApp/src/`.

### Contexto e objetivo
No legado:
- **Quem lança:** qualquer usuário autenticado, para uma célula do escopo dele. Editar e excluir são só do administrador e do administrador geral. A tela não tem edição de relatório: ela existe só na API.
- **Formulário ("Registrar relatório"):**
  - a célula é escolhida pelo nome do líder. Depois de escolhida, a tela mostra, só para leitura, líder, timóteo, anfitrião, "Líder G12", tipo ("Modalidade") e endereço;
  - a data vem sugerida com o dia da reunião na semana atual, e o horário com o da célula.
- **Regras, nesta ordem:**
  1. a data não pode ser futura;
  2. a data precisa ser da semana atual (domingo a sábado, horário de Brasília);
  3. um relatório por célula por semana: "O relatório para esta semana já foi enviado (#id).";
  4. o relatório não pode ser de antes do dia e do horário da célula naquela semana.
- **Célula realizada:**
  - data, horário e tema são obrigatórios;
  - a oferta começa com R$ 0,00;
  - os participantes são escolhidos entre os membros do escopo, inclusive os inativos;
  - os visitantes são digitados um por campo;
  - as observações são opcionais.
- **"Não houve célula":**
  - a justificativa (observações) é obrigatória;
  - data, horário, tema, oferta e participantes ficam desabilitados;
  - a data gravada é o dia e o horário previstos da célula na semana. Como a data não pode ser futura, só dá para enviar depois do horário previsto.
- **Na gravação:**
  - líder, timóteo e anfitrião entram como participantes, sem duplicar, inclusive em "Não houve célula";
  - o relatório guarda o líder, o timóteo e o anfitrião que a tela copiou da célula. O tipo da célula existe no modelo, mas a tela não o envia;
  - relatório e participantes vão numa transação só.
- **Depois do envio:**
  - o relatório entra no escopo pelo líder, pelo timóteo e pelo anfitrião guardados nele;
  - a lista mostra esse líder e o G12 atual dele.

Hoje o novo (conferido na `origin/main`, `4595daa`, em 2026-11-24):
- **Formulário (`CellReportForm`):**
  - O seletor oferece as células ativas e visíveis, buscadas por líder, rua ou bairro. Depois de escolhida, a célula aparece só pelo rótulo. Não há o bloco com os dados da célula (REL-15).
  - A data é um seletor nativo, limitado à semana pelo relógio do aparelho.
  - A data sugerida (`calculateCellDate`) cai na semana passada quando a reunião desta semana ainda não aconteceu, e o banco recusa essa data. Antes de escolher a célula, o horário vem com 19:00.
  - "Não houve célula" mostra só "Motivo do Cancelamento", mas continua pedindo a data e o horário.
  - O tema é opcional, e a oferta começa em 0.
  - Os visitantes são digitados num campo só, separados por vírgula.
  - O seletor de participantes só oferece membros ativos.
  - Há rótulos fora do vocabulário:
    - "Detalhes do Encontro": Encontro é o retiro da Consolidação;
    - "Tema da Palavra", "Participantes (Membros)", "Observações Gerais" e "Motivo do Cancelamento".
- **Gravação:**
  - São duas chamadas: o relatório e depois os participantes (`set_cell_report_participants`, E2.01).
  - Se a segunda falhar, o relatório fica gravado sem os participantes, e o formulário pede para salvar de novo.
- **Banco:**
  - O trigger de semana atual também vale na edição. Ele dispara mesmo quando a data não muda, então editar qualquer relatório de semana anterior é recusado.
  - Aceita data futura dentro da semana e ignora o dia e o horário da célula.
  - Um relatório por semana é garantido pelo trigger e pelo índice único (E2.01). A mensagem traz as datas da semana, mas não diz qual relatório já existe.
  - Não inclui líder, timóteo e anfitrião como participantes e não guarda o retrato.
  - Não exige tema nem motivo, e a oferta não é conferida no banco.
  - "Não houve célula" grava a oferta como 0.
- **Quem lança hoje:**
  - quem tem "Editar Célula";
  - quem tem "Enviar Relatório de Qualquer Célula Visível", sem conferir se a célula está visível;
  - líder ou timóteo com "Enviar Relatório das Próprias Células".

  O E2.02 (desenho pronto) passa para a D3.

Objetivo do passo:
- lançar e editar o relatório numa operação só, tudo ou nada, com o retrato da célula e os participantes automáticos;
- impor no banco as regras de data do legado só no lançamento, e liberar a edição de relatórios antigos;
- definir o que o legado não define: o que muda na edição, os participantes em "Não houve célula", a oferta e os visitantes;
- corrigir a data sugerida e avisar antes de preencher quando o relatório não pode ser enviado;
- migrar os relatórios do legado com o retrato.

### Termos
- **Relatório:** o relatório de célula de uma semana.
- **Lançar** ou **enviar:** criar o relatório. A autoria é "Enviado por" (P-AUD-18 do E2.05).
- **Editar:** alterar um relatório já enviado.
- **Semana:** de domingo, 00:00, a sábado, 23:59:59, no horário de Brasília (`America/Sao_Paulo`).
  - **Semana atual:** a do momento do envio.
  - **Semana do relatório:** a da data do relatório.
- **Agora** e **hoje:** o momento e a data em Brasília, no servidor, quando o envio chega. O relógio e o fuso do aparelho não contam.
- **Reunião da semana:** o dia e o horário atuais da célula (RN-08 do E2.08), na semana atual. Exemplo: C1 se reúne às quartas, 20:00; na semana de 22/11 a 28/11/2026, a reunião da semana é quarta, 25/11/2026, às 20:00.
- **Data e horário do relatório:** quando a reunião aconteceu, na hora local de Brasília, em horas e minutos, sem segundos.
- **Célula realizada** e **"Não houve célula":** as duas situações de um relatório.
- **Pessoas da célula:** o líder, o timóteo e o anfitrião (E2.02).
- **Retrato:** o líder, o timóteo, o anfitrião e o tipo da célula, guardados no relatório no lançamento (REL-09). **Pessoas registradas** são as do retrato.
- **Participantes:** os membros que estiveram na reunião. São os escolhidos por quem lança mais os automáticos.
- **Participantes automáticos:** as pessoas da célula no momento do lançamento.
- **Visitantes:** os nomes de quem esteve na reunião e não é membro.
- **Oferta:** a contribuição voluntária feita na célula, em reais. Não é dízimo.
- **Quem edita relatórios:** quem tem "Editar Relatórios de Células", no escopo (RN-14 do E2.02).
- **Carga do legado:** os scripts de transformação, backfill e reconciliação da migração (E4.06, E4.07 e E4.09).

### Personas e permissões
Os nomes entre aspas são os rótulos da tela de Funções (RN-22 do E2.02). As pessoas estão na [massa de exemplo](#critérios-de-aceite).

| Persona | Quem é | Permissões | O que faz neste spec |
|---|---|---|---|
| PC Pessoa da célula | Caio (timóteo de C1) e Carla (anfitriã de C1), função Membro | "Visualizar Seu Ministério" e "Enviar Relatório das Próprias Células" | lança o relatório das células em que é líder, timóteo ou anfitrião; não edita |
| GC Quem gerencia células | Pedro, função Líder | "Visualizar Seu Ministério", "Editar Célula", "Enviar Relatório das Próprias Células", "Editar Relatórios de Células" e "Excluir Relatórios de Células" | lança o relatório das células que vê; edita e exclui os relatórios que vê |
| EV Envia por qualquer célula | Júlia, secretária do ministério | "Visualizar Seu Ministério" e "Enviar Relatório de Qualquer Célula Visível" | lança o relatório das células que vê; não edita |
| AD Administrador | Rita, função Administrador | todas | lança e edita em qualquer célula |
| SP Sem permissão | Lucas, função Membro, sem papel em célula | — | não lança nem edita |
| OM Outro ministério | Diego, função Líder | as da Líder | não vê as células nem os relatórios do ministério de Pedro |
| SI Sistema | service role e rotinas internas | — | segue as regras de data, de campos e do retrato (RN-01) |
| CG Carga do legado | scripts E4.06 a E4.09 | — | tratamento próprio (RN-21) |

### Histórias
- Como pessoa da célula, quero enviar o relatório da reunião pelo celular, com a data e o horário já sugeridos, para não errar a semana.
- Como pessoa da célula, quero saber, antes de preencher, se o relatório já foi enviado ou se ainda não dá para enviar, para não perder o que digitei.
- Como líder, quero que o líder, o timóteo e o anfitrião contem como participantes sem que eu precise escolhê-los.
- Como liderança, quero que o relatório guarde quem eram as pessoas da célula e qual era o tipo dela no dia, para o histórico não mudar quando a célula muda.
- Como quem edita relatórios, quero corrigir um relatório de semana passada sem mudar a semana dele.
- Como igreja, quero que o relatório e os participantes sejam gravados juntos, para nunca ficar um relatório pela metade.
- Como igreja, quero migrar os relatórios do legado com as pessoas e o tipo que eles registram.

### Decisões

#### Decisões do usuário e de passos anteriores
| Decisão | O que vale aqui | Onde |
|---|---|---|
| D3 (2026-11-23) | Lançam o relatório o líder, o timóteo e o anfitrião da célula, mais quem gerencia células no escopo. | RN-02 |
| D1 (2026-11-14) e DEL-03 | Exclusão lógica: o relatório excluído não conta e libera a semana. | RN-07 |
| RN-13, RN-14, RN-09, RN-04, P-PER-03, DA-5 e DA-12 do E2.02 | Quem lança e quem edita; só se escolhe quem se vê, e retirar não é escolher; o relatório entra no escopo pelas pessoas registradas nele; o E2.11 absorve a DA-5 e revê a DA-12. | RN-02, RN-03, RN-10, RN-14 |
| RN-06, RN-07, RN-11, RN-12, RN-13, RN-17, RN-20 e DT-15 do E2.01 | Célula excluída não recebe relatório; relatório excluído não é editado; o de célula excluída fica só para consulta; o participante excluído fica e não sai; restaurar não confere as regras de data; a gravação de participantes vem para cá. | RN-02, RN-03, RN-07, RN-10, RN-15 |
| RN-04, RN-07, RN-13, RN-14, P-AUD-18 e DT-09 do E2.05 | "Enviado por"; os participantes fazem parte do envio; um evento por envio ou por edição; o retrato não é alteração; a `save_cell_report` vem para cá. | RN-14, RN-15 |
| RN-06, RN-08, RN-11 (c) e (d), P-CEL-17, P-CEL-18 e P62 do E2.08 | Horário digitado em 24 h; os dados atuais da célula valem na hora; a célula inativa não recebe relatório, e os relatórios dela continuam editáveis; a marca "(inativo)" só para quem se vê. | RN-02, RN-06, RN-08, RN-10 |
| RN-11 do E2.06 | O G12 de uma pessoa: "Pastores" para pastor, "—" para quem está sem liderança. | RN-14, RN-17 |
| P-FIL-08 do E2.07 | "Não houve célula" não é participação. | RN-09 |
| RN-03, P-SIT-17 e Impactos do E2.09 | O relatório de "Não houve célula" conta para a semana; o E2.11 decide o aviso antes de preencher e se a célula cadastrada depois da reunião recebe o relatório dela. | RN-06, RN-07, RN-19 |
| RN-17, RN-18 e P-LCE-31 do E2.10 | O número de participantes inclui os automáticos; oferta zero e oferta não informada são diferentes. | RN-11, RN-13 |

#### Padrões definidos por este spec (revisar no PR)
Estes pontos não estão nas fontes. O PO adotou a opção mais conservadora e coerente com o legado e com os specs anteriores. Nas regras, eles aparecem como "definida pelo spec", e o usuário pode mudar qualquer um na revisão do PR.

- **P-REL-01, regras de data para todos** (RN-01, RN-04 a RN-06). As regras de data valem para todo relatório novo, inclusive o gravado pela service role. Só a carga do legado escapa. Ninguém lança relatório de semana passada, como no legado (ver Q-1).
- **P-REL-02, edição** (RN-05, RN-16).
  - A célula não muda.
  - A data e o horário podem mudar só dentro da semana do relatório, e nunca para o futuro.
  - As regras de semana atual e de reunião da semana não valem na edição.
  - O legado não tinha edição na tela. A API dele editava sem nenhuma regra.
- **P-REL-03, quem só lança não mexe depois do envio** (RN-03). Com o envio numa operação só, deixa de existir a exceção da DA-5 do E2.02, que deixava quem lança incluir participantes no relatório da semana atual.
- **P-REL-04, "a reunião desta semana ainda não aconteceu"** (RN-06). Antes da reunião da semana, nenhum relatório da célula é aceito, e a mensagem diz a partir de quando dá para enviar. Depois da reunião, uma data anterior a ela recebe uma mensagem só, e não as duas do legado ("data de cadastro" e "horário de cadastro" da célula).
- **P-REL-05, "já foi enviado" sem o número** (RN-07). O novo não tem número de relatório. A mensagem diz qual relatório existe (data, horário e situação) só para quem o vê, e oferece "Editar relatório" a quem pode editá-lo.
- **P-REL-06, "Não houve célula" sem participantes** (RN-09, RN-11). Nem os escolhidos, nem os automáticos, e também sem tema, visitantes, oferta e observações. O legado incluía o líder, o timóteo e o anfitrião também quando não houve célula. O E2.07 já não conta essa participação (P-FIL-08).
- **P-REL-07, trocar entre célula realizada e "Não houve célula" na edição** (RN-09).
  - Passar para "Não houve célula" retira os participantes e apaga tema, visitantes, oferta e observações.
  - Essa troca é recusada se houver participante com cadastro excluído, porque ele não poderia voltar (RN-13 do E2.01).
  - Os relatórios antigos de "Não houve célula" com participantes ficam como estão.
- **P-REL-08, participante inativo** (RN-10). Pode ser escolhido, como no legado, e aparece com "(inativo)" ou "(inativa)", como na P-CEL-05 e na P-CEL-18 do E2.08. Hoje o novo só oferece membros ativos.
- **P-REL-09, pessoas registradas fixas** (RN-11). Na edição, o líder, o timóteo e o anfitrião registrados não podem ser retirados da célula realizada. Assim, eles continuam sempre contados, como no legado (ver Q-5).
- **P-REL-10, visitantes** (RN-12).
  - Um nome por visitante. A tela não divide o nome em vírgulas.
  - Espaços nas pontas saem, e espaços repetidos viram um só.
  - Nomes repetidos contam cada um.
  - O limite é de 1000 nomes, o mesmo dos participantes.
- **P-REL-11, oferta obrigatória sem valor sugerido** (RN-13). Na célula realizada, a oferta é sempre informada, e zero é aceito.
  - O legado começava em R$ 0,00. Um valor sugerido esconde a falta de resposta, o mesmo motivo da P-CEL-02 do E2.08.
  - Assim, nenhum relatório novo de célula realizada fica com a oferta "Não informada" (P-LCE-31 do E2.10). Ver Q-4.
- **P-REL-12, o retrato vem da célula** (RN-14). As pessoas e o tipo são lidos da célula gravada no momento do envio, e nunca do que quem lança envia. No legado, a tela mandava as pessoas e não mandava o tipo.
- **P-REL-13, o que cada pessoa sempre vê segue o retrato** (RN-14 b; revisão da DA-12 do E2.02). Mesmo sem permissão de ver relatórios, a pessoa vê os relatórios em que está registrada. É o filtro do legado, que olhava as pessoas guardadas no relatório.
- **P-REL-14, bloco da célula** (RN-17).
  - O bloco ganha o dia e o horário da reunião, que o legado não mostrava e que a regra de data usa.
  - Na edição, o bloco mostra as pessoas e o tipo registrados.
- **P-REL-15, data e horário sugeridos** (RN-18).
  - A sugestão é sempre a reunião da semana.
  - Antes da reunião, não há sugestão.
  - Os limites do campo de data são calculados no horário de Brasília.
- **P-REL-16, aviso antes de preencher** (RN-19). É a recomendação do PO no E2.09 (P-SIT-17): o formulário avisa no topo e não deixa preencher quando o relatório não pode ser enviado.
- **P-REL-17, ordem das recusas** (RN-20). A repetição do envio depois de uma queda de conexão passou para a P-REL-29.
- **P-REL-18, tipo vazio no legado** (RN-21). A tela do legado não enviava o tipo, então o retrato do legado deve vir quase sempre sem tipo. A carga usa o tipo da célula, que é o melhor dado disponível, e o relatório de carga diz quantos relatórios foram tratados assim.
- **P-REL-19, relatórios que já existem no novo** (RN-21). Na publicação, o retrato recebe as pessoas e o tipo atuais da célula. Nada mais muda neles.
- **P-REL-20, rótulos** (Textos de tela):
  - "Reunião" no lugar de "Encontro", que é o retiro da Consolidação;
  - "Tema", "Motivo", "Participantes", "Visitantes", "Oferta" e "Observações", sem complementos;
  - o botão de envio diz "Enviar relatório", como no legado. O da edição está na P-REL-26.
- **Vindos do desenho de UX (2026-11-24, PO-UX-1 a PO-UX-11 em "Experiência (UX)"):**
  - **P-REL-21, a situação em duas opções** (PO-UX-1, RN-08, RN-09). "Célula realizada" e "Não houve célula" ficam lado a lado, e "Célula realizada" vem marcada. Elas substituem a caixa "Não houve célula" do legado e de hoje. Os rótulos são os do legado.
  - **P-REL-22, a data numa lista de dias** (PO-UX-2, RN-16, RN-18).
    - A data é escolhida numa lista só com os dias que o servidor aceita, no formato "Quarta, 25/11/2026", com "(hoje)" no dia de hoje.
    - No lançamento, a lista vai da reunião da semana até hoje. Na edição, vai do domingo da semana do relatório até o sábado dela ou até hoje, o que vier antes.
    - Com um dia só, ele aparece como texto.
  - **P-REL-23, a oferta digitada pelos centavos** (PO-UX-3, RN-09, RN-13).
    - Os dígitos entram pelos centavos, como no legado: "5000" vira R$ 50,00.
    - O campo começa vazio (P-REL-11), com a dica "Se não houve oferta, informe 0,00.".
    - Na edição, ao passar de "Não houve célula" para célula realizada, a oferta começa vazia, a não ser que o relatório já tenha uma oferta maior que zero. O 0 gravado em "Não houve célula" não foi uma resposta.
  - **P-REL-24, a ordem dos campos** (PO-UX-4): Reunião (situação, data, horário e tema), Participantes, Visitantes, Oferta e Observações.
  - **P-REL-25, conferência que não responde** (PO-UX-5, RN-19 d). Se a conferência antes de preencher falhar por conexão, o formulário deixa preencher, com um aviso que não bloqueia. O servidor confere tudo no envio.
  - **P-REL-26, botões da edição e do envio** (PO-UX-6). Na edição, o botão é "Salvar alterações", como nos formulários de membro, de célula e de função. Durante o envio, o botão diz "Enviando…"; durante a edição, "Salvando…".
  - **P-REL-27, a recusa de quem não pode lançar** (PO-UX-7, RN-02). O texto e o código são os do E2.02, já na `main`:
    - quem vê a célula e tem alguma permissão de lançar, mas não para ela, recebe "Você não pode enviar o relatório desta célula." (`report_submit_not_allowed`);
    - quem não tem nenhuma permissão de lançar recebe "Você não tem permissão para esta ação.".

    O E2.02 não muda.
  - **P-REL-28, rótulos do bloco sem sexo** (PO-UX-8, RN-17). "Líder", "Timóteo" e "Anfitrião" são fixos, como no detalhe da célula (E2.10). Assim, o rótulo não revela o sexo de quem quem lança não vê.
  - **P-REL-29, envio que pode ser repetido** (PO-UX-9, RN-07, RN-20). A sugestão da UX (AQ-4) foi aceita:
    - repetir o mesmo envio depois de uma queda de conexão não grava outro relatório e mostra o sucesso normal, "Relatório enviado.";
    - se o formulário foi alterado entre as tentativas, vale o que foi gravado na primeira, e a tela diz que as mudanças posteriores não foram salvas;
    - um envio novo, de outro formulário, continua recebendo a recusa de "já foi enviado" (RN-07).

    Sai a frase "Confira na lista de Relatórios.", que mandava para outra tela quem abriu pelo Dashboard ou pela lista de Células.
  - **P-REL-30, textos da UX** (PO-UX-10). Todos foram aceitos. Os que estão ligados a uma regra foram copiados para os "Textos de tela" deste Negócio. Os textos das respostas possíveis da T12 só valem se a pergunta correspondente virar regra.
  - **P-REL-31, sugestões que não entram** (PO-UX-11).
    - "Ver relatório" no aviso de "já foi enviado", para quem vê o relatório e não pode editá-lo, fica para quando a consulta do E2.12 valer para todos que veem o relatório (ver Impactos).
    - "Repetir os participantes do último relatório" pede regra nova e vira a pergunta Q-8.

### Regras de negócio
Nenhuma regra está "a confirmar".

Correspondência com o plano:
- REL-01 → RN-05;
- REL-02 → RN-04;
- REL-03 → RN-07;
- REL-04 → RN-06;
- REL-05 → RN-08;
- REL-06 → RN-09;
- REL-07 → RN-11;
- REL-08 → RN-12;
- REL-09 → RN-14;
- REL-10 → RN-15;
- REL-11 → RN-02 e RN-03;
- REL-12 → RN-13;
- REL-15 → RN-17;
- a correção da data sugerida → RN-18.

| ID | Regra | Origem |
|---|---|---|
| RN-01 | **Alcance.**<br>- As regras deste spec valem para todo relatório de célula, de qualquer tipo de célula (Evangelística, Discipulado e Macrocélula), com as mesmas regras.<br>- Valem para qualquer gravação: pela tela, pela API e pelas rotinas internas, com ou sem a service role.<br>- Lançar e editar acontecem por um caminho só, que aplica todas as regras. Nenhuma gravação direta no relatório ou nos participantes escapa delas.<br>- Cada regra diz se vale no lançamento, na edição ou nos dois (tabela [Onde cada regra vale](#onde-cada-regra-vale)).<br>- A service role não tem sessão. Por isso, as regras de quem lança e de quem edita (RN-02 e RN-03) não se aplicam a ela. As de data, de semana, de campos e do retrato se aplicam.<br><br>Exceções:<br>(a) a carga do legado (RN-21);<br>(b) excluir e restaurar seguem o E2.01. Restaurar não confere as regras de data (RN-17 de lá). | REL-01 a REL-12; 5.3 e 5.5 do `docs/migracao.md`; E2.01 (RN-17); service role: definida pelo spec (P-REL-01) |
| RN-02 | **Quem lança (REL-11, D3).** Lança o relatório de uma célula:<br>(a) o líder, o timóteo ou o anfitrião **atual** da célula, se a função dele tiver "Enviar Relatório das Próprias Células";<br>(b) quem tem "Editar Célula", para as células que vê;<br>(c) quem tem "Enviar Relatório de Qualquer Célula Visível", para as células que vê.<br><br>A célula precisa estar ativa e não excluída. Recusas, com os textos e o código do E2.02:<br>- sem nenhuma das três permissões: "Você não tem permissão para esta ação.";<br>- com alguma delas, para uma célula que a pessoa vê, mas em que não pode lançar (por exemplo, quem só tem "Enviar Relatório das Próprias Células" e não é pessoa da célula): "Você não pode enviar o relatório desta célula." (`report_submit_not_allowed`);<br>- célula que a pessoa não vê é tratada como inexistente: "Esta célula não existe ou já foi excluída.";<br>- célula excluída: "Esta célula foi excluída e não recebe relatórios.";<br>- célula inativa: "Esta célula está inativa e não recebe relatórios.". Na tela, a orientação segue a P-CEL-17 do E2.08.<br><br>Detalhes:<br>- A situação de quem lança não muda nada: o inativo, o pastor e quem está sem liderança lançam se forem pessoas da célula com a permissão.<br>- Ser participante de relatórios da célula não dá direito de lançar. | REL-11; D3 (2026-11-23); E2.02 (RN-13, P-PER-07, `report_submit_not_allowed`); E2.08 (RN-11 c, P-CEL-17); E2.01 (RN-06); legado (`API/Controllers/ReportController.cs:34-39`: qualquer usuário autenticado; `App/Services/ReportApp.cs:43-45`: célula fora do escopo dá "Célula não encontrada."); textos das recusas: definida pelo spec (P-REL-27) |
| RN-03 | **Quem edita e exclui (REL-11).**<br>- Editar: "Editar Relatórios de Células", em relatório visível (RN-04 do E2.02, que passa a seguir o retrato, RN-14), com a RN-09 do E2.02. Excluir: "Excluir Relatórios de Células", com as regras do E2.01.<br>- Quem só lança não edita nem exclui o relatório, nem o que acabou de enviar. Depois do envio, incluir ou retirar participantes também é edição. A exceção da DA-5 do E2.02 deixa de existir.<br>- Não se edita:<br>  - o relatório excluído: "Este relatório não existe ou já foi excluído." (RN-07 do E2.01);<br>  - o relatório de célula excluída: "A célula deste relatório foi excluída. Restaure a célula para editar o relatório." (RN-11 do E2.01).<br>- O relatório de célula inativa pode ser editado (RN-11 d do E2.08).<br>- O que pode mudar numa edição está na RN-16. | REL-11; E2.02 (RN-14, DA-5); E2.01 (RN-07, RN-11); E2.08 (RN-11 d); legado (`ReportController.cs:41-55`: editar e excluir só com `AppAdmin` e `AppSuperAdmin`); fim da DA-5: definida pelo spec (P-REL-03) |
| RN-04 | **Semana atual (REL-02). Só no lançamento.**<br>- A data do relatório precisa estar na semana atual: de domingo a sábado da semana do momento do envio, no horário de Brasília.<br>- Mensagem: "O relatório precisa ser da semana atual, de {domingo dd/mm/aaaa} a {sábado dd/mm/aaaa}.", por exemplo "… de 22/11/2026 a 28/11/2026."<br>- Vale para todo relatório novo, inclusive o gravado pela service role e o de quem vê a igreja toda.<br>- Não vale na edição (RN-16), na restauração (RN-17 do E2.01) nem na carga (RN-21).<br>- Não existe relatório atrasado. Depois de sábado, 23:59:59, a semana não recebe mais relatório, de ninguém (ver Q-1). | REL-02; legado (`ReportApp.cs:25-26` e `:31-32`; `Domain/Extensions/DateTimeExtensions.cs:8-18`: semana a partir do domingo, cultura pt-BR, horário de Brasília); só no lançamento: passo E2.11 do plano e legado (`App/Services/ReportService.cs:98-108`: a edição não confere a semana); service role: definida pelo spec (P-REL-01) |
| RN-05 | **Sem data futura (REL-01). Lançamento e edição.**<br>- A data e o horário do relatório, juntos, não podem ser depois de agora (Brasília). O próprio minuto de agora é aceito.<br>- Exemplo: na quarta, 25/11, às 20:30, são aceitos 25/11 às 20:30 e qualquer momento anterior. São recusados 25/11 às 20:31 e 26/11.<br>- Mensagem: "O relatório não pode ser enviado para uma data ou horário futuros."<br>- Na edição, vale quando a data ou o horário mudam. | REL-01; legado (`ReportApp.cs:28-29`: "O relatório não pode ser enviado para uma data futura."); mensagem adaptada; na edição: definida pelo spec (P-REL-02) |
| RN-06 | **Não antes da reunião da semana (REL-04). Só no lançamento.**<br>- A data e o horário do relatório não podem ser anteriores à reunião da semana: o dia e o horário atuais da célula, na semana atual. O próprio momento da reunião é aceito (quarta, 20:00, na célula de quarta às 20:00).<br>- Com a RN-04 e a RN-05, o relatório de célula realizada fica entre a reunião da semana e agora. Exemplo: na sexta, 27/11, às 10:00, C1 aceita qualquer momento de quarta, 25/11, às 20:00, até sexta, 27/11, às 10:00.<br>- **Antes da reunião da semana** não existe data válida. Todo envio para a célula, de célula realizada ou de "Não houve célula", é recusado com "A reunião desta semana ainda não aconteceu. O relatório pode ser enviado a partir de {dia}, {dd/mm/aaaa}, às {HH:mm}.", por exemplo "… a partir de quarta, 25/11/2026, às 20:00."<br>- **Depois da reunião,** uma data e um horário anteriores a ela recebem "O relatório não pode ser de antes da reunião da célula nesta semana ({dia}, {dd/mm/aaaa}, às {HH:mm})."<br>- Valem o dia e o horário da célula no momento do envio (RN-08 do E2.08). Se o dia da célula mudou durante a semana, vale o novo.<br>- A célula cadastrada ou reativada depois da reunião da semana recebe o relatório dessa reunião, como no legado.<br>- Célula de domingo: a reunião abre a semana. Célula de sábado: o relatório só pode ser enviado entre o horário da reunião e sábado, 23:59:59 (ver Q-1).<br>- Não vale na edição (RN-16), porque o dia e o horário da célula podem ter mudado depois da reunião. | REL-04; legado (`ReportApp.cs:47-51`: recusa o dia da semana anterior ao da célula e, no mesmo dia, o horário anterior ao dela; o legado não confere a data de cadastro da célula); E2.08 (RN-08); E2.09 (Impactos: célula cadastrada depois da reunião); "ainda não aconteceu" e mensagem única: definida pelo spec (P-REL-04) |
| RN-07 | **Um relatório por célula por semana (REL-03).**<br>- Cada célula tem no máximo um relatório não excluído por semana. O de "Não houve célula" conta.<br>- Mensagem: "O relatório para esta semana já foi enviado."<br>  - Para quem vê o relatório que já existe, a mensagem diz também qual é: "Reunião de {dia}, {dd/mm/aaaa}, às {HH:mm} · {Célula realizada \| Não houve célula}.". A quem pode editá-lo, ela oferece "Editar relatório".<br>  - Quem não vê o relatório recebe só a primeira frase. Que existe um relatório na semana, ele já sabe pela situação "Enviado" (RN-03 e RN-04 do E2.09).<br>  - O número do legado ("#id") não aparece, porque o novo não tem número de relatório.<br>- Com envios simultâneos para a mesma célula e a mesma semana, só um é aceito. Os outros recebem a mesma mensagem, e nada deles é gravado.<br>- O relatório excluído não conta: excluir libera a semana (DEL-03, RN-12 do E2.01). Restaurar segue a RN-17 do E2.01.<br>- Vale em todos os caminhos, inclusive na service role e na carga. Os relatórios do legado repetidos na mesma semana seguem a 5.4.<br>- Na edição, não há como violar, porque a célula e a semana do relatório não mudam (RN-16).<br>- A repetição do mesmo envio depois de uma queda de conexão não é um envio novo: ela não recebe esta recusa e segue a RN-20. | REL-03; DEL-03; legado (`ReportApp.cs:34-41`); E2.01 (índice `cell_reports_cell_week_key`, RN-12, RN-17 e RN-20); E2.09 (RN-03); sem o número e com a identificação para quem vê: definida pelo spec (P-REL-05) |
| RN-08 | **Célula realizada (REL-05).**<br>- A situação é escolhida entre duas opções, "Célula realizada" e "Não houve célula". "Célula realizada" vem marcada.<br>- Obrigatórios: data, horário, tema e oferta (RN-13). O tema não pode ficar vazio depois de tirar os espaços das pontas.<br>- Opcionais: participantes escolhidos, visitantes e observações.<br>- Mensagens: "Informe a data da reunião.", "Informe o horário da reunião.", "Informe o tema ministrado." e, pela API, "Data inválida.".<br>- O horário segue a RN-06 do E2.08:<br>  - horas e minutos, de 00:00 a 23:59, sem segundos ("20:00:45", vindo da API, é gravado como 20:00);<br>  - na tela, é digitado em 24 h (P62 da UX do E2.08);<br>  - mensagem: "Horário inválido. Informe a hora e os minutos, entre 00:00 e 23:59."<br>- Em tema, motivo e observações, os espaços nas pontas são removidos.<br>- Vale no lançamento e na edição, para o relatório como fica gravado. | REL-05; legado (`Domain/Validators/ReportDTOValidator.cs:16-25`: tema e data obrigatórios quando a célula aconteceu; `UI/pages/Report/details.js:98-110`: "Insira a data da célula", "Insira o horário da célula" e "Insira o tema ministrado"); E2.08 (RN-06, P62); mensagens adaptadas do legado; duas opções: definida pelo spec (P-REL-21) |
| RN-09 | **"Não houve célula" (REL-06).**<br>- **Motivo obrigatório**, sem ficar vazio depois de tirar os espaços: "Informe o motivo de não ter havido célula."<br>- **Data e horário:**<br>  - no lançamento, são gravados os da reunião da semana (RN-06);<br>  - a tela não pede data nem horário: mostra o dia e o horário da reunião;<br>  - pela API, a data e o horário enviados são ignorados e trocados pelos da reunião;<br>  - como a reunião não pode ser futura (RN-05), "Não houve célula" só pode ser enviado a partir do horário da reunião (RN-06), como no legado.<br>- **Nada mais:** sem tema, participantes, visitantes, oferta e observações. No lançamento, nada disso é gravado, mesmo que venha pela API. Os participantes automáticos (RN-11) também não entram. O motivo é o único texto.<br><br>**Na edição:**<br>- Passar de célula realizada para "Não houve célula":<br>  - exige o motivo;<br>  - retira todos os participantes e apaga tema, visitantes, oferta e observações;<br>  - a data e o horário ficam como estão.<br>  - Se algum participante tiver o cadastro excluído (RN-13 do E2.01), a troca é recusada: "Este relatório tem participante com cadastro excluído e não pode passar para "Não houve célula"."<br>- Passar de "Não houve célula" para célula realizada:<br>  - exige o tema e a oferta. A oferta começa vazia, a não ser que o relatório já tenha uma oferta maior que zero;<br>  - apaga o motivo;<br>  - as pessoas registradas (retrato) entram como participantes (RN-11).<br>- O relatório de "Não houve célula" que já tem participantes, tema, oferta ou visitantes (do legado ou de antes deste passo) fica como está enquanto continuar "Não houve célula". Editar só o motivo não exige limpá-lo.<br><br>O relatório de "Não houve célula" conta como o relatório da semana (RN-07). | REL-06; legado (`details.js:112-114`: justificativa obrigatória; `:144-146`: a data gravada é o dia e o horário previstos; `:326`, `:338`, `:353`, `:363` e `:378`: data, horário, tema, oferta e participantes desabilitados; `App/Services/ReportService.cs:46-53`: incluía as pessoas da célula também quando não houve célula); E2.07 (P-FIL-08); sem participantes: definida pelo spec (P-REL-06); trocas na edição: definida pelo spec (P-REL-07); oferta na troca: definida pelo spec (P-REL-23) |
| RN-10 | **Participantes escolhidos.**<br>- Na célula realizada, quem lança escolhe os membros que estiveram na reunião.<br>- **Quem pode ser escolhido:** qualquer membro não excluído que quem grava vê (RN-09 b do E2.02): ativo ou inativo, de qualquer sexo, pastor ou sem liderança.<br>- **Inativo:** aparece com "(inativo)" ou "(inativa)", conforme o sexo, no seletor e na lista de escolhidos, só para quem o vê (P-CEL-18 do E2.08). É só um aviso: não impede o envio e não muda a situação do membro.<br>- **Excluído:** o seletor não o oferece, e a API recusa com "Este membro foi excluído e não pode ser escolhido." (RN-06 do E2.01). Se ele for excluído entre a escolha e o envio, o envio inteiro é recusado com essa mensagem, e nada é gravado (RN-15).<br>- **Quem não se vê:** o seletor não o oferece, e a API recusa com "Você só pode escolher pessoas que você vê." (RN-09 b do E2.02).<br>- O mesmo membro escolhido mais de uma vez conta uma vez.<br>- O cônjuge não entra junto: marido e esposa são escolhidos cada um.<br>- No máximo 1000 participantes por relatório, contando os automáticos: "Um relatório pode ter no máximo 1000 participantes."<br><br>**Na edição:**<br>- Incluir segue as mesmas regras.<br>- Qualquer participante pode ser retirado, inclusive o que quem edita não vê (RN-09 do E2.02, "retirar não é escolher"). Não podem ser retirados:<br>  - o participante com cadastro excluído: "Não é possível retirar um participante cujo cadastro foi excluído." (RN-13 do E2.01);<br>  - as pessoas registradas na célula realizada (RN-11). | legado (`UI/pages/Report/details.js:376-378` com `UI/components/MemberPicker/index.js:45-48` e `Infra/Repositories/MemberRepository.cs:44-51`: membros não excluídos do escopo, sem filtrar os inativos; `ReportService.cs:42-44` e `:55`: sem duplicata); E2.01 (RN-06, RN-13 e o limite de 1000 da `set_cell_report_participants`); E2.02 (RN-09); marca do inativo: definida pelo spec (P-REL-08) |
| RN-11 | **Participantes automáticos (REL-07).**<br>- No lançamento de célula realizada, o líder, o timóteo e o anfitrião da célula naquele momento entram como participantes. São os mesmos do retrato (RN-14).<br>- Sem duplicar: a mesma pessoa em dois papéis, ou também escolhida, conta uma vez.<br>- Entram sempre: inativos, de outro ministério, fora do que quem lança vê (isentos da RN-09 b do E2.02), pastores e sem liderança. Nunca estão excluídos, porque a célula ativa não tem pessoa excluída (RN-06 do E2.01 e DEL-08).<br>- A tela mostra, antes do envio, que eles entram, e o total de participantes já os conta. Quem lança não pode tirá-los.<br><br>**Na edição:**<br>- As pessoas registradas não podem ser retiradas da célula realizada: "O líder, o timóteo e o anfitrião registrados no relatório não podem ser retirados dos participantes."<br>- Passar de "Não houve célula" para célula realizada as inclui (RN-09).<br>- Fora dessa troca, a edição não as acrescenta a um relatório antigo que não as tenha.<br><br>**Outros pontos:**<br>- Elas não entram em "Não houve célula" (RN-09).<br>- O número de participantes do relatório conta os escolhidos e os automáticos, uma vez cada. Conta também quem foi excluído depois (RN-13 do E2.01). Corresponde ao `NumMembers` do legado. | REL-07; legado (`ReportService.cs:46-56`: o líder, o timóteo e o anfitrião entram, sem duplicata, e `NumMembers` é o total); E2.02 (Impactos no E2.11: isentos da RN-09 b); E2.01 (RN-06, RN-13); E2.10 (RN-18); fixas na edição: definida pelo spec (P-REL-09); fora de "Não houve célula": definida pelo spec (P-REL-06) |
| RN-12 | **Visitantes (REL-08).**<br>- São nomes livres de quem esteve na reunião e não é membro, um nome por visitante. Só existem na célula realizada.<br>- O texto de um nome não é dividido: "Silva, João" é um visitante só.<br>- Os espaços nas pontas são removidos, e os espaços repetidos viram um só. Nomes vazios são descartados e não contam.<br>- Nomes repetidos são aceitos e contam cada um, porque podem ser duas pessoas ("Maria" e "Maria").<br>- No máximo 1000 nomes: "Um relatório pode ter no máximo 1000 visitantes."<br>- O número de visitantes é o número de nomes gravados (o `NumVisitors` do legado).<br>- Os nomes ficam na ordem em que foram informados.<br>- Os visitantes não viram cadastro de membro (ver Fora de escopo).<br>- Vale no lançamento e na edição. | REL-08; legado (`ReportService.cs:57` e `Domain/Mappings/DomainToDTOMappingProfile.cs:70-74`: só os nomes preenchidos contam; `details.js:399-418`: um campo por visitante, sem limite); 5.5 (`trim`, vazios descartados); repetidos, espaços e limite: definida pelo spec (P-REL-10) |
| RN-13 | **Oferta (REL-12).**<br>- Em reais, maior ou igual a zero, com até 2 casas decimais. É mostrada no padrão pt-BR: "R$ 1.234,50".<br>- **Célula realizada:** é obrigatória e começa vazia, sem valor sugerido. Zero é aceito e quer dizer que não houve oferta.<br>- **Na tela,** os dígitos entram pelos centavos, como no legado: "5000" vira R$ 50,00, e "0" é R$ 0,00. Apagar todos os dígitos deixa o campo vazio, e vazio não é zero. Uma dica diz "Se não houve oferta, informe 0,00.".<br>- Mensagens:<br>  - vazia: "Informe a oferta. Se não houve oferta, informe R$ 0,00.";<br>  - negativa: "A oferta não pode ser negativa.";<br>  - mais de 2 casas decimais: "Oferta inválida. Informe um valor em reais, com até 2 casas decimais."<br>- **"Não houve célula":** sem oferta (RN-09).<br>- **Quem vê:** todos que veem o relatório (RN-04 do E2.02), em qualquer tela que mostre o relatório. Não é dado sensível, e não há permissão nova.<br>- A partir deste passo, nenhum relatório de célula realizada fica com a oferta "Não informada" (P-LCE-31 do E2.10).<br>- Vale no lançamento e na edição. | REL-12; legado (`Domain/Model/Report.cs:36`: decimal, sempre com valor; `details.js:28` e `:362-369`: começa em R$ 0,00, com máscara de moeda; `UI/pages/Report/index.js:80-82`: a coluna Oferta para quem vê o relatório); 5.5 (2 casas decimais); E2.10 (P-LCE-31); obrigatória e sem valor sugerido: definida pelo spec (P-REL-11); digitada pelos centavos: definida pelo spec (P-REL-23) |
| RN-14 | **Retrato da célula (REL-09).**<br>- No lançamento, o relatório guarda o líder, o timóteo, o anfitrião e o tipo da célula naquele momento. Eles vêm da célula gravada, nunca do que quem lança envia.<br>- O retrato não muda depois:<br>  - quando a célula muda de pessoas, tipo, dia, horário, endereço ou situação;<br>  - quando a pessoa registrada muda de nome ou de líder, fica inativa ou é excluída. A excluída aparece só pelo nome (RN-09 c do E2.01);<br>  - na edição do relatório, porque a célula não muda (RN-16).<br>- O G12 não é guardado. O G12 do relatório é o G12 atual do líder registrado (RN-11 do E2.06): "Pastores" para pastor e "—" para quem está sem liderança, como no legado.<br>- O retrato não conta como alteração e não gera evento (RN-04 c do E2.05).<br><br>Onde o retrato é usado:<br>(a) **Escopo:** o relatório está no escopo pelas pessoas registradas nele (RN-04 do E2.02, que deixa de usar as pessoas atuais da célula).<br>(b) **O que cada pessoa sempre vê** (item d da RN-02 do E2.02, revisão da DA-12):<br>  - mesmo sem permissão de ver relatórios, a pessoa vê os relatórios em que está registrada como líder, timóteo ou anfitrião;<br>  - quem entra numa célula não ganha, por isso, os relatórios anteriores dela;<br>  - quem sai da célula continua vendo os relatórios em que está registrado.<br>(c) **Formulário de edição e consulta:** o bloco da célula mostra as pessoas e o tipo registrados, e não os atuais (RN-17).<br>(d) **Lista de Relatórios:** o líder de cada relatório é o líder registrado, e o G12 é o G12 atual dele. A busca por nome usa o líder registrado.<br>(e) **Participantes automáticos** na troca para célula realizada (RN-09 e RN-11).<br><br>Não usam o retrato:<br>- a situação do relatório (E2.09);<br>- quem pode lançar, que segue as pessoas atuais (RN-02);<br>- o endereço, o dia e o horário mostrados, que são os atuais da célula. | REL-09; legado (`Domain/Model/Report.cs:22-34`; `details.js:78-86`: as pessoas copiadas da célula; `Domain/Extensions/QueryingExtensions.cs:404-455`: o escopo pelas pessoas guardadas; `UI/pages/Report/index.js:47-52`: o líder guardado e o G12 atual dele); E2.02 (RN-04, P-PER-03, DA-12); E2.05 (RN-04 c); vindo da célula, com o tipo: definida pelo spec (P-REL-12); item (b): definida pelo spec (P-REL-13) |
| RN-15 | **Tudo ou nada, autoria e Auditoria (REL-10).**<br>- Lançar grava juntos: o relatório, o retrato, os participantes escolhidos e os automáticos, a autoria e o evento da Auditoria.<br>- Editar grava juntos: as mudanças, os participantes incluídos e retirados, a autoria e o evento.<br>- Se qualquer parte for recusada ou falhar, nada é gravado. Não existe mais "relatório salvo sem os participantes".<br>- **Autoria (E2.05):**<br>  - "Enviado por {Nome} em {dd/mm/aaaa} às {HH:mm}". Logo depois do envio, aparece só essa linha (RN-04 d do E2.05);<br>  - cada edição: "Alterado por …".<br>- **Auditoria:**<br>  - um evento por envio, com os participantes enviados dentro;<br>  - um evento por edição, com os dados mudados e os participantes incluídos e retirados (RN-13 b do E2.05).<br>- Salvar uma edição sem mudança mostra "Nenhuma alteração para salvar." e não gera evento (RN-04 b do E2.05). | REL-10; legado (transação do EF em `Infra/Repositories/ReportRepository.cs:34-45`); E2.05 (RN-04, RN-13, RN-14, DT-09); E2.01 (DT-15) |
| RN-16 | **Edição: o que pode mudar.** Quem edita está na RN-03.<br>- **Não mudam:** a célula, o retrato e a autoria do envio. Trocar a célula pela API recebe "A célula de um relatório não pode ser trocada.".<br>- **Data e horário:**<br>  - podem mudar dentro da semana do relatório, de domingo a sábado da data gravada, sem ir para o futuro (RN-05);<br>  - na tela, a data é escolhida numa lista com os dias da semana do relatório até o sábado dela ou até hoje, o que vier antes (P-REL-22);<br>  - fora da semana: "Na edição, a data só pode mudar dentro da semana do relatório, de {dd/mm/aaaa} a {dd/mm/aaaa}.";<br>  - a RN-04 (semana atual) e a RN-06 (reunião da semana) não valem: o relatório de semanas passadas pode ser editado, e o horário pode ficar antes do horário atual da célula;<br>  - no relatório de "Não houve célula", a tela mostra a data e o horário só para leitura.<br>- **Demais campos:** seguem as RN-08 a RN-13 para o relatório como fica gravado, com as trocas da RN-09.<br>- **Participantes:** RN-10 e RN-11.<br>- Duas edições simultâneas do mesmo relatório: vale a última gravação, como no E2.08, e cada uma é uma alteração na Auditoria. | legado (`ReportService.cs:98-108`: a edição pela API não tem regra de data; a tela do legado não edita relatório: `UI/services/Report.service.js` não tem edição); passo E2.11 do plano (semana atual só no lançamento); célula fixa e semana do relatório: definida pelo spec (P-REL-02); lista de dias: definida pelo spec (P-REL-22) |
| RN-17 | **Escolha da célula e dados da célula no formulário (REL-15).**<br>- O seletor oferece só as células em que a pessoa pode lançar (RN-02): ativas e não excluídas.<br>- Ele busca pelo nome do líder, como no legado, e também por rua e bairro, como no novo. Cada opção identifica a célula pelo líder, pelo G12, pelo endereço, pelo dia e pelo horário, como no legado.<br>- Aberto a partir de uma célula (lista de Células e detalhe da célula), o formulário já vem com a célula escolhida, e ela não muda.<br>- Depois de escolhida a célula, a tela mostra, só para leitura:<br>  - Líder, Timóteo e Anfitrião;<br>  - G12: "Pastores" ou "—", conforme a RN-11 do E2.06;<br>  - Tipo;<br>  - Dia e horário;<br>  - Endereço: rua, número e bairro.<br>- Os rótulos "Líder", "Timóteo" e "Anfitrião" não mudam com o sexo da pessoa.<br>- Quem quem lança não vê aparece só pelo nome (RN-06 do E1.08). A marca "(inativo)" só aparece para quem se vê (P-CEL-18 do E2.08).<br>- Na edição, a célula não muda, e o bloco mostra as pessoas e o tipo registrados (RN-14 c), com o dia, o horário e o endereço atuais da célula. | REL-15; legado (`details.js:226-302`: o bloco só para leitura; `UI/components/CellPicker/index.js:39-56`: busca pelo nome do líder e rótulo com líder, G12, rua, bairro, dia e horário); E2.06 (RN-11); E2.08 (P-CEL-18); E2.10 (Impactos: o formulário aberto pelo detalhe vem com a célula travada); dia e horário no bloco e retrato na edição: definida pelo spec (P-REL-14); rótulos sem sexo: definida pelo spec (P-REL-28) |
| RN-18 | **Data e horário sugeridos (correção do `calculateCellDate`).**<br>- No lançamento, ao escolher a célula, o formulário sugere a data e o horário da reunião da semana (RN-06): o dia da célula na semana atual e o horário da célula, em Brasília. Exemplo: na sexta, 27/11, C1 sugere quarta, 25/11/2026, às 20:00.<br>- Nunca sugere uma data de outra semana. Hoje, `calculateCellDate` sugere a semana passada quando a reunião desta semana ainda não aconteceu, e o banco recusa.<br>- Antes da reunião da semana não há sugestão. Vale o aviso da RN-19.<br>- A sugestão pode ser trocada por qualquer data e horário entre a reunião da semana e agora.<br>- A data é escolhida numa lista só com esses dias, calculados em Brasília, e não pelo relógio do aparelho. Cada dia aparece como "Quarta, 25/11/2026", e o dia de hoje tem "(hoje)". Com um dia só, ele aparece como texto.<br>- Trocar de célula troca a sugestão, mesmo que a data já tenha sido alterada.<br>- Na edição, não há sugestão: vêm a data e o horário gravados.<br>- Em "Não houve célula", a data e o horário são os da reunião (RN-09) e aparecem só para leitura. | Problemas conhecidos do `CLAUDE.md` (`calculateCellDate`); legado (`details.js:65-72` e `:84-85`: o dia da célula na semana atual e o horário da célula); limites em Brasília e sem sugestão antes da reunião: definida pelo spec (P-REL-15); lista de dias: definida pelo spec (P-REL-22) |
| RN-19 | **Aviso antes de preencher.** Ao escolher a célula, ou ao abrir o formulário com ela já escolhida, o formulário confere a situação antes do preenchimento e avisa no topo:<br>(a) **a semana já tem relatório:** a mensagem da RN-07, com a identificação e "Editar relatório" para quem pode;<br>(b) **a reunião desta semana ainda não aconteceu:** a mensagem da RN-06;<br>(c) **a célula ficou inativa ou foi excluída** depois de a tela ser aberta: as mensagens do E2.08 e do E2.01.<br><br>Nos três casos, o formulário não deixa preencher nem enviar. Quando (a) e (b) valem ao mesmo tempo, aparece (a).<br><br>(d) **A conferência não responde** (por exemplo, falha de conexão): o formulário deixa preencher, com um aviso que não bloqueia: "Não foi possível conferir se o relatório desta semana já foi enviado. Você pode preencher; a conferência é feita ao enviar.", e "Tentar de novo". A data e o horário sugeridos são os da reunião da semana em Brasília. Se uma nova conferência responder (a), (b) ou (c) depois de algo digitado, o aviso aparece no topo sem apagar o que foi digitado.<br><br>Detalhes:<br>- O aviso não substitui a conferência no envio. Se a situação mudar com o formulário aberto (outro relatório enviado, o relatório da semana excluído, a virada da semana), vale a resposta do servidor no envio, e o formulário mantém o que foi digitado.<br>- O aviso não muda a situação do relatório (E2.09) e não mostra o conteúdo do relatório a quem não o vê. | E2.09 (P-SIT-17 e Impactos: recomendação do PO); E2.08 (RN-11 c); E2.01 (RN-06); definida pelo spec (P-REL-16); conferência que não responde: definida pelo spec (P-REL-25) |
| RN-20 | **Como as recusas aparecem.**<br>- **Ordem.** Pela API, a recusa é uma só: a primeira desta lista.<br>  1. Permissão, escopo, registro excluído e célula inativa (E1.03, E2.02, E2.01 e E2.08).<br>  2. Preenchimento e formato (RN-08 a RN-13).<br>  3. Na edição: a célula e a semana do relatório (RN-16).<br>  4. Semana atual (RN-04).<br>  5. Um por semana (RN-07).<br>  6. A reunião da semana ainda não aconteceu (RN-06).<br>  7. Data ou horário futuros (RN-05).<br>  8. Data antes da reunião (RN-06).<br>- **Na tela, ao enviar,** os erros de preenchimento aparecem todos de uma vez, cada um no seu campo, e nada é enviado. O topo do formulário diz "Campos com * são obrigatórios." e, com erro, "Confira os campos destacados ({N})."<br>- **Horário:** o erro de formato aparece ao sair do campo (P62 do E2.08).<br>- **Recusas do servidor:** aparecem no campo certo (data, horário, participantes) ou no topo do formulário. A mensagem técnica do banco nunca aparece, e o que foi digitado não se perde.<br>- **Queda de conexão:**<br>  - no envio: "Não foi possível enviar o relatório. Verifique a conexão e tente de novo.";<br>  - na edição: "Não foi possível salvar o relatório. Verifique a conexão e tente de novo.";<br>  - os dados ficam no formulário, e a ação primária pode ser tocada de novo.<br>- **Repetir o mesmo envio é seguro.** Cada formulário aberto é um envio só, mesmo que seja tentado mais de uma vez:<br>  - se a primeira tentativa foi gravada, a repetição não grava outro relatório, não muda o gravado nem gera outro evento, e a tela mostra o sucesso normal, "Relatório enviado.";<br>  - se algo foi alterado no formulário entre as tentativas, vale o que foi gravado na primeira, e a tela mostra "O relatório foi enviado na primeira tentativa. As alterações feitas depois não foram salvas.";<br>  - um envio de outro formulário para a mesma célula e semana (outra pessoa, ou o formulário fechado e aberto de novo) é um envio novo e recebe a recusa da RN-07;<br>  - na edição, a repetição segue a RN-14 do E2.05: a alteração é gravada uma vez só.<br>- **Durante o envio,** o botão diz "Enviando…" (lançamento) ou "Salvando…" (edição), e um segundo toque não gera outro envio.<br>- **Sucesso:** "Relatório enviado." ou "Relatório atualizado." | legado (`details.js:116-121`: todos os erros juntos; `ReportApp.cs:28-51`: uma recusa por vez, em ordem); E2.08 (RN-14, P62); E2.05 (mensagem de conexão, RN-14); ordem: definida pelo spec (P-REL-17); repetição do mesmo envio: definida pelo spec (P-REL-29); "Enviando…": definida pelo spec (P-REL-26) |
| RN-21 | **Relatórios que já existem e carga do legado.**<br>**Carga:**<br>- Traz os relatórios do legado de qualquer data, com as transformações da 5.5. Não passa pelas regras de lançamento (RN-02 e RN-04 a RN-06) nem pelas de campos (RN-08 a RN-13). O índice de um relatório por semana vale (RN-07): fica o mais recente, e os outros migram excluídos (5.4).<br>- **Retrato:** vem do próprio relatório do legado (`LeadershipId`, `HostId`, `TimothyId` e `CellType`).<br>  - Quando o tipo vier vazio, recebe o tipo da célula na carga, e o relatório de carga diz quantos foram tratados assim.<br>  - A pessoa registrada que está excluída continua no retrato e aparece só pelo nome.<br>- **Participantes e visitantes** vêm como estão, inclusive os automáticos e os de "Não houve célula". A reconciliação confere participantes = `NumMembers` e visitantes = `NumVisitors` (5.6).<br>- Em "Não houve célula", as observações do legado viram o motivo (5.5). Tema, oferta e visitantes vêm como estão.<br>- A carga não gera eventos na Auditoria nem muda a autoria (RN-10 e do E2.05).<br><br>**Relatórios que já existem no novo** quando este passo for publicado:<br>- o retrato recebe as pessoas e o tipo atuais da célula. É o melhor dado disponível, e é o que a RN-04 do E2.02 usa até aqui;<br>- nada mais muda neles: não ganham participantes automáticos, e os de "Não houve célula" ficam como estão. | 5.3 a 5.6 do `docs/migracao.md`; E2.01 (5.4: relatórios repetidos na semana); E2.05 (RN-10 e); legado (`details.js:74-89`: a tela não envia o tipo); tipo vazio: definida pelo spec (P-REL-18); relatórios existentes: definida pelo spec (P-REL-19) |

#### Onde cada regra vale
| RN | Lançamento (tela e API) | Edição | Sistema (service role) | Carga do legado |
|---|---|---|---|---|
| RN-02 Quem lança | sim | — | não se aplica (sem sessão) | não |
| RN-03 Quem edita | — | sim | não se aplica (sem sessão) | não |
| RN-04 Semana atual | sim | não; vale a semana do relatório (RN-16) | sim, no relatório novo | não |
| RN-05 Sem data futura | sim | quando a data ou o horário mudam | sim | não |
| RN-06 Depois da reunião da semana | sim | não | sim, no relatório novo | não |
| RN-07 Um por semana | sim | não há como violar (RN-16) | sim | sim; repetidos pela 5.4 |
| RN-08 Campos da célula realizada | sim | sim, para o relatório como fica | sim | não; vem como está |
| RN-09 "Não houve célula" | sim | sim; "sem participantes" só na troca | sim | não; o motivo vem das observações (5.5) |
| RN-10 Participantes escolhidos | sim | os que entram; a retirada, com as exceções | sim, exceto a visibilidade | não; vêm como estão |
| RN-11 Participantes automáticos | sim | fixos; entram na troca para célula realizada | sim | não; vêm na lista do legado |
| RN-12 Visitantes | sim | sim | sim | só a normalização da 5.5 |
| RN-13 Oferta | sim | sim | sim | arredondada a 2 casas (5.5) |
| RN-14 Retrato | gravado da célula | não muda | gravado da célula | vem do legado; tipo vazio pela RN-21 |
| RN-15 Tudo ou nada e Auditoria | sim | sim | sim; autor "Sistema" (E2.05) | sem eventos (RN-10 e do E2.05) |
| RN-16 Célula fixa e semana do relatório | — | sim | sim | — |

#### Dados do legado
A tabela completa a 5.4 e a 5.5 do `docs/migracao.md`. Na última coluna, "nova" indica uma linha que ainda não está no plano.

| Situação no legado | Tratamento | Regra | No plano hoje |
|---|---|---|---|
| Relatório de qualquer data, inclusive de semanas antigas | Migra como está; as regras de data não se aplicam | RN-21 | sim (triggers desligados na carga, 5.5) |
| Dois relatórios não excluídos da mesma célula na mesma semana | Fica o mais recente; os outros migram excluídos; listar para a liderança | RN-07 | sim (5.4) |
| `CellType` vazio no relatório (a tela do legado não o enviava) | O retrato recebe o tipo da célula; o relatório de carga diz quantos | RN-14, RN-21 | nova |
| Líder, timóteo ou anfitrião do retrato excluído | Migra com a referência; aparece só pelo nome | RN-14 | nova (só para registro) |
| "Não houve célula" com participantes (os automáticos do legado) | Migram como estão | RN-09, RN-21 | nova (só para registro) |
| "Não houve célula" com tema, oferta maior que zero ou visitantes | Migram como estão; listar | RN-09, RN-21 | nova |
| Célula realizada sem tema | Migra como está; listar. A edição exige o tema (RN-08) | RN-08 | nova |
| Oferta negativa | Corrigir no legado. Não deve existir, porque a tela usa máscara de moeda | RN-13 | nova |
| Oferta com mais de 2 casas decimais | Arredondada | RN-13 | sim (5.5) |
| Visitantes vazios ou com espaços | Descartados os vazios; `trim` nos demais | RN-12 | sim (5.5) |
| `NumMembers` e `NumVisitors` | Não migram; conferem participantes e visitantes | RN-11, RN-12 | sim (5.5, 5.6) |

### Critérios de aceite
Convenções:
- "Pela API" é qualquer chamada feita fora da tela, com a sessão do usuário citado.
- "Recusado" quer dizer que nada é gravado: nem o relatório, nem os participantes, nem o evento (RN-15).
- "Hoje" é terça, 24/11/2026, às 15:00, em Brasília. A semana atual vai de domingo, 22/11, a sábado, 28/11/2026. Quando o critério precisa de outro momento, ele diz qual.
- Cada critério parte da massa original.

Massa de exemplo, coerente com a do E2.02, do E2.08 e do E2.10:

| Pessoa ou célula | Situação |
|---|---|
| Samuel e Magda | pastores (casal) |
| Pedro | G12, discípulo de Samuel, casado com Paula. Função Líder, com "Visualizar Seu Ministério", "Editar Célula", "Enviar Relatório das Próprias Células", "Editar Relatórios de Células" e "Excluir Relatórios de Células" |
| André | discípulo de Pedro, função Líder, casado com Beatriz, que é de outro ministério. André vê Beatriz pelo cônjuge; Pedro não vê Beatriz |
| Caio | discípulo de André; função Membro ("Visualizar Seu Ministério" e "Enviar Relatório das Próprias Células") |
| Carla | discípula de Paula; função Membro |
| Lucas | discípulo de Caio; função Membro; não tem papel em nenhuma célula |
| Júlia | do ministério de Pedro; função com "Visualizar Seu Ministério" e "Enviar Relatório de Qualquer Célula Visível", sem "Editar Relatórios de Células" |
| Fábio | discípulo de André, inativo |
| Ester | sem liderança |
| Diego | líder de outro ministério, função Líder. Pedro não vê Diego, e Diego não vê o ministério de Pedro |
| Rita | função Administrador |
| Bruno | excluído (E2.01) |
| C1 | líder André, timóteo Caio, anfitriã Carla; quarta, 20:00; Evangelística; ativa. **R1**, enviado por Caio: quarta, 18/11/2026, 20:00, célula realizada, tema "A fé que vence", 8 participantes (André, Caio, Carla e mais 5), 2 visitantes, oferta de R$ 50,00. Nenhum relatório nesta semana |
| C2 | célula de Diego, ativa |
| C3 | célula de Pedro; sexta, 19:30; Discipulado; **inativa** |
| C4 | líder e timóteo Samuel, anfitriã Magda; domingo, 10:00; Macrocélula; ativa |
| C5 | líder e anfitrião André, timóteo Caio; sábado, 22:00; Discipulado; ativa |

- **RN-01**
  - Dada sexta, 27/11/2026, às 10:00
  - Quando um script com a service role grava um relatório de C1 com a data 18/11
  - Então ele é recusado com a mensagem da RN-04.
  - Quando o mesmo script grava um relatório de C1 de quarta, 25/11, às 20:00, de célula realizada, com tema e oferta
  - Então ele é aceito, com o retrato de C1 e com André, Caio e Carla como participantes.
  - Dada a carga do legado com um relatório de C1 de 12/03/2025
  - Quando ela roda
  - Então o relatório é carregado como está.
  - Dado R1 excluído, sem outro relatório de C1 na semana dele
  - Quando Rita o restaura
  - Então ele volta, sem a conferência da semana atual (RN-17 do E2.01).
  - Quando qualquer pessoa tenta, pela API, gravar direto num relatório ou nos participantes dele, fora do caminho do lançamento e da edição
  - Então a gravação é recusada ou passa pelas mesmas regras. Nenhuma regra deste spec é contornada.
- **RN-02**
  - Dada quarta, 25/11/2026, às 21:30
  - Quando Caio, timóteo de C1, envia o relatório de C1
  - Então ele é aceito.
  - Quando, em vez dele, Carla (anfitriã), Pedro (com "Editar Célula") ou Júlia (com "Enviar Relatório de Qualquer Célula Visível") envia
  - Então o envio também é aceito.
  - Quando Lucas, que vê C1 e tem "Enviar Relatório das Próprias Células", mas não é pessoa de C1, tenta pela API
  - Então recebe "Você não pode enviar o relatório desta célula.", com o código `report_submit_not_allowed`, como no E2.02. O seletor dele não oferece C1, e a lista de Células não mostra "Novo relatório" para ele.
  - Dado Lucas com uma função que só tem "Visualizar Seu Ministério", sem nenhuma permissão de lançar
  - Quando ele tenta, pela API, enviar o relatório de C1
  - Então recebe "Você não tem permissão para esta ação.".
  - Quando Diego tenta, pela API, enviar o relatório de C1
  - Então recebe "Esta célula não existe ou já foi excluída.".
  - Quando Pedro tenta, pela API, enviar o relatório de C3, que está inativa
  - Então recebe "Esta célula está inativa e não recebe relatórios.". O seletor de Pedro não oferece C3.
  - Dada C1 excluída
  - Quando Caio tenta enviar pela API
  - Então recebe "Esta célula foi excluída e não recebe relatórios.".
  - Dado Fábio, inativo, como timóteo de C1, com a função Membro
  - Quando ele envia o relatório de C1
  - Então o envio é aceito.
  - Quando Samuel, pastor, envia o relatório de C4 de domingo, 22/11/2026, às 10:00
  - Então o envio é aceito.
- **RN-03**
  - Dado R2, o relatório de C1 de quarta, 25/11, às 20:00, enviado por Caio
  - Quando Caio tenta, pela API, mudar o tema de R2 ou incluir Lucas como participante
  - Então recebe "Você não tem permissão para esta ação.", e R2 não muda. Ele não vê "Editar" em R2. Hoje, pela DA-5 do E2.02, a inclusão seria aceita.
  - Quando Pedro muda o tema de R1, da semana passada
  - Então a mudança é aceita. Hoje o banco recusa.
  - Quando Diego tenta, pela API, editar R1
  - Então recebe "Este relatório não existe ou já foi excluído.".
  - Dada C1 inativa
  - Quando Pedro edita R1
  - Então a edição é aceita.
  - Dada C1 excluída
  - Quando Pedro tenta editar R1
  - Então recebe "A célula deste relatório foi excluída. Restaure a célula para editar o relatório.".
- **RN-04**
  - Dado sábado, 28/11/2026, às 23:50
  - Quando Caio abre "Novo relatório" em C5
  - Então o formulário sugere sábado, 28/11, às 22:00. Se ele enviar às 23:55, o envio é aceito.
  - Quando, com o formulário aberto desde as 23:50, ele envia no domingo, 29/11, às 00:02
  - Então recebe "O relatório precisa ser da semana atual, de 29/11/2026 a 05/12/2026.", e o formulário mantém o que foi digitado.
  - Dada quarta, 25/11/2026, às 21:30
  - Quando Caio ou Rita envia, pela API, um relatório de C1 com a data 18/11
  - Então recebe "O relatório precisa ser da semana atual, de 22/11/2026 a 28/11/2026.".
- **RN-05**
  - Dada quarta, 25/11/2026, às 20:30
  - Quando Caio envia o relatório de C1 de 25/11 às 20:30
  - Então o envio é aceito.
  - Quando ele envia com 25/11 às 20:31, ou com 26/11 às 20:00
  - Então recebe "O relatório não pode ser enviado para uma data ou horário futuros.". Hoje o banco aceita os dois.
  - Dada sexta, 27/11/2026, às 10:00
  - Quando Pedro muda a data de R2 para sábado, 28/11
  - Então recebe a mesma mensagem.
- **RN-06**
  - Dada terça, 24/11/2026, às 15:00
  - Quando Caio abre "Novo relatório" em C1
  - Então o topo do formulário mostra "A reunião desta semana ainda não aconteceu. O relatório pode ser enviado a partir de quarta, 25/11/2026, às 20:00.", e o formulário não deixa preencher.
  - Quando ele envia pela API, de célula realizada com a data 24/11, ou de "Não houve célula"
  - Então recebe a mesma mensagem.
  - Dada quarta, 25/11/2026, às 15:00
  - Quando Caio abre "Novo relatório" em C1
  - Então vê o mesmo aviso. Hoje o formulário sugere 25/11 às 20:00, e o banco aceita o envio.
  - Dada quarta, 25/11/2026, às 20:00 em ponto
  - Quando Caio envia o relatório de 25/11 às 20:00
  - Então o envio é aceito.
  - Dada quinta, 26/11/2026, às 10:00
  - Quando Caio envia o relatório de 25/11 às 19:30, ou de 24/11 às 20:00
  - Então recebe "O relatório não pode ser de antes da reunião da célula nesta semana (quarta, 25/11/2026, às 20:00).". Hoje o banco aceita os dois.
  - Dado o aparelho de Caio no horário de Lisboa, mostrando quarta, 25/11, às 00:30, quando em Brasília é terça, 24/11, às 21:30
  - Quando Caio abre "Novo relatório" em C1
  - Então vê o aviso de que a reunião ainda não aconteceu.
  - Dado o aparelho de Caio no horário de Manaus, mostrando quarta, 25/11, às 19:30, quando em Brasília são 20:30
  - Quando Caio abre "Novo relatório" em C1
  - Então o formulário sugere 25/11 às 20:00 e aceita o envio.
  - Dada C1 sem relatório na semana, com o dia mudado por Pedro para quinta às 19:00, na quarta, 25/11, às 21:00
  - Quando Caio abre "Novo relatório" em C1 na quarta, às 21:30
  - Então vê "A reunião desta semana ainda não aconteceu. O relatório pode ser enviado a partir de quinta, 26/11/2026, às 19:00.".
  - Dada uma célula de Pedro cadastrada na quinta, 26/11, às 10:00, com reunião às quartas, 20:00
  - Quando Pedro envia o relatório dela de quarta, 25/11, às 20:00
  - Então o envio é aceito, como no legado.
  - Dado domingo, 29/11/2026, às 09:59
  - Quando Samuel abre "Novo relatório" em C4
  - Então vê o aviso de que a reunião ainda não aconteceu. Às 10:00, o envio é aceito.
- **RN-07**
  - Dado R2 enviado por Caio
  - Quando Carla abre "Novo relatório" em C1
  - Então o topo mostra "O relatório para esta semana já foi enviado. Reunião de quarta, 25/11/2026, às 20:00 · Célula realizada.", e o formulário não deixa preencher.
  - Quando Pedro abre "Novo relatório" em C1
  - Então vê o mesmo aviso, com "Editar relatório".
  - Quando Carla envia pela API outro relatório de C1 desta semana
  - Então recebe "O relatório para esta semana já foi enviado.".
  - Quando Caio e Carla enviam o relatório de C1 ao mesmo tempo
  - Então só um é aceito. O outro recebe "O relatório para esta semana já foi enviado.", e C1 fica com um relatório só nesta semana.
  - Dado R2 de "Não houve célula"
  - Quando Pedro tenta enviar outro relatório de C1 desta semana, de célula realizada
  - Então recebe a mesma recusa.
  - Dado R2 excluído por Pedro
  - Quando Caio envia o relatório de C1 de 25/11 às 21:00
  - Então o envio é aceito. Se Rita tentar restaurar R2 depois, recebe "Esta célula já tem outro relatório na mesma semana. Exclua-o antes de restaurar este." (E2.01).
  - Dada uma célula C6 de Hugo, de outro ministério, com Caio como anfitrião hoje, e um relatório desta semana enviado quando as três pessoas de C6 eram do ministério de Hugo
  - Quando Caio abre "Novo relatório" em C6
  - Então vê só "O relatório para esta semana já foi enviado.", sem a data e sem ação.
  - Dada uma queda de conexão depois de o servidor gravar o envio de Caio
  - Quando Caio toca em "Enviar relatório" de novo, no mesmo formulário
  - Então não recebe esta recusa: vale a RN-20, e C1 fica com um relatório só.
  - Quando, em vez disso, Caio fecha o formulário, abre "Novo relatório" em C1 de novo e envia pela API
  - Então recebe "O relatório para esta semana já foi enviado.".
- **RN-08**
  - Quando Caio abre "Novo relatório" em C1, depois da reunião
  - Então vê as opções "Célula realizada" e "Não houve célula", lado a lado, com "Célula realizada" marcada.
  - Dada quarta, 25/11/2026, às 21:30
  - Quando Caio envia o relatório de C1 sem tema, ou com o tema "   "
  - Então vê "Informe o tema ministrado." no campo Tema, e nada é enviado. Pela API, o envio é recusado com a mesma mensagem. Hoje o banco aceita.
  - Quando ele envia sem horário
  - Então vê "Informe o horário da reunião.".
  - Quando ele digita "25:00" no horário e sai do campo
  - Então vê "Horário inválido. Informe a hora e os minutos, entre 00:00 e 23:59.".
  - Quando alguém envia pela API o horário "20:00:45"
  - Então o relatório é gravado com 20:00.
  - Quando Caio envia sem observações, sem visitantes e sem escolher participantes
  - Então o envio é aceito.
  - Quando Samuel envia o relatório de C4 (Macrocélula) sem tema
  - Então recebe a mesma recusa: as regras são as mesmas para os três tipos.
- **RN-09**
  - Dada quarta, 25/11/2026, às 21:30
  - Quando Caio escolhe "Não houve célula" em C1
  - Então o formulário não pede data nem horário e mostra "Reunião prevista: quarta, 25/11/2026, às 20:00". Ele esconde Tema, Participantes, Visitantes, Oferta e Observações, e pede o Motivo.
  - Quando Caio envia sem motivo
  - Então vê "Informe o motivo de não ter havido célula.".
  - Quando ele envia com o motivo "Chuva forte; a anfitriã ficou sem luz."
  - Então o relatório é gravado com 25/11 às 20:00 e o motivo, sem participantes (nem André, Caio e Carla), sem tema, visitantes, oferta e observações.
  - Quando ele envia pela API "Não houve célula" com a data 23/11, o tema "Oração" e a oferta de R$ 10,00
  - Então o relatório é gravado com 25/11 às 20:00, sem tema e sem oferta.
  - Dada terça, 24/11/2026, às 15:00
  - Quando Caio envia "Não houve célula" em C1
  - Então recebe "A reunião desta semana ainda não aconteceu. O relatório pode ser enviado a partir de quarta, 25/11/2026, às 20:00.", como no legado.
  - Quando Pedro passa R1 para "Não houve célula", com o motivo "Feriado"
  - Então R1 fica sem participantes, tema, visitantes, oferta e observações, continua com 18/11 às 20:00, e a Auditoria registra um evento só.
  - Dado R1 com Bruno, excluído, entre os participantes
  - Quando Pedro tenta passar R1 para "Não houve célula"
  - Então recebe "Este relatório tem participante com cadastro excluído e não pode passar para "Não houve célula".", e R1 não muda. Na tela, a opção "Não houve célula" fica desabilitada, com esse texto.
  - Dado R3, um relatório de C1 de "Não houve célula", gravado com a oferta 0
  - Quando Pedro o passa para célula realizada
  - Então o formulário pede Tema e Oferta, a oferta vem vazia, e André, Caio e Carla entram como participantes.
  - Dado R7, um relatório de "Não houve célula" vindo do legado, com André, Caio e Carla como participantes
  - Quando Pedro muda só o motivo
  - Então a edição é aceita, e os participantes ficam.
- **RN-10**
  - Dada quarta, 25/11/2026, às 21:30
  - Quando Caio escolhe Fábio, inativo, como participante
  - Então o seletor e a lista de escolhidos mostram "Fábio (inativo)", o envio é aceito, e Fábio continua inativo. Hoje o seletor não oferece Fábio.
  - Quando Caio envia pela API Lucas duas vezes entre os escolhidos
  - Então Lucas conta uma vez.
  - Quando André escolhe Beatriz, esposa dele, de outro ministério
  - Então o envio é aceito.
  - Quando Pedro procura Beatriz no seletor
  - Então não a encontra. Pela API, recebe "Você só pode escolher pessoas que você vê.".
  - Quando Rita escolhe Ester (sem liderança) ou Samuel (pastor)
  - Então o envio é aceito. Caio não encontra nenhum dos dois no seletor.
  - Quando Caio envia pela API Bruno, excluído, como participante
  - Então recebe "Este membro foi excluído e não pode ser escolhido.", e nada é gravado, nem o relatório.
  - Dado Lucas excluído enquanto Caio preenche o formulário com ele entre os escolhidos
  - Quando Caio envia
  - Então o envio é recusado, e nada é gravado. Lucas aparece marcado. Depois que Caio o retira, o envio é aceito.
  - Quando alguém envia pela API 1001 participantes
  - Então recebe "Um relatório pode ter no máximo 1000 participantes.".
  - Quando Pedro retira de R1 um participante que não é pessoa registrada nem tem o cadastro excluído
  - Então a edição é aceita, inclusive se for alguém que Pedro não vê.
  - Quando Pedro tenta retirar Bruno, excluído, de R1
  - Então recebe "Não é possível retirar um participante cujo cadastro foi excluído.".
- **RN-11**
  - Dada quarta, 25/11/2026, às 21:30
  - Quando Caio envia o relatório de C1 escolhendo só Lucas
  - Então os participantes são André, Caio, Carla e Lucas: 4. Antes do envio, a tela já mostra que André, Caio e Carla entram e o total 4.
  - Quando ele escolhe Lucas, Caio e Carla
  - Então os participantes continuam 4, sem duplicata.
  - Dado domingo, 29/11/2026, às 11:00
  - Quando Samuel envia o relatório de C4 sem escolher ninguém
  - Então os participantes são Samuel e Magda: 2.
  - Dada C1 com Beatriz, de outro ministério, como anfitriã
  - Quando Caio envia o relatório de C1
  - Então Beatriz entra como participante, embora Caio não a veja. O bloco da célula mostra só "Beatriz".
  - Dada C1 com Fábio, inativo, como timóteo
  - Quando Carla envia o relatório
  - Então Fábio entra como participante.
  - Quando Pedro tenta, pela API, retirar Caio dos participantes de R1
  - Então recebe "O líder, o timóteo e o anfitrião registrados no relatório não podem ser retirados dos participantes.".
  - Dado R2, e depois Rita troca o timóteo de C1 para Fábio
  - Então R2 continua com Caio como participante e como timóteo registrado, e o próximo relatório de C1 inclui Fábio.
- **RN-12**
  - Quando Caio informa os visitantes "  João   Silva ", um nome vazio, "Maria" e "Maria"
  - Então o relatório grava "João Silva", "Maria" e "Maria", com 3 visitantes.
  - Quando ele informa o visitante "Silva, João"
  - Então o relatório grava um visitante só.
  - Quando alguém envia pela API 1001 visitantes
  - Então recebe "Um relatório pode ter no máximo 1000 visitantes.".
  - Quando Caio envia "Não houve célula" pela API com visitantes
  - Então os visitantes não são gravados.
- **RN-13**
  - Quando Caio abre "Novo relatório" em C1, depois da reunião
  - Então a oferta vem vazia, com a dica "Se não houve oferta, informe 0,00.". Hoje vem 0.
  - Quando ele envia com a oferta vazia
  - Então vê "Informe a oferta. Se não houve oferta, informe R$ 0,00.".
  - Quando ele digita "0", ou "3750"
  - Então o campo mostra 0,00, ou 37,50; o envio é aceito, e o relatório mostra "R$ 0,00", ou "R$ 37,50".
  - Quando ele digita "5000" e depois apaga todos os dígitos
  - Então o campo fica vazio, e o envio mostra a mensagem da oferta vazia.
  - Quando alguém envia pela API a oferta −5
  - Então recebe "A oferta não pode ser negativa.". Hoje o banco aceita.
  - Quando alguém envia pela API a oferta 10,555
  - Então recebe "Oferta inválida. Informe um valor em reais, com até 2 casas decimais.".
  - Dado R2
  - Quando Lucas, que vê R2 pelo ministério, abre a lista de Relatórios
  - Então vê a oferta de R2. Diego não vê R2 nem a oferta.
- **RN-14**
  - Quando Caio envia R2
  - Então R2 guarda André, Caio, Carla e Evangelística.
  - Quando Caio envia R2 pela API informando Lucas como líder e Macrocélula como tipo
  - Então R2 guarda André, Caio, Carla e Evangelística, que são os de C1.
  - Dado R2, e depois Rita muda o timóteo de C1 para Fábio, o tipo para Discipulado e o dia para quinta
  - Então a edição de R2 mostra Caio como timóteo e Evangelística como tipo, a lista de Relatórios mostra André como líder de R2, e R2 não tem evento de alteração.
  - Dado R2, e depois Rita troca as três pessoas de C1 por Diego
  - Então Pedro deixa de ver C1 e de poder enviar o relatório dela, mas continua vendo R1 e R2, porque André, Caio e Carla estão registrados neles. O relatório seguinte de C1, enviado por Diego, não aparece para Pedro.
  - Quando Pedro abre a lista de Relatórios
  - Então R2 mostra o G12 "Pedro", que é o G12 atual de André. Um relatório de C4 mostra o G12 "Pastores".
  - Dada Carla com uma função que só tem "Enviar Relatório das Próprias Células"
  - Quando ela abre a lista de Relatórios
  - Então vê R1 e R2, em que está registrada como anfitriã.
  - Dado que Rita troca depois a anfitriã de C1 para Fábio, com a mesma função de Carla
  - Então Carla continua vendo R1 e R2, mas não os relatórios seguintes de C1. Fábio vê C1, mas não R1 nem R2.
  - Dado um relatório antigo com Bruno, excluído, como timóteo registrado
  - Quando Pedro o abre
  - Então o bloco mostra "Bruno" só pelo nome, sem acesso ao cadastro.
- **RN-15**
  - Quando Caio envia R2 escolhendo 5 membros
  - Então a Auditoria tem um evento só, com os 8 participantes, e R2 mostra só "Enviado por Caio … em 25/11/2026 às …".
  - Quando um dos escolhidos é excluído no meio do envio
  - Então nada é gravado: nem R2, nem participantes, nem evento.
  - Quando Pedro muda o tema de R2, inclui Fábio e retira Lucas, numa gravação
  - Então a Auditoria tem um evento só, com o tema anterior e o novo, Fábio incluído e Lucas retirado, e R2 mostra "Alterado por Pedro …".
  - Quando Pedro abre R2 e salva sem mudar nada
  - Então vê "Nenhuma alteração para salvar.", e nenhum evento é gravado.
  - Quando Rita muda o tipo de C1
  - Então R2 não ganha evento de alteração.
- **RN-16**
  - Quando Pedro muda a data de R1 (18/11 às 20:00) para quinta, 19/11, às 19:30
  - Então a edição é aceita, mesmo com o horário antes do horário de C1.
  - Quando ele muda a data de R1 para 25/11, ou para 14/11
  - Então recebe "Na edição, a data só pode mudar dentro da semana do relatório, de 15/11/2026 a 21/11/2026.".
  - Quando alguém tenta, pela API, passar R1 para C5
  - Então recebe "A célula de um relatório não pode ser trocada.".
  - Dado R3 de "Não houve célula"
  - Quando Pedro abre a edição
  - Então a data e o horário aparecem só para leitura.
- **RN-17**
  - Quando Caio abre "Novo relatório" pela lista de Relatórios
  - Então o seletor oferece C1 e C5, e não C2 nem C3. Buscando "André", ele encontra C1 e C5.
  - Quando ele escolhe C1
  - Então vê, só para leitura: Líder André, Timóteo Caio, Anfitrião Carla, G12 Pedro, Tipo Evangelística, Quarta, 20:00, e o endereço de C1. O rótulo continua "Anfitrião", mesmo sendo Carla.
  - Quando Caio usa "Novo relatório" na linha de C1, na lista de Células
  - Então o formulário abre com C1 escolhida, e a célula não pode ser trocada.
  - Dado R2, e depois Rita troca o timóteo de C1 para Fábio
  - Quando Pedro abre a edição de R2
  - Então o bloco mostra Caio, que é o timóteo registrado, e não Fábio.
  - Quando Samuel escolhe C4
  - Então o bloco mostra o G12 "Pastores".
- **RN-18**
  - Dada sexta, 27/11/2026, às 10:00
  - Quando Caio escolhe C1
  - Então o formulário sugere quarta, 25/11/2026, às 20:00, e a lista de datas tem só "Quarta, 25/11/2026", "Quinta, 26/11/2026" e "Sexta, 27/11/2026 (hoje)".
  - Dada quarta, 25/11/2026, às 21:30
  - Quando Caio escolhe C1
  - Então a data aparece como texto, "Quarta, 25/11/2026", porque é o único dia possível.
  - Dada terça, 24/11/2026, às 15:00
  - Quando Caio escolhe C1
  - Então não há sugestão, e vale o aviso da RN-19. Hoje o formulário sugere 18/11, que o banco recusa.
  - Dado sábado, 28/11/2026, às 23:00
  - Quando Caio, com a data alterada à mão, troca a célula de C1 para C5
  - Então a sugestão passa a ser sábado, 28/11, às 22:00.
  - Quando Pedro abre a edição de R1
  - Então vêm 18/11 e 20:00, sem sugestão, e a lista de datas vai de domingo, 15/11, a sábado, 21/11/2026.
- **RN-19**
  - Dado o aviso de "já foi enviado" na tela de Carla para C1, e depois Pedro exclui R2
  - Quando Carla fecha e abre "Novo relatório" em C1 de novo
  - Então o formulário deixa preencher.
  - Dado o formulário de Caio aberto e preenchido para C1, e depois Carla envia o relatório de C1 antes dele
  - Quando Caio envia
  - Então recebe a recusa da RN-07, sem perder o que digitou.
  - Dada C1 inativada por Pedro com o formulário de Caio aberto
  - Quando Caio envia
  - Então recebe a mensagem da célula inativa (E2.08), sem perder o que digitou.
  - Dada uma falha de conexão na conferência, quando Caio abre "Novo relatório" em C1 na quarta, 25/11, às 21:30
  - Então o formulário deixa preencher, com o aviso "Não foi possível conferir se o relatório desta semana já foi enviado. Você pode preencher; a conferência é feita ao enviar." e "Tentar de novo", e sugere quarta, 25/11/2026, às 20:00.
  - Quando Caio, com o tema já digitado, toca em "Tentar de novo", e R2 já tinha sido enviado por Carla
  - Então o aviso de "já foi enviado" aparece no topo, e o tema digitado fica.
- **RN-20**
  - Quando Caio salva sem tema, sem oferta e com o horário "25:00"
  - Então vê os três erros de uma vez, cada um no seu campo, e "Confira os campos destacados (3).".
  - Quando alguém envia pela API sem tema e com data futura
  - Então recebe só "Informe o tema ministrado.".
  - Quando Lucas envia pela API o relatório de C1 com data futura
  - Então recebe só "Você não pode enviar o relatório desta célula.".
  - Quando Caio envia com sucesso
  - Então vê "Relatório enviado.". Quando Pedro salva uma edição, vê "Relatório atualizado.".
  - Quando Caio toca duas vezes seguidas em "Enviar relatório"
  - Então o botão mostra "Enviando…", e só um envio é feito.
  - Dada uma queda de conexão no envio, antes de o servidor gravar
  - Quando Caio envia
  - Então vê "Não foi possível enviar o relatório. Verifique a conexão e tente de novo.", e o formulário mantém o que foi digitado. Quando ele toca em "Enviar relatório" de novo, com a conexão de volta, o envio é aceito.
  - Dada uma queda de conexão depois de o servidor gravar o envio de Caio, com a resposta perdida
  - Quando Caio toca em "Enviar relatório" de novo, sem mudar nada
  - Então vê "Relatório enviado.", C1 continua com um relatório só, e a Auditoria tem um evento só.
  - Quando, em vez disso, ele troca o tema antes de tocar de novo
  - Então vê "O relatório foi enviado na primeira tentativa. As alterações feitas depois não foram salvas.", e o relatório continua com o tema da primeira tentativa.
- **RN-21**
  - Dado no legado um relatório de C1 de 12/03/2025, com "Não houve célula", as observações "Feriado" e André, Caio e Carla como participantes
  - Quando a carga roda
  - Então o relatório migra com o motivo "Feriado" e os 3 participantes.
  - Dado no legado um relatório sem tipo da célula
  - Quando a carga roda
  - Então o retrato recebe o tipo da célula, e o relatório de carga conta esse relatório.
  - Quando a reconciliação roda
  - Então o número de participantes de cada relatório é igual ao `NumMembers`, e o de visitantes é igual ao `NumVisitors`.
  - Dados R1 e um relatório de "Não houve célula" de C1 com oferta 0, já existentes no novo antes da publicação
  - Quando este passo é publicado
  - Então R1 recebe o retrato com André, Caio, Carla e Evangelística, sem nenhuma outra mudança, e o relatório de "Não houve célula" continua com a oferta 0.

### Textos de tela
Vocabulário de referência. O `ux-designer` pode ajustar o tom, mas não o sentido nem os termos. Os textos vindos do desenho de UX e aprovados pelo PO em 2026-11-24 (PO-UX-1 a PO-UX-10) que estão ligados a uma regra já estão na tabela. Os demais textos de tela estão em "Textos", na seção Experiência (UX).
- **Termos:** Relatório, Novo relatório, Editar relatório, Enviar relatório, Célula, Reunião, Célula realizada, Não houve célula, Motivo, Data, Horário, Tema, Participantes, Visitantes, Oferta, Observações, Líder, Timóteo, Anfitrião, G12, Tipo, Dia e horário, Endereço, Enviado por, Alterado por.
- **Evitar:**
  - "Encontro" para a reunião da célula, porque Encontro é o retiro da Consolidação;
  - "Tema da Palavra", "Participantes (Membros)", "Observações Gerais" e "Motivo do Cancelamento";
  - "doação" ou "dízimo" no lugar de "oferta";
  - "assistente" ou "auxiliar" no lugar de "timóteo";
  - "Modalidade" no lugar de "Tipo";
  - "Status" no lugar de "Situação";
  - maiúscula em toda palavra ("Novo Relatório").

| Situação | Texto |
|---|---|
| título do formulário | Novo relatório · Editar relatório |
| bloco da célula (só leitura) | Líder · Timóteo · Anfitrião (os rótulos não mudam com o sexo) · G12 · Tipo · Dia e horário · Endereço · na edição: Líder, timóteo, anfitrião e tipo registrados no envio. |
| situação da reunião | Célula realizada · Não houve célula (duas opções lado a lado; "Célula realizada" marcada) |
| data | {Dia}, {dd/mm/aaaa} · {Dia}, {dd/mm/aaaa} (hoje) · dica no lançamento: Entre {dia}, {dd/mm/aaaa}, às {HH:mm}, e agora. · dica na edição: Dentro da semana do relatório, de {dd/mm/aaaa} a {dd/mm/aaaa}. |
| troca de célula | Data e horário trocados pela reunião desta célula. |
| conferência antes de preencher | Conferindo o relatório desta semana… · se falhar: Não foi possível conferir se o relatório desta semana já foi enviado. Você pode preencher; a conferência é feita ao enviar. · Tentar de novo |
| participantes automáticos | O líder, o timóteo e o anfitrião entram automaticamente. · no seletor: Já entra automaticamente. · Participantes: {N} |
| participante inativo (aviso, não impede o envio) | {Nome} (inativo) · {Nome} (inativa) |
| "Não houve célula" | Não houve célula · Reunião prevista: {dia}, {dd/mm/aaaa}, às {HH:mm} · Motivo * · dica: Por exemplo: feriado, chuva forte, viagem do anfitrião. |
| o que sai ao trocar a situação | Ao enviar, não será enviado: {item}. · Ao enviar, não serão enviados: {itens}. · Ao salvar, sai do relatório: {item}. · Ao salvar, saem do relatório: {itens}. · Ao salvar, o motivo sai do relatório, e o líder, o timóteo e o anfitrião registrados entram como participantes. |
| oferta (dica) | Se não houve oferta, informe 0,00. |
| botões | Enviar relatório (lançamento) · Salvar alterações (edição) · Enviando… · Salvando… · Cancelar · Fechar · Editar relatório (no aviso de "já foi enviado") · Adicionar visitante |
| sucesso | Relatório enviado. · Relatório atualizado. |
| repetição do mesmo envio com o formulário alterado entre as tentativas | O relatório foi enviado na primeira tentativa. As alterações feitas depois não foram salvas. |
| sem célula | Escolha a célula. |
| sem data, sem horário, horário inválido, data inválida (API) | Informe a data da reunião. · Informe o horário da reunião. · Horário inválido. Informe a hora e os minutos, entre 00:00 e 23:59. · Data inválida. |
| sem tema | Informe o tema ministrado. |
| sem motivo | Informe o motivo de não ter havido célula. |
| oferta | Informe a oferta. Se não houve oferta, informe R$ 0,00. · A oferta não pode ser negativa. · Oferta inválida. Informe um valor em reais, com até 2 casas decimais. |
| semana atual | O relatório precisa ser da semana atual, de {dd/mm/aaaa} a {dd/mm/aaaa}. |
| data futura | O relatório não pode ser enviado para uma data ou horário futuros. |
| reunião ainda não aconteceu | A reunião desta semana ainda não aconteceu. O relatório pode ser enviado a partir de {dia}, {dd/mm/aaaa}, às {HH:mm}. |
| antes da reunião | O relatório não pode ser de antes da reunião da célula nesta semana ({dia}, {dd/mm/aaaa}, às {HH:mm}). |
| já enviado | O relatório para esta semana já foi enviado. · para quem vê o relatório: Reunião de {dia}, {dd/mm/aaaa}, às {HH:mm} · Célula realizada (ou Não houve célula). · com "Editar Relatórios de Células": Editar relatório |
| edição fora da semana | Na edição, a data só pode mudar dentro da semana do relatório, de {dd/mm/aaaa} a {dd/mm/aaaa}. |
| trocar a célula (API) | A célula de um relatório não pode ser trocada. |
| retirar pessoa registrada | O líder, o timóteo e o anfitrião registrados no relatório não podem ser retirados dos participantes. |
| "Não houve célula" com participante excluído | Este relatório tem participante com cadastro excluído e não pode passar para "Não houve célula". |
| limites | Um relatório pode ter no máximo 1000 participantes. · Um relatório pode ter no máximo 1000 visitantes. |
| sem permissão, célula invisível, excluída e inativa | sem nenhuma permissão de lançar: Você não tem permissão para esta ação. · com permissão de lançar, mas não nesta célula (E2.02, `report_submit_not_allowed`): Você não pode enviar o relatório desta célula. · Esta célula não existe ou já foi excluída. · Esta célula foi excluída e não recebe relatórios. · Esta célula está inativa e não recebe relatórios. (com a orientação da P-CEL-17 do E2.08) |
| participantes (E2.01 e E2.02) | Este membro foi excluído e não pode ser escolhido. · Você só pode escolher pessoas que você vê. · Não é possível retirar um participante cujo cadastro foi excluído. |
| relatório e célula excluídos (E2.01) | Este relatório não existe ou já foi excluído. · A célula deste relatório foi excluída. Restaure a célula para editar o relatório. |
| sem alteração (E2.05) | Nenhuma alteração para salvar. |
| queda de conexão | Não foi possível enviar o relatório. Verifique a conexão e tente de novo. · na edição: Não foi possível salvar o relatório. Verifique a conexão e tente de novo. |
| topo do formulário | Campos com * são obrigatórios. · com erro: Confira os campos destacados ({N}). |

### Telas afetadas
- **Formulário de relatório (`CellReportForm`), em "Novo relatório":**
  - o diálogo responsivo, igual pelos quatro caminhos (UXD-1 da UX);
  - o bloco da célula só para leitura, com os rótulos fixos (RN-17, P-REL-28);
  - a conferência e o aviso no topo antes de preencher, sem deixar preencher; se a conferência falhar, os campos com um aviso que não bloqueia (RN-19, P-REL-25);
  - a situação em duas opções, "Célula realizada" e "Não houve célula" (RN-08, P-REL-21);
  - a data numa lista com os dias possíveis, calculados em Brasília, e o horário sugeridos pela reunião da semana (RN-18, P-REL-22);
  - o horário digitado em 24 h (P62 do E2.08);
  - "Não houve célula" sem data e horário, mostrando a reunião prevista e só o Motivo (RN-09);
  - os campos na ordem da P-REL-24;
  - os participantes com os inativos marcados, e os automáticos mostrados e contados antes do envio (RN-10, RN-11);
  - os visitantes um por campo, como no legado, e não separados por vírgula (RN-12);
  - a oferta obrigatória, vazia no começo, digitada pelos centavos (RN-13, P-REL-23);
  - os rótulos da P-REL-20 e os botões da P-REL-26;
  - todos os erros juntos ao enviar e as recusas do servidor no lugar certo (RN-20);
  - um envio só, que pode ser repetido sem gravar outro relatório (RN-20, P-REL-29), sem o estado "relatório salvo sem os participantes".
- **Formulário de relatório, em "Editar relatório":**
  - a célula fixa e o bloco com as pessoas e o tipo registrados (RN-16, RN-17);
  - a data numa lista com os dias da semana do relatório (RN-16, P-REL-22);
  - as pessoas registradas fixas entre os participantes (RN-11);
  - a troca entre célula realizada e "Não houve célula" (RN-09);
  - "Salvar alterações" (P-REL-26);
  - a autoria (E2.05).
- **Lista de Relatórios:** o líder mostrado e buscado é o registrado, com o G12 atual dele (RN-14 d). Os relatórios visíveis seguem o retrato (RN-14 a, b).
- **Lista de Células, detalhe da célula (E2.10) e atalho "Novo relatório" do Dashboard:** abrem o mesmo formulário.
- Nenhuma tela nova.

### Fora de escopo
Cada item indica o passo que cuida dele, quando há um.
- **Lista de relatórios com filtros e atalhos de semana** (REL-13): E2.12. Este spec só define o líder e o G12 de cada relatório pelo retrato (RN-14 d).
- **Exportação para Excel** (REL-14): E2.13.
- **Dashboard** (DSH-02 a DSH-06): E2.14.
- **Excluir e restaurar relatório** (DEL-03, CEL-08): E2.01.
- **Escopo e funções** (quem vê relatórios): E2.02. Este spec só passa a RN-04 de lá para o retrato e revê a DA-12.
- **Autoria e Auditoria:** E2.05. Este spec só as usa.
- **Situação do relatório por célula** (CEL-05): E2.09. O lançamento não depende da situação.
- **Detalhe da célula com os últimos relatórios** (CEL-07): E2.10.
- **Relatório atrasado, de semana passada:** o legado não tem (ver Q-1).
- **"Não houve célula" antes do horário (cancelamento avisado):** o legado não tem (ver Q-2).
- **Relatório de reunião antecipada:** o legado não tem (ver Q-3).
- **Visitantes como cadastro:** os visitantes continuam nomes livres. Virar consolidado depende do spec da Consolidação (ver Q-7).
- **Consolidado como participante:** a Consolidação ainda não existe. Quando existir, o spec dela diz se o consolidado pode ser escolhido como participante.
- **Número do relatório:** o novo não tem. O `legacy_id` fica só para rastreio (7.4).
- **Rascunho, envio sem conexão e lembretes de relatório pendente:** sem passo no plano.
- **Tesouraria** (conferência, recibo e destino das ofertas): sem passo no plano.
- **Fotos e anexos no relatório:** sem passo no plano.
- **Lançar o relatório de várias células de uma vez:** sem passo no plano.
- **Regras próprias da Macrocélula:** nenhuma, como no E2.08 (Q-5 de lá).

### Impactos em outros passos
Pontos de negócio que outros passos precisam respeitar. O `architect` decide como.
- **E2.01:**
  - a gravação de participantes (`set_cell_report_participants`, DT-15) passa a fazer parte do lançamento e da edição;
  - a RN-13 de lá continua: o participante excluído fica e não sai;
  - a consulta "Ver relatório" do relatório de célula excluída mostra as pessoas e o tipo registrados (RN-14 c).
- **E2.02:**
  - a RN-04 de lá passa a usar o retrato. Fim da transição "até o E2.11";
  - o item (d) da RN-02 de lá passa a "os relatórios em que a pessoa está registrada" (RN-14 b). É a revisão da DA-12;
  - a DA-5 deixa de existir (RN-03);
  - os participantes automáticos ficam isentos da RN-09 (b) (RN-11);
  - a recusa de quem não pode lançar numa célula usa o texto e o código de lá, "Você não pode enviar o relatório desta célula." (`report_submit_not_allowed`), e quem não tem nenhuma permissão de lançar recebe "Você não tem permissão para esta ação." (P-REL-27). Nada muda no E2.02.
- **E2.05:** a `save_cell_report` passa a ser o lançamento e a edição deste passo, com o mesmo resultado para a tela. O retrato não conta como alteração.
- **E2.07:** os relatórios novos de "Não houve célula" não têm participantes. Os antigos ainda têm, e a P-FIL-08 de lá já os ignora.
- **E2.08:**
  - a recusa da célula inativa (RN-11 c de lá) continua no lançamento, com a orientação da P-CEL-17;
  - o horário do relatório usa o mesmo campo digitado (P62).
- **E2.09:**
  - a célula cadastrada depois da reunião recebe o relatório dela (RN-06);
  - a P-SIT-17 fica respondida pela RN-19;
  - o aviso de "ainda não aconteceu" usa o mesmo momento de reunião da RN-02 de lá. Entre a reunião e o prazo de 1 hora, a célula está "Ainda não ocorreu", e o relatório já pode ser enviado.
- **E2.10:**
  - o número de participantes inclui os automáticos;
  - a visibilidade dos relatórios no detalhe segue o retrato;
  - "Oferta: Não informada" (P-LCE-31) não aparece nos relatórios de célula realizada enviados a partir deste passo. A regra de lá continua valendo;
  - **coerência de texto:** o fluxo F5 de lá diz "Salvar relatório", mas o botão do lançamento é "Enviar relatório" (P-REL-20). O E2.10 corrige o F5 na próxima revisão.
- **E2.12:**
  - o líder e o G12 de cada relatório já vêm do retrato (RN-14 d);
  - os filtros de líder e de G12 usam o líder registrado, como o filtro do legado (`Domain/Extensions/QueryingExtensions.cs:386-393`);
  - quando a consulta do relatório ("Ver relatório") valer para todos que veem o relatório, o aviso de "já foi enviado" (RN-07, RN-19) passa a oferecer "Ver relatório" a quem vê o relatório e não pode editá-lo (P-REL-31). Até lá, ele oferece só "Editar relatório", a quem pode editar.
- **E2.13:** o legado ordena a planilha pelo G12 do líder **atual** da célula (`App/Services/ExportService.cs:40`). O E2.13 decide se segue o legado ou o retrato. Recomendação do PO: seguir o legado, para a planilha bater na homologação.
- **E2.14:**
  - "relatórios enviados" continua contando os de "Não houve célula";
  - os números de participantes incluem os automáticos.
- **E4.02:** as colunas do retrato já estão na 5.3.
- **E4.04:** o saneamento lista:
  - os relatórios sem tipo;
  - os de "Não houve célula" com tema, oferta maior que zero ou visitantes;
  - os de célula realizada sem tema;
  - as ofertas negativas.
- **E4.06:** o retrato vem do legado, com o tipo vazio tratado pela RN-21.
- **E4.09:** a 5.6 já confere participantes e visitantes. Ela ganha a contagem dos relatórios com o tipo preenchido pela carga.
- **Aceite (PO):**
  - no `docs/migracao.md`:
    - REL-01 a REL-12 e REL-15 em ✅;
    - as linhas novas da tabela [Dados do legado](#dados-do-legado) na 5.4 e na 5.5;
    - o E2.11 na seção Progresso;
  - no `CLAUDE.md`:
    - na matriz, em ✅: "Lançamento de relatório", "Regras do relatório", "Líder, timóteo e anfitrião como participantes automáticos" e "Snapshot de líder, anfitrião, timóteo e tipo no relatório";
    - em "Novo: estado atual", os triggers de relatório dão lugar ao lançamento numa operação só, com o retrato;
    - nos "Problemas conhecidos", saem o `calculateCellDate` e a regravação dos participantes;
    - nas "Armadilhas", o item do trigger de semana atual que barra a carga muda, porque o trigger sai.

### Pontos para o `architect`
Não são dúvidas de negócio. São pontos em que a regra depende de uma escolha técnica.
1. **Um caminho só** (RN-01, RN-15).
   - O lançamento e a edição numa chamada que grava tudo ou nada.
   - Ela substitui a `save_cell_report` (DT-09 do E2.05) e a `set_cell_report_participants` (DT-15 do E2.01).
   - As gravações diretas em `cell_reports` e `cell_report_participants` precisam ser fechadas ou passar pelas mesmas regras, inclusive para a service role.
2. **"Agora" no servidor** (RN-04 a RN-06, RN-18). O momento e a semana são calculados em `America/Sao_Paulo` quando o envio chega. Uma tabela de casos única, lida pelos testes da tela e do banco, como a AQ-4 do E2.08, deve cobrir:
   - a semana;
   - a reunião da semana;
   - o futuro;
   - a virada de sábado para domingo;
   - o aparelho em outro fuso.
3. **Triggers de semana** (passo E2.11 do plano).
   - Saem o de semana atual e o de semana única.
   - O índice `cell_reports_cell_week_key` fica e vale também na carga.
   - Na corrida, a recusa traz a mensagem da RN-07, e não a técnica.
4. **Retrato e corrida com a célula** (RN-14).
   - O retrato é lido da célula na mesma operação do envio.
   - Com uma edição simultânea da célula, o retrato é todo de antes ou todo de depois, nunca uma mistura.
   - O mesmo vale para a inativação (ponto 6 do E2.08).
5. **Visibilidade pelo retrato** (RN-14 a, b). O escopo, o item (d) e a lista de Relatórios passam a olhar as pessoas registradas, nas views e nas políticas espelhadas.
6. **Conferência antes de preencher** (RN-19). Uma leitura que diga, para uma célula:
   - se a semana atual já tem relatório, e qual, só para quem o vê;
   - o momento da reunião da semana.

   A leitura não pode mostrar o conteúdo do relatório a quem não o vê.
7. **Recusas com código e campo** (RN-20). Cada recusa traz código e campo, como na AQ-2 do E2.01, e a identificação do relatório existente só vai para quem o vê (RN-07).
8. **Relatórios existentes** (RN-21). O preenchimento do retrato na publicação precisa estar pronto antes de a visibilidade mudar (ponto 5), senão os relatórios antigos somem para quem os via.
9. **Oferta** (RN-13). Ela é obrigatória na célula realizada só no que muda: os relatórios antigos de "Não houve célula" têm oferta 0, e os do legado podem ter valores.
10. **Tamanho dos textos.** O legado não limita tema, motivo, observações nem os nomes dos visitantes, e o E2.04 também não limitou o nome do membro. O `architect` define um teto técnico alto, que não afete o uso real, com mensagem.
11. **Edição simultânea** (RN-16). Vale a última gravação. Os participantes não podem ficar numa mistura das duas edições.
12. **Envio que pode ser repetido** (RN-20, P-REL-29; AQ-4 da UX).
    - Cada formulário aberto identifica o seu envio, por exemplo com o id do relatório gerado ao abrir.
    - A repetição desse envio, depois de uma queda de conexão, devolve o relatório já gravado, sem gravar outro, sem mudar o gravado e sem outro evento na Auditoria.
    - Ela diz se o conteúdo repetido é igual ao gravado, para a tela escolher entre "Relatório enviado." e o aviso de alterações não salvas.
    - Um envio de outro formulário continua recebendo a recusa da RN-07.
    - A recusa de permissão, de escopo e de célula inativa vale também na repetição: se a pessoa perdeu o direito entre as tentativas, e a primeira não foi gravada, a repetição é recusada.
13. **Ordem dos passos.** Este passo usa:
    - o E2.01, já em produção no banco;
    - o E2.02: quem lança, o escopo e a RN-09;
    - o E2.05: autoria e Auditoria;
    - o E2.08: célula inativa e horário digitado.

    Ele mexe nas mesmas regras de escrita de relatório que esses passos.

### Perguntas em aberto
Nenhuma bloqueante. Os pontos que as fontes não respondiam viraram padrões, listados em [Padrões definidos por este spec](#padrões-definidos-por-este-spec-revisar-no-pr), para o usuário revisar no PR. Os que mais mudam o resultado são:
- **P-REL-06:** "Não houve célula" sem participantes. O legado incluía o líder, o timóteo e o anfitrião.
- **P-REL-11:** a oferta é obrigatória e começa vazia. O legado começava em R$ 0,00.
- **P-REL-02:** na edição, a célula não muda, e a data só muda dentro da semana do relatório.
- **P-REL-09:** o líder, o timóteo e o anfitrião registrados não saem dos participantes, nem na edição.
- **P-REL-08:** o membro inativo pode ser escolhido como participante, como no legado. Hoje o novo não oferece.
- **P-REL-13:** quem entra numa célula não vê, só por isso, os relatórios anteriores dela.
- **P-REL-01:** nem o administrador lança relatório de semana passada.
- **P-REL-29:** repetir o mesmo envio depois de uma queda de conexão não grava outro relatório e mostra o sucesso normal.

As pendências da UX (PO-UX-1 a PO-UX-11) foram resolvidas em 2026-11-24 e viraram os padrões P-REL-21 a P-REL-31.

Sugestões que não entram, porque o legado não tem a regra. O usuário decide se viram regra nova:
- **Q-1.** Permitir o relatório atrasado, de uma semana que já passou? Por exemplo, a célula de sábado às 22:00 só tem até as 23:59 para enviar. Se sim, quem pode lançá-lo (só quem edita relatórios?) e até quantas semanas para trás?
- **Q-2.** Permitir "Não houve célula" antes do horário da reunião, quando o cancelamento é avisado com antecedência (feriado, viagem)?
- **Q-3.** Permitir o relatório de uma reunião antecipada (a célula de quarta que se reuniu na terça)? Hoje quem lança precisa usar uma data a partir de quarta, e quem edita relatórios corrige depois (RN-16 permite).
- **Q-4.** A oferta pode ficar "não informada", por exemplo quando ela é contada depois por outra pessoa? Adotado: não, ela é obrigatória (P-REL-11).
- **Q-5.** Quem edita relatórios pode retirar o timóteo ou o anfitrião que faltou à reunião? Adotado: não (P-REL-09).
- **Q-6.** Quem lançou pode corrigir o próprio relatório por um tempo (por exemplo, até o fim da semana)? Adotado: não, como na RN-14 do E2.02.
- **Q-7.** Quando existir a Consolidação, os visitantes de célula viram consolidados? É a pergunta que o `CLAUDE.md` deixa para a Consolidação.
- **Q-8.** Ter um atalho "Repetir os participantes do último relatório", que traz os participantes do relatório anterior da célula para a pessoa só tirar quem faltou e incluir quem veio? É a sugestão da UX (PO-UX-11), porque escolher os participantes é o passo mais demorado do envio. Se sim, falta decidir qual relatório conta (o último de célula realizada?) e o que fazer com quem a pessoa não vê, com quem foi excluído e com quem ficou inativo. Adotado: não há atalho.

## Experiência (UX)
_Seção do `ux-designer`. Escrita em 2026-11-24 a partir destas fontes:_
- _a seção Negócio (RN-01 a RN-21, P-REL-01 a P-REL-20, a massa de exemplo, os Textos de tela, as Telas afetadas, os Impactos, os Pontos para o `architect` e as perguntas Q-1 a Q-7);_
- _o código da `origin/main` do `mci-connect` (`4595daa`): `CellReportForm.tsx`, `pages/CellReports.tsx`, `EditRecordDialogs.tsx`, `StatusBadge.tsx`, `select/PaginatedSelect.tsx`, `select/select-styles.ts`, `ui/alert.tsx`, `ui/dialog.tsx`, `lib/cell-reports/report-form.ts`, `lib/cell-reports/participants.ts`, `lib/cell-reports/fields.ts`, `lib/cells/labels.ts`, `lib/cells/fields.ts`, `hooks/use-cell-options.ts`, `hooks/use-member-options.ts`, `lib/deletion/texts.ts`, `src/index.css` e `index.html`;_
- _o que já foi desenhado para as mesmas telas:_
  - _o formulário de célula do [E2.08](e2-08-cadastro-celulas.md) (T1 a T8, P60 a P65);_
  - _os erros e o envio do [E2.04](e2-04-validacoes-membro.md) (T7, P20 a P24);_
  - _o participante excluído e o "Ver relatório" do [E2.01](e2-01-exclusao-logica.md) (T7 e T8);_
  - _a autoria do [E2.05](e2-05-auditoria-autor.md) (T1, T4, T5, P30 e P31);_
  - _o seletor de célula, o atalho do Dashboard e as recusas do [E2.02](e2-02-perfis-escopo.md) (T8, T9, T11, P11 e P12);_
  - _o P44 do [E2.06](e2-06-hierarquia-totais.md), a P-SIT-17 do [E2.09](e2-09-situacao-relatorio.md) e o detalhe da célula do [E2.10](e2-10-listagem-celulas.md) (T8, T11 e T14);_
  - _o diálogo responsivo (P1) e o seletor múltiplo (P5) de [Escolas](escolas.md);_
- _o Negócio do [E2.12](e2-12-listagem-relatorios.md), ainda sem commit, só lido: a linha e o painel da lista de Relatórios que vêm depois deste passo;_
- _o legado, só para manter o que os usuários conhecem: o bloco da célula só para leitura, a caixa "Não houve célula", a data e o horário com máscara, a oferta com máscara de reais, os visitantes um por campo com "+" e o botão "Enviar relatório" (`UI/pages/Report/details.js:218-458`)._

_Este passo só é implementado depois do E2.01, do E2.02, do E2.05, do E2.06, do E2.08, do E2.09 e do E2.10, então o desenho parte das telas deles, e não do código de hoje. Usa os padrões P1 a P85. Os padrões novos começam em P100, para não colidir com os outros specs. Nenhuma regra de negócio foi criada aqui. Onde a tela precisou de algo que o spec não diz, a decisão é a mais conservadora, marcada como "definido pela UX" e listada em "Pendências para o PO". Os nomes são os da [massa de exemplo](#critérios-de-aceite); os sobrenomes, as ruas e os participantes que não estão na massa existem só nos wireframes._

### O que muda, tela a tela
Nenhuma tela nova e nenhuma rota nova.

| Tela ou parte | O que muda | Para quem |
|---|---|---|
| Formulário de relatório: estrutura (T1) | Passa ao diálogo responsivo (P1): tela cheia no celular, com cabeçalho e rodapé fixos e confirmação ao descartar. Títulos "Novo relatório" e "Editar relatório". Os campos só aparecem depois de a célula estar escolhida e conferida. Os grupos são "Reunião", "Participantes" e "Visitantes", e sai "Detalhes do Encontro". | quem lança e quem edita relatórios |
| Célula (T2) | Aberto a partir de uma célula, ela aparece como texto, sem seletor. O seletor (Relatórios e Dashboard) identifica cada célula pelo líder, dia, horário, G12 e endereço. Escolhida a célula, o bloco só de leitura com Líder, Timóteo, Anfitrião, G12, Tipo, Dia e horário e Endereço; na edição, com as pessoas e o tipo registrados. | idem |
| Aviso antes de preencher (T3) | Já enviado, reunião que ainda não aconteceu, célula inativa ou excluída: o aviso no topo, sem os campos, com "Fechar" e, para quem edita, "Editar relatório". | quem lança |
| Reunião (T4) | "Célula realizada" e "Não houve célula" lado a lado. A data é uma lista com os dias possíveis, calculados em Brasília; o horário é digitado (P62). Os dois vêm com a reunião da semana. Em "Não houve célula", só a reunião prevista, como texto, e o Motivo. O tema passa a ser obrigatório. | idem |
| Participantes (T5) | O líder, o timóteo e o anfitrião aparecem como texto, fixos e contados. Os inativos podem ser escolhidos, com a marca. O total aparece embaixo ("Participantes: {N}"). | idem |
| Visitantes, Oferta e Observações (T6) | Um campo por visitante, com "Adicionar visitante". A oferta é obrigatória, começa vazia e tem a máscara de reais do legado. | idem |
| Erros e recusas (T7) | Todos os erros de uma vez, cada um no seu campo, com o resumo no rodapé. As recusas do servidor vão para o campo ou para o `Alert` do topo, sem toast e sem mensagem técnica. | idem |
| Envio, conexão e sucesso (T8) | Um envio só. Sai o aviso "o relatório foi salvo, mas os participantes ainda não". A repetição depois de uma queda aparece como informação. | idem |
| Edição (T9) | Autoria no topo, célula fixa com o retrato, data só dentro da semana do relatório, pessoas registradas fixas e a troca entre as duas situações com o aviso do que sai. | quem edita relatórios |
| Lista de Relatórios e "Ver relatório" (T10) | O líder de cada relatório é o registrado, com "G12: {nome}" embaixo, e a busca procura nele. O painel "Ver relatório" (E2.01) ganha o bloco da célula com as pessoas e o tipo registrados. | quem vê relatórios |
| Células, detalhe da célula e Dashboard (T11) | Sem mudança visual. "Novo relatório" abre o mesmo formulário. | quem lança |

### Coerência com os outros specs
- **E2.08:** o formulário de relatório segue o de célula:
  - P1 com o rodapé fixo, "Campos com * são obrigatórios." no topo, cada grupo num `fieldset` com `legend` e o formulário com `noValidate`;
  - o horário é o campo do P62, com a mesma tabela de leitura (T3 e UX-08 de lá);
  - a pessoa inativa tem a marca do P63, só para quem a vê (P-CEL-18);
  - a recusa da célula inativa usa a T8 de lá, com as duas orientações da P-CEL-17. Aqui ela também aparece antes de preencher (T3).
- **E2.04:** valem o P21 (dica, erro e aviso), o P22 (conferência e resumo no rodapé), o P20 (um interruptor que esconde campos preenchidos diz o que sai, aqui na troca para "Não houve célula", como o próprio P20 previa) e a T7 de lá (envio, conexão e descartar).
- **E2.01:**
  - o participante excluído continua fora do seletor, na linha "Continuam no relatório (cadastros excluídos): {nomes}.", sem ✕ (T8 de lá), e conta no total;
  - a corrida do membro excluído marca o chip com "(cadastro excluído)" (T8 de lá);
  - o relatório excluído e a célula excluída na edição continuam no `Alert` com "Fechar";
  - o painel "Ver relatório" (T7 de lá) ganha o bloco da célula (T10).
- **E2.05:** a autoria e "Ver histórico" ficam no topo do corpo, só na edição (T4 de lá). A mensagem de conexão passa do `Alert` acima dos botões ao rodapé fixo, com o mesmo texto. "Nenhuma alteração para salvar." não muda.
- **E2.02:**
  - o seletor de célula oferece só as células em que a pessoa pode lançar e vem escolhido quando há uma só (UXD-9 e T8 de lá);
  - os participantes seguem o P11. Na edição, os que quem edita não vê continuam como chips, com o aviso da T8 de lá;
  - o atalho "Novo relatório" do Dashboard abre este formulário (T9 de lá);
  - as recusas de escopo ficam no `Alert` do topo (T11 de lá).
- **E2.09:** a P-SIT-17 fica respondida pela T3. Na célula "Enviado", "Novo relatório" continua, e o formulário avisa antes de preencher.
- **E2.10:** a lista e o detalhe da célula abrem o formulário com a célula fixa (T14 de lá). No F5 de lá, o botão é "Enviar relatório", e não "Salvar relatório".
- **E2.12:** aqui, a lista de Relatórios só troca o líder pelo registrado, acrescenta o G12 e muda a busca (T10). Os filtros, os atalhos de semana, a linha nova, os termos "Célula realizada" e "Não houve célula" nos badges e o painel em todas as linhas são de lá. O bloco da célula (P105) é o componente que o painel de lá deve usar.

### Decisões de experiência
| # | Decisão | Por quê |
|---|---|---|
| UXD-1 | **O formulário passa ao diálogo responsivo (P1), aberto do mesmo jeito pelos quatro caminhos: Relatórios, lista de Células, detalhe da célula e Dashboard.** No celular, ele ocupa a tela, e "Enviar relatório" fica sempre à vista no rodapé. | É o fluxo mais frequente do sistema, feito no celular logo depois da reunião. Hoje o diálogo inteiro rola, e o botão fica depois das observações (achado 8 da revisão de UX do PR 4 do E1.08). Um componente só para os quatro caminhos evita que um deles continue com o diálogo antigo. |
| UXD-2 | **Os campos só aparecem depois de a célula estar escolhida e conferida (RN-19, P100).** Antes, o corpo tem só a Célula. Durante a conferência, aparecem o bloco da célula e um `Skeleton` no lugar dos campos. | O aviso existe para a pessoa não perder o que digitou. Se os campos aparecessem antes da conferência, ela poderia começar a digitar e só então ver o aviso. A conferência é uma leitura pequena, que termina antes de a pessoa chegar ao primeiro campo. |
| UXD-3 | **No aviso antes de preencher, os campos somem (P12), e o rodapé tem só "Fechar".** Com a célula livre (Relatórios e Dashboard), o seletor continua, e escolher outra célula refaz a conferência. | Um formulário inteiro desabilitado parece quebrado e faz a pessoa rolar à procura de algo que funcione. Sem os campos, a mensagem é o que sobra na tela, e a única ação é a que resolve. |
| UXD-4 | **Se a conferência falhar por conexão, os campos aparecem com um aviso que não bloqueia, e a conferência fica para o envio.** *Definido pela UX (PO-UX-5).* | O líder costuma estar na casa do anfitrião, com internet fraca. Bloquear o formulário até a conexão melhorar o impediria de adiantar o preenchimento. O servidor confere tudo no envio (RN-19), e o que foi digitado não se perde (RN-20). |
| UXD-5 | **"Célula realizada" e "Não houve célula" são duas opções lado a lado (`RadioGroup`, P106), no lugar da caixa "Não houve célula".** *Definido pela UX (PO-UX-1).* | As duas situações têm nome no Negócio. Lado a lado, as duas ficam à vista, sem a negação de uma caixa marcada ("não houve" ligado), e cada uma é um alvo de 44 px. Na edição, a troca entre as duas tem efeito (P-REL-07), e a opção escolhida precisa ficar clara. Os rótulos são os mesmos do legado. |
| UXD-6 | **A data é uma lista com os dias possíveis ("Quarta, 25/11/2026"), e não um calendário (P104).** No lançamento, da reunião da semana até hoje; na edição, os dias da semana do relatório até hoje. Com um dia só, ele aparece como texto. *Definido pela UX (PO-UX-2).* | São no máximo 7 dias. A lista só tem datas que o servidor aceita, nomeia o dia da semana ("a célula de quarta") e funciona igual no celular, no computador e no leitor de tela. O calendário nativo deixa digitar datas fora do limite no computador e calcula o "hoje" pelo relógio do aparelho. |
| UXD-7 | **O líder, o timóteo e o anfitrião aparecem como texto acima do seletor de participantes, e não como chips sem ✕ (P103).** No seletor, eles aparecem desabilitados, com "Já entra automaticamente.". | RN-11: quem lança não pode tirá-los. Um chip sem ✕ entre chips com ✕ parece um defeito, e o leitor de tela o anunciaria como um item removível. Desabilitados no seletor, eles continuam achados pela busca, e a pessoa entende por que não pode escolhê-los. |
| UXD-8 | **A ordem dos campos é: Reunião (situação, data, horário e tema), Participantes, Visitantes, Oferta e Observações.** *Definido pela UX (PO-UX-4).* | Quem esteve na reunião (participantes e visitantes) fica junto, e o texto livre fica no fim, como nos outros formulários. O legado tinha a oferta ao lado do tema e os visitantes depois das observações. Os campos e os rótulos são os mesmos, então quem vem do legado reconhece cada um. |
| UXD-9 | **A oferta é digitada como no legado e nos aplicativos de banco: os dígitos entram pelos centavos ("5000" vira "50,00"), com o teclado numérico, e o campo começa vazio (P101).** *Definido pela UX (PO-UX-3).* | Quem usa o legado digita "5000" para R$ 50,00. Uma máscara que lesse "5000" como R$ 5.000,00 trocaria o valor de quem vem de lá. O teclado numérico tem teclas maiores, e a máscara impede o valor negativo e a terceira casa decimal. |
| UXD-10 | **Um campo por visitante, com "Adicionar visitante" embaixo e o botão de retirar em cada campo (P102).** O primeiro campo já vem aberto. Enter num campo preenchido abre o próximo. | RN-12 e o legado. O campo único separado por vírgulas de hoje dividia "Silva, João" em dois. Com o primeiro campo aberto, o caso comum (um ou dois visitantes) não pede toque a mais. |
| UXD-11 | **Na edição, o bloco da célula traz a frase "Líder, timóteo, anfitrião e tipo registrados no envio.", e a dica dos participantes diz que as pessoas registradas não saem.** | RN-14 e RN-17: o bloco mostra o retrato, que pode ser diferente da célula de hoje (Caio como timóteo quando hoje é Fábio). Sem a frase, quem edita acharia que o formulário está desatualizado. |
| UXD-12 | **A repetição depois de uma queda, quando recebe "já foi enviado", aparece como informação, com "Fechar", e não como erro (P107).** | RN-20: é a confirmação de que o primeiro envio deu certo. Um erro faria a pessoa tentar de novo, ou achar que perdeu o relatório. Ver a AQ-4, que transformaria esse caso em sucesso. |
| UXD-13 | **No aviso de "já foi enviado", "Editar relatório" troca o conteúdo do mesmo diálogo pela edição do relatório da semana.** | Pedro abriu o diálogo para resolver o relatório de C1. Fechar e procurar o relatório em Relatórios custaria 3 toques e a busca. Antes de preencher, nada foi digitado, então nada se perde. |
| UXD-14 | **O foco inicial fica no título do diálogo, e não no primeiro campo.** | No celular, o foco num campo abriria o teclado por cima do bloco da célula e do aviso, que são o que a pessoa precisa ler primeiro. O leitor de tela anuncia o título e segue a ordem do formulário. |

### Navegação e rotas
Nenhuma rota nova. O formulário continua num diálogo (UXD-1), aberto por:
- "Novo relatório" em Relatórios (célula livre; já escolhida quando há uma só, E2.02);
- o ícone "Novo relatório" do cartão e da linha na lista de Células e o "Novo relatório" do detalhe da célula (célula fixa);
- o atalho "Novo relatório" do Dashboard (célula livre; já escolhida quando há uma só);
- "Editar" em Relatórios e nos últimos relatórios do detalhe da célula (edição);
- "Editar relatório" no aviso de "já foi enviado" (edição, no mesmo diálogo, UXD-13).

Fechar o diálogo devolve o foco a quem o abriu (`useReturnFocus`), inclusive depois da troca para a edição.

### Fluxos
Contagem no celular, a partir de qualquer tela com o menu fechado, incluindo o toque no ☰, salvo quando a linha diz outra coisa. "Toque" não conta a digitação. Num seletor, abrir e escolher são 2 toques; no de participantes, o menu fica aberto entre as escolhas. C1 se reúne às quartas, às 20:00.

| # | História | Caminho | Toques e telas |
|---|---|---|---|
| F1 | A anfitriã envia o relatório pelo Dashboard, o fluxo mais frequente (Carla, uma célula; quarta, 25/11, às 21:30) | Dashboard → "Novo relatório" (C1 já escolhida e conferida; quarta, 25/11/2026, e 20:00 sugeridos) → Tema → Participantes → escolhe 5 → toca fora do menu → primeiro Visitante → "Adicionar visitante" (ou Enter) → Oferta → "Enviar relatório" | 13 toques e a digitação; 1 tela e 1 diálogo. O toast diz "Relatório enviado.", e os cards da semana recarregam. |
| F2 | Não houve célula (Caio, pela lista de Células) | ☰ → Células → "Novo relatório" em C1 → "Não houve célula" → Motivo → "Enviar relatório" | 6 toques e o motivo. Hoje são os mesmos, mais a data e o horário, que o banco podia recusar. |
| F3 | O relatório já foi enviado (Carla, depois de Caio) | Dashboard → "Novo relatório" → aviso no topo → "Fechar" | 2 toques, sem digitar nada. Hoje: o formulário inteiro e a recusa no fim. |
| F4 | Já enviado, com quem edita (Pedro) | ☰ → Células → "Novo relatório" em C1 → aviso → "Editar relatório" → altera → "Salvar alterações" | 5 toques e a alteração |
| F5 | A reunião ainda não aconteceu (Caio; terça, 24/11, às 15:00) | Dashboard → "Novo relatório" → aviso com "a partir de quarta, 25/11/2026, às 20:00" → "Fechar" | 2 toques |
| F6 | Duas células (Caio, por Relatórios) | ☰ → Relatórios → "Novo relatório" → Célula → C1 → (conferência) → o resto como no F1 | 3 toques a mais que o F1 |
| F7 | A secretaria lança relatórios em sequência (Júlia, computador) | Relatórios → "Novo relatório" → digita o líder no seletor → Enter → Tab pelos campos → Enter em "Enviar relatório" → repete | 1 clique por relatório; o resto pelo teclado |
| F8 | Corrigir erros | "Enviar relatório" → foco no primeiro erro → corrige → "Enviar relatório", que leva ao próximo erro, se houver | +1 toque por rodada, sem ir ao servidor |
| F9 | A conexão cai antes de gravar | "Enviar relatório" → mensagem no rodapé → "Enviar relatório" de novo | +1 toque, sem digitar de novo |
| F10 | A conexão cai depois de gravar | "Enviar relatório" → mensagem no rodapé → "Enviar relatório" → aviso "O relatório desta semana já foi enviado. …" → "Fechar" | +2 toques. Com a AQ-4, +1 toque e o toast "Relatório enviado.". |
| F11 | Pedro edita R1, da semana passada | ☰ → Relatórios → busca → ✎ → muda o tema, inclui Fábio e retira Lucas → "Salvar alterações" | 5 toques, a busca e as escolhas. Hoje o banco recusa. |
| F12 | Pedro passa R1 para "Não houve célula" | ✎ → "Não houve célula" → lê o que sai → Motivo → "Salvar alterações" | 4 toques e o motivo |
| F13 | Fechar sem querer | "✕" → "Continuar editando" | +1 toque, sem perder nada |

### Telas
As convenções dos wireframes são as do E2.08 e do E2.10:
- 360 px ≈ 38 colunas;
- `[Botão]` é botão, `[… ▾]` é seleção, e `(… ✕)` é uma pessoa escolhida, com o botão de retirar;
- `(•)` e `( )` são as opções de escolha única, marcada e não marcada;
- `(i)` é informação, `(!)` é aviso, `⚠` é erro, e `(◌)` é o indicador de carregando;
- `✓` é o ícone `CheckCircle2`, `◷` é o `Clock`, `[✎]` é "Editar", `[⋯]` é o menu de ações, e `⊘` é o `Ban` de "Célula excluída" (E2.01);
- `═` é a borda do rodapé fixo, e `▒` é um `Skeleton`.

A margem lateral é a do diálogo (`p-4` no celular). Nos wireframes, "hoje" é quarta, 25/11/2026, às 21:30, depois da reunião de C1, salvo quando o título diz outro momento.

#### T1. Estrutura do formulário
Celular, com Caio, aberto pelo "Novo relatório" de C1 na lista de Células, na sexta, 27/11, às 10:00:
```
┌──────────────────────────────────────┐
│ ✕  Novo relatório                    │  cabeçalho fixo; foco inicial no título
│──────────────────────────────────────│
│ Campos com * são obrigatórios.       │
│                                      │
│ Célula                               │  aberto por uma célula: texto (T2)
│ ┌──────────────────────────────────┐ │
│ │ Líder          André Souza       │ │  bloco só de leitura (P105)
│ │ Timóteo        Caio Lima         │ │
│ │ Anfitrião      Carla Dias        │ │
│ │ G12            Pedro Alves       │ │
│ │ Tipo           Evangelística     │ │
│ │ Dia e horário  Quarta, 20:00     │ │
│ │ Endereço       Rua das Flores,   │ │
│ │                100 · Centro      │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Reunião                              │  legend
│ ┌────────────────┐┌────────────────┐ │
│ │(•) Célula      ││( ) Não houve   │ │  RadioGroup (P106), h-11 cada
│ │    realizada   ││    célula      │ │
│ └────────────────┘└────────────────┘ │
│ Data *                               │
│ [Quarta, 25/11/2026               ▾] │  lista de dias (P104)
│ Horário *                            │
│ [20:00                             ] │  digitado (P62)
│ Entre quarta, 25/11/2026, às 20:00,  │  dica
│ e agora.                             │
│ Tema *                               │
│ [                                  ] │
│                                      │
│ Participantes                        │  legend (T5)
│ …                                    │
│ Visitantes                           │  legend (T6)
│ …                                    │
│ Oferta *                             │  T6
│ …                                    │
│ Observações                          │
│ [                                  ] │
│══════════════════════════════════════│
│ [Cancelar       ] [Enviar relatório] │  rodapé fixo, h-11
└──────────────────────────────────────┘
```
Desktop (a partir de 768 px, `Dialog` com `max-w-3xl`):
```
┌────────────────────────────────────────────────────────────────────────┐
│ Novo relatório                                                    ✕    │
│────────────────────────────────────────────────────────────────────────│
│ Campos com * são obrigatórios.                                         │
│ Célula                                                                 │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ Líder      André Souza          Tipo           Evangelística       │ │
│ │ Timóteo    Caio Lima            Dia e horário  Quarta, 20:00       │ │
│ │ Anfitrião  Carla Dias           Endereço       Rua das Flores,     │ │
│ │ G12        Pedro Alves                         100 · Centro        │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ Reunião                                                                │
│ [(•) Célula realizada]  [( ) Não houve célula]                         │
│ Data *                              Horário *                          │
│ [Quarta, 25/11/2026            ▾]  [20:00                          ]   │
│ Entre quarta, 25/11/2026, às 20:00, e agora.                           │
│ Tema *                                                                 │
│ [                                                                    ] │
│ Participantes                                                          │
│ …                                                                      │
│ Visitantes                                                             │
│ …                                                                      │
│ Oferta *                                                               │
│ [R$                             ]                                      │
│ Observações                                                            │
│ [                                                                    ] │
│────────────────────────────────────────────────────────────────────────│
│                                     [Cancelar]  [Enviar relatório]     │
└────────────────────────────────────────────────────────────────────────┘
```
- **Celular (abaixo de 768 px), pelo P1:**
  - uma coluna;
  - o cabeçalho tem o "✕" e o título;
  - o corpo rola (`overflow-y-auto`), com `scroll-pt` e `scroll-pb` da altura do cabeçalho e do rodapé, para o campo em foco nunca ficar atrás deles (WCAG 2.4.11);
  - o rodapé fixo tem "Cancelar" (`outline`) e a ação primária (`default`), lado a lado, cada um com metade da largura e `h-11`, e `pb-[calc(1rem+env(safe-area-inset-bottom))]`. O rodapé fica dentro do `form` (ou o botão usa o atributo `form`), para o Enter e o envio funcionarem.
- **Desktop (a partir de 768 px):**
  - `Dialog` centralizado, com `max-w-3xl`, `max-h-[90dvh]` e o mesmo cabeçalho e rodapé fixos;
  - o bloco da célula em duas colunas (pessoas e G12 à esquerda; tipo, dia e horário e endereço à direita);
  - as duas opções da situação com a largura do texto;
  - Data e Horário em par; Oferta em meia linha; Tema, Participantes, Visitantes, Observações e Motivo na linha inteira.
- **Ordem (UXD-8):**
  1. os `Alert` do topo: o aviso antes de preencher (T3) e as recusas do servidor (T7);
  2. na edição, a autoria e o `Separator` (P30);
  3. "Campos com * são obrigatórios.", só quando há campo para preencher;
  4. Célula: o seletor, quando a célula está livre, e o bloco (T2);
  5. "Reunião": a situação; na célula realizada, Data, Horário e Tema; em "Não houve célula", a reunião prevista e o Motivo (T4);
  6. só na célula realizada: "Participantes" (T5), "Visitantes", Oferta e Observações (T6). Em "Não houve célula", esses campos não ficam no DOM.
- **Grupos:** "Reunião", "Participantes" e "Visitantes" são `fieldset` sem borda, com a `legend` no estilo do E2.08 (`text-base font-semibold`). Oferta e Observações são campos soltos. Entre os grupos, `space-y-6`, sem `Separator`.
- **Textos (P-REL-20):**
  - títulos: "Novo relatório" e "Editar relatório" (hoje "Novo Relatório de Célula" e "Editar Relatório");
  - ação primária: "Enviar relatório" no lançamento e "Salvar alterações" na edição (PO-UX-6; hoje "Salvar"); durante o envio, "Enviando…" e "Salvando…".
- **Foco inicial (UXD-14):** o título do diálogo (`DialogTitle` com `tabIndex={-1}`, pelo `onOpenAutoFocus`). O teclado do celular não abre sozinho.
- **Formulário:** `noValidate`.
- **Um componente para os quatro caminhos (UXD-1):** por exemplo, `CellReportDialog`, com três modos: célula fixa, célula livre e edição. Ele substitui os `Dialog` de `CellReports.tsx`, `Cells.tsx`, do detalhe da célula e do Dashboard.
- **Componentes:** o `ResponsiveDialogContent` do P1, `FormPaginatedSelect`, `RadioGroup`, `Select`, `Input`, `Textarea`, `Button`, `Alert`, `AlertDialog` (descartar), `Skeleton` e `Separator`. O `useIsMobile` não entra: a troca é só CSS (P1).

#### T2. Célula: seletor e bloco só de leitura
```
Caio abre por Relatórios                 Opções, com a busca "andré"
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ ✕  Novo relatório                    │ │ Célula *                             │
│──────────────────────────────────────│ │ [andré                            ▾] │
│ Campos com * são obrigatórios.       │ │ ┌──────────────────────────────────┐ │
│ Célula *                             │ │ │ André Souza · Quarta, 20:00      │ │
│ [Buscar por líder, rua ou bairro… ▾] │ │ │ G12: Pedro Alves · Rua das       │ │
│ Escolha a célula para preencher o    │ │ │ Flores, 100 · Centro             │ │
│ relatório.                           │ │ │ ──────────────────────────────── │ │
│                                      │ │ │ André Souza · Sábado, 22:00      │ │
│                                      │ │ │ G12: Pedro Alves · Rua dos Ipês, │ │
│══════════════════════════════════════│ │ │ 45 · Bela Vista                  │ │
│ [Cancelar       ] [Enviar relatório] │ │ └──────────────────────────────────┘ │
└──────────────────────────────────────┘ └──────────────────────────────────────┘
```
```
Conferindo (C1 escolhida)                Edição de R2 depois das mudanças de Rita
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Célula *                             │ │ Célula                               │
│ [André Souza · Quarta, 20:00      ▾] │ │ ┌──────────────────────────────────┐ │
│ ┌──────────────────────────────────┐ │ │ │ Líder          André Souza       │ │
│ │ Líder          André Souza       │ │ │ │ Timóteo        Caio Lima         │ │
│ │ Timóteo        Caio Lima         │ │ │ │ Anfitrião      Carla Dias        │ │
│ │ …                                │ │ │ │ G12            Pedro Alves       │ │
│ └──────────────────────────────────┘ │ │ │ Tipo           Evangelística     │ │
│ (◌) Conferindo o relatório desta     │ │ │ Dia e horário  Quinta, 20:00     │ │
│ semana…                              │ │ │ Endereço       Rua das Flores,   │ │
│ ▒▒▒▒▒▒▒▒▒▒▒▒                         │ │ │                100 · Centro      │ │
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ │ │ │ Líder, timóteo, anfitrião e tipo │ │
│ ▒▒▒▒▒▒▒▒▒▒▒▒                         │ │ │ registrados no envio.            │ │
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ │ │ └──────────────────────────────────┘ │
└──────────────────────────────────────┘ └──────────────────────────────────────┘
```
```
Samuel, em C4 (célula fixa)              Caio: Fábio inativo; Beatriz, que ele não vê
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Célula                               │ │ Célula                               │
│ ┌──────────────────────────────────┐ │ │ ┌──────────────────────────────────┐ │
│ │ Líder          Samuel Rocha      │ │ │ │ Líder          André Souza       │ │
│ │ Timóteo        Samuel Rocha      │ │ │ │ Timóteo        Fábio Lima        │ │
│ │ Anfitrião      Magda Rocha       │ │ │ │                (inativo)         │ │
│ │ G12            Pastores          │ │ │ │ Anfitrião      Beatriz           │ │
│ │ Tipo           Macrocélula       │ │ │ │ G12            Pedro Alves       │ │
│ │ Dia e horário  Domingo, 10:00    │ │ │ │ …                                │ │
│ │ Endereço       Av. Central,      │ │ │ └──────────────────────────────────┘ │
│ │                500 · Centro      │ │ └──────────────────────────────────────┘
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```
- **Célula fixa** (lista de Células, detalhe da célula, edição e "Editar relatório" do aviso):
  - sem seletor (P12): "Célula" é o título do bloco, sem "*", e não um rótulo de campo;
  - a conferência (P100) começa ao abrir.
- **Célula livre** (Relatórios e Dashboard):
  - `FormPaginatedSelect` de escolha única, com o rótulo "Célula *", o placeholder "Buscar por líder, rua ou bairro…", sem o "✕" de limpar (P64) e com `aria-required="true"`;
  - antes da escolha, a dica "Escolha a célula para preencher o relatório." † embaixo do campo, ligada por `aria-describedby`;
  - as opções são as células em que a pessoa pode lançar (RN-17, `can_submit_report` do E2.02), 20 por página, com a busca por líder, rua e bairro;
  - com uma só, ela já vem escolhida (UXD-9 do E2.02), e a conferência começa ao abrir. O seletor continua, para a pessoa conferir;
  - sem nenhuma (só em corrida, porque o botão não apareceria), a busca vazia diz "Você não pode enviar o relatório de nenhuma célula." (E2.02).
- **Cada opção (RN-17)**, em duas linhas:
  - "{Líder} · {Dia}, {HH:mm}" em `font-medium`;
  - "G12: {G12} · {Rua}, {Número} · {Bairro}" em `text-sm text-muted-foreground`, sem as partes vazias.

  O valor escolhido mostra só a primeira linha. O nome acessível da opção é o texto das duas linhas.
- **Trocar de célula:**
  - troca o bloco e refaz a conferência;
  - troca a data e o horário pela reunião da nova célula, mesmo que a pessoa os tenha mudado (RN-18). Nesse caso, aparece embaixo do Horário o aviso `(i)` "Data e horário trocados pela reunião desta célula." †, com `role="status"`, até a próxima mudança da data ou do horário;
  - o resto do que foi digitado fica.
- **Conferindo (P100):** o bloco aparece na hora, com os dados que a opção ou a lista já têm (AQ-3). Embaixo, "Conferindo o relatório desta semana…" † com o indicador (`role="status"`) e um `Skeleton` com a altura dos primeiros campos. Nenhum campo do relatório fica no DOM até a resposta.
- **Bloco da célula (P105):**
  - uma `dl` numa caixa `rounded-lg border bg-card p-3`, com os rótulos em `text-sm text-muted-foreground` e os valores em `text-sm text-foreground`, que quebram linha (`min-w-0 break-words`). O `muted-foreground` sobre o `card` dá 4,9:1 no tema claro e 5,1:1 no escuro; sobre o `bg-muted`, ficaria abaixo de 4,5:1, por isso a caixa não usa o `muted`;
  - as linhas, nesta ordem: Líder, Timóteo, Anfitrião, G12, Tipo, Dia e horário e Endereço (Textos de tela). Os rótulos não mudam com o sexo da pessoa (PO-UX-8);
  - **Dia e horário:** "{Dia}, {HH:mm}", com o dia na forma curta ("Quarta, 20:00"), como no critério da RN-17;
  - **Endereço:** "{Rua}, {Número} · {Bairro}" ("s/n" sem número, como na lista). Sem nenhuma parte: "Sem endereço", em `text-muted-foreground`;
  - **G12:** um nome só, "Pastores" ou "—", lido como "nenhum" (`sr-only`), como na T2 do E2.06;
  - **as pessoas:** nomes só de texto, sem link. "(inativo)" ou "(inativa)" depois do nome, só para quem quem lança vê (P63, P-CEL-18). Quem ele não vê aparece só pelo nome (Beatriz, para Caio). A mesma pessoa em dois papéis aparece nas duas linhas (C4);
  - **na edição** (RN-14 c, UXD-11): Líder, Timóteo, Anfitrião e Tipo são os registrados; G12 é o G12 atual do líder registrado; Dia e horário e Endereço são os atuais da célula. Embaixo, a frase "Líder, timóteo, anfitrião e tipo registrados no envio." †, em `text-sm text-muted-foreground`. A pessoa registrada que foi excluída aparece só pelo nome (RN-14);
  - a partir de 768 px, duas `dl` lado a lado (`md:grid-cols-2`);
  - a caixa é uma `section` com `aria-label="Dados da célula"` †;
  - o mesmo componente vale no painel "Ver relatório" (T10) e, no E2.12, no painel de todas as linhas.
- **Célula excluída ou que a pessoa não vê** (na conferência ou no envio): o bloco some, e nada da célula fica na tela, nem o que veio da lista (como a UXD-11 do E2.10).

#### T3. Aviso antes de preencher (RN-19, P100)
```
Carla (vê R2, não edita)                 Pedro (edita relatórios)
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ ✕  Novo relatório                    │ │ ✕  Novo relatório                    │
│──────────────────────────────────────│ │──────────────────────────────────────│
│ ┌──────────────────────────────────┐ │ │ ┌──────────────────────────────────┐ │
│ │ ✓ O relatório para esta semana   │ │ │ │ ✓ O relatório para esta semana   │ │
│ │ já foi enviado.                  │ │ │ │ já foi enviado.                  │ │
│ │ Reunião de quarta, 25/11/2026,   │ │ │ │ Reunião de quarta, 25/11/2026,   │ │
│ │ às 20:00 · Célula realizada.     │ │ │ │ às 20:00 · Célula realizada.     │ │
│ └──────────────────────────────────┘ │ │ │ [Editar relatório             ]  │ │
│ Célula                               │ │ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │ │ Célula                               │
│ │ Líder          André Souza       │ │ │ ┌──────────────────────────────────┐ │
│ │ Timóteo        Caio Lima         │ │ │ │ Líder          André Souza       │ │
│ │ Anfitrião      Carla Dias        │ │ │ │ Timóteo        Caio Lima         │ │
│ │ …                                │ │ │ │ Anfitrião      Carla Dias        │ │
│ └──────────────────────────────────┘ │ │ │ …                                │ │
│                                      │ │ └──────────────────────────────────┘ │
│══════════════════════════════════════│ │══════════════════════════════════════│
│ [Fechar                            ] │ │ [Fechar                            ] │
└──────────────────────────────────────┘ └──────────────────────────────────────┘
```
```
Caio, terça, 24/11, às 15:00             Carla, com C1 inativada pela lista antiga
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ ✕  Novo relatório                    │ │ ✕  Novo relatório                    │
│──────────────────────────────────────│ │──────────────────────────────────────│
│ ┌──────────────────────────────────┐ │ │ ┌──────────────────────────────────┐ │
│ │ ◷ A reunião desta semana ainda   │ │ │ │ ⚠ Esta célula está inativa e não │ │
│ │ não aconteceu. O relatório pode  │ │ │ │ recebe relatórios. Se ela voltou │ │
│ │ ser enviado a partir de quarta,  │ │ │ │ a se reunir, peça à sua          │ │
│ │ 25/11/2026, às 20:00.            │ │ │ │ liderança para reativá-la.       │ │
│ └──────────────────────────────────┘ │ │ └──────────────────────────────────┘ │
│ Célula                               │ │ Célula                               │
│ ┌──────────────────────────────────┐ │ │ ┌──────────────────────────────────┐ │
│ │ Líder          André Souza       │ │ │ │ Líder          André Souza       │ │
│ │ Timóteo        Caio Lima         │ │ │ │ Timóteo        Caio Lima         │ │
│ │ Anfitrião      Carla Dias        │ │ │ │ Anfitrião      Carla Dias        │ │
│ │ …                                │ │ │ │ …                                │ │
│ └──────────────────────────────────┘ │ │ └──────────────────────────────────┘ │
│══════════════════════════════════════│ │══════════════════════════════════════│
│ [Fechar                            ] │ │ [Fechar                            ] │
└──────────────────────────────────────┘ └──────────────────────────────────────┘
```
Conferência que falhou por conexão (UXD-4):
```
┌──────────────────────────────────────┐
│ ✕  Novo relatório                    │
│──────────────────────────────────────│
│ (!) Não foi possível conferir se o   │  aviso (P21), role="status"
│ relatório desta semana já foi        │
│ enviado. Você pode preencher; a      │
│ conferência é feita ao enviar.       │
│ [Tentar de novo]                     │  outline, h-11
│ Campos com * são obrigatórios.       │
│ Célula                               │
│ ┌──────────────────────────────────┐ │
│ │ Líder          André Souza       │ │
│ │ Timóteo        Caio Lima         │ │
│ │ …                                │ │
│ └──────────────────────────────────┘ │
│ Reunião                              │  campos liberados (UXD-4)
│ …                                    │
└──────────────────────────────────────┘
```
- **Quando:** ao abrir com a célula fixa ou escolhida, e a cada escolha de célula. Quando (a) e (b) valem juntos, aparece (a) (RN-19).
- **Onde:** no topo do corpo, antes do bloco da célula, num `Alert` com o texto em `text-foreground` (P21). Quando o aviso chega, ele recebe o foco (`tabIndex={-1}`), a não ser que a pessoa já esteja num campo do formulário.
- **O que some:** os campos, "Campos com * são obrigatórios." e "Enviar relatório" (UXD-3). O rodapé tem só "Fechar" (`outline`, largura toda no celular, `h-11`). Com a célula livre, o seletor continua, e escolher outra célula refaz a conferência.
- **(a) A semana já tem relatório** (RN-07):
  - ícone `CheckCircle2`, `role="status"`: é uma informação, não um erro;
  - a primeira frase, "O relatório para esta semana já foi enviado.", para todos;
  - a segunda, "Reunião de {dia}, {dd/mm/aaaa}, às {HH:mm} · {Célula realizada | Não houve célula}.", só para quem vê o relatório (Carla e Pedro; não Caio em C6);
  - "Editar relatório" (`outline`, `h-11`, largura toda no celular), só para quem pode editá-lo (Pedro). Ele troca o conteúdo do diálogo pela edição do relatório (UXD-13): o título passa a "Editar relatório" e recebe o foco, e aparecem a autoria e os campos do relatório.
- **(b) A reunião desta semana ainda não aconteceu** (RN-06): ícone `Clock`, `role="status"`, com o texto do Negócio e o momento em que o envio abre. Sem ação além de "Fechar".
- **(c) Célula inativa** (E2.08, P-CEL-17): ícone `AlertCircle`, `role="alert"`, com "Esta célula está inativa e não recebe relatórios." e a orientação de quem lê: com "Editar Célula", "Para enviar um relatório, reative a célula."; sem ela, "Se ela voltou a se reunir, peça à sua liderança para reativá-la.". O bloco continua.
- **(c) Célula excluída ou que a pessoa não vê** (E2.01, RN-02): ícone `AlertCircle`, `role="alert"`, com o texto que o servidor devolver ("Esta célula foi excluída e não recebe relatórios." ou "Esta célula não existe ou já foi excluída."). O bloco some (T2).
- **Com a célula livre, em (c):** a célula fica desmarcada, o seletor recarrega sem ela (T8 do E2.08), e o formulário volta ao estado de antes da escolha, com o aviso no topo. Em (a) e (b), a célula continua escolhida, e a pessoa pode escolher outra (Caio, com C1 e C5).
- **"Fechar" depois de (a) ou (c):** fecha e recarrega a tela de onde o formulário foi aberto (P44), onde a situação do relatório (E2.09) ou a célula já aparecem atualizadas.
- **A conferência falhou** (UXD-4, PO-UX-5):
  - o aviso `(!)` "Não foi possível conferir se o relatório desta semana já foi enviado. Você pode preencher; a conferência é feita ao enviar." †, com `role="status"` e o ícone `TriangleAlert`, e "Tentar de novo" (`outline`, `h-11` no celular);
  - os campos aparecem, com a data e o horário calculados pelo relógio do aparelho, convertido para o horário de Brasília (AQ-6);
  - "Tentar de novo" refaz a conferência. Se a resposta for um aviso e nada tiver sido digitado, vale o aviso, como acima. Se algo foi digitado, o aviso aparece no topo, e os campos ficam, com o que foi digitado (como na recusa do envio, T7).
- **A conferência não substitui o envio** (RN-19): se a situação mudar com o formulário aberto, vale a resposta do servidor no envio (T7).

#### T4. Reunião: situação, data, horário e tema
```
Sexta, 27/11, às 10:00: lista aberta     Quarta, 25/11, às 21:30: um dia só
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Data *                               │ │ Data                                 │
│ [Quarta, 25/11/2026               ▾] │ │ Quarta, 25/11/2026 (hoje)            │
│ ┌──────────────────────────────────┐ │ │ Horário *                            │
│ │ ✓ Quarta, 25/11/2026             │ │ │ [20:00                             ] │
│ │   Quinta, 26/11/2026             │ │ │ Entre quarta, 25/11/2026, às 20:00,  │
│ │   Sexta, 27/11/2026 (hoje)       │ │ │ e agora.                             │
│ └──────────────────────────────────┘ │ └──────────────────────────────────────┘
│ Horário *                            │
│ [20:00                             ] │
│ Entre quarta, 25/11/2026, às 20:00,  │
│ e agora.                             │
└──────────────────────────────────────┘
```
```
Caio marca "Não houve célula"            Ao enviar sem o motivo
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Reunião                              │ │ Reunião                              │
│ ┌────────────────┐┌────────────────┐ │ │ ┌────────────────┐┌────────────────┐ │
│ │( ) Célula      ││(•) Não houve   │ │ │ │( ) Célula      ││(•) Não houve   │ │
│ │    realizada   ││    célula      │ │ │ │    realizada   ││    célula      │ │
│ └────────────────┘└────────────────┘ │ │ └────────────────┘└────────────────┘ │
│ (i) Ao enviar, o tema e os 2         │ │ Reunião prevista: quarta,            │
│ participantes escolhidos não serão   │ │ 25/11/2026, às 20:00                 │
│ enviados.                            │ │ Motivo *                             │
│ Reunião prevista: quarta,            │ │ Por exemplo: feriado, chuva forte,   │
│ 25/11/2026, às 20:00                 │ │ viagem do anfitrião.                 │
│ Motivo *                             │ │ [                                  ] │
│ Por exemplo: feriado, chuva forte,   │ │ [                                  ] │
│ viagem do anfitrião.                 │ │ ⚠ Informe o motivo de não ter        │
│ [                                  ] │ │ havido célula.                       │
│ [                                  ] │ └──────────────────────────────────────┘
└──────────────────────────────────────┘
```
- **Situação (P106, UXD-5):**
  - `RadioGroup` com "Célula realizada" (padrão) e "Não houve célula", lado a lado (`grid grid-cols-2 gap-2`) desde 320 px. Os rótulos quebram linha;
  - cada opção é um `Label` que envolve o `RadioGroupItem`, com `min-h-11`, `rounded-md border p-3` e a linha inteira clicável. A opção escolhida tem `border-primary` e o ponto do rádio: a forma, e não só a cor, mostra a escolha;
  - o grupo tem o nome da `legend` "Reunião" (`aria-labelledby`), e as setas trocam a opção (Radix).
- **Data (P104, UXD-6):**
  - `Select` com o rótulo "Data *" e uma opção por dia possível: "{Dia}, {dd/mm/aaaa}", com " (hoje)" † no dia de hoje. A ordem é a do calendário;
  - **no lançamento:** do dia da reunião da semana até hoje, em Brasília (RN-04 a RN-06). Ela vem com a reunião da semana (RN-18);
  - **na edição:** de domingo a sábado da semana do relatório, sem passar de hoje (RN-16). Ela vem com a data gravada;
  - **com um dia só** (quarta, às 21:30, em C1; ou sábado, em C5): o rótulo "Data", sem "*", e o dia como texto (P12);
  - o valor enviado é a data `aaaa-mm-dd` da opção. O "hoje" e os dias vêm do servidor (AQ-1), e não do relógio do aparelho: com o aparelho em Lisboa ou em Manaus, as opções são as de Brasília (critérios da RN-06).
- **Horário (P62):** o campo do E2.08, com a mesma máscara, a mesma leitura ao sair do campo e o erro de formato. No lançamento, vem com o horário da célula; na edição, com o gravado. Mudar a data não muda o horário.
- **Dica do par Data e Horário:**
  - no lançamento: "Entre {dia}, {dd/mm/aaaa}, às {HH:mm}, e agora." †, com o momento da reunião da semana;
  - na edição: "Dentro da semana do relatório, de {dd/mm/aaaa} a {dd/mm/aaaa}." †;
  - fica embaixo do Horário e entra no `aria-describedby` dos dois campos.
- **Tema * (RN-08):** `Input`, `autoComplete="off"`, `autoCapitalize="sentences"` e `enterKeyHint="next"`, sem placeholder. "Informe o tema ministrado." também quando só há espaços.
- **"Não houve célula" (RN-09):**
  - Data, Horário, Tema e os grupos e campos abaixo saem do DOM;
  - aparece, como texto, "Reunião prevista: {dia}, {dd/mm/aaaa}, às {HH:mm}" (Textos de tela). No lançamento, é a reunião da semana; na edição, a data e o horário gravados (RN-16);
  - **Motivo *:** `Textarea` com `text-base md:text-sm`, `rows={3}`, sem altura fixa e sem placeholder, com a dica "Por exemplo: feriado, chuva forte, viagem do anfitrião." † entre o rótulo e o campo;
  - **o que sai (P20):** se algo da célula realizada estava preenchido, o aviso `(i)` embaixo das opções, com `role="status"`, diz o que não vai: "Ao enviar, não serão enviados: {itens}." † ("não será enviado: {item}" com um item só), com os itens preenchidos ("o tema", "{N} participantes escolhidos", "{N} visitantes", "a oferta (R$ {valor})", "as observações"). Voltar para "Célula realizada" devolve tudo e tira o aviso. A edição tem textos próprios (T9);
  - ao enviar, o formulário não manda tema, participantes, visitantes, oferta nem observações.

#### T5. Participantes
```
Caio lança o relatório de C1             Menu aberto, com a busca "ca"
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Participantes                        │ │ Outros participantes                 │
│ O líder, o timóteo e o anfitrião     │ │ [ca                               ▾] │
│ entram automaticamente.              │ │ ┌──────────────────────────────────┐ │
│ • André Souza                        │ │ │ Caio Lima                        │ │
│ • Caio Lima                          │ │ │ Já entra automaticamente.        │ │
│ • Carla Dias                         │ │ │ Camila Reis                      │ │
│ Outros participantes                 │ │ │ Carla Dias                       │ │
│ ┌──────────────────────────────────┐ │ │ │ Já entra automaticamente.        │ │
│ │ (Fábio Lima (inativo) ✕)         │ │ │ │ Carlos Nunes (inativo)           │ │
│ │ (Lucas Prado ✕)                  │ │ │ └──────────────────────────────────┘ │
│ │ Buscar membros…              ▾   │ │ └──────────────────────────────────────┘
│ └──────────────────────────────────┘ │
│ Participantes: 5                     │
└──────────────────────────────────────┘
```
A edição está na T9.
- **Dica e lista fixa (P103, UXD-7):**
  - logo depois da `legend`, a dica "O líder, o timóteo e o anfitrião entram automaticamente." (Textos de tela), em `text-sm text-muted-foreground`;
  - embaixo, uma `ul` com os nomes, na ordem líder, timóteo e anfitrião, sem repetir a mesma pessoa (Samuel, líder e timóteo de C4, aparece uma vez). Os nomes seguem o bloco da célula: a marca "(inativo)" só para quem quem lança vê, e só o nome para quem ele não vê;
  - os itens são texto, sem botão e sem foco.
- **Seletor "Outros participantes" †:**
  - o `FormPaginatedSelect` múltiplo de hoje, com o rótulo visível "Outros participantes", o placeholder "Buscar membros…" e `closeMenuOnSelect={false}`;
  - as opções são os membros não excluídos que quem lança vê, ativos e inativos (RN-10, P-REL-08). Sai o filtro de só ativos (`activeOnly`);
  - "(inativo)" ou "(inativa)" na opção e no chip (P63);
  - o líder, o timóteo e o anfitrião aparecem desabilitados, com a linha "Já entra automaticamente." † embaixo do nome (P5 de Escolas), e não podem ser escolhidos;
  - cada chip tem o ✕ "Retirar {Nome}" † (`aria-label`), com a largura de hoje (32 px);
  - a busca sem resultado segue o P11 ("Nenhum membro do seu ministério encontrado." ou "Nenhum membro encontrado").
- **Total (RN-11):** "Participantes: {N}" no fim do grupo, em `text-sm font-medium`, com `role="status"`. Conta, uma vez cada, os automáticos, os escolhidos e, na edição, os de cadastro excluído. Muda a cada escolha.
- **Limite (RN-10):** com 1000 participantes, as opções ficam desabilitadas, e a mensagem "Um relatório pode ter no máximo 1000 participantes." aparece embaixo do seletor, com `role="status"`.
- **Corridas (E2.01 e E2.02):** o membro excluído entre a escolha e o envio fica marcado no chip com "(cadastro excluído)", e a mensagem do Negócio vai para o campo (T7). O mesmo lugar recebe "Você só pode escolher pessoas que você vê.".
- **"Não houve célula":** o grupo inteiro sai do DOM (RN-09).

#### T6. Visitantes, Oferta e Observações
```
┌──────────────────────────────────────┐
│ Visitantes                           │  legend
│ Um nome por campo.                   │  dica
│ [João Silva                   ] [✕]  │  o ✕ é "Retirar o visitante João Silva"
│ [Maria                        ] [✕]  │
│ [                             ] [✕]  │  campo novo, com o foco
│ [+ Adicionar visitante             ] │  outline, h-11
│ Visitantes: 2                        │  só os nomes preenchidos; role="status"
│                                      │
│ Oferta *                             │
│ Se não houve oferta, informe 0,00.   │  dica
│ [R$ 37,50                          ] │  inputMode="numeric" (P101)
│                                      │
│ Observações                          │
│ [                                  ] │  Textarea, 3 linhas
│ [                                  ] │
└──────────────────────────────────────┘
```
- **Visitantes (P102, UXD-10, RN-12):**
  - `fieldset` com a `legend` "Visitantes" e a dica "Um nome por campo." †;
  - cada visitante é um `Input` com o placeholder "Nome do visitante" † e o nome acessível "Nome do visitante {n}" †, `autoComplete="off"`, `autoCapitalize="words"` e `enterKeyHint="next"`;
  - no lançamento, o primeiro campo já vem aberto e vazio. Na edição, um campo por nome gravado, na ordem gravada; sem nenhum, um campo vazio;
  - **Enter** num campo preenchido leva ao próximo, ou abre um novo e põe o foco nele, quando é o último. Num campo vazio, não faz nada. Nunca envia o formulário;
  - **"Adicionar visitante"** (`outline`, `h-11`, ícone `Plus`, largura toda no celular) abre um campo no fim e põe o foco nele;
  - **retirar:** um botão de ícone `X` em cada campo (`ghost`, `h-11 w-11` no celular e `md:h-9 md:w-9`), com o nome "Retirar o visitante {Nome}" † ou, no campo vazio, "Retirar o visitante {n}" †. O foco vai para o campo seguinte, ou para o anterior, ou para "Adicionar visitante";
  - ao sair do campo, os espaços das pontas saem, e os repetidos viram um só ("  João   Silva " vira "João Silva"). Os campos vazios são descartados no envio, sem aviso. Nomes repetidos ficam, sem aviso, e "Silva, João" é um nome só;
  - "Visitantes: {N}" † no fim do grupo, com `role="status"`, conta só os nomes preenchidos;
  - com 1000 nomes, "Adicionar visitante" fica desabilitado, e "Um relatório pode ter no máximo 1000 visitantes." aparece embaixo, com `role="status"`.
- **Oferta * (P101, UXD-9, RN-13):**
  - `Input` com `type="text"`, `inputMode="numeric"`, `autoComplete="off"`, `enterKeyHint="next"` e o placeholder "0,00", com "R$" fixo à esquerda (`aria-hidden`, `pl-10`). Meia linha a partir de 768 px;
  - a dica "Se não houve oferta, informe 0,00." † entre o rótulo e o campo, para a pessoa saber antes do erro que zero vale;
  - começa vazia no lançamento. Na edição, mostra o valor gravado ("50,00"). Na troca de "Não houve célula" para célula realizada, começa vazia, a não ser que o relatório já tenha uma oferta maior que zero (legado): o 0 gravado hoje em "Não houve célula" não é uma resposta (P-REL-11);
  - a máscara segue a tabela abaixo. O valor enviado é o número com 2 casas (37.5 para "37,50"); vazio não é zero;
  - sem o sinal de menos e sem a terceira casa, as mensagens de valor negativo e de casas decimais só aparecem pela API ou numa versão antiga da tela.
- **Observações:** `Textarea` com `text-base md:text-sm`, `rows={3}`, sem altura fixa, `autoComplete="off"` e sem placeholder (o de hoje fala de "encontro").

Oferta: o que o campo mostra (UX-24)

| Digitado ou colado | O campo mostra |
|---|---|
| nada | vazio, com o placeholder "0,00" |
| `0` | 0,00 |
| `5` | 0,05 |
| `50` | 0,50 |
| `5000` | 50,00 |
| `3750` | 37,50 |
| `123456` | 1.234,56 |
| `0005` | 0,05 |
| apagar todos os dígitos | vazio |
| colado `37,5` | 37,50 |
| colado `1.234,56` | 1.234,56 |
| colado `R$ 50,00` | 50,00 |
| colado `50` (sem vírgula nem ponto) | 50,00: o valor colado é lido em reais |
| colado `10,555` | 10,56: arredondado a 2 casas |
| colado `-5` | 5,00: o sinal é ignorado |
| colado `abc` | sem mudança |

#### T7. Erros e recusas
O exemplo é o critério da RN-20: Caio envia sem tema, sem oferta e com o horário "25:00". No celular:
```
┌──────────────────────────────────────┐
│ ✕  Novo relatório                    │
│──────────────────────────────────────│
│ …                                    │
│ Horário *                            │
│ [25:00                             ] │  foco: o primeiro erro
│ ⚠ Horário inválido. Informe a hora e │
│ os minutos, entre 00:00 e 23:59.     │
│ Tema *                               │
│ [                                  ] │
│ ⚠ Informe o tema ministrado.         │
│ …                                    │
│ Oferta *                             │
│ Se não houve oferta, informe 0,00.   │
│ [R$                                ] │
│ ⚠ Informe a oferta. Se não houve     │
│ oferta, informe R$ 0,00.             │
│ …                                    │
│══════════════════════════════════════│
│ ⚠ Confira os campos destacados (3).  │  resumo, role="status"
│ [Cancelar       ] [Enviar relatório] │
└──────────────────────────────────────┘
```
Recusas do servidor:
```
Carla enviou antes de Caio (RN-19)       Quarta, 25/11, às 20:30 (RN-05)
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ ✕  Novo relatório                    │ │ Data                                 │
│──────────────────────────────────────│ │ Quarta, 25/11/2026 (hoje)            │
│ ┌──────────────────────────────────┐ │ │ Horário *                            │
│ │ ⚠ O relatório para esta semana   │ │ │ [20:31                             ] │
│ │ já foi enviado.                  │ │ │ ⚠ O relatório não pode ser enviado   │
│ │ Reunião de quarta, 25/11/2026,   │ │ │ para uma data ou horário futuros.    │
│ │ às 20:00 · Célula realizada.     │ │ │ Tema *                               │
│ └──────────────────────────────────┘ │ │ [A fé que vence                    ] │
│ Campos com * são obrigatórios.       │ │ …                                    │
│ Célula                               │ └──────────────────────────────────────┘
│ …                                    │
│ Tema *                               │
│ [A fé que vence                    ] │
│ …                                    │
│══════════════════════════════════════│
│ [Cancelar       ] [Enviar relatório] │
└──────────────────────────────────────┘
```
- **Quando a tela confere (P22):**
  - **ao sair do Horário** alterado e preenchido: só o formato (P62). Sair de um campo vazio não mostra erro;
  - **ao tocar em "Enviar relatório" ou "Salvar alterações":** a célula, o tema ou o motivo, a oferta e o formato do horário, todos de uma vez, cada um no seu campo. Também a data e o horário contra o futuro e contra a reunião da semana, com o "agora" do servidor (AQ-6). Nada é enviado enquanto houver erro;
  - **depois que um erro aparece,** ele some assim que o valor fica certo.
- **Foco:** vai para o primeiro campo com erro, na ordem da tela, que fica inteiro à vista. No seletor, o foco vai para a busca; na situação, para a opção marcada.
- **Resumo no rodapé:** "Confira os campos destacados ({N})." acima dos botões no celular e à esquerda deles no desktop, com `role="status"`. O número diminui a cada correção, e tocar de novo na ação primária leva ao próximo erro.
- **Recusas do servidor (RN-20):** vem uma por vez, na ordem do Negócio. O formulário nunca fecha numa recusa, mantém tudo o que foi digitado e nunca mostra toast de erro nem mensagem técnica.

| Caso | Onde aparece | Texto |
|---|---|---|
| Sem célula (tela) | embaixo da Célula; entra no resumo | Escolha a célula. |
| Tema, motivo, oferta ou horário vazios; horário fora do formato (tela; servidor, numa versão antiga) | embaixo do campo; entra no resumo | os do Negócio (RN-08, RN-09, RN-13) |
| Data inválida (só pela API) | embaixo da Data | Data inválida. |
| Data ou horário futuros (RN-05) e antes da reunião (RN-06), na tela ou no servidor | embaixo do Horário, ligado aos dois campos do par; os dois ficam com `aria-invalid`, e o foco vai para o primeiro editável | os do Negócio |
| Edição fora da semana do relatório (RN-16) | embaixo da Data | Na edição, a data só pode mudar dentro da semana do relatório, de {dd/mm/aaaa} a {dd/mm/aaaa}. |
| Semana atual (RN-04), quando a semana vira com o formulário aberto | `Alert` do topo; os campos ficam | O relatório precisa ser da semana atual, de {dd/mm/aaaa} a {dd/mm/aaaa}. |
| Um por semana (RN-07), no primeiro envio | `Alert` do topo, como o aviso (a) da T3, com a identificação e "Editar relatório" para quem pode; os campos ficam | os do Negócio |
| Um por semana na repetição depois de uma queda neste formulário (RN-20) | `Alert` do topo, como informação (T8, P107) | O relatório desta semana já foi enviado. Confira na lista de Relatórios. |
| A reunião desta semana ainda não aconteceu (RN-06), no envio | `Alert` do topo; os campos ficam | o do Negócio |
| Participante excluído no meio tempo (RN-10) | embaixo de "Outros participantes", com o chip marcado (E2.01) | Este membro foi excluído e não pode ser escolhido. |
| Participante que não se vê, limite de participantes, retirar quem não pode sair (RN-10, RN-11; os dois últimos só por uma versão antiga) | embaixo de "Outros participantes" | os do Negócio |
| Limite de visitantes | embaixo de "Visitantes" | Um relatório pode ter no máximo 1000 visitantes. |
| Troca para "Não houve célula" com participante excluído (RN-09) | embaixo das opções da situação | Este relatório tem participante com cadastro excluído e não pode passar para "Não houve célula". |
| Sem permissão (RN-02, RN-03) | `Alert` do topo; a tela relê o acesso (P13) | Você não tem permissão para esta ação. (ver PO-UX-7) |
| Célula inativa, excluída ou que não se vê (RN-02) | `Alert` do topo, como o (c) da T3. Com a célula fixa, "Fechar" no lugar de "Enviar relatório"; com a célula livre, ela fica desmarcada | os do Negócio, com a orientação da P-CEL-17 |
| Relatório excluído, ou de célula excluída, na edição (RN-03) | `Alert` do topo, com "Fechar", que fecha e recarrega a lista (E2.01) | Este relatório não existe ou já foi excluído. As alterações não foram salvas. · A célula deste relatório foi excluída. Restaure a célula para editar o relatório. |
| Trocar a célula (só pela API ou numa versão antiga) | `Alert` do topo | A célula de um relatório não pode ser trocada. |
| Texto maior que o teto técnico (AQ-8) | embaixo do campo | o que o `architect` definir |
| Erro que a tela não reconhece, erro do servidor (5xx) ou rede | rodapé, com `role="alert"` (T8) | Não foi possível enviar o relatório. Verifique a conexão e tente de novo. · na edição: Não foi possível salvar o relatório. Verifique a conexão e tente de novo. |

- **Mensagem do servidor num campo:** entra no resumo, recebe o foco como os erros da tela e some quando a pessoa muda aquele campo.
- **`Alert` do topo:** fica no começo do corpo rolável, antes da autoria, recebe o foco (`tabIndex={-1}`), e a tela rola até ele (T11 do E2.02).
- **"Editar relatório" depois de digitar:** na recusa do RN-07 no envio, "Editar relatório" pede antes "Descartar as alterações?" (T8), porque o que foi digitado não vai para a edição.
- **Sem o código e o campo (AQ-2):** o texto do servidor, quando é um texto do Negócio, vai para o `Alert` do topo, sem marcar o campo. Qualquer outro texto vira a mensagem de conexão.
- **Sai o tratamento de hoje:** os textos "Já existe um relatório dessa célula nesta semana (domingo a sábado)." e "A data do relatório precisa estar dentro da semana atual (de domingo a sábado).", os toasts de erro e a leitura dos SQLSTATE 23505, 23514 e P0001 em `report-form.ts`.

#### T8. Envio, conexão, sucesso e fechar
```
Aos 3 s em "Enviando…"                   Queda de conexão
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ …                                    │ │ …                                    │
│══════════════════════════════════════│ │══════════════════════════════════════│
│ Ainda enviando. Isso pode levar      │ │ ⚠ Não foi possível enviar o          │
│ alguns segundos.                     │ │ relatório. Verifique a conexão e     │
│ [Cancelar       ] [(◌) Enviando…   ] │ │ tente de novo.                       │
└──────────────────────────────────────┘ │ [Cancelar       ] [Enviar relatório] │
                                         └──────────────────────────────────────┘
```
Repetição depois de uma queda (F10, P107):
```
┌──────────────────────────────────────┐
│ ✕  Novo relatório                    │
│──────────────────────────────────────│
│ ┌──────────────────────────────────┐ │
│ │ ✓ O relatório desta semana já    │ │  P107: informação, role="status", foco
│ │ foi enviado. Confira na lista de │ │
│ │ Relatórios.                      │ │
│ │ Reunião de quarta, 25/11/2026,   │ │
│ │ às 20:00 · Célula realizada.     │ │
│ └──────────────────────────────────┘ │
│ Campos com * são obrigatórios.       │
│ …                                    │
│══════════════════════════════════════│
│ [Fechar                            ] │
└──────────────────────────────────────┘
```
- **Enviando (T7 do E2.04 e P44):**
  - o botão mostra "Enviando…" ou "Salvando…", com o `Loader2` (`motion-reduce:animate-none`), e os dois botões ficam desabilitados. Um duplo toque não envia duas vezes;
  - durante o envio, "✕", `Esc` e o toque fora do diálogo não fecham o formulário;
  - aos 3 s sem resposta, aparece "Ainda enviando. Isso pode levar alguns segundos." † ou "Ainda salvando. Isso pode levar alguns segundos." (E2.06) acima dos botões, em `text-sm text-muted-foreground`, com `role="status"`.
- **Um envio só (RN-15):** saem o aviso "O relatório foi salvo, mas os participantes ainda não. Salve de novo para incluí-los." e a regra de "a nova tentativa atualiza o relatório já criado". Uma falha deixa o relatório sem gravar, e a nova tentativa é um envio novo.
- **Queda de conexão ou erro do servidor:**
  - a mensagem do Negócio no rodapé, acima dos botões, com `role="alert"`;
  - os dados ficam, os botões voltam, e o foco vai para a ação primária, que serve de "Tentar de novo".
- **Repetição depois de uma queda (RN-20, P107, UXD-12):**
  - quando o envio anterior deste formulário terminou em queda de conexão e o seguinte recebe a recusa da RN-07, a tela mostra, no `Alert` do topo, "O relatório desta semana já foi enviado. Confira na lista de Relatórios.", com o ícone `CheckCircle2` e `role="status"`. Para quem vê o relatório, a segunda linha da RN-07 identifica qual é;
  - os campos ficam, para a pessoa conferir. O rodapé passa a ter só "Fechar", que fecha sem pedir confirmação e recarrega a tela de origem;
  - com a AQ-4, esse caso vira sucesso: o toast "Relatório enviado." e o formulário fechado.
- **Sucesso:** o formulário fecha, a tela de origem recarrega (P44), e aparece o toast:

| Gravação | Toast |
|---|---|
| Lançamento | Relatório enviado. |
| Edição | Relatório atualizado. |
| Edição sem nenhuma mudança (T5 do E2.05) | Nenhuma alteração para salvar. (sem chamar o servidor) |

- **O que recarrega (AQ-9):**
  - Relatórios: a lista, com as linhas em `opacity-60` até a resposta;
  - Células: a situação do relatório da célula passa a "Enviado" (E2.09), sem recarregar a página;
  - detalhe da célula: o relatório novo em primeiro, a situação e a evolução (T14 do E2.10);
  - Dashboard: os cards da semana (T9 do E2.02).
- **Fechar com alterações (UXD-14 do E2.04):** "Cancelar", "✕", `Esc` e o toque fora do diálogo pedem "Descartar as alterações?", com "O que você digitou não será salvo.", "Descartar" (`destructive`) e "Continuar editando" (`outline`, foco inicial). Sem alteração, fecham direto.
  - **No lançamento, conta como alteração:** a situação trocada, a data ou o horário diferentes da sugestão, e qualquer coisa digitada ou escolhida em Tema, Motivo, participantes, visitantes, Oferta e Observações. Escolher a célula não conta, nem a data e o horário sugeridos.
  - **Na edição:** qualquer valor diferente do carregado, inclusive os participantes (T5 do E2.05).
  - No estado de aviso (T3), não há o que descartar: "Fechar" fecha direto.

#### T9. Edição
Pedro edita R1 (18/11), com Beatriz, que ele não vê, e Bruno, excluído, entre os participantes:
```
┌──────────────────────────────────────┐
│ ✕  Editar relatório                  │  cabeçalho fixo
│──────────────────────────────────────│
│ Enviado por Caio Lima em 18/11/2026  │  autoria (P30)
│ às 21:40                             │
│ ──────────────────────────────────── │
│ Campos com * são obrigatórios.       │
│ Célula                               │
│ ┌──────────────────────────────────┐ │
│ │ Líder          André Souza       │ │  retrato (UXD-11)
│ │ Timóteo        Caio Lima         │ │
│ │ Anfitrião      Carla Dias        │ │
│ │ …                                │ │
│ │ Líder, timóteo, anfitrião e tipo │ │
│ │ registrados no envio.            │ │
│ └──────────────────────────────────┘ │
│ Reunião                              │
│ ┌────────────────┐┌────────────────┐ │
│ │(•) Célula      ││( ) Não houve   │ │
│ │    realizada   ││    célula      │ │
│ └────────────────┘└────────────────┘ │
│ Data *                               │
│ [Quarta, 18/11/2026               ▾] │  domingo 15/11 a sábado 21/11
│ Dentro da semana do relatório, de    │  dica
│ 15/11/2026 a 21/11/2026.             │
│ Horário *                            │
│ [20:00                             ] │
│ Tema *                               │
│ [A fé que vence                    ] │
│ Participantes                        │
│ O líder, o timóteo e o anfitrião     │  dica
│ registrados no relatório não podem   │
│ ser retirados dos participantes.     │
│ • André Souza                        │  pessoas registradas: fixas
│ • Caio Lima                          │
│ • Carla Dias                         │
│ Outros participantes                 │
│ ┌──────────────────────────────────┐ │
│ │ (Beatriz Lima ✕) (Fábio Lima     │ │
│ │ (inativo) ✕) (Júlia Reis ✕)      │ │
│ │ (Lucas Prado ✕)                  │ │
│ │ Buscar membros…              ▾   │ │
│ └──────────────────────────────────┘ │
│ Alguns participantes não são do seu  │  E2.02 (T8)
│ ministério: se você retirá-los, não  │
│ poderá incluí-los de novo.           │
│ Continuam no relatório (cadastros    │  E2.01 (T8)
│ excluídos): Bruno Costa.             │
│ Participantes: 8                     │
│ …                                    │
│══════════════════════════════════════│
│ [Cancelar      ] [Salvar alterações] │
└──────────────────────────────────────┘
```
Trocas de situação (RN-09, P-REL-07):
```
Pedro passa R1 para "Não houve célula"   R1, com Bruno excluído: opção desabilitada
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Reunião                              │ │ Reunião                              │
│ ┌────────────────┐┌────────────────┐ │ │ ┌────────────────┐┌────────────────┐ │
│ │( ) Célula      ││(•) Não houve   │ │ │ │(•) Célula      ││( ) Não houve   │ │
│ │    realizada   ││    célula      │ │ │ │    realizada   ││    célula      │ │
│ └────────────────┘└────────────────┘ │ │ └────────────────┘└────────────────┘ │
│ (i) Ao salvar, saem do relatório: o  │ │ Este relatório tem participante com  │
│ tema, 8 participantes, 2             │ │ cadastro excluído e não pode passar  │
│ visitantes, a oferta (R$ 50,00) e    │ │ para "Não houve célula".             │
│ as observações.                      │ │ Data *                               │
│ Reunião prevista: quarta,            │ │ [Quarta, 18/11/2026               ▾] │
│ 18/11/2026, às 20:00                 │ │ …                                    │
│ Motivo *                             │ └──────────────────────────────────────┘
│ [                                  ] │
└──────────────────────────────────────┘
```
```
R3 passa para célula realizada           R3, como está (só leitura na data)
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Reunião                              │ │ Reunião                              │
│ ┌────────────────┐┌────────────────┐ │ │ ┌────────────────┐┌────────────────┐ │
│ │(•) Célula      ││( ) Não houve   │ │ │ │( ) Célula      ││(•) Não houve   │ │
│ │    realizada   ││    célula      │ │ │ │    realizada   ││    célula      │ │
│ └────────────────┘└────────────────┘ │ │ └────────────────┘└────────────────┘ │
│ (i) Ao salvar, o motivo sai do       │ │ Reunião prevista: quarta,            │
│ relatório, e o líder, o timóteo e o  │ │ 11/11/2026, às 20:00                 │
│ anfitrião registrados entram como    │ │ Motivo *                             │
│ participantes.                       │ │ [Feriado                           ] │
│ Data *                               │ └──────────────────────────────────────┘
│ [Quarta, 11/11/2026               ▾] │
│ …                                    │
│ Tema *                               │
│ [                                  ] │
│ …                                    │
└──────────────────────────────────────┘
```
- **Topo:** a autoria e "Ver histórico" (T4 do E2.05, P30 e P31), com o `Separator`. Depois, "Campos com * são obrigatórios.".
- **Célula:** fixa, com o retrato (T2, UXD-11). A RN-16 não deixa trocar a célula, e a tela não oferece a troca.
- **Data:** a lista com os dias da semana do relatório até hoje (T4) e a dica da semana. A RN-04 e a RN-06 não valem: R1 pode ficar em quinta, 19/11, às 19:30, antes do horário da célula (critério da RN-16).
- **Participantes:**
  - a dica "O líder, o timóteo e o anfitrião registrados no relatório não podem ser retirados dos participantes." (o texto do Negócio, usado como dica) e, embaixo, a lista das pessoas registradas que são participantes, como texto (P103). As que não são participantes, num relatório antigo, não aparecem na lista e podem ser incluídas pelo seletor (RN-11);
  - os outros participantes são chips com ✕, inclusive os que quem edita não vê (Beatriz, só pelo nome), com o aviso da T8 do E2.02;
  - os de cadastro excluído ficam na linha da T8 do E2.01, sem ✕. A pessoa registrada que foi excluída fica na lista das registradas, só pelo nome, e não se repete nessa linha;
  - o total conta todos, uma vez cada.
- **Célula realizada → "Não houve célula" (P20):**
  - o aviso `(i)`, com `role="status"`, diz o que sai: "Ao salvar, saem do relatório: {itens}." † ("sai do relatório: {item}" com um item só), com os itens que o relatório tem ("o tema", "{N} participantes", "{N} visitantes", "a oferta (R$ {valor})", "as observações");
  - a data e o horário ficam como estão e aparecem como texto ("Reunião prevista: …");
  - o Motivo é obrigatório;
  - voltar para "Célula realizada" devolve tudo e tira o aviso.
- **Com participante de cadastro excluído (P5):** "Não houve célula" fica desabilitada, e o texto do Negócio aparece embaixo das opções, ligado ao grupo por `aria-describedby`. A recusa do servidor, se vier por corrida, vai para o mesmo lugar (T7).
- **"Não houve célula" → célula realizada:**
  - o aviso `(i)` "Ao salvar, o motivo sai do relatório, e o líder, o timóteo e o anfitrião registrados entram como participantes." †;
  - a lista das pessoas registradas aparece, e o total já as conta;
  - Data e Horário viram campos, com os valores gravados; Tema e Oferta são obrigatórios;
  - o tema, os visitantes e as observações que o relatório já tinha (do legado) aparecem nos campos. A oferta começa vazia, a não ser que seja maior que zero (T6).
- **Relatório de "Não houve célula" que já tem participantes, tema ou oferta (legado):** continua mostrando só o Motivo. Mudar só o motivo não mexe no resto, e nada avisa (RN-09).
- **Relatório de célula inativa:** abre e salva normalmente, sem aviso (RN-11 d do E2.08).
- **Rodapé:** "Cancelar" e "Salvar alterações" (PO-UX-6).

#### T10. Lista de Relatórios e "Ver relatório"
```
Relatórios: cartões (Pedro)              "Ver relatório" (T7 do E2.01)
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ André Souza            [✎] [⋯]       │ │ ✕  Relatório de 18/11/2026           │
│ G12: Pedro Alves                     │ │ Célula de André Souza                │
│ Rua das Flores, 100                  │ │ [⊘ Célula excluída]                  │
│ Centro                               │ │ ┌──────────────────────────────────┐ │
│ 25/11/2026 · 20:00                   │ │ │ (i) A célula deste relatório foi │ │
│ [Realizada]          10 presenças    │ │ │ excluída. …                      │ │
│──────────────────────────────────────│ │ └──────────────────────────────────┘ │
│ Samuel Rocha           [✎] [⋯]       │ │ Enviado por Caio Lima em 18/11/2026  │
│ G12: Pastores                        │ │ às 21:40                             │
│ Av. Central, 500                     │ │ ──────────────────────────────────── │
│ …                                    │ │ Célula                               │
└──────────────────────────────────────┘ │ ┌──────────────────────────────────┐ │
                                         │ │ Líder          André Souza       │ │
                                         │ │ Timóteo        Caio Lima         │ │
                                         │ │ Anfitrião      Carla Dias        │ │
                                         │ │ G12            Pedro Alves       │ │
                                         │ │ Tipo           Evangelística     │ │
                                         │ │ …                                │ │
                                         │ │ Líder, timóteo, anfitrião e tipo │ │
                                         │ │ registrados no envio.            │ │
                                         │ └──────────────────────────────────┘ │
                                         │ Data e hora                          │
                                         │ Quarta, 18/11/2026 às 20:00          │
                                         │ …                                    │
                                         └──────────────────────────────────────┘
```
- **Líder da linha (RN-14 d):** o líder registrado no relatório, e não o líder atual da célula, no cartão e na primeira coluna da tabela. Embaixo, "G12: {nome}" (o G12 atual do líder registrado), "G12: Pastores" ou "G12: —" (com "nenhum" em `sr-only`), em `text-xs text-muted-foreground`, como o E2.12 vai manter (RN-15 de lá).
- **Busca:** o placeholder "Buscar por líder ou tema…" não muda, e o líder procurado é o registrado (critério da RN-14: Pedro continua achando R2 por "André" depois de Rita trocar as pessoas de C1).
- **Botão e diálogos:** "Novo Relatório" passa a "Novo relatório", e os diálogos usam o componente da T1. O subtítulo da tela é o do E2.02 (P10); o de hoje fala de "encontros".
- **O resto da linha não muda até o E2.12:** endereço, data e horário, o badge, as "presenças", que passam a contar os participantes automáticos, e as ações.
- **"Ver relatório" (T7 do E2.01):** o painel passa a mostrar "Célula de {líder registrado}" e, depois da autoria, o bloco da célula da T2 com a frase da edição. O resto do painel não muda. No E2.12, o mesmo painel vale para todas as linhas.

#### T11. Células, detalhe da célula e Dashboard
- Sem mudança visual. "Novo relatório" abre o componente da T1: com a célula fixa, na lista e no detalhe; com a célula livre, já escolhida quando há uma só, no Dashboard.
- Na célula "Enviado", "Novo relatório" continua (P-SIT-17), e o formulário mostra o aviso (a) da T3.
- Depois do envio, cada tela se atualiza como na T8.

#### T12. As perguntas Q-1 a Q-7 na tela
Com o padrão do Negócio (nenhuma regra nova), vale o que está nas T1 a T11. Se a resposta for sim:

- **Q-1. Relatório atrasado, de uma semana que já passou.**
  - Para quem puder, o grupo "Reunião" ganha, antes da situação, a escolha da semana, como opções lado a lado: "Esta semana" e "Semana passada ({dd/mm} a {dd/mm})" †, até o limite que o PO definir.
  - A conferência (P100) e a lista de datas (P104) passam a usar a semana escolhida. O aviso (b) ganha "Enviar o relatório da semana passada" †, quando ela não tem relatório.
  - Precisa da semana na conferência (AQ-1).
- **Q-2. "Não houve célula" antes do horário.**
  - O aviso (b) deixa de esconder o formulário: ele diz "A reunião desta semana ainda não aconteceu. Se ela foi cancelada, informe o motivo." †, e o formulário mostra só "Não houve célula", já escolhida e sem a outra opção, e o Motivo.
- **Q-3. Reunião antecipada.**
  - A lista de datas passa a começar no domingo da semana, e a dica muda para "Entre domingo, {dd/mm/aaaa}, e agora." †. O aviso (b) deixa de bloquear.
  - O bloco da célula continua com o dia e o horário de cadastro, e a data sugerida continua a da reunião da semana.
- **Q-4. Oferta "não informada".**
  - O "*" da Oferta sai, e a dica vira "Deixe em branco se a oferta ainda não foi contada. Se não houve oferta, informe 0,00." †. O vazio é enviado como "não informada".
- **Q-5. Retirar o timóteo ou o anfitrião que faltou.**
  - Na edição, para quem edita, a lista fixa vira chips com ✕ ("Retirar {Nome}"), e a dica dos participantes sai. No lançamento, nada muda, a menos que o PO estenda a regra.
- **Q-6. Quem lançou corrige o próprio relatório por um tempo.**
  - O toast do sucesso ganha a ação "Editar" †, e o aviso (a) da T3 mostra "Editar relatório" para quem o enviou, até o prazo. Em Relatórios, "Editar" aparece nos relatórios dele dentro do prazo.
- **Q-7. Visitantes como consolidados.**
  - Fica para o spec da Consolidação. Cada visitante ganharia um contato (celular), e o grupo "Visitantes" passaria a ser um seletor de consolidados com "Cadastrar visitante". Nada muda neste passo.

### Padrões novos (valem para as próximas telas)
A numeração começa em P100 (ver a nota do início da seção). Este passo também aplica o P1 (diálogo responsivo), o P5 (opção desabilitada com o motivo), o P11 (seletor limitado ao que se vê), o P12 (valor que não muda como texto), o P13 (acesso relido), o P20 a P22 (o que sai, mensagens e erros), o P30 e P31 (autoria e histórico), o P44 (gravação que muda outras telas), o P62 (horário digitado), o P63 (marca de inativo) e o P64 (seletor obrigatório sem limpar).

- **P100. Conferência antes de preencher.** Vale para um formulário que pode ser recusado por um motivo que já se sabe antes do preenchimento (já enviado, ainda não aberto, registro inativo).
  - O formulário confere ao abrir, ou ao escolher o registro de origem. Até a resposta, os campos não ficam no DOM: aparece "Conferindo…" (`role="status"`) com um `Skeleton`.
  - Com um impedimento, o aviso fica no topo, recebe o foco e diz o que aconteceu e, quando houver, a partir de quando. Os campos não aparecem, e o rodapé tem só "Fechar", mais a ação que resolve, quando a pessoa pode (por exemplo, "Editar relatório").
  - Se a conferência falhar, os campos aparecem com um aviso que não bloqueia, e a conferência fica para o envio.
  - A conferência nunca substitui a do servidor. Uma recusa no envio mantém o que foi digitado.
  - Vale para a chamada de Escolas (aula já lançada) e para os próximos formulários com uma regra assim.
- **P101. Valor em reais digitado.** `Input` de texto com `inputMode="numeric"`, "R$" fixo à esquerda (`aria-hidden`) e o placeholder "0,00".
  - Os dígitos entram pelos centavos ("5000" → "50,00"), com o ponto de milhar. Apagar todos os dígitos deixa o campo vazio, e vazio não é zero.
  - O valor colado com vírgula ou ponto é lido como número pt-BR, arredondado a 2 casas. O colado só com dígitos é lido em reais. O sinal de menos e as letras são ignorados.
  - Quando zero é uma resposta válida, uma dica diz isso antes do erro.
  - Vale para a oferta e para os próximos valores em reais (Escolas, Tesouraria).
- **P102. Lista de nomes livres.** Um campo por item, com "Adicionar {item}" (`outline`, `h-11`) embaixo e um botão de retirar (44×44 px no celular) em cada campo, com o nome do item no nome acessível.
  - O primeiro campo já vem aberto. Enter num campo preenchido leva ao próximo ou abre um novo; nunca envia o formulário.
  - Ao sair do campo, os espaços sobrando saem. Os vazios são descartados no envio, sem erro.
  - Uma contagem com `role="status"` diz quantos itens preenchidos há.
- **P103. Itens fixos numa escolha múltipla.** Os itens que a pessoa não pode tirar (os automáticos, os registrados) aparecem como texto, numa lista acima do seletor, com uma dica que diz por quê. No seletor, eles aparecem desabilitados, com o motivo escrito (P5). O total conta os fixos e os escolhidos.
- **P104. Data num intervalo curto.** Quando os dias possíveis são poucos (até 7), a data é um `Select` com um dia por opção, "{Dia}, {dd/mm/aaaa}", com " (hoje)" no dia de hoje, e não um calendário.
  - Os dias e o "hoje" vêm do servidor, no horário de Brasília, e não do relógio do aparelho.
  - Com um dia só, ele aparece como texto (P12).
  - Uma dica diz o intervalo.
- **P105. Bloco do registro de origem.** Os dados só de leitura de um registro que dá origem a outro (a célula do relatório; no futuro, a turma da chamada) ficam numa `dl` em caixa `rounded-lg border bg-card p-3`, numa `section` com nome acessível.
  - Rótulos em `text-sm text-muted-foreground` e valores em `text-sm text-foreground`, que quebram linha. Nunca sobre o `bg-muted`, que deixaria os rótulos abaixo de 4,5:1.
  - Quando o bloco mostra um retrato guardado, e não os dados de hoje, uma frase diz isso.
  - É um componente só, usado no formulário e no painel de consulta.
- **P106. Duas situações que se excluem.** Quando um formulário tem duas situações com nome próprio, cada uma com campos diferentes, elas são duas opções lado a lado (`RadioGroup`, cada uma um `Label` de `min-h-11` com borda), e não uma caixa com uma negação. Trocar de situação segue o P20. Uma opção que a regra não permite fica desabilitada, com o motivo (P5).
- **P107. Repetição depois de queda de conexão.** Quando a nova tentativa depois de uma queda recebe a recusa de "já existe", a tela trata como provável sucesso do envio anterior: uma informação no topo (`role="status"`, ícone `CheckCircle2`), e não um erro, com "Fechar" e a identificação do registro, para quem o vê. Com um envio idempotente (AQ-4), vira o sucesso normal.

Nenhum componente novo do shadcn é necessário: `dialog`, `alert`, `alert-dialog`, `radio-group`, `select`, `input`, `textarea`, `button`, `separator`, `skeleton`, `sheet` e `badge` já estão em `src/components/ui`. O P1 continua pedindo `viewport-fit=cover` na meta viewport do `index.html`, que ainda não tem (tarefa do frontend, já prevista em Escolas e nos E2.01 a E2.10).

### Estados
| Estado | Lançamento | Edição | Lista de Relatórios e "Ver relatório" |
|---|---|---|---|
| Carregando | Célula fixa: o bloco na hora, com os dados da tela de origem, e "Conferindo…" com `Skeleton` (T2). Célula livre: só o seletor. | A autoria, o bloco e os campos vêm com a linha da lista. Os participantes salvos mostram um `Skeleton` de 3 linhas, e "Salvar alterações" espera por eles (como hoje). | Como hoje (E1.08). |
| Vazio | Antes da célula, só o seletor e a dica. Sem célula possível, o texto do E2.02 no seletor. | — | Como hoje, até o E2.12. |
| Aviso antes de preencher | T3: o aviso, o bloco (menos na célula excluída) e "Fechar". | — | — |
| Conferência falhou | T3: aviso que não bloqueia, com "Tentar de novo"; campos liberados. | — | — |
| Erro de preenchimento | T7: todos de uma vez, com o foco no primeiro e o resumo no rodapé. | Idem. | — |
| Recusa do servidor | T7: no campo ou no `Alert` do topo; os dados ficam. | Idem, mais o relatório ou a célula excluídos com "Fechar". | — |
| Sem permissão | O botão "Novo relatório" não aparece (E2.02). A recusa vai para o `Alert` do topo, e a tela relê o acesso (P13). | "Editar" não aparece (E2.02). Idem. | Como no E2.02. |
| Registro mudou no meio tempo | Célula inativada ou excluída: o (c) da T3, na conferência ou no envio. Relatório enviado por outra pessoa: o `Alert` da RN-07. | Relatório ou célula excluídos: E2.01. | A lista recarrega (P44). |
| Sucesso | O formulário fecha; o toast "Relatório enviado."; a tela de origem recarrega (T8). | "Relatório atualizado." ou "Nenhuma alteração para salvar.". | A linha com os valores novos. |
| Lista grande | Seletores com 20 por página (E1.08). Até 1000 participantes e 1000 visitantes. | Idem. | Paginação do E1.08. |
| Queda de conexão no envio | Mensagem no rodapé, dados mantidos, foco na ação primária. A repetição segue o P107. | Mensagem de edição no rodapé. | — |

### Textos
Complementam os "Textos de tela" do Negócio, sem mudar os termos. As mensagens de regra são as do Negócio, mostradas como estão lá. Os textos marcados com † foram definidos pela UX e estão nas pendências (PO-UX-10).

| Onde | Texto |
|---|---|
| Títulos | Novo relatório · Editar relatório |
| Topo do formulário | Campos com * são obrigatórios. |
| Célula | Célula * (seletor) · Célula (fixa) · Buscar por líder, rua ou bairro… · Escolha a célula para preencher o relatório. † · Nenhuma célula encontrada · Você não pode enviar o relatório de nenhuma célula. (E2.02) |
| Opção do seletor de célula † | {Líder} · {Dia}, {HH:mm} / G12: {G12} · {Rua}, {Número} · {Bairro} |
| Bloco da célula | Líder · Timóteo · Anfitrião · G12 · Tipo · Dia e horário · Endereço · Pastores · — · Sem endereço · na edição: Líder, timóteo, anfitrião e tipo registrados no envio. † · nome acessível: Dados da célula † |
| Conferência † | Conferindo o relatório desta semana… · Não foi possível conferir se o relatório desta semana já foi enviado. Você pode preencher; a conferência é feita ao enviar. · Tentar de novo |
| Avisos antes de preencher | os do Negócio (RN-06, RN-07), da P-CEL-17 e do E2.01 · Editar relatório · Fechar |
| Reunião | Reunião · Célula realizada · Não houve célula · Data * · Data (um dia só) · Horário * · Tema * · Reunião prevista: {dia}, {dd/mm/aaaa}, às {HH:mm} · Motivo * |
| Opções de data † | {Dia}, {dd/mm/aaaa} · {Dia}, {dd/mm/aaaa} (hoje) |
| Dicas † | Entre {dia}, {dd/mm/aaaa}, às {HH:mm}, e agora. · Dentro da semana do relatório, de {dd/mm/aaaa} a {dd/mm/aaaa}. · Por exemplo: feriado, chuva forte, viagem do anfitrião. · Um nome por campo. · Se não houve oferta, informe 0,00. |
| Troca de célula † | Data e horário trocados pela reunião desta célula. |
| O que sai (P20) † | Ao enviar, não será enviado: {item}. · Ao enviar, não serão enviados: {itens}. · Ao salvar, sai do relatório: {item}. · Ao salvar, saem do relatório: {itens}. · Ao salvar, o motivo sai do relatório, e o líder, o timóteo e o anfitrião registrados entram como participantes. · itens: o tema · {N} participantes escolhidos (no lançamento) · {N} participantes (na edição) · {N} visitantes · a oferta (R$ {valor}) · as observações (no singular com 1) |
| Participantes | Participantes · O líder, o timóteo e o anfitrião entram automaticamente. · na edição: O líder, o timóteo e o anfitrião registrados no relatório não podem ser retirados dos participantes. · Outros participantes † · Buscar membros… · Já entra automaticamente. † · Participantes: {N} · {Nome} (inativo) · {Nome} (inativa) · Retirar {Nome} † · as linhas do E2.01 e do E2.02 |
| Visitantes | Visitantes · Nome do visitante † (placeholder) · Nome do visitante {n} † (nome acessível) · Retirar o visitante {Nome} † · Retirar o visitante {n} † · Adicionar visitante · Visitantes: {N} † |
| Oferta | Oferta * · R$ · 0,00 (placeholder) · as mensagens do Negócio |
| Observações | Observações |
| Erros e recusas | os do Negócio, do E2.01, do E2.02 e do E2.08, sem mudança (tabela da T7) |
| Resumo | Confira os campos destacados ({N}). |
| Botões | Cancelar · Enviar relatório · Salvar alterações (PO-UX-6) · Enviando… † · Salvando… · Fechar · Editar relatório · Adicionar visitante · Tentar de novo |
| Envio demorado | Ainda enviando. Isso pode levar alguns segundos. † · Ainda salvando. Isso pode levar alguns segundos. (E2.06) |
| Conexão | os do Negócio |
| Repetição depois de queda | O relatório desta semana já foi enviado. Confira na lista de Relatórios. |
| Toasts | Relatório enviado. · Relatório atualizado. · Nenhuma alteração para salvar. (E2.05) |
| Descartar | Descartar as alterações? · O que você digitou não será salvo. · Descartar · Continuar editando |
| Lista de Relatórios | Novo relatório · G12: {Nome} · G12: Pastores · G12: — |

### Acessibilidade
- **Formulário:**
  - `noValidate`. Os obrigatórios mantêm `required` nos `Input` e nos `Textarea` e `aria-required="true"` no seletor de célula, no `Select` da data e no `RadioGroup`; o "*" é explicado no topo;
  - "Reunião", "Participantes" e "Visitantes" são `fieldset` com `legend`; o bloco da célula é uma `section` com nome acessível.
- **Mensagens (P21):** erro, aviso e dica ficam no `aria-describedby` do campo, nessa ordem, e o erro também marca `aria-invalid`. A dica e o erro do par Data e Horário ficam ligados aos dois campos. O `PaginatedSelect` precisa aceitar `aria-describedby` para a dica do seletor de célula e para a mensagem do limite (pedido também no E2.02, no E2.04 e no E2.08).
- **Foco:**
  - ao abrir, o título do diálogo (UXD-14);
  - o aviso da conferência (T3) e o `Alert` do topo recebem o foco quando aparecem, a não ser que a pessoa já esteja num campo;
  - "Editar relatório" leva o foco ao título "Editar relatório";
  - ao enviar com erro, o primeiro campo com erro, inteiro à vista (WCAG 2.4.11);
  - "Adicionar visitante" e Enter levam o foco ao campo novo; retirar um visitante leva ao campo seguinte;
  - depois de uma falha de conexão, a ação primária;
  - na confirmação de descartar, "Continuar editando";
  - ao fechar, quem abriu o diálogo.
- **Anúncios:**
  - `role="status"`: "Conferindo…", os avisos (a) e (b) e a conferência que falhou, os avisos do P20, a troca de célula, os totais de participantes e de visitantes, os limites, o resumo e "Ainda enviando…";
  - `role="alert"`: o aviso (c), as recusas no `Alert` do topo e a falha de conexão;
  - "Enviando…" e "Salvando…" ficam no próprio botão, sem região extra;
  - um aviso que recebe o foco e também é região viva pode ser lido duas vezes: conferir com leitor de tela real e, se for, tirar a região viva e deixar só o foco.
- **Nomes:** "(inativo)" e "(inativa)" fazem parte do nome da opção, do chip e da linha fixa; o ✕ de cada chip é "Retirar {Nome}"; o de cada visitante, "Retirar o visitante {Nome}"; cada campo de visitante, "Nome do visitante {n}"; a opção de célula, as duas linhas; a opção desabilitada de participante, o nome e "Já entra automaticamente.".
- **Contraste:** as mensagens seguem o P21 (`text-foreground`, nunca `text-destructive`). O bloco da célula usa o `card`, e não o `muted` (P105). A opção escolhida da situação tem a borda `border-primary` e o ponto do rádio. Os textos do `Alert` ficam em `text-foreground`, nos temas claro e escuro.
- **Sem depender de cor:** erro, aviso e informação têm ícones diferentes e texto. A situação escolhida tem o ponto do rádio.
- **Toque:** as opções da situação, "Adicionar visitante", os botões de retirar visitante, "Fechar", "Editar relatório", "Tentar de novo" e os botões do rodapé têm pelo menos 44 px de altura no celular; os botões de retirar visitante têm 44×44 px, com 8 px até o campo. Os ✕ dos chips continuam com 32 px de largura (acima dos 24 px da WCAG 2.5.8).
- **Teclado do celular:** `inputMode="numeric"` no Horário e na Oferta; `autoCapitalize="words"` nos visitantes e `"sentences"` no Tema, no Motivo e nas Observações; `enterKeyHint="next"` no Tema, no Horário, nos visitantes e na Oferta. O `Textarea` usa `text-base md:text-sm`, para o iOS não dar zoom.
- **Zoom e fonte grande:** com 200% e em 320 px, rótulos, dicas, avisos, opções da situação, nomes com "(inativo)" e as duas linhas das opções de célula quebram linha. Nada tem altura fixa, e o corpo do diálogo rola (P1).
- **Movimento:** o `Loader2` e as animações do `Dialog`, do `Select` e do `AlertDialog` respeitam `motion-reduce:`.

### Critérios de UX
Os momentos são os dos critérios do Negócio; sem momento, quarta, 25/11/2026, às 21:30.

| ID | Critério | Como verificar |
|---|---|---|
| UX-01 | Em 360×800, o formulário (lançamento e edição) ocupa a tela, com cabeçalho e rodapé fixos, e a ação primária ("Enviar relatório" ou "Salvar alterações") fica à vista sem rolar, com o teclado fechado, em qualquer ponto da rolagem. A partir de 768 px, é um `Dialog` centralizado, com `max-h-[90dvh]` e o rodapé fixo. Vale igual pelos quatro caminhos: Relatórios, lista de Células, detalhe da célula e Dashboard. | teste E2E (viewport, os quatro caminhos) |
| UX-02 | Os títulos são "Novo relatório" e "Editar relatório"; as `legend` são "Reunião", "Participantes" e "Visitantes"; os rótulos são os da tabela de Textos. O DOM do formulário e da lista de Relatórios não tem "Encontro", "encontro", "Tema da Palavra", "Participantes (Membros)", "Observações Gerais", "Motivo do Cancelamento", "Novo Relatório", "Editar Relatório", "Modalidade", "Relatório salvo com sucesso" nem "separados por vírgula". | teste de componente |
| UX-03 | A ordem do DOM é a da T1. Abaixo de 768 px, uma coluna; a partir de 768 px, o bloco da célula em duas colunas e Data e Horário em par. Em "Não houve célula", Data, Horário, Tema, Participantes, Visitantes, Oferta e Observações não ficam no DOM. | teste de componente + teste E2E (viewport) |
| UX-04 | Aberto por Relatórios, antes da escolha da célula, o corpo tem só o seletor e a dica; nenhum outro campo fica no DOM. "Enviar relatório" sem célula mostra "Escolha a célula." embaixo do seletor, com o foco, sem requisição. Para Carla, com uma célula só, C1 já vem escolhida, e a conferência começa ao abrir. | teste de componente (requisições) + teste E2E (massa) |
| UX-05 | Seletor de célula: para Caio, as opções são C1 e C5, e não C2 nem C3; a busca "André" acha as duas; cada opção tem as duas linhas da T2; o valor escolhido mostra a primeira; não há botão de limpar, e o campo tem `aria-required="true"` (critério da RN-17). | teste E2E (massa) |
| UX-06 | Bloco da célula: Caio, em C1, vê Líder André Souza, Timóteo Caio Lima, Anfitrião Carla Dias, G12 Pedro Alves, Tipo Evangelística, "Quarta, 20:00" e o endereço; Samuel, em C4, vê G12 "Pastores"; com Beatriz anfitriã, Caio vê só "Beatriz"; com Fábio timóteo, "Fábio Lima (inativo)". A caixa usa `bg-card`, e não `bg-muted`. | teste de componente + teste E2E (massa) |
| UX-07 | Aberto pela lista de Células, pelo detalhe da célula ou na edição, não há seletor de célula no DOM: "Célula" é o título do bloco, sem "*" (critério da RN-17). | teste de componente |
| UX-08 | Enquanto a conferência não responde, aparece "Conferindo o relatório desta semana…" com `role="status"` e o `Skeleton`, e nenhum campo do relatório fica no DOM. | teste de componente (resposta atrasada) |
| UX-09 | Aviso (a), com R2 enviado: Carla vê "O relatório para esta semana já foi enviado." e "Reunião de quarta, 25/11/2026, às 20:00 · Célula realizada.", sem "Editar relatório"; Pedro vê também "Editar relatório"; Caio, em C6, vê só a primeira frase. Nos três, nenhum campo fica no DOM, o rodapé tem só "Fechar", e o aviso recebe o foco (critério da RN-07). | teste E2E (massa) |
| UX-10 | Aviso (b): na terça, 24/11, às 15:00, Caio vê, em C1, o texto da RN-06 com "a partir de quarta, 25/11/2026, às 20:00". Com o aparelho em Lisboa (quarta, 00:30), o mesmo aviso; com o aparelho em Manaus (quarta, 19:30, em Brasília 20:30), o formulário abre com quarta, 25/11/2026, e 20:00. Samuel, em C4, no domingo, 29/11, às 09:59, vê o aviso; às 10:00, o formulário. | teste E2E (relógio e fuso simulados) |
| UX-11 | Aviso (c): com C1 inativada depois de a lista carregar, Carla vê o texto da P-CEL-17 com "peça à sua liderança", e Pedro, com "reative a célula". Pela lista, "Fechar" fecha e atualiza a lista; por Relatórios, a célula fica desmarcada, e o seletor não a oferece. Com C1 excluída, o bloco some. | teste E2E |
| UX-12 | Com a conferência falhando, aparece o aviso que não bloqueia, com "Tentar de novo", e os campos aparecem, com a data e o horário da reunião da semana em Brasília. Com algo digitado, uma nova conferência que dê "já enviado" mostra o aviso no topo sem esconder os campos e sem perder o que foi digitado. | teste de componente (falha simulada) |
| UX-13 | "Editar relatório" no aviso (Pedro, C1) troca o diálogo pela edição de R2: o título "Editar relatório" recebe o foco, a autoria aparece, e os campos vêm com os dados de R2. Ao fechar, o foco volta ao "Novo relatório" que abriu o diálogo. | teste E2E |
| UX-14 | Situação: "Célula realizada" e "Não houve célula" ficam lado a lado também em 320 px, cada uma com pelo menos 44 px de altura e a área inteira clicável; "Célula realizada" vem marcada; as setas trocam a opção; o grupo se chama "Reunião". | teste de componente + teste E2E (medida) |
| UX-15 | Data: na sexta, 27/11, às 10:00, a lista de C1 tem só "Quarta, 25/11/2026", "Quinta, 26/11/2026" e "Sexta, 27/11/2026 (hoje)", com quarta e 20:00 sugeridos; na quarta, às 21:30, a data aparece como texto. Na edição de R1, a lista tem de domingo, 15/11, a sábado, 21/11, com a dica da semana. As opções seguem Brasília qualquer que seja o fuso do aparelho (critérios da RN-06 e da RN-18). | teste de componente (tempo simulado) |
| UX-16 | Horário: o campo segue o P62, com a tabela da T3 do E2.08 (UX-08 de lá). Na edição, "20:00:00" aparece como "20:00" e não conta como alteração. | teste de componente |
| UX-17 | No sábado, 28/11, às 23:00, com a data de C1 mudada à mão, escolher C5 deixa sábado, 28/11, e 22:00, com o aviso "Data e horário trocados pela reunião desta célula."; o tema e os participantes digitados ficam (critério da RN-18). | teste de componente |
| UX-18 | "Não houve célula" no lançamento: o formulário mostra "Reunião prevista: quarta, 25/11/2026, às 20:00" e o Motivo, sem Data e Horário. Com o tema e 2 participantes já preenchidos, aparece o aviso do P20 com `role="status"`; voltar para "Célula realizada" devolve os dois e tira o aviso. O envio não leva tema, participantes, visitantes, oferta nem observações (critério da RN-09). | teste de componente (payload) |
| UX-19 | Tema e Motivo vazios, ou só com espaços, mostram "Informe o tema ministrado." e "Informe o motivo de não ter havido célula.", sem requisição. | teste de componente |
| UX-20 | Participantes automáticos: em C1, a lista mostra André, Caio e Carla, como texto, antes do seletor; escolhendo Lucas, o total é "Participantes: 4", e o envio grava 4. No seletor, Caio e Carla aparecem desabilitados, com "Já entra automaticamente.". Em C4, a lista mostra Samuel uma vez e Magda, e o total é 2 (critério da RN-11). | teste de componente + teste E2E (massa) |
| UX-21 | Inativos: Fábio aparece no seletor como "Fábio Lima (inativo)", pode ser escolhido e mantém a marca no chip; uma mulher inativa aparece com "(inativa)"; quem quem lança não vê aparece sem marca. O envio com Fábio é aceito (critério da RN-10). | teste E2E (massa) |
| UX-22 | Participante excluído: na edição de R1, Bruno fica na linha "Continuam no relatório (cadastros excluídos): …", sem ✕, e conta no total. Excluído no meio tempo, o chip ganha "(cadastro excluído)", a mensagem aparece embaixo de "Outros participantes", e, depois de retirá-lo, o envio é aceito. | teste E2E |
| UX-23 | Visitantes: o primeiro campo vem aberto; "Adicionar visitante" e Enter num campo preenchido abrem outro, com o foco; Enter num campo vazio não envia; cada campo tem o botão de retirar com o nome do visitante, de 44×44 px no celular. Com "  João   Silva ", um vazio, "Maria" e "Maria", a tela mostra "Visitantes: 3", e o envio leva os três nomes, sem espaços sobrando; "Silva, João" é um visitante só (critério da RN-12). | teste de componente (payload) |
| UX-24 | Oferta: o campo tem `inputMode="numeric"`, começa vazio, e cada linha da tabela da T6 mostra o valor indicado. Vazio mostra "Informe a oferta. Se não houve oferta, informe R$ 0,00."; "0" é aceito e enviado como 0; "3750" é enviado como 37.5 (critério da RN-13). | teste de componente |
| UX-25 | Enviar sem tema, sem oferta e com o horário "25:00" mostra os três erros, cada um no seu campo, e "Confira os campos destacados (3).", com o foco no Horário, sem requisição (critério da RN-20). | teste de componente (requisições) |
| UX-26 | Recusas do servidor: cada caso da tabela da T7 aparece no lugar indicado, com o texto indicado; o formulário fica aberto, com os dados; nenhum toast de erro aparece; nenhuma mensagem técnica aparece (códigos, nomes de coluna, de constraint, de trigger ou de função, ou texto em inglês). | teste de componente (um mock por caso) |
| UX-27 | Com o formulário de Caio preenchido e R2 enviado por Carla antes dele, o envio mostra o `Alert` da RN-07 no topo, com o foco, e mantém o tema e os participantes digitados (critério da RN-19). | teste E2E |
| UX-28 | Repetição depois de queda: com a primeira tentativa gravada e a resposta perdida, a segunda mostra "O relatório desta semana já foi enviado. Confira na lista de Relatórios." como informação, com o ícone `CheckCircle2` e "Fechar"; C1 fica com um relatório só (critério da RN-07). | teste E2E (rede simulada) |
| UX-29 | Envio: "Enviando…" ou "Salvando…" com o indicador e os dois botões desabilitados; um duplo toque gera uma chamada só; "✕", `Esc` e o toque fora não fecham durante o envio; aos 3 s aparece "Ainda enviando…". Sem conexão, a mensagem do Negócio fica no rodapé, com `role="alert"`, os dados ficam, e o foco volta à ação primária. | teste de componente (mock) + teste E2E (offline) |
| UX-30 | Sucesso: "Relatório enviado." ou "Relatório atualizado."; a lista de Células mostra C1 "Enviado" sem recarregar a página; o detalhe de C1 mostra o relatório novo em primeiro; os cards da semana do Dashboard recarregam. Uma edição sem mudança mostra "Nenhuma alteração para salvar." sem requisição. O texto "O relatório foi salvo, mas os participantes ainda não" não existe mais. | teste E2E + teste de componente |
| UX-31 | Descartar: com algo digitado ou escolhido, "Cancelar", "✕", `Esc` e o toque fora pedem "Descartar as alterações?", com o foco em "Continuar editando". Só com a célula escolhida e a sugestão de data e horário, fecham direto. No estado de aviso, "Fechar" fecha direto. | teste de componente |
| UX-32 | Edição de R2 depois das mudanças de Rita em C1 (timóteo Fábio, tipo Discipulado, dia quinta): o bloco mostra Caio, Evangelística, "Quinta, 20:00" e a frase do retrato; a autoria fica no topo; André, Caio e Carla aparecem na lista fixa, sem ✕, com a dica da edição; o rodapé tem "Salvar alterações" (critérios da RN-14 e da RN-17). | teste E2E (massa) |
| UX-33 | Trocas na edição: passar R1 para "Não houve célula" mostra o aviso com o tema, 8 participantes, 2 visitantes, a oferta (R$ 50,00) e as observações; com Bruno excluído em R1, "Não houve célula" fica desabilitada, com o texto do Negócio ligado ao grupo; R3 de "Não houve célula" mostra a data e o horário como texto e, passado para célula realizada, pede Tema e Oferta e mostra André, Caio e Carla na lista fixa (critérios da RN-09 e da RN-16). | teste E2E (massa) |
| UX-34 | Lista de Relatórios: a linha de R2 mostra André e "G12: Pedro Alves" no cartão e na tabela; um relatório de C4 mostra "G12: Pastores"; depois de Rita trocar as pessoas de C1 por Diego, Pedro ainda acha R1 e R2 buscando "André". O botão do cabeçalho diz "Novo relatório" (critério da RN-14). | teste E2E (massa) |
| UX-35 | "Ver relatório" de um relatório de C1 excluída mostra "Célula de André Souza" e, depois da autoria, o bloco da célula com as pessoas e o tipo registrados e a frase do retrato. | teste de componente |
| UX-36 | Contraste e cor: mensagens no P21, o bloco da célula no `card`, o texto dos `Alert` em `text-foreground`; nenhum estado depende só de cor, nos temas claro e escuro. | inspeção (axe, temas claro e escuro) |
| UX-37 | Em 320 px e com zoom de 200%, nada rola na horizontal; rótulos, dicas, avisos, opções da situação, nomes com "(inativo)" e as opções de célula quebram linha sem corte; os botões do rodapé continuam alcançáveis. | inspeção + teste E2E (viewport) |
| UX-38 | Toque, em 360×800: opções da situação, "Adicionar visitante", "Fechar", "Editar relatório", "Tentar de novo" e os botões do rodapé com pelo menos 44 px de altura; os botões de retirar visitante com 44×44 px. | teste E2E (medida) |
| UX-39 | Leitor de tela: lê as `legend`; anuncia o título ao abrir; lê, com cada campo, o erro, o aviso e a dica, nessa ordem; anuncia como status "Conferindo…", os avisos (a) e (b), os totais e o resumo; anuncia como alerta o aviso (c), o `Alert` das recusas e a falha de conexão; os nomes dos botões de retirar trazem o nome da pessoa ou do visitante. | inspeção (leitor de tela) + teste de componente (nomes acessíveis) |
| UX-40 | Teclado do celular: ao abrir o formulário, nenhum campo recebe o foco, e o teclado não abre; Horário e Oferta têm `inputMode="numeric"`; os visitantes têm `autoCapitalize="words"`; o `Textarea` tem `text-base` abaixo de 768 px; a meta viewport tem `viewport-fit=cover`. | teste de componente + inspeção (aparelho real) |

### Perguntas para o `architect` (dados e contrato)
Em cada uma, a tela tem um comportamento padrão, o mais conservador, se a resposta for "não".

- **AQ-1. Conferência antes de preencher** (ponto 6 do Negócio, RN-19, P100). Uma leitura por célula, que devolva:
  - o "agora" e o "hoje" do servidor, em Brasília, e os limites da semana atual;
  - o momento da reunião da semana (data e horário);
  - a situação: pode enviar, já enviado, ainda não aconteceu, célula inativa, célula excluída ou célula que não se vê, na precedência da RN-19;
  - no "já enviado", só para quem vê o relatório: o id, a data, o horário, a situação (realizada ou não houve) e se quem consulta pode editá-lo;
  - na célula inativa, se quem consulta tem "Editar Célula", para a orientação da P-CEL-17;
  - na edição, os limites da semana do relatório e o "hoje" (pode vir na leitura do relatório).
  - A célula sem dia válido (não deve existir depois do E2.08) é tratada como falha da conferência (UXD-4).
  - *Padrão sem isso:* não há aviso antes de preencher; a data é calculada pelo relógio do aparelho convertido para Brasília, e todas as recusas aparecem no envio (T7).
- **AQ-2. Recusas com código e campo** (ponto 7 do Negócio, RN-20). O formato do E2.01 (22023, `HINT = 'app_error'` e `DETAIL` em JSON). A tela precisa distinguir, com o campo:
  - `cell_id`: sem célula; `date`: data inválida e edição fora da semana; um campo de par, por exemplo `date_time`, para o futuro e para antes da reunião; `time`; `theme`; `reason_not_held`; `offering`; `visitors`; `participant_ids`, com o `member_id` do excluído ou do invisível; `was_held`: a troca com participante excluído;
  - sem campo: sem permissão, célula inativa (com "pode editar a célula"), célula excluída, célula que não se vê, semana atual, um por semana (com a identificação só para quem vê o relatório), ainda não aconteceu (com o momento), relatório excluído, célula do relatório excluída e troca de célula.
  - *Padrão sem isso:* o texto do servidor vai para o `Alert` do topo, sem marcar o campo, e a UX-26 fica parcial.
- **AQ-3. Dados do bloco e das marcas** (RN-17, P105, P63).
  - As opções do seletor de célula precisam de timóteo, anfitrião, G12 (nome e nível do líder, para "Pastores" e "—"), tipo, dia, horário e endereço, para o bloco aparecer na hora, sem outra leitura. Hoje o `CELL_SUMMARY_SELECT` traz só líder, dia, horário e endereço.
  - A situação e o sexo das três pessoas, só para quem quem lança vê (AQ-2 do E2.08).
  - Na edição, a `cell_reports_view` precisa trazer o retrato: os ids e os nomes das pessoas registradas (com a situação e o sexo, só para quem quem edita vê), o tipo registrado, o G12 atual do líder registrado e o dia, o horário e o endereço atuais da célula.
  - *Padrão sem isso:* o bloco mostra só o que a opção tem, e o resto aparece depois de uma leitura própria, com `Skeleton`.
- **AQ-4. Envio idempotente** (RN-20, P107). O formulário gera o id do relatório ao abrir e o envia. Uma repetição com o mesmo id devolve o relatório já gravado, e a tela mostra o sucesso normal. É o que a AQ-3 do E2.08 sugeriu para a célula. Muda o texto da RN-20 (a repetição deixaria de receber a recusa), então depende do PO (PO-UX-9).
  - *Padrão sem isso:* o P107, com o texto do Negócio.
- **AQ-5. Participantes** (RN-10, RN-11, P103).
  - As opções da `members_view` sem o filtro de ativos, com a situação e o sexo para a marca.
  - O seletor precisa saber quem são os automáticos (os ids das pessoas da célula, AQ-3), para desabilitá-los.
  - Na edição, a `cell_report_participants_view` precisa dizer, por participante, se o cadastro foi excluído (já existe), se quem edita o vê (aviso do E2.02) e se é uma pessoa registrada (fixa).
  - O total é calculado na tela, como a união dos três conjuntos. Confirmar que é o mesmo número que o servidor grava.
- **AQ-6. "Agora" e limites na tela** (ponto 2 do Negócio, RN-04 a RN-06, RN-18). A tela confere o futuro e o antes da reunião ao enviar, com o "agora" da AQ-1 mais o tempo passado desde a leitura (`performance.now()`), e não com o relógio do aparelho. A tabela de casos única do Negócio inclui os casos de tela: aparelho em Lisboa e em Manaus, a virada de sábado para domingo com o formulário aberto e a reunião no próprio minuto.
- **AQ-7. Lista de Relatórios pelo retrato** (ponto 5 do Negócio, RN-14 d). A `cell_reports_view` com o nome do líder registrado, o nome e o nível do G12 atual dele e o texto de busca sobre o líder registrado. A paginação e a contagem não mudam.
- **AQ-8. Teto dos textos** (ponto 10 do Negócio). Tema, Motivo, Observações e cada nome de visitante. A tela não usa `maxLength`, que cortaria um texto colado sem avisar: ela confere ao enviar e mostra a mensagem embaixo do campo, como os outros erros (P22). Definir o teto e o texto.
- **AQ-9. O que o envio e a edição desatualizam** (P44). A lista de Relatórios; a lista de Células (situação do relatório e a coluna "pode enviar"); o detalhe da célula (últimos relatórios, situação e evolução); os cards da semana do Dashboard; a conferência em cache da célula; o filtro de vínculo celular de Membros (E2.07). Fechar depois de um aviso (a) ou (c) também recarrega a tela de origem.
- **AQ-10. Edição a partir do aviso** (UXD-13). A conferência devolve o id do relatório da semana para quem pode editá-lo. A edição lê esse relatório pela `cell_reports_view`, com o retrato (AQ-3), antes de mostrar os campos.
- **AQ-11. Ordem das opções de célula** (opcional, AQ-4 do E2.02). As células em que a pessoa é líder, timóteo ou anfitrião primeiro. Ajuda Caio e Pedro, que veem muitas células no ministério.

### Pendências para o PO (resolvidas em 2026-11-24)
Nenhuma bloqueia o desenho. Em todas, a UX adotou a opção marcada como "*Adotado*". O PO resolveu as onze em 2026-11-24, sem perguntas ao usuário: oito com o padrão da UX, e a PO-UX-7 e a PO-UX-9 com a sugestão da UX. A PO-UX-11 continua sem regra nova: virou uma recomendação para o E2.12 e a pergunta Q-8. Elas viraram os padrões P-REL-21 a P-REL-31 do Negócio, que ajustou as RN-02, RN-07, RN-08, RN-09, RN-13, RN-16 a RN-20, os critérios, os Textos de tela, as Telas afetadas, os Impactos e os Pontos para o `architect`.

Onde a resolução muda o que está escrito acima nesta seção, vale a resolução, e a UX ajusta o texto na próxima revisão. São dois casos:
- a PO-UX-7, na tabela da T7 e nos Estados;
- a PO-UX-9, no UXD-12, no F10, na T8, no P107, nos Textos e no UX-28.

**Revisar no PR.**

- **PO-UX-1. A situação em duas opções lado a lado** (UXD-5, P106). "Célula realizada" e "Não houve célula", no lugar da caixa "Não houve célula" do legado e de hoje.
  - *Adotado.*
  - *Alternativa:* a caixa "Não houve célula", desmarcada por padrão.
  - **Resolvida: aceito o padrão da UX (P-REL-21, RN-08).** As duas situações têm nome no Negócio, e os rótulos são os do legado. "Célula realizada" vem marcada, como a caixa desmarcada de hoje.
- **PO-UX-2. A data numa lista com os dias possíveis** (UXD-6, P104). "Quarta, 25/11/2026", com "(hoje)", só com os dias que o servidor aceita; com um dia só, como texto.
  - *Adotado.*
  - *Alternativa:* o calendário nativo, limitado pelos mesmos dias. No computador, ele deixa digitar uma data fora do limite, que só é recusada no envio.
  - **Resolvida: aceito o padrão da UX (P-REL-22, RN-16 e RN-18).** A lista só tem datas que o servidor aceita, calculadas em Brasília, e nomeia o dia da semana. As RN-16 e RN-18 e os critérios delas passaram a descrever a lista.
- **PO-UX-3. A oferta digitada pelos centavos** (UXD-9, P101). "5000" vira "50,00", como no legado e nos aplicativos de banco, com o campo vazio no começo (P-REL-11) e a dica "Se não houve oferta, informe 0,00.".
  - *Adotado.*
  - *Alternativa:* digitar o valor com a vírgula ("50" vira "50,00"). Quem vem do legado digitaria "5000" e mandaria R$ 5.000,00.
  - Na edição, ao passar um relatório de "Não houve célula" para célula realizada, a oferta começa vazia, a não ser que já seja maior que zero (T6). O 0 que o formulário de hoje grava em "Não houve célula" não é uma resposta, e mostrá-lo seria o valor sugerido que a P-REL-11 evita.
  - **Resolvida: aceito o padrão da UX, com o caso da edição (P-REL-23, RN-09 e RN-13).** É a digitação que quem vem do legado conhece. Vazio não é zero, e a dica diz como informar o zero. A RN-09 ganhou a oferta vazia na troca para célula realizada.
- **PO-UX-4. A ordem dos campos** (UXD-8): Reunião (situação, data, horário e tema), Participantes, Visitantes, Oferta e Observações.
  - *Adotado.*
  - *Alternativa:* a ordem do legado: tema e oferta, participantes, observações e visitantes.
  - **Resolvida: aceito o padrão da UX (P-REL-24).** Os campos e os rótulos são os do legado. Muda só a ordem, que junta quem esteve na reunião e deixa o texto livre no fim.
- **PO-UX-5. Conferência que falha por conexão** (UXD-4). Os campos aparecem com um aviso que não bloqueia, e a conferência fica para o envio. A RN-19 não diz o que fazer quando a conferência não consegue responder.
  - *Adotado.* O servidor confere tudo no envio, e o líder com internet fraca pode adiantar o preenchimento.
  - *Alternativa:* não deixar preencher até a conferência responder.
  - **Resolvida: aceito o padrão da UX (P-REL-25, RN-19 d).** O aviso antes de preencher é uma ajuda, e não a regra: a regra é conferida no envio. A RN-19 ganhou o item (d), com o texto do aviso e um critério.
- **PO-UX-6. "Salvar alterações" na edição.** Os Textos de tela dizem "Salvar". Os formulários de membro, de célula e de função usam "Salvar alterações" (E2.04, E2.05 e E2.08), e os botões levam verbo e objeto. Também "Enviando…" no lugar de "Salvando…" durante o lançamento.
  - *Adotado:* "Salvar alterações" e "Enviando…".
  - *Alternativa:* "Salvar", como nos Textos de tela.
  - **Resolvida: aceito o padrão da UX (P-REL-26, RN-20).** É o que os outros formulários usam. Os Textos de tela foram corrigidos.
- **PO-UX-7. Texto da recusa de quem não pode lançar numa célula.** A RN-02 deste spec usa "Você não tem permissão para esta ação.". A RN-13 e a T11 do E2.02 usam "Você não pode enviar o relatório desta célula." (código `report_submit_not_allowed`) para quem tem uma permissão de lançar, mas não para aquela célula (Lucas em C1, no critério da RN-02).
  - *Adotado:* a tela mostra o texto que o servidor devolver, no `Alert` do topo.
  - *Sugestão:* "Você não pode enviar o relatório desta célula." quando a pessoa tem alguma permissão de lançar, e "Você não tem permissão para esta ação." quando não tem nenhuma. O PO alinha os dois specs.
  - **Resolvida: aceita a sugestão da UX, que é a regra do E2.02 (P-REL-27, RN-02).** O E2.02 já está na `main` com esse texto e o código `report_submit_not_allowed`. A RN-02 daqui passou a usar os dois textos, e o critério de Lucas em C1 recebe "Você não pode enviar o relatório desta célula.". Um critério novo cobre quem não tem nenhuma permissão de lançar. O E2.02 não muda. A tabela da T7 e os Estados passam a mostrar os dois textos.
- **PO-UX-8. Os rótulos do bloco não mudam com o sexo.** O critério da RN-17 diz "Anfitriã Carla", e os Textos de tela dizem "Anfitrião".
  - *Adotado:* "Líder", "Timóteo" e "Anfitrião" fixos, como nos Textos de tela e no detalhe da célula (E2.10). Assim, o rótulo também não revela o sexo de quem quem lança não vê.
  - *Alternativa:* "Anfitriã" para mulheres, só quando quem lança vê a pessoa.
  - **Resolvida: aceito o padrão da UX (P-REL-28, RN-17).** O rótulo é do papel, como no detalhe da célula, e não revela o sexo de quem quem lança não vê. O critério da RN-17 foi corrigido para "Anfitrião Carla".
- **PO-UX-9. A repetição depois de uma queda** (UXD-12, P107, AQ-4).
  - *Adotado:* como diz a RN-20, a repetição recebe "já foi enviado", e a tela mostra o texto do Negócio como informação, com "Fechar" e a identificação do relatório para quem o vê.
  - *Sugestão:* com o envio idempotente da AQ-4, a repetição vira o sucesso normal ("Relatório enviado."). A RN-20 passaria a dizer que a repetição do mesmo envio é aceita sem gravar outro relatório.
  - O texto "Confira na lista de Relatórios." manda para outra tela quem abriu pelo Dashboard ou pela lista de Células. *Sugestão:* "O relatório desta semana já foi enviado." e a identificação, sem a segunda frase.
  - **Resolvida: aceita a sugestão do envio idempotente (P-REL-29, RN-07 e RN-20; AQ-4).**
    - Repetir o mesmo envio, do mesmo formulário, depois de uma queda de conexão, não grava outro relatório nem outro evento, e a tela mostra o sucesso normal, "Relatório enviado.".
    - Se o formulário foi alterado entre as tentativas, vale o que foi gravado na primeira, e a tela mostra "O relatório foi enviado na primeira tentativa. As alterações feitas depois não foram salvas.". Quem lança não edita depois do envio (RN-03), então aplicar as alterações seria uma edição sem permissão.
    - Um envio de outro formulário continua recebendo a recusa da RN-07, no aviso (a) ou no `Alert` do topo.
    - O texto "O relatório desta semana já foi enviado. Confira na lista de Relatórios." sai dos Textos de tela.
    - O P107 fica só para quando o envio idempotente não estiver disponível, e a UX ajusta o UXD-12, o F10, a T8, os Textos e o UX-28.
    - O ponto 12 dos Pontos para o `architect` descreve o contrato.
- **PO-UX-10. Textos definidos pela UX** (marcados com † em Textos):
  - a dica do seletor de célula, a opção em duas linhas e o nome do bloco;
  - os textos da conferência e da troca de célula;
  - as opções de data com "(hoje)" e as dicas do par Data e Horário;
  - os avisos do que sai na troca de situação (P20);
  - a dica do Motivo, com exemplos;
  - a frase do retrato na edição;
  - "Outros participantes", "Já entra automaticamente." e "Retirar {Nome}";
  - os textos dos visitantes ("Um nome por campo.", "Nome do visitante", "Retirar o visitante …", "Visitantes: {N}");
  - a dica da oferta;
  - "Enviando…" e "Ainda enviando…";
  - os textos das respostas possíveis da T12 (Q-1 a Q-7), que só valem se a pergunta virar regra.
  - *Adotados.*
  - **Resolvida: aceitos os textos da UX (P-REL-30).** Os que estão ligados a uma regra foram copiados para os Textos de tela do Negócio:
    - o bloco da célula na edição;
    - as opções e as dicas da data;
    - a troca de célula;
    - a conferência;
    - "Já entra automaticamente.";
    - a dica do Motivo;
    - o que sai na troca de situação;
    - a dica da oferta;
    - "Enviando…".

    Os da T12 só valem se a pergunta virar regra.
- **PO-UX-11. Sugestões que não entram** (não adotadas, porque pedem regra nova):
  - **"Ver relatório" no aviso de "já foi enviado"**, para quem vê o relatório e não pode editá-lo (Carla), quando o painel do E2.12 valer para todas as linhas. Hoje a P-REL-05 oferece só "Editar relatório".
  - **"Repetir os participantes do último relatório"**: um atalho que traria os participantes do relatório anterior da célula, para a pessoa só tirar quem faltou e incluir quem veio. É o passo mais demorado do fluxo mais frequente (F1). Pede uma regra: qual relatório, e o que fazer com quem a pessoa não vê ou foi excluído.
  - **Resolvida: nenhuma das duas entra neste passo (P-REL-31).**
    - "Ver relatório" no aviso não pede permissão nova, mas depende da consulta do E2.12 para todos que veem o relatório. Virou um impacto no E2.12.
    - "Repetir os participantes" pede regra nova e virou a pergunta Q-8, para o usuário.

## Solução técnica
_Seção do `architect`. Escrita em 2026-11-24, só como desenho: nada foi implementado. **O PR 1 de banco começa depois do E2.01 inteiro, do PR 1 do E2.02, do banco do E2.05 (PR 1), do PR 1 do E2.06, dos PRs 1 e 2 do E2.08 e do banco do E2.09 em produção.** Os PRs de front esperam também o front desses passos que mexe nas mesmas telas ([Implantação](#implantação)). O desenho parte do estado final deles, com os nomes que eles definem. Se um nome ou uma assinatura mudar lá, as tarefas 2 e 5 voltam ao `architect`._

_Conferido em 2026-11-24:_
- _na stack local `supabase_db_mci-e108-pr2`, só com leitura (E1.08 completo e as migrations 1 a 6 do E2.01):_
  - _colunas, padrões, índices, FKs, políticas, triggers e privilégios de `cell_reports` e `cell_report_participants` (hoje `authenticated` tem INSERT e UPDATE nas duas e DELETE em participantes; `service_role` tem tudo);_
  - _os corpos de `_del_raise`, `_del_lock_cell_week`, `enforce_cell_report_rules`, `enforce_participant_rules`, `enforce_unique_weekly_cell_report`, `enforce_cell_report_current_week`, `enforce_insert_permission`, `viewer_can_insert_cell_report_participant`, `set_cell_report_participants`, `delete_cell_report`, `restore_cell_report`, `week_start`, `sp_now` e `sp_today`;_
  - _as colunas da `cells_view`, da `cell_reports_view` e da `cell_report_participants_view`;_
  - _que `postgres` não é superusuário, mas pode usar `SET LOCAL session_replication_role = replica` e definir uma variável própria (`mci.*`) na transação; depois do `ROLLBACK`, `current_setting('mci.x', true)` devolve texto vazio, e não nulo;_
  - _os SQLSTATE das conversões: `'2026-02-30'::date` e `'25:00'::time` dão 22008, `'abc'::date` dá 22007, `'x'::numeric` dá 22P02; `numeric(10,2)` arredonda 10,555 para 10,56 sem avisar;_
  - _a [conferência](#conferência-em-produção-tarefa-1), que rodou sem erro;_
- _no `mci-connect` (`origin/main`, `4595daa`): `CellReportForm.tsx`, `use-save-cell-report.ts`, `report-form.ts`, `src/lib/cell-reports/fields.ts`, `use-cell-options.ts`, `src/lib/cells/fields.ts`, as massas de `e2e/exclusao-*.spec.ts` e a lista de pgTAP que gravam em relatório; e, na branch `feat/E2.01-pr4-ver-relatorio`, o `CellReportSheet` e o `use-cell-report`;_
- _no legado: `Domain/Model/Report.cs` (`LeadershipId`, `HostId` e `TimothyId` são `int`, nunca nulos; `CellType` é anulável);_
- _nos specs: E2.01 (DT-09, DT-15, RN-13, formato `app_error`, ordem das travas), E2.02 (funções de linha, `can_submit_report`, predicados canônicos, DA-5, DA-12), E2.05 (`current_actor`, `zz_stamp_authorship`, `save_cell_report`, `audit_fields`), E2.06 (`private.member_hierarchy`), E2.08 (`ac_enforce_cell_report_active`, `cell_types`, `normalize_meeting_time`, `is_valid_meeting_time`, `TimeInput`), E2.09 (`sp_local`, `sp_instant`, `refreshAfterReportWrite`), E2.10 (`cell_recent_reports`, `cell_identity`) e o Negócio do E2.12 (sem commit, só lido)._

### Divergências do PR 1 (implementado)
Registradas em 2026-11-27, depois do PR 1 em produção. Valem sobre o desenho abaixo; o PR 2 parte delas.
1. **Trigger do retrato `ENABLE ALWAYS`** (DT-02, "Trigger do retrato"): dispara também em `replica` (carga do E4.06 e massas com datas passadas), mas ali só completa pela célula, no INSERT, as colunas `snapshot_*` que vieram nulas (o retrato do legado fica) e, no UPDATE, não faz nada (a carga pode corrigir o retrato). Fora de `replica`, segue a DT-02. O "tipo vazio → o da célula" do E4.06 passa a ser feito por ele.
2. **`viewer_can_insert_cell_report_participant` também pelo retrato** (DT-04): até o PR 2 remover a escrita direta (DT-11), a inclusão de participante segue a mesma visibilidade do relatório.
3. **Políticas com os `viewer_has` num *InitPlan*** (DT-04): as permissões são lidas uma vez por consulta, antes da função de linha `viewer_sees_report_people`; o resultado é o mesmo, por desempenho.
4. **`snapshot_*` em `audit-fields.json` já no PR 1**, na lista `not_data` de `cell_reports` (o retrato não entra nos eventos, como diz a Escrita; a lista de campos do E2.05 exige decisão para toda coluna nova).
5. **`e208_concurrency.sh`, cenário 3b**: passou a esperar a recusa (`report_cell_immutable`), porque a troca da célula do relatório deixou de existir.

### Divergências do PR 2 (implementado)
Registradas em 2026-11-27, no PR 2 (migrations `20261130100000_e211_02_rules` e `20261130100100_e211_03_write`). Valem sobre o desenho abaixo; o PR 4 (front) parte delas.
1. **Portão antes de tudo:** as quatro RPCs chamam `viewer_member_id()` logo depois de `current_actor()`, antes da repetição (DT-06). Conta com a marca do E2.03 ou sessão encerrada não recebe nem o `replayed`.
2. **Códigos técnicos a mais**, fora da tabela de erros (a tela nunca os provoca): `was_held_invalid` (`field: "was_held"`, situação ilegível pela API) e `participant_not_found` (`field: "participant_ids"`, `member_id`: id que não é de ninguém). A tabela de mensagens está em `private.report_message`.
3. **Limite de participantes antes da trava:** o `too_many_participants` é conferido pelo tamanho do conjunto (escolhidos sem repetição mais os automáticos, ou o conjunto final da edição) antes de travar e ler os membros. Muda só a ordem entre recusas do mesmo campo e evita travar milhares de linhas.
4. **Ordem da edição igual à do lançamento:** reunião (9) → participantes (10) → visitantes, oferta e observações (11). A tabela da edição punha os participantes depois de todos os campos.
5. **`private.report_launch_status(now, meeting, has)`** (pura) decide `already_sent`/`not_yet`/`can_submit`; a conferência e a tabela de casos usam a mesma.
6. **Marca devolvida, não apagada:** as RPCs guardam o valor anterior de `mci.cell_report_write` e o devolvem no fim (passo 17), para não desligar a marca de uma manutenção que chame a RPC.
7. **Guarda dos participantes também no UPDATE** (o desenho: INSERT e DELETE); o `REVOKE` inclui `anon`; as políticas de escrita saem por laço em `pg_policies` (`cmd <> 'SELECT'`), o que cobre as antigas do E1.01; `enforce_insert_permission` fica só com o ramo de `cells`.
8. **Entrada (`private.report_input`):** `was_held` nulo vale como ausente; data, horário e oferta vazios ou só com espaços valem como ausentes (obrigatórios); oferta `NaN`/`Infinity` é inválida; nulos dentro de `visitors` são descartados como vazios.
9. **`cell_report_edit_context`** devolve a linha para quem vê o relatório, sem exigir "Editar Relatórios de Células" (só datas). A service role recebe `existing_*` na conferência.
10. **Testes dos passos anteriores adaptados** (leitura técnica 8): massas com a marca e o lançamento e a edição pelas RPCs. Duas expectativas do E2.02 mudam pela DA-7: célula excluída que quem lança não vê dá `not_found_or_deleted` (antes `cell_deleted`). O `e201_07` passou a conferir a permissão dentro das RPCs; o `e211_migrations.sh` roda de novo a cadeia das três migrations.
11. **Forma da data e do horário pela API** (ajuste da revisão do PR 2): `private.report_input` só aceita data `AAAA-MM-DD` e horário `HH:MM`, `HH:MM:SS` ou com fração de segundo antes do cast; o resto (`today`, `yesterday`, `now`, `25/11/2026`, `9:30`) é `report_date_invalid`/`report_time_invalid`. O cast de texto livre dependia do `DateStyle` e aceitava palavras relativas numa função `IMMUTABLE`. Casos `api_input` (I01 a I16) na tabela de casos.
12. **`TRUNCATE` revogado** de `cell_reports` e `cell_report_participants` para `authenticated`, `anon` e `service_role` (ele não passa pelo RLS nem pela guarda de linha), com a pós-condição e o pgTAP `e211_05`.

### Divergências dos PRs 3 e 4 (implementado)
Registradas em 2026-11-27 (mci-connect#58). Valem sobre o [Front](#front) e a UX.
1. **Um diálogo só** (`ReportFormDialog` + `useReportShell`, `src/components/cell-reports/report-shell.ts`): o conteúdo (lançamento, carregando, edição) informa à casca o título, o rodapé e o "Fechar". A troca para a edição pelo aviso (UXD-13) e o fim do carregando não remontam o `Dialog`, e o foco volta a quem abriu (UX-13).
2. **Chaves fora de `["cell_reports"]`** (AQ-9): a conferência e a edição usam `["cell_report_form", …]`, sem cache (`gcTime: 0`). A gravação desatualiza `["cell_reports"]` com o formulário ainda aberto, e a conferência não deve ser relida nesse instante. Cada abertura e cada escolha de célula conferem de novo.
3. **Edição só depois de tudo carregado:** a linha, o `cell_report_edit_context` e os participantes chegam antes dos campos (sem o `Skeleton` só dos participantes da tabela de Estados).
4. **Repetição (AQ-4):** `replayed` com `same_content` é o sucesso normal ("Relatório enviado."); sem `same_content`, o toast de P-REL-29. O P107 ficou para o "já foi enviado" depois de uma queda neste formulário (outro caminho que grava a semana).
5. **Sem célula, só o erro dela** (`validateReportForm`): os outros campos não estão na tela (UXD-2), e o resumo conta 1.
6. **Gravação sem rede:** as mutações usam `networkMode: "always"` (sem isso, o TanStack Query pausa o envio offline e o botão fica em "Enviando…") e um tempo-limite de 20 s que cobre também a espera da sessão.
7. **Bloco da célula no "Ver relatório"** sem a marca "(inativo)" (só nomes): a marca é do formulário (P63).
8. **Detalhe da célula (E2.10):** ainda sem tela; o `CellReportDialog` é o que ele deve abrir.
9. **`PaginatedSelect`** ganhou `description` (segunda linha da opção, P5 da opção de célula) e `removeLabel` ("Retirar {Nome}").
10. **Massa dos E2E** que lança pela tela: `CellsWorld.meetingAlreadyHappened` põe a reunião hoje à 00:00, para o lançamento não depender da hora (RN-06).

### Revisão das regras
Nenhuma RN voltou ao PO. As lacunas técnicas foram resolvidas pela leitura mais conservadora e estão em [Definidas pelo architect](#definidas-pelo-architect-revisar-no-pr).

Casos de borda conferidos:
- **Fuso:** "agora" é `sp_local(now())` (E2.09), o início da transação da chamada, em `America/Sao_Paulo`. Nenhuma conta usa o fuso da sessão nem o relógio do aparelho. As regras são funções puras que recebem o "agora" local, testadas pela tabela de casos com a sessão em UTC, em Brasília e em Asia/Tokyo.
- **Virada de semana:** a semana é a de `sp_local(now())` no momento em que o envio chega. O formulário aberto no sábado às 23:50 e enviado no domingo às 00:02 recebe a recusa da RN-04. A célula de sábado às 23:30 aceita relatório entre 23:30 e 23:59:59.
- **Virada de horário:** o futuro é comparado no minuto ("o próprio minuto de agora é aceito"); a reunião, no segundo (às 19:59:59 a reunião das 20:00 ainda não aconteceu).
- **Casal:** nenhuma regra olha o cônjuge. O cônjuge entra como participante só se for escolhido (RN-10).
- **Inativo:** quem lança pode estar inativo; participante inativo é aceito; a célula inativa não recebe relatório (E2.08).
- **Sem líder e pastor:** podem lançar, ser registrados e participar. O G12 do relatório segue a RN-11 do E2.06.
- **Excluído:** o retrato pode apontar para membro excluído (FK sem cascata, E2.01); o participante excluído fica e não sai; o escolhido excluído é recusado com a trava do E2.01.
- **Consolidado (futuro):** ver "Fora de escopo" do Negócio. A flag nova entra no `viewer_sees_member` e na validação dos participantes.
- **Concorrência:** um por semana, retrato × edição da célula, inativação, exclusões, duas edições e a repetição do envio. Ver [Bloqueios e concorrência](#bloqueios-e-concorrência).
- **Volume:** a visibilidade passa a filtrar o relatório pelas três colunas do retrato, com índices. Ver o risco 9.

Leituras técnicas. Nenhuma muda regra, mas o PO e o QA precisam saber delas:
1. **"Agora" é o início da transação.** Uma chamada que começa às 20:59:59,9 e termina às 21:00:00,2 vale como 20:59:59.
2. **Gravação direta pela API é recusada pelo privilégio** (`42501`, "permission denied for table …"), com a mensagem do Postgres. É o "recusada" do critério da RN-01. A tela nunca faz isso.
3. **Até o PR 3, a lista de Relatórios mostra o líder atual da célula**, mas a visibilidade já segue o retrato desde o PR 1. Na publicação, os dois coincidem (o retrato recebe as pessoas atuais, RN-21).
4. **A troca de célula num relatório é recusada já no PR 1**, pelo trigger do retrato. A tela de hoje já não oferece a troca.
5. **O lançamento por `save_cell_report(NULL, …)`** continua aceito durante a janela entre a publicação do banco e o promote do front (DA-12), com todas as regras, mas sem a repetição segura.
6. **Um relatório gravado pela service role** só é reconhecido como "o mesmo envio" numa nova chamada da service role (o autor é "Sistema", E2.05).
7. **A DA-5 do E2.02 termina no PR 2:** quem só lança deixa de incluir participantes depois do envio (RN-03).
8. **Os pgTAP, as massas do Playwright e o script de concorrência** dos passos anteriores que gravam relatórios direto passam a precisar da marca de manutenção (DA-11). As asserções sobre as políticas de INSERT e UPDATE de relatório e sobre a DELETE de participantes passam a esperar o `42501` do privilégio.

#### Respostas aos pontos do PO
| Ponto | Resposta |
|---|---|
| 1. Um caminho só | `submit_cell_report` (lançamento) e `save_cell_report` (edição, mesmo nome e retorno do E2.05), ambas *definer*, cada uma numa transação. Absorvem a `save_cell_report` do E2.05 e a `set_cell_report_participants` do E2.01, que sai. `authenticated` e `service_role` perdem INSERT e UPDATE em `cell_reports` e INSERT, UPDATE e DELETE em participantes; as políticas de escrita saem. O código do próprio banco é barrado por um trigger de guarda, a não ser dentro das RPCs ou com a marca de manutenção (DT-10, DA-11). A carga roda em `replica`. |
| 2. "Agora" no servidor | `sp_local(now())`. As regras ficam em funções puras de `private`, que recebem o "agora" local. A tabela de casos `report-rules-cases.json` gera o pgTAP e alimenta o Vitest (DT-17). |
| 3. Triggers de semana | Saem `enforce_cell_report_current_week_trigger` e `enforce_unique_weekly_cell_report_trigger` e as duas funções. O índice `cell_reports_cell_week_key` fica e vale na carga. Na RPC, a trava (célula, semana) do E2.01 dá a mensagem da RN-07 também na corrida, e o `unique_violation` do índice vira a mesma recusa (DT-09). |
| 4. Retrato e corrida com a célula | Trigger `ad_cell_report_snapshot`: no INSERT, lê líder, timóteo, anfitrião e tipo numa leitura só, com `FOR SHARE` na célula, e ignora o que veio. Uma edição da célula espera o relatório, ou o contrário: o retrato é todo de antes ou todo de depois. A RPC usa o retrato devolvido pelo INSERT para os participantes automáticos. No UPDATE, o retrato fica como estava e a troca de célula é recusada (DT-02). |
| 5. Visibilidade pelo retrato | `viewer_sees_report_people(líder, timóteo, anfitrião)` nas políticas; a forma em conjunto nas views (`cell_reports_view`, `cell_reports_deleted_view`); item (d) da RN-02 do E2.02 pelas pessoas registradas. Participantes, `cell_recent_reports`, `cell_identity` e as RPCs do Dashboard herdam (DT-04). |
| 6. Conferência antes de preencher | `cell_report_launch_check(_cell_id)`: só leitura, *definer*, com a precedência da RN-19. O relatório da semana só sai para quem o vê (DT-13). |
| 7. Recusas com código e campo | Formato `app_error` do E2.01, com `field` (inclusive `date_time` e `was_held`). A recusa de permissão segue o E2.02: `42501` sem nenhuma permissão de lançar e `report_submit_not_allowed` para quem vê a célula e não pode lançar nela ([Formato dos erros](#formato-dos-erros-aq-2)). |
| 8. Relatórios existentes | Na migration 1, na mesma transação e antes da troca da visibilidade: as colunas, o preenchimento com as pessoas e o tipo atuais da célula (em `replica`, sem evento), a guarda, o `NOT NULL` e só então as views e as políticas (DT-03). |
| 9. Oferta | Sem padrão; nula em "Não houve célula"; `CHECK` de 0 a R$ 999.999,99 (vale na carga); obrigatória na célula realizada e com até 2 casas, na RPC, que confere o valor antes de o `numeric(10,2)` arredondar (DT-15, DA-5, DA-6). |
| 10. Tamanho dos textos | Tema 300, motivo 2000, observações 4000 e cada visitante 150 caracteres, na RPC, com mensagem no campo. Na edição, só o campo alterado é conferido (DA-4). |
| 11. Edição simultânea | `save_cell_report` trava o relatório com `FOR NO KEY UPDATE` e grava o conjunto final de participantes calculado depois da trava. A segunda edição espera a primeira e grava o próprio conjunto inteiro: nunca uma mistura. |
| 12. Envio que pode ser repetido | O formulário gera o `id` do relatório ao abrir. A nova chamada com o mesmo `id`, do mesmo autor, devolve `replayed`, sem gravar e sem evento, e diz se o conteúdo é igual ao gravado. Outro autor recebe uma recusa técnica, sem nada do relatório. A permissão é conferida de novo quando a primeira tentativa não foi gravada (DT-06). |
| 13. Ordem dos passos | Ver [Implantação](#implantação). |

#### Definidas pelo architect (revisar no PR)
Pontos que as RNs não respondem por inteiro. O `architect` adotou a leitura mais conservadora e coerente com as RNs. O usuário pode mudar qualquer um no PR.

| # | Ponto | Padrão adotado | Por quê |
|---|---|---|---|
| DA-1 | Repetição do envio quando o relatório gravado na primeira tentativa já foi excluído | Recusa com "Este relatório não existe ou já foi excluído." (`not_found_or_deleted`, relatório) | Mostrar "Relatório enviado." para um relatório que não existe mais contradiria a lista e a situação. É raro: pede uma queda de conexão e uma exclusão em segundos. |
| DA-2 | Nova chamada com um `id` já usado por outra pessoa (ou pela service role) | Recusa técnica `report_id_conflict`, sem revelar nada do relatório. O mesmo autor com outra célula ou outro conteúdo recebe `replayed` com "conteúdo diferente" (P-REL-29). | O `id` é escolhido pelo navegador. Só o autor pode receber a confirmação do próprio envio. |
| DA-3 | Edição de um relatório que continua "Não houve célula" | Data, horário, tema, visitantes, oferta, observações e participantes enviados pela API são ignorados; os gravados ficam. | RN-09: o relatório de "Não houve célula" "fica como está"; RN-16: a tela mostra a data e o horário só para leitura. É a mesma regra do lançamento ("enviados pela API são ignorados"). |
| DA-4 | Teto dos textos (AQ-8) | Tema 300, motivo 2000, observações 4000, cada visitante 150 caracteres. No lançamento, todos; na edição, só os campos alterados. A carga não confere. | Bem acima do uso real (o tema típico tem menos de 60 caracteres). Conferir na edição um campo que não mudou impediria corrigir o tema de um relatório do legado com observações longas. |
| DA-5 | Teto da oferta | R$ 999.999,99, num `CHECK` que vale também na carga. | O ponto 9 pede um teto. Cabe na máscara da tela e no `numeric(10,2)`. Não afeta o uso real e barra erro de digitação absurdo e abuso pela API. |
| DA-6 | O que o "Não houve célula" grava nos campos que não tem | Oferta nula (e não 0), visitantes vazios (`{}`), tema e observações nulos. | RN-09 e Impactos do E2.10: oferta "não informada" é nula, e o 0 seria uma resposta. Os relatórios antigos com 0 ficam como estão. |
| DA-7 | Célula excluída que quem lança não vê | "Esta célula não existe ou já foi excluída." (`not_found_or_deleted`). "Esta célula foi excluída e não recebe relatórios." só para quem vê as pessoas da célula. | RN-09 (a) do E2.02: o que não se vê é tratado como inexistente. Assim a recusa não revela que uma célula invisível existe e foi excluída. Os critérios da RN-02 usam Caio, que é pessoa da célula. |
| DA-8 | Ordem dentro do item 1 da RN-20 | Sem nenhuma permissão de lançar (42501) → célula vazia na chamada (`cell_required`) → célula invisível → excluída → sem direito nela (`report_submit_not_allowed`) → inativa. | A ordem dos triggers do E2.01, do E2.02 e do E2.08 (DA-7 de lá). A célula vazia vem antes porque as outras dependem dela. |
| DA-9 | Pessoa registrada que não é participante, num relatório antigo de célula realizada | Não é acrescentada pela edição. Pode ser incluída pelo seletor, como qualquer membro, com a RN-10 (visibilidade). | RN-11: "a edição não as acrescenta a um relatório antigo que não as tenha". A UX (T9) já prevê a inclusão pelo seletor. |
| DA-10 | O que a conferência diz do relatório da semana | O `id`, a data, o horário e a situação, para todos que veem o relatório; "pode editar" à parte. | RN-07 e AQ-10. Com o `id`, a "Ver relatório" do E2.12 (P-REL-31) não pede outra leitura. Quem não vê o relatório não recebe nada além de "já foi enviado". |
| DA-11 | Gravações fora das RPCs feitas pelo próprio banco (pgTAP, massas do Playwright, SQL Editor, manutenção) | Só com `SET LOCAL mci.cell_report_write = 'on'`. Ela dispensa as regras de lançamento e de edição, inclusive as de data; o retrato, os `CHECK`s, o índice da semana e os triggers do E2.01 e do E2.08 continuam valendo. A carga continua em `replica`. | RN-01 ("nenhuma gravação direta escapa"): a marca é explícita, fica na transação e não está ao alcance da API. Os testes precisam montar relatórios de semanas passadas, que nenhuma regra de lançamento aceita. |
| DA-12 | `save_cell_report(NULL, …)`, o lançamento do E2.05 | Continua lançando, com todas as regras e um `id` gerado no servidor, sem a repetição segura. Sai no próximo passo de banco que mexer em relatórios (E2.12). | Cobre a janela entre o "Deploy: banco" do PR 2 e o promote do PR 4: o front do E2.05 continua enviando. |

### Visão geral
Quatro partes:

1. **Retrato** (PR 1). Quatro colunas novas em `cell_reports`, preenchidas para os relatórios que já existem e, daí em diante, por um trigger que lê a célula com `FOR SHARE`. A visibilidade dos relatórios passa a olhar o retrato nas views e nas políticas. A `cell_reports_view` ganha os nomes do retrato e o G12 atual do líder registrado.
2. **Regras num lugar só** (PR 2, migration 2). Funções puras para a semana, a reunião da semana, as datas aceitas e as recusas de data, uma normalização da entrada e um módulo de mensagens. Duas leituras para a tela: a conferência antes de preencher e o contexto da edição.
3. **Escrita** (PR 2, migration 3). `submit_cell_report` e `save_cell_report`, *definer*, numa transação, com a ordem da RN-20. A escrita direta fecha: privilégios, políticas e um trigger de guarda. Saem os triggers de semana, a `set_cell_report_participants` e os triggers que só serviam à escrita direta.
4. **Front** (PRs 3 e 4). A lista e a consulta pelo retrato; o formulário da UX num componente só, com a regra pura em `src/lib/cell-reports/` e a mesma tabela de casos do banco.

### Modelo de dados e migrations

#### Ordem das migrations
Os nomes são sugestões; o timestamp é o do momento da criação.
- Cada arquivo é idempotente (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP … IF EXISTS` antes de `CREATE TRIGGER` e `CREATE POLICY`, `DO` com guarda de `duplicate_object`) e roda num banco zerado depois das migrations dos passos anteriores.
- **As mensagens das guardas trazem só ids e nomes de regra.** Os logs do GitHub Actions de um repositório público são públicos.
- Depois de cada PR com migration, regenere o `types.ts`.

| # | PR | Arquivo | Conteúdo | Por que separado |
|---|---|---|---|---|
| 1 | 1 | `<ts>_e211_01_snapshot.sql` | Guarda de pré-requisitos; colunas do retrato; preenchimento dos relatórios existentes; guarda; `NOT NULL`, FKs, `CHECK` e índices; trigger `ad_cell_report_snapshot`; `viewer_sees_report_people`; `cell_reports_view`, `cell_reports_deleted_view` e `cell_report_participants_view`; políticas de SELECT e UPDATE de `cell_reports` | Muda quem vê o quê. Compatível com o front em produção: a escrita direta continua, e o trigger preenche o retrato. |
| 2 | 2 | `<ts>_e211_02_rules.sql` | Guarda; enums `report_launch_status` e `report_submit_outcome`; `private.report_limits`; funções puras de data; `private.report_input`; mensagens; `cell_report_launch_check` e `cell_report_edit_context` | Só funções e leituras. Não muda nenhuma gravação. |
| 3 | 2 | `<ts>_e211_03_write.sql` | Guarda; `submit_cell_report`; `save_cell_report` reescrita; funções internas de participantes e de repetição; trigger de guarda; trigger dos participantes registrados; oferta sem padrão e com `CHECK` (com guarda); saída dos triggers de semana, das políticas de escrita, dos triggers e das funções que só serviam à escrita direta e da `set_cell_report_participants`; `REVOKE` | Fecha a escrita direta: vai ao ar junto com o front do PR 4. |

#### Retrato (migration 1)
```sql
-- 0. Pré-requisitos. Falha cedo, sem mudar nada.
DO $$ BEGIN
  IF to_regprocedure('public.viewer_scope_contains_any(uuid[])') IS NULL            -- E2.02 PR 1
     OR to_regprocedure('public.viewer_sees_cell_people(uuid,uuid,uuid)') IS NULL
     OR to_regprocedure('public.can_submit_report(uuid)') IS NULL
     OR to_regprocedure('private.current_actor()') IS NULL                            -- E2.05 PR 1
     OR to_regclass('private.member_hierarchy') IS NULL                               -- E2.06 PR 1
     OR to_regprocedure('public.cell_types()') IS NULL                                -- E2.08 PR 2
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.cell_reports'::regclass
                     AND tgname = 'ac_enforce_cell_report_active')                    -- E2.08 PR 1
     OR to_regprocedure('public.sp_instant(timestamp without time zone)') IS NULL     -- E2.09
     OR has_table_privilege('authenticated', 'public.cell_reports', 'DELETE') THEN    -- E2.01 PR 2
    RAISE EXCEPTION 'E2.11 depende do E2.01, E2.02, E2.05, E2.06, E2.08 e E2.09 em produção.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.cell_reports'::regclass
              AND attname IN ('leader_id', 'timothy_id', 'host_id', 'cell_type') AND NOT attisdropped) THEN
    RAISE EXCEPTION 'E2.11: cell_reports já tem colunas de retrato com outro nome (E4.02?).';
  END IF;
END $$;

-- 1. Colunas (DT-01). Anuláveis só até o preenchimento abaixo.
ALTER TABLE public.cell_reports
  ADD COLUMN IF NOT EXISTS snapshot_leader_id  uuid,
  ADD COLUMN IF NOT EXISTS snapshot_timothy_id uuid,
  ADD COLUMN IF NOT EXISTS snapshot_host_id    uuid,
  ADD COLUMN IF NOT EXISTS snapshot_cell_type  text;

-- 2. Relatórios que já existem (RN-21, P-REL-19), inclusive os excluídos e os de célula
--    excluída: as pessoas e o tipo atuais da célula. Em replica: não é alteração (RN-04 c do
--    E2.05), não gera evento e não esbarra no aa_enforce_cell_report_rules (célula excluída).
--    O ALTER TABLE acima segura cell_reports até o fim da migration: ninguém grava no meio.
SET LOCAL session_replication_role = replica;
UPDATE public.cell_reports r
   SET snapshot_leader_id = c.leader_id, snapshot_timothy_id = c.timothy_id,
       snapshot_host_id = c.host_id, snapshot_cell_type = c.type
  FROM public.cells c
 WHERE c.id = r.cell_id AND r.snapshot_leader_id IS NULL;
SET LOCAL session_replication_role = origin;

-- 3. Guarda: nenhum relatório sem retrato (só ids na mensagem).
DO $$ DECLARE _ids uuid[]; BEGIN
  SELECT array_agg(id ORDER BY id) INTO _ids FROM public.cell_reports
   WHERE snapshot_leader_id IS NULL OR snapshot_timothy_id IS NULL OR snapshot_host_id IS NULL
      OR snapshot_cell_type IS NULL OR NOT (snapshot_cell_type = ANY (public.cell_types()));
  IF _ids IS NOT NULL THEN RAISE EXCEPTION 'E2.11: relatórios sem retrato válido: %', _ids; END IF;
END $$;

-- 4. Integridade (valem também na carga em replica, menos as FKs).
ALTER TABLE public.cell_reports
  ALTER COLUMN snapshot_leader_id  SET NOT NULL,
  ALTER COLUMN snapshot_timothy_id SET NOT NULL,
  ALTER COLUMN snapshot_host_id    SET NOT NULL,
  ALTER COLUMN snapshot_cell_type  SET NOT NULL;
-- Dentro de DO com guarda de duplicate_object. FKs sem cascata, como o deleted_by (E2.01):
-- o retrato pode apontar para membro excluído (E2.01, "Dependências").
--   cell_reports_snapshot_leader_id_fkey  FOREIGN KEY (snapshot_leader_id)  REFERENCES public.members (id)
--   cell_reports_snapshot_timothy_id_fkey FOREIGN KEY (snapshot_timothy_id) REFERENCES public.members (id)
--   cell_reports_snapshot_host_id_fkey    FOREIGN KEY (snapshot_host_id)    REFERENCES public.members (id)
--   cell_reports_snapshot_cell_type_check CHECK (snapshot_cell_type = ANY (public.cell_types()))

-- Visibilidade e filtros do E2.12 (Líder, G12) pelas pessoas registradas.
CREATE INDEX IF NOT EXISTS cell_reports_snapshot_leader_idx  ON public.cell_reports (snapshot_leader_id)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS cell_reports_snapshot_timothy_idx ON public.cell_reports (snapshot_timothy_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS cell_reports_snapshot_host_idx    ON public.cell_reports (snapshot_host_id)    WHERE deleted_at IS NULL;
```

**Trigger do retrato** (DT-02). `BEFORE INSERT OR UPDATE OF cell_id, snapshot_leader_id, snapshot_timothy_id, snapshot_host_id, snapshot_cell_type`, *definer*, para todos os papéis. Na carga (`replica`) não dispara: o retrato vem do legado.
```sql
CREATE OR REPLACE FUNCTION public.cell_report_snapshot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _c record;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.cell_id IS DISTINCT FROM OLD.cell_id THEN                             -- RN-16
      PERFORM _del_raise('report_cell_immutable', 'A célula de um relatório não pode ser trocada.',
                         jsonb_build_object('cell_id', OLD.cell_id));
    END IF;
    NEW.snapshot_leader_id  := OLD.snapshot_leader_id;                           -- RN-14: não muda
    NEW.snapshot_timothy_id := OLD.snapshot_timothy_id;
    NEW.snapshot_host_id    := OLD.snapshot_host_id;
    NEW.snapshot_cell_type  := OLD.snapshot_cell_type;
    RETURN NEW;
  END IF;
  -- INSERT: da célula gravada, nunca do que veio (P-REL-12). Uma leitura só, com FOR SHARE:
  -- a edição da célula (FOR NO KEY UPDATE) espera este relatório, ou este espera ela, e o
  -- retrato é todo de antes ou todo de depois (ponto 4). Depois da espera, em READ COMMITTED,
  -- a linha lida é a versão gravada pela outra transação.
  SELECT c.leader_id, c.timothy_id, c.host_id, c.type INTO _c
    FROM cells c WHERE c.id = NEW.cell_id FOR SHARE;
  IF NOT FOUND THEN
    PERFORM _del_raise('not_found_or_deleted', 'Esta célula não existe ou já foi excluída.',
                       '{"entity": "cell"}'::jsonb);
  END IF;
  NEW.snapshot_leader_id  := _c.leader_id;
  NEW.snapshot_timothy_id := _c.timothy_id;
  NEW.snapshot_host_id    := _c.host_id;
  NEW.snapshot_cell_type  := _c.type;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.cell_report_snapshot() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS ad_cell_report_snapshot ON public.cell_reports;
CREATE TRIGGER ad_cell_report_snapshot
  BEFORE INSERT OR UPDATE OF cell_id, snapshot_leader_id, snapshot_timothy_id, snapshot_host_id, snapshot_cell_type
  ON public.cell_reports FOR EACH ROW EXECUTE FUNCTION public.cell_report_snapshot();
```
- Ele vem depois do `aa_` do E2.01 (célula excluída) e do `ac_` do E2.08 (célula inativa, que já trava a célula com `FOR SHARE`; a segunda trava da mesma transação não custa nada).
- Por que no trigger, e não só na RPC: no PR 1 a escrita direta ainda existe, e o trigger é o único lugar que preenche o retrato em qualquer caminho, antes e depois do PR 2.

#### Integridade garantida pelo banco
| Garantia | Como | Vale em `replica` (carga)? |
|---|---|---|
| Todo relatório tem retrato (RN-14, RN-21) | `NOT NULL` nas quatro colunas | sim |
| O tipo do retrato é um dos três (RN-14) | `cell_reports_snapshot_cell_type_check` sobre `cell_types()` | sim |
| As pessoas do retrato existem | FKs sem cascata | não; a reconciliação confere (5.6) |
| O retrato vem da célula, uma leitura só (RN-14, P-REL-12) | `ad_cell_report_snapshot` com `FOR SHARE` | não; vem do legado |
| O retrato e a célula não mudam (RN-16) | o mesmo trigger, no UPDATE | não se aplica |
| Um relatório por célula por semana (RN-07) | `cell_reports_cell_week_key` (E2.01) | sim |
| Oferta de 0 a R$ 999.999,99, com 2 casas (RN-13) | `cell_reports_offering_check` e `numeric(10,2)` | sim |
| Só as RPCs gravam (RN-01) | privilégios, sem políticas de escrita e o trigger de guarda | não; a carga roda em `replica` |
| Os registrados não saem dos participantes da célula realizada (RN-11) | `ac_keep_snapshot_participants` | não se aplica |
| O participante excluído não sai (RN-13 do E2.01) | `aa_enforce_participant_rules` (E2.01) | não se aplica |

### Leitura

#### Visibilidade pelo retrato (migration 1)
A regra do relatório (RN-04 do E2.02, com a RN-14 a e b daqui) em duas formas, conferidas pelo teste de paridade do E2.02 (DT-19 de lá):

| Forma | Expressão |
|---|---|
| Por linha (políticas e RPCs) | `viewer_sees_report_people(snapshot_leader_id, snapshot_timothy_id, snapshot_host_id)` |
| Em conjunto (views) | `(SELECT viewer_has('view_all_reports')) OR (SELECT viewer_has('view_all_church')) OR (SELECT viewer_member_id()) IN (r.snapshot_leader_id, r.snapshot_timothy_id, r.snapshot_host_id) OR (((SELECT viewer_has('view_own_ministry')) OR (SELECT viewer_has('view_own_reports'))) AND (r.snapshot_leader_id IN (SELECT viewer_ministry_member_ids()) OR r.snapshot_timothy_id IN (…) OR r.snapshot_host_id IN (…)))` |

```sql
-- Quem consulta vê o relatório destas pessoas registradas? (RN-14 a e b). Responde só sobre
-- quem consulta. viewer_scope_contains_any já é falsa sem "Visualizar Seu Ministério" e sem
-- "Visualizar Relatórios do Seu Ministério" (DT-28 do E2.02).
CREATE OR REPLACE FUNCTION public.viewer_sees_report_people(_leader uuid, _timothy uuid, _host uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.viewer_has('view_all_reports') OR public.viewer_has('view_all_church')
      OR public.viewer_member_id() = ANY (ARRAY[_leader, _timothy, _host])                     -- item (d)
      OR public.viewer_scope_contains_any(ARRAY[_leader, _timothy, _host])
$$;
REVOKE ALL ON FUNCTION public.viewer_sees_report_people(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.viewer_sees_report_people(uuid, uuid, uuid) TO authenticated;
```

| Objeto | Mudança |
|---|---|
| Política "Cell reports view policy" | `viewer_sees_report_people(snapshot_*) AND deleted_at IS NULL` |
| Política "Cell reports update policy" | `(SELECT viewer_has('edit_cell_report')) AND viewer_sees_report_people(snapshot_*) AND deleted_at IS NULL` (sai no PR 2) |
| Políticas de participantes | Nenhuma: delegam ao RLS de `cell_reports` (DT-05 do E2.02) |
| `cell_reports_view` | `WHERE` em conjunto acima. Colunas novas no fim (ver abaixo). `search_text` passa a `search_normalize(concat_ws(' ', sl.name, r.theme))`, com o líder **registrado** (RN-14 d). As colunas `cell_*` continuam sendo as **atuais** da célula: o `cell_identity` do E2.10 e o endereço da linha usam esses valores. |
| `cell_reports_deleted_view` (E2.01) | O mesmo `WHERE` em conjunto, com o filtro de excluídos dela |
| `cell_report_participants_view` | Junta a `cell_reports_view` (herda). Colunas novas no fim: `is_snapshot_person`, `member_is_active` e `member_gender` (as duas últimas nulas quando `member_visible` é falso) |
| `cell_in_viewer_ministry`, `viewer_is_cell_person` (E2.02) | Saem do RLS de relatórios. A tarefa 2 confere `pg_depend` e `pg_proc.prosrc`; sem outro uso, são removidas, como o E2.02 fez com as funções que trocou |

**Colunas novas da `cell_reports_view`, no fim** (contrato do E2.12):

| Coluna | Tipo | Origem |
|---|---|---|
| `snapshot_leader_id`, `snapshot_timothy_id`, `snapshot_host_id` | `uuid` | `r.snapshot_*` |
| `snapshot_leader_name`, `snapshot_timothy_name`, `snapshot_host_name` | `text` | `members.name` pela chave, sem filtro de escopo nem de excluído (nome de referência, RN-06 do E1.08; a excluída aparece só pelo nome, RN-09 c do E2.01) |
| `snapshot_cell_type` | `text` | `r.snapshot_cell_type` |
| `snapshot_leader_g12_level` | `integer` | `private.member_hierarchy.g12_level` do líder registrado (E2.06; nulo: sem liderança) |
| `snapshot_leader_is_pastor` | `boolean` | `members.is_pastor` do líder registrado |
| `snapshot_g12_leader_id`, `snapshot_g12_leader_name` | `uuid`, `text` | `member_hierarchy.g12_id` do líder registrado e o nome dele. A linha do excluído fica congelada (P-HIE-13 do E2.06): o G12 é o da exclusão (P-LRE-21 do E2.12) |

O rótulo "G12: {nome}", "Pastores" ou "—" sai da mesma regra de tela das células (E2.06 e E2.10: `leader_g12_level`, `leader_is_pastor`, `g12_leader_name`), aplicada às colunas `snapshot_*`. As junções são por chave e só rodam quando a coluna é pedida.

#### Conferência antes de preencher e contexto da edição (migration 2)
```sql
CREATE TYPE public.report_launch_status AS ENUM                    -- dentro de DO com guarda
  ('can_submit', 'already_sent', 'not_yet', 'cell_inactive', 'cell_deleted',
   'not_found', 'not_allowed', 'no_permission');

-- RN-19 e AQ-1. Só leitura; definer para contar o relatório da semana que quem consulta não vê.
CREATE OR REPLACE FUNCTION public.cell_report_launch_check(_cell_id uuid)
RETURNS TABLE (
  status public.report_launch_status,
  server_now timestamptz,            -- o "agora" do servidor (AQ-6: a tela soma o tempo passado)
  today date, week_start date, week_end date,                  -- Brasília
  meeting_date date, meeting_time time,                        -- reunião da semana (already_sent, not_yet, can_submit)
  allowed_dates date[],                                        -- só em can_submit: da reunião até hoje (P-REL-22)
  existing_report_id uuid, existing_date date, existing_time time,
  existing_was_held boolean, existing_can_edit boolean)        -- só para quem vê o relatório (DA-10)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$ … $$;
```
- **Precedência** (RN-19 e DA-8): `no_permission` (tem cadastro e nenhuma das três permissões de lançar) → `not_found` (célula inexistente ou cujas pessoas quem consulta não vê) → `cell_deleted` → `not_allowed` (`NOT can_submit_report`) → `cell_inactive` → `already_sent` → `not_yet` → `can_submit`. A service role (sem sessão) pula as três de permissão e escopo.
- `server_now`, `today` e a semana sempre vêm, porque não dizem nada de ninguém. A reunião vem a partir de `already_sent`. `allowed_dates` só em `can_submit`.
- `existing_*` só quando `viewer_sees_report_people` do relatório da semana é verdadeira. `existing_can_edit` = `viewer_has('edit_cell_report')`.
- Célula com dia fora da lista (não existe depois do E2.08): recusa técnica `cell_meeting_day_missing`, que a tela trata como falha da conferência (AQ-1, UXD-4).
- A "orientação" da célula inativa (P-CEL-17) vem de `my_access()` ("Editar Célula"), como no E2.08.

```sql
-- Edição (RN-16, P-REL-22). Nenhuma linha quando o relatório não está visível para quem consulta.
CREATE OR REPLACE FUNCTION public.cell_report_edit_context(_report_id uuid)
RETURNS TABLE (server_now timestamptz, today date, week_start date, week_end date, allowed_dates date[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ … $$;
```
`allowed_dates` vai do domingo da semana do relatório até o sábado dela ou até hoje, o que vier antes.

### Regras (migration 2)
Funções puras em `private`, sem grants, chamadas pelas RPCs *definer*. Recebem o "agora" local e não leem tabela: o pgTAP as testa pela tabela de casos.

```sql
-- Lista única dos limites (DA-4, DA-5; RN-10, RN-12). A tabela de casos repete os valores.
CREATE OR REPLACE FUNCTION private.report_limits(
  OUT theme integer, OUT reason integer, OUT observations integer, OUT visitor_name integer,
  OUT visitors integer, OUT participants integer, OUT offering_max numeric)
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS
$$ SELECT 300, 2000, 4000, 150, 1000, 1000, 999999.99 $$;

-- Reunião da semana (RN-06): o dia e o horário atuais da célula na semana de referência.
CREATE OR REPLACE FUNCTION private.report_meeting_at(_week_start date, _weekday integer, _meeting_time time)
RETURNS timestamp LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS
$$ SELECT (_week_start + _weekday) + _meeting_time $$;

-- Lançamento (RN-04 a RN-07, RN-09), itens 4 a 8 da RN-20, nesta ordem. O primeiro código, ou nulo.
-- Em "Não houve célula", a data e o horário finais são os da reunião.
CREATE OR REPLACE FUNCTION private.report_launch_rule(
  _now_local timestamp, _meeting_at timestamp, _held boolean, _date date, _time time,
  _week_has_report boolean, OUT code text, OUT final_date date, OUT final_time time)
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
DECLARE
  _ws date := public.week_start(_now_local::date);
BEGIN
  final_date := CASE WHEN _held THEN _date ELSE _meeting_at::date END;
  final_time := CASE WHEN _held THEN _time ELSE _meeting_at::time END;
  IF final_date NOT BETWEEN _ws AND _ws + 6 THEN code := 'report_not_current_week';            -- 4
  ELSIF _week_has_report THEN code := 'report_week_taken';                                    -- 5
  ELSIF _now_local < _meeting_at THEN code := 'meeting_not_yet';                              -- 6 (no segundo)
  ELSIF final_date + final_time > date_trunc('minute', _now_local) THEN code := 'report_in_future'; -- 7 (no minuto)
  ELSIF final_date + final_time < _meeting_at THEN code := 'report_before_meeting';           -- 8
  END IF;
END $$;

-- Edição (RN-05, RN-16): a semana do relatório e, se a data ou o horário mudaram, o futuro.
CREATE OR REPLACE FUNCTION private.report_edit_rule(
  _now_local timestamp, _stored_date date, _date date, _time time, _moment_changed boolean)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
  SELECT CASE
    WHEN _date NOT BETWEEN public.week_start(_stored_date) AND public.week_start(_stored_date) + 6
      THEN 'report_week_locked'
    WHEN _moment_changed AND _date + _time > date_trunc('minute', _now_local) THEN 'report_in_future'
  END
$$;

-- Datas aceitas (P-REL-22): no lançamento, da reunião até hoje (vazia antes da reunião);
-- na edição, da semana do relatório até hoje.
-- private.report_launch_dates(_now_local timestamp, _meeting_at timestamp) RETURNS date[]
-- private.report_edit_dates(_now_local timestamp, _stored_date date) RETURNS date[]
```
- `week_start` é a do E1.08 (`IMMUTABLE`), a mesma do índice da semana.
- As funções que usam `public.week_start` dentro de `search_path = ''` qualificam o schema.

**Entrada normalizada** (`private.report_input(_report jsonb) RETURNS private.report_input_t`, `IMMUTABLE`, nunca recusa). Para cada chave: se veio (`has_*`, para o PATCH da edição), o valor normalizado e se ele foi lido (`*_ok`). A mesma função serve à validação e à comparação da repetição (DT-06).

| Chave | Normalização | Leitura |
|---|---|---|
| `cell_id` | `uuid` | inválido: `cell_ok = false` |
| `was_held` | `boolean`; ausente no lançamento: `true` (P-REL-21) | — |
| `date` | `date` | 22007 ou 22008: `date_ok = false` |
| `time` | `time`, sem os segundos (`normalize_meeting_time`, E2.08) | ilegível ou `NOT is_valid_meeting_time`: `time_ok = false` |
| `theme`, `reason_not_held`, `observations` | `btrim`; vazio vira nulo (RN-08) | — |
| `visitors` | array de textos; cada nome com `btrim` e espaços repetidos viram um só; vazios descartados; a ordem fica (RN-12) | não é array de textos: `visitors_ok = false` |
| `offering` | `numeric` sem escala, para conferir as casas antes de gravar | ilegível: `offering_ok = false` |

Outras chaves, inclusive `snapshot_*`, `id` e as de autoria, são ignoradas.

**Mensagens.** `private.report_raise(_code text, _detail jsonb DEFAULT '{}')` monta a mensagem pelo código e chama o `_del_raise` do E2.01. É o único lugar com os textos do banco deste passo. Os dias vêm de `cell_weekdays()` (E2.08) em minúsculas ("quarta"); as datas, de `to_char(…, 'DD/MM/YYYY')`; os horários, de `to_char(…, 'HH24:MI')`.

### Escrita (migration 3)

#### `submit_cell_report` (lançamento)
`SECURITY DEFINER SET search_path = public`, `VOLATILE`. EXECUTE para `authenticated` e `service_role`. A ordem é a da RN-20; a primeira recusa levanta o erro e nada fica gravado.

```sql
CREATE TYPE public.report_submit_outcome AS ENUM ('created', 'replayed');   -- migration 2

CREATE OR REPLACE FUNCTION public.submit_cell_report(
  _report_id uuid,                        -- gerado pelo formulário ao abrir (P-REL-29)
  _report jsonb,                          -- cell_id, was_held, date, time, theme, reason_not_held,
                                          -- observations, visitors, offering
  _participant_ids uuid[] DEFAULT '{}')   -- os escolhidos; os automáticos entram pelo servidor
RETURNS TABLE (report_id uuid, outcome public.report_submit_outcome, same_content boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$ … $$;
```

| # | Passo | Recusa · campo |
|---|---|---|
| 0 | `private.current_actor()` (E2.05): logado sem cadastro, ou anônimo | 42501 |
| 0 | `_report_id` nulo | `report_id_required` (técnica) |
| 1 | **Repetição:** já existe relatório com esse `id` → `private.report_replay` (abaixo) e fim | `report_id_conflict` (DA-2) · `not_found_or_deleted` (DA-1) |
| 2 | Membro sem `edit_cell`, `submit_any_visible_report` e `submit_own_cell_report` | 42501 (RN-02, P-REL-27) |
| 3 | `cell_id` ausente ou ilegível | `cell_required` · `cell_id` |
| 4 | Célula `FOR SHARE`. Inexistente, ou membro que não vê as pessoas dela (`viewer_sees_cell_people`) | `not_found_or_deleted` (célula) (DA-7) |
| 5 | Excluída | `cell_deleted` |
| 6 | Membro sem `can_submit_report(cell_id)` (E2.02) | `report_submit_not_allowed` |
| 7 | Inativa | `cell_inactive` (E2.08) |
| 8 | Dia da célula fora da lista | `cell_meeting_day_missing` (técnica) |
| 9 | Campos da reunião. Realizada: data (`report_date_required`, `report_date_invalid`), horário (`report_time_required`, `report_time_invalid`), tema (`theme_required`, `theme_too_long`). Não houve: motivo (`reason_required`, `reason_too_long`) | campo de cada um |
| 10 | Participantes, só na realizada (RN-10, RN-11): escolhidos sem repetição, sem os automáticos; travados com `FOR KEY SHARE` em ordem de id; excluído (`deleted_member_chosen`); membro que não se vê (`person_not_visible`, só com sessão; os automáticos ficam isentos); escolhidos mais automáticos acima de 1000 (`too_many_participants`) | `participant_ids`, com `member_id` |
| 11 | Visitantes, oferta e observações, só na realizada: `visitors_invalid`, `too_many_visitors`, `visitor_name_too_long` (com `index`); `offering_required`, `offering_invalid` (ilegível ou mais de 2 casas: `x <> round(x, 2)`), `offering_negative`, `offering_too_large`; `observations_too_long` | campo de cada um |
| 12 | Semana atual: `report_launch_rule` só com o item 4 | `report_not_current_week` (sem campo; `week_start`, `week_end`) |
| 13 | Trava (célula, semana): `_del_lock_cell_week(cell_id, week_start)` (E2.01). **De novo a repetição** (a primeira tentativa pode ter acabado de gravar) → passo 1 | — |
| 14 | `report_launch_rule` com `_week_has_report`, itens 5 a 8 | `report_week_taken` (com o relatório só para quem vê, DA-10) · `meeting_not_yet` (`meeting_at`) · `report_in_future` (`date_time`) · `report_before_meeting` (`date_time`, `meeting_at`) |
| 15 | `set_config('mci.cell_report_write', 'on', true)`; `INSERT … RETURNING snapshot_leader_id, snapshot_timothy_id, snapshot_host_id`. `unique_violation`: em `cell_reports_pkey`, vai para a repetição; em `cell_reports_cell_week_key`, `report_week_taken` | — |
| 16 | Participantes: os escolhidos mais os três do retrato devolvido, sem repetir, em ordem de id (RN-11). Em "Não houve célula", nenhum | — |
| 17 | `set_config('mci.cell_report_write', '', true)`; devolve `(_report_id, 'created', NULL)` | — |

- **"Não houve célula" (RN-09):** a data e o horário gravados são os da reunião da semana; tema, observações e oferta nulos; visitantes vazios; nenhum participante (DA-6). O que vier na chamada é ignorado, sem recusa.
- **Service role:** pula os passos 2, 4 (só a parte de visibilidade) e 6, e a visibilidade do passo 10 (RN-01).
- **Auditoria (E2.05):** o INSERT grava o evento `create`, e cada participante entra em `participants.sent`. O retrato não entra (não está em `private.audit_fields`). Um evento por envio.

**Repetição** (`private.report_replay(_report_id, _report, _participant_ids)`, DT-06):
1. Lê o relatório. Se o autor do cadastro (`created_by_kind`, `created_by`) não for quem chama: `report_id_conflict`, sem nada do relatório (DA-2).
2. Excluído: `not_found_or_deleted` (relatório) (DA-1).
3. Compara a chamada normalizada (`private.report_input`) com o gravado. Realizada: célula, situação, data, horário, tema, observações, visitantes (na ordem), oferta (por valor) e participantes (os escolhidos mais o retrato gravado, como conjunto). Não houve: célula, situação e motivo. Um valor que a normalização não leu conta como diferente.
4. Devolve `(_report_id, 'replayed', igual)`. Não grava nada e não gera evento. Não confere permissão: a primeira tentativa foi aceita, e a resposta só fala do que o próprio autor enviou (ponto 12 do Negócio).

#### `save_cell_report` (edição)
Mesmo nome, mesma assinatura e mesmo retorno do E2.05: `save_cell_report(_report_id uuid, _report jsonb, _participant_ids uuid[] DEFAULT NULL) RETURNS TABLE (report_id uuid, changed boolean)`. Passa de *invoker* a `SECURITY DEFINER SET search_path = public`. `_report` só com as chaves que mudam (PATCH); `_participant_ids` é o conjunto final, com os excluídos, ou nulo para não mexer.

| # | Passo | Recusa · campo |
|---|---|---|
| 0 | `_report_id` nulo: lançamento de transição, `submit_cell_report(gen_random_uuid(), …)`, e devolve `changed = true` (DA-12) | — |
| 0 | `current_actor()` | 42501 |
| 1 | Membro sem `edit_cell_report` | 42501 (RN-03) |
| 2 | Relatório `FOR NO KEY UPDATE`. Inexistente, excluído ou, para membro, `NOT viewer_sees_report_people(snapshot_*)` | `not_found_or_deleted` (relatório) |
| 3 | Célula `FOR KEY SHARE`; excluída | `report_cell_deleted` (E2.01). A célula inativa não impede (RN-11 d do E2.08) |
| 4 | Estado final = gravado + PATCH. Trocas da RN-09: realizada → não houve com participante excluído | `not_held_with_deleted_participant` · `was_held` |
| 5 | Campos do estado final, como no lançamento (passos 9 a 11). Os tetos só nos campos que vieram no PATCH (DA-4). Se o estado final continua "Não houve célula", os campos e os participantes que vieram são ignorados (DA-3) | campo de cada um |
| 6 | Participantes (abaixo) | `participant_ids` |
| 7 | `cell_id` presente e diferente | `report_cell_immutable` (sem campo) |
| 8 | `report_edit_rule`, com `_moment_changed` quando a data ou o horário mudam | `report_week_locked` (`date`, `week_start`, `week_end`) · `report_in_future` (`date_time`) |
| 9 | Marca ligada; `UPDATE` só das colunas que mudam; participantes pela diferença; marca desligada | — |
| 10 | `changed` = `updated_at` diferente do de antes (o carimbo do E2.05 só o muda quando há alteração) | — |

**Participantes na edição** (RN-09 a RN-11; o conjunto final é calculado depois da trava do relatório):

| Estado final | Conjunto final |
|---|---|
| Continua "Não houve célula" | o gravado (DA-3) |
| Realizada → "Não houve célula" | vazio (todos saem); recusa se algum for excluído (passo 4) |
| "Não houve célula" → realizada | `_participant_ids` (ou o gravado, se nulo) mais os três do retrato, que ficam isentos da visibilidade |
| Continua realizada | `_participant_ids` (ou o gravado, se nulo) |

Depois, nesta ordem:
- **quem sai:** excluído (`deleted_participant_removal`); pessoa registrada numa realizada (`snapshot_participant_removal`). Quem quem edita não vê pode sair (RN-09 do E2.02);
- **quem entra:** travados com `FOR KEY SHARE` em ordem de id; excluído (`deleted_member_chosen`); invisível para quem edita (`person_not_visible`), menos os registrados na troca para realizada; a pessoa registrada que entra pelo seletor num relatório antigo segue a regra comum (DA-9);
- **limite:** mais de 1000 no conjunto final (`too_many_participants`).

A gravação apaga e insere só a diferença, em ordem de `member_id` (a ordem que evita ciclo com o `delete_member`, E2.01). Na troca para "Não houve célula", o `UPDATE` de `was_held` vem antes das retiradas, para o trigger dos registrados permitir a saída.

**Auditoria (E2.05):** um `update` com os campos que mudaram e os participantes incluídos e retirados. Só os participantes mudando: o trigger do E2.05 carimba o relatório. Nada mudando: nenhum evento, `changed = false` (RN-15).

#### Fim da escrita direta
```sql
-- Guarda (DT-10, DA-11). Para todos os papéis; na carga (replica), não dispara.
CREATE OR REPLACE FUNCTION public.guard_cell_report_write()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  _not_content constant text[] := ARRAY['deleted_at', 'deleted_by', 'deleted_by_kind', 'deleted_by_legacy',
                                        'updated_at', 'updated_by', 'updated_by_kind', 'updated_by_legacy'];
BEGIN
  IF current_setting('mci.cell_report_write', true) = 'on' THEN     -- RPC ou manutenção explícita
    RETURN coalesce(NEW, OLD);
  END IF;
  -- Excluir e restaurar (E2.01) e o carimbo dos participantes (E2.05) não mudam o conteúdo.
  IF TG_TABLE_NAME = 'cell_reports' AND TG_OP = 'UPDATE'
     AND (to_jsonb(NEW) - _not_content) = (to_jsonb(OLD) - _not_content) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Relatórios e participantes só são gravados pelas RPCs submit_cell_report e save_cell_report.'
    USING ERRCODE = '42501';
END $$;
REVOKE ALL ON FUNCTION public.guard_cell_report_write() FROM PUBLIC, anon, authenticated;
-- a0_guard_cell_report_write: BEFORE INSERT OR UPDATE ON cell_reports
--                             e BEFORE INSERT OR DELETE ON cell_report_participants.

-- Pessoas registradas fixas na célula realizada (RN-11): barreira para qualquer caminho.
-- ac_keep_snapshot_participants: BEFORE DELETE ON cell_report_participants, definer.
--   Recusa (snapshot_participant_removal) quando o relatório está como realizada e
--   OLD.member_id está no retrato. Vem depois do aa_enforce_participant_rules (excluído primeiro).

-- Oferta (DT-15, DA-5, DA-6). Guarda antes: oferta fora do intervalo → falha com os ids.
ALTER TABLE public.cell_reports ALTER COLUMN offering DROP DEFAULT;
-- cell_reports_offering_check CHECK (offering IS NULL OR offering BETWEEN 0 AND 999999.99)

-- Privilégios e políticas (RN-01).
REVOKE INSERT, UPDATE ON public.cell_reports FROM authenticated, service_role;
REVOKE INSERT, UPDATE, DELETE ON public.cell_report_participants FROM authenticated, service_role;
DROP POLICY IF EXISTS "Cell reports insert policy" ON public.cell_reports;
DROP POLICY IF EXISTS "Cell reports update policy" ON public.cell_reports;
DROP POLICY IF EXISTS "Participants insert policy" ON public.cell_report_participants;
DROP POLICY IF EXISTS "Participants delete policy" ON public.cell_report_participants;
-- E as demais políticas de escrita dessas tabelas que existirem em pg_policies.
```

**O que sai** (a tarefa 5 confere em `pg_trigger`, `pg_policies`, `pg_depend` e `pg_proc.prosrc` antes de cada `DROP`):

| Objeto | Passo | Por quê |
|---|---|---|
| `enforce_cell_report_current_week_trigger` e a função | atual | A semana atual vale só no lançamento, na RPC (RN-04). Ele barrava a edição e a carga. |
| `enforce_unique_weekly_cell_report_trigger` e a função | atual, E2.01 | O índice e a trava da RPC cobrem (DT-09). A `restore_cell_report` já tem a própria conferência. |
| `set_cell_report_participants` | E2.01 (DT-15), DA-5 do E2.02 | Absorvida pelas RPCs. |
| `a0_check_insert_permission` em `cell_reports` e em participantes; `viewer_can_insert_cell_report` e `viewer_can_insert_cell_report_participant`; os dois ramos em `enforce_insert_permission` (o de `cells` fica) | E2.01 PR 2, E2.02 | Sem INSERT para a API, só as RPCs *definer* inserem, e o trigger deixava `postgres` passar. |
| `ab_enforce_cell_report_scope` e `ab_enforce_participant_scope` e as funções | E2.02 | *Invoker*, deixavam `postgres` passar: sem escrita direta, nunca disparam. As RPCs conferem as mesmas regras pelas mesmas funções de linha (regra do E2.02 para RPC *definer*). |

Ficam: `aa_enforce_cell_report_rules` e `aa_enforce_participant_rules` (E2.01), `ac_enforce_cell_report_active` (E2.08), `ad_cell_report_snapshot`, `zz_stamp_authorship` e os triggers `AFTER` de Auditoria (E2.05). A ordem dos `BEFORE` de `cell_reports` fica: `a0_guard_cell_report_write` → `aa_` → `ac_` → `ad_` → `zz_`. Em participantes: `a0_guard_cell_report_write` → `aa_enforce_participant_rules` → `ac_keep_snapshot_participants`.

### Formato dos erros (AQ-2)
É o formato do E2.01: 42501 só para permissão, e 22023 com `HINT = 'app_error'` e `DETAIL` em JSON para as regras. O `parseAppError` do E2.01 lê os dois. As marcadas com *técnica* nunca aparecem pela tela.

| `code` | Mensagem | Detalhes |
|---|---|---|
| `cell_required` | Escolha a célula. | `field: "cell_id"` |
| `report_date_required` | Informe a data da reunião. | `field: "date"` |
| `report_date_invalid` | Data inválida. | `field: "date"` |
| `report_time_required` | Informe o horário da reunião. | `field: "time"` |
| `report_time_invalid` | Horário inválido. Informe a hora e os minutos, entre 00:00 e 23:59. | `field: "time"` |
| `theme_required` | Informe o tema ministrado. | `field: "theme"` |
| `theme_too_long` | O tema pode ter no máximo 300 caracteres. | `field: "theme"`, `max` |
| `reason_required` | Informe o motivo de não ter havido célula. | `field: "reason_not_held"` |
| `reason_too_long` | O motivo pode ter no máximo 2000 caracteres. | `field: "reason_not_held"`, `max` |
| `not_held_with_deleted_participant` | Este relatório tem participante com cadastro excluído e não pode passar para "Não houve célula". | `field: "was_held"`, `member_ids` |
| `deleted_member_chosen` (E2.01) | Este membro foi excluído e não pode ser escolhido. | `field: "participant_ids"`, `member_id` |
| `person_not_visible` (E2.02) | Você só pode escolher pessoas que você vê. | `field: "participant_ids"`, `member_id` |
| `deleted_participant_removal` (E2.01) | Não é possível retirar um participante cujo cadastro foi excluído. | `field: "participant_ids"`, `member_id` |
| `snapshot_participant_removal` | O líder, o timóteo e o anfitrião registrados no relatório não podem ser retirados dos participantes. | `field: "participant_ids"`, `member_id` |
| `too_many_participants` (E2.01) | Um relatório pode ter no máximo 1000 participantes. | `field: "participant_ids"`, `max` |
| `visitors_invalid` | *Visitantes inválidos. Envie uma lista de nomes.* | `field: "visitors"` |
| `too_many_visitors` | Um relatório pode ter no máximo 1000 visitantes. | `field: "visitors"`, `max` |
| `visitor_name_too_long` | Cada visitante pode ter no máximo 150 caracteres. | `field: "visitors"`, `index` (0 a n−1, na ordem enviada, já sem os vazios) |
| `offering_required` | Informe a oferta. Se não houve oferta, informe R$ 0,00. | `field: "offering"` |
| `offering_negative` | A oferta não pode ser negativa. | `field: "offering"` |
| `offering_invalid` | Oferta inválida. Informe um valor em reais, com até 2 casas decimais. | `field: "offering"` |
| `offering_too_large` | A oferta pode ser de no máximo R$ 999.999,99. | `field: "offering"`, `max` |
| `observations_too_long` | As observações podem ter no máximo 4000 caracteres. | `field: "observations"`, `max` |
| `report_cell_immutable` | A célula de um relatório não pode ser trocada. | `cell_id` |
| `report_week_locked` | Na edição, a data só pode mudar dentro da semana do relatório, de {dd/mm/aaaa} a {dd/mm/aaaa}. | `field: "date"`, `week_start`, `week_end` |
| `report_not_current_week` | O relatório precisa ser da semana atual, de {dd/mm/aaaa} a {dd/mm/aaaa}. | `week_start`, `week_end` |
| `report_week_taken` | O relatório para esta semana já foi enviado. | `week_start`; `report: { id, date, time, was_held, can_edit }` só para quem o vê |
| `meeting_not_yet` | A reunião desta semana ainda não aconteceu. O relatório pode ser enviado a partir de {dia}, {dd/mm/aaaa}, às {HH:mm}. | `meeting_at` ("2026-11-25T20:00", hora de Brasília) |
| `report_in_future` | O relatório não pode ser enviado para uma data ou horário futuros. | `field: "date_time"` |
| `report_before_meeting` | O relatório não pode ser de antes da reunião da célula nesta semana ({dia}, {dd/mm/aaaa}, às {HH:mm}). | `field: "date_time"`, `meeting_at` |
| `report_submit_not_allowed` (E2.02) | Você não pode enviar o relatório desta célula. | `cell_id` |
| `not_found_or_deleted` (E2.01) | Esta célula não existe ou já foi excluída. · Este relatório não existe ou já foi excluído. | `entity: "cell"` ou `"cell_report"` |
| `cell_deleted`, `report_cell_deleted` (E2.01) | Esta célula foi excluída e não recebe relatórios. · A célula deste relatório foi excluída. Restaure a célula para editar o relatório. | `cell_id` |
| `cell_inactive` (E2.08) | Esta célula está inativa e não recebe relatórios. | `cell_id` |
| `report_id_required`, `report_id_conflict`, `cell_meeting_day_missing` | *técnicas* | — |
| 42501 | Você não tem permissão para esta ação. | — |

- A tela mapeia códigos e campos num módulo só (`src/lib/cell-reports/codes.ts`): com `field`, a mensagem vai para o campo (`date_time` vai para o par Data e Horário; `participant_ids` marca o chip do `member_id`); sem `field`, para o `Alert` do topo. A identificação de `report_week_taken` vem de `detail.report`.
- **Reservas:** 23505 sem código conhecido (corrida que escapou da trava) vira `report_week_taken` sem identificação; 40P01 (*deadlock*) e qualquer outro erro, a mensagem de conexão.

### Bloqueios e concorrência
A ordem global é a do E2.01, estendida pelo E2.05 e pelo E2.08: relatório → célula → membros → (célula, semana) → linhas dos triggers.

| Operação | Relatório | Célula | Membros | (célula, semana) |
|---|---|---|---|---|
| `submit_cell_report` | a linha nova (chave primária) | `FOR SHARE` | escolhidos `FOR KEY SHARE`, em ordem de id | sim, depois dos membros |
| `save_cell_report` | `FOR NO KEY UPDATE` | `FOR KEY SHARE` | os que entram `FOR KEY SHARE`, em ordem de id | — (a semana não muda) |
| Triggers de participantes (E2.01, E2.05) | `FOR NO KEY UPDATE` (já pego) | `FOR KEY SHARE` (já pego) | o membro (já pego) | — |
| `cell_report_launch_check`, `cell_report_edit_context` | — | — | — | — |

Os casos:
- **Caio e Carla enviam C1 ao mesmo tempo:** os dois pegam `FOR SHARE` em C1 (não conflitam) e esperam na trava da semana. O segundo encontra o relatório do primeiro e recebe `report_week_taken`. O índice único cobre qualquer caminho sem a trava (RN-07).
- **Envio × edição da célula** (Rita troca o timóteo de C1): o `FOR SHARE` e o `FOR NO KEY UPDATE` se excluem. Se a edição trava antes, o envio espera e lê a célula nova (retrato e automáticos com Fábio); se o envio trava antes, a edição espera o *commit* (retrato com Caio). Nunca uma mistura (ponto 4).
- **Envio × inativação** e **envio × exclusão da célula:** como na DT-06 do E2.08 e na DT-08 do E2.01: quem trava primeiro decide, e o segundo relê.
- **Envio × exclusão de um escolhido:** `FOR KEY SHARE` × `FOR UPDATE` (E2.01). Exclusão primeiro: o envio relê e recusa. Envio primeiro: a exclusão espera, e o participante fica (RN-13 do E2.01).
- **Envio × exclusão ou restauração do relatório da semana:** a restauração pega a mesma trava da semana (E2.01); a exclusão libera a semana quando confirma.
- **Repetição enquanto a primeira tentativa ainda grava:** a segunda espera na trava da semana e, depois dela, encontra o `id` e vira repetição (passo 13). Com outra célula na segunda (outra trava), ela espera na chave primária e recebe `unique_violation` em `cell_reports_pkey`, que também vira repetição. Uma linha só.
- **Duas edições do mesmo relatório:** a segunda espera a trava do relatório, relê o gravado e grava o próprio estado final inteiro. Vale a última, e cada uma é uma alteração na Auditoria (RN-16).
- **Edição × inativação da célula:** sem espera (`FOR KEY SHARE` não conflita), e a edição é aceita (RN-11 d do E2.08).

Sem *deadlock* novo: o envio pega célula, membros e semana, nessa ordem, e a linha nova só pode ser esperada por outra tentativa do mesmo `id`, que não segura nada que o envio peça depois.

### Contratos (RPC, Edge Functions, colunas novas)
**Colunas novas em `cell_reports`:** `snapshot_leader_id uuid NOT NULL`, `snapshot_timothy_id uuid NOT NULL`, `snapshot_host_id uuid NOT NULL` (FKs para `members`, sem cascata) e `snapshot_cell_type text NOT NULL` (`CHECK` sobre `cell_types()`). No `types.ts`, `Insert` passa a pedi-las, mas ninguém insere pelo cliente.

**Colunas que mudam:** `offering` perde o padrão 0 e ganha `cell_reports_offering_check`.

**Views:** `cell_reports_view` (11 colunas no fim e `search_text` pelo líder registrado), `cell_reports_deleted_view` (o `WHERE`), `cell_report_participants_view` (`is_snapshot_person boolean`, `member_is_active boolean`, `member_gender text` no fim).

**Tipos novos:** `report_launch_status` e `report_submit_outcome` (enums, com a união de valores no `types.ts`).

**RPCs** (todas com `REVOKE … FROM PUBLIC, anon` e EXECUTE para `authenticated` e `service_role`):

| RPC | Retorno | Para quê |
|---|---|---|
| `submit_cell_report(_report_id uuid, _report jsonb, _participant_ids uuid[] DEFAULT '{}')` | `TABLE (report_id uuid, outcome report_submit_outcome, same_content boolean)` | Lançamento. `same_content` só em `replayed` |
| `save_cell_report(_report_id uuid, _report jsonb, _participant_ids uuid[] DEFAULT NULL)` | `TABLE (report_id uuid, changed boolean)` | Edição (mesma assinatura do E2.05) |
| `cell_report_launch_check(_cell_id uuid)` | ver [Conferência](#conferência-antes-de-preencher-e-contexto-da-edição-migration-2) | Aviso antes de preencher, reunião e datas (RN-18, RN-19) |
| `cell_report_edit_context(_report_id uuid)` | `TABLE (server_now, today, week_start, week_end, allowed_dates)` | Datas da edição (RN-16) |
| `viewer_sees_report_people(uuid, uuid, uuid)` | `boolean` | Políticas (só sobre quem consulta) |

**Saem:** `set_cell_report_participants`, as funções dos triggers de semana e as de escrita direta listadas acima.

**Chamada pelo front:**
```text
Lançamento:
1. Ao abrir o formulário: attemptId = crypto.randomUUID(), guardado no estado do diálogo até ele fechar.
2. Célula escolhida: rpc('cell_report_launch_check', { _cell_id }) → aviso (a), (b), (c) ou os campos (RN-19).
3. Enviar: rpc('submit_cell_report', { _report_id: attemptId, _report, _participant_ids: escolhidos })
   → created ou replayed + same_content: "Relatório enviado.";
   → replayed sem same_content: "O relatório foi enviado na primeira tentativa. As alterações feitas depois não foram salvas.";
   → falha de rede ou 5xx: a mensagem de conexão; a nova tentativa usa o mesmo attemptId.
Edição:
1. A linha da cell_reports_view (com o retrato), os participantes da cell_report_participants_view
   e rpc('cell_report_edit_context', { _report_id }).
2. Salvar: rpc('save_cell_report', { _report_id, _report: só o que mudou, _participant_ids: conjunto final ou null }).
```

**Tabela de casos:** `supabase/tests/fixtures/report-rules-cases.json` (DT-17), com:
- `limits`: os valores de `private.report_limits()`;
- `launch`: uma linha por caso, com `now` (ISO com fuso), `device_tz` (só nos casos de tela), `meeting_day`, `meeting_time`, `was_held`, `date`, `time`, `week_has_report` e o esperado: `week_start`, `week_end`, `meeting_at`, `status` da conferência, `allowed_dates`, `suggested` (data e horário, ou nulo) e `code`;
- `edit`: `now`, `stored_date`, `date`, `time`, `moment_changed` e o esperado: `allowed_dates` e `code`;
- `offering`: o que se digita ou cola, o que o campo mostra e o valor enviado (as linhas da T6, só de tela) e os valores pela API com o código (−5, 10,555, 1.000.000);
- `visitors`: entrada e nomes gravados (RN-12);
- o horário do relatório usa os casos de horário do `cell-rules-cases.json` do E2.08.

Casos mínimos: todos os critérios com hora das RN-04 a RN-06, RN-09 e RN-18; o aparelho em Lisboa e em Manaus; sábado 23:50 → domingo 00:02 com o formulário aberto; a virada às 03:00 UTC de domingo; a célula de domingo às 10:00 (09:59 e 10:00) e a de sábado às 22:00; o dia mudado para quinta no meio da semana; o minuto exato (20:30 aceito, 20:31 recusado) e a reunião exata (20:00:00 aceita, 19:59:59 ainda não).

**Edge Functions:** nenhuma.

### Front
Segue o padrão dos passos anteriores: os componentes cuidam da tela, o acesso a dados fica nos hooks e a regra pura fica em `src/lib/`. Nenhuma data é calculada pelo relógio do aparelho, a não ser no caso da conferência que falhou (UXD-4), convertida para Brasília.

**PR 2, ajuste mínimo** (vai ao ar com o banco): o `types.ts` novo compila com o front do E2.05 (`save_cell_report` não muda de assinatura). Se alguma tela ainda chamar `set_cell_report_participants` ou gravar direto em `cell_reports`, passa para `save_cell_report`.

**PR 3, lista e consulta pelo retrato (T10):**
- `src/lib/cell-reports/fields.ts`: `CELL_REPORT_ROW_SELECT` com `snapshot_leader_name`, `snapshot_leader_g12_level`, `snapshot_leader_is_pastor` e `snapshot_g12_leader_name` no lugar de `cell_leader_name` para o líder da linha; o endereço continua das colunas `cell_*` (atuais).
- `src/lib/cell-reports/snapshot.ts`: as linhas do bloco da célula (P105) a partir da linha da view (retrato, com o dia, o horário e o endereço atuais) ou da opção do seletor (célula atual); o rótulo do G12 pela regra do E2.06 e do E2.10.
- `src/components/cell-reports/CellSnapshotBlock.tsx` (P105), usado no formulário (PR 4) e no `CellReportSheet` (E2.01), que passa a mostrar "Célula de {líder registrado}" e o bloco com a frase do retrato.
- `CellReports.tsx`: o líder registrado e "G12: {nome}" embaixo; "Novo relatório". A busca não muda no front (a coluna `search_text` já é a do líder registrado).
- Textos em `src/lib/cell-reports/texts.ts` (nasce aqui; o PR 4 completa).

**PR 4, formulário (T1 a T9):**
- **Domínio puro, com Vitest e sem React nem Supabase:**
  - `dates.ts`: semana, reunião da semana, datas aceitas, sugestão, "agora" a partir de `server_now` mais o tempo passado (`performance.now()`, AQ-6), e o mesmo cálculo pelo relógio do aparelho em `America/Sao_Paulo` (`Intl.DateTimeFormat`) para a conferência que falhou; as recusas de futuro e de antes da reunião. Conferido contra o JSON.
  - `limits.ts` (os valores do JSON), `offering.ts` (P101 e a tabela da T6), `visitors.ts` (RN-12), `validation.ts` (`validateReportForm`: todos os erros de uma vez, na ordem da tela), `payload.ts` (a chamada do lançamento e o PATCH da edição, com o `changes.ts` do E2.05), `situation-switch.ts` (os textos do P20), `participants.ts` (automáticos, fixos e total), `launch-check.ts` (a resposta da conferência como estado da tela), `codes.ts` e `texts.ts` (**todos** os textos deste spec).
- **Hooks:** `use-cell-report-launch-check` (chave `["cell_reports", "launch_check", cellId]`, `staleTime: 0`, sem nova tentativa automática), `use-cell-report-edit-context`, `use-cell-report-submit` (o `attemptId` do diálogo), `use-cell-report-save` (edição, do E2.05), `use-cell-options` (as colunas do bloco: `timothy_name`, `host_name`, `type`, `g12_leader_name`, `leader_g12_level`, `leader_is_pastor` e os ids, só com `can_submit_report`, ordenado por `is_mine`), `use-member-options` (inativos com a marca, sem `activeOnly`) e `use-member-statuses` (E2.08) para as marcas das três pessoas.
- **Componentes** em `src/components/cell-reports/`: `CellReportDialog` (três modos: célula fixa, célula livre e edição; casca do P1 com o `FormDialog` do E2.04, rodapé, descartar e a troca para a edição pelo aviso), `LaunchNotice` (T3), `MeetingFieldset` (situação, `DateSelect` do P104, `TimeInput` do E2.08, tema e motivo), `ParticipantsFieldset` (P103), `VisitorsFieldset` (P102) e `OfferingInput` (P101). Na edição, o `RecordAuthorship` do E2.05.
- **Cache:** `refreshAfterReportWrite` (E2.09) em `created`, `replayed`, edição com `changed` e nas recusas `report_week_taken`, `not_found_or_deleted`, `cell_deleted`, `report_cell_deleted` e `cell_inactive` (esta também desatualiza `["access"]`, como no E2.08). A conferência fica sob `["cell_reports"]` e é desatualizada junto.
- **Telas:** `CellReports.tsx`, `Cells.tsx`, o detalhe da célula (E2.10) e o atalho do Dashboard abrem o `CellReportDialog`. Saem `CellReportForm.tsx`, `use-save-cell-report.ts`, `calculateCellDate` e o tratamento de SQLSTATE de `report-form.ts`.
- `index.html` com `viewport-fit=cover`, se ainda faltar.

### Onde cada regra é imposta
| RN | Banco (constraint, RLS, trigger, RPC) | UI |
|---|---|---|
| RN-01 | Só `submit_cell_report` e `save_cell_report` gravam: sem INSERT e UPDATE (e DELETE em participantes) para `authenticated` e `service_role`; sem políticas de escrita; `a0_guard_cell_report_write` para o código do banco (DA-11); a carga em `replica` e a restauração do E2.01 ficam de fora | — |
| RN-02 | `submit_cell_report`, passos 2 a 7 (42501, `not_found_or_deleted`, `cell_deleted`, `report_submit_not_allowed`, `cell_inactive`); `aa_` (E2.01) e `ac_` (E2.08) como barreira; `cell_report_launch_check` com a mesma precedência | Seletor por `cells_view.can_submit_report`; aviso (c) com a orientação por "Editar Célula" |
| RN-03 | `save_cell_report`: `edit_cell_report`, relatório visível pelo retrato, não excluído, célula não excluída. Quem só lança não tem caminho de edição | "Editar" só com a permissão (E2.02) |
| RN-04 | `private.report_launch_rule` (semana de `sp_local(now())`), só no lançamento | Datas aceitas vindas do servidor (P104) |
| RN-05 | `report_launch_rule` e `report_edit_rule`, no minuto | Conferência no envio com o "agora" do servidor (AQ-6) |
| RN-06 | `report_launch_rule` pela reunião atual da célula, lida com `FOR SHARE`; `meeting_not_yet` e `report_before_meeting` | Aviso (b); datas a partir da reunião |
| RN-07 | Trava (célula, semana) e `cell_reports_cell_week_key`; `report_week_taken` com o relatório só para quem vê; repetição pelo `id` | Aviso (a) e `Alert` com "Editar relatório" |
| RN-08 | `private.report_input` e os passos 9 e 5 das RPCs; horário pelas funções do E2.08 | `validateReportForm`, `TimeInput` |
| RN-09 | RPCs: data da reunião, campos e participantes descartados no lançamento; trocas na edição; `not_held_with_deleted_participant`; DA-3 | Duas opções, aviso do P20, opção desabilitada com participante excluído |
| RN-10 | RPCs: escolhidos visíveis (`viewer_sees_member`), não excluídos (com trava), até 1000; retirada pela diferença; `aa_enforce_participant_rules` (E2.01) | Seletor com inativos e marcas |
| RN-11 | `ad_cell_report_snapshot` + os automáticos pelo `RETURNING`; `ac_keep_snapshot_participants`; a troca para realizada inclui os registrados | Lista fixa e total |
| RN-12 | `private.report_input` e o limite nas RPCs | Um campo por visitante |
| RN-13 | `cell_reports_offering_check`; RPCs (obrigatória na realizada, 2 casas, nula em "Não houve célula"); sem padrão | `OfferingInput` (P101) |
| RN-14 | Colunas `snapshot_*` (`NOT NULL`, FK, `CHECK`); `ad_cell_report_snapshot`; visibilidade pelo retrato (views, políticas, `viewer_sees_report_people`); nomes e G12 na `cell_reports_view` | Bloco com o retrato; lista pelo líder registrado |
| RN-15 | Uma transação por chamada; evento e carimbo do E2.05; a repetição não grava nem gera evento | Um envio só |
| RN-16 | `ad_cell_report_snapshot` (célula e retrato fixos); `report_edit_rule`; `FOR NO KEY UPDATE` | Célula fixa; datas da semana do relatório |
| RN-17 | `cells_view` (colunas do bloco) e `cell_reports_view` (retrato) | `CellSnapshotBlock` (P105) |
| RN-18 | `cell_report_launch_check` (reunião e datas aceitas) | Sugestão e lista de dias |
| RN-19 | `cell_report_launch_check` | `LaunchNotice`; conferência que falhou |
| RN-20 | Ordem dentro das RPCs; `app_error` com `field` | Erros juntos; `codes.ts` |
| RN-21 | Preenchimento na migration 1; `NOT NULL` e `CHECK` valem na carga; reconciliação (5.6) | — |

### Respostas às perguntas do UX (AQ-1 a AQ-11)
| # | Resposta |
|---|---|
| AQ-1 | **Sim.** `cell_report_launch_check(_cell_id)`: "agora", hoje, semana, reunião, situação na precedência da RN-19 e o relatório da semana só para quem o vê, com "pode editar". "Pode editar a célula" vem de `my_access()`. Os limites da edição vêm de `cell_report_edit_context`. A célula sem dia válido recusa com um código técnico, tratado como falha. |
| AQ-2 | **Sim.** Todos os códigos pedidos, com `field` (`cell_id`, `date`, `date_time`, `time`, `theme`, `reason_not_held`, `offering`, `visitors`, `participant_ids` com `member_id`, `was_held`), e os sem campo ([Formato dos erros](#formato-dos-erros-aq-2)). |
| AQ-3 | **Sim, sem coluna nova na `cells_view`:** ela já tem `timothy_name`, `host_name`, `type`, `g12_leader_name`, `leader_g12_level` e, do E2.02, `leader_is_pastor`. As marcas das três pessoas vêm do `use-member-statuses` do E2.08. Na edição, a `cell_reports_view` ganha o retrato com os nomes e o G12 atual do líder registrado. |
| AQ-4 | **Sim** (P-REL-29). `submit_cell_report` com o `id` do formulário: `replayed` e `same_content`. |
| AQ-5 | **Sim.** Opções sem o filtro de ativos, com a marca. Os automáticos são os ids da opção da célula (lançamento) ou do retrato (edição). A `cell_report_participants_view` ganha `is_snapshot_person` e, para quem quem edita vê, `member_is_active` e `member_gender`. **O total da tela é o mesmo que o servidor grava:** a união, sem repetir, dos automáticos (ou registrados), dos escolhidos e dos de cadastro excluído. O teste confere. |
| AQ-6 | **Sim.** `server_now` da conferência mais o tempo passado; a tabela de casos tem os casos de tela (Lisboa, Manaus, virada de sábado, minuto exato). |
| AQ-7 | **Sim.** `snapshot_leader_name`, `snapshot_g12_leader_name`, `snapshot_leader_g12_level`, `snapshot_leader_is_pastor` e `search_text` pelo líder registrado. A paginação e a contagem não mudam. |
| AQ-8 | Tema 300, motivo 2000, observações 4000 e cada visitante 150 caracteres (DA-4), com as mensagens da tabela de erros. |
| AQ-9 | `refreshAfterReportWrite` (E2.09): `["cell_reports"]` (lista e conferência), `["cells"]` (lista, situação, detalhe e últimos relatórios do E2.10), `["dashboard"]` e `["members"]` (vínculo celular). "Fechar" depois de (a) ou (c) chama o mesmo. |
| AQ-10 | **Sim.** A conferência devolve o `id` a quem vê o relatório, com `existing_can_edit`. A edição lê a linha da `cell_reports_view`, os participantes e o `cell_report_edit_context` antes de mostrar os campos. |
| AQ-11 | **Sim.** Já é a ordem do seletor do E2.02 (`is_mine` primeiro). |

### Perguntas Q-1 a Q-8
O desenho segue o padrão do Negócio: nenhuma regra nova. O custo de cada alternativa, se a resposta for "sim":

| # | Alternativa | O que muda | Custo |
|---|---|---|---|
| Q-1 | Relatório atrasado | Parâmetro de semana em `submit_cell_report` e na conferência; `report_launch_rule` por semana escolhida, com o limite de semanas e quem pode; a T12 | Médio: 2 a 3 dias |
| Q-2 | "Não houve célula" antes do horário | `report_launch_rule` deixa de recusar `meeting_not_yet` e `report_in_future` só no "Não houve célula" (a data gravada é a da reunião, futura); a conferência ganha o estado; a T12 | Pequeno: cerca de 1 dia |
| Q-3 | Reunião antecipada | Datas aceitas desde o domingo; sai `report_before_meeting` e o `meeting_not_yet` da realizada | Pequeno: meio dia a 1 dia |
| Q-4 | Oferta não informada | A RPC aceita a oferta nula na realizada; o campo deixa de ser obrigatório | Pequeno: meio dia |
| Q-5 | Retirar o timóteo ou o anfitrião | Sai `ac_keep_snapshot_participants` e a recusa da edição; a lista fixa vira chips | Pequeno: meio dia a 1 dia |
| Q-6 | Quem lançou corrige por um tempo | `save_cell_report` aceita o autor do cadastro dentro do prazo, sem `edit_cell_report`; a conferência e a lista dizem "pode editar" | Médio: 1 a 2 dias |
| Q-7 | Visitantes como consolidados | Depende do spec da Consolidação | Grande; fora deste passo |
| Q-8 | Repetir os participantes do último relatório | Uma leitura `cell_report_last_participants(_cell_id)` (os participantes visíveis e não excluídos do último relatório realizado visível) e o botão | Pequeno a médio: cerca de 1 dia, depois das regras |

### Decisões técnicas
| # | Decisão | Motivo |
|---|---|---|
| DT-01 | Retrato em `cell_reports.snapshot_leader_id`, `snapshot_timothy_id`, `snapshot_host_id` e `snapshot_cell_type`, `NOT NULL`, FKs sem cascata e `CHECK` do tipo. O nome `snapshot_*` separa o retrato das colunas `cell_*` da view, que continuam sendo a célula atual. | RN-14; a 5.3 previa `leader_id`…, que ficaria ambíguo ao lado de `cell_leader_id` |
| DT-02 | O retrato é preenchido por um trigger `BEFORE INSERT` *definer*, com uma leitura `FOR SHARE` da célula, em qualquer caminho; no UPDATE, o retrato fica e a troca de célula é recusada. A RPC usa o retrato devolvido pelo INSERT. | Pontos 4 e 5; P-REL-12; um lugar só |
| DT-03 | Preenchimento dos relatórios existentes na migration 1, em `replica`, antes do `NOT NULL` e da troca da visibilidade, com guarda. | Ponto 8; RN-21; RN-04 c do E2.05 |
| DT-04 | Visibilidade pelo retrato: `viewer_sees_report_people` nas políticas e a forma em conjunto nas views, com o item (d) pelas pessoas registradas. Teste de paridade. | RN-14 a e b; DA-12 do E2.02 |
| DT-05 | Duas RPCs *definer*: `submit_cell_report` (lançamento) e `save_cell_report` (edição, com o nome e o retorno do E2.05). | Contratos diferentes (repetição × alteração); ponto 1 |
| DT-06 | Repetição pelo `id` da chave primária: só do mesmo autor; compara a chamada normalizada com o gravado; nunca grava nem gera evento; a corrida com a primeira tentativa cai na repetição pela trava da semana ou pela chave primária. | P-REL-29; ponto 12 |
| DT-07 | Regras em funções puras de `private`, que recebem o "agora" local; a ordem da RN-20 fica nas RPCs; as mensagens num módulo só (`private.report_raise`). | Testável por tabela; RN-20 |
| DT-08 | "Agora" = `sp_local(now())`; o futuro no minuto; a reunião no segundo. | RN-05, RN-06; E2.09 |
| DT-09 | Um por semana: trava (célula, semana) do E2.01 depois da célula e dos membros, mais o índice único; os triggers de semana saem. | Ponto 3; ordem das travas |
| DT-10 | Escrita fechada: `REVOKE` para `authenticated` e `service_role`, sem políticas de escrita e o trigger de guarda com a marca `mci.cell_report_write`. | RN-01 |
| DT-11 | Saem os triggers e as funções que só serviam à escrita direta (E2.01 PR 2, E2.02) e a `set_cell_report_participants`. | Código morto depois da DT-10 |
| DT-12 | Participantes como conjunto final calculado depois da trava; gravação pela diferença, em ordem de id; barreira dos registrados por trigger. | RN-10, RN-11, RN-16; E2.01 |
| DT-13 | Conferência e contexto da edição como leituras *definer*, com a informação do relatório só para quem o vê. | RN-19; AQ-1, AQ-10 |
| DT-14 | Formato `app_error` com `field`, inclusive `date_time` e `was_held`. | AQ-2 |
| DT-15 | Oferta sem padrão, nula em "Não houve célula", com `CHECK` de 0 a R$ 999.999,99 e as casas conferidas antes da conversão. | RN-13; DA-5, DA-6 |
| DT-16 | Tetos de texto na RPC (tipo b), na edição só nos campos alterados, com os valores numa função e no JSON. | AQ-8; DA-4 |
| DT-17 | Tabela de casos `report-rules-cases.json` para o pgTAP (gerado) e o Vitest, com a conferência de sincronia, como no E2.04 e no E2.08. | Ponto 2; AQ-6 |
| DT-18 | `cell_reports_view` com os nomes do retrato e o G12 atual do líder registrado (E2.06); `search_text` pelo líder registrado; participantes com `is_snapshot_person` e as marcas mascaradas. | RN-14 d, RN-17; AQ-3, AQ-5, AQ-7; E2.12 |
| DT-19 | Front: um diálogo para os quatro caminhos; domínio em `src/lib/cell-reports/`; `refreshAfterReportWrite`. | UXD-1; AQ-9 |
| DT-20 | Quatro PRs: dois de banco (o segundo publicado junto com o front do formulário) e dois de front. | [Implantação](#implantação) |

### Riscos (concorrência, escala, segurança)
1. **Janela entre o "Deploy: banco" do PR 2 e o promote do PR 4.** O front do E2.05 continua enviando por `save_cell_report`, com as regras novas: tema obrigatório e as recusas de data aparecem no toast, com o texto do servidor. Por isso os dois PRs vão ao ar juntos.
2. **A visibilidade muda de base.** Na publicação, ninguém ganha nem perde relatório (o retrato recebe as pessoas atuais). Daí em diante, trocar as pessoas de uma célula não leva os relatórios antigos junto (P-REL-13). É a regra, mas a liderança vai notar: entra na comunicação do aceite.
3. **Massas e testes que gravam direto** (pgTAP do E1.08 ao E2.10, `e2e/exclusao-*.spec.ts`, script de concorrência do E2.01) param até ganharem a marca de manutenção, e as asserções das políticas de escrita mudam para o `42501` do privilégio. A tarefa 5 adapta; o QA roda a suíte inteira.
4. **A marca de manutenção** dispensa as regras de lançamento. Ela só é alcançável por quem já executa SQL como `postgres`; o PostgREST não deixa o cliente definir variáveis. Nenhuma Edge Function ou rotina deve usá-la.
5. **`id` escolhido pelo navegador.** Um `id` já usado por outro autor recebe uma recusa técnica sem dado nenhum (DA-2). A repetição só responde ao autor e não confere permissão de novo depois de aceita.
6. **Espera pela trava da célula.** O envio espera uma edição da mesma célula em curso, e o contrário (E2.08, risco 3). É curto e raro.
7. **`cell_reports_view` recriada por vários passos** (E1.08, E2.01, E2.02, E2.05, E2.10 e este). Parte da definição vigente e muda só o que é dela; o pgTAP confere a lista de colunas e a paridade.
8. **Passos ainda não implementados.** O desenho usa nomes do E2.02, E2.05, E2.06, E2.08, E2.09 e E2.10. As guardas falham cedo, e as tarefas 2 e 5 releem as migrations finais.
9. **Volume** (referência do E1.08: 20 mil membros, 1.500 células, 100 mil relatórios). Metas, com `EXPLAIN ANALYZE` no PR:
   - página da `cell_reports_view` com contagem abaixo de 300 ms, para a Líder (ministério) e para a Administrador;
   - `dashboard_summary` abaixo de 800 ms e no máximo 150 ms a mais que antes;
   - `submit_cell_report` com 30 escolhidos e `save_cell_report` com 30 mudanças abaixo de 150 ms;
   - `cell_report_launch_check` abaixo de 30 ms;
   - preenchimento da migration 1 em 100 mil relatórios abaixo de 30 s (só para o ensaio; em produção hoje há só dados de teste).
10. **Carga do legado.** O retrato vem do legado e precisa resolver as três pessoas por `legacy_id` (o `NOT NULL` vale em `replica`). Uma pessoa do retrato que não migrou faz a carga falhar: o saneamento lista.
11. **Edição de relatório antigo fora das regras** (realizada sem tema ou sem oferta, "Não houve célula" sem motivo). A edição pede o que falta (RN-08, RN-09, RN-13). A conferência mostra quantos são.
12. **Segurança.** As RPCs são *definer* com `search_path` fixo e conferem a permissão dentro; nenhuma recebe id de usuário; as funções de `private` e as de trigger não têm EXECUTE para `authenticated`; `viewer_sees_report_people` só responde sobre quem consulta; a conferência não mostra o conteúdo do relatório a quem não o vê.
13. **`save_cell_report(NULL, …)` de transição** (DA-12) não tem a repetição segura. Sai no E2.12.
14. **Repositório público:** as mensagens das guardas trazem só ids e nomes de regra.

### Dependências e impactos em outros passos
| Passo | Relação |
|---|---|
| E2.01 | **Pré-requisito, inteiro.** `set_cell_report_participants` sai. `delete_cell_report` e `restore_cell_report` não mudam e passam a enxergar pelo retrato (views). O `CellReportSheet` (PR 4 de lá) ganha o bloco no PR 3 daqui. |
| E2.02 | **Pré-requisito: o PR 1.** A RN-04 passa ao retrato (fim da transição); a DA-12 é revista (item d pelas pessoas registradas); a DA-5 termina; `ab_enforce_cell_report_scope`, `ab_enforce_participant_scope`, `viewer_can_insert_cell_report*` e, se ficarem sem uso, `cell_in_viewer_ministry` e `viewer_is_cell_person` saem. O teste de paridade do relatório muda. |
| E2.05 | **Pré-requisito: o banco (PR 1).** `save_cell_report` é reescrita com o mesmo contrato. As colunas `snapshot_*` entram na lista de "não é dado" do teste de classificação. |
| E2.06 | **Pré-requisito: o PR 1** (`private.member_hierarchy`, para o G12 do líder registrado). |
| E2.07 | Os relatórios novos de "Não houve célula" não têm participantes; a P-FIL-08 já ignora os antigos. Nada a mudar. |
| E2.08 | **Pré-requisito: os PRs 1 e 2.** O `ac_enforce_cell_report_active` fica; o `TimeInput`, o `hhmm.ts`, o `members/labels.ts` e o `use-member-statuses` são reaproveitados. |
| E2.09 | **Pré-requisito: o banco** (`sp_local`, `sp_instant`) e o `refreshAfterReportWrite` do front. |
| E2.10 | `cell_recent_reports` e `cell_identity` acompanham sem mudar. O detalhe abre o `CellReportDialog` (PR 4). "Oferta: Não informada" deixa de nascer em relatórios novos de célula realizada. |
| E2.12 | Usa o retrato: colunas `snapshot_*` da tabela e da view, `search_text` pelo líder registrado, `viewer_sees_report_people` e os índices. Retira o ramo `_report_id IS NULL` da `save_cell_report` (DA-12). |
| E2.13 | Decide se a planilha ordena pelo G12 atual do líder da célula (legado) ou pelo retrato. |
| E2.14 | "Relatórios enviados" continua contando "Não houve célula"; os números de participantes incluem os automáticos. |
| E4.02 | As colunas do retrato já existem com o nome `snapshot_*`; o E4.02 só cria `legacy_id`. |
| E4.04 | O saneamento lista: relatórios sem tipo; "Não houve célula" com tema, oferta maior que zero ou visitantes; realizada sem tema; oferta negativa ou acima de R$ 999.999,99; textos acima do teto (informação); pessoas do retrato que não migram. |
| E4.06 | Em `replica`: o retrato pelo `legacy_id`; tipo vazio → o tipo da célula, contado no relatório de carga. A marca de manutenção não é usada. **Pendência (achado da revisão do PR 2, 2026-11-27):** na edição de um relatório de célula realizada, tema ou oferta nulos no gravado (legado) disparam `theme_required` ou `offering_required` mesmo sem o campo ser tocado (a regra confere o conjunto final). A carga confere quantos relatórios realizados têm tema ou oferta nulos (o E4.04 lista) e decide com o PO: corrigir no legado, preencher na carga ou aceitar que a primeira edição peça o campo. |
| E4.09 | Confere: retrato sem nulos e com as FKs válidas; participantes = `NumMembers`; visitantes = `NumVisitors`; a contagem dos relatórios com o tipo da célula. |

**Mudanças nos documentos, no aceite** (o `product-owner` atualiza a matriz, a seção 3 e o Progresso; o `architect` atualiza o resto do `CLAUDE.md` na revisão final):
- **`CLAUDE.md`:**
  - **Schema efetivo, `cell_reports`:** as colunas `snapshot_*` (retrato, `NOT NULL`); `offering` sem padrão e com `CHECK`; só SELECT para `authenticated`.
  - **Lógica no banco:** saem os itens de `enforce_unique_weekly_cell_report` e `enforce_cell_report_current_week`; entram `submit_cell_report`, `save_cell_report`, `cell_report_launch_check`, `cell_report_edit_context`, `ad_cell_report_snapshot`, `a0_guard_cell_report_write`, `ac_keep_snapshot_participants` e a visibilidade dos relatórios pelo retrato (`viewer_sees_report_people`). No item das permissões de relatório, "inserir" e "editar" passam a ser pelas RPCs.
  - **Front:** o `CellReportDialog`; o lançamento idempotente; as datas vindas do servidor.
  - **Armadilhas:** sai o item "O trigger de semana atual também barra a carga…"; novos: "gravar em `cell_reports` ou nos participantes fora das RPCs (testes, manutenção) exige `SET LOCAL mci.cell_report_write = 'on'`; a carga usa `replica`"; "na `cell_reports_view`, `cell_*` são os dados atuais da célula e `snapshot_*` são o retrato"; "`now()` é o início da transação".
  - **Problemas conhecidos:** saem a data sugerida do `CellReportForm` (`calculateCellDate`) e a regravação dos participantes do relatório (fica só a troca da função padrão, se o E2.02 ainda não a resolveu).
  - **Matriz:** os itens listados nos Impactos do Negócio.
- **`docs/migracao.md`:**
  - **3.5:** REL-01 a REL-12 e REL-15 em ✅. "Onde impor": as RPCs, o retrato e o índice da semana.
  - **5.3:** as colunas de snapshot passam a `snapshot_leader_id`, `snapshot_timothy_id`, `snapshot_host_id` e `snapshot_cell_type` (E2.11, não E4.02), com `NOT NULL`, FKs sem cascata e o `CHECK` do tipo; o `CHECK` da oferta.
  - **5.4:** as linhas novas da tabela [Dados do legado](#dados-do-legado), mais "oferta acima de R$ 999.999,99: corrigir no legado" e "texto acima do teto técnico: só listar".
  - **5.5:** o retrato pelo `legacy_id`, com o tipo vazio → o da célula; a carga em `replica` (o trigger de guarda e o do retrato não rodam).
  - **5.6:** retrato sem nulos e com FKs válidas; a contagem dos relatórios com o tipo da célula.
  - **Progresso:** a linha do E2.11 ganha o link do spec e o estado.

### Pontos de extensão
| Futuro | Onde muda |
|---|---|
| Q-1 a Q-8 | Ver [Perguntas Q-1 a Q-8](#perguntas-q-1-a-q-8) |
| Consolidação | O consolidado fica fora dos participantes, se o spec dela pedir, em `viewer_sees_member` ou numa recusa nova na validação dos participantes |
| E2.12 | Filtros pelo retrato, sobre as colunas e os índices deste passo; retirada do ramo de transição da `save_cell_report` |
| Novos limites | `private.report_limits()`, o JSON e o `limits.ts`, juntos |

### Implantação
| PR | Ordem | Efeito no front em produção |
|---|---|---|
| 1 (banco: retrato e visibilidade) | **depois do E2.01 inteiro, do PR 1 do E2.02, do banco do E2.05, do PR 1 do E2.06, dos PRs 1 e 2 do E2.08 e do banco do E2.09 em produção**, e da conferência sem linha `a` do PR 1 nem `infra`; merge → "Deploy: banco" | Nenhum visível. A lista ainda mostra o líder atual (até o PR 3). Os relatórios novos ganham o retrato pelo trigger. A troca de célula num relatório pela API passa a ser recusada. |
| 2 (banco: lançamento e edição) | depois do PR 1 em produção e da conferência sem linha `a` do PR 2; **merge do PR 2 e do PR 4 → "Deploy: banco" → promote do PR 4 em seguida** | Entre o deploy e o promote, o front do E2.05 continua enviando, com as recusas novas no toast (risco 1). |
| 3 (front: lista e consulta) | depois do PR 1 em produção; merge → promote a qualquer momento | A T10. |
| 4 (front: formulário) | depois do PR 2 e do PR 3 na `main` e do front do E2.04 (casca do P1), do E2.05, do E2.08, do E2.09 e do E2.10 que mexe nas mesmas telas; promote junto com o deploy do PR 2 | A T1 a T9. |

- O promote já recusa rodar com migration pendente.
- Antes do "Deploy: banco" de cada PR, o usuário roda a [conferência](#conferência-em-produção-tarefa-1). Uma guarda que falha não muda nada, e a publicação pode ser repetida.
- **Rollback:**
  - o front volta pelo promote do commit anterior;
  - o PR 2 volta com uma migration nova que devolve os privilégios e as políticas de escrita do E2.02, recria a `set_cell_report_participants` e tira o trigger de guarda. Os triggers de semana não voltam: o índice cobre a semana única, e a semana atual ficaria só na RPC;
  - o PR 1 volta com uma migration nova que devolve o predicado das views e das políticas às pessoas da célula. As colunas e o trigger do retrato podem ficar.

### Conferência em produção (tarefa 1)

> **Resultado em 2026-11-27, antes do PR 2 (`architect`, Management API, só leitura):** nenhuma linha `a` (nenhuma oferta fora de 0 a R$ 999.999,99). `info`: 4 relatórios excluídos. `infra`: as quatro colunas `snapshot_*` "já existem" (criadas pelo PR 1, em produção; esperado depois dele).
>
> **Resultado em 2026-11-24 (sessão principal, só leitura, com o E2.01 PR 2 em produção):** só dados de teste. `a` · RN-21: 1 relatório numa célula sem timóteo (as células de teste já apontadas no E2.08, a corrigir antes do PR 2 de lá). `infra`: os pré-requisitos do E2.02, E2.05, E2.06, E2.08 e E2.09 ainda não estão em produção (esperado).
Só leitura. O usuário roda no SQL Editor de produção (papel `postgres`), antes do "Deploy: banco" do PR 1 e de novo antes do PR 2.
- A saída traz só o tipo, o problema, o tratamento e os ids dos relatórios. Não traz nome de pessoa, tema nem valor de oferta.
- Ela lê `deleted_at` e `created_at` por `to_jsonb`, então roda com ou sem as colunas dos passos anteriores.
- Tipos:
  - `a`: para a migration do PR indicado até ser corrigido (decisão do usuário);
  - `info`: só informação;
  - `infra`: se aparecer, parar. "Pré-requisito ausente" quer dizer que o passo citado ainda não está em produção; um tipo de coluna diferente ou uma coluna de retrato já existente volta ao `architect`.

```sql
-- E2.11 · Conferência em produção, só leitura (um SELECT). Não grava nada.
WITH
rep AS (
  SELECT r.id, r.cell_id, r.date, r."time", r.was_held, r.theme, r.reason_not_held, r.observations,
         r.visitors, r.offering,
         (to_jsonb(r) ->> 'deleted_at') IS NOT NULL AS is_deleted,
         (to_jsonb(r) ->> 'created_at')::timestamptz AS created_at
    FROM public.cell_reports r
),
cel AS (
  SELECT c.id, c.leader_id, c.timothy_id, c.host_id, c.type,
         (to_jsonb(c) ->> 'deleted_at') IS NOT NULL AS is_deleted
    FROM public.cells c
),
colunas AS (
  SELECT column_name, data_type FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'cell_reports'
),
gatilhos AS (
  SELECT t.tgname FROM pg_trigger t
   WHERE t.tgrelid = 'public.cell_reports'::regclass AND NOT t.tgisinternal
),
problems (tipo, problema, tratamento, id) AS (
  -- Tipo (a), PR 1: o retrato não teria de onde vir (a célula está fora das regras do E2.08).
  SELECT 'a', 'RN-21 célula do relatório sem líder, timóteo ou anfitrião', 'completar a célula (E2.08)', r.id
    FROM rep r JOIN cel c ON c.id = r.cell_id
   WHERE c.leader_id IS NULL OR c.timothy_id IS NULL OR c.host_id IS NULL
  UNION ALL
  SELECT 'a', 'RN-21 tipo da célula fora da lista: "' || left(coalesce(c.type, '(vazio)'), 30) || '"',
         'corrigir o tipo da célula (E2.08)', r.id
    FROM rep r JOIN cel c ON c.id = r.cell_id
   WHERE c.type IS NULL OR NOT (c.type = ANY (ARRAY['Evangelística', 'Discipulado', 'Macrocélula']))
  -- Tipo (a), PR 2: a oferta ficaria fora do CHECK.
  UNION ALL
  SELECT 'a', 'RN-13 oferta negativa', 'corrigir o valor (decisão do usuário)', id FROM rep WHERE offering < 0
  UNION ALL
  SELECT 'a', 'RN-13 oferta acima de R$ 999.999,99', 'corrigir o valor (decisão do usuário)', id
    FROM rep WHERE offering > 999999.99
  -- Informação: nada a fazer na publicação.
  UNION ALL
  SELECT 'info', 'RN-21 relatório excluído', 'recebe o retrato atual da célula, como os outros', id FROM rep WHERE is_deleted
  UNION ALL
  SELECT 'info', 'RN-21 relatório de célula excluída', 'recebe o retrato atual da célula, como os outros', r.id
    FROM rep r JOIN cel c ON c.id = r.cell_id WHERE c.is_deleted
  UNION ALL
  SELECT 'info', 'RN-08 célula realizada sem tema', 'fica; a edição vai pedir o tema', id
    FROM rep WHERE NOT is_deleted AND was_held AND nullif(btrim(theme), '') IS NULL
  UNION ALL
  SELECT 'info', 'RN-13 célula realizada sem oferta', 'fica; a edição vai pedir a oferta', id
    FROM rep WHERE NOT is_deleted AND was_held AND offering IS NULL
  UNION ALL
  SELECT 'info', 'RN-09 "Não houve célula" sem motivo', 'fica; a edição vai pedir o motivo', id
    FROM rep WHERE NOT is_deleted AND NOT was_held AND nullif(btrim(reason_not_held), '') IS NULL
  UNION ALL
  SELECT 'info', 'RN-09 "Não houve célula" com participantes', 'ficam como estão', r.id
    FROM rep r
   WHERE NOT r.is_deleted AND NOT r.was_held
     AND EXISTS (SELECT 1 FROM public.cell_report_participants p WHERE p.report_id = r.id)
  UNION ALL
  SELECT 'info', 'RN-09 "Não houve célula" com tema, oferta maior que zero ou visitantes', 'ficam como estão', id
    FROM rep
   WHERE NOT is_deleted AND NOT was_held
     AND (nullif(btrim(theme), '') IS NOT NULL OR offering > 0 OR coalesce(cardinality(visitors), 0) > 0)
  UNION ALL
  SELECT 'info', 'RN-12 visitante vazio ou com espaços sobrando', 'fica; a edição normaliza', id
    FROM rep
   WHERE EXISTS (SELECT 1 FROM unnest(visitors) v
                  WHERE v IS NULL OR btrim(v) = '' OR v <> regexp_replace(btrim(v), '\s+', ' ', 'g'))
  UNION ALL
  SELECT 'info', 'AQ-8 texto acima do teto técnico', 'fica; a edição só confere o campo alterado', id
    FROM rep
   WHERE char_length(theme) > 300 OR char_length(reason_not_held) > 2000 OR char_length(observations) > 4000
      OR EXISTS (SELECT 1 FROM unnest(visitors) v WHERE char_length(v) > 150)
  UNION ALL
  SELECT 'info', 'RN-08 horário com segundos', 'fica; a edição tira os segundos', id
    FROM rep WHERE extract(second FROM "time") <> 0
  UNION ALL
  SELECT 'info', 'RN-05 data e horário depois do momento do envio', 'aceito antes do E2.11; fica como está', id
    FROM rep
   WHERE NOT is_deleted AND created_at IS NOT NULL
     AND date + "time" > date_trunc('minute', created_at AT TIME ZONE 'America/Sao_Paulo')
  -- Infraestrutura: se aparecer, parar.
  UNION ALL
  SELECT 'infra', 'cell_reports.' || e.column_name || ' não é ' || e.data_type, 'parar e voltar ao architect', NULL::uuid
    FROM (VALUES ('date', 'date'), ('time', 'time without time zone'), ('was_held', 'boolean'),
                 ('offering', 'numeric'), ('visitors', 'ARRAY'), ('theme', 'text'),
                 ('reason_not_held', 'text'), ('observations', 'text'),
                 ('deleted_at', 'timestamp with time zone')) e(column_name, data_type)
    LEFT JOIN colunas c USING (column_name)
   WHERE c.data_type IS DISTINCT FROM e.data_type
  UNION ALL
  SELECT 'infra', 'coluna que o E2.11 cria já existe: cell_reports.' || column_name, 'parar e voltar ao architect', NULL::uuid
    FROM colunas
   WHERE column_name IN ('snapshot_leader_id', 'snapshot_timothy_id', 'snapshot_host_id', 'snapshot_cell_type',
                         'leader_id', 'timothy_id', 'host_id', 'cell_type')
  UNION ALL
  SELECT 'infra', 'Pré-requisito ausente: ' || p.nome, 'publicar o passo antes', NULL::uuid
    FROM (VALUES
      ('E2.01 PR 1 (índice cell_reports_cell_week_key)', to_regclass('public.cell_reports_cell_week_key') IS NOT NULL),
      ('E2.01 PR 2 (sem DELETE para authenticated)', NOT has_table_privilege('authenticated', 'public.cell_reports', 'DELETE')),
      ('E2.02 PR 1 (can_submit_report)', to_regprocedure('public.can_submit_report(uuid)') IS NOT NULL),
      ('E2.02 PR 1 (viewer_scope_contains_any)', to_regprocedure('public.viewer_scope_contains_any(uuid[])') IS NOT NULL),
      ('E2.02 PR 1 (viewer_sees_cell_people)', to_regprocedure('public.viewer_sees_cell_people(uuid,uuid,uuid)') IS NOT NULL),
      ('E2.02 PR 1 (viewer_sees_member)', to_regprocedure('public.viewer_sees_member(uuid)') IS NOT NULL),
      ('E2.05 PR 1 (save_cell_report)', to_regprocedure('public.save_cell_report(uuid,jsonb,uuid[])') IS NOT NULL),
      ('E2.05 PR 1 (private.current_actor)', to_regprocedure('private.current_actor()') IS NOT NULL),
      ('E2.05 PR 1 (zz_stamp_authorship em cell_reports)', EXISTS (SELECT 1 FROM gatilhos WHERE tgname = 'zz_stamp_authorship')),
      ('E2.06 PR 1 (private.member_hierarchy)', to_regclass('private.member_hierarchy') IS NOT NULL),
      ('E2.08 PR 1 (ac_enforce_cell_report_active)', EXISTS (SELECT 1 FROM gatilhos WHERE tgname = 'ac_enforce_cell_report_active')),
      ('E2.08 PR 2 (cell_types e is_valid_meeting_time)',
        to_regprocedure('public.cell_types()') IS NOT NULL
        AND to_regprocedure('public.is_valid_meeting_time(time without time zone)') IS NOT NULL),
      ('E2.09 (sp_local e sp_instant)',
        to_regprocedure('public.sp_local(timestamp with time zone)') IS NOT NULL
        AND to_regprocedure('public.sp_instant(timestamp without time zone)') IS NOT NULL)) p(nome, ok)
   WHERE NOT p.ok
)
SELECT tipo, problema, tratamento, count(id) AS relatorios,
       array_agg(id ORDER BY id) FILTER (WHERE id IS NOT NULL) AS ids
  FROM problems
 GROUP BY tipo, problema, tratamento
 ORDER BY tipo, problema;
```
- Nenhuma linha `a` do PR 1 nem `infra`: o deploy do PR 1 pode seguir. O PR 2 espera também as linhas `a` da oferta.
- Na stack local (E1.08 e E2.01 PRs 1 e 2), a consulta rodou sem erro: listou a massa de volume do E1.08 (células sem timóteo, 1.101 relatórios) e os passos que ainda faltam. Na produção, o esperado são só os dados de teste.

### Verificações obrigatórias (para o QA)
**pgTAP** (`supabase/tests/database/e211_*.test.sql`, autocontidos, com `ROLLBACK`). A massa é a dos critérios: Samuel, Magda, Pedro, Paula, André, Beatriz, Caio, Carla, Lucas, Júlia, Fábio (inativo), Ester, Diego, Hugo, Rita e Bruno (excluído), com as funções do E2.02 e as células C1 a C6. As massas usam `SET LOCAL mci.cell_report_write = 'on'` para os relatórios de semanas passadas (DA-11).

- **PR 1 (`e211_01_snapshot.test.sql`):**
  - estrutura: as quatro colunas `NOT NULL`, as FKs sem cascata, o `CHECK`, os três índices parciais, o trigger *definer* sem EXECUTE para `authenticated`, a ordem dos `BEFORE` (`aa_` < `ac_` < `ad_` < `zz_`), a lista de colunas das três views (as antigas na mesma ordem, as novas no fim);
  - a migration roda de novo; a guarda falha com os ids num relatório sem retrato, sem mudar nada;
  - RN-21: o preenchimento dá às linhas existentes (inclusive excluídas e de célula excluída) as pessoas e o tipo atuais, sem evento e sem mudar `updated_at`;
  - RN-14: o INSERT ignora o retrato enviado (Lucas e Macrocélula) e grava André, Caio, Carla e Evangelística; o UPDATE do retrato não muda nada; a troca de célula dá `report_cell_immutable`; a carga em `replica` grava o retrato do legado;
  - visibilidade: todos os critérios da RN-14 (a, b) por persona, inclusive Carla só com "Enviar Relatório das Próprias Células", Fábio depois da troca de anfitriã, Pedro depois de Rita trocar as pessoas de C1 por Diego, Hugo sem função; a paridade `cell_reports_view` × política × `viewer_sees_report_people`; a `cell_reports_deleted_view`; os participantes pelo relatório;
  - colunas novas: nomes do retrato (o excluído pelo nome), G12 "Pedro" para André, nível 0 e pastor para C4, `search_text` acha "André" depois da troca; `is_snapshot_person`; `member_is_active` e `member_gender` nulos para quem quem consulta não vê;
  - `cell_recent_reports` e `cell_identity` (E2.10) continuam passando.
- **PR 2 (`e211_02_cases.test.sql`, gerado; `e211_03_submit.test.sql`; `e211_04_edit.test.sql`; `e211_05_write_closed.test.sql`):**
  - **tabela de casos:** `private.report_limits()` igual ao JSON; cada caso de lançamento e de edição com o código, as datas aceitas e a reunião do JSON, com a sessão em UTC, Brasília e Asia/Tokyo;
  - **RN-01:** `authenticated` e `service_role` recebem 42501 em INSERT e UPDATE de relatório e em INSERT, UPDATE e DELETE de participantes; `postgres` sem a marca recebe a recusa da guarda; com a marca, grava; `delete_cell_report` e `restore_cell_report` (E2.01) continuam; nenhuma política de escrita em `pg_policies`; os triggers e as funções da lista "O que sai" não existem;
  - **RN-02 a RN-13 e RN-16:** todos os critérios "pela API", com código, campo, mensagem e detalhes, pelas duas RPCs, com o relógio fixado por funções puras e, nas RPCs, com relatórios montados para "agora" (o teste lê `sp_local(now())` e escolhe as datas a partir dele);
  - **RN-15:** um evento `create` com os participantes (os automáticos inclusive) e sem o retrato; um `update` por edição com os incluídos e retirados; sem mudança, nenhum evento e `changed = false`; recusa em qualquer passo não deixa nada;
  - **RN-20:** as combinações dos critérios (sem tema com data futura → tema; Lucas com data futura → `report_submit_not_allowed`) e uma por par de itens vizinhos da ordem;
  - **repetição:** mesmo autor e mesmo conteúdo → `replayed`, igual, sem evento novo; conteúdo diferente → `replayed`, diferente, sem mudar nada; outro autor → `report_id_conflict`; excluído no meio → `not_found_or_deleted`; perdeu a permissão e a primeira não gravou → recusa;
  - **E2.05:** o teste de classificação aceita `snapshot_*` como "não é dado"; **E2.02:** a paridade de relatório; **E2.07, E2.09 e E2.10:** as suítes continuam passando.
- **Invariante, no fim de cada arquivo:** nenhum relatório sem retrato; nenhuma célula com dois relatórios não excluídos na mesma semana.

**Concorrência** (`supabase/tests/concurrency/e211_concurrency.sh`, duas conexões e `pg_sleep`, como no E2.01):
- dois envios da mesma célula e semana: um aceito, o outro `report_week_taken`;
- envio × troca do timóteo da célula: o retrato e os automáticos são todos de antes ou todos de depois;
- envio × inativação, × exclusão da célula, × exclusão de um escolhido, × restauração de outro relatório da semana;
- repetição do mesmo `id` com a primeira em andamento, com a mesma célula e com outra: uma linha só e `replayed`;
- duas edições do mesmo relatório com conjuntos de participantes diferentes: o resultado é o conjunto inteiro de uma delas.

**Volume:** as metas do risco 9, com o `EXPLAIN ANALYZE` anexado ao PR.

**Vitest:** a sincronia entre o JSON e o SQL gerado; `dates.ts`, `limits.ts`, `offering.ts` (a tabela da T6), `visitors.ts` contra o JSON; `validation.ts`, `payload.ts`, `situation-switch.ts`, `participants.ts` (o total da AQ-5), `launch-check.ts`, `codes.ts` (todos os códigos e as reservas) e `snapshot.ts`; `use-cell-report-submit` (o mesmo `attemptId` na nova tentativa; `replayed` igual e diferente).

**Playwright:** os critérios de UX de cada PR, as RNs pela tela e o *smoke* de login.

## Tarefas
_Seção do `architect`._

Quatro PRs no `mci-connect`. **O PR 1 começa depois dos pré-requisitos da [Implantação](#implantação) em produção.**
- Dentro de cada PR, o banco vai primeiro, e os tipos são regenerados antes do front.
- Cada desenvolvedor aciona o `code-reviewer` ao terminar a sua tarefa; esse passo não aparece na tabela.
- Na coluna RNs, os números são das regras deste spec. Na coluna UX, os dos critérios `UX-`.

| # | Responsável | Descrição | Arquivos | RNs | UX | Depende de |
|---|---|---|---|---|---|---|
| **PR 1: banco, retrato e visibilidade** | | | | | | |
| 1 | usuário | Rodar a [conferência](#conferência-em-produção-tarefa-1) em produção (só leitura). Uma linha `infra` para tudo. As linhas `a` do PR 1 são corrigidas antes dele; as do PR 2, antes do PR 2. | — | 13, 21 | — | pré-requisitos em produção |
| 2 | backend-developer | Migration 1: guarda de pré-requisitos e de nomes; as quatro colunas; preenchimento em `replica`; guarda; `NOT NULL`, FKs, `CHECK` e índices; `cell_report_snapshot()` e `ad_cell_report_snapshot`; `viewer_sees_report_people`; `cell_reports_view` (onze colunas no fim, `WHERE` e `search_text` pelo retrato), `cell_reports_deleted_view` e `cell_report_participants_view` (três colunas no fim), recriadas a partir da definição vigente; políticas de SELECT e UPDATE de `cell_reports`; conferir e retirar `cell_in_viewer_ministry` e `viewer_is_cell_person` se ficarem sem uso; grants. Adaptar as listas de colunas das views nos pgTAP existentes e o teste de paridade do E2.02. Regenerar o `types.ts`. | `supabase/migrations/<ts>_e211_01_snapshot.sql`, os pgTAP que listam as colunas das views, o teste de paridade do E2.02, `src/integrations/supabase/types.ts` | 01, 14, 16, 21 | dados de 06, 32, 34, 35 | 1 (sem `infra` nem `a` do PR 1) |
| 3 | qa | pgTAP do PR 1 ([Verificações](#verificações-obrigatórias-para-o-qa)); concorrência envio × troca de pessoas da célula pela escrita direta (ainda aberta); `EXPLAIN` da página da `cell_reports_view` e do `dashboard_summary` no volume de referência. | `supabase/tests/database/e211_01_snapshot.test.sql`, `supabase/tests/concurrency/e211_concurrency.sh` | 01, 14, 16, 21 | — | 2 |
| **PR 2: banco, lançamento e edição numa chamada** | | | | | | |
| 4 | qa | Tabela de casos `report-rules-cases.json` (limites, lançamento, edição, oferta e visitantes, com os casos mínimos de [Contratos](#contratos-rpc-edge-functions-colunas-novas)), o gerador do SQL e `e211_02_cases.test.sql`. | `supabase/tests/fixtures/report-rules-cases.json`, `scripts/gen-report-cases-sql.*`, `supabase/tests/database/e211_02_cases.test.sql` | 04, 05, 06, 12, 13, 16, 18 | dados de 10, 15, 17, 23, 24 | — (escreve em paralelo com a 5, a partir dos contratos) |
| 5 | backend-developer | Migration 2: guarda; enums; `private.report_limits`, `report_meeting_at`, `report_launch_rule`, `report_edit_rule`, `report_launch_dates`, `report_edit_dates`, `report_input` (e o tipo), `report_raise`; `cell_report_launch_check`; `cell_report_edit_context`. Migration 3: guarda; `private.report_replay` e as funções de participantes; `submit_cell_report`; `save_cell_report` reescrita (*definer*, mesmo contrato, ramo de transição); `guard_cell_report_write` e `a0_guard_cell_report_write` nas duas tabelas; `keep_snapshot_participants` e `ac_keep_snapshot_participants`; oferta sem padrão e `CHECK` (com guarda); saída dos triggers de semana, das políticas de escrita, dos triggers e funções da lista "O que sai" (conferindo o catálogo antes) e da `set_cell_report_participants`; `REVOKE`; grants. Adaptar as massas e asserções dos pgTAP, do Playwright e do script de concorrência que gravam direto (DA-11, leitura técnica 8) e o teste de classificação do E2.05. Regenerar o `types.ts`. | `supabase/migrations/<ts>_e211_02_rules.sql`, `supabase/migrations/<ts>_e211_03_write.sql`, `supabase/tests/database/e108_*.test.sql`, `e201_*.test.sql` e os dos passos seguintes que gravam relatório, `supabase/tests/concurrency/e201_concurrency.sh`, `e2e/exclusao-*.spec.ts`, `src/integrations/supabase/types.ts` | 01 a 13, 15, 16, 18 a 20 (banco) | dados de 09 a 13, 26 a 30 | 2 em produção; 1 (sem `a` do PR 2) |
| 6 | frontend-developer | Ajuste mínimo para o `types.ts` novo: o front do E2.05 compila e grava só por `save_cell_report`; nenhuma chamada a `set_cell_report_participants` nem escrita direta. `npm run build`, `lint` e `test` verdes. | os arquivos que ainda usarem o que sai | 01 | — | 5 (tipos) |
| 7 | qa | pgTAP do PR 2 (`e211_03` a `e211_05`); a suíte inteira dos passos anteriores; concorrência (os cenários das [Verificações](#verificações-obrigatórias-para-o-qa)); volume das RPCs; *smoke* do lançamento e da edição pela tela do E2.05. | `supabase/tests/database/e211_0{3,4,5}_*.test.sql`, `supabase/tests/concurrency/e211_concurrency.sh` | 01 a 13, 15, 16, 18 a 20 | — | 4, 5, 6 |
| **PR 3: front, lista e consulta pelo retrato** | | | | | | |
| 8 | frontend-developer | `src/lib/cell-reports/fields.ts` (seleção com o retrato), `snapshot.ts` (com Vitest) e `texts.ts`; `CellSnapshotBlock` (P105); `CellReportSheet` com "Célula de {líder registrado}" e o bloco; `CellReports.tsx` (T10: líder registrado, "G12: …", "Novo relatório"); `use-cell-report` com o retrato. | `src/lib/cell-reports/{fields,snapshot,texts}.ts`, `src/components/cell-reports/CellSnapshotBlock.tsx`, `src/components/CellReportSheet.tsx`, `src/hooks/use-cell-report.ts`, `src/pages/CellReports.tsx` | 14, 17 | 02 (lista), 34, 35, 36, 37 | 2 em produção; PR 4 do E2.01 na `main` |
| 9 | ux-designer | Revisão da UI do PR 3 (T10, P105) em 320, 360 e 1280 px, nos temas claro e escuro. | — | — | 34 a 37 | 8 |
| 10 | qa | Teste de componente (UX-35); Playwright (UX-34, os critérios da RN-14 pela lista); *smoke* de login. | `src/**/*.test.tsx`, `e2e/relatorios-retrato.spec.ts` | 14, 17 | 34, 35 | 8 |
| **PR 4: front, formulário** | | | | | | |
| 11 | frontend-developer | Domínio puro, com Vitest sobre a tabela de casos: `src/lib/cell-reports/{dates,limits,offering,visitors,validation,payload,situation-switch,participants,launch-check,codes,texts}.ts`. | os arquivos citados e os `*.test.ts` deles | 04 a 13, 16, 18 a 20 | dados de 09 a 31 | 4 (tabela); 5 (tipos) |
| 12 | frontend-developer | Formulário da UX (T1 a T9): `CellReportDialog` (três modos, P1, descartar, troca para a edição) e `LaunchNotice`, `MeetingFieldset`, `DateSelect`, `ParticipantsFieldset`, `VisitorsFieldset`, `OfferingInput`; hooks `use-cell-report-launch-check`, `use-cell-report-edit-context`, `use-cell-report-submit`, `use-cell-report-save`, `use-cell-options` (colunas do bloco, `can_submit_report`, `is_mine`), `use-member-options` (inativos com marca), `use-member-statuses`; `refreshAfterReportWrite` nas gravações e recusas; `CellReports.tsx`, `Cells.tsx`, o detalhe da célula e o Dashboard abrem o diálogo; saem `CellReportForm.tsx`, `use-save-cell-report.ts`, `calculateCellDate` e o tratamento de SQLSTATE de `report-form.ts`; `index.html` com `viewport-fit=cover`, se faltar. | `src/components/cell-reports/*`, `src/hooks/use-cell-report-*.ts`, `src/hooks/{use-cell-options,use-member-options,use-member-statuses}.ts`, `src/lib/query-refresh.ts`, `src/pages/{CellReports,Cells,Dashboard}.tsx`, a página de detalhe da célula (E2.10), `src/components/CellReportForm.tsx` (sai), `src/hooks/use-save-cell-report.ts` (sai), `src/lib/cell-reports/report-form.ts`, `index.html` | 02 a 20 | 01 a 33, 36 a 40 (UX-28 conforme a P-REL-29) | 11; PR 2 e PR 3 na `main`; front do E2.04 (casca do P1), do E2.05, do E2.08, do E2.09 e do E2.10 |
| 13 | ux-designer | Revisão da UI do PR 4 (T1 a T9, P100 a P107, P1, P20 a P22, P62, P63) em 320, 360 e 1280 px, nos temas claro e escuro; ajusta no spec o UXD-12, o F10, a T7, a T8, o P107, os Textos e o UX-28 à P-REL-29. | `docs/specs/e2-11-lancamento-relatorio.md` (Experiência) | — | 01 a 33, 36 a 40 | 12 |
| 14 | qa | Testes de componente (UX-02 a UX-09, UX-12, UX-14 a UX-26, UX-29 a UX-31, UX-40); Playwright (UX-01, UX-04 a UX-06, UX-09 a UX-11, UX-13, UX-15, UX-20 a UX-22, UX-27 a UX-30, UX-32, UX-33, UX-37, UX-38, com relógio e fuso simulados e rede simulada; as RNs pela tela; *smoke* de login); axe (UX-36). | `src/**/*.test.tsx`, `e2e/relatorio-lancamento.spec.ts`, `e2e/relatorio-edicao.spec.ts` | 02 a 20 | ver descrição | 12 |
| **Fechamento** | | | | | | |
| 15 | architect | Revisão final dos quatro PRs; atualizar o `CLAUDE.md` (estado atual, armadilhas e problemas conhecidos, ver [Dependências](#dependências-e-impactos-em-outros-passos)). O aceite, a matriz e o `docs/migracao.md` são do `product-owner`. | `CLAUDE.md` | — | — | 3, 7, 9, 10, 13, 14 |

**Ordem de execução:**
- Tarefa 1 primeiro.
- PR 1: 2 → 3 → "Deploy: banco".
- PR 2: depois do PR 1 em produção e da tarefa 1 sem linha `a` do PR 2. 4 ∥ 5 → 6 → 7.
- PR 3: depois do PR 1 em produção. 8 → (9 ∥ 10). Pode correr em paralelo com o PR 2.
- PR 4: a 11 começa depois do merge da tarefa 4 e dos tipos da tarefa 5. Depois, 12 → (13 ∥ 14), com o PR 2 e o PR 3 na `main`.
- Publicação: merge do PR 2 e do PR 4 → "Deploy: banco" → promote do PR 4.
- 15 no fim.

**Critérios de pronto**
1. **Todas as tarefas de banco:**
   - as migrations rodam num banco zerado depois das existentes e rodam de novo sem erro;
   - nenhuma função nova tem EXECUTE para `anon`; as de `private` e as de trigger não têm para `authenticated`;
   - o `types.ts` está regenerado;
   - a suíte inteira de pgTAP (a dos passos anteriores e a deste) passa.
2. **Tarefa 2:** nenhum relatório sem retrato; a paridade view × política passa para todas as personas; as views têm as colunas antigas na mesma ordem.
3. **Tarefa 5:**
   - todo critério "pela API" passa, com o código, o campo, a mensagem e os detalhes do spec, na ordem da RN-20;
   - nenhuma gravação direta pela API funciona, e `postgres` só grava com a marca;
   - a repetição nunca grava outro relatório nem outro evento;
   - os cenários de concorrência terminam com um relatório por célula e semana e sem retrato misturado.
4. **Tarefas 6, 8, 11 e 12:**
   - `npm run lint`, `npm test` e `npm run build` verdes;
   - sem `any` e sem asserção de tipo (`as Tipo`) nos arquivos novos (`as const` é permitido);
   - nenhuma regra de domínio dentro de componente;
   - nenhum texto do spec fora de `src/lib/cell-reports/texts.ts`;
   - nenhum limite fora de `limits.ts`, e nenhuma data calculada pelo relógio do aparelho fora do caso da conferência que falhou;
   - nenhuma leitura da tabela `members` direto e nenhuma escrita direta em `cell_reports` ou participantes.
5. **Tarefa 12:**
   - salvar com erro de preenchimento não faz nenhuma requisição;
   - a edição sem mudança não faz nenhuma requisição;
   - a nova tentativa usa o mesmo `attemptId`;
   - o PATCH leva só o que mudou;
   - nenhum campo do relatório fica no DOM antes da conferência.
6. **Tarefas 9 e 13:** o `ux-designer` dá o veredito e lista os ajustes, que voltam ao `frontend-developer` antes de o QA fechar o PR.

## Testes
_Seção do `qa`. No PR 2, escrita pelo `architect`, que implementou e testou sozinho (sessão sem a ferramenta `Agent`)._

| RN | Testes | Resultado |
|---|---|---|
| 04, 05, 06, 12, 13, 16, 18, 19 (regras puras) | pgTAP `e211_02_cases` (gerado de `report-rules-cases.json`: 24 lançamentos e 7 edições em UTC, Brasília e Tóquio, 13 ofertas, 7 visitantes, 19 horários do E2.08); Vitest `report-rules-cases-sync` | PR 2: passa (126 + 3) |
| 01, 02, 04 a 13, 15, 20 (lançamento) | pgTAP `e211_03_submit` (ordem da DA-8 e da RN-20, campos, participantes, datas, retrato e automáticos, Auditoria, repetição, service role, DA-12) | PR 2: passa (89) |
| 03, 05, 08 a 11, 15, 16 (edição) | pgTAP `e211_04_edit` (quem edita, semana do relatório, DA-3, DA-4, trocas da RN-09, registrados fixos, contexto da edição) | PR 2: passa (54) |
| 01, 13, 19 (escrita fechada e conferência) | pgTAP `e211_05_write_closed` (privilégios, guarda e marca, catálogo, oferta, conferência por persona) | PR 2: passa (71) |
| 07, 11, 14, 15, 16 (concorrência) | `e211_concurrency.sh` (11 cenários) e os do E2.01, E2.05 e E2.08 adaptados | PR 2: passa |
| 01 (passos anteriores) | pgTAP inteiro (62 arquivos, 5.291 testes; 5.313 depois dos ajustes do PR 2 de 2026-11-27, com o `e211_migrations.sh`); Playwright inteiro (421: 410 passam, 8 pulados; falham só o UX-19 de `excluidos-membros` e o axe de `sign-in`, conhecidos, e o UX-24 de `celulas-relatorios-escopo`, intermitente: passa sozinho); Vitest (163 arquivos, 2.365); tsc e build | PR 2: passa |
| Risco 9 (volume) | `e211_volume.psql`: conferência 7 ms; lançamento com 30 escolhidos 110 ms; edição com 30 mudanças 72 ms; página da `cell_reports_view` 187 ms (Administrador) e 214 ms (G12); `dashboard_summary` 266 a 272 ms | PR 2: metas atendidas |
| 04 a 09, 12, 13, 16, 18 (regras da tela) | Vitest `dates.test.ts` (os 24 lançamentos e 7 edições do `report-rules-cases.json`, Lisboa e Manaus, relógio do servidor) e `report-form-rules.test.ts` (oferta da T6, visitantes, conferência, chamada e PATCH, P20, automáticos, recusas, conferência antes de preencher, bloco) | PRs 3 e 4: passa (79) |
| UX-04, UX-07 a UX-09, UX-12, UX-26, UX-31 | Vitest `CellReportDialog.test.tsx` | PRs 3 e 4: passa (6) |
| UX-01, UX-03, UX-09, UX-13, UX-18 a UX-21, UX-23 a UX-25, UX-28, UX-29, UX-32 a UX-34, UX-38 | Playwright `relatorio-lancamento.spec.ts` (8) e `relatorios-retrato.spec.ts` (1); specs do E2.01, E2.02, E2.05, E2.08 e E2.09 adaptadas ao formulário novo | PRs 3 e 4: passa |
| 01 (passos anteriores) | Vitest inteiro (163 arquivos, 2.381), tsc, lint (sem problema novo), build; Playwright inteiro (430: 420 passam, 8 pulados; falham só o UX-19 de `excluidos-membros` e o axe de `sign-in`, conhecidos) | PRs 3 e 4: passa |
