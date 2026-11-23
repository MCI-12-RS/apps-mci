# E2.01: Exclusão lógica

> Status: desenho pronto para revisão. Negócio e Experiência (UX) escritos em 2026-11-23, com as pendências PO-UX-1 a PO-UX-9 resolvidas pelo PO. Solução técnica e Tarefas escritas pelo `architect` em 2026-11-23, sem perguntas em aberto; os pontos "definidos pelo architect" (DA-1 a DA-10) ficam para revisão no PR. A implementação começa depois do merge do PR 4 do E1.08. Falta a seção Testes (QA).
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
> **Substituída pela T1 do E1.04** ([`e1-04-sign-in.md`](e1-04-sign-in.md#t1-login-srcpageslogintsx), ajustes em "Ajustes na T10 do E2.01"). A sessão encerrada e a mensagem única continuam valendo, com estas mudanças:
> - todas as mensagens do login vão para o topo do formulário;
> - no UX-35, "conta bloqueada" quer dizer a conta suspensa do membro excluído (DT-13);
> - o bloqueio por excesso de tentativas tem mensagem própria, que recebe o foco.
>
> Quem implementar primeiro (este PR 6 ou o E1.04) segue a T1 do E1.04.

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
_Seção do `architect`. Escrita em 2026-11-23, só como desenho: nada foi implementado. **A implementação começa depois do merge do PR 4 do E1.08.** O desenho parte do estado final do E1.08 de leitura (PRs 1 a 4) e funciona com o PR 5 aplicado antes ou depois (DT-22)._

_Conferido em 2026-11-23, só com consultas de leitura, na stack local `supabase_db_mci-e108-pr2` (migrations até o PR 2 do E1.08 e as RPCs do PR 3 em andamento):_
- _colunas, constraints, índices, políticas (`pg_policies`), triggers, funções, enums e views;_
- _privilégios das tabelas (`relacl`) e os privilégios padrão (`pg_default_acl`);_
- _privilégios do `postgres` em `auth.users`, `auth.sessions` e `auth.refresh_tokens`._

_O comportamento do Supabase Auth com conta banida e com conta sem senha foi conferido no código do `supabase/auth` (`internal/api/token.go`, `internal/api/verify.go` e `internal/tokens/service.go`)._

### Revisão das regras
Nenhuma RN precisou voltar ao PO. As lacunas técnicas foram resolvidas com a leitura mais conservadora e estão em [Definidas pelo architect](#definidas-pelo-architect-revisar-no-pr).

Casos de borda conferidos:
- **Fuso e virada de semana:**
  - a semana do relatório é `week_start(date)`, de domingo a sábado, sobre a data local gravada;
  - "agora" vem sempre do banco (`now()` e `sp_today()`);
  - excluir no sábado às 23:50 e lançar outro às 23:55 funciona (RN-12);
  - restaurar um relatório de semana passada não confere a semana atual (RN-17, DT-28).
- **Casal:** a exclusão desfaz o vínculo nos dois cadastros, na mesma transação, e a restauração não o refaz. As travas pegam o cônjuge em ordem de id (DT-09).
- **Inativo:**
  - discípulos e células inativos bloqueiam a exclusão (RN-04);
  - excluir um inativo não muda os totais (D2);
  - a restauração devolve a mesma situação.
- **Sem líder:** não impede a exclusão. Quem é restaurado com o líder excluído volta sem líder (DA-3).
- **Pastor:** segue a RN-04 como qualquer membro. O escopo dos pastores continua o do E1.08 (`view_all_church`).
- **Consolidado:** a flag futura entra nas mesmas views. `deleted_at` é independente dela.
- **Concorrência e volume:** ver [Bloqueios e concorrência](#bloqueios-e-concorrência) e [Riscos](#riscos-concorrência-escala-segurança).

Leituras técnicas. Nenhuma muda regra, mas o PO e o QA precisam saber delas:
1. **"Pela API" na edição (RN-07 e RN-14).**
   - Um PATCH direto do PostgREST num registro excluído, ou feito por um usuário excluído, não dá erro: o RLS esconde a linha, e o resultado é "0 linhas alteradas".
   - O banco não tem como responder "não existe ou já foi excluído" para uma linha que a pessoa não vê sem revelar que ela existe.
   - A mensagem do PO vem de três lugares: das RPCs (exclusão e restauração); dos triggers (relatório de célula excluída e participante excluído); e da tela, que pede a linha de volta (`.select('id')`) e trata "0 linhas" com o texto do PO (DT-19).
   - O "erro de permissão" da RN-14 vale para inserções e RPCs. No PATCH, o resultado é "0 linhas".
2. **RN-11 e o RLS encadeado.**
   - A política de SELECT de `cell_reports` (ramo `view_own_ministry`) consulta `cells` num `EXISTS`, e essa subconsulta passa pelo RLS de `cells`.
   - Com `cells` escondendo as excluídas, os relatórios de célula excluída sumiriam para quem vê pelo ministério, e a `cell_reports_view` (que junta a tabela) deixaria de bater com o RLS.
   - A DT-05 troca esse `EXISTS` por uma função *definer* com a mesma regra.
3. **RN-03 sob concorrência.** Dois administradores que excluem um ao outro ao mesmo tempo passariam os dois pela checagem de "próprio cadastro", e não sobraria nenhum. A `delete_member` trava também quem exclui e confere a permissão de novo depois da trava (DT-21).
4. **AQ-10 e o tempo de resposta.**
   - Com a senha da conta esvaziada (DT-13), o login de um excluído responde com o mesmo texto e no mesmo tempo que uma identificação inexistente.
   - A diferença de tempo que já existe entre "conta existe, senha errada" (com bcrypt) e "conta não existe" é do Supabase Auth. Ela só some com a `sign-in` do E1.04.
5. **RN-16 (e) e RN-18 sem índice único.**
   - Até o E2.04 criar os índices únicos de e-mail, celular e CPF, as duas regras conferem antes de gravar, sem garantia contra uma corrida.
   - A `restore_member` já traduz o `unique_violation` que esses índices vão gerar.
6. **A recomendação do E2.02 (delegar o RLS à view) não serve para `cell_reports`.**
   - Uma política `id IN (SELECT id FROM cell_reports_view)` recusa o `INSERT … RETURNING`, que é o `insert().select('id')` do formulário de relatório.
   - Motivo: a subconsulta não enxerga a linha que está sendo inserida, e o Postgres exige que a linha devolvida passe no SELECT.
   - Fica registrado para o E2.02 (ver [Dependências](#dependências-e-impactos-em-outros-passos)).
7. **UX T3, "sem os dados estruturados".** Toda recusa deste passo vem com o código e os detalhes (AQ-2). O texto simples fica só como reserva.

#### Definidas pelo architect (revisar no PR)
Pontos que as RNs não respondem por inteiro. O `architect` adotou a leitura mais conservadora e coerente com as RNs e a D10. O usuário pode mudar qualquer um no PR.

| # | Ponto | Padrão adotado | Por quê |
|---|---|---|---|
| DA-1 | Vínculo celular por relatório de célula excluída (RN-08 × RN-11) | A participação num relatório **não excluído** conta no vínculo celular, mesmo que a célula tenha sido excluída. Só a participação em relatório excluído deixa de contar. | A RN-11 manda o relatório de célula excluída contar "como qualquer relatório não excluído". A RN-08 só tira o vínculo dado pelo papel na célula e pelo relatório excluído. |
| DA-2 | Função na restauração (RN-16 a) | Volta com a função padrão quem tem conta de acesso e está sem função. Quem não tem conta continua como estava. | Ao apagar uma função, o banco limpa `role_id` (`ON DELETE SET NULL`). Como o cadastro pela tela sempre exige uma função, "com conta e sem função" é o caso da função apagada. |
| DA-3 | Restaurado sem líder (RN-16 d) | `leader_id` nulo e `has_leadership = false` ("Tem Liderança?" desligado). O nível vira 0, e os totais são recalculados. | O cadastro fica coerente: sem líder e sem a chave ligada. "Definir líder" liga a chave no formulário (T5). |
| DA-4 | Restaurar um id inexistente ou fora do escopo (só pela API) | Mensagem técnica: "Este cadastro não foi encontrado." (ou "Esta célula não foi encontrada." e "Este relatório não foi encontrado."). | O PO só definiu o texto de "não está excluído". O que está fora do escopo vale como inexistente (RN-02, RN-15). |
| DA-5 | Célula com mais de uma pessoa excluída (RN-17) | A mensagem cita a primeira, na ordem líder, timóteo, anfitrião. Os detalhes trazem todas. | O texto do PO tem uma pessoa só. |
| DA-6 | Restauração com mais de um dado em uso (RN-16 e) | A mensagem cita o primeiro, na ordem e-mail, celular, CPF. Os detalhes trazem todos. | O texto do PO tem um dado só. |
| DA-7 | Participantes de relatório de célula excluída | Incluir ou retirar participante é recusado com a mensagem da RN-11. | Mudar os participantes é editar o relatório. |
| DA-8 | RN-18 para o administrador | Nome, data e "Restaurar" só aparecem para o excluído que ele veria na lista Excluídos (o escopo da RN-15). Fora dela, o aviso sai como para quem não é administrador. | A RN-15 limita o administrador aos excluídos que ele veria se não estivessem excluídos. |
| DA-9 | O que o membro excluído ainda consegue chamar (RN-14) | Ele também não lê funções e permissões, e o registro de login e logout dele (`log_auth_event`) não grava nada. As funções utilitárias sem dado de ninguém (data de hoje, início da semana) continuam respondendo. | A RN-14 diz que nenhuma leitura ou gravação dele é aceita. As utilitárias não leem dado de negócio. |
| DA-10 | O que precisa estar visível para excluir e restaurar | Para excluir: o registro precisa estar visível na lista principal (as views do E1.08). Para restaurar: precisa estar na lista de excluídos. | RN-02 e RN-15. Fica um ponto único por entidade, que o E2.02 ajusta. |

### Visão geral
Cinco partes, todas no padrão do E1.08 e de Escolas:

1. **Colunas e integridade.**
   - `deleted_at` e `deleted_by` em `members`, `cells` e `cell_reports`.
   - FKs sem cascata (DT-03).
   - Índices parciais (DT-07), inclusive o índice único da semana do relatório.
2. **Leitura sem excluídos**, em três níveis (DT-04):
   - **Entidade:** as views do E1.08 e as políticas de SELECT e UPDATE ganham `deleted_at IS NULL`, fora dos parênteses do escopo.
   - **Identidade de quem consulta:** os helpers de permissão e escopo ignoram o membro excluído, e é isso que corta o acesso dele (RN-14).
   - **Árvore:** as funções de árvore **não** filtram, para que o histórico mantenha o escopo de antes da exclusão.

   Três views novas listam os excluídos para o administrador (DT-06).
3. **Escrita por RPC.**
   - Excluir e restaurar só por RPCs `SECURITY DEFINER` (DT-02).
   - A gravação dos participantes do relatório passa por uma RPC mínima (DT-15).
   - Triggers `BEFORE` são a última barreira das RN-06, RN-11, RN-13 e RN-18 (DT-08).
4. **Acesso do excluído.** Na mesma transação da exclusão, o banco suspende a conta no Auth: guarda o hash da senha, esvazia a senha, bane a conta e apaga as sessões. A restauração devolve tudo (DT-13). O corte de acesso não depende disso, porque o item 2 já ignora o excluído.
5. **Auditoria nos triggers que já existem**, com a exclusão, a restauração e o cônjuge desfeito gravados sem engolir erro (DT-16).

### Modelo de dados e migrations

#### Ordem das migrations
Os nomes são sugestões; o timestamp é o do momento da criação.
- Cada arquivo é idempotente (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DO` com guarda) e roda num banco zerado depois das migrations existentes.
- Depois de cada PR com migration, regenere o `types.ts`.

| # | PR | Arquivo | Conteúdo | Por que separado |
|---|---|---|---|---|
| 1 | 1 | `<ts>_e201_01_enum.sql` | `ALTER TYPE public.event_action ADD VALUE IF NOT EXISTS 'restore'` | Um valor novo de enum não pode ser usado na transação que o cria (padrão de Escolas) |
| 2 | 1 | `<ts>_e201_02_schema.sql` | Colunas, CHECKs, FKs, funções de normalização, índices, schema `private` e a tabela de suspensões, e o GRANT por coluna condicionado ao PR 5 | Estrutura antes das funções que a usam |
| 3 | 1 | `<ts>_e201_03_read.sql` | Helpers de identidade e escopo, `member_names`, views do E1.08, views de excluídos, políticas de SELECT, UPDATE e INSERT, `roles`, `role_permissions` e `log_auth_event` | Revisão da leitura separada da escrita |
| 4 | 1 | `<ts>_e201_04_write.sql` | Funções internas `_del_*`, triggers, RPCs e grants. A ordem das travas fica escrita no cabeçalho. | Idem |
| 5 | 2 | `<ts>_e201_05_no_physical_delete.sql` | Retira as políticas de DELETE de `members`, `cells` e `cell_reports`, e faz o `REVOKE` de DELETE e TRUNCATE | Só pode valer junto com o front que usa as RPCs (ver [Implantação](#implantação)) |

O PR 1 é neutro para o usuário: até o PR 2, a tela não chama as RPCs, então não existe nenhum registro excluído logicamente. A exclusão física da tela antiga continua até a migration 5. A única mudança visível é a das FKs (DT-03): a exclusão física que antes apagava em cascata passa a falhar, sem apagar nada.

#### DDL de referência (migration 2)
```sql
-- Colunas (DEL-01). deleted_by segue a convenção de Escolas (DT-31 de lá): o membro
-- que excluiu, via viewer_member_id(); nulo quando vem da service role ou do legado.
ALTER TABLE public.members      ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
                                ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.cells        ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
                                ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.cell_reports ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
                                ADD COLUMN IF NOT EXISTS deleted_by uuid;

-- Para cada tabela (members, cells, cell_reports), dentro de DO com guarda de duplicate_object:
--   <t>_deleted_by_fkey  FOREIGN KEY (deleted_by) REFERENCES public.members (id)
--   <t>_deleted_by_check CHECK (deleted_by IS NULL OR deleted_at IS NOT NULL)

-- FKs sem cascata nem SET NULL (DEL-07, seção 5.3). O nome fica o mesmo.
ALTER TABLE public.members
  DROP CONSTRAINT IF EXISTS members_leader_id_fkey,
  ADD  CONSTRAINT members_leader_id_fkey FOREIGN KEY (leader_id) REFERENCES public.members (id),
  DROP CONSTRAINT IF EXISTS members_spouse_id_fkey,
  ADD  CONSTRAINT members_spouse_id_fkey FOREIGN KEY (spouse_id) REFERENCES public.members (id);
ALTER TABLE public.cell_reports
  DROP CONSTRAINT IF EXISTS cell_reports_cell_id_fkey,
  ADD  CONSTRAINT cell_reports_cell_id_fkey FOREIGN KEY (cell_id) REFERENCES public.cells (id);
ALTER TABLE public.cell_report_participants
  DROP CONSTRAINT IF EXISTS cell_report_participants_report_id_fkey,
  ADD  CONSTRAINT cell_report_participants_report_id_fkey
       FOREIGN KEY (report_id) REFERENCES public.cell_reports (id),
  DROP CONSTRAINT IF EXISTS cell_report_participants_member_id_fkey,
  ADD  CONSTRAINT cell_report_participants_member_id_fkey
       FOREIGN KEY (member_id) REFERENCES public.members (id);
-- members.role_id continua ON DELETE SET NULL: funções são configuração (DA-2).
-- members.auth_user_id → auth.users continua ON DELETE SET NULL.

-- Normalização única de e-mail, celular e CPF (DT-17). O E2.04 usa as mesmas nos índices únicos.
CREATE OR REPLACE FUNCTION public.normalize_email(_value text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$ SELECT nullif(lower(btrim(_value)), '') $$;
CREATE OR REPLACE FUNCTION public.normalize_digits(_value text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$ SELECT nullif(regexp_replace(coalesce(_value, ''), '\D', '', 'g'), '') $$;

-- Índices de lista do E1.08 passam a parciais, com o MESMO nome, porque os testes do
-- E1.08 conferem o nome. Num DO: se o índice existir sem predicado (pg_index.indpred
-- IS NULL), DROP; depois CREATE INDEX IF NOT EXISTS com WHERE deleted_at IS NULL.
--   members_name_id_idx            ON public.members      (name, id)        WHERE deleted_at IS NULL
--   cell_reports_date_id_idx       ON public.cell_reports (date DESC, id)   WHERE deleted_at IS NULL
--   cell_reports_cell_id_date_idx  ON public.cell_reports (cell_id, date DESC) WHERE deleted_at IS NULL

-- Listas de excluídos (RN-15: da exclusão mais recente para a mais antiga).
CREATE INDEX IF NOT EXISTS members_deleted_at_idx
  ON public.members (deleted_at DESC, id) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS cells_deleted_at_idx
  ON public.cells (deleted_at DESC, id) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS cell_reports_deleted_at_idx
  ON public.cell_reports (deleted_at DESC, id) WHERE deleted_at IS NOT NULL;

-- RN-18: e-mail da conta de um excluído, consultado a cada cadastro novo.
CREATE INDEX IF NOT EXISTS members_deleted_account_email_idx
  ON public.members (public.normalize_email(email))
  WHERE deleted_at IS NOT NULL AND auth_user_id IS NOT NULL;

-- REL-03 e DEL-03, antecipado do E2.11: um relatório não excluído por célula e semana.
-- Antes do CREATE, um DO confere se há duplicatas e, se houver, falha com a lista
-- (cell_id, semana, ids), sem criar nada.
CREATE UNIQUE INDEX IF NOT EXISTS cell_reports_cell_week_key
  ON public.cell_reports (cell_id, public.week_start(date)) WHERE deleted_at IS NULL;

-- Credenciais suspensas (RN-14: "a senha fica guardada para uma eventual restauração").
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS private.member_access_suspensions (
  member_id             uuid PRIMARY KEY REFERENCES public.members (id),
  auth_user_id          uuid NOT NULL,
  encrypted_password    text,          -- o hash bcrypt de auth.users, como estava
  previous_banned_until timestamptz,   -- normalmente nulo
  suspended_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.member_access_suspensions ENABLE ROW LEVEL SECURITY;   -- sem políticas
REVOKE ALL ON TABLE private.member_access_suspensions FROM PUBLIC, anon, authenticated, service_role;

-- E1.08 PR 5 (trava por coluna em members) já aplicado? Então as colunas novas precisam
-- do GRANT (risco 4 do E1.08). Se ainda não, o PR 5 inclui as duas na lista dele (DT-22).
DO $$ BEGIN
  IF NOT has_table_privilege('authenticated', 'public.members', 'SELECT') THEN
    GRANT SELECT (deleted_at, deleted_by) ON public.members TO authenticated;
  END IF;
END $$;
```

#### Integridade garantida pelo banco
| Garantia | Como |
|---|---|
| Autor só com data (DEL-01) | `CHECK (deleted_by IS NULL OR deleted_at IS NOT NULL)` nas três tabelas |
| Nenhuma exclusão física pela API (RN-01) | Sem política de DELETE e sem privilégio DELETE e TRUNCATE para `anon` e `authenticated` nas três tabelas (migration 5). Participantes mantêm a política de DELETE (RN-13), mas perdem o TRUNCATE. |
| Nenhuma cascata apaga histórico (DEL-07) | FKs `NO ACTION`. Uma exclusão física feita pela service role falha enquanto houver referência. |
| Nada aponta para um excluído (RN-06) | Triggers `BEFORE` com `FOR KEY SHARE` na linha referenciada ([Triggers](#triggers-última-barreira)) |
| Marcação só pelas RPCs | Políticas de UPDATE e INSERT com `WITH CHECK (… AND deleted_at IS NULL)`. Um PATCH que tente marcar `deleted_at` recebe 42501. A service role passa por fora (ver risco 8). |
| Um relatório não excluído por célula e semana (RN-12, RN-17, RN-20) | Índice único parcial `cell_reports_cell_week_key` |
| Credenciais suspensas fora da API | Schema `private`, RLS sem políticas, sem privilégios |

### Leitura: onde os excluídos somem

#### Funções de identidade e escopo (migration 3)
Todas continuam `STABLE SECURITY DEFINER SET search_path = public`, com os mesmos grants de hoje.

| Função | Mudança | Efeito |
|---|---|---|
| `user_has_permission(_user_id, _permission)` | `AND m.deleted_at IS NULL` no cadastro de quem consulta | O excluído não tem permissão nenhuma (RN-14). Vale para `viewer_has`, as RPCs, o RLS e a `create-user-admin`. |
| `is_admin(_user_id)` | Idem | Idem nas políticas de `roles` e `role_permissions` |
| `viewer_member_id()` | `AND m.deleted_at IS NULL` (o comentário `E2.01` do PR 1) | Sem cadastro, sem escopo. Escolas depende disso (ESC-33). |
| `can_assign_role(_role_id)` | Passa a usar `viewer_covers_role(_role_id)`; o cadastro de quem consulta ignora excluídos | Mesma regra de hoje |
| `viewer_covers_role(_role_id)` (**nova**) | `NOT EXISTS (permissões da função EXCEPT permissões de quem consulta)`; falso sem cadastro não excluído | A regra de "cobrir a função", sem exigir `assign_role` (RN-03, RN-16 b; DT-12) |
| `can_manage_own_cell(_user_id, _cell_id)` | Ignora o **usuário** excluído. Não filtra a célula. | O líder de uma célula excluída continua vendo os relatórios dela (RN-11). O filtro da célula fica nas políticas. |
| `is_in_same_ministry(_user_id, _target)` | Ignora o **usuário** excluído. Não filtra o alvo. | Equivalência com `viewer_ministry_member_ids` mantida (teste do E1.08) |
| `get_ministry_root`, `viewer_ministry_member_ids` | Sem mudança (o `me` já vem de `viewer_member_id`) | A descida da árvore passa por excluídos: o histórico (célula ou relatório de um excluído) mantém o escopo de antes (DT-04, DA-10) |
| `is_leader_of_visible_member` | Considera só discípulos não excluídos | Coerente com a `member_names` |
| `member_names(_ids)` | `AND m.deleted_at IS NULL` | Os seletores não mostram excluídos. O nome de referência nas linhas vem dos *joins* das views, que não filtram (RN-09 c). |
| `cell_in_viewer_ministry(_cell_id)` (**nova**) | `EXISTS` em `cells` **sem RLS**: o líder ou o timóteo está no ministério de quem consulta (`is_in_same_ministry(auth.uid(), …)`) | Substitui o `EXISTS` sob RLS nas políticas de relatórios e participantes (DT-05). Sem parâmetro de usuário. |
| `log_auth_event` | Não grava nada quando quem chama é um membro excluído | DA-9 |

#### Views do E1.08 (migration 3)
`CREATE OR REPLACE VIEW`, com as mesmas colunas na mesma ordem e as novas **no fim** (risco 5 do E1.08). Continuam *security definer* com `security_barrier`, donas `postgres`, só com SELECT para `authenticated`.

| View | Mudança |
|---|---|
| `members_view` | `WHERE (<escopo atual>) AND m.deleted_at IS NULL`. Vínculo celular: `is_cell_*` só com `c.deleted_at IS NULL`; `attended_last_30_days` só com `r.deleted_at IS NULL`. O relatório de célula excluída conta (DA-1). |
| `cells_view` | `WHERE (<escopo atual>) AND c.deleted_at IS NULL`. `last_report_date` só com `r.deleted_at IS NULL`. |
| `cell_reports_view` | `WHERE (<escopo atual>) AND r.deleted_at IS NULL`. Continua juntando a **tabela** `cells`, então o relatório de célula excluída fica (RN-11). Coluna nova no fim: `cell_deleted boolean` (`c.deleted_at IS NOT NULL`, AQ-4). `participants_count` continua contando os participantes excluídos (RN-13). |
| `cell_report_participants_view` | Herda o filtro do relatório (junta a `cell_reports_view`). Continua mostrando o nome do membro excluído (RN-09 b, RN-13). Coluna nova no fim: `member_deleted boolean` (AQ-5). |

As RPCs do dashboard (PR 3) e a `ministry_tree_nodes` (PR 4) leem só dessas views e **não mudam**. Com isso:
- os cards de membros, os cards da semana, as células por tipo, o ranking e a árvore ficam sem excluídos (RN-08);
- o relatório de célula excluída continua em relatórios enviados, visitantes e não realizadas (RN-11);
- a célula excluída sai de pendentes e da contagem por tipo;
- a semana liberada volta a contar como pendente (RN-12).

#### Views de excluídos (migration 3, AQ-3)
Três views novas no padrão das demais: *security definer*, `security_barrier`, donas `postgres`, `REVOKE ALL` e `GRANT SELECT` só para `authenticated`. O `WHERE` de cada uma tem três partes:
- `(SELECT viewer_has('manage_roles'))`;
- o **mesmo** predicado de escopo da view principal;
- `deleted_at IS NOT NULL`.

Assim, o administrador vê os excluídos que veria se eles não estivessem excluídos (RN-15).

| View | Colunas | Ordem e busca |
|---|---|---|
| `members_deleted_view` | `id`, `name`, `gender`, `is_active`, `is_pastor`, `neighborhood`, `city`; `leader_id`, `leader_name`, `leader_deleted`; `role_id`, `role_name`; `restore_role_name` e `role_reset_on_restore` (DA-2); `has_account`; `sensitive_visible` e `email`, `cpf`, `mobile_whatsapp` mascarados como na `members_view`; `deleted_at`, `deleted_by`, `deleted_by_name`; `search_text` | `deleted_at DESC, id`. Busca pelos mesmos campos da lista principal (nome, e-mail e CPF já mascarados) |
| `cells_deleted_view` | `id`, `type`, `meeting_day`, `meeting_weekday`, `meeting_time`, `street`, `number`, `neighborhood`, `city`, `is_active`; `leader_id`, `leader_name`, `leader_deleted`; `timothy_id`, `timothy_name`, `timothy_deleted`; `host_id`, `host_name`, `host_deleted`; `deleted_at`, `deleted_by`, `deleted_by_name`; `search_text` (igual ao da `cells_view`) | `deleted_at DESC, id` |
| `cell_reports_deleted_view` | `id`, `cell_id`, `date`, `time`, `was_held`, `theme`, `reason_not_held`, `week_start`; `cell_leader_id`, `cell_leader_name`, `cell_deleted`; `week_taken` (outro relatório não excluído da mesma célula na mesma semana, pelo índice `cell_reports_cell_week_key`); `deleted_at`, `deleted_by`, `deleted_by_name`; `search_text` (nome do líder e tema) | `deleted_at DESC, id` |

- `deleted_by_name` sai por *join* com `members`, sem filtro de excluído: é o nome de quem excluiu, que pode ter sido excluído depois. Nulo = "Autor não registrado".
- A `members_view` **não muda o `WHERE` de escopo**: os excluídos ficam em views próprias.

#### Políticas de RLS (migration 3)
As políticas continuam espelhadas pelas views. O teste de paridade do E1.08 ganha registros excluídos na massa (ver [Verificações](#verificações-obrigatórias-para-o-qa)).

| Tabela | SELECT | UPDATE | INSERT |
|---|---|---|---|
| `members` | `(<atual>) AND deleted_at IS NULL` | `USING` e `WITH CHECK`: `(<atual>) AND deleted_at IS NULL` | `WITH CHECK (<atual> AND deleted_at IS NULL AND deleted_by IS NULL)` |
| `cells` | `(<atual>) AND deleted_at IS NULL` | idem | idem |
| `cell_reports` | `(<atual>, com o ramo view_own_ministry usando cell_in_viewer_ministry(cell_id)>) AND deleted_at IS NULL` | idem, sobre a política atual (`edit_cell_report`) | idem |
| `cell_report_participants` | `(<atual>, com o ramo view_own_ministry usando cell_in_viewer_ministry(cr.cell_id)>) AND EXISTS (SELECT 1 FROM cell_reports r WHERE r.id = report_id AND r.deleted_at IS NULL)` | — (não tem) | sem mudança. O trigger recusa os casos da RN-06, RN-07 e RN-11. |
| `roles`, `role_permissions` | `USING (public.viewer_member_id() IS NOT NULL)` no lugar de `true` (DA-9) | sem mudança | sem mudança |

- As políticas de DELETE de `members`, `cells` e `cell_reports` saem na migration 5 (PR 2), junto com o `REVOKE` de DELETE e TRUNCATE. A de participantes fica.
- Os outros ramos de `view_own_reports` em relatórios e participantes ficam como estão. Eles já são cobertos pelos ramos de `can_manage_own_cell` (achado 3 do E1.08), e o E2.02 os corrige.

Exemplo da política de `members` (as outras seguem o mesmo molde):
```sql
DROP POLICY IF EXISTS "Members view policy" ON public.members;
CREATE POLICY "Members view policy" ON public.members FOR SELECT TO authenticated
USING (
  (    public.user_has_permission(auth.uid(), 'view_all_church')
    OR public.user_has_permission(auth.uid(), 'view_members')
    OR (public.user_has_permission(auth.uid(), 'view_own_ministry')
        AND public.is_in_same_ministry(auth.uid(), id))
    OR auth_user_id = auth.uid() )
  AND deleted_at IS NULL                       -- E2.01; espelhado na members_view
);
```

#### Totais (RN-10, migration 4)
`refresh_member_stats_v2` é reescrita com a mesma fórmula e quatro mudanças:
- a descida da subárvore ignora membros excluídos (`m.deleted_at IS NULL`);
- `cell_totals` conta só células com `is_active AND deleted_at IS NULL`;
- ganha `SET search_path = public`, que hoje não tem;
- os triggers `trg_refresh_stats_members` e `trg_refresh_stats_cells` passam a disparar também em `UPDATE OF deleted_at`.

Excluir ou restaurar muda os totais na mesma transação.

### Escrita

#### Funções internas (migration 4)
São `SECURITY DEFINER SET search_path = public`, com `REVOKE ALL … FROM PUBLIC, anon, authenticated`. Só as RPCs e os triggers as chamam.

| Função | O que faz |
|---|---|
| `_del_raise(_code text, _message text, _detail jsonb DEFAULT '{}')` | Levanta o erro estruturado ([Formato dos erros](#formato-dos-erros-aq-2)) |
| `_del_lock_members(_target uuid, _actor uuid)` | Trava com `FOR UPDATE`, em ordem de id, o alvo, o cônjuge atual dele e quem exclui. Relê o cônjuge depois da trava e repete se ele mudou (DT-09, DT-21). |
| `_del_member_blockers(_member_id uuid) RETURNS jsonb` | `NULL` se a exclusão pode seguir. Senão, devolve o objeto de recusa, na ordem: inexistente, excluído ou fora da `members_view` (`not_found_or_deleted`) → próprio cadastro (`self_delete`) → função não coberta (`role_above`) → ligações (`member_has_links`). Usada pela pré-checagem e pela exclusão (DT-11). |
| `_del_suspend_access(_member_id uuid, _auth_user_id uuid)` | Suspende a conta (DT-13): guarda a senha e o banimento anterior em `private.member_access_suspensions`, esvazia `auth.users.encrypted_password`, põe `banned_until` 100 anos à frente e apaga as sessões e os *refresh tokens* |
| `_del_resume_access(_member_id uuid)` | Devolve a senha e o banimento guardados e apaga a suspensão. Sem suspensão guardada, só limpa `banned_until`. |
| `_del_lock_cell_week(_cell_id uuid, _date date)` | `pg_advisory_xact_lock(hashtextextended('cell-week:' \|\| _cell_id \|\| ':' \|\| week_start(_date), 0))` (DT-23) |

```sql
CREATE OR REPLACE FUNCTION public._del_suspend_access(_member_id uuid, _auth_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO private.member_access_suspensions
         (member_id, auth_user_id, encrypted_password, previous_banned_until)
  SELECT _member_id, u.id, u.encrypted_password, u.banned_until
    FROM auth.users u WHERE u.id = _auth_user_id
  ON CONFLICT (member_id) DO NOTHING;            -- nunca sobrescreve a senha guardada com ''
  -- Senha vazia: o login responde "Invalid login credentials" antes da checagem de banimento,
  -- igual a uma conta inexistente (AQ-10). O banimento barra renovação, link mágico e recuperação.
  UPDATE auth.users
     SET encrypted_password = '', banned_until = now() + interval '100 years', updated_at = now()
   WHERE id = _auth_user_id;
  DELETE FROM auth.sessions WHERE user_id = _auth_user_id;              -- refresh tokens caem em cascata
  DELETE FROM auth.refresh_tokens WHERE user_id = _auth_user_id::text;  -- tokens antigos sem sessão
END $$;
```

#### RPCs
Valem para todas:
- `REVOKE EXECUTE … FROM PUBLIC, anon` e `GRANT EXECUTE … TO authenticated`.
- Nenhuma recebe id de usuário: quem chama é sempre `auth.uid()`.
- Ordem das checagens: permissão (42501) → forma da entrada → travas → existência e visibilidade → regras → escrita. A auditoria sai dos triggers.
- `deleted_by` recebe `viewer_member_id()`.
- Mensagens novas, fora da tabela do PO, aparecem em itálico. São técnicas, e a tela normal não as provoca.

| RPC | Tipo | Quem | Travas | Recusas (código: mensagem) | Efeito |
|---|---|---|---|---|---|
| `check_member_deletion(_member_id uuid) RETURNS jsonb` | `STABLE SECURITY DEFINER`, só leitura | `delete_member` | — | 42501 sem a permissão | `{ "can_delete": true }` ou `{ "can_delete": false, "code", "message", … }`, com o mesmo conteúdo da recusa de `delete_member` (AQ-1) |
| `delete_member(_member_id uuid) RETURNS void` | `SECURITY DEFINER` | `delete_member` | `_del_lock_members` (alvo, cônjuge e quem exclui); confere `viewer_has` de novo depois da trava | `not_found_or_deleted`: Este cadastro não existe ou já foi excluído. · `self_delete`: Você não pode excluir o seu próprio cadastro. · `role_above`: Você não tem permissão para excluir este membro. · `member_has_links`: ver [Formato dos erros](#formato-dos-erros-aq-2) | `deleted_at = now()`, `deleted_by`, `spouse_id = NULL` (o trigger de cônjuge limpa o outro lado); totais e auditoria pelos triggers; `_del_suspend_access` se houver conta |
| `restore_member(_member_id uuid) RETURNS TABLE (restored_without_leader boolean, previous_leader_name text, role_reset_to_default boolean, role_name text)` | `SECURITY DEFINER` | `manage_roles` | o alvo `FOR UPDATE`; o líder guardado `FOR KEY SHARE` | `not_found`: *Este cadastro não foi encontrado.* (DA-4) · `not_deleted`: Este cadastro não está excluído. · `restore_role_above`: Você não tem permissão para restaurar este membro. · `restore_value_in_use`: Não é possível restaurar: outro cadastro já usa este {e-mail \| celular \| CPF}. (DA-6) | `deleted_at` e `deleted_by` nulos. `leader_id` sempre no `SET`, o que recalcula o nível e os totais: o mesmo líder, ou nulo com `has_leadership = false` se ele foi excluído (DA-3). `role_id` padrão se for o caso (DA-2). `_del_resume_access` se houver conta. Um `unique_violation` dos índices do E2.04 vira `restore_value_in_use`. |
| `delete_cell(_cell_id uuid) RETURNS void` | `SECURITY DEFINER` | `delete_cell` | a célula `FOR UPDATE` | `not_found_or_deleted`: Esta célula não existe ou já foi excluída. | marca a célula; os relatórios não mudam (RN-11); totais e auditoria pelos triggers |
| `restore_cell(_cell_id uuid) RETURNS void` | `SECURITY DEFINER` | `manage_roles` | a célula `FOR UPDATE`; líder, timóteo e anfitrião `FOR KEY SHARE` | `not_found`: *Esta célula não foi encontrada.* · `not_deleted`: Esta célula não está excluída. · `restore_person_deleted`: Não é possível restaurar a célula: o {líder \| timóteo \| anfitrião} {Nome} foi excluído. Restaure o cadastro dele antes ou crie uma célula nova. (DA-5) | desmarca a célula; os relatórios voltam a ser editáveis |
| `delete_cell_report(_report_id uuid) RETURNS void` | `SECURITY DEFINER` | `delete_cell_report` | o relatório `FOR UPDATE` | `not_found_or_deleted`: Este relatório não existe ou já foi excluído. | marca o relatório; os participantes ficam guardados (RN-01, RN-12). Vale também para relatório de célula excluída (RN-11). |
| `restore_cell_report(_report_id uuid) RETURNS void` | `SECURITY DEFINER` | `manage_roles` | o relatório `FOR UPDATE`; `_del_lock_cell_week` | `not_found`: *Este relatório não foi encontrado.* · `not_deleted`: Este relatório não está excluído. · `restore_week_taken`: Esta célula já tem outro relatório na mesma semana. Exclua-o antes de restaurar este. | desmarca; não confere REL-01, REL-02 nem REL-04 (DT-28). O `unique_violation` de `cell_reports_cell_week_key` vira `restore_week_taken`. |
| `set_cell_report_participants(_report_id uuid, _member_ids uuid[]) RETURNS void` | **`SECURITY INVOKER`** (o RLS de participantes vale) | as políticas atuais de INSERT e DELETE de participantes | as do trigger de participantes | as do trigger; 22023 *"Um relatório pode ter no máximo 1000 participantes."* | ver [Participantes do relatório](#participantes-do-relatório-rn-13) |
| `find_deleted_member_matches(_email text, _mobile text, _cpf text) RETURNS TABLE (member_id uuid, name text, deleted_at timestamptz, matched_fields text[], is_account_email boolean)` | `STABLE SECURITY DEFINER` | `create_member` | — | 42501 sem a permissão | ver [Cadastro com dado de excluído](#cadastro-com-dado-de-excluído-rn-18) |

Esqueleto da exclusão de membro (as demais seguem o mesmo molde):
```sql
CREATE OR REPLACE FUNCTION public.delete_member(_member_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := public.viewer_member_id();
  _auth uuid;
  _block jsonb;
BEGIN
  IF NOT public.viewer_has('delete_member') THEN
    RAISE EXCEPTION 'Você não tem permissão para esta ação.' USING ERRCODE = '42501';
  END IF;
  IF _member_id IS NULL THEN
    PERFORM public._del_raise('not_found_or_deleted', 'Este cadastro não existe ou já foi excluído.',
                              '{"entity": "member"}');
  END IF;

  PERFORM public._del_lock_members(_member_id, _me);   -- alvo, cônjuge e quem exclui (DT-09, DT-21)
  IF NOT public.viewer_has('delete_member') THEN       -- quem exclui pode ter sido excluído na espera
    RAISE EXCEPTION 'Você não tem permissão para esta ação.' USING ERRCODE = '42501';
  END IF;

  _block := public._del_member_blockers(_member_id);   -- o mesmo objeto da pré-checagem
  IF _block IS NOT NULL THEN
    PERFORM public._del_raise(_block ->> 'code', _block ->> 'message', _block - 'message');
  END IF;

  UPDATE public.members
     SET deleted_at = now(), deleted_by = _me, spouse_id = NULL
   WHERE id = _member_id
  RETURNING auth_user_id INTO _auth;                   -- triggers: cônjuge, totais, auditoria
  IF _auth IS NOT NULL THEN
    PERFORM public._del_suspend_access(_member_id, _auth);
  END IF;
END $$;
```

#### Triggers (última barreira)
São todas `SECURITY DEFINER SET search_path = public`.
- As funções novas valem para qualquer papel, inclusive a service role (DT-27). Só a carga com `session_replication_role = replica` passa por fora (risco 8).
- Os nomes com `aa_` e `ab_` garantem a ordem entre os triggers `BEFORE`, que é alfabética.
- A trava `FOR KEY SHARE` na linha referenciada conflita com o `FOR UPDATE` das RPCs de exclusão. Por isso, "escolher" e "excluir" a mesma pessoa ou célula nunca passam juntos (RN-20).

| Tabela | Trigger (função) | Quando | Regra |
|---|---|---|---|
| `members` | `ab_enforce_member_links` (`enforce_member_links`) | `BEFORE INSERT OR UPDATE OF leader_id, spouse_id, deleted_at` | Linha excluída: nada a conferir. Senão, quando o líder ou o cônjuge mudam, ou na restauração: trava a pessoa com `FOR KEY SHARE` e recusa a excluída com `deleted_member_chosen` ("Este membro foi excluído e não pode ser escolhido.", com `field` e `member_id`). No INSERT, recusa o e-mail da conta de um excluído com `deleted_account_email` (RN-18). |
| `cells` | `aa_enforce_cell_links` (`enforce_cell_links`) | `BEFORE INSERT OR UPDATE OF leader_id, timothy_id, host_id, deleted_at` | Igual, para líder, timóteo e anfitrião, na criação, na troca e na restauração |
| `cell_reports` | `aa_enforce_cell_report_rules` (`enforce_cell_report_rules`) | `BEFORE INSERT OR UPDATE` | Marcar ou desmarcar `deleted_at`: nada a conferir. Edição de relatório cuja célula atual está excluída: `report_cell_deleted` ("A célula deste relatório foi excluída. Restaure a célula para editar o relatório."). INSERT, ou troca de `cell_id`, para célula excluída: `cell_deleted` ("Esta célula foi excluída e não recebe relatórios."). A célula é travada com `FOR KEY SHARE`. |
| `cell_reports` | `enforce_unique_weekly_cell_report_trigger` (reescrita) | como hoje (`INSERT` ou `UPDATE OF cell_id, date`) | Ignora relatório excluído (o novo e os existentes), pega `_del_lock_cell_week` antes de consultar e mantém a mensagem atual. O índice único é a garantia. |
| `cell_report_participants` | `aa_enforce_participant_rules` (`enforce_participant_rules`) | `BEFORE INSERT OR DELETE` | Trava o relatório e a célula com `FOR KEY SHARE`. Relatório excluído: `not_found_or_deleted` (relatório). Célula excluída: `report_cell_deleted` (DA-7). INSERT de um par que já existe: devolve a linha sem conferir nada (o `ON CONFLICT` a descarta). INSERT de membro excluído: `deleted_member_chosen`. DELETE de membro excluído: `deleted_participant_removal` ("Não é possível retirar um participante cujo cadastro foi excluído."). |
| `members`, `cells` | `trg_refresh_stats_*` (recriados) | `AFTER INSERT OR DELETE OR UPDATE OF leader_id, is_active, deleted_at` | Totais (RN-10) |
| `members`, `cells`, `cell_reports` | `trg_log_*` (funções reescritas) | como hoje | [Auditoria](#auditoria-rn-19) |

O trigger de semana atual (`enforce_cell_report_current_week`) não muda. A restauração não o dispara, porque não mexe em `date` (DT-28).

#### Participantes do relatório (RN-13)
O `CellReportForm` apaga e regrava todos os participantes ao editar. Com a RN-06 e a RN-13, isso deixa de funcionar: apagar um participante excluído é recusado, e reinseri-lo também. A solução deste passo é uma RPC mínima, `set_cell_report_participants` (DT-15). O E2.11 a absorve na RPC de lançamento.

- **Contrato:** `_member_ids` é o conjunto **final**, incluindo os participantes excluídos que continuam no relatório. A tela os recebe da `cell_report_participants_view` (`member_deleted`) e os devolve sem mudança.
- **Efeito, numa transação:**
  1. apaga os pares que não estão na lista (`DELETE … WHERE report_id = _report_id AND NOT (member_id = ANY(_member_ids))`);
  2. insere só os que faltam (`INSERT … SELECT … WHERE NOT EXISTS (…) ON CONFLICT DO NOTHING`, **sem alvo**). Com alvo, o Postgres aplicaria a política de SELECT às linhas propostas.
- **Garantias, pelo trigger:**
  - um participante excluído omitido da lista é recusado com `deleted_participant_removal`, e nada muda;
  - um membro excluído novo é recusado com `deleted_member_chosen`;
  - relatório excluído e relatório de célula excluída são recusados.
- **Permissão:** é `SECURITY INVOKER`, então valem as políticas atuais de INSERT e DELETE de participantes, sem regra nova de permissão.
- **Tamanho:** ids repetidos são ignorados. Acima de 1000, 22023.
- **Limite conhecido:** gravar o relatório e gravar os participantes continuam sendo duas chamadas, como hoje. O lançamento atômico é do E2.11.

#### Cadastro com dado de excluído (RN-18)
- **`find_deleted_member_matches`:**
  - normaliza a entrada com `normalize_email` e `normalize_digits`;
  - procura membros **excluídos** com o mesmo e-mail, celular (`mobile_whatsapp`) ou CPF;
  - devolve até 10 linhas, uma por cadastro, da exclusão mais recente para a mais antiga;
  - `matched_fields` é um subconjunto de `{email, mobile, cpf}`, e `is_account_email` diz se o e-mail combinou com um excluído que tem conta de acesso;
  - `member_id`, `name` e `deleted_at` só saem para quem tem `manage_roles` e quando o cadastro está na `members_deleted_view` dele (DA-8). Para os demais, vêm nulos do banco (AQ-6).
- **`create-user-admin`:**
  - aceita `confirmDeletedMatches?: boolean` no corpo;
  - depois de conferir a permissão e a entrada, e **antes** de criar a conta no Auth, chama `find_deleted_member_matches` com a sessão de quem chamou;
  - com `is_account_email` em alguma linha, responde 409 `{ error, code: "deleted_account_email", matches }`. Não há como seguir;
  - com correspondências e sem `confirmDeletedMatches`, responde 409 `{ error, code: "deleted_matches", matches }`;
  - nos demais casos, segue como hoje;
  - o `error` é o texto do PO para quem não é administrador. O de administrador é montado pela tela a partir de `matches`.
- **Recusa definitiva pela API:** o trigger `ab_enforce_member_links` recusa o INSERT de `members` com o e-mail da conta de um excluído (`deleted_account_email`), mesmo sem passar pela Edge Function. O Auth também recusa, porque o e-mail continua na conta.
- **Restaurar a partir do aviso:** a tela chama `restore_member`, que é a mesma RPC da lista. Depois, lê o cadastro restaurado na `members_view` e abre o formulário em modo de edição.

### Acesso do membro excluído (RN-14)
| Caminho | O que barra | Quando |
|---|---|---|
| Qualquer leitura com o token antigo (PostgREST, views, RPCs) | `user_has_permission`, `viewer_member_id`, `is_admin`, `can_manage_own_cell`, RLS e views ignoram o cadastro excluído: as leituras voltam vazias, as RPCs dão 42501, o INSERT dá 42501 e o PATCH volta com 0 linhas | Na hora do *commit* da exclusão. Não depende do Auth. |
| Edge Functions (`create-user-admin`) | `user_has_permission` é falso, e a função recusa com 403. O `auth.getUser` pode recusar antes, porque a sessão foi apagada. | Na hora |
| Login por e-mail e senha | Senha vazia: o Auth responde `invalid_credentials` antes de olhar o banimento, como para uma conta inexistente | Na hora |
| Login por CPF ou celular | A `get-user-email` ignora excluídos e responde `{ "email": null }`, como para inexistente; a tela mostra a mensagem única (DT-14) | Na hora |
| Renovação do token | Sessões apagadas e conta banida: o Auth recusa a renovação | Na hora. O token de acesso já emitido vale até expirar (até 1 hora), mas o banco o ignora (primeira linha). |
| Link mágico e recuperação de senha | `/verify` recusa conta banida (`user_banned`) | Na hora |
| Restauração | `_del_resume_access` devolve a mesma senha e tira o banimento, na mesma transação | Na hora |

Por que dentro da transação, e não pela Admin API depois do *commit* (DT-13):
- **RN-20:** com a Admin API, uma falha entre o *commit* e a chamada deixaria um membro restaurado bloqueado, ou exigiria compensação.
- **RN-14 e AQ-10:** o banimento sozinho (`ban_duration` da Admin API) faz o login responder `user_banned` ("User is banned") antes de conferir a senha. Qualquer pessoa com a chave pública descobriria que um e-mail é de um cadastro excluído.
- **O custo** é escrever em colunas do Auth (`encrypted_password`, `banned_until`, `sessions`, `refresh_tokens`). Ver o risco 1, com o plano B.

Na tela (AQ-8, DT-20): o `AuthContext` relê o próprio cadastro na `members_view` em três momentos:
- em toda recusa 42501;
- em todo PATCH que volte com 0 linhas no próprio cadastro;
- quando a aba volta a ter foco.

Se a leitura volta **sem linha e sem erro**, a tela encerra a sessão localmente e abre `/login` com o aviso. O `SIGNED_OUT` que não foi pedido pelo usuário (renovação recusada) faz o mesmo. Erro de rede e 5xx nunca encerram a sessão.

### Formato dos erros (AQ-2)
| Código | Quando | Mensagem |
|---|---|---|
| 42501 | Falta de permissão (`viewer_has` falso, inclusive para o membro excluído) | "Você não tem permissão para esta ação." A tela usa o próprio texto (UX-39). |
| 22023 + `HINT = 'app_error'` | Qualquer regra deste passo, inclusive "próprio cadastro" e "função acima", que não podem ser 42501 porque a tela trocaria o texto pelo genérico | A mensagem do PO, ou a técnica em itálico |

```sql
RAISE EXCEPTION USING
  ERRCODE = '22023',
  MESSAGE = _message,                                          -- texto pronto para a tela
  DETAIL  = (jsonb_build_object('code', _code) || _detail)::text,
  HINT    = 'app_error';
```
O PostgREST devolve `{ code: "22023", message, details: "<json>", hint: "app_error" }`. É um padrão do projeto para erros com um item só: Escolas usa `esc_batch` para os lotes, e os dois convivem.

| `code` | Detalhes além de `code` |
|---|---|
| `not_found_or_deleted`, `not_found`, `not_deleted` | `entity`: `member`, `cell` ou `cell_report` |
| `self_delete`, `role_above`, `restore_role_above`, `deleted_account_email` | — |
| `member_has_links` | `member_id`, `member_name`; `disciples_total` e `disciples` (até 5, por nome: `{ id, name, is_active }`); `cells_total` e `cells` (até 5, por nome do líder, dia e horário: `{ id, roles: ["leader" \| "timothy" \| "host"], leader_name, meeting_day, meeting_time: "HH:MM", is_active }`). `MESSAGE` é a reserva em texto: "Não é possível excluir {Nome}. Antes, reatribua {N} discípulo(s) e {M} célula(s)." |
| `deleted_member_chosen` | `field` (`leader_id`, `spouse_id`, `timothy_id`, `host_id` ou `member_id`) e `member_id` |
| `cell_deleted`, `report_cell_deleted` | `cell_id` |
| `deleted_participant_removal` | `member_id` |
| `restore_value_in_use` | `fields` (`email`, `mobile`, `cpf`) |
| `restore_person_deleted` | `people`: `[{ role, member_id, member_name }]` |
| `restore_week_taken` | `report_id` (o outro relatório) e `week_start` |

No front, `parseAppError(error)` (`src/lib/errors.ts`) valida o JSON com um *type guard*, sem `any`, e devolve `{ code, message, detail }` ou `null`. A pré-checagem (`check_member_deletion`) devolve o mesmo objeto, então a tela usa um parser só.

### Bloqueios e concorrência
**Ordem global de aquisição, igual em todas as RPCs e triggers deste passo:**
1. relatório;
2. célula;
3. membros: o alvo, o cônjuge e quem exclui, em ordem de id;
4. trava consultiva (célula, semana);
5. linhas atualizadas pelos triggers: ancestrais (totais), `auth.users` e sessões, suspensão e eventos.

Nenhuma operação pega uma trava de um nível acima depois de uma de nível abaixo. Em `READ COMMITTED`, cada comando PL/pgSQL tira um *snapshot* novo, então as checagens feitas depois da trava enxergam o que a outra transação acabou de gravar e recusam com a mensagem amigável. Os índices únicos ficam como última garantia.

| Operação | Relatório | Célula | Membros | (célula, semana) |
|---|---|---|---|---|
| `delete_member` | — | — | alvo, cônjuge e quem exclui `FOR UPDATE` | — |
| `restore_member` | — | — | alvo `FOR UPDATE`; líder `FOR KEY SHARE` | — |
| `delete_cell` | — | `FOR UPDATE` | — | — |
| `restore_cell` | — | `FOR UPDATE` | líder, timóteo e anfitrião `FOR KEY SHARE` | — |
| `delete_cell_report` | `FOR UPDATE` | — | — | — |
| `restore_cell_report` | `FOR UPDATE` | — | — | sim |
| PATCH ou INSERT de membro (trigger) | — | — | a própria linha; líder e cônjuge `FOR KEY SHARE` | — |
| PATCH ou INSERT de célula (trigger) | — | a própria linha | as pessoas `FOR KEY SHARE` | — |
| INSERT ou PATCH de relatório (triggers) | a própria linha | `FOR KEY SHARE` | — | sim |
| Participantes (trigger) | `FOR KEY SHARE` | `FOR KEY SHARE` | o membro `FOR KEY SHARE` | — |

Os casos dos critérios (RN-20):
- **Duas exclusões do mesmo registro:** a segunda espera o `FOR UPDATE`, relê, encontra `deleted_at` preenchido e recebe `not_found_or_deleted`. A data e o autor ficam os da primeira.
- **Excluir Gil enquanto outra pessoa o escolhe como líder de Hugo** (ou cônjuge, timóteo, anfitrião, participante):
  - se a exclusão trava primeiro, o trigger do PATCH espera, relê Gil excluído e recusa (RN-06);
  - se o PATCH trava primeiro (`FOR KEY SHARE`), a exclusão espera e, ao contar os discípulos, encontra Hugo e recusa (RN-04).
- **Dois administradores que se excluem ao mesmo tempo (RN-03):** os dois travam {A, B} na mesma ordem. O segundo, depois da trava, já não tem permissão (`viewer_has` falso) e recebe 42501.
- **Restaurar o relatório R enquanto a célula recebe S na mesma semana:** os dois pegam a trava consultiva (célula, semana), e o segundo encontra o primeiro e recusa com a mensagem amigável. O índice único cobre qualquer caminho que não pegue a trava.
- **Restaurar a célula C enquanto o anfitrião dela é excluído:** a restauração trava o anfitrião com `FOR KEY SHARE`.
  - Se a exclusão do anfitrião vem antes, a restauração relê e recusa (`restore_person_deleted`).
  - Se vem depois, a exclusão encontra C não excluída e recusa (RN-04).
- **Restaurar Bruno enquanto o líder dele, Gil, é excluído:** a restauração trava Gil com `FOR KEY SHARE`.
  - Se a exclusão de Gil vem antes, Bruno volta sem líder.
  - Se vem depois, a exclusão de Gil encontra Bruno e recusa.

Casos que o Postgres resolve com *deadlock* detectado (40P01, "tente de novo"), aceitos por serem raros e pré-existentes (risco 3):
- uma exclusão concorrente com a troca do cônjuge do mesmo casal, porque o trigger de cônjuge trava na ordem "linha editada → cônjuge";
- o mesmo usuário excluindo alguém numa aba enquanto troca o próprio líder em outra;
- dois recálculos de totais na mesma subárvore, como já acontece hoje.

### Auditoria (RN-19)
As três funções de auditoria (`_trg_log_member_event`, `_trg_log_cell_event` e `_trg_log_cell_report_event`) ganham, **antes** do bloco que engole erros, um ramo que grava sem engolir erro (DT-16). Se a auditoria falhar, a exclusão ou a restauração falha junto (RN-20). Os demais eventos continuam como hoje.

| Situação | `action` | Descrição (pt-BR) | `metadata` |
|---|---|---|---|
| `deleted_at` passa de nulo a preenchido | `delete` | "Excluiu o membro {Nome}" · "Excluiu a célula de {Líder}" · "Excluiu o relatório da célula de {Líder}" | `op: "soft_delete"`; no membro, `spouse_id` de/para |
| `deleted_at` passa de preenchido a nulo | `restore` (valor novo de `event_action`, AQ-9) | "Restaurou o membro {Nome}" (célula, relatório) | no membro, `restored_without_leader`, `previous_leader_id` e `role_reset_to_default` (comparando `OLD` e `NEW`) |
| Cônjuge desfeito pela exclusão: o `spouse_id` do outro cadastro vira nulo, e o cônjuge antigo está excluído | `update` | "Vínculo de cônjuge desfeito pela exclusão de {Nome}" | `spouse_id` de/para; `reason: "spouse_deleted"` |
| Exclusão física (só a service role, fora da API) | `delete` | "Removeu …", como hoje | como hoje |

A autoria vem de `auth.uid()` em `_log_event`, como hoje. No front, `Events.tsx` ganha `restore: "Restauração"` em `ACTION_LABELS`, o que já põe a opção no filtro (UX-37).

### Contratos (RPC, Edge Functions, colunas novas)
**Colunas novas:** `deleted_at timestamptz` e `deleted_by uuid` em `members`, `cells` e `cell_reports`. Não aparecem nas views principais, porque elas já filtram os excluídos.

**Views:**
| View | Novidade |
|---|---|
| `members_view`, `cells_view` | sem excluídos; nenhuma coluna nova |
| `cell_reports_view` | sem relatórios excluídos; `cell_deleted` no fim |
| `cell_report_participants_view` | sem participantes de relatório excluído; `member_deleted` no fim |
| `members_deleted_view`, `cells_deleted_view`, `cell_reports_deleted_view` | novas ([Views de excluídos](#views-de-excluídos-migration-3-aq-3)) |

**RPCs** (todas com EXECUTE só para `authenticated`): `check_member_deletion`, `delete_member`, `restore_member`, `delete_cell`, `restore_cell`, `delete_cell_report`, `restore_cell_report`, `set_cell_report_participants` e `find_deleted_member_matches`. As assinaturas estão em [RPCs](#rpcs).

**Funções públicas novas:** `viewer_covers_role`, `cell_in_viewer_ministry`, `normalize_email` e `normalize_digits`, com EXECUTE só para `authenticated` (sem `anon`). O EXECUTE é necessário porque elas rodam com o papel de quem consulta ou grava: `cell_in_viewer_ministry` nas políticas de RLS, e as de normalização nos índices de `members` (lição do E1.08: funções chamadas por views e políticas precisam do grant).

**Edge Functions:**
- `get-user-email`: `.is('deleted_at', null)` na busca. A resposta não muda de formato.
- `create-user-admin`:
  - aceita `confirmDeletedMatches`;
  - responde 409 com `code` (`deleted_matches` ou `deleted_account_email`) e `matches`;
  - traduz os erros `app_error` do trigger de `members` (`deleted_member_chosen` e `deleted_account_email`) para 400 ou 409, com a mensagem do PO.

**Enum:** `event_action` ganha `restore`.

### Front
Segue o padrão do E1.08: os componentes cuidam da tela, o acesso a dados fica nos hooks e a regra pura fica em `src/lib/`.

- **Domínio puro, com testes Vitest e sem React nem Supabase:**
  - `src/lib/errors.ts`: `APP_ERROR_HINT`, `parseAppError` e `isNetworkError`;
  - `src/lib/deletion/codes.ts`: os códigos da tabela acima, como união de tipos;
  - `src/lib/deletion/texts.ts`: **todos** os textos deste spec, num módulo só;
  - `src/lib/deletion/blockers.ts`: monta os grupos da T3 a partir do detalhe (até 5 itens, "e mais N", "(inativo)" e "(inativa)", rótulo do papel e dia e hora);
  - `src/lib/members/deleted-matches.ts`: monta o diálogo da T9 a partir de `matches` e de "é administrador";
  - `src/lib/auth/session.ts`: textos do login e da sessão, `toLoginErrorMessage(error)` e `shouldEndSession(result)`.
- **Hooks:**
  - exclusão: `use-member-deletion.ts` (pré-checagem e exclusão), `use-cell-deletion.ts` e `use-cell-report-deletion.ts`;
  - listas de excluídos: `use-deleted-members-list.ts`, `use-deleted-cells-list.ts` e `use-deleted-cell-reports-list.ts`, no padrão dos hooks de lista do E1.08 (`useListSearchParams`, `range`, `count: 'exact'`);
  - restauração: `use-restore.ts`;
  - consulta do relatório: `use-cell-report.ts`.

  As mutações invalidam `["members"]`, `["cells"]`, `["cell_reports"]`, `["dashboard"]` e `["ministry-tree"]`, conforme a entidade.
- **Componentes compartilhados:**
  - `BlockedActionDialog` (P3) e `StatusBadge` (P6), reaproveitados por Escolas;
  - `ConfirmDeleteDialog` (T2, com as classes da P9);
  - `RowActionsMenu` (T1, P8).

  Os específicos: `MemberDeletionFlow` (T2 e T3), `RestoreMemberDialog` (T5), `CellReportSheet` (T7) e `DeletedMatchesDialog` (T9).
- **Páginas e rotas:**
  - `MembersDeleted.tsx`, `CellsDeleted.tsx` e `CellReportsDeleted.tsx`, em `/members/deleted`, `/cells/deleted` e `/cell-reports/deleted`;
  - item ativo no `AppSidebar` com `pathname === path || pathname.startsWith(path + "/")` (exceto `/`) e `aria-current="page"`.
- **Gravações com "0 linhas"** (DT-19):
  - `MemberForm`, `CellForm`, o atalho "Marcar como inativo" e a edição do `CellReportForm` passam a usar `.update(…).eq('id', id).select('id')`;
  - sem linha de volta, mostram "Este cadastro não existe ou já foi excluído. As alterações não foram salvas." (célula e relatório com os textos deles).
- **Permissões na tela:** `hasPermission` decide o que aparece, e o banco é a última palavra. A lista Excluídos e "Restaurar" exigem `manage_roles`; "Excluir" exige a permissão da entidade, e não aparece na linha do próprio usuário.
- **Sessão (AQ-8):**
  - o `QueryClient` ganha `QueryCache` e `MutationCache` com `onError`, que avisam o `AuthContext` em 42501;
  - o `AuthContext` relê o próprio cadastro e encerra a sessão se ele não vier;
  - o `signOut` pedido pelo usuário marca a origem, para não mostrar o aviso.

### Onde cada regra é imposta
| RN | Banco (constraint, RLS, trigger, RPC) | UI |
|---|---|---|
| RN-01 | Colunas e CHECK; RPCs `delete_*`; sem política e sem privilégio de DELETE e TRUNCATE (migration 5); FKs `NO ACTION`; participantes intocados na exclusão do relatório | Ações "Excluir" chamam as RPCs |
| RN-02 | `viewer_has('delete_*')` (42501) nas RPCs; visibilidade pela view principal (`not_found_or_deleted`, DA-10) | Ação só com a permissão da entidade |
| RN-03 | `_del_member_blockers` (`self_delete`, `role_above` via `viewer_covers_role`); trava de quem exclui (DT-21) | Sem "Excluir" na própria linha; recusas no diálogo de bloqueio |
| RN-04 | `_del_member_blockers` (discípulos e células não excluídos, ativos ou inativos), sob o `FOR UPDATE` do alvo | Pré-checagem (AQ-1) e T3 |
| RN-05 | `delete_member` zera `spouse_id`; `sync_spouse_relationship` limpa o outro lado | — |
| RN-06 | Triggers `enforce_member_links`, `enforce_cell_links`, `enforce_cell_report_rules` e `enforce_participant_rules`, com `FOR KEY SHARE`; RPCs de restauração | Seletores leem as views, que não têm excluídos; corrida tratada no campo (UX-30) |
| RN-07 | RLS de SELECT e UPDATE com `deleted_at IS NULL`; `WITH CHECK` impede marcar por PATCH; RPCs com `not_found_or_deleted` | "0 linhas" vira a mensagem do PO |
| RN-08 | Views e RPCs do E1.08 com o filtro; RLS; helpers de identidade; vínculo celular e `last_report_date` sem excluídos | — |
| RN-09 | Nomes por *join* nas views, sem filtro de excluído; views de excluídos; Auditoria; RN-18 | Exibe o nome, sem link para o cadastro |
| RN-10 | `refresh_member_stats_v2` ignora excluídos e dispara em `deleted_at` | — |
| RN-11 | `cell_reports_view` junta a tabela `cells`; `cell_deleted`; `cell_in_viewer_ministry` no RLS; trigger recusa a edição e a troca de participantes | Badge "Célula excluída", sem "Editar", "Ver relatório" |
| RN-12 | Índice único parcial; trigger de semana única sem excluídos; `last_report_date` sem excluídos | — |
| RN-13 | Trigger recusa retirar o excluído e incluir excluído novo; `set_cell_report_participants`; `member_deleted` | Linha só de leitura (T8) |
| RN-14 | Helpers de identidade, RLS e views; suspensão da conta e sessões apagadas (DT-13); `get-user-email` sem excluídos | Mensagem única no login; encerramento da sessão (AQ-8) |
| RN-15 | `manage_roles` nas views de excluídos e nas RPCs `restore_*`; `not_deleted` | Botão e rotas só com `manage_roles` |
| RN-16 | `restore_member`: função (b, DA-2), líder (d, DA-3), cônjuge (c), dados em uso (e), acesso (f) | T5 |
| RN-17 | `restore_cell` (pessoas excluídas); `restore_cell_report` (semana), com a trava consultiva e o índice | T6 |
| RN-18 | `find_deleted_member_matches`; `create-user-admin` com confirmação; trigger de INSERT para o e-mail da conta | T9 |
| RN-19 | Triggers de auditoria (`delete`, `restore`, cônjuge), sem engolir erro | Rótulo "Restauração" |
| RN-20 | Uma transação por RPC; travas na ordem global; índice único; suspensão da conta na mesma transação | "Tente de novo" na falha |

### Respostas às perguntas do UX (AQ-1 a AQ-11)
| # | Resposta |
|---|---|
| AQ-1 | **Sim.** `check_member_deletion(_member_id)`, só leitura, com `delete_member`. Devolve `can_delete` e, na recusa, o mesmo objeto da recusa de `delete_member`: o motivo (`self_delete`, `role_above`, `member_has_links` ou `not_found_or_deleted`), os totais e até 5 discípulos (`id`, `name`, `is_active`) e 5 células (`id`, `roles`, `leader_name`, `meeting_day`, `meeting_time`, `is_active`). |
| AQ-2 | **Sim.** 22023 com `HINT = 'app_error'` e `DETAIL` em JSON `{ code, … }`, com os códigos pedidos. A tabela está em [Formato dos erros](#formato-dos-erros-aq-2). |
| AQ-3 | **Sim.** As 3 views de excluídos, só para `manage_roles`, paginadas pelo PostgREST com `count: 'exact'`, com a mesma busca da lista principal e a ordem `deleted_at DESC, id`. Trazem os campos de antecipação: `leader_deleted`, `timothy_deleted`, `host_deleted`, `cell_deleted`, `week_taken`, `role_name`, `restore_role_name`, `role_reset_on_restore` e `has_account`. |
| AQ-4 | **Sim.** `cell_reports_view.cell_deleted`. |
| AQ-5 | **Sim.** `cell_report_participants_view.member_deleted`, e a gravação passa a preservar as participações pela `set_cell_report_participants`. |
| AQ-6 | **Sim.** O aviso é a resposta 409 da `create-user-admin` (`code: "deleted_matches"`), com `matches`. O nome, o id e a data vêm nulos do banco para quem não é administrador. "Cadastrar mesmo assim" é `confirmDeletedMatches: true`. O e-mail da conta é recusado em definitivo (`deleted_account_email`), inclusive por um INSERT direto. A restauração usa `restore_member`. |
| AQ-7 | **Sim.** `restore_member` devolve `restored_without_leader`, `previous_leader_name`, `role_reset_to_default` e `role_name`. Antes de restaurar, a lista já traz `has_account`, `leader_deleted`, `leader_name` e `restore_role_name`. |
| AQ-8 | **Sim**, como sugerido, sem nenhuma consulta nova: a tela relê o próprio cadastro na `members_view` em toda recusa 42501, no "0 linhas" do próprio cadastro, no `SIGNED_OUT` não pedido e na volta do foco. A suspensão da conta **derruba a renovação do token na hora**, porque as sessões são apagadas e a conta é banida. O token de acesso já emitido continua válido até expirar, mas o banco o ignora. Rede e 5xx nunca encerram a sessão. |
| AQ-9 | `events.action = 'restore'`, um valor novo do enum `event_action`. |
| AQ-10 | **Confirmado, com uma ressalva.** A `get-user-email` responde `{ "email": null }` igual para inexistente e para excluído, com a mesma consulta. O login por e-mail de um excluído responde `invalid_credentials`, como uma conta inexistente e sem bcrypt, então no mesmo tempo (DT-13). A ressalva é a diferença de tempo que o Supabase Auth já tem entre "senha errada" e "conta inexistente", para qualquer conta; ela só some com a `sign-in` do E1.04. |
| AQ-11 | **Confirmado.** O atalho é o mesmo PATCH de `is_active` de hoje, com `edit_member` ou `edit_cell`. Valem as regras de escrita do E1.03, do E1.08 e, depois, do E2.02, e a Auditoria registra uma alteração. Sem RPC nova. |

### Decisões técnicas
| # | Decisão | Motivo |
|---|---|---|
| DT-01 | `deleted_at timestamptz` e `deleted_by uuid → members(id)`, preenchido com `viewer_member_id()`, nas três tabelas, com `CHECK (deleted_by IS NULL OR deleted_at IS NOT NULL)`. Nulo quando vem da service role ou do legado. | Mesma convenção da DT-31 de Escolas. O nome do autor sai por *join*. |
| DT-02 | Excluir e restaurar só por RPC `SECURITY DEFINER`. Sem política de DELETE e com `REVOKE` de DELETE e TRUNCATE nas três tabelas. | DEL-01. O TRUNCATE ignora o RLS e hoje está concedido a `anon` e `authenticated` pelos privilégios padrão. |
| DT-03 | `leader_id`, `spouse_id`, `cell_reports.cell_id` e as duas FKs de participantes passam a `NO ACTION`. `role_id` continua `SET NULL`. | Seção 5.3. As funções são configuração, e a RN-16 (a) conta com a limpeza. |
| DT-04 | O filtro de excluídos fica em três níveis: entidade (views, políticas), identidade de quem consulta (helpers) e, sem filtro, a árvore (`get_ministry_root` e a descida de `viewer_ministry_member_ids`). | Corta o acesso do excluído (RN-14) e mantém o escopo do histórico de células e relatórios de excluídos. |
| DT-05 | Nas políticas de SELECT de `cell_reports` e de participantes, o `EXISTS` em `cells` sob RLS (ramo `view_own_ministry`) dá lugar a `cell_in_viewer_ministry(cell_id)`, *definer*, com a mesma regra. Participantes ganham o filtro do relatório não excluído. | Senão, o relatório de célula excluída sumiria para o ministério (RN-11) e a `cell_reports_view` deixaria de bater com o RLS. Delegar à view quebraria o `INSERT … RETURNING`. |
| DT-06 | Excluídos em três views próprias, só para `manage_roles`, com o mesmo escopo das principais. As principais só ganham o filtro e as colunas `cell_deleted` e `member_deleted`, no fim. | A `members_view` não muda o `WHERE` de escopo; a UXD-1 pede rotas próprias. |
| DT-07 | Os índices de lista do E1.08 viram parciais (`WHERE deleted_at IS NULL`) com o mesmo nome. Entram também `(deleted_at DESC, id) WHERE deleted_at IS NOT NULL` por tabela, o índice único `(cell_id, week_start(date)) WHERE deleted_at IS NULL` e o índice do e-mail da conta de excluídos. | Os planos das listas continuam usando o índice de ordenação. O índice único antecipa a parte da REL-03 que a RN-17 e a RN-20 exigem. |
| DT-08 | A RN-06 é imposta por triggers `BEFORE`, que travam a linha referenciada com `FOR KEY SHARE` e conferem `deleted_at`. As RPCs de exclusão usam `FOR UPDATE`, que conflita com ela. | "Escolher" e "excluir" a mesma pessoa ou célula nunca passam juntos (RN-20), em qualquer caminho de escrita. |
| DT-09 | Ordem global das travas: relatório → célula → membros (alvo, cônjuge e quem exclui, em ordem de id) → (célula, semana) → linhas dos triggers. | Sem ciclo de espera entre as operações deste passo. |
| DT-10 | Erros: 42501 só para permissão; 22023 + `HINT 'app_error'` + `DETAIL` JSON para as regras, com as mensagens do PO. Um parser só no front. | AQ-2. Segue o formato de Escolas (22023, `HINT` e `DETAIL` em JSON), com um item só em vez de uma lista. |
| DT-11 | A pré-checagem e a recusa da exclusão vêm da mesma função interna (`_del_member_blockers`), com o mesmo JSON. | A tela e o servidor nunca discordam (UXD-2). |
| DT-12 | "Cobrir a função" (RN-03 e RN-16 b) = permissões da função ⊆ permissões de quem age (`viewer_covers_role`), sem exigir `assign_role`. A `can_assign_role` passa a usar a mesma função. | Exigir `assign_role` impediria o Líder de excluir qualquer membro com função, contra o critério da RN-02. A regra fica num lugar só. |
| DT-13 | **(revisar no PR)** A suspensão da conta acontece na mesma transação, e não pela Admin API depois do *commit*: a senha vai para `private.member_access_suspensions`, `encrypted_password` fica vazio, `banned_until` vai 100 anos à frente e as sessões são apagadas. A restauração devolve tudo. | RN-20 sem compensação. O login de excluído fica igual ao de inexistente (AQ-10), o que só com o banimento não acontece. O corte de acesso não depende disso (DT-04). |
| DT-14 | A `get-user-email` ignora excluídos e responde `{ email: null }` como para inexistente. | AQ-10, até a `sign-in` do E1.04. |
| DT-15 | Os participantes são gravados pela RPC mínima `set_cell_report_participants`, `SECURITY INVOKER`, que recebe o conjunto final (com os excluídos) e grava só a diferença. O trigger ignora o par que já existe. | A RN-13 é deste passo. Fica atômico sem duplicar regra de permissão; o E2.11 absorve a RPC. |
| DT-16 | A auditoria continua nos triggers. Exclusão, restauração e cônjuge desfeito são gravados num ramo que não engole erro. `restore` entra em `event_action`, numa migration separada. | RN-19 e RN-20, valendo para qualquer caminho de escrita. |
| DT-17 | `normalize_email` e `normalize_digits` são a única normalização de e-mail, celular e CPF. | RN-16 (e), RN-18 e os índices do E2.04 comparam igual. |
| DT-18 | RN-18: `find_deleted_member_matches`, mais a `create-user-admin` com `confirmDeletedMatches`, mais o trigger de INSERT para o e-mail da conta. | O aviso é parte do salvar (P-DEL-22). A recusa definitiva vale pela API. |
| DT-19 | A edição de um registro excluído por PATCH direto volta com 0 linhas e sem erro. A tela pede `select('id')` e traduz. | O RLS não revela registros escondidos. |
| DT-20 | A tela encerra a sessão quando o próprio cadastro não volta da `members_view` (depois de um 42501, de "0 linhas", do `SIGNED_OUT` não pedido ou da volta do foco). Falha de rede nunca encerra. | AQ-8, sem endpoint novo. |
| DT-21 | `delete_member` trava também quem exclui e confere a permissão de novo depois da trava. | RN-03: sempre sobra um administrador, mesmo com exclusões cruzadas ao mesmo tempo. |
| DT-22 | O GRANT por coluna de `deleted_at` e `deleted_by` em `members` só é feito se o PR 5 do E1.08 já estiver aplicado. Se o E2.01 vier antes, o PR 5 inclui as duas na lista dele. | Risco 4 do E1.08, nas duas ordens. |
| DT-23 | Trava consultiva (célula, semana) no trigger de semana única e em `restore_cell_report`. O índice único é a garantia. | Mensagem amigável também na corrida (RN-17, RN-20). |
| DT-24 | `refresh_member_stats_v2` ignora membros e células excluídos, dispara em `UPDATE OF deleted_at` e ganha `SET search_path`. | RN-10 na mesma transação. |
| DT-25 | `roles` e `role_permissions` só são lidas por quem tem cadastro não excluído, e `log_auth_event` não grava para excluído. | DA-9. |
| DT-26 | Seis PRs. O PR 1 é só banco e neutro. A retirada das políticas de DELETE vai no PR 2, junto com o front que usa as RPCs. | Cada PR vai ao ar sozinho, com uma janela de minutos só no PR 2 ([Implantação](#implantação)). |
| DT-27 | Os triggers da RN-06, RN-11, RN-13 e RN-18 valem para todos os papéis, inclusive a service role. | Invariantes valem sempre. Só a carga com `replica` passa por fora, e a reconciliação confere (E4.09). |
| DT-28 | Restaurar não confere a semana atual nem a data. Os triggers de data não disparam, porque a restauração não mexe em `date`. | RN-17. |

### Riscos (concorrência, escala, segurança)
1. **Escrita no schema do Auth (DT-13).** A suspensão grava em `auth.users` (`encrypted_password`, `banned_until`), `auth.sessions` e `auth.refresh_tokens`, que são do GoTrue.
   - Se o Supabase mudar essas colunas ou tirar o privilégio do `postgres`, a exclusão de quem tem conta falha inteira, por causa da RN-20. Nada fica pela metade.
   - Mitigações:
     - as duas funções `_del_*_access` são o único ponto que toca o Auth;
     - um pgTAP confere a suspensão e a restauração;
     - o *smoke* e2e de login roda a cada deploy;
     - a tarefa 1 confere o privilégio em produção antes de implementar.
   - **Plano B:** uma Edge Function chamada pela tela depois da RPC, com `ban_duration` e `password` aleatória pela Admin API, com nova tentativa. Ela aceita a diferença `user_banned` até o E1.04 e perde a senha antiga (a RN-16 f passaria a pedir redefinição). Só se a tarefa 1 falhar, e com o aceite do usuário.
2. **Desvio entre views e RLS.** Agora são três lugares por entidade (view principal, view de excluídos e política).
   - Mitigação: paridade por persona com excluídos na massa.
   - A view de excluídos usa o mesmo predicado da principal, e o teste confere que, para cada persona, os ids da principal mais os da de excluídos (para `manage_roles`) cobrem os registros do escopo.
3. **Deadlocks residuais** (cônjuge, o mesmo usuário em duas abas, totais na mesma subárvore). O Postgres detecta e aborta um deles com 40P01, e a tela mostra "tente de novo". São pré-existentes ou raros. O E2.06 pode ordenar as travas dos totais.
4. **Custo da exclusão e da restauração de membro.** O recálculo de totais percorre a subárvore de cada ancestral, até a igreja inteira para o pastor. É o mesmo custo de hoje ao trocar um líder. Meta: menos de 1 s no volume de referência; o E2.06 otimiza.
5. **Unicidade sem índice até o E2.04.** A RN-16 (e) e a RN-18 conferem antes de gravar. Uma corrida rara pode gerar duplicidade entre não excluídos até o E2.04, que fecha com os índices. A RPC já traduz o `unique_violation`.
6. **O índice único da semana não é criado se houver duplicatas.** A migration falha cedo, com a lista, e nada muda. A tarefa 1 confere em produção antes.
7. **Janela do PR 2.** Entre o "Deploy: banco" e o promote, a exclusão pelo front antigo recebe 42501 e nada é apagado. O promote é feito logo em seguida.
8. **Service role e carga.**
   - Um `UPDATE … SET deleted_at` feito direto pela service role não suspende a conta nem passa pelas regras: o único caminho suportado é a RPC.
   - A carga do E4 usa `replica`, que desliga os triggers. A reconciliação (E4.09) confere a RN-06 com uma consulta.
   - Excluídos do legado não recebem conta (6.2).
9. **Enumeração pela RN-18.** Quem tem `create_member` descobre se existe um excluído com um celular ou CPF. É assim por desenho, sem o nome para quem não é administrador e só ao salvar (P-DEL-22). Não há limite de tentativas até o E1.04.
10. **Token de acesso ainda válido** por até 1 hora depois da exclusão. O banco o ignora (DT-04), e a tela encerra a sessão (DT-20).
11. **Trava por coluna do E1.08 (PR 5).** Ver a DT-22. Fica proibido `select('*')` em `members`; este passo não lê a tabela.
12. **Alerta do Supabase.** O *advisor* acusa `security_definer_view` nas 3 views novas. É esperado; não trocar para `security_invoker`.
13. **Recriação de views.** Só acrescentar colunas no fim. A `cell_report_participants_view` depende da `cell_reports_view`.
14. **Volume.**
   - Medir no volume de referência do E1.08 (20 mil membros, 1.500 células, 100 mil relatórios e 800 mil participações), com 10% de membros e 5% de relatórios excluídos.
   - Metas, iguais às do E1.08:
     - página de lista com contagem abaixo de 300 ms;
     - `dashboard_summary` abaixo de 800 ms;
     - lista de excluídos abaixo de 300 ms;
     - `check_member_deletion` abaixo de 100 ms.
   - O `EXPLAIN` das listas padrão precisa mostrar os índices parciais.
   - Impacto esperado no `EXPLAIN` das listas do E1.08:
     - o filtro novo fica dentro da view, antes da barreira, então o predicado `deleted_at IS NULL` implica o do índice parcial, e o *planner* continua usando o índice de ordenação (`members_name_id_idx`, `cell_reports_date_id_idx`);
     - `last_report_date` e a contagem de pendentes usam `cell_reports_cell_id_date_idx` parcial;
     - o vínculo celular ganha um filtro a mais nas buscas por índice que já faz;
     - a contagem exata continua varrendo as linhas visíveis, como hoje.
15. **Schema `private`.** Precisa ficar fora dos *Exposed schemas* da API; a tarefa 1 confere.

### Dependências e impactos em outros passos
| Passo | Relação |
|---|---|
| E1.08 PRs 1 a 4 | **Pré-requisito.** O E2.01 entra sobre as views, as RPCs do dashboard, a `ministry_tree_nodes`, os seletores assíncronos e o `CellReportForm` com seletores no servidor. A implementação começa depois do merge do PR 4. |
| E1.08 PR 5 | Nas duas ordens: ver a DT-22. **Se o PR 5 vier depois, a lista do GRANT dele inclui `deleted_at` e `deleted_by`.** |
| E1.04 (`sign-in`) | A função de login busca só não excluídos e responde igual para excluído, inexistente, senha errada e conta suspensa. Ela substitui a `get-user-email`. |
| E2.02 (escopo) | Ajusta o escopo nos mesmos pontos únicos: os `WHERE` das views (principais e de excluídos), as políticas e a visibilidade nas RPCs (DA-10). **Não delegar o SELECT de `cell_reports` à view** (leitura técnica 6). Deve decidir se `view_own_reports` passa a valer de fato. |
| E2.03 (senha) | A `change-member-password` recusa alvo excluído lendo a `members_view` (RN-07). O `user_has_permission` já recusa quem chama se estiver excluído. |
| E2.04 (unicidade) | Índices únicos parciais `WHERE deleted_at IS NULL` sobre `normalize_email(email)`, `normalize_digits(mobile_whatsapp)` e `normalize_digits(cpf)`, que a `restore_member` já trata. Pode precisar ajustar a normalização do celular (DDI); se ajustar, ajusta a função, que é única. |
| E2.05 (autoria) | `created_by` e `updated_by` devem seguir a convenção de `deleted_by` (membro, via `viewer_member_id()`). |
| E2.06 (hierarquia) | Recebe a `refresh_member_stats_v2` já sem excluídos. O caminho materializado precisa ignorar excluídos também. |
| E2.11 (relatório) | Absorve a `set_cell_report_participants`. Reaproveita `cell_reports_cell_week_key` e `_del_lock_cell_week`, e mantém os triggers da RN-06, RN-11 e RN-13 como barreira. As colunas de snapshot (REL-09) **podem** apontar para membros excluídos: o trigger da RN-06 não confere essas colunas. |
| E4.02 (`legacy_id`, snapshot) | As colunas `deleted_at` e `deleted_by` já existem. Na carga, `deleted_by` fica nulo, e nenhum excluído do legado recebe suspensão, porque não tem conta. |
| E4.04 (saneamento) | Listar também os membros inativos com líder excluído e as células não excluídas com pessoa excluída (Impactos do PO). |
| Escolas | Coerente com a DT-31 e a ESC-33: `members.deleted_at`, `deleted_by → members(id)` e `viewer_member_id()` sem excluídos. Escolas pode adotar `app_error` para os erros de um item só. Os componentes P3 e P6 nascem aqui. |

### Pontos de extensão
| Futuro | Onde muda |
|---|---|
| Exclusão lógica em entidades novas (Consolidação, Escolas) | Mesmo molde: colunas, `CHECK`, índices parciais, RPCs `delete_*`/`restore_*` com `_del_raise`, view de excluídos com `manage_roles` e as rotas da P7 |
| Escopo de escrita (E2.02) | A visibilidade de cada RPC (DA-10), num lugar só por entidade |
| Exclusão e restauração em lote | Novas RPCs com o mesmo `_del_member_blockers` por item, e as travas em ordem de id |
| Anonimização (LGPD) | Processo à parte, com a service role e os triggers desligados de propósito. As FKs `NO ACTION` impedem apagar histórico por engano. |

### Implantação
| PR | Ordem | Efeito no front em produção |
|---|---|---|
| 1 (banco) | merge → "Deploy: banco" (migrations 1 a 4 e `get-user-email`) | Nenhum: não há excluídos. Uma exclusão física pelo front antigo que apagaria em cascata passa a falhar (FKs `NO ACTION`), sem apagar nada. |
| 2 (exclusão) | merge → "Deploy: banco" (migration 5) → **promote em seguida** | Entre os dois passos, a exclusão pelo front antigo recebe 42501 (risco 7). Depois do promote, a exclusão é lógica. |
| 3, 4 e 6 (só front) | merge → promote | — |
| 5 (RN-18) | merge → "Deploy: banco" (publica a `create-user-admin`) → promote | Entre os dois, o front em produção recebe o 409 num cadastro com dado de excluído e mostra o texto do `error`, sem "Cadastrar mesmo assim". A janela é de minutos. |

- O promote já recusa rodar com migration pendente.
- **Rollback:** o front volta pelo promote do commit anterior. As migrations do PR 1 podem ficar, porque só filtram o que não existe. Se a migration 5 precisar voltar, uma migration nova recria as políticas de DELETE (a exclusão física não volta a apagar em cascata, por causa da DT-03).

### Verificações obrigatórias (para o QA)
**pgTAP** (`supabase/tests/database/e201_*.test.sql`, autocontido, com `ROLLBACK`). A massa tem excluídos de cada tipo, casal, inativos, pastor, célula de excluído e relatório de célula excluída.

- **Grants e estrutura:**
  - views novas só com SELECT para `authenticated` e dono `postgres`;
  - RPCs sem EXECUTE para `anon`, e `_del_*` sem EXECUTE para `authenticated`;
  - `private.member_access_suspensions` sem privilégio para `anon`, `authenticated` e `service_role`;
  - depois da migration 5: DELETE e TRUNCATE em `members`, `cells` e `cell_reports` dão 42501, inclusive para o administrador (RN-01);
  - as FKs são `NO ACTION`.
- **RN-01:** a marcação guarda data e autor; o relatório excluído e restaurado volta com os mesmos 8 participantes; um PATCH tentando marcar `deleted_at` dá 42501.
- **RN-02 e DA-10:** sem a permissão, cada RPC dá 42501; fora do escopo, `not_found_or_deleted`; com `delete_cell` e sem `delete_cell_report`, 42501.
- **RN-03:** próprio cadastro; função não coberta; um administrador exclui outro.
- **RN-04:** o caso de Gil, com 4 discípulos (um inativo) e 2 células (uma inativa), confere o JSON inteiro; 7 discípulos dão 5 nomes e `disciples_total = 7`; discípulo excluído não bloqueia; pastor com G12 é recusado; Nina é aceita; a pré-checagem devolve o mesmo objeto que a recusa.
- **RN-05:** os dois cadastros ficam sem cônjuge; a restauração não refaz o vínculo; o ranking e a árvore mostram Otávio sozinho.
- **RN-06:** líder, cônjuge, timóteo, anfitrião, participante novo e célula do relatório excluídos são recusados com `deleted_member_chosen` ou `cell_deleted`. Depois de toda a sequência, a consulta de invariantes devolve zero linhas.
- **RN-07:** PATCH em registro excluído volta com 0 linhas e não muda nada; excluir de novo dá `not_found_or_deleted` com a data e o autor originais.
- **RN-08:** os números do critério (98, 19, 89, 9 e as evangelísticas); Sara fora de novos membros e da busca; o vínculo de Tiago e de Ubiratan; `last_report_date` e `cells_pending` sem relatório excluído; DA-1.
- **RN-09:** o nome do participante excluído na `cell_report_participants_view`; os eventos de Sara na Auditoria.
- **RN-10:** o caso de Vera, Wagner e Xavier, nos dois sentidos; célula masculina; inativo não muda os totais.
- **RN-11:** os 10 relatórios continuam com `cell_deleted`; a soma da semana conta o relatório e os 6 visitantes; a célula sai de pendentes e da contagem por tipo; editar e mexer nos participantes dá `report_cell_deleted`; excluir o relatório é aceito; um relatório novo dá `cell_deleted`; o relatório continua visível para um usuário de ministério (DT-05).
- **RN-12:** o índice parcial libera a semana; a célula volta a pendente.
- **RN-13:** a edição preserva Sara; retirar Sara pela RPC ou por DELETE direto dá `deleted_participant_removal`; incluir excluído novo é recusado.
- **RN-14:**
  - depois da exclusão, com o JWT de Ana: as views voltam vazias, `roles` volta vazia, `delete_member` de outro dá 42501, o INSERT dá 42501 e o PATCH do próprio cadastro volta com 0 linhas;
  - `auth.users` fica com a senha vazia e banido, e as sessões somem;
  - na restauração, o hash volta igual ao original.
- **RN-15:** listas, ordem e escopo para `manage_roles`; sem a permissão, vazias e com 42501 na restauração; restaurar quem não está excluído dá `not_deleted`.
- **RN-16:** sem líder (DA-3); dado em uso; função apagada volta com a padrão (DA-2); `restore_role_above`; inativo volta inativo; nível e totais recalculados.
- **RN-17:** pessoa excluída (DA-5); semana ocupada, também numa semana passada; relatório de semana passada restaurado no domingo seguinte; relatório de célula excluída restaurado continua só para consulta.
- **RN-18:** e-mail da conta, celular e CPF; o nome vem nulo para quem não é administrador; o INSERT direto com o e-mail da conta é recusado.
- **RN-19:** os eventos `delete`, `restore` e do cônjuge desfeito. Se a auditoria falhar (por exemplo, com um `CHECK` que recusa a inserção em `events`, criado dentro do teste), a exclusão inteira volta atrás.
- **Paridade do E1.08 com excluídos:** para cada persona P1 a P5, os ids de cada view são iguais aos da tabela sob RLS, e as views de excluídos usam o mesmo escopo. Inclui `view_own_ministry` com relatório de célula excluída.

**Concorrência** (script com duas conexões e `pg_sleep` para forçar as intercalações, como em Escolas):
- duas exclusões do mesmo membro;
- exclusão de Gil × Gil como líder de Hugo, nas duas ordens;
- dois administradores que se excluem ao mesmo tempo;
- restauração de relatório × relatório novo na mesma semana;
- restauração de célula × exclusão do anfitrião.

Cada cenário termina num estado válido, com a mensagem amigável ou 40P01 nos casos aceitos.

**Volume:** as metas do risco 14, com o `EXPLAIN` anexado ao PR.

**Vitest:** `parseAppError`, `blockers.ts` (limites de 5, "e mais N", marcações, papéis, plural), `deleted-matches.ts` (administrador e não administrador, e-mail da conta, cadastros diferentes) e `session.ts` (rede × credencial, `shouldEndSession`).

**Playwright:** os critérios de UX de cada PR, mais:
- o *smoke* de login a cada PR;
- a exclusão de um membro com a sessão dele aberta em outro contexto (UX-36);
- o modo *offline*, que não encerra a sessão.

## Tarefas
_Seção do `architect`._

Seis PRs no `mci-connect`. **Tudo começa depois do merge do PR 4 do E1.08.**
- Dentro de cada PR, o banco vai primeiro, e os tipos são regenerados antes do front.
- Cada desenvolvedor aciona o `code-reviewer` ao terminar a sua tarefa; esse passo não aparece na tabela.
- Na coluna RNs, os números são das regras deste spec. Na coluna UX, os dos critérios `UX-`.

| # | Responsável | Descrição | Arquivos | RNs | UX | Depende de |
|---|---|---|---|---|---|---|
| **PR 1: banco (neutro para o usuário)** | | | | | | |
| 1 | backend-developer | Conferências **só de leitura** em produção, com autorização do usuário: (a) privilégios do `postgres` em `auth.users` (UPDATE), `auth.sessions` e `auth.refresh_tokens` (DELETE); (b) relatórios não excluídos duplicados por célula e semana; (c) `private` fora dos *Exposed schemas*. Se (a) falhar, parar e voltar ao `architect` (plano B do risco 1). | — | 14, 20 | — | merge do PR 4 do E1.08 |
| 2 | backend-developer | Migrations 1 e 2: `restore` em `event_action`; colunas, CHECKs e FKs; `normalize_email` e `normalize_digits`; índices (parciais com o mesmo nome, de excluídos, único da semana com a checagem prévia, e-mail da conta); schema `private` e a tabela de suspensões; GRANT por coluna condicionado ao PR 5. | `supabase/migrations/<ts>_e201_01_enum.sql`, `supabase/migrations/<ts>_e201_02_schema.sql` | 01, 06, 12, 14, 16, 17, 18 | — | 1 |
| 3 | backend-developer | Migration 3 (leitura): helpers de identidade e escopo, `viewer_covers_role`, `cell_in_viewer_ministry`, `member_names`, `is_leader_of_visible_member`; views do E1.08 com o filtro e `cell_deleted`/`member_deleted`; as 3 views de excluídos; políticas de SELECT, UPDATE e INSERT das quatro tabelas, e de SELECT de `roles` e `role_permissions`; `log_auth_event`; grants. | `supabase/migrations/<ts>_e201_03_read.sql` | 02, 07, 08, 09, 11, 13, 14, 15 | dados de UX-14, 15, 25, 29 | 2 |
| 4 | backend-developer | Migration 4 (escrita): funções `_del_*`; triggers da RN-06, RN-11, RN-13 e RN-18, semana única, totais e auditoria; as 9 RPCs; grants; ordem das travas no cabeçalho. `get-user-email` ignorando excluídos. Regenerar o `types.ts`. | `supabase/migrations/<ts>_e201_04_write.sql`, `supabase/functions/get-user-email/index.ts`, `src/integrations/supabase/types.ts` | 01 a 07, 10 a 20 | — | 3 |
| 5 | qa | pgTAP de todas as RNs no banco, paridade do E1.08 com excluídos, grants, concorrência (5 cenários) e volume com `EXPLAIN` ([Verificações](#verificações-obrigatórias-para-o-qa)). | `supabase/tests/database/e201_*.test.sql`, script de concorrência | 01 a 20 | — | 4 (escreve em paralelo com 3 e 4, a partir dos contratos) |
| **PR 2: exclusão nas telas** | | | | | | |
| 6 | backend-developer | Migration 5: retirar as políticas de DELETE de `members`, `cells` e `cell_reports`; `REVOKE DELETE, TRUNCATE` nas três e `TRUNCATE` em participantes. pgTAP do DELETE direto. | `supabase/migrations/<ts>_e201_05_no_physical_delete.sql`, `supabase/tests/database/e201_no_physical_delete.test.sql` | 01 | — | 4 (PR 1 mergeado) |
| 7 | frontend-developer | Fundação e Membros:<br>- `parseAppError` e `isNetworkError`; `src/lib/deletion/{codes,texts,blockers}.ts`, com Vitest;<br>- `BlockedActionDialog` (P3), `StatusBadge` (P6), `ConfirmDeleteDialog` (T2, P9) e `RowActionsMenu` (T1, P8);<br>- `use-member-deletion`;<br>- em Membros: "⋯" no celular, pré-checagem (UXD-2), bloqueio (T3) com itens que abrem o cadastro, atalho "Marcar como inativo", toasts e "0 linhas" no `MemberForm`. | `src/lib/errors.ts`, `src/lib/deletion/*`, `src/components/{BlockedActionDialog,StatusBadge,ConfirmDeleteDialog,RowActionsMenu,MemberDeletionFlow}.tsx`, `src/hooks/use-member-deletion.ts`, `src/pages/Members.tsx`, `src/components/MemberForm.tsx` | 02, 03, 04, 07, 08 | 01 a 12, 24, 38, 39, 40 | 4 (tipos do PR 1); vai no mesmo PR da 6 |
| 8 | frontend-developer | Células e Relatórios:<br>- exclusão (T1, T2) com `use-cell-deletion` e `use-cell-report-deletion`, e "Marcar como inativa" na célula;<br>- badge "Célula excluída" e sem "Editar" nas linhas de célula excluída;<br>- `CellReportForm`: grava com `set_cell_report_participants`; participantes excluídos fora do seletor, na linha só de leitura (T8); corrida no campo (UX-30); recusa da edição num `Alert` (UX-28);<br>- "0 linhas" no `CellForm` e no `CellReportForm`. | `src/hooks/use-cell-deletion.ts`, `src/hooks/use-cell-report-deletion.ts`, `src/pages/{Cells,CellReports}.tsx`, `src/components/{CellForm,CellReportForm}.tsx`, `src/lib/cell-reports/participants.ts` | 06, 07, 11, 12, 13 | 01 a 07, 25, 28, 29, 30 | 7 |
| 9 | ux-designer | Revisão de UI do PR 2 (T1, T2, T3, T8, badge da T7, P3, P6, P8, P9) em 320, 360 e 1280 px, nos temas claro e escuro. | — | — | 01 a 12, 25, 28 a 30, 38 a 40 | 8 |
| 10 | qa | Vitest (`blockers`, `parseAppError`, participantes); testes de componente (UX-02, 03, 04, 06, 08, 09, 11, 24); Playwright (RN-02, 03, 04, 06, 11, 12, 13; UX-01, 05, 07, 10, 12, 29) e *smoke* de login. | `src/**/*.test.ts(x)`, `e2e/exclusao-*.spec.ts` | 02 a 04, 06, 08, 11 a 13 | ver descrição | 8 |
| **PR 3: Excluídos e restauração** | | | | | | |
| 11 | frontend-developer | Rotas `/members/deleted`, `/cells/deleted` e `/cell-reports/deleted`, com permissão; item ativo e `aria-current` no `AppSidebar`; botão "Excluídos"/"Excluídas" nos cabeçalhos; hooks das listas e `use-restore`; páginas (T4) com avisos antecipados; confirmação e resultado da restauração de membro (T5); restauração de célula e relatório com as recusas (T6); "Restauração" em `Events.tsx`. | `src/App.tsx`, `src/components/AppSidebar.tsx`, `src/pages/{MembersDeleted,CellsDeleted,CellReportsDeleted,Members,Cells,CellReports,Events}.tsx`, `src/hooks/use-deleted-*-list.ts`, `src/hooks/use-restore.ts`, `src/components/{RestoreMemberDialog,DeletedListLayout}.tsx` | 09, 15, 16, 17, 19 | 13 a 24, 37 | PR 2 |
| 12 | ux-designer | Revisão de UI do PR 3 (T4 a T6, P7). | — | — | 13 a 24, 37, 38, 40 | 11 |
| 13 | qa | Testes de componente (UX-15 com fuso alterado, 18, 20, 23, 24, 37); Playwright (RN-15, 16, 17, 19; UX-13, 14, 16, 17, 19, 21, 22). | `src/**/*.test.tsx`, `e2e/excluidos-*.spec.ts` | 15 a 17, 19 | ver descrição | 11 |
| **PR 4: consulta do relatório de célula excluída** | | | | | | |
| 14 | frontend-developer | `CellReportSheet` (T7) com `?report=<id>`, só para relatório de célula excluída e com `edit_cell_report`; `use-cell-report`; "Ver relatório" no card e na tabela; "Ver células excluídas" para o administrador. | `src/components/CellReportSheet.tsx`, `src/hooks/use-cell-report.ts`, `src/pages/CellReports.tsx` | 09, 11, 13 | 26, 27 | PR 2 |
| 15 | ux-designer | Revisão de UI do PR 4 (T7). | — | — | 26, 27, 38 | 14 |
| 16 | qa | Playwright (RN-11 consulta; UX-26 com AD, LE com `edit_cell_report` e MB; UX-27). | `e2e/relatorio-celula-excluida.spec.ts` | 11 | 26, 27 | 14 |
| **PR 5: cadastro com dados de excluído** | | | | | | |
| 17 | backend-developer | `create-user-admin`: `confirmDeletedMatches`, chamada a `find_deleted_member_matches` com a sessão de quem chamou (antes do `createUser`), respostas 409 com `code` e `matches`, e tradução dos erros `app_error` do trigger de `members`. | `supabase/functions/create-user-admin/index.ts` | 18 | — | PR 1 |
| 18 | frontend-developer | `src/lib/members/deleted-matches.ts` (Vitest); `DeletedMatchesDialog` (T9) para administrador e demais; erro no campo E-mail para o e-mail da conta; "Cadastrar mesmo assim" com `confirmDeletedMatches`; "Restaurar {Nome}" com `use-restore` e troca do formulário para edição com o `Alert`. | `src/lib/members/deleted-matches.ts`, `src/components/{DeletedMatchesDialog,MemberForm}.tsx` | 16, 18 | 31 a 34 | 11, 17 |
| 19 | ux-designer | Revisão de UI do PR 5 (T9). | — | — | 31 a 34, 38 | 18 |
| 20 | qa | Vitest (`deleted-matches`); Playwright (RN-18 com AD, LE e CM; UX-31 a 34); teste da `create-user-admin` com o 409 e a confirmação. | `e2e/cadastro-excluido.spec.ts` | 18 | 31 a 34 | 18 |
| **PR 6: login e sessão** | | | | | | |
| 21 | frontend-developer | `src/lib/auth/session.ts` (Vitest); `Login.tsx` com a mensagem única no `Alert` (T10); `AuthContext` com a releitura do próprio cadastro, o `SIGNED_OUT` não pedido, a volta do foco e o aviso no login; `QueryCache` e `MutationCache` com `onError`. | `src/lib/auth/session.ts`, `src/pages/Login.tsx`, `src/contexts/AuthContext.tsx`, `src/App.tsx` | 14 | 35, 36 | PR 1 (roda em paralelo com o PR 2) |
| 22 | ux-designer | Revisão de UI do PR 6 (T10). | — | — | 35, 36, 38 | 21 |
| 23 | qa | Playwright: RN-14 (login por e-mail, CPF e celular; recuperação; sessão aberta excluída em outro contexto; restauração com a mesma senha); UX-35, UX-36 com o modo *offline*. | `e2e/acesso-excluido.spec.ts` | 14 | 35, 36 | 21 |
| **Fechamento** | | | | | | |
| 24 | architect | Revisão final dos 6 PRs. Atualizar o `CLAUDE.md` (estado atual e armadilhas, ver o relatório do `architect`). O aceite da fase 2 é do `product-owner`. | `CLAUDE.md` | — | — | 5, 10, 13, 16, 20, 23 |

**Ordem de execução:**
- PR 1: 1 → 2 → 3 → 4. A 5 é escrita em paralelo com a 3 e a 4 e roda depois da 4.
- PR 2: 6 → 7 → 8 → (9 ∥ 10).
- Depois do PR 2, em paralelo:
  - PR 3 (11 → 12 ∥ 13) e, em seguida, PR 5 (18 → 19 ∥ 20). A 17 pode ser feita a qualquer momento depois do PR 1, mas o PR 5 só é mergeado com a 18;
  - PR 4 (14 → 15 ∥ 16).
- PR 6 (21 → 22 ∥ 23) pode começar logo depois do PR 1, em paralelo com o PR 2.
- **Ajuste pelo E1.04 (2026-11-23, DT-16 de [`e1-04-sign-in.md`](e1-04-sign-in.md)):** o PR 6 entra **depois do PR 2 do E1.04**, que já implementa a tela de login (T1 do E1.04, que substitui a T10). O PR 6 fica reduzido ao encerramento da sessão: `AuthContext`, `QueryCache`/`MutationCache`, `shouldEndSession` e o estado `session_ended` na navegação. Os testes de login de membro excluído (tarefa 23) passam pela `sign-in`. A DT-14 (`get-user-email` ignorando excluídos) vale até o PR 3 do E1.04, que remove a função.
- 24 no fim.

**Critérios de pronto**
1. **Todas as tarefas de banco:**
   - as migrations rodam num banco zerado depois das existentes e rodam de novo sem erro;
   - nenhuma função nova tem EXECUTE para `anon`, e as `_del_*` não têm para `authenticated`;
   - as views novas têm só SELECT para `authenticated` e dono `postgres`;
   - o `types.ts` está regenerado;
   - os testes do E1.08 (PR 1 a PR 4) continuam passando.
2. **Tarefa 2:** os `CHECK`s, as FKs e os índices recusam as violações diretas feitas como `postgres` (autor sem data, duas semanas iguais não excluídas, exclusão física com referência). Num banco com duplicata da semana, a migration falha com a lista e não muda nada.
3. **Tarefa 3:** paridade por persona (P1 a P5) entre cada view e a tabela sob RLS, com excluídos na massa. O relatório de célula excluída continua visível para `view_own_ministry`. O membro excluído não lê nada das views nem de `roles`.
4. **Tarefa 4:**
   - todo critério de aceite marcado "pela API" passa;
   - cada RPC devolve 42501 sem a permissão, sem gravar nada;
   - os erros seguem o formato contratado;
   - os 5 cenários de concorrência terminam num estado válido;
   - a suspensão e a restauração do acesso funcionam no Auth local (login recusado com `invalid_credentials`, depois aceito com a mesma senha).
5. **Tarefas 7, 8, 11, 14, 18 e 21:**
   - `npm run lint`, `npm test` e `npm run build` verdes;
   - sem `any` e sem asserção de tipo (`as Tipo`) nos arquivos novos (`as const` é permitido);
   - nenhuma regra de domínio dentro de componente (fica em `src/lib/`);
   - nenhum texto do spec fora de `src/lib/deletion/texts.ts`, `src/lib/auth/session.ts` ou dos módulos de domínio;
   - nenhuma leitura de `members` direto da tabela;
   - toda exclusão e restauração por RPC.
6. **Tarefa 8:** editar um relatório com participante excluído o preserva (UX-29) numa única chamada de participantes. Nenhum `delete()` em participantes no front.
7. **Tarefa 11:** as listas de excluídos paginam no servidor com total. Uma rota sem `manage_roles` não faz nenhuma requisição de dados.
8. **Tarefa 17:** sem `confirmDeletedMatches`, um cadastro com o celular de um excluído não cria conta no Auth. Com ele, cria. O e-mail da conta nunca cria.
9. **Tarefa 21:** a sessão de um membro excluído termina na próxima requisição ou na volta do foco. Uma queda de rede não a encerra.
10. **Tarefas 9, 12, 15, 19 e 22:** o `ux-designer` dá o veredito e lista os ajustes, que voltam ao `frontend-developer` antes de o QA fechar o PR.

## Testes
_Seção do `qa`._

| RN | Testes | Resultado |
|---|---|---|
