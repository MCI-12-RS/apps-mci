# E2.06: Hierarquia e totais

> Status: Negócio, Experiência (UX), Solução técnica e Tarefas prontos. Negócio escrito em 2026-11-23 pelo `product-owner`, sem regras "a confirmar". Experiência (UX) escrita no mesmo dia pelo `ux-designer`; as pendências PO-UX-1 a PO-UX-11 foram resolvidas pelo PO no mesmo dia (P-HIE-15 a P-HIE-25). Solução técnica e Tarefas escritas em 2026-11-24 pelo `architect`, só como desenho, com as respostas às AQ-1 a AQ-7 e as decisões DA-1 a DA-6. Ficam para o usuário revisar no PR os padrões P-HIE-01 a P-HIE-25, as decisões DA-1 a DA-6 e as perguntas Q-1 a Q-3, que não bloqueiam (o custo de cada alternativa está na Solução técnica). **PR 1 (banco) em produção em 2026-11-25** (mci-connect#39, squash `af327ef`, "Deploy: banco"; conferências de antes e de depois sem parada: drift 0, saneamento vazio, privilégios ok); ver [Resultado da tarefa 1 e do PR 1](#resultado-da-tarefa-1-e-do-pr-1). PRs 2 a 4 (front) pendentes, num PR só (regra de juntar PRs de front, 2026-11-25).
> Slug: `e2-06-hierarquia-totais` · Paridade com o legado: sim (HIE-02 a HIE-04 e os totais do casal da MIN-01). A HIE-01 (ciclos) foi para o E2.04. Tem regras novas: consistência na mesma operação, sem limite de profundidade, totais do casal sem dupla contagem e divisão das células pelo sexo do líder.

## Negócio
_Seção do `product-owner`. Escrita em 2026-11-23 a partir destas fontes:_
- _seção 3.3 (HIE), decisão D2, passos 5.5 e 5.6 e linha do E2.06 na seção Progresso do [`docs/migracao.md`](../migracao.md);_
- _legado: `MemberService.UpdateComputedValues`, `MemberChangedHandler`, `CellChangedHandler`, filtros de `QueryingExtensions.cs` e as telas de Membros, Células, Relatórios e Ministérios;_
- _novo (`mci-connect`, `origin/main`, `fdcbe50`): `compute_g12_level`, `refresh_member_stats_v2` (versão do E2.01), `get_ministry_root`, `ministry_tree_nodes`, `dashboard_g12_ranking` e as telas de Membros, Células e Ministérios;_
- _specs fechados: [E2.02](e2-02-perfis-escopo.md) (Termos, RN-01, RN-08, RN-23, DT-01, DT-25, DA-6), [E2.04](e2-04-validacoes-membro.md) (RN-03, RN-11, RN-13 e a trava da árvore), [E2.01](e2-01-exclusao-logica.md) (RN-06, RN-10, RN-16, DT-24) e [E1.08](e1-08-paginacao-servidor.md) (RN-06, PR 2, PR 3 e o limite do PR 4)._

### Contexto e objetivo
No legado, cada membro guarda campos calculados a partir da cadeia de líderes dele:
- o nível ministerial (`MinistryLevel` = 12 elevado ao número de líderes acima; 1 = Pastores, 12 = G12, 144, 1728…; 9999999 = "Não tem liderança");
- o líder direto, o G12 (o 2º nome da cadeia) e o caminho da liderança, em nomes ("Pastor / G12 / … / líder") e em ids;
- o total de discípulos (toda a descendência) e o total de células (lideradas pela pessoa ou por qualquer um abaixo dela).

Esses campos são recalculados quando o membro é salvo e propagados por eventos, depois da gravação: a descendência inteira quando muda o líder ou o nome, e os totais de até 5 ancestrais. A cadeia guarda no máximo 6 líderes. O legado mostra esses campos:
- na lista de Membros: as colunas Nível ("Pastores", "G12", 144…), Liderança ("G12 / líder") e Ministério ("N Discípulos", "N Células");
- nos filtros de Membros: "Liderança" (parte do nome de qualquer líder da cadeia) e "Nível Ministerial" (Pastores, G12, 144, 1728 e 20736);
- na lista de Células: o nível do líder e o G12;
- nos relatórios e na exportação: o G12;
- na árvore de Ministérios: os totais de cada casal, somando os dois cônjuges. O link dessa tela estava fora do menu.

Hoje o novo (conferido na `origin/main` do `mci-connect`, `fdcbe50`, em 2026-11-23):
- **Nível (`g12_level`).** É a profundidade: pastor 0, G12 1, 144 2… Mas:
  - é calculado só na linha que muda (`compute_g12_level`). Os descendentes ficam com o nível antigo quando o líder de alguém muda;
  - quem está sem liderança fica com 0, igual a pastor. Por isso, a célula de quem está sem liderança aparece com o G12 "Pastores";
  - os rótulos são "Pastor(a)", "12", "144", "1.728" e "Nível N" a partir do 4.
- **G12.** A lista de Células calcula o G12 pela árvore (E2.02, DT-25) ou pelo nível guardado (antes do E2.02). A lista de Membros mostra só o líder direto. O ranking "Células por G12" do Dashboard usa o nível 1, que fica errado quando um G12 muda de lugar.
- **Totais.** `refresh_member_stats_v2` recalcula os ancestrais na mesma operação, já sem inativos (D2) e sem excluídos (E2.01). Mas:
  - a célula de líder sem sexo fica fora do total;
  - mudar o sexo de quem lidera células não refaz a divisão entre células masculinas e femininas.
- **Árvore de Ministérios.** Cada nó mostra só os discípulos diretos e o nível. Os totais do casal existem na função (`ministry_tree_nodes`), mas somam em dobro quando um cônjuge está abaixo de um discípulo do outro (limite registrado no PR 4 do E1.08). Nesse caso, a árvore também volta ao mesmo casal quando se abre o ramo do cônjuge de baixo.

Objetivo do passo:
- definir o nível de cada situação de liderança, inclusive de quem está sem liderança;
- propagar o nível, a cadeia e o G12 para toda a descendência quando a árvore muda, na mesma operação;
- fechar as regras dos totais por pessoa (D2, exclusão lógica e sexo do líder) e dos totais do casal;
- devolver à lista de Membros o nível e a liderança ("G12 / líder") do legado, e à árvore de Ministérios os totais do casal;
- deixar definidos o nível, a cadeia e o G12 que os filtros e as telas dos passos seguintes usam.

### Termos
- **Topo da árvore:** quem não tem líder: os pastores e quem está sem liderança (Termos do E2.02).
- **Situação de liderança:** pastor(a), com líder ou sem liderança (RN-11 do E2.04).
- **Cadeia de liderança:** os líderes acima de alguém, do topo ao líder direto.
- **Descendência:** todas as pessoas abaixo de alguém, em todos os níveis. "Discípulos em todos os níveis" é o mesmo que descendência.
- **Nível ministerial (nível):** a posição da pessoa na árvore, contada a partir do topo (RN-01).
- **G12 de uma pessoa:** na cadeia dela, quem está logo abaixo do topo. Quem está logo abaixo do topo é o próprio G12. Quem está no topo não tem G12 (Termos do E2.02).
- **Totais da pessoa:** o total de discípulos (RN-05) e o total de células (RN-06), com a divisão em células masculinas e femininas.
- **Totais do casal:** os totais de um nó da árvore de Ministérios (RN-09).
- **Ativo, inativo e excluído:** "Situação: Ativo/Inativo" do cadastro; excluído segue o E2.01.
- **Na mesma operação:** a gravação e todos os recálculos que ela provoca acontecem juntos. Quando a tela confirma a gravação, tudo já mudou.
- **Volume de referência:** 20 mil membros, 1.500 células, 100 mil relatórios (E1.08).

### Personas e permissões
Este passo não cria permissão. Os valores aparecem para quem vê o membro ou a célula (E2.02) e mudam pelas gravações que cada um já pode fazer.

| Persona | Quem é (na massa) | Permissões | O que faz neste spec |
|---|---|---|---|
| IG Quem vê a igreja toda | Rita, função Administrador | "Visualizar Toda a Igreja", "Editar Membro", "Editar Célula" | vê nível, liderança e totais de todos; é a única que marca pastor ou sem liderança (RN-10 do E2.02); troca líderes e células, o que provoca os recálculos |
| LI Líder | Pedro, função Líder | "Visualizar Seu Ministério", "Editar Membro", "Editar Célula" | vê e altera só o escopo dele; troca líderes dentro do escopo (RN-09 do E2.02) |
| OM Líder de outro ministério | Diego, função Líder | as mesmas de LI | não vê nível, liderança nem totais de quem está fora do escopo dele |
| MB Membro | Caio, função Membro | "Visualizar Seu Ministério" | só consulta |
| SF Sem função | Hugo | nenhuma | vê só o próprio cadastro, com o nível e os totais dele |
| SI Sistema e carga | gatilhos do banco, service role, recálculo da carga (E4.07) | — | calcula os valores; ninguém os grava à mão (RN-12) |

### Histórias
- Como líder, quero ver na lista de Membros o nível e a liderança de cada pessoa (G12 e líder), para saber em que geração e em que ministério cada discípulo está.
- Como liderança, quero que, ao trocar o líder de alguém, o nível, o G12 e os totais dessa pessoa e de toda a descendência dela mudem na hora, para que listas, filtros e Dashboard não mostrem dados velhos.
- Como líder, quero que o total de discípulos e de células conte só quem está ativo (D2), para medir o crescimento real do ministério.
- Como pastor, quero ver na árvore de Ministérios quantos discípulos e quantas células há abaixo de cada casal, sem ninguém contado duas vezes.
- Como líder, quero ver o G12 de cada célula, para saber a que ministério ela pertence.
- Como igreja, quero migrar do legado com níveis e totais recalculados e comparáveis com os do legado.

### Decisões

#### Decisões do usuário e de passos anteriores
| Decisão | O que vale aqui | Onde |
|---|---|---|
| D2 (2026-11-23) | Os totais não contam inativos. | RN-05, RN-06, RN-09 |
| D1 e RN-10 do E2.01 (DT-24) | Os totais ignoram membros e células excluídos e mudam na mesma operação da exclusão e da restauração. A restauração recalcula o nível (RN-16 a do E2.01). | RN-03, RN-05, RN-06 |
| D9 (2026-11-23) | Os pastores são Samuel Colares e Magda Colares. | RN-01, RN-13 |
| Termos, RN-01, RN-08, DT-01 e DT-25 do E2.02 | O G12 é quem está logo abaixo do topo, e o topo inclui quem está sem liderança. O escopo segue a árvore atual e não depende do nível guardado. O G12 das células vem da árvore real. | RN-04, RN-11 |
| DA-6 do E2.02 | A árvore de Ministérios começa no topo do escopo de quem consulta. | RN-09 |
| RN-03, RN-11 e RN-13 do E2.04 | Sexo sempre M ou F; as três situações de liderança; sem ciclos, com uma trava única da árvore para as trocas de líder. | RN-01, RN-06, RN-08 |
| RN-06 do E1.08 | Numa linha visível, os nomes de referência aparecem mesmo para pessoas fora do escopo. | RN-10, RN-11 |
| Regra 3 do E1.03 | As colunas calculadas são do servidor. | RN-12 |

#### Padrões definidos por este spec (revisar no PR)
Pontos que as fontes não respondem. O PO adotou a opção mais conservadora e coerente com o legado, com a D2 e com os specs anteriores. Nas regras, aparecem como "definida pelo spec". O usuário pode mudar qualquer um na revisão do PR.

- **P-HIE-01, sem liderança não tem nível** (RN-01). Hoje o novo grava 0, igual a pastor. O legado usava um valor próprio (9999999) e mostrava "-" na coluna Nível.
- **P-HIE-02, abaixo de quem está sem liderança** (RN-01).
  - O nível conta a partir dessa pessoa: o discípulo direto dela fica no nível 1 (G12).
  - É o que o legado e o novo fazem hoje. É coerente com o G12 do E2.02 (logo abaixo do topo) e com a conferência `12 ^ g12_level = MinistryLevel` da 5.6.
  - Consequência: essa pessoa aparece como G12 na lista, no filtro por nível e no ranking "Células por G12".
  - O saneamento (E4.04) lista quem está sem liderança e tem discípulos, para a liderança corrigir. A alternativa (essa descendência sem nível) está na pergunta Q-1.
- **P-HIE-03, rótulos do nível** (RN-02). "G12" no lugar de "12" e "20.736" no lugar de "Nível 4", como no legado. "Pastor" ou "Pastora" na pessoa, e "Pastores" no casal e no filtro. A partir do nível 5, "Nível 5", "Nível 6"…
- **P-HIE-04, sem limite de profundidade** (RN-01, RN-07). O legado guardava até 6 líderes na cadeia e atualizava os totais de até 5 ancestrais.
- **P-HIE-05, na mesma operação** (RN-08), com metas de tempo. No legado, o recálculo vinha depois da gravação, por eventos.
- **P-HIE-06, a contagem passa pelo inativo** (RN-05). O inativo não conta, mas os discípulos ativos dele contam para todos acima. Sem isso, inativar um líder esconderia dos totais acima toda a descendência ativa dele. O novo já conta assim.
- **P-HIE-07, a célula conta pela própria situação** (RN-06), e não pela do líder. O novo já conta assim.
- **P-HIE-08, sexo do líder da célula** (RN-06, RN-07). A célula de líder sem sexo registrado conta no total, em nenhuma das duas divisões. Mudar o sexo de quem lidera células refaz a divisão. Com a RN-03 do E2.04, o caso do sexo vazio deixa de existir.
- **P-HIE-09, casal na árvore** (RN-09).
  - Ninguém é contado duas vezes, nem com um cônjuge abaixo do outro.
  - Só contam os integrantes exibidos no nó.
  - O casal com um cônjuge abaixo do outro não se repete na árvore.
  - Corrige o limite registrado no PR 4 do E1.08.
- **P-HIE-10, caminho em texto** (RN-04). Não aparece em nenhuma tela, como no legado, que só o usava no filtro. O filtro de liderança do E2.07 usa a cadeia.
- **P-HIE-11, liderança na lista de Membros** (RN-10). Volta a mostrar o G12 e o líder, como no legado. O G12 do membro passa a ser nome de referência (extensão da RN-06 do E1.08).
- **P-HIE-12, totais no nó da árvore** (RN-09).
  - O nó mostra o total de discípulos e de células do casal.
  - Não há divisão dos discípulos por sexo. O legado dividia por cônjuge ("3 homens e 5 mulheres"); ver a pergunta Q-2.
  - Hoje o nó mostra só os discípulos diretos.
- **P-HIE-13, nível de quem está excluído** (RN-03). Não acompanha a árvore enquanto a pessoa está excluída e é recalculado na restauração.
- **P-HIE-14, reconciliação dos totais** (RN-13). Os totais são comparados com os recalculados a partir da árvore do legado, e não com os guardados nele.
- **Vindos do desenho de UX (2026-11-23, PO-UX-1 a PO-UX-11 em "Experiência (UX)"):**
  - **P-HIE-15, liderança no cartão** (PO-UX-1, RN-10). No cartão do celular, a linha "Liderança" só aparece para quem tem líder; para pastor e para quem está sem liderança, o rótulo do nível já diz tudo. A tabela mostra "—" e "Sem liderança".
  - **P-HIE-16, cônjuge abaixo do outro como referência** (PO-UX-2, RN-09). Embaixo do próprio líder, o cônjuge de baixo aparece só como referência: nome e nível, sem totais, sem abrir e com o caminho até o casal. Quando o casal não está na árvore de quem consulta, a pessoa aparece como um nó comum, na própria posição.
  - **P-HIE-17, nível da posição no nó** (PO-UX-3, RN-02, RN-09). O nó mostra o nível de quem liga o nó ao nó de cima; nas raízes, o do integrante principal. "Pastores" só quando os dois integrantes são pastores.
  - **P-HIE-18, aviso sobre os inativos na árvore** (PO-UX-4, RN-09). O texto de ajuda da árvore diz que os totais incluem os discípulos de pessoas inativas, que não aparecem nela, até o E2.15 decidir como mostrá-los.
  - **P-HIE-19, totais sempre à vista** (PO-UX-5, RN-09, RN-10). Os totais aparecem também com zero ("0 discípulos · 0 células"), na lista e na árvore, como no legado.
  - **P-HIE-20, "Situação" no lugar de "Status"** (PO-UX-6). No título da coluna das tabelas de Membros e de Células, como nos Termos e no filtro do legado.
  - **P-HIE-21, "Sem liderança" como aviso** (PO-UX-7, RN-02). O rótulo tem a aparência de aviso, com ícone e texto, porque é uma situação que a liderança corrige (E4.04).
  - **P-HIE-22, gravação demorada** (PO-UX-8, RN-08). O formulário não fecha durante o envio e avisa quando a gravação passa de 3 s.
  - **P-HIE-23, G12 da célula com um nome só** (PO-UX-9, RN-11). Nunca o casal. Os wireframes da T1 do E2.01 e da T7 do E2.02 ganharam uma nota apontando para este spec.
  - **P-HIE-24, quem não tem função** (PO-UX-10, RN-10). Não vê o próprio nível nem os próprios totais em nenhuma tela, só pela API. Um resumo em "Meus dados" fica como sugestão, fora deste passo.
  - **P-HIE-25, textos da UX** (PO-UX-11). Todos aceitos, sem ajuste. Os que estão ligados a uma regra foram copiados para os "Textos de tela" deste Negócio.

### Regras de negócio
Nenhuma regra está "a confirmar". Os caminhos do legado são relativos a `g12app-net/`, com as abreviações do E2.01: `App/` = `G12App.Application/`, `Domain/` = `G12App.Domain/`, `UI/` = `G12App.API/ClientApp/src/` e `Infra/` = `G12App.Infrastructure.Data/`. Os do novo são relativos a `mci-connect/`.

Correspondência com o plano: HIE-02 → RN-01 a RN-03 · HIE-03 → RN-04, RN-10 e RN-11 · HIE-04 → RN-05 a RN-08 · MIN-01 (totais do casal) → RN-09.

| ID | Regra | Origem |
|---|---|---|
| RN-01 | **Nível ministerial.** É a posição da pessoa na árvore, contada a partir do topo da cadeia dela:<br>- **Pastor(a):** nível 0.<br>- **Com líder:** o nível do líder mais 1. O discípulo direto dos pastores fica no nível 1 (G12), o discípulo de um G12 no nível 2 (144), e assim por diante.<br>- **Sem liderança** (sem líder e sem ser pastor): não tem nível. Não é o nível 0 dos pastores.<br>- **Abaixo de quem está sem liderança:** o nível conta a partir dessa pessoa. O discípulo direto dela fica no nível 1, como no legado.<br><br>Detalhes:<br>- A situação (ativo ou inativo) não muda o nível de ninguém. O inativo continua na cadeia, e os discípulos dele não mudam de nível por isso.<br>- Não há limite de profundidade.<br>- Correspondência com o legado: `MinistryLevel` = 12 elevado ao nível; "sem liderança" = 9999999. | HIE-02; legado (`App/Services/MemberService.cs:191-202` e `:229`: 12 elevado ao número de líderes acima; `:210-212`: "Não tem liderança" = 9999999; `UI/shared/utils.js:187-192`); D9; situações: RN-11 do E2.04; sem liderança sem nível: definida pelo spec (P-HIE-01), corrige a armadilha "sem líder fica com `g12_level = 0`, igual a pastor" do `CLAUDE.md`; abaixo de quem está sem liderança: legado (a mesma fórmula, `MemberService.cs:191-229`) e Termos do E2.02, definida pelo spec (P-HIE-02); sem limite: definida pelo spec (P-HIE-04), o legado parava em 6 líderes (`MemberService.cs:197-198`) |
| RN-02 | **Rótulos do nível.** Em todas as telas, o nível aparece assim:<br>- nível 0: "Pastor" (homem) ou "Pastora" (mulher); "Pastor(a)" sem sexo registrado. No nó em que os dois integrantes são pastores e no filtro: "Pastores". No nó com um pastor só: "Pastor" ou "Pastora";<br>- nível 1: "G12";<br>- nível 2: "144";<br>- nível 3: "1.728";<br>- nível 4: "20.736";<br>- nível 5 ou mais: "Nível 5", "Nível 6"…;<br>- sem nível: "Sem liderança", com aparência de aviso (ícone e texto). Não é um nível: no filtro, fica em "Possui liderança" (E2.07).<br><br>Nunca aparecem "12" sozinho, "Nível 0" nem "Pastores" para uma pessoa só. | legado (`UI/shared/utils.js:187-192`: "Pastores" e "G12"; `UI/pages/Members/index.js:208-216`: opções Pastores, G12, 144, 1728 e 20736; `:65`: "-" para quem não tem liderança); novo (`src/lib/ministries/tree.ts:24-31`); rótulos por sexo e "Nível N": definida pelo spec (P-HIE-03); nó com um pastor só: definida pelo spec (P-HIE-17); aparência de aviso: definida pelo spec (P-HIE-21) |
| RN-03 | **Propagação do nível.** Quando muda a situação de liderança de alguém (o líder, a marca de pastor ou a de sem liderança), o nível dele e o de toda a descendência dele são recalculados na mesma operação (RN-08): em qualquer profundidade, ativos e inativos.<br>- Trocar o líder por outro do mesmo nível não muda nível nenhum. Muda o G12 (RN-04) e os totais (RN-07) quando a pessoa passa para outro ramo.<br>- Passar de pastor para sem liderança, ou o contrário, muda só o nível da própria pessoa: a descendência continua contando a partir dela (RN-01).<br>- Ganhar ou perder o líder desloca toda a descendência.<br>- O nível de quem está excluído não acompanha a árvore. Na restauração, ele é recalculado com o líder que a pessoa tiver (RN-16 do E2.01). | HIE-02; legado (`App/EventHandlers/DomainEvents/MemberChangedHandler.cs:39-41` e `:106-139`: recalcula a descendência inteira quando muda o líder); RN-16 (a) do E2.01; RN-11 do E2.04; excluído: definida pelo spec (P-HIE-13) |
| RN-04 | **Cadeia de liderança e G12.**<br>- A cadeia de um membro são os líderes acima dele, do topo ao líder direto. Pastores e quem está sem liderança não têm cadeia.<br>- O G12 de um membro é, na cadeia dele, quem está logo abaixo do topo. Quem está logo abaixo do topo é o próprio G12. Pastores e quem está sem liderança não têm G12.<br>- A cadeia e o G12 seguem a árvore atual e mudam na mesma operação (RN-08), para quem mudou de lugar e para toda a descendência dele.<br>- O sistema responde na hora quem está acima de um membro e quem está abaixo de uma pessoa, em todos os níveis. É isso que alimenta a liderança na lista de Membros (RN-10), o G12 da célula (RN-11) e os filtros dos passos seguintes ([Definições](#definições-para-os-passos-seguintes)).<br>- O caminho em texto ("Samuel / Pedro / André") não aparece em nenhuma tela, como no legado. | HIE-03; legado (`App/Services/MemberService.cs:223-228`: líder direto, G12 como 2º nome da cadeia, caminho em nomes e em ids); Termos, RN-01 e DT-01 do E2.02; o G12 é ele mesmo: Termos do E2.02 e legado (`App/Services/ColumnFormatter.cs:15`: na exportação, a célula de um G12 mostra o próprio nome); caminho só no filtro: legado (`Domain/Extensions/QueryingExtensions.cs:64-65`); não exibir: definida pelo spec (P-HIE-10) |
| RN-05 | **Total de discípulos.** É o número de pessoas abaixo da pessoa, em todos os níveis, que estão ativas e não excluídas. Cada uma conta uma vez.<br>- A própria pessoa não conta. O cônjuge só conta se estiver abaixo dela (para o casal, ver a RN-09).<br>- O inativo não conta, mas a contagem passa por ele: os discípulos ativos de um inativo contam para todos acima.<br>- O excluído não conta (RN-10 do E2.01).<br>- Todos têm o total calculado, inclusive pastores, inativos e quem está sem liderança. | HIE-04; D2; DEL-02 e RN-10 do E2.01; legado (`App/EventHandlers/DomainEvents/MemberChangedHandler.cs:83-104` e `Domain/Extensions/QueryingExtensions.cs:94-95`: toda a descendência); contagem passa pelo inativo: definida pelo spec (P-HIE-06), como o novo já faz (`refresh_member_stats_v2`) |
| RN-06 | **Total de células.** É o número de células ativas e não excluídas lideradas pela pessoa ou por qualquer pessoa abaixo dela, em todos os níveis. Cada célula conta uma vez.<br>- Só o líder da célula conta. Ser timóteo ou anfitrião não leva a célula para o total.<br>- Vale a situação da célula: a célula ativa conta mesmo que o líder esteja inativo, e a inativa não conta mesmo que o líder esteja ativo.<br>- O total é dividido pelo sexo do líder de cada célula: **células masculinas** (líder homem) e **células femininas** (líder mulher). Com o sexo sempre registrado (RN-03 do E2.04), o total é a soma das duas.<br>- Enquanto existir líder sem sexo registrado, a célula dele conta no total e em nenhuma das duas divisões. | HIE-04; D2; RN-10 do E2.01; legado (`App/EventHandlers/DomainEvents/CellChangedHandler.cs:42-63` e `Domain/Extensions/QueryingExtensions.cs:223-225`: células lideradas pela pessoa ou por qualquer um abaixo); divisão por sexo: novo (`male_cells` e `female_cells`, usados no ranking G12 do PR 3 do E1.08); situação da célula: definida pelo spec (P-HIE-07); sexo vazio: definida pelo spec (P-HIE-08), corrige a armadilha "células de líder sem gênero ficam fora de `total_cells`" do `CLAUDE.md` |
| RN-07 | **O que muda os totais.** Os totais mudam para a pessoa e para todos acima dela, em qualquer profundidade, quando:<br>- um membro é cadastrado, troca de líder, fica ativo ou inativo, é excluído ou restaurado. Quando muda de lugar, mudam os de cima antigos e os de cima novos;<br>- muda o sexo de um membro que lidera células. Só a divisão entre masculinas e femininas muda;<br>- uma célula é cadastrada, troca de líder, fica ativa ou inativa, é excluída ou restaurada.<br><br>Nada mais muda os totais. Por exemplo, trocar o timóteo, o anfitrião, o dia, o horário, o endereço ou o tipo da célula, ou o nome, o cônjuge ou o batismo do membro, não muda total nenhum. | legado (`MemberChangedHandler.cs:43-57` e `CellChangedHandler.cs:32-39`: troca de líder do membro ou da célula, com o recálculo de até 5 ancestrais, `:63` e `:86`); RN-10 do E2.01; sexo: definida pelo spec (P-HIE-08); qualquer profundidade: definida pelo spec (P-HIE-04) |
| RN-08 | **Na mesma operação.**<br>- Nível, cadeia, G12 e totais mudam na mesma operação da gravação que os afeta. Quando a tela confirma a gravação, a próxima consulta já mostra os valores novos em todas as telas: Membros, Células, Ministérios e Dashboard. Não há atraso aceitável depois da confirmação, e nenhuma tela mostra o valor anterior, nem a partir do que já tinha carregado.<br>- **Durante a gravação,** o formulário continua aberto até a resposta e não pode ser fechado. Se a gravação passa de 3 s, a tela avisa que ainda está salvando. Ninguém fica sem saber se a gravação valeu.<br>- **Tudo ou nada.** Se qualquer recálculo falhar, a gravação inteira é desfeita. A mensagem pede para tentar de novo, no próprio formulário, com os dados mantidos. Nunca aparece mensagem técnica.<br>- **Gravações simultâneas,** inclusive na mesma parte da árvore, terminam com os mesmos valores que um recálculo do zero daria. Nenhuma alteração se perde.<br>- **Tempo,** no volume de referência:<br>  - até 1 s numa gravação comum: um membro com até 100 pessoas abaixo dele, ou uma célula;<br>  - até 3 s para trocar o líder de um G12 com 2 mil pessoas abaixo dele;<br>  - uma mudança que desloca a árvore inteira (tirar a marca de pastor e dar um líder) é rara e pode levar mais, desde que termine com os valores certos. | definida pelo spec (P-HIE-05); formulário aberto e aviso aos 3 s: definida pelo spec (P-HIE-22); coerente com a RN-10 e a RN-20 do E2.01 ("na mesma operação", "tudo ou nada"), a RN-08 do E2.02 (efeito na ação seguinte) e a RN-13 do E2.04 (trava da árvore); meta de 1 s: risco 4 do E2.01 e risco 6 do E2.04; no legado, o recálculo vinha depois da gravação, por eventos (`G12App.Infrastructure.Events`) |
| RN-09 | **Casal na árvore de Ministérios.** Cada nó é um casal, ou uma pessoa só, e mostra os totais do nó:<br>- **Discípulos do nó:** as pessoas ativas e não excluídas abaixo de qualquer integrante do nó, em todos os níveis, cada uma uma vez. Os integrantes do nó não contam, mesmo quando um está abaixo do outro.<br>- **Células do nó:** as células ativas e não excluídas lideradas por um integrante do nó ou por qualquer pessoa abaixo deles, cada uma uma vez.<br><br>Detalhes:<br>- Vale quando os cônjuges estão em ramos diferentes (a soma dos dois) e quando um está abaixo do outro, direta ou indiretamente (sem contar ninguém duas vezes).<br>- Só contam os integrantes exibidos no nó. O cônjuge inativo, ou que quem consulta não vê, não aparece no nó (PR 4 do E1.08) e não entra nos totais.<br>- **Cônjuge abaixo do outro.** Na árvore de quem consulta, o casal aparece só na posição do cônjuge mais próximo do topo: abrir o ramo do cônjuge de baixo não leva de novo ao mesmo casal.<br>  - Embaixo do próprio líder, o cônjuge de baixo aparece só como referência: o nome, o nível e a indicação de que ele aparece com o cônjuge mais acima, com um atalho até o casal. A referência não tem totais e não abre. Os discípulos dele aparecem sob o nó do casal.<br>  - Ele continua contando como discípulo direto do próprio líder e nos totais desse líder.<br>  - Quando o cônjuge de cima não está na árvore de quem consulta (inativo, invisível ou acima da raiz do escopo), o cônjuge de baixo aparece como um nó comum, na própria posição.<br>- O casal de ramos diferentes continua aparecendo sob o líder de cada um, como hoje.<br>- **O que o nó mostra:** o nível da posição (RN-02), que é o de quem liga o nó ao nó de cima (nas raízes, o do integrante principal), e os dois totais. Os totais aparecem sempre, inclusive com zero. Não há divisão dos discípulos por sexo.<br>- **Inativos:** a tela avisa que os totais incluem os discípulos ativos de pessoas inativas, que não aparecem na árvore (MIN-03).<br>- Na lista de Membros, os totais continuam sendo os da pessoa (RN-05, RN-06). | MIN-01; legado (`UI/pages/Ministries/index.js:113-141`: soma dos dois cônjuges, com "0 discípulos"; `Infra/Repositories/MemberRepository.cs:121-198`); PR 4 do E1.08 (cônjuge invisível ou inativo fora do nó; limite do aninhamento indireto); sem dupla contagem, posição única e totais no nó: definida pelo spec (P-HIE-09, P-HIE-12); referência: P-HIE-16; nível da posição: P-HIE-17; aviso dos inativos: P-HIE-18; zero à vista: P-HIE-19 |
| RN-10 | **Lista de Membros.** Para cada membro visível, a lista mostra, no celular e no computador:<br>- o **nível**, com o rótulo da RN-02;<br>- a **liderança**, com o G12 e o líder direto, sem repetir nome e sem a própria pessoa:<br>  - pastor: "—";<br>  - G12: o líder direto (o pastor ou a pessoa sem liderança acima dele);<br>  - quando o líder direto é o G12: só esse nome;<br>  - nos demais casos: "G12 / líder direto";<br>  - sem liderança: "Sem liderança";<br>- os **totais** da pessoa: discípulos (RN-05) e células (RN-06), sempre à vista, inclusive com zero.<br><br>Detalhes:<br>- No cartão do celular, a linha da liderança só aparece para quem tem líder. Para pastor e para quem está sem liderança, o rótulo do nível já diz a situação. A tabela mostra "—" e "Sem liderança".<br>- O G12 e o líder são nomes de referência: aparecem mesmo que essas pessoas estejam fora do escopo de quem consulta, só o nome e sem link. A RN-06 do E1.08 passa a incluir "o G12 do membro".<br>- Quem não vê o membro não vê nada dele (E2.02). Quem não tem função não tem a lista de Membros: vê o próprio nível, a liderança e os totais só pela API. | HIE-03; legado (`UI/pages/Members/index.js:41-48`: liderança por nível; `:62-80`: colunas Nível, Liderança e Ministério, com "0 Discípulos"); RN-06 do E1.08, estendida: definida pelo spec (P-HIE-11); RN-23 do E2.02; cartão: P-HIE-15; zero à vista: P-HIE-19; sem função: P-HIE-24 |
| RN-11 | **G12 da célula.** É o G12 do líder da célula (RN-04), pelo valor atual:<br>- líder G12: o próprio líder;<br>- líder pastor: "Pastores";<br>- líder sem liderança: "—";<br>- nos demais casos: o nome do G12.<br><br>É sempre um nome só, e nunca o casal: o G12 da célula de André é "Pedro", e não "Pedro e Paula".<br><br>Aparece na lista de Células, como hoje, junto com o nível do líder entre parênteses (RN-02), como no legado: "André (144)". Acompanha na hora as mudanças da árvore (RN-08). É nome de referência (RN-06 do E1.08). | HIE-03; legado (`UI/pages/Cells/index.js:52-53`: nível do líder e G12, um nome; `App/Services/ColumnFormatter.cs:15`); PR 2 do E1.08 ("Pastores" para líder pastor); DT-25 do E2.02; "—" para líder sem liderança: consequência da RN-01 (P-HIE-01); um nome só: P-HIE-23 |
| RN-12 | **Só o sistema calcula.** Nível, cadeia, G12 e totais são calculados pelo sistema. Ninguém os grava pela tela ou pela API, nem o Administrador: o valor enviado é ignorado, e o calculado continua valendo. | regra 3 do E1.03 (colunas calculadas do servidor); legado (campos calculados só pelo `MemberService` e pelos handlers) |
| RN-13 | **Carga do legado.**<br>- Depois da carga (E4.06), o recálculo (E4.07) usa as mesmas regras deste spec e chega aos mesmos valores que as gravações dariam.<br>- Uma carga sem recálculo não é aceita: os totais de células masculinas e femininas não podem ficar todos zerados.<br><br>A reconciliação (E4.09) compara com o legado assim:<br>- **Nível:** 12 elevado ao nível = `MinistryLevel` para quem tem líder no novo; "sem liderança" no novo = 9999999 no legado. Quem está a mais de 6 níveis do topo é comparado com 12 elevado a 6, o máximo que o legado guarda.<br>- **Diferenças esperadas, listadas:** os membros sem líder e sem "Não tem liderança" que não são os pastores da D9. No legado, eles aparecem como "Pastores"; no novo, ficam sem liderança se não forem corrigidos no E4.05.<br>- **Totais:** comparados com os valores recalculados a partir do líder de cada membro no legado, sem inativos (D2) e sem excluídos. Os totais guardados no legado não servem de base, porque ele os atualiza por evento e só até 5 ancestrais. | 5.5 (passo 6) e 5.6 do `docs/migracao.md`; E4.07, E4.09; D2, D9; legado (`MemberService.cs:197-198`: até 6 líderes; `MemberChangedHandler.cs:63` e `:86`: até 5 ancestrais); comparação com os recalculados: definida pelo spec (P-HIE-14) |

### Definições para os passos seguintes
Não são regras deste passo. São os significados que os passos seguintes usam, para que nível, cadeia e G12 queiram dizer a mesma coisa em todo o sistema.
- **Filtro por nível (E2.07, MEM-13):** os valores são os da RN-02 ("Pastores" é o nível 0). Quem está sem liderança não entra em nenhum nível; o filtro "Possui liderança" usa as três situações da RN-11 do E2.04.
- **Filtro de liderança em qualquer nível (E2.07, MEM-13):** traz os membros abaixo de uma pessoa, em qualquer nível, sem a própria pessoa, como no legado (`Domain/Extensions/QueryingExtensions.cs:64-65`). O legado aceitava parte do nome de qualquer líder da cadeia. Recomendação do PO: escolher a pessoa num seletor, entre as visíveis (E2.02), para não trazer homônimos. O E2.07 decide.
- **"Sem vínculo celular" (MEM-14, E2.07):** o legado exige também total de células zero (`QueryingExtensions.cs`, `CellLink.None`). Esse total é o da RN-06.
- **Ordem padrão da lista de Membros:** no legado, por nível (`UI/pages/Members/index.js:39`). O E2.07 decide.
- **G12 nas células e nos relatórios:**
  - filtro de células (CEL-06, E2.10): RN-04 e RN-11;
  - formulário de relatório (REL-15, E2.11) e filtro de relatórios (REL-13, E2.12): o G12 atual do líder registrado no relatório (REL-09), como no legado (`UI/pages/Report/index.js:50` e `UI/pages/Report/details.js:267`). O relatório não guarda o G12, então um relatório antigo mostra o G12 de hoje do líder daquela data;
  - exportação (REL-14, E2.13): o legado mostra o nome do próprio líder quando a célula é de um G12 ou de um pastor, e ordena por G12 (`App/Services/ColumnFormatter.cs:15`, `App/Services/ExportService.cs:40`).
- **Ranking "Células por G12" (E2.14):** os casais com integrante no nível 1, com as células masculinas e femininas da RN-06. Com a RN-08, ele acompanha na hora as trocas de líder e as mudanças de sexo. Pela P-HIE-02, inclui quem está logo abaixo de alguém sem liderança.

### Critérios de aceite
Convenções:
- "Pela API" é qualquer chamada feita fora da tela, com a sessão do usuário citado.
- "Na hora" quer dizer: na primeira consulta depois de a tela confirmar a gravação (RN-08).
- Nenhuma regra deste spec depende da data: a virada de semana não muda nível, cadeia, G12 nem totais.
- Cada critério parte da massa original. Os totais aparecem como "discípulos / células", e as células como "(masculinas/femininas)".

#### Massa de exemplo
A árvore é a do E2.02, com dois casais a mais para os casos de aninhamento.

- **Árvore** (líder → discípulos):
  - Samuel (M) e Magda (F), casados, pastores (D9).
  - Pedro (M), discípulo de Samuel, e Paula (F), discípula de Magda, casados.
  - Tiago (M), discípulo de Samuel, e Tânia (F), discípula de Magda, casados.
  - André (M), discípulo de Pedro, casado com Beatriz (F), discípula de Tânia.
  - Caio (M) e Fábio (M, **inativo**), discípulos de André. Gabriel (M), discípulo de Fábio.
  - Carla (F), discípula de Paula. Débora (F), discípula de Beatriz. Rita (F), discípula de Tânia.
  - Diego (M) e Hugo (M), discípulos de Tiago.
  - **Aninhamento indireto:** Lauro (M), discípulo de Diego; Olga (F), discípula de Lauro e casada com Diego; Sônia (F), discípula de Olga.
  - **Aninhamento direto:** Vânia (F), discípula de Hugo e casada com ele; Zélia (F), discípula de Vânia.
  - Ester (F), **sem liderança**. Lúcia (F), discípula de Ester.
  - Os dois aninhamentos são raros na Visão G12, que discipula por sexo, mas existem nos dados.
- **Células** (todas com timóteo e anfitrião; só os de C1 importam aqui):
  - C1, de André, ativa, com o timóteo Caio e a anfitriã Carla;
  - C2, de Diego, ativa; C3, de Débora, ativa; C4, de Gabriel, ativa;
  - C5, de Caio, **inativa**;
  - C6, de Lauro, ativa; C7, de Sônia, ativa; C8, de Carla, ativa; C9, de Lúcia, ativa;
  - C10, de Fábio, ativa (o líder está inativo);
  - C11, de Caio, **excluída**.
- **Funções e escopo:** os do E2.02. Rita é Administrador e vê todos. Pedro vê Pedro, Paula, André, Caio, Fábio, Gabriel e Carla. Diego vê o ramo de Tiago (com Olga, Lauro, Sônia, Vânia e Zélia) e o de Tânia (Beatriz, Débora e Rita). André vê o ramo de Pedro, mais Beatriz e Débora. Hugo não tem função e vê só a si mesmo.

**Valores da massa** (base de todos os critérios):

| Pessoa | Líder | Nível | Liderança (RN-10) | G12 | Totais |
|---|---|---|---|---|---|
| Samuel | — | Pastor | — | — | 12 / 6 (5/1) |
| Magda | — | Pastora | — | — | 6 / 2 (0/2) |
| Pedro | Samuel | G12 | Samuel | Pedro | 3 / 3 (3/0) |
| Paula | Magda | G12 | Magda | Paula | 1 / 1 (0/1) |
| Tiago | Samuel | G12 | Samuel | Tiago | 7 / 3 (2/1) |
| Tânia | Magda | G12 | Magda | Tânia | 3 / 1 (0/1) |
| André | Pedro | 144 | Pedro | Pedro | 2 / 3 (3/0) |
| Beatriz | Tânia | 144 | Tânia | Tânia | 1 / 1 (0/1) |
| Carla | Paula | 144 | Paula | Paula | 0 / 1 (0/1) |
| Rita | Tânia | 144 | Tânia | Tânia | 0 / 0 |
| Diego | Tiago | 144 | Tiago | Tiago | 3 / 3 (2/1) |
| Hugo | Tiago | 144 | Tiago | Tiago | 2 / 0 |
| Caio | André | 1.728 | Pedro / André | Pedro | 0 / 0 |
| Fábio (inativo) | André | 1.728 | Pedro / André | Pedro | 1 / 2 (2/0) |
| Débora | Beatriz | 1.728 | Tânia / Beatriz | Tânia | 0 / 1 (0/1) |
| Lauro | Diego | 1.728 | Tiago / Diego | Tiago | 2 / 2 (1/1) |
| Vânia | Hugo | 1.728 | Tiago / Hugo | Tiago | 1 / 0 |
| Gabriel | Fábio | 20.736 | Pedro / Fábio | Pedro | 0 / 1 (1/0) |
| Olga | Lauro | 20.736 | Tiago / Lauro | Tiago | 1 / 1 (0/1) |
| Zélia | Vânia | 20.736 | Tiago / Vânia | Tiago | 0 / 0 |
| Sônia | Olga | Nível 5 | Tiago / Olga | Tiago | 0 / 1 (0/1) |
| Ester | — | Sem liderança | Sem liderança | — | 1 / 1 (0/1) |
| Lúcia | Ester | G12 | Ester | Lúcia | 0 / 1 (0/1) |

**Nós da árvore de Ministérios**, para Rita: Samuel e Magda 18 / 8 · Pedro e Paula 4 / 4 · Tiago e Tânia 10 / 4 · André e Beatriz 3 / 4 · Diego e Olga 2 / 3 · Hugo e Vânia 1 / 0. Ester e Lúcia não estão na árvore de Rita, que começa nos pastores (DA-6 do E2.02).

**Ranking "Células por G12"**, para Rita: Pedro e Paula 4 · Tiago e Tânia 4 · Lúcia 1.

**G12 das células:** C1, C4, C5 e C10: Pedro · C2, C6 e C7: Tiago · C3: Tânia · C8: Paula · C9: Lúcia.

#### Critérios por regra
- **RN-01**
  - Dada a massa
  - Então os níveis são os da tabela: Samuel e Magda 0, Pedro 1, André 2, Caio 3, Gabriel 4 e Sônia 5.
  - Dada Ester, sem liderança
  - Então ela não tem nível, aparece como "Sem liderança", e não como pastora, e não está entre os "Pastores".
  - Dada Lúcia, discípula de Ester
  - Então Lúcia fica no nível 1 (G12) e é o G12 de si mesma.
  - Dado Fábio, inativo
  - Então Fábio continua no nível 3, e Gabriel no 4.
  - Quando Sônia ganha uma discípula, e essa discípula ganha outra
  - Então elas ficam nos níveis 6 e 7, sem limite.
- **RN-02**
  - Dada a lista de Membros aberta por Rita
  - Então o nível aparece como "Pastor" (Samuel), "Pastora" (Magda), "G12" (Pedro), "144" (André), "1.728" (Caio), "20.736" (Gabriel), "Nível 5" (Sônia) e "Sem liderança" (Ester).
  - Dada a árvore de Ministérios aberta por Rita
  - Então o nó de Samuel e Magda mostra "Pastores".
  - Dada Magda inativa
  - Então a raiz da árvore de Rita é só Samuel, com "Pastor".
  - Dado um cadastro antigo de pastor sem sexo registrado
  - Então ele aparece como "Pastor(a)". Ninguém com o sexo registrado aparece como "Pastor(a)", e nenhuma tela mostra "12" sozinho.
  - Dada Ester na lista de Membros
  - Então "Sem liderança" aparece com ícone e texto, com a aparência de aviso.
- **RN-03**
  - Dado Fábio (inativo, nível 3), com Gabriel e as células C10 e C4
  - Quando Rita define Tiago como líder de Fábio
  - Então, na mesma operação, Fábio fica no nível 2 e Gabriel no 3, e o G12 dos dois passa a ser Tiago.
  - Dado André (nível 2)
  - Quando Rita define Samuel como líder de André
  - Então André fica no nível 1 (G12), Caio e Fábio no 2, e Gabriel no 3.
  - Quando Rita define Paula como líder de Ester
  - Então Ester fica no nível 2 (144), e Lúcia passa do nível 1 para o 3.
  - Quando Rita marca André como sem liderança
  - Então André fica sem nível, Caio e Fábio passam ao nível 1 (G12), e Gabriel ao 2 (P-HIE-02).
  - Quando Rita marca Ester como pastora
  - Então Ester passa a "Pastora" (nível 0), e Lúcia continua no nível 1.
  - Dado André passando de Pedro para Tiago (os dois no nível 1)
  - Então nenhum nível muda, e o G12 de André, Caio, Fábio e Gabriel passa a ser Tiago.
  - Dada Zélia excluída (E2.01)
  - Quando Hugo passa a ter Diego como líder, e depois Zélia é restaurada
  - Então Hugo fica no nível 3, Vânia no 4, e Zélia volta no nível 5 ("Nível 5"), com o G12 Tiago.
- **RN-04**
  - Dada a massa
  - Então a cadeia de Gabriel é Samuel, Pedro, André e Fábio, e o G12 dele é Pedro. A cadeia de Pedro é Samuel, e o G12 dele é o próprio Pedro. Samuel e Ester não têm cadeia nem G12. A cadeia de Lúcia é Ester, e o G12 dela é ela mesma.
  - Quando Rita define Samuel como líder de André
  - Então a cadeia de Gabriel passa a Samuel, André e Fábio, e o G12 dele passa a André, na mesma operação.
  - Dada qualquer tela do sistema
  - Então nenhuma mostra o caminho em texto ("Samuel / Pedro / André / Fábio").
- **RN-05**
  - Dada a massa
  - Então André tem 2 discípulos (Caio e Gabriel): Fábio, inativo, não conta, mas Gabriel, discípulo dele, conta. Fábio tem 1 (Gabriel). Samuel tem 12, e Magda tem 6.
  - Quando Gabriel fica inativo
  - Então Fábio passa a 0, André a 1, Pedro a 2 e Samuel a 11. Os totais de células não mudam, e Gabriel continua no nível 4.
  - Quando Fábio volta a ficar ativo
  - Então André passa a 3, Pedro a 4 e Samuel a 13. O total de Fábio continua 1.
  - Quando Zélia é excluída
  - Então Vânia passa a 0, Hugo a 1, Tiago a 6 e Samuel a 11. Restaurada, os quatro voltam a 1, 2, 7 e 12.
  - Quando alguém cadastra um membro ativo com o líder Caio
  - Então Caio passa a 1, André a 3, Pedro a 4 e Samuel a 13.
  - Quando o membro cadastrado com o líder Caio é inativo
  - Então nenhum total de discípulos muda.
  - Dada Ester, sem liderança
  - Então ela tem 1 discípulo (Lúcia), como qualquer outra pessoa.
- **RN-06**
  - Dada a massa
  - Então André tem 3 células (3/0): C1, a C10 de Fábio (inativo) e a C4 de Gabriel. A C5 (inativa) e a C11 (excluída) não contam.
  - Dados Caio, timóteo da C1, e Carla, anfitriã da C1
  - Então a C1 não entra no total deles: Caio tem 0, e Carla tem 1 (a C8).
  - Quando a C1 fica inativa
  - Então André passa a 2, Pedro a 2 e Samuel a 5 (4/1).
  - Quando a C5 volta a ficar ativa
  - Então Caio passa a 1, André a 4, Pedro a 4 e Samuel a 7 (6/1).
  - Quando a C8 passa a ter Caio como líder
  - Então Carla e Paula passam a 0, Magda a 1 (0/1), Caio a 1 (1/0), André e Pedro a 4 (4/0), e Samuel a 7 (6/1).
  - Dado um cadastro antigo sem sexo registrado (anterior à RN-03 do E2.04), discípulo de Caio, com uma célula ativa
  - Então a célula conta no total dele, de Caio, de André, de Pedro e de Samuel, e em nenhuma das duas divisões.
- **RN-07**
  - Quando Sônia (nível 5) passa a liderar uma célula nova, ativa
  - Então o total de células de 6 pessoas aumenta 1, na mesma operação: Sônia 2 (0/2), Olga 2, Lauro 3 (1/2), Diego 4 (2/2), Tiago 4 (2/2) e Samuel 7 (5/2).
  - Quando Rita corrige o sexo de Gabriel de masculino para feminino
  - Então a C4 passa a feminina: Gabriel 1 (0/1), Fábio 2 (1/1), André e Pedro 3 (2/1), Samuel 6 (4/2). Os totais não mudam.
  - Quando alguém troca o timóteo, o anfitrião, o dia ou o tipo da C1, ou o nome ou o cônjuge de André
  - Então nenhum total muda.
- **RN-08**
  - Quando Rita define Tiago como líder de Fábio, e a tela confirma
  - Então, na próxima consulta:
    - Membros: Fábio no nível 2 com a liderança "Tiago"; Gabriel com "Tiago / Fábio"; André 1 / 1, Pedro 2 / 1, Tiago 8 / 5 (4/1), Samuel sem mudança (12 / 6);
    - Células: a C4 e a C10 com o G12 Tiago;
    - Ministérios: Pedro e Paula 3 / 2, Tiago e Tânia 11 / 6, André e Beatriz 2 / 2;
    - Dashboard, "Células por G12": Pedro e Paula 2, Tiago e Tânia 6.
  - Quando Rita abre Células logo depois de salvar, sem recarregar a página
  - Então a C4 e a C10 aparecem com o G12 Tiago já na primeira lista exibida, sem passar por "Pedro".
  - Dada uma gravação que leva 5 s para responder
  - Então o formulário fica aberto e não fecha pelo "✕", pelo `Esc`, pelo toque fora nem por "Cancelar". Aos 3 s, e não antes, aparece "Ainda salvando. Isso pode levar alguns segundos.". Com a resposta, o formulário fecha.
  - Dada uma falha em qualquer recálculo provocado por essa troca
  - Então Fábio continua com o líder André, e nenhum nível, G12 ou total muda. O formulário continua aberto, com os dados, e mostra "Não foi possível salvar as alterações. Tente de novo.", sem mensagem técnica e sem aviso de sucesso.
  - Quando a troca do líder de Fábio para Tiago e a inativação da C4 acontecem ao mesmo tempo
  - Então as duas valem: Tiago fica com 8 / 4 (3/1), Fábio com 1 / 1, Samuel com 12 / 5, e todos os valores são iguais aos de um recálculo do zero.
  - Dado o banco depois de qualquer sequência de gravações deste spec, inclusive simultâneas
  - Então o nível, o G12 e os totais guardados de cada pessoa são iguais aos recalculados do zero.
  - Dado o volume de referência
  - Quando o líder de um G12 com 2 mil pessoas abaixo dele muda para alguém do nível 1
  - Então a gravação termina em até 3 s. A troca do líder de um membro com até 100 pessoas abaixo, ou o cadastro de uma célula, termina em até 1 s.
- **RN-09**
  - Dada a árvore aberta por Rita
  - Então os nós mostram os totais da massa: Samuel e Magda 18 / 8, Pedro e Paula 4 / 4, André e Beatriz 3 / 4.
  - Dado o casal Diego e Olga, com Olga discípula de Lauro, que é discípulo de Diego
  - Então o nó mostra 2 discípulos (Lauro e Sônia) e 3 células (C2, C6 e C7), e não 4 e 4.
  - Dado o casal Hugo e Vânia, com Vânia discípula de Hugo
  - Então o nó mostra 1 discípulo (Zélia) e 0 células, e não 3.
  - Dado o nó de Diego e Olga, sob Tiago e Tânia
  - Então ele mostra o nível "144", que é o de Diego, discípulo de Tiago, e não "20.736", que é o de Olga.
  - Quando Rita abre o nó de Diego e Olga
  - Então aparecem Lauro e Sônia.
  - Quando Rita abre Lauro, que continua com 2 / 2
  - Então Olga aparece embaixo dele só como referência: o nome, "20.736" e "Aparece com o cônjuge, Diego Reis, mais acima.", sem totais e sem abrir. O casal Diego e Olga não aparece de novo.
  - Quando Rita usa "Ir para o casal" na referência
  - Então a tela leva até o nó de Diego e Olga, sem abrir nem fechar nenhum nó.
  - Quando Rita abre o nó de Hugo e Vânia
  - Então aparece Zélia, e Vânia não aparece como referência: o próprio nó do casal é o de cima.
  - Dado um casal com um cônjuge abaixo do outro, em que o cônjuge de cima não está na árvore de quem consulta (por exemplo, está acima da raiz do escopo dela)
  - Então o cônjuge de baixo aparece como um nó comum, na própria posição, com os próprios totais.
  - Dada a folha Rita, sob Tiago e Tânia
  - Então o nó mostra "0 discípulos · 0 células".
  - Dado o nó de André e Beatriz, com 3 discípulos (Caio, Gabriel e Débora)
  - Quando Rita o abre
  - Então aparecem só Caio e Débora, porque Gabriel está abaixo de Fábio, inativo. O texto de ajuda da árvore avisa que os totais incluem os discípulos de pessoas inativas, que não aparecem nela.
  - Dado o casal André e Beatriz (ramos diferentes)
  - Então ele aparece sob Pedro e Paula e sob Tiago e Tânia, como hoje, com 3 / 4 nos dois lugares.
  - Dado Pedro, que não vê Beatriz
  - Então, na árvore dele, o nó mostra só André, com 2 / 3.
  - Dado Diego, que vê Beatriz e não vê André
  - Então, na árvore dele, o nó mostra só Beatriz, com 1 / 1.
  - Dada Beatriz inativa
  - Então, na árvore de Rita, o nó mostra só André, com 2 / 3.
  - Dada a lista de Membros
  - Então Diego aparece com 3 / 3 e Olga com 1 / 1, os totais de cada um, sem o cônjuge.
- **RN-10**
  - Dada a lista de Membros aberta por Rita
  - Então, na tabela, a liderança é a da massa: Samuel "—", Pedro "Samuel", André "Pedro", Caio "Pedro / André", Gabriel "Pedro / Fábio", Ester "Sem liderança", Lúcia "Ester". Os totais aparecem sempre: Caio "0 discípulos · 0 células".
  - Dada a mesma lista em cartões, no celular
  - Então os cartões de Samuel e de Ester não têm a linha de liderança, e o de Caio tem "Liderança: Pedro / André". Os nomes não são links.
  - Dado André, que vê Débora e não vê Tânia
  - Então a linha de Débora mostra "Tânia / Beatriz", só os nomes, e o cadastro de Tânia continua fora do alcance de André.
  - Dado Diego, que não vê André
  - Então André não aparece na lista de Diego, nem o nível, a liderança ou os totais dele.
  - Dado Hugo, sem função
  - Então ele não tem a lista de Membros (E2.02). Pela API, vê só o próprio cadastro: nível 2 (144), liderança "Tiago", 2 / 0.
- **RN-11**
  - Dada a lista de Células aberta por Rita
  - Então o G12 é o da massa: C1 "Pedro", C2 "Tiago", C8 "Paula", C9 "Lúcia"; e o líder aparece com o nível, por exemplo "André (144)". Nenhuma célula mostra o G12 como casal ("Pedro e Paula").
  - Quando alguém cadastra uma célula de Pedro, uma de Samuel e uma de Ester
  - Então o G12 delas é "Pedro", "Pastores" e "—".
  - Quando Rita define Samuel como líder de André
  - Então, na hora, a C1, a C4, a C5 e a C10 mostram o G12 "André".
- **RN-12**
  - Dados Pedro e Rita
  - Quando cada um envia pela API, para André, o nível 0, 100 discípulos e 50 células
  - Então os valores são ignorados, e André continua com o nível 2 e 2 / 3.
- **RN-13**
  - Dada a massa carregada com os gatilhos desligados, como na carga (5.5)
  - Quando o recálculo da carga roda
  - Então todos os valores são os da tabela da massa, e as células masculinas e femininas não ficam todas zeradas.
  - Dado um membro que no legado tem `MinistryLevel` 1728
  - Então no novo ele fica no nível 3.
  - Dado um membro com "Não tem liderança" no legado
  - Então no novo ele fica sem liderança e sem nível.
  - Dado um membro sem líder e sem "Não tem liderança" no legado, que não é Samuel nem Magda, e que não foi corrigido no E4.05
  - Então ele aparece na lista de diferenças esperadas: "Pastores" no legado, sem liderança no novo.
  - Dado um membro a 8 níveis do topo
  - Então a conferência compara o nível dele com 12 elevado a 6.
  - Dado um G12 do legado com inativos na descendência
  - Então o total de discípulos é comparado com o recalculado a partir dos líderes do legado, sem os inativos, e não com o `TotalDisciples` guardado.

### Textos de tela
Vocabulário de referência. O `ux-designer` pode ajustar o tom e o arranjo, mas não o sentido nem os termos.

- **Termos:** Nível, Pastor, Pastora, Pastores, G12, Liderança, Líder, Sem liderança, Discípulos, Células, Ministério, Situação.
- **Evitar:**
  - "12" sozinho como nível, "Nível 0" e "Pastores" para uma pessoa só;
  - "Nível G12" como título de coluna;
  - "Status" no lugar de "Situação" (P-HIE-20);
  - "Gênero" no lugar de sexo (RN-03 do E2.04);
  - as abreviações "disc." e "cél.";
  - o G12 da célula como casal ("Pedro e Paula").
- **Forma:** os textos vindos do desenho de UX e aprovados pelo PO em 2026-11-23 (PO-UX-11, P-HIE-25) já estão na tabela. Os textos para o leitor de tela estão em Experiência (UX) > Textos.

| Situação | Texto |
|---|---|
| nível da pessoa | Pastor · Pastora · Pastor(a) (sem sexo registrado) · G12 · 144 · 1.728 · 20.736 · Nível 5, Nível 6… · Sem liderança (aparência de aviso, com ícone) |
| nível no nó com dois pastores e no filtro | Pastores |
| títulos das colunas (Membros) | Nome · Nível · Liderança · Ministério · Situação · Ações (com 1280 px ou mais, também Celular) |
| título da coluna de situação (Células) | Situação |
| liderança (Membros) | Tabela: <G12> / <líder> · <líder> · — (pastores) · Sem liderança. Cartão: Liderança: <valor>, só para quem tem líder |
| totais da pessoa (Membros) | <N> discípulos · <N> células, sempre, inclusive com zero (no singular, só com 1: 1 discípulo · 1 célula). Título da coluna: Ministério |
| totais do nó (Ministérios) | <N> discípulos · <N> células, sempre, inclusive com zero |
| ajuda da árvore (Ministérios) | Toque ou clique num nome para ver os discípulos diretos. Os totais somam todos os níveis abaixo de cada nome, inclusive os discípulos de pessoas inativas, que não aparecem aqui. |
| cônjuge que está abaixo do outro (Ministérios) | Aparece com o cônjuge, <Nome>, mais acima. · Botão: Ir para o casal |
| G12 da célula | <nome do G12> · Pastores · — |
| líder da célula com o nível | <nome do líder> (<nível>) |
| gravação demorada (aos 3 s) | Ainda salvando. Isso pode levar alguns segundos. |
| falha no recálculo ao salvar | Não foi possível salvar as alterações. Tente de novo. |

### Telas afetadas
- **Membros (lista, no celular e no computador):**
  - o nível com os rótulos da RN-02 ("G12", "20.736", "Pastor" ou "Pastora"), e "Sem liderança" com a aparência de aviso;
  - a liderança "G12 / líder", no lugar de só o líder (RN-10). No cartão, só para quem tem líder;
  - os totais por extenso e sempre à vista, inclusive com zero;
  - os títulos "Nível" (hoje "Nível G12"), "Liderança" (hoje "Líder") e "Situação" (hoje "Status");
  - os totais passam a acompanhar a árvore na hora.
- **Ministérios (árvore):**
  - cada nó passa a mostrar os totais do casal, sem dupla contagem e também com zero (RN-09). Hoje mostra só os discípulos diretos;
  - o nível da posição, com os rótulos da RN-02;
  - o casal com um cônjuge abaixo do outro não se repete: o cônjuge de baixo aparece como referência, com "Ir para o casal";
  - o texto de ajuda passa a explicar os totais.
- **Células (lista):**
  - o líder com o nível entre parênteses (RN-11);
  - o G12 continua no mesmo lugar, com um nome só. A célula de quem está sem liderança passa de "Pastores" para "—", se o E2.02 ainda não tiver corrigido;
  - o título "Situação" no lugar de "Status".
- **Formulários de membro e de célula:** só o envio muda. O formulário não fecha durante a gravação, avisa aos 3 s e mostra a falha no recálculo com os dados mantidos (RN-08).
- **Dashboard:** sem mudança visual. O ranking "Células por G12" passa a acompanhar as trocas de líder e as mudanças de sexo (RN-08, RN-06).
- **Sem mudança:** o resto do formulário de membro, "Meus dados", Relatórios, Funções, Auditoria e login. Nenhuma tela nova.

### Fora de escopo
Cada item indica o passo que cuida dele, quando há um.
- **Ciclos** (HIE-01): E2.04 (RN-13 de lá). Este spec parte de uma árvore sem ciclos.
- **Filtros e ordem da lista de Membros** (nível, liderança em qualquer nível, possui liderança, vínculo celular, ordem por nível): E2.07, com as [Definições](#definições-para-os-passos-seguintes) deste spec.
- **G12 em outros lugares:**
  - filtro de Células (CEL-06): E2.10;
  - formulário de relatório (REL-15): E2.11;
  - filtros de Relatórios (REL-13): E2.12;
  - exportação (REL-14): E2.13.
- **Cards e ranking do Dashboard** (DSH-02, DSH-03): E2.14. Este spec só garante que o nível e os totais em que o ranking se apoia estejam certos.
- **Raiz da árvore pelo escopo** (MIN-02): DA-6 do E2.02 e E2.15.
- **Escopo de visibilidade e de escrita:** E2.02. O escopo não depende do nível guardado.
- **Migração:**
  - saneamento (E4.04, E4.05);
  - carga (E4.06);
  - recálculo (E4.07);
  - reconciliação (E4.09), seguindo a RN-13.
- **Caminho da liderança em texto** numa tela: o legado não mostrava (P-HIE-10).
- **G12 ao lado do nome nos seletores de membro.** O legado mostrava "Nome (G12)" (`UI/shared/utils.js:98-102`). Ver a pergunta Q-3.
- **Divisão dos discípulos por sexo na árvore** ("3 homens e 5 mulheres", como o legado fazia por cônjuge). Ver a pergunta Q-2.
- **Homogeneidade** (líder do mesmo sexo do discípulo): Q-3 do E2.04.
- **Resumo de nível, liderança e totais em "Meus dados"** (sugestão da UX na PO-UX-10): fica para depois, sem passo no plano. Neste passo, quem não tem função vê esses valores só pela API (P-HIE-24).
- **Mostrar na árvore os discípulos ativos de quem está inativo:** E2.15. Até lá, o texto de ajuda avisa (P-HIE-18).
- **Nível ou G12 da época de um relatório antigo:** o relatório guarda o líder, o timóteo e o anfitrião (REL-09), não o nível nem o G12.
- **Recálculo manual** (`OperationController`): não será replicado (3.9). Os gatilhos do banco fazem esse papel.
- **Consolidação:** o consolidado não entra no nível, nos totais, na árvore nem no ranking. O spec da Consolidação define como a flag entra nessas regras.
- **Escolas:** não usa nível nem totais.

### Impactos em outros passos
Pontos de negócio que outros passos precisam respeitar. O `architect` decide como.
- **E1.08:**
  - a RN-06 (nomes de referência) passa a incluir "o G12 do membro" (RN-10);
  - a `ministry_tree_nodes` passa a seguir a RN-09: sem dupla contagem, sem repetir o casal, com o nível da posição e com a linha de referência do cônjuge de baixo (AQ-3 e AQ-4 da UX). O nó passa a mostrar os totais;
  - a `dashboard_g12_ranking` continua usando o nível 1, que agora acompanha a árvore.
- **E2.01:** os totais já ignoram excluídos (DT-24). A cadeia, se for guardada, também não pode deixar um excluído contar. A restauração recalcula o nível (RN-16 a de lá, P-HIE-13).
- **E2.02:**
  - o G12 é o mesmo dos Termos de lá;
  - se a cadeia for guardada, o escopo pode usá-la, desde que ela mude na mesma operação (RN-08 de lá e deste spec);
  - a célula de quem está sem liderança deixa de mostrar "Pastores" (RN-11).
- **E2.04:**
  - este spec parte das três situações (RN-11 de lá) e da árvore sem ciclos (RN-13 de lá);
  - as trocas de líder já passam pela trava única da árvore, e a RN-08 precisa da mesma garantia para os recálculos;
  - com o sexo sempre M ou F (RN-03 de lá), os totais deixam de aceitar "Masculino" e "Feminino", e a célula de líder sem sexo deixa de existir.
- **E2.07, E2.10 a E2.14:** usam as [Definições](#definições-para-os-passos-seguintes) deste spec.
- **E2.15:**
  - a árvore a partir do escopo herda a RN-09;
  - só ativos aparecem na árvore (MIN-03), então os discípulos ativos de um inativo não aparecem nela, embora contem nos totais de quem está acima (P-HIE-06). O E2.15 avalia como mostrá-los.
- **E4.04:** o relatório de saneamento ganha uma linha: "membros sem liderança que têm discípulos" (P-HIE-02), para a liderança indicar o líder no legado (E4.05).
- **E4.07:** o recálculo segue a RN-13 e usa as mesmas regras das gravações.
- **E4.09:** a reconciliação segue a RN-13. O texto da 5.6 ("a diferença esperada é só a de membros inativos") passa a comparar com os totais recalculados a partir da árvore do legado.
- **Consolidação:** a flag do consolidado entra no nível, nos totais, na árvore e no ranking.
- **Aceite (PO):**
  - no `docs/migracao.md`:
    - na 3.3, HIE-02, HIE-03 e HIE-04 em ✅;
    - na 3.7, a MIN-01 cita a RN-09;
    - a linha nova da 5.4 e o texto da 5.6;
    - o E2.06 na seção Progresso;
  - no `CLAUDE.md`:
    - na matriz, as linhas "Campos computados" e "Recalcular o nível dos descendentes quando o líder muda" em ✅;
    - em "Totais de discípulos e de células", a nota sobre o sexo do líder;
    - nas "Armadilhas", resolver "membro sem líder que não é pastor fica com `g12_level = 0`" e "células de líder sem gênero ficam fora de `total_cells`";
    - em "Lógica no banco", `compute_g12_level` deixa de dizer "não propaga".

### Pontos para o `architect`
Não são dúvidas de negócio. São pontos em que a regra depende de uma escolha técnica.
1. **Ordem com o E2.04 e o E2.02.** Este spec parte de uma árvore sem ciclos (RN-13 do E2.04) e do G12 do E2.02. Se o E2.06 entrar antes do E2.04, a propagação precisa terminar mesmo com um ciclo nos dados, sem travar a gravação.
2. **Cadeia guardada ou calculada.** O E1.08, o E2.02 e o E2.04 deixaram o caminho materializado como ponto de extensão. Se for usado, ele muda na mesma operação (RN-08). A carga roda com os gatilhos desligados, então o recálculo do E4.07 precisa preenchê-lo. Toda coluna nova em `members` precisa do `GRANT SELECT` por coluna (risco 4 do E1.08).
3. **Nível vazio para quem está sem liderança** (RN-01). Afeta `compute_g12_level`, `get_ministry_root` (se ainda existir), `formatG12Label`, `getLevelLabel`, a `ministry_tree_nodes`, a `dashboard_g12_ranking`, os tipos gerados e a regra 3 do E1.03.
4. **Sexo do líder** (RN-06, RN-07). Hoje o recálculo de totais não dispara quando muda o sexo de um membro, e a fórmula ignora a célula de líder sem sexo.
5. **Totais do casal** (RN-09). Quando um cônjuge está abaixo do outro, a descendência de cima já contém a de baixo. Saber se um está na cadeia do outro deixa o cálculo direto.
6. **Casal que não se repete** (RN-09). Resolvido na UX: o cônjuge de baixo aparece como referência embaixo do próprio líder (P-HIE-16, P43 da UX). O contrato da `ministry_tree_nodes` para isso está na AQ-3 e na AQ-4 da UX.
7. **Concorrência** (RN-08). A trava da árvore do E2.04 cobre as trocas de líder. As mudanças de célula, de situação e de sexo também mexem nos mesmos totais. O critério "igual ao recálculo do zero" vale como teste de invariante.
8. **Tempo** (RN-08). Medir no volume de referência. Se as metas não couberem, voltar ao PO antes de relaxar a consistência na mesma operação.
9. **Tela sem valores antigos** (RN-08). Depois de uma gravação, Células, Ministérios e Dashboard não podem mostrar o que tinham guardado. A proposta da UX está na AQ-6. O tempo-limite das consultas e o código da falha no recálculo estão na AQ-5.

### Perguntas em aberto
Nenhuma bloqueante. Os pontos que as fontes não respondiam viraram padrões, listados em [Padrões definidos por este spec](#padrões-definidos-por-este-spec-revisar-no-pr), para o usuário revisar no PR. Os que mais mudam o resultado são:
- **P-HIE-02:** quem está logo abaixo de alguém sem liderança aparece como G12.
- **P-HIE-05:** tudo muda na mesma operação, com as metas de 1 s e 3 s.
- **P-HIE-06:** os discípulos ativos de um inativo contam para quem está acima.
- **P-HIE-09:** na árvore, o casal com um cônjuge abaixo do outro aparece uma vez só, sem dupla contagem.
- **P-HIE-11:** a lista de Membros volta a mostrar "G12 / líder".
- **P-HIE-16:** na árvore, o cônjuge que está abaixo do outro aparece embaixo do próprio líder só como referência, com "Ir para o casal".

As pendências da UX (PO-UX-1 a PO-UX-11) foram resolvidas em 2026-11-23 e viraram os padrões P-HIE-15 a P-HIE-25.

Sugestões para o usuário decidir, sem bloquear o passo. A T7 da Experiência (UX) mostra como cada tela fica com cada resposta:
- **Q-1.** Quem está abaixo de alguém sem liderança deve aparecer como G12 (padrão adotado, como no legado)? A alternativa é deixar toda essa descendência sem nível, fora do filtro "G12" e do ranking "Células por G12", até a liderança corrigir.
- **Q-2.** A árvore de Ministérios deve dividir os discípulos do casal por sexo, como o legado fazia por cônjuge ("3 homens e 5 mulheres")?
- **Q-3.** Os seletores de membro (líder, cônjuge, timóteo, anfitrião, participantes) devem mostrar o G12 ao lado do nome, como o legado, para separar homônimos?

## Experiência (UX)
_Seção do `ux-designer`. Escrita em 2026-11-23 a partir destas fontes:_
- _a seção Negócio (RN-01 a RN-13, P-HIE-01 a P-HIE-14, a massa de exemplo, os Textos de tela, os Pontos para o `architect` e as perguntas Q-1 a Q-3);_
- _as telas da `origin/main` do `mci-connect` (`fdcbe50`): `Members.tsx`, `Cells.tsx`, `Ministries.tsx`, `lib/ministries/tree.ts` e `lib/cells/labels.ts`;_
- _o que já foi desenhado para as mesmas telas: a árvore do [E1.08](e1-08-paginacao-servidor.md) (PR 4), as ações das listas do [E2.01](e2-01-exclusao-logica.md) (T1), as raízes pelo escopo e os subtítulos do [E2.02](e2-02-perfis-escopo.md) (DA-6, T5, T7 e T10) e o rodapé do formulário de membro do [E2.04](e2-04-validacoes-membro.md) (T7 e P22);_
- _o legado, só para manter o que os usuários conhecem: "André (144)" na lista de células e "G12 / líder" na lista de membros._

_Usa os padrões de Escolas (P1 a P6), do E2.01 (P7 a P9), do E2.02 (P10 a P14), do E2.03 (P15 a P18) e do E2.04 (P20 a P24). Os padrões novos começam em P40, para não colidir com os specs desenhados em paralelo. Nenhuma regra de negócio foi criada aqui. Onde a tela precisou de algo que o spec não diz, a decisão é a mais conservadora, marcada como "definido pela UX" e listada em "Pendências para o PO". Os nomes são os da [massa de exemplo](#massa-de-exemplo); os sobrenomes existem só nos wireframes._

### O que muda, tela a tela
Nenhuma tela nova e nenhuma rota nova.

| Tela | O que muda | Para quem |
|---|---|---|
| Membros (T1) | O nível com os rótulos novos (Pastor, Pastora, G12, 144, 1.728, 20.736, "Nível 5"…, Sem liderança). A liderança com o G12 e o líder ("Pedro Alves / André Souza"). Os totais por extenso. Na tabela, as colunas Nível, Liderança, Ministério e Situação, nessa ordem. Os cartões passam a valer até 1023 px. | quem vê membros |
| Células (T2) | O líder com o nível entre parênteses ("André Souza (144)"). "G12: —" na célula de quem está sem liderança. Os cartões passam a valer até 1023 px. | quem vê células |
| Ministérios (T3, T4) | Cada nó mostra o nível da posição e os totais do casal ("18 discípulos · 8 células"), no lugar dos discípulos diretos. O cônjuge que está abaixo do outro aparece sob o próprio líder como uma referência, sem repetir o casal. O texto de ajuda muda. | quem vê a árvore |
| Formulários de membro e de célula (T5) | A gravação demorada avisa que ainda está salvando, e o formulário não fecha durante o envio. A falha no recálculo aparece no formulário, com os dados mantidos. Depois de salvar, nenhuma tela mostra os valores antigos. | quem cadastra e edita |
| Dashboard, Relatórios, Funções, Auditoria, login e o resto do formulário de membro (T6) | Sem mudança visual. | — |

### Coerência com os outros specs
- **E1.08 (PR 4, árvore):** continuam valendo uma chamada por nó aberto, a folha sem botão, os erros com o foco devolvido e a ordem pelo nome.
  - Mudam o que o nó mostra (os totais do casal no lugar dos discípulos diretos, RN-09) e o texto de ajuda.
  - Os discípulos diretos continuam decidindo, por trás, se o nó abre.
- **E2.01 (T1):** as ações dos cartões ("Editar", "Novo relatório" e "⋯", com 44×44 px) e os ícones da tabela não mudam.
  - Elas acompanham o cartão: com os cartões indo até 1023 px (P45), o "⋯" do P8 vale até lá.
  - O exemplo "G12: Vera e Wagner" da T1 de lá passa a ser um nome só (RN-11, PO-UX-9).
- **E2.02:** os subtítulos com o alcance (P10) e as ações por permissão (T5 e T7) continuam.
  - A árvore começa no topo do escopo (DA-6): os pastores para quem vê a igreja toda, o casal G12 para quem vê só o ministério. O estado vazio da T10 fica só para quem não vê ninguém.
  - O "G12: Pedro e Paula" do cartão da T7 de lá passa a "G12: Pedro Alves" (RN-11, PO-UX-9).
- **E2.04 (T4, T7 e P22):** o formulário de membro não muda. Este spec só acrescenta ao rodapé o aviso de gravação demorada e a mensagem de falha no recálculo, e impede fechar o formulário durante o envio (P44).
- **E2.07 e E2.10 a E2.15:**
  - os filtros, as opções e a ordem por nível usam os rótulos do P40 ("Pastores" no filtro);
  - o E2.12 pode levar o P45 para Relatórios;
  - o E2.15 decide como mostrar na árvore os discípulos ativos de quem está inativo. Quando isso acontecer, o texto de ajuda da T3 perde a segunda parte.

### Decisões de experiência
| # | Decisão | Por quê |
|---|---|---|
| UXD-1 | **Um rótulo de nível só, em todas as telas (P40).** Uma função recebe o nível, a marca de pastor e o sexo (e, no nó da árvore, se os dois integrantes são pastores) e devolve o rótulo da RN-02. Membros e a árvore usam um badge; Células usa o texto entre parênteses. | Hoje são três rótulos diferentes: "Pastor", "12" e "144" na lista de Membros, "Pastor(a)" e "12" na árvore, "Pastores" na célula. A mesma pessoa não pode ser "12" numa tela e "G12" na outra. |
| UXD-2 | **No cartão, a linha "Liderança" só aparece para quem tem líder.** Para pastor e para quem está sem liderança, o badge do nível já diz tudo. Na tabela, a coluna mostra "—" e "Sem liderança", como na RN-10. | No cartão, "Liderança: —" é uma linha vazia, e "Liderança: Sem liderança" repete o badge logo acima. O cartão precisa ser curto, porque o líder rola dezenas deles. Na tabela, uma célula em branco confundiria mais do que o "—". |
| UXD-3 | **Membros e Células mostram cartões até 1023 px e a tabela a partir de 1024 px (P45).** Em Membros, a foto e o Celular viram colunas só a partir de 1280 px; abaixo disso, o contato fica embaixo do nome. | Com o menu lateral fixo (256 px) a partir de 768 px, a lista tem 464 px de largura em 768 e 720 px em 1024. A tabela de Membros, com a Liderança "G12 / líder", pede cerca de 700 px sem a foto e o Celular, e 890 px com eles. Em 768, cada linha quebraria em 3 ou 4 linhas. O conteúdo define o breakpoint. |
| UXD-4 | **"Sem liderança" usa o badge de aviso do P6, com ícone. Na lista de Membros, "Ativo" e "Inativo" também passam ao P6.** | "Sem liderança" é uma situação que a liderança corrige (o saneamento do E4.04 lista esses cadastros). Hoje o badge é laranja fixo (`bg-orange-500`), fora dos tokens, com texto branco abaixo de 4,5:1. O "Ativo" de hoje (`bg-success` com texto branco) tem o mesmo problema. |
| UXD-5 | **O nó da árvore mostra nível e totais na mesma ordem no celular e no computador: nomes, nível, discípulos e células.** No celular, o nível e os totais descem para a linha de baixo. Os totais aparecem sempre, inclusive "0 discípulos · 0 células". | Os totais passam a ser a informação principal do nó (P-HIE-12). O zero também informa (um casal sem células) e mantém as linhas iguais. A mesma ordem no DOM faz o leitor de tela ler igual nos dois tamanhos. |
| UXD-6 | **O cônjuge que está abaixo do outro aparece sob o próprio líder como uma linha de referência (P43):** nome e nível, sem totais e sem abrir, com "Aparece com o cônjuge, {Nome}, mais acima." e o botão "Ir para o casal". É a resposta ao ponto 6 dos Pontos para o `architect`. | Sem nada sob o líder, o nó de Lauro diria "2 discípulos" e abriria vazio, ou nem abriria. Repetir o casal é o que a RN-09 proíbe e leva a um laço sem fim. A referência diz onde a pessoa está, e o botão leva até lá, o que importa no celular, onde o nó de cima já saiu da tela. |
| UXD-7 | **O nível do nó é o da posição: o de quem liga o nó ao nó de cima. "Pastores" só quando os dois integrantes são pastores.** | No casal Diego e Olga, sob Tiago e Tânia, quem está ali é Diego (144). Olga (20.736) aparece com o próprio nível na referência (UXD-6). No casal de ramos diferentes, cada posição mostra o nível de quem é discípulo daquele líder. Um pastor sozinho no nó (com o cônjuge inativo) aparece como "Pastor" ou "Pastora". |
| UXD-8 | **O texto de ajuda da árvore diz que os totais somam todos os níveis, inclusive quem está abaixo de uma pessoa inativa.** | Os discípulos ativos de um inativo contam nos totais (P-HIE-06), mas não aparecem na árvore (MIN-03). Sem o aviso, o pastor vê "André e Beatriz: 3 discípulos", abre o nó e só encontra 2 pessoas (Gabriel está abaixo de Fábio, inativo). |
| UXD-9 | **Na lista de Células, o nível do líder vai entre parênteses, em texto discreto, e não num badge. O G12 é um nome só.** | O cabeçalho do cartão já divide a largura com até três botões de 44 px. Um badge ao lado do nome disputaria o espaço com eles. É o formato do legado ("André (144)"), que os líderes conhecem, e o da RN-11. |
| UXD-10 | **Depois de salvar, nenhuma tela mostra o valor de antes (P44).** A lista aberta mostra as linhas "atualizando" até a resposta chegar, e Células, Ministérios e Dashboard carregam do zero na visita seguinte. | A RN-08 promete os valores novos na consulta seguinte. Hoje, salvar um membro só atualiza Membros, e Células e o Dashboard mostrariam, do cache, o G12 e o ranking antigos até a nova resposta chegar. Quem confere a troca logo depois de fazê-la concluiria que ela não valeu. |
| UXD-11 | **A gravação demorada avisa, e o formulário não fecha durante o envio (P44).** Depois de 3 s em "Salvando…", aparece "Ainda salvando. Isso pode levar alguns segundos.". | Trocar o líder de um G12 grande pode levar até 3 s no servidor (RN-08), mais o tempo da rede de um celular. Sem aviso, a pessoa conclui que travou, fecha o diálogo e tenta de novo, sem saber se a primeira gravação valeu. |

### Navegação e rotas
- Nenhuma rota nova.
- "Ir para o casal" (T4) só rola a página e move o foco. Não muda a URL e não abre nem fecha nós.

### Fluxos
Contagem no celular, a partir de qualquer tela com o menu fechado, incluindo o toque no ☰. "Toque" não conta a digitação.

| # | História | Caminho | Toques e telas |
|---|---|---|---|
| F1 | O líder confere a geração e o ministério de um discípulo (Pedro) | ☰ → Membros → busca "Caio" → lê no cartão "1.728", "Liderança: Pedro Alves / André Souza" e "0 discípulos · 0 células" | 2 toques e a busca; igual a hoje |
| F2 | A administradora troca o líder de alguém (Rita, desktop) | Membros → "Editar" em Fábio → Líder → Tiago → "Salvar alterações" → a linha de Fábio mostra "144" e "Tiago Rocha" | 4 cliques e a busca; igual a hoje |
| F3 | Ela confere o efeito nas outras telas | Células → C4 e C10 com "G12: Tiago Rocha"; Ministérios → "Tiago Rocha ♥ Tânia Rocha", "11 discípulos · 6 células" | 1 clique por tela, sem recarregar a página |
| F4 | O pastor percorre a árvore (Samuel) | ☰ → Ministérios → Tiago e Tânia → Diego e Olga → Lauro | 4 toques; 1 tela |
| F5 | O pastor encontra a esposa que está abaixo do marido | F4 → vê Olga como referência sob Lauro → "Ir para o casal" → o nó Diego e Olga fica à vista, com o foco | +1 toque |
| F6 | O líder confere o G12 de uma célula (Pedro) | ☰ → Células → lê no cartão "André Souza (144)" e "G12: Pedro Alves" | 2 toques; igual a hoje |
| F7 | Gravação demorada (Rita troca o líder de um G12 com 2 mil pessoas abaixo) | "Salvar alterações" → "Salvando…" → aos 3 s, "Ainda salvando…" → o formulário fecha, com o toast | 1 toque; espera sem refazer |
| F8 | Falha no recálculo (RN-08) | "Salvar alterações" → mensagem no rodapé → "Salvar alterações" de novo | +1 toque, sem digitar de novo |

### Telas
As convenções dos wireframes são as do E2.04, com estas:
- 360 px ≈ 38 colunas;
- `[Botão]` é botão; `[✎]` é "Editar"; `[⋯]` é o menu de ações; `[▤+]` é "Novo relatório"; `[⌫]` é "Excluir" na tabela;
- `▸` e `▾` são o nó fechado e aberto; `•` é a folha; `┊` é o recuo de um nível da árvore; `♥` é o coração decorativo do casal;
- `⊘` é o ícone `UserX`; `↰` é o ícone `CornerLeftUp`; `⏸` é o ícone `PauseCircle`; `⚠` é erro.

A margem lateral é a do `AppLayout` (`p-4`).

#### T1. Membros: lista
Cartões (até 1023 px), com Rita:
```
┌──────────────────────────────────────┐
│ (foto) Caio Lima           [✎]  [⋯]  │  ações do E2.01, 44×44
│        caio@exemplo.com              │
│ [1.728] [Ativo]                      │  nível (P40) e situação (P6)
│ Liderança: Pedro Alves / André Souza │  P41
│ 0 discípulos · 0 células             │  P42
├──────────────────────────────────────┤
│ (foto) Samuel Colares      [✎]  [⋯]  │
│        samuel@exemplo.com            │
│ [Pastor] [Ativo]                     │  sem a linha Liderança (UXD-2)
│ 12 discípulos · 6 células            │
├──────────────────────────────────────┤
│ (foto) Ester Ramos         [✎]  [⋯]  │
│        ester@exemplo.com             │
│ [⊘ Sem liderança] [Ativo]            │  P6 de aviso (UXD-4)
│ 1 discípulo · 1 célula               │
├──────────────────────────────────────┤
│ (foto) Fábio Lima          [✎]  [⋯]  │
│        —                             │
│ [1.728] [⏸ Inativo]                  │
│ Liderança: Pedro Alves / André Souza │
│ 1 discípulo · 2 células              │
└──────────────────────────────────────┘
```
Tabela (a partir de 1024 px), com Rita. A foto e o Celular entram como colunas a partir de 1280 px, antes e depois do Nome:
```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Nome               │ Nível             │ Liderança      │ Ministério    │ Situação │ Ações   │
│ Samuel Colares     │ [Pastor]          │ —              │ 12 discípulos │ [Ativo]  │ [✎] [⌫] │
│ samuel@exemplo.com │                   │                │ 6 células     │          │         │
│ Pedro Alves        │ [G12]             │ Samuel Colares │ 3 discípulos  │ [Ativo]  │ [✎] [⌫] │
│                    │                   │                │ 3 células     │          │         │
│ Caio Lima          │ [1.728]           │ Pedro Alves /  │ 0 discípulos  │ [Ativo]  │ [✎] [⌫] │
│                    │                   │ André Souza    │ 0 células     │          │         │
│ Ester Ramos        │ [⊘ Sem liderança] │ Sem liderança  │ 1 discípulo   │ [Ativo]  │ [✎] [⌫] │
│                    │                   │                │ 1 célula      │          │         │
│ Lúcia Freitas      │ [G12]             │ Ester Ramos    │ 0 discípulos  │ [Ativo]  │ [✎] [⌫] │
│                    │                   │                │ 1 célula      │          │         │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```
- **Nível (P40):** o badge de cada pessoa. O "Pastor" de hoje vira "Pastor" ou "Pastora" pelo sexo, e "12" vira "G12". O "Sem Liderança" laranja vira o badge de aviso, com ícone (UXD-4).
- **Liderança (P41):** "G12 / líder", "líder", "—" ou "Sem liderança", pelo nível, como na RN-10. Os nomes não são links: são nomes de referência e podem estar fora do escopo de quem consulta (RN-06 do E1.08), como Tânia na lista de André.
  - No cartão, a linha aparece só para quem tem líder (UXD-2). Ela substitui o "Líder: …" de hoje.
  - Na tabela, a coluna "Liderança" substitui a "Líder" e fica logo depois do Nível.
- **Totais (P42):** os da pessoa (RN-05, RN-06), e não os do casal (RN-09): Diego "3 discípulos · 3 células" e Olga "1 discípulo · 1 célula". Por extenso, sem "disc." e "cél.".
  - No cartão, numa linha própria, embaixo da Liderança.
  - Na tabela, na coluna "Ministério", em duas linhas, como hoje.
- **Situação:** o badge passa ao P6, como em Escolas: "Ativo" com `bg-success/15`, `border-success` e `text-foreground`; "Inativo" com `bg-muted` e o ícone `PauseCircle`. O título da coluna passa de "Status" para "Situação" (PO-UX-6).
- **Colunas da tabela (UXD-3), nesta ordem:**
  - de 1024 a 1279 px: Nome, Nível, Liderança, Ministério, Situação e Ações. Embaixo do nome fica o contato do cartão: o Instagram, o e-mail ou o celular, nessa ordem;
  - a partir de 1280 px: entram a foto antes do Nome e a coluna Celular depois dele, como hoje. Embaixo do nome ficam só o Instagram ou o e-mail, como hoje na tabela.
  - Sai "Nível G12" e entra "Nível". Sai "Líder" e entra "Liderança".
- **Celular e tablet × computador (P45):** os cartões valem até 1023 px, também no tablet com o menu lateral fixo, e a tabela, a partir de 1024 px.
- **Busca, paginação, ações e subtítulo:** sem mudança (E1.08, E2.01 e E2.02).
- Componentes: os de hoje (`Card`, `Table`, `Badge`, `Avatar`, `Button`, `DropdownMenu`). O badge dentro de um texto ou de um botão é um `span` com `badgeVariants`.

#### T2. Células: lista
Cartões (até 1023 px), com Rita:
```
┌──────────────────────────────────────┐
│ André Souza (144)    [▤+]  [✎]  [⋯]  │  "(144)" em text-muted-foreground
│ G12: Pedro Alves                     │
│ Timóteo: Caio Lima                   │
│ …                                    │  o resto do cartão como hoje
├──────────────────────────────────────┤
│ Samuel Colares       [▤+]  [✎]  [⋯]  │
│ (Pastor)                             │  quebra quando não cabe
│ G12: Pastores                        │
├──────────────────────────────────────┤
│ Ester Ramos (Sem     [▤+]  [✎]  [⋯]  │
│ liderança)                           │
│ G12: —                               │  lido como "G12: nenhum"
├──────────────────────────────────────┤
│ Sônia Castro         [▤+]  [✎]  [⋯]  │
│ (Nível 5)                            │
│ G12: Tiago Rocha                     │
└──────────────────────────────────────┘
```
Tabela (a partir de 1024 px):
```
┌──────────────────────────────────────────────────────────────────┐
│ Líder                       │ G12           │ Endereço │ …       │
│ André Souza (144)           │ Pedro Alves   │ …        │         │
│ Timóteo: Caio Lima          │               │          │         │
│ Anfitrião: Carla Dias       │               │          │         │
│ Samuel Colares (Pastor)     │ Pastores      │ …        │         │
│ Ester Ramos (Sem liderança) │ —             │ …        │         │
│ Lúcia Freitas (G12)         │ Lúcia Freitas │ …        │         │
│ Sônia Castro (Nível 5)      │ Tiago Rocha   │ …        │         │
└──────────────────────────────────────────────────────────────────┘
```
- **Líder com o nível (RN-11, UXD-9):** "{líder} ({nível})", com o nome em `font-semibold` (cartão) ou `font-medium` (tabela) e o nível com o rótulo do P40, em `font-normal text-muted-foreground`. O texto quebra entre as palavras, sem `truncate`.
- **G12 (RN-11):** um nome só, como hoje: o próprio líder quando ele é G12, "Pastores" quando o líder é pastor e "—" quando o líder está sem liderança. Hoje, essa última célula aparece como "Pastores".
- **Colunas e o resto do cartão:** sem mudança, fora o título "Status", que passa a "Situação" (PO-UX-6), e o breakpoint dos cartões (P45).
- Componentes: os de hoje.

#### T3. Ministérios: o nó com o nível e os totais
Celular, com Rita:
```
┌──────────────────────────────────────┐
│ ☰                                    │
│ Ministérios                          │  h1
│ Toque ou clique num nome para ver os │  text-sm, cor muted
│ discípulos diretos. Os totais somam  │
│ todos os níveis abaixo de cada nome, │
│ inclusive os discípulos de pessoas   │
│ inativas, que não aparecem aqui.     │
│ ┌──────────────────────────────────┐ │
│ │ ▾ Samuel Colares ♥ Magda Colares │ │  o nó é um botão
│ │   [Pastores] 18 discípulos ·     │ │  nível e totais embaixo
│ │   8 células                      │ │
│ │ ┊ ▸ Pedro Alves ♥ Paula Alves    │ │
│ │ ┊   [G12] 4 discípulos ·         │ │
│ │ ┊   4 células                    │ │
│ │ ┊ ▾ Tiago Rocha ♥ Tânia Rocha    │ │
│ │ ┊   [G12] 10 discípulos ·        │ │
│ │ ┊   4 células                    │ │
│ │ ┊ ┊ ▸ André Souza ♥ Beatriz      │ │
│ │ ┊ ┊   Souza                      │ │
│ │ ┊ ┊   [144] 3 discípulos ·       │ │
│ │ ┊ ┊   4 células                  │ │
│ │ ┊ ┊ ▸ Diego Reis ♥ Olga Reis     │ │
│ │ ┊ ┊   [144] 2 discípulos ·       │ │
│ │ ┊ ┊   3 células                  │ │
│ │ ┊ ┊ ▸ Hugo Melo ♥ Vânia Melo     │ │
│ │ ┊ ┊   [144] 1 discípulo ·        │ │
│ │ ┊ ┊   0 células                  │ │
│ │ ┊ ┊ • Rita Gomes                 │ │  folha: sem seta, não abre
│ │ ┊ ┊   [144] 0 discípulos ·       │ │
│ │ ┊ ┊   0 células                  │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```
Computador (a partir de 640 px, como hoje):
```
┌────────────────────────────────────────────────────────────────────────────────┐
│ ▾ Samuel Colares ♥ Magda Colares         [Pastores] 18 discípulos · 8 células  │
│ ┊ ▸ Pedro Alves ♥ Paula Alves                  [G12] 4 discípulos · 4 células  │
│ ┊ ▾ Tiago Rocha ♥ Tânia Rocha                 [G12] 10 discípulos · 4 células  │
│ ┊ ┊ ▸ André Souza ♥ Beatriz Souza              [144] 3 discípulos · 4 células  │
│ ┊ ┊ ▸ Diego Reis ♥ Olga Reis                   [144] 2 discípulos · 3 células  │
│ ┊ ┊ ▸ Hugo Melo ♥ Vânia Melo                    [144] 1 discípulo · 0 células  │
│ ┊ ┊ • Rita Gomes                               [144] 0 discípulos · 0 células  │
└────────────────────────────────────────────────────────────────────────────────┘
```
- **Totais do nó (RN-09, P42, UXD-5):** "{N} discípulos · {N} células" do casal, sem contar ninguém duas vezes, no lugar do ícone com os discípulos diretos de hoje. Sempre à vista, inclusive com zero.
  - O ícone `Users` sai: a palavra "discípulos" já diz o que é o número.
  - Os discípulos diretos continuam decidindo se o nó abre (seta) ou é folha (ponto), como no E1.08.
  - Um nó pode mostrar "1 discípulo" e ser folha, quando o único discípulo direto está inativo e tem discípulos ativos. O texto de ajuda explica (UXD-8).
- **Nível do nó (P40, UXD-7):**
  - "Pastores" quando os dois integrantes são pastores. Com um pastor só no nó, "Pastor" ou "Pastora";
  - nos demais nós, o nível da posição: o de quem é discípulo do nó de cima. Nas raízes, o do integrante principal;
  - "Sem liderança" com o badge de aviso, quando a raiz é alguém sem liderança (DA-6 do E2.02, para quem vê só o próprio casal).
- **Arranjo:**
  - no celular, os nomes ficam na primeira linha, e o nível e os totais na segunda. Os nomes quebram linha, sem corte;
  - em 360 px, o nível e os totais cabem numa linha até cerca do 3º nível de recuo. Abaixo disso, "{N} células" desce inteiro para a linha seguinte: cada total é uma unidade que não se parte (P42);
  - no computador, tudo numa linha, com o nível e os totais à direita, na mesma ordem do celular.
- **Texto de ajuda (UXD-8):** substitui "O número ao lado de cada nome é o total de discípulos diretos.". Some no estado vazio, como hoje.
- **Raízes (DA-6 do E2.02):** Rita vê os pastores. Pedro vê o casal G12 dele, "Pedro Alves e Paula Alves", com "G12" e "4 discípulos · 4 células". Quem tem Lúcia como G12 vê a raiz "Lúcia Freitas", com "G12".
- **Cônjuge invisível ou inativo:** o nó fica só com quem aparece, e os totais são só dessa pessoa (RN-09). Na árvore de Pedro, o nó é "André Souza", "[144] 2 discípulos · 3 células".
- Componentes: os de hoje (`Card`, `Button`, `Skeleton`), com o badge como `span` dentro do botão do nó.

#### T4. Ministérios: o cônjuge que está abaixo do outro
Celular, com Rita, depois de abrir Tiago e Tânia, Diego e Olga e Lauro:
```
┌──────────────────────────────────────┐
│ ┊ ┊ ▾ Diego Reis ♥ Olga Reis         │
│ ┊ ┊   [144] 2 discípulos · 3 células │
│ ┊ ┊ ┊ ▾ Lauro Mendes                 │
│ ┊ ┊ ┊   [1.728] 2 discípulos ·       │
│ ┊ ┊ ┊   2 células                    │
│ ┊ ┊ ┊ ┊ ↰ Olga Reis                  │  referência: não abre
│ ┊ ┊ ┊ ┊   [20.736]                   │  o nível dela, sem totais
│ ┊ ┊ ┊ ┊   Aparece com o cônjuge,     │
│ ┊ ┊ ┊ ┊   Diego Reis, mais acima.    │
│ ┊ ┊ ┊ ┊   [Ir para o casal]          │  variant="link", h-11
│ ┊ ┊ ┊ • Sônia Castro                 │
│ ┊ ┊ ┊   [Nível 5] 0 discípulos ·     │
│ ┊ ┊ ┊   1 célula                     │
└──────────────────────────────────────┘
```
Computador:
```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ ┊ ┊ ▾ Diego Reis ♥ Olga Reis                             [144] 2 discípulos · 3 células  │
│ ┊ ┊ ┊ ▾ Lauro Mendes                                   [1.728] 2 discípulos · 2 células  │
│ ┊ ┊ ┊ ┊ ↰ Olga Reis [20.736] Aparece com o cônjuge, Diego Reis, mais acima.              │
│ ┊ ┊ ┊ ┊   [Ir para o casal]                                                              │
│ ┊ ┊ ┊ • Sônia Castro                                  [Nível 5] 0 discípulos · 1 célula  │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```
- **Quando aparece (RN-09, UXD-6):** só quando a pessoa é cônjuge de um integrante de um nó que está acima dela, nesta mesma árvore (o aninhamento indireto). Olga, discípula de Lauro, é esposa de Diego, que aparece com ela no nó "Diego e Olga".
  - No aninhamento direto (Vânia, discípula de Hugo e esposa dele), não há referência: o próprio nó do casal é o de cima, e Vânia não reaparece, como já acontece desde o E1.08. Abrir "Hugo e Vânia" mostra Zélia.
  - Quando o cônjuge de cima não está na árvore de quem consulta (invisível, inativo ou acima da raiz), a pessoa aparece como um nó comum, na própria posição (AQ-4).
- **O que mostra (P43):** o ícone `CornerLeftUp` (decorativo), o nome, o nível dela (Olga, "20.736"), a frase "Aparece com o cônjuge, {Nome}, mais acima." e o botão "Ir para o casal".
- **O que não mostra:**
  - totais, porque os dela já estão no nó do casal. Mostrá-los de novo daria a impressão de contagem dupla;
  - a seta: a referência não abre. Os discípulos de Olga (Sônia) aparecem sob o nó do casal, como discípulos dele.
- **Contagem:** Olga conta como discípula direta de Lauro (o nó dele abre e mostra a referência) e entra nos totais dele ("2 discípulos": Olga e Sônia), como diz a RN-09.
- **Ordem:** pelo nome, entre os irmãos, como os outros nós.
- **"Ir para o casal":**
  - rola a página até o nó "Diego e Olga" (`block: "center"`), move o foco para o botão dele e o destaca por 2 s com `ring-2 ring-ring`, sem depender de `:focus-visible`;
  - com `prefers-reduced-motion`, a rolagem é imediata, sem animação;
  - não abre nem fecha nenhum nó. O nó do casal está sempre aberto nessa hora, porque é o caminho até a referência;
  - `Button variant="link"`, com `h-11` no celular e `md:h-9`, e `aria-label="Ir para Diego Reis e Olga Reis, mais acima na árvore"`.
- Componentes: `Button`, `Badge` (`span`).

#### T5. Gravação que recalcula: formulários de membro e de célula
Rodapé do formulário de membro (diálogo responsivo do E2.04, T7):
```
Aos 3 s em "Salvando…"                   Falha no recálculo (RN-08)
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│──────────────────────────────────────│ │──────────────────────────────────────│
│ Ainda salvando. Isso pode levar      │ │ ⚠ Não foi possível salvar as         │
│ alguns segundos.                     │ │ alterações. Tente de novo.           │
│ [Cancelar        ] [(◌) Salvando…  ] │ │ [Cancelar      ] [Salvar alterações] │
└──────────────────────────────────────┘ └──────────────────────────────────────┘
```
- **Enviando (P44):**
  - o botão mostra "Salvando…" ou "Criando…", e os dois botões ficam desabilitados, como no E2.04;
  - durante o envio, "✕", `Esc` e o toque fora do diálogo também não fecham o formulário. Hoje eles fechariam, e a pessoa não saberia se a gravação valeu;
  - aos 3 s sem resposta, aparece "Ainda salvando. Isso pode levar alguns segundos." acima dos botões, em `text-sm text-muted-foreground`, com `role="status"`. A mensagem some quando a resposta chega.
- **Falha no recálculo (RN-08):** "Não foi possível salvar as alterações. Tente de novo." no rodapé, com `role="alert"`, no mesmo lugar da queda de conexão do E2.04. Os dados ficam no formulário, nada foi gravado (tudo ou nada), e o foco volta ao botão primário, que serve de "Tentar de novo". Nenhum toast de sucesso.
- **Formulário de célula:** enquanto ele não passa ao diálogo responsivo (P1) e ao rodapé do E2.04, a falha aparece num `Alert` com `role="alert"` acima dos botões, no lugar do toast vermelho de hoje, com os dados mantidos. O aviso de gravação demorada é o mesmo.
- **Exclusão e restauração (E2.01):** os diálogos de lá já ficam abertos durante o envio e mostram a falha com "tente de novo". Os textos de lá continuam.
- **Sucesso (UXD-10):** o formulário fecha, e o toast é o de hoje. Depois disso, valem as regras de atualização do P44.
- **Nunca uma mensagem técnica:** nem tempo-limite ("statement timeout", 57014), nem nome de função ou de tabela (AQ-5).
- Componentes: os de hoje, mais `Alert` no formulário de célula.

#### T6. Telas sem mudança visual
- **Dashboard:** sem mudança. O ranking "Células por G12" passa a acompanhar as trocas de líder e as mudanças de sexo (RN-08), e Lúcia entra nele (P-HIE-02). Depois de uma gravação, os números chegam do zero (P44).
- **Formulário de membro:** só o rodapé da T5. O seletor de líder, os interruptores e o resto ficam como no E2.02 e no E2.04.
- **Relatórios, Funções, Auditoria e login:** sem mudança.
- **Meus dados:** não mostra nível, liderança nem totais (PO-UX-10).

#### T7. As perguntas Q-1 a Q-3 na tela
Nenhuma resposta muda a estrutura das telas. Mudam só valores, e na Q-2 e na Q-3, uma linha.

- **Q-1. Quem está abaixo de alguém sem liderança.**
  - *Com o padrão (P-HIE-02):* Lúcia aparece com "G12" e "Liderança: Ester Ramos". A C9 aparece como "Lúcia Freitas (G12)", com "G12: Lúcia Freitas". Lúcia entra no ranking "Células por G12".
  - *Com a alternativa (essa descendência sem nível):*
    - em Membros, Lúcia fica sem badge de nível: "—" na coluna Nível (lido como "sem nível"), e, no cartão, só o badge da situação. A Liderança mostra só o líder direto ("Ester Ramos"), porque não há G12;
    - em Células, "Lúcia Freitas", sem parênteses, e "G12: —";
    - na árvore de quem tem Ester como raiz, o nó fica sem badge.
  - Nada novo a desenhar: é a variação "sem nível" do P40.
- **Q-2. Os discípulos do nó divididos por sexo.**
  - *Com o padrão (P-HIE-12):* "10 discípulos · 4 células".
  - *Se a resposta for sim:*
    - no celular, uma linha a mais no nó, embaixo dos totais, em `text-sm text-muted-foreground`: "3 homens e 7 mulheres" (Tiago e Tânia). Só entram as partes diferentes de zero ("2 mulheres"), e a linha some quando o nó não tem discípulos. No singular, "1 homem" e "1 mulher";
    - no computador, entre parênteses depois dos discípulos: "10 discípulos (3 homens e 7 mulheres) · 4 células";
    - não muda a lista de Membros. Precisa de dados novos (AQ-7).
- **Q-3. O G12 nos seletores de membro.**
  - *Com o padrão:* o seletor mostra só o nome, como hoje.
  - *Se a resposta for sim:*
    - cada opção ganha uma segunda linha, em `text-sm text-muted-foreground`: "G12: {nome}" para quem está do nível 144 para baixo, e o rótulo do P40 para pastores, G12 e quem está sem liderança. Por exemplo: "Caio Lima" / "G12: Pedro Alves"; "Pedro Alves" / "G12"; "Ester Ramos" / "Sem liderança";
    - o motivo da opção desabilitada (UXD-12 do E2.04, "Discípulo desta pessoa") vai numa terceira linha;
    - a opção passa de cerca de 40 para 56 px de altura. A busca continua só pelo nome;
    - o valor escolhido e os chips de participantes continuam só com o nome;
    - usa a mesma coluna da AQ-1, nas consultas dos seletores.

### Padrões novos (valem para as próximas telas)
A numeração começa em P40 (ver a nota do início da seção). Este passo também aplica o P6 (badges com contraste), o P8 ("Excluir" no "⋯" do cartão) e o P10 (subtítulo com o alcance), sem mudá-los.

- **P40. Rótulo do nível.** Uma função só, para todas as telas (UXD-1). Ela recebe o nível, a marca de pastor, o sexo e, no nó da árvore, se os dois integrantes são pastores.

  | Situação | Rótulo | Aparência |
  |---|---|---|
  | nível 0, homem / mulher / sem sexo registrado | Pastor / Pastora / Pastor(a) | badge `default` |
  | nó com dois pastores; filtro (E2.07) | Pastores | badge `default` |
  | nível 1 | G12 | badge `outline` |
  | nível 2 / 3 / 4 | 144 / 1.728 / 20.736 | badge `outline` |
  | nível 5 ou mais | Nível 5, Nível 6… | badge `outline` |
  | sem liderança (sem nível e sem líder) | Sem liderança | P6 de aviso: `bg-warning/15`, `border-warning`, `text-foreground` e o ícone `UserX` |
  | sem nível com líder (só na alternativa da Q-1) | — | sem badge, `text-muted-foreground` |

  - **Formas:** o badge, nas listas e na árvore; ou o texto entre parênteses, depois do nome, em `text-muted-foreground font-normal`, onde o badge disputaria espaço com botões (Células).
  - **Badge:** um `span` com `badgeVariants` (o `Badge` do shadcn é um `div`, que não pode ficar dentro de um botão), com `whitespace-nowrap`.
  - **Leitor de tela:** os rótulos só com número (144, 1.728, 20.736) levam o prefixo "nível" em `sr-only`, como já faz o `isNumericLevelLabel`. Na forma entre parênteses, os parênteses ficam `aria-hidden`, e o leitor ouve ", nível 144", ", pastor" ou ", sem liderança". O "—" é lido como "sem nível".
  - **Nunca:** "12" sozinho, "Nível G12", "Nível 0", "Pastor(a)" para quem tem o sexo registrado, nem "Pastores" para uma pessoa só.
- **P41. Liderança de uma pessoa.** O G12 e o líder direto, derivados do nível, sem a própria pessoa e sem repetir nome (RN-10).

  | Situação | Valor | Leitor de tela |
  |---|---|---|
  | pastor | — | Nenhuma |
  | nível 1 (G12) | o líder direto | Líder {Nome} |
  | nível 2 (o líder direto é o G12) | o G12 | G12 e líder {Nome} |
  | nível 3 ou mais | {G12} / {líder direto} | G12 {Nome}, líder {Nome} |
  | sem liderança | Sem liderança | Sem liderança |
  | nível 3 ou mais sem o nome do G12 (dado ausente) | o líder direto | Líder {Nome} |

  - O G12 em `font-medium`. A "/" e o "—" ficam `aria-hidden`, e o texto da coluna "Leitor de tela" vai em `sr-only`.
  - Os nomes quebram linha, sem `truncate`, e não são links (nomes de referência).
  - Nunca mais de dois nomes: o caminho inteiro não aparece em tela nenhuma (P-HIE-10).
- **P42. Totais por extenso.** "{N} discípulos · {N} células".
  - Singular só com 1 ("1 discípulo", "1 célula"); o zero vai no plural ("0 células").
  - O número usa o separador de milhar (`formatCount`: "2.000 discípulos").
  - Cada total é uma unidade com `whitespace-nowrap`: a linha quebra no "·", nunca entre o número e a palavra. O "·" fica `aria-hidden`, e o leitor ouve "2 discípulos, 3 células".
  - Os totais aparecem sempre, inclusive com zero.
  - Na tabela, em duas linhas, uma para cada total, sob o título "Ministério".
  - Nunca "disc." ou "cél.".
- **P43. Pessoa que aparece em outro ponto da árvore.** Vale para qualquer árvore que precise mostrar uma pessoa que já aparece, com os dados dela, em outro nó acima.
  - É um `li` sem botão de abrir, com um ícone decorativo (`CornerLeftUp`), o nome, o rótulo do nível e uma frase que diz onde a pessoa aparece.
  - Não mostra totais nem seta.
  - Tem um botão "Ir para …" (`variant="link"`, 44 px de altura no celular) que rola até o nó de cima, move o foco para ele e o destaca por 2 s, sem animação com `prefers-reduced-motion`.
- **P44. Gravação que muda valores de outras telas.**
  - **Durante o envio:** o botão primário mostra "Salvando…" e fica desabilitado, e o formulário não fecha por "✕", `Esc` nem toque fora. Aos 3 s, aparece "Ainda salvando. Isso pode levar alguns segundos." (`role="status"`).
  - **Na falha:** a mensagem fica no formulário (`role="alert"`), os dados ficam, e o foco volta à ação primária. Nunca um toast de sucesso, nunca uma mensagem técnica.
  - **Depois do sucesso:**
    - a lista que está na tela recarrega, com as linhas em `opacity-60` e `aria-busy="true"` até a resposta, como na troca de página do E1.08;
    - as outras telas cujos valores mudaram (AQ-6) descartam o que estava guardado e carregam do zero na visita seguinte, com o estado de carregando, e não com os valores de antes.
- **P45. Lista densa: cartões até 1023 px.**
  - Uma lista com mais de cinco colunas de dados mostra cartões abaixo de 1024 px (`lg`) e a tabela a partir daí, porque o menu lateral fixo ocupa 256 px a partir de 768 px.
  - Colunas secundárias (foto, telefone) entram só a partir de 1280 px (`xl`). Abaixo disso, vão para dentro da primeira coluna.
  - A troca não pode mostrar o layout errado no primeiro render. O `useIsMobile` devolve `false` no início e faria o celular piscar a tabela. Use um hook que lê `window.matchMedia("(min-width: 1024px)")` já no valor inicial do `useState`, ou troque só por CSS (`lg:hidden` e `hidden lg:block`).
  - As ações do cartão (P8) acompanham o cartão, e não a largura de 768 px.
  - Vale para Membros e Células neste passo. Relatórios pode seguir no E2.12.

Nenhum componente novo do shadcn é necessário: `badge`, `button`, `card`, `table`, `skeleton`, `alert` e `dropdown-menu` já estão em `src/components/ui`. Os ícones `UserX`, `CornerLeftUp` e `PauseCircle` existem no `lucide-react` do projeto.

### Estados
| Estado | Membros (T1) | Células (T2) | Ministérios (T3, T4) | Gravação (T5) |
|---|---|---|---|---|
| Carregando | Como hoje (E1.08). Com o P45, o primeiro render já mostra o layout certo | Como hoje | Raízes: os 4 `Skeleton` de hoje, com `h-16 sm:h-11`, a altura do nó de duas linhas no celular, para a lista não pular. Nó: o ícone girando de hoje | "Salvando…"; aos 3 s, "Ainda salvando…" |
| Depois de salvar | As linhas ficam em `opacity-60` e `aria-busy` até a lista recarregar | Na visita seguinte, carrega do zero, sem o G12 antigo | Na visita seguinte, a árvore abre recolhida e carrega do zero | O formulário fecha, com o toast de hoje |
| Vazio | Como hoje | Como hoje | O estado vazio do E2.02 (T10), só para quem não vê ninguém (DA-6) | — |
| Erro ao carregar | Como hoje | Como hoje | Como hoje: "Não foi possível carregar a árvore." e "Não foi possível carregar os discípulos.", com "Tentar novamente" | — |
| Sem permissão | E2.02 | E2.02 | E2.02 | As recusas da T11 do E2.02 |
| Dado ausente | Sem nível e sem ser pastor: "Sem liderança". Nível 3 ou mais sem o nome do G12: só o líder direto (P41) | Líder sem nível: "(Sem liderança)" e "G12: —" | A raiz de quem está sem liderança: badge "Sem liderança" | — |
| Lista grande | Paginação do E1.08. Totais com milhar ("2.000 discípulos") | Paginação do E1.08 | Expansão do E1.08 (até 100 ids por chamada). Totais com milhar | Até 3 s (RN-08). Mais que isso, o aviso continua até a resposta |
| Queda de conexão no envio | — | — | — | O texto do E2.04 (T7). Na falha do recálculo, o texto do Negócio. Os dados ficam, e o botão primário serve de "Tentar de novo" |

### Textos
Complementam os "Textos de tela" do Negócio, sem mudar termos. Os marcados com † foram definidos pela UX e estão nas pendências (PO-UX-11).

| Onde | Texto |
|---|---|
| Nível (P40) | Pastor · Pastora · Pastor(a) · Pastores · G12 · 144 · 1.728 · 20.736 · Nível 5, Nível 6… · Sem liderança · (leitor de tela †) nível 144 · sem nível |
| Membros: cabeçalho da tabela | Nome · Nível · Liderança · Ministério · Situação † (no lugar de "Status") · Ações. Com 1280 px ou mais, também Celular |
| Membros: cartão | Liderança: {valor} (só para quem tem líder) · {N} discípulos · {N} células |
| Liderança (P41) | {G12} / {líder} · {líder} · — · Sem liderança · (leitor de tela †) G12 {Nome}, líder {Nome} · G12 e líder {Nome} · Líder {Nome} · Nenhuma |
| Totais (P42) | 1 discípulo · {N} discípulos · 1 célula · {N} células |
| Situação (Membros) | Ativo · Inativo |
| Células | {líder} ({nível}) · G12: {nome} · G12: Pastores · G12: — · (leitor de tela †) , nível {nível} · G12: nenhum · Situação † (no lugar de "Status", no cabeçalho da tabela) |
| Ministérios: ajuda † | Toque ou clique num nome para ver os discípulos diretos. Os totais somam todos os níveis abaixo de cada nome, inclusive os discípulos de pessoas inativas, que não aparecem aqui. |
| Ministérios: nó | {Nome} e {Nome} (o "e" só para o leitor de tela, como hoje) · {nível} · {N} discípulos · {N} células |
| Ministérios: referência † | Aparece com o cônjuge, {Nome}, mais acima. · Ir para o casal · (leitor de tela) Ir para {Nome} e {Nome}, mais acima na árvore |
| Gravação † | Ainda salvando. Isso pode levar alguns segundos. |
| Falha no recálculo (Negócio) | Não foi possível salvar as alterações. Tente de novo. |
| Q-2, se adotada † | {N} homens e {N} mulheres · 1 homem · 1 mulher |
| Q-3, se adotada † | G12: {nome} |

### Acessibilidade
- **Nó da árvore:** o nome acessível do botão é "{Nome} e {Nome}, {nível}, {N} discípulos, {N} células", com o estado aberto ou fechado (`aria-expanded`, como hoje). O coração e o "·" ficam `aria-hidden`. O badge dentro do botão é um `span`, e não um `div` (HTML válido).
- **Rótulos do nível (P40):** os só com número levam "nível" para o leitor de tela; na forma entre parênteses, o leitor ouve ", nível 144".
- **Liderança (P41):** o leitor ouve "G12 Pedro Alves, líder André Souza", e não "Pedro Alves barra André Souza". O "—" é lido como "Nenhuma", e o "G12: —" da célula como "G12: nenhum".
- **Referência (P43):** o ícone fica `aria-hidden`, a frase é lida, e o botão tem `aria-label` com os dois nomes. O foco vai para o nó do casal, com um destaque visível que não depende de `:focus-visible` (o navegador não mostra o anel quando o foco vem de um toque).
- **Gravação (P44):** "Ainda salvando…" usa `role="status"` e é anunciado uma vez. A falha usa `role="alert"`, e o foco volta ao botão primário. A lista que recarrega fica com `aria-busy="true"`.
- **Sem depender de cor:** "Sem liderança" tem ícone e texto, "Inativo" tem ícone e texto, e "Pastor" é texto. O nível da célula é texto.
- **Contraste:** 4,5:1 para texto e 3:1 para ícones e bordas, nos dois temas.
  - Os badges do P6 usam `text-foreground` sobre o fundo tingido.
  - Os totais e o nível entre parênteses usam `text-muted-foreground`, medido em 4,80:1 no E1.08.
  - Sai o laranja fixo do "Sem Liderança" e o texto branco sobre `bg-success`.
- **Zoom de 200% e fonte grande:** os nomes, a Liderança, os rótulos e a frase da referência quebram linha, sem `truncate` e sem altura fixa. Os badges não se partem por dentro (`whitespace-nowrap`), mas a linha quebra entre eles.
- **Toque:** "Ir para o casal" tem 44 px de altura no celular. O botão do nó continua com pelo menos 44 px (`py-3` mais a linha do nome). As ações dos cartões seguem o E2.01.
- **Movimento:** a rolagem do "Ir para o casal" e o ícone girando respeitam `prefers-reduced-motion` (`motion-reduce:`).

### Critérios de UX
| ID | Critério | Como verificar |
|---|---|---|
| UX-01 | Na lista de Membros de Rita, em 360×800 (cartões) e em 1280×800 (tabela), o nível aparece como "Pastor" (Samuel), "Pastora" (Magda), "G12" (Pedro e Lúcia), "144" (André), "1.728" (Caio), "20.736" (Gabriel), "Nível 5" (Sônia) e "Sem liderança" (Ester). Um cadastro antigo de pastor sem sexo registrado aparece como "Pastor(a)". Nenhum "12" sozinho, nenhum "Pastor(a)" para quem tem sexo. | teste de componente + teste E2E (massa) |
| UX-02 | Na tabela de Rita, a Liderança é: Samuel "—", Pedro "Samuel Colares", André "Pedro Alves", Caio "Pedro Alves / André Souza", Gabriel "Pedro Alves / Fábio Lima", Ester "Sem liderança" e Lúcia "Ester Ramos". Nos cartões, Samuel e Ester não têm a linha "Liderança", e os demais têm "Liderança: " com o mesmo valor. Na lista de André, Débora mostra "Tânia Rocha / Beatriz Souza", sem link. | teste de componente + teste E2E |
| UX-03 | O cabeçalho da tabela de Membros é Nome, Nível, Liderança, Ministério, Situação e Ações, nessa ordem, em 1024×768. Em 1280×800, entram a foto antes do Nome e o Celular depois dele. O cabeçalho não tem "Nível G12", "Líder" nem "Status". | teste de componente + teste E2E (viewport) |
| UX-04 | Os totais aparecem por extenso: "1 discípulo", "0 células", "2 discípulos · 3 células", "2.000 discípulos". Nenhum "disc." nem "cél." no DOM de Membros e de Ministérios. Na lista, Diego mostra "3 discípulos · 3 células" e Olga "1 discípulo · 1 célula" (os da pessoa). | teste unitário + teste de componente |
| UX-05 | Membros e Células mostram cartões em 360×800 e em 768×1024, e a tabela em 1024×768 e em 1280×800, sem rolagem horizontal em nenhum desses tamanhos, com nomes de 40 caracteres na Liderança. Em 1280×800, o primeiro render já é a tabela, e em 360×800, já são os cartões. | teste E2E (viewport) + teste de componente (`matchMedia` simulado) |
| UX-06 | Em 320×640 e com zoom de 200%, os cartões de Membros e de Células e os nós da árvore até o "Nível 5" quebram linha sem cortar nomes, rótulos nem totais, e sem rolagem horizontal. Um total nunca se parte entre o número e a palavra. | teste E2E (viewport) + inspeção |
| UX-07 | O badge "Sem liderança" tem o ícone e o texto, usa os tokens do P6 (nenhum `bg-orange-500` no DOM) e tem contraste de pelo menos 4,5:1 nos temas claro e escuro. "Ativo" e "Inativo" também seguem o P6, e "Inativo" tem ícone. | inspeção (axe, nos dois temas) |
| UX-08 | Na lista de Células de Rita, depois de cadastrar uma célula de Samuel, uma de Magda e uma de Ester (critério da RN-11): C1 "André Souza (144)" com "G12: Pedro Alves"; a de Samuel "Samuel Colares (Pastor)" com "Pastores"; a de Magda "Magda Colares (Pastora)" com "Pastores"; a de Ester "Ester Ramos (Sem liderança)" com "—"; C9 "Lúcia Freitas (G12)" com "Lúcia Freitas"; C7 "Sônia Castro (Nível 5)" com "Tiago Rocha". O G12 é sempre um nome só. | teste de componente + teste E2E |
| UX-09 | Na árvore de Rita: "Samuel Colares e Magda Colares", "Pastores", "18 discípulos · 8 células"; Pedro e Paula, "G12", "4 discípulos · 4 células"; Tiago e Tânia, "G12", "10 discípulos · 4 células"; André e Beatriz, "144", "3 discípulos · 4 células", sob Pedro e Paula e sob Tiago e Tânia; Diego e Olga, "144", "2 discípulos · 3 células"; Hugo e Vânia, "144", "1 discípulo · 0 células". Com Magda inativa, a raiz é "Samuel Colares", "Pastor". Na árvore de Pedro, o nó é "André Souza", com "2 discípulos · 3 células"; na de Diego, "Beatriz Souza", com "1 discípulo · 1 célula". | teste E2E (massa) |
| UX-10 | Abrir Diego e Olga mostra Lauro e Sônia. Abrir Lauro mostra Olga como referência: sem seta, sem totais, com "20.736", "Aparece com o cônjuge, Diego Reis, mais acima." e "Ir para o casal". Nenhum nó "Diego Reis e Olga Reis" aparece sob Lauro. "Ir para o casal" rola até o nó Diego e Olga, põe o foco nele e o destaca. Abrir Hugo e Vânia mostra Zélia, e Vânia não aparece como referência. | teste E2E |
| UX-11 | O texto de ajuda da árvore é o da tabela de Textos e some no estado vazio. Nenhum texto da tela chama os totais de "discípulos diretos". | teste de componente |
| UX-12 | O nome acessível do nó de Diego e Olga é "Diego Reis e Olga Reis, 144, 2 discípulos, 3 células", com `aria-expanded`. O coração e o "·" não são lidos. O badge dentro do botão é um `span`. | teste de componente + inspeção (leitor de tela) |
| UX-13 | Rita define Tiago como líder de Fábio e salva. Sem recarregar a página:<br>- Membros mostra Fábio com "144" e "Tiago Rocha", Gabriel com "Tiago Rocha / Fábio Lima" e André com "1 discípulo · 1 célula". Enquanto a lista recarrega, as linhas ficam em `opacity-60` e com `aria-busy`;<br>- Células mostra C4 e C10 com "G12: Tiago Rocha" já na primeira lista exibida, sem nunca mostrar "Pedro Alves" vindo do cache;<br>- Ministérios mostra Pedro e Paula com "3 discípulos · 2 células" e Tiago e Tânia com "11 discípulos · 6 células";<br>- o ranking do Dashboard mostra Pedro e Paula com 2 e Tiago e Tânia com 6. | teste E2E |
| UX-14 | Com a falha no recálculo simulada, o formulário de membro mostra "Não foi possível salvar as alterações. Tente de novo." no rodapé, com `role="alert"`, continua aberto e com os dados, devolve o foco ao botão primário e não mostra toast de sucesso. O formulário de célula mostra o mesmo texto num `Alert` acima dos botões. | teste de componente (mock) |
| UX-15 | Com uma resposta simulada de 5 s, "Ainda salvando. Isso pode levar alguns segundos." aparece aos 3 s, e não antes, com `role="status"`. Durante o envio, "✕", `Esc`, o toque fora e "Cancelar" não fecham o formulário. Com a resposta, o formulário fecha e o toast aparece. | teste de componente (relógio simulado) |
| UX-16 | O leitor de tela ouve "nível 144" no badge "144", ", nível 144" depois do líder da célula, "G12 Pedro Alves, líder André Souza" na Liderança de Caio, "Nenhuma" na Liderança de Samuel e "G12: nenhum" na célula de Ester. | teste de componente + inspeção (leitor de tela) |
| UX-17 | Em 360×800, "Ir para o casal" tem pelo menos 44 px de altura, e o botão de cada nó da árvore também. | teste E2E (medida dos elementos) |
| UX-18 | Nenhuma tela mostra o caminho inteiro da liderança: a Liderança tem no máximo dois nomes, e o texto "Samuel Colares / Pedro Alves / André Souza / Fábio Lima" não aparece em lugar nenhum. | teste de componente |
| UX-19 | Nenhuma gravação deste spec mostra mensagem técnica: nada de "statement timeout", "57014", "canceling statement" nem nome de função ou de tabela. | teste de componente (mock) |
| UX-20 | Nenhum estado deste spec depende só de cor, e o contraste é de 4,5:1 para texto e de 3:1 para ícones e bordas, nos temas claro e escuro, em Membros, Células e Ministérios. | inspeção (axe, nos dois temas) |

### Perguntas para o `architect` (dados e contrato)
Em cada uma, a tela tem um comportamento padrão (o mais conservador) se a resposta for "não", menos onde está dito que não há.

- **AQ-1. O G12 do membro na `members_view`** (RN-10, P41).
  - Uma coluna com o nome do G12 (por exemplo, `g12_name`), como nome de referência: aparece mesmo quando o G12 está fora do escopo de quem consulta (RN-06 do E1.08, estendida pela RN-10).
  - O `g12_level` vem nulo para quem está sem liderança (P-HIE-01).
  - A tela deriva a Liderança pelo nível (P41), sem comparar ids, e não precisa de uma segunda consulta: os dois chegam na mesma linha da página.
  - A Q-3, se adotada, usa a mesma coluna nas consultas dos seletores.
  - *Padrão sem isso:* não há. Sem a coluna, a Liderança mostra só o líder direto, como hoje, e a RN-10 não é atendida.
- **AQ-2. O nível do líder na `cells_view`** (RN-11, P40). Confirmar que:
  - `leader_g12_level` vem nulo para o líder sem liderança;
  - a tela pode usar `leader_gender` (que já existe) e `leader_is_pastor` (E2.02) para "(Pastor)", "(Pastora)" e "G12: Pastores".

  Hoje o `formatG12Label` decide "Pastores" pelo nível 0, o que passa a ser correto com a P-HIE-01.
- **AQ-3. O contrato da `ministry_tree_nodes`** (RN-09, T3, T4, P43):
  - `total_disciples` e `total_cells` do nó pela RN-09, sem dupla contagem;
  - o nível da posição (UXD-7): o de quem é discípulo de um dos ids de `_parent_ids`. Nas raízes, o do principal. Hoje é sempre o do principal;
  - o que o rótulo precisa: o sexo de quem dá o nível e se o nó tem dois pastores (por exemplo, `spouse_is_pastor`);
  - a linha de referência:
    - uma marca na linha (por exemplo, `kind = 'spouse_above'`);
    - o nome do cônjuge de cima e os ids do nó do casal, para o "Ir para o casal" achar o nó na tela;
    - sem totais;
    - ela conta em `direct_disciples` do líder dela (Lauro abre e mostra Olga) e nunca abre;
  - `direct_disciples` continua decidindo se o nó abre.
  - *Padrão sem a marca de referência:* não há. Sem ela, ou o casal se repete, o que a RN-09 proíbe, ou Lauro diz "2 discípulos" e abre vazio. A UX-10 depende disso.
- **AQ-4. O cônjuge de cima fora da árvore de quem consulta** (RN-09, T4). A referência só faz sentido quando o nó do casal está na mesma árvore, acima dela.
  - Se o cônjuge de cima estiver invisível, inativo ou acima da raiz do escopo (DA-6 do E2.02), a pessoa de baixo aparece como nó comum, na própria posição. Senão, ela e os discípulos dela sumiriam da árvore.
  - Confirmar que a regra "o casal aparece só na posição do cônjuge mais próximo do topo" (RN-09) é avaliada dentro da árvore de quem consulta.
- **AQ-5. O erro do recálculo e o tempo** (RN-08, T5, P44):
  - um código para a falha no recálculo, para a tela mostrar o texto do Negócio, e não o da queda de conexão (T7 do E2.04) nem o de uma recusa com campo (AQ-1 do E2.04);
  - o tempo-limite das consultas do papel `authenticated` no Supabase (em geral, 8 s) pode cortar a mudança que desloca a árvore inteira, que a RN-08 aceita que demore mais. A tela espera sem limite, com o aviso aos 3 s, mas nunca pode mostrar "canceling statement due to statement timeout" nem o código 57014. Decidir se essa gravação ganha um tempo-limite próprio ou outro caminho.
- **AQ-6. O que cada gravação desatualiza na tela** (P44, UXD-10). Proposta, pelas chaves do TanStack Query de hoje:
  - membro (cadastro, edição, exclusão e restauração): `members` (que inclui a árvore), `cells` e `dashboard`. E `cell_reports`, quando o E2.12 mostrar o G12 nos relatórios;
  - célula (cadastro, edição, exclusão e restauração): `cells`, `members` (totais e árvore) e `dashboard`;
  - a lista que está na tela recarrega (com as linhas "atualizando"). As outras são descartadas (`resetQueries` ou `removeQueries`), para carregarem do zero, e não do cache. Hoje o `MemberForm` só invalida `members`: Células e o Dashboard ficam com o cache, e uma consulta invalidada que não está na tela mostra o valor antigo até a nova resposta chegar.
- **AQ-7. A Q-2, se adotada:** os discípulos do nó por sexo, com as mesmas regras de contagem da RN-09.

### Pendências para o PO (resolvidas em 2026-11-23)
Nenhuma bloqueava o desenho. O PO resolveu todas em 2026-11-23 e registrou as decisões em "Negócio > Decisões > Padrões definidos por este spec" (P-HIE-15 a P-HIE-25), nas RNs, nos critérios e em "Textos de tela". **Revisar no PR.**

- **PO-UX-1. A linha "Liderança" do cartão só para quem tem líder** (UXD-2). Para pastor e para quem está sem liderança, o cartão mostra só o badge do nível. A tabela segue a RN-10 ao pé da letra ("—" e "Sem liderança").
  - *Alternativa:* "Liderança: —" e "Liderança: Sem liderança" também no cartão.
  - ***Resolvida (PO):** aceito (P-HIE-15). A RN-10 ganhou o detalhe do cartão e um critério com os cartões de Samuel, Ester e Caio.*
- **PO-UX-2. O cônjuge que está abaixo do outro aparece como referência sob o próprio líder** (UXD-6, P43, ponto 6 dos Pontos para o `architect`). Ele aparece com o nome e o nível, sem totais e sem abrir, com a frase e o botão "Ir para o casal". A RN-09 continua atendida: o casal aparece uma vez só, e ninguém é contado duas vezes.
  - *Alternativa:* não mostrar nada sob o líder. Lauro ficaria com "2 discípulos" e abriria vazio, ou só com Sônia, sem Olga.
  - ***Resolvida (PO):** aceito (P-HIE-16), com a regra da AQ-4: quando o cônjuge de cima não está na árvore de quem consulta, o de baixo aparece como nó comum. A RN-09 passou a descrever a referência, a contagem no líder dele e essa exceção. Ganhou critérios para Olga sob Lauro, "Ir para o casal", Hugo e Vânia sem referência e a exceção. O ponto 6 dos Pontos para o `architect` foi atualizado.*
- **PO-UX-3. O nível do nó é o da posição** (UXD-7). "Pastores" só quando os dois integrantes são pastores, e "Pastor" ou "Pastora" com um pastor só no nó. A RN-02 fala do "nó de um casal de pastores" e não diz qual nível mostrar no casal de níveis diferentes (Diego, 144, e Olga, 20.736).
  - ***Resolvida (PO):** aceito (P-HIE-17). A RN-02 trata o nó com um pastor só, e a RN-09 define o nível da posição (nas raízes, o do integrante principal). Critérios novos: Diego e Olga com "144", e a raiz só com Samuel, "Pastor", quando Magda está inativa.*
- **PO-UX-4. O texto de ajuda da árvore avisa que os totais incluem os discípulos de pessoas inativas** (UXD-8), até o E2.15 mostrar essas pessoas na árvore.
  - *Alternativa:* não avisar, e aceitar que um nó diga "3 discípulos" e abra com 2.
  - ***Resolvida (PO):** aceito (P-HIE-18). O aviso entrou na RN-09 e em "Textos de tela", com o critério de André e Beatriz (3 discípulos, 2 à vista). "Mostrar essas pessoas na árvore" foi para "Fora de escopo" (E2.15).*
- **PO-UX-5. Os totais aparecem sempre, inclusive com zero** (UXD-5, P42), na lista e na árvore, como no legado. Hoje a árvore esconde o número quando ele é zero.
  - ***Resolvida (PO):** aceito (P-HIE-19), como no legado ("0 discípulos"). Entrou na RN-09 e na RN-10, com critérios para a folha Rita e para Caio.*
- **PO-UX-6. "Situação" no lugar de "Status"** no cabeçalho das tabelas de Membros e de Células. É o termo dos Termos ("Situação: Ativo/Inativo").
  - ***Resolvida (PO):** aceito (P-HIE-20). "Situação" é o termo do cadastro e do filtro do legado. "Status" entrou na lista do que evitar em "Textos de tela".*
- **PO-UX-7. "Sem liderança" com a aparência de aviso** (UXD-4), por ser uma situação que a liderança corrige (E4.04).
  - *Alternativa:* um badge neutro, como os outros níveis. Nos dois casos, com texto e ícone.
  - ***Resolvida (PO):** aceito (P-HIE-21). O Dashboard já trata "sem liderança" como algo a acompanhar, e o saneamento (E4.04) lista esses cadastros. A RN-02 ganhou "com aparência de aviso (ícone e texto)" e um critério.*
- **PO-UX-8. O aviso "Ainda salvando…" aos 3 s, e o formulário que não fecha durante o envio** (UXD-11, P44).
  - ***Resolvida (PO):** aceito (P-HIE-22). A RN-08 ganhou os itens "durante a gravação" e "nenhuma tela mostra o valor anterior" (UXD-10), e a falha passou a aparecer no próprio formulário, sem mensagem técnica. Critérios novos: a resposta de 5 s, a falha com os dados mantidos e Células sem o G12 antigo depois de salvar.*
- **PO-UX-9. O G12 da célula é um nome só** (RN-11), como no legado e no código de hoje. Os wireframes da T1 do E2.01 ("G12: Vera e Wagner") e da T7 do E2.02 ("G12: Pedro e Paula") mostravam o casal; este spec os corrige. Confirmar.
  - ***Resolvida (PO):** confirmado (P-HIE-23). O G12 é uma pessoa: a de nível 1 na cadeia do líder (RN-04), e não o casal. A RN-11 passou a dizer "sempre um nome só, e nunca o casal", com critério. A T1 do E2.01 e a T7 do E2.02 ganharam uma nota apontando para este spec.*
- **PO-UX-10. Ciência: quem não tem função não vê o próprio nível e os totais em nenhuma tela.** Hugo não tem a lista de Membros (E2.02), e "Meus dados" não mostra esses valores. O critério da RN-10 para Hugo ("144", "Tiago", 2 / 0) vale pela API.
  - *Sugestão para um passo futuro, não adotada:* um resumo "Nível · Liderança · totais" no topo de "Meus dados".
  - ***Resolvida (PO):** ciente e aceito (P-HIE-24). A RN-10 e o critério de Hugo passaram a dizer "pela API". O resumo em "Meus dados" foi para "Fora de escopo", como sugestão sem passo.*
- **PO-UX-11. Textos definidos pela UX** (marcados com † em Textos): o texto de ajuda da árvore, a frase da referência e "Ir para o casal", "Ainda salvando…", "Situação", os textos para o leitor de tela e os textos da Q-2 e da Q-3, se adotadas.
  - ***Resolvida (PO):** todos aceitos, sem ajuste (P-HIE-25). Os ligados a uma regra foram copiados para os "Textos de tela" do Negócio. Os da Q-2 e da Q-3 só valem se o usuário adotar essas sugestões.*

## Solução técnica
_Seção do `architect`. Escrita em 2026-11-24, só como desenho: nada foi implementado. **O PR 1 começa depois do PR 1 do E2.02 em produção**, e o recomendado é depois do PR 2 do E2.04 também (ver [Ordem com os outros passos](#ordem-com-os-outros-passos)). O desenho parte do estado final do E2.01, do E2.02 e do E2.04, com os nomes que eles definem. Se um nome ou uma assinatura mudar lá, a tarefa 1 volta ao `architect`._

_Conferido em 2026-11-24, só com leitura:_
- _na stack local `supabase_db_mci-e108-pr2` (E1.08 completo e as migrations 1 a 6 do E2.01):_
  - _os corpos de `compute_g12_level`, `refresh_member_stats_v2`, `enforce_member_write_rules`, `_trg_log_member_event`, `ministry_tree_nodes`, `dashboard_g12_ranking`, `get_ministry_root` e `restore_member`;_
  - _as definições de `members_view` e `cells_view`;_
  - _triggers, constraints, índices e FKs de `members` e `cells`, e os privilégios das funções de trigger;_
  - _quem ainda lê as colunas calculadas (`pg_proc.prosrc` e `pg_get_viewdef`): só as funções e as views citadas acima;_
- _no `mci-connect` (`origin/main`, `fdcbe50`, e a branch do PR 2 do E2.01): `Members.tsx`, `Cells.tsx`, `Ministries.tsx`, `MemberForm.tsx`, `CellForm.tsx`, `src/lib/ministries/tree.ts`, `src/lib/cells/{labels,fields}.ts`, `src/lib/members/fields.ts`, os hooks de lista e de exclusão com as chaves do TanStack Query, a `create-user-admin` e os pgTAP do E1.08 e do E2.01 que usam as colunas calculadas;_
- _na documentação do PostgREST: a partir da versão 12.2, o `statement_timeout` declarado numa função (`CREATE FUNCTION … SET statement_timeout`) passa a valer para a chamada dela por RPC (*hoisted settings*). Isso só entra no plano B do risco 6._

### Revisão das regras
Nenhuma RN voltou ao PO. As lacunas técnicas foram resolvidas pela leitura mais conservadora e estão em [Definidas pelo architect](#definidas-pelo-architect-revisar-no-pr).

Casos de borda conferidos:
- **Fuso e virada de semana:** nenhuma regra deste passo depende de data.
- **Casal:**
  - o vínculo de cônjuge não muda nível nem totais (RN-07), e o trigger de cônjuge não dispara os de hierarquia;
  - os totais do nó (RN-09) sabem se um cônjuge está abaixo do outro pela cadeia guardada.
- **Inativo:** continua na cadeia e não muda de nível. A contagem passa por ele (P-HIE-06).
- **Sem líder:** é topo e não tem nível (P-HIE-01). Os discípulos dele contam a partir dele (P-HIE-02).
- **Pastor:** topo, nível 0. Passar a sem liderança, ou o contrário, muda só o nível dele (RN-03).
- **Excluído:** a linha dele fica congelada, não soma em ninguém e é recalculada na restauração (P-HIE-13).
- **Ciclo e líder excluído:** só aparecem por carga ou por dado antigo, e ficam "sem topo" (DA-2). Uma gravação que criaria ciclo é recusada com a mensagem do E2.04. Nada entra em laço.
- **Consolidado:** ponto de extensão (a flag entra no "conta como discípulo" e no caminho).
- **Concorrência e volume:** ver [Bloqueios e concorrência](#bloqueios-e-concorrência) e [Riscos](#riscos-concorrência-escala-segurança).

Leituras técnicas. Nenhuma muda regra, mas o PO e o QA precisam saber delas:
1. **RN-12 pela API.** As colunas calculadas saem de `members` (DT-10). Um PATCH que manda `g12_level` ou `total_cells` para `members` é recusado pelo PostgREST como coluna inexistente, e nada é gravado. O resultado da regra se mantém (André continua com os valores dele), mas a resposta é uma recusa, e não "ignorado". Ver a DA-1.
2. **Ensaio do cadastro (E2.02, `check_member_insert`).** Ele grava e desfaz. Os totais dos líderes acima mudam dentro do ensaio e voltam junto, sem efeito visível.
3. **"Na mesma operação" e o tempo-limite.** O recálculo roda nos triggers da própria gravação. O tempo-limite de 8 s do papel `authenticated` vale para o PATCH inteiro. Com este desenho, o pior caso medido tem de ficar abaixo de 4 s (risco 6).
4. **Os pgTAP do E1.08 e do E2.01 que gravam totais à mão** (com os triggers desligados) passam a montar a hierarquia com `private.rebuild_member_hierarchy()`. Os que leem `members.total_*` passam a ler as views. É adaptação de teste, sem mudar o que eles provam (tarefa 5).
5. **Ranking "Células por G12".** Ele lê a `members_view` e não muda. Passa a acompanhar a árvore na hora, inclusive Lúcia (P-HIE-02), sem tarefa própria.

#### Respostas aos pontos do PO (Pontos para o `architect`)
| Ponto | Resposta |
|---|---|
| 1. Ordem com o E2.04 | O recomendado é o E2.06 depois do PR 2 do E2.04. Se vier antes, nada entra em laço: o caminho é calculado subindo com a lista dos já visitados, e uma troca de líder que fecharia um ciclo é recusada com `leader_cycle`, o código e a mensagem do E2.04 (DT-08). A migration para, com a lista de ids, se já houver ciclo nos dados. |
| 2. Caminho materializado | Sim: `ancestor_ids` em `private.member_hierarchy`, atualizado na mesma transação e preenchido por `private.rebuild_member_hierarchy()`, que é o backfill desta migration e o recálculo da carga (E4.07). Fica fora de `members`, então não precisa de `GRANT` por coluna (DT-01). |
| 3. Nível nulo | `g12_level` nulo para quem está sem liderança. `compute_g12_level` sai. `get_ministry_root` já foi removida no E2.02. A `members_view`, a `cells_view` e a `ministry_tree_nodes` mantêm os nomes das colunas, e os tipos gerados passam a aceitar nulo. `formatG12Label` e `getLevelLabel` dão lugar ao rótulo único do P40. O ranking não muda (`g12_level = 1`). A regra 3 do E1.03 perde as colunas calculadas (DT-10). |
| 4. Sexo do líder | A troca de sexo passa a recalcular, e a célula de líder sem sexo conta no total e em nenhuma divisão: `total_cells` é guardado à parte, e não como a soma das duas (DT-04). |
| 5. Totais do casal | A cadeia guardada diz se um cônjuge está acima do outro. Com isso, o nó usa os totais do de cima, menos 1 discípulo (DT-13). |
| 6. Casal que não se repete | Contrato da `ministry_tree_nodes` com `kind = 'spouse_above'` e as colunas da AQ-3 ([Árvore de Ministérios](#árvore-de-ministérios-rn-09-aq-3-e-aq-4)). |
| 7. Concorrência | Toda gravação que muda a árvore ou os totais pega a trava da árvore do E2.04: exclusiva para troca de líder e de sexo, compartilhada para o resto. As linhas de totais são travadas uma vez por gravação, em ordem de id. O invariante "igual ao recálculo do zero" é uma função (`private.member_hierarchy_drift()`) que os testes chamam depois de cada cenário (DT-05, DT-09). |
| 8. Tempo | Totais por diferença, em O(profundidade). Só a troca de líder percorre a subárvore, e numa tabela estreita, sem os triggers de `members`. Estimativa: menos de 0,2 s para um G12 com 2 mil pessoas abaixo. O QA mede no volume de referência com metas mais apertadas que as da RN-08. Sem tempo-limite próprio (AQ-5, risco 6). |
| 9. Telas sem valores antigos | Uma função única por entidade, chamada depois de toda gravação: descarta o cache das telas que não estão abertas e recarrega a que está (AQ-6, DT-16). |

#### Definidas pelo architect (revisar no PR)
Pontos que as RNs não respondem por inteiro. O `architect` adotou a leitura mais conservadora e coerente com as RNs. O usuário pode mudar qualquer um no PR.

| # | Ponto | Padrão adotado | Por quê |
|---|---|---|---|
| DA-1 | RN-12 pela API ("o valor enviado é ignorado") | O valor não é gravado, e o PATCH que o manda é recusado como coluna inexistente (PGRST204), em vez de passar em silêncio. Pela tela nada muda, porque o formulário nunca manda essas colunas. | As colunas saem de `members` (DT-01). Mantê-las só para ignorar o valor deixaria uma cópia desatualizada na tabela. A intenção da regra ("ninguém grava, e o calculado continua valendo") se mantém. |
| DA-2 | Membro não excluído cuja cadeia não chega a um topo: líder excluído ou ciclo, só possíveis por carga ou dado antigo | Fica "sem topo": sem cadeia, sem nível e sem G12, e não soma para ninguém acima. A tela mostra "Sem liderança". `private.member_hierarchy_problems()` lista esses cadastros, e o E4.04 e o E4.09 também. Uma troca de líder que levaria alguém para debaixo dele é recusada. | Esses estados ferem a RN-06 do E2.01 e a RN-13 do E2.04, e a RN-01 não tem nível para eles. "Sem liderança" é o mais próximo da situação real (não há liderança válida) e leva a liderança a corrigir. |
| DA-3 | "O cônjuge de cima está na árvore de quem consulta" (AQ-4) | Ele é uma das raízes da árvore de quem consulta (pastores ativos para quem vê a igreja toda, ou as raízes da DA-6 do E2.02) ou tem uma delas na cadeia. Ativo e visível. | A função não sabe o que a tela abriu. Pela árvore, quem chegou até o líder do cônjuge de baixo passou pelo cônjuge de cima. |
| DA-4 | Cônjuge de cima fora da árvore (AQ-4) | O de baixo aparece num nó só com ele, com os próprios totais. O de cima não aparece nesse nó. | "Aparece como um nó comum, na própria posição, com os próprios totais" (RN-09). Juntar o de cima levaria para dentro do ramo alguém que está acima da raiz. |
| DA-5 | Nível do nó quando os dois integrantes são discípulos do nó de cima (casal de ramos diferentes sob o mesmo casal) | O nível do integrante principal | Os dois estão no mesmo nível nesse caso. A regra só precisava de um desempate. |
| DA-6 | Que telas a gravação de membro ou de célula desatualiza (AQ-6) | Membros (inclusive a árvore e os seletores), Células, Relatórios e Dashboard, nas duas entidades. Relatórios entra já agora. | A tela de Relatórios mostra o nome do líder, que muda com a edição do membro. Descartar o cache de uma tela fechada não custa nada, e evita uma tarefa no E2.12. |

### Visão geral
Cinco partes:

1. **Uma tabela própria para os campos calculados (DT-01):** `private.member_hierarchy`, uma linha por membro, com a cadeia (`ancestor_ids`), o nível, o G12 e os totais. Fica fora da API e sai de `members`. Com isso:
   - a gravação dos campos calculados não dispara os triggers de `members` (Auditoria, data de alteração, regras de escrita e, depois, a autoria do E2.05);
   - não disputa a linha de `members` com quem edita o cadastro;
   - ninguém a grava pela API (RN-12), e não há `GRANT` por coluna para lembrar.
2. **Manutenção na mesma transação**, por triggers `AFTER` em `members` e `cells`:
   - a troca de líder recalcula do zero a cadeia, o nível e os totais da subárvore, e passa a diferença para os de cima antigos e novos;
   - o resto (situação, sexo, exclusão, restauração e as células) só soma ou subtrai nos de cima.
3. **Concorrência:** a trava da árvore do E2.04, exclusiva ou compartilhada conforme a gravação, e as linhas de totais travadas em ordem de id. Um recálculo do zero (`private.rebuild_member_hierarchy()`) e a comparação com ele (`private.member_hierarchy_drift()`) servem de backfill, de recálculo da carga e de prova nos testes.
4. **Leitura:**
   - a `members_view` e a `cells_view` leem a tabela nova com os mesmos nomes de coluna, e a `members_view` ganha o G12 (AQ-1);
   - a `ministry_tree_nodes` passa a seguir a RN-09: totais do casal sem dupla contagem, nível da posição e a linha de referência do cônjuge de baixo (AQ-3, AQ-4).
5. **Front:** o rótulo único do nível (P40), a liderança (P41), os totais por extenso (P42), a referência na árvore (P43), a gravação que não fecha e o cache descartado (P44) e os cartões até 1023 px (P45).

### Modelo de dados e migrations

#### Ordem das migrations
Os nomes são sugestões; o timestamp é o do momento da criação.
- Cada arquivo é idempotente (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP … IF EXISTS` antes de `CREATE TRIGGER`, `DO` com guarda de `duplicate_object`) e roda num banco zerado depois das migrations existentes e das do E2.01, do E2.02 e do E2.04.
- **Cada arquivo deixa o banco coerente sozinho**: se a publicação parar no meio, as telas continuam certas.
- As mensagens das guardas trazem só ids, nunca dado pessoal (os logs do GitHub Actions de um repositório público são públicos).
- Depois do PR 1, regenere o `types.ts`.

| # | PR | Arquivo | Conteúdo | Estado depois dele |
|---|---|---|---|---|
| 1 | 1 | `<ts>_e206_01_hierarchy.sql` | Guarda de pré-requisitos e de dados sem topo; tipo e tabela `private.member_hierarchy`, índices e privilégios; funções internas; os 3 triggers novos; backfill (`private.rebuild_member_hierarchy()`); pós-condição (`member_hierarchy_drift()` vazia). **Os triggers antigos continuam**. | As duas formas convivem por segundos: a antiga ainda mantém as colunas de `members`, que as views ainda leem. |
| 2 | 1 | `<ts>_e206_02_read.sql` | `members_view` e `cells_view` lendo a tabela nova (colunas novas no fim); `ministry_tree_nodes` nova (`DROP` e `CREATE`, porque o retorno muda); grants. | As telas leem a tabela nova. As colunas antigas ainda existem, sem leitor. |
| 3 | 1 | `<ts>_e206_03_drop_member_columns.sql` | `enforce_member_write_rules` sem as linhas das colunas calculadas; `DROP` dos triggers `compute_member_g12_level`, `trg_refresh_stats_members` e `trg_refresh_stats_cells` e das funções `compute_g12_level` e `refresh_member_stats_v2`; `DROP COLUMN` de `g12_level`, `total_disciples`, `total_cells`, `male_cells` e `female_cells` em `members`; pós-condição de que nenhum corpo de função lê essas colunas de `members`. | Estado final. |

#### DDL de referência (migration 1)
```sql
-- 0. Pré-requisitos: E2.01 PR 1 (deleted_at, _del_raise) e E2.02 PR 1 (escopo sem g12_level,
--    viewer_tree_roots). Falha cedo, sem mudar nada.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.members'::regclass
                  AND attname = 'deleted_at' AND NOT attisdropped)
     OR to_regprocedure('public._del_raise(text, text, jsonb)') IS NULL
     OR to_regprocedure('public.viewer_tree_roots()') IS NULL
     OR to_regprocedure('public.get_ministry_root(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'E2.06 depende do PR 1 do E2.01 e do PR 1 do E2.02.';
  END IF;
END $$;

-- 1. Guarda (DA-2): membro não excluído cuja cadeia não chega a um topo (ciclo ou líder
--    excluído). Só ids na mensagem.
DO $$
DECLARE _ids uuid[];
BEGIN
  WITH RECURSIVE live AS (SELECT id, leader_id FROM public.members WHERE deleted_at IS NULL),
  tree AS (SELECT id FROM live WHERE leader_id IS NULL
           UNION ALL
           SELECT l.id FROM tree t JOIN live l ON l.leader_id = t.id)
  SELECT array_agg(l.id ORDER BY l.id) INTO _ids
    FROM live l WHERE NOT EXISTS (SELECT 1 FROM tree t WHERE t.id = l.id);
  IF _ids IS NOT NULL THEN
    RAISE EXCEPTION 'E2.06: membros sem topo (ciclo ou líder excluído): %', _ids;
  END IF;
END $$;

-- 2. Campos calculados (DT-01, DT-02, DT-03). Uma linha por membro, inclusive os excluídos
--    (congelados, P-HIE-13).
CREATE TABLE IF NOT EXISTS private.member_hierarchy (
  member_id       uuid PRIMARY KEY REFERENCES public.members (id) ON DELETE CASCADE,
  ancestor_ids    uuid[]  NOT NULL DEFAULT '{}',   -- RN-04: do topo ao líder direto
  g12_level       integer,                          -- RN-01: 0 pastor; nulo sem liderança ou sem topo
  g12_id          uuid GENERATED ALWAYS AS (        -- RN-04: logo abaixo do topo; o próprio no nível 1
                    CASE cardinality(ancestor_ids) WHEN 0 THEN NULL
                                                   WHEN 1 THEN member_id
                                                   ELSE ancestor_ids[2] END) STORED,
  total_disciples integer NOT NULL DEFAULT 0,       -- RN-05
  total_cells     integer NOT NULL DEFAULT 0,       -- RN-06: todas, inclusive de líder sem sexo
  male_cells      integer NOT NULL DEFAULT 0,
  female_cells    integer NOT NULL DEFAULT 0,
  CONSTRAINT member_hierarchy_level_check
    CHECK (g12_level IS NULL OR g12_level = cardinality(ancestor_ids)),
  CONSTRAINT member_hierarchy_not_own_ancestor_check
    CHECK (NOT member_id = ANY (ancestor_ids)),
  CONSTRAINT member_hierarchy_totals_check
    CHECK (total_disciples >= 0 AND male_cells >= 0 AND female_cells >= 0
           AND total_cells >= male_cells + female_cells)
);
-- "Abaixo de X" (E2.07, testes, troca de líder): ancestor_ids @> ARRAY[X].
CREATE INDEX IF NOT EXISTS member_hierarchy_ancestor_ids_idx
  ON private.member_hierarchy USING gin (ancestor_ids);
-- Filtros e ranking por G12 e por nível (E2.07, E2.10, E2.12, E2.14).
CREATE INDEX IF NOT EXISTS member_hierarchy_g12_id_idx
  ON private.member_hierarchy (g12_id) WHERE g12_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS member_hierarchy_g12_level_idx
  ON private.member_hierarchy (g12_level);

ALTER TABLE private.member_hierarchy ENABLE ROW LEVEL SECURITY;          -- sem políticas
REVOKE ALL ON TABLE private.member_hierarchy FROM PUBLIC, anon, authenticated, service_role;

-- Diferença a somar numa linha (dentro de DO com guarda de duplicate_object).
CREATE TYPE private.hierarchy_delta AS (
  member_id uuid, disciples integer, cells integer, male integer, female integer);
```
- **`g12_level` e o pastor:** para quem tem líder, o nível é o tamanho da cadeia; no topo, 0 se for pastor e nulo se não for. O `CHECK` garante isso para todos menos o topo, porque o "é pastor" está em `members`.
- **Por que guardar `g12_id` gerado:** é o 2º elemento da cadeia, sem regra própria, e indexado para os filtros por G12 dos passos seguintes.
- **Por que `total_cells` à parte:** a célula de líder sem sexo conta no total e em nenhuma divisão (RN-06, P-HIE-08). Com o E2.04, `total_cells = male_cells + female_cells` sempre.
- **Sem FK em `g12_id` e em `ancestor_ids`:** são derivados. Uma FK faria cada atualização travar a linha do G12 em `members` (`FOR KEY SHARE`) e disputaria com a exclusão do E2.01.

#### Integridade garantida pelo banco
| Garantia | Como |
|---|---|
| Todo membro tem uma linha (RN-01, RN-05) | Trigger `AFTER INSERT` e o backfill; `member_hierarchy_drift()` lista as que faltam; a FK com `CASCADE` não deixa linha órfã |
| Nível coerente com a cadeia | `member_hierarchy_level_check` |
| Ninguém na própria cadeia | `member_hierarchy_not_own_ancestor_check` |
| G12 sempre o 2º da cadeia | coluna gerada |
| Totais nunca negativos; total ≥ masculinas + femininas | `member_hierarchy_totals_check`. Uma diferença que deixaria negativo é recusada como falha no recálculo |
| Ninguém grava pela API (RN-12) | schema `private`, fora dos *Exposed schemas*, RLS sem política e sem privilégio para `anon`, `authenticated` e `service_role`. Só as funções *definer* (donas `postgres`) escrevem |
| Igual ao recálculo do zero (RN-08) | trava da árvore e travas de linha em ordem ([Bloqueios](#bloqueios-e-concorrência)); a prova é `member_hierarchy_drift()` vazia depois de cada cenário de teste |

### Manutenção na mesma operação (migration 1)

#### Funções
As funções de trigger ficam em `public`, com o prefixo `_hierarchy_` e sem EXECUTE para `PUBLIC`, `anon`, `authenticated` e `service_role`, como as de trigger do E2.01. As auxiliares e as de conferência ficam em `private`, sem grants. Todas são `SECURITY DEFINER SET search_path = public`, menos as `IMMUTABLE`.

| Função | O que faz |
|---|---|
| `private.hierarchy_path(_leader_id uuid, OUT ancestor_ids uuid[], OUT resolved boolean, OUT visited uuid[])` | Sobe por `members` a partir do líder, só por não excluídos, guardando os visitados. `resolved` é falso num ciclo, num líder excluído ou num id inexistente; nesse caso, `ancestor_ids` volta vazio. Nunca entra em laço (DT-08). |
| `private.hierarchy_level(_ancestor_ids uuid[], _resolved boolean, _has_leader boolean, _is_pastor boolean) RETURNS integer` (`IMMUTABLE`) | RN-01: nulo sem topo; com líder, `cardinality(_ancestor_ids)`; topo pastor, 0; topo sem liderança, nulo. |
| `private.hierarchy_spread(_ids uuid[], _disciples int, _cells int, _male int, _female int) RETURNS private.hierarchy_delta[]` (`IMMUTABLE`) | A mesma diferença para cada id. |
| `private.hierarchy_cell_spread(_leader_id uuid, _sign integer) RETURNS private.hierarchy_delta[]` | Uma célula a mais (`_sign = 1`) ou a menos (`-1`) no líder e na cadeia guardada dele, na divisão do sexo atual do líder. Líder excluído (só por carga): nada, como no recálculo do zero. |
| `private.hierarchy_apply(_deltas private.hierarchy_delta[])` | Soma as diferenças por id, ignora as que dão zero, trava as linhas em ordem de `member_id` e grava. Linha que falta ou total negativo: `hierarchy_update_failed`. |
| `private.hierarchy_fail(_reason text)` | `_del_raise('hierarchy_update_failed', …)` com o `reason` ([Formato dos erros](#formato-dos-erros-aq-5)). |
| `private.hierarchy_recompute_subtree(_root uuid, _ancestor_ids uuid[], _resolved boolean)` | Cadeia, nível e totais do zero para `_root` e a subárvore viva dele. |
| `public._hierarchy_lock_member()` | Trigger `BEFORE`: pega a trava da árvore. |
| `public._hierarchy_on_member()`, `public._hierarchy_on_cell()` | Triggers `AFTER`: o que cada gravação faz (tabela abaixo). |
| `private.member_hierarchy_expected()` | Os valores do zero, para todos os membros não excluídos. A fórmula única da RN-13. |
| `private.rebuild_member_hierarchy() RETURNS integer` | Backfill e recálculo da carga (E4.07): cria as linhas que faltam e grava os valores do zero. Pega a trava exclusiva. Devolve quantas linhas mudaram. |
| `private.member_hierarchy_drift()` | `(member_id, problem, stored jsonb, expected jsonb)`: linha que falta, valor diferente do zero, excluído com total. Tem de voltar vazia. |
| `private.member_hierarchy_problems()` | `(problem, member_id)`: `no_top` (DA-2), `cell_leader_deleted` (célula ativa e não excluída com líder excluído) e `no_leadership_with_disciples` (P-HIE-02, para o E4.04). |

#### Caminho, nível e G12
- A cadeia de X é `hierarchy_path(X.leader_id).ancestor_ids`, que termina no líder direto. Ela é calculada subindo por `members`, a fonte da verdade, e não copiada da linha do líder. Assim, o trigger e o recálculo do zero dão sempre a mesma resposta, inclusive no que está "sem topo".
- O nível vem de `hierarchy_level` e o G12, da coluna gerada.
- **A troca de líder de X** (inclusive ganhar ou perder o líder) recalcula X e a subárvore viva dele do zero. É uma descida pelo índice de `leader_id`, que monta a cadeia nova de cada um, e uma atualização só na tabela estreita. Os excluídos ficam de fora da descida (P-HIE-13).
- **Pastor ↔ sem liderança** (sem líder) muda só o nível do próprio (RN-03).
- **O excluído** não muda mais. Na restauração, a linha dele é recalculada com o líder que ele tiver (RN-16 a do E2.01).

#### Totais: o pacote de cada membro
O que um membro X leva para cada pessoa acima dele é o **pacote**:
- discípulos: 1 se X está ativo e não excluído, mais `total_disciples` de X;
- células: `total_cells`, `male_cells` e `female_cells` de X, que já incluem as células do próprio X.

Toda mudança tira o pacote antigo dos de cima antigos e põe o pacote novo nos de cima novos. Os de cima que são os mesmos se anulam (`hierarchy_apply` soma por id), então trocar um líder por outro do mesmo pastor não toca no pastor. O inativo leva o próprio `total_disciples` para cima, que é a contagem que passa por ele (P-HIE-06).

#### O que cada gravação faz
| Gravação | Trava da árvore | Linha do próprio | De cima (ancestrais) |
|---|---|---|---|
| Cadastro de membro | compartilhada | nasce com a cadeia do líder, o nível e totais zero | +1 discípulo, se ativo |
| Ativo ↔ inativo | compartilhada | — | ±1 discípulo |
| Troca de líder (inclusive ganhar ou perder) | exclusiva | cadeia, nível e totais dele e da subárvore viva, do zero | −pacote antigo nos antigos; +pacote novo nos novos |
| Pastor ↔ sem liderança | compartilhada | só o nível | — |
| Sexo | exclusiva | as células próprias trocam de divisão | a mesma troca de divisão (RN-07) |
| Exclusão (E2.01) | compartilhada | congela | −pacote (é folha, então −1 se ativo) |
| Restauração (E2.01) | exclusiva se o líder mudou (DA-3 do E2.01), senão compartilhada | cadeia e nível pelo líder atual; totais do zero | +pacote |
| Exclusão física (só a *service role*) | compartilhada | some, pela FK | −1, se ativo e não excluído. As FKs garantem que não tem discípulos nem células |
| Célula: cadastro, troca de líder, ativa ↔ inativa, exclusão, restauração, exclusão física | compartilhada | — | ±1 célula na divisão do sexo do líder, no líder e em todos acima dele. Na troca de líder, −1 na cadeia antiga e +1 na nova |
| Qualquer outra coluna (nome, cônjuge, batismo, timóteo, anfitrião, tipo, dia, endereço…) | — | — | — (RN-07) |

Os triggers só disparam nas colunas da regra (`UPDATE OF`), então as outras gravações não pagam nada.

#### Código de referência
```sql
-- Trava da árvore (DT-05, DT-06). BEFORE, depois dos triggers de escopo (ac_enforce_member_scope)
-- e antes das regras do E2.04 (ad_), que pegam as travas de identificador: árvore antes de
-- identificador, como na ordem do E2.04. Exclusiva sempre que o líder muda (superconjunto
-- do ad_), então o ad_ nunca precisa "subir" de compartilhada para exclusiva.
CREATE OR REPLACE FUNCTION public._hierarchy_lock_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.leader_id IS DISTINCT FROM OLD.leader_id
                           OR NEW.gender IS DISTINCT FROM OLD.gender) THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('members:leader-tree', 0));
  ELSIF TG_OP <> 'UPDATE'
     OR NEW.is_active  IS DISTINCT FROM OLD.is_active
     OR NEW.is_pastor  IS DISTINCT FROM OLD.is_pastor
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    PERFORM pg_advisory_xact_lock_shared(hashtextextended('members:leader-tree', 0));
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

CREATE TRIGGER ac_lock_member_tree
  BEFORE INSERT OR UPDATE OF leader_id, is_pastor, is_active, gender, deleted_at OR DELETE
  ON public.members FOR EACH ROW EXECUTE FUNCTION public._hierarchy_lock_member();
CREATE TRIGGER trg_member_hierarchy
  AFTER INSERT OR UPDATE OF leader_id, is_pastor, is_active, gender, deleted_at OR DELETE
  ON public.members FOR EACH ROW EXECUTE FUNCTION public._hierarchy_on_member();
CREATE TRIGGER trg_cell_hierarchy
  AFTER INSERT OR UPDATE OF leader_id, is_active, deleted_at OR DELETE
  ON public.cells FOR EACH ROW EXECUTE FUNCTION public._hierarchy_on_cell();

-- Diferenças por id, uma trava por chamada, em ordem de id (DT-05).
CREATE OR REPLACE FUNCTION private.hierarchy_apply(_deltas private.hierarchy_delta[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _net private.hierarchy_delta[]; _n integer;
BEGIN
  -- 0. Soma por id e tira os zeros: os de cima comuns ao antes e ao depois se anulam.
  SELECT array_agg(ROW(x.member_id, x.disciples, x.cells, x.male, x.female)::private.hierarchy_delta
                   ORDER BY x.member_id)
    INTO _net
    FROM (SELECT d.member_id, sum(d.disciples)::int AS disciples, sum(d.cells)::int AS cells,
                 sum(d.male)::int AS male, sum(d.female)::int AS female
            FROM unnest(_deltas) d GROUP BY d.member_id) x
   WHERE (x.disciples, x.cells, x.male, x.female) <> (0, 0, 0, 0);
  IF _net IS NULL THEN RETURN; END IF;
  -- 1. Trava em ordem de id, numa leitura só.
  PERFORM 1 FROM private.member_hierarchy h
   WHERE h.member_id IN (SELECT (x).member_id FROM unnest(_net) x)
   ORDER BY h.member_id FOR UPDATE;
  -- 2. Grava. Um CHECK violado (total negativo) ou uma linha a menos vira hierarchy_update_failed.
  BEGIN
    UPDATE private.member_hierarchy h
       SET total_disciples = h.total_disciples + x.disciples,
           total_cells     = h.total_cells     + x.cells,
           male_cells      = h.male_cells      + x.male,
           female_cells    = h.female_cells    + x.female
      FROM unnest(_net) x WHERE h.member_id = x.member_id;
    GET DIAGNOSTICS _n = ROW_COUNT;
  EXCEPTION WHEN check_violation THEN
    PERFORM private.hierarchy_fail('negative_total');
  END;
  IF _n <> cardinality(_net) THEN PERFORM private.hierarchy_fail('missing_row'); END IF;
END $$;

-- Membros (AFTER). Esqueleto; a tabela "O que cada gravação faz" é a especificação.
CREATE OR REPLACE FUNCTION public._hierarchy_on_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _h     private.member_hierarchy;
  _p     record;                                -- hierarchy_path: ancestor_ids, resolved, visited
  _back  boolean;                               -- restauração
  _n     integer;
  _sm    integer := 0;
  _sf    integer := 0;
  _d     private.hierarchy_delta[] := '{}';
BEGIN
  IF TG_OP = 'INSERT' THEN
    _p := private.hierarchy_path(NEW.leader_id);
    INSERT INTO private.member_hierarchy (member_id, ancestor_ids, g12_level)
    VALUES (NEW.id, _p.ancestor_ids,
            CASE WHEN NEW.deleted_at IS NULL THEN
              private.hierarchy_level(_p.ancestor_ids, _p.resolved, NEW.leader_id IS NOT NULL, NEW.is_pastor) END);
    IF NEW.is_active AND NEW.deleted_at IS NULL THEN
      PERFORM private.hierarchy_apply(private.hierarchy_spread(_p.ancestor_ids, 1, 0, 0, 0));
    END IF;
    RETURN NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN                      -- a linha já saiu pela FK; sobe por members
    IF OLD.is_active AND OLD.deleted_at IS NULL THEN
      _p := private.hierarchy_path(OLD.leader_id);
      PERFORM private.hierarchy_apply(private.hierarchy_spread(_p.ancestor_ids, -1, 0, 0, 0));
    END IF;
    RETURN NULL;
  END IF;

  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NOT NULL THEN
    RETURN NULL;                                -- excluído: congelado (P-HIE-13)
  END IF;
  SELECT * INTO _h FROM private.member_hierarchy WHERE member_id = NEW.id;
  IF NOT FOUND THEN PERFORM private.hierarchy_fail('missing_row'); END IF;
  _back := OLD.deleted_at IS NOT NULL;

  -- 1. Sai o pacote antigo dos de cima antigos (o excluído não somava nada).
  IF NOT _back THEN
    _d := private.hierarchy_spread(_h.ancestor_ids,
            -(OLD.is_active::int + _h.total_disciples), -_h.total_cells, -_h.male_cells, -_h.female_cells);
  END IF;

  IF NEW.deleted_at IS NOT NULL THEN            -- 2a. exclusão: nada entra
    PERFORM private.hierarchy_apply(_d);
    RETURN NULL;
  END IF;

  IF NEW.leader_id IS DISTINCT FROM OLD.leader_id OR _back THEN
    -- 2b. Posição nova: a subárvore viva do zero, sob a trava exclusiva (ou X é folha, na restauração).
    _p := private.hierarchy_path(NEW.leader_id);
    IF NOT _p.resolved AND NOT _back THEN
      IF NEW.id = ANY (_p.visited) THEN         -- reserva do E2.04 (RN-13 de lá), mesma mensagem
        PERFORM public._del_raise('leader_cycle',
          'O líder escolhido é discípulo desta pessoa (direto ou indireto). Escolha outro líder.',
          '{"field": "leader_id"}');
      END IF;
      PERFORM private.hierarchy_fail('no_top');   -- DA-2
    END IF;
    PERFORM private.hierarchy_recompute_subtree(NEW.id, _p.ancestor_ids, _p.resolved);
    SELECT * INTO _h FROM private.member_hierarchy WHERE member_id = NEW.id;
  ELSE
    IF NEW.gender IS DISTINCT FROM OLD.gender THEN   -- 2c. sexo: as células próprias mudam de divisão
      SELECT count(*) INTO _n FROM public.cells c
       WHERE c.leader_id = NEW.id AND c.is_active AND c.deleted_at IS NULL;
      _sm := _n * (coalesce(NEW.gender = 'M', false)::int - coalesce(OLD.gender = 'M', false)::int);
      _sf := _n * (coalesce(NEW.gender = 'F', false)::int - coalesce(OLD.gender = 'F', false)::int);
      _d  := _d || ROW(NEW.id, 0, 0, _sm, _sf)::private.hierarchy_delta;
      _h.male_cells := _h.male_cells + _sm;
      _h.female_cells := _h.female_cells + _sf;
    END IF;
    IF NEW.is_pastor IS DISTINCT FROM OLD.is_pastor AND NEW.leader_id IS NULL THEN   -- 2d. RN-03
      UPDATE private.member_hierarchy SET g12_level = CASE WHEN NEW.is_pastor THEN 0 END
       WHERE member_id = NEW.id;
    END IF;
  END IF;

  -- 3. Entra o pacote novo nos de cima novos. Os comuns se anulam.
  _d := _d || private.hierarchy_spread(_h.ancestor_ids,
          NEW.is_active::int + _h.total_disciples, _h.total_cells, _h.male_cells, _h.female_cells);
  PERFORM private.hierarchy_apply(_d);
  RETURN NULL;
END $$;

-- Subárvore do zero (troca de líder e restauração).
CREATE OR REPLACE FUNCTION private.hierarchy_recompute_subtree(_root uuid, _ancestor_ids uuid[], _resolved boolean)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE sub AS (
    SELECT m.id, m.leader_id, m.is_pastor, m.is_active, m.gender, _ancestor_ids AS ancestor_ids
      FROM public.members m WHERE m.id = _root
    UNION ALL
    SELECT c.id, c.leader_id, c.is_pastor, c.is_active, c.gender, s.ancestor_ids || s.id
      FROM sub s JOIN public.members c ON c.leader_id = s.id
     WHERE c.deleted_at IS NULL
       AND NOT c.id = ANY (s.ancestor_ids || s.id)            -- guarda contra ciclo
  ),
  inside AS (                                                  -- a cadeia de cada um a partir de _root
    SELECT s.*, s.ancestor_ids[cardinality(_ancestor_ids) + 1 :] AS within FROM sub s
  ),
  disc AS (
    SELECT a AS id, count(*)::int AS n FROM inside i, unnest(i.within) a WHERE i.is_active GROUP BY a
  ),
  cel AS (
    SELECT o AS id, count(*)::int AS total,
           count(*) FILTER (WHERE l.gender = 'M')::int AS male,
           count(*) FILTER (WHERE l.gender = 'F')::int AS female
      FROM public.cells c JOIN inside l ON l.id = c.leader_id, unnest(l.within || l.id) o
     WHERE c.is_active AND c.deleted_at IS NULL
     GROUP BY o
  )
  UPDATE private.member_hierarchy h
     SET ancestor_ids    = CASE WHEN _resolved THEN i.ancestor_ids ELSE '{}' END,
         g12_level       = private.hierarchy_level(i.ancestor_ids, _resolved, i.leader_id IS NOT NULL, i.is_pastor),
         total_disciples = coalesce(d.n, 0),
         total_cells     = coalesce(c.total, 0),
         male_cells      = coalesce(c.male, 0),
         female_cells    = coalesce(c.female, 0)
    FROM inside i LEFT JOIN disc d ON d.id = i.id LEFT JOIN cel c ON c.id = i.id
   WHERE h.member_id = i.id
$$;

-- Células (AFTER).
CREATE OR REPLACE FUNCTION public._hierarchy_on_cell()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _old boolean := TG_OP <> 'INSERT' AND OLD.leader_id IS NOT NULL AND OLD.is_active AND OLD.deleted_at IS NULL;
  _new boolean := TG_OP <> 'DELETE' AND NEW.leader_id IS NOT NULL AND NEW.is_active AND NEW.deleted_at IS NULL;
  _d   private.hierarchy_delta[] := '{}';
BEGIN
  IF NOT (_old OR _new) OR (_old AND _new AND OLD.leader_id = NEW.leader_id) THEN RETURN NULL; END IF;
  PERFORM pg_advisory_xact_lock_shared(hashtextextended('members:leader-tree', 0));
  -- private.hierarchy_cell_spread(líder, ±1): o líder e a cadeia guardada dele, na divisão do
  -- sexo atual dele. Líder excluído (só por carga): nada, como no recálculo do zero.
  IF _old THEN _d := _d || private.hierarchy_cell_spread(OLD.leader_id, -1); END IF;
  IF _new THEN _d := _d || private.hierarchy_cell_spread(NEW.leader_id,  1); END IF;
  PERFORM private.hierarchy_apply(_d);
  RETURN NULL;
END $$;
```

`private.member_hierarchy_expected()` é a mesma conta em conjunto, para todos:
```sql
WITH RECURSIVE
live  AS (SELECT id, leader_id, is_pastor, is_active, gender FROM public.members WHERE deleted_at IS NULL),
tree  AS (SELECT l.id, '{}'::uuid[] AS ancestor_ids FROM live l WHERE l.leader_id IS NULL
          UNION ALL
          SELECT c.id, t.ancestor_ids || t.id FROM tree t JOIN live c ON c.leader_id = t.id),
          -- a partir dos topos não há ciclo alcançável: quem está num ciclo não tem topo
paths AS (SELECT l.*, coalesce(t.ancestor_ids, '{}') AS ancestor_ids, t.id IS NOT NULL AS resolved
            FROM live l LEFT JOIN tree t ON t.id = l.id),
disc  AS (SELECT a AS id, count(*)::int AS n FROM paths p, unnest(p.ancestor_ids) a
           WHERE p.is_active GROUP BY a),
cel   AS (SELECT o AS id, count(*)::int AS total,
                 count(*) FILTER (WHERE l.gender = 'M')::int AS male,
                 count(*) FILTER (WHERE l.gender = 'F')::int AS female
            FROM public.cells c JOIN paths l ON l.id = c.leader_id, unnest(l.ancestor_ids || l.id) o
           WHERE c.is_active AND c.deleted_at IS NULL GROUP BY o)
SELECT p.id, p.ancestor_ids,
       private.hierarchy_level(p.ancestor_ids, p.resolved, p.leader_id IS NOT NULL, p.is_pastor),
       coalesce(d.n, 0), coalesce(c.total, 0), coalesce(c.male, 0), coalesce(c.female, 0)
  FROM paths p LEFT JOIN disc d ON d.id = p.id LEFT JOIN cel c ON c.id = p.id;
```
- `private.rebuild_member_hierarchy()` pega a trava exclusiva, cria as linhas que faltam (a carga em `replica` não dispara o `AFTER INSERT`), grava os valores de `member_hierarchy_expected()` onde forem diferentes e zera os totais de excluídos. Ela roda como `postgres`, sem o tempo-limite de `authenticated`.
- Ninguém fica de fora: quem está "sem topo" recebe cadeia vazia e nível nulo, e não soma para ninguém. É o mesmo que o trigger faz (DA-2).

### Bloqueios e concorrência
**Ordem global de aquisição**, que estende a do E2.01 e a do E2.04:
1. as linhas de negócio: o relatório, a célula, o membro gravado e as travas de linha do E2.01 (`FOR UPDATE` nas RPCs de exclusão, `FOR KEY SHARE` nas pessoas escolhidas);
2. a trava `admin-members` (E2.02);
3. **a trava da árvore** (`members:leader-tree`, a mesma chave do E2.04): exclusiva na troca de líder e de sexo e no recálculo do zero; compartilhada no resto que muda a árvore ou os totais;
4. as travas de identificador (E2.04);
5. **as linhas de `private.member_hierarchy`**, uma vez por gravação de linha, em ordem de `member_id`;
6. os eventos da Auditoria.

Em membros, a trava da árvore vem do trigger `BEFORE` `ac_lock_member_tree`, antes do `ad_` do E2.04. Em células, vem do trigger `AFTER`, depois das travas de linha do E2.01. Em `READ COMMITTED`, cada comando PL/pgSQL tira uma foto nova, então o que vem depois da trava enxerga o que a outra transação acabou de gravar.

Por que isso dá "igual ao recálculo do zero" (RN-08):
- **Troca de líder e de sexo** são exclusivas: nenhuma outra gravação que mexe em árvore ou totais roda ao mesmo tempo. A subárvore é recalculada do zero, e os pacotes saem e entram por diferença.
- **As demais** são compartilhadas entre si: rodam juntas, mas a cadeia de cada uma não muda enquanto ela roda, porque toda mudança de cadeia é exclusiva. As diferenças (`total = total + d`) são aplicadas sobre a versão mais nova de cada linha, em ordem de id. Somas comutam, então a ordem entre elas não importa.
- **Por que a tabela à parte evita *deadlock*:** se os campos calculados ficassem em `members`, mover um G12 atualizaria as linhas dos 2 mil discípulos em `members`. Quem estivesse inativando um deles teria a linha dele presa e esperaria a trava da árvore, e o movimento esperaria a linha: *deadlock*. Na tabela à parte, o movimento só grava em `private.member_hierarchy`, que ninguém trava antes da trava da árvore.

Os casos dos critérios e os cenários do QA:
- **Fábio para Tiago × a C4 inativada (critério da RN-08):** se a troca vem antes, a inativação espera a trava, e depois tira 1 célula da cadeia nova de Gabriel (Fábio, Tiago, Samuel). Se a inativação vem antes, a troca espera e recalcula a subárvore de Fábio já sem a C4. Nos dois casos: Tiago 8 / 4 (3/1), Fábio 1 / 1, Samuel 12 / 5.
- **Sexo de Gabriel × uma célula nova de Gabriel:** a célula espera a troca (ou o contrário) e conta na divisão certa.
- **Inativar Caio × mover André:** a inativação espera a troca e tira 1 da cadeia nova.
- **Duas células novas na mesma cadeia:** as duas travam as mesmas linhas em ordem de id, uma espera a outra, e as duas somam.
- **Excluir um discípulo × mover o líder dele:** a exclusão espera a trava e tira 1 da cadeia nova.
- **Duas trocas de líder:** em fila, pela trava exclusiva (já era assim no E2.04).

Casos aceitos com *deadlock* detectado (40P01), raros, que a tela mostra com "Tente de novo." (RN-08):
- uma gravação de várias linhas num comando só (manutenção ou carga com os triggers ligados): cada linha trava em ordem, mas não todas juntas;
- trocar o líder e o cônjuge de X ao mesmo tempo em que o cônjuge novo é excluído (o trigger de cônjuge pega a linha depois da trava da árvore);
- os do risco 3 do E2.01.

### Leitura (migration 2)

#### Views
`CREATE OR REPLACE VIEW`, com as mesmas colunas na mesma ordem e as novas **no fim** (risco 5 do E1.08). Continuam *security definer* com `security_barrier`, donas `postgres` e só com SELECT para `authenticated`. As junções com `private.member_hierarchy` usam o privilégio da dona da view.

| View | Mudança |
|---|---|
| `members_view` | `LEFT JOIN private.member_hierarchy h ON h.member_id = m.id` e `LEFT JOIN members g ON g.id = h.g12_id`. `g12_level` passa a `h.g12_level` (nulo para quem está sem liderança); `total_disciples`, `total_cells`, `male_cells` e `female_cells` passam a `coalesce(h.…, 0)`. **No fim:** `g12_id uuid` e `g12_name text` (o nome de referência do G12, sem filtro de escopo nem de excluído, RN-10, AQ-1). O `WHERE` não muda. |
| `cells_view` | `LEFT JOIN private.member_hierarchy hl ON hl.member_id = c.leader_id` e `LEFT JOIN members g ON g.id = hl.g12_id`. `leader_g12_level` passa a `hl.g12_level`; `g12_leader_id` a `hl.g12_id`; `g12_leader_name` a `g.name`. Sai a subconsulta recursiva da DT-25 do E2.02. `leader_gender` e `leader_is_pastor` (E2.02) continuam. Nenhuma coluna nova. |
| `members_deleted_view`, `cells_deleted_view` | Sem mudança (não mostram nível nem totais). |

- As junções são por chave primária e são descartadas pelo planejador quando a consulta não pede as colunas delas (a contagem das listas, por exemplo). O QA confere com `EXPLAIN`.
- A `dashboard_g12_ranking` e a `dashboard_summary` leem a `members_view` e não mudam. O ranking passa a seguir a árvore na hora (RN-08) e inclui quem está logo abaixo de alguém sem liderança (P-HIE-02).

#### Árvore de Ministérios (RN-09, AQ-3 e AQ-4)
`ministry_tree_nodes` muda o retorno, então a migration faz `DROP FUNCTION` e `CREATE`, com os grants de novo (`REVOKE … FROM PUBLIC, anon`, `GRANT … TO authenticated`). As colunas de hoje ficam, na mesma ordem, e as novas vão no fim:

```sql
CREATE FUNCTION public.ministry_tree_nodes(_parent_ids uuid[] DEFAULT NULL)
RETURNS TABLE (
  member_id uuid, member_name text, member_gender text,
  g12_level integer,          -- E2.06: o nível da POSIÇÃO (UXD-7), e não mais o do principal
  is_pastor boolean,          -- do principal
  spouse_id uuid, spouse_name text,
  direct_disciples bigint,    -- decide se o nó abre (E1.08); 0 na referência
  total_disciples integer,    -- RN-09; nulo na referência
  total_cells integer,        -- RN-09; nulo na referência
  -- E2.06, no fim:
  kind text,                  -- 'node' | 'spouse_above'
  level_member_id uuid,       -- quem dá o nível da posição
  level_gender text,          -- sexo de quem dá o nível: Pastor ou Pastora
  level_is_pastor boolean,
  spouse_is_pastor boolean    -- com is_pastor: "Pastores"
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
```
- **`SECURITY DEFINER`** (era *invoker*): ela lê a cadeia em `private.member_hierarchy`, que `authenticated` não lê. Quem pode aparecer continua decidido pela `members_view`, que filtra por `auth.uid()` também dentro de uma função *definer*. A cadeia só é lida para ids que vieram da view, e não sai na resposta.
- **Raízes da árvore de quem consulta (`_tree_roots`):** com "Visualizar Toda a Igreja", os pastores ativos e visíveis; sem ela, `viewer_tree_roots()` (DA-6 do E2.02), ativos e visíveis. É o mesmo conjunto do ramo de raízes.
- **Candidatos:** como no E1.08: ativos e visíveis. Nas raízes, `id = ANY (_tree_roots)`; senão, `leader_id = ANY (_parent_ids)` e fora de `_parent_ids`. Até 100 ids, senão 22023.
- **Cônjuge exibível S** de um candidato C: ativo e visível (MIN-03 e PR 4 do E1.08). "S na árvore" quer dizer: S é uma das raízes ou tem uma delas na cadeia (DA-3).

| Situação de C e S | Resultado |
|---|---|
| Sem S | nó só com C, com os totais dele |
| S acima de C (S está na cadeia de C), numa chamada de filhos, e S na árvore | **linha de referência** de C: `kind = 'spouse_above'`, `spouse_id` e `spouse_name` de S, o nível do próprio C, sem totais e com `direct_disciples = 0` |
| S acima de C e fora da árvore | nó só com C, com os totais dele (DA-4) |
| C acima de S | casal; discípulos `greatest(total_disciples(C) − 1, 0)`, células `total_cells(C)` |
| ramos diferentes | casal; a soma dos dois |
| nas raízes, S também raiz | casal (com as regras acima para os totais) |
| S em `_parent_ids` e fora da cadeia de C (vínculo de cônjuge assimétrico) | nó só com C, como no E1.08 |

- **Principal do casal:** como hoje (o homem; no empate, o candidato; depois, o menor `(nome, id)`). O casal aparece uma vez (`DISTINCT ON` pela chave).
- **Nível da posição (UXD-7, DA-5):** o de quem é discípulo de um dos `_parent_ids`; se os dois são, o do principal. Nas raízes, o do principal. `level_member_id`, `level_gender` e `level_is_pastor` são dessa pessoa.
- **`direct_disciples`:** o cálculo do E1.08, sem mudança. A referência conta como discípula direta do líder dela, então o nó de Lauro abre e mostra Olga.
- **Ordem:** pelo nome exibido (o principal, nos nós; a própria pessoa, nas referências) e pelo id.
- **Hugo e Vânia (aninhamento direto):** ao abrir o nó do casal, `_parent_ids` tem os dois, e Vânia não é candidata. Zélia aparece, e Vânia não vira referência.
- **Na massa, para Rita:** Diego e Olga com 2 / 3 e "144"; Hugo e Vânia com 1 / 0; Samuel e Magda com 18 / 8; ao abrir Lauro, Olga como referência com "20.736" e `spouse_name = 'Diego …'`.

### Colunas antigas e a RN-12 (migration 3)
- **`enforce_member_write_rules`:** a regra 3 perde as cinco colunas calculadas e fica só com `NEW.created_at := OLD.created_at`. O resto do corpo é o que estiver em produção (E2.02 e E2.04), sem mudança.
- **Saem** os triggers `compute_member_g12_level`, `trg_refresh_stats_members` e `trg_refresh_stats_cells`, e as funções `compute_g12_level` e `refresh_member_stats_v2`.
- **Saem de `members`:** `g12_level`, `total_disciples`, `total_cells`, `male_cells` e `female_cells`. O `GRANT` por coluna do E1.08 (PR 5) sai junto.
- **Pós-condição:** a migration falha, sem mudar nada, se algum corpo de função em `public` ou `private` ainda citar essas colunas fora da lista conhecida: as funções `_hierarchy_*` e `hierarchy_*`, `member_hierarchy_*`, `ministry_tree_nodes` e `dashboard_g12_ranking`, que leem a tabela nova ou a view. O `DROP COLUMN` já falha sozinho se uma view depender delas.
- **RN-12 pela API:** a tabela nova não é exposta, e um PATCH com essas chaves em `members` é recusado como coluna inexistente (DA-1). A `create-user-admin` não muda: a lista `MEMBER_FIELDS` nunca as aceitou.

### Carga e conferência (RN-13)
- **Recálculo da carga (E4.07):** `SELECT private.rebuild_member_hierarchy();` depois dos passos 1 a 5 da 5.5, ainda como `postgres`. É a mesma fórmula dos triggers (`member_hierarchy_expected()`), como a 5.5 pede.
- **Uma carga sem recálculo não passa:** sem ele, os membros carregados não têm linha, e `member_hierarchy_drift()` lista todos como `missing_row`. A reconciliação (E4.09) exige a função vazia. Isso substitui a conferência "masculinas e femininas não podem estar todas zeradas".
- **Reconciliação com o legado (E4.09):** compara a `private.member_hierarchy` com o legado pela RN-13: `12 ^ g12_level` com `MinistryLevel` (limitado a `12 ^ 6`); nulo com 9999999; os totais com os recalculados a partir de `LeadershipId` no schema `legacy`, sem inativos e sem excluídos. O SQL é do E4.09.
- **Lista de diferenças esperadas e saneamento:** `private.member_hierarchy_problems()` dá `no_top` (DA-2), `cell_leader_deleted` e `no_leadership_with_disciples` (P-HIE-02, a linha nova do E4.04).

### Formato dos erros (AQ-5)
É o formato do E2.01: 42501 para permissão e 22023 com `HINT = 'app_error'` e `DETAIL` em JSON para as regras.

| `code` | Mensagem | Detalhes | Quando |
|---|---|---|---|
| `hierarchy_update_failed` | Não foi possível salvar as alterações. Tente de novo. | `reason`: `missing_row`, `negative_total` ou `no_top` | o recálculo encontrou algo que não deveria existir: linha que falta, total que ficaria negativo ou um líder novo sem topo (DA-2) |
| `leader_cycle` (E2.04) | O líder escolhido é discípulo desta pessoa (direto ou indireto). Escolha outro líder. | `field: "leader_id"` | reserva: só aparece aqui se o E2.04 ainda não estiver em produção |

Na tela, a mensagem da RN-08 aparece para `hierarchy_update_failed` e também para os códigos do Postgres que são falha transitória de um recálculo, nunca como texto técnico: 40P01 (*deadlock*), 40001, 55P03, 57014 (tempo-limite), 53xxx e XX000. A queda de conexão continua com o texto do E2.04.

### Contratos
**Tabela nova (fora da API):** `private.member_hierarchy` ([DDL](#ddl-de-referência-migration-1)).

**Colunas que saem de `members`:** `g12_level`, `total_disciples`, `total_cells`, `male_cells` e `female_cells`. No `types.ts`, somem de `members` e continuam nas views.

**Views:**
| View | Novidade |
|---|---|
| `members_view` | `g12_level` pode ser nulo. No fim: `g12_id uuid`, `g12_name text`. |
| `cells_view` | `leader_g12_level` pode ser nulo. `g12_leader_id` e `g12_leader_name` vêm da tabela nova. Nenhuma coluna nova. |

**RPC:** `ministry_tree_nodes(_parent_ids uuid[] DEFAULT NULL)`, com as 5 colunas novas no fim ([Árvore de Ministérios](#árvore-de-ministérios-rn-09-aq-3-e-aq-4)). Continua com EXECUTE só para `authenticated`.

**Funções internas:** as da tabela [Funções](#funções). Nenhuma com EXECUTE para `anon`, `authenticated` ou `service_role`.

**Triggers:** `ac_lock_member_tree` (`BEFORE`, `members`), `trg_member_hierarchy` (`AFTER`, `members`) e `trg_cell_hierarchy` (`AFTER`, `cells`).

**Erros:** `hierarchy_update_failed` e a reserva `leader_cycle`.

**Edge Functions:** nenhuma muda.

### Front
Segue o padrão do E1.08, do E2.01 e do E2.02: os componentes cuidam da tela, o acesso a dados fica nos hooks e a regra pura fica em `src/lib/`.

- **Domínio puro, com Vitest e sem React nem Supabase:**
  - `src/lib/hierarchy/level.ts` (P40): `levelLabel({ level, isPastor, gender, bothPastors })`, `levelTone(...)` (`pastor`, `level` ou `no_leadership`) e o texto do leitor de tela ("nível 144", "sem liderança"). Nível nulo e não pastor é "Sem liderança" (DA-2). Substitui o `getLevelLabel` de `Members.tsx` e o de `src/lib/ministries/tree.ts`, e o `isNumericLevelLabel`.
  - `src/lib/hierarchy/leadership.ts` (P41): a liderança a partir do nível, do `leader_name` e do `g12_name`, com o texto do leitor de tela e se a linha aparece no cartão.
  - `src/lib/hierarchy/totals.ts` (P42): "{N} discípulos · {N} células", com singular, `formatCount` e o texto do leitor de tela.
  - `src/lib/hierarchy/texts.ts`: **todos** os textos deste spec, num módulo só.
  - `src/lib/ministries/tree.ts`: o nó da RPC vira uma união por `kind` (`node` com totais, `spouse_above` sem totais); o rótulo do nível do nó; o nome acessível ("Diego Reis e Olga Reis, 144, 2 discípulos, 3 células"); e a busca do nó do casal no caminho, para o "Ir para o casal".
  - `src/lib/cells/labels.ts`: `formatG12Label` passa a usar `leader_is_pastor` e o nível nulo (RN-11).
  - `src/lib/errors.ts`: `isRecalcFailure(error)`, com o código e os SQLSTATEs de [Formato dos erros](#formato-dos-erros-aq-5).
  - `src/lib/query-refresh.ts`: `refreshAfterMemberWrite(queryClient)` e `refreshAfterCellWrite(queryClient)` (AQ-6, DT-16).
- **Hooks:**
  - `src/hooks/use-min-width.ts` (P45): lê `window.matchMedia("(min-width: 1024px)")` já no valor inicial do `useState`, para o primeiro render sair certo;
  - `src/hooks/use-slow-pending.ts` (P44): verdadeiro depois de 3 s com a gravação pendente;
  - `use-ministry-tree.ts`: devolve a união do `tree.ts`.
- **Componentes:** `LevelBadge` (P40, `span` com `badgeVariants` e o ícone `UserX` no aviso), `LevelSuffix` (o nível entre parênteses, em Células), `LeadershipText` (P41), `TotalsText` (P42) e `SpouseReferenceRow` (P43). O `StatusBadge` (P6) é o do E2.01.
- **Telas:**
  - `Members.tsx` (T1): colunas Nome, Nível, Liderança, Ministério, Situação e Ações; foto e Celular a partir de 1280 px; cartões até 1023 px;
  - `Cells.tsx` (T2): o líder com o nível, o G12 com um nome só, "Situação", cartões até 1023 px;
  - `Ministries.tsx` (T3, T4): totais e nível do nó, a referência com "Ir para o casal" (rola, move o foco e destaca por 2 s, sem animação com `prefers-reduced-motion`) e o texto de ajuda;
  - `MemberForm` e `CellForm` (T5): não fecham durante o envio ("✕", `Esc`, toque fora e "Cancelar"), avisam aos 3 s e mostram a falha no recálculo no rodapé (ou num `Alert`, no de célula), com os dados mantidos e o foco no botão primário.
- **Selects:** `src/lib/members/fields.ts` passa a pedir `g12_name` na lista de Membros. `src/lib/cells/fields.ts` pede `leader_is_pastor`, se o E2.02 ainda não pedir.
- **Toda gravação de membro ou de célula chama a `refresh…` da entidade:** `MemberForm`, `CellForm`, o atalho "Marcar como inativo", e os hooks de exclusão e de restauração do E2.01 (`use-member-deletion`, `use-cell-deletion`, `use-restore`). As listas mostram as linhas em `opacity-60` e com `aria-busy="true"` enquanto recarregam (P44).

### Onde cada regra é imposta
| RN | Banco (constraint, RLS, trigger, RPC) | UI |
|---|---|---|
| RN-01 | `hierarchy_path` e `hierarchy_level` nos triggers e no recálculo; `member_hierarchy_level_check`; nível nulo sem liderança; sem limite de profundidade | Rótulo (P40) |
| RN-02 | — (o banco entrega nível, pastor, sexo e os dois pastores do nó) | `src/lib/hierarchy/level.ts` (P40), em todas as telas |
| RN-03 | `_hierarchy_on_member`: subárvore do zero na troca de líder; só o próprio nível em pastor ↔ sem liderança; excluído congelado; restauração recalcula | — |
| RN-04 | `ancestor_ids` e `g12_id` gerado, mantidos na mesma transação; `members_view.g12_name`; `cells_view` pela tabela nova; o caminho em texto não existe | Liderança com no máximo dois nomes (P41) |
| RN-05 | Pacote com "ativo e não excluído" e `total_disciples`; a contagem passa pelo inativo | Totais por extenso (P42) |
| RN-06 | `_hierarchy_on_cell` (situação da própria célula, divisão pelo sexo do líder); `total_cells` guardado à parte | Totais por extenso |
| RN-07 | Colunas dos triggers (`UPDATE OF`); sexo troca a divisão das células próprias; nada mais dispara | — |
| RN-08 | Triggers `AFTER` na mesma transação; trava da árvore e linhas em ordem; `hierarchy_update_failed`; `member_hierarchy_drift()` como prova | Formulário que não fecha, aviso aos 3 s, falha com os dados mantidos e cache descartado (P44) |
| RN-09 | `ministry_tree_nodes`: totais do casal sem dupla contagem, referência, nível da posição, só integrantes exibidos | Nó com nível e totais; referência com "Ir para o casal"; ajuda (T3, T4) |
| RN-10 | `members_view`: `g12_name` (nome de referência), nível e totais da pessoa | Colunas e cartão (T1, P41, P42) |
| RN-11 | `cells_view`: G12 do líder pela tabela nova, `leader_g12_level`, `leader_is_pastor` | "André Souza (144)", G12 com um nome só (T2) |
| RN-12 | Tabela em `private`, sem privilégios; colunas fora de `members`; só funções *definer* escrevem | O formulário nunca manda campo calculado |
| RN-13 | `rebuild_member_hierarchy()` (E4.07), `member_hierarchy_drift()` e `member_hierarchy_problems()` (E4.09) | — |

### Respostas às perguntas do UX (AQ-1 a AQ-7)
| # | Resposta |
|---|---|
| AQ-1 | **Sim.** `members_view.g12_name` e `g12_id`, no fim, como nomes de referência (aparecem mesmo para G12 fora do escopo). `g12_level` vem nulo para quem está sem liderança. Os dois chegam na mesma linha da página. A Q-3, se adotada, usa as mesmas colunas. |
| AQ-2 | **Confirmado.** `cells_view.leader_g12_level` vem nulo para o líder sem liderança, e `leader_gender` e `leader_is_pastor` (E2.02) estão na view. O `formatG12Label` passa a decidir "Pastores" por `leader_is_pastor` e "—" pelo nível nulo. |
| AQ-3 | **Sim**, com o contrato de [Árvore de Ministérios](#árvore-de-ministérios-rn-09-aq-3-e-aq-4): totais da RN-09; `g12_level` da posição; `level_gender`, `level_is_pastor`, `is_pastor` e `spouse_is_pastor` para o rótulo; a referência com `kind = 'spouse_above'`, `spouse_id` e `spouse_name` do cônjuge de cima, sem totais e com `direct_disciples = 0`. Ela conta em `direct_disciples` do líder dela. Para o "Ir para o casal", a tela procura, subindo pelo caminho já aberto, o nó que tem `spouse_id` como principal ou cônjuge. |
| AQ-4 | **Confirmado**, dentro da árvore de quem consulta (DA-3). Com o cônjuge de cima invisível, inativo ou acima das raízes, o de baixo é um nó comum, só com ele (DA-4). |
| AQ-5 | **Código:** `hierarchy_update_failed`, e a tela trata do mesmo jeito os SQLSTATEs transitórios ([Formato dos erros](#formato-dos-erros-aq-5)). **Tempo-limite:** sem tempo-limite próprio. O desenho deixa a mudança que desloca a árvore inteira abaixo de 4 s no volume de referência, metade dos 8 s de `authenticated`, e o QA mede. Se não couber, o plano B do risco 6. |
| AQ-6 | **Sim, com um ajuste.** `refreshAfterMemberWrite` e `refreshAfterCellWrite` fazem, para `["members"]` (lista, seletores e árvore), `["cells"]`, `["cell_reports"]` e `["dashboard"]`: `removeQueries({ type: "inactive" })`, para as telas fechadas carregarem do zero, e `invalidateQueries({ refetchType: "active" })`, para a aberta recarregar. Relatórios entra já (DA-6). Os hooks do E2.01 passam a usar as mesmas funções. |
| AQ-7 | **Possível**, se a Q-2 for adotada: ver o custo em [Perguntas Q-1 a Q-3](#perguntas-q-1-a-q-3-padrão-e-custo-das-alternativas). |

### Perguntas Q-1 a Q-3: padrão e custo das alternativas
O desenho segue os padrões adotados. Nenhuma alternativa muda a estrutura (a tabela, a cadeia e os triggers ficam).

| Pergunta | Padrão desenhado | Custo da alternativa |
|---|---|---|
| Q-1. Abaixo de quem está sem liderança | O nível conta a partir do topo sem liderança; o discípulo direto é G12 (P-HIE-02). | **Médio, cerca de 2 dias com testes.** A linha ganha "o topo é pastor"; o nível e o G12 ficam nulos para toda a descendência de um topo sem liderança. Marcar ou desmarcar pastor num topo passa a recalcular a subárvore inteira, com a trava exclusiva (hoje muda só o próprio nível). A `cells_view` precisa dizer se o líder tem líder, para "—" no lugar de "(Sem liderança)". O front usa a variação "—" do P40, e a reconciliação ganha mais diferenças esperadas. |
| Q-2. Discípulos do nó por sexo | Sem divisão (P-HIE-12). | **Médio, cerca de 1,5 dia.** A linha ganha discípulos masculinos e femininos; o pacote passa a levar os dois; a troca de sexo de alguém passa a mover a contagem dele em todos acima; o recálculo do zero e a conferência ganham as colunas; a `ministry_tree_nodes` devolve os dois, com a mesma regra do casal. No front, a linha da T7. |
| Q-3. G12 nos seletores | Só o nome. | **Baixo, cerca de 0,5 dia, só no front.** A `members_view` já tem `g12_name` e `g12_level` (AQ-1). Os seletores pedem as colunas e mostram a segunda linha. |

### Decisões técnicas
| # | Decisão | Motivo |
|---|---|---|
| DT-01 | Os campos calculados ficam em `private.member_hierarchy`, uma linha por membro, fora da API, e saem de `members`. | Gravar 2 mil linhas de `members` dispararia, em cada uma, a Auditoria (25 comparações), a data de alteração e as regras de escrita, mudaria a "última alteração" (E2.05, RN-04 e RN-05 de lá) e disputaria a linha com quem edita (o *deadlock* de [Bloqueios](#bloqueios-e-concorrência)). Na tabela à parte, a RN-12 é garantida por privilégio e não há `GRANT` por coluna. |
| DT-02 | Caminho materializado `ancestor_ids uuid[]` (do topo ao líder), com GIN; `g12_id` gerado e indexado; nível guardado com `CHECK`. | O G12 e o "abaixo de X" saem em O(1) por linha, para as listas e os filtros do E2.07 ao E2.14. Uma CTE recursiva por linha em 100 mil relatórios seria cara (pontos de extensão do E1.08). A tabela de fechamento (*closure table*) teria cerca de 100 mil linhas para manter, sem ganho para estas consultas. |
| DT-03 | Nível: 0 no topo pastor; nulo no topo sem liderança e em quem está sem topo; senão, o tamanho da cadeia. | RN-01 e P-HIE-01; DA-2. |
| DT-04 | Totais pelo pacote: diferenças nos de cima, em O(profundidade). Só a troca de líder recalcula a subárvore do zero. `total_cells` à parte das divisões. | RN-08 (1 s e 3 s) com folga; o pior caso não depende do tamanho da igreja. Recalcular a subárvore inteira de cada ancestral, como hoje, custa até a igreja inteira por gravação. |
| DT-05 | Concorrência: a trava da árvore do E2.04, exclusiva (líder, sexo, recálculo do zero) ou compartilhada (o resto que mexe em árvore ou totais); as linhas da tabela travadas uma vez por gravação, em ordem de id. | "Igual ao recálculo do zero" sob gravações simultâneas (RN-08), sem *deadlock* entre os caminhos deste passo. Fecha o risco 3 do E2.01 ("o E2.06 pode ordenar as travas dos totais"). |
| DT-06 | Em membros, a trava vem de um trigger `BEFORE` (`ac_lock_member_tree`), antes das travas de identificador do E2.04. | Mantém a ordem árvore → identificador do E2.04. Pegar a trava só no `AFTER` inverteria a ordem quando a mesma gravação troca um identificador. |
| DT-07 | O excluído fica congelado e não soma. A descida e o recálculo ignoram excluídos. A restauração recalcula. | P-HIE-13 e RN-10 do E2.01. Nenhum vivo tem líder excluído (RN-06 do E2.01). |
| DT-08 | A cadeia é calculada subindo por `members`, com a lista dos visitados, e não copiada da linha do líder. Uma troca que fecharia um ciclo é recusada com `leader_cycle`; uma que levaria para debaixo de alguém sem topo, com `hierarchy_update_failed`. | Ponto 1 do PO: termina com qualquer dado. O trigger e o recálculo do zero concordam sempre. |
| DT-09 | `rebuild_member_hierarchy()`, `member_hierarchy_expected()`, `member_hierarchy_drift()` e `member_hierarchy_problems()` em `private`. | Uma fórmula só para o backfill, a carga (E4.07), a reconciliação (E4.09) e a prova dos testes (RN-13). |
| DT-10 | Três migrations, cada uma coerente sozinha: a tabela convive com a forma antiga, as views mudam, e só então as colunas e os triggers antigos saem. A regra 3 do E1.03 perde as colunas calculadas. | Uma publicação que pare no meio não deixa tela errada. |
| DT-11 | `members_view` com os campos pela tabela nova e `g12_id` e `g12_name` no fim. | AQ-1, RN-10; o nome do G12 é de referência (RN-06 do E1.08, estendida). |
| DT-12 | `cells_view` com o nível do líder e o G12 pela tabela nova. | RN-11; troca a subida por linha da DT-25 do E2.02 por uma junção por chave. |
| DT-13 | `ministry_tree_nodes` *definer*, lendo a cadeia só para ids que vieram da `members_view`; totais do casal pelo de cima quando um está abaixo do outro; referência com `kind`; nível da posição; colunas novas no fim. | RN-09, AQ-3, AQ-4. Pôr a cadeia na view revelaria os ids de toda a cadeia de cada membro visível, contra a RN-23 do E2.02. |
| DT-14 | `hierarchy_update_failed` no formato `app_error`; a tela trata do mesmo jeito os SQLSTATEs transitórios. | AQ-5 e RN-08: nunca mensagem técnica. |
| DT-15 | Sem tempo-limite próprio; metas medidas com folga. Plano B: a troca de líder por uma RPC com `SET statement_timeout`, que o PostgREST 12.2 aplica à chamada. | AQ-5. Um PATCH não tem como ganhar tempo-limite próprio. |
| DT-16 | Depois de toda gravação de membro ou de célula: descartar o cache das telas fechadas e recarregar a aberta, por duas funções únicas. | AQ-6 e UXD-10: `invalidateQueries` sozinho mostraria o valor antigo na visita seguinte, enquanto recarrega. |
| DT-17 | As funções de escopo do E2.02 continuam subindo e descendo por `leader_id`. | Elas passam por excluídos de propósito (DT-04 do E2.01), e a cadeia guardada não. Trocar exigiria outra regra para o histórico. Fica como ponto de extensão. |
| DT-18 | Quatro PRs: o banco, neutro para o front em produção; Membros e Células; Ministérios; gravação e cache. | Cada PR vai ao ar sozinho ([Implantação](#implantação)). |

### Riscos (concorrência, escala, segurança)
1. **Desvio por diferença.** Um erro de código, uma escrita fora dos triggers ou uma carga sem recálculo deixam um total errado, que as diferenças seguintes carregam.
   - Mitigações: `member_hierarchy_drift()` vazia depois de cada cenário dos pgTAP e da concorrência; o `CHECK` de não negativo transforma o caso grave numa falha amigável; a troca de líder recalcula a subárvore do zero; a E4.09 exige a conferência vazia.
   - Correção: `SELECT private.rebuild_member_hierarchy();` no SQL Editor, que pega a trava exclusiva e grava só o que mudou.
2. **Fila das trocas de líder e de sexo.** Elas são exclusivas e fazem as demais gravações que mexem na árvore esperarem a duração delas (menos de 1 s, estimado). Edição de nome, telefone e endereço não pegam a trava. Com o volume da igreja, é aceitável (risco 6 do E2.04).
3. ***Deadlocks* residuais:** os de [Bloqueios](#bloqueios-e-concorrência). O Postgres detecta e aborta um lado com 40P01, e a tela mostra "Tente de novo.".
4. **Colunas removidas ainda citadas num corpo `plpgsql`.** O `DROP COLUMN` não enxerga esses corpos, e a falha só apareceria em tempo de execução.
   - Mitigação: a pós-condição da migration 3, por busca em `pg_proc.prosrc`, e o pgTAP que passa por todos os triggers de `members` e `cells`.
   - **Passos ainda não implementados** (E2.02, E2.04, E2.05) não podem voltar a usar as colunas se entrarem depois deste. A tarefa 1 relê esses specs.
5. **Ordem com os passos em andamento.** O PR 1 exige o PR 1 do E2.02 (guarda). Se o E2.04 vier depois, ele não recria `compute_member_g12_level`, e o `ad_` dele continua pegando a mesma trava.
6. **Tempo (RN-08).**
   - Metas no volume de referência (20 mil membros com profundidade até 10, 1.500 células), medidas no banco:
     - gravação comum (situação, sexo, cadastro de membro ou de célula): até 50 ms;
     - troca de líder de quem tem 100 abaixo: até 100 ms;
     - troca de líder de um G12 com 2 mil abaixo: até 1 s;
     - pastor que ganha líder (20 mil abaixo): até 4 s;
     - `rebuild_member_hierarchy()`: até 5 s;
     - página com contagem da `members_view` e da `cells_view`: até 300 ms (E1.08); `ministry_tree_nodes` com 100 ids: até 50 ms; `dashboard_g12_ranking`: até 800 ms.
   - **Plano B**, se a troca de um G12 ou da árvore inteira não couber: a troca de líder passa por uma RPC `set_member_leader(_member_id, _leader_id)` com `SET statement_timeout = '30s'`, que o PostgREST 12.2 aplica à chamada. Volta ao `architect` antes, e o PO decide se relaxa a meta.
7. **`ministry_tree_nodes` passa a *definer*.** Um erro no filtro mostraria quem a pessoa não vê.
   - Mitigação: ela só lê ids da `members_view` e as raízes das funções do E2.02;
   - mitigação: paridade por persona (Rita, Pedro, Diego, André, Hugo) com os ids da `members_view`.
8. **Carga em `replica`.** Até o recálculo, os membros carregados aparecem como "Sem liderança" e com totais zero. O E4.07 é obrigatório, e o E4.09 confere.
9. **Membros "sem topo" (DA-2).** Aparecem como "Sem liderança" até a correção, e nenhuma troca de líder os põe debaixo de alguém. O E4.04 e o E4.09 os listam.
10. **Janela do PR 1.** O front em produção mostra a referência da árvore como um nó comum, sem abrir, e continua mostrando os discípulos diretos no lugar dos totais. A lista de Membros continua com "12" e "144" até o PR 2. Nada quebra.
11. **Chave da trava compartilhada com o E2.04.** Mudar o texto `members:leader-tree` num lado só desliga a garantia. O pgTAP confere a chave nos dois corpos.
12. **Inchaço da tabela.** Uma troca de líder grande reescreve milhares de linhas estreitas e o índice GIN. O *autovacuum* cuida, e a tabela tem cerca de 2 MB com 20 mil membros.
13. **Alerta do Supabase:** nada novo. As views continuam *security definer* (não trocar para *invoker*), e a tabela fica num schema fora da API.

### Ordem com os outros passos
**Pré-requisitos do PR 1 (guarda na migration 1):**
- PR 1 do E2.01, já em produção;
- PR 1 do E2.02: tira `get_ministry_root` e as funções de escopo que liam `g12_level`, e cria `viewer_tree_roots` (DA-6), que a árvore usa.

**Recomendado antes do PR 1:** o PR 2 do E2.04. Ele traz a trava da árvore, a recusa de ciclo e o sexo sempre preenchido. Sem ele, a reserva `leader_cycle` deste passo cobre o ciclo, e a célula de líder sem sexo conta só no total.

**Front (PRs 2 a 4):** mexem nos mesmos arquivos que o front do E2.01 (PRs 2 e 3), do E2.02 (PRs 4 e 5) e do E2.04 (PR 3). Entram depois deles e fazem o *rebase*.

**Ordem ideal do bloco:**
1. E2.01, PRs 2 a 6;
2. E1.04;
3. E2.02 (PR 1, depois os de front);
4. E2.04 (PRs 1 a 3);
5. **E2.06** (PR 1, depois os PRs 2 a 4);
6. E2.05.

Com o E2.06 antes, os campos calculados já estão fora de `members`, e a autoria do E2.05 não precisa distinguir gravação de campo calculado (RN-04 e RN-05 de lá). O E2.03 é independente e pode entrar em qualquer ponto depois do E2.02. O E2.07 e os passos E2.10 a E2.15 usam as colunas deste.

### Dependências e impactos em outros passos
| Passo | Relação |
|---|---|
| E2.01 | Usa `deleted_at`, `_del_raise` e as RPCs de exclusão e restauração sem mudá-las. Os hooks de exclusão e de restauração do front passam a chamar a `refresh…` (PR 4). |
| E2.02 | Pré-requisito (PR 1). A `cells_view` troca a subida da DT-25 pela tabela nova; a `ministry_tree_nodes` mantém o ramo de raízes da DA-6. As funções de escopo não mudam (DT-17). |
| E2.04 | Recomendado antes. Mesma chave de trava; o `ac_lock_member_tree` roda antes do `ad_`. A linha de `compute_member_g12_level` na tabela de ordem dos triggers do E2.04 deixa de existir. Se o E2.04 vier depois, ele usa o nome `ac_lock_member_tree` na tabela dele. |
| E2.05 | Os campos calculados não estão mais em `members`, então nada deles muda a autoria. |
| E2.07 | O filtro por nível usa `g12_level` da `members_view`. "Abaixo de alguém, em qualquer nível" usa `ancestor_ids @> ARRAY[x]`: o E2.07 decide se expõe a cadeia na view (revela os ids da cadeia de quem a pessoa vê) ou se filtra por uma RPC. "Sem vínculo celular" usa `total_cells`. |
| E2.10, E2.12, E2.13 | O G12 da célula e do líder do relatório vem de `g12_id` (indexado). |
| E2.14 | O ranking já acompanha a árvore. Pode trocar a leitura da view por `g12_level = 1` direto, com o índice. |
| E2.15 | Herda a árvore deste passo. Mostrar os discípulos ativos de um inativo muda só a `ministry_tree_nodes`. |
| E4.04, E4.07, E4.09 | `member_hierarchy_problems()`, `rebuild_member_hierarchy()` e `member_hierarchy_drift()`. |
| Consolidação | O pacote deixa de contar o consolidado, e a árvore e a cadeia decidem se ele entra. |

**Mudanças nos documentos, no aceite** (o `product-owner` atualiza a matriz, a seção 3 e o Progresso; o `architect` atualiza o resto do `CLAUDE.md` na revisão final):
- **`CLAUDE.md`:**
  - **Schema efetivo:** em `members`, sai a linha "Estatísticas"; entra `private.member_hierarchy`, com `ancestor_ids`, `g12_level` (nulo sem liderança), `g12_id` e os totais. Sai a pergunta "Confirmar no banco real (E1.01): `male_cells` e `female_cells` existem?".
  - **Lógica no banco:** `compute_g12_level` e `refresh_member_stats_v2` dão lugar aos triggers de hierarquia (cadeia, nível, G12 e totais na mesma transação, a trava da árvore exclusiva ou compartilhada) e às funções `private.rebuild_member_hierarchy()`, `member_hierarchy_drift()` e `member_hierarchy_problems()`. A `ministry_tree_nodes` passa a *definer*.
  - **Front:** Membros com nível, liderança e totais; Ministérios com os totais do casal e a referência.
  - **Armadilhas:** saem "faltam `male_cells` e `female_cells` no `types.ts`", "membro sem líder que não é pastor fica com `g12_level = 0`" e "células de líder sem gênero ficam fora de `total_cells`". Entram:
    - "os campos calculados estão em `private.member_hierarchy`; só as funções `_hierarchy_*` e `hierarchy_*` escrevem nela. Toda carga em `replica` termina com `private.rebuild_member_hierarchy()`, e `private.member_hierarchy_drift()` precisa voltar vazia";
    - "toda gravação que muda a árvore ou os totais pega a trava `members:leader-tree`: exclusiva para líder e sexo, compartilhada para o resto".
- **`docs/migracao.md`:**
  - **3.3:** HIE-02 a HIE-04 em ✅; "Onde impor": "Trigger + `private.member_hierarchy`".
  - **3.7:** a MIN-01 cita a RN-09.
  - **5.3:** as colunas calculadas não existem em `members`; a tabela de hierarquia não é carregada, é recalculada.
  - **5.4:** a linha "membros sem liderança que têm discípulos" (P-HIE-02).
  - **5.5, passo 6:** "`SELECT private.rebuild_member_hierarchy();`" no lugar do backfill de `g12_level` e dos totais. `is_pastor` e `has_leadership` vêm da transformação (passos 1 e 2).
  - **5.6:** `member_hierarchy_drift()` vazia; nível pela RN-13 (12 elevado a até 6, 9999999 para sem liderança); totais comparados com os recalculados da árvore do legado. Sai "a diferença esperada é só a de membros inativos".
  - **Progresso:** o E2.06 com o link do spec; o E4.07 passa a "Recálculo com `private.rebuild_member_hierarchy()`".

### Pontos de extensão
| Futuro | Onde muda |
|---|---|
| Escopo pela cadeia guardada (E2.02) | `_viewer_scope_anchors`, `viewer_ministry_member_ids` e `viewer_scope_contains_any` poderiam usar `ancestor_ids && âncoras`, com o teste de equivalência. Exige decidir o escopo do histórico de excluídos (DT-17). |
| Ciclo e seletor de líder (E2.04) | A subida do ciclo e a de `member_descendants_among` poderiam ser `x = ANY (ancestor_ids)`, com o mesmo contrato. |
| Filtros (E2.07, E2.10, E2.12) | `g12_id`, `g12_level` e `ancestor_ids`, já indexados. |
| Q-1, Q-2 | Ver [Perguntas Q-1 a Q-3](#perguntas-q-1-a-q-3-padrão-e-custo-das-alternativas). |
| Consolidação | O "conta como discípulo" do pacote e a descida da subárvore. |

### Implantação
| PR | Ordem | Efeito no front em produção |
|---|---|---|
| 1 (banco) | merge → "Deploy: banco" (migrations 1 a 3) | Ver o risco 10. A lista de Células já mostra "—" para o G12 de quem está sem liderança (se o E2.02 já não mostrava), e o ranking passa a acompanhar a árvore. |
| 2, 3 e 4 (só front) | merge → promote | — |

- O promote já recusa rodar com migration pendente.
- Antes do "Deploy: banco" do PR 1, o usuário roda a [conferência](#conferência-em-produção-tarefa-1). Uma guarda que falha não muda nada, e a publicação pode ser repetida.
- **Rollback:**
  - o front volta pelo promote do commit anterior, e os PRs 2 a 4 funcionam com o banco novo;
  - o banco não volta: as colunas antigas foram removidas. Se for preciso, uma migration nova as recria a partir da tabela nova. Por isso, o PR 1 só vai ao ar com as metas de tempo e os cenários de concorrência aprovados. Em produção, hoje, só há dados de teste.

### Conferência em produção (tarefa 1)
SQL **só de leitura**, para o usuário rodar no SQL Editor do projeto `gkhnjhmgeceoaqeynhrj` antes do "Deploy: banco" do PR 1. Nenhuma consulta devolve dado pessoal além de ids.

```sql
-- a. Pré-requisitos. Esperado: e202_pr1 e sem_get_ministry_root verdadeiros.
--    e204_pr2 só informa (recomendado).
SELECT to_regprocedure('public.viewer_tree_roots()') IS NOT NULL      AS e202_pr1,
       to_regprocedure('public.get_ministry_root(uuid)') IS NULL      AS sem_get_ministry_root,
       to_regprocedure('public.enforce_member_rules()') IS NOT NULL   AS e204_pr2;

-- b. Quem ainda cita as colunas calculadas. Esperado: só compute_g12_level,
--    refresh_member_stats_v2, enforce_member_write_rules, ministry_tree_nodes,
--    dashboard_g12_ranking e as views members_view e cells_view. get_ministry_root e
--    viewer_ministry_member_ids só aparecem se o PR 1 do E2.02 ainda não estiver lá.
SELECT n.nspname, p.proname
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname IN ('public', 'private')
   AND p.prosrc ~ '\m(g12_level|total_disciples|total_cells|male_cells|female_cells)\M'
 ORDER BY 1, 2;
SELECT c.relname
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind = 'v'
   AND pg_get_viewdef(c.oid) ~ '\m(g12_level|total_disciples|total_cells|male_cells|female_cells)\M';

-- c. Membros não excluídos sem topo (ciclo ou líder excluído). Esperado: 0 linhas.
--    Com linhas, a migration 1 para: decidir a correção antes.
WITH RECURSIVE live AS (SELECT id, leader_id FROM public.members WHERE deleted_at IS NULL),
tree AS (SELECT id FROM live WHERE leader_id IS NULL
         UNION ALL SELECT l.id FROM tree t JOIN live l ON l.leader_id = t.id)
SELECT l.id FROM live l WHERE NOT EXISTS (SELECT 1 FROM tree t WHERE t.id = l.id);

-- d. Células ativas e não excluídas sem líder ou com líder excluído. Esperado: 0 linhas.
SELECT c.id, c.leader_id IS NULL AS sem_lider
  FROM public.cells c LEFT JOIN public.members l ON l.id = c.leader_id
 WHERE c.deleted_at IS NULL AND c.is_active AND (c.leader_id IS NULL OR l.deleted_at IS NOT NULL);

-- e. Líderes de célula sem sexo (informa; o E2.04 corrige).
SELECT count(*) AS lideres_sem_sexo
  FROM public.members m
 WHERE m.deleted_at IS NULL AND m.gender IS NULL
   AND EXISTS (SELECT 1 FROM public.cells c WHERE c.leader_id = m.id AND c.deleted_at IS NULL);

-- f. Sem liderança com discípulos (P-HIE-02; informa o E4.04).
SELECT m.id, count(d.id) AS discipulos
  FROM public.members m
  JOIN public.members d ON d.leader_id = m.id AND d.deleted_at IS NULL
 WHERE m.deleted_at IS NULL AND m.leader_id IS NULL AND NOT m.is_pastor
 GROUP BY m.id;

-- g. Totais e nível guardados hoje × do zero (informa quanto o backfill muda).
WITH RECURSIVE live AS (
  SELECT id, leader_id, is_pastor, is_active, gender FROM public.members WHERE deleted_at IS NULL),
tree AS (SELECT l.id, '{}'::uuid[] AS anc FROM live l WHERE l.leader_id IS NULL
         UNION ALL SELECT c.id, t.anc || t.id FROM tree t JOIN live c ON c.leader_id = t.id),
disc AS (SELECT a AS id, count(*) AS n FROM tree t JOIN live m ON m.id = t.id, unnest(t.anc) a
          WHERE m.is_active GROUP BY a),
cel AS (SELECT o AS id, count(*) AS n FROM public.cells c JOIN tree t ON t.id = c.leader_id,
               unnest(t.anc || t.id) o WHERE c.is_active AND c.deleted_at IS NULL GROUP BY o)
SELECT m.id,
       m.g12_level AS nivel_hoje,
       CASE WHEN m.leader_id IS NOT NULL THEN cardinality(t.anc) WHEN m.is_pastor THEN 0 END AS nivel_novo,
       m.total_disciples AS disc_hoje, coalesce(d.n, 0) AS disc_novo,
       m.total_cells AS cel_hoje, coalesce(c.n, 0) AS cel_novo
  FROM public.members m JOIN tree t ON t.id = m.id
  LEFT JOIN disc d ON d.id = m.id LEFT JOIN cel c ON c.id = m.id
 WHERE m.deleted_at IS NULL
   AND (m.g12_level IS DISTINCT FROM CASE WHEN m.leader_id IS NOT NULL THEN cardinality(t.anc)
                                          WHEN m.is_pastor THEN 0 END
        OR m.total_disciples <> coalesce(d.n, 0) OR m.total_cells <> coalesce(c.n, 0));

-- h. Tempo-limite dos papéis (AQ-5). Esperado: authenticated com statement_timeout=8s.
SELECT rolname, rolconfig FROM pg_roles
 WHERE rolname IN ('anon', 'authenticated', 'authenticator', 'service_role');

-- i. Volume e profundidade.
WITH RECURSIVE t AS (
  SELECT id, 0 AS depth FROM public.members WHERE leader_id IS NULL AND deleted_at IS NULL
  UNION ALL SELECT m.id, t.depth + 1 FROM t JOIN public.members m ON m.leader_id = t.id AND m.deleted_at IS NULL)
SELECT (SELECT count(*) FROM public.members) AS membros,
       (SELECT count(*) FROM public.cells)   AS celulas,
       (SELECT max(depth) FROM t)            AS profundidade_maxima;
```
**Parar e voltar ao `architect`:** (a) com `e202_pr1` falso; (b) com qualquer função ou view fora da lista; (c) ou (d) com linhas.

#### Resultado da tarefa 1 e do PR 1
_2026-11-25, `architect`._
- **Tarefa 1:** os nomes do desenho conferem com o E2.01, o E2.02 e o E2.04 em produção (`_del_raise`, `viewer_tree_roots`, `enforce_member_rules`, chave `hashtextextended('members:leader-tree', 0)`); nenhum caso de parada. O `ac_lock_member_tree` cai entre o `ac_enforce_member_scope` (E2.02) e o `ad_enforce_member_rules`. Quem cita as colunas calculadas: só as 5 funções e as 2 views previstas.
- **Ajuste:** a `restore_member` (E2.04) pegava as travas de identificador antes do UPDATE, e o UPDATE passaria a pegar a trava da árvore depois delas (ordem invertida da DT-06). A migration 1 a recria com o mesmo corpo, pegando a trava da árvore (exclusiva se o líder muda, senão compartilhada) antes do passo (e).
- **Trava:** o `ac_lock_member_tree` pega a exclusiva sempre que o `ad_` pegaria; o `ad_` só reentra, e nenhuma gravação sobe de compartilhada para exclusiva.
- **Casos aceitos, a mais dos de [Bloqueios](#bloqueios-e-concorrência):**
  - um `INSERT` de várias linhas em `members`, com os triggers ligados e o discípulo antes do líder, falha com `hierarchy_update_failed` / `missing_row` (a carga do E4.07 roda em `replica` e termina com o recálculo);
  - um cadastro novo debaixo de um líder "sem topo" (só por carga) entra também sem topo, sem erro; a `member_hierarchy_problems()` lista os dois;
  - uma exclusão física em `replica` não dispara a FK em cascata e deixa linha órfã em `private.member_hierarchy` (o E4 limpa com a carga).
- **Front em produção até o PR 3:** quem não vê a igreja toda e tem como raiz da árvore alguém sem liderança vê "Nível null" no nó raiz (antes, "Pastor(a)"). O `getLevelLabel` do PR 3 trata o nulo.
- **Testes:** ver [Testes](#testes).

### Verificações obrigatórias (para o QA)
**pgTAP** (`supabase/tests/database/e206_*.test.sql`, autocontido, com `ROLLBACK`). A massa é a do Negócio, com os nomes e os dados que as regras do E2.04 exigem, montada com os triggers ligados.

- **Estrutura e privilégios:**
  - `private.member_hierarchy` sem privilégio para `anon`, `authenticated` e `service_role`, com RLS e sem políticas;
  - as funções novas sem EXECUTE para `anon`, `authenticated` e `service_role`; `ministry_tree_nodes` só para `authenticated`;
  - as colunas calculadas não existem em `members`; nenhum corpo de função as cita fora da lista;
  - os 3 triggers com as colunas certas; a chave `members:leader-tree` igual no `ac_lock_member_tree` e no `ad_` do E2.04 (se existir);
  - os `CHECK`s recusam nível incoerente, membro na própria cadeia e total negativo, feitos como `postgres`.
- **RN-01 a RN-07:** todos os valores da tabela da massa e todos os critérios dessas regras, gravando pela API com a sessão de cada persona quando o critério diz "pela API". **Depois de cada critério, `member_hierarchy_drift()` vazia.**
- **RN-08:** a falha simulada no recálculo (por exemplo, apagando a linha de um ancestral dentro do teste) desfaz a gravação inteira e devolve `hierarchy_update_failed`.
- **RN-09:** todos os critérios pela `ministry_tree_nodes`, com Rita, Pedro e Diego: totais, nível da posição, a referência de Olga, Hugo e Vânia sem referência, o cônjuge de cima fora da árvore (uma massa com o cônjuge acima das raízes de quem consulta), Beatriz inativa e a folha Rita.
- **RN-10 e RN-11:** `g12_name`, `g12_level` e os totais na `members_view` (inclusive Hugo pela API); o G12 e o nível do líder na `cells_view`; as três células novas (Pedro, Samuel e Ester).
- **RN-12:** o PATCH com `g12_level`, `total_disciples` e `total_cells` em `members` é recusado e nada muda; `authenticated` não lê nem grava `private.member_hierarchy`.
- **RN-13:** a massa carregada em `replica`, depois `rebuild_member_hierarchy()`, dá os valores da tabela; antes dele, `member_hierarchy_drift()` lista todos; `member_hierarchy_problems()` com um ciclo e com um líder excluído na massa.
- **DA-2 e DT-08:** a troca que fecharia um ciclo dá `leader_cycle`; a troca para debaixo de alguém sem topo dá `hierarchy_update_failed`.
- **Paridade (E1.08 e E2.02):** os ids de cada view e da árvore continuam iguais aos de antes por persona.
- **Testes existentes adaptados:** os do E1.08 (PRs 2 a 5) e do E2.01 que gravam ou leem as colunas calculadas.

**Concorrência** (`supabase/tests/concurrency/e206_concurrency.sh`, com duas conexões e `pg_sleep`, como no E2.01), nas duas ordens. Cada cenário termina com `member_hierarchy_drift()` vazia e sem 40P01:
- troca do líder de Fábio para Tiago × a C4 inativada (critério da RN-08);
- troca de sexo de Gabriel × célula nova de Gabriel;
- inativar Caio × mover André;
- duas células novas na mesma cadeia;
- excluir um discípulo (E2.01) × mover o líder dele;
- restaurar Zélia (E2.01) × mover Hugo;
- duas trocas de líder na mesma subárvore.

**Volume:** as metas do risco 6, com o `EXPLAIN (ANALYZE, BUFFERS)` anexado ao PR, no gerador de volume do E1.08 (profundidade até 10).

**Vitest:** `level.ts` (todos os rótulos do P40, inclusive "Pastor(a)" e "Pastores"), `leadership.ts` (as seis linhas do P41), `totals.ts` (singular, zero e milhar), `tree.ts` (união por `kind`, nome acessível, busca do nó do casal), `labels.ts`, `isRecalcFailure` e `query-refresh.ts` (com um `QueryClient` de verdade: a consulta inativa some e a ativa recarrega).

**Playwright:** os critérios `UX-` de cada PR com a massa, mais o *smoke* de login.

## Tarefas
_Seção do `architect`._

Quatro PRs no `mci-connect`. **O PR 1 começa depois do PR 1 do E2.02 em produção** (recomendado: também o PR 2 do E2.04).
- Dentro de cada PR, o banco vai primeiro, e os tipos são regenerados antes do front.
- Cada desenvolvedor aciona o `code-reviewer` ao terminar a sua tarefa; esse passo não aparece na tabela.
- Na coluna RNs, os números são das regras deste spec. Na coluna UX, os dos critérios `UX-`.

| # | Responsável | Descrição | Arquivos | RNs | UX | Depende de |
|---|---|---|---|---|---|---|
| **PR 1: banco (neutro para o front em produção)** | | | | | | |
| 1 | backend-developer | Reler as migrations finais do E2.01, do E2.02 e do E2.04 que estiverem em produção e confirmar os nomes usados aqui (`_del_raise`, `viewer_tree_roots`, o nome do `ad_` e a chave da trava). Entregar o SQL de [Conferência em produção](#conferência-em-produção-tarefa-1) para o usuário rodar. Parar e voltar ao `architect` nos casos listados ali. | — | 01, 13 | — | PR 1 do E2.02 em produção |
| 2 | backend-developer | Migration 1: guardas; tipo, tabela, índices e privilégios; `hierarchy_path`, `hierarchy_level`, `hierarchy_spread`, `hierarchy_cell_spread`, `hierarchy_apply`, `hierarchy_fail`, `hierarchy_recompute_subtree`; `member_hierarchy_expected`, `rebuild_member_hierarchy`, `member_hierarchy_drift` e `member_hierarchy_problems`; as 3 funções e os 3 triggers; backfill e pós-condição. Os triggers antigos ficam. Ordem das travas no cabeçalho. | `supabase/migrations/<ts>_e206_01_hierarchy.sql` | 01, 03 a 08, 12, 13 | — | 1 |
| 3 | backend-developer | Migration 2: `members_view` e `cells_view` pela tabela nova (com `g12_id` e `g12_name` no fim da `members_view`); `ministry_tree_nodes` nova, *definer*, com `DROP` e `CREATE` e os grants. | `supabase/migrations/<ts>_e206_02_read.sql` | 04, 09, 10, 11 | dados de 01, 02, 08, 09, 10, 12 | 2 |
| 4 | backend-developer | Migration 3: `enforce_member_write_rules` sem as colunas calculadas; `DROP` dos triggers e das funções antigas e das cinco colunas; pós-condição por `pg_proc.prosrc`. Regenerar o `types.ts` e ajustar o que não compilar sem mudar comportamento (por exemplo, o `MemberForm.test.tsx`). Atualizar o comentário da `create-user-admin` que cita `g12_level`. | `supabase/migrations/<ts>_e206_03_drop_member_columns.sql`, `src/integrations/supabase/types.ts`, `supabase/functions/create-user-admin/index.ts` | 12 | — | 3 |
| 5 | qa | pgTAP de [Verificações](#verificações-obrigatórias-para-o-qa), concorrência (7 cenários, duas ordens) e volume com `EXPLAIN`. Adaptar os pgTAP do E1.08 (PRs 2 a 5) e do E2.01 que gravam ou leem as colunas calculadas. | `supabase/tests/database/e206_*.test.sql`, testes existentes afetados, `supabase/tests/concurrency/e206_concurrency.sh` | 01 a 13 | — | 4 (escreve em paralelo com 2 a 4, a partir dos contratos) |
| **PR 2: Membros e Células** | | | | | | |
| 6 | frontend-developer | `src/lib/hierarchy/{level,leadership,totals,texts}.ts` com Vitest; `LevelBadge`, `LevelSuffix`, `LeadershipText` e `TotalsText`; `use-min-width`; `Members.tsx` (T1: colunas e ordem, Liderança, Ministério, Situação com o `StatusBadge`, cartões até 1023 px, foto e Celular a partir de 1280 px); `Cells.tsx` (T2: líder com o nível, G12 com um nome só, Situação, cartões até 1023 px); `fields.ts` e `labels.ts` de membros e células. | `src/lib/hierarchy/*`, `src/components/hierarchy/*`, `src/hooks/use-min-width.ts`, `src/pages/{Members,Cells}.tsx`, `src/lib/members/fields.ts`, `src/lib/cells/{fields,labels}.ts` | 02, 10, 11 | 01 a 08, 16, 18, 20 | 4 (tipos); front do E2.01 (PRs 2 e 3), do E2.02 (PRs 4 e 5) e do E2.04 (PR 3) na `main` |
| 7 | ux-designer | Revisão de UI do PR 2 (T1, T2, P40 a P42, P45) em 320, 360, 768, 1024 e 1280 px, nos temas claro e escuro, com zoom de 200%. | — | — | 01 a 08, 16, 18, 20 | 6 |
| 8 | qa | Vitest (`level`, `leadership`, `totals`, `labels`); testes de componente (UX-01 a 04, 05 com `matchMedia` simulado, 08, 16, 18); Playwright (UX-01, 02, 03, 05, 06, 08 com a massa); axe (UX-07, 20). | `src/**/*.test.ts(x)`, `e2e/hierarquia-listas.spec.ts` | 02, 10, 11 | 01 a 08, 16, 18, 20 | 6 |
| **PR 3: Ministérios** | | | | | | |
| 9 | frontend-developer | `src/lib/ministries/tree.ts` (união por `kind`, rótulo do nó, nome acessível, busca do nó do casal) com Vitest; `use-ministry-tree` com a união; `Ministries.tsx` (T3, T4): nível e totais no nó, `SpouseReferenceRow` com "Ir para o casal", texto de ajuda, `Skeleton` com `h-16 sm:h-11`. | `src/lib/ministries/tree.ts`, `src/hooks/use-ministry-tree.ts`, `src/pages/Ministries.tsx`, `src/components/ministries/*` | 02, 09 | 04, 06, 09 a 12, 17 | 4 (tipos) e 6 (`src/lib/hierarchy`); front do E2.02 (PR 5, T10) na `main` |
| 10 | ux-designer | Revisão de UI do PR 3 (T3, T4, P43). | — | — | 06, 09 a 12, 17, 20 | 9 |
| 11 | qa | Vitest (`tree`); testes de componente (UX-11, 12); Playwright (UX-09, 10, 17 e os critérios da RN-09 com Rita, Pedro e Diego); axe (UX-20). | `src/**/*.test.ts(x)`, `e2e/hierarquia-ministerios.spec.ts` | 09 | 09 a 12, 17, 20 | 9 |
| **PR 4: gravação e telas sem valores antigos** | | | | | | |
| 12 | frontend-developer | `isRecalcFailure` em `src/lib/errors.ts`; `src/lib/query-refresh.ts`; `use-slow-pending`; `MemberForm` e `CellForm` (T5, P44: não fecham durante o envio, aviso aos 3 s, falha no rodapé ou no `Alert`, foco no botão primário); a `refresh…` em toda gravação de membro e de célula (formulários, "Marcar como inativo" e os hooks de exclusão e restauração do E2.01); linhas em `opacity-60` e `aria-busy` enquanto a lista aberta recarrega. | `src/lib/{errors,query-refresh}.ts`, `src/hooks/use-slow-pending.ts`, `src/components/{MemberForm,CellForm}.tsx`, `src/hooks/{use-member-deletion,use-cell-deletion,use-restore}.ts`, `src/pages/{Members,Cells}.tsx` | 08 | 13, 14, 15, 19 | 6 (mesmos arquivos); PR 3 do E2.04 na `main` |
| 13 | ux-designer | Revisão de UI do PR 4 (T5, P44). | — | — | 13 a 15, 19, 20 | 12 |
| 14 | qa | Vitest (`isRecalcFailure`, `query-refresh`); testes de componente (UX-14, 15 com relógio simulado, 19); Playwright (UX-13 e o critério "Células logo depois de salvar, sem recarregar" da RN-08). | `src/**/*.test.ts(x)`, `e2e/hierarquia-gravacao.spec.ts` | 08 | 13 a 15, 19 | 12 |
| **Fechamento** | | | | | | |
| 15 | architect | Revisão final dos 4 PRs. Atualizar o `CLAUDE.md` ([Mudanças nos documentos](#dependências-e-impactos-em-outros-passos)). O aceite da fase 2, a matriz e o `docs/migracao.md` são do `product-owner`. | `CLAUDE.md` | — | — | 5, 8, 11, 14 |

**Ordem de execução:**
- PR 1: 1 → 2 → 3 → 4. A 5 é escrita em paralelo com a 2, a 3 e a 4, e roda depois da 4. O PR 1 só vai para o "Deploy: banco" com a 5 aprovada (metas e concorrência).
- Depois do PR 1 mergeado, em paralelo:
  - PR 2: 6 → (7 ∥ 8);
  - PR 3: 9 → (10 ∥ 11). A 9 começa quando a parte `src/lib/hierarchy` da 6 estiver na branch (ou cria os mesmos módulos e faz o *rebase*).
- PR 4: 12 → (13 ∥ 14), depois do PR 2, porque mexe em `Members.tsx` e `Cells.tsx`.
- 15 no fim.

**Critérios de pronto**
1. **Tarefas de banco (2 a 4):**
   - as migrations rodam num banco zerado depois das existentes e rodam de novo sem erro;
   - depois de cada uma, as telas continuam certas (DT-10): o QA roda os testes de leitura do E1.08 com o banco parado em cada migration;
   - nenhuma função nova tem EXECUTE para `anon`, `authenticated` ou `service_role`, a não ser a `ministry_tree_nodes` para `authenticated`;
   - `member_hierarchy_drift()` vazia depois do backfill;
   - o `types.ts` está regenerado;
   - os testes do E1.03, do E1.08, do E2.01, do E2.02 e do E2.04, adaptados, continuam passando.
2. **Tarefa 2:** num banco com um ciclo ou com um vivo de líder excluído, a migration 1 falha com os ids e não muda nada.
3. **Tarefa 3:** a paridade por persona das views e da árvore não muda; a `ministry_tree_nodes` não devolve ninguém fora da `members_view` de quem chama.
4. **Tarefa 4:** a pós-condição falha num banco com uma função de teste que cite `members.g12_level`.
5. **Tarefa 5:** todos os critérios da RN-01 à RN-13 que dependem do banco passam; os 7 cenários de concorrência, nas duas ordens, terminam com `member_hierarchy_drift()` vazia; as metas do risco 6 estão atendidas, com o `EXPLAIN` no PR.
6. **Tarefas 6, 9 e 12:**
   - `npm run lint`, `npm test` e `npm run build` verdes;
   - sem `any` e sem asserção de tipo (`as Tipo`) nos arquivos novos (`as const` é permitido);
   - nenhuma regra de domínio dentro de componente (fica em `src/lib/`);
   - nenhum texto do spec fora de `src/lib/hierarchy/texts.ts` ou dos módulos de domínio;
   - nenhum "12" sozinho, "disc.", "cél.", "Status" ou `bg-orange-500` nas telas deste spec;
   - nenhuma leitura de `members` direto da tabela.
7. **Tarefa 6:** em 1280×800, o primeiro render já é a tabela; em 360×800, já são os cartões.
8. **Tarefa 9:** abrir Lauro nunca devolve o casal Diego e Olga; "Ir para o casal" não abre nem fecha nó.
9. **Tarefa 12:** depois de salvar um membro em Membros, abrir Células, Ministérios e o Dashboard mostra o estado de carregando e depois os valores novos, sem nunca mostrar os antigos (UX-13).
10. **Tarefas 7, 10 e 13:** o `ux-designer` dá o veredito e lista os ajustes, que voltam ao `frontend-developer` antes de o QA fechar o PR.

## Testes
_Seção do `qa`._ Arquivos em `mci-connect/supabase/tests/`: `database/e206_01_structure_grants` (EG), `e206_02_hierarchy_rules` (HR), `e206_03_read_contract` (RC), `e206_04_load_rebuild` (LR), `concurrency/e206_concurrency.sh` (CC) e `volume/e206_volume.psql` (VOL). Cada critério de HR e RC roda num cenário desfeito (`pg_temp.scn`): grava pela API, lê a tabela inteira da hierarquia e a `member_hierarchy_drift()`, e só então compara.

| RN | Testes | Resultado |
|---|---|---|
| RN-01, RN-04 | HR (tabela da massa, 23 pessoas; níveis 6 e 7 sem limite; cadeia e G12); RC (nenhuma coluna de caminho em texto na `members_view`) | ✅ |
| RN-02, RN-10 | RC (`members_view` de Rita, André, Diego e Hugo: nível, G12, líder e totais; `g12_id`/`g12_name` no fim). Os rótulos de tela ("Pastor", "G12") são do PR 2 | ✅ (banco) |
| RN-03 | HR: as sete trocas do critério (inclusive Zélia excluída e restaurada) | ✅ |
| RN-05, RN-06, RN-07 | HR: todos os critérios (inativar, excluir e restaurar, cadastrar, célula inativa, ativa, líder trocado ou excluída, sexo, nada muda). O "cadastro sem sexo" só existe relaxando o NOT NULL do E2.04 dentro do cenário | ✅ |
| RN-08 | HR (valores da troca de Fábio, as duas ordens com a C4, `missing_row` e `negative_total` desfazem tudo); RC (o que Membros, Células, Ministérios e Dashboard leem depois); CC (7 cenários nas duas ordens e em 6 rodadas simultâneas); VOL (metas) | ✅ |
| RN-09 | RC: raízes, `Pastores`, nível da posição, referência (`spouse_above`), Hugo e Vânia, cônjuge de cima fora da árvore (André e Débora/Bob), Beatriz inativa, Magda inativa, folha, Pedro, Diego, Hugo, sem `auth.uid()` | ✅ |
| RN-11 | RC (`cells_view`: G12 e nível do líder; células novas de Pedro, Samuel e Ester; André sob Samuel) | ✅ |
| RN-12 | RC (PATCH e INSERT com as colunas dão 42703; `authenticated` sem acesso à tabela); EG (privilégios, RLS sem política, CHECKs) | ✅ |
| RN-13 | LR (carga em `replica`, `drift` lista os 23, rebuild, valores, idempotência, 12^nível, problemas com ciclo e com líder excluído, `deleted_with_totals`, guarda da migration 1) | ✅ |
| DA-2, DT-05, DT-06 | HR (`leader_cycle`, `no_top`); EG (chave `members:leader-tree` igual em 5 funções, modos de trava em `pg_locks`); CC (restauração × troca de celular: sem 40P01) | ✅ |
| DT-10 | `db reset` com só a migration 1, depois com as duas: os 33 arquivos antigos dão 3388 ok (a carga em `replica` precisa do `rebuild`, senão `missing_row`). Com a migration 2 só diferem os que mudam de contrato (árvore, nível nulo sem liderança) | ✅ |

**Resultados (PR 1, 2026-11-25, stack local `mci-e104-be`):**
- pgTAP: 37 arquivos (33 adaptados + 4 novos), 3709 asserções ok, 0 falhas (`psql` pelo container); EG 199, HR 40, RC 69, LR 18.
- Concorrência `e206_concurrency.sh` (`ROUNDS=6`): 288 PASS, 0 FAIL, sem 40P01. `e104`, `e201`, `e202` e `e204` seguem verdes.
- Volume (20 mil membros, profundidade 10, 1.500 células): gravação comum 1 a 2 ms; troca de líder com 120 abaixo 5,5 ms; de um G12 com 1.999 abaixo 24,5 ms; pastor com 19.998 abaixo 298 ms; `rebuild` do zero 305 ms; página mais contagem 24 ms (membros) e 9 ms (células); `ministry_tree_nodes` com 100 ids 2,9 ms (Administrador) e 13 ms (G12); `dashboard_g12_ranking` 10 ms. A junção nova some do plano da contagem.
- Vitest 114 arquivos e 1699 testes ok; `tsc` e `build` ok; `lint` 3 erros e 8 avisos (os da `main`).
- Playwright `--workers=1`, suíte inteira: 296 ok, 3 falhas de ambiente conhecidas (UX-19 de `excluidos-membros`, `sign-in-stack:236`, axe claro de `sign-in.spec.ts:416`).
