# E2.02: Perfis e escopo de visibilidade e escrita

> Status: **PR 1 (banco, tarefas 1 a 5) implementado em 2026-11-25**, em revisão (branch `feat/E2.02-pr1-banco-escopo` do `mci-connect`), ainda não aplicado em produção. PRs 2 a 6 pendentes. Desenho: Negócio escrito em 2026-11-23 pelo `product-owner`, sem perguntas em aberto. Experiência (UX) escrita em 2026-11-23 pelo `ux-designer`; as pendências PO-UX-1 a PO-UX-13 foram resolvidas pelo PO no mesmo dia. Solução técnica e Tarefas escritas em 2026-11-23 pelo `architect`, com as respostas às AQ-1 a AQ-11. Ficam para revisão do usuário no PR os pontos "definidos pelo spec" (P-PER-01 a P-PER-29) e os "definidos pelo architect" (DA-1 a DA-12). A seção Testes cobre o PR 1.
> Slug: `e2-02-perfis-escopo` · Paridade com o legado: sim (AUT-02, AUT-03, AUT-04, AUT-05, AUT-07, CEL-04 e a parte "quem lança" da REL-11), com regras novas (D3, funções semeadas, função padrão, exclusão de funções e privacidade das consultas de permissão).

## Negócio
_Seção do `product-owner`. Escrita em 2026-11-23 a partir da seção 3.1 (AUT), das seções 6.5 e 6.6 e das decisões D3 e D9 do [`docs/migracao.md`](../migracao.md), do código do legado (filtro de ministério, controllers e `AuthService`), das migrations de RLS e da tela de Funções do `mci-connect` (branch `main`, `14ee75f`), e coerente com o [E1.08](e1-08-paginacao-servidor.md) e o [E2.01](e2-01-exclusao-logica.md). Atualizada no mesmo dia com as decisões do PO sobre as pendências PO-UX-1 a PO-UX-13 da seção Experiência (UX) (P-PER-17 a P-PER-29)._

### Contexto e objetivo
No legado, cada usuário tem um de três perfis: `AppUser` (básico), `AppAdmin` (administrador) e `AppSuperAdmin` (administrador geral). Exceto o administrador geral, todos enxergam só o seu **escopo**: a descendência de si mesmo, do cônjuge, do seu G12 e do cônjuge do G12, além dessas quatro pessoas. Uma célula ou um relatório entra no escopo pelo líder, pelo timóteo ou pelo anfitrião. O escopo vale em toda consulta: listas, seletores, dashboard, exportação e lançamento de relatório.

Hoje o novo (conferido nas migrations e nas telas da `main` em 2026-11-23):
- tem funções configuráveis na tela de Funções, com 24 permissões, no lugar dos três perfis fixos;
- "Visualizar Seu Ministério" mostra o ministério do casal G12, mas:
  - não inclui o cônjuge do próprio usuário nem a descendência dele;
  - não funciona para pastores, que só veem a si mesmos;
  - nos relatórios, ignora o anfitrião;
- as gravações não conferem o escopo:
  - o cadastro de membro aceita qualquer líder;
  - a célula aceita qualquer pessoa como líder, timóteo ou anfitrião;
  - "Enviar Relatório (Qualquer Célula Visível)" não confere se a célula está visível;
- quem tem "Editar Próprio Cadastro" edita a própria célula e lança o relatório dela;
- o anfitrião não lança relatório;
- as funções semeadas pelas migrations não usam escopo:
  - a Líder vê a igreja toda, por "Visualizar Membros (legado)";
  - a Membro só tem "Visualizar Dashboard" e vê só o próprio cadastro;
- a tela libera tudo para a função Administrador por um atalho, mas no banco as permissões dela dependem de configuração;
- as funções usadas pelo RLS aceitam o id de qualquer pessoa, e um usuário logado descobre as permissões e o ministério de outros.

Objetivo do passo:
- igualar o escopo de visibilidade ao do legado, para qualquer função;
- impor o mesmo escopo em toda gravação, no banco;
- transformar os três perfis do legado em três funções semeadas, com as regras de quem atribui cada uma;
- garantir que a função Administrador tenha sempre todas as permissões;
- tirar da tela de Funções as permissões redundantes e corrigir os rótulos.

### Termos
- **Topo da árvore:** quem não tem líder: os pastores e quem está sem liderança.
- **G12 de uma pessoa:** na cadeia de líderes dela, quem está logo abaixo do topo. Quem está logo abaixo do topo é o próprio G12. Quem está no topo não tem G12. No legado, é o segundo nome do caminho da liderança.
- **Escopo do ministério:** o conjunto de pessoas definido na RN-01. É o "filtro de ministério" do legado.
- **Ver / visível:** o que a pessoa enxerga em listas, buscas, totais, seletores, dashboard e pela API (RN-02).
- **Ver a igreja toda:** ter "Visualizar Toda a Igreja" (`view_all_church`).
- **Administrador:** quem tem "Gerenciar Funções" (`manage_roles`), como no E2.01. Nas funções semeadas, é a função Administrador.
- **Função:** o conjunto de permissões configurado na tela de Funções. No legado, "perfil". Cada membro tem no máximo uma.
- **Função padrão:** a que o membro recebe quando quem o cadastra não escolhe outra.
- **Cobrir uma função:** ter todas as permissões dela.
- **Pessoas da célula:** o líder, o timóteo e o anfitrião.

### Personas e permissões
Os nomes entre aspas são os rótulos da tela de Funções depois deste passo (RN-22). As pessoas da coluna "Na massa" estão na [massa de exemplo](#massa-de-exemplo) dos critérios.

| Persona | Quem é | Na massa | Função | O que exercita |
|---|---|---|---|---|
| AD Administrador | administrador geral | Rita | Administrador | vê e altera tudo; atribui e gerencia funções |
| PA Pastor | pastor (D9) | Samuel (e Magda) | Líder | escopo da árvore inteira |
| G12 | discípulo direto dos pastores | Pedro (e Paula) | Líder | escopo do casal G12 |
| LE Líder | líder com o cônjuge em outro ministério | André | Líder | escopo com o cônjuge e a descendência dele |
| OM Líder de outro ministério | líder de outro casal G12 | Diego | Líder | o que fica fora do escopo |
| MB Membro | timóteo de uma célula e anfitrião de outra | Caio | Membro | escopo pelo G12 e pelo cônjuge do G12; lançamento |
| AN Anfitriã | anfitriã de uma célula | Carla | Membro | lançamento pela anfitriã |
| IN Inativo | membro inativo | Fábio | Membro | acesso mantido |
| SL Sem liderança | marcado como sem liderança, não é pastor | Ester | Membro | fora do escopo de todos |
| SF Sem função | membro com conta e sem função | Hugo | nenhuma | só o próprio |
| SC Sem cadastro | conta de acesso sem cadastro de membro | conta X | nenhuma | nada |

### Histórias
- Como líder, quero ver e gerenciar os membros, as células e os relatórios do meu ministério, sem ver nem alterar os dos outros ministérios.
- Como líder casado, quero ver os discípulos do meu cônjuge, porque cuidamos do ministério juntos, mesmo quando ele é discipulado em outro ministério.
- Como pastor, quero ver toda a árvore da igreja.
- Como anfitrião, quero enviar o relatório da célula que acontece na minha casa.
- Como membro, quero ver o meu ministério e manter os meus dados pessoais em dia, sem mexer em liderança, batismo ou situação.
- Como administrador, quero atribuir as funções com segurança, sem que ninguém ganhe mais poder do que quem a atribui.
- Como igreja, quero que ninguém descubra pela API o que outra pessoa vê ou pode fazer.

### Decisões

#### Decisões do usuário e do plano
| # | Decisão | Onde |
|---|---|---|
| D3 (2026-11-23) | Lança relatório: o líder, o timóteo e o anfitrião da célula, mais quem gerencia células no escopo. | RN-13 |
| D9 (2026-11-23) | Pastores: Samuel Colares e Magda Colares (casal), identificados pelo `Id` do legado. | RN-05 |
| D-1 do E1.08 (2026-11-15) | Dados sensíveis só para o próprio membro e para quem tem "Ver Dados Sensíveis". | RN-16 |
| D1 (2026-11-14) | Exclusão lógica: registro excluído não aparece. | RN-15 |
| 6.5 do plano | Perfis do legado viram funções: `AppSuperAdmin` → Administrador, `AppAdmin` → Líder, `AppUser` e sem perfil → Membro; a Líder perde "Visualizar Membros (legado)" e as escritas valem só no escopo. | RN-16 |
| 6.6 do plano | O superusuário de configuração não migra; recomenda-se ter pelo menos dois administradores. | RN-07, RN-21 |

#### Padrões definidos por este spec (revisar no PR)
Pontos que as fontes não respondem. O PO adotou a opção mais conservadora e coerente com o legado. Nas regras, aparecem como "definida pelo spec". O usuário pode mudar qualquer um na revisão do PR.

- **P-PER-01, árvore atual e efeito imediato.** O escopo segue quem é líder de quem no momento da consulta, e não um nível guardado. Mudou o líder, o cônjuge, a função ou as permissões de uma função: o efeito vale na próxima ação, sem sair e entrar (RN-01, RN-08). No legado, o escopo ficava gravado no login e valia por até 1 dia.
- **P-PER-02, o que se vê sempre.** Mesmo sem permissão de visibilidade, a pessoa vê o próprio cadastro, as células em que é líder, timóteo ou anfitrião e os relatórios delas. O novo já faz isso para líder e timóteo; o anfitrião entra por causa da D3 (RN-02).
- **P-PER-03, relatório pelo próprio registro.** O relatório entra no escopo pelas pessoas registradas nele no lançamento, como no legado. Até o E2.11 gravar esse registro, valem as pessoas atuais da célula (RN-04).
- **P-PER-04, relatórios do ministério.** "Visualizar Meus Relatórios" (`view_own_reports`) passa a valer de fato, como "Visualizar Relatórios do Seu Ministério": os relatórios do escopo, sem as listas de membros e células (RN-04). O E1.08 (achado 3) e o E2.01 deixaram essa decisão para este passo.
- **P-PER-05, pastor e sem liderança.** Só quem vê a igreja toda marca alguém como pastor ou como sem liderança. Quem vê só o ministério cadastra e edita membros sempre com um líder visível (RN-10). No legado, o `AppAdmin` podia marcar "Não tem liderança", e o membro sumia da visão dele na hora.
- **P-PER-06, pessoas escolhidas.** Líder, cônjuge, timóteo, anfitrião e participantes novos precisam estar visíveis para quem grava, como os seletores do legado já garantiam. As pessoas que já estavam no registro e não mudaram ficam como estão (RN-09).
- **P-PER-07, D3 com permissão.** As pessoas da célula lançam se a função delas tiver "Enviar Relatório das Próprias Células". "Quem gerencia células" é quem tem "Editar Célula". "Enviar Relatório de Qualquer Célula Visível" continua existindo, limitada ao que a pessoa vê. "Editar Próprio Cadastro" deixa de dar direito de lançar relatório e de editar célula (RN-12, RN-13).
- **P-PER-08, permissões da Líder.** A Líder ganha "Excluir Membro", "Excluir Célula", "Editar Relatórios de Células" e "Excluir Relatórios de Células" (o `AppAdmin` do legado fazia isso) e "Enviar Relatório das Próprias Células". Perde "Visualizar Membros (legado)" e "Visualizar Funções". **Não** recebe "Ver Dados Sensíveis" (D-1), "Alterar Senha de Membros" (E2.03) nem "Atribuir Função" (RN-16).
- **P-PER-09, Administrador imutável.** A função Administrador tem sempre todas as permissões, inclusive as criadas depois. Não pode ser editada, excluída nem marcada como padrão (RN-17).
- **P-PER-10, função padrão.** A Membro é a padrão. O cadastro com a função padrão exige que quem cadastra cubra a função (RN-19).
- **P-PER-11, exclusão de funções.** Não se excluem a Administrador, a função padrão e funções usadas por membros não excluídos (RN-20).
- **P-PER-12, administradores.** O sistema garante pelo menos um administrador. "Pelo menos dois" (6.6) é regra de operação do E3.04, e o sistema não bloqueia ter só um (RN-21).
- **P-PER-13, permissões redundantes.** "Visualizar Membros (legado)" e "Visualizar Dashboard do seu ministério" saem da tela de Funções, trocadas por "Visualizar Toda a Igreja" e "Visualizar Dashboard", com o mesmo efeito de hoje. Os rótulos mudam (RN-22).
- **P-PER-14, privacidade das consultas.** O conserto das funções do RLS que aceitam o id de qualquer pessoa ("Problemas conhecidos") entra neste passo, que já reescreve o escopo (RN-23).
- **P-PER-15, publicação junto com o E2.15.** Com o escopo novo, quem vê só o ministério deixa de ver os pastores, e a árvore de Ministérios, que hoje começa nos pastores, fica vazia para essas pessoas. Por isso, o E2.02 só vai para produção junto com o E2.15 (MIN-02) ou depois dele (ver [Impactos](#impactos-em-outros-passos)).
- **P-PER-16, sem cadastro e sem função.** Uma conta sem cadastro de membro não vê nem altera nada. Um membro sem função vê só o que a P-PER-02 libera e não altera nada (RN-07).
- **Vindos do desenho de UX (2026-11-23, PO-UX-1 a PO-UX-13 em "Experiência (UX)"):**
  - **P-PER-17, dicas das permissões** (PO-UX-1): a tela de Funções explica as permissões menos óbvias com as dicas da UX, e uma nota geral diz que, fora a Auditoria, as permissões valem só para o que a pessoa vê (RN-22).
  - **P-PER-18, "Visualizar Auditoria" na tela** (PO-UX-2): a permissão passa a aparecer na tela de Funções, com uma dica que avisa que a Auditoria mostra a igreja toda, sem limite de ministério. A Auditoria é a única exceção ao escopo (RN-02, RN-22).
  - **P-PER-19, sempre uma função padrão** (PO-UX-3): existe sempre exatamente uma função padrão. Para trocar, marca-se outra, e a anterior deixa de ser a padrão na mesma operação (RN-19).
  - **P-PER-20, mensagem da RN-09 (c)** (PO-UX-4): os textos da UX para a gravação que tiraria o registro do que a pessoa vê (RN-09, Textos de tela).
  - **P-PER-21, função de outra pessoa** (PO-UX-5): só quem pode atribuir funções vê a função de outra pessoa, na tela e pela API. A própria função a pessoa sempre vê (RN-23).
  - **P-PER-22, líder já preenchido** (PO-UX-6): no cadastro novo feito por quem vê só o ministério, o líder vem preenchido com quem cadastra. É a MEM-15 antecipada para esse caso; o E2.07 a estende a todos (RN-10).
  - **P-PER-23, manter não é marcar** (PO-UX-7): quem vê só o ministério edita outros campos de um pastor ou de quem já está sem liderança, sem mexer na marca, e pode dar um líder visível a quem está sem liderança (RN-10).
  - **P-PER-24, retirar não é escolher** (PO-UX-8): quem edita pode tirar de um registro uma pessoa que não vê (por exemplo, um participante do relatório), com aviso de que não poderá incluí-la de novo. Só a pessoa que entra precisa estar visível. O participante **excluído** continua na regra do E2.01 (RN-13 de lá, P-DEL-18): ninguém o retira, nem pela API (RN-09).
  - **P-PER-25, atalho "Novo relatório" no Dashboard** (PO-UX-9): para quem pode enviar o relatório de pelo menos uma célula (RN-13, RN-22).
  - **P-PER-26, Relatórios no menu de quem só envia** (PO-UX-10): o item Relatórios aparece também com qualquer permissão de enviar relatório (RN-22).
  - **P-PER-27, textos da UX** (PO-UX-11): aceitos, com um ajuste no texto de "Sem permissões" (Textos de tela).
  - **P-PER-28, a própria função no menu** (PO-UX-12): aparece embaixo do nome. É sobre a própria pessoa e não esbarra na RN-23.
  - **P-PER-29, subtítulo só quando é verdade** (PO-UX-13): sem "Visualizar Toda a Igreja" e sem "Visualizar Seu Ministério", o Dashboard não mostra o subtítulo "Visão do seu ministério" nem o selo. Do mesmo jeito, a lista de Relatórios de quem não tem permissão de ver relatórios não mostra subtítulo de alcance (RN-22).

### Regras de negócio
Nenhuma regra está "a confirmar". Os caminhos do legado são relativos a `g12app-net/`, com as abreviações do E2.01: `App/` = `G12App.Application/`, `Domain/` = `G12App.Domain/`, `UI/` = `G12App.API/ClientApp/src/`, `Infra/` = `G12App.Infrastructure.Data/` e `API/` = `G12App.API/`.

| ID | Regra | Origem |
|---|---|---|
| RN-01 | **Escopo do ministério.** O escopo do ministério de uma pessoa reúne:<br>- ela mesma, o cônjuge dela, o G12 dela e o cônjuge do G12;<br>- os discípulos de cada uma dessas quatro pessoas, em todos os níveis.<br><br>Detalhes:<br>- O G12 é quem está logo abaixo do topo, na cadeia de líderes da pessoa (ver Termos).<br>- O escopo segue a árvore atual (quem é líder de quem), e não um nível guardado.<br>- A situação (ativo ou inativo) não muda o escopo: o inativo e os discípulos dele continuam no escopo.<br>- Ficam de fora: os pastores (para quem não é pastor nem cônjuge de pastor), os outros G12 e os ministérios deles, o G12 do cônjuge e o ministério dele, e quem está sem liderança (RN-06). | AUT-03; legado (`Domain/Extensions/QueryingExtensions.cs:149-179`; claims de cônjuge, G12 e cônjuge do G12 em `App/Services/AuthService.cs:95-103`; G12 como 2º nome da cadeia em `App/Services/MemberService.cs:223-229`); árvore atual: definida pelo spec (P-PER-01) |
| RN-02 | **O que cada pessoa vê.** Membros, células e relatórios visíveis dependem da função:<br>(a) com "Visualizar Toda a Igreja": tudo;<br>(b) com "Visualizar Seu Ministério": o escopo do ministério (RN-01), com as células e os relatórios dele (RN-03, RN-04);<br>(c) sem nenhuma das duas: nenhum outro membro nem célula além do item (d). Os relatórios também seguem a RN-04;<br>(d) em todos os casos: o próprio cadastro, as células em que a pessoa é líder, timóteo ou anfitrião, e os relatórios dessas células.<br><br>A mesma visibilidade vale em toda parte: listas, buscas, totais, seletores, Dashboard, Ministérios, exportação e API. Nas linhas visíveis, os nomes de referência de pessoas de fora continuam aparecendo, só o nome (RN-06 do E1.08). Registros excluídos não aparecem (E2.01).<br><br>A única exceção é a Auditoria: quem tem "Visualizar Auditoria" vê as alterações de toda a igreja (ver Fora de escopo). | AUT-02, AUT-04, DSH-01; legado (sem filtro para o administrador geral: `QueryingExtensions.cs:154`; filtro em toda consulta: `Infra/Repositories/MemberRepository.cs:44-51`, `CellRepository.cs:37`, `ReportRepository.cs:68-75`); item (d): definida pelo spec (P-PER-02); Auditoria: definida pelo spec (P-PER-18) |
| RN-03 | **Células no escopo.** Uma célula está no escopo quando o líder, o timóteo ou o anfitrião está no escopo do ministério. Basta um dos três. | AUT-03; legado (`QueryingExtensions.cs:309-360`) |
| RN-04 | **Relatórios no escopo.**<br>- Um relatório está no escopo quando o líder, o timóteo ou o anfitrião **registrados no relatório**, no momento do lançamento (REL-09), está no escopo do ministério. Se a célula muda de pessoas depois, o relatório não muda de escopo.<br>- Até o E2.11 gravar esse registro, valem o líder, o timóteo e o anfitrião atuais da célula.<br>- Os participantes acompanham o relatório.<br>- "Visualizar Relatórios de Toda a Igreja" (`view_all_reports`): todos os relatórios.<br>- "Visualizar Relatórios do Seu Ministério" (`view_own_reports`): os relatórios do escopo.<br>- Essas duas permissões mostram só relatórios: não liberam as listas de Membros e de Células. | AUT-03; legado (`QueryingExtensions.cs:404-455`, sobre `LeadershipId`, `HostId` e `TimothyId` gravados em `Domain/Model/Report.cs`); REL-09; transição até o E2.11 e `view_own_reports`: definida pelo spec (P-PER-03, P-PER-04) |
| RN-05 | **Pastores.**<br>- Os pastores são Samuel Colares e Magda Colares (D9). Na carga, eles são identificados pelo `Id` do legado (E4.06).<br>- O escopo do pastor segue a RN-01: ele, o cônjuge e toda a descendência dos dois, sem G12. Ou seja, a árvore inteira da igreja, exceto quem está sem liderança e a descendência dessas pessoas.<br>- Ser pastor não dá permissão. As permissões vêm da função (RN-16). Com "Visualizar Seu Ministério", o pastor vê a árvore inteira; com "Visualizar Toda a Igreja", vê também quem está sem liderança.<br>- Quem vê só o ministério e não é pastor não vê o cadastro dos pastores, só o nome deles como líder (RN-06 do E1.08).<br>- Só quem vê a igreja toda marca ou desmarca alguém como pastor (RN-10). | D9 (2026-11-23); legado (pastor sem G12: `MemberService.cs:223-226`; escopo pela própria descendência e a do cônjuge: `QueryingExtensions.cs:170-176`); "Armadilhas" do `CLAUDE.md` (`get_ministry_root`); demais: definida pelo spec |
| RN-06 | **Quem está sem liderança** (sem líder e sem ser pastor).<br>- Fica fora do escopo dos outros, exceto do cônjuge (RN-01) e de quem vê a igreja toda.<br>- O escopo dele é ele, o cônjuge e a descendência dos dois, sem G12.<br>- Para quem vê só o ministério, o card "Sem liderança" do Dashboard não o conta. | legado (cadeia vazia para quem não tem liderança: `MemberService.cs:210-221`; `QueryingExtensions.cs:170-176`) |
| RN-07 | **Sem cadastro, sem função e inativo.**<br>- Uma conta de acesso sem cadastro de membro não vê nem altera nada: listas vazias, Dashboard recusado e toda gravação recusada com erro de permissão. O superusuário de configuração do legado não migra (3.9).<br>- Um membro sem função vê só o que a RN-02 (d) libera e não altera nada, nem o próprio cadastro.<br>- Um membro inativo continua entrando no sistema, com a mesma função e o mesmo escopo.<br>- O membro excluído segue a RN-14 do E2.01. | 3.9 e 6.2 do plano; legado (o login não filtra inativos: `App/Services/AuthService.cs:50-63`); sem cadastro e sem função: definida pelo spec (P-PER-16), coerente com o E1.03 ("o membro fica sem permissões") |
| RN-08 | **O escopo vale na hora.** O escopo e as permissões são conferidos em cada consulta e em cada gravação. Quando mudam o líder ou o cônjuge de alguém, a marca de pastor, a função de alguém ou as permissões de uma função, o que cada pessoa vê e pode fazer muda na ação seguinte, sem sair e entrar. | definida pelo spec (P-PER-01) |
| RN-09 | **Só se altera o que se vê.** Toda gravação exige, além da permissão:<br>(a) que o registro esteja visível para quem grava, antes da gravação. O que não está visível é tratado como inexistente;<br>(b) que cada pessoa escolhida esteja visível para quem grava: líder, cônjuge, timóteo, anfitrião e participante novo. As pessoas que já estavam no registro e não mudaram ficam como estão;<br>(c) que o registro continue visível depois da gravação. Se não continuar, a gravação é recusada com a mensagem de "deixaria de ver" (Textos de tela).<br><br>**Retirar não é escolher.** Quem grava pode tirar do registro uma pessoa que não vê, ou trocá-la por outra; só a pessoa que entra precisa estar visível. Por exemplo, quem edita um relatório pode retirar um participante de outro ministério. A tela avisa que ele não poderá incluí-lo de novo, e quem vê essa pessoa pode incluí-la de novo. Os limites são:<br>- o item (c);<br>- a RN-10 (líder, pastor e sem liderança);<br>- a fronteira com o E2.01: o participante **excluído** não pode ser retirado por ninguém, nem pela API, porque ninguém poderia incluí-lo de novo (RN-13 do E2.01, P-DEL-18). Quando o participante é ao mesmo tempo invisível e excluído, vale a regra do excluído.<br><br>Vale para cadastrar, editar, excluir, restaurar, atribuir função, lançar relatório e editar ou excluir relatório. Vale pela tela e pela API, inclusive no cadastro feito pela função de criação de usuário (`create-user-admin`). Quem vê a igreja toda grava em qualquer registro. | AUT-03 ("vê e altera"); legado (busca e seletores com o escopo: `MemberRepository.cs:44-51`, `UI/components/MemberPicker/index.js:46`; célula fora do escopo dá "Célula não encontrada.": `CellRepository.cs:48-56`, `App/Services/ReportApp.cs:43-45`); itens (b) e (c): definida pelo spec (P-PER-06); mensagem do item (c): P-PER-20; retirada: definida pelo spec (P-PER-24), coerente com a RN-13 do E2.01 |
| RN-10 | **Membros: cadastrar, editar e excluir.**<br>- Cadastrar: "Criar Membro". Editar: "Editar Membro". Excluir: "Excluir Membro", com as regras do E2.01.<br>- Sempre com a RN-09: quem vê só o ministério cadastra e edita membros com um líder visível.<br>- No cadastro novo feito por quem vê só o ministério, o líder já vem preenchido com quem cadastra, e pode ser trocado por outra pessoa visível (MEM-15, antecipada para esse caso).<br>- Marcar ou desmarcar "É Pastor(a)?" e marcar alguém como sem liderança ("Tem Liderança?" desligado, ou o líder apagado) exige ver a igreja toda.<br>- Manter a marca como está não é marcar. Quem vê só o ministério:<br>  - edita os outros campos de um pastor, ou de quem já está sem liderança, sem mexer na marca;<br>  - pode dar a quem está sem liderança um líder visível.<br>- A edição do próprio cadastro sem "Editar Membro" segue a RN-11. | AUT-02; legado (`API/Controllers/MemberController.cs:34-56`; `UI/pages/Members/details.js:447-457`; líder preenchido com o usuário logado: MEM-15); pastor e sem liderança: definida pelo spec (P-PER-05); líder preenchido só para quem vê o ministério: P-PER-22; manter não é marcar: P-PER-23 |
| RN-11 | **Próprio cadastro.** Com "Editar Próprio Cadastro" e sem "Editar Membro":<br>- a pessoa altera no próprio cadastro só os dados pessoais: nome, e-mail, CPF, sexo, data de nascimento, celular, telefone, Instagram, foto, observações e endereço;<br>- não altera: líder, "Tem Liderança?", cônjuge, pastor, batismo, data do batismo, situação e função;<br>- não altera o cadastro de outra pessoa.<br><br>A troca da própria senha é do E2.03. | AUT-05; legado (`UI/pages/Members/details.js:74`, campos bloqueados para `AppUser` nas linhas 361, 447, 456, 473, 481 e 491-502); já imposta no banco pelo E1.03 (regra 5) |
| RN-12 | **Células: cadastrar, editar e excluir.**<br>- Com "Criar Célula", "Editar Célula" e "Excluir Célula", sempre com a RN-09: a célula visível, e o líder, o timóteo e o anfitrião escolhidos entre pessoas visíveis.<br>- Ser líder ou timóteo da célula não dá direito de editá-la. Sem "Editar Célula", ninguém edita a célula, nem a própria.<br>- "Editar Próprio Cadastro" vale só para o cadastro da própria pessoa. | CEL-04; legado (`API/Controllers/CellController.cs:49-67`: só `AppAdmin` e `AppSuperAdmin`); "Editar Próprio Cadastro": definida pelo spec (P-PER-07) |
| RN-13 | **Relatórios: quem lança (D3).** Lança o relatório de uma célula:<br>(a) o líder, o timóteo ou o anfitrião atual da célula, se a função dele tiver "Enviar Relatório das Próprias Células";<br>(b) quem tem "Editar Célula", para as células que vê;<br>(c) quem tem "Enviar Relatório de Qualquer Célula Visível", para as células que vê.<br><br>Detalhes:<br>- "Editar Próprio Cadastro" não dá mais direito de lançar.<br>- Os participantes novos seguem a RN-09 (b). O líder, o timóteo e o anfitrião entram automaticamente pela REL-07 (E2.11).<br>- As regras de data (semana atual, sem data futura, depois do horário da célula) são do E2.11.<br>- Quem pode lançar o relatório de pelo menos uma célula encontra o caminho: o item Relatórios no menu e o atalho "Novo relatório" no Dashboard (RN-22). As telas só oferecem as células em que a pessoa pode lançar. | D3 (2026-11-23); REL-11; legado (`API/Controllers/ReportController.cs:34-35` e `ReportApp.cs:43-45`: qualquer usuário, para célula do escopo; "Registrar Relatório" no menu de todos: `UI/components/NavMenu/index.js:91`); permissões dos itens (a) a (c): definida pelo spec (P-PER-07); caminho: P-PER-25 e P-PER-26 |
| RN-14 | **Relatórios: editar e excluir.**<br>- Com "Editar Relatórios de Células" e "Excluir Relatórios de Células", só em relatórios visíveis (RN-04), com a RN-09.<br>- Quem lançou não edita nem exclui o relatório sem essas permissões. | REL-11; legado (`ReportController.cs:41-51`: `AppAdmin` e `AppSuperAdmin`) |
| RN-15 | **Exclusão e restauração no escopo.** As regras do E2.01 passam a valer só no que a pessoa vê:<br>- excluir (RN-02 do E2.01);<br>- a lista "Excluídos" e a restauração (RN-15 do E2.01).<br><br>Termina aqui o alcance provisório P-DEL-04 do E2.01. | E2.01 (P-DEL-04, RN-02, RN-15, DA-10); AUT-03 |
| RN-16 | **Funções semeadas.** Os três perfis do legado viram três funções, com as permissões da tabela [Funções semeadas](#funções-semeadas-rn-16).<br>- A Líder perde "Visualizar Membros (legado)" e "Visualizar Funções".<br>- A Líder não recebe "Ver Dados Sensíveis" (D-1 do E1.08), "Alterar Senha de Membros" (E2.03) nem "Atribuir Função aos Membros".<br>- A carga (E4.06 e E4.08) usa a mesma correspondência: `AppSuperAdmin` → Administrador, `AppAdmin` → Líder, `AppUser` e sem perfil → Membro. | AUT-02; 6.5 do plano; legado (`Domain/Model/Constants.cs:32-39`; descrições em `UI/pages/Members/details.js:554-556`; editar e excluir relatório: `ReportController.cs:41-51`); "Enviar Relatório" e sem "Visualizar Funções": definida pelo spec (P-PER-08) |
| RN-17 | **Função Administrador.**<br>- Tem sempre todas as permissões, inclusive as criadas depois (por exemplo, "Gerenciar escolas", ESC-28).<br>- Vê e altera tudo, sem limite de escopo. É o administrador geral do legado.<br>- Não pode ser editada (nome, descrição e permissões) nem excluída, e não pode ser a função padrão.<br>- Os limites que valem para todos valem para ela: ninguém altera a própria função (E1.03) nem exclui o próprio cadastro (RN-03 do E2.01). | AUT-04; 6.5 do plano; legado (`Domain/Extensions/UserExtensions.cs:21-25`, `QueryingExtensions.cs:154`); imutável: definida pelo spec (P-PER-09) |
| RN-18 | **Quem atribui funções.**<br>- Atribuir, trocar ou tirar a função de alguém exige "Atribuir Função aos Membros" ou "Gerenciar Funções", a pessoa visível (RN-09) e cobrir a função atual e a nova.<br>- Ninguém altera a própria função.<br>- O seletor de função só oferece as funções que quem edita pode atribuir.<br>- Nas funções semeadas, só a Administrador atribui funções. Na prática:<br>  - a Administrador atribui qualquer função;<br>  - a Líder e a Membro não atribuem, e os membros que a Líder cadastra recebem a função padrão (RN-19). | AUT-07; legado (só o `AppSuperAdmin` altera o perfil: `Domain/Mappings/DomainToDTOMappingProfile.cs:52-57`; ninguém altera o próprio: `details.js:542`); E1.03 (regra 4); visibilidade: AUT-03 |
| RN-19 | **Função padrão.**<br>- A Membro é a função padrão.<br>- Existe sempre exatamente uma função padrão. Para trocar, marca-se outra função como padrão, e a anterior deixa de ser a padrão na mesma operação. Desmarcar a padrão sem marcar outra é recusado.<br>- Quem cadastra sem poder atribuir funções cria o membro com a função padrão, desde que cubra essa função. Se não cobrir, o cadastro é recusado com mensagem.<br>- A Administrador não pode ser a função padrão.<br>- Trocar a função padrão continua exigindo "Gerenciar Funções". | 6.5 do plano (`AppUser` e sem perfil → Membro); E1.03 (função padrão no cadastro); demais: definida pelo spec (P-PER-10); sempre uma: P-PER-19 |
| RN-20 | **Excluir uma função.** Só com "Gerenciar Funções", como hoje. A exclusão é recusada quando:<br>- é a Administrador;<br>- é a função padrão;<br>- algum membro não excluído usa a função. A mensagem diz quantos.<br><br>Membros excluídos com a função não impedem a exclusão. Na restauração deles, vale a RN-16 (a) do E2.01. | E2.01 (Fora de escopo: "Impedir a exclusão de uma função ainda em uso … E2.02"); definida pelo spec (P-PER-11) |
| RN-21 | **Sempre há um administrador.** Depois que existe um administrador, o sistema nunca fica sem pelo menos um membro não excluído com a função Administrador.<br>- É consequência das RN-17 e RN-18 e da RN-03 do E2.01: ninguém tira a própria função nem exclui o próprio cadastro, e a função Administrador não pode ser excluída nem perder permissões.<br>- Ter pelo menos dois administradores (6.6) é recomendação de operação, conferida no E3.04. O sistema não bloqueia ter só um. | 6.6 do plano; definida pelo spec (P-PER-12) |
| RN-22 | **Tela de Funções, Dashboard e menu.**<br>- Saem da tela de Funções "Visualizar Membros (legado)" e "Visualizar Dashboard do seu ministério". As funções que tinham uma delas passam a ter, no lugar, "Visualizar Toda a Igreja" ou "Visualizar Dashboard", com o mesmo efeito de hoje. A exceção é a Líder (RN-16). Depois disso, as duas permissões antigas não liberam mais nada.<br>- Os rótulos e as descrições mudam conforme a tabela [Rótulos e descrições](#rótulos-e-descrições-rn-22). "Visualizar Auditoria" passa a aparecer na tela, e as permissões menos óbvias ganham dicas.<br>- O Dashboard mostra sempre os números do que a pessoa vê (DSH-01). O subtítulo diz:<br>  - "Visão geral da igreja", com "Visualizar Toda a Igreja";<br>  - "Visão do seu ministério", com o selo "Meu Ministério", com "Visualizar Seu Ministério";<br>  - nada, sem nenhuma das duas.<br>- O Dashboard tem o atalho "Novo relatório" para quem pode lançar o relatório de pelo menos uma célula (RN-13).<br>- O menu segue as permissões:<br>  - Dashboard: "Visualizar Dashboard";<br>  - Membros, Células e Ministérios: "Visualizar Toda a Igreja" ou "Visualizar Seu Ministério";<br>  - Relatórios: essas duas, "Visualizar Relatórios de Toda a Igreja", "Visualizar Relatórios do Seu Ministério", ou qualquer permissão de lançar ("Enviar Relatório das Próprias Células", "Enviar Relatório de Qualquer Célula Visível" ou "Editar Célula");<br>  - Funções: "Visualizar Funções" ou "Gerenciar Funções";<br>  - Auditoria: "Visualizar Auditoria". | DSH-01; definida pelo spec (P-PER-13); dicas e Auditoria: P-PER-17, P-PER-18; atalho: P-PER-25; Relatórios: P-PER-26; subtítulo: P-PER-29 |
| RN-23 | **Ninguém consulta o que é de outra pessoa.**<br>- Pela API, ninguém descobre as permissões de outra pessoa, o que outra pessoa vê, nem o G12 ou a cadeia de liderança de quem não vê.<br>- As consultas de permissão e de escopo respondem só sobre quem está logado.<br>- A função de outra pessoa só aparece, na tela e pela API, para quem pode atribuir funções ("Atribuir Função aos Membros" ou "Gerenciar Funções"). O nome da função equivale às permissões dela.<br>- A própria função a pessoa sempre vê: no menu, embaixo do nome, e em Meus dados. | "Problemas conhecidos" do `CLAUDE.md`; Escolas (risco 3) conta com isso; definida pelo spec (P-PER-14); função de outra pessoa: P-PER-21; a própria no menu: P-PER-28 |

#### Funções semeadas (RN-16)
| Legado | Função | Descrição | Permissões |
|---|---|---|---|
| `AppSuperAdmin` | **Administrador** (do sistema) | Acesso total ao sistema, em toda a igreja. | Todas, sempre (RN-17). |
| `AppAdmin` | **Líder** | Vê e gerencia membros, células e relatórios do seu ministério. | Visualizar Dashboard · Visualizar Seu Ministério · Editar Próprio Cadastro · Criar Membro · Editar Membro · Excluir Membro · Criar Célula · Editar Célula · Excluir Célula · Enviar Relatório das Próprias Células · Editar Relatórios de Células · Excluir Relatórios de Células |
| `AppUser` e sem perfil | **Membro** (padrão) | Vê o seu ministério, edita os próprios dados e envia o relatório das suas células. | Visualizar Dashboard · Visualizar Seu Ministério · Editar Próprio Cadastro · Enviar Relatório das Próprias Células |

As descrições são as do legado, adaptadas (`details.js:554-556`). A Líder cobre a Membro, então pode cadastrar membros com a função padrão (RN-19) e excluir membros com a função Membro (RN-03 do E2.01).

#### Rótulos e descrições (RN-22)
| Permissão | Rótulo de hoje | Rótulo novo |
|---|---|---|
| `view_all_church` | Visualizar Toda Igreja | Visualizar Toda a Igreja |
| `view_own_ministry` | Visualizar Seu Ministério | (sem mudança) |
| `view_all_reports` | Visualizar Relatórios de Toda Igreja | Visualizar Relatórios de Toda a Igreja |
| `view_own_reports` | Visualizar Meus Relatórios | Visualizar Relatórios do Seu Ministério |
| `view_dashboard` | Visualizar todos os dados do Dashboard | Visualizar Dashboard |
| `view_own_ministry_dashboard` | Visualizar Dashboard do seu ministério | sai da tela |
| `view_members` | Visualizar Membros (legado) | sai da tela |
| `submit_own_cell_report` | Enviar Relatório (Células que Lidera) | Enviar Relatório das Próprias Células · dica: "Células em que a pessoa é líder, timóteo ou anfitrião." |
| `submit_any_visible_report` | Enviar Relatório (Qualquer Célula Visível) | Enviar Relatório de Qualquer Célula Visível |
| `view_audit_log` | não aparece na tela | Visualizar Auditoria · dica: "As alterações feitas em toda a igreja, sem limite de ministério." (P-PER-18) |

As demais permissões mantêm o rótulo. As dicas das outras permissões e a nota geral ("Fora a Auditoria, todas as permissões valem só para o que a pessoa vê.") estão em Experiência (UX) > Textos (P-PER-17).

### O que muda para quem usa o sistema
| Quem | Hoje no novo | Depois do E2.02 |
|---|---|---|
| Função Administrador | Vê e altera tudo. A tela libera tudo por um atalho; no banco, as permissões dependem de configuração (em produção, as 24 foram dadas à mão). | O mesmo, com todas as permissões também no banco, inclusive as futuras. A função deixa de poder ser editada ou excluída. |
| Função Líder (como semeada nas migrations; a configuração de produção é conferida pelo `architect`) | Vê a igreja toda. Cadastra e edita membros e células de qualquer ministério. Não exclui, não edita nem exclui relatórios e vê a tela de Funções. | Vê e altera só o escopo do ministério (RN-01), que inclui o cônjuge e a descendência dele. Passa a excluir membros e células e a editar e excluir relatórios, no escopo. Deixa de ver a tela de Funções e a função dos outros membros (RN-23). Continua sem dados sensíveis (D-1). Não marca pastor nem sem liderança. No cadastro novo, o líder já vem preenchido com quem cadastra. |
| Função Membro (idem) | Vê só o próprio cadastro e não edita nem o próprio cadastro (só tem "Visualizar Dashboard"). | Vê o escopo do ministério (listas e Dashboard), edita os próprios dados pessoais e lança o relatório das células em que é líder, timóteo ou anfitrião. |
| Funções com "Visualizar Seu Ministério" | Veem o ministério do casal G12. | Veem também o cônjuge e a descendência dele, e as células e relatórios pelo anfitrião. |
| Pastores | Com "Visualizar Seu Ministério", não veem ninguém além de si. | Veem a árvore inteira (RN-05). |
| Anfitriões | Não lançam relatório. Sem escopo, não veem a própria célula. | Lançam (D3) e sempre veem a própria célula e os relatórios dela. |
| Funções com "Editar Próprio Cadastro" | Líder e timóteo editam a própria célula e lançam o relatório dela por essa permissão. | Só o próprio cadastro. Célula exige "Editar Célula", e lançamento, as permissões da RN-13. |
| Funções criadas na tela | As escritas valem para tudo o que a pessoa vê; cadastros, células e lançamentos não conferem as pessoas escolhidas. | Escrita só no que a pessoa vê, com pessoas visíveis (RN-09). "Visualizar Membros (legado)" vira "Visualizar Toda a Igreja". |
| Quem vem do legado (depois da carga) | — | `AppSuperAdmin`, `AppAdmin` e `AppUser` recebem Administrador, Líder e Membro, com o mesmo escopo do legado. Diferenças: o membro comum só lança relatório das próprias células (D3); dados sensíveis só com a permissão (D-1); o líder não marca "sem liderança"; e o escopo muda na hora, sem sair e entrar. |

### Critérios de aceite
"Pela API" vale para qualquer chamada feita fora da tela. "Erro de permissão" é o código 42501, sem nenhuma gravação. "Nada muda" inclui o caso em que a API responde "0 linhas alteradas", porque o registro não está visível. As mensagens das recusas estão em [Textos de tela](#textos-de-tela). Nenhuma regra deste spec depende de data: a virada de semana e as regras de lançamento são do E2.11. Nos critérios de lançamento, a célula ainda não tem relatório na semana atual, e a data e o horário respeitam as regras do E2.11. Cada critério parte da massa original.

#### Massa de exemplo
- **Árvore** (líder → discípulos):
  - Samuel e Magda, casados, pastores (D9).
  - Pedro, discípulo de Samuel, e Paula, discípula de Magda, casados: o casal G12 "Pedro e Paula".
  - Tiago, discípulo de Samuel, e Tânia, discípula de Magda, casados: o casal G12 "Tiago e Tânia".
  - André, discípulo de Pedro, casado com Beatriz, discípula de Tânia.
  - Caio e Fábio (inativo), discípulos de André. Gabriel, discípulo de Fábio.
  - Carla, discípula de Paula.
  - Débora, discípula de Beatriz.
  - Diego e Hugo, discípulos de Tiago. Rita, discípula de Tânia.
  - Ester, sem liderança e não pastora. Lúcia, discípula de Ester.
- **Células** (líder / timóteo / anfitrião):
  - C1, célula de André (quarta, 20:00): André / Caio / Carla.
  - C2, célula de Diego (quinta, 20:00): Diego / Hugo / Caio.
  - C3, célula de Débora (terça, 19:30): Débora, com timóteo e anfitriã discípulas de Débora.
- **Relatórios** da semana passada: R1 (C1), R2 (C2) e R3 (C3).
- **Funções:**
  - Rita: Administrador.
  - Samuel, Magda, Pedro, Paula, André e Diego: Líder.
  - Caio, Carla, Fábio, Beatriz e Ester: Membro.
  - Hugo: sem função.
  - Conta X: conta de acesso sem cadastro de membro.

**O que cada um vê** com as funções acima (base dos critérios):

| Quem | Membros | Células e relatórios |
|---|---|---|
| Rita | todos | C1, C2, C3; R1, R2, R3 |
| Samuel (e Magda) | todos, exceto Ester e Lúcia | C1, C2, C3; R1, R2, R3 |
| Pedro, Paula, Caio, Carla e Fábio | Pedro, Paula, André, Caio, Fábio, Gabriel e Carla | C1, C2 (pelo anfitrião Caio); R1, R2 |
| André | os de Pedro, mais Beatriz e Débora | C1, C2, C3 (Débora, pela cônjuge); R1, R2, R3 |
| Beatriz | Beatriz, André, Tânia, Tiago, Débora, Caio, Fábio, Gabriel, Rita, Diego e Hugo | C1, C2, C3; R1, R2, R3 |
| Diego | Diego, Tiago, Tânia, Hugo, Beatriz, Débora e Rita | C2, C3; R2, R3 |
| Ester | Ester e Lúcia | nenhuma |
| Hugo | só Hugo | C2 (é timóteo); R2 |
| Conta X | ninguém | nenhuma |

#### Critérios por regra
- **RN-01**
  - Dado Pedro (G12)
  - Quando ele abre Membros
  - Então vê exatamente Pedro, Paula, André, Caio, Fábio, Gabriel e Carla, e não vê Samuel, Magda, Tiago, Tânia, Beatriz, Débora, Diego, Hugo, Rita, Ester nem Lúcia.
  - Dado o casal Pedro e Paula, os dois com a função Líder
  - Então os dois veem exatamente os mesmos membros, células e relatórios.
  - Dado André, casado com Beatriz, que é do ministério de Tiago e Tânia (casal em ministérios diferentes)
  - Então André vê, além do ministério de Pedro e Paula, Beatriz e Débora, e não vê Tânia, Tiago, Diego, Hugo nem Rita.
  - E Beatriz vê André, Caio, Fábio e Gabriel (a descendência do cônjuge), mas não vê Pedro, Paula nem Carla.
  - Dado Caio, discípulo de André no ministério de Pedro
  - Então Caio vê Paula (cônjuge do G12) e Carla (discípula de Paula).
  - Dado Fábio, inativo, e Gabriel, discípulo de Fábio
  - Então Pedro continua vendo Fábio e Gabriel.
- **RN-02**
  - Dada Rita
  - Então ela vê todos os membros, inclusive Ester e Lúcia, as três células e os três relatórios.
  - Dado Pedro
  - Quando ele abre o Dashboard
  - Então os cards de membros contam 7 membros (6 ativos e 1 inativo, Fábio), e as células contam C1 e C2.
  - Quando ele abre os seletores de líder, cônjuge, timóteo, anfitrião, participantes e célula do relatório
  - Então só aparecem pessoas e células da tabela dele.
  - Quando ele pede pela API o cadastro de Beatriz pelo id, a célula C3 ou o relatório R3
  - Então não recebe nada.
  - Quando ele abre o próprio cadastro
  - Então vê "Samuel" como líder, só o nome, sem acesso ao cadastro de Samuel.
  - Dado Caio sem função (a função dele foi retirada)
  - Então ele vê só o próprio cadastro, C1 (é timóteo), C2 (é anfitrião), R1 e R2, e não vê Pedro, André nem Carla em Membros.
  - Dado Gabriel excluído (E2.01)
  - Então Pedro deixa de vê-lo, e nada mais muda no escopo de Pedro.
- **RN-03**
  - Dado Pedro
  - Então ele vê C2, porque o anfitrião Caio está no escopo dele, mas não vê C3.
  - Dado André
  - Então ele vê C3, porque a líder Débora é discípula da cônjuge dele.
  - Dado Diego
  - Então ele vê C2 e C3, mas não vê C1.
- **RN-04**
  - Dado Pedro
  - Quando ele abre Relatórios
  - Então vê R1 e R2 (pelo anfitrião Caio, o que hoje não acontece), e não vê R3.
  - Dado Gabriel com uma função que tem só "Visualizar Relatórios do Seu Ministério"
  - Então ele vê R1 e R2 em Relatórios, e Membros e Células não aparecem no menu dele.
  - Dada uma função com só "Visualizar Relatórios de Toda a Igreja"
  - Então quem a tem vê R1, R2 e R3.
  - Dado R2, lançado quando Caio era o anfitrião de C2, e depois C2 passa a ter Rita como anfitriã
  - Então, até o E2.11, R2 sai do escopo de Pedro junto com C2.
  - E, a partir do E2.11, os relatórios lançados enquanto Caio era o anfitrião continuam visíveis para Pedro, e os lançados depois da troca não.
- **RN-05**
  - Dado Samuel, pastor, com a função Líder
  - Então ele vê todos os membros, exceto Ester e Lúcia, e as três células. O mesmo vale para Magda.
  - Dado Samuel com uma função que tem "Visualizar Toda a Igreja"
  - Então ele também vê Ester e Lúcia.
  - Dado Pedro
  - Então Samuel e Magda não aparecem em Membros nem nos seletores.
  - Dados Pedro e Samuel, ambos com a função Líder
  - Quando cada um tenta marcar André como pastor, pela tela ou pela API
  - Então a tela não oferece a marca, a API recusa com "Só quem vê a igreja toda pode marcar um membro como pastor ou como sem liderança.", e nada muda.
  - Quando Rita faz o mesmo
  - Então a marcação é aceita.
- **RN-06**
  - Dada Ester, sem liderança, com a função Membro
  - Então ela vê Ester e Lúcia.
  - E só Rita e a própria Ester a veem. Samuel e Pedro não a veem.
  - E o card "Sem liderança" conta Ester para Rita e não conta para Samuel.
- **RN-07**
  - Dada a conta X, sem cadastro de membro
  - Quando ela entra no sistema
  - Então Membros, Células e Relatórios aparecem vazios, o Dashboard mostra "Você não tem acesso ao dashboard.", e qualquer gravação pela API recebe erro de permissão.
  - Dado Hugo, sem função
  - Então ele vê só o próprio cadastro, C2 e R2. Não consegue editar o próprio cadastro nem lançar o relatório de C2, nem pela API.
  - Dado Fábio, inativo, com a função Membro
  - Quando ele entra no sistema
  - Então entra normalmente, vê o mesmo que Pedro e edita os próprios dados pessoais.
- **RN-08**
  - Dado que Rita troca o líder de Caio para Diego
  - Quando Pedro e André consultam as listas logo depois
  - Então, para os dois, Caio sai de Membros e C2 sai de Células, porque nenhuma pessoa de C2 continua no escopo deles. C1 continua, por André e Carla.
  - E Caio, sem sair e entrar, passa a ver o ministério de Tiago e Tânia e deixa de ver o de Pedro e Paula.
  - Dado que Rita dá a função Líder a Caio
  - Então a ação seguinte de Caio já pode cadastrar membros, sem sair e entrar.
  - Dado que Rita retira "Visualizar Seu Ministério" da função Membro
  - Então a consulta seguinte de Carla já mostra só o que a RN-02 (d) libera.
- **RN-09**
  - Dado Pedro, com "Editar Membro"
  - Quando ele tenta editar Beatriz pela API
  - Então nada muda.
  - Quando ele tenta, pela API, pôr Diego como líder de Caio ou Beatriz como cônjuge de Caio
  - Então recebe "Você só pode escolher pessoas que você vê.", e nada muda. Os seletores dele não oferecem Diego nem Beatriz.
  - Quando ele muda só o tema de R2, que tem participantes fora do escopo dele, como Diego e Hugo
  - Então a alteração é aceita, e esses participantes continuam no relatório.
  - Quando ele cadastra o membro novo Igor, com Diego como líder, chamando direto a função de criação de usuário
  - Então o cadastro é recusado, e nenhuma conta de acesso fica criada.
  - Quando ele apaga o anfitrião de C2 (Caio), sem pôr outro no lugar
  - Então recebe "Com esta alteração, você deixaria de ver esta célula. Mantenha pelo menos uma pessoa do seu ministério como líder, timóteo ou anfitrião. As alterações não foram salvas.", e Caio continua como anfitrião (item c).
  - Dado André, que vê Beatriz só por ser cônjuge dela
  - Quando ele tira o cônjuge do cadastro de Beatriz
  - Então recebe "Com esta alteração, você deixaria de ver este cadastro. As alterações não foram salvas.", e os dois continuam casados (item c).
  - Dado Pedro, editando R2, em que Hugo (que ele não vê) é participante
  - Quando ele abre a edição
  - Então a tela avisa "Alguns participantes não são do seu ministério: se você retirá-los, não poderá incluí-los de novo.".
  - Quando ele retira Hugo e salva
  - Então a retirada é aceita (retirar não é escolher).
  - Quando ele tenta incluir Hugo de novo, pela API
  - Então recebe "Você só pode escolher pessoas que você vê.", e Hugo continua fora.
  - E Diego, que vê Hugo, consegue incluí-lo de novo em R2.
  - Dado Gabriel excluído (E2.01) e participante de R1. Para Pedro, Gabriel é ao mesmo tempo invisível e excluído
  - Quando Pedro ou Rita tenta retirá-lo de R1, pela tela ou pela API
  - Então a tela não oferece a retirada, a API recusa com "Não é possível retirar um participante cujo cadastro foi excluído." (RN-13 do E2.01), e Gabriel continua em R1.
  - Dada Rita
  - Então ela grava em qualquer registro e escolhe qualquer pessoa.
- **RN-10**
  - Dado Pedro
  - Quando ele abre "Novo membro"
  - Então o campo Líder já vem com Pedro, e ele pode trocar por outra pessoa que vê.
  - Quando ele cadastra Igor com André como líder
  - Então o cadastro é aceito, e Igor aparece em Membros para Pedro.
  - Dado Samuel (pastor, função Líder, que vê só o ministério), editando Magda, que é pastora
  - Quando ele muda a data de nascimento de Magda e salva
  - Então a alteração é aceita, e Magda continua pastora.
  - Quando ele tenta, pela API, desmarcar Magda como pastora
  - Então recebe "Só quem vê a igreja toda pode marcar um membro como pastor ou como sem liderança.", e nada muda.
  - Dado que Rita registra o casamento de Ester (sem liderança) com Diego, e Diego passa a vê-la pela RN-06
  - Quando Diego muda as observações de Ester e salva
  - Então a alteração é aceita, e Ester continua sem liderança.
  - Quando Diego escolhe Rita como líder de Ester
  - Então a alteração é aceita, e Ester deixa de estar sem liderança.
  - Quando ele tenta cadastrar Igor sem líder, ou tirar o líder de Hugo (DA-1: Caio está fora do escopo de Diego)
  - Então recebe "Só quem vê a igreja toda pode marcar um membro como pastor ou como sem liderança.", e nada é gravado.
  - Quando Rita cadastra Igor como sem liderança
  - Então o cadastro é aceito.
  - Dado Caio, com a função Membro
  - Então ele não vê "Novo membro", e o cadastro pela API recebe erro de permissão.
  - Dado Pedro, com "Excluir Membro"
  - Quando ele tenta excluir Débora pela API
  - Então recebe "Este cadastro não existe ou já foi excluído.", e Débora continua.
- **RN-11**
  - Dado Caio, com a função Membro
  - Quando ele muda o próprio celular, o endereço e o Instagram
  - Então as alterações são aceitas.
  - Quando ele tenta mudar, pela API, o próprio líder, cônjuge, batismo ou situação
  - Então recebe "Você só pode alterar os seus dados pessoais. Não é permitido alterar: …", com os campos, e nada muda.
  - Quando ele tenta editar Carla pela API
  - Então nada muda.
- **RN-12**
  - Dado Caio, timóteo de C1, com uma função que tem "Editar Próprio Cadastro" e não tem "Editar Célula"
  - Quando ele tenta mudar o horário de C1
  - Então não vê "Editar", e pela API nada muda. Hoje a alteração é aceita.
  - Dado André
  - Quando ele edita C1 e C3
  - Então as duas alterações são aceitas.
  - Dado Pedro
  - Quando ele tenta editar C3 pela API
  - Então nada muda.
  - Quando ele cadastra uma célula com líder André, timóteo Caio e anfitriã Beatriz
  - Então recebe "Você só pode escolher pessoas que você vê.". Com Carla como anfitriã, o cadastro é aceito.
  - Quando ele tenta trocar o anfitrião de C2 de Caio para Rita
  - Então recebe a mesma mensagem, e Caio continua como anfitrião.
  - Dado Diego, com "Excluir Célula"
  - Quando ele tenta excluir C1 pela API
  - Então recebe "Esta célula não existe ou já foi excluída.".
- **RN-13**
  - Dada Carla, anfitriã de C1, com a função Membro
  - Quando ela lança o relatório de C1
  - Então o lançamento é aceito. Hoje é recusado.
  - Dado Caio, com a função Membro
  - Quando ele lança o relatório de C1 (como timóteo) e o de C2 (como anfitrião)
  - Então os dois lançamentos são aceitos.
  - Dado Fábio, com a função Membro, que vê C1 mas não é líder, timóteo nem anfitrião dela
  - Então não vê "Novo relatório" para C1, e o lançamento pela API recebe "Você não pode enviar o relatório desta célula.". No legado, ele podia.
  - Dado Pedro, com "Editar Célula"
  - Quando ele lança o relatório de C2
  - Então o lançamento é aceito, porque C2 está visível para ele.
  - Quando ele tenta lançar o de C3 pela API
  - Então recebe "Esta célula não existe ou já foi excluída.".
  - Dado Hugo, timóteo de C2 e sem função
  - Então o lançamento de C2 é recusado.
  - Dado Gabriel com uma função que tem "Visualizar Seu Ministério" e "Enviar Relatório de Qualquer Célula Visível", e não tem "Editar Célula"
  - Então ele lança para C1 e C2, mas não para C3.
  - Dado Caio com uma função que tem "Editar Próprio Cadastro" e não tem nenhuma permissão de enviar relatório
  - Então ele não lança o relatório de C1.
  - Dados Pedro e André, ambos com "Editar Célula"
  - Quando cada um lança o relatório de C1 com Débora como participante, pela API
  - Então o de Pedro é recusado com "Você só pode escolher pessoas que você vê.", e o de André é aceito.
- **RN-14**
  - Dado Pedro, com "Editar Relatórios de Células"
  - Quando ele edita R2
  - Então a alteração é aceita.
  - Quando ele tenta editar R3 pela API
  - Então nada muda.
  - Dado Caio, que lançou R1, com a função Membro
  - Então não vê "Editar" nem "Excluir" em R1, e pela API nada muda.
  - Dado Diego, com "Excluir Relatórios de Células"
  - Quando ele tenta excluir R1 pela API
  - Então recebe "Este relatório não existe ou já foi excluído.".
- **RN-15**
  - Dada uma função com "Gerenciar Funções" e "Visualizar Seu Ministério", sem "Visualizar Toda a Igreja", na posição de Pedro
  - Quando quem a tem abre "Excluídos" em Membros
  - Então vê só os excluídos do escopo de Pedro, e a restauração de Débora excluída, pela API, recebe "Este cadastro não foi encontrado." (DA-4 do E2.01).
  - Dado André, com "Excluir Célula"
  - Quando ele exclui C3
  - Então a exclusão é aceita, porque C3 está visível para ele.
- **RN-16**
  - Dado um banco com as três funções semeadas
  - Quando a migration deste passo roda
  - Então a Administrador, a Líder e a Membro têm exatamente as permissões da tabela [Funções semeadas](#funções-semeadas-rn-16), e a Membro é a padrão.
  - Dado André, com a função Líder
  - Então ele não vê Funções no menu, não vê o CPF nem o celular de Caio (D-1), não vê o seletor de função e não vê "Alterar senha".
  - Dados um `AppAdmin` e um membro sem perfil no legado
  - Quando a carga roda
  - Então o primeiro entra como Líder, e o segundo, como Membro.
- **RN-17**
  - Dada a função Administrador
  - Quando uma permissão nova é criada (por exemplo, "Gerenciar escolas")
  - Então a Administrador passa a tê-la no banco, sem configuração.
  - Dada Rita
  - Quando ela tenta mudar o nome, a descrição ou as permissões da Administrador, excluí-la ou marcá-la como padrão, pela tela ou pela API
  - Então recebe, conforme o caso, "A função Administrador não pode ser alterada.", "A função Administrador não pode ser excluída." ou "A função Administrador não pode ser a função padrão.", e nada muda.
  - Quando ela edita Ester, Débora e a célula C3
  - Então as três gravações são aceitas.
- **RN-18**
  - Dada Rita
  - Quando ela dá a função Líder a Caio
  - Então a alteração é aceita.
  - Quando ela tenta mudar a própria função
  - Então recebe "Ninguém pode alterar a própria função.".
  - Dado Pedro, com a função Líder
  - Então ele não vê o seletor de função, e a troca da função de Caio pela API recebe "Você não tem permissão para alterar a função deste membro.".
  - Dada uma função com "Atribuir Função aos Membros" e "Visualizar Seu Ministério", sem todas as permissões da Administrador, na posição de Pedro
  - Então o seletor de quem a tem não oferece a Administrador, a atribuição dela pela API recebe "Você não tem permissão para atribuir esta função.", e a troca da função de Beatriz (fora do escopo de Pedro) não muda nada.
- **RN-19**
  - Dado Pedro
  - Quando ele cadastra Igor sem escolher função
  - Então Igor fica com a função Membro.
  - Dado que Rita marcou como padrão a função "Secretaria", que tem "Visualizar Toda a Igreja"
  - Quando Pedro cadastra Igor
  - Então recebe "A função padrão tem permissões que você não tem. Peça a um administrador para fazer este cadastro.", e nada é gravado.
  - Dada a Membro como padrão
  - Quando Rita tenta desmarcá-la como padrão sem marcar outra, pela tela ou pela API
  - Então a tela não oferece a ação, a API recusa com "Esta é a função padrão. Para trocar, marque outra função como padrão.", e a Membro continua a padrão.
  - Quando Rita marca a função "Apoio" como padrão e salva
  - Então a Apoio passa a ser a padrão, a Membro deixa de ser, na mesma operação, e existe exatamente uma função padrão.
- **RN-20**
  - Dada Rita
  - Quando ela tenta excluir a função Líder, usada por Samuel, Magda, Pedro, Paula, André e Diego
  - Então recebe "Esta função é usada por 6 membros. Troque a função deles antes de excluí-la.".
  - Quando ela tenta excluir a Membro, que é a padrão
  - Então recebe "Esta é a função padrão. Escolha outra função padrão antes de excluí-la.".
  - Quando ela exclui a função "Apoio", que nenhum membro usa
  - Então a exclusão é aceita.
  - Dada uma função cujo único membro foi excluído
  - Então a exclusão da função é aceita.
- **RN-21**
  - Dada Rita, a única administradora
  - Quando ela tenta tirar a própria função, excluir o próprio cadastro ou excluir a função Administrador
  - Então as três tentativas são recusadas, e Rita continua administradora.
  - Dados Rita e Sílvio, administradores
  - Quando Rita dá a Sílvio a função Líder
  - Então a troca é aceita, e Rita continua administradora.
- **RN-22**
  - Dada a tela de Funções
  - Então ela não oferece "Visualizar Membros (legado)" nem "Visualizar Dashboard do seu ministério", e mostra os rótulos novos.
  - Dada a função "Recepção", com "Visualizar Membros (legado)"
  - Quando a migration deste passo roda
  - Então a Recepção passa a ter "Visualizar Toda a Igreja", e quem a tem continua vendo a igreja toda.
  - Dada uma função com "Visualizar Dashboard do seu ministério"
  - Então ela passa a ter "Visualizar Dashboard", e os números continuam os do escopo de quem a tem.
  - Dada uma função que recebe "Visualizar Membros (legado)" pela API, depois deste passo
  - Então essa permissão não libera nada.
  - Dados Pedro e Rita
  - Quando cada um abre o Dashboard
  - Então o de Pedro diz "Visão do seu ministério", com o selo "Meu Ministério", e o de Rita, "Visão geral da igreja", sem selo.
  - Dada uma função com "Visualizar Dashboard" e sem "Visualizar Toda a Igreja" nem "Visualizar Seu Ministério"
  - Então o Dashboard de quem a tem não mostra subtítulo nem selo.
  - Dados Carla, Caio e Pedro, que podem lançar o relatório de alguma célula, e Fábio, que não pode
  - Quando cada um abre o Dashboard
  - Então Carla, Caio e Pedro veem o atalho "Novo relatório", e Fábio não vê.
  - Dada uma função com "Visualizar Toda a Igreja" e sem "Visualizar Seu Ministério"
  - Então quem a tem vê Ministérios no menu.
  - Dado Hugo com uma função que tem só "Enviar Relatório das Próprias Células"
  - Então o menu dele mostra só Relatórios. Lá, ele vê R2 e lança o relatório de C2, e não vê Membros, Células nem Dashboard.
  - Dada a tela de Funções
  - Então ela oferece "Visualizar Auditoria", com a dica "As alterações feitas em toda a igreja, sem limite de ministério.", e a nota "Fora a Auditoria, todas as permissões valem só para o que a pessoa vê.".
- **RN-23**
  - Dado Caio
  - Quando ele pergunta à API, pelas funções de permissão e de escopo, se Rita tem "Gerenciar Funções", qual é o G12 de Débora ou se Diego vê Carla
  - Então recebe erro de permissão ou resposta vazia, e nada é revelado.
  - Quando ele faz as mesmas perguntas sobre si mesmo
  - Então recebe a resposta, porque as telas dependem dela.
  - Dado Pedro, que não atribui funções
  - Quando ele abre o cadastro de Caio, ou lê Caio pela API
  - Então não vê a função de Caio: o campo Função não aparece, e a API não a devolve.
  - Dada Rita
  - Quando ela abre o cadastro de Caio
  - Então vê a função dele ("Membro") e pode trocá-la.
  - Dado Caio
  - Então ele vê a própria função ("Membro") no menu, embaixo do nome, e em Meus dados.

### Textos de tela
Vocabulário de referência. O `ux-designer` pode ajustar o tom, mas não o sentido nem os termos. Os textos que a UX definiu e o PO aceitou (PO-UX-4, PO-UX-8 e PO-UX-11) estão aqui quando ligados a uma regra. Os demais estão em Experiência (UX) > Textos, marcados com †.

- **Termos:** Função (não "perfil" nem "papel"), Função padrão, Administrador, Líder, Membro, Seu Ministério, Toda a Igreja, Timóteo, Anfitrião, Sem liderança, Pastor(a).
- **Evitar:** "Super administrador", "usuário" (no lugar de membro), "assistente" (no lugar de timóteo), "escopo" e "RLS" em textos de tela. Para o usuário, o escopo é "o seu ministério".

| Situação | Texto |
|---|---|
| pessoa escolhida fora do que se vê (API) | Você só pode escolher pessoas que você vê. |
| pastor ou sem liderança sem ver a igreja toda | Só quem vê a igreja toda pode marcar um membro como pastor ou como sem liderança. |
| lançar relatório sem direito | Você não pode enviar o relatório desta célula. |
| registro fora do que se vê (excluir, restaurar, lançar) | os textos do E2.01: "Este cadastro não existe ou já foi excluído.", "Esta célula não existe ou já foi excluída.", "Este relatório não existe ou já foi excluído." (e "não foi encontrado", DA-4, na restauração) |
| função padrão acima de quem cadastra | A função padrão tem permissões que você não tem. Peça a um administrador para fazer este cadastro. |
| alterar a Administrador | A função Administrador não pode ser alterada. |
| excluir a Administrador | A função Administrador não pode ser excluída. |
| Administrador como padrão | A função Administrador não pode ser a função padrão. |
| excluir função em uso | Esta função é usada por <N> membros (ou "por 1 membro"). Troque a função deles antes de excluí-la. |
| excluir a função padrão | Esta é a função padrão. Escolha outra função padrão antes de excluí-la. |
| Administrador na tela de Funções | Todas as permissões, inclusive as novas. Esta função não pode ser alterada nem excluída. |
| próprio cadastro (E1.03, sem mudança) | Você só pode alterar os seus dados pessoais. Não é permitido alterar: <campos>. |
| própria função (E1.03, sem mudança) | Ninguém pode alterar a própria função. |
| função acima (E1.03, sem mudança) | Você não tem permissão para alterar a função deste membro. · Você não tem permissão para atribuir esta função. |
| registro que sairia do que se vê (RN-09 c) | Com esta alteração, você deixaria de ver este cadastro. As alterações não foram salvas. · Com esta alteração, você deixaria de ver esta célula. Mantenha pelo menos uma pessoa do seu ministério como líder, timóteo ou anfitrião. As alterações não foram salvas. |
| participantes que a pessoa não vê, na edição do relatório (RN-09) | Alguns participantes não são do seu ministério: se você retirá-los, não poderá incluí-los de novo. |
| retirar participante excluído (E2.01, sem mudança) | Não é possível retirar um participante cujo cadastro foi excluído. |
| sempre uma função padrão (RN-19) | Esta é a função padrão. Para trocar, marque outra função como padrão. · Ao marcar outra: A função <nome> deixa de ser a padrão. Quem cadastra membros sem poder escolher a função precisa ter todas as permissões da função padrão. |
| função sem permissões (tela de Funções) | Sem permissões: quem tiver esta função vê só o próprio cadastro, as células em que é líder, timóteo ou anfitrião e os relatórios delas, e não altera nada. |
| Dashboard, subtítulo (RN-22) | Visão geral da igreja (com "Visualizar Toda a Igreja") · Visão do seu ministério, com o selo "Meu Ministério" (com "Visualizar Seu Ministério") · sem subtítulo nem selo (sem nenhuma das duas) |
| Dashboard sem acesso (RN-07) | Você não tem acesso ao dashboard. · Sem função: Sua conta ainda não tem uma função. Fale com um administrador. · Sem cadastro: Seu acesso ainda não está ligado a um cadastro de membro. Fale com um administrador. |
| subtítulo das listas (alcance) | Membros do seu ministério · Membros de toda a igreja · Células do seu ministério · Células de toda a igreja · Relatórios das células do seu ministério · Relatórios das células de toda a igreja · Relatórios, para quem não tem permissão de ver relatórios: sem subtítulo |
| acesso que mudou (RN-08) | Seu acesso foi atualizado. · Tela sem permissão: Você não tem acesso a esta tela. |
| menu, embaixo do nome (RN-23) | <nome da própria função> · Sem função · Editar meus dados (com "Editar Próprio Cadastro" ou "Editar Membro") · Ver meus dados (sem as duas) |
| cadastro de membro, quem vê só o ministério | O líder é obrigatório e é escolhido entre as pessoas do seu ministério. · Erro: Escolha o líder. |
| rótulos das permissões e descrições das funções | tabelas [Rótulos e descrições](#rótulos-e-descrições-rn-22) e [Funções semeadas](#funções-semeadas-rn-16) |

### Fora de escopo
Cada item indica o passo que cuida dele.
- **Troca e redefinição de senha (E2.03).** Fronteira:
  - este spec define o escopo (RN-01 a RN-04, RN-09) e a regra de cobrir a função (RN-18), que o E2.03 aplica ao alvo na `change-member-password`;
  - o E2.03 decide quando a Líder recebe "Alterar Senha de Membros" (6.5, redefinição assistida) e como o próprio membro troca a senha (AUT-06);
  - até lá, só a Administrador tem a permissão, e a função continua fora da produção.
- **Validações de membro** (MEM-01 a MEM-09), inclusive quem salva sem líder (MEM-07): E2.04. Este spec só define quem marca pastor e sem liderança (RN-10).
- **Autoria nas colunas** (MEM-12): E2.05.
- **Ciclos e recálculo do nível e do caminho de liderança** (HIE-01 a HIE-03): E2.06. O escopo não depende do nível guardado (RN-01).
- **Lançamento de relatório numa RPC**, com as regras de data, os participantes automáticos e o registro de líder, timóteo e anfitrião (REL-01 a REL-10): E2.11. Este spec define quem lança e em que escopo (RN-13), e a RN-04 passa a usar o registro do relatório quando o E2.11 o criar.
- **Árvore de Ministérios a partir do escopo** (MIN-02): E2.15. Ver P-PER-15.
- **Filtros** (E2.07, E2.10, E2.12), **situação do relatório** (E2.09), **exportação** (E2.13) e **cards novos do Dashboard** (E2.14): seguem o escopo deste spec, sem regra nova.
- **Líder já preenchido para todos** (MEM-15): E2.07. Este spec só antecipa a MEM-15 para quem vê só o ministério (RN-10, P-PER-22).
- **Dados sensíveis:** a regra é a do E1.08 (D-1), e a trava de colunas é o PR 5 do E1.08. Este spec não dá "Ver Dados Sensíveis" à Líder (P-PER-08).
- **Auditoria:** continua valendo para a igreja toda, para quem tem "Visualizar Auditoria". Nas funções semeadas, só a Administrador tem essa permissão; outras funções podem recebê-la na tela de Funções, com a dica que avisa o alcance (P-PER-18). Auditoria por escopo: sem passo no plano.
- **Login** pela função `sign-in`: E1.04. **Contas de acesso da carga:** E4.08.
- **Quem será Administrador e Líder**, inclusive a função dos pastores e os dois administradores da 6.6: E3.04.
- **Escopos diferentes por função** (por exemplo, ver só a própria descendência, ou o ministério inteiro do cônjuge): não existem no legado. Sem passo no plano.
- **Consolidação:** a flag do consolidado entra no mesmo escopo, e o spec da Consolidação define se o consolidado fica no escopo de quem o consolida. **Escolas:** herda o escopo de Membros (DT-02 de Escolas), e "Gerenciar escolas" vale para a igreja toda.

### Impactos em outros passos
Pontos de negócio que outros passos precisam respeitar. O `architect` decide como.
- **E1.08:**
  - a função do escopo (`viewer_ministry_member_ids`), os `WHERE` das quatro views, a `member_names` e as políticas de RLS mudam juntos;
  - os testes de paridade (RN-05 do E1.08) passam a comparar com o escopo novo;
  - não delegar o SELECT de `cell_reports` à view (leitura técnica 6 do E2.01).
- **E2.01:**
  - se o E2.01 entrar antes, o E2.02 ajusta os mesmos pontos únicos (DA-10);
  - se entrar depois, já nasce com o escopo novo;
  - a regra de cobrir a função (RN-03 e RN-16 b do E2.01, DT-12) é a mesma das RN-18 e RN-19.
- **E2.03:** aplica a RN-09 e a RN-18 ao alvo da troca de senha (ver Fora de escopo).
- **E2.04:** na MEM-07, "o administrador geral pode salvar sem líder" passa a ser "quem vê a igreja toda" (RN-10).
- **E2.06:** se o caminho de liderança for materializado, o escopo pode usá-lo, desde que ele seja atualizado na mesma operação que muda o líder (RN-08).
- **E2.07:** estende a todos o líder já preenchido com quem cadastra (MEM-15), que este spec antecipa para quem vê só o ministério.
- **E2.11:** a RPC de lançamento aplica a RN-13 e grava o líder, o timóteo e o anfitrião que a RN-04 usa. Na edição, os participantes são gravados pela diferença (AQ-7 da UX): só os que entram passam pela RN-09 (b); os que saem passam pela fronteira da RN-09 ("retirar não é escolher", e o excluído não sai).
- **E2.13:** a exportação respeita o escopo, como no legado.
- **E2.15:** o E2.02 vai para produção junto com o E2.15, ou depois dele (P-PER-15). Até lá, a árvore de Ministérios de quem vê só o ministério fica vazia. No legado, o link de Ministérios estava fora do menu, então isso não perde paridade, mas é uma regressão para quem usa a função Líder hoje.
- **E3.04, E4.06 e E4.08:** usam a correspondência da RN-16. A lista do E3.04 também define a função dos pastores. Com o escopo novo, os pastores veem a árvore inteira com a função Líder, e "Visualizar Toda a Igreja" só acrescenta quem está sem liderança.
- **Aceite (PO):**
  - no `docs/migracao.md`:
    - na 6.5, atualizar a tabela da Líder (mais "Enviar Relatório das Próprias Células", "Editar Relatórios de Células" e "Excluir Relatórios de Células"; sem "Visualizar Funções") e trocar "Pastores precisam de `view_all_church`" pela RN-05;
    - na 3.1, marcar AUT-02, AUT-03, AUT-04, AUT-05 e AUT-07 como ✅;
    - na 3.4, marcar CEL-04 como ✅;
    - na 3.5, REL-11 fica 🟡 ("quem lança" no banco; falta a RPC do E2.11);
    - na 3.6, marcar DSH-01 como ✅;
  - no `CLAUDE.md`: a linha "Papéis e escopo por ministério" da matriz, as "Armadilhas" sobre pastores e sobre a Líder com `view_members`, "Lógica no banco" (o que cada permissão libera) e o item das funções do RLS em "Problemas conhecidos".

### Perguntas em aberto
Nenhuma. Os pontos que as fontes não respondiam viraram padrões, listados em [Padrões definidos por este spec](#padrões-definidos-por-este-spec-revisar-no-pr), para o usuário revisar no PR. Os que mais mudam o resultado são:
- **P-PER-08:** a Líder não recebe "Ver Dados Sensíveis". Ela vê e edita os discípulos, mas não vê nem corrige o celular, o e-mail e o endereço deles, até a função ganhar a permissão na tela de Funções (D-1).
- **P-PER-05:** a Líder não marca ninguém como pastor ou sem liderança.
- **P-PER-07:** líder, timóteo e anfitrião lançam relatório se a função deles tiver "Enviar Relatório das Próprias Células". As duas funções semeadas têm.
- **P-PER-15:** o E2.02 só vai para produção junto com o E2.15, ou depois dele.
- **P-PER-21:** só quem atribui funções vê a função de outra pessoa. Os líderes deixam de ver a função dos discípulos.
- **P-PER-24:** quem edita um relatório pode retirar um participante que não vê, e só quem vê essa pessoa consegue incluí-la de novo. O participante excluído continua sem poder ser retirado (E2.01).

## Experiência (UX)
_Seção do `ux-designer`. Escrita em 2026-11-23 a partir da seção Negócio (RN-01 a RN-23, P-PER-01 a P-PER-16 e a massa de exemplo) e das telas da `main` do `mci-connect` (`14ee75f`, com o E1.08 em produção: listas paginadas, `PaginatedSelect`, Dashboard e árvore por RPC). Segue os padrões de [Escolas](escolas.md) (P1 a P6) e do [E2.01](e2-01-exclusao-logica.md) (P7 a P9), e a numeração continua em P10. Nenhuma regra de negócio foi criada aqui. Onde a tela precisou de algo que o spec não diz, a decisão é a mais conservadora, marcada como "definido pela UX" e listada em "Pendências para o PO". Os nomes das pessoas são os da [massa de exemplo](#massa-de-exemplo)._

### O que muda, tela a tela
| Tela | O que muda | Para quem |
|---|---|---|
| Menu lateral (T1) | Ministérios também com "Visualizar Toda a Igreja"; Membros, Células e Relatórios para a função Membro; Funções some para a Líder; a função da pessoa aparece embaixo do nome; "Ver meus dados" para quem não edita o próprio cadastro | todos |
| Funções (T2 a T4) | rótulos novos; permissões em grupos, com dicas; duas permissões a menos; Administrador só para leitura; número de membros por função; bloqueios ao excluir; aviso ao trocar a função padrão | quem tem "Visualizar Funções" ou "Gerenciar Funções" |
| Membros (T5, T6) | o subtítulo diz o alcance; "Novo membro" confere a função padrão antes de abrir o formulário; no formulário, o líder é obrigatório e escolhido no ministério, pastor e sem liderança só para quem vê a igreja toda, e a função só com as opções que a pessoa pode atribuir | quem cadastra e edita membros |
| Células (T7) | "Novo relatório" também para o anfitrião e para quem tem "Editar Célula"; dica de alcance nos seletores de pessoas | pessoas da célula e Líder |
| Relatórios (T8) | "Novo relatório" só para quem pode enviar de alguma célula; o seletor traz só essas células e já vem preenchido quando há uma só; participantes do ministério | quem envia relatório |
| Dashboard (T9) | título e selo pela permissão de visibilidade; orientação para quem não tem acesso; atalho "Novo relatório" | todos |
| Ministérios (T10) | estado vazio com o caminho para Membros, até o E2.15 | quem vê só o ministério |
| Todas (T11, T12) | recusas por escopo na linguagem do usuário; acesso relido sem sair e entrar; tela sem acesso | todos |

### Decisões de experiência
| # | Decisão | Por quê |
|---|---|---|
| UXD-1 | **O controle que a pessoa nunca pode usar some. O que ela precisa entender vira texto, com o motivo embaixo.** "É Pastor(a)?" e "Tem Liderança?" somem para quem vê só o ministério. A função que a pessoa não pode trocar aparece como texto, com a razão ("Ninguém pode alterar a própria função."). Nenhum campo fica desabilitado sem explicação. | Um campo desabilitado não diz por quê, tem contraste baixo e o teclado pula por ele. Um controle que nunca vai funcionar só gera uma recusa depois de a pessoa preencher tudo. |
| UXD-2 | **As recusas previsíveis aparecem antes, no diálogo de bloqueio (P3).** "Novo membro" confere a função padrão (RN-19) antes de abrir o formulário. "Excluir" numa função padrão ou em uso abre direto o bloqueio (RN-20). O servidor continua com a última palavra. | É o padrão da UXD-2 do E2.01 e da UXD-7 de Escolas. Assim o líder não digita um cadastro inteiro para descobrir no fim que não podia fazê-lo. |
| UXD-3 | **Para quem vê só o ministério, o campo Líder fica sempre visível e é obrigatório. No cadastro novo, ele já vem preenchido com quem está cadastrando.** | A RN-10 exige o líder, e um interruptor "Tem Liderança?" ligado e travado seria um passo inútil. O preenchimento repete o legado (`UI/pages/Members/details.js:92`), que os líderes já conhecem, e acerta o caso mais comum: o líder cadastrando o próprio discípulo. Ver PO-UX-6. |
| UXD-4 | **Os seletores de pessoas dizem o alcance.** Para quem vê só o ministério, há uma dica embaixo do campo, e a busca sem resultado diz "Nenhum membro do seu ministério encontrado.". A pessoa já escolhida que está fora do ministério continua aparecendo pelo nome. | Sem isso, quem procura alguém de outro ministério conclui que a pessoa não está cadastrada e cria um cadastro repetido. |
| UXD-5 | **As listas e o Dashboard dizem o alcance no subtítulo**: "do seu ministério" ou "de toda a igreja". | O alcance muda para muita gente neste passo (tabela "O que muda para quem usa o sistema"). Um subtítulo explica por que alguém "sumiu" da lista sem ninguém precisar perguntar. |
| UXD-6 | **A função Administrador aparece só para leitura**, sem "Editar" nem "Excluir", com um cadeado e a frase do Negócio no lugar das permissões. | RN-17. Um botão que sempre recusa seria um beco sem saída. |
| UXD-7 | **As permissões ficam em grupos por área, com dicas curtas, numa lista que rola junto com o diálogo.** Sai a caixa com rolagem interna de hoje, e o formulário de função passa a usar o diálogo responsivo (P1). | Hoje são 22 permissões numa lista corrida, dentro de uma caixa de 192 px. Para achar "Excluir Relatórios de Células", a pessoa rola dentro de outra rolagem, e no celular as duas disputam o mesmo gesto. |
| UXD-8 | **Sempre existe uma função padrão.** O interruptor "Função padrão" fica travado na função que já é a padrão, com o motivo escrito. Para trocar, a pessoa marca outra função, e a tela avisa qual deixa de ser a padrão. | A RN-19 conta com uma função padrão (a Membro), e o cadastro feito por quem não atribui funções depende dela. Hoje dá para desligar a padrão e ficar sem nenhuma. Ver PO-UX-3. |
| UXD-9 | **O seletor de célula do relatório oferece só as células em que a pessoa pode enviar (RN-13). Quando há uma só, ela já vem escolhida.** | O anfitrião e o membro comum enviam de uma ou duas células. Escolher entre todas as células do ministério para depois receber "Você não pode enviar o relatório desta célula." seria o pior caminho no fluxo mais frequente do sistema. |
| UXD-10 | **Atalho "Novo relatório" no Dashboard**, para quem pode enviar o relatório de pelo menos uma célula. Aceito pelo PO (PO-UX-9, P-PER-25). | O Dashboard é a tela inicial, e o envio do relatório é a ação mais frequente. Com a D3, anfitriões passam a enviar, muitas vezes com pouca familiaridade com o sistema. O legado tinha "Registrar Relatório" no menu de todos (`UI/components/NavMenu/index.js:91`). Hoje são 4 toques; com o atalho, 2. |
| UXD-11 | **O acesso é relido sem sair e entrar (RN-08)**: quando a pessoa volta para a aba, quando navega pelo menu e depois de uma recusa de permissão. O menu e os botões se ajustam, e aparece "Seu acesso foi atualizado.". Uma tela que deixou de ser permitida mostra "Você não tem acesso a esta tela.", sem redirecionar. | Hoje as permissões são lidas só no login. O banco já recusaria, mas a tela continuaria oferecendo o que não vale mais, ou escondendo o que acabou de ser liberado. Redirecionar sem explicar, como faz a Auditoria hoje, parece um erro. |
| UXD-12 | **A função de outro membro só aparece para quem pode atribuir funções.** No próprio cadastro, a pessoa sempre vê a sua função, só para leitura. | RN-23: o nome da função equivale às permissões da pessoa. Hoje qualquer editor vê a função do cadastro, num campo desabilitado. Ver PO-UX-5 e AQ-3. |
| UXD-13 | **Quem não pode editar o próprio cadastro vê "Ver meus dados", só para leitura.** | RN-07: o membro sem função não altera nem o próprio cadastro. Hoje ele abriria "Editar meus dados", mudaria algo e receberia uma recusa ao salvar. |
| UXD-14 | **O menu mostra a função da pessoa embaixo do nome dela.** | Depois deste passo, muita gente passa a ver e a fazer coisas diferentes. Saber a própria função ("Líder", "Membro", "Sem função") ajuda a pessoa e quem dá suporte a entender o que aparece na tela. |

### Navegação e rotas
- **Nenhuma rota nova.**
- **Menu lateral (`AppSidebar`), item a item** (RN-22). "Visualizar Membros (legado)" e "Visualizar Dashboard do seu ministério" deixam de abrir qualquer item.

| Item | Aparece com | Rita | Samuel, Pedro, André, Diego (Líder) | Caio, Carla, Fábio (Membro) | Gabriel (só "Visualizar Relatórios do Seu Ministério") | Hugo (sem função) | Conta X |
|---|---|---|---|---|---|---|---|
| Dashboard | Visualizar Dashboard | ✓ | ✓ | ✓ | — | — | — |
| Membros | Visualizar Toda a Igreja ou Visualizar Seu Ministério | ✓ | ✓ | ✓ | — | — | — |
| Células | idem | ✓ | ✓ | ✓ | — | — | — |
| Relatórios | as duas acima, ou Visualizar Relatórios de Toda a Igreja ou do Seu Ministério; e também quem pode enviar relatório: "Enviar Relatório das Próprias Células", "Enviar Relatório de Qualquer Célula Visível" ou "Editar Célula" (definido pela UX, PO-UX-10) | ✓ | ✓ | ✓ | ✓ | — | — |
| Ministérios | Visualizar Toda a Igreja ou Visualizar Seu Ministério | ✓ | ✓ | ✓ | — | — | — |
| Funções | Visualizar Funções ou Gerenciar Funções | ✓ | — | — | — | — | — |
| Auditoria | Visualizar Auditoria | ✓ | — | — | — | — | — |
| Meus dados (rodapé do menu) | todo membro com cadastro (UXD-13) | Editar | Editar | Editar | Ver | Ver | — |

- **Rotas sem permissão:** `/members`, `/cells`, `/cell-reports`, `/ministries` e `/roles` mostram o estado "sem acesso" (T12) quando o item correspondente não estaria no menu. A `/events` hoje redireciona para `/` e pode adotar o mesmo estado (P13), sem urgência.
- **Item ativo do menu:** a regra das sub-rotas é a do E2.01 (Navegação e rotas). Nada novo aqui.
- **Atalho do Dashboard (UXD-10):** abre o formulário de relatório num diálogo, no próprio Dashboard, sem rota nova. Depois de salvar, o diálogo fecha, aparece o toast, e os cards da semana recarregam.

### Fluxos
Contagem no celular, a partir do Dashboard (a tela que abre depois do login) ou de qualquer tela com o menu fechado, incluindo o toque no ☰. "Toque" não conta a digitação.

| # | História | Caminho | Toques e telas |
|---|---|---|---|
| F1 | A anfitriã envia o relatório (Carla, Membro), o fluxo mais frequente | Dashboard → "Novo relatório" (UXD-10) → célula já escolhida, com data e horário sugeridos → tema e participantes → "Salvar" | 2 toques + preenchimento; 1 tela e 1 diálogo. Sem o atalho: ☰ → Relatórios → "Novo relatório" → … → "Salvar", 4 toques |
| F2 | Timóteo de uma célula e anfitrião de outra (Caio) | Dashboard → "Novo relatório" → Célula (2 opções, C1 e C2) → escolhe → preenche → "Salvar" | 4 toques + preenchimento |
| F3 | O líder envia pela tela de Células (Pedro) | ☰ → Células → busca → ícone "Novo relatório" no card → … → "Salvar" | 4 toques, igual a hoje |
| F4 | O líder cadastra um discípulo (Pedro) | ☰ → Membros → "Novo membro" → Líder já preenchido com Pedro → dados → "Criar membro" | 4 toques + digitação; +2 para trocar o líder |
| F5 | O líder não cobre a função padrão (RN-19) | ☰ → Membros → "Novo membro" → diálogo de bloqueio → "Fechar" | 4 toques, sem digitar nada |
| F6 | A administradora atribui uma função (Rita, desktop) | Membros → busca → "Editar" → Função → escolhe → "Salvar" | 4 cliques + busca |
| F7 | A administradora cria uma função (desktop) | Funções → "Nova função" → nome, descrição e permissões, por grupo → "Salvar função" | 1 tela + 1 diálogo |
| F8 | A administradora troca a função padrão | Funções → "Editar" na nova padrão → liga "Função padrão" → lê qual deixa de ser → "Salvar função" | 3 toques |
| F9 | Excluir uma função em uso ou a padrão (RN-20) | Funções → "⋯" (no desktop, o ícone) → "Excluir função" → bloqueio → "Fechar" | 3 toques |
| F10 | Excluir uma função sem uso | Funções → "⋯" → "Excluir função" → "Excluir função" | 3 toques |
| F11 | O acesso muda durante o uso (Caio recebe a função Líder) | volta para a aba ou toca num item do menu → menu e botões atualizados, com "Seu acesso foi atualizado." | 0 toque a mais |
| F12 | O membro corrige os próprios dados (Caio) | ☰ → "Editar meus dados" → altera → "Salvar" | 3 toques, igual a hoje |
| F13 | Quem não tem função entra (Hugo) | login → Dashboard sem acesso, com a orientação → ☰ → "Ver meus dados" | 2 toques para consultar |
| F14 | O líder abre Ministérios antes do E2.15 | ☰ → Ministérios → estado vazio → "Ver membros do seu ministério" | 3 toques |

### Telas
As convenções dos wireframes são as de Escolas e do E2.01: 360 px ≈ 38 colunas; `[Botão]` é botão; `[x]` é checkbox; `[▾]` é seleção; `⋯` é o menu de ações; `(i)` é aviso; `⚠` é erro. A margem lateral é a do `AppLayout` (`p-4`).

#### T1. Menu lateral (`AppSidebar`)
Celular (`Sheet` de 256 px), com Caio (Membro):
```
┌────────────────────────────┐
│ (logo) MCI Connect         │
│                            │
│ ▸ Dashboard                │  item ativo: aria-current="page"
│   Membros                  │
│   Células                  │
│   Relatórios               │
│   Ministérios              │
│────────────────────────────│
│ Caio Lima           [✎]    │  44×44: "Editar meus dados"
│ Membro                     │  função (UXD-14), text-xs
│   Sair                     │
└────────────────────────────┘
```
Hugo (sem função):
```
│ (logo) MCI Connect         │
│                            │  nenhum item
│────────────────────────────│
│ Hugo Melo           [◎]    │  ícone Eye: "Ver meus dados"
│ Sem função                 │
│   Sair                     │
```
- **Itens:** seguem a tabela de Navegação e rotas. Enquanto o acesso carrega, o menu mostra 4 `Skeleton` de 40 px no lugar dos itens, e não uma lista vazia.
- **Função embaixo do nome (UXD-14):** `text-xs text-sidebar-foreground`, sem `opacity-70`, para ter contraste de 4,5:1. O nome e a função quebram linha, sem `truncate`. Sem cadastro de membro (conta X), o bloco não aparece, como hoje.
- **Meus dados:**
  - com "Editar Próprio Cadastro" ou "Editar Membro": ícone `Pencil` e `aria-label="Editar meus dados"`, como hoje;
  - sem as duas: ícone `Eye` e `aria-label="Ver meus dados"`, que abre o cadastro só para leitura (T6, "Meus dados");
  - o botão passa de 28 px (`h-7 w-7`) para `h-11 w-11` no celular e `md:h-9 md:w-9` no desktop.
- **Desktop:** a mesma estrutura, na barra lateral fixa.
- Componentes: `Sheet`, `Button`, `Skeleton`.

#### T2. Funções (`/roles`): lista
Celular, com Rita:
```
┌──────────────────────────────────────┐
│ ☰                                    │
│ Funções                              │  h1
│ Gerenciar funções e permissões       │
│ [+ Nova função                     ] │  só com manage_roles; h-11
│──────────────────────────────────────│
│ Administrador (cadeado)              │  cadeado decorativo
│ Acesso total ao sistema, em toda a   │
│ igreja.                              │
│ Todas as permissões, inclusive as    │  no lugar das permissões (UXD-6)
│ novas. Esta função não pode ser      │
│ alterada nem excluída.               │
│ 1 membro                             │
│──────────────────────────────────────│
│ Líder                     [✎]  [⋯]   │  44×44 cada, 8 px entre si
│ Vê e gerencia membros, células e     │
│ relatórios do seu ministério.        │
│ 12 permissões · 6 membros            │
│ [Ver permissões                   ▾] │  Collapsible, h-11
│──────────────────────────────────────│
│ Membro [★ Padrão]         [✎]  [⋯]   │  badge P6: ícone e texto
│ Vê o seu ministério, edita os        │
│ próprios dados e envia o relatório   │
│ das suas células.                    │
│ 4 permissões · 5 membros             │
│ [Ver permissões                   ▾] │
└──────────────────────────────────────┘
  ⋯ : Excluir função
```
"Ver permissões" aberto:
```
│ O que a pessoa vê                    │  text-xs font-medium, cor muted
│ [Visualizar Dashboard]               │  Badge secondary; quebra linha
│ [Visualizar Seu Ministério]          │
│ Membros                              │
│ [Editar Próprio Cadastro]            │
│ Relatórios                           │
│ [Enviar Relatório das Próprias       │
│  Células]                            │
│ [Ocultar permissões               ▴] │
```
Desktop (a partir de 768 px, tabela):
```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Funções                                                                  [+ Nova função] │
│ Gerenciar funções e permissões                                                           │
│ Função            │ Descrição                │ Permissões                   │ Membros │      │
│ Administrador (🔒)│ Acesso total ao sistema, │ Todas as permissões,         │ 1       │      │
│                   │ em toda a igreja.        │ inclusive as novas. Esta     │         │      │
│                   │                          │ função não pode ser alterada │         │      │
│                   │                          │ nem excluída.                │         │      │
│ Líder             │ Vê e gerencia membros…   │ [Visualizar Dashboard] […]   │ 6       │[✎][🗑]│
│ Membro [★ Padrão] │ Vê o seu ministério…     │ [Visualizar Dashboard] […]   │ 5       │[✎][🗑]│
└──────────────────────────────────────────────────────────────────────────────────────────┘
```
- **Ordem:** Administrador primeiro e depois as demais, em ordem alfabética. As permissões de cada função aparecem na ordem dos grupos da T3.
- **Administrador (UXD-6):**
  - não tem "Editar", "Excluir" nem "⋯", e o cadeado (`Lock`, `aria-hidden`) fica ao lado do nome;
  - a frase do Negócio aparece no lugar dos badges, nos cards e na tabela;
  - o badge "Sistema" de hoje sai: a frase já explica a diferença, e "Sistema" não diz nada a quem usa.
- **Número de membros:** "N membros", "1 membro" ou "Nenhum membro", contando só os não excluídos (AQ-2). Sem esse dado, a linha mostra só as permissões.
- **Função sem nenhuma permissão:** no lugar dos badges, aparece "Sem permissões: quem tiver esta função vê só o próprio cadastro, as células em que é líder, timóteo ou anfitrião e os relatórios delas, e não altera nada." (RN-02 d e RN-07; texto ajustado pelo PO na PO-UX-11).
- **Badge "Padrão":** passa para o padrão P6 (`bg-warning/15`, borda `border-warning`, `text-foreground` e o ícone `Star`), no lugar das cores âmbar fixas de hoje, que não usam os tokens.
- **Ações:**
  - "Editar" é um `Button variant="ghost" size="icon"` com `aria-label="Editar a função {Nome}"`;
  - no celular, "Excluir função" fica no "⋯" (P8), com `aria-label="Ações da função {Nome}"`. No desktop, é o ícone `Trash2` em `text-muted-foreground`, com `aria-label="Excluir a função {Nome}"`;
  - sem "Gerenciar Funções" (só "Visualizar Funções"), não há ações nem "Nova função".
- **Celular × desktop:** hoje a troca de cards para tabela usa o `useIsMobile`, que pisca o layout de desktop no celular no primeiro render. Como a estrutura muda de verdade, o hook pode continuar, mas a tela mostra o `Skeleton` até o hook resolver.
- Componentes: `Card`, `Table`, `Badge`, `Button`, `DropdownMenu`, `Collapsible`, `Skeleton`.

#### T3. Funções: formulário (nova e editar)
Diálogo responsivo (P1): tela cheia no celular, `Dialog` com `max-w-2xl` e `max-h-[90dvh]` no desktop.
```
┌──────────────────────────────────────┐
│ ✕  Editar função                     │  cabeçalho fixo
│──────────────────────────────────────│
│ Nome *                               │
│ [Líder                             ] │
│ Descrição                            │
│ [Vê e gerencia membros, células e …] │
│                                      │
│ Permissões              12 marcadas  │
│ Fora a Auditoria, todas as permissões│  text-sm, cor muted (PO-UX-2)
│ valem só para o que a pessoa vê.     │
│                                      │
│ O que a pessoa vê                    │  legend do fieldset
│ [x] Visualizar Toda a Igreja         │  a linha inteira é clicável; min-h-11
│     Todos os membros, células e      │  dica
│     relatórios.                      │
│ [x] Visualizar Seu Ministério        │
│     A pessoa, o cônjuge, o casal G12 │
│     e os discípulos de todos eles,   │
│     com as células e os relatórios.  │
│ [ ] Ver Dados Sensíveis              │
│     CPF, e-mail, telefones e         │
│     endereço das pessoas que ela vê. │
│ [x] Visualizar Dashboard             │
│     Os números do que a pessoa vê.   │
│                                      │
│ Membros                              │
│ [x] Criar Membro                     │
│ [x] Editar Membro                    │
│ [x] Excluir Membro                   │
│ [x] Editar Próprio Cadastro          │
│     Só os dados pessoais. Líder,     │
│     cônjuge, batismo, situação e     │
│     função ficam de fora.            │
│ [ ] Alterar Senha de Membros         │
│                                      │
│ Células                              │
│ [x] Criar Célula                     │
│ [x] Editar Célula                    │
│     Também envia o relatório das     │
│     células que a pessoa vê.         │
│ [x] Excluir Célula                   │
│                                      │
│ Relatórios                           │
│ [ ] Visualizar Relatórios de Toda a  │
│     Igreja                           │
│     Só os relatórios. Não abre       │
│     Membros nem Células.             │
│ [ ] Visualizar Relatórios do Seu     │
│     Ministério                       │
│     Só os relatórios. Não abre       │
│     Membros nem Células.             │
│ [x] Enviar Relatório das Próprias    │
│     Células                          │
│     Células em que a pessoa é líder, │  dica do Negócio
│     timóteo ou anfitrião.            │
│ [ ] Enviar Relatório de Qualquer     │
│     Célula Visível                   │
│ [x] Editar Relatórios de Células     │
│ [x] Excluir Relatórios de Células    │
│                                      │
│ Funções e auditoria                  │
│ [ ] Visualizar Funções               │
│ [ ] Gerenciar Funções                │
│     Também vê e restaura o que foi   │
│     excluído.                        │
│ [ ] Atribuir Função aos Membros      │
│     Só funções com permissões que a  │
│     pessoa também tem.               │
│ [ ] Visualizar Auditoria             │  PO-UX-2
│     As alterações feitas em toda a   │  dica do PO (P-PER-18)
│     igreja, sem limite de ministério.│
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ Função padrão              [○  ] │ │  Switch
│ │ Novos membros recebem esta função│ │
│ │ quando quem cadastra não escolhe │ │
│ │ outra.                           │ │
│ └──────────────────────────────────┘ │
│──────────────────────────────────────│
│ [Cancelar]          [Salvar função]  │  rodapé fixo; "Criar função" na nova
└──────────────────────────────────────┘
```
"Função padrão" ligada numa função que não era a padrão:
```
│ ┌──────────────────────────────────┐ │
│ │ Função padrão              [  ●] │ │
│ │ Novos membros recebem esta função│ │
│ │ quando quem cadastra não escolhe │ │
│ │ outra.                           │ │
│ │ (i) A função Membro deixa de ser │ │  Alert dentro do bloco
│ │ a padrão. Quem cadastra membros  │ │
│ │ sem poder escolher a função      │ │
│ │ precisa ter todas as permissões  │ │
│ │ da função padrão.                │ │
│ └──────────────────────────────────┘ │
```
Na função que já é a padrão:
```
│ │ Função padrão        [  ●] travado│ │
│ │ Esta é a função padrão. Para     │ │  no lugar da explicação geral
│ │ trocar, marque outra função como │ │
│ │ padrão.                          │ │
```
- **Grupos (UXD-7, definidos pela UX):** "O que a pessoa vê", "Membros", "Células", "Relatórios" e "Funções e auditoria", nesta ordem, com as 22 permissões que ficam na tela. "Gerenciar escolas" (ESC-28) entra depois num grupo "Escolas" (P14).
- **Rótulos:** os da tabela [Rótulos e descrições](#rótulos-e-descrições-rn-22). As dicas são as da tabela de Textos; só a de "Enviar Relatório das Próprias Células" vem do Negócio (PO-UX-1).
- **Lista:** sem a caixa `max-h-48` com rolagem interna. A lista rola junto com o corpo do diálogo. "12 marcadas" é o total, que muda na hora.
- **Linha da permissão:** o `Checkbox` e o `Label` (`htmlFor`) ocupam a linha inteira, com `min-h-11` no celular. A dica é um `<p id>` ligado ao checkbox por `aria-describedby`. Cada grupo é um `<fieldset>` com `<legend>`.
- **Função padrão (UXD-8):**
  - o `Switch` fica desabilitado na função que já é a padrão, e o motivo fica escrito logo abaixo dele;
  - ao ligar em outra função, o `Alert` diz qual deixa de ser a padrão e lembra a regra da RN-19, antes de salvar;
  - a troca acontece ao salvar, numa operação só (AQ-2).
- **Envio:** "Salvar função" vira "Salvando…" e fica desabilitado. Sem nome, o erro "Informe o nome da função." aparece embaixo do campo, com o foco nele. Hoje o botão só fica desabilitado, sem dizer por quê.
- **Fechar com alterações:** "Cancelar", "✕" ou `Esc` pedem confirmação ("Descartar as alterações?", com "Descartar" e "Continuar editando").
- **Desktop:** igual, com os grupos em duas colunas a partir de `lg` ("O que a pessoa vê" e "Membros" à esquerda; "Células", "Relatórios" e "Funções e auditoria" à direita). O rodapé fica alinhado à direita.
- Componentes: `Dialog` (com o P1), `Input`, `Checkbox`, `Label`, `Switch`, `Alert`, `Button`, `AlertDialog` (descartar).

#### T4. Funções: excluir
Função sem uso (confirmação, padrões P8 e P9):
```
┌──────────────────────────────────────┐
│ Excluir a função Apoio?              │
│                                      │
│ Nenhum membro usa esta função.       │
│ Depois de excluída, ela não pode ser │
│ recuperada.                          │
│ [Excluir função                    ] │  destructive, h-11
│ [Cancelar                          ] │  outline, h-11, foco inicial
└──────────────────────────────────────┘
```
Função em uso ou padrão (diálogo de bloqueio, P3), aberto direto quando a lista já sabe (UXD-2):
```
┌──────────────────────────────────────┐
│ Não é possível excluir a função Líder│
│                                      │
│ Esta função é usada por 6 membros.   │
│ Troque a função deles antes de       │
│ excluí-la.                           │
│ [Fechar                            ] │
└──────────────────────────────────────┘
│ Não é possível excluir a função      │
│ Membro                               │
│ Esta é a função padrão. Escolha outra│
│ função padrão antes de excluí-la.    │
│ [Fechar                            ] │
```
- **Antecipação:** o bloqueio abre sem chamar o servidor quando a lista sabe que a função é a padrão ou tem membros (AQ-2). Sem a contagem, abre a confirmação, e a recusa do servidor troca o conteúdo para o bloqueio, com a mensagem dele.
- **Envio:** o diálogo não fecha ao tocar em "Excluir função". O botão vira "Excluindo…", e os dois ficam desabilitados. No sucesso, aparece o toast "Função excluída.". Na queda de conexão, o diálogo continua aberto, com o `Alert` "Não foi possível excluir. Verifique a conexão e tente de novo." (E2.01).
- **Nenhuma recusa é silenciosa.** Hoje a exclusão não tem tratamento de erro.
- **Administrador:** não tem a ação. As mensagens da RN-17 só aparecem se vierem do servidor (API ou corrida), num toast de erro.
- Componentes: `AlertDialog`, `Alert`, `Button`.

#### T5. Membros: lista e "Novo membro"
```
Celular (Pedro)                          Desktop (≥ 1024 px)
┌──────────────────────────────────────┐ ┌────────────────────────────────────────────────┐
│ ☰                                    │ │ Membros                       [+ Novo membro]  │
│ Membros                              │ │ Membros do seu ministério                      │
│ Membros do seu ministério            │ └────────────────────────────────────────────────┘
│ [+ Novo membro                     ] │
└──────────────────────────────────────┘
```
- **Subtítulo (UXD-5):** "Membros do seu ministério" sem "Visualizar Toda a Igreja", e "Membros de toda a igreja" com ela. Ele substitui o "Gerenciar membros da igreja" de hoje, que não serve para quem só consulta. O mesmo vale em Células e Relatórios (T7, T8).
- **"Novo membro" com a função padrão acima de quem cadastra (RN-19, UXD-2):** o botão continua visível. O toque abre o diálogo de bloqueio, e não o formulário:
```
┌──────────────────────────────────────┐
│ Não é possível cadastrar membros     │
│                                      │
│ A função padrão tem permissões que   │
│ você não tem. Peça a um              │
│ administrador para fazer este        │
│ cadastro.                            │
│ [Fechar                            ] │
└──────────────────────────────────────┘
```
  - A tela sabe antes pelo acesso da pessoa (AQ-1). Sem esse dado, o formulário abre, e a recusa aparece ao salvar, no `Alert` do topo, com os dados mantidos (T11).
  - Quem pode atribuir funções não passa por essa verificação: escolhe a função no formulário.
- **Ações nos cards e linhas:** sem mudança visual. "Editar" segue "Editar Membro" e, no próprio cadastro, "Editar Próprio Cadastro". Os registros vêm limitados pelo escopo.
- Componentes: os de hoje, mais `AlertDialog` para o bloqueio.

#### T6. Formulário de membro (`MemberForm`)
Dados ministeriais de quem vê a igreja toda (Rita): sem mudança.
```
│ Dados ministeriais                   │
│ É Pastor(a)?                  [○  ]  │
│ Ativo                         [  ●]  │
│ Tem liderança?                [  ●]  │
│ Líder                                │
│ [André Souza                    ✕ ▾] │
│ Batizado(a)?                  [○  ]  │
```
Quem vê só o ministério (Pedro), cadastro novo (UXD-3):
```
│ Dados ministeriais                   │
│ Líder *                              │
│ [Pedro Alves                    ✕ ▾] │  já preenchido com quem cadastra
│ O líder é obrigatório e é escolhido  │  text-sm, cor muted; aria-describedby
│ entre as pessoas do seu ministério.  │
│ Ativo                         [  ●]  │
│ Batizado(a)?                  [○  ]  │
```
Erro ao salvar sem líder:
```
│ Líder *                              │
│ [Buscar líder…                    ▾] │  borda de erro; recebe o foco
│ ⚠ Escolha o líder.                   │
│ O líder é obrigatório e é escolhido  │
│ entre as pessoas do seu ministério.  │
```
Quem vê só o ministério, editando um pastor (Samuel edita Magda):
```
│ Dados ministeriais                   │
│ Pastor(a)                            │  texto, sem controle (UXD-1)
│ Só quem vê a igreja toda pode mudar  │
│ esta marcação.                       │
│ Ativo                         [  ●]  │
│ Batizado(a)?                  [○  ]  │
```
Quem vê só o ministério, editando alguém que já está sem liderança (o cônjuge, RN-06):
```
│ Sem liderança                        │  texto
│ Líder                                │  opcional neste caso (PO-UX-7)
│ [Buscar líder…                    ▾] │
│ Para definir um líder, escolha uma   │
│ pessoa do seu ministério.            │
```
Cônjuge, para quem vê só o ministério:
```
│ Cônjuge                              │
│ [Buscar cônjuge…                  ▾] │
│ Escolha entre as pessoas do seu      │
│ ministério. Se o cônjuge é de outro  │
│ ministério, peça a um administrador. │
```
Acesso (campo Função), por situação:
```
Rita editando Caio                       Rita no próprio cadastro
│ Função *                             │ │ Função                               │
│ [Membro (padrão)                  ▾] │ │ Administrador                        │  texto
│                                      │ │ Ninguém pode alterar a própria       │
│                                      │ │ função.                              │

Pedro cadastrando (sem atribuir)         Quem atribui, diante de função acima
│ Função                               │ │ Função                               │
│ Membro (padrão)                      │ │ Administrador                        │
│ Novos membros recebem a função       │ │ Você não tem permissão para alterar  │
│ padrão.                              │ │ a função deste membro.               │
```
- **"É Pastor(a)?" e "Tem Liderança?"** aparecem só com "Visualizar Toda a Igreja" (RN-10). Para os demais:
  - o campo Líder aparece sempre e é obrigatório (`Líder *`), com a dica do Negócio, exceto no cadastro de um pastor (que não tem líder) e no de quem já está sem liderança;
  - no cadastro novo, o Líder vem com quem está cadastrando (UXD-3, PO-UX-6), e a pessoa pode trocar;
  - a validação é no envio: "Escolha o líder." embaixo do campo, com o foco nele, sem chamar o servidor.
- **Seletores de pessoa (P11):** Líder e Cônjuge mostram só as pessoas que quem edita vê (vem da `members_view`, sem mudança no componente).
  - Para quem vê só o ministério, a busca sem resultado diz "Nenhum membro do seu ministério encontrado.".
  - O valor salvo que está fora do ministério continua aparecendo pelo nome (por exemplo, o líder Samuel no cadastro do próprio Pedro, pela `member_names`) e é mantido ao salvar os outros campos (RN-09 b). Se a pessoa trocar o valor, não consegue voltar a ele.
- **Função (RN-18, UXD-1, UXD-12):**
  - o seletor só oferece as funções que quem edita pode atribuir, e a padrão leva "(padrão)" no nome;
  - no próprio cadastro, a função aparece como texto, com "Ninguém pode alterar a própria função.";
  - quando a função atual está acima de quem edita, aparece como texto, com "Você não tem permissão para alterar a função deste membro.";
  - no cadastro novo feito por quem não atribui funções, aparece a função padrão como texto, com "Novos membros recebem a função padrão.";
  - na edição de outra pessoa por quem não atribui funções, o campo Função não aparece (UXD-12, PO-UX-5).
- **Valor como texto (P12):** rótulo em `text-sm font-medium`, valor em `text-base` e motivo em `text-sm text-muted-foreground`. Não usa `Input disabled`.
- **"Meus dados" só para leitura (UXD-13):** o mesmo formulário, com o título "Meus dados", os campos `readOnly` (focáveis e lidos pelo leitor de tela), sem "Salvar" e com um `Alert` no topo: "Você pode consultar os seus dados, mas não alterá-los. Para corrigir alguma informação, fale com o seu líder." O rodapé tem só "Fechar".
- **Recusas do servidor:** ver T11. O formulário não fecha, mantém tudo o que foi digitado, e nunca mostra "Membro atualizado com sucesso" quando nada foi gravado (AQ-6).
- **Desktop:** igual, nas duas colunas de hoje (a dica fica embaixo do campo, na mesma coluna).
- Componentes: os de hoje (`Switch`, `AsyncMemberSelect`, `Select`), mais `Alert`. O `PaginatedSelect` precisa aceitar `aria-describedby` para a dica (tarefa do frontend; hoje ele só junta a mensagem de erro).

#### T7. Células: lista e formulário
Cards no celular, por pessoa:
```
Caio (Membro): timóteo de C1 e anfitrião de C2
│ André Souza                   [📄+]  │  só "Novo relatório"; sem "Editar"
│ G12: Pedro e Paula                   │
│ Timóteo: Caio Lima · Anfitriã: Carla │
│──────────────────────────────────────│
│ Diego Reis                    [📄+]  │  pelo anfitrião
│ G12: Tiago e Tânia                   │

Fábio (Membro): vê C1 e C2, sem ser pessoa delas
│ André Souza                          │  sem ações
│ G12: Pedro e Paula                   │

Pedro (Líder)
│ André Souza          [📄+] [✎] [⋯]   │  44×44 cada
```
- **Nota (2026-11-23):** o "G12: Pedro e Paula" e o "G12: Tiago e Tânia" dos cards são anteriores ao E2.06. O G12 da célula é um nome só, nunca o casal: "G12: Pedro Alves" (RN-11 e P-HIE-23 do [E2.06](e2-06-hierarquia-totais.md)).
- **"Novo relatório" no card (RN-13):** aparece para a pessoa da célula (líder, timóteo ou **anfitrião**) cuja função tem "Enviar Relatório das Próprias Células", e para quem tem "Editar Célula" ou "Enviar Relatório de Qualquer Célula Visível", nas células que vê. Hoje o anfitrião e quem tem só "Editar Célula" ficam de fora. A tela usa o mesmo cálculo do banco (AQ-4).
- **"Editar":** só com "Editar Célula", como hoje. Ser líder ou timóteo da célula não basta (RN-12).
- **Subtítulo:** "Células do seu ministério" ou "Células de toda a igreja".
- **Formulário de célula, para quem vê só o ministério:**
```
│ Líder, timóteo e anfitrião são       │  dica única, acima dos três campos
│ escolhidos entre as pessoas do seu   │
│ ministério.                          │
│ Líder *                              │
│ [Diego Reis                     ✕ ▾] │  fora do ministério: aparece pelo nome
│ Timóteo (Auxiliar)                   │
│ [Hugo Melo                      ✕ ▾] │
│ Anfitrião                            │
│ [Caio Lima                      ✕ ▾] │
```
  - Os três seletores seguem o P11, inclusive o texto de busca vazia. A dica é ligada aos três campos por `aria-describedby`.
  - **RN-09 (c):** se Pedro tira Caio de anfitrião de C2, a célula fica só com pessoas que ele não vê. O servidor recusa, e o `Alert` do topo mostra "Com esta alteração, você deixaria de ver esta célula. Mantenha pelo menos uma pessoa do seu ministério como líder, timóteo ou anfitrião. As alterações não foram salvas." (PO-UX-4). Os dados continuam no formulário.
- Componentes: os de hoje, mais `Alert`.

#### T8. Relatórios: lista e formulário (`CellReportForm`)
- **"Novo relatório" no cabeçalho:** aparece só para quem pode enviar o relatório de pelo menos uma célula (RN-13; AQ-1 ou AQ-4). Deixa de depender de "Editar Próprio Cadastro". Caio, Carla e Pedro veem; Fábio, Hugo e Gabriel (só com "Visualizar Relatórios do Seu Ministério") não.
  - Enquanto o acesso carrega, o lugar do botão é reservado com um `Skeleton` de `h-11` no celular, para a lista não pular.
- **Subtítulo:** "Relatórios das células do seu ministério" ou "Relatórios das células de toda a igreja" (com "Visualizar Toda a Igreja" ou "Visualizar Relatórios de Toda a Igreja"). Quem chega a Relatórios só por uma permissão de enviar (PO-UX-10) não vê subtítulo, porque vê só os relatórios das próprias células (PO-UX-13, P-PER-29).
- **Editar e excluir:** sem mudança visual (RN-14). Os relatórios vêm limitados pelo escopo.

Formulário, com Carla (uma célula só):
```
┌──────────────────────────────────────┐
│ ✕  Novo relatório de célula          │
│ Célula *                             │
│ [André Souza · Quarta, 20:00 · R… ▾] │  já escolhida: é a única (UXD-9)
│ [ ] Não houve célula                 │
│ Data *               Horário *       │
│ [25/11/2026     ]    [20:00     ]    │  sugeridos pela célula
│ Detalhes do encontro                 │
│ Tema da palavra                      │
│ [                                  ] │
│ Participantes (membros)              │
│ [Ana Souza ✕] [Bruno Lima ✕]       ▾ │
│ Aparecem só as pessoas do seu        │  só para quem vê só o ministério
│ ministério.                          │
│ …                                    │
│ [Cancelar]                 [Salvar]  │
└──────────────────────────────────────┘
```
Edição de R2 por Pedro, com participantes que ele não vê:
```
│ Participantes (membros)              │
│ [Caio Lima ✕] [Diego Reis ✕]         │
│ [Hugo Melo ✕]                      ▾ │
│ Alguns participantes não são do seu  │  só quando há (AQ-7, PO-UX-8)
│ ministério: se você retirá-los, não  │
│ poderá incluí-los de novo.           │
```
- **Seletor de célula (UXD-9):** só as células ativas em que a pessoa pode enviar (AQ-4).
  - Com uma só, ela vem escolhida, e a data e o horário são sugeridos. O seletor continua editável, para a pessoa conferir.
  - Com nenhuma (só em corrida, porque o botão não apareceria), a busca vazia diz "Você não pode enviar o relatório de nenhuma célula.".
  - Opcional (AQ-4): as células em que a pessoa é líder, timóteo ou anfitrião aparecem primeiro, para o líder com muitas células no ministério.
- **Participantes:** seguem o P11. Na edição, os que a pessoa não vê continuam como chips e são mantidos ao salvar (critério da RN-09). O aviso só aparece quando há algum deles.
- **Recusas:** ver T11. "Você não pode enviar o relatório desta célula." aparece no `Alert` do topo, a célula é desmarcada, o seletor recarrega e o resto do formulário fica como estava.
- **Desktop:** o mesmo `Dialog` de hoje. O formulário de relatório passa para o P1 no E2.11, que o reescreve.
- Componentes: os de hoje (`FormPaginatedSelect`), mais `Alert`.

#### T9. Dashboard
```
Celular (Pedro)                          Desktop (≥ 1024 px)
┌──────────────────────────────────────┐ ┌────────────────────────────────────────────────────┐
│ ☰                                    │ │ Dashboard [Meu Ministério]       [+ Novo relatório]│
│ Dashboard          [Meu Ministério]  │ │ Visão do seu ministério                            │
│ Visão do seu ministério              │ │                                                    │
│ [+ Novo relatório                  ] │ │ Esta semana (22/11 - 28/11)                        │
│                                      │ └────────────────────────────────────────────────────┘
│ Esta semana (22/11 - 28/11)          │
└──────────────────────────────────────┘
```
Rita: "Dashboard", "Visão geral da igreja", sem o selo.

Sem acesso:
```
Hugo (sem função)                        Conta X (sem cadastro)
│ Dashboard                            │ │ Dashboard                            │
│ Você não tem acesso ao dashboard.    │ │ Você não tem acesso ao dashboard.    │
│ Sua conta ainda não tem uma função.  │ │ Seu acesso ainda não está ligado a   │
│ Fale com um administrador.           │ │ um cadastro de membro. Fale com um   │
│                                      │ │ administrador.                       │
```
- **Título e selo (RN-22):** com "Visualizar Toda a Igreja", só "Visão geral da igreja"; com "Visualizar Seu Ministério" (e sem a anterior), o selo "Meu Ministério" e o subtítulo "Visão do seu ministério"; sem nenhuma das duas, nem subtítulo nem selo (PO-UX-13, P-PER-29). Hoje a condição é a permissão que sai da tela (`view_own_ministry_dashboard`).
- **Atalho "Novo relatório" (UXD-10, aceito na PO-UX-9):**
  - aparece para quem pode enviar o relatório de pelo menos uma célula;
  - é o botão `default`, `w-full h-11` no celular e à direita do título a partir de `sm`;
  - abre o formulário da T8 num diálogo, com a célula já escolhida quando é uma só;
  - no sucesso, o diálogo fecha, aparece o toast, e os cards da semana recarregam.
- **Sem acesso (RN-07):** a primeira linha é a do Negócio. A segunda aparece só quando a pessoa não tem cadastro de membro ou não tem função, e nenhum card ou `Skeleton` fica na tela. Uma função sem "Visualizar Dashboard", mas com outras telas, mostra só a primeira linha.
- **Números e ranking "Células por G12":** sem mudança visual. Os números seguem o escopo (DSH-01), e quem vê só o ministério costuma ver um só casal no ranking.
- Componentes: os de hoje, mais o `Dialog` do formulário de relatório.

#### T10. Ministérios até o E2.15 (P-PER-15)
Quem vê só o ministério e não é pastor (Pedro, Caio):
```
┌──────────────────────────────────────┐
│ Ministérios                          │
│ ┌──────────────────────────────────┐ │
│ │ Nenhum pastor visível para você. │ │
│ │ Por enquanto, a árvore começa    │ │
│ │ pelos pastores. As pessoas do seu│ │
│ │ ministério aparecem em Membros.  │ │
│ │ [Ver membros do seu ministério ] │ │  outline, h-11; leva a /members
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```
- O texto é o do E1.08, que já está na tela. Este passo só acrescenta o botão, para a pessoa não ficar sem saída. Pela P-PER-15, esse estado só existe se o E2.02 for para produção antes do E2.15.
- Os pastores (Samuel e Magda, com a função Líder) veem a árvore a partir deles mesmos, sem mudança.
- Uma função com "Visualizar Toda a Igreja" e sem "Visualizar Seu Ministério" passa a ver o item no menu e a árvore inteira.
- No E2.15, a árvore começa pelo topo do escopo, e o estado vazio fica só para quem não vê ninguém.

#### T11. Recusas por escopo e por função
Os seletores e os botões já escondem o que a pessoa não pode fazer. As recusas abaixo só aparecem em corrida (o acesso ou a árvore mudaram entre abrir a tela e salvar) ou pela API. Em todas, o formulário continua aberto, com o que foi digitado.

| Caso | Onde aparece | Texto |
|---|---|---|
| Pessoa escolhida fora do que se vê (RN-09 b) | embaixo do campo, quando o servidor diz qual (AQ-5); senão, no `Alert` do topo | Você só pode escolher pessoas que você vê. |
| Registro que saiu do que se vê, na edição (RN-09 a) | `Alert` no topo, com "Fechar", que fecha o formulário e recarrega a lista | Este cadastro não existe ou já foi excluído. As alterações não foram salvas. (ou "Esta célula…", "Este relatório…", do E2.01) |
| Registro fora do que se vê, ao excluir, restaurar ou lançar (RN-09 a, RN-15) | como no E2.01: toast informativo, e a lista recarrega; no lançamento, o `Alert` do formulário | os textos do E2.01 |
| Registro que sairia do que se vê (RN-09 c) | `Alert` no topo | Com esta alteração, você deixaria de ver este cadastro. As alterações não foram salvas. · Com esta alteração, você deixaria de ver esta célula. Mantenha pelo menos uma pessoa do seu ministério como líder, timóteo ou anfitrião. As alterações não foram salvas. (PO-UX-4) |
| Pastor ou sem liderança sem ver a igreja toda (RN-10) | `Alert` no topo; a tela relê o acesso (P13) | Só quem vê a igreja toda pode marcar um membro como pastor ou como sem liderança. |
| Lançar sem direito (RN-13) | `Alert` no topo do formulário de relatório; a célula é desmarcada | Você não pode enviar o relatório desta célula. |
| Função padrão acima de quem cadastra (RN-19) | diálogo de bloqueio ao tocar em "Novo membro" (T5) ou, sem a pré-checagem, `Alert` no topo ao salvar | A função padrão tem permissões que você não tem. Peça a um administrador para fazer este cadastro. |
| Função: a própria, deste membro, desta função (RN-18) | embaixo do campo Função | Ninguém pode alterar a própria função. · Você não tem permissão para alterar a função deste membro. · Você não tem permissão para atribuir esta função. |
| Função Administrador (RN-17) | toast de erro na tela de Funções | A função Administrador não pode ser alterada. · A função Administrador não pode ser excluída. · A função Administrador não pode ser a função padrão. |
| Excluir função padrão ou em uso (RN-20) | diálogo de bloqueio (T4) | os textos do Negócio |
| Sem permissão (42501) | `Alert` no formulário, ou toast na lista; a tela relê o acesso (P13) | Você não tem permissão para esta ação. (E2.01) |

- **`Alert` no topo de um formulário longo:** no celular, o botão "Salvar" fica longe do topo. Por isso o `Alert` recebe o foco (`tabIndex={-1}`) e a tela rola até ele, senão a pessoa não vê a mensagem.
- **Nada de falso sucesso:** quando a gravação não alterou nenhuma linha (registro que a pessoa não vê mais), a tela mostra a recusa, e não o toast de sucesso (AQ-6).

#### T12. Acesso atualizado e tela sem acesso (RN-08)
Tela sem acesso (Pedro abre `/roles` pelo link):
```
┌──────────────────────────────────────┐
│ ☰                                    │
│ Funções                              │  h1 da rota, para a pessoa se situar
│ ┌──────────────────────────────────┐ │
│ │(i) Você não tem acesso a esta    │ │  Alert
│ │tela.                             │ │
│ │[Ir para o início]                │ │  outline, h-11
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```
- **Quando o acesso é relido (UXD-11):** quando a aba volta a ficar visível, a cada navegação pelo menu, depois de qualquer recusa 42501 e quando a sessão é renovada. Não há consulta periódica.
- **Quando mudou** (permissões, função ou "vê a igreja toda"):
  - o menu, os botões, os subtítulos e o selo do Dashboard se ajustam;
  - as listas abertas recarregam;
  - aparece uma vez o toast "Seu acesso foi atualizado." (`role="status"`).
- **Formulário aberto:** não muda de forma sozinho. Ao salvar, o servidor decide, e a recusa segue a T11. Depois da recusa, o formulário se ajusta ao acesso novo (por exemplo, "É Pastor(a)?" some).
- **Tela que deixou de ser permitida:** mostra o estado acima, sem nenhum dado da tela no DOM.
- **Falha ao reler:** mantém o último acesso conhecido. Se nunca foi lido (por exemplo, a rede caiu no login), o topo da área principal mostra "Não foi possível carregar o seu acesso. Verifique a conexão e tente de novo." com "Tentar de novo", no lugar de um menu vazio sem explicação. Uma queda de rede nunca encerra a sessão (AQ-8 do E2.01).
- Componentes: `Alert`, `Button`, `Toast`.

#### T13. Telas sem mudança visual
- **Auditoria:** sem mudança. Continua para a igreja toda, com "Visualizar Auditoria" (Fora de escopo).
- **Excluídos (E2.01):** sem mudança visual. As listas e a restauração passam a seguir o escopo (RN-15).
- **Login:** sem mudança (E1.04). O membro inativo entra normalmente (RN-07).
- **Listas de Membros, Células e Relatórios:** fora o subtítulo e as ações já descritas, só os registros mudam, conforme o escopo.

### Padrões novos (valem para as próximas telas)
A numeração continua a de Escolas (P1 a P6) e a do E2.01 (P7 a P9). Este passo também aplica o P1 (formulário de função), o P3 (bloqueios da T4 e da T5), o P6 (badge "Padrão") e o P8 ("Excluir função" no "⋯").

- **P10. O alcance no subtítulo.** Toda lista ou painel com dados filtrados pelo escopo diz o alcance no subtítulo: "{Coisas} do seu ministério" ou "{Coisas} de toda a igreja". A regra que escolhe o texto é a mesma permissão que libera a igreja toda para aquela entidade. Quem não tem permissão de visibilidade para aquela entidade (vê só o próprio, pela RN-02 d) não vê subtítulo de alcance (PO-UX-13). Vale para as listas futuras com escopo (filtros do E2.07 ao E2.12, Consolidação).
- **P11. Seletor de pessoa limitado ao que se vê.**
  - As opções vêm só da `members_view` (o escopo de quem usa).
  - Para quem não vê a igreja toda, há uma dica embaixo do campo, ligada por `aria-describedby`, e a busca sem resultado diz "Nenhum membro do seu ministério encontrado.".
  - O valor já salvo que está fora do escopo aparece pelo nome (`member_names`), é mantido ao salvar os outros campos e não volta às opções depois de trocado.
  - Vale também para o seletor múltiplo de Escolas (P5).
- **P12. Valor que a pessoa não pode mudar.** Um controle que a pessoa nunca vai poder usar some. Um valor que ela precisa conhecer, mas não pode mudar, aparece como texto (rótulo, valor e motivo), e não como campo desabilitado.
  - Um item de configuração protegido (como a função Administrador) não tem ações, leva um cadeado decorativo e uma frase que explica por quê.
- **P13. Acesso relido sem sair e entrar.**
  - O acesso é relido ao voltar para a aba, ao navegar e depois de uma recusa 42501.
  - Quando muda, a tela se ajusta e avisa uma vez ("Seu acesso foi atualizado.").
  - A rota sem permissão mostra "Você não tem acesso a esta tela." e "Ir para o início", sem redirecionar e sem dados no DOM. As listas de excluídos do E2.01 usam a variação "esta lista".
- **P14. Lista de permissões agrupada.** As permissões ficam em grupos por área (`fieldset` com `legend`), cada uma numa linha inteira clicável de 44 px, com a dica embaixo, ligada por `aria-describedby`.
  - Permissão nova entra no grupo da área dela, com rótulo e, se não for óbvia, uma dica.
  - "Gerenciar escolas" (ESC-28) abre o grupo "Escolas".
  - Uma função protegida nunca mostra checkboxes (P12).

Nenhum componente novo do shadcn é necessário: `collapsible`, `alert`, `alert-dialog`, `checkbox`, `switch`, `badge`, `dropdown-menu`, `dialog`, `sheet`, `skeleton`, `table` e `card` já estão em `src/components/ui`. O P1 pede `viewport-fit=cover` na meta viewport do `index.html`, que hoje não tem (tarefa do frontend, já prevista em Escolas e no E2.01).

### Estados
| Estado | Funções (T2 a T4) | Membros e cadastro (T5, T6) | Células e Relatórios (T7, T8) | Menu, Dashboard e Ministérios (T1, T9, T10, T12) |
|---|---|---|---|---|
| Carregando | `Skeleton` de 3 cards (celular) ou 3 linhas (desktop), no lugar do "Carregando..." de hoje. A contagem de membros tem um `Skeleton` próprio | Como hoje (E1.08). O seletor de função mostra "Carregando…" | O botão "Novo relatório" tem o espaço reservado (`Skeleton h-11`). O seletor de célula preenche a única opção só depois da primeira página | Menu: 4 `Skeleton` no lugar dos itens. Dashboard: como hoje; o atalho tem o espaço reservado |
| Vazio | Função sem permissões: o texto da T2. A lista nunca fica vazia (Administrador, Líder e Membro existem sempre) | Busca dos seletores: "Nenhum membro do seu ministério encontrado." (só ministério) | Seletor de célula sem opções: "Você não pode enviar o relatório de nenhuma célula." | Ministérios: o estado da T10 |
| Erro ao carregar | `Alert` "Não foi possível carregar as funções." com "Tentar de novo" (hoje a tela fica em branco) | Como hoje | Como hoje | Acesso nunca lido: o `Alert` da T12 com "Tentar de novo" |
| Sem permissão | A rota sem "Visualizar Funções" e sem "Gerenciar Funções" mostra o estado da T12. Sem "Gerenciar Funções", não há ações | "Novo membro" bloqueado pela RN-19 (T5). Campos e opções somem ou viram texto (P12) | Sem direito de enviar: o botão não aparece. Sem "Editar Célula": sem "Editar" | Dashboard: a mensagem da T9. Rotas: o estado da T12 |
| Registro mudou no meio tempo | Função excluída ou alterada em outra sessão: toast informativo "Esta função foi alterada em outra tela." † e a lista recarrega | Os casos da T11 | Os casos da T11 | Acesso mudou: o toast "Seu acesso foi atualizado." |
| Sucesso | Toasts "Função criada.", "Função atualizada." e "Função excluída.". Na troca da padrão, "Função atualizada. {Nome} agora é a função padrão." † | Como hoje | Como hoje. Pelo atalho do Dashboard, os cards da semana recarregam | — |
| Lista grande | Sem paginação (poucas funções). As 22 permissões rolam com o diálogo (P1) | Paginação do E1.08 | Seletores com 20 por página (E1.08) | Ranking e árvore como no E1.08 |
| Queda de conexão no envio | O formulário continua aberto, com os dados, e o `Alert` "Não foi possível salvar a função. Verifique a conexão e tente de novo." †. Na exclusão, o texto do E2.01 | O formulário mantém os dados, como hoje | Como hoje | A releitura do acesso falha em silêncio e mantém o último acesso. A sessão não cai |

### Textos
Complementam os "Textos de tela" do Negócio, sem mudar termos. As mensagens de regra são as do Negócio, mostradas como vêm do servidor. Os textos marcados com † foram definidos pela UX e estão nas pendências (PO-UX-1 e PO-UX-11).

| Onde | Texto |
|---|---|
| Menu | Editar meus dados · Ver meus dados † · {Função} · Sem função † (embaixo do nome) |
| Acesso † | Seu acesso foi atualizado. · Você não tem acesso a esta tela. · Ir para o início · Não foi possível carregar o seu acesso. Verifique a conexão e tente de novo. · Tentar de novo |
| Subtítulos † | Membros do seu ministério · Membros de toda a igreja · Células do seu ministério · Células de toda a igreja · Relatórios das células do seu ministério · Relatórios das células de toda a igreja |
| Funções: lista | Funções · Gerenciar funções e permissões · Nova função · {N} permissões / 1 permissão † · {N} membros / 1 membro / Nenhum membro † · Ver permissões · Ocultar permissões † · Padrão · Administrador: a frase do Negócio · Sem permissões: quem tiver esta função vê só o próprio cadastro, as células em que é líder, timóteo ou anfitrião e os relatórios delas, e não altera nada. † · Editar a função {Nome} · Ações da função {Nome} · Excluir a função {Nome} (rótulos para leitor de tela) · Não foi possível carregar as funções. † |
| Funções: formulário | Nova função · Editar função · Nome * · Descrição · Permissões · {N} marcadas † · Fora a Auditoria, todas as permissões valem só para o que a pessoa vê. † · Grupos †: O que a pessoa vê / Membros / Células / Relatórios / Funções e auditoria · Função padrão · Novos membros recebem esta função quando quem cadastra não escolhe outra. † · Esta é a função padrão. Para trocar, marque outra função como padrão. † · A função {Nome} deixa de ser a padrão. Quem cadastra membros sem poder escolher a função precisa ter todas as permissões da função padrão. † · Informe o nome da função. † · Cancelar · Salvar função · Criar função · Salvando… · Descartar as alterações? · Descartar · Continuar editando |
| Funções: exclusão | Excluir a função {Nome}? · Nenhum membro usa esta função. Depois de excluída, ela não pode ser recuperada. † · Excluir função · Excluindo… · Não é possível excluir a função {Nome} · mensagens da RN-20 · Fechar |
| Funções: toasts | Função criada. · Função atualizada. · Função excluída. · Função atualizada. {Nome} agora é a função padrão. † · Esta função foi alterada em outra tela. † · Não foi possível salvar a função. Verifique a conexão e tente de novo. † |
| Dicas das permissões † | Visualizar Toda a Igreja: Todos os membros, células e relatórios. · Visualizar Seu Ministério: A pessoa, o cônjuge, o casal G12 e os discípulos de todos eles, com as células e os relatórios. · Ver Dados Sensíveis: CPF, e-mail, telefones e endereço das pessoas que ela vê. · Visualizar Dashboard: Os números do que a pessoa vê. · Editar Próprio Cadastro: Só os dados pessoais. Líder, cônjuge, batismo, situação e função ficam de fora. · Editar Célula: Também envia o relatório das células que a pessoa vê. · Visualizar Relatórios de Toda a Igreja e do Seu Ministério: Só os relatórios. Não abre Membros nem Células. · Gerenciar Funções: Também vê e restaura o que foi excluído. · Atribuir Função aos Membros: Só funções com permissões que a pessoa também tem. · Enviar Relatório das Próprias Células: a dica do Negócio · Visualizar Auditoria: As alterações feitas em toda a igreja, sem limite de ministério. (dica do PO, PO-UX-2) |
| Novo membro bloqueado | Título †: Não é possível cadastrar membros · mensagem da RN-19 · Fechar |
| Cadastro: Líder | Líder * · O líder é obrigatório e é escolhido entre as pessoas do seu ministério. (Negócio) · Escolha o líder. † |
| Cadastro: Cônjuge † | Escolha entre as pessoas do seu ministério. Se o cônjuge é de outro ministério, peça a um administrador. |
| Cadastro: pastor e sem liderança † | Pastor(a) · Só quem vê a igreja toda pode mudar esta marcação. · Sem liderança · Para definir um líder, escolha uma pessoa do seu ministério. |
| Cadastro: Função | Função * · {Nome} (padrão) · Novos membros recebem a função padrão. † · Ninguém pode alterar a própria função. · Você não tem permissão para alterar a função deste membro. |
| Meus dados † | Meus dados · Você pode consultar os seus dados, mas não alterá-los. Para corrigir alguma informação, fale com o seu líder. · Fechar |
| Seletores † | Nenhum membro do seu ministério encontrado. · Você não pode enviar o relatório de nenhuma célula. |
| Célula: dica † | Líder, timóteo e anfitrião são escolhidos entre as pessoas do seu ministério. |
| Relatório: participantes † | Aparecem só as pessoas do seu ministério. · Alguns participantes não são do seu ministério: se você retirá-los, não poderá incluí-los de novo. |
| RN-09 (c) † | Com esta alteração, você deixaria de ver este cadastro. As alterações não foram salvas. · Com esta alteração, você deixaria de ver esta célula. Mantenha pelo menos uma pessoa do seu ministério como líder, timóteo ou anfitrião. As alterações não foram salvas. |
| Dashboard | Visão geral da igreja · Visão do seu ministério · Meu Ministério · Você não tem acesso ao dashboard. · Sua conta ainda não tem uma função. Fale com um administrador. † · Seu acesso ainda não está ligado a um cadastro de membro. Fale com um administrador. † · Novo relatório (atalho) |
| Ministérios | os textos do E1.08 · Ver membros do seu ministério † |
| Recusas | as da tabela da T11 |

### Acessibilidade
- **Permissões (P14):** cada grupo é um `<fieldset>` com `<legend>`. Cada checkbox tem `Label` com `htmlFor`, a linha inteira é clicável, e a dica fica ligada por `aria-describedby`. Hoje o texto ao lado do checkbox é um `<span>` sem ligação: quem usa leitor de tela ouve só "caixa de seleção".
- **Valores como texto (P12):** a função e a marca "Pastor(a)" ficam em texto legível, com o rótulo antes e o motivo depois, e não em `Input disabled`, que o teclado pula e que tem contraste baixo.
- **Dicas de alcance (P11):** ligadas ao campo de busca do seletor por `aria-describedby`. O `PaginatedSelect` precisa aceitar o atributo e juntá-lo ao da mensagem de erro, que ele já trata.
- **Cadeado:** `aria-hidden`. A frase do Negócio é o que informa.
- **"Ver permissões":** `Collapsible` com `aria-expanded` e `aria-controls`. O texto do botão muda para "Ocultar permissões".
- **Anúncios:**
  - "Seu acesso foi atualizado." usa `role="status"`;
  - os `Alert` de recusa nos formulários usam `role="alert"` e recebem o foco (T11);
  - o estado sem acesso mantém o `h1` da rota, para a pessoa e o leitor de tela saberem onde estão.
- **Foco:** no diálogo de bloqueio, o foco inicial vai para "Fechar". Na confirmação de exclusão, para "Cancelar". No erro "Escolha o líder.", para o campo Líder.
- **Toque:** passam a ter 44×44 px no celular, com 8 px entre si: "Editar" e "⋯" nos cards de Funções (hoje 36 e 32 px), o botão "Meus dados" do menu (hoje 28 px), "Ver permissões", as linhas de permissão e o atalho do Dashboard.
- **Sem depender de cor:** o badge "Padrão" tem ícone e texto (P6). "Meu Ministério" é texto. A recusa nunca é só a borda vermelha do campo.
- **Contraste:** 4,5:1 para texto e 3:1 para ícones e bordas, nos dois temas. A função embaixo do nome no menu não usa `opacity-70`. O badge "Padrão" usa tokens, e não as cores âmbar fixas.
- **Zoom e fonte grande:** com 200%, os rótulos das permissões, a frase do Administrador e os nomes no menu quebram linha, sem `truncate`. O diálogo de função rola por dentro (P1).
- **Movimento:** as animações de `Collapsible`, `Dialog` e `Sheet` respeitam `motion-reduce:`.

### Critérios de UX
| ID | Critério | Como verificar |
|---|---|---|
| UX-01 | A tela de Funções mostra as 22 permissões nos 5 grupos da T3, nesta ordem, com os rótulos novos (RN-22). "Visualizar Membros (legado)", "Visualizar Dashboard do seu ministério" e nenhum identificador técnico (como `view_audit_log`) aparecem no DOM, nem no formulário nem nos badges da lista. | teste de componente |
| UX-02 | A função Administrador não tem "Editar", "Excluir" nem "⋯", e mostra a frase do Negócio no lugar das permissões, nos cards e na tabela. O cadeado é `aria-hidden`. | teste de componente (Rita) |
| UX-03 | No formulário de função, cada permissão (checkbox, rótulo e dica) é clicável na linha inteira, tem pelo menos 44 px de altura abaixo de 768 px, e a dica é lida junto com o checkbox (`aria-describedby`). Cada grupo é um `fieldset` com `legend`. | teste de componente + inspeção |
| UX-04 | Em 360×640, o formulário de função ocupa a tela, com cabeçalho e rodapé fixos, e "Salvar função" fica visível sem rolar. A lista de permissões não tem rolagem interna. A partir de 768 px, é um `Dialog` centralizado com `max-h-[90dvh]`. | teste E2E (viewport) |
| UX-05 | "Excluir função":<br>- na função padrão ou em uso (com a contagem da AQ-2), abre direto o bloqueio, sem confirmação, com a mensagem do Negócio ("… usada por 6 membros", "… por 1 membro") e só "Fechar";<br>- numa função sem uso, abre a confirmação, com "Excluir função" destrutivo e o foco em "Cancelar";<br>- a recusa do servidor aparece no mesmo bloqueio.<br><br>Nenhuma recusa é silenciosa. | teste de componente (mock) + teste E2E |
| UX-06 | Abaixo de 768 px, "Excluir função" fica só no "⋯" (P8). "Editar" e "⋯" têm 44×44 px, com 8 px entre si. | teste E2E (360×800, medida dos elementos) |
| UX-07 | Na função padrão, o interruptor "Função padrão" fica travado, com o motivo escrito. Ao ligá-lo em outra função, o aviso diz qual deixa de ser a padrão, antes de salvar. Depois de salvar, exatamente uma função tem o badge "Padrão", com ícone e texto. | teste E2E |
| UX-08 | O menu de cada pessoa da massa é o da tabela de Navegação e rotas:<br>- Rita, 7 itens;<br>- Samuel, Pedro e Caio: Dashboard, Membros, Células, Relatórios e Ministérios;<br>- Gabriel (só com "Visualizar Relatórios do Seu Ministério"), só Relatórios;<br>- Hugo e a conta X, nenhum item.<br><br>Uma função só com "Visualizar Toda a Igreja" vê Ministérios. | teste de componente (`AppSidebar`) |
| UX-09 | Embaixo do nome, o menu mostra a função ou "Sem função". O botão diz "Editar meus dados" com "Editar Próprio Cadastro" ou "Editar Membro", e "Ver meus dados" nos demais casos (Hugo). "Ver meus dados" abre "Meus dados" só para leitura, sem "Salvar". O botão tem 44×44 px abaixo de 768 px, e a conta X não o vê. | teste de componente + teste E2E |
| UX-10 | Com a sessão de Caio aberta, Rita dá a função Líder a ele em outra sessão. Quando Caio volta para a aba ou toca num item do menu, "Novo membro" aparece em Membros, sem sair e entrar, e o toast "Seu acesso foi atualizado." aparece uma vez. No sentido inverso, quando Rita tira "Visualizar Seu Ministério" da Membro, Membros, Células e Ministérios somem do menu de Carla na navegação seguinte. | teste E2E (duas sessões) |
| UX-11 | Pedro abre `/roles` pelo link: a tela mostra o título "Funções", "Você não tem acesso a esta tela." e "Ir para o início", sem redirecionar e sem nenhum nome de função ou permissão no DOM. | teste E2E |
| UX-12 | O Dashboard de Rita diz "Visão geral da igreja", sem selo. O de Pedro diz "Visão do seu ministério", com o selo "Meu Ministério". Uma função com "Visualizar Dashboard" e sem "Visualizar Toda a Igreja" nem "Visualizar Seu Ministério" não mostra subtítulo nem selo (PO-UX-13). | teste de componente |
| UX-13 | O Dashboard da conta X mostra "Você não tem acesso ao dashboard." e a linha de quem não tem cadastro. O de Hugo mostra a mesma mensagem e a linha de quem não tem função. Nenhum card nem `Skeleton` fica na tela. | teste E2E |
| UX-14 | O atalho "Novo relatório" do Dashboard aparece para Carla, Caio e Pedro, e não para Fábio nem para Hugo. Ele tem 44 px de altura e ocupa a largura toda no celular, abre o formulário num diálogo, e, no sucesso, os cards da semana recarregam. | teste E2E |
| UX-15 | O subtítulo de Membros, Células e Relatórios diz o alcance: "… do seu ministério" para Pedro e "… de toda a igreja" para Rita. Uma função com "Visualizar Relatórios de Toda a Igreja" vê "Relatórios das células de toda a igreja". | teste de componente |
| UX-16 | Com a função "Secretaria" como padrão (critério da RN-19), o "Novo membro" de Pedro abre o bloqueio com a mensagem da RN-19, antes do formulário. Com a Membro como padrão, o formulário abre. Sem a pré-checagem (AQ-1), a recusa ao salvar aparece no `Alert` do topo, com o foco nele e os dados mantidos. | teste E2E |
| UX-17 | No cadastro novo feito por Pedro, não aparecem "É Pastor(a)?" nem "Tem Liderança?". O campo "Líder *" aparece já preenchido com Pedro, com a dica do Negócio ligada ao campo. Se Pedro limpa o líder e salva, aparece "Escolha o líder." embaixo do campo, com o foco nele, e nada vai ao servidor. | teste de componente + teste E2E |
| UX-18 | No formulário de Rita, "É Pastor(a)?", "Tem Liderança?" e Líder ficam como hoje. | teste de componente |
| UX-19 | Quando Samuel (que vê só o ministério) edita Magda, "Pastor(a)" aparece como texto, com o motivo, sem interruptor e sem o campo Líder, e salvar outro campo funciona. | teste E2E |
| UX-20 | Nos seletores de Líder, Cônjuge, Timóteo, Anfitrião e Participantes, Pedro só encontra as pessoas da tabela "O que cada um vê" (nunca Samuel, Beatriz ou Diego). A busca sem resultado diz "Nenhum membro do seu ministério encontrado.". O valor salvo fora do ministério (o líder Samuel no cadastro de Pedro; Diego como líder de C2) aparece pelo nome e continua depois de salvar outro campo. | teste E2E (massa) |
| UX-21 | Campo Função:<br>- Rita, editando Caio: só as funções que ela pode atribuir, com "(padrão)" na padrão;<br>- Rita, no próprio cadastro: o texto "Administrador" e "Ninguém pode alterar a própria função.";<br>- uma função com "Atribuir Função aos Membros", sem todas as permissões, editando Rita: o texto "Administrador" e "Você não tem permissão para alterar a função deste membro.";<br>- Pedro, cadastrando: o texto "Membro (padrão)" e a dica;<br>- Pedro, editando Caio: o campo Função não aparece.<br><br>Nenhum `Input` desabilitado. | teste de componente |
| UX-22 | As recusas do servidor nos formulários (RN-09 b e c, RN-10, RN-13, RN-19 e 42501) aparecem no `Alert` do topo, com `role="alert"`, que recebe o foco e entra na tela no celular. O formulário continua aberto e com os dados. Quando o servidor diz o campo, o erro aparece embaixo dele. Nenhuma gravação sem linhas alteradas mostra toast de sucesso (AQ-6). | teste de componente (mock) + teste E2E |
| UX-23 | Em Células, "Novo relatório" aparece no card de C1 para Carla (anfitriã); em C1 e C2 para Caio e para Pedro; em nenhum para Fábio. "Editar" não aparece para quem não tem "Editar Célula" (Caio em C1). Os botões têm 44×44 px abaixo de 768 px. | teste E2E |
| UX-24 | No formulário de célula de Pedro, a dica de alcance fica acima dos três campos de pessoa. Quando ele tira Caio de anfitrião de C2 e salva, aparece a mensagem da RN-09 (c) no `Alert` do topo, com os dados mantidos. | teste E2E |
| UX-25 | Em Relatórios, o botão "Novo relatório" aparece para Caio, Carla e Pedro e não aparece para Fábio, Hugo e Gabriel (só com "Visualizar Relatórios do Seu Ministério"). Uma função com "Editar Próprio Cadastro" e "Visualizar Seu Ministério", sem permissão de enviar, também não vê o botão. | teste de componente |
| UX-26 | O seletor de célula de Caio oferece só C1 e C2. O formulário de Carla abre com C1 já escolhida e com a data e o horário sugeridos. O de Gabriel, com "Enviar Relatório de Qualquer Célula Visível", oferece C1 e C2, e não C3. | teste E2E |
| UX-27 | Quando Pedro edita R2, Diego e Hugo aparecem como participantes, com o aviso da T8. Depois de mudar só o tema e salvar, os dois continuam no relatório, e o seletor nunca os oferece. | teste E2E (critério da RN-09) |
| UX-28 | Em Ministérios, Pedro vê o estado vazio com "Ver membros do seu ministério", que leva a `/members`. Samuel vê a árvore a partir dele e de Magda. | teste E2E |
| UX-29 | Nenhum estado deste spec depende só de cor. O badge "Padrão" tem ícone e texto, com os tokens do P6, e "Meu Ministério" é texto. O contraste é de 4,5:1 para texto e de 3:1 para ícones, nos temas claro e escuro. | inspeção (axe, nos dois temas) |
| UX-30 | Nenhuma tela deste spec mostra mensagem técnica: nada de identificador de permissão, "row-level security", "42501" nem nome interno de função do banco. A recusa 42501 vira "Você não tem permissão para esta ação.". | teste de componente |
| UX-31 | Em 320 px e com zoom de 200%, os rótulos longos ("Enviar Relatório de Qualquer Célula Visível", "Visualizar Relatórios de Toda a Igreja"), a frase do Administrador e os nomes no menu quebram linha, sem corte, e nenhum botão estoura a largura. | inspeção + teste E2E (viewport) |
| UX-32 | O leitor de tela lê a dica de alcance junto com o seletor, anuncia "Seu acesso foi atualizado." como status, ignora o cadeado e anuncia "Ver permissões" com o estado (expandido ou não). | inspeção (leitor de tela) |

### Perguntas para o `architect` (dados e contrato)
Em cada uma, a tela tem um comportamento padrão (o mais conservador) se a resposta for "não".

- **AQ-1. Acesso de quem está logado numa chamada só** (RN-08, RN-23, UXD-11). Por exemplo, uma RPC `my_access()` que responde só sobre quem chama:
  - `member_id` (nulo sem cadastro), `role_id` e o nome da função;
  - as permissões efetivas (a Administrador recebe todas, inclusive as futuras, sem o atalho `isSystem` do front);
  - `sees_whole_church` e `sees_whole_church_reports`;
  - `can_submit_some_report`: se existe pelo menos uma célula ativa visível em que a pessoa pode enviar (RN-13);
  - `can_create_member`: "Criar Membro" e, sem poder atribuir funções, cobrir a função padrão (RN-19);
  - `can_assign_roles`.

  A tela relê isso ao voltar para a aba, ao navegar e depois de uma recusa 42501. Hoje o `AuthContext` faz três leituras, só no login.
  - *Padrão sem isso:* a tela calcula pelas permissões; não há a pré-checagem da RN-19 (a recusa vem ao salvar); e o botão "Novo relatório" depende de uma contagem feita pela tela.
- **AQ-2. Dados e gravação da tela de Funções:**
  - por função: `is_protected` (a Administrador), `is_default`, as permissões e `members_count` (membros não excluídos), só para quem tem "Visualizar Funções" ou "Gerenciar Funções" (RN-23);
  - uma gravação atômica (nome, descrição, permissões e "padrão", com a troca da padrão anterior), no lugar das quatro chamadas de hoje, que não são atômicas ("Problemas conhecidos");
  - uma exclusão que devolva os códigos da AQ-5.
  - *Padrão sem a contagem:* a confirmação abre primeiro, o bloqueio só aparece na recusa do servidor, e o card não mostra "N membros".
- **AQ-3. Função no cadastro de membro** (RN-18, UXD-12). Por exemplo, uma RPC `role_options(_member_id)` que devolve:
  - `current_role_name` (nulo quando quem chama não pode vê-lo);
  - `editable` e o motivo (`self`, `role_above` ou `no_permission`);
  - as opções que quem chama pode atribuir (`id`, nome, `is_default`).

  Sem `_member_id` (cadastro novo), devolve as opções ou, para quem não atribui funções, só a padrão. Confirmar também:
  - se a `members_view.role_id` de outras pessoas deve vir nula para quem não atribui funções (RN-23);
  - quem pode ler `roles` e `role_permissions` direto, já que a tela de Funções, o `MemberForm` e o `AuthContext` leem as duas tabelas hoje.
  - *Padrão sem isso:* a função de outra pessoa só aparece para quem tem "Atribuir Função aos Membros" ou "Gerenciar Funções", e as opções são filtradas pela tela, pela cobertura.
- **AQ-4. `cells_view.can_submit_report`** (RN-13, UXD-9). Uma coluna por linha, calculada pela mesma função que o banco usa para aceitar o lançamento. O seletor de célula filtra por ela, e o card de Células a usa no ícone "Novo relatório". Opcional: `is_mine` (quem chama é líder, timóteo ou anfitrião), para ordenar as próprias células primeiro.
  - *Padrão sem isso:* a tela repete a fórmula ("Editar Célula" ou "Enviar Relatório de Qualquer Célula Visível"; ou "Enviar Relatório das Próprias Células" e a pessoa ser líder, timóteo ou anfitrião), com `leader_id`, `timothy_id` e `host_id`.
- **AQ-5. Erros com código e detalhes**, além do texto, como na AQ-2 do E2.01, para a tela escolher entre o campo e o `Alert`:
  - `person_not_visible`, com o campo e o `member_id`;
  - `pastor_or_no_leadership_requires_church`;
  - `report_submit_not_allowed`;
  - `would_leave_scope` (RN-09 c), com a entidade;
  - `default_role_not_covered`;
  - `own_role`, `role_change_not_allowed` e `role_not_assignable`;
  - `admin_role_protected`, com a operação (alterar, excluir ou marcar como padrão);
  - `role_is_default` e `role_in_use`, com a contagem.
  - *Padrão sem isso:* o texto aparece como veio, no `Alert` do topo, sem marcar o campo.
- **AQ-6. Edição que não altera nenhuma linha** (RN-09 a). Hoje o `update().eq()` de `members`, `cells` e `cell_reports` responde sucesso quando o registro não está visível (o RLS filtra em silêncio), e o formulário mostra "… atualizado com sucesso" sem ter gravado nada. A gravação precisa devolver a linha (ou passar por RPC), para a tela mostrar "… não existe ou já foi excluído.". Talvez já resolvido pelas RPCs do E2.01. É obrigatório para a UX-22.
- **AQ-7. Participantes do relatório** (RN-09 b):
  - a gravação precisa ser pela diferença, para só os participantes novos passarem pela conferência. Hoje o formulário apaga e regrava todos, o que recusaria Diego e Hugo quando Pedro edita R2 (critério da RN-09). A regravação já é obrigatória pelo E2.01;
  - para o aviso da T8, uma coluna como `member_visible` na `cell_report_participants_view`.
  - *Padrão sem a coluna:* sem o aviso, com os chips normais.
- **AQ-8. Cadastro que já está sem liderança, editado por quem vê só o ministério** (PO-UX-7). Salvar sem mexer na liderança deve ser aceito (não é "marcar"), e escolher um líder visível também. Confirmar que a regra compara o valor antigo com o novo.
- **AQ-9. `has_leadership`.** Com o interruptor escondido para quem vê só o ministério (UXD-3), a tela envia `has_leadership = true` junto com o líder. Confirmar como o banco mantém as duas colunas coerentes. Se o E2.04 ou o E2.06 derivarem `has_leadership`, a tela deixa de enviá-la.
- **AQ-10. Ministérios até o E2.15.** Confirmar que a `ministry_tree_nodes` devolve uma lista vazia, sem erro, para quem vê só o ministério e não é pastor. O estado vazio da T10 depende disso.
- **AQ-11. Dashboard sem acesso** (RN-07). Confirmar que as RPCs do Dashboard recusam com 42501 a conta sem cadastro e o membro sem função, em vez de devolver zeros. A tela distingue os dois casos pelo `member` nulo ou pelo `role_id` nulo.

### Pendências para o PO (resolvidas em 2026-11-23)
Nenhuma bloqueava o desenho. O PO resolveu todas em 2026-11-23 e registrou as decisões em "Negócio > Decisões > Padrões definidos por este spec" (P-PER-17 a P-PER-29), nas RNs, nos critérios e em "Textos de tela". **Revisar no PR.** Na UX, só para refletir as decisões, foram ajustados: "O que muda, tela a tela" (Dashboard), UXD-10, a nota e a dica da Auditoria na T3, o texto "Sem permissões" na T2, os subtítulos na T8 e na T9, o P10, a tabela de Textos e os critérios UX-12 e UX-14. O `ux-designer` pode revisar esses ajustes.

- **PO-UX-1. Dicas das permissões.** O Negócio deu só a dica de "Enviar Relatório das Próprias Células". A UX escreveu as demais a partir das RNs, sem regra nova (tabela de Textos):
  - "Visualizar Seu Ministério" (RN-01), "Editar Próprio Cadastro" (RN-11) e "Editar Célula" (RN-13 b), que são as menos óbvias;
  - "Gerenciar Funções" (restaurar excluídos, E2.01);
  - "Atribuir Função aos Membros" (RN-18);
  - a nota "Todas as permissões valem só para o que a pessoa vê." (RN-09).
  - *Adotado.*
  - ***Resolvida (PO):** aceito (P-PER-17). As dicas conferem com as RNs. A nota geral virou "Fora a Auditoria, todas as permissões valem só para o que a pessoa vê.", por causa da PO-UX-2. A RN-22 cita as dicas, e a tabela de Rótulos aponta para a tabela de Textos da UX.*
- **PO-UX-2. "Visualizar Auditoria" na tela de Funções.** Hoje a permissão não está na lista de checkboxes e aparece nos badges com o identificador técnico. A UX a incluiu no grupo "Funções e auditoria", com o rótulo que o próprio spec já usa ("Visualizar Auditoria", em Fora de escopo). Assim ela pode ser dada a outra função.
  - *Alternativa:* deixá-la fora da tela, só para a Administrador.
  - *Adotado:* na tela.
  - ***Resolvida (PO):** aceito, com uma dica que deixa o alcance claro: "As alterações feitas em toda a igreja, sem limite de ministério." (P-PER-18). Fora da tela, a permissão sumiria em silêncio de qualquer função editada na tela, porque o formulário regrava a lista inteira. Como a Auditoria não segue o escopo, a RN-02 passou a dizer que ela é a única exceção. A RN-22 e a tabela de Rótulos ganharam a permissão, e a RN-22 ganhou um critério.*
- **PO-UX-3. Sempre existe uma função padrão** (UXD-8). A tela não deixa desligar "Função padrão" na função que já é a padrão; para trocar, marca-se outra. A RN-19 pressupõe uma padrão, mas não proíbe ficar sem nenhuma.
  - *Adotado.*
  - ***Resolvida (PO):** aceito, e vale também pela API (P-PER-19). A RN-19 passou a dizer "existe sempre exatamente uma função padrão", com a troca na mesma operação. Ela ganhou dois critérios, e os textos entraram em "Textos de tela".*
- **PO-UX-4. Mensagem da RN-09 (c).** O Negócio não tem texto para a gravação que tiraria o registro do que a pessoa vê (por exemplo, Pedro tirar Caio de anfitrião de C2, ou desfazer o vínculo de cônjuge que tornava um cadastro visível). A UX propôs os textos da T11.
  - *Adotado.*
  - ***Resolvida (PO):** aceito (P-PER-20). A RN-09 (c) cita a mensagem. Os dois textos entraram em "Textos de tela", e a RN-09 ganhou dois critérios: Pedro apaga o anfitrião de C2, e André tira o cônjuge de Beatriz.*
- **PO-UX-5. Função de outro membro só para quem atribui funções** (UXD-12). Pela RN-23, o nome da função de outra pessoa revela as permissões dela. Hoje qualquer editor o vê.
  - *Adotado:* a função de outra pessoa só aparece para quem tem "Atribuir Função aos Membros" ou "Gerenciar Funções". No próprio cadastro, sempre aparece.
  - *Alternativa:* mostrar a todos que editam o cadastro, como hoje.
  - ***Resolvida (PO):** adotado, e vale também pela API (P-PER-21). A RN-23 passou a dizer isso, com critérios para Pedro, Rita e Caio. Como fazer na `members_view` e nas leituras de `roles` é a AQ-3, do `architect`.*
- **PO-UX-6. Líder preenchido com quem cadastra** (UXD-3). O legado fazia isso para todos (`UI/pages/Members/details.js:92`). A UX adotou só para quem vê só o ministério, que sempre tem de escolher um líder. Para quem vê a igreja toda, o formulário fica como hoje, porque a secretaria cadastra pessoas de qualquer ministério e o E2.04 cuida da MEM-07.
  - *Adotado.*
  - ***Resolvida (PO):** aceito (P-PER-22). É a MEM-15 antecipada para quem vê só o ministério. A RN-10 passou a dizer isso e ganhou um critério. Estender a todos fica com o E2.07, dono da MEM-15 (Fora de escopo e Impactos).*
- **PO-UX-7. Cadastro que já está sem liderança, editado por quem vê só o ministério** (o cônjuge, RN-06). A RN-10 fala em "marcar" alguém como sem liderança. A UX entende que salvar outros campos, sem mexer na liderança, não é "marcar", pela RN-09 (b) ("as pessoas que já estavam no registro e não mudaram ficam como estão"). Também entende que escolher um líder visível é aceito.
  - *Adotado.* Ver AQ-8.
  - ***Resolvida (PO):** aceito (P-PER-23). A RN-10 passou a dizer que "manter a marca como está não é marcar", que se editam os outros campos de um pastor ou de quem já está sem liderança, e que se pode dar um líder visível a quem está sem liderança. Desmarcar "pastor" continua exigindo ver a igreja toda. Critérios novos: Samuel edita Magda; Diego edita Ester depois do casamento dos dois.*
- **PO-UX-8. Retirar um participante que a pessoa não vê, na edição do relatório.** A RN-09 limita a escolha de participantes novos, mas não diz nada sobre a retirada. Retirá-lo não tem volta para quem edita, porque ele não consegue incluí-lo de novo.
  - *Adotado:* a retirada é permitida, com o aviso da T8.
  - *Alternativa:* travar esses participantes, como os excluídos do E2.01 (UXD-8 de lá).
  - ***Resolvida (PO):** aceito, com a fronteira explícita (P-PER-24). A RN-09 ganhou a regra "retirar não é escolher": quem grava pode tirar do registro uma pessoa que não vê, e só a pessoa que entra precisa estar visível. São dois casos diferentes:*
    - *participante **invisível** (de outro ministério): pode ser retirado por quem edita o relatório, e quem vê essa pessoa pode incluí-la de novo. A perda é recuperável;*
    - *participante **excluído**: segue a RN-13 do E2.01 (P-DEL-18). Ninguém o retira, nem pela API, porque ninguém poderia incluí-lo de novo (RN-06 do E2.01). A perda seria definitiva.*

    *Quando o participante é ao mesmo tempo invisível e excluído, vale a regra do excluído. A RN-09 ganhou critérios para os dois casos (Hugo em R2; Gabriel excluído em R1), e o aviso entrou em "Textos de tela". Em "Impactos", o E2.11 grava os participantes pela diferença (AQ-7).*
- **PO-UX-9. Atalho "Novo relatório" no Dashboard** (UXD-10). Não estava na lista do PO para o Dashboard. Ele leva o envio do relatório a 2 toques a partir da tela inicial, para os anfitriões e membros que passam a enviar pela D3.
  - *Adotado como proposta.* Pode sair sem afetar o resto (a UX-14 é condicional).
  - *Alternativa:* um item "Enviar relatório" no menu, como o "Registrar Relatório" do legado (3 toques).
  - ***Resolvida (PO):** aceito (P-PER-25). O envio do relatório é o fluxo mais frequente, e a D3 traz anfitriões que usam pouco o sistema. A RN-22 e a RN-13 passaram a citar o atalho, com um critério na RN-22. A UX-14 deixou de ser condicional, e a UXD-10 e a T9 deixaram de chamá-lo de proposta.*
- **PO-UX-10. Relatórios no menu para quem só pode enviar.** A RN-22 diz que o menu segue as permissões, mas não diz qual permissão abre Relatórios. Uma função com "Enviar Relatório das Próprias Células" e sem nenhuma permissão de visualização vê as próprias células e relatórios (RN-02 d). Sem o item no menu, essa pessoa não acha o formulário. Nas funções semeadas, nada muda, porque todas têm "Visualizar Seu Ministério".
  - *Adotado:* Relatórios aparece também com "Enviar Relatório das Próprias Células", "Enviar Relatório de Qualquer Célula Visível" ou "Editar Célula".
  - ***Resolvida (PO):** aceito (P-PER-26). A RN-22 passou a listar a permissão que abre cada item do menu, igual à tabela de Navegação e rotas, e ganhou um critério (Hugo com uma função que só envia relatório). A RN-13 cita o caminho.*
- **PO-UX-11. Textos definidos pela UX** (marcados com † em Textos):
  - os subtítulos com o alcance;
  - "Seu acesso foi atualizado." e "Você não tem acesso a esta tela.";
  - a orientação do Dashboard para quem não tem função ou cadastro;
  - "Meus dados" e "Ver meus dados";
  - as dicas de Cônjuge, de célula e de participantes;
  - "Escolha o líder.";
  - os textos da função padrão;
  - a confirmação de exclusão de função;
  - "Sem função" e "Sem permissões…".
  - *Adotados.*
  - ***Resolvida (PO):** todos aceitos (P-PER-27), com um ajuste: "Sem permissões…" passou a citar também os relatórios das células da pessoa, como diz a RN-02 (d). Os textos ligados a uma regra (subtítulos, Dashboard sem acesso, acesso atualizado, menu, "Escolha o líder.", função padrão e "Sem permissões") foram copiados para os "Textos de tela" do Negócio. Os demais ficam só na tabela de Textos da UX.*
- **PO-UX-12. A função da pessoa embaixo do nome, no menu** (UXD-14). É sobre a própria pessoa, então não esbarra na RN-23.
  - *Adotado.*
  - ***Resolvida (PO):** aceito (P-PER-28). A RN-23 passou a dizer que a pessoa sempre vê a própria função, no menu e em Meus dados, e ganhou um critério.*
- **PO-UX-13. Dashboard de uma função com "Visualizar Dashboard" e sem permissão de visualização** (ciência). Essa pessoa só vê o que a RN-02 (d) libera, mas, pela RN-22, o subtítulo diz "Visão do seu ministério". A UX seguiu a regra ao pé da letra.
  - ***Resolvida (PO): a regra muda** (P-PER-29). O subtítulo não pode afirmar um alcance que a pessoa não tem. Sem "Visualizar Toda a Igreja" e sem "Visualizar Seu Ministério", o Dashboard não mostra subtítulo nem selo. Do mesmo jeito, quem chega a Relatórios só por uma permissão de enviar (PO-UX-10) não vê subtítulo de alcance. A RN-22 e o critério dela foram ajustados. Na UX, a T8, a T9, o P10 e a UX-12 foram ajustados.*

## Solução técnica
_Seção do `architect`. Escrita em 2026-11-23, só como desenho: nada foi implementado. **A implementação começa depois de todo o E2.01 em produção** (PRs 1 a 6). O desenho parte do estado final do E2.01 (DT-01 a DT-28), conferido nas migrations `20261123233100` a `20261123233400` da branch `feat/E2.01-pr1-banco`, que ainda estão em implementação. Se os nomes ou as assinaturas usados aqui mudarem lá, a tarefa 1 volta ao `architect`._

_Conferido em 2026-11-23, só com consultas de leitura, na stack local `supabase_db_mci-e108-pr2` (E1.08 completo e as quatro migrations do PR 1 do E2.01 aplicadas):_
- _funções e corpos (`pg_proc`), políticas (`pg_policies`), triggers, views, enums e privilégios de tabela e de coluna;_
- _custo da subida por id (2 ms) e da descida com `UNION` na massa local;_
- _subconsulta recursiva correlacionada dentro de uma view (usada no G12 da `cells_view`)._

_O front e as Edge Functions foram lidos na `origin/main` (`47c6324`)._

### Revisão das regras
Nenhuma RN precisou voltar ao PO. As lacunas técnicas foram resolvidas pela leitura mais conservadora e estão em [Definidas pelo architect](#definidas-pelo-architect-revisar-no-pr).

Casos de borda conferidos:
- **Fuso e virada de semana:** o escopo não depende de data. A única regra com data é a da DA-5: quem só envia relatório inclui participantes só em relatório da semana de `sp_today()`. Uma inclusão feita depois da meia-noite de sábado, num relatório lançado antes, é recusada (42501). Isso some no E2.11, que grava tudo numa chamada só.
- **Casal:**
  - o cônjuge de quem consulta é o `spouse_id` do próprio cadastro;
  - o cônjuge do G12 é o `spouse_id` do G12;
  - os efeitos do trigger de simetria seguem a DA-4.
- **Inativo:** quem é âncora continua âncora, e a descida passa por inativos (RN-01). A árvore de Ministérios continua mostrando só ativos (MIN-03, sem mudança).
- **Sem líder:** é o topo da própria cadeia, e por isso não tem G12. O escopo dessa pessoa é ela, o cônjuge e a descendência dos dois (RN-06). Ninguém a vê, a não ser o cônjuge e quem vê a igreja toda.
- **Pastor:** é topo e não tem G12. Com "Visualizar Seu Ministério", vê a si, o cônjuge e a descendência dos dois, ou seja, a árvore inteira (RN-05).
- **Consolidado:** a flag futura entra nas views, como no E1.08. A descida pela árvore não precisa mudar.
- **Concorrência e volume:** ver [Bloqueios e concorrência](#bloqueios-e-concorrência) e [Riscos](#riscos-concorrência-escala-segurança).

Leituras técnicas. Nenhuma muda regra, mas o PO e o QA precisam saber delas:
1. **Critério da RN-10, "Diego tira o líder de Caio".**
   - Caio não está no escopo de Diego (tabela "O que cada um vê"). O PATCH volta com 0 linhas (RN-09 a), e não com a mensagem da RN-10.
   - O teste usa Hugo, discípulo de Tiago, que Diego vê.
   - Sugestão ao PO: trocar Caio por Hugo no critério.
2. **Critério da RN-13, "Pedro lança C1 com Débora".**
   - Até o E2.11, o relatório e os participantes são duas gravações (DT-15 do E2.01). A recusa vale para os participantes, e o relatório fica gravado sem eles.
   - Pela tela isso não acontece, porque o seletor não oferece Débora. O E2.11 torna o lançamento atômico.
3. **"Pela API" na tela de Funções (RN-17, RN-19, RN-20).**
   - As mensagens vêm das RPCs `save_role` e `delete_role` e dos triggers de `roles` e `role_permissions`.
   - Até o PR 6, a escrita direta nas tabelas recebe as mesmas mensagens, pelos triggers. Depois do PR 6, ela é fechada por privilégio (42501).
4. **"Nada muda" num PATCH** é o mesmo do E2.01 (leitura técnica 1): 0 linhas, sem erro.
5. **Pastor com líder.**
   - "Ficam de fora os pastores" (RN-01) é consequência da árvore, e não um filtro: um pastor com `leader_id` preenchido (dado incoerente) entra no escopo de quem está acima dele.
   - Este passo impede que quem vê só o ministério crie esse estado (DA-2). Proibi-lo para todos é do E2.04 (MEM-07).
   - A tarefa 1 confere a produção.
6. **`g12_level` desatualizado.** O escopo deixa de depender dele (P-PER-01). Ele ainda afeta o ranking G12 do Dashboard (`g12_level = 1`) e o nível exibido, que ficam para o E2.06 e o E2.14. O G12 das células passa a vir da árvore real (DT-25).
7. **RN-09 com a função de criação de usuário.** "Nenhuma conta de acesso fica criada" é garantido antes de criar a conta: a `create-user-admin` ensaia o cadastro no banco, com a sessão de quem chama (DT-21). O desfazimento que já existe continua para as corridas.

#### Definidas pelo architect (revisar no PR)
Pontos que as RNs não respondem por inteiro. O `architect` adotou a leitura mais conservadora e coerente com as RNs. O usuário pode mudar qualquer um no PR.

| # | Ponto | Padrão adotado | Por quê |
|---|---|---|---|
| DA-1 | Critério da RN-10 com Caio para Diego | O teste usa Hugo. Caio fora do escopo dá "nada muda" (0 linhas). | Leitura técnica 1. A regra não muda. |
| DA-2 | Líder de um pastor | Quem vê só o ministério não troca nem preenche o líder de um pastor. A recusa usa a mensagem da RN-10. | A UX esconde o campo Líder no cadastro do pastor (T6). Sem a regra, a API criaria o estado incoerente da leitura técnica 5. |
| DA-3 | Permissões que entram numa função | Quem salva a função só acrescenta permissões que tem. Retirar é livre. A Administrador tem todas e não muda. | Sem isso, quem tem "Gerenciar Funções" e vê só o ministério daria "Visualizar Toda a Igreja" à própria função. É a mesma ideia de "cobrir a função" da RN-18. |
| DA-4 | Efeitos do trigger de cônjuge | Ao trocar ou tirar o cônjuge de um registro visível, o vínculo do outro lado é desfeito mesmo se esse outro lado for invisível ("retirar não é escolher"). A RN-09 (c) é conferida no registro gravado. | A simetria do cônjuge é uma relação só. Os dois critérios da RN-09 continuam passando (André e Beatriz). |
| DA-5 | Participantes gravados por quem só envia relatório (sem "Editar Relatórios de Células") | Inclui participantes só em relatório da semana atual de uma célula em que pode enviar. Retirar participante exige "Editar Relatórios de Células". | Até o E2.11, lançar é inserir o relatório e depois os participantes, em duas chamadas. Sem limite, quem lançou editaria os participantes de relatórios antigos, contra a RN-14. |
| DA-6 | Árvore de Ministérios (P-PER-15) | A raiz passa a ser o topo do escopo **neste passo**. Com "Visualizar Toda a Igreja", a raiz são os pastores, como hoje. Sem ela, é o casal G12 de quem consulta ou, sem G12, o próprio casal. | É uma mudança pequena (só o ramo de raízes da `ministry_tree_nodes`, como o E1.08 previu). Ela tira a dependência de publicação com o E2.15 e evita a regressão para a função Líder. **O PO decide no aceite se o E2.15 (MIN-02) fecha junto.** |
| DA-7 | Restaurar (E2.01) um membro cujo líder foi excluído | Quem não vê a igreja toda não restaura esse membro, porque ele voltaria sem liderança e sairia do que a pessoa vê. A recusa usa a mensagem da RN-10. | RN-10 e RN-09 (c). A DA-3 do E2.01 restaura sem líder. |
| DA-8 | Último administrador sob corrida (RN-21) | "Não é possível tirar a função Administrador do último administrador." (mensagem técnica, `last_admin`) | Dois administradores que tiram a função um do outro ao mesmo tempo ficariam sem nenhum. A tela nunca provoca essa recusa. |
| DA-9 | Quem lê `roles` e `role_permissions` direto | Só com "Visualizar Funções" ou "Gerenciar Funções" (PR 6). A própria função vem de `my_access()`, e as opções do cadastro, de `role_options()`. | RN-23 e AQ-3. A definição das funções não é segredo, mas ninguém mais precisa dela. |
| DA-10 | Cadastro sem função | Quem atribui funções pode cadastrar sem função, como no E1.03. Quem não atribui cadastra sempre com a função padrão, que o banco preenche se vier vazia. | RN-19. A exceção do E1.03 ("dar a função padrão a quem não tem função é livre") sai, porque contraria a RN-18. |
| DA-11 | "Tem Liderança?" com líder preenchido | O banco liga `has_leadership` sempre que há líder. A migration corrige os cadastros com líder e com a chave desligada. | AQ-9. "Sem liderança" é "sem líder e não é pastor" (RN-06). Desligar a chave sem tirar o líder não marcava nada. |
| DA-12 | Relatórios no item (d) da RN-02 | São os relatórios das células em que a pessoa é **hoje** líder, timóteo ou anfitrião. O E2.11 revisa junto com o registro do relatório (RN-04). | É o texto da RN-02 (d). Até o E2.11, coincide com a RN-04. |

### Visão geral
Cinco partes, no padrão do E1.08 e do E2.01:

1. **Escopo pela árvore real (RN-01, RN-05, RN-06).**
   - Uma definição só das **âncoras**: quem consulta, o cônjuge, o G12 (quem está logo abaixo do topo na cadeia de `leader_id`) e o cônjuge do G12.
   - Duas formas de percorrer, com teste de equivalência:
     - a descida em conjunto, para as views;
     - a subida por id, para as políticas e os triggers.
   - Nenhuma das duas usa `g12_level`.
2. **Leitura (RN-02 a RN-04, RN-15, RN-22, RN-23).**
   - As quatro views do E1.08, as três views de excluídos do E2.01 e as políticas mudam juntas.
   - "Visualizar Relatórios do Seu Ministério" passa a valer.
   - As permissões aposentadas deixam de liberar qualquer coisa.
   - As funções que aceitavam o id de qualquer pessoa saem do alcance de quem está logado (PR 1), e a função de outra pessoa fica escondida (PR 6).
3. **Escrita (RN-09 a RN-14, RN-18, RN-19, RN-21).**
   - Triggers `BEFORE` conferem as pessoas escolhidas e a regra de pastor e sem liderança.
   - Um trigger `AFTER` confere que o cadastro continua visível.
   - O lançamento de relatório confere quem lança, pela mesma função que alimenta a tela.
   - A `create-user-admin` ensaia o cadastro antes de criar a conta.
4. **Funções (RN-16, RN-17, RN-19, RN-20, RN-22).**
   - A Administrador tem todas as permissões por `is_system`, inclusive as futuras, e não pode ser alterada.
   - Existe sempre exatamente uma função padrão.
   - A exclusão é bloqueada quando a função está em uso.
   - A gravação é atômica, por RPC.
5. **Front (RN-08, RN-22, AQ-1 a AQ-11).**
   - Uma chamada só (`my_access()`) diz o que a pessoa pode fazer. Ela é relida ao voltar para a aba, ao navegar e depois de um 42501.
   - Sai o atalho `isSystem`.
   - As telas seguem a UX (T1 a T12).

### Modelo de dados e migrations

#### Ordem das migrations
Os nomes são sugestões; o timestamp é o do momento da criação.
- Cada arquivo é idempotente (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP … IF EXISTS` antes de `CREATE POLICY` e `CREATE TRIGGER`, `DO` com guarda) e roda num banco zerado depois das migrations existentes.
- Depois de cada PR com migration, regenere o `types.ts`.

| # | PR | Arquivo | Conteúdo | Por que separado |
|---|---|---|---|---|
| 1 | 1 | `<ts>_e202_01_data.sql` | Funções semeadas (RN-16), Administrador com todas as linhas, permissões aposentadas convertidas (RN-22), Membro como padrão, `has_leadership` coerente (DA-11) | Dados antes dos triggers que protegem as funções. Falha cedo, sem mudar nada, se houver mais de uma função `is_system`. |
| 2 | 1 | `<ts>_e202_02_scope.sql` | Âncoras, descida, subida e funções de linha; permissões efetivas e atalho `is_system`; `user_has_permission` e `is_admin` restritas; `viewer_covers_role`, `can_assign_role`, `can_submit_report`, `default_role_id`, `active_permissions`, `viewer_tree_roots`; índice e constraints de `roles` e o índice de `members(role_id)` | As regras de escopo, sem ainda mudar quem as usa |
| 3 | 1 | `<ts>_e202_03_read.sql` | Views (as 4 do E1.08, as 3 de excluídos e `roles_view`), políticas de todas as tabelas, `member_names`, `ministry_tree_nodes`, `_dashboard_assert_access`, `my_access`, `role_options`, REVOKE das funções com id de usuário, DROP das obsoletas | Revisão da leitura separada da escrita, como no E2.01 |
| 4 | 1 | `<ts>_e202_04_write.sql` | Triggers de `members`, `cells`, `cell_reports`, participantes, `roles` e `role_permissions`; RPCs `save_role`, `delete_role` e `check_member_insert`; ajustes em `set_cell_report_participants` e `restore_member` (E2.01); grants | Idem |
| 5 | 6 | `<ts>_e202_05_close_roles.sql` | SELECT de `roles` e `role_permissions` só com "Visualizar Funções" ou "Gerenciar Funções"; sem escrita direta; `members_view.role_id` mascarado e REVOKE de `members.role_id` (RN-23) | Só depois do front que usa `my_access`, `role_options` e as RPCs de funções. O `MemberForm` atual exige a função ao salvar, então mascarar antes travaria a edição pela Líder (ver [Implantação](#implantação)) |

O PR 1 é compatível com o front em produção (ver [Implantação](#implantação)). O efeito visível dele é o próprio passo: cada pessoa passa a ver e gravar só no escopo novo.

#### Estrutura (migrations 2 e 4)
```sql
-- Uma só função Administrador, e ela nunca é a padrão (RN-17).
CREATE UNIQUE INDEX IF NOT EXISTS roles_single_system_idx ON public.roles (is_system) WHERE is_system;
-- Dentro de DO com guarda de duplicate_object:
ALTER TABLE public.roles ADD CONSTRAINT roles_system_not_default CHECK (NOT (is_system AND is_default));
-- idx_roles_single_default (no máximo uma padrão) já existe. "Pelo menos uma" é o
-- constraint trigger adiado da migration 4 (RN-19).

-- Contagem de membros por função (roles_view, delete_role, RN-20) e o ON DELETE SET NULL.
CREATE INDEX IF NOT EXISTS members_role_id_idx ON public.members (role_id) WHERE deleted_at IS NULL;
```
Nenhuma coluna nova em tabela. `members.role_id` continua `ON DELETE SET NULL`: só membros excluídos podem ter a função apagada (RN-20), e a restauração deles segue a DA-2 do E2.01.

#### Dados (migration 1)
- **Administrador:** a única função `is_system`.
  - Se não houver nenhuma, a migration cria "Administrador". Se houver mais de uma, ela falha com a lista, sem mudar nada.
  - Descrição: "Acesso total ao sistema, em toda a igreja.".
  - Linhas em `role_permissions` com todas as permissões ativas, só como documentação: o atalho `is_system` é que vale (DT-09).
- **Líder e Membro**, por nome (`roles_name_key` é único). Cada uma é criada se faltar, e recebe a descrição e **exatamente** as permissões da tabela [Funções semeadas](#funções-semeadas-rn-16): as que faltam entram, e as demais saem.
- **Membro como padrão.** Primeiro, desmarca a padrão atual se não for a Membro, e depois marca a Membro, por causa do índice único.
- **Permissões aposentadas (RN-22)**, nas demais funções:
  - `view_members` vira `view_all_church`;
  - `view_own_ministry_dashboard` vira `view_dashboard`;
  - as linhas antigas são apagadas.
- **`has_leadership` (DA-11):** `UPDATE members SET has_leadership = true WHERE leader_id IS NOT NULL AND NOT has_leadership`. A conferência da tarefa 1 diz quantos são.

### Escopo (migration 2)
Salvo indicação, as funções são `STABLE SECURITY DEFINER SET search_path = public`. As novas não recebem id de usuário: quem consulta é sempre `auth.uid()`, por `viewer_member_id()`, que já ignora o cadastro excluído (E2.01). As duas que ainda recebem (`user_has_permission` e `is_admin`) ficam só para a service role (DT-11).

#### Âncoras e as duas formas de percorrer
```sql
-- Âncoras do escopo (RN-01): eu, meu cônjuge, meu G12 e o cônjuge do G12.
-- G12 = quem está logo abaixo do topo (sem líder) na minha cadeia de leader_id.
-- Sou o topo (pastor ou sem liderança): sem G12. A cadeia não chega a um topo
-- (ciclo, até o E2.06): sem G12. Interna: sem EXECUTE para authenticated.
CREATE OR REPLACE FUNCTION public._viewer_scope_anchors()
RETURNS TABLE (me uuid, me_spouse uuid, g12 uuid, g12_spouse uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE
  self AS (SELECT m.id, m.spouse_id FROM public.members m WHERE m.id = public.viewer_member_id()),
  up AS (
    SELECT m.id, m.leader_id, ARRAY[m.id] AS path FROM public.members m JOIN self ON m.id = self.id
    UNION ALL
    SELECT l.id, l.leader_id, up.path || l.id
      FROM up JOIN public.members l ON l.id = up.leader_id
     WHERE NOT l.id = ANY (up.path)                      -- ciclo: para
  ),
  g12 AS (
    SELECT g.id, g.spouse_id
      FROM up
      JOIN public.members top ON top.id = up.leader_id AND top.leader_id IS NULL
      JOIN public.members g   ON g.id = up.id
     LIMIT 1
  )
  SELECT self.id, self.spouse_id, g12.id, g12.spouse_id FROM self LEFT JOIN g12 ON true
$$;

-- Forma em conjunto (views): âncoras + toda a descendência. O UNION descarta
-- repetidos, então termina em ciclos e quando uma âncora está abaixo de outra.
-- Vazia sem "Visualizar Seu Ministério" e sem "Visualizar Relatórios do Seu
-- Ministério" (DT-28): ninguém lista o próprio escopo sem poder vê-lo.
CREATE OR REPLACE FUNCTION public.viewer_ministry_member_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE tree(id) AS (
    SELECT x
      FROM public._viewer_scope_anchors() a,
           unnest(ARRAY[a.me, a.me_spouse, a.g12, a.g12_spouse]) AS x
     WHERE x IS NOT NULL
       AND (public.viewer_has('view_own_ministry') OR public.viewer_has('view_own_reports'))
    UNION
    SELECT c.id FROM tree t JOIN public.members c ON c.leader_id = t.id
  )
  SELECT id FROM tree
$$;

-- Forma por id (políticas e triggers): sobe de cada id até o topo e procura uma
-- âncora no caminho. O(profundidade), sem montar o escopo inteiro.
CREATE OR REPLACE FUNCTION public.viewer_scope_contains_any(_member_ids uuid[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE
  a AS (SELECT array_remove(ARRAY[x.me, x.me_spouse, x.g12, x.g12_spouse], NULL) AS ids
          FROM public._viewer_scope_anchors() x),
  up AS (
    SELECT m.id, m.leader_id, ARRAY[m.id] AS path FROM public.members m WHERE m.id = ANY (_member_ids)
    UNION ALL
    SELECT l.id, l.leader_id, up.path || l.id
      FROM up JOIN public.members l ON l.id = up.leader_id
     WHERE NOT l.id = ANY (up.path)
  )
  SELECT (public.viewer_has('view_own_ministry') OR public.viewer_has('view_own_reports'))
     AND EXISTS (SELECT 1 FROM up, a WHERE up.id = ANY (a.ids))
$$;
```
- **Excluídos (DT-04 do E2.01):** as duas formas passam por membros excluídos. O filtro fica nas views e nas políticas, e o histórico mantém o escopo.
- **Equivalência:** para todo par (u, x) da massa, `x ∈ viewer_ministry_member_ids()` (logado como u) se e só se `viewer_scope_contains_any(ARRAY[x])`. A massa do teste inclui ciclo, âncora abaixo de outra âncora, cônjuge assimétrico e inativo.
- **Índices:** a descida usa `members_leader_id_idx`, e a subida usa a chave primária. Os dois já existem.

#### Permissões efetivas e o atalho da Administrador (RN-17, RN-22)
```sql
-- As permissões que valem: o enum menos as aposentadas. Lista única (DT-10).
CREATE OR REPLACE FUNCTION public.active_permissions()
RETURNS public.permission_action[] LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT array_agg(p ORDER BY p)
    FROM unnest(enum_range(NULL::public.permission_action)) AS p
   WHERE p NOT IN ('view_members', 'view_own_ministry_dashboard')
$$;

-- Restrita a quem consulta quando há usuário logado (RN-23). Sem usuário
-- (service role, migrations), responde sobre qualquer um. EXECUTE só para service_role.
CREATE OR REPLACE FUNCTION public.user_has_permission(_user_id uuid, _permission public.permission_action)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (auth.uid() IS NULL OR _user_id = auth.uid())
     AND _permission = ANY (public.active_permissions())
     AND EXISTS (
       SELECT 1 FROM public.members m JOIN public.roles r ON r.id = m.role_id
        WHERE m.auth_user_id = _user_id AND m.deleted_at IS NULL
          AND (r.is_system OR EXISTS (SELECT 1 FROM public.role_permissions rp
                                       WHERE rp.role_id = r.id AND rp.permission = _permission)))
$$;
```
- `viewer_has(p)` continua `auth.uid() IS NOT NULL AND user_has_permission(auth.uid(), p)` e é a única porta para as políticas, as views, os triggers e as RPCs.
- `role_effective_permissions(_role_id)` (interna): todas as ativas para `is_system`, senão as linhas da função que estão ativas.
- `viewer_permissions()` (interna): as efetivas da função de quem consulta.
- `viewer_covers_role(_role_id)` (E2.01, reescrita): `viewer_member_id() IS NOT NULL AND NOT EXISTS (efetivas da função EXCEPT viewer_permissions())`. Só a Administrador cobre a Administrador. Uma função nula é coberta por todos.
- `can_assign_role(_role_id)` (reescrita): `(viewer_has('assign_role') OR viewer_has('manage_roles')) AND viewer_covers_role(_role_id)`.
- `is_admin(_user_id)`: `user_has_permission(_user_id, 'manage_roles')`, com EXECUTE só para `service_role`. Fica para a `change-member-password` até o E2.03.
- `default_role_id()`: o id da função padrão, lido sem RLS. O trigger de `members` deixa de ler `roles` com o papel de quem grava, o que quebraria no PR 6.
- `active_permissions()` e `default_role_id()` têm EXECUTE para `authenticated`, porque a `roles_view` e os triggers `SECURITY INVOKER` as chamam. Elas não revelam nada de ninguém.

#### Funções de linha (o que a pessoa vê, por id)
Todas são *definer* e têm EXECUTE só para `authenticated`. Elas respondem só sobre quem consulta, e só o que as views já mostram.

| Função | Verdadeira quando | Usada em |
|---|---|---|
| `viewer_sees_member(_member_id)` | o membro não está excluído e: `viewer_has('view_all_church')`; ou `viewer_has('view_own_ministry')` e `viewer_scope_contains_any(ARRAY[_member_id])`; ou é quem consulta | triggers (pessoa escolhida, RN-09 c), `role_options` |
| `viewer_sees_cell_people(_leader, _timothy, _host)` | `view_all_church`; ou `view_own_ministry` e alguma das três no escopo; ou quem consulta é uma das três | `viewer_sees_cell`, `can_submit_report`, trigger de célula (RN-09 c) |
| `viewer_sees_cell(_cell_id)` | a célula existe, não está excluída e `viewer_sees_cell_people(...)` | trigger de relatório |
| `cell_in_viewer_ministry(_cell_id)` (E2.01, **com o anfitrião**) | alguma pessoa da célula no escopo; não filtra célula excluída (RN-11 do E2.01) | política de `cell_reports` |
| `viewer_is_cell_person(_cell_id)` (**nova**, substitui `can_manage_own_cell`) | quem consulta é líder, timóteo **ou anfitrião** da célula | política de `cell_reports` (RN-02 d) |
| `can_submit_report(_cell_id)` (**nova**) | `viewer_sees_cell(_cell_id)` e (`edit_cell` ou `submit_any_visible_report` ou (`submit_own_cell_report` e é pessoa da célula)) (RN-13) | política e trigger de INSERT de relatório, participantes, `my_access` |
| `viewer_tree_roots()` (**nova**) | — devolve `uuid[]`: G12 e cônjuge do G12, ou, sem G12, eu e meu cônjuge | `ministry_tree_nodes` (DA-6) |

### Leitura (migration 3)

#### Predicados canônicos
O escopo de cada entidade aparece em três formas. As três são conferidas pelo mesmo teste de paridade, por persona da massa do spec.

| Entidade | Regra (RN-02 a RN-04) | View (em conjunto) | Política (por linha) |
|---|---|---|---|
| Membro | `church` ou (`ministry` e no escopo) ou é quem consulta | `m.id IN (SELECT viewer_ministry_member_ids())` | `viewer_scope_contains_any(ARRAY[id])` |
| Célula | `church` ou (`ministry` e alguma pessoa no escopo) ou quem consulta é pessoa da célula | `c.leader_id IN (…) OR c.timothy_id IN (…) OR c.host_id IN (…)` | `viewer_scope_contains_any(ARRAY[leader_id, timothy_id, host_id])` |
| Relatório | `view_all_reports` ou `church` ou ((`ministry` ou `view_own_reports`) e alguma pessoa da célula no escopo) ou quem consulta é pessoa da célula | idem, sobre `c.*` | `cell_in_viewer_ministry(cell_id)` e `viewer_is_cell_person(cell_id)` |
| Participante | o relatório é visível | junta `cell_reports_view` | `EXISTS` em `cell_reports`, que passa pelo RLS de `cell_reports` |

Convenções:
- `church` = `(SELECT viewer_has('view_all_church'))` e `ministry` = `(SELECT viewer_has('view_own_ministry'))`. Elas viram *InitPlan*, calculado uma vez por consulta.
- "Quem consulta" = `(SELECT viewer_member_id())`.
- Todas as formas terminam com `AND deleted_at IS NULL`, fora dos parênteses (E2.01).
- `view_members` e `view_own_ministry_dashboard` não aparecem em nenhum predicado.

#### Views
`CREATE OR REPLACE VIEW`, com as mesmas colunas na mesma ordem e as novas **no fim** (risco 5 do E1.08). Continuam *security definer* com `security_barrier`, donas `postgres` e só com SELECT para `authenticated`.

| View | Mudança |
|---|---|
| `members_view` | `WHERE` do predicado canônico; o próprio cadastro passa a ser `m.id = (SELECT viewer_member_id())`. Coluna nova no fim: `spouse_name` (o nome de referência do cônjuge, para o seletor, DT-23). Na migration 5 (PR 6), `role_id` passa a vir nulo, a não ser no próprio cadastro ou para quem tem `assign_role` ou `manage_roles` (RN-23). |
| `cells_view` | `WHERE` canônico, com o anfitrião no item (d). `g12_leader_id` e `g12_leader_name` passam a vir da árvore real, por uma subconsulta recursiva correlacionada no próprio SQL da view, sem chamar função (DT-25). Ela só é calculada quando a coluna é pedida. Colunas novas no fim: `can_submit_report` (mesma regra de `can_submit_report()`, AQ-4), `is_mine` (quem consulta é pessoa da célula) e `leader_is_pastor`. |
| `cell_reports_view` | `WHERE` canônico, com `view_own_reports` e o anfitrião. Nenhuma coluna nova. |
| `cell_report_participants_view` | Coluna nova no fim: `member_visible` (o participante está na `members_view` de quem consulta: não excluído e no predicado de membro; AQ-7). |
| `members_deleted_view`, `cells_deleted_view`, `cell_reports_deleted_view` (E2.01) | O mesmo predicado da view principal, sem `view_members` (RN-15). |
| `roles_view` (**nova**, AQ-2) | `id`, `name`, `description`, `is_protected` (`is_system`), `is_default`, `permissions permission_action[]` (efetivas, sem as aposentadas, na ordem do enum, calculadas no próprio SQL da view), `members_count` (membros não excluídos), `updated_at`. `WHERE (SELECT viewer_has('view_roles')) OR (SELECT viewer_has('manage_roles'))`. |

As RPCs do Dashboard e a `ministry_tree_nodes` leem só das views e herdam tudo, inclusive a RN-06 ("Sem liderança" para quem vê só o ministério).

#### Políticas de RLS
Todas trocam `user_has_permission(auth.uid(), …)` por `(SELECT viewer_has(…))`, porque `authenticated` perde o EXECUTE da primeira (DT-11).

| Tabela | SELECT | UPDATE (`USING` = `WITH CHECK`) | INSERT (`WITH CHECK`) | DELETE |
|---|---|---|---|---|
| `members` | membro canônico | ((`edit_member` e membro canônico) ou (`edit_own_data` e `id = viewer_member_id()`)) e não excluído | `create_member` e `deleted_at`/`deleted_by` nulos | — (E2.01) |
| `cells` | célula canônica | `edit_cell` e célula canônica (sai o ramo `edit_own_data`, RN-12) | `create_cell` e não excluída | — |
| `cell_reports` | relatório canônico | `edit_cell_report` e relatório canônico (RN-14) | `can_submit_report(cell_id)` e não excluído (RN-13) | — |
| `cell_report_participants` | `EXISTS (SELECT 1 FROM cell_reports r WHERE r.id = report_id)` | — | o mesmo `EXISTS`, com `r.deleted_at IS NULL AND ((SELECT viewer_has('edit_cell_report')) OR (can_submit_report(r.cell_id) AND week_start(r.date) = week_start(sp_today())))` (DA-5) | `(SELECT viewer_has('edit_cell_report'))` e o mesmo `EXISTS` |
| `roles`, `role_permissions` | PR 1: como no E2.01 (`viewer_member_id() IS NOT NULL`). PR 6: `view_roles` ou `manage_roles` (DA-9) | PR 1: `manage_roles` (troca `is_admin`). PR 6: sem política e sem privilégio | idem | idem |
| `events` | `(SELECT viewer_has('view_audit_log'))` | — | — | — |

Exemplo (as outras seguem o mesmo molde):
```sql
DROP POLICY IF EXISTS "Members view policy" ON public.members;
CREATE POLICY "Members view policy" ON public.members FOR SELECT TO authenticated
USING (
  (    (SELECT public.viewer_has('view_all_church'))
    OR ((SELECT public.viewer_has('view_own_ministry')) AND public.viewer_scope_contains_any(ARRAY[id]))
    OR id = (SELECT public.viewer_member_id()) )
  AND deleted_at IS NULL                 -- espelhado na members_view
);
```
- **Participantes delegam ao RLS de `cell_reports`** (DT-05). A subconsulta de uma política passa pelo RLS da tabela consultada, como a leitura técnica 2 do E2.01 já usa. A visibilidade do relatório fica num lugar só.
- **Por que a política não delega à view:** a leitura técnica 6 do E2.01 continua valendo. Uma política que lê a view recusa o `INSERT … RETURNING`.

#### Leituras para a tela (AQ-1, AQ-3) e ajustes de leitura
- **`my_access()`** (`STABLE SECURITY DEFINER`, EXECUTE para `authenticated`) sempre devolve uma linha, sobre quem chama:
  ```sql
  RETURNS TABLE (
    member_id uuid, role_id uuid, role_name text, role_is_protected boolean,
    permissions public.permission_action[],      -- efetivas: a Administrador recebe todas as ativas
    sees_whole_church boolean,                  -- view_all_church
    sees_ministry boolean,                      -- view_own_ministry
    sees_whole_church_reports boolean,          -- view_all_reports ou view_all_church
    sees_ministry_reports boolean,              -- view_own_reports ou view_own_ministry
    can_create_member boolean,                  -- create_member e (atribui funções ou cobre a padrão), RN-19
    can_assign_roles boolean,                   -- assign_role ou manage_roles
    can_submit_some_report boolean              -- EXISTS na cells_view: is_active e can_submit_report
  )
  ```
  - Sem cadastro, ou com o cadastro excluído: `member_id` nulo, tudo falso e `permissions = '{}'`.
  - Membro sem função: `role_id` nulo.
- **`role_options(_member_id uuid DEFAULT NULL) RETURNS jsonb`** (`STABLE SECURITY DEFINER`). Sem cadastro, 42501.
  ```json
  { "current": { "id": "…", "name": "Membro" } | null,
    "editable": true | false,
    "reason": "self" | "role_above" | "no_permission" | "not_found" | null,
    "options": [ { "id": "…", "name": "Líder", "is_default": false } ],
    "default_role": { "id": "…", "name": "Membro" } }
  ```
  - `options` são as funções que quem chama cobre, por nome, e só para quem tem `assign_role` ou `manage_roles`. Para os demais, a lista vem vazia.
  - **Cadastro novo** (sem `_member_id`): `editable` diz se quem chama atribui funções. Se não atribui, o motivo é `no_permission`, e a tela mostra a função padrão como texto.
  - **Cadastro existente**, por ordem:
    - membro que quem chama não vê: `not_found`, com `current` nulo;
    - o próprio cadastro: `self`, com `current` preenchido e `editable` falso;
    - quem chama não atribui funções: `no_permission`, com `current` nulo (RN-23);
    - quem chama não cobre a função atual: `role_above`, com `current` preenchido;
    - nos demais casos, `editable` verdadeiro.
- **`member_names(_ids)`**: os nomes dos ids que estão na `members_view` de quem consulta ou que são `leader_id` de alguma linha dela. É a regra do E1.13 sobre o escopo novo, lida da própria view, e ignora excluídos (E2.01).
- **`ministry_tree_nodes`** (DA-6): só o ramo de raízes muda, de `mv.is_pastor` para `CASE WHEN (SELECT viewer_has('view_all_church')) THEN mv.is_pastor ELSE mv.id = ANY (public.viewer_tree_roots()) END`. O pareamento do casal já existente junta o G12 e o cônjuge num nó só.
- **`_dashboard_assert_access()`**: só `view_dashboard`. A conta sem cadastro e o membro sem função recebem 42501 (AQ-11).
- **Coluna `members.role_id` (migration 5, PR 6):** `REVOKE SELECT (role_id) ON public.members FROM authenticated` (RN-23). O UPDATE continua: o PATCH com `.select('id')` não lê a coluna. O `src/lib/members/fields.ts` e o teste de colunas do E1.08 (PR 5) passam a tratar `role_id` como coluna mascarada à parte, ligada a "Atribuir Função" e "Gerenciar Funções", e não a "Ver Dados Sensíveis".

#### O que deixa de estar ao alcance de `authenticated` (RN-23)
| Função | Hoje | Depois |
|---|---|---|
| `user_has_permission(_user_id, …)`, `is_admin(_user_id)` | EXECUTE para `authenticated`; respondem sobre qualquer pessoa | EXECUTE só para `service_role`. Com usuário logado, respondem só sobre ele |
| `is_in_same_ministry`, `get_ministry_root`, `is_leader_of_visible_member`, `can_manage_own_cell` | EXECUTE para `authenticated`; revelam G12, ministério e cadeia de qualquer pessoa | **Removidas** depois de trocadas. O `DROP` falha se alguma política ou view ainda depender delas. Para os corpos `plpgsql`, que não registram dependência, a tarefa 5 confere por busca no catálogo (`pg_proc.prosrc`) |
| `role_effective_permissions`, `viewer_permissions`, `_viewer_scope_anchors` | — | Internas, sem EXECUTE para `authenticated` |
| `viewer_ministry_member_ids`, `viewer_scope_contains_any` | — | Respondem só sobre quem consulta, e vazias ou falsas sem permissão de escopo (DT-28) |
| Coluna `members.role_id` e `members_view.role_id` | qualquer um lê a função de quem vê | PR 6: só o próprio, quem tem "Atribuir Função" e quem tem "Gerenciar Funções" |

### Escrita (migration 4)

#### Triggers
- Os de escopo são `SECURITY INVOKER`. Eles **não valem** para `postgres`, `service_role` e `supabase_admin` (`current_user`), como o trigger do E1.03. Isso inclui as RPCs *definer* e a cascata do trigger de cônjuge.
- **Regra para RPC *definer* que grava** (E2.01 e E2.11): a RPC confere as mesmas regras chamando as funções de linha acima.
- Os nomes garantem a ordem, que é alfabética. Os do E2.01 (`aa_`, `ab_`) vêm antes, então o excluído tem prioridade sobre o invisível, como a RN-09 pede.

| Tabela | Trigger (função) | Quando | Regra |
|---|---|---|---|
| `members` | `aa_enforce_member_write_rules` (reescrita, INVOKER) | `BEFORE INSERT OR UPDATE` | As regras 2, 3, 5 e 6 do E1.03 e do E1.08, como hoje. A regra 5 passa a usar o código `own_data_only`. A regra 4 é reescrita: ver [Função do membro](#função-do-membro-rn-18-rn-19-rn-21). Todas as checagens de permissão passam a usar `viewer_has`. |
| `members` | `ab_enforce_member_links` (E2.01) | — | Sem mudança |
| `members` | `ac_enforce_member_scope` (**nova**, INVOKER) | `BEFORE INSERT OR UPDATE OF leader_id, spouse_id, is_pastor, has_leadership` | (1) `has_leadership := true` se há líder (DA-11). (2) RN-10 para quem não vê a igreja toda: recusa marcar ou desmarcar pastor, trocar o líder de um pastor (DA-2), cadastrar sem líder, tirar o líder ou desligar "Tem Liderança?". Manter como está é aceito. (3) RN-09 (b): o líder e o cônjuge que **mudaram** (ou todos, no INSERT) passam por `viewer_sees_member`. |
| `members` | `zz_enforce_member_visible_after` (**nova**, INVOKER) | `AFTER INSERT OR UPDATE OF leader_id, spouse_id` | RN-09 (c): `viewer_sees_member(NEW.id)`, senão `would_leave_scope`. É `AFTER` e vem depois de `sync_spouse_relationship_trigger`, então enxerga o cônjuge já desfeito e a árvore nova (DT-07). |
| `cells` | `ab_enforce_cell_scope` (**nova**, INVOKER) | `BEFORE INSERT OR UPDATE OF leader_id, timothy_id, host_id` | RN-09 (b): as pessoas que entram passam por `viewer_sees_member`. RN-09 (c): `viewer_sees_cell_people(NEW.*)`, senão `would_leave_scope` (célula). |
| `cell_reports` | `ab_enforce_cell_report_scope` (**nova**, INVOKER) | `BEFORE INSERT OR UPDATE OF cell_id` | INSERT (RN-13): sem nenhuma permissão de enviar, 42501. Com célula invisível, `not_found_or_deleted` (célula). Com célula visível, mas sem direito, `report_submit_not_allowed`. Troca de célula: a nova precisa ser visível. |
| `cell_report_participants` | `ab_enforce_participant_scope` (**nova**, INVOKER) | `BEFORE INSERT` | RN-09 (b): o participante novo passa por `viewer_sees_member`. Um par que já existe passa sem conferência, como no trigger do E2.01. A retirada não é conferida aqui ("retirar não é escolher"). |
| `roles` | `aa_protect_roles` (**nova**) | `BEFORE INSERT OR UPDATE OR DELETE` | RN-17: a função `is_system` não é alterada nem excluída; `is_system` não muda e não nasce verdadeiro; a Administrador nunca é a padrão. RN-20: a padrão e a função usada por membro não excluído não são excluídas (com a contagem). |
| `role_permissions` | `aa_protect_role_permissions` (**nova**) | `BEFORE INSERT OR UPDATE OR DELETE` | RN-17: as linhas da Administrador não mudam. DA-3: com usuário logado, só entra uma permissão que ele tem (`viewer_has`). Entrar permissão aposentada: `permission_retired`. |
| `roles` | `zz_roles_exactly_one_default` (**nova**, `CONSTRAINT TRIGGER … DEFERRABLE INITIALLY DEFERRED`) | `AFTER INSERT OR UPDATE OF is_default OR DELETE` | RN-19: no *commit*, `count(*) WHERE is_default = 1`, senão `role_default_required` |

- Os triggers de `roles` e `role_permissions` valem para todos os papéis, como a DT-27 do E2.01. A exceção é `current_setting('app.role_maintenance', true) = 'on'`, usado só por migrations de manutenção.
- A DA-3 só confere quando há usuário (`auth.uid()` não nulo), para não barrar as migrations.

Esqueleto do trigger de escopo de membros:
```sql
CREATE OR REPLACE FUNCTION public.enforce_member_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  _church boolean;
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.leader_id IS NOT NULL THEN NEW.has_leadership := true; END IF;           -- DA-11

  _church := public.viewer_has('view_all_church');
  IF NOT _church AND (                                                             -- RN-10
       (TG_OP = 'INSERT' AND NEW.is_pastor)
    OR (TG_OP = 'UPDATE' AND NEW.is_pastor IS DISTINCT FROM OLD.is_pastor)
    OR (TG_OP = 'UPDATE' AND OLD.is_pastor AND NEW.leader_id IS DISTINCT FROM OLD.leader_id)   -- DA-2
    OR (NEW.leader_id IS NULL AND NOT NEW.is_pastor AND (TG_OP = 'INSERT' OR OLD.leader_id IS NOT NULL))
    OR (TG_OP = 'UPDATE' AND OLD.has_leadership AND NOT NEW.has_leadership)) THEN
    PERFORM public._del_raise('pastor_or_no_leadership_requires_church',
      'Só quem vê a igreja toda pode marcar um membro como pastor ou como sem liderança.');
  END IF;

  IF NEW.leader_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.leader_id IS DISTINCT FROM OLD.leader_id)
     AND NOT public.viewer_sees_member(NEW.leader_id) THEN                          -- RN-09 (b)
    PERFORM public._del_raise('person_not_visible', 'Você só pode escolher pessoas que você vê.',
      jsonb_build_object('field', 'leader_id', 'member_id', NEW.leader_id));
  END IF;
  -- o mesmo para spouse_id
  RETURN NEW;
END $$;
```
`_del_raise` é o helper de erro estruturado do E2.01, reaproveitado com o nome que já tem. Renomeá-lo quebraria os corpos `plpgsql` que o chamam.

#### Função do membro (RN-18, RN-19, RN-21)
A regra 4 de `aa_enforce_member_write_rules` é reescrita:
- **UPDATE com troca de `role_id`:**
  - o próprio cadastro dá `own_role`;
  - sem `can_assign_role(OLD.role_id)`, dá `role_change_not_allowed`;
  - sem `can_assign_role(NEW.role_id)`, dá `role_not_assignable`;
  - quando a função antiga é a `is_system` e a nova não é, roda `_assert_admin_remains(OLD.id)`: pega `pg_advisory_xact_lock(hashtextextended('admin-members', 0))` e confere que sobra outro membro não excluído com a função `is_system`. Senão, `last_admin` (DA-8, RN-21).
  - Sai a exceção do E1.03 "dar a padrão a quem não tem função é livre" (DA-10).
- **INSERT, por quem atribui funções:** `role_id` nulo é aceito (DA-10). Uma função que a pessoa não cobre dá `role_not_assignable`.
- **INSERT, por quem não atribui:** `NEW.role_id := coalesce(NEW.role_id, default_role_id())`.
  - Uma função diferente da padrão dá `role_not_assignable`.
  - Sem `viewer_covers_role(default_role_id())`, dá `default_role_not_covered` (RN-19).

#### RPCs
Valem para todas:
- `REVOKE EXECUTE … FROM PUBLIC, anon` e `GRANT EXECUTE … TO authenticated`.
- Nenhuma recebe id de usuário.
- Ordem das checagens: permissão (42501) → forma da entrada → travas → existência e visibilidade → regras → escrita.
- Mensagens novas, fora da tabela do PO, aparecem em itálico. São técnicas, e a tela normal não as provoca.

| RPC | Tipo | Quem | Travas | Recusas (código: mensagem) | Efeito |
|---|---|---|---|---|---|
| `save_role(_role_id uuid, _name text, _description text, _permissions permission_action[], _is_default boolean, _expected_updated_at timestamptz DEFAULT NULL) RETURNS uuid` | `SECURITY DEFINER` | `manage_roles` | `pg_advisory_xact_lock('roles')`; a função `FOR UPDATE` | `role_name_required`: Informe o nome da função. · `role_name_taken`: *Já existe uma função com este nome.* · `role_not_found` e `role_changed`: Esta função foi alterada em outra tela. · `admin_role_protected` (alterar ou marcar como padrão) · `role_default_required` · `permission_retired`: *Esta permissão não existe mais.* · `permission_not_covered`: *Você não pode dar a uma função uma permissão que você não tem.* (DA-3) | Cria (`_role_id` nulo) ou atualiza nome, descrição e permissões, gravando só a diferença. Com `_is_default` numa função que não era a padrão, desmarca a anterior e marca esta na mesma transação (RN-19). O `unique_violation` de `roles_name_key` vira `role_name_taken`. |
| `delete_role(_role_id uuid) RETURNS void` | `SECURITY DEFINER` | `manage_roles` | a função `FOR UPDATE` | `role_not_found` · `admin_role_protected` (excluir) · `role_is_default` · `role_in_use` (com `count`) | `DELETE` (as permissões vão em cascata). Os membros excluídos que tinham a função ficam sem função (DA-2 do E2.01). |
| `check_member_insert(_member jsonb) RETURNS void` | `SECURITY INVOKER`, `VOLATILE` | o RLS de INSERT de `members` (`create_member`) | as dos triggers | todas as do cadastro, com os códigos de cada uma | Ensaio do cadastro (DT-21): faz o `INSERT` das colunas de cadastro (a mesma lista da `create-user-admin`), com `auth_user_id` nulo, dentro de um bloco que termina num erro próprio (`SQLSTATE 'MCIDR'`). Só esse erro é capturado, e o ensaio inteiro é desfeito. Qualquer outro erro sobe como veio. |

Esqueleto do ensaio:
```sql
CREATE OR REPLACE FUNCTION public.check_member_insert(_member jsonb)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  _r public.members := jsonb_populate_record(NULL::public.members, _member);
BEGIN
  BEGIN
    INSERT INTO public.members (name, email, cpf, gender, birth_date, mobile_whatsapp, phone, notes,
      instagram, avatar_url, is_pastor, has_leadership, leader_id, spouse_id, is_baptized, baptism_date,
      is_active, street, number, complement, neighborhood, city, state, zip_code, role_id)
    VALUES (_r.name, _r.email, /* … os defaults da tabela via coalesce … */ _r.role_id);
    RAISE EXCEPTION USING ERRCODE = 'MCIDR', MESSAGE = 'ensaio';   -- passou em tudo; desfaz
  EXCEPTION WHEN SQLSTATE 'MCIDR' THEN
    RETURN;
  END;
END $$;
```
O `zz_enforce_member_visible_after` roda no fim do `INSERT`, antes do erro do ensaio, então a RN-09 (c) também é ensaiada.

#### `create-user-admin`
Ordem nova, depois do E2.01 (PR 5):
1. JWT e quem chama, como hoje.
2. Entrada (lista branca `MEMBER_FIELDS`).
3. `find_deleted_member_matches` (E2.01).
4. **`check_member_insert`, com a sessão de quem chama.** Ele cobre `create_member` (42501), RN-09, RN-10, RN-18 e RN-19, com os códigos. Os erros `app_error` saem como 400, ou 403 no 42501, com `{ error, code, detail }`.
5. `createUser` no Auth.
6. INSERT com a sessão de quem chama (os triggers são a última barreira) e, na falha, `deleteUser`, como hoje.

Saem o `resolveRole` em TypeScript e as chamadas `user_has_permission` e `role_permissions` com a service role. A regra de função fica só no banco.

#### Ajustes no E2.01
- **`set_cell_report_participants`:** quando há participantes a retirar e quem chama não tem `edit_cell_report`, a RPC levanta 42501 antes de qualquer mudança. Hoje a política de DELETE filtraria a retirada em silêncio, e a RPC terminaria pela metade (DA-5).
- **`restore_member`:** depois de restaurar, se `NOT viewer_sees_member(_member_id)`, a RPC recusa com `pastor_or_no_leadership_requires_church` e tudo volta (DA-7). Ela é *definer*, então a regra não vem do trigger.
- **`_del_member_blockers`**, **`check_member_deletion`** e as views de excluídos: nada a mudar além do escopo novo. Elas leem a `members_view` (DA-10 do E2.01) e usam `viewer_covers_role`, já com as permissões efetivas.

### Formato dos erros (AQ-5)
O formato é o do E2.01: 42501 só para falta de permissão, e 22023 com `HINT = 'app_error'` e `DETAIL` em JSON `{ code, … }` para as regras. As regras de função e de próprio cadastro do E1.03 saem do 42501, senão a tela trocaria o texto pelo genérico (UX-30).

| `code` | Mensagem | Detalhes além de `code` |
|---|---|---|
| `person_not_visible` | Você só pode escolher pessoas que você vê. | `field` (`leader_id`, `spouse_id`, `timothy_id`, `host_id`, `member_id`) e `member_id` |
| `pastor_or_no_leadership_requires_church` | Só quem vê a igreja toda pode marcar um membro como pastor ou como sem liderança. | `field` (`is_pastor`, `leader_id`, `has_leadership`) |
| `report_submit_not_allowed` | Você não pode enviar o relatório desta célula. | `cell_id` |
| `not_found_or_deleted` (E2.01) | Esta célula não existe ou já foi excluída. | `entity: "cell"` (célula invisível no lançamento) |
| `would_leave_scope` | Com esta alteração, você deixaria de ver este cadastro. As alterações não foram salvas. · Com esta alteração, você deixaria de ver esta célula. Mantenha pelo menos uma pessoa do seu ministério como líder, timóteo ou anfitrião. As alterações não foram salvas. | `entity` (`member` ou `cell`) |
| `default_role_not_covered` | A função padrão tem permissões que você não tem. Peça a um administrador para fazer este cadastro. | — |
| `own_role` | Ninguém pode alterar a própria função. | — |
| `role_change_not_allowed` | Você não tem permissão para alterar a função deste membro. | — |
| `role_not_assignable` | Você não tem permissão para atribuir esta função. | — |
| `own_data_only` | Você só pode alterar os seus dados pessoais. Não é permitido alterar: {campos}. | `fields` |
| `last_admin` | *Não é possível tirar a função Administrador do último administrador.* (DA-8) | — |
| `admin_role_protected` | A função Administrador não pode ser alterada. · … não pode ser excluída. · … não pode ser a função padrão. | `operation` (`update`, `delete`, `default`) |
| `role_is_default` | Esta é a função padrão. Escolha outra função padrão antes de excluí-la. | — |
| `role_default_required` | Esta é a função padrão. Para trocar, marque outra função como padrão. | — |
| `role_in_use` | Esta função é usada por {N} membros. Troque a função deles antes de excluí-la. ("por 1 membro") | `count` |
| `role_name_required` · `role_name_taken` · `role_not_found` · `role_changed` · `permission_retired` · `permission_not_covered` | ver [RPCs](#rpcs) | `permissions` nos dois últimos |

No front, o `parseAppError` do E2.01 já lê esse formato. Os códigos deste passo ficam em `src/lib/access/codes.ts`, como união de tipos.

### Bloqueios e concorrência
- **Unicidade e invariantes ficam no banco:**
  - uma Administrador (índice único);
  - no máximo uma padrão (índice único) e pelo menos uma (constraint trigger adiado);
  - a padrão nunca é a Administrador (`CHECK`).
- **Troca da função padrão:** `save_role` pega a trava consultiva `roles`.
  - Duas trocas ao mesmo tempo ficam em série, e a última vale.
  - Sem a trava, a segunda daria `unique_violation` no índice da padrão.
- **Excluir uma função × dar essa função a alguém:**
  - `delete_role` trava a função com `FOR UPDATE`. A gravação de `members.role_id` pega `FOR KEY SHARE` na função, pela checagem da FK, e as duas conflitam.
  - Se a exclusão vem primeiro, a atribuição recebe 23503 depois e não grava nada.
  - Se a atribuição vem primeiro, a exclusão conta o membro e recusa com `role_in_use`.
- **Último administrador (RN-21):**
  - a troca de função que tira a Administrador pega a trava consultiva `admin-members` antes de contar;
  - dois administradores que tiram a função um do outro ficam em série, e o segundo recebe `last_admin`;
  - a exclusão cruzada já é tratada pela DT-21 do E2.01. A combinação de exclusão com troca de função conflita pelas travas de linha de `delete_member`, e a segunda operação perde a permissão ou a cobertura ao ser conferida de novo.
- **A árvore muda durante uma gravação.** Exemplo: Rita move Caio para Diego enquanto Pedro edita Caio.
  - A política filtra pela foto do início do comando.
  - O `zz_enforce_member_visible_after` relê a árvore no fim, em `READ COMMITTED`. Se a gravação de Pedro deixar Caio fora do escopo dele, a recusa é `would_leave_scope`.
  - Uma mudança de árvore que termina **depois** da gravação prevalece. É uma mudança legítima de quem vê a igreja toda (risco 6).
- **Escolher e excluir a mesma pessoa:** continua a DT-08 do E2.01 (`FOR KEY SHARE` × `FOR UPDATE`).
- **Nenhuma trava nova entre linhas de `members`:** as checagens de escopo são leituras. A ordem global de travas do E2.01 (relatório → célula → membros → semana → linhas dos triggers) não muda. As duas travas consultivas novas (`roles` e `admin-members`) não convivem com as do E2.01 na mesma operação.

### Front
Segue o padrão do E1.08 e do E2.01: os componentes cuidam da tela, o acesso a dados fica nos hooks e a regra pura fica em `src/lib/`.

- **Domínio puro, com testes Vitest e sem React nem Supabase:**
  - `src/lib/access/permissions.ts`:
    - `PERMISSION_CATALOG`: valor, rótulo, dica e grupo da T3, na ordem dos grupos;
    - `RETIRED_PERMISSIONS`;
    - um `satisfies Record<PermissionAction, …>` faz a compilação falhar quando surgir permissão nova sem rótulo.
  - `src/lib/access/access.ts`:
    - tipo `Access`, derivado da linha de `my_access()` no `types.ts`;
    - `hasPermission(access, …perms)`;
    - `menuItems(access)` (tabela de Navegação e rotas, UX-08) e `canSeeRoute(access, path)` (T12);
    - `listSubtitle(access, entity)` (P10) e `dashboardHeader(access)` (T9);
    - `accessFingerprint(access)`, para detectar mudança (UXD-11).
  - `src/lib/access/member-form.ts`: o que a T6 mostra, conforme o acesso e o cadastro:
    - pastor e sem liderança como texto;
    - Líder obrigatório e preenchido com quem cadastra;
    - o campo Função a partir de `role_options`.
  - `src/lib/access/codes.ts` e `src/lib/access/texts.ts`: os códigos da tabela acima e **todos** os textos deste spec, num módulo só.
  - `src/lib/roles/roles.ts`: ordem da lista (Administrador primeiro), "N membros" e "N permissões", e o aviso de troca da padrão.
- **Hooks:**
  - `use-access.ts`: `my_access`, chave `["access"]`, relido na volta do foco, a cada navegação e no `onError` 42501 do `QueryCache`/`MutationCache` do E2.01. Mostra "Seu acesso foi atualizado." uma vez quando a impressão digital muda.
  - `use-roles.ts`: `roles_view`, `save_role` e `delete_role`.
  - `use-role-options.ts`.
- **`AuthContext`:**
  - troca as leituras de `roles` e `role_permissions` por `my_access`;
  - **sai `isSystem`**, e `hasPermission` passa a vir de `access.permissions`;
  - o resto (sessão, E1.04 e E2.01) fica como estiver.
- **Componentes:**
  - `AppSidebar` (T1);
  - `NoAccess` (T12), usado pelas rotas sem permissão, antes de qualquer consulta de dados;
  - `RoleForm` e o fluxo de exclusão de função (T3, T4, com `BlockedActionDialog` e `ConfirmDeleteDialog` do E2.01);
  - `AsyncMemberSelect` e `PaginatedSelect` ganham `savedLabel` (o nome que veio da view: `leader_name`, `spouse_name`, `timothy_name`, `host_name`; DT-23), `aria-describedby` para a dica e o texto de busca vazia do P11.
- **Telas:**
  - `Roles.tsx` (T2 a T4);
  - `Members.tsx` e `MemberForm.tsx` (T5, T6, "Meus dados" só para leitura);
  - `Cells.tsx` e `CellForm.tsx` (T7, com `can_submit_report` e `is_mine` da view);
  - `CellReports.tsx` e `CellReportForm.tsx` (T8: seletor com `is_active` e `can_submit_report`, ordenado por `is_mine`, e o aviso com `member_visible`);
  - `Dashboard.tsx` (T9, com o atalho num diálogo);
  - `Ministries.tsx` (T10).
- **Gravações:** `.update(…).eq('id', id).select('id')`, com "0 linhas" tratado com o texto do E2.01 (AQ-6, DT-19 do E2.01). Em `members`, nunca se pede no `select` coluna sensível nem `role_id`.

### Onde cada regra é imposta
| RN | Banco (constraint, RLS, trigger, RPC) | UI |
|---|---|---|
| RN-01 | `_viewer_scope_anchors`, `viewer_ministry_member_ids` (views), `viewer_scope_contains_any` (políticas e triggers), sem `g12_level` | Exibe |
| RN-02 | Predicados canônicos nas 4 views, nas 3 de excluídos e nas políticas; `member_names`; RPCs do Dashboard e árvore leem as views; `events` sem escopo | Subtítulos (P10); seletores pela view (P11) |
| RN-03 | Predicado de célula com líder, timóteo e anfitrião | — |
| RN-04 | Predicado de relatório com `view_own_reports` e o anfitrião; participantes pelo RLS do relatório | Menu e subtítulo de Relatórios |
| RN-05 | Pastor é topo, sem G12, e enxerga a descendência dele e do cônjuge; marcar pastor no `ac_enforce_member_scope` | "Pastor(a)" como texto (T6) |
| RN-06 | Sem líder = topo; fora da descida dos outros; card "Sem liderança" pela view | — |
| RN-07 | `viewer_member_id` nulo ou função nula: views vazias, `viewer_has` falso (42501 nas RPCs e no INSERT, 0 linhas no PATCH); `_dashboard_assert_access` | Dashboard sem acesso (T9), "Ver meus dados" |
| RN-08 | Tudo calculado por consulta; nada em cache no banco | `use-access` relido no foco, na navegação e no 42501 (T12) |
| RN-09 | (a) `USING` das políticas e visibilidade nas RPCs do E2.01. (b) Triggers `ac_` e `ab_` comparam OLD×NEW. (c) `zz_enforce_member_visible_after`, trigger de célula e `restore_member`. `check_member_insert` na `create-user-admin`; `set_cell_report_participants` grava a diferença | Seletores só com o visível; aviso de participantes (`member_visible`); `Alert` com a recusa (T11) |
| RN-10 | `ac_enforce_member_scope` (pastor, sem liderança, líder do pastor) | Campos escondidos ou como texto; Líder obrigatório e preenchido (T6) |
| RN-11 | Regra 5 do E1.03 (`own_data_only`) e política de UPDATE (`edit_own_data` só no próprio) | Bloco ministerial só com `edit_member` |
| RN-12 | Política de UPDATE de `cells` só com `edit_cell` e no escopo; trigger de célula | "Editar" só com `edit_cell` |
| RN-13 | Política de INSERT `can_submit_report`; `ab_enforce_cell_report_scope`; participantes (DA-5) | `cells_view.can_submit_report`, `my_access.can_submit_some_report`, seletor de célula (T7, T8, T9) |
| RN-14 | Política de UPDATE com `edit_cell_report` e no escopo; RPC de exclusão (E2.01) pela view | Botões pela permissão |
| RN-15 | Views de excluídos com o predicado novo; RPCs do E2.01 pela view | — |
| RN-16 | Migration 1 | Tela de Funções |
| RN-17 | Atalho `is_system` em `user_has_permission`; `aa_protect_roles` e `aa_protect_role_permissions`; índice e `CHECK` em `roles` | Administrador só para leitura (T2) |
| RN-18 | Regra 4 de `aa_enforce_member_write_rules` (`can_assign_role` com permissões efetivas); `role_options` | Campo Função (T6) |
| RN-19 | Regra 4 (padrão e cobertura); `save_role` (troca atômica); `zz_roles_exactly_one_default`; `my_access.can_create_member` | Bloqueio do "Novo membro" (T5); interruptor travado (T3) |
| RN-20 | `delete_role` e `aa_protect_roles` (contagem de não excluídos) | Bloqueio antecipado pela `roles_view` (T4) |
| RN-21 | `_assert_admin_remains` com trava consultiva; RN-17 e RN-03 do E2.01 | — |
| RN-22 | `active_permissions()`; migration 1; `_dashboard_assert_access`; `save_role` recusa aposentadas | Catálogo de rótulos, dicas e grupos; menu |
| RN-23 | REVOKE e DROP das funções com id (PR 1); `my_access` e `role_options` só sobre quem chama; no PR 6: `members_view.role_id` mascarado, REVOKE de `members.role_id` e `roles` só com "Visualizar Funções" ou "Gerenciar Funções" | Função de outro membro só para quem atribui (T6); a própria no menu (T1) |

### Respostas às perguntas do UX (AQ-1 a AQ-11)
| # | Resposta |
|---|---|
| AQ-1 | **Sim.** `my_access()`, com as colunas de [Leituras para a tela](#leituras-para-a-tela-aq-1-aq-3-e-ajustes-de-leitura). Também traz `sees_ministry` e `sees_ministry_reports`, para os subtítulos. Sempre devolve uma linha. A tela relê no foco, na navegação e no 42501. |
| AQ-2 | **Sim.** `roles_view` (`is_protected`, `is_default`, `permissions` efetivas, `members_count`), `save_role` atômica, com a troca da padrão e `_expected_updated_at` para "alterada em outra tela", e `delete_role` com os códigos da AQ-5. |
| AQ-3 | **Sim.** `role_options(_member_id)` em JSON. A partir do PR 6, a `members_view.role_id` vem nula para quem não atribui funções, a não ser no próprio cadastro, e `roles` e `role_permissions` só são lidas direto com "Visualizar Funções" ou "Gerenciar Funções" (DA-9). O `AuthContext` e o `MemberForm` deixam de ler as duas tabelas e a `role_id` de outra pessoa nos PRs 2 e 4. |
| AQ-4 | **Sim.** `cells_view.can_submit_report` e `is_mine`, com a mesma regra de `can_submit_report()`, que é a da política e do trigger. O seletor filtra `is_active` e `can_submit_report` e ordena por `is_mine` primeiro. |
| AQ-5 | **Sim.** Os códigos estão em [Formato dos erros](#formato-dos-erros-aq-5). Os de função e de próprio cadastro do E1.03 passam a `app_error`. |
| AQ-6 | **Resolvido sem RPC nova.** O formulário faz `.update(…).eq('id', id).select('id')` (DT-19 do E2.01). Sem linha de volta, mostra "… não existe ou já foi excluído.". As recusas de regra (RN-09 c, RN-10, RN-18) vêm como `app_error`. Em `members`, o `select` pede só `id`. |
| AQ-7 | **Sim.** A `set_cell_report_participants` (E2.01) já grava a diferença, e só os participantes que entram passam pela RN-09 (b). A coluna `member_visible` alimenta o aviso. Retirar sem "Editar Relatórios de Células" dá 42501 (DA-5). |
| AQ-8 | **Confirmado.** O `ac_enforce_member_scope` compara OLD com NEW. Manter pastor ou sem liderança é aceito, e dar um líder visível a quem está sem liderança também. |
| AQ-9 | O banco liga `has_leadership` sempre que há líder (DA-11). Quem vê só o ministério não precisa enviar a chave. Ao desligar a chave, a tela de quem vê a igreja toda também limpa o líder. Se o E2.04 ou o E2.06 derivarem a coluna, a tela deixa de enviá-la. |
| AQ-10 | Com a DA-6, a árvore de quem vê só o ministério começa no casal G12, e a lista vazia (sem erro) fica só para quem não vê ninguém. Se a DA-6 for recusada, a lista vem vazia, sem erro, para quem não é pastor. |
| AQ-11 | **Confirmado.** `_dashboard_assert_access` dá 42501 para a conta sem cadastro e para o membro sem função (`viewer_has` falso). A tela distingue os dois casos por `my_access().member_id` nulo e `role_id` nulo. |

### Decisões técnicas
| # | Decisão | Motivo |
|---|---|---|
| DT-01 | O escopo parte de quatro âncoras calculadas subindo `leader_id` até o topo (`_viewer_scope_anchors`), sem `g12_level`, com caminho visitado contra ciclos. | RN-01 e P-PER-01: a árvore atual, independente do E2.06 |
| DT-02 | Uma definição de âncoras e duas formas de percorrer: a descida em conjunto (views) e a subida por id (políticas e triggers), com teste de equivalência por par. | A descida monta o escopo uma vez por consulta; a subida custa O(profundidade) por id e não monta o escopo de um pastor (20 mil) a cada gravação. |
| DT-03 | Views, políticas e funções de linha seguem a tabela de predicados canônicos, conferida pelo teste de paridade por persona. | O padrão do E1.08 e do E2.01. Delegar a política à view quebra o `INSERT … RETURNING` (leitura técnica 6 do E2.01). |
| DT-04 | `view_own_reports` usa o mesmo predicado de relatório que `view_own_ministry`, sem abrir membros e células. | P-PER-04 e RN-04 |
| DT-05 | As políticas de participantes delegam ao RLS de `cell_reports` por `EXISTS`. | A visibilidade do relatório num lugar só |
| DT-06 | RN-09 (b) e RN-10 em triggers `BEFORE` `SECURITY INVOKER`, depois dos triggers do E2.01, comparando OLD com NEW. Não valem para `postgres` e `service_role`, e as RPCs *definer* conferem por conta própria. | "Pessoas que já estavam ficam" (RN-09 b) e o excluído com prioridade sobre o invisível. A cascata do trigger de cônjuge roda como *definer* e não pode ser barrada. |
| DT-07 | RN-09 (c) de membros num trigger `AFTER` (`zz_`), que roda depois do trigger de cônjuge e enxerga a árvore e o cônjuge novos. De células, no `BEFORE`, porque a visibilidade só depende das colunas novas. | O `WITH CHECK` usa a foto do início do comando e não enxerga a mudança. O trigger dá a mensagem do PO. |
| DT-08 | Desfazer o vínculo do lado de fora, pela simetria do cônjuge, é consequência de "retirar não é escolher". A RN-09 (c) vale para o registro gravado. | DA-4 |
| DT-09 | Administrador: atalho `is_system` em `user_has_permission` e nas permissões efetivas, linhas preenchidas só como documentação, triggers que impedem alterar, excluir e marcar como padrão, índice único em `is_system` e o atalho `isSystem` fora do front. | RN-17, inclusive as permissões futuras (ESC-28), sem migration a cada permissão nova. O banco e a tela passam a concordar. |
| DT-10 | `active_permissions()` é a lista única das permissões que valem. `user_has_permission` ignora as aposentadas, a migration converte as linhas, e `save_role` e o trigger recusam as aposentadas. | RN-22: "não liberam mais nada", sem mexer no enum |
| DT-11 | As funções com id de usuário ou de membro saem do alcance de `authenticated`. As de escopo obsoletas são removidas. `user_has_permission` e `is_admin` ficam só para `service_role` e restritas a `auth.uid()` quando há usuário. No PR 6, `members.role_id` perde o SELECT por coluna e passa a vir mascarado na view. | RN-23 e o item de "Problemas conhecidos" |
| DT-12 | Funções gravadas só por RPC (`save_role`, `delete_role`). Os triggers são a última barreira para qualquer papel. A escrita e a leitura diretas fecham no PR 6. | AQ-2 (atômico), RN-17, RN-19, RN-20. O front atual continua funcionando até o PR 6. |
| DT-13 | RN-19 no trigger: quem não atribui cadastra sempre com a padrão, que o banco preenche, e precisa cobri-la. A exceção do E1.03 sai. | RN-18 e RN-19 (DA-10) |
| DT-14 | RN-21: trava consultiva `admin-members` e contagem na troca de função que tira a Administrador. | Corrida entre dois administradores (DA-8) |
| DT-15 | Erros no formato `app_error` do E2.01, inclusive as regras de função e de próprio cadastro do E1.03. | AQ-5 e UX-30 |
| DT-16 | `my_access()` é a única leitura de acesso do front. | AQ-1 e RN-08, sem três leituras de tabela |
| DT-17 | `roles_view`, com permissões efetivas e `members_count`, e o índice `members_role_id_idx`. | AQ-2, RN-20 |
| DT-18 | `role_options(_member_id)` (PR 1) e a `members_view.role_id` mascarada (PR 6). | AQ-3, RN-18, RN-23 |
| DT-19 | `can_submit_report(_cell_id)` na política e no trigger de INSERT de relatório, e a mesma regra na `cells_view`, conferidas pela paridade. | AQ-4: a tela e o banco nunca discordam |
| DT-20 | Participantes: quem só envia inclui só na semana atual e não retira; `set_cell_report_participants` recusa a retirada sem permissão; `member_visible` na view. | DA-5, AQ-7, RN-14 |
| DT-21 | `check_member_insert` ensaia o cadastro com a sessão de quem chama, antes de criar a conta no Auth. O `resolveRole` em TypeScript sai. | RN-09 ("nenhuma conta de acesso fica criada") sem depender do desfazimento. Uma regra só, no banco. |
| DT-22 | `has_leadership := true` quando há líder, com a correção na migration. | AQ-9, DA-11 |
| DT-23 | Os nomes de referência vêm das views (`leader_name`, `spouse_name`, que é nova, os `*_name` de célula e o `member_name` dos participantes). Os seletores recebem esse nome, e a `member_names` fica com a regra do E1.13 sobre o escopo novo. | RN-02 e UX-20 (Diego como líder de C2 para Pedro), sem alargar a `member_names` |
| DT-24 | A `ministry_tree_nodes` começa no topo do escopo (DA-6). | MIN-02; tira a dependência de publicação com o E2.15 |
| DT-25 | O G12 da `cells_view` vem da árvore real, por uma subconsulta recursiva no SQL da view, sem função exposta, e entra `leader_is_pastor`. | RN-23: `get_ministry_root` revelava o G12 de qualquer id. A view só mostra o G12 de células visíveis (nome de referência). |
| DT-26 | Seis PRs. O PR 1 é só banco e compatível com o front em produção. A leitura e a escrita diretas de funções e a máscara de `role_id` ficam para o PR 6, depois de todo o front promovido. | Cada PR vai ao ar sozinho ([Implantação](#implantação)) |
| DT-27 | `restore_member` confere a visibilidade depois de restaurar (DA-7). | RN-09 (c) e RN-10 numa RPC *definer* |
| DT-28 | A descida e a subida voltam vazias ou falsas sem "Visualizar Seu Ministério" e sem "Visualizar Relatórios do Seu Ministério". | RN-23: ninguém lista o próprio escopo pela API sem poder vê-lo. Nas views e políticas, isso não muda nada, porque elas já exigem essas permissões. |

### Riscos (concorrência, escala, segurança)
1. **Desvio entre views, políticas e funções de linha.** Agora são três formas por entidade, mais as views de excluídos.
   - Mitigação: paridade por persona com a massa do spec (11 pessoas e a conta X), comparando os ids da view, da tabela sob o RLS e da função de linha.
   - Mitigação: o teste de equivalência entre a descida e a subida.
   - Mitigação: a tabela de predicados canônicos no cabeçalho da migration 3.
2. **Funções removidas ainda chamadas em corpos `plpgsql`.** O `DROP` não enxerga esses corpos, e a falha só apareceria em tempo de execução.
   - Mitigação: busca em `pg_proc.prosrc` e em `pg_policies` no pgTAP, para que nenhuma referência sobre;
   - mitigação: a conferência da tarefa 1 em produção.
3. **Custo das políticas por linha.** Ler a tabela `members` direto (`select=id,name` ainda é permitido) faz uma subida por linha, cerca de 20 mil subidas para quem vê o ministério.
   - O app não lê a tabela, e o *statement timeout* do PostgREST limita o abuso.
   - Meta: um PATCH por id abaixo de 20 ms.
4. **Ordem e visibilidade do trigger `AFTER`.** A RN-09 (c) depende de duas coisas: o `zz_` rodar depois de `sync_spouse_relationship_trigger` (a ordem é alfabética) e as consultas dele enxergarem a mudança do comando.
   - O pgTAP prova o caso de André e Beatriz, e o ensaio do `check_member_insert`.
   - Se alguém renomear os triggers, o teste quebra.
5. **Constraint trigger adiado em `roles`.** Toda transação que mexe em `roles` precisa terminar com exatamente uma padrão, inclusive a massa dos testes de banco e a carga do E4.
6. **Árvore mudando durante uma gravação.** As regras valem no momento da gravação. Uma mudança feita depois, por quem vê a igreja toda, prevalece e pode tirar do escopo o que acabou de ser gravado. Isso é aceito.
7. **Janela entre o PR 1 e os PRs de front.** O front em produção ainda mostra "É Pastor(a)?", "Tem Liderança?", o seletor de função e "Novo relatório" para quem não pode usá-los.
   - O banco recusa, e a tela mostra a mensagem do servidor num toast.
   - A tela de Funções antiga não consegue trocar a função padrão, porque o constraint trigger recusa a desmarcação isolada. Ela edita o resto normalmente.
   - **Achado da implementação (PR 1, 2026-11-25):** a tela antiga apaga todas as permissões da função e depois insere as marcadas, em duas requisições, sem checar o erro do DELETE. Se o INSERT for recusado (`permission_retired`, porque ela ainda oferece "Visualizar Membros (legado)", ou `permission_not_covered`), a função fica **sem nenhuma permissão**. A Administrador não é afetada (os triggers recusam as duas requisições). Decisão do `architect`: aceitar, porque a produção só tem dados de teste; **entre o "Deploy: banco" do PR 1 e o promote do PR 3, não editar funções pela tela**. Se precisar, corrigir pela `save_role`.
8. **Volume.**
   - Medir no volume de referência do E1.08 (20 mil membros, 1.500 células, 100 mil relatórios e 800 mil participações), com um pastor e um G12 com "Visualizar Seu Ministério".
   - Metas:
     - página de lista com contagem abaixo de 300 ms, inclusive para o pastor, cujo escopo é a árvore inteira;
     - `dashboard_summary` abaixo de 800 ms;
     - `my_access` abaixo de 50 ms;
     - lançamento com 30 participantes abaixo de 300 ms;
     - PATCH de membro abaixo de 20 ms.
   - O G12 em linha na `cells_view` custa uma subida por linha da página (25).
9. **`security_definer_view`:** o *advisor* acusa a `roles_view`. É esperado; não trocar para `security_invoker`.
10. **Recriação de views:** só acrescentar colunas no fim. A `cell_report_participants_view` depende da `cell_reports_view`.
11. **E2.01 em implementação.** O desenho usa nomes do E2.01 (`_del_raise`, `cell_in_viewer_ministry`, `set_cell_report_participants`, os nomes dos triggers `aa_` e `ab_`). A tarefa 1 relê as migrations finais.
12. **Senha da `change-member-password`.** Ela continua chamando `user_has_permission` e `is_admin` com a service role, e funciona até o E2.03, que a reescreve com a sessão de quem chama.
13. **Escalada pela tela de Funções.** Quem tem "Gerenciar Funções" ainda pode dar à **própria** função as permissões que já tem, e tirá-las. A DA-3 impede acrescentar o que não tem. "Gerenciar Funções" segue sendo uma permissão de administrador.
14. **RN-23 parcial entre o PR 1 e o PR 6.** Até o PR 6, a `role_id` de outra pessoa continua saindo pela `members_view` e pela tabela, e as definições das funções continuam legíveis por quem tem cadastro. As funções que revelavam permissões, G12 e escopo de outra pessoa já saem no PR 1. O PR 6 deve seguir logo depois dos PRs de front.

### Dependências e impactos em outros passos
| Passo | Relação |
|---|---|
| E2.01 | **Pré-requisito, inteiro em produção.** O E2.02 muda os mesmos pontos únicos: os `WHERE` das views principais e de excluídos, as políticas, `cell_in_viewer_ministry`, `viewer_covers_role`, `member_names`, `set_cell_report_participants` e `restore_member`. A P-DEL-04 termina aqui (RN-15). O PR 2 do E2.02 usa o `QueryCache` e o `MutationCache` do PR 6 do E2.01. |
| E1.04 | **Sem conflito de regra.** A `sign-in` usa a service role e não depende das funções restritas. Os dois mexem no `AuthContext`: o E1.04 no `signIn`, e o E2.02 na leitura de acesso. Recomendado: o E1.04 entra antes do PR 2 do E2.02, e quem vier depois faz o *rebase*. A persona AU do E1.04 ("não aparece na tela de Funções") muda com a P-PER-18, mas só no texto. |
| E2.15 (MIN-02) | Com a DA-6, o ramo de raízes entra no PR 1, e a P-PER-15 deixa de ser necessária: o E2.02 pode ir para produção sozinho. Se a DA-6 for recusada, o PR 1 só é promovido junto com o E2.15 ou depois dele. |
| E2.03 | A troca de senha aplica ao alvo `viewer_sees_member` (RN-09) e `viewer_covers_role` (RN-18), com a sessão de quem chama, e para de usar `user_has_permission` e `is_admin` com id. |
| E2.04 | MEM-07: "quem vê a igreja toda" salva sem líder (já imposto aqui para os demais). Proibir pastor com líder para todos (leitura técnica 5). Derivar `has_leadership`, se quiser. |
| E2.06 | O caminho materializado pode substituir a subida e a descida, desde que seja atualizado na mesma transação da troca de líder (RN-08). As duas formas ficam atrás de `_viewer_scope_anchors` e das duas funções, sem mudar o contrato. |
| E2.11 | A RPC de lançamento é *definer* e chama `can_submit_report` e `viewer_sees_member` para os participantes que entram. O líder, o timóteo e o anfitrião automáticos (REL-07) ficam isentos da RN-09 (b). Com o registro do relatório (REL-09), `cell_in_viewer_ministry` e `viewer_is_cell_person` passam a olhar o relatório (RN-04), e a DA-12 é revista. Ele absorve a `set_cell_report_participants` e a DA-5. |
| E2.13 | A exportação lê a `cell_reports_view` e herda o escopo. |
| E3.04, E4.06 e E4.08 | Usam os nomes das funções semeadas. O constraint trigger da padrão vale também na carga. |
| Escolas | "Gerenciar escolas" (ESC-28) entra no enum e, pelo atalho, já vale para a Administrador. O catálogo do front ganha o grupo "Escolas". O escopo de Membros é o deste passo. |
| Consolidação | A flag entra nas views e nas funções de linha que olham `members`. |

### Implantação
| PR | Ordem | Efeito no front em produção |
|---|---|---|
| 1 (banco) | merge → "Deploy: banco" (migrations 1 a 4 e a `create-user-admin`) → nada a promover | O escopo novo passa a valer na hora, com o front antigo. Continuam abertas as leituras do `AuthContext` e do `MemberForm` (`roles` e `role_permissions`) e a `role_id` dos cadastros, que o `MemberForm` atual exige ao salvar. A tela de Funções antiga continua gravando direto, sob os triggers. Ver o risco 7. |
| 2 (acesso, menu e rotas) | merge → promote | — |
| 3 (Funções), 4 (Membros), 5 (Células, Relatórios, Dashboard e Ministérios) | merge → promote, em qualquer ordem depois do PR 2 | — |
| 6 (banco) | **depois dos PRs 2 a 5 promovidos**; antes do merge, conferir por busca que o front não lê nem grava `roles` e `role_permissions` e não pede `role_id` de outra pessoa | Nenhum: o front novo já usa `my_access`, `role_options`, `roles_view` e as RPCs |

- O promote já recusa rodar com migration pendente.
- **Rollback:**
  - o front volta pelo promote do commit anterior;
  - as migrations do PR 1 não voltam sozinhas: uma migration nova reabre o que for preciso, por exemplo o EXECUTE de uma função;
  - o PR 6 volta com uma migration que recria as políticas de leitura do E2.01.

> **Atenção para a implementação (2026-11-24, achado do desenho do E2.08):** `_del_raise` (E2.01) só tem EXECUTE para `postgres` e `service_role`. Um trigger `SECURITY INVOKER` que recusa chamando `_del_raise` falha com 42501 para qualquer usuário logado. Os triggers de escopo deste passo (`ac_enforce_member_scope`, `ab_enforce_cell_scope`, `ab_enforce_cell_report_scope`) foram desenhados INVOKER: ao implementar, torná-los *definer*, dar EXECUTE a `authenticated` ou levantar o erro direto. O PR 2 do E2.01 também criou `a0_check_insert_permission` e as `viewer_can_insert_*`: o escopo de escrita das políticas de INSERT deve entrar nelas, que são a fonte única da política e do trigger.

### Conferências em produção (tarefa 1)

> **Resultado em 2026-11-23 (sessão principal, só leitura).** Nenhum caso de parada:
> - Funções: uma de sistema (Administrador, 3 membros), Líder (2 membros) e Membro (padrão, 0 membros), com esses nomes.
> - Permissões aposentadas em uso: `view_members` na Administrador e na Líder; `view_own_ministry_dashboard` na Administrador.
> - Dados: 5 membros; nenhum líder sem `has_leadership`, pastor com líder, cônjuge assimétrico, conta sem função ou ciclo.
> - Funções que chamam as antigas: `can_assign_role`, `enforce_member_write_rules`, `is_in_same_ministry`, `is_leader_of_visible_member`, `member_names`, `viewer_has`, `viewer_ministry_member_ids`. Políticas: as de `members`, `cells`, `cell_reports`, `cell_report_participants`, `events`, `roles` e `role_permissions`.
> - Grants: `roles` e `role_permissions` dão todos os privilégios de tabela a `anon` e `authenticated` (só o RLS protege), o que o PR 6 fecha. `members.role_id` e `auth_user_id` com SELECT por coluna para `authenticated`.
> - Última migration em produção: `20261123194024` (E1.08 PR 5). O E2.01 ainda não estava em produção; a tarefa 1 repete a conferência depois dele.
> - DA-1 aplicada pela sessão principal: no critério da RN-10, o caso de Diego usa Hugo no lugar de Caio (Caio está fora do escopo de Diego).
Só leitura. A tarefa 1 entrega o SQL, e o usuário roda no banco de produção. A saída não traz nomes de pessoas.
```sql
-- 1. Funções: sistema, padrão, permissões e uso
SELECT r.name, r.is_system, r.is_default, r.description,
       (SELECT count(*) FROM public.members m WHERE m.role_id = r.id) AS members,
       array_agg(rp.permission ORDER BY rp.permission) FILTER (WHERE rp.permission IS NOT NULL) AS permissions
  FROM public.roles r LEFT JOIN public.role_permissions rp ON rp.role_id = r.id
 GROUP BY r.id ORDER BY r.is_system DESC, r.name;

-- 2. Exatamente uma função de sistema? Quantas padrão?
SELECT count(*) FILTER (WHERE is_system) AS system_roles,
       count(*) FILTER (WHERE is_default) AS default_roles
  FROM public.roles;

-- 3. Permissões aposentadas em uso
SELECT r.name, rp.permission
  FROM public.role_permissions rp JOIN public.roles r ON r.id = rp.role_id
 WHERE rp.permission IN ('view_members', 'view_own_ministry_dashboard')
 ORDER BY 1, 2;

-- 4. Cadastros: incoerências que a migration corrige ou que o escopo precisa saber
SELECT count(*)                                                        AS members,
       count(*) FILTER (WHERE leader_id IS NOT NULL AND NOT has_leadership) AS leader_without_flag,
       count(*) FILTER (WHERE is_pastor AND leader_id IS NOT NULL)          AS pastor_with_leader,
       count(*) FILTER (WHERE leader_id IS NULL AND NOT is_pastor)          AS without_leadership,
       count(*) FILTER (WHERE spouse_id IS NOT NULL AND NOT EXISTS (
                SELECT 1 FROM public.members s WHERE s.id = m.spouse_id AND s.spouse_id = m.id)) AS asymmetric_spouse,
       count(*) FILTER (WHERE auth_user_id IS NOT NULL AND role_id IS NULL) AS account_without_role
  FROM public.members m;

-- 5. Ciclos na árvore (esperado: 0)
WITH RECURSIVE up AS (
  SELECT id AS start, leader_id, ARRAY[id] AS path, false AS cycle FROM public.members
  UNION ALL
  SELECT up.start, m.leader_id, up.path || m.id, m.id = ANY (up.path)
    FROM up JOIN public.members m ON m.id = up.leader_id WHERE NOT up.cycle)
SELECT count(DISTINCT start) AS members_in_cycle FROM up WHERE cycle;

-- 6. Referências às funções que serão removidas ou restritas (funções e políticas)
SELECT p.proname
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.prosrc ~ '(is_in_same_ministry|get_ministry_root|is_leader_of_visible_member|can_manage_own_cell|user_has_permission|is_admin)\s*\(';
SELECT schemaname, tablename, policyname
  FROM pg_policies
 WHERE coalesce(qual, '') || coalesce(with_check, '')
       ~ '(is_in_same_ministry|get_ministry_root|is_leader_of_visible_member|can_manage_own_cell|user_has_permission|is_admin)\s*\(';

-- 7. Privilégios atuais
SELECT relname, relacl FROM pg_class
 WHERE oid IN ('public.roles'::regclass, 'public.role_permissions'::regclass, 'public.members'::regclass);
SELECT attname, attacl FROM pg_attribute
 WHERE attrelid = 'public.members'::regclass AND attname IN ('role_id', 'auth_user_id');

-- 8. Migrations aplicadas (o E2.01 inteiro precisa estar lá)
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 12;
```
Se a consulta 2 mostrar mais de uma função de sistema, ou uma padrão que não é a Membro, ou se a 1 não tiver "Líder" e "Membro" com esses nomes, a tarefa 1 para e volta ao `architect`. Mais de uma função de sistema quebra a migration 1. Os outros dois casos mudam a DA-10 e a RN-16.

### Verificações obrigatórias (para o QA)
**pgTAP** (`supabase/tests/database/e202_*.test.sql`, autocontido, com `ROLLBACK`). A massa é a do spec, com as 11 pessoas, as 3 células, os 3 relatórios, Ester e Lúcia, Hugo sem função e a conta X, mais:
- um ciclo de dois membros;
- um cônjuge assimétrico;
- um pastor com líder.

Verificações:
- **Escopo:**
  - a tabela "O que cada um vê", linha a linha, para membros, células e relatórios, na view e na tabela sob o RLS;
  - a equivalência entre a descida e a subida, para todo par;
  - DT-28: as duas formas vazias sem permissão de escopo.
- **Paridade (E1.08 e E2.01 atualizados):**
  - para cada persona, os ids de cada view são iguais aos da tabela sob o RLS e aos da função de linha;
  - as views de excluídos usam o mesmo escopo;
  - um caso só com `view_own_reports` e outro só com `view_all_reports`.
- **RN-23:**
  - `authenticated` sem EXECUTE em `user_has_permission`, `is_admin`, `role_effective_permissions`, `viewer_permissions` e `_viewer_scope_anchors`;
  - as quatro obsoletas não existem;
  - nenhum `prosrc` nem política as cita;
  - depois do PR 6: `select role_id from members` dá 42501, e `members_view.role_id` vem nulo para Pedro e preenchido para Rita e no próprio cadastro;
  - `my_access` e `role_options` só sobre quem chama.
- **Escrita:** todo critério "pela API" das RN-09 a RN-21, com o código e a mensagem. Inclui:
  - o caso de André e Beatriz (`zz_` depois do cônjuge);
  - o ensaio do `check_member_insert`: nada gravado, nenhum evento de auditoria, mesmas recusas do INSERT real;
  - a DA-2, a DA-5 e a DA-7.
- **Funções:**
  - RN-16 depois da migration 1, num banco com uma função "Recepção" com `view_members`;
  - RN-17 com uma permissão nova simulada (`ALTER TYPE … ADD VALUE` dentro do teste, numa transação separada);
  - RN-19: a troca atômica e a recusa de ficar sem padrão no *commit*;
  - RN-20 com membro excluído;
  - RN-22: `view_members` dado pela API não libera nada.
- **Grants e estrutura:** `roles_view` só com SELECT para `authenticated` e dona `postgres`; RPCs sem EXECUTE para `anon`; as migrations rodam de novo sem erro.

**Concorrência** (script com duas conexões e `pg_sleep`, como no E2.01):
- duas trocas da função padrão;
- excluir uma função × atribuí-la a alguém, nas duas ordens;
- dois administradores tirando a função um do outro;
- Rita move Caio para Diego × Pedro edita Caio.

Cada cenário termina num estado válido, com a mensagem amigável ou 40P01 (tente de novo).

**Volume:** as metas do risco 8, com o `EXPLAIN` anexado ao PR.

**Vitest:**
- `permissions.ts`: catálogo completo e ordem dos grupos;
- `access.ts`: menu por persona (UX-08), rotas, subtítulos, cabeçalho do Dashboard e impressão digital;
- `member-form.ts`: os casos da T6 e da UX-21;
- `roles.ts`;
- `codes.ts` e `texts.ts`.

**Playwright:**
- os critérios de UX de cada PR;
- o *smoke* de login;
- duas sessões para a RN-08 e a UX-10.

## Tarefas
_Seção do `architect`._

Seis PRs no `mci-connect`. **Tudo começa depois de todo o E2.01 em produção.**
- Dentro de cada PR, o banco vai primeiro, e os tipos são regenerados antes do front.
- Cada desenvolvedor aciona o `code-reviewer` ao terminar a sua tarefa; esse passo não aparece na tabela.
- Na coluna RNs, os números são das regras deste spec. Na coluna UX, os dos critérios `UX-`.

| # | Responsável | Descrição | Arquivos | RNs | UX | Depende de |
|---|---|---|---|---|---|---|
| **PR 1: banco (compatível com o front em produção)** | | | | | | |
| 1 | backend-developer | Reler as migrations finais do E2.01 e confirmar os nomes usados aqui. Entregar o SQL de [Conferências em produção](#conferências-em-produção-tarefa-1) para o usuário rodar. Parar e voltar ao `architect` nos casos listados ali ou se o E2.01 divergir. | — | 16, 17, 19, 22, 23 | — | E2.01 em produção |
| 2 | backend-developer | Migrations 1 e 2: dados das funções (semeadas, aposentadas, padrão, Administrador e `has_leadership`); âncoras, descida, subida e funções de linha; permissões efetivas e atalho `is_system`; `user_has_permission` e `is_admin` restritas; `viewer_covers_role`, `can_assign_role`, `can_submit_report`, `default_role_id`, `active_permissions` e `viewer_tree_roots`; índices e constraints de `roles`; `members_role_id_idx`. | `supabase/migrations/<ts>_e202_01_data.sql`, `supabase/migrations/<ts>_e202_02_scope.sql` | 01, 05, 06, 16, 17, 22, 23 | — | 1 |
| 3 | backend-developer | Migration 3 (leitura): as 4 views do E1.08, as 3 de excluídos e a `roles_view`; políticas de `members`, `cells`, `cell_reports`, participantes, `roles`, `role_permissions` e `events`; `member_names`; ramo de raízes da `ministry_tree_nodes` (DA-6); `_dashboard_assert_access`; `my_access`; `role_options`; REVOKE das funções com id; DROP das quatro obsoletas; tabela de predicados canônicos no cabeçalho. | `supabase/migrations/<ts>_e202_03_read.sql` | 01 a 08, 15, 22, 23 | dados de 08, 12, 13, 15, 21, 26, 27, 28 | 2 |
| 4 | backend-developer | Migration 4 (escrita): `aa_enforce_member_write_rules` reescrita (regra 4 e códigos), `ac_enforce_member_scope`, `zz_enforce_member_visible_after`, triggers de célula, relatório e participantes, triggers de `roles` e `role_permissions` e o constraint trigger da padrão; `save_role`, `delete_role` e `check_member_insert`; ajustes em `set_cell_report_participants` e `restore_member`. `create-user-admin` com o ensaio, sem `resolveRole`. Regenerar o `types.ts`. | `supabase/migrations/<ts>_e202_04_write.sql`, `supabase/functions/create-user-admin/index.ts`, `src/integrations/supabase/types.ts` | 09 a 14, 17 a 21 | dados de 05, 07, 16, 22 | 3 |
| 5 | qa | pgTAP de [Verificações](#verificações-obrigatórias-para-o-qa): escopo, equivalência, paridade, RN-23, escrita, funções, grants, concorrência (4 cenários) e volume com `EXPLAIN`. Atualizar os testes do E1.03, do E1.08 e do E2.01 que mudam de resultado (escopo novo, códigos `app_error`, funções removidas). | `supabase/tests/database/e202_*.test.sql`, testes existentes afetados, script de concorrência | 01 a 23 | — | 4 (escreve em paralelo com 3 e 4, a partir dos contratos) |
| **PR 2: acesso, menu e rotas** | | | | | | |
| 6 | frontend-developer | Fundação:<br>- `src/lib/access/{permissions,access,codes,texts}.ts`, com Vitest;<br>- `use-access` (foco, navegação, 42501 e o aviso "Seu acesso foi atualizado.");<br>- `AuthContext` com `my_access` e sem `isSystem`;<br>- `AppSidebar` (T1: itens, função embaixo do nome, "Ver meus dados", 44 px);<br>- `NoAccess` (T12) nas rotas;<br>- `AsyncMemberSelect` e `PaginatedSelect` com `savedLabel`, `aria-describedby` e o texto de busca vazia (P11). | `src/lib/access/*`, `src/hooks/use-access.ts`, `src/contexts/AuthContext.tsx`, `src/components/{AppSidebar,NoAccess,AsyncMemberSelect}.tsx`, `src/components/select/PaginatedSelect.tsx`, `src/App.tsx` | 07, 08, 22, 23 | 08, 09, 10, 11, 29, 30, 31, 32 | PR 1 em produção |
| 7 | ux-designer | Revisão de UI do PR 2 (T1, T12, P11, P13) em 320, 360 e 1280 px, nos temas claro e escuro. | — | — | 08 a 11, 29 a 32 | 6 |
| 8 | qa | Vitest (`access`, `permissions`); testes de componente (UX-08, 09, 30); Playwright (UX-10 com duas sessões, UX-11, *smoke* de login). | `src/**/*.test.ts(x)`, `e2e/acesso-*.spec.ts` | 07, 08, 22 | 08 a 11, 30 | 6 |
| **PR 3: Funções** | | | | | | |
| 9 | frontend-developer | `src/lib/roles/roles.ts` (Vitest); `use-roles`; `Roles.tsx` (T2: cards e tabela, Administrador só para leitura, contagem, badge P6); `RoleForm` (T3: P1, grupos P14, dicas, padrão travada e aviso de troca, descartar); fluxo de exclusão (T4: bloqueio antecipado e confirmação). | `src/lib/roles/roles.ts`, `src/hooks/use-roles.ts`, `src/pages/Roles.tsx`, `src/components/roles/{RoleForm,RoleDeleteFlow}.tsx` | 16, 17, 19, 20, 22 | 01 a 07 | 6 |
| 10 | ux-designer | Revisão de UI do PR 3 (T2 a T4, P1, P6, P12, P14). | — | — | 01 a 07, 29, 31 | 9 |
| 11 | qa | Testes de componente (UX-01, 02, 03, 05); Playwright (UX-04, 06, 07; RN-17, 19, 20 pela tela). | `src/pages/Roles.test.tsx`, `e2e/funcoes.spec.ts` | 16, 17, 19, 20, 22 | 01 a 07 | 9 |
| **PR 4: Membros** | | | | | | |
| 12 | frontend-developer | `src/lib/access/member-form.ts` (Vitest); `use-role-options`; `Members.tsx` (T5: subtítulo e bloqueio do "Novo membro" pela RN-19); `MemberForm` (T6: pastor e sem liderança, Líder obrigatório e preenchido, Cônjuge com dica, Função por `role_options`, "Meus dados" só para leitura, recusas da T11 com foco, `select('id')`, `spouse_name` e `leader_name` como `savedLabel`). | `src/lib/access/member-form.ts`, `src/hooks/use-role-options.ts`, `src/pages/Members.tsx`, `src/components/MemberForm.tsx`, `src/lib/members/fields.ts` | 09, 10, 11, 18, 19, 23 | 15 a 22 | 6 |
| 13 | ux-designer | Revisão de UI do PR 4 (T5, T6, T11). | — | — | 15 a 22, 29, 31 | 12 |
| 14 | qa | Vitest (`member-form`); testes de componente (UX-18, 21, 22); Playwright (UX-16, 17, 19, 20; RN-09, 10, 11, 18, 19 pela tela, com a massa). | `src/**/*.test.tsx`, `e2e/membros-escopo.spec.ts` | 09, 10, 11, 18, 19, 23 | 15 a 22 | 12 |
| **PR 5: Células, Relatórios, Dashboard e Ministérios** | | | | | | |
| 15 | frontend-developer | `Cells.tsx` (T7: "Novo relatório" por `can_submit_report`, "Editar" só com `edit_cell`, subtítulo); `CellForm` (dica e recusa da RN-09 c); `CellReports.tsx` e `CellReportForm` (T8: botão por `can_submit_some_report`, seletor `is_active` e `can_submit_report` por `is_mine`, célula única preenchida, aviso com `member_visible`, recusas); `Dashboard.tsx` (T9: cabeçalho, sem acesso, atalho em diálogo); `Ministries.tsx` (T10: estado vazio com o botão). | `src/pages/{Cells,CellReports,Dashboard,Ministries}.tsx`, `src/components/{CellForm,CellReportForm}.tsx`, `src/hooks/use-cell-options.ts` | 02, 03, 04, 07, 12, 13, 14, 22 | 12, 13, 14, 23 a 28 | 6 |
| 16 | ux-designer | Revisão de UI do PR 5 (T7 a T10). | — | — | 12 a 14, 23 a 29, 31 | 15 |
| 17 | qa | Testes de componente (UX-12, 15, 25); Playwright (UX-13, 14, 23, 24, 26, 27, 28; RN-03, 04, 12, 13, 14 pela tela, com a massa). | `src/**/*.test.tsx`, `e2e/celulas-relatorios-escopo.spec.ts` | 02, 03, 04, 12, 13, 14 | 12 a 15, 23 a 28 | 15 |
| **PR 6: fechar a leitura e a escrita diretas de funções** | | | | | | |
| 18 | backend-developer | Migration 5: SELECT de `roles` e `role_permissions` só com `view_roles` ou `manage_roles`; sem políticas nem privilégios de INSERT, UPDATE, DELETE e TRUNCATE para `anon` e `authenticated`; `members_view.role_id` mascarado e REVOKE de `members.role_id`. Atualizar o teste de colunas do E1.08 (PR 5). Conferir por busca que o front não usa as duas tabelas nem lê `role_id` de outra pessoa. pgTAP. | `supabase/migrations/<ts>_e202_05_close_roles.sql`, `supabase/tests/database/e202_close_roles.test.sql` | 17, 19, 20, 23 | — | PRs 2 a 5 **promovidos em produção** |
| 19 | qa | pgTAP da migration 5; *smoke* em produção depois do deploy (login, menu, Funções, cadastro). | — | 23 | — | 18 |
| **Fechamento** | | | | | | |
| 20 | architect | Revisão final dos 6 PRs. Atualizar o `CLAUDE.md` (estado atual, armadilhas e "Problemas conhecidos"). O aceite da fase 2 é do `product-owner`. | `CLAUDE.md` | — | — | 5, 8, 11, 14, 17, 19 |

**Ordem de execução:**
- PR 1: 1 → 2 → 3 → 4. A 5 é escrita em paralelo com a 3 e a 4 e roda depois da 4.
- PR 2: 6 → (7 ∥ 8).
- Depois do PR 2, em paralelo:
  - PR 3: 9 → (10 ∥ 11);
  - PR 4: 12 → (13 ∥ 14);
  - PR 5: 15 → (16 ∥ 17).
- PR 6 (18 → 19), depois dos PRs 2 a 5 promovidos.
- 20 no fim.

**Critérios de pronto**
1. **Todas as tarefas de banco:**
   - as migrations rodam num banco zerado depois das existentes e rodam de novo sem erro;
   - nenhuma função nova tem EXECUTE para `anon`;
   - as internas não têm EXECUTE para `authenticated`;
   - a `roles_view` tem só SELECT para `authenticated` e dona `postgres`;
   - o `types.ts` está regenerado;
   - os testes do E1.03, do E1.08 e do E2.01, atualizados, continuam passando.
2. **Tarefa 2:**
   - a migration 1 deixa as três funções semeadas exatamente como a tabela, a Membro como padrão e nenhuma linha de permissão aposentada;
   - num banco com duas funções `is_system`, ela falha sem mudar nada;
   - equivalência entre a descida e a subida, com ciclo na massa.
3. **Tarefa 3:**
   - a tabela "O que cada um vê" passa para as 11 pessoas e a conta X, nas views e sob o RLS;
   - nenhuma referência às funções removidas.
4. **Tarefa 4:**
   - todo critério "pela API" passa, com o código e a mensagem do spec;
   - o ensaio do `check_member_insert` não deixa linha nem evento;
   - a `create-user-admin` não cria conta quando o ensaio recusa;
   - os 4 cenários de concorrência terminam num estado válido.
5. **Tarefas 6, 9, 12 e 15:**
   - `npm run lint`, `npm test` e `npm run build` verdes;
   - sem `any` e sem asserção de tipo (`as Tipo`) nos arquivos novos (`as const` é permitido);
   - nenhuma regra de domínio dentro de componente (fica em `src/lib/`);
   - nenhum texto do spec fora de `src/lib/access/texts.ts` ou dos módulos de domínio;
   - nenhuma leitura de `members`, `roles` ou `role_permissions` direto da tabela;
   - nenhum uso de `isSystem`.
6. **Tarefa 6:**
   - uma rota sem permissão não faz nenhuma requisição de dados;
   - o acesso é relido no foco, na navegação e no 42501, e o aviso aparece uma vez.
7. **Tarefa 9:** a troca da padrão e a gravação da função são uma chamada só, e a exclusão de função usa só `delete_role`.
8. **Tarefa 12:** o formulário nunca mostra sucesso com 0 linhas, e as recusas de regra aparecem no campo quando o `detail.field` existe.
9. **Tarefa 15:** o seletor de célula de Caio oferece só C1 e C2, e o de Carla já vem com C1.
10. **Tarefa 18:** depois do deploy, nenhuma tela quebra; `select * from roles` como Pedro volta vazio; a `role_id` de outra pessoa não sai para Pedro, nem pela view nem pela tabela.
11. **Tarefas 7, 10, 13 e 16:** o `ux-designer` dá o veredito e lista os ajustes, que voltam ao `frontend-developer` antes de o QA fechar o PR.

## Testes
_Seção do `qa`._

Arquivos (em `mci-connect/supabase/tests/`): pgTAP `database/e202_01_scope`, `e202_02_rn23_grants`, `e202_03_write_members`, `e202_04_write_cells_reports`, `e202_05_roles`, `e202_06_read_contract` (cada um autocontido, com a massa do spec); `concurrency/e202_concurrency.sh` (4 cenários) e `e202_migrations.sh` (migrations de novo, duas `is_system`, Recepção, permissão nova); `volume/e202_volume.psql` (metas do risco 8).

| RN | Testes | Resultado |
|---|---|---|
| 01 a 06 | `e202_01` (tabela "O que cada um vê" na view e na tabela, casal, inativo, excluído, descida × subida com ciclo, DT-28, paridade por persona), `e202_06` (raízes DA-6) | passa |
| 07, 08 | `e202_01` (conta X, Hugo, escopo na hora), `e202_03`, `e202_05` (Hugo só com Enviar) | passa |
| 09, 10, 11 | `e202_03` (person_not_visible, would_leave_scope, André e Beatriz, `check_member_insert`, pastor, Ester, DA-2/DA-7/DA-11) | passa |
| 12, 13, 14, 15 | `e202_04` (célula, lançar, editar e excluir relatório, participantes, DA-5), `e202_01` (excluídos) | passa |
| 16, 17, 22 | `e202_05`, `e202_migrations.sh` (Recepção, `view_members`, permissão nova no banco de rascunho) | passa |
| 18, 19, 20, 21 | `e202_02` (`role_options`), `e202_03`, `e202_05` (`save_role`, `delete_role`), `e202_concurrency.sh` 1 a 3 | passa |
| 23 | `e202_02` (EXECUTE, obsoletas, `my_access`, `role_options`); "depois do PR 6" fica fora | passa |
| Grants e estrutura | `e202_02`; migrations de novo sem erro e duas `is_system` em `e202_migrations.sh` | passa |
| Concorrência (4 cenários) | `e202_concurrency.sh` | passa |
| Volume (risco 8) | `e202_volume.psql` | 1 meta fora |

Resultados do PR 1:
- `supabase test db`: 22 arquivos, 2.604 testes, passa (os do E1.04, E1.08 e E2.01 foram atualizados para o escopo novo, as funções novas e as colunas novas das views).
- `e202_concurrency.sh`: 48 verificações; `e202_migrations.sh`: 28; `e201_concurrency.sh` (ajustado): passa.
- Playwright (`--workers=1`, stack local): 138 de 162 passam (5 puladas, 18 não rodaram depois de uma falha em série). Falham: `grant_type=password` (a stack local não desliga o provedor de e-mail) e UX-19 (precisa de mais de 10 células na base, e o banco foi zerado). A massa de 6 specs trocou `view_members` por `view_all_church`.
- Volume (20 mil membros, 1.500 células, 100 mil relatórios, 800 mil participações), pastor e G12: listas com contagem de 23 a 123 ms; `dashboard_summary` 86 a 103 ms; `my_access` 8 a 16 ms; PATCH de membro 3 ms. **Fora da meta:** lançamento com 30 participantes, 880 ms (pastor) e 390 ms (G12), contra 300 ms. A política de INSERT de participantes chama `viewer_can_insert_cell_report_participant`, que lê a `cell_reports_view` por id (cerca de 15 ms por chamada, uma por participante).
