# E2.01: Exclusão lógica

> Status: em refinamento. Negócio e Experiência (UX) escritos em 2026-11-23, com as pendências PO-UX-1 a PO-UX-9 resolvidas pelo PO; faltam Solução técnica, Tarefas e Testes.
> Slug: `e2-01-exclusao-logica` · Paridade com o legado: sim (DEL-01 a DEL-07, MEM-11, CEL-08), com regras novas (DEL-08, pela D10, e DEL-09).

## Negócio
_Seção do `product-owner`. Escrita em 2026-11-23 a partir da seção 3.8 do [`docs/migracao.md`](../migracao.md), das decisões D1 e D10, do código do legado e do estado atual do `mci-connect`. Atualizada no mesmo dia com as decisões do PO sobre as pendências PO-UX-1 a PO-UX-9 da seção Experiência (UX)._

### Contexto e objetivo
No legado, excluir um membro, uma célula ou um relatório só marca o registro como excluído (`IsDeleted`). Um filtro global esconde o registro de todas as consultas, e o histórico fica preservado. A decisão D1 (2026-11-14) manteve isso no novo: exclusão lógica em membros, células e relatórios, e em toda entidade de negócio que vier depois.

Hoje o novo apaga de verdade (conferido nas migrations e nas telas em 2026-11-23):
- **Membro.** O `DELETE` apaga a linha.
  - Os discípulos ficam sem líder, sem aviso (`leader_id ON DELETE SET NULL`).
  - O cônjuge perde o vínculo.
  - As participações em relatórios são apagadas (`ON DELETE CASCADE`).
  - Se o membro é líder, timóteo ou anfitrião de alguma célula, a exclusão falha com um erro genérico ("Erro ao excluir membro"), porque essas chaves não têm regra de exclusão.
  - A conta de acesso no Auth continua existindo.
- **Célula.** O `DELETE` apaga a célula e, em cascata, todos os relatórios e participantes dela.
- **Relatório.** O `DELETE` apaga o relatório e os participantes.
- As três telas confirmam com "Tem certeza que deseja excluir…?". A de Membros acrescenta "Esta ação não pode ser desfeita.".

Objetivo do passo:
- trocar a exclusão física pela lógica nas três entidades;
- esconder os excluídos de todas as telas, contagens e totais;
- impedir a exclusão de um membro que ainda tem discípulos ou células, até que essas ligações sejam reatribuídas (D10);
- cortar o acesso do membro excluído;
- permitir que um administrador restaure o que foi excluído, inclusive quando alguém tenta cadastrar de novo uma pessoa excluída.

Este passo é a base dos demais passos da fase 2: as regras de unicidade, o relatório, os totais e o dashboard dependem dele para saber o que conta.

### Termos
- **Excluir:** tirar de uso um cadastro que não deveria existir (feito por engano, duplicado ou a pedido). O registro fica guardado, com a data, a hora e o autor da exclusão, e pode ser restaurado.
- **Inativar:** marcar que a pessoa deixou de frequentar ou que a célula parou de se reunir (Situação: Inativo). Isso não muda com este spec. O inativo continua nas listas e no histórico.
- **Restaurar:** desfazer a exclusão. A DEL-09 chama isso de "reativar"; na tela, o termo é "Restaurar", para não confundir com Ativo/Inativo.
- **Excluídos:** a lista dos registros excluídos em Membros, Células e Relatórios. Só os administradores a veem.
- **Administrador:** quem tem a permissão "Gerenciar Funções" (`manage_roles`). É a mesma regra da função `is_admin` do banco. Nas funções semeadas, é a função Administrador.
- **Não excluído:** registro sem exclusão, ativo ou inativo.
- **Ligações de um membro:** os discípulos dele (membros cujo líder é ele) e os papéis dele em células (líder, timóteo ou anfitrião).
- **Reatribuir:** trocar o líder dos discípulos, ou a pessoa no papel da célula, ou então excluir a célula.

"Hoje", "agora" e a semana (domingo a sábado) seguem o horário de Brasília (`America/Sao_Paulo`).

### Personas e permissões
Os nomes entre aspas são os rótulos da tela de Funções.

| Persona | Quem é | Permissões | O que faz neste spec |
|---|---|---|---|
| AD Administrador | função Administrador, ou qualquer função com "Gerenciar Funções" | `manage_roles` e as permissões de excluir | exclui, vê "Excluídos" e restaura |
| LE Líder que exclui | função Líder (6.5), sem "Gerenciar Funções" | "Excluir Membro" (`delete_member`), "Excluir Célula" (`delete_cell`), "Excluir Relatórios de Células" (`delete_cell_report`); cada uma vale só para a sua entidade | exclui o que vê, dentro dos limites das RN-02 a RN-04; não restaura |
| CM Quem cadastra | qualquer função com "Criar Membro" (`create_member`) | — | recebe o aviso de cadastro excluído (RN-18) |
| MB Membro | sem permissão de excluir | — | não exclui; vê listas e números já sem os excluídos |
| X Membro excluído | — | nenhuma, mesmo que a função dele tenha | perde o acesso (RN-14) |
| AU Quem audita | `view_audit_log` | — | vê exclusões e restaurações na Auditoria |

### Histórias
- Como quem tem permissão de excluir, quero excluir um cadastro feito por engano ou duplicado sem perder o histórico de relatórios, para manter as listas e os números certos.
- Como líder, quero saber exatamente o que impede a exclusão de um membro (quais discípulos e quais células), para reatribuir essas ligações antes.
- Como quem exclui relatórios, quero excluir um relatório lançado errado, para que a célula possa enviar o certo na mesma semana.
- Como liderança, quero que os relatórios de uma célula excluída continuem no histórico e nas somas, para não perder o registro das reuniões que aconteceram.
- Como administrador, quero ver o que foi excluído, por quem e quando, e restaurar o que foi excluído por engano.
- Como quem cadastra membros, quero ser avisado quando a pessoa já teve um cadastro excluído, para restaurar o cadastro em vez de duplicá-lo.
- Como igreja, quero que uma pessoa excluída perca o acesso ao sistema na hora.

### Decisões

#### Decisões do usuário
| # | Decisão | Onde |
|---|---|---|
| D1 (2026-11-14) | Exclusão lógica em membros, células e relatórios, e em toda entidade de negócio nova. Os excluídos do legado migram com `deleted_at`. | RN-01 |
| D10 (2026-11-23) | Excluir um membro com discípulos ou células: **bloquear até reatribuir**, com uma mensagem que diga o que falta. | RN-04 |
| D2 (2026-11-23) | Os totais não contam inativos. Continua valendo junto com a exclusão. | RN-10 |

#### Padrões definidos por este spec (revisar no PR)
São pontos que as fontes não respondem. O PO adotou a opção mais conservadora e coerente com o legado e com a D10. Nas regras, aparecem como "definida pelo spec". O usuário pode mudar qualquer um na revisão do PR.

- **P-DEL-01, "ativo" na DEL-08.** Quer dizer "não excluído": discípulos e células **inativos também impedem** a exclusão (RN-04).
  - Motivo: sem isso, um discípulo inativo ou uma célula inativa ficaria ligado a um excluído e, se fosse reativado, voltaria com um líder excluído.
  - O texto da DEL-08 no `docs/migracao.md` ("discípulos ativos… célula ativa") deve ser ajustado no aceite.
- **P-DEL-02, mensagem de bloqueio.** A mensagem traz as contagens, até 5 nomes por grupo e o papel do membro em cada célula (RN-04).
- **P-DEL-03, limites ao excluir membro.** Ninguém exclui o próprio cadastro. Para excluir um membro, é preciso ter todas as permissões da função dele, a mesma regra que o E1.03 usa para atribuir funções. Com isso, o último administrador nunca é excluído (RN-03).
- **P-DEL-04, alcance neste passo.** Quem tem a permissão exclui os registros que vê, como hoje. O escopo de escrita (AUT-03) chega no E2.02 (RN-02).
- **P-DEL-05, quem restaura.** "Administrador" é quem tem "Gerenciar Funções". Só ele vê os excluídos e restaura. Quem tem só a permissão de excluir não desfaz a exclusão (RN-15).
- **P-DEL-06, restauração neste passo.** A restauração entra agora para as três entidades, com a lista "Excluídos" em cada tela (RN-15).
  - A de membros precisa ficar neste passo por causa da RN-18: a conta de acesso do excluído continua com o e-mail, e sem restauração a pessoa não poderia ser cadastrada de novo.
  - Se o usuário quiser um passo menor, a restauração de células e relatórios pode ir para um passo próprio.
- **P-DEL-07, termos de tela.** "Restaurar" e "Excluídos", e não "Reativar" (RN-15).
- **P-DEL-08, relatórios de célula excluída.** Aparecem com a indicação "Célula excluída" e contam em todas as somas, inclusive as da semana atual. Não podem ser editados, mas podem ser excluídos e restaurados (RN-11, RN-17).
- **P-DEL-09, participante excluído.** Aparece pelo nome no histórico e conta no número de participantes. Editar o relatório preserva essa participação (RN-13).
- **P-DEL-10, acesso.** A conta é bloqueada, e não apagada. A sessão aberta perde o acesso na hora, e o login mostra a mensagem genérica (RN-14).
- **P-DEL-11, restaurar membro.**
  - O membro volta sem cônjuge.
  - Volta sem líder se o líder foi excluído.
  - Volta com a função padrão se a função dele foi apagada.
  - A restauração é recusada se outro cadastro usa o mesmo e-mail, celular ou CPF (RN-16).
- **P-DEL-12, restaurar célula e relatório.** A célula não é restaurada se o líder, o timóteo ou o anfitrião estiver excluído. No relatório, só a regra de um relatório por semana é conferida de novo (RN-17).
- **P-DEL-13, cadastro com dado de um excluído.** Dá para seguir com o cadastro novo ("Cadastrar mesmo assim"), exceto quando o e-mail é o da conta de acesso de um excluído. Só o administrador vê o nome do excluído (RN-18).
- **P-DEL-14, registro excluído.** Não pode ser alterado. Excluir de novo é recusado, e a primeira exclusão (data e autor) fica valendo (RN-07).
- **P-DEL-15, Auditoria.** Exclusão e restauração ficam na Auditoria (RN-19).
- **P-DEL-16, confirmação.** O diálogo de exclusão deixa de dizer "não pode ser desfeita" e sugere inativar quando a pessoa ou a célula só deixou de participar (Textos de tela).
- **Vindos do desenho de UX (2026-11-23, PO-UX-1 a PO-UX-9 em "Experiência (UX)"):**
  - P-DEL-17: no bloqueio da RN-04, os discípulos e as células inativos aparecem marcados "(inativo)" ou "(inativa)", e uma linha explica que eles também contam (PO-UX-1);
  - P-DEL-18: o participante excluído não pode ser retirado de um relatório, nem de propósito, nem pela API (RN-13, PO-UX-2);
  - P-DEL-19: o relatório de célula excluída tem uma consulta ("Ver relatório"), no lugar do "Editar" e para quem tem "Editar Relatórios de Células". A consulta para todas as linhas de Relatórios fica fora deste passo (RN-11, PO-UX-3);
  - P-DEL-20: restaurar um membro pede confirmação, porque devolve o acesso ao sistema; célula e relatório restauram sem confirmação (PO-UX-4);
  - P-DEL-21: a mensagem de login é "Usuário ou senha inválidos. Confira os dados e tente de novo.", e a sessão encerrada mostra "Sua sessão terminou. Entre de novo para continuar." (RN-14, PO-UX-5);
  - P-DEL-22: a conferência da RN-18 acontece ao salvar, e não ao sair do campo (PO-UX-7);
  - P-DEL-23: o diálogo de exclusão de membro e de célula ativos traz o atalho "Marcar como inativo" (ou "inativa"), para quem pode editar (PO-UX-9);
  - os demais textos novos estão em "Textos de tela" (PO-UX-5 e PO-UX-6).

### Regras de negócio
Nenhuma regra está "a confirmar". Os caminhos do legado são relativos a `g12app-net/`, com as mesmas abreviações do `docs/migracao.md` (`App/` = `G12App.Application/`, `Domain/` = `G12App.Domain/`, `UI/` = `G12App.API/ClientApp/src/`), mais `Infra/` = `G12App.Infrastructure.Data/` e `API/` = `G12App.API/`.

| ID | Regra | Origem |
|---|---|---|
| RN-01 | **Exclusão lógica.** Excluir um membro, uma célula ou um relatório de célula marca o registro como excluído, com a data e hora e quem excluiu. O registro e as ligações dele ficam guardados.<br>- Nenhum membro, célula ou relatório é apagado fisicamente, nem pela tela nem pela API.<br>- Excluir um relatório não apaga os participantes dele, que voltam se o relatório for restaurado.<br>- Continuam com exclusão física só as tabelas de configuração (funções e permissões) e a retirada de participantes não excluídos ao editar um relatório (RN-13).<br>- A exclusão não muda nenhum outro dado do registro, exceto o cônjuge (RN-05). | DEL-01, MEM-11, CEL-08; D1 (2026-11-14); legado (`Infra/Repositories/MemberRepository.cs:75`, `CellRepository.cs:82`, `ReportRepository.cs:114`) |
| RN-02 | **Quem exclui.**<br>- Membro: "Excluir Membro" (`delete_member`).<br>- Célula: "Excluir Célula" (`delete_cell`).<br>- Relatório: "Excluir Relatórios de Células" (`delete_cell_report`).<br><br>Neste passo, quem tem a permissão exclui os registros que consegue ver, como hoje. O escopo de escrita (só o próprio ministério) chega no E2.02.<br>- Sem a permissão, a tela não mostra a ação, e a API recusa com erro de permissão.<br>- Um registro que a pessoa não vê é tratado como inexistente. | legado (`API/Controllers/MemberController.cs:50-51`, `CellController.cs:57-58`, `ReportController.cs:41-42`: perfis AppAdmin e AppSuperAdmin); REL-11; permissões atuais do novo; alcance: definida pelo spec (P-DEL-04) |
| RN-03 | **Limites ao excluir um membro.**<br>- Ninguém exclui o próprio cadastro.<br>- Para excluir um membro que tem função, quem exclui precisa ter todas as permissões dessa função. É a mesma regra que vale para atribuir funções desde o E1.03.<br><br>Assim, um líder não exclui um administrador. Como ninguém exclui a si mesmo, sempre sobra pelo menos um membro com as permissões mais altas. | definida pelo spec (P-DEL-03), coerente com a AUT-07 e com a regra 4 do E1.03 |
| RN-04 | **Membro com ligações: bloquear até reatribuir.** A exclusão de um membro é recusada enquanto ele tiver:<br>(a) discípulos não excluídos, ativos ou inativos;<br>(b) células não excluídas, ativas ou inativas, em que ele é líder, timóteo ou anfitrião.<br><br>Detalhes:<br>- Nesta regra, "ativo" quer dizer "não excluído"; a situação Ativo/Inativo não importa.<br>- A mensagem diz o que falta: quantos discípulos e quais, e quais células, com o papel dele em cada uma. Cada grupo mostra até 5 itens e, depois, "e mais N". Os itens inativos aparecem marcados "(inativo)" ou "(inativa)", e a mensagem explica que eles também contam. Nada é alterado.<br>- Uma célula é identificada pelo nome do líder, pelo dia e pelo horário.<br>- Não impedem a exclusão: o cônjuge (RN-05), as participações em relatórios, ser pastor, estar inativo e não ter líder. Discípulos e células já excluídos também não impedem.<br>- Depois de reatribuir, a exclusão é aceita. | DEL-08; D10 (2026-11-23); "ativo = não excluído" e formato da mensagem: definida pelo spec (P-DEL-01, P-DEL-02, P-DEL-17) |
| RN-05 | **Cônjuge.** Excluir um membro casado desfaz o vínculo de cônjuge nos dois cadastros, na mesma operação.<br>- O cônjuge continua no sistema, sem cônjuge.<br>- Ele aparece sozinho na árvore de Ministérios e no ranking G12.<br>- Restaurar o membro não refaz o vínculo (RN-16). | DEL-05; MEM-10; legado (`App/Services/MemberService.cs:156`); "não refaz": definida pelo spec (P-DEL-11) |
| RN-06 | **Nada aponta para um excluído.** Em nenhum momento, nem pela API, nem com operações simultâneas:<br>- um membro não excluído tem como líder ou como cônjuge um membro excluído;<br>- uma célula não excluída tem líder, timóteo ou anfitrião excluído;<br>- um relatório é lançado para uma célula excluída, ou passa a ser dela;<br>- um membro excluído entra como participante novo de um relatório.<br><br>Os seletores não oferecem excluídos, e a API recusa.<br><br>O que já estava guardado não muda:<br>- as participações antigas (RN-13);<br>- os relatórios da célula excluída (RN-11);<br>- o líder registrado no próprio cadastro excluído, usado na restauração (RN-16).<br><br>Dados do legado que violam esta regra são tratados no saneamento da migração (E4.04). | consequência da DEL-02 e da DEL-08 (D10); legado (`App/Services/ReportApp.cs:43-45`: célula excluída dá "Célula não encontrada."); demais: definida pelo spec |
| RN-07 | **Registro excluído não é alterado.** Um membro, uma célula ou um relatório excluído não pode, nem pela API:<br>- ser editado ou excluído de novo;<br>- receber relatório;<br>- ter a senha trocada ou a função alterada.<br><br>A única ação possível é restaurar (RN-15). A tentativa recebe a mensagem de "não existe ou já foi excluído" e não muda nada. A data e o autor da exclusão continuam os da primeira vez. | legado: o filtro global trata o excluído como inexistente (`Infra/Context/AppDbContext.cs:48`; "Não encontrado.", `App/Services/MemberService.cs:149`); mensagem e demais ações: definida pelo spec (P-DEL-14) |
| RN-08 | **Onde o excluído some.** Membros, células e relatórios excluídos não aparecem e não contam em:<br>- listas, buscas e totais de Membros, Células e Relatórios;<br>- seletores: líder, cônjuge, timóteo, anfitrião, participantes e célula do relatório;<br>- Dashboard: todos os cards, gráficos e o ranking G12, inclusive novos membros e novas células da semana, inativos, não batizados, sem liderança e sem vínculo celular;<br>- árvore de Ministérios;<br>- totais de discípulos e de células (RN-10);<br>- vínculo celular: célula excluída não dá vínculo, e relatório excluído não conta como participação;<br>- último relatório e situação do relatório da célula (CEL-05), e os últimos relatórios no detalhe da célula (CEL-07);<br>- link direto: o cadastro aparece como não encontrado.<br><br>Excluído não é inativo: um membro ou uma célula excluída não conta como inativa. | DEL-02; legado (`Infra/Context/AppDbContext.cs:38-49`, `HasQueryFilter`; `MemberRepository.cs:48`, `:126`; `Domain/Extensions/QueryingExtensions.cs:248-300`) |
| RN-09 | **Onde o excluído continua aparecendo.** Só nestes lugares:<br>(a) na Auditoria, com os eventos de antes e de depois da exclusão (RN-19);<br>(b) nos relatórios: o participante excluído aparece pelo nome (RN-13), e o relatório de célula excluída continua no histórico (RN-11);<br>(c) como nome de referência numa linha visível (por exemplo, o líder da célula de um relatório antigo): só o nome, sem acesso ao cadastro;<br>(d) na lista "Excluídos", para administradores (RN-15);<br>(e) no aviso do cadastro de membro novo (RN-18).<br><br>Em Escolas, quando existir, vale a ESC-33. | DEL-02 (exceções), DEL-07, DEL-09; nomes de referência: E1.08 (D-4, RN-06) |
| RN-10 | **Totais.** Os totais de discípulos e de células, inclusive os separados pelo gênero do líder, ignoram membros e células excluídos. A D2 continua valendo: inativos também não contam.<br>- Excluir um membro ativo diminui em 1 o total de discípulos de cada ancestral dele.<br>- Excluir uma célula ativa diminui em 1 o total de células de cada pessoa da cadeia do líder.<br>- Restaurar devolve os valores.<br>- Os totais mudam na mesma operação da exclusão ou da restauração. | DEL-02; HIE-04; D2; legado (`App/EventHandlers/DomainEvents/MemberChangedHandler.cs:47-51`: recálculo dos ancestrais na exclusão) |
| RN-11 | **Relatórios de uma célula excluída.** Excluir uma célula não exclui nem altera os relatórios dela, nem os participantes.<br>- Os relatórios continuam na lista de Relatórios e na busca, com a indicação "Célula excluída".<br>- Eles contam nas somas de qualquer período, inclusive a semana atual, como qualquer relatório não excluído: relatórios enviados, participantes, visitantes e ofertas.<br>- A célula excluída não entra nas contagens de células: por tipo, pendentes, sem relatório e situação do relatório.<br>- O relatório de célula excluída fica só para consulta e não é editado. Para corrigi-lo, restaure a célula. Ele pode ser excluído e restaurado (RN-12, RN-17).<br>- Quem tem "Editar Relatórios de Células" consulta esse relatório no lugar da edição: data e hora, situação, tema ou motivo, participantes pelo nome (inclusive os excluídos), visitantes, oferta e observações. Quem não tem essa permissão continua sem ver os participantes, como acontece com os demais relatórios.<br>- A célula excluída não recebe relatório novo (RN-06). | DEL-07; CEL-08; legado (relatórios filtrados só pela própria exclusão: `Infra/Repositories/ReportRepository.cs:68-75`); indicação, edição bloqueada e consulta: definida pelo spec (P-DEL-08, P-DEL-19) |
| RN-12 | **Excluir um relatório libera a semana.** O relatório excluído sai das listas, das somas e das contagens. Os participantes ficam guardados com ele e deixam de contar, inclusive no vínculo celular.<br>- A célula pode receber outro relatório da mesma semana, seguindo as regras de lançamento: semana atual, sem data futura e depois do horário da célula (REL-01, REL-02, REL-04).<br>- Se a reunião da semana já passou, a célula volta a contar como pendente até o relatório novo. | DEL-03; REL-03; legado (`App/Services/ReportApp.cs:34-41`: só relatórios não excluídos contam) |
| RN-13 | **Participante excluído no histórico.** Num relatório, o membro excluído continua como participante:<br>- aparece pelo nome, sem acesso ao cadastro, e conta no número de participantes;<br>- ao editar o relatório, a participação dele fica como estava: ele não aparece como opção no seletor, não é duplicado e não pode ser retirado, nem de propósito, nem pela API. Como ele não volta como participante novo (RN-06), retirá-lo apagaria o histórico sem volta.<br><br>Restaurar o membro não muda nada nos relatórios. | definida pelo spec (P-DEL-09, P-DEL-18), seguindo o E1.08 ("os participantes continuam mostrando o nome de membros excluídos"); no legado, o número de participantes (`NumMembers`) também não mudava com a exclusão |
| RN-14 | **Acesso do membro excluído.**<br>- Ele não entra mais no sistema, por e-mail, celular ou CPF, nem pela recuperação de senha. A mensagem é "Usuário ou senha inválidos. Confira os dados e tente de novo.", a mesma de identificação inexistente, senha errada e conta bloqueada, sem revelar a exclusão. Só a falha de conexão tem mensagem própria, que também não revela nada sobre o cadastro.<br>- Com a sessão aberta, ele perde o acesso na hora: a partir da exclusão, nenhuma leitura ou gravação dele é aceita, e a tela o leva para o login com "Sua sessão terminou. Entre de novo para continuar.". Esse aviso vale para qualquer fim forçado de sessão, para não revelar a exclusão.<br>- Ele não tem permissão nenhuma, mesmo que a função dele tenha.<br>- A conta de acesso é bloqueada, e não apagada. A senha fica guardada para uma eventual restauração. | DEL-06; legado (o login só busca não excluídos: `App/Services/AuthService.cs:59-63`); mensagem genérica: 6.3 do `docs/migracao.md`; sessão, textos e bloqueio da conta: definida pelo spec (P-DEL-10, P-DEL-21) |
| RN-15 | **Excluídos e restauração.** Administrador é quem tem "Gerenciar Funções" (`manage_roles`).<br>- Só o administrador vê os excluídos e restaura. Quem tem só a permissão de excluir não restaura.<br>- Em Membros, Células e Relatórios, o administrador pode abrir a lista "Excluídos". Ela tem busca, vai da exclusão mais recente para a mais antiga e mostra a data e hora da exclusão e quem excluiu. Ele vê os excluídos que veria se eles não estivessem excluídos.<br>- Restaurar devolve o registro como estava antes da exclusão: dados, ligações guardadas, participações e totais (RN-10). As exceções estão nas RN-16 e RN-17.<br>- Na tela, a ação se chama "Restaurar".<br>- Restaurar um registro que não está excluído é recusado. | DEL-09; "administrador", lista, termo e ordem: definida pelo spec (P-DEL-05 a P-DEL-07) |
| RN-16 | **Restaurar um membro.**<br>(a) Ele volta com a mesma situação (ativo ou inativo), os mesmos dados e a mesma função. Se a função foi apagada, volta com a função padrão. O nível ministerial e os totais são recalculados.<br>(b) Quem restaura precisa poder atribuir a função dele (a regra da RN-03).<br>(c) Ele volta sem cônjuge (RN-05).<br>(d) Se o líder dele foi excluído, ele volta sem líder, e a mensagem pede para definir o novo líder. Até lá, ele conta em "sem liderança".<br>(e) A restauração é recusada se outro membro não excluído usa o mesmo e-mail, celular ou CPF. A mensagem diz qual dado.<br>(f) A conta de acesso volta a funcionar, com a mesma senha. Quem não tinha conta continua sem conta (ver Fora de escopo, E4.08). | DEL-09; DEL-04 (item e); definida pelo spec (P-DEL-11) |
| RN-17 | **Restaurar uma célula ou um relatório.**<br>- **Célula:** a restauração é recusada se o líder, o timóteo ou o anfitrião estiver excluído; a mensagem diz quem. Restaurada, a célula volta às listas, aos totais e às contagens, e os relatórios dela voltam a poder ser editados.<br>- **Relatório:** a restauração é recusada se a célula já tem outro relatório não excluído na mesma semana do relatório (REL-03), que pode ser uma semana passada; a mensagem diz "na mesma semana". As regras de lançamento (REL-01, REL-02, REL-04) não são conferidas de novo, porque restaurar não é lançar. O relatório de uma célula excluída também pode ser restaurado e continua só para consulta (RN-11). | DEL-09; DEL-03; definida pelo spec (P-DEL-12); texto da mensagem: PO-UX-6 |
| RN-18 | **Cadastro com dados de um membro excluído.** Vale ao salvar um membro novo cujo e-mail, celular ou CPF é igual ao de um membro excluído. A conferência é feita ao salvar, e não ao sair do campo. Pela DEL-04, a duplicidade só vale entre cadastros não excluídos; na edição de um membro existente, vale a unicidade do E2.04.<br>- **Administrador:** a tela mostra cada cadastro excluído que combina (nome, dado em comum e data da exclusão) e oferece restaurar cada um ("Restaurar {Nome}"). Restaurado, o cadastro volta como estava (RN-16). O que foi digitado não é gravado, e a tela abre o cadastro restaurado para edição.<br>- **Quem não é administrador:** a tela avisa que existe um cadastro excluído com aquele dado, sem mostrar o nome (que também não sai do servidor), e orienta a pedir a restauração a um administrador.<br>- **Nos dois casos,** é possível seguir com o cadastro novo ("Cadastrar mesmo assim") ou voltar ao formulário sem perder o que foi digitado ("Voltar ao formulário"). A exceção é o e-mail da conta de acesso de um membro excluído: como a conta continua existindo (RN-14), o cadastro novo com esse e-mail é recusado, inclusive pela API, e só resta restaurar ou usar outro e-mail. | DEL-04; DEL-09; legado (`Domain/Validators/MemberDtoValidator.cs:45-57`: duplicidade só entre não excluídos); demais: definida pelo spec (P-DEL-13, P-DEL-22); textos: PO-UX-5 e PO-UX-6 |
| RN-19 | **Auditoria.** A Auditoria registra a exclusão e a restauração de membros, células e relatórios, com quem fez, quando e o nome do registro. Quando a exclusão desfaz um vínculo de cônjuge, a alteração do cônjuge também é registrada. | definida pelo spec (P-DEL-15); a Auditoria já registra exclusões hoje; a autoria nas colunas (MEM-12) é do E2.05 |
| RN-20 | **Tudo ou nada.** Excluir e restaurar acontecem por inteiro ou não acontecem: a marcação, o cônjuge, os totais, o acesso e a Auditoria mudam juntos.<br>- Se alguma parte falhar, a mensagem pede para tentar de novo. Nunca fica um membro excluído com acesso, nem um membro não excluído bloqueado.<br><br>Com operações simultâneas:<br>- se duas pessoas excluem o mesmo registro, só a primeira exclusão vale; a segunda recebe "não existe ou já foi excluído";<br>- se alguém exclui um membro enquanto outra pessoa o escolhe como líder, cônjuge, timóteo ou anfitrião, só uma das duas operações é aceita;<br>- se um relatório é restaurado enquanto a célula recebe outro da mesma semana, só um dos dois fica. | definida pelo spec; no legado, a transação do EF |

### Critérios de aceite
Quando o critério diz "pela API", vale para qualquer chamada feita fora da tela. "Erro de permissão" é o código 42501, sem nenhuma gravação. Os horários são de Brasília. Personas: AD, LE, CM e MB, como na tabela de personas.

- **RN-01**
  - Dados o membro Ana, a célula de Carlos (quarta, 20:00) e um relatório dessa célula
  - Quando quem tem a permissão exclui cada um
  - Então os três somem das telas (RN-08), e o banco guarda os três, com a data e hora da exclusão e quem excluiu.
  - Dado qualquer usuário, inclusive AD
  - Quando ele tenta apagar fisicamente um membro, uma célula ou um relatório pela API
  - Então recebe erro de permissão, e nada é apagado.
  - Dado um relatório com 8 participantes
  - Quando ele é excluído e depois restaurado
  - Então volta com os mesmos 8 participantes.
- **RN-02**
  - Dado LE, com "Excluir Membro", e o membro Bruno, que LE vê e que não tem ligações
  - Quando LE exclui Bruno
  - Então a exclusão é aceita.
  - Dado MB, sem nenhuma permissão de excluir
  - Quando MB abre Membros, Células e Relatórios
  - Então não vê a ação "Excluir"; pela API, cada tentativa recebe erro de permissão, e nada muda.
  - Dado LE, com escopo do próprio ministério, e o membro Davi, de outro ministério, que LE não vê
  - Quando LE tenta excluir Davi pela API
  - Então recebe "Este cadastro não existe ou já foi excluído.", e Davi continua.
  - Dado um usuário com "Excluir Célula" e sem "Excluir Relatórios de Células"
  - Quando ele tenta excluir um relatório pela API
  - Então recebe erro de permissão.
- **RN-03**
  - Dado LE, com "Excluir Membro"
  - Quando LE tenta excluir o próprio cadastro, pela tela ou pela API
  - Então recebe "Você não pode excluir o seu próprio cadastro.", e nada muda.
  - Dados a administradora Elisa e LE, cuja função não tem todas as permissões da função de Elisa
  - Quando LE tenta excluir Elisa
  - Então recebe "Você não tem permissão para excluir este membro.", e Elisa continua.
  - Dados AD e outro administrador, Fábio, sem ligações
  - Quando AD exclui Fábio
  - Então a exclusão é aceita, e AD continua sem poder excluir a si mesmo.
- **RN-04**
  - Dado Gil, com os discípulos ativos Hugo, Ivo e João, o discípulo inativo Léo, timóteo da célula de Carlos (quarta, 20:00) e anfitrião da célula inativa de Marcos (sexta, 19:30)
  - Quando LE tenta excluir Gil
  - Então o bloqueio "Não é possível excluir Gil" lista, depois de "Antes, reatribua:", 4 discípulos (Hugo, Ivo, João e "Léo (inativo)") e 2 células ("Timóteo na célula de Carlos, quarta, 20:00" e "Anfitrião na célula de Marcos, sexta, 19:30 (inativa)"), com a explicação de que inativos também contam, e nada muda.
  - Dado o mesmo Gil, depois que os 4 discípulos receberam outro líder, a célula de Carlos recebeu outro timóteo e a célula de Marcos foi excluída
  - Quando LE exclui Gil
  - Então a exclusão é aceita.
  - Dado Gil com 7 discípulos
  - Então a mensagem cita 5 nomes e "e mais 2".
  - Dado Gil, cujo único discípulo já foi excluído
  - Então esse discípulo não impede a exclusão de Gil.
  - Dado um pastor com discípulos G12
  - Quando AD tenta excluí-lo
  - Então a exclusão é recusada pela mesma regra, com a lista dos discípulos.
  - Dada Nina, inativa, sem líder, casada, participante de 20 relatórios, sem discípulos e sem células
  - Quando LE exclui Nina
  - Então a exclusão é aceita.
- **RN-05**
  - Dados o casal Otávio e Paula, e Paula sem ligações
  - Quando Paula é excluída
  - Então o cadastro de Otávio fica sem cônjuge, e ele aparece sozinho na árvore de Ministérios e no ranking G12.
  - Quando Paula é restaurada
  - Então os dois continuam sem cônjuge até alguém refazer o vínculo.
- **RN-06**
  - Dado o membro excluído Quintino
  - Quando alguém abre os seletores de líder, cônjuge, timóteo, anfitrião ou participantes
  - Então Quintino não aparece.
  - Quando alguém envia pela API um membro com líder ou cônjuge Quintino, uma célula com Quintino como líder, timóteo ou anfitrião, ou um relatório com Quintino como participante novo
  - Então recebe "Este membro foi excluído e não pode ser escolhido.", e nada é gravado.
  - Dada a célula excluída de Rui
  - Quando alguém tenta, pela API, lançar um relatório para ela ou passar um relatório para ela
  - Então recebe "Esta célula foi excluída e não recebe relatórios.".
  - Dado o banco depois de qualquer sequência de operações deste spec
  - Então não existe membro não excluído com líder ou cônjuge excluído, nem célula não excluída com líder, timóteo ou anfitrião excluído.
- **RN-07**
  - Dado o membro excluído Quintino
  - Quando AD tenta editá-lo ou excluí-lo de novo pela API
  - Então recebe "Este cadastro não existe ou já foi excluído.", nada muda, e a data e o autor da exclusão continuam os originais.
  - Dado um relatório excluído
  - Quando alguém tenta editá-lo pela API
  - Então recebe "Este relatório não existe ou já foi excluído.".
  - Dada uma célula excluída
  - Quando alguém tenta editá-la pela API
  - Então recebe "Esta célula não existe ou já foi excluída.".
- **RN-08**
  - Dado um usuário que vê a igreja toda, com 100 membros (90 ativos e 10 inativos) e 20 células
  - Quando 1 membro ativo, 1 membro inativo e 1 célula evangelística são excluídos
  - Então a lista de Membros mostra o total 98 e a de Células, 19; no Dashboard, o card de membros ativos mostra 89, o de inativos mostra 9, e o de células evangelísticas diminui 1.
  - Dada Sara, cadastrada nesta semana e depois excluída
  - Então ela não conta em "novos membros" da semana, e a busca "Sara" em Membros não a encontra.
  - Dado o link direto para o cadastro de Sara
  - Quando alguém o abre
  - Então a tela mostra que o cadastro não foi encontrado.
  - Dado Tiago, líder de uma única célula, que foi excluída
  - Então Tiago deixa de ter vínculo celular como líder.
  - Dado Ubiratan, ativo e não pastor, cuja única participação nos últimos 30 dias foi num relatório que foi excluído
  - Então Ubiratan aparece em "sem vínculo celular".
- **RN-09**
  - Dada Sara, excluída, participante de um relatório de 2 semanas atrás
  - Quando alguém que vê o relatório abre os participantes
  - Então "Sara" aparece pelo nome, sem acesso ao cadastro.
  - Dado um usuário com `view_audit_log`
  - Quando ele abre a Auditoria
  - Então vê os eventos de Sara de antes e de depois da exclusão, com o nome dela.
- **RN-10**
  - Dados Vera (G12), o discípulo Wagner e o discípulo de Wagner, Xavier (ativo e sem ligações), com Vera somando 2 discípulos
  - Quando Xavier é excluído
  - Então Vera passa a 1 discípulo e Wagner a 0, na mesma operação.
  - Quando Xavier é restaurado
  - Então Vera volta a 2 e Wagner a 1.
  - Dada a célula ativa de Wagner, que é homem
  - Quando ela é excluída
  - Então o total de células e o de células masculinas de Wagner e de Vera diminuem 1; restaurada a célula, eles voltam.
  - Dado um membro inativo sem ligações
  - Quando ele é excluído
  - Então nenhum total muda (D2).
- **RN-11**
  - Dada a célula de Yara, com 10 relatórios, um deles desta semana, com 6 visitantes e oferta de R$ 50,00
  - Quando a célula é excluída
  - Então os 10 relatórios continuam em Relatórios, com a indicação "Célula excluída"; os relatórios enviados e os visitantes desta semana continuam contando esse relatório e os 6 visitantes; e a célula sai das contagens por tipo e das pendentes.
  - Dado um relatório dessa célula
  - Quando alguém com "Editar Relatórios de Células" tenta editá-lo pela API
  - Então recebe "A célula deste relatório foi excluída. Restaure a célula para editar o relatório.".
  - Quando essa pessoa abre o relatório na tela
  - Então não vê "Editar"; vê "Ver relatório", com a data, a situação, o tema, os participantes pelo nome, os visitantes, a oferta, as observações e o aviso acima.
  - Dado MB, sem "Editar Relatórios de Células"
  - Então a linha mostra "Célula excluída", mas sem "Ver relatório" nem os participantes.
  - Quando alguém com "Excluir Relatórios de Células" o exclui
  - Então a exclusão é aceita.
  - Quando o líder tenta lançar um relatório novo para a célula
  - Então a célula não aparece no seletor, e a API recusa (RN-06).
- **RN-12**
  - Dada a célula de Zeca (quarta, 20:00), com o relatório desta semana lançado na quarta às 21:00
  - Quando quem tem "Excluir Relatórios de Células" o exclui no sábado às 23:50
  - Então a célula volta a contar como pendente, e o líder consegue lançar outro relatório no sábado às 23:55.
  - Dado que o relatório só é excluído no domingo às 00:05
  - Então a semana dele já passou, e um relatório novo daquela semana é recusado pela regra da semana atual (REL-02).
  - Dado um relatório excluído do qual Ubiratan participou
  - Então essa participação não conta no vínculo celular de Ubiratan.
- **RN-13**
  - Dado o relatório R, com as participantes Ana e Sara, e Sara excluída
  - Então R mostra 2 participantes, com os nomes Ana e Sara.
  - Quando quem tem "Editar Relatórios de Células" edita R, muda o tema e acrescenta Bruno
  - Então R fica com Ana, Bruno e Sara, e Sara não aparece como opção no seletor.
  - Quando alguém tenta retirar Sara de R, pela tela ou pela API
  - Então a tela não oferece a retirada, a API recusa com "Não é possível retirar um participante cujo cadastro foi excluído.", e Sara continua em R.
- **RN-14**
  - Dada Ana, com conta de acesso, excluída
  - Quando ela tenta entrar com o e-mail, o celular ou o CPF e a senha certa
  - Então recebe "Usuário ou senha inválidos. Confira os dados e tente de novo.", o mesmo texto de uma identificação inexistente e de uma senha errada.
  - Quando ela pede a recuperação de senha
  - Então não consegue entrar pelo link.
  - Dada Ana com a sessão aberta, numa função com "Excluir Membro"
  - Quando AD a exclui
  - Então a próxima leitura de Ana pela API não devolve nada, a próxima gravação recebe erro de permissão (inclusive a exclusão de outro membro com a sessão antiga), e a tela a leva para o login com "Sua sessão terminou. Entre de novo para continuar.".
  - Dada uma queda de conexão durante a sessão de um membro não excluído
  - Então a sessão não é encerrada.
  - Quando Ana é restaurada
  - Então ela entra com a mesma senha de antes.
- **RN-15**
  - Dado AD
  - Quando ele abre "Excluídos" em Membros, Células e Relatórios
  - Então vê os registros excluídos, da exclusão mais recente para a mais antiga, com a data e hora da exclusão e o nome de quem excluiu, e pode buscar e restaurar.
  - Dado LE, com "Excluir Membro" e sem "Gerenciar Funções"
  - Então não vê "Excluídos", e a restauração pela API recebe erro de permissão.
  - Dado Bruno, ativo, excluído por engano, com 12 participações e o líder Gil, não excluído
  - Quando AD restaura Bruno
  - Então Bruno volta às listas com o líder Gil, as 12 participações, os mesmos dados e a mesma função, e o total de discípulos de Gil e dos ancestrais dele aumenta 1.
  - Dado Hugo, não excluído
  - Quando AD tenta restaurá-lo pela API
  - Então recebe "Este cadastro não está excluído.", e nada muda.
- **RN-16**
  - Dado Bruno excluído, cujo líder Gil foi excluído depois
  - Quando AD restaura Bruno
  - Então Bruno volta sem líder, aparece em "sem liderança" (se for ativo e não for pastor), e a mensagem diz "Cadastro restaurado sem líder, porque o líder anterior (Gil) foi excluído. Defina o novo líder.".
  - Dados Bruno excluído, com o celular (51) 99999-0000, e Caio, não excluído, cadastrado depois com o mesmo celular
  - Quando AD tenta restaurar Bruno
  - Então recebe "Não é possível restaurar: outro cadastro já usa este celular.", e nada muda.
  - Dado Bruno excluído com a função Líder, que foi apagada depois
  - Quando AD o restaura
  - Então Bruno volta com a função padrão.
  - Dado Fábio excluído, com a função Administrador, e um administrador cuja função não tem todas as permissões de Administrador
  - Quando esse administrador tenta restaurar Fábio
  - Então recebe "Você não tem permissão para restaurar este membro.".
  - Dado Bruno, inativo quando foi excluído
  - Quando AD o restaura
  - Então ele volta inativo.
- **RN-17**
  - Dada a célula excluída de Rui, cujo anfitrião Quintino foi excluído depois
  - Quando AD tenta restaurá-la
  - Então recebe "Não é possível restaurar a célula: o anfitrião Quintino foi excluído. Restaure o cadastro dele antes ou crie uma célula nova.", e nada muda.
  - Dada a célula excluída de Rui, com líder, timóteo e anfitrião não excluídos
  - Quando AD a restaura
  - Então ela volta às listas, aos totais e às contagens, e os relatórios dela voltam a poder ser editados.
  - Dado o relatório R, de uma semana que já passou, excluído, de uma célula sem outro relatório naquela semana
  - Quando AD o restaura no domingo seguinte
  - Então R volta, mesmo fora da semana atual.
  - Dados o relatório R desta semana, excluído, e o relatório S, da mesma célula e da mesma semana, lançado depois
  - Quando AD tenta restaurar R
  - Então recebe "Esta célula já tem outro relatório na mesma semana. Exclua-o antes de restaurar este.".
  - O mesmo vale quando R e S são de uma semana passada.
- **RN-18**
  - Dado Bruno excluído, com conta de acesso no e-mail bruno@exemplo.com
  - Quando AD cadastra um membro novo com bruno@exemplo.com
  - Então a tela mostra "Já existe um cadastro excluído com este e-mail: Bruno, excluído em 10/11/2026." e oferece "Restaurar Bruno" e "Voltar ao formulário", sem "Cadastrar mesmo assim". Ao restaurar, o cadastro de Bruno volta como estava e abre para edição, e nada do que foi digitado é gravado.
  - Quando ele escolhe "Voltar ao formulário"
  - Então o aviso fecha, e tudo o que foi digitado continua no formulário.
  - Quando LE, que não é administrador, faz o mesmo cadastro
  - Então vê "Este e-mail pertence a um cadastro excluído. Peça a um administrador para restaurá-lo ou use outro e-mail.", sem o nome de Bruno (nem na tela, nem na resposta do servidor), e o cadastro novo é recusado, inclusive pela API.
  - Dado um membro excluído com o celular (51) 98888-0000
  - Quando CM cadastra uma pessoa nova com esse celular
  - Então vê "Há um cadastro excluído com este celular" e "Se for a mesma pessoa, peça a um administrador para restaurá-lo. Se for outra pessoa, você pode cadastrar mesmo assim.", e pode escolher "Cadastrar mesmo assim", que cria o cadastro novo, ou "Voltar ao formulário". O mesmo vale para o CPF.
  - Dado o mesmo membro excluído
  - Quando CM só digita o celular e passa para o próximo campo, sem salvar
  - Então nenhum aviso aparece; a conferência é feita ao salvar.
  - Dados um membro excluído com o e-mail informado e outro membro excluído com o CPF informado
  - Quando AD salva o cadastro novo
  - Então a tela mostra os dois cadastros excluídos, cada um com o seu "Restaurar {Nome}".
- **RN-19**
  - Dado AD
  - Quando ele exclui e depois restaura a célula de Rui
  - Então a Auditoria mostra dois registros, um da exclusão e outro da restauração da célula de Rui, cada um com AD e o horário.
  - Quando a exclusão de Paula desfaz o vínculo com Otávio
  - Então a Auditoria mostra a exclusão de Paula e a alteração do cônjuge de Otávio.
- **RN-20**
  - Dados dois administradores que excluem Bruno ao mesmo tempo
  - Então só uma exclusão vale, com o autor dela, e o outro recebe "Este cadastro não existe ou já foi excluído.".
  - Dados LE excluindo Gil e, ao mesmo tempo, outro usuário definindo Gil como líder de Hugo
  - Então acontece só uma das duas: ou Gil é excluído e Hugo continua com o líder anterior (a alteração é recusada pela RN-06), ou Hugo passa a ter Gil como líder e a exclusão de Gil é recusada (RN-04).
  - Dada uma falha em qualquer parte da exclusão ou da restauração de Ana (por exemplo, no bloqueio ou desbloqueio do acesso)
  - Então Ana não fica excluída com acesso nem não excluída sem acesso, e a mensagem pede para tentar de novo.

### Textos de tela
Vocabulário de referência. O `ux-designer` pode ajustar o tom, mas não o sentido nem os termos.

- **Termos:** Excluir, Excluídos (Membros e Relatórios), Excluídas (Células), Restaurar, Excluído em, Excluído por, Célula excluída, Ver relatório, Marcar como inativo (ou inativa).
- **Evitar:** "Deletar", "Apagar" e "Reativar" (para exclusão; "Ativo/Inativo" é outra coisa) e "Lixeira".
- **Forma:** as confirmações aparecem em tópicos curtos, com o mesmo conteúdo da tabela (PO-UX-6). Os textos vindos do desenho de UX e aprovados pelo PO em 2026-11-23 (PO-UX-1, PO-UX-4, PO-UX-5 e PO-UX-6) já estão na tabela.

| Situação | Texto |
|---|---|
| confirmar exclusão de membro | Título: Excluir <nome>? · Tópicos: O cadastro sai das listas, dos totais e do dashboard. / A pessoa perde o acesso ao sistema. / Os relatórios em que ela aparece continuam no histórico. / Um administrador pode restaurar o cadastro depois. · Aviso (só com o cadastro ativo): Se a pessoa só deixou de frequentar, prefira marcá-la como inativa. · Botões: Excluir cadastro · Cancelar · Marcar como inativo (só com "Editar Membro") |
| confirmar exclusão de célula | Título: Excluir a célula de <líder>? · Linha: <dia>, <hora> · <endereço> · Tópicos: A célula sai das listas e dos totais. / Os relatórios dela continuam no histórico. / Um administrador pode restaurá-la depois. · Aviso (só com a célula ativa): Se a célula só parou de se reunir, prefira marcá-la como inativa. · Botões: Excluir célula · Cancelar · Marcar como inativa (só com "Editar Célula") |
| confirmar exclusão de relatório | Título: Excluir o relatório de <data> da célula de <líder>? · Tópicos: Ele sai das listas e das somas. / A célula poderá enviar outro relatório para a semana dele, se ainda for a semana atual. / Um administrador pode restaurá-lo depois. · Botões: Excluir relatório · Cancelar |
| atalho de inativar | Cadastro marcado como inativo. · Célula marcada como inativa. |
| membro com ligações | Título: Não é possível excluir <nome> · Antes, reatribua: · <N> discípulos (ou 1 discípulo): <nomes>, com "(inativo)" nos inativos · <N> células (ou 1 célula): <Papel> na célula de <líder>, <dia>, <hora>, com "(inativa)" nas inativas · e mais <N> · Explicação: Discípulos e células inativos também contam. Para reatribuir um discípulo, abra o cadastro dele e escolha outro líder. Para uma célula, troque a pessoa na célula ou exclua a célula. · Fechar |
| próprio cadastro | Você não pode excluir o seu próprio cadastro. |
| função acima de quem exclui | Você não tem permissão para excluir este membro. |
| membro inexistente ou já excluído | Este cadastro não existe ou já foi excluído. |
| célula inexistente ou já excluída | Esta célula não existe ou já foi excluída. |
| relatório inexistente ou já excluído | Este relatório não existe ou já foi excluído. |
| membro excluído escolhido | Este membro foi excluído e não pode ser escolhido. |
| retirar participante excluído (API) | Não é possível retirar um participante cujo cadastro foi excluído. |
| participantes excluídos no formulário do relatório | Continuam no relatório (cadastros excluídos): <nomes>. |
| relatório para célula excluída | Esta célula foi excluída e não recebe relatórios. |
| editar relatório de célula excluída | A célula deste relatório foi excluída. Restaure a célula para editar o relatório. |
| relatório de célula excluída na lista | Célula excluída · Ver relatório |
| sucesso | Cadastro excluído. · Célula excluída. · Relatório excluído. · Cadastro restaurado. · Célula restaurada. · Relatório restaurado. |
| lista de excluídos | Botão: Excluídos (Membros, Relatórios) · Excluídas (Células) · Títulos: Membros excluídos · Células excluídas · Relatórios excluídos · Item: Excluído em <data> às <hora> (Excluída, na célula) · por <nome> · Autor não registrado (exclusão sem autor, como as vindas do legado) · "(cadastro excluído)" ao lado do líder, do timóteo ou do anfitrião excluído · Já há outro relatório desta célula na mesma semana. · Restaurar |
| confirmar restauração de membro | Título: Restaurar o cadastro de <nome>? · Tópicos: O cadastro volta às listas e aos totais, com os mesmos dados e a função <função>. / A pessoa volta a entrar no sistema com a mesma senha (só se ela tem conta de acesso). / O vínculo de cônjuge não volta. Se havia, refaça-o no cadastro. / Volta sem líder, porque o líder anterior (<nome>) foi excluído (só quando for o caso). · Botões: Restaurar cadastro · Cancelar |
| restaurar sem líder | Título: Cadastro restaurado · Cadastro restaurado sem líder, porque o líder anterior (<nome>) foi excluído. Defina o novo líder. · Botões: Definir líder · Agora não |
| restaurar com a função padrão | O cadastro voltou com a função padrão (<função>), porque a função anterior foi apagada. |
| restaurar com dado em uso | Não é possível restaurar: outro cadastro já usa este <e-mail \| celular \| CPF>. |
| restaurar membro de função acima | Você não tem permissão para restaurar este membro. |
| restaurar célula com pessoa excluída | Não é possível restaurar a célula: o <líder \| timóteo \| anfitrião> <nome> foi excluído. Restaure o cadastro dele antes ou crie uma célula nova. |
| restaurar relatório com outro na semana | Esta célula já tem outro relatório na mesma semana. Exclua-o antes de restaurar este. |
| restaurar o que não está excluído | Este cadastro não está excluído. (ou "Esta célula não está excluída." / "Este relatório não está excluído.") |
| cadastro com dado de excluído (administrador) | Título: Há um cadastro excluído com estes dados (ou "Há <N> cadastros excluídos com estes dados") · Por cadastro: Já existe um cadastro excluído com este <e-mail \| celular \| CPF>: <nome>, excluído em <data>. · Restaurar <nome> · Explicação: Ao restaurar, o cadastro volta como estava e abre para você conferir. O que você digitou aqui não é gravado. · No caso do e-mail da conta: Para cadastrar outra pessoa, volte e use outro e-mail. · Botões: Cadastrar mesmo assim (exceto no caso do e-mail da conta) · Voltar ao formulário |
| cadastro com dado de excluído (outros) | Título: Há um cadastro excluído com este <celular \| CPF> (ou "com este celular e este CPF"; "Há cadastros excluídos com este celular e este CPF" quando são cadastros diferentes) · Texto: Se for a mesma pessoa, peça a um administrador para restaurá-lo. Se for outra pessoa, você pode cadastrar mesmo assim. · Botões: Cadastrar mesmo assim · Voltar ao formulário |
| e-mail da conta de um excluído (outros) | Este e-mail pertence a um cadastro excluído. Peça a um administrador para restaurá-lo ou use outro e-mail. (erro embaixo do campo E-mail) |
| depois de restaurar pelo cadastro | Cadastro de <nome> restaurado. Confira os dados e, se precisar, altere e salve. |
| cadastro excluído durante a edição | Este cadastro não existe ou já foi excluído. As alterações não foram salvas. |
| login (qualquer falha de identificação ou senha, inclusive cadastro excluído) | Usuário ou senha inválidos. Confira os dados e tente de novo. |
| login (falha de conexão) | Não foi possível entrar. Verifique a conexão e tente de novo. |
| sessão encerrada | Sua sessão terminou. Entre de novo para continuar. |

### Fora de escopo
Cada item indica o passo que cuida dele.
- **Escopo de escrita** (excluir e restaurar só dentro do próprio ministério, AUT-03): E2.02. Neste passo, o alcance é o de hoje (RN-02).
- **Exclusão de funções** continua física (seção 3.8). Impedir a exclusão de uma função ainda em uso e ajustar as funções semeadas: E2.02 (6.5).
- **Troca de senha:** a `change-member-password` recusar alvo excluído (RN-07) entra com o E2.03, quando a função for publicada.
- **Unicidade de e-mail, celular e CPF** (índices MEM-03 e MEM-05): E2.04, contando só os não excluídos (DEL-04).
- **Autoria nas colunas** (`created_by`, `updated_by`, MEM-12): E2.05.
- **Propagação do nível e caminho de liderança** (HIE-02, HIE-03): E2.06.
- **Filtros das listagens** (MEM-13, CEL-06, REL-13): E2.07, E2.10 e E2.12. A lista "Excluídos" é deste passo.
- **Situação do relatório por célula** (CEL-05): E2.09, já ignorando excluídos (RN-08).
- **Relatório numa RPC atômica, índice único da semana e snapshot** (REL-03, REL-09, REL-10): E2.11, seguindo a RN-12 e a RN-13.
- **Exportação para Excel** (REL-14): E2.13 (ver Impactos).
- **Cards novos e drill-down do Dashboard** (DSH-02, DSH-05): E2.14, já sem excluídos.
- **Login pela função `sign-in`** e senha legada: E1.04, E3.01 e E3.02, seguindo a RN-14.
- **Migração:**
  - excluídos do legado com `deleted_at` e `deleted_by` nulo: E4.02 e E4.06;
  - saneamento das ligações com excluídos: E4.04;
  - criação da conta de acesso ao restaurar um excluído migrado, que não recebe conta na carga (6.2): E4.08.
- **LGPD:** a anonimização a pedido do titular e a eliminação definitiva são um processo à parte, sem passo no plano.
- Exclusão e restauração em lote.
- **Reatribuir em lote** (trocar o líder de vários discípulos de uma vez, PO-UX-8): sugestão para depois, sem passo no plano. Neste passo, cada discípulo é reatribuído no próprio cadastro.
- **Consulta ("Ver relatório") em todas as linhas de Relatórios** e participantes visíveis para quem não edita relatórios (alternativa maior da PO-UX-3): fica para o E2.12 avaliar, junto com a listagem de relatórios. Neste passo, a consulta existe só para o relatório de célula excluída (RN-11).
- **Conferir a RN-18 ao sair do campo** (PO-UX-7): fora. A conferência é ao salvar, sem consulta extra que facilitaria descobrir dados de cadastros excluídos.
- Aviso ao membro de que o cadastro dele foi excluído.
- **Consolidação e Escolas:** seguem a D1 nos próprios specs. Escolas já prevê a ESC-31 a ESC-33.

### Impactos em outros passos
Pontos de negócio que outros passos precisam respeitar. O `architect` decide como.
- **E1.08 (PRs 2 a 5, em andamento):**
  - as views têm os pontos marcados com `E2.01`;
  - enquanto o Dashboard, Ministérios, o `AsyncMemberSelect` e o `CellReportForm` lerem as tabelas diretamente, elas também precisam esconder os excluídos, senão a RN-08 falha nessas telas.
- **E2.04:** a RN-18 e a RN-16 (e) usam a mesma comparação de e-mail, celular e CPF que os índices únicos vão usar. As duas precisam normalizar igual.
- **E2.11:** a RPC de relatório:
  - recusa célula excluída e participante excluído novo (RN-06);
  - preserva participações de excluídos ao editar e recusa a retirada delas (RN-13);
  - usa o índice único só entre não excluídos (RN-12, RN-17).

  Hoje o `CellReportForm` apaga e regrava todos os participantes ao editar. Com a RN-06, a regravação de um participante excluído seria recusada, e sem ela a participação se perderia, o que a RN-13 proíbe. Isso precisa de solução já neste passo, porque a RN-13 é deste passo.
- **E2.12:** avaliar a consulta "Ver relatório" em todas as linhas de Relatórios (alternativa maior da PO-UX-3). O `Sheet` deste passo foi desenhado para ser reaproveitado.
- **E2.13:** decidir como entra no Excel uma célula excluída que tem relatório no período. Recomendação do PO: entra com a indicação "Célula excluída", só nos períodos em que tem relatório.
- **E2.14:** no gráfico "realizadas × canceladas × sem relatório", o relatório de uma célula excluída conta como realizado ou cancelado (RN-11), mas a célula não entra no universo das "sem relatório".
- **E4.04:** a seção 5.4 só lista o "membro ativo com líder excluído". Pela RN-06, o saneamento precisa listar também:
  - os membros **inativos** com líder excluído;
  - as células não excluídas com líder, timóteo ou anfitrião excluído.

  O legado permitia excluir com ligações.
- **Escolas:** a DT-31 assume que `deleted_by` aponta para `members(id)` (quem excluiu). Se o E2.01 adotar outra convenção, Escolas segue a do E2.01.
- **Aceite (PO):** ajustar no `docs/migracao.md` o texto da DEL-08 ("ativos" passa a "não excluídos", P-DEL-01) e o da DEL-09 (termo "Restaurar").

### Perguntas em aberto
Nenhuma. Os pontos que as fontes não respondiam viraram padrões, listados em "Padrões definidos por este spec", para o usuário revisar no PR. Os que mais mudam o resultado são:
- P-DEL-01: inativos também bloqueiam;
- P-DEL-05: só quem tem "Gerenciar Funções" restaura;
- P-DEL-06: a restauração das três entidades entra neste passo.

## Experiência (UX)
_Seção do `ux-designer`. Escrita em 2026-11-23 a partir da seção Negócio (RN-01 a RN-20, P-DEL-01 a P-DEL-16) e das telas atuais do `mci-connect` (branch do E1.08, com Membros, Células e Relatórios já paginados no servidor). Nenhuma regra de negócio foi criada aqui. Onde a tela precisou de algo que o spec não diz, a decisão é a mais conservadora, marcada como "definido pela UX" e listada em "Pendências para o PO"._

### Decisões de experiência
| # | Decisão | Por quê |
|---|---|---|
| UXD-1 | **"Excluídos" numa rota própria por entidade:** `/members/deleted`, `/cells/deleted` e `/cell-reports/deleted`. Abre por um botão no cabeçalho da lista, só para administradores. Não é aba nem filtro da lista principal. | (1) Não é um recorte da mesma lista. Mudam as colunas (Excluído em, Excluído por), a ordem (exclusão mais recente, RN-15), a única ação (Restaurar) e a permissão (`manage_roles`).<br>(2) Como filtro, "Excluídos" ficaria ao lado da Situação (Ativo/Inativo) e reforçaria a confusão que a RN-08 afasta ("excluído não é inativo"). Os filtros que chegam no E2.07, no E2.10 e no E2.12 também não valem para os excluídos.<br>(3) Cada rota usa o `useListSearchParams` como ele é (`page`, `size`, `q`). Não precisa de regra para zerar a busca e a página ao alternar, e o "voltar" do navegador funciona.<br>(4) A rota é protegida por permissão, e o link pode ser compartilhado entre administradores.<br>(5) Quem não é administrador, inclusive o líder no celular, não vê nada novo. |
| UXD-2 | **O bloqueio aparece antes da confirmação.** Ao tocar em "Excluir cadastro", a tela consulta o que impede a exclusão (AQ-1). Com ligações, abre direto o diálogo de bloqueio; sem ligações, abre a confirmação. O servidor continua sendo a última palavra: se ele recusar, o mesmo diálogo de bloqueio mostra a resposta dele. | Confirmar uma exclusão e só depois descobrir que ela é impossível faz a pessoa ler duas vezes e desconfiar do sistema. É o mesmo padrão da UXD-7 de Escolas. |
| UXD-3 | **Confirmação em tópicos curtos.** O texto do Negócio é dividido em frases, sem mudar o sentido. O aviso que sugere inativar traz o atalho "Marcar como inativo" (ou "inativa", na célula). | Em 360 px, o texto corrido ocupa de 9 a 10 linhas; em tópicos, ele é lido de relance. O atalho transforma a sugestão da P-DEL-16 em 1 toque. Sem ele, seriam 5: cancelar, abrir o cadastro, achar "Ativo", desligar e salvar. |
| UXD-4 | **No celular, "Excluir" vai para o menu "⋯" do card.** "Editar" e "Novo relatório" continuam visíveis, e todos os botões do card passam a ter 44×44 px. No desktop, a coluna Ações continua com botões de ícone. | Hoje a lixeira fica colada no lápis e, em Células, no "Novo relatório", que é a ação mais frequente do líder. Os botões têm de 32 a 36 px, e um toque errado abriria a exclusão no lugar da ação comum. |
| UXD-5 | **O aviso de exclusão não tem "Desfazer".** | Restaurar não refaz o cônjuge (RN-05), e só o administrador restaura (RN-15). Um "Desfazer" prometeria uma volta completa que não existe e apareceria para quem não pode usá-lo. |
| UXD-6 | **Restaurar um membro pede confirmação. Célula e relatório restauram com um toque.** | O membro restaurado volta a entrar no sistema, com a função que tinha, que pode ser Administrador. Célula e relatório só voltam às listas e às somas, e um engano se desfaz excluindo de novo. |
| UXD-7 | **"Ver relatório": um painel de consulta (`Sheet`) só nas linhas de relatório de célula excluída, no lugar do "Editar" e para quem tem `edit_cell_report`.** O painel explica por que não há edição. *Escopo reduzido pelo PO na PO-UX-3 (2026-11-23); a proposta original era o painel em toda linha de Relatórios, que fica para o E2.12 avaliar.* | A RN-11 deixa esse relatório "só para consulta", e a RN-09 (b) e a RN-13 pedem os participantes pelo nome. Hoje os participantes só aparecem no formulário de edição, que esse relatório não abre. Ver PO-UX-3. |
| UXD-8 | **O participante excluído fica fora do seletor, numa linha só de leitura, e não pode ser retirado na edição.** | Ele não pode voltar como participante novo (RN-06), então retirá-lo apagaria o histórico sem volta. Ver PO-UX-2. |
| UXD-9 | **A RN-18 é conferida ao salvar**, como diz a regra. Para quem não é administrador, o caso do e-mail da conta vira um erro embaixo do campo E-mail, e não um diálogo. | Nesse caso, a única saída é trocar o e-mail, e o erro no campo leva o foco até lá. A conferência ao sair do campo fica como proposta (PO-UX-7). |
| UXD-10 | **O login tem uma mensagem só, no próprio formulário (`Alert`), para qualquer falha de identificação ou senha**, inclusive a de cadastro excluído. A sessão que perde o acesso volta ao login com "Sua sessão terminou. Entre de novo para continuar.", que não revela a exclusão. | RN-14. Hoje o login mostra mensagens diferentes (por exemplo, "CPF ou celular não encontrado…") num toast, que some sem dar tempo de reler. |

### Navegação e rotas
- **Rotas novas**, todas exigindo login: `/members/deleted`, `/cells/deleted` e `/cell-reports/deleted`.
  - Os parâmetros são `q`, `page` e `size`, lidos pelo `useListSearchParams`, sem nada novo.
  - Valores padrão não aparecem na URL.
- **Entrada:** o botão "Excluídos" (em Membros e Relatórios) ou "Excluídas" (em Células), no cabeçalho da lista, só para quem tem `manage_roles`. Ele não entra no menu lateral.
- **Voltar:** o link "← Membros" (ou "← Células", "← Relatórios") no topo da lista de excluídos volta para a lista principal com a busca e a página de antes. Por link direto, vai para a rota da lista, sem parâmetros.
- **Item ativo do menu:** é a primeira sub-rota do sistema. Por isso, este passo implementa a regra já desenhada no spec de Escolas (Navegação e rotas):
  - `/` fica ativo só em `/`;
  - os demais itens ficam ativos quando `pathname === path` ou `pathname.startsWith(path + "/")`. Assim, `/cell-reports/deleted` acende "Relatórios", e não "Células";
  - o item ativo recebe `aria-current="page"`.
- **Consulta do relatório:** `/cell-reports?report=<id>` abre o `Sheet` "Relatório" (UXD-7). Fechar o painel tira o parâmetro, e recarregar a página mantém o painel aberto. Pela PO-UX-3, o parâmetro só abre o painel para relatório de célula excluída e para quem tem `edit_cell_report`; nos demais casos, ele é ignorado e sai da URL.
- **Login:** quando a sessão perde o acesso, o app encerra a sessão e abre `/login` com o motivo no estado da navegação, e não na URL. Assim, o aviso aparece uma vez só.

### Fluxos
Contagem no celular, a partir de qualquer tela com o menu fechado, incluindo o toque no ☰. "Toque" não conta a digitação.

| # | História | Caminho | Toques e telas |
|---|---|---|---|
| F1 | Excluir um membro sem ligações | ☰ → Membros → busca → "⋯" no card → "Excluir cadastro" → (verifica) → "Excluir cadastro" | 5 toques; 1 tela, 1 menu e 1 diálogo |
| F2 | Excluir um membro com ligações (RN-04) | ☰ → Membros → busca → "⋯" → "Excluir cadastro" → diálogo de bloqueio → toca no discípulo → formulário dele → Líder → escolhe → "Salvar" → (repete para cada ligação) → "⋯" → "Excluir cadastro" → "Excluir cadastro" | 4 toques até o bloqueio; +4 por ligação reatribuída; +3 para excluir no fim |
| F3 | Desistir de excluir e inativar | "⋯" → "Excluir cadastro" → "Marcar como inativo" | 3 toques a partir da lista |
| F4 | Excluir uma célula (desktop) | Células → ícone "Excluir" na linha → "Excluir célula" | 3 cliques |
| F5 | Excluir um relatório lançado errado (RN-12) | ☰ → Relatórios → busca → "⋯" (no desktop, o ícone) → "Excluir relatório" → "Excluir relatório". O líder lança o novo pelo caminho de sempre. | 5 toques |
| F6 | O administrador restaura um membro | ☰ → Membros → "Excluídos" → busca → "Restaurar" → "Restaurar cadastro" | 5 toques; 2 telas e 1 diálogo |
| F7 | Membro restaurado sem líder (RN-16 d) | F6 → diálogo "Cadastro restaurado" → "Definir líder" → Líder → escolhe → "Salvar" | +4 toques |
| F8 | O administrador restaura uma célula ou um relatório | ☰ → Células (ou Relatórios) → "Excluídas" (ou "Excluídos") → busca → "Restaurar" | 4 toques |
| F9 | O administrador cadastra uma pessoa que já foi excluída (RN-18) | ☰ → Membros → "Novo membro" → preenche → "Criar membro" → diálogo → "Restaurar {Nome}" → formulário do cadastro restaurado → "Salvar" | 5 toques e a digitação até restaurar; +1 para salvar |
| F10 | Quem não é administrador cadastra com o celular de um excluído | … → "Criar membro" → diálogo → "Cadastrar mesmo assim" | +1 toque |
| F11 | Consultar um relatório de célula excluída (com `edit_cell_report`) | ☰ → Relatórios → card → `Sheet` | 3 toques |
| F12 | Editar um relatório com participante excluído | Relatórios → "Editar" → altera → "Salvar". O excluído continua no relatório, sem nenhuma ação. | igual ao de hoje |
| F13 | Membro excluído com a sessão aberta | Próxima leitura ou gravação → login, com o aviso | 0 toques |

### Telas
As convenções dos wireframes são as do spec de Escolas: 360 px ≈ 38 colunas; `[Botão]` é botão; `[▾]` é seleção; `⋯` é o menu de ações; `(i)` é aviso; `⚠` é erro. A margem lateral é a do `AppLayout` (`p-4`).

#### T1. Ação "Excluir" nas listas (Membros, Células e Relatórios)
Celular (abaixo de 768 px, cards):
```
Membros
┌──────────────────────────────────────┐
│ (foto) Bruno Almeida      [✎]  [⋯]   │  44×44 cada, 8 px entre si
│        bruno@exemplo.com             │
│ [144] [Ativo]       3 disc. · 1 cél. │
│ Líder: Gil Souza                     │
└──────────────────────────────────────┘
  ⋯ : Excluir cadastro

Células
│ Carlos Lima           [📄+] [✎] [⋯]  │  "Novo relatório" continua fora do ⋯
│ G12: Vera e Wagner                   │
  ⋯ : Excluir célula

Relatórios
│ Carlos Lima                 [✎] [⋯]  │
│ Rua das Flores, 120 · Centro         │
  ⋯ : Excluir relatório
```
- O "⋯" é um `DropdownMenu`. O gatilho é um `Button variant="ghost" size="icon"` com `h-11 w-11` e `aria-label`:
  - "Ações de {Nome}" em Membros;
  - "Ações da célula de {Líder}" em Células;
  - "Ações do relatório de {data}" em Relatórios.
- No menu, o item tem o ícone `Trash2` e o texto "Excluir cadastro", "Excluir célula" ou "Excluir relatório", em `text-foreground`. O vermelho fica só no botão de confirmar (T2).
- O "⋯" só aparece para quem tem a permissão de excluir daquela entidade. Sem ela, o card fica como hoje.
- Os demais botões de ícone do card ("Editar", "Novo relatório") passam a ter `h-11 w-11` no celular.
- **Linha do próprio usuário (Membros):** não tem "Excluir" (RN-03). Se o "⋯" ficar vazio, ele não aparece.
- **Desktop (a partir de 768 px, tabela):** o botão de ícone continua na coluna Ações.
  - Ele tem `aria-label` com o nome do item: "Excluir {Nome}", "Excluir a célula de {Líder}" ou "Excluir o relatório de {data}".
  - O ícone usa `text-muted-foreground`, e não `text-destructive`: no tema escuro, o vermelho do token fica com contraste de cerca de 1,8:1 sobre o card, abaixo dos 3:1 exigidos para ícones.
- Componentes: `DropdownMenu`, `Button`.

#### T2. Confirmação de exclusão (`AlertDialog`)
Celular, membro:
```
┌──────────────────────────────────────┐
│ Excluir Bruno Almeida?               │  título, alinhado à esquerda
│                                      │
│ • O cadastro sai das listas, dos     │
│   totais e do dashboard.             │
│ • A pessoa perde o acesso ao sistema.│
│ • Os relatórios em que ela aparece   │
│   continuam no histórico.            │
│ • Um administrador pode restaurar o  │
│   cadastro depois.                   │
│ ┌──────────────────────────────────┐ │
│ │ (i) Se a pessoa só deixou de     │ │  Alert; só se o cadastro está ativo
│ │ frequentar, prefira marcá-la     │ │
│ │ como inativa.                    │ │
│ │ [Marcar como inativo]            │ │  só com edit_member
│ └──────────────────────────────────┘ │
│ [Excluir cadastro                  ] │  destructive, h-11
│ [Cancelar                          ] │  outline, h-11, foco inicial
└──────────────────────────────────────┘
```
Enquanto verifica as ligações (UXD-2), só no membro:
```
│ Excluir Bruno Almeida?               │
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒         │  Skeleton de 3 linhas
│ Verificando se o cadastro pode ser   │
│ excluído…                            │
│ [Verificando…        (desabilitado)] │
│ [Cancelar                          ] │
```
Célula e relatório (sem verificação prévia):
```
│ Excluir a célula de Carlos Lima?     │
│ Quarta, 20:00 · Rua das Flores, 120  │  identifica a célula (RN-04)
│ • A célula sai das listas e dos      │
│   totais.                            │
│ • Os relatórios dela continuam no    │
│   histórico.                         │
│ • Um administrador pode restaurá-la  │
│   depois.                            │
│ (i) Se a célula só parou de se       │
│ reunir, prefira marcá-la como        │
│ inativa. [Marcar como inativa]       │
│ [Excluir célula] [Cancelar]          │
├──────────────────────────────────────┤
│ Excluir o relatório de 19/11/2026 da │
│ célula de Carlos Lima?               │
│ • Ele sai das listas e das somas.    │
│ • A célula poderá enviar outro       │
│   relatório para a semana dele, se   │
│   ainda for a semana atual.          │
│ • Um administrador pode restaurá-lo  │
│   depois.                            │
│ [Excluir relatório] [Cancelar]       │  sem aviso de inativar
└──────────────────────────────────────┘
```
- **Estrutura** (as classes vão no `className`, sem editar os arquivos de `ui/`):
  - `AlertDialogContent` com `w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto rounded-lg`. Hoje o conteúdo encosta nas bordas no celular e não rola, e o texto longo esconderia os botões com a fonte grande.
  - `AlertDialogHeader` com `text-left`. O padrão é centralizado no celular, o que piora a leitura de tópicos.
  - `AlertDialogDescription asChild` com uma `<div>` que contém a `<ul>`. Uma lista não pode ficar dentro de `<p>`.
- **Botões:**
  - o de confirmar usa `buttonVariants({ variant: "destructive" })`, com verbo e objeto ("Excluir cadastro", "Excluir célula" ou "Excluir relatório");
  - no celular, os dois botões têm `h-11` e ficam empilhados, com "Cancelar" embaixo, na zona do polegar, e com o foco inicial. O Radix já põe o foco em "Cancelar";
  - no desktop, ficam lado a lado, à direita.
- **Envio:**
  - o diálogo não fecha ao tocar em "Excluir…": o botão vira "Excluindo…", e os dois ficam desabilitados;
  - no sucesso, o diálogo fecha, aparece o toast e a lista recarrega;
  - se o servidor recusar pela regra, o conteúdo troca para o bloqueio (T3);
  - "Não existe ou já foi excluído" fecha o diálogo, mostra a mensagem num toast informativo (não destrutivo) e recarrega a lista;
  - na queda de conexão, o diálogo continua aberto, com o `Alert` "Não foi possível excluir. Verifique a conexão e tente de novo.", e o botão volta a "Excluir…".
- **Aviso de inativar** (definido pela UX, UXD-3):
  - é um `Alert` com o ícone `Info`, acima dos botões, que só aparece se o membro ou a célula está ativo;
  - o botão "Marcar como inativo" (ou "Marcar como inativa") é `outline`, com `h-11 md:h-9`, e só aparece com `edit_member` (ou `edit_cell`). Sem a permissão, fica só o texto;
  - o botão grava só a situação (`is_active = false`), fecha o diálogo e mostra o toast "Cadastro marcado como inativo." (ou "Célula marcada como inativa.");
  - não existe no relatório.
- Componentes: `AlertDialog`, `Alert`, `Button`, `Skeleton`.

#### T3. Bloqueio da exclusão de membro (RN-03 e RN-04)
É o diálogo de bloqueio do padrão P3 de Escolas: um `AlertDialog` sem botão destrutivo. O conteúdo é o da mensagem do Negócio, organizado em listas (PO-UX-1).
```
┌──────────────────────────────────────┐
│ Não é possível excluir Gil Souza     │
│                                      │
│ Antes, reatribua:                    │
│                                      │
│ 4 discípulos                         │  h3
│ ┌──────────────────────────────────┐ │
│ │ Hugo Lima                      › │ │  cada item: botão de 44 px de altura
│ │ Ivo Reis                       › │ │  que abre o cadastro (edit_member)
│ │ João Alves                     › │ │
│ │ Léo Martins (inativo)          › │ │
│ └──────────────────────────────────┘ │
│ 2 células                            │
│ ┌──────────────────────────────────┐ │
│ │ Timóteo na célula de Carlos    › │ │  abre a célula (edit_cell)
│ │ Lima, quarta, 20:00              │ │
│ │ Anfitrião na célula de Marcos  › │ │
│ │ Dias, sexta, 19:30 (inativa)     │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Discípulos e células inativos também │  text-sm text-muted-foreground
│ contam. Para reatribuir um           │
│ discípulo, abra o cadastro dele e    │
│ escolha outro líder. Para uma        │
│ célula, troque a pessoa na célula ou │
│ exclua a célula.                     │
│ [Fechar                            ] │
└──────────────────────────────────────┘
```
- Cada grupo mostra até 5 itens e, depois, a linha de texto "e mais {N}". Um grupo vazio não aparece.
- **Itens como botões:**
  - com `edit_member`, cada discípulo é um botão (`aria-label="Abrir o cadastro de {Nome}"`) que fecha o bloqueio e abre o `MemberForm` dele;
  - com `edit_cell`, cada célula é um botão que fecha o bloqueio e abre o `CellForm` dela;
  - sem a permissão, o item é texto (`<li>`).
- **Depois de reatribuir,** a tela volta para a lista. Tocar em "Excluir cadastro" de novo refaz a verificação e mostra só o que ainda falta.
- **Recusas da RN-03:** o mesmo diálogo, com o título "Não é possível excluir {Nome}" e a mensagem do Negócio ("Você não pode excluir o seu próprio cadastro." ou "Você não tem permissão para excluir este membro."), e só "Fechar".
- **Sem os dados estruturados** (AQ-1 e AQ-2): o diálogo mostra a mensagem do servidor como veio, em texto, com "Fechar".
- **Desktop:** o mesmo conteúdo, num `AlertDialog` com `max-w-lg`.
- **Foco:** vai para o título do diálogo (`tabIndex={-1}`) quando o conteúdo troca da verificação para o bloqueio, para o leitor de tela ler o motivo.

#### T4. Listas de excluídos (`/members/deleted`, `/cells/deleted`, `/cell-reports/deleted`)
Cabeçalho da lista principal, só para administradores:
```
Celular                                  Desktop (≥ 1024 px)
┌──────────────────────────────────────┐ ┌────────────────────────────────────────────────────┐
│ ☰                                    │ │ Membros                [Excluídos] [+ Novo membro] │
│ Membros               [⊠ Excluídos]  │ │ Gerenciar membros da igreja                        │
│ Gerenciar membros da igreja          │ └────────────────────────────────────────────────────┘
│ [+ Novo membro                     ] │
└──────────────────────────────────────┘
```
- No celular, "Excluídos" é um `Button variant="ghost"` com `h-11`, o ícone `ArchiveX` e o texto, na linha do título, para não empurrar a lista para baixo. O título pode quebrar linha (`flex items-start justify-between gap-2`; o botão com `shrink-0`). Em Relatórios, "Relatórios de Células" quebra em duas linhas em 360 px.
- No desktop, é um `Button variant="outline"`, à esquerda da ação primária.
- O `aria-label` é "Ver membros excluídos" (ou "Ver células excluídas", "Ver relatórios excluídos").

Lista, no celular (Membros):
```
┌──────────────────────────────────────┐
│ ☰                                    │
│ ← Membros                            │  link, 44 px de altura
│ Membros excluídos                    │  h1
│ Restaure o que foi excluído por      │
│ engano. Os excluídos mais recentes   │
│ aparecem primeiro.                   │
│ [🔍 Buscar por nome, e-mail ou CPF ] │
│──────────────────────────────────────│
│ Bruno Almeida                        │  identificação primeiro
│ Excluído em 10/11/2026 às 14:32      │
│ por Elisa Martins                    │
│ Líder: Gil Souza (cadastro excluído) │  marcação quando o líder foi excluído
│ [Ativo]               [↺ Restaurar]  │  outline, h-11
│──────────────────────────────────────│
│ Paula Reis                           │
│ Excluído em 02/11/2026 às 09:10      │
│ Autor não registrado                 │  deleted_by vazio (carga do legado)
│ Sem líder                            │
│ [Inativo]             [↺ Restaurar]  │
│──────────────────────────────────────│
│ 2 cadastros excluídos                │
│ [25▾] por página  [«][‹] 1 de 1 [›][»]│
└──────────────────────────────────────┘
```
Desktop (Membros):
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ← Membros                                                                            │
│ Membros excluídos                                                                    │
│ [🔍 Buscar por nome, e-mail ou CPF   ]                                                │
│ Nome           │ Líder                          │ Situação │ Excluído em      │ Excluído por   │            │
│ Bruno Almeida  │ Gil Souza (cadastro excluído)  │ Ativo    │ 10/11/2026 14:32 │ Elisa Martins  │ [Restaurar]│
│ Paula Reis     │ —                              │ Inativo  │ 02/11/2026 09:10 │ Não registrado │ [Restaurar]│
│ 2 cadastros excluídos                        [25▾] por página  [«][‹] Página 1 de 1 [›][»]│
└──────────────────────────────────────────────────────────────────────────────────────┘
```
Células e Relatórios seguem o mesmo esqueleto:
```
Células (card)                           Relatórios (card)
│ Célula de Carlos Lima                │ │ Célula de Carlos Lima                │
│ Quarta · 20:00 · Evangelística       │ │ [⊘ Célula excluída]                  │  quando a célula também foi excluída
│ Excluída em 12/11/2026 às 10:05      │ │ Relatório de 19/11/2026 · 20:00      │
│ por Elisa Martins                    │ │ [✓ Realizada] · Tema: Fé que move    │
│ Anfitrião: Quintino Reis (cadastro   │ │ Excluído em 20/11/2026 às 08:00      │
│ excluído)                            │ │ por Gil Souza                        │
│                       [↺ Restaurar]  │ │ ⚠ Já há outro relatório desta célula │  quando a semana já tem outro
│                                      │ │ na mesma semana.                     │
│                                      │ │                       [↺ Restaurar]  │
```
- **Colunas no desktop:**
  - Células: Líder · Dia / Hora · Tipo · Bairro · Excluída em · Excluída por · (Restaurar);
  - Relatórios: Célula (Líder) · Data / Hora · Situação · Tema · Excluído em · Excluído por · (Restaurar).
- **Lista:**
  - ordem da exclusão mais recente para a mais antiga (RN-15), com paginação no servidor pelo `ListPagination` (25 por página; 10, 25, 50 ou 100);
  - rótulos do total: "cadastro excluído"/"cadastros excluídos", "célula excluída"/"células excluídas" e "relatório excluído"/"relatórios excluídos";
  - a busca usa os mesmos campos e o mesmo placeholder da lista principal (definido pela UX).
- **Data e autor:**
  - "Excluído em dd/MM/aaaa às HH:mm" ("Excluída em", na célula), sempre no horário de Brasília (`timeZone: "America/Sao_Paulo"`);
  - "por {Nome}", ou "Autor não registrado" quando a exclusão não tem autor (excluídos que vieram do legado, E4.02).
- **Dados de apoio:** no máximo 3 por card.
  - Membro: líder e situação.
  - Célula: dia, horário e tipo, e o timóteo ou o anfitrião só quando ele foi excluído.
  - Relatório: data, situação e tema.
  - A situação usa os badges com contraste do padrão P6 de Escolas (texto em `text-foreground` sobre fundo tingido).
- **Avisos antecipados** (AQ-3): quando a lista já sabe que a restauração vai ser recusada ou vai mudar algo, o card mostra isso em texto. São a marcação "(cadastro excluído)" ao lado do líder, do timóteo ou do anfitrião, e a linha "Já há outro relatório desta célula na mesma semana.".
- **"Restaurar":**
  - `Button variant="outline"` com o ícone `ArchiveRestore` e o texto visível;
  - `h-11` no celular e `h-9` no desktop;
  - `aria-label="Restaurar {Nome}"`, "Restaurar a célula de {Líder}" ou "Restaurar o relatório de {data}".
- **Sem `manage_roles`:** a rota mostra "Você não tem acesso a esta lista." e o botão "Voltar para Membros" (ou Células, Relatórios), sem nenhum registro.
- Componentes: `Card`, `Input`, `Table`, `Badge`, `Button`, `ListPagination`, `Skeleton`, `Alert`.

#### T5. Restaurar um membro
Confirmação (UXD-6):
```
┌──────────────────────────────────────┐
│ Restaurar o cadastro de Bruno        │
│ Almeida?                             │
│                                      │
│ • O cadastro volta às listas e aos   │
│   totais, com os mesmos dados e a    │
│   função Líder.                      │
│ • A pessoa volta a entrar no sistema │  só se ela tem conta de acesso (AQ-7)
│   com a mesma senha.                 │
│ • O vínculo de cônjuge não volta. Se │
│   havia, refaça-o no cadastro.       │
│ • Volta sem líder, porque o líder    │  só quando a lista sabe (AQ-3)
│   anterior (Gil Souza) foi excluído. │
│ [Restaurar cadastro                ] │  default, h-11
│ [Cancelar                          ] │  foco inicial
└──────────────────────────────────────┘
```
Depois de restaurar, quando há algo a fazer (RN-16 a e d):
```
┌──────────────────────────────────────┐
│ Cadastro restaurado                  │
│                                      │
│ Cadastro restaurado sem líder,       │
│ porque o líder anterior (Gil Souza)  │
│ foi excluído. Defina o novo líder.   │
│                                      │
│ O cadastro voltou com a função       │  só se a função foi apagada
│ padrão (Membro), porque a função     │
│ anterior foi apagada.                │
│ [Definir líder                     ] │  só sem líder e com edit_member
│ [Agora não                         ] │
└──────────────────────────────────────┘
```
- "Definir líder" abre o `MemberForm` do cadastro restaurado, com "Tem Liderança?" ligado, o campo Líder visível e o foco nele.
- Sem nada a avisar, a restauração termina com o toast "Cadastro restaurado." e o item sai da lista.
- As recusas seguem a tabela da T6.

#### T6. Restaurar uma célula ou um relatório
Um toque em "Restaurar": o botão daquele item vira "Restaurando…" e fica desabilitado. Os outros itens continuam livres. No sucesso, o item sai da lista e aparece o toast "Célula restaurada." ou "Relatório restaurado.".

Recusas na restauração, nas três entidades: diálogo de bloqueio (P3), com o título "Não é possível restaurar {item}" e a mensagem do Negócio.

| Caso | Mensagem (Negócio) | Ação que resolve |
|---|---|---|
| dado em uso (RN-16 e) | Não é possível restaurar: outro cadastro já usa este {e-mail \| celular \| CPF}. | Fechar |
| função acima de quem restaura (RN-16 b) | Você não tem permissão para restaurar este membro. | Fechar |
| célula com pessoa excluída (RN-17) | Não é possível restaurar a célula: o {líder \| timóteo \| anfitrião} {Nome} foi excluído. Restaure o cadastro dele antes ou crie uma célula nova. | "Ver membros excluídos" (abre `/members/deleted?q={Nome}`) |
| relatório com outro na semana (RN-17) | Esta célula já tem outro relatório na mesma semana. Exclua-o antes de restaurar este. (PO-UX-6) | "Ver relatórios da célula" (abre `/cell-reports?q={Líder}`; o mais recente aparece primeiro) |
| não está excluído (corrida) | Este cadastro não está excluído. (ou célula, relatório) | Sem diálogo: toast informativo, e a lista recarrega |

Quando o card já mostra o motivo (T4, avisos antecipados), o diálogo abre sem chamar o servidor. O foco vai para o botão da ação que resolve ou, se não houver, para "Fechar".

#### T7. Relatórios: célula excluída e consulta (`Sheet`)
Linha de relatório de célula excluída, na lista principal:
```
Celular                                  Desktop: coluna "Célula (Líder)"
│ ┌─ botão: Ver relatório ──────┐ [⋯]  │ │ Carlos Lima                          │
│ │ Carlos Lima                 │      │ │ [⊘ Célula excluída]                  │
│ │ [⊘ Célula excluída]         │      │ │ Rua das Flores, 120                  │
│ │ Rua das Flores, 120 · Centro│      │ Ações: [👁] [🗑]  (sem ✎)            │
│ │ 19/11/2026 · 20:00          │      │
│ │ [✓ Realizada]  14 presenças │      │
│ └─────────────────────────────┘      │
```
- **Badge "Célula excluída":** ícone `Ban`, texto em `text-foreground`, `bg-muted` com borda (padrão P6). Aparece também na lista de excluídos (T4).
- **"Ver relatório" só nas linhas de célula excluída (UXD-7, escopo reduzido pela PO-UX-3):**
  - aparece no lugar do "Editar", só para quem tem `edit_cell_report`. Para os demais, a linha mostra o badge e as ações que já tinha, sem "Ver relatório";
  - no celular, o corpo do card é um `button` que abre o `Sheet`. "⋯" fica fora dele, como irmão, para não aninhar controles;
  - no desktop, o botão de ícone `Eye` (`aria-label="Ver o relatório de {data}"`) entra na coluna Ações;
  - as linhas de relatório de célula não excluída ficam como hoje.
- **Rodapé do `Sheet`:** como o painel só abre para relatório de célula excluída, o botão "Editar relatório" do rodapé não entra neste passo. O rodapé fixo e o `viewport-fit=cover` ficam para quando o painel servir a todas as linhas (E2.12).
- **Relatório de célula excluída:**
  - não tem "Editar" (RN-11);
  - "Excluir relatório" continua, para quem tem a permissão.

`Sheet` "Relatório" (`side="right"`, `w-full sm:max-w-lg`, como em `Events.tsx`):
```
┌──────────────────────────────────────┐
│ ✕  Relatório de 19/11/2026           │
│ Célula de Carlos Lima                │
│ [⊘ Célula excluída]                  │
│ ┌──────────────────────────────────┐ │
│ │(i) A célula deste relatório foi  │ │  Alert; só com célula excluída
│ │excluída. Restaure a célula para  │ │
│ │editar o relatório.               │ │
│ │[Ver células excluídas]           │ │  só administrador
│ └──────────────────────────────────┘ │
│ Data e hora                          │
│ Quarta, 19/11/2026 às 20:00          │
│ Situação                             │
│ [✓ Realizada]                        │
│ Tema                                 │
│ Fé que move montanhas                │
│ Participantes (14)                   │
│ Ana Souza                            │
│ Bruno Lima                           │
│ Sara Reis                            │  excluída: aparece só pelo nome (RN-13)
│ …                                    │
│ Visitantes (2)                       │
│ João, Maria                          │
│ Oferta                               │
│ R$ 50,00                             │
│ Observações                          │
│ Não informado                        │
│──────────────────────────────────────│
│ [Editar relatório                  ] │  fora deste passo (PO-UX-3): o painel só abre para célula excluída
└──────────────────────────────────────┘
```
- **Relatório "Não houve célula":** mostra Situação "Não realizada" e o Motivo, sem Tema, Participantes, Visitantes e Oferta.
- **Formatos:** data `dd/MM/yyyy`, hora em 24 h e oferta em BRL (`R$ 50,00`). Os participantes aparecem todos, em ordem alfabética, pela `cell_report_participants_view`, sem corte.
- **Links:** "Ver células excluídas" abre `/cells/deleted?q={Líder}`. ("Editar relatório", que fecharia o `Sheet` e abriria o formulário, fica para o E2.12, junto com o painel em todas as linhas.)
- **Rodapé fixo** (para quando o painel tiver "Editar relatório", fora deste passo pela PO-UX-3): o `Sheet` tem rodapé fixo (`sticky bottom-0`) com `pb-[calc(1rem+env(safe-area-inset-bottom))]`. Isso pede `viewport-fit=cover` na meta viewport do `index.html` (tarefa do frontend, também prevista no padrão P1 de Escolas).
- **Edição recusada no meio tempo:** se o formulário de edição for enviado depois que a célula foi excluída, o servidor recusa. O formulário mostra "A célula deste relatório foi excluída. Restaure a célula para editar o relatório." num `Alert` no topo, mantém os dados e não fecha.
- Componentes: `Sheet`, `Badge`, `Alert`, `Button`, `Skeleton`, `Separator`.

#### T8. Formulário de relatório (`CellReportForm`)
```
│ Participantes (Membros)              │
│ [Ana Souza ✕] [Bruno Lima ✕]       ▾ │  seletor: só membros não excluídos
│ Continuam no relatório (cadastros    │  text-sm; só na edição, quando houver
│ excluídos): Sara Reis.               │
```
- **Seletores:** o de célula e o de participantes não oferecem excluídos (RN-06). Não há nada novo para mostrar: eles somem das opções.
- **Edição com participante excluído** (RN-13, UXD-8):
  - os participantes salvos que foram excluídos saem dos chips e aparecem na linha "Continuam no relatório (cadastros excluídos): {nomes}.", sem ✕;
  - eles contam no total de participantes e continuam no relatório depois de salvar;
  - depende do `member_deleted` da AQ-5.
- **Corrida na escolha** (excluído entre a escolha e o envio):
  - a mensagem do Negócio aparece embaixo do campo: "Este membro foi excluído e não pode ser escolhido." (ou "Esta célula foi excluída e não recebe relatórios.", num `Alert` no topo);
  - o chip do membro ganha a marcação "(cadastro excluído)" e continua com ✕, para ser retirado;
  - o resto do formulário fica como estava.
  - Se o servidor não disser qual membro foi (AQ-2), a tela confere os escolhidos na `members_view` e marca os que sumiram.

#### T9. Cadastro com dados de um membro excluído (`MemberForm`, RN-18)
O aviso aparece ao tocar em "Criar membro", sobre o formulário, que continua aberto por baixo.

Administrador:
```
┌──────────────────────────────────────┐
│ Há um cadastro excluído com estes    │  com 2 ou mais: "Há {N} cadastros
│ dados                                │  excluídos com estes dados"
│                                      │
│ Já existe um cadastro excluído com   │
│ este e-mail: Bruno Almeida, excluído │
│ em 10/11/2026.                       │
│ [↺ Restaurar Bruno Almeida         ] │  default com 1 item; outline com 2 ou mais
│ ──────────────────────────────────── │
│ Já existe um cadastro excluído com   │  um bloco por cadastro que combina
│ este CPF: Bruno L. Souza, excluído   │
│ em 02/03/2025.                       │
│ [↺ Restaurar Bruno L. Souza        ] │
│                                      │
│ Ao restaurar, o cadastro volta como  │
│ estava e abre para você conferir. O  │
│ que você digitou aqui não é gravado. │
│ Para cadastrar outra pessoa, volte e │  só no caso do e-mail da conta
│ use outro e-mail.                    │
│──────────────────────────────────────│
│ [Cadastrar mesmo assim             ] │  outline; some no caso do e-mail da conta
│ [Voltar ao formulário              ] │  outline; foco inicial
└──────────────────────────────────────┘
```
Depois de "Restaurar {Nome}":
```
┌──────────────────────────────────────┐
│ ✕  Editar membro                     │  o mesmo diálogo troca de modo
│ ┌──────────────────────────────────┐ │
│ │ ✓ Cadastro de Bruno Almeida      │ │  Alert role="status", recebe o foco
│ │ restaurado. Confira os dados e,  │ │
│ │ se precisar, altere e salve.     │ │
│ └──────────────────────────────────┘ │
│ (+ a mensagem da RN-16 d, se ele     │
│ voltou sem líder, e o foco no Líder) │
│ Nome *                               │
│ [Bruno Almeida                     ] │  dados do cadastro restaurado
│ …                                    │
│ [Cancelar]                 [Salvar]  │
└──────────────────────────────────────┘
```
Quem não é administrador, com celular ou CPF:
```
┌──────────────────────────────────────┐
│ Há um cadastro excluído com este     │  "com este celular e este CPF",
│ celular                              │  quando os dois combinam
│                                      │
│ Se for a mesma pessoa, peça a um     │
│ administrador para restaurá-lo. Se   │
│ for outra pessoa, você pode          │
│ cadastrar mesmo assim.               │
│──────────────────────────────────────│
│ [Cadastrar mesmo assim             ] │
│ [Voltar ao formulário              ] │  foco inicial
└──────────────────────────────────────┘
```
Quem não é administrador, com o e-mail da conta de um excluído: erro no campo, sem diálogo (UXD-9):
```
│ E-mail                               │
│ [bruno@exemplo.com                 ] │  borda de erro; recebe o foco
│ ⚠ Este e-mail pertence a um cadastro │  ligado por aria-describedby
│ excluído. Peça a um administrador    │
│ para restaurá-lo ou use outro e-mail.│
```
- **"Voltar ao formulário"** fecha só o aviso e mantém tudo o que foi digitado (PO-UX-6).
- **"Cadastrar mesmo assim"** cria o cadastro sem nova pergunta e mostra o toast normal de cadastro.
- **"Restaurar {Nome}":**
  - o botão vira "Restaurando…";
  - no sucesso, o formulário passa a editar o cadastro restaurado, e nada do que foi digitado fica nos campos;
  - se a restauração for recusada (RN-16 b ou e), o aviso troca para o diálogo de bloqueio, com a mensagem.
- **Nome do excluído:** para quem não é administrador, ele não aparece na tela e não deve vir do servidor (AQ-6).
- **Vários avisos ao mesmo tempo:** se o e-mail da conta e o celular combinam, quem não é administrador vê só o erro do e-mail. Depois de trocar o e-mail, o próximo "Criar membro" mostra o aviso do celular.
- Componentes: `AlertDialog` (o aviso fica sobre o `Dialog` do formulário; o Radix devolve o foco ao botão "Criar membro"), `Alert`, `Button`.

#### T10. Login e sessão
```
Erro de login                            Sessão encerrada
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Identificação                  [CPF] │ │ ┌──────────────────────────────────┐ │
│ [123.456.789-09                    ] │ │ │(i) Sua sessão terminou. Entre de │ │  Alert role="status",
│ Senha                                │ │ │novo para continuar.              │ │  acima do formulário
│ [                                  ] │ │ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │ │ Identificação                        │
│ │⚠ Usuário ou senha inválidos.     │ │ │ [                                  ] │
│ │Confira os dados e tente de novo. │ │ │ …                                    │
│ └──────────────────────────────────┘ │ └──────────────────────────────────────┘
│ [Entrar                            ] │
└──────────────────────────────────────┘
```
- **Uma mensagem só (RN-14):** identificação inexistente, senha errada, cadastro excluído e conta bloqueada mostram a mesma mensagem, no mesmo lugar.
  - É um `Alert` com `role="alert"`, entre a senha e o botão, e não um toast.
  - A identificação continua preenchida, e a senha é limpa e recebe o foco.
  - Só a queda de rede tem mensagem própria: "Não foi possível entrar. Verifique a conexão e tente de novo.". Ela não revela nada sobre o cadastro.
- **Sessão que perde o acesso:**
  - o app encerra a sessão e abre o login com o aviso, que some na próxima tentativa de entrar;
  - o mesmo aviso vale para qualquer fim forçado de sessão, para não revelar a exclusão;
  - uma queda de rede nunca encerra a sessão (AQ-8).

#### T11. Auditoria e telas sem mudança visual
- **Auditoria (`Events.tsx`):** a restauração aparece com a ação "Restauração", que também entra no filtro de ação (AQ-9). A exclusão já aparece como "Exclusão". A mudança do cônjuge desfeita pela exclusão aparece como "Atualização" do cônjuge (RN-19).
- **Dashboard e Ministérios:** sem mudança visual. Só os números mudam (RN-08). O cônjuge que perdeu o vínculo aparece sozinho no nó da árvore, como qualquer membro sem cônjuge.
- **"Editar meus dados":** sem mudança.

### Padrões novos (valem para as próximas telas)
A numeração continua a dos padrões de Escolas. Este passo é o primeiro a implementar dois deles, então os componentes ficam em `src/components` para Escolas reaproveitar:
- o **P3** (diálogo de bloqueio): T3 e T6;
- o **P6** (badges de estado com contraste): "Célula excluída" e a situação na lista de excluídos.

- **P7. Lista de excluídos.** A rota é `/<entidade>/deleted`, aberta pelo botão "Excluídos" no cabeçalho da lista, só para quem pode restaurar.
  - Mostra "Excluído em" e "Excluído por", da exclusão mais recente para a mais antiga.
  - A única ação é "Restaurar", com o texto visível.
  - Paginação e busca são as da lista principal, e o link "← {Lista}" fica no topo.
  - Vale para Escolas, Turmas e as entidades futuras.
- **P8. Ação destrutiva no celular.** Abaixo de 768 px, "Excluir" fica no menu "⋯" do card, e nunca ao lado da ação frequente. O ícone de lixeira não usa `text-destructive`; o vermelho fica só no botão que confirma.
- **P9. Diálogo de texto longo.** `AlertDialogContent` com `w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto rounded-lg`, cabeçalho `text-left` e descrição `asChild` com `<div>`, sempre que o conteúdo tiver lista ou mais de 3 linhas.

Nenhum componente novo do shadcn é necessário: `alert-dialog`, `dropdown-menu`, `sheet`, `alert`, `badge`, `skeleton`, `table`, `card`, `separator` e `button` já estão em `src/components/ui`.

### Estados
| Estado | Excluir (T1 a T3) | Excluídos e restauração (T4 a T6) | Relatórios: linha, `Sheet` e formulário (T7, T8) | Cadastro, login e sessão (T9, T10) |
|---|---|---|---|---|
| Carregando | Pré-checagem do membro: `Skeleton` de 3 linhas e "Verificando…" no diálogo, com o botão desabilitado | `Skeleton` de 5 cards (celular) ou 5 linhas (desktop). Na troca de página, os dados anteriores ficam com `opacity-60` | `Sheet`: `Skeleton` do cabeçalho e de 6 linhas | "Restaurando…", "Salvando…" e "Entrando…" nos botões |
| Vazio | — | "Nenhum cadastro excluído." (ou "Nenhuma célula excluída.", "Nenhum relatório excluído.") e "Quando alguém excluir, o registro aparece aqui para ser restaurado." | `Sheet`: "Não informado" nos campos vazios; "Participantes (0)" com "Nenhum membro." | — |
| Sem resultado | — | "Nenhum cadastro excluído encontrado para esta busca." e "Limpar busca" (o mesmo nas outras entidades) | — | — |
| Erro ao carregar | Se a pré-checagem falhar, a confirmação abre normalmente; o servidor confere no envio | `Alert` "Não foi possível carregar os cadastros excluídos." (ou as células, os relatórios) e "Tentar de novo" | `Sheet`: "Não foi possível carregar o relatório." e "Tentar de novo" | — |
| Sem permissão | Sem a permissão, a ação não aparece. A recusa 42501 vira o toast "Você não tem permissão para esta ação." | Rota sem `manage_roles`: "Você não tem acesso a esta lista." e "Voltar para {Lista}" | Sem `edit_cell_report`: sem "Editar" e sem "Ver relatório" na linha (PO-UX-3) | Sessão sem acesso: login com "Sua sessão terminou. Entre de novo para continuar." |
| Registro mudou no meio tempo | "… não existe ou já foi excluído." vira toast informativo, o diálogo fecha e a lista recarrega | "… não está excluído." vira toast informativo, e a lista recarrega | `Sheet` de um relatório excluído no meio tempo: "Este relatório não existe ou já foi excluído." e "Fechar". Edição recusada por célula excluída: `Alert` no formulário (T7) | Editar um membro excluído no meio tempo: `Alert` no formulário com "Este cadastro não existe ou já foi excluído. As alterações não foram salvas." e "Fechar", que recarrega a lista |
| Sucesso | Toast "Cadastro excluído.", "Célula excluída." ou "Relatório excluído.". A lista recarrega na mesma página, ou na última, se a página esvaziou | Toast "Cadastro restaurado.", "Célula restaurada." ou "Relatório restaurado.", e o item sai da lista. Membro sem líder ou com a função padrão: diálogo "Cadastro restaurado" (T5) | Sem mudança | RN-18: o formulário passa a editar o cadastro restaurado, com o `Alert`. "Cadastrar mesmo assim" mostra o toast normal |
| Lista grande | — | Paginação no servidor (25 por página; 10, 25, 50 ou 100) | O `Sheet` lista todos os participantes do relatório, sem corte | — |
| Queda de conexão no envio | O diálogo continua aberto, com o `Alert` "Não foi possível excluir. Verifique a conexão e tente de novo.", e o botão volta | Toast "Não foi possível restaurar. Verifique a conexão e tente de novo.", e o botão volta. Se a nova tentativa receber "não está excluído", a lista recarrega (a primeira tentativa tinha valido) | O formulário mantém os dados, como hoje | Login: "Não foi possível entrar. Verifique a conexão e tente de novo.". A sessão não cai por falta de rede |

### Textos
Complementam os "Textos de tela" do Negócio, sem mudar termos. As mensagens de regra são as do Negócio, mostradas como vêm do servidor. Os itens marcados com † foram definidos pela UX e estão nas pendências (PO-UX-5 e PO-UX-6). O PO os aprovou em 2026-11-23 e os copiou para os "Textos de tela" do Negócio, que passam a ser a referência.

| Onde | Texto |
|---|---|
| Cards: menu de ações | Ações de {Nome} · Ações da célula de {Líder} · Ações do relatório de {data} (rótulos para leitor de tela) |
| Itens do menu e botões de confirmar | Excluir cadastro · Excluir célula · Excluir relatório · Excluindo… |
| Confirmação: membro | Título: Excluir {Nome}? · Tópicos: O cadastro sai das listas, dos totais e do dashboard. / A pessoa perde o acesso ao sistema. / Os relatórios em que ela aparece continuam no histórico. / Um administrador pode restaurar o cadastro depois. · Aviso: Se a pessoa só deixou de frequentar, prefira marcá-la como inativa. · Botão: Marcar como inativo |
| Confirmação: célula | Título: Excluir a célula de {Líder}? · Linha: {Dia}, {hora} · {endereço} · Tópicos: A célula sai das listas e dos totais. / Os relatórios dela continuam no histórico. / Um administrador pode restaurá-la depois. · Aviso: Se a célula só parou de se reunir, prefira marcá-la como inativa. · Botão: Marcar como inativa |
| Confirmação: relatório | Título: Excluir o relatório de {data} da célula de {Líder}? · Tópicos: Ele sai das listas e das somas. / A célula poderá enviar outro relatório para a semana dele, se ainda for a semana atual. / Um administrador pode restaurá-lo depois. |
| Verificação prévia | Verificando se o cadastro pode ser excluído… · Verificando… |
| Bloqueio (RN-04) | Título: Não é possível excluir {Nome} · Antes, reatribua: · {N} discípulos / 1 discípulo · {N} células / 1 célula · {Papel} na célula de {Líder}, {dia}, {hora} · (inativo) † · (inativa) † · e mais {N} · Ajuda †: Discípulos e células inativos também contam. Para reatribuir um discípulo, abra o cadastro dele e escolha outro líder. Para uma célula, troque a pessoa na célula ou exclua a célula. · Fechar |
| Atalho de inativar (toasts) † | Cadastro marcado como inativo. · Célula marcada como inativa. |
| Cabeçalho das listas | Excluídos (Membros, Relatórios) · Excluídas (Células) † · Ver membros excluídos · Ver células excluídas · Ver relatórios excluídos (rótulos para leitor de tela) |
| Listas de excluídos | Membros excluídos · Células excluídas · Relatórios excluídos · ← Membros · ← Células · ← Relatórios · Subtítulo: Restaure o que foi excluído por engano. Os excluídos mais recentes aparecem primeiro. |
| Item excluído | Excluído em {dd/MM/aaaa} às {HH:mm} · Excluída em … (célula) · por {Nome} · Autor não registrado † · Não registrado (coluna, desktop) † · (cadastro excluído) † · Já há outro relatório desta célula na mesma semana. † · Restaurar · Restaurando… |
| Listas de excluídos: estados | Nenhum cadastro excluído. · Nenhuma célula excluída. · Nenhum relatório excluído. · Quando alguém excluir, o registro aparece aqui para ser restaurado. · Nenhum cadastro excluído encontrado para esta busca. · Limpar busca · Não foi possível carregar os cadastros excluídos. · Tentar de novo · Você não tem acesso a esta lista. · Voltar para Membros |
| Restaurar membro: confirmação † | Título: Restaurar o cadastro de {Nome}? · Tópicos: O cadastro volta às listas e aos totais, com os mesmos dados e a função {Função}. / A pessoa volta a entrar no sistema com a mesma senha. / O vínculo de cônjuge não volta. Se havia, refaça-o no cadastro. / Volta sem líder, porque o líder anterior ({Nome}) foi excluído. · Botão: Restaurar cadastro |
| Restaurar membro: resultado | Título †: Cadastro restaurado · Mensagem da RN-16 (d), do Negócio · Função †: O cadastro voltou com a função padrão ({Função}), porque a função anterior foi apagada. · Botões: Definir líder · Agora não |
| Recusa na restauração | Título: Não é possível restaurar {Nome} · Não é possível restaurar a célula de {Líder} · Não é possível restaurar o relatório de {data} · Ações: Ver membros excluídos · Ver relatórios da célula · Fechar |
| Relatórios | Célula excluída · Ver relatório · Ver o relatório de {data} (rótulo do ícone) |
| `Sheet` do relatório | Relatório de {data} · Célula de {Líder} · Data e hora · Situação · Realizada · Não realizada · Motivo · Tema · Participantes ({N}) · Visitantes ({N}) · Oferta · Observações · Não informado · Nenhum membro. · Ver células excluídas · Editar relatório |
| Formulário do relatório † | Continuam no relatório (cadastros excluídos): {nomes}. |
| RN-18: administrador | Título †: Há um cadastro excluído com estes dados / Há {N} cadastros excluídos com estes dados · Mensagem do Negócio por cadastro · Restaurar {Nome} · Explicação †: Ao restaurar, o cadastro volta como estava e abre para você conferir. O que você digitou aqui não é gravado. · E-mail da conta †: Para cadastrar outra pessoa, volte e use outro e-mail. · Cadastrar mesmo assim · Voltar ao formulário † |
| RN-18: outros | Título †: Há um cadastro excluído com este {celular \| CPF} / com este celular e este CPF · Texto: Se for a mesma pessoa, peça a um administrador para restaurá-lo. Se for outra pessoa, você pode cadastrar mesmo assim. · Cadastrar mesmo assim · Voltar ao formulário · Erro no campo E-mail: a mensagem do Negócio |
| RN-18: depois de restaurar † | Cadastro de {Nome} restaurado. Confira os dados e, se precisar, altere e salve. |
| Login † | Usuário ou senha inválidos. Confira os dados e tente de novo. · Não foi possível entrar. Verifique a conexão e tente de novo. · Sua sessão terminou. Entre de novo para continuar. |
| Formulário de membro (corrida) † | Este cadastro não existe ou já foi excluído. As alterações não foram salvas. · Fechar |
| Auditoria | Restauração (ação e opção do filtro) |
| Erros genéricos | Você não tem permissão para esta ação. (42501) · Não foi possível excluir. Verifique a conexão e tente de novo. · Não foi possível restaurar. Verifique a conexão e tente de novo. |

### Acessibilidade
- **Diálogos:**
  - os do Radix prendem e devolvem o foco;
  - na confirmação, o foco inicial fica em "Cancelar";
  - no bloqueio, o foco vai para o título quando o conteúdo troca da verificação para o bloqueio, e para a ação que resolve quando ela existe (T6);
  - toda lista fica dentro da descrição (`AlertDialogDescription asChild` com `<div>`), para o leitor de tela ler o motivo junto com o título.
- **Rótulos:** todo botão só de ícone tem `aria-label` com o nome do item ("Excluir Bruno Almeida", "Ações da célula de Carlos Lima", "Ver o relatório de 19/11/2026", "Restaurar Bruno Almeida"). O ícone de lixeira dentro do menu é decorativo (`aria-hidden`), porque o item já tem texto.
- **Sem depender de cor:** "Célula excluída", "(cadastro excluído)", "(inativo)", "(inativa)", a situação e os erros têm texto. O badge "Célula excluída" tem ícone e texto em `text-foreground`.
- **Contraste:**
  - texto com 4,5:1, e ícones e bordas de controles com 3:1, nos dois temas;
  - o ícone `Trash2` usa `text-muted-foreground` (T1);
  - o botão destrutivo usa `bg-destructive` com `text-destructive-foreground`, que passa nos dois temas.
- **Anúncios:**
  - os toasts de sucesso e as mensagens informativas são anunciados (`role="status"`);
  - o erro de login e os `Alert` de erro nos formulários usam `role="alert"`;
  - a troca de "Restaurar" para "Restaurando…" fica no próprio botão, sem região extra.
- **Formulários:**
  - o erro do e-mail (RN-18) fica ligado ao campo por `aria-describedby`, com `aria-invalid`, e o foco vai para o campo;
  - no cadastro restaurado, o `Alert` recebe o foco e, se ele voltou sem líder, o foco passa ao campo Líder.
- **Controles aninhados:** no card de relatório, o `button` "Ver relatório" e os botões de ação são irmãos, nunca um dentro do outro.
- **Toque:** todo alvo novo ou alterado tem pelo menos 44×44 px no celular, com 8 px entre si: "⋯", "Editar", "Novo relatório", "Restaurar", itens do bloqueio e "Marcar como inativo".
- **Zoom e fonte grande:** com 200%, os diálogos rolam por dentro (P9), os nomes quebram linha (sem `truncate` em nome de pessoa nos diálogos e nos cards de excluídos) e os botões com nome usam `whitespace-normal h-auto min-h-11`.
- **Movimento:** as animações do `AlertDialog` e do `Sheet` respeitam `motion-reduce:`.
- **Menu lateral:** o item ativo recebe `aria-current="page"` também nas sub-rotas.

### Critérios de UX
| ID | Critério | Como verificar |
|---|---|---|
| UX-01 | Abaixo de 768 px, em Membros, Células e Relatórios, "Excluir" fica só no menu "⋯" do card. Nenhum botão do card tem menos de 44×44 px nem fica a menos de 8 px de outro. "Editar" e "Novo relatório" continuam visíveis fora do menu. | teste E2E (360×800, medida dos elementos) |
| UX-02 | A partir de 768 px, a coluna Ações tem o botão de ícone "Excluir", com `aria-label` que traz o item ("Excluir Bruno Almeida", "Excluir a célula de Carlos Lima", "Excluir o relatório de 19/11/2026"). | teste de componente |
| UX-03 | Sem a permissão de excluir da entidade, o ícone não aparece, e o "⋯" também não, quando ficaria vazio. Na linha do próprio usuário em Membros, "Excluir" não aparece. | teste de componente (LE, MB e o próprio usuário) |
| UX-04 | A confirmação mostra:<br>- o título com o nome do item;<br>- as consequências em tópicos (Textos);<br>- "Cancelar", com o foco inicial;<br>- o botão destrutivo com verbo e objeto ("Excluir cadastro", "Excluir célula", "Excluir relatório").<br><br>Nenhum texto diz "não pode ser desfeita". | teste de componente |
| UX-05 | O aviso de inativar aparece só para membro ou célula ativos, e o botão "Marcar como inativo(a)" só com `edit_member` (ou `edit_cell`). O botão grava só a situação, fecha o diálogo, mostra o toast e não exclui nada. | teste E2E |
| UX-06 | Durante a exclusão, o diálogo continua aberto, o botão mostra "Excluindo…" e os dois botões ficam desabilitados. Um duplo toque não gera duas chamadas. | teste de componente (mock) |
| UX-07 | Depois de excluir, a lista recarrega na mesma página (ou na última, se a página esvaziou) e mostra "Cadastro excluído.", "Célula excluída." ou "Relatório excluído.", sem "Desfazer". | teste E2E |
| UX-08 | Com a pré-checagem (AQ-1), tocar em "Excluir cadastro" num membro com ligações abre o bloqueio sem passar pela confirmação. Enquanto verifica, o diálogo mostra "Verificando…" com o botão de excluir desabilitado. Se a verificação falhar, a confirmação abre normalmente. | teste de componente (mock) |
| UX-09 | O bloqueio da RN-04 não tem botão destrutivo e mostra:<br>- os discípulos e as células em listas, com até 5 por grupo e "e mais N";<br>- o papel, o dia e o horário de cada célula;<br>- as marcações "(inativo)" e "(inativa)".<br><br>Com 7 discípulos, aparecem 5 nomes e "e mais 2". | teste de componente |
| UX-10 | No bloqueio, com `edit_member`, cada discípulo é um botão que abre o formulário dele; com `edit_cell`, cada célula abre o formulário da célula. Sem a permissão, os itens são texto. | teste E2E |
| UX-11 | As recusas do servidor na exclusão (RN-03, RN-04 e corrida) aparecem no mesmo diálogo de bloqueio, com a mensagem do Negócio. Sem os detalhes estruturados (AQ-2), o texto aparece como veio. | teste de componente |
| UX-12 | Em 360×640, com a fonte do sistema em 200%, todo diálogo deste spec rola por dentro, mantém margem lateral e texto alinhado à esquerda, e os botões continuam alcançáveis. | inspeção + teste E2E (viewport) |
| UX-13 | O botão "Excluídos" (ou "Excluídas") aparece no cabeçalho de Membros, Células e Relatórios só com `manage_roles` e leva a `/members/deleted`, `/cells/deleted` e `/cell-reports/deleted`. Em 360 px, fica na linha do título e não empurra "Novo membro". | teste E2E |
| UX-14 | As listas de excluídos:<br>- são paginadas no servidor com `ListPagination`;<br>- guardam `page`, `size` e `q` na URL;<br>- vão da exclusão mais recente para a mais antiga;<br>- buscam pelos mesmos campos da lista principal.<br><br>Recarregar a página mantém a busca e a página. | teste E2E |
| UX-15 | Cada item mostra "Excluído em dd/MM/aaaa às HH:mm" ("Excluída", na célula) no horário de Brasília, mesmo com o navegador em outro fuso, e "por {Nome}" ou "Autor não registrado". | teste de componente (fuso alterado) |
| UX-16 | Abaixo de 768 px, as listas de excluídos são cards; a partir de 768 px, tabelas. O card mostra primeiro o que identifica o item (o nome do membro ou "Célula de {Líder}"), depois no máximo 3 dados, e o botão "Restaurar" com texto visível e 44 px de altura. | teste E2E (viewport) |
| UX-17 | Sem `manage_roles`, abrir uma rota de excluídos mostra "Você não tem acesso a esta lista." e "Voltar para {Lista}", sem nenhum registro no DOM. | teste E2E |
| UX-18 | Em `/members/deleted`, o item "Membros" do menu fica ativo, com `aria-current="page"`. Em `/cell-reports/deleted`, "Relatórios" fica ativo, e "Células" não. | teste de componente (`AppSidebar`) |
| UX-19 | "← Membros" volta para a lista com a busca e a página de antes; por link direto, vai para `/members`. O mesmo vale para Células e Relatórios. | teste E2E |
| UX-20 | Restaurar um membro abre a confirmação com:<br>- a função;<br>- a volta do acesso, só se ele tem conta;<br>- o aviso do cônjuge;<br>- quando a lista já sabe, o aviso de volta sem líder.<br><br>Restaurar uma célula ou um relatório não pede confirmação. | teste de componente |
| UX-21 | Durante a restauração, só o botão daquele item fica "Restaurando…" e desabilitado. No sucesso, o item sai da lista, a página se ajusta e aparece o toast do Negócio. | teste E2E |
| UX-22 | Um membro restaurado sem líder abre o diálogo "Cadastro restaurado", com a mensagem da RN-16 (d) e "Definir líder". Esse botão abre o formulário com o campo Líder visível e com o foco nele. | teste E2E |
| UX-23 | Toda recusa na restauração (RN-16 b e e, RN-17) abre o diálogo de bloqueio com a mensagem e a ação da tabela da T6. Quando o card já mostra o motivo, o diálogo abre sem chamar o servidor. | teste de componente |
| UX-24 | "Não existe ou já foi excluído", na exclusão, e "não está excluído", na restauração, aparecem como toast informativo, e não como erro, e a lista recarrega. | teste de componente |
| UX-25 | O relatório de célula excluída mostra o badge "Célula excluída", com ícone e texto, na lista principal e na de excluídos. | teste de componente |
| UX-26 | Nessas linhas, "Editar" não aparece. Para quem tem `edit_cell_report`, "Ver relatório" abre o `Sheet` com o aviso da RN-11, e o administrador vê ali "Ver células excluídas". Sem `edit_cell_report`, "Ver relatório" não aparece. Nas linhas de célula não excluída, nada muda. "Excluir relatório" continua. | teste E2E (AD; LE com `edit_cell_report`; MB) |
| UX-27 | O `Sheet` "Relatório" mostra a data (dd/MM/aaaa), a hora (24 h), a situação, o tema ou o motivo, os participantes pelo nome (inclusive os excluídos), os visitantes, a oferta em BRL e as observações.<br>- Ocupa a largura toda abaixo de 640 px.<br>- `?report=<id>` na URL reabre o painel ao recarregar, só para relatório de célula excluída e com `edit_cell_report`. | teste E2E |
| UX-28 | Quando o servidor recusa a edição porque a célula foi excluída no meio tempo, o formulário mostra a mensagem do Negócio num `Alert` no topo, mantém os dados e não fecha. | teste de componente |
| UX-29 | Na edição de um relatório, os participantes excluídos:<br>- aparecem fora do seletor, em "Continuam no relatório (cadastros excluídos): …", sem ✕;<br>- continuam no relatório depois de salvar.<br><br>O seletor não os oferece. | teste E2E (RN-13) |
| UX-30 | Quando um participante ou a célula é excluído entre a escolha e o envio:<br>- a mensagem do Negócio aparece junto do campo;<br>- o membro fica marcado "(cadastro excluído)" e pode ser retirado;<br>- o resto do formulário fica como estava. | teste de componente |
| UX-31 | RN-18, administrador: ao salvar um membro novo, o diálogo lista cada cadastro excluído que combina, com nome e data, e "Restaurar {Nome}" em cada um.<br>- "Cadastrar mesmo assim" não aparece quando o e-mail é o da conta de um excluído.<br>- "Voltar ao formulário" fecha o aviso e mantém tudo o que foi digitado. | teste E2E |
| UX-32 | RN-18, depois de restaurar: o diálogo do formulário passa a "Editar membro", com os dados do cadastro restaurado e o `Alert` de restauração com o foco. Nada do que foi digitado é gravado nem continua nos campos. | teste E2E |
| UX-33 | RN-18, quem não é administrador:<br>- celular ou CPF abrem o aviso sem nome de pessoa, com "Cadastrar mesmo assim" e "Voltar ao formulário";<br>- o e-mail da conta vira um erro embaixo do campo E-mail, com o foco no campo e sem diálogo.<br><br>O nome do excluído não aparece no DOM. | teste E2E (CM) |
| UX-34 | "Cadastrar mesmo assim" cria o cadastro com um toque, sem nova pergunta, e mostra o toast normal de cadastro. | teste E2E |
| UX-35 | No login, identificação inexistente, senha errada, cadastro excluído e conta bloqueada mostram a mesma mensagem, no mesmo `Alert` do formulário (`role="alert"`).<br>- A identificação continua preenchida, e a senha é limpa e recebe o foco.<br>- Nenhuma mensagem como "CPF ou celular não encontrado" aparece. | teste E2E |
| UX-36 | Com a sessão de um membro excluído, na próxima leitura ou gravação recusada, ou quando ele volta para a aba, o app vai para `/login` com "Sua sessão terminou. Entre de novo para continuar.". Uma falha de rede não encerra a sessão. | teste E2E (exclusão feita em outra sessão; modo offline) |
| UX-37 | A Auditoria mostra os eventos de restauração com a ação "Restauração", e o filtro de ação tem essa opção. | teste de componente |
| UX-38 | Nenhum estado deste spec depende só de cor. Badges e ícones de ação têm contraste de 4,5:1 (texto) e 3:1 (ícone) nos temas claro e escuro, e o ícone de lixeira não usa `text-destructive`. | inspeção (axe, nos dois temas) |
| UX-39 | Nenhuma tela deste spec mostra mensagem técnica. A recusa 42501 vira "Você não tem permissão para esta ação.", e a queda de rede vira a mensagem de conexão da tabela Estados, sem perder o que foi digitado. | teste de componente |
| UX-40 | Em 320 px, nenhum botão com nome ("Restaurar Bruno Almeida", "Excluir o relatório…") estoura a largura: o texto quebra linha. | inspeção + teste E2E (viewport) |

### Perguntas para o `architect` (dados e contrato)
Em cada uma, a tela tem um comportamento padrão (o mais conservador) se a resposta for "não".

- **AQ-1. Pré-checagem da exclusão de membro** (UXD-2). É uma consulta só de leitura, com o mesmo resultado que a exclusão devolveria ao recusar:
  - o motivo: próprio cadastro, função acima de quem exclui ou ligações;
  - para as ligações: o total de discípulos e até 5 deles (`id`, nome, `is_active`); o total de células e até 5 delas (`id`, papel, nome do líder, dia, horário, `is_active`).
  - *Padrão sem isso:* a confirmação abre primeiro, e o bloqueio só aparece na recusa do servidor (1 toque a mais e uma leitura em vão).
- **AQ-2. Erros com código e detalhes**, além do texto, para a tela escolher o diálogo ou o campo certo. Exemplos:
  - `member_has_links`, com a estrutura da AQ-1;
  - `self_delete`, `role_above` e `not_found_or_deleted`;
  - `deleted_member_chosen`, com o campo e o `member_id`;
  - `cell_deleted` e `report_cell_deleted`;
  - `restore_value_in_use`, com o campo;
  - `restore_role_above`;
  - `restore_person_deleted`, com o papel, o nome e o `member_id`;
  - `restore_week_taken`, com o `report_id`;
  - `not_deleted`.
  - *Padrão sem isso:* o texto aparece como veio, num diálogo de bloqueio genérico, sem os itens como botões e sem marcar o campo.
- **AQ-3. Listas de excluídos.** Uma view ou RPC por entidade, só com os excluídos e só para `manage_roles`, paginada, com total exato, a mesma busca da lista principal e a ordem `deleted_at DESC, id`. Colunas:
  - todas: `deleted_at` e o nome de quem excluiu (nulo quando não houver);
  - membros: nome, líder e `leader_deleted`, situação, nome da função (nulo se ela foi apagada) e se há conta de acesso, mais os dados de identificação que a `members_view` já libera;
  - células: líder, dia, horário, tipo, bairro, e o timóteo e o anfitrião com `*_deleted`;
  - relatórios: data, hora, situação, tema, líder da célula, `cell_deleted` e se a célula já tem outro relatório não excluído na mesma semana.
  - *Padrão sem os campos de antecipação:* os avisos dos cards não aparecem, e a recusa vem só ao tocar em "Restaurar".
- **AQ-4. `cell_reports_view.cell_deleted`.** É **obrigatório** para o badge "Célula excluída" e para esconder o "Editar". A view já junta a tabela `cells` (E1.08), então a coluna sai dali.
- **AQ-5. `cell_report_participants_view.member_deleted`**, para separar os participantes excluídos no formulário (T8).
  - A gravação da edição precisa preservar essas participações, porque hoje o formulário apaga e regrava todos (ver Impactos, E2.11).
  - *Padrão sem isso:* não há como cumprir a UX-29.
- **AQ-6. Contrato do cadastro com dado de um excluído** (RN-18):
  - a resposta é um aviso, e não um erro, com a lista de correspondências: o campo, se é o e-mail da conta e, só para o administrador, o `member_id`, o nome e a data da exclusão. O nome precisa vir nulo do banco para quem não é administrador;
  - um parâmetro de confirmação para "Cadastrar mesmo assim";
  - uma recusa definitiva para o e-mail da conta.
  - A restauração usa a mesma RPC da lista. Depois, a tela lê o cadastro restaurado na `members_view` para abrir o formulário.
- **AQ-7. Resultado da restauração de membro:**
  - `restored_without_leader` e o nome do líder anterior (RN-16 d);
  - `role_reset_to_default` e o nome da função;
  - a tela também precisa saber, antes, se ele tem conta de acesso, para o texto da confirmação (AQ-3).
  - *Padrão sem isso:* a confirmação omite a linha do acesso, e depois da restauração só aparece o toast, sem "Definir líder".
- **AQ-8. Como a tela percebe a perda de acesso na sessão** (RN-14, UX-36). Sugestão:
  - em toda recusa 42501, na falha de renovação do token e quando a aba volta a ter foco, a tela relê o próprio cadastro na `members_view`;
  - se ele não vier, a tela encerra a sessão e abre o login.
  - Queda de rede ou erro 5xx nunca encerram a sessão. Confirmar se o bloqueio da conta no Auth derruba a renovação do token na hora.
- **AQ-9. Ação de restauração na Auditoria:** qual o valor de `events.action` (por exemplo, `restore`), para o rótulo "Restauração" e o filtro.
- **AQ-10. Login até a função `sign-in` (E1.04):**
  - a `get-user-email` precisa responder da mesma forma para identificação inexistente e para cadastro excluído;
  - a tela trata qualquer falha do login (inclusive a de usuário bloqueado no Auth) com a mesma mensagem.
  - Confirmar que nenhuma resposta permite distinguir os casos, nem pelo tempo de resposta.
- **AQ-11. Atalho "Marcar como inativo"** (UXD-3). Confirmar que é uma atualização simples de `is_active`, pelo caminho de edição de hoje (`edit_member`, `edit_cell`), sem RPC nova, e que ela respeita as regras de escrita do E1.08 e do E2.02.

### Pendências para o PO (resolvidas em 2026-11-23)
Nenhuma bloqueava o desenho. O PO resolveu todas em 2026-11-23 e registrou as decisões em "Negócio > Decisões > Padrões definidos por este spec" (P-DEL-17 a P-DEL-23), nas RNs e em "Textos de tela". **Revisar no PR.**

- **PO-UX-1. A mensagem da RN-04 como lista, no celular.** O conteúdo e os termos do Negócio são os mesmos (contagens, até 5 nomes, papel, dia e hora), e a UX acrescentou:
  - as marcações "(inativo)" e "(inativa)";
  - a linha "Discípulos e células inativos também contam. Para reatribuir…";
  - os itens como botões que abrem o cadastro ou a célula.
  - Motivo: a P-DEL-01 é a regra que mais surpreende, porque a pessoa não espera que um discípulo inativo impeça a exclusão.
  - *Adotado.*
  - ***Resolvida (PO):** aceito como está. As marcações e a explicação entram na RN-04 (P-DEL-17), no critério da RN-04 e em "Textos de tela". Os itens como botões só navegam e respeitam `edit_member` e `edit_cell`, sem regra nova.*
- **PO-UX-2. O editor pode retirar um participante excluído de um relatório?** A RN-13 diz que a participação "não é removida", mas não diz se o editor pode retirá-la de propósito. Como o excluído não pode voltar como participante novo (RN-06), retirar seria uma perda sem volta.
  - *Adotado:* não pode. A participação fica fixa, numa linha só de leitura.
  - ***Resolvida (PO):** aceito, e vale também pela API (P-DEL-18). A RN-13 passou a dizer "não pode ser retirado, nem de propósito, nem pela API", com a mensagem "Não é possível retirar um participante cujo cadastro foi excluído." nos "Textos de tela" e um critério novo. A RN-01 ficou mais precisa: a exclusão física na edição vale só para participantes não excluídos. Em "Impactos", a regravação do `CellReportForm` passa a ser obrigatória neste passo.*
- **PO-UX-3. "Ver relatório" para todos que veem a lista de Relatórios.** A RN-11 pede consulta ao relatório de célula excluída, e a RN-09 (b) pede os participantes pelo nome. Hoje só quem edita relatórios vê os participantes. Os nomes já são "nomes de referência" liberados pelo E1.08 (RN-06) a quem vê o relatório, então nenhum dado novo é exposto.
  - *Adotado:* o `Sheet` em toda linha.
  - *Alternativa menor, se o PO ou o `architect` preferirem:* o `Sheet` só nas linhas de célula excluída, no lugar do "Editar".
  - ***Resolvida (PO): alternativa menor.*** *O `Sheet` aparece só nas linhas de relatório de célula excluída, no lugar do "Editar", para quem tem `edit_cell_report` (P-DEL-19). Nenhuma RN exige a alternativa maior:*
    - *a RN-11 pede consulta só ao relatório de célula excluída;*
    - *a RN-09 (b) e a RN-13 pedem o participante excluído pelo nome onde os participantes já aparecem: no formulário de edição (T8, para quem edita) e nesse `Sheet`. Elas não pedem mostrar participantes a quem hoje não os vê.*

    *A RN-11 ganhou o item da consulta e dois critérios. A alternativa maior foi para "Fora de escopo" e para "Impactos" (E2.12). Na UX, foram ajustados, só para refletir a decisão: UXD-7, Navegação ("Consulta do relatório"), F11, T7 (botão, rodapé e links), Estados (sem permissão) e UX-26 e UX-27. O `ux-designer` pode revisar esses ajustes.*
- **PO-UX-4. Confirmação ao restaurar um membro**, com textos novos derivados da RN-16 (função, acesso, cônjuge, líder).
  - *Adotado*, porque a restauração devolve o acesso ao sistema (UXD-6).
  - ***Resolvida (PO):** aceito (P-DEL-20). Os textos da confirmação e do resultado ("Cadastro restaurado", "Definir líder", "Agora não", função padrão) entraram nos "Textos de tela". As RNs não mudam.*
- **PO-UX-5. Textos que o Negócio não tem** (marcados com † em Textos). Adotados:
  - função padrão na restauração;
  - "Autor não registrado";
  - "Sua sessão terminou. Entre de novo para continuar.";
  - a mensagem genérica de login. Ela segue o "Usuário ou senha inválidos" da seção 6.3 do `docs/migracao.md`, com "Confira os dados e tente de novo.";
  - a dica do e-mail da conta para o administrador;
  - o aviso de quem não é administrador quando celular e CPF combinam juntos;
  - "(cadastro excluído)" e "Já há outro relatório desta célula na mesma semana.";
  - os toasts do atalho de inativar.
  - ***Resolvida (PO):** todos aceitos e copiados para os "Textos de tela" do Negócio, com um ajuste: quando o celular e o CPF combinam com cadastros excluídos diferentes, o título de quem não é administrador fica no plural ("Há cadastros excluídos com este celular e este CPF"). A mensagem de login e a de sessão encerrada entraram também na RN-14 e no critério dela (P-DEL-21). Os demais textos (incluindo o do membro excluído durante a edição) ficam só nos "Textos de tela".*
- **PO-UX-6. Ajustes de texto sem mudança de sentido.** Adotados:
  - "na mesma semana" no lugar de "nesta semana" na mensagem da RN-17, porque o relatório restaurado pode ser de uma semana passada;
  - "Voltar ao formulário" no lugar de "Cancelar" no aviso da RN-18, porque "Cancelar" parece desistir do cadastro inteiro, e o botão só fecha o aviso e mantém o que foi digitado;
  - "Excluídas" no botão da tela de Células, pela concordância;
  - a confirmação de exclusão em tópicos (UXD-3).
  - ***Resolvida (PO):** os quatro aceitos.*
    - *A RN-17 passou a dizer "na mesma semana do relatório, que pode ser uma semana passada", e o critério ganhou o caso da semana passada.*
    - *A RN-18 passou a ter "Restaurar {Nome}", por cadastro, e "Voltar ao formulário", e o critério cobre os dois.*
    - *"Excluídas" e as confirmações em tópicos entraram nos "Textos de tela".*
- **PO-UX-7. Conferir a RN-18 ao sair do campo**, e não só ao salvar. Isso avisaria antes de a pessoa preencher o formulário inteiro, porque o administrador que restaura perde o que digitou. Pede uma consulta a mais e limite de tentativas (enumeração).
  - *Não adotado:* vale "ao salvar", como na regra.
  - ***Resolvida (PO):** mantida a conferência ao salvar (P-DEL-22). Ela evita uma consulta extra que ajudaria a descobrir dados de cadastros excluídos. A RN-18 diz isso explicitamente e tem um critério; a conferência ao sair do campo foi para "Fora de escopo".*
- **PO-UX-8. Reatribuir em lote** (trocar o líder de vários discípulos de uma vez). Pela D10, um líder com muitos discípulos exige uma edição por discípulo antes da exclusão.
  - *Fora deste passo.* Fica registrado como sugestão para depois.
  - ***Resolvida (PO):** fora deste passo, registrada em "Fora de escopo" como sugestão, sem passo no plano. A D10 continua valendo como está.*
- **PO-UX-9. Atalho "Marcar como inativo" no diálogo de exclusão** (UXD-3). É uma decisão de experiência que usa uma ação que já existe, sem regra nova. Fica registrado para ciência, porque é uma gravação que parte de um diálogo de exclusão.
  - ***Resolvida (PO):** aceito (P-DEL-23), nas condições da T2:*
    - *só aparece para membro ou célula ativos e com `edit_member` ou `edit_cell`;*
    - *grava só a situação (Inativo), pelo caminho de edição de hoje, com as regras de escrita do E1.03, do E1.08 e, depois, do E2.02;*
    - *aparece na Auditoria como alteração.*

    *Inativar não é bloqueado por discípulos ou células: a D10 vale só para a exclusão. O toast entrou nos "Textos de tela".*

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
