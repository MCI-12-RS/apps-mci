# E2.08: Cadastro de células

> Status: desenho pronto, sem implementação. Negócio escrito em 2026-11-24 pelo `product-owner`, sem regras "a confirmar". Experiência (UX) escrita no mesmo dia pelo `ux-designer`; as pendências PO-UX-1 a PO-UX-10 foram resolvidas pelo PO no mesmo dia (P-CEL-14 a P-CEL-23). Solução técnica e Tarefas escritas no mesmo dia pelo `architect`, com as respostas às AQ-1 a AQ-9 e os pontos "definidos pelo architect" DA-1 a DA-12. Ficam para o usuário revisar no PR os padrões P-CEL-01 a P-CEL-23, as DA-1 a DA-12 e as perguntas Q-1 a Q-6, que não bloqueiam (a T9 da UX mostra a tela em cada resposta, e a Solução técnica dá o custo de cada uma). A conferência em produção (tarefa 1) roda antes do PR 2. **PR 1 (banco: célula inativa) implementado em 2026-11-25** na branch `feat/E2.08-pr1-celula-inativa` do `mci-connect` (tarefas 2 e 3; migration `20261126120000_e208_01_inactive_cell_reports.sql`), aguardando merge e "Deploy: banco". **PR 2 (banco: regras do cadastro, com o ajuste mínimo do front) implementado em 2026-11-25** na branch `feat/E2.08-pr2-regras-celula`, criada a partir da do PR 1 (tarefas 4 a 7; migration `20261126130000_e208_02_cell_rules.sql`); a conferência em produção de 2026-11-25 não teve nenhuma linha. Vai ao ar depois do PR 1: merge, "Deploy: banco" e promote em seguida. **PRs 3, 4 e 5 (front: CEP comum; lista, relatório e atalho; formulário de célula) implementados juntos em 2026-11-26** na branch `feat/E2.08-pr3-5-telas-celula`, criada a partir da do PR 2 (tarefas 8 a 16, sem migration); vão ao ar depois do PR 2 em produção: merge e promote. Revisão final do passo (tarefa 17) feita no mesmo dia; ver Testes.
> Slug: `e2-08-cadastro-celulas` · Paridade com o legado: sim (CEL-01 a CEL-04, com a D4). Tem regras novas: a situação ativa ou inativa da célula (o legado não tem), a célula nova sempre ativa, a célula inativa sem relatório novo e o endereço do anfitrião com a máscara do E1.08.

## Negócio
_Seção do `product-owner`. Escrita em 2026-11-24 e atualizada no mesmo dia com as decisões do PO sobre as pendências PO-UX-1 a PO-UX-10 da seção Experiência (UX) (P-CEL-14 a P-CEL-23). Fontes:_
- _o passo E2.08 em Progresso, a seção 3.4 (CEL), as decisões D2, D3 e D4 e as seções 5.3 a 5.6 do [`docs/migracao.md`](../migracao.md);_
- _o `CLAUDE.md` da raiz: células do legado e do novo, Armadilhas e matriz de paridade;_
- _o legado: `CellDtoValidator`, `CellService`, `CellController`, `ReportApp`, o filtro de células de `QueryingExtensions.cs`, as telas `pages/Cells`, `components/Address` e `components/MemberPicker`;_
- _o `mci-connect` na `origin/main` (`fdcbe50`): `src/components/CellForm.tsx`, `src/lib/cells/*`, `src/hooks/use-cell-options.ts`, `src/hooks/use-member-address.ts`, `src/pages/Cells.tsx` e as migrations de `cells` (inclusive as do PR 1 do E2.01);_
- _os specs [E2.01](e2-01-exclusao-logica.md) (RN-04, RN-06, RN-07, RN-11, RN-17, DT-08), [E2.02](e2-02-perfis-escopo.md) (RN-03, RN-08, RN-09, RN-12, RN-13, D3), [E2.04](e2-04-validacoes-membro.md) (tipos de regra, recusas, carga), [E2.05](e2-05-auditoria-autor.md) (RN-04, RN-07), [E1.08](e1-08-paginacao-servidor.md) (RN-11, D-2) e [E2.06](e2-06-hierarquia-totais.md) (RN-06 a RN-08 e RN-11; ainda sem commit, só lido), e o rascunho do [E2.07](e2-07-filtros-membros.md) (RN-10 e P-FIL-07; sem commit, só lido)._

### Contexto e objetivo
No legado, a célula tem líder, timóteo e anfitrião, dia da semana, horário, tipo ("Modalidade" na tela) e endereço. O cadastro é só do administrador e do administrador geral. A tela confere tudo a cada gravação e mostra os erros juntos, cada um no seu campo:
- **Pessoas:** líder, timóteo e anfitrião obrigatórios. A mesma pessoa pode ocupar mais de um papel, e qualquer membro não excluído do escopo pode ser escolhido, inclusive o inativo.
- **Dia e horário:** obrigatórios, sem valor sugerido. O horário é gravado como `HH:mm`.
- **Tipo:** Evangelística (padrão), Discipuladora ou Macrocélula.
- **Endereço:** opcional, com CEP. Escolher o anfitrião copia o endereço dele para a célula.
- **Sem situação:** o legado não tem célula inativa. Uma célula que parou de se reunir era excluída.
- **Sem unicidade:** a mesma pessoa pode liderar várias células, e o mesmo anfitrião pode receber várias, sem conferência de dia, horário ou endereço.

Hoje o novo (conferido na `origin/main`, `fdcbe50`, em 2026-11-24):
- **Formulário (`CellForm`):**
  - Só o líder é obrigatório, e só na tela ("O Líder é obrigatório." num aviso). Timóteo ("Timóteo (Auxiliar)") e anfitrião são opcionais.
  - Dia e horário já vêm preenchidos com Sábado e 19:00. Quem não mexe grava uma célula de sábado às 19:00 sem ter escolhido isso.
  - O interruptor "Célula Ativa" aparece também no cadastro novo.
  - O endereço não tem CEP. O CEP só chega copiado do anfitrião.
  - Ao escolher o anfitrião, o endereço é completado campo a campo, mantendo o valor anterior onde o do anfitrião está vazio ou mascarado (E1.08). Quem não vê a rua do anfitrião novo fica com a rua da célula antiga e o bairro do anfitrião novo: um endereço misturado.
  - As recusas do banco aparecem num aviso, com a mensagem técnica.
- **Banco:**
  - Líder, timóteo, anfitrião, dia e horário aceitam vazio. Nem o líder é obrigatório no banco.
  - O tipo e o dia são texto livre. Sem dia ou horário, o banco grava Sábado e 19:00.
  - Uma pessoa excluída já é recusada em qualquer papel (`enforce_cell_links`, PR 1 do E2.01, em produção).
  - Quem tem "Editar Próprio Cadastro" ainda edita a própria célula, como líder ou timóteo. O E2.02 corrige.
- **Situação (`is_active`):** a célula inativa sai dos totais (D2) e do card de pendentes do Dashboard e não aparece no seletor de célula do relatório. Mas o botão "Novo relatório" da lista de Células continua aparecendo nela, e o banco aceita o relatório. Ela continua contando no Dashboard em "células por tipo".

Objetivo do passo:
- impor no banco as regras CEL-01 a CEL-03, com a D4: as três pessoas, o dia, o horário e o tipo, para todos os caminhos de gravação;
- definir o que é a célula inativa e o que muda com ela, porque o legado não tem essa situação;
- corrigir o endereço copiado do anfitrião, sem misturar endereços e respeitando a máscara do E1.08;
- confirmar a CEL-04 (quem cadastra, edita e exclui) sobre as regras do E2.02;
- migrar as células do legado sem perder nenhuma, com a lista do que precisa ser corrigido.

### Termos
- **Pessoas da célula:** o líder, o timóteo e o anfitrião (E2.02). Cada um é um **papel** na célula.
- **Timóteo:** auxiliar do líder e líder em formação (1 Tm 1:2; 2 Tm 2:2). Não é "assistente".
- **Anfitrião:** quem abre a casa para a célula.
- **Tipo:** Evangelística, Discipulado ou Macrocélula. "Discipulado" é a célula discipuladora do legado (CEL-03).
- **Situação:** ativa ou inativa.
- **Inativar:** marcar que a célula parou de se reunir (Termos do E2.01). A célula continua cadastrada, com o histórico, e pode ser reativada.
- **Excluir:** tirar de uso um cadastro que não deveria existir (E2.01). Não é inativar.
- **Endereço da célula:** o lugar da reunião (CEP, rua, número, complemento, bairro, cidade e estado). É guardado na própria célula.
- **Dia e horário:** o dia da semana e a hora da reunião, no horário de Brasília (`America/Sao_Paulo`), sem conversão de fuso.
- **Semana:** de domingo 00:00 a sábado 23:59, no horário de Brasília.
- **Regra do tipo (a), "sempre":** vale para todas as células o tempo todo, inclusive as da carga do legado, como no E2.04.
- **Regra do tipo (b), "no que muda":** vale na célula nova e, numa edição, para o campo que muda.
- **Carga do legado:** os scripts de transformação, backfill e reconciliação da migração (E4.06, E4.07 e E4.09).
- **Hoje:** a data no horário de Brasília.

### Personas e permissões
Os nomes entre aspas são os rótulos da tela de Funções (RN-22 do E2.02).

| Persona | Quem é | Permissões | O que faz neste spec |
|---|---|---|---|
| IG Quem vê a igreja toda | Rita, função Administrador | "Criar Célula", "Editar Célula", "Excluir Célula", "Visualizar Toda a Igreja" e "Ver Dados Sensíveis" | cadastra, edita, inativa e reativa qualquer célula, com qualquer pessoa não excluída |
| MI Quem vê só o ministério | Pedro, função Líder | "Criar Célula", "Editar Célula", "Excluir Célula" e "Visualizar Seu Ministério", sem "Ver Dados Sensíveis" | o mesmo, só no escopo e com pessoas visíveis (E2.02); recebe do anfitrião só bairro, cidade e estado |
| PC Pessoa da célula | Caio (timóteo) e Carla (anfitriã), função Membro | "Enviar Relatório das Próprias Células", sem "Editar Célula" | não edita a célula (RN-12 do E2.02); lança o relatório dela enquanto ela está ativa |
| SP Sem permissão | sem "Criar Célula" nem "Editar Célula" | — | não grava (E2.02); nenhuma regra deste spec chega a ele |
| SI Sistema | service role e rotinas internas (restaurar, do E2.01) | — | segue as regras do tipo (a) e a RN-11 |
| CG Carga do legado | scripts E4.06 a E4.09 | — | tratamento próprio (RN-13) |

### Histórias
- Como quem cadastra células, quero que toda célula tenha líder, timóteo, anfitrião, dia, horário e tipo, para que o relatório, a situação e os totais funcionem para ela.
- Como quem cadastra, quero ver de uma vez tudo o que falta, para corrigir antes de salvar.
- Como quem cadastra, quero que o endereço venha do anfitrião, para não digitar de novo, sem misturar o endereço antigo com o novo.
- Como líder, quero escolher a mesma pessoa em mais de um papel, por exemplo quando a célula é na casa do próprio líder, como no legado.
- Como liderança, quero inativar uma célula que parou de se reunir sem perder o histórico, para que ela saia dos totais e das pendências, e reativá-la quando voltar.
- Como igreja, quero migrar as células do legado sem perder nenhuma, com a lista do que precisa ser corrigido.

### Decisões

#### Decisões do usuário e de passos anteriores
| Decisão | O que vale aqui | Onde |
|---|---|---|
| D4 (2026-11-23) | Líder, timóteo e anfitrião são obrigatórios na célula, como no legado. | RN-02 |
| D2 (2026-11-23) | Os totais contam só células ativas. | RN-11 |
| D3 (2026-11-23) | Lançam o relatório o líder, o timóteo e o anfitrião da célula, mais quem gerencia células no escopo. | RN-08, RN-11 |
| RN-04, RN-06, RN-07, RN-11, RN-17 e DT-08 do E2.01 | Ninguém excluído ocupa um papel; a célula excluída não é editada; a célula com papel não deixa excluir a pessoa; a restauração confere as três pessoas. | RN-04, RN-11, RN-12 |
| RN-03, RN-08, RN-09, RN-12 e RN-13 do E2.02 | A célula entra no escopo por qualquer uma das três pessoas; só se escolhe quem se vê; ser pessoa da célula não dá direito de editá-la; as mudanças valem na hora. | RN-04, RN-08, RN-12 |
| RN-11 e D-2 do E1.08 | Rua, número, complemento e CEP de um membro só saem para quem vê os dados sensíveis; bairro, cidade e estado saem para todos. | RN-09, RN-10 |
| RN-04 e RN-07 do E2.05 | A situação e o endereço da célula (com o CEP) contam como alteração; a autoria aparece em "Editar célula". | RN-09, RN-11 |
| RN-06, RN-07, RN-08 e RN-11 do E2.06 | O total de células conta as ativas e não excluídas lideradas na subárvore; inativar e reativar mudam os totais na mesma operação; o G12 da célula é o do líder. | RN-04, RN-11 |
| P-VAL-01, P-VAL-18, P-VAL-19 e RN-19 do E2.04 | Regras dos tipos (a) e (b); todos os erros juntos; formato ao sair do campo; ordem das recusas. | RN-01, RN-14 |

#### Padrões definidos por este spec (revisar no PR)
Estes pontos não estão nas fontes. O PO adotou a opção mais conservadora e coerente com o legado e com os specs anteriores. Nas regras, eles aparecem como "definida pelo spec", e o usuário pode mudar qualquer um na revisão do PR.

- **P-CEL-01, quase tudo é do tipo (a)** (RN-01).
  - No legado, toda célula tem as três pessoas, um dia, um horário e um tipo válidos. Por isso essas regras valem sempre, inclusive na carga.
  - Só duas regras são do tipo (b): a pessoa visível (RN-09 do E2.02) e a célula nova ativa (RN-11).
  - Não há aviso de dado antigo, como na RN-17 do E2.04: depois da publicação, nenhuma célula fica fora das regras do tipo (a).
- **P-CEL-02, dia e horário sem padrão** (RN-05, RN-06).
  - No legado, o formulário vinha sem dia e sem horário. No novo, vem com Sábado e 19:00, e o banco grava esses valores quando a API não manda.
  - Um padrão esconde a falta de escolha, o mesmo motivo da P-VAL-21 do E2.04.
  - Pela API, a célula sem dia ou sem horário é recusada.
- **P-CEL-03, tipo com padrão Evangelística** (RN-07), como no legado.
- **P-CEL-04, sem conflitos** (RN-03). A mesma pessoa em vários papéis e em várias células, e o mesmo anfitrião, endereço, dia e horário em várias células: tudo aceito, como no legado. As sugestões ficam nas perguntas Q-1 a Q-3.
- **P-CEL-05, pessoa inativa no papel** (RN-04). É aceita, como no legado. O formulário marca "(inativo)" ou "(inativa)" ao lado do nome, sem impedir salvar.
- **P-CEL-06, o endereço da célula não é dado sensível** (RN-09).
  - Ele aparece para todos que veem a célula, inclusive rua e número, porque é o lugar da reunião. É o que o legado e o novo já fazem.
  - A máscara do E1.08 continua só no cadastro de membro.
  - Consequência: quando a célula é na casa do anfitrião, quem não vê os dados sensíveis dele conhece a rua pela célula.
- **P-CEL-07, endereço do anfitrião por inteiro** (RN-10).
  - Como no legado, escolher o anfitrião substitui o endereço inteiro. Hoje o novo completa campo a campo e pode misturar dois endereços.
  - Com a máscara, os campos que quem edita não vê ficam vazios.
  - Quando nada do endereço do anfitrião está disponível, o endereço não muda, e a mensagem é uma só, para não revelar se o anfitrião tem endereço.
- **P-CEL-08, CEP no formulário** (RN-09). Volta, como no legado, e preenche o endereço como no cadastro de membro.
- **P-CEL-09, célula nova sempre ativa** (RN-11). Inativar pressupõe que a célula existiu. O interruptor só aparece na edição, e a API recusa a célula nova inativa.
- **P-CEL-10, célula inativa não recebe relatório novo** (RN-11).
  - É coerente com o seletor de célula do relatório, que já oferece só as ativas, e com "parou de se reunir".
  - Os relatórios que ela já tem continuam editáveis e excluíveis, ao contrário dos da célula excluída.
  - Para lançar o relatório de uma reunião anterior à inativação, reative a célula, lance e inative de novo.
- **P-CEL-11, pessoa excluída numa célula do legado** (RN-13). A liderança corrige no legado, e a carga não termina enquanto houver. A alternativa, migrar a célula como excluída, tiraria das listas uma célula que talvez ainda se reúna.
- **P-CEL-12, como as recusas aparecem** (RN-14). Todos os erros juntos, como no legado. O horário mostra o erro de formato ao sair do campo, como na P-VAL-19 do E2.04.
- **P-CEL-13, rótulos** (Textos de tela).
  - "Timóteo", sem "(Auxiliar)", com uma dica curta. "Anfitrião" também ganha uma dica.
  - "Célula ativa" vem com a dica do que muda ao desligar.
  - Títulos e rótulos com só a primeira letra maiúscula: "Nova célula", "Editar célula", "Endereço da célula".
  - O campo continua "Tipo", como no novo e no glossário do `CLAUDE.md`. O legado dizia "Modalidade".
- **Vindos do desenho de UX (2026-11-24, PO-UX-1 a PO-UX-10 em "Experiência (UX)"):**
  - **P-CEL-14, dias como no legado** (PO-UX-1, RN-05). Na tela, os dias aparecem como "Segunda-feira" a "Sexta-feira", "Sábado" e "Domingo", nessa ordem, como no legado. O valor gravado continua o da RN-05, e a semana do sistema continua indo de domingo a sábado: a ordem da lista não muda a semana.
  - **P-CEL-15, horário digitado** (PO-UX-2, RN-06). Como no legado: um campo digitado, sempre em 24 h, e não o seletor de relógio. Ao sair do campo, "20" vira 20:00 e "7:30" vira 07:30. A leitura abreviada é só da tela.
  - **P-CEL-16, a situação na tela** (PO-UX-3, RN-11). A dica de "Célula ativa" segue a situação gravada; mudar o interruptor avisa o que acontece ao salvar; o título do formulário mostra "Inativa" quando a célula gravada está inativa; e o aviso de sucesso diz "Célula inativada." ou "Célula reativada.". Sem diálogo de confirmação, porque inativar se desfaz reativando.
  - **P-CEL-17, a orientação da recusa depende de quem lê** (PO-UX-4, RN-11 c). A primeira frase é a mesma para todos: "Esta célula está inativa e não recebe relatórios.". A orientação muda: quem tem "Editar Célula" lê "Para enviar um relatório, reative a célula."; os demais leem "Se ela voltou a se reunir, peça à sua liderança para reativá-la.". A sugestão da UX foi aceita no lugar do padrão dela: mandar reativar quem não pode reativar não orienta ninguém.
  - **P-CEL-18, "(inativo)" só de quem se vê** (PO-UX-5, RN-04). A pessoa fora do escopo de quem edita aparece só pelo nome, sem a marca. Dizer que ela está inativa revelaria um dado de quem a pessoa não vê (RN-06 do E1.08).
  - **P-CEL-19, voltar ao anfitrião gravado aplica o endereço dele** (PO-UX-6, RN-10). Toda escolha no seletor de Anfitrião aplica o endereço do escolhido, inclusive a volta ao anfitrião gravado. É o que impede a mistura que a P-CEL-07 quer evitar.
  - **P-CEL-20, o que o CEP preenche** (PO-UX-7, RN-09).
    - Rua, bairro, cidade e estado, onde o serviço de CEP traz valor. Número e complemento nunca mudam pelo CEP: o "complemento" do serviço descreve um trecho da rua (por exemplo, "lado ímpar"), e não a casa.
    - CEP não encontrado e falha do serviço viram avisos, que não impedem salvar.
    - O CEP que vem do anfitrião não dispara a busca.
    - A regra vale também no cadastro de membro, que hoje preenche o complemento com o texto do serviço (ver Impactos).
  - **P-CEL-21, "Cadastrar mais células" não volta** (PO-UX-8). Depois de salvar, "Nova célula" está a um toque, e a carga traz as células do legado.
  - **P-CEL-22, situação com ícone na lista** (PO-UX-9, RN-11). O badge "Inativa" ganha o ícone de pausa, para a célula sem "Novo relatório" se destacar sem depender de cor.
  - **P-CEL-23, textos da UX** (PO-UX-10). Todos foram aceitos, com a troca da P-CEL-17. Os que estão ligados a uma regra foram copiados para os "Textos de tela" deste Negócio. Os da T9 só valem se a pergunta correspondente virar regra.

### Regras de negócio
Nenhuma regra está "a confirmar". Os caminhos do legado são relativos a `g12app-net/`, com as abreviações do E2.01: `App/` = `G12App.Application/`, `Domain/` = `G12App.Domain/`, `Infra/` = `G12App.Infrastructure.Data/`, `API/` = `G12App.API/` e `UI/` = `G12App.API/ClientApp/src/`.

Correspondência com o plano: CEL-01 → RN-02 (com a RN-03 e a RN-04) · CEL-02 → RN-05 e RN-06 · CEL-03 → RN-07 · CEL-04 → RN-12 · D4 → RN-02.

| ID | Regra | Origem |
|---|---|---|
| RN-01 | **Alcance.** As regras deste spec valem para toda célula não excluída, ativa ou inativa, de qualquer tipo. Valem para qualquer gravação: pela tela, pela API e pelas rotinas internas (como restaurar, do E2.01), com ou sem a service role. A célula excluída não é alterada (RN-07 do E2.01).<br><br>São de dois tipos, como no E2.04:<br>(a) **Sempre:** valem para todas as células o tempo todo, inclusive as da carga: RN-02, RN-04 (pessoa excluída), RN-05, RN-06 e RN-07. A RN-11 (c) também vale sempre.<br>(b) **No que muda:** valem na célula nova e, numa edição, para o campo que muda: RN-04 (pessoa visível, do E2.02) e RN-11 (célula nova ativa).<br><br>A única exceção é a carga do legado. Ela não passa pelas regras do tipo (b) e entrega as células já dentro das regras do tipo (a) (RN-13). | CEL-01 a CEL-03; 5.3 do `docs/migracao.md` (CHECKs criados antes da carga); tipos: P-VAL-01 do E2.04; quais regras são de cada tipo: definida pelo spec (P-CEL-01) |
| RN-02 | **Líder, timóteo e anfitrião obrigatórios.**<br>- Toda célula tem os três. Nenhum fica vazio, no cadastro ou na edição, pela tela ou pela API.<br>- Numa edição, para tirar alguém de um papel, escolha outra pessoa no lugar. Quem não vê a pessoa que sai pode trocá-la por outra visível (RN-09 do E2.02).<br>- Vale para os três tipos, inclusive a Macrocélula.<br>- Na tela, os três campos são marcados como obrigatórios.<br>- Mensagens: "Escolha o líder da célula.", "Escolha o timóteo da célula." e "Escolha o anfitrião da célula."<br>- Tipo (a). | CEL-01; D4 (2026-11-23); legado (`Domain/Validators/CellDtoValidator.cs:16-26`; `UI/pages/Cells/details.js:225-232`: "Selecione o líder da célula", "Selecione o timóteo da célula", "Selecione o anfitrião da célula"); mensagens adaptadas do legado |
| RN-03 | **Mesma pessoa e sem conflitos.**<br>- A mesma pessoa pode ocupar mais de um papel na mesma célula: líder e anfitrião, líder e timóteo, ou os três.<br>- A mesma pessoa pode ter papéis em várias células e liderar mais de uma.<br>- O sistema não confere conflito: duas células podem ter o mesmo líder, o mesmo anfitrião, o mesmo endereço e o mesmo dia e horário.<br>- Marido e esposa podem ter papéis na mesma célula (por exemplo, ele líder e ela anfitriã), e cada um pode liderar a própria célula.<br>- Nenhum aviso aparece nesses casos. | legado (`G12App.Domain.Tests/CellDtoValidatorTests.cs:19-36`: célula válida com a mesma pessoa nos três papéis; `Domain/Validators/CellDtoValidator.cs:14-35` e `App/Services/CellService.cs:35-65`: nenhuma regra de unicidade ou de conflito); definida pelo spec (P-CEL-04) |
| RN-04 | **Quem pode ocupar um papel.**<br>- Qualquer membro não excluído: ativo ou inativo, pastor, com líder ou sem liderança, de qualquer sexo e de qualquer nível.<br>- **Excluído, não** (RN-06 do E2.01): os seletores não o oferecem, e a API recusa com "Este membro foi excluído e não pode ser escolhido.". Tipo (a).<br>- **Só quem se vê** (RN-09 b e c do E2.02): a pessoa que entra num papel precisa estar visível para quem grava, e a célula precisa continuar visível depois da gravação. Quem já estava num papel e não mudou fica como está. Tipo (b).<br>- **Inativo, sim:** no formulário, o nome aparece com "(inativo)" ou "(inativa)", conforme o sexo, no campo do papel e no seletor, também nas pessoas já gravadas ao abrir a edição. É um aviso, que não impede salvar.<br>- A marca só aparece para quem está no escopo de quem edita. A pessoa fora do escopo (por exemplo, a anfitriã de outro ministério de uma célula visível) aparece só pelo nome, como nome de referência (RN-06 do E1.08).<br>- Inativar um membro não o tira de nenhuma célula, e a célula continua com a situação que tinha. | legado (`UI/components/MemberPicker/index.js:46-49` e `Infra/Repositories/MemberRepository.cs:44-51`: a busca do seletor traz os não excluídos do escopo, sem filtrar os inativos); novo (`AsyncMemberSelect` com inativos, `enforce_cell_links`); E2.01 (RN-06, DT-08); E2.02 (RN-09, RN-12); marca "(inativo)": definida pelo spec (P-CEL-05); só para quem se vê: definida pelo spec (P-CEL-18, PO-UX-5) |
| RN-05 | **Dia da semana.**<br>- É obrigatório. Valores: Domingo, Segunda, Terça, Quarta, Quinta, Sexta e Sábado, gravados exatamente assim. Nenhum outro valor é aceito, nem pela API: "Segunda-feira", "segunda" e "Terca" são recusados.<br>- Na célula nova, o formulário vem sem dia escolhido. Quem cadastra escolhe.<br>- Pela API, a célula nova sem dia é recusada. O sistema não escolhe um dia por quem cadastra.<br>- Mensagens: "Escolha o dia da semana." e, para um valor fora da lista, "Dia da semana inválido. Escolha de domingo a sábado."<br>- Na tela, os dias aparecem como no legado: "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado" e "Domingo", nessa ordem. Escolher "Quarta-feira" grava "Quarta". As listas continuam com a forma curta ("Quarta · 20:00"). A ordem da lista não muda a semana do sistema, que vai de domingo a sábado.<br>- Tipo (a). | CEL-02; legado (`Domain/DTOs/CellDTO.cs:15`; `Domain/Validators/CellDtoValidator.cs:28-30`; `UI/pages/Cells/details.js:234-235` e `:415-428`: "Selecione o dia", sem dia escolhido, de "Segunda-feira" a "Domingo"); valores: `src/lib/cells/weekdays.ts`, `weekday_index` e 5.5 do `docs/migracao.md`; sem padrão e recusa pela API: definida pelo spec (P-CEL-02); rótulos e ordem: definida pelo spec (P-CEL-14, PO-UX-1) |
| RN-06 | **Horário.**<br>- É obrigatório: hora e minutos, de 00:00 a 23:59. É a hora local da reunião, no horário de Brasília, sem conversão de fuso.<br>- Os segundos não contam: "19:30:45", enviado pela API, é gravado como 19:30. "24:00" é recusado.<br>- Na célula nova, o formulário vem sem horário. Quem cadastra informa.<br>- Pela API, a célula nova sem horário é recusada.<br>- Na tela, o horário é digitado, sempre em 24 h, como no legado. Ao sair do campo, uma hora sem minutos vira a hora cheia ("20" vira 20:00, "7" vira 07:00) e "7:30" vira 07:30. Um valor que não pode ser lido assim (por exemplo, "730") fica como foi digitado, com o erro. Essa leitura abreviada é só da tela.<br>- Mensagens: "Informe o horário." e "Horário inválido. Informe a hora e os minutos, entre 00:00 e 23:59."<br>- Tipo (a). | CEL-02; legado (`UI/pages/Cells/details.js:237-238`: "Defina o horário"; `:434`: máscara "99:99"; `Domain/Mappings/DomainToDTOMappingProfile.cs:59-66`: gravado como `HH:mm`, sem segundos); 5.4 (horário fora do formato: corrigir no legado); sem padrão: definida pelo spec (P-CEL-02); horário digitado e leitura abreviada: definida pelo spec (P-CEL-15, PO-UX-2) |
| RN-07 | **Tipo.**<br>- É obrigatório: Evangelística, Discipulado ou Macrocélula, gravados exatamente assim.<br>- Na célula nova, vem Evangelística, como no legado, e quem cadastra pode trocar. Pela API, a célula nova sem tipo fica Evangelística.<br>- Qualquer outro valor é recusado, inclusive pela API ("Discipuladora", "evangelistica" ou vazio): "Tipo de célula inválido. Escolha Evangelística, Discipulado ou Macrocélula."<br>- As regras deste spec são as mesmas para os três tipos. A Macrocélula não tem regra própria (ver Q-5).<br>- Tipo (a). | CEL-03; legado (`Domain/Model/Enum/CellType.cs:3-8`; `UI/pages/Cells/details.js:50` e `:403-406`: padrão Evangelística); 5.5 (`0` Evangelística, `1` Discipulado, `2` Macrocélula); padrão: definida pelo spec (P-CEL-03) |
| RN-08 | **As mudanças valem na hora.** Dia, horário, situação e pessoas valem a partir da gravação, inclusive para a semana atual. Na consulta seguinte, tudo o que depende da célula já usa os valores novos:<br>- a situação do relatório e as pendências (CEL-05, E2.09, e o card de pendentes do Dashboard);<br>- as regras de lançamento que usam o dia e o horário da célula (REL-04, E2.11);<br>- quem lança o relatório (D3) e quem vê a célula (RN-03 e RN-08 do E2.02);<br>- os totais (RN-07 e RN-08 do E2.06).<br><br>Os relatórios já lançados não mudam: a data, o horário e os participantes continuam como foram enviados. O retrato das pessoas e do tipo da célula no relatório é do E2.11 (REL-09). | legado (`App/Services/ReportApp.cs:43-51` e `Domain/Extensions/QueryingExtensions.cs:246-277`: usam o dia e o horário atuais da célula); E2.02 (RN-08); E2.06 (RN-08); REL-09 |
| RN-09 | **Endereço da célula.**<br>- É opcional, como no legado. Campos: CEP, rua, número, complemento, bairro, cidade e estado.<br>- Não tem validação nova, como o endereço do membro no E2.04: nenhum campo é obrigatório, e o CEP e o estado não são conferidos além do que o formulário oferece.<br>- O campo CEP volta ao formulário. Quando a pessoa digita ou cola um CEP completo, ele preenche a rua, o bairro, a cidade e o estado, onde o serviço de CEP traz valor. Número e complemento nunca mudam pelo CEP.<br>- CEP não encontrado ou falha do serviço de CEP mostram um aviso, que não impede salvar: "CEP não encontrado. Confira o número ou preencha o endereço." e "Não foi possível buscar o endereço pelo CEP. Preencha o endereço."<br>- O CEP que chega com o endereço do anfitrião (RN-10) não dispara a busca, para a rua dele não ser trocada pela do serviço.<br>- O endereço é da célula, uma cópia: mudar depois o endereço do anfitrião não muda o da célula, e vice-versa.<br>- Não é dado sensível: aparece para todos que veem a célula, inclusive rua e número, porque é o lugar da reunião. A máscara do E1.08 continua valendo só no cadastro de membro. | legado (`UI/components/Address/index.js:25-95`: nenhum campo obrigatório, com CEP em `:51-53`; `Domain/Validators/CellDtoValidator.cs:32-34`: o endereço não é exigido; `UI/pages/Cells/index.js:57-59`: coluna "Localização" para quem vê a célula; `UI/pages/Cells/details.js:338-344`: o endereço do anfitrião é copiado para o da célula); E1.08 (RN-11, D-2); E2.04 (Fora de escopo: endereço sem validação); CEP: definida pelo spec (P-CEL-08); o que o CEP preenche e os avisos: definida pelo spec (P-CEL-20, PO-UX-7); não sensível: definida pelo spec (P-CEL-06) |
| RN-10 | **Endereço a partir do anfitrião.** Vale só no formulário. Pela API, o sistema não copia nada: quem grava envia o endereço.<br>- A cada escolha no seletor de Anfitrião (na célula nova ou numa edição, inclusive a volta ao anfitrião gravado), o endereço da célula passa a ser o do escolhido, por inteiro: CEP, rua, número, complemento, bairro, cidade e estado. O que estava antes é substituído, inclusive por vazio, para não misturar dois endereços. Aviso: "Endereço preenchido com o do anfitrião."<br>- Quem não vê os dados sensíveis do anfitrião (RN-11 do E1.08) recebe só bairro, cidade e estado. CEP, rua, número e complemento ficam vazios para quem edita preencher. Aviso: "Bairro, cidade e estado preenchidos com os do anfitrião. Complete o CEP, a rua e o número."<br>- Quando nenhum dado do endereço do anfitrião está disponível para quem edita, o endereço da célula não muda. Aviso: "O endereço do anfitrião não está disponível. Preencha o endereço da célula." A mesma mensagem vale quando o anfitrião não tem endereço e quando o que ele tem está mascarado, para não revelar se ele tem endereço.<br>- Com escolhas seguidas, vale só o endereço do último anfitrião escolhido.<br>- Depois de preenchido, o endereço pode ser alterado à mão.<br>- Numa edição sem escolha no seletor de Anfitrião, o endereço não muda sozinho.<br>- Nada é gravado até salvar. Fechar o formulário sem salvar mantém o endereço gravado. | legado (`UI/pages/Cells/details.js:338-344` e `:387`: ao escolher o anfitrião, o endereço inteiro passa a ser o dele, se ele tiver endereço); E1.08 (RN-11; tarefa 5 do PR 2: só bairro, cidade e UF sem acesso); substituição por inteiro, campos vazios e mensagem única: definida pelo spec (P-CEL-07); volta ao anfitrião gravado e última escolha: definida pelo spec (P-CEL-19, PO-UX-6) |
| RN-11 | **Situação: ativa ou inativa.**<br>- Inativar quer dizer que a célula parou de se reunir. Não é excluir: a célula inativa continua na lista de Células, com a situação "Inativa", com as mesmas pessoas e para as mesmas pessoas que a viam.<br>- Inativa e reativa quem pode editar a célula (RN-12). Inativar e reativar não mudam mais nada na célula: pessoas, dia, horário, tipo e endereço ficam como estão.<br>- **Na tela** (só na edição): a dica de "Célula ativa" segue a situação gravada; mudar o interruptor avisa, antes de salvar, o que acontece ("Ao salvar, a célula fica inativa. Os relatórios que ela já tem continuam." ou "Ao salvar, a célula volta aos totais e a receber relatórios a partir desta semana."); o título do formulário mostra "Inativa" quando a célula gravada está inativa; e o aviso de sucesso diz "Célula inativada." ou "Célula reativada.". Não há diálogo de confirmação. Na lista de Células, a situação "Inativa" tem um ícone, além do texto.<br>- **Célula nova:** sempre ativa. O formulário só mostra "Célula ativa" na edição. Pela API, a célula nova inativa é recusada com "Uma célula nova sempre começa ativa." Tipo (b).<br><br>Enquanto a célula está inativa:<br>(a) **Totais:** ela não conta no total de células de ninguém (D2, RN-06 do E2.06), nem no ranking "Células por G12". Inativar e reativar mudam os totais na mesma operação (RN-07 e RN-08 do E2.06).<br>(b) **Pendências:** ela não conta como pendente e não tem situação do relatório (CEL-05, E2.09).<br>(c) **Relatório novo:** ela não recebe, nem pela API, e nenhum relatório passa a ser dela numa edição. A recusa começa sempre com "Esta célula está inativa e não recebe relatórios.". Na tela, a orientação depende de quem lê: com "Editar Célula", "Para enviar um relatório, reative a célula."; sem essa permissão, "Se ela voltou a se reunir, peça à sua liderança para reativá-la.". Ela não aparece no seletor de célula do relatório, a ação "Novo relatório" não aparece na linha dela, e ela não conta para o atalho "Novo relatório" do Dashboard (RN-13 e RN-22 do E2.02): quem só tem células inativas não vê o atalho. Vale sempre, exceto na carga.<br>(d) **Relatórios que já tem:** continuam no histórico e nas somas de qualquer período e podem ser editados e excluídos por quem tem a permissão (RN-14 do E2.02). Ao contrário da célula excluída (RN-11 do E2.01), eles não ficam só para consulta.<br>(e) **Pessoas:** continuam nos papéis. A célula inativa continua impedindo a exclusão delas (RN-04 do E2.01), e elas continuam vendo a célula (P-PER-02 do E2.02).<br><br>Reativar devolve a célula aos totais, às pendências e ao lançamento a partir da semana em que é reativada (RN-08). | novo (`cells.is_active`; totais em `refresh_member_stats_v2`; pendentes em `dashboard_summary`; seletor em `src/hooks/use-cell-options.ts:45`); D2; E2.01 (Termos: "Inativar"; RN-04; RN-11); E2.06 (RN-06, RN-07, P-HIE-07); o legado não tem situação de célula, só a exclusão (`Domain/Model/Cell.cs:8-23`); célula nova ativa: definida pelo spec (P-CEL-09); sem relatório novo: definida pelo spec (P-CEL-10); a situação na tela: definida pelo spec (P-CEL-16, P-CEL-22, PO-UX-3, PO-UX-9); orientação da recusa: definida pelo spec (P-CEL-17, PO-UX-4) |
| RN-12 | **Quem cadastra, edita e exclui (CEL-04).**<br>- Cadastrar: "Criar Célula". Editar, inclusive inativar e reativar: "Editar Célula". Excluir: "Excluir Célula", com as regras do E2.01.<br>- Sempre no escopo (RN-09 e RN-12 do E2.02): a célula visível, as pessoas escolhidas visíveis, e a célula ainda visível depois da gravação.<br>- Ser líder, timóteo ou anfitrião da célula não dá direito de editá-la (RN-12 do E2.02).<br>- A célula excluída não é editada nem inativada (RN-07 do E2.01).<br>- Este passo não muda essas regras. A CEL-04 fica pronta com o E2.02 em produção. | CEL-04; legado (`API/Controllers/CellController.cs:49-72`: só `AppAdmin` e `AppSuperAdmin`); E2.02 (RN-09, RN-12); E2.01 (RN-02, RN-07) |
| RN-13 | **Células que já existem e carga do legado.**<br>- **Carga:** traz as células como estão no legado, com as transformações da 5.5, e entrega todas dentro das regras do tipo (a). O que o legado tem fora delas segue a tabela [Dados do legado](#dados-do-legado).<br>- O relatório de saneamento (E4.04) lista as células não excluídas com líder, timóteo ou anfitrião excluído. A liderança corrige no legado (E4.05), escolhendo outra pessoa. Se sobrar alguma, a carga não termina, e o go/no-go não passa.<br>- A reconciliação (E4.09) confere que nenhuma célula não excluída fica sem uma das três pessoas, com pessoa excluída, ou com dia, horário ou tipo fora das RN-05 a RN-07.<br>- **Células de teste do novo:** antes de as regras valerem, as células que as violam (sem timóteo, sem anfitrião, sem dia ou horário, ou com valor fora da lista) são listadas e corrigidas com a aprovação do usuário. Depois da publicação, nenhuma célula fica fora das regras do tipo (a). | 5.3 a 5.6 do `docs/migracao.md`; E2.01 (RN-06 e Impactos: o E4.04 lista as células com pessoa excluída); E2.04 (Pontos para o `architect`, item 2: conferir a produção antes); tratamento da pessoa excluída: definida pelo spec (P-CEL-11) |
| RN-14 | **Como as recusas aparecem.**<br>- **Ordem.** As recusas de permissão, de escopo e de registro excluído (E1.03, E2.02 e E2.01) vêm antes das deste spec.<br>- **Na tela, ao salvar,** os erros de preenchimento (RN-02, RN-05 e RN-06) aparecem todos de uma vez, cada um no seu campo, e nada é enviado. O topo do formulário diz "Campos com * são obrigatórios." e, com erro, "Confira os campos destacados ({N})."<br>- **Ao sair do Horário** que a pessoa alterou e deixou preenchido, aparece o erro de formato. A conferência é só na tela.<br>- **Recusas do servidor** (pessoa excluída, pessoa que não se vê, célula que deixaria de ser vista, célula inativa) aparecem no campo certo, ou acima dos botões quando não são de um campo. A mensagem técnica do banco nunca aparece.<br>- **Pela API,** basta a primeira recusa, com a mensagem e o campo.<br>- **Nada é gravado** numa recusa. | legado (`UI/pages/Cells/details.js:222-249`: todos os erros juntos, cada um no campo, com o aviso "Verifique os erros no formulário para prosseguir o cadastro."); E2.04 (RN-19, P-VAL-18, P-VAL-19); textos do topo: E2.04; definida pelo spec (P-CEL-12) |

#### Onde cada regra vale
| RN | Tipo | Célula nova | Edição | Sistema (service role e rotinas internas) | Carga do legado |
|---|---|---|---|---|---|
| RN-02 Pessoas obrigatórias | (a) | sim | sempre | sim | sim; o legado sempre tem as três |
| RN-04 Pessoa excluída | (a) | sim | quando a pessoa muda; na restauração, as três (RN-17 do E2.01) | sim | sim; corrigir no legado (RN-13) |
| RN-04 Pessoa visível | (b) | sim | só a pessoa que entra | não se aplica (sem sessão) | não |
| RN-05 Dia | (a) | sim; sem padrão | sempre | sim | sim (`0` a `6`) |
| RN-06 Horário | (a) | sim; sem padrão | sempre | sim | sim; fora do formato, corrigir no legado (5.4) |
| RN-07 Tipo | (a) | sim; sem tipo, Evangelística | sempre | sim | sim (`0` a `2`) |
| RN-11 Célula nova ativa | (b) | sim | não se aplica | sim | todas migram ativas |
| RN-11 (c) Inativa sem relatório novo | sempre | não se aplica | não se aplica | sim | não se aplica (todas migram ativas) |
| RN-10 Endereço do anfitrião | só na tela | sim | a cada escolha no seletor de Anfitrião | não | não; o endereço vem do legado |

#### Dados do legado
A tabela completa a 5.4 e a 5.5 do `docs/migracao.md`. Na última coluna, "nova" indica uma linha que ainda não está no plano.

| Situação no legado | Tratamento | Regra | No plano hoje |
|---|---|---|---|
| Célula não excluída com líder, timóteo ou anfitrião excluído | Listar (E4.04) e corrigir no legado (E4.05), escolhendo outra pessoa. A carga não termina enquanto houver. | RN-04, RN-13 | listar: impacto do E2.01; tratamento: nova |
| Célula excluída com pessoa excluída | Migra com `deleted_at`, e a referência é mantida | E2.01 | sim (5.4) |
| Horário fora do formato `HH:mm` | Corrigir no legado | RN-06 | sim (5.4) |
| Dia fora de `0` a `6` ou tipo fora de `0` a `2` | Corrigir no legado. Não deve existir, porque os dois são enumerações do legado. | RN-05, RN-07 | nova |
| Situação | O legado não tem célula inativa: todas as células migram ativas, inclusive as excluídas (que também recebem `deleted_at`) | RN-11 | nova (5.5) |
| Pessoa inativa em algum papel | Migra como está | RN-04 | nova (só para registro) |
| Mesma pessoa em mais de um papel | Migra como está | RN-03 | nova (só para registro) |
| Sem endereço (`PlaceId` nulo ou endereço vazio) | Migra sem endereço | RN-09 | sim (5.5, mesma regra do endereço) |
| `ReportMandatory` | Descartado | — | sim (3.9, 5.5) |

### Critérios de aceite
Convenções:
- "Pela API" é qualquer chamada feita fora da tela, com a sessão do usuário citado.
- "Recusado" quer dizer que nada é gravado (RN-14).
- "Hoje" é terça, 24/11/2026, em Brasília. A semana atual vai de domingo, 22/11, a sábado, 28/11/2026.
- Cada critério parte da massa original.

Massa de exemplo, coerente com a do E2.02:

| Pessoa ou célula | Situação |
|---|---|
| Samuel e Magda | pastores (casal) |
| Pedro | G12, discípulo de Samuel, casado com Paula. Função Líder: vê só o ministério; tem "Criar Célula", "Editar Célula", "Excluir Célula" e "Editar Relatórios de Células"; não tem "Ver Dados Sensíveis". |
| André | discípulo de Pedro, casado com Beatriz, que é de outro ministério (Pedro não vê Beatriz) |
| Caio | discípulo de André; função Membro ("Enviar Relatório das Próprias Células", sem "Editar Célula") |
| Carla | discípula de Paula; função Membro; endereço: CEP 90010-000, Rua das Flores, 100, ap. 2, Centro, Porto Alegre, RS |
| Fábio | discípulo de André, inativo; endereço: CEP 92010-000, Av. Brasil, 500, Niterói, Canoas, RS |
| Gabriel | discípulo de Fábio, sem nenhum dado de endereço |
| Ester | sem liderança |
| Diego | líder de outro ministério, que Pedro não vê |
| Rita | função Administrador: vê a igreja toda e os dados sensíveis |
| Bruno | excluído (E2.01) |
| C1 | célula de André: líder André, timóteo Caio, anfitriã Carla; quarta, 20:00; Evangelística; ativa; com o endereço de Carla; um relatório na semana passada (quarta, 18/11, 20:00) e nenhum nesta semana |
| C2 | célula de Diego, ativa |

- **RN-01**
  - Dado um script com a service role
  - Quando ele grava C1 sem timóteo
  - Então a gravação é recusada com "Escolha o timóteo da célula.".
  - Dado Caio, sem "Editar Célula"
  - Quando ele tenta, pela API, tirar a anfitriã de C1
  - Então recebe a recusa de permissão do E2.02, e não a deste spec, e nada muda.
  - Dada a carga do legado com uma célula em que o líder também é o anfitrião e o timóteo está inativo
  - Quando ela roda
  - Então a célula é carregada como está, ativa.
- **RN-02**
  - Quando Rita abre "Nova célula"
  - Então Líder, Timóteo e Anfitrião aparecem marcados como obrigatórios.
  - Quando ela salva só com o líder
  - Então vê "Escolha o timóteo da célula." e "Escolha o anfitrião da célula.", cada uma no seu campo, e nada é enviado.
  - Quando alguém envia pela API uma célula nova sem líder
  - Então ela é recusada com "Escolha o líder da célula.". Hoje o banco aceita.
  - Quando Rita limpa a anfitriã de C1 e salva
  - Então recebe "Escolha o anfitrião da célula.", e Carla continua anfitriã.
  - Quando ela troca a anfitriã de C1 por Fábio
  - Então a gravação é aceita.
  - Quando Rita cadastra uma Macrocélula sem anfitrião
  - Então recebe a mesma recusa.
  - Dada a publicação deste passo
  - Então nenhuma célula não excluída está sem líder, timóteo ou anfitrião.
- **RN-03**
  - Quando Rita cadastra uma célula com André como líder, timóteo e anfitrião
  - Então a célula é aceita.
  - Quando ela cadastra uma segunda célula de André, também na quarta às 20:00 e com Carla como anfitriã
  - Então a célula é aceita, sem aviso de conflito.
  - Quando Rita põe Beatriz, esposa de André, como anfitriã de C1
  - Então a gravação é aceita. C1 passa a ser vista também por quem tem Beatriz no escopo (RN-03 do E2.02), e continua contando no total de células só de André e de quem está acima dele (RN-06 do E2.06).
- **RN-04**
  - Quando Rita escolhe Fábio, que está inativo, como timóteo de C1
  - Então o seletor e o campo mostram "Fábio (inativo)", e a gravação é aceita. Ao abrir de novo a edição de C1, o campo continua mostrando "Fábio (inativo)".
  - Dada C1 com Beatriz, inativa, como anfitriã
  - Quando Rita abre a edição de C1
  - Então o campo mostra "Beatriz (inativa)".
  - Quando Pedro, que não vê Beatriz, abre a edição de C1
  - Então o campo mostra só "Beatriz", sem a marca.
  - Quando Rita inativa Caio, timóteo de C1
  - Então Caio continua timóteo de C1, e C1 continua ativa.
  - Quando Rita cadastra uma célula com Samuel, pastor, como líder
  - Então a célula é aceita, e o G12 dela aparece como "Pastores" (RN-11 do E2.06).
  - Quando ela cadastra uma célula com Ester, sem liderança, como líder
  - Então a célula é aceita, e o G12 dela aparece como "—".
  - Quando alguém envia pela API Bruno, excluído, como anfitrião de C1
  - Então recebe "Este membro foi excluído e não pode ser escolhido.", e nada muda. O seletor de anfitrião não oferece Bruno.
  - Quando Pedro escolhe Diego como timóteo de uma célula nova
  - Então recebe "Você só pode escolher pessoas que você vê." (E2.02). O seletor dele não oferece Diego.
  - Dada C1 com Beatriz como anfitriã
  - Quando Pedro, que não vê Beatriz, muda só o horário de C1
  - Então a gravação é aceita, e Beatriz continua anfitriã.
- **RN-05**
  - Quando Rita abre "Nova célula"
  - Então o Dia da semana vem sem dia escolhido.
  - Quando ela abre o Dia da semana
  - Então as opções são "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado" e "Domingo", nessa ordem. Escolher "Quarta-feira" grava "Quarta", e a lista de Células mostra "Quarta".
  - Quando ela salva sem escolher o dia
  - Então vê "Escolha o dia da semana.", e nada é enviado.
  - Quando alguém envia pela API uma célula nova sem dia
  - Então ela é recusada com "Escolha o dia da semana.". Hoje o banco grava Sábado.
  - Quando alguém envia pela API o dia "Segunda-feira", "segunda" ou "Terca"
  - Então recebe "Dia da semana inválido. Escolha de domingo a sábado.". Com "Segunda", a gravação é aceita.
  - Dada a publicação deste passo
  - Então toda célula tem um dos sete dias da regra.
- **RN-06**
  - Quando Rita abre "Nova célula"
  - Então o Horário vem vazio. Salvar sem horário mostra "Informe o horário.".
  - Quando ela digita "25:00" ou "19:60" no Horário e sai do campo
  - Então vê "Horário inválido. Informe a hora e os minutos, entre 00:00 e 23:59.", sem nenhuma chamada ao servidor.
  - Quando ela digita "20" ou "7:30" e sai do campo
  - Então o campo mostra "20:00" ou "07:30", sem erro.
  - Quando ela digita "730" e sai do campo
  - Então o campo continua "73:0", com o erro de horário inválido.
  - Quando alguém envia pela API o horário "24:00"
  - Então recebe a mesma mensagem. Com "00:00" ou "23:59", a gravação é aceita.
  - Quando alguém envia pela API o horário "19:30:45"
  - Então a célula fica com 19:30.
  - Quando alguém envia pela API uma célula nova sem horário
  - Então ela é recusada com "Informe o horário.". Hoje o banco grava 19:00.
  - Quando Rita cadastra uma célula de sábado às 23:30
  - Então ela fica com sábado, 23:30, e aparece assim para todos, sem conversão de fuso.
- **RN-07**
  - Quando Rita abre "Nova célula"
  - Então o Tipo já vem com Evangelística.
  - Quando alguém envia pela API uma célula nova sem tipo
  - Então ela fica Evangelística.
  - Quando alguém envia pela API o tipo "Discipuladora", "evangelistica" ou vazio
  - Então recebe "Tipo de célula inválido. Escolha Evangelística, Discipulado ou Macrocélula.". Com "Discipulado", a gravação é aceita.
  - Dada a publicação deste passo
  - Então toda célula tem um dos três tipos da regra.
- **RN-08**
  - Dado que é quinta, 26/11/2026, 10:00 em Brasília, e C1 (quarta, 20:00) não tem relatório nesta semana
  - Quando Rita abre o Dashboard
  - Então C1 conta no card de pendentes.
  - Quando Rita muda C1 para sábado, 19:00
  - Então, na consulta seguinte, C1 deixa de contar como pendente nesta semana.
  - Dado que C1 (quarta, 20:00) continua sem relatório nesta semana
  - Quando são 23:59 de sábado, 28/11, em Brasília (02:59 de domingo em UTC)
  - Então C1 ainda conta como pendente.
  - Quando é domingo, 29/11, 00:00 em Brasília (03:00 em UTC)
  - Então C1 deixa de contar como pendente: a semana nova começou no horário de Brasília, e a reunião de quarta ainda não aconteceu.
  - Quando Rita muda o dia de C1 para sábado
  - Então o relatório da semana passada continua com quarta, 18/11, 20:00.
  - Quando Rita troca a anfitriã de C1 de Carla para Fábio
  - Então, na ação seguinte, Carla não lança mais o relatório de C1, e Fábio lança se a função dele tiver "Enviar Relatório das Próprias Células" (RN-13 do E2.02).
- **RN-09**
  - Quando Rita cadastra uma célula sem nenhum dado de endereço
  - Então a célula é aceita.
  - Dada uma célula nova com o número "100" e o complemento "casa 2" já digitados
  - Quando Rita digita o CEP 90010-000
  - Então a rua, o bairro, a cidade e o estado são preenchidos pelo serviço de CEP, e o número e o complemento continuam "100" e "casa 2".
  - Quando ela digita um CEP que o serviço não encontra, ou o serviço não responde
  - Então vê "CEP não encontrado. Confira o número ou preencha o endereço." ou "Não foi possível buscar o endereço pelo CEP. Preencha o endereço.", e salvar continua possível.
  - Dado Caio, sem "Ver Dados Sensíveis", que vê C1
  - Quando ele abre a lista de Células
  - Então vê o endereço de C1 com rua e número (Rua das Flores, 100), embora não veja a rua de Carla no cadastro dela.
  - Quando Carla muda o próprio endereço
  - Então o endereço de C1 não muda.
- **RN-10**
  - Quando Rita, numa célula nova, digita "Rua A" e depois escolhe Carla como anfitriã
  - Então o endereço passa a ser o de Carla, por inteiro (CEP 90010-000, Rua das Flores, 100, ap. 2, Centro, Porto Alegre, RS), e a tela avisa "Endereço preenchido com o do anfitrião.". O CEP que veio de Carla não dispara a busca pelo CEP, e a rua continua "Rua das Flores".
  - Quando Pedro, sem "Ver Dados Sensíveis", escolhe Carla como anfitriã de uma célula nova
  - Então só Centro, Porto Alegre e RS são preenchidos. CEP, rua, número e complemento ficam vazios, e a tela avisa "Bairro, cidade e estado preenchidos com os do anfitrião. Complete o CEP, a rua e o número.".
  - Quando Pedro troca a anfitriã de C1 por Fábio
  - Então o endereço fica com Niterói, Canoas e RS, e CEP, rua, número e complemento vazios. Nunca fica "Rua das Flores, 100" com o bairro de Fábio.
  - Quando Rita escolhe Gabriel, que não tem endereço, como anfitrião de C1
  - Então o endereço de C1 não muda, e a tela avisa "O endereço do anfitrião não está disponível. Preencha o endereço da célula.".
  - Quando Rita troca a anfitriã de C1 por Fábio e, antes de salvar, volta para Carla
  - Então o endereço volta a ser o de Carla.
  - Quando Rita escolhe Fábio e logo depois Carla, e o endereço de Fábio chega depois do de Carla
  - Então o endereço fica com o de Carla.
  - Quando Rita muda só o horário de C1
  - Então o endereço não muda.
  - Quando Rita troca a anfitriã de C1 e fecha o formulário sem salvar
  - Então C1 continua com o endereço de Carla.
  - Quando alguém cria pela API uma célula com Carla como anfitriã e sem endereço
  - Então a célula fica sem endereço.
- **RN-11**
  - Quando Rita abre "Nova célula"
  - Então "Célula ativa" não aparece, e a célula é gravada ativa.
  - Quando alguém envia pela API uma célula nova inativa
  - Então recebe "Uma célula nova sempre começa ativa.".
  - Quando Pedro abre a edição de C1 e desliga "Célula ativa", sem salvar
  - Então a tela avisa "Ao salvar, a célula fica inativa. Os relatórios que ela já tem continuam.". Ligar de novo tira o aviso, e nada muda.
  - Dados os totais de células de André, Pedro e Samuel, que incluem C1
  - Quando Pedro desliga "Célula ativa" em C1 e salva
  - Então:
    - a tela confirma com "Célula inativada.", mesmo que ele tenha mudado também o horário;
    - C1 aparece em Células com a situação "Inativa", com o ícone, e com as mesmas pessoas, dia, horário, tipo e endereço;
    - o total de células de André, de Pedro e de Samuel diminui 1 na mesma operação;
    - C1 sai do ranking "Células por G12" e não conta no card de pendentes, nem depois de quarta, 25/11, às 20:00;
    - C1 sai do seletor de célula do relatório, e "Novo relatório" some da linha dela;
    - Carla, que só é pessoa de C1, deixa de ver o atalho "Novo relatório" do Dashboard.
  - Quando Pedro abre de novo a edição de C1
  - Então o título mostra "Inativa", e a dica de "Célula ativa" diz "Ligue quando a célula voltar a se reunir. A célula inativa não conta nos totais e não recebe relatórios.".
  - Dado que Carla abriu "Novo relatório" de C1 antes de Pedro inativá-la
  - Quando ela salva o relatório
  - Então vê "Esta célula está inativa e não recebe relatórios. Se ela voltou a se reunir, peça à sua liderança para reativá-la.", os dados digitados ficam no formulário, e nada é gravado. Hoje o lançamento pelo botão da lista é aceito.
  - Quando Pedro, que tem "Editar Célula", passa pela mesma situação
  - Então vê "Esta célula está inativa e não recebe relatórios. Para enviar um relatório, reative a célula.".
  - Quando Carla tenta lançar pela API um relatório de C1 inativa
  - Então a recusa traz "Esta célula está inativa e não recebe relatórios.", e nada é gravado.
  - Quando alguém tenta, pela API, passar para C1 inativa um relatório de C2
  - Então recebe a mesma recusa.
  - Quando Pedro muda o tema do relatório da semana passada de C1 inativa
  - Então a alteração é aceita. Excluir esse relatório também é aceito, para quem tem "Excluir Relatórios de Células".
  - Quando Rita tenta excluir André
  - Então o bloqueio da RN-04 do E2.01 lista "Líder na célula de André, quarta, 20:00 (inativa)".
  - Quando Pedro liga "Célula ativa" em C1 inativa
  - Então a tela avisa "Ao salvar, a célula volta aos totais e a receber relatórios a partir desta semana.".
  - Quando ele salva
  - Então a tela confirma com "Célula reativada.", os totais voltam ao que eram, e C1 volta ao seletor de célula do relatório, à ação "Novo relatório" e às pendências a partir da semana atual.
- **RN-12**
  - Dado Caio, timóteo de C1, sem "Editar Célula"
  - Quando ele abre a lista de Células e tenta, pela API, mudar o horário de C1
  - Então não vê "Editar" em C1, e pela API nada muda.
  - Quando Pedro inativa C1
  - Então a alteração é aceita.
  - Quando Pedro tenta, pela API, inativar C2
  - Então nada muda, porque C2 não está visível para ele (E2.02).
  - Dada C1 excluída
  - Quando Rita tenta editá-la pela API
  - Então recebe "Esta célula não existe ou já foi excluída." (E2.01).
- **RN-13**
  - Dada uma cópia do legado com uma célula não excluída cujo anfitrião foi excluído
  - Quando o saneamento roda
  - Então a célula aparece no relatório de saneamento. Se não for corrigida no legado, a carga não termina.
  - Dada uma célula do legado com `WeekDay` 3, `Time` "20:00", `CellType` 1 e sem endereço
  - Quando a carga roda
  - Então ela é carregada como Quarta, 20:00, Discipulado, ativa e sem endereço.
  - Dada uma célula excluída no legado, com o líder também excluído
  - Quando a carga roda
  - Então ela é carregada como excluída, com o líder registrado.
  - Dadas células de teste no banco novo sem timóteo ou com o dia "Segunda-feira"
  - Quando este passo é publicado
  - Então elas foram listadas e corrigidas com a aprovação do usuário antes, e nenhuma célula viola as RN-02, RN-05, RN-06 e RN-07.
  - Dada a carga terminada
  - Quando a reconciliação roda
  - Então nenhuma célula não excluída viola as RN-02, RN-04 (pessoa excluída), RN-05, RN-06 e RN-07.
- **RN-14**
  - Quando Rita abre "Nova célula" e salva sem preencher nada
  - Então vê os cinco erros de uma vez (líder, timóteo, anfitrião, dia e horário), cada um no seu campo, e "Confira os campos destacados (5).", e nada é enviado.
  - Dado que Rita escolheu Ester como timóteo de C1 e, antes de ela salvar, outra pessoa excluiu Ester
  - Quando Rita salva
  - Então a recusa "Este membro foi excluído e não pode ser escolhido." aparece no campo Timóteo, e não como mensagem técnica num aviso.
  - Quando a gravação de C1 é recusada
  - Então nada muda em C1: nem os campos válidos que foram enviados junto.

### Textos de tela
Vocabulário de referência. O `ux-designer` pode ajustar o tom, mas não o sentido nem os termos. Os textos vindos do desenho de UX e aprovados pelo PO em 2026-11-24 (PO-UX-1, PO-UX-3, PO-UX-4, PO-UX-7 e PO-UX-10) já estão na tabela. Os demais textos de tela estão em "Textos", na seção Experiência (UX).
- **Termos:** Célula, Pessoas da célula, Líder, Timóteo, Anfitrião, Reunião, Tipo (Evangelística, Discipulado, Macrocélula), Dia da semana, Horário, Situação (Ativa, Inativa), Célula ativa, Endereço da célula, CEP, Rua, Número, Complemento, Bairro, Cidade, Estado, Relatório, liderança.
- **Evitar:** "Auxiliar" ou "assistente" no rótulo do Timóteo; "Modalidade" no lugar de Tipo; "Status" no lugar de Situação (P-HIE-20 do E2.06); maiúscula em toda palavra ("Nova Célula", "Célula Ativa", "Criar Célula").

| Situação | Texto |
|---|---|
| título do diálogo | Nova célula · Editar célula · na edição de uma célula gravada inativa, com o título: Inativa |
| grupos do formulário | Pessoas da célula · Reunião · Endereço da célula |
| dica do Timóteo | Auxilia o líder e está em formação para liderar. |
| dica do Anfitrião | Quem recebe a célula em casa. |
| opções do Dia da semana, nessa ordem | Segunda-feira · Terça-feira · Quarta-feira · Quinta-feira · Sexta-feira · Sábado · Domingo (placeholder: Escolha o dia) |
| dica de "Célula ativa" (só na edição) | célula ativa: Desligue quando a célula parar de se reunir. A célula inativa sai dos totais e não recebe relatórios. · célula inativa: Ligue quando a célula voltar a se reunir. A célula inativa não conta nos totais e não recebe relatórios. |
| aviso ao mudar "Célula ativa" (antes de salvar) | Ao salvar, a célula fica inativa. Os relatórios que ela já tem continuam. · Ao salvar, a célula volta aos totais e a receber relatórios a partir desta semana. |
| aviso de sucesso | Célula criada. · Célula atualizada. · Célula inativada. · Célula reativada. |
| sem líder, timóteo ou anfitrião | Escolha o líder da célula. · Escolha o timóteo da célula. · Escolha o anfitrião da célula. |
| sem dia | Escolha o dia da semana. |
| dia fora da lista (API) | Dia da semana inválido. Escolha de domingo a sábado. |
| sem horário | Informe o horário. |
| horário inválido | Horário inválido. Informe a hora e os minutos, entre 00:00 e 23:59. |
| tipo fora da lista (API) | Tipo de célula inválido. Escolha Evangelística, Discipulado ou Macrocélula. |
| célula nova inativa (API) | Uma célula nova sempre começa ativa. |
| relatório para célula inativa | Esta célula está inativa e não recebe relatórios. (pela API, só esta frase) · na tela, com "Editar Célula": … Para enviar um relatório, reative a célula. · na tela, sem "Editar Célula": … Se ela voltou a se reunir, peça à sua liderança para reativá-la. |
| pessoa inativa num papel (aviso, não impede salvar; só para quem se vê) | {Nome} (inativo) · {Nome} (inativa) |
| endereço do anfitrião | Buscando o endereço do anfitrião… · Endereço preenchido com o do anfitrião. · Bairro, cidade e estado preenchidos com os do anfitrião. Complete o CEP, a rua e o número. · O endereço do anfitrião não está disponível. Preencha o endereço da célula. · Não foi possível carregar o endereço do anfitrião. · atalho: Ir para o endereço |
| CEP (avisos, não impedem salvar) | Buscando endereço… · CEP não encontrado. Confira o número ou preencha o endereço. · Não foi possível buscar o endereço pelo CEP. Preencha o endereço. |
| pessoa excluída (E2.01) | Este membro foi excluído e não pode ser escolhido. |
| pessoa que não se vê e célula que deixaria de ser vista (E2.02) | Você só pode escolher pessoas que você vê. · Com esta alteração, você deixaria de ver esta célula. Mantenha pelo menos uma pessoa do seu ministério como líder, timóteo ou anfitrião. As alterações não foram salvas. |
| topo do formulário | Campos com * são obrigatórios. |
| resumo ao salvar com erro | Confira os campos destacados ({N}). |
| queda de conexão ao salvar (E2.05) | Não foi possível salvar a célula. Verifique a conexão e tente de novo. · no cadastro novo, enquanto a repetição puder criar outra célula (AQ-3 da UX): Antes de tentar de novo, confira na lista de Células se a célula já foi criada. |
| ação "Novo relatório" na lista (nome para o leitor de tela) | Novo relatório da célula de {Líder} |

### Telas afetadas
- **Formulário de célula (`CellForm`)**, em "Nova célula" e "Editar célula":
  - os campos em três grupos: "Pessoas da célula", "Reunião" e "Endereço da célula" (P-CEL-23);
  - Líder, Timóteo, Anfitrião, Tipo, Dia da semana e Horário marcados como obrigatórios (RN-02, RN-05 a RN-07);
  - dia e horário vazios no cadastro novo; tipo com Evangelística (RN-05 a RN-07);
  - dias de "Segunda-feira" a "Domingo", nessa ordem (RN-05, P-CEL-14);
  - horário digitado, em 24 h, com a leitura abreviada ao sair do campo (RN-06, P-CEL-15);
  - rótulo "Timóteo" sem "(Auxiliar)", com dica, e dica no Anfitrião (P-CEL-13);
  - pessoa inativa marcada "(inativo)" ou "(inativa)" no campo e no seletor, só para quem se vê (RN-04, P-CEL-18);
  - "Célula ativa" só na edição, com a dica conforme a situação gravada, o aviso antes de salvar, "Inativa" no título e os avisos de sucesso "Célula inativada." e "Célula reativada." (RN-11, P-CEL-16);
  - campo CEP no endereço, preenchendo rua, bairro, cidade e estado, com os avisos de CEP não encontrado e de falha (RN-09, P-CEL-20);
  - endereço do anfitrião por inteiro a cada escolha, inclusive a volta ao anfitrião gravado, com a máscara e os avisos embaixo do Anfitrião, e não num aviso que some (RN-10, P-CEL-19);
  - todos os erros juntos ao salvar, o Horário conferido ao sair do campo e as recusas do servidor no campo certo, sem mensagem técnica (RN-14);
  - títulos e botões com só a primeira letra maiúscula (P-CEL-13).
- **Lista de Células:** "Novo relatório" some na linha da célula inativa, sem tirar "Editar" e "Excluir" do lugar (RN-11). A situação "Inativa" ganha o ícone de pausa (P-CEL-22). "Nova Célula" passa a "Nova célula".
- **Formulário de relatório (`CellReportForm`):** o seletor já só oferece células ativas. A recusa da RN-11 (c), com a orientação conforme quem lê (P-CEL-17), aparece no topo do formulário se a célula for inativada com ele aberto, sem perder o que foi digitado.
- **Dashboard:** o atalho "Novo relatório" não conta as células inativas (RN-11 c). O resto não muda.
- **Formulário de membro (`MemberForm`):** o CEP deixa de preencher o complemento e ganha os avisos de CEP não encontrado e de falha (P-CEL-20). O `architect` decide se isso entra neste passo, com um preenchimento por CEP comum aos dois formulários (AQ-6 da UX), ou no próximo passo que mexer no cadastro de membro.
- Nenhuma tela nova. Ministérios não muda.

### Fora de escopo
Cada item indica o passo que cuida dele, quando há um.
- **Situação do relatório por célula** (CEL-05): E2.09, com a RN-08 e a RN-11 (b) deste spec.
- **Lista de Células com filtros e detalhe com os últimos relatórios** (CEL-06, CEL-07), inclusive o gráfico de evolução do legado: E2.10.
- **Lançamento de relatório** (REL-01 a REL-12, REL-15): E2.11. Este spec só define que a célula inativa não recebe relatório (RN-11 c), regra que a RPC do E2.11 mantém.
- **Retrato das pessoas e do tipo da célula no relatório** (REL-09): E2.11.
- **Lista de relatórios** (REL-13): E2.12. **Exportação** (REL-14): E2.13.
- **Dashboard** (DSH-02, DSH-03), inclusive "células por tipo" e "novas células da semana": E2.14 (ver Impactos).
- **Exclusão e restauração de célula** (CEL-08): E2.01.
- **Escopo e permissões** (CEL-04 no escopo, quem lança): E2.02. Este passo só confirma as regras (RN-12).
- **Autoria e o que conta como alteração:** E2.05.
- **Totais de células e G12 da célula:** E2.06.
- **Nome da célula:** não existe, nem no legado. A célula é identificada pelo líder, pelo dia e pelo horário (RN-04 do E2.01).
- **`ReportMandatory`:** não será replicado (3.9).
- **Unicidade e conflitos** (mesmo líder em várias células, mesmo anfitrião no mesmo dia e horário): o legado não tem, então não entram (ver Q-1 e Q-2).
- **Homogeneidade** (timóteo do mesmo sexo do líder): o legado não exige, então não entra (ver Q-3).
- **Regras próprias da Macrocélula:** nenhuma; ver Q-5.
- **Validação de endereço** (CEP existente, estado da lista, número obrigatório): o legado não tem, como no cadastro de membro (E2.04).
- **Mapa ou localização da célula:** sem passo no plano.
- **Atalho "Cadastrar mais células" do legado:** não volta (P-CEL-21).
- **Edição simultânea da mesma célula:** vale a última gravação, como no legado.
- **Inativar ou reativar várias células de uma vez:** sem passo no plano.
- **Migração:** saneamento (E4.04, E4.05), carga (E4.06), backfill (E4.07) e reconciliação (E4.09), seguindo a RN-13.
- **Consolidação:** o consolidado não é membro. O spec da Consolidação define se ele pode ocupar um papel na célula (ver Q-6).

### Impactos em outros passos
Pontos de negócio que outros passos precisam respeitar. O `architect` decide como.
- **E2.01:** nada muda na exclusão e na restauração. A célula inativa continua impedindo a exclusão das pessoas dela (RN-04 de lá), e a restauração continua conferindo as três pessoas (RN-17 de lá).
- **E2.02:**
  - a CEL-04 depende do E2.02 em produção (RN-12). Até lá, quem tem "Editar Próprio Cadastro" ainda edita a própria célula;
  - "pode enviar relatório" (RN-13 e RN-22 de lá) passa a considerar a situação: a célula inativa não entra no botão da lista, no seletor de célula do relatório nem no atalho do Dashboard (RN-11 c; AQ-7 da UX).
- **E2.04 (cadastro de membro):** o CEP segue a P-CEL-20 também no `MemberForm`: preenche rua, bairro, cidade e estado, nunca o complemento, e avisa quando não encontra o CEP ou quando o serviço falha. Hoje ele preenche o complemento com o texto do serviço e falha sem avisar.
- **E2.05:**
  - a situação e o CEP já estão na lista do que conta como alteração (RN-04 de lá);
  - os segundos do horário não contam: "19:30" e "19:30:45" são o mesmo horário, e salvar um pelo outro não é alteração.
- **E2.06:** inativar e reativar já mudam os totais (RN-07 de lá). Nada muda.
- **E2.07 (vínculo celular, MEM-14):** ser pessoa de uma célula inativa não dá vínculo celular, porque a célula parou de se reunir. O rascunho do E2.07 já adota isso (RN-10 e P-FIL-07 de lá). Hoje a `members_view` conta a célula inativa.
- **E2.09 (situação do relatório, CEL-05):**
  - a célula inativa não tem situação (RN-11 b);
  - o dia e o horário são os atuais (RN-08);
  - decidir a situação da célula cadastrada ou reativada depois da reunião da semana. No legado, ela fica pendente na hora, como o card de hoje.
- **E2.10 (lista de Células):** o legado não filtra por situação, porque não tem célula inativa. Recomendação do PO: incluir o filtro "Situação" (Ativa, Inativa).
- **E2.11:** a RPC de lançamento recusa a célula inativa (RN-11 c), com a orientação da P-CEL-17 na tela, usa o dia e o horário atuais da célula (RN-08) e guarda o tipo no retrato (REL-09). O horário do relatório segue o mesmo campo digitado da P-CEL-15 (P62 da UX).
- **E2.14:** decidir se as células inativas contam em "células por tipo" (DSH-03). Recomendação do PO: só as ativas, como nos totais (D2). A célula nova sempre começa ativa, então "novas células da semana" conta só ativas.
- **E4.04, E4.05 e E4.06:** a 5.4 e a 5.5 recebem as linhas novas da tabela [Dados do legado](#dados-do-legado): a célula com pessoa excluída e o tratamento dela, o dia ou tipo fora da enumeração e a situação ativa na carga.
- **E4.09:** a reconciliação confere as regras do tipo (a) (RN-13).
- **Consolidação:** ver Q-6.
- **Aceite (PO):**
  - no `docs/migracao.md`: CEL-01, CEL-02 e CEL-03 em ✅; CEL-04 em ✅ junto com o E2.02 em produção; as linhas novas na 5.4 e na 5.5; o E2.08 na seção Progresso;
  - no `CLAUDE.md`: na matriz, a linha "CRUD de células" com a situação ativa e inativa; em "Novo: estado atual", `type` e `meeting_day` deixam de ser texto livre; nas "Armadilhas", o item do `meeting_day` passa a dizer que só os sete valores são aceitos, com a lista única em `src/lib/cells/weekdays.ts` (o mapa de dias do Dashboard já foi corrigido no PR 3 do E1.08).

### Pontos para o `architect`
Não são dúvidas de negócio. São pontos em que a regra depende de uma escolha técnica.
1. **Tipo (a) e a carga.** A carga roda com `session_replication_role = replica`: os triggers ficam desligados, e `NOT NULL` e `CHECK` continuam valendo. A pessoa excluída (RN-04) é imposta hoje por trigger (`enforce_cell_links`), então a carga precisa garanti-la, e a reconciliação, conferi-la. O E2.04 propõe o mesmo molde para células (funções de regra, `CHECK`s para o tipo (a), um trigger de normalização e um de regras, erro com o campo).
2. **Dados de teste em produção.** Antes de criar as restrições do tipo (a), conferir na produção células sem líder, timóteo ou anfitrião, sem dia ou horário, com dia fora dos sete valores ou com tipo fora dos três, e propor a correção ao usuário antes de gravar no banco (RN-13).
3. **Valores padrão.** Hoje o banco grava Sábado e 19:00 quando o dia e o horário não vêm. As RN-05 e RN-06 pedem a recusa. O padrão do tipo (Evangelística) continua (RN-07).
4. **Horário.** A coluna `time` aceita segundos e aceita "24:00". A RN-06 pede minutos e o limite de 23:59. A comparação do E2.05 usa o valor já normalizado.
5. **Célula nova ativa** (RN-11). É uma regra só do cadastro, do tipo (b).
6. **Célula inativa e relatório** (RN-11 c). Precisa valer já, para todos os caminhos de gravação de `cell_reports`, e continuar na RPC do E2.11. Com inativar e lançar ao mesmo tempo, só uma ordem vale: o relatório aceito antes da inativação fica, e depois dela é recusado, como na DT-08 do E2.01.
7. **Recusas por campo** (RN-14). Cada recusa traz o código e o campo, como na AQ-2 do E2.01 e no item 5 dos Pontos do E2.04, para a tela mostrá-la no campo certo.
8. **Endereço do anfitrião** (RN-10). O `applyHostAddress` passa de "completar" para "substituir", com os campos mascarados vazios e a mensagem única quando nada está disponível. A leitura continua na `members_view`. A consulta é disparada pela escolha no seletor, inclusive a volta ao anfitrião gravado, e só a resposta da última escolha vale (P-CEL-19; AQ-5 da UX).
11. **Célula repetida por queda de conexão** (AQ-3 da UX). Como não há unicidade (RN-03), repetir o envio de uma célula nova que o servidor já gravou cria uma segunda célula igual. O PO prefere que a repetição não crie outra célula (a sugestão da AQ-3). A frase de conferir a lista é só o recurso se isso não for feito.
12. **Situação da pessoa nos seletores** (RN-04; AQ-2 da UX). A marca "(inativo)" precisa da situação e do sexo das pessoas visíveis, também das já gravadas na célula, e nunca de quem está fora do escopo de quem edita (P-CEL-18).
13. **Orientação da recusa da célula inativa** (RN-11 c, P-CEL-17). O servidor devolve a primeira frase e o código; a tela escolhe a orientação pela permissão "Editar Célula" de quem lê.
9. **Lista única dos dias.** O `CHECK` do dia, a `weekday_index` e `src/lib/cells/weekdays.ts` precisam aceitar os mesmos sete valores.
10. **Ordem de implementação.** Este passo pressupõe o E2.01 (já com o `enforce_cell_links` em produção) e o E2.02 (CEL-04, pessoas visíveis). Ele mexe nas mesmas regras de escrita de `cells` que o E2.02 e o E2.05.

### Perguntas em aberto
Nenhuma bloqueante. Os pontos que as fontes não respondiam viraram padrões, listados em [Padrões definidos por este spec](#padrões-definidos-por-este-spec-revisar-no-pr), para o usuário revisar no PR. Os que mais mudam o resultado são:
- **P-CEL-10:** a célula inativa não recebe relatório novo. Hoje o botão da lista aceita.
- **P-CEL-07:** escolher o anfitrião substitui o endereço inteiro, como no legado. Hoje o novo completa campo a campo.
- **P-CEL-02:** dia e horário deixam de vir preenchidos com Sábado e 19:00.
- **P-CEL-09:** a célula nova sempre começa ativa.
- **P-CEL-11:** a célula do legado com pessoa excluída precisa ser corrigida no legado, senão a carga não termina.
- **P-CEL-06:** o endereço da célula, com rua e número, aparece para todos que veem a célula.
- **P-CEL-20:** o CEP nunca preenche o complemento, também no cadastro de membro.
- **P-CEL-14:** os dias aparecem como no legado, de "Segunda-feira" a "Domingo".

As pendências da UX (PO-UX-1 a PO-UX-10) foram resolvidas em 2026-11-24 e viraram os padrões P-CEL-14 a P-CEL-23.

Sugestões que não entram, porque o legado não tem a regra. O usuário decide se viram regra nova. A T9 da seção Experiência (UX) mostra como a tela fica em cada resposta:
- **Q-1.** Impedir ou avisar quando o mesmo líder tem duas células ativas?
- **Q-2.** Avisar quando o mesmo anfitrião recebe duas células no mesmo dia e horário? Atenção: um casal pode receber, na mesma noite, a célula dos homens e a das mulheres.
- **Q-3.** Exigir que o timóteo seja do mesmo sexo do líder (homogeneidade)?
- **Q-4.** Quando a célula ainda não tem timóteo, a orientação da igreja é repetir o líder no campo Timóteo? O sistema aceita, como no legado (RN-03), mas a tela não sugere isso.
- **Q-5.** A Macrocélula tem regras próprias na igreja (por exemplo, sem anfitrião, ou reunião num local da igreja)? Hoje ela segue as mesmas regras das outras células.
- **Q-6.** Quando existir a Consolidação, um consolidado pode ser anfitrião de uma célula evangelística?

## Experiência (UX)
_Seção do `ux-designer`. Escrita em 2026-11-24 a partir destas fontes:_
- _a seção Negócio (RN-01 a RN-14, P-CEL-01 a P-CEL-13, as perguntas Q-1 a Q-6, a massa de exemplo e os Textos de tela);_
- _as telas da `origin/main` do `mci-connect` (`fdcbe50`): `CellForm.tsx`, `Cells.tsx`, `CellReportForm.tsx`, `AsyncMemberSelect.tsx`, `select/PaginatedSelect.tsx`, `use-member-options.ts`, `use-member-address.ts`, `lib/cells/host-address.ts`, `lib/cells/weekdays.ts` e o bloco Endereço do `MemberForm.tsx`;_
- _o que já foi desenhado para as mesmas telas: o [E2.01](e2-01-exclusao-logica.md) (T1, T3 e T8), o [E2.02](e2-02-perfis-escopo.md) (T7 e T11), o [E2.04](e2-04-validacoes-membro.md) (T1, T5, T7 e P20 a P24), o [E2.05](e2-05-auditoria-autor.md) (T3 e T5), o [E2.06](e2-06-hierarquia-totais.md) (T2, T5, P44 e P45) e o `PaginatedSelect` do [E1.08](e1-08-paginacao-servidor.md);_
- _o legado, só para manter o que os usuários conhecem: a ordem dos campos, os dias de "Segunda-feira" a "Domingo" e o horário digitado com máscara (`UI/pages/Cells/details.js:395-440`)._

_Usa os padrões de Escolas (P1 a P6), do E2.01 (P7 a P9), do E2.02 (P10 a P14), do E2.04 (P20 a P24), do E2.05 (P30) e do E2.06 (P40, P44 e P45). Os padrões novos começam em P60, para não colidir com os specs desenhados em paralelo. Nenhuma regra de negócio foi criada aqui. Onde a tela precisou de algo que o spec não diz, a decisão é a mais conservadora, marcada como "definido pela UX" e listada em "Pendências para o PO". Os nomes são os da massa de exemplo dos [Critérios de aceite](#critérios-de-aceite); os sobrenomes existem só nos wireframes._

### O que muda, tela a tela
Nenhuma tela nova e nenhuma rota nova.

| Tela ou parte | O que muda | Para quem |
|---|---|---|
| Formulário de célula: estrutura (T1) | Passa ao diálogo responsivo (P1), com cabeçalho e rodapé fixos. Os campos ficam em três grupos, "Pessoas da célula", "Reunião" e "Endereço da célula", na ordem do legado e de hoje. Títulos e botões com só a primeira letra maiúscula. | quem cadastra e edita células |
| Pessoas (T2) | Líder, Timóteo e Anfitrião obrigatórios, com as dicas do Timóteo e do Anfitrião. Os seletores perdem o "✕" de limpar. A pessoa inativa aparece com "(inativo)" ou "(inativa)". | idem |
| Reunião (T3) | Dia e Horário vêm vazios no cadastro novo. Os dias têm os rótulos do legado. O horário é digitado, com máscara, sempre em 24 h. "Célula ativa" aparece só na edição, com a dica e o aviso do que muda ao salvar. | idem |
| Endereço (T4) | O CEP volta e preenche o endereço. Escolher o anfitrião substitui o endereço inteiro, e o aviso aparece embaixo do Anfitrião, e não num toast. | idem |
| Erros (T5) | Todos os erros de uma vez, cada um no seu campo, com o resumo no rodapé. As recusas do servidor vão para o campo ou para o `Alert` do topo, sem toast e sem mensagem técnica. | idem |
| Envio (T6) | O rodapé do E2.04 e do E2.06: "Salvando…", aviso de gravação demorada, queda de conexão e confirmação ao fechar. Toasts próprios para inativar e reativar. | idem |
| Lista de Células (T7) | "Novo relatório" some da célula inativa, sem deslocar "Editar" e "⋯". A situação usa o badge do P6. "Nova Célula" passa a "Nova célula". | quem vê células |
| Formulário de relatório (T8) | A recusa da célula inativa aparece no `Alert` do topo, no lugar da recusa da célula excluída (E2.01). O resto não muda. | quem envia relatório |

### Coerência com os outros specs
- **E2.04:** o formulário de célula é o primeiro a seguir o P22 depois do de membro, como o próprio P22 previa.
  - Valem o P1 (diálogo responsivo), o P21 (dica, erro e aviso de campo), o P22 (conferência ao sair do campo e ao salvar, resumo no rodapé) e a T7 de lá (envio, conexão e descartar).
  - A máscara do CEP não muda: 8 dígitos, como no cadastro de membro. O horário ganha uma máscara própria (P62).
  - O P24 (dado antigo) não se aplica: depois da publicação, nenhuma célula fica fora das regras do tipo (a) (P-CEL-01).
- **E2.02 (T7 e T11):**
  - a dica de alcance continua acima dos três seletores, para quem vê só o ministério, e os seletores seguem o P11;
  - a recusa da RN-09 (c) continua no `Alert` do topo, com o texto de lá;
  - no wireframe da T7 de lá, "Timóteo (Auxiliar)" e "Anfitrião" passam a "Timóteo *" e "Anfitrião *" (T2 deste spec).
- **E2.05 (T3 e T5):**
  - a autoria fica no topo do corpo rolável, como a T3 de lá previa;
  - a mensagem de conexão sai do `Alert` acima dos botões e vai para o rodapé fixo, com o mesmo texto;
  - "Nenhuma alteração para salvar." não muda.
- **E2.06:**
  - na lista, continuam o líder com o nível (T2), o G12 com um nome só, a coluna "Situação" e os cartões até 1023 px (P45);
  - no formulário, o aviso de gravação demorada e a recusa de fechar durante o envio (T5, P44) passam do `Alert` provisório para o rodapé fixo.
- **E2.01:**
  - "Excluir célula" continua no "⋯" (T1);
  - o bloqueio da exclusão de membro já marca a célula "(inativa)" e abre o formulário de célula (T3);
  - a recusa da célula inativa no relatório usa o lugar da recusa da célula excluída (T8).
- **E1.08:** os seletores continuam com busca e paginação no servidor (`PaginatedSelect`), e o endereço do anfitrião continua vindo da `members_view`, com a máscara.

### Decisões de experiência
| # | Decisão | Por quê |
|---|---|---|
| UXD-1 | **O formulário passa para o diálogo responsivo (P1), com o rodapé do E2.04.** No celular, ele ocupa a tela, e "Criar célula" fica sempre à vista. | Hoje o diálogo inteiro rola, e o botão fica depois dos campos do endereço. O resumo de erros, a mensagem de conexão e o aviso de gravação demorada precisam de um rodapé fixo para ficar à vista (P22, P44). |
| UXD-2 | **Três grupos, na ordem de hoje e do legado: "Pessoas da célula", "Reunião" e "Endereço da célula".** | A ordem (pessoas, tipo, dia, horário, endereço) é a que os usuários já conhecem. Os grupos dão nome a cada parte de um formulário longo no celular. "Pessoas da célula" é um termo do Negócio. |
| UXD-3 | **Os três seletores de pessoa não têm o "✕" de limpar (P64).** Para trocar alguém, a pessoa busca e escolhe outra. | A RN-02 diz que, para tirar alguém de um papel, se escolhe outra pessoa no lugar. O "✕" só levaria a um campo vazio e a um erro ao salvar. Ele também é um alvo de 32 px colado na seta do seletor. |
| UXD-4 | **Os dias aparecem como no legado, "Segunda-feira" a "Sexta-feira", "Sábado" e "Domingo", nessa ordem.** O valor gravado é o da RN-05 ("Segunda", "Terça"…). | A RN-05 deixa o rótulo com a UX. Quem vem do legado conhece essa lista (`details.js:415-422`), e o nome por extenso é mais claro para quem tem menos familiaridade. As listas continuam com a forma curta ("Quarta · 20:00"), que não deixa dúvida. |
| UXD-5 | **O horário é digitado, com máscara e teclado numérico, sempre em 24 h (P62)**, como no legado (`details.js:434`), e não pelo seletor nativo. | "2000" são 4 toques num teclado numérico. O seletor nativo do Android é um mostrador de relógio, com as horas em dois anéis, difícil para quem tem pouca familiaridade, e o do computador segue o idioma do navegador e pode mostrar AM/PM. O critério da RN-06 (digitar "25:00" e ver o erro) também pede um campo digitado. |
| UXD-6 | **A pessoa inativa aparece com "(inativo)" ou "(inativa)" no próprio nome, na opção e no valor escolhido, sem ficar desabilitada (P63).** | RN-04 e P-CEL-05: é um aviso, que não impede escolher. No nome, a marca é lida pelo leitor de tela e não depende de cor. |
| UXD-7 | **O aviso do endereço do anfitrião aparece embaixo do Anfitrião, e não num toast (P61). Quando falta completar algo, há o atalho "Ir para o endereço".** | No celular, o endereço fica duas telas abaixo do Anfitrião, e o botão de salvar fica no rodapé fixo. A pessoa escolheria o anfitrião, leria um toast que some em segundos e salvaria sem ver o endereço. O aviso fica onde ela está olhando, e o atalho leva ao CEP. |
| UXD-8 | **Toda escolha de anfitrião no seletor aplica o endereço dele, inclusive quando a pessoa volta ao anfitrião gravado. A resposta de uma escolha anterior é descartada.** | Hoje, na edição, voltar de Fábio para Carla não reaplica o endereço de Carla, e a célula fica com Carla de anfitriã e o endereço de Fábio: a mistura que a P-CEL-07 quer evitar. Ver PO-UX-6. |
| UXD-9 | **O CEP preenche rua, bairro, cidade e estado só quando a pessoa digita ou cola o CEP. O CEP que vem do anfitrião não dispara a busca.** | A RN-09 cita esses quatro campos. Se o CEP do anfitrião disparasse a busca, a rua que veio dele poderia ser trocada pela do CEP. |
| UXD-10 | **"Célula ativa" fica no fim do grupo Reunião, só na edição. A dica acompanha a situação gravada, e mudar o interruptor mostra o que acontece ao salvar (P60).** Sem diálogo de confirmação. | Inativar é reversível, então um diálogo seria um passo a mais sem proteger nada. O aviso cobre o que a dica não diz: os relatórios que a célula já tem continuam, e a volta aos totais vale a partir desta semana (RN-11). |
| UXD-11 | **Na lista, "Novo relatório" some da célula inativa, e "Editar" e "⋯" ficam no mesmo lugar em todas as linhas (P65). A situação usa o badge do P6, com o ícone na inativa.** | RN-11 (c) e P-CEL-10. Na tabela de hoje, as ações ficam alinhadas à esquerda: sem o primeiro ícone, "Editar" pularia para o lugar de "Novo relatório", e quem clica por hábito abriria a coisa errada. O ícone diz "Inativa" sem depender de cor. Ver PO-UX-9. |
| UXD-12 | **O atalho "Cadastrar mais células" do legado não volta.** | Depois de salvar, "Nova célula" está a um toque, no topo da lista. A carga do legado traz todas as células, então cadastrar muitas de uma vez deixa de ser comum, e uma caixa a mais no rodapé fixo do celular disputaria espaço com os botões. Ver PO-UX-8. |
| UXD-13 | **A recusa da célula inativa no relatório aparece no `Alert` do topo, como a da célula excluída (E2.01).** Aberto pela lista, o formulário oferece "Fechar"; aberto por Relatórios, a célula fica desmarcada. | É o mesmo caso visto de outro jeito: a célula deixou de receber relatórios enquanto o formulário estava aberto. Aberto pela lista, a célula fica travada no formulário, e tentar de novo não adianta. |

### Navegação e rotas
Nenhuma rota nova. O formulário continua abrindo pela lista de Células ("Nova célula" e "Editar") e pelo bloqueio da exclusão de membro (T3 do E2.01).

### Fluxos
Contagem no celular, a partir de qualquer tela com o menu fechado, incluindo o toque no ☰, salvo quando a linha diz outra coisa. "Toque" não conta a digitação. Num seletor, abrir e escolher são 2 toques.

| # | História | Caminho | Toques e telas |
|---|---|---|---|
| F1 | A secretaria cadastra uma célula (Rita, desktop, a partir da lista de Células) | "Nova célula" → Líder → Timóteo → Anfitrião (o endereço vem de Carla) → Dia → Horário (digita "2000") → "Criar célula" | 11 cliques e a digitação. Hoje são 8, porque o dia e o horário já vêm com Sábado e 19:00, um valor que ninguém escolheu (P-CEL-02). |
| F2 | O líder cadastra uma célula na casa de alguém cujos dados sensíveis ele não vê (Pedro) | ☰ → Células → "Nova célula" → Líder → Timóteo → Anfitrião (bairro, cidade e estado) → Dia → Horário → "Ir para o endereço" (foco no CEP) → digita o CEP (a rua vem do CEP) → Número → "Criar célula" | 15 toques e a digitação |
| F3 | A mesma pessoa em dois papéis (a célula é na casa do líder) | … → Líder → André → … → Anfitrião → André → … | sem passo a mais e sem aviso (RN-03) |
| F4 | Inativar uma célula (Pedro) | ☰ → Células → busca → "Editar" → desliga "Célula ativa" → lê o aviso → "Salvar alterações" | 6 toques e a busca. O toast diz "Célula inativada.", e o cartão mostra "Inativa", sem "Novo relatório". |
| F5 | Reativar | o mesmo caminho, ligando "Célula ativa" | 6 toques e a busca |
| F6 | Trocar o anfitrião (Rita edita C1, a partir da lista) | "Editar" → Anfitrião → Fábio → lê o aviso → "Salvar alterações" | 4 toques |
| F7 | Corrigir erros de preenchimento | "Criar célula" → foco no primeiro erro → corrige → "Criar célula", que leva ao próximo erro, se houver | +1 toque por rodada, e nada vai ao servidor |
| F8 | A célula é inativada com o relatório aberto (Carla) | "Salvar" → recusa no topo → "Fechar" | +1 toque, sem gravar nada |
| F9 | A conexão cai ao salvar | "Criar célula" → mensagem no rodapé → "Criar célula" de novo | +1 toque, sem digitar de novo |
| F10 | Fechar sem querer | "✕" → "Continuar editando" | +1 toque, sem perder nada |

### Telas
As convenções dos wireframes são as do E2.04, com estas:
- 360 px ≈ 38 colunas;
- `[Botão]` é botão, e `[▾]` é seleção;
- `[○  ]` e `[  ●]` são o interruptor desligado e ligado;
- `(i)` é informação, `(!)` é aviso, `⚠` é erro e `(◌)` é o indicador de carregando;
- `⏸` é o ícone `PauseCircle`, `[▤+]` é "Novo relatório", `[✎]` é "Editar", `[⋯]` é o menu de ações e `[✗]` é "Excluir" na tabela.

A margem lateral é a do diálogo (`p-4` no celular).

#### T1. Estrutura do formulário
Celular, com Rita numa célula nova:
```
┌──────────────────────────────────────┐
│ ✕  Nova célula                       │  cabeçalho fixo
│──────────────────────────────────────│
│ Campos com * são obrigatórios.       │  text-sm, cor muted
│                                      │
│ Pessoas da célula                    │  legend do fieldset
│ Líder *                              │
│ [Buscar líder…                    ▾] │
│ Timóteo *                            │
│ Auxilia o líder e está em formação   │  dica, entre o rótulo e o campo
│ para liderar.                        │
│ [Buscar timóteo…                  ▾] │
│ Anfitrião *                          │
│ Quem recebe a célula em casa.        │
│ [Buscar anfitrião…                ▾] │
│                                      │
│ Reunião                              │  legend
│ Tipo *                               │
│ [Evangelística                    ▾] │
│ Dia da semana *                      │
│ [Escolha o dia                    ▾] │  sem dia escolhido
│ Horário *                            │
│ [00:00                             ] │  vazio; teclado numérico (P62)
│                                      │
│ Endereço da célula                   │  legend
│ CEP                                  │
│ [00000-000                         ] │
│ Rua                                  │
│ [                                  ] │
│ Número                               │
│ [                                  ] │
│ Complemento                          │
│ [                                  ] │
│ Bairro                               │
│ [                                  ] │
│ Cidade                               │
│ [                                  ] │
│ Estado                               │
│ [UF                               ▾] │
│──────────────────────────────────────│
│ [Cancelar        ] [Criar célula   ] │  rodapé fixo, h-11
└──────────────────────────────────────┘
```
Desktop (a partir de 768 px, `Dialog` com `max-w-3xl`):
```
┌────────────────────────────────────────────────────────────────────────┐
│ Nova célula                                                       ✕    │
│────────────────────────────────────────────────────────────────────────│
│ Campos com * são obrigatórios.                                         │
│ Pessoas da célula                                                      │
│ Líder *                                                                │
│ [Buscar líder…                                                     ▾]  │
│ Timóteo *                                                              │
│ Auxilia o líder e está em formação para liderar.                       │
│ [Buscar timóteo…                                                   ▾]  │
│ Anfitrião *                                                            │
│ Quem recebe a célula em casa.                                          │
│ [Buscar anfitrião…                                                 ▾]  │
│ Reunião                                                                │
│ Tipo *                                                                 │
│ [Evangelística                ▾]                                       │
│ Dia da semana *                     Horário *                          │
│ [Escolha o dia                ▾]    [00:00                         ]   │
│ Endereço da célula                                                     │
│ CEP                                                                    │
│ [00000-000                     ]                                       │
│ Rua                                                                    │
│ [                                                                   ]  │
│ Número                              Complemento                        │
│ [                              ]    [                              ]   │
│ Bairro                              Cidade                             │
│ [                              ]    [                              ]   │
│ Estado                                                                 │
│ [UF                           ▾]                                       │
│────────────────────────────────────────────────────────────────────────│
│                                         [Cancelar]  [Criar célula]     │
└────────────────────────────────────────────────────────────────────────┘
```
Edição de uma célula inativa (C1 depois que Pedro a inativou), no celular:
```
┌──────────────────────────────────────┐
│ ✕  Editar célula  [⏸ Inativa]        │  badge: só com a célula gravada inativa
│──────────────────────────────────────│
│ Cadastrada por Ana Souza em          │  autoria (T3 do E2.05)
│ 02/11/2026 às 09:00                  │
│ [⟲ Ver histórico]                    │
│ Campos com * são obrigatórios.       │
│                                      │
│ Pessoas da célula                    │
│ …                                    │
│ Reunião                              │
│ …                                    │
│ Horário *                            │
│ [20:00                             ] │
│ Célula ativa                  [○  ]  │  a linha inteira muda o interruptor
│ Ligue quando a célula voltar a se    │  dica da célula inativa †
│ reunir. A célula inativa não conta   │
│ nos totais e não recebe relatórios.  │
│                                      │
│ Endereço da célula                   │
│ …                                    │
│──────────────────────────────────────│
│ [Cancelar      ] [Salvar alterações] │
└──────────────────────────────────────┘
```
- **Celular (abaixo de 768 px), pelo P1:**
  - uma coluna;
  - o cabeçalho tem o "✕" e o título e, na edição de uma célula gravada como inativa, o badge "Inativa";
  - o corpo rola (`overflow-y-auto`), com `scroll-pt` e `scroll-pb` da altura do cabeçalho e do rodapé, para que o campo em foco nunca fique atrás deles (WCAG 2.4.11);
  - o rodapé fixo tem "Cancelar" (`outline`) e a ação primária (`default`), lado a lado, cada um com metade da largura e `h-11`, e `pb-[calc(1rem+env(safe-area-inset-bottom))]`.
- **Desktop (a partir de 768 px):**
  - `Dialog` centralizado, com `max-w-3xl`, `max-h-[90dvh]` e o mesmo cabeçalho e rodapé fixos;
  - Líder, Timóteo e Anfitrião ocupam a linha inteira, um por linha. Em par, as dicas de alturas diferentes desalinhariam os campos, e os nomes com "(inativo)" precisam de espaço;
  - ficam em par: Dia da semana e Horário; Número e Complemento; Bairro e Cidade;
  - Tipo, CEP e Estado ocupam meia linha; Rua e "Célula ativa" ocupam a linha inteira.
- **Ordem (UXD-2):**
  1. na edição, a autoria (T3 do E2.05);
  2. "Campos com * são obrigatórios.";
  3. "Pessoas da célula": a dica de alcance (E2.02, só para quem vê só o ministério), Líder, Timóteo e Anfitrião;
  4. "Reunião": Tipo, Dia da semana, Horário e, só na edição, "Célula ativa";
  5. "Endereço da célula": CEP, Rua, Número, Complemento, Bairro, Cidade e Estado.
- **Grupos:** cada um é um `fieldset` sem borda, com a `legend` no estilo dos subtítulos de hoje (`text-base font-semibold`). O `Separator` entre "Reunião" e o endereço continua.
- **Textos (P-CEL-13):**
  - títulos: "Nova célula" e "Editar célula" (hoje "Nova Célula" e "Editar Célula");
  - ação primária: "Criar célula" no cadastro e "Salvar alterações" na edição (hoje "Criar Célula" e "Salvar", sem objeto).
- **Badge "Inativa" no cabeçalho:** P6 (`bg-muted`, borda `border-border`, texto `text-foreground` e o ícone `PauseCircle`), num `span` com `badgeVariants`. Mostra a situação gravada e não muda quando o interruptor muda.
- **Formulário:** `noValidate`, para o navegador não mostrar os balões dele.
- **Componentes:** `Dialog` (com o P1), `AsyncMemberSelect` sobre o `PaginatedSelect`, `Select`, `Input`, `Switch`, `Alert`, `AlertDialog` (descartar), `Badge` (como `span`) e `Button`. O `useIsMobile` não entra: a troca é só CSS (P1).

#### T2. Pessoas: Líder, Timóteo e Anfitrião
```
Pedro edita C1                           Pedro escolhe Fábio, inativo, como timóteo
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Pessoas da célula                    │ │ Timóteo *                            │
│ Líder, timóteo e anfitrião são       │ │ Auxilia o líder e está em formação   │
│ escolhidos entre as pessoas do seu   │ │ para liderar.                        │
│ ministério.                          │ │ [fáb                              ▾] │
│ Líder *                              │ │ ┌──────────────────────────────────┐ │
│ [André Souza                      ▾] │ │ │ Fábio Lima (inativo)             │ │
│ Timóteo *                            │ │ │ Fabíola Reis                     │ │
│ Auxilia o líder e está em formação   │ │ └──────────────────────────────────┘ │
│ para liderar.                        │ │                                      │
│ [Caio Lima                        ▾] │ │ Depois de escolher:                  │
│ Anfitrião *                          │ │ [Fábio Lima (inativo)             ▾] │
│ Quem recebe a célula em casa.        │ └──────────────────────────────────────┘
│ [Carla Dias                       ▾] │
└──────────────────────────────────────┘
```
- **Rótulos e placeholders:** "Líder *", "Timóteo *" e "Anfitrião *", com "Buscar líder…", "Buscar timóteo…" e "Buscar anfitrião…". O "(Auxiliar)" sai do Timóteo (P-CEL-13).
- **Dicas (P21):** "Auxilia o líder e está em formação para liderar." no Timóteo e "Quem recebe a célula em casa." no Anfitrião.
  - Ficam entre o rótulo e o campo, e não embaixo do campo: explicam o termo antes da escolha, e o menu aberto cobriria uma dica embaixo.
  - O erro do campo fica embaixo do campo, como no P21.
- **Dica de alcance (T7 do E2.02):** para quem vê só o ministério, fica logo depois da legenda, antes do Líder, e entra no `aria-describedby` dos três seletores.
- **Sem "✕" de limpar (P64, UXD-3).** Para trocar, a pessoa toca no campo, busca e escolhe outra. O seletor é obrigatório para o leitor de tela (`aria-required="true"`).
- **A mesma pessoa em vários papéis (RN-03):** nenhum seletor tira das opções quem já está em outro papel, e nada avisa. O seletor de Timóteo oferece o próprio líder, sem sugeri-lo (Q-4).
- **Pessoa inativa (RN-04, P63):**
  - na opção e no valor escolhido, o nome vem seguido de "(inativo)" ou "(inativa)", conforme o sexo. Com o sexo ainda não registrado (só antes do E2.04), "(inativo)";
  - a marca tem a mesma cor e o mesmo peso do nome e faz parte do nome acessível;
  - a opção não fica desabilitada, e salvar com uma pessoa inativa é aceito, sem aviso a mais;
  - na edição, a marca aparece também nas pessoas gravadas, assim que os nomes carregam (AQ-2);
  - pessoa fora do escopo de quem edita (Beatriz, para Pedro): só o nome, como no P11, sem a marca (PO-UX-5).
- **Pessoa excluída:** nunca aparece nas opções (E2.01). A recusa por corrida fica na T5.
- **Busca sem resultado:** "Nenhum membro do seu ministério encontrado." para quem vê só o ministério (P11) e "Nenhum membro encontrado" para os outros, como hoje.
- **Anfitrião e endereço:** a escolha do anfitrião preenche o endereço (T4). O aviso aparece embaixo do Anfitrião.

#### T3. Reunião: Tipo, Dia da semana, Horário e "Célula ativa"
```
Dia aberto; Horário ao sair do campo     Pedro desliga "Célula ativa" em C1
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Dia da semana *                      │ │ Célula ativa                  [○  ]  │
│ [Escolha o dia                    ▾] │ │ Desligue quando a célula parar de se │
│ ┌──────────────────────────────────┐ │ │ reunir. A célula inativa sai dos     │
│ │ Segunda-feira                    │ │ │ totais e não recebe relatórios.      │
│ │ Terça-feira                      │ │ │ (i) Ao salvar, a célula fica         │
│ │ Quarta-feira                     │ │ │ inativa. Os relatórios que ela já    │
│ │ Quinta-feira                     │ │ │ tem continuam.                       │
│ │ Sexta-feira                      │ │ │                                      │
│ │ Sábado                           │ │ │ C1 já inativa, ligada de novo:       │
│ │ Domingo                          │ │ │ Célula ativa                  [  ●]  │
│ └──────────────────────────────────┘ │ │ Ligue quando a célula voltar a se    │
│ Horário *                            │ │ reunir. A célula inativa não conta   │
│ [19:60                             ] │ │ nos totais e não recebe relatórios.  │
│ ⚠ Horário inválido. Informe a hora e │ │ (i) Ao salvar, a célula volta aos    │
│ os minutos, entre 00:00 e 23:59.     │ │ totais e a receber relatórios a      │
└──────────────────────────────────────┘ │ partir desta semana.                 │
                                         └──────────────────────────────────────┘
```
- **Tipo * (RN-07):**
  - `Select` com "Evangelística", "Discipulado" e "Macrocélula";
  - na célula nova, vem com "Evangelística". Não há opção vazia, então o campo nunca fica sem valor na tela.
- **Dia da semana * (RN-05, UXD-4):**
  - `Select` sem valor na célula nova, com o placeholder "Escolha o dia";
  - opções, nessa ordem: "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado" e "Domingo";
  - o valor enviado é sempre o da RN-05 ("Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado" e "Domingo"). Rótulo e valor ficam numa lista só no front, ao lado de `src/lib/cells/weekdays.ts`, que continua sendo a lista dos valores;
  - na edição, mostra o rótulo do valor gravado ("Quarta-feira" para "Quarta").
- **Horário * (RN-06, P62, UXD-5):**
  - `Input` com `type="text"`, `inputMode="numeric"`, `autoComplete="off"`, `placeholder="00:00"` e `maxLength={5}`;
  - a máscara põe os dois-pontos depois do segundo dígito. Se a pessoa digita ":" depois de um dígito só, a hora ganha o zero na frente ("7:" vira "07:");
  - ao sair do campo, o valor é lido como na tabela abaixo. O erro de formato aparece só se a pessoa alterou o campo e o deixou preenchido (P22);
  - na edição, mostra a hora e os minutos do valor gravado ("20:00" para "20:00:00"), e o valor não conta como alterado (E2.05).
- **"Célula ativa" (RN-11, P60, UXD-10):**
  - só na edição, no fim do grupo Reunião. No cadastro novo, o interruptor não existe no DOM, e a célula é gravada ativa (RN-11);
  - a linha inteira é o `Label` (`flex-1`, `min-h-11`): o toque em qualquer ponto dela muda o interruptor, como na T4 do E2.04;
  - a dica, embaixo do rótulo, segue a situação gravada:
    - ativa: "Desligue quando a célula parar de se reunir. A célula inativa sai dos totais e não recebe relatórios." (Negócio);
    - inativa: "Ligue quando a célula voltar a se reunir. A célula inativa não conta nos totais e não recebe relatórios." †;
  - quando o interruptor fica diferente do gravado, aparece o aviso `(i)` embaixo da dica, com `role="status"`:
    - desligado: "Ao salvar, a célula fica inativa. Os relatórios que ela já tem continuam." †;
    - ligado: "Ao salvar, a célula volta aos totais e a receber relatórios a partir desta semana." †;
  - voltar o interruptor ao valor gravado tira o aviso. Nada muda até salvar.

Horário: o que o campo mostra (UX-08)

| Digitado ou colado | Enquanto digita | Ao sair do campo |
|---|---|---|
| `2000` | `20:00` | `20:00` |
| `19:30` (com os dois-pontos) | `19:30` | `19:30` |
| `7:30` | `07:30` | `07:30` |
| `0730` | `07:30` | `07:30` |
| `20` | `20:` | `20:00` |
| `7` | `7` | `07:00` |
| `19:30:45` (colado) | `19:30` | `19:30` |
| `730` | `73:0` | `73:0`, com o erro |
| `2400` | `24:00` | `24:00`, com o erro |
| `1960` | `19:60` | `19:60`, com o erro |
| `2500` | `25:00` | `25:00`, com o erro |

#### T4. Endereço da célula: CEP e anfitrião
```
Rita escolhe Carla (com acesso)          Pedro escolhe Carla (sem acesso)
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Anfitrião *                          │ │ Anfitrião *                          │
│ Quem recebe a célula em casa.        │ │ Quem recebe a célula em casa.        │
│ [Carla Dias                       ▾] │ │ [Carla Dias                       ▾] │
│ (i) Endereço preenchido com o do     │ │ (i) Bairro, cidade e estado          │
│ anfitrião.                           │ │ preenchidos com os do anfitrião.     │
│ …                                    │ │ Complete o CEP, a rua e o número.    │
│ Endereço da célula                   │ │ [Ir para o endereço]                 │
│ CEP                                  │ │ …                                    │
│ [90010-000                         ] │ │ Endereço da célula                   │
│ Rua                                  │ │ CEP                                  │
│ [Rua das Flores                    ] │ │ [                                  ] │
│ Número                               │ │ Rua                                  │
│ [100                               ] │ │ [                                  ] │
│ Complemento                          │ │ Número                               │
│ [ap. 2                             ] │ │ [                                  ] │
│ Bairro                               │ │ Complemento                          │
│ [Centro                            ] │ │ [                                  ] │
│ Cidade                               │ │ Bairro                               │
│ [Porto Alegre                      ] │ │ [Centro                            ] │
│ Estado                               │ │ Cidade                               │
│ [RS                               ▾] │ │ [Porto Alegre                      ] │
└──────────────────────────────────────┘ │ Estado                               │
                                         │ [RS                               ▾] │
                                         └──────────────────────────────────────┘
```
```
Rita escolhe Gabriel (sem endereço)      Carregando e falha
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Anfitrião *                          │ │ Anfitrião *                          │
│ Quem recebe a célula em casa.        │ │ Quem recebe a célula em casa.        │
│ [Gabriel Nunes                    ▾] │ │ [Fábio Lima (inativo)             ▾] │
│ (i) O endereço do anfitrião não está │ │ (◌) Buscando o endereço do           │
│ disponível. Preencha o endereço da   │ │ anfitrião…                           │
│ célula.                              │ │                                      │
│ [Ir para o endereço]                 │ │ Se a consulta falhar:                │
└──────────────────────────────────────┘ │ ⚠ Não foi possível carregar o        │
                                         │ endereço do anfitrião.               │
                                         │ [Tentar de novo]                     │
                                         └──────────────────────────────────────┘
```
```
CEP digitado                             CEP não encontrado (aviso, não bloqueia)
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ CEP  (◌) Buscando endereço…          │ │ CEP                                  │
│ [90010-000                         ] │ │ [99999-999                         ] │
│ Rua                                  │ │ (!) CEP não encontrado. Confira o    │
│ [Rua das Flores                    ] │ │ número ou preencha o endereço.       │
└──────────────────────────────────────┘ │ Rua                                  │
                                         │ [                                  ] │
                                         └──────────────────────────────────────┘
```
- **Campos (RN-09):** CEP, Rua, Número, Complemento, Bairro, Cidade e Estado, todos opcionais e sem "*".
  - Todos com `autoComplete="off"`: o endereço é o da reunião, e o preenchimento automático ofereceria o endereço de quem está cadastrando.
  - Estado continua um `Select` com as 27 UFs e o placeholder "UF".
- **CEP (RN-09, UXD-9):**
  - `inputMode="numeric"`, `placeholder="00000-000"` e a máscara de 8 dígitos do cadastro de membro;
  - com 8 dígitos digitados ou colados, a busca preenche rua, bairro, cidade e estado onde o serviço de CEP traz valor. Número e complemento não mudam;
  - durante a busca, "Buscando endereço…" aparece ao lado do rótulo, com o indicador (`role="status"`). Os campos continuam editáveis;
  - quando os campos chegam, o leitor de tela ouve "Rua, bairro, cidade e estado preenchidos pelo CEP." † (`sr-only`, `role="status"`). Na tela, os campos já estão logo abaixo do CEP;
  - CEP não encontrado: o aviso "CEP não encontrado. Confira o número ou preencha o endereço." † embaixo do campo;
  - falha ou demora do serviço: "Não foi possível buscar o endereço pelo CEP. Preencha o endereço." †;
  - os dois são avisos (P21): não marcam o campo como inválido, não entram no resumo e não impedem salvar. Somem quando o CEP muda;
  - o CEP preenchido pelo anfitrião não dispara a busca.
- **Endereço do anfitrião (RN-10, P61, UXD-7 e UXD-8):**
  - **quando:** a cada escolha no seletor de Anfitrião, na célula nova ou na edição, inclusive a volta ao anfitrião gravado. Numa edição em que o anfitrião não muda, nada é consultado, e o endereço fica como está;
  - **carregando:** "Buscando o endereço do anfitrião…" embaixo do Anfitrião, com o indicador (`role="status"`). O endereço só muda quando a resposta chega;
  - **com os dados sensíveis do anfitrião** (Rita): os sete campos passam a ser os do anfitrião, inclusive vazios onde ele não tem dado. Aviso: "Endereço preenchido com o do anfitrião.";
  - **sem os dados sensíveis** (Pedro): bairro, cidade e estado passam a ser os do anfitrião, e CEP, rua, número e complemento ficam vazios. Aviso: "Bairro, cidade e estado preenchidos com os do anfitrião. Complete o CEP, a rua e o número.", com o atalho "Ir para o endereço";
  - **nada disponível** (Gabriel, ou o anfitrião com só a rua e o CEP para quem não os vê): o endereço não muda. Aviso: "O endereço do anfitrião não está disponível. Preencha o endereço da célula.", com o atalho. O texto e o DOM são os mesmos nos dois casos, para não revelar se o anfitrião tem endereço;
  - **falha:** "Não foi possível carregar o endereço do anfitrião." embaixo do Anfitrião, com "Tentar de novo". O endereço não muda;
  - **"Ir para o endereço":** `Button variant="link"`, com `min-h-11` no celular. Rola até o grupo do endereço e põe o foco no CEP;
  - **o aviso fica** até a próxima escolha de anfitrião ou até o formulário fechar. Mexer no endereço à mão não o tira;
  - **escolhas seguidas:** se a pessoa escolhe Fábio e logo depois Carla, só a resposta de Carla é aplicada, mesmo que a de Fábio chegue depois;
  - **sem toast:** saem os toasts "Endereço carregado" e "Endereço carregado em parte" de hoje;
  - **nada é gravado até salvar:** fechar sem salvar mantém o endereço gravado (UX-25 trata da confirmação de descartar).

#### T5. Erros ao salvar
O exemplo é o do critério da RN-14: Rita abre "Nova célula" e salva sem preencher nada. No celular:
```
┌──────────────────────────────────────┐
│ ✕  Nova célula                       │
│──────────────────────────────────────│
│ Pessoas da célula                    │
│ Líder *                              │
│ [Buscar líder…                    ▾] │  foco: o primeiro erro
│ ⚠ Escolha o líder da célula.         │
│ Timóteo *                            │
│ Auxilia o líder e está em formação   │
│ para liderar.                        │
│ [Buscar timóteo…                  ▾] │
│ ⚠ Escolha o timóteo da célula.       │
│ Anfitrião *                          │
│ Quem recebe a célula em casa.        │
│ [Buscar anfitrião…                ▾] │
│ ⚠ Escolha o anfitrião da célula.     │
│ Reunião                              │
│ Tipo *                               │
│ [Evangelística                    ▾] │
│ Dia da semana *                      │
│ [Escolha o dia                    ▾] │
│ ⚠ Escolha o dia da semana.           │
│ Horário *                            │
│ [00:00                             ] │
│ ⚠ Informe o horário.                 │
│ …                                    │
│──────────────────────────────────────│
│ ⚠ Confira os campos destacados (5).  │  resumo, role="status"
│ [Cancelar        ] [Criar célula   ] │
└──────────────────────────────────────┘
```
Recusas do servidor:
```
Pessoa excluída no meio tempo (RN-14)    Célula que sairia do escopo (E2.02)
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Timóteo *                            │ │ ✕  Editar célula                     │
│ Auxilia o líder e está em formação   │ │──────────────────────────────────────│
│ para liderar.                        │ │ ┌──────────────────────────────────┐ │
│ [Ester Ramos                      ▾] │ │ │ ⚠ Com esta alteração, você       │ │
│ ⚠ Este membro foi excluído e não     │ │ │ deixaria de ver esta célula.     │ │
│ pode ser escolhido.                  │ │ │ Mantenha pelo menos uma pessoa   │ │
│──────────────────────────────────────│ │ │ do seu ministério como líder,    │ │
│ ⚠ Confira os campos destacados (1).  │ │ │ timóteo ou anfitrião. As         │ │
│ [Cancelar      ] [Salvar alterações] │ │ │ alterações não foram salvas.     │ │
└──────────────────────────────────────┘ │ └──────────────────────────────────┘ │
                                         │ Cadastrada por Ana Souza em          │
                                         │ …                                    │
                                         └──────────────────────────────────────┘
```
- **Quando a tela confere (P22):**
  - **ao sair do Horário** alterado e preenchido: só o formato. Sair de um campo vazio não mostra erro;
  - **ao tocar em "Criar célula" ou "Salvar alterações":** pessoas, dia e horário (RN-02, RN-05 e RN-06), todos de uma vez, cada um no seu campo. Nada é enviado enquanto houver erro (RN-14);
  - **depois que um erro aparece,** ele some assim que o valor fica certo: escolher a pessoa, escolher o dia ou corrigir o horário.
- **Foco:** vai para o primeiro campo com erro, na ordem da tela, que fica inteiro à vista. Nos seletores, o foco vai para a busca.
- **Resumo no rodapé:** "Confira os campos destacados ({N})." acima dos botões no celular e à esquerda deles no desktop, com `role="status"`. O número diminui a cada correção. Tocar de novo na ação primária leva o foco ao próximo campo com erro.
- **Recusas do servidor (RN-14):** o formulário nunca fecha numa recusa, mantém tudo o que foi digitado e nunca mostra toast de erro nem mensagem técnica.

| Caso | Onde aparece | Texto |
|---|---|---|
| Sem líder, timóteo, anfitrião, dia ou horário (na tela) | embaixo do campo; entra no resumo | os do Negócio |
| Horário fora do formato (na tela) | embaixo do Horário; entra no resumo | Horário inválido. Informe a hora e os minutos, entre 00:00 e 23:59. |
| Pessoa excluída no meio tempo (servidor) | embaixo do campo do papel, com o foco; entra no resumo | Este membro foi excluído e não pode ser escolhido. |
| Pessoa que não se vê (servidor, por corrida) | embaixo do campo do papel; sem o campo na resposta (AQ-1), no `Alert` do topo | Você só pode escolher pessoas que você vê. |
| Célula que deixaria de ser vista (RN-09 c do E2.02) | `Alert` do topo, com o foco | Com esta alteração, você deixaria de ver esta célula. Mantenha pelo menos uma pessoa do seu ministério como líder, timóteo ou anfitrião. As alterações não foram salvas. |
| Célula excluída ou fora do escopo no meio tempo (E2.01) | `Alert` do topo, com "Fechar", que fecha o formulário e recarrega a lista | Esta célula não existe ou já foi excluída. As alterações não foram salvas. |
| Sem permissão (42501) | `Alert` do topo; a tela relê o acesso (P13) | Você não tem permissão para esta ação. |
| Dia ou tipo fora da lista, horário que a tela deixou passar (versão antiga da tela) | embaixo do Dia, do Tipo ou do Horário | os do Negócio |
| Célula nova inativa (só por uma versão antiga da tela) | `Alert` do topo | Uma célula nova sempre começa ativa. |
| Erro que a tela não reconhece, erro do servidor (5xx) ou rede | rodapé, com `role="alert"` (T6) | Não foi possível salvar a célula. Verifique a conexão e tente de novo. |

- **Mensagem do servidor num campo:** entra no resumo, recebe o foco como os erros da tela e some quando a pessoa muda aquele campo.
- **`Alert` do topo:** fica no começo do corpo rolável, antes da autoria, recebe o foco (`tabIndex={-1}`), e a tela rola até ele, como na T11 do E2.02.
- **Ordem (RN-14):** as recusas de permissão, de escopo e de registro excluído vêm antes das deste spec. A tela mostra o que o servidor responder primeiro.
- **Sem o código e o campo (AQ-1):** o texto do servidor, quando é um texto do Negócio, vai para o `Alert` do topo, sem marcar o campo. Qualquer outro texto vira a mensagem de conexão da T6.

#### T6. Envio, conexão, sucesso e fechar
```
Aos 3 s em "Salvando…" (P44)             Queda de conexão
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│──────────────────────────────────────│ │──────────────────────────────────────│
│ Ainda salvando. Isso pode levar      │ │ ⚠ Não foi possível salvar a célula.  │
│ alguns segundos.                     │ │ Verifique a conexão e tente de novo. │
│ [Cancelar        ] [(◌) Salvando…  ] │ │ [Cancelar        ] [Criar célula   ] │
└──────────────────────────────────────┘ └──────────────────────────────────────┘
```
- **Enviando (T7 do E2.04 e P44):**
  - o botão mostra "Criando…" ou "Salvando…", com o `Loader2` (`motion-reduce:animate-none`), e os dois botões ficam desabilitados. Um duplo toque não envia duas vezes;
  - durante o envio, "✕", `Esc` e o toque fora do diálogo não fecham o formulário;
  - aos 3 s sem resposta, aparece "Ainda salvando. Isso pode levar alguns segundos." acima dos botões, em `text-sm text-muted-foreground`, com `role="status"`. Inativar e reativar recalculam os totais (RN-11 a), então a espera pode ser maior que a de hoje.
- **Queda de conexão ou erro do servidor:**
  - "Não foi possível salvar a célula. Verifique a conexão e tente de novo." no rodapé, acima dos botões, com `role="alert"`;
  - os dados ficam, os botões voltam, e o foco vai para a ação primária, que serve de "Tentar de novo";
  - na célula nova, se a conexão cair depois de o servidor gravar, a nova tentativa criaria uma segunda célula igual, porque não há regra de unicidade (RN-03). Ver AQ-3. Sem ela, a mensagem do cadastro novo ganha a frase "Antes de tentar de novo, confira na lista de Células se a célula já foi criada." †
- **Sucesso:** o formulário fecha, a lista recarrega (P44), e aparece um toast:

| Gravação | Toast |
|---|---|
| Célula nova | Célula criada. |
| Edição que inativa a célula, com ou sem outras mudanças | Célula inativada. † |
| Edição que reativa a célula, com ou sem outras mudanças | Célula reativada. † |
| Outra edição | Célula atualizada. |
| Edição sem nenhuma mudança (T5 do E2.05) | Nenhuma alteração para salvar. (sem chamar o servidor) |

- **Fechar com alterações (UXD-14 do E2.04):** "Cancelar", "✕", `Esc` e o toque fora do diálogo pedem "Descartar as alterações?", com "O que você digitou não será salvo.", "Descartar" (`destructive`) e "Continuar editando" (`outline`, foco inicial). Sem alteração, fecham direto.
  - Escolher outro anfitrião conta como alteração, e o endereço que ele preencheu também.
  - Um endereço preenchido e depois desfeito à mão, até ficar igual ao gravado, não conta.

#### T7. Lista de Células
Cartões (até 1023 px, P45), com Pedro:
```
┌──────────────────────────────────────┐
│ André Souza (144)     [▤+] [✎] [⋯]   │  C1 ativa
│ G12: Pedro Alves                     │
│ Timóteo: Caio Lima                   │
│ Anfitrião: Carla Dias                │
│ [Evangelística] [Ativa]              │
│ Quarta · 20:00                       │
│ Rua das Flores, 100 — Centro         │
│──────────────────────────────────────│
│ André Souza (144)          [✎] [⋯]   │  C1 inativa: sem "Novo relatório";
│ G12: Pedro Alves                     │  "Editar" e "⋯" no mesmo lugar
│ Timóteo: Caio Lima                   │
│ Anfitrião: Carla Dias                │
│ [Evangelística] [⏸ Inativa]          │  badge do P6, com ícone
│ Quarta · 20:00                       │
│ Rua das Flores, 100 — Centro         │
└──────────────────────────────────────┘
```
Tabela (a partir de 1024 px):
```
┌───────────────────────────────────────────────────────────────────────┐
│ Líder                  │ G12          │ … │ Situação   │        Ações │
│───────────────────────────────────────────────────────────────────────│
│ Diego Reis (144)       │ Tiago Rocha  │ … │ Ativa      │ [▤+] [✎] [✗] │  célula ativa
│ Timóteo: Hugo Melo     │              │   │            │              │
│ André Souza (144)      │ Pedro Alves  │ … │ ⏸ Inativa  │      [✎] [✗] │  inativa: "Editar" e "Excluir"
│ Timóteo: Caio Lima     │              │   │            │              │  na mesma coluna (justify-end)
│ Anfitrião: Carla Dias  │              │   │            │              │
└───────────────────────────────────────────────────────────────────────┘
```
- **"Novo relatório" (RN-11 c, P-CEL-10):** não aparece na célula inativa, nem no cartão nem na tabela, para ninguém. Na célula ativa, continua a regra da T7 do E2.02 (pessoa da célula com "Enviar Relatório das Próprias Células", ou quem tem "Editar Célula" ou "Enviar Relatório de Qualquer Célula Visível"). A tela usa o mesmo cálculo do banco (AQ-7).
- **Ações no mesmo lugar (P65, UXD-11):**
  - no cartão, o grupo de ações já fica alinhado à direita do cabeçalho, e continua assim;
  - na tabela, a célula da coluna Ações passa a alinhar os botões pelo fim (`justify-end`). Assim, "Editar" e "Excluir" ficam na mesma coluna em todas as linhas, com ou sem "Novo relatório".
- **Nome acessível:** o botão de ícone passa a se chamar "Novo relatório da célula de {Líder}" (`aria-label`), e sai o `title`, que só aparece com o mouse. Os outros seguem a T1 do E2.01.
- **Situação (P6, PO-UX-9):** "Ativa" com `bg-success/15`, `border-success` e `text-foreground`, sem ícone; "Inativa" com `bg-muted`, `border-border`, `text-foreground` e o ícone `PauseCircle` (`aria-hidden`). Hoje são as variantes `default` e `secondary` do `Badge`, sem ícone.
- **A célula inativa não fica apagada:** sem `opacity` reduzida, que baixaria o contraste. O badge basta.
- **O resto do cartão não muda.** A linha dos badges ganha `flex-wrap`: em 320 px, ou com fonte grande, o dia e o horário descem para a linha de baixo em vez de sair do cartão.
- **Cabeçalho:** "Nova Célula" passa a "Nova célula". O subtítulo de alcance é o do E2.02 (P10).
- **Depois de salvar no formulário:** a lista recarrega com as linhas "atualizando" (P44). A célula inativada aparece com "Inativa" e sem "Novo relatório" assim que a resposta chega, sem recarregar a página.
- **Filtro por situação:** fica para o E2.10 (Impactos do Negócio). Nada muda na busca.

#### T8. Formulário de relatório (`CellReportForm`)
Carla abriu "Novo relatório" de C1 antes de Pedro inativá-la e toca em "Salvar" (critério da RN-11):
```
Aberto pela lista (célula travada)       Aberto por Relatórios (célula desmarcada)
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ ✕  Novo Relatório de Célula          │ │ ✕  Novo Relatório de Célula          │
│──────────────────────────────────────│ │──────────────────────────────────────│
│ ┌──────────────────────────────────┐ │ │ ┌──────────────────────────────────┐ │
│ │ ⚠ Esta célula está inativa e não │ │ │ │ ⚠ Esta célula está inativa e não │ │
│ │ recebe relatórios. Para enviar   │ │ │ │ recebe relatórios. Para enviar   │ │
│ │ um relatório, reative a célula.  │ │ │ │ um relatório, reative a célula.  │ │
│ │ [Fechar]                         │ │ │ └──────────────────────────────────┘ │
│ └──────────────────────────────────┘ │ │ Célula *                             │
│ Célula *                             │ │ [Buscar por líder, rua ou bairro… ▾] │
│ [Célula de André Souza, em R…     ▾] │ │ Tema da Palavra                      │
│ Tema da Palavra                      │ │ [Fé que move montanhas             ] │
│ [Fé que move montanhas             ] │ │ …                                    │
│ …                                    │ │──────────────────────────────────────│
│──────────────────────────────────────│ │ [Cancelar        ] [Salvar         ] │
│ [Cancelar        ] [Salvar         ] │ └──────────────────────────────────────┘
└──────────────────────────────────────┘
```
- **Onde:** no `Alert` do topo do formulário, com `role="alert"`, que recebe o foco (`tabIndex={-1}`), e a tela rola até ele. É o lugar da recusa da célula excluída (T8 do E2.01).
- **Texto:** o da RN-11 (c), sem mudança: "Esta célula está inativa e não recebe relatórios. Para enviar um relatório, reative a célula." (ver PO-UX-4).
- **Aberto pela lista de Células** (a célula fica travada no formulário): o `Alert` tem "Fechar", que fecha o formulário e recarrega a lista, onde a célula já aparece "Inativa" e sem "Novo relatório".
- **Aberto por Relatórios** (o seletor de célula está livre): a célula fica desmarcada, e o seletor recarrega sem as inativas. Depois de ler o `Alert`, o próximo Tab leva ao campo Célula.
- **Os dados ficam:** tema, data, horário, participantes, visitantes, oferta e observações continuam como estavam.
- **Sem toast e sem mensagem técnica.** Hoje a recusa vem num toast vermelho com o texto do banco.
- **O resto do formulário não muda:** o seletor de célula já oferece só as ativas. Os relatórios que a célula inativa já tem continuam editáveis, sem nenhum aviso novo (RN-11 d). O título e os rótulos são do E2.11.

#### T9. As perguntas Q-1 a Q-6 na tela
Nenhuma resposta muda a estrutura do formulário, a não ser a da Q-5. Com o padrão do Negócio (nenhuma regra nova), vale o que está nas T1 a T8. Se a resposta for sim:

- **Q-1. O mesmo líder com duas células ativas.**
  - *Avisar:* depois de escolher o líder, um aviso `(!)` embaixo do campo, que não impede salvar: "{Nome} já lidera outra célula ativa: {dia}, {HH:mm}." †. Na edição, a própria célula não conta. Quem vê o líder já vê as células dele (RN-03 do E2.02), então nada novo é revelado. Precisa do número e do dia e horário das células ativas de cada opção.
  - *Impedir:* no seletor de Líder, quem já lidera uma célula ativa aparece desabilitado, com "Já lidera uma célula ativa" † embaixo do nome (P5 de Escolas). A recusa do servidor vai para o campo (T5).
- **Q-2. O mesmo anfitrião no mesmo dia e horário.**
  - *Avisar:* quando Anfitrião, Dia e Horário estão preenchidos, um aviso `(!)` embaixo do Horário, ligado aos três campos: "{Nome} já recebe outra célula neste dia e horário." †. Não impede salvar, e o caso do casal (a célula dos homens e a das mulheres na mesma noite) é salvo normalmente.
  - *Impedir* não combina com o caso do casal e não foi desenhado.
- **Q-3. Timóteo do mesmo sexo do líder.**
  - Escolhido o líder, o seletor de Timóteo mostra as pessoas do outro sexo desabilitadas, com "Sexo diferente do líder" † (P5).
  - Se o líder mudar para alguém de outro sexo depois do timóteo escolhido, o erro aparece embaixo do Timóteo ao salvar, com o texto que o PO definir.
  - Precisa do sexo nas opções (já pedido na AQ-2).
- **Q-4. Repetir o líder no Timóteo.**
  - A dica do Timóteo ganha uma frase: "Se a célula ainda não tem timóteo, escolha o próprio líder." †.
  - Com o líder escolhido e o Timóteo vazio, aparece embaixo do Timóteo o botão "Usar o líder" (`outline`, `h-11` no celular), que copia o líder para o campo.
- **Q-5. Regras próprias da Macrocélula.**
  - *Sem anfitrião:* o Tipo passa a ser o primeiro campo do formulário, antes de "Pessoas da célula", porque decide se o Anfitrião é obrigatório. Com "Macrocélula", o "*" do Anfitrião sai, e a dica vira "Na macrocélula, o anfitrião é opcional." †. Trocar o tipo não apaga o anfitrião escolhido.
  - *Reunião num local da igreja:* o endereço daria lugar a um seletor de locais cadastrados. É uma tela nova (cadastro de locais), fora deste passo.
- **Q-6. Consolidado como anfitrião.**
  - Só o seletor de Anfitrião passa a oferecer consolidados, com a marca "(consolidado)" † depois do nome, como o P63. Líder e Timóteo continuam só com membros.
  - O endereço do consolidado segue a RN-10, com a mesma máscara.

### Padrões novos (valem para as próximas telas)
A numeração começa em P60 (ver a nota do início da seção). Este passo também aplica o P1 (diálogo responsivo), o P5 (opção desabilitada com o motivo, só nas respostas da T9), o P6 (badges de situação), o P11 (seletor limitado ao que se vê), o P21 e o P22 (mensagens e erros de campo), o P44 (gravação que muda outras telas) e o P45 (cartões até 1023 px).

- **P60. Mudança de situação avisada antes de salvar.** Vale para um interruptor de situação (ativo e inativo) num formulário de edição, quando a mudança tem efeito fora do formulário.
  - A dica embaixo do rótulo segue a situação gravada e diz quando mudar.
  - Quando o interruptor fica diferente do gravado, um aviso `(i)` diz o que acontece ao salvar, com `role="status"`. Voltar o interruptor tira o aviso.
  - Sem diálogo de confirmação, porque a mudança é reversível.
  - O toast do sucesso diz a mudança ("Célula inativada.", "Célula reativada."), e não só "atualizada".
  - O cabeçalho do formulário mostra a situação gravada com o badge do P6.
  - Vale para os próximos interruptores de situação.
- **P61. Preenchimento a partir de outro campo.** Vale quando escolher um valor preenche outros campos do formulário, como o anfitrião, que preenche o endereço.
  - O aviso fica embaixo do campo que causou o preenchimento, com o ícone `Info`, em `text-sm text-foreground` e `role="status"`, e entra no `aria-describedby` desse campo. Nunca num toast.
  - "Buscando…", o resultado e a falha (com "Tentar de novo") aparecem no mesmo lugar.
  - Quando falta completar algo, o aviso traz um atalho (`Button variant="link"`, 44 px no celular) que leva o foco ao primeiro campo a completar.
  - Só a resposta da última escolha é aplicada.
  - Quando a falta de dado pode ter duas causas e uma delas é sigilosa, o texto é um só (RN-10).
- **P62. Horário digitado.** Um `Input` de texto com máscara `HH:mm`, `inputMode="numeric"`, `placeholder="00:00"` e `maxLength={5}`, sempre em 24 h, e não o `type="time"`.
  - A máscara põe os dois-pontos depois do segundo dígito, e ":" depois de um dígito só põe o zero na frente.
  - Ao sair do campo: 1 ou 2 dígitos viram a hora cheia ("20" → "20:00"); 4 dígitos, hora e minutos; o resto fica como está, com o erro.
  - Vale para o horário do relatório (E2.11), que hoje usa `type="time"`, e para os próximos campos de horário.
- **P63. Marca de situação da pessoa no seletor.** "(inativo)" ou "(inativa)", conforme o sexo, depois do nome, na opção e no valor escolhido.
  - Mesma cor e mesmo peso do nome: a marca é texto e faz parte do nome acessível.
  - A opção continua escolhível, a menos que uma regra diga o contrário.
  - Pessoa fora do escopo de quem edita: só o nome (P11).
  - Vale para os próximos seletores de pessoa em que um inativo pode ser escolhido.
- **P64. Seletor obrigatório sem "limpar".** Um seletor de escolha única e obrigatório não tem o "✕": para trocar, a pessoa escolhe outro valor. O "✕" fica só nos seletores opcionais.
- **P65. Ações da linha no mesmo lugar.** Numa lista em que uma ação aparece só em algumas linhas, as ações ficam alinhadas pelo fim (`justify-end`), com a ação condicional à esquerda das outras. As ações de todas as linhas ficam na mesma posição horizontal, e quem clica por hábito não abre a ação errada.

Nenhum componente novo do shadcn é necessário: `dialog`, `alert`, `alert-dialog`, `select`, `switch`, `input`, `badge`, `button`, `card` e `table` já estão em `src/components/ui`. O ícone `PauseCircle` existe no `lucide-react` do projeto. O P1 continua pedindo `viewport-fit=cover` na meta viewport do `index.html`, que hoje não tem (tarefa do frontend, já prevista em Escolas, no E2.01, no E2.02 e no E2.04).

### Estados
| Estado | Formulário de célula | Lista de Células | Formulário de relatório |
|---|---|---|---|
| Carregando | Abre na hora, com os dados da lista. Nos seletores, os nomes aparecem como "Carregando…" (E1.08) até virem com a marca de inativo. A autoria segue o E2.05. "Buscando o endereço do anfitrião…" e "Buscando endereço…" ficam no campo que os causou (T4). | Como hoje (E1.08 e P45). Na troca de página, os dados anteriores ficam com `opacity-60`. | Sem mudança. |
| Vazio (cadastro novo) | Pessoas, Dia, Horário e Endereço vazios; Tipo com "Evangelística"; sem "Célula ativa". A busca sem resultado nos seletores segue o P11. | Sem mudança. | O seletor de célula não oferece as inativas, como hoje. |
| Erro de preenchimento | T5: todos de uma vez, cada um no seu campo, com o foco no primeiro e o resumo no rodapé. | — | — |
| Recusa do servidor | T5: no campo ou no `Alert` do topo. | — | T8: `Alert` do topo, com "Fechar" ou com a célula desmarcada. |
| Sem permissão | Sem "Criar Célula", "Nova célula" não aparece; sem "Editar Célula", "Editar" não aparece (E2.02). A recusa 42501 vai para o `Alert` do topo. | Como no E2.02. | Como no E2.02. |
| Registro mudou no meio tempo | Célula excluída: `Alert` do topo, com "Fechar" (E2.01). Pessoa excluída: no campo (T5). | A lista recarrega (P44). | Célula inativada: T8. Célula excluída: T8 do E2.01. |
| Sucesso | O formulário fecha, a lista recarrega, e aparece o toast da T6. | Cartão e linha com a situação nova, sem "Novo relatório" na inativa. | Como hoje. |
| Lista grande | Seletores com 20 por página (E1.08). | Paginação do E1.08. | Seletor de célula com 20 por página. |
| Queda de conexão no envio | Mensagem no rodapé, dados mantidos, foco na ação primária (T6). Sem a AQ-3, com a frase de conferir a lista. | — | Como no E2.05, até o E2.11. |
| Endereço do anfitrião ou CEP indisponível | Aviso no campo, sem bloquear (T4). | — | — |

### Textos
Complementam os "Textos de tela" do Negócio, sem mudar os termos. As mensagens de regra são as do Negócio, mostradas como estão lá. Os textos marcados com † foram definidos pela UX e estão nas pendências (PO-UX-10).

| Onde | Texto |
|---|---|
| Títulos | Nova célula · Editar célula |
| Badge do título (edição) | Inativa |
| Topo do formulário | Campos com * são obrigatórios. |
| Grupos † | Pessoas da célula · Reunião · Endereço da célula |
| Rótulos | Líder * · Timóteo * · Anfitrião * · Tipo * · Dia da semana * · Horário * · Célula ativa · CEP · Rua · Número · Complemento · Bairro · Cidade · Estado |
| Placeholders | Buscar líder… · Buscar timóteo… · Buscar anfitrião… · Escolha o dia † · 00:00 · 00000-000 · UF |
| Opções do Tipo | Evangelística · Discipulado · Macrocélula |
| Opções do Dia † | Segunda-feira · Terça-feira · Quarta-feira · Quinta-feira · Sexta-feira · Sábado · Domingo |
| Dicas | Timóteo: Auxilia o líder e está em formação para liderar. · Anfitrião: Quem recebe a célula em casa. · "Célula ativa", na célula ativa: Desligue quando a célula parar de se reunir. A célula inativa sai dos totais e não recebe relatórios. · "Célula ativa", na célula inativa †: Ligue quando a célula voltar a se reunir. A célula inativa não conta nos totais e não recebe relatórios. · alcance: a do E2.02 |
| Aviso da situação † (P60) | Ao salvar, a célula fica inativa. Os relatórios que ela já tem continuam. · Ao salvar, a célula volta aos totais e a receber relatórios a partir desta semana. |
| Pessoa inativa | {Nome} (inativo) · {Nome} (inativa) |
| Endereço do anfitrião | os quatro do Negócio · Buscando o endereço do anfitrião… † · Ir para o endereço † · Tentar de novo |
| CEP † | Buscando endereço… · Rua, bairro, cidade e estado preenchidos pelo CEP. (só para o leitor de tela) · CEP não encontrado. Confira o número ou preencha o endereço. · Não foi possível buscar o endereço pelo CEP. Preencha o endereço. |
| Erros e recusas | os do Negócio, do E2.01 e do E2.02, sem mudança (tabela da T5) |
| Resumo | Confira os campos destacados ({N}). |
| Botões | Cancelar · Criar célula · Salvar alterações · Criando… · Salvando… |
| Gravação demorada (E2.06) | Ainda salvando. Isso pode levar alguns segundos. |
| Conexão | Não foi possível salvar a célula. Verifique a conexão e tente de novo. · sem a AQ-3, no cadastro novo, mais †: Antes de tentar de novo, confira na lista de Células se a célula já foi criada. |
| Toasts | Célula criada. · Célula atualizada. · Célula inativada. † · Célula reativada. † · Nenhuma alteração para salvar. (E2.05) |
| Descartar | Descartar as alterações? · O que você digitou não será salvo. · Descartar · Continuar editando |
| Lista | Nova célula · Situação · Ativa · Inativa · Novo relatório da célula de {Líder} † (nome para o leitor de tela) |
| Relatório | Esta célula está inativa e não recebe relatórios. Para enviar um relatório, reative a célula. · Fechar |

### Acessibilidade
- **Formulário:**
  - `noValidate`. Os obrigatórios mantêm `required` nos `Input` e `aria-required="true"` nos seletores e nos `Select`, e o "*" é explicado no topo;
  - os três grupos são `fieldset` com `legend`.
- **Mensagens (P21):**
  - erro, aviso e dica ficam no `aria-describedby` do campo, nessa ordem, e o erro também marca `aria-invalid`;
  - no Timóteo e no Anfitrião, a dica do campo vem antes da dica de alcance do E2.02;
  - o aviso do anfitrião (P61) entra no `aria-describedby` do Anfitrião;
  - o `PaginatedSelect` precisa aceitar `aria-required` e `aria-describedby` (dica e aviso), além do `aria-errormessage` que já aceita. O E2.02 e o E2.04 já pediram o `aria-describedby`.
- **Foco:**
  - vai para o primeiro campo com erro, inteiro à vista (WCAG 2.4.11);
  - o `Alert` do topo, no formulário de célula e no de relatório, recebe o foco;
  - "Ir para o endereço" leva o foco ao CEP;
  - depois de uma falha de conexão, o foco volta à ação primária;
  - na confirmação de descartar, o foco inicial fica em "Continuar editando".
- **Anúncios:**
  - `role="status"`: o aviso e o "Buscando…" do anfitrião, o "Buscando endereço…" do CEP e o preenchimento pelo CEP, o aviso do P60, o resumo e "Ainda salvando…";
  - `role="alert"`: a falha de conexão e o `Alert` do topo;
  - "Criando…" e "Salvando…" ficam no próprio botão, sem região extra.
- **Nomes:** a marca "(inativo)" faz parte do nome da opção e do valor. O botão "Novo relatório" de cada linha tem o nome com o líder. O badge "Inativa" é texto, e o ícone é `aria-hidden`.
- **Contraste:** as mensagens seguem o P21 (`text-foreground`, nunca `text-destructive`), e os badges seguem o P6, nos temas claro e escuro.
- **Sem depender de cor:** erro, aviso e informação têm ícones diferentes e texto. "Inativa" tem texto e ícone.
- **Toque:** os botões do rodapé têm `h-11`; a linha de "Célula ativa", "Ir para o endereço" e "Tentar de novo" têm pelo menos 44 px de altura no celular; os botões de ícone da lista têm 44×44 px, com 8 px entre si (T1 do E2.01).
- **Zoom e fonte grande:** com 200% e em 320 px, rótulos, dicas, avisos, erros e nomes com "(inativo)" quebram linha. Nada tem altura fixa, e o corpo do diálogo rola (P1).
- **Movimento:** o `Loader2` e as animações do `Dialog` e do `AlertDialog` respeitam `motion-reduce:`. A rolagem de "Ir para o endereço" é instantânea com `prefers-reduced-motion`.

### Critérios de UX
| ID | Critério | Como verificar |
|---|---|---|
| UX-01 | Em 360×800, o formulário de célula (novo e edição) ocupa a tela, com cabeçalho e rodapé fixos, e a ação primária ("Criar célula" ou "Salvar alterações") fica à vista sem rolar, com o teclado fechado, em qualquer ponto da rolagem. A partir de 768 px, é um `Dialog` centralizado, com `max-h-[90dvh]` e o rodapé fixo. | teste E2E (viewport) |
| UX-02 | Os campos seguem a ordem e os grupos da T1: `fieldset` com as legendas "Pessoas da célula", "Reunião" e "Endereço da célula"; uma coluna abaixo de 768 px; a partir de 768 px, Líder, Timóteo e Anfitrião em linha inteira e os pares Dia da semana e Horário, Número e Complemento, Bairro e Cidade. | teste de componente + teste E2E (viewport) |
| UX-03 | Os títulos são "Nova célula" e "Editar célula"; os rótulos são os da tabela de Textos; a ação primária é "Criar célula" ou "Salvar alterações"; o topo diz "Campos com * são obrigatórios.". O DOM do formulário e da lista não tem "Auxiliar", "Modalidade", "Nova Célula", "Editar Célula", "Criar Célula", "Célula Ativa", "Dia da Semana" nem "Endereço da Célula". | teste de componente |
| UX-04 | Na célula nova, o Dia da semana vem sem valor, o Horário vazio, o Tipo com "Evangelística", e "Célula ativa" não existe no DOM. Salvar sem preencher nada mostra os 5 erros (líder, timóteo, anfitrião, dia e horário), cada um embaixo do seu campo, e "Confira os campos destacados (5).", sem nenhuma requisição (critério da RN-14). | teste de componente (requisições) |
| UX-05 | As dicas "Auxilia o líder e está em formação para liderar." e "Quem recebe a célula em casa." ficam entre o rótulo e o campo do Timóteo e do Anfitrião e entram no `aria-describedby` de cada um. Para Pedro, a dica de alcance do E2.02 fica acima do Líder e entra no `aria-describedby` dos três seletores. | teste de componente |
| UX-06 | Os três seletores de pessoa não têm botão de limpar e têm `aria-required="true"`. Rita escolhe André como líder, timóteo e anfitrião da mesma célula: nenhum seletor o esconde, nenhum aviso aparece, e a gravação é aceita. | teste de componente + teste E2E |
| UX-07 | Pessoa inativa (P63): no seletor, Fábio aparece como "Fábio Lima (inativo)" e pode ser escolhido; uma mulher inativa aparece com "(inativa)"; o valor escolhido mantém a marca, também ao abrir a edição de uma célula gravada com Fábio; a marca faz parte do nome acessível. Para Pedro, Beatriz aparece só pelo nome. | teste de componente + teste E2E (massa) |
| UX-08 | Horário (P62): o campo tem `type="text"`, `inputMode="numeric"`, `autoComplete="off"`, `placeholder="00:00"` e `maxLength` 5. Cada linha da tabela da T3, digitada ou colada, mostra o valor da coluna "Ao sair do campo". O erro de formato só aparece ao sair do campo alterado e preenchido, ou ao salvar, sem nenhuma requisição. Na edição, o valor gravado "20:00:00" aparece como "20:00" e não conta como alteração. | teste de componente |
| UX-09 | Dia da semana: as opções aparecem como "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado" e "Domingo", nessa ordem, e o valor enviado é o da RN-05 (escolher "Quarta-feira" envia "Quarta"). | teste de componente (payload) |
| UX-10 | Erros ao salvar (P22): o foco vai para o primeiro campo com erro, que fica inteiro à vista, sem ficar atrás do cabeçalho ou do rodapé; o resumo tem `role="status"` e diminui a cada correção; tocar de novo na ação primária leva ao próximo erro; um erro some assim que o valor fica certo. | teste de componente + teste E2E (360×800) |
| UX-11 | Recusas do servidor: cada caso da tabela da T5 aparece no lugar indicado. As que têm campo entram no resumo, e a primeira recebe o foco; as outras vão para o `Alert` do topo, que recebe o foco. O formulário fica aberto, com os dados, e nenhum toast de erro aparece. No critério da RN-14 com Ester excluída, a mensagem aparece embaixo do Timóteo. | teste de componente (um mock por caso) |
| UX-12 | Nenhuma mensagem técnica aparece nos formulários de célula e de relatório: códigos (22023, 23502, 23514, P0001), nomes de coluna, de constraint, de trigger ou de função, ou texto em inglês. A recusa 42501 vira "Você não tem permissão para esta ação.". | teste de componente |
| UX-13 | Endereço do anfitrião, com os dados sensíveis (Rita): numa célula nova com "Rua A" digitada, escolher Carla deixa os sete campos com o endereço dela e mostra "Endereço preenchido com o do anfitrião." embaixo do Anfitrião, com `role="status"`. Nenhum toast aparece. | teste E2E (massa) |
| UX-14 | Sem os dados sensíveis (Pedro): escolher Carla preenche só Centro, Porto Alegre e RS, deixa CEP, rua, número e complemento vazios e mostra o aviso parcial com "Ir para o endereço", que leva o foco ao CEP. Trocar a anfitriã de C1 por Fábio nunca deixa "Rua das Flores" ou "100" no formulário. | teste E2E (massa) |
| UX-15 | Nada disponível: escolher Gabriel não muda o endereço e mostra "O endereço do anfitrião não está disponível. Preencha o endereço da célula.". Para Pedro, o anfitrião sem endereço e o anfitrião com só a rua e o CEP geram o mesmo texto e o mesmo DOM. | teste de componente + teste E2E (massa) |
| UX-16 | Na edição: mudar só o horário de C1 não consulta o endereço de ninguém e não muda o endereço; trocar Carla por Fábio e voltar para Carla deixa o endereço de Carla; escolher Fábio e logo depois Carla deixa o endereço de Carla, mesmo com a resposta de Fábio chegando depois; fechar sem salvar mantém o endereço gravado. | teste de componente (respostas fora de ordem) |
| UX-17 | Enquanto o endereço do anfitrião carrega, "Buscando o endereço do anfitrião…" aparece embaixo do Anfitrião. Na falha, aparece "Não foi possível carregar o endereço do anfitrião." com "Tentar de novo", e o endereço não muda. | teste de componente |
| UX-18 | CEP: `inputMode="numeric"` e máscara de 8 dígitos. Com 8 dígitos digitados ou colados, a busca preenche rua, bairro, cidade e estado e não mexe em número e complemento. "Buscando endereço…" aparece durante a busca. CEP não encontrado e falha mostram os avisos da T4, sem entrar no resumo e sem impedir salvar. O CEP preenchido pelo anfitrião não dispara a busca. | teste de componente (serviço de CEP simulado) |
| UX-19 | "Célula ativa": não existe no cadastro novo. Na edição, a linha inteira tem pelo menos 44 px e muda o interruptor em qualquer ponto; a dica segue a situação gravada; mudar o interruptor mostra o aviso do P60 com `role="status"`, e voltar o tira. O cabeçalho mostra o badge "Inativa" só quando a situação gravada é inativa. | teste de componente + teste E2E (medida) |
| UX-20 | Toasts: "Célula criada.", "Célula atualizada.", "Célula inativada." (Pedro inativa C1, mesmo mudando também o horário) e "Célula reativada.". Sem nenhuma mudança, "Nenhuma alteração para salvar.", sem requisição. | teste de componente |
| UX-21 | Lista: depois de Pedro inativar C1, o cartão e a linha da tabela de C1 mostram o badge "Inativa", com o ícone, e não têm "Novo relatório", para Pedro, Caio e Carla. "Editar" e "Excluir" (ou "⋯") ficam na mesma posição horizontal em todas as linhas. Reativada, C1 volta a ter "Novo relatório". Tudo sem recarregar a página. | teste E2E (massa, 360×800 e 1280×800) |
| UX-22 | Depois de inativar C1, o seletor de célula do relatório não a oferece na próxima abertura, sem recarregar a página. | teste E2E |
| UX-23 | Relatório com a célula inativada no meio tempo (critério da RN-11): o `Alert` do topo mostra o texto da RN-11 (c), com `role="alert"` e o foco, e os dados digitados ficam. Aberto pela lista, o `Alert` tem "Fechar", que fecha o formulário e atualiza a lista. Aberto por Relatórios, a célula fica desmarcada. Nenhum toast de erro aparece. | teste E2E |
| UX-24 | Envio: "Criando…" ou "Salvando…" com o indicador, os dois botões desabilitados, e um duplo toque gera uma chamada só. "✕", `Esc` e o toque fora não fecham durante o envio. Aos 3 s aparece "Ainda salvando. Isso pode levar alguns segundos.". Sem conexão, a mensagem fica no rodapé, com `role="alert"`, os dados ficam, e o foco volta à ação primária. | teste de componente (mock) + teste E2E (offline) |
| UX-25 | Com algum campo alterado, inclusive só o anfitrião, "Cancelar", "✕", `Esc` e o toque fora pedem "Descartar as alterações?", com o foco em "Continuar editando". Sem alteração, fecham direto. | teste de componente |
| UX-26 | Dicas, erros e avisos seguem o P21 (texto em `text-foreground` ou `text-muted-foreground`, nunca `text-destructive`, com ícone), e os badges "Ativa" e "Inativa" seguem o P6. Nenhum estado depende só de cor, nos temas claro e escuro. | inspeção (axe, temas claro e escuro) |
| UX-27 | Em 320 px e com zoom de 200%, rótulos, dicas, avisos, erros e nomes com "(inativo)" quebram linha sem corte, os botões do rodapé continuam alcançáveis, e os cartões da lista não rolam na horizontal. | inspeção + teste E2E (viewport) |
| UX-28 | Toque, em 360×800: os botões de ícone dos cartões têm 44×44 px, com 8 px entre si; os botões do rodapé têm `h-11`; "Ir para o endereço", "Tentar de novo" e a linha de "Célula ativa" têm pelo menos 44 px de altura. | teste E2E (medida) |
| UX-29 | O leitor de tela lê as legendas dos grupos; lê com cada campo o erro, o aviso e a dica, nessa ordem; anuncia como status os avisos do anfitrião, do CEP e do P60 e o resumo; anuncia como alerta a falha de conexão e o `Alert` do topo. O botão "Novo relatório" de cada linha se chama "Novo relatório da célula de {Líder}". | inspeção (leitor de tela) + teste de componente (nomes acessíveis) |
| UX-30 | Os campos CEP, Rua, Número, Complemento, Bairro e Cidade têm `autoComplete="off"`, e o formulário tem `noValidate`. | teste de componente |

### Perguntas para o `architect` (dados e contrato)
Em cada uma, a tela tem um comportamento padrão, o mais conservador, se a resposta for "não".

- **AQ-1. Recusas com código e campo** (RN-14, T5). O formato do E2.01 (22023, `HINT = 'app_error'` e `DETAIL` em JSON), como na AQ-5 do E2.02 e na AQ-1 do E2.04. Códigos que a tela precisa distinguir, cada um com o `field`:
  - `leader_required`, `timothy_required` e `host_required` (`leader_id`, `timothy_id`, `host_id`);
  - `meeting_day_required` e `meeting_day_invalid` (`meeting_day`); `meeting_time_required` e `meeting_time_invalid` (`meeting_time`); `cell_type_invalid` (`type`);
  - `cell_new_inactive` (`is_active`);
  - a pessoa excluída (`member_deleted`, do E2.01) e a que não se vê (do E2.02), com o campo do papel;
  - sem campo: a célula que deixaria de ser vista (E2.02), a célula excluída (E2.01) e, no relatório, a célula inativa (por exemplo, `cell_inactive`).
  - *Padrão sem isso:* o texto do servidor vai para o `Alert` do topo, sem marcar o campo, e a UX-11 fica parcial.
- **AQ-2. Situação e sexo das pessoas nos seletores** (P63, UX-07).
  - Nas opções, a `members_view` precisa devolver `is_active` e `gender` junto com `id` e `name` (hoje o `useMemberOptions` lê só `id` e `name`).
  - Para o valor gravado, a edição precisa da situação e do sexo do líder, do timóteo e do anfitrião: por exemplo, colunas na `cells_view` ou na resposta da `member_names`. Para quem está fora do escopo de quem edita, só o nome (PO-UX-5).
  - *Padrão sem isso:* a marca aparece só na opção e no valor escolhido agora, e não nas pessoas gravadas ao abrir a edição.
- **AQ-3. Cadastro de célula idempotente** (T6).
  - Como não há unicidade (RN-03), repetir o envio depois de uma queda que aconteceu depois da gravação cria uma segunda célula igual.
  - Sugestão: o formulário gera o `id` da célula ao abrir e o envia no insert. A repetição recebe o conflito da chave, que a tela trata como sucesso, sem criar outra.
  - *Padrão sem isso:* a frase "Antes de tentar de novo, confira na lista de Células se a célula já foi criada." na mensagem de conexão do cadastro novo.
- **AQ-4. Horário: a mesma leitura na tela e no banco** (RN-06, P62). Uma tabela de casos única, lida pelos testes do Vitest e do pgTAP: "00:00" e "23:59" aceitos; "24:00", "25:00" e "19:60" recusados; "19:30:45" gravado como 19:30; e a comparação do E2.05 com o valor já sem os segundos.
- **AQ-5. Endereço do anfitrião** (RN-10, P61, UXD-8).
  - A consulta é disparada pela escolha no seletor, e não pela comparação com o anfitrião gravado (hoje, `form.host_id !== cell?.host_id`), para que a volta ao anfitrião gravado também aplique o endereço dele.
  - Só a resposta da última escolha é aplicada, e a leitura é nova a cada escolha, sem o cache de uma escolha anterior.
  - "Nada disponível" quer dizer que os sete campos vêm vazios depois da máscara. A tela não deve precisar saber se o anfitrião tem endereço.
  - O `applyHostAddress` passa de "completar" para "substituir" (ponto 8 do Negócio).
- **AQ-6. CEP** (RN-09, UXD-9).
  - Um helper comum ao formulário de célula e ao de membro. Hoje o do membro preenche também o complemento com o do serviço de CEP; a RN-09 cita só rua, bairro, cidade e estado (PO-UX-7).
  - A busca só na digitação ou na colagem, nunca no preenchimento pelo anfitrião.
  - Um tempo-limite (por exemplo, 8 s), para a falha aparecer numa conexão ruim em vez de o "Buscando…" ficar para sempre.
- **AQ-7. "Pode enviar relatório" considera a situação** (RN-11 c, T7). A coluna `can_submit_report` (AQ-4 do E2.02) é falsa para a célula inativa, pela mesma função que recusa o lançamento. Ela decide o botão da lista, o seletor de célula do relatório e o atalho do Dashboard (UXD-10 do E2.02). Assim, quem só tem células inativas não vê o atalho.
- **AQ-8. O que salvar desatualiza** (P44). Além do que a AQ-6 do E2.06 já lista, inativar e reativar mudam a lista de Células, as opções do seletor de célula do relatório, o Dashboard (totais, ranking e pendentes) e os totais em Membros e Ministérios. A recusa da célula inativa no relatório também atualiza a lista de Células.
- **AQ-9. Edição com pessoas que não mudaram** (RN-04 b). A tela envia os três papéis em toda edição. Confirmar que o servidor só confere a visibilidade de quem entra num papel, comparando com o valor gravado (Beatriz, que Pedro não vê, continua anfitriã quando ele muda só o horário). Ou a edição passa a enviar só o que mudou, como a AQ-3 do E2.04 sugere.

### Pendências para o PO (resolvidas em 2026-11-24)
Nenhuma bloqueia o desenho. Em todas, a UX adotou a opção marcada como "*Adotado*". O PO resolveu as dez em 2026-11-24, sem perguntas ao usuário: nove com o padrão da UX e a PO-UX-4 com a sugestão da UX. Elas viraram os padrões P-CEL-14 a P-CEL-23 do Negócio, que ajustou as RN-04, RN-05, RN-06, RN-09, RN-10 e RN-11, os critérios e os Textos de tela. Onde a resolução muda o que está escrito acima nesta seção (só a PO-UX-4, na T8, na UX-23 e na tabela de Textos), vale a resolução, e a UX ajusta o texto na próxima revisão. **Revisar no PR.**

- **PO-UX-1. Dias com os rótulos e a ordem do legado** (UXD-4). "Segunda-feira" a "Sexta-feira", "Sábado" e "Domingo", nessa ordem, no seletor. O valor gravado continua o da RN-05.
  - *Adotado.*
  - *Alternativa:* a lista de hoje, de domingo a sábado, com os nomes curtos.
  - **Resolvida: aceito o padrão da UX (P-CEL-14, RN-05).** É a lista que os usuários do legado conhecem. A ordem da lista não muda a semana do sistema, que continua de domingo a sábado.
- **PO-UX-2. Horário digitado, com a leitura ao sair do campo** (UXD-5, P62). Como no legado, com dois atalhos: "20" vira "20:00", e "7:30" vira "07:30".
  - *Adotado.*
  - *Alternativa:* o seletor nativo (`type="time"`), que hoje está no formulário. Com ele, o critério da RN-06 ("digita 25:00 e sai do campo") deixa de ser possível, porque o campo não aceita o valor.
  - **Resolvida: aceito o padrão da UX (P-CEL-15, RN-06).** Como no legado. A leitura abreviada ("20" → 20:00, "7:30" → 07:30) é só da tela; a RN-06 ganhou os critérios dela.
- **PO-UX-3. O que a tela diz sobre a situação** (UXD-10, P60):
  - a dica da célula inativa ("Ligue quando a célula voltar a se reunir…"), porque a do Negócio ("Desligue quando…") só serve para a célula ativa;
  - os avisos ao mudar o interruptor;
  - o badge "Inativa" no título do formulário;
  - os toasts "Célula inativada." e "Célula reativada.".
  - *Adotado.*
  - **Resolvida: aceito o padrão da UX (P-CEL-16, RN-11).** Os textos conferem com a RN-11: os relatórios que a célula já tem continuam, e a volta aos totais e ao lançamento vale a partir da semana da reativação. Sem diálogo de confirmação, porque inativar se desfaz reativando.
- **PO-UX-4. A recusa da célula inativa para quem não pode reativá-la** (T8). Carla (anfitriã, função Membro) lê "Para enviar um relatório, reative a célula.", mas não tem como reativar.
  - *Adotado:* o texto do Negócio, sem mudança, para todos, porque mudar a orientação muda o sentido.
  - *Sugestão:* para quem não tem "Editar Célula", "Esta célula está inativa e não recebe relatórios. Se ela voltou a se reunir, peça à sua liderança para reativá-la." †
  - **Resolvida: aceita a sugestão, no lugar do padrão (P-CEL-17, RN-11 c).** A primeira frase é a mesma para todos e é o que a API devolve. A orientação na tela depende de quem lê: com "Editar Célula", "Para enviar um relatório, reative a célula."; sem ela, "Se ela voltou a se reunir, peça à sua liderança para reativá-la.". Mandar reativar quem não pode reativar não orienta ninguém. A T8, a UX-23 e a tabela de Textos desta seção passam a usar as duas orientações.
- **PO-UX-5. "(inativo)" de quem está fora do escopo de quem edita** (P63). Pedro vê Beatriz, de outro ministério, como anfitriã de C1.
  - *Adotado:* só o nome, como no P11, sem a marca. Dizer se ela está inativa revelaria um dado de quem Pedro não vê.
  - *Alternativa:* a marca também para ela.
  - **Resolvida: aceito o padrão da UX (P-CEL-18, RN-04).** Fora do escopo, a pessoa é só um nome de referência (RN-06 do E1.08), e a situação dela é um dado que quem edita não vê.
- **PO-UX-6. Voltar ao anfitrião gravado aplica o endereço dele** (UXD-8). Na edição, trocar Carla por Fábio e voltar para Carla deixa o endereço de Carla. A RN-10 fala da escolha "ao trocá-lo numa edição", e voltar ao gravado também é uma escolha.
  - *Adotado.* É o que evita a mistura que a P-CEL-07 quer impedir.
  - *Alternativa:* voltar ao gravado não muda nada, e a célula fica com o endereço de Fábio.
  - **Resolvida: aceito o padrão da UX (P-CEL-19, RN-10).** A RN-10 passou a dizer "a cada escolha no seletor de Anfitrião, inclusive a volta ao anfitrião gravado", com a regra da última escolha, e ganhou os dois critérios.
- **PO-UX-7. O que o CEP preenche e os avisos dele** (UXD-9, T4).
  - O CEP preenche rua, bairro, cidade e estado, como diz a RN-09. O cadastro de membro preenche também o complemento, com o texto do serviço de CEP (por exemplo, "lado ímpar"). A AQ-6 propõe um comportamento só para os dois formulários.
  - Os avisos de CEP não encontrado e de falha do serviço são novos; hoje a falha é silenciosa nos dois formulários.
  - *Adotado:* os quatro campos e os dois avisos.
  - **Resolvida: aceito o padrão da UX e estendido ao cadastro de membro (P-CEL-20, RN-09).** O CEP preenche rua, bairro, cidade e estado e nunca o número nem o complemento, porque o "complemento" do serviço descreve um trecho da rua ("lado ímpar"), e não a casa. Os dois avisos não impedem salvar. A mesma regra vale no `MemberForm`, para o CEP funcionar igual nos dois formulários; o `architect` decide se isso entra neste passo (AQ-6) ou no próximo que mexer no cadastro de membro (Impactos, E2.04).
- **PO-UX-8. O atalho "Cadastrar mais células" não volta** (UXD-12). O Negócio deixou a avaliação com a UX.
  - *Adotado.*
  - **Resolvida: aceito o padrão da UX (P-CEL-21).** O Fora de escopo do Negócio passou a dizer que o atalho não volta.
- **PO-UX-9. Badges da situação na lista** (UXD-11, T7). O Negócio diz que o resto da lista não muda. A UX troca as variantes de hoje pelo badge do P6, com o ícone `PauseCircle` na "Inativa", para que a célula sem "Novo relatório" se destaque numa lista longa sem depender de cor.
  - *Adotado.*
  - *Alternativa:* os badges de hoje.
  - **Resolvida: aceito o padrão da UX (P-CEL-22, RN-11).** "Telas afetadas" do Negócio passou a incluir o ícone na situação "Inativa" e as ações no mesmo lugar.
- **PO-UX-10. Textos definidos pela UX** (marcados com † em Textos):
  - os nomes dos grupos ("Pessoas da célula" e "Reunião") e o placeholder "Escolha o dia";
  - os rótulos dos dias;
  - a dica da célula inativa, os avisos do P60 e os toasts "Célula inativada." e "Célula reativada.";
  - "Buscando o endereço do anfitrião…" e "Ir para o endereço";
  - os textos do CEP;
  - a frase de conferir a lista, se a AQ-3 não for feita;
  - "Novo relatório da célula de {Líder}";
  - os textos das respostas possíveis da T9 (Q-1 a Q-6), que só valem se a pergunta virar regra.
  - *Adotados.*
  - **Resolvida: textos aceitos, com a troca da PO-UX-4 (P-CEL-23).** Conferidos com o vocabulário do domínio: "Timóteo", "Anfitrião", "liderança" e "Célula inativada" estão certos, sem anglicismo. Os ligados a uma regra foram copiados para os "Textos de tela" do Negócio. A frase de conferir a lista só vale enquanto a repetição puder criar outra célula: o PO prefere a AQ-3 (ponto 11 do Negócio para o `architect`). Os textos da T9 só valem se a pergunta correspondente virar regra.

## Solução técnica
_Seção do `architect`. Escrita em 2026-11-24, só como desenho: nada foi implementado. **Os PRs de banco começam depois do E2.01 inteiro (com as migrations 5 e 6 do PR 2) e do PR 1 do E2.02 em produção.** Os PRs de front esperam também o front do E2.02, do E2.04, do E2.05 e do E2.06 que mexe nas mesmas telas ([Implantação](#implantação)). O desenho parte do estado final desses passos, com os nomes que eles definem. Se um nome ou uma assinatura mudar lá, as tarefas 2 e 5 voltam ao `architect`._

_Conferido em 2026-11-24:_
- _na stack local `supabase_db_mci-e108-pr2`, só com leitura (E1.08 completo, PR 1 do E2.01 e as migrations 5 e 6 do PR 2 do E2.01, ainda em implementação):_
  - _colunas, padrões, `CHECK`s, índices, FKs, políticas, triggers e privilégios de `cells` e `cell_reports`;_
  - _os corpos de `enforce_cell_links`, `enforce_insert_permission`, `viewer_can_insert_cell`, `viewer_can_insert_cell_report`, `enforce_cell_report_rules`, `enforce_unique_weekly_cell_report`, `_del_lock_cell_week`, `enforce_participant_rules`, `_del_member_blockers`, `weekday_index`, `sp_today`, `week_start` e `dashboard_summary` (o card de pendentes já filtra `is_active`);_
  - _os privilégios: `_del_raise` só tem EXECUTE para `postgres` e `service_role`; as funções de trigger, também, e disparam para `authenticated` mesmo assim;_
  - _a `cells_view`;_
  - _o tipo `time`: aceita "24:00"; recusa "25:00" e "19:60" (22008) e "730", "20" e "" (22007) antes de qualquer trigger; `make_time(24, 0, 0)` dá 24:00, e `date_trunc` sobre `interval` transforma 24:00 em 00:00;_
  - _a [conferência](#conferência-em-produção-tarefa-1), que rodou sem erro;_
- _no `mci-connect` (`origin/main`, `fdcbe50`): `CellForm.tsx`, `Cells.tsx`, `MemberForm.tsx` (CEP), `src/lib/cells/*`, `src/lib/errors.ts`, `use-member-address.ts`, `use-cell-options.ts`, `use-member-options.ts` e as massas dos pgTAP e do script de concorrência que inserem células;_
- _no legado: `Cell.cs` (`LeadId`, `HostId` e `TimothyId` são `int`, nunca nulos), `CellDtoValidator.cs` e `CellDTO.cs` (o horário entra como `TimeOnly`, então a API do legado só gravava horários legíveis);_
- _nos specs: E2.01 (DT-08, RN-06, RN-07, RN-17, formato `app_error`), E2.02 (funções de linha, `can_submit_report`, `ab_enforce_cell_scope`, `ab_enforce_cell_report_scope`, `my_access`, DA-5, DT-19), E2.04 (molde das regras), E2.05 (`zz_stamp_authorship`, `private.audit_fields`) e E2.06 (`trg_cell_hierarchy`, `refreshAfterCellWrite`)._

### Revisão das regras
Nenhuma RN voltou ao PO. As lacunas técnicas foram resolvidas pela leitura mais conservadora e estão em [Definidas pelo architect](#definidas-pelo-architect-revisar-no-pr).

Casos de borda conferidos:
- **Fuso:** o horário da célula é hora local, sem fuso (`time without time zone`), e nenhuma regra deste passo depende de "agora". As regras que dependem da semana (pendentes, lançamento) leem o dia e o horário atuais na consulta (RN-08) e são do E2.09 e do E2.11.
- **Virada de semana:** só aparece na reativação ("a partir desta semana", RN-11). O card de pendentes já usa a situação atual. O caso da célula reativada depois da reunião da semana é do E2.09 (Impactos do Negócio).
- **Casal:** nenhuma regra de unicidade ou de conflito (RN-03). Marido e esposa em papéis da mesma célula não mudam nada no banco.
- **Inativo:** a pessoa inativa é aceita em qualquer papel (RN-04). A célula inativa é o assunto da RN-11.
- **Sem líder e pastor:** qualquer membro não excluído pode ser líder. O G12 e o rótulo "Pastores" são do E2.06.
- **Excluído:** a pessoa excluída é recusada pelo trigger do E2.01, que fica desligado na carga; a reconciliação confere (`private.cell_rule_violations()`). A célula excluída também fica dentro dos `NOT NULL` e dos `CHECK`s (DA-3).
- **Consolidado (futuro):** ver a Q-6.
- **Concorrência:** inativar e lançar ao mesmo tempo, e repetir o cadastro depois de uma queda. Ver [Bloqueios e concorrência](#bloqueios-e-concorrência).
- **Volume:** as regras novas leem só a própria linha, mais uma leitura por chave na célula do relatório. Ver o risco 11.

Leituras técnicas. Nenhuma muda regra, mas o PO e o QA precisam saber delas:
1. **No INSERT, a permissão já vem antes das regras.** O RLS de INSERT só é avaliado depois dos triggers `BEFORE`. O E2.01 (PR 2, migration 6) resolveu isso com o `a0_check_insert_permission` em `cells` e em `cell_reports`, que recusa com 42501 antes de tudo. No UPDATE, a política filtra a linha antes dos triggers: Caio, sem "Editar Célula", recebe "nada muda" (0 linhas) e nunca uma recusa deste spec (critério da RN-01).
2. **Horário que o tipo `time` não lê.** "25:00", "19:60", "abc" e o texto vazio são recusados pelo próprio tipo (22008 ou 22007), antes de qualquer trigger. Pela API, a resposta traz a mensagem do Postgres, sem o campo. Só "24:00" e os segundos chegam à regra (DA-8). A tela nunca envia esses valores.
3. **Quem vê só o ministério e manda uma célula sem nenhuma pessoa do ministério** recebe a recusa de escopo do E2.02 (`would_leave_scope`) antes de `leader_required`. É a ordem da RN-14. A tela não envia sem as três pessoas.
4. **Os segundos não contam como alteração.** O `a0_normalize_cell` tira os segundos antes do carimbo do E2.05 (`zz_stamp_authorship`). Reenviar "19:30:45" numa célula gravada com 19:30 não gera evento nem muda "Alterado por".
5. **As massas de teste também seguem as regras.** A RN-01 vale para `postgres` e para a *service role*. As massas dos pgTAP do E1.08 e do E2.01 e o script de concorrência do E2.01 inserem células sem timóteo ou sem anfitrião. Elas são adaptadas no PR 2 (tarefa 5).
6. **Relatório × inativação.** O relatório aceito antes da inativação fica; o enviado depois é recusado. Um lançamento que já estava sendo gravado quando a inativação começou termina primeiro, e a inativação espera por ele (DT-06).
7. **Lançamento em duas chamadas** (até o `save_cell_report` do E2.05 e a RPC do E2.11). Se a célula for inativada entre o relatório e os participantes, os participantes entram: eles pertencem a um relatório que já existe (DA-6).

#### Respostas aos pontos do PO
| Ponto | Resposta |
|---|---|
| 1. Tipo (a) e a carga | As regras do tipo (a) viram `NOT NULL` e `CHECK`, que valem em `replica`. A pessoa excluída continua só no trigger do E2.01: a carga a resolve no saneamento (E4.04, E4.05), e a reconciliação confere com `private.cell_rule_violations()` (DT-01). O molde é o do E2.04: funções de regra imutáveis, um trigger de normalização, um de regras e erro com o campo. |
| 2. Dados de teste em produção | SQL só de leitura em [Conferência em produção](#conferência-em-produção-tarefa-1). A migration do PR 2 corrige sozinha só os segundos (DA-4) e para, com a lista de ids, em tudo o que pede decisão. |
| 3. Valores padrão | Saem os padrões Sábado e 19:00. O do tipo fica, numa função única (`cell_default_type()`), usada pelo padrão da coluna e pela normalização (DT-05). |
| 4. Horário | A coluna continua `time`. O `a0_normalize_cell` tira os segundos, e o `CHECK` exige minutos cheios e menos de 24:00. O E2.05 compara o valor já normalizado (leitura técnica 4). |
| 5. Célula nova ativa | Tipo (b), no `ad_enforce_cell_rules`, só no INSERT (`cell_new_inactive`). A situação omitida no cadastro vira ativa (DA-2). |
| 6. Célula inativa e relatório | Trigger `ac_enforce_cell_report_active` em `cell_reports`, para todos os papéis, no INSERT e na troca de célula. Ele trava a célula com `FOR SHARE`, que conflita com o UPDATE que inativa (DT-06). A RPC do E2.11 mantém o trigger. |
| 7. Recusas por campo | Formato `app_error` do E2.01, com `field` ([Formato dos erros](#formato-dos-erros-aq-1)). |
| 8. Endereço do anfitrião | Só no front: `applyHostAddress` passa a substituir e devolve o resultado (completo, parcial ou indisponível); `use-host-address` pede uma leitura nova a cada escolha e aplica só a última (DT-11). |
| 9. Lista única dos dias | `cell_weekdays()` é a lista do banco; `weekday_index` e o `CHECK` a leem. O front tem `WEEKDAYS` em `src/lib/cells/weekdays.ts`. A tabela de casos repete a lista, e o Vitest e o pgTAP conferem os dois lados (DT-02). |
| 10. Ordem de implementação | Banco depois do E2.01 inteiro e do PR 1 do E2.02. Front depois do front do E2.02, do E2.04, do E2.05 e do E2.06 ([Implantação](#implantação)). |
| 11. Célula repetida por queda | `id` gerado no navegador, sem RPC nova: a nova tentativa confere se a célula já existe, e o `23505` da chave primária vale como sucesso (DT-09). A frase "confira na lista de Células" não é necessária. |
| 12. Situação da pessoa nos seletores | Opções com `is_active` e `gender` da `members_view`. As pessoas gravadas leem a mesma view: quem está fora do escopo não volta e fica sem a marca (DT-10). |
| 13. Orientação da recusa | O servidor devolve só a primeira frase e o código `cell_inactive`. A tela escolhe a orientação por "Editar Célula" (`src/lib/cells/texts.ts`). |

#### Definidas pelo architect (revisar no PR)
Pontos que as RNs não respondem por inteiro. O `architect` adotou a leitura mais conservadora e coerente com as RNs. O usuário pode mudar qualquer um no PR.

| # | Ponto | Padrão adotado | Por quê |
|---|---|---|---|
| DA-1 | `type: null` enviado pela API | No cadastro, vale como "sem tipo" e vira Evangelística. Na edição, `null` ou vazio é recusado com `cell_type_invalid`. | A RN-07 diz que a célula nova "sem tipo" fica Evangelística e que o vazio é recusado. Na edição não existe "célula nova". |
| DA-2 | `is_active: null` no cadastro pela API | Vira ativa. Só `false` é recusado (`cell_new_inactive`). | A célula nova sempre começa ativa (RN-11). Nulo não é "inativa". |
| DA-3 | Regras do tipo (a) e as células excluídas | Os `NOT NULL` e os `CHECK`s valem também para as excluídas. | A restauração (E2.01) nunca traz de volta uma célula fora das regras, e a célula excluída não pode ser editada para ser corrigida. É a DA-6 do E2.04. No legado, as três pessoas são `int` e o dia e o tipo são enumerações; o horário entrava como `TimeOnly`. A célula excluída com horário ilegível, se houver, é corrigida no legado, como a 5.4 já diz. |
| DA-4 | Dados de produção fora das regras | A migration do PR 2 tira sozinha só os segundos do horário, que não contam (RN-06). Para o resto, ela para com a lista de ids, e o usuário decide (RN-13). | Os segundos não são informação. O resto é escolha de pessoa, dia, horário ou tipo. |
| DA-5 | Restaurar um relatório de célula inativa | É aceito. | Não é relatório novo: o relatório já era da célula. A RN-17 do E2.01 diz que restaurar não é lançar. |
| DA-6 | Participantes num relatório que já existe, de célula inativa | Seguem a RN-11 (d), sem conferir a situação: quem pode editar o relatório inclui e retira, e quem só envia segue a DA-5 do E2.02. | A RN-11 (c) trata do relatório novo. Até o E2.11, o lançamento é feito em duas chamadas (leitura técnica 7). |
| DA-7 | Ordem da recusa da célula inativa | Depois das recusas de permissão, de registro excluído e de escopo. A célula invisível nunca dá `cell_inactive`. | RN-14 e RN-09 (a) do E2.02: a resposta não pode revelar a situação de uma célula que a pessoa não vê. |
| DA-8 | Horário que o tipo `time` não lê ("25:00", "19:60", "") | Recusado pelo próprio tipo, com o erro do Postgres. A tela leva o erro para o Horário. | Trocar a coluna por texto exigiria reescrever a `cells_view`, o Dashboard e o E2.09, que usam `time`. A RN-06 pede pela API só o "24:00", que chega à regra. A tela nunca envia esses valores. |
| DA-9 | Cadastro idempotente (AQ-3) | O navegador gera o `id` da célula ao abrir o formulário e o reaproveita nas novas tentativas. Antes de tentar de novo, a tela confere se a célula já existe; o `23505` em `cells_pkey` também vale como sucesso. | Não há regra de unicidade (RN-03). A chave primária já garante "uma célula por tentativa", sem RPC nova. |
| DA-10 | "(inativo)" nas pessoas gravadas | Vem da `members_view` de quem edita. A pessoa fora do escopo não volta, e a marca não aparece. | P-CEL-18: a view já é o escopo. Nenhuma coluna nova precisa repetir a regra. |
| DA-11 | CEP no cadastro de membro (AQ-6) | Entra neste passo, num PR próprio (PR 3), com o mesmo helper do formulário de célula. | O PO quer o CEP igual nos dois formulários. Nenhum passo planejado mexe no endereço do membro, e manter duas buscas de CEP seria duplicação. |
| DA-12 | Dia vazio ou com espaços | Vazio ou só espaços é "sem dia" (`meeting_day_required`). Qualquer outro valor fora da lista é `meeting_day_invalid`, sem tirar espaços. | A RN-05 grava os valores "exatamente assim". " Segunda" não é "Segunda". |

### Visão geral
Cinco partes, no molde do E2.04:

1. **Listas e funções de regra no banco.** Uma função imutável por lista ou regra: os dias, os tipos, o tipo padrão, a normalização e a validade do horário. Os `CHECK`s, os triggers, o padrão da coluna e `weekday_index` usam as mesmas. O front repete as listas, e uma tabela de casos em JSON prova que os dois lados concordam.
2. **Regras do tipo (a) como `NOT NULL` e `CHECK`**, que valem em `replica`. Saem os padrões Sábado e 19:00. A migration corrige os segundos e para, com os ids, no que pede decisão.
3. **Dois triggers novos em `cells`:**
   - `a0_normalize_cell`: tira os segundos e resolve o tipo e a situação omitidos no cadastro. Nunca recusa.
   - `ad_enforce_cell_rules`: depois dos triggers de permissão, de excluído e de escopo, confere as regras e recusa com código e campo.
4. **A célula inativa não recebe relatório novo:**
   - um trigger em `cell_reports` para todos os caminhos, com a trava que resolve a corrida com a inativação;
   - a coluna `cells_view.can_submit_report` passa a ser falsa para a célula inativa. O botão da lista, o seletor do relatório e o atalho do Dashboard já usam essa coluna (E2.02).
5. **Front:** a regra pura em `src/lib/cells/`, `src/lib/address/` e `src/lib/time/`; o CEP comum aos dois formulários; o formulário, a lista e o relatório da UX (T1 a T8).

### Modelo de dados e migrations

#### Ordem das migrations
Os nomes são sugestões; o timestamp é o do momento da criação.
- Cada arquivo é idempotente (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP … IF EXISTS` antes de `CREATE TRIGGER`, `DO` com guarda de `duplicate_object`) e roda num banco zerado depois das migrations dos passos anteriores.
- Depois de cada PR com migration, regenere o `types.ts`.
- **As mensagens das guardas trazem só ids e nomes de regra.** Os logs do GitHub Actions de um repositório público são públicos.

| # | PR | Arquivo | Conteúdo | Por que separado |
|---|---|---|---|---|
| 1 | 1 | `<ts>_e208_01_inactive_cell_reports.sql` | Guarda de pré-requisitos; `enforce_cell_report_active_cell()` e o trigger `ac_enforce_cell_report_active`; `cells_view.can_submit_report` com a situação | Não depende de dados nem da conferência. Compatível com o front em produção. |
| 2 | 2 | `<ts>_e208_02_cell_rules.sql` | Guarda de pré-requisitos; listas e funções de regra; `weekday_index` lendo a lista; `private.cell_rule_violations()`; correção dos segundos; guarda das violações; padrões, `NOT NULL` e `CHECK`s; os dois triggers de `cells`; grants | Muda o que se pode gravar em `cells`. Depende da conferência em produção. |

#### Funções de regra e listas (migration 2)
```sql
-- 0. Pré-requisitos: E2.01 PR 2 (a0_check_insert_permission) e E2.02 PR 1 (ab_enforce_cell_scope).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.cells'::regclass
                  AND tgname = 'a0_check_insert_permission')
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.cells'::regclass
                     AND tgname = 'ab_enforce_cell_scope') THEN
    RAISE EXCEPTION 'E2.08 depende do PR 2 do E2.01 e do PR 1 do E2.02 em produção.';
  END IF;
END $$;

-- Listas únicas (DT-02). A tabela de casos repete os valores, e os testes conferem os dois lados.
CREATE OR REPLACE FUNCTION public.cell_weekdays() RETURNS text[]               -- índice 0 = domingo
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS
$$ SELECT ARRAY['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] $$;
CREATE OR REPLACE FUNCTION public.cell_types() RETURNS text[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS
$$ SELECT ARRAY['Evangelística', 'Discipulado', 'Macrocélula'] $$;
CREATE OR REPLACE FUNCTION public.cell_default_type() RETURNS text            -- P-CEL-03
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$ SELECT 'Evangelística' $$;

-- weekday_index (E1.08) passa a ler a lista. Mesma assinatura e mesmo resultado.
CREATE OR REPLACE FUNCTION public.weekday_index(_meeting_day text) RETURNS integer
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS
$$ SELECT array_position(public.cell_weekdays(), _meeting_day) - 1 $$;

-- RN-06: só hora e minutos. make_time preserva o 24:00, que a regra recusa
-- (date_trunc sobre interval o transformaria em 00:00).
CREATE OR REPLACE FUNCTION public.normalize_meeting_time(_t time) RETURNS time
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS
$$ SELECT make_time(extract(hour FROM _t)::int, extract(minute FROM _t)::int, 0) $$;
CREATE OR REPLACE FUNCTION public.is_valid_meeting_time(_t time) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS
$$ SELECT _t < time '24:00' AND extract(second FROM _t) = 0 $$;
```
- As funções são `IMMUTABLE`, porque aparecem em `CHECK`s e no padrão da coluna. Recebem EXECUTE para `authenticated` e `service_role`, sem `anon` (`REVOKE … FROM PUBLIC, anon`): `CHECK`s e triggers *invoker* rodam com o papel de quem grava (lição do E1.08).
- `weekday_index` mantém os grants de hoje, porque a `cells_view` e o `dashboard_summary` a chamam.

**`private.cell_rule_violations()`** (`SECURITY INVOKER`, sem grants; roda como `postgres` na migration, no SQL Editor e na reconciliação do E4.09) devolve `(rule text, cell_id uuid)`, uma linha por violação do tipo (a):

| `rule` | Condição |
|---|---|
| `leader_required`, `timothy_required`, `host_required` | a pessoa do papel está vazia (em qualquer célula, DA-3) |
| `person_deleted` | célula não excluída com líder, timóteo ou anfitrião excluído (RN-04; não cabe em `CHECK`) |
| `cell_type_invalid` | tipo vazio ou fora de `cell_types()` |
| `meeting_day_required`, `meeting_day_invalid` | dia vazio; dia fora de `cell_weekdays()` |
| `meeting_time_required`, `meeting_time_invalid` | horário vazio; horário com segundos ou a partir de 24:00 |

#### Integridade do tipo (a) (migration 2)
Na mesma transação, nesta ordem:
1. **Correção sem perda (DA-4):**
   ```sql
   UPDATE public.cells SET meeting_time = public.normalize_meeting_time(meeting_time)
    WHERE meeting_time < time '24:00' AND extract(second FROM meeting_time) <> 0;
   ```
   A Auditoria registra a alteração sem autor (Sistema, no E2.05). Os totais não mudam.
2. **Guarda:** `SELECT rule, array_agg(DISTINCT cell_id ORDER BY cell_id) FROM private.cell_rule_violations() GROUP BY rule`. Com qualquer linha, a migration falha com as regras e os ids, e nada muda. O usuário corrige pelos resultados da [conferência](#conferência-em-produção-tarefa-1) e publica de novo.
3. **Padrões, `NOT NULL` e `CHECK`s:**
   ```sql
   ALTER TABLE public.cells
     ALTER COLUMN meeting_day  DROP DEFAULT,                          -- P-CEL-02
     ALTER COLUMN meeting_time DROP DEFAULT,
     ALTER COLUMN type SET DEFAULT public.cell_default_type(),        -- P-CEL-03, DT-05
     ALTER COLUMN leader_id    SET NOT NULL,                          -- RN-02
     ALTER COLUMN timothy_id   SET NOT NULL,
     ALTER COLUMN host_id      SET NOT NULL,
     ALTER COLUMN meeting_day  SET NOT NULL,                          -- RN-05
     ALTER COLUMN meeting_time SET NOT NULL;                          -- RN-06

   -- Dentro de DO com guarda de duplicate_object. Valem também para as excluídas (DA-3).
   ALTER TABLE public.cells ADD CONSTRAINT cells_type_check                       -- RN-07
     CHECK (type = ANY (public.cell_types()));
   ALTER TABLE public.cells ADD CONSTRAINT cells_meeting_day_check                -- RN-05
     CHECK (public.weekday_index(meeting_day) IS NOT NULL);
   ALTER TABLE public.cells ADD CONSTRAINT cells_meeting_time_check               -- RN-06
     CHECK (public.is_valid_meeting_time(meeting_time));
   ```
4. **Os dois triggers** ([Escrita](#escrita)).

#### Integridade garantida pelo banco
| Garantia | Como | Vale em `replica` (carga)? |
|---|---|---|
| Líder, timóteo e anfitrião sempre preenchidos (RN-02) | `NOT NULL` nas três colunas | sim |
| Dia entre os sete valores (RN-05) | `NOT NULL` e `cells_meeting_day_check` | sim |
| Horário com hora e minutos, de 00:00 a 23:59 (RN-06) | `NOT NULL` e `cells_meeting_time_check` | sim; a carga grava `'HH:mm'::time` |
| Tipo entre os três valores (RN-07) | `NOT NULL` (já existia) e `cells_type_check` | sim |
| Nenhuma pessoa excluída num papel (RN-04) | `aa_enforce_cell_links` (E2.01) | **não**: o saneamento corrige no legado (RN-13), e a reconciliação confere com `private.cell_rule_violations()` |
| Pessoa visível e célula ainda visível (RN-04 b, RN-12) | `ab_enforce_cell_scope` (E2.02) | não se aplica: a carga não tem sessão |
| Célula nova ativa (RN-11) | `ad_enforce_cell_rules` | não: todas migram ativas |
| Célula inativa sem relatório novo (RN-11 c) | `ac_enforce_cell_report_active` | não se aplica: todas migram ativas |

### Escrita

#### Ordem dos triggers `BEFORE` de `cells`
Os triggers `BEFORE` disparam em ordem alfabética.

| Ordem | Trigger | Passo | O que faz | Recusa? |
|---|---|---|---|---|
| 1 | `a0_check_insert_permission` (INVOKER) | E2.01, PR 2 | INSERT sem "Criar Célula" → 42501 | permissão |
| 2 | `a0_normalize_cell` (**novo**, INVOKER) | E2.08 | Tira os segundos; no cadastro, resolve o tipo e a situação omitidos | nunca |
| 3 | `aa_enforce_cell_links` (*definer*) | E2.01 | Pessoa excluída (`deleted_member_chosen`), com `FOR KEY SHARE` nas pessoas | excluído |
| 4 | `ab_enforce_cell_scope` (INVOKER) | E2.02 | Pessoa que entra visível (`person_not_visible`); célula ainda visível (`would_leave_scope`) | escopo |
| 5 | `ad_enforce_cell_rules` (**novo**, *definer*) | E2.08 | As regras deste spec | regras |
| 6 | `zz_stamp_authorship` | E2.05 | Carimbo de autoria, com o valor já normalizado | — |

Os triggers `AFTER` (Auditoria e totais, do E2.05 e do E2.06, ou os de hoje) não mudam.

#### `a0_normalize_cell`
`BEFORE INSERT OR UPDATE OF meeting_time`. `SECURITY INVOKER`: só mexe em `NEW` e chama funções imutáveis. Vale para todos os papéis.
```sql
CREATE OR REPLACE FUNCTION public.normalize_cell_input()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  NEW.meeting_time := normalize_meeting_time(NEW.meeting_time);     -- RN-06: os segundos não contam
  IF TG_OP = 'INSERT' THEN
    NEW.type      := coalesce(NEW.type, cell_default_type());        -- RN-07, DA-1
    NEW.is_active := coalesce(NEW.is_active, true);                  -- RN-11, DA-2
  END IF;
  RETURN NEW;
END $$;
```
- Ele roda antes do `zz_stamp_authorship`, então "19:30:45" sobre 19:30 não é alteração (leitura técnica 4).
- Não recusa nada, então quem não pode gravar não descobre nada por ele.

#### `ad_enforce_cell_rules`
`BEFORE INSERT OR UPDATE OF leader_id, timothy_id, host_id, type, meeting_day, meeting_time`.
- `SECURITY DEFINER SET search_path = public`. Não lê tabela nenhuma, mas recusa pelo `_del_raise`, que não tem EXECUTE para `authenticated` (DT-04).
- Vale para todos os papéis, inclusive `postgres` e `service_role` (RN-01). Só a carga em `replica` passa por fora.
- Confere a linha inteira, e não só o que mudou: as regras do tipo (a) valem sempre, e depois da publicação toda linha já está dentro delas.
- `is_active` e `deleted_at` não estão na lista: inativar, reativar, excluir e restaurar não disparam o trigger. A restauração já encontra a linha dentro dos `CHECK`s (DA-3).

Ordem das conferências, a da tela (RN-14). A primeira que falha levanta o erro:

| # | Regra | Quando confere | Código · campo |
|---|---|---|---|
| 0 | Linha excluída | `NEW.deleted_at IS NOT NULL` (só fora da API): só os `CHECK`s valem | — |
| 1 | RN-02 líder | sempre | `leader_required` · `leader_id` |
| 2 | RN-02 timóteo | sempre | `timothy_required` · `timothy_id` |
| 3 | RN-02 anfitrião | sempre | `host_required` · `host_id` |
| 4 | RN-07 tipo | sempre: nulo, vazio ou fora de `cell_types()` | `cell_type_invalid` · `type` |
| 5 | RN-05 dia | sempre: nulo ou só espaços (DA-12); fora de `cell_weekdays()` | `meeting_day_required` ou `meeting_day_invalid` · `meeting_day` |
| 6 | RN-06 horário | sempre: nulo; `NOT is_valid_meeting_time` | `meeting_time_required` ou `meeting_time_invalid` · `meeting_time` |
| 7 | RN-11 célula nova ativa | só no INSERT: `NOT NEW.is_active` | `cell_new_inactive` · `is_active` |

```sql
CREATE OR REPLACE FUNCTION public.enforce_cell_rules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.leader_id IS NULL THEN
    PERFORM _del_raise('leader_required', 'Escolha o líder da célula.', '{"field": "leader_id"}');
  END IF;
  -- … timóteo, anfitrião e tipo no mesmo molde …
  IF nullif(btrim(NEW.meeting_day), '') IS NULL THEN
    PERFORM _del_raise('meeting_day_required', 'Escolha o dia da semana.', '{"field": "meeting_day"}');
  ELSIF weekday_index(NEW.meeting_day) IS NULL THEN
    PERFORM _del_raise('meeting_day_invalid', 'Dia da semana inválido. Escolha de domingo a sábado.',
                       '{"field": "meeting_day"}');
  END IF;
  -- … horário no mesmo molde …
  IF TG_OP = 'INSERT' AND NOT NEW.is_active THEN
    PERFORM _del_raise('cell_new_inactive', 'Uma célula nova sempre começa ativa.', '{"field": "is_active"}');
  END IF;
  RETURN NEW;
END $$;
```

#### Célula inativa e relatório (migration 1)
```sql
-- 0. Pré-requisitos: E2.01 (_del_raise) e E2.02 PR 1 (can_submit_report e a coluna da view).
DO $$ BEGIN
  IF to_regprocedure('public._del_raise(text,text,jsonb)') IS NULL
     OR to_regprocedure('public.can_submit_report(uuid)') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.cells_view'::regclass
                     AND attname = 'can_submit_report' AND NOT attisdropped) THEN
    RAISE EXCEPTION 'E2.08 depende do E2.01 e do PR 1 do E2.02 em produção.';
  END IF;
END $$;

-- RN-11 (c): a célula inativa não recebe relatório novo, por nenhum caminho (DT-06).
CREATE OR REPLACE FUNCTION public.enforce_cell_report_active_cell()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _active boolean;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;                 -- só fora da API
  IF TG_OP = 'UPDATE' AND NEW.cell_id IS NOT DISTINCT FROM OLD.cell_id THEN
    RETURN NEW;                                                          -- RN-11 (d): editar o que já existe
  END IF;
  -- FOR SHARE conflita com o UPDATE que inativa (FOR NO KEY UPDATE); o FOR KEY SHARE do
  -- aa_ (E2.01) não conflita. Em READ COMMITTED, depois da espera, a linha lida é a
  -- versão gravada pela outra transação.
  SELECT c.is_active INTO _active FROM cells c WHERE c.id = NEW.cell_id FOR SHARE;
  IF _active IS FALSE THEN
    PERFORM _del_raise('cell_inactive', 'Esta célula está inativa e não recebe relatórios.',
                       jsonb_build_object('cell_id', NEW.cell_id));
  END IF;
  RETURN NEW;                                                            -- célula inexistente: a FK recusa
END $$;
REVOKE ALL ON FUNCTION public.enforce_cell_report_active_cell() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ac_enforce_cell_report_active ON public.cell_reports;
CREATE TRIGGER ac_enforce_cell_report_active
  BEFORE INSERT OR UPDATE OF cell_id ON public.cell_reports
  FOR EACH ROW EXECUTE FUNCTION public.enforce_cell_report_active_cell();
```
- **Por que *definer*:** o `SELECT … FOR SHARE` sob o RLS exigiria a política de UPDATE de `cells`, que Carla não tem.
- **Por que um trigger próprio, e não dentro do `aa_enforce_cell_report_rules` do E2.01:** o `aa_` roda antes do `ab_enforce_cell_report_scope` do E2.02. Ali, a célula invisível daria `cell_inactive` antes de `not_found_or_deleted`, e a resposta revelaria a situação de uma célula que a pessoa não vê (DA-7).
- **Por que não em `can_submit_report()`:** essa função decide a recusa de permissão e de escopo do E2.02 (`report_submit_not_allowed`), no `a0_check_insert_permission` e no `ab_`. Com a situação dentro dela, Carla receberia a recusa de permissão, e não a da célula inativa (DT-07).

Ordem dos triggers `BEFORE` de `cell_reports` depois deste passo:

| Ordem | Trigger | Passo | Recusa |
|---|---|---|---|
| 1 | `a0_check_insert_permission` | E2.01, PR 2 | 42501 |
| 2 | `aa_enforce_cell_report_rules` | E2.01 | célula excluída (`FOR KEY SHARE` na célula) |
| 3 | `ab_enforce_cell_report_scope` | E2.02 | célula invisível; sem direito de lançar |
| 4 | `ac_enforce_cell_report_active` (**novo**) | E2.08 | `cell_inactive` (`FOR SHARE` na célula) |
| 5 | `enforce_cell_report_current_week_trigger`, `enforce_unique_weekly_cell_report_trigger` | atuais (o E2.11 troca) | semana (trava consultiva da semana) |
| 6 | `zz_stamp_authorship` | E2.05 | — |

**`cells_view.can_submit_report`** (AQ-7): a migration recria a view a partir da definição vigente (`pg_get_viewdef`, com as colunas do E2.02, do E2.05 e do E2.06 que já estiverem lá), mudando só a expressão dessa coluna:
```sql
-- antes (E2.02): <regra de can_submit_report>             AS can_submit_report
-- depois:        c.is_active AND (<a mesma regra>)       AS can_submit_report
```
Mesmas colunas, na mesma ordem, com `security_barrier`, dona `postgres` e só SELECT para `authenticated`. O `my_access().can_submit_some_report` do E2.02 já é `EXISTS` na `cells_view` com `is_active` e `can_submit_report` e não muda.

#### Ajustes nos passos anteriores
| Objeto | Passo | Mudança | Motivo |
|---|---|---|---|
| `weekday_index` | E1.08 | Lê `cell_weekdays()` (migration 2) | Lista única (DT-02) |
| Padrão de `cells.type` | atual | `cell_default_type()` | DT-05 |
| `cells_view.can_submit_report` | E2.02 | `c.is_active AND (…)` (migration 1) | RN-11 (c), AQ-7 |
| Teste de paridade da `cells_view` | E2.02 (DT-19) | Passa a comparar a coluna com `is_active AND can_submit_report(id)` | DT-07 |
| `ab_enforce_cell_scope` | E2.02 | **Conferir** que ele ignora o papel vazio. Um nulo não é "pessoa que entra"; a recusa do papel vazio é `*_required`, do `ad_`. Se ele tratar nulo como pessoa invisível, a tarefa 5 ajusta. | RN-02 e RN-14 |
| Massas dos pgTAP e do script de concorrência | E1.08, E2.01 e os passos que vierem antes | Toda célula com as três pessoas, dia e horário | RN-01 (leitura técnica 5) |

Nenhuma política de RLS muda. A RN-12 (CEL-04) é toda do E2.02.

### Formato dos erros (AQ-1)
É o formato do E2.01: 42501 só para permissão, e 22023 com `HINT = 'app_error'` e `DETAIL` em JSON para as regras. O `parseAppError` do E2.01 lê os dois.

| `code` | Mensagem (`MESSAGE`) | Detalhes |
|---|---|---|
| `leader_required` | Escolha o líder da célula. | `field: "leader_id"` |
| `timothy_required` | Escolha o timóteo da célula. | `field: "timothy_id"` |
| `host_required` | Escolha o anfitrião da célula. | `field: "host_id"` |
| `cell_type_invalid` | Tipo de célula inválido. Escolha Evangelística, Discipulado ou Macrocélula. | `field: "type"` |
| `meeting_day_required` | Escolha o dia da semana. | `field: "meeting_day"` |
| `meeting_day_invalid` | Dia da semana inválido. Escolha de domingo a sábado. | `field: "meeting_day"` |
| `meeting_time_required` | Informe o horário. | `field: "meeting_time"` |
| `meeting_time_invalid` | Horário inválido. Informe a hora e os minutos, entre 00:00 e 23:59. | `field: "meeting_time"` |
| `cell_new_inactive` | Uma célula nova sempre começa ativa. | `field: "is_active"` (a tela mostra no `Alert` do topo, porque o interruptor não existe no cadastro) |
| `cell_inactive` | Esta célula está inativa e não recebe relatórios. | `cell_id`; sem `field` |
| `deleted_member_chosen` (E2.01) | Este membro foi excluído e não pode ser escolhido. | `field`, `member_id` |
| `person_not_visible` (E2.02) | Você só pode escolher pessoas que você vê. | `field`, `member_id` |
| `would_leave_scope` (E2.02) | Com esta alteração, você deixaria de ver esta célula. … | `entity: "cell"` |
| `not_found_or_deleted` (E2.01) | Esta célula não existe ou já foi excluída. | `entity: "cell"` |

- A tela mapeia códigos e campos num módulo só (`src/lib/cells/codes.ts`). Na recusa `cell_inactive`, a orientação vem de `src/lib/cells/texts.ts`, conforme quem lê tem "Editar Célula" (P-CEL-17).
- **Reservas**, numa gravação de célula. Nenhuma mostra o texto técnico (UX-12):
  - 22007 e 22008 (o tipo `time` não leu o valor, DA-8): o Horário;
  - 23514: o nome do `CHECK` dá o campo (`cells_meeting_day_check` → Dia da semana);
  - 23502: o nome da coluna dá o campo;
  - 23505 em `cells_pkey`, no cadastro: a tentativa repetida, tratada como sucesso (DT-09);
  - sem nada disso, a mensagem de conexão da T6.

### Bloqueios e concorrência
A ordem global de aquisição é a do E2.01, estendida pelo E2.04 e pelo E2.06 (relatório → célula → membros → semana → linhas dos triggers). Este passo não cria trava consultiva e acrescenta uma trava de linha:

| Operação | Célula | Membros | (célula, semana) |
|---|---|---|---|
| PATCH de célula (inclusive inativar e reativar) | a própria linha (`FOR NO KEY UPDATE`) | `FOR KEY SHARE` nas pessoas que entram (E2.01) | — |
| INSERT de relatório, ou troca da célula de um relatório | `FOR KEY SHARE` (E2.01) e depois `FOR SHARE` na célula nova (**novo**) | — | sim, depois da célula |
| Edição de relatório sem trocar a célula | `FOR KEY SHARE` (E2.01) | — | como no E2.01 |
| Restauração de relatório (E2.01) | — | — | sim |

Os casos dos critérios:
- **Carla salva o relatório enquanto Pedro inativa C1:**
  - se a inativação trava a linha primeiro, o trigger de Carla espera, relê C1 inativa e recusa com `cell_inactive`;
  - se o relatório chega primeiro ao `FOR SHARE`, a inativação espera o *commit* de Carla. O relatório fica, e a célula fica inativa com ele (RN-11 d).
- **Reativar enquanto alguém lança:** o lançamento espera a reativação e é aceito.
- **Trocar o tema de um relatório enquanto a célula é inativada:** não há espera. O `FOR KEY SHARE` do E2.01 não conflita com a inativação, e a edição é aceita (RN-11 d).
- **Dois lançamentos na mesma célula:** `FOR SHARE` não conflita com `FOR SHARE`. A semana única continua com a trava consultiva e o índice do E2.01.
- **Escolher uma pessoa enquanto ela é excluída:** continua a DT-08 do E2.01.
- **Duas edições da mesma célula:** vale a última gravação, como no legado (Fora de escopo do Negócio).
- **Cadastro repetido depois de uma queda:** a chave primária garante uma célula só (DT-09).

Sem *deadlock* novo: quem inativa não pede nenhuma trava que o lançamento segure. A trava da árvore e as linhas de totais do E2.06 são pegas só pela inativação, no `AFTER`. A trava da semana vem sempre depois da célula. Uma RPC futura (E2.11) que pegue a trava da semana precisa travar a célula antes.

### Contratos (RPC, Edge Functions, colunas novas)
**Colunas:** nenhuma nova.
- `cells.leader_id`, `timothy_id`, `host_id`, `meeting_day` e `meeting_time` passam a `NOT NULL`. No `types.ts`, `Row` fica sem nulo nessas colunas, e `Insert` passa a exigir as cinco.
- `meeting_day` e `meeting_time` perdem o padrão; `type` tem o padrão `cell_default_type()` e continua opcional no `Insert`.

**Constraints:** `cells_type_check`, `cells_meeting_day_check` e `cells_meeting_time_check`.

**Funções públicas novas** (todas `IMMUTABLE`, com EXECUTE para `authenticated` e `service_role`, sem `anon`):

| Função | Para quê |
|---|---|
| `cell_weekdays() RETURNS text[]` | os sete dias, na ordem de `weekday_index` (0 = domingo) |
| `cell_types() RETURNS text[]` | os três tipos |
| `cell_default_type() RETURNS text` | o tipo padrão da coluna e da normalização |
| `normalize_meeting_time(time) RETURNS time` | hora e minutos, sem os segundos |
| `is_valid_meeting_time(time) RETURNS boolean` | minutos cheios e menos de 24:00 |
| `weekday_index(text)` (E1.08, reescrita) | o mesmo resultado, lendo `cell_weekdays()` |

**Funções internas novas:** `private.cell_rule_violations()` (sem grants), `normalize_cell_input()`, `enforce_cell_rules()` e `enforce_cell_report_active_cell()` (funções de trigger, sem EXECUTE para `authenticated`).

**Triggers novos:** `a0_normalize_cell` e `ad_enforce_cell_rules` em `cells`; `ac_enforce_cell_report_active` em `cell_reports`.

**Views:** a `cells_view` muda só a expressão de `can_submit_report`. Nenhuma coluna nova.

**RPC e Edge Functions:** nenhuma.

**Cadastro de célula pelo front (DT-09):**
```text
1. Ao abrir "Nova célula": attemptId = crypto.randomUUID(), guardado no estado do formulário.
2. Salvar:      supabase.from('cells').insert({ id: attemptId, ...campos })       -- sem RETURNING
3. Nova tentativa depois de falha de rede, 5xx ou erro desconhecido:
   a. supabase.from('cells_view').select('id').eq('id', attemptId).maybeSingle()
      → encontrou: sucesso ("Célula criada."), sem gravar de novo;
   b. senão, o mesmo INSERT. 23505 em cells_pkey → sucesso.
```
Edição: `.update(patch).eq('id', id).select('id, updated_at')`, com o PATCH só do que mudou (E2.05) e "0 linhas" tratado como no E2.01.

**Complemento da DT-09 (implementação, 2026-11-26, revisão do PR 3–5):** em 3a e no 23505 de 3b, a célula achada é lida na `cells_view` (`CELL_STORED_SELECT`) e comparada com o que está sendo enviado. Igual: "Célula criada.", sem gravar. Diferente (a pessoa corrigiu o formulário depois da queda): um PATCH só do que mudou, sem tocar em `is_active`, e o resultado é o desse PATCH. Um 23505 sem a célula visível continua valendo como criada.

**Tabela de casos:** `supabase/tests/fixtures/cell-rules-cases.json` (DT-17), com:
- `weekdays` (a ordem de `cell_weekdays()`), `weekday_options` (rótulo e valor, de segunda a domingo), `types` e `default_type`;
- `meeting_time`: uma linha por caso, com `input`, `typing` (o que o campo mostra enquanto digita), `blur` (ao sair do campo), `ui_valid` e `db` (o valor gravado, o código da regra, o SQLSTATE do tipo ou `null` quando o caso é só da tela). Tem pelo menos as linhas da tabela da T3, mais "00:00", "23:59", "23:59:59.999" e o vazio.

### Front
Segue o padrão dos passos anteriores: os componentes cuidam da tela, o acesso a dados fica nos hooks e a regra pura fica em `src/lib/`.

**PR 2, ajuste mínimo** (vai ao ar junto com o banco, para o `types.ts` novo compilar):
- o `CellForm` passa a ter um estado próprio, com os campos anuláveis, e monta o `Insert` só com as cinco colunas preenchidas. Sem elas, mostra no toast a mensagem do Negócio do primeiro campo que falta;
- saem os padrões Sábado e 19:00 do estado inicial;
- "Célula Ativa" deixa de aparecer no cadastro novo.

**PR 3, CEP comum** (DA-11):
- `src/lib/address/cep.ts`: `maskCep`, `cepDigits`, `isCompleteCep`, `parseCepLookup` (lê a resposta do serviço com um *type guard*, sem `any`; `erro` vira "não encontrado") e `applyCepAddress`, que preenche só rua, bairro, cidade e estado, onde o serviço traz valor, e nunca número e complemento (P-CEL-20).
- `src/hooks/use-cep-lookup.ts`:
  - `lookup(cep)` devolve encontrado, não encontrado ou falha;
  - tempo-limite de 8 s;
  - a busca nova cancela a anterior (`AbortController`), e só a última vale.
- `src/components/address/CepField.tsx`:
  - máscara de 8 dígitos e `inputMode="numeric"`;
  - "Buscando endereço…" ao lado do rótulo;
  - os avisos de não encontrado e de falha (P21), que não marcam o campo como inválido;
  - o anúncio `sr-only` do preenchimento.
  - **A busca é disparada no `onChange` do campo, quando a pessoa digita ou cola o oitavo dígito.** Nunca por um efeito sobre o valor, para o CEP que vem do anfitrião não disparar a busca (UXD-9).
- No cadastro de membro, o bloco de endereço troca a busca própria pelo `CepField`. O complemento deixa de ser preenchido, e os avisos passam a aparecer.

**PR 4, lista, relatório e atalho:**
- `Cells.tsx` (T7):
  - "Novo relatório" só com `can_submit_report` da linha, que já é falso para a célula inativa;
  - a situação com o `StatusBadge` do E2.01 (P6), com o ícone `PauseCircle` na "Inativa";
  - as ações com `justify-end` (P65), o nome acessível "Novo relatório da célula de {Líder}" e a linha dos badges com `flex-wrap`;
  - "Nova célula".
- `CellReportForm` (T8):
  - `cell_inactive` vai para o `Alert` do topo, com a orientação por "Editar Célula";
  - aberto pela lista, o `Alert` tem "Fechar", que fecha o formulário e recarrega a lista;
  - aberto por Relatórios, a célula fica desmarcada, e o seletor recarrega;
  - os dados digitados ficam;
  - a recusa também desatualiza `["cells"]` e `["access"]`.
- Dashboard: o atalho já vem de `my_access().can_submit_some_report` (E2.02). Nada muda no código; o teste prova a RN-11 (c).

**PR 5, formulário de célula (UX T1 a T6):**
- **Domínio puro, com Vitest e sem React nem Supabase:**
  - `src/lib/cells/weekdays.ts`: `WEEKDAYS` (como hoje), `WEEKDAY_OPTIONS` (rótulo e valor, de segunda a domingo, P-CEL-14) e `weekdayLongLabel`.
  - `src/lib/cells/cell-types.ts`: `CELL_TYPES`, `DEFAULT_CELL_TYPE` e `isCellType`. Sai a lista do `CellForm`.
  - `src/lib/time/hhmm.ts` (P62, reaproveitado pelo E2.11): `maskHhmm`, `readHhmmOnBlur`, `isValidHhmm` e `toHhmm` ("20:00:00" → "20:00").
  - `src/lib/cells/validation.ts`:
    - `validateCellForm(values)` devolve todos os erros de uma vez, na ordem da tela (RN-02, RN-05, RN-06);
    - `validateMeetingTimeOnBlur(value)` confere só o formato.
  - `src/lib/cells/situation.ts`:
    - a dica pela situação gravada e o aviso do P60;
    - `saveOutcome(stored, values)`: `created`, `updated`, `inactivated`, `reactivated` ou `unchanged`, para o toast.
  - `src/lib/cells/host-address.ts`: `applyHostAddress(address, host)` passa a **substituir** e devolve `{ address, outcome }`, com `outcome` igual a `full`, `partial` ou `unavailable`.
    - Com `sensitive_visible`, os sete campos passam a ser os do anfitrião, inclusive vazios.
    - Sem `sensitive_visible`, bairro, cidade e estado vêm do anfitrião, e CEP, rua, número e complemento ficam vazios.
    - Com os campos visíveis todos vazios, o endereço não muda, e o resultado é `unavailable`, sem distinguir o endereço vazio do mascarado (P-CEL-07).
  - `src/lib/members/labels.ts`: `inactiveMark(gender)` e `personLabel({ name, is_active, gender })` (P63). O `src/lib/deletion/blockers.ts` do E2.01 passa a importar daqui.
  - `src/lib/cells/codes.ts` (códigos, campos e reservas) e `src/lib/cells/texts.ts` (**todos** os textos deste spec).
  - `src/lib/cells/changes.ts` (E2.05): o horário é comparado por `toHhmm`, então "20:00:00" gravado e "20:00" no campo não são alteração. Se o E2.05 ainda não tiver criado o arquivo, ele nasce aqui.
- **Hooks:**
  - `src/hooks/use-cell-save.ts`: cadastro idempotente e edição (contrato acima). Traduz as recusas para os campos pelo `codes.ts`.
  - `src/hooks/use-host-address.ts`: `request(hostId)` a cada escolha no seletor de Anfitrião, inclusive a volta ao anfitrião gravado.
    - A leitura é nova a cada pedido (`fetchQuery` com `staleTime: 0`), com a mesma consulta da `members_view` do `use-member-address`.
    - Uma ficha (*token*) por pedido: só a resposta do último é aplicada.
    - Devolve o estado (carregando, falha) e `retry`.
    - Substitui o efeito de hoje, que comparava com o anfitrião gravado (AQ-5).
  - `src/hooks/use-member-statuses.ts`:
    - `members_view.select('id, is_active, gender').in('id', [líder, timóteo, anfitrião])`;
    - quem não volta está fora do escopo e fica sem marca (DA-10).
  - `src/hooks/use-member-options.ts`: o `select` passa a `id, name, is_active, gender`, e a opção `markInactive` monta o rótulo com `personLabel`.
  - `src/lib/query-refresh.ts` (E2.06): `refreshAfterCellWrite` passa a desatualizar também `["access"]` (AQ-8).
- **Componentes:**
  - `src/components/cells/CellFormDialog.tsx`:
    - a casca do P1 com o rodapé do E2.04 (resumo, conexão, gravação demorada) e o descartar;
    - o badge "Inativa" no cabeçalho, com o `StatusBadge`.
    - Se a casca do E2.04 ainda for específica de membro, ela é extraída para `src/components/form/FormDialog.tsx` num commit próprio, sem mudar o formulário de membro.
  - `CellPeopleFieldset`:
    - a dica de alcance do E2.02 e os três seletores obrigatórios, sem "✕" (P64), com `aria-required`, as dicas e as marcas;
    - os avisos do endereço do anfitrião (P61) e "Ir para o endereço".
  - `CellMeetingFieldset`: Tipo, Dia (rótulos de `WEEKDAY_OPTIONS`), Horário (`TimeInput`) e "Célula ativa" só na edição (P60).
  - `CellAddressFieldset`: `CepField` e os demais campos, todos com `autoComplete="off"`.
  - `src/components/form/TimeInput.tsx` (P62).
  - `AsyncMemberSelect` e `PaginatedSelect`:
    - aceitam `isClearable={false}`, `aria-required` e `aria-describedby`;
    - recebem `markInactive`;
    - mantêm o `savedLabel` do E2.02.
  - `react-hook-form`, com um *resolver* próprio sobre `validateCellForm`, como no E2.04.

### Onde cada regra é imposta
| RN | Banco (constraint, RLS, trigger, RPC) | UI |
|---|---|---|
| RN-01 | `NOT NULL` e `CHECK`s valem para qualquer caminho, inclusive `replica`; `a0_normalize_cell`, `ad_enforce_cell_rules` e `ac_enforce_cell_report_active` sem exceção de papel; `a0_check_insert_permission` (E2.01) antes das regras; `private.cell_rule_violations()` na reconciliação | — |
| RN-02 | `NOT NULL` nas três pessoas; `ad_` (`leader_required`, `timothy_required`, `host_required`) | Três seletores obrigatórios, sem "✕" (P64); `validateCellForm` |
| RN-03 | Nada: nenhuma unicidade e nenhum aviso | Nenhum seletor esconde quem já está em outro papel |
| RN-04 | Excluído: `aa_enforce_cell_links` (E2.01) e `person_deleted` na reconciliação. Visível: `ab_enforce_cell_scope` (E2.02), só para quem entra. Inativo: aceito | Seletores pela `members_view` (sem excluídos, só o escopo); "(inativo)" pela `members_view` (P63, DA-10) |
| RN-05 | `NOT NULL`; `cells_meeting_day_check` sobre `cell_weekdays()`; sem padrão; `ad_` (`meeting_day_required`, `meeting_day_invalid`) | `Select` sem valor inicial, com os rótulos de segunda a domingo (`WEEKDAY_OPTIONS`) |
| RN-06 | `NOT NULL`; `cells_meeting_time_check`; sem padrão; `a0_` tira os segundos; `ad_` (`meeting_time_required`, `meeting_time_invalid`); o tipo `time` recusa o resto (DA-8) | `TimeInput` (P62), leitura ao sair do campo e a mesma tabela de casos |
| RN-07 | `cells_type_check`; padrão `cell_default_type()`; `a0_` resolve o nulo no cadastro; `ad_` (`cell_type_invalid`) | `Select` com Evangelística, sem opção vazia |
| RN-08 | As views e as funções de leitura usam os valores atuais da célula; nada é copiado | `refreshAfterCellWrite` (P44) |
| RN-09 | Nada: endereço sem validação | `CepField` e `applyCepAddress` (só quatro campos; nunca número e complemento) |
| RN-10 | Nada: pela API, o sistema não copia | `applyHostAddress` substitui; `use-host-address` aplica só a última escolha |
| RN-11 | Célula nova: `a0_` (nulo vira ativa) e `ad_` (`cell_new_inactive`). (a) totais pelo trigger do E2.06 (ou o de hoje). (b) `dashboard_summary` já filtra `is_active`; E2.09. (c) `ac_enforce_cell_report_active` com `FOR SHARE`, para todos os papéis; `cells_view.can_submit_report`; `my_access`. (d) nada bloqueia editar, excluir e restaurar (DA-5, DA-6). (e) os bloqueios do E2.01 contam a célula inativa | "Célula ativa" só na edição (P60); badge com ícone; sem "Novo relatório"; seletor e atalho pela coluna; recusa no `Alert`, com a orientação por permissão |
| RN-12 | Políticas e triggers do E2.02 (`edit_cell`, escopo) e do E2.01 (célula excluída) | "Editar" só com "Editar Célula" (E2.02) |
| RN-13 | Conferência antes do PR 2; guarda da migration com `private.cell_rule_violations()`; `CHECK`s antes da carga; a mesma função no E4.09 | — |
| RN-14 | Ordem dos triggers (`a0_check` < `a0_normalize` < `aa_` < `ab_` < `ad_` em `cells`; `a0_` < `aa_` < `ab_` < `ac_` em `cell_reports`) e das conferências do `ad_`; `app_error` com `field` | Todos os erros juntos ao salvar; horário ao sair do campo; recusas do servidor no campo ou no `Alert` (`codes.ts`) |

### Respostas às perguntas do UX (AQ-1 a AQ-9)
| # | Resposta |
|---|---|
| AQ-1 | **Sim.** Todos os códigos pedidos, com `field`, no formato `app_error` ([Formato dos erros](#formato-dos-erros-aq-1)). A célula inativa no relatório é `cell_inactive`, sem campo. As exceções são os horários que o tipo `time` não lê (DA-8), mapeados pela tela. |
| AQ-2 | **Sim, sem coluna nova.** Nas opções, a `members_view` já tem `is_active` e `gender`; o `useMemberOptions` passa a pedi-los. Para as pessoas gravadas, o `use-member-statuses` lê a mesma view pelos três ids. Quem está fora do escopo não volta, e a marca não aparece (DA-10, P-CEL-18). |
| AQ-3 | **Sim.** O `id` é gerado ao abrir o formulário. A nova tentativa confere se a célula já existe, e o `23505` da chave primária vale como sucesso (DT-09). A frase de conferir a lista não é necessária. |
| AQ-4 | **Sim.** `cell-rules-cases.json`, com as linhas da T3 e os casos do banco. O pgTAP é gerado a partir do JSON, e um Vitest falha se a cópia ficar desatualizada (DT-17). "25:00" e "19:60" são recusados pelo tipo `time` (22008), e a tabela registra isso. |
| AQ-5 | **Sim.** A consulta sai da escolha no seletor, e não da comparação com o anfitrião gravado. A leitura é nova a cada escolha, e só a última vale (`use-host-address`). "Nada disponível" é decidido pelos sete campos visíveis, sem saber se o anfitrião tem endereço. O `applyHostAddress` substitui (DT-11). |
| AQ-6 | **Sim.** `src/lib/address/cep.ts`, `use-cep-lookup` (8 s) e `CepField`, comuns aos dois formulários. A busca só sai da digitação ou da colagem. O cadastro de membro muda neste passo, no PR 3 (DA-11). |
| AQ-7 | **Sim.** `cells_view.can_submit_report` passa a `is_active AND` a regra do E2.02. O botão da lista, o seletor do relatório e o `my_access().can_submit_some_report` (atalho do Dashboard) usam a coluna. A recusa do lançamento vem do trigger, com as mesmas duas regras (DT-07). |
| AQ-8 | `refreshAfterCellWrite` (E2.06) desatualiza `["members"]`, `["cells"]` (lista e opções do seletor de célula), `["cell_reports"]` e `["dashboard"]`. Este passo acrescenta `["access"]` (o atalho do Dashboard). A recusa `cell_inactive` no relatório desatualiza `["cells"]` e `["access"]`. |
| AQ-9 | **Confirmado nos dois lados.** O `ab_enforce_cell_scope` do E2.02 confere só quem entra, comparando com o valor gravado. O PATCH leva só o que mudou (`src/lib/cells/changes.ts`, do E2.05). Beatriz continua anfitriã quando Pedro muda só o horário. |

### Perguntas Q-1 a Q-6
O desenho segue o padrão do Negócio: nenhuma regra nova. O custo de cada alternativa, se a resposta for "sim":

| # | Alternativa | O que muda | Custo |
|---|---|---|---|
| Q-1 | Avisar quando o líder já tem outra célula ativa | Só tela: ao escolher o líder, uma consulta na `cells_view` (`leader_id`, `is_active`, sem a própria célula) e o aviso da T9 | Pequeno: cerca de meio dia, com testes |
| Q-1 | Impedir | Índice único parcial `cells (leader_id) WHERE is_active AND deleted_at IS NULL`, com recusa amigável no `ad_`; a reativação também passa a ser recusada; o seletor marca quem já lidera (P5). O índice vale em `replica`, então os líderes com duas células ativas no legado precisam de saneamento antes da carga | Médio: 2 a 3 dias, mais o saneamento |
| Q-2 | Avisar sobre o mesmo anfitrião no mesmo dia e horário | Só tela: uma consulta na `cells_view` quando Anfitrião, Dia e Horário estão preenchidos | Pequeno: cerca de meio dia. Impedir não foi desenhado (o caso do casal) |
| Q-3 | Timóteo do mesmo sexo do líder | Regra no `ad_`, que passa a ler o sexo das duas pessoas. Tipo (a) exige saneamento do legado, e tipo (b) só confere o que muda. O seletor desabilita pelo sexo (já vem com a AQ-2) | Médio: 1,5 a 2 dias, mais a conferência do legado |
| Q-4 | Sugerir o líder no Timóteo | Só tela: a frase na dica e o botão "Usar o líder" | Pequeno: meio dia |
| Q-5 | Macrocélula sem anfitrião | `host_id` volta a aceitar nulo, com `CHECK (host_id IS NOT NULL OR type = 'Macrocélula')` e o `ad_` condicional; o formulário põe o Tipo primeiro; a RN-10 sem anfitrião; o E2.11 trata o anfitrião ausente nos participantes automáticos | Médio: cerca de 2 dias. "Reunião num local da igreja" é uma entidade nova (cadastro de locais), fora deste passo |
| Q-6 | Consolidado como anfitrião | Depende do spec da Consolidação. O consolidado está em `members`, com a flag; o `ad_` passaria a recusar o consolidado como líder ou timóteo, e o seletor de Anfitrião o ofereceria com a marca | Pequeno aqui (menos de 1 dia), mas só depois da Consolidação |

### Decisões técnicas
| # | Decisão | Motivo |
|---|---|---|
| DT-01 | Regras do tipo (a) como `NOT NULL` e `CHECK`, valendo também para as células excluídas. A pessoa excluída é a única no trigger (E2.01), e a reconciliação a confere com `private.cell_rule_violations()`. | Ponto 1 do PO; DA-3 |
| DT-02 | Uma lista por domínio no banco (`cell_weekdays()`, `cell_types()`, `cell_default_type()`), usada pelos `CHECK`s, pelos triggers, por `weekday_index` e pelo padrão da coluna. O front repete as listas em `weekdays.ts` e `cell-types.ts`, e a tabela de casos prova a igualdade. | Ponto 9 do PO; sem strings mágicas |
| DT-03 | `meeting_time` continua `time`. O `a0_` tira os segundos com `make_time`, antes do carimbo do E2.05. O `CHECK` exige menos de 24:00 e minutos cheios. | RN-06 e ponto 4, sem reescrever as leituras que usam `time` |
| DT-04 | Dois triggers em `cells`: `a0_normalize_cell` (INVOKER, nunca recusa) e `ad_enforce_cell_rules` (*definer*, sem exceção de papel), depois dos do E2.01 e do E2.02. O `ad_` é *definer* porque recusa pelo `_del_raise`, que não tem EXECUTE para `authenticated`. | RN-14 (ordem); RN-01 (todos os papéis) |
| DT-05 | Saem os padrões Sábado e 19:00. O do tipo fica, em `cell_default_type()`. | P-CEL-02, P-CEL-03 |
| DT-06 | Célula inativa: `ac_enforce_cell_report_active` (*definer*, todos os papéis) no INSERT e na troca de célula, depois do escopo do E2.02, com `FOR SHARE` na célula. | RN-11 (c) em todos os caminhos; corrida da DT-08 do E2.01 (o `FOR KEY SHARE` não conflita com a inativação); DA-7 |
| DT-07 | `can_submit_report()` (E2.02) continua sendo o direito de lançar (permissão e escopo). A coluna `cells_view.can_submit_report` é esse direito com a célula ativa. | A ordem das recusas (RN-14) e a AQ-7 |
| DT-08 | Formato `app_error` do E2.01, com `field`; reservas por SQLSTATE e nome de constraint. | AQ-1 |
| DT-09 | Cadastro idempotente pelo `id` gerado no navegador, sem RPC: conferência antes da nova tentativa e `23505` de `cells_pkey` como sucesso. | AQ-3 e ponto 11 |
| DT-10 | A marca "(inativo)" lê a `members_view`: opções com `is_active` e `gender`, e as pessoas gravadas pelos ids. | AQ-2 e P-CEL-18, sem repetir a regra de escopo numa coluna nova |
| DT-11 | Endereço do anfitrião só no front: `applyHostAddress` substitui e devolve o resultado; uma leitura nova por escolha, aplicando só a última. | RN-10, AQ-5 |
| DT-12 | CEP comum: regra pura, *hook* com tempo-limite e cancelamento, e um campo único usado pelos dois formulários. A busca sai só da digitação. | RN-09, AQ-6, DA-11 |
| DT-13 | Migration 2: corrige só os segundos e para com os ids de qualquer outra violação do tipo (a). | Ponto 2, DA-4; nada de dado pessoal nos logs |
| DT-14 | `refreshAfterCellWrite` desatualiza também `["access"]`. A recusa `cell_inactive` desatualiza a lista e o acesso. | AQ-8 |
| DT-15 | Cinco PRs: dois de banco, compatíveis com o front em produção, e três de front, cada um promovido sozinho. | Cada PR vai ao ar sozinho ([Implantação](#implantação)) |
| DT-16 | `TimeInput` e `src/lib/time/hhmm.ts` são gerais (P62), para o horário do relatório no E2.11. | P62 |
| DT-17 | Tabela de casos em JSON para o Vitest e o pgTAP, com o SQL gerado e a conferência de sincronia, como no E1.04 e no E2.04. | AQ-4 |

### Riscos (concorrência, escala, segurança)
1. **Janela entre o PR 1 e o PR 4.** Com o front do E2.02 no ar, "Novo relatório" some da célula inativa assim que o PR 1 é publicado. O formulário de relatório antigo mostra a recusa num toast, só com a primeira frase.
2. **Janela entre o PR 2 e o PR 5.** O formulário antigo, com o ajuste mínimo, avisa no toast o primeiro campo que falta, um por vez. Ele ainda não tem CEP nem o endereço do anfitrião por inteiro.
3. **Espera pela trava `FOR SHARE`.** Um lançamento espera uma edição da mesma célula que esteja em curso, e o contrário também. A inativação inclui o recálculo dos totais (até cerca de 1 s no volume de referência, E2.06). É raro e curto.
4. **A `cells_view` é recriada por vários passos** (E2.02, E2.05, E2.06 e este). Cada um parte da definição vigente e muda só o que é dele. O pgTAP confere a lista de colunas e a paridade da `can_submit_report`.
5. **`CHECK` com função.** Mudar `cell_weekdays()`, `cell_types()` ou `is_valid_meeting_time()` não revalida as linhas antigas. Toda mudança nessas funções precisa de uma migration que confira os dados antes, com `private.cell_rule_violations()`.
6. **Massas de teste e scripts.** Toda gravação em `cells` passa pelas regras, inclusive os pgTAP, o script de concorrência e o gerador de volume do E1.08, se for usado. O PR 2 adapta as massas (tarefa 5).
7. **Carga do legado.** As células excluídas também precisam de horário legível (DA-3). Como a API do legado lia o horário como `TimeOnly`, o esperado é zero; o saneamento (E4.04) lista as que houver.
8. **Horário ilegível pela API** (DA-8). A resposta traz a mensagem do Postgres, sem o campo. A tela nunca envia esses valores.
9. **Serviço de CEP de terceiros.** Pode cair, demorar ou mudar o formato. O tempo-limite e os avisos não impedem salvar. Só o CEP sai do navegador, como hoje no cadastro de membro.
10. **Passos ainda não implementados.** O desenho usa nomes do E2.01 (PR 2), do E2.02, do E2.05 e do E2.06 (`a0_check_insert_permission`, `ab_enforce_cell_scope`, `ab_enforce_cell_report_scope`, `can_submit_report`, `my_access`, `zz_stamp_authorship`, `refreshAfterCellWrite`). As guardas das migrations falham cedo se faltar algum. As tarefas 2 e 5 releem as migrations finais.
11. **Volume.**
    - Medir no volume de referência do E1.08 (1.500 células, 100 mil relatórios).
    - Metas:
      - PATCH de célula sem troca de líder nem de situação abaixo de 20 ms;
      - lançamento de relatório com o trigger novo: no máximo 1 ms a mais que antes;
      - página da `cells_view` com contagem abaixo de 300 ms (E1.08).
    - O `ad_` não lê tabela; o `ac_` faz uma leitura por chave.
12. **Segurança.**
    - O `id` escolhido pelo navegador não dá acesso a nada: um `id` já usado só gera `23505`, e a conferência da nova tentativa passa pela `cells_view`, que só mostra o que a pessoa vê.
    - A recusa `cell_inactive` só chega a quem vê a célula e pode lançar nela (DA-7).
    - `private.cell_rule_violations()` e as funções de trigger não têm EXECUTE para `authenticated`. As funções novas não têm EXECUTE para `anon`.
13. **`_del_raise` sem EXECUTE para `authenticated`.** Um trigger INVOKER que recusa por ele falha com 42501 para quem está logado. Os triggers deste passo que recusam são *definer*. A armadilha vale para o E2.02, que tem triggers INVOKER de escopo, e vai para o `CLAUDE.md`.

### Dependências e impactos em outros passos
| Passo | Relação |
|---|---|
| E2.01 | **Pré-requisito, inteiro** (o PR 2 traz o `a0_check_insert_permission` e a T8 do formulário de relatório). Nada muda na exclusão e na restauração. A restauração de célula já encontra a linha dentro das regras (DA-3). A de relatório de célula inativa é aceita (DA-5). |
| E2.02 | **Pré-requisito: o PR 1 antes dos PRs de banco daqui, e o front de Células, Relatórios e Dashboard antes do PR 4.** A coluna `cells_view.can_submit_report` passa a considerar a situação, e o teste de paridade muda (DT-07). O `ab_enforce_cell_scope` precisa ignorar o papel vazio. A CEL-04 fica pronta com o E2.02 em produção (RN-12). |
| E2.04 | O PR 5 reaproveita a casca do P1, o `FieldMessages`, o `FormErrorSummary` e o descartar do PR 3 de lá. O PR 3 daqui muda o bloco de endereço do cadastro de membro e não começa com o PR 3 do E2.04 aberto. |
| E2.05 | O carimbo compara o horário já sem segundos. O PR 5 usa o `src/lib/cells/changes.ts` e o `RecordAuthorship` de lá. A situação e o CEP já contam como alteração. |
| E2.06 | Inativar e reativar já mudam os totais (`trg_cell_hierarchy`). O PR 5 usa o `refreshAfterCellWrite` e acrescenta `["access"]`. |
| E2.07 | O vínculo celular não conta a célula inativa (RN-10 de lá). Nada a fazer aqui. |
| E2.09 | A célula inativa não tem situação. Falta decidir a situação da célula cadastrada ou reativada depois da reunião da semana (Impactos do Negócio). |
| E2.10 | O filtro "Situação" (recomendação do PO) pode usar `is_active` direto na `cells_view`. |
| E2.11 | A RPC de lançamento mantém o `ac_enforce_cell_report_active` e trava a célula antes da trava da semana. O horário do relatório usa o `TimeInput` (P62). O retrato guarda o tipo (REL-09). |
| E2.14 | Decide se "células por tipo" conta só as ativas. A célula nova sempre começa ativa. |
| E4.04, E4.05, E4.06 | A transformação entrega as células dentro dos `NOT NULL` e dos `CHECK`s, inclusive as excluídas: dia de `0` a `6`, tipo de `0` a `2`, horário `'HH:mm'::time` e todas ativas. O saneamento lista a célula não excluída com pessoa excluída e a célula com horário ilegível. |
| E4.09 | A reconciliação roda `private.cell_rule_violations()` e exige zero linhas. |
| Consolidação | Ver a Q-6. |

**Mudanças nos documentos, no aceite** (o `product-owner` atualiza a matriz, a seção 3 e o Progresso; o `architect` atualiza o resto do `CLAUDE.md` na revisão final):
- **`CLAUDE.md`:**
  - **Matriz de paridade:** "CRUD de células" com a situação ativa e inativa e a célula inativa sem relatório novo.
  - **Schema efetivo, `cells`:**
    - `leader_id`, `timothy_id`, `host_id`, `meeting_day` e `meeting_time` obrigatórios;
    - `type` e `meeting_day` só com os valores de `cell_types()` e `cell_weekdays()`;
    - `meeting_time` sem segundos e abaixo de 24:00;
    - sem padrão de dia e horário; o tipo tem o padrão `cell_default_type()`.
  - **Lógica no banco:**
    - `a0_normalize_cell` e `ad_enforce_cell_rules`;
    - `ac_enforce_cell_report_active` (célula inativa sem relatório novo, com `FOR SHARE`);
    - `private.cell_rule_violations()`;
    - `cells_view.can_submit_report` falso para a célula inativa.
  - **Front:**
    - o formulário de célula da UX;
    - o CEP comum aos dois formulários, sem preencher o complemento;
    - o cadastro de célula idempotente.
  - **Armadilhas:**
    - o item de `meeting_day` passa a dizer que só os sete valores são aceitos, com a lista em `cell_weekdays()` e em `src/lib/cells/weekdays.ts`, conferidas pela tabela de casos (o mapa de dias do Dashboard já foi corrigido no PR 3 do E1.08);
    - novo: "toda gravação em `cells` precisa das três pessoas, do dia e do horário, inclusive com a *service role* e nos pgTAP";
    - novo: "`_del_raise` não tem EXECUTE para `authenticated`: um trigger que recusa por ele precisa ser *definer*";
    - novo: "horário ilegível pela API ('25:00') é recusado pelo tipo `time`, antes dos triggers".
  - **Problemas conhecidos:** nada muda. A data sugerida no `CellReportForm` e a regravação dos participantes são do E2.11.
- **`docs/migracao.md`:**
  - **3.4:** CEL-01, CEL-02 e CEL-03 em ✅. "Onde impor": `NOT NULL`, `CHECK` sobre `cell_weekdays()` e `cell_types()` e trigger com código e campo. CEL-04 em ✅ junto com o E2.02 em produção.
  - **5.3:** os `CHECK`s de `meeting_day`, `type` e `meeting_time` e os `NOT NULL` das três pessoas, do dia e do horário, que valem também para as células excluídas. A pessoa excluída é conferida na reconciliação.
  - **5.4:** as linhas novas da tabela [Dados do legado](#dados-do-legado), mais "célula excluída com horário ilegível: corrigir no legado".
  - **5.5:** `Time` → `'HH:mm'::time`, sem segundos; todas as células com `is_active = true`; os `CHECK`s valem também para as excluídas.
  - **5.6:** a reconciliação roda `private.cell_rule_violations()`.
  - **Progresso:** a linha do E2.08 ganha o link do spec e o estado.

### Pontos de extensão
| Futuro | Onde muda |
|---|---|
| Q-1 a Q-6 | Ver [Perguntas Q-1 a Q-6](#perguntas-q-1-a-q-6): avisos só na tela; regras novas no `ad_` e em `private.cell_rule_violations()` |
| Situação do relatório (E2.09) | Lê `is_active`, o dia e o horário atuais da `cells_view` |
| Lançamento atômico (E2.11) | A RPC mantém o trigger da célula inativa e usa o `TimeInput` |
| Consolidação | Uma regra a mais no `ad_` para os papéis que não aceitam consolidado |
| Lista de dias ou de tipos | `cell_weekdays()` ou `cell_types()`, a tabela de casos e o front, com a conferência dos dados antes (risco 5) |

### Implantação
| PR | Ordem | Efeito no front em produção |
|---|---|---|
| 1 (banco: célula inativa) | **depois do E2.01 inteiro e do PR 1 do E2.02 em produção**; merge → "Deploy: banco" | Com o front do E2.02, "Novo relatório" some da célula inativa. Lançar numa célula inativa é recusado, com a mensagem no toast do formulário antigo. |
| 2 (banco: regras do cadastro) | conferência sem linha `a` nem `infra`; merge → "Deploy: banco" → **promote em seguida** (ajuste mínimo do front) | Antes do promote, o formulário antigo continua gravando (ele manda Sábado e 19:00 do próprio estado); sem timóteo ou anfitrião, a recusa aparece no toast. |
| 3 (front: CEP comum) | merge → promote, a qualquer momento depois do PR 3 do E2.04 | O CEP do cadastro de membro para de preencher o complemento e ganha os avisos. |
| 4 (front: lista, relatório e atalho) | **depois do PR 1 em produção e do front do E2.02**; merge → promote | A T7 e a T8. |
| 5 (front: formulário de célula) | **depois do PR 2 em produção e do PR 3 na `main`**; merge → promote | A T1 a T6. |

- O promote já recusa rodar com migration pendente.
- Antes do "Deploy: banco" do PR 2, o usuário roda a [conferência](#conferência-em-produção-tarefa-1) e corrige as linhas `a`. Uma guarda que falha não muda nada, e a publicação pode ser repetida.
- **Rollback:**
  - o front volta pelo promote do commit anterior. Depois do PR 2, o front de antes do ajuste mínimo continua gravando, com as recusas no toast;
  - a migration 1 volta com uma migration nova que retira o trigger e recria a coluna da view com a expressão do E2.02;
  - a migration 2 volta com uma migration nova que retira os dois triggers e os `CHECK`s e devolve os padrões. Os `NOT NULL` podem ficar, e a correção dos segundos fica.

### Conferência em produção (tarefa 1)

> **Resultado em 2026-11-25 (sessão principal, só leitura, depois do E2.03 PR 1 em produção, migrations até `20261126100300`): nenhuma linha.** Sem `a`, `auto`, `info` nem `infra`; as 2 células têm líder, timóteo e anfitrião. O PR 2 pode seguir.
>
> **Resultado em 2026-11-24 (sessão principal, só leitura, com o E2.01 PR 2 em produção).** Só dados de teste:
> - `a` · RN-02 sem timóteo: 2 células. Bloqueia o PR 2; decidir a correção antes dele.
> - `infra` · E2.02 PR 1 ainda não está em produção (esperado; o PR 1 do E2.08 espera por ele).
> - Nenhum dia, horário ou tipo fora da lista; nenhuma pessoa excluída num papel.

Só leitura. O usuário roda no SQL Editor de produção (papel `postgres`), antes do "Deploy: banco" do PR 1 (para ver as linhas `infra`) e de novo antes do PR 2.
- A saída traz só o tipo, o problema, o tratamento e os ids das células. Não traz nome de pessoa nem endereço. Nos valores fora da lista, mostra o próprio valor do dia ou do tipo, cortado em 30 caracteres.
- Ela lê `deleted_at` por `to_jsonb`, então funciona com ou sem as colunas do E2.01.
- Tipos:
  - `a`: para a migration do PR 2 até ser corrigido (decisão do usuário). As células excluídas aparecem com "(célula excluída)", porque as regras valem também para elas (DA-3);
  - `auto`: corrigido sozinho pela migration do PR 2, sem perda (DA-4);
  - `info`: só informação;
  - `infra`: se aparecer, parar. "Pré-requisito ausente" quer dizer que o passo citado ainda não está em produção; um tipo de coluna diferente volta ao `architect`.

```sql
-- E2.08 · Conferência em produção, só leitura (um SELECT). Não grava nada.
WITH
base AS (
  SELECT c.id, c.leader_id, c.timothy_id, c.host_id, c.type, c.meeting_day, c.meeting_time, c.is_active,
         (to_jsonb(c) ->> 'deleted_at') IS NOT NULL AS is_deleted,
         CASE WHEN (to_jsonb(c) ->> 'deleted_at') IS NOT NULL THEN ' (célula excluída)' ELSE '' END AS sufixo
    FROM public.cells c
),
listas AS (
  SELECT ARRAY['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] AS dias,
         ARRAY['Evangelística', 'Discipulado', 'Macrocélula']                      AS tipos
),
pessoas AS (
  SELECT b.id, b.is_deleted, r.papel, m.is_active AS pessoa_ativa,
         (to_jsonb(m) ->> 'deleted_at') IS NOT NULL AS pessoa_excluida
    FROM base b
    CROSS JOIN LATERAL (VALUES ('líder', b.leader_id), ('timóteo', b.timothy_id), ('anfitrião', b.host_id)) r(papel, member_id)
    JOIN public.members m ON m.id = r.member_id
),
colunas AS (
  SELECT column_name, data_type FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'cells'
),
problems (tipo, problema, tratamento, id) AS (
  -- Tipo (a): decidir antes do "Deploy: banco" do PR 2. Valem também para as excluídas (DA-3).
  SELECT 'a', 'RN-02 sem líder' || sufixo, 'escolher o líder', id FROM base WHERE leader_id IS NULL
  UNION ALL
  SELECT 'a', 'RN-02 sem timóteo' || sufixo, 'escolher o timóteo', id FROM base WHERE timothy_id IS NULL
  UNION ALL
  SELECT 'a', 'RN-02 sem anfitrião' || sufixo, 'escolher o anfitrião', id FROM base WHERE host_id IS NULL
  UNION ALL
  SELECT 'a', 'RN-04 ' || papel || ' excluído', 'escolher outra pessoa', id FROM pessoas
   WHERE NOT is_deleted AND pessoa_excluida
  UNION ALL
  SELECT 'a', 'RN-05 sem dia' || sufixo, 'escolher o dia', id FROM base WHERE meeting_day IS NULL
  UNION ALL
  SELECT 'a', 'RN-05 dia fora da lista: "' || left(b.meeting_day, 30) || '"' || b.sufixo,
         'trocar por um dos sete valores', b.id
    FROM base b, listas l WHERE b.meeting_day IS NOT NULL AND NOT (b.meeting_day = ANY (l.dias))
  UNION ALL
  SELECT 'a', 'RN-06 sem horário' || sufixo, 'informar o horário', id FROM base WHERE meeting_time IS NULL
  UNION ALL
  SELECT 'a', 'RN-06 horário 24:00' || sufixo, 'informar um horário entre 00:00 e 23:59', id FROM base
   WHERE meeting_time >= time '24:00'
  UNION ALL
  SELECT 'a', 'RN-07 tipo fora da lista: "' || left(coalesce(b.type, '(vazio)'), 30) || '"' || b.sufixo,
         'trocar por um dos três tipos', b.id
    FROM base b, listas l WHERE b.type IS NULL OR NOT (b.type = ANY (l.tipos))
  -- Corrigido sozinho pela migration do PR 2 (DA-4)
  UNION ALL
  SELECT 'auto', 'RN-06 horário com segundos' || sufixo, 'os segundos saem (19:30:45 vira 19:30)', id FROM base
   WHERE meeting_time < time '24:00' AND extract(second FROM meeting_time) <> 0
  -- Informação
  UNION ALL
  SELECT 'info', 'RN-11 célula inativa', 'deixa de receber relatório novo no PR 1', id FROM base
   WHERE NOT is_deleted AND NOT is_active
  UNION ALL
  SELECT 'info', 'Sábado às 19:00, o padrão antigo', 'conferir se o dia e o horário foram mesmo escolhidos', id FROM base
   WHERE NOT is_deleted AND meeting_day = 'Sábado' AND meeting_time = time '19:00'
  UNION ALL
  SELECT DISTINCT 'info', 'RN-04 pessoa inativa num papel', 'nada a fazer (é aceita)', id FROM pessoas
   WHERE NOT is_deleted AND NOT pessoa_ativa AND NOT pessoa_excluida
  -- Infraestrutura: se aparecer, parar
  UNION ALL
  SELECT 'infra', 'cells.' || e.column_name || ' não é ' || e.data_type, 'parar e voltar ao architect', NULL::uuid
    FROM (VALUES ('meeting_time', 'time without time zone'), ('meeting_day', 'text'), ('type', 'text'),
                 ('is_active', 'boolean'), ('deleted_at', 'timestamp with time zone')) e(column_name, data_type)
    LEFT JOIN colunas c USING (column_name)
   WHERE c.data_type IS DISTINCT FROM e.data_type
  UNION ALL
  SELECT 'infra', 'Pré-requisito ausente: ' || p.nome, 'publicar o passo antes', NULL::uuid
    FROM (VALUES
      ('E2.01 PR 2 (a0_check_insert_permission em cells)',
       EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.cells'::regclass AND tgname = 'a0_check_insert_permission')),
      ('E2.02 PR 1 (can_submit_report)', to_regprocedure('public.can_submit_report(uuid)') IS NOT NULL)) p(nome, ok)
   WHERE NOT p.ok
)
SELECT tipo, problema, tratamento, count(id) AS celulas,
       array_agg(id ORDER BY id) FILTER (WHERE id IS NOT NULL) AS ids
  FROM problems
 GROUP BY tipo, problema, tratamento
 ORDER BY tipo, problema;
```
- Nenhuma linha `a` e nenhuma `infra`: o deploy do PR 2 pode seguir. O PR 1 só espera as linhas `infra`.
- Na stack local, a consulta rodou sem erro e listou a massa de volume do E1.08 (células sem timóteo) e a falta do E2.02. Na produção, o esperado são só as células de teste.

### Verificações obrigatórias (para o QA)
**pgTAP** (`supabase/tests/database/e208_*.test.sql`, autocontidos, com `ROLLBACK`). A massa é a dos critérios: Samuel, Magda, Pedro, Paula, André, Beatriz, Caio, Carla, Fábio (inativo), Gabriel, Ester, Diego, Rita e Bruno (excluído), com as funções e as permissões do E2.02, e as células C1 e C2.

- **PR 1 (`e208_01_inactive_cell.test.sql`):**
  - o trigger `ac_enforce_cell_report_active` existe, a função é *definer* sem EXECUTE para `authenticated`, e ele vem depois do `ab_enforce_cell_report_scope` e antes dos triggers de semana;
  - a migration roda de novo sem erro;
  - RN-11 (c): Carla, Pedro, a *service role* e o `postgres` recebem `cell_inactive` (código, mensagem e `cell_id`, sem `field`) ao lançar em C1 inativa; em `replica`, a carga passa;
  - passar para C1 inativa um relatório de C2 recebe a mesma recusa;
  - RN-11 (d): trocar o tema, excluir, restaurar (DA-5) e incluir e retirar participantes de um relatório de C1 inativa são aceitos (DA-6);
  - DA-7: sem nenhuma permissão de lançar, 42501; Diego (não vê C1), `not_found_or_deleted`; quem vê e não tem o direito, `report_submit_not_allowed`. Nenhum dos três recebe `cell_inactive`;
  - reativada, C1 volta a aceitar;
  - `cells_view.can_submit_report` é falso para C1 inativa para todas as personas, e igual a `is_active AND can_submit_report(id)` em todas as linhas (paridade do E2.02 ajustada);
  - `my_access().can_submit_some_report` fica falso para Carla quando C1 é a única célula dela e está inativa, e volta com a reativação.
- **PR 2 (`e208_02_cell_rules.test.sql` e `e208_02_cases.test.sql`, gerado):**
  - estrutura: os `NOT NULL`; sem padrão em `meeting_day` e `meeting_time`; o padrão de `type` é `cell_default_type()`; os três `CHECK`s com os nomes; as funções `IMMUTABLE`, com EXECUTE para `authenticated` e `service_role` e sem `anon`; `private.cell_rule_violations` sem grants;
  - a ordem dos triggers `BEFORE` (`a0_check_insert_permission` < `a0_normalize_cell` < `aa_` < `ab_` < `ad_`, e `zz_` se o E2.05 estiver aplicado);
  - a migration roda de novo; a guarda falha com as regras e os ids, sem mudar nada e sem dado pessoal na mensagem;
  - **tabela de casos:** `cell_weekdays()`, `cell_types()` e `cell_default_type()` iguais ao JSON; cada caso de horário gravado ou recusado como o JSON diz;
  - **RN-01:** a *service role* e o `postgres` recebem `timothy_required`; em `replica`, os `CHECK`s e os `NOT NULL` valem, o trigger não, e a pessoa excluída aparece em `private.cell_rule_violations()`;
  - **RN-02 a RN-07 e RN-11:** todos os critérios "pela API", com o código, o campo e a mensagem, inclusive:
    - a Macrocélula sem anfitrião;
    - Rita limpa a anfitriã de C1, recebe `host_required`, e nada muda;
    - André nos três papéis, e duas células iguais aceitas (RN-03);
    - Pedro muda só o horário de C1 com Beatriz anfitriã, e é aceito (RN-04);
    - "Segunda-feira", "segunda", "Terca", "" e "  " (DA-12);
    - "24:00" com a mensagem; "25:00" e "19:60" com 22008; "19:30:45" gravado como 19:30; "00:00" e "23:59" aceitos;
    - o tipo omitido e o `null` no cadastro viram Evangelística; "Discipuladora", "evangelistica" e "" são recusados; `null` na edição é recusado (DA-1);
    - `is_active: false` no cadastro é recusado, e `null` vira ativa (DA-2); inativar e reativar na edição são aceitos;
  - **RN-14:** Caio, sem "Criar Célula", com a célula vazia, recebe 42501; uma pessoa excluída mais um timóteo vazio dá `deleted_member_chosen`; timóteo vazio mais dia inválido dá `timothy_required`;
  - **E2.05, se aplicado:** reenviar "19:30:45" sobre 19:30 não cria evento nem muda `updated_at`;
  - **invariante:** `private.cell_rule_violations()` sem linhas no fim de cada arquivo.

**Concorrência** (`supabase/tests/concurrency/e208_concurrency.sh`, duas conexões e `pg_sleep`, como no E2.01):
- inativação segura × lançamento: o lançamento espera e recebe `cell_inactive`;
- lançamento seguro × inativação: a inativação espera, e no fim o relatório existe e a célula está inativa;
- troca de célula de um relatório × inativação da célula nova;
- reativação × lançamento: aceito depois da espera;
- troca do tema de um relatório × inativação: as duas terminam sem espera.

Nenhum cenário termina com relatório novo numa célula que já estava inativa quando ele foi aceito.

**Volume:** as metas do risco 11, com o `EXPLAIN` anexado ao PR.

**Vitest:**
- a sincronia entre o JSON e o SQL gerado;
- `weekdays.ts`, `cell-types.ts` e `hhmm.ts` contra o JSON;
- `validation.ts`, `situation.ts`, `codes.ts` (inclusive as reservas), `changes.ts` (o horário com e sem segundos);
- `host-address.ts` (substitui; completo, parcial e indisponível; o mascarado igual ao vazio);
- `cep.ts` (quatro campos, nunca número e complemento; não encontrado);
- `members/labels.ts`;
- `use-host-address` (respostas fora de ordem), `use-cep-lookup` (cancelamento e tempo-limite) e `use-cell-save` (a nova tentativa com a célula já criada, pela conferência e pelo `23505`).

**Playwright:** os critérios de UX de cada PR, os critérios das RNs pela tela e o *smoke* de login.

## Tarefas
_Seção do `architect`._

Cinco PRs no `mci-connect`. **Os de banco começam depois do E2.01 inteiro e do PR 1 do E2.02 em produção.** Os de front seguem a [Implantação](#implantação).
- Dentro de cada PR, o banco vai primeiro, e os tipos são regenerados antes do front.
- Cada desenvolvedor aciona o `code-reviewer` ao terminar a sua tarefa; esse passo não aparece na tabela.
- Na coluna RNs, os números são das regras deste spec. Na coluna UX, os dos critérios `UX-`.

| # | Responsável | Descrição | Arquivos | RNs | UX | Depende de |
|---|---|---|---|---|---|---|
| **PR 1: banco, célula inativa sem relatório novo** | | | | | | |
| 1 | usuário | Rodar a [conferência](#conferência-em-produção-tarefa-1) em produção (só leitura). Uma linha `infra` para tudo. As linhas `a` são decididas antes do PR 2; o PR 1 não depende delas. | — | 13 | — | E2.01 e PR 1 do E2.02 em produção |
| 2 | backend-developer | Migration 1: guarda de pré-requisitos; `enforce_cell_report_active_cell()` e o trigger `ac_enforce_cell_report_active` (*definer*, `FOR SHARE`, todos os papéis, INSERT e troca de célula); `cells_view` recriada a partir da definição vigente, com `can_submit_report` igual a `c.is_active AND (…)`; grants. Regenerar o `types.ts`. | `supabase/migrations/<ts>_e208_01_inactive_cell_reports.sql`, `src/integrations/supabase/types.ts` | 01, 11, 14 | dados de 21, 22, 23 | 1 (sem `infra`) |
| 3 | qa | pgTAP do PR 1 ([Verificações](#verificações-obrigatórias-para-o-qa)); o teste de paridade da `cells_view` do E2.02 com a situação; concorrência (os cinco cenários); `EXPLAIN` do lançamento no volume de referência. | `supabase/tests/database/e208_01_inactive_cell.test.sql`, o teste de paridade do E2.02, `supabase/tests/concurrency/e208_concurrency.sh` | 01, 11, 14 | — | 2 |
| **PR 2: banco, regras do cadastro** | | | | | | |
| 4 | qa | Tabela de casos `cell-rules-cases.json` (dias, rótulos, tipos, tipo padrão e horários, com as colunas `typing`, `blur`, `ui_valid` e `db`), o gerador do SQL e o teste de sincronia. | `supabase/tests/fixtures/cell-rules-cases.json`, `scripts/gen-cell-cases-sql.*`, `supabase/tests/database/e208_02_cases.test.sql` | 05, 06, 07 | dados de 08, 09 | — (escreve em paralelo com a 5, a partir dos contratos) |
| 5 | backend-developer | Migration 2: guarda de pré-requisitos; `cell_weekdays`, `cell_types`, `cell_default_type`, `normalize_meeting_time` e `is_valid_meeting_time`; `weekday_index` lendo a lista; `private.cell_rule_violations()`; correção dos segundos; guarda das violações (só ids); padrões, `NOT NULL` e os três `CHECK`s; `normalize_cell_input` + `a0_normalize_cell`; `enforce_cell_rules` + `ad_enforce_cell_rules` (ordem da tabela); grants. Conferir que o `ab_enforce_cell_scope` do E2.02 ignora o papel vazio. Adaptar as massas dos pgTAP e do script de concorrência existentes. Regenerar o `types.ts`. | `supabase/migrations/<ts>_e208_02_cell_rules.sql`, `supabase/tests/database/e108_*.test.sql`, `supabase/tests/database/e201_*.test.sql`, os pgTAP dos passos seguintes que inserem células, `supabase/tests/concurrency/e201_concurrency.sh`, `src/integrations/supabase/types.ts` | 01 a 07, 11, 13, 14 (banco) | — | 1 (sem linha `a`); E2.01 PR 2 e E2.02 PR 1 em produção |
| 6 | frontend-developer | Ajuste mínimo para o `types.ts` novo: o `CellForm` com estado próprio, sem os padrões Sábado e 19:00, montando o `Insert` só com as cinco colunas preenchidas (senão, a mensagem do Negócio no toast); "Célula Ativa" só na edição. | `src/components/CellForm.tsx` | 02, 05, 06, 11 | — | 5 (tipos) |
| 7 | qa | pgTAP do PR 2 ([Verificações](#verificações-obrigatórias-para-o-qa)); *smoke* do cadastro e da edição de célula pela tela atual. | `supabase/tests/database/e208_02_cell_rules.test.sql` | 01 a 07, 11, 13, 14 | — | 4, 5, 6 |
| **PR 3: front, CEP comum** | | | | | | |
| 8 | frontend-developer | `src/lib/address/cep.ts` (com Vitest); `use-cep-lookup` (8 s, cancelamento, só a última); `CepField` (máscara, "Buscando endereço…", avisos P21, anúncio, busca só no `onChange`); o bloco de endereço do cadastro de membro passa a usar o `CepField`, sem preencher o complemento. Textos em `src/lib/address/texts.ts`. | `src/lib/address/{cep,texts}.ts`, `src/hooks/use-cep-lookup.ts`, `src/components/address/CepField.tsx`, o bloco de endereço do cadastro de membro (`src/components/members/*` ou `src/components/MemberForm.tsx`) | 09 | 18 (no cadastro de membro), 26, 29 | PR 3 do E2.04 na `main` |
| 9 | qa | Vitest do `cep.ts` e do `use-cep-lookup`; teste de componente do CEP no cadastro de membro (preenchimento, complemento intacto, não encontrado, falha, tempo-limite, sem bloquear o salvar). | `src/**/*.test.ts(x)` | 09 | 18 | 8 |
| **PR 4: front, lista, relatório e atalho** | | | | | | |
| 10 | frontend-developer | `Cells.tsx` (T7): "Novo relatório" por `can_submit_report`; `StatusBadge` com `PauseCircle`; `justify-end`; nome acessível; `flex-wrap`; "Nova célula". `CellReportForm` (T8): `cell_inactive` no `Alert` do topo com a orientação por "Editar Célula", "Fechar" ou célula desmarcada, dados mantidos, `["cells"]` e `["access"]` desatualizados. `src/lib/cells/{codes,texts}.ts` com o que estes dois usam. | `src/pages/Cells.tsx`, `src/components/CellReportForm.tsx`, `src/lib/cells/{codes,texts}.ts` | 11 | 21, 22, 23, 26 a 29 | PR 1 em produção; front de Células, Relatórios e Dashboard do E2.02 |
| 11 | ux-designer | Revisão da UI do PR 4 (T7, T8, P6, P65) em 320, 360 e 1280 px, nos temas claro e escuro. | — | — | 21, 23, 26 a 29 | 10 |
| 12 | qa | Testes de componente (UX-23, UX-29); Playwright (UX-21, 22, 23; os critérios da RN-11 c pela tela, inclusive o atalho do Dashboard de Carla); *smoke* de login. | `src/**/*.test.tsx`, `e2e/celulas-inativa.spec.ts` | 11 | 21, 22, 23 | 10 |
| **PR 5: front, formulário de célula** | | | | | | |
| 13 | frontend-developer | Domínio puro, com Vitest sobre a tabela de casos: `src/lib/cells/{weekdays,cell-types,validation,situation,host-address,codes,texts,changes}.ts`, `src/lib/time/hhmm.ts` e `src/lib/members/labels.ts` (o `blockers.ts` do E2.01 passa a importar daqui). | os arquivos citados e os `*.test.ts` deles | 02, 05, 06, 07, 10, 11, 14 | dados de 03, 04, 08, 09, 13 a 16, 19, 20 | 4 (tabela de casos); 5 (tipos) |
| 14 | frontend-developer | Formulário da UX (T1 a T6): `CellFormDialog` (P1, rodapé, descartar, badge "Inativa"); `CellPeopleFieldset` (obrigatórios sem "✕", dicas, "(inativo)", avisos do anfitrião e "Ir para o endereço"); `CellMeetingFieldset` (Tipo, Dia, `TimeInput`, "Célula ativa" com o P60); `CellAddressFieldset` (`CepField`); `use-cell-save` (cadastro idempotente, PATCH só do que mudou, recusas no campo); `use-host-address`; `use-member-statuses`; `use-member-options` com `is_active`, `gender` e `markInactive`; `PaginatedSelect` e `AsyncMemberSelect` com `isClearable`, `aria-required` e `aria-describedby`; `refreshAfterCellWrite` com `["access"]`; toasts da T6; `react-hook-form` com o *resolver* de `validateCellForm`. | `src/components/CellForm.tsx`, `src/components/cells/*`, `src/components/form/{TimeInput,FormDialog}.tsx`, `src/components/select/PaginatedSelect.tsx`, `src/components/AsyncMemberSelect.tsx`, `src/hooks/{use-cell-save,use-host-address,use-member-statuses,use-member-options}.ts`, `src/lib/query-refresh.ts`, `src/pages/Cells.tsx`, `index.html` (`viewport-fit=cover`, se ainda faltar) | 02 a 14 | 01 a 20, 24 a 30 | 13; PR 2 em produção; PR 3 na `main`; front do E2.04 (PR 3), do E2.05 e do E2.06 |
| 15 | ux-designer | Revisão da UI do PR 5 (T1 a T6, P1, P21, P22, P60 a P64) em 320, 360 e 1280 px, nos temas claro e escuro. | — | — | 01 a 20, 24 a 30 | 14 |
| 16 | qa | Testes de componente (UX-02 a UX-12, 15 a 20, 24, 25, 29, 30); Playwright (UX-01, 06, 07, 10, 13 a 16, 19, 21, 24, 27, 28; as RNs pela tela; *smoke* de login); inspeção com axe (UX-26). | `src/**/*.test.tsx`, `e2e/celulas-cadastro.spec.ts` | 02 a 14 | ver descrição | 14 |
| **Fechamento** | | | | | | |
| 17 | architect | Revisão final dos cinco PRs; atualizar o `CLAUDE.md` (estado atual e armadilhas, ver [Dependências](#dependências-e-impactos-em-outros-passos)). O aceite, a matriz e o `docs/migracao.md` são do `product-owner`. | `CLAUDE.md` | — | — | 3, 7, 9, 11, 12, 15, 16 |

**Ordem de execução:**
- Tarefa 1 primeiro.
- PR 1: 2 → 3.
- PR 2: depois da tarefa 1 sem linha `a`. 4 ∥ 5 → 6 → 7. Pode ser desenvolvido em paralelo com o PR 1 (arquivos diferentes); a publicação recomendada é PR 1 e depois PR 2.
- PR 3: 8 → 9. Não depende do banco e pode correr em paralelo com os PRs 1 e 2, desde que o PR 3 do E2.04 já esteja na `main`.
- PR 4: depois do PR 1 em produção e do front do E2.02. 10 → (11 ∥ 12).
- PR 5: a 13 pode começar depois do merge da tarefa 4 e da regeneração dos tipos da tarefa 5. Depois, 14 → (15 ∥ 16), com o PR 2 em produção e o PR 3 na `main`.
- 17 no fim.

**Critérios de pronto**
1. **Todas as tarefas de banco:**
   - as migrations rodam num banco zerado depois das existentes e rodam de novo sem erro;
   - nenhuma função nova tem EXECUTE para `anon`;
   - o `types.ts` está regenerado;
   - a suíte inteira de pgTAP (a dos passos anteriores e a deste) passa.
2. **Tarefa 2:** os cinco cenários de concorrência terminam sem relatório novo em célula inativa; a `cells_view` tem as mesmas colunas, na mesma ordem.
3. **Tarefa 5:**
   - num banco com uma célula sem timóteo, a migration falha com o id e não muda nada;
   - todo critério "pela API" passa, com o código, o campo e a mensagem do spec;
   - um usuário sem "Criar Célula" nunca recebe uma recusa deste spec;
   - `private.cell_rule_violations()` volta vazia na massa do spec.
4. **Tarefas 6, 8, 10, 13 e 14:**
   - `npm run lint`, `npm test` e `npm run build` verdes;
   - sem `any` e sem asserção de tipo (`as Tipo`) nos arquivos novos (`as const` é permitido);
   - nenhuma regra de domínio dentro de componente;
   - nenhum texto do spec fora de `src/lib/cells/texts.ts` e `src/lib/address/texts.ts`;
   - nenhuma lista de dias ou de tipos fora de `weekdays.ts` e `cell-types.ts`;
   - nenhuma leitura da tabela `members` direto.
5. **Tarefa 14:**
   - uma edição sem mudança não faz nenhuma requisição;
   - o PATCH leva só os campos alterados;
   - salvar com erro de preenchimento não faz nenhuma requisição (UX-04);
   - a nova tentativa de um cadastro já gravado não cria outra célula;
   - o CEP do anfitrião nunca dispara a busca de CEP.
6. **Tarefas 11 e 15:** o `ux-designer` dá o veredito e lista os ajustes, que voltam ao `frontend-developer` antes de o QA fechar o PR.

## Testes
_Seção do `qa`._ Arquivos em `mci-connect/supabase/tests/`: `database/e208_01_inactive_cell` (IC, 89 testes), a paridade do E2.02 em `database/e202_01_scope` (PS), `concurrency/e208_concurrency.sh` (CC), `concurrency/e208_migrations.sh` (MG) e `volume/e208_volume.psql` (VOL).

**PR 1 (2026-11-25, pista local A, `supabase_db_mci-e104-be` zerado com todas as migrations):**
- pgTAP inteiro: 43 arquivos, 4182 testes, PASS (4093 de antes + 89 do IC). Sem o trigger novo, 16 testes do IC falham (conferido).
- CC: os cinco cenários, com as duas ordens na troca de célula e no tema (7 pares, 26 verificações), PASS em duas execuções. Esperas medidas: o segundo espera cerca de 2 s nos cenários 1 a 4 e menos de 0,1 s no 5.
- MG: a migration roda de novo sem erro e sem mudar a `cells_view` nem os triggers de `cell_reports`.
- VOL (20 mil membros, 1.500 células, 150 inativas, 100 mil relatórios, 800 mil participações): lançamento com o trigger 12,10 ms e sem ele 12,09 ms (diferença 0,01 ms, meta 1 ms; o `ac_` levou 0,23 ms no `EXPLAIN` frio); PATCH de célula 2,5 ms (meta 20); página da `cells_view` com contagem 13,7 ms (Administrador) e 55,6 ms (G12) (meta 300).
- `types.ts` regenerado: igual ao da `main` (a view mantém as colunas e os tipos; a função de trigger não aparece na API). `tsc` sem erro.
- Playwright (suíte inteira, `--workers=1`): 339 passaram, 8 pulados, 2 falharam, nenhum ligado a este PR (o PR não muda o front):
  - `sign-in.spec.ts:416` (axe, tema claro, contraste 4,29:1 numa transição): passou na nova rodada isolada (instável);
  - `excluidos-membros.spec.ts:612` (UX-19, "página 2" da busca "a"): depende de haver mais de 10 resultados na massa local; falhou em `/cells` na suíte e em `/members` isolado. A `cells_view` mantém as mesmas linhas; só muda `can_submit_report`.
  - Smoke de login (`login.spec.ts`): passou. Vitest 1848/1848, `tsc` e `build` verdes; o `lint` tem 3 erros que já existem na `main` (`ui/command.tsx`, `ui/textarea.tsx`, `tailwind.config.ts`).
- Revisão: o `code-reviewer`, o `qa` e os desenvolvedores não foram acionados como agentes (a ferramenta de acionar agentes não estava disponível nesta execução). O `architect` implementou e revisou o PR 1, que só tem banco e testes.

| RN | Testes | Resultado |
|---|---|---|
| RN-01 | IC (Carla, Pedro, Rita, *service role* e `postgres` recebem `cell_inactive`; em `replica` a carga passa) | ✅ |
| RN-11 (c) | IC (código, mensagem, `cell_id` sem `field`; nada gravado; troca de C2 para C1 inativa recusada para Pedro, *service role* e `postgres`; `cells_view.can_submit_report` falso para 5 pessoas; `my_access().can_submit_some_report` de Carla some e volta; reativada, aceita); PS e IC (a coluna = `is_active AND can_submit_report(id)`, 17 pessoas, antes e depois da reativação); CC 1, 3a, 4; VOL | ✅ (banco) |
| RN-11 (d), DA-5, DA-6 | IC (tema, mesma célula reenviada, incluir e retirar participantes, Carla grava os participantes do relatório lançado antes da inativação, excluir, restaurar); CC 2, 3b, 5a, 5b | ✅ |
| RN-14, DA-7 | IC (ordem dos triggers `BEFORE`; Hugo 42501, Diego `not_found_or_deleted` no INSERT e na troca, Fábio `report_submit_not_allowed`; nenhum recebe `cell_inactive`) | ✅ |
| DT-06, DT-07 | IC (trigger `BEFORE INSERT OR UPDATE OF cell_id`, *definer* com `search_path`, sem EXECUTE para `anon` e `authenticated`; `cells_view` com as mesmas colunas, *security definer*, dona `postgres`, só SELECT para `authenticated`); CC; MG | ✅ |

**PR 2 (2026-11-25, pista local A, banco zerado com todas as migrations até `20261126130000`):** arquivos novos `database/e208_02_cell_rules` (CR, 95 testes), `database/e208_02_cases` (CS, 43, gerado de `fixtures/cell-rules-cases.json` por `fixtures/generate-cell-rules-cases.mjs`, no lugar do `scripts/gen-cell-cases-sql.*` da tarefa 4, como no E2.04) e o MG estendido à migration 2.
- pgTAP inteiro: 45 arquivos, 4320 testes, PASS. Sem os dois triggers novos, 38 testes do CR falham (conferido). As massas do E1.08, do E2.01, do E2.02 e do E2.06 passaram a ter as três pessoas (quem faltava repete o líder, RN-03, sem mudar o escopo), dia e horário válidos, e as células inativas são inativadas depois do cadastro. No E1.08 PR 3, as células de dia desconhecido e de dia nulo viraram células com relatório numa semana seguinte, e a "sem horário" virou quinta 23:59 (as pendentes de W continuam 9).
- `e203_02_policy` falhou uma vez por tempo (`sign_in_attempt: tempo-limite excedido`, o teto de 5 s por comando com a máquina carregada pela pista B); passou nas duas rodadas seguintes. Não tem relação com células.
- MG: as migrations 1 e 2 rodam de novo sem mudar nada; a guarda para com `timothy_required: <id>`, sem nome, sem listar a célula com segundos (corrigida antes) e sem gravar nada.
- CC: o E2.08 (26 verificações), o E2.01 adaptado (71) e o E2.06 (252) passam.
- VOL: lançamento 12,30 ms com o trigger do PR 1 e 12,22 ms sem ele; PATCH de célula (horário e rua, dispara os dois triggers novos) 4,07 ms (meta 20; no `EXPLAIN` frio, `a0_` 0,20 ms e `ad_` 0,41 ms); página da `cells_view` 16,8 ms (Administrador) e 66,6 ms (G12).
- Vitest 1869/1869 (novos: `cell-rules-cases-sync`, `cell-types`, `write`, e 4 do `CellForm`: sem Sábado e 19:00, sem "Célula Ativa" no cadastro, nada enviado sem as cinco colunas, PATCH com a situação). `tsc` e `build` verdes; `lint` com os 3 erros que já existem na `main`.
- Playwright (suíte inteira, `--workers=1`): 337 passaram, 8 pulados, 4 falharam. Adaptados e verdes na nova rodada: `exclusao-membros.spec.ts:432` (a massa tirava o timóteo) e `celulas-relatorios-escopo.spec.ts:518` (UX-24 do E2.02: limpar o anfitrião não chega mais ao servidor; a tela avisa "Escolha o anfitrião da célula." e o teste confere a recusa `would_leave_scope` pela API). Os outros dois são os do PR 1: `sign-in.spec.ts:416` (passou isolado) e `excluidos-membros.spec.ts:612` (depende do tamanho da massa local). Smoke de login verde. As massas de 7 arquivos do E2E ganharam as três pessoas.
- Revisão: sem a ferramenta de acionar agentes nesta execução; o `architect` implementou o banco, o ajuste mínimo do front e os testes, e revisou o próprio diff. Não houve `code-reviewer` nem `qa` independentes.

| RN | Testes | Resultado |
|---|---|---|
| RN-01 | CR (service role e `postgres` recebem `timothy_required`; em `replica` os `NOT NULL` e os `CHECK`s valem, o trigger não; pessoa excluída em `cell_rule_violations`; Caio sem "Editar Célula": 0 linhas; sem "Criar Célula": 42501) | ✅ |
| RN-02, RN-03, RN-04 | CR (sem líder, timóteo ou anfitrião, inclusive Macrocélula, com código, campo e mensagem; André nos três papéis; duas células iguais; Beatriz e Fábio aceitos; Bruno `deleted_member_chosen`; Diego `person_not_visible`; Pedro muda só o horário com Beatriz anfitriã); `CellForm` | ✅ |
| RN-05, RN-06, RN-07, DA-1, DA-8, DA-12 | CR e CS (os casos do JSON); sync do Vitest com a migration e com `weekdays.ts`/`cell-types.ts` | ✅ |
| RN-11, DA-2 | CR (`cell_new_inactive`; nulo vira ativa; inativar e reativar na edição); `CellForm` (sem "Célula Ativa" no cadastro) | ✅ |
| RN-13, DT-13 | MG (guarda); CR (`cell_rule_violations()` vazia no fim) | ✅ |
| RN-14 | CR (ordem dos triggers e das recusas: excluído antes de vazio, escopo antes de regra, pessoas < tipo < dia < horário < situação) | ✅ |
| DA-3 | CR (na célula excluída, o `CHECK` recusa) | ✅ |

**PRs 3 a 5 (2026-11-26, pista local A, banco zerado com as migrations dos PRs 1 e 2; branch `feat/E2.08-pr3-5-telas-celula`, só front):**
- Vitest 1930/1930 (novos: `address/cep`, `time/hhmm` sobre a tabela de casos, `cells/{codes,validation,situation,changes,host-address,write}`, `members/labels`, `CepField` com o bloco de endereço do membro, `CellForm` refeito com 28 casos da UX e os 2 da T8 no `CellReportForm`). `tsc` e `build` verdes; `lint` só com os 3 erros que já existem na `main`.
- Playwright (suíte inteira, `--workers=1`): 360 passaram, 8 pulados, 1 falhou: `excluidos-membros.spec.ts:612` (UX-19, "página 2" em `/cells`), o mesmo dos PRs 1 e 2, que depende do tamanho da massa local. Novos: `celulas-inativa.spec.ts` (5) e `celulas-cadastro.spec.ts` (15, com o axe nos dois temas). Os specs do E2.01 e do E2.02 seguem os rótulos novos; o UX-24 do E2.02 confere que os três seletores não têm "Limpar". Smoke de login verde.
- pgTAP inteiro: 45 arquivos, 4320 testes. Na primeira rodada, o `e203_02_policy` parou por tempo (`sign_in_attempt: tempo-limite excedido`, o teto de 5 s por comando com a máquina carregada pela pista B); rodado de novo sozinho, 119/119. Este PR não muda o banco: concorrência e volume são os dos PRs 1 e 2.
- Revisão: sem a ferramenta de acionar agentes nesta execução; o `architect` implementou, testou e revisou o próprio diff. Não houve `code-reviewer`, `qa` nem `ux-designer` independentes.
- A gravação de célula desiste em 20 s (o mesmo tempo do cadastro de membro): sem isso, uma requisição que nunca volta deixava "Criando…" para sempre. A nova tentativa é segura (DT-09).

| Critério | Testes | Resultado |
|---|---|---|
| RN-09, UX-18 (CEP comum, DA-11) | `cep.test`, `CepField.test` (máscara, 8º dígito, só a última busca, 8 s, avisos sem bloquear, CEP do anfitrião sem busca, complemento do membro intacto) | ✅ |
| RN-11 (c), UX-21 a UX-23 | `celulas-inativa` (lista 1280 e 360, seletor do relatório, recusa pela lista e por Relatórios, atalho do Dashboard de Carla); `CellReportForm.test` (T8) | ✅ |
| RN-02 a RN-07, RN-14, UX-02 a UX-12 | `CellForm.test`, `validation`, `codes` (pendência do PR 2: tipo, dia e horário inválidos no campo e célula nova inativa no topo, em pt-BR); `celulas-cadastro` (UX-06, UX-07, UX-10, RN-06) | ✅ |
| RN-10, UX-13 a UX-17 | `host-address`, `CellForm.test` (respostas fora de ordem, falha e "Tentar de novo"); `celulas-cadastro` (Rita, Pedro, Gabriel, troca Carla → Fábio) | ✅ |
| RN-11 (P60), UX-19, UX-20, UX-24, UX-25 | `situation`, `changes`, `CellForm.test`, `CellForm.saving.test`; `celulas-cadastro` (linha de 44 px, queda de conexão com uma célula só) | ✅ |
| UX-01, UX-26 a UX-28 | `celulas-cadastro` (360×800, 320 px com fonte a 200%, 1280×800, axe claro e escuro) | ✅ |
| UX-29 (leitor de tela) | nomes e `aria-describedby` nos testes de componente; leitor de tela de verdade não usado | 🟡 |
