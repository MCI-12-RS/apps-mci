# E2.14: Dashboard

> Status: Negócio, Experiência (UX), Solução técnica e Tarefas prontos.
> - Negócio escrito em 2026-11-24 pelo `product-owner`, sem regras "a confirmar". Atualizado no mesmo dia com as decisões do PO sobre as pendências PO-UX-1 a PO-UX-8 da UX, que viraram os padrões P-DSH-14 a P-DSH-21.
> - Experiência (UX) escrita em 2026-11-24 pelo `ux-designer`. As perguntas AQ-1 a AQ-10 são do `architect`.
> - Ficam para o usuário revisar no PR os padrões P-DSH-01 a P-DSH-21 e as perguntas Q-1 a Q-6. Nenhuma bloqueia: cada uma já tem um padrão adotado, e a T9 da UX mostra a tela em cada resposta.
> - Solução técnica e Tarefas escritas em 2026-11-24 pelo `architect`, só como desenho. As definidas pelo architect (DA-1 a DA-6) ficam para o usuário revisar no PR. Falta só a seção Testes.
> - Usa as definições do E2.02 (acesso, escopo, título, selo e atalho), do E2.05 (data de cadastro), do E2.06 (ranking), do E2.07 (cards de membros), do E2.08 (célula ativa), do E2.09 (pendentes), do E2.10 (cards de células) e do E2.12 (cards de relatórios).
> - O clique de cada grupo de cards só entra com a lista correspondente em produção (ver [Pontos para o `architect`](#pontos-para-o-architect)).
>
> Slug: `e2-14-dashboard` · Paridade com o legado: sim (DSH-01 a DSH-06). Regras novas:
> - "Novos membros" e "Novas células" contam também os inativos, como o legado, e nunca a "data não registrada";
> - "Células por tipo" conta só as células ativas, em três cards (com Macrocélulas);
> - "Visitantes em células" soma só os relatórios de célula realizada;
> - o card de pendentes fica em amarelo de aviso, e não em vermelho;
> - as partes do gráfico e as linhas do ranking "Células por G12" também abrem a lista;
> - o card com zero não abre lista, e cada card só abre a lista que a pessoa pode ver.

## Negócio
_Seção do `product-owner`. Escrita em 2026-11-24 e atualizada no mesmo dia com as decisões do PO sobre as pendências PO-UX-1 a PO-UX-8 da seção Experiência (UX) (P-DSH-14 a P-DSH-21). Fontes:_
- _o passo E2.14 em Progresso e as seções 3.6 (DSH-01 a DSH-06), 3.8 (DEL-02), 3.9 e 5.6 do [`docs/migracao.md`](../migracao.md);_
- _o `CLAUDE.md` da raiz: o Dashboard do legado e do novo, e a linha "Dashboard semanal com cards clicáveis" da matriz de paridade;_
- _o legado: `App/Services/DashboardService.cs`, `API/Controllers/DashboardController.cs`, `Infra/Repositories/ReportRepository.cs`, `Infra/Repositories/MemberRepository.cs`, `Domain/Extensions/QueryingExtensions.cs`, `Domain/Extensions/DateTimeExtensions.cs`, `UI/pages/Home/index.js` e `UI/pages/Home/style.css`;_
- _o `mci-connect` na `origin/main` (`4595daa`): `src/pages/Dashboard.tsx` e a migration `20261123120000_e108_dashboard_rpcs.sql`;_
- _os specs [E1.08](e1-08-paginacao-servidor.md) (RN-08, RN-09, Pontos de extensão), [E2.01](e2-01-exclusao-logica.md) (RN-08, RN-11), [E2.02](e2-02-perfis-escopo.md) (RN-02 a RN-07, RN-13, RN-22, P-PER-25, P-PER-29, T9), [E2.05](e2-05-auditoria-autor.md) (RN-01, RN-03, RN-10 d), [E2.06](e2-06-hierarquia-totais.md) (RN-06, RN-08, Definições), [E2.07](e2-07-filtros-membros.md) (RN-10 a RN-12, RN-17, Navegação e rotas), [E2.08](e2-08-cadastro-celulas.md) (RN-07, RN-11, Impactos), [E2.09](e2-09-situacao-relatorio.md) (RN-02, RN-04, RN-06, RN-08, P-SIT-14, P-SIT-16, P70, Impactos), [E2.10](e2-10-listagem-celulas.md) (RN-11, RN-21, P83, Navegação e rotas), [E2.11](e2-11-lancamento-relatorio.md) (RN-09, RN-12, Impactos; ainda sem commit) e [E2.12](e2-12-listagem-relatorios.md) (RN-10, RN-15, RN-18, P-LRE-34, Navegação e rotas; ainda sem commit)._

Os caminhos do legado são relativos a `g12app-net/`, com as abreviações do E2.01: `App/` = `G12App.Application/`, `Domain/` = `G12App.Domain/`, `UI/` = `G12App.API/ClientApp/src/` e `Infra/` = `G12App.Infrastructure.Data/`.

### Contexto e objetivo
No legado, o Dashboard é a tela inicial, para qualquer usuário logado, e mostra os números do escopo de cada um (`API/Controllers/DashboardController.cs:10-17`). Não recebe parâmetro: mostra sempre a semana atual, de domingo a sábado, no horário de Brasília. Tem duas seções:
- **"Esta Semana":**
  - "Relatórios Enviados" e "Visitantes em Células", sempre à vista;
  - "Células com Relatórios Pendentes", sempre à vista, vermelho quando há pendente e verde quando não há;
  - "Novos membros cadastrados" e "Novas células cadastradas", só quando são maiores que zero;
  - o gráfico "Relatórios de Células", com "Células realizadas", "Células canceladas" e "Células sem relatório". Ele some quando as três partes são zero.
- **"Geral":**
  - "Membros Ativos", sempre à vista;
  - "Células Evangelísticas", "Células Discipuladoras", "Membros Inativos", "Membros Não Batizados", "Membros Sem Liderança" e "Membros Sem Vínculo Celular", só quando são maiores que zero. Os dois últimos têm a cor de aviso.

Cada card abre a lista correspondente já filtrada (`UI/pages/Home/index.js:18-60`). O gráfico não abre nada.

Hoje o novo (conferido na `origin/main` do `mci-connect`, `4595daa`, em 2026-11-24):
- Os números vêm do banco, em três consultas: os cards, os tipos de célula e o ranking (E1.08). A semana e o "agora" são do servidor, em Brasília.
- **"Esta Semana (22/11 - 28/11)"** tem quatro cards: "Relatórios Enviados", "Células sem Relatório" (o card de pendentes, sem a tolerância de 1 hora), "Visitantes em Células" e "Células Não Realizadas".
- **"Geral"** tem sete cards de membros ("Total de Membros", "Membros Ativos", "Membros Inativos", "Batizados", "Não Batizados", "Sem Liderança" e "Sem Vínculo Celular") e um card por tipo de célula que existe, contando as ativas e as inativas, com títulos como "Células Discipulado" e "Células Macrocélula".
- **"Células por G12"**: o ranking dos casais G12, com as células masculinas, femininas e o total.
- Nenhum card abre lista. Não há gráfico, nem "Novos membros", nem "Novas células".
- Todos os cards aparecem, mesmo com zero, exceto os tipos sem nenhuma célula. A cor fica só no ícone.
- **Já corrigido:** as células de segunda a sexta passaram a entrar no card de pendentes (PR 3 do E1.08, mci-connect#15), e o ranking conta cada célula uma vez só (mci-connect#13).
- Os specs anteriores já fecharam pedaços do Dashboard, ainda sem implementação:
  - o acesso, o escopo, o título, o selo e o atalho "Novo relatório" (E2.02);
  - o card de pendentes, com o nome "Células com relatório pendente" (E2.09);
  - o card "Sem Vínculo Celular" (E2.07);
  - o equivalente de cada card na lista de Membros (E2.07), de Células (E2.10) e de Relatórios (E2.12).

Objetivo do passo:
- acrescentar "Novos membros" e "Novas células" da semana;
- fazer cada número abrir a lista exata por trás dele (DSH-05);
- trazer o gráfico da semana (DSH-04), com a situação do relatório do E2.09;
- fechar a aparência: os cards com zero, a cor do card de pendentes e os títulos (DSH-06);
- reunir num lugar só a definição de cada card, apontando para o spec que já a fechou, sem redefinir nada.

### Termos
- **Semana** e **agora:** como no E2.09. A semana vai de domingo, 00:00, a sábado, 23:59:59, no horário de Brasília (`America/Sao_Paulo`). O "agora" é o do servidor. O relógio e o fuso do aparelho não contam.
- **Card:** um número do Dashboard com o seu título.
- **Visível:** o que a pessoa vê, pelo E2.02 (RN-02 a RN-04 de lá). O excluído nunca é visível (RN-08 do E2.01).
- **Relatório da semana:** relatório não excluído com data dentro da semana. Vale a data do relatório, e não o momento do envio.
- **Célula realizada** e **Não houve célula:** o que o relatório registra (REL-05, REL-06; RN-08 e RN-09 do E2.11).
- **Data de cadastro:** a data de Brasília do momento do cadastro, definida pelo servidor (RN-01 e RN-03 do E2.05; RN-12 do E2.07). Os cadastros antigos do legado sem essa informação têm "data não registrada" (RN-10 d do E2.05).
- **Célula ativa:** célula não excluída com "Situação: Ativa" (RN-11 do E2.08).
- **Equivalente na lista:** a lista, com os filtros, que mostra o mesmo conjunto que o card conta (RN-17 do E2.07, RN-21 do E2.10, RN-18 do E2.12).
- **Card escondido:** o card que não aparece na tela porque o número é zero (RN-14).

### Personas e permissões
Nenhuma permissão nova. Os nomes entre aspas são os rótulos da tela de Funções (RN-22 do E2.02). As pessoas são as da [massa de exemplo](#massa-de-exemplo).

| Persona | Quem é | Permissões relevantes | O que exercita |
|---|---|---|---|
| IG Igreja toda | Rita, função Administrador | "Visualizar Dashboard" e "Visualizar Toda a Igreja" | os números da igreja e todos os links |
| PA Pastor | Samuel, função Líder | "Visualizar Dashboard" e "Visualizar Seu Ministério" | a árvore inteira, menos quem está sem liderança; célula de pastor |
| G12 | Pedro, função Líder | as mesmas de Samuel | os números do ministério e o selo "Meu Ministério" |
| OM Outro ministério | Diego, função Líder | as mesmas de Samuel | o que fica fora do escopo de Pedro |
| PC Pessoa da célula | Caio, função Membro | "Visualizar Dashboard", "Visualizar Seu Ministério" e "Enviar Relatório das Próprias Células" | o atalho "Novo relatório" e os números atualizados |
| SL Sem liderança | Ester, função Membro | as mesmas de Caio | o card "Sem liderança" |
| IN Inativo | Fábio, função Membro, inativo | as mesmas de Caio | quem está inativo continua com o Dashboard |
| SD Só o Dashboard | Carla, numa variação, com a função "Painel" | só "Visualizar Dashboard" e "Enviar Relatório das Próprias Células" | os números do que ela vê, sem os links de Membros e de Células |
| SF Sem função | Hugo | nenhuma | sem acesso |
| SR Só relatórios | Lia, função Secretaria | só "Visualizar Relatórios de Toda a Igreja" | sem acesso |
| SI Sistema | o servidor | — | calcula todos os números |

### Histórias
- Como pastor, quero ver num lugar só como está a semana das células (relatórios enviados, pendentes, visitantes, novos membros e novas células), para acompanhar a expansão da igreja.
- Como G12, quero tocar num número e ver a lista exata das células ou das pessoas por trás dele, para agir sobre cada uma.
- Como líder, quero ver com destaque quantas células do meu ministério estão com o relatório pendente, para lembrar os líderes a tempo.
- Como liderança, quero ver no gráfico da semana quantas células se reuniram, quantas não se reuniram e quantas ainda não enviaram o relatório.
- Como secretaria, quero saber quantas pessoas e quantas células foram cadastradas nesta semana.
- Como pastor, quero que o número do card e o total da lista aberta por ele sejam iguais, para confiar nos dois.

### Decisões

#### Decisões do usuário e de passos anteriores
| Decisão | O que vale aqui | Onde |
|---|---|---|
| D1 (2026-11-14), DEL-02 e RN-08 do E2.01 | Nenhum excluído conta em nenhum card, gráfico ou ranking. | RN-01 |
| RN-11 do E2.01 | O relatório de célula excluída conta nas somas da semana; a célula excluída não conta nas contagens de células. | RN-03, RN-05, RN-06, RN-12 |
| D2 (2026-11-23) | Os totais não contam inativos. | RN-10 (coerência) |
| RN-08 e RN-09 do E1.08; D-3 (2026-11-15) | Números calculados no banco, semana e "agora" do servidor, acesso ao Dashboard; células de segunda a sexta nos pendentes e ranking sem dupla contagem. | RN-01, RN-02, RN-18 |
| RN-02 a RN-07, RN-13 e RN-22 do E2.02; P-PER-25 e P-PER-29 | Escopo de cada número; mensagens sem acesso; título, subtítulo e selo; atalho "Novo relatório". | RN-01 |
| RN-10 (d) do E2.05 | "data não registrada" nunca conta como novo. | RN-07, RN-08 |
| Definições, RN-06 e RN-08 do E2.06 | O ranking "Células por G12". | RN-11 |
| RN-10, RN-11, RN-12 e RN-17 do E2.07 | Vínculo celular, data de cadastro e o equivalente de cada card de membros. | RN-07, RN-09, RN-13 |
| RN-11 e Impactos do E2.08 | A célula inativa não conta nos totais nem nas pendências; recomendação de contar só as ativas por tipo. | RN-10 |
| RN-02, RN-04, RN-06 e RN-08 do E2.09; P-SIT-14, P-SIT-16 e P70 | O card de pendentes, o nome dele, o tom "Pendente" e os títulos com só a primeira letra maiúscula. | RN-04, RN-12, RN-15, RN-16 |
| RN-21 do E2.10 | O equivalente de cada card de células e do ranking. | RN-13 |
| Impactos do E2.11 (E2.14); RN-09 e RN-12 de lá | "Relatórios enviados" conta "Não houve célula"; "Não houve célula" não tem visitantes; o número de visitantes é o número de nomes. | RN-03, RN-05 |
| RN-15, RN-18 e P-LRE-34 do E2.12 | O equivalente de cada número de relatórios; a linha de "Não houve célula" não mostra visitantes. | RN-05, RN-13 |
| 3.9 do plano | Changelog e situações `Cancelled*` não são replicados. | Fora de escopo |

#### Padrões definidos por este spec (revisar no PR)
As fontes não respondem estes pontos, ou o legado não os define com precisão. O PO adotou a opção mais conservadora e coerente com o legado e com os specs anteriores. Nas regras, eles aparecem como "definida pelo spec", e o usuário pode mudar qualquer um na revisão do PR.

- **P-DSH-01, só a semana atual** (RN-02).
  - O Dashboard do legado não navega entre semanas: a consulta não recebe parâmetro. O novo também não navega.
  - As semanas anteriores continuam consultáveis pelos atalhos "Semana passada" e "Semana retrasada" de Relatórios (RN-10 do E2.12) e pelo filtro "Sem relatório nas semanas anteriores" de Células (RN-10 do E2.10).
  - O cálculo para outro momento de referência, que o E2.09 já define (RN-02 de lá), continua servindo só para os testes. Ver Q-1.
- **P-DSH-02, visitantes só de célula realizada** (RN-05).
  - O relatório de "Não houve célula" não tem visitantes (RN-09 do E2.11), e a lista de Relatórios não os mostra, nem nos relatórios do legado (P-LRE-34 do E2.12).
  - Se um relatório do legado de "Não houve célula" com visitantes cair na semana atual (na semana do cutover, por exemplo), esses visitantes não contam, para o card bater com o que a lista mostra.
- **P-DSH-03, novas células ativas ou inativas** (RN-08).
  - A célula nova sempre começa ativa (RN-11 do E2.08). Se for inativada na mesma semana, continua contando como nova, porque foi cadastrada naquela semana. O legado contava toda célula cadastrada na semana.
  - É o equivalente que o E2.10 já fechou (RN-21 de lá: só as datas, sem "Situação").
- **P-DSH-04, células por tipo: só as ativas, em três cards** (RN-10).
  - Segue a recomendação do E2.08 (Impactos de lá), coerente com a D2: a célula inativa parou de se reunir e já não conta nos totais, nos pendentes nem no ranking.
  - O card "Macrocélulas" continua, como no novo de hoje. O legado mostrava só as evangelísticas e as discipuladoras.
  - A alternativa é contar ativas e inativas, como hoje. Ver Q-5.
- **P-DSH-05, quando o card abre a lista** (RN-13).
  - O card com zero não abre nada: a lista estaria vazia.
  - O card só abre a lista que a pessoa pode ver pelo menu (RN-22 do E2.02). Sem acesso a ela, o número aparece sem link.
  - No legado, todo card visível abria a lista, inclusive o de pendentes com zero.
- **P-DSH-06, o ranking abre a lista do casal** (RN-11, RN-13).
  - O legado não tinha ranking. O E2.10 deixou o equivalente pronto (RN-21 de lá) e a decisão para cá.
  - Cada linha abre as células ativas do casal, e o total da lista é o da coluna "Total".
  - "Homens" e "Mulheres" não têm lista própria, porque a lista de Células não filtra pelo sexo do líder. O toque nesses números abre a mesma lista do casal (P-DSH-19).
- **P-DSH-07, o gráfico abre a lista e usa os tons da situação** (RN-12, RN-13).
  - O gráfico do legado não abria nada. O E2.12 deixou os equivalentes prontos (RN-18 de lá).
  - "Pendente" tem o tom e o ícone do "Pendente" da lista (P70 do E2.09); "Célula realizada", o tom do "Enviado"; "Não houve célula", um tom neutro, diferente dos outros dois. "Não houve célula" não usa o vermelho de erro do legado ("Células canceladas"): o relatório foi enviado (P-SIT-13 do E2.09).
  - O gráfico mostra três partes, como o legado. Ver Q-4.
  - A forma (barras, uma linha por parte) é a P-DSH-14.
- **P-DSH-08, cards com zero escondidos** (RN-14).
  - Segue o legado: ficam sempre à vista "Relatórios enviados", "Células com relatório pendente", "Visitantes em células" e "Membros ativos"; os demais somem com zero.
  - Para os cards que só o novo tem: "Total de membros" fica sempre à vista, como "Membros ativos"; "Batizados" some com zero, como "Não batizados"; "Células não realizadas" some com zero, porque o número também está no gráfico; "Macrocélulas" some com zero, como os outros tipos.
  - Hoje o novo mostra todos os cards, com zero. Ver Q-2.
- **P-DSH-09, card de pendentes em amarelo de aviso** (RN-15).
  - O E2.09 deixou para cá manter o vermelho do legado (DSH-06) ou alinhar com o badge "Pendente", que é amarelo de aviso (P-SIT-14 de lá).
  - O spec alinha: o mesmo tom e o mesmo ícone do "Pendente" em todo o sistema. A pendência é um aviso, e não um erro: o líder ainda pode enviar o relatório. Com zero, o card fica verde, como no legado.
  - Ver Q-3.
- **P-DSH-10, visitantes sem cor de aviso no zero** (RN-15). O legado pintava "Visitantes em Células" com a cor de aviso quando o número era zero. O novo não pinta: no domingo e na segunda, o número quase sempre é zero, porque as células ainda não se reuniram, e o aviso não diria nada. A alternativa é seguir o legado.
- **P-DSH-11, títulos e ordem** (RN-16).
  - Todos os títulos com só a primeira letra maiúscula, como o card de pendentes (P-SIT-16 do E2.09).
  - Os tipos usam o nome gravado do tipo (RN-07 do E2.08) numa frase que se lê bem: "Células evangelísticas", "Células de discipulado" e "Macrocélulas".
  - "Novos membros" e "Novas células", sem "cadastrados": a seção "Esta semana" já diz o período.
  - A ordem mantém a de hoje e acrescenta os cards novos no fim da seção, como no legado.
- **P-DSH-12, atualização** (RN-17). Como a P-SIT-08 do E2.09: os números são os da última consulta. Depois de uma gravação feita pelo app, o Dashboard nunca mostra o número antigo. A passagem do tempo com o Dashboard aberto só aparece na consulta seguinte.
- **P-DSH-13, reconciliação** (RN-19). Na comparação lado a lado com o legado (5.6), cada card só pode diferir pelas regras listadas na RN-19, e o script diz o motivo de cada diferença.
- **Vindos do desenho de UX (2026-11-24, PO-UX-1 a PO-UX-8 em "Experiência (UX)"):**
  - **P-DSH-14, gráfico em barras, sem a aba "Tabela"** (PO-UX-1, RN-12).
    - O gráfico tem uma linha por parte, com o nome (o badge das listas), o número em texto e uma barra proporcional ao maior número. A linha inteira abre a lista. É o P113 da UX, que refina o P83 do E2.10 para gráficos de poucas partes.
    - **Peso contra o P83**, que a RN-12 citava:
      - o P83 pede a aba "Tabela" para que os números possam ser lidos sem o desenho. Aqui o número já está em texto em cada linha, então a tabela repetiria os mesmos três números atrás de mais um controle;
      - a RN-13 pede que cada parte abra uma lista. Num desenho em SVG, as partes não recebem foco, e o teclado e o leitor de tela só abririam as listas pela aba "Tabela";
      - o Dashboard é a tela inicial. Sem biblioteca de gráfico, ele não baixa nada a mais no celular.
    - **O que o legado entregava continua:** as três partes, o número de cada uma escrito ao lado do nome, o título e o gráfico oculto quando as três são zero. Muda a forma: de pizza para barras. A pizza só distingue as partes pela cor, o que a RN-12 não aceita.
    - Gráficos com eixo de tempo ou com várias séries (por exemplo, a evolução do E2.10) continuam no P83.
  - **P-DSH-15, legenda do gráfico** (PO-UX-2, RN-12). "Células que ainda não precisam enviar o relatório desta semana não entram." Explica, na própria tela, por que a soma das partes é menor que o número de células: "Ainda não ocorreu" e "Conta a partir da próxima semana" ficam de fora.
  - **P-DSH-16, cor só em três cards** (PO-UX-3, RN-15).
    - Só três cards têm tom: o de pendentes (aviso ou sucesso), "Sem liderança" e "Sem vínculo celular" (aviso). Os outros ficam neutros.
    - Saem as cores de ícone de hoje, inclusive o vermelho de "Membros inativos" e de "Células não realizadas", que não são erro. Nenhum card de número usa o vermelho de erro, que fica para erro e exclusão.
    - O aviso tem uma barra na borda esquerda, e o card de pendentes troca o triângulo pelo ícone de confirmação quando zera. É a diferença sem depender da cor que a RN-15 pede.
  - **P-DSH-17, ícones** (PO-UX-4). "Novos membros" fica com o ícone de pessoa com "+", que hoje é de "Visitantes"; "Visitantes em células" passa ao aperto de mãos; os três tipos passam à casa; "Células não realizadas" passa ao ícone do badge "Não houve célula". Os ícones são decorativos: o título e o número dizem tudo.
  - **P-DSH-18, duas colunas de cards no celular** (PO-UX-5). Em 360 px, a rolagem cai à metade, e o card de pendentes fica à vista sem rolar, logo abaixo do atalho "Novo relatório". Com fonte grande ou zoom, a grade volta a uma coluna.
  - **P-DSH-19, a linha do casal no ranking** (PO-UX-6; RN-11, RN-13). Muda a P-DSH-06.
    - O nome do casal é o link, e o toque em qualquer lugar da linha, inclusive em "Homens" ou "Mulheres", abre a mesma lista: as células ativas do casal.
    - A seta fica ao lado do "Total", o número que a lista repete. A lista mostra os chips "G12" e "Situação: Ativa" e o total, então não sugere que filtrou pelo sexo do líder.
    - É o P81, que as tabelas de Células e de Relatórios já usam: a linha é o item, e no celular os números são alvos pequenos demais para ter comportamentos diferentes.
    - Os números perdem as pílulas azul e rosa, que usam cores fora do padrão e competem com o Total.
    - A alternativa da UX era só o nome abrir a lista, com "Homens" e "Mulheres" sem reação ao toque.
  - **P-DSH-20, voltar e atualizar** (PO-UX-7; RN-13, RN-17).
    - Voltar de uma lista devolve o Dashboard na mesma posição, com o foco no número aberto, quando nada foi gravado no meio. O pastor abre um número, volta e abre o seguinte sem rolar de novo. Depois de uma gravação, o Dashboard carrega do zero e começa do topo.
    - Com o Dashboard aberto, enquanto os números novos não chegam, os de antes ficam marcados como em atualização (P44), e nunca como atuais.
    - Se a consulta depois de uma gravação falhar, a seção mostra o erro, e não o número de antes, para cumprir a RN-17.
    - Ao voltar para a aba, sem gravação, uma falha mantém os números, como hoje (E1.08).
  - **P-DSH-21, textos da UX** (PO-UX-8). Aceitos sem ajuste:
    - a legenda do gráfico (P-DSH-15);
    - as quatro mensagens de erro por seção, com "Tentar de novo", no lugar de "Erro ao carregar o dashboard.", que não diz o que fazer;
    - para o leitor de tela: o destino de cada link ("ver na lista de Membros"), a semana por extenso e a legenda e o link do ranking;
    - os textos da T9, que só valem se a pergunta correspondente (Q-1 a Q-6) virar regra.
    - Os textos ligados a uma regra (a legenda e os erros) foram copiados para os [Textos de tela](#textos-de-tela). Os do leitor de tela e da T9 ficam em "Textos", na seção Experiência (UX).

### Regras de negócio
Nenhuma regra está "a confirmar".

Correspondência com o plano: DSH-01 → RN-01 · DSH-02 → RN-02 a RN-05, RN-07 e RN-08 · DSH-03 → RN-09 e RN-10 · DSH-04 → RN-12 · DSH-05 → RN-13 · DSH-06 → RN-14 e RN-15. Os cards que só o novo tem → RN-06, RN-09, RN-10 e RN-11. Títulos, atualização, correções já entregues e carga → RN-16 a RN-19.

| ID | Regra | Origem |
|---|---|---|
| RN-01 | **Acesso e alcance (DSH-01).**<br>- Só quem tem "Visualizar Dashboard" vê os números. Os demais veem "Você não tem acesso ao dashboard.", com a orientação de quem não tem função ou não tem cadastro (RN-07 do E2.02). Pela API, recebem o erro de permissão (42501).<br>- Todo número conta só o que a pessoa vê (RN-02 a RN-04 do E2.02), e nunca um excluído (RN-08 do E2.01). Pela API, os números são os mesmos da tela.<br>- O membro inativo continua com o Dashboard, com a mesma função e o mesmo escopo (RN-07 do E2.02).<br>- Continuam como o E2.02 definiu, sem mudança aqui: o subtítulo "Visão geral da igreja" ou "Visão do seu ministério", o selo "Meu Ministério" e o atalho "Novo relatório" (RN-13 e RN-22 de lá; RN-11 c do E2.08). | DSH-01; legado (`API/Controllers/DashboardController.cs:10-17`: qualquer usuário logado; `Infra/Repositories/MemberRepository.cs:44-51` e `ReportRepository.cs:68-75`: só os não excluídos, com o filtro de escopo); E1.08 (RN-08, RN-09); E2.01 (RN-08); E2.02 (RN-02 a RN-07, RN-13, RN-22, P-PER-25, P-PER-29) |
| RN-02 | **Semana.**<br>- A seção "Esta semana" mostra o domingo e o sábado da semana atual ("Esta semana (22/11 - 28/11)"), pela data do servidor.<br>- Todos os números da seção, o gráfico e as datas dos links usam essa semana. Eles recomeçam no domingo, às 00:00 de Brasília.<br>- O relógio e o fuso do aparelho não mudam a semana nem nenhum número.<br>- O Dashboard mostra só a semana atual. A tela não oferece outra semana. | DSH-02; legado (`App/Services/DashboardService.cs:39-40` e `Domain/Extensions/DateTimeExtensions.cs:8-18`: do domingo ao sábado da data de Brasília; `UI/pages/Home/index.js:173`: "Esta Semana"); E1.08 (RN-08); E2.09 (Termos, RN-02); só a semana atual: definida pelo spec (P-DSH-01) |
| RN-03 | **Relatórios enviados.** O número de relatórios da semana visíveis:<br>- conta os de "Célula realizada" e os de "Não houve célula";<br>- conta os relatórios de célula excluída (RN-11 do E2.01);<br>- não conta o relatório excluído.<br>Cada célula tem no máximo um relatório por semana (REL-03), então o número é também o de células com relatório visível na semana. | DSH-02; legado (`App/Services/DashboardService.cs:42-49` e `:89-90`; `UI/pages/Home/index.js:110`); E1.08 (RN-08, `reports_sent`); E2.01 (RN-11); E2.11 (Impactos: "relatórios enviados" continua contando os de "Não houve célula") |
| RN-04 | **Células com relatório pendente.** É o card da RN-08 do E2.09, sem nenhuma regra nova aqui: as células visíveis com a situação da semana "Pendente", no momento da consulta, com o prazo de 1 hora e as semanas que contam. A aparência é a da RN-15. | DSH-02; CEL-05; legado (`App/Services/DashboardService.cs:80-87`; `UI/pages/Home/index.js:112-116`); E2.09 (RN-02, RN-04, RN-06, RN-08) |
| RN-05 | **Visitantes em células.** A soma do número de visitantes (RN-12 do E2.11: os nomes gravados) dos relatórios da semana visíveis de **célula realizada**, inclusive os de célula excluída.<br>- O relatório de "Não houve célula" nunca soma visitantes, nem o que veio do legado com visitantes.<br>- O número é igual à soma dos visitantes que a lista de Relatórios mostra com "Esta semana" (RN-13). | DSH-02; legado (`App/Services/DashboardService.cs:92-93` e `Infra/Repositories/ReportRepository.cs:95-100`: soma do número de visitantes dos relatórios da semana); E1.08 (RN-08, `visitors`); E2.01 (RN-11); E2.11 (RN-09, RN-12); E2.12 (RN-15, RN-18, P-LRE-34); só célula realizada: definida pelo spec (P-DSH-02) |
| RN-06 | **Células não realizadas.** O número de relatórios da semana visíveis de "Não houve célula", inclusive os de célula excluída. É o mesmo número da parte "Não houve célula" do gráfico (RN-12). | novo (`dashboard_summary.cells_not_held`, PR 3 do E1.08); legado (`App/Services/DashboardService.cs:133-142`: o mesmo número, usado só no gráfico); E2.01 (RN-11) |
| RN-07 | **Novos membros.** O número de membros visíveis com a data de cadastro (Brasília) entre o domingo e o sábado da semana atual, os dois dias incluídos.<br>- Contam os ativos e os inativos, de qualquer situação de liderança, inclusive pastor(a).<br>- A "data não registrada" nunca conta, em nenhuma semana.<br>- Restaurar um membro (E2.01) não muda a data de cadastro: ele só conta se foi cadastrado nesta semana.<br>- Um membro cadastrado e excluído na mesma semana não conta.<br>- O número é igual ao total da lista de Membros com "Cadastrado a partir de" o domingo e "Cadastrado até" o sábado (RN-17 do E2.07). | DSH-02; legado (`App/Services/DashboardService.cs:95-103`: cadastro entre o início e o fim da semana, sem filtro de situação; `UI/pages/Home/index.js:120-121`); E2.05 (RN-01, RN-03, RN-10 d); E2.07 (RN-12, RN-17); E2.01 (RN-08) |
| RN-08 | **Novas células.** O número de células visíveis com a data de cadastro (Brasília) entre o domingo e o sábado da semana atual, os dois dias incluídos.<br>- Contam as de qualquer tipo, ativas ou inativas. A célula nova sempre começa ativa (RN-11 do E2.08); se for inativada na mesma semana, continua contando.<br>- A "data não registrada" nunca conta.<br>- Restaurar uma célula não muda a data de cadastro. A célula cadastrada e excluída na mesma semana não conta.<br>- O número é igual ao total da lista de Células com "Cadastrada a partir de" o domingo e "Cadastrada até" o sábado (RN-21 do E2.10). | DSH-02; legado (`App/Services/DashboardService.cs:105-113`; `UI/pages/Home/index.js:123-124`); E2.05 (RN-01, RN-03, RN-10 d); E2.08 (RN-11); E2.10 (RN-11, RN-21); ativas ou inativas: definida pelo spec (P-DSH-03) |
| RN-09 | **Cards de membros (Geral).** As definições já estão fechadas e não mudam aqui:<br>- **Total de membros:** todos os membros visíveis, ativos e inativos;<br>- **Membros ativos** e **Membros inativos:** pela situação do membro;<br>- **Batizados** e **Não batizados:** pela marca "Batizado", entre ativos e inativos;<br>- **Sem liderança:** ativos na situação "Sem liderança" (RN-11 do E2.04). Quem vê só o ministério não vê quem está sem liderança (RN-06 do E2.02);<br>- **Sem vínculo celular:** ativos em "Sem vínculo" (RN-10 e RN-11 do E2.07).<br><br>Cada pessoa conta uma vez. Marido e esposa contam como duas pessoas. | DSH-03; legado (`App/Services/DashboardService.cs:53-60`, `:115-131` e `:155-171`; `UI/pages/Home/index.js:126-145`); E1.08 (RN-08); E2.02 (RN-06); E2.04 (RN-11); E2.07 (RN-10, RN-11, RN-17) |
| RN-10 | **Células por tipo (Geral).** Três cards, um por tipo (Evangelística, Discipulado e Macrocélula; RN-07 do E2.08), cada um com o número de células visíveis e **ativas** daquele tipo.<br>- A célula inativa e a excluída não contam.<br>- Reativar ou restaurar uma célula a devolve ao card na consulta seguinte.<br>- Muda em relação a hoje: o novo conta também as inativas.<br>- O número é igual ao total da lista de Células com o Tipo e "Situação: Ativa" (RN-21 do E2.10, com a linha ajustada; ver Impactos). | DSH-03; legado (`App/Services/DashboardService.cs:62-78`: células evangelísticas e discipuladoras; o legado não tem célula inativa); novo (`dashboard_cells_by_type`, com Macrocélula); E2.08 (RN-07, RN-11; Impactos: recomendação de contar só as ativas); D2; só ativas e três cards: definida pelo spec (P-DSH-04) |
| RN-11 | **Ranking "Células por G12".** É o ranking do E2.06 (Definições, RN-06 e RN-08 de lá) e do E1.08 (RN-08 b), sem regra nova de contagem:<br>- uma linha por casal G12, com as células ativas masculinas, femininas e o total da subárvore. O casal é uma linha só;<br>- cada célula conta uma vez;<br>- a seção some quando a pessoa não vê nenhum G12;<br>- cada linha abre a lista das células ativas do casal, com o total igual ao da coluna "Total" (RN-13). O toque em "Homens" ou em "Mulheres" abre a mesma lista, porque a lista de Células não filtra pelo sexo do líder. | novo (`dashboard_g12_ranking`, PR 3 do E1.08; mci-connect#13); E2.06 (Definições, RN-06, RN-08); E2.10 (RN-21: equivalente do ranking; P81); o clique: definida pelo spec (P-DSH-06, P-DSH-19) |
| RN-12 | **Gráfico da semana (DSH-04).** Na seção "Esta semana", depois dos cards, o gráfico "Relatórios de células" mostra três partes:<br>- **Célula realizada:** o número de relatórios da semana visíveis de célula realizada, inclusive os de célula excluída;<br>- **Não houve célula:** o número da RN-06;<br>- **Pendente:** o número da RN-04 (células).<br><br>Regras:<br>- As células "Ainda não ocorreu" e "Conta a partir da próxima semana" (E2.09) não entram. A legenda diz isso na tela: "Células que ainda não precisam enviar o relatório desta semana não entram."<br>- O gráfico aparece quando pelo menos uma parte é maior que zero, e some quando as três são zero.<br>- **Forma:** uma linha por parte, sempre nesta ordem, com o nome, o número em texto e uma barra proporcional ao maior número das três. A parte com zero aparece com "0" e sem barra. Não há outra forma de ver os mesmos números (aba "Tabela"): eles já estão em texto. É o P113 da UX, que refina o P83 do E2.10 para gráficos de poucas partes.<br>- **Tons:** "Pendente" com o tom e o ícone do "Pendente" da lista (P70 do E2.09); "Célula realizada" com o tom do "Enviado"; "Não houve célula" com um tom neutro, diferente dos outros dois, e nunca o vermelho de erro. As partes se distinguem também sem a cor, pelo nome e pelo ícone.<br>- Cada parte maior que zero abre a sua lista pela própria linha, que recebe foco pelo teclado e é lida pelo leitor de tela (RN-13). | DSH-04; legado (`UI/pages/Home/index.js:67-105`: as três partes, o número de cada uma ao lado do nome, o título "Relatórios de Células" e o gráfico oculto quando as três são zero; `App/Services/DashboardService.cs:80-87` e `:133-153`); E2.09 (RN-04, RN-08, P70; Impactos: o gráfico usa os tons da lista); E2.10 (P83, refinado pelo P113 da UX deste spec); E2.12 (RN-18); tons, link e texto: definida pelo spec (P-DSH-07); barras sem a aba "Tabela": definida pelo spec (P-DSH-14, PO-UX-1); legenda: definida pelo spec (P-DSH-15, PO-UX-2) |
| RN-13 | **Cada número abre a lista filtrada (DSH-05).** Cada card, cada parte do gráfico e cada linha do ranking abre a lista com os filtros da tabela [Links de cada número](#links-de-cada-número), pelo endereço da página (RN-14 do E2.07, RN-12 do E2.10, RN-12 do E2.12).<br>- **Mesmo conjunto:** no mesmo momento, a lista aberta mostra o mesmo conjunto que o número conta, para qualquer pessoa. O total da lista é igual ao número (a soma dos visitantes, no card de visitantes).<br>- **Semana dos links:** as datas dos links são o domingo e o sábado que a seção "Esta semana" mostra, e não as do aparelho. Se a semana virar com o Dashboard aberto, o link abre a semana que o card mostrava.<br>- **Quem pode abrir:** o número só abre a lista se a pessoa tem acesso a ela pelo menu (RN-22 do E2.02): Membros e Células com "Visualizar Toda a Igreja" ou "Visualizar Seu Ministério"; Relatórios também com as permissões de ver ou de enviar relatórios. Sem acesso, o número aparece sem link.<br>- **Zero:** o número zero não abre nada.<br>- **Ranking:** a linha do casal inteira abre a lista, e o número que a lista repete é o "Total" (RN-11).<br>- A lista abre no lugar do Dashboard. Voltar, pelo navegador ou pelo aparelho, devolve o Dashboard na mesma posição, com o foco no número aberto, quando nada foi gravado no meio. Depois de uma gravação, o Dashboard carrega do zero, do topo (RN-17). | DSH-05; legado (`UI/pages/Home/index.js:18-60` e `:110-145`: cada card abre a lista com os filtros dele); E2.07 (RN-14, RN-17, Navegação e rotas); E2.10 (RN-12, RN-21, P81, Navegação e rotas); E2.12 (RN-10, RN-12, RN-18, Navegação e rotas); E2.02 (RN-22); zero, acesso, ranking e gráfico: definida pelo spec (P-DSH-05 a P-DSH-07, P-DSH-19); posição e foco na volta: definida pelo spec (P-DSH-20, PO-UX-7) |
| RN-14 | **Cards com zero (DSH-06).**<br>- **Sempre à vista,** mesmo com zero: "Relatórios enviados", "Células com relatório pendente", "Visitantes em células", "Total de membros" e "Membros ativos".<br>- **Escondidos com zero:** "Células não realizadas", "Novos membros", "Novas células", "Membros inativos", "Batizados", "Não batizados", "Sem liderança", "Sem vínculo celular", "Células evangelísticas", "Células de discipulado" e "Macrocélulas".<br>- O gráfico segue a RN-12, e o ranking, a RN-11.<br>- Nenhuma seção fica vazia: "Esta semana" tem sempre três cards, e "Geral", sempre dois. | DSH-06; legado (`UI/pages/Home/index.js:110-145`: os cards da semana de relatórios, pendentes e visitantes e o de membros ativos sempre à vista, os demais só quando são maiores que zero); cards que só o novo tem: definida pelo spec (P-DSH-08) |
| RN-15 | **Aparência (DSH-06).**<br>- **Card de pendentes:** maior que zero, com o tom de aviso (amarelo) e o ícone do "Pendente" da lista; zero, com o tom de sucesso (verde) e um ícone de confirmação. A diferença também aparece sem a cor, pela troca do ícone.<br>- **"Sem liderança" e "Sem vínculo celular":** com o tom de aviso, como no legado e como o novo já faz no ícone.<br>- **"Visitantes em células":** sem tom de aviso com zero.<br>- **Todos os outros cards ficam neutros**, sem cor no ícone, inclusive "Membros inativos" e "Células não realizadas".<br>- **Nenhum card de número usa o vermelho de erro.**<br>- O tom de aviso também aparece sem a cor (na UX, uma barra na borda do card). A forma de cada tom é da UX (P111). | DSH-06; legado (`UI/pages/Home/index.js:112-113`: vermelho com pendente e verde sem; `:118`, `:142` e `:145`: cor de aviso); E2.09 (P-SIT-14, P70; Impactos: "o E2.14 decide se mantém a DSH-06 ou se alinha com o badge"); amarelo: definida pelo spec (P-DSH-09); visitantes: definida pelo spec (P-DSH-10); cor só em três cards e nenhum vermelho: definida pelo spec (P-DSH-16, PO-UX-3) |
| RN-16 | **Títulos e ordem.** Os títulos têm só a primeira letra maiúscula, com os textos da tabela [Textos de tela](#textos-de-tela). A ordem:<br>- **Esta semana:** Relatórios enviados, Células com relatório pendente, Visitantes em células, Células não realizadas, Novos membros e Novas células; depois, o gráfico "Relatórios de células";<br>- **Geral:** Total de membros, Membros ativos, Membros inativos, Batizados, Não batizados, Sem liderança, Sem vínculo celular, Células evangelísticas, Células de discipulado e Macrocélulas;<br>- **Células por G12:** o ranking, por último.<br>O card escondido (RN-14) não ocupa lugar. | E2.09 (P-SIT-16: "Relatórios enviados", "Visitantes em células" e "Células não realizadas" ficam para o E2.14); legado (`UI/pages/Home/index.js:110-145`: ordem e títulos); novo (`src/pages/Dashboard.tsx:57-72`: ordem de hoje); definida pelo spec (P-DSH-11) |
| RN-17 | **Atualização.**<br>- Os números são os do momento da última consulta.<br>- Depois de uma gravação feita pelo app (relatório enviado, alterado, excluído ou restaurado; célula cadastrada, alterada, inativada, reativada, excluída ou restaurada; membro cadastrado, alterado, excluído ou restaurado), o Dashboard nunca mostra o número de antes como atual: a consulta seguinte já traz o número novo.<br>  - Com o Dashboard aberto, enquanto o número novo não chega, o de antes fica marcado como em atualização (P44).<br>  - Se a consulta depois da gravação falhar, a seção mostra a mensagem de erro com "Tentar de novo", e não o número de antes.<br>- Pelo atalho "Novo relatório", os cards da semana e o gráfico se atualizam ao enviar, sem recarregar a página (T9 do E2.02).<br>- A passagem do tempo com o Dashboard aberto (o prazo de uma célula, a virada da semana) aparece na consulta seguinte, ao voltar para a tela ou recarregar. Uma falha nessa consulta, sem gravação no meio, mantém os números que estavam na tela, como hoje.<br>- **Erro ao carregar:** cada seção mostra a sua mensagem, com "Tentar de novo", que refaz só o que falhou, sem recarregar a página. As seções que carregaram continuam. Nunca aparece mensagem técnica. | E2.06 (RN-08, P44); E2.02 (RN-22, T9); E2.09 (RN-09, P-SIT-08); E1.08 (erro por seção); definida pelo spec (P-DSH-12); falha depois de gravar e mensagens: definida pelo spec (P-DSH-20, P-DSH-21; PO-UX-7, PO-UX-8) |
| RN-18 | **Correções já entregues, que não podem voltar.**<br>- Células de qualquer dia da semana, de domingo a sábado, entram no card de pendentes. Hoje pelo PR 3 do E1.08; depois deste passo, pela situação do E2.09.<br>- No ranking, cada célula conta uma vez: a soma das linhas é o número de células ativas sob os G12 visíveis. | E2.14 em Progresso; E1.08 (RN-08 a e b; mci-connect#15); mci-connect#13; 5.6 (soma do ranking) |
| RN-19 | **Carga e reconciliação.**<br>- Nenhum número do Dashboard é migrado: todos são calculados a partir dos dados carregados.<br>- Na comparação lado a lado de uma semana de referência (5.6), por perfil, cada card só pode diferir do legado pelos motivos abaixo, e o script lista cada diferença com o motivo:<br>  - **Células com relatório pendente:** o prazo exato e as semanas que contam (RN-10 do E2.09);<br>  - **Sem vínculo celular:** a definição do E2.07 (Impactos de lá, E5.04);<br>  - **Sem liderança:** só os ativos, e quem vê só o ministério não vê quem está sem liderança (RN-06 do E2.02);<br>  - **Membros ativos:** o card do legado mostra a conta feita pela tela dele (`UI/pages/Home/index.js:126`: o total de ativos que o servidor devolve menos o de inativos). O novo mostra o número de membros ativos. A diferença esperada é o número de inativos visíveis;<br>  - **Células por tipo:** só as ativas, e o card "Macrocélulas" a mais. Como todas as células migram ativas (E2.08), na semana do cutover os números batem;<br>  - **Visitantes em células:** os relatórios de "Não houve célula" com visitantes não somam (RN-05);<br>  - **Novos membros e Novas células:** a "data não registrada" nunca conta. | 5.6 do `docs/migracao.md`; E2.05 (RN-10 d); E2.07 (Impactos, E5.04); E2.08 (RN-13: todas migram ativas); E2.09 (RN-10); legado (`App/Services/DashboardService.cs:53-60` e `UI/pages/Home/index.js:126`); definida pelo spec (P-DSH-13) |

#### Resumo dos números
| Número | Seção | O que conta | Definido em | Com zero |
|---|---|---|---|---|
| Relatórios enviados | Esta semana | relatórios da semana, os dois tipos | RN-03 | à vista |
| Células com relatório pendente | Esta semana | células "Pendente" | RN-08 do E2.09 (RN-04) | à vista |
| Visitantes em células | Esta semana | visitantes dos relatórios de célula realizada da semana | RN-05 | à vista |
| Células não realizadas | Esta semana | relatórios "Não houve célula" da semana | RN-06 | escondido |
| Novos membros | Esta semana | membros com cadastro na semana | RN-07 | escondido |
| Novas células | Esta semana | células com cadastro na semana | RN-08 | escondido |
| Gráfico "Relatórios de células" | Esta semana | Célula realizada · Não houve célula · Pendente | RN-12 | some com as três partes em zero |
| Total de membros, Membros ativos | Geral | membros | E1.08 e E2.07 (RN-09) | à vista |
| Membros inativos, Batizados, Não batizados | Geral | membros | E1.08 e E2.07 (RN-09) | escondido |
| Sem liderança, Sem vínculo celular | Geral | membros ativos | E2.02, E2.04 e E2.07 (RN-09) | escondido |
| Células evangelísticas, Células de discipulado, Macrocélulas | Geral | células ativas por tipo | RN-10 | escondido |
| Células por G12 | Células por G12 | células ativas por casal G12 | E2.06 (RN-11) | some sem nenhum G12 visível |

#### Links de cada número
As datas são o domingo e o sábado da semana que a seção mostra (no exemplo, 22/11/2026 e 28/11/2026). Os parâmetros são os que os specs de cada lista definiram; quem gera o link é o mesmo módulo que lê os filtros da lista (`memberListHref`, `cellListHref` e o módulo de filtros de Relatórios do E2.12).

| Número | Lista | Filtros | Exemplo | Igualdade |
|---|---|---|---|---|
| Relatórios enviados | Relatórios | Período: a semana ("Esta semana" marcado) | `/cell-reports?from=2026-11-22&to=2026-11-28` | total = card (RN-18 do E2.12) |
| Visitantes em células | Relatórios | Período: a semana | o mesmo | soma dos visitantes das linhas = card (RN-18 do E2.12) |
| Células não realizadas | Relatórios | Período: a semana + Reunião: Não houve célula | `…&held=no` | total = card (RN-18 do E2.12) |
| Células com relatório pendente | Células | Situação do relatório: Pendente | `/cells?report_status=pending` | total = card (RN-21 do E2.10) |
| Novas células | Células | Cadastrada a partir de / até: a semana | `/cells?from=2026-11-22&to=2026-11-28` | total = card (RN-21 do E2.10) |
| Novos membros | Membros | Cadastrado a partir de / até: a semana | `/members?from=2026-11-22&to=2026-11-28` | total = card (RN-17 do E2.07) |
| Total de membros | Membros | nenhum | `/members` | total = card (RN-17 do E2.07) |
| Membros ativos | Membros | Situação: Ativo | `/members?status=active` | idem |
| Membros inativos | Membros | Situação: Inativo | `/members?status=inactive` | idem |
| Batizados | Membros | Batizado: Sim | `/members?baptized=yes` | idem |
| Não batizados | Membros | Batizado: Não | `/members?baptized=no` | idem |
| Sem liderança | Membros | Situação: Ativo + Situação de liderança: Sem liderança | `/members?status=active&leadership=no_leadership` | idem |
| Sem vínculo celular | Membros | Situação: Ativo + Vínculo celular: Sem vínculo | `/members?status=active&cell_link=none` | idem |
| Células evangelísticas, Células de discipulado, Macrocélulas | Células | Tipo + Situação: Ativa | `/cells?type=evangelistic&status=active` (e `discipleship`, `macrocell`) | total = card (RN-21 do E2.10, com "Situação: Ativa") |
| Gráfico: Célula realizada | Relatórios | Período: a semana + Reunião: Célula realizada | `/cell-reports?from=2026-11-22&to=2026-11-28&held=yes` | total = parte (RN-18 do E2.12) |
| Gráfico: Não houve célula | Relatórios | Período: a semana + Reunião: Não houve célula | `…&held=no` | total = parte (RN-18 do E2.12) |
| Gráfico: Pendente | Células | Situação do relatório: Pendente | `/cells?report_status=pending` | total = parte (RN-21 do E2.10) |
| Ranking: um casal | Células | G12: os integrantes do casal que contam no ranking + Situação: Ativa | `/cells?g12=<id>,<id>&status=active` | total = coluna Total (RN-21 do E2.10) |

### Critérios de aceite
Convenções:
- "Hoje" é terça-feira, 24/11/2026, às 21:00 de Brasília, salvo quando o critério diz outra data. A semana atual vai de domingo, 22/11, a sábado, 28/11.
- Os horários são de Brasília (UTC−3). Quando importa, o horário em UTC vem entre parênteses.
- "Pela API" é qualquer leitura feita fora da tela, com a sessão da persona citada.
- "Escondido" é o card que não aparece (RN-14).
- Cada critério parte da massa original.
- **Consolidado:** ainda não existe; ver Impactos.

#### Massa de exemplo
A árvore, as funções, as células e os relatórios são os da [massa do E2.12](e2-12-listagem-relatorios.md#massa-de-exemplo), que parte das do E2.07 e do E2.10, com o que está abaixo.

- **Membros a mais** (ativos):
  - **Bruno,** discípulo de Caio, cadastrado no domingo, 22/11/2026, às 00:10;
  - **Ana,** discípula de Diego, cadastrada no sábado, 21/11/2026, às 23:30.
- Os demais membros foram cadastrados antes de 01/11/2026. Fábio é o único inativo, e Sara está excluída.
- **Células** (ver o E2.10): C1 (André, quarta, 20:00, Evangelística), C2 (Diego, quinta, 20:00, Evangelística, cadastrada no domingo, 22/11, às 00:10), C3 (Débora, terça, 19:30, Discipulado, "data não registrada"), C4 (Gabriel, Evangelística, **inativa**), C5 (Jonas, Evangelística, **excluída**), C6 (Paula, segunda, 20:00, Discipulado, cadastrada no sábado, 21/11, às 23:30), C7 (Samuel, domingo, 18:00, Macrocélula) e C8 (Ester, sábado, 16:00, Evangelística).
- **Relatórios desta semana:** R9 (C6, segunda, 23/11, célula realizada, 3 visitantes) e R10 (C7, domingo, 22/11, célula realizada, 5 visitantes). R6 (C5, sexta, 20/11) é da semana passada. R3 está excluído.
- **Situação do relatório hoje** (tabela do E2.10): C3 "Pendente"; C1, C2 e C8 "Ainda não ocorreu"; C6 e C7 "Enviado · Célula realizada"; C4 sem situação.
- **O que cada um vê:**
  - membros: Rita, todos os 22 (Sara está excluída); Samuel, os mesmos menos Ester, Lúcia e Lia (19); Pedro e Caio, Pedro, Paula, André, Caio, Fábio, Gabriel, Jonas, Carla e Bruno (9); Diego, Diego, Tiago, Tânia, Hugo, Beatriz, Débora, Rita e Ana (8); Ester, Ester, Lúcia e Lia (3);
  - células e relatórios: as tabelas do E2.10 e do E2.12.
- **Variação "Painel"** (só quando o critério diz): Carla com a função "Painel", que tem só "Visualizar Dashboard" e "Enviar Relatório das Próprias Células". Ela vê só o próprio cadastro, as células C1 (anfitriã) e C6 (timóteo) e os relatórios delas (RN-02 d do E2.02).

**Números de hoje, às 21:00** (o "—" é card escondido):

| Número | Rita | Samuel | Pedro e Caio | Diego | Ester |
|---|---|---|---|---|---|
| Relatórios enviados | 2 (R9, R10) | 2 | 1 (R9) | 1 (R10) | 0 |
| Células com relatório pendente | 1 (C3) | 1 (C3) | 0 | 1 (C3) | 0 |
| Visitantes em células | 8 | 8 | 3 | 5 | 0 |
| Células não realizadas | — | — | — | — | — |
| Novos membros | 1 (Bruno) | 1 | 1 | — | — |
| Novas células | 1 (C2) | 1 | 1 | 1 | — |
| Gráfico (Célula realizada · Não houve célula · Pendente) | 2 · 0 · 1 | 2 · 0 · 1 | 1 · 0 · 0 | 1 · 0 · 1 | oculto |
| Total de membros | 22 | 19 | 9 | 8 | 3 |
| Membros ativos | 21 | 18 | 8 | 8 | 3 |
| Membros inativos | 1 (Fábio) | 1 | 1 | — | — |
| Sem liderança | 1 (Ester) | — | — | — | 1 (Ester) |
| Células evangelísticas | 3 (C1, C2, C8) | 2 (C1, C2) | 2 (C1, C2) | 1 (C2) | 1 (C8) |
| Células de discipulado | 2 (C3, C6) | 2 (C3, C6) | 1 (C6) | 1 (C3) | — |
| Macrocélulas | 1 (C7) | 1 (C7) | — | 1 (C7) | — |

"Batizados", "Não batizados" e "Sem vínculo celular" não são numerados aqui: valem as igualdades da RN-13 e os critérios do E2.07.

#### Critérios por regra
- **RN-01**
  - Dados Hugo (sem função) e uma conta sem cadastro de membro
  - Quando cada um abre o Dashboard
  - Então vê "Você não tem acesso ao dashboard." com a orientação do E2.02, sem nenhum card, gráfico ou ranking. Pela API, os dois recebem o erro 42501.
  - Dada Lia (Secretaria, só "Visualizar Relatórios de Toda a Igreja")
  - Então ela vê só "Você não tem acesso ao dashboard.", e não tem o Dashboard no menu.
  - Dado Pedro, pela API
  - Quando ele lê os números do Dashboard
  - Então recebe exatamente os números da tabela, os mesmos da tela.
  - Dados Pedro e Diego, de ministérios diferentes
  - Então os números de cada um são os da tabela: Pedro não conta R10, C3, C7 nem Ana; Diego não conta R9, C1, C6 nem Bruno.
  - Dados R3 (relatório excluído), Sara (membro excluído) e C5 (célula excluída)
  - Então nenhum deles conta em nenhum card, gráfico ou ranking de ninguém.
  - Dado Fábio, inativo, com a função Membro
  - Quando ele abre o Dashboard
  - Então vê os números do escopo dele, como Caio, com o subtítulo "Visão do seu ministério" e o selo "Meu Ministério".
  - Dada Rita
  - Então o subtítulo é "Visão geral da igreja", sem o selo, como no E2.02.
- **RN-02**
  - Quando Rita abre o Dashboard hoje
  - Então a seção se chama "Esta semana (22/11 - 28/11)".
  - Dado o sábado, 28/11, às 23:59:59 (02:59:59 UTC de domingo), sem nenhum relatório novo
  - Então Rita vê "Relatórios enviados" 2, "Visitantes em células" 8, "Novos membros" 1 e "Novas células" 1.
  - Quando é domingo, 29/11, às 00:00:00 (03:00:00 UTC)
  - Então ela vê "Esta semana (29/11 - 05/12)", "Relatórios enviados" 0, "Células com relatório pendente" 0, "Visitantes em células" 0, sem "Novos membros", sem "Novas células" e sem o gráfico.
  - Dado Pedro com o celular no horário de Lisboa (UTC+0)
  - Quando são 01:00 de domingo, 29/11, em Lisboa (22:00 de sábado, 28/11, em Brasília)
  - Então o Dashboard dele ainda mostra "Esta semana (22/11 - 28/11)" e os números dessa semana.
  - Quando Rita procura outra semana no Dashboard
  - Então não há como escolher: a tela mostra só a semana atual (P-DSH-01).
- **RN-03**
  - Quando Rita abre o Dashboard hoje
  - Então "Relatórios enviados" mostra 2 (R9 e R10). R6, de sexta, 20/11, conta só na semana passada, e R3 não conta.
  - Quando Caio envia, na quarta, 25/11, às 21:30, "Não houve célula" para C1
  - Então "Relatórios enviados" passa a 3 para Rita e a 2 para Pedro.
  - Quando Rita exclui C6, depois de R9 enviado
  - Então "Relatórios enviados" continua 2 para Rita e 1 para Pedro, porque R9 continua contando (RN-11 do E2.01).
  - Quando Rita exclui R9
  - Então "Relatórios enviados" passa a 1 para ela e a 0 para Pedro. Ao restaurar R9, volta a 2 e a 1.
- **RN-04**
  - Quando Rita, Pedro e Diego abrem o Dashboard hoje
  - Então "Células com relatório pendente" mostra 1 (C3), 0 e 1 (C3), igual à lista de Células com "Situação do relatório: Pendente" de cada um.
  - Quando é quinta, 26/11, às 21:00, sem relatório novo
  - Então o card mostra 3 para Rita (C3, C1 e C2), 2 para Pedro (C1 e C2) e 2 para Diego (C3 e C2).
  - Quando Pedro cadastra C10 na quinta, 26/11, às 10:00 (quarta, 20:00)
  - Então C10 não entra no card nesta semana ("Conta a partir da próxima semana", RN-06 do E2.09).
- **RN-05**
  - Quando Rita, Pedro e Diego abrem o Dashboard hoje
  - Então "Visitantes em células" mostra 8 (3 de R9 e 5 de R10), 3 e 5.
  - Dado um relatório do legado de "Não houve célula" de C8, com data desta semana e 4 visitantes gravados
  - Então "Visitantes em células" de Rita continua 8, e a lista de Relatórios com "Esta semana" mostra os 8 nas linhas de R9 e R10, e nenhum na linha de "Não houve célula".
  - Quando Rita exclui C7, depois de R10 enviado
  - Então o card de Rita continua 8.
- **RN-06**
  - Quando Rita abre o Dashboard hoje
  - Então não vê "Células não realizadas" (zero, escondido).
  - Quando Caio envia, na quarta, 25/11, às 21:30, "Não houve célula" para C1
  - Então "Células não realizadas" aparece com 1 para Rita, Samuel, Pedro e Caio, e não aparece para Diego.
- **RN-07**
  - Quando Rita abre o Dashboard hoje
  - Então "Novos membros" mostra 1: Bruno, cadastrado no domingo, 22/11, às 00:10. Ana, cadastrada no sábado, 21/11, às 23:30, conta só na semana passada.
  - Quando Pedro e Caio abrem o Dashboard
  - Então veem "Novos membros" 1 (Bruno). Diego não vê o card (zero: Ana é da semana passada, e Bruno não é visível para ele).
  - Dado que Pedro cadastra Íris, discípula de Caio, na segunda, 23/11, às 10:00, e a marca como inativa no mesmo dia
  - Então "Novos membros" mostra 2 para Rita e para Pedro, e "Membros inativos" passa a 2.
  - Dado que Paula cadastra Vera, discípula de Carla, na segunda, 23/11, e Rita a exclui na terça, 24/11, às 10:00
  - Então "Novos membros" continua 1.
  - Dado um membro do legado com "data não registrada"
  - Então ele nunca conta em "Novos membros", em nenhuma semana.
  - Quando Rita restaura Sara, cadastrada antes de 01/11/2026
  - Então "Novos membros" continua 1.
- **RN-08**
  - Quando Rita, Samuel, Pedro e Diego abrem o Dashboard hoje
  - Então "Novas células" mostra 1 (C2) para cada um. C6, cadastrada no sábado, 21/11, às 23:30, é da semana passada, e C3 ("data não registrada") nunca conta. Ester não vê o card.
  - Quando Pedro cadastra C10 na quinta, 26/11, às 10:00
  - Então "Novas células" passa a 2 para Rita e para Pedro.
  - Quando Rita inativa C2 na quarta, 25/11
  - Então "Novas células" continua 1, e "Células evangelísticas" de Rita passa de 3 a 2.
  - Quando Rita exclui C2
  - Então "Novas células" desaparece (zero) para todos.
- **RN-09**
  - Quando Rita abre o Dashboard hoje
  - Então vê "Total de membros" 22, "Membros ativos" 21, "Membros inativos" 1 (Fábio) e "Sem liderança" 1 (Ester).
  - Dados Pedro e Paula, casados
  - Então contam como dois em "Total de membros" e "Membros ativos", e como uma linha só no ranking (RN-11).
  - Dado Samuel, pastor
  - Então ele não conta em "Sem liderança" nem em "Sem vínculo celular" de ninguém, e o Dashboard dele não mostra "Sem liderança" (Ester não é visível para ele).
  - Quando Ester abre o Dashboard
  - Então vê "Sem liderança" 1 (ela mesma).
  - Dados Rita, Pedro, Diego e Ester
  - Então cada card de membros é igual ao total da lista de Membros com o equivalente da RN-17 do E2.07.
- **RN-10**
  - Quando Rita abre o Dashboard hoje
  - Então vê "Células evangelísticas" 3 (C1, C2 e C8), "Células de discipulado" 2 (C3 e C6) e "Macrocélulas" 1 (C7). C4 (inativa) e C5 (excluída) não contam.
  - Quando Rita reativa C4
  - Então "Células evangelísticas" passa a 4 para ela e a 3 para Pedro.
  - Quando Pedro abre o Dashboard
  - Então vê "Células evangelísticas" 2 e "Células de discipulado" 1, e não vê "Macrocélulas".
  - Dado C7, de Samuel (pastor)
  - Então ela conta em "Macrocélulas" para quem a vê (Rita, Samuel, Magda e Diego).
- **RN-11**
  - Quando Samuel abre o Dashboard hoje
  - Então "Células por G12" mostra "Pedro & Paula" com 1 célula de homem (C1), 1 de mulher (C6) e total 2, e "Tiago & Tânia" com 1 (C2), 1 (C3) e 2.
  - Quando Pedro abre o Dashboard
  - Então o ranking dele mostra só "Pedro & Paula", com total 2.
  - Quando Rita inativa C1
  - Então "Pedro & Paula" passa a total 1, na consulta seguinte.
  - Quando Samuel toca no número de "Mulheres" (1) da linha "Pedro & Paula"
  - Então abre a mesma lista do casal, com C1 e C6 e o total 2, igual ao "Total" da linha.
  - Dado o ranking de Samuel
  - Então os números não têm as pílulas azul e rosa de hoje.
  - Quando a variação "Painel" de Carla abre o Dashboard
  - Então ela não vê a seção "Células por G12", porque não vê nenhum G12.
- **RN-12**
  - Quando Rita abre o Dashboard hoje
  - Então vê o gráfico "Relatórios de células", com a legenda "Células que ainda não precisam enviar o relatório desta semana não entram." e três linhas, nesta ordem:
    - "Célula realizada", 2, com a barra do maior número;
    - "Não houve célula", 0, sem barra;
    - "Pendente", 1, com a barra na metade.
  - E C1, C2 e C8 ("Ainda não ocorreu") não aparecem no gráfico.
  - Dado o gráfico de Rita
  - Então não há aba "Tabela" nem outra forma dos mesmos números: cada número está em texto na linha. As linhas "Célula realizada" e "Pendente" recebem foco pelo teclado e são lidas pelo leitor de tela com o nome, o número e o destino.
  - Quando Caio envia, na quarta, 25/11, às 21:30, "Não houve célula" para C1
  - Então o gráfico de Rita mostra 2, 1 e 1 (C3), e o de Pedro mostra 1, 1 e 0.
  - Quando é domingo, 29/11, às 00:00
  - Então ninguém vê o gráfico (as três partes são zero).
  - Dado o gráfico de Rita
  - Então "Pendente" tem o tom e o ícone do "Pendente" da lista de Células, "Célula realizada" tem o tom do "Enviado", e "Não houve célula" tem um tom neutro, diferente dos dois. Nenhuma parte é vermelha, e as três se distinguem também sem a cor.
  - Dada a parte "Pendente" do gráfico de Rita
  - Então ela é sempre igual ao card "Células com relatório pendente".
- **RN-13**
  - Dada Rita, hoje
  - Quando ela toca em cada número
  - Então:
    - "Relatórios enviados" (2) abre Relatórios com "Esta semana" marcado (22/11 a 28/11): R9 e R10, "2 relatórios";
    - "Visitantes em células" (8) abre a mesma lista, com 3 visitantes em R9 e 5 em R10;
    - "Células com relatório pendente" (1) abre Células com "Situação do relatório: Pendente": C3;
    - "Novas células" (1) abre Células com "Cadastrada a partir de 22/11/2026" e "Cadastrada até 28/11/2026": C2;
    - "Novos membros" (1) abre Membros com "Cadastrado a partir de 22/11/2026" e "Cadastrado até 28/11/2026": Bruno;
    - "Membros inativos" (1) abre Membros com "Situação: Inativo": Fábio;
    - "Sem liderança" (1) abre Membros com "Situação: Ativo" e "Situação de liderança: Sem liderança": Ester;
    - "Células evangelísticas" (3) abre Células com "Tipo: Evangelística" e "Situação: Ativa": C1, C2 e C8, sem C4;
    - a parte "Célula realizada" (2) abre Relatórios com "Esta semana" e "Reunião: Célula realizada": R9 e R10;
    - a parte "Pendente" (1) abre a mesma lista do card de pendentes;
    - a linha "Pedro & Paula" do ranking (2), pelo nome ou por qualquer número da linha, abre Células com "G12: Pedro, Paula" e "Situação: Ativa": C1 e C6.
  - E a parte "Não houve célula" (0) não abre nada.
  - Quando Pedro abre o Dashboard hoje
  - Então "Células com relatório pendente" (0) aparece sem link.
  - Dada a variação "Painel" de Carla
  - Quando ela abre o Dashboard
  - Então vê "Relatórios enviados" 1 (R9), "Visitantes em células" 3, "Total de membros" 1 e "Membros ativos" 1, sem subtítulo nem selo. "Relatórios enviados", "Visitantes em células" e a parte "Célula realizada" abrem Relatórios; os cards de membros e de células aparecem sem link, porque ela não tem Membros nem Células no menu.
  - Dado o Dashboard de Rita aberto no sábado, 28/11, às 23:59
  - Quando ela toca em "Relatórios enviados" no domingo, 29/11, às 00:01
  - Então a lista abre com o período de 22/11 a 28/11 (a semana que o card mostrava), com "Semana passada" marcado (RN-10 do E2.12), e o total é o do card.
  - Dados Rita, Samuel, Pedro, Diego e Ester, no mesmo momento
  - Então cada número é igual ao total (ou à soma dos visitantes) da lista que ele abre.
  - Dada Rita, que rolou até "Geral" e tocou em "Membros inativos"
  - Quando ela volta da lista pelo navegador ou pelo aparelho, sem ter gravado nada
  - Então o Dashboard aparece na mesma posição, com o foco em "Membros inativos", sem recarregar os números do zero.
  - Quando ela reativa Fábio na lista antes de voltar
  - Então o Dashboard carrega do zero, a partir do topo, sem "Membros inativos" (zero) e com "Membros ativos" 22 (RN-17).
- **RN-14**
  - Quando Pedro abre o Dashboard hoje
  - Então "Esta semana" mostra "Relatórios enviados" 1, "Células com relatório pendente" 0, "Visitantes em células" 3, "Novos membros" 1 e "Novas células" 1, sem "Células não realizadas"; e "Geral" não mostra "Sem liderança" nem "Macrocélulas".
  - Quando é domingo, 29/11, às 00:00
  - Então "Esta semana" de Pedro mostra só "Relatórios enviados" 0, "Células com relatório pendente" 0 e "Visitantes em células" 0, sem o gráfico.
  - Quando Ester abre o Dashboard hoje
  - Então "Geral" mostra "Total de membros" 3, "Membros ativos" 3, "Sem liderança" 1 e "Células evangelísticas" 1, além dos cards de batismo e de vínculo que forem maiores que zero.
- **RN-15**
  - Quando Pedro abre o Dashboard hoje
  - Então "Células com relatório pendente" (0) tem o tom de sucesso, e a tela mostra que não há pendência também sem a cor.
  - Quando é quarta, 25/11, às 21:00
  - Então o card de Pedro mostra 1 (C1), com o tom de aviso e o ícone do "Pendente" da lista. Nunca fica vermelho.
  - Quando é domingo, 29/11, às 10:00
  - Então "Visitantes em células" (0) não tem tom de aviso.
  - Quando Rita abre o Dashboard hoje
  - Então "Sem liderança" (1) tem o tom de aviso, também sem depender da cor. "Membros inativos", "Novos membros" e os demais cards são neutros, sem cor no ícone.
  - Quando Caio envia, na quarta, 25/11, às 21:30, "Não houve célula" para C1
  - Então o card "Células não realizadas" aparece neutro, com o ícone do badge "Não houve célula". Nenhum card do Dashboard fica vermelho.
- **RN-16**
  - Quando Rita abre o Dashboard hoje
  - Então os títulos são exatamente os de Textos de tela, com só a primeira letra maiúscula, na ordem da RN-16. A tela não mostra "Células sem Relatório", "Células Discipulado", "Células Macrocélula" nem "Esta Semana".
- **RN-17**
  - Quando Carla envia, pelo atalho "Novo relatório", o relatório de C1 na quarta, 25/11, às 21:30, com 2 visitantes
  - Então, sem recarregar a página, o Dashboard dela mostra "Relatórios enviados" e "Visitantes em células" com o relatório novo, e o gráfico com uma "Célula realizada" a mais e um "Pendente" a menos.
  - Quando Rita exclui R9 na lista de Relatórios e abre o Dashboard
  - Então o Dashboard mostra "Relatórios enviados" 1 desde a primeira exibição, nunca 2.
  - Dado o Dashboard de Pedro aberto na quarta, 25/11, às 20:50
  - Quando são 21:05 e ele não consultou de novo
  - Então o card de pendentes continua 0. Ao voltar para a tela ou recarregar, mostra 1 (C1).
  - Dado o Dashboard de Carla aberto, enquanto os números recarregam depois do envio pelo atalho
  - Então os números de antes ficam à vista, marcados como em atualização, até chegarem os novos.
  - Dado que a consulta depois desse envio falha
  - Então "Esta semana" e "Geral" mostram as mensagens de erro de cada seção, com "Tentar de novo", e não os números de antes. O toque em "Tentar de novo" refaz a consulta sem recarregar a página.
  - Dado que a consulta falha ao Pedro voltar para a aba, sem ter gravado nada
  - Então os números que estavam na tela continuam, sem mensagem.
  - Dado que só o ranking falha ao carregar
  - Então os cards da semana e de "Geral" aparecem, e a seção "Células por G12" mostra "Não foi possível carregar as células por G12. Verifique a conexão e tente de novo." com "Tentar de novo". Nenhuma mensagem técnica aparece.
- **RN-18**
  - Quando Rita exclui R9 hoje
  - Então C6 (segunda, 20:00, prazo vencido) entra no card de pendentes de Rita, que passa a 2 (C3 e C6), e no de Pedro, que passa a 1.
  - Dadas células com dia em cada um dos sete dias, sem relatório e com o prazo vencido na semana
  - Então todas entram no card de pendentes, de domingo a sábado.
  - Quando Samuel abre o ranking
  - Então a soma das linhas é 4, o número de células ativas sob os G12 que ele vê (C1, C2, C3 e C6), e nenhuma célula conta duas vezes.
- **RN-19**
  - Dada a reconciliação de uma semana de referência, com um usuário de cada perfil
  - Então o script compara cada card do novo com o do legado e lista cada diferença com um motivo da RN-19. Nenhuma diferença fica sem motivo.
  - Dado o card "Membros ativos" de um administrador no legado, com 1.000 ativos e 50 inativos visíveis
  - Então o legado mostra 950, o novo mostra 1.000, e o script registra a diferença de 50 com o motivo.
  - Dada uma célula do legado com "data não registrada"
  - Então ela não conta em "Novas células" do novo, em nenhuma semana.

### Textos de tela
Vocabulário de referência. O `ux-designer` pode ajustar o tom, mas não o sentido nem os termos.
- **Termos:** Esta semana, Geral, Relatórios enviados, Células com relatório pendente, Visitantes em células, Células não realizadas, Novos membros, Novas células, Célula realizada, Não houve célula, Pendente.
- **Evitar:**
  - títulos com todas as palavras em maiúscula ("Relatórios Enviados", "Esta Semana");
  - "Células sem relatório" como nome do card de pendentes (E2.09);
  - "Células canceladas", "Cancelada" e "Atrasado";
  - "Status";
  - "Células Discipulado", "Células Macrocélula", "Discipuladoras" e "Celulas" sem acento;
  - "Novos membros cadastrados" e "Novas células cadastradas" (a seção já diz o período);
  - "Erro ao carregar o dashboard.", que sai (P-DSH-21), e qualquer texto técnico (código de erro, nome de função).

Os textos vindos do desenho de UX e aprovados pelo PO em 2026-11-24 (PO-UX-2 e PO-UX-8) já estão na tabela. Os do leitor de tela e os das respostas possíveis da T9 (Q-1 a Q-6) estão em "Textos", na seção Experiência (UX).

| Onde | Texto |
|---|---|
| seção da semana | Esta semana ({dd/mm do domingo} - {dd/mm do sábado}) |
| seção geral | Geral |
| cards da semana | Relatórios enviados · Células com relatório pendente · Visitantes em células · Células não realizadas · Novos membros · Novas células |
| gráfico | Título: Relatórios de células · Partes: Célula realizada · Não houve célula · Pendente |
| legenda do gráfico (RN-12, P-DSH-15) | Células que ainda não precisam enviar o relatório desta semana não entram. |
| cards gerais | Total de membros · Membros ativos · Membros inativos · Batizados · Não batizados · Sem liderança · Sem vínculo celular · Células evangelísticas · Células de discipulado · Macrocélulas |
| ranking | Células por G12 (sem mudança: "G12 (Casal)", "Homens", "Mulheres" e "Total") |
| erro ao carregar, por seção (RN-17, P-DSH-21) | Não foi possível carregar os números desta semana. Verifique a conexão e tente de novo. · Não foi possível carregar os números gerais. Verifique a conexão e tente de novo. · Não foi possível carregar as células por tipo. Verifique a conexão e tente de novo. · Não foi possível carregar as células por G12. Verifique a conexão e tente de novo. · Tentar de novo |
| sem acesso, subtítulo, selo e atalho | os do E2.02 (Textos de tela de lá), sem mudança |

### Telas que mudam
- **Dashboard:**
  - os títulos da RN-16, com só a primeira letra maiúscula, e "Esta semana";
  - os cards novos "Novos membros" e "Novas células" (RN-07, RN-08);
  - "Células por tipo" passa a três cards, só com as células ativas, com os títulos novos (RN-10);
  - o gráfico "Relatórios de células", depois dos cards da semana, com a legenda: uma linha por parte, com o nome, o número e uma barra, sem a aba "Tabela" e sem biblioteca de gráfico (RN-12; P113 da UX, P-DSH-14);
  - cada número com link para a lista, quando a pessoa tem acesso a ela e o número é maior que zero (RN-13), inclusive as linhas do gráfico e as do ranking. Na volta da lista, o Dashboard fica na mesma posição, com o foco no número aberto (P-DSH-20);
  - os cards com zero escondidos, menos os cinco sempre à vista (RN-14);
  - o card de pendentes em amarelo de aviso, ou verde com zero, e "Sem liderança" e "Sem vínculo celular" com o tom de aviso. Os demais cards ficam neutros e perdem as cores de ícone de hoje (RN-15, P-DSH-16);
  - os ícones de "Novos membros", "Visitantes em células", "Células não realizadas" e dos tipos mudam (P-DSH-17);
  - duas colunas de cards no celular (P-DSH-18);
  - no ranking, a linha inteira abre a lista, e os números perdem as pílulas azul e rosa (P-DSH-19);
  - o erro aparece por seção, com "Tentar de novo" (RN-17, P-DSH-21);
  - o nome, o ícone e a regra do card de pendentes continuam os do E2.09 (RN-04).
- **Membros, Células e Relatórios:** sem mudança visual. Recebem os links pelo endereço da página, com os filtros que os specs deles já definem.
- Nenhuma tela nova e nenhuma rota nova.

### Fora de escopo
Cada item indica o passo que cuida dele, quando há um.
- **Navegar entre semanas no Dashboard:** não será feito (P-DSH-01; ver Q-1). As semanas anteriores ficam nos atalhos de Relatórios (E2.12) e no filtro de Células (E2.10).
- **Regras dos números que outros specs já fecharam:** o pendente (E2.09), o vínculo celular (E2.07), a situação de liderança (E2.04), o ranking (E2.06), o escopo (E2.02) e a exclusão (E2.01). Este passo só os usa.
- **Filtros das listas:** E2.07 (Membros), E2.10 (Células) e E2.12 (Relatórios). Este passo só usa os links que eles já preparam.
- **Atalho "Novo relatório" e o formulário de relatório:** E2.02 e E2.11.
- **Card das células sem relatório nas semanas anteriores:** Q-4 do E2.09, que continua em aberto lá.
- **Card de células inativas:** fora (ver Q-5).
- **Soma das ofertas e dos participantes da semana:** sem passo no plano. O legado não tinha.
- **Escolher um G12 e ver o Dashboard só do ministério dele:** sem passo no plano (ver Q-6). A lista de Células já filtra por G12 (E2.10).
- **Uma lista só com as células de homens ou só com as de mulheres, a partir do ranking:** fora. A lista de Células não filtra pelo sexo do líder, e o toque em "Homens" ou "Mulheres" abre a lista do casal inteiro (P-DSH-19).
- **Atualização automática enquanto o Dashboard fica aberto:** sem passo no plano (RN-17).
- **Exportação para Excel:** E2.13.
- **Raiz da árvore de Ministérios pelo escopo:** E2.15.
- **Indicadores por ministério** (por exemplo, percentual de relatórios enviados por G12): sem passo no plano.
- **Changelog e situações `Cancelled*`:** não serão replicados (3.9).
- **Consolidação:** feature futura, com spec próprio (ver Impactos).

### Impactos em outros passos
Pontos de negócio que outros passos precisam respeitar. O `architect` decide como.
- **E1.08:**
  - os cards novos (RN-07, RN-08) e a parte "Célula realizada" do gráfico (RN-12) entram nos números do Dashboard, como o ponto de extensão do E2.14 previa;
  - "Visitantes em células" passa a somar só os relatórios de célula realizada (RN-05);
  - "Células por tipo" passa a contar só as ativas, como o comentário da migration já previa ("o E2.14 decide se as inativas continuam entrando");
  - o texto do E1.08 fica como histórico.
- **E2.02:** nada muda. O subtítulo, o selo, o atalho e as mensagens sem acesso continuam os de lá. O critério de acesso das listas (RN-22) passa a decidir também se o número abre a lista (RN-13).
- **E2.07:** a RN-17 de lá continua valendo. Os nomes dos cards passam aos títulos da RN-16 ("Total de membros", "Membros ativos", "Sem liderança"…), sem mudar nenhuma definição. "Novos membros da semana" passa a existir com o título "Novos membros", e o link usa o `memberListHref`.
- **E2.08:** a recomendação de contar só as ativas em "células por tipo" foi adotada (RN-10). "Novas células da semana" conta também a célula inativada na mesma semana (RN-08, P-DSH-03).
- **E2.09:**
  - a RN-08 de lá não muda;
  - a cor do card ficou decidida: amarelo de aviso com pendente, verde sem (RN-15, P-DSH-09);
  - os outros três títulos da seção passam ao padrão do P-SIT-16 (RN-16);
  - o gráfico usa os tons do P70 (RN-12);
  - o Dashboard continua só com a semana atual, então a navegação por semana prevista na RN-02 de lá não é usada (P-DSH-01).
- **E2.10:**
  - a linha "Células por tipo" da RN-21 de lá ganha "Situação: Ativa", e o link, `&status=active` (RN-10);
  - "Novas células da semana" continua sem "Situação" (RN-08);
  - o ranking abre a lista (P-DSH-06, P-DSH-19), com o equivalente de lá;
  - o P83 de lá dizia que valia "para o gráfico da semana do Dashboard (E2.14)". Para gráficos de poucas partes, como este, vale o P113 deste spec, que o refina: as linhas em texto já são a tabela, e não há a aba "Tabela" (P-DSH-14). O P83 continua para gráficos com eixo de tempo ou com várias séries, como a evolução do detalhe da célula. Ajustar a nota do P83 no aceite.
- **E2.11:** o envio pelo atalho atualiza os cards da semana e o gráfico (RN-17). "Relatórios enviados" conta os de "Não houve célula" (RN-03), como os Impactos de lá pedem.
- **E2.12:**
  - a linha de visitantes da RN-18 de lá passa a dizer "a soma dos visitantes mostrados nas linhas", porque a linha de "Não houve célula" não mostra visitantes (P-LRE-34 de lá; RN-05 daqui);
  - "Células não realizadas" usa o mesmo equivalente da parte "Não houve célula" do gráfico;
  - os nomes dos cards e das partes, que o E2.12 deixou para cá, estão na RN-16 e na RN-12.
- **E4.09 e E5.04:** a reconciliação do Dashboard (5.6) lista cada diferença com o motivo da RN-19. A 5.6 ganha essa lista. A liderança é avisada, no E5.04, de que os números de "Membros ativos", "Sem liderança", "Sem vínculo celular", "Células por tipo" e "Células com relatório pendente" não batem com o legado pelos motivos da RN-19.
- **Consolidação:** quando existir, o consolidado não conta em nenhum card de membros, em "Novos membros", no vínculo celular nem no ranking, a não ser que o spec da Consolidação diga outra coisa. O spec da Consolidação decide se a conversão de consolidado em membro conta como "novo membro" na semana da conversão (a data de cadastro é preservada).
- **Aceite (PO):**
  - no `docs/migracao.md`: DSH-01 a DSH-06 em ✅, com "Onde impor" atualizado, e o E2.14 marcado na seção Progresso;
  - no `CLAUDE.md`: a linha "Dashboard semanal com cards clicáveis" da matriz de paridade em ✅. Na revisão final, o `architect` atualiza "Novo: estado atual > Front > Dashboard" e retira de "Problemas conhecidos" e das "Armadilhas" o mapa de dias do Dashboard e o corte de 1000 linhas no Dashboard, que o E1.08 já resolveu.

### Pontos para o `architect`
Não são dúvidas de negócio. São pontos em que a regra depende de uma escolha técnica.
1. **Uma fonte por número** (RN-13). Cada card usa as mesmas colunas e funções que o filtro da lista correspondente, para que card e lista nunca divirjam. Os testes de igualdade por persona do E2.07 (RN-17), do E2.10 (RN-21) e do E2.12 (RN-18) passam a valer para todos os números da tabela [Links de cada número](#links-de-cada-número), inclusive o gráfico e o ranking.
2. **Novos membros e novas células** (RN-07, RN-08). A data de cadastro de Brasília, com a mesma função das listas (`sp_day_start`, do E2.07 e do E2.10), e a "data não registrada" sempre fora. O E1.08 previu os cards novos no fim do `dashboard_summary`.
3. **Visitantes, gráfico e tipos** (RN-05, RN-10, RN-12). Visitantes só de célula realizada; o número de "Célula realizada" vem pronto do servidor, sem conta no front; os três tipos com só as ativas. O gráfico é feito em HTML, sem biblioteca de gráfico (P-DSH-14): o front só calcula a largura das barras a partir dos três números, o que é apresentação, e não contagem.
4. **Links** (RN-13).
   - As datas vêm da semana que o servidor devolve (`week_start` e `week_end`), nunca do relógio do aparelho.
   - Os links são gerados pelos módulos que leem os filtros de cada lista (`memberListHref`, `cellListHref` e o de Relatórios do E2.12).
   - O acesso a cada lista é o mesmo do menu (`my_access`, E2.02).
   - A linha do ranking precisa dos ids das pessoas do casal que contam no ranking (AQ-4 da UX).
5. **Atualização** (RN-17). A chave `["dashboard"]` já está nas funções de atualização do E2.06 ao E2.09 (`refreshAfterMemberWrite`, `refreshAfterCellWrite` e a de relatórios). Confirmar que a exclusão e a restauração (E2.01) e o envio pelo atalho também a usam. Com o Dashboard aberto, os números de antes ficam marcados como em atualização; se a consulta depois de uma gravação falhar, a seção mostra o erro, e não esses números (P-DSH-20; AQ-7 da UX). A volta de uma lista com a posição e o foco está na AQ-6 da UX.
6. **Cards escondidos e carregamento** (RN-14). Enquanto os números não chegam, não se sabe quais cards vão aparecer. A tela não pode piscar cards que somem; a forma é da UX.
7. **Desempenho.** O Dashboard continua dentro do tempo do E1.08 no volume de referência (20 mil membros, 1.500 células e 100 mil relatórios), com os dois números novos pelos índices de data de cadastro do E2.07 e do E2.10.
8. **Ordem dos passos.**
   - Os números, os títulos, a aparência e o gráfico dependem do E2.05 (data de cadastro), do E2.08 (célula ativa) e do E2.09 (pendente).
   - O clique de cada grupo depende do filtro da lista em produção: Membros (E2.07), Células (E2.10) e Relatórios (E2.12). Se uma lista atrasar, os números daquele grupo ficam sem link até lá, sem mudar as outras regras.

### Perguntas em aberto
Nenhuma bloqueante. Os pontos que as fontes não respondiam viraram padrões, listados em [Padrões definidos por este spec](#padrões-definidos-por-este-spec-revisar-no-pr), para o usuário revisar no PR. Os que mais mudam o resultado são:
- **P-DSH-04:** "Células por tipo" passa a contar só as células ativas. Hoje conta também as inativas.
- **P-DSH-08:** os cards com zero somem, como no legado. Hoje o novo mostra todos.
- **P-DSH-09:** o card de pendentes fica amarelo de aviso, como o badge "Pendente", e não vermelho, como no legado.
- **P-DSH-02:** "Visitantes em células" não soma os visitantes de "Não houve célula" (só afeta relatórios do legado).
- **P-DSH-05 a P-DSH-07:** o número com zero não abre lista; as partes do gráfico e as linhas do ranking abrem.
- **P-DSH-14:** o gráfico vira barras em HTML, uma linha por parte, sem a aba "Tabela" do P83. O legado tinha uma pizza.
- **P-DSH-19:** no ranking, o toque em "Homens" ou "Mulheres" abre a lista de todas as células ativas do casal, porque a lista não filtra pelo sexo do líder.

As pendências da UX (PO-UX-1 a PO-UX-8) foram resolvidas em 2026-11-24, todas com o padrão da UX, e viraram os padrões P-DSH-14 a P-DSH-21.

Sugestões que não entram, porque o legado não tem a regra. O usuário decide se viram regra nova:
- **Q-1. Navegar entre semanas.** Padrão: não, como no legado. Alternativa: "Semana anterior" e "Próxima semana" ao lado do título "Esta semana", com os números da semana escolhida pelas regras do E2.09 (RN-02 de lá). Os cards de "Geral" continuariam sendo os de hoje.
- **Q-2. Cards com zero.** Padrão: escondidos, como no legado (P-DSH-08). Alternativa: todos sempre à vista, como o novo faz hoje. Um zero também informa ("Sem liderança: 0").
- **Q-3. Cor do card de pendentes.** Padrão: amarelo de aviso, igual ao badge (P-DSH-09). Alternativa: vermelho, como no legado.
- **Q-4. "Ainda não ocorreu" no gráfico.** Padrão: três partes, como no legado. Alternativa: uma quarta parte com as células que ainda vão se reunir na semana, para o gráfico mostrar todas as células ativas.
- **Q-5. Card de células inativas.** Padrão: não existe. Com "Células por tipo" só com as ativas (P-DSH-04), as inativas só aparecem na lista de Células, com "Situação: Inativa". Alternativa: um card "Células inativas" em "Geral".
- **Q-6. Dashboard de um G12.** Quem vê a igreja toda escolheria um G12 e veria os números só do ministério dele. Padrão: não existe; a lista de Células já filtra por G12.

## Experiência (UX)
_Seção do `ux-designer`. Escrita em 2026-11-24 a partir destas fontes:_
- _a seção Negócio (RN-01 a RN-19, P-DSH-01 a P-DSH-13, a massa de exemplo, os Textos de tela, a tabela [Links de cada número](#links-de-cada-número), os Pontos para o `architect` e as perguntas Q-1 a Q-6);_
- _as telas da `origin/main` do `mci-connect` (`4595daa`): `Dashboard.tsx`, `use-dashboard.ts`, `lib/dashboard/week.ts`, `lib/format.ts`, `StatusBadge.tsx`, `AppLayout.tsx`, `App.tsx`, `ui/card.tsx`, `ui/alert.tsx`, `ui/tabs.tsx`, `index.css` e `tailwind.config.ts`;_
- _o que já foi desenhado para o Dashboard e para as telas que ele abre: o cabeçalho, o atalho e o sem acesso do [E2.02](e2-02-perfis-escopo.md) (T9, UXD-10, P10); o card de pendentes do [E2.09](e2-09-situacao-relatorio.md) (T4, UXD-9, P70); o P81, o P83 e os badges de relatório do [E2.10](e2-10-listagem-celulas.md) (T11, T12); o atalho de período marcado (P90) e os links prontos do [E2.12](e2-12-listagem-relatorios.md); o P44 e a AQ-6 do [E2.06](e2-06-hierarquia-totais.md); o diálogo de relatório do [E2.11](e2-11-lancamento-relatorio.md) (T11); os estados de carregamento e de erro do [E1.08](e1-08-paginacao-servidor.md), aprovados pela UX naquele passo;_
- _o legado, só para manter o que os usuários conhecem: o card inteiro abre a lista, o número grande junto do título, a ordem das seções e o gráfico com o número de cada parte escrito ao lado do nome (`UI/pages/Home/index.js:67-145`)._

_Usa os padrões P1 (diálogo do relatório), P6 (badges com contraste), P10 (subtítulo de alcance), P44 (o que salvar desatualiza), P70 (situação do relatório), P81 (linha de tabela que abre outra tela), P83 (gráfico com tabela, refinado aqui pelo P113) e P90 (atalho de período marcado). Os padrões novos começam em P110, para não colidir com os outros specs. Nenhuma regra de negócio foi criada aqui. Onde a tela precisou de algo que o spec não diz, a decisão é a mais conservadora, marcada como "definido pela UX" e listada em "Pendências para o PO". Os nomes são os da [massa de exemplo](#massa-de-exemplo); os sobrenomes não aparecem, e "…" marca o número que a massa não define._

### O que muda, tela a tela
Nenhuma tela nova e nenhuma rota nova. Só o Dashboard muda.

| Parte do Dashboard | O que muda | Para quem |
|---|---|---|
| Cabeçalho | Nada: título, selo, subtítulo e "Novo relatório" do E2.02 (T9). | quem tem "Visualizar Dashboard" |
| Esta semana (T1 a T3) | Títulos com só a primeira letra maiúscula; os cards "Novos membros" e "Novas células"; os cards com zero escondidos, menos três; o card inteiro abre a lista (P110); o card de pendentes em amarelo de aviso ou em verde (P111); duas colunas no celular (P114). | idem |
| Gráfico "Relatórios de células" (T4) | Novo, depois dos cards da semana: três linhas com o badge, o número e uma barra, cada uma abrindo a sua lista (P113). | idem |
| Geral (T1 a T3) | Títulos novos; três cards de tipo, só com as células ativas; os cards com zero escondidos, menos dois; os links; "Sem liderança" e "Sem vínculo celular" em amarelo de aviso; os ícones coloridos de hoje ficam neutros. | idem |
| Células por G12 (T5) | Cada linha abre as células ativas do casal, com a seta no Total; os números perdem as pílulas azul e rosa. | idem |
| Carregando, atualizando e erro (T7) | Só os cards sempre à vista têm `Skeleton`, e nada aparece para depois sumir (P112). O erro de cada seção ganha "Tentar de novo". | idem |
| Membros, Células e Relatórios (T8) | Sem mudança visual. Recebem os links. | — |

#### O que cabe em cada largura
A área útil vem do `AppLayout` (`p-4` no celular; `p-6` e o menu fixo de 256 px a partir de 768 px). Em nenhuma largura um número sai de vista ou a página rola na horizontal.

| Largura | Área útil | Cards por linha (P114) | Gráfico (P113) | Ranking |
|---|---|---|---|---|
| 320 a 359 px | 288 a 327 px | 1 | o badge e o número numa linha, a barra embaixo | tabela; os nomes quebram linha |
| 360 a 767 px (referência: 360) | 328 a 735 px | 2 em 360 px; 3 a partir de cerca de 490 px; 4 a partir de cerca de 645 px | idem | idem |
| 768 a 1023 px | 464 a 719 px | 3 ou 4 | o badge, a barra e o número numa linha só | idem |
| 1024 a 1279 px | 720 a 975 px | 4; 5 a partir de cerca de 1090 px; 6 a partir de cerca de 1250 px | idem, com o card até `max-w-3xl` | tabela, até `max-w-3xl` |
| 1280 px ou mais | 976 px ou mais | 6 em 1280 px (a semana inteira numa linha), 7 em 1440 px | idem | idem |

### Coerência com os outros specs
- **E2.02 (T9, UXD-10, P10):** o cabeçalho, o selo, o subtítulo, o atalho "Novo relatório" (`w-full h-11` no celular, à direita do título a partir de `sm`) e as mensagens sem acesso não mudam. As UX-12 a UX-14 de lá continuam valendo.
- **E2.09 (T4, UXD-9, P70):** o card de pendentes mantém o nome, o `TriangleAlert` e o título que quebra linha com `leading-snug`, com o ícone no alto (`items-start`). Aqui ele ganha o tom do card (P111), o link e, com zero, o `CheckCircle2`. A parte "Pendente" do gráfico usa o badge "Pendente" do P70.
- **E2.10 (P81, P83, T11) e E2.12:**
  - a linha do ranking segue o P81;
  - o gráfico segue o P83 no que ele pede (o número em texto, as partes distintas sem a cor, sem animação e com a altura reservada). Como tem poucas partes e cada uma abre uma lista, ele é desenhado em HTML e não tem a aba "Tabela" (P113, UXD-5). Por isso o `React.lazy` do P83 não se aplica: o Dashboard não carrega biblioteca de gráfico;
  - os badges "Célula realizada" (`success`, `CheckCircle2`) e "Não houve célula" (`muted`, `CalendarX`) são os mesmos de Relatórios e do detalhe da célula.
- **E2.07, E2.10 e E2.12 (Navegação e rotas):** os links usam os endereços prontos de cada lista. A lista de Relatórios aberta por um card mostra o atalho "Esta semana" marcado (P90), ou "Semana passada", se a semana virou com o Dashboard aberto (critério da RN-13).
- **E2.06 (P44, AQ-6) e E2.11 (T11):** depois de gravar, o Dashboard aberto mostra os números de antes em `opacity-60` até chegarem os novos, e o fechado carrega do zero na visita seguinte. "Novo relatório" abre o mesmo diálogo do E2.11.
- **E1.08:** continuam o `Skeleton` no lugar do número, o `aria-busy`, o "Carregando…" para o leitor de tela, o erro por seção e o ranking que cabe em 360 px. Mudam duas coisas: só os cards sempre à vista têm `Skeleton` (P112), e o erro ganha "Tentar de novo" (UXD-9).

### Decisões de experiência
| # | Decisão | Por quê |
|---|---|---|
| UXD-1 | **O card inteiro é o link (P110). O card que abre uma lista tem a seta `›` no canto de baixo; o card com zero, ou de uma lista que a pessoa não tem, não tem seta, nem hover, nem lugar no Tab.** *Definido pela UX.* | No celular, o card inteiro é um alvo de cerca de 158 × 130 px, fácil de acertar com o polegar. O legado já abria a lista pelo card, e os usuários conhecem o gesto. Um botão "Ver" em cada card dobraria as paradas no Tab e o ruído na tela. A seta ensina, sem texto, quais números abrem alguma coisa. |
| UXD-2 | **Cor só onde há o que fazer (P111).** O card de pendentes fica amarelo de aviso com pendência e verde sem; "Sem liderança" e "Sem vínculo celular" ficam amarelos. Todos os outros cards são neutros, com o ícone em cinza. O aviso tem uma barra de 4 px na borda esquerda, e o card de pendentes troca o triângulo pelo ✓ quando zera. *Definido pela UX (PO-UX-3).* | No legado, todo card era colorido, e a cor deixou de dizer alguma coisa. Hoje o novo pinta cada ícone de uma cor, inclusive de vermelho "Membros inativos" e "Células não realizadas", que não são erro, e usa um laranja fora dos tokens. Com a cor reservada, o triângulo amarelo salta aos olhos. A barra e a troca de ícone mostram o aviso também a quem não distingue as cores (RN-15). |
| UXD-3 | **Duas colunas de cards no celular, numa grade que se ajusta à largura (P114).** *Definido pela UX (PO-UX-5).* | Numa coluna, os 16 cards somariam cerca de 2.100 px em 360 px, mais de três telas de rolagem. Em duas colunas, a rolagem cai à metade, e o card de pendentes aparece sem rolar, mesmo com o atalho "Novo relatório" acima. A largura mínima é em `rem`, então a fonte grande e o zoom voltam para uma coluna sozinhos. |
| UXD-4 | **Nada aparece para depois sumir (P112).** Enquanto os números não chegam, só os cinco cards sempre à vista ocupam lugar, com o `Skeleton` no número. Os cards condicionais de uma seção aparecem juntos, quando a seção inteira chega. O gráfico e o ranking só aparecem com os dados. *Definido pela UX.* | Ponto 6 para o `architect`. Um `Skeleton` de card que depois some faz a tela "pular" para cima e engana quem já ia tocar nele. Acrescentar cards de uma vez, no momento em que os números aparecem, acontece antes de a pessoa agir. |
| UXD-5 | **O gráfico tem três linhas em HTML, cada uma com o badge, o número e uma barra horizontal, e a linha inteira abre a lista. Não há a aba "Tabela" (P113, que refina o P83).** *Definido pela UX (PO-UX-1).* | A RN-13 pede que cada parte abra uma lista. Num SVG com `role="img"` (P83), as partes não recebem foco: o teclado e o leitor de tela precisariam da aba "Tabela" para abrir as listas, e a barra de uma parte com 1 seria um alvo minúsculo. As três linhas de texto já são a tabela, e uma aba repetiria os mesmos três números atrás de mais um controle. Sem biblioteca de gráfico, o Dashboard, que é a tela inicial, não baixa nada a mais no 3G. As barras comparam melhor do que a pizza do legado, e cada barra fica ao lado do nome, então a cor não é necessária para ler. Os badges são os das listas, e o triângulo amarelo do "Pendente" é o mesmo em todo o sistema. |
| UXD-6 | **No ranking, o nome do casal é o link, e tocar em qualquer lugar da linha abre a mesma lista (P81). A seta fica no fim da coluna Total. Os números perdem as pílulas azul e rosa.** *Definido pela UX (PO-UX-6).* | Segue o P81 das tabelas de Células e Relatórios. As pílulas usam cores fora dos tokens, competem com o Total e não informam nada que os títulos "Homens" e "Mulheres" já não digam. |
| UXD-7 | **Voltar de uma lista devolve o Dashboard na mesma posição, com o foco no card aberto, quando os números ainda estão no cache.** *Definido pela UX (PO-UX-7).* | O Dashboard é o ponto de partida: o pastor abre um número, volta e abre o seguinte. Recomeçar do topo obrigaria a rolar de novo até "Geral" ou até o ranking a cada volta. É o mesmo comportamento que o E2.10 deu às listas (AQ-8 de lá). |
| UXD-8 | **Cada grade de cards é uma lista (`ul`), e os títulos dos cards são texto, e não títulos (`h3`).** *Definido pela UX.* | Hoje cada card é um `h3`, então a navegação por títulos do leitor de tela passa por 17 títulos. Como lista, o leitor diz "lista, 5 itens" ao entrar na seção, e os títulos ficam para as seções e para o gráfico. |
| UXD-9 | **O erro aparece por seção, com o que fazer e "Tentar de novo".** *Definido pela UX (PO-UX-8).* | "Erro ao carregar o dashboard." não diz o que fazer. No 3G, a falha costuma ser passageira: tentar de novo ali mesmo não recarrega a página nem perde as seções que carregaram. |

### Navegação e rotas
- Nenhuma rota nova. O Dashboard não grava nada na URL.
- Cada número que abre uma lista é um `Link` com o endereço da tabela [Links de cada número](#links-de-cada-número), gerado pelos módulos das listas, com uma entrada nova no histórico.
- Voltar, pelo navegador ou pelo aparelho, devolve o Dashboard (RN-13): na mesma posição e com o foco no card aberto, quando os números ainda estão no cache (UXD-7); do topo, quando ele carrega do zero (depois de uma gravação, P44).
- "Novo relatório" abre o diálogo do E2.11 no próprio Dashboard, sem mudar a URL (T9 do E2.02).

### Fluxos
Contagem no celular, a partir do Dashboard, a tela que abre depois do login. "Toque" não conta a rolagem.

| # | História | Caminho | Toques e telas |
|---|---|---|---|
| F1 | O pastor vê as células pendentes e age (Samuel, quinta, 26/11, às 21:00) | Dashboard → lê "Células com relatório pendente: 3", em amarelo → toca no card → Células com "Situação do relatório: Pendente" | 1 toque; 2 telas. No legado, também 1. Hoje: ☰ → Células → procurar célula a célula. |
| F2 | O G12 vê quem entrou nesta semana (Pedro) | Dashboard → "Novos membros" → Membros com "Cadastrado a partir de 22/11/2026" e "Cadastrado até 28/11/2026" | 1 toque |
| F3 | A liderança vê as células que se reuniram (Rita) | Dashboard → rola até o gráfico → "Célula realizada" → Relatórios com "Esta semana" e "Reunião: Célula realizada" | 1 toque e a rolagem |
| F4 | A liderança vê por que não houve célula (Rita) | Dashboard → "Células não realizadas" (ou a linha do gráfico) → Relatórios com "Não houve célula" → toca no relatório → lê o motivo | 2 toques |
| F5 | O pastor vê as células de um casal G12 (Samuel) | Dashboard → rola até "Células por G12" → "Pedro & Paula" → Células com "G12: Pedro, Paula" e "Situação: Ativa" | 1 toque e a rolagem |
| F6 | Voltar e abrir o número seguinte | voltar do aparelho → o Dashboard na mesma posição, com o foco no card → toca no próximo | 2 toques |
| F7 | A secretaria confere as células novas (Rita, computador) | Dashboard → "Novas células" → Células com as datas da semana | 1 clique |
| F8 | A anfitriã envia o relatório e vê o número mudar (Carla) | Dashboard → "Novo relatório" → formulário (F1 do E2.11) → "Enviar relatório" → os cards da semana e o gráfico mudam, sem recarregar | os toques do E2.11, nenhum a mais |
| F9 | Quem não tem a lista (variação "Painel" de Carla) | Dashboard → lê os números. Os de Membros e de Células não abrem nada, e não há seta neles | 0 toques |

### Telas
Convenções dos wireframes, as do E2.09 com estas:
- 360 px ≈ 38 colunas. Os cards do celular têm 15 colunas por dentro (cerca de 158 px), e os do computador, 16 (cerca de 150 px);
- `›` é o `ChevronRight` do card ou da linha que abre uma lista (P110). Sem `›`, o número não abre nada;
- `┃` na borda esquerda é a barra do tom de aviso (P111);
- ícones dos cards, todos `aria-hidden`: `▤` `FileText`, `△` `TriangleAlert`, `✓` `CheckCircle2`, `◎` `Handshake`, `⊘` `CalendarX`, `⊕` `UserPlus`, `⊞` `HousePlus`, `◉` `Users`, `◈` `UserCheck`, `⊟` `UserX`, `◇` `Church`, `◆` `Droplets`, `▽` `Shield`, `⊗` `Link2Off` e `⌂` `House`; `⚠` é o `CircleAlert` do erro;
- `[✓ Célula realizada]`, `[⊘ Não houve célula]` e `[△ Pendente]` são os badges do P6 e do P70; `█` é a barra do gráfico; `▒` é `Skeleton`.

#### T1. Dashboard no celular (360 px)
Pedro, na terça, 24/11, às 21:00 (tabela "Números de hoje"):
```
┌──────────────────────────────────────┐
│ ☰                                    │
│ Dashboard          [Meu Ministério]  │  h1 e selo (E2.02)
│ Visão do seu ministério              │
│ [+ Novo relatório                  ] │  w-full, h-11 (E2.02)
│                                      │
│ Esta semana (22/11 - 28/11)          │  h2
│ ┌───────────────┐  ┌───────────────┐ │  ul em grade (P114)
│ │Relatórios    ▤│  │Células com   ✓│ │  zero: tom de sucesso,
│ │enviados       │  │relatório      │ │  sem link (P111)
│ │               │  │pendente       │ │
│ │1             ›│  │0              │ │
│ └───────────────┘  └───────────────┘ │
│ ┌───────────────┐  ┌───────────────┐ │
│ │Visitantes em ◎│  │Novos membros ⊕│ │
│ │células        │  │               │ │
│ │3             ›│  │1             ›│ │
│ └───────────────┘  └───────────────┘ │
│ ┌───────────────┐                    │  "Células não realizadas"
│ │Novas células ⊞│                    │  não aparece: zero (RN-14)
│ │               │                    │
│ │1             ›│                    │
│ └───────────────┘                    │
│                                      │
│ Relatórios de células                │  h3 (P113)
│ Células que ainda não precisam       │  legenda
│ enviar o relatório desta semana não  │
│ entram.                              │
│ ┌──────────────────────────────────┐ │
│ │[✓ Célula realizada]         1  › │ │  link (min-h-11)
│ │██████████████████████████████████│ │
│ │[⊘ Não houve célula]         0    │ │  sem link, sem barra;
│ │                                  │ │  a altura fica
│ │[△ Pendente]                 0    │ │
│ │                                  │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Geral                                │  h2
│ ┌───────────────┐  ┌───────────────┐ │
│ │Total de      ◉│  │Membros       ◈│ │
│ │membros        │  │ativos         │ │
│ │9             ›│  │8             ›│ │
│ └───────────────┘  └───────────────┘ │
│ ┌───────────────┐  ┌───────────────┐ │
│ │Membros       ⊟│  │Batizados     ◇│ │  Batizados, Não batizados e
│ │inativos       │  │               │ │  Sem vínculo celular só
│ │1             ›│  │…             ›│ │  quando maiores que zero
│ └───────────────┘  └───────────────┘ │
│ ┌───────────────┐  ┌───────────────┐ │
│ │Não batizados ◆│  │Células       ⌂│ │
│ │               │  │evangelísticas │ │
│ │…             ›│  │2             ›│ │
│ └───────────────┘  └───────────────┘ │
│ ┌───────────────┐                    │  sem "Sem liderança" e sem
│ │Células de    ⌂│                    │  "Macrocélulas": zero
│ │discipulado    │                    │
│ │1             ›│                    │
│ └───────────────┘                    │
│                                      │
│ Células por G12                      │  h2
│ ┌──────────────────────────────────┐ │
│ │G12 (Casal)  Homens Mulheres Total│ │
│ │Pedro & Paula     1        1   2 ›│ │  o nome é o link (P81)
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```
- **Ordem (RN-16):** cabeçalho; "Esta semana", com os cards e depois o gráfico; "Geral"; "Células por G12". O card escondido não ocupa lugar (RN-14), e o card seguinte sobe para o lugar dele.
- **Acima da dobra (360 × 800):** o cabeçalho, o atalho e a primeira linha de cards, com o card de pendentes (UX-03).
- **Espaçamento:** `space-y-8` entre as seções, como hoje; `gap-3` na grade do celular e `md:gap-4` a partir de 768 px; `space-y-4` entre o `h2` e a grade, e entre a grade e o gráfico.
- **Movimento:** o `animate-fade-in` de hoje ganha `motion-reduce:animate-none`.
- Componentes: os de hoje (`Card`, `Skeleton`, `Badge`, `Button`), o `StatusBadge` e o `Alert`. Nenhum componente novo do shadcn.

#### T2. Dashboard no computador (1280 px)
Rita, na terça, 24/11, às 21:00. O menu lateral fixo (256 px) fica à esquerda, fora do desenho:
```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Dashboard                                                                                           [+ Novo relatório] │
│ Visão geral da igreja                                                                                                  │
│                                                                                                                        │
│ Esta semana (22/11 - 28/11)                                                                                            │
│ ┌────────────────┐  ┎────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                     │
│ │Relatórios     ▤│  ┃Células com    △│  │Visitantes em  ◎│  │Novos membros  ⊕│  │Novas células  ⊞│                     │
│ │enviados        │  ┃relatório       │  │células         │  │                │  │                │                     │
│ │                │  ┃pendente        │  │                │  │                │  │                │                     │
│ │2              ›│  ┃1              ›│  │8              ›│  │1              ›│  │1              ›│                     │
│ └────────────────┘  ┖────────────────┘  └────────────────┘  └────────────────┘  └────────────────┘                     │
│                                                                                                                        │
│ Relatórios de células                                                                                                  │
│ Células que ainda não precisam enviar o relatório desta semana não entram.                                             │
│ ┌──────────────────────────────────────────────────────────────────────┐                                               │
│ │ [✓ Célula realizada]   ██████████████████████████████████████   2  › │                                               │
│ │ [⊘ Não houve célula]                                            0    │                                               │
│ │ [△ Pendente]           ███████████████████                      1  › │                                               │
│ └──────────────────────────────────────────────────────────────────────┘                                               │
│                                                                                                                        │
│ Geral                                                                                                                  │
│ ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┎────────────────┐ │
│ │Total de       ◉│  │Membros ativos ◈│  │Membros        ⊟│  │Batizados      ◇│  │Não batizados  ◆│  ┃Sem liderança  ▽│ │
│ │membros         │  │                │  │inativos        │  │                │  │                │  ┃                │ │
│ │                │  │                │  │                │  │                │  │                │  ┃                │ │
│ │22             ›│  │21             ›│  │1              ›│  │…              ›│  │…              ›│  ┃1              ›│ │
│ └────────────────┘  └────────────────┘  └────────────────┘  └────────────────┘  └────────────────┘  ┖────────────────┘ │
│ ┎────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                                         │
│ ┃Sem vínculo    ⊗│  │Células        ⌂│  │Células de     ⌂│  │Macrocélulas   ⌂│                                         │
│ ┃celular         │  │evangelísticas  │  │discipulado     │  │                │                                         │
│ ┃                │  │                │  │                │  │                │                                         │
│ ┃…              ›│  │3              ›│  │2              ›│  │1              ›│                                         │
│ ┖────────────────┘  └────────────────┘  └────────────────┘  └────────────────┘                                         │
│                                                                                                                        │
│ Células por G12                                                                                                        │
│ ┌──────────────────────────────────────────────────────────────────────┐                                               │
│ │ G12 (Casal)                           Homens   Mulheres     Total    │                                               │
│ │ Pedro & Paula                              1          1         2 ›  │                                               │
│ │ Tiago & Tânia                              1          1         2 ›  │                                               │
│ │ …                                                                    │                                               │
│ └──────────────────────────────────────────────────────────────────────┘                                               │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```
- **Grade (P114):** seis cards por linha em 1280 px; a semana inteira cabe numa linha, com uma vaga sobrando quando um card está escondido. Em 1024 px, quatro por linha.
- **Gráfico e ranking:** até `max-w-3xl`, alinhados à esquerda. Mais largos, as barras e as colunas ficariam longe demais dos nomes.
- **"Sem vínculo celular"** aparece na massa só se for maior que zero; no desenho, ele está para mostrar o tom de aviso.
- O que muda do celular para cá é só o número de colunas, o gráfico numa linha por parte (T4) e as larguras máximas. A ordem do DOM é a mesma.

#### T3. Card de número (P110, P111)
```
Com link, neutro       Com link, aviso        Zero, sucesso          Sem link (zero ou sem acesso)
┌───────────────┐      ┎───────────────┐      ┌───────────────┐      ┌───────────────┐
│Novos membros ⊕│      ┃Células com   △│      │Células com   ✓│      │Total de      ◉│
│               │      ┃relatório      │      │relatório      │      │membros        │
│1             ›│      ┃pendente       │      │pendente       │      │1              │
└───────────────┘      ┃1             ›│      │0              │      └───────────────┘
                       ┖───────────────┘      └───────────────┘
```
- **Estrutura (P110):** cada card é um `li` da grade. Dentro, um `Link` (com link) ou um `div` (sem link), com `flex h-full flex-col gap-2 rounded-lg border p-4`.
  - Em cima, o título (`text-sm font-medium leading-snug`, quebra linha, sem `truncate`) e o ícone (`h-5 w-5 shrink-0`, `aria-hidden`), em `flex items-start justify-between gap-2`.
  - Embaixo (`mt-auto`), o número (`text-3xl font-bold tabular-nums text-foreground`, com o `formatCount`: "1.234") e, com link, o `ChevronRight` (`h-5 w-5 text-muted-foreground`, `aria-hidden`), em `flex items-end justify-between`.
  - O `li` e o card têm `h-full`. Os cards de uma linha ficam com a mesma altura, e os números se alinham na base, com títulos de 1, 2 ou 3 linhas.
- **Ícone e tom de cada card (P111):**

  | Card | Ícone | Tom |
  |---|---|---|
  | Relatórios enviados | `FileText` | neutro |
  | Células com relatório pendente | `TriangleAlert` com pendência; `CheckCircle2` com zero | aviso; sucesso |
  | Visitantes em células | `Handshake` | neutro, também com zero (P-DSH-10) |
  | Células não realizadas | `CalendarX`, o do badge "Não houve célula" | neutro, nunca vermelho (RN-12) |
  | Novos membros | `UserPlus` | neutro |
  | Novas células | `HousePlus` | neutro |
  | Total de membros | `Users` | neutro |
  | Membros ativos | `UserCheck` | neutro |
  | Membros inativos | `UserX` | neutro |
  | Batizados | `Church` | neutro |
  | Não batizados | `Droplets` | neutro |
  | Sem liderança | `Shield` | aviso |
  | Sem vínculo celular | `Link2Off` | aviso |
  | Células evangelísticas, Células de discipulado e Macrocélulas | `House` | neutro |

  Mudam em relação a hoje: "Visitantes" passa o `UserPlus` para "Novos membros" e fica com o `Handshake`; "Células não realizadas" troca o `XCircle` vermelho pelo `CalendarX`; os tipos deixam o `Church` para "Batizados" e passam ao `House` (PO-UX-4).
- **Com link:** hover `hover:bg-muted/50` (neutro), `hover:bg-warning/20` (aviso) ou `hover:bg-success/20` (sucesso), com `transition-colors motion-reduce:transition-none`. O foco desenha o anel em volta do card inteiro (`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`).
- **Sem link:** o mesmo card, num `div`, sem `›`, sem hover, sem `cursor-pointer` e fora do Tab. Não há aviso de "sem acesso" (P-DSH-05).
- **Nome acessível:** "{Título}: {número}, ver na lista de {Membros, Células ou Relatórios}" †. O ":" e o destino ficam em `sr-only`, na ordem do DOM. Exemplo: "Células com relatório pendente: 1, ver na lista de Células". Sem link, o leitor ouve "Total de membros: 1".
- **Card de pendentes enquanto carrega:** neutro e sem ícone, porque o tom e o ícone dependem do número (T7).

#### T4. Gráfico "Relatórios de células" (P113)
Celular, Rita, na terça, 24/11, às 21:00:
```
┌──────────────────────────────────────┐
│ Relatórios de células                │  h3
│ Células que ainda não precisam       │  legenda (figcaption)
│ enviar o relatório desta semana não  │
│ entram.                              │
│ ┌──────────────────────────────────┐ │
│ │[✓ Célula realizada]         2  › │ │  link; 2 é o maior:
│ │██████████████████████████████████│ │  a barra ocupa a largura toda
│ │[⊘ Não houve célula]         0    │ │  sem link e sem barra;
│ │                                  │ │  a linha guarda a altura
│ │[△ Pendente]                 1  › │ │  link
│ │█████████████████                 │ │  metade
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```
A partir de 768 px, cada parte numa linha só (como na T2).
- **Quando aparece (RN-12, P112):** quando os números da semana chegam e pelo menos uma parte é maior que zero. Não tem `Skeleton`, porque pode não aparecer.
- **Estrutura:** um `figure` com `aria-labelledby` no `h3` e `aria-describedby` na legenda. Dentro, um `Card` com uma `ul role="list"` de três `li`, nesta ordem fixa: Célula realizada, Não houve célula, Pendente.
- **Cada linha:**
  - o badge da parte, no `StatusBadge` com `rounded-md`, igual ao das listas: "Célula realizada" (`success`, `CheckCircle2`), "Não houve célula" (`muted`, `CalendarX`) e "Pendente" (`warning`, `TriangleAlert`);
  - o número (`text-lg font-semibold tabular-nums`, com o `formatCount`), alinhado à direita, seguido do `›` quando há link. Nas linhas sem link, o lugar do `›` fica reservado, para os números se alinharem;
  - a barra: um `div` `aria-hidden`, `h-3 rounded-sm`, em `bg-success`, `bg-muted-foreground` ou `bg-warning`. A largura é o número dividido pelo maior número das três partes, com no mínimo 4 px quando ele é maior que zero. Com zero, não há barra, mas a linha mantém a altura. Não há trilho de fundo, para a barra não parecer de progresso.
- **Arranjo:** abaixo de 768 px, `grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5`: o badge e o número na primeira linha e a barra embaixo, ocupando as duas colunas. A partir de 768 px, `md:grid-cols-[minmax(0,13rem)_1fr_auto] md:items-center`: badge, barra e número. O card vai até `md:max-w-3xl`.
- **Link (RN-13, P110):** a linha inteira é um `Link` (`min-h-11 rounded-md px-2 py-1.5`, hover `bg-muted/50`, o anel de foco do P110), quando o número é maior que zero e a pessoa tem acesso à lista. Senão, um `div`.
- **Nome acessível:** "Célula realizada: 2, ver na lista de Relatórios" e "Pendente: 1, ver na lista de Células" †. A linha sem link é lida "Não houve célula: 0". As barras não são lidas.
- **Legenda:** "Células que ainda não precisam enviar o relatório desta semana não entram." † (`text-sm text-muted-foreground`). Explica por que a soma das partes é menor que o número de células (RN-12: "Ainda não ocorreu" e "Conta a partir da próxima semana" ficam de fora) (PO-UX-2).
- **Sem animação:** a largura das barras não anima. **Sem biblioteca de gráfico e sem abas** (UXD-5, PO-UX-1).

#### T5. Ranking "Células por G12"
Celular, Samuel, na terça, 24/11, às 21:00 (critério da RN-11):
```
┌──────────────────────────────────────┐
│ Células por G12                      │  h2
│ ┌──────────────────────────────────┐ │
│ │G12 (Casal)  Homens Mulheres Total│ │  caption sr-only
│ │Pedro & Paula     1        1   2 ›│ │  o nome é o link; a linha
│ │Tiago & Tânia     1        1   2 ›│ │  inteira abre a mesma lista
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```
- **Colunas e textos:** os de hoje ("G12 (Casal)", "Homens", "Mulheres" e "Total"), na ordem do servidor (maior Total primeiro).
- **Link (P81, RN-13):** o nome do casal é um `Link` (`block min-h-11 py-3 font-medium`, `hover:underline underline-offset-4`), para o endereço da tabela de Links. Tocar ou clicar em qualquer lugar da linha abre a mesma lista: é um atalho do ponteiro, que ignora a seleção de texto. O `›` fica no fim da célula Total.
- **Sem link:** com Total 0, ou sem acesso a Células, o nome é texto, sem `›`, e a linha não reage ao toque.
- **Números:** texto `tabular-nums`, centralizados; o Total em `font-semibold`. Saem as pílulas `bg-blue-100` e `bg-pink-100` e os ícones azul e rosa do cabeçalho, que usam cores fora dos tokens (UXD-6). As linhas continuam zebradas (`bg-muted/30`), e a linha com link ganha `hover:bg-muted/60`.
- **Legenda da tabela:** `caption` em `sr-only`, "Células ativas por casal G12, do maior total para o menor." †.
- **Nome acessível do link:** "Pedro e Paula: 2 células, ver na lista de Células" † ("1 célula" no singular). O "&" visível fica `aria-hidden`, com " e " em `sr-only`.
- **Largura:** até `lg:max-w-3xl`. Em 360 px, cabe sem rolar (E1.08), e os nomes longos quebram linha. O `overflow-x-auto` de hoje fica só como proteção para 320 px com zoom.
- **Quando aparece (RN-11, P112):** quando os dados chegam com pelo menos um casal. Sem `Skeleton` antes: ele fica no fim da página e não empurra nada que já está à vista.

#### T6. Sem acesso às listas
Variação "Painel" de Carla, na terça, 24/11, às 21:00 (critério da RN-13):
```
┌──────────────────────────────────────┐
│ ☰                                    │
│ Dashboard                            │  sem subtítulo e sem selo
│ [+ Novo relatório                  ] │  (E2.02, P-PER-29)
│                                      │
│ Esta semana (22/11 - 28/11)          │
│ ┌───────────────┐  ┌───────────────┐ │
│ │Relatórios    ▤│  │Células com   ✓│ │  link: ela tem Relatórios
│ │enviados       │  │relatório      │ │
│ │               │  │pendente       │ │
│ │1             ›│  │0              │ │
│ └───────────────┘  └───────────────┘ │
│ ┌───────────────┐                    │
│ │Visitantes em ◎│                    │
│ │células        │                    │
│ │3             ›│                    │
│ └───────────────┘                    │
│                                      │
│ Relatórios de células                │
│ …                                    │
│ ┌──────────────────────────────────┐ │
│ │[✓ Célula realizada]         1  › │ │  link
│ │██████████████████████████████████│ │
│ │[⊘ Não houve célula]         0    │ │
│ │                                  │ │
│ │[△ Pendente]                 0    │ │
│ │                                  │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Geral                                │
│ ┌───────────────┐  ┌───────────────┐ │
│ │Total de      ◉│  │Membros       ◈│ │  sem link e sem ›: ela não
│ │membros        │  │ativos         │ │  tem Membros no menu
│ │1              │  │1              │ │
│ └───────────────┘  └───────────────┘ │
│ ┌───────────────┐  ┌───────────────┐ │
│ │Células       ⌂│  │Células de    ⌂│ │  sem link: ela não tem
│ │evangelísticas │  │discipulado    │ │  Células no menu
│ │1              │  │1              │ │
│ └───────────────┘  └───────────────┘ │
│                                      │  sem "Células por G12"
└──────────────────────────────────────┘
```
- O número aparece igual, só sem a seta (P-DSH-05). Não há mensagem de "sem acesso": a pessoa não perde nada que tinha, porque ela nunca teve a lista.
- Se a pendência de Carla fosse maior que zero, o card ficaria amarelo, sem link (o tom não depende do acesso).

#### T7. Carregando, atualizando e erro
```
Primeira carga (Pedro)                   Erro nos números (Pedro)
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ ☰                                    │ │ ☰                                    │
│ Dashboard          [Meu Ministério]  │ │ Dashboard          [Meu Ministério]  │
│ Visão do seu ministério              │ │ Visão do seu ministério              │
│ [+ Novo relatório                  ] │ │ [+ Novo relatório                  ] │
│                                      │ │                                      │
│ Esta semana ▒▒▒▒▒▒▒▒▒▒               │ │ Esta semana                          │
│ ┌───────────────┐  ┌───────────────┐ │ │ ┌──────────────────────────────────┐ │
│ │Relatórios    ▤│  │Células com    │ │ │ │ ⚠ Não foi possível carregar os   │ │
│ │enviados       │  │relatório      │ │ │ │ números desta semana. Verifique  │ │
│ │               │  │pendente       │ │ │ │ a conexão e tente de novo.       │ │
│ │▒▒▒▒           │  │▒▒▒▒           │ │ │ │ [Tentar de novo                ] │ │
│ └───────────────┘  └───────────────┘ │ │ └──────────────────────────────────┘ │
│ ┌───────────────┐                    │ │                                      │
│ │Visitantes em ◎│                    │ │ Geral                                │
│ │células        │                    │ │ ┌──────────────────────────────────┐ │
│ │▒▒▒▒           │                    │ │ │ ⚠ Não foi possível carregar os   │ │
│ └───────────────┘                    │ │ │ números gerais. Verifique a      │ │
│                                      │ │ │ conexão e tente de novo.         │ │
│ Geral                                │ │ │ [Tentar de novo                ] │ │
│ ┌───────────────┐  ┌───────────────┐ │ │ └──────────────────────────────────┘ │
│ │Total de      ◉│  │Membros       ◈│ │ │                                      │
│ │membros        │  │ativos         │ │ │ Células por G12                      │
│ │▒▒▒▒           │  │▒▒▒▒           │ │ │ ┌──────────────────────────────────┐ │
│ └───────────────┘  └───────────────┘ │ │ │G12 (Casal)  Homens Mulheres Total│ │
│                                      │ │ │Pedro & Paula     1        1   2 ›│ │
└──────────────────────────────────────┘ │ └──────────────────────────────────┘ │
                                         └──────────────────────────────────────┘
```
- **Primeira carga (P112, UXD-4):**
  - "Esta semana": o título com um `Skeleton` no lugar das datas, como hoje, e os três cards sempre à vista com o título e um `Skeleton` no número (`h-9 w-16`). O de pendentes fica neutro e sem ícone até o número chegar.
  - "Geral": os dois cards sempre à vista, "Total de membros" e "Membros ativos".
  - Nenhum `Skeleton` para os cards condicionais, para o gráfico nem para o ranking.
  - Cada seção em carga tem `aria-busy="true"` e um "Carregando…" em `role="status"` e `sr-only`.
  - Os números e os cards condicionais de uma seção aparecem juntos, quando todas as consultas dela respondem. "Geral" espera os números de membros e os tipos (AQ-3).
- **Atualizando** (depois de gravar com o Dashboard aberto, ou ao voltar para a aba; RN-17, P44): os números de antes ficam, com `opacity-60` e `aria-busy="true"`, sem `Skeleton`. Os cards condicionais e o gráfico só aparecem ou somem quando a resposta chega.
- **Erro ao carregar (UXD-9):**
  - Um `Alert` por seção (variante `default`, ícone `CircleAlert` e texto em `text-foreground`), com o texto da tabela de Textos e "Tentar de novo" (`outline`, `w-full h-11` no celular, `md:w-auto md:h-10`).
  - "Tentar de novo" refaz só as consultas que falharam (AQ-9). Quando a falha é dos números da semana e de membros, a mesma consulta alimenta as duas seções: um toque em qualquer um dos botões recarrega as duas.
  - Só os tipos falharam: os cards de membros aparecem e, logo abaixo, o erro dos tipos. Só o ranking falhou: a seção "Células por G12" aparece com o `h2` e o erro.
  - Na primeira carga, o `Alert` não leva o `role="alert"` padrão do componente, para não interromper a leitura (E2.10). Ele passa a `role="alert"` quando "Tentar de novo" falha de novo.
  - Nunca uma mensagem técnica (código, "RPC", "PGRST", "Error").
- **A atualização falha:**
  - depois de uma gravação, a seção troca os números pelo erro, porque o Dashboard nunca mostra o número de antes de uma gravação (RN-17; AQ-7, PO-UX-7);
  - ao voltar para a aba, sem gravação, os números ficam, sem aviso, como hoje (E1.08).
- **Sem acesso ao Dashboard:** a T9 do E2.02, sem nenhum card nem `Skeleton`.

#### T8. Telas sem mudança visual
- **Membros, Células e Relatórios:** recebem os links com os filtros na URL e mostram os chips e o total (E2.07, E2.10 e E2.12). A lista de Relatórios mostra o atalho "Esta semana" marcado (P90).
- **Formulário de relatório (E2.11):** o mesmo diálogo. Depois de enviar pelo atalho, o foco volta a "Novo relatório", e os números recarregam (T7, "Atualizando").
- **Ministérios, Funções e Auditoria:** sem mudança.

#### T9. As perguntas Q-1 a Q-6 na tela
Com o padrão do Negócio, vale o que está nas T1 a T8. Se a resposta for sim:

- **Q-1. Navegar entre semanas.**
  - Logo abaixo do título da seção, dois botões `outline` lado a lado, cada um com metade da largura no celular e `h-11`: "Semana anterior" † (`ChevronLeft`) e "Próxima semana" † (`ChevronRight`), este desabilitado na semana atual. A semana escolhida vai para a URL (`?week=2026-11-15`), e o voltar do navegador volta à semana vista antes.
  - Em outra semana, o título passa a "Semana de 15/11 a 21/11" †, com o link "Voltar para esta semana" †.
  - Numa semana que já acabou, o card de pendentes passa a contar as células que terminaram a semana sem relatório. O título e o link desse card são do PO: o filtro de Células para semanas anteriores (E2.10) vai só até 4 semanas.
  - "Geral" continua com os números de hoje e ganha a frase "Números de hoje, para qualquer semana escolhida." †.
  - Custo no celular: uma linha de 44 px antes dos cards.
- **Q-2. Cards com zero sempre à vista.**
  - Os 16 cards aparecem sempre. O zero fica neutro e sem link. Na carga, todos têm `Skeleton`, e o P112 deixa de ser necessário nos cards.
  - Em 360 px, "Geral" passa a ter 5 linhas de cards. O gráfico e o ranking continuam com a RN-12 e a RN-11.
- **Q-3. Card de pendentes vermelho.**
  - Com pendência, o card passa a um tom de erro no P111: `bg-destructive/10`, `border-destructive/50` e a barra `border-l-destructive`, com o `TriangleAlert` e o título em `text-foreground`.
  - O badge e a parte "Pendente" do gráfico continuam amarelos (P70), então a mesma situação teria duas cores na mesma tela. A UX não recomenda.
- **Q-4. "Ainda não ocorreu" no gráfico.**
  - Uma quarta linha, depois de "Pendente": o badge "Ainda não ocorreu" do P70 (`muted`, `Clock`), com a barra em `bg-muted-foreground/50`, para se separar da de "Não houve célula". Abre Células com "Situação do relatório: Ainda não ocorreu" (o valor do filtro do E2.10).
  - A legenda passa a "Células cadastradas ou reativadas depois da reunião desta semana não entram." †.
- **Q-5. Card de células inativas.**
  - Um card "Células inativas" † em "Geral", depois de "Macrocélulas", neutro, com o `PauseCircle` do badge "Inativa" (E2.08), escondido com zero e abrindo `/cells?status=inactive`.
- **Q-6. Dashboard de um G12.**
  - Para quem vê a igreja toda, um campo "Ministério" † logo abaixo do cabeçalho, com o seletor de G12 do E2.10 e "Toda a igreja" † como padrão. A escolha vai para a URL (`?g12=<id>,<id>`).
  - Com um ministério escolhido, o subtítulo passa a "Visão do ministério de Pedro & Paula" †, e todos os números e links levam o filtro de G12 de cada lista. O ranking mostra só o casal escolhido.
  - Custo no celular: um campo de 44 px.

### Padrões novos (valem para as próximas telas)
A numeração começa em P110 (ver a nota do início da seção). Este passo também aplica o P6, o P10, o P44, o P70, o P81 e o P90, sem mudá-los, e refina o P83 (P113).

- **P110. Card de número que abre uma lista.**
  - Cada grade de cards é uma `ul role="list"`, e cada card, um `li`. O título do card é texto, e não título (`h3`): os títulos são das seções.
  - **Com link:** o card inteiro é o `Link`, com o anel de foco em volta do card, o hover do tom (P111) e o `ChevronRight` (`aria-hidden`) no canto de baixo, na linha do número.
  - **Sem link** (zero, ou sem acesso à lista pelo menu): o mesmo card num `div`, sem seta, sem hover e fora do Tab. Nada de botão desabilitado nem de aviso.
  - **Conteúdo:** o título em cima (`text-sm font-medium leading-snug`, sem `truncate`), o ícone à direita (`items-start`) e o número embaixo (`mt-auto text-3xl font-bold tabular-nums`). Os cards de uma linha têm a mesma altura, com os números na base.
  - **Nome acessível:** "{Título}: {número}, ver na lista de {Lista}", com o ":" e o destino em `sr-only`.
  - **Navegação:** entrada nova no histórico. Voltar devolve a tela de origem na mesma posição, com o foco no card, quando os dados estão no cache.
  - Vale para os cards de número de Escolas e da Consolidação.
- **P111. Tom de um card de número.** Cor só onde há o que fazer.

  | Tom | Quando | Fundo e borda | Título | Ícone |
  |---|---|---|---|---|
  | neutro | o padrão | `bg-card border` | `text-muted-foreground` | `text-muted-foreground` |
  | aviso | o número pede atenção | `bg-warning/10 border-warning/50 border-l-4 border-l-warning` | `text-foreground` | `text-warning` |
  | sucesso | o card de aviso que zerou, quando o zero é a boa notícia | `bg-success/10 border-success/50` | `text-foreground` | `text-success`, com um ícone diferente do aviso |

  - O número fica sempre em `text-foreground`. No fundo tingido, o título também, porque o `text-muted-foreground` não chega a 4,5:1 sobre a cor no tema escuro.
  - Sem depender de cor: o aviso tem a barra lateral de 4 px, e a troca de aviso para sucesso troca o ícone. Os ícones são decorativos; o texto e o número dizem tudo.
  - Nunca `destructive` num card de número: o vermelho é de erro e de exclusão (P70).
- **P112. Itens que só aparecem com valor.**
  - Enquanto os dados não chegam, só os itens sempre à vista ocupam lugar, com o título e um `Skeleton` no lugar do número. Os que podem sumir (cards escondidos com zero, gráficos, tabelas que somem vazias) não têm `Skeleton`.
  - Uma seção mostra seus números e seus itens condicionais de uma vez, quando todas as consultas dela respondem, já na ordem final. Nenhum item entra antes de outro que já está na tela.
  - Na atualização, os valores de antes ficam com `opacity-60` e `aria-busy` (P44), e os itens só aparecem ou somem quando a resposta chega.
- **P113. Gráfico de poucas partes, em HTML.** Refina o P83 para uma medida dividida em até 5 partes nomeadas, em que cada parte pode abrir uma lista.
  - Um `figure` com o título e uma legenda, e uma `ul` com uma linha por parte, em ordem fixa. Cada linha tem o badge da parte (P6, com o texto e o ícone das listas), o número e uma barra (`div` `aria-hidden`, `h-3 rounded-sm`, na cor do token do tom, com largura proporcional ao maior número, no mínimo 4 px quando maior que zero, e sem trilho).
  - Abaixo de 768 px, o badge e o número numa linha e a barra embaixo; a partir de 768 px, badge, barra e número numa linha.
  - A linha inteira é o link quando a parte abre uma lista (P110), com `min-h-11`.
  - Como o texto já está no gráfico, não há a aba "Tabela", e o Dashboard não carrega biblioteca de gráfico. Sem animação. Gráficos com eixo de tempo ou com várias séries continuam no P83.
- **P114. Grade de cards pela largura do conteúdo.**
  - `grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3 md:gap-4`. O número de colunas sai da largura: 1 em 320 px, 2 em 360 px, 3 em 768 px, 4 em 1024 px e 6 em 1280 px. Com a fonte grande e o zoom, as colunas diminuem sozinhas, porque o mínimo é em `rem`.
  - O `auto-fill` mantém a mesma largura de card em todas as seções, mesmo numa linha incompleta.

Nenhum componente novo do shadcn é necessário: `card`, `skeleton`, `badge` (pelo `StatusBadge`), `alert`, `button` e `table` já estão em `src/components/ui`. Os ícones `FileText`, `TriangleAlert`, `CheckCircle2`, `Handshake`, `CalendarX`, `UserPlus`, `HousePlus`, `Users`, `UserCheck`, `UserX`, `Church`, `Droplets`, `Shield`, `Link2Off`, `House`, `ChevronRight` e `CircleAlert` existem no `lucide-react` do projeto (0.462). As respostas da T9 usam também `ChevronLeft`, `Clock` e `PauseCircle`, que existem.

### Estados
| Estado | Cards (T1 a T3) | Gráfico (T4) | Ranking (T5) |
|---|---|---|---|
| Carregando, primeira vez | Só os cinco sempre à vista, com o título e o `Skeleton` no número; o de pendentes neutro e sem ícone. `aria-busy` e "Carregando…" por seção (P112). | Não aparece até os números chegarem. | Não aparece até chegar. |
| Atualizando (depois de gravar com a tela aberta, ou ao voltar para a aba) | Os números de antes, com `opacity-60` e `aria-busy`. Cards aparecem ou somem só quando a resposta chega. | Idem. | Idem. |
| Volta de uma lista, com o cache | Os números na hora, a atualização em segundo plano (linha acima), a posição e o foco no card aberto (UXD-7). | Idem. | Idem. |
| Tudo zero (domingo, às 00:00) | "Esta semana": os três cards com 0, sem link, e o de pendentes verde. "Geral": os cards sempre à vista e os maiores que zero. | Não aparece. | Aparece se houver casal G12 visível, com os totais e sem link nos zeros. |
| Erro ao carregar | `Alert` por seção, com "Tentar de novo" (T7). | Some com a seção. | `Alert` na seção, com o `h2`. |
| Atualização que falha | Depois de gravar: o `Alert` no lugar dos números (RN-17). Ao voltar para a aba: os números ficam (E1.08). | Idem. | Idem. |
| Sem acesso ao Dashboard | A T9 do E2.02, sem card nem `Skeleton`. | — | — |
| Sem acesso a uma lista | O número sem link e sem seta (T6). | A parte sem link. | A linha sem link. |
| Números grandes | "20.000" cabe no card em 320 px e em 360 px, sem corte (`tabular-nums`). | Idem, com a barra proporcional. | Idem. |
| Muitos casais | — | — | Todas as linhas, sem paginação: são os G12 visíveis, no volume medido no E1.08. |
| Passagem do tempo com a tela aberta | Nada muda até a consulta seguinte (P-DSH-12). | Idem. | Idem. |
| Semana que vira com a tela aberta | Os links continuam com a semana que a tela mostra (RN-13). | Idem. | — |
| Queda de conexão no envio | Só o "Novo relatório" envia, com os estados do E2.11. Os números só mudam depois do envio confirmado. | Idem. | — |

### Textos
Complementam os "Textos de tela" do Negócio, sem mudar os termos. Os marcados com † foram definidos pela UX e estão nas pendências (PO-UX-8).

| Onde | Texto |
|---|---|
| Seções (Negócio) | Esta semana ({dd/mm} - {dd/mm}) · Geral · Células por G12 |
| Seção da semana, para o leitor de tela † | Esta semana, de {dd/mm} a {dd/mm} |
| Cards (Negócio) | Relatórios enviados · Células com relatório pendente · Visitantes em células · Células não realizadas · Novos membros · Novas células · Total de membros · Membros ativos · Membros inativos · Batizados · Não batizados · Sem liderança · Sem vínculo celular · Células evangelísticas · Células de discipulado · Macrocélulas |
| Card com link, para o leitor de tela † | {Título}: {número}, ver na lista de Membros · … ver na lista de Células · … ver na lista de Relatórios |
| Card sem link, para o leitor de tela † | {Título}: {número} |
| Gráfico (Negócio) | Relatórios de células · Célula realizada · Não houve célula · Pendente |
| Gráfico: legenda † | Células que ainda não precisam enviar o relatório desta semana não entram. |
| Gráfico, para o leitor de tela † | {Parte}: {número}, ver na lista de Relatórios · {Parte}: {número}, ver na lista de Células · {Parte}: {número} (sem link) |
| Ranking (sem mudança) | G12 (Casal) · Homens · Mulheres · Total |
| Ranking: legenda da tabela † | Células ativas por casal G12, do maior total para o menor. |
| Ranking: link, para o leitor de tela † | {Nome} e {Nome}: {N} células, ver na lista de Células · 1 célula |
| Carregando (E1.08) | Carregando… |
| Erros † | Não foi possível carregar os números desta semana. Verifique a conexão e tente de novo. · Não foi possível carregar os números gerais. Verifique a conexão e tente de novo. · Não foi possível carregar as células por tipo. Verifique a conexão e tente de novo. · Não foi possível carregar as células por G12. Verifique a conexão e tente de novo. · Tentar de novo |
| Cabeçalho e sem acesso (E2.02) | sem mudança |
| Q-1 a Q-6, se adotadas † | Semana anterior · Próxima semana · Semana de {dd/mm} a {dd/mm} · Voltar para esta semana · Números de hoje, para qualquer semana escolhida. · Células cadastradas ou reativadas depois da reunião desta semana não entram. · Células inativas · Ministério · Toda a igreja · Visão do ministério de {Nome} & {Nome} |

**Evitar no Dashboard**, além do que o Negócio lista: "Erro ao carregar o dashboard." (sai, UXD-9); "Clique aqui" e "Ver mais"; "Em dia" (as palavras da situação são as do E2.09); qualquer texto técnico (código de erro, nome de função ou de parâmetro).

### Acessibilidade
- **Estrutura:** um `h1` ("Dashboard"); um `h2` por seção ("Esta semana…", "Geral" e "Células por G12"), cada seção uma `section` com `aria-labelledby`; o `h3` "Relatórios de células" dentro de "Esta semana". Os títulos dos cards não são títulos (UXD-8).
- **Listas:** cada grade e o gráfico são uma `ul role="list"` (o `role` volta a semântica de lista que o Safari tira com `list-style: none`). O leitor diz "lista, 5 itens" ao entrar.
- **Semana:** o "(22/11 - 28/11)" visível fica `aria-hidden`, com ", de 22/11 a 28/11" em `sr-only`.
- **Links:** os nomes da tabela de Textos começam pelo título visível e o contêm (WCAG 2.5.3). As setas, os ícones e as barras são `aria-hidden`. O número sem link é texto comum, fora do Tab.
- **Foco:** o anel cobre o card inteiro, a linha do gráfico e o nome do casal; a ordem do Tab é a visual (os cards da semana, o gráfico, os cards gerais e o ranking). Ao voltar de uma lista, o foco vai para o card aberto (UXD-7). Depois do "Novo relatório", o foco volta ao botão (E2.02).
- **Anúncios:** "Carregando…" em `role="status"` por seção, dentro do `aria-busy`. A troca dos números não é anunciada: o toast do relatório já anuncia o envio. O erro só vira `role="alert"` depois de "Tentar de novo" (T7).
- **Sem depender de cor:** o aviso tem a barra lateral; o card de pendentes troca o ícone entre aviso e sucesso; o gráfico tem o texto e o ícone de cada parte ao lado da barra; o ranking usa os títulos "Homens" e "Mulheres", e não cores.
- **Contraste, nos temas claro e escuro:** 4,5:1 para os títulos, os números, a legenda do gráfico e o ranking. No fundo tingido, o título fica em `text-foreground` (P111). Os badges seguem o P6. As barras e os ícones repetem o que o texto já diz, então não são o único meio de leitura.
- **Zoom de 200%, 320 px e fonte grande:** a grade cai para menos colunas sozinha (P114); os títulos quebram linha, sem `truncate` e sem altura fixa; o gráfico passa ao arranjo de duas linhas abaixo de 768 px de CSS. Nada rola na horizontal, a não ser, no limite, a tabela do ranking em 320 px com zoom.
- **Toque:** cada card com link tem cerca de 158 × 130 px em 360 px; as linhas do gráfico e o nome do casal têm pelo menos 44 px de altura; o espaço entre os cards é de 12 px.
- **Movimento:** com `prefers-reduced-motion`, sem o `animate-fade-in` da página e sem as transições de cor. As barras nunca animam.

### Critérios de UX
Numeração própria deste spec. "Hoje" é a terça-feira, 24/11/2026, às 21:00 de Brasília, como nos Critérios de aceite.

| ID | Critério | Como verificar |
|---|---|---|
| UX-01 | Rita, hoje, em 360×800: o `h1` "Dashboard"; os `h2` "Esta semana (22/11 - 28/11)", "Geral" e "Células por G12", nessa ordem; o `h3` "Relatórios de células" dentro de "Esta semana", depois dos cards. "Esta semana" mostra, nesta ordem, Relatórios enviados 2, Células com relatório pendente 1, Visitantes em células 8, Novos membros 1 e Novas células 1, sem "Células não realizadas". "Geral" mostra, nesta ordem, Total de membros 22, Membros ativos 21, Membros inativos 1, Batizados e Não batizados (quando maiores que zero), Sem liderança 1, Sem vínculo celular (quando maior que zero), Células evangelísticas 3, Células de discipulado 2 e Macrocélulas 1. O DOM não tem "Esta Semana", "Relatórios Enviados", "Células sem Relatório", "Células Discipulado", "Células Macrocélula", "Discipuladoras", "Celulas", "cadastrad", "Status", "Cancelad", "Atrasado" nem "Erro ao carregar o dashboard". | teste E2E (massa) + teste de componente |
| UX-02 | Pedro, hoje: "Esta semana" com 5 cards, sem "Células não realizadas"; "Geral" sem "Sem liderança" e sem "Macrocélulas". No domingo, 29/11, às 00:00: "Esta semana" com exatamente 3 cards, todos com 0, e sem o gráfico. Ester, hoje: "Geral" com Total de membros 3, Membros ativos 3, Sem liderança 1 e Células evangelísticas 1, além dos cards de batismo e de vínculo maiores que zero. O card escondido não deixa vaga no meio da grade. | teste E2E (massa, relógio do servidor) |
| UX-03 | A grade tem 1 coluna em 320×640, 2 em 360×800, 3 em 768×1024, 4 em 1024×768, 6 em 1280×800 (a "Esta semana" de Rita numa linha só) e 7 em 1440×900. Os cards de uma linha têm a mesma altura, e os números ficam na mesma base. Nenhuma largura rola na horizontal. Em 360×800, com o atalho "Novo relatório" à vista, o card "Células com relatório pendente" aparece sem rolar. | teste E2E (viewport, medida) |
| UX-04 | Rita, hoje: todo card maior que zero é um `a` com o `href` da tabela de Links, com as datas 2026-11-22 e 2026-11-28; a linha "Não houve célula" (0) do gráfico não é link. Pedro: "Células com relatório pendente" (0) é um `div`, sem seta e fora do Tab. Variação "Painel" de Carla: só "Relatórios enviados", "Visitantes em células" e a linha "Célula realizada" são links; "Total de membros", "Membros ativos", "Células evangelísticas" e "Células de discipulado" aparecem sem link e sem seta. Nenhum card sem link tem hover, `cursor-pointer` ou `tabindex`. | teste de componente + teste E2E (massa) |
| UX-05 | O card com link é um alvo só (em 360 px, cerca de 158 × 130 px), com o anel de foco em volta do card inteiro ao chegar pelo Tab e a seta `aria-hidden`. O nome acessível é "{Título}: {número}, ver na lista de {Lista}", por exemplo "Novos membros: 1, ver na lista de Membros". Enter abre a lista. | teste de componente + inspeção |
| UX-06 | Rita, em 360×800, rola até "Geral" e toca em "Membros inativos": abre `/members?status=inactive`, com uma entrada nova no histórico. O voltar do navegador devolve o Dashboard na mesma posição de rolagem, sem `Skeleton`, com o foco no card "Membros inativos". Com o navegador em `Europe/Lisbon`, à 01:00 de domingo, 29/11, em Lisboa, o título e os links continuam com 22/11 a 28/11. | teste E2E (`timezoneId`) |
| UX-07 | Pedro, hoje: o card de pendentes (0) com `bg-success/10`, o `CheckCircle2` e sem a barra lateral. Na quarta, 25/11, às 21:00: 1, com `bg-warning/10`, `border-l-4 border-l-warning` e o `TriangleAlert`. Rita, hoje: "Sem liderança" com o tom de aviso e a barra. No domingo, 29/11, às 10:00: "Visitantes em células" (0) neutro. Os demais cards são neutros, com o ícone em `text-muted-foreground`. Nenhum card e nenhuma parte do gráfico usa `destructive`. O código do Dashboard não tem `orange-`, `blue-`, `pink-`, `red-` nem cor em hex. | teste de componente + inspeção |
| UX-08 | Contraste de 4,5:1 para os títulos, os números, a legenda do gráfico e o ranking, nos tons neutro, aviso e sucesso, nos temas claro e escuro. O título dos cards de aviso e de sucesso usa `text-foreground`. O axe não aponta violações nos dois temas. | inspeção (axe, dois temas) |
| UX-09 | Rita, hoje: o gráfico tem o título "Relatórios de células", a legenda e três linhas, nesta ordem: o badge "Célula realizada" (`success`, `CheckCircle2`) com 2, "Não houve célula" (`muted`, `CalendarX`) com 0 e "Pendente" (`warning`, `TriangleAlert`) com 1. A barra de "Célula realizada" ocupa a área toda da barra, a de "Pendente", a metade, e "Não houve célula" não tem barra, mas tem a mesma altura das outras linhas. "Célula realizada" abre `/cell-reports?from=2026-11-22&to=2026-11-28&held=yes`, e "Pendente", `/cells?report_status=pending`. "Pendente" é sempre igual ao card de pendentes. No domingo, 29/11, às 00:00, o gráfico não está no DOM. A página não tem abas nem gráfico em SVG (só os ícones são SVG), e a rede não mostra o Recharts nem outro arquivo de gráfico. | teste de componente + teste E2E (rede) |
| UX-10 | Em 360×800, cada linha do gráfico tem o badge e o número na mesma linha e a barra embaixo; a partir de 768×1024, badge, barra e número numa linha só, com o card até `max-w-3xl`. Cada linha com link tem pelo menos 44 px de altura. Os números das três linhas ficam alinhados à direita, também na linha sem link. Numa captura em escala de cinza, as três partes se distinguem pelo texto e pelo ícone. O leitor de tela lê "Relatórios de células", a legenda, "lista, 3 itens" e "Célula realizada: 2, ver na lista de Relatórios, link"; as barras não são lidas. | teste E2E (viewport) + teste de componente + inspeção |
| UX-11 | Com as consultas atrasadas, a tela mostra só o cabeçalho, "Esta semana" com 3 cards (os títulos e o `Skeleton` nos números; o de pendentes neutro e sem ícone) e "Geral" com 2 cards, sem `Skeleton` de gráfico, de card condicional ou de ranking. Um observador do DOM registra que, da primeira exibição até o fim da carga, nenhum card, gráfico ou seção é removido. Com os tipos chegando 2 s depois dos números de membros, os cards condicionais de "Geral" aparecem juntos. Cada seção em carga tem `aria-busy="true"` e um "Carregando…" em `role="status"`. | teste de componente (consultas simuladas com atraso) + teste E2E (rota atrasada) |
| UX-12 | Carla envia, pelo "Novo relatório", na quarta, 25/11, às 21:30, o relatório de C1 com 2 visitantes: o diálogo fecha, o toast aparece e o foco volta a "Novo relatório". Enquanto os números recarregam, os cards e o gráfico continuam à vista, com `opacity-60` e `aria-busy`, sem `Skeleton`. Depois, "Relatórios enviados" e "Visitantes em células" contam o envio, e o gráfico tem uma "Célula realizada" a mais e um "Pendente" a menos. Rita exclui R9 em Relatórios e abre o Dashboard: o primeiro número de "Relatórios enviados" exibido é 1. | teste E2E |
| UX-13 | Com a consulta dos números falhando, "Esta semana" e "Geral" mostram os textos de erro da tabela de Textos e "Tentar de novo" (44 px de altura no celular), sem nenhum card. Um toque refaz só essa consulta. Só os tipos falhando: os cards de membros aparecem, com o erro dos tipos abaixo. Só o ranking falhando: a seção "Células por G12" com o erro. Na primeira carga, nenhum `role="alert"`; depois de "Tentar de novo" falhar, `role="alert"`. Uma atualização depois de gravar que falha troca os números pelo erro. Nenhum texto técnico aparece. | teste de componente (rede simulada) |
| UX-14 | Samuel, hoje: "Pedro & Paula" e "Tiago & Tânia", cada um com o nome como link para `/cells?g12=<id>,<id>&status=active` e a seta no Total. Tocar no número de "Homens" da linha de Pedro & Paula abre a mesma lista. Uma linha com Total 0 não é link e não reage ao toque. O nome acessível é "Pedro e Paula: 2 células, ver na lista de Células", e a legenda "Células ativas por casal G12, do maior total para o menor." está no DOM. Não há `bg-blue-*`, `bg-pink-*`, `text-blue-*` nem `text-pink-*`. Em 360×800, com nomes de 30 caracteres, a tabela não rola na horizontal. A variação "Painel" de Carla não tem a seção. | teste de componente + teste E2E |
| UX-15 | O leitor de tela encontra os títulos em ordem (`h1`, `h2`, `h3`), lê cada grade como "lista, N itens", lê o título da semana como "Esta semana, de 22/11 a 28/11" e não lê os ícones, as setas nem as barras. Os títulos dos cards não são `h3`. | teste de componente + inspeção (leitor de tela) |
| UX-16 | Em 320×640, com zoom de 200% em 1280×800 e com a fonte do sistema em 130%, os títulos dos cards quebram linha sem corte, os números "1.234" e "20.000" cabem no card, a grade cai para menos colunas e o gráfico passa ao arranjo de duas linhas. Nada rola na horizontal, a não ser a tabela do ranking em 320 px com zoom. | teste E2E (viewport) + inspeção |
| UX-17 | Com `prefers-reduced-motion: reduce`, a página não tem o `animate-fade-in`, os cards e as linhas não têm transição de cor, e as barras nunca animam. | teste E2E (emulação) + inspeção |
| UX-18 | As UX-12, UX-13 e UX-14 do E2.02 continuam passando: o subtítulo e o selo de Rita, de Pedro e da função sem visibilidade; o sem acesso de Hugo e da conta sem cadastro, sem card nem `Skeleton`; e o atalho com 44 px e a largura toda no celular. | testes do E2.02 |

### Perguntas para o `architect` (dados e contrato)
Em cada uma, a tela tem um comportamento padrão, o mais conservador, se a resposta for "não", menos onde está dito que não há.

- **AQ-1. Acesso às listas para os links** (RN-13, P110). O número abre a lista se a pessoa tem a lista no menu: o `canSeeRoute(access, "/members")` (e `/cells` e `/cell-reports`) do E2.02, sobre o `my_access()`. Enquanto o `my_access()` não chega, os cards ficam sem link; quando chega, a seta aparece sem mudar o tamanho do card.
- **AQ-2. Números prontos e ordem dos tipos** (RN-07, RN-08, RN-10, RN-12, RN-16). A tela espera do servidor, sem conta no front: o número de "Célula realizada", "Novos membros" e "Novas células", e os três tipos só com as ativas. A ordem dos tipos na tela é a da RN-16 (Evangelística, Discipulado, Macrocélula), por um código estável, e não a ordem alfabética do texto, que hoje põe "Discipulado" primeiro. Os títulos ("Células evangelísticas"…) vêm desse código.
- **AQ-3. Uma resposta para "Geral"** (P112). A seção espera os números de membros e os tipos para mostrar os cards condicionais de uma vez. Se os tipos entrarem na `dashboard_summary`, a espera some, e "Esta semana" e "Geral" chegam juntas.
  - *Padrão sem isso:* o front espera as duas consultas.
- **AQ-4. Ids do casal no ranking** (RN-13). O link precisa dos ids das pessoas do casal que contam no ranking (`g12=<id>,<id>`). Hoje a `dashboard_g12_ranking` devolve `couple_key`, `name` e `spouse_name`. Confirmar que ela passa a devolver os ids, ou que o `cellListHref` aceita o `couple_key`.
  - *Padrão sem isso:* não há; sem os ids, a linha fica sem link.
- **AQ-5. Datas dos links** (RN-13). A única fonte é o `week_start` e o `week_end` da `dashboard_summary`, passados ao `memberListHref`, ao `cellListHref` e ao módulo de Relatórios. "Visitantes em células" usa o mesmo link de "Relatórios enviados". A lista de Relatórios marca "Esta semana" ou "Semana passada" comparando com a data dela, também do servidor (P90).
- **AQ-6. Voltar com a posição e o foco** (UXD-7). O app usa `BrowserRouter`, sem `ScrollRestoration`. Proposta: reaproveitar o `use-list-return-focus` do E2.10 (AQ-8 de lá) com a chave do card. Ao tocar, grava o card e a rolagem em `sessionStorage`; ao montar o Dashboard numa volta (navegação POP) com os números no cache, restaura a rolagem (instantânea) e põe o foco no card (`preventScroll`), e apaga a chave. Carregando do zero, começa do topo. Confirmar qual elemento rola: a janela ou o `main` do `AppLayout`, que tem `overflow-auto`.
- **AQ-7. Atualizar sem piscar e sem número velho** (RN-17, P112, P44).
  - Com o Dashboard na tela, a atualização depois de gravar mantém os dados e recarrega (`invalidateQueries`), nunca `resetQueries`, que traria o `Skeleton` de volta e esconderia os cards condicionais.
  - Com o Dashboard fechado, `removeQueries`, como a DA-6 do E2.06.
  - Se a atualização depois de gravar falhar, a seção mostra o erro, e não os números de antes (RN-17). A atualização ao voltar para a aba que falha mantém os números (E1.08).
- **AQ-8. Sem biblioteca de gráfico** (P113). As barras são `div`, e a largura é calculada no front a partir dos três números do servidor: é só apresentação, sem contagem de negócio. O Dashboard não importa o `chart.tsx` nem o Recharts.
- **AQ-9. "Tentar de novo"** refaz só as consultas que falharam (o `refetch` de cada uma), sem recarregar a página.
- **AQ-10. Testes do E1.08 que mudam:** o `Dashboard.test.tsx` (os 4 `role="status"`, os `Skeleton` dos tipos e do ranking, a mensagem "Erro ao carregar o dashboard.") e o `e2e/dashboard.spec.ts` (os títulos). Mudam junto com a tela.

### Pendências para o PO (resolvidas em 2026-11-24)
Nenhuma bloqueia o desenho. Em todas, a UX adotou a opção marcada como "*Adotado*". O PO resolveu as oito em 2026-11-24, sem perguntas ao usuário, todas com o padrão da UX. Elas viraram os padrões P-DSH-14 a P-DSH-21 do Negócio, que ajustou as RN-11, RN-12, RN-13, RN-15 e RN-17, os critérios dessas regras, os Textos de tela, as Telas que mudam, os Impactos no E2.10, os Pontos para o `architect` e as Perguntas em aberto. A P-DSH-06 mudou com a PO-UX-6. **Revisar no PR.**

- **PO-UX-1. O gráfico em HTML, sem a aba "Tabela"** (UXD-5, P113, T4). O Negócio diz "O formato segue o P83 do E2.10 (gráfico com tabela)".
  - *Adotado:* três linhas com o badge, o número e uma barra horizontal, em HTML, cada linha abrindo a sua lista. O P113 refina o P83 para gráficos de poucas partes: o número em texto, as partes distintas sem a cor, sem animação e com a altura reservada continuam; saem a aba "Tabela", o SVG e a biblioteca de gráfico.
  - *Alternativa (o P83 ao pé da letra):* as abas "Gráfico" e "Tabela" (`TabsList` com `h-11` e a largura toda no celular) acima de um gráfico do Recharts carregado por `React.lazy`, com o `Skeleton` da mesma altura. As partes do SVG não recebem foco, então o link de cada parte fica só na aba "Tabela", com o toque na barra como atalho. São um controle e 44 px a mais no celular, e o Recharts é baixado na tela inicial.
  - A pizza do legado também caberia, com o número de cada parte na legenda, mas as fatias só se distinguem pela cor, o que a RN-12 não permite.
  - **Resolvida: aceito o padrão da UX (P-DSH-14; RN-12).** Pesei contra a RN-12, que citava o P83. O que o P83 quer garantir continua: o número em texto, as partes distintas sem a cor, sem animação e sem nada que apareça para depois sumir. A aba "Tabela" só repetiria os três números que já estão em texto em cada linha. Sem ela, cada parte recebe foco e abre a sua lista, como a RN-13 pede, e a tela inicial não baixa biblioteca de gráfico. O que o legado entregava (as três partes, o número de cada uma ao lado do nome e o gráfico oculto com tudo zero) continua; muda só a forma, de pizza para barras. A RN-12 passou a descrever a forma (uma linha por parte, com nome, número e barra; zero sem barra; sem a aba "Tabela"), e o critério dela ganhou as barras, a ausência da aba e o foco das linhas. O P83 do E2.10 continua para gráficos com eixo de tempo ou várias séries (Impactos no E2.10).
- **PO-UX-2. A legenda do gráfico** (T4): "Células que ainda não precisam enviar o relatório desta semana não entram." †. Explica, na própria tela, por que a soma das partes é menor que o número de células (RN-12).
  - *Adotado.* *Alternativa:* sem legenda.
  - **Resolvida: aceito o padrão da UX (P-DSH-15; RN-12).** O texto é exato: as células "Ainda não ocorreu" e "Conta a partir da próxima semana" são as que ainda não precisam enviar o relatório. Entrou na RN-12, no critério dela e nos Textos de tela.
- **PO-UX-3. Cor só em três cards** (UXD-2, P111). O de pendentes (aviso ou sucesso), "Sem liderança" e "Sem vínculo celular" (aviso). Os outros ficam neutros e perdem as cores de ícone de hoje, inclusive o vermelho de "Membros inativos" e de "Células não realizadas". O aviso ganha uma barra na borda esquerda, e o card de pendentes troca o triângulo pelo ✓ quando zera, para a diferença aparecer também sem a cor (RN-15).
  - *Adotado.* Ciência.
  - **Resolvida: aceito o padrão da UX (P-DSH-16; RN-15).** É o que a RN-15 já dizia ("os demais cards ficam neutros"). A RN-15 ficou explícita: os ícones coloridos de hoje saem, inclusive em "Membros inativos" e em "Células não realizadas"; nenhum card de número usa o vermelho de erro; e o aviso aparece também sem a cor. O critério da RN-15 ganhou esses casos.
- **PO-UX-4. Ícones** (T3). "Novos membros" fica com o `UserPlus`, que hoje é de "Visitantes", e "Visitantes" passa ao `Handshake`; os três tipos passam ao `House`; "Células não realizadas" passa ao `CalendarX`, o ícone do badge "Não houve célula".
  - *Adotado.* Ciência.
  - **Resolvida: aceito o padrão da UX (P-DSH-17).** Os ícones são decorativos, e "Células não realizadas" passa a usar o mesmo ícone do badge "Não houve célula", o que reforça o vocabulário do sistema. Nenhuma regra muda.
- **PO-UX-5. Duas colunas de cards no celular** (UXD-3, P114). Hoje é uma. A rolagem cai à metade, e o card de pendentes fica à vista sem rolar.
  - *Adotado.* Ciência.
  - **Resolvida: aceito o padrão da UX (P-DSH-18).** O card de pendentes, o número mais importante da semana, fica à vista sem rolar no celular. Nenhuma regra muda.
- **PO-UX-6. O ranking** (UXD-6, T5). A linha inteira abre as células ativas do casal, inclusive o toque em "Homens" ou "Mulheres", que não filtram pelo sexo do líder (P-DSH-06). Os números perdem as pílulas azul e rosa.
  - *Adotado.*
  - *Alternativa:* só o nome do casal abre a lista, e as colunas "Homens" e "Mulheres" não reagem ao toque.
  - **Resolvida: aceito o padrão da UX (P-DSH-19, que muda a P-DSH-06; RN-11 e RN-13).** A linha é o item (o casal), como nas tabelas de Células e de Relatórios (P81), e no celular os números são alvos pequenos demais para ter comportamentos diferentes. A seta fica ao lado do "Total", o número que a lista repete, e a lista mostra os chips "G12" e "Situação: Ativa", sem sugerir que filtrou pelo sexo do líder. A P-DSH-06 dizia que "Homens" e "Mulheres" não abriam nada; passou a dizer que eles abrem a mesma lista do casal. A RN-11 e a RN-13 e os critérios delas ganharam o toque em "Mulheres" e a ausência das pílulas.
- **PO-UX-7. Voltar e atualizar** (UXD-7, T7).
  - Voltar de uma lista devolve a posição e o foco quando os números estão no cache. Carregando do zero, depois de uma gravação, a tela começa do topo.
  - Se a atualização depois de uma gravação falhar, a seção mostra o erro no lugar dos números, para nunca mostrar o número de antes (RN-17). Ao voltar para a aba, sem gravação, os números ficam, como hoje.
  - *Adotado.* Ciência.
  - **Resolvida: aceito o padrão da UX (P-DSH-20; RN-13 e RN-17).** O Dashboard é o ponto de partida: abrir um número, voltar e abrir o seguinte sem rolar de novo é o uso esperado da liderança. A RN-13 ganhou a volta na mesma posição, com o foco no número aberto, e o recomeço do topo depois de uma gravação. A RN-17 ganhou o detalhe do que se vê: com a tela aberta, os números de antes ficam marcados como em atualização, e nunca como atuais (P44); se a consulta depois de uma gravação falhar, a seção mostra o erro, e não o número de antes; sem gravação, a falha mantém os números. Os critérios das duas regras ganharam esses casos.
- **PO-UX-8. Textos definidos pela UX** (marcados com † em Textos): a legenda do gráfico; os destinos dos links e a semana para o leitor de tela; a legenda do ranking; as quatro mensagens de erro, no lugar de "Erro ao carregar o dashboard."; e os textos da T9, que só valem se a pergunta virar regra.
  - *Adotados.*
  - **Resolvida: aceito o padrão da UX (P-DSH-21; RN-17).** As mensagens de erro seguem o modelo das listas ("Não foi possível carregar … Verifique a conexão e tente de novo.") e dizem o que fazer. A legenda do gráfico e as mensagens de erro foram copiadas para os Textos de tela do Negócio, sem mudança, e "Erro ao carregar o dashboard." entrou em "Evitar". Os textos do leitor de tela e os da T9 ficam em "Textos" desta seção. As perguntas Q-1 a Q-6 continuam com o usuário.

## Solução técnica
_Seção do `architect`. Escrita em 2026-11-24, só como desenho: nada foi implementado. **O PR de banco (PR 1) começa depois do banco do E2.02, do E2.05, do E2.06 (PR 1), do E2.07 (PR 1), do E2.08 (PR 2) e do E2.09 (PR 1) em produção.** Os números e a aparência (PR 2) não esperam as listas. Os links de cada grupo (PR 3) esperam a lista correspondente em produção (ver [Implantação](#implantação)). O desenho parte do estado final desses passos, com os nomes que eles definem. Se um nome ou uma assinatura mudar lá, as tarefas 2 e 8 voltam ao `architect`._

_Conferido em 2026-11-24, só com leitura:_
- _na stack local `supabase_db_mci-e108-pr2` (E1.08 e PRs 1 e 2 do E2.01):_
  - _PostgreSQL 17.12;_
  - _os corpos de `dashboard_summary`, `dashboard_cells_by_type` e `dashboard_g12_ranking`. São os do E1.08: o E2.07 e o E2.09 ainda não estão aplicados aqui;_
  - _os privilégios das três (EXECUTE para `authenticated` e `service_role`, nenhum para `anon`) e que nada depende delas (`pg_depend` vazio; nenhum corpo em `public` ou `private` as cita);_
  - _a `cell_reports_view`, com `date`, `was_held`, `visitors_count` (pelo `cardinality` da lista) e `cell_deleted`;_
  - _numa transação só de leitura, como `authenticated` e com a sessão de um administrador, o corpo do ranking deste desenho:_
    - _as leituras pequenas da `members_view` dão os mesmos casais e nomes de hoje, e `g12_ids` traz os integrantes de nível 1 de cada casal;_
    - _na massa local, anterior ao E2.06, os totais gravados e o `g12_leader_id` da `cells_view` divergem: um G12 tem 516 células pela view e 0 pelos totais, e outro tem as do cônjuge somadas às dele. O ranking de hoje e a lista de Células mostrariam números diferentes para o mesmo casal. É o caso que a DA-1 elimina: o ranking passa a contar pela mesma coluna da lista. Com o E2.06, as duas fontes saem da mesma tabela, e a conferência (e) mostra se alguma linha muda na publicação;_
- _no `mci-connect` (`origin/main`, `4595daa`):_
  - _`Dashboard.tsx`, `use-dashboard.ts` e os testes deles, `lib/dashboard/week.ts`, `lib/format.ts` e `lib/errors.ts`;_
  - _`AppLayout.tsx`: o `main` tem `overflow-auto`, mas não tem altura limitada (o pai é `flex min-h-screen`). **Quem rola é a janela** (AQ-6);_
  - _`App.tsx`: `BrowserRouter`, sem `ScrollRestoration` (que só existe nos *data routers*) e sem nada que volte ao topo numa navegação nova;_
  - _quem desatualiza `["dashboard"]` hoje: `use-save-cell-report`, `use-cell-report-deletion`, `use-cell-deletion` e `use-member-deletion`, todos com `invalidateQueries` simples. `MemberForm` e `CellForm` ainda não (o E2.06 e o E2.08 trocam por `refreshAfterMemberWrite` e `refreshAfterCellWrite`);_
  - _`Dashboard.test.tsx`, `e2e/dashboard.spec.ts` e os pgTAP `e108_pr3`, `e201_03`, `e201_04` e `e201_05`, que leem as RPCs do Dashboard;_
- _nas dependências instaladas: TanStack Query 5.83 (a ação `error` mantém `state.isInvalidated`, e só a `success` o limpa), React Router 6.30 (`useNavigationType`) e `lucide-react` 0.462 (com `Handshake`, `HousePlus`, `CalendarX`, `Link2Off`, `TriangleAlert` e `CircleAlert`);_
- _nos specs: E1.08 (Pontos de extensão, metas), E2.01, E2.02 (`my_access`, `canSeeRoute`, `_dashboard_assert_access`, T9), E2.05, E2.06 (`g12_id`, ranking, `query-refresh.ts`, AQ-6), E2.07 (`members_list_count`, `sp_day_start`, `cell_links`, `leadership_status`, `memberListHref`), E2.08 (`cell_types()`, `cell-types.ts`), E2.09 (`cells_report_situation`, `sp_local`, `refreshAfterReportWrite`), E2.10 (`cells_list_count`, `cellListHref`, `use-list-return-focus`, `g12_leader_id`, `leader_gender`), E2.11 (Impactos) e E2.12 (Negócio, Navegação e rotas e AQ; a Solução técnica de lá está sendo escrita em paralelo)._

### Revisão das regras
Nenhuma RN voltou ao PO. As lacunas técnicas foram resolvidas pela leitura mais conservadora e estão em [Definidas pelo architect](#definidas-pelo-architect-revisar-no-pr). As perguntas Q-1 a Q-6 ficam com o usuário: o desenho segue os padrões adotados, e o custo de cada alternativa está em [Perguntas Q-1 a Q-6](#perguntas-q-1-a-q-6-padrão-e-custo-das-alternativas).

Casos de borda conferidos:
- **Fuso e virada da semana:**
  - a semana sai de `sp_local(now())` (E2.09);
  - "Novos membros" e "Novas células" comparam instantes, do início do domingo ao início do domingo seguinte em Brasília (`sp_day_start`, E2.07). Ana, cadastrada no sábado às 23:30 (02:30 UTC de domingo), fica na semana anterior, e Bruno, no domingo às 00:10, fica nesta;
  - as datas dos links são as do `week_start` e do `week_end` da resposta que está na tela, nunca as do aparelho;
  - os testes rodam com a sessão em UTC e em Asia/Tokyo, às 02:59:59 e às 03:00 UTC de domingo.
- **Casal:** cada pessoa conta uma vez nos cards de membros. No ranking, o casal é uma linha, e o link leva os integrantes de nível 1 (`g12_ids`). O cônjuge invisível nunca aparece: as duas pessoas vêm da `members_view` de quem consulta.
- **Inativo:**
  - Fábio continua com o Dashboard (E2.02);
  - o inativo conta em "Novos membros" e em "Membros inativos";
  - a célula inativa conta em "Novas células" e fica fora dos tipos e do ranking;
  - o G12 inativo não tem linha no ranking, e as células abaixo dele ficam fora de todas as linhas, como hoje.
- **Sem líder e pastor:** "Sem liderança" vem de `leadership_status` (E2.07), que nunca marca o pastor. A célula de pastor (C7) conta em "Macrocélulas" e fica fora do ranking (`g12_leader_id` nulo, E2.06).
- **Excluído:** nada lê as tabelas. Tudo vem das views, que já tiram os excluídos (E2.01). O relatório de célula excluída continua na `cell_reports_view` (RN-11 do E2.01).
- **Consolidado (futuro):** a flag entra no `WHERE` da `members_view`, e todos os números de membros herdam.
- **Concorrência:** o passo só lê. Não há escrita nova, trava, trigger nem política de RLS nova. Ver [Bloqueios e concorrência](#bloqueios-e-concorrência).
- **Volume:** os números novos são `FILTER`s nas passadas que o `dashboard_summary` já faz, mais uma passada pela `cells_view`. Ver [Desempenho](#desempenho).

Leituras técnicas. Nenhuma muda regra, mas o PO e o QA precisam saber delas:
1. **Uma foto por chamada.** Todos os números do `dashboard_summary` saem da mesma foto do banco e do mesmo "agora". O card de pendentes e a parte "Pendente" do gráfico são o mesmo campo. O ranking vem de outra chamada.
2. **O card e a lista são consultas separadas.** Uma gravação, ou um prazo do E2.09 que passa entre a leitura do Dashboard e a da lista, pode deixar os dois diferentes por um instante. A RN-13 compara "no mesmo momento" (leitura técnica 1 do E2.09; risco 5 do E2.10).
3. **O cache dura 5 minutos** (`gcTime` padrão do TanStack Query). Quem fica mais que isso numa lista volta para um Dashboard carregado do zero, do topo, como depois de uma gravação.
4. **`_at` continua só para os testes e a reconciliação.** Ele escolhe a semana da seção "Esta semana", inclusive "Novos membros" e "Novas células". "Geral" e o ranking são sempre o estado atual. A tela não navega entre semanas (P-DSH-01).
5. **Na janela entre o PR 1 e o PR 2**, a tela de hoje já mostra "Visitantes em Células" só com os relatórios de célula realizada. Os tipos continuam como hoje até o PR 2, porque a `dashboard_cells_by_type` não muda (DT-05).
6. **Voltar de uma lista com o cache** mostra os números na hora e consulta de novo em segundo plano (`staleTime` 0), com os números marcados como em atualização (`opacity-60`) até a resposta chegar.

#### Respostas aos pontos do PO (Pontos para o `architect`)
| Ponto | Resposta |
|---|---|
| 1. Uma fonte por número | Cada número é uma condição sobre a **mesma coluna da view e a mesma função** que o filtro da lista usa. A tabela [Uma regra por número](#uma-regra-por-número) mostra cada par. O ranking passa a contar pela própria `cells_view` (`g12_leader_id` e `is_active`, os do filtro G12 com "Situação: Ativa"), e não pelos totais da subárvore (DA-1). A igualdade é provada por pgTAP, por persona, contra as funções de total das listas (`e214_02`). |
| 2. Novos membros e novas células | `members_new` e `cells_new` no fim do `dashboard_summary`, com `created_at >= sp_day_start(week_start)` e `< sp_day_start(week_end + 1)`: o mesmo intervalo que os normalizadores do E2.07 e do E2.10 montam com a semana. O nulo ("data não registrada") nunca satisfaz a comparação. |
| 3. Visitantes, gráfico e tipos | Os visitantes somam `visitors_count` só dos relatórios com `was_held`. A parte "Célula realizada" vem pronta (`reports_held`). Os tipos vêm em três colunas (`cells_evangelistic`, `cells_discipleship`, `cells_macrocell`), só com as ativas, no próprio `dashboard_summary` (AQ-3). O gráfico é HTML. O front só calcula a largura das barras (`valor / maior`), que é apresentação (AQ-8). |
| 4. Links | O `week_start` e o `week_end` vêm da resposta que está na tela. Os links saem só do `memberListHref` (E2.07), do `cellListHref` (E2.10) e do módulo de filtros de Relatórios (E2.12). O acesso é o `canSeeRoute` sobre o `my_access()` (E2.02). O ranking devolve `g12_ids` (AQ-4). |
| 5. Atualização | Todas as gravações da RN-17 chamam uma das funções de `src/lib/query-refresh.ts` (tabela em [Front](#front)): as consultas inativas são removidas, e as ativas são invalidadas. Com o Dashboard aberto, os números de antes ficam marcados como em atualização. A falha depois de uma gravação aparece como erro: a consulta foi invalidada e a busca falhou (`isInvalidated`, DT-07). A volta com a posição e o foco é a AQ-6. |
| 6. Cards escondidos e carregamento | Uma consulta só alimenta "Esta semana" e "Geral". Os cards condicionais das duas seções aparecem juntos, quando ela responde, e nunca antes. Na primeira carga, só os cinco cards sempre à vista ficam com `Skeleton` (P112). |
| 7. Desempenho | `dashboard_summary` abaixo de 800 ms e no máximo 30 ms acima do tempo medido logo antes do PR 1. Ranking abaixo de 100 ms. Ver [Desempenho](#desempenho). Os índices de data de cadastro do E2.07 e do E2.10 servem às listas: o Dashboard já percorre o conjunto visível uma vez, e o número novo é um `FILTER` nessa passada. |
| 8. Ordem | PR 1 (banco) depois dos passos citados no topo; PR 2 (números e aparência) sem esperar as listas; PR 3 (links) com os grupos cujas listas já estão em produção; um PR pequeno por grupo que chegar depois; PR 4 (limpeza do banco) depois do promote do PR 2. Ver [Implantação](#implantação). |

#### Definidas pelo architect (revisar no PR)
Pontos que as RNs não respondem por inteiro. O `architect` adotou a leitura mais conservadora e coerente com elas. O usuário pode mudar qualquer um no PR.

| # | Ponto | Padrão adotado | Por quê |
|---|---|---|---|
| DA-1 | De onde o ranking conta as células | Das células visíveis (`cells_view`), ativas, pelo `g12_leader_id` de cada uma, com "Homens" e "Mulheres" pelo sexo do líder (`leader_gender`). Não lê mais os totais da subárvore (`members_view.male_cells` e `female_cells`). | A RN-01 diz que todo número conta só o que a pessoa vê, e a RN-13 pede o mesmo conjunto da lista. Para quem vê o ministério ou a igreja, o resultado é o mesmo da RN-06 do E2.06: o escopo é fechado para baixo, então todas as células abaixo de um G12 visível são visíveis. Só muda para quem vê só o próprio cadastro e é G12: hoje o ranking mostraria células que ele não vê. Com a RN-03 do E2.04 (sexo obrigatório), o Total é sempre Homens + Mulheres. |
| DA-2 | Ordem dos ids no link do ranking | A do nome na linha: o homem primeiro; com os dois do mesmo sexo, o de menor id. Só vão os integrantes de nível 1. O cônjuge de outro nível só dá o nome. | A tabela de Links fala dos "integrantes do casal que contam no ranking". A ordem faz o chip "G12: Pedro, Paula" da lista repetir a linha. |
| DA-3 | Quando a falha de uma atualização vira erro (RN-17) | Quando a consulta foi invalidada por uma gravação feita nesta aba e a busca seguinte falhou. A falha de uma consulta disparada pela volta para a aba, pela reconexão ou pela montagem mantém os números. | É o critério da RN-17. Uma gravação de outra pessoa, ou em outra aba, não é visível para a tela: ela aparece na consulta seguinte (P-DSH-12). |
| DA-4 | Quando a volta de uma lista restaura a posição e o foco (RN-13, UXD-7) | Só na navegação de volta (POP) e com os números já no cache no primeiro render. A posição guardada vale uma vez: é apagada na primeira montagem do Dashboard, de qualquer tipo. O clique com tecla modificadora (nova aba) não guarda nada. Se o item não estiver mais na tela, a rolagem volta, e o foco vai para o `h2` da seção. | Sem cache, o Dashboard carrega do zero, e a RN-13 manda começar do topo. Uma posição guardada que sobrasse levaria a pessoa a um lugar inesperado numa volta futura. |
| DA-5 | Rolagem numa navegação nova | Toda navegação nova (PUSH) para outra rota começa do topo, em todo o app (`ScrollToTopOnPush`). A troca só de parâmetros na mesma rota (filtros, consulta do E2.12) não mexe na rolagem. | A RN-13 abre a lista "no lugar do Dashboard". Hoje a nova tela herda a rolagem da anterior, e um link do fim do Dashboard (o ranking) abriria a lista no meio. O `ux-designer` confirma na revisão do PR 3. |
| DA-6 | Mudança do próprio acesso (função ou permissões) | Desatualiza os números como uma gravação: quando a impressão digital do `my_access()` muda (E2.02), `refreshAfterAccessChange` remove as consultas inativas e invalida as ativas de `["dashboard"]`, `["members"]`, `["cells"]` e `["cell_reports"]`. | A RN-17 não lista essa gravação, mas a RN-01 manda contar só o que a pessoa vê. Sem isso, um Dashboard em cache mostraria por um instante os números do escopo antigo como atuais. |

### Visão geral
Quatro partes:
1. **Banco (PR 1):**
   - `dashboard_summary` com seis colunas no fim: `reports_held`, `members_new`, `cells_new` e os três tipos só com as ativas. Os visitantes passam a contar só célula realizada;
   - `dashboard_g12_ranking` contando pela `cells_view`, com `g12_ids` no fim;
   - nada de tabela, coluna, view, trigger ou política nova.
2. **Front, números e aparência (PR 2):** o catálogo dos números num módulo só; os cards (P110, P111, P114); o gráfico em HTML (P113); o ranking sem pílulas; o carregamento sem cards que somem (P112); o erro por seção; a atualização depois de gravar.
3. **Front, links (PR 3 e, se preciso, um PR por grupo):**
   - cada número com o link da lista, pelo módulo de filtros dela;
   - o acesso pelo menu;
   - a volta com a posição e o foco;
   - a volta ao topo numa navegação nova.
4. **Limpeza (PR 4):** sai a `dashboard_cells_by_type`, que o front antigo ainda usa até o promote do PR 2.

### Uma regra por número
Cada número do Dashboard é a mesma condição, sobre a mesma coluna e com a mesma função, que o filtro da lista que ele abre. Os dois lados são escritos separados (o card numa passada só, a lista com o par normalizador e `WHERE` de cada passo), e a igualdade é provada pelo pgTAP `e214_02`, por persona, no mesmo instante. Chamar as funções de total das listas de dentro do `dashboard_summary` daria uma varredura da view por número (DT-01).

| Número | Coluna | Condição no card | Lista e filtro (mesma coluna) | Igualdade no `e214_02` |
|---|---|---|---|---|
| Relatórios enviados | `reports_sent` | `cell_reports_view`, `date` entre `week_start` e `week_end` | Relatórios, Período = a semana (`date` ≥ "De" e ≤ "Até") | total da lista do E2.12 com o Período |
| Visitantes em células | `visitors` | `sum(visitors_count)` com `was_held`, na semana | Relatórios, Período = a semana | soma dos visitantes mostrados nas linhas (`visitors_count` das linhas com `was_held`) |
| Células não realizadas e parte "Não houve célula" | `cells_not_held` | na semana, `NOT was_held` | Relatórios, Período + Reunião: Não houve célula | total da lista do E2.12 |
| Parte "Célula realizada" | `reports_held` | na semana, `was_held` | Relatórios, Período + Reunião: Célula realizada | total da lista do E2.12 |
| Células com relatório pendente e parte "Pendente" | `cells_pending` | `cells_report_situation(_at)` com `report_status = 'pending'` (E2.09) | Células, `report_status=pending` (`cells_view.report_status`, a mesma função) | `cells_list_count(_report_statuses => '{pending}')` |
| Novas células | `cells_new` | `cells_view.created_at` em [`sp_day_start(week_start)`, `sp_day_start(week_end + 1)`) | Células, `from` e `to` = a semana (`sp_day_start`, E2.10) | `cells_list_count(_created_from, _created_to)` |
| Novos membros | `members_new` | `members_view.created_at`, o mesmo intervalo | Membros, `from` e `to` = a semana (`sp_day_start`, E2.07) | `members_list_count(_created_from, _created_to)` |
| Total de membros | `members_total` | toda a `members_view` | Membros, sem filtro | `members_list_count()` |
| Membros ativos, Membros inativos | `members_active`, `members_inactive` | `is_active` | `status` | `members_list_count(_is_active => …)` |
| Batizados, Não batizados | `members_baptized`, `members_not_baptized` | `is_baptized` | `baptized` | `members_list_count(_is_baptized => …)` |
| Sem liderança | `members_without_leader` | `is_active` e `leadership_status = 'no_leadership'` (E2.07) | `status=active&leadership=no_leadership` | `members_list_count(_is_active => true, _leadership => '{no_leadership}')` |
| Sem vínculo celular | `members_without_cell_link` | `is_active` e `'none' = ANY (cell_links)` (E2.07) | `status=active&cell_link=none` | `members_list_count(_is_active => true, _cell_links => '{none}')` |
| Células evangelísticas, de discipulado, Macrocélulas | `cells_evangelistic`, `cells_discipleship`, `cells_macrocell` | `is_active` e `type` = o valor de `cell_types()` | Células, `type=…&status=active` | `cells_list_count(_types => ARRAY[tipo], _is_active => true)` |
| Ranking: uma linha | `total_cells`, `g12_ids` | `cells_view.is_active` e `g12_leader_id = ANY (g12_ids)` | Células, `g12=<ids>&status=active` | `cells_list_count(_g12_ids => g12_ids, _is_active => true)` |

O nome da função de total do E2.12 é o que a Solução técnica de lá fechar. Se a lista de Relatórios ficar no PostgREST sobre a `cell_reports_view`, o teste repete o mesmo filtro na view, com a sessão da persona.

### Modelo de dados e migrations

#### Ordem das migrations
Os nomes são sugestões; o timestamp é o do momento da criação.
- Cada arquivo é idempotente (`DROP … IF EXISTS` antes de `CREATE`, `DO` com guardas) e roda num banco zerado depois das migrations dos passos anteriores.
- As mensagens das guardas trazem só nomes de objetos, nunca dado pessoal. Os logs do GitHub Actions de um repositório público são públicos.
- Depois de cada PR de banco, regenere o `types.ts`.

| # | PR | Arquivo | Conteúdo | Estado depois dele |
|---|---|---|---|---|
| 1 | 1 | `<ts>_e214_01_dashboard_numbers.sql` | Guarda; `dashboard_summary` (DROP e CREATE, colunas novas no fim); `dashboard_g12_ranking` (DROP e CREATE, `g12_ids` no fim); privilégios; pós-condições. | O front de hoje continua funcionando: as colunas a mais são ignoradas, e "Visitantes em Células" passa a contar só célula realizada. |
| 2 | 4 | `<ts>_e214_02_drop_cells_by_type.sql` | Guarda; `DROP FUNCTION dashboard_cells_by_type()`. | Nenhum efeito: o front do PR 2 já não a chama. |

#### Os números (migration 1)
```sql
-- 0. Pré-requisitos. Falha cedo, sem mudar nada. As mensagens trazem só nomes de objetos.
DO $$
DECLARE
  _body text;
BEGIN
  IF to_regclass('private.member_hierarchy') IS NULL                              -- E2.06, PR 1
     OR to_regprocedure('public.sp_day_start(date)') IS NULL                       -- E2.07, PR 1
     OR to_regprocedure('public.cell_types()') IS NULL                             -- E2.08, PR 2
     OR to_regprocedure('public.sp_local(timestamptz)') IS NULL                    -- E2.09, PR 1
     OR to_regprocedure('public.cells_report_situation(timestamptz)') IS NULL      -- E2.09, PR 1
     OR EXISTS (
          SELECT 1
            FROM (VALUES ('public.members_view', 'created_at'), ('public.members_view', 'is_active'),
                         ('public.members_view', 'leadership_status'), ('public.members_view', 'cell_links'),
                         ('public.members_view', 'g12_level'), ('public.members_view', 'spouse_id'),
                         ('public.cells_view', 'created_at'), ('public.cells_view', 'type'),
                         ('public.cells_view', 'is_active'), ('public.cells_view', 'g12_leader_id'),
                         ('public.cells_view', 'leader_gender'),
                         ('public.cell_reports_view', 'was_held'), ('public.cell_reports_view', 'visitors_count')) c(rel, col)
           WHERE NOT EXISTS (SELECT 1 FROM pg_attribute a
                              WHERE a.attrelid = c.rel::regclass AND a.attname = c.col AND NOT a.attisdropped)) THEN
    RAISE EXCEPTION 'E2.14 depende do E2.06 (PR 1), do E2.07 (PR 1), do E2.08 (PR 2) e do E2.09 (PR 1).';
  END IF;
  IF pg_get_functiondef('public._dashboard_assert_access()'::regprocedure) ~ 'view_own_ministry_dashboard' THEN
    RAISE EXCEPTION 'E2.14 depende do PR 1 do E2.02 (_dashboard_assert_access só com view_dashboard).';
  END IF;
  -- O corpo vigente precisa ter as mudanças do E2.07 e do E2.09: este arquivo parte dele.
  _body := pg_get_functiondef('public.dashboard_summary(timestamptz)'::regprocedure);
  IF _body !~ 'cells_report_situation' OR _body !~ 'leadership_status' OR _body !~ 'cell_links' THEN
    RAISE EXCEPTION 'E2.14: o dashboard_summary vigente não tem as mudanças do E2.07 e do E2.09.';
  END IF;
  -- Uma coluna por tipo (DT-03): se a lista mudar, o desenho volta ao architect.
  IF public.cell_types() IS DISTINCT FROM ARRAY['Evangelística', 'Discipulado', 'Macrocélula'] THEN
    RAISE EXCEPTION 'E2.14: a lista de tipos de célula mudou; o dashboard_summary tem uma coluna por tipo.';
  END IF;
END $$;

-- 1. dashboard_summary. O retorno ganha colunas, e o CREATE OR REPLACE não muda o retorno:
--    DROP e CREATE, na mesma transação (sem janela). Nada depende da função (conferência d).
DROP FUNCTION IF EXISTS public.dashboard_summary(timestamptz);
CREATE FUNCTION public.dashboard_summary(_at timestamptz DEFAULT now())
RETURNS TABLE (
  week_start date, week_end date,
  reports_sent bigint, cells_pending bigint, visitors bigint, cells_not_held bigint,
  members_total bigint, members_active bigint, members_inactive bigint,
  members_baptized bigint, members_not_baptized bigint,
  members_without_leader bigint, members_without_cell_link bigint,
  -- E2.14, no fim (Pontos de extensão do E1.08):
  reports_held bigint,              -- RN-12: parte "Célula realizada"
  members_new bigint,               -- RN-07
  cells_new bigint,                 -- RN-08
  cells_evangelistic bigint,        -- RN-10: só as ativas, uma coluna por valor de cell_types()
  cells_discipleship bigint,
  cells_macrocell bigint)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  _local     timestamp   := public.sp_local(coalesce(_at, now()));
  _ws        date        := public.week_start(_local::date);
  _we        date        := _ws + 6;
  -- RN-07, RN-08: o intervalo que os filtros "Cadastrado(a) a partir de / até" montam com a
  -- semana (E2.07, E2.10): do início do domingo ao início do domingo seguinte, em Brasília.
  _new_from  timestamptz := public.sp_day_start(_ws);
  _new_until timestamptz := public.sp_day_start(_we + 1);
BEGIN
  PERFORM public._dashboard_assert_access();                                   -- RN-01 (E2.02)

  RETURN QUERY
  SELECT _ws, _we,
         rep.reports_sent, pend.cells_pending, rep.visitors, rep.cells_not_held,
         mem.members_total, mem.members_active, mem.members_inactive,
         mem.members_baptized, mem.members_not_baptized,
         mem.members_without_leader, mem.members_without_cell_link,
         rep.reports_held, mem.members_new, cel.cells_new,
         cel.cells_evangelistic, cel.cells_discipleship, cel.cells_macrocell
    FROM (
      -- RN-03, RN-05, RN-06, RN-12: relatórios visíveis da semana, inclusive os de célula excluída.
      SELECT count(*)                                                        AS reports_sent,
             count(*) FILTER (WHERE rv.was_held)                             AS reports_held,
             count(*) FILTER (WHERE NOT rv.was_held)                         AS cells_not_held,
             coalesce(sum(rv.visitors_count) FILTER (WHERE rv.was_held), 0)::bigint AS visitors  -- P-DSH-02
        FROM public.cell_reports_view rv
       WHERE rv.date BETWEEN _ws AND _we
    ) rep
   CROSS JOIN (
      -- RN-04: a RN-08 do E2.09, sem mudança.
      SELECT count(*) AS cells_pending
        FROM public.cells_report_situation(_at) s
       WHERE s.report_status = 'pending'
    ) pend
   CROSS JOIN (
      -- RN-08 e RN-10: uma passada pelas células visíveis (a excluída não está na view).
      -- Sem report_status: a junção da situação não roda (DT-06 do E2.09).
      SELECT count(*) FILTER (WHERE cv.created_at >= _new_from AND cv.created_at < _new_until) AS cells_new,
             count(*) FILTER (WHERE cv.is_active AND cv.type = 'Evangelística')               AS cells_evangelistic,
             count(*) FILTER (WHERE cv.is_active AND cv.type = 'Discipulado')                 AS cells_discipleship,
             count(*) FILTER (WHERE cv.is_active AND cv.type = 'Macrocélula')                 AS cells_macrocell
        FROM public.cells_view cv
    ) cel
   CROSS JOIN (
      -- RN-07 e RN-09: o corpo vigente (E1.08 com os dois FILTERs do E2.07), mais members_new.
      SELECT count(*)                                         AS members_total,
             count(*) FILTER (WHERE mv.is_active)             AS members_active,
             count(*) FILTER (WHERE NOT mv.is_active)         AS members_inactive,
             count(*) FILTER (WHERE mv.is_baptized)           AS members_baptized,
             count(*) FILTER (WHERE NOT mv.is_baptized)       AS members_not_baptized,
             count(*) FILTER (WHERE mv.is_active AND mv.leadership_status = 'no_leadership')
                                                              AS members_without_leader,
             count(*) FILTER (WHERE mv.is_active AND 'none'::public.member_cell_link = ANY (mv.cell_links))
                                                              AS members_without_cell_link,
             count(*) FILTER (WHERE mv.created_at >= _new_from AND mv.created_at < _new_until)
                                                              AS members_new
        FROM public.members_view mv
    ) mem;
END $$;
```
- **O corpo de partida é o de produção** (tarefa 1, item c). O texto acima mostra o resultado esperado com o E2.07 e o E2.09. Se o corpo vigente tiver outra diferença, ela fica, e a tarefa 2 a registra no PR.
- **Os nomes das colunas de `RETURNS TABLE` viram variáveis em plpgsql.** Toda coluna é qualificada pelo apelido, e `public.week_start(…)` é chamada pelo schema, como hoje.
- **Por que a data de cadastro não usa o índice:** a passada já percorre o conjunto visível inteiro para os outros números. O `FILTER` custa uma comparação por linha. Os índices `members_created_at_idx` (E2.07) e `cells_created_at_idx` (E2.10) servem às listas.
- **Os três literais dos tipos** estão presos a `cell_types()` pela guarda e pelo pgTAP, que confere uma coluna por valor da lista (DT-03).

#### O ranking (migration 1)
```sql
-- 2. dashboard_g12_ranking: o retorno ganha g12_ids no fim. DROP e CREATE.
--    A contagem passa a ser a do filtro "G12 + Situação: Ativa" da lista de Células (DA-1).
DROP FUNCTION IF EXISTS public.dashboard_g12_ranking();
CREATE FUNCTION public.dashboard_g12_ranking()
RETURNS TABLE (
  couple_key text, name text, spouse_name text,
  male_cells bigint, female_cells bigint, total_cells bigint,
  g12_ids uuid[])                 -- E2.14 (AQ-4): os integrantes de nível 1, na ordem do nome (DA-2)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
BEGIN
  PERFORM public._dashboard_assert_access();

  RETURN QUERY
  WITH g12 AS MATERIALIZED (
    -- Os G12 ativos e visíveis. "g12_level = 1" é leakproof: entra na view e usa o índice do E2.06.
    SELECT mv.id, mv.name, mv.spouse_id, coalesce(mv.gender = 'M', false) AS is_male
      FROM public.members_view mv
     WHERE mv.is_active AND mv.g12_level = 1
  ),
  spouse AS MATERIALIZED (
    -- O cônjuge só se for ativo e visível: nenhum id invisível sai daqui. Lido por id (pkey).
    SELECT mv.id, mv.name, mv.g12_level, coalesce(mv.gender = 'M', false) AS is_male
      FROM public.members_view mv
     WHERE mv.is_active
       AND mv.id = ANY (ARRAY(SELECT g.spouse_id FROM g12 g WHERE g.spouse_id IS NOT NULL))
  ),
  per_g12 AS MATERIALIZED (
    -- RN-11, RN-13, RN-18: as células visíveis e ativas de cada G12, pela mesma coluna do filtro
    -- G12 da lista (E2.10). Cada célula tem um g12_leader_id só: nenhuma conta duas vezes.
    SELECT cv.g12_leader_id AS g12_id,
           count(*) FILTER (WHERE cv.leader_gender = 'M') AS male_cells,
           count(*) FILTER (WHERE cv.leader_gender = 'F') AS female_cells,
           count(*)                                       AS total_cells
      FROM public.cells_view cv
     WHERE cv.is_active
       AND cv.g12_leader_id = ANY (ARRAY(SELECT g.id FROM g12 g))
     GROUP BY cv.g12_leader_id
  ),
  pairs AS (
    -- Uma linha por integrante de nível 1. A regra do nome é a do E1.08.
    SELECT CASE WHEN s.id IS NULL THEN g.id::text
                ELSE least(g.id, s.id)::text || '|' || greatest(g.id, s.id)::text END AS couple_key,
           CASE WHEN s.id IS NULL THEN false
                WHEN s.is_male <> g.is_male THEN s.is_male
                WHEN s.g12_level IS DISTINCT FROM 1 THEN false
                ELSE s.id < g.id END                                                 AS spouse_first,
           g.id, g.is_male, g.name, s.name AS spouse_name
      FROM g12 g
      LEFT JOIN spouse s ON s.id = g.spouse_id
  ),
  couples AS (
    SELECT p.couple_key,
           min(CASE WHEN p.spouse_first THEN p.spouse_name ELSE p.name END) AS name,
           min(CASE WHEN p.spouse_first THEN p.name ELSE p.spouse_name END) AS spouse_name,
           coalesce(sum(c.male_cells), 0)::bigint                          AS male_cells,
           coalesce(sum(c.female_cells), 0)::bigint                        AS female_cells,
           coalesce(sum(c.total_cells), 0)::bigint                         AS total_cells,
           array_agg(p.id ORDER BY p.is_male DESC, p.id)                   AS g12_ids     -- DA-2
      FROM pairs p
      LEFT JOIN per_g12 c ON c.g12_id = p.id
     GROUP BY p.couple_key
  )
  SELECT c.couple_key, c.name, c.spouse_name, c.male_cells, c.female_cells, c.total_cells, c.g12_ids
    FROM couples c
   ORDER BY c.total_cells DESC, c.name, c.couple_key;
END $$;
```
- **`couple_key` fica.** É a chave da linha no React e o contrato do E1.08. Ela já só tinha ids visíveis.
- **Casais com 0 células continuam** (o `LEFT JOIN`), sem link (T5).
- **A regra do nome é a do E1.08, com um ajuste:** o empate "o de nível 1 primeiro" usa `IS DISTINCT FROM 1`. O nível passou a aceitar nulo no E2.06 (sem liderança), e o `<> 1` de hoje deixaria um cônjuge sem nível passar na frente pelo id.
- **`male_cells` e `female_cells` da `members_view` deixam de ser lidos pelo Dashboard.** Continuam na view para Membros e Ministérios (E2.06).

#### Privilégios e pós-condições (migration 1)
```sql
-- 3. Os privilégios padrão do Supabase dão EXECUTE a anon em função nova de public.
REVOKE ALL ON FUNCTION public.dashboard_summary(timestamptz), public.dashboard_g12_ranking() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_summary(timestamptz), public.dashboard_g12_ranking()
  TO authenticated, service_role;

-- 4. Pós-condições: as duas invoker, com search_path fixo, EXECUTE para authenticated e não para
--    anon, e os retornos com as colunas do desenho, nesta ordem.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p
              WHERE p.oid IN ('public.dashboard_summary(timestamptz)'::regprocedure,
                              'public.dashboard_g12_ranking()'::regprocedure)
                AND (p.prosecdef OR p.proconfig IS NULL
                     OR has_function_privilege('anon', p.oid, 'EXECUTE')
                     OR NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')))
     OR (SELECT p.proargnames[2:] FROM pg_proc p WHERE p.oid = 'public.dashboard_summary(timestamptz)'::regprocedure)
        IS DISTINCT FROM ARRAY['week_start', 'week_end', 'reports_sent', 'cells_pending', 'visitors',
          'cells_not_held', 'members_total', 'members_active', 'members_inactive', 'members_baptized',
          'members_not_baptized', 'members_without_leader', 'members_without_cell_link', 'reports_held',
          'members_new', 'cells_new', 'cells_evangelistic', 'cells_discipleship', 'cells_macrocell']
     OR (SELECT p.proargnames FROM pg_proc p WHERE p.oid = 'public.dashboard_g12_ranking()'::regprocedure)
        IS DISTINCT FROM ARRAY['couple_key', 'name', 'spouse_name', 'male_cells', 'female_cells',
          'total_cells', 'g12_ids'] THEN
    RAISE EXCEPTION 'E2.14: modo de segurança, privilégios ou retorno das funções do Dashboard diferentes do desenho.';
  END IF;
END $$;
```
`proargnames` começa pelo parâmetro de entrada (`_at`) no `dashboard_summary`; por isso o `[2:]`.

#### Limpeza (migration 2, PR 4)
```sql
-- Só depois do promote do PR 2: o front de antes chama a função.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname IN ('public', 'private') AND p.prosrc ~ 'dashboard_cells_by_type'
                AND p.oid IS DISTINCT FROM to_regprocedure('public.dashboard_cells_by_type()')) THEN
    RAISE EXCEPTION 'E2.14: ainda há função citando dashboard_cells_by_type.';
  END IF;
END $$;
DROP FUNCTION IF EXISTS public.dashboard_cells_by_type();
```

#### Ajustes nos passos anteriores
| Objeto | Passo | Mudança | Motivo |
|---|---|---|---|
| `dashboard_summary` | E1.08, E2.07, E2.09 | DROP e CREATE: visitantes só de célula realizada; seis colunas no fim | RN-05, RN-07, RN-08, RN-10, RN-12 |
| `dashboard_g12_ranking` | E1.08, E2.06 | DROP e CREATE: contagem pela `cells_view`; `g12_ids` no fim; leituras pequenas da `members_view` | RN-11, RN-13; DA-1, DA-2 |
| `dashboard_cells_by_type` | E1.08 | Igual no PR 1; sai no PR 4 | DT-05 |
| pgTAP `e108_pr3_dashboard_rpcs` | E1.08 | A conta dos visitantes só com `was_held`; o ranking com `g12_ids` e a contagem pela `cells_view` (a soma das linhas igual às células ativas sob os G12 visíveis); os privilégios das duas funções recriadas. As asserções da `dashboard_cells_by_type` ficam até o PR 4. | RN-05, RN-11 |
| pgTAP `e201_04_cells_reports`, `e201_05_parity_dashboard` | E2.01 | "Evangelística" passa a `cells_evangelistic` (só as ativas); os visitantes só de célula realizada; o ranking por `g12_ids` em vez de `couple_key` quebrado | RN-05, RN-10 |
| pgTAP do E2.07, do E2.09 e do E2.10 que leem o Dashboard | E2.07, E2.09, E2.10 | Os que já existirem: no E2.10 (RN-21), os tipos com `_is_active => true` e as colunas novas, e o ranking pelos `g12_ids`. Os que ainda não existirem já nascem assim. | RN-10, RN-11 |
| `src/pages/Dashboard.test.tsx`, `src/hooks/use-dashboard.test.tsx`, `e2e/dashboard.spec.ts` | E1.08 | Reescritos no PR 2 (AQ-10) | Tela nova |
| `cellListHref` (`src/lib/cells/filters.ts`) | E2.10 | O link dos tipos leva `status=active`, se o E2.10 ainda não o fizer | RN-10; Impactos no E2.10 |

Nenhuma política de RLS muda.

### Desempenho
| Consulta | O que muda | Meta (volume do E1.08, mediana de 5 execuções, `EXPLAIN ANALYZE` no PR) |
|---|---|---|
| `dashboard_summary` | Três `FILTER`s novos nas passadas que já existem e uma passada pela `cells_view` (1.500 linhas, sem a situação) | Abaixo de 800 ms (E1.08) e no máximo 30 ms acima do tempo medido logo antes do PR 1, com o E2.07 e o E2.09 aplicados |
| `dashboard_g12_ranking` | Duas leituras pequenas da `members_view` (nível 1 pelo índice do E2.06, cônjuges pela `pkey`) e uma passada pelas células ativas dos G12 | Abaixo de 100 ms para quem vê a igreja inteira e para um G12 (hoje, 4 a 5 ms; meta do E2.06: 800 ms) |
| Primeira exibição | Duas RPCs em paralelo (antes, três) | — |

- **No plano do `dashboard_summary`**: a passada pela `cells_view` não chama `private.cell_report_situation` (só o `cells_report_situation` do card de pendentes chama).
- **No plano do ranking**: a `members_view` não é lida inteira. As duas leituras usam `member_hierarchy_g12_level_idx` e `members_pkey`.
- **Plano B, se o `dashboard_summary` passar da meta:** juntar a passada de tipos e de novas células à leitura que o `cells_report_situation` já faz. Isso exige uma variante *definer* do E2.09 que devolva também `type`, `is_active` e `created_at`. Volta ao `architect` antes.

### Bloqueios e concorrência
- **Só leitura.** Nenhuma trava, nenhuma escrita, nenhum trigger. As duas funções são `STABLE`: as consultas de dentro usam a foto do banco e o "agora" da chamada (leitura técnica 1).
- **Gravação durante a leitura:** a gravação confirmada aparece na consulta seguinte. Depois de uma gravação feita pelo app, o front descarta o cache ou consulta de novo (RN-17, DT-08).
- **Dois Dashboards abertos** (abas ou pessoas diferentes): cada um mostra a sua última consulta. A gravação numa aba não desatualiza a outra; a outra consulta de novo ao voltar a ficar visível (`refetchOnWindowFocus`).
- **Publicação:** o `DROP` e o `CREATE` das duas funções rodam na transação da migration. Uma chamada que chega no meio espera a transação e vê a função nova.

### Contratos (RPC, Edge Functions, colunas novas)
**`dashboard_summary(_at timestamptz DEFAULT now())`** (*invoker*, EXECUTE para `authenticated`): uma linha. As colunas de antes não mudam de nome, de tipo nem de ordem. `visitors` passa a somar só os relatórios de célula realizada. No fim:

| Coluna | Tipo | RN | Tela |
|---|---|---|---|
| `reports_held` | `bigint` | RN-12 | parte "Célula realizada" do gráfico |
| `members_new` | `bigint` | RN-07 | "Novos membros" |
| `cells_new` | `bigint` | RN-08 | "Novas células" |
| `cells_evangelistic` | `bigint` | RN-10 | "Células evangelísticas" |
| `cells_discipleship` | `bigint` | RN-10 | "Células de discipulado" |
| `cells_macrocell` | `bigint` | RN-10 | "Macrocélulas" |

**`dashboard_g12_ranking()`** (*invoker*, EXECUTE para `authenticated`): as colunas de antes, com a contagem da DA-1, e no fim `g12_ids uuid[]` (um ou dois ids, só de pessoas da `members_view` de quem consulta, na ordem do nome).

**`dashboard_cells_by_type()`**: sem mudança no PR 1; removida no PR 4. Nenhum código novo a chama.

**Edge Functions:** nenhuma.

**No `types.ts`:** as seis colunas entram em `dashboard_summary.Returns`, e `g12_ids: string[]` em `dashboard_g12_ranking.Returns`. `DashboardSummary` e `DashboardG12Couple` (`use-dashboard.ts`) continuam derivados dos tipos gerados, sem cast.

**Leitura no front:** duas RPCs, `["dashboard", "summary"]` e `["dashboard", "g12-ranking"]`. A chave `["dashboard", "cells-by-type"]` sai.

### Front
Segue o padrão dos passos anteriores: os componentes cuidam da tela, o acesso a dados fica nos hooks, e a regra de tela pura fica em `src/lib/`. O front não conta nada: só escolhe quais cards mostrar, o tom, o link e a largura das barras.

#### PR 2: números, aparência, gráfico e ranking (sem links)
- **Domínio puro, com Vitest, sem React nem Supabase:**
  - `src/lib/dashboard/cards.ts`, o catálogo dos números, num lugar só:
    - `type SummaryNumber = Exclude<keyof DashboardSummary, "week_start" | "week_end">`;
    - `WEEK_CARDS` e `GENERAL_CARDS`, na ordem da RN-16, cada um com o campo, a lista de destino (`"members" | "cells" | "cell_reports"`), a chave do ícone e a regra do tom;
    - `ALWAYS_VISIBLE` (RN-14) e `visibleCards(cards, summary)`;
    - `cardTone(number, value)`: `"warning"` em "Sem liderança" e "Sem vínculo celular"; no card de pendentes, `"warning"` acima de zero e `"success"` com zero; `"neutral"` nos outros (RN-15, P111);
    - `CHART_PARTS` (`held` → `reports_held`, `not_held` → `cells_not_held`, `pending` → `cells_pending`), `chartRows(summary)` (o valor e a razão `valor / maior`, zero sem barra) e `showChart(summary)` (RN-12);
    - os três cards de tipo levam o valor do tipo (`CellType` do `src/lib/cells/cell-types.ts`, E2.08). Um teste confere que eles cobrem `CELL_TYPES`, e outro, que todo `SummaryNumber` está num card ou numa parte do gráfico. Uma coluna nova sem lugar na tela, ou um tipo novo sem card, falha no `npm test`.
  - `src/lib/dashboard/texts.ts`: **todos** os textos deste spec, menos os badges do gráfico. Inclui os títulos (com `satisfies Record<…>` sobre o catálogo), a legenda, as quatro mensagens de erro, "Tentar de novo", "Carregando…" e os nomes acessíveis ("{Título}: {número}, ver na lista de {Lista}" e o do ranking, com "1 célula" e "{N} células").
  - Os badges do gráfico vêm dos módulos das listas, sem repetir texto: "Célula realizada" e "Não houve célula" do módulo de rótulos de Relatórios (`src/lib/cell-reports/`, E2.10 e E2.12), e "Pendente" do `src/lib/cells/report-status.ts` (E2.09).
  - `src/lib/dashboard/week.ts`: `formatWeekRange` (como hoje) e `formatWeekRangeSpoken` ("de 22/11 a 28/11"), sem `Date`.
  - `src/lib/dashboard/section-state.ts`: `sectionView({ hasData, isError, isFetching, invalidatedByWrite, retried })` →
    - `loading`: sem dados e sem erro;
    - `error`: sem dados e com erro, ou com dados, erro e `invalidatedByWrite` (RN-17, DA-3). Leva `retrying` (o botão fica ocupado durante a nova tentativa) e `announce` (`role="alert"` só quando "Tentar de novo" falhou, T7);
    - `ready`: com `updating` quando está buscando de novo (P44: `opacity-60` e `aria-busy`).
- **Hooks:**
  - `use-dashboard.ts`: `useDashboardSummary` e `useDashboardG12Ranking`, como hoje (`retryUnlessPermissionDenied`). Sai `useDashboardCellsByType`. Entra `useInvalidatedByWrite(queryKey)`: lê `queryClient.getQueryState(queryKey)?.isInvalidated` durante o render, que acontece de novo a cada mudança da consulta.
  - `src/lib/query-refresh.ts`: confere a tabela [Atualização](#atualização-rn-17) e acrescenta `refreshAfterAccessChange`, chamada pelo `use-access` (E2.02) quando a impressão digital muda (DA-6).
- **Componentes** em `src/components/dashboard/`:
  - `StatGrid` (P114): `ul role="list"`, `grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3 md:gap-4`;
  - `StatCard` (P110, P111, T3): o `li` com o card, um `Link` quando recebe `href` e um `div` quando não. Inclui o título em texto (não `h3`), o ícone `aria-hidden`, o número com `formatCount`, a seta só com link, o tom e o nome acessível em `sr-only`. Enquanto carrega, o número é `Skeleton`, e o card de pendentes fica neutro e sem ícone;
  - `DashboardIcon`: o mapa das chaves para os ícones do `lucide-react` (T3);
  - `WeekChart` (P113, T4): `figure`, `h3`, legenda, `ul` de três linhas, cada uma com o `StatusBadge` da parte, o número e a barra (`div aria-hidden`, largura em %, `min-width: 4px` quando o valor é maior que zero, sem trilho e sem animação). A linha recebe `href` e vira `Link`. **Não importa `@/components/ui/chart`** (AQ-8);
  - `G12Ranking` (T5): a tabela de hoje sem as pílulas e sem os ícones azul e rosa, com o Total em `font-semibold` e o `caption` `sr-only`. O nome recebe `href` (PR 3);
  - `SectionError` (T7): `Alert` com `CircleAlert`, o texto da seção e "Tentar de novo" (`outline`, `w-full h-11` no celular, `md:w-auto md:h-10`), que chama o `refetch` da consulta que falhou (AQ-9).
- **Página:** `src/pages/Dashboard.tsx` só compõe.
  - O cabeçalho, o sem acesso e o atalho são os do E2.02 (T9), sem mudança.
  - "Esta semana" e "Geral" usam o `sectionView` do resumo; "Células por G12", o do ranking. O ranking não aparece enquanto carrega (P112).
  - Uma `section` com `aria-labelledby` por seção. O título da semana mostra "(22/11 - 28/11)" `aria-hidden` e ", de 22/11 a 28/11" em `sr-only`.
  - O `animate-fade-in` ganha `motion-reduce:animate-none`.
- **Testes do E1.08 que mudam (AQ-10)** ficam neste PR: `Dashboard.test.tsx` (dois `role="status"`, sem `Skeleton` de tipos nem de ranking, as mensagens novas, os títulos), `use-dashboard.test.tsx` (sai o hook dos tipos) e `e2e/dashboard.spec.ts` (duas RPCs, os títulos, os tipos vindos do resumo, só os cards maiores que zero ou sempre à vista).

#### PR 3: links (e um PR por grupo que chegar depois)
- **`src/lib/dashboard/links.ts`** (puro, com Vitest):
  - `numberHref(number, week, access)`, `chartPartHref(part, week, access)` e `rankingRowHref(row, access)` devolvem o endereço ou `null`;
  - `null` quando o valor é zero (P-DSH-05), quando `canSeeRoute(access, "/members" | "/cells" | "/cell-reports")` é falso (E2.02, AQ-1), quando o `access` ainda não chegou, ou quando o grupo ainda não tem lista em produção;
  - os endereços vêm só dos módulos das listas: `memberListHref` (E2.07), `cellListHref` (E2.10) e o de Relatórios do E2.12. Nada de montar query string aqui;
  - a semana é sempre o `week_start` e o `week_end` da resposta que está na tela (RN-13, AQ-5). "Visitantes em células" usa o mesmo link de "Relatórios enviados";
  - **sem bandeira:** o grupo cuja lista ainda não está em produção não chama o módulo dela e devolve `null`. O PR do grupo só acrescenta os casos e os testes.
- **`cellListHref`:** o link dos tipos ganha `status=active` (RN-10), se o E2.10 ainda não o tiver feito, com o teste.
- **Volta com a posição e o foco (AQ-6, DA-4):**
  - `src/lib/navigation/return-position.ts` (puro): lê, grava e apaga `{ key, y }` no `sessionStorage`, por tela, e ignora valor inválido;
  - `src/hooks/use-return-position.ts`: `useReturnPosition(scope, { restorable })` devolve `remember(key)`. Os elementos têm `data-return-key`. Numa montagem com navegação `POP`, entrada guardada e `restorable`, chama `window.scrollTo({ top: y, behavior: "instant" })` e `focus({ preventScroll: true })` num `useLayoutEffect`. Em qualquer outro caso, apaga a entrada e, no `POP` sem cache, volta ao topo;
  - no Dashboard, `restorable` é "o resumo estava no cache no primeiro render", guardado num `useState` inicial. As chaves são o campo do card, `chart:<parte>` e `g12:<couple_key>`;
  - o `remember` vai no `onClick` do link e ignora o clique com tecla modificadora ou outro botão do mouse;
  - o `use-list-return-focus` do E2.10 passa a usar o mesmo `return-position.ts`, se já existir; senão, o E2.10 nasce sobre ele. Um armazenamento só.
- **`src/components/ScrollToTopOnPush.tsx`** (DA-5), dentro do `BrowserRouter` do `App.tsx`: numa navegação `PUSH` que muda o `pathname`, `window.scrollTo(0, 0)`. `POP` e `REPLACE` não mexem.
- **Linha do ranking (P81):** o nome é o `Link`, e o clique na linha navega para o mesmo endereço, ignorando a seleção de texto e o clique no próprio link. Usa o atalho de linha do P81 que o E2.10 tiver criado para `CellsTable`; se não houver, nasce em `src/hooks/use-row-link.ts` e o E2.10 o reaproveita.

#### Atualização (RN-17)
A regra que vale é a do E2.06 (AQ-6) e do E2.09 (DT-12), confirmada aqui: **`removeQueries({ queryKey, type: "inactive" })` e `invalidateQueries({ queryKey, refetchType: "active" })`, nunca `resetQueries`.** A AQ-3 do E2.09 pedia `resetQueries` ou `removeQueries`, e o E2.06 e o E2.09 escolheram `removeQueries` para as telas fechadas. Com o Dashboard aberto, o `resetQueries` traria de volta o `Skeleton` e esconderia os cards condicionais (P112, AQ-7).

| Gravação | Função (`src/lib/query-refresh.ts`) | Quem chama | Passo |
|---|---|---|---|
| Relatório enviado, alterado (inclusive pelo atalho "Novo relatório" do Dashboard), excluído ou restaurado | `refreshAfterReportWrite` | o diálogo e os hooks do E2.11, `use-cell-report-deletion` e `use-restore` | E2.09, E2.11, E2.01 |
| Célula cadastrada, alterada, inativada ou reativada | `refreshAfterCellWrite` | `use-cell-save` | E2.06, E2.08 |
| Célula excluída ou restaurada | `refreshAfterCellWrite` | `use-cell-deletion`, `use-restore` | E2.01, E2.06 |
| Membro cadastrado, alterado, excluído ou restaurado | `refreshAfterMemberWrite` | `MemberFormDialog`, `use-member-deletion`, `use-restore` | E2.06, E2.01 |
| Mudança do próprio acesso | `refreshAfterAccessChange` (novo) | `use-access` | E2.02; DA-6 |

As quatro incluem `["dashboard"]`. A tarefa 5 confere por busca que nenhuma gravação ainda usa só o `invalidateQueries` (os quatro hooks listados em "Conferido"). As que ainda não tiverem trocado passam a chamar a função do passo delas.

### Onde cada regra é imposta
| RN | Banco (constraint, RLS, trigger, RPC) | UI |
|---|---|---|
| RN-01 | `_dashboard_assert_access` (só `view_dashboard`, E2.02) nas duas RPCs, com 42501; as duas são *invoker* e leem só as views (escopo e excluídos) | Sem acesso, subtítulo, selo e atalho do E2.02 (T9) |
| RN-02 | `sp_local(now())` e `week_start` no `dashboard_summary`; `week_start` e `week_end` na resposta | O rótulo e as datas dos links vêm da resposta; nenhum `Date` |
| RN-03 | `reports_sent`: `cell_reports_view` com `date` na semana | Card |
| RN-04 | `cells_pending` pela situação do E2.09 | Card, tom e ícone (P111) |
| RN-05 | `visitors`: `visitors_count` só com `was_held` | Card, neutro com zero |
| RN-06 | `cells_not_held` | Card escondido com zero; parte do gráfico |
| RN-07 | `members_new`: `members_view.created_at` entre `sp_day_start` do domingo e do domingo seguinte; nulo fora; excluído fora (view) | Card escondido com zero |
| RN-08 | `cells_new`: o mesmo sobre a `cells_view`, ativas ou inativas | Card escondido com zero |
| RN-09 | As colunas da `members_view` (`is_active`, `is_baptized`, `leadership_status`, `cell_links`, E2.07) | Cards |
| RN-10 | `cells_<tipo>`: `is_active` e `type`; guarda sobre `cell_types()` | Três cards na ordem do catálogo |
| RN-11 | `dashboard_g12_ranking`: G12 ativos e visíveis, células visíveis e ativas por `g12_leader_id` (DA-1), `g12_ids` só da view | Tabela sem pílulas |
| RN-12 | `reports_held`, `cells_not_held` e `cells_pending` na mesma linha | `WeekChart`: ordem fixa, barras (apresentação), legenda, oculto com as três em zero |
| RN-13 | As mesmas colunas e funções do filtro de cada lista ([Uma regra por número](#uma-regra-por-número)); pgTAP de igualdade | `links.ts` pelos módulos das listas, `canSeeRoute`, zero sem link, semana da resposta, `use-return-position`, `ScrollToTopOnPush` |
| RN-14 | — | `ALWAYS_VISIBLE` e `visibleCards` |
| RN-15 | — | `cardTone`, P111; nenhum `destructive` |
| RN-16 | — | Ordem do catálogo; `texts.ts` |
| RN-17 | Cada chamada lê na hora; nada é guardado no banco | Funções de `query-refresh.ts`; `sectionView` com `isInvalidated`; `refetch` só da consulta que falhou |
| RN-18 | Situação do E2.09 (sete dias); ranking com cada célula uma vez (um `g12_leader_id` por célula) | — |
| RN-19 | Nada é migrado; `dashboard_summary(_at)` com a sessão de cada persona serve à reconciliação (E4.09) | — |

### Respostas às perguntas do UX (AQ-1 a AQ-10)
| # | Resposta |
|---|---|
| AQ-1 | **Sim.** `canSeeRoute(access, "/members" | "/cells" | "/cell-reports")` sobre o `my_access()`, num lugar só (`links.ts`). Sem o `access`, os números ficam sem link. Quando ele chega, a seta aparece na linha do número, que já tem a altura do número: o card não muda de tamanho. |
| AQ-2 | **Sim.** `reports_held`, `members_new`, `cells_new` e os três tipos só com as ativas vêm prontos do `dashboard_summary`. A ordem e os títulos vêm do catálogo (`cards.ts` e `texts.ts`), na ordem da RN-16, e não da ordem alfabética. O valor gravado do tipo (`cell_types()`, E2.08) é o código estável. |
| AQ-3 | **Sim.** Os tipos estão no `dashboard_summary`, e "Esta semana" e "Geral" chegam juntas. **Consequência para a UX:** os tipos não falham mais sozinhos. O caso "só os tipos falhando" do UX-13 e a mensagem "Não foi possível carregar as células por tipo…" deixam de existir; o erro de "Geral" cobre os tipos. A mensagem não entra no `texts.ts`, e o UX-13 é lido sem esse caso. |
| AQ-4 | **Sim.** `g12_ids uuid[]` no fim do ranking: os integrantes de nível 1, ativos e visíveis, na ordem do nome (DA-2). O cônjuge invisível nunca sai. O link é `cellListHref` com os dois ids e "Situação: Ativa". |
| AQ-5 | **Confirmado.** A única fonte é o `week_start` e o `week_end` da resposta exibida, passados aos três módulos. "Visitantes em células" usa o link de "Relatórios enviados". A marca do atalho em Relatórios é do E2.12, pela data do servidor. |
| AQ-6 | **Sim, com a janela.** Quem rola é a janela: o `main` do `AppLayout` tem `overflow-auto`, mas não tem altura limitada. `use-return-position` (DA-4) guarda o card e a rolagem no `sessionStorage` e restaura numa volta (`POP`) com o resumo no cache no primeiro render: a rolagem instantânea, o foco com `preventScroll`, e apaga a entrada. Do zero, o Dashboard começa do topo. Numa navegação nova, toda tela começa do topo (`ScrollToTopOnPush`, DA-5). Se o layout passar a rolar o `main`, o hook recebe o elemento; o E2E confere `window.scrollY`. |
| AQ-7 | **Sim.** As funções de `query-refresh.ts`: remover as inativas e invalidar as ativas, nunca `resetQueries`. Depois de gravar, os números de antes ficam com `opacity-60`. Se a busca falhar, a seção mostra o erro (`isInvalidated`, DA-3). Ao voltar para a aba, sem gravação, a falha mantém os números. |
| AQ-8 | **Sim.** As barras são `div`, com a largura `valor / maior` (mínimo de 4 px acima de zero). Nada do Dashboard importa `@/components/ui/chart` nem o Recharts; o teste de rede e o `npm run build` conferem. |
| AQ-9 | **Sim.** "Tentar de novo" chama o `refetch` da consulta que falhou. O resumo alimenta "Esta semana" e "Geral": um toque em qualquer um dos botões recarrega as duas. O ranking tem a sua. |
| AQ-10 | **Sim.** `Dashboard.test.tsx`, `use-dashboard.test.tsx` e `e2e/dashboard.spec.ts` mudam no PR 2, junto com a tela. |

### Perguntas Q-1 a Q-6: padrão e custo das alternativas
O desenho segue o padrão do Negócio. Nenhuma alternativa muda a estrutura: o catálogo, as duas RPCs e os componentes ficam.

| Pergunta | Padrão desenhado | Custo da alternativa |
|---|---|---|
| Q-1. Navegar entre semanas | Só a semana atual | **Médio, cerca de 3 dias.** O `dashboard_summary` já aceita `_at`; o front passa o fim da semana escolhida e guarda `?week=` na URL, com os botões e o título da T9. O card de pendentes de uma semana que acabou vale pela situação do E2.09 no fim dela (DA-7 de lá). O link desse card não tem equivalente na lista de Células, que filtra só a semana atual e até 4 semanas anteriores: o PO decide (T9). Os testes de momento fixo dobram. |
| Q-2. Cards com zero sempre à vista | Escondidos (P-DSH-08) | **Baixo, cerca de 0,5 dia, só no front.** `ALWAYS_VISIBLE` com todos, `Skeleton` em todos os cards, o P112 deixa de valer para eles, testes. |
| Q-3. Card de pendentes vermelho | Amarelo de aviso | **Baixo, cerca de 0,25 dia, só no front.** Um tom `danger` no `cardTone` e no P111, e os testes do UX-07. |
| Q-4. "Ainda não ocorreu" no gráfico | Três partes | **Baixo, cerca de 1 dia.** `cells_not_yet` no fim do `dashboard_summary` (os `not_yet` da mesma função do E2.09), a quarta parte no catálogo, o link `report_status=not_yet` do E2.10, a legenda nova e os testes. |
| Q-5. Card "Células inativas" | Não existe | **Baixo, cerca de 0,5 dia.** `cells_inactive` (`NOT is_active`) na passada de células, o card no catálogo, escondido com zero, e o link `status=inactive`. |
| Q-6. Dashboard de um G12 | Não existe | **Grande, cerca de 5 dias, e abre perguntas de negócio.** `_g12_ids` nas duas RPCs; células por `g12_leader_id`; relatórios pelo G12 do líder registrado (E2.12); membros pelo `g12_id` do E2.06. A lista de Membros não tem filtro de G12 (a Liderança do E2.07 é "abaixo de", sem a própria pessoa), então os cards de membros perderiam o equivalente na lista. O PO decide se a lista ganha o filtro. |

### Decisões técnicas
| # | Decisão | Motivo |
|---|---|---|
| DT-01 | **Uma regra por número:** cada card é a mesma condição, sobre a mesma coluna da view e com a mesma função, que o filtro da lista. A igualdade é provada por pgTAP por persona (`e214_02`). O `dashboard_summary` não chama as funções de total das listas. | Ponto 1. Chamar `members_list_count` e `cells_list_count` por número daria uma varredura da view por card (cerca de dez), contra uma passada hoje. |
| DT-02 | Os números novos e os tipos ficam no fim do `dashboard_summary` (DROP e CREATE), numa linha, numa foto e num "agora". | Pontos de extensão do E1.08; AQ-3: "Geral" chega de uma vez, e a parte "Pendente" é o card por construção. |
| DT-03 | Tipos em três colunas com nome, presas a `cell_types()` por guarda e por teste. | Tipadas no `types.ts`, sem `Json`. Um tipo novo já exige migration (`CHECK` do E2.08); a guarda faz ela voltar ao `architect`. |
| DT-04 | O ranking conta pela `cells_view` (`g12_leader_id`, `is_active`, `leader_gender`), devolve `g12_ids` e lê a `members_view` só no nível 1 e nos cônjuges. | DA-1 e AQ-4: o mesmo conjunto da lista, por construção; menos leitura. |
| DT-05 | A `dashboard_cells_by_type` fica igual no PR 1 e sai no PR 4, depois do promote do PR 2. | O front em produção a chama até o promote. Mudar a função no PR 1 só mexeria na tela que vai sair. |
| DT-06 | Front: o catálogo em `src/lib/dashboard/cards.ts`, os textos em `texts.ts`, os links em `links.ts` só pelos módulos das listas, o estado da seção em `section-state.ts`; os componentes em `src/components/dashboard/`; a página só compõe. | SRP; sem strings mágicas; o teste do catálogo aponta coluna ou tipo sem lugar. |
| DT-07 | "Falha depois de gravar" = erro com `QueryState.isInvalidated`. | RN-17 e DA-3, sem estado paralelo: a invalidação já é o registro da gravação. |
| DT-08 | Atualização pelas funções de `query-refresh.ts` (remover as inativas, invalidar as ativas), nunca `resetQueries`; `refreshAfterAccessChange` novo. | AQ-7; mesmo mecanismo do E2.06 e do E2.09; DA-6. |
| DT-09 | Volta: `use-return-position` (`sessionStorage`, `POP`, cache no primeiro render, rolagem da janela e foco com `preventScroll`) e `ScrollToTopOnPush` global. | AQ-6; o `BrowserRouter` não tem `ScrollRestoration`. |
| DT-10 | Gráfico em HTML, sem biblioteca. A largura das barras é apresentação. | P113, AQ-8. |
| DT-11 | Links por grupo, sem bandeira: o grupo sem lista em produção devolve `null`. | Ponto 8: os números vão antes, e o clique de cada grupo entra com a lista dele. |
| DT-12 | Quatro PRs (banco; números e aparência; links; limpeza), mais um PR pequeno por grupo de links que chegar depois. | Cada PR vai ao ar sozinho ([Implantação](#implantação)). |

### Riscos (concorrência, escala, segurança)
1. **Corpo de produção diferente do desenho.** O E2.07 e o E2.09 também mudam o `dashboard_summary`.
   - Mitigações: a guarda exige as mudanças dos dois; a tarefa 2 parte do corpo vigente (conferência c); nunca andar junto com outro PR que mexa no `dashboard_summary` ou no ranking.
2. **Coordenação com o E2.12,** que está em desenho:
   - o nome do módulo de filtros e da função de href de Relatórios;
   - a função de total da lista;
   - como a linha de "Não houve célula" deixa de mostrar visitantes. Se o E2.12 decidir isso no servidor (uma coluna que devolve nulo), o card passa a somar essa mesma coluna.
   - Mitigação: a tarefa 8 confere com a Solução técnica do E2.12 antes de ligar o grupo de Relatórios. O `e214_02` prova a igualdade.
3. **O ranking pode mudar na publicação** (DA-1):
   - para quem vê só o próprio cadastro e é G12, passa a contar só as células que ele vê;
   - onde os totais gravados não batem com o G12 das células (dado anterior ao E2.06, como na massa local), a linha passa a mostrar o que a lista mostra. A conferência (e) conta esses G12;
   - para os demais, o resultado é o mesmo. O pgTAP compara com os totais do E2.06 para quem vê o ministério e a igreja.
4. **`isInvalidated` é detalhe do TanStack Query** (público no tipo `QueryState`, conferido na 5.83). Uma atualização da biblioteca precisa reconferir; o teste do `section-state` com um `QueryClient` de verdade aponta a mudança.
5. **Rolagem da janela.** Se o layout passar a rolar o `main`, o `use-return-position` e o `ScrollToTopOnPush` param de funcionar sem erro. O E2E confere `window.scrollY` nos dois sentidos.
6. **`ScrollToTopOnPush` muda o comportamento de todo o app** (DA-5). Hoje a nova tela herda a rolagem da anterior. A revisão do `ux-designer` confere Membros, Células, Relatórios e Auditoria.
7. **Remoção da `dashboard_cells_by_type` antes do promote do PR 2** quebraria os tipos da tela em produção. O promote não protege disso: o PR 4 só entra com o PR 2 promovido (Implantação).
8. **Literais dos tipos no SQL.** Presos a `cell_types()` pela guarda e pelo teste; uma mudança na lista faz a migration seguinte falhar até voltar ao `architect`.
9. **Igualdade no mesmo momento** (leitura técnica 2): card e lista são consultas separadas; o teste compara na mesma transação, e o E2E compara a tela com as respostas do servidor.
10. **Tempo.** Uma passada a mais na `cells_view` e quatro `FILTER`s. Meta e plano B em [Desempenho](#desempenho).
11. **Advisor do Supabase:** nada novo. As duas funções continuam *invoker*.
12. **E2E sem controle do relógio do servidor.** Os critérios de momento fixo (sábado às 23:59, domingo às 00:00) são provados no pgTAP com `_at`; o E2E prova que a tela mostra o que o servidor devolveu, no momento real (DT-10 do E2.09).

### Dependências e impactos em outros passos
| Passo | Relação |
|---|---|
| E1.08 | As duas RPCs mudam o retorno (colunas no fim); a dos tipos sai no PR 4. Os testes do PR 3 de lá mudam ([Ajustes](#ajustes-nos-passos-anteriores)). |
| E2.01 | Os excluídos já saem pelas views. Os hooks de exclusão e de restauração chamam as funções de `query-refresh.ts`. |
| E2.02 | **Pré-requisito:** o PR 1 (`_dashboard_assert_access`, views) no banco, e o PR 5 (Dashboard T9) no front antes do PR 2. `canSeeRoute` decide os links; `use-access` chama `refreshAfterAccessChange` (DA-6). |
| E2.05 | **Pré-requisito:** a data de cadastro do servidor e o nulo do legado. |
| E2.06 | **Pré-requisito:** o PR 1 (`g12_level`, `g12_leader_id`). O ranking deixa de ler os totais da subárvore (DA-1). `query-refresh.ts` e as funções dele. |
| E2.07 | **Pré-requisito:** o PR 1 (`sp_day_start`, `leadership_status`, `cell_links`). Os links de Membros esperam o PR 3 de lá em produção e usam o `memberListHref`. |
| E2.08 | **Pré-requisito:** o PR 2 (`cell_types()`). O front usa `CELL_TYPES`. |
| E2.09 | **Pré-requisito:** o PR 1 (`cells_report_situation`, `sp_local`) e o PR 2 no front (card de pendentes e `refreshAfterReportWrite`) antes do PR 2 daqui. Os badges do gráfico vêm do `report-status.ts`. |
| E2.10 | Os links de Células esperam o PR 4 de lá em produção. `cellListHref` dos tipos com `status=active`. O teste da RN-21 de lá passa a usar as colunas novas. `use-list-return-focus` e o `return-position.ts` compartilham o armazenamento. O atalho de linha do P81 é reaproveitado no ranking. |
| E2.11 | O diálogo de relatório chama `refreshAfterReportWrite` (o atalho do Dashboard). Nada a mudar lá. |
| E2.12 | Os links de Relatórios esperam o front de lá em produção e usam o módulo de filtros de lá. A igualdade dos visitantes é a soma do que as linhas mostram (risco 2). |
| E4.09, E5.04 | A reconciliação roda `dashboard_summary(_at)` com a sessão de cada perfil e lista cada diferença com o motivo da RN-19. Nada a carregar. |
| Consolidação | A flag entra no `WHERE` da `members_view`, e os números de membros e o ranking herdam. |

**Mudanças nos documentos, no aceite** (o `product-owner` atualiza a matriz, a seção 3 e o Progresso; o `architect` atualiza o resto do `CLAUDE.md` na revisão final):
- **`CLAUDE.md`:**
  - **Matriz de paridade (PO):** "Dashboard semanal com cards clicáveis" em ✅.
  - **Lógica no banco:** `dashboard_summary` com `reports_held`, `members_new`, `cells_new` e os três tipos (só ativas), e os visitantes só de célula realizada; `dashboard_g12_ranking` pela `cells_view`, com `g12_ids`; sai a `dashboard_cells_by_type`.
  - **Front > Dashboard:** troca a lista de hoje pelos cards do catálogo (os que somem com zero, o tom só em três cards), o gráfico da semana em HTML, os links para as listas com a volta na mesma posição e o erro por seção. Na frase "Células, Relatórios, Dashboard e Ministérios ainda carregam tudo no cliente", sai o Dashboard.
  - **Armadilhas:**
    - sai o item do `WEEK_DAYS_MAP` (corrigido no PR 3 do E1.08);
    - no item do corte de 1000 linhas, sai "e no Dashboard (ranking G12 e 'sem vínculo')";
    - entra "cada número do Dashboard é a mesma condição, sobre a mesma coluna, que o filtro da lista que ele abre: mudou um, mude o outro (o pgTAP `e214_02` confere)";
    - entra "o retorno do `dashboard_summary` e do `dashboard_g12_ranking` só cresce no fim; mudar o retorno exige `DROP` e `CREATE`, com os grants";
    - entra "os tipos do Dashboard são três colunas presas a `cell_types()`: um tipo novo exige uma coluna nova";
    - entra "navegação nova (PUSH) começa do topo (`ScrollToTopOnPush`); tela que restaura a posição na volta usa `use-return-position`".
  - **Problemas conhecidos:** sai "O bug do `WEEK_DAYS_MAP` no Dashboard".
- **`docs/migracao.md` (PO):**
  - **3.6:** DSH-01 a DSH-06 em ✅. "Onde impor": DSH-01, "`_dashboard_assert_access` + views"; DSH-02 a DSH-04, "`dashboard_summary`"; DSH-03 (ranking), "`dashboard_g12_ranking`"; DSH-05, "UI (`links.ts`) + igualdade por pgTAP"; DSH-06, "UI".
  - **5.6:** a lista de diferenças esperadas da RN-19, com o motivo de cada uma, e a forma de rodar o `dashboard_summary(_at)` com a sessão de cada perfil.
  - **Progresso:** o E2.14 com o link do spec e o estado.
  - **E5.04:** o aviso à liderança sobre "Membros ativos", "Sem liderança", "Sem vínculo celular", "Células por tipo" e "Células com relatório pendente".

### Pontos de extensão
| Futuro | Onde muda |
|---|---|
| Q-1 a Q-6 | Ver [Perguntas Q-1 a Q-6](#perguntas-q-1-a-q-6-padrão-e-custo-das-alternativas). |
| Número novo no Dashboard | Uma coluna no fim do `dashboard_summary` (DROP e CREATE), uma entrada no catálogo, o texto, o link pelo módulo da lista e a linha no `e214_02`. |
| Tipo de célula novo | Coluna nova, guarda e catálogo (DT-03). |
| Cards de Escolas e da Consolidação | P110 a P114 e os componentes de `src/components/dashboard/`. |
| Outras telas que voltam na mesma posição | `use-return-position` com outro `scope`. |
| Consolidação | O `WHERE` da `members_view`. |

### Implantação
| PR | Ordem | Efeito no front em produção |
|---|---|---|
| 1 (banco) | Pré-requisitos do topo em produção; [conferência](#conferência-em-produção-tarefa-1) sem parada; nunca junto de outro PR que mexa nas funções do Dashboard; merge → "Deploy: banco" | "Visitantes em Células" passa a contar só célula realizada. O resto da tela de hoje fica igual. |
| 2 (front: números e aparência) | PR 1 em produção; front do E2.02 (PR 5) e do E2.09 (PR 2) na `main`; merge → promote | A tela nova, sem links. |
| 3 (front: links) | PR 2 na `main`; liga só os grupos cuja lista já está em produção: Membros (PR 3 do E2.07), Células (PR 4 do E2.10) e Relatórios (front do E2.12); merge → promote | Os números desses grupos passam a abrir as listas, com a volta na mesma posição. |
| 3b, 3c (front: um grupo cada) | Só se uma lista chegar depois do PR 3; a lista em produção; merge → promote | O grupo passa a ter links. |
| 4 (banco: limpeza) | **Depois do promote do PR 2**; merge → "Deploy: banco" | Nenhum. |

- O promote recusa rodar com migration pendente.
- **Rollback:**
  - o front volta pelo promote do commit anterior. O front do E1.08 continua funcionando com o banco do PR 1, enquanto o PR 4 não tiver rodado;
  - o banco volta com uma migration nova, que recria as duas funções com o retorno de antes (`DROP` e `CREATE`, com os grants). Antes do PR 4, a dos tipos ainda está lá; depois, ela é recriada junto. Nada é gravado, então não há dado a desfazer.

### Conferência em produção (tarefa 1)
SQL **só de leitura**, para o usuário rodar no SQL Editor do projeto `gkhnjhmgeceoaqeynhrj` (papel `postgres`) antes do "Deploy: banco" do PR 1. Nenhuma consulta devolve dado pessoal: só nomes de objetos, definições e contagens. As views filtram por `auth.uid()`, que é nulo no SQL Editor; por isso as contagens leem as tabelas.

```sql
-- E2.14 · Conferência em produção, só leitura. Não grava nada.

-- a. Pré-requisitos. Esperado: todos verdadeiros.
SELECT
  to_regclass('private.member_hierarchy') IS NOT NULL                          AS e206_hierarquia,
  to_regprocedure('public.sp_day_start(date)') IS NOT NULL                     AS e207_sp_day_start,
  to_regprocedure('public.cell_types()') IS NOT NULL                           AS e208_cell_types,
  to_regprocedure('public.sp_local(timestamptz)') IS NOT NULL                  AS e209_sp_local,
  to_regprocedure('public.cells_report_situation(timestamptz)') IS NOT NULL    AS e209_situacao,
  (SELECT count(*) = 6 FROM pg_attribute
    WHERE attrelid = 'public.members_view'::regclass AND NOT attisdropped
      AND attname IN ('created_at', 'is_active', 'leadership_status', 'cell_links',
                      'g12_level', 'spouse_id'))                               AS members_view_colunas,
  (SELECT count(*) = 5 FROM pg_attribute
    WHERE attrelid = 'public.cells_view'::regclass AND NOT attisdropped
      AND attname IN ('created_at', 'type', 'is_active', 'g12_leader_id', 'leader_gender'))
                                                                               AS cells_view_colunas,
  (SELECT count(*) = 3 FROM pg_attribute
    WHERE attrelid = 'public.cell_reports_view'::regclass AND NOT attisdropped
      AND attname IN ('date', 'was_held', 'visitors_count'))                  AS cell_reports_view_colunas,
  pg_get_functiondef('public._dashboard_assert_access()'::regprocedure)
    !~ 'view_own_ministry_dashboard'                                           AS e202_acesso,
  (SELECT d ~ 'cells_report_situation' AND d ~ 'leadership_status' AND d ~ 'cell_links'
     FROM pg_get_functiondef('public.dashboard_summary(timestamptz)'::regprocedure) d)
                                                                               AS e207_e209_no_resumo,
  NOT has_schema_privilege('authenticated', 'private', 'USAGE')
    AND NOT has_schema_privilege('anon', 'private', 'USAGE')                  AS private_fechado;

-- b. Só depois de (a) toda verdadeira. Esperado: verdadeiro.
SELECT public.cell_types() = ARRAY['Evangelística', 'Discipulado', 'Macrocélula'] AS tipos_do_desenho;

-- c. Corpos e retornos vigentes (base da migration; sem dado pessoal).
SELECT p.oid::regprocedure AS funcao, pg_get_function_result(p.oid) AS retorno,
       p.prosecdef AS definer, p.proconfig,
       has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated,
       has_function_privilege('service_role', p.oid, 'EXECUTE')  AS service_role
  FROM pg_proc p
 WHERE p.oid IN ('public.dashboard_summary(timestamptz)'::regprocedure,
                 'public.dashboard_g12_ranking()'::regprocedure,
                 'public.dashboard_cells_by_type()'::regprocedure);
SELECT pg_get_functiondef('public.dashboard_summary(timestamptz)'::regprocedure);
SELECT pg_get_functiondef('public.dashboard_g12_ranking()'::regprocedure);

-- d. Quem depende das funções. Esperado: nenhuma linha nas duas consultas.
SELECT d.classid::regclass AS catalogo, d.objid
  FROM pg_depend d
 WHERE d.refobjid IN ('public.dashboard_summary(timestamptz)'::regprocedure,
                      'public.dashboard_g12_ranking()'::regprocedure,
                      'public.dashboard_cells_by_type()'::regprocedure)
   AND d.deptype = 'n';
SELECT p.oid::regprocedure AS cita
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname IN ('public', 'private')
   AND p.prosrc ~ 'dashboard_(summary|g12_ranking|cells_by_type)'
   AND p.oid NOT IN ('public.dashboard_summary(timestamptz)'::regprocedure,
                     'public.dashboard_g12_ranking()'::regprocedure,
                     'public.dashboard_cells_by_type()'::regprocedure);

-- e. Dados que mudam algum número (só contagens; informa, não para).
SELECT
  (SELECT count(*) FROM public.members WHERE deleted_at IS NULL AND created_at IS NULL)  AS membros_sem_data_de_cadastro,
  (SELECT count(*) FROM public.cells   WHERE deleted_at IS NULL AND created_at IS NULL)  AS celulas_sem_data_de_cadastro,
  (SELECT count(*) FROM public.cells   WHERE deleted_at IS NULL AND NOT is_active)       AS celulas_inativas,
  (SELECT count(*) FROM public.cell_reports
    WHERE deleted_at IS NULL AND NOT was_held AND cardinality(visitors) > 0)             AS nao_houve_com_visitantes,
  (SELECT count(*) FROM public.cell_reports
    WHERE deleted_at IS NULL AND NOT was_held AND cardinality(visitors) > 0
      AND public.week_start(date) = public.week_start(public.sp_today()))               AS nao_houve_com_visitantes_nesta_semana,
  (SELECT count(*) FROM public.members WHERE deleted_at IS NULL AND gender IS NULL)      AS membros_sem_sexo,
  (SELECT count(*) FROM private.member_hierarchy h JOIN public.members m ON m.id = h.member_id
    WHERE m.deleted_at IS NULL AND m.is_active AND h.g12_level = 1)                      AS g12_ativos,
  (SELECT count(*) FROM private.member_hierarchy h
    WHERE h.total_cells <> h.male_cells + h.female_cells)                                AS totais_com_sexo_vazio,
  (SELECT count(*) FROM private.member_hierarchy h JOIN public.members m ON m.id = h.member_id
    WHERE m.deleted_at IS NULL AND m.is_active AND h.g12_level = 1
      AND h.total_cells <> (SELECT count(*) FROM public.cells c
                              JOIN private.member_hierarchy lh ON lh.member_id = c.leader_id
                             WHERE c.deleted_at IS NULL AND c.is_active AND lh.g12_id = h.member_id))
                                                                                        AS g12_com_ranking_diferente;

-- f. Volume.
SELECT (SELECT count(*) FROM public.members WHERE deleted_at IS NULL)      AS membros,
       (SELECT count(*) FROM public.cells WHERE deleted_at IS NULL)        AS celulas,
       (SELECT count(*) FROM public.cell_reports WHERE deleted_at IS NULL) AS relatorios;
```
**Parar e voltar ao `architect`:** (a) com algum falso; (b) falso; (d) com linhas. Em (a), um falso quer dizer que o passo citado ainda não está em produção: publicar o passo antes. Em (e), nada para: `nao_houve_com_visitantes` e as datas nulas são diferenças esperadas da RN-19, `membros_sem_sexo` ou `totais_com_sexo_vazio` maiores que zero indicam dado anterior ao E2.04, que não muda o Total do ranking (DA-1). `g12_com_ranking_diferente` conta os G12 cuja linha do ranking muda na publicação, porque o total da subárvore não bate com as células que a lista mostra pelo G12. Com o E2.06 em produção, o esperado é 0; um número maior vai como achado para o E2.06, sem parar a publicação.

### Verificações obrigatórias (para o QA)
**pgTAP** (`supabase/tests/database/e214_*.test.sql`, autocontidos, com `ROLLBACK`). A massa é a do Negócio (a do E2.12, com Bruno, Ana, C1 a C8, R3, R6, R9 e R10, e a variação "Painel" de Carla). O `created_at` e o histórico do E2.09 são ajustados como nos pgTAP do E2.05, do E2.09 e do E2.10. As consultas "pela API" rodam como `authenticated`, com `request.jwt.claims` de cada persona. "Hoje" é `_at = '2026-11-25 00:00:00+00'` (terça, 24/11, às 21:00 de Brasília).

- **`e214_01_numbers.test.sql`:**
  - estrutura: as duas funções *invoker*, com `search_path` fixo, EXECUTE para `authenticated` e `service_role` e não para `anon`; o retorno do `dashboard_summary` com as 19 colunas na ordem (e `_at`), e o do ranking com as 7;
  - RN-01: Hugo, a conta sem cadastro e Lia recebem 42501 nas duas; R3, Sara e C5 não contam em nada;
  - RN-02: o sábado às 23:59:59 (`02:59:59+00` de domingo) e o domingo às 00:00 (`03:00+00`) com os números do critério, com a sessão em UTC, em `America/Sao_Paulo` e em `Asia/Tokyo`;
  - RN-03 a RN-12: a tabela "Números de hoje" para Rita, Samuel, Pedro, Caio, Diego, Ester e Fábio, e os critérios de cada regra (o envio de C1 na quarta, a exclusão e a restauração de R9, a exclusão de C6 e de C7, Íris e Vera, Sara restaurada, C10, C2 inativada e excluída, C4 reativada);
  - RN-05: o relatório do legado de "Não houve célula" com 4 visitantes não soma;
  - RN-07 e RN-08: o membro e a célula com `created_at` nulo nunca contam, em nenhuma semana;
  - RN-11 e RN-18: o ranking de Samuel ("Pedro & Paula" 1, 1 e 2; "Tiago & Tânia" 1, 1 e 2), a soma das linhas igual a 4, `g12_ids` só com ids da `members_view` de cada persona, na ordem do nome (DA-2), o cônjuge invisível nunca sai, e a variação "Painel" sem linhas;
  - DA-1: para Rita, Samuel, Pedro e Diego, o Total de cada linha é igual à soma de `total_cells` (E2.06) dos integrantes de nível 1.
- **`e214_02_parity.test.sql`** (a igualdade da RN-13, no mesmo instante, para Rita, Samuel, Pedro, Diego, Ester e a variação "Painel" de Carla): cada linha da tabela [Uma regra por número](#uma-regra-por-número), com a massa montada relativa a `now()` para que cada número tenha pelo menos um item. Se a função de total de uma lista ainda não existir, as asserções daquele grupo usam `skip()` com o nome do passo. **A tarefa do PR que liga os links do grupo só fecha com o grupo sem `skip`.**
- **Volume:** as metas de [Desempenho](#desempenho), com o `EXPLAIN (ANALYZE, BUFFERS)` no PR, antes e depois da migration, na massa do E1.08 com o E2.06 e o E2.09.

**Concorrência:** nenhum cenário novo. O passo só lê.

**Vitest e testes de componente:**
- `cards.ts`: a ordem da RN-16; `visibleCards` para Pedro hoje e para todos no domingo às 00:00 (RN-14); o tom de cada card (RN-15); `chartRows` e `showChart`; o catálogo cobre todo `SummaryNumber` e todo `CELL_TYPES`;
- `texts.ts`: os títulos exatos e nenhum texto proibido ("Esta Semana", "Status", "Cancelad", "Atrasado", "Discipuladoras", "cadastrad", "Erro ao carregar o dashboard");
- `week.ts`, `section-state.ts` (a matriz inteira, inclusive a falha depois de gravar e a falha ao voltar para a aba), `links.ts` (cada endereço da tabela de Links, zero e sem acesso dão `null`, a semana vem da resposta) e `return-position.ts`;
- `query-refresh.ts` com um `QueryClient` de verdade: inativa removida, ativa recarregada, `isInvalidated` verdadeiro depois de uma busca que falha e falso depois de uma que dá certo;
- `StatCard`, `WeekChart`, `G12Ranking`, `SectionError` e `Dashboard` (UX-01, UX-02, UX-04, UX-05, UX-07, UX-09 a UX-15, com respostas simuladas e um observador do DOM para o UX-11).

**Playwright:** os critérios `UX-` de cada PR com a massa e o *smoke* de login. O relógio do servidor não é controlável: os critérios que dependem da hora comparam a tela com a resposta do servidor (DT-10 do E2.09). No PR 3, para cada persona, cada número abre uma lista cujo total (ou soma de visitantes) é o número; a volta pelo navegador restaura `window.scrollY` e o foco (UX-06, com `timezoneId: "Europe/Lisbon"`); a rede não baixa o Recharts (UX-09); axe nos dois temas (UX-08).

### Implementação do PR 1 (2026-11-28)
Migration `20261205100000_e214_01_dashboard_numbers.sql`, na `mci-connect` (branch `claude/e214-pr1`), com o `types.ts` regenerado (CLI 2.84.2, `__InternalSupabase` mantido; só as seis colunas e o `g12_ids`, sem ajuste no front).
- **Conferência do desenho** (na stack local da pista A, com as migrations da `main` até `20261204100100`; itens a, b e d da [conferência](#conferência-em-produção-tarefa-1)): tudo verdadeiro, e nada depende das três funções. O corpo vigente do `dashboard_summary` é o do E2.07 (`20261128100000`), sobre o do E2.09; o do ranking ainda é o do E1.08 (o E2.06 só o confere). `g12_id` de um G12 é ele mesmo, então as células que o próprio G12 lidera entram na linha dele, como no total da subárvore. Nenhuma pergunta de negócio.
- **Desvios do texto do desenho (sem efeito no contrato):** do corpo vigente ficam `cells_report_situation(coalesce(_at, now()))` e os *casts* dos enums (`'pending'::cell_report_status`, `'no_leadership'::member_leadership_status`); a guarda confere também `members_view.gender` e `cell_reports_view.date`; as duas funções ganharam `COMMENT`.
- **pgTAP existentes** (ajustados, **não rodados**, pela política de 2026-11-28): `e108_pr3` (visitantes só com `was_held` e os dois retornos com as colunas novas), `e210_01` (RN-21 do ranking pelos `g12_ids`) e `e212_01` (RN-18: soma dos visitantes só das linhas com `was_held`). Ficam para a rodada final: os `e214_01`/`e214_02` novos (tarefa 3), a revisão das outras asserções que leem o Dashboard (`e201_04`, `e201_05`, `e201_02`, `e206_03`, `e108_pr5`, `e202_*`) e as medidas de [Desempenho](#desempenho) com `EXPLAIN ANALYZE`.
- Conferido: a migration aplicada pela CLI e rodada de novo numa transação sem erro; as duas *invoker*, `search_path=public`, EXECUTE para `authenticated` e `service_role` e não para `anon`; as duas respondem para a sessão de um administrador. A [conferência em produção](#conferência-em-produção-tarefa-1) (tarefa 1) não foi rodada: fica com o usuário, antes do "Deploy: banco".

### Implementação do PR 2 (2026-11-28)
Na `mci-connect`, branch `claude/e214-pr2` (commits `c92bf3e` e `6516d04`), **com o PR 3 junto** (tarefas 4, 5 e 8): as três listas já estão na `main` (E2.07 PR 3, E2.10 PR 4, E2.12 PR 4), não há PR de banco entre os dois e o promote do PR 2 leva a `main` inteira, então os links vão ao ar com as listas. O PR 4 (limpeza) espera o promote deste.
- **Front:** o desenho do [Front](#front), sem mudança de contrato. `DashboardSummary` e `DashboardG12Couple` nascem em `src/lib/dashboard/cards.ts` (só tipo, do `types.ts`) e o `use-dashboard.ts` os reexporta, para o domínio puro não importar o hook. `useInvalidatedByWrite` como desenhado; o `sectionView` recebe `retried` pelo `errorUpdateCount` do toque em "Tentar de novo". `refreshAfterAccessChange` no `use-access`, que continua invalidando as outras consultas (sem as quatro raízes).
- **Desvios (sem efeito no contrato):**
  - `numberHref(card, summary, access)` e `chartPartHref(row, summary, access)` recebem o resumo (o valor e a semana da resposta); `rankingRowHref(row, access)` também devolve `null` sem `g12_ids`;
  - `useReturnPosition` devolve `remember(key, event?)` (o clique na linha do ranking guarda sem evento) e recebe `fallback(key)`, que leva o foco ao `h2` da seção (`returnKeySection`, DA-4);
  - `reportBadgeLabel(status)` novo em `src/lib/cells/report-status.ts`, para o "Pendente" do gráfico; "Célula realizada" e "Não houve célula" vêm do `HELD_LABELS`;
  - "Tentar de novo" ocupado com `aria-disabled` e `aria-busy`, sem `disabled`, para o foco não sair do botão;
  - o atalho de linha do P81 nasceu em `src/hooks/use-row-link.ts`, e o `CellsTable` passou a usá-lo; o `use-list-return-focus` passou a gravar no `return-position.ts` (escopo `cells`), num commit próprio.
- **Conferido:** `tsc` sem erro; `npm run build` verde, com o Recharts só no pedaço do `CellEvolutionChart`; `npm run lint` com os mesmos 3 erros e 8 avisos da `main` (shadcn e `tailwind.config.ts`), nenhum nos arquivos do passo; nenhum `orange-`, `blue-`, `pink-`, `red-`, hex, `destructive`, `ui/chart` nem `recharts` no Dashboard; nenhuma gravação usa só `invalidateQueries` para `["dashboard"]` e ninguém usa `resetQueries` (as gravações da tabela [Atualização](#atualização-rn-17) já chamam as funções do passo delas).
- **Escritos, não rodados** (política de 2026-11-28): Vitest de `cards`, `section-state`, `links`, `return-position` e `week`; `use-dashboard.test.tsx` e `Dashboard.test.tsx` reescritos; `e2e/dashboard.spec.ts` com as duas RPCs, os títulos e os cards com zero. Ficam para a rodada final: rodar tudo isso; os testes das tarefas 7 e 10 (UX-04 a UX-06, o observador do DOM do UX-11, o axe, o `dashboard-links.spec.ts` e a igualdade da RN-13 por persona); o `e214_02` sem `skip`; a revisão de UI das tarefas 6 e 9.

## Tarefas
_Seção do `architect`._

Quatro PRs no `mci-connect`, mais um PR pequeno por grupo de links que chegar depois do PR 3. **O PR 1 começa depois do banco do E2.02, do E2.05, do E2.06 (PR 1), do E2.07 (PR 1), do E2.08 (PR 2) e do E2.09 (PR 1) em produção.**
- Dentro do PR 1, a migration vem antes dos testes, e os tipos são regenerados antes do front.
- Cada desenvolvedor aciona o `code-reviewer` ao terminar a sua tarefa; esse passo não aparece na tabela.
- Na coluna RNs, os números são das regras deste spec. Na coluna UX, os dos critérios `UX-`.

| # | Responsável | Descrição | Arquivos | RNs | UX | Depende de |
|---|---|---|---|---|---|---|
| **PR 1: banco, números e ranking** | | | | | | |
| 1 | usuário | Rodar a [conferência](#conferência-em-produção-tarefa-1) em produção (só leitura) e devolver a saída. Uma linha de parada volta ao `architect`. | — | 01 a 12 | — | pré-requisitos do PR 1 em produção |
| 2 | backend-developer | Migration 1: guarda; `dashboard_summary` (DROP e CREATE, a partir do corpo vigente da saída c, com os visitantes só de célula realizada e as seis colunas no fim); `dashboard_g12_ranking` (DROP e CREATE, contagem pela `cells_view` e `g12_ids` no fim); privilégios; pós-condições. Regenerar o `types.ts`, com só os ajustes que o `tsc` apontar no front. Ajustar os pgTAP existentes ([Ajustes](#ajustes-nos-passos-anteriores)): `e108_pr3`, `e201_04`, `e201_05` e os do E2.07, do E2.09 e do E2.10 que já existirem. Medir antes e depois e anexar os `EXPLAIN ANALYZE` ao PR. | `supabase/migrations/<ts>_e214_01_dashboard_numbers.sql`, `src/integrations/supabase/types.ts`, `supabase/tests/database/{e108_pr3_dashboard_rpcs,e201_04_cells_reports,e201_05_parity_dashboard}.test.sql` | 01 a 12, 18 (banco) | dados de 01, 02, 09, 14 | 1 |
| 3 | qa | pgTAP novos `e214_01` e `e214_02` (com `skip` só nos grupos cuja lista ainda não tem função de total) e conferência das metas de volume ([Verificações](#verificações-obrigatórias-para-o-qa)). | `supabase/tests/database/e214_{01_numbers,02_parity}.test.sql` | 01 a 13, 18 | — | 2 (escreve em paralelo, a partir dos contratos) |
| **PR 2: front, números, aparência, gráfico e ranking (sem links)** | | | | | | |
| 4 | frontend-developer | Domínio puro, com Vitest: `src/lib/dashboard/cards.ts` (catálogo, `visibleCards`, `cardTone`, `chartRows`, `showChart`, cobertura de `SummaryNumber` e de `CELL_TYPES`), `texts.ts` (todos os textos, nomes acessíveis), `week.ts` (`formatWeekRangeSpoken`) e `section-state.ts` (`sectionView`). | `src/lib/dashboard/{cards,texts,week,section-state}.ts` e os `*.test.ts` deles | 02, 04 a 12, 14 a 17 | dados de 01, 02, 07, 09, 13, 15 | 2 (tipos) |
| 5 | frontend-developer | `use-dashboard.ts` (duas RPCs, sai a dos tipos, `useInvalidatedByWrite`); `src/components/dashboard/{StatGrid,StatCard,DashboardIcon,WeekChart,G12Ranking,SectionError}.tsx` (P110 a P114, T1 a T5, T7, com `href` opcional, ainda sem uso); `Dashboard.tsx` só compondo (seções com `aria-labelledby`, semana para o leitor de tela, `motion-reduce`); `refreshAfterAccessChange` em `query-refresh.ts`, chamada pelo `use-access` (DA-6); conferir por busca que toda gravação da tabela [Atualização](#atualização-rn-17) chama a função do passo dela. Reescrever `Dashboard.test.tsx`, `use-dashboard.test.tsx` e `e2e/dashboard.spec.ts` (AQ-10). | `src/hooks/{use-dashboard,use-access}.ts`, `src/lib/query-refresh.ts`, `src/components/dashboard/*`, `src/pages/Dashboard.tsx`, os testes citados | 01, 02, 12, 14 a 17 | 01 a 03, 07 a 13, 14 (sem link), 15 a 18 | 4; front do E2.02 (PR 5) e do E2.09 (PR 2) na `main`; o merge espera o PR 1 em produção |
| 6 | ux-designer | Revisão da UI do PR 2 (T1 a T5, T7, P110 a P114) em 320, 360, 768, 1024, 1280 e 1440 px, nos temas claro e escuro, com zoom de 200% e fonte grande. Confirmar a leitura do UX-13 sem o caso "só os tipos falhando" (AQ-3) e o botão ocupado durante "Tentar de novo". | — | — | 01 a 03, 07 a 13, 15 a 17 | 5 |
| 7 | qa | Testes de componente (UX-01, 02, 07, 09 a 13, 15; o observador do DOM do UX-11; a falha depois de gravar e a falha ao voltar para a aba com um `QueryClient` de verdade); Playwright (UX-01 a 03, 09 com a rede, 10, 12, 16, 17; UX-18 do E2.02); axe nos dois temas (UX-08). | `src/**/*.test.ts(x)`, `e2e/dashboard.spec.ts` | 01, 02, 12, 14 a 17 | 01 a 03, 07 a 13, 15 a 18 | 5 |
| **PR 3: front, links (os grupos com a lista em produção)** | | | | | | |
| 8 | frontend-developer | `src/lib/dashboard/links.ts` com Vitest (`numberHref`, `chartPartHref`, `rankingRowHref`; zero, sem acesso e grupo sem lista dão `null`; só pelos módulos das listas; conferir os nomes com o E2.07, o E2.10 e a Solução técnica do E2.12); `cellListHref` dos tipos com `status=active`, se faltar; `src/lib/navigation/return-position.ts` e `src/hooks/use-return-position.ts` (DA-4); `src/components/ScrollToTopOnPush.tsx` no `App.tsx` (DA-5); o atalho de linha do P81 no ranking (reaproveitado do E2.10, ou `src/hooks/use-row-link.ts`); o Dashboard passando os `href` e o `remember`. Se o `use-list-return-focus` do E2.10 já existir, passa a usar o `return-position.ts`, num commit próprio. | `src/lib/dashboard/links.ts`, `src/lib/cells/filters.ts`, `src/lib/navigation/return-position.ts`, `src/hooks/{use-return-position,use-row-link}.ts`, `src/components/ScrollToTopOnPush.tsx`, `src/App.tsx`, `src/components/dashboard/*`, `src/pages/Dashboard.tsx` e os testes | 11, 13, 17 | 04 a 06, 09, 10, 14 | 5 (mesmos arquivos); as listas dos grupos ligados em produção |
| 9 | ux-designer | Revisão da UI do PR 3: links, setas, foco, a volta na mesma posição e a navegação nova a partir do topo em Membros, Células, Relatórios e Auditoria (DA-5), em 360 e 1280 px. | — | — | 04 a 06, 14 | 8 |
| 10 | qa | Vitest (`links.ts`, `return-position.ts`); o `e214_02` sem `skip` nos grupos ligados; Playwright: para cada persona, cada número abre uma lista com o total (ou a soma dos visitantes) igual ao número; UX-04, 05, 06 (`timezoneId: "Europe/Lisbon"`, `window.scrollY` e foco na volta, topo depois de uma gravação), 09 e 10 (links do gráfico), 14. | `src/**/*.test.ts(x)`, `e2e/dashboard-links.spec.ts`, `supabase/tests/database/e214_02_parity.test.sql` | 13, 17 | 04 a 06, 09, 10, 14 | 8 |
| **PR 3b, 3c: um grupo de links cada (só se a lista chegar depois do PR 3)** | | | | | | |
| 11 | frontend-developer | Ligar o grupo em `links.ts`, com os testes. | `src/lib/dashboard/links.ts` e o teste | 13 | 04, 09, 14 | 8; a lista do grupo em produção |
| 12 | qa | O `e214_02` do grupo sem `skip`; o Playwright da RN-13 para o grupo. | os citados na 10 | 13 | 04 | 11 |
| **PR 4: banco, limpeza** | | | | | | |
| 13 | backend-developer | Migration 2: guarda e `DROP FUNCTION dashboard_cells_by_type()`. Regenerar o `types.ts`. Tirar dos pgTAP as asserções que restarem sobre ela. | `supabase/migrations/<ts>_e214_02_drop_cells_by_type.sql`, `src/integrations/supabase/types.ts`, `supabase/tests/database/e108_pr3_dashboard_rpcs.test.sql` | 10 | — | promote do PR 2 |
| 14 | qa | Suíte inteira de pgTAP e o *smoke* do Dashboard depois da migration. | — | 10 | — | 13 |
| **Fechamento** | | | | | | |
| 15 | architect | Revisão final dos PRs; atualizar o `CLAUDE.md` ([Mudanças nos documentos](#dependências-e-impactos-em-outros-passos)). O aceite, a matriz e o `docs/migracao.md` são do `product-owner`. | `CLAUDE.md` | — | — | 3, 6, 7, 9, 10, 14 (e 12, se houver) |

**Ordem de execução:**
- Tarefa 1 primeiro.
- PR 1: 2 → 3 (a 3 é escrita em paralelo com a 2 e roda depois dela). O PR 1 só vai para o "Deploy: banco" com a 3 aprovada (metas e números).
- PR 2: a 4 começa com os tipos da tarefa 2; a 5 depois da 4. 5 → (6 ∥ 7). O merge espera o PR 1 em produção.
- PR 3: 8 depois do PR 2 na `main`, com os grupos cujas listas já estão em produção. 8 → (9 ∥ 10).
- PRs 3b e 3c: 11 → 12, cada um quando a lista do grupo for promovida.
- PR 4: 13 → 14, só depois do promote do PR 2. Pode andar em paralelo com o PR 3.
- 15 no fim.

**Critérios de pronto**
1. **Tarefa 2:**
   - a migration roda num banco zerado depois das existentes e roda de novo sem erro;
   - a guarda falha num banco sem o E2.07 ou sem o E2.09;
   - nenhuma função com EXECUTE para `anon`; as duas continuam *invoker*;
   - o `types.ts` está regenerado;
   - a suíte inteira de pgTAP (a dos passos anteriores, ajustada, e a deste) passa;
   - as metas de [Desempenho](#desempenho) são cumpridas, com os `EXPLAIN ANALYZE` de antes e de depois no PR.
2. **Tarefa 3:** os critérios das RN-01 a RN-12 e da RN-18 provados com `_at` fixo, nas três sessões de fuso; a igualdade da RN-13 para cada persona nos grupos que já têm lista.
3. **Tarefas 4, 5, 8 e 11:**
   - `npm run lint`, `npm test` e `npm run build` verdes;
   - sem `any` e sem asserção de tipo (`as Tipo`) nos arquivos novos (`as const` é permitido);
   - nenhuma conta de negócio no front (só a largura das barras) e nenhum `Date` para a semana;
   - nenhum texto do spec fora de `src/lib/dashboard/texts.ts`, menos os badges, que vêm dos módulos das listas;
   - nenhum endereço de lista montado fora dos módulos das listas;
   - nenhum `orange-`, `blue-`, `pink-`, `red-`, cor em hex ou `destructive` no Dashboard;
   - nada do Dashboard importa `@/components/ui/chart` nem `recharts`;
   - nenhuma gravação usa só `invalidateQueries` para `["dashboard"]`, e ninguém usa `resetQueries` nele.
4. **Tarefa 8:** com o resumo fora do cache, a volta começa do topo; com o cache, na mesma posição e com o foco no número aberto; uma navegação nova pelo menu, numa página rolada, abre a outra tela no topo.
5. **Tarefas 6 e 9:** o `ux-designer` dá o veredito e lista os ajustes, que voltam ao `frontend-developer` antes de o QA fechar o PR.
6. **Tarefa 13:** a guarda falha se alguma função ainda citar `dashboard_cells_by_type`; nenhum arquivo do front a chama (busca).

## Testes
_Seção do `qa`._

| RN | Testes | Resultado |
|---|---|---|
