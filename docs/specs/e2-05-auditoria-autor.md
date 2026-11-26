# E2.05: Auditoria (quem cadastrou e quem alterou)

> Status: Negócio, Experiência (UX), Solução técnica e Tarefas prontos, sem perguntas em aberto. Negócio e UX escritos em 2026-11-23 (as pendências PO-UX-1 a PO-UX-8 foram resolvidas pelo PO no mesmo dia: P-AUD-20 a P-AUD-27). Solução técnica e Tarefas escritas pelo `architect` em 2026-11-24. **PR 1 (banco, tarefas 2 a 7) implementado em 2026-11-26** na branch `feat/E2.05-pr1-autoria`, rebaseada na `main` (93d037f, com o E2.03 e o E2.09 em produção), enviada e sem PR aberto (ver Testes). Falta: a revisão de código e o QA independentes (sem a ferramenta `Agent` nesta execução), abrir o PR, a tarefa 1 e o deploy; depois, os PRs 2 a 4; a tarefa 1 (conferência em produção) fica com o usuário, e as decisões DT-23 a DT-25 entraram na implementação. Ficam para o usuário revisar no PR os padrões P-AUD-01 a P-AUD-27, os pontos DA-1 a DA-12 e as DT-23 a DT-25.
> **PR 1 em produção (2026-11-26):** mci-connect#50, squash `2dd4fba`, "Deploy: banco" (migrations `20261127200000` a `20261127200500`) e promote. Antes do merge: o `save_cell_report` passou a recusar a entrada sem a célula (`cell_required`) e em formato inválido (`invalid_input`) como `app_error` (achado da revisão); o pgTAP `e203_02_policy` passou a rodar um comando por caso. Em produção: `created_by_kind` preenchido em todos, o job `e205-audit-retention` agendado, `events` sem escrita pela API, `events_view` fechada para `anon`. Próximo: PR 2.
> **Conferência em produção (tarefa 1), 2026-11-26, sessão principal, só leitura:** pré-requisitos todos presentes (última migration `20261127100100`); todos os formatos de descrição dos eventos antigos casam com a conversão; nenhum participante registrado junto com o envio (6 depois); banco 15 MB, `events` 152 kB com 111 eventos; `pg_cron` com o job `e104-sign-in-purge` rodando; `pg_trgm` disponível e não instalado; `events` com todos os privilégios para `anon`, `authenticated` e `service_role` (o PR 1 revoga) e `_log_event` só para `service_role`; nenhuma função cita `_trg_log_`; `20260327030611` aplicada; sem excluídos sem `deleted_by`; 12 eventos com autor sem cadastro; todo membro tem evento de cadastro.
> Slug: `e2-05-auditoria-autor` · Paridade com o legado: sim (MEM-12), com regras novas: autoria visível no registro, Funções na Auditoria, e uma Auditoria completa, legível e com prazo de guarda.

## Negócio
_Seção do `product-owner`. Escrita em 2026-11-23 e atualizada no mesmo dia com as decisões do PO sobre as pendências PO-UX-1 a PO-UX-8 da seção Experiência (UX). Fontes:_
- _o passo E2.05, a regra MEM-12 (3.2), as seções 5.3 e 5.5 e o passo E4.02 do [`docs/migracao.md`](../migracao.md);_
- _o `CLAUDE.md` da raiz: auditoria do legado e do novo, E1.13 e matriz de paridade;_
- _os specs [`e2-01-exclusao-logica.md`](e2-01-exclusao-logica.md) (RN-09, RN-15, RN-19, RN-20 e DT-01), [`e1-04-sign-in.md`](e1-04-sign-in.md) (RN-15, AQ-6 e risco 5), [`e2-03-senha.md`](e2-03-senha.md) (RN-17; em escrita, só lido), [`e2-02-perfis-escopo.md`](e2-02-perfis-escopo.md) (RN-02, P-PER-18 e DT-23), [`e1-08-paginacao-servidor.md`](e1-08-paginacao-servidor.md) (RN-06) e [`escolas.md`](escolas.md) (DT-31);_
- _o código do legado: `BaseEntity`, `EntityChangeTrackingService`, os serviços de membro, célula e relatório, o `AuthService`, o `DashboardService` e o `ClientApp`;_
- _o `mci-connect` na `origin/main` (`fdcbe50`): `src/pages/Events.tsx`, `MemberForm`, `CellForm`, `CellReportForm` e as migrations de auditoria (`20260426204233_…`, `20261115000000_e113_…` e `20261123233400_e201_04_write.sql`)._

### Contexto e objetivo
**No legado** (conferido no código em 2026-11-23):
- Membros, células e relatórios têm quatro campos de autoria: quem cadastrou, quando, quem fez a última alteração e quando.
- Quem preenche é o servidor. O autor é o nome do usuário logado, como estava no momento do login, e a hora é a de Brasília. O superusuário da configuração aparece como "AdminUser".
- Cadastrar preenche os quatro campos. Salvar uma alteração e excluir preenchem a última alteração, mesmo quando nenhum dado mudou. Recalcular os campos da hierarquia e acertar o cônjuge do outro lado não mexem na autoria.
- A autoria não aparece em nenhuma tela. Só a data de cadastro é usada: nos filtros "Cadastrado a partir de" e "Cadastrado até" de Membros e Células, e nos cards "Novos membros cadastrados" e "Novas células" da semana, no Dashboard.

**No novo** (conferido na `origin/main` em 2026-11-23):
- As três tabelas têm a data de cadastro e a de alteração, mas nenhuma tela as mostra, e não há quem cadastrou nem quem alterou.
  - A data de alteração dos membros muda a cada gravação, inclusive quando o servidor recalcula totais e nível. Nas células, nada parece atualizá-la (ponto 1 para o `architect`).
  - No cadastro, o próprio app pode mandar a data de cadastro. Ela só é protegida na alteração (regra 3 do E1.03).
- A Auditoria registra cadastro, alteração e exclusão de membros, células, relatórios e participantes, além de login e logout. O autor vem da sessão e, desde o E1.02, os cadastros feitos pela função de cadastro também têm autor.
  - Se o registro na Auditoria falhar, a alteração acontece mesmo assim, sem aviso. A exceção são a exclusão e a restauração, desde o E2.01.
  - Mudar rua, número, complemento, estado ou CEP de uma célula não gera evento. Nos relatórios, mudar o horário, as observações ou os visitantes também não.
  - Mudanças em Funções e nas permissões delas não ficam registradas.
  - A tela carrega só os 500 eventos mais recentes, e a busca vale só para eles. Como cada participante de relatório gera um evento, 500 eventos podem cobrir poucos dias.
  - O detalhe mostra os campos com o nome técnico (`mobile_whatsapp`, `leader_id`) e os valores em JSON, com identificadores no lugar de nomes. As datas das descrições saem no formato `2026-11-23`.
  - Os eventos ficam guardados para sempre. O E1.04 pediu ao PO um prazo para as falhas de login.

Objetivo do passo:
- todo membro, célula e relatório mostra quem cadastrou (no relatório, quem enviou) e quando, e quem fez a última alteração e quando, definidos só pelo servidor;
- a carga do legado traz a autoria registrada lá;
- a Auditoria fica completa, confiável (tudo ou nada), legível e com Funções; passa a ser paginada no servidor, abre a partir de cada registro e ganha prazo de guarda.

### Termos
- **Registro:** um membro, uma célula ou um relatório de célula.
- **Autoria do registro:** quem cadastrou e quando, e quem fez a última alteração e quando. No relatório, "cadastrar" é "enviar".
- **Dados do registro:** os campos que a pessoa informa no formulário. A lista de cada entidade está na RN-04.
- **Campos calculados:** o nível ministerial, os totais de discípulos e de células (inclusive os separados pelo gênero do líder) e, a partir do E2.06, o caminho da liderança e o G12. O servidor calcula; ninguém os informa.
- **Alteração:** a mudança de pelo menos um dado do registro (RN-04 a RN-06).
- **Evento:** cada linha da Auditoria. A tela já usa o termo ("Detalhes do evento").
- **Sistema:** o autor de uma gravação que nenhuma pessoa pediu, como uma rotina automática ou um script de manutenção.
- **Sistema anterior:** o legado (`g12app-net`). É o termo de tela.
- **Quem audita:** quem tem "Visualizar Auditoria" (`view_audit_log`).

As datas e horas mostradas seguem o horário de Brasília (`America/Sao_Paulo`).

### Personas e permissões
Os nomes entre aspas são os rótulos da tela de Funções (E2.02).

| Persona | Quem é | Permissões | O que faz neste spec |
|---|---|---|---|
| AD Administrador | função Administrador | todas, inclusive "Visualizar Toda a Igreja", "Visualizar Auditoria" e "Gerenciar Funções" | vê a autoria e a Auditoria; altera funções |
| LE Líder | função Líder (6.5) | "Visualizar Seu Ministério", "Editar Membro" e "Editar Célula", no escopo do E2.02 | vê a autoria dos membros e células que abre |
| MB Membro | função Membro | "Editar Próprio Cadastro", e lança o relatório da própria célula (D3) | vê a autoria do próprio cadastro |
| MS Sem função | sem função | nenhuma ("Ver meus dados") | vê a autoria do próprio cadastro, só para leitura |
| AU Quem audita | qualquer função com "Visualizar Auditoria" | — | vê a Auditoria da igreja toda e o histórico de cada registro |
| SI Sistema | rotinas automáticas, scripts e a carga do legado | chave secreta, fora da API | grava sem pessoa por trás |

Ninguém ganha permissão nova neste passo. A autoria acompanha o registro: quem abre o registro vê a autoria dele (RN-07).

### Massa de exemplo
| Nome | Quem é |
|---|---|
| Ana Souza | Administradora (AD e AU), de um ministério diferente do de Bruno |
| Bruno Lima | Líder (LE), no ministério do G12 Pedro Alves |
| Carla Dias | Membro (MB), líder da célula de Carla (quarta, 20:00) |
| Hugo Melo | sem função e sem líder (MS) |
| Igor Nunes | discípulo de Bruno, cadastrado por Bruno |
| Otávio e Paula | casal |
| Rita Gomes | membro sem cônjuge |
| Gil Prado | membro excluído |
| Samuel Colares | pastor, com a função Administrador |

### Histórias
- Como líder, quero ver quem cadastrou e quem alterou por último um membro ou uma célula, para saber com quem falar quando um dado está errado.
- Como membro, quero ver quem cadastrou e quem alterou o meu cadastro.
- Como quem audita, quero abrir o histórico completo de um registro a partir dele, para entender como ele chegou ao estado atual.
- Como quem audita, quero saber quem mudou as permissões de uma função, para responder por um acesso indevido.
- Como quem audita, quero ler a Auditoria em português, com o nome dos campos e das pessoas, sem códigos.
- Como liderança, quero que a autoria registrada no sistema anterior venha na migração.
- Como igreja, quero que a Auditoria não cresça sem limite e guarde por menos tempo o que é só tentativa.

### Decisões

#### Decisões e regras herdadas
| Origem | O que vale aqui | Onde |
|---|---|---|
| D1 (2026-11-14) | Exclusão lógica: o registro excluído fica guardado, com a data e o autor da exclusão. | RN-06, RN-11 |
| E1.02 e E1.13 | O cadastro feito pela função de cadastro grava com a sessão de quem chama, e a Auditoria só é gravada pelo servidor. | RN-02, RN-16 |
| E2.01 (DT-01, RN-15, RN-19, RN-20) | Quem excluiu aponta para o cadastro do membro; a lista "Excluídos" mostra a data e quem excluiu; exclusão e restauração vão para a Auditoria, por inteiro ou não acontecem. | RN-06, RN-11, RN-14 |
| E2.02 (RN-02, P-PER-18, DT-23) | A Auditoria vale para a igreja toda, só com "Visualizar Auditoria". Nas linhas visíveis, os nomes de referência de pessoas de fora aparecem, só o nome. | RN-08, RN-18 |
| E1.04 (RN-15) e E2.03 (RN-17) | Os eventos de login e de senha, com os textos e campos de lá. | RN-17, RN-20 |

#### Padrões definidos por este spec (revisar no PR)
São pontos que as fontes não respondem. O PO adotou a opção mais conservadora e coerente com o legado. Nas regras, aparecem como "definida pelo spec". O usuário pode mudar qualquer um na revisão do PR.

- **P-AUD-01, entidades.** Membros, células e relatórios guardam a autoria. Os participantes fazem parte do relatório. As funções não mostram autoria na tela; as mudanças delas vão só para a Auditoria (RN-01, RN-15).
- **P-AUD-02, autor.** O autor é sempre a pessoa da sessão, qualquer que seja o caminho: tela, função do servidor ou RPC. "Sistema" só quando nenhuma pessoa pediu a gravação, e "autor não registrado" quando não se sabe (RN-02, RN-09).
- **P-AUD-03, só mudança real.** Salvar sem mudar nenhum dado não muda a autoria nem gera evento. No legado, qualquer gravação mudava a última alteração (RN-04).
- **P-AUD-04, consequências contam.** Quando a ação sobre um registro muda os dados de outro (o vínculo de cônjuge, inclusive o desfeito pela exclusão), o outro registro também fica alterado, com o autor da ação. Campos calculados nunca contam (RN-04, RN-05). No legado, o cônjuge do outro lado não mudava a autoria; a regra segue a intenção ("quem alterou por último"), e não esse detalhe.
- **P-AUD-05, exclusão e restauração.** As duas contam como alteração, como a exclusão no legado (RN-06).
- **P-AUD-06, onde e para quem.** A autoria aparece ao abrir o registro, para quem o abre, sem permissão nova. Não aparece nas listas (RN-07).
- **P-AUD-07, nome do autor.** Aparece o nome atual, mesmo de quem está fora do escopo ou foi excluído. Só o nome, sem acesso ao cadastro (RN-08).
- **P-AUD-08, autoria do legado.** O nome vem como texto, com a marca "(sistema anterior)", sem ligar a nenhum membro. "AdminUser" vira "Administrador (sistema anterior)". Um registro nunca alterado lá mostra só o cadastro (RN-10).
- **P-AUD-09, data de cadastro ausente no legado.** A tela mostra "data não registrada", e o registro não conta como novo em nenhuma semana. A seção 5.5 hoje manda usar a data da migração (RN-10).
- **P-AUD-10, excluídos do legado.** A lista "Excluídos" mostra quem excluiu no sistema anterior, no lugar de "Autor não registrado" (RN-11).
- **P-AUD-11, registros anteriores a este passo.** A autoria vem da Auditoria, quando houver evento (RN-12).
- **P-AUD-12, tudo ou nada.** A alteração, a autoria e o evento acontecem juntos ou não acontecem, como já vale para exclusão, restauração e senha (RN-14).
- **P-AUD-13, Auditoria imutável.** Ninguém altera nem apaga eventos pela API, nem o Administrador (RN-16).
- **P-AUD-14, prazos de guarda.** 90 dias para falhas, recusas e bloqueios; 1 ano para login e logout; 2 anos para o resto (RN-17).
- **P-AUD-15, Auditoria paginada.** Entra neste passo, com o filtro de período (RN-18).
- **P-AUD-16, "Ver histórico".** No registro aberto, para quem audita (RN-19).
- **P-AUD-17, Auditoria legível.** Campos com o nome da tela, valores legíveis, "Alteração" no lugar de "Atualização" e "Sistema" como autor (RN-20).
- **P-AUD-18, relatório.** O termo é "Enviado por", como em "relatórios enviados" e na mensagem "O relatório para esta semana já foi enviado" (RN-07).
- **P-AUD-19, a carga não gera eventos.** A carga do legado e o recálculo depois dela não geram eventos nem mudam a autoria (RN-10).
- **Vindos do desenho de UX (2026-11-23, PO-UX-1 a PO-UX-8 em "Experiência (UX)"):**
  - P-AUD-20: salvar sem mudança fecha o formulário sem gravar e avisa "Nenhuma alteração para salvar." (RN-04 b, PO-UX-1);
  - P-AUD-21: "Ver histórico" também no detalhe de um evento de membro, célula ou relatório, na Auditoria (RN-19, PO-UX-2);
  - P-AUD-22: as descrições dos eventos usam "Cadastrou", "Alterou", "Enviou", "Excluiu" e "Restaurou", e a data `dd/mm/aaaa`, nos eventos novos e nos de antes deste passo (RN-20 e, PO-UX-3);
  - P-AUD-23: o nome de uma função renomeada aparece com o anterior e o novo; a descrição, só pelo nome do campo (RN-15, RN-20 b, PO-UX-4);
  - P-AUD-24: um evento só por envio ou alteração do relatório, com os participantes dentro dele; não há mais um evento por participante, e a entidade "Participante" sai da tela (RN-13 b, RN-19, RN-20, PO-UX-5);
  - P-AUD-25: "login" e "logout", como na tela do E1.04, também na nota de guarda e nas regras (RN-04 c, RN-17, PO-UX-6);
  - P-AUD-26: "Ver histórico" abre a Auditoria na mesma tela e, com alterações não salvas, pede antes para descartá-las (RN-19, PO-UX-7);
  - P-AUD-27: os textos definidos pela UX (marcados com † em Experiência (UX) > Textos) ficam aprovados, com os ajustes das P-AUD-22, P-AUD-24 e P-AUD-25 (PO-UX-8).

### Regras de negócio
Nenhuma regra está "a confirmar". Os caminhos do legado são relativos a `g12app-net/`, com as abreviações do `docs/migracao.md` (`App/` = `G12App.Application/`, `Domain/` = `G12App.Domain/`, `UI/` = `G12App.API/ClientApp/src/`). Os do novo são relativos a `mci-connect/`, na `origin/main`.

| ID | Regra | Origem |
|---|---|---|
| RN-01 | **O que cada registro guarda.** Membros, células e relatórios de célula guardam:<br>- quem cadastrou e quando (no relatório, quem enviou e quando);<br>- quem fez a última alteração e quando.<br><br>Os participantes fazem parte do relatório e não têm autoria própria. As funções não guardam autoria na tela: as mudanças delas vão para a Auditoria (RN-15). | MEM-12; legado (`Domain/Model/Base/BaseEntity.cs:13-19`, herdado por `Member`, `Cell` e `Report`); funções: definida pelo spec (P-AUD-01) |
| RN-02 | **Quem é o autor.**<br>- A pessoa da sessão que pediu a gravação, qualquer que seja o caminho: pela tela, pela API, por uma função do servidor (como a de cadastro de membro) ou por uma RPC. Uma gravação feita em nome de uma pessoa nunca fica com o autor "Sistema" nem sem autor.<br>- "Sistema", quando nenhuma pessoa pediu a gravação: rotina automática, script de manutenção ou operação com a chave secreta.<br>- O autor da carga do legado segue a RN-10.<br><br>O pastor, o membro sem líder e o membro sem função são autores como qualquer outro, quando o que fazem é aceito. | legado (`App/Services/EntityChangeTrackingService.cs:20-24` e `:30-34`: o autor é o usuário da sessão); E1.02 (a função de cadastro grava com a sessão de quem chama); "Sistema": definida pelo spec (P-AUD-02) |
| RN-03 | **Só o servidor define a autoria.**<br>- A data e a hora vêm do relógio do servidor.<br>- Valores de autoria ou de data enviados pelo app ou pela API, no cadastro ou na alteração, são ignorados, sem erro.<br>- Ninguém altera a autoria pela API, nem o Administrador. A única autoria vinda de fora é a da carga do legado (RN-10).<br>- O cadastro (quem e quando) nunca muda depois de gravado. | legado (`EntityChangeTrackingService.cs:18-36`: autoria preenchida no servidor, em `SystemConstants.BrazilTime`); E1.03 (regra 3: colunas do servidor ignoram o valor do cliente; `supabase/migrations/20261114210000_e103_member_write_rules.sql:73-82`); cadastro também protegido: definida pelo spec |
| RN-04 | **O que conta como alteração.**<br>(a) Conta a mudança de pelo menos um dado do registro, comparando o valor gravado antes e depois:<br>- **Membro:** nome, gênero, data de nascimento, CPF, e-mail, celular/WhatsApp, telefone, Instagram, foto, observações, endereço (CEP, rua, número, complemento, bairro, cidade e estado), líder, "Tem liderança?", "É pastor(a)?", cônjuge, batizado, data do batismo, situação (ativo ou inativo) e função.<br>- **Célula:** líder, timóteo, anfitrião, tipo, dia da semana, horário, endereço (CEP, rua, número, complemento, bairro, cidade e estado) e situação (ativa ou inativa).<br>- **Relatório:** célula, data, horário, "Não houve célula", tema, motivo, observações, visitantes, oferta e participantes.<br><br>(b) Salvar sem mudar nenhum dado não muda a autoria nem gera evento, e a tela avisa "Nenhuma alteração para salvar.".<br>(c) Não contam: os campos calculados; a conta de acesso; a senha, a marca de troca obrigatória e os demais eventos de senha (E2.03); login e logout; o retrato da célula guardado no relatório (REL-09).<br>(d) No relatório, os participantes gravados no envio fazem parte do envio: logo depois de enviar, o relatório mostra só "Enviado por". Depois disso, incluir ou retirar participantes é alteração do relatório.<br>(e) Uma gravação é uma alteração só, por mais dados que mude, e gera um evento só (RN-13 b). | legado (`App/Services/MemberService.cs:111`, `CellService.cs:57`, `ReportService.cs:102`: salvar marca a alteração; `MemberService.cs:124-131` e `App/EventHandlers/DomainEvents/MemberChangedHandler.cs:77`, `:100`, `CellChangedHandler.cs:59`: o recálculo não marca); lista de campos: os formulários atuais (`src/components/MemberForm.tsx`, `CellForm.tsx`, `CellReportForm.tsx`); "só mudança real": definida pelo spec (P-AUD-03); senha: E2.03 (RN-11, "trocar a própria senha não é alterar o cadastro"); aviso: P-AUD-20 |
| RN-05 | **Consequências em outro registro.** Quando a ação sobre um registro muda os dados de outro, o outro também fica alterado, com o mesmo autor e o mesmo momento, e ganha o próprio evento:<br>- o vínculo de cônjuge, que é simétrico (MEM-10): ao definir, trocar ou desfazer o cônjuge de alguém, mudam também o cadastro do novo cônjuge e o do cônjuge anterior;<br>- o cônjuge desfeito pela exclusão de um membro (RN-05 do E2.01).<br><br>Mudanças só em campos calculados (por exemplo, o total de discípulos dos líderes acima, ou o nível dos discípulos quando o líder muda) não alteram ninguém. | MEM-10; E2.01 (RN-05 e RN-19: a Auditoria já registra o cônjuge desfeito); conta para o outro registro: definida pelo spec (P-AUD-04) |
| RN-06 | **Exclusão e restauração.** Excluir e restaurar um registro contam como alteração dele, com quem fez e quando.<br>- A data e o autor da exclusão continuam também nos campos próprios da exclusão (E2.01), que a lista "Excluídos" mostra.<br>- Depois de restaurado, o registro mostra como última alteração a restauração. | legado (`MemberService.cs:153`, `CellService.cs:89`, `ReportService.cs:76`: a exclusão é gravada como última alteração); D1; restauração: definida pelo spec (P-AUD-05) |
| RN-07 | **Onde e para quem a autoria aparece.** Ao abrir o registro, para quem o abre, sem permissão nova:<br>- **membro:** no diálogo "Editar membro", em "Editar meus dados" e em "Meus dados" (E2.02);<br>- **célula:** no diálogo "Editar célula" e, quando existir, no detalhe da célula (E2.10);<br>- **relatório:** no diálogo de edição do relatório e na consulta "Ver relatório" (E2.01).<br><br>Formato, com data `dd/mm/aaaa` e hora `HH:mm`:<br>- "Cadastrado por {Nome} em {data} às {hora}" (célula: "Cadastrada"; relatório: "Enviado");<br>- "Alterado por {Nome} em {data} às {hora}" (célula: "Alterada"). Aparece só quando houve alteração depois do cadastro ou do envio.<br><br>Não aparece no cadastro novo, nas listas, nos seletores, no Dashboard nem em Ministérios. Pela API, a autoria vem junto com o registro para quem pode lê-lo, e não vem para quem não pode. | MEM-12 ("quem criou, quem alterou e quando"); o legado guardava, mas não mostrava (nenhuma referência em `UI/`); lugar, público e termos: definida pelo spec (P-AUD-06, P-AUD-18) |
| RN-08 | **O nome do autor.**<br>- Aparece o nome atual do membro autor: se ele mudou de nome, aparece o novo.<br>- Aparece mesmo que o autor esteja fora do que quem consulta vê, ou tenha sido excluído.<br>- Aparece só o nome, sem acesso ao cadastro do autor e sem nenhum outro dado dele, nem pela API. | E1.08 (RN-06 e D-4: nomes de referência); E2.01 (RN-09 c); E2.02 (RN-02); nome atual: definida pelo spec (P-AUD-07) |
| RN-09 | **Autor e data sem pessoa ou desconhecidos.**<br>- "Sistema": gravação sem pessoa (RN-02).<br>- "autor não registrado": não se sabe quem foi (RN-10 e RN-12).<br>- "data não registrada": não se sabe quando foi (RN-10).<br>- "{Nome} (sistema anterior)": autor vindo do legado (RN-10). | definida pelo spec (P-AUD-02, P-AUD-08, P-AUD-09) |
| RN-10 | **Autoria vinda do legado (carga).**<br>(a) O cadastro vem de "quem cadastrou" e "quando" do legado, e a última alteração, de "quem alterou" e "quando". As horas do legado já são de Brasília.<br>(b) O autor do legado é um nome, gravado no momento da ação. Ele vem como texto e aparece com a marca "(sistema anterior)". Não é ligado a nenhum membro, mesmo que haja um com o mesmo nome. O autor "AdminUser" aparece como "Administrador (sistema anterior)".<br>(c) Quando a última alteração do legado é o próprio cadastro (o mesmo nome, até 1 minuto depois do cadastro), o registro mostra só o cadastro.<br>(d) Sem nome no legado: "autor não registrado". Sem data de cadastro no legado: "data não registrada", e o registro não conta como novo em nenhuma semana (DSH-02) nem entra nos filtros por período de cadastro (MEM-13, CEL-06).<br>(e) A carga, o recálculo dos campos calculados depois dela (E4.07) e a criação das contas de acesso (E4.08) não geram eventos na Auditoria e não mudam a autoria. | 5.5 do `docs/migracao.md` (`CreatedBy`, `CreationDate`, `LastModifiedBy` e `LastModifiedDate`); legado (`EntityChangeTrackingService.cs:20-24`: o nome vem da sessão; `App/Services/AuthService.cs:94`: o nome da sessão é o do membro no login; `AuthService.cs:41`: "AdminUser"); `MemberService.cs:87-88`, `CellService.cs:39-40` e `ReportService.cs:59-60`: o cadastro preenche também a alteração; texto, marca, 1 minuto e "data não registrada": definida pelo spec (P-AUD-08, P-AUD-09, P-AUD-19) |
| RN-11 | **Excluídos no legado.** Para um registro que veio excluído do legado, a lista "Excluídos" (RN-15 do E2.01) mostra como autor da exclusão o "quem alterou" do legado, com a marca "(sistema anterior)". Sem nome no legado, continua "Autor não registrado". A data da exclusão segue a seção 5.5. | legado (`MemberService.cs:153`, `CellService.cs:89`, `ReportService.cs:76`: a exclusão grava o autor como última alteração); 5.5 (`deleted_at` vem da última alteração); definida pelo spec (P-AUD-10) |
| RN-12 | **Registros anteriores a este passo.** Para os registros que já existem no novo quando este passo for publicado:<br>- o cadastro fica com a data atual de cadastro e, como autor, o autor do evento de cadastro daquele registro na Auditoria. Sem esse evento, "autor não registrado";<br>- a última alteração vem do último evento de alteração, exclusão ou restauração daquele registro na Auditoria. Sem esse evento, o registro mostra só o cadastro. | definida pelo spec (P-AUD-11) |
| RN-13 | **Autoria e Auditoria: o que cada uma guarda.**<br>(a) O registro guarda só o cadastro e a última alteração. O histórico (cada alteração, os campos mudados, as exclusões, as restaurações, os participantes, os logins e as senhas) fica só na Auditoria.<br>(b) Cada cadastro e cada alteração (RN-04 a RN-06) gera um evento só daquele registro na Auditoria, com o mesmo autor e o mesmo momento da autoria. No relatório, o evento do envio traz os participantes enviados, e o de cada alteração traz os participantes incluídos e os retirados nela: não há um evento por participante. Assim, a última alteração do registro é sempre igual à do último evento de cadastro, alteração, exclusão ou restauração dele, enquanto esse evento estiver guardado.<br>(c) A Auditoria registra a mudança de qualquer dado da RN-04, inclusive rua, número, complemento, estado e CEP da célula, e horário, observações e visitantes do relatório.<br>(d) A autoria não depende da Auditoria: continua no registro depois que os eventos saem pelo prazo de guarda (RN-17), e quem abre o registro a vê sem "Visualizar Auditoria". | E1.13 (Auditoria gravada só pelo servidor); MEM-12; o que cada uma guarda e a correspondência: definida pelo spec; participantes dentro do evento do relatório: P-AUD-24 |
| RN-14 | **Tudo ou nada.** Cadastrar, alterar, excluir e restaurar um registro, a autoria dele e o evento na Auditoria acontecem juntos ou não acontecem.<br>- Se o evento não puder ser gravado, nada muda, e a tela mostra o erro de conexão. Tentar de novo grava a alteração uma vez só.<br>- O mesmo vale para as funções (RN-15).<br>- As recusas e falhas de login e de senha seguem o E1.04 (RN-15 g) e o E2.03 (RN-17): se o registro delas falhar, a resposta ao usuário não muda. | E2.01 (RN-20: exclusão e restauração com a Auditoria) e E2.03 (RN-17: redefinição e troca com a Auditoria); estendido a toda alteração: definida pelo spec (P-AUD-12) |
| RN-15 | **Funções na Auditoria.** A Auditoria registra, com quem fez e quando:<br>- a criação de uma função, com o nome e as permissões;<br>- a alteração do nome (com o anterior e o novo), da descrição ou das permissões, num evento só por gravação, com as permissões incluídas e as retiradas pelo rótulo da tela;<br>- a troca da função padrão, com a função que passou a ser a padrão e a que deixou de ser;<br>- a exclusão, com o nome e as permissões que a função tinha. O evento continua depois que a função some.<br><br>Salvar sem mudança não gera evento. Dar ou trocar a função de um membro é alteração do membro (RN-04). | no legado, os perfis eram fixos (`Domain/Model/Constants.cs`); hoje o novo não registra mudanças de funções (o tipo `event_entity` não tem função: `supabase/migrations/20260426204233_…sql:12-16`); definida pelo spec (P-AUD-01); nome anterior e novo: P-AUD-23 |
| RN-16 | **Auditoria imutável.** Nenhum evento é criado, alterado ou apagado pela API, por ninguém, inclusive o Administrador.<br>- Os eventos são gravados só pelo servidor, junto com o que registram.<br>- Eles saem só pelo prazo de guarda (RN-17). | E1.13 (só os triggers gravam; a tabela não tem política de escrita: `supabase/migrations/20260426204233_…sql:43-48`); apagar e alterar: definida pelo spec (P-AUD-13) |
| RN-17 | **Prazo de guarda.** Cada evento fica na Auditoria pelo prazo da categoria dele, contado a partir do momento do evento:<br>- **90 dias:** falhas, recusas e bloqueios. São a falha no login e o login bloqueado (E1.04), e a redefinição de senha recusada, a falha na troca de senha e a troca bloqueada (E2.03);<br>- **1 ano:** login e logout;<br>- **2 anos:** os demais. São o cadastro, a alteração, a exclusão e a restauração de membros, células, relatórios (inclusive os eventos de participante de antes deste passo) e funções, além da senha redefinida, da senha alterada e da troca de senha exigida.<br><br>Detalhes:<br>- A remoção é automática e acontece em até 1 dia depois do fim do prazo. Ninguém apaga antes (RN-16).<br>- Os prazos valem também para os eventos de antes deste passo.<br>- A autoria dos registros (RN-13 d) e os dados de exclusão (E2.01) não mudam com a remoção.<br>- A tela da Auditoria informa os prazos. | E1.04 (risco 5: "definir a retenção dos eventos de falha e de bloqueio, por exemplo 90 dias"); prazos: definida pelo spec (P-AUD-14); "logout": P-AUD-25 |
| RN-18 | **Auditoria completa.**<br>- A tela mostra todos os eventos guardados, do mais recente para o mais antigo, em páginas, com o total. Nada é cortado sem aviso.<br>- Os filtros e a busca valem para todos os eventos guardados, e não só para os carregados:<br>  - Ação, Entidade e Status, como hoje;<br>  - Período, com "De" e "Até", em datas de Brasília, incluindo os dois dias informados;<br>  - a busca procura no autor, no registro e na descrição, sem diferenciar maiúsculas e acentos.<br>- Continua valendo para a igreja toda, só para quem tem "Visualizar Auditoria". | seção 2 do `docs/migracao.md` ("exceto a Auditoria: `Events.tsx` carrega os 500 eventos mais recentes", `src/pages/Events.tsx:77`); E1.04 (AQ-6, "a paginação da Auditoria fica para um passo futuro"); E2.02 (P-PER-18); período e entrada neste passo: definida pelo spec (P-AUD-15) |
| RN-19 | **"Ver histórico".** Quem tem "Visualizar Auditoria" encontra "Ver histórico" em dois lugares: no registro aberto (RN-07) e no detalhe de um evento de membro, célula ou relatório na Auditoria ("Ver histórico deste membro", "desta célula", "deste relatório").<br>- Ele abre a Auditoria, na mesma tela, com só os eventos de cadastro, alteração, exclusão e restauração daquele registro, inclusive os gerados por consequência (RN-05). No relatório, cada evento traz os participantes (RN-13 b), e os eventos de participante de antes deste passo também entram. A lista segue a RN-18 (paginada, do mais recente para o mais antigo).<br>- Com alterações não salvas no registro aberto, a tela pede para descartá-las antes de abrir o histórico.<br>- Sem a permissão, a ação não aparece, e a API não devolve nenhum evento.<br>- Os eventos de login e de senha de um membro continuam na Auditoria geral, achados pela busca. | definida pelo spec (P-AUD-16); no detalhe do evento: P-AUD-21; participantes: P-AUD-24; mesma tela e descarte: P-AUD-26 |
| RN-20 | **Auditoria legível.**<br>(a) Os campos mudados aparecem com o nome da tela (RN-04), nunca com o nome técnico.<br>(b) O valor anterior e o novo aparecem só para:<br>- **membro:** nome, função, líder, cônjuge, "É pastor(a)?", "Tem liderança?", situação, batizado e gênero;<br>- **célula:** tipo, líder, timóteo, anfitrião, situação, dia, horário, bairro e cidade;<br>- **relatório:** célula, data, horário, "Não houve célula", tema, motivo e oferta, e os participantes pelo nome: os enviados, no envio, e os incluídos e os retirados, na alteração;<br>- **função:** nome (RN-15).<br><br>Os demais campos aparecem só pelo nome, sem valor: os dados pessoais, de contato e de endereço do membro; rua, número, complemento, estado e CEP da célula; observações e visitantes do relatório; descrição da função.<br>(c) Os valores aparecem legíveis:<br>- pessoas pelo nome que tinham no momento da alteração (nos eventos de antes deste passo, pelo nome atual);<br>- célula como "célula de {Líder}"; função pelo nome;<br>- Sim ou Não; Ativo ou Inativo (Ativa ou Inativa, na célula); Masculino ou Feminino;<br>- datas `dd/mm/aaaa`, horas `HH:mm`, oferta em reais (R$ 50,00) e "(vazio)" quando não há valor.<br><br>(d) Nenhum JSON ou identificador técnico aparece na tela. Os campos dos eventos de login e de senha são os do E1.04 e do E2.03.<br>(e) As descrições usam o vocabulário da tela: "Cadastrou", "Alterou", "Excluiu" e "Restaurou" (membro e célula), "Enviou" (relatório) e, nos eventos de participante de antes deste passo, "Incluiu" e "Retirou". As datas aparecem como `dd/mm/aaaa`. Isso vale para os eventos novos e para os de antes deste passo; o que o evento registra (autor, momento, registro e campos) não muda.<br>(f) A ação "Atualização" passa a se chamar "Alteração". A entidade "Função" é nova. A entidade "Participante" sai da tela: os eventos de participante de antes deste passo aparecem como eventos do relatório. O autor sem pessoa aparece como "Sistema"; no login sem sessão, continua "—" (E1.04). | campos com valor: os de hoje (`supabase/migrations/20261123233400_e201_04_write.sql:805-813`, `:930-933`, `:1009`), com horário e célula no relatório; tela atual (`src/pages/Events.tsx:37-45`, `:258`, `:268`); legibilidade: definida pelo spec (P-AUD-17), no padrão da UXD-8 do E1.04 e da UXD-11 do E2.03; descrições: P-AUD-22; nome da função: P-AUD-23; participantes: P-AUD-24 |

### Critérios de aceite
Quando o critério diz "pela API", vale para qualquer chamada feita fora da tela. "Erro de permissão" é o código 42501, sem nenhuma gravação. Os horários são de Brasília. Personas e nomes: tabelas acima.

- **RN-01**
  - Dado Bruno, que cadastra Igor na quarta-feira, 18/11/2026, às 19:40
  - Quando Ana abre o cadastro de Igor
  - Então vê "Cadastrado por Bruno Lima em 18/11/2026 às 19:40" e nenhuma linha de alteração.
  - Dados a célula de Carla, cadastrada por Ana e depois alterada por Bruno, e um relatório dela, enviado por Carla e depois alterado por Ana
  - Então a célula mostra "Cadastrada por Ana Souza…" e "Alterada por Bruno Lima…", e o relatório mostra "Enviado por Carla Dias…" e "Alterado por Ana Souza…".
- **RN-02**
  - Dado Bruno, que cadastra Igor pela tela (a gravação passa pela função de cadastro do servidor)
  - Então o autor do cadastro de Igor é Bruno, e não "Sistema" nem vazio.
  - Dado o pastor Samuel, que altera o horário da célula de Carla
  - Então a célula mostra "Alterada por Samuel Colares…".
  - Dado Hugo, sem função, que tenta alterar o próprio telefone pela API
  - Então a gravação é recusada (RN-07 do E2.02), e a autoria e a Auditoria não mudam.
  - Dada uma rotina sem pessoa que altera a cidade de uma célula com a chave secreta
  - Então a célula mostra "Alterada por Sistema…", e a Auditoria tem o evento com o autor "Sistema".
- **RN-03**
  - Dado Bruno, que cadastra Igor pela API mandando Ana como autora e a data 01/01/2020
  - Então o cadastro fica com Bruno e com a data e a hora do servidor, sem erro.
  - Dada Ana, que manda pela API só um autor e uma data de alteração novos para Igor, sem mudar nenhum dado
  - Então nada muda, e nenhum evento é gravado.
  - Dado Igor, alterado 3 vezes depois do cadastro
  - Então "Cadastrado por Bruno Lima em 18/11/2026 às 19:40" continua igual.
  - Dado Bruno, que cadastra Igor no sábado, 21/11/2026, às 23:59
  - Então o cadastro mostra "21/11/2026 às 23:59", e não o domingo, 22/11 (que seria o horário em UTC), e Igor conta como novo na semana de 15 a 21/11 (DSH-02, E2.14).
- **RN-04**
  - Dada Ana, que abre o cadastro de Igor e salva sem mudar nada
  - Então a autoria de Igor não muda, a Auditoria não ganha evento, e o formulário fecha com "Nenhuma alteração para salvar.".
  - Dado Bruno, que muda só o celular de Igor
  - Então Igor mostra "Alterado por Bruno Lima…", e a Auditoria tem um evento "Alteração" com o campo "Celular/WhatsApp", sem o valor.
  - Dado Bruno, que marca Igor como inativo
  - Então conta como alteração de Igor, feita por Bruno.
  - Dado um discípulo novo cadastrado para Igor, o que muda o total de discípulos de Igor, de Bruno e dos líderes acima
  - Então só o novo discípulo ganha autoria. A de Igor, a de Bruno e a dos líderes acima não mudam.
  - Dada Ana, que redefine a senha de Igor (E2.03)
  - Então a autoria de Igor não muda, e a Auditoria tem o evento "Senha redefinida".
  - Dada Carla, que envia o relatório da semana com 8 participantes
  - Então o relatório mostra só "Enviado por Carla Dias…".
  - Quando Ana, depois, só acrescenta um participante
  - Então o relatório mostra "Alterado por Ana Souza…".
  - Dado Bruno, que muda o nome e o celular de Igor numa gravação só
  - Então há um único evento de alteração, com os dois campos.
- **RN-05**
  - Dados Otávio e Paula, sem cônjuge, e Bruno, que edita Otávio e escolhe Paula como cônjuge
  - Então os dois cadastros mostram "Alterado por Bruno Lima" no mesmo momento, e a Auditoria tem um evento para cada um.
  - Quando Bruno, depois, troca o cônjuge de Otávio para Rita
  - Então Otávio, Paula (que ficou sem cônjuge) e Rita mostram a alteração feita por Bruno.
  - Dado que Ana exclui Paula, casada com Otávio (E2.01)
  - Então Otávio mostra "Alterado por Ana Souza…", e a Auditoria tem "Vínculo de cônjuge desfeito pela exclusão de Paula".
- **RN-06**
  - Dada Ana, que exclui a célula de Carla no sábado, 21/11/2026, às 23:50, e a restaura no domingo, 22/11/2026, às 00:10
  - Então "Células excluídas" mostrou "Excluída em 21/11/2026 às 23:50 · por Ana Souza" enquanto ela estava excluída, e, depois de restaurada, a célula mostra "Alterada por Ana Souza em 22/11/2026 às 00:10".
  - Dado um registro excluído
  - Quando alguém tenta excluí-lo de novo pela API (RN-07 do E2.01)
  - Então a autoria não muda.
- **RN-07**
  - Dada Carla, que abre "Editar meus dados"
  - Então vê a autoria do próprio cadastro.
  - Dado Hugo, que abre "Meus dados", só para leitura
  - Então também vê a autoria do próprio cadastro.
  - Dado alguém que abre "Novo membro", "Nova célula" ou um relatório novo
  - Então não há autoria na tela.
  - Dadas as listas de Membros, Células e Relatórios, os seletores, o Dashboard e Ministérios
  - Então nenhum deles mostra autoria.
  - Dado Davi, Líder de outro ministério, que não vê Igor
  - Quando ele tenta ler Igor pela API
  - Então não recebe nada, nem a autoria (E2.02).
- **RN-08**
  - Dado Igor, do ministério de Bruno, alterado por último por Ana, que é de outro ministério
  - Quando Bruno abre Igor
  - Então vê "Alterado por Ana Souza…", sem link para o cadastro de Ana, e a resposta da API não traz nenhum outro dado dela.
  - Dado Gil, hoje excluído, que cadastrou Lia
  - Então Lia mostra "Cadastrado por Gil Prado…".
  - Dada Ana, que muda o próprio nome para "Ana Souza Lima"
  - Então a autoria dos registros dela passa a mostrar "Ana Souza Lima", e os eventos já gravados na Auditoria continuam com "Ana Souza" como autora.
- **RN-09**
  - Ver os critérios da RN-02 ("Sistema"), da RN-10 ("autor não registrado", "data não registrada" e "(sistema anterior)") e da RN-12.
- **RN-10**
  - Dado um membro do legado cadastrado por "Maria Alves" em 10/03/2023 às 14:00 e alterado por "João Pires" em 05/06/2024 às 09:15
  - Então, no novo, ele mostra "Cadastrado por Maria Alves (sistema anterior) em 10/03/2023 às 14:00" e "Alterado por João Pires (sistema anterior) em 05/06/2024 às 09:15", mesmo que exista um membro chamado Maria Alves.
  - Dada uma célula do legado cadastrada por "AdminUser"
  - Então ela mostra "Cadastrada por Administrador (sistema anterior)…".
  - Dado um relatório do legado cuja última alteração é do mesmo autor do envio, 2 segundos depois
  - Então ele mostra só "Enviado por…".
  - Dado um membro do legado sem nome de quem cadastrou
  - Então ele mostra o cadastro com "autor não registrado".
  - Dado um membro do legado sem data de cadastro, carregado na semana do cutover
  - Então ele mostra "data não registrada", não conta em "Novos membros" dessa semana nem de nenhuma outra, e não aparece no filtro por período de cadastro.
  - Dada a carga completa e o recálculo dos totais depois dela
  - Então a Auditoria não ganha nenhum evento por causa da carga, e nenhum registro mostra "Sistema" como autor por causa dela.
- **RN-11**
  - Dado um relatório excluído no legado, com a última alteração feita por "João Pires" em 02/02/2025 às 10:00
  - Quando Ana abre "Relatórios excluídos"
  - Então vê "Excluído em 02/02/2025 às 10:00 · por João Pires (sistema anterior)".
  - Dado um excluído do legado sem esse nome
  - Então a lista mostra "Autor não registrado".
- **RN-12**
  - Dada uma célula cadastrada no novo antes deste passo, com o evento de cadastro feito por Ana
  - Então, depois da publicação, ela mostra "Cadastrada por Ana Souza" na data do cadastro.
  - Dado um membro cadastrado antes deste passo, sem evento de cadastro
  - Então ele mostra o cadastro com "autor não registrado".
- **RN-13**
  - Dado qualquer registro, depois de qualquer sequência de cadastros, alterações, exclusões e restaurações deste spec
  - Então a última alteração mostrada é a do último evento de cadastro, alteração, exclusão ou restauração dele na Auditoria, com o mesmo autor e o mesmo momento.
  - Dada Carla, que envia o relatório da semana com 8 participantes
  - Então a Auditoria tem um único evento, "Enviou o relatório de {dd/mm/aaaa} da célula de Carla Dias", com os 8 participantes, e nenhum evento por participante.
  - Quando Ana, numa gravação só, inclui Lia, retira Nina e muda a oferta
  - Então a Auditoria tem um único evento "Alterou o relatório…", com a oferta, "Participantes incluídos: Lia" e "Participantes retirados: Nina".
  - Dado Bruno, que muda só a rua da célula de Carla
  - Então a Auditoria tem o evento "Alteração" com o campo "Rua".
  - Dada Ana, que muda só as observações de um relatório
  - Então a Auditoria tem o evento com o campo "Observações", sem o valor.
  - Dado o evento de alteração de Igor que saiu pelo prazo de guarda
  - Então o cadastro de Igor continua mostrando a mesma autoria.
- **RN-14**
  - Dada uma falha forçada na gravação da Auditoria
  - Quando Bruno salva uma alteração de Igor, cadastra um membro, altera uma célula ou Ana altera uma função
  - Então nada muda (nem os dados, nem a autoria), e a tela mostra o erro de conexão.
  - Quando a falha deixa de existir e Bruno salva de novo
  - Então a alteração é gravada uma vez só, com um único evento.
  - Dada uma falha forçada na Auditoria durante uma tentativa de login com a senha errada
  - Então a resposta ao usuário é a mesma de sempre (E1.04).
- **RN-15**
  - Dada Ana, que cria a função "Secretaria" com "Visualizar Toda a Igreja" e "Editar Membro"
  - Então a Auditoria tem um evento "Criação" da função Secretaria, com Ana e as duas permissões.
  - Quando Ana retira "Editar Membro", inclui "Ver Dados Sensíveis" e salva
  - Então há um único evento "Alteração" da função Secretaria, com "Permissões incluídas: Ver Dados Sensíveis" e "Permissões retiradas: Editar Membro".
  - Quando Ana renomeia Secretaria para "Secretaria Geral" e muda a descrição
  - Então o evento mostra "Nome: Secretaria → Secretaria Geral" e o campo "Descrição", sem o valor.
  - Quando Ana torna Secretaria Geral a função padrão
  - Então o evento diz que Secretaria Geral passou a ser a padrão e qual função deixou de ser.
  - Quando Ana exclui Secretaria Geral
  - Então o evento "Exclusão" traz o nome e as permissões dela e continua na Auditoria.
  - Quando Ana abre a função e salva sem mudar nada
  - Então nenhum evento é gravado.
  - Dada Ana, que troca a função de Igor de Membro para Líder
  - Então Igor mostra "Alterado por Ana Souza", e a Auditoria tem a alteração de Igor com o campo "Função", de Membro para Líder.
- **RN-16**
  - Dada Ana, Administradora com "Visualizar Auditoria"
  - Quando ela tenta, pela API, criar, alterar ou apagar um evento
  - Então nada muda, e a tentativa recebe erro de permissão ou não afeta nenhuma linha.
- **RN-17**
  - Dados um evento "Falha no login" de 89 dias atrás e outro de 92 dias atrás
  - Então o primeiro está na Auditoria, e o segundo não está.
  - Dados um evento "Login" de 360 dias atrás e outro de 368 dias atrás
  - Então o primeiro está, e o segundo não.
  - Dado o evento de cadastro de Igor, de 2 anos e 2 dias atrás
  - Então ele não está mais na Auditoria, e o cadastro de Igor continua mostrando "Cadastrado por Bruno Lima…".
  - Dado AU, que abre a Auditoria
  - Então vê a nota com os prazos de guarda.
- **RN-18**
  - Dada uma Auditoria com 12.000 eventos guardados
  - Quando AU a abre
  - Então vê o total "12.000 eventos", a primeira página com os mais recentes, e chega ao evento mais antigo pela última página, sem corte.
  - Quando AU filtra a ação "Alteração", a entidade "Célula" e o período de 01/11/2026 a 15/11/2026
  - Então vê só as alterações de células desses dias, inclusive as de 15/11/2026 às 23:59, com o total certo.
  - Quando AU busca "igor nunes" (sem maiúsculas)
  - Então acha os eventos de Igor em todo o período guardado, e não só entre os 500 mais recentes. A busca "Otavio" acha "Otávio".
  - Dado Bruno, sem "Visualizar Auditoria"
  - Então não vê a Auditoria, e a leitura pela API não devolve nenhum evento.
- **RN-19**
  - Dada Ana, que abre Igor e toca "Ver histórico"
  - Então vê só os eventos de Igor, do mais recente para o mais antigo, inclusive os de antes de uma exclusão e restauração, e o do cônjuge definido por outra pessoa.
  - Dado o relatório da célula de Carla, com participantes incluídos e retirados depois do envio
  - Quando Ana toca "Ver histórico" nele
  - Então vê o envio, com os participantes enviados, e cada alteração, com os participantes incluídos e retirados nela. Os eventos de participante de antes deste passo também aparecem, como eventos do relatório.
  - Dada Ana, na Auditoria, que abre o detalhe do evento de alteração de Igor
  - Quando toca "Ver histórico deste membro"
  - Então vê o histórico de Igor.
  - Dada Ana, com o cadastro de Igor aberto e um campo alterado sem salvar
  - Quando toca "Ver histórico"
  - Então a tela pede para descartar as alterações antes de abrir o histórico.
  - Dado Bruno, sem "Visualizar Auditoria"
  - Então não vê "Ver histórico".
- **RN-20**
  - Dado Bruno, que troca o líder de Igor de Bruno Lima para Pedro Alves e muda o celular de Igor
  - Quando AU abre o evento
  - Então vê a ação "Alteração", "Líder: Bruno Lima → Pedro Alves" e o campo "Celular/WhatsApp", sem valor, e nenhum nome técnico (`leader_id`, `mobile_whatsapp`) nem JSON.
  - Dada a alteração da oferta de um relatório de 50 para 80
  - Então o evento mostra "Oferta: R$ 50,00 → R$ 80,00", e a descrição traz a data do relatório como `dd/mm/aaaa`.
  - Dado o filtro "Ação"
  - Então a opção é "Alteração", e não "Atualização", e o filtro "Entidade" tem "Função" e não tem "Participante".
  - Dado um evento de antes deste passo, gravado como "Atualizou o membro Igor Nunes", e outro, "Adicionou Lia ao relatório da célula de Carla Dias em 2026-11-18"
  - Então a tela mostra "Alterou o membro Igor Nunes" e "Incluiu Lia no relatório de 18/11/2026 da célula de Carla Dias", este como evento do relatório, com o mesmo autor e o mesmo momento de antes.

### Textos de tela
Vocabulário de referência. O `ux-designer` pode ajustar o tom, mas não o sentido nem os termos.

- **Termos:** Cadastrado por, Cadastrada por, Enviado por, Alterado por, Alterada por, em … às …, Sistema, autor não registrado, data não registrada, sistema anterior, Ver histórico, Auditoria, evento, Alteração.
- **Evitar:** "Criado por" (no membro e na célula, use "Cadastrado"; no relatório, "Enviado"), "Atualização", "Atualizado" e "Atualizou", "Criou" (em membro, célula e relatório), "Registrou" (no relatório, use "Enviou"), "Adicionou" e "Removeu" (nos participantes, use "Incluiu" e "Retirou"), "log", "usuário" no lugar do nome da pessoa, e nomes técnicos de campos.
- **Login:** "Login" e "Logout" seguem a tela do E1.04 (P-AUD-25).

| Situação | Texto |
|---|---|
| autoria do membro | Cadastrado por {Nome} em {dd/mm/aaaa} às {HH:mm} · Alterado por {Nome} em {dd/mm/aaaa} às {HH:mm} |
| autoria da célula | Cadastrada por {Nome} em … às … · Alterada por {Nome} em … às … |
| autoria do relatório | Enviado por {Nome} em … às … · Alterado por {Nome} em … às … |
| autor sem pessoa | Sistema |
| autor desconhecido | autor não registrado (ex.: "Cadastrado em 10/03/2023 às 14:00 · autor não registrado") |
| data desconhecida | data não registrada (ex.: "Cadastrado por Maria Alves (sistema anterior) · data não registrada") |
| autor do sistema anterior | {Nome} (sistema anterior) · Administrador (sistema anterior), no lugar de "AdminUser" |
| excluído no sistema anterior (lista Excluídos) | Excluído em {data} às {hora} · por {Nome} (sistema anterior) |
| ação no registro aberto | Ver histórico |
| Auditoria: título do histórico | Histórico de {Nome} · Histórico da célula de {Líder} · Histórico do relatório de {dd/mm/aaaa} da célula de {Líder} · Ver toda a Auditoria |
| Auditoria: ações | Criação · Alteração · Exclusão · Restauração · e as de login e de senha do E1.04 e do E2.03 |
| Auditoria: entidades | Membro · Célula · Relatório · Função · Autenticação (os eventos de participante de antes deste passo aparecem como Relatório) |
| Auditoria: filtros | Buscar · Ação · Entidade · Status · De · Até |
| Auditoria: total | {N} eventos · 1 evento |
| Auditoria: nota de guarda | Os eventos ficam guardados por 2 anos. Login e logout, por 1 ano. Falhas, recusas e bloqueios, por 90 dias. |
| Auditoria: descrições (P-AUD-22) | Cadastrou o membro {Nome} · Alterou o membro {Nome} · Excluiu o membro {Nome} · Restaurou o membro {Nome} · Cadastrou a célula de {Líder} · Alterou a célula de {Líder} · Excluiu a célula de {Líder} · Restaurou a célula de {Líder} · Enviou o relatório de {dd/mm/aaaa} da célula de {Líder} · Alterou o relatório de … · Excluiu o relatório de … · Restaurou o relatório de … · nos eventos de antes deste passo: Incluiu {Nome} no relatório de … · Retirou {Nome} do relatório de … |
| Auditoria: participantes do relatório (P-AUD-24) | Participantes: {nomes} (no envio) · Participantes incluídos: {nomes} · Participantes retirados: {nomes} (na alteração) |
| ação no detalhe do evento (P-AUD-21) | Ver histórico deste membro · Ver histórico desta célula · Ver histórico deste relatório |
| salvar sem mudança (P-AUD-20) | Nenhuma alteração para salvar. |
| Auditoria: campos mudados | {Campo}: {antes} → {depois} · {Campo} (só o nome, nos campos sem valor) · (vazio) |
| Auditoria: funções | Criou a função {Nome} · Alterou a função {Nome} · Nome: {anterior} → {novo} · Permissões incluídas: {rótulos} · Permissões retiradas: {rótulos} · {Nome} passou a ser a função padrão (antes: {Nome}) · Excluiu a função {Nome} |
| Auditoria: autor | Sistema (gravação sem pessoa) · — (login sem sessão, como no E1.04) |
| erro ao salvar com a Auditoria indisponível | o erro de conexão que a tela já usa (E2.01 e E2.03) |

### Fora de escopo
Cada item indica o passo que cuida dele.
- **Filtros por período de cadastro** em Membros e Células (MEM-13, CEL-06): E2.07 e E2.10, usando a data de cadastro desta spec (RN-03, RN-10 d).
- **Detalhe da célula** com os últimos relatórios (CEL-07): E2.10. Quando existir, mostra a autoria (RN-07).
- **"Novos membros" e "Novas células" da semana** no Dashboard (DSH-02): E2.14, pela data de cadastro desta spec.
- **Consulta "Ver relatório" em todas as linhas** de Relatórios: E2.12 (alternativa da PO-UX-3 do E2.01). Se entrar, mostra a autoria.
- **Relatório numa RPC atômica e retrato da célula** (REL-09, REL-10): E2.11, seguindo a RN-04 (d) e (e).
- **Caminho da liderança e G12 calculados** (HIE-02, HIE-03): E2.06. São campos calculados e não contam como alteração.
- **Eventos de login e de senha** (textos, campos e motivos): E1.04 e E2.03. Este passo só define o prazo de guarda deles (RN-17) e a ação "Alteração".
- **Carga:** colunas de destino (E4.02), transformação (E4.06), recálculo (E4.07), contas (E4.08) e reconciliação (E4.09), seguindo a RN-10 e a RN-11.
- **Auditoria por escopo** (quem audita vê só o próprio ministério): sem passo no plano (E2.02).
- **Exportar a Auditoria** e alertas automáticos sobre alterações: sem passo no plano.
- **Valores dos dados sensíveis na Auditoria** (CPF, e-mail, telefones, endereço): continuam fora, como hoje (RN-20 b).
- **Autoria de cada participante** na tela do relatório: fora. A Auditoria mostra quem incluiu e quem retirou cada um.
- **"Ver histórico" na lista "Excluídos"**: sugestão para depois. Neste passo, ele fica no registro aberto e no detalhe do evento.
- **Trocar "Login" e "Logout" por termos em português** em todas as telas: sem passo no plano. Exigiria mudar o E1.04 junto (P-AUD-25).
- **Reescrever o texto guardado dos eventos antigos:** a decisão entre montar a descrição na tela ou reescrever por migration é do `architect` (AQ-5). O que o evento registra não muda (RN-20 e).
- **Autoria na tela de Funções:** fora (P-AUD-01). As mudanças de funções ficam na Auditoria (RN-15).
- **LGPD:** a anonimização a pedido do titular, que precisa cobrir os nomes na Auditoria, é um processo à parte, sem passo no plano.
- **Consolidação e Escolas:** seguem esta spec nos próprios specs (ver Impactos).

### Impactos em outros passos
Pontos de negócio que outros passos precisam respeitar. O `architect` decide como.
- **E2.01:**
  - a lista "Excluídos" passa a mostrar o autor do legado nas exclusões vindas de lá (RN-11), no lugar de "Autor não registrado". A DT-01 continua: quem excluiu no novo aponta para o cadastro do membro; o nome do legado é guardado à parte;
  - excluir e restaurar passam a mudar a autoria do registro (RN-06), na mesma operação (RN-20 de lá);
  - o texto da lista "Excluídos" ("Autor não registrado (exclusão sem autor, como as vindas do legado)") precisa ser ajustado no aceite.
- **E2.02:** o nome do autor fora do escopo e o do autor excluído (RN-08) precisam chegar à tela só como nome. A `member_names` hoje cobre só quem está na view de quem consulta e os líderes dela (DT-23 de lá), e ignora os excluídos (E2.01). A Auditoria continua para a igreja toda (P-PER-18).
- **E2.03:** os eventos de senha não mudam a autoria (RN-04 c) e entram nos prazos de guarda (RN-17). A legibilidade desenhada lá (UXD-11) continua.
- **E1.04:** a RN-17 responde ao risco 5 (90 dias para falhas e bloqueios) e a RN-18 responde à AQ-6 (Auditoria paginada).
- **E2.06:** caminho da liderança, G12 e o nível propagado são campos calculados e não alteram ninguém (RN-04 c, RN-05).
- **E2.07 e E2.10:** os filtros por período de cadastro usam a data de cadastro desta spec e não incluem "data não registrada" (RN-10 d).
- **E2.11:** a RPC de relatório grava com o autor da sessão; o envio inclui os participantes, sem gerar "Alterado" (RN-04 d); cada edição é uma alteração só (RN-04 e), com um evento só, que traz os participantes incluídos e retirados (RN-13 b); o retrato da célula não conta.
- **E2.01:** a gravação dos participantes (`set_cell_report_participants`, DT-15 de lá) e o gatilho de participantes deixam de gerar um evento por participante: os participantes entram no evento do relatório (P-AUD-24).
- **E2.14:** "Novos membros" e "Novas células" contam pela data de cadastro, na semana de domingo a sábado de Brasília, e nunca contam "data não registrada" (RN-10 d).
- **E4.02, E4.06 e E4.09 e a seção 5.5 do `docs/migracao.md`:**
  - mapear `CreatedBy`, `CreationDate`, `LastModifiedBy` e `LastModifiedDate` também nas tabelas de Cells e Reports, que hoje só citam as datas;
  - tirar o "se MEM-12 for aprovada" do mapeamento dos autores;
  - trocar "Data nula vira a data da migração" pela RN-10 (d), senão os cadastros sem data contariam como novos na semana do cutover;
  - a reconciliação confere, por entidade, quantos registros têm autor e data de cadastro e de alteração, contra o legado.
- **E4.07 e E4.08:** o recálculo e a criação das contas não mudam a autoria nem geram eventos (RN-10 e).
- **Consolidação (futuro):** a conversão de consolidado em membro é uma alteração do registro, com quem converteu e quando, e o cadastro original continua.
- **Escolas:** a DT-31 (`created_by` apontando para o cadastro do membro) já segue a convenção. A autoria na tela (RN-07), a Auditoria legível (RN-20), o tudo ou nada (RN-14) e os prazos de guarda (RN-17, categoria "os demais") valem quando Escolas gravar eventos.
- **Aceite (PO):**
  - atualizar a MEM-12 na 3.2 (colunas "Novo" e "Onde impor") e o item "`created_by` / `updated_by`" da 5.3;
  - na matriz do `CLAUDE.md`, a observação de "CRUD de membros" ("a auditoria não registra o autor de cadastros feitos pela Edge Function") já foi resolvida no E1.02 e sai no aceite deste passo.

### Pontos para o `architect`
Não são dúvidas de negócio. São pontos em que a regra depende de uma escolha técnica.
1. **Data de alteração de hoje.** A dos membros muda a cada gravação, inclusive nas feitas pelos triggers de totais e de nível (`update_updated_at_column`). Nas células, nenhuma migration parece mantê-la, e nos relatórios depende de qual definição da tabela valeu (E1.01). Decidir se a autoria usa essas colunas, com outra regra, ou colunas novas (RN-04, RN-05).
2. **Cadastro forjável.** A regra 3 do E1.03 protege a data de cadastro só na alteração; no cadastro, o app ainda a define. A RN-03 vale para as três tabelas e para os autores.
3. **Autor de três origens.** Membro do novo, nome do legado (texto, sem ligação) e "Sistema", além de "autor não registrado". As colunas novas de `members` precisam de `GRANT SELECT (coluna)` na própria migration (5.3; risco 4 do E1.08).
4. **Nome do autor** fora do escopo e excluído (RN-08): a `member_names` não cobre esses casos. O padrão do E2.02 (DT-23) são os nomes de referência nas próprias views.
5. **Uma lista de campos por entidade.** O que conta como alteração (RN-04) e o que a Auditoria registra (RN-13 c) precisam sair da mesma lista. Hoje as listas da Auditoria deixam de fora rua, número, complemento, estado e CEP da célula, e horário, observações e visitantes do relatório.
6. **Tudo ou nada (RN-14).** Hoje os triggers de auditoria engolem erros, fora o ramo de exclusão e restauração do E2.01. Sem engolir, um defeito na Auditoria bloqueia as gravações: os testes precisam cobrir cada caminho.
7. **Envio e edição do relatório.** Até o E2.11, o relatório e os participantes são gravados em chamadas separadas (`CellReportForm`, DT-15 do E2.01). A RN-04 (d) pede que os participantes do envio não gerem "Alterado", e a RN-13 (b) pede um evento só por envio ou alteração, com os participantes dentro dele.
8. **"data não registrada"** com a data de cadastro obrigatória na tabela: representar sem inflar o Dashboard (DSH-02) nem os filtros (RN-10 d).
9. **Funções num evento só por gravação (RN-15).** Hoje a função e as permissões são gravadas em chamadas separadas, e a troca da função padrão não é atômica (`Roles.tsx`). O tipo de entidade da Auditoria não tem "função".
10. **Prazo de guarda (RN-17).** Remoção automática por categoria. O E1.04 já depende do `pg_cron`. Conferir também os privilégios de escrita em `events` (UPDATE, DELETE e TRUNCATE para `anon` e `authenticated`), como a DT-02 do E2.01 fez nas outras tabelas (RN-16).
11. **Auditoria paginada (RN-18, RN-19).** Busca sem acento no servidor (padrão do E1.08), total, período em datas de Brasília e filtro por registro. Já existem índices por data e por entidade e registro. Se o total exato ficar caro, a alternativa volta ao PO.
12. **Valores legíveis (RN-20 c).** O nome das pessoas no momento da alteração precisa ser guardado quando o evento é gravado; hoje o evento guarda só os identificadores.
13. **Volume.** Estimativa do PO, com os participantes dentro do evento do relatório (P-AUD-24): com 300 células, cerca de 300 eventos de relatório por semana, ou uns 20 mil eventos de dados por ano, mais os logins. Com um evento por participante, seriam cerca de 140 mil por ano. Conferir o espaço no plano atual do Supabase com 2 anos de guarda.

### Perguntas em aberto
Nenhuma. Os pontos que as fontes não respondiam viraram padrões, listados em "Padrões definidos por este spec", para o usuário revisar no PR. Os que mais mudam o resultado são:
- P-AUD-03: só a mudança real conta, diferente do legado, que marcava qualquer gravação;
- P-AUD-04: a mudança de cônjuge feita a partir do outro cadastro conta como alteração dos dois;
- P-AUD-06: quem abre o registro vê a autoria, sem permissão nova;
- P-AUD-12: sem o evento na Auditoria, a alteração não acontece;
- P-AUD-14: os prazos de guarda (90 dias, 1 ano e 2 anos);
- P-AUD-15 e P-AUD-16: a Auditoria paginada e o "Ver histórico" entram neste passo;
- P-AUD-09: o cadastro do legado sem data fica com "data não registrada", e não com a data da migração;
- P-AUD-24: os participantes entram no evento do envio ou da alteração do relatório, sem um evento por participante.

## Experiência (UX)
_Seção do `ux-designer`. Escrita em 2026-11-23 a partir destas fontes:_
- _a seção Negócio (RN-01 a RN-20, P-AUD-01 a P-AUD-19, a massa de exemplo e os Textos de tela);_
- _o código da `origin/main` do `mci-connect` (`fdcbe50`): `src/pages/Events.tsx`, `src/pages/Members.tsx`, `MemberForm.tsx`, `CellForm.tsx`, `CellReportForm.tsx`, `ListPagination.tsx`, `use-list-search-params.ts` e os gatilhos de auditoria das migrations `20261114200000_e101_reconcile_schema.sql` e `20261123233400_e201_04_write.sql`;_
- _o que já foi desenhado para as mesmas telas: a Auditoria na T2 do [E1.04](e1-04-sign-in.md) e na T8 do [E2.03](e2-03-senha.md); as listas de excluídos (T4), o painel "Ver relatório" (T7) e a T11 do [E2.01](e2-01-exclusao-logica.md); o `MemberForm` na T6 do [E2.02](e2-02-perfis-escopo.md), na T5 do E2.03 e na T1 e na T7 do [E2.04](e2-04-validacoes-membro.md); e os filtros de Turmas (T4) de [Escolas](escolas.md)._

_Este passo só é implementado depois daqueles, então o desenho parte das telas deles, e não do código de hoje. Usa os padrões P1 a P24. Os padrões novos começam em P30, para não colidir com os specs em andamento. Nenhuma regra de negócio foi criada aqui. Onde a tela precisou de algo que o spec não diz, a decisão é a mais conservadora, marcada como "definido pela UX" e listada em "Pendências para o PO". Os nomes são os da [massa de exemplo](#massa-de-exemplo); Maria Alves e João Pires são autores vindos do sistema anterior, como nos critérios da RN-10 e da RN-11._

### O que muda, tela a tela
| Tela | O que muda | Para quem |
|---|---|---|
| Autoria no registro aberto (T1) | bloco novo, no topo do registro, com quem cadastrou (ou enviou) e quem alterou por último; "Ver histórico" | quem abre o registro; "Ver histórico" só para quem audita |
| Cadastro de membro (T2) | o bloco em "Editar membro", "Editar meus dados" e "Meus dados" | todos que abrem um cadastro |
| Formulário de célula (T3) | o bloco, na edição | quem tem "Editar Célula" |
| Formulário de relatório e "Ver relatório" (T4) | o bloco, com "Enviado por" | quem edita ou consulta um relatório |
| Salvar, nos três formulários (T5) | salvar sem mudança não grava e avisa; a falha da Auditoria aparece como erro de conexão, com os dados mantidos | todos que editam |
| Listas "Excluídos" (T6) | o autor das exclusões feitas no sistema anterior | quem pode restaurar |
| Auditoria (T7 a T10) | paginada no servidor e com o total; busca e filtros no servidor, com período; cards no celular, com os filtros num painel; histórico de um registro; detalhes legíveis, sem JSON; "Alteração", "Função" e "Sistema"; nota de guarda; tela sem acesso no lugar do redirecionamento | quem audita |
| Funções, Dashboard, Ministérios, listas e seletores | sem mudança visual. As mudanças de funções aparecem só na Auditoria (RN-15) | — |

### Coerência com os outros specs
- **E1.04 (T2) e E2.03 (T8):** continuam valendo os rótulos das ações de login e de senha, a ordem delas no filtro, a segunda linha da descrição e os campos com nome do painel ("Cadastro", "Motivo", "Tipo de identificação"…). Mudam:
  - no celular, a tabela com rolagem horizontal vira uma lista de cards (UXD-3), com a mesma segunda linha;
  - o badge "Erro" passa ao P6; o "OK" continua `outline` (E1.04);
  - o filtro "Ação" ganha "Alteração" (no lugar de "Atualização") e "Restauração" (E2.01), no começo da lista.
- **E2.01:**
  - nas listas de excluídos (T4), só muda o autor vindo do sistema anterior (T6);
  - o painel "Ver relatório" (T7) ganha a autoria e "Ver histórico" (T4 deste spec);
  - o cônjuge desfeito pela exclusão (T11) passa a aparecer como "Alteração" do cônjuge, e não "Atualização".
- **E2.02:**
  - "Meus dados" (T6) mostra a autoria, só para leitura;
  - a Auditoria adota o estado sem acesso do P13, que lá ficou "sem urgência";
  - o subtítulo segue o P10 ("Eventos de toda a igreja"), porque a Auditoria não segue o escopo (P-PER-18).
- **E2.04 (T1 e T7):** a autoria entra no topo do corpo rolável do diálogo, acima de "Campos com * são obrigatórios.". A mensagem de conexão do rodapé é a que a RN-14 pede.
- **E2.03 (T5):** a seção Acesso não muda. Redefinir a senha não muda a autoria (RN-04 c), então o bloco fica igual depois de "Senha redefinida às {hh:mm}…".
- **E1.08:** a Auditoria passa a usar o `useListSearchParams`, o `useClampPage`, o `ListPagination` e o `placeholderData`, como Membros.
- **Escolas (T4):** os filtros no celular seguem o mesmo desenho: o botão "Filtros ({N})", o `Sheet` e os chips removíveis.

### Decisões de experiência
| # | Decisão | Por quê |
|---|---|---|
| UXD-1 | **A autoria fica no topo do corpo do registro aberto**, abaixo dos avisos e acima do primeiro campo, em texto pequeno, uma frase por linha (P30). Não fica no cabeçalho fixo nem no fim do formulário. | A história é "saber com quem falar quando um dado está errado": a pessoa abre o registro e lê, sem procurar. No fim de um cadastro de mais de 20 campos, ninguém a acharia no celular. No cabeçalho fixo, ela ocuparia de 3 a 4 linhas da tela o tempo todo. No topo do corpo, custa cerca de 80 px e sai da vista quando a pessoa rola. O envio de um relatório novo, o fluxo mais frequente, não muda: a autoria só aparece em registro já gravado. |
| UXD-2 | **"Ver histórico" é um link, logo abaixo da autoria, que abre a Auditoria na mesma aba** (P31). Com alterações não salvas, pede antes o "Descartar as alterações?" do E2.04. | A RN-19 manda abrir a Auditoria, que tem paginação, busca e filtros. Um painel sobre o formulário seriam, no celular, duas telas cheias empilhadas. Como link, o "voltar" do navegador funciona, e no computador dá para abrir em outra aba. Ver PO-UX-7. |
| UXD-3 | **A Auditoria vira cards no celular e continua tabela no computador.** Sai a rolagem horizontal do celular. Cada card é um botão que abre o mesmo painel de detalhes (P34). | São 6 colunas: em 360 px, a descrição, que é o que importa, fica fora da tela. No card, a descrição vem primeiro, e o autor, a data, a ação e a entidade vêm embaixo. |
| UXD-4 | **No celular, os filtros ficam num painel (`Sheet`) aberto pelo botão "Filtros ({N})" e valem ao tocar em "Aplicar filtros". Os ativos aparecem como chips removíveis.** No computador, ficam acima da lista e valem na hora. Todo o estado fica na URL. | São 5 filtros, que no celular empurrariam a lista para a segunda tela. Aplicar de uma vez evita uma consulta a cada escolha numa conexão fraca. Com a URL, recarregar ou compartilhar o link mostra a mesma coisa, como nas listas do E1.08. |
| UXD-5 | **O período usa os campos de data nativos, "De" e "Até", num grupo "Período"** (P33). | No celular, o seletor nativo é o mais conhecido e o mais leve. No aparelho em português, a data aparece como dd/mm/aaaa. |
| UXD-6 | **Na alteração, a segunda linha da descrição traz os nomes dos campos mudados** (até 3, e "e mais {N}"). Os valores ficam no painel. | Quem procura "quem mudou o líder" bate o olho na lista sem abrir cada evento. Com os valores, cada evento ocuparia várias linhas. |
| UXD-7 | **O painel mostra os campos mudados numa lista, "Campo: antes → depois", com os nomes da tela, sem o bloco de JSON** (P32). O campo "Identificação" vira "Registro" fora da autenticação. | RN-20. "Identificação" é o nome do campo do login (E1.04), que já chamou o cadastro da autenticação de "Cadastro". "Registro" é o termo deste spec. |
| UXD-8 | **O painel do evento também tem "Ver histórico deste membro"** (desta célula, deste relatório). *Definido pela UX (PO-UX-2), aceito pelo PO (P-AUD-21).* | Quem audita acha um evento pela busca e quer ver o que mais aconteceu com aquele registro. Sem o atalho, teria de sair da Auditoria, achar o registro na lista e abri-lo. |
| UXD-9 | **Salvar sem mudar nada fecha o formulário sem chamar o servidor e avisa "Nenhuma alteração para salvar."** *Definido pela UX (PO-UX-1).* | Pelo P-AUD-03, nada muda. Hoje a tela diria "Membro atualizado com sucesso", e o registro continuaria mostrando outra pessoa em "Alterado por". O aviso honesto evita a dúvida. |
| UXD-10 | **A Auditoria sem permissão mostra a tela sem acesso do P13**, sem redirecionar. | Hoje ela volta para o início sem explicar, o que parece um erro. O E2.02 já desenhou o estado. |
| UXD-11 | **As descrições dos eventos usam o vocabulário deste spec**: "Cadastrou", "Alterou", "Enviou", "Incluiu" e "Retirou", com as datas em dd/mm/aaaa. *Definido pela UX (PO-UX-3).* | Os Textos de tela pedem "Alteração" e evitam "Atualização" e "Criado por". Hoje as descrições dizem "Atualizou", "Criou", "Registrou", "Adicionou" e "Removeu", com a data `2026-11-23`. |
| UXD-12 | **A nota de guarda fica sempre à vista, abaixo do subtítulo, nos dois modos da Auditoria.** | Quem não acha um evento antigo precisa saber, sem procurar, que ele pode já ter saído pelo prazo. No histórico de um registro, a nota explica uma lista curta. |

### Navegação e rotas
- **Nenhuma rota nova.** A `/events` passa a guardar o estado na URL:
  - `q`, `page` e `size`, pelo `useListSearchParams`, como em Membros;
  - `action`, `entity`, `status` (`success` ou `error`), `from` e `to` (`aaaa-mm-dd`, datas de Brasília);
  - `record_type` (`member`, `cell` ou `cell_report`) e `record_id`, para o histórico de um registro. Os nomes são sugestões (AQ-9).
  - Os valores padrão não aparecem. Um valor inválido é ignorado e sai da URL, como o `?report=` do E2.01.
  - Mudar a busca, um filtro ou o tamanho volta para a página 1.
- **"Ver histórico"** (no registro aberto e no painel do evento) leva a `/events?record_type=…&record_id=…`, sem os outros filtros.
  - O formulário fecha com a troca de rota. Com alterações, antes, o "Descartar as alterações?" do E2.04.
  - O "voltar" do navegador leva à lista de onde a pessoa veio, com a busca e a página, mas com o formulário fechado (PO-UX-7).
- **"Ver toda a Auditoria"** leva a `/events`, sem nenhum parâmetro.
- **Item ativo do menu:** "Auditoria", nos dois modos.
- **Sem "Visualizar Auditoria":** a `/events`, com ou sem parâmetros, mostra o estado sem acesso do P13 (UXD-10).

### Fluxos
Contagem no celular, a partir de qualquer tela com o menu fechado, incluindo o toque no ☰. "Toque" não conta a digitação.

| # | História | Caminho | Toques e telas |
|---|---|---|---|
| F1 | O líder vê quem alterou um membro (Bruno abre Igor) | ☰ → Membros → busca → ✎ → lê a autoria no topo | 3 toques e a busca; 1 tela e 1 diálogo |
| F2 | O membro vê a autoria do próprio cadastro (Carla) | ☰ → ✎ "Editar meus dados" → lê | 2 toques |
| F3 | Quem não tem função vê a própria autoria (Hugo) | ☰ → "Ver meus dados" → lê | 2 toques |
| F4 | Quem audita abre o histórico de um membro (Ana, computador) | Membros → busca → ✎ → "Ver histórico" → linha → painel | 4 cliques e a busca |
| F5 | Quem audita abre o histórico de um relatório (Ana, computador) | Relatórios → busca → ✎ → "Ver histórico" | 3 cliques e a busca |
| F6 | Quem audita procura as alterações de células num período (Ana, computador) | Auditoria → Ação "Alteração" → Entidade "Célula" → De → Até | 1 clique no menu, 4 cliques nas seleções e as 2 datas |
| F7 | O mesmo no celular | ☰ → Auditoria → "Filtros" → Ação → "Alteração" → Entidade → "Célula" → De (seletor nativo) → Até (seletor nativo) → "Aplicar filtros" | cerca de 14 toques, contando a confirmação dos seletores de data; 1 tela e 1 painel |
| F8 | Quem audita procura os eventos de uma pessoa | ☰ → Auditoria → digita "igor nunes" → card → painel | 3 toques e a digitação |
| F9 | Quem audita descobre quem mudou as permissões de uma função (computador) | Auditoria → Entidade "Função" → linha → painel com as permissões incluídas e retiradas | 4 cliques |
| F10 | Do evento para o histórico do registro (UXD-8) | painel → "Ver histórico deste membro" | 1 toque |
| F11 | Chegar ao evento mais antigo (RN-18) | rodapé → "Última página" | 1 toque |
| F12 | Salvar sem mudar nada | "Salvar alterações" → o formulário fecha, com "Nenhuma alteração para salvar." | 1 toque, sem ida ao servidor |
| F13 | A Auditoria falha ao salvar (RN-14) | "Salvar alterações" → mensagem de conexão, com os dados mantidos → "Salvar alterações" de novo | +1 toque, sem redigitar |
| F14 | Quem pode restaurar vê quem excluiu no sistema anterior | ☰ → Relatórios → "Excluídos" → lê "por João Pires (sistema anterior)" | 3 toques |

### Telas
Convenções do E2.02 e do E2.04: 360 px ≈ 38 colunas; `[Botão]` é botão; `[▾]` é seleção; `(i)` é informação; `⚠` é erro. Novos: `⟲` é o ícone `History`; `⚲` é o ícone `SlidersHorizontal`; `(… ✕)` é um chip removível. A margem lateral é a do `AppLayout` ou a do diálogo (`p-4`).

#### T1. Autoria no registro aberto (componente comum, P30)
Celular (360 px), no topo do corpo rolável do diálogo (P1):
```
Ana abre Igor ("Editar membro")
┌──────────────────────────────────────┐
│ ✕  Editar membro                     │  cabeçalho fixo (P1)
│──────────────────────────────────────│
│ Cadastrado por Bruno Lima em         │  text-sm, cor muted; o nome em
│ 18/11/2026 às 19:40                  │  font-medium text-foreground
│ Alterado por Ana Souza em 20/11/2026 │
│ às 10:15                             │
│ [⟲ Ver histórico]                    │  só com "Visualizar Auditoria"; outline, h-11
│──────────────────────────────────────│  Separator
│ Campos com * são obrigatórios.       │  E2.04
│ Dados pessoais                       │
│ …                                    │
```
Variações do bloco:
```
Nunca alterado                           Alterada por uma rotina (Sistema)
│ Cadastrado por Bruno Lima em         │ │ Cadastrada por Ana Souza em          │
│ 18/11/2026 às 19:40                  │ │ 02/11/2026 às 09:00                  │
                                         │ Alterada por Sistema em 22/11/2026   │
                                         │ às 03:00                             │

Vindo do sistema anterior                Relatório
│ Cadastrado por Maria Alves (sistema  │ │ Enviado por Carla Dias em 25/11/2026 │
│ anterior) em 10/03/2023 às 14:00     │ │ às 21:05                             │
│ Alterado por João Pires (sistema     │ │ Alterado por Ana Souza em 26/11/2026 │
│ anterior) em 05/06/2024 às 09:15     │ │ às 08:40                             │

Sem autor                                Sem data
│ Cadastrado em 10/03/2023 às 14:00 ·  │ │ Cadastrado por Maria Alves (sistema  │
│ autor não registrado                 │ │ anterior) · data não registrada      │

Sem autor e sem data
│ Cadastrado · autor não registrado ·  │
│ data não registrada                  │
```
Computador (no `Dialog` de `max-w-3xl` do E2.04):
```
│ Editar membro                                                       ✕  │
│────────────────────────────────────────────────────────────────────────│
│ Cadastrado por Bruno Lima em 18/11/2026 às 19:40     [⟲ Ver histórico] │
│ Alterado por Ana Souza em 20/11/2026 às 10:15                          │
│────────────────────────────────────────────────────────────────────────│
│ Campos com * são obrigatórios.                                         │
```
- **Montagem da frase** (uma função pura, testada por tabela, UX-01):
  - o verbo vem da entidade: membro, "Cadastrado" e "Alterado"; célula, "Cadastrada" e "Alterada"; relatório, "Enviado" e "Alterado" (RN-07, P-AUD-18);
  - depois, " por {Autor}", quando há autor, e " em {dd/mm/aaaa} às {HH:mm}", quando há data;
  - no fim, " · autor não registrado" e " · data não registrada", quando faltam. O caso sem os dois junta as duas marcas do Negócio, sem texto novo;
  - o autor é o nome atual do membro (RN-08), "Sistema", ou o nome vindo do sistema anterior seguido de " (sistema anterior)". "AdminUser" vira "Administrador (sistema anterior)" (RN-10 b): a tela nunca mostra "AdminUser";
  - a data e a hora são as de Brasília (`timeZone: "America/Sao_Paulo"`), qualquer que seja o fuso do aparelho.
- **Linha "Alterado":** só quando o dado diz que houve alteração. A regra de quando há (RN-04 d, RN-10 c, RN-12) fica no servidor; a tela não compara datas.
- **Nome do autor:** só texto, sem link, sem botão e sem nenhum outro dado da pessoa (RN-08).
- **"Ver histórico" (P31):**
  - só com "Visualizar Auditoria" (RN-19);
  - um `Link` com o visual do `Button variant="outline"`, o ícone `History` (`aria-hidden`), `h-11` no celular e `md:h-9`;
  - `aria-label` com o registro, contendo o texto visível (WCAG 2.5.3): "Ver histórico de Igor Nunes", "Ver histórico da célula de Carla Dias", "Ver histórico do relatório de 25/11/2026";
  - no celular, embaixo das frases, alinhado à esquerda; a partir de `md`, à direita da primeira linha (`md:flex-row md:justify-between`, o botão com `shrink-0`).
- **Separador:** um `Separator` depois do bloco separa o que é sobre o registro dos campos.
- **Carregando:** se a autoria vier com o registro (AQ-1), nada carrega. Se vier numa leitura à parte, o bloco mostra 2 linhas de `Skeleton` (`h-4`), com a altura e o espaço do botão reservados, para o formulário não saltar.
- **Erro ao carregar** (só na leitura à parte): "Não foi possível carregar quem cadastrou e quem alterou." †, com "Tentar de novo" (`Button variant="link"`). O resto do formulário funciona.
- **Onde não aparece** (RN-07): no registro novo ("Novo membro", "Nova célula" e o relatório novo), nas listas, nos seletores, no Dashboard e em Ministérios.
- Componentes: `Separator`, `Skeleton` e `Button` (`asChild`, com o `Link`). Sugestão: o bloco num componente como `RecordAuthorship`, em `src/components/`, e a montagem da frase em `src/lib/audit/`.

#### T2. Cadastro de membro (`MemberForm`)
```
Carla: "Editar meus dados"               Hugo: "Meus dados" (E2.02, só leitura)
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ ✕  Editar meus dados                 │ │ ✕  Meus dados                        │
│──────────────────────────────────────│ │──────────────────────────────────────│
│ Cadastrado por Bruno Lima em         │ │ ┌──────────────────────────────────┐ │
│ 02/11/2026 às 20:10                  │ │ │(i) Você pode consultar os seus   │ │  Alert do E2.02
│ Alterado por Carla Dias em           │ │ │dados, mas não alterá-los. …      │ │
│ 21/11/2026 às 22:30                  │ │ └──────────────────────────────────┘ │
│──────────────────────────────────────│ │ Cadastrado por Ana Souza em          │
│ Campos com * são obrigatórios.       │ │ 15/11/2026 às 10:02                  │
│ Dados pessoais                       │ │──────────────────────────────────────│
│ …                                    │ │ Dados pessoais                       │
│──────────────────────────────────────│ │ …                                    │
│ [Cancelar      ] [Salvar alterações] │ │──────────────────────────────────────│
└──────────────────────────────────────┘ │ [Fechar                            ] │
                                         └──────────────────────────────────────┘
```
- **Ordem no topo do corpo:** primeiro os `Alert` (o de "Meus dados" do E2.02, o do cadastro restaurado do E2.01 e as recusas da T11 do E2.02), depois a autoria e o separador, e então o resto do formulário do E2.04.
- **Cadastro restaurado** (T9 do E2.01): a autoria já mostra a restauração como a última alteração (RN-06), por exemplo "Alterado por Ana Souza em 22/11/2026 às 00:10".
- **"Ver histórico"** aparece também no próprio cadastro, para quem audita (Ana em "Editar meus dados").
- Nada mais muda no formulário.

#### T3. Formulário de célula (`CellForm`), na edição
```
┌──────────────────────────────────────┐
│ ✕  Editar célula                     │  título como estiver no E2.08
│──────────────────────────────────────│
│ Cadastrada por Ana Souza em          │
│ 02/11/2026 às 09:00                  │
│ Alterada por Bruno Lima em           │
│ 21/11/2026 às 18:30                  │
│ [⟲ Ver histórico]                    │  rótulo: "Ver histórico da célula de Carla Dias"
│──────────────────────────────────────│
│ Líder, timóteo e anfitrião são       │  dica de alcance do E2.02, quando houver
│ escolhidos entre as pessoas do seu   │
│ ministério.                          │
│ Líder *                              │
│ …                                    │
```
- O bloco da T1 fica no topo do formulário, antes da dica de alcance do E2.02 (T7 de lá) e do primeiro campo.
- O formulário de célula ainda é um `Dialog` comum. Quando o E2.08 o passar para o P1, o bloco continua no topo do corpo rolável.

#### T4. Formulário de relatório (`CellReportForm`), na edição, e "Ver relatório" (`Sheet`)
```
Editar relatório                         "Ver relatório" (T7 do E2.01)
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ ✕  Editar relatório                  │ │ ✕  Relatório de 19/11/2026           │
│──────────────────────────────────────│ │ Célula de Carla Dias                 │
│ Enviado por Carla Dias em 25/11/2026 │ │ [⊘ Célula excluída]                  │
│ às 21:05                             │ │ ┌──────────────────────────────────┐ │
│ Alterado por Ana Souza em 26/11/2026 │ │ │(i) A célula deste relatório foi  │ │
│ às 08:40                             │ │ │excluída. …                       │ │
│ [⟲ Ver histórico]                    │ │ └──────────────────────────────────┘ │
│──────────────────────────────────────│ │ Enviado por Carla Dias em 19/11/2026 │
│ Célula *                             │ │ às 21:30                             │
│ [Carla Dias · Quarta, 20:00 · …   ▾] │ │ [⟲ Ver histórico]                    │
│ …                                    │ │──────────────────────────────────────│
                                         │ Data e hora                          │
                                         │ Quarta, 19/11/2026 às 20:00          │
                                         │ …                                    │
```
- **No formulário:** o bloco fica no topo, antes do campo Célula, e só na edição. O envio de um relatório novo não muda.
- **No "Ver relatório":** depois do cabeçalho do painel (título, célula, badge e `Alert` do E2.01) e antes de "Data e hora". Quando o E2.12 levar o painel a todas as linhas, o bloco vai junto.
- **Logo depois do envio**, o relatório mostra só "Enviado por" (RN-04 d), mesmo com os participantes gravados à parte até o E2.11 (ponto 7 para o `architect`). A tela mostra o que o dado diz.
- O `aria-label` de "Ver histórico" é "Ver histórico do relatório de {dd/mm/aaaa}".

#### T5. Salvar: sem mudança e falha da Auditoria (os três formulários)
```
Sem mudança: o formulário fecha          Auditoria indisponível (RN-14): o formulário fica
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ (a lista de Membros, como estava)    │ │ …                                    │
│ ┌──────────────────────────────────┐ │ │──────────────────────────────────────│
│ │ Nenhuma alteração para salvar.   │ │ │ ⚠ Não foi possível salvar o cadastro.│  role="alert"
│ └──────────────────────────────────┘ │ │ Verifique a conexão e tente de novo. │
└──────────────────────────────────────┘ │ [Cancelar      ] [Salvar alterações] │
                                         └──────────────────────────────────────┘
```
- **Sem mudança (UXD-9, PO-UX-1):**
  - na edição, se nenhum dado mudou em relação ao que foi carregado, "Salvar alterações" fecha o formulário sem chamar o servidor e mostra o toast "Nenhuma alteração para salvar." †, sem a variante de erro;
  - "mudou" quer dizer que o valor final é diferente do carregado: digitar e voltar ao valor original não conta. No relatório, os participantes contam;
  - quando a tela acha que mudou e o servidor não (AQ-7), o toast é o mesmo. Sem a AQ-7, aparece o toast de sucesso de hoje.
- **Falha da Auditoria, do servidor ou da rede (RN-14):**
  - nada foi gravado, então a tela nunca mostra o toast de sucesso;
  - o formulário continua aberto, com tudo o que foi digitado, e a mensagem de conexão aparece junto da ação primária, com `role="alert"`;
  - membro: no rodapé fixo, com o texto do E2.04 ("Não foi possível salvar o cadastro. Verifique a conexão e tente de novo.");
  - célula e relatório, até o E2.08 e o E2.11: um `Alert` logo acima dos botões, com "Não foi possível salvar a célula. Verifique a conexão e tente de novo." † ou "Não foi possível salvar o relatório. Verifique a conexão e tente de novo." †. Hoje esses dois formulários mostram a mensagem do banco num toast;
  - a ação primária volta a ficar habilitada e serve de "Tentar de novo". Enquanto envia, mostra "Salvando…" e fica desabilitada, e um duplo toque não envia duas vezes;
  - as recusas de regra (as do E2.01, do E2.02 e do E2.04, e as da semana do relatório) continuam como estão. Só o erro que a tela não reconhece vira a mensagem de conexão (AQ-8). Nenhuma mensagem técnica aparece.
- **Exclusão e restauração:** já seguem o E2.01 (a mensagem de conexão no diálogo ou no toast).
- **Funções:** já seguem a T3 do E2.02 ("Não foi possível salvar a função. Verifique a conexão e tente de novo.").

#### T6. Listas "Excluídos" (RN-11)
Só a linha do autor muda, e só nas exclusões feitas no sistema anterior.
```
Celular (Relatórios excluídos)
│ Célula de Maria Alves                │
│ Relatório de 26/01/2025 · 20:00      │
│ [✓ Realizada] · Tema: Fé             │
│ Excluído em 02/02/2025 às 10:00      │
│ por João Pires (sistema anterior)    │
│                       [↺ Restaurar]  │

Computador, coluna "Excluído por"
│ … │ Excluído em      │ Excluído por                      │             │
│ … │ 02/02/2025 10:00 │ João Pires (sistema anterior)     │ [Restaurar] │
│ … │ 14/05/2024 18:20 │ Administrador (sistema anterior)  │ [Restaurar] │
│ … │ 03/03/2024 08:00 │ Não registrado                    │ [Restaurar] │
│ … │ 20/11/2026 08:00 │ Ana Souza                         │ [Restaurar] │
```
- "por {Nome} (sistema anterior)" no card e "{Nome} (sistema anterior)" na coluna. "AdminUser" vira "Administrador (sistema anterior)".
- Sem nome no sistema anterior: "Autor não registrado" (card) e "Não registrado" (coluna), como no E2.01.
- As exclusões feitas no novo continuam "por {Nome}".
- O nome quebra linha, sem `truncate` (E2.01).

#### T7. Auditoria (`/events`): lista
Celular (360 px). A busca, os filtros e a lista ficam dentro do `Card` da lista, como em Membros.
```
┌──────────────────────────────────────┐
│ ☰                                    │
│ Auditoria                            │  h1
│ Eventos de toda a igreja             │  subtítulo (P10) †
│ (i) Os eventos ficam guardados por 2 │  nota de guarda: text-sm, cor muted,
│ anos. Login e logout, por 1 ano.     │  ícone Info (aria-hidden)
│ Falhas, recusas e bloqueios, por 90  │
│ dias.                                │
│──────────────────────────────────────│
│ Buscar                               │
│ [🔍 Autor, registro ou descrição   ] │  h-11
│ [⚲ Filtros (2)]                      │  outline, h-11
│ (Ação: Alteração ✕)                  │  chips, h-9
│ (De: 01/11/2026 ✕)  [Limpar filtros] │
│ 1.234 eventos                        │  role="status"
│──────────────────────────────────────│
│ Alterou o membro Igor Nunes          │  card = botão; descrição em font-medium
│ Líder, Celular/WhatsApp              │  segunda linha (UXD-6)
│ Bruno Lima · 23/11/2026 às 21:50     │
│ [Alteração] Membro                   │
│──────────────────────────────────────│
│ Alterou a função Secretaria          │
│ 1 permissão incluída · 1 permissão   │
│ retirada                             │
│ Ana Souza · 23/11/2026 às 20:12      │
│ [Alteração] Função                   │
│──────────────────────────────────────│
│ Falha no login                       │
│ Senha incorreta · Ana Souza          │  segunda linha do E1.04
│ 23/11/2026 às 19:39                  │  sem autor: só a data
│ [Login (falha)] Autenticação         │
│ [⚠ Erro]                             │  P6, só quando falhou
│──────────────────────────────────────│
│ 1.234 eventos                        │  ListPagination
│ [25▾] por página                     │
│ [«][‹] Página 1 de 50 [›][»]         │
└──────────────────────────────────────┘
```
Computador (≥ 1024 px):
```
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│ Auditoria                                                                                 │
│ Eventos de toda a igreja                                                                  │
│ (i) Os eventos ficam guardados por 2 anos. Login e logout, por 1 ano. Falhas, recusas e   │
│     bloqueios, por 90 dias.                                                               │
│ ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ Buscar                                      Período                                   │ │
│ │ [🔍 Autor, registro ou descrição         ]  De [01/11/2026]   Até [15/11/2026]         │ │
│ │ Ação                 Entidade             Status                                      │ │
│ │ [Alteração        ▾] [Célula           ▾] [Todos           ▾]        [Limpar filtros] │ │
│ │ 312 eventos                                                                           │ │
│ │ Data/Hora        │ Autor      │ Ação        │ Entidade │ Descrição             │Status│ │
│ │ 15/11/2026 23:59 │ Bruno Lima │ [Alteração] │ Célula   │ Alterou a célula de   │ [OK] │ │
│ │                  │            │             │          │ Carla Dias            │      │ │
│ │                  │            │             │          │ Rua                   │      │ │
│ │ 15/11/2026 21:10 │ Sistema    │ [Alteração] │ Célula   │ Alterou a célula de   │ [OK] │ │
│ │                  │            │             │          │ Bruno Lima            │      │ │
│ │                  │            │             │          │ Cidade                │      │ │
│ │ …                                                                                     │ │
│ │ 312 eventos                           [25▾] por página  [«][‹] Página 1 de 13 [›][»]  │ │
│ └───────────────────────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```
- **Cabeçalho:** o `h1` "Auditoria", o subtítulo do P10 e a nota de guarda do Negócio (UXD-12).
- **Busca:**
  - `Input` com o rótulo "Buscar" visível, o ícone `Search` (`aria-hidden`), o placeholder "Autor, registro ou descrição" †, `type="search"`, `enterKeyHint="search"` e `maxLength={100}`;
  - vale no servidor, para todos os eventos guardados, sem diferenciar maiúsculas e acentos (RN-18), 300 ms depois da última tecla (`useListSearchParams`).
- **Filtros:**
  - celular (abaixo de 768 px): o botão "Filtros", com o número de filtros ativos ("Filtros (2)"), abre a T8. Os ativos aparecem como chips embaixo dele, com "Limpar filtros" (`variant="ghost"`) quando há pelo menos um. A busca não vira chip, porque já está à vista;
  - a partir de 768 px: os controles ficam acima da lista, no `CardHeader`, e valem na hora. Entre 768 e 1279 px, em duas linhas (Buscar e Período; Ação, Entidade, Status e "Limpar filtros"). A partir de 1280 px, podem ficar numa linha só;
  - Ação: Todas, Criação, Alteração, Exclusão e Restauração, e depois as de login e de senha, na ordem da T8 do E2.03;
  - Entidade: Todas, Membro, Célula, Relatório, Função e Autenticação. Os eventos de participante de antes deste passo entram em Relatório (P-AUD-24, ajuste do PO);
  - Status: Todos, Sucesso e Erro;
  - Período: P33.
- **Total:** "{N} eventos" ou "1 evento" (`formatCount`), acima da lista, com `role="status"`, e também no rodapé do `ListPagination`. Enquanto a nova consulta carrega, o total anterior continua.
- **Lista no celular (UXD-3, P34):** uma `<ul>`. Cada item é um `button` de largura toda, com pelo menos 44 px, que abre o painel (T10), com:
  1. a descrição (`font-medium`), que identifica o evento;
  2. a segunda linha (`text-sm text-muted-foreground`), quando houver: a do E1.04, a do E2.03 ou a deste spec;
  3. "{Autor} · {dd/mm/aaaa} às {HH:mm}" (`text-sm`), ou só a data quando o evento não tem autor ("—");
  4. o badge da ação (`outline`), a entidade em texto e, só quando o evento falhou, o badge "Erro" (P6, com o ícone `AlertCircle`).
- **Tabela no computador:** colunas Data/Hora, Autor, Ação, Entidade, Descrição e Status, sem rolagem horizontal a partir de 1024 px.
  - A descrição é um `button` (com o estilo de link, alinhado à esquerda) que abre o painel. A linha inteira continua clicável com o mouse. Hoje só a linha tem `onClick`, e o teclado não chega ao painel.
  - Entre 768 e 1023 px, a coluna Entidade some (`hidden lg:table-cell`), e a entidade aparece ao lado do badge da ação.
  - "OK" em `outline` (E1.04) e "Erro" no P6.
- **Segunda linha dos eventos de registro (UXD-6) †:**
  - alteração de membro, célula ou relatório: os campos mudados, pelo rótulo da tabela [Rótulos dos campos na Auditoria](#rótulos-dos-campos-na-auditoria), separados por vírgula, até 3, e "e mais {N}" (ex.: "Líder, Celular/WhatsApp"; "Nome, Líder, Cônjuge e mais 2");
  - função criada ou excluída: "{N} permissões" ou "1 permissão";
  - função alterada: os campos mudados ("Nome", "Descrição"), "{N} permissões incluídas" e "{N} permissões retiradas" (no singular, "1 permissão incluída"), separados por " · ";
  - envio de relatório: "{N} participantes" ou "1 participante"; na alteração do relatório, depois dos campos, "{N} participantes incluídos" e "{N} participantes retirados" (no singular, "1 participante incluído"), separados por " · " (P-AUD-24, ajuste do PO);
  - cadastro de membro e de célula, exclusão, restauração, eventos de participante de antes deste passo e troca da função padrão: sem segunda linha, porque a descrição já diz tudo.
- **Datas:** "dd/mm/aaaa HH:mm" na tabela e "dd/mm/aaaa às HH:mm" nos cards e no painel, sempre no horário de Brasília. Hoje a tela usa o fuso do aparelho.
- **Ordem:** do mais recente para o mais antigo (RN-18).
- Componentes: `Card`, `Input`, `Select`, `Button`, `Badge`, `Table`, `Sheet`, `Skeleton`, `Alert` e `ListPagination`. A troca de cards para tabela usa o `useIsMobile`, como em Membros, com o `Skeleton` até ele resolver (T2 do E2.02).

#### T8. Auditoria: filtros no celular
```
Painel aberto                            Erro no período
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Filtros                          [✕] │ │ Período                              │
│──────────────────────────────────────│ │ De                                   │
│ Ação                                 │ │ [15/11/2026                        ] │
│ [Alteração                        ▾] │ │ Até                                  │
│ Entidade                             │ │ [10/11/2026                        ] │  aria-invalid, com o foco
│ [Célula                           ▾] │ │ ⚠ O fim do período precisa ser igual │
│ Status                               │ │ ou posterior ao início.              │
│ [Todos                            ▾] │ └──────────────────────────────────────┘
│ Período                              │  legend do fieldset
│ De                                   │
│ [01/11/2026                        ] │  type="date", h-11
│ Até                                  │
│ [15/11/2026                        ] │
│──────────────────────────────────────│
│ [Limpar        ] [Aplicar filtros  ] │  rodapé fixo, h-11
└──────────────────────────────────────┘
```
- `Sheet` com `side="bottom"` e `max-h-[90dvh]`, o corpo rolando e o rodapé fixo com `pb-[calc(1rem+env(safe-area-inset-bottom))]` (P1, `viewport-fit=cover`).
- Abre com os filtros em vigor, e o foco vai para o primeiro campo. As mudanças só valem em "Aplicar filtros", que confere o período, fecha o painel, aplica, volta para a página 1 e devolve o foco ao botão "Filtros". "✕", `Esc` e o toque fora fecham sem aplicar.
- "Limpar" volta os campos do painel para Todas, Todos e vazio, sem aplicar.
- No histórico de um registro (T9), o painel tem só Ação (com as 4 opções de registro) e Período.
- **Chips †:** um por filtro ativo ("Ação: Alteração", "Entidade: Célula", "Status: Erro", "De: 01/11/2026", "Até: 15/11/2026").
  - Cada chip é um `button` com `h-9`, o ícone `X` (`aria-hidden`) e `aria-label="Remover filtro {texto do chip}"`, com 8 px entre eles e quebra de linha (`flex-wrap`). O toque remove o filtro na hora.
  - Depois de remover, o foco vai para o próximo chip ou, se não houver, para o botão "Filtros".
- Componentes: `Sheet`, `Select`, `Input` (`type="date"`), `Label` e `Button`.

#### T9. Auditoria: histórico de um registro (RN-19, P31)
Celular, com Ana no histórico de Igor, depois de uma exclusão e de uma restauração:
```
┌──────────────────────────────────────┐
│ ☰                                    │
│ [← Ver toda a Auditoria]             │  link, h-11
│ Histórico de Igor Nunes              │  h1
│ Cadastro, alterações, exclusões e    │  subtítulo †
│ restaurações deste membro.           │
│ (i) Os eventos ficam guardados por 2 │  nota de guarda
│ anos. …                              │
│──────────────────────────────────────│
│ Buscar                               │
│ [🔍 Autor ou descrição             ] │
│ [⚲ Filtros]                          │  só Ação e Período
│ 4 eventos                            │
│──────────────────────────────────────│
│ Alterou o membro Igor Nunes          │
│ Líder, Celular/WhatsApp              │
│ Bruno Lima · 23/11/2026 às 21:50     │
│ [Alteração]                          │  sem a entidade (só no relatório)
│──────────────────────────────────────│
│ Restaurou o membro Igor Nunes        │
│ Ana Souza · 22/11/2026 às 00:10      │
│ [Restauração]                        │
│──────────────────────────────────────│
│ Excluiu o membro Igor Nunes          │
│ Ana Souza · 21/11/2026 às 23:50      │
│ [Exclusão]                           │
│──────────────────────────────────────│
│ Cadastrou o membro Igor Nunes        │
│ Bruno Lima · 18/11/2026 às 19:40     │
│ [Criação]                            │
└──────────────────────────────────────┘
```
- **Títulos (Negócio):** "Histórico de {Nome}", "Histórico da célula de {Líder}" e "Histórico do relatório de {dd/mm/aaaa} da célula de {Líder}".
  - Enquanto o nome carrega, o `h1` mostra "Histórico" e um `Skeleton` no lugar do resto. Vindo do registro aberto, a tela pode usar o nome que já tem, para não esperar.
  - Registro excluído: o título continua, com o badge "Cadastro excluído", "Célula excluída" ou "Relatório excluído" † (P6, como o "Célula excluída" do E2.01).
  - Registro que não se consegue identificar (link errado): "Histórico do registro" †.
- **Subtítulos †:** "Cadastro, alterações, exclusões e restaurações deste membro." · "… desta célula." · "… deste relatório, com os participantes incluídos e retirados."
- **"Ver toda a Auditoria":** link no topo, com o ícone `ArrowLeft` e `h-11`, que leva a `/events` sem parâmetros. Ocupa o lugar do "Voltar" das telas de detalhe.
- **Lista:** a mesma da T7, só com os eventos do registro (RN-19): cadastro, alterações, exclusões e restaurações, inclusive as consequências (o cônjuge, RN-05). No relatório, os participantes vêm dentro do envio e de cada alteração, e os eventos de participante de antes deste passo também entram (P-AUD-24). Paginada, do mais recente para o mais antigo.
  - A entidade não aparece no histórico de um registro, porque seria igual em todas as linhas (ajuste do PO: sem a entidade "Participante", o histórico do relatório só teria "Relatório").
  - Filtros: Buscar (placeholder "Autor ou descrição" †), Ação (Todas, Criação, Alteração, Exclusão e Restauração) e Período. Entidade e Status não aparecem.
- **Vazio †:** "Nenhum evento deste membro na Auditoria." (desta célula, deste relatório), com a explicação "As alterações feitas no sistema anterior não estão na Auditoria, e os eventos com mais de 2 anos já saíram." e "Ver toda a Auditoria".

#### T10. Auditoria: painel de detalhes (`Sheet`)
```
Alteração de membro                      Alteração de função
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Detalhes do evento               [✕] │ │ Detalhes do evento               [✕] │
│ 23/11/2026 às 21:50                  │ │ 23/11/2026 às 20:12                  │
│ Autor                                │ │ Autor                                │
│ Bruno Lima                           │ │ Ana Souza                            │
│ Ação               Entidade          │ │ Ação               Entidade          │
│ Alteração          Membro            │ │ Alteração          Função            │
│ Registro                             │ │ Registro                             │
│ Igor Nunes                           │ │ Secretaria                           │
│ Descrição                            │ │ Descrição                            │
│ Alterou o membro Igor Nunes          │ │ Alterou a função Secretaria          │
│ Campos alterados                     │ │ Permissões incluídas                 │
│ • Líder: Bruno Lima → Pedro Alves    │ │ • Ver Dados Sensíveis                │
│ • Celular/WhatsApp                   │ │ Permissões retiradas                 │
│ [⟲ Ver histórico deste membro      ] │ │ • Editar Membro                      │
└──────────────────────────────────────┘ └──────────────────────────────────────┘

Relatório                                Cônjuge desfeito pela exclusão (E2.01)
│ Registro                             │ │ Registro                             │
│ Relatório de 25/11/2026 da célula de │ │ Otávio                               │
│ Carla Dias                           │ │ Descrição                            │
│ Descrição                            │ │ Vínculo de cônjuge desfeito pela     │
│ Alterou o relatório de 25/11/2026 da │ │ exclusão de Paula                    │
│ célula de Carla Dias                 │ │ Campos alterados                     │
│ Campos alterados                     │ │ • Cônjuge: Paula → (vazio)           │
│ • Oferta: R$ 50,00 → R$ 80,00        │ │ [⟲ Ver histórico deste membro      ] │
│ • Observações                        │
│ [⟲ Ver histórico deste relatório   ] │
```
- **Campos do painel:** Autor, Ação, Entidade, Registro † (o nome do registro; nos eventos de login e de senha, continua "Cadastro", como no E1.04 e no E2.03), Descrição e, conforme o evento, Campos alterados, as permissões ou os campos do E1.04 e do E2.03. Cada campo só aparece quando tem valor.
- **Campos alterados (P32):** uma `<ul>`, na ordem da tabela de rótulos abaixo:
  - os campos da RN-20 (b) com valor: "{Campo}: {antes} → {depois}"; os demais, só "{Campo}";
  - valores legíveis (RN-20 c): pessoas pelo nome, célula como "célula de {Líder}", função pelo nome, Sim ou Não, Ativo ou Inativo (Ativa ou Inativa, na célula), Masculino ou Feminino, dd/mm/aaaa, HH:mm, R$ 50,00 e "(vazio)";
  - "Não houve célula" mostra "Sim" quando a célula não aconteceu, o inverso do valor gravado (AQ-4);
  - os nomes e os valores quebram linha, sem `truncate`.
- **Participantes do relatório (P-AUD-24, ajuste do PO):** no envio, "Participantes"; na alteração, "Participantes incluídos" e "Participantes retirados", cada um numa lista, pelo nome, depois dos campos alterados.
- **Funções (RN-15):**
  - criação: "Permissões", com os rótulos da tela de Funções (E2.02);
  - alteração: "Nome: {antes} → {depois}" (PO-UX-4), "Descrição" só pelo nome, "Permissões incluídas" e "Permissões retiradas", cada uma numa lista;
  - troca da função padrão: só a descrição do Negócio ("{Nome} passou a ser a função padrão (antes: {Nome})");
  - exclusão: "Permissões", com as que a função tinha.
- **Sem JSON e sem identificadores:** o bloco "Metadados" sai para todas as entidades (RN-20 d). Nenhum nome técnico de campo ou de permissão e nenhum identificador (UUID) aparece.
- **"Ver histórico deste membro"** (desta célula, deste relatório) (UXD-8, PO-UX-2): um `Link` com o visual do `Button variant="outline"`, no fim do painel, nos eventos de membro, célula, relatório e participante. No participante, leva ao histórico do relatório. Não aparece no histórico do mesmo registro.
- **Foco:** ao abrir, no título do painel (Radix); ao fechar, volta para o card ou para o botão da descrição que o abriu.
- Componentes: `Sheet`, `Badge`, `Button` e `Separator`.

#### Rótulos dos campos na Auditoria
O rótulo é o do formulário, em caixa de frase, sem o asterisco e sem o complemento entre parênteses que só ajuda a preencher ("Oferta (R$)" vira "Oferta", "Timóteo (Auxiliar)" vira "Timóteo"), com os termos da RN-04 (RN-20 a). Quando um passo renomear um rótulo, como o E2.04 faz com "Gênero" → "Sexo", a Auditoria acompanha, porque a lista é uma só (ponto 5 para o `architect`). A coluna "Campo técnico" serve só a quem implementa e nunca aparece na tela.

| Entidade | Campo técnico | Rótulo na Auditoria | Antes → depois (RN-20 b) |
|---|---|---|---|
| Membro | `name` | Nome | sim |
| Membro | `gender` | Sexo (antes do E2.04, "Gênero") | sim: Masculino, Feminino |
| Membro | `birth_date` | Data de nascimento | não |
| Membro | `cpf`, `email`, `mobile_whatsapp`, `phone`, `instagram` | CPF, E-mail, Celular/WhatsApp, Telefone, Instagram | não |
| Membro | `avatar_url`, `notes` | Foto, Observações | não |
| Membro | `zip_code`, `street`, `number`, `complement`, `neighborhood`, `city`, `state` | CEP, Rua, Número, Complemento, Bairro, Cidade, Estado | não |
| Membro | `leader_id` | Líder | sim: nome |
| Membro | `has_leadership` | Tem Liderança? | sim: Sim, Não |
| Membro | `is_pastor` | É Pastor(a)? | sim: Sim, Não |
| Membro | `spouse_id` | Cônjuge | sim: nome |
| Membro | `is_baptized` | Batizado(a)? | sim: Sim, Não |
| Membro | `baptism_date` | Data do batismo | não |
| Membro | `is_active` | Situação | sim: Ativo, Inativo |
| Membro | `role_id` | Função | sim: nome |
| Célula | `leader_id`, `timothy_id`, `host_id` | Líder, Timóteo, Anfitrião | sim: nome |
| Célula | `type` | Tipo | sim |
| Célula | `meeting_day` | Dia da semana | sim |
| Célula | `meeting_time` | Horário | sim: HH:mm |
| Célula | `neighborhood`, `city` | Bairro, Cidade | sim |
| Célula | `zip_code`, `street`, `number`, `complement`, `state` | CEP, Rua, Número, Complemento, Estado | não |
| Célula | `is_active` | Situação | sim: Ativa, Inativa |
| Relatório | `cell_id` | Célula | sim: célula de {Líder} |
| Relatório | `date` | Data | sim: dd/mm/aaaa |
| Relatório | `time` | Horário | sim: HH:mm |
| Relatório | `was_held` | Não houve célula | sim: Sim, Não (o inverso do valor gravado) |
| Relatório | `theme` | Tema | sim |
| Relatório | `reason_not_held` | Motivo | sim |
| Relatório | `offering` | Oferta | sim: R$ 0,00 |
| Relatório | `observations`, `visitors` | Observações, Visitantes | não |
| Relatório | participantes | Participantes (envio), Participantes incluídos, Participantes retirados (alteração) | sim: nomes (P-AUD-24) |
| Função | `name` | Nome | sim (PO-UX-4) |
| Função | `description` | Descrição | não |
| Função | permissões | Permissões incluídas, Permissões retiradas | os rótulos da tela de Funções (E2.02) |

### Padrões novos (valem para as próximas telas)
A numeração começa em P30. Este passo também aplica o P1 (o formulário de membro e o painel de filtros), o P6 (o badge "Erro" e os de registro excluído), o P10 (o subtítulo), o P13 (a Auditoria sem acesso) e o P21 e o P22 (os erros ao salvar).

- **P30. Autoria no registro aberto.**
  - Fica no topo do corpo do registro aberto (formulário de edição, painel de consulta ou tela de detalhe), depois dos avisos e antes do primeiro campo, seguida de um `Separator`. Nunca no cabeçalho fixo, nas listas, nos seletores ou no registro novo.
  - Uma frase por linha, em `text-sm text-muted-foreground`, com o nome em `font-medium text-foreground`. O nome é só texto.
  - A frase sai de uma função só (verbo da entidade, autor, data e hora de Brasília, "autor não registrado", "data não registrada" e "(sistema anterior)"), testada por tabela.
  - Vale para o detalhe da célula (E2.10), o painel de relatório em todas as linhas (E2.12), Escolas e Consolidação. Uma entidade nova combina o verbo com o PO.
- **P31. Histórico de um registro.**
  - "Ver histórico" é um link com o visual do `Button variant="outline"`, junto da autoria (P30), só para quem audita, com o nome do registro no `aria-label`.
  - Ele abre a Auditoria filtrada pelo registro, com o título "Histórico de…", "Ver toda a Auditoria" no topo, só os filtros que fazem sentido e o estado na URL.
  - Num formulário com alterações, antes pede "Descartar as alterações?".
- **P32. Mudança legível.**
  - "{Campo}: {antes} → {depois}", numa lista, com o rótulo da tela, os valores formatados e "(vazio)". Os campos sem valor aparecem só pelo nome.
  - A seta é `aria-hidden`, e o leitor de tela ouve "{Campo}: de {antes} para {depois}" (texto `sr-only`).
  - Nunca JSON, nome técnico ou identificador.
- **P33. Filtro de período.**
  - Dois campos de data nativos, "De" e "Até", num `fieldset` com a legenda "Período" e com `max` igual a hoje (Brasília). Os dois são opcionais e incluem o dia informado.
  - "Até" antes de "De" dá o erro "O fim do período precisa ser igual ou posterior ao início." embaixo de "Até", que recebe o foco, sem consultar o servidor (P21).
  - Na URL, `from` e `to` em `aaaa-mm-dd`. Nos chips, "De: dd/mm/aaaa" e "Até: dd/mm/aaaa".
  - Vale para os filtros por data de cadastro de Membros e Células (E2.07, E2.10) e para o período dos Relatórios (E2.12).
- **P34. Lista de consulta com painel.**
  - No celular, cada item é um `button` de largura toda, que abre o painel de detalhes, com o que identifica o item primeiro. As ações do item, quando houver, ficam fora do botão, como irmãs (T7 do E2.01).
  - No computador, a tabela tem um `button` na coluna que identifica a linha. O clique na linha é só um atalho do mouse.
  - Ao fechar o painel, o foco volta para o botão que o abriu.

Nenhum componente novo do shadcn é necessário: `sheet`, `select`, `input`, `label`, `table`, `card`, `badge`, `button`, `separator`, `skeleton`, `alert` e `alert-dialog` já estão em `src/components/ui`. O P1 continua pedindo `viewport-fit=cover` na meta viewport do `index.html`, já previsto nos specs anteriores.

### Estados
| Estado | Autoria e "Ver histórico" (T1 a T4) | Salvar (T5) | Excluídos (T6) | Auditoria (T7 a T10) |
|---|---|---|---|---|
| Carregando | Com a autoria no registro (AQ-1), nada carrega. Numa leitura à parte, 2 linhas de `Skeleton`, com a altura reservada | "Salvando…", com os botões desabilitados (E2.04) | Como no E2.01 | `Skeleton` de 5 cards (celular) ou 5 linhas (computador), no lugar do "Carregando..." de hoje. Ao trocar de página ou de filtro, a lista anterior fica com `opacity-60` (`placeholderData`), e o total anterior continua. No histórico, o `h1` mostra "Histórico" e um `Skeleton` até o nome chegar |
| Vazio | Não existe: o cadastro sempre tem uma linha, mesmo "· autor não registrado · data não registrada". No registro novo, o bloco não aparece | — | Como no E2.01 | Sem filtros: "Nenhum evento registrado." †. Com busca ou filtros: "Nenhum evento encontrado para estes filtros." † e "Limpar filtros". No histórico: o texto da T9 |
| Erro ao carregar | Leitura à parte: "Não foi possível carregar quem cadastrou e quem alterou." † e "Tentar de novo". O formulário funciona | — | Como no E2.01 | `Alert` "Não foi possível carregar a Auditoria. Verifique a conexão e tente de novo." †, com "Tentar de novo", no lugar da lista. A busca e os filtros continuam |
| Sem permissão | A autoria aparece para quem abre o registro (RN-07). Sem "Visualizar Auditoria", "Ver histórico" não aparece | As recusas da T11 do E2.02 | Como no E2.01 | Estado sem acesso do P13: o `h1` "Auditoria", "Você não tem acesso a esta tela." e "Ir para o início", sem nenhum evento no DOM |
| Registro mudou no meio tempo | O bloco mostra o que foi lido ao abrir. Depois de salvar, o formulário fecha, e a próxima abertura mostra a alteração nova | As recusas do E2.01 e do E2.02 | Como no E2.01 | A lista não se atualiza sozinha: os eventos novos aparecem ao trocar de filtro ou de página, ou ao recarregar. Com eventos novos, um evento pode se repetir na página seguinte (AQ-2) |
| Sucesso | — | Os toasts de hoje. Sem mudança: "Nenhuma alteração para salvar." † | Como no E2.01 | — |
| Lista grande | — | — | A paginação do E2.01 | Paginação no servidor (25 por página; 10, 25, 50 ou 100), sem corte e com o total exato (RN-18). A última página traz o evento mais antigo |
| Queda de conexão no envio | — | A mensagem de conexão junto da ação primária, com os dados mantidos e a ação como "Tentar de novo" (T5) | Como no E2.01 | Só leitura: o `Alert` de erro ao carregar |

### Textos
Complementam os "Textos de tela" do Negócio, sem mudar termos. Os textos marcados com † foram definidos pela UX e estão na PO-UX-8.

| Onde | Texto |
|---|---|
| Autoria (Negócio) | Cadastrado por {Nome} em {dd/mm/aaaa} às {HH:mm} · Alterado por … · Cadastrada por … · Alterada por … (célula) · Enviado por … (relatório) · Sistema · {Nome} (sistema anterior) · Administrador (sistema anterior) · autor não registrado · data não registrada |
| Autoria sem autor e sem data | {Verbo} · autor não registrado · data não registrada (junta as duas marcas do Negócio) |
| Autoria: erro ao carregar † | Não foi possível carregar quem cadastrou e quem alterou. · Tentar de novo |
| Ver histórico | Ver histórico (Negócio) · rótulos para leitor de tela †: Ver histórico de {Nome} · Ver histórico da célula de {Líder} · Ver histórico do relatório de {dd/mm/aaaa} |
| Salvar sem mudança † | Nenhuma alteração para salvar. |
| Conexão ao salvar | Não foi possível salvar o cadastro. Verifique a conexão e tente de novo. (E2.04) · Não foi possível salvar a célula. Verifique a conexão e tente de novo. † · Não foi possível salvar o relatório. Verifique a conexão e tente de novo. † · Não foi possível salvar a função. Verifique a conexão e tente de novo. (E2.02) |
| Excluídos | Excluído em {dd/mm/aaaa} às {HH:mm} · por {Nome} (sistema anterior) · na coluna: {Nome} (sistema anterior) · Autor não registrado · Não registrado (E2.01) |
| Auditoria: cabeçalho | Auditoria · Eventos de toda a igreja † · Os eventos ficam guardados por 2 anos. Login e logout, por 1 ano. Falhas, recusas e bloqueios, por 90 dias. (Negócio) |
| Auditoria: busca | Buscar · Autor, registro ou descrição † · no histórico: Autor ou descrição † |
| Auditoria: filtros | Filtros · Filtros ({N}) † · Ação · Entidade · Status · Período † · De · Até · Todas · Todos · Sucesso · Erro · Aplicar filtros † · Limpar † · Limpar filtros · O fim do período precisa ser igual ou posterior ao início. † |
| Auditoria: chips † | Ação: {Ação} · Entidade: {Entidade} · Status: {Status} · De: {dd/mm/aaaa} · Até: {dd/mm/aaaa} · para o leitor de tela: Remover filtro {texto do chip} |
| Auditoria: total | {N} eventos · 1 evento |
| Auditoria: ações e entidades | as do Negócio, mais as do E1.04 e do E2.03 |
| Auditoria: autor | Sistema · — (E1.04) |
| Auditoria: descrições † | membro: Cadastrou o membro {Nome} · Alterou o membro {Nome} · Excluiu o membro {Nome} · Restaurou o membro {Nome} · Vínculo de cônjuge desfeito pela exclusão de {Nome} (E2.01)<br>célula: Cadastrou a célula de {Líder} · Alterou a célula de {Líder} · Excluiu a célula de {Líder} · Restaurou a célula de {Líder}<br>relatório: Enviou o relatório de {dd/mm/aaaa} da célula de {Líder} · Alterou o relatório de … · Excluiu o relatório de … · Restaurou o relatório de …<br>participante (só nos eventos de antes deste passo, P-AUD-24): Incluiu {Nome} no relatório de {dd/mm/aaaa} da célula de {Líder} · Retirou {Nome} do relatório de …<br>função: as do Negócio |
| Auditoria: registro † | {Nome} · Célula de {Líder} · Relatório de {dd/mm/aaaa} da célula de {Líder} · {Nome da função} |
| Auditoria: segunda linha † | {Campo}, {Campo} e mais {N} · {N} permissões / 1 permissão · {N} permissões incluídas / 1 permissão incluída · {N} permissões retiradas / 1 permissão retirada · {N} participantes / 1 participante · {N} participantes incluídos / 1 participante incluído · {N} participantes retirados / 1 participante retirado |
| Auditoria: painel | Detalhes do evento · {dd/mm/aaaa} às {HH:mm} · Autor · Ação · Entidade · Registro † · Cadastro (E1.04) · Descrição · Campos alterados † · Permissões † · Permissões incluídas · Permissões retiradas · Participantes · Participantes incluídos · Participantes retirados · {Campo}: {antes} → {depois} · (vazio) · Sim · Não · Ativo · Inativo · Ativa · Inativa · Masculino · Feminino · Ver histórico deste membro / desta célula / deste relatório † |
| Auditoria: rótulos dos campos † | os da tabela [Rótulos dos campos na Auditoria](#rótulos-dos-campos-na-auditoria) |
| Auditoria: histórico | Histórico de {Nome} · Histórico da célula de {Líder} · Histórico do relatório de {dd/mm/aaaa} da célula de {Líder} · Ver toda a Auditoria (Negócio) · Histórico do registro † · Cadastro excluído / Célula excluída / Relatório excluído † · Cadastro, alterações, exclusões e restaurações deste membro. / desta célula. / deste relatório, com os participantes incluídos e retirados. † · Nenhum evento deste membro na Auditoria. / desta célula / deste relatório † · As alterações feitas no sistema anterior não estão na Auditoria, e os eventos com mais de 2 anos já saíram. † |
| Auditoria: estados † | Nenhum evento registrado. · Nenhum evento encontrado para estes filtros. · Limpar filtros · Não foi possível carregar a Auditoria. Verifique a conexão e tente de novo. · Tentar de novo · sem acesso: os textos do P13 (E2.02) |

**Evitar nestas telas**, além do que o Negócio lista: "Identificação" fora dos eventos de login; "Metadados"; "Atualizou"; "Registrou" para o relatório (use "Enviou"); "Adicionou" e "Removeu" para participantes (use "Incluiu" e "Retirou"); "AdminUser"; e datas no formato `aaaa-mm-dd`.

### Acessibilidade
- **Autoria (P30):** texto simples, sem `aria-live`, porque não muda com o registro aberto. O nome do autor não é link nem botão. O `Separator` é decorativo.
- **"Ver histórico" (P31):** `Link`, porque é navegação; ícone `aria-hidden`; `aria-label` com o nome do registro, contendo o texto visível.
- **Auditoria:**
  - um `h1` em todos os estados, inclusive sem acesso e no histórico;
  - o total ("{N} eventos") usa `role="status"`, para o leitor de tela anunciar o resultado de cada busca ou filtro uma vez (a busca espera 300 ms, então não anuncia a cada tecla);
  - os cards formam uma `<ul>`, e o nome de cada `button` é o próprio conteúdo;
  - na tabela, a descrição é um `button` alcançável por Tab e aberto por Enter (P34);
  - a seta "→" é `aria-hidden`, com "de … para …" em `sr-only` (P32);
  - os campos de data têm `Label` e ficam no `fieldset` "Período". O erro de "Até" fica no `aria-describedby` dele, com `aria-invalid`;
  - cada chip tem `aria-label="Remover filtro {…}"`, e o foco vai para o próximo chip, ou para "Filtros", depois de remover;
  - o painel de filtros prende o foco (Radix), começa no primeiro campo e devolve o foco para "Filtros".
- **Sem depender de cor:** "Erro" com ícone e texto (P6); a ação em texto no badge; "Sistema", "(sistema anterior)", "autor não registrado" e "data não registrada" em texto.
- **Contraste, nos dois temas:**
  - `text-muted-foreground` sobre o fundo do diálogo e do cartão: 4,6:1 no tema claro e 5,6:1 no escuro (P21);
  - o badge "Erro" deixa o `destructive` cheio de hoje e passa ao P6 (`bg-destructive/15`, borda `border-destructive`, `text-foreground` e ícone);
  - o "OK" em `outline` (E1.04);
  - o "Motivo" do painel em `text-foreground` (E1.04), e não em `text-destructive`.
- **Toque:** "Ver histórico", "Filtros", "Aplicar filtros", "Limpar", "Ver toda a Auditoria" e os cards têm pelo menos 44 px no celular. Os chips têm 36 px, com 8 px entre si, acima do mínimo de 24 px da WCAG 2.5.8. Os botões do `ListPagination` continuam com 32 px (E1.08), acima do mínimo; passar a 44 px no celular fica como sugestão para todas as listas.
- **Zoom e fonte grande:** em 320 px e com 200%, as frases de autoria, os nomes com "(sistema anterior)", os chips, a nota de guarda e os valores do painel quebram linha, sem `truncate` e sem altura fixa. A Auditoria não tem rolagem horizontal no celular.
- **Movimento:** as animações do `Sheet` e do `Skeleton` respeitam `motion-reduce:`.
- **Fuso:** todas as datas e horas são as de Brasília, com o aparelho em qualquer fuso.

### Critérios de UX
Numeração própria deste spec. Continuam valendo os critérios da Auditoria do E1.04 (UX-15 a UX-17) e do E2.03 (UX-33 e UX-34), com a lista em cards no celular.

| ID | Critério | Como verificar |
|---|---|---|
| UX-01 | A frase de autoria segue a T1 em todos os casos de uma tabela de testes:<br>- membro, célula e relatório, com os verbos certos;<br>- com autor e data; sem autor; sem data; sem os dois;<br>- "Sistema", "{Nome} (sistema anterior)" e "AdminUser", que aparece como "Administrador (sistema anterior)".<br><br>"AdminUser" nunca aparece. | teste unitário (Vitest, tabela) |
| UX-02 | As datas e horas são as de Brasília: um cadastro de 21/11/2026 às 23:59 (Brasília) aparece como "21/11/2026 às 23:59", com o navegador em UTC e em `Asia/Tokyo`. O mesmo vale nos cards, na tabela e no painel da Auditoria. | teste de componente (fuso simulado) |
| UX-03 | A autoria aparece no topo do corpo, depois dos `Alert` e antes do primeiro campo, em "Editar membro", "Editar meus dados", "Meus dados", na edição de célula, na edição de relatório e no "Ver relatório". Ela não aparece em "Novo membro", "Nova célula", no relatório novo, nas listas de Membros, Células e Relatórios, nos seletores, no Dashboard nem em Ministérios. | teste de componente |
| UX-04 | A linha "Alterado" só aparece quando o registro tem alteração. Depois de Carla enviar o relatório com 8 participantes, ele mostra só "Enviado por Carla Dias…"; depois de Ana incluir um participante, mostra também "Alterado por Ana Souza…" (critério da RN-04). | teste E2E |
| UX-05 | O nome do autor é só texto: no bloco, o único `a` ou `button` é "Ver histórico", e nenhum outro dado do autor (e-mail, celular, CPF) está no DOM nem na resposta que alimenta o bloco. | teste de componente + inspeção da rede |
| UX-06 | "Ver histórico" aparece para Ana e não para Bruno, Carla nem Hugo. É um `a` para `/events?record_type=…&record_id=…`, com o `aria-label` da T1 e 44 px de altura abaixo de 768 px. | teste de componente |
| UX-07 | Com o formulário alterado, "Ver histórico" abre "Descartar as alterações?": "Continuar editando" mantém tudo, e "Descartar" abre o histórico. Sem alteração, abre direto. O "voltar" do navegador leva à lista de antes, com a busca e a página. | teste E2E |
| UX-08 | Na edição, "Salvar alterações" sem nenhuma mudança fecha o formulário, mostra "Nenhuma alteração para salvar." e não faz nenhuma requisição de gravação. A autoria do registro continua igual (critério da RN-04). | teste de componente (rede simulada) + teste E2E |
| UX-09 | Nos formulários de membro, célula e relatório, com a gravação recusada por falha da Auditoria (simulada), erro 5xx ou queda de rede:<br>- o formulário continua aberto e com os dados;<br>- a mensagem de conexão da T5 aparece com `role="alert"`;<br>- não há toast de sucesso nem texto técnico;<br>- depois que a falha deixa de existir, a nova tentativa grava uma vez só. | teste de componente (respostas simuladas) + teste E2E (critério da RN-14) |
| UX-10 | Nas listas "Excluídos", uma exclusão do sistema anterior mostra "por João Pires (sistema anterior)" no card e "João Pires (sistema anterior)" na coluna; "AdminUser" aparece como "Administrador (sistema anterior)"; sem nome, "Autor não registrado" e "Não registrado". | teste de componente (critério da RN-11) |
| UX-11 | A Auditoria é paginada no servidor com o `ListPagination` (25 por página; 10, 25, 50 ou 100) e mostra "{N} eventos" ("1 evento") acima da lista e no rodapé. Com 12.000 eventos, mostra "12.000 eventos", e a última página traz o mais antigo. Nenhum limite fixo, como os 500 de hoje, corta a lista. | teste E2E (massa grande) + teste de componente |
| UX-12 | A busca, os filtros, o período, a página, o tamanho e o histórico ficam na URL (Navegação e rotas), sem os valores padrão. Recarregar a página mantém tudo. Mudar a busca, um filtro ou o tamanho volta para a página 1. Um valor inválido sai da URL. | teste E2E |
| UX-13 | A busca vai ao servidor 300 ms depois da última tecla e acha "igor nunes" e "Otavio" (com "Otávio" no dado) em qualquer página, inclusive além dos 500 eventos mais recentes. | teste E2E (critério da RN-18) |
| UX-14 | "De" e "Até" são `input type="date"` num `fieldset` "Período", com `max` igual a hoje. "Até" antes de "De" mostra o erro do P33 embaixo de "Até", com o foco nele, e não consulta o servidor. Com "Até" em 15/11/2026, um evento de 15/11/2026 às 23:59 (Brasília) aparece. | teste de componente + teste E2E |
| UX-15 | Abaixo de 768 px:<br>- os filtros ficam no `Sheet` aberto por "Filtros ({N})", com 44 px de altura;<br>- o painel aplica só em "Aplicar filtros" e descarta ao fechar;<br>- os filtros ativos viram chips, que removem o filtro com um toque e têm `aria-label="Remover filtro …"`;<br>- "Limpar filtros" aparece com um ou mais filtros ativos.<br><br>A partir de 768 px, não há o botão "Filtros", e os controles ficam acima da lista. | teste E2E (360×800 e 1280×800) |
| UX-16 | Abaixo de 768 px, a Auditoria não tem rolagem horizontal, em 360 e em 320 px. Cada evento é um card-botão de pelo menos 44 px, com a descrição primeiro, a segunda linha, o autor e a data, o badge da ação e a entidade, e o badge "Erro" só nos que falharam. O card abre o painel, e fechar o painel devolve o foco ao card. | teste E2E (viewport e medida) + teste de componente |
| UX-17 | A partir de 1024 px, a tabela tem as 6 colunas, sem rolagem horizontal, e a descrição de cada linha é um `button` que abre o painel pelo teclado (Tab e Enter). | teste E2E |
| UX-18 | Na linha, no painel e no filtro, a ação de alteração aparece como "Alteração", e "Atualização" não está no DOM; a restauração, como "Restauração"; a entidade "Função" existe, e "Participante" não aparece no filtro. As opções de Ação e de Entidade seguem a ordem da T7. | teste de componente |
| UX-19 | Na alteração de Igor (líder de Bruno Lima para Pedro Alves, e o celular), o card mostra "Líder, Celular/WhatsApp", e o painel mostra "Líder: Bruno Lima → Pedro Alves" e "Celular/WhatsApp", sem valor. A oferta aparece como "Oferta: R$ 50,00 → R$ 80,00". No DOM da Auditoria, nos eventos novos e nos de antes deste passo, não há nome técnico (`leader_id`, `mobile_whatsapp`), JSON, texto com cara de UUID nem data `aaaa-mm-dd`. | teste de componente + teste E2E (critério da RN-20) |
| UX-20 | Funções: a criação lista as permissões pelo rótulo do E2.02; a alteração mostra "Permissões incluídas" e "Permissões retiradas" e, quando o nome muda, "Nome: … → …"; a troca da padrão mostra a descrição do Negócio; a exclusão lista as permissões que a função tinha. Nenhum identificador de permissão (como `view_audit_log`) aparece. | teste de componente (critério da RN-15) |
| UX-21 | O autor aparece como "Sistema" nos eventos sem pessoa e como "—" no login sem sessão (E1.04). No card, o evento sem autor mostra só a data. | teste de componente |
| UX-22 | "Ver histórico" em Igor abre "Histórico de Igor Nunes", só com os eventos dele, inclusive os de antes da exclusão e da restauração, com "Ver toda a Auditoria" no topo. O histórico de um relatório mostra os participantes dentro do envio e de cada alteração, além dos eventos de participante de antes deste passo. Entidade e Status não aparecem, e Ação tem só Criação, Alteração, Exclusão e Restauração. O link direto e o recarregar mostram o mesmo. | teste E2E (critério da RN-19) |
| UX-23 | O histórico sem eventos mostra o texto e a explicação da T9 e "Ver toda a Auditoria". O de um registro excluído mostra o badge de excluído ao lado do título. | teste de componente |
| UX-24 | O painel de um evento de membro, célula, relatório ou participante tem "Ver histórico deste membro" (desta célula, deste relatório), que abre o histórico; no participante, o do relatório. No histórico do mesmo registro, o link não aparece. | teste de componente |
| UX-25 | A nota de guarda, com o texto do Negócio, aparece abaixo do subtítulo na Auditoria e no histórico de um registro. | teste de componente (critério da RN-17) |
| UX-26 | Sem "Visualizar Auditoria", a `/events`, com ou sem parâmetros, mostra o `h1` "Auditoria", "Você não tem acesso a esta tela." e "Ir para o início", sem redirecionar e sem nenhum evento no DOM. | teste E2E (Bruno) |
| UX-27 | Enquanto carrega, a lista mostra 5 `Skeleton` no formato dos cards ou das linhas. Na troca de página ou de filtro, a lista anterior fica com `opacity-60` até a nova chegar. Na falha, aparece o `Alert` da tabela Estados, com "Tentar de novo", e a busca e os filtros continuam. | teste de componente |
| UX-28 | Em 320 px e com zoom de 200%, as frases de autoria e os nomes com "(sistema anterior)" quebram linha sem corte, os chips quebram linha, o painel não tem rolagem horizontal e nenhum botão estoura a largura. | inspeção + teste E2E (viewport) |
| UX-29 | O contraste é de 4,5:1 para texto e de 3:1 para ícones e bordas, nos temas claro e escuro, na autoria, nos cards, nos badges "Erro" (P6) e "OK" (`outline`) e no painel. Nenhum estado depende só de cor. | inspeção (axe, nos dois temas) |
| UX-30 | Com leitor de tela, o total é anunciado uma vez depois de cada busca ou filtro (`role="status"`), "Líder: Bruno Lima → Pedro Alves" é lido "Líder: de Bruno Lima para Pedro Alves", e "Ver histórico" é lido com o nome do registro. | inspeção (leitor de tela) + teste de componente (`sr-only` e `aria-hidden`) |

### Perguntas para o `architect` (dados e contrato)
Em cada uma, a tela tem um comportamento padrão (o mais conservador) se a resposta for "não".

- **AQ-1. Autoria estruturada, junto com o registro** (RN-07 a RN-10, P30). A tela monta a frase e não deve interpretar texto pronto. Para cada registro:
  - `created_at`, `created_by_kind` (`member`, `legacy`, `system` ou `unknown`) e `created_by_name` (o nome atual do membro, RN-08, mesmo fora do escopo ou excluído; ou o nome do sistema anterior, já com "AdminUser" trocado por "Administrador");
  - `updated_at`, `updated_by_kind` e `updated_by_name`, nulos quando o registro mostra só o cadastro (RN-04 d, RN-10 c, RN-12). A regra fica no servidor;
  - a data de cadastro nula para "data não registrada" (ponto 8 do Negócio).

  O formulário abre com a linha da lista (Membros, Células, Relatórios). O melhor para a tela é a autoria vir nessa linha (`members_view`, `cells_view`, `cell_reports_view`), para não haver `Skeleton`. As listas não a mostram (RN-07), então pode ser uma leitura por id ao abrir.
  - Nas listas de excluídos (RN-11): `deleted_by_kind` e `deleted_by_name`, do mesmo jeito.
  - *Padrão sem isso:* uma leitura por id ao abrir, com o `Skeleton` da T1.
- **AQ-2. Leitura paginada da Auditoria** (RN-18). Uma RPC ou view com:
  - os parâmetros `action`, `entity`, `success`, `from` e `to` (datas de Brasília, incluindo os dois dias), a busca (sem diferenciar maiúsculas e acentos, no autor, no registro e na descrição), `record_type` e `record_id`, a página e o tamanho;
  - as linhas e o total exato, na ordem `occurred_at desc` com desempate estável (por exemplo, `id desc`);
  - 42501 para quem não tem "Visualizar Auditoria", e não uma lista vazia, para a tela mostrar o estado sem acesso;
  - com a paginação por deslocamento ("Página X de Y" pede o total), um evento pode se repetir na página seguinte quando chegam eventos novos. A tela aceita isso.
  - *Padrão sem o total exato:* volta ao PO (ponto 11 do Negócio).
- **AQ-3. Histórico de um registro** (RN-19, T9):
  - quais eventos entram, inclusive os do cônjuge (RN-05) e, no relatório, os dos participantes (hoje o evento de participante aponta para o relatório);
  - o nome do registro para o título, mesmo excluído, com a marca de excluído, por `record_type` e `record_id`. Nulo quando não existe ("Histórico do registro").
- **AQ-4. Mudanças legíveis** (RN-20, P32). Por evento, uma lista estruturada de mudanças:
  - a chave estável do campo, que a tela traduz pela tabela de rótulos (uma lista só, também usada pela RN-04, ponto 5 do Negócio). Um teste falha se alguma chave ficar sem rótulo;
  - os valores "antes" e "depois", só nos campos da RN-20 (b), com os nomes das pessoas, da célula e da função resolvidos na gravação (RN-20 c, ponto 12 do Negócio). A tela formata datas, horas, valores em reais, Sim e Não, situação e sexo;
  - o "Não houve célula" invertido em relação a `was_held`: definir se a inversão fica no servidor ou na tela;
  - nos eventos de antes deste passo, os identificadores resolvidos pelo nome atual, na leitura;
  - nas funções: as permissões incluídas, as retiradas, as da função criada ou excluída (pela chave, que a tela traduz pelo rótulo do E2.02), o nome antes e depois (PO-UX-4) e as funções da troca da padrão.
- **AQ-5. Descrições** (RN-20 e, UXD-11). As descrições guardadas trazem "Atualizou", "Criou", "Registrou", "Adicionou" e "Removeu", e a data como `2026-11-23`, inclusive no nome do registro ("relatório da célula de X em 2026-11-23"). Duas saídas:
  - a tela monta a descrição a partir da ação, da entidade, do nome do registro e da data (iguais para os eventos novos e os antigos), e usa o texto guardado só quando não consegue;
  - ou o servidor grava as descrições novas e uma migration reescreve as antigas (a RN-16 proíbe a escrita pela API, e não por migration).
  - *Padrão sem isso:* os eventos novos com as descrições da tabela de Textos, e os antigos como estão, o que fere o UX-19.
- **AQ-6. Autor do evento** (RN-20 f). Um campo como `actor_kind` (`member`, `system` ou `none`) para a tela mostrar "Sistema" na gravação sem pessoa e "—" no login sem sessão. Hoje os dois parecem ficar com o autor nulo.
- **AQ-7. Gravação sem mudança** (RN-04 b, UXD-9). A gravação devolve se algo mudou (por exemplo, `changed: boolean`, ou a linha com a autoria nova), para o toast ser o da T5 também quando só o servidor percebe que nada mudou.
  - *Padrão sem isso:* só a comparação da tela.
- **AQ-8. Falha da Auditoria ao salvar** (RN-14). Um código que a tela distinga das recusas de regra (por exemplo, `audit_write_failed`), nas tabelas, nas RPCs e na função de cadastro, para mostrar a mensagem de conexão, e não "Você não tem permissão para esta ação." nem o texto do banco.
  - *Padrão sem isso:* todo erro que a tela não reconhece vira a mensagem de conexão.
- **AQ-9. Parâmetros da URL.** Confirmar `record_type` e `record_id` (ou outros nomes) e os valores de `action` e `entity` usados nos filtros, inclusive o da entidade "Função".

### Pendências para o PO (resolvidas em 2026-11-23)
Nenhuma bloqueava o desenho. O PO resolveu todas em 2026-11-23 e registrou as decisões em "Negócio > Decisões > Padrões definidos por este spec" (P-AUD-20 a P-AUD-27), nas RNs, nos critérios e em "Textos de tela". **Revisar no PR.** Na UX, só para refletir as decisões, foram ajustados: a nota de guarda (T7 e Textos), o filtro e a segunda linha da T7, a lista da T9, o painel da T10, a tabela de rótulos, as linhas de descrições, segunda linha e painel em Textos, e os critérios UX-18, UX-22 e UX-24. O `ux-designer` pode revisar esses ajustes.

- **PO-UX-1. Salvar sem mudança** (UXD-9, T5). Na edição, sem nenhuma mudança, "Salvar alterações" fecha o formulário sem gravar e mostra "Nenhuma alteração para salvar.".
  - *Adotado.* É a consequência do P-AUD-03 na tela.
  - *Alternativa:* mostrar o toast de sucesso de hoje, sem gravar. É mais simples, mas diz "atualizado" quando nada mudou, e a autoria continua com outra pessoa.
  - ***Resolvida (PO):** aceito (P-AUD-20). A RN-04 (b) passou a citar o aviso, e o critério dela também.*
- **PO-UX-2. "Ver histórico" também no painel do evento** (UXD-8, T10). A RN-19 põe a ação no registro aberto. A UX a repete no painel de um evento de registro, para quem já está na Auditoria. Não muda o público: só quem audita entra na Auditoria.
  - *Adotado como proposta.* O UX-24 depende desta resposta.
  - ***Resolvida (PO):** aceito (P-AUD-21). Não amplia o público e poupa a volta ao registro. A RN-19 passou a citar os dois lugares e ganhou um critério. O UX-24 deixou de depender da resposta.*
- **PO-UX-3. Descrições dos eventos** (UXD-11). O Negócio deu só as de funções. A UX propõe "Cadastrou", "Alterou", "Enviou", "Excluiu" e "Restaurou" para membro, célula e relatório, "Incluiu" e "Retirou" para participantes, e a data como dd/mm/aaaa (tabela de Textos). Hoje são "Criou", "Atualizou", "Registrou", "Adicionou" e "Removeu".
  - *Adotado.* Vale também para os eventos de antes deste passo (AQ-5).
  - ***Resolvida (PO):** aceito (P-AUD-22). "Cadastrou" e "Enviou" seguem a autoria do registro (RN-07). A RN-20 (e) passou a listar o vocabulário e a dizer que vale para os eventos antigos sem mudar o que eles registram (autor, momento, registro e campos). Como mostrar os antigos fica com o `architect` (AQ-5). Os Textos de tela do Negócio ganharam as descrições e os termos a evitar.*
- **PO-UX-4. Nome da função com antes e depois** (T10). A RN-20 (b) não fala de funções. A UX mostra "Nome: {antes} → {depois}" quando a função é renomeada, porque sem o nome antigo não dá para saber qual função mudou de nome; a descrição aparece só pelo nome. O nome de uma função não é dado sensível, e quem audita já vê a função de cada membro nos eventos de membro.
  - *Adotado.*
  - *Alternativa:* só o nome do campo, como nos dados pessoais.
  - ***Resolvida (PO):** aceito (P-AUD-23). O nome da função não é dado pessoal, e sem ele a renomeação fica sem rastro. A RN-15 e a RN-20 (b) passaram a citá-lo, e a RN-15 ganhou um critério.*
- **PO-UX-5. Proposta, não adotada: os participantes do envio num evento só.** Hoje cada participante incluído gera o próprio evento. No histórico de um relatório recém-enviado com 8 participantes, aparecem o envio e mais 8 linhas "Incluiu…" no mesmo minuto, e a estimativa de volume do Negócio (ponto 13) vem quase toda daí. Uma alternativa é o evento de envio listar os participantes, e só as mudanças depois do envio gerarem eventos de participante, como a RN-04 (d) já faz com a autoria.
  - Muda a RN-13 (b), a RN-19 e o critério dela. A tela funciona com qualquer resposta. Depende também do `architect` (E2.11).
  - ***Resolvida (PO):** aceito, e ampliado para a alteração (P-AUD-24). Cada envio e cada alteração do relatório geram um evento só: o envio traz os participantes enviados, e a alteração traz os incluídos e os retirados nela, como já acontece com as permissões das funções (RN-15). Pesou assim:*
    - *volume: os eventos por participante eram quase todo o volume estimado (cerca de 140 mil por ano); com eles dentro do evento do relatório, ficam uns 20 mil eventos de dados por ano;*
    - *ruído: o histórico de um relatório passa de 9 linhas no mesmo minuto para 1 no envio;*
    - *RN-13 (b): a correspondência fica mais simples, porque "uma gravação, um evento" vale para todas as entidades (RN-04 e), sem a exceção "contando os eventos de participantes";*
    - *RN-19: nada se perde, porque quem incluiu e quem retirou cada participante, e quando, continua no evento.*

    *Mudaram: a RN-04 (e), a RN-13 (b), a RN-17 (os eventos de participante de antes deste passo seguem no prazo de 2 anos), a RN-19 e a RN-20 (b) e (f), além dos critérios da RN-13, da RN-19 e da RN-20. A entidade "Participante" sai da tela: os eventos antigos de participante aparecem como eventos do relatório. Na UX, foram ajustados o filtro e a segunda linha da T7, a lista da T9, o painel da T10, a tabela de rótulos, os Textos e os critérios UX-18 e UX-22. Ficam para o `architect` a gravação em duas chamadas até o E2.11 (ponto 7 do Negócio) e o efeito no `set_cell_report_participants` do E2.01 (Impactos).*
- **PO-UX-6. "Login e saída" (nota de guarda) e "Logout" (ação do E1.04) na mesma tela.** A nota do Negócio fala em "saída", e o filtro e o badge mostram "Logout".
  - *Adotado:* os dois textos como estão.
  - *Alternativas:* a nota dizer "Login e logout"; ou a ação passar a "Saída", o que muda o E1.04.
  - ***Resolvida (PO):** a nota e as regras seguem a tela do E1.04, que manteve "Login" e "Logout" por coerência (P-AUD-25). A nota passou a "Login e logout, por 1 ano.", e a RN-04 (c), a RN-17, o P-AUD-14 e o Contexto passaram a dizer "login e logout". Trocar os dois termos por palavras em português em todas as telas fica fora deste passo, porque mudaria o E1.04 (Fora de escopo).*
- **PO-UX-7. Ciência: "Ver histórico" sai do registro** (UXD-2). O histórico abre na Auditoria, na mesma aba. Com alterações não salvas, a tela pede para descartar antes. Ao voltar, a pessoa encontra a lista como estava, mas com o formulário fechado.
  - *Alternativas:* abrir em outra aba (confunde no celular) ou num painel sobre o formulário (sem os filtros e a paginação da Auditoria, e com duas telas cheias empilhadas no celular).
  - ***Resolvida (PO):** ciente e aceito (P-AUD-26). Quem audita quer a Auditoria completa, e o "Descartar as alterações?" protege o que foi digitado. A RN-19 passou a dizer que o histórico abre na mesma tela e pede o descarte antes, com um critério.*
- **PO-UX-8. Textos definidos pela UX** (marcados com † em Textos):
  - "Eventos de toda a igreja" (subtítulo), os placeholders da busca, "Período", "Filtros ({N})", "Aplicar filtros", "Limpar", os chips e o erro do período;
  - "Nenhuma alteração para salvar.", as mensagens de conexão de célula e de relatório e o erro ao carregar a autoria;
  - na Auditoria: "Registro", "Campos alterados", "Permissões", a segunda linha, os rótulos dos campos, as descrições (PO-UX-3), "Ver histórico deste membro" (PO-UX-2) e os estados vazio e de erro;
  - no histórico: os subtítulos, "Histórico do registro", os badges de excluído e o estado vazio com a explicação;
  - os rótulos de "Ver histórico" para o leitor de tela.
  - *Adotados.*
  - ***Resolvida (PO):** aprovados (P-AUD-27), com os ajustes da PO-UX-3 (descrições), da PO-UX-5 (sem a entidade "Participante"; participantes dentro do evento do relatório) e da PO-UX-6 ("Login e logout" na nota). Conferidos com o vocabulário: nenhum usa "Atualização", "Criado por", "usuário" no lugar do nome ou nome técnico.*

## Solução técnica
_Seção do `architect`. Escrita em 2026-11-24, só como desenho: nada foi implementado. **A implementação começa depois do E2.01, do E2.02, do E1.04, do E2.03 e do E2.04 inteiros em produção** (ver [Dependências](#dependências-e-impactos-em-outros-passos)). O desenho parte do estado final desses specs e usa os nomes definidos lá:_
- _E2.01: `set_cell_report_participants`, `enforce_participant_rules`, `_del_raise`, as views de excluídos, o `CellReportSheet`, o `parseAppError` e a convenção do `deleted_by`;_
- _E2.02: `viewer_has`, `my_access`, `save_role`, `delete_role`, `check_member_insert`, `zz_enforce_member_visible_after`, a política de `events` e os rótulos de permissões em `src/lib/access/*`;_
- _E1.04: `_log_event` com `_actor_user_id`, `login_blocked`, o `pg_cron`, o `log_auth_event` só com logout e `src/lib/audit/auth-events.ts`;_
- _E2.03: as ações de senha em `event_action` e a saída da `change-member-password`, que hoje grava em `events` direto com a *service role*;_
- _E2.04: `a0_normalize_member`, `ad_enforce_member_rules`, `use-member-save`, `MemberFormDialog`, `src/lib/dates/sao-paulo.ts`, o `attemptId` e a tabela de respostas da `create-user-admin`._

_Se algum desses nomes ou assinaturas mudar lá, a tarefa 1 volta ao `architect`._

_Conferido em 2026-11-24, só com leitura:_
- _na stack local `supabase_db_mci-e108-pr2` (E1.08 completo e E2.01 com as migrations 1 a 6):_
  - _`events`: colunas, índices, política e privilégios (`anon` e `authenticated` com `arwdDxtm`, inclusive TRUNCATE);_
  - _`event_action`, `event_entity`, `_log_event`, os quatro `_trg_log_*`, `log_auth_event` e `update_updated_at_column`;_
  - _`enforce_member_write_rules`, `sync_spouse_relationship`, `refresh_member_stats_v2`, `set_cell_report_participants` e `enforce_participant_rules`;_
  - _colunas, triggers e privilégios (de tabela e de coluna) de `members`, `cells`, `cell_reports`, participantes, `roles` e `role_permissions`. `cells` não tem trigger de `updated_at`;_
  - _as views do E1.08 e do E2.01, e os papéis (`postgres` e `service_role` com `BYPASSRLS`);_
  - _volatilidade: `timezone(text, timestamptz)` e `search_normalize` imutáveis; `concat_ws` e `pg_current_xact_id` estáveis;_
  - _o planejador: numa view `security_barrier`, um `LEFT JOIN` cujas colunas não são pedidas sai do plano (`EXPLAIN` da `members_view` só com `id` e `name`). Os nomes de autor nas views não pesam nas listas;_
- _no `mci-connect` (`origin/main`, `fdcbe50`): `Events.tsx`, `create-user-admin`, `change-member-password`, `AuthContext.tsx`, `use-members-list.ts`, `use-cells-list.ts` (ordena por `created_at`), `list-query.ts` e `src/lib/members/fields.ts`._

### Revisão das regras
Nenhuma RN voltou ao PO. Os pontos que as RNs não respondem por inteiro foram resolvidos pela leitura mais conservadora e estão em [Definidas pelo architect](#definidas-pelo-architect-revisar-no-pr).

Casos de borda conferidos:
- **Fuso e virada de semana:**
  - o momento vem sempre do relógio do banco e é gravado como `timestamptz`; a tela converte para Brasília;
  - o cadastro de sábado às 23:59 fica em 21/11 (RN-03);
  - o período da Auditoria usa a data de Brasília do evento (`occurred_on`);
  - nenhuma regra deste passo depende da semana.
- **Casal:** o `sync_spouse_relationship` já grava o outro lado na mesma transação e com a mesma sessão. Cada cadastro tocado ganha a própria autoria e o próprio evento (RN-05).
- **Inativo, sem líder, pastor e sem função:** são autores como qualquer outro (RN-02). Marcar como inativo é alteração do dado "Situação".
- **Excluído:**
  - o autor excluído continua com o nome nas views, porque o *join* não filtra;
  - uma sessão de cadastro excluído não grava nada (E2.01). Se chegasse a gravar, receberia 42501 (DA-1).
- **Consolidado (futuro):** a flag entra na lista de campos de dados (ver [Pontos de extensão](#pontos-de-extensão)).
- **Concorrência e volume:** ver [Bloqueios e concorrência](#bloqueios-e-concorrência) e os riscos 4 e 5.

Leituras técnicas. Nenhuma muda regra, mas o PO e o QA precisam saber delas:
1. **"O mesmo momento" (RN-05, RN-13 b).**
   - O momento é lido do relógio (`clock_timestamp()`) **depois** que a linha está travada.
   - Assim, de duas alterações simultâneas do mesmo registro, a que grava por último tem o momento maior, e a autoria do registro é sempre a do último evento dele.
   - Numa gravação que toca mais de um cadastro (o casal), os momentos diferem em microssegundos. Na tela, que mostra os minutos, são iguais.
2. **RN-04 (d) e RN-13 (b) antes do E2.11.**
   - Com duas chamadas (relatório, depois participantes), o envio viraria "Enviado" e, um instante depois, "Alterado".
   - A solução é a RPC mínima `save_cell_report`, que grava os dois numa transação, como a `set_cell_report_participants` do E2.01 (DT-09). O E2.11 a absorve.
   - Ela também atende à RN-14: o relatório não fica gravado sem os participantes.
3. **Salvar sem mudança pela API.** Um PATCH sem mudança de dado responde 200 com a linha, sem evento e sem mexer na autoria (RN-03, RN-04 b). O PostgREST não tem como responder "nada mudou", então a tela compara o `updated_at` devolvido (AQ-7).
4. **Recusas e falhas de login e de senha** seguem o E1.04 e o E2.03: continuam num sub-bloco que não muda a resposta. O "tudo ou nada" vale para cadastro, alteração, exclusão e restauração de registros e de funções.
5. **RN-12 e os participantes de antes deste passo:** ver a DA-3.
6. **Eventos antigos.** A RN-16 proíbe escrever pela API, e não por migration. A migration 5 reescreve a forma e as descrições dos eventos antigos e guarda o original em `metadata.v1` (DT-11).
7. **Auditoria sem permissão.** A leitura dá 42501, e não uma lista vazia (AQ-2), por uma função-portão na view.
8. **`updated_at` muda de sentido.** Passa a ser "última alteração de dados", e não "última gravação da linha". Nada no app usa o sentido antigo; os recálculos de totais e de nível deixam de mexer nele.

#### Respostas aos pontos do PO
| # | Ponto | Resposta |
|---|---|---|
| 1 | Data de alteração | A mesma coluna `updated_at`, com a regra nova: só o carimbo a define, e só quando um dado muda (DT-02). Saem os triggers `update_*_updated_at` de membros e relatórios. Fica nula quando o registro só tem o cadastro. |
| 2 | Cadastro forjável | O carimbo (`zz_stamp_authorship`, o último `BEFORE`) define `created_*` no INSERT e devolve o valor gravado no UPDATE, sem erro, nas três tabelas (DT-05). |
| 3 | Autor de três origens | `*_by uuid → members`, `*_by_kind` (`member`, `system`, `legacy` ou `unknown`) e `*_by_legacy text`, com `CHECK`s de coerência (DT-01). As colunas novas de `members` ganham o GRANT por coluna na própria migration. |
| 4 | Nome do autor | Nas views, por *join* sem filtro de escopo nem de excluídos: só o nome e o tipo (DT-15). A `member_names` não entra. |
| 5 | Uma lista de campos | `private.audit_fields` decide o que conta como alteração, o que vai para a Auditoria e quais campos mostram valor. O `UPDATE OF` dos triggers e os rótulos da tela são conferidos contra ela por teste (DT-06). |
| 6 | Tudo ou nada | Os triggers de Auditoria de registros e de funções não engolem erro. Os testes forçam a falha em cada caminho (DT-07). |
| 7 | Envio e edição do relatório | `save_cell_report` (DT-09) e um evento por transação e registro, com os participantes dentro (DT-08) |
| 8 | "data não registrada" | `created_at` aceita nulo, só quando o autor é do legado ou desconhecido (DT-03). Filtros e contagens por período deixam o nulo de fora sem regra extra. |
| 9 | Funções | Triggers em `roles` e `role_permissions`, para qualquer caminho, com um evento por gravação e a troca da padrão dentro dele. `event_entity` ganha `role` (DT-16). A troca atômica é da `save_role` (E2.02). |
| 10 | Retenção e privilégios | `private.audit_purge()` diário pelo `pg_cron`; `REVOKE` de INSERT, UPDATE, DELETE e TRUNCATE em `events` para `anon`, `authenticated` e `service_role`; `_log_event` só para `postgres` (DT-13, DT-14). |
| 11 | Busca e total no servidor | `events_view` paginada pelo PostgREST, com o total exato, a busca em `search_text` (coluna gerada, sem acento) e o período pela data de Brasília (DT-12). O total exato cabe nas metas do risco 4, então não volta ao PO. |
| 12 | Nome no momento | O evento guarda em `changes` os nomes das pessoas, da célula e da função, resolvidos na gravação (DT-10). |
| 13 | Volume | Cerca de 70 MB em regime, com 2 anos de dados e 1 ano de login (risco 5). Cabe no plano gratuito (500 MB). |

#### Definidas pelo architect (revisar no PR)
Pontos que as RNs não respondem por inteiro. O `architect` adotou a leitura mais conservadora. O usuário pode mudar qualquer um no PR.

| # | Ponto | Padrão adotado | Por quê |
|---|---|---|---|
| DA-1 | Gravação com sessão sem cadastro, de cadastro excluído ou anônima | Recusada com 42501, antes de gravar. | RN-02: a gravação em nome de uma pessoa nunca fica sem autor nem como "Sistema". Nenhum caminho do app chega aqui (RLS e E2.01). |
| DA-2 | Eventos de antes deste passo sem autor, fora da autenticação | Autor "Sistema". O cadastro dos registros criados por esses eventos (RN-12) também fica "Sistema". | RN-20 (f): autor sem pessoa é "Sistema". Sem sessão, só gravam migrations e a *service role*; a função de cadastro grava com a sessão desde o E1.02. |
| DA-3 | RN-12 e os eventos de participante de antes deste passo | Os do mesmo autor até 60 s depois do envio fazem parte do envio e não viram a última alteração do relatório. Os demais contam. Na Auditoria, todos aparecem como alteração do relatório ("Incluiu…", "Retirou…"). | RN-04 (d): os participantes do envio fazem parte do envio. O formulário antigo grava os participantes logo depois do relatório, na mesma ação. Os 60 s seguem o "1 minuto" da RN-10 (c). |
| DA-4 | Casos do legado que a RN-10 não cobre | "Mesmo nome" (RN-10 c) é o texto igual, sem os espaços das pontas. Data de alteração nula: sem alteração. Excluído sem nenhuma das duas datas: a exclusão fica com o momento da carga. | A exclusão precisa de data (E2.01). |
| DA-5 | Excluir uma função que membros excluídos ainda tinham | A limpeza da função desses cadastros (`ON DELETE SET NULL`, DA-2 do E2.01) conta como alteração deles, com o autor da exclusão da função. | RN-04: a função é um dado do membro, e a mudança foi pedida por uma pessoa. |
| DA-6 | Busca da Auditoria | Procura no autor (com "Sistema" nos eventos sem pessoa), no registro e na descrição. Não procura nos nomes dos participantes nem nos valores dos campos. | A RN-18 lista os três campos. |
| DA-7 | Restauração | O evento leva também os campos que a restauração mudou (líder, "Tem liderança?" e função) em "Campos alterados". | São mudanças de dados da mesma gravação (RN-04 e). |
| DA-8 | Exclusão física, só fora da API | Evento "Excluiu …", com `metadata.op = "physical_delete"`. | Continua registrada, com o vocabulário novo. |
| DA-9 | Prazo de uma ação futura | Uma ação nova que não esteja nas listas de 90 dias ou de 1 ano fica 2 anos. | Guarda mais, nunca menos. |
| DA-10 | Troca da função padrão junto com outras mudanças | Um evento só, "Alterou a função {Nome}", com a troca dentro. Só a troca: "{Nome} passou a ser a função padrão (antes: {Nome})". A função que deixou de ser a padrão não ganha evento próprio. | RN-04 (e) e RN-15 |
| DA-11 | Id do autor | As tabelas guardam o id do membro autor (`created_by`, `updated_by`), legível por quem lê a linha, como o `deleted_by` do E2.01. As views não o expõem: só o tipo e o nome. | O id não dá acesso a nada que a pessoa já não veja, e a tela não precisa dele (RN-08). |
| DA-12 | Mudanças na mesma transação que criou o registro | Fazem parte do cadastro: não geram "Alterado" nem evento à parte; o evento de cadastro é atualizado. | Generaliza a RN-04 (d) para qualquer caminho, inclusive o ensaio do E2.02 e RPCs que gravam em dois passos. |

### Visão geral
Seis partes:
1. **Colunas de autoria** em `members`, `cells` e `cell_reports`, com `CHECK`s de coerência.
   - `created_at` aceita nulo para o legado.
   - `updated_at` passa a ser a última alteração de dados.
2. **Lista única de campos** (`private.audit_fields`): o que é dado, de que tipo e se mostra valor na Auditoria.
3. **Escrita no banco, para qualquer caminho:**
   - um trigger `BEFORE` (`zz_stamp_authorship`) carimba a autoria e ignora o que o cliente manda;
   - triggers `AFTER` gravam o evento sem engolir erro, um por transação e registro (`tx_id`), com as mudanças legíveis (`changes`);
   - os participantes e as permissões entram no evento do relatório e da função;
   - `save_cell_report` grava o relatório e os participantes numa chamada.
4. **Leitura:**
   - a autoria nas views, com o nome atual do autor;
   - a `events_view` paginada, com o portão de permissão;
   - o nome do registro para o histórico (`audit_record_label`).
5. **Guarda e imutabilidade:** `REVOKE` em `events` e limpeza diária por categoria.
6. **Passado:**
   - a migration 5 converte os eventos antigos e preenche a autoria dos registros que já existem (RN-12);
   - `private.legacy_authorship` deixa pronta a regra da carga (RN-10, RN-11).

### Modelo de dados e migrations

#### Ordem das migrations
Os nomes são sugestões; o timestamp é o do momento da criação.
- Cada arquivo é idempotente (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP … IF EXISTS` antes de `CREATE TRIGGER`, `DO` com guarda) e roda num banco zerado depois das migrations dos passos anteriores.
- Depois do PR 1, regenere o `types.ts`.

| # | PR | Arquivo | Conteúdo | Por que separado |
|---|---|---|---|---|
| 1 | 1 | `<ts>_e205_01_enums.sql` | `event_entity` ganha `role`; tipos novos `author_kind` (`member`, `system`, `legacy`, `unknown`) e `event_actor_kind` (`member`, `system`, `none`) | Um valor novo de enum não pode ser usado na transação que o cria |
| 2 | 1 | `<ts>_e205_02_schema.sql` | Guarda de pré-requisito; colunas de autoria, ainda sem `NOT NULL` e sem `CHECK`; `created_at` e `updated_at` anuláveis; FKs; `private.audit_fields` com a carga; colunas, índices e privilégios de `events`; GRANT por coluna em `members`; `legacy_author_label` | Estrutura antes das funções |
| 3 | 1 | `<ts>_e205_03_write.sql` | `current_actor`, funções `audit_*`, carimbo e triggers de Auditoria das seis tabelas; saída dos triggers antigos; `_log_event` com `actor_kind`; trava do relatório no trigger de participantes; `save_cell_report`; `legacy_authorship` | Escrita, revisada à parte |
| 4 | 1 | `<ts>_e205_04_read.sql` | Views do E1.08 e de excluídos com a autoria; `events_view`; `audit_assert_access`; `audit_record_label`; grants | Leitura |
| 5 | 1 | `<ts>_e205_05_backfill.sql` | Conversão dos eventos antigos (DT-11); autoria dos registros que já existem (RN-12); `NOT NULL` e `CHECK`s de autoria; `events.actor_kind NOT NULL` | Usa as funções da 3. Roda sem triggers (`replica`) e só preenche o que ainda está vazio |
| 6 | 1 | `<ts>_e205_06_retention.sql` | `audit_retention`, `audit_purge` e o job do `pg_cron` | O efeito (apagar) fica num arquivo próprio |

**Entre uma migration e outra**, o app continua gravando. Por isso:
- um evento gravado pelos triggers antigos entre a 2 e a 3 fica sem `actor_kind` e é convertido pela 5;
- um registro antigo alterado entre a 3 e a 5 já tem a alteração carimbada e o cadastro vazio. A 5 só preenche o que está vazio.

#### DDL de referência (migration 2)
```sql
-- 0. Pré-requisitos: E2.02, E1.04, E2.03 e E2.04 em produção. Falha cedo, sem mudar nada.
DO $$ BEGIN
  IF to_regprocedure('public.save_role(uuid,text,text,public.permission_action[],boolean,timestamptz)') IS NULL
     OR to_regprocedure('public.my_access()') IS NULL
     OR to_regclass('private.sign_in_throttle') IS NULL                 -- E1.04 (e o pg_cron)
     OR to_regclass('private.account_passwords') IS NULL                -- E2.03
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'a0_normalize_member') THEN  -- E2.04
    RAISE EXCEPTION 'E2.05 depende do E2.02, do E1.04, do E2.03 e do E2.04 em produção.';
  END IF;
END $$;

-- 1. Autoria (DT-01). O mesmo bloco para members, cells e cell_reports.
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS created_by        uuid,
  ADD COLUMN IF NOT EXISTS created_by_kind   public.author_kind,   -- NOT NULL na migration 5
  ADD COLUMN IF NOT EXISTS created_by_legacy text,                 -- nome cru do legado ("AdminUser" inclusive)
  ADD COLUMN IF NOT EXISTS updated_by        uuid,
  ADD COLUMN IF NOT EXISTS updated_by_kind   public.author_kind,
  ADD COLUMN IF NOT EXISTS updated_by_legacy text,
  ADD COLUMN IF NOT EXISTS deleted_by_kind   public.author_kind,   -- ao lado do deleted_by do E2.01
  ADD COLUMN IF NOT EXISTS deleted_by_legacy text,
  ALTER COLUMN created_at DROP NOT NULL,                           -- "data não registrada" (DT-03)
  ALTER COLUMN updated_at DROP NOT NULL,                           -- nula: só o cadastro (DT-02)
  ALTER COLUMN updated_at DROP DEFAULT;
-- FKs sem cascata, como o deleted_by (DT-01 do E2.01), dentro de DO com guarda de duplicate_object:
--   <t>_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.members (id)
--   <t>_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.members (id)
-- Sem índice nos *_by (DT-21).

-- 2. Colunas novas de members legíveis por quem lê a linha (seção 5.3; trava por coluna do E1.08).
GRANT SELECT (created_by, created_by_kind, created_by_legacy, updated_by, updated_by_kind,
              updated_by_legacy, deleted_by_kind, deleted_by_legacy) ON public.members TO authenticated;

-- 3. Lista única de campos de dados (DT-06). A carga está na tabela abaixo.
CREATE TABLE IF NOT EXISTS private.audit_fields (
  entity      public.event_entity NOT NULL,
  field       text     NOT NULL,                     -- nome da coluna; é a chave estável da tela
  show_values boolean  NOT NULL,                     -- RN-20 (b): antes → depois
  value_type  text     NOT NULL CHECK (value_type IN
                ('text', 'text_list', 'boolean', 'date', 'time', 'number', 'member', 'role', 'cell')),
  position    smallint NOT NULL,                     -- ordem em "Campos alterados"
  PRIMARY KEY (entity, field),
  UNIQUE (entity, position)
);
ALTER TABLE private.audit_fields ENABLE ROW LEVEL SECURITY;          -- sem políticas
REVOKE ALL ON TABLE private.audit_fields FROM PUBLIC, anon, authenticated, service_role;

-- 4. Eventos (DT-10, DT-12, DT-13). Um ALTER por coluna gerada, depois da coluna que ela usa.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS actor_kind public.event_actor_kind,         -- NOT NULL na migration 5
  ADD COLUMN IF NOT EXISTS changes    jsonb,
  ADD COLUMN IF NOT EXISTS tx_id      xid8 DEFAULT pg_current_xact_id(), -- DT-08
  ADD COLUMN IF NOT EXISTS seq        bigint GENERATED ALWAYS AS IDENTITY;
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS search_text text GENERATED ALWAYS AS (
    public.search_normalize(
      coalesce(CASE WHEN actor_kind = 'system' THEN 'Sistema' END, actor_label, '')
      || ' ' || coalesce(entity_label, '') || ' ' || description)) STORED;   -- || e não concat_ws (estável)

DROP INDEX IF EXISTS public.events_occurred_at_idx;
CREATE INDEX IF NOT EXISTS events_occurred_at_seq_idx ON public.events (occurred_at DESC, seq DESC);
DROP INDEX IF EXISTS public.events_entity_idx;
CREATE INDEX IF NOT EXISTS events_record_idx ON public.events (entity, entity_id, occurred_at DESC, seq DESC);
-- events_action_idx e events_actor_idx ficam (filtro de ação; o log_auth_event do E1.04 usa o segundo).

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.events FROM PUBLIC, anon, authenticated, service_role;
REVOKE SELECT ON public.events FROM anon;
-- A sequência da identidade também sai de anon e authenticated.

-- 5. Nome do autor do legado, como a tela mostra (RN-10 b). EXECUTE para authenticated:
--    as views chamam a função com o papel de quem consulta (lição do E1.08).
CREATE OR REPLACE FUNCTION public.legacy_author_label(_name text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
  SELECT CASE WHEN btrim(_name) = 'AdminUser' THEN 'Administrador' ELSE nullif(btrim(_name), '') END
$$;
```

`CHECK`s de autoria (migration 5, depois do preenchimento), para cada tabela `t`:
```sql
ALTER TABLE public.<t> ALTER COLUMN created_by_kind SET NOT NULL;
ALTER TABLE public.<t> ADD CONSTRAINT <t>_created_authorship_check CHECK (
      (created_by_kind = 'member') = (created_by IS NOT NULL)
  AND (created_by_kind = 'legacy') = (created_by_legacy IS NOT NULL)
  AND (created_at IS NOT NULL OR created_by_kind IN ('legacy', 'unknown')));
ALTER TABLE public.<t> ADD CONSTRAINT <t>_updated_authorship_check CHECK (
      (updated_at IS NULL) = (updated_by_kind IS NULL)
  AND coalesce(updated_by_kind = 'member', false) = (updated_by IS NOT NULL)
  AND coalesce(updated_by_kind = 'legacy', false) = (updated_by_legacy IS NOT NULL));
ALTER TABLE public.<t> ADD CONSTRAINT <t>_deleted_authorship_check CHECK (
      (deleted_at IS NULL) = (deleted_by_kind IS NULL)
  AND coalesce(deleted_by_kind = 'member', false) = (deleted_by IS NOT NULL)
  AND coalesce(deleted_by_kind = 'legacy', false) = (deleted_by_legacy IS NOT NULL));
ALTER TABLE public.<t> ADD CONSTRAINT <t>_legacy_names_check CHECK (
      nullif(btrim(created_by_legacy), '') IS NOT DISTINCT FROM created_by_legacy
  AND nullif(btrim(updated_by_legacy), '') IS NOT DISTINCT FROM updated_by_legacy
  AND nullif(btrim(deleted_by_legacy), '') IS NOT DISTINCT FROM deleted_by_legacy);
-- O deleted_by_check do E2.01 fica (é coberto pelo deleted_authorship_check).
```

#### Lista única de campos (`private.audit_fields`)
É a tabela "Rótulos dos campos na Auditoria" da UX, sem os rótulos, que ficam na tela. Ela decide três coisas, sempre juntas: o que conta como alteração (RN-04), o que a Auditoria registra (RN-13 c) e o que mostra valor (RN-20 b). A mesma lista vai para `supabase/tests/fixtures/audit-fields.json`, de onde saem o pgTAP e o teste de rótulos da tela (DT-06).

| Entidade | Campos, na ordem (`position`) | Tipo (`value_type`) | Com valor |
|---|---|---|---|
| `member` | `name`, `gender` | `text` | sim |
| `member` | `birth_date` | `date` | não |
| `member` | `cpf`, `email`, `mobile_whatsapp`, `phone`, `instagram`, `avatar_url`, `notes`, `zip_code`, `street`, `number`, `complement`, `neighborhood`, `city`, `state` | `text` | não |
| `member` | `leader_id` | `member` | sim |
| `member` | `has_leadership`, `is_pastor` | `boolean` | sim |
| `member` | `spouse_id` | `member` | sim |
| `member` | `is_baptized` | `boolean` | sim |
| `member` | `baptism_date` | `date` | não |
| `member` | `is_active` | `boolean` | sim |
| `member` | `role_id` | `role` | sim |
| `cell` | `leader_id`, `timothy_id`, `host_id` | `member` | sim |
| `cell` | `type`, `meeting_day` | `text` | sim |
| `cell` | `meeting_time` | `time` | sim |
| `cell` | `neighborhood`, `city` | `text` | sim |
| `cell` | `zip_code`, `street`, `number`, `complement`, `state` | `text` | não |
| `cell` | `is_active` | `boolean` | sim |
| `cell_report` | `cell_id` | `cell` | sim |
| `cell_report` | `date` | `date` | sim |
| `cell_report` | `time` | `time` | sim |
| `cell_report` | `was_held` | `boolean` | sim (a tela inverte para "Não houve célula", AQ-4) |
| `cell_report` | `theme`, `reason_not_held` | `text` | sim |
| `cell_report` | `offering` | `number` | sim |
| `cell_report` | `observations` | `text` | não |
| `cell_report` | `visitors` | `text_list` | não |
| `role` | `name` | `text` | sim |
| `role` | `description` | `text` | não |

Ficam fora, de propósito (RN-04 c): `id`, `auth_user_id`, `g12_level`, os totais, as colunas de autoria e de exclusão e, a partir do E2.06, o caminho da liderança e o G12. Os participantes, as permissões e a troca da função padrão não são colunas: entram no evento por fora da lista ([Relatório e participantes](#relatório-e-participantes), [Funções](#funções-rn-15)).

**Teste de classificação** (pgTAP): para cada uma das seis tabelas, toda coluna está na lista, ou numa lista explícita de "não é dado" do próprio teste. Uma coluna nova sem classificação faz o teste falhar. O mesmo teste confere que o `UPDATE OF` dos triggers é a lista mais as colunas de autoria e de exclusão.

#### Integridade garantida pelo banco
| Garantia | Como |
|---|---|
| Autoria coerente: tipo, id, nome do legado e data (RN-09, RN-10) | Os quatro `CHECK`s acima, nas três tabelas. Valem também na carga em `replica`. |
| Cadastro sempre com tipo de autor | `created_by_kind NOT NULL` |
| "data não registrada" só no legado ou sem autor conhecido (RN-10 d) | `<t>_created_authorship_check` |
| Autor aponta para um cadastro que existe | FKs `created_by` e `updated_by` → `members`, sem cascata |
| Só o servidor define a autoria (RN-03) | `zz_stamp_authorship` em qualquer papel ([Carimbo](#carimbo-zz_stamp_authorship)) |
| Ninguém cria, altera nem apaga evento pela API (RN-16) | `REVOKE` em `events` para `anon`, `authenticated` e `service_role`; `_log_event` só para `postgres` |
| Lista de campos, triggers e tela iguais (RN-04, RN-13 c, RN-20 a) | Teste de classificação e o JSON compartilhado |

### Escrita: autoria e eventos

#### Quem é o autor (`private.current_actor`)
Uma função só decide o autor do carimbo e do evento (RN-02, DA-1). Ela olha a sessão (`auth.uid()`), e não o papel do banco: as RPCs *definer* e os triggers rodam como `postgres`, mas carregam a sessão de quem chamou.

```sql
CREATE OR REPLACE FUNCTION private.current_actor(OUT kind public.author_kind, OUT member_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NOT NULL THEN
    -- Consulta própria, e não viewer_member_id(): o portão do E2.03 não pode mudar quem é o autor.
    SELECT m.id INTO member_id FROM public.members m
     WHERE m.auth_user_id = _uid AND m.deleted_at IS NULL;
    IF member_id IS NULL THEN                             -- DA-1
      RAISE EXCEPTION 'Você não tem permissão para esta ação.' USING ERRCODE = '42501';
    END IF;
    kind := 'member';
  ELSIF coalesce(auth.role(), '') = 'anon' THEN           -- DA-1: nada grava como anônimo
    RAISE EXCEPTION 'Você não tem permissão para esta ação.' USING ERRCODE = '42501';
  ELSE
    kind := 'system';                                     -- migration, pg_cron, SQL Editor, chave secreta
  END IF;
END $$;
```

| Caminho | Autor |
|---|---|
| Tela, PostgREST e RPCs com o token do usuário | o membro |
| `create-user-admin` (o INSERT vai com a sessão de quem chama, E1.02 e E2.04) | o membro que cadastrou |
| Triggers em cascata (cônjuge, `ON DELETE SET NULL` da função) | o membro da ação que os disparou |
| Chave secreta, `pg_cron`, migration, SQL Editor | Sistema |
| Carga do legado (`replica`) | nenhum trigger roda; as colunas vêm da carga (RN-10) |

#### Carimbo (`zz_stamp_authorship`)
Um trigger `BEFORE` por tabela, com uma função genérica (`private.stamp_authorship`, *definer*). O nome `zz_` o põe depois de todos os `BEFORE` (a ordem é alfabética), então ele compara o valor final, já normalizado pelo `a0_normalize_member` e pela regra 6 do E1.03 (DT-05).

| Tabela | Quando |
|---|---|
| `members`, `cells`, `cell_reports` | `BEFORE INSERT OR UPDATE OF <campos da lista>, deleted_at, deleted_by, created_at, created_by, created_by_kind, created_by_legacy, updated_at, updated_by, updated_by_kind, updated_by_legacy, deleted_by_kind, deleted_by_legacy` |

- **`UPDATE OF`:** o recálculo de totais e de nível (e o do E2.06) não lista essas colunas, então o trigger nem dispara. O custo do recálculo continua o mesmo (risco 4 do E2.01).
- **As colunas de autoria estão na lista** para que um PATCH que só tenta forjar a autoria também passe pelo carimbo e seja ignorado.

```sql
CREATE OR REPLACE FUNCTION private.stamp_authorship() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _entity public.event_entity := private.audit_entity(TG_TABLE_NAME);
  _actor  record;
  _moment timestamptz;
BEGIN
  IF TG_OP = 'INSERT' THEN                                   -- RN-03: o cliente não define nada
    _actor  := private.current_actor();
    _moment := clock_timestamp();
    NEW.created_at := _moment;  NEW.created_by := _actor.member_id;
    NEW.created_by_kind := _actor.kind;  NEW.created_by_legacy := NULL;
    NEW.updated_at := NULL;  NEW.updated_by := NULL;  NEW.updated_by_kind := NULL;  NEW.updated_by_legacy := NULL;
    NEW.deleted_by_legacy := NULL;
    IF NEW.deleted_at IS NULL THEN                           -- a política de INSERT já exige (E2.01)
      NEW.deleted_by := NULL;  NEW.deleted_by_kind := NULL;
    ELSE                                                     -- só fora da API
      NEW.deleted_at := _moment;  NEW.deleted_by := _actor.member_id;  NEW.deleted_by_kind := _actor.kind;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: o cadastro nunca muda, e o resto da autoria só muda pelas regras abaixo (RN-03).
  NEW.created_at := OLD.created_at;  NEW.created_by := OLD.created_by;
  NEW.created_by_kind := OLD.created_by_kind;  NEW.created_by_legacy := OLD.created_by_legacy;
  NEW.updated_at := OLD.updated_at;  NEW.updated_by := OLD.updated_by;
  NEW.updated_by_kind := OLD.updated_by_kind;  NEW.updated_by_legacy := OLD.updated_by_legacy;
  IF OLD.deleted_at IS NOT DISTINCT FROM NEW.deleted_at THEN
    NEW.deleted_by := OLD.deleted_by;  NEW.deleted_by_kind := OLD.deleted_by_kind;
    NEW.deleted_by_legacy := OLD.deleted_by_legacy;
  END IF;

  IF OLD.deleted_at IS NOT DISTINCT FROM NEW.deleted_at
     AND NOT private.audit_has_changes(_entity, to_jsonb(OLD), to_jsonb(NEW))
     AND current_setting('mci.audit_touch', true) IS DISTINCT FROM NEW.id::text THEN
    RETURN NEW;                                              -- RN-04 (b): nada mudou
  END IF;
  IF OLD.deleted_at IS NOT DISTINCT FROM NEW.deleted_at
     AND private.audit_tx_event_action(_entity, NEW.id) = 'create' THEN
    RETURN NEW;                                              -- DA-12: faz parte do cadastro
  END IF;

  _actor  := private.current_actor();
  _moment := clock_timestamp();                              -- depois da trava da linha (leitura técnica 1)
  NEW.updated_at := _moment;  NEW.updated_by := _actor.member_id;
  NEW.updated_by_kind := _actor.kind;  NEW.updated_by_legacy := NULL;
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN          -- RN-06: excluir
    NEW.deleted_at := _moment;  NEW.deleted_by := _actor.member_id;
    NEW.deleted_by_kind := _actor.kind;  NEW.deleted_by_legacy := NULL;
  ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN       -- RN-06: restaurar
    NEW.deleted_by := NULL;  NEW.deleted_by_kind := NULL;  NEW.deleted_by_legacy := NULL;
  END IF;
  RETURN NEW;
END $$;
```
- As RPCs de exclusão do E2.01 continuam mandando `deleted_at = now()` e `deleted_by`. O carimbo troca pelo mesmo autor e pelo momento do relógio, para a data da exclusão, a da última alteração e a do evento serem a mesma.
- `mci.audit_touch` é uma variável da transação que só as funções de Auditoria ligam, para carimbar o relatório quando só os participantes mudam ([Relatório e participantes](#relatório-e-participantes)). O PostgREST não deixa o cliente definir variáveis com esse nome.

#### Eventos
**Funções internas** (`private`, `SECURITY DEFINER SET search_path = public`, sem grants):

| Função | O que faz |
|---|---|
| `audit_entity(_table name) RETURNS event_entity` | `members` → `member`, `cells` → `cell`, `cell_reports` → `cell_report`, `roles` → `role` |
| `audit_has_changes(_entity, _old jsonb, _new jsonb) RETURNS boolean` | Algum campo da lista mudou? Compara `_old -> field` e `_new -> field` com `IS DISTINCT FROM` (jsonb compara número por valor: 50 = 50.00) |
| `audit_changes(_entity, _old jsonb, _new jsonb) RETURNS jsonb` | O array `fields` de `changes`, na ordem da lista, ou nulo se nada mudou. Campos com valor levam `from` e `to`; os de referência levam o nome e o id. Os demais, só `field`. |
| `audit_ref_name(_value_type text, _id uuid) RETURNS text` | Nome de agora: `member` → `members.name` (sem filtro de excluído); `role` → `roles.name`; `cell` → "célula de {Líder}" |
| `audit_text(_entity, _action, _row jsonb, _changes jsonb) RETURNS TABLE (label text, description text)` | O registro e a descrição, na tabela de [Textos gravados](#textos-gravados) |
| `audit_tx_event(_entity, _id) RETURNS events` | O evento de cadastro ou de alteração deste registro nesta transação (`tx_id = pg_current_xact_id()`, pelo índice `events_record_idx`), com `FOR UPDATE`. `audit_tx_event_action` devolve só a ação. |
| `audit_write(_entity, _id, _action, _moment, _row jsonb, _changes jsonb, _metadata jsonb)` | Funde no evento da transação ([Um evento por gravação](#um-evento-por-gravação)) ou insere um novo. Preenche `actor_kind`, `actor_user_id` (`auth.uid()` quando é membro), `actor_label` (o nome do autor agora, RN-08), `entity_label`, `description`, `changed_fields` (as chaves de `fields`), `changes` e `occurred_at = _moment`. |

**Triggers** (todos *definer*; nenhum engole erro, DT-07):

| Tabela | Trigger (função) | Quando | O que grava |
|---|---|---|---|
| `members`, `cells`, `cell_reports` | `aa_audit_record` (`audit_record_change`) | `AFTER INSERT OR DELETE OR UPDATE OF <campos da lista>, deleted_at` | INSERT: `create`, no momento `NEW.created_at` (relatório: `participants.sent = []`). `deleted_at` de nulo a preenchido: `delete`, com o `metadata` do E2.01. De preenchido a nulo: `restore`, com os campos que mudaram (DA-7). Outra mudança da lista: `update`, a não ser na transação do cadastro (DA-12). DELETE: `delete` com `op: physical_delete` (DA-8). |
| `cell_report_participants` | `aa_audit_participant` (`audit_participant_change`) | `AFTER INSERT OR DELETE FOR EACH ROW` | Entra no evento do relatório ([Relatório e participantes](#relatório-e-participantes)) |
| `roles` | `aa_audit_role` (`audit_role_change`) | `AFTER INSERT OR UPDATE OF name, description, is_default` | [Funções](#funções-rn-15) |
| `roles` | `zz_audit_role_delete` (`audit_role_delete`) | `BEFORE DELETE` | `delete`, com as permissões que a função tinha. `BEFORE` porque, no `AFTER`, a cascata já apagou as permissões. Vem depois do `aa_protect_roles` do E2.02, que recusa antes. |
| `role_permissions` | `aa_audit_role_permission` (`audit_role_permission_change`) | `AFTER INSERT OR UPDATE OR DELETE FOR EACH ROW` | Entra no evento da função. Sem a função (a cascata da exclusão), não grava nada. |

Saem: `trg_log_member_event`, `trg_log_cell_event`, `trg_log_cell_report_event`, `trg_log_cell_report_participant_event`, `update_members_updated_at`, `update_cell_reports_updated_at` e, depois deles, as funções `_trg_log_*`. O `update_roles_updated_at` fica: `roles.updated_at` continua sendo a versão da função para a `save_role` (E2.02).

O evento nunca é gravado num `BEFORE` de registro: um `INSERT … ON CONFLICT DO NOTHING` (que o E2.11 pode usar) dispara o `BEFORE` da linha descartada, e o evento ficaria sem registro. O `AFTER` só dispara para as linhas gravadas.

**`_log_event`** (E1.13, usado pelos eventos de login e de senha do E1.04 e do E2.03): mesma assinatura. Passa a preencher `actor_kind` (`member` com autor; `none` sem autor na entidade `auth`; `system` nos demais). O EXECUTE fica só com `postgres`: a *service role* deixa de poder criar evento por `/rpc` (RN-16).

**Formato de `changes`** (as chaves ausentes não se aplicam ao evento):
```json
{
  "fields": [
    { "field": "leader_id", "from": "Bruno Lima", "to": "Pedro Alves", "from_id": "…", "to_id": "…" },
    { "field": "offering", "from": 50, "to": 80 },
    { "field": "is_active", "from": true, "to": false },
    { "field": "mobile_whatsapp" }
  ],
  "participants": { "sent": [ { "id": "…", "name": "Lia" } ] },
  "permissions":  { "added": [ "view_sensitive_data" ], "removed": [ "edit_member" ] },
  "default_role": { "current": { "id": "…", "name": "Secretaria Geral" },
                    "previous": { "id": "…", "name": "Membro" } }
}
```
- `fields[].field` é a chave da lista. Os valores vêm no tipo dela: texto, booleano, número, data `aaaa-mm-dd`, hora `hh:mm:ss`, ou o nome resolvido na gravação (`member`, `role`, `cell`). Nulo quer dizer "(vazio)".
- `participants`: `sent` no envio; `added` e `removed` na alteração. Os itens trazem o nome de então.
- `permissions`: `all` na criação e na exclusão; `added` e `removed` na alteração. As chaves são as do enum; a tela traduz pelos rótulos do E2.02.
- `default_role`: só na troca da padrão. `previous` é nulo na primeira função padrão.
- A tela nunca mostra os ids (RN-20 d). Eles ficam para o histórico técnico (por exemplo, dois membros com o mesmo nome).
- `metadata` continua com o que é técnico: o `op` e o cônjuge do E2.01, e os campos do E1.04 e do E2.03.

#### Textos gravados
O servidor grava a descrição e o registro (`entity_label`) já no vocabulário deste spec (P-AUD-22, AQ-5). A data do relatório sai com `to_char(date, 'DD/MM/YYYY')`; não depende de fuso.

| Entidade | `entity_label` | `create` | `update` | `delete` / `restore` |
|---|---|---|---|---|
| `member` | {Nome} | Cadastrou o membro {Nome} | Alterou o membro {Nome} · cônjuge desfeito pela exclusão: Vínculo de cônjuge desfeito pela exclusão de {Nome} (E2.01) | Excluiu / Restaurou o membro {Nome} |
| `cell` | Célula de {Líder} | Cadastrou a célula de {Líder} | Alterou a célula de {Líder} | Excluiu / Restaurou a célula de {Líder} |
| `cell_report` | Relatório de {dd/mm/aaaa} da célula de {Líder} | Enviou o relatório de {dd/mm/aaaa} da célula de {Líder} | Alterou o relatório de … | Excluiu / Restaurou o relatório de … |
| `role` | {Nome} | Criou a função {Nome} | Alterou a função {Nome} · só a troca da padrão: {Nome} passou a ser a função padrão (antes: {Nome}) | Excluiu a função {Nome} |

O nome e o líder são os do registro no momento (o novo, se mudaram na mesma gravação). Sem líder: "célula de líder não informado", como hoje.

#### Um evento por gravação
`events.tx_id` guarda a transação. `audit_write` procura um evento do mesmo registro na mesma transação (`audit_tx_event`) e funde nele (DT-08):

| Evento já na transação | O que chega | Resultado |
|---|---|---|
| nenhum | qualquer | evento novo |
| `create` | mudança de campo (DA-12) | o mesmo `create`, com o registro e a descrição refeitos pelo valor final; sem `fields` |
| `create` | participante incluído ou retirado | entra ou sai de `participants.sent` |
| `create` | permissão incluída ou retirada | entra ou sai de `permissions.all` |
| `update` | mudança de campo | por campo: o `from` do primeiro e o `to` do último; o campo que volta ao valor de antes sai. `occurred_at` passa ao carimbo novo. |
| `update` | participante ou permissão | `added` e `removed` líquidos: incluir quem tinha sido retirado na mesma transação anula os dois |
| `delete` ou `restore` | qualquer | não funde: evento novo. Excluir e restaurar são sempre uma gravação só (RPCs do E2.01). |

A fusão só enxerga a própria transação, que ainda não foi gravada para ninguém, então não há disputa entre sessões. Se uma transação mudar um campo e o devolver ao valor de antes, o evento fica sem campos, mas continua existindo (risco 9).

#### Relatório e participantes
**Trigger `aa_audit_participant`**, para cada participante incluído ou retirado:
1. resolve o nome do membro;
2. se há um evento do relatório nesta transação, funde nele (envio: `participants.sent`; alteração: `added` ou `removed`);
3. se não há, é uma alteração só de participantes: liga `mci.audit_touch` com o id do relatório, faz `UPDATE cell_reports SET updated_at = updated_at WHERE id = …` (o carimbo marca o relatório), desliga a variável e grava o evento `update` no momento carimbado.

O `UPDATE` interno roda dentro da função *definer*, então não passa pelo RLS nem pelas regras de escrita do E2.02, que deixam `postgres` passar. Os triggers `BEFORE` do relatório que disparam em qualquer UPDATE (`aa_enforce_cell_report_rules`) não recusam, porque o trigger de participantes já recusou antes os casos dele (E2.01).

**Trava:** o `enforce_participant_rules` (E2.01) passa a travar o relatório com `FOR NO KEY UPDATE`, no lugar de `FOR KEY SHARE`. Agora a mudança de participante altera o relatório, e pegar a trava forte já no começo evita trocar de trava no meio da transação ([Bloqueios](#bloqueios-e-concorrência)).

**RPC `save_cell_report`** (DT-09), `SECURITY INVOKER`: valem o RLS e os triggers de hoje, sem regra nova de permissão. É mínima de propósito; o E2.11 a absorve, com o mesmo nome e o mesmo retorno.

```sql
CREATE OR REPLACE FUNCTION public.save_cell_report(
  _report_id uuid,                     -- nulo: envio
  _report jsonb,                       -- cell_id, date, time, was_held, reason_not_held, theme,
                                       -- observations, visitors, offering; outras chaves são ignoradas
  _participant_ids uuid[] DEFAULT NULL -- conjunto final; nulo: não mexe nos participantes
) RETURNS TABLE (report_id uuid, changed boolean)
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  _r public.cell_reports := jsonb_populate_record(NULL::public.cell_reports, _report);
  _id uuid; _before timestamptz; _after timestamptz;
BEGIN
  IF _report_id IS NULL THEN
    INSERT INTO public.cell_reports (cell_id, date, time, was_held, reason_not_held, theme,
                                     observations, visitors, offering)
    VALUES (… de _r; chave ausente fica com o padrão da coluna …)
    RETURNING id INTO _id;
  ELSE
    -- Trava primeiro o relatório (ordem global) e guarda a versão de antes.
    SELECT c.updated_at INTO _before FROM public.cell_reports c
     WHERE c.id = _report_id FOR NO KEY UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '22023', HINT = 'app_error',
        MESSAGE = 'Este relatório não existe ou já foi excluído.',
        DETAIL  = '{"code": "not_found_or_deleted", "entity": "cell_report"}';
    END IF;
    UPDATE public.cell_reports c SET <só as chaves presentes em _report>
     WHERE c.id = _report_id RETURNING c.id INTO _id;
  END IF;

  IF _participant_ids IS NOT NULL THEN
    PERFORM public.set_cell_report_participants(_id, _participant_ids);
  END IF;

  SELECT c.updated_at INTO _after FROM public.cell_reports c WHERE c.id = _id;
  RETURN QUERY SELECT _id, (_report_id IS NULL OR _after IS DISTINCT FROM _before);  -- AQ-7
END $$;
REVOKE EXECUTE ON FUNCTION public.save_cell_report(uuid, jsonb, uuid[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.save_cell_report(uuid, jsonb, uuid[]) TO authenticated;
```
- **Envio:** o INSERT grava o `create` (`participants.sent = []`), e cada participante entra nele. O relatório mostra só "Enviado por" (RN-04 d).
- **Alteração:** o UPDATE carimba e grava o `update` quando um campo muda; os participantes se fundem nele. Se só os participantes mudam, o primeiro deles carimba o relatório.
- **Recusa em qualquer etapa** (semana, célula excluída, participante excluído, permissão): nada fica gravado (RN-14). Hoje o relatório ficaria sem os participantes.
- A gravação direta de participantes pela API continua possível (políticas do E2.02) e gera um evento de alteração por transação.

#### Funções (RN-15)
Triggers em `roles` e `role_permissions` registram qualquer caminho: a `save_role` e a `delete_role` do E2.02 e a manutenção pela chave secreta, como "Sistema". As funções não têm autoria na tela (P-AUD-01), então nada é carimbado.

| Gravação | Evento |
|---|---|
| Criar (`INSERT` em `roles`, depois as permissões) | `create`, com `fields` vazio e `permissions.all` com as permissões incluídas na mesma transação |
| Mudar nome ou descrição | `update`, com `name` (antes → depois) e `description` (só o nome do campo) |
| Incluir ou retirar permissões | `update`, com `permissions.added` e `removed`; junto com o nome, se mudou na mesma gravação |
| Trocar a padrão (a `save_role` desmarca a anterior e marca a nova, nessa ordem) | Ao desmarcar, a função guarda o id da anterior em `mci.audit_prev_default_role`, uma variável da transação. Ao marcar, o evento da nova ganha `default_role` com a atual e a anterior (DA-10). |
| Excluir | `delete`, com o nome e `permissions.all` com as que a função tinha, lidas no `BEFORE DELETE` |
| Salvar sem mudança | nada |

A `delete_role` limpa a função dos membros excluídos que a tinham (`ON DELETE SET NULL`). Esse UPDATE em `members` passa pelo carimbo e pela Auditoria como alteração desses cadastros (DA-5).

### Leitura

#### Autoria nas views (AQ-1)
`CREATE OR REPLACE VIEW`, com as mesmas colunas na mesma ordem e as novas **no fim**. Continuam *security definer* com `security_barrier`, donas `postgres`.

| View | Colunas novas no fim |
|---|---|
| `members_view`, `cells_view`, `cell_reports_view` | `created_by_kind`, `created_by_name`, `updated_by_kind`, `updated_by_name` |
| `members_deleted_view`, `cells_deleted_view`, `cell_reports_deleted_view` | `deleted_by_kind`. A coluna `deleted_by_name`, que já existe, passa a trazer também o nome do legado. |

```sql
  -- no SELECT de cada view principal:
  m.created_by_kind,
  CASE m.created_by_kind WHEN 'member' THEN cb.name
                         WHEN 'legacy' THEN public.legacy_author_label(m.created_by_legacy) END AS created_by_name,
  m.updated_by_kind,
  CASE m.updated_by_kind WHEN 'member' THEN ub.name
                         WHEN 'legacy' THEN public.legacy_author_label(m.updated_by_legacy) END AS updated_by_name
  -- no FROM, sem filtro de escopo nem de excluídos (RN-08):
  LEFT JOIN public.members cb ON cb.id = m.created_by
  LEFT JOIN public.members ub ON ub.id = m.updated_by
```
- `created_at` e `updated_at` já estão nas views. `created_at` nulo é "data não registrada"; `updated_at` nulo é "só o cadastro".
- Para "Sistema" e "autor não registrado", o nome vem nulo, e o tipo decide o texto.
- O `WHERE` das views não muda. A autoria vem com o registro para quem pode lê-lo, e não vem para quem não pode (RN-07).
- **Custo:** as listas não pedem essas colunas, e o planejador tira os dois *joins* do plano (conferido). A tela lê a autoria por id ao abrir o registro, com `id = …` empurrado para dentro da view (`uuid_eq` é *leakproof*).

#### `events_view` (AQ-2)
```sql
CREATE OR REPLACE VIEW public.events_view WITH (security_invoker = true) AS
SELECT e.id, e.occurred_at,
       (e.occurred_at AT TIME ZONE 'America/Sao_Paulo')::date AS occurred_on,   -- RN-18: datas de Brasília
       e.seq, e.actor_kind, e.actor_label, e.action, e.entity, e.entity_id, e.entity_label,
       e.description, e.changed_fields, e.changes, e.metadata, e.success, e.error_reason, e.search_text
  FROM public.events e
 WHERE (SELECT public.audit_assert_access());          -- portão: 42501 sem "Visualizar Auditoria"
REVOKE ALL ON public.events_view FROM PUBLIC, anon;
GRANT SELECT ON public.events_view TO authenticated;
```
- `security_invoker`: o RLS de `events` (E2.02) continua valendo. Sem `security_barrier`: a view não filtra linhas, então os filtros da tela descem até os índices.
- `audit_assert_access()` (`public`, `STABLE SECURITY DEFINER`, EXECUTE para `authenticated`) devolve `true` ou levanta 42501. Como não depende da linha, o Postgres a roda uma vez, antes de ler (*One-Time Filter*). O erro sai mesmo com a tabela vazia e na contagem.
- `actor_user_id` não sai na view.

| Parâmetro da URL (AQ-9) | Filtro do PostgREST |
|---|---|
| `q` | `withSearch` do E1.08: um `ilike('search_text', …)` por palavra |
| `action` | `.eq('action', …)` |
| `entity` | `.eq('entity', …)` |
| `status` | `.eq('success', status === 'success')` |
| `from`, `to` (`aaaa-mm-dd`) | `.gte('occurred_on', from)`, `.lte('occurred_on', to)` |
| `record_type` + `record_id` | `.eq('entity', record_type).eq('entity_id', record_id).in('action', ['create', 'update', 'delete', 'restore'])` |
| `page`, `size` | `.range()` e `count: 'exact'`, pelo `fetchListPage` |
| ordem | `.order('occurred_at', { ascending: false }).order('seq', { ascending: false })` |

#### Histórico de um registro (AQ-3)
- **Quais eventos entram:** todos os de cadastro, alteração, exclusão e restauração com `entity` e `entity_id` do registro, pelo índice `events_record_idx`.
  - Os eventos por consequência (cônjuge, RN-05) são eventos do próprio cadastro, então entram.
  - Os de participante de antes deste passo viram eventos do relatório na migration 5 (DT-11), então também entram.
  - Login e senha ficam de fora (entidade `auth`), como pede a RN-19.
- **Título:** `audit_record_label(_record_type event_entity, _record_id uuid) RETURNS TABLE (name text, leader_name text, report_date date, deleted boolean)`.
  - `STABLE SECURITY DEFINER`, com `view_audit_log`; sem a permissão, 42501.
  - Membro: `name`. Célula: `leader_name`. Relatório: `leader_name` e `report_date`.
  - Lê as tabelas sem filtro de excluídos, porque quem audita vê a igreja toda. `deleted` liga o badge.
  - Registro inexistente: nenhuma linha ("Histórico do registro").

### Eventos e registros de antes deste passo (migration 5)
Roda com `SET LOCAL session_replication_role = replica`: nenhum trigger dispara, então a conversão não carimba nada nem grava eventos novos. Só mexe no que ainda está vazio (`actor_kind IS NULL`, `created_by_kind IS NULL`), e pode rodar de novo.

**1. Eventos antigos (DT-11, AQ-5, RN-20 e, P-AUD-24).** Em cada evento sem `actor_kind`:
- guarda o original: `metadata = coalesce(metadata, '{}') || {"v1": {action, entity, entity_label, description}}`, só quando algo vai mudar;
- `actor_kind`: `member` com `actor_user_id`; `none` sem autor na entidade `auth`; `system` nos demais (DA-2);
- participantes: `entity = 'cell_report'` e `action = 'update'` (o `entity_id` já é o relatório), com `changes.participants.added` ou `removed` e o nome tirado da descrição de então;
- `changes.fields`, montado do `metadata` de então (`{campo: {from, to}}`) e de `changed_fields`:
  - os valores vão para o tipo da lista;
  - as referências viram o nome de hoje (RN-20 c);
  - um campo fora da lista sai;
- descrições e registros, por expressão regular, por entidade:

| Entidade | De | Para |
|---|---|---|
| `member` | `Criou o membro X` · `Atualizou o membro X` · `Removeu o membro X` | `Cadastrou o membro X` · `Alterou o membro X` · `Excluiu o membro X` |
| `cell` | `Criou a célula de X` · `Atualizou a célula de X` · `Removeu a célula de X` | `Cadastrou a célula de X` · `Alterou a célula de X` · `Excluiu a célula de X` |
| `cell` (registro) | `célula de X` | `Célula de X` |
| `cell_report` | `{Registrou \| Atualizou \| Removeu \| Excluiu \| Restaurou} o relatório da célula de X em AAAA-MM-DD` | `{Enviou \| Alterou \| Excluiu \| Excluiu \| Restaurou} o relatório de DD/MM/AAAA da célula de X` |
| `cell_report` e participantes (registro) | `relatório da célula de X em AAAA-MM-DD` | `Relatório de DD/MM/AAAA da célula de X` |
| participantes | `Adicionou N ao relatório da célula de X em AAAA-MM-DD` · `Removeu N do relatório da célula de X em AAAA-MM-DD` | `Incluiu N no relatório de DD/MM/AAAA da célula de X` · `Retirou N do relatório de …` |

  As expressões se ancoram no fim (` em AAAA-MM-DD$`) para aceitar " em " dentro do nome. O que não casar fica como está, e a migration avisa a contagem (`RAISE NOTICE`). A tarefa 1 confere os formatos em produção antes.

**2. Autoria dos registros que já existem (RN-12).** Para cada linha de `members`, `cells` e `cell_reports` com `created_by_kind` nulo:
- **cadastro:** a data fica. O autor vem do primeiro evento `create` do registro:
  - `member`, quando o `actor_user_id` leva a um cadastro (`members.auth_user_id`; qualquer um, excluído ou não);
  - `system`, quando o evento não tem autor (DA-2);
  - `unknown` sem o evento, ou quando a conta do evento não leva a nenhum cadastro;
- **última alteração** (só onde `updated_by_kind` é nulo; o que o carimbo já marcou entre as migrations fica): o último evento `update`, `delete` ou `restore` do registro, por `occurred_at` e `seq`. Nos relatórios, os eventos de participante do mesmo autor até 60 s depois do `create` não contam (DA-3). Sem esse evento, `updated_at` e o autor ficam nulos;
- **exclusão:** nos excluídos, `deleted_by_kind = 'member'` com `deleted_by`; senão, o tipo do autor do último `delete`; senão, `unknown`.

**3.** `created_by_kind SET NOT NULL`, os `CHECK`s de autoria e `events.actor_kind SET NOT NULL`.

### Carga do legado (RN-10, RN-11)
A carga (E4.06) roda em `replica` e grava as colunas de autoria direto, pela função abaixo, criada neste passo e testada já com pgTAP:

```sql
private.legacy_authorship(_created_by text, _created_on timestamp, _updated_by text, _updated_on timestamp,
                          _is_deleted boolean, _load_time timestamptz)
RETURNS TABLE (created_at timestamptz, created_by_kind public.author_kind, created_by_legacy text,
               updated_at timestamptz, updated_by_kind public.author_kind, updated_by_legacy text,
               deleted_at timestamptz, deleted_by_kind public.author_kind, deleted_by_legacy text)
```
| Situação no legado | Resultado |
|---|---|
| Nome com espaços nas pontas | `btrim`; vazio vira nulo |
| Quem cadastrou | `legacy` com o nome cru (inclusive "AdminUser"); sem nome, `unknown` |
| Data de cadastro | `_created_on AT TIME ZONE 'America/Sao_Paulo'`; nula fica nula ("data não registrada", RN-10 d) |
| Última alteração igual ao cadastro: mesmo nome, até 1 minuto depois (RN-10 c, DA-4) | sem alteração (`updated_*` nulos) |
| Data de alteração nula (DA-4) | sem alteração |
| Outra alteração | `updated_at` em Brasília; `legacy` com o nome ou `unknown` |
| Excluído (RN-11) | `deleted_at = coalesce(alteração, cadastro)` em Brasília, ou `_load_time` se as duas forem nulas (DA-4); `deleted_by_legacy` = quem alterou, com o tipo `legacy` ou `unknown`. `deleted_by` fica nulo (E2.01). |

- "AdminUser" vira "Administrador" só na leitura (`legacy_author_label`), e a tela acrescenta "(sistema anterior)". O dado gravado é o do legado.
- A carga, o recálculo depois dela (E4.07) e a criação das contas (E4.08) não geram eventos nem mudam a autoria (RN-10 e):
  - a carga roda em `replica`;
  - o recálculo e as contas mexem só em colunas fora do `UPDATE OF` dos triggers (totais, nível e `auth_user_id`).

### Imutabilidade e prazo de guarda (RN-16, RN-17)
- **Imutável:** sem política de escrita em `events` (como hoje) e sem privilégio de escrita para `anon`, `authenticated` e `service_role` (migration 2). Só funções *definer* do dono (`postgres`) gravam, e só a migration e o job apagam.
- **Prazo por ação** (`private.audit_retention(_action event_action) RETURNS interval`, `STABLE`, compara o texto da ação para não depender de valores do enum):
  - 90 dias: `login_failed`, `login_blocked`, `password_reset_refused`, `password_change_failed` e `password_change_blocked`;
  - 1 ano: `login` e `logout`;
  - 2 anos: as demais, inclusive as que surgirem depois (DA-9).
- **Limpeza:**
  ```sql
  CREATE OR REPLACE FUNCTION private.audit_purge() RETURNS void
  LANGUAGE plpgsql SET search_path = public AS $$
  DECLARE _keep interval; _n int;
  BEGIN
    FOREACH _keep IN ARRAY ARRAY[interval '90 days', interval '1 year', interval '2 years'] LOOP
      LOOP                                                    -- lotes curtos, sem trava longa
        DELETE FROM public.events e
         WHERE e.id IN (SELECT x.id FROM public.events x
                         WHERE x.occurred_at < now() - _keep
                           AND private.audit_retention(x.action) = _keep
                         ORDER BY x.occurred_at LIMIT 5000);
        GET DIAGNOSTICS _n = ROW_COUNT;
        EXIT WHEN _n < 5000;
      END LOOP;
    END LOOP;
  END $$;
  -- Todo dia às 03:20 de Brasília (o pg_cron usa UTC). cron.schedule com o mesmo nome substitui o job.
  SELECT cron.schedule('e205-audit-retention', '20 6 * * *', 'SELECT private.audit_purge()');
  ```
  - Roda como `postgres`, pelo `pg_cron` do E1.04.
  - Remove em até 1 dia depois do fim do prazo, nunca antes (`occurred_at < now() - prazo`).
  - Usa o índice `events_occurred_at_seq_idx`.
- A autoria dos registros e os dados de exclusão ficam nas tabelas e não dependem dos eventos (RN-13 d).

### Bloqueios e concorrência
A ordem global do E2.01 (DT-09) continua: relatório → célula → membros → (célula, semana) → linhas dos triggers. Os eventos ficam no último nível.

| Operação | Mudança deste passo |
|---|---|
| Participante incluído ou retirado (trigger) | O relatório passa de `FOR KEY SHARE` a `FOR NO KEY UPDATE`, no começo, antes da célula e do membro. O carimbo do relatório não troca de trava no meio. |
| `save_cell_report` | Trava o relatório (`FOR NO KEY UPDATE`) antes de tudo, na edição |
| Carimbo | Nenhuma trava nova: roda na linha que já está sendo gravada |
| Fusão de eventos | `FOR UPDATE` só no evento da própria transação, que ninguém mais enxerga |
| `audit_purge` | Só apaga linhas antigas, que nenhuma gravação toca |

Os casos que importam:
- **Duas alterações do mesmo membro ao mesmo tempo:** a segunda espera a linha. O carimbo dela roda depois da espera, com o relógio de então, e a autoria fica com a última gravação, igual ao último evento (RN-13 b, leitura técnica 1).
- **Participantes de um relatório × exclusão ou restauração dele:** o `FOR UPDATE` das RPCs do E2.01 conflita com o `FOR NO KEY UPDATE` dos participantes. Uma espera a outra, e a segunda relê e recusa com a mensagem do E2.01, se for o caso.
- **Dois envios de participantes no mesmo relatório:** ficam em série pela linha do relatório.
- **Duas trocas da função padrão:** já ficam em série pela trava consultiva da `save_role` (E2.02). A variável `mci.audit_prev_default_role` é da transação.
- Nenhum *deadlock* novo. Os conhecidos do E2.01 (cônjuge, totais) continuam (risco 3 de lá).

### Formato dos erros
- **Falha da Auditoria (AQ-8, DT-18):** sem código próprio. O erro sobe como vier (por exemplo, o `CHECK` forçado nos testes), a gravação inteira volta atrás, e a tela trata como erro desconhecido, com a mensagem de conexão.
  - Capturar o erro exigiria um sub-bloco por evento, uma subtransação por linha, e cada participante de um envio abriria a sua.
  - Na `create-user-admin`, a falha acontece no ensaio, antes de criar a conta. _(PR 1: a tabela de respostas do E2.04 dá `400` "Não foi possível salvar o cadastro." para erro desconhecido do banco no ensaio, e não `500`; a Edge Function não muda. O PR 2 trata essa resposta como a mensagem de conexão da T5.)_
- **`save_cell_report`:** as mesmas recusas da gravação nas tabelas (42501 e `app_error` do E2.01, do E2.02 e das regras de semana), mais `not_found_or_deleted`.
- **`events_view` e `audit_record_label`:** 42501 sem "Visualizar Auditoria".
- **DA-1:** 42501.

### Contratos (RPC, Edge Functions, colunas novas)
**Tipos:** `author_kind` (`member`, `system`, `legacy`, `unknown`) e `event_actor_kind` (`member`, `system`, `none`). `event_entity` ganha `role`. O valor `cell_report_participant` fica no enum, sem uso.

**Colunas:**
| Tabela | Colunas |
|---|---|
| `members`, `cells`, `cell_reports` | `created_by`, `created_by_kind`, `created_by_legacy`, `updated_by`, `updated_by_kind`, `updated_by_legacy`, `deleted_by_kind`, `deleted_by_legacy`. `created_at` passa a anulável; `updated_at` passa a anulável, sem valor padrão e com o sentido novo. |
| `events` | `actor_kind`, `changes`, `tx_id`, `seq` e `search_text` |

**Views:** as seis da [tabela de autoria](#autoria-nas-views-aq-1) e a `events_view`.

**RPCs e funções públicas** (EXECUTE só para `authenticated`):
| Nome | Retorno |
|---|---|
| `save_cell_report(_report_id uuid, _report jsonb, _participant_ids uuid[] DEFAULT NULL)` | `TABLE (report_id uuid, changed boolean)` |
| `audit_record_label(_record_type event_entity, _record_id uuid)` | `TABLE (name text, leader_name text, report_date date, deleted boolean)` |
| `audit_assert_access()` | `boolean` (usada pela view) |
| `legacy_author_label(_name text)` | `text` (usada pelas views) |

**Internas** (`private`, sem grants): `current_actor`, `stamp_authorship`, `audit_entity`, `audit_has_changes`, `audit_changes`, `audit_ref_name`, `audit_text`, `audit_tx_event`, `audit_tx_event_action`, `audit_write`, `audit_participants`, `audit_record_change`, `audit_participant_change`, `audit_role_change`, `audit_role_delete`, `audit_role_permission_change`, `audit_retention`, `audit_purge`, `legacy_authorship` e a tabela `audit_fields`.

**Job:** `e205-audit-retention` no `pg_cron`.

**Edge Functions:** nenhuma muda. A `create-user-admin` já grava com a sessão de quem chama.

### Front
Segue o padrão dos passos anteriores: os componentes cuidam da tela, o acesso a dados fica nos hooks e a regra pura fica em `src/lib/`.

- **Domínio puro, com Vitest e sem React nem Supabase:**
  - `src/lib/audit/authorship.ts`: `authorshipLines(entity, authorship)` (a frase da T1, UX-01) e `authorLabel(kind, name)` ("Sistema", "{Nome} (sistema anterior)", nulo para "autor não registrado"), usado também nas listas "Excluídos";
  - `src/lib/audit/fields.ts`: rótulo, "mostra valor" e formatação por entidade e campo, a partir do tipo (`boolean` → Sim/Não; `is_active` → Ativo/Inativo ou Ativa/Inativa; `gender` → Masculino/Feminino; `was_held` invertido; `date`, `time`, `number` em reais e "(vazio)"). Um teste falha se as chaves divergirem de `supabase/tests/fixtures/audit-fields.json`;
  - `src/lib/audit/events.ts`: *type guards* de `changes`, sem `any`; a segunda linha (UXD-6); rótulos de ação e de entidade, junto com os do E1.04 e do E2.03 (`auth-events.ts`); as ações do histórico;
  - `src/lib/audit/url-params.ts`: leitura e escrita de `q`, `page`, `size`, `action`, `entity`, `status`, `from`, `to`, `record_type` e `record_id`, sem os padrões e sem os inválidos; os chips;
  - `src/lib/audit/texts.ts`: **todos** os textos deste spec;
  - `src/lib/dates/sao-paulo.ts` (E2.04) ganha `formatSpDateTime` e `formatSpDate`, sempre com `timeZone: "America/Sao_Paulo"` (UX-02);
  - `src/lib/cells/changes.ts` e `src/lib/cell-reports/changes.ts`: o que mudou no formulário (UXD-9), no molde do `changedMemberFields` do E2.04. No relatório, os participantes contam.
- **Hooks:**
  - `use-record-authorship.ts`: lê a autoria por id na view da entidade, ao abrir um registro gravado (T1 com `Skeleton`). O "Ver relatório" já lê o relatório por id e só acrescenta as colunas;
  - `use-cell-report-save.ts`: chama `save_cell_report` e devolve `changed`;
  - `use-member-save` (E2.04) e a gravação da célula passam a `.select('id, updated_at')`. Se o `updated_at` devolvido é igual ao carregado, a tela mostra "Nenhuma alteração para salvar." (AQ-7);
  - `use-events-list.ts`: `events_view` com os filtros da tabela acima, `fetchListPage`, `withSearch`, `useClampPage` e `placeholderData`;
  - `use-audit-record-label.ts`: o título do histórico.
- **Componentes:**
  - `RecordAuthorship` (T1, P30), com "Ver histórico" (P31) só com "Visualizar Auditoria" e o "Descartar as alterações?" quando o formulário tem mudanças;
  - em `src/components/audit/`: `AuditEventList` (cards), `AuditEventTable`, `AuditEventSheet` (T10), `ChangeList` (P32), `AuditFilters` e `AuditFiltersSheet` (T8), `FilterChips`, `PeriodFieldset` (P33) e `RetentionNote`;
  - `Events.tsx` reescrita (T7, T9 e o estado sem acesso do P13).
- **Formulários:**
  - `MemberFormDialog` (E2.04), "Meus dados" (E2.02), `CellForm`, `CellReportForm` e `CellReportSheet` (E2.01) recebem o `RecordAuthorship`;
  - o `CellReportForm` grava numa chamada só (`save_cell_report`);
  - os três mostram a mensagem de conexão da T5 para o erro que não reconhecem;
  - as listas "Excluídos" usam `deleted_by_kind` e `authorLabel` (T6).
- **Lista de células:** `use-cells-list.ts` ordena com `nullsFirst: false`, porque `created_at` pode ser nulo no legado (DT-03).

### Onde cada regra é imposta
| RN | Banco (constraint, RLS, trigger, RPC) | UI |
|---|---|---|
| RN-01 | Colunas de autoria nas três tabelas; participantes alteram o relatório; funções só na Auditoria (triggers de `roles` e `role_permissions`) | Bloco de autoria (T1) |
| RN-02 | `current_actor()` no carimbo e nos eventos; 42501 para sessão sem cadastro ou anônima (DA-1); `create-user-admin` grava com a sessão | — |
| RN-03 | `zz_stamp_authorship` ignora os valores do cliente; o cadastro nunca muda; relógio do banco | — |
| RN-04 | `private.audit_fields` e `UPDATE OF`; comparação do valor final, já normalizado; colunas calculadas, conta e senha fora da lista; DA-12 | "Nenhuma alteração para salvar." (comparação na tela, `changed` e `updated_at`) |
| RN-05 | O carimbo e o evento por linha alcançam o cônjuge alterado pelo `sync_spouse_relationship`, com a mesma sessão | — |
| RN-06 | Transições de `deleted_at` carimbam `updated_*` e `deleted_*`; a restauração limpa `deleted_*` | Autoria e "Excluídos" |
| RN-07 | Colunas nas views, sob o `WHERE` de cada uma; tabelas sob RLS | T1 a T4; nada nas listas |
| RN-08 | *Join* sem filtro nas views *definer*; só o tipo e o nome | Nome só como texto |
| RN-09 | `author_kind` e os `CHECK`s | `authorshipLines` |
| RN-10 | `legacy_authorship` (E4.06); `CHECK`s aceitam legado e data nula; carga em `replica`; `legacy_author_label` | "(sistema anterior)" |
| RN-11 | `deleted_by_kind` e `deleted_by_legacy`; views de excluídos | T6 |
| RN-12 | Migration 5 | — |
| RN-13 | Um evento por transação e registro (`tx_id`); `changes` com participantes; o momento do evento é o do carimbo; lista única | — |
| RN-14 | Triggers sem sub-bloco; `save_cell_report` numa transação; `save_role` e `delete_role` (E2.02) | Mensagem de conexão (T5) |
| RN-15 | Triggers de `roles` e `role_permissions`; `role` em `event_entity` | T10 |
| RN-16 | `REVOKE` em `events`; `_log_event` só para `postgres`; sem políticas de escrita | — |
| RN-17 | `audit_retention`, `audit_purge` e o `pg_cron` | Nota de guarda |
| RN-18 | `events_view`, `search_text`, `occurred_on`, índices, total exato; `audit_assert_access` | T7 e T8 |
| RN-19 | Filtro por `entity` e `entity_id` e pelas quatro ações; `audit_record_label`; participantes antigos convertidos | T9 e "Ver histórico" |
| RN-20 | `changes` com nomes de então; descrições e registros no vocabulário novo; conversão dos antigos; `actor_kind` | Rótulos, valores formatados, sem JSON |

### Respostas às perguntas do UX (AQ-1 a AQ-9)
| # | Resposta |
|---|---|
| AQ-1 | **Sim, com leitura por id.** As views trazem `created_at`, `created_by_kind`, `created_by_name`, `updated_at`, `updated_by_kind` e `updated_by_name`. O nome é o atual (RN-08), ou o do legado já com "Administrador" no lugar de "AdminUser". `updated_*` nulos quando o registro só tem o cadastro, e `created_at` nulo para "data não registrada". A tela lê por id ao abrir (padrão da UX com `Skeleton`): as listas não pedem essas colunas e ficam com o mesmo custo. As de excluídos trazem `deleted_by_kind` e `deleted_by_name`. |
| AQ-2 | **Sim, como view.** `events_view` paginada pelo PostgREST (`range` e `count: 'exact'`), com os filtros e a busca no servidor, o período pela data de Brasília (os dois dias incluídos), a ordem `occurred_at desc, seq desc` e 42501 sem a permissão. A paginação por deslocamento pode repetir um evento, como a tela aceita. |
| AQ-3 | **Sim.** Entram os eventos de cadastro, alteração, exclusão e restauração do registro, inclusive os por consequência e os de participante de antes deste passo, que viram eventos do relatório. O título vem da `audit_record_label`, com `deleted`; sem linha quando o registro não existe. |
| AQ-4 | **Sim.** `changes.fields` com a chave do campo, os valores só nos campos da RN-20 (b), já no tipo, e os nomes resolvidos na gravação. "Não houve célula" é invertido na tela (`was_held` fica como está gravado). Os eventos antigos são convertidos com os nomes de hoje. Funções: `permissions` (`all`, `added`, `removed`), `fields` com o nome antes e depois, e `default_role`. |
| AQ-5 | **O servidor grava as descrições novas, e a migration 5 reescreve as antigas**, guardando o original em `metadata.v1`. A busca acha o mesmo texto que a tela mostra. |
| AQ-6 | **Sim.** `events.actor_kind`: `member`, `system` ou `none` (login sem sessão, "—"). |
| AQ-7 | **Sim.** `save_cell_report` devolve `changed`. Em membro e célula, o PATCH devolve o `updated_at` (`.select('id, updated_at')`), e a tela compara com o carregado: igual quer dizer que nada mudou. |
| AQ-8 | **Não.** Sem código próprio (ver [Formato dos erros](#formato-dos-erros)). O erro desconhecido vira a mensagem de conexão, que é o padrão da UX. |
| AQ-9 | **Confirmados.** `record_type` (`member`, `cell` ou `cell_report`) e `record_id`; `action` (`create`, `update`, `delete`, `restore` e as de login e senha do E1.04 e do E2.03); `entity` (`member`, `cell`, `cell_report`, `role` e `auth`); `status` (`success` ou `error`); `from` e `to` em `aaaa-mm-dd`. |

### Decisões técnicas
| # | Decisão | Motivo |
|---|---|---|
| DT-01 | Autoria em colunas do próprio registro: `*_by uuid → members` (sem cascata), `*_by_kind author_kind` e `*_by_legacy text`, para cadastro, alteração e exclusão, com `CHECK`s de coerência. | Três origens de autor (membro, legado, Sistema), mais "não registrado", sem texto livre para o autor do novo. A convenção do `deleted_by` (E2.01) e de Escolas continua. |
| DT-02 | `updated_at` passa a ser a última alteração de dados, nula quando só há o cadastro. Saem os triggers `update_*_updated_at` de membros e relatórios. | Ponto 1 do PO: hoje muda com totais e nível. Uma coluna só, sem um segundo "alterado em". |
| DT-03 | "data não registrada" é `created_at` nulo, permitido só para autor do legado ou desconhecido. Listas ordenadas por cadastro usam `NULLS LAST`. | RN-10 (d): filtros e contagens por período deixam o nulo de fora sem regra extra (E2.07, E2.10, E2.14). |
| DT-04 | O autor vem de `private.current_actor()`, pela sessão: com cadastro, o membro; sem sessão, "Sistema"; sessão sem cadastro ou anônima, 42501. | RN-02 e DA-1. Não depende de `current_user`, que é `postgres` nas RPCs *definer*. |
| DT-05 | Um trigger `BEFORE` genérico (`zz_stamp_authorship`), o último da tabela, carimba a autoria, ignora os valores do cliente sem erro e lê o momento com `clock_timestamp()`. O evento usa o mesmo momento. | RN-03 e RN-13 (b), inclusive sob concorrência. |
| DT-06 | Uma lista de campos (`private.audit_fields`) decide "mudou", o que vai para a Auditoria e o que mostra valor. Os triggers usam `UPDATE OF` com ela. Um JSON compartilhado e um teste de classificação de colunas mantêm a lista, os triggers e a tela iguais. | Ponto 5 do PO. Os recálculos de totais e de nível nem disparam os triggers. |
| DT-07 | Os eventos de registros, participantes e funções são gravados em triggers `AFTER`, sem engolir erro. Os de login e senha continuam com o sub-bloco do E1.04 e do E2.03. | RN-14. O `AFTER` não dispara para linha descartada por `ON CONFLICT`. |
| DT-08 | Um evento por transação e registro (`events.tx_id`): as gravações seguintes se fundem nele. O que acontece na transação do cadastro faz parte dele (DA-12). | RN-04 (e) e RN-13 (b) com cascatas, RPCs de vários passos e participantes por linha. |
| DT-09 | `save_cell_report`, `SECURITY INVOKER`, grava relatório e participantes numa transação. O E2.11 a absorve. A mudança só de participantes carimba o relatório; o trigger de participantes trava o relatório com `FOR NO KEY UPDATE`. | Ponto 7 do PO, RN-04 (d) e RN-14, sem esperar o E2.11 e sem regra nova de permissão. |
| DT-10 | O evento ganha `actor_kind`, `changes` (campos, participantes, permissões, função padrão, com os nomes de então e os ids das referências), `tx_id`, `seq` e `search_text`. `changed_fields` continua com as chaves. | RN-20 e AQ-4 a AQ-6. O `seq` dá desempate estável dentro da mesma transação. |
| DT-11 | A migration 5 converte os eventos antigos: `actor_kind`, `changes` com os nomes de hoje, descrições e registros no vocabulário novo, e os de participante como alteração do relatório. O original fica em `metadata.v1`. | AQ-5 e P-AUD-24. Um formato só na tela e na busca. A RN-16 é sobre a API. |
| DT-12 | A Auditoria é lida pela `events_view` (`security_invoker`, portão 42501), paginada pelo PostgREST com o total exato, período por `occurred_on` e busca por `search_text`. | Reaproveita o mecanismo das listas do E1.08. A busca não chama `unaccent` linha a linha. |
| DT-13 | `REVOKE` de INSERT, UPDATE, DELETE e TRUNCATE em `events` para `anon`, `authenticated` e `service_role`; `_log_event` só para `postgres`. | RN-16, inclusive para a chave secreta. A `change-member-password`, que gravava direto, já saiu no E2.03. |
| DT-14 | Prazo por ação (`audit_retention`) e limpeza diária em lotes pelo `pg_cron` (`audit_purge`). | RN-17, com o `pg_cron` que o E1.04 já usa. |
| DT-15 | A autoria vai nas views, com o nome atual por *join* sem filtro, só o tipo e o nome. A tela a lê por id ao abrir o registro. | RN-07 e RN-08. As listas não pagam os *joins*. |
| DT-16 | Funções na Auditoria por triggers em `roles` e `role_permissions`, com a troca da padrão no evento da nova padrão. | RN-15 por qualquer caminho, sem acoplar a `save_role` à Auditoria. |
| DT-17 | `private.legacy_authorship` concentra a RN-10 e a RN-11 para a carga, testada já neste passo; "AdminUser" vira "Administrador" na leitura. | O E4.06 só chama a função. O dado gravado é o do legado. |
| DT-18 | Sem código próprio para a falha da Auditoria. | AQ-8: o padrão da tela já serve, e capturar o erro custaria uma subtransação por evento. |
| DT-19 | "Nenhuma alteração para salvar.": a tela compara; o servidor confirma por `changed` (relatório) ou pelo `updated_at` devolvido (membro e célula). | AQ-7, sem RPC nova para membro e célula. |
| DT-20 | A autoria dos registros que já existem vem dos eventos convertidos, com a DA-3 para os participantes. | RN-12 |
| DT-21 | Sem índice nos `*_by`. | Membros nunca são apagados fisicamente (FK sem custo) e nenhuma consulta filtra por autor. É a mesma escolha do `deleted_by` (E2.01). |
| DT-22 | Quatro PRs: (1) banco; (2) gravação nos formulários; (3) autoria na tela; (4) Auditoria nova. | Cada PR vai ao ar sozinho; a janela entre o 1 e o 2 é de minutos ([Implantação](#implantação)). |
| DT-23 | _(PR 1)_ Gravação sem trigger (`replica`: massas de teste, manutenção): `created_by_kind` tem o padrão `system`, e o `deleted_authorship_check` aceita o tipo nulo num excluído (lido como o `deleted_by`, ou "autor não registrado"); sem exclusão, nada da exclusão. Os outros três `CHECK`s ficam como no desenho. | Dezenas de massas de pgTAP e as cargas gravam em `replica` sem as colunas novas. Pela API, o carimbo sempre define o tipo; a carga do E4.06 usa a `legacy_authorship`. A T6 (PR 3) trata o tipo nulo como acima. |
| DT-24 | _(PR 1)_ "Um evento por gravação" é por transação **e comando do cliente**: a fusão (DT-08) e a DA-12 só enxergam os eventos com `occurred_at >= statement_timestamp()`. | Uma chamada da API é um comando (cascatas, RPCs de vários passos e participantes por linha caem num evento, como no desenho). Um script com vários comandos numa transação (migration, SQL Editor, pgTAP) grava um evento por comando, em vez de fundir tudo no primeiro cadastro da transação. |
| DT-25 | _(PR 1)_ `events_view` é *security definer* e sem `security_barrier`; o portão é a `audit_assert_access()` (a mesma permissão da política de `events`), um One-Time Filter que roda antes de qualquer linha. | Com `security_invoker`, o RLS entra como qual de barreira, e `ilike` e `=` de enum (não *leakproof*) não usam índice: a busca levava cerca de 1 s com 300 mil eventos. Com o índice `pg_trgm` em `search_text` (risco 4), 6 ms. O *advisor* acusa `security_definer_view`, como nas outras quatro. |

### Riscos (concorrência, escala, segurança)
1. **Um defeito na Auditoria bloqueia gravações** (RN-14). É o preço do tudo ou nada.
   - Mitigações:
     - funções pequenas e genéricas;
     - pgTAP de cada caminho com a falha forçada e sem ela;
     - o *smoke* e2e de salvar membro, célula, relatório e função a cada deploy.
   - **Recuperação:** uma migration nova corrige a função, sem rollback de dados.
2. **Lista, triggers e tela fora de sincronia** quando alguém acrescenta uma coluna. O teste de classificação falha até a coluna entrar na lista (com o `UPDATE OF`) ou na lista de "não é dado". O E2.06 (caminho e G12), o E2.11 (retrato da célula) e o E4.02 (`legacy_id`) passam por ele.
3. **Conversão dos eventos antigos por expressão regular.** Um formato não previsto fica como está, com o aviso da contagem. A tarefa 1 lista os formatos em produção antes. O original fica em `metadata.v1`.
4. **Custo da Auditoria paginada.** O total exato e a busca varrem as linhas filtradas.
   - Metas no volume de referência (300 mil eventos): página com total abaixo de 300 ms, com ou sem busca e período; histórico de um registro abaixo de 100 ms.
   - Se a busca passar da meta: índice `pg_trgm` em `search_text`. Se o período passar: índice de expressão na data de Brasília. Os dois só se a medida pedir.
5. **Espaço** (ponto 13 do PO). Em regime, com 2 anos de dados (cerca de 40 mil eventos, 0,8 KB cada), 1 ano de login e logout (cerca de 55 mil, 0,35 KB) e 90 dias de falhas, mais os índices: **cerca de 70 MB**, 14% dos 500 MB do plano gratuito.
   - Um ataque ao login continua sendo o risco 5 do E1.04: os 90 dias limitam, mas não impedem, o crescimento.
   - A tarefa 1 mede o tamanho atual; o *advisor* de espaço do Supabase avisa.
6. **`pg_cron` parado.** Os eventos deixam de sair, sem erro visível. A tarefa 1 confere o job; o "Deploy: banco" pode listar a última execução (`cron.job_run_details`), como o E1.04.
7. **Janela entre o PR 1 e o promote do PR 2.** O formulário antigo grava os participantes em outra chamada. Os relatórios enviados nesses minutos ficam com "Alterado por" (a mesma pessoa, segundos depois).
8. **Trava mais forte nos participantes.** Duas gravações de participantes do mesmo relatório passam a ficar em série. O volume é pequeno (um relatório por célula por semana).
9. **Fusão que termina sem mudança.** Uma transação que muda um campo e o devolve deixa um evento sem campos e a autoria marcada. Nenhum caminho do app faz isso; só SQL avulso.
10. **`replica` na migration 5.** Precisa ser permitido ao papel das migrations no Supabase, como a carga já supõe (5.5). A tarefa 1 confere.
11. **Alerta do Supabase.** A `events_view` é `security_invoker`; as outras views continuam *security definer* de propósito (armadilha do E1.08). Não trocar.
12. **Nomes em eventos (LGPD).** A anonimização a pedido do titular precisa reescrever `actor_label`, `entity_label`, `description` e `changes`. É um processo à parte, já fora de escopo.

### Dependências e impactos em outros passos
| Passo | Relação |
|---|---|
| E2.01 (inteiro) | **Pré-requisito.** As RPCs de exclusão e restauração continuam como estão; o carimbo acerta `deleted_*` e `updated_*`. A `set_cell_report_participants` passa a ser chamada pela `save_cell_report`. O `enforce_participant_rules` muda a trava do relatório. As views de excluídos ganham `deleted_by_kind`, e o texto da lista "Excluídos" muda (Impactos do PO). |
| E2.02 (inteiro) | **Pré-requisito.** Usa `viewer_has`, `my_access`, `save_role`, `delete_role` e a política de `events`. As views do E2.02 recebem as colunas no fim. O ensaio (`check_member_insert`) passa pelos triggers novos e não deixa evento. |
| E1.04 (inteiro) | **Pré-requisito.** `pg_cron`, `_log_event` com autor e `log_auth_event` só com logout. O risco 5 de lá fica respondido pela RN-17, e a AQ-6 pela `events_view`. |
| E2.03 (inteiro) | **Pré-requisito.** As ações de senha entram nos prazos. A saída da `change-member-password` é condição para o `REVOKE` de INSERT da *service role*. |
| E2.04 (inteiro) | **Pré-requisito.** O carimbo compara o valor depois do `a0_normalize_member`. `use-member-save` e `MemberFormDialog` recebem o "sem mudança" e a autoria. |
| E2.06 | Sem dependência de ordem. As colunas calculadas novas entram na lista de "não é dado" do teste de classificação e ficam fora do `UPDATE OF`; a propagação de nível não carimba nem gera evento. |
| E2.07, E2.10, E2.14 | Filtros e contagens por cadastro usam `created_at`, que pode ser nulo no legado e fica de fora sozinho. Ordenação por cadastro com `NULLS LAST`. E2.14: semana de domingo a sábado sobre `(created_at AT TIME ZONE 'America/Sao_Paulo')::date`. |
| E2.08, E2.10, E2.12 | Usam o `RecordAuthorship` e o `changedCellFields`. |
| E2.11 | Absorve a `save_cell_report` (mesmo nome e retorno). O retrato da célula entra na lista de "não é dado". Se usar `INSERT … ON CONFLICT`, os eventos continuam certos, porque ficam no `AFTER`. |
| E4.02, E4.06, E4.07, E4.08, E4.09 | As colunas de autoria já existem (5.3). A carga usa `legacy_authorship` em `replica`. O recálculo e as contas não disparam os triggers. A reconciliação confere a autoria por tipo e os `CHECK`s. |
| Escolas | `created_by` já segue a convenção (DT-31 de lá). Para mostrar a autoria (P30), as tabelas de Escolas ganham as mesmas colunas e o mesmo carimbo; os eventos entram com entidades novas e campos na lista. |

**Ordem ideal:** E2.01 (PRs 2 a 6) → E2.02 → E1.04 → E2.03 e E2.04 → **E2.05** → E2.06 e os seguintes. O E2.05 vem antes do E2.07, do E2.10, do E2.11, do E2.14 e do E4.02, que usam o que ele define.

### Pontos de extensão
| Futuro | Onde muda |
|---|---|
| Entidade nova com autoria (Escolas, Consolidação) | As mesmas colunas e `CHECK`s; `zz_stamp_authorship` e `aa_audit_record` com as funções genéricas; o valor novo em `event_entity`; os campos em `private.audit_fields` e no JSON; o verbo no `authorshipLines` |
| Flag de consolidado | É dado do membro: entra na lista, com valor. A conversão em membro vira uma alteração, com quem converteu e quando. |
| Campo novo num registro | Lista, `UPDATE OF`, JSON e rótulo na tela, no mesmo PR (o teste de classificação cobra) |
| Prazos diferentes | Só a `audit_retention` |
| Auditoria por escopo | O `WHERE` da `events_view` ganha o predicado do E2.02 |
| Anonimização (LGPD) | Processo à parte, como `postgres`, sobre os nomes de `events` |

### Implantação
| PR | Ordem | Efeito no front em produção |
|---|---|---|
| 1 (banco) | merge → "Deploy: banco" (migrations 1 a 6) → promote do ajuste mínimo da `Events.tsx` | A autoria começa a ser carimbada, ainda sem tela. Os eventos ganham o vocabulário novo, e os de participante viram alterações do relatório. A Auditoria antiga continua funcionando, com "Alteração" e "Função". Uma falha da Auditoria passa a impedir a gravação. |
| 2 (gravação) | merge → promote **logo em seguida ao PR 1** | O relatório passa a ir numa chamada só. "Nenhuma alteração para salvar." nos três formulários. Antes do promote, ver o risco 7. |
| 3 (autoria na tela) | merge → promote | O bloco de autoria nos registros e o autor do legado em "Excluídos" |
| 4 (Auditoria) | merge → promote | A Auditoria nova e "Ver histórico" |

- O promote já recusa rodar com migration pendente.
- **Rollback:** o front volta pelo promote do commit anterior. As migrations ficam. Se a Auditoria travar gravações, uma migration nova corrige as funções; a conversão dos eventos não volta, mas o original está em `metadata.v1`.

### Verificações obrigatórias (para o QA)
**pgTAP** (`supabase/tests/database/e205_*.test.sql`, autocontido, com `ROLLBACK`). A massa tem casal, pastor, inativo, sem função, excluído, membro de outro ministério, relatório com participantes, uma função criada no teste, registros "do legado" gravados em `replica` e eventos antigos no formato de hoje.

- **Estrutura e privilégios:**
  - os `CHECK`s recusam as combinações inválidas feitas como `postgres` em `replica`;
  - a lista de campos é igual ao JSON (SQL gerado), e o teste de classificação passa;
  - o `UPDATE OF` de cada trigger é a lista mais as colunas de autoria;
  - INSERT, UPDATE, DELETE e TRUNCATE em `events` dão 42501 para `authenticated` (inclusive o administrador) e para `service_role`; `_log_event` por `/rpc` dá 42501 para os dois;
  - funções `private` sem EXECUTE para `anon`, `authenticated` e `service_role`; as públicas novas sem `anon`.
- **RN-01 a RN-03:** cadastro pela `create-user-admin` (stack local) com o autor certo; PATCH com autor e datas forjados, no cadastro e na alteração, ignorado sem erro; o cadastro não muda depois de 3 alterações; "Sistema" com a chave secreta; sessão sem cadastro e anônima recebem 42501 (DA-1); cadastro às 23:59 de sábado em Brasília.
- **RN-04:** salvar sem mudança não muda nada nem grava evento; mudar só o celular grava um evento só com o campo, sem valor; recálculo de totais e de nível não carimba; redefinir senha (E2.03) não carimba; nome e celular numa gravação dão um evento só; envio com 8 participantes dá só o cadastro; incluir um participante depois carimba o relatório; mudar o celular para a mesma forma, escrito de outro jeito, não muda nada (E2.04).
- **RN-05:** definir, trocar e desfazer o cônjuge carimba os três cadastros, cada um com o próprio evento; a exclusão de Paula carimba Otávio com o evento do E2.01.
- **RN-06:** exclusão e restauração carimbam, com `deleted_at = updated_at = occurred_at`; excluir de novo não muda nada.
- **RN-07 e RN-08:** as colunas novas nas views, para quem vê o registro, e nada para quem não vê; nome atual do autor fora do escopo e do autor excluído; nenhuma coluna da view expõe o id do autor; o evento antigo mantém o nome de então.
- **RN-10 e RN-11:** `legacy_authorship` por tabela de casos (1 minuto, mesmo nome, nomes vazios, datas nulas, excluído sem datas); "AdminUser" vira "Administrador" nas views; a carga em `replica` não grava evento.
- **RN-12:** a migration 5 numa massa antiga (com e sem evento de cadastro, participantes no envio e depois, excluídos), e de novo sem mudar nada.
- **RN-13:** depois de uma sequência de cadastros, alterações, exclusões e restaurações, a consulta de correspondência (último evento × autoria) volta vazia; rua da célula e observações do relatório aparecem; a autoria fica depois de apagar os eventos.
- **RN-14:** com um `CHECK` em `events` criado no teste, cada caminho volta atrás inteiro: PATCH de membro, `create-user-admin` (500, sem conta criada), célula, `save_cell_report`, `save_role`, `delete_role`, `delete_member` e `restore_cell`. Sem o `CHECK`, a nova tentativa grava uma vez só.
- **RN-15:** os critérios de criar, alterar permissões, renomear, trocar a padrão, excluir e salvar sem mudança, cada um com um evento só; DA-5.
- **RN-16 e RN-17:** os privilégios acima; `audit_purge` com eventos de 89 e 92 dias, 360 e 368 dias, 2 anos menos 1 dia e 2 anos e 2 dias, por categoria; a autoria não muda.
- **RN-18 e RN-19:** `events_view` sem permissão dá 42501, inclusive na contagem; filtros, período com o evento das 23:59, busca sem acento ("Otavio"), ordem estável; histórico de um membro com cônjuge, exclusão e restauração; histórico de relatório com participantes antigos e novos; `audit_record_label` com excluído e inexistente.
- **RN-20:** `changes` dos eventos novos (nomes de então, tipos, sem valor nos campos sensíveis) e dos convertidos; descrições e registros no vocabulário novo; nenhuma descrição com `aaaa-mm-dd`.

**Concorrência** (script com duas conexões e `pg_sleep`, como no E2.01):
- duas alterações do mesmo membro: a autoria final é a do último evento;
- participantes pela API × `save_cell_report` no mesmo relatório;
- participantes × `delete_cell_report` e × `restore_cell_report`;
- troca do cônjuge × alteração do cônjuge;
- duas trocas da função padrão: a anterior certa em cada evento;
- `audit_purge` × gravações.

Cada cenário termina num estado válido, sem *deadlock* novo.

**Volume** (referência do E1.08 mais 300 mil eventos: 40 mil de dados, 200 mil de login e 60 mil de falhas):
- as metas do risco 4, com o `EXPLAIN` anexado;
- PATCH de membro no máximo 5 ms mais lento que antes;
- `save_cell_report` com 30 participantes abaixo de 150 ms;
- o recálculo de totais sem mudança de custo;
- migration 5 abaixo de 60 s;
- `audit_purge` de 100 mil eventos abaixo de 10 s.

**Vitest:** `authorshipLines` (tabela da UX-01, com fuso UTC e `Asia/Tokyo`), `authorLabel`, `fields.ts` × JSON, *type guards* de `changes`, segunda linha, `url-params`, `changedCellFields` e `changedCellReportFields`.

**Playwright:** os critérios de UX de cada PR, mais o *smoke* de salvar membro, célula, relatório e função.

## Tarefas
_Seção do `architect`._

> **Em produção (2026-11-26):** PR 2 mergeado (squash `80c518d`) e promovido logo depois do PR 1, como pede a Implantação. Antes do merge, `code-reviewer` e `qa` independentes aprovaram (o QA acrescentou o E2E da célula sem mudança e o pgTAP `e205_06_raise_errcode`, que barra `RAISE EXCEPTION` sem `ERRCODE`, de que depende a classificação de erro da tela). Próximo: PRs 3 e 4 num PR só (front seguido, sem momento próprio de publicação), com a revisão de UI e a revisão final do passo (tarefa 17).

> **Andamento (2026-11-26, PR 2):** tarefas 8 a 10 feitas na branch `feat/E2.05-pr2-gravacao`, PR mci-connect#52, a partir da `main` 2dd4fba (PR 1 em produção), na pista A. Sem a ferramenta `Agent`: o `architect` implementou, revisou, testou e fez a revisão de UI; falta a revisão de código e o QA independentes. Divergências do desenho: o hook novo substitui o `use-save-cell-report.ts` (o E2.08 já tinha o `src/lib/cells/changes.ts`, "sem mudança" e a mensagem de conexão na célula, então ali só entrou o `updated_at`); os textos opcionais vazios do relatório (tema, observações, motivo) vão como nulo, para a edição não marcar o campo como alterado (o banco compara estritamente); o 23514 de `CHECK` de tabela vira a mensagem de conexão, e só o do trigger da semana continua com o texto da semana; o `saveFailed` do membro ("Tente de novo.") saiu: todo erro sem regra mostra a mensagem de conexão do E2.04.
>
> **Andamento (2026-11-26):** PR 1 com as tarefas 2 a 7 feitas na branch `feat/E2.05-pr1-autoria` (tarefa 7 escrita e rodada pelo `architect`, sem QA independente); a tarefa 1 (conferência em produção, só leitura) fica com o usuário, com o SQL do relatório do PR. Os testes nomeados `scripts/gen-audit-fields-sql.*` e `supabase/tests/database/e205_*` ficaram em `supabase/tests/fixtures/generate-audit-fields.mjs` (o padrão dos outros geradores) e em cinco arquivos `e205_01` a `e205_05`.

Quatro PRs no `mci-connect`. **Tudo começa depois do E2.01, do E2.02, do E1.04, do E2.03 e do E2.04 inteiros em produção.**
- No PR 1, o banco vai primeiro, e os tipos são regenerados antes do front.
- Cada desenvolvedor aciona o `code-reviewer` ao terminar a sua tarefa; esse passo não aparece na tabela.
- Na coluna RNs, os números são das regras deste spec. Na coluna UX, os dos critérios `UX-`.

| # | Responsável | Descrição | Arquivos | RNs | UX | Depende de |
|---|---|---|---|---|---|---|
| **PR 1: banco** | | | | | | |
| 1 | backend-developer | Conferências **só de leitura** em produção, com autorização do usuário, e no código. Ver o relatório do `architect` para o SQL. Conferir: os nomes e as assinaturas dos passos anteriores; os formatos das descrições e dos registros em `events`; os eventos de participante dentro de 60 s do envio; tamanho do banco e de `events`; o `pg_cron` e os jobs; privilégios de `events` e `_log_event`; os triggers de hoje; `replica` permitido; nenhuma Edge Function grava em `events` nem chama `_log_event`. Divergência: parar e voltar ao `architect`. | — | 12, 14, 16, 17, 20 | — | pré-requisitos em produção |
| 2 | backend-developer | Migrations 1 e 2: enums; guarda de pré-requisito; colunas de autoria e FKs; `created_at` e `updated_at` anuláveis; `private.audit_fields` com a carga; colunas, índices e `REVOKE` de `events`; GRANT por coluna em `members`; `legacy_author_label`. | `supabase/migrations/<ts>_e205_01_enums.sql`, `supabase/migrations/<ts>_e205_02_schema.sql` | 01, 03, 09, 10, 13, 16, 18 | — | 1 |
| 3 | backend-developer | Migration 3 (escrita): `current_actor`; `stamp_authorship` e `zz_stamp_authorship` nas três tabelas; as funções `audit_*` e os triggers das seis tabelas, sem engolir erro; fusão por `tx_id`; textos gravados; saída dos triggers e funções antigos; `_log_event` com `actor_kind` e só para `postgres`; trava do relatório no `enforce_participant_rules`; `save_cell_report`; `legacy_authorship`. | `supabase/migrations/<ts>_e205_03_write.sql` | 01 a 06, 13 a 16, 20 | — | 2 |
| 4 | backend-developer | Migration 4 (leitura): as seis views com a autoria no fim; `events_view`; `audit_assert_access`; `audit_record_label`; grants. | `supabase/migrations/<ts>_e205_04_read.sql` | 07, 08, 11, 18, 19 | dados de 01 a 06, 10 a 27 | 3 |
| 5 | backend-developer | Migrations 5 e 6: conversão dos eventos antigos (com `metadata.v1` e o aviso dos que não casam); RN-12 com a DA-3; `NOT NULL` e `CHECK`s; `audit_retention`, `audit_purge` e o job. Regenerar o `types.ts`. | `supabase/migrations/<ts>_e205_05_backfill.sql`, `supabase/migrations/<ts>_e205_06_retention.sql`, `src/integrations/supabase/types.ts` | 12, 13, 17, 20 | — | 4 |
| 6 | frontend-developer | Ajuste mínimo, para o PR 1 ir ao ar sozinho: em `Events.tsx`, "Alteração" no lugar de "Atualização", a entidade "Função" e sem "Participante"; ajustes de tipo depois do `types.ts` novo (`updated_at` e `created_at` anuláveis). | `src/pages/Events.tsx` e os arquivos que o `tsc` apontar | 20 | 18 | 5 |
| 7 | qa | pgTAP de todas as RNs no banco; `supabase/tests/fixtures/audit-fields.json`, o gerador do SQL e a sincronia; teste de classificação; a falha forçada em cada caminho, inclusive a `create-user-admin` na stack local; concorrência (6 cenários); volume com `EXPLAIN` ([Verificações](#verificações-obrigatórias-para-o-qa)). | `supabase/tests/database/e205_*.test.sql`, `supabase/tests/fixtures/audit-fields.json`, `scripts/gen-audit-fields-sql.*`, `supabase/tests/concurrency/e205_concurrency.sh` | 01 a 20 | — | 5 (escreve em paralelo com 3 a 5, a partir dos contratos) |
| **PR 2: gravação nos formulários** | | | | | | |
| 8 | frontend-developer | - `CellReportForm` grava numa chamada só, pelo `use-cell-report-save` (`save_cell_report`), sem a chamada separada de participantes;<br>- `src/lib/cells/changes.ts` e `src/lib/cell-reports/changes.ts`, com Vitest; a célula grava só o que mudou;<br>- T5 nos três formulários: sem mudança, fecha com "Nenhuma alteração para salvar." (pela tela, por `changed` ou pelo `updated_at` devolvido); erro desconhecido vira a mensagem de conexão junto da ação, com os dados mantidos; "Salvando…" e sem envio duplo;<br>- `use-member-save` e a gravação da célula com `.select('id, updated_at')`, e o `updated_at` na linha que abre o formulário;<br>- `use-cells-list.ts` com `nullsFirst: false`;<br>- os textos em `src/lib/audit/texts.ts`. | `src/hooks/use-cell-report-save.ts`, `src/hooks/use-member-save.ts`, `src/hooks/use-cells-list.ts`, `src/lib/cells/changes.ts`, `src/lib/cell-reports/changes.ts`, `src/lib/audit/texts.ts`, `src/components/{CellForm,CellReportForm}.tsx`, `src/components/members/MemberFormDialog.tsx` | 04, 13, 14 | 08, 09 | PR 1 em produção |
| 9 | ux-designer | Revisão de UI do PR 2 (T5) em 320, 360 e 1280 px, nos temas claro e escuro. | — | — | 08, 09 | 8 |
| 10 | qa | Vitest (`changes`); testes de componente (UX-08 e UX-09 com respostas simuladas); Playwright: RN-04 (só o celular; envio com 8 participantes mostra só o cadastro, lido na view; incluir um depois mostra a alteração), RN-14 com a Auditoria quebrada na stack local; *smoke* de salvar. | `src/**/*.test.ts(x)`, `e2e/autoria-gravacao.spec.ts` | 04, 13, 14 | 04, 08, 09 | 8 |
| **PR 3: autoria na tela** | | | | | | |
| 11 | frontend-developer | - `src/lib/audit/authorship.ts` (UX-01) e as datas de Brasília em `src/lib/dates/sao-paulo.ts`, com Vitest;<br>- `use-record-authorship` e `RecordAuthorship` (T1, P30, sem "Ver histórico" ainda), com `Skeleton` e o erro ao carregar;<br>- o bloco em "Editar membro", "Editar meus dados", "Meus dados", na edição de célula, na edição de relatório e no "Ver relatório" (T2 a T4), na ordem da T2;<br>- listas "Excluídos" com `deleted_by_kind` e `authorLabel` (T6). | `src/lib/audit/authorship.ts`, `src/lib/dates/sao-paulo.ts`, `src/hooks/use-record-authorship.ts`, `src/components/RecordAuthorship.tsx`, `src/components/members/MemberFormDialog.tsx`, `src/components/{CellForm,CellReportForm,CellReportSheet}.tsx`, `src/pages/{MembersDeleted,CellsDeleted,CellReportsDeleted}.tsx`, `src/hooks/use-cell-report.ts` | 01, 06 a 11 | 01 a 05, 10, 28, 29 | PR 2 |
| 12 | ux-designer | Revisão de UI do PR 3 (T1 a T4, T6, P30). | — | — | 01 a 05, 10, 28, 29 | 11 |
| 13 | qa | Vitest (UX-01, UX-02); testes de componente (UX-03, UX-05, UX-10); Playwright: RN-01, RN-02, RN-05, RN-06, RN-07 (Davi pela API), RN-08 (nome novo; autor excluído), RN-10 e RN-11 com registros gravados em `replica`, UX-04 e UX-28. | `src/**/*.test.ts(x)`, `e2e/autoria-tela.spec.ts` | 01 a 03, 05 a 11 | 01 a 05, 10, 28 | 11 |
| **PR 4: Auditoria** | | | | | | |
| 14 | frontend-developer | - `src/lib/audit/{fields,events,url-params}.ts`, com Vitest (inclusive `fields.ts` × JSON);<br>- `use-events-list` e `use-audit-record-label`;<br>- `Events.tsx` reescrita: T7 (cards no celular, tabela no computador, total, nota de guarda), T8 (filtros, `Sheet`, chips, período), T9 (histórico), T10 (painel sem JSON, campos legíveis, permissões, "Ver histórico deste …") e o estado sem acesso do P13;<br>- "Ver histórico" no `RecordAuthorship` (P31), com o "Descartar as alterações?" quando há mudanças. | `src/lib/audit/*`, `src/hooks/use-events-list.ts`, `src/hooks/use-audit-record-label.ts`, `src/pages/Events.tsx`, `src/components/audit/*`, `src/components/RecordAuthorship.tsx` | 15, 17 a 20 | 02, 06, 07, 11 a 27, 29, 30 | PR 3 (o `RecordAuthorship`); o resto pode começar junto com o PR 2 |
| 15 | ux-designer | Revisão de UI do PR 4 (T7 a T10, P31 a P34). | — | — | 06, 07, 11 a 30 | 14 |
| 16 | qa | Vitest; testes de componente (UX-02 na Auditoria, UX-18 a UX-21, UX-23 a UX-25, UX-27, UX-30); Playwright: RN-15, RN-17 (nota), RN-18 (12 mil eventos), RN-19, RN-20; UX-06, UX-07, UX-11 a UX-17, UX-22, UX-26 e UX-28. | `src/**/*.test.ts(x)`, `e2e/auditoria-*.spec.ts` | 15, 17 a 20 | ver descrição | 14 |
| **Fechamento** | | | | | | |
| 17 | architect | Revisão final dos 4 PRs. Atualizar o `CLAUDE.md` (estado atual e armadilhas, ver o relatório do `architect`). O aceite da fase 2 é do `product-owner`. | `CLAUDE.md` | — | — | 7, 10, 13, 16 |

**Ordem de execução:**
- PR 1: 1 → 2 → 3 → 4 → 5 → 6. A 7 é escrita em paralelo com a 3 a 5 e roda depois da 5.
- PR 2: 8 → (9 ∥ 10). O promote do PR 2 vem logo depois do "Deploy: banco" do PR 1 (risco 7).
- PR 3: 11 → (12 ∥ 13).
- PR 4: 14 → (15 ∥ 16). A 14 pode começar junto com a 8 (arquivos diferentes); só o "Ver histórico" no `RecordAuthorship` espera o PR 3.
- 17 no fim.

**Critérios de pronto**
1. **Todas as tarefas de banco:**
   - as migrations rodam num banco zerado depois das existentes e rodam de novo sem erro;
   - nenhuma função nova tem EXECUTE para `anon`, e as de `private` não têm grant nenhum;
   - a `events_view` tem só SELECT para `authenticated`;
   - o `types.ts` está regenerado;
   - os testes do E1.08, do E2.01, do E2.02, do E1.04, do E2.03 e do E2.04 continuam passando.
2. **Tarefa 3:** com a Auditoria quebrada, cada caminho da RN-14 volta atrás inteiro. Nenhum trigger de dados tem `EXCEPTION WHEN OTHERS`.
3. **Tarefa 5:** a consulta de correspondência da RN-13 volta vazia na massa convertida; nenhuma descrição de evento tem data `aaaa-mm-dd`; rodar a migration 5 de novo não muda nada.
4. **Tarefas 6, 8, 11 e 14:**
   - `npm run lint`, `npm test` e `npm run build` verdes;
   - sem `any` e sem asserção de tipo (`as Tipo`) nos arquivos novos (`as const` é permitido);
   - nenhuma regra de domínio dentro de componente;
   - nenhum texto do spec fora de `src/lib/audit/texts.ts` e dos módulos de domínio;
   - nenhuma leitura de `events` direto da tabela (só `events_view`);
   - datas sempre pelo fuso de Brasília.
5. **Tarefa 8:** o envio e a edição do relatório fazem uma chamada de gravação só; salvar sem mudança não faz nenhuma requisição de gravação.
6. **Tarefa 14:** a Auditoria pagina no servidor, com total; sem a permissão, nenhuma requisição de dados de eventos sai; nenhum JSON, nome técnico ou UUID no DOM.
7. **Tarefas 9, 12 e 15:** o `ux-designer` dá o veredito e lista os ajustes, que voltam ao `frontend-developer` antes de o QA fechar o PR.

## Testes
_Seção do `qa`. PR 1 escrito e rodado pelo `architect` em 2026-11-26, na pista A, sobre a base local `base/e205` (E2.09 PR 1 + E2.03 PR 4), **sem a ferramenta `Agent`: falta a revisão e o QA independentes.**_

| RN | Testes (PR 1, banco) | Resultado |
|---|---|---|
| RN-01 a RN-03, DA-1 | `e205_03` (Sistema sem sessão e pela chave secreta; cadastro e alteração forjados ignorados; o cadastro não muda depois de 3 alterações; DA-1 com sessão sem cadastro, excluída, anônima); E2E `autoria-banco` (`create-user-admin` com o autor certo; PATCH forjado pelo PostgREST) | passa |
| RN-04, DA-12 | `e205_03` (sem mudança; o celular escrito de outro jeito; só o celular, sem valor; nome e celular num evento; recálculo e conta não carimbam; o ensaio não deixa evento; envio com 8 participantes só com o cadastro; incluir um depois carimba; `changed`) | passa |
| RN-05, RN-06, DA-5, DA-7 | `e205_03` (definir, trocar e desfazer o cônjuge: 2, 3 e 2 eventos; exclusão de Rita carimba Hugo com o evento do E2.01; `deleted_at = updated_at = occurred_at`; excluir de novo não muda; restauração; a função excluída limpa a do excluído) | passa |
| RN-07, RN-08, RN-10, RN-11 | `e205_04` (autoria nas três views para quem vê, nada para quem não vê; nome atual, de fora do escopo e de excluído; sem id do autor; `legacy_authorship` em 8 casos; "AdminUser" → "Administrador"; carga em `replica` sem evento; "Excluídos" com o legado) | passa |
| RN-12, RN-13, DA-2, DA-3 | `e205_05` (conversão de uma massa antiga, metadata.v1, participantes como alteração do relatório, um formato desconhecido contado; autoria por evento; DA-3; de novo sem mudar nada; a correspondência último evento × autoria vazia, também depois de gravações novas; a autoria fica sem os eventos); `e205_migrations.sh upgrade` e pela CLI | passa |
| RN-14 | `e205_03` (CHECK em `events`: PATCH, cadastro, célula, `save_cell_report`, `save_role`, `delete_role`, `delete_member` e `restore_member` voltam inteiros; de volta, grava uma vez); E2E `autoria-banco` (`create-user-admin` recusa no ensaio sem conta nem cadastro: 400 "Não foi possível salvar o cadastro.", e não 500; nova tentativa grava uma vez) | passa |
| RN-15, DA-10 | `e205_03` (criar, renomear com descrição e permissões, salvar sem mudança, só a troca da padrão, excluir: um evento cada) | passa |
| RN-16, RN-17 | `e205_01` (privilégios de `events` e `_log_event`, inclusive o Administrador e a chave secreta; o job); `e205_05` (prazos 89/92 dias, 360/368, 2 anos ± 1 e 2 dias, por categoria) | passa |
| RN-18, RN-19 | `e205_04` (42501 sem a permissão, também na contagem e sem linha; período das 23:59 de sábado; "otavio"; "Sistema"; ordem estável; histórico; `audit_record_label` com excluído e inexistente) | passa |
| RN-20 | `e205_03` e `e205_05` (`changes` dos novos e dos convertidos; vocabulário novo; nenhuma data `aaaa-mm-dd`) | passa |
| DT-06 | `e205_02` (gerado de `fixtures/audit-fields.json`: lista, classificação das seis tabelas, `UPDATE OF`); `audit-fields-sync.test.ts` (JSON × SQL gerado × migration) | passa |

- **pgTAP:** suíte inteira depois de `db reset`: 54 arquivos e 4.685 testes (os novos: 47, 22, 79, 35 e 31). Só o `e203_02` falhou na suíte, pelo teto de 5 s do login com a máquina carregada, e passa sozinho. Ajustados para o desenho: as colunas novas no fim das views, o vocabulário novo nos eventos, a data da exclusão pelo relógio do carimbo, as massas que datam a exclusão em `replica` e a lista fechada do portão (`legacy_author_label`).
- **Migrations:** `e205_migrations.sh` (as seis rodam de novo sem mudar nada; o upgrade sobre a massa gravada pelos triggers antigos converte e preenche, também por `supabase migration up`). `e203_migrations` e `e209_migrations` pulam a reexecução das migrations que recriam a `members_view` e a `cells_view` depois do E2.05 (como o E2.08 fez depois do E2.09). `e202_migrations` já falhava antes (`g12_level`, E2.06).
- **Concorrência** (`e205_concurrency.sh`, 26 verificações): duas alterações do mesmo membro (vale a última, com o momento maior); participantes × `save_cell_report`; participantes × `delete_cell_report`; `restore_cell_report` × participantes (a segunda espera a trava e o WITH CHECK, com a foto do começo do comando, recusa com 42501; a nova tentativa grava); cônjuge × alteração do cônjuge; duas trocas da padrão; `audit_purge` × gravações. Sem *deadlock*. Regressão: `e201` a `e209_concurrency` passam (a limpeza em `replica` também zera `deleted_by_kind`, DT-23).
- **Volume** (`e205_volume.psql`; 20 mil membros, 1.500 células, 100 mil relatórios, 800 mil participações, 300 mil eventos): migration 5 em 37 s (meta 60); Auditoria página + total 41 ms, página 400 46 ms, busca 6 ms (1,0 s sem o `pg_trgm` e com `security_invoker`, DT-25), últimos 30 dias 175 ms, ação e entidade 3 ms, histórico 0,4 ms; PATCH de membro +0,65 ms; troca de líder +0,35 ms; `save_cell_report` com 30 participantes 54 ms; `audit_purge` de 100 mil em 3,9 s.
- **Front:** Vitest 149 arquivos e 2.126 testes; `tsc` e build verdes; lint com os mesmos 11 problemas de antes (3 erros em `src/components/ui/*` e `tailwind.config`).
- **Playwright** (suíte inteira, `--workers=1`, depois de `db reset`, antes do rebase): 380 passam, 8 pulados, 3 falham sem relação com este PR: o UX-19 de `excluidos-membros` (precisa de mais de 10 células com "a" no banco, como no E2.09), o alvo de 43,99997 px do `sign-in` em 360 px e o UX-14 de `membro-validacoes-cadastro`; os dois últimos passam na repetição. Na primeira rodada, 5 falhas eram das massas que datam a exclusão (corrigidas no commit 3). Depois do rebase na `main` (93d037f): pgTAP inteiro de novo, os mesmos resultados; Vitest 151 arquivos e 2.188 testes; `types.ts` regenerado sem diferença; Playwright de `autoria-banco`, `login`, `celulas-situacao-relatorio`, `dashboard`, `hierarquia-listas` e `excluidos-celulas-relatorios`: 46 passam.
- **Novo E2E** `autoria-banco.spec.ts` (3 testes, pela API, precisa da `create-user-admin` servida).

**PR 2 (gravação nos formulários)**, rodado pelo `architect` em 2026-11-26, na pista A (stack `mci-e104-be` montada do zero, migrations da `main` 2dd4fba), **sem a ferramenta `Agent`: falta o QA independente.**

| RN / UX | Testes (PR 2, front) | Resultado |
|---|---|---|
| RN-04 (b), UX-08 | `changes.test.ts` (relatório: digitar e voltar, horário com segundos, vazio × nulo, cada campo, participantes como conjunto, sem participantes quando "Não houve célula"); `save.test.ts` (`updated_at` igual, outro formato, microssegundos, nulos, sem coluna); componentes dos três formulários (sem requisição de gravação, o aviso; o servidor sem mudança dá o mesmo aviso); E2E `autoria-gravacao` (membro sem mudança e com o celular escrito de outro jeito: nada gravado; relatório sem mudança: nenhuma chamada) | passa |
| RN-04 (d), (e), UX-04 (dados) | E2E `autoria-gravacao`: envio com 8 participantes numa chamada só (`save_cell_report`), a `cell_reports_view` com só o envio e um evento `create` com 8 participantes; incluir um depois: "Alterado por" e um evento `update` com 1 incluído; só o celular: um evento com `mobile_whatsapp` | passa |
| RN-13 | componente do relatório (uma chamada, com o conjunto final, sem gravação direta em `cell_reports` nem em participantes); E2E `exclusao-celulas-relatorios` (RN-13 do E2.01) no contrato novo | passa |
| RN-14, UX-09 | componentes (relatório: `CHECK` em `events`, 5xx e queda de rede; célula e membro: `CHECK` em `events`): mensagem de conexão com `role="alert"` junto da ação, dados mantidos, sem toast, nova tentativa grava uma vez; "Salvando…" e sem envio duplo; E2E `autoria-gravacao` com a Auditoria quebrada (`CHECK (false) NOT VALID` em `events`) no membro, na célula e no envio do relatório | passa |

- **Vitest:** 153 arquivos e 2.225 testes; 1 falha que já existe na `main` desta máquina (`password-policy-cases-sync`, o SQL gerado difere só no ambiente; sem relação). `tsc` e build verdes; lint com os mesmos 11 problemas de antes.
- **Playwright** (`--workers=1`): as specs afetadas pelo diff e o *smoke* de login (`login`, `acesso-*`, `cadastro-*`, `celulas-*`, `excluidos-membros`, `exclusao-*`, `hierarquia-gravacao`, `membro-validacoes-*`, `membros-escopo`, `relatorio-celula-excluida`, `autoria-banco`, `autoria-gravacao`): 225 passam e 3 pulados na primeira rodada; das 3 falhas, a do contrato antigo de participantes foi corrigida (e a spec passa inteira depois), a UX-19 de `excluidos-membros` é a de antes (PR 1) e a UX-24 de `celulas-relatorios-escopo` é instável também na `main` (4 de 8 repetições falham lá: mede a posição durante a animação do diálogo).
- **Revisão de UI (T5)**, feita pelo `architect` com capturas em 320, 360 e 1280 px, claro e escuro, e axe no relatório em 360 px: a mensagem fica logo acima dos botões e legível nos dois temas; o aviso "Nenhuma alteração para salvar." aparece no toast. O axe só acusa o contraste do botão primário no escuro (token `--primary`, problema conhecido). O relatório continua num `Dialog` comum no celular (problema conhecido, E2.11).
