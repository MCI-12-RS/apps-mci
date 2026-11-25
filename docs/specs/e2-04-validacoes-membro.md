# E2.04: Validações de membro

> Status: **implementado; PR 3 em produção em 2026-11-25.** PR 3 (formulário da UX: T8 a T11) implementado e testado em 2026-11-25: mci-connect#37, squash `d680904`, promote e republicação da `create-user-admin` em 2026-11-25. Revisão final (T12) em 2026-11-25: **APROVADO**, com o backlog em [Revisão final](#revisão-final-do-passo-tarefa-12). Falta o aceite do PO (matriz, seção 3 e Progresso do `docs/migracao.md`). T1 (conferência em produção) feita em 2026-11-25, sem linhas `a` nem `infra`. PR 1 (banco neutro: T2 e T3) implementado e testado em 2026-11-25: PR #35 do `mci-connect` (branch `feat/E2.04-pr1-banco-neutro`, migration `20261125210000_e204_01_rule_functions.sql`), em produção em 2026-11-25 (squash `2f6eebf`, "Deploy: banco"; conferência pós-deploy ok: 3 índices únicos entre não excluídos, grants, funções). PR 2 (regras no banco e cadastro com conta: T4 a T7) implementado e testado em 2026-11-25: PR #36 do `mci-connect` (branch `feat/E2.04-pr2-regras-cadastro`, migration `20261125220000_e204_02_member_rules.sql`), em produção em 2026-11-25 (squash `83e5d49`; pré-deploy sem violação; "Deploy: banco" e promote do mesmo commit com ~1 min de janela; pós-deploy: os 9 itens `true`). O risco 4 (o Auth aceitar o `id` da conta) se confirma no primeiro cadastro pela tela. O `''` em produção (2 cadastros de teste com CPF `''`, que davam `cpf` na guarda) é corrigido pela migration 2 (DT-24). Decisões novas no PR 2: DT-24 (vazio vira nulo) e DT-25 (troca de líder cruzada pode dar 40P01). Desvios do desenho: `is_placeholder_email` mantém o domínio depois do último `@` (E1.04), e a conferência (e) da `restore_member` vem depois da trava do líder (DT-09).
> Histórico: desenho pronto para revisão. Negócio escrito em 2026-11-23 pelo `product-owner`; Experiência (UX) escrita no mesmo dia pelo `ux-designer`, com as pendências PO-UX-1 a PO-UX-8 resolvidas pelo PO (P-VAL-19 a P-VAL-26). Solução técnica e Tarefas escritas pelo `architect` em 2026-11-23, sem perguntas em aberto. Ficam para o usuário revisar no PR os padrões P-VAL-01 a P-VAL-26 e os pontos definidos pelo `architect` (DA-1 a DA-13). A implementação começa depois do E1.04 inteiro, do E2.01 inteiro e do PR 1 do E2.02 em produção. Falta a seção Testes (QA).
> Slug: `e2-04-validacoes-membro` · Paridade com o legado: sim (MEM-01 a MEM-09, com a MEM-10 complementada e a HIE-01 antecipada do E2.06). Tem regras novas: CPF único e identificador real (D5), e-mail fictício (D7) e coerência entre pastor, líder e "Tem Liderança?".

## Negócio
_Seção do `product-owner`. Escrita em 2026-11-23 a partir destas fontes:_
- _seção 3.2 (MEM), seções 5.3 a 5.6 e decisões D5, D7, D9 e D11 do [`docs/migracao.md`](../migracao.md);_
- _validador, tela e serviço de membros do legado;_
- _`MemberForm`, `create-user-admin` e migrations de `members` do `mci-connect` (`origin/main`, `bef0877`);_
- _specs já fechados: [E2.01](e2-01-exclusao-logica.md) (RN-16, RN-18, DT-17), [E1.04](e1-04-sign-in.md) (RN-01 a RN-05, P-LOG-02, P-LOG-16, risco 15), [E2.02](e2-02-perfis-escopo.md) (RN-06, RN-09 a RN-11, DA-11, leitura técnica 5) e [E1.08](e1-08-paginacao-servidor.md) (RN-11, RN-12)._

### Contexto e objetivo
O legado valida o cadastro de membro em dois lugares. A tela confere tudo a cada gravação e mostra os erros juntos, cada um no seu campo. A API repete parte das regras:
- **Nome:** nome e sobrenome na tela; pelo menos 2 caracteres na API.
- **Identificador:** e-mail ou celular obrigatório, porque é o login.
- **Unicidade:** e-mail e celular únicos entre os não excluídos, com o e-mail comparado sem diferenciar maiúsculas.
- **E-mail:** formato válido.
- **CPF:** opcional, mas válido quando informado.
- **Sexo:** sempre preenchido.
- **Líder:** obrigatório, a não ser com "Não tem liderança" marcado. O administrador geral pode deixar os dois em branco.
- **Nascimento:** depois de hoje menos 100 anos.
- **Ciclos:** proibidos, conferidos até cerca de 6 níveis.
- **Batismo:** a data fica desabilitada sem "Batizado".

Hoje o novo não impõe nenhuma dessas regras no banco, como diz a matriz de paridade. Conferido na `main` (`bef0877`) em 2026-11-23:
- **Formulário (`MemberForm`):**
  - Só o nome é obrigatório, sem exigir o sobrenome.
  - O e-mail só passa pela checagem do navegador, e o sexo é opcional.
  - CPF, celular e data de nascimento não são conferidos.
  - A máscara do celular corta o número em 11 dígitos. Colado da agenda, "+55 (51) 98888-7777" vira "(55)51988-8877": um número errado, que pela RN-06 passaria como válido, com o DDD 55.
  - "Tem Liderança?" começa desligado. Com isso, um membro cadastrado sem líder fica "sem liderança" sem que ninguém tenha escolhido isso.
  - "É Pastor(a)?" e o líder são independentes: dá para salvar um pastor com líder.
  - Desligar "Batizado(a)?" esconde a data, mas ela continua sendo gravada.
  - Sem e-mail, o próprio navegador gera um e-mail fictício.
- **Banco:**
  - Só aceita 'M' e 'F' no sexo (conferir no banco real).
  - Recusa o cônjuge de si mesmo, com uma mensagem em inglês.
  - Não tem unicidade de e-mail, celular nem CPF. A unicidade do CPF foi retirada em `20260326022810`.
- **Função de cadastro (`create-user-admin`):** exige o nome e responde "Já existe um membro com este e-mail, CPF ou celular." sem dizer qual dado.

Objetivo do passo:
- impor no banco as regras MEM-01 a MEM-09, com a D5 (e-mail real, celular ou CPF, cada um único) e a D7 (e-mail fictício);
- fechar as coerências da liderança para todos: pastor sem líder, "Tem Liderança?" coerente com o líder e nenhum ciclo, em qualquer profundidade;
- usar uma única comparação de e-mail, celular e CPF no login (E1.04), na unicidade, na restauração e no aviso de cadastro excluído (E2.01);
- não barrar a carga do legado nem travar a edição de cadastros antigos: cada dado fora das regras tem um caminho de saneamento.

### Termos
- **Cadastro:** o registro de um membro (ativo ou inativo, inclusive pastores).
- **Identificador de login:** e-mail real, celular ou CPF (D5). É a "identificação" do E1.04.
- **E-mail real:** e-mail digitado por alguém, no formato da RN-04, fora dos domínios fictícios.
- **E-mail fictício:** e-mail gerado pelo sistema, num domínio da igreja (D7), para quem não tem e-mail real, porque a conta de acesso exige um e-mail. O domínio atual é `mci12fakemail.com`, e o novo será escolhido no E1.06.
- **Situação de liderança:** pastor, com líder ou sem liderança (RN-11). "Sem liderança" quer dizer sem líder e sem ser pastor, como na RN-06 do E2.02.
- **Discípulo direto ou indireto:** qualquer pessoa abaixo de alguém na árvore, em qualquer nível, ativa ou inativa.
- **Ver a igreja toda:** ter "Visualizar Toda a Igreja", como no E2.02.
- **Regra do tipo (a), "sempre":** vale para todos os cadastros o tempo todo, inclusive os da carga do legado (RN-01).
- **Regra do tipo (b), "no que muda":** vale no cadastro novo e, numa edição, para o campo que muda (RN-01, RN-17).
- **Carga do legado:** os scripts de transformação, backfill e contas da migração (E4.06 a E4.08).
- **Hoje:** a data no horário de Brasília (`America/Sao_Paulo`).

### Personas e permissões
Os nomes entre aspas são os rótulos da tela de Funções (E2.02).

| Persona | Quem é | Permissões | O que faz neste spec |
|---|---|---|---|
| IG Quem vê a igreja toda | Rita, função Administrador, ou a secretaria | "Criar Membro", "Editar Membro", "Visualizar Toda a Igreja" e "Ver Dados Sensíveis" | cadastra e edita qualquer membro; é a única que marca pastor ou sem liderança (RN-10 do E2.02) |
| MI Quem vê só o ministério | Pedro, função Líder | "Criar Membro" e "Editar Membro", sem "Ver Dados Sensíveis" | cadastra sempre com líder; na edição de outra pessoa, não altera e-mail, celular nem CPF (RN-12 do E1.08) |
| PR Próprio cadastro | Caio, função Membro | "Editar Próprio Cadastro" | altera os próprios dados pessoais (RN-11 do E2.02), inclusive e-mail, celular e CPF |
| SP Sem permissão | sem "Criar Membro" nem "Editar Membro" | — | não grava (E1.03, E2.02); nenhuma regra deste spec chega a ele |
| SI Sistema | service role, funções do servidor e rotinas internas (restaurar e excluir do E2.01) | — | seguem as mesmas regras (RN-01) |
| CG Carga do legado | scripts E4.06 a E4.08 | — | tratamento próprio (RN-18) |

### Histórias
- Como quem cadastra membros, quero ver de uma vez todos os campos preenchidos errado, para corrigir tudo antes de salvar.
- Como liderança, quero que cada e-mail, celular e CPF pertença a um só cadastro, para que o login encontre sempre a pessoa certa e não existam cadastros duplicados.
- Como quem cadastra, quero que ninguém fique sem líder por esquecimento, para que ninguém fique fora da árvore de discipulado.
- Como liderança, quero uma árvore sem ciclos e sem pastores com líder, para que o escopo, os totais e a árvore de Ministérios fiquem certos.
- Como líder, quero editar um cadastro antigo sem ser obrigado a corrigir um dado que eu nem vejo, para não travar o meu trabalho.
- Como membro, quero manter o meu e-mail, o meu celular e o meu CPF em dia e saber se algum deles já está em uso, sem descobrir quem o usa.
- Como igreja, quero migrar os dados do legado sem perder cadastros por causa das regras novas, com a lista do que precisa ser corrigido.

### Decisões

#### Decisões do usuário e de passos anteriores
| Decisão | O que vale aqui | Onde |
|---|---|---|
| D5 (2026-11-23) | O identificador de login é o e-mail real, o celular ou o CPF, e cada um é único. | RN-04 a RN-09 |
| D7 (2026-11-23) | O e-mail fictício fica num domínio controlado pela igreja (E1.06). | RN-05 |
| D9 (2026-11-23) | Os pastores são Samuel Colares e Magda Colares. | RN-11, RN-18 |
| D11 (2026-11-15) | A senha inicial continua sendo `123456`. A senha não é validada neste passo. | Fora de escopo |
| DEL-04, RN-16 (e), RN-18 e DT-17 do E2.01 | A unicidade conta só os não excluídos. A restauração e o aviso de cadastro excluído usam a mesma comparação, com a normalização num lugar só. | RN-09, RN-10 |
| RN-02 a RN-05, P-LOG-02, P-LOG-16 e risco 15 do E1.04 | Leitura do e-mail, do celular (55, zeros e 9º dígito) e do CPF (11 dígitos iguais é inválido). O E1.04 pede que a unicidade do celular use a mesma equivalência. | RN-04, RN-06, RN-07, RN-09 |
| RN-10, DA-11 e leitura técnica 5 do E2.02 | Só quem vê a igreja toda marca pastor ou sem liderança. Com líder, "Tem Liderança?" fica ligado. O E2.04 proíbe pastor com líder para todos. | RN-11, RN-12 |
| RN-11 e RN-12 do E1.08 | Quem não vê os dados sensíveis de um cadastro não os altera. | RN-10, RN-17 |

#### Padrões definidos por este spec (revisar no PR)
Estes pontos não estão nas fontes. O PO adotou a opção mais conservadora e coerente com o legado e com os specs anteriores. Nas regras, eles aparecem como "definida pelo spec", e o usuário pode mudar qualquer um na revisão do PR.

- **P-VAL-01, dois tipos de regra** (RN-01).
  - As regras do tipo (a) valem sempre, para todos os cadastros. As do tipo (b) valem no cadastro novo e no campo que muda.
  - As duas valem para qualquer caminho, inclusive a service role e as rotinas internas. A carga do legado tem tratamento próprio.
- **P-VAL-02, nome** (RN-02).
  - Ao gravar, os espaços das pontas saem e os espaços seguidos viram um só, como na carga (5.5).
  - O nome precisa de pelo menos duas palavras com letras.
- **P-VAL-03, sexo obrigatório** (RN-03). No legado, o sexo sempre estava preenchido; no novo, hoje é opcional. O rótulo do campo volta a ser "Sexo", como no legado e na RN-11 do E2.02.
- **P-VAL-04, formato do e-mail** (RN-04): regra exata e verificável, com o e-mail gravado em minúsculas.
- **P-VAL-05, e-mail fictício** (RN-05). Só o sistema gera o e-mail fictício. Ninguém o digita nem o envia, e um e-mail nos domínios fictícios é recusado.
- **P-VAL-06, celular** (RN-06).
  - Só números do Brasil, com DDD (10 ou 11 dígitos).
  - É gravado sem o 55 e sem zeros à esquerda.
  - O celular antigo fora do formato fica como está até ser alterado.
- **P-VAL-07, celular único com o 9º dígito** (RN-09). (51) 98888-7777 e (51) 8888-7777 contam como o mesmo celular, como o E1.04 recomendou. No legado, a comparação era exata.
- **P-VAL-08, identificador** (RN-08). É exigido no cadastro novo e quando a edição tira o último. O cadastro antigo que não tinha nenhum continua editável.
- **P-VAL-09, recusa por dado em uso** (RN-10).
  - A mensagem diz qual dado está em uso e nunca de quem, para todos, inclusive o administrador.
  - Quando há mais de um dado em uso, a recusa cita todos.
  - Ela vem antes do aviso de cadastro excluído do E2.01.
- **P-VAL-10, dado liberado** (RN-09). Um e-mail, celular ou CPF que nenhum cadastro não excluído usa pode ser usado de novo. A única exceção é o e-mail da conta de acesso de um membro excluído (RN-18 do E2.01).
- **P-VAL-11, pastor com líder** (RN-11). É recusado, e não corrigido em silêncio. Na tela, ligar "É Pastor(a)?" tira o líder à vista de quem edita.
- **P-VAL-12, "Tem Liderança?" ligado por padrão no cadastro** (RN-12). Sem líder, só com escolha explícita. Pela API, um cadastro que não diz nada sobre "Tem Liderança?" conta como "tem liderança".
- **P-VAL-13, ciclos** (RN-13). São conferidos em qualquer profundidade e entram neste passo, antecipados do E2.06 (HIE-01), porque a conferência acontece ao gravar o membro.
- **P-VAL-14, data de nascimento** (RN-15). O limite é estrito, a data futura é recusada, e a data só é conferida quando muda, porque o limite anda com o tempo.
- **P-VAL-15, batismo** (RN-16). Desligar "Batizado(a)?" apaga a data. Enviar uma data para quem não é batizado é recusado.
- **P-VAL-16, dados antigos** (RN-17).
  - Numa edição, só o campo que muda é conferido.
  - O formulário mostra um aviso, que não impede salvar, nos campos antigos fora da regra.
  - Motivo: no legado, o formulário inteiro era validado a cada gravação. No novo, quem edita pode não ver o campo (E1.08) ou não poder alterá-lo (E2.02).
- **P-VAL-17, saneamento** (RN-18). A seção 5.4 ganha linhas novas:
  - celular fora do formato;
  - nascimento fora do intervalo;
  - nome de uma palavra só, apenas para informação;
  - cônjuge apontando para a própria pessoa;
  - celular repetido, comparado com o 9º dígito.
- **P-VAL-18, como as recusas aparecem** (RN-19).
  - Na tela, todos os erros de preenchimento aparecem juntos, como no legado.
  - As recusas de permissão, de escopo e de cadastro excluído vêm antes das deste spec. Assim, quem não pode gravar nunca descobre se um dado está em uso.
- **Vindos do desenho de UX (2026-11-23, PO-UX-1 a PO-UX-8 em "Experiência (UX)"):**
  - **P-VAL-19, formato ao sair do campo** (PO-UX-1, RN-19).
    - Ao sair de um campo que alterou e deixou preenchido (Nome, Celular, E-mail, CPF e Data de nascimento), a pessoa já vê o erro de formato daquele campo. A conferência é só na tela, sem o servidor.
    - O dado em uso e o ciclo continuam sendo conferidos só ao salvar, pelo mesmo motivo da P-DEL-22 do E2.01: uma consulta ao sair do campo facilitaria descobrir dados de outras pessoas.
  - **P-VAL-20, grupo "Identificação"** (PO-UX-2, RN-08). Celular, E-mail e CPF ficam juntos, nessa ordem, no grupo "Identificação", com a dica de que a pessoa entra com um deles. Os obrigatórios vêm primeiro no formulário.
  - **P-VAL-21, sexo sem padrão** (PO-UX-3, RN-03). No cadastro novo, nenhuma opção vem marcada, ao contrário do legado, que vinha com Masculino. Um padrão esconderia a falta de escolha, o mesmo problema que a P-VAL-12 resolve na liderança.
  - **P-VAL-22, desmarcar pastor** (PO-UX-4, RN-12).
    - Na tela, desligar "É Pastor(a)?" num cadastro de pastor faz "Tem Liderança?" aparecer ligado, com o líder obrigatório, como no cadastro novo.
    - Pela API, quem desmarca envia o líder ou "Tem Liderança?" desligado. Se não enviar nenhum dos dois, vale o "Tem Liderança?" gravado, que é desligado para pastor, e a pessoa fica sem liderança.
  - **P-VAL-23, nada é apagado em silêncio** (PO-UX-5, RN-11, RN-12, RN-16). Quando um interruptor vai apagar um dado ao salvar, a tela avisa o que será apagado, com o valor, e desfazer o toque antes de salvar devolve o dado. Isso vale para "É Pastor(a)?" e "Tem Liderança?" (o líder) e para "Batizado(a)?" (a data do batismo).
  - **P-VAL-24, duas ajudas na escolha** (PO-UX-6, RN-13, RN-15).
    - A idade aparece embaixo da data de nascimento, como no legado.
    - No seletor de líder, os discípulos da pessoa aparecem sem poder ser escolhidos, com o motivo. Isso não revela nada novo, porque o seletor só mostra quem a pessoa já vê, e o líder de cada um já aparece na lista de Membros.
  - **P-VAL-25, aviso da data de nascimento** (PO-UX-7). O texto passa a "Data de nascimento fora do intervalo aceito. Confira quando puder.", porque a data pode estar certa e só ter passado do limite com o tempo.
  - **P-VAL-26, textos da UX** (PO-UX-8). Todos foram aceitos, sem ajuste. Os que estão ligados a uma regra foram copiados para os "Textos de tela" deste Negócio.

### Regras de negócio
Nenhuma regra está "a confirmar". Os caminhos do legado são relativos a `g12app-net/`, com as abreviações do E2.01: `App/` = `G12App.Application/`, `Domain/` = `G12App.Domain/` e `UI/` = `G12App.API/ClientApp/src/`.

Correspondência com o plano: MEM-01 → RN-02 · MEM-02 → RN-05 e RN-08 · MEM-03 → RN-04, RN-06 e RN-09 · MEM-04 → RN-07 · MEM-05 → RN-09 · MEM-06 → RN-04 · MEM-07 → RN-11 e RN-12 · MEM-08 → RN-15 · MEM-09 → RN-16 · MEM-10 (complemento) → RN-14 · HIE-01 → RN-13 · DEL-04 → RN-09.

| ID | Regra | Origem |
|---|---|---|
| RN-01 | **Alcance.** As regras deste spec valem para todo cadastro de membro, ativo ou inativo, inclusive pastores. Valem para qualquer gravação: pela tela, pela API, pelas funções do servidor (como a de cadastro com conta de acesso) e pelas rotinas internas (como excluir e restaurar, do E2.01), com ou sem a service role.<br><br>São de dois tipos:<br>(a) **Sempre:** valem para todos os cadastros o tempo todo, e nenhum cadastro fica fora delas, nem os da carga. São as RN-03, RN-04, RN-07, RN-09, RN-11, RN-13, RN-14 e RN-16.<br>(b) **No que muda:** valem no cadastro novo e, numa edição, para o campo que muda (RN-17). São as RN-02, RN-05, RN-06, RN-08, RN-12 e RN-15.<br><br>A única exceção é a carga do legado (E4.06 a E4.08, com o backfill). Ela não passa pelas regras do tipo (b) e entrega os cadastros já dentro das regras do tipo (a) (RN-18). | MEM-01 a MEM-09; seção 5.3 do `docs/migracao.md` ("CHECKs ... e os índices únicos ... criados antes da carga para barrar dados ruins"); tipos e alcance: definida pelo spec (P-VAL-01) |
| RN-02 | **Nome.**<br>- Ao gravar, os espaços no começo e no fim saem, e os espaços seguidos (inclusive tabulações e quebras de linha) viram um só. Maiúsculas e acentos ficam como foram digitados.<br>- O nome precisa ter pelo menos duas palavras com letras (nome e sobrenome). "Ana Souza" e "Ana B." são aceitos; "Ana", "Ana 2" e "Ana ." não são.<br>- Mensagem: "Informe o nome e o sobrenome."<br>- Tipo (b): um nome antigo de uma palavra só não impede editar os outros campos. | MEM-01; legado (`UI/pages/Members/details.js:154-155`: nome e sobrenome; `Domain/Validators/MemberDtoValidator.cs:21-24`: no mínimo 2 caracteres); espaços: 5.5 do `docs/migracao.md`; "palavras com letras": definida pelo spec (P-VAL-02) |
| RN-03 | **Sexo.**<br>- É obrigatório: Masculino ou Feminino, gravado como M ou F.<br>- Nenhum outro valor é aceito, nem "Masculino" ou "Feminino" por extenso pela API.<br>- No formulário, o campo se chama "Sexo".<br>- No cadastro novo, nenhuma opção vem marcada: quem cadastra escolhe. No legado, o campo vinha com Masculino.<br>- Mensagem: "Informe o sexo."<br>- Tipo (a). | legado (`Domain/Model/Member.cs:18` e `Domain/DTOs/MemberDto.cs:31`: o sexo não pode ser nulo; `Domain/Validators/MemberDtoValidator.cs:35-37`: "Campo obrigatório"; `UI/pages/Members/details.js:28` e `:373`: padrão Masculino e rótulo "Sexo"); 5.5 (`0` → M, `1` → F); "Armadilhas" do `CLAUDE.md`; obrigatório e rótulo: definida pelo spec (P-VAL-03); sem opção marcada: definida pelo spec (P-VAL-21, PO-UX-3) |
| RN-04 | **E-mail: formato e gravação.**<br>- É opcional (ver RN-08).<br>- Ao gravar, os espaços das pontas saem e as letras viram minúsculas.<br>- Formato válido: sem espaços; um único "@"; pelo menos um caractere antes dele; depois dele, pelo menos um ponto, com algum caractere antes e depois de cada ponto.<br>  - Aceitos: "ana@exemplo.com" e "ana.souza@igreja.org.br".<br>  - Recusados: "ana@exemplo", "ana@.com", "ana @exemplo.com", "ana@@exemplo.com" e "ana@exemplo..com".<br>- Mensagem: "E-mail inválido. Confira o endereço digitado."<br>- Tipo (a). Na carga, o e-mail fora do formato fica vazio (RN-18). | MEM-06; legado (`UI/pages/Members/details.js:157-158`: "@" e "."; `Domain/Validators/MemberDtoValidator.cs:26-28`; comparação sem maiúsculas: `Domain/Extensions/QueryingExtensions.cs:62`); minúsculas: 5.5 e `create-user-admin`; formato exato: definida pelo spec (P-VAL-04) |
| RN-05 | **E-mail fictício.**<br>- Quem não tem e-mail real recebe um e-mail fictício, num domínio da igreja (D7), porque a conta de acesso exige um e-mail. Quem gera é o sistema, e não quem cadastra.<br>- Ninguém digita nem envia um e-mail fictício. Um e-mail nos domínios fictícios (o atual, `mci12fakemail.com`, e o da D7) é recusado, na tela e pela API.<br>- Mensagem: "Este e-mail não pode ser usado. Informe um e-mail real ou deixe o campo em branco."<br>- O e-mail fictício nunca aparece na tela, não conta como identificador (RN-08) e não serve para entrar (RN-01 do E1.04).<br>- Ele é único como qualquer e-mail (RN-09), mas nunca gera a mensagem de dado em uso.<br>- Informar um e-mail real substitui o fictício. Apagar o e-mail real deixa o e-mail como "não informado", desde que sobre o celular ou o CPF (RN-08).<br>- Tipo (b): vale para o e-mail que muda. A carga gera os e-mails fictícios dela (6.2). | D7; D5 ("e-mail real"); RN-01 e P-LOG-01 do E1.04; 6.2 do `docs/migracao.md`; recusa e geração pelo sistema: definida pelo spec (P-VAL-05) |
| RN-06 | **Celular.**<br>- É opcional (ver RN-08).<br>- É lido como no login (RN-03 do E1.04): valem só os dígitos, e a máscara, os espaços, o "+" e os zeros à esquerda são ignorados. Com 12 ou 13 dígitos começando por 55, o 55 do Brasil sai. Com 10 ou 11 dígitos, o 55 inicial é o DDD de Santa Maria (RS) e fica.<br>- O que sobra precisa ter 10 ou 11 dígitos (DDD e número). Só números do Brasil são aceitos.<br>- É gravado assim, só com o DDD e o número. Por exemplo, "+55 (51) 98888-7777" é gravado como 51988887777.<br>- A tela nunca corta nem troca dígitos: o que foi digitado ou colado é lido inteiro, por esta regra. Ao sair do campo, ela mostra o número lido, como "(51) 98888-7777". Se o número não pode ser lido, fica como foi digitado, com o erro.<br>- Mensagem: "Celular inválido. Informe o DDD e o número."<br>- Tipo (b): um celular antigo fora do formato fica como está até ser alterado (RN-17). Ele não conta como identificador (RN-08) e não serve para entrar.<br>- O telefone fixo ("Telefone") não muda neste passo. | MEM-02, MEM-03; legado (`UI/pages/Members/details.js:225`: só dígitos; `:406`: máscara "(99) 99999-9999"); 5.5; leitura: RN-03 e P-LOG-02 do E1.04; formato e gravação: definida pelo spec (P-VAL-06); máscara sem cortar dígitos: correção do defeito apontado pela UX (UXD-9, P23) |
| RN-07 | **CPF.**<br>- É opcional (ver RN-08).<br>- Pontos, hífen e espaços são ignorados. É gravado com os 11 dígitos, inclusive os zeros à esquerda.<br>- Válido: exatamente 11 dígitos, dígitos verificadores certos e não todos iguais. Por exemplo, 111.111.111-11 é inválido.<br>- Mensagem: "CPF inválido. Se a pessoa não tem CPF, deixe o campo em branco."<br>- Tipo (a). Na carga, o CPF inválido fica vazio e é listado (5.4). | MEM-04; legado (`UI/shared/utils.js:195-243`, `ValidateCPF`; mensagem: `UI/pages/Members/details.js:168-169`; só dígitos: `:227`); dígitos iguais: P-LOG-16 do E1.04; 5.4 |
| RN-08 | **Identificador de login.**<br>- É identificador real: um e-mail real no formato da RN-04, um celular no formato da RN-06 ou um CPF válido (RN-07).<br>- Todo cadastro novo tem pelo menos um. Mensagem: "Informe o e-mail, o celular ou o CPF. A pessoa usa um deles para entrar no sistema."<br>- Uma edição não pode deixar sem identificador real um cadastro que tinha pelo menos um. Apagar o e-mail de quem tem celular é aceito; apagar o único identificador é recusado, com a mesma mensagem.<br>- Um cadastro antigo que já não tinha nenhum, vindo do legado, pode ser editado sem ganhar um.<br>- Vale para pastores, inativos e para quem edita o próprio cadastro.<br>- Na tela, Celular, E-mail e CPF ficam juntos, nessa ordem, no grupo "Identificação", com a dica "A pessoa entra no sistema com o celular, o e-mail ou o CPF. Informe pelo menos um.". O erro desta regra aparece no grupo, no lugar da dica. | MEM-02; D5; legado (`UI/pages/Members/details.js:160-162`: e-mail ou celular, "para que o usuário faça login"); CPF como identificador: D5; edição: definida pelo spec (P-VAL-08); 5.4 (membros sem e-mail e sem celular migram); grupo e dica: definida pelo spec (P-VAL-20, PO-UX-2) |
| RN-09 | **Unicidade.** Entre os cadastros não excluídos, cada e-mail, cada celular e cada CPF pertence a um só cadastro.<br><br>A comparação é a mesma do login (E1.04), da restauração (RN-16 e do E2.01) e do aviso de cadastro excluído (RN-18 do E2.01):<br>- e-mail: sem diferenciar maiúsculas e sem os espaços das pontas;<br>- celular: pela leitura da RN-06 e com a equivalência do 9º dígito. (51) 98888-7777 e (51) 8888-7777 são o mesmo celular;<br>- CPF: pelos 11 dígitos.<br><br>Quem conta:<br>- Contam os cadastros ativos e inativos, de qualquer ministério, inclusive os que quem grava não vê.<br>- Conta também o cônjuge: um casal não usa o mesmo e-mail nem o mesmo celular.<br>- Os excluídos não contam (DEL-04). Para eles valem a RN-18 do E2.01 (aviso no cadastro novo) e a RN-16 (e) do E2.01 (restauração recusada).<br><br>Mais regras:<br>- Vale o que está nos cadastros. Um dado que nenhum cadastro não excluído usa pode ser usado, mesmo que já tenha sido de outra pessoa. A exceção é o e-mail da conta de acesso de um membro excluído (RN-18 do E2.01).<br>- Com gravações simultâneas, só uma fica com o dado. A outra recebe a mensagem da RN-10.<br>- Tipo (a): vale também para a carga, que só termina sem repetições (RN-18). | MEM-03, MEM-05, DEL-04, D5; legado (`Domain/Validators/MemberDtoValidator.cs:39-79`: e-mail e celular únicos entre não excluídos, inclusive inativos; `Domain/Extensions/QueryingExtensions.cs:62`); CPF único: D5 e MEM-05; 9º dígito: impacto do E1.04 e definida pelo spec (P-VAL-07); dado liberado: definida pelo spec (P-VAL-10) |
| RN-10 | **Recusa por dado em uso.**<br>- A mensagem diz qual dado está em uso, sem dizer de quem: "Este e-mail já está sendo usado por outro cadastro.", e o mesmo texto com "Este celular" e "Este CPF".<br>- A mensagem é igual para todos, inclusive o administrador. Não importa se o outro cadastro é visível ou não, ativo ou inativo, do mesmo ministério ou não.<br>- Nenhuma resposta, nem pela API, traz o nome, o id ou qualquer outro dado do outro cadastro.<br>- Quando mais de um dado está em uso, a recusa cita todos.<br>- No cadastro novo, a unicidade vem antes do aviso de cadastro excluído (RN-18 do E2.01). Enquanto houver dado em uso num cadastro não excluído, o aviso não aparece.<br>- Quem não vê os dados sensíveis de um cadastro não os altera (RN-12 do E1.08), então nunca recebe esta recusa ao editar esse cadastro. No cadastro novo, quem tem "Criar Membro" preenche todos os campos e pode recebê-la. | legado (`Domain/Validators/MemberDtoValidator.cs:57` e `:78`: "Este e-mail já está sendo usado por outro membro.", sem o nome); RN-11 e RN-12 do E1.08; "cita todos" e ordem com a RN-18: definida pelo spec (P-VAL-09) |
| RN-11 | **Situação de liderança.** Todo cadastro está em uma, e só uma, destas situações:<br>(a) **Pastor(a):** "É Pastor(a)?" ligado, sem líder e com "Tem Liderança?" desligado;<br>(b) **Com líder:** "É Pastor(a)?" desligado, com líder e com "Tem Liderança?" ligado;<br>(c) **Sem liderança:** "É Pastor(a)?" e "Tem Liderança?" desligados, sem líder.<br><br>Detalhes:<br>- Escolher um líder liga "Tem Liderança?" (DA-11 do E2.02).<br>- "Tem Liderança?" ligado sem líder é recusado com "Escolha o líder." (RN-12).<br>- Pastor(a) com líder, ou com "Tem Liderança?" ligado, é recusado: "Pastor(a) não tem líder. Tire o líder ou desmarque "É Pastor(a)?"." Nada é apagado em silêncio.<br>- Na tela, ligar "É Pastor(a)?" tira o líder e desliga "Tem Liderança?" antes de salvar, à vista de quem edita: "Tem Liderança?" e o Líder dão lugar ao texto "Pastor(a) não tem líder.".<br>- Se havia líder, a tela avisa "Ao salvar, {Nome} deixa de ser o líder.". Desligar "É Pastor(a)?" antes de salvar devolve o líder e "Tem Liderança?" como estavam.<br>- Quem pode marcar ou desmarcar pastor e sem liderança é definido na RN-10 do E2.02.<br>- Tipo (a). | MEM-07; E2.02 (RN-06: "sem liderança" é sem líder e sem ser pastor; DA-11; leitura técnica 5: "proibir pastor com líder para todos é do E2.04"); D9; 5.5 (regras de `has_leadership`, `leader_id` e `is_pastor`); recusa em vez de correção: definida pelo spec (P-VAL-11); aviso e volta atrás: definida pelo spec (P-VAL-23, PO-UX-5) |
| RN-12 | **Líder obrigatório.**<br>- No cadastro novo, "Tem Liderança?" começa ligado, e o líder é obrigatório. A exceção é quando quem cadastra liga "É Pastor(a)?" ou desliga "Tem Liderança?" de propósito.<br>- Pela API, um cadastro novo sem líder, que não é pastor e não diz nada sobre "Tem Liderança?", é recusado com "Escolha o líder.".<br>- Na edição, para tirar o líder é preciso desligar "Tem Liderança?" ou ligar "É Pastor(a)?" na mesma gravação.<br>- Na tela, desligar "Tem Liderança?" mostra "A pessoa fica sem liderança.". Se havia líder, o texto passa a "Ao salvar, {Nome} deixa de ser o líder. A pessoa fica sem liderança.". Religar antes de salvar devolve o líder.<br>- **Desmarcar pastor.** Na tela, desligar "É Pastor(a)?" num cadastro de pastor faz "Tem Liderança?" aparecer ligado, com o líder obrigatório, como no cadastro novo. Quem edita escolhe o líder ou desliga "Tem Liderança?" de propósito. Pela API, quem desmarca envia o líder ou "Tem Liderança?" desligado. Se não enviar nenhum dos dois, vale o "Tem Liderança?" gravado, que é desligado para pastor, e a pessoa fica sem liderança.<br>- Marcar pastor ou sem liderança, inclusive cadastrar sem líder, exige ver a igreja toda (RN-10 do E2.02). No legado, só o administrador geral salvava sem líder.<br>- Mensagens: "Escolha o líder." para quem vê só o ministério (E2.02); "Escolha o líder ou desligue "Tem Liderança?"." para quem vê a igreja toda.<br>- O líder não pode estar excluído (RN-06 do E2.01) e precisa estar visível para quem grava (RN-09 do E2.02).<br>- Tipo (b): vale no cadastro novo e quando o líder, "Tem Liderança?" ou "É Pastor(a)?" mudam. | MEM-07; legado (`UI/pages/Members/details.js:171-172`: "Defina a liderança ou se a pessoa não tem liderança", com a exceção do `AppSuperAdmin`); E2.02 (RN-10; impacto: "o administrador geral" passa a ser "quem vê a igreja toda"); "começa ligado" e regra da API: definida pelo spec (P-VAL-12); desmarcar pastor: definida pelo spec (P-VAL-22, PO-UX-4); aviso e volta atrás: P-VAL-23 (PO-UX-5) |
| RN-13 | **Sem ciclos.**<br>- Ninguém é líder de si mesmo: "Uma pessoa não pode ser líder de si mesma."<br>- Ninguém tem como líder um discípulo seu, direto ou indireto, em qualquer profundidade da árvore, e não só até 6 níveis, como no legado. Os discípulos inativos também contam.<br>- Mensagem do caso anterior: "O líder escolhido é discípulo desta pessoa (direto ou indireto). Escolha outro líder." Ela não cita nomes.<br>- Duas trocas de líder simultâneas não podem formar um ciclo juntas: se isso aconteceria, só uma das duas é aceita.<br>- Na tela, o seletor de líder não oferece a própria pessoa. Os discípulos dela, diretos ou indiretos, inclusive os inativos, aparecem sem poder ser escolhidos, com o motivo "Discípulo desta pessoa". O seletor só mostra quem a pessoa que edita já vê.<br>- Tipo (a). A carga só termina sem ciclos (5.4: corrigir no legado). | HIE-01; legado (`App/Services/MemberService.cs:191-205`: "Membro não pode ser discípulo de um discípulo.", até 6 níveis; o seletor de líder não oferece a própria pessoa: `UI/pages/Members/details.js:459`); qualquer profundidade e antecipação do E2.06: definida pelo spec (P-VAL-13); discípulos no seletor: definida pelo spec (P-VAL-24, PO-UX-6) |
| RN-14 | **Cônjuge.**<br>- Ninguém é cônjuge de si mesmo: "Uma pessoa não pode ser cônjuge de si mesma." Hoje o banco já recusa, mas com uma mensagem em inglês.<br>- O vínculo continua simétrico (MEM-10, sem mudança).<br>- Não há regra sobre o sexo do cônjuge, porque o legado não tem (ver Perguntas em aberto).<br>- O cônjuge não pode estar excluído (E2.01) e precisa estar visível para quem grava (E2.02).<br>- Tipo (a). | MEM-10; legado (o seletor de cônjuge não oferece a própria pessoa: `UI/pages/Members/details.js:363`; vínculo simétrico: `App/Services/MemberService.cs:163-181`); novo (`sync_spouse_relationship`, `supabase/migrations/20260426175140_3dd722c7-01e1-4fb7-a62a-a068ab31800c.sql:31-34`) |
| RN-15 | **Data de nascimento.**<br>- É opcional.<br>- Quando informada, não pode ser futura e precisa ser posterior ao mesmo dia de 100 anos atrás. Em 23/11/2026, as datas de 24/11/1926 a 23/11/2026 são aceitas; 23/11/1926 e 24/11/2026 não são.<br>- "Hoje" é a data de Brasília.<br>- Mensagens: "A data de nascimento não pode ser futura." e "Confira a data de nascimento: a pessoa teria 100 anos ou mais."<br>- Com uma data válida, a tela mostra a idade embaixo do campo: "{N} anos", "1 ano" ou "Menos de 1 ano", calculada pelo "hoje" de Brasília.<br>- Tipo (b). O limite anda com o tempo, então uma data aceita hoje pode passar do limite depois. O cadastro continua editável, e a data só é conferida quando muda. | MEM-08; legado (`Domain/Validators/MemberDtoValidator.cs:30-33`: depois de hoje menos 100 anos, com a data opcional; idade: `UI/pages/Members/details.js:134` e `:394-396`); data futura: MEM-08 (o legado não barrava); limite exato e "no que muda": definida pelo spec (P-VAL-14); idade: P-VAL-24 (PO-UX-6) |
| RN-16 | **Batismo.**<br>- Com "Batizado(a)?" ligado, a data do batismo é opcional.<br>- Com "Batizado(a)?" desligado, não há data do batismo:<br>  - desligar "Batizado(a)?" apaga a data, na mesma gravação;<br>  - na tela, desligar "Batizado(a)?" com a data preenchida avisa "Ao salvar, a data do batismo ({dd/mm/aaaa}) será apagada.", e religar antes de salvar devolve a data;<br>  - enviar uma data para quem continua não batizado é recusado: "A data do batismo só pode ser informada para quem é batizado(a)."<br>- Não há outras regras para essa data (ver Fora de escopo).<br>- Tipo (a). Na carga, a data de quem não é batizado fica vazia (5.5). | MEM-09; legado (`UI/pages/Members/details.js:481`: data desabilitada sem "Batizado"); 5.5; apagar ao desligar e recusa: definida pelo spec (P-VAL-15); aviso e volta atrás: definida pelo spec (P-VAL-23, PO-UX-5) |
| RN-17 | **Cadastros que já existem fora das regras do tipo (b).** Vale para os cadastros vindos do legado e para os de teste que já existem no novo.<br>- Numa edição, só é conferido o que muda.<br>- Um campo muda quando o valor novo é diferente do gravado, lidos os dois como na regra do campo (espaços, maiúsculas, máscara e 55).<br>- Abrir e salvar um cadastro sem mexer num campo não altera esse campo, mesmo com o valor antigo fora do formato.<br>- Quem edita não é obrigado a corrigir o que não mexeu: o nome de uma palavra só, o celular sem DDD, a data de nascimento fora do intervalo ou a falta de identificador.<br>- Na tela, o campo antigo fora da regra mostra um aviso, que não impede salvar. O aviso só aparece para quem vê o campo.<br>- Quando o campo é alterado, o valor novo precisa seguir a regra.<br>- Nenhum cadastro fica fora das regras do tipo (a): a carga (RN-18) e a publicação deste passo deixam todos dentro delas. | definida pelo spec (P-VAL-16). Motivo: quem edita pode não ver o campo (RN-11 e RN-12 do E1.08) nem poder alterá-lo (RN-11 do E2.02). No legado, o formulário inteiro era validado a cada gravação (`UI/pages/Members/details.js:146-176`). |
| RN-18 | **Carga do legado e saneamento.**<br>- A carga (E4.06 a E4.08, com o backfill) traz os cadastros como estão no legado, com as transformações da 5.5. Ela não passa pelas regras do tipo (b).<br>- A carga precisa entregar todos os cadastros dentro das regras do tipo (a).<br>- O que o legado tem fora delas segue a tabela [Dados do legado](#dados-do-legado): é corrigido no legado antes do cutover (E4.05), ou é transformado na carga e listado.<br>- O relatório de saneamento (E4.04) inclui as linhas novas da tabela.<br>- A reconciliação (E4.09) confere que nenhum cadastro carregado viola uma regra do tipo (a).<br>- Se sobrar e-mail, celular ou CPF repetido, ou um ciclo, a carga não termina, e o go/no-go não passa. | 5.3 a 5.6 do `docs/migracao.md`; D9; linhas novas: definida pelo spec (P-VAL-17) |
| RN-19 | **Como as recusas aparecem.**<br>- **Ordem.** As recusas de permissão e de escopo (E1.03 e E2.02) e a de cadastro excluído (E2.01) vêm antes das deste spec. Quem não pode gravar um cadastro nunca recebe uma recusa de formato ou de dado em uso.<br>- **Na tela, ao salvar,** os erros de preenchimento (RN-02 a RN-08, RN-12 e RN-15) aparecem todos de uma vez, cada um no seu campo, e nada é enviado enquanto houver erro.<br>- **Na tela, ao sair de um campo** que a pessoa alterou e deixou preenchido (Nome, Celular, E-mail, CPF e Data de nascimento), aparece o erro de formato daquele campo. A conferência é só na tela: sair de um campo vazio não mostra erro, e nenhum erro novo aparece enquanto a pessoa digita.<br>- **Só ao salvar** são conferidos o dado em uso (RN-09) e o ciclo (RN-13). A tela não consulta o servidor fora do salvar, para não facilitar descobrir dados de outras pessoas, como na RN-18 do E2.01 (P-DEL-22).<br>- **Recusas do servidor.** O que só o servidor sabe (dado em uso e ciclo) volta com o campo, e a tela mostra a recusa no campo certo. Pela API, basta a primeira recusa, com a mensagem e o campo.<br>- **Nada é gravado** numa recusa: nem o cadastro, nem o outro lado do cônjuge. O cadastro novo recusado também não deixa conta de acesso criada, como na RN-09 do E2.02.<br>- As mensagens deste spec substituem as genéricas de hoje, como "Já existe um membro com este e-mail, CPF ou celular.". | legado (`UI/pages/Members/details.js:146-176`: todos os erros juntos, cada um no campo; o `MemberDtoValidator` também devolve todos os erros); conta de acesso: RN-09 e DT-21 do E2.02; ordem e "todos de uma vez": definida pelo spec (P-VAL-18); formato ao sair do campo: definida pelo spec (P-VAL-19, PO-UX-1) |

#### Onde cada regra vale
| RN | Tipo | Cadastro novo | Edição | Sistema (service role e rotinas internas) | Carga do legado |
|---|---|---|---|---|---|
| RN-02 Nome | (b) | sim | se o nome muda | sim | não; o nome vem como está, só com os espaços ajustados |
| RN-03 Sexo | (a) | sim | sempre | sim | sim (`0` → M, `1` → F) |
| RN-04 E-mail | (a) | sim | sempre | sim | sim; o e-mail inválido fica vazio |
| RN-05 E-mail fictício | (b) | sim | se o e-mail muda | só o sistema gera | gera os próprios (6.2) |
| RN-06 Celular | (b) | sim | se o celular muda | sim | não; vem como está e é listado |
| RN-07 CPF | (a) | sim | sempre | sim | sim; o CPF inválido fica vazio e é listado |
| RN-08 Identificador | (b) | sim | se a edição tira o último | sim | não; sem identificador, o cadastro migra sem conta (5.4) |
| RN-09 Unicidade | (a) | sim | sempre | sim | sim; os repetidos são corrigidos no legado |
| RN-11 Situação de liderança | (a) | sim | sempre | sim | sim (5.5) |
| RN-12 Líder obrigatório | (b) | sim | se o líder ou as marcas mudam | sim | não; quem não tem líder vira pastor ou sem liderança (5.5) |
| RN-13 Ciclos | (a) | sim | sempre | sim | sim; corrigir no legado |
| RN-14 Cônjuge | (a) | sim | sempre | sim | sim; o cônjuge de si mesmo é desfeito |
| RN-15 Nascimento | (b) | sim | se a data muda | sim | não; vem como está e é listado |
| RN-16 Batismo | (a) | sim | sempre | sim | sim; a data fica vazia sem batismo (5.5) |

#### Dados do legado
A tabela completa a 5.4 e a 5.5 do `docs/migracao.md`. Na última coluna, "nova" indica uma linha que ainda não está no plano.

| Situação no legado | Tratamento | Regra | No plano hoje |
|---|---|---|---|
| E-mail repetido entre não excluídos, sem diferenciar maiúsculas e espaços | Corrigir no legado (E4.05). A carga não termina enquanto houver. | RN-09 | sim (5.4) |
| Celular repetido entre não excluídos | Idem, comparando com a leitura da RN-06 e a equivalência do 9º dígito | RN-09 | ajustar a comparação |
| CPF repetido entre não excluídos (só os válidos; os inválidos ficam vazios antes) | Idem | RN-09 | sim (5.4) |
| CPF inválido, inclusive com os 11 dígitos iguais ou com menos de 11 dígitos | Fica vazio e é listado | RN-07 | sim (5.4); acrescentar a definição |
| E-mail fora do formato da RN-04, ou num domínio fictício | Fica vazio, e a conta usa um e-mail fictício (6.2). É listado. | RN-04, RN-05 | sim (5.4); acrescentar a definição |
| Celular fora do formato da RN-06 | Migra como está, só com dígitos, e é listado, com destaque quando é o único identificador | RN-06, RN-08 | nova |
| Sem identificador real | Migra sem conta de acesso e é listado | RN-08 | sim (5.4, "sem e-mail e sem celular"); alinhar com o CPF no E4.08 (impacto do E1.04) |
| Nome com uma palavra só | Migra como está, com os espaços ajustados. É listado só para informação. | RN-02 | nova |
| Nascimento futuro, ou de 100 anos atrás ou mais | Migra como está e é listado | RN-15 | nova |
| Data do batismo de quem não é batizado | Fica vazia | RN-16 | sim (5.5) |
| Sexo | `0` → M, `1` → F. O legado sempre tem. | RN-03 | sim (5.5) |
| "Não tem liderança" marcado, com líder | O líder é descartado (sem liderança) | RN-11 | sim (5.4, 5.5) |
| Sem líder e sem "Não tem liderança" | Pastor, só para Samuel e Magda (D9). Os demais seguem o saneamento e, se não forem corrigidos, ficam sem liderança. | RN-11, RN-12 | sim (5.4, 5.5) |
| "Tem Liderança?" no novo | Ligado só para quem tem líder; desligado para pastores e para quem está sem liderança | RN-11 | ajustar a 5.5 (deixar explícito) |
| Ciclo na liderança | Corrigir no legado. A carga não termina enquanto houver. | RN-13 | sim (5.4) |
| Cônjuge apontando para a própria pessoa | O vínculo é desfeito e listado | RN-14 | nova |
| Cônjuge não recíproco | Corrigir no legado | MEM-10 | sim (5.4) |

### Critérios de aceite
Convenções:
- "Pela API" é qualquer chamada feita fora da tela, com a sessão do usuário citado.
- "Recusado" quer dizer que nada é gravado (RN-19).
- "Hoje" é 23/11/2026 em Brasília, a não ser quando o critério diz outra coisa.

Massa de exemplo:

| Pessoa | Situação |
|---|---|
| Samuel e Magda | pastores (casal), sem líder |
| Pedro | G12, discípulo de Samuel. Função Líder: vê só o ministério, tem "Criar Membro" e "Editar Membro" e não tem "Ver Dados Sensíveis". |
| André | discípulo de Pedro |
| Caio | discípulo de André; função Membro ("Editar Próprio Cadastro"); batizado em 10/05/2020; e-mail caio@exemplo.com; celular (51) 98888-7777; sem CPF |
| Davi | discípulo de Caio, inativo, não batizado; e-mail davi@exemplo.com |
| Rita | função Administrador: vê a igreja toda e os dados sensíveis |
| Diego | líder de outro ministério, que Pedro não vê; CPF 529.982.247-25 |
| Ester | sem liderança |
| Otávio e Olga | casal; Otávio tem o celular (51) 97777-0000 |
| Fábio | veio do legado: nome "Fábio" (uma palavra só), inativo, nascido em 10/03/1920, celular 98887777 (sem DDD), sem e-mail e sem CPF, discípulo de André |
| Bruno | excluído (E2.01), com o celular (51) 8888-0000 |

- **RN-01**
  - Dado um script com a service role
  - Quando ele muda o nome de Caio para "Caio"
  - Então a gravação é recusada com "Informe o nome e o sobrenome.".
  - Dado Caio, sem "Editar Membro"
  - Quando ele tenta, pela API, mudar o nome de André para "André"
  - Então recebe a recusa de permissão (E1.03), e não a do nome.
  - Dada a carga do legado com Fábio
  - Quando ela roda
  - Então Fábio é carregado com o nome "Fábio", o celular 98887777 e o nascimento de 1920, e aparece no relatório de saneamento (RN-18).
- **RN-02**
  - Quando Rita cadastra "  Ana   Souza " ou "Ana B."
  - Então o cadastro é aceito, com o nome gravado como "Ana Souza" ou "Ana B.".
  - Quando Rita cadastra "Ana", "Ana 2" ou "Ana ."
  - Então vê "Informe o nome e o sobrenome.", e nada é gravado.
  - Quando Caio muda o próprio nome para "Caio"
  - Então recebe a mesma mensagem.
  - Quando Rita muda só as observações de Fábio
  - Então a gravação é aceita, e o nome continua "Fábio".
  - Quando Rita muda o nome de Fábio para "Fabio"
  - Então recebe "Informe o nome e o sobrenome.". Com "Fábio Lima", a gravação é aceita.
- **RN-03**
  - Quando Rita abre o cadastro novo
  - Então nenhuma opção de Sexo vem marcada.
  - Quando ela salva sem escolher o sexo
  - Então vê "Informe o sexo.", e nada é enviado.
  - Quando alguém envia pela API o sexo "Masculino", "X" ou vazio, num cadastro novo ou no de Caio
  - Então a gravação é recusada. Com "M", ela é aceita.
  - Dada a publicação deste passo
  - Então nenhum cadastro fica sem sexo ou com um valor diferente de M e F.
- **RN-04**
  - Quando Rita cadastra o e-mail " Ana.Souza@Exemplo.COM "
  - Então ele é gravado como "ana.souza@exemplo.com".
  - Quando o e-mail é "ana@exemplo", "ana@.com", "ana @exemplo.com", "ana@@exemplo.com" ou "ana@exemplo..com"
  - Então a tela mostra "E-mail inválido. Confira o endereço digitado.", e a API recusa com a mesma mensagem.
  - Quando o e-mail é "ana.souza@igreja.org.br"
  - Então ele é aceito.
- **RN-05**
  - Quando Rita cadastra Lúcia só com o celular (51) 98888-1234
  - Então o cadastro e a conta de acesso são criados, e o e-mail de Lúcia aparece como não informado. Lúcia entra pelo celular, e não pelo e-mail fictício (E1.04).
  - Quando alguém digita "lucia@mci12fakemail.com", ou um e-mail no domínio da D7, pela tela ou pela API
  - Então recebe "Este e-mail não pode ser usado. Informe um e-mail real ou deixe o campo em branco.".
  - Quando um cadastro novo chega pela API com um e-mail fictício montado por quem chama
  - Então é recusado com a mesma mensagem. O e-mail fictício só é criado pelo sistema.
  - Quando Rita informa lucia@exemplo.com no cadastro de Lúcia e, depois, apaga esse e-mail
  - Então o e-mail real substitui o fictício. Depois de apagado, o e-mail volta a "não informado", e Lúcia continua entrando pelo celular.
- **RN-06**
  - Quando Rita informa "+55 (51) 98888-1234" ou "051 98888-1234"
  - Então o celular é gravado como 51988881234.
  - Quando ela informa "(55) 99999-1111" (DDD de Santa Maria)
  - Então o celular é gravado como 55999991111, sem perder o DDD.
  - Quando ela informa "(51) 3333-4444"
  - Então o celular é aceito, com 10 dígitos.
  - Quando ela informa "98888-1234" (sem DDD) ou "(51) 98888-12345"
  - Então vê "Celular inválido. Informe o DDD e o número.".
  - Quando Rita cola "+55 (51) 98888-7777" no campo Celular e sai dele
  - Então o campo mostra "(51) 98888-7777", e o cadastro grava 51988887777. Nenhum dígito é cortado. É o defeito de hoje, em que a máscara corta em 11 dígitos e mostra "(55)51988-8877", um número errado que seria aceito com o DDD 55; ele é corrigido neste passo.
  - Quando ela digita ou cola "5551988887777" ou "051 98888-7777"
  - Então o campo também mostra "(51) 98888-7777" ao sair dele.
  - Quando ela corrige o 3º dígito de "(51) 98888-7777"
  - Então os outros dígitos não mudam de lugar.
- **RN-07**
  - Quando Rita informa o CPF "111.444.777-35" ou "012.345.678-90"
  - Então ele é gravado como 11144477735 ou 01234567890, com o zero à esquerda.
  - Quando ela informa "111.444.777-36", "111.111.111-11" ou "1144477735"
  - Então vê "CPF inválido. Se a pessoa não tem CPF, deixe o campo em branco.".
  - Dada a publicação deste passo
  - Então nenhum cadastro tem CPF inválido.
- **RN-08**
  - Quando Rita abre o cadastro novo
  - Então Celular, E-mail e CPF aparecem juntos no grupo "Identificação", com a dica "A pessoa entra no sistema com o celular, o e-mail ou o CPF. Informe pelo menos um.".
  - Quando Rita cadastra Lúcia sem e-mail, celular nem CPF
  - Então vê, no lugar da dica, "Informe o e-mail, o celular ou o CPF. A pessoa usa um deles para entrar no sistema.".
  - Quando ela cadastra Lúcia só com o CPF 111.444.777-35
  - Então o cadastro é aceito.
  - Quando Caio apaga o próprio e-mail, mantendo o celular
  - Então a gravação é aceita.
  - Quando, depois disso, Caio apaga o celular
  - Então recebe a mensagem acima, e o celular continua gravado.
  - Quando Rita apaga o único identificador de Davi (inativo) ou de Magda (pastora)
  - Então recebe a mesma recusa.
  - Quando Rita muda as observações de Fábio, que não tem identificador real
  - Então a gravação é aceita.
  - Quando Pedro edita André pela API e envia e-mail, celular e CPF vazios
  - Então esses campos não mudam (RN-12 do E1.08), e não há recusa.
- **RN-09**
  - Quando Rita cadastra Lúcia com "CAIO@exemplo.com "
  - Então vê "Este e-mail já está sendo usado por outro cadastro.".
  - Quando ela cadastra Lúcia com "(51) 8888-7777", sem o 9
  - Então vê "Este celular já está sendo usado por outro cadastro.", porque Caio tem (51) 98888-7777.
  - Quando Pedro cadastra Lúcia com o CPF de Diego, que é de outro ministério
  - Então vê "Este CPF já está sendo usado por outro cadastro.".
  - Quando Rita cadastra Lúcia com davi@exemplo.com
  - Então recebe a recusa do e-mail, porque o inativo conta.
  - Quando Rita informa o celular de Otávio no cadastro de Olga, esposa dele
  - Então recebe "Este celular já está sendo usado por outro cadastro.".
  - Quando Rita cadastra Lúcia com (51) 98888-0000, o celular de Bruno sem o 9
  - Então a unicidade não recusa, porque Bruno está excluído. Aparece o aviso da RN-18 do E2.01.
  - Dados Bruno, excluído, e Lúcia, cadastrada depois com (51) 98888-0000
  - Quando Rita tenta restaurar Bruno
  - Então recebe "Não é possível restaurar: outro cadastro já usa este celular." (RN-16 e do E2.01).
  - Dado que Caio trocou o e-mail para caio.novo@exemplo.com
  - Quando Rita cadastra Lúcia com caio@exemplo.com
  - Então o cadastro e a conta de acesso de Lúcia são criados, e Lúcia entra com caio@exemplo.com.
  - Quando Rita e Pedro cadastram, ao mesmo tempo, duas pessoas com o CPF 111.444.777-35
  - Então só uma é gravada. A outra recebe "Este CPF já está sendo usado por outro cadastro.", e nenhuma conta de acesso fica criada para ela.
- **RN-10**
  - Quando Pedro cadastra Lúcia com o e-mail de Caio e o CPF de Diego
  - Então a recusa cita os dois dados ("Este e-mail…" e "Este CPF…"). Nem a tela nem a resposta da API trazem o nome, o id ou outro dado de Caio ou de Diego.
  - Quando Rita faz o mesmo cadastro
  - Então recebe as mesmas mensagens, também sem nomes.
  - Quando Rita cadastra Lúcia com o e-mail de Caio e o CPF de um membro excluído
  - Então só a recusa do e-mail aparece, sem o aviso de cadastro excluído.
  - Quando ela corrige o e-mail e salva de novo
  - Então aparece o aviso da RN-18 do E2.01 para o CPF.
  - Quando Pedro edita André e envia pela API o e-mail de Caio
  - Então o e-mail de André não muda (RN-12 do E1.08), e não há recusa.
- **RN-11**
  - Quando Rita liga "É Pastor(a)?" no cadastro de André, que tem o líder Pedro
  - Então "Tem Liderança?" e o Líder dão lugar a "Pastor(a) não tem líder.", e a tela avisa "Ao salvar, Pedro deixa de ser o líder.".
  - Quando ela desliga "É Pastor(a)?" de novo, antes de salvar
  - Então Pedro volta como líder, com "Tem Liderança?" ligado.
  - Quando ela liga "É Pastor(a)?" e salva
  - Então André fica pastor, sem líder.
  - Quando alguém envia pela API "É Pastor(a)?" ligado para André, mantendo o líder
  - Então recebe "Pastor(a) não tem líder. Tire o líder ou desmarque "É Pastor(a)?".", e nada muda.
  - Quando alguém envia pela API um líder para Samuel, ou liga "Tem Liderança?" no cadastro dele, sem líder
  - Então recebe a mesma recusa.
  - Quando Rita escolhe André como líder de Ester pela API, sem mexer em "Tem Liderança?"
  - Então a gravação é aceita, e "Tem Liderança?" de Ester fica ligado.
  - Quando alguém liga "Tem Liderança?" no cadastro de Ester pela API, sem líder
  - Então recebe "Escolha o líder.".
  - Dada a publicação deste passo
  - Então todo cadastro está numa das três situações da regra.
- **RN-12**
  - Quando Rita abre o cadastro novo
  - Então "Tem Liderança?" já vem ligado, com o líder vazio.
  - Quando ela salva sem líder
  - Então vê "Escolha o líder ou desligue "Tem Liderança?".".
  - Quando ela desliga "Tem Liderança?" e salva
  - Então o cadastro é aceito, e a pessoa fica sem liderança.
  - Quando Pedro salva um cadastro novo sem líder
  - Então vê "Escolha o líder." (E2.02).
  - Quando Rita envia pela API um cadastro novo sem líder, sem "É Pastor(a)?" e sem "Tem Liderança?"
  - Então ele é recusado com "Escolha o líder.".
  - Quando ela envia o mesmo cadastro com "Tem Liderança?" desligado, ou com "É Pastor(a)?" ligado
  - Então ele é aceito, sem liderança ou como pastor.
  - Quando Rita tira o líder de Caio sem desligar "Tem Liderança?"
  - Então recebe a recusa acima. Desligando "Tem Liderança?", a gravação é aceita, e Caio fica sem liderança.
  - Quando Pedro, pela API, tira o líder de André e desliga "Tem Liderança?"
  - Então recebe a recusa da RN-10 do E2.02, porque só quem vê a igreja toda marca alguém como sem liderança.
  - Quando Rita desliga "Tem Liderança?" no cadastro de Caio, que tem o líder André
  - Então o Líder some, e a tela avisa "Ao salvar, André deixa de ser o líder. A pessoa fica sem liderança.". Religar antes de salvar devolve André.
  - Quando Rita desliga "É Pastor(a)?" no cadastro de Samuel
  - Então "Tem Liderança?" aparece ligado, com o Líder vazio e obrigatório.
  - Quando ela salva sem escolher o líder
  - Então vê "Escolha o líder ou desligue "Tem Liderança?".". Desligando "Tem Liderança?", a gravação é aceita, e Samuel fica sem liderança.
  - Quando Rita envia pela API só "É Pastor(a)?" desligado para Magda
  - Então a gravação é aceita, e Magda fica sem liderança, porque o "Tem Liderança?" gravado dela é desligado.
- **RN-13**
  - Quando Rita escolhe Caio como líder do próprio Caio, pela API
  - Então recebe "Uma pessoa não pode ser líder de si mesma.".
  - Quando ela escolhe Davi, discípulo inativo de Caio, como líder de André
  - Então recebe "O líder escolhido é discípulo desta pessoa (direto ou indireto). Escolha outro líder.".
  - Dada uma cadeia de 8 níveis, de N1 a N8, em que cada um é líder do seguinte
  - Quando Rita escolhe N8 como líder de N1
  - Então recebe a mesma recusa.
  - Dados Lúcia e Paulo, os dois no ministério de Pedro, nenhum dos dois na descendência do outro
  - Quando Rita escolhe Paulo como líder de Lúcia e, ao mesmo tempo, Pedro escolhe Lúcia como líder de Paulo
  - Então só uma das duas gravações é aceita, e a outra recebe a recusa do ciclo.
  - Quando Rita abre o seletor de líder no cadastro de André
  - Então André não aparece, e Caio e Davi (inativo) aparecem sem poder ser escolhidos, com "Discípulo desta pessoa".
- **RN-14**
  - Quando alguém envia pela API Caio como cônjuge do próprio Caio
  - Então recebe "Uma pessoa não pode ser cônjuge de si mesma.", e nada muda.
  - Quando Rita abre o seletor de cônjuge no cadastro de Caio
  - Então Caio não aparece entre as opções.
- **RN-15**
  - Dado que agora são 23/11/2026, 23:30 em Brasília (24/11/2026, 02:30 em UTC)
  - Quando Rita informa o nascimento 24/11/2026
  - Então vê "A data de nascimento não pode ser futura.". Com 23/11/2026, a data é aceita.
  - Quando ela informa 23/11/1926
  - Então vê "Confira a data de nascimento: a pessoa teria 100 anos ou mais.". Com 24/11/1926, a data é aceita.
  - Quando ela deixa a data em branco
  - Então o cadastro é aceito.
  - Quando ela informa 14/02/1992
  - Então a tela mostra "34 anos" embaixo da data.
  - Quando Rita muda o nome de Fábio, nascido em 1920, para "Fábio Lima"
  - Então a gravação é aceita.
  - Quando ela muda o nascimento de Fábio para 10/03/1921
  - Então a data é recusada. Com 10/03/1960, ela é aceita.
  - Dada Lúcia, cadastrada em 23/11/2026 com o nascimento 24/11/1926
  - Quando, em 25/11/2026, Rita muda o telefone de Lúcia
  - Então a gravação é aceita.
- **RN-16**
  - Quando Rita desliga "Batizado(a)?" no cadastro de Caio
  - Então a data some, e a tela avisa "Ao salvar, a data do batismo (10/05/2020) será apagada.". Religar antes de salvar devolve a data.
  - Quando ela desliga "Batizado(a)?" e salva
  - Então Caio fica não batizado e sem data.
  - Quando alguém envia pela API só "Batizado(a)?" desligado para Caio
  - Então a gravação é aceita, e a data é apagada.
  - Quando alguém envia pela API a data 10/05/2020 para Davi, que continua não batizado
  - Então recebe "A data do batismo só pode ser informada para quem é batizado(a).".
  - Quando Rita liga "Batizado(a)?" para Davi, com ou sem data
  - Então a gravação é aceita.
- **RN-17**
  - Quando Rita abre o cadastro de Fábio e salva sem mexer em nada
  - Então nada muda: o nome "Fábio", o celular 98887777 e o nascimento de 1920 continuam.
  - E a tela mostra, nesses três campos, avisos que não impedem salvar.
  - Quando Pedro, que não vê os dados sensíveis, muda as observações de Fábio
  - Então a gravação é aceita, e Pedro não vê o aviso do celular, porque não vê o campo.
  - Quando Rita muda o celular de Fábio para "(51) 98887-7770"
  - Então a gravação é aceita. Com "9888-7770", ela vê "Celular inválido. Informe o DDD e o número.".
  - Dado Caio, com o celular gravado como 51988887777
  - Quando a tela envia "(51) 98888-7777"
  - Então o celular não conta como alterado, e nada é conferido nele.
- **RN-18**
  - Dada uma cópia do legado com dois membros não excluídos com os celulares 5188887777 e 51988887777
  - Quando o saneamento roda
  - Então os dois aparecem como celular repetido. Se não forem corrigidos no legado, a carga não termina.
  - Dado um membro do legado com o cônjuge apontando para ele mesmo
  - Quando a carga roda
  - Então ele é carregado sem cônjuge e aparece no relatório de saneamento.
  - Dado um membro do legado com o e-mail "joao@" e um celular válido
  - Quando a carga roda
  - Então ele é carregado sem e-mail real, com a conta no e-mail fictício (6.2), e é listado.
  - Dado um membro do legado não batizado, com data de batismo
  - Quando a carga roda
  - Então ele é carregado sem a data.
  - Dada a carga terminada
  - Quando a reconciliação roda
  - Então nenhum cadastro viola as RN-03, RN-04, RN-07, RN-09, RN-11, RN-13, RN-14 e RN-16.
- **RN-19**
  - Quando Rita tenta cadastrar Lúcia com o nome "Lúcia", o e-mail "lucia@", o CPF "111.111.111-11" e sem sexo
  - Então a tela mostra os quatro erros de uma vez, cada um no seu campo, e não envia nada.
  - Quando ela digita "111.111.111-11" no CPF e sai do campo
  - Então vê o erro do CPF na hora, sem nenhuma chamada ao servidor. Corrigido o CPF, o erro some sem precisar sair do campo.
  - Quando ela passa por um campo sem preencher, ou ainda está digitando
  - Então nenhum erro aparece nesse campo.
  - Quando ela digita o e-mail de Caio e sai do campo
  - Então nenhum erro aparece, e nada é consultado no servidor. A recusa de dado em uso só vem ao salvar.
  - Quando um cadastro novo é recusado pelo servidor porque o CPF está em uso
  - Então nenhum cadastro e nenhuma conta de acesso ficam criados.
  - Quando Rita escolhe Olga como cônjuge de Ester e a gravação é recusada por outro motivo (por exemplo, o nome)
  - Então nem Ester nem Olga mudam, e o vínculo de Olga com Otávio continua.

### Textos de tela
Vocabulário de referência. O `ux-designer` pode ajustar o tom, mas não o sentido nem os termos. Os textos vindos do desenho de UX e aprovados pelo PO em 2026-11-23 (PO-UX-2, PO-UX-5 a PO-UX-8) já estão na tabela.
- **Termos:** Nome, Sexo (Masculino, Feminino), Identificação (o grupo de Celular, E-mail e CPF), E-mail, Celular / WhatsApp, CPF, Data de nascimento, É Pastor(a)?, Tem Liderança?, Líder, Cônjuge, Batizado(a)?, Data do batismo, cadastro.
- **Evitar:** "Gênero" no rótulo do sexo, "usuário" no lugar de cadastro ou membro e "e-mail fictício" na tela (lá, ele aparece como "não informado").

| Situação | Texto |
|---|---|
| nome | Informe o nome e o sobrenome. |
| sexo | Informe o sexo. |
| e-mail inválido | E-mail inválido. Confira o endereço digitado. |
| e-mail fictício digitado | Este e-mail não pode ser usado. Informe um e-mail real ou deixe o campo em branco. |
| celular inválido | Celular inválido. Informe o DDD e o número. |
| CPF inválido | CPF inválido. Se a pessoa não tem CPF, deixe o campo em branco. |
| dica do grupo Identificação | A pessoa entra no sistema com o celular, o e-mail ou o CPF. Informe pelo menos um. |
| sem identificador (no lugar da dica) | Informe o e-mail, o celular ou o CPF. A pessoa usa um deles para entrar no sistema. |
| dado em uso | Este e-mail já está sendo usado por outro cadastro. · Este celular já está sendo usado por outro cadastro. · Este CPF já está sendo usado por outro cadastro. |
| líder (quem vê só o ministério, E2.02) | Escolha o líder. |
| líder (quem vê a igreja toda) | Escolha o líder ou desligue "Tem Liderança?". |
| "Tem Liderança?" desligado | A pessoa fica sem liderança. |
| "É Pastor(a)?" ligado (no lugar de "Tem Liderança?" e do Líder) | Pastor(a) não tem líder. |
| aviso de interruptor (antes de salvar) | Ao salvar, {Nome} deixa de ser o líder. · Ao salvar, {Nome} deixa de ser o líder. A pessoa fica sem liderança. · Ao salvar, a data do batismo ({dd/mm/aaaa}) será apagada. |
| pastor com líder (recusa do servidor) | Pastor(a) não tem líder. Tire o líder ou desmarque "É Pastor(a)?". |
| líder de si mesmo | Uma pessoa não pode ser líder de si mesma. |
| ciclo | O líder escolhido é discípulo desta pessoa (direto ou indireto). Escolha outro líder. |
| discípulo no seletor de líder | Discípulo desta pessoa |
| cônjuge de si mesmo | Uma pessoa não pode ser cônjuge de si mesma. |
| nascimento futuro | A data de nascimento não pode ser futura. |
| nascimento com 100 anos ou mais | Confira a data de nascimento: a pessoa teria 100 anos ou mais. |
| idade | {N} anos · 1 ano · Menos de 1 ano |
| batismo sem "Batizado(a)?" (API) | A data do batismo só pode ser informada para quem é batizado(a). |
| aviso de dado antigo (não impede salvar) | Nome sem sobrenome. Complete quando puder. · Celular fora do formato. Corrija quando puder. · Data de nascimento fora do intervalo aceito. Confira quando puder. · Sem e-mail, celular ou CPF: esta pessoa não consegue entrar no sistema. |
| topo do formulário | Campos com * são obrigatórios. |
| resumo ao salvar com erro | Confira os campos destacados ({N}). |
| queda de conexão ao salvar | Não foi possível salvar o cadastro. Verifique a conexão e tente de novo. |

### Telas afetadas
- **Formulário de membro (`MemberForm`)**, no cadastro e na edição, inclusive "Editar meus dados":
  - Nome e Sexo marcados como obrigatórios e vindo primeiro; Sexo sem opção marcada no cadastro novo (RN-03);
  - Celular, E-mail e CPF juntos no grupo "Identificação", com a dica (RN-08);
  - os erros de formato aparecem ao sair do campo alterado, e todos os erros de preenchimento aparecem juntos ao salvar, cada um no seu campo; as recusas do servidor (dado em uso, ciclo) aparecem no campo certo (RN-19);
  - no cadastro feito por quem vê a igreja toda, "Tem Liderança?" já vem ligado, e desmarcar um pastor também pede o líder (RN-12);
  - ligar "É Pastor(a)?" tira o líder e desliga "Tem Liderança?" (RN-11);
  - os interruptores avisam o que será apagado ao salvar, e desfazer o toque devolve o dado (RN-11, RN-12, RN-16);
  - desligar "Batizado(a)?" apaga a data (RN-16);
  - a data de nascimento não aceita datas futuras nem de 100 anos atrás ou mais, e mostra a idade (RN-15);
  - o seletor de líder mostra os discípulos da pessoa sem poder ser escolhidos (RN-13);
  - celular e CPF são conferidos, a máscara do celular deixa de cortar dígitos, e o e-mail fictício é recusado (RN-05 a RN-07);
  - os campos antigos fora da regra mostram avisos que não impedem salvar (RN-17);
  - o rótulo "Gênero" passa a "Sexo" (RN-03);
  - o navegador deixa de gerar o e-mail fictício (RN-05).
- **Recusas do cadastro com conta de acesso (`create-user-admin`):** uma mensagem por dado em uso (RN-10), no lugar de "Já existe um membro com este e-mail, CPF ou celular.".
- **Restaurar membro e aviso de cadastro excluído (E2.01):** nada muda na tela; os dois passam a usar a comparação da RN-09.
- Nenhuma tela nova. O login não muda.

### Fora de escopo
Cada item indica o passo que cuida dele, quando há um.
- **Senha:**
  - a senha obrigatória e a confirmação no cadastro, como no legado, foram trocadas pela senha inicial `123456` (D11);
  - a política de senha fica para o E3.02;
  - a troca e a redefinição, para o E2.03.
- **Endereço, telefone fixo, Instagram e foto:** sem validação nova. O legado não validava esses campos no cadastro de membro. O CEP continua preenchendo o endereço.
- **Sexo do cônjuge** (marido e esposa de sexos diferentes): o legado não exige, então não entra (ver Perguntas em aberto).
- **Sexo do líder** (homens discipulam homens): o legado não exige, então não entra (ver Perguntas em aberto).
- **Líder inativo:** o legado aceita, então não entra.
- **Data do batismo futura ou anterior ao nascimento:** o legado não confere, então não entra (ver Perguntas em aberto).
- **Tamanho máximo do nome e maiúsculas automáticas:** o legado não tem, então não entram.
- **DDD válido e números estrangeiros:** não há lista de DDDs. Quem só tem número estrangeiro usa o e-mail ou o CPF.
- **Hierarquia:** o nível e o caminho de liderança (HIE-02, HIE-03) e os totais (HIE-04) ficam no E2.06. A HIE-01 (ciclos) vem para este passo.
- **Líder já preenchido com quem cadastra, para todos** (MEM-15): E2.07. O E2.02 antecipa isso para quem vê só o ministério.
- **Quem marca pastor e sem liderança** e quem pode ser escolhido como líder e cônjuge (pessoas visíveis): E2.02 (RN-09, RN-10).
- **Excluídos** como líder ou cônjuge, e o aviso de cadastro excluído: E2.01 (RN-06, RN-18).
- **Filtros da lista de Membros** (MEM-13), inclusive "possui liderança": E2.07, com as situações da RN-11.
- **Validações de células e de relatórios:** E2.08 e E2.11.
- **Migração:**
  - login (E1.04);
  - troca do domínio fictício (E1.06);
  - saneamento (E4.04 e E4.05);
  - carga (E4.06);
  - contas de acesso (E4.08);
  - reconciliação (E4.09).
- **Juntar cadastros duplicados:** sem passo no plano. Os duplicados do legado são corrigidos pela liderança no próprio legado (E4.05).
- **Auditoria das recusas:** as tentativas recusadas não vão para a Auditoria. Ela continua registrando o que é gravado.
- **Limite de tentativas na unicidade.** Quem pode gravar um cadastro descobre se um e-mail, celular ou CPF já está em uso, como no legado, mas nunca de quem é (RN-10). Não há limite de tentativas para isso.
- **Consolidação:** o consolidado não é membro. O spec da Consolidação define quais destas regras valem para ele (por exemplo, se precisa de identificador ou de líder) e se a unicidade inclui os consolidados.

### Impactos em outros passos
Pontos de negócio que outros passos precisam respeitar. O `architect` decide como.
- **E2.01:**
  - a RN-16 (e) e a RN-18 passam a comparar o celular com a equivalência do 9º dígito (RN-09);
  - se o E2.01 for implementado antes, com a comparação só por dígitos, o E2.04 ajusta essa comparação, que fica num lugar só (DT-17);
  - a unicidade vem antes do aviso da RN-18 (RN-10).
- **E1.04:**
  - depois da carga, a ambiguidade da RN-05 do E1.04 só acontece quando o CPF de um cadastro é igual ao celular de outro, um caso raro que este passo não proíbe;
  - a `sign-in` ignora os dois domínios fictícios, como a RN-05 deste spec.
- **E1.06:** o domínio novo entra na lista dos domínios fictícios recusados (RN-05).
- **E2.02:**
  - a MEM-07 segue a RN-10 do E2.02: sem líder, só com a decisão de quem vê a igreja toda;
  - a DA-11 (ligar "Tem Liderança?" quando há líder) continua valendo, e a RN-11 deste spec acrescenta o outro lado (ligado exige líder) e o pastor sem líder para todos;
  - a ordem das recusas segue a RN-19.
- **E2.06:**
  - a HIE-01 sai do E2.06 e fica neste passo (RN-13). O E2.06 continua com a HIE-02 a HIE-04;
  - com o sexo sempre M ou F (RN-03), as funções de totais não precisam mais aceitar "Masculino" e "Feminino".
- **E2.07:** o filtro "possui liderança" usa as três situações da RN-11.
- **E4.04, E4.05 e E4.06:** a 5.4 e a 5.5 recebem as linhas novas da tabela [Dados do legado](#dados-do-legado), e as definições de CPF, e-mail e celular válidos são as das RN-04, RN-06 e RN-07.
- **E4.08:** o membro que só tem CPF também recebe conta de acesso, como o E1.04 já recomendou, para que a D5 valha para ele.
- **E4.09:** a reconciliação confere as regras do tipo (a) (RN-18).
- **Aceite (PO):**
  - no `docs/migracao.md`: MEM-01 a MEM-09 em ✅; a HIE-01 marcada como feita no E2.04; o texto do E2.06 ajustado (HIE-02 a HIE-04); as linhas novas na 5.4 e o "Tem Liderança?" na 5.5;
  - no `CLAUDE.md`: a linha "Validações de membro" da matriz de paridade em ✅, e o item de `gender` das "Armadilhas" resolvido.

### Pontos para o `architect`
Não são dúvidas de negócio. São pontos em que a regra depende de uma escolha técnica.
1. **Tipo (a), tipo (b) e a carga.**
   - A carga roda com `session_replication_role = replica`: os triggers ficam desligados, e os CHECKs e índices únicos continuam valendo.
   - Uma regra do tipo (a) imposta por trigger precisa ser garantida pela transformação e conferida na reconciliação.
   - Uma regra do tipo (b) não cabe em CHECK, porque depende do que mudou ou do dia de hoje.
2. **Dados de teste em produção.** Antes de criar as restrições do tipo (a), confira a produção, como na tarefa 1 do E2.02: sexo vazio, CPF inválido, e-mail fora do formato, repetidos, pastor com líder e cônjuge de si mesmo. Proponha a correção ao usuário antes de gravar no banco.
3. **Comparação única.**
   - Use `normalize_email` e `normalize_digits` (DT-17 do E2.01) e `normalize_mobile`, `mobile_match_key`, `is_valid_cpf` e `is_placeholder_email` (DT-08 do E1.04).
   - Os índices únicos são parciais, só entre os não excluídos.
   - A `find_deleted_member_matches` e a `restore_member`, do E2.01, usam a mesma chave do celular.
4. **Conta de acesso e cadastro.**
   - Hoje a conta de acesso guarda o e-mail com que foi criada.
   - A RN-09 (dado liberado, P-VAL-10) pede que um e-mail trocado ou apagado no cadastro possa ser usado por outra pessoa.
   - A RN-05 pede que o e-mail fictício seja gerado no servidor, e não no navegador. A 6.2 já usa um e-mail fictício determinístico na carga.
5. **Recusas por campo.**
   - Cada recusa traz o código e o campo, como na AQ-2 do E2.01, e o `23505` é traduzido conforme o índice.
   - A recusa por dado em uso cita todos os dados de uma vez, sem deixar conta de acesso órfã (DT-21 do E2.02) e sem trazer nada do outro cadastro.
6. **"O que muda" (RN-17).** A comparação é feita sobre os valores lidos como na regra de cada campo. O formulário não pode reformatar um valor que a pessoa não tocou, por exemplo pela máscara.
7. **"Tem Liderança?" omitido no cadastro pela API (RN-12).** Ele conta como "tem liderança", exceto para o pastor. Isso convive com a DA-11 e com o padrão atual da coluna.
8. **Ciclos (RN-13).** A conferência vale em qualquer profundidade, com trava contra trocas de líder simultâneas que formariam um ciclo juntas.
9. **Cônjuge (RN-14).** A mensagem do trigger atual, em inglês, passa para o texto em pt-BR.
10. **Formato do e-mail (RN-04).** O que este spec aceita também precisa ser aceito pelo Auth, para que um cadastro aceito não falhe ao criar a conta.
11. **Ordem de implementação.** Este passo usa as funções de normalização do E2.01 e do E1.04, e mexe nas mesmas regras de escrita de `members` que o E1.03 e o E2.02 (`enforce_member_write_rules`, `ac_enforce_member_scope`).

### Perguntas em aberto
Nenhuma bloqueante. Os pontos que as fontes não respondiam viraram padrões, listados em [Padrões definidos por este spec](#padrões-definidos-por-este-spec-revisar-no-pr), para o usuário revisar no PR. Os que mais mudam o resultado são:
- **P-VAL-16:** numa edição, só o que muda é conferido, e os campos antigos fora da regra mostram um aviso que não impede salvar.
- **P-VAL-07:** o celular é único com a equivalência do 9º dígito.
- **P-VAL-03:** o sexo passa a ser obrigatório.
- **P-VAL-12:** "Tem Liderança?" vem ligado no cadastro novo.
- **P-VAL-13:** os ciclos são conferidos neste passo, e não no E2.06.
- **P-VAL-10:** um e-mail liberado no cadastro pode ser usado por outra pessoa.
- **P-VAL-22:** desmarcar um pastor pela tela pede o líder. Pela API, sem líder e sem "Tem Liderança?", a pessoa fica sem liderança.

As pendências da UX (PO-UX-1 a PO-UX-8) foram resolvidas em 2026-11-23 e viraram os padrões P-VAL-19 a P-VAL-26.

Sugestões que não entram, porque o legado não tem a regra. O usuário decide se viram regra nova:
- **Q-1.** Exigir que marido e esposa tenham sexos diferentes?
- **Q-2.** Impedir data do batismo futura ou anterior ao nascimento?
- **Q-3.** Exigir que o líder seja do mesmo sexo do discípulo (homogeneidade), com exceção dos pastores? Atenção: com os dados atuais, essa regra pode barrar cadastros em que o discípulo foi ligado ao marido do casal, e não à esposa.

## Experiência (UX)
_Seção do `ux-designer`. Escrita em 2026-11-23 a partir destas fontes:_
- _a seção Negócio (RN-01 a RN-19, P-VAL-01 a P-VAL-18, a massa de exemplo e os Textos de tela);_
- _o `MemberForm` da `main` do `mci-connect` (`bef0877`);_
- _o que já foi desenhado para o mesmo formulário: a [T6 do E2.02](e2-02-perfis-escopo.md#t6-formulário-de-membro-memberform) (quem vê só o ministério, Função e "Meus dados") e a [T9 do E2.01](e2-01-exclusao-logica.md#t9-cadastro-com-dados-de-um-membro-excluído-memberform-rn-18) (cadastro com dados de um excluído)._

_Usa os padrões de Escolas (P1 a P6), do E2.01 (P7 a P9) e do E2.02 (P10 a P14). Os padrões novos começam em P20, porque o E2.03 está sendo desenhado em paralelo. Nenhuma regra de negócio foi criada aqui. Onde a tela precisou de algo que o spec não diz, a decisão é a mais conservadora, marcada como "definido pela UX" e listada em "Pendências para o PO". Os nomes das pessoas são os da massa de exemplo dos [Critérios de aceite](#critérios-de-aceite)._

### O que muda, tela a tela
Não há tela nova. Tudo acontece no formulário de membro (`MemberForm`), nos três lugares que o abrem: "Novo membro" e "Editar" em Membros, "Editar meus dados" no menu e o cadastro restaurado pelo aviso do E2.01.

| Parte do formulário | O que muda | Para quem |
|---|---|---|
| Estrutura (T1) | Diálogo responsivo (P1): tela cheia no celular, com o rodapé fixo das ações e do resumo de erros. Os campos são reordenados, com os obrigatórios primeiro. | todos que cadastram ou editam |
| Dados pessoais (T2) | "Gênero" vira "Sexo *", com as duas opções à vista. O nome pede o sobrenome. A data de nascimento tem limites e mostra a idade. | todos que cadastram ou editam |
| Identificação (T3) | Celular, e-mail e CPF ficam juntos, com a dica de que a pessoa entra com um deles. As máscaras não cortam dígitos. O e-mail fictício é recusado e nunca aparece. | quem vê os dados sensíveis do cadastro |
| Dados ministeriais (T4) | "Tem Liderança?" vem ligado no cadastro novo, e "É Pastor(a)?" tira o líder. Os interruptores avisam o que será apagado. Os discípulos da pessoa ficam fora da escolha do líder. | liderança: quem vê a igreja toda; batismo e cônjuge: quem tem "Editar Membro" |
| Erros ao salvar (T5) | Os erros aparecem todos juntos, cada um no seu campo, com o resumo no rodapé. As recusas do servidor também vão para o campo. | todos |
| Cadastro antigo (T6) | Os dados fora das regras do tipo (b) mostram avisos que não impedem salvar. | quem edita um cadastro vindo do legado |
| Envio (T7) | A falha de conexão aparece no rodapé, e fechar com alterações pede confirmação. | todos |

### Coerência com os outros specs
- **E2.02 (T5, T6 e UX-17 a UX-22):** continuam valendo, somados a este spec.
  - Quem vê só o ministério continua com o "Líder *" já preenchido, sem "É Pastor(a)?" e sem "Tem Liderança?", e vê pastor e sem liderança como texto (P12).
  - Também não mudam a Função, a dica de alcance do Cônjuge, "Meus dados" só para leitura e as recusas da T11.
  - **A UX-18 do E2.02** ("No formulário de Rita, … ficam como hoje") **é substituída pelas UX-15 a UX-18 deste spec** quando o E2.04 for ao ar. Até lá, ela continua valendo.
  - Para quem vê a igreja toda, os interruptores mudam de ordem (T4): a liderança fica junta, e "Ativo" passa para depois do Líder.
- **E2.01 (T9):** o aviso de cadastro excluído e a restauração não mudam.
  - Este spec só fixa a ordem (RN-10): as recusas por dado em uso aparecem primeiro, e o aviso só abre quando não há mais nenhuma.
  - O cadastro aberto depois de restaurar segue a T6 deste spec (avisos de dado antigo).
- **E2.03:** o campo de senha é dele. Este spec só:
  - reserva o lugar do campo na seção Acesso, ao lado da Função. Se o E2.03 escolher outro lugar, vale o dele;
  - pede que ele siga o P21 e o P22: a recusa da política de senha aparece embaixo do campo, entra no resumo do rodapé e recebe o foco, como os outros erros;
  - recomenda `autoComplete="new-password"` no campo (UXD-13).
- **E1.04:** "Identificação" é o nome do campo do login, com a mesma leitura do celular e do CPF. Os exemplos da T3 batem com a tabela "Indicador de tipo" de lá.

### Decisões de experiência
| # | Decisão | Por quê |
|---|---|---|
| UXD-1 | **O formulário passa para o diálogo responsivo (P1).** No celular, ele ocupa a tela, com cabeçalho e rodapé fixos, e "Criar membro" fica sempre à vista. | Hoje o diálogo inteiro rola, e "Criar membro" fica no fim de um formulário de mais de 20 campos, depois do Endereço. O resumo de erros (UXD-5) e a mensagem de conexão precisam de um rodapé fixo para ficar à vista. O P1 já existe (Escolas, E2.02). |
| UXD-2 | **Os obrigatórios vêm primeiro, e os três identificadores ficam juntos no grupo "Identificação", com a dica.** Ordem: Nome, Sexo, Data de nascimento, Celular, E-mail, CPF, Telefone, Instagram, Cônjuge e Observações. | A RN-08 é uma regra sobre os três juntos. Hoje eles estão espalhados (o e-mail no topo, o CPF no meio e o celular no fim), e o erro "informe um dos três" não teria onde ficar. "Identificação" é o nome do campo do login (E1.04), o que liga uma coisa à outra. O celular vem primeiro porque é o dado que quase todos têm. |
| UXD-3 | **Sexo com as duas opções à vista (`RadioGroup`), nenhuma marcada.** | É 1 toque, em vez dos 2 do `Select`, e as duas opções ficam visíveis. Não há padrão, porque o sexo passa a ser obrigatório, e um padrão esconderia a falta de escolha (PO-UX-3). |
| UXD-4 | **O formato é conferido ao sair do campo, e tudo é conferido ao salvar. O servidor só é consultado ao salvar.** O erro some assim que o valor fica certo, e nenhum erro novo aparece enquanto a pessoa digita. | No celular, o formulário é longo, e descobrir um CPF errado só no fim obriga a rolar de volta. Conferir só o campo que a pessoa alterou, ao sair dele, não incomoda quem ainda está preenchendo. A unicidade fica para o salvar, como a RN-18 do E2.01 (P-DEL-22), para não abrir uma consulta que revela dados de outras pessoas. |
| UXD-5 | **O resumo fica no rodapé fixo, e não no topo. O foco vai para o primeiro campo com erro.** | No celular, a pessoa toca em "Criar membro" no fim da tela. Um resumo no topo ficaria fora da vista, e pôr o foco nele a levaria para longe do campo. Com o foco no primeiro erro, o rodapé, sempre à vista, diz quantos faltam. Tocar de novo em "Criar membro" leva ao próximo. |
| UXD-6 | **As recusas do servidor vão para o campo, e o toast de erro sai do formulário.** | RN-19. Hoje a recusa vem num toast que some em segundos, com o título "Erro" e, às vezes, a mensagem técnica do banco. |
| UXD-7 | **Um interruptor que apaga outro campo avisa o que vai apagar, e dá para voltar atrás até salvar (P20).** | A RN-11 pede que o líder saia "à vista de quem edita". O mesmo vale para "Tem Liderança?" e "Batizado(a)?", que hoje escondem o campo e, no caso do batismo, continuam gravando a data. Um toque errado num interruptor não pode apagar um dado sem que a pessoa perceba. |
| UXD-8 | **Com "É Pastor(a)?" ligado, "Tem Liderança?" e o Líder somem, e aparece o texto "Pastor(a) não tem líder.".** | É o P12 do E2.02: o controle que nunca pode ser usado some. Com os dois à vista, a pessoa poderia ligar "Tem Liderança?" num pastor e só descobriria a recusa ao salvar. |
| UXD-9 | **As máscaras não cortam dígitos nem distorcem o valor (P23).** | A máscara de hoje corta o celular em 11 dígitos. Colado da agenda do celular, "+55 (51) 98888-7777" vira "(55)51988-8877": um número errado que, pela RN-06, seria aceito como válido (DDD 55). E um celular antigo de 8 dígitos, como o de Fábio, apareceria como "(98)8877-77". |
| UXD-10 | **Os avisos de dado antigo ficam no próprio campo e não impedem salvar (P24).** | RN-17. O aviso explica o problema onde ele está, e quem não vê o campo não recebe aviso sobre algo que não pode corrigir. |
| UXD-11 | **A idade aparece embaixo da data de nascimento**, como no legado. | Um ano digitado errado (1996 no lugar de 1966) salta à vista como "30 anos". É também um detalhe que os usuários do legado já conhecem. |
| UXD-12 | **No seletor de líder, os discípulos da pessoa aparecem desabilitados, com o motivo escrito.** | É o P5 de Escolas. Quem procura um nome e não o encontra conclui que a pessoa não está cadastrada. Desabilitado e com o motivo, entende por quê, e não descobre o ciclo só ao salvar. Depende da AQ-4. |
| UXD-13 | **`autoComplete="off"` nos campos pessoais e `"new-password"` na senha.** | O formulário quase sempre é sobre outra pessoa. O preenchimento automático do navegador ofereceria o nome, o e-mail e o celular de quem está cadastrando, que virariam "dado em uso". Ele também poderia pôr a senha salva da secretaria na senha do membro novo (campo do E2.03). |
| UXD-14 | **Fechar com alterações pede confirmação**, com os textos da T3 do E2.02. | Com internet fraca e muitos campos, perder o que foi digitado por um toque no "✕" custa caro. |

### Navegação e rotas
Nenhuma rota nova. O formulário continua abrindo nos mesmos lugares (ver "O que muda, tela a tela").

### Fluxos
A contagem é no celular, a partir da lista de Membros ou do menu fechado, incluindo o toque no ☰. "Toque" não conta a digitação.

| # | História | Caminho | Toques e telas |
|---|---|---|---|
| F1 | A secretaria cadastra uma pessoa com líder (Rita, desktop) | Membros → "Novo membro" → Nome → Sexo → Celular → Líder (busca e escolhe) → "Criar membro" | 5 cliques e a digitação. Hoje são 7: o Gênero pede 2 cliques, e "Tem Liderança?" precisa ser ligado antes de escolher o líder. |
| F2 | O líder cadastra um discípulo (Pedro) | ☰ → Membros → "Novo membro" → Nome → Sexo → Celular → Líder já preenchido (E2.02) → "Criar membro" | 5 toques e a digitação |
| F3 | Corrigir erros de preenchimento | "Criar membro" → foco no primeiro erro → corrige → "Criar membro", que leva ao próximo erro, se houver | +1 toque por rodada, e nada vai ao servidor |
| F4 | Dado em uso | "Criar membro" → erro no campo, com o foco → troca ou apaga o dado → "Criar membro" | +1 toque |
| F5 | Sem dado em uso, mas com o CPF de um excluído (E2.01) | … → "Criar membro" → aviso da T9 do E2.01 → "Cadastrar mesmo assim" ou "Restaurar {Nome}" | como no E2.01 |
| F6 | Cadastrar uma pessoa sem liderança (Rita) | … → desliga "Tem Liderança?" → "Criar membro" | +1 toque |
| F7 | Marcar um pastor (Rita edita André) | "Editar" → "É Pastor(a)?" → lê o aviso → "Salvar alterações" | 3 toques |
| F8 | Desfazer um batismo marcado por engano | "Editar" → "Batizado(a)?" → lê o aviso → "Salvar alterações" | 3 toques |
| F9 | Editar um cadastro antigo (Rita edita Fábio) | "Editar" → vê os avisos → muda as observações → "Salvar alterações" | 2 toques e a digitação, sem nenhum bloqueio |
| F10 | O membro troca o celular (Caio) | ☰ → "Editar meus dados" → Celular → "Salvar alterações" | 3 toques e a digitação, como hoje |
| F11 | A conexão cai ao salvar | "Criar membro" → mensagem no rodapé → "Criar membro" de novo | +1 toque, sem digitar de novo |
| F12 | Fechar sem querer | "✕" → "Continuar editando" | +1 toque, sem perder nada |

### Telas
As convenções dos wireframes são as do E2.02, com estas:
- 360 px ≈ 38 colunas;
- `[Botão]` é botão, e `[▾]` é seleção;
- `( )` e `(•)` são as opções de escolha única, desmarcada e marcada;
- `[○  ]` e `[  ●]` são o interruptor desligado e ligado;
- `(i)` é informação, `(!)` é aviso de dado antigo e `⚠` é erro.

A margem lateral é a do diálogo (`p-4` no celular).

#### T1. Estrutura do formulário
Celular, com Rita num cadastro novo:
```
┌──────────────────────────────────────┐
│ ✕  Novo membro                       │  cabeçalho fixo
│──────────────────────────────────────│
│ Campos com * são obrigatórios.       │  text-sm, cor muted
│                                      │
│ Dados pessoais                       │  h3
│ Nome *                               │
│ [                                  ] │
│ Sexo *                               │  legenda do grupo
│ [( ) Masculino   ] [( ) Feminino   ] │  RadioGroup, h-11 cada
│ Data de nascimento                   │
│ [dd/mm/aaaa                        ] │  type="date"
│                                      │
│ Identificação                        │  legend do fieldset
│ A pessoa entra no sistema com o      │  dica (P21)
│ celular, o e-mail ou o CPF. Informe  │
│ pelo menos um.                       │
│ Celular / WhatsApp                   │
│ [(00) 00000-0000                   ] │
│ E-mail                               │
│ [                                  ] │
│ CPF                                  │
│ [000.000.000-00                    ] │
│                                      │
│ Telefone                             │
│ [(00) 0000-0000                    ] │
│ Instagram (@)                        │
│ [@usuario                          ] │
│ Cônjuge                              │
│ [Buscar cônjuge…                  ▾] │
│ Observações                          │
│ [                                  ] │
│                                      │
│ Dados ministeriais                   │  T4
│ …                                    │
│ Endereço                             │  sem mudança
│ …                                    │
│ Acesso                               │
│ Função *                             │  E2.02
│ [Membro (padrão)                  ▾] │
│ Senha para Acesso                    │  campo do E2.03
│ [                                  ] │
│──────────────────────────────────────│
│ [Cancelar        ] [Criar membro   ] │  rodapé fixo, h-11
└──────────────────────────────────────┘
```
Desktop (a partir de 768 px, `Dialog` com `max-w-3xl`):
```
┌────────────────────────────────────────────────────────────────────────┐
│ Novo membro                                                        ✕   │
│────────────────────────────────────────────────────────────────────────│
│ Campos com * são obrigatórios.                                         │
│ Dados pessoais                                                         │
│ Nome *                                                                 │
│ [                                                                    ] │
│ Sexo *                              Data de nascimento                 │
│ [( ) Masculino] [( ) Feminino]      [dd/mm/aaaa                     ]  │
│ Identificação                                                          │
│ A pessoa entra no sistema com o celular, o e-mail ou o CPF. Informe    │
│ pelo menos um.                                                         │
│ Celular / WhatsApp                  E-mail                             │
│ [(00) 00000-0000              ]     [                               ]  │
│ CPF                                                                    │
│ [000.000.000-00               ]                                        │
│ Telefone                            Instagram (@)                      │
│ [(00) 0000-0000               ]     [@usuario                       ]  │
│ Cônjuge                                                                │
│ [Buscar cônjuge…                                                   ▾]  │
│ Observações                                                            │
│ [                                                                    ] │
│ Dados ministeriais                                                     │
│ É Pastor(a)?               [○  ]    Tem Liderança?              [  ●]  │
│ Líder *                                                                │
│ [Buscar líder…                                                     ▾]  │
│ Ativo                      [  ●]    Batizado(a)?                [○  ]  │
│ Endereço e Acesso, como hoje                                           │
│────────────────────────────────────────────────────────────────────────│
│                                          [Cancelar]  [Criar membro]    │
└────────────────────────────────────────────────────────────────────────┘
```
- **Celular (abaixo de 768 px):**
  - uma coluna;
  - o cabeçalho tem o "✕" e o título;
  - o corpo rola (`overflow-y-auto`);
  - o rodapé fixo tem "Cancelar" (`outline`) e a ação primária (`default`), lado a lado, cada um com metade da largura e `h-11`, e `pb-[calc(1rem+env(safe-area-inset-bottom))]` (P1).
- **Campo em foco sempre à vista (WCAG 2.4.11):** o corpo rolável tem `scroll-pt` e `scroll-pb` da altura do cabeçalho e do rodapé, para que o campo que recebe o foco nunca fique escondido atrás deles.
- **Desktop (a partir de 768 px):**
  - `Dialog` centralizado, com `max-w-3xl` e `max-h-[90dvh]`, o mesmo cabeçalho e rodapé fixos e o grid de 2 colunas de hoje;
  - ficam em par: Sexo e Data de nascimento; Celular e E-mail; Telefone e Instagram; "É Pastor(a)?" e "Tem Liderança?"; "Ativo" e "Batizado(a)?";
  - ocupam as duas colunas: Nome, a dica da Identificação, Cônjuge, Líder e Observações.
- **Ordem (UXD-2):**
  - Dados pessoais: Nome, Sexo, Data de nascimento, Identificação (Celular, E-mail e CPF), Telefone, Instagram, Cônjuge e Observações;
  - depois, Dados ministeriais (T4), Endereço e Acesso, nessa ordem, como hoje.
- **Textos:**
  - títulos: "Novo membro", "Editar membro" e "Editar meus dados" (hoje com iniciais maiúsculas);
  - seções: "Dados pessoais", "Identificação", "Dados ministeriais", "Endereço" e "Acesso";
  - ação primária: "Criar membro" no cadastro novo e "Salvar alterações" na edição e em "Editar meus dados" (hoje "Salvar", sem objeto).
- **O que cada pessoa vê não muda** (E1.08, E2.02):
  - sem os dados sensíveis do cadastro, a Identificação, o Telefone e o Endereço não aparecem;
  - sem "Editar Membro", os Dados ministeriais e o Cônjuge não aparecem.
- **Componentes:** `Dialog` (com o P1), `Input`, `RadioGroup`, `Switch`, `Textarea`, `Select`, `AsyncMemberSelect`, `Alert`, `AlertDialog` (descartar) e `Button`. O `useIsMobile` não entra: a troca é só CSS (P1).

#### T2. Dados pessoais: Nome, Sexo e Data de nascimento
```
Preenchido                               Com erros, depois de "Criar membro"
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Nome *                               │ │ Nome *                               │
│ [Ana Souza                         ] │ │ [Lúcia                             ] │ foco
│ Sexo *                               │ │ ⚠ Informe o nome e o sobrenome.      │
│ [( ) Masculino   ] [(•) Feminino   ] │ │ Sexo *                               │
│ Data de nascimento                   │ │ [( ) Masculino   ] [( ) Feminino   ] │
│ [14/02/1992                        ] │ │ ⚠ Informe o sexo.                    │
│ 34 anos                              │ │ Data de nascimento                   │
└──────────────────────────────────────┘ │ [24/11/2026                        ] │
                                         │ ⚠ A data de nascimento não pode ser  │
                                         │ futura.                              │
                                         └──────────────────────────────────────┘
```
- **Nome (RN-02):**
  - `autoComplete="off"` (UXD-13), `autoCapitalize="words"` e nenhum placeholder;
  - a tela confere como o servidor: tira os espaços das pontas, junta os espaços repetidos e pede duas palavras com letras. "Ana B." passa; "Ana", "Ana 2" e "Ana ." não passam;
  - o campo mostra o que a pessoa digitou. O ajuste dos espaços é feito pelo servidor.
- **Sexo (RN-03, UXD-3):**
  - `RadioGroup` com "Masculino" e "Feminino", lado a lado também no celular, cada um com metade da largura;
  - cada opção é um `Label` com borda e `min-h-11`, que envolve o `RadioGroupItem` e o texto. O toque em qualquer ponto da caixa escolhe a opção;
  - no cadastro novo, nenhuma opção vem marcada, porque a RN-03 pede "Informe o sexo." para quem não escolhe;
  - a opção marcada tem o círculo preenchido e a borda `border-primary`. A cor não é o único sinal;
  - o grupo tem `aria-required="true"` e o nome "Sexo" (pelo `aria-labelledby` do rótulo);
  - com fonte grande, as opções passam para uma por linha (`flex-wrap`), cada uma com 44 px.
- **Data de nascimento (RN-15):**
  - continua `type="date"`, com o seletor nativo;
  - os limites do campo seguem a regra, no horário de Brasília (`America/Sao_Paulo`) e não no fuso do navegador: `max` é hoje, e `min` é o dia seguinte ao de 100 anos atrás. Assim o seletor nativo já não oferece as datas que seriam recusadas;
  - o formulário tem `noValidate`, para o navegador não mostrar os balões dele, que vêm em outro idioma. A data antiga fora dos limites continua aparecendo, sem bloqueio (T6);
  - com uma data válida, a idade aparece embaixo, em `text-sm text-muted-foreground`: "{N} anos", "1 ano" ou "Menos de 1 ano" (UXD-11). Com erro, ou com a data fora do intervalo, a idade não aparece;
  - a data só é conferida quando muda (tipo b; T6);
  - nota para o frontend: o "hoje" de Brasília precisa de uma função própria em `src/lib`, testada com o fuso do navegador em UTC (critério da RN-15).
- **Instagram, Telefone e Observações:** a regra não muda. O `Textarea` de Observações passa a ter `text-base md:text-sm`, para o iOS não dar zoom ao focar.

#### T3. Identificação: Celular, E-mail e CPF
Só aparece para quem vê os dados sensíveis do cadastro (E1.08): no cadastro novo, no próprio cadastro e com "Ver Dados Sensíveis".
```
Com a dica                               Sem nenhum dos três, ao salvar (RN-08)
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Identificação                        │ │ Identificação                        │
│ A pessoa entra no sistema com o      │ │ ⚠ Informe o e-mail, o celular ou o   │ no lugar
│ celular, o e-mail ou o CPF. Informe  │ │ CPF. A pessoa usa um deles para      │ da dica
│ pelo menos um.                       │ │ entrar no sistema.                   │
│ Celular / WhatsApp                   │ │ Celular / WhatsApp                   │
│ [(51) 98888-1234                   ] │ │ [                                  ] │ foco
│ E-mail                               │ │ E-mail                               │
│ [                                  ] │ │ [                                  ] │
│ CPF                                  │ │ CPF                                  │
│ [000.000.000-00                    ] │ │ [                                  ] │
└──────────────────────────────────────┘ └──────────────────────────────────────┘
```
Erros de cada campo, ao sair dele ou ao salvar:
```
┌──────────────────────────────────────┐
│ Celular / WhatsApp                   │
│ [98888-1234                        ] │
│ ⚠ Celular inválido. Informe o DDD e  │
│ o número.                            │
│ E-mail                               │
│ [lucia@mci12fakemail.com           ] │
│ ⚠ Este e-mail não pode ser usado.    │
│ Informe um e-mail real ou deixe o    │
│ campo em branco.                     │
│ CPF                                  │
│ [111.111.111-11                    ] │
│ ⚠ CPF inválido. Se a pessoa não tem  │
│ CPF, deixe o campo em branco.        │
└──────────────────────────────────────┘
```
- **Grupo (UXD-2):** um `fieldset` sem borda, com a `legend` "Identificação" (no mesmo estilo dos subtítulos, `text-base font-semibold`) e a dica em `text-sm text-muted-foreground`.
  - A dica, e o erro ou o aviso do grupo quando houver, ficam ligados aos três campos por `aria-describedby`.
  - O erro da RN-08 toma o lugar da dica, marca os três campos (`aria-invalid` e borda de erro) e leva o foco ao Celular. Ele some assim que um dos três fica válido.
  - Na edição, a RN-08 vale como está: o erro só aparece quando a edição tira o último identificador real. O cadastro que já não tinha nenhum mostra o aviso da T6, sem bloquear.
- **Celular / WhatsApp (RN-06, P23):**
  - `type="tel"`, `autoComplete="off"` e o placeholder "(00) 00000-0000";
  - enquanto a pessoa digita, a máscara formata até 11 dígitos: "(51) 98888-7777" ou "(51) 3333-4444";
  - a máscara **nunca corta dígitos**. Com "+", com zero na frente ou com mais de 11 dígitos, o texto fica como foi digitado até a pessoa sair do campo;
  - ao sair do campo, e ao colar, se o número pode ser lido como na RN-06, o campo mostra a forma lida, sem o 55 e sem o zero na frente. Se não pode, fica como está, e o erro aparece;
  - corrigir um dígito no meio não leva o cursor para o fim;
  - os exemplos estão na tabela abaixo (UX-06).
- **E-mail (RN-04, RN-05):**
  - `type="email"`, `autoComplete="off"`, `autoCapitalize="none"`, `autoCorrect="off"`, `spellCheck={false}` e nenhum placeholder;
  - ao sair do campo, os espaços das pontas saem. As maiúsculas ficam na tela, e o servidor grava em minúsculas;
  - o e-mail fictício nunca aparece: o campo vem vazio, como qualquer campo não preenchido, e o rótulo não muda. O domínio fictício não aparece em nenhum lugar do DOM. Hoje aparece "(Não informado)" ao lado do rótulo, com "Adicionar e-mail..." no placeholder;
  - o formulário não monta mais o e-mail fictício: no cadastro sem e-mail, envia o e-mail vazio, e o servidor gera o fictício (RN-05, AQ-6);
  - um e-mail num domínio fictício é recusado ao sair do campo, com a mensagem da RN-05, sem consultar o servidor.
- **CPF (RN-07, P23):**
  - `type="text"`, `inputMode="numeric"`, `autoComplete="off"` e o placeholder "000.000.000-00";
  - a máscara formata até 11 dígitos e também não corta: com mais, os dígitos ficam, e o erro aparece ao sair do campo;
  - a tela confere os dígitos verificadores e os 11 dígitos iguais, como o servidor.
- **Telefone:** fica fora do grupo, porque não serve para entrar. Pode usar a mesma máscara do celular, sem conferência (Fora de escopo do Negócio).
- **Dado em uso (RN-09, RN-10):** só o servidor sabe, e só ao salvar (T5). A tela nunca consulta a unicidade ao sair do campo. Isso evita uma consulta a mais e não ajuda ninguém a descobrir dados de outras pessoas (o mesmo motivo da P-DEL-22 do E2.01).

Celular: o que o campo mostra ao sair dele (UX-06)

| Digitado ou colado | Ao sair do campo |
|---|---|
| `51988887777`, `(51)98888-7777`, `+55 (51) 98888-7777`, `5551988887777`, `051 98888-7777` | `(51) 98888-7777` |
| `(55) 99999-1111`, `55999991111` | `(55) 99999-1111` (DDD de Santa Maria) |
| `5133334444` | `(51) 3333-4444` |
| `98888-1234` (sem DDD) | `98888-1234`, com o erro |
| `(51) 98888-12345` | `(51) 98888-12345`, com o erro |

CPF: o que o campo mostra ao sair dele (UX-07)

| Digitado ou colado | Ao sair do campo |
|---|---|
| `52998224725` | `529.982.247-25` |
| `01234567890` | `012.345.678-90` |
| `529.982.247-26` (dígito errado) | `529.982.247-26`, com o erro |
| `1144477735` (10 dígitos) | `114.447.773-5`, com o erro |
| `111444777350` (12 dígitos) | `111.444.777-350`, com o erro |

#### T4. Dados ministeriais: liderança, cônjuge e batismo
Quem vê a igreja toda (Rita), por situação:
```
Cadastro novo (RN-12)                    "Tem Liderança?" desligado
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Dados ministeriais                   │ │ Dados ministeriais                   │
│ É Pastor(a)?                  [○  ]  │ │ É Pastor(a)?                  [○  ]  │
│ Tem Liderança?                [  ●]  │ │ Tem Liderança?                [○  ]  │
│ Líder *                              │ │ A pessoa fica sem liderança.         │ dica
│ [Buscar líder…                    ▾] │ │ Ativo                         [  ●]  │
│ Ativo                         [  ●]  │ │ Batizado(a)?                  [○  ]  │
│ Batizado(a)?                  [○  ]  │ └──────────────────────────────────────┘
└──────────────────────────────────────┘
```
"É Pastor(a)?" ligado na edição de André, que tinha o líder Pedro (RN-11, P20):
```
┌──────────────────────────────────────┐
│ É Pastor(a)?                  [  ●]  │
│ Pastor(a) não tem líder.             │  no lugar de "Tem Liderança?" e do Líder
│ (i) Ao salvar, Pedro Alves deixa de  │  role="status"; só se havia líder
│ ser o líder.                         │
│ Ativo                         [  ●]  │
└──────────────────────────────────────┘
```
"Tem Liderança?" desligado num cadastro com líder, e "Batizado(a)?" desligado com a data preenchida (P20):
```
┌──────────────────────────────────────┐
│ Tem Liderança?                [○  ]  │
│ (i) Ao salvar, Pedro Alves deixa de  │  no lugar da dica
│ ser o líder. A pessoa fica sem       │
│ liderança.                           │
│ Batizado(a)?                  [○  ]  │
│ (i) Ao salvar, a data do batismo     │
│ (10/05/2020) será apagada.           │
└──────────────────────────────────────┘
```
Erros no Líder:
```
Sem líder, ao salvar (RN-12)             Ciclo, recusado pelo servidor (RN-13)
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Tem Liderança?                [  ●]  │ │ Líder *                              │
│ Líder *                              │ │ [Davi Lima                      ✕ ▾] │ foco
│ [Buscar líder…                    ▾] │ │ ⚠ O líder escolhido é discípulo desta│
│ ⚠ Escolha o líder ou desligue "Tem   │ │ pessoa (direto ou indireto). Escolha │
│ Liderança?".                         │ │ outro líder.                         │
└──────────────────────────────────────┘ └──────────────────────────────────────┘
```
Seletor de líder no cadastro de André, com os discípulos dele (UXD-12, AQ-4):
```
┌──────────────────────────────────────┐
│ Líder *                              │
│ [dav                              ▾] │
│ ┌──────────────────────────────────┐ │
│ │ Davi Lima                        │ │  desabilitado, cor muted
│ │ Discípulo desta pessoa           │ │  motivo escrito, text-sm
│ │ Davi Souza                       │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```
- **Ordem, para quem vê a igreja toda:** "É Pastor(a)?", "Tem Liderança?", Líder, "Ativo", "Batizado(a)?" e Data do batismo.
  - Hoje "Ativo" fica entre o pastor e a liderança e separa duas coisas que dependem uma da outra.
  - Para quem vê só o ministério, a ordem da T6 do E2.02 não muda: Líder, Ativo e Batizado(a)?.
- **Cadastro novo (RN-12, P-VAL-12):** "Tem Liderança?" já vem ligado, e o "Líder *" aparece vazio. Para quem vê só o ministério, vale a T6 do E2.02: o Líder já vem preenchido com quem cadastra.
- **"Tem Liderança?" desligado:** o Líder some, como hoje, e a dica "A pessoa fica sem liderança." aparece embaixo do interruptor. Se havia líder escolhido, o aviso do P20 toma o lugar da dica.
- **"É Pastor(a)?" ligado (RN-11, UXD-8):**
  - "Tem Liderança?" e o Líder somem, e aparece o texto "Pastor(a) não tem líder.";
  - se havia líder, entra também o aviso do P20, com o nome dele;
  - desligar "É Pastor(a)?" antes de salvar devolve o líder e "Tem Liderança?" como estavam;
  - num cadastro que já era de pastor (Samuel), desligar "É Pastor(a)?" mostra "Tem Liderança?" **ligado**, com o Líder vazio e obrigatório. Quem edita escolhe o líder ou desliga "Tem Liderança?" de propósito, como no cadastro novo (definido pela UX, PO-UX-4).
- **Mensagens do Líder:** "Escolha o líder ou desligue "Tem Liderança?"." para quem vê a igreja toda, e "Escolha o líder." para quem vê só o ministério (E2.02). As duas são conferidas na tela, ao salvar, sem chamar o servidor.
- **Ciclo e líder de si mesmo (RN-13):**
  - o seletor nunca oferece a própria pessoa, como hoje (`excludeId`);
  - os discípulos diretos e indiretos aparecem desabilitados, com "Discípulo desta pessoa" embaixo do nome, como no P5 de Escolas (UXD-12). Os inativos também;
  - no cadastro novo, ninguém é discípulo da pessoa, então nada fica desabilitado;
  - sem esse dado (AQ-4), o seletor oferece todos, e a recusa do servidor aparece embaixo do Líder, com o foco nele.
- **Cônjuge (RN-14):** o seletor continua sem a própria pessoa. A recusa "Uma pessoa não pode ser cônjuge de si mesma." só vem pela API ou numa corrida, e aparece embaixo do Cônjuge.
- **"Pastor(a) não tem líder…" (RN-11):** pela tela, não acontece, porque o pastor nunca tem o Líder à vista. Se vier do servidor numa corrida, aparece embaixo de "É Pastor(a)?".
- **Batismo (RN-16, P20):**
  - desligar "Batizado(a)?" esconde a data, como hoje. Se ela estava preenchida, aparece o aviso, com a data em dd/MM/aaaa;
  - ligar de novo antes de salvar devolve a data;
  - ao salvar com "Batizado(a)?" desligado, a tela envia a data vazia. Hoje ela continua sendo enviada e gravada;
  - "Data do batismo" (hoje "Data do Batismo") continua opcional e sem limites (Fora de escopo).
- **Linha de cada interruptor:** o `Label` ocupa a linha inteira (`flex-1`), com pelo menos 44 px de altura. O toque em qualquer ponto da linha muda o interruptor. Hoje o espaço entre o texto e o `Switch` não responde.

#### T5. Erros ao salvar
O exemplo é o do critério da RN-19: Rita cadastra Lúcia com o nome "Lúcia", o e-mail "lucia@", o CPF "111.111.111-11" e sem sexo. No celular:
```
┌──────────────────────────────────────┐
│ ✕  Novo membro                       │
│──────────────────────────────────────│
│ Nome *                               │
│ [Lúcia                             ] │  foco: o primeiro erro
│ ⚠ Informe o nome e o sobrenome.      │
│ Sexo *                               │
│ [( ) Masculino   ] [( ) Feminino   ] │
│ ⚠ Informe o sexo.                    │
│ Data de nascimento                   │
│ [dd/mm/aaaa                        ] │
│ Identificação                        │
│ …                                    │
│ E-mail                               │
│ [lucia@                            ] │
│ ⚠ E-mail inválido. Confira o         │
│ endereço digitado.                   │
│ CPF                                  │
│ [111.111.111-11                    ] │
│ ⚠ CPF inválido. Se a pessoa não tem  │
│ CPF, deixe o campo em branco.        │
│──────────────────────────────────────│
│ ⚠ Confira os campos destacados (4).  │  resumo, role="status"
│ [Cancelar        ] [Criar membro   ] │
└──────────────────────────────────────┘
```
Recusa do servidor por dado em uso, com dois dados (critério da RN-10):
```
┌──────────────────────────────────────┐
│ E-mail                               │
│ [caio@exemplo.com                  ] │  foco
│ ⚠ Este e-mail já está sendo usado por│
│ outro cadastro.                      │
│ CPF                                  │
│ [529.982.247-25                    ] │
│ ⚠ Este CPF já está sendo usado por   │
│ outro cadastro.                      │
│──────────────────────────────────────│
│ ⚠ Confira os campos destacados (2).  │
│ [Cancelar        ] [Criar membro   ] │
└──────────────────────────────────────┘
```
No desktop, o resumo fica à esquerda, na linha dos botões.

- **Quando a tela confere (UXD-4, P22):**
  - **ao sair de um campo** que a pessoa alterou e deixou preenchido: só o formato daquele campo (Nome, Celular, E-mail, CPF e Data de nascimento). Sair de um campo vazio não mostra erro;
  - **ao tocar em "Criar membro" ou "Salvar alterações":** tudo o que a tela sabe conferir (RN-02 a RN-08, RN-12 e RN-15), todos de uma vez, cada um no seu campo. Nada é enviado enquanto houver erro (RN-19);
  - **depois que um erro aparece,** ele some assim que o valor fica certo, sem esperar a pessoa sair do campo. Nenhum erro novo aparece enquanto a pessoa digita;
  - o que só o servidor sabe (dado em uso e ciclo) é conferido só ao salvar.
- **Foco:** vai para o primeiro campo com erro, na ordem da tela. A tela rola até ele, com o rótulo à vista e sem que ele fique atrás do cabeçalho ou do rodapé. No Sexo, o foco vai para a primeira opção; no grupo Identificação, para o Celular; no Líder, para a busca do seletor.
- **Resumo no rodapé (UXD-5):**
  - "Confira os campos destacados ({N})." fica acima dos botões no celular e à esquerda deles no desktop, enquanto houver erro;
  - o número diminui à medida que a pessoa corrige;
  - tocar de novo na ação primária confere tudo outra vez e leva o foco ao próximo campo com erro.
- **Recusas do servidor (RN-19, UXD-6):**
  - **com campo:** a mensagem aparece embaixo do campo, entra no resumo e recebe o foco, como os erros da tela. Com mais de um dado em uso, cada campo recebe a sua mensagem (RN-10). A mensagem do servidor some quando a pessoa muda aquele campo;
  - **sem campo, ou com um campo que não está na tela:** vai para o `Alert` do topo, que recebe o foco, como na T11 do E2.02 (permissão, escopo, cadastro excluído no meio tempo);
  - o formulário nunca fecha numa recusa e mantém tudo o que foi digitado;
  - sai o toast vermelho "Erro" de hoje, que some antes de a pessoa ler e não diz onde está o problema;
  - nenhuma tela mostra o nome, o id ou outro dado do outro cadastro (RN-10);
  - sem o código e o campo (AQ-1), o texto do servidor vai para o `Alert` do topo, sem marcar o campo.
- **Ordem com o aviso do E2.01 (RN-10, RN-19):**
  - se o e-mail está em uso e o CPF é de um excluído, aparece só o erro do e-mail. Corrigido o e-mail, o próximo "Criar membro" abre o aviso da T9 do E2.01;
  - as recusas de permissão e de escopo vêm antes de tudo (T11 do E2.02).
- **Os avisos de dado antigo (T6)** não entram no resumo e não impedem salvar.

#### T6. Cadastro antigo fora das regras (RN-17, P24)
Rita abre o cadastro de Fábio, da massa de exemplo:
```
┌──────────────────────────────────────┐
│ ✕  Editar membro                     │
│──────────────────────────────────────│
│ Nome *                               │
│ [Fábio                             ] │  borda normal
│ (!) Nome sem sobrenome. Complete     │  aviso: não impede salvar
│ quando puder.                        │
│ Sexo *                               │
│ [(•) Masculino   ] [( ) Feminino   ] │
│ Data de nascimento                   │
│ [10/03/1920                        ] │  sem a idade
│ (!) Data de nascimento fora do       │
│ intervalo aceito. Confira quando     │
│ puder.                               │
│ Identificação                        │
│ (!) Sem e-mail, celular ou CPF: esta │  no lugar da dica
│ pessoa não consegue entrar no        │
│ sistema.                             │
│ Celular / WhatsApp                   │
│ [98887777                          ] │  como está gravado, sem máscara
│ (!) Celular fora do formato. Corrija │
│ quando puder.                        │
│ E-mail                               │
│ [                                  ] │
│ CPF                                  │
│ [000.000.000-00                    ] │
│──────────────────────────────────────│
│ [Cancelar      ] [Salvar alterações] │
└──────────────────────────────────────┘
```
- **Quando aparece:** ao abrir o cadastro, sem esperar o salvar, nos campos que a pessoa vê:
  - Nome de uma palavra só (RN-02);
  - Celular fora do formato da RN-06;
  - Data de nascimento fora do intervalo da RN-15, inclusive a que era aceita e passou do limite com o tempo;
  - nenhum identificador real (RN-08). Esse aviso fica no grupo Identificação, no lugar da dica.
- **Como aparece (P21):**
  - ícone `TriangleAlert` e texto em `text-sm text-foreground`, embaixo do campo, ligado a ele por `aria-describedby`;
  - o campo fica com a borda normal e sem `aria-invalid`, porque não é um erro;
  - o aviso não entra no resumo do rodapé.
- **Valor como está gravado:** o celular fora do formato aparece sem a máscara. Com ela, `98887777` viraria `(98) 8877-77`, com um DDD que não existe. A data aparece normalmente.
- **Quando a pessoa mexe no campo:**
  - o aviso sai, e a regra passa a valer: "9888-7770" mostra o erro da RN-06, e "(51) 98887-7770" é aceito;
  - se ela voltar ao valor gravado (lido como na regra), o campo deixa de contar como alterado: o erro some, e o aviso volta.
- **Salvar sem mexer** não altera o valor e não mostra erro (RN-17). A tela não regrava o campo em outro formato (AQ-3).
- **Quem não vê o campo não vê o aviso:** quando Pedro edita Fábio, ele vê os avisos do Nome e da Data de nascimento, e não os do Celular e da Identificação (E1.08).
- **"Meus dados" só para leitura** (E2.02, UXD-13 de lá) não mostra avisos, porque a pessoa não pode corrigir.
- **CPF e e-mail não têm aviso:** são do tipo (a) e já chegam dentro das regras (RN-18).

#### T7. Envio, conexão e fechar
```
Enviando                                 Queda de conexão
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│──────────────────────────────────────│ │──────────────────────────────────────│
│ [Cancelar        ] [(◌) Criando…   ] │ │ ⚠ Não foi possível salvar o cadastro.│
└──────────────────────────────────────┘ │ Verifique a conexão e tente de novo. │
                                         │ [Cancelar        ] [Criar membro   ] │
                                         └──────────────────────────────────────┘
```
Fechar com alterações (os textos da T3 do E2.02, mais uma descrição):
```
┌──────────────────────────────────────┐
│ Descartar as alterações?             │
│                                      │
│ O que você digitou não será salvo.   │
│ [Descartar                         ] │  destructive, h-11
│ [Continuar editando                ] │  outline, h-11, foco inicial
└──────────────────────────────────────┘
```
- **Enviando:**
  - o botão mostra "Criando…" ou "Salvando…", com o `Loader2` (`motion-reduce:animate-none`);
  - os dois botões ficam desabilitados, e um duplo toque não envia duas vezes;
  - os campos continuam à vista, sem mudar.
- **Queda de conexão ou erro do servidor (5xx):**
  - a mensagem fica no rodapé, acima dos botões, com `role="alert"`;
  - os dados continuam no formulário, os botões voltam, e o foco volta para a ação primária, que serve de "Tentar de novo";
  - no cadastro novo, se a conexão cair depois de o servidor gravar, a nova tentativa receberia "dado em uso" com os próprios dados. Ver AQ-5.
- **Sucesso:** como hoje. O formulário fecha, a lista recarrega e aparece o toast.
- **Fechar com alterações (UXD-14):**
  - "Cancelar", "✕", `Esc` e o clique fora do diálogo pedem a confirmação quando algum campo mudou. Sem mudança, fecham direto;
  - "Continuar editando" volta ao formulário com tudo como estava, e o foco inicial fica nele.

### Padrões novos (valem para as próximas telas)
A numeração começa em P20 (ver a nota do início da seção). Este passo também aplica o P1 (diálogo responsivo), o P5 (escolha desabilitada com o motivo, no seletor de líder) e o P12 (pastor como texto).

- **P20. Interruptor que apaga outro campo.** Vale quando ligar ou desligar um interruptor esconde um campo preenchido, cujo valor será apagado ao salvar.
  - O campo some, e um aviso `(i)` embaixo do interruptor diz o que será apagado, com o valor ("Ao salvar, Pedro Alves deixa de ser o líder.").
  - Nada é apagado antes de salvar. Voltar o interruptor devolve o valor.
  - O aviso usa `role="status"`, para o leitor de tela anunciar.
  - Nada é apagado em silêncio. Vale para "É Pastor(a)?", "Tem Liderança?" e "Batizado(a)?", e para os próximos casos, como "Não houve célula" no relatório (E2.11).
- **P21. Mensagens de campo: dica, erro e aviso.**
  - **Dica:** `text-sm text-muted-foreground`, embaixo do rótulo ou do campo (4,6:1 no tema claro e 5,6:1 no escuro).
  - **Erro:**
    - ícone `AlertCircle` (`aria-hidden`) e texto em `text-sm font-medium text-foreground`, embaixo do campo;
    - o campo recebe `aria-invalid` e a borda `border-destructive`;
    - o texto **não** usa `text-destructive`. Sobre o `bg-background` do diálogo, essa cor dá 4,48:1 no tema claro (abaixo de 4,5:1) e 1,9:1 no escuro;
    - o `FormMessage` do shadcn usa `text-destructive`. Então o formulário passa uma `className` a ele, ou usa um componente próprio em `src/components`, sem editar `ui/`.
  - **Aviso** (dado antigo, P24): ícone `TriangleAlert` e texto em `text-foreground`, sem `aria-invalid` e sem a borda de erro.
  - **Ligação com o campo:** os três ficam no `aria-describedby` do campo, na ordem erro, aviso e dica. A mensagem de um grupo fica ligada a cada campo do grupo.
  - Nenhum deles tem altura fixa: com fonte grande, o texto quebra linha.
- **P22. Conferência e erros ao salvar.**
  - **Quando:** ao sair de um campo alterado e preenchido, só o formato, sem o servidor. Ao salvar, tudo, de uma vez. O erro some quando o valor fica certo, e nenhum erro novo aparece enquanto a pessoa digita.
  - **Foco:** vai para o primeiro erro, que fica à vista, sem ficar atrás do cabeçalho ou do rodapé fixos.
  - **Resumo:** "Confira os campos destacados ({N})." fica no rodapé fixo (P1), junto da ação primária.
  - **Recusas do servidor:** as que têm campo vão para o campo, e as outras, para o `Alert` do topo (T11 do E2.02). O formulário nunca fecha numa recusa, e o toast não é usado para erro de formulário.
  - Vale para os próximos formulários longos: célula (E2.08), relatório (E2.11) e Escolas.
- **P23. Celular, CPF e e-mail.**
  - **Teclado:** celular com `type="tel"`; CPF com `inputMode="numeric"`; e-mail com `type="email"`, sem correção automática e sem maiúscula automática.
  - **Máscara:** formata enquanto a pessoa digita, mas nunca corta dígitos e não move o cursor. Ao sair do campo, o celular aparece na forma lida, sem o +55 e sem o zero na frente.
  - **Valor gravado ilegível:** um valor que a regra não consegue ler aparece como está, sem máscara.
  - **Formulário sobre outra pessoa:** `autoComplete="off"` (UXD-13).
- **P24. Dado antigo fora da regra.** Vale para o campo gravado antes da regra que a pessoa não mexeu.
  - Ele mostra um aviso (P21) e não impede salvar.
  - Se a pessoa mexe no campo, a regra passa a valer. Se ela volta ao valor gravado, o aviso volta.
  - Quem não vê o campo não vê o aviso, e o modo só para leitura não mostra avisos.
  - Vale para as regras do tipo (b) dos próximos passos (células e relatórios).

Nenhum componente novo do shadcn é necessário: `radio-group`, `switch`, `alert`, `alert-dialog`, `dialog` e `form` já estão em `src/components/ui`. O P1 continua pedindo `viewport-fit=cover` na meta viewport do `index.html`, que hoje não tem (tarefa do frontend, já prevista em Escolas, no E2.01 e no E2.02).

### Estados
| Estado | No formulário de membro |
|---|---|
| Carregando | O formulário abre na hora, com os dados da lista, como hoje. Nos seletores, o nome do líder e do cônjuge aparece como "Carregando…" (E1.08), e a Função segue o E2.02. Nada novo. |
| Vazio (cadastro novo) | Campos vazios, Sexo sem opção marcada e "Ativo" ligado. Para quem vê a igreja toda, "Tem Liderança?" vem ligado. Para quem vê só o ministério, o Líder já vem preenchido (E2.02). A busca sem resultado nos seletores segue o P11. |
| Erro de preenchimento | T5: cada erro no seu campo, todos de uma vez, com o foco no primeiro e o resumo no rodapé. |
| Recusa do servidor | Com campo, no campo (T5). Sem campo, no `Alert` do topo (T11 do E2.02). Os dados de um excluído abrem o aviso da T9 do E2.01, depois das recusas por dado em uso. |
| Aviso de dado antigo | T6: no campo, sem bloquear. |
| Sem permissão | Campos e blocos somem, como no E1.08 e no E2.02. A recusa 42501 vira "Você não tem permissão para esta ação." no `Alert` do topo. |
| Registro mudou no meio tempo | "Este cadastro não existe ou já foi excluído. As alterações não foram salvas." no `Alert` do topo, com "Fechar" (E2.01). |
| Sucesso | Como hoje: o formulário fecha, a lista recarrega e aparece o toast. |
| Lista grande | Seletores de líder e de cônjuge paginados no servidor (E1.08). |
| Queda de conexão no envio | A mensagem fica no rodapé, os dados ficam no formulário, e o botão volta, com o foco (T7). |

### Textos
Complementam os "Textos de tela" do Negócio, sem mudar os termos. As mensagens de regra são as do Negócio, mostradas como estão lá. Os textos marcados com † foram definidos pela UX e estão nas pendências (PO-UX-8).

| Onde | Texto |
|---|---|
| Títulos | Novo membro · Editar membro · Editar meus dados |
| Topo do formulário † | Campos com * são obrigatórios. |
| Seções | Dados pessoais · Identificação † · Dados ministeriais · Endereço · Acesso |
| Rótulos | Nome * · Sexo * (Masculino, Feminino) · Data de nascimento · Celular / WhatsApp · E-mail · CPF · Telefone · Instagram (@) · Cônjuge · Observações · É Pastor(a)? · Tem Liderança? · Líder * · Ativo · Batizado(a)? · Data do batismo |
| Placeholders | (00) 00000-0000 · 000.000.000-00 · (00) 0000-0000 · @usuario · Buscar líder… · Buscar cônjuge… |
| Dicas † | Identificação: A pessoa entra no sistema com o celular, o e-mail ou o CPF. Informe pelo menos um. · "Tem Liderança?" desligado: A pessoa fica sem liderança. · Idade: {N} anos / 1 ano / Menos de 1 ano |
| Pastor † | Pastor(a) não tem líder. |
| Avisos dos interruptores † (P20) | Ao salvar, {Nome} deixa de ser o líder. · Ao salvar, {Nome} deixa de ser o líder. A pessoa fica sem liderança. · Ao salvar, a data do batismo ({dd/MM/aaaa}) será apagada. |
| Seletor de líder † | Discípulo desta pessoa |
| Erros | os dos "Textos de tela" do Negócio, sem mudança |
| Avisos de dado antigo | os dos "Textos de tela" do Negócio (ver PO-UX-7) |
| Resumo | Confira os campos destacados ({N}). (o número é da UX †) |
| Botões | Cancelar · Criar membro · Salvar alterações † · Criando… † · Salvando… |
| Conexão † | Não foi possível salvar o cadastro. Verifique a conexão e tente de novo. |
| Descartar | Descartar as alterações? · O que você digitou não será salvo. † · Descartar · Continuar editando |
| Sucesso | como hoje |

### Acessibilidade
- **Formulário:**
  - tem `noValidate`. Os obrigatórios mantêm `required` (ou `aria-required` no grupo de Sexo), que o leitor de tela anuncia, e o "*" é explicado no topo;
  - o grupo Identificação é um `fieldset` com `legend`;
  - Sexo é um `radiogroup` com o nome "Sexo".
- **Mensagens (P21):**
  - erro, aviso e dica ficam no `aria-describedby` do campo, nessa ordem, e o erro também marca `aria-invalid`;
  - o `PaginatedSelect` já junta a mensagem de erro (`aria-errormessage`). Ele precisa aceitar também a dica e o aviso no `aria-describedby`, como o E2.02 já pediu para a dica de alcance.
- **Foco:**
  - vai para o primeiro campo com erro, que fica inteiro à vista, sem ficar atrás do cabeçalho ou do rodapé fixos (WCAG 2.4.11);
  - na confirmação de descartar, o foco inicial fica em "Continuar editando";
  - depois de uma falha de conexão, o foco volta à ação primária.
- **Anúncios:**
  - os avisos do P20 e o resumo do rodapé usam `role="status"`;
  - a falha de conexão e o `Alert` do topo usam `role="alert"`;
  - "Criando…" e "Salvando…" ficam no próprio botão, sem região extra.
- **Contraste:**
  - as mensagens usam `text-foreground` (15,7:1 no tema claro e 16,4:1 no escuro), e não `text-destructive` (P21);
  - a dica em `text-muted-foreground` passa nos dois temas;
  - a opção marcada no Sexo usa o círculo preenchido e `border-primary`.
- **Sem depender de cor:** o erro tem ícone e texto, o aviso tem outro ícone e texto, e a opção marcada tem o círculo preenchido. Uma borda vermelha nunca aparece sozinha.
- **Toque:** cada opção de Sexo e cada linha de interruptor tem pelo menos 44 px de altura, e os botões do rodapé têm `h-11`.
- **Zoom e fonte grande:** com 200% e em 320 px, rótulos, dicas, erros e avisos quebram linha, e as opções de Sexo passam para uma por linha. Nada tem altura fixa, e o corpo do diálogo rola (P1).
- **Movimento:** o `Loader2` e as animações do `Dialog` e do `AlertDialog` respeitam `motion-reduce:`.

### Critérios de UX
| ID | Critério | Como verificar |
|---|---|---|
| UX-01 | Em 360×800, o formulário (cadastro novo, edição e "Editar meus dados") ocupa a tela, com cabeçalho e rodapé fixos. A ação primária ("Criar membro" ou "Salvar alterações") fica à vista sem rolar, com o teclado fechado, em qualquer ponto da rolagem. A partir de 768 px, é um `Dialog` centralizado, com `max-h-[90dvh]` e o rodapé fixo. | teste E2E (viewport) |
| UX-02 | Os campos de Dados pessoais seguem a ordem da T1: numa coluna abaixo de 768 px, e com os pares da T1 a partir de 768 px. Celular, E-mail e CPF ficam num `fieldset` com a legenda "Identificação" e a dica. | teste de componente + teste E2E (viewport) |
| UX-03 | Os rótulos são os da tabela de Textos: o DOM tem "Sexo *" e não tem "Gênero", e tem "Data de nascimento", "Data do batismo" e "Campos com * são obrigatórios.". Os títulos são "Novo membro", "Editar membro" e "Editar meus dados", e a ação da edição é "Salvar alterações". | teste de componente |
| UX-04 | Sexo é um `radiogroup` com o nome "Sexo" e as opções "Masculino" e "Feminino", nenhuma marcada no cadastro novo. Cada opção tem pelo menos 44 px de altura e responde ao toque em toda a caixa, inclusive no texto. | teste de componente + teste E2E (medida) |
| UX-05 | Os campos têm os atributos da T2 e da T3:<br>- Celular: `type="tel"`;<br>- CPF: `inputMode="numeric"`;<br>- E-mail: `type="email"`, `autoCapitalize="none"`, `autoCorrect="off"` e `spellCheck=false`;<br>- Nome: `autoCapitalize="words"`;<br>- Nome, E-mail, Celular, CPF, Telefone e Data de nascimento: `autoComplete="off"`.<br><br>O `Textarea` de Observações tem fonte de 16 px abaixo de 768 px, e o formulário tem `noValidate`. | teste de componente |
| UX-06 | Celular: cada linha da tabela da T3, digitada ou colada, mostra ao sair do campo o valor da segunda coluna. Nenhum dígito digitado ou colado é cortado. Corrigir o 3º dígito de "(51) 98888-7777" deixa o cursor logo depois dele. | teste de componente + teste E2E |
| UX-07 | CPF: cada linha da tabela da T3 mostra ao sair do campo o valor da segunda coluna, sem cortar dígitos. | teste de componente |
| UX-08 | Ao salvar, os erros de preenchimento aparecem todos de uma vez, cada um no seu campo (no critério da RN-19, os 4), e nenhuma requisição sai. O foco vai para o primeiro campo com erro, que fica inteiro à vista, sem ficar atrás do cabeçalho ou do rodapé. | teste de componente + teste E2E (360×800) |
| UX-09 | Conferência fora do salvar:<br>- ao sair de um campo alterado e preenchido, só o erro de formato daquele campo aparece;<br>- sair de um campo vazio não mostra erro;<br>- um erro some assim que o valor fica certo, sem sair do campo;<br>- enquanto a pessoa digita, nenhum erro novo aparece;<br>- nenhuma consulta de dado em uso acontece fora do salvar. | teste de componente (eventos e requisições) |
| UX-10 | O resumo "Confira os campos destacados ({N})." aparece no rodapé ao salvar com erro, com `role="status"`, diminui a cada correção e some quando não há mais erros. Tocar de novo na ação primária leva o foco ao próximo campo com erro. Os avisos de dado antigo não contam. | teste de componente |
| UX-11 | Identificação (RN-08):<br>- sem nenhum dos três, ao salvar, a mensagem do Negócio toma o lugar da dica, os três campos ficam com `aria-invalid` e com a mensagem no `aria-describedby`, e o foco vai para o Celular;<br>- um identificador válido tira o erro dos três;<br>- Caio apaga o próprio e-mail, com o celular preenchido, e salva. Depois apaga o celular: a mensagem aparece, e nada é enviado. | teste de componente + teste E2E (Caio) |
| UX-12 | As recusas do servidor com campo (dado em uso, ciclo, líder de si mesmo, cônjuge de si mesmo, pastor com líder, batismo sem "Batizado(a)?" e líder obrigatório) aparecem embaixo do campo certo e entram no resumo, e a primeira recebe o foco. O formulário fica aberto, com os dados. Nenhum toast de erro aparece, e "Já existe um membro com este e-mail, CPF ou celular." nunca aparece. | teste de componente (um mock por código) |
| UX-13 | Pedro e Rita cadastram Lúcia com o e-mail de Caio e o CPF de Diego. As duas mensagens aparecem, cada uma no seu campo, e nem o DOM nem a resposta da rede trazem o nome ou o id de Caio ou de Diego. Mudar o e-mail tira só a mensagem do e-mail. | teste E2E (massa) |
| UX-14 | Com o e-mail de Caio e o CPF de um excluído, aparece só a recusa do e-mail, sem o aviso do E2.01. Corrigido o e-mail, o próximo "Criar membro" abre o aviso da T9 do E2.01. | teste E2E |
| UX-15 | No cadastro novo de Rita, "Tem Liderança?" vem ligado, e o "Líder *" vem vazio. Salvar sem líder mostra "Escolha o líder ou desligue "Tem Liderança?"." embaixo do Líder, com o foco na busca, sem chamar o servidor. Com "Tem Liderança?" desligado, o Líder some, aparece "A pessoa fica sem liderança.", e o cadastro é aceito. | teste E2E |
| UX-16 | Rita liga "É Pastor(a)?" no cadastro de André (líder Pedro):<br>- "Tem Liderança?" e o Líder somem;<br>- aparecem "Pastor(a) não tem líder." e "Ao salvar, Pedro Alves deixa de ser o líder.", anunciados como status;<br>- desligar de novo antes de salvar devolve Pedro, com "Tem Liderança?" ligado;<br>- salvo com o interruptor ligado, André fica pastor, sem líder. | teste E2E |
| UX-17 | Desligar "Tem Liderança?" com líder, ou "Batizado(a)?" com data, mostra o aviso do P20 com o nome ou a data, e religar devolve o valor. Salvo desligado, o cadastro fica sem líder (Rita edita Caio) ou sem a data do batismo (critério da RN-16). | teste de componente + teste E2E |
| UX-18 | Quando Rita desliga "É Pastor(a)?" no cadastro de Samuel, "Tem Liderança?" aparece ligado, com o Líder vazio e obrigatório. | teste de componente |
| UX-19 | No seletor de líder, a própria pessoa nunca aparece.<br>- Com a AQ-4, editando André, Caio e Davi (inativo) aparecem desabilitados, com "Discípulo desta pessoa", e não podem ser escolhidos.<br>- Sem a AQ-4, escolher Davi e salvar mostra a mensagem do ciclo embaixo do Líder, com o foco nele.<br><br>O seletor de cônjuge não oferece a própria pessoa. | teste E2E |
| UX-20 | Data de nascimento, com o relógio em 23/11/2026, 23:30 de Brasília, e o navegador em UTC:<br>- 24/11/2026 mostra "A data de nascimento não pode ser futura.", e 23/11/2026 é aceita;<br>- 23/11/1926 mostra a mensagem dos 100 anos, e 24/11/1926 é aceita;<br>- o campo tem `max` 2026-11-23 e `min` 1926-11-24.<br><br>Com 14/02/1992, aparece "34 anos". | teste de componente (relógio e fuso simulados) |
| UX-21 | Fábio (critério da RN-17):<br>- ao abrir, aparecem os avisos do Nome, da Data de nascimento, do Celular e da Identificação, com ícone e texto, sem `aria-invalid` e sem a borda de erro;<br>- o celular aparece como "98887777";<br>- Rita muda só as observações e salva: a gravação é aceita, e o nome, o celular e a data não mudam;<br>- quando Pedro edita Fábio, ele vê só os avisos do Nome e da Data de nascimento. | teste E2E (massa) |
| UX-22 | Num campo com aviso, mexer tira o aviso e liga a regra ("9888-7770" mostra o erro do celular), e voltar ao valor gravado tira o erro e devolve o aviso. Caio, com o celular gravado como 51988887777, abre o próprio cadastro: o campo mostra "(51) 98888-7777", e salvar não conta o celular como alterado. | teste de componente |
| UX-23 | "Ver meus dados" (E2.02) não mostra avisos nem erros. | teste de componente |
| UX-24 | E-mail fictício:<br>- o cadastro com e-mail fictício abre com o E-mail vazio e o rótulo "E-mail", e nenhum texto ou atributo do DOM contém o domínio fictício;<br>- digitar "lucia@mci12fakemail.com" mostra a mensagem da RN-05 ao sair do campo;<br>- o cadastro novo sem e-mail envia o e-mail vazio, e não um e-mail fictício montado no navegador. | teste de componente + teste E2E (rede) |
| UX-25 | Durante o envio, o botão mostra "Criando…" ou "Salvando…" com o indicador, os dois botões ficam desabilitados, e um duplo toque gera uma chamada só. Sem conexão, a mensagem aparece no rodapé com `role="alert"`, os dados ficam, e o botão volta e recebe o foco. | teste de componente (mock) + teste E2E (offline) |
| UX-26 | Com algum campo alterado, "Cancelar", "✕", `Esc` e o clique fora do diálogo pedem "Descartar as alterações?", com o foco em "Continuar editando". Sem alteração, fecham direto. | teste de componente |
| UX-27 | Os erros e os avisos de campo têm texto em `text-foreground` (pelo menos 4,5:1 nos dois temas) e ícone. Nenhuma mensagem usa `text-destructive` como cor do texto, e nenhum estado depende só de cor. | inspeção (axe, nos temas claro e escuro) |
| UX-28 | Em 320 px e com zoom de 200%, rótulos, dicas, erros e avisos quebram linha sem corte. As opções de Sexo passam para uma por linha quando não cabem, com 44 px cada, e os botões do rodapé continuam alcançáveis. | inspeção + teste E2E (viewport) |
| UX-29 | O leitor de tela:<br>- lê com cada campo o erro, o aviso e a dica, nessa ordem;<br>- lê a legenda "Identificação" e a dica nos três campos do grupo;<br>- anuncia como status os avisos do P20 e o resumo. | inspeção (leitor de tela) |
| UX-30 | Nenhuma mensagem técnica aparece: códigos (22023, 23505), nomes de índice, de trigger ou de função do banco, ou texto em inglês. A recusa 42501 vira "Você não tem permissão para esta ação.". | teste de componente |
| UX-31 | Cada linha de interruptor tem pelo menos 44 px de altura, e o toque em qualquer ponto dela, inclusive no espaço entre o texto e o interruptor, muda o valor. | teste E2E (360×800, medida) |

### Perguntas para o `architect` (dados e contrato)
Em cada uma, a tela tem um comportamento padrão, o mais conservador, se a resposta for "não".

- **AQ-1. Recusas com código e campo** (RN-19, UXD-6). O formato é o do E2.01 (22023, `HINT = 'app_error'` e `DETAIL` em JSON). A `create-user-admin` responde com a mesma estrutura (`{ error, code, … }`). Códigos que a tela precisa distinguir:
  - `value_in_use`, com `fields` (lista com `email`, `mobile` e `cpf`): todos os dados em uso de uma vez (RN-10), sem nenhum dado do outro cadastro. O `23505` dos índices únicos, na edição pelo PostgREST, também vira esse código, com o campo (ponto 5 do Negócio);
  - `leader_self` e `leader_cycle` (`leader_id`), `spouse_self` (`spouse_id`), `pastor_with_leader` (`is_pastor`), `leader_required` (`leader_id`) e `baptism_date_without_baptism` (`baptism_date`);
  - as de formato, para quando o servidor pega o que a tela deixou passar (uma versão antiga da tela, ou a API): `name_invalid`, `gender_required`, `email_invalid`, `email_placeholder`, `mobile_invalid`, `cpf_invalid`, `identifier_required`, `birth_date_future` e `birth_date_too_old`, cada uma com o `field`.
  - *Padrão sem isso:* o texto vai para o `Alert` do topo, sem marcar o campo (a UX-12 fica parcial).
- **AQ-2. A mesma conferência na tela e no banco.**
  - Uma tabela de casos única, como a AQ-3 do E1.04, lida pelos testes do Vitest e do pgTAP: nome, formato do e-mail, domínios fictícios, leitura do celular, CPF e limites da data, com o "hoje" de Brasília.
  - A lista de domínios fictícios (o atual e o da D7) num lugar que a tela também leia, por exemplo uma constante gerada.
  - *Padrão sem isso:* a lista fica numa constante no front, com um teste que a compara com a do banco.
- **AQ-3. A edição leva só o que mudou?** (RN-17)
  - A UX pede que um campo que a pessoa não mexeu nunca dê erro e nunca seja regravado em outro formato.
  - Sugestão: o PATCH leva só os campos alterados (lidos como na regra), em vez de todos os campos visíveis, como faz o `toMemberWritePayload` hoje.
  - Confirmar se isso convive com as regras de escrita do E1.08 e do E2.02 (por exemplo, `has_leadership` e as pessoas mantidas no registro).
  - *Padrão sem isso:* a tela envia todos os campos visíveis, e a comparação do servidor decide. Isso exige que o servidor compare os valores lidos como na regra de cada campo.
- **AQ-4. Os discípulos no seletor de líder** (RN-13, UXD-12).
  - Quando o seletor escolhe o líder de um cadastro que já existe, cada opção traz `is_descendant`: se a opção é discípula direta ou indireta daquele cadastro, inclusive inativa.
  - O cálculo não pode atrasar a paginação.
  - *Padrão sem isso:* o seletor oferece todos, e a recusa vem ao salvar, no campo.
- **AQ-5. Cadastro idempotente** (queda de conexão no envio).
  - A `create-user-admin` aceita um identificador da tentativa, gerado quando o formulário abre.
  - Repetida com o mesmo identificador, ela devolve o cadastro já criado, e não "dado em uso" nem o aviso do E2.01.
  - *Padrão sem isso:* depois de uma queda, a nova tentativa pode receber "Este celular já está sendo usado por outro cadastro." por causa do próprio cadastro recém-criado. Nesse caso, a mensagem de conexão do cadastro novo ganha a frase "Antes de tentar de novo, confira na lista de Membros se o cadastro já foi criado." †
- **AQ-6. E-mail fictício** (RN-05).
  - (a) No cadastro sem e-mail, o formulário passa a enviar o e-mail vazio, e a `create-user-admin` gera o fictício. Confirmar.
  - (b) Para mostrar o campo vazio e calcular o aviso "Sem e-mail, celular ou CPF", a `members_view` pode devolver o e-mail fictício como nulo, ou trazer uma coluna como `email_is_placeholder`.
  - (c) Quando a pessoa apaga o e-mail real, a tela envia o e-mail vazio, e o servidor decide o que grava.
  - *Padrão sem o item (b):* a tela reconhece o e-mail fictício pela lista de domínios da AQ-2.

### Pendências para o PO (resolvidas em 2026-11-23)
Nenhuma bloqueava o desenho. Em todas, a UX adotou a opção marcada como "*Adotado*". O PO resolveu todas em 2026-11-23; as decisões viraram os padrões P-VAL-19 a P-VAL-26 do Negócio e estão nas RNs, nos critérios e nos "Textos de tela". **Revisar no PR.**

- **PO-UX-1. Conferir o formato ao sair do campo** (UXD-4, P22). A RN-19 fala dos erros "ao salvar". A UX acrescenta a conferência do formato quando a pessoa sai de um campo que alterou, só na tela, sem o servidor. O "todos de uma vez" ao salvar não muda.
  - *Adotado.*
  - *Alternativa:* conferir só ao salvar.
  - ***Resolvida (PO):** aceito (P-VAL-19, RN-19).* Conferir o **formato** ao sair do campo é só da tela e não consulta nada. O **dado em uso** e o ciclo continuam só ao salvar, como a RN-18 do E2.01 (P-DEL-22), para não facilitar descobrir dados de outras pessoas. Critérios novos na RN-19.
- **PO-UX-2. O grupo "Identificação" e a nova ordem dos campos** (UXD-2). O Negócio pede "uma dica" de que é preciso o e-mail, o celular ou o CPF. A UX agrupou os três campos, com o título "Identificação" (o rótulo do login) e a dica "A pessoa entra no sistema com o celular, o e-mail ou o CPF. Informe pelo menos um.".
  - *Adotado.*
  - ***Resolvida (PO):** aceito (P-VAL-20, RN-08).* "Identificação" é o mesmo termo do login (E1.04). A dica e a ordem dos campos entraram na RN-08 e nos "Textos de tela". A mensagem de erro da RN-08 não muda.
- **PO-UX-3. Sexo sem opção marcada no cadastro novo** (UXD-3). No legado, o campo vinha com Masculino.
  - Com um padrão, o erro da RN-03 nunca apareceria, e um cadastro feito às pressas ficaria com o sexo errado sem que ninguém o escolhesse. É o mesmo problema que a P-VAL-12 resolve na liderança.
  - *Adotado:* sem padrão.
  - ***Resolvida (PO):** aceito (P-VAL-21, RN-03).* A RN-03 diz que, no cadastro novo, nenhuma opção vem marcada, e o critério da RN-03 confere isso.
- **PO-UX-4. Desligar "É Pastor(a)?" num cadastro que já era de pastor** (T4). "Tem Liderança?" aparece ligado e pede o líder.
  - Decorre da P-VAL-12 ("sem líder, só com escolha explícita"), mas a RN-12 só fala do cadastro novo.
  - *Adotado.*
  - *Alternativa:* "Tem Liderança?" aparece desligado, e a pessoa fica sem liderança.
  - ***Resolvida (PO):** aceito (P-VAL-22, RN-12).* Na tela, desmarcar um pastor vale como um cadastro novo: o líder é obrigatório, a menos que quem edita desligue "Tem Liderança?" de propósito. Pela API, quem desmarca envia o líder ou "Tem Liderança?" desligado; se não enviar nenhum dos dois, vale o "Tem Liderança?" gravado (desligado), e a pessoa fica sem liderança. Só quem vê a igreja toda desmarca pastor (RN-10 do E2.02).
- **PO-UX-5. Avisos e volta atrás nos interruptores** (P20). A RN-11 pede que o líder saia "à vista de quem edita". A UX acrescenta:
  - o mesmo aviso para "Tem Liderança?" e "Batizado(a)?";
  - a volta do valor quando a pessoa desfaz o toque, antes de salvar.
  - *Adotado.*
  - ***Resolvida (PO):** aceito (P-VAL-23, RN-11, RN-12 e RN-16).* Nada é apagado em silêncio: os três interruptores avisam o que será apagado, com o valor, e desfazer o toque devolve o dado. Os avisos entraram nos "Textos de tela".
- **PO-UX-6. Duas ajudas na escolha** que não estão no Negócio:
  - a idade embaixo da data de nascimento, como no legado (UXD-11);
  - os discípulos desabilitados no seletor de líder, com "Discípulo desta pessoa" (UXD-12). O seletor só mostra pessoas que quem edita já vê, e o líder de cada uma já aparece na lista de Membros, então nada novo é revelado.
  - *Adotado.* O segundo depende da AQ-4.
  - ***Resolvida (PO):** as duas aceitas (P-VAL-24, RN-13 e RN-15).* A idade repete o legado (`UI/pages/Members/details.js:134`). Os discípulos desabilitados não revelam nada novo, porque o seletor só mostra quem a pessoa já vê. Sem a AQ-4, vale o padrão da UX: o seletor oferece todos, e a recusa do ciclo vem ao salvar, no campo.
- **PO-UX-7. O tom do aviso da data de nascimento.** A data de Lúcia (24/11/1926) passa do limite com o tempo sem estar errada, e "Corrija quando puder" sugere um erro.
  - *Sugestão:* "Data de nascimento fora do intervalo aceito. Confira quando puder."
  - *Não adotado:* fica o texto do Negócio até o PO decidir, porque "confira" muda um pouco o sentido.
  - ***Resolvida (PO):** a sugestão foi aceita (P-VAL-25).* O aviso passa a "Data de nascimento fora do intervalo aceito. Confira quando puder.". A data pode estar certa e só ter passado do limite com o tempo; "confira" serve para os dois casos. O texto foi trocado nos "Textos de tela" e na T6.
- **PO-UX-8. Textos definidos pela UX** (marcados com † em Textos):
  - "Campos com * são obrigatórios.";
  - o título "Identificação" e a dica do grupo;
  - "A pessoa fica sem liderança." e "Pastor(a) não tem líder.";
  - os avisos dos interruptores;
  - "Discípulo desta pessoa";
  - a idade;
  - o número no resumo;
  - "Salvar alterações" e "Criando…";
  - a mensagem de conexão e a frase da AQ-5;
  - a descrição da confirmação de descartar.
  - *Adotados.*
  - ***Resolvida (PO):** todos aceitos, sem ajuste (P-VAL-26).* Os ligados a uma regra (dica da Identificação, "A pessoa fica sem liderança.", "Pastor(a) não tem líder.", avisos dos interruptores, "Discípulo desta pessoa", idade, resumo com o número, "Campos com * são obrigatórios." e a mensagem de conexão) foram copiados para os "Textos de tela" do Negócio. A frase da AQ-5 só vale se o `architect` não fizer o cadastro idempotente.
- **Defeito da máscara do celular (UXD-9).** Registrado no Negócio como critério da RN-06, para ser corrigido neste passo: colar "+55 (51) 98888-7777" mostra "(51) 98888-7777" e grava 51988887777, sem cortar dígitos (hoje vira "(55)51988-8877").

## Solução técnica
_Seção do `architect`. Escrita em 2026-11-23, só como desenho: nada foi implementado. **A implementação começa depois do E1.04 inteiro (PR 3 em produção), do E2.01 inteiro e do PR 1 do E2.02 em produção.** O PR 3 deste passo também espera o front do E2.02 (T6 do `MemberForm`). O desenho parte do estado final desses passos, com os nomes que eles definem. Se um nome ou uma assinatura mudar lá, a tarefa 2 volta ao `architect`._

_Conferido em 2026-11-23:_
- _na stack local `supabase_db_mci-e108-pr2` (E1.08 completo e PR 1 do E2.01), só com leitura:_
  - _colunas, defaults, constraints, índices e triggers de `members`;_
  - _os corpos de `enforce_member_write_rules`, `enforce_member_links`, `sync_spouse_relationship`, `compute_g12_level`, `restore_member`, `find_deleted_member_matches`, `_del_raise` e `sp_today`;_
  - _o SELECT por coluna de `members` (PR 5 do E1.08) e a `members_view`;_
  - _a collation do banco (ICU, `en-US`): `[[:alpha:]]` reconhece letras acentuadas;_
  - _o calendário do Postgres: `2000-02-29 − 100 anos = 1900-02-28`;_
- _no `mci-connect` (`origin/main`, `bef0877`): `create-user-admin`, `MemberForm.tsx`, `Members.tsx`, `src/lib/members/fields.ts`, `use-member-options.ts`, `AsyncMemberSelect.tsx`, `src/lib/selectors.ts`, `src/lib/errors.ts` e as massas dos pgTAP do E1.08 e do E2.01;_
- _no código do Supabase Auth (`internal/api/admin.go`): a criação pela API de administração aceita um `id` próprio, e um e-mail repetido responde `email_exists` (422);_
- _na documentação do Postgres (`CREATE POLICY`): no INSERT e no UPDATE, o `WITH CHECK` do RLS é avaliado **depois** dos triggers `BEFORE` (leitura técnica 1)._

### Revisão das regras
Nenhuma RN voltou ao PO. As lacunas técnicas foram resolvidas pela leitura mais conservadora e estão em [Definidas pelo architect](#definidas-pelo-architect-revisar-no-pr).

Casos de borda conferidos:
- **Fuso:** "hoje" é sempre `sp_today()` no banco e `spToday()` na tela, com `America/Sao_Paulo`. O limite de 100 anos usa o calendário do Postgres (29/02 vira 28/02 quando o ano não é bissexto), e a tela segue a mesma regra pela tabela de casos (DA-13).
- **Virada de semana:** nenhuma regra deste passo depende da semana.
- **Casal:**
  - o cônjuge conta na unicidade (RN-09);
  - a cascata do trigger de cônjuge passa pelos triggers novos, mas só muda `spouse_id`, então só a RN-14 é conferida;
  - casar consigo mesmo é recusado pelo trigger e pelo `CHECK`.
- **Inativo:** conta na unicidade e no ciclo, e o seletor de líder mostra o discípulo inativo desabilitado.
- **Sem líder:** é a situação (c) da RN-11, com "Tem Liderança?" desligado. Quem só vê o ministério não chega nela (RN-10 do E2.02).
- **Pastor:** sem líder e com "Tem Liderança?" desligado, garantido por `CHECK`. Desmarcar o pastor segue a P-VAL-22.
- **Excluído:**
  - não conta na unicidade (índices parciais);
  - os `CHECK`s valem também para ele (DA-6);
  - a subida que procura ciclos passa por ele;
  - a restauração confere a unicidade com a mesma chave do celular.
- **Consolidado (futuro):** a flag decide se o consolidado entra nos índices únicos e no identificador obrigatório (Fora de escopo do Negócio). Se ficar fora, os índices e o trigger ganham `AND NOT is_consolidated`.
- **Concorrência:** ver [Bloqueios e concorrência](#bloqueios-e-concorrência).
- **Volume:** ver o risco 11.

Leituras técnicas. Nenhuma muda regra, mas o PO e o QA precisam saber delas:
1. **No INSERT, o RLS confere a permissão depois dos triggers.**
   - O `WITH CHECK` da política de INSERT (`create_member`) só é avaliado depois de todos os triggers `BEFORE`.
   - Sem cuidado, quem não tem "Criar Membro" receberia "Informe o sexo." ou "Este CPF já está sendo usado…" antes do 42501. Isso fere a RN-19 e permitiria descobrir dados em uso sem poder cadastrar.
   - Por isso, o trigger de regras de escrita (`aa_enforce_member_write_rules`) passa a recusar com 42501 o INSERT sem `create_member`, antes de qualquer regra deste spec (DT-13).
   - O mesmo vale para a recusa `deleted_account_email` do E2.01, que hoje roda num trigger *definer* antes do RLS. Ela passa para depois da unicidade e da permissão (DT-14).
   - No UPDATE não há o problema: o `USING` filtra as linhas antes dos triggers.
2. **"Pela API", reenviar um valor igual depois de lido pela regra não muda nada.** Um PATCH com `"(51) 98888-7777"` num cadastro gravado como `51988887777` deixa o valor gravado e não confere nada (RN-17). O mesmo vale para um valor antigo fora do formato: reenviado igual, ele fica como está.
3. **A recusa por dado em uso cita sempre todos os dados.** A pré-checagem roda sob uma trava por valor (DT-07), então uma corrida termina na mensagem amigável, e não no `23505`. O `23505` só aparece em caminhos que não passam pelos triggers (a carga em `replica`) e é traduzido pelo nome do índice.
4. **Ciclos sob concorrência.** Toda troca de líder passa por uma trava única da árvore (DT-08). Duas trocas que formariam um ciclo ficam em fila, e a segunda recebe a mensagem do ciclo. Isso vale no isolamento `READ COMMITTED`, que é o do PostgREST e das Edge Functions. Um script em `REPEATABLE READ` não deve trocar líderes em paralelo.
5. **O e-mail fictício passa a existir em toda conta de acesso, e só nela** (DA-1). O cadastro guarda só o e-mail real. Para quem usa o sistema, o resultado é o da RN-05: o e-mail aparece como "não informado", e a pessoa entra pelo celular ou pelo CPF.
6. **As massas de teste também seguem as regras.** A RN-01 vale para o `postgres` e para a *service role*. As massas dos pgTAP do E1.08, do E2.01 e do E2.02 inserem membros sem sexo, sem identificador e "sem liderança" pelo default de hoje. Elas são adaptadas no PR 2 (tarefa 4).
7. **`would_leave_scope` (E2.02) vem depois das recusas deste spec.** Ele é um trigger `AFTER`, que confere o resultado de uma gravação permitida. Não é recusa de permissão, então a ordem da RN-19 não muda.
8. **Quem não vê os dados sensíveis nunca recebe a recusa de identificador ou de dado em uso numa edição.** A regra 6 do E1.08 devolve os valores gravados antes do trigger deste spec, então nada mudou nesses campos.

#### Respostas aos pontos do PO e da UX
| Ponto | Resposta |
|---|---|
| 1. Tipo (a), tipo (b) e a carga | Toda regra do tipo (a) é `CHECK`, `NOT NULL` ou índice único, e continua valendo em `replica`. A exceção é a RN-13 (ciclo), que só cabe em trigger: a carga só termina sem ciclos (5.4), e a reconciliação confere com `private.member_rule_violations()` (DT-02). As do tipo (b) ficam no trigger, que compara com o valor gravado. |
| 2. Dados de teste em produção | SQL só de leitura em [Conferência em produção](#conferência-em-produção-tarefa-1). A migration 2 corrige sozinha o que não perde informação e para, com a lista de ids, no que pede decisão (DA-8). |
| 3. Uma normalização só | As funções do E2.01 e do E1.04 são reaproveitadas. As novas ficam ao lado delas, e os índices, os `CHECK`s, os triggers, a restauração e o aviso de excluído usam as mesmas. Tabela de casos única para Vitest e pgTAP (DT-17). |
| 4. E-mail da conta de acesso | A conta usa sempre um e-mail técnico, `<id do membro>@<domínio fictício>`, que nunca muda e nunca aparece. O cadastro guarda só o e-mail real (DA-1, DT-01). |
| 5. Recusas com código e campo | Formato `app_error` do E2.01, com `field` ou `fields`, inclusive na `create-user-admin` ([Formato dos erros](#formato-dos-erros-aq-1)). Nenhuma conta órfã: a conta só é criada depois do ensaio, e é desfeita se o cadastro falhar. |
| 6. "O que muda" | O trigger compara os valores lidos pela regra (DT-05), e o PATCH leva só os campos alterados (DT-19). Nenhum RETURNING de coluna sensível: o front usa `.select('id')`. |
| 7. Ciclos | Subida pela cadeia de líderes, em qualquer profundidade, sob a trava única da árvore (DT-08). `member_descendants_among` marca os discípulos no seletor sem mudar a consulta da página (DT-16). |
| 8. E-mail aceito pelo Auth | Com a DA-1, o e-mail real nunca vai para o Auth. O e-mail técnico é sempre aceito pelo Auth. |
| 9. Cadastro idempotente | `attemptId`, que vira o id do membro e o id da conta (DT-11). |
| 10. E-mail fictício na `members_view` | Não precisa de coluna nova: o cadastro não guarda mais o fictício, e a view devolve nulo (DA-7). |
| 11. P-VAL-22 | Já coberto: desmarcar pastor exige ver a igreja toda (`ac_enforce_member_scope`), e a pessoa fica sem liderança pela chave gravada. |

#### Definidas pelo architect (revisar no PR)
Pontos que as RNs não respondem por inteiro. O `architect` adotou a leitura mais conservadora e coerente com as RNs. O usuário pode mudar qualquer um no PR.

| # | Ponto | Padrão adotado | Por quê |
|---|---|---|---|
| DA-1 | Relação entre o e-mail do cadastro e o da conta de acesso (ponto 4) | Toda conta nova usa um e-mail técnico, `<id do membro>@<domínio fictício>`, que nunca muda. O cadastro (`members.email`) guarda só o e-mail real, ou nada. As contas que já existem ficam com o e-mail que têm. | A `sign-in` procura pelo cadastro (P-LOG-01) e usa o e-mail da conta só para emitir a sessão. Assim, um e-mail trocado ou apagado no cadastro fica livre na hora (P-VAL-10), sem sincronizar nada com o Auth. O e-mail real nunca chega ao Auth (ponto 8), e o fictício é gerado só pelo servidor (RN-05). |
| DA-2 | Texto da recusa `leader_required` pela API | O servidor responde sempre "Escolha o líder.". A tela mostra "Escolha o líder ou desligue "Tem Liderança?"." para quem vê a igreja toda, pelo código. | A RN-12 tem um texto por persona, mas o critério dela espera "Escolha o líder." para Rita pela API, e a UX-15 espera o texto longo para Rita na tela. |
| DA-3 | Tamanho do e-mail | No máximo 254 caracteres. Acima disso, "E-mail inválido. Confira o endereço digitado." | É o maior e-mail válido, e a `sign-in` recusa uma identificação maior (DA-4 do E1.04). Sem o limite, um e-mail aceito no cadastro não serviria para entrar. |
| DA-4 | E-mail da conta de um membro excluído (RN-18 do E2.01) numa edição | Também é recusado ao trocar o e-mail de um cadastro, e não só no cadastro novo. | A P-VAL-10 trata o caso como a única exceção ao "dado liberado", para qualquer gravação. Com a DA-1, o motivo técnico some, e o PO pode retirar a exceção. |
| DA-5 | Celular antigo ilegível na unicidade | Fica fora da unicidade, como já fica fora do login. A comparação é sempre pela leitura da RN-06. | A RN-09 compara "pela leitura da RN-06". Um número sem DDD não é lido e não identifica ninguém. Quando alguém o corrige, a unicidade passa a valer. |
| DA-6 | Regras do tipo (a) e os cadastros excluídos | Os `CHECK`s valem também para os excluídos. A unicidade conta só os não excluídos (DEL-04). | Um `CHECK` vale para todas as linhas. A restauração não pode trazer de volta um cadastro fora das regras. |
| DA-7 | E-mail fictício no cadastro | Proibido sempre (`CHECK`), e não só no campo que muda. A publicação troca os fictícios gravados por vazio, e as contas continuam com eles. | Com a DA-1, o cadastro nunca precisa do fictício. O `CHECK` vale também na carga, que deixa de gravá-lo no cadastro (6.2). |
| DA-8 | Dados de produção fora das regras do tipo (a) | A migration 2 corrige sozinha só o que não perde informação: e-mail em minúsculas, CPF só com dígitos, celular legível na forma lida, espaços do nome, e-mail fictício vazio, texto vazio ou só com espaços como vazio (nulo) em todo campo de texto opcional (DT-24) e a chave "Tem Liderança?" coerente com o líder e com o pastor. Para o resto, ela para com a lista de ids, e o usuário decide. | O usuário pediu para decidir as correções. A forma do dado não é decisão. |
| DA-9 | Salvar uma edição sem nenhuma mudança | A tela não chama o servidor e fecha o formulário, como "Cancelar" sem alterações. | Nada a gravar, e não há o que confirmar. |
| DA-10 | Tentativa repetida (`attemptId`) que não leva a um cadastro que quem chama vê | Recusa técnica `attempt_already_used`: "*Este cadastro já foi enviado. Confira na lista de Membros.*" | Só acontece pela API, ou se o cadastro saiu do escopo de quem cadastrou entre as duas tentativas. |
| DA-11 | Ordem das recusas do servidor | Permissão e escopo (E1.03, E2.02), excluído escolhido (E2.01), depois formato (na ordem da tela), identificador, cônjuge e liderança, ciclo, batismo, dado em uso e, por último, o e-mail da conta de um excluído. A API devolve uma recusa por vez. Só o dado em uso cita mais de um campo. | RN-19 ("basta a primeira recusa") e RN-10 (unicidade antes do aviso de excluído). As conferências baratas vêm antes das que pegam travas. |
| DA-12 | O que é "letra" no nome (RN-02) | Uma letra de qualquer alfabeto: `[[:alpha:]]` no banco (ICU) e `\p{L}` na tela. Acentos e cedilha contam; dígitos e pontuação, não. | Nomes estrangeiros não podem ser recusados. A migration 1 confere a classificação do banco antes de criar as regras. |
| DA-13 | 100 anos antes de um 29 de fevereiro | O calendário do Postgres: 29/02 vira 28/02 quando o ano não é bissexto. A tela segue a mesma regra. | A RN-15 não trata o caso. Ele só aparece em 2100 com um ano bissexto anterior; a tabela de casos fixa o comportamento. |

### Visão geral
Seis partes, no padrão do E1.08, do E2.01 e do E2.02:

1. **Funções de regra, ao lado das do E2.01 e do E1.04.** Uma função por regra, imutável, usada nos índices, nos `CHECK`s, nos triggers, na restauração e no aviso de excluído. A tela replica as mesmas regras, e as duas passam pela mesma tabela de casos.
2. **Regras do tipo (a) como constraints.** São `NOT NULL`, `CHECK`s e três índices únicos parciais, que valem para qualquer caminho, inclusive a carga em `replica`. A única regra do tipo (a) fora delas é o ciclo.
3. **Dois triggers novos em `members`:**
   - `a0_normalize_member`, o primeiro de todos: normaliza, devolve o valor gravado ao que não mudou e deriva as chaves. Nunca recusa.
   - `ad_enforce_member_rules`, depois dos de permissão, escopo e excluído: confere as regras e recusa com código e campo, com as travas de unicidade e de ciclo.
4. **Conta de acesso com e-mail técnico** e a `create-user-admin` idempotente, sem conta órfã.
5. **Seletor de líder com os discípulos marcados**, por uma RPC chamada junto com a página.
6. **Front:** a regra pura em `src/lib/members/`, o formulário da UX (T1 a T7) e o PATCH só com o que mudou.

### Modelo de dados e migrations

#### Ordem das migrations
Os nomes são sugestões; o timestamp é o do momento da criação.
- Cada arquivo é idempotente (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP … IF EXISTS` antes de `CREATE TRIGGER`, `DO` com guarda de `duplicate_object`) e roda num banco zerado depois das migrations existentes e das do E1.04, E2.01 e E2.02.
- Depois de cada PR com migration, regenere o `types.ts`.
- **As mensagens das guardas trazem só ids e nomes de regra, nunca e-mail, CPF ou celular.** Os logs do GitHub Actions de um repositório público são públicos.

| # | PR | Arquivo | Conteúdo | Por que separado |
|---|---|---|---|---|
| 1 | 1 | `<ts>_e204_01_rule_functions.sql` | Guarda de pré-requisitos e da classificação de letras; funções de regra; `member_account_email`; `_member_values_in_use`; `member_descendants_among`; `private.member_rule_violations()`; guarda de repetidos e os três índices únicos; `restore_member` (e) e `find_deleted_member_matches` com a chave do 9º dígito; grants | Neutro para o front em produção: só acrescenta funções e a unicidade, que o front atual já trata (`23505`) |
| 2 | 2 | `<ts>_e204_02_member_rules.sql` | Normalização dos dados existentes; guarda das violações do tipo (a); `NOT NULL` em `gender`; `has_leadership` sem default; `CHECK`s; os dois triggers novos; ajustes em `enforce_member_write_rules`, `enforce_member_scope`, `enforce_member_links`, `sync_spouse_relationship` e `check_member_insert`; grants | Muda o que o front pode gravar; vai junto com a `create-user-admin` nova e o ajuste mínimo do front ([Implantação](#implantação)) |

#### Funções de regra (migration 1)
```sql
-- 0. Pré-requisitos: E1.04 (normalize_mobile, mobile_match_key, is_valid_cpf, is_placeholder_email),
--    E2.01 (deleted_at, normalize_email, normalize_digits, _del_raise, restore_member) e
--    E2.02 (viewer_sees_member, check_member_insert, enforce_member_scope). Falha cedo, sem mudar nada.
DO $$ BEGIN
  IF to_regprocedure('public.mobile_match_key(text)') IS NULL
     OR to_regprocedure('public.is_valid_cpf(text)') IS NULL
     OR to_regprocedure('public.normalize_email(text)') IS NULL
     OR to_regprocedure('public.viewer_sees_member(uuid)') IS NULL
     OR to_regprocedure('public.check_member_insert(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'E2.04 depende do PR 1 do E1.04, do PR 1 do E2.01 e do PR 1 do E2.02.';
  END IF;
END $$;

-- Domínios fictícios (D7): a lista única. O E1.06 acrescenta o domínio novo e troca o de geração.
CREATE OR REPLACE FUNCTION public.placeholder_email_domains() RETURNS text[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$ SELECT ARRAY['mci12fakemail.com'] $$;
CREATE OR REPLACE FUNCTION public.placeholder_email_domain() RETURNS text          -- o de geração
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$ SELECT 'mci12fakemail.com' $$;
-- Reescrita do E1.04, com a mesma regra, lendo a lista acima.
CREATE OR REPLACE FUNCTION public.is_placeholder_email(_email text) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
  SELECT coalesce(split_part(public.normalize_email(_email), '@', 2) = ANY (public.placeholder_email_domains()), false)
$$;

-- RN-04 sobre o e-mail já normalizado: sem espaços, um "@", algo antes, e depois dele pelo
-- menos um ponto, com algo antes e depois de cada ponto. DA-3: até 254 caracteres.
CREATE OR REPLACE FUNCTION public.is_valid_email(_email text) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
  SELECT coalesce(length(_email) <= 254
                  AND _email ~ '^[^[:space:]@]+@[^[:space:]@.]+(\.[^[:space:]@.]+)+$', false)
$$;

-- RN-02: espaços das pontas fora; espaços seguidos (tabulação e quebra de linha inclusive) viram um.
CREATE OR REPLACE FUNCTION public.normalize_person_name(_name text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
  SELECT nullif(btrim(regexp_replace(coalesce(_name, ''), '[[:space:]]+', ' ', 'g')), '')
$$;
-- Pelo menos duas palavras com alguma letra (DA-12): "Ana B." sim; "Ana", "Ana 2" e "Ana ." não.
CREATE OR REPLACE FUNCTION public.is_valid_person_name(_name text) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
  SELECT (SELECT count(*) FROM regexp_split_to_table(public.normalize_person_name(_name), ' ') AS w
           WHERE w ~ '[[:alpha:]]') >= 2
$$;

-- RN-08: e-mail real válido, celular legível (RN-06) ou CPF válido (RN-07).
CREATE OR REPLACE FUNCTION public.member_has_login_identifier(_email text, _mobile text, _cpf text)
RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
  SELECT coalesce(public.is_valid_email(public.normalize_email(_email)) AND NOT public.is_placeholder_email(_email), false)
      OR public.normalize_mobile(_mobile) IS NOT NULL
      OR coalesce(public.is_valid_cpf(public.normalize_digits(_cpf)), false)
$$;

-- RN-15 com o "hoje" como parâmetro: o trigger passa sp_today(), e os testes passam uma data fixa.
-- Devolve NULL, 'birth_date_future' ou 'birth_date_too_old' (DA-13: calendário do Postgres).
CREATE OR REPLACE FUNCTION public.birth_date_problem(_birth date, _today date) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
  SELECT CASE WHEN _birth IS NULL THEN NULL
              WHEN _birth > _today THEN 'birth_date_future'
              WHEN _birth <= (_today - interval '100 years')::date THEN 'birth_date_too_old' END
$$;

-- DA-1: e-mail técnico da conta de acesso. Nunca aparece, nunca muda, não serve para entrar.
CREATE OR REPLACE FUNCTION public.member_account_email(_member_id uuid) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
  SELECT _member_id::text || '@' || public.placeholder_email_domain()
$$;

-- Guarda da classificação de letras (DA-12). Sem ela, a regra do nome recusaria acentos.
DO $$ BEGIN
  IF NOT (public.is_valid_person_name('Ção Éd') AND public.is_valid_person_name('Ana B.')
          AND NOT public.is_valid_person_name('Ana 2') AND NOT public.is_valid_person_name('Ana .')) THEN
    RAISE EXCEPTION 'E2.04: o banco não classifica letras acentuadas como letras. Voltar ao architect.';
  END IF;
END $$;
```
- As funções acima são `IMMUTABLE`, porque aparecem em `CHECK`s e índices. Recebem EXECUTE para `authenticated` e `service_role`, sem `anon` (`REVOKE … FROM PUBLIC, anon`): `CHECK`s, índices e triggers *invoker* rodam com o papel de quem grava (lição do E1.08).
- `member_account_email` tem EXECUTE só para `service_role`.

#### Unicidade (migration 1)
```sql
-- Guarda: repetidos entre não excluídos, com as mesmas chaves dos índices. Mensagem só com ids.
DO $$
DECLARE _dups jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object('field', d.field, 'ids', d.ids)) INTO _dups FROM (
    SELECT 'email' AS field, array_agg(id ORDER BY id) AS ids FROM public.members
     WHERE deleted_at IS NULL AND public.normalize_email(email) IS NOT NULL
     GROUP BY public.normalize_email(email) HAVING count(*) > 1
    UNION ALL
    SELECT 'mobile', array_agg(id ORDER BY id) FROM public.members
     WHERE deleted_at IS NULL AND public.mobile_match_key(mobile_whatsapp) IS NOT NULL
     GROUP BY public.mobile_match_key(mobile_whatsapp) HAVING count(*) > 1
    UNION ALL
    SELECT 'cpf', array_agg(id ORDER BY id) FROM public.members
     WHERE deleted_at IS NULL AND public.normalize_digits(cpf) IS NOT NULL
     GROUP BY public.normalize_digits(cpf) HAVING count(*) > 1) d;
  IF _dups IS NOT NULL THEN
    RAISE EXCEPTION 'E2.04: dados repetidos entre cadastros não excluídos: %', _dups;
  END IF;
END $$;

-- RN-09 (DT-03). O nome contém email, mobile ou cpf: a restore_member traduz o 23505 por ele.
CREATE UNIQUE INDEX IF NOT EXISTS members_email_key
  ON public.members (public.normalize_email(email)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS members_mobile_key
  ON public.members (public.mobile_match_key(mobile_whatsapp)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS members_cpf_key
  ON public.members (public.normalize_digits(cpf)) WHERE deleted_at IS NULL;
```
- Os três índices de busca do E1.04 (`members_login_*_idx`, sem predicado) **ficam**: o segundo estágio da `sign-in` e o aviso de excluído procuram excluídos, que os índices parciais não cobrem.
- `mobile_match_key` devolve nulo para o celular ilegível, que fica fora da unicidade (DA-5).

**Helper da unicidade** (interno, *definer*, sem EXECUTE para `authenticated`). O trigger e a `restore_member` usam o mesmo:
```sql
-- Trava (em ordem) e devolve os campos em uso por OUTRO cadastro não excluído: subconjunto
-- ordenado de {email, mobile, cpf}. Um valor nulo não é conferido nem travado.
CREATE OR REPLACE FUNCTION public._member_values_in_use(
  _self uuid, _email text, _mobile text, _cpf text, _lock boolean DEFAULT true)
RETURNS text[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _e text := normalize_email(_email);
  _m text := mobile_match_key(_mobile);
  _c text := normalize_digits(_cpf);
  _k text;
  _used text[] := '{}';
BEGIN
  IF _lock THEN                                                   -- DT-07: chaves em ordem fixa
    FOR _k IN SELECT x FROM unnest(ARRAY['cpf:' || _c, 'email:' || _e, 'mobile:' || _m]) AS x
               WHERE x IS NOT NULL ORDER BY x LOOP
      PERFORM pg_advisory_xact_lock(hashtextextended('member-identifier:' || _k, 0));
    END LOOP;
  END IF;
  -- Comandos novos depois da trava: em READ COMMITTED, enxergam o que a outra transação gravou.
  IF _e IS NOT NULL AND EXISTS (SELECT 1 FROM members o WHERE o.deleted_at IS NULL
        AND o.id IS DISTINCT FROM _self AND normalize_email(o.email) = _e) THEN _used := _used || 'email'; END IF;
  IF _m IS NOT NULL AND EXISTS (SELECT 1 FROM members o WHERE o.deleted_at IS NULL
        AND o.id IS DISTINCT FROM _self AND mobile_match_key(o.mobile_whatsapp) = _m) THEN _used := _used || 'mobile'; END IF;
  IF _c IS NOT NULL AND EXISTS (SELECT 1 FROM members o WHERE o.deleted_at IS NULL
        AND o.id IS DISTINCT FROM _self AND normalize_digits(o.cpf) = _c) THEN _used := _used || 'cpf'; END IF;
  RETURN _used;
END $$;
```

**Ajustes no E2.01 (migration 1):**
- `restore_member`, item (e): a consulta própria dá lugar a `_member_values_in_use(_member_id, _m.email, _m.mobile_whatsapp, _m.cpf, true)`. A mensagem e o código (`restore_value_in_use`) não mudam, e o celular passa a comparar com o 9º dígito. A tradução do `23505` continua, agora com os índices reais.
- `find_deleted_member_matches`: o celular passa a comparar `mobile_match_key` dos dois lados (ponto 3 do PO).

#### Integridade do tipo (a) (migration 2)
```sql
ALTER TABLE public.members ALTER COLUMN gender SET NOT NULL;              -- RN-03 (o CHECK M/F já existe)
ALTER TABLE public.members ALTER COLUMN has_leadership DROP DEFAULT;      -- DT-06: omitido = NULL, resolvido no a0_

-- Dentro de DO com guarda de duplicate_object. Os CHECKs valem também para os excluídos (DA-6).
ALTER TABLE public.members ADD CONSTRAINT members_email_check                -- RN-04: gravado normalizado e válido
  CHECK (email IS NULL OR coalesce(email = public.normalize_email(email) AND public.is_valid_email(email), false));
ALTER TABLE public.members ADD CONSTRAINT members_email_not_placeholder_check  -- RN-05, DA-7
  CHECK (NOT public.is_placeholder_email(email));
ALTER TABLE public.members ADD CONSTRAINT members_cpf_check                  -- RN-07: 11 dígitos válidos
  CHECK (cpf IS NULL OR coalesce(public.is_valid_cpf(cpf), false));
ALTER TABLE public.members ADD CONSTRAINT members_leadership_check           -- RN-11: uma das três situações
  CHECK (   (is_pastor AND leader_id IS NULL AND NOT has_leadership)
         OR (NOT is_pastor AND has_leadership = (leader_id IS NOT NULL)));
ALTER TABLE public.members ADD CONSTRAINT members_leader_not_self_check      -- RN-13
  CHECK (leader_id <> id);
ALTER TABLE public.members ADD CONSTRAINT members_spouse_not_self_check      -- RN-14
  CHECK (spouse_id <> id);
ALTER TABLE public.members ADD CONSTRAINT members_baptism_check             -- RN-16
  CHECK (is_baptized OR baptism_date IS NULL);
```
- O tipo (b) (nome, celular, nascimento e identificador) não cabe em `CHECK`, porque depende do que mudou ou do dia de hoje. Fica no trigger.
- O `CHECK` que chama função não é revalidado quando a função muda. O E1.06, ao acrescentar um domínio, confere antes que nenhum cadastro tem e-mail nele.

#### Dados existentes (migration 2)
Antes das constraints e dos triggers, na mesma transação:
1. **Correções sem perda (DA-8)**, com `UPDATE` simples. A Auditoria registra as alterações sem autor, como na migration 1 do E2.02.
   - texto vazio ou só com espaços (`~ '^[[:space:]]*$'`) vira nulo em todo campo de texto opcional de `members` (DT-24). Vem antes dos demais: o CPF `''` dava `cpf` na guarda (2 cadastros de teste em produção, 2026-11-25);
   - e-mail fictício vira nulo (a conta continua com ele);
   - e-mail em `normalize_email`;
   - CPF em `normalize_digits` só quando o resultado é um CPF válido (o inválido com letras não é apagado: para na guarda);
   - celular legível em `normalize_mobile`, e o ilegível só com dígitos;
   - nome em `normalize_person_name`;
   - `has_leadership := false` no pastor sem líder;
   - `has_leadership := true` em quem tem líder (já feito pelo E2.02; repetir não muda nada).

   As chaves dos índices únicos não mudam com essas correções.
2. **Guarda:** `SELECT rule, array_agg(member_id) FROM private.member_rule_violations() GROUP BY rule`. Se houver qualquer linha, a migration falha com as regras e os ids, e nada muda. O usuário corrige pelos resultados da [conferência](#conferência-em-produção-tarefa-1) e publica de novo.

**`private.member_rule_violations()`** (criada na migration 1; `SECURITY INVOKER`, sem grants; roda como `postgres` no SQL Editor, na migration e na reconciliação do E4.09) devolve `(rule text, member_id uuid)`, uma linha por violação do tipo (a):

| `rule` | Condição |
|---|---|
| `gender` | `gender` nulo ou fora de M e F |
| `email_format` | e-mail não nulo, fora de `normalize_email` ou inválido |
| `email_placeholder` | e-mail fictício no cadastro |
| `cpf` | CPF não nulo e inválido |
| `email_in_use`, `mobile_in_use`, `cpf_in_use` | repetido entre não excluídos, com as chaves dos índices |
| `pastor_with_leader`, `pastor_with_flag`, `flag_without_leader`, `leader_without_flag` | fora das três situações da RN-11 |
| `leader_self`, `leader_cycle` | líder de si mesmo; cadastro dentro de um ciclo (subida com caminho visitado) |
| `spouse_self` | cônjuge de si mesmo |
| `baptism_date` | data do batismo sem "Batizado(a)?" |

#### Integridade garantida pelo banco
| Garantia | Como | Vale em `replica` (carga)? |
|---|---|---|
| Sexo M ou F (RN-03) | `NOT NULL` e `members_gender_check` | sim |
| E-mail gravado normalizado e válido (RN-04) | `members_email_check` | sim |
| Nenhum e-mail fictício no cadastro (RN-05, DA-7) | `members_email_not_placeholder_check` | sim |
| CPF com 11 dígitos válidos (RN-07) | `members_cpf_check` | sim |
| Unicidade entre não excluídos (RN-09) | `members_email_key`, `members_mobile_key`, `members_cpf_key` | sim |
| Uma das três situações de liderança (RN-11) | `members_leadership_check` | sim |
| Ninguém é líder nem cônjuge de si mesmo (RN-13, RN-14) | `members_leader_not_self_check`, `members_spouse_not_self_check` | sim |
| Sem data do batismo para quem não é batizado (RN-16) | `members_baptism_check` | sim |
| Sem ciclo em qualquer profundidade (RN-13) | trigger `ad_` com a trava da árvore | **não**: a carga só termina sem ciclos (5.4), e a reconciliação confere (`private.member_rule_violations()`) |
| Tipo (b): nome, celular, identificador, líder obrigatório e nascimento | trigger `ad_`, comparando com o valor gravado | não: a carga não passa por elas (RN-18) |

### Escrita

#### Ordem dos triggers `BEFORE` de `members`
Os triggers `BEFORE` disparam em ordem alfabética, e o RLS de INSERT só é avaliado depois de todos eles (leitura técnica 1).

| Ordem | Trigger | Passo | O que faz | Recusa? |
|---|---|---|---|---|
| 1 | `a0_normalize_member` (**novo**, INVOKER) | E2.04 | Normaliza; devolve o valor gravado ao que não mudou (RN-17); resolve e deriva `has_leadership`; apaga a data do batismo ao desligar "Batizado(a)?" | nunca |
| 2 | `aa_enforce_member_write_rules` (INVOKER) | E1.03, E1.08, E2.02; **regra 1 nova** | **Regra 1 (nova):** INSERT por usuário logado sem `create_member` → 42501. Depois, as regras 2 a 6 de hoje: conta de acesso, colunas calculadas, função, próprio cadastro e dados sensíveis | permissão |
| 3 | `ab_enforce_member_links` (*definer*) | E2.01; **ajustado** | Líder e cônjuge excluídos (`deleted_member_chosen`). A recusa `deleted_account_email` sai daqui. | excluído |
| 4 | `ac_enforce_member_scope` (INVOKER) | E2.02; **ajustado** | RN-09 e RN-10 do E2.02. A condição de "sem liderança" passa a olhar `has_leadership` (DT-13). | escopo |
| 5 | `ad_enforce_member_rules` (**novo**, *definer*) | E2.04 | As regras deste spec, com as travas | regras |
| 6 | `compute_member_g12_level`, `update_members_updated_at` | atuais | sem mudança | — |

Os triggers `AFTER` (cônjuge, `zz_enforce_member_visible_after`, totais e Auditoria) não mudam.

#### `a0_normalize_member`
`BEFORE INSERT OR UPDATE OF name, email, mobile_whatsapp, cpf, is_pastor, has_leadership, leader_id, is_baptized, baptism_date`. `SECURITY INVOKER`: só lê `NEW` e `OLD` e chama funções imutáveis. Vale para qualquer papel.

```sql
CREATE OR REPLACE FUNCTION public.normalize_member_input()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE _ins boolean := TG_OP = 'INSERT';
BEGIN
  -- RN-17: "mudou" = diferente depois de lido pela regra. O que não mudou volta ao gravado,
  -- mesmo fora do formato. O que mudou é gravado já normalizado.
  IF _ins OR normalize_person_name(NEW.name) IS DISTINCT FROM normalize_person_name(OLD.name) THEN
    NEW.name := coalesce(normalize_person_name(NEW.name), '');          -- '' cai no name_invalid
  ELSE NEW.name := OLD.name; END IF;

  IF _ins OR normalize_email(NEW.email) IS DISTINCT FROM normalize_email(OLD.email) THEN
    NEW.email := normalize_email(NEW.email);
  ELSE NEW.email := OLD.email; END IF;

  -- Celular: a forma lida (RN-06); o ilegível fica só com dígitos, para o ad_ recusar.
  IF _ins OR coalesce(normalize_mobile(NEW.mobile_whatsapp), normalize_digits(NEW.mobile_whatsapp))
             IS DISTINCT FROM coalesce(normalize_mobile(OLD.mobile_whatsapp), normalize_digits(OLD.mobile_whatsapp)) THEN
    NEW.mobile_whatsapp := coalesce(normalize_mobile(NEW.mobile_whatsapp), normalize_digits(NEW.mobile_whatsapp));
  ELSE NEW.mobile_whatsapp := OLD.mobile_whatsapp; END IF;

  IF _ins OR normalize_digits(NEW.cpf) IS DISTINCT FROM normalize_digits(OLD.cpf) THEN
    NEW.cpf := normalize_digits(NEW.cpf);
  ELSE NEW.cpf := OLD.cpf; END IF;

  -- "Tem Liderança?" (RN-11, RN-12, DT-06). Omitido no cadastro: ligado, a não ser para o pastor.
  IF NEW.has_leadership IS NULL THEN
    NEW.has_leadership := CASE WHEN _ins THEN NOT coalesce(NEW.is_pastor, false) ELSE OLD.has_leadership END;
  END IF;
  IF NEW.leader_id IS NOT NULL THEN NEW.has_leadership := true; END IF;          -- DA-11 do E2.02
  -- Virou pastor e o líder saiu na mesma gravação: a chave herdada desliga (RN-12, "ou ligar
  -- É Pastor(a)?"). Ligada de propósito num pastor (OLD desligada) continua e é recusada.
  IF NOT _ins AND NEW.is_pastor AND NEW.leader_id IS NULL AND NEW.has_leadership AND OLD.has_leadership THEN
    NEW.has_leadership := false;
  END IF;

  -- Batismo (RN-16): desligar apaga a data que não foi mexida na mesma gravação.
  IF NOT _ins AND OLD.is_baptized AND NOT NEW.is_baptized
     AND NEW.baptism_date IS NOT DISTINCT FROM OLD.baptism_date THEN
    NEW.baptism_date := NULL;
  END IF;
  RETURN NEW;
END $$;
```
- **Texto vazio (DT-24).** Também converte em nulo o texto vazio ou só com espaços de `phone`, `instagram`, `avatar_url`, `notes` e dos campos de endereço, sem mexer no conteúdo preenchido; essas colunas entram no `UPDATE OF`. Em e-mail, celular e CPF, as funções de normalização já devolvem nulo para o vazio.
- Ele roda antes do `aa_`. Para quem não vê os dados sensíveis, a regra 6 do E1.08 devolve depois os valores gravados, e nada muda nesses campos.
- Ele não recusa nada, então quem não pode gravar não descobre nada por ele.

#### `ad_enforce_member_rules`
`BEFORE INSERT OR UPDATE OF name, gender, birth_date, email, mobile_whatsapp, cpf, spouse_id, is_pastor, has_leadership, leader_id, is_baptized, baptism_date, deleted_at`.
- `SECURITY DEFINER SET search_path = public`: a subida da árvore e a unicidade precisam enxergar cadastros fora do escopo de quem grava.
- Vale para todos os papéis, inclusive `postgres` e `service_role` (RN-01, DT-27 do E2.01). Só a carga em `replica` passa por fora.
- Os triggers de totais (`total_*`, `male_cells`, `female_cells`) não o disparam, porque essas colunas não estão na lista.

Ordem das conferências (DA-11). A primeira que falha levanta o erro, pelo `_del_raise`:

| # | Regra | Quando confere | Código e campo |
|---|---|---|---|
| 0 | Linha sendo excluída ou já excluída | `NEW.deleted_at IS NOT NULL`: só os `CHECK`s valem | — |
| 1 | RN-02 nome | INSERT ou nome mudou | `name_invalid` · `name` |
| 2 | RN-03 sexo | sempre | `gender_required` · `gender` |
| 3 | RN-15 nascimento | INSERT ou data mudou: `birth_date_problem(NEW.birth_date, sp_today())` | `birth_date_future` ou `birth_date_too_old` · `birth_date` |
| 4 | RN-06 celular | INSERT ou mudou, não nulo e `normalize_mobile` nulo | `mobile_invalid` · `mobile_whatsapp` |
| 5 | RN-05, RN-04 e-mail | INSERT ou mudou, não nulo: fictício antes de formato | `email_placeholder` ou `email_invalid` · `email` |
| 6 | RN-07 CPF | INSERT ou mudou, não nulo e inválido | `cpf_invalid` · `cpf` |
| 7 | RN-08 identificador | sem identificador real, no INSERT ou quando o gravado tinha | `identifier_required` · `identification` |
| 8 | RN-14 cônjuge | `spouse_id = id` | `spouse_self` · `spouse_id` |
| 9 | RN-11 pastor | INSERT ou mudou pastor, líder ou chave: pastor com líder ou com a chave ligada | `pastor_with_leader` · `is_pastor` |
| 10 | RN-11, RN-12 líder | idem: não pastor, chave ligada e sem líder | `leader_required` · `leader_id` (DA-2) |
| 11 | RN-13 si mesmo | `leader_id = id` | `leader_self` · `leader_id` |
| 12 | RN-13 ciclo | UPDATE em que o líder muda para alguém: trava da árvore e subida a partir do líder novo | `leader_cycle` · `leader_id` |
| 13 | RN-16 batismo | não batizado com data (depois da derivação do `a0_`) | `baptism_date_without_baptism` · `baptism_date` |
| 14 | RN-09, RN-10 dado em uso | INSERT, restauração ou identificador mudou: `_member_values_in_use` com os que mudaram (todos no INSERT e na restauração) | `value_in_use` · `fields` |
| 15 | RN-18 do E2.01 | INSERT ou e-mail mudou, e o e-mail é o de um excluído com conta (outro cadastro) (DA-4) | `deleted_account_email` · `email` |

Trecho do ciclo:
```sql
  IF TG_OP = 'UPDATE' AND NEW.leader_id IS NOT NULL AND NEW.leader_id IS DISTINCT FROM OLD.leader_id THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('members:leader-tree', 0));      -- DT-08
    -- Comando novo depois da trava: enxerga a troca que a outra transação acabou de gravar.
    IF EXISTS (
      WITH RECURSIVE up(id, leader_id, path) AS (
        SELECT m.id, m.leader_id, ARRAY[m.id] FROM members m WHERE m.id = NEW.leader_id
        UNION ALL
        SELECT l.id, l.leader_id, up.path || l.id
          FROM up JOIN members l ON l.id = up.leader_id
         WHERE NOT l.id = ANY (up.path))                 -- termina mesmo num ciclo antigo
      SELECT 1 FROM up WHERE up.id = NEW.id) THEN       -- passa por inativos e excluídos
      PERFORM _del_raise('leader_cycle',
        'O líder escolhido é discípulo desta pessoa (direto ou indireto). Escolha outro líder.',
        '{"field": "leader_id"}');
    END IF;
  END IF;
```
- O INSERT não pega a trava: um cadastro novo ainda não tem discípulos.
- A restauração (E2.01) não muda o líder para outra pessoa: devolve o mesmo, ou nulo. Ela não pega a trava.

#### Ajustes nos passos anteriores (migration 2)
| Função | Passo | Mudança | Motivo |
|---|---|---|---|
| `enforce_member_write_rules` (`aa_`) | E1.03, E2.02 | Regra 1 nova: `TG_OP = 'INSERT' AND auth.uid() IS NOT NULL AND NOT viewer_has('create_member')` → 42501 "Você não tem permissão para esta ação." | Leitura técnica 1 (DT-13) |
| `enforce_member_scope` (`ac_`) | E2.02 | Na condição de cadastrar ou deixar "sem liderança", entra `AND NOT NEW.has_leadership`. A chave ligada sem líder não é "sem liderança": é `leader_required`, do `ad_`. | Com a chave omitida, Pedro recebe "Escolha o líder.", e não a recusa da RN-10 do E2.02. Desligar a chave continua dando a recusa da RN-10 (critério da RN-12). |
| `enforce_member_links` (`ab_`) | E2.01 | Sai a recusa `deleted_account_email` no INSERT. Ela passa para o `ad_`, depois da unicidade. | RN-10 (unicidade antes) e leitura técnica 1 (o `ab_` roda antes do RLS) |
| `sync_spouse_relationship` | atual | A exceção em inglês vira `_del_raise('spouse_self', 'Uma pessoa não pode ser cônjuge de si mesma.', '{"field": "spouse_id"}')`. | RN-14. Pela ordem, o `ad_` recusa antes; fica como última barreira. |
| `check_member_insert` | E2.02 | Passa a gravar também `id` (o `attemptId`) e manda `has_leadership` como veio, nulo se ausente, sem `coalesce`. | DT-11 e DT-06 |

### Conta de acesso e `create-user-admin`

#### O e-mail da conta (DA-1, DT-01)
| | Antes | Depois |
|---|---|---|
| `members.email` | e-mail real, ou o fictício gerado no navegador (`<nome>_<hash>@mci12fakemail.com`) | só o e-mail real, ou nulo |
| e-mail da conta nova (`auth.users.email`) | o mesmo do cadastro | `member_account_email(id)`: `<id do membro>@<domínio fictício>` |
| id da conta nova | gerado pelo Auth | o `attemptId`, que também é o id do membro |
| troca ou remoção do e-mail no cadastro | a conta guardava o antigo, que ficava preso | a conta não muda, e o e-mail antigo fica livre na hora (P-VAL-10) |
| contas que já existem | — | ficam como estão. O e-mail delas não é usado para nada além de emitir a sessão |

- **Login (E1.04):** procura pelo cadastro e, achada a conta, emite a sessão com o e-mail da conta. Nada muda.
- **Redefinição e troca de senha (E2.03):** usam o id da conta. Nada muda.
- **Recuperação por e-mail (E1.07):** envia para `members.email`, e não para o e-mail da conta.
- **Carga (E4.08):** usa o mesmo par, `id` = id do membro e `member_account_email(id)`. Refeita, a carga encontra a conta pelo e-mail (`email_exists`) e só religa.

#### Fluxo da `create-user-admin`
Substitui a ordem do E2.02 (`#### create-user-admin` de lá), mantendo o que o E2.01 acrescentou:
1. **JWT** e quem chama, como hoje.
2. **Permissão:** `viewer_has('create_member')` com a sessão de quem chama. Sem ela, 403, antes de qualquer consulta (RN-19).
3. **Entrada:**
   - `attemptId` (UUID v4). Ausente, a função gera um, e o cadastro deixa de ser idempotente; inválido, 400 `invalid_request`;
   - `memberData` com a lista branca `MEMBER_FIELDS`. `id` e `auth_user_id` nunca vêm dela;
   - `password`, como hoje (a política é do E2.03);
   - `confirmDeletedMatches` (E2.01).

   O `email` do topo do corpo sai. O e-mail real, se houver, vem em `memberData.email`.
4. **Tentativa repetida (AQ-5):** se já existe um membro com `id = attemptId`:
   - visível na `members_view` de quem chama: 200, com `replayed: true`. Nada é gravado de novo. Pelo passo 8, esse cadastro sempre nasce com a conta ligada;
   - não visível: 409 `attempt_already_used` (DA-10).
5. **Ensaio:** `check_member_insert(memberData + id)`, com a sessão de quem chama. Ele confere todas as regras, na ordem da DA-11, inclusive `value_in_use` e `deleted_account_email`, sem gravar nada. Uma recusa vira a resposta (ver a tabela abaixo).
6. **Aviso de excluído (E2.01):** `find_deleted_member_matches`, depois do ensaio (RN-10). Com correspondências e sem `confirmDeletedMatches`, 409 `deleted_matches`.
7. **Conta:** `auth.admin.createUser({ id: attemptId, email: member_account_email(attemptId), password, email_confirm: true, user_metadata: { name } })`.
   - O e-mail vem da RPC `member_account_email`, com a *service role*.
   - `email_exists` com o mesmo e-mail técnico quer dizer que uma tentativa anterior criou a conta e o cadastro falhou. A função confere com `getUserById(attemptId)` e reaproveita a conta, sem desfazê-la no fim.
   - Se o supabase-js não aceitar `id` no `createUser`, a chamada vai direto para `POST /auth/v1/admin/users`, que aceita.
8. **Cadastro**, com a sessão de quem chama (RLS, triggers e autor na Auditoria): `insert({ ...memberRow, id: attemptId, auth_user_id: attemptId })`, sem `select`.
9. **Falha no passo 8:** `deleteUser` da conta criada **nesta** chamada, como hoje.
   - Se o erro for `23505` em `members_pkey`, outra chamada da mesma tentativa ganhou a corrida. A resposta é a do passo 4.
   - Se for outro `23505` (só fora dos triggers), o ensaio roda de novo e devolve `value_in_use` com todos os campos.
10. **Sucesso:** 200 `{ member: { id }, replayed: false }`.

Respostas (todas com `{ error, code, … }`; `error` é a mensagem pronta para a tela):

| Status | `code` | Quando | Campos a mais |
|---|---|---|---|
| 200 | — | criado ou tentativa repetida | `member: { id }`, `replayed` |
| 400 | `invalid_request` | corpo, `attemptId` ou `memberData` fora do formato | — |
| 400 | os `app_error` do banco | recusa de regra no ensaio ou no INSERT | `field` ou `fields` (o resto do `DETAIL` não vai, PR 2) |
| 400 | `weak_password` | o Auth recusou a senha (PR 2) | `field: "password"` |
| 401 | `unauthenticated` | sem JWT válido | — |
| 403 | `forbidden` | sem `create_member`, ou 42501 do banco | — |
| 409 | `value_in_use` | dado em uso | `fields` |
| 409 | `deleted_account_email` | e-mail da conta de um excluído | `field: "email"` e `matches` (E2.01 PR 5, aviso com "Restaurar"): a recusa vem do ensaio, e a função busca as correspondências antes de responder (PR 2) |
| 409 | `deleted_matches` | dado de excluído, sem confirmação (E2.01) | `matches` |
| 409 | `attempt_already_used` | DA-10 | — |
| 500 | `server_error` | Auth ou banco fora do ar; qualquer outra falha do Auth (PR 2: o e-mail e o id da conta são gerados pela função, a pessoa não tem o que corrigir) | — |

O código puro de tradução fica em `supabase/functions/create-user-admin/lib/errors.ts`, com testes em Vitest (como os do E2.01; não há Deno na máquina de desenvolvimento): `app_error` → `{ status, code, field, fields }`; o `23505` pelo nome do índice; nunca o `details` do Postgres.

### Seletor de líder com os discípulos (AQ-4)
```sql
-- Quais dos ids pedidos são discípulos (diretos ou indiretos, inclusive inativos) de _member_id.
-- Só responde sobre pessoas que quem chama vê. STABLE SECURITY DEFINER; EXECUTE para authenticated.
CREATE OR REPLACE FUNCTION public.member_descendants_among(_member_id uuid, _candidate_ids uuid[])
RETURNS SETOF uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT viewer_has('edit_member') THEN
    RAISE EXCEPTION 'Você não tem permissão para esta ação.' USING ERRCODE = '42501';
  END IF;
  IF cardinality(_candidate_ids) > 100 THEN
    PERFORM _del_raise('too_many_ids', 'No máximo 100 membros por consulta.');
  END IF;
  IF _member_id IS NULL OR NOT viewer_sees_member(_member_id) THEN RETURN; END IF;
  RETURN QUERY
  WITH RECURSIVE up(origin, id, leader_id, path) AS (
    SELECT m.id, m.id, m.leader_id, ARRAY[m.id] FROM members m
     WHERE m.id = ANY (_candidate_ids) AND m.id <> _member_id AND viewer_sees_member(m.id)
    UNION ALL
    SELECT up.origin, l.id, l.leader_id, up.path || l.id
      FROM up JOIN members l ON l.id = up.leader_id
     WHERE up.id <> _member_id AND NOT l.id = ANY (up.path))
  SELECT DISTINCT up.origin FROM up WHERE up.id = _member_id;
END $$;
```
- **Na tela:** o `queryFn` das opções de líder busca a página na `members_view`, como hoje, e logo depois chama a RPC com os ids da página, só quando o cadastro já existe. As opções saem juntas, com `isDisabled` e o motivo.
- **Custo:** uma subida por opção, de até cerca de 10 níveis, pela chave primária. São cerca de 200 leituras por página de 21 opções, com meta abaixo de 20 ms. A paginação não muda.
- **Falha da RPC:** a página aparece sem as marcas, e a recusa do ciclo vem ao salvar (padrão da UX).
- **Nada novo é revelado:** a RPC só responde sobre pessoas que quem chama vê (`viewer_sees_member`), e a ligação de líder de cada uma já está na lista de Membros (P-VAL-24).

### Formato dos erros (AQ-1)
É o formato do E2.01: 42501 só para permissão, e 22023 com `HINT = 'app_error'` e `DETAIL` em JSON (`{ code, field | fields, … }`) para as regras. O `parseAppError` do E2.01 lê os dois.

| `code` | Mensagem (`MESSAGE`) | Detalhes |
|---|---|---|
| `name_invalid` | Informe o nome e o sobrenome. | `field: "name"` |
| `gender_required` | Informe o sexo. | `field: "gender"` |
| `birth_date_future` | A data de nascimento não pode ser futura. | `field: "birth_date"` |
| `birth_date_too_old` | Confira a data de nascimento: a pessoa teria 100 anos ou mais. | `field: "birth_date"` |
| `mobile_invalid` | Celular inválido. Informe o DDD e o número. | `field: "mobile_whatsapp"` |
| `email_placeholder` | Este e-mail não pode ser usado. Informe um e-mail real ou deixe o campo em branco. | `field: "email"` |
| `email_invalid` | E-mail inválido. Confira o endereço digitado. | `field: "email"` |
| `cpf_invalid` | CPF inválido. Se a pessoa não tem CPF, deixe o campo em branco. | `field: "cpf"` |
| `identifier_required` | Informe o e-mail, o celular ou o CPF. A pessoa usa um deles para entrar no sistema. | `field: "identification"`, `fields: ["mobile_whatsapp", "email", "cpf"]` |
| `spouse_self` | Uma pessoa não pode ser cônjuge de si mesma. | `field: "spouse_id"` |
| `pastor_with_leader` | Pastor(a) não tem líder. Tire o líder ou desmarque "É Pastor(a)?". | `field: "is_pastor"` |
| `leader_required` | Escolha o líder. (DA-2) | `field: "leader_id"` |
| `leader_self` | Uma pessoa não pode ser líder de si mesma. | `field: "leader_id"` |
| `leader_cycle` | O líder escolhido é discípulo desta pessoa (direto ou indireto). Escolha outro líder. | `field: "leader_id"` |
| `baptism_date_without_baptism` | A data do batismo só pode ser informada para quem é batizado(a). | `field: "baptism_date"` |
| `value_in_use` | O texto do primeiro campo: "Este e-mail já está sendo usado por outro cadastro." (ou celular, ou CPF) | `fields`: subconjunto ordenado de `email`, `mobile` e `cpf`, o mesmo vocabulário de `restore_value_in_use` (E2.01). Nada do outro cadastro. |
| `deleted_account_email` (E2.01) | Este e-mail pertence a um cadastro excluído. Peça a um administrador para restaurá-lo ou use outro e-mail. | `field: "email"` (novo) |
| `attempt_already_used` (só a função) | *Este cadastro já foi enviado. Confira na lista de Membros.* | — |
| `too_many_ids` (só a RPC) | *No máximo 100 membros por consulta.* | — |

- A tela mapeia `field` e `fields` para os campos dela num módulo só (`src/lib/members/codes.ts`): `mobile` e `mobile_whatsapp` vão para o Celular, e `identification` vai para o grupo Identificação.
- **Reservas:**
  - `23505` vindo do PostgREST: o nome do índice no `message` dá o campo (`members_email_key` → `email`);
  - `23514`: o nome do `CHECK` dá o campo;
  - sem nada disso, o texto vai para o `Alert` do topo.

  Nenhuma das reservas mostra o texto técnico (UX-30).

### Bloqueios e concorrência
**Ordem de aquisição, igual em todos os caminhos:**
1. a linha do membro (o próprio UPDATE);
2. as travas de linha do E2.01 (`FOR KEY SHARE` no líder e no cônjuge, `FOR UPDATE` nas RPCs de exclusão);
3. a trava `admin-members` do E2.02 (no `aa_`, ao tirar a função Administrador);
4. a trava da árvore (`members:leader-tree`), só na troca de líder;
5. as travas de identificador (`member-identifier:<campo>:<valor>`), em ordem alfabética da chave.

O `aa_` roda antes do `ad_`, e o `ad_` pega a árvore antes dos identificadores, então a ordem vale em qualquer gravação de um membro. A `restore_member` pega os identificadores sem a árvore, porque não troca o líder por outra pessoa. As travas consultivas duram até o fim da transação.

Os casos dos critérios:
- **Duas pessoas com o mesmo CPF ao mesmo tempo (RN-09):**
  - os dois triggers pedem a trava `member-identifier:cpf:<cpf>`;
  - o segundo espera e, depois do *commit* do primeiro, encontra o CPF e recusa com `value_in_use`;
  - pela `create-user-admin`, a conta da segunda é desfeita no passo 9. O índice único cobre qualquer caminho sem trava.
- **Lúcia → Paulo e Paulo → Lúcia ao mesmo tempo (RN-13):**
  - as duas trocas pedem a trava da árvore;
  - a segunda espera, sobe a partir de Lúcia, encontra Paulo (já gravado como discípulo dela) e recusa com `leader_cycle`;
  - **na implementação (DT-25),** quando as duas trocas são simultâneas, a segunda costuma terminar em 40P01, e não em `leader_cycle`: cada UPDATE já tem a própria linha travada antes da árvore, e o recálculo dos totais da primeira precisa da linha da segunda. O ciclo nunca nasce; a nova tentativa recebe `leader_cycle`.
- **Caio troca o e-mail enquanto Rita cadastra Lúcia com o e-mail antigo (P-VAL-10):**
  - os dois pegam travas de chaves diferentes (o e-mail novo e o antigo);
  - o cadastro de Lúcia é aceito se a troca de Caio terminou antes. Senão, o índice recusa no *commit*, e a função devolve `value_in_use`.
- **Restaurar Bruno enquanto Lúcia é cadastrada com o mesmo celular (9º dígito):** a `restore_member` e o trigger pegam a mesma trava, e o segundo recusa com a mensagem dele (`restore_value_in_use` ou `value_in_use`).

Casos aceitos com *deadlock* detectado (40P01, "tente de novo"), raros:
- uma gravação de várias linhas que pega travas de identificador em ordens diferentes;
- duas trocas de líder cruzadas ao mesmo tempo (DT-25);
- os casos do risco 3 do E2.01.

### Contratos
**Colunas:** nenhuma nova.
- `members.gender` passa a `NOT NULL`.
- `members.has_leadership` perde o default. Omitida no cadastro, é resolvida pelo banco (DT-06). No `types.ts`, ela passa a ser obrigatória no `Insert`.

**Constraints e índices:** `members_email_check`, `members_email_not_placeholder_check`, `members_cpf_check`, `members_leadership_check`, `members_leader_not_self_check`, `members_spouse_not_self_check`, `members_baptism_check`, `members_email_key`, `members_mobile_key` e `members_cpf_key`.

**Funções públicas novas:**

| Função | Grants | Para quê |
|---|---|---|
| `placeholder_email_domains()`, `placeholder_email_domain()` | `authenticated`, `service_role` | lista única dos domínios fictícios e o de geração |
| `is_valid_email(text)`, `normalize_person_name(text)`, `is_valid_person_name(text)`, `member_has_login_identifier(text, text, text)`, `birth_date_problem(date, date)` | `authenticated`, `service_role` | regras usadas em `CHECK`s, triggers e testes |
| `member_account_email(uuid)` | `service_role` | e-mail técnico da conta (DA-1) |
| `member_descendants_among(uuid, uuid[]) RETURNS SETOF uuid` | `authenticated` | discípulos no seletor de líder (AQ-4) |
| `is_placeholder_email(text)` (E1.04, reescrita) | sem mudança | mesma regra, lendo a lista |

**Funções internas novas:** `_member_values_in_use` (*definer*, sem EXECUTE para `authenticated`), `private.member_rule_violations()` (sem grants), `normalize_member_input()` e `enforce_member_rules()` (funções de trigger).

**Views:** nenhuma muda. A `members_view` devolve `email` nulo para quem não tem e-mail real, porque o cadastro não guarda mais o fictício (AQ-6).

**Edge Function `create-user-admin`:**
```text
POST /functions/v1/create-user-admin
Authorization: Bearer <JWT de quem cadastra>
{ "attemptId": "<uuid v4, gerado ao abrir o formulário>",
  "password": "…",
  "memberData": { "name": "…", "gender": "F", "mobile_whatsapp": "…", "email": "…" | null, … },
  "confirmDeletedMatches": false }
```
As respostas estão em [Fluxo da `create-user-admin`](#fluxo-da-create-user-admin).

**Tabela de casos:** `supabase/tests/fixtures/member-validation-cases.json` (DT-17), ao lado da `login-identifier-cases.json` do E1.04.

### Front
Segue o padrão do E1.08, do E2.01 e do E2.02: os componentes cuidam da tela, o acesso a dados fica nos hooks e a regra pura fica em `src/lib/`.

**PR 2, ajuste mínimo** (vai ao ar junto com o banco):
- O `MemberForm` deixa de montar o e-mail fictício (sai `FAKE_EMAIL_DOMAIN`).
- O cadastro chama a `create-user-admin` com `{ attemptId, password, memberData }`. O `attemptId` é gerado ao abrir o formulário (`crypto.randomUUID()`) e reaproveitado em cada nova tentativa.
- Apagar o e-mail na edição envia `null`.
- A mensagem do servidor vem do `parseAppError` e continua no toast até o PR 3.
- `Members.tsx` deixa de filtrar o domínio fictício.

**PR 3, o formulário da UX:**
- **Domínio puro, com Vitest e sem React nem Supabase:**
  - `src/lib/members/identifiers.ts`: `normalizeEmail`, `isValidEmail`, `isPlaceholderEmail`, `PLACEHOLDER_EMAIL_DOMAINS`, `normalizeMobile`, `mobileMatchKey`, `formatMobile`, `normalizeCpf`, `isValidCpf`, `formatCpf` e `hasLoginIdentifier`. O `src/lib/auth/identifier.ts` do E1.04 passa a importar daqui, sem duplicar.
  - `src/lib/members/name.ts`: `normalizePersonName` e `isValidPersonName` (`\p{L}`, DA-12).
  - `src/lib/dates/sao-paulo.ts`: `spToday(now)` e `subtractYears` com a regra do 29/02 (DA-13).
  - `src/lib/members/birth-date.ts`: `birthDateBounds(today)`, `birthDateProblem(date, today)` e `ageLabel(date, today)`.
  - `src/lib/members/validation.ts`:
    - `validateMemberForm(values, context)` devolve todos os erros de uma vez (RN-02 a RN-08, RN-12, RN-15);
    - `validateOnBlur(field, value, context)` confere só o formato do campo (P-VAL-19);
    - `legacyWarnings(stored, visibility)` devolve os avisos da T6.
  - `src/lib/members/changes.ts`: `changedMemberFields(stored, values, options)` monta o PATCH só com o que mudou, comparando pela leitura de cada regra (DT-19).
  - `src/lib/members/leadership.ts`: as transições dos três interruptores (P20), com a memória do valor que sai e os avisos.
  - `src/lib/members/codes.ts` (códigos e campos do servidor) e `src/lib/members/texts.ts` (**todos** os textos deste spec).
  - `src/lib/masks.ts`: máscaras de celular e CPF que não cortam dígitos e preservam o cursor (P23).
- **Hooks:**
  - `src/hooks/use-member-save.ts`: cria pela `create-user-admin`, com o `attemptId`, e edita com `.update(patch).eq('id', id).select('id')`. Traduz as recusas para os campos e trata o "0 linhas" do E2.01;
  - `use-member-options.ts` ganha `descendantOf?: string`, que chama `member_descendants_among` no mesmo `queryFn`.
- **Componentes:**
  - o `MemberForm` passa a usar react-hook-form, com um *resolver* próprio sobre `validateMemberForm`, e é quebrado em `src/components/members/`:
    - `MemberFormDialog` (P1, rodapé com o resumo e o descartar);
    - `MemberPersonalSection`;
    - `MemberIdentificationFieldset`;
    - `MemberMinistrySection`;
  - `FieldMessages` (P21) e `FormErrorSummary` (P22);
  - o `PaginatedSelect` aceita opção desabilitada com o motivo (P5), se o E2.02 ainda não tiver feito.

### Onde cada regra é imposta
| RN | Banco (constraint, RLS, trigger, RPC) | UI |
|---|---|---|
| RN-01 | `CHECK`s e índices valem para qualquer caminho, inclusive `replica`; `a0_` e `ad_` sem exceção de papel; `create_member` no `aa_` antes das regras; `private.member_rule_violations()` na reconciliação | — |
| RN-02 | `a0_` normaliza; `ad_` (`name_invalid`) quando muda | Mesma regra ao sair do campo e ao salvar; aviso de dado antigo |
| RN-03 | `NOT NULL` + `members_gender_check`; `ad_` (`gender_required`) | `RadioGroup` sem padrão |
| RN-04 | `members_email_check`; `a0_` normaliza; `ad_` (`email_invalid`) | Mesma regra ao sair do campo |
| RN-05 | `members_email_not_placeholder_check`; `ad_` (`email_placeholder`); conta com e-mail técnico (DA-1) | Recusa ao sair do campo; nunca monta o fictício |
| RN-06 | `a0_` grava a forma lida; `ad_` (`mobile_invalid`) quando muda | Máscara sem corte; forma lida ao sair do campo |
| RN-07 | `members_cpf_check`; `a0_` (dígitos); `ad_` (`cpf_invalid`) | Mesma regra; máscara sem corte |
| RN-08 | `ad_` (`identifier_required`) no INSERT e quando a edição tira o último | Erro no grupo Identificação; aviso no cadastro antigo |
| RN-09 | `members_email_key`, `members_mobile_key`, `members_cpf_key`; `_member_values_in_use` sob trava; `restore_member` e `find_deleted_member_matches` com a mesma chave | — (só o servidor, ao salvar) |
| RN-10 | `value_in_use` com `fields`, sem dado do outro cadastro; `create_member` antes (`aa_`); ensaio antes do aviso de excluído na `create-user-admin` | Mensagem por campo |
| RN-11 | `members_leadership_check`; `a0_` deriva a chave; `ad_` (`pastor_with_leader`, `leader_required`); RN-10 do E2.02 no `ac_` | Interruptores (P20, UXD-8) |
| RN-12 | `has_leadership` sem default, resolvido no `a0_`; `ad_` (`leader_required`) | "Tem Liderança?" ligado no cadastro novo; mensagem por persona (DA-2) |
| RN-13 | `members_leader_not_self_check`; `ad_` (`leader_self`, `leader_cycle`) sob a trava da árvore; `member_descendants_among` | Seletor sem a pessoa e com os discípulos desabilitados |
| RN-14 | `members_spouse_not_self_check`; `ad_` e `sync_spouse_relationship` (`spouse_self`) | Seletor sem a pessoa |
| RN-15 | `ad_` com `birth_date_problem(…, sp_today())` quando muda | `min`/`max` e idade pelo "hoje" de Brasília |
| RN-16 | `members_baptism_check`; `a0_` apaga a data ao desligar; `ad_` (`baptism_date_without_baptism`) | Aviso P20 e envio da data vazia |
| RN-17 | `a0_` devolve o gravado ao que não mudou; `ad_` confere só o que mudou | PATCH só com o que mudou; avisos que não impedem salvar |
| RN-18 | `CHECK`s e índices antes da carga; `private.member_rule_violations()` | — |
| RN-19 | Ordem dos triggers e das conferências (DA-11); `create_member` no `aa_`; `deleted_account_email` depois da unicidade | Erros juntos ao salvar; formato ao sair do campo; recusas do servidor no campo |

### Respostas às perguntas do UX (AQ-1 a AQ-6)
| # | Resposta |
|---|---|
| AQ-1 | **Sim.** Todos os códigos pedidos, com `field` (ou `fields` em `value_in_use` e `identifier_required`), no formato `app_error`. A `create-user-admin` devolve `{ error, code, field, fields }` ([Formato dos erros](#formato-dos-erros-aq-1)). O `23505` e o `23514` só aparecem fora dos triggers e têm reserva por nome. |
| AQ-2 | **Sim.** `member-validation-cases.json` (nome, e-mail, domínios fictícios, nascimento com "hoje" fixo, idade, celular e CPF ao sair do campo) e a `login-identifier-cases.json` do E1.04 para a leitura do celular e do CPF. O SQL do pgTAP é gerado a partir do JSON, e um Vitest falha se a cópia ficar desatualizada. A lista de domínios está no JSON: o pgTAP compara com `placeholder_email_domains()`, e o Vitest, com `PLACEHOLDER_EMAIL_DOMAINS`. |
| AQ-3 | **Sim.** O PATCH leva só os campos alterados, lidos pela regra (DT-19). Convive com o E1.08 e o E2.02: um campo sensível que não vai no PATCH não muda; a chave "Tem Liderança?" é derivada pelo banco e só vai quando quem vê a igreja toda a mexe; as pessoas mantidas não são conferidas de novo. O banco também compara pela regra (DT-05), então um cliente que manda tudo continua certo. Sem nenhuma mudança, a tela não chama o servidor (DA-9). |
| AQ-4 | **Sim.** `member_descendants_among(_member_id, _candidate_ids)`, chamada logo depois da página, no mesmo `queryFn` ([Seletor de líder](#seletor-de-líder-com-os-discípulos-aq-4)). |
| AQ-5 | **Sim.** `attemptId` gerado ao abrir o formulário. Repetido, a função devolve o mesmo cadastro com `replayed: true`. A frase de reserva da AQ-5 não é necessária. |
| AQ-6 | (a) **Sim:** o formulário envia o e-mail vazio, e a função cria a conta com o e-mail técnico. (b) **Nulo, sem coluna nova:** o cadastro não guarda mais o fictício (DA-7). (c) **Sim:** a tela envia `null`, e o banco grava nulo, desde que sobre um identificador (RN-08). |

### Decisões técnicas
| # | Decisão | Motivo |
|---|---|---|
| DT-01 | A conta de acesso usa sempre o e-mail técnico `member_account_email(id)`, e o id da conta é o do membro. O cadastro guarda só o e-mail real. | DA-1: P-VAL-10, RN-05 e o ponto 8 sem sincronizar cadastro e Auth |
| DT-02 | Regras do tipo (a) como `CHECK`, `NOT NULL` e índice único. O ciclo é a única no trigger, e a reconciliação o confere com `private.member_rule_violations()`. | Ponto 1 do PO: as constraints valem em `replica` |
| DT-03 | Três índices únicos parciais sobre `normalize_email`, `mobile_match_key` e `normalize_digits`. Os índices de busca do E1.04 ficam. | RN-09, DEL-04 e o 9º dígito; o segundo estágio da `sign-in` precisa dos excluídos |
| DT-04 | Dois triggers: `a0_normalize_member` (normaliza e deriva, nunca recusa, INVOKER) e `ad_enforce_member_rules` (recusa, *definer*, sem exceção de papel), cada um com a lista de colunas no `UPDATE OF`. | RN-19: as recusas depois de permissão, excluído e escopo; a derivação antes de tudo. Os triggers de totais não os disparam. |
| DT-05 | "Mudou" é decidido pelo valor lido pela regra; o que não mudou volta ao valor gravado. | RN-17 e ponto 6 |
| DT-06 | `has_leadership` sem default. O `a0_` resolve o nulo (ligado, ou desligado para pastor), liga com líder e desliga a chave herdada de quem vira pastor sem líder. | P-VAL-12 e ponto 7 do PO, distinguindo "omitido" de "ligado de propósito" |
| DT-07 | Unicidade: pré-checagem sob trava consultiva por valor, em ordem, citando todos os campos. O índice é a garantia, e o `23505` é traduzido. | RN-10 ("cita todos") também numa corrida |
| DT-08 | Ciclo: subida a partir do líder novo, sem limite de profundidade e passando por inativos e excluídos, sob uma trava consultiva única da árvore em toda troca de líder. | RN-13 com trocas simultâneas e a mensagem amigável. As trocas de líder são raras. |
| DT-09 | Ordem de aquisição: linha → travas do E2.01 → `admin-members` → árvore → identificadores. | Sem espera circular entre os caminhos deste passo e dos anteriores |
| DT-10 | Formato `app_error` do E2.01, com `field` e `fields`, inclusive na `create-user-admin`. | AQ-1 |
| DT-11 | `create-user-admin` idempotente pelo `attemptId`, que é o id do membro e o da conta. Ordem: permissão → entrada → repetição → ensaio → aviso de excluído → conta → cadastro → desfazimento. | AQ-5, RN-10 e RN-19 sem conta órfã |
| DT-12 | `check_member_insert` recebe `id` e não preenche `has_leadership`. | O ensaio igual ao INSERT real |
| DT-13 | O `aa_` recusa com 42501 o INSERT sem `create_member`. | Leitura técnica 1: o RLS de INSERT roda depois dos triggers |
| DT-14 | `deleted_account_email` sai do `ab_` (E2.01) e vai para o fim do `ad_`, também na troca de e-mail. `restore_member` e `find_deleted_member_matches` usam a chave do 9º dígito. | RN-10, DA-4 e ponto 3 do PO |
| DT-15 | `spouse_self` em pt-BR no trigger de cônjuge, com `CHECK` de reserva. | RN-14 |
| DT-16 | `member_descendants_among` com subida por id, só sobre pessoas visíveis, chamada logo depois da página do seletor. | AQ-4 sem mudar a consulta paginada |
| DT-17 | Tabela de casos em JSON para o Vitest e o pgTAP, com o SQL gerado e a conferência de sincronia, como no E1.04. | AQ-2, ponto 3 |
| DT-18 | Lista de domínios fictícios em `placeholder_email_domains()`, espelhada no front pela tabela de casos. | AQ-2; o E1.06 troca num lugar só |
| DT-19 | O PATCH leva só o que mudou, e sem mudança nada é enviado. | AQ-3, RN-17 |
| DT-20 | "Letra" é `[[:alpha:]]` no banco e `\p{L}` na tela, com uma guarda na migration 1. | DA-12 |
| DT-21 | Migration 2: correções sem perda, depois uma guarda que para com a lista de ids das violações do tipo (a) que pedem decisão. | Ponto 2 e DA-8; nada de dado pessoal nos logs |
| DT-22 | Três PRs: (1) banco neutro; (2) regras no banco, `create-user-admin` e ajuste mínimo do front, publicados juntos; (3) o formulário da UX. | Cada PR vai ao ar sozinho; a janela do PR 2 é de minutos |
| DT-23 | As massas dos pgTAP existentes passam a seguir as regras, no PR 2. | RN-01 vale para o `postgres` |
| DT-24 | Texto vazio ou só com espaços é gravado como nulo em todo campo de texto opcional de `members`: a migration 2 corrige o que existe (antes da guarda) e o `a0_` impede que volte. Sem `CHECK` nos campos livres: a carga (E4) grava nulo na transformação. | `''` e nulo dizem o mesmo (DA-8), mas o `''` no CPF viola o `members_cpf_check`; achado na conferência pós-PR 1 |
| DT-25 | Troca de líder cruzada e simultânea pode terminar em 40P01 ("tente de novo"), sem trava da árvore antes da linha. A tela trata 40P01 como falha técnica com nova tentativa (PR 3). | Um trigger por comando que pegasse a árvore antes da linha serializaria todo PATCH com `leader_id` (o front atual manda o formulário inteiro até o PR 3) e criaria outro 40P01 com a `restore_member`. O caso é raro e nunca cria ciclo. Achado do PR 2 |

### Riscos (concorrência, escala, segurança)
1. **Janela do PR 2.** Entre o "Deploy: banco" e o promote, o front antigo monta o e-mail fictício no navegador, e o banco recusa (`email_placeholder`). O cadastro de quem não tem e-mail fica indisponível por minutos, com a mensagem no toast. A edição continua.
   - Mitigação: promote logo em seguida.
2. **E1.04 precisa estar inteiro em produção.**
   - A conta nova tem o e-mail técnico, e a publicação apaga o fictício do cadastro. O login antigo (`get-user-email` + `signInWithPassword` com o e-mail do cadastro) deixaria de funcionar para essas pessoas.
   - Mitigação: a migration 1 confere as funções do E1.04, e a [Implantação](#implantação) exige o PR 3 do E1.04 antes do PR 2 daqui.
3. **Domínio fictício de terceiros até o E1.06.** Todas as contas novas ficam em `mci12fakemail.com`. Nada é enviado para elas: o provedor de e-mail está desligado (E1.04), e o `createUser` e o `generateLink` não enviam e-mail. O E1.06 troca o domínio de geração e decide se migra as contas antigas.
4. **`id` próprio na criação da conta.** Se o Auth deixar de aceitar ou ignorar o `id`, a função falha fechada (PR 2): desfaz a conta criada e responde 500, sem caminho alternativo. A primeira conta criada em produção depois do deploy confirma (conferência pós-deploy).
   - Numa corrida da mesma tentativa, a chamada que criou a conta pode cair numa regra e desfazê-la enquanto a outra a reaproveita; a outra recebe um 400 genérico. Raro: o duplo clique já cai na tentativa repetida.
5. **Conta órfã.** Só sobra se o `deleteUser` do desfazimento falhar. Ela tem e-mail técnico e nenhum cadastro, então a `sign-in` nunca chega a ela. Uma nova tentativa com o mesmo `attemptId` a reaproveita. A reconciliação lista as órfãs.
6. **Serialização das trocas de líder.** A trava da árvore é única e dura até o *commit*, que inclui o recálculo dos totais (até cerca de 1 s no volume de referência). Trocas de líder simultâneas ficam em fila. Com o volume da igreja (poucas por minuto), é aceitável. O E2.06 pode trocar a subida pelo caminho materializado sem mudar o contrato.
7. **Isolamento.** As pré-checagens contam com `READ COMMITTED`. Um script em `REPEATABLE READ` que troque líderes em paralelo pode criar um ciclo; a unicidade continua garantida pelos índices.
8. **`CHECK` com função.** Mudar `placeholder_email_domains()` ou as regras não revalida as linhas antigas. Toda mudança de regra precisa de uma migration que confira os dados antes (`private.member_rule_violations()`).
9. **Collation.** A regra do nome depende de `[[:alpha:]]` reconhecer acentos. A guarda da migration 1 para a publicação se o banco de produção classificar diferente da stack local.
10. **Massas de teste e scripts.** Toda gravação em `members` passa pelas regras, inclusive pgTAP, seeds e o gerador de volume do E1.08. As massas que não seguem as regras quebram no PR 2 (tarefa 4). As massas em `replica` continuam valendo para os `CHECK`s e os índices.
11. **Volume.**
    - Medir no volume de referência do E1.08 (20 mil membros, profundidade de até 10).
    - Metas:
      - PATCH de membro abaixo de 20 ms (a mesma do E2.02);
      - cadastro pela `create-user-admin` abaixo de 800 ms;
      - `member_descendants_among` com 21 ids abaixo de 20 ms;
      - página do seletor de líder, com as marcas, abaixo de 300 ms.
    - Os triggers novos custam algumas comparações por linha. As consultas de unicidade usam os índices únicos, e a subida usa a chave primária.
12. **Descoberta de dados em uso.** Quem pode cadastrar descobre se um e-mail, celular ou CPF está em uso, mas nunca de quem é (Fora de escopo do Negócio). Depois da DT-13, quem não pode cadastrar não descobre nada.
13. **E-mail com caracteres fora do ASCII.** A RN-04 aceita, por exemplo, "joão@exemplo.com". O SMTP da recuperação (E1.07) pode não entregar. O E1.07 avalia.
14. **Contas antigas com e-mail real.** Ficam com o e-mail de criação, que pode passar a ser de outra pessoa no cadastro. Isso não tem efeito, porque o login e a recuperação leem o cadastro. O painel do Supabase mostra esses e-mails, e os técnicos nas contas novas.

### Dependências e impactos em outros passos
| Passo | Relação |
|---|---|
| E1.04 | **Pré-requisito, inteiro em produção** (PR 3, sem a `get-user-email`). O E2.04 reaproveita `normalize_mobile`, `mobile_match_key`, `is_valid_cpf` e `is_placeholder_email`, que passa a ler `placeholder_email_domains()`, e a tabela de casos `login-identifier-cases.json`. Depois dos índices únicos, a ambiguidade da RN-05 do E1.04 só acontece quando o CPF de um cadastro é igual ao celular de outro. |
| E2.01 | **Pré-requisito, inteiro.** Muda `restore_member` (e), `find_deleted_member_matches` e `enforce_member_links` (DT-14). A unicidade vem antes do aviso de excluído. |
| E2.02 | **Pré-requisito: o PR 1 antes do PR 1 daqui, e a T6 do front antes do PR 3 daqui.** Muda `enforce_member_write_rules` (regra 1), `enforce_member_scope` (condição de "sem liderança") e `check_member_insert` (`id` e chave nula). A UX-18 do E2.02 é substituída pelas UX-15 a UX-18 daqui. |
| E2.03 | Os dois mexem na `create-user-admin` (a política de senha é de lá) e no `MemberForm` (o campo de senha é de lá). Quem vier depois faz o *rebase*. O contrato de erro é o mesmo (`{ error, code, field }`). |
| E1.06 | Acrescenta o domínio novo em `placeholder_email_domains()`, troca `placeholder_email_domain()`, a tabela de casos e a constante do front, e confere antes que nenhum cadastro tem e-mail nesse domínio (risco 8). Decide se migra as contas antigas para o domínio novo. |
| E1.07 | A recuperação por e-mail envia para `members.email`, que é sempre real. Ela não vale para quem não tem e-mail no cadastro. |
| E2.06 | A HIE-01 sai de lá e fica aqui. As funções de totais podem deixar de aceitar "Masculino" e "Feminino". O caminho materializado pode substituir a subida do ciclo e a do seletor, desde que seja atualizado na mesma transação da troca de líder. |
| E2.07 | O filtro "possui liderança" usa as três situações da RN-11, garantidas por `members_leadership_check`. |
| E4.04, E4.05, E4.06 | A transformação entrega dados que passam nos `CHECK`s e nos índices, inclusive nos excluídos (DA-6): e-mail normalizado ou nulo (nunca o fictício), CPF válido ou nulo, sexo M ou F, liderança pela 5.5, batismo coerente e cônjuge de si mesmo desfeito. O saneamento usa as mesmas funções. |
| E4.08 | Conta com `id` = id do membro e `member_account_email(id)`. Recebe conta também quem só tem CPF (D5). |
| E4.09 | A reconciliação roda `private.member_rule_violations()` e exige zero linhas. |
| Consolidação | Decide se o consolidado entra na unicidade e no identificador obrigatório. Se não entrar, os índices e o `ad_` ganham o predicado da flag. |

**Mudanças nos documentos, no aceite** (o `product-owner` atualiza a matriz, a seção 3 e o Progresso; o `architect` atualiza o resto do `CLAUDE.md` na revisão final):
- **`CLAUDE.md`:**
  - **Matriz de paridade:** "Validações de membro…" em ✅.
  - **Schema efetivo:** `gender` obrigatório; `has_leadership` sem default; os `CHECK`s; os índices únicos.
  - **Lógica no banco:** os triggers `a0_normalize_member` e `ad_enforce_member_rules`, os ciclos e a unicidade sob trava, `member_descendants_among`, `member_account_email` e `private.member_rule_violations()`.
  - **Edge Functions:** o contrato novo da `create-user-admin` (`attemptId`, idempotente, conta com e-mail técnico).
  - **Front:** a frase "Membro sem e-mail recebe um e-mail fictício `<nome>_<hash>@mci12fakemail.com`…" vira "Toda conta nova usa o e-mail técnico `<id>@<domínio fictício>`; o cadastro guarda só o e-mail real".
  - **Armadilhas:**
    - o item de `gender` ('M'/'F' e "Masculino"/"Feminino") fica resolvido no cadastro; as funções de totais mudam no E2.06;
    - um item novo: "toda gravação em `members` passa pelas regras do E2.04, inclusive a *service role* e os pgTAP; as massas precisam de nome com sobrenome, sexo, um identificador e a situação de liderança coerente".
- **`docs/migracao.md`:**
  - **3.2:** MEM-01 a MEM-09 em ✅. A coluna "Onde impor" segue a tabela [Onde cada regra é imposta](#onde-cada-regra-é-imposta): MEM-08 fica no trigger, e não em `CHECK`, porque o limite anda com o tempo; MEM-03 usa `normalize_email` e `mobile_match_key`.
  - **3.3:** HIE-01 em ✅, "feita no E2.04".
  - **Progresso:** a linha do E2.04 ganha "e HIE-01". A linha do E2.06 passa a "HIE-02 a HIE-04".
  - **5.3:** a lista de `CHECK`s e índices únicos deste spec, com a nota de que o ciclo é conferido na reconciliação.
  - **5.4:** as linhas novas da tabela [Dados do legado](#dados-do-legado). O CPF inválido também é esvaziado nos excluídos.
  - **5.5:**
    - `Email`: inválido, vazio ou fictício vira nulo, e a conta usa o e-mail técnico (6.2);
    - `MobileNumber`: a forma lida da RN-06 quando legível; senão, só dígitos;
    - o "Tem Liderança?" explícito nas três situações;
    - os `CHECK`s valem também para os excluídos.
  - **5.6:** a reconciliação roda `private.member_rule_violations()`.
  - **6.1:** "Membro sem e-mail" passa a "toda conta: e-mail técnico".
  - **6.2:**
    - "E-mail da conta": sempre `member_account_email(id)`, com `id` = id do membro. Sai "o mesmo valor vai para `members.email`";
    - "Quem recebe conta" inclui quem só tem CPF.
  - **Seção 2, item do D7:** o E1.06 troca `placeholder_email_domain()` e acrescenta o domínio em `placeholder_email_domains()`.

### Pontos de extensão
| Futuro | Onde muda |
|---|---|
| Domínio da D7 (E1.06) | `placeholder_email_domains()`, `placeholder_email_domain()`, a tabela de casos e a constante do front |
| Consolidação | Predicado da flag nos índices únicos e nas regras do `ad_` |
| Caminho materializado (E2.06) | A subida do ciclo e a de `member_descendants_among`, com o mesmo contrato |
| Validações de célula e relatório (E2.08, E2.11) | O mesmo molde: funções de regra imutáveis, `CHECK`s para o tipo (a), um trigger de normalização e um de regras, `app_error` com `field` e tabela de casos |
| Política de senha (E2.03) | Uma etapa a mais no fluxo da `create-user-admin`, antes da conta, com o campo `password` |

### Implantação
| PR | Ordem | Efeito no front em produção |
|---|---|---|
| 1 (banco neutro) | merge → "Deploy: banco" (migration 1) | Nenhum. O front antigo recebe `23505` num dado repetido e já mostra "Já existe um membro com este e-mail, CPF ou celular.". |
| 2 (regras e cadastro) | **depois do PR 3 do E1.04 em produção**; merge → "Deploy: banco" (migration 2 e a `create-user-admin`) → **promote em seguida** | Entre os dois passos, ver o risco 1. Depois do promote, as regras valem, e as recusas aparecem no toast. |
| 3 (formulário) | merge → promote | A tela da UX. |

- O promote já recusa rodar com migration pendente.
- Antes do "Deploy: banco" do PR 1 e do PR 2, o usuário roda a [conferência](#conferência-em-produção-tarefa-1) e corrige o que for "decidir". Uma guarda que falha não muda nada, e a publicação pode ser repetida.
- **Rollback:**
  - o front volta pelo promote do commit anterior. Depois do PR 2, o front antigo não cadastra quem não tem e-mail (risco 1);
  - a migration 2 volta com uma migration nova que retira os triggers e os `CHECK`s. A normalização dos dados fica;
  - a `create-user-admin` volta pelo "Deploy: banco" de um commit anterior.

### Conferência em produção (tarefa 1)

> **Resultado em 2026-11-24 (sessão principal, só leitura, com o E2.01 PR 1 já em produção).** Só dados de teste (5 cadastros):
> - `a` · RN-03 sexo vazio: 1 cadastro. Bloqueia o PR 2; decidir a correção antes dele.
> - `auto` · RN-05 e-mail fictício no cadastro: 4 cadastros (viram vazio na migration 2; as contas continuam).
> - `b` · RN-08 sem identificador real: os mesmos 4 cadastros (aviso no formulário).
> - Nenhum repetido, ciclo, pastor com líder, CPF ou e-mail inválido; classificação de letras ok. O PR 1 não está bloqueado.
>
> **Resultado em 2026-11-25 (sessão principal, só leitura, com o E1.04, o E2.01 e o E2.02 inteiros em produção).** Nenhuma linha `a` nem `infra` (o sexo vazio de 2026-11-24 foi corrigido):
> - `auto` · RN-05 e-mail fictício no cadastro: 4 cadastros (viram vazio na migration 2).
> - `b` · RN-08 sem identificador real: os mesmos 4 cadastros.
> - Nenhum repetido. O PR 1 e o PR 2 estão liberados; rodar de novo antes do "Deploy: banco" do PR 2.

Só leitura. O usuário roda no SQL Editor de produção (papel `postgres`), antes do "Deploy: banco" do PR 1 e de novo antes do PR 2.
- A saída traz só o tipo, o problema, o tratamento e os ids, sem nome, e-mail, celular ou CPF.
- Ela funciona com ou sem as colunas do E2.01, porque lê `deleted_at` por `to_jsonb`.
- Tipos:
  - `a`: para a migration até ser corrigido (decisão do usuário);
  - `auto`: corrigido sozinho pela migration 2, sem perda (DA-8);
  - `b`: fica como está, com aviso no formulário;
  - `info`: só informação;
  - `infra`: se aparecer, parar e voltar ao `architect`.

```sql
-- E2.04 · Conferência em produção, só leitura. Não grava nada.
WITH RECURSIVE
base AS (
  SELECT m.id, m.name, m.gender, m.email, m.cpf, m.mobile_whatsapp, m.birth_date,
         m.is_pastor, m.has_leadership, m.leader_id, m.spouse_id, m.is_baptized, m.baptism_date,
         (to_jsonb(m) ->> 'deleted_at') IS NOT NULL                                  AS is_deleted,
         nullif(lower(btrim(m.email)), '')                                             AS email_n,
         nullif(regexp_replace(coalesce(m.cpf, ''), '\D', '', 'g'), '')                AS cpf_d,
         ltrim(regexp_replace(coalesce(m.mobile_whatsapp, ''), '\D', '', 'g'), '0')    AS mob_z,
         nullif(btrim(regexp_replace(coalesce(m.name, ''), '[[:space:]]+', ' ', 'g')), '') AS name_n
    FROM public.members m
),
calc AS (
  SELECT b.*,
         CASE WHEN length(x.mob) IN (10, 11) THEN x.mob END AS mobile_n,
         CASE WHEN b.cpf_d ~ '^[0-9]{11}$' AND b.cpf_d <> repeat(left(b.cpf_d, 1), 11) THEN
                (SELECT sum(substr(b.cpf_d, i, 1)::int * (11 - i)) * 10 % 11 % 10 FROM generate_series(1, 9) i)
                  = substr(b.cpf_d, 10, 1)::int
            AND (SELECT sum(substr(b.cpf_d, i, 1)::int * (12 - i)) * 10 % 11 % 10 FROM generate_series(1, 10) i)
                  = substr(b.cpf_d, 11, 1)::int
              ELSE false END                                                            AS cpf_valid,
         coalesce(length(b.email_n) <= 254
                  AND b.email_n ~ '^[^[:space:]@]+@[^[:space:]@.]+(\.[^[:space:]@.]+)+$', false) AS email_ok,
         split_part(coalesce(b.email_n, ''), '@', 2) = 'mci12fakemail.com'               AS email_fake,
         (SELECT count(*) FROM regexp_split_to_table(coalesce(b.name_n, ''), ' ') w
           WHERE w ~ '[[:alpha:]]')                                                     AS name_words
    FROM base b
    CROSS JOIN LATERAL (SELECT CASE WHEN length(b.mob_z) IN (12, 13) AND left(b.mob_z, 2) = '55'
                                    THEN substr(b.mob_z, 3) ELSE b.mob_z END AS mob) x
),
k AS (
  SELECT c.*,
         CASE WHEN length(c.mobile_n) = 11 AND substr(c.mobile_n, 3, 1) = '9'
              THEN left(c.mobile_n, 2) || substr(c.mobile_n, 4) ELSE c.mobile_n END AS mobile_key,
         (sp.today)                                                                   AS today
    FROM calc c CROSS JOIN (SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS today) sp
),
up AS (
  SELECT k.id AS origin, k.leader_id AS next_id, ARRAY[k.id] AS path FROM k WHERE k.leader_id IS NOT NULL
  UNION ALL
  SELECT up.origin, m.leader_id, up.path || m.id
    FROM up JOIN public.members m ON m.id = up.next_id
   WHERE NOT m.id = ANY (up.path)
),
problems (tipo, problema, tratamento, id) AS (
  -- Tipo (a): decidir antes do deploy
  SELECT 'a', 'RN-03 sexo vazio ou fora de M/F', 'informar o sexo', id FROM k
   WHERE gender IS NULL OR gender NOT IN ('M', 'F')
  UNION ALL
  SELECT 'a', 'RN-04 e-mail fora do formato', 'corrigir ou apagar', id FROM k
   WHERE email_n IS NOT NULL AND NOT email_fake AND NOT email_ok
  UNION ALL
  SELECT 'a', 'RN-07 CPF inválido', 'corrigir ou apagar', id FROM k
   WHERE cpf !~ '^[[:space:]]*$' AND NOT cpf_valid        -- sem dígitos também conta; vazio é 'auto'
  UNION ALL
  SELECT 'a', 'RN-09 e-mail repetido (não excluídos)', 'deixar num cadastro só', k1.id FROM k k1
   WHERE NOT k1.is_deleted AND k1.email_n IS NOT NULL
     AND EXISTS (SELECT 1 FROM k k2 WHERE k2.id <> k1.id AND NOT k2.is_deleted AND k2.email_n = k1.email_n)
  UNION ALL
  SELECT 'a', 'RN-09 celular repetido, com o 9º dígito (não excluídos)', 'deixar num cadastro só', k1.id FROM k k1
   WHERE NOT k1.is_deleted AND k1.mobile_key IS NOT NULL
     AND EXISTS (SELECT 1 FROM k k2 WHERE k2.id <> k1.id AND NOT k2.is_deleted AND k2.mobile_key = k1.mobile_key)
  UNION ALL
  SELECT 'a', 'RN-09 CPF repetido, válido ou não (não excluídos)', 'deixar num cadastro só', k1.id FROM k k1
   WHERE NOT k1.is_deleted AND k1.cpf_d IS NOT NULL
     AND EXISTS (SELECT 1 FROM k k2 WHERE k2.id <> k1.id AND NOT k2.is_deleted AND k2.cpf_d = k1.cpf_d)
  UNION ALL
  SELECT 'a', 'RN-11 pastor com líder', 'tirar o líder ou desmarcar pastor', id FROM k
   WHERE is_pastor AND leader_id IS NOT NULL
  UNION ALL
  SELECT 'a', 'RN-11 "Tem Liderança?" ligado sem líder (não pastor)', 'escolher o líder ou desligar a chave', id FROM k
   WHERE NOT is_pastor AND has_leadership AND leader_id IS NULL
  UNION ALL
  SELECT 'a', 'RN-13 líder de si mesmo', 'trocar o líder', id FROM k WHERE leader_id = id
  UNION ALL
  SELECT DISTINCT 'a', 'RN-13 dentro de um ciclo', 'trocar um dos líderes do ciclo', origin FROM up
   WHERE next_id = origin
  UNION ALL
  SELECT 'a', 'RN-14 cônjuge de si mesmo', 'desfazer o vínculo (sugestão)', id FROM k WHERE spouse_id = id
  UNION ALL
  SELECT 'a', 'RN-16 data do batismo sem "Batizado(a)?"', 'apagar a data ou marcar batizado', id FROM k
   WHERE NOT is_baptized AND baptism_date IS NOT NULL
  -- Corrigidos sozinhos pela migration 2 (DA-8)
  UNION ALL
  SELECT 'auto', 'Texto vazio ou só com espaços (CPF, e-mail, celular, telefone, endereço etc.)', 'vira vazio (nulo)', m.id
    FROM public.members m
   WHERE EXISTS (SELECT 1 FROM unnest(ARRAY[m.email, m.cpf, m.mobile_whatsapp, m.phone, m.instagram, m.avatar_url,
                                            m.notes, m.street, m.number, m.complement, m.neighborhood, m.city,
                                            m.state, m.zip_code]) v WHERE v ~ '^[[:space:]]*$')
  UNION ALL
  SELECT 'auto', 'RN-05 e-mail fictício no cadastro', 'vira vazio; a conta continua com ele', id FROM k WHERE email_fake
  UNION ALL
  SELECT 'auto', 'RN-04 e-mail com maiúsculas ou espaços', 'minúsculas e sem espaços', id FROM k
   WHERE email_ok AND NOT email_fake AND email IS DISTINCT FROM email_n
  UNION ALL
  SELECT 'auto', 'RN-07 CPF com pontuação', 'só os 11 dígitos', id FROM k WHERE cpf_valid AND cpf <> cpf_d
  UNION ALL
  SELECT 'auto', 'RN-06 celular legível fora da forma gravada', 'DDD e número, sem o 55', id FROM k
   WHERE mobile_n IS NOT NULL AND mobile_whatsapp <> mobile_n
  UNION ALL
  SELECT 'auto', 'RN-02 nome com espaços sobrando', 'espaços ajustados', id FROM k
   WHERE name_n IS NOT NULL AND name <> name_n
  UNION ALL
  SELECT 'auto', 'RN-11 pastor com "Tem Liderança?" ligado', 'desliga a chave', id FROM k
   WHERE is_pastor AND leader_id IS NULL AND has_leadership
  UNION ALL
  SELECT 'auto', 'RN-11 com líder e "Tem Liderança?" desligado', 'liga a chave', id FROM k
   WHERE leader_id IS NOT NULL AND NOT has_leadership
  -- Tipo (b): ficam como estão
  UNION ALL
  SELECT 'b', 'RN-02 nome de uma palavra só', 'aviso no formulário', id FROM k WHERE name_words < 2
  UNION ALL
  SELECT 'b', 'RN-06 celular ilegível', 'aviso; não serve para entrar', id FROM k
   WHERE mob_z <> '' AND mobile_n IS NULL
  UNION ALL
  SELECT 'b', 'RN-08 sem identificador real', 'aviso; a pessoa não consegue entrar', id FROM k
   WHERE NOT ((email_ok AND NOT email_fake) OR mobile_n IS NOT NULL OR cpf_valid)
  UNION ALL
  SELECT 'b', 'RN-15 nascimento fora do intervalo', 'aviso no formulário', id FROM k
   WHERE birth_date > today OR birth_date <= (today - interval '100 years')::date
  -- Informação
  UNION ALL
  SELECT 'info', 'Conta de acesso sem cadastro', 'nada a fazer; a sign-in não chega a ela', u.id
    FROM auth.users u WHERE NOT EXISTS (SELECT 1 FROM public.members m WHERE m.auth_user_id = u.id)
  UNION ALL
  SELECT 'infra', 'Classificação de letras do banco', 'parar e voltar ao architect', NULL::uuid
   WHERE NOT ('É' ~ '[[:alpha:]]' AND 'ç' ~ '[[:alpha:]]' AND NOT ('2' ~ '[[:alpha:]]'))
)
SELECT tipo, problema, tratamento, count(*) AS cadastros, array_agg(id ORDER BY id) AS ids
  FROM problems
 GROUP BY tipo, problema, tratamento
 ORDER BY tipo, problema;
```
- Nenhuma linha `a` e nenhuma `infra`: o deploy pode seguir.
- As linhas `a` de repetidos bloqueiam já o PR 1 (índices únicos). As demais `a` bloqueiam o PR 2.

### Verificações obrigatórias (para o QA)
**pgTAP** (`supabase/tests/database/e204_*.test.sql`, autocontido, com `ROLLBACK`). A massa é a do spec: Samuel, Magda, Pedro, André, Caio, Davi, Rita, Diego, Ester, Otávio, Olga e Bruno. Fábio é inserido em `replica` (dado antigo fora do tipo b), e há uma cadeia de 8 níveis (N1 a N8).

- **Estrutura e grants:**
  - os `CHECK`s, o `NOT NULL` e os três índices únicos parciais, com os nomes;
  - `has_leadership` sem default;
  - as funções novas `IMMUTABLE`, com EXECUTE para `authenticated` e `service_role` e sem `anon`;
  - `member_account_email` só para `service_role`;
  - `_member_values_in_use` e `private.member_rule_violations` sem EXECUTE para `authenticated`;
  - `member_descendants_among` sem `anon`;
  - a ordem dos triggers `BEFORE` (`a0_` < `aa_` < `ab_` < `ac_` < `ad_` < `compute_member_g12_level`);
  - as migrations rodam de novo sem erro;
  - as guardas da migration 1 (repetidos) e da 2 (violações) falham com a lista de ids, sem mudar nada e sem dado pessoal na mensagem.
- **Tabela de casos (AQ-2):** o SQL gerado roda cada função sobre cada linha do JSON, e `placeholder_email_domains()` é igual à lista do JSON.
- **RN-01:**
  - a *service role* e o `postgres` recebem `name_invalid`;
  - em `replica`, os `CHECK`s e os índices valem, e o trigger não;
  - **leitura técnica 1:** um usuário sem `create_member` que faz um INSERT com sexo vazio, com o CPF de outro cadastro ou com o e-mail da conta de um excluído recebe 42501, e nunca a regra.
- **RN-02 a RN-19:** todo critério "pela API", com o código, o campo e a mensagem. Inclui:
  - RN-05: o e-mail fictício vindo do cliente é recusado, e o cadastro criado pela `create-user-admin` fica com `members.email` nulo e a conta com `member_account_email(id)`;
  - RN-09: o 9º dígito nos dois sentidos; o inativo conta; o excluído não conta; o casal; o dado liberado (Caio troca, Lúcia usa); a restauração de Bruno com a chave nova;
  - RN-10: dois campos de uma vez; o `DETAIL` traz só `code` e `fields`;
  - RN-11 e RN-12: as derivações (Ester ganha líder; André vira pastor tirando o líder; Magda deixa de ser pastora; Samuel com a chave ligada de propósito; a chave omitida no INSERT de pastor e de não pastor); Pedro com a chave omitida recebe `leader_required`, e com a chave desligada, a recusa da RN-10 do E2.02;
  - RN-13: si mesmo; Davi inativo; N8 → N1; uma subida que passa por um excluído;
  - RN-15: `birth_date_problem` com "hoje" = 23/11/2026 (24/11/1926 aceito, 23/11/1926 recusado, 24/11/2026 recusado) e com 29/02/2000; o trigger com datas relativas a `sp_today()`;
  - RN-17: Fábio salvo sem mudança; o celular reenviado com máscara não conta como mudado; Pedro, sem dados sensíveis, não muda nem recebe recusa nos campos sensíveis;
  - RN-19: a ordem da DA-11 com dois problemas ao mesmo tempo (por exemplo, nome inválido e CPF em uso: vem o nome); e-mail em uso e CPF de um excluído: vem `value_in_use`, sem `deleted_account_email`.
- **Ensaio (`check_member_insert`):** as mesmas recusas do INSERT real, nada gravado e nenhum evento de Auditoria.
- **`member_descendants_among`:** 42501 sem `edit_member`; nada sobre quem não é visível (Diego para Pedro); inativos incluídos; a própria pessoa fora; mais de 100 ids recusado.
- **Invariantes:** `private.member_rule_violations()` sem linhas no fim de cada arquivo.
- **Correções da migration 2 (DA-8, DT-24):** um cadastro com `''` ou só espaços em CPF, celular, telefone, e-mail, Instagram, observações e endereço não para a guarda e fica com nulo nesses campos; o CPF válido com máscara vira só dígitos e o CPF com letras para a guarda (`cpf`); o `a0_` grava nulo para o vazio em todos esses campos, no INSERT e no UPDATE, inclusive pela *service role*; a conferência mostra o vazio como `auto`.

**Concorrência** (`supabase/tests/concurrency/e204_concurrency.sh`, duas ou três conexões e `pg_sleep`, como no E2.01):
- dois INSERTs com o mesmo CPF: um aceito, o outro com `value_in_use`, sem `23505`;
- Lúcia → Paulo × Paulo → Lúcia: um aceito, o outro com `leader_cycle` ou 40P01 (DT-25); nunca os dois aceitos;
- A → B, B → C e C → A em três conexões: no máximo duas aceitas;
- restauração de Bruno × cadastro com o celular equivalente;
- Caio troca o e-mail × cadastro com o e-mail antigo.

Cada cenário termina sem violação em `private.member_rule_violations()`, com a mensagem amigável ou com 40P01.

**`create-user-admin`** (Deno para `lib/errors.ts`; stack local para o resto):
- a mesma tentativa duas vezes, em sequência e em paralelo: um cadastro, uma conta e `replayed: true` na segunda;
- a corrida do CPF pela função: só uma conta no Auth;
- `email_placeholder`, `value_in_use` com dois campos e 403 sem `create_member`, sem nenhuma conta criada;
- `deleted_matches` só depois que nada está em uso (RN-10);
- a conta nova tem `id` = id do membro e o e-mail técnico, e o login pela `sign-in` com o celular funciona.

**Volume:** as metas do risco 11, com o `EXPLAIN` anexado ao PR.

**Vitest:**
- as tabelas de casos (nome, e-mail, domínios, celular, CPF, nascimento, idade e o que o campo mostra ao sair dele);
- a sincronia entre o JSON e o SQL gerado;
- `validation.ts`, `changes.ts` (a UX-22 e o Caio com máscara), `leadership.ts` (P20 e a UX-18), `codes.ts` e `masks.ts` (o cursor).

**Playwright:** os critérios de UX do PR 3, os critérios das RNs pela tela e o *smoke* de login.

## Tarefas
_Seção do `architect`._

Três PRs no `mci-connect`. **Tudo começa depois do E1.04 inteiro, do E2.01 inteiro e do PR 1 do E2.02 em produção.** O PR 3 também espera o front do E2.02 (T6).
- Dentro de cada PR, o banco vai primeiro, e os tipos são regenerados antes do front.
- Cada desenvolvedor aciona o `code-reviewer` ao terminar a sua tarefa; esse passo não aparece na tabela.
- Na coluna RNs, os números são das regras deste spec. Na coluna UX, os dos critérios `UX-`.

| # | Responsável | Descrição | Arquivos | RNs | UX | Depende de |
|---|---|---|---|---|---|---|
| **PR 1: banco neutro (funções, unicidade e discípulos)** | | | | | | |
| 1 | usuário | Rodar a [conferência](#conferência-em-produção-tarefa-1) em produção (só leitura) e decidir as linhas `a`. Os repetidos são corrigidos antes do PR 1, e o resto antes do PR 2. Uma linha `infra` para tudo e volta ao `architect`. | — | 09, 18 | — | E2.01 e E1.04 em produção |
| 2 | backend-developer | Migration 1: guarda de pré-requisitos e da classificação de letras; funções de regra (`placeholder_email_domains`, `placeholder_email_domain`, `is_placeholder_email` reescrita, `is_valid_email`, `normalize_person_name`, `is_valid_person_name`, `member_has_login_identifier`, `birth_date_problem`, `member_account_email`); `_member_values_in_use`; `member_descendants_among`; `private.member_rule_violations()`; guarda de repetidos e os três índices únicos; `restore_member` (e) e `find_deleted_member_matches` com a chave do 9º dígito; grants. Regenerar o `types.ts`. | `supabase/migrations/<ts>_e204_01_rule_functions.sql`, `src/integrations/supabase/types.ts` | 02, 04, 05, 07, 08, 09, 10, 13, 15, 18 | dados de 19 | 1 (sem repetidos); PR 1 do E2.02 em produção |
| 3 | qa | Tabela de casos `member-validation-cases.json`, o gerador do SQL e o teste de sincronia; pgTAP das funções, dos índices (9º dígito, excluídos fora, inativos dentro), da RPC de discípulos e da restauração e do aviso de excluído com a chave nova; `EXPLAIN` da RPC no volume de referência. | `supabase/tests/fixtures/member-validation-cases.json`, `scripts/gen-member-cases-sql.*`, `supabase/tests/database/e204_01_*.test.sql` | 02, 04, 05, 07, 09, 13, 15 | — | 2 (escreve em paralelo, a partir dos contratos) |
| **PR 2: regras no banco e cadastro com conta** | | | | | | |
| 4 | backend-developer | Migration 2: correções sem perda (DA-8); guarda das violações (só ids); `NOT NULL` em `gender`; `has_leadership` sem default; os `CHECK`s; `normalize_member_input` + `a0_normalize_member`; `enforce_member_rules` + `ad_enforce_member_rules` (ordem da DA-11, travas da DT-07 e DT-08); regra 1 em `enforce_member_write_rules`; `enforce_member_scope`, `enforce_member_links`, `sync_spouse_relationship` e `check_member_insert` ajustados; grants. Adaptar as massas dos pgTAP existentes (E1.08, E2.01, E2.02, E1.04) e o gerador de volume às regras. Regenerar o `types.ts`. | `supabase/migrations/<ts>_e204_02_member_rules.sql`, `supabase/tests/database/e108_*.test.sql`, `supabase/tests/database/e201_*.test.sql`, `supabase/tests/database/e202_*.test.sql`, `supabase/tests/database/e104_*.test.sql`, `src/integrations/supabase/types.ts` | 01 a 19 (banco) | — | 2 (PR 1 em produção); PR 3 do E1.04 em produção |
| 5 | backend-developer | `create-user-admin`: contrato novo (`attemptId`, e-mail só em `memberData`); permissão antes de tudo; tentativa repetida; ensaio antes do aviso de excluído; conta com `id` = `attemptId` e `member_account_email`; INSERT com `id` e `auth_user_id`; desfazimento só da conta criada na chamada; `23505` de `members_pkey` e de identificador; respostas da tabela. Tradução pura em `lib/errors.ts`, com testes em Deno. | `supabase/functions/create-user-admin/index.ts`, `supabase/functions/create-user-admin/lib/errors.ts`, `supabase/functions/create-user-admin/lib/errors.test.ts` | 05, 09, 10, 19 | dados de 12, 13, 25 | 4 |
| 6 | frontend-developer | Ajuste mínimo: o `MemberForm` não monta o e-mail fictício; `attemptId` por abertura do formulário; corpo novo da `create-user-admin`; e-mail apagado na edição vai como `null`; mensagem do servidor pelo `parseAppError` (ainda no toast); `Members.tsx` sem o filtro do domínio fictício. | `src/components/MemberForm.tsx`, `src/pages/Members.tsx` | 05, 08 | 24 (envio do e-mail vazio) | 5 (tipos) |
| 7 | qa | pgTAP de todas as RNs no banco e da ordem das recusas ([Verificações](#verificações-obrigatórias-para-o-qa)); concorrência (5 cenários); testes da `create-user-admin` na stack local; *smoke* do cadastro pela tela atual e do login pela `sign-in`. | `supabase/tests/database/e204_02_*.test.sql`, `supabase/tests/concurrency/e204_concurrency.sh` | 01 a 19 | — | 4, 5, 6 |
| **PR 3: formulário de membro (UX)** | | | | | | |
| 8 | frontend-developer | Domínio puro, com Vitest sobre as tabelas de casos: `src/lib/members/{identifiers,name,birth-date,validation,changes,leadership,codes,texts}.ts`, `src/lib/dates/sao-paulo.ts` e `src/lib/masks.ts`. O `src/lib/auth/identifier.ts` do E1.04 passa a importar de `identifiers.ts`. | os arquivos citados e os `*.test.ts` deles | 02 a 08, 11, 12, 15 a 17 | dados de 06, 07, 09, 11, 20, 22 | 3 (tabela de casos) |
| 9 | frontend-developer | `MemberForm` da UX (T1 a T7): diálogo responsivo (P1), ordem e grupo Identificação, Sexo em `RadioGroup`, máscaras (P23), interruptores com aviso (P20), mensagens (P21), erros ao salvar com resumo e foco (P22), avisos de dado antigo (P24), envio e descartar; react-hook-form com o *resolver* de `validateMemberForm`; `use-member-save` (PATCH só com o que mudou, recusas no campo); seletor de líder com `descendantOf` e opção desabilitada com o motivo. | `src/components/MemberForm.tsx`, `src/components/members/*`, `src/components/select/PaginatedSelect.tsx`, `src/components/AsyncMemberSelect.tsx`, `src/hooks/use-member-save.ts`, `src/hooks/use-member-options.ts`, `index.html` (`viewport-fit=cover`, se ainda faltar) | 02 a 08, 10 a 17, 19 | 01 a 31 | 8; PR 2 em produção; T6 do E2.02 |
| 10 | ux-designer | Revisão da UI do PR 3 (T1 a T7, P1, P5, P20 a P24) em 320, 360 e 1280 px, nos temas claro e escuro. | — | — | 01 a 05, 08 a 19, 21, 24 a 31 | 9 |
| 11 | qa | Testes de componente (UX-02 a UX-12, 18, 20, 22 a 27, 30); Playwright (UX-01, 06, 08, 11, 13 a 17, 19, 21, 25, 28, 31; as RNs pela tela; *smoke* de login); inspeção com axe (UX-27). | `src/**/*.test.tsx`, `e2e/membro-validacoes-*.spec.ts` | 02 a 17, 19 | ver descrição | 9 |
| **Fechamento** | | | | | | |
| 12 | architect | Revisão final dos 3 PRs; atualizar o `CLAUDE.md` (estado atual e armadilhas, ver [Dependências](#dependências-e-impactos-em-outros-passos)). O aceite da fase 2, a matriz e o `docs/migracao.md` são do `product-owner`. | `CLAUDE.md` | — | — | 3, 7, 10, 11 |

**Ordem de execução:**
- PR 1: 1 → 2 → 3. A 3 é escrita em paralelo com a 2 e roda depois dela.
- PR 2: depois do PR 1 em produção e do PR 3 do E1.04 em produção. 4 → 5 → 6 → 7. O "Deploy: banco" e o promote saem juntos (risco 1).
- PR 3: a 8 pode começar logo depois do merge do PR 1 (a tabela de casos). Depois, 9 → (10 ∥ 11), com o PR 2 em produção e a T6 do E2.02 no ar.
- 12 no fim.

**Critérios de pronto**
1. **Todas as tarefas de banco:**
   - as migrations rodam num banco zerado depois das existentes e rodam de novo sem erro;
   - nenhuma função nova tem EXECUTE para `anon`;
   - o `types.ts` está regenerado;
   - a suíte inteira de pgTAP (E1.04, E1.08, E2.01, E2.02 e E2.04) passa.
2. **Tarefa 2:** num banco com dois cadastros não excluídos com `5188887777` e `51988887777`, a migration falha com os dois ids e não cria nada. A restauração de Bruno recusa o celular equivalente.
3. **Tarefa 4:**
   - todo critério "pela API" passa, com o código, o campo e a mensagem do spec;
   - um usuário sem `create_member` nunca recebe uma recusa deste spec;
   - os 5 cenários de concorrência terminam sem violação;
   - `private.member_rule_violations()` volta vazia na massa do spec.
4. **Tarefa 5:**
   - nenhuma recusa deixa conta no Auth, inclusive na corrida do CPF;
   - a tentativa repetida devolve o mesmo cadastro;
   - a resposta nunca traz `details` do Postgres nem dado de outro cadastro.
5. **Tarefas 6, 8 e 9:**
   - `npm run lint`, `npm test` e `npm run build` verdes;
   - sem `any` e sem asserção de tipo (`as Tipo`) nos arquivos novos (`as const` é permitido);
   - nenhuma regra de domínio dentro de componente;
   - nenhum texto do spec fora de `src/lib/members/texts.ts`;
   - nenhuma leitura de `members` direto da tabela.
6. **Tarefa 9:**
   - uma edição sem mudança não faz nenhuma requisição;
   - o PATCH leva só os campos alterados;
   - nenhuma consulta de unicidade acontece fora do salvar (UX-09);
   - o domínio fictício não aparece em nenhum lugar do DOM (UX-24).
7. **Tarefa 10:** o `ux-designer` dá o veredito e lista os ajustes, que voltam ao `frontend-developer` antes de o QA fechar o PR.

### Revisão final do passo (tarefa 12)
2026-11-25, `architect`, sobre o diff acumulado dos PRs #35, #36 e #37 (base `b50308d`). **Veredito: APROVADO.** Nenhum achado bloqueia.

Conferido:
- **Desenho × implementação:** as duas migrations seguem a Solução técnica, com os desvios do Status. O front segue [Front](#front): regra pura em `src/lib/members/`, `src/lib/dates/sao-paulo.ts` e `src/lib/masks.ts`; gravação no `use-member-save` (fecha o backlog 3 do E2.02; o `MemberForm` caiu de 817 para ~410 linhas); "Carregando…" no "Criar membro" (backlog 5 do E2.02). As três pendências do PR 2 (recusas no campo, celular com máscara ao abrir, "Tem Liderança?" ligado no cadastro novo) foram fechadas.
- **Segurança:** as funções *definer* novas têm `search_path` e checam a permissão dentro (`member_descendants_among`: `edit_member` e `viewer_sees_member` no alvo e nos candidatos); `_member_values_in_use`, `member_account_email` e `private.member_rule_violations()` sem EXECUTE para `authenticated`; nada novo para `anon`. Na `create-user-admin`: permissão antes de tudo, `attemptId` só UUID v4, a procura da tentativa olha também os excluídos (um `attemptId` igual ao id de um cadastro nunca mexe na conta dele), e a senha só é regravada numa conta órfã com o e-mail técnico do mesmo id. As respostas não trazem dado de outro cadastro.
- **Concorrência:** unicidade pelos índices, com as travas por valor só para citar todos os campos; ciclo sob a trava única da árvore; 40P01 tratado na tela (DT-25); cadastro idempotente, o que torna seguro o tempo-limite de 20 s do cliente (a nova tentativa repete o `attemptId`; a corrida da mesma tentativa é o risco 4).
- **Escala:** metas do risco 11 dentro, menos a troca de líder (abaixo). Seletor de líder: uma chamada da RPC por página, sem N+1.
- **Front:** sem `any` e sem asserção de tipo nos arquivos novos; sem leitura de `members` (só a escrita com `.select("id")`); textos em `src/lib/members/texts.ts`.

Backlog (responsável, prioridade):
1. `backend-developer`, baixa: o item 8 do backlog do E2.02 **não** foi fechado pelo E2.04. Proposta: no INSERT de `members`, `auth_user_id IS NULL OR auth_user_id = id` (a `create-user-admin` e a carga do E4.08 já usam o id do membro na conta). Migration própria, para não pôr "Deploy: banco" num PR só de front.
2. E2.06: a troca de líder leva de 39 a 55 ms com 20 mil membros (meta de 20 ms), quase tudo no `trg_refresh_stats_members`, e segura a trava `members:leader-tree` até o *commit*.
3. `frontend-developer`, baixa: o *placeholder* "Selecione a função" do `MemberRoleField` (E2.02) fora de `texts.ts`; o `save` do `use-member-save` repete a conta do `hasMemberChanges`; o CEP do `MemberAddressSection` usa `replace(/\D/g, "")` em vez de `normalizeDigits`.
4. Aceitos pelo `ux-designer`: o rodapé do `ResponsiveDialogContent` com `0.75rem` + área segura (o P1 pede `1rem`); o motivo da opção desabilitada anunciado de forma própria só no VoiceOver (nos outros leitores vai no texto da opção). UX-29 (leitor de tela) fica para inspeção manual.

## Testes
_Seção do `qa`._

| RN | Testes | Resultado |
|---|---|---|
| RN-02, DA-12 | PR 1: `e204_01_functions_cases` (N01–N20, gerado de `member-validation-cases.json`) | ✅ |
| RN-04, DA-3 | PR 1: `e204_01_functions_cases` (E01–E23) | ✅ |
| RN-05, DT-18 | PR 1: `e204_01_functions_cases` (domínios iguais ao JSON), `e204_01_structure_grants` | ✅ |
| RN-06, DA-5 | PR 1: `e204_01_functions_cases` (M01–M13) | ✅ |
| RN-07 | PR 1: `e204_01_functions_cases` (C01–C13) | ✅ |
| RN-08 | PR 1: `e204_01_functions_cases` (I01–I12) | ✅ |
| RN-15, DA-13 | PR 1: `e204_01_functions_cases` (B01–B16: 23/11/2026, 29/02/2000) | ✅ |
| RN-09, RN-10, DT-07 | PR 1: `e204_01_unique_restore` (9º dígito nos dois sentidos, inativo e casal contam, excluído não conta, celular ilegível fora, dado liberado, restauração de Bruno, `find_deleted_member_matches`, `_member_values_in_use`) | ✅ |
| RN-13, AQ-4 | PR 1: `e204_01_descendants` (42501 sem `edit_member`, `anon`, Diego para Pedro, inativos, a própria pessoa fora, N1–N8, ciclo antigo, 100/101 ids) | ✅ |
| RN-09, RN-18 | PR 1: `e204_01_duplicates_guard` (mensagem só com ids e campo, nada criado); `e204_01_member_rule_violations` (as 15 regras) | ✅ |
| Estrutura e grants | PR 1: `e204_01_structure_grants` | ✅ |
| Sincronia (DT-17) | PR 1: `src/test/member-validation-cases-sync.test.ts` | ✅ |

PR 1 (2026-11-25, stack local): pgTAP 29 arquivos e 3083 asserções ok; Vitest 98 arquivos e 1264 testes ok; `tsc` e `build` ok (o `lint` tem 3 erros antigos em arquivos fora do PR); Playwright `--workers=1` com 231 ok e 3 falhas de ambiente (UX-19 de `excluidos-membros`, `sign-in-stack:235`, `sign-in.spec.ts:391` oscilante). Volume (`e204_volume.psql`, 20 mil membros, 21 ids): `member_descendants_among` em 2,8 ms (igreja toda) e 14,4 ms (G12), meta de 20 ms; quase todo o custo do G12 é o `viewer_sees_member` por candidato.

| RN | Testes | Resultado |
|---|---|---|
| RN-01, leitura técnica 1 | PR 2: `e204_02_rules_api` (service role e `postgres` recebem as regras; `replica` só `CHECK`s e índices; sem `create_member`, 42501 antes de qualquer regra); `create-user-admin.spec` (403 antes das regras, sem conta) | ✅ |
| RN-02 a RN-08 | PR 2: `e204_02_rules_api`; `create-user-admin.spec` (`email_placeholder`, `members.email` nulo, conta técnica, gravado normalizado); `cadastro-membro-regras.spec` | ✅ |
| RN-09, RN-10, DT-07 | PR 2: `e204_02_rules_api`; `e204_concurrency` (CPF, restauração de Bruno, e-mail de Caio); `create-user-admin.spec` (corrida do CPF com uma conta só, dois campos, `value_in_use` antes de `deleted_matches`); `cadastro-membro-regras.spec` (edição com celular em uso) | ✅ |
| RN-11, RN-12 | PR 2: `e204_02_rules_api` (derivações, chave omitida); `e204_02_insert_check` | ✅ |
| RN-13, RN-14, DT-08, DT-25 | PR 2: `e204_02_rules_api` (N1 a N8, subida por excluído); `e204_concurrency` (Lúcia × Paulo: `leader_cycle` ou 40P01, nunca os dois; A → B → C → A: no máximo duas) | ✅ |
| RN-15 a RN-17 | PR 2: `e204_02_rules_api` (datas relativas a `sp_today()`, Fábio, Pedro sem dados sensíveis) | ✅ |
| RN-19, DA-11 | PR 2: `e204_02_rules_api` (14 pares de ordem, nada gravado); `e204_02_insert_check` (ensaio igual ao INSERT, sem evento, grava `id`) | ✅ |
| DA-8, DT-24 | PR 2: `e204_02_normalize_corrections` (vazio vira nulo no INSERT e no UPDATE, inclusive pela *service role*; correções da migration; CPF com máscara e com letras; guarda sem dado pessoal; condição `cpf` de `member_rule_violations`) | ✅ |
| DT-11, DA-10, RN-18 do E2.01 | PR 2: `create-user-admin.spec` (`attemptId` em sequência e em paralelo, `attempt_already_used`, `deleted_account_email` com `matches`); `cadastro-excluido.spec` | ✅ |
| Estrutura e grants | PR 2: `e204_02_structure_grants` | ✅ |

PR 2 (2026-11-25, stack local): pgTAP 33 arquivos e 3388 asserções ok; concorrência `e204` em 3 execuções (139 PASS cada), `e104` 26, `e201` 71, `e202` 47 (o cenário 3b passou a considerar outros administradores do banco), `e202_migrations` 29; Vitest 1302 ok; `tsc` e `build` ok (`lint` com 3 erros antigos); Playwright `--workers=1` com 235 ok e falhas de ambiente conhecidas (UX-19 de `excluidos-membros`, `sign-in-stack:235` e o axe do tema claro em `sign-in.spec.ts:416`, que oscila igual no commit base). Volume (20 mil membros): PATCH sem troca de líder de 1,2 a 3,2 ms, ensaio 3,4 ms, INSERT 3,3 ms; a troca de líder leva de 39 a 55 ms, quase tudo no recálculo de totais (`trg_refresh_stats_members`), anterior a este passo (E2.06). A `create-user-admin` levou de 90 a 160 ms com o banco quase vazio; não foi medida com 20 mil membros.

| RN / UX | Testes | Resultado |
|---|---|---|
| UX-02 a UX-07, UX-09, UX-18, UX-20, UX-22 a UX-27, UX-30, Tarefa 9 | PR 3: `MemberForm.validation.test.tsx` (85 testes: ordem e grupo, rótulos, Sexo, atributos, tabelas da T3, conferência fora do salvar, dados antigos, e-mail fictício, envio, descartar, `text-foreground`, nenhum texto técnico, PATCH só do que mudou, "Carregando…") | ✅ (também com `TZ=UTC` no UX-20) |
| UX-08, UX-10, UX-11, UX-12 | PR 3: componente (4 erros, resumo, foco, um caso por código) e `membro-validacoes-cadastro` / `-edicao` (UX-08 e UX-11 pela tela, Elisa) | ✅ |
| UX-01, UX-02, UX-04, UX-31 | PR 3: `membro-validacoes-cadastro` (360×800 e 1280, medidas, toque entre o texto e o interruptor) | ✅ |
| UX-06 | PR 3: componente (tabela) e `membro-validacoes-cadastro` (teclado real, cursor depois do 3º dígito) | ✅ |
| UX-13, UX-14, UX-15, UX-16, UX-17, UX-19, UX-21, UX-25 | PR 3: `membro-validacoes-cadastro` e `-edicao` (massa "QA6 Val"; falta de rede por `route.abort` e chamada pendurada (tempo-limite de 20 s); discípulo desabilitado; sem a AQ-4 por `route` na RPC; André sem dados sensíveis vê só Nome e Nascimento) | ✅ |
| UX-26 | PR 3: componente e `membro-validacoes-edicao` (clique fora, ✕, Esc, Cancelar; foco em "Continuar editando") | ✅ (clique fora e foco em "Continuar editando": 6 de 6) |
| UX-27 | PR 3: componente e axe nos dois temas (erros e avisos, sem o botão primário do tema escuro, que é do `--primary`) | ✅ |
| UX-28 | PR 3: `membro-validacoes-cadastro` (320 px, fonte a 200%) | ✅ (corrigido em `cb2dca5`; 6 de 6) |
| RN-02 a RN-08, RN-15, RN-16, RN-19 | PR 3: `membro-validacoes-cadastro` (um caso por regra, nada criado; só e-mail, só CPF; batismo apagado) | ✅ |
| RN-09, RN-10, RN-11, RN-12, RN-13, RN-14, RN-17 | PR 3: `membro-validacoes-cadastro` e `-edicao` (e-mail e CPF em uso, 9º dígito, líder obrigatório, pastor, ciclo, Fábio) | ✅ |
| Login (`sign-in`) | PR 3: *smoke* no `membro-validacoes-cadastro` (celular recém-cadastrado, senha inicial) | ✅ |

PR 3 (2026-11-25, stack local, após `cb2dca5`): Vitest 114 arquivos e 1699 testes ok; `tsc` e `build` ok (`lint` com os 3 erros antigos); Playwright `--workers=1` com 296 ok, 8 ignorados (já eram), 3 falhas de ambiente (UX-19 de `excluidos-membros:611`, `sign-in-stack:235` e `sign-in.spec.ts:416` claro) e 6 que não rodam por depender do `sign-in-stack:235`; nenhuma falha nova. O UX-02 oscilava por medir durante a animação de entrada do diálogo: agora espera `getAnimations()` (10 de 10). Os specs antigos de e2e foram ajustados ao formulário novo (Sexo em radio, "Líder *", "Salvar alterações", celular com máscara). Axe (UX-27): nada nas mensagens e nos campos deste PR; o botão primário do tema escuro (2,97:1) e os `badge`/`Button` da lista atrás do diálogo vêm do `--primary` global.
